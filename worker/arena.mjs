export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_MESSAGE_BYTES = 32 * 1024;
const ROLES = ['host', 'p1', 'p2'];
const encoder = new TextEncoder();

export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin
    && !['cross-site', 'none'].includes(request.headers.get('Sec-Fetch-Site'));
}

export function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers,
  } });
}

export function randomSecret(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Bound allocation across isolates, including callers outside a browser.
export function consumeRoomQuota(state, now, clientKey) {
  const day = Math.floor(now / 86400000);
  if (state.day !== day) Object.assign(state, { day, total: 0, networks: {} });
  for (const [key, record] of Object.entries(state.networks)) if (now - record.hourAt >= 3600000) delete state.networks[key];
  const record = state.networks[clientKey] || { hourAt: now, hour: 0, minuteAt: now, minute: 0 };
  if (now - record.minuteAt >= 60000) { record.minuteAt = now; record.minute = 0; }
  if (state.total >= 120 || record.hour >= 24 || record.minute >= 6) return false;
  record.hour++; record.minute++; state.total++; state.networks[clientKey] = record;
  return true;
}

export function authorizeRoom(room, role, token) {
  if (!room || !ROLES.includes(role) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = role === 'host' ? room.hostToken : room.padTokens[role === 'p1' ? 0 : 1];
  if (typeof expected !== 'string' || expected.length !== token.length) return false;
  let difference = 0;
  for (let i = 0; i < token.length; i++) difference |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const range = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const player = value => value === 0 || value === 1;

function validCheckpoint(state) {
  if (!object(state)) return false;
  // Bound traversal as well as wire size, including JSON nesting and numeric overflow.
  const pending = [[state, 0]];
  let count = 0;
  while (pending.length) {
    const [value, depth] = pending.pop();
    if (++count > 4096 || depth > 32) return false;
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) pending.push([child, depth + 1]);
    } else if (typeof value === 'number' && !Number.isFinite(value)) return false;
  }
  return encoder.encode(JSON.stringify(state)).byteLength <= MAX_MESSAGE_BYTES - 256;
}

// Return a fresh allowlisted envelope. No client-provided identity or raw sensors survive.
export function validateMessage(role, message) {
  if (!ROLES.includes(role) || !object(message)) throw new Error('Invalid message');
  const { type } = message;
  if (type === 'ping' || type === 'pong') return { type };
  if (role !== 'host') {
    if (type === 'ready' && typeof message.ready === 'boolean') return { type, ready: message.ready };
    if (type === 'swing') {
      const { power, aim, lob, spin, id } = message;
      if (range(power, 0, 1) && range(aim, -1, 1) && range(lob, 0, 1) && range(spin, -1, 1)
        && typeof id === 'string' && id.length > 0 && id.length <= 128 && !/[\u0000-\u001f]/.test(id)) {
        return { type, power, aim, lob, spin, id };
      }
    }
  } else {
    if (type === 'checkpoint' && validCheckpoint(message.state)) return { type, state: message.state };
    if (type === 'calibrate' && player(message.player)) return { type, player: message.player };
    if (type === 'feedback' && player(message.player) && ['hit', 'point'].includes(message.event) && range(message.power, 0, 1)) {
      return { type, player: message.player, event: message.event, power: message.power };
    }
  }
  throw new Error('Invalid or unauthorized message');
}

function take(bucket, now, capacity, perSecond) {
  bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0, now - bucket.at) * perSecond / 1000);
  bucket.at = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens--;
  return true;
}

// SQLite storage is selected by the Wrangler migration. The KV API uses its SQLite table.
export class ArenaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Map();
    ctx.blockConcurrencyWhile(async () => {
      [this.room, this.checkpoint] = await Promise.all([ctx.storage.get('room'), ctx.storage.get('checkpoint')]);
      for (const socket of ctx.getWebSockets()) {
        const attachment = socket.deserializeAttachment();
        if (attachment?.active && ROLES.includes(attachment.role) && socket.readyState === 1) {
          this.sessions.set(attachment.role, socket);
        }
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/quota' && request.method === 'POST') {
      return this.ctx.blockConcurrencyWhile(async () => {
        const { clientKey } = await request.json();
        if (typeof clientKey !== 'string' || !/^[a-f0-9]{32}$/.test(clientKey)) return json({ error: 'Bad key' }, 400);
        const quota = await this.ctx.storage.get('quota') || {};
        if (!consumeRoomQuota(quota, Date.now(), clientKey)) return json({ allowed: false }, 429);
        await this.ctx.storage.transaction(async storage => { await storage.put('quota', quota); await storage.setAlarm((Math.floor(Date.now() / 86400000) + 1) * 86400000); });
        return json({ allowed: true });
      });
    }
    // Only the outer Worker can reach this initializer; it is not a public API route.
    if (url.pathname === '/init' && request.method === 'POST') {
      return this.ctx.blockConcurrencyWhile(async () => {
        if (this.room) return json({ error: 'Room exists' }, 409);
        const room = await request.json();
        // Credentials and their cleanup alarm must commit together.
        await this.ctx.storage.transaction(async storage => {
          await storage.put('room', room);
          await storage.setAlarm(room.expiresAt);
        });
        this.room = room;
        this.checkpoint = null;
        return json({ ok: true }, 201);
      });
    }
    if (!sameOrigin(request)) return json({ error: 'Same origin required' }, 403);
    if (!this.room) return json({ error: 'Room not found' }, 404);
    if (Date.now() >= this.room.expiresAt) {
      await this.expire();
      return json({ error: 'Room expired' }, 410);
    }
    if (url.pathname === `/arena/api/rooms/${this.room.room}/status`) {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!authorizeRoom(this.room, 'host', (request.headers.get('Authorization') || '').replace(/^Bearer /, ''))) return json({ error: 'Forbidden' }, 403);
      return json({ alive: true, expiresAt: this.room.expiresAt });
    }
    if (url.pathname !== `/arena/api/rooms/${this.room.room}/ws`) return json({ error: 'Not found' }, 404);
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
    const role = url.searchParams.get('role');
    if (url.searchParams.getAll('role').length !== 1 || url.searchParams.getAll('token').length !== 1
      || !authorizeRoom(this.room, role, url.searchParams.get('token'))) return json({ error: 'Forbidden' }, 403);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket required' }, 426, { Upgrade: 'websocket' });

    const [client, server] = Object.values(new WebSocketPair());
    const old = this.sessions.get(role);
    const previous = old?.deserializeAttachment();
    const now = Date.now();
    const attachment = { role, active: true, connectionId: randomSecret(16), ready: false,
      seen: previous?.seen ?? [], swings: previous?.swings ?? { tokens: 4, at: now },
      messages: previous?.messages ?? { tokens: 60, at: now } };
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment(attachment);
    // No await between replacing the role and retiring its previous connection.
    this.sessions.set(role, server);
    if (old) {
      old.serializeAttachment({ ...previous, active: false });
      this.close(old, 1000, 'Connection replaced');
    }
    if (role === 'host') this.send(server, { type: 'restore', state: this.checkpoint ?? null });
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }

  send(socket, value) {
    if (!socket || socket.readyState !== 1) return;
    try { socket.send(JSON.stringify(value)); } catch { this.disconnect(socket); }
  }

  close(socket, code, reason) {
    try { socket.close(code, reason); } catch { /* Already closed by the peer. */ }
  }

  broadcastPresence() {
    const phones = ['p1', 'p2'].map(role => this.sessions.get(role));
    const presence = { type: 'presence', host: this.sessions.has('host'), pads: phones.map(Boolean),
      ready: phones.map(socket => Boolean(socket?.deserializeAttachment()?.ready)) };
    for (const socket of this.sessions.values()) this.send(socket, presence);
  }

  disconnect(socket) {
    const attachment = socket.deserializeAttachment();
    if (!attachment?.active || this.sessions.get(attachment.role) !== socket) return;
    socket.serializeAttachment({ ...attachment, active: false, ready: false });
    this.sessions.delete(attachment.role);
    this.broadcastPresence();
  }

  async webSocketMessage(socket, raw) {
    const attachment = socket.deserializeAttachment();
    // Identity comes exclusively from this authenticated attachment, never the envelope.
    if (!attachment?.active || this.sessions.get(attachment.role) !== socket) return;
    if (!this.room || Date.now() >= this.room.expiresAt) { await this.expire(); return; }
    if (typeof raw !== 'string') {
      this.disconnect(socket); this.close(socket, 1003, 'Text JSON required'); return;
    }
    if (raw.length > MAX_MESSAGE_BYTES || encoder.encode(raw).byteLength > MAX_MESSAGE_BYTES) {
      this.disconnect(socket); this.close(socket, 1009, 'Message too large'); return;
    }
    const now = Date.now();
    if (!take(attachment.messages, now, 60, 30)) {
      this.disconnect(socket); this.close(socket, 1008, 'Message rate exceeded'); return;
    }
    socket.serializeAttachment(attachment);
    let message;
    try { message = validateMessage(attachment.role, JSON.parse(raw)); }
    catch { this.send(socket, { type: 'error', message: 'Invalid or unauthorized message' }); return; }
    switch (message.type) {
      case 'ping': this.send(socket, { type: 'pong' }); break;
      case 'pong': break;
      case 'ready':
        if (attachment.ready !== message.ready) {
          attachment.ready = message.ready;
          socket.serializeAttachment(attachment);
          this.broadcastPresence();
        }
        break;
      case 'swing':
        if (attachment.seen.includes(message.id)) return;
        if (!take(attachment.swings, now, 4, 8)) {
          socket.serializeAttachment(attachment);
          this.send(socket, { type: 'error', message: 'Swing rate exceeded' });
          return;
        }
        // 32 IDs of at most 128 UTF-16 units leave ample space under the
        // runtime's 16 KiB serialized attachment limit, including Unicode IDs.
        attachment.seen = [...attachment.seen.slice(-31), message.id];
        socket.serializeAttachment(attachment);
        this.send(this.sessions.get('host'), { ...message, player: attachment.role === 'p1' ? 0 : 1 });
        break;
      case 'checkpoint':
        await this.ctx.storage.put('checkpoint', message.state);
        this.checkpoint = message.state;
        this.send(socket, { type: 'checkpoint-saved', savedAt: message.state.savedAt ?? null });
        break;
      case 'feedback':
      case 'calibrate':
        this.send(this.sessions.get(message.player === 0 ? 'p1' : 'p2'), message);
        break;
    }
  }

  webSocketClose(socket, code) {
    this.disconnect(socket);
    // Complete the close handshake; a replaced socket cannot mutate its successor.
    this.close(socket, code === 1005 || code === 1006 ? 1000 : code, 'Disconnected');
  }

  webSocketError(socket) {
    this.disconnect(socket);
    this.close(socket, 1011, 'Connection error');
  }

  async expire() {
    this.room = null;
    this.checkpoint = null;
    this.sessions.clear();
    for (const socket of this.ctx.getWebSockets()) this.close(socket, 1000, 'Room expired');
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    if (this.room && Date.now() < this.room.expiresAt) {
      await this.ctx.storage.setAlarm(this.room.expiresAt);
    } else await this.expire();
  }
}
