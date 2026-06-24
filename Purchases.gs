/**
 * Credit purchases: buy stock from a supplier. Adds stock, updates cost, and
 * creates a payable for the unpaid balance. Any amount paid now leaves the till.
 */
function apiCreatePurchase(token, draft) {
  var user = requireRole_(token, ['owner', 'manager']);
  var items = (draft && draft.items) || [];
  if (!items.length) throw new Error('Add at least one item.');

  return withLock(function () {
    var pmap = {};
    getTable('Products').forEach(function (p) { pmap[String(p.id)] = p; });

    var total = 0, lines = [];
    items.forEach(function (it) {
      var qty = Math.floor(Number(it.qty) || 0);
      var cost = Number(it.cost) || 0;
      if (qty <= 0) return;
      var sub = qty * cost; total += sub;
      lines.push({ it: it, qty: qty, cost: cost, sub: sub });
    });
    if (!lines.length) throw new Error('Add at least one item with a quantity.');

    var amountPaid = Math.max(0, Number(draft.amountPaid) || 0);
    if (amountPaid > total) amountPaid = total;
    var balance = total - amountPaid;
    var status = balance <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');
    var id = uuid_(), ref = nextRef_('Purchases', 'P-'), date = now_();

    appendRow('Purchases', {
      id: id, ref: ref, date: date, dueDate: draft.dueDate || '',
      supplierId: draft.supplierId || '', supplierName: draft.supplierName || '',
      total: total, amountPaid: amountPaid, balance: balance, status: status,
      note: draft.note || '', createdAt: date, updatedAt: date
    });

    lines.forEach(function (l) {
      var prod = l.it.productId ? pmap[String(l.it.productId)] : null;
      var name = prod ? prod.name : (l.it.name || 'Item');
      appendRow('PurchaseItems', {
        id: uuid_(), purchaseId: id, productId: prod ? prod.id : '',
        name: name, qty: l.qty, cost: l.cost, subtotal: l.sub
      });
      if (prod) {
        var next = (Number(prod.stock) || 0) + l.qty;
        updateRow('Products', prod.id, { stock: next, cost: l.cost || prod.cost, updatedAt: date });
        appendRow('StockMovements', {
          id: uuid_(), date: date, productId: prod.id, productName: prod.name,
          change: l.qty, reason: 'restock', ref: ref, note: 'Purchase ' + ref
        });
      }
    });

    if (amountPaid > 0) {
      cashEntry_({
        type: 'purchase', direction: 'out', amount: amountPaid, method: draft.method || 'Cash',
        refType: 'purchase', refId: id, note: 'Purchase ' + ref, recordedBy: user.name || user.username, date: date
      });
    }
    return apiGetPurchase(token, id);
  });
}

function apiGetPurchases(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var rows = getTable('Purchases');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

function apiGetPurchase(token, id) {
  requireRole_(token, ['owner', 'manager']);
  return {
    purchase: getById('Purchases', id),
    items: getTable('PurchaseItems').filter(function (x) { return String(x.purchaseId) === String(id); })
  };
}
