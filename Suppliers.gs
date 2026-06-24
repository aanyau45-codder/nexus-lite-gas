/** Suppliers CRUD. */

function apiGetSuppliers(token) {
  requireUser_(token);
  return getTable('Suppliers').map(function (s) {
    return { id: s.id, name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' };
  });
}

function apiSaveSupplier(token, sup) {
  requireRole_(token, ['owner', 'manager']);
  sup = sup || {};
  if (!String(sup.name || '').trim()) throw new Error('Supplier name is required.');
  return withLock(function () {
    if (sup.id) {
      updateRow('Suppliers', sup.id, {
        name: sup.name, phone: sup.phone || '', email: sup.email || '', address: sup.address || ''
      });
      return getById('Suppliers', sup.id);
    }
    var row = {
      id: uuid_(), name: sup.name, phone: sup.phone || '', email: sup.email || '',
      address: sup.address || '', createdAt: now_()
    };
    appendRow('Suppliers', row);
    return row;
  });
}

function apiDeleteSupplier(token, id) {
  requireRole_(token, ['owner', 'manager']);
  withLock(function () { deleteRow('Suppliers', id); });
  return { ok: true };
}
