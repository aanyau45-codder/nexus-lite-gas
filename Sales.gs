/** Sales: complete a sale (server re-prices + decrements stock), list, detail. */

function apiCreateSale(token, draft) {
  var user = requireUser_(token);
  var items = (draft && draft.items) || [];
  if (!items.length) throw new Error('The cart is empty.');

  return withLock(function () {
    var products = getTable('Products');
    var pmap = {};
    products.forEach(function (p) { pmap[String(p.id)] = p; });

    var itemsSubtotal = 0;
    var lines = [];
    items.forEach(function (it) {
      var p = pmap[String(it.productId)];
      if (!p) throw new Error('A product in the cart no longer exists. Refresh and try again.');
      var qty = Math.floor(Number(it.qty) || 0);
      if (qty <= 0) throw new Error('Invalid quantity for ' + (p.name || 'an item') + '.');
      var price = Number(p.price) || 0;          // SERVER price — ignore client price
      var sub = price * qty;
      itemsSubtotal += sub;
      lines.push({ product: p, qty: qty, price: price, sub: sub });
    });

    // discount: flat amount or percent
    var discount = Math.max(0, Number(draft.discount) || 0);
    if (draft.discountType === 'pct') {
      discount = Math.round(itemsSubtotal * Math.min(100, Number(draft.discount) || 0) / 100);
    }
    if (discount > itemsSubtotal) discount = itemsSubtotal;

    var s = readSettings_();
    var taxable = itemsSubtotal - discount;
    var tax = s.vatEnabled ? Math.round(taxable * (Number(s.vatRate) || 0) / 100) : 0;
    var total = taxable + tax;
    var amountPaid = Number(draft.amountPaid) || total;
    var changeDue = Math.max(0, amountPaid - total);

    var ref = nextRef_('Sales', 'R-');
    var saleId = uuid_();
    var date = now_();

    appendRow('Sales', {
      id: saleId, ref: ref, date: date,
      customerId: draft.customerId || '', customerName: draft.customerName || '',
      itemsSubtotal: itemsSubtotal, discount: discount, tax: tax, total: total,
      paymentMethod: draft.paymentMethod || 'Cash', amountPaid: amountPaid,
      changeDue: changeDue, cashier: user.name || user.username
    });

    lines.forEach(function (l) {
      appendRow('SaleItems', {
        id: uuid_(), saleId: saleId, productId: l.product.id, name: l.product.name,
        sku: l.product.sku || '', price: l.price, qty: l.qty, subtotal: l.sub
      });
      var left = Math.max(0, (Number(l.product.stock) || 0) - l.qty);
      updateRow('Products', l.product.id, { stock: left, updatedAt: date });
      appendRow('StockMovements', {
        id: uuid_(), date: date, productId: l.product.id, productName: l.product.name,
        change: -l.qty, reason: 'sale', ref: ref, note: ''
      });
    });

    return {
      sale: getById('Sales', saleId),
      items: getTable('SaleItems').filter(function (x) { return String(x.saleId) === String(saleId); })
    };
  });
}

function apiGetSales(token, opts) {
  requireUser_(token);
  opts = opts || {};
  var rows = getTable('Sales');
  if (opts.from) rows = rows.filter(function (r) { return String(r.date) >= opts.from; });
  if (opts.to) rows = rows.filter(function (r) { return String(r.date) <= opts.to + 'T23:59:59'; });
  rows.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

function apiGetSale(token, id) {
  requireUser_(token);
  return {
    sale: getById('Sales', id),
    items: getTable('SaleItems').filter(function (x) { return String(x.saleId) === String(id); })
  };
}
