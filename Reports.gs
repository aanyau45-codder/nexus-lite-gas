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

/** Today's quick stats for the dashboard (sales count + revenue since midnight). */
function apiDashboard(token) {
  requireUser_(token);
  var todayStr = new Date().toISOString().slice(0, 10);
  var sales = getTable('Sales').filter(function (r) { return String(r.date).slice(0, 10) === todayStr; });
  var todayTotal = 0;
  sales.forEach(function (r) { todayTotal += Number(r.total) || 0; });
  var recent = getTable('Sales').sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date));
  }).slice(0, 5);
  var inv = apiInventoryValue(token);
  var summary = apiSalesSummary(token, {});

  // Receivables: unpaid balances on credit sales (total still owed by customers).
  var receivables = 0;
  getTable('Sales').forEach(function (r) {
    var bal = (Number(r.total) || 0) - (Number(r.amountPaid) || 0);
    if (bal > 0) receivables += bal;
  });
  // Payables (what the user owes suppliers) arrive with the credit-purchases slice.
  var payables = 0;

  return {
    todayTotal: todayTotal, todayCount: sales.length,
    lowCount: inv.lowCount, outCount: inv.outCount,
    stockValue: inv.retailValue, inventoryCost: inv.costValue,
    cashBalance: cashBalance_(), receivables: receivables, payables: payables,
    cashSeries: cashSeries_(30),
    recent: recent, byDay: summary.byDay.slice(-7)
  };
}
