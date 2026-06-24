/** Reports: sales summary + inventory value. */

function apiSalesSummary(token, opts) {
  requireUser_(token);
  opts = opts || {};
  var rows = getTable('Sales');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });

  var total = 0, tax = 0;
  var byDay = {};
  var saleIds = {};
  rows.forEach(function (r) {
    total += Number(r.total) || 0;
    tax += Number(r.tax) || 0;
    var d = String(r.date).slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (Number(r.total) || 0);
    saleIds[String(r.id)] = true;
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

  var byDayArr = Object.keys(byDay).sort().map(function (d) { return { day: d, total: byDay[d] }; });
  return { total: total, count: rows.length, tax: tax, byDay: byDayArr, topProducts: topProducts };
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

/** Profit & Loss for a given month (defaults to current). */
function profitLoss_(year, month) {
  var now = new Date();
  year = Number(year) || now.getFullYear();
  month = (month != null && month !== '') ? Number(month) : (now.getMonth() + 1);
  var prefix = year + '-' + ('0' + month).slice(-2);
  var sales = getTable('Sales').filter(function (s) { return String(s.date).slice(0, 7) === prefix; });
  var saleIds = {}; sales.forEach(function (s) { saleIds[String(s.id)] = true; });
  var revenue = 0; sales.forEach(function (s) { revenue += Number(s.total) || 0; });
  var pcost = {};
  getTable('Products').forEach(function (p) { pcost[String(p.id)] = Number(p.cost) || 0; });
  var cogs = 0, agg = {};
  getTable('SaleItems').forEach(function (it) {
    if (!saleIds[String(it.saleId)]) return;
    var qty = Number(it.qty) || 0, c = pcost[String(it.productId)] || 0;
    cogs += qty * c;
    var k = it.name || String(it.productId);
    if (!agg[k]) agg[k] = { name: k, qty: 0, revenue: 0, profit: 0 };
    agg[k].qty += qty; agg[k].revenue += Number(it.subtotal) || 0;
    agg[k].profit += (Number(it.subtotal) || 0) - qty * c;
  });
  var expenses = 0;
  getTable('Expenses').forEach(function (e) { if (String(e.date).slice(0, 7) === prefix) expenses += Number(e.amount) || 0; });
  var arr = Object.keys(agg).map(function (k) { return agg[k]; });
  var topSelling = arr.slice().sort(function (a, b) { return b.qty - a.qty; })[0] || null;
  var mostProfitable = arr.slice().sort(function (a, b) { return b.profit - a.profit; })[0] || null;
  return {
    year: year, month: month, revenue: revenue, cogs: cogs, grossProfit: revenue - cogs,
    expenses: expenses, netProfit: revenue - cogs - expenses, salesCount: sales.length,
    topSelling: topSelling, mostProfitable: mostProfitable
  };
}
function apiProfitLoss(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  return profitLoss_(opts.year, opts.month);
}

/** Per-customer summary (sales + invoices). */
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

/** Per-supplier summary (purchases). */
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
