import { SUPABASE_URL, SUPABASE_KEY, getValidSession, clearSession } from './auth.js';

export class ApiError extends Error {
  constructor(message, { status = 0, network = false, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.network = network;
    this.payload = payload;
  }
}

async function authHeaders(extra = {}) {
  const session = await getValidSession();
  if (!session) {
    clearSession();
    location.replace('./');
    throw new ApiError('Sessão expirada.', { status: 401 });
  }
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${session.access_token}`,
    ...extra,
  };
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: await authHeaders(options.headers || {}),
    });
  } catch (error) {
    throw new ApiError('Sem conexão com o servidor.', { network: true, payload: error });
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error_description || payload?.hint || `Erro ${response.status}`;
    throw new ApiError(message, { status: response.status, payload });
  }

  return payload;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const q = search.toString();
  return q ? `?${q}` : '';
}

export async function select(table, params = {}) {
  return request(`/rest/v1/${table}${toQuery(params)}`);
}

export async function insert(table, body) {
  return request(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}

export async function update(table, filters, body) {
  return request(`/rest/v1/${table}${toQuery(filters)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}

export async function remove(table, filters) {
  return request(`/rest/v1/${table}${toQuery(filters)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
}

export async function rpc(name, body = {}) {
  return request(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
