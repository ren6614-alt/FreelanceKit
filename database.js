(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function sb() {
    return FK.auth.client();
  }

  function userId() {
    return FK.user && FK.user.id;
  }

  function throwClean(error, fallback) {
    console.error(error);
    const raw = String((error && error.message) || "");
    const useRaw = /limit reached|Pro plan required|duplicate key|already exists|unique constraint|Client not found/i.test(raw);
    const err = new Error(useRaw ? raw : fallback);
    err.cause = error;
    throw err;
  }

  async function getProfile() {
    const { data, error } = await sb().from("profiles").select("*").eq("id", userId()).maybeSingle();
    if (error) throwClean(error, "Could not load profile.");
    FK.profile = data;
    return data;
  }

  async function upsertProfile(fields) {
    const payload = { ...fields, id: userId(), updated_at: new Date().toISOString() };
    const { data, error } = await sb().from("profiles").upsert(payload).select().single();
    if (error) throwClean(error, "Could not save profile.");
    FK.profile = data;
    return data;
  }

  async function getSubscription() {
    const { data, error } = await sb().from("subscriptions").select("*").eq("user_id", userId()).maybeSingle();
    if (error) throwClean(error, "Could not load subscription.");
    FK.subscription = data;
    return data;
  }

  async function listClients() {
    const { data, error } = await sb().from("clients").select("*").eq("user_id", userId()).order("name");
    if (error) throwClean(error, "Could not load clients.");
    return data || [];
  }

  async function saveClient(record) {
    const payload = { ...record, user_id: userId() };
    if (!payload.id) delete payload.id;
    const q = payload.id
      ? sb().from("clients").update(payload).eq("id", payload.id).eq("user_id", userId())
      : sb().from("clients").insert(payload);
    const { data, error } = await q.select().single();
    if (error) throwClean(error, "Could not save client.");
    return data;
  }

  async function deleteClient(id) {
    const { error } = await sb().from("clients").delete().eq("id", id).eq("user_id", userId());
    if (error) throwClean(error, "Could not delete client. Remove related invoices first.");
  }

  async function listInvoices() {
    const { data, error } = await sb()
      .from("invoices")
      .select("*, clients(name, company, email), invoice_items(*)")
      .eq("user_id", userId())
      .order("issue_date", { ascending: false });
    if (error) throwClean(error, "Could not load invoices.");
    return data || [];
  }

  async function getInvoice(id) {
    const { data, error } = await sb()
      .from("invoices")
      .select("*, clients(*), invoice_items(*)")
      .eq("id", id)
      .eq("user_id", userId())
      .single();
    if (error) throwClean(error, "Invoice not found.");
    return data;
  }

  async function saveInvoice(invoice, items) {
    const payload = { ...invoice, user_id: userId() };
    if (!payload.id) delete payload.id;
    let saved;
    if (payload.id) {
      const { data, error } = await sb().from("invoices").update(payload).eq("id", payload.id).eq("user_id", userId()).select().single();
      if (error) throwClean(error, "Could not update invoice.");
      saved = data;
      const { error: delErr } = await sb().from("invoice_items").delete().eq("invoice_id", saved.id).eq("user_id", userId());
      if (delErr) throwClean(delErr, "Could not update invoice items.");
    } else {
      const { data, error } = await sb().from("invoices").insert(payload).select().single();
      if (error) throwClean(error, "Could not create invoice.");
      saved = data;
    }
    if (items && items.length) {
      const rows = items.map((item, i) => ({
        user_id: userId(),
        invoice_id: saved.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        tax_rate: item.tax_rate || 0,
        amount: item.amount,
        sort_order: i,
      }));
      const { error } = await sb().from("invoice_items").insert(rows);
      if (error) throwClean(error, "Could not save invoice items.");
    }
    return saved;
  }

  async function deleteInvoice(id) {
    const { error } = await sb().from("invoices").delete().eq("id", id).eq("user_id", userId());
    if (error) throwClean(error, "Could not delete invoice.");
  }

  async function listQuotations() {
    const { data, error } = await sb()
      .from("quotations")
      .select("*, clients(name, company, email), quotation_items(*)")
      .eq("user_id", userId())
      .order("issue_date", { ascending: false });
    if (error) throwClean(error, "Could not load quotations.");
    return data || [];
  }

  async function getQuotation(id) {
    const { data, error } = await sb()
      .from("quotations")
      .select("*, clients(*), quotation_items(*)")
      .eq("id", id)
      .eq("user_id", userId())
      .single();
    if (error) throwClean(error, "Quotation not found.");
    return data;
  }

  async function saveQuotation(quotation, items) {
    const payload = { ...quotation, user_id: userId() };
    if (!payload.id) delete payload.id;
    let saved;
    if (payload.id) {
      const { data, error } = await sb().from("quotations").update(payload).eq("id", payload.id).eq("user_id", userId()).select().single();
      if (error) throwClean(error, "Could not update quotation.");
      saved = data;
      await sb().from("quotation_items").delete().eq("quotation_id", saved.id).eq("user_id", userId());
    } else {
      const { data, error } = await sb().from("quotations").insert(payload).select().single();
      if (error) throwClean(error, "Could not create quotation.");
      saved = data;
    }
    if (items && items.length) {
      const rows = items.map((item, i) => ({
        user_id: userId(),
        quotation_id: saved.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        tax_rate: item.tax_rate || 0,
        amount: item.amount,
        sort_order: i,
      }));
      const { error } = await sb().from("quotation_items").insert(rows);
      if (error) throwClean(error, "Could not save quotation items.");
    }
    return saved;
  }

  async function deleteQuotation(id) {
    const { error } = await sb().from("quotations").delete().eq("id", id).eq("user_id", userId());
    if (error) throwClean(error, "Could not delete quotation.");
  }

  async function listPayments() {
    const { data, error } = await sb()
      .from("payments")
      .select("*, invoices(number, total, status)")
      .eq("user_id", userId())
      .order("paid_at", { ascending: false });
    if (error) throwClean(error, "Could not load payments.");
    return data || [];
  }

  async function savePayment(record) {
    const payload = { ...record, user_id: userId(), source: "manual" };
    const { data, error } = await sb().from("payments").insert(payload).select().single();
    if (error) throwClean(error, "Could not record payment.");
    return data;
  }

  async function deletePayment(id) {
    const { error } = await sb().from("payments").delete().eq("id", id).eq("user_id", userId());
    if (error) throwClean(error, "Could not delete payment.");
  }

  async function paymentsForInvoice(invoiceId) {
    const { data, error } = await sb().from("payments").select("*").eq("invoice_id", invoiceId).eq("user_id", userId());
    if (error) throwClean(error, "Could not load payments.");
    return data || [];
  }

  async function listExpenses() {
    const { data, error } = await sb().from("expenses").select("*").eq("user_id", userId()).order("incurred_on", { ascending: false });
    if (error) throwClean(error, "Could not load expenses.");
    return data || [];
  }

  async function saveExpense(record) {
    const payload = { ...record, user_id: userId() };
    if (!payload.id) delete payload.id;
    const q = payload.id
      ? sb().from("expenses").update(payload).eq("id", payload.id).eq("user_id", userId())
      : sb().from("expenses").insert(payload);
    const { data, error } = await q.select().single();
    if (error) throwClean(error, "Could not save expense.");
    return data;
  }

  async function deleteExpense(id) {
    const { error } = await sb().from("expenses").delete().eq("id", id).eq("user_id", userId());
    if (error) throwClean(error, "Could not delete expense.");
  }

  async function listRecurring() {
    const { data, error } = await sb()
      .from("recurring_schedules")
      .select("*, clients(name)")
      .eq("user_id", userId())
      .order("next_run_date");
    if (error) throwClean(error, "Could not load recurring invoices.");
    return data || [];
  }

  async function saveRecurring(record) {
    const payload = { ...record, user_id: userId() };
    if (!payload.id) delete payload.id;
    const q = payload.id
      ? sb().from("recurring_schedules").update(payload).eq("id", payload.id).eq("user_id", userId())
      : sb().from("recurring_schedules").insert(payload);
    const { data, error } = await q.select().single();
    if (error) throwClean(error, "Could not save recurring invoice.");
    return data;
  }

  async function generateDueRecurring() {
    const { data, error } = await sb().rpc("generate_my_due_recurring_invoices");
    if (error) throwClean(error, "Could not generate recurring invoices.");
    return data || [];
  }

  async function nextDocumentNumber(kind) {
    const profile = FK.profile || (await getProfile());
    if (kind === "quotation") {
      const n = profile.next_quotation_number || 1;
      return { number: `${profile.quotation_prefix || "QT"}-${String(n).padStart(4, "0")}`, next: n + 1 };
    }
    const n = profile.next_invoice_number || 1;
    return { number: `${profile.invoice_prefix || "INV"}-${String(n).padStart(4, "0")}`, next: n + 1 };
  }

  async function bumpNumber(kind, next) {
    const field = kind === "quotation" ? "next_quotation_number" : "next_invoice_number";
    await upsertProfile({ [field]: next });
  }

  async function uploadLogo(file) {
    const path = `${userId()}/logo-${Date.now()}-${file.name.replace(/[^\w.-]+/g, "")}`;
    const { error } = await sb().storage.from("logos").upload(path, file, { upsert: true });
    if (error) throwClean(error, "Could not upload logo.");
    await upsertProfile({ logo_path: path });
    return path;
  }

  async function logoUrl(path) {
    if (!path) return "";
    const { data, error } = await sb().storage.from("logos").createSignedUrl(path, 3600);
    if (error) return "";
    return data.signedUrl;
  }

  async function deleteAccount() {
    const { error } = await sb().rpc("delete_own_account");
    if (error) throwClean(error, "Could not delete account.");
  }

  FK.db = {
    getProfile,
    upsertProfile,
    getSubscription,
    listClients,
    saveClient,
    deleteClient,
    listInvoices,
    getInvoice,
    saveInvoice,
    deleteInvoice,
    listQuotations,
    getQuotation,
    saveQuotation,
    deleteQuotation,
    listPayments,
    savePayment,
    deletePayment,
    paymentsForInvoice,
    listExpenses,
    saveExpense,
    deleteExpense,
    listRecurring,
    saveRecurring,
    generateDueRecurring,
    nextDocumentNumber,
    bumpNumber,
    uploadLogo,
    logoUrl,
    deleteAccount,
  };
})();
