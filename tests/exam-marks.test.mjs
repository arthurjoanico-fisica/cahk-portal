import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/exam-marks/handler.js';
import { validateMark, InputError } from '../supabase/functions/exam-marks/core.js';

const NOW = Date.parse('2026-11-19T18:00:00Z');
const DEVICE = '3f2b8c1e-5a4d-4e6f-8b7a-9c0d1e2f3a4b';
const USER = '0b5f1a2c-3d4e-4f60-8a1b-2c3d4e5f6a7b';
const BASE = { action: 'submit', device: DEVICE, course_code: 'cf2402', course_title: 'Mecânica', professor: 'Fulano  de Tal', exam_kind: 'P1', exam_date: '2026-12-05', semester: '2026/2' };

function setup({ profile = { id: USER, nome: 'Ana', role: 'admin', ativo: true, permissions: [] }, rows = {} } = {}) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    const u = new URL(url); calls.push({ url: u.pathname + u.search, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers });
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (u.pathname === '/auth/v1/user') return init.headers.Authorization === 'Bearer good' ? json({ id: USER, email: 'a@b.c' }) : json({}, 401);
    if (u.pathname === '/rest/v1/profiles') return json(profile ? [profile] : []);
    if (u.pathname === '/rest/v1/portal_exam_marks' && (init.method || 'GET') === 'GET') {
      if (u.searchParams.has('ip_key')) return json(rows.ip || []);
      if (u.searchParams.has('client_key')) return json(rows.device || []);
      return json(rows.list || []);
    }
    return json([], 201);
  };
  const handler = createHandler({ url: 'https://p.supabase.co', serviceKey: 'service-secret', fetcher, now: () => NOW });
  const call = (body, headers = {}) => handler(new Request('https://f/', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  return { calls, call, handler };
}
const many = n => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

test('validação aceita marcação correta e normaliza o texto', () => {
  const m = validateMark(BASE, NOW);
  assert.equal(m.course_code, 'CF2402');
  assert.equal(m.professor, 'Fulano de Tal');
  assert.equal(m.exam_date, '2026-12-05');
});

test('validação recusa código, tipo e datas inválidas ou fora do período', () => {
  for (const patch of [{ course_code: 'X1' }, { professor: '  ' }, { exam_kind: 'P9' }, { exam_date: '2026-02-30' }, { exam_date: '05/12/2026' }, { exam_date: '2026-01-01' }, { exam_date: '2028-01-01' }]) {
    assert.throws(() => validateMark({ ...BASE, ...patch }, NOW), InputError, JSON.stringify(patch));
  }
});

test('envio grava com upsert e guarda só hashes do dispositivo e do IP', async () => {
  const { call, calls } = setup();
  const res = await call(BASE, { 'x-forwarded-for': '203.0.113.7' });
  assert.equal(res.status, 200);
  const post = calls.find(c => c.method === 'POST');
  assert.match(post.url, /on_conflict=client_key,course_code,professor,exam_kind,semester/);
  assert.equal(post.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.match(post.body.client_key, /^[0-9a-f]{64}$/);
  assert.match(post.body.ip_key, /^[0-9a-f]{64}$/);
  const serial = JSON.stringify(post.body);
  assert.ok(!serial.includes(DEVICE) && !serial.includes('203.0.113.7'));
  assert.equal(post.body.course_code, 'CF2402');
});

test('limite diário por navegador bloqueia antes de gravar', async () => {
  const { call, calls } = setup({ rows: { device: many(41) } });
  const res = await call(BASE);
  assert.equal(res.status, 429);
  assert.ok(!calls.some(c => c.method === 'POST'));
});

test('limite por IP bloqueia antes de gravar', async () => {
  const { call, calls } = setup({ rows: { ip: many(1001) } });
  assert.equal((await call(BASE)).status, 429);
  assert.ok(!calls.some(c => c.method === 'POST'));
});

test('campo isca preenchido e dados inválidos não gravam nada', async () => {
  const { call, calls } = setup();
  assert.equal((await call({ ...BASE, website: 'http://spam' })).status, 400);
  assert.equal((await call({ ...BASE, exam_date: 'xx' })).status, 400);
  assert.equal((await call({ ...BASE, device: 'abc' })).status, 400);
  assert.equal(calls.length, 0);
});

test('remover apaga só a marcação do próprio navegador', async () => {
  const { call, calls } = setup();
  const res = await call({ action: 'remove', device: DEVICE, course_code: 'CF2402', professor: 'Maria D\'Ávila', exam_kind: 'P1', semester: '2026/2' });
  assert.equal(res.status, 200);
  const del = calls.find(c => c.method === 'DELETE');
  assert.match(del.url, /client_key=eq\.[0-9a-f]{64}/);
  assert.match(del.url, /professor=eq\.Maria%20D(?:'|%27)%C3%81vila/);
  assert.match(del.url, /semester=eq\.2026%2F2/);
});

test('origem não autorizada é recusada e preflight responde', async () => {
  const { handler } = setup();
  const bad = await handler(new Request('https://f/', { method: 'POST', headers: { origin: 'https://outro.site' }, body: '{}' }));
  assert.equal(bad.status, 403);
  const pre = await handler(new Request('https://f/', { method: 'OPTIONS', headers: { origin: 'https://cahk.app' } }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://cahk.app');
});

test('listagem exige login de gestão com permissão', async () => {
  assert.equal((await setup().call({ action: 'list' })).status, 401);
  assert.equal((await setup().call({ action: 'list' }, { authorization: 'Bearer ruim' })).status, 401);
  const semPerm = setup({ profile: { id: USER, role: 'caixa', ativo: true, permissions: [] } });
  assert.equal((await semPerm.call({ action: 'list' }, { authorization: 'Bearer good' })).status, 403);
  const inativo = setup({ profile: { id: USER, role: 'admin', ativo: false, permissions: [] } });
  assert.equal((await inativo.call({ action: 'list' }, { authorization: 'Bearer good' })).status, 403);
});

test('listagem da gestão não expõe chaves de dispositivo ou IP', async () => {
  const { call, calls } = setup({ rows: { list: [{ id: 'a', course_code: 'CF2402' }] } });
  const res = await call({ action: 'list' }, { authorization: 'Bearer good' });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).items, [{ id: 'a', course_code: 'CF2402' }]);
  const get = calls.filter(c => c.url.startsWith('/rest/v1/portal_exam_marks')).at(-1);
  assert.ok(!/client_key|ip_key/.test(get.url));
  assert.match(get.url, /exam_date=gte\.2026-11-05/);
});

test('ocultar e excluir registram auditoria e perfil biblioteca tem acesso', async () => {
  const { call, calls } = setup({ profile: { id: USER, nome: 'Bia', role: 'biblioteca', ativo: true, permissions: [] } });
  const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  assert.equal((await call({ action: 'hide', id, hidden: true }, { authorization: 'Bearer good' })).status, 200);
  assert.equal((await call({ action: 'delete', id }, { authorization: 'Bearer good' })).status, 200);
  const logs = calls.filter(c => c.url === '/rest/v1/admin_audit_log').map(c => c.body.action);
  assert.deepEqual(logs, ['ocultar', 'excluir']);
  assert.equal((await call({ action: 'hide', id: 'x' }, { authorization: 'Bearer good' })).status, 400);
});
