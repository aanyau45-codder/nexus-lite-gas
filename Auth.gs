/**
 * Authentication: sheet-based users, SHA-256 hashed passwords, token sessions in
 * CacheService (~6h). Forgot-password emails a temporary password via MailApp
 * (sent from the deploying Google account). Roles: owner | manager | cashier.
 */
function sessionPut_(token, userId) { CacheService.getScriptCache().put('sess_' + token, String(userId), 21600); }
function sessionGet_(token) { return token ? CacheService.getScriptCache().get('sess_' + token) : null; }
function sessionDel_(token) { if (token) CacheService.getScriptCache().remove('sess_' + token); }

function publicUser_(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, username: u.username, email: u.email || '', role: u.role, active: truthy_(u.active) };
}

function findUserByLogin_(identifier) {
  var id = String(identifier || '').trim().toLowerCase();
  return getTable('Users').filter(function (x) {
    return String(x.username || '').toLowerCase() === id || String(x.email || '').toLowerCase() === id;
  })[0] || null;
}

function apiLogin(username, password) {
  var u = findUserByLogin_(username);
  if (!u || !truthy_(u.active)) throw new Error('Invalid login or inactive account.');
  if (String(u.passwordHash) !== sha256Hex_(password)) throw new Error('Wrong username or password.');
  var t = uuid_();
  sessionPut_(t, u.id);
  return { token: t, user: publicUser_(u) };
}

function apiMe(token) {
  var uid = sessionGet_(token);
  if (!uid) throw new Error('Session expired. Please log in.');
  var u = getById('Users', uid);
  if (!u) throw new Error('Account not found.');
  return publicUser_(u);
}

function apiLogout(token) { sessionDel_(token); return { ok: true }; }

function requireUser_(token) {
  var uid = sessionGet_(token);
  if (!uid) throw new Error('Not authorized. Please log in.');
  var u = getById('Users', uid);
  if (!u) throw new Error('Account not found.');
  return u;
}

function requireRole_(token, roles) {
  var u = requireUser_(token);
  if (roles.indexOf(u.role) < 0) throw new Error('You do not have permission to do that.');
  return u;
}

/** Email a temporary password if an account (by username or email) has an email on file. */
function apiForgotPassword(identifier) {
  var u = findUserByLogin_(identifier);
  if (u && u.email) {
    var temp = Math.random().toString(36).slice(-8);
    withLock(function () { updateRow('Users', u.id, { passwordHash: sha256Hex_(temp) }); });
    var biz = readSettings_().businessName || 'Nexus Lite';
    try {
      MailApp.sendEmail(u.email, biz + ' — password reset',
        'Hello ' + (u.name || '') + ',\n\n' +
        'Your temporary password is: ' + temp + '\n\n' +
        'Log in with it, then change your password in Settings.\n\n— ' + biz);
    } catch (e) { /* mail quota / scope — still return generic message */ }
  }
  return { ok: true, message: 'If an account with that email exists, a temporary password has been sent.' };
}

function apiChangePassword(token, currentPassword, newPassword) {
  var u = requireUser_(token);
  if (String(u.passwordHash) !== sha256Hex_(currentPassword)) throw new Error('Current password is wrong.');
  if (String(newPassword || '').length < 4) throw new Error('New password must be at least 4 characters.');
  withLock(function () { updateRow('Users', u.id, { passwordHash: sha256Hex_(newPassword) }); });
  return { ok: true };
}
