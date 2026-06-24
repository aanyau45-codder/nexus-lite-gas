/**
 * Payments against receivables (credit sales + invoices) and payables (purchases).
 * A receivable payment is cash IN; a payable payment is cash OUT. Each updates the
 * source record's amountPaid/balance/status, logs a Payments row, and a CashFlow row.
 */
function apiRecordPayment(token, p) {
  var user = requireRole_(token, ['owner', 'manager']);
  p = p || {};
  var amount = Number(p.amount) || 0;
  if (amount <= 0) throw new Error('Enter an amount above 0.');
  var tab = p.refType === 'sale' ? 'Sales'
    : p.refType === 'invoice' ? 'Invoices'
    : p.refType === 'purchase' ? 'Purchases' : null;
  if (!tab) throw new Error('Invalid payment target.');

  return withLock(function () {
    var row = getById(tab, p.refId);
    if (!row) throw new Error('Record not found.');
    var total = Number(row.total) || 0;
    var paid = Number(row.amountPaid) || 0;
    var newPaid = Math.min(total, paid + amount);
    var applied = newPaid - paid;
    if (applied <= 0) throw new Error('This is already fully paid.');
    var balance = Math.max(0, total - newPaid);
    var status = balance <= 0 ? 'paid' : 'partial';

    var patch = { amountPaid: newPaid, status: status };
    if (tab !== 'Sales') { patch.balance = balance; patch.updatedAt = now_(); }
    updateRow(tab, p.refId, patch);

    var inbound = p.refType !== 'purchase';
    var party = row.customerName || row.supplierName || p.party || '';
    appendRow('Payments', {
      id: uuid_(), date: now_(), direction: inbound ? 'in' : 'out', refType: p.refType,
      refId: p.refId, party: party, amount: applied, method: p.method || 'Cash',
      note: p.note || '', recordedBy: user.name || user.username
    });
    cashEntry_({
      type: inbound ? 'receivable_payment' : 'payable_payment',
      direction: inbound ? 'in' : 'out', amount: applied, method: p.method || 'Cash',
      refType: p.refType, refId: p.refId,
      note: (inbound ? 'Payment from ' : 'Payment to ') + (party || p.refType),
      recordedBy: user.name || user.username
    });
    return { ok: true, applied: applied, balance: balance, status: status };
  });
}

/** Outstanding receivables: credit sales + invoices with balance > 0. */
function receivables_() {
  var list = [];
  getTable('Sales').forEach(function (s) {
    var bal = (Number(s.total) || 0) - (Number(s.amountPaid) || 0);
    if (bal > 0) list.push({
      refType: 'sale', refId: s.id, ref: s.ref, name: s.customerName || '—',
      total: Number(s.total) || 0, amountPaid: Number(s.amountPaid) || 0, balance: bal,
      dueDate: s.dueDate || '', date: s.date
    });
  });
  getTable('Invoices').forEach(function (v) {
    var bal = (Number(v.total) || 0) - (Number(v.amountPaid) || 0);
    if (bal > 0) list.push({
      refType: 'invoice', refId: v.id, ref: v.ref, name: v.customerName || '—',
      total: Number(v.total) || 0, amountPaid: Number(v.amountPaid) || 0, balance: bal,
      dueDate: v.dueDate || '', date: v.date
    });
  });
  return list;
}

/** Outstanding payables: purchases with balance > 0. */
function payables_() {
  var list = [];
  getTable('Purchases').forEach(function (p) {
    var bal = (Number(p.total) || 0) - (Number(p.amountPaid) || 0);
    if (bal > 0) list.push({
      refType: 'purchase', refId: p.id, ref: p.ref, name: p.supplierName || '—',
      total: Number(p.total) || 0, amountPaid: Number(p.amountPaid) || 0, balance: bal,
      dueDate: p.dueDate || '', date: p.date
    });
  });
  return list;
}

function apiReceivables(token) { requireRole_(token, ['owner', 'manager']); return receivables_(); }
function apiPayables(token) { requireRole_(token, ['owner', 'manager']); return payables_(); }
