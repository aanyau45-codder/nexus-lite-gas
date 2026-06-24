/**
 * Purchase Orders — track what's been ordered before it arrives.
 * Lifecycle: ordered → shipped → received. On "received", the ordered quantities
 * are added to inventory (cost updated) and logged as stock movements. Receiving
 * is idempotent (stock is only added once, guarded by receivedAt).
 *
 * A PO is procurement tracking only; if you owe the supplier money, record that
 * separately as a Credit Purchase (which creates the payable).
 */
var PO_STATUSES = { ordered: 1, shipped: 1, received: 1, cancelled: 1 };

function apiCreatePurchaseOrder(token, draft) {
  requireRole_(token, ['owner', 'manager']);
  draft = draft || {};
  var items = draft.items || [];
  return withLock(function () {
    var pmap = {};
    getTable('Products').forEach(function (p) { pmap[String(p.id)] = p; });
    var total = 0, lines = [];
    items.forEach(function (it) {
      var qty = Math.floor(Number(it.qty) || 0);
      var cost = Number(it.cost) || 0;
      if (qty <= 0) return;
      var sub = qty * cost; total += sub;
      var prod = it.productId ? pmap[String(it.productId)] : null;
      lines.push({ productId: prod ? prod.id : '', name: prod ? prod.name : (it.name || 'Item'), qty: qty, cost: cost, sub: sub });
    });
    if (!lines.length) throw new Error('Add at least one item with a quantity.');
    var id = uuid_(), ref = nextRef_('PurchaseOrders', 'PO-'), date = now_();
    appendRow('PurchaseOrders', {
      id: id, ref: ref, date: date, expectedDate: draft.expectedDate || '',
      supplierId: draft.supplierId || '', supplierName: draft.supplierName || '',
      status: 'ordered', total: total, note: draft.note || '',
      createdAt: date, updatedAt: date, receivedAt: ''
    });
    lines.forEach(function (l) {
      appendRow('POItems', { id: uuid_(), poId: id, productId: l.productId, name: l.name, qty: l.qty, cost: l.cost, subtotal: l.sub });
    });
    return apiGetPurchaseOrder(token, id);
  });
}

function apiGetPurchaseOrders(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var rows = getTable('PurchaseOrders');
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

function apiGetPurchaseOrder(token, id) {
  requireRole_(token, ['owner', 'manager']);
  return {
    po: getById('PurchaseOrders', id),
    items: getTable('POItems').filter(function (x) { return String(x.poId) === String(id); })
  };
}

/** Advance a PO's status. Receiving (once) adds the ordered stock to inventory. */
function apiSetPurchaseOrderStatus(token, id, status) {
  requireRole_(token, ['owner', 'manager']);
  if (!PO_STATUSES[status]) throw new Error('Unknown status.');
  return withLock(function () {
    var po = getById('PurchaseOrders', id);
    if (!po) throw new Error('Purchase order not found.');
    var alreadyReceived = !!po.receivedAt;
    var patch = { status: status, updatedAt: now_() };
    if (status === 'received' && !alreadyReceived) {
      var date = now_();
      patch.receivedAt = date;
      var pmap = {};
      getTable('Products').forEach(function (p) { pmap[String(p.id)] = p; });
      getTable('POItems').filter(function (x) { return String(x.poId) === String(id); }).forEach(function (it) {
        var prod = it.productId ? pmap[String(it.productId)] : null;
        if (!prod) return;
        var next = (Number(prod.stock) || 0) + (Number(it.qty) || 0);
        updateRow('Products', prod.id, { stock: next, cost: Number(it.cost) || prod.cost, updatedAt: date });
        appendRow('StockMovements', {
          id: uuid_(), date: date, productId: prod.id, productName: prod.name,
          change: Number(it.qty) || 0, reason: 'restock', ref: po.ref, note: 'PO received'
        });
      });
    }
    updateRow('PurchaseOrders', id, patch);
    return apiGetPurchaseOrder(token, id);
  });
}

function apiDeletePurchaseOrder(token, id) {
  requireRole_(token, ['owner', 'manager']);
  withLock(function () {
    getTable('POItems').filter(function (x) { return String(x.poId) === String(id); }).forEach(function (x) { deleteRow('POItems', x.id); });
    deleteRow('PurchaseOrders', id);
  });
  return { ok: true };
}

/** Stock movement log, optionally filtered by date, for the movements report. */
function apiGetStockMovements(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var rows = getTable('StockMovements');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}
