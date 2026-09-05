(function () {
  const FK = (window.FreelanceKit = window.FreelanceKit || {});

  function isConfigured() {
    const c = FK.config || {};
    return Boolean(c.supabaseUrl && c.supabaseAnonKey);
  }

  function client() {
    if (!isConfigured()) return null;
    if (FK._supabase) return FK._supabase;
    if (!window.supabase) throw new Error("Supabase library failed to load.");
    FK._supabase = window.supabase.createClient(FK.config.supabaseUrl, FK.config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return FK._supabase;
  }

  async function getSession() {
    const sb = client();
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function requireSession() {
    if (!isConfigured()) {
      document.body.innerHTML = `<main class="legal"><h1>Setup required</h1><p>Add your Supabase URL and anon key in <code>config.js</code> (or <code>config.local.js</code>), then reload.</p></main>`;
      throw new Error("Not configured");
    }
    const session = await getSession();
    if (!session) {
      const next = encodeURIComponent(location.pathname.split("/").pop() || "dashboard.html");
      location.replace("login.html?next=" + next);
      throw new Error("Not authenticated");
    }
    FK.session = session;
    FK.user = session.user;
    return session;
  }

  async function signup(email, password, fullName) {
    const sb = client();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || "" } },
    });
    if (error) throw error;
    return data;
  }

  async function login(email, password) {
    const sb = client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function requestPasswordReset(email) {
    const sb = client();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("reset-password.html", location.href).toString(),
    });
    if (error) throw error;
  }

  async function updatePassword(password) {
    const sb = client();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
  }

  async function logout() {
    const sb = client();
    if (sb) await sb.auth.signOut();
    location.replace("index.html");
  }

  FK.auth = {
    isConfigured,
    client,
    getSession,
    requireSession,
    signup,
    login,
    requestPasswordReset,
    updatePassword,
    logout,
  };
})();
