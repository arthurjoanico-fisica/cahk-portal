import { getValidSession, signOut } from './auth.js';
import * as api from './api.js';
import { cartTotals, financialSummary, distributeProfit, normalizeVoucherToken, csvEscape } from './logic.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR');
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const state = {
  session: null,
  user: null,
  profile: null,
  events: [],
  entities: [],
  selectedEventId: localStorage.getItem('daex-selected-event') || '',
  eventEntities: [],
  contributions: [],
  expenses: [],
  products: [],
  registers: [],
  sales: [],
  saleItems: [],
  vouchers: [],
  stockMovements: [],
  cart: new Map(),
  lastVouchers: [],
  scannerStream: null,
};

const routeTitles = {
  overview: 'Visão geral', events: 'Eventos', entities: 'Entidades & Aportes', stock: 'Produtos & Estoque',
  pdv: 'PDV', vouchers: 'Vales', finance: 'Financeiro', reports: 'Relatórios',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function fmtMoney(value) { return money.format(Number(value || 0)); }
function fmtDate(value) { return value ? dateFmt.format(new Date(`${value}T12:00:00`)) : '—'; }
function fmtDateTime(value) { return value ? dateTimeFmt.format(new Date(value)) : '—'; }
function roleLabel(role) { return ({ admin: 'Administrador', tesouraria: 'Tesouraria', caixa: 'Caixa', bar: 'Bar' })[role] || role || '—'; }
function selectedEvent() { return state.events.find(e => e.id === state.selectedEventId) || null; }
function currentRegister() { return state.registers.find(c => c.status === 'aberto' && c.aberto_por === state.user?.id) || null; }
function isFinanceRole() { return ['admin', 'tesouraria'].includes(state.profile?.role); }
function isAdmin() { return state.profile?.role === 'admin'; }
function canSell() { return ['admin', 'tesouraria', 'caixa'].includes(state.profile?.role); }
function canValidateVoucher() { return ['admin', 'tesouraria', 'bar'].includes(state.profile?.role); }
function eventRequired() {
  if (!selectedEvent()) { toast('Selecione ou crie um evento primeiro.', 'warning'); return false; }
  return true;
}
function toast(message, type = 'success') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3800);
}
function setBusy(form, busy) {
  $$('button,input,select,textarea', form).forEach(el => el.disabled = busy);
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function goRoute(route) {
  if (!routeTitles[route]) route = 'overview';
  $$('.route').forEach(el => el.classList.toggle('active', el.id === `route-${route}`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  $('#page-title').textContent = routeTitles[route];
  history.replaceState(null, '', `#${route}`);
  if (route === 'reports') renderReports();
}

function errorMessage(error) {
  const raw = error?.message || 'Ocorreu um erro.';
  return raw.replace(/^PGRST\d+:/, '').trim();
}

async function bootstrap() {
  state.session = await getValidSession();
  if (!state.session) return location.replace('./');
  state.user = state.session.user;

  const profiles = await api.select('daex_profiles', { select: '*', id: `eq.${state.user.id}`, limit: 1 });
  state.profile = profiles?.[0];
  if (!state.profile?.ativo) {
    signOut();
    alert('Esta conta não possui acesso ativo ao DAEX.');
    return location.replace('./');
  }

  $('#user-name').textContent = state.profile.nome;
  $('#user-role').textContent = roleLabel(state.profile.role);
  $('#printer-width').value = localStorage.getItem('daex-printer-width') || '58';

  applyRoleVisibility();
  await loadBaseData();
  bindEvents();
  goRoute((location.hash || '#overview').slice(1));
  updatePendingCount();
}

function applyRoleVisibility() {
  if (!isFinanceRole()) {
    $$('[data-route="entities"],[data-route="finance"],[data-route="reports"]').forEach(el => el.hidden = true);
  }
  if (!canSell()) $('[data-route="pdv"]').hidden = true;
  if (!canValidateVoucher()) $('[data-route="vouchers"]').hidden = true;
  if (!isFinanceRole()) $('[data-route="stock"]').hidden = true;
}

async function loadBaseData() {
  const [events, entities] = await Promise.all([
    api.select('daex_eventos', { select: '*', order: 'data_evento.desc,created_at.desc' }),
    api.select('daex_entidades', { select: '*', order: 'sigla.asc' }),
  ]);
  state.events = events || [];
  state.entities = entities || [];

  if (!state.selectedEventId || !state.events.some(e => e.id === state.selectedEventId)) {
    state.selectedEventId = state.events.find(e => e.status === 'aberto')?.id || state.events[0]?.id || '';
  }
  localStorage.setItem('daex-selected-event', state.selectedEventId);
  renderEventSelect();
  await loadEventData();
}

async function loadEventData() {
  if (!state.selectedEventId) {
    Object.assign(state, { eventEntities: [], contributions: [], expenses: [], products: [], registers: [], sales: [], saleItems: [], vouchers: [], stockMovements: [] });
    renderAll();
    return;
  }
  const id = state.selectedEventId;
  const queries = [
    api.select('daex_evento_entidades', { select: '*', evento_id: `eq.${id}`, order: 'created_at.asc' }),
    isFinanceRole() ? api.select('daex_aportes', { select: '*', evento_id: `eq.${id}`, order: 'created_at.desc' }) : Promise.resolve([]),
    isFinanceRole() ? api.select('daex_despesas', { select: '*', evento_id: `eq.${id}`, order: 'created_at.desc' }) : Promise.resolve([]),
    api.select('daex_produtos', { select: '*', evento_id: `eq.${id}`, order: 'nome.asc' }),
    api.select('daex_caixas', { select: '*', evento_id: `eq.${id}`, order: 'aberto_em.desc' }),
    canSell() || isFinanceRole() ? api.select('daex_vendas', { select: '*', evento_id: `eq.${id}`, order: 'created_at.desc', limit: 5000 }) : Promise.resolve([]),
    api.select('daex_vales', { select: '*', evento_id: `eq.${id}`, order: 'id.desc', limit: 5000 }),
    isFinanceRole() ? api.select('daex_estoque_movimentos', { select: '*', evento_id: `eq.${id}`, order: 'created_at.desc', limit: 5000 }) : Promise.resolve([]),
  ];
  const [eventEntities, contributions, expenses, products, registers, sales, vouchers, stockMovements] = await Promise.all(queries);
  Object.assign(state, { eventEntities, contributions, expenses, products, registers, sales, vouchers, stockMovements });

  const saleIds = state.sales.map(s => s.id);
  state.saleItems = saleIds.length && isFinanceRole()
    ? await api.select('daex_venda_itens', { select: '*', venda_id: `in.(${saleIds.join(',')})`, order: 'id.asc' })
    : [];
  renderAll();
}

function renderAll() {
  renderEventSelect();
  renderOverview();
  renderEvents();
  renderEntityOptions();
  renderParticipants();
  renderContributions();
  renderProductOptions();
  renderProducts();
  renderStockMovements();
  renderPDV();
  renderVouchers();
  renderFinance();
  renderReports();
}

function renderEventSelect() {
  const sel = $('#event-select');
  sel.innerHTML = state.events.length
    ? state.events.map(e => `<option value="${e.id}" ${e.id === state.selectedEventId ? 'selected' : ''}>${esc(e.nome)} • ${esc(e.status)}</option>`).join('')
    : '<option value="">Nenhum evento</option>';
}

function metricCard(label, value, hint = '') {
  return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
}

function summary() {
  return financialSummary({
    sales: state.sales,
    expenses: state.expenses,
    contributions: state.contributions,
    products: state.products,
    openingFund: selectedEvent()?.fundo_troco || 0,
  });
}

function renderOverview() {
  const ev = selectedEvent();
  const s = summary();
  const pendingVouchers = state.vouchers.filter(v => v.status === 'emitido').length;
  $('#overview-metrics').innerHTML = [
    metricCard('Vendas', fmtMoney(s.salesTotal)),
    metricCard('Resultado econômico', fmtMoney(s.result), 'vendas − CMV − despesas'),
    metricCard('Estoque a custo', fmtMoney(s.inventoryValue)),
    metricCard('Vales pendentes', String(pendingVouchers)),
  ].join('');

  if (!ev) {
    $('#event-summary').innerHTML = '<div class="empty-state">Crie seu primeiro evento na aba Eventos.</div>';
  } else {
    const reg = currentRegister();
    $('#event-summary').innerHTML = `
      <div class="summary-lines">
        <div><span>Evento</span><strong>${esc(ev.nome)}</strong></div>
        <div><span>Data</span><strong>${fmtDate(ev.data_evento)}</strong></div>
        <div><span>Status</span><strong><span class="badge ${ev.status}">${esc(ev.status)}</span></strong></div>
        <div><span>Caixa desta sessão</span><strong>${reg ? `Aberto • ${fmtMoney(reg.saldo_inicial)}` : 'Fechado'}</strong></div>
      </div>`;
  }
  renderRecentSales();
}

function renderRecentSales() {
  const rows = state.sales.slice(0, 10).map(s => `
    <tr><td>#${s.id}</td><td>${fmtDateTime(s.created_at)}</td><td>${esc(s.tipo_pagamento)}</td><td>${fmtMoney(s.total)}</td><td><span class="badge ${s.status}">${esc(s.status)}</span></td>
    ${isFinanceRole() ? `<td>${s.status === 'concluida' ? `<button class="link danger-text" data-action="cancel-sale" data-id="${s.id}">Cancelar</button>` : ''}</td>` : ''}</tr>`).join('');
  $('#recent-sales').innerHTML = state.sales.length ? `
    <table><thead><tr><th>Venda</th><th>Data</th><th>Pagamento</th><th>Total</th><th>Status</th>${isFinanceRole() ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-state">Nenhuma venda registrada.</div>';
}

function renderEvents() {
  $('#events-list').innerHTML = state.events.length ? state.events.map(e => `
    <div class="list-card ${e.id === state.selectedEventId ? 'selected' : ''}">
      <div><strong>${esc(e.nome)}</strong><span>${fmtDate(e.data_evento)} • ${esc(e.local || 'Sem local')}</span></div>
      <div class="list-actions"><span class="badge ${e.status}">${esc(e.status)}</span>
        <button class="btn tiny subtle" data-action="select-event" data-id="${e.id}">Usar</button>
        ${isFinanceRole() && e.status === 'rascunho' ? `<button class="btn tiny primary" data-action="open-event" data-id="${e.id}">Abrir</button>` : ''}
        ${isFinanceRole() && e.status === 'aberto' ? `<button class="btn tiny danger" data-action="close-event" data-id="${e.id}">Fechar</button>` : ''}
      </div>
    </div>`).join('') : '<div class="empty-state">Nenhum evento criado.</div>';
}

function renderEntityOptions() {
  const options = state.entities.filter(e => e.ativo).map(e => `<option value="${e.id}">${esc(e.sigla)} — ${esc(e.nome)}</option>`).join('');
  $('#participant-entity').innerHTML = options || '<option value="">Cadastre uma entidade</option>';
  $('#contribution-entity').innerHTML = options || '<option value="">Cadastre uma entidade</option>';
}
function entityName(id) { const e = state.entities.find(x => x.id === id); return e ? `${e.sigla} — ${e.nome}` : 'Entidade'; }

function renderParticipants() {
  $('#participants-list').innerHTML = state.eventEntities.length ? state.eventEntities.map(p => `
    <div class="mini-row"><span>${esc(entityName(p.entidade_id))}${p.percentual_rateio != null ? ` • ${Number(p.percentual_rateio).toFixed(2)}%` : ''}</span><button class="link danger-text" data-action="remove-participant" data-id="${p.id}">remover</button></div>`).join('') : '<div class="empty-state small">Nenhuma entidade vinculada.</div>';
}

function renderContributions() {
  const rows = state.contributions.map(c => `<tr><td>${fmtDateTime(c.created_at)}</td><td>${esc(entityName(c.entidade_id))}</td><td>${fmtMoney(c.valor)}</td><td>${esc(c.forma_pagamento)}</td><td>${esc(c.observacao || '')}</td><td><button class="link danger-text" data-action="delete-contribution" data-id="${c.id}">Excluir</button></td></tr>`).join('');
  $('#contributions-table').innerHTML = rows ? `<table><thead><tr><th>Data</th><th>Entidade</th><th>Valor</th><th>Forma</th><th>Obs.</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-state">Nenhum aporte.</div>';
}

function renderProductOptions() {
  $('#stock-product').innerHTML = state.products.map(p => `<option value="${p.id}">${esc(p.nome)} • estoque ${p.estoque_atual}</option>`).join('') || '<option value="">Cadastre um produto</option>';
}

function renderProducts() {
  const rows = state.products.map(p => `<tr><td><strong>${esc(p.nome)}</strong><br><small>${esc(p.categoria || '')}</small></td><td>${fmtMoney(p.preco_venda)}</td><td>${fmtMoney(p.preco_custo)}</td><td>${p.estoque_atual}</td><td>${p.emitir_vale ? 'Sim' : 'Não'}</td><td><span class="badge ${p.ativo ? 'aberto' : 'cancelada'}">${p.ativo ? 'ativo' : 'inativo'}</span></td><td><button class="link" data-action="toggle-product" data-id="${p.id}">${p.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>`).join('');
  $('#products-table').innerHTML = rows ? `<table><thead><tr><th>Produto</th><th>Venda</th><th>Custo</th><th>Estoque</th><th>Vale</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-state">Nenhum produto cadastrado.</div>';
}

function renderStockMovements() {
  const target = $('#stock-movements-table');
  if (!target) return;
  const rows = state.stockMovements.slice(0, 300).map(m => {
    const product = state.products.find(p => p.id === m.produto_id);
    return `<tr><td>${fmtDateTime(m.created_at)}</td><td>${esc(product?.nome || 'Produto')}</td><td>${esc(m.tipo)}</td><td>${m.quantidade > 0 ? '+' : ''}${m.quantidade}</td><td>${m.estoque_anterior} → ${m.estoque_novo}</td><td>${m.custo_unitario != null ? fmtMoney(m.custo_unitario) : '—'}</td><td>${esc(m.motivo || '')}</td></tr>`;
  }).join('');
  target.innerHTML = rows ? `<table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Saldo</th><th>Custo</th><th>Motivo</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-state">Nenhuma movimentação de estoque.</div>';
}

function filteredProducts() {
  const term = $('#product-search')?.value?.trim().toLowerCase() || '';
  return state.products.filter(p => p.ativo && p.estoque_atual > 0 && (!term || `${p.nome} ${p.categoria || ''}`.toLowerCase().includes(term)));
}

function renderPDV() {
  const grid = $('#product-grid');
  if (!grid) return;
  const ev = selectedEvent();
  const products = filteredProducts();
  grid.innerHTML = !ev ? '<div class="empty-state">Selecione um evento.</div>' : ev.status !== 'aberto' ? '<div class="empty-state">O evento precisa estar aberto para vender.</div>' : products.length ? products.map(p => `
    <button class="product-card" data-action="add-cart" data-id="${p.id}">
      <span>${esc(p.categoria || 'Produto')}</span><strong>${esc(p.nome)}</strong><b>${fmtMoney(p.preco_venda)}</b><small>${p.estoque_atual} disponíveis${p.emitir_vale ? ' • gera vale' : ''}</small>
    </button>`).join('') : '<div class="empty-state">Sem produtos disponíveis.</div>';
  renderCart();
  renderRegisterBox();
}

function cartArray() {
  return [...state.cart.values()].map(x => ({ ...x }));
}
function renderCart() {
  const items = cartArray();
  const totals = cartTotals(items);
  $('#cart-caption').textContent = `${totals.items} ${totals.items === 1 ? 'item' : 'itens'}`;
  $('#cart-total').textContent = fmtMoney(totals.total);
  $('#cart-list').innerHTML = items.length ? items.map(item => `
    <div class="cart-row"><div><strong>${esc(item.name)}</strong><span>${fmtMoney(item.price)} × ${item.quantity}</span></div><div class="qty"><button data-action="cart-minus" data-id="${item.id}">−</button><b>${item.quantity}</b><button data-action="cart-plus" data-id="${item.id}">+</button></div></div>`).join('') : '<div class="empty-state small">Carrinho vazio.</div>';
  $('#checkout').disabled = !items.length || !currentRegister() || selectedEvent()?.status !== 'aberto';
}

function renderRegisterBox() {
  const box = $('#register-box');
  const reg = currentRegister();
  if (!selectedEvent()) return box.innerHTML = '<div class="empty-state small">Selecione um evento.</div>';
  if (reg) {
    box.innerHTML = `<div class="register-open"><span>Caixa aberto</span><strong>${esc(reg.nome)} • ${fmtMoney(reg.saldo_inicial)}</strong><button class="link" data-action="close-register" data-id="${reg.id}">Fechar caixa</button></div>`;
  } else {
    box.innerHTML = `<div class="register-open"><span>Caixa fechado</span><div class="inline-fields"><input id="open-register-name" placeholder="Caixa 1" value="Caixa 1" /><input id="open-register-value" type="number" min="0" step="0.01" placeholder="Troco" value="${Number(selectedEvent()?.fundo_troco || 0)}" /></div><button class="btn subtle full" data-action="open-register">Abrir caixa</button></div>`;
  }
  renderCart();
}

function renderVouchers() {
  const term = $('#voucher-search')?.value?.trim().toLowerCase() || '';
  const list = state.vouchers.filter(v => !term || `${v.id} ${v.produto_nome} ${v.status}`.toLowerCase().includes(term)).slice(0, 300);
  const rows = list.map(v => `<tr><td>#${String(v.id).padStart(6, '0')}</td><td>${esc(v.produto_nome)}</td><td>${fmtDateTime(v.emitido_em)}</td><td><span class="badge ${v.status}">${esc(v.status)}</span></td><td><button class="link" data-action="print-voucher" data-id="${v.id}">Imprimir</button></td></tr>`).join('');
  $('#vouchers-table').innerHTML = rows ? `<table><thead><tr><th>Código</th><th>Produto</th><th>Emissão</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-state">Nenhum vale.</div>';
}

function renderFinance() {
  const s = summary();
  $('#finance-summary').innerHTML = [
    metricCard('Aportes', fmtMoney(state.contributions.reduce((x,c) => x + Number(c.valor || 0), 0))),
    metricCard('Despesas', fmtMoney(s.expensesTotal)),
    metricCard('CMV', fmtMoney(s.cogs)),
    metricCard('Resultado', fmtMoney(s.result)),
  ].join('');
  const rows = state.expenses.map(e => `<tr><td>${fmtDateTime(e.created_at)}</td><td>${esc(e.categoria)}</td><td>${esc(e.descricao)}</td><td>${fmtMoney(e.valor)}</td><td>${esc(e.forma_pagamento)}</td><td><span class="badge ${e.status}">${esc(e.status)}</span></td><td>${e.status === 'confirmada' ? `<button class="link danger-text" data-action="cancel-expense" data-id="${e.id}">Cancelar</button>` : ''}</td></tr>`).join('');
  $('#expenses-table').innerHTML = rows ? `<table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Forma</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-state">Nenhuma despesa.</div>';
}

function participantRows() {
  return state.eventEntities.map(link => ({
    entityId: link.entidade_id,
    name: entityName(link.entidade_id),
    customPercent: Number(link.percentual_rateio || 0),
    contribution: state.contributions.filter(c => c.entidade_id === link.entidade_id).reduce((s,c) => s + Number(c.valor || 0), 0),
  }));
}

function renderReports() {
  const ev = selectedEvent();
  const s = summary();
  $('#report-event-name').textContent = ev ? `${ev.nome} • ${fmtDate(ev.data_evento)}` : 'Selecione um evento.';
  const closedCash = state.registers.filter(r => r.status === 'fechado' && r.saldo_final_informado != null).reduce((sum,r) => sum + Number(r.saldo_final_informado || 0), 0);
  const totalContributions = state.contributions.reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const stockPurchases = state.stockMovements
    .filter(m => m.tipo === 'entrada' && Number(m.quantidade) > 0 && m.custo_unitario != null)
    .reduce((sum, m) => sum + Number(m.quantidade || 0) * Number(m.custo_unitario || 0), 0);
  $('#report-metrics').innerHTML = [
    metricCard('Aportes', fmtMoney(totalContributions)),
    metricCard('Fundo de troco', fmtMoney(ev?.fundo_troco || 0)),
    metricCard('Vendas', fmtMoney(s.salesTotal)),
    metricCard('Despesas operacionais', fmtMoney(s.expensesTotal)),
    metricCard('Compras de estoque', fmtMoney(stockPurchases)),
    metricCard('CMV', fmtMoney(s.cogs)),
    metricCard('Estoque remanescente', fmtMoney(s.inventoryValue)),
    metricCard('Caixa estimado', fmtMoney(s.cashBalanceEstimated)),
    metricCard('Caixa informado', fmtMoney(closedCash)),
    metricCard('Resultado econômico', fmtMoney(s.result)),
  ].join('');
  $('#payment-breakdown').innerHTML = Object.entries(s.byPayment).length ? Object.entries(s.byPayment).map(([k,v]) => `<div class="summary-line"><span>${esc(k)}</span><strong>${fmtMoney(v)}</strong></div>`).join('') : '<div class="empty-state small">Sem vendas.</div>';

  const participants = participantRows();
  let distribution = [];
  let distError = '';
  try { distribution = distributeProfit(s.result, participants, ev?.regra_rateio || 'nenhum'); }
  catch (e) { distError = e.message; }
  $('#distribution-table').innerHTML = distError ? `<div class="alert warning">${esc(distError)}</div>` : distribution.length ? `<table><thead><tr><th>Entidade</th><th>Aporte</th><th>Rateio</th></tr></thead><tbody>${distribution.map(d => { const p = participants.find(x => x.entityId === d.entityId); return `<tr><td>${esc(p?.name || d.entityId)}</td><td>${fmtMoney(p?.contribution || 0)}</td><td><strong>${fmtMoney(d.amount)}</strong></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty-state small">Sem rateio calculado.</div>';

  const concludedIds = new Set(state.sales.filter(sale => sale.status === 'concluida').map(sale => sale.id));
  const agg = new Map();
  state.saleItems.filter(i => concludedIds.has(i.venda_id)).forEach(i => {
    const row = agg.get(i.produto_id) || { nome: i.produto_nome, qtd: 0, total: 0 };
    row.qtd += Number(i.quantidade || 0); row.total += Number(i.total || 0); agg.set(i.produto_id, row);
  });
  $('#sales-items-report').innerHTML = agg.size ? `<table><thead><tr><th>Produto</th><th>Unidades</th><th>Receita</th></tr></thead><tbody>${[...agg.values()].map(r => `<tr><td>${esc(r.nome)}</td><td>${r.qtd}</td><td>${fmtMoney(r.total)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Sem itens vendidos.</div>';
}

function addToCart(productId, delta = 1) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const current = state.cart.get(productId) || { id: product.id, name: product.nome, price: Number(product.preco_venda), quantity: 0 };
  const next = Math.max(0, Math.min(Number(product.estoque_atual), current.quantity + delta));
  if (next === 0) state.cart.delete(productId); else state.cart.set(productId, { ...current, quantity: next });
  renderCart();
}

async function checkout() {
  if (!eventRequired()) return;
  const ev = selectedEvent();
  const reg = currentRegister();
  if (ev.status !== 'aberto') return toast('O evento não está aberto.', 'warning');
  if (!reg) return toast('Abra um caixa antes de vender.', 'warning');
  const items = cartArray();
  if (!items.length) return;
  const operationId = uuid();
  const payload = {
    p_evento_id: ev.id,
    p_caixa_id: reg.id,
    p_tipo_pagamento: $('#payment-method').value,
    p_itens: items.map(i => ({ produto_id: i.id, quantidade: i.quantity })),
    p_client_operation_id: operationId,
  };
  $('#checkout').disabled = true;
  $('#checkout').textContent = 'Finalizando...';
  try {
    const result = await api.rpc('daex_registrar_venda', payload);
    state.cart.clear();
    state.lastVouchers = result?.vales || [];
    toast(`Venda #${result.venda_id} registrada: ${fmtMoney(result.total)}.`);
    await loadEventData();
    renderLastVouchers();
  } catch (error) {
    if (error.network) {
      queuePendingSale({ ...payload, queued_at: new Date().toISOString() });
      state.cart.clear();
      renderCart();
      toast('Sem conexão: venda salva como pendente. Os vales serão liberados após sincronizar.', 'warning');
    } else toast(errorMessage(error), 'danger');
  } finally {
    $('#checkout').textContent = 'Finalizar venda';
    renderCart();
  }
}

function renderLastVouchers() {
  const panel = $('#last-vouchers-panel');
  if (!state.lastVouchers.length) return panel.hidden = true;
  panel.hidden = false;
  $('#last-vouchers').innerHTML = state.lastVouchers.map(v => `<div class="voucher-card"><span>DAEX</span><strong>VALE 1 ${esc(v.produto)}</strong><b>#${String(v.codigo).padStart(6,'0')}</b><small>USO ÚNICO</small><button class="btn tiny primary" data-action="print-last-voucher" data-token="${esc(v.token)}" data-code="${v.codigo}" data-product="${esc(v.produto)}">Imprimir</button></div>`).join('');
}

function pendingSales() {
  try { return JSON.parse(localStorage.getItem('daex-pending-sales') || '[]'); }
  catch { return []; }
}
function savePendingSales(rows) { localStorage.setItem('daex-pending-sales', JSON.stringify(rows)); updatePendingCount(); }
function queuePendingSale(sale) { savePendingSales([...pendingSales(), sale]); }
function updatePendingCount() { const n = pendingSales().length; $('#pending-count').textContent = n ? `(${n})` : ''; }
async function syncPendingSales() {
  const queue = pendingSales();
  if (!queue.length) return toast('Não há vendas pendentes.', 'warning');
  const remaining = [];
  let synced = 0;
  let vouchers = [];
  for (const sale of queue) {
    try {
      const { queued_at, ...payload } = sale;
      const result = await api.rpc('daex_registrar_venda', payload);
      synced += 1;
      vouchers.push(...(result?.vales || []));
    } catch (error) {
      remaining.push(sale);
      if (!error.network) toast(`Pendência não sincronizada: ${errorMessage(error)}`, 'danger');
    }
  }
  savePendingSales(remaining);
  state.lastVouchers = vouchers;
  await loadEventData();
  renderLastVouchers();
  toast(`${synced} venda(s) sincronizada(s).${remaining.length ? ` ${remaining.length} ainda pendente(s).` : ''}`, remaining.length ? 'warning' : 'success');
}

function qrDataUrl(text) {
  try {
    if (typeof window.qrcode !== 'function') return '';
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(5, 2);
  } catch {
    return '';
  }
}

function voucherPrintDocument(vouchers) {
  const ev = selectedEvent();
  const width = localStorage.getItem('daex-printer-width') || '58';
  const cards = vouchers.map(v => {
    const url = `https://cahk.app/daex/vale.html?t=${encodeURIComponent(v.token)}`;
    const qr = qrDataUrl(url);
    const qrHtml = qr ? `<img src="${qr}" alt="QR">` : `<div class="qr-fallback">QR indisponível<br>use o código abaixo</div>`;
    return `<section class="ticket"><div class="logo">DAEX</div><h1>VALE 1 ${esc(v.produto || v.produto_nome)}</h1><div class="meta">${esc(ev?.nome || 'Evento DAEX')}<br>${fmtDate(ev?.data_evento)}</div><div class="code">#${String(v.codigo || v.id).padStart(6,'0')}</div>${qrHtml}<div class="token">${esc(v.token)}</div><strong>USO ÚNICO</strong></section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Vales DAEX</title><style>@page{size:${width}mm auto;margin:2mm}body{margin:0;font-family:Arial,sans-serif;color:#000}.ticket{width:${Number(width)-4}mm;box-sizing:border-box;text-align:center;padding:3mm 2mm;border-bottom:1px dashed #000;page-break-after:always}.logo{font-size:16px;font-weight:900;letter-spacing:2px}h1{font-size:18px;margin:3mm 0}.meta{font-size:10px}.code{font-size:20px;font-weight:900;margin:2mm 0}.ticket img{width:32mm;height:32mm;object-fit:contain}.qr-fallback{font-size:9px;border:1px dashed #000;padding:4mm 2mm;margin:2mm}.token{font-size:7px;word-break:break-all;margin:1mm 0 2mm}.ticket>strong{font-size:11px}</style></head><body>${cards}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
}
function printVouchers(vouchers) {
  const win = window.open('', '_blank', 'width=500,height=700');
  if (!win) return toast('Permita pop-ups para imprimir.', 'warning');
  win.document.open(); win.document.write(voucherPrintDocument(vouchers)); win.document.close();
}

async function validateVoucher(raw) {
  const token = normalizeVoucherToken(raw);
  if (!token) return toast('Informe um token válido.', 'warning');
  try {
    const result = await api.rpc('daex_validar_vale', { p_token: token });
    $('#voucher-result').innerHTML = `<div class="validation success"><strong>VALE VÁLIDO E CONSUMIDO</strong><span>#${String(result.codigo).padStart(6,'0')} • ${esc(result.produto)}</span></div>`;
    $('#voucher-token').value = '';
    toast('Vale validado.');
    await loadEventData();
  } catch (error) {
    $('#voucher-result').innerHTML = `<div class="validation danger"><strong>NÃO VALIDADO</strong><span>${esc(errorMessage(error))}</span></div>`;
  }
}

async function startScanner() {
  if (!('BarcodeDetector' in window)) return toast('Leitura por câmera não é suportada neste navegador. Use o token ou a URL.', 'warning');
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    state.scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = $('#scanner-video');
    video.srcObject = state.scannerStream; video.hidden = false; await video.play();
    const scan = async () => {
      if (!state.scannerStream) return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          $('#voucher-token').value = codes[0].rawValue;
          stopScanner();
          toast('QR lido. Confira e valide.');
          return;
        }
      } catch {}
      requestAnimationFrame(scan);
    };
    scan();
  } catch { toast('Não foi possível acessar a câmera.', 'danger'); }
}
function stopScanner() {
  state.scannerStream?.getTracks().forEach(t => t.stop());
  state.scannerStream = null;
  $('#scanner-video').hidden = true;
}

function exportCSV() {
  const ev = selectedEvent(); if (!ev) return;
  const s = summary();
  const lines = [
    ['RELATÓRIO DAEX', ev.nome], ['Data', ev.data_evento], ['Status', ev.status], [],
    ['Resumo'], ['Vendas', s.salesTotal], ['CMV', s.cogs], ['Despesas', s.expensesTotal], ['Estoque remanescente', s.inventoryValue], ['Resultado', s.result], [],
    ['Vendas'], ['ID','Data','Pagamento','Total','Custo','Status'],
    ...state.sales.map(v => [v.id, v.created_at, v.tipo_pagamento, v.total, v.custo_total, v.status]), [],
    ['Aportes'], ['Entidade','Valor','Forma','Data'],
    ...state.contributions.map(c => [entityName(c.entidade_id), c.valor, c.forma_pagamento, c.created_at]), [],
    ['Despesas'], ['Categoria','Descrição','Valor','Forma','Status','Data'],
    ...state.expenses.map(e => [e.categoria,e.descricao,e.valor,e.forma_pagamento,e.status,e.created_at]), [],
    ['Estoque'], ['Produto','Quantidade','Custo unitário','Valor'],
    ...state.products.map(p => [p.nome,p.estoque_atual,p.preco_custo,Number(p.estoque_atual)*Number(p.preco_custo)]),
  ];
  const csv = lines.map(row => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `daex-${ev.nome.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function bindEvents() {
  $('#nav').addEventListener('click', e => { const btn = e.target.closest('[data-route]'); if (btn) goRoute(btn.dataset.route); });
  window.addEventListener('hashchange', () => goRoute((location.hash || '#overview').slice(1)));
  $('#event-select').addEventListener('change', async e => { state.selectedEventId = e.target.value; localStorage.setItem('daex-selected-event', state.selectedEventId); state.cart.clear(); await loadEventData(); });
  $('#logout').addEventListener('click', () => { stopScanner(); signOut(); location.replace('./'); });
  $('#printer-width').addEventListener('change', e => localStorage.setItem('daex-printer-width', e.target.value));
  $('#sync-pending').addEventListener('click', syncPendingSales);
  $('#product-search').addEventListener('input', renderPDV);
  $('#voucher-search').addEventListener('input', renderVouchers);
  $('#checkout').addEventListener('click', checkout);
  $('#clear-cart').addEventListener('click', () => { state.cart.clear(); renderCart(); });
  $('#print-all-vouchers').addEventListener('click', () => printVouchers(state.lastVouchers));
  $('#scan-qr').addEventListener('click', startScanner);
  $('#export-csv').addEventListener('click', exportCSV);
  $('#print-report').addEventListener('click', () => window.print());

  $('#event-form').addEventListener('submit', async e => {
    e.preventDefault(); const form = e.currentTarget; const d = formObject(form); setBusy(form, true);
    try {
      const rows = await api.insert('daex_eventos', { ...d, fundo_troco: Number(d.fundo_troco || 0), created_by: state.user.id, status: 'rascunho' });
      state.selectedEventId = rows[0].id; localStorage.setItem('daex-selected-event', state.selectedEventId); form.reset(); toast('Evento criado.'); await loadBaseData();
    } catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  $('#entity-form').addEventListener('submit', async e => {
    e.preventDefault(); const form = e.currentTarget; const d = formObject(form); setBusy(form, true);
    try { await api.insert('daex_entidades', { ...d, sigla: d.sigla.trim().toUpperCase() }); form.reset(); toast('Entidade cadastrada.'); await loadBaseData(); }
    catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  $('#participant-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!eventRequired()) return; const form = e.currentTarget; const d = formObject(form); setBusy(form, true);
    try { await api.insert('daex_evento_entidades', { evento_id: state.selectedEventId, entidade_id: d.entidade_id, percentual_rateio: d.percentual_rateio ? Number(d.percentual_rateio) : null }); form.reset(); toast('Entidade adicionada ao evento.'); await loadEventData(); }
    catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  $('#contribution-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!eventRequired()) return; const form = e.currentTarget; const d = formObject(form); setBusy(form, true);
    try {
      if (!state.eventEntities.some(link => link.entidade_id === d.entidade_id)) {
        await api.insert('daex_evento_entidades', { evento_id: state.selectedEventId, entidade_id: d.entidade_id, percentual_rateio: null });
      }
      await api.insert('daex_aportes', { ...d, evento_id: state.selectedEventId, valor: Number(d.valor), created_by: state.user.id });
      form.reset(); toast('Aporte registrado e entidade vinculada ao evento.'); await loadEventData();
    }
    catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  $('#product-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!eventRequired()) return; const form = e.currentTarget; const fd = new FormData(form); const initial = Number(fd.get('estoque_inicial') || 0); setBusy(form, true);
    try {
      const rows = await api.insert('daex_produtos', { evento_id: state.selectedEventId, nome: fd.get('nome'), categoria: fd.get('categoria') || null, preco_venda: Number(fd.get('preco_venda')), preco_custo: Number(fd.get('preco_custo') || 0), emitir_vale: fd.get('emitir_vale') === 'on', estoque_atual: 0 });
      if (initial > 0) await api.rpc('daex_ajustar_estoque', { p_produto_id: rows[0].id, p_delta: initial, p_motivo: 'Estoque inicial', p_custo_unitario: Number(fd.get('preco_custo') || 0), p_fornecedor: null });
      form.reset(); toast('Produto cadastrado.'); await loadEventData();
    } catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  $('#stock-form').addEventListener('submit', async e => {
    e.preventDefault(); const form = e.currentTarget; const d = formObject(form); setBusy(form, true);
    try { await api.rpc('daex_ajustar_estoque', { p_produto_id: d.produto_id, p_delta: Number(d.delta), p_motivo: d.motivo, p_custo_unitario: d.custo_unitario ? Number(d.custo_unitario) : null, p_fornecedor: d.fornecedor || null }); form.reset(); toast('Estoque atualizado.'); await loadEventData(); }
    catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  $('#voucher-form').addEventListener('submit', async e => { e.preventDefault(); await validateVoucher($('#voucher-token').value); });

  $('#expense-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!eventRequired()) return; const form = e.currentTarget; const d = formObject(form); setBusy(form, true);
    try { await api.insert('daex_despesas', { ...d, evento_id: state.selectedEventId, valor: Number(d.valor), created_by: state.user.id, status: 'confirmada' }); form.reset(); toast('Despesa registrada.'); await loadEventData(); }
    catch (err) { toast(errorMessage(err), 'danger'); } finally { setBusy(form, false); }
  });

  document.addEventListener('click', handleActionClick);
}

async function handleActionClick(event) {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action; const id = button.dataset.id;
  try {
    if (action === 'select-event') { state.selectedEventId = id; localStorage.setItem('daex-selected-event', id); await loadEventData(); return; }
    if (action === 'open-event') { await api.update('daex_eventos', { id: `eq.${id}` }, { status: 'aberto' }); toast('Evento aberto.'); await loadBaseData(); return; }
    if (action === 'close-event') {
      if (state.registers.some(r => r.status === 'aberto')) return toast('Feche todos os caixas antes de encerrar o evento.', 'warning');
      if (!confirm('Fechar este evento? Novas vendas serão bloqueadas.')) return;
      await api.update('daex_eventos', { id: `eq.${id}` }, { status: 'fechado', fechado_por: state.user.id, fechado_em: new Date().toISOString() }); toast('Evento fechado.'); await loadBaseData(); return;
    }
    if (action === 'remove-participant') { await api.remove('daex_evento_entidades', { id: `eq.${id}` }); toast('Participante removido.'); await loadEventData(); return; }
    if (action === 'delete-contribution') { if (!confirm('Excluir este aporte?')) return; await api.remove('daex_aportes', { id: `eq.${id}` }); toast('Aporte excluído.'); await loadEventData(); return; }
    if (action === 'toggle-product') { const p = state.products.find(x => x.id === id); await api.update('daex_produtos', { id: `eq.${id}` }, { ativo: !p.ativo }); toast('Produto atualizado.'); await loadEventData(); return; }
    if (action === 'add-cart') { addToCart(id, 1); return; }
    if (action === 'cart-plus') { addToCart(id, 1); return; }
    if (action === 'cart-minus') { addToCart(id, -1); return; }
    if (action === 'open-register') {
      if (selectedEvent()?.status !== 'aberto') return toast('Abra o evento primeiro.', 'warning');
      const nome = $('#open-register-name').value.trim() || 'Caixa'; const saldo = Number($('#open-register-value').value || 0);
      await api.insert('daex_caixas', { evento_id: state.selectedEventId, nome, aberto_por: state.user.id, saldo_inicial: saldo, status: 'aberto' }); toast('Caixa aberto.'); await loadEventData(); return;
    }
    if (action === 'close-register') {
      const raw = prompt('Informe o saldo final contado no caixa:', '0'); if (raw === null) return; const value = Number(String(raw).replace(',', '.')); if (!Number.isFinite(value) || value < 0) return toast('Saldo inválido.', 'warning');
      await api.update('daex_caixas', { id: `eq.${id}` }, { status: 'fechado', fechado_por: state.user.id, fechado_em: new Date().toISOString(), saldo_final_informado: value }); toast('Caixa fechado.'); await loadEventData(); return;
    }
    if (action === 'cancel-sale') { const reason = prompt('Motivo do cancelamento:'); if (!reason) return; await api.rpc('daex_cancelar_venda', { p_venda_id: Number(id), p_motivo: reason }); toast('Venda cancelada e estoque devolvido.'); await loadEventData(); return; }
    if (action === 'cancel-expense') { if (!confirm('Cancelar esta despesa?')) return; await api.update('daex_despesas', { id: `eq.${id}` }, { status: 'cancelada' }); toast('Despesa cancelada.'); await loadEventData(); return; }
    if (action === 'print-voucher') { const v = state.vouchers.find(x => String(x.id) === String(id)); if (v) printVouchers([{ codigo: v.id, token: v.token, produto: v.produto_nome }]); return; }
    if (action === 'print-last-voucher') { printVouchers([{ codigo: button.dataset.code, token: button.dataset.token, produto: button.dataset.product }]); return; }
  } catch (err) { toast(errorMessage(err), 'danger'); }
}

bootstrap().catch(err => { console.error(err); toast(errorMessage(err), 'danger'); });
