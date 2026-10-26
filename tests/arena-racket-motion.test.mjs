import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionController } from '../public/arena/pad/motion.mjs';

const radians = Math.PI / 180;
const base = { alpha: 0, beta: 45, gamma: 0 };
const reading = (orientation, rotationRate = { alpha: 0, beta: 0, gamma: 0 }) => ({ orientation, rotationRate });
function calibrated(neutral = base, step = 20) {
  const c = new MotionController();
  for (let t = 0; t <= 1000; t += step) c.sample(reading(neutral), t);
  assert.equal(c.calibrated, true);
  return c;
}
// Analytic Z-X-Y trace: differentiate the Euler rotations into BODY angular
// velocity (DeviceMotion beta=x, gamma=y, alpha=z), not Euler angle rates.
function trace(c, { neutral = base, delta = { alpha: 0, beta: 300, gamma: 0 }, duration = 220, step = 20 } = {}) {
  const shots = [];
  for (let elapsed = step; elapsed <= duration + 200; elapsed += step) {
    const active = elapsed <= duration;
    const seconds = Math.min(elapsed, duration) / 1000;
    const o = Object.fromEntries(['alpha', 'beta', 'gamma'].map(k => [k, neutral[k] + (delta[k] || 0) * seconds]));
    o.alpha = (o.alpha + 360) % 360;
    const b = o.beta * radians, g = o.gamma * radians;
    const aRate = active ? delta.alpha || 0 : 0;
    const bRate = active ? delta.beta || 0 : 0;
    const gRate = active ? delta.gamma || 0 : 0;
    const shot = c.sample(reading(o, {
      beta: bRate * Math.cos(g) - aRate * Math.sin(g) * Math.cos(b),
      gamma: gRate + aRate * Math.sin(b),
      alpha: bRate * Math.sin(g) + aRate * Math.cos(g) * Math.cos(b),
    }), 1000 + elapsed);
    if (shot) shots.push(shot);
  }
  return shots;
}
function one(options) {
  const shots = trace(calibrated(options?.neutral), options);
  assert.equal(shots.length, 1);
  for (const [key, lo, hi] of [['power', 0, 1], ['aim', -1, 1], ['lob', 0, 1], ['spin', -1, 1], ['topspin', -1, 1]]) {
    assert.ok(Number.isFinite(shots[0][key]) && shots[0][key] >= lo && shots[0][key] <= hi, key);
  }
  return shots[0];
}

test('pose is null before calibration and neutral grips become identity', () => {
  const c = new MotionController();
  assert.equal(typeof c.getPose, 'function');
  assert.equal(c.getPose(), null);
  for (const grip of [base, { alpha: 359, beta: 85, gamma: -25 }, { alpha: 125, beta: -50, gamma: 30 }, { alpha: 90, beta: 0, gamma: 0 }]) {
    const q = calibrated(grip).getPose();
    assert.ok(Math.hypot(q[0], q[1], q[2]) < 1e-6);
    assert.ok(Math.abs(q[3] - 1) < 1e-6);
  }
  c.calibrate();
  assert.equal(c.getPose(), null);
});

test('player yaw is about gravity up, continuous over alpha wrap, with no shot from pose alone', () => {
  for (const grip of [base, { alpha: 359, beta: 70, gamma: 20 }, { alpha: 65, beta: -55, gamma: -20 }]) {
    const c = calibrated(grip);
    let previous = c.getPose();
    for (let angle = 1; angle <= 60; angle++) {
      assert.equal(c.sample(reading({ ...grip, alpha: (grip.alpha + angle) % 360 }), 1000 + angle * 20), null);
      const q = c.getPose();
      assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-6);
      assert.ok(q.reduce((sum, x, i) => sum + x * previous[i], 0) > 0.999);
      previous = q;
    }
    assert.ok(Math.abs(previous[1] - 0.5) < 0.02, '60 degree yaw in PLAYER up axis');
    assert.ok(Math.abs(previous[0]) < 0.02 && Math.abs(previous[2]) < 0.02);
    const copy = c.getPose(); copy[0] = NaN;
    assert.ok(c.getPose().every(Number.isFinite));
  }
});

test('opposed lateral paths aim oppositely with the same neutral grip', () => {
  const left = one({ delta: { alpha: 300 } });
  const right = one({ delta: { alpha: -300 } });
  assert.ok(left.aim < -0.15);
  assert.ok(right.aim > 0.15);
});

test('opposed accumulated cuts retain opposite slice even when the last gyro sample is zero', () => {
  const a = one({ delta: { beta: 230, gamma: 220 }, duration: 160 });
  const b = one({ delta: { beta: 230, gamma: -220 }, duration: 160 });
  assert.ok(Math.abs(a.spin) > 0.1 && Math.abs(b.spin) > 0.1);
  assert.ok(a.spin * b.spin < 0);
});

test('vertical brush paths produce opposed topspin/backspin and lift changes lob', () => {
  const a = one({ delta: { beta: 300 }, duration: 160 });
  const b = one({ delta: { beta: -300 }, duration: 160 });
  assert.ok(a.topspin > 0.1, 'positive beta brush gives topspin');
  assert.ok(b.topspin < -0.1, 'negative beta lifting brush gives backspin');
  assert.ok(b.lob > a.lob + 0.15);
});

test('same peak speed gives a wide arc more power than a short wrist flick', () => {
  const short = one({ duration: 100 });
  const wide = one({ duration: 220 });
  assert.ok(wide.power > short.power + 0.12, `${wide.power} vs ${short.power}`);
  assert.ok(one({ delta: { beta: 450 }, duration: 220 }).power > wide.power);
});

test('the same physical arc has comparable power at 20 Hz and 50 Hz', () => {
  const fastSamples = one({ duration: 200, step: 20 });
  const slowSamples = one({ duration: 200, step: 50 });
  assert.ok(Math.abs(fastSamples.power - slowSamples.power) < 0.05,
    `${fastSamples.power} vs ${slowSamples.power}`);
  assert.ok(Math.abs(fastSamples.topspin - slowSamples.topspin) < 0.1);
});

test('low-rate traces stay usable; gaps and invalid samples cannot complete a partial stroke', () => {
  assert.equal(trace(calibrated(base, 50), { step: 50, duration: 200 }).length, 1);
  for (const invalid of [reading(base, { alpha: NaN, beta: 300, gamma: 0 }), null]) {
    const c = calibrated();
    c.sample(reading(base, { alpha: 0, beta: 300, gamma: 0 }), 1020);
    c.sample(reading(base, { alpha: 0, beta: 300, gamma: 0 }), 1040);
    assert.equal(c.sample(invalid, 1060), null);
    for (let t = 1080; t <= 1400; t += 20) assert.equal(c.sample(reading(base, { alpha: 0, beta: 300, gamma: 0 }), t), null);
    assert.ok(c.getPose().every(Number.isFinite));
  }
  const c = calibrated();
  c.sample(reading(base, { alpha: 0, beta: 300, gamma: 0 }), 1020);
  assert.equal(c.sample(reading(base, { alpha: 0, beta: 300, gamma: 0 }), 1500), null);
  assert.equal(c.sample(reading(base), 1520), null);
});

test('wrap during still calibration averages rotations rather than 359 and 1 into 180', () => {
  const c = new MotionController();
  for (let t = 0; t <= 1000; t += 20) c.sample(reading({ ...base, alpha: t % 40 ? 1 : 359 }), t);
  assert.equal(c.calibrated, true);
  assert.ok(Math.abs(c.getPose()[1]) < 0.025);
});
