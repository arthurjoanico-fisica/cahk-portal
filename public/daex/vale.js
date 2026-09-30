import { getValidSession } from './auth.js';
import * as api from './api.js';
import { normalizeVoucherToken } from './logic.js';

const token = normalizeVoucherToken(new URLSearchParams(location.search).get('t') || '');
const title = document.querySelector('#voucher-title');
const detail = document.querySelector('#voucher-detail');
const stateBox = document.querySelector('#voucher-state');
const consume = document.querySelector('#consume');
const back = document.querySelector('#back');
let voucher = null;
let profile = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}

async function init() {
  const session = await getValidSession();
  if (!session) {
    const next = `vale.html?t=${encodeURIComponent(token)}`;
    location.replace(`./?next=${encodeURIComponent(next)}`);
    return;
  }
  const profiles = await api.select('daex_profiles', { select: '*', id: `eq.${session.user.id}`, limit: 1 });
  profile = profiles?.[0];
  if (!profile?.ativo) {
    title.textContent = 'Sem acesso ao DAEX';
    return;
  }
  if (!token) {
    title.textContent = 'QR inválido';
    detail.textContent = 'Este vale não contém um token reconhecido.';
    return;
  }
  const rows = await api.select('daex_vales', { select: '*', token: `eq.${token}`, limit: 1 });
  voucher = rows?.[0];
  if (!voucher) {
    title.textContent = 'Vale não encontrado';
    detail.textContent = 'Confira o QR ou o token.';
    stateBox.innerHTML = '<div class="validation danger"><strong>INVÁLIDO</strong></div>';
    return;
  }
  title.textContent = voucher.produto_nome;
  detail.textContent = `Vale #${String(voucher.id).padStart(6,'0')}`;
  render();
}

function render() {
  const ok = voucher.status === 'emitido';
  stateBox.innerHTML = `<div class="validation ${ok ? 'success' : 'danger'}"><strong>${ok ? 'VALE DISPONÍVEL' : esc(voucher.status.toUpperCase())}</strong><span>${ok ? 'Pronto para consumo.' : 'Este vale não pode ser usado novamente.'}</span></div>`;
  consume.hidden = !(ok && ['admin','tesouraria','bar'].includes(profile.role));
}

consume.addEventListener('click', async () => {
  consume.disabled = true;
  consume.textContent = 'Validando...';
  try {
    await api.rpc('daex_validar_vale', { p_token: token });
    voucher.status = 'utilizado';
    render();
  } catch (error) {
    stateBox.innerHTML = `<div class="validation danger"><strong>NÃO VALIDADO</strong><span>${esc(error.message)}</span></div>`;
  } finally {
    consume.disabled = false;
    consume.textContent = 'Validar e consumir';
  }
});
back.addEventListener('click', () => location.href = './dashboard.html#vouchers');

init().catch(error => {
  title.textContent = 'Erro ao consultar vale';
  detail.textContent = error.message || 'Tente novamente.';
});
