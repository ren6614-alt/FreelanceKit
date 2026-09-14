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

  supabaseUrl: "https://fhyzkfurutrfqdrhpzbg.supabase.co",
supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoeXprZnVydXRydmRyaHB6Ymd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1NjY2NzksImV4cCI6MjA0MTE0MjY3OX0.f-KzK-UJh0JfPv4wEi8c_t_Y_z9wj9XzMxNhGc0WqY",

  /** Razorpay Key ID only (rzp_test_… / rzp_live_…). Never the secret. */
  razorpayKeyId: "rzp_test_1234567890",

  /**
   * Supabase Edge Function that verifies Razorpay signatures and
   * updates subscriptions with the service role. Leave empty until deployed.
   */
  paymentsFunctionUrl: "https://fhyzkfurutrfqdrhpzbg.supabase.co/functions/v1/payments",

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
