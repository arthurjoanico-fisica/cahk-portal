import { MAX_BODY, MAX_IMAGE, UUID, STATUSES, InputError, validateSubmission, validateImage, cleanJpeg, digest, rateKey } from './core.js';
const BUCKET = 'cahk-private-complaints';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function createHandler({ url, serviceKey, fetcher = fetch, origins = ['https://cahk.app', 'https://www.cahk.app'], now = Date.now }) {
  const base = String(url).replace(/\/$/, '');
  async function api(path, { method = 'GET', body, token, binary = false, extra = {} } = {}) {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${token || serviceKey}`, ...extra };
    if (body !== undefined && !binary) headers['Content-Type'] = 'application/json';
    const res = await fetcher(base + path, { method, headers, body: body === undefined ? undefined : binary ? body : JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new HttpError(res.status === 409 ? 409 : 503, res.status === 409 ? 'Envio em processamento. Aguarde alguns segundos e tente novamente.' : 'Não foi possível concluir agora. Seu relato não foi confirmado. Tente novamente.');
    return data;
  }
  async function readBody(req, limit) {
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > limit) throw new HttpError(413, 'O envio ultrapassou o tamanho permitido.');
    const reader = req.body?.getReader(); if (!reader) throw new InputError('Envio vazio.');
    const chunks = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new HttpError(413, 'O envio ultrapassou o tamanho permitido.'); } chunks.push(value); }
    const all = new Uint8Array(size); let pos = 0; for (const chunk of chunks) { all.set(chunk, pos); pos += chunk.length; } return all;
  }
  async function admin(req) {
    const bearer = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(bearer)) throw new HttpError(401, 'Entre novamente na gestão.');
    const token = bearer.replace(/^Bearer\s+/i, '');
    const r = await fetcher(base + '/auth/v1/user', { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    const user = await r.json().catch(() => ({}));
    if (!r.ok || !UUID.test(user.id || '')) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.');
    const profiles = await api(`/rest/v1/profiles?id=eq.${user.id}&select=id,role,ativo`);
    if (!profiles?.[0]?.ativo || profiles[0].role !== 'admin') throw new HttpError(403, 'Acesso restrito a administradores ativos.');
    return user.id;
  }
  async function submit(req) {
    if (!(req.headers.get('content-type') || '').startsWith('multipart/form-data')) throw new InputError('Formato de envio inválido.');
    const raw = await readBody(req, MAX_BODY);
    let form; try { form = await new Response(raw, { headers: { 'Content-Type': req.headers.get('content-type') } }).formData(); } catch { throw new InputError('Envio incompleto. Tente novamente.'); }
    if (form.get('website')) throw new InputError('Envio inválido.');
    const files = form.getAll('images');
    const { text, key } = validateSubmission(form.get('text'), form.get('submission_key'), files);
    const images = [];
    for (const file of files) {
      if (!(file instanceof Blob) || file.size > MAX_IMAGE) throw new InputError('Imagem inválida ou maior que 2 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer()); validateImage(bytes, file.type);
      images.push(cleanJpeg(bytes));
    }
    const payloadHash = await digest(JSON.stringify([text, await Promise.all(images.map(digest))]));
    const existing = await api(`/rest/v1/cahk_complaints?submission_key=eq.${key}&select=id,protocol,payload_hash&limit=1`);
    if (existing?.length) {
      if (existing[0].payload_hash !== payloadHash) throw new HttpError(409, 'Este envio já foi recebido com outro conteúdo. Abra um novo formulário para outro relato.');
      return { status: 200, value: { protocol: existing[0].protocol } };
    }
    // Salted window hash is retained only in rate counters, never in the report.
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const slot = Math.floor(now() / 900000);
    const allowed = await api('/rest/v1/rpc/cahk_complaint_take_slot', { method: 'POST', body: { rate_key: await rateKey(serviceKey, ip, slot) } });
    if (!allowed) throw new HttpError(429, 'Limite temporário de envios. Aguarde 15 minutos antes de tentar novamente.');
    const id = key; const uploaded = []; let insertAttempted = false;
    try {
      const attachments = [];
      for (let i = 0; i < images.length; i++) {
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        await api(`/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', binary: true, body: images[i], extra: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false', 'Cache-Control': 'private, no-store' } });
        uploaded.push(path); attachments.push({ path, mime: 'image/jpeg', bytes: images[i].length });
      }
      insertAttempted = true;
      const rows = await api('/rest/v1/cahk_complaints', { method: 'POST', body: { id, submission_key: key, payload_hash: payloadHash, text, attachments }, extra: { Prefer: 'return=representation' } });
      if (!rows?.[0]?.protocol) throw new HttpError(503, 'Recebimento não confirmado. Tente novamente.');
      return { status: 201, value: { protocol: rows[0].protocol } };
    } catch (error) {
      // A competing request or a lost response may already have committed the same report.
      let committed = null; try { committed = (await api(`/rest/v1/cahk_complaints?submission_key=eq.${key}&select=id,protocol,payload_hash,attachments&limit=1`))?.[0]; } catch { /* keep unconfirmed state */ }
      if (committed?.payload_hash === payloadHash) {
        const used = new Set((committed.attachments || []).map(a => a.path));
        const unused = uploaded.filter(path => !used.has(path));
        if (unused.length) { try { await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: unused } }); } catch { /* private orphan; reconcile separately */ } }
        return { status: 200, value: { protocol: committed.protocol } };
      }
      if (!insertAttempted && uploaded.length) {
        try { await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: uploaded } }); } catch { /* orphan paths remain private; review in storage */ }
      }
      throw error;
    }
  }
  async function management(action, req) {
    const actor = await admin(req);
    let body; try { body = JSON.parse(new TextDecoder().decode(await readBody(req, 32768))); } catch (e) { if (e instanceof HttpError) throw e; throw new InputError('Pedido inválido.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Pedido inválido.');
    if (action === 'list') {
      const page = Math.max(0, Math.min(100000, Number.isInteger(body.page) ? body.page : 0));
      const filter = body.status && STATUSES.includes(body.status) ? `&status=eq.${body.status}` : '';
      const items = await api(`/rest/v1/cahk_complaints?select=id,protocol,created_at,status,version&order=created_at.desc,id.desc&limit=21&offset=${page * 20}${filter}`);
      return { status: 200, value: { items: (items || []).slice(0, 20), has_more: (items || []).length > 20 } };
    }
    if (!UUID.test(body.id || '')) throw new InputError('Registro inválido.');
    if (action === 'detail') {
      const rows = await api(`/rest/v1/cahk_complaints?id=eq.${body.id}&select=id,protocol,created_at,status,version,text,attachments,internal_notes,updated_at&limit=1`);
      const item = rows?.[0]; if (!item) throw new HttpError(404, 'Denúncia não encontrada.');
      const photos = [];
      for (const a of item.attachments || []) {
        if (!a.path?.startsWith(`${body.id}/`) || !/^[-a-f0-9/]+\.jpg$/i.test(a.path)) continue;
        const signed = await api(`/storage/v1/object/sign/${BUCKET}/${a.path}`, { method: 'POST', body: { expiresIn: 120 } });
        const signedPath = signed?.signedURL || signed?.signedUrl;
        if (signedPath) photos.push({ url: signedPath.startsWith('http') ? signedPath : `${base}${signedPath.startsWith('/storage/v1/') ? '' : '/storage/v1'}${signedPath}`, bytes: a.bytes });
      }
      const history = await api(`/rest/v1/cahk_complaint_history?complaint_id=eq.${body.id}&select=created_at,status,notes&order=created_at.desc&limit=100`);
      delete item.attachments;
      return { status: 200, value: { item, photos, history: history || [] } };
    }
    if (action === 'update') {
      if (!STATUSES.includes(body.status) || !Number.isInteger(body.version) || body.version < 1 || typeof body.notes !== 'string' || body.notes.length > 10000) throw new InputError('Status ou observações inválidos.');
      const row = await api('/rest/v1/rpc/cahk_complaint_update', { method: 'POST', body: { p_id: body.id, p_version: body.version, p_status: body.status, p_notes: body.notes.trim(), p_actor: actor } });
      if (!row) throw new HttpError(409, 'O registro foi atualizado por outra pessoa. Recarregue antes de salvar.');
      return { status: 200, value: { saved: true, version: row.version } };
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
    if (!base || !serviceKey) return respond({ error: 'Recebimento indisponível. Tente mais tarde.' }, 503);
    try {
      const action = new URL(req.url).searchParams.get('action') || 'submit';
      const result = action === 'submit' ? await submit(req) : await management(action, req);
      return respond(result.value, result.status);
    } catch (error) {
      return respond({ error: error instanceof InputError || error instanceof HttpError ? error.message : 'Não foi possível concluir agora. Tente novamente.' }, error instanceof InputError ? 400 : error instanceof HttpError ? error.status : 503);
    }
  };
}
