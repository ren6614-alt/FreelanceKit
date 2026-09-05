(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function paymentsConfigured() {
    return Boolean(FK.config.razorpayKeyId && FK.config.paymentsFunctionUrl);
  }

  async function callPayments(action, body) {
    if (!paymentsConfigured()) {
      const err = new Error("PAYMENTS_NOT_CONFIGURED");
      throw err;
    }
    const session = FK.session;
    const res = await fetch(FK.config.paymentsFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify({ action, ...body }),
    });
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Payment service unavailable.");
    }
    return data;
  }

  async function createCheckout(period) {
    if (!paymentsConfigured()) {
      FK.ui.toast("Payments are not configured yet.", "error");
      return null;
    }
    return callPayments("createCheckout", { period: period === "yearly" ? "yearly" : "monthly" });
  }

  async function verifyPayment(payload) {
    if (!paymentsConfigured()) {
      FK.ui.toast("Payments are not configured yet.", "error");
      return null;
    }
    return callPayments("verifyPayment", payload);
  }

  async function activateSubscription() {
    FK.ui.toast("Subscriptions activate only after the payment provider confirms payment.", "error");
    return null;
  }

  async function cancelSubscription() {
    if (!paymentsConfigured()) {
      FK.ui.toast("Payments are not configured yet.", "error");
      return null;
    }
    return callPayments("cancelSubscription", {});
  }

  async function openRazorpayCheckout(period) {
    const order = await createCheckout(period);
    if (!order) return;
    if (!window.Razorpay) {
      FK.ui.toast("Razorpay checkout script is not loaded.", "error");
      return;
    }
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "FreelanceKit",
      description: period === "yearly" ? "Pro yearly" : "Pro monthly",
      handler: async function (response) {
        try {
          const verified = await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            period: order.period,
          });
          if (verified && verified.ok) {
            FK.ui.toast("Pro plan activated.");
            location.href = "settings.html";
          }
        } catch (err) {
          FK.ui.toast(FK.ui.friendlyError(err, "Payment could not be verified."), "error");
        }
      },
    });
    rzp.on("payment.failed", function () {
      FK.ui.toast("Payment was not completed.", "error");
    });
    rzp.open();
  }

  FK.paymentsGateway = {
    paymentsConfigured,
    createCheckout,
    verifyPayment,
    activateSubscription,
    cancelSubscription,
    openRazorpayCheckout,
  };
})();
