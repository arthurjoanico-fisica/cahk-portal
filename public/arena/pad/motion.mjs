// All sensor processing stays on the phone. Only completed swings leave it.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const angleDelta = (value, baseline) => ((value - baseline + 540) % 360) - 180;
const axes = ['alpha', 'beta', 'gamma'];
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function normalizeSensitivity(value = 1) {
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? clamp(number, 0.6, 1.6) : 1;
}

export class MotionController {
  constructor({ sensitivity = 1 } = {}) {
    this.sensitivity = normalizeSensitivity(sensitivity);
    this.lastValidAt = null;
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
    this.still = null;
    this.lastShot = -Infinity;
    this.resetGesture();
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
    this.lastValidAt = now;
    this.lastTime = now;
    if (previous !== null && (dt <= 0 || dt > 120)) {
      this.resetGesture();
      this.lastTime = now;
      this.still = null;
      this.calibrationProgress = 0;
      return null;
    }
    const speed = Math.hypot(rate.alpha, rate.beta, rate.gamma);

    if (!this.calibrated) {
      if (speed > 12) {
        this.still = null;
        this.calibrationProgress = 0;
        return null;
      }
      if (!this.still || axes.some(axis => Math.abs(angleDelta(orientation[axis], this.still.anchor[axis])) > 3)) {
        this.still = { since: now, count: 0, anchor: { ...orientation }, sum: { alpha: 0, beta: 0, gamma: 0 } };
      }
      const still = this.still;
      still.count++;
      for (const axis of axes) still.sum[axis] += angleDelta(orientation[axis], still.anchor[axis]);
      this.calibrationProgress = clamp((now - still.since) / 700, 0, 1);
      if (now - still.since >= 700 && still.count >= 15) {
        this.neutral = Object.fromEntries(axes.map(axis => [axis, still.anchor[axis] + still.sum[axis] / still.count]));
        this.calibrated = true;
        this.restSince = now;
      }
      return null;
    }

    if (speed < 35) {
      this.arc = null;
      this.restSince ??= now;
      if (now - this.restSince >= 160 && now - this.lastShot >= 350) this.armed = true;
      return null;
    }
    this.restSince = null;
    if (!this.armed) return null;
    if (!this.arc) {
      if (speed < 100 / this.sensitivity) return null;
      this.arc = { start: now, peak: speed, turn: { alpha: 0, beta: 0, gamma: 0 } };
      return null;
    }
    const arc = this.arc;
    if (now - arc.start > 650) {
      this.armed = false;
      this.arc = null;
      return null;
    }
    arc.peak = Math.max(arc.peak, speed);
    // Signed integration requires real range of motion; vibration cancels out.
    for (const axis of axes) arc.turn[axis] += rate[axis] * dt / 1000;
    const range = Math.hypot(arc.turn.alpha, arc.turn.beta, arc.turn.gamma);
    if (now - arc.start < 70 || range < 22 / this.sensitivity || arc.peak < 180 / this.sensitivity) return null;

    this.armed = false;
    this.arc = null;
    this.lastShot = now;
    return {
      type: 'swing',
      power: clamp((arc.peak * this.sensitivity - 90) / 650, 0.08, 1),
      aim: clamp(angleDelta(orientation.gamma, this.neutral.gamma) / 40, -1, 1),
      lob: clamp((angleDelta(orientation.beta, this.neutral.beta) - 10) / 65, 0, 1),
      spin: clamp(rate.alpha / 600, -1, 1),
    };
  }
}
