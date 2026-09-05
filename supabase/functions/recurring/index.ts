import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Scheduled recurring invoice generation.
 * Deploy with a cron secret. Does not send email.
 *
 * Secrets: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const expected = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const { data, error } = await admin.rpc("generate_due_recurring_invoices");
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: "Generation failed" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, invoice_ids: data || [] }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
