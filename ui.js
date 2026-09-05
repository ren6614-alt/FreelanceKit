(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoney(amount, currency) {
    const cur = currency || (FK.profile && FK.profile.default_currency) || FK.config.defaultCurrency || "INR";
    const n = Number(amount || 0);
    try {
      return new Intl.NumberFormat(FK.config.defaultLocale || "en-IN", {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return cur + " " + n.toFixed(2);
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value + (String(value).length <= 10 ? "T00:00:00" : ""));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(FK.config.defaultLocale || "en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("fk-theme", next);
  }

  function initTheme() {
    const saved = localStorage.getItem("fk-theme");
    if (saved) applyTheme(saved);
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");
    else applyTheme("light");
  }

  function toast(message, type) {
    let host = $("#toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "toasts";
      host.className = "toasts";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " error" : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function closeModal() {
    const existing = $(".modal-backdrop");
    if (existing) existing.remove();
  }

  function modal(innerHtml, options) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal ${options && options.wide ? "wide" : ""}" role="dialog" aria-modal="true">${innerHtml}</div>`;
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    const first = backdrop.querySelector("input, button, select, textarea");
    if (first) first.focus();
    return backdrop;
  }

  function confirmDialog(message) {
    return new Promise((resolve) => {
      modal(`
        <h3>${escapeHtml(message)}</h3>
        <div class="toolbar" style="justify-content:flex-end">
          <button type="button" class="btn btn-ghost" data-no>Cancel</button>
          <button type="button" class="btn btn-danger" data-yes>Confirm</button>
        </div>
      `);
      $(".modal-backdrop [data-no]").onclick = () => { closeModal(); resolve(false); };
      $(".modal-backdrop [data-yes]").onclick = () => { closeModal(); resolve(true); };
    });
  }

  function showUpgrade(featureLabel) {
    toast("Upgrade required", "error");
    modal(`
      <div class="upgrade-modal">
        <span class="badge badge-pro">PRO FEATURE</span>
        <h2>Unlock ${escapeHtml(featureLabel || "this feature")}</h2>
        <p>Unlock advanced revenue analytics, recurring invoices, custom templates and unlimited usage.</p>
        <div class="hero-actions" style="justify-content:center">
          <a class="btn" href="pricing.html">Upgrade to Pro</a>
          <button type="button" class="btn btn-ghost" id="maybe-later">Maybe Later</button>
        </div>
      </div>
    `);
    $("#maybe-later").onclick = closeModal;
  }

  function friendlyError(err, fallback) {
    const msg = (err && err.message) || "";
    if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Network problem. Check your connection and try again.";
    if (/JWT|session|expired|not authenticated|Invalid login/i.test(msg)) return "Your session expired. Please sign in again.";
    if (/row-level security|permission|not authorized/i.test(msg)) return "You do not have access to that record.";
    if (/PAYMENTS_NOT_CONFIGURED/i.test(msg)) return "Payments are not configured yet.";
    return fallback || "Something went wrong. Please try again.";
  }

  const NAV = [
    { href: "dashboard.html", id: "dashboard", label: "Dashboard" },
    { href: "clients.html", id: "clients", label: "Clients" },
    { href: "invoices.html", id: "invoices", label: "Invoices" },
    { href: "quotations.html", id: "quotations", label: "Quotations" },
    { href: "payments.html", id: "payments", label: "Payments" },
    { href: "expenses.html", id: "expenses", label: "Expenses", pro: true },
    { href: "settings.html", id: "settings", label: "Settings" },
  ];

  function renderUsage(usage, plan) {
    if (!usage) return "";
    const inv = usage.invoices || { used: 0, limit: 5 };
    const qt = usage.quotations || { used: 0, limit: 5 };
    const cl = usage.clients || { used: 0, limit: 5 };
    if (plan === "pro") {
      return `<div class="usage-box"><strong>Pro plan</strong><p class="help">Unlimited clients, invoices and quotations.</p></div>`;
    }
    return `
      <div class="usage-box">
        <strong>Free plan</strong>
        <div class="usage-row"><span>Invoices</span><span>${inv.used} / ${inv.limit} used this month</span></div>
        <div class="meter"><span style="width:${Math.min(100, (inv.used / inv.limit) * 100)}%"></span></div>
        <div class="usage-row"><span>Quotations</span><span>${qt.used} / ${qt.limit} used this month</span></div>
        <div class="meter"><span style="width:${Math.min(100, (qt.used / qt.limit) * 100)}%"></span></div>
        <div class="usage-row"><span>Clients</span><span>${cl.used} / ${cl.limit} used</span></div>
        <div class="meter"><span style="width:${Math.min(100, (cl.used / cl.limit) * 100)}%"></span></div>
        <p><a href="pricing.html">Upgrade to Pro</a></p>
      </div>`;
  }

  function mountApp(options) {
    const active = options.active;
    const title = options.title || "FreelanceKit";
    const userLabel = (FK.profile && (FK.profile.business_name || FK.profile.full_name || FK.profile.email)) || "Account";
    const plan = FK.plan || "free";
    const nav = NAV.map((item) => {
      const pro = item.pro ? ` <span class="badge badge-pro">PRO</span>` : "";
      return `<a href="${item.href}" class="${item.id === active ? "active" : ""}">${escapeHtml(item.label)}${pro}</a>`;
    }).join("");

    const app = document.createElement("div");
    app.className = "app";
    app.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <a class="brand" href="dashboard.html"><img class="brand-mark" src="assets/favicon.svg" alt=""> FreelanceKit</a>
          <button class="btn btn-ghost btn-sm sidebar-close" type="button" id="close-nav">Close</button>
        </div>
        <nav class="side-nav">${nav}</nav>
        <div id="usage-slot"></div>
        <button class="btn btn-ghost" type="button" id="logout-btn">Log out</button>
      </aside>
      <div class="main">
        <div class="topbar">
          <div>
            <button class="btn btn-ghost btn-sm mobile-toggle" type="button" id="open-nav">Menu</button>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="help">${escapeHtml(userLabel)} · <span class="badge ${plan === "pro" ? "badge-pro" : "badge-free"}">${plan === "pro" ? "PRO" : "FREE"}</span></p>
          </div>
          <div class="toolbar">
            <button class="btn btn-ghost btn-sm" type="button" id="theme-toggle">Theme</button>
          </div>
        </div>
        <div id="app-content"></div>
      </div>
    `;
    document.body.prepend(app);
    const page = options.contentSelector ? $(options.contentSelector) : null;
    if (page) $("#app-content").appendChild(page);
    $("#usage-slot").innerHTML = renderUsage(FK.usage, plan);
    $("#logout-btn").onclick = () => FK.auth.logout();
    $("#theme-toggle").onclick = () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
    $("#open-nav").onclick = () => $("#sidebar").classList.add("open");
    $("#close-nav").onclick = () => $("#sidebar").classList.remove("open");
  }

  function publicHeader(active) {
    return `
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="public-header">
        <a class="brand" href="index.html"><img class="brand-mark" src="assets/favicon.svg" alt=""> FreelanceKit</a>
        <nav class="nav-links public">
          <a href="index.html#features">Features</a>
          <a href="pricing.html">Pricing</a>
          <a href="contact.html">Contact</a>
          <a href="login.html">Log in</a>
          <a class="btn btn-sm" href="signup.html">Start Free</a>
        </nav>
        <button class="btn btn-ghost btn-sm mobile-toggle menu-public" type="button" id="public-menu">Menu</button>
      </header>
    `;
  }

  function publicFooter() {
    return `
      <footer class="site-footer">
        <div class="footer-grid">
          <div>
            <strong>FreelanceKit</strong>
            <p>Run your freelance business without the paperwork.</p>
            <p>Invoicing software for freelancers — not financial or legal advice.</p>
          </div>
          <div>
            <strong>Product</strong>
            <p><a href="index.html">Home</a></p>
            <p><a href="pricing.html">Pricing</a></p>
            <p><a href="signup.html">Start free</a></p>
          </div>
          <div>
            <strong>Legal</strong>
            <p><a href="privacy.html">Privacy</a></p>
            <p><a href="terms.html">Terms</a></p>
            <p><a href="contact.html">Contact</a></p>
          </div>
          <div>
            <strong>Account</strong>
            <p><a href="login.html">Log in</a></p>
            <p><button class="linkish btn btn-ghost btn-sm" type="button" id="theme-toggle">Toggle theme</button></p>
          </div>
        </div>
      </footer>
    `;
  }

  function registerPwa() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  function optionalAnalytics(eventName, payload) {
    if (typeof FK.analytics === "function") {
      try { FK.analytics(eventName, payload || {}); } catch { /* integration optional */ }
    }
  }

  FK.ui = {
    $, $$, escapeHtml, formatMoney, formatDate, todayISO, applyTheme, initTheme,
    toast, modal, closeModal, confirmDialog, showUpgrade, friendlyError,
    mountApp, publicHeader, publicFooter, registerPwa, optionalAnalytics, renderUsage,
  };

  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "public-menu") {
      const links = document.querySelector(".nav-links.public");
      if (links) links.classList.toggle("open-mobile");
    }
  });
})();
