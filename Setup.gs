/**
 * One-time database setup + seed. After the first `clasp push`, open the Apps
 * Script editor and run ensureSeed() once (authorize when prompted). apiBootstrap()
 * also seeds lazily so the app is never empty.
 */
var SCHEMA = {
  Settings:       ['businessName', 'currency', 'phone', 'address', 'vatEnabled', 'vatRate', 'lowStockDefault', 'receiptFooter', 'logoUrl', 'theme', 'hasStore'],
  Users:          ['id', 'name', 'username', 'email', 'passwordHash', 'role', 'active', 'createdAt'],
  Categories:     ['id', 'name', 'createdAt'],
  Products:       ['id', 'name', 'sku', 'barcode', 'category', 'location', 'cost', 'price', 'stock', 'lowStock', 'serials', 'imageUrl', 'createdAt', 'updatedAt'],
  Customers:      ['id', 'name', 'phone', 'email', 'address', 'createdAt'],
  Sales:          ['id', 'ref', 'date', 'customerId', 'customerName', 'itemsSubtotal', 'discount', 'tax', 'total', 'paymentMethod', 'amountPaid', 'changeDue', 'cashier'],
  SaleItems:      ['id', 'saleId', 'productId', 'name', 'sku', 'price', 'qty', 'subtotal'],
  StockMovements: ['id', 'date', 'productId', 'productName', 'change', 'reason', 'ref', 'note'],
  Expenses:       ['id', 'date', 'category', 'amount', 'note', 'recordedBy'],
  CashFlow:       ['id', 'date', 'type', 'direction', 'amount', 'method', 'refType', 'refId', 'note', 'recordedBy']
};

/**
 * Create any missing tabs, write their header rows, and add any columns that are
 * in SCHEMA but not yet in an existing tab (so the schema can evolve safely).
 * Safe to re-run.
 */
function setupSheet() {
  var ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA[name];
    var lastCol = sh.getLastColumn();
    var firstRow = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    if (firstRow.join('') === '') {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      // schema evolution: append any headers not already present
      var existing = firstRow.map(function (h) { return String(h); });
      var missing = headers.filter(function (h) { return existing.indexOf(h) < 0; });
      if (missing.length) {
        sh.getRange(1, existing.length + 1, 1, missing.length)
          .setValues([missing]).setFontWeight('bold');
      }
    }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);
  return listTabs();
}

/** Ensure a Settings row + an owner login exist. Safe to re-run. */
function ensureSeed() {
  setupSheet();
  if (getTable('Settings').length === 0) {
    appendRow('Settings', {
      businessName: 'My Shop', currency: 'UGX', phone: '', address: '',
      vatEnabled: false, vatRate: 18, lowStockDefault: 5,
      receiptFooter: 'Thank you for your business!', logoUrl: '', theme: 'light'
    });
  }
  if (getTable('Users').length === 0) {
    appendRow('Users', {
      id: uuid_(), name: 'Owner', username: 'owner', email: '',
      passwordHash: sha256Hex_('owner123'), role: 'owner', active: true, createdAt: now_()
    });
  }
  return { ok: true, note: 'Seeded. Default login: owner / owner123 — change it in Settings.' };
}

function readSettings_() {
  var rows = getTable('Settings');
  var s = rows.length ? rows[0] : {
    businessName: 'My Shop', currency: 'UGX', vatEnabled: false, vatRate: 18,
    lowStockDefault: 5, receiptFooter: 'Thank you for your business!', logoUrl: '', theme: 'light'
  };
  // normalise types for the client
  s.vatEnabled = truthy_(s.vatEnabled);
  s.hasStore = truthy_(s.hasStore);
  s.vatRate = Number(s.vatRate) || 0;
  s.lowStockDefault = Number(s.lowStockDefault) || 5;
  return s;
}

/** The Settings tab has no id column, so it's edited as a single fixed row. */
function writeSettingsRow_(patch) {
  var sh = sheet_('Settings');
  var headers = sh.getDataRange().getValues()[0];
  if (sh.getLastRow() < 2) {
    sh.appendRow(headers.map(function (h) { return patch[h] !== undefined ? patch[h] : ''; }));
    return;
  }
  headers.forEach(function (h, c) {
    if (patch[h] !== undefined) sh.getRange(2, c + 1).setValue(patch[h]);
  });
}
