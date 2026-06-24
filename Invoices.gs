/**
 * Invoices: create, EDIT, list, detail, delete. An invoice is a priced document
 * for a customer (does not move stock — it's a bill). Editable per the brief:
 * apiUpdateInvoice recomputes totals and replaces the line items.
 */
function invoiceCompute_(draft) {
  var pmap = {};
  getTable('Products').forEach(function (p) { pmap[String(p.id)] = p; });
  var itemsSubtotal = 0, lines = [];
  (draft.items || []).forEach(function (it) {
    var qty = Math.floor(Number(it.qty) || 0);
    if (qty <= 0) return;
    var prod = it.productId ? pmap[String(it.productId)] : null;
    var price = (it.price != null && it.price !== '') ? Number(it.price) : (prod ? Number(prod.price) || 0 : 0);
    var sub = price * qty; itemsSubtotal += sub;
    lines.push({
      productId: prod ? prod.id : '', name: prod ? prod.name : (it.name || 'Item'),
      sku: prod ? (prod.sku || '') : (it.sku || ''), price: price, qty: qty, subtotal: sub
    });
  });
  var discount = Math.max(0, Number(draft.discount) || 0);
  if (draft.discountType === 'pct') discount = Math.round(itemsSubtotal * Math.min(100, Number(draft.discount) || 0) / 100);
  if (discount > itemsSubtotal) discount = itemsSubtotal;
  var s = readSettings_();
  var taxable = itemsSubtotal - discount;
  var tax = s.vatEnabled ? Math.round(taxable * (Number(s.vatRate) || 0) / 100) : 0;
  return { itemsSubtotal: itemsSubtotal, discount: discount, tax: tax, total: taxable + tax, lines: lines };
}

function apiCreateInvoice(token, draft) {
  var user = requireRole_(token, ['owner', 'manager']);
  draft = draft || {};
  if (!(draft.items || []).length) throw new Error('Add at least one item.');
  return withLock(function () {
    var c = invoiceCompute_(draft);
    if (!c.lines.length) throw new Error('Add at least one item with a quantity.');
    var amountPaid = Math.max(0, Number(draft.amountPaid) || 0);
    if (amountPaid > c.total) amountPaid = c.total;
    var balance = c.total - amountPaid;
    var status = balance <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');
    var id = uuid_(), ref = nextRef_('Invoices', 'INV-'), date = now_();
    appendRow('Invoices', {
      id: id, ref: ref, date: date, dueDate: draft.dueDate || '',
      customerId: draft.customerId || '', customerName: draft.customerName || '',
      itemsSubtotal: c.itemsSubtotal, discount: c.discount, tax: c.tax, total: c.total,
      amountPaid: amountPaid, balance: balance, status: status, notes: draft.notes || '',
      createdAt: date, updatedAt: date
    });
    c.lines.forEach(function (l) {
      appendRow('InvoiceItems', {
        id: uuid_(), invoiceId: id, productId: l.productId, name: l.name,
        sku: l.sku, price: l.price, qty: l.qty, subtotal: l.subtotal
      });
    });
    if (amountPaid > 0) {
      cashEntry_({
        type: 'invoice_payment', direction: 'in', amount: amountPaid, method: draft.method || 'Cash',
        refType: 'invoice', refId: id, note: 'Invoice ' + ref, recordedBy: user.name || user.username, date: date
      });
    }
    return apiGetInvoice(token, id);
  });
}

function apiUpdateInvoice(token, draft) {
  requireRole_(token, ['owner', 'manager']);
  draft = draft || {};
  if (!draft.id) throw new Error('Missing invoice id.');
  return withLock(function () {
    var inv = getById('Invoices', draft.id);
    if (!inv) throw new Error('Invoice not found.');
    var c = invoiceCompute_(draft);
    var amountPaid = draft.amountPaid != null ? Math.max(0, Number(draft.amountPaid) || 0) : (Number(inv.amountPaid) || 0);
    if (amountPaid > c.total) amountPaid = c.total;
    var balance = c.total - amountPaid;
    var status = balance <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');
    updateRow('Invoices', draft.id, {
      dueDate: draft.dueDate != null ? draft.dueDate : inv.dueDate,
      customerId: draft.customerId != null ? draft.customerId : inv.customerId,
      customerName: draft.customerName != null ? draft.customerName : inv.customerName,
      itemsSubtotal: c.itemsSubtotal, discount: c.discount, tax: c.tax, total: c.total,
      amountPaid: amountPaid, balance: balance, status: status,
      notes: draft.notes != null ? draft.notes : inv.notes, updatedAt: now_()
    });
    getTable('InvoiceItems').filter(function (x) { return String(x.invoiceId) === String(draft.id); })
      .forEach(function (x) { deleteRow('InvoiceItems', x.id); });
    c.lines.forEach(function (l) {
      appendRow('InvoiceItems', {
        id: uuid_(), invoiceId: draft.id, productId: l.productId, name: l.name,
        sku: l.sku, price: l.price, qty: l.qty, subtotal: l.subtotal
      });
    });
    return apiGetInvoice(token, draft.id);
  });
}

function apiGetInvoices(token, opts) {
  requireRole_(token, ['owner', 'manager']);
  opts = opts || {};
  var rows = getTable('Invoices');
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

function apiGetInvoice(token, id) {
  requireRole_(token, ['owner', 'manager']);
  return {
    invoice: getById('Invoices', id),
    items: getTable('InvoiceItems').filter(function (x) { return String(x.invoiceId) === String(id); })
  };
}

function apiDeleteInvoice(token, id) {
  requireRole_(token, ['owner', 'manager']);
  withLock(function () {
    getTable('InvoiceItems').filter(function (x) { return String(x.invoiceId) === String(id); })
      .forEach(function (x) { deleteRow('InvoiceItems', x.id); });
    deleteRow('Invoices', id);
  });
  return { ok: true };
}
