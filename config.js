/**
 * FreelanceKit public configuration.
 *
 * Fill supabaseUrl and supabaseAnonKey from your Supabase project
 * (Settings → API). These values are safe to ship in the browser.
 *
 * Never put the service_role key or Razorpay secret here.
 *
 * Optional: copy this file to config.local.js (gitignored) to override
 * values without editing the committed file.
 */
window.FreelanceKit = window.FreelanceKit || {};

window.FreelanceKit.config = {
  siteName: "FreelanceKit",
  tagline: "Run your freelance business without the paperwork.",
  supportEmail: "hello@example.com",

  supabaseUrl: "",
  supabaseAnonKey: "",

  /** Razorpay Key ID only (rzp_test_… / rzp_live_…). Never the secret. */
  razorpayKeyId: "",

  /**
   * Supabase Edge Function that verifies Razorpay signatures and
   * updates subscriptions with the service role. Leave empty until deployed.
   */
  paymentsFunctionUrl: "",

  defaultCurrency: "INR",
  defaultLocale: "en-IN",

  freeLimits: {
    clients: 5,
    invoicesPerMonth: 5,
    quotationsPerMonth: 5,
  },

  /** Display only. Server-side verification must use the same amounts. */
  pricing: {
    currency: "INR",
    proMonthly: { amount: 39900, label: "₹399", period: "month" },
    proYearly: { amount: 399900, label: "₹3,999", period: "year", savingsLabel: "Save ₹791" },
  },

  invoiceTemplates: ["basic", "classic", "modern", "minimal"],
  currencies: ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED"],
};
