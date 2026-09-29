const SUPABASE_URL = "https://ekmzeqnnktdwvzxacbix.supabase.co";
const SUPABASE_KEY = "sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz";
const STORAGE_KEY = "daex-auth";
const USERNAME_MAP = Object.freeze({
  caixadaex: "caixadaex@cahk.app",
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveEmail(username) {
  return USERNAME_MAP[normalize(username)] ?? null;
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    user: session.user,
  }));
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function fetchCurrentUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function refreshSession(refreshToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) return null;
  const session = await response.json();
  saveSession(session);
  return session;
}

async function getValidSession() {
  let session = readSession();
  if (!session?.access_token) return null;

  if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 30) {
    if (!session.refresh_token) return null;
    session = await refreshSession(session.refresh_token);
    if (!session) return null;
  }

  const user = await fetchCurrentUser(session.access_token);
  if (!user) return null;

  return { ...session, user };
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) return { ok: false };

  const session = await response.json();
  saveSession(session);
  return { ok: true, session };
}

const form = document.querySelector("#login-form");
const error = document.querySelector("#error");
const submit = document.querySelector("#submit");

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}

function setLoading(loading) {
  submit.disabled = loading;
  submit.textContent = loading ? "Entrando..." : "Entrar";
}

(async () => {
  const session = await getValidSession();
  if (session?.user?.email?.toLowerCase() === "caixadaex@cahk.app") {
    location.replace("./dashboard.html");
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");

  const email = resolveEmail(document.querySelector("#username").value);
  const password = document.querySelector("#password").value;

  if (!email) {
    showError("Usuário ou senha inválidos.");
    return;
  }

  setLoading(true);
  const result = await signIn(email, password);
  setLoading(false);

  if (!result.ok) {
    showError("Usuário ou senha inválidos.");
    return;
  }

  if (result.session?.user?.email?.toLowerCase() !== "caixadaex@cahk.app") {
    localStorage.removeItem(STORAGE_KEY);
    showError("Esta conta não possui acesso ao DAEX.");
    return;
  }

  location.replace("./dashboard.html");
});
