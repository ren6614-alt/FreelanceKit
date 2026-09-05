(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function monthRange(date) {
    const d = date || new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  function checkPlan() {
    const sub = FK.subscription;
    if (!sub) return "free";
    const periodOk = !sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
    const activePro = sub.plan === "pro" && (sub.status === "pro" || sub.status === "cancelled") && periodOk;
    return activePro ? "pro" : "free";
  }

  async function refreshPlan() {
    const { data, error } = await FK.auth.client().rpc("my_plan");
    if (!error && data) {
      FK.plan = data === "pro" ? "pro" : "free";
    } else {
      await FK.db.getSubscription();
      FK.plan = checkPlan();
    }
    if (!FK.subscription) await FK.db.getSubscription();
    return FK.plan;
  }

  async function getUsage() {
    const limits = FK.config.freeLimits;
    const clients = await FK.db.listClients();
    const invoices = await FK.db.listInvoices();
    const quotations = await FK.db.listQuotations();
    const { start, end } = monthRange();
    const invMonth = invoices.filter((inv) => inv.created_at && inv.created_at.slice(0, 10) >= start && inv.created_at.slice(0, 10) < end);
    const qtMonth = quotations.filter((q) => q.created_at && q.created_at.slice(0, 10) >= start && q.created_at.slice(0, 10) < end);
    const usage = {
      clients: { used: clients.length, limit: limits.clients },
      invoices: { used: invMonth.length, limit: limits.invoicesPerMonth },
      quotations: { used: qtMonth.length, limit: limits.quotationsPerMonth },
    };
    FK.usage = usage;
    FK._cache = { clients, invoices, quotations };
    return usage;
  }

  function checkLimit(kind) {
    const plan = FK.plan || "free";
    if (plan === "pro") return { ok: true, remaining: Infinity };
    const usage = FK.usage || {};
    const row = usage[kind];
    if (!row) return { ok: true };
    return { ok: row.used < row.limit, used: row.used, limit: row.limit, remaining: Math.max(0, row.limit - row.used) };
  }

  function canAddClient() {
    return checkLimit("clients").ok;
  }

  function canCreateInvoice() {
    return checkLimit("invoices").ok;
  }

  function canCreateQuotation() {
    return checkLimit("quotations").ok;
  }

  function requirePro(featureLabel) {
    if ((FK.plan || "free") === "pro") return true;
    FK.ui.showUpgrade(featureLabel || "Pro features");
    return false;
  }

  function limitMessage(kind) {
    if (kind === "invoices") return "You've reached your Free plan limit. Upgrade to Pro for unlimited invoices.";
    if (kind === "quotations") return "You've reached your Free plan limit. Upgrade to Pro for unlimited quotations.";
    return "You've reached your Free plan limit. Upgrade to Pro for unlimited clients.";
  }

  FK.subscriptionApi = {
    checkPlan,
    refreshPlan,
    getUsage,
    checkLimit,
    canAddClient,
    canCreateInvoice,
    canCreateQuotation,
    requirePro,
    limitMessage,
    monthRange,
  };
  FK.checkPlan = checkPlan;
  FK.checkLimit = checkLimit;
  FK.getUsage = getUsage;
  FK.canCreateInvoice = canCreateInvoice;
  FK.canCreateQuotation = canCreateQuotation;
  FK.canAddClient = canAddClient;
  FK.requirePro = requirePro;
})();
