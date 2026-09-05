(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  async function bootPrivate(page) {
    FK.ui.initTheme();
    await FK.auth.requireSession();
    await FK.db.getProfile();
    if (!FK.profile) {
      await FK.db.upsertProfile({
        email: FK.user.email,
        full_name: (FK.user.user_metadata && FK.user.user_metadata.full_name) || "",
      });
    }
    await FK.subscriptionApi.refreshPlan();
    await FK.subscriptionApi.getUsage();
    FK.ui.mountApp({ active: page.active, title: page.title });
    if (page.render) await page.render();
  }

  function statusBadge(status) {
    const map = {
      paid: "badge-status",
      accepted: "badge-status",
      sent: "badge-free",
      draft: "badge-free",
      overdue: "badge-danger",
      expired: "badge-danger",
      rejected: "badge-warn",
      partially_paid: "badge-warn",
      cancelled: "badge-warn",
      past_due: "badge-danger",
      pro: "badge-pro",
      free: "badge-free",
    };
    return `<span class="badge ${map[status] || "badge-free"}">${FK.ui.escapeHtml(status || "")}</span>`;
  }

  function itemEditor(items) {
    const rows = (items && items.length ? items : [{ description: "", quantity: 1, rate: 0, tax_rate: 0 }])
      .map(
        (item, i) => `<tr>
          <td><input data-k="description" data-i="${i}" value="${FK.ui.escapeHtml(item.description || "")}"></td>
          <td><input data-k="quantity" data-i="${i}" type="number" min="0" step="0.01" value="${FK.ui.escapeHtml(item.quantity ?? 1)}"></td>
          <td><input data-k="rate" data-i="${i}" type="number" min="0" step="0.01" value="${FK.ui.escapeHtml(item.rate ?? 0)}"></td>
          <td><input data-k="tax_rate" data-i="${i}" type="number" min="0" step="0.01" value="${FK.ui.escapeHtml(item.tax_rate ?? 0)}"></td>
          <td class="line-amt" data-i="${i}"></td>
        </tr>`
      )
      .join("");
    return `<div class="table-wrap"><table class="data items-table" id="items-table">
      <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Tax %</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-item">Add item</button>
      <div class="totals" id="live-totals"></div>`;
  }

  function collectItems() {
    const map = {};
    document.querySelectorAll("#items-table input").forEach((input) => {
      const i = input.getAttribute("data-i");
      map[i] = map[i] || {};
      map[i][input.getAttribute("data-k")] = input.value;
    });
    return Object.keys(map)
      .sort((a, b) => a - b)
      .map((k) => ({
        description: String(map[k].description || "").trim() || "Item",
        quantity: Number(map[k].quantity || 0),
        rate: Number(map[k].rate || 0),
        tax_rate: Number(map[k].tax_rate || 0),
      }));
  }

  function bindItemCalc(discountSel, taxSel, currency) {
    const paint = () => {
      const calc = FK.invoices.totals(collectItems(), Number($(discountSel)) || 0, Number($(taxSel)) || 0);
      document.querySelectorAll(".line-amt").forEach((cell) => {
        const i = Number(cell.getAttribute("data-i"));
        const line = calc.lines[i];
        cell.textContent = line ? FK.ui.formatMoney(line.amount, currency) : "";
      });
      const box = document.getElementById("live-totals");
      if (box) {
        box.innerHTML = `
          <div><span>Subtotal</span><span>${FK.ui.formatMoney(calc.subtotal, currency)}</span></div>
          <div><span>Discount</span><span>${FK.ui.formatMoney(calc.discount, currency)}</span></div>
          <div><span>Tax</span><span>${FK.ui.formatMoney(calc.taxTotal, currency)}</span></div>
          <div><strong>Grand total</strong><strong>${FK.ui.formatMoney(calc.total, currency)}</strong></div>`;
      }
    };
    document.getElementById("items-table").addEventListener("input", paint);
    const disc = document.querySelector(discountSel);
    const tax = document.querySelector(taxSel);
    if (disc) disc.addEventListener("input", paint);
    if (tax) tax.addEventListener("input", paint);
    document.getElementById("add-item").onclick = () => {
      const tb = document.querySelector("#items-table tbody");
      const i = tb.querySelectorAll("tr").length;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><input data-k="description" data-i="${i}"></td>
        <td><input data-k="quantity" data-i="${i}" type="number" min="0" step="0.01" value="1"></td>
        <td><input data-k="rate" data-i="${i}" type="number" min="0" step="0.01" value="0"></td>
        <td><input data-k="tax_rate" data-i="${i}" type="number" min="0" step="0.01" value="0"></td>
        <td class="line-amt" data-i="${i}"></td>`;
      tb.appendChild(tr);
      paint();
    };
    paint();
  }

  function $(sel) {
    const el = document.querySelector(sel);
    return el ? el.value : "";
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    FK.ui.toast("Export completed");
  }

  FK.app = { bootPrivate, statusBadge, itemEditor, collectItems, bindItemCalc, csvEscape, downloadText };
})();
