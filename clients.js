(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function validateClient(fields) {
    const name = String(fields.name || "").trim();
    if (!name) return "Client name is required.";
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return "Enter a valid email.";
    return "";
  }

  FK.clients = { validateClient };
})();
