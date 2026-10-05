export const MAX_IMAGE = 2 * 1024 * 1024;
export const MAX_BODY = 3 * MAX_IMAGE + 32 * 1024;
export const STATUSES = ['recebida', 'em_analise', 'encaminhada', 'encerrada'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class InputError extends Error {}
export function validateSubmission(text, key, images) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (value.length < 20 || value.length > 10000) throw new InputError('Escreva um relato entre 20 e 10.000 caracteres.');
  if (!UUID.test(String(key || ''))) throw new InputError('Identificador de envio inválido. Recarregue a página.');
  if (images.length > 3) throw new InputError('Anexe no máximo três imagens.');
  return { text: value, key: key.toLowerCase() };
}
export function validateImage(bytes, mime) {
  if (!bytes.length || bytes.length > MAX_IMAGE) throw new InputError('Cada imagem enviada deve ter até 2 MB.');
  if (mime !== 'image/jpeg' || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) {
    throw new InputError('Imagem inválida. Selecione novamente a imagem no formulário.');
  }
  return 'jpg';
}
// Remove JPEG APP/COM segments (including EXIF/GPS/XMP). The browser also re-encodes.
export function cleanJpeg(bytes) {
  const parts = [bytes.slice(0, 2)];
  let pos = 2;
  while (pos < bytes.length - 2) {
    if (bytes[pos] !== 255) throw new InputError('Imagem JPEG inválida.');
    const start = pos;
    while (bytes[pos] === 255) pos++;
    const marker = bytes[pos++];
    if (marker === 0xda) { parts.push(bytes.slice(start)); return join(parts); }
    if (marker === 0xd9 || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw new InputError('Imagem JPEG inválida.');
    const length = (bytes[pos] << 8) | bytes[pos + 1];
    if (length < 2 || pos + length > bytes.length - 2) throw new InputError('Imagem JPEG inválida.');
    pos += length;
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) parts.push(bytes.slice(start, pos));
  }
  throw new InputError('Imagem JPEG incompleta.');
}
function join(parts) { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; }
export async function digest(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function rateKey(secret, ip, slot) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${slot}:${ip}`));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
