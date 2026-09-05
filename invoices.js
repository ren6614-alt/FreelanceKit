(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function lineAmount(item) {
    return round2((Number(item.quantity) || 0) * (Number(item.rate) || 0));
  }

  function totals(items, discount, invoiceTaxRate) {
    const lines = (items || []).map((item) => {
      const amount = lineAmount(item);
      const tax = round2(amount * (Number(item.tax_rate != null ? item.tax_rate : invoiceTaxRate) || 0) / 100);
      return { ...item, amount, tax };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
    const disc = round2(Math.min(Number(discount) || 0, subtotal));
    const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
    const total = round2(Math.max(subtotal - disc + taxTotal, 0));
    return { lines, subtotal, discount: disc, taxTotal, total };
  }

  function deriveInvoiceStatus(invoice, amountPaid, today) {
    const paid = round2(amountPaid || 0);
    const total = round2(invoice.total || 0);
    if (invoice.status === "draft") return "draft";
    if (total > 0 && paid >= total) return "paid";
    if (paid > 0 && paid < total) {
      if (invoice.due_date && invoice.due_date < today) return "overdue";
      return "partially_paid";
    }
    if (invoice.due_date && invoice.due_date < today && paid < total) return "overdue";
    return invoice.status === "sent" ? "sent" : invoice.status || "sent";
  }

  async function syncInvoicePaymentState(invoiceId) {
    const invoice = await FK.db.getInvoice(invoiceId);
    const pays = await FK.db.paymentsForInvoice(invoiceId);
    const amountPaid = round2(pays.reduce((s, p) => s + Number(p.amount || 0), 0));
    const status = deriveInvoiceStatus({ ...invoice, total: invoice.total }, amountPaid, FK.ui.todayISO());
    await FK.db.saveInvoice(
      {
        id: invoice.id,
        client_id: invoice.client_id,
        number: invoice.number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        status,
        currency: invoice.currency,
        notes: invoice.notes,
        terms: invoice.terms,
        discount: invoice.discount,
        tax_rate: invoice.tax_rate,
        subtotal: invoice.subtotal,
        tax_total: invoice.tax_total,
        total: invoice.total,
        amount_paid: amountPaid,
        template: invoice.template,
        quotation_id: invoice.quotation_id,
        recurring_schedule_id: invoice.recurring_schedule_id,
      },
      (invoice.invoice_items || []).sort((a, b) => a.sort_order - b.sort_order)
    );
    return { amountPaid, status };
  }

  function refreshOverdue(invoices) {
    const today = FK.ui.todayISO();
    return invoices.map((inv) => {
      if (inv.status === "draft" || inv.status === "paid") return inv;
      if (inv.due_date && inv.due_date < today && Number(inv.amount_paid || 0) < Number(inv.total || 0)) {
        return { ...inv, status: "overdue" };
      }
      return inv;
    });
  }

  async function persistOverdue(invoices) {
    const today = FK.ui.todayISO();
    for (const inv of invoices) {
      if (inv.status === "draft" || inv.status === "paid") continue;
      if (inv.due_date && inv.due_date < today && Number(inv.amount_paid || 0) < Number(inv.total || 0) && inv.status !== "overdue") {
        try {
          await FK.auth.client().from("invoices").update({ status: "overdue" }).eq("id", inv.id).eq("user_id", FK.user.id);
          inv.status = "overdue";
        } catch {
          /* non-blocking */
        }
      }
    }
  }

  FK.invoices = {
    round2,
    lineAmount,
    totals,
    deriveInvoiceStatus,
    syncInvoicePaymentState,
    refreshOverdue,
    persistOverdue,
  };
})();
