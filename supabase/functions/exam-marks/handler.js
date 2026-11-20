import { InputError, UUID, validateDevice, validateMark, validateTarget, hmac } from './core.js';

const MAX_BODY = 8192;
const WRITES_PER_IP_HOUR = 1000; // sala de aula inteira atrás do mesmo Wi-Fi
const WRITES_PER_DEVICE_DAY = 40;
const LIST_LIMIT = 1000;
const TABLE = '/rest/v1/portal_exam_marks';
const FIELDS = 'id,course_code,course_title,professor,exam_kind,exam_date,semester,hidden,created_at,updated_at';

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createHandler({ url, serviceKey, fetcher = fetch, origins = ['https://cahk.app', 'https://www.cahk.app'], now = Date.now }) {
  const base = String(url).replace(/\/$/, '');
  const enc = encodeURIComponent;

  async function api(path, { method = 'GET', body, extra = {} } = {}) {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetcher(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw new HttpError(503, 'Não foi possível concluir agora. Tente novamente.');
    return await res.json().catch(() => null);
  }

  async function readJson(req) {
    const raw = await req.text();
    if (raw.length > MAX_BODY) throw new HttpError(413, 'Pedido grande demais.');
    let body; try { body = JSON.parse(raw); } catch { throw new InputError('Pedido inválido.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Pedido inválido.');
    return body;
  }

  async function keys(req, body) {
    const device = validateDevice(body.device);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    // O IP só entra em um hash que muda a cada dia; o dispositivo vira um hash estável sem identificar a pessoa.
    return {
      ipKey: await hmac(serviceKey, `ip:${Math.floor(now() / 86400000)}:${ip}`),
      clientKey: await hmac(serviceKey, `dev:${device}`),
    };
  }

  async function checkRate(ipKey, clientKey) {
    const hourAgo = enc(new Date(now() - 3600000).toISOString()), dayAgo = enc(new Date(now() - 86400000).toISOString());
    const byIp = await api(`${TABLE}?ip_key=eq.${ipKey}&updated_at=gte.${hourAgo}&select=id&limit=${WRITES_PER_IP_HOUR + 1}`);
    if ((byIp || []).length > WRITES_PER_IP_HOUR) throw new HttpError(429, 'Muitos envios deste local. Tente novamente mais tarde.');
    const byDevice = await api(`${TABLE}?client_key=eq.${clientKey}&updated_at=gte.${dayAgo}&select=id&limit=${WRITES_PER_DEVICE_DAY + 1}`);
    if ((byDevice || []).length > WRITES_PER_DEVICE_DAY) throw new HttpError(429, 'Limite diário de marcações atingido neste navegador.');
  }

  async function submit(req, body) {
    if (body.website) throw new InputError('Envio inválido.');
    const mark = validateMark(body, now());
    const { ipKey, clientKey } = await keys(req, body);
    await checkRate(ipKey, clientKey);
    await api(`${TABLE}?on_conflict=client_key,course_code,professor,exam_kind,semester`, {
      method: 'POST',
      body: { ...mark, client_key: clientKey, ip_key: ipKey, updated_at: new Date(now()).toISOString() },
      extra: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    return { status: 200, value: { ok: true } };
  }

  async function remove(req, body) {
    const t = validateTarget(body);
    const { clientKey } = await keys(req, body);
    await api(`${TABLE}?client_key=eq.${clientKey}&course_code=eq.${t.course_code}&professor=eq.${enc(t.professor)}&exam_kind=eq.${enc(t.exam_kind)}&semester=eq.${enc(t.semester)}`, { method: 'DELETE', extra: { Prefer: 'return=minimal' } });
    return { status: 200, value: { ok: true } };
  }

  async function admin(req) {
    const bearer = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(bearer)) throw new HttpError(401, 'Entre novamente na gestão.');
    const r = await fetcher(base + '/auth/v1/user', { headers: { apikey: serviceKey, Authorization: bearer } });
    const user = await r.json().catch(() => ({}));
    if (!r.ok || !UUID.test(user.id || '')) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
    const profile = (await api(`/rest/v1/profiles?id=eq.${user.id}&select=id,nome,role,ativo,permissions`))?.[0];
    const perms = profile?.permissions || [];
    // Mesma regra da aba Acadêmico / Disciplinas: administradores, perfil Biblioteca ou permissão "library".
    const allowed = profile?.ativo && (profile.role === 'admin' || profile.role === 'biblioteca' || perms.includes('library') || perms.includes('exams'));
    if (!allowed) throw new HttpError(403, 'Sem permissão para as provas.');
    return { id: user.id, name: profile.nome || user.email || '' };
  }

  async function audit(actor, action, id, details = {}) {
    try { await api('/rest/v1/admin_audit_log', { method: 'POST', body: { actor_user_id: actor.id, actor_name: actor.name, action, entity: 'prova_marcada', entity_id: id, details }, extra: { Prefer: 'return=minimal' } }); } catch { /* auditoria não deve impedir a ação */ }
  }

  async function management(action, req, body) {
    const actor = await admin(req);
    if (action === 'list') {
      const since = body.all ? '' : `&exam_date=gte.${new Date(now() - 14 * 86400000).toISOString().slice(0, 10)}`;
      const items = await api(`${TABLE}?select=${FIELDS}${since}&order=exam_date.asc,course_code.asc&limit=${LIST_LIMIT}`);
      return { status: 200, value: { items: items || [], truncated: (items || []).length >= LIST_LIMIT } };
    }
    if (!UUID.test(body.id || '')) throw new InputError('Registro inválido.');
    if (action === 'hide') {
      await api(`${TABLE}?id=eq.${body.id}`, { method: 'PATCH', body: { hidden: !!body.hidden }, extra: { Prefer: 'return=minimal' } });
      await audit(actor, body.hidden ? 'ocultar' : 'reexibir', body.id);
      return { status: 200, value: { ok: true } };
    }
    if (action === 'delete') {
      await api(`${TABLE}?id=eq.${body.id}`, { method: 'DELETE', extra: { Prefer: 'return=minimal' } });
      await audit(actor, 'excluir', body.id);
      return { status: 200, value: { ok: true } };
    }
    throw new InputError('Operação inválida.');
  }

  return async req => {
    const origin = req.headers.get('origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (value, status) => new Response(JSON.stringify(value), { status, headers });
    if (origin && !origins.includes(origin)) return respond({ error: 'Origem não autorizada.' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
    if (!base || !serviceKey) return respond({ error: 'Serviço indisponível. Tente mais tarde.' }, 503);
    try {
      const body = await readJson(req), action = String(body.action || '');
      const result = action === 'submit' ? await submit(req, body)
        : action === 'remove' ? await remove(req, body)
        : ['list', 'hide', 'delete'].includes(action) ? await management(action, req, body)
        : (() => { throw new InputError('Operação inválida.'); })();
      return respond(result.value, result.status);
    } catch (error) {
      const status = error instanceof InputError ? 400 : error instanceof HttpError ? error.status : 503;
      return respond({ error: error instanceof InputError || error instanceof HttpError ? error.message : 'Não foi possível concluir agora. Tente novamente.' }, status);
    }
  };
}
