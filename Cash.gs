/**
 * Cash flow ledger — tracks money in hand.
 * Running balance = Σ(direction:'in') − Σ(direction:'out').
 *
 * Inflows: owner_injection, loan, other_income, sale (cash actually received),
 *          receivable_payment, opening_balance.
 * Outflows: expense, purchase, payable_payment, drawing.
 */

/** Append one ledger row. Call inside withLock(). */
function cashEntry_(o) {
  appendRow('CashFlow', {
    id: uuid_(),
    date: o.date || now_(),
    type: o.type || 'adjustment',
    direction: o.direction === 'out' ? 'out' : 'in',
    amount: Math.abs(Number(o.amount) || 0),
    method: o.method || '',
    refType: o.refType || '',
    refId: o.refId || '',
    note: o.note || '',
    recordedBy: o.recordedBy || ''
  });
}

/** Current money in hand. */
function cashBalance_() {
  var bal = 0;
  getTable('CashFlow').forEach(function (r) {
    var a = Number(r.amount) || 0;
    bal += (String(r.direction) === 'out' ? -a : a);
  });
  return bal;
}

/** Daily running-balance series for the last `days` days (for the home graph). */
function cashSeries_(days) {
  days = days || 30;
  var dayNet = {};
  getTable('CashFlow').forEach(function (r) {
    var d = String(r.date).slice(0, 10);
    var a = Number(r.amount) || 0;
    if (String(r.direction) === 'out') a = -a;
    dayNet[d] = (dayNet[d] || 0) + a;
  });
  var today = new Date();
  var start = new Date(today.getTime() - (days - 1) * 86400000);
  var startStr = start.toISOString().slice(0, 10);
  var running = 0;
  Object.keys(dayNet).forEach(function (d) { if (d < startStr) running += dayNet[d]; });
  var series = [];
  for (var i = 0; i < days; i++) {
    var d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    running += (dayNet[d] || 0);
    series.push({ day: d, balance: running });
  }
  return series;
}

/** Record income: owner injection, loan, or other money put into the till. */
function apiAddCashEntry(token, entry) {
  var u = requireRole_(token, ['owner', 'manager']);
  entry = entry || {};
  var amount = Number(entry.amount) || 0;
  if (amount <= 0) throw new Error('Enter an amount above 0.');
  var allowed = { owner_injection: 1, loan: 1, other_income: 1, opening_balance: 1, drawing: 1 };
  var type = allowed[entry.type] ? entry.type : 'other_income';
  var dir = type === 'drawing' ? 'out' : 'in';
  withLock(function () {
    cashEntry_({
      type: type, direction: dir, amount: amount, method: entry.method || '',
      note: entry.note || '', recordedBy: u.name || u.username
    });
  });
  return { ok: true, balance: cashBalance_() };
}

/** Record an expense (logs an Expenses row + a cash outflow). */
function apiAddExpense(token, exp) {
  var u = requireRole_(token, ['owner', 'manager']);
  exp = exp || {};
  var amount = Number(exp.amount) || 0;
  if (amount <= 0) throw new Error('Enter an amount above 0.');
  var id = uuid_(), date = now_();
  withLock(function () {
    appendRow('Expenses', {
      id: id, date: date, category: exp.category || 'General',
      amount: amount, note: exp.note || '', recordedBy: u.name || u.username
    });
    cashEntry_({
      type: 'expense', direction: 'out', amount: amount, refType: 'expense', refId: id,
      note: exp.note || exp.category || 'Expense', recordedBy: u.name || u.username, date: date
    });
  });
  return { ok: true, balance: cashBalance_() };
}

/** Add many expenses at once (each logs an Expenses row + a cash outflow). */
function apiBulkAddExpenses(token, list) {
  var u = requireRole_(token, ['owner', 'manager']);
  list = list || [];
  if (!list.length) throw new Error('Nothing to add.');
  return withLock(function () {
    var count = 0;
    list.forEach(function (e) {
      var amount = Number(e.amount) || 0;
      if (amount <= 0) return;
      var id = uuid_(), date = now_();
      appendRow('Expenses', {
        id: id, date: date, category: e.category || 'General',
        amount: amount, note: e.note || '', recordedBy: u.name || u.username
      });
      cashEntry_({
        type: 'expense', direction: 'out', amount: amount, refType: 'expense', refId: id,
        note: e.note || e.category || 'Expense', recordedBy: u.name || u.username, date: date
      });
      count++;
    });
    return { ok: true, count: count, balance: cashBalance_() };
  });
}

function apiGetExpenses(token, opts) {
  requireUser_(token);
  opts = opts || {};
  var rows = getTable('Expenses');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

/** Ledger rows + current balance + a series for charts (owner/manager only). */
function apiGetCashFlow(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var rows = getTable('CashFlow');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  var all = rows.slice();
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return { balance: cashBalance_(), rows: rows, series: cashSeries_(opts.days || 30) };
}
