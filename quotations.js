(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function deriveQuotationStatus(quotation, today) {
    if (quotation.status === "accepted" || quotation.status === "rejected") return quotation.status;
    if (quotation.expiry_date && quotation.expiry_date < today && quotation.status !== "draft") return "expired";
    return quotation.status;
  }

  async function persistExpired(quotations) {
    const today = FK.ui.todayISO();
    for (const q of quotations) {
      const next = deriveQuotationStatus(q, today);
      if (next !== q.status) {
        try {
          await FK.auth.client().from("quotations").update({ status: next }).eq("id", q.id).eq("user_id", FK.user.id);
          q.status = next;
        } catch {
          /* non-blocking */
        }
      }
    }
  }

  async function convertToInvoice(quotationId) {
    const q = await FK.db.getQuotation(quotationId);
    if (!FK.subscriptionApi.canCreateInvoice()) {
      FK.ui.toast(FK.subscriptionApi.limitMessage("invoices"), "error");
      FK.ui.showUpgrade("unlimited invoices");
      return null;
    }
    const num = await FK.db.nextDocumentNumber("invoice");
    const items = (q.quotation_items || []).sort((a, b) => a.sort_order - b.sort_order).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      tax_rate: item.tax_rate,
      amount: item.amount,
    }));
    const calc = FK.invoices.totals(items, q.discount, q.tax_rate);
    const invoice = await FK.db.saveInvoice(
      {
        client_id: q.client_id,
        number: num.number,
        issue_date: FK.ui.todayISO(),
        due_date: FK.ui.todayISO(),
        status: "draft",
        currency: q.currency,
        notes: q.notes,
        terms: (FK.profile && FK.profile.default_terms) || "",
        discount: calc.discount,
        tax_rate: q.tax_rate,
        subtotal: calc.subtotal,
        tax_total: calc.taxTotal,
        total: calc.total,
        amount_paid: 0,
        template: q.template || "basic",
        quotation_id: q.id,
      },
      calc.lines
    );
    await FK.db.bumpNumber("invoice", num.next);
    await FK.db.saveQuotation(
      {
        id: q.id,
        client_id: q.client_id,
        number: q.number,
        issue_date: q.issue_date,
        expiry_date: q.expiry_date,
        status: "accepted",
        currency: q.currency,
        notes: q.notes,
        discount: q.discount,
        tax_rate: q.tax_rate,
        subtotal: q.subtotal,
        tax_total: q.tax_total,
        total: q.total,
        converted_invoice_id: invoice.id,
        template: q.template,
      },
      items
    );
    return invoice;
  }

  FK.quotations = { deriveQuotationStatus, persistExpired, convertToInvoice };
})();
