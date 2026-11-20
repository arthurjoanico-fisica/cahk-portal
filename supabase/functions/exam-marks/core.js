export const KINDS = ['P1', 'P2', 'P3', 'exame', 'trabalho', 'outra'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CODE = /^[A-Z]{2,4}\d{3,4}$/;
const DAY = 86400000;

export class InputError extends Error {}

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function validateDevice(value) {
  const device = String(value || '');
  if (!UUID.test(device)) throw new InputError('Identificador do navegador inválido. Recarregue a página.');
  return device.toLowerCase();
}

// Campos que identificam uma marcação (usados no envio e na remoção).
export function validateTarget(body) {
  const course_code = clean(body.course_code, 12).toUpperCase();
  const professor = clean(body.professor, 220);
  const exam_kind = clean(body.exam_kind, 20);
  const semester = clean(body.semester, 40);
  if (!CODE.test(course_code)) throw new InputError('Código da disciplina inválido.');
  if (!professor) throw new InputError('Informe o professor da disciplina.');
  if (!KINDS.includes(exam_kind)) throw new InputError('Tipo de prova inválido.');
  return { course_code, professor, exam_kind, semester };
}

export function validateMark(body, now = Date.now()) {
  const target = validateTarget(body);
  const exam_date = clean(body.exam_date, 10);
  const time = Date.parse(`${exam_date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exam_date) || Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== exam_date) {
    throw new InputError('Data inválida.');
  }
  if (time < now - 30 * DAY || time > now + 400 * DAY) throw new InputError('A data precisa estar entre 30 dias atrás e 400 dias à frente.');
  return { ...target, course_title: clean(body.course_title, 220) || null, exam_date };
}

export async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
