import test from 'node:test';
import assert from 'node:assert/strict';

// The first RED run reports an assertion for the absent implementation.
const motion = await import('../public/arena/pad/motion.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const { MotionController, normalizeSensitivity } = motion;
const neutral = { alpha: 359, beta: 45, gamma: 8 };
const sample = (beta = 0, orientation = neutral, alpha = 0, gamma = 0) => ({
  rotationRate: { alpha, beta, gamma }, orientation,
});
function calibrated(sensitivity = 1) {
  const controller = new MotionController({ sensitivity });
  for (let t = 0; t <= 1000; t += 20) assert.equal(controller.sample(sample(), t), null);
  assert.equal(controller.calibrated, true);
  return controller;
}
function gesture(controller, { start = 1020, speed = 320, count = 12, orientation = neutral } = {}) {
  const shots = [];
  for (let i = 0; i < count; i++) {
    const shot = controller.sample(sample(speed, orientation, 100, 35), start + i * 20);
    if (shot) shots.push(shot);
  }
  return shots;
}

test('motion detector is available to the phone controller', () => {
  assert.equal(typeof MotionController, 'function');
  assert.equal(typeof normalizeSensitivity, 'function');
});

test('quiet readings and ordinary sensor noise never fire', () => {
  const c = calibrated();
  for (let t = 1020; t < 10000; t += 20) {
    assert.equal(c.sample(sample(Math.sin(t) * 9, neutral, Math.cos(t) * 7, 2), t), null);
  }
});

test('missing, nonnumeric and implausible readings never calibrate or fire', () => {
  for (const input of [null, {}, sample(null), sample(NaN), sample(Infinity), sample(4000),
    sample('320'), sample(0, null), sample(0, { alpha: 0, beta: null, gamma: 0 })]) {
    const c = new MotionController();
    for (let t = 0; t < 1500; t += 20) assert.equal(c.sample(input, t), null);
    assert.equal(c.calibrated, false);
  }
  const c = calibrated();
  for (const t of [NaN, Infinity, -1]) assert.equal(c.sample(sample(600), t), null);
});

test('calibration needs sustained stillness, is silent, and replaces the neutral baseline', () => {
  const c = new MotionController();
  assert.deepEqual(gesture(c, { start: 0 }), []);
  assert.equal(c.calibrated, false);
  for (let t = 300; t < 1400; t += 20) assert.equal(c.sample(sample(), t), null);
  assert.equal(c.calibrated, true);
  c.calibrate();
  assert.equal(c.calibrated, false);
  const nextNeutral = { alpha: 1, beta: 70, gamma: -30 };
  for (let t = 1400; t <= 2400; t += 20) assert.equal(c.sample(sample(0, nextNeutral), t), null);
  const [shot] = gesture(c, { start: 2420, orientation: nextNeutral });
  assert.ok(shot);
  assert.equal(shot.aim, 0);
  assert.equal(shot.lob, 0);
});

test('a sustained gyro arc emits one normalized shot and cannot repeat without rest', () => {
  const c = calibrated();
  const shots = gesture(c, { count: 25, orientation: { alpha: 1, beta: 85, gamma: 30 } });
  assert.equal(shots.length, 1);
  assert.equal(shots[0].type, 'swing');
  assert.ok(shots[0].power > 0.2);
  assert.ok(shots[0].aim > 0);
  assert.ok(shots[0].lob > 0);
  for (const [key, min, max] of [['power', 0, 1], ['aim', -1, 1], ['lob', 0, 1], ['spin', -1, 1]]) {
    assert.ok(Number.isFinite(shots[0][key]) && shots[0][key] >= min && shots[0][key] <= max);
  }
  for (let t = 1520; t <= 2000; t += 20) assert.equal(c.sample(sample(), t), null);
  assert.equal(gesture(c, { start: 2020 }).length, 1);
});

test('isolated spikes, slow movement and alternating vibration do not count as swings', () => {
  for (const pattern of [i => i === 4 ? 1400 : 0, () => 55, i => i % 2 ? -480 : 480]) {
    const c = calibrated();
    for (let i = 0; i < 80; i++) assert.equal(c.sample(sample(pattern(i)), 1020 + i * 20), null);
  }
});

test('gaps, reversed time and reset cannot join disconnected partial gestures', () => {
  const c = calibrated();
  assert.deepEqual(gesture(c, { count: 3 }), []);
  assert.equal(c.sample(sample(500), 2000), null);
  assert.equal(c.sample(sample(500), 1900), null);
  c.resetGesture();
  assert.equal(c.calibrated, true);
  assert.deepEqual(gesture(c, { start: 2020 }), []);
  for (let t = 2300; t <= 2700; t += 20) c.sample(sample(), t);
  assert.equal(gesture(c, { start: 2720 }).length, 1);
});

test('sensitivity is normalized to 0.6–1.6 and changes gesture detection', () => {
  for (const [value, expected] of [[-10, 0.6], [0.6, 0.6], [1, 1], [1.6, 1.6], [99, 1.6], [NaN, 1], [Infinity, 1], [undefined, 1], ['1.4', 1.4]]) {
    assert.equal(normalizeSensitivity(value), expected);
  }
  const low = calibrated(0.6), high = calibrated(1.6);
  assert.equal(gesture(low, { speed: 160, count: 9 }).length, 0);
  assert.equal(gesture(high, { speed: 160, count: 9 }).length, 1);
  high.setSensitivity(100);
  assert.equal(high.sensitivity, 1.6);
  high.setSensitivity(0.01);
  assert.equal(high.sensitivity, 0.6);
});

// Browser boundaries are doubled here: real controller + real motion detector,
// deterministic clock, and observable UI / wire packets. No hardware required.
const { createPad } = await import('../public/arena/pad/pad.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
function environment({ permission = 'granted', supported = true, url = 'https://cahk.test/arena/pad/?room=abc&player=1#token=secret' } = {}) {
  const ids = ['player-number', 'player-name', 'connection', 'connection-text', 'status-title', 'status-detail',
    'start', 'calibrate', 'sensitivity', 'sensitivity-value', 'manual-mode', 'manual-controls', 'manual-shot',
    'manual-aim', 'manual-lob', 'feedback', 'calibration-progress', 'mode-label', 'wake-note'];
  class Element extends EventTarget {
    constructor() { super(); this.value = '1'; this.hidden = false; this.disabled = false; this.textContent = ''; this.dataset = {}; this.style = { setProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {} }; }
    set textContent(value) { this.textWrites = (this.textWrites || 0) + 1; this.text = value; }
    get textContent() { return this.text; }
    setAttribute(name, value) { this[name] = value; }
    setPointerCapture() {}
  }
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const doc = new EventTarget();
  doc.hidden = false;
  doc.documentElement = new Element();
  doc.getElementById = id => { assert.ok(elements[id], `unexpected element ${id}`); return elements[id]; };
  const win = new EventTarget();
  let now = 0, sequence = 0;
  const timers = new Map(), sockets = [], permissions = [], wakes = [];
  win.location = new URL(url);
  win.isSecureContext = true;
  win.performance = { now: () => now };
  win.crypto = globalThis.crypto;
  win.navigator = { vibrate() {}, wakeLock: { request: async () => {
    const lock = new EventTarget(); lock.released = false;
    lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event('release')); };
    wakes.push(lock); return lock;
  } } };
  win.setTimeout = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; };
  win.clearTimeout = id => timers.delete(id);
  win.setInterval = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay, interval: delay }); return id; };
  win.clearInterval = win.clearTimeout;
  if (supported) {
    for (const name of ['DeviceMotionEvent', 'DeviceOrientationEvent']) {
      win[name] = class { static requestPermission() { permissions.push(name); return Promise.resolve(permission); } };
    }
  }
  win.WebSocket = class extends EventTarget {
    static OPEN = 1;
    constructor(url) { super(); this.url = String(url); this.readyState = 0; this.packets = []; sockets.push(this); }
    send(raw) { this.packets.push(JSON.parse(raw)); }
    open() { this.readyState = 1; this.dispatchEvent(new Event('open')); this.message({ type: 'presence', host: true, pads: [true, false], ready: [false, false] }); }
    message(data) { this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(data) })); }
    close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  };
  const fire = (target, type, props = {}) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), props));
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const advance = async ms => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, t] = next; now = t.at;
      if (t.interval) t.at += t.interval; else timers.delete(id);
      t.fn(); await settle();
    }
    now = end; await settle();
  };
  const readings = async (count = 55, speed = 0) => {
    for (let i = 0; i < count; i++) {
      await advance(20);
      fire(win, 'deviceorientation', neutral);
      fire(win, 'devicemotion', { rotationRate: { alpha: 0, beta: speed, gamma: 0 } });
    }
  };
  createPad({ window: win, document: doc });
  return { win, doc, elements, sockets, permissions, wakes, fire, settle, advance, readings };
}

test('phone asks BOTH iOS permissions on Start, calibrates, and sends only complete swings', async () => {
  assert.equal(typeof createPad, 'function');
  const e = environment(); const socket = e.sockets[0]; socket.open();
  assert.deepEqual(socket.packets, [{ type: 'ready', ready: false }]);
  e.fire(e.elements.start, 'click');
  assert.deepEqual(e.permissions, ['DeviceMotionEvent', 'DeviceOrientationEvent']);
  await e.settle(); await e.readings();
  assert.deepEqual(socket.packets.at(-1), { type: 'ready', ready: true });
  await e.readings(15, 360);
  const shots = socket.packets.filter(p => p.type === 'swing');
  assert.equal(shots.length, 1);
  assert.deepEqual(Object.keys(shots[0]).sort(), ['aim', 'id', 'lob', 'power', 'spin', 'type']);
  assert.ok(shots[0].id.length > 0);
  assert.equal(new URL(socket.url).pathname, '/arena/api/rooms/abc/ws');
  assert.equal(new URL(socket.url).searchParams.get('role'), 'p1');
  assert.equal(new URL(socket.url).searchParams.get('token'), 'secret');
});

test('denial, unsupported sensors and granted permission without real readings stay unready', async () => {
  for (const options of [{ permission: 'denied' }, { supported: false }, {}]) {
    const e = environment(options); e.sockets[0].open();
    e.fire(e.elements.start, 'click'); await e.settle(); await e.advance(6000);
    assert.ok(!e.sockets[0].packets.some(p => p.ready === true));
    assert.match(e.elements['status-detail'].textContent, options.permission ? /permiss/i : options.supported === false ? /suport|disponív/i : /leitura/i);
    e.fire(e.elements['manual-mode'], 'click'); await e.settle();
    assert.match(e.elements['mode-label'].textContent, /modo acessível/i);
    assert.deepEqual(e.sockets[0].packets.at(-1), { type: 'ready', ready: true });
    e.fire(e.elements['manual-shot'], 'click');
    assert.equal(e.sockets[0].packets.filter(p => p.type === 'swing').length, 1);
  }
});

test('sensor readiness survives reconnect but hidden and stale sensors pause the phone', async () => {
  const e = environment(); e.sockets[0].open(); e.fire(e.elements.start, 'click');
  await e.settle(); await e.readings();
  e.sockets[0].close(); await e.advance(600); e.sockets[1].open();
  assert.deepEqual(e.sockets[1].packets.at(-1), { type: 'ready', ready: true });
  e.doc.hidden = true; e.fire(e.doc, 'visibilitychange'); await e.settle();
  assert.deepEqual(e.sockets[1].packets.at(-1), { type: 'ready', ready: false });
  assert.equal(e.wakes.every(lock => lock.released), true);
  await e.advance(6000);
  assert.equal(e.sockets.length, 2);
  e.doc.hidden = false; e.fire(e.doc, 'visibilitychange');
  e.sockets.at(-1).open();
  assert.deepEqual(e.sockets.at(-1).packets.at(-1), { type: 'ready', ready: false });
  await e.readings(12);
  assert.deepEqual(e.sockets.at(-1).packets.at(-1), { type: 'ready', ready: true });
  await e.advance(6000);
  assert.deepEqual(e.sockets.at(-1).packets.at(-1), { type: 'ready', ready: false });
  assert.match(e.elements['status-detail'].textContent, /leitura/i);
});

test('server and held recalibration pause swings; feedback and accessible taps use the contract', async () => {
  const e = environment({ url: 'https://cahk.test/arena/pad/?room=abc&player=2#token=secret' });
  const socket = e.sockets[0]; socket.open(); e.fire(e.elements.start, 'click'); await e.settle(); await e.readings();
  assert.equal(new URL(socket.url).searchParams.get('role'), 'p2');
  socket.message({ type: 'calibrate' });
  assert.deepEqual(socket.packets.at(-1), { type: 'ready', ready: false });
  await e.readings(15, 360);
  assert.equal(socket.packets.filter(p => p.type === 'swing').length, 0);
  await e.readings();
  e.fire(e.elements.calibrate, 'pointerdown', { pointerId: 1, button: 0 });
  await e.advance(800);
  assert.deepEqual(socket.packets.at(-1), { type: 'ready', ready: false });
  socket.message({ type: 'feedback', event: 'hit', power: 0.7 });
  assert.match(e.elements.feedback.textContent, /acert|rebat/i);
  socket.message({ type: 'feedback', event: 'point', power: 1 });
  assert.match(e.elements.feedback.textContent, /ponto/i);
});

test('an invalid invitation never opens a socket or permits accessible shots', () => {
  for (const url of ['https://cahk.test/arena/pad/?room=abc&player=3#token=secret', 'https://cahk.test/arena/pad/?room=abc&player=1']) {
    const e = environment({ url });
    e.fire(e.elements['manual-mode'], 'click'); e.fire(e.elements['manual-shot'], 'click');
    assert.equal(e.sockets.length, 0);
    assert.equal(e.elements.start.disabled, true);
  }
});


test('steady sensor samples do not repeatedly announce unchanged status to screen readers', async () => {
  const e = environment(); e.sockets[0].open(); e.fire(e.elements.start, 'click');
  await e.settle(); await e.readings();
  const before = e.elements['status-detail'].textWrites;
  await e.readings(30);
  assert.equal(e.elements['status-detail'].textWrites, before);
});
