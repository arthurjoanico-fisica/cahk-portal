import { json, randomSecret, ROOM_TTL_MS, sameOrigin } from './arena.mjs';
export { ArenaRoom } from './arena.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/arena/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/arena/api/rooms') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
      if (!sameOrigin(request)) return json({ error: 'Same origin required' }, 403);
      const network = request.headers.get('CF-Connecting-IP') || 'unknown';
      const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(network));
      const clientKey = Array.from(new Uint8Array(hashed).slice(0, 16), n => n.toString(16).padStart(2, '0')).join('');
      const gate = env.ARENA_ROOMS.get(env.ARENA_ROOMS.idFromName('creation-quota-v1'));
      const permission = await gate.fetch('https://arena.internal/quota', { method: 'POST', body: JSON.stringify({ clientKey }) });
      if (!permission.ok) return json({ error: 'Limite de salas atingido. Retome uma sessão existente ou tente mais tarde.' }, 429, { 'Retry-After': '60' });
      const createdAt = Date.now();
      const credentials = { room: randomSecret(16), hostToken: randomSecret(32), padTokens: [randomSecret(32), randomSecret(32)] };
      const stub = env.ARENA_ROOMS.get(env.ARENA_ROOMS.idFromName(credentials.room));
      const result = await stub.fetch('https://arena.internal/init', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, createdAt, expiresAt: createdAt + ROOM_TTL_MS }) });
      if (result.status !== 201) return json({ error: 'Unable to create room' }, 503);
      return json(credentials, 201);
    }
    const match = /^\/arena\/api\/rooms\/([a-f0-9]{32})\/(?:ws|status)$/.exec(url.pathname);
    if (!match) return json({ error: 'Not found' }, 404);
    if (!sameOrigin(request)) return json({ error: 'Same origin required' }, 403);
    return env.ARENA_ROOMS.get(env.ARENA_ROOMS.idFromName(match[1])).fetch(request);
  },
};
