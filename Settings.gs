/** Settings + Users management. */

function apiGetSettings() { return readSettings_(); }

function apiSaveSettings(token, patch) {
  requireRole_(token, ['owner', 'manager']);
  return withLock(function () {
    var clean = {};
    ['businessName', 'currency', 'phone', 'address', 'vatEnabled', 'vatRate',
     'lowStockDefault', 'receiptFooter', 'logoUrl', 'theme'].forEach(function (k) {
      if (patch[k] !== undefined) clean[k] = patch[k];
    });
    if (clean.vatEnabled !== undefined) clean.vatEnabled = truthy_(clean.vatEnabled);
    writeSettingsRow_(clean);
    return readSettings_();
  });
}

function apiGetUsers(token) {
  requireRole_(token, ['owner', 'manager']);
  return getTable('Users').map(publicUser_);
}

function apiSaveUser(token, user) {
  requireRole_(token, ['owner', 'manager']);
  return withLock(function () {
    if (user.id) {
      var patch = {
        name: user.name, username: user.username, email: user.email || '',
        role: user.role, active: user.active !== false
      };
      if (user.password) patch.passwordHash = sha256Hex_(user.password);
      updateRow('Users', user.id, patch);
      return publicUser_(getById('Users', user.id));
    }
    var taken = getTable('Users').filter(function (x) {
      return String(x.username || '').toLowerCase() === String(user.username || '').toLowerCase();
    })[0];
    if (taken) throw new Error('That username is already taken.');
    var row = {
      id: uuid_(), name: user.name, username: user.username, email: user.email || '',
      passwordHash: sha256Hex_(user.password || '1234'), role: user.role || 'cashier',
      active: true, createdAt: now_()
    };
    appendRow('Users', row);
    return publicUser_(row);
  });
}

function apiDeleteUser(token, id) {
  var me = requireRole_(token, ['owner']);
  if (String(me.id) === String(id)) throw new Error("You can't delete your own account.");
  withLock(function () { deleteRow('Users', id); });
  return { ok: true };
}
