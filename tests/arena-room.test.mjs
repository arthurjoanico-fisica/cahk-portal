import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from 'node:v8';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const origin = 'https://arena.test';
import * as backend from '../worker/arena.mjs';
const shot = { type: 'swing', power: .7, aim: -.2, lob: .1, spin: .3, id: 'swing-1' };
const credentials = { room: 'a'.repeat(32), hostToken: 'b'.repeat(64), padTokens: ['c'.repeat(64), 'd'.repeat(64)] };

test('authorization binds each secret to exactly one role', () => {
  assert.equal(typeof backend.authorizeRoom, 'function', 'room authorization must exist');
  for (const [role, token] of [['host', credentials.hostToken], ['p1', credentials.padTokens[0]], ['p2', credentials.padTokens[1]]]) {
    assert.equal(backend.authorizeRoom(credentials, role, token), true);
    for (const other of ['host', 'p1', 'p2'].filter(other => other !== role)) {
      assert.equal(backend.authorizeRoom(credentials, other, token), false);
    }
  }
  for (const [role, token] of [['admin', credentials.hostToken], ['p1', ''], ['host', null], ['p2', 'x'.repeat(10000)]]) {
    assert.equal(backend.authorizeRoom(credentials, role, token), false);
  }
});

test('validation permits sparse gestures and strips claimed player and raw sensor fields', () => {
  assert.equal(typeof backend.validateMessage, 'function', 'protocol validation must exist');
  assert.deepEqual(backend.validateMessage('p2', { ...shot, player: 0, acceleration: [1, 2, 3], hostToken: 'leak' }), shot);
  assert.deepEqual(backend.validateMessage('p1', { type: 'ready', ready: true }), { type: 'ready', ready: true });
  for (const bad of [null, [], {}, { type: 'motion', samples: [] }, { ...shot, power: 1.01 }, { ...shot, aim: -1.1 }, { ...shot, spin: NaN }, { ...shot, lob: Infinity }, { ...shot, id: '' }, { ...shot, id: 'a'.repeat(129) }, { type: 'ready', ready: 'true' }]) {
    assert.throws(() => backend.validateMessage('p1', bad));
  }
});

test('phone cannot checkpoint or send feedback; host cannot send swings or ready', () => {
  assert.equal(typeof backend.validateMessage, 'function');
  for (const role of ['p1', 'p2']) {
    for (const value of [{ type: 'checkpoint', state: {} }, { type: 'feedback', player: 1, event: 'hit', power: .5 }, { type: 'calibrate', player: 0 }]) {
      assert.throws(() => backend.validateMessage(role, value));
    }
  }
  for (const value of [shot, { type: 'ready', ready: true }, { type: 'checkpoint', state: null }, { type: 'checkpoint', state: [] }, { type: 'feedback', player: 2, event: 'hit', power: .5 }, { type: 'feedback', player: 0, event: 'win', power: .5 }]) {
    assert.throws(() => backend.validateMessage('host', value));
  }
  assert.deepEqual(backend.validateMessage('host', { type: 'checkpoint', state: { scores: [3, 4] } }), { type: 'checkpoint', state: { scores: [3, 4] } });
});

let mf;
before(async () => {
  const bundled = await build({ entryPoints: ['worker/index.mjs'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  mf = new Miniflare(convertV4MiniflareOptions({ name: 'arena-tests', modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-09-11', durableObjects: { ARENA_ROOMS: { className: 'ArenaRoom', useSQLite: true } },
    serviceBindings: { ASSETS: request => new Response(`asset:${new URL(request.url).pathname}`) } }));
  await mf.ready;
});
after(async () => { await mf?.dispose(); });
function runtime(t) { assert.ok(mf, 'ArenaRoom runtime must exist'); }
let testNetwork=0;
async function create() {
  const response = await mf.dispatchFetch(`${origin}/arena/api/rooms`, { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `10.0.0.${++testNetwork}` } });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('cache-control'), /no-store/);
  return response.json();
}
function inbox(socket) {
  const pending = [], messages = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const i = pending.findIndex(item => item.predicate(message));
    if (i >= 0) { const [item] = pending.splice(i, 1); clearTimeout(item.timer); item.resolve(message); }
    else messages.push(message);
  });
  return { messages, next(predicate = () => true) {
    const i = messages.findIndex(predicate);
    if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const item = { predicate, resolve, timer: setTimeout(() => { pending.splice(pending.indexOf(item), 1); reject(Error('Timed out waiting for protocol message')); }, 3000) };
      pending.push(item);
    });
  } };
}
async function connect(room, role, token) {
  const response = await mf.dispatchFetch(`${origin}/arena/api/rooms/${room}/ws?role=${role}&token=${token}`, { headers: { Upgrade: 'websocket', Origin: origin } });
  assert.equal(response.status, 101);
  const socket = response.webSocket, queue = inbox(socket);
  socket.accept();
  return { socket, ...queue, send: value => socket.send(JSON.stringify(value)) };
}
async function barrier(client) { client.send({ type: 'ping' }); await client.next(value => value.type === 'pong'); }

// These exercise the actual Worker/SQLite DO rather than reimplementing its relay in a mock.
test('creation is same-origin only, random and private; static paths remain assets', async t => {
  runtime(t);
  for (const headers of [{}, { Origin: 'https://evil.test' }, { Origin: 'null' }, { Origin: `${origin}.evil.test` }]) {
    const response = await mf.dispatchFetch(`${origin}/arena/api/rooms`, { method: 'POST', headers });
    assert.equal(response.status, 403);
  }
  const a = await create(), b = await create();
  assert.deepEqual(Object.keys(a).sort(), ['hostToken', 'padTokens', 'room']);
  assert.match(a.room, /^[a-f0-9]{32}$/);
  assert.equal(new Set([a.hostToken, ...a.padTokens, b.hostToken, ...b.padTokens]).size, 6);
  assert.notEqual(a.room, b.room);
  assert.match(a.hostToken, /^[a-f0-9]{64}$/);
  assert.equal(await (await mf.dispatchFetch(`${origin}/arena/`)).text(), 'asset:/arena/');
  assert.equal((await mf.dispatchFetch(`${origin}/arena/api/nope`)).status, 404);
  assert.equal((await mf.dispatchFetch(`${origin}/arena/api/rooms`)).status, 405);
});

test('websocket authentication rejects cross-role, missing origin and unknown rooms', async t => {
  runtime(t);
  const room = await create();
  for (const [role, token, headers, status] of [
    ['host', room.padTokens[0], { Origin: origin }, 403], ['p1', room.hostToken, { Origin: origin }, 403],
    ['p2', room.padTokens[0], { Origin: origin }, 403], ['admin', room.hostToken, { Origin: origin }, 403],
    ['host', room.hostToken, {}, 403], ['host', room.hostToken, { Origin: 'https://evil.test' }, 403],
  ]) {
    const response = await mf.dispatchFetch(`${origin}/arena/api/rooms/${room.room}/ws?role=${role}&token=${token}`, { headers: { Upgrade: 'websocket', ...headers } });
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes(room.hostToken));
  }
  assert.equal((await mf.dispatchFetch(`${origin}/arena/api/rooms/${'f'.repeat(32)}/ws?role=host&token=${room.hostToken}`, { headers: { Upgrade: 'websocket', Origin: origin } })).status, 404);
  assert.equal((await mf.dispatchFetch(`${origin}/arena/api/rooms/${room.room}/ws?role=host&token=${room.hostToken}`, { headers: { Origin: origin } })).status, 426);
});

test('host and two phones enforce identity, ready, duplicate/rate limits and directed feedback', async t => {
  runtime(t);
  const room = await create();
  const host = await connect(room.room, 'host', room.hostToken);
  assert.deepEqual(await host.next(v => v.type === 'restore'), { type: 'restore', state: null });
  const p1 = await connect(room.room, 'p1', room.padTokens[0]);
  const p2 = await connect(room.room, 'p2', room.padTokens[1]);
  await host.next(v => v.type === 'presence' && v.pads.every(Boolean));
  p2.send({ type: 'ready', ready: true });
  assert.deepEqual(await host.next(v => v.type === 'presence' && v.ready[1]), { type: 'presence', host: true, pads: [true, true], ready: [false, true] });
  p2.send({ ...shot, player: 0, samples: [999], token: room.hostToken });
  assert.deepEqual(await host.next(v => v.type === 'swing'), { ...shot, player: 1 });
  p2.send(shot);
  await barrier(p2);
  assert.equal(host.messages.filter(v => v.type === 'swing').length, 0);
  p1.send({ type: 'checkpoint', state: { hacked: true } });
  await p1.next(v => v.type === 'error');
  host.send(shot);
  await host.next(v => v.type === 'error');
  host.send({ type: 'feedback', player: 1, event: 'hit', power: .6 });
  assert.deepEqual(await p2.next(v => v.type === 'feedback'), { type: 'feedback', player: 1, event: 'hit', power: .6 });
  host.send({ type: 'calibrate', player: 0 });
  assert.deepEqual(await p1.next(v => v.type === 'calibrate'), { type: 'calibrate', player: 0 });
  await barrier(host);
  assert.equal(p1.messages.filter(v => v.type === 'feedback').length, 0);
  assert.equal(p2.messages.filter(v => v.type === 'calibrate').length, 0);
  for (let i = 0; i < 20; i++) p1.send({ ...shot, id: `burst-${i}` });
  await barrier(p1);
  // A host pong is an ordering barrier after the phone processed its burst.
  await barrier(host);
  const received = host.messages.filter(v => v.type === 'swing');
  assert.ok(received.length > 0 && received.length <= 8, `unbounded swing burst: ${received.length}`);
  for (const client of [host, p1, p2]) {
    assert.ok(!JSON.stringify(client.messages).includes(room.hostToken));
    for (const token of room.padTokens) assert.ok(!JSON.stringify(client.messages).includes(token));
    client.socket.close();
  }
});

test('checkpoint survives hibernation; replacement socket owns readiness and old close cannot clear it', async t => {
  runtime(t);
  const room = await create();
  let host = await connect(room.room, 'host', room.hostToken);
  const phone = await connect(room.room, 'p1', room.padTokens[0]);
  phone.send({ type: 'ready', ready: true });
  await host.next(v => v.type === 'presence' && v.ready[0]);
  host.send({ type: 'checkpoint', state: { scores: [3, 4], bracket: { round: 2 } } });
  await barrier(host);
  await mf.unsafeEvictDurableObject('arena-tests', 'ArenaRoom', { name: room.room, webSockets: 'hibernate' });
  phone.send({ ...shot, id: 'after-hibernation' });
  assert.equal((await host.next(v => v.type === 'swing')).player, 0);
  const replaced = new Promise(resolve => host.socket.addEventListener('close', resolve, { once: true }));
  host = await connect(room.room, 'host', room.hostToken);
  assert.deepEqual((await host.next(v => v.type === 'restore')).state, { scores: [3, 4], bracket: { round: 2 } });
  await replaced;
  const oldClosed = new Promise(resolve => phone.socket.addEventListener('close', resolve, { once: true }));
  const replacement = await connect(room.room, 'p1', room.padTokens[0]);
  replacement.send({ type: 'ready', ready: true });
  await host.next(v => v.type === 'presence' && v.ready[0]);
  await oldClosed;
  await barrier(replacement);
  host.messages.length = 0;
  const p2 = await connect(room.room, 'p2', room.padTokens[1]);
  assert.deepEqual((await host.next(v => v.type === 'presence' && v.pads[1])).ready, [true, false]);
  replacement.socket.close();
  assert.deepEqual((await host.next(v => v.type === 'presence' && !v.pads[0])).ready, [false, false]);
  host.socket.close(); p2.socket.close();
});

test('malformed and raw-motion messages are rejected; oversized and binary payloads close safely', async t => {
  runtime(t);
  const room = await create();
  const host = await connect(room.room, 'host', room.hostToken);
  for (const payload of ['{bad json', JSON.stringify({ type: 'motion', samples: [1, 2] })]) {
    host.socket.send(payload);
    await host.next(v => v.type === 'error');
  }
  const p1 = await connect(room.room, 'p1', room.padTokens[0]);
  const close = new Promise(resolve => p1.socket.addEventListener('close', resolve, { once: true }));
  p1.socket.send('x'.repeat(backend.MAX_MESSAGE_BYTES + 1));
  assert.equal((await close).code, 1009);
  const p2 = await connect(room.room, 'p2', room.padTokens[1]);
  const binaryClose = new Promise(resolve => p2.socket.addEventListener('close', resolve, { once: true }));
  p2.socket.send(new Uint8Array([1, 2, 3]));
  assert.equal((await binaryClose).code, 1003);
  host.socket.close();
});

// Fake clock/storage only for the 24h edge; connection/relay tests above use workerd.
test('expiry deletes persisted secrets/checkpoints and closes sockets, and an early alarm reschedules', async () => {
  assert.equal(typeof backend.ArenaRoom, 'function');
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  const record = { ...credentials, createdAt: now, expiresAt: now + 86_400_000 };
  const data = new Map([['room', record], ['checkpoint', { scores: [3, 4] }]]);
  let alarm = record.expiresAt, ready;
  const socket = { readyState: 1, deserializeAttachment: () => ({ role: 'p1', active: true, ready: true, connectionId: 'old' }), close(code) { this.readyState = 3; this.code = code; } };
  const state = { getWebSockets: () => [socket], blockConcurrencyWhile(fn) { return ready = fn(); }, storage: {
    async get(key) { return data.get(key); }, async setAlarm(value) { alarm = value; },
    async deleteAll() { data.clear(); }, async deleteAlarm() { alarm = null; },
  } };
  try {
    const room = new backend.ArenaRoom(state, {});
    await ready;
    await room.alarm();
    assert.equal(data.size, 2);
    assert.equal(alarm, record.expiresAt);
    now = record.expiresAt;
    await room.alarm();
    assert.equal(data.size, 0);
    assert.equal(alarm, null);
    assert.equal(socket.readyState, 3);
    assert.equal((await room.fetch(new Request(`${origin}/arena/api/rooms/${record.room}/ws`, { headers: { Origin: origin, Upgrade: 'websocket' } }))).status, 404);
  } finally { Date.now = realNow; }
});

test('long Unicode gesture IDs remain bounded in hibernation attachments', async () => {
  const realNow = Date.now;
  let now = 1_000_000, initialized;
  Date.now = () => now;
  let attachment = { role: 'p1', active: true, ready: false, connectionId: 'example', seen: [],
    swings: { tokens: 4, at: now }, messages: { tokens: 60, at: now } };
  const phone = { readyState: 1, deserializeAttachment: () => structuredClone(attachment),
    serializeAttachment(value) {
      assert.ok(serialize(value).byteLength <= 16384, 'attachment exceeds the runtime limit');
      attachment = structuredClone(value);
    } };
  const sent = [];
  const host = { readyState: 1, deserializeAttachment: () => ({ role: 'host', active: true }), send: value => sent.push(JSON.parse(value)) };
  const ctx = { getWebSockets: () => [phone, host], blockConcurrencyWhile(fn) { return initialized = fn(); },
    storage: { async get(key) { return key === 'room' ? { ...credentials, expiresAt: now + 86_400_000 } : undefined; } } };
  try {
    const room = new backend.ArenaRoom(ctx, {});
    await initialized;
    for (let i = 0; i < 90; i++) {
      now += 200;
      await room.webSocketMessage(phone, JSON.stringify({ ...shot, id: '🏓'.repeat(62) + i }));
    }
    assert.equal(sent.filter(v => v.type === 'swing').length, 90);
  } finally { Date.now = realNow; }
});

test('failed room creation never leaves credentials persisted without an expiry alarm', async () => {
  let initialized;
  const persisted = new Map();
  const storage = {
    async get(key) { return persisted.get(key); },
    async put(key, value) { persisted.set(key, value); },
    async setAlarm() { throw Error('alarm unavailable'); },
    async transaction(callback) {
      const draft = new Map(persisted);
      await callback({ async put(key, value) { draft.set(key, value); }, setAlarm: storage.setAlarm });
      for (const [key, value] of draft) persisted.set(key, value);
    },
  };
  const ctx = { storage, getWebSockets: () => [], blockConcurrencyWhile(fn) { return initialized = fn(); } };
  const room = new backend.ArenaRoom(ctx, {});
  await initialized;
  await assert.rejects(room.fetch(new Request('https://arena.internal/init', { method: 'POST',
    body: JSON.stringify({ ...credentials, createdAt: 1000, expiresAt: 86_401_000 }) })), /alarm unavailable/);
  assert.equal(persisted.size, 0, 'creation must roll back when cleanup cannot be scheduled');
  assert.equal((await room.fetch(new Request(`${origin}/arena/api/rooms/${credentials.room}/ws`, {
    headers: { Origin: origin, Upgrade: 'websocket' },
  }))).status, 404);
});

test('room status authenticates host credentials without replacing its socket', async()=>{
 const room=await create();
 const response=await mf.dispatchFetch(`${origin}/arena/api/rooms/${room.room}/status`,{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${room.hostToken}`}});
 assert.equal(response.status,200);assert.equal((await response.json()).alive,true);
 const denied=await mf.dispatchFetch(`${origin}/arena/api/rooms/${room.room}/status`,{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${room.padTokens[0]}`}});assert.equal(denied.status,403);
});
test('host receives a persistence acknowledgement only after saving checkpoint',async()=>{
 const room=await create(),host=await connect(room.room,'host',room.hostToken);
 host.send({type:'checkpoint',state:{version:1,savedAt:12345}});
 const ack=await host.next(m=>m.type==='checkpoint-saved');assert.equal(ack.savedAt,12345);host.socket.close();
});
test('room creation quota bounds each network and total daily allocation',()=>{assert.equal(typeof backend.consumeRoomQuota,'function');const state={};for(let i=0;i<6;i++)assert.equal(backend.consumeRoomQuota(state,1000,'a'),true);assert.equal(backend.consumeRoomQuota(state,1000,'a'),false);assert.equal(backend.consumeRoomQuota(state,62000,'a'),true);const all={};for(let i=0;i<120;i++)assert.equal(backend.consumeRoomQuota(all,1000,'ip'+i),true);assert.equal(backend.consumeRoomQuota(all,1000,'another'),false);assert.equal(backend.consumeRoomQuota(all,86401000,'another'),true);});
