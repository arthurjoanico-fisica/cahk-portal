const SUPABASE_URL = "https://ekmzeqnnktdwvzxacbix.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz";

const LOGIN_ALIASES = Object.freeze({
  caixadaex: "caixadaex@cahk.app",
});

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveTechnicalEmail(username) {
  return LOGIN_ALIASES[normalizeUsername(username)] ?? null;
}

export function isBootstrapDaexUser(user) {
  return user?.email?.toLowerCase() === LOGIN_ALIASES.caixadaex;
}

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: "daex-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

const form = document.querySelector("#login-form");
const errorBox = document.querySelector("#login-error");
const loginButton = document.querySelector("#login-button");
const sessionPanel = document.querySelector("#session-panel");
const sessionUser = document.querySelector("#session-user");
const logoutButton = document.querySelector("#logout-button");
const dashboardButton = document.querySelector("#go-dashboard");

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function setLoading(loading) {
  loginButton.disabled = loading;
  loginButton.textContent = loading ? "Entrando..." : "Entrar";
}

async function daexUserHasAccess(user) {
  if (!user) return false;

  // Conta inicial de bootstrap.
  if (isBootstrapDaexUser(user)) return true;

  // Quando daex_profiles estiver instalado, os demais usuários passam por ele.
  try {
    const { data, error } = await supabase
      .from("daex_profiles")
      .select("id,role,ativo")
      .eq("id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

async function renderSession() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  if (!user || !(await daexUserHasAccess(user))) {
    sessionPanel.hidden = true;
    form.hidden = false;
    return;
  }

  form.hidden = true;
  sessionPanel.hidden = false;
  sessionUser.textContent =
    user.user_metadata?.display_name ||
    user.app_metadata?.daex_username ||
    "caixadaex";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");

  const username = normalizeUsername(
    document.querySelector("#username").value
  );
  const password = document.querySelector("#password").value;
  const email = resolveTechnicalEmail(username);

  if (!email) {
    showError("Usuário ou senha inválidos.");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    setLoading(false);
    showError("Usuário ou senha inválidos.");
    return;
  }

  if (!(await daexUserHasAccess(data.user))) {
    await supabase.auth.signOut();
    setLoading(false);
    showError("Esta conta não possui acesso ao DAEX.");
    return;
  }

  setLoading(false);
  await renderSession();
});

logoutButton.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await renderSession();
});

dashboardButton.addEventListener("click", () => {
  window.location.href = "./dashboard.html";
});

supabase.auth.onAuthStateChange(() => {
  window.setTimeout(renderSession, 0);
});

renderSession();
