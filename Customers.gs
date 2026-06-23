/** Customers API. */

function apiGetCustomers(token) {
  requireUser_(token);
  return getTable('Customers');
}

function apiSaveCustomer(token, c) {
  requireUser_(token);
  if (!String(c.name || '').trim()) throw new Error('Customer name is required.');
  return withLock(function () {
    if (c.id) {
      updateRow('Customers', c.id, {
        name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || ''
      });
      return getById('Customers', c.id);
    }
    var row = {
      id: uuid_(), name: c.name, phone: c.phone || '', email: c.email || '',
      address: c.address || '', createdAt: now_()
    };
    appendRow('Customers', row);
    return row;
  });
}

function apiDeleteCustomer(token, id) {
  requireRole_(token, ['owner', 'manager']);
  withLock(function () { deleteRow('Customers', id); });
  return { ok: true };
}
