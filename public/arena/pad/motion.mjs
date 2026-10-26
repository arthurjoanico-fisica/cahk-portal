import { clamp, unit, inverse, multiply, rotate, continuous, orientationQuaternion, angleBetween, playerBasis } from './racket-math.mjs';

// All processing is local. Orientation and angular trajectory describe a virtual
// racket/arm, never absolute hand position. No accelerometer double integration.
const axes = ['alpha', 'beta', 'gamma'];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const degrees = 180 / Math.PI;

export function normalizeSensitivity(value = 1) {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? clamp(number, 0.6, 1.6) : 1;
}

export class MotionController {
  constructor({ sensitivity = 1 } = {}) {
    this.sensitivity = normalizeSensitivity(sensitivity);
    this.calibrate();
  }

  setSensitivity(value) {
    this.sensitivity = normalizeSensitivity(value);
    this.resetGesture();
  }

  resetGesture() {
    this.lastTime = null;
    this.restSince = null;
    this.armed = false;
    this.arc = null;
  }

  calibrate() {
    this.calibrated = false;
    this.calibrationProgress = 0;
    this.neutral = null;
    this.pose = null;
    this.basis = null;
    this.still = null;
    this.lastValidAt = null;
    this.lastShot = -Infinity;
    this.resetGesture();
  }

  getPose() { return this.pose ? [...this.pose] : null; }

  finishArc(now) {
    const arc = this.arc;
    this.arc = null;
    const range = Math.hypot(...arc.turn);
    // Signed displacement/coherence rejects vibration and reversals. Averaging
    // the whole stroke rejects noise without counting a filter's decay as travel.
    if (now - arc.start < 70 || range < 22 / this.sensitivity ||
        range < arc.travel * 0.65 || arc.peak < 180 / this.sensitivity) return null;
    this.armed = false;
    this.lastShot = now;
    const face = rotate(this.pose, [0, 0, -1]);
    const lateral = -arc.turn[1];
    const brush = arc.turn[0];
    const yaw = Math.atan2(face[0], -face[2]) * degrees;
    // With the screen facing the player and its top edge up, negative pitch
    // opens the near face for a lifting/backspin stroke. Pose itself stays in
    // the right-handed player frame; these signs describe the shot mapping.
    const opening = -Math.asin(clamp(face[1], -1, 1)) * degrees;
    // Stroke path dominates direction; opening the face adds loft and backspin.
    // Signed twist about court-forward is accumulated slice, not last alpha.
    return {
      type: 'swing',
      power: clamp(((arc.peak * this.sensitivity - 70) / 650) * (0.25 + 0.75 * clamp(range / 75, 0, 1)), 0.08, 1),
      aim: clamp(0.7 * lateral / 55 + 0.3 * yaw / 60, -1, 1),
      lob: clamp((-0.65 * brush + 0.35 * opening - 8) / 50, 0, 1),
      spin: clamp(-arc.turn[2] / 55, -1, 1),
      topspin: clamp((0.8 * brush - 0.2 * opening) / 55, -1, 1),
    };
  }

  sample(reading, now) {
    const rate = reading?.rotationRate;
    const orientation = reading?.orientation;
    if (!finite(now) || now < 0 || !rate || !orientation ||
        !axes.every(axis => finite(rate[axis]) && Math.abs(rate[axis]) <= 2000 && finite(orientation[axis])) ||
        Math.abs(orientation.beta) > 180 || Math.abs(orientation.gamma) > 90 ||
        orientation.alpha < 0 || orientation.alpha > 360) {
      this.resetGesture();
      this.still = null;
      this.calibrationProgress = 0;
      return null;
    }
    const previous = this.lastTime;
    const dt = previous === null ? 0 : now - previous;
    if (previous !== null && (dt <= 0 || dt > 120)) {
      this.resetGesture();
      this.lastTime = now;
      this.still = null;
      this.calibrationProgress = 0;
      return null;
    }
    this.lastValidAt = now;
    this.lastTime = now;
    const speed = Math.hypot(rate.alpha, rate.beta, rate.gamma);
    const world = orientationQuaternion(orientation);

    if (!this.calibrated) {
      if (speed > 12) {
        this.still = null;
        this.calibrationProgress = 0;
        return null;
      }
      if (!this.still || angleBetween(world, this.still.anchor) > 3 / degrees) {
        this.still = { since: now, count: 0, anchor: world, sum: [0, 0, 0, 0] };
      }
      const still = this.still;
      const aligned = continuous(world, still.anchor);
      still.count++;
      still.sum = still.sum.map((v, i) => v + aligned[i]);
      this.calibrationProgress = clamp((now - still.since) / 700, 0, 1);
      if (now - still.since >= 700 && still.count >= 8) {
        this.neutral = unit(still.sum);
        this.basis = playerBasis(this.neutral);
        this.pose = [0, 0, 0, 1];
        this.calibrated = true;
        this.restSince = now;
      }
      return null;
    }

    const worldToPlayer = inverse(this.basis);
    const relative = multiply(multiply(multiply(worldToPlayer, world), inverse(this.neutral)), this.basis);
    this.pose = continuous(unit(relative), this.pose);
    // DeviceMotion body axes: beta=X, gamma=Y, alpha=Z. Transform the vector,
    // rather than interpreting Euler derivatives as player-space angular rates.
    const angular = rotate(multiply(worldToPlayer, world), [rate.beta, rate.gamma, rate.alpha]);
    let shot = null;
    if (this.arc) {
      const arc = this.arc;
      arc.peak = Math.max(arc.peak, speed);
      arc.turn = arc.turn.map((v, i) => v + angular[i] * dt / 1000);
      arc.travel += speed * dt / 1000;
      // Emit at deceleration/end, or cap latency at 200 ms for ongoing strokes.
      // This preserves fast response while distinguishing a flick from an arc.
      if (speed < arc.peak * 0.55 || now - arc.start >= 200) shot = this.finishArc(now);
    }
    if (speed < 35) {
      this.restSince ??= now;
      if (now - this.restSince >= 160 && now - this.lastShot >= 350) this.armed = true;
      return shot;
    }
    this.restSince = null;
    if (!this.armed || this.arc || shot) return shot;
    if (speed >= 100 / this.sensitivity) {
      // A sensor sample represents this interval too. Dropping the trigger
      // sample loses substantial range on 20 Hz devices and short strokes.
      this.arc = { start: now, peak: speed,
        turn: angular.map(v => v * dt / 1000), travel: speed * dt / 1000 };
    }
    return null;
  }
}
