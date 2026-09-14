/**
 * Razorpay payment verification (Supabase Edge Function).
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAY_WEBHOOK_SECRET   (optional, for webhooks)
 *
 * Never put these values in frontend JavaScript.
 *
 * Deploy:
 *   supabase functions deploy payments --no-verify-jwt
 *   (JWT is still verified below using the user's access token.)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(message) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PLANS = {
  monthly: { amount: 39900, period: "monthly", days: 30 },
  yearly: { amount: 399900, period: "yearly", days: 365 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
  const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("PAYMENTS_SERVER_KEY") || "";

  if (!razorpayKeyId || !razorpaySecret || !serviceKey) {
    return json({ ok: false, error: "Payment server configuration is incomplete." }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ ok: false, error: "Sign in required." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ ok: false, error: "Invalid session." }, 401);
  const user = userData.user;

  let payload = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const action = payload.action || "createCheckout";

  try {
    if (action === "createCheckout") {
      const period = payload.period === "yearly" ? "yearly" : "monthly";
      const plan = PLANS[period];
      const receipt = `fk_${user.id.slice(0, 8)}_${Date.now()}`;

      const auth = btoa(`${razorpayKeyId}:${razorpaySecret}`);
      const rzp = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: plan.amount,
          currency: "INR",
          receipt,
          notes: { user_id: user.id, period },
        }),
      });
      const order = await rzp.json();
      if (!rzp.ok) {
        return json({ ok: false, error: "Could not create checkout order." }, 502);
      }
      return json({
        ok: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId,
        period,
      });
    }

    if (action === "verifyPayment") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, period } = payload;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return json({ ok: false, error: "Missing payment details." }, 400);
      }
      const expected = await hmacSha256Hex(
        razorpaySecret,
        `${razorpay_order_id}|${razorpay_payment_id}`
      );
      if (expected.toLowerCase() !== String(razorpay_signature).toLowerCase()) {
        console.error("Razorpay signature mismatch", {
          hasOrderId: Boolean(razorpay_order_id),
          hasPaymentId: Boolean(razorpay_payment_id),
          signatureLength: String(razorpay_signature).length,
          expectedLength: expected.length,
        });
        return json({ ok: false, error: "Payment signature verification failed." }, 400);
      }

      const billing = period === "yearly" ? "yearly" : "monthly";
      const days = PLANS[billing].days;
      const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await admin.from("subscriptions").upsert(
        {
          user_id: user.id,
          plan: "pro",
          status: "pro",
          billing_period: billing,
          provider: "razorpay",
          provider_subscription_id: razorpay_payment_id,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) return json({ ok: false, error: "Could not activate subscription." }, 500);
      return json({ ok: true, status: "pro", current_period_end: periodEnd });
    }

    if (action === "activateSubscription") {
      return json({ ok: false, error: "Subscriptions activate only after verified payment." }, 400);
    }

    if (action === "cancelSubscription") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!sub) return json({ ok: false, error: "No subscription found." }, 404);
      const { error } = await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) return json({ ok: false, error: "Could not cancel subscription." }, 500);
      return json({ ok: true, status: sub.status, cancel_at_period_end: true });
    }

    return json({ ok: false, error: "Unknown action." }, 400);
  } catch {
    return json({ ok: false, error: "Payment service unavailable." }, 500);
  }
});

void sha256Hex;
