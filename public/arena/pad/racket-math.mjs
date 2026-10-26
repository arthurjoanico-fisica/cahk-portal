// Small, original right-handed vector/quaternion operations; [x,y,z,w].
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = a => { const n = Math.hypot(...a); return a.map(v => v / n); };
export const inverse = q => [-q[0], -q[1], -q[2], q[3]];
export function multiply(a, b) {
  const v = cross(a, b);
  return [0, 1, 2].map(i => a[3] * b[i] + b[3] * a[i] + v[i]).concat(a[3] * b[3] - dot(a.slice(0, 3), b.slice(0, 3)));
}
export function rotate(q, v) {
  return multiply(multiply(q, [...v, 0]), inverse(q)).slice(0, 3);
}
export function continuous(q, previous) {
  return previous && dot(q, previous) < 0 ? q.map(v => -v) : q;
}
export function orientationQuaternion({ alpha, beta, gamma }) {
  const half = Math.PI / 360;
  const z = [0, 0, Math.sin(alpha * half), Math.cos(alpha * half)];
  const x = [Math.sin(beta * half), 0, 0, Math.cos(beta * half)];
  const y = [0, Math.sin(gamma * half), 0, Math.cos(gamma * half)];
  // DeviceOrientation intrinsic Z-X-Y; alpha wrap disappears in SO(3).
  return unit(multiply(multiply(z, x), y));
}
export const angleBetween = (a, b) => 2 * Math.acos(clamp(Math.abs(dot(a, b)), 0, 1));

export function playerBasis(neutral) {
  // World gravity up = +Z. With the screen facing the player, its projected
  // outward normal points toward the player: court-forward is its opposite.
  // A flat screen uses the phone's top edge instead (heading is ambiguous).
  // PLAYER axes: +X right, +Y up, -Z court-forward (right-handed).
  let forward = rotate(neutral, [0, 0, 1]);
  if (Math.hypot(forward[0], forward[1]) < 0.15) forward = rotate(neutral, [0, 1, 0]);
  const yaw = Math.atan2(forward[1], forward[0]) + Math.PI / 2;
  const z = [0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)];
  const x = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  return multiply(z, x);
}
