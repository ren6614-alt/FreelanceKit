(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});
  const ui = () => FK.ui;

  function money(n, currency) {
    return ui().formatMoney(n, currency);
  }

  function buildDocumentInner(kind, doc, profile, logoUrl) {
    const items = (kind === "invoice" ? doc.invoice_items : doc.quotation_items) || [];
    const client = doc.clients || {};
    const accent = (FK.plan === "pro" && profile.accent_color) || "#1F5C4D";
    const template = FK.plan === "pro" ? (doc.template || profile.invoice_template || "basic") : "basic";
    const business = profile.business_name || profile.full_name || "Freelancer";
    const rows = items
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(
        (item) => `<tr>
          <td>${ui().escapeHtml(item.description)}</td>
          <td>${ui().escapeHtml(item.quantity)}</td>
          <td>${money(item.rate, doc.currency)}</td>
          <td>${money(item.amount, doc.currency)}</td>
        </tr>`
      )
      .join("");
    const logo = logoUrl && (FK.plan === "pro" || kind)
      ? `<img src="${logoUrl}" alt="" style="max-height:56px;max-width:160px">`
      : "";
    const showLogo = FK.plan === "pro" && logoUrl;
    const footer = (FK.plan === "pro" && profile.invoice_footer) || profile.invoice_footer || "Thank you for your business.";
    const styles = `
        .fk-doc{font-family:Georgia,serif;color:#1c1917;margin:0;padding:8px;background:#fff}
        .fk-doc .top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid ${accent};padding-bottom:16px}
        .fk-doc h1{margin:0 0 4px;font-size:28px}
        .fk-doc table{width:100%;border-collapse:collapse;margin-top:24px}
        .fk-doc th{text-align:left;border-bottom:1px solid #ddd;padding:8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666}
        .fk-doc td{padding:8px;border-bottom:1px solid #eee}
        .fk-doc .muted{color:#666;font-size:13px;line-height:1.5}
        .fk-doc .totals{margin-left:auto;width:260px;margin-top:16px}
        .fk-doc .totals div{display:flex;justify-content:space-between;padding:4px 0}
        .fk-doc .grand{font-weight:700;border-top:2px solid ${accent};margin-top:8px;padding-top:8px}
        .fk-doc footer{margin-top:40px;font-size:12px;color:#666;border-top:1px solid #eee;padding-top:12px}
        .fk-doc.classic .top{border:0;background:${accent};color:#fff;padding:20px;border-radius:8px}
        .fk-doc.classic .top .muted{color:#f3eee6}
        .fk-doc.modern .top{border-bottom:0;align-items:flex-end}
        .fk-doc.minimal h1{font-weight:400;letter-spacing:.2em;text-transform:uppercase;font-size:18px}
    `;
    return `<style>${styles}</style><div class="fk-doc ${ui().escapeHtml(template)}">
      <div class="top">
        <div>${showLogo ? logo : ""}<h1>${ui().escapeHtml(business)}</h1>
          <div class="muted">${ui().escapeHtml(profile.address || "")}<br>
          ${ui().escapeHtml(profile.email || "")} ${profile.phone ? "· " + ui().escapeHtml(profile.phone) : ""}<br>
          ${profile.website ? ui().escapeHtml(profile.website) : ""}
          ${profile.tax_id ? "<br>Tax/GST: " + ui().escapeHtml(profile.tax_id) : ""}</div>
        </div>
        <div>
          <h1>${kind === "invoice" ? "INVOICE" : "QUOTATION"}</h1>
          <div class="muted">No. ${ui().escapeHtml(doc.number)}<br>
          Date ${ui().escapeHtml(ui().formatDate(doc.issue_date))}<br>
          ${kind === "invoice" ? "Due " + ui().escapeHtml(ui().formatDate(doc.due_date)) : "Valid until " + ui().escapeHtml(ui().formatDate(doc.expiry_date))}</div>
        </div>
      </div>
      <p><strong>Bill to</strong><br>${ui().escapeHtml(client.name || "")}
      ${client.company ? "<br>" + ui().escapeHtml(client.company) : ""}
      ${client.address ? "<br>" + ui().escapeHtml(client.address) : ""}
      ${client.email ? "<br>" + ui().escapeHtml(client.email) : ""}
      ${client.tax_id ? "<br>Tax/GST: " + ui().escapeHtml(client.tax_id) : ""}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="totals">
        <div><span>Subtotal</span><span>${money(doc.subtotal, doc.currency)}</span></div>
        <div><span>Discount</span><span>${money(doc.discount, doc.currency)}</span></div>
        <div><span>Tax</span><span>${money(doc.tax_total, doc.currency)}</span></div>
        <div class="grand"><span>Total</span><span>${money(doc.total, doc.currency)}</span></div>
        ${kind === "invoice" ? `<div><span>Amount paid</span><span>${money(doc.amount_paid, doc.currency)}</span></div>
        <div><span>Amount due</span><span>${money(Math.max((doc.total || 0) - (doc.amount_paid || 0), 0), doc.currency)}</span></div>` : ""}
      </div>
      ${doc.notes ? `<p><strong>Notes</strong><br>${ui().escapeHtml(doc.notes)}</p>` : ""}
      ${kind === "invoice" && doc.terms ? `<p><strong>Payment terms</strong><br>${ui().escapeHtml(doc.terms)}</p>` : ""}
      <p class="muted">Payment records in FreelanceKit are tracking entries unless a payment gateway is connected.</p>
      <footer>${ui().escapeHtml(footer)}</footer>
      </div>`;
  }

  function buildDocumentHtml(kind, doc, profile, logoUrl) {
    const inner = buildDocumentInner(kind, doc, profile, logoUrl);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${ui().escapeHtml(kind)} ${ui().escapeHtml(doc.number)}</title></head><body>${inner}</body></html>`;
  }

  function openPrint(html) {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    const run = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (err) {
        FK.ui.toast("PDF generation failed. Try again or use your browser print dialog.", "error");
      }
      setTimeout(() => frame.remove(), 1000);
    };
    setTimeout(run, 400);
  }

  async function downloadPdf(kind, doc) {
    try {
      const profile = FK.profile || {};
      const logo = profile.logo_path ? await FK.db.logoUrl(profile.logo_path) : "";
      const html = buildDocumentHtml(kind, doc, profile, FK.plan === "pro" ? logo : "");
      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        const items = (kind === "invoice" ? doc.invoice_items : doc.quotation_items) || [];
        const client = doc.clients || {};
        let y = 48;
        pdf.setFont("times", "bold");
        pdf.setFontSize(18);
        pdf.text(String(profile.business_name || profile.full_name || "Freelancer"), 40, y);
        pdf.setFont("times", "normal");
        pdf.setFontSize(11);
        pdf.text((kind === "invoice" ? "INVOICE " : "QUOTATION ") + doc.number, 400, y, { align: "right" });
        y += 18;
        pdf.setFontSize(10);
        const leftMeta = [profile.address, profile.email, profile.phone, profile.website, profile.tax_id ? "Tax/GST: " + profile.tax_id : ""]
          .filter(Boolean);
        leftMeta.forEach((line) => { pdf.text(String(line), 40, y); y += 14; });
        y += 8;
        pdf.setFont("times", "bold");
        pdf.text("Bill to", 40, y);
        pdf.setFont("times", "normal");
        y += 14;
        [client.name, client.company, client.address, client.email].filter(Boolean).forEach((line) => {
          pdf.text(String(line), 40, y); y += 14;
        });
        y += 10;
        pdf.setFont("times", "bold");
        pdf.text("Item", 40, y);
        pdf.text("Qty", 300, y);
        pdf.text("Rate", 360, y);
        pdf.text("Amount", 500, y, { align: "right" });
        pdf.setFont("times", "normal");
        y += 16;
        items.forEach((item) => {
          if (y > 720) { pdf.addPage(); y = 48; }
          pdf.text(String(item.description || "").slice(0, 60), 40, y);
          pdf.text(String(item.quantity), 300, y);
          pdf.text(String(item.rate), 360, y);
          pdf.text(String(item.amount), 500, y, { align: "right" });
          y += 16;
        });
        y += 12;
        pdf.text("Subtotal " + money(doc.subtotal, doc.currency), 500, y, { align: "right" }); y += 14;
        pdf.text("Discount " + money(doc.discount, doc.currency), 500, y, { align: "right" }); y += 14;
        pdf.text("Tax " + money(doc.tax_total, doc.currency), 500, y, { align: "right" }); y += 14;
        pdf.setFont("times", "bold");
        pdf.text("Total " + money(doc.total, doc.currency), 500, y, { align: "right" });
        if (kind === "invoice") {
          y += 14;
          pdf.setFont("times", "normal");
          pdf.text("Amount paid " + money(doc.amount_paid, doc.currency), 500, y, { align: "right" });
          y += 14;
          pdf.text("Amount due " + money(Math.max((doc.total || 0) - (doc.amount_paid || 0), 0), doc.currency), 500, y, { align: "right" });
        }
        if (doc.notes) { y += 28; pdf.text("Notes: " + String(doc.notes).slice(0, 400), 40, y, { maxWidth: 500 }); }
        y += 36;
        pdf.setFontSize(9);
        pdf.text(String(profile.invoice_footer || "Thank you for your business."), 40, y);
        pdf.save((kind === "invoice" ? "invoice-" : "quotation-") + doc.number + ".pdf");
        return;
      }
      openPrint(html);
    } catch (err) {
      FK.ui.toast(FK.ui.friendlyError(err, "PDF generation failed."), "error");
    }
  }

  async function reportPdf(title, lines) {
    try {
      if (!(window.jspdf && window.jspdf.jsPDF)) {
        const html = `<html><body><h1>${FK.ui.escapeHtml(title)}</h1><pre>${FK.ui.escapeHtml(lines.join("\n"))}</pre></body></html>`;
        openPrint(html);
        return;
      }
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.setFont("times", "bold");
      pdf.setFontSize(16);
      pdf.text(title, 40, 48);
      pdf.setFont("times", "normal");
      pdf.setFontSize(11);
      let y = 72;
      lines.forEach((line) => {
        if (y > 760) { pdf.addPage(); y = 48; }
        pdf.text(String(line), 40, y, { maxWidth: 520 });
        y += 16;
      });
      pdf.save("report.pdf");
    } catch {
      FK.ui.toast("PDF generation failed.", "error");
    }
  }

  FK.pdf = { buildDocumentHtml, buildDocumentInner, downloadPdf, reportPdf, openPrint };
})();
