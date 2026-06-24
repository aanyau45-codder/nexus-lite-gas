/** Products + Categories API. */

function normalizeProduct_(p) {
  if (!p) return null;
  return {
    id: p.id, name: p.name, sku: p.sku || '', barcode: String(p.barcode || ''),
    category: p.category || '', location: p.location || '', cost: Number(p.cost) || 0,
    price: Number(p.price) || 0, stock: Number(p.stock) || 0, lowStock: Number(p.lowStock) || 0,
    serials: p.serials || '', imageUrl: p.imageUrl || '', createdAt: p.createdAt, updatedAt: p.updatedAt
  };
}

/** Next auto SKU like PRD001, based on the highest existing PRD#### code. */
function nextProductSku_() {
  var max = 0;
  getTable('Products').forEach(function (p) {
    var m = /^PRD(\d+)$/i.exec(String(p.sku || '').trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'PRD' + ('000' + (max + 1)).slice(-3);
}

function apiGetProducts() {
  return getTable('Products').map(normalizeProduct_);
}

function apiGetCategories() {
  return getTable('Categories').map(function (c) { return { id: c.id, name: c.name }; });
}

function apiSaveCategory(token, name) {
  requireRole_(token, ['owner', 'manager']);
  name = String(name || '').trim();
  if (!name) throw new Error('Category name is required.');
  return withLock(function () {
    var ex = getTable('Categories').filter(function (c) {
      return String(c.name || '').toLowerCase() === name.toLowerCase();
    })[0];
    if (ex) return { id: ex.id, name: ex.name };
    var row = { id: uuid_(), name: name, createdAt: now_() };
    appendRow('Categories', row);
    return { id: row.id, name: row.name };
  });
}

function apiDeleteCategory(token, id) {
  requireRole_(token, ['owner', 'manager']);
  withLock(function () { deleteRow('Categories', id); });
  return { ok: true };
}

function apiSaveProduct(token, p, mode) {
  requireRole_(token, ['owner', 'manager']);
  return withLock(function () {
    // Duplicate guard for NEW products: warn unless told to merge or save-as-new.
    if (!p.id) {
      var dup = findProductDup_(p);
      if (dup && mode !== 'new' && mode !== 'merge') return { duplicate: normalizeProduct_(dup) };
      if (dup && mode === 'merge') {
        var add = Number(p.stock) || 0;
        updateRow('Products', dup.id, { stock: (Number(dup.stock) || 0) + add, updatedAt: now_() });
        if (add > 0) appendRow('StockMovements', {
          id: uuid_(), date: now_(), productId: dup.id, productName: dup.name,
          change: add, reason: 'restock', ref: '', note: 'Added to existing (duplicate)'
        });
        return normalizeProduct_(getById('Products', dup.id));
      }
    }
    if (p.id) {
      var before = getById('Products', p.id);
      updateRow('Products', p.id, {
        name: p.name, sku: p.sku || '', barcode: p.barcode || '', category: p.category || '',
        location: p.location || '', cost: Number(p.cost) || 0, price: Number(p.price) || 0,
        stock: Number(p.stock) || 0, lowStock: Number(p.lowStock) || 0,
        serials: p.serials || '', imageUrl: p.imageUrl || '', updatedAt: now_()
      });
      var after = getById('Products', p.id);
      if (before && Number(before.stock) !== Number(after.stock)) {
        appendRow('StockMovements', {
          id: uuid_(), date: now_(), productId: p.id, productName: after.name,
          change: Number(after.stock) - Number(before.stock), reason: 'adjustment', ref: '', note: 'Product edit'
        });
      }
      return normalizeProduct_(after);
    }
    var def = Number(readSettings_().lowStockDefault) || 5;
    var row = {
      id: uuid_(), name: p.name, sku: String(p.sku || '').trim() || nextProductSku_(),
      barcode: p.barcode || '', category: p.category || '', location: p.location || '',
      cost: Number(p.cost) || 0, price: Number(p.price) || 0, stock: Number(p.stock) || 0,
      lowStock: Number(p.lowStock) || def, serials: p.serials || '', imageUrl: p.imageUrl || '',
      createdAt: now_(), updatedAt: now_()
    };
    appendRow('Products', row);
    if (row.stock > 0) {
      appendRow('StockMovements', {
        id: uuid_(), date: now_(), productId: row.id, productName: row.name,
        change: row.stock, reason: 'new', ref: '', note: 'Opening stock'
      });
    }
    return normalizeProduct_(row);
  });
}

/** Add many products at once (bulk import). Blank-name rows are skipped. */
function apiBulkSaveProducts(token, list) {
  requireRole_(token, ['owner', 'manager']);
  list = list || [];
  if (!list.length) throw new Error('Nothing to add.');
  return withLock(function () {
    var def = Number(readSettings_().lowStockDefault) || 5;
    var count = 0;
    list.forEach(function (p) {
      var name = String(p.name || '').trim();
      if (!name) return;
      var row = {
        id: uuid_(), name: name, sku: String(p.sku || '').trim() || nextProductSku_(),
        barcode: p.barcode || '', category: p.category || '', location: p.location || '',
        cost: Number(p.cost) || 0, price: Number(p.price) || 0, stock: Number(p.stock) || 0,
        lowStock: Number(p.lowStock) || def, serials: p.serials || '', imageUrl: p.imageUrl || '',
        createdAt: now_(), updatedAt: now_()
      };
      appendRow('Products', row);
      if (row.stock > 0) {
        appendRow('StockMovements', {
          id: uuid_(), date: now_(), productId: row.id, productName: row.name,
          change: row.stock, reason: 'new', ref: '', note: 'Bulk add'
        });
      }
      count++;
    });
    return { ok: true, count: count };
  });
}

function apiDeleteProduct(token, id) {
  requireRole_(token, ['owner', 'manager']);
  withLock(function () { deleteRow('Products', id); });
  return { ok: true };
}

function apiRestock(token, id, qty, note) {
  requireRole_(token, ['owner', 'manager']);
  qty = Math.floor(Number(qty) || 0);
  if (qty <= 0) throw new Error('Enter a quantity above 0.');
  return withLock(function () {
    var p = getById('Products', id);
    if (!p) throw new Error('Product not found.');
    var next = (Number(p.stock) || 0) + qty;
    updateRow('Products', id, { stock: next, updatedAt: now_() });
    appendRow('StockMovements', {
      id: uuid_(), date: now_(), productId: id, productName: p.name,
      change: qty, reason: 'restock', ref: '', note: note || ''
    });
    return normalizeProduct_(getById('Products', id));
  });
}
