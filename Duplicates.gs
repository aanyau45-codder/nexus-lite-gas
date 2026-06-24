/**
 * Duplicate prevention + reconciliation.
 * - On save, products/customers/suppliers are checked for an existing match.
 *   The save APIs return { duplicate: <existing> } so the client can prompt
 *   (use existing / add-to-existing / save anyway).
 * - apiFindDuplicates scans for groups already in the data; apiMerge* merges a
 *   group into one kept record, re-pointing history.
 */
function dnorm_(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function dphone_(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

/** Re-point every row in `table` where `field` equals `from` to `to`. */
function repoint_(table, field, from, to) {
  if (from == null || String(from) === '') return;
  var sh = sheet_(table);
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf(field);
  if (col < 0) return;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][col]) === String(from)) sh.getRange(r + 1, col + 1).setValue(to);
  }
}

function findProductDup_(p) {
  var name = dnorm_(p.name), sku = String(p.sku || '').trim().toLowerCase(), bar = String(p.barcode || '').trim();
  var hit = null;
  getTable('Products').forEach(function (x) {
    if (hit) return;
    var xs = String(x.sku || '').trim().toLowerCase();
    if (sku && xs && xs === sku) hit = x;
    else if (bar && String(x.barcode || '').trim() === bar) hit = x;
    else if (name && dnorm_(x.name) === name) hit = x;
  });
  return hit;
}

function findContactDup_(table, c) {
  var name = dnorm_(c.name), ph = dphone_(c.phone);
  var hit = null;
  getTable(table).forEach(function (x) {
    if (hit) return;
    if (ph && dphone_(x.phone) === ph) hit = x;
    else if (name && dnorm_(x.name) === name) hit = x;
  });
  return hit;
}

function dupGroups_(table, keyFn, fields) {
  var map = {};
  getTable(table).forEach(function (x) {
    var k = keyFn(x); if (!k) return;
    (map[k] = map[k] || []).push(x);
  });
  var groups = [];
  Object.keys(map).forEach(function (k) {
    if (map[k].length > 1) {
      groups.push(map[k].map(function (x) {
        var o = {}; fields.forEach(function (f) { o[f] = x[f]; }); return o;
      }));
    }
  });
  return groups;
}

function apiFindDuplicates(token) {
  requireRole_(token, ['owner', 'manager']);
  return {
    products: dupGroups_('Products', function (x) { return String(x.sku || '').trim().toLowerCase() || dnorm_(x.name); }, ['id', 'name', 'sku', 'stock', 'price']),
    customers: dupGroups_('Customers', function (x) { return dphone_(x.phone) || dnorm_(x.name); }, ['id', 'name', 'phone', 'email']),
    suppliers: dupGroups_('Suppliers', function (x) { return dphone_(x.phone) || dnorm_(x.name); }, ['id', 'name', 'phone', 'email'])
  };
}

/** Merge duplicate products into keepId: sum stock, move history, delete the rest. */
function apiMergeProducts(token, keepId, mergeIds) {
  requireRole_(token, ['owner', 'manager']);
  mergeIds = (mergeIds || []).filter(function (id) { return String(id) !== String(keepId); });
  if (!keepId || !mergeIds.length) throw new Error('Pick at least one record to merge in.');
  return withLock(function () {
    var keep = getById('Products', keepId);
    if (!keep) throw new Error('The kept product was not found.');
    var addStock = 0, serials = String(keep.serials || '');
    mergeIds.forEach(function (id) {
      var m = getById('Products', id); if (!m) return;
      addStock += Number(m.stock) || 0;
      if (m.serials) serials += (serials ? '\n' : '') + m.serials;
      ['SaleItems', 'StockMovements', 'PurchaseItems', 'POItems', 'InvoiceItems'].forEach(function (t) {
        repoint_(t, 'productId', id, keepId);
      });
      deleteRow('Products', id);
    });
    updateRow('Products', keepId, { stock: (Number(keep.stock) || 0) + addStock, serials: serials, updatedAt: now_() });
    appendRow('StockMovements', {
      id: uuid_(), date: now_(), productId: keepId, productName: keep.name,
      change: 0, reason: 'adjustment', ref: '', note: 'Merged ' + mergeIds.length + ' duplicate(s)'
    });
    return { ok: true, merged: mergeIds.length };
  });
}

/** Merge duplicate customers/suppliers into keepId, re-pointing their documents. */
function apiMergeContacts(token, entity, keepId, mergeIds) {
  requireRole_(token, ['owner', 'manager']);
  mergeIds = (mergeIds || []).filter(function (id) { return String(id) !== String(keepId); });
  if (!keepId || !mergeIds.length) throw new Error('Pick at least one record to merge in.');
  var table = entity === 'supplier' ? 'Suppliers' : 'Customers';
  return withLock(function () {
    var keep = getById(table, keepId);
    if (!keep) throw new Error('The kept record was not found.');
    mergeIds.forEach(function (id) {
      var m = getById(table, id); if (!m) return;
      if (entity === 'supplier') {
        repoint_('Purchases', 'supplierId', id, keepId); repoint_('Purchases', 'supplierName', m.name, keep.name);
        repoint_('PurchaseOrders', 'supplierId', id, keepId); repoint_('PurchaseOrders', 'supplierName', m.name, keep.name);
      } else {
        repoint_('Sales', 'customerId', id, keepId); repoint_('Sales', 'customerName', m.name, keep.name);
        repoint_('Invoices', 'customerId', id, keepId); repoint_('Invoices', 'customerName', m.name, keep.name);
      }
      deleteRow(table, id);
    });
    return { ok: true, merged: mergeIds.length };
  });
}
