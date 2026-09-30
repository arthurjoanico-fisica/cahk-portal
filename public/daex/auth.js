export const SUPABASE_URL = 'https://ekmzeqnnktdwvzxacbix.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_jeWoJ4G9UXN6ucS3WkZVzA_ytTEzuJz';
export const STORAGE_KEY = 'daex-auth';

export function readSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
}

export function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    user: session.user,
  }));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function refreshSession(refreshToken) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const session = await response.json();
    saveSession(session);
    return readSession();
  } catch {
    return null;
  }
}

export async function getCurrentUser(accessToken) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function getValidSession() {
  let session = readSession();
  if (!session?.access_token) return null;
  if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 30) {
    if (!session.refresh_token) return null;
    session = await refreshSession(session.refresh_token);
    if (!session) return null;
  }
  const user = await getCurrentUser(session.access_token);
  if (!user) return null;
  return { ...session, user };
}

export async function signIn(email, password) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return { ok: false };
    const session = await response.json();
    saveSession(session);
    return { ok: true, session };
  } catch {
    return { ok: false, network: true };
  }
}

export function signOut() {
  clearSession();
}
