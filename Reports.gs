/** Reports: sales, purchases, profit & loss, general overview, cash flow, inventory value. */

function apiSalesSummary(token, opts) {
  requireUser_(token);
  opts = opts || {};
  var rows = getTable('Sales');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });

  var total = 0, tax = 0;
  var byDay = {};
  var saleIds = {};
  var custAgg = {};
  rows.forEach(function (r) {
    total += Number(r.total) || 0;
    tax += Number(r.tax) || 0;
    var d = String(r.date).slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (Number(r.total) || 0);
    saleIds[String(r.id)] = true;

    var k = r.customerName || 'Walk-in';
    if (!custAgg[k]) custAgg[k] = { name: k, count: 0, total: 0, paid: 0, balance: 0 };
    custAgg[k].count++;
    custAgg[k].total += Number(r.total) || 0;
    custAgg[k].paid += Number(r.amountPaid) || 0;
    custAgg[k].balance += Math.max(0, (Number(r.total) || 0) - (Number(r.amountPaid) || 0));
  });

  var prod = {};
  getTable('SaleItems').forEach(function (it) {
    if (!saleIds[String(it.saleId)]) return;
    var k = it.name;
    if (!prod[k]) prod[k] = { name: k, qty: 0, revenue: 0 };
    prod[k].qty += Number(it.qty) || 0;
    prod[k].revenue += Number(it.subtotal) || 0;
  });
  var topProducts = Object.keys(prod).map(function (k) { return prod[k]; })
    .sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 10);
  var topCustomers = Object.keys(custAgg).map(function (k) { return custAgg[k]; })
    .sort(function (a, b) { return b.total - a.total; }).slice(0, 10);

  var byDayArr = Object.keys(byDay).sort().map(function (d) { return { day: d, total: byDay[d] }; });
  return {
    total: total, count: rows.length, avg: rows.length ? total / rows.length : 0, tax: tax,
    byDay: byDayArr, topProducts: topProducts, topCustomers: topCustomers
  };
}

/** Purchases summary for a date range: spend, top products bought, top suppliers. */
function apiPurchasesSummary(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var rows = getTable('Purchases');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });

  var total = 0, itemsQty = 0;
  var byDay = {};
  var purchaseIds = {};
  var supAgg = {};
  rows.forEach(function (r) {
    total += Number(r.total) || 0;
    var d = String(r.date).slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (Number(r.total) || 0);
    purchaseIds[String(r.id)] = true;

    var k = r.supplierName || '—';
    if (!supAgg[k]) supAgg[k] = { name: k, count: 0, total: 0, paid: 0, balance: 0 };
    supAgg[k].count++;
    supAgg[k].total += Number(r.total) || 0;
    supAgg[k].paid += Number(r.amountPaid) || 0;
    supAgg[k].balance += Math.max(0, (Number(r.total) || 0) - (Number(r.amountPaid) || 0));
  });

  var prod = {};
  getTable('PurchaseItems').forEach(function (it) {
    if (!purchaseIds[String(it.purchaseId)]) return;
    var k = it.name;
    if (!prod[k]) prod[k] = { name: k, qty: 0, revenue: 0 };
    prod[k].qty += Number(it.qty) || 0;
    prod[k].revenue += Number(it.subtotal) || 0;
    itemsQty += Number(it.qty) || 0;
  });
  var topProducts = Object.keys(prod).map(function (k) { return prod[k]; })
    .sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 10);
  var topSuppliers = Object.keys(supAgg).map(function (k) { return supAgg[k]; })
    .sort(function (a, b) { return b.total - a.total; }).slice(0, 10);

  var byDayArr = Object.keys(byDay).sort().map(function (d) { return { day: d, total: byDay[d] }; });
  return {
    total: total, count: rows.length, avg: rows.length ? total / rows.length : 0, itemsQty: itemsQty,
    byDay: byDayArr, topProducts: topProducts, topSuppliers: topSuppliers
  };
}

function apiInventoryValue(token) {
  requireUser_(token);
  var ps = getTable('Products');
  var cost = 0, retail = 0, low = 0, out = 0;
  var def = Number(readSettings_().lowStockDefault) || 5;
  ps.forEach(function (p) {
    var st = Number(p.stock) || 0;
    cost += st * (Number(p.cost) || 0);
    retail += st * (Number(p.price) || 0);
    var thr = Number(p.lowStock) || def;
    if (st <= 0) out++;
    else if (st <= thr) low++;
  });
  return { costValue: cost, retailValue: retail, lowCount: low, outCount: out, productCount: ps.length };
}

/** Everything the dashboard panels need. */
function apiDashboard(token) {
  requireUser_(token);
  var todayStr = new Date().toISOString().slice(0, 10);
  var allSales = getTable('Sales');
  var today = allSales.filter(function (r) { return String(r.date).slice(0, 10) === todayStr; });
  var todayTotal = 0;
  today.forEach(function (r) { todayTotal += Number(r.total) || 0; });
  var recent = allSales.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 6);
  var inv = apiInventoryValue(token);
  var summary = apiSalesSummary(token, {});

  var rec = receivables_(), pay = payables_();
  var receivables = rec.reduce(function (a, r) { return a + r.balance; }, 0);
  var payables = pay.reduce(function (a, r) { return a + r.balance; }, 0);

  var yearStr = String(new Date().getFullYear());
  var yearlyRevenue = 0;
  allSales.forEach(function (s) { if (String(s.date).slice(0, 4) === yearStr) yearlyRevenue += Number(s.total) || 0; });

  // Invoice status counts
  var invStatus = { unpaid: 0, overdue: 0, paid: 0 };
  getTable('Invoices').forEach(function (v) {
    var bal = (Number(v.total) || 0) - (Number(v.amountPaid) || 0);
    if (bal <= 0) { invStatus.paid++; return; }
    invStatus.unpaid++;
    if (v.dueDate && String(v.dueDate).slice(0, 10) < todayStr) invStatus.overdue++;
  });

  // Recent transactions enriched with item + customer
  var itemsBySale = {};
  getTable('SaleItems').forEach(function (it) {
    (itemsBySale[String(it.saleId)] = itemsBySale[String(it.saleId)] || []).push(it);
  });
  var recentTx = recent.map(function (s) {
    var its = itemsBySale[String(s.id)] || [];
    return {
      date: s.date, ref: s.ref, item: its[0] ? its[0].name : '—',
      qty: its.reduce(function (a, x) { return a + (Number(x.qty) || 0); }, 0),
      customer: s.customerName || '—', total: Number(s.total) || 0
    };
  });

  return {
    todayTotal: todayTotal, todayCount: today.length,
    lowCount: inv.lowCount, outCount: inv.outCount,
    stockValue: inv.retailValue, inventoryCost: inv.costValue, productCount: inv.productCount,
    cashBalance: cashBalance_(), receivables: receivables, payables: payables,
    receivablesList: rec, payablesList: pay,
    transactionCount: allSales.length, yearlyRevenue: yearlyRevenue,
    supplierCount: getTable('Suppliers').length, invoiceStatus: invStatus,
    cashSeries: cashSeries_(30), pnl: profitLoss_(null, null),
    recent: recent, recentTx: recentTx, byDay: summary.byDay.slice(-7)
  };
}

/**
 * Profit & Loss engine for an arbitrary date range. `from`/`to` are 'YYYY-MM-DD'
 * strings (either may be '' for an open end). Shared by the P&L report, the Net
 * Profit report (same numbers, simpler client-side view) and the General report.
 */
function profitLossRange_(from, to) {
  var sales = getTable('Sales');
  if (from) sales = sales.filter(function (s) { return String(s.date) >= from; });
  if (to) sales = sales.filter(function (s) { return String(s.date) <= to + 'T23:59:59'; });
  var saleIds = {}, saleDate = {};
  sales.forEach(function (s) {
    saleIds[String(s.id)] = true;
    saleDate[String(s.id)] = String(s.date).slice(0, 10);
  });
  var revenue = 0;
  var byDayRevenue = {};
  sales.forEach(function (s) {
    var amt = Number(s.total) || 0;
    revenue += amt;
    var d = saleDate[String(s.id)];
    byDayRevenue[d] = (byDayRevenue[d] || 0) + amt;
  });

  var pcost = {};
  getTable('Products').forEach(function (p) { pcost[String(p.id)] = Number(p.cost) || 0; });

  var cogs = 0, agg = {}, byDayCogs = {};
  getTable('SaleItems').forEach(function (it) {
    if (!saleIds[String(it.saleId)]) return;
    var qty = Number(it.qty) || 0, c = pcost[String(it.productId)] || 0, lineCogs = qty * c;
    cogs += lineCogs;
    var d = saleDate[String(it.saleId)];
    byDayCogs[d] = (byDayCogs[d] || 0) + lineCogs;
    var k = it.name || String(it.productId);
    if (!agg[k]) agg[k] = { name: k, qty: 0, revenue: 0, profit: 0 };
    agg[k].qty += qty; agg[k].revenue += Number(it.subtotal) || 0;
    agg[k].profit += (Number(it.subtotal) || 0) - lineCogs;
  });

  var expRows = getTable('Expenses');
  if (from) expRows = expRows.filter(function (e) { return String(e.date) >= from; });
  if (to) expRows = expRows.filter(function (e) { return String(e.date) <= to + 'T23:59:59'; });
  var expenses = 0, byDayExpenses = {};
  expRows.forEach(function (e) {
    var amt = Number(e.amount) || 0;
    expenses += amt;
    var d = String(e.date).slice(0, 10);
    byDayExpenses[d] = (byDayExpenses[d] || 0) + amt;
  });

  var arr = Object.keys(agg).map(function (k) { return agg[k]; });
  var topSelling = arr.slice().sort(function (a, b) { return b.qty - a.qty; })[0] || null;
  var mostProfitable = arr.slice().sort(function (a, b) { return b.profit - a.profit; })[0] || null;

  var days = {};
  Object.keys(byDayRevenue).forEach(function (d) { days[d] = 1; });
  Object.keys(byDayCogs).forEach(function (d) { days[d] = 1; });
  Object.keys(byDayExpenses).forEach(function (d) { days[d] = 1; });
  var byDay = Object.keys(days).sort().map(function (d) {
    var rev = byDayRevenue[d] || 0, cg = byDayCogs[d] || 0, ex = byDayExpenses[d] || 0;
    return { day: d, revenue: rev, cogs: cg, expenses: ex, netProfit: rev - cg - ex };
  });

  return {
    from: from || '', to: to || '', revenue: revenue, cogs: cogs, grossProfit: revenue - cogs,
    expenses: expenses, netProfit: revenue - cogs - expenses, salesCount: sales.length,
    topSelling: topSelling, mostProfitable: mostProfitable, byDay: byDay
  };
}

/** Profit & Loss for a given month (defaults to current) — used by the dashboard card. */
function profitLoss_(year, month) {
  var now = new Date();
  year = Number(year) || now.getFullYear();
  month = (month != null && month !== '') ? Number(month) : (now.getMonth() + 1);
  var mm = ('0' + month).slice(-2);
  var from = year + '-' + mm + '-01';
  var lastDay = new Date(year, month, 0).getDate();
  var to = year + '-' + mm + '-' + ('0' + lastDay).slice(-2);
  var r = profitLossRange_(from, to);
  r.year = year; r.month = month;
  return r;
}

/** Profit & Loss report: pass {from,to} for a date range, or {year,month} for a calendar month. */
function apiProfitLoss(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  if (opts.from || opts.to) return profitLossRange_(opts.from || '', opts.to || '');
  return profitLoss_(opts.year, opts.month);
}

/**
 * General report: a single-page overview for a date range — sales, purchases,
 * expenses, cash movement, and profit for the period, plus a current snapshot
 * of inventory value and outstanding receivables/payables.
 */
function apiGeneralReport(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var from = opts.from || '', to = opts.to || '';

  var salesRows = getTable('Sales');
  if (from) salesRows = salesRows.filter(function (r) { return String(r.date) >= from; });
  if (to) salesRows = salesRows.filter(function (r) { return String(r.date) <= to + 'T23:59:59'; });
  var salesTotal = 0; salesRows.forEach(function (r) { salesTotal += Number(r.total) || 0; });

  var purchRows = getTable('Purchases');
  if (from) purchRows = purchRows.filter(function (r) { return String(r.date) >= from; });
  if (to) purchRows = purchRows.filter(function (r) { return String(r.date) <= to + 'T23:59:59'; });
  var purchTotal = 0; purchRows.forEach(function (r) { purchTotal += Number(r.total) || 0; });

  var expRows = getTable('Expenses');
  if (from) expRows = expRows.filter(function (r) { return String(r.date) >= from; });
  if (to) expRows = expRows.filter(function (r) { return String(r.date) <= to + 'T23:59:59'; });
  var expTotal = 0; expRows.forEach(function (r) { expTotal += Number(r.amount) || 0; });

  var cashRows = getTable('CashFlow');
  if (from) cashRows = cashRows.filter(function (r) { return String(r.date) >= from; });
  if (to) cashRows = cashRows.filter(function (r) { return String(r.date) <= to + 'T23:59:59'; });
  var cashIn = 0, cashOut = 0;
  cashRows.forEach(function (r) {
    var a = Number(r.amount) || 0;
    if (String(r.direction) === 'out') cashOut += a; else cashIn += a;
  });

  var pnl = profitLossRange_(from, to);
  var inv = apiInventoryValue(token);
  var rec = receivables_(), pay = payables_();
  var receivablesTotal = rec.reduce(function (a, r) { return a + r.balance; }, 0);
  var payablesTotal = pay.reduce(function (a, r) { return a + r.balance; }, 0);

  return {
    from: from, to: to,
    sales: { total: salesTotal, count: salesRows.length },
    purchases: { total: purchTotal, count: purchRows.length },
    expenses: { total: expTotal, count: expRows.length },
    cashFlow: { inAmt: cashIn, outAmt: cashOut, net: cashIn - cashOut },
    profit: { cogs: pnl.cogs, grossProfit: pnl.grossProfit, netProfit: pnl.netProfit },
    inventory: {
      costValue: inv.costValue, retailValue: inv.retailValue,
      lowCount: inv.lowCount, outCount: inv.outCount, productCount: inv.productCount
    },
    receivables: receivablesTotal, payables: payablesTotal, cashBalance: cashBalance_()
  };
}

/** Per-customer summary (sales + invoices), all-time. */
function apiCustomerReport(token) {
  requireRole_(token, ['owner', 'manager']);
  var agg = {};
  function add(name, total, paid) {
    var k = name || '—';
    if (!agg[k]) agg[k] = { name: k, count: 0, total: 0, paid: 0, balance: 0 };
    agg[k].count++; agg[k].total += total; agg[k].paid += paid;
    agg[k].balance += Math.max(0, total - paid);
  }
  getTable('Sales').forEach(function (s) { add(s.customerName, Number(s.total) || 0, Number(s.amountPaid) || 0); });
  getTable('Invoices').forEach(function (v) { add(v.customerName, Number(v.total) || 0, Number(v.amountPaid) || 0); });
  return Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return b.total - a.total; });
}

/** Per-supplier summary (purchases), all-time. */
function apiSupplierReport(token) {
  requireRole_(token, ['owner', 'manager']);
  var agg = {};
  getTable('Purchases').forEach(function (p) {
    var k = p.supplierName || '—';
    if (!agg[k]) agg[k] = { name: k, count: 0, total: 0, paid: 0, balance: 0 };
    agg[k].count++; agg[k].total += Number(p.total) || 0; agg[k].paid += Number(p.amountPaid) || 0;
    agg[k].balance += Math.max(0, (Number(p.total) || 0) - (Number(p.amountPaid) || 0));
  });
  return Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return b.total - a.total; });
}
