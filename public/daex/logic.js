export function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function cartTotals(items = []) {
  const result = items.reduce((acc, item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    acc.items += quantity;
    acc.total += quantity * price;
    return acc;
  }, { items: 0, total: 0 });

  result.total = roundMoney(result.total);
  return result;
}

export function financialSummary({
  sales = [],
  expenses = [],
  contributions = [],
  products = [],
  openingFund = 0,
} = {}) {
  const concluded = sales.filter(s => s.status === 'concluida');
  const confirmedExpenses = expenses.filter(e => e.status === 'confirmada');

  const salesTotal = roundMoney(concluded.reduce((s, x) => s + Number(x.total || 0), 0));
  const cogs = roundMoney(concluded.reduce((s, x) => s + Number(x.custo_total || 0), 0));
  const expensesTotal = roundMoney(confirmedExpenses.reduce((s, x) => s + Number(x.valor || 0), 0));
  const inventoryValue = roundMoney(products.reduce((s, x) => s + Number(x.estoque_atual || 0) * Number(x.preco_custo || 0), 0));
  const result = roundMoney(salesTotal - cogs - expensesTotal);

  const cashSales = concluded
    .filter(s => s.tipo_pagamento === 'Dinheiro')
    .reduce((s, x) => s + Number(x.total || 0), 0);
  const cashContributions = contributions
    .filter(x => x.forma_pagamento === 'Dinheiro')
    .reduce((s, x) => s + Number(x.valor || 0), 0);
  const cashExpenses = confirmedExpenses
    .filter(x => x.forma_pagamento === 'Dinheiro')
    .reduce((s, x) => s + Number(x.valor || 0), 0);
  const cashBalanceEstimated = roundMoney(Number(openingFund || 0) + cashSales + cashContributions - cashExpenses);

  const byPayment = concluded.reduce((acc, sale) => {
    const key = sale.tipo_pagamento || 'Outro';
    acc[key] = roundMoney((acc[key] || 0) + Number(sale.total || 0));
    return acc;
  }, {});

  return {
    salesTotal,
    cogs,
    expensesTotal,
    inventoryValue,
    result,
    cashBalanceEstimated,
    byPayment,
  };
}

export function distributeProfit(profit, participants = [], method = 'nenhum') {
  const value = roundMoney(profit);
  if (value <= 0 || !participants.length || method === 'nenhum') return [];

  if (method === 'igual') {
    const base = roundMoney(value / participants.length);
    let distributed = 0;
    return participants.map((p, i) => {
      const amount = i === participants.length - 1 ? roundMoney(value - distributed) : base;
      distributed = roundMoney(distributed + amount);
      return { entityId: p.entityId, amount };
    });
  }

  if (method === 'proporcional') {
    const totalContrib = participants.reduce((s, p) => s + Number(p.contribution || 0), 0);
    if (totalContrib <= 0) return [];
    let distributed = 0;
    return participants.map((p, i) => {
      const amount = i === participants.length - 1
        ? roundMoney(value - distributed)
        : roundMoney(value * Number(p.contribution || 0) / totalContrib);
      distributed = roundMoney(distributed + amount);
      return { entityId: p.entityId, amount };
    });
  }

  if (method === 'personalizado') {
    const totalPercent = participants.reduce((s, p) => s + Number(p.customPercent || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new Error('Os percentuais personalizados precisam somar 100%.');
    }
    let distributed = 0;
    return participants.map((p, i) => {
      const amount = i === participants.length - 1
        ? roundMoney(value - distributed)
        : roundMoney(value * Number(p.customPercent || 0) / 100);
      distributed = roundMoney(distributed + amount);
      return { entityId: p.entityId, amount };
    });
  }

  return [];
}

export function normalizeVoucherToken(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.toUpperCase().startsWith('DAEX:')) return value.slice(5).trim();
  try {
    const url = new URL(value);
    return url.searchParams.get('t') || value;
  } catch {
    return value;
  }
}

export function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}
