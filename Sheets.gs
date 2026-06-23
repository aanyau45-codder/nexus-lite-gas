/**
 * Generic "Google Sheet as a database" helpers.
 * Every tab: row 1 = headers; each subsequent row = one record.
 * All mutations go through withLock() so two cashiers can't clash.
 */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setupSheet() once.');
  return sh;
}

function listTabs() {
  return ss_().getSheets().map(function (s) { return s.getName(); });
}

/** Read a whole tab as an array of objects keyed by the header row. */
function getTable(name) {
  var values = sheet_(name).getDataRange().getValues();
  var headers = values.shift();
  if (!headers) return [];
  return values
    .filter(function (r) { return r.join('') !== ''; })
    .map(function (r) {
      var o = {};
      headers.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

function getById(name, id) {
  var rows = getTable(name);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

/** Append an object as a row, filling cells by header name. */
function appendRow(name, obj) {
  var sh = sheet_(name);
  var headers = sh.getDataRange().getValues()[0];
  sh.appendRow(headers.map(function (h) {
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  }));
  return obj;
}

/** Patch the row whose id matches; only provided fields are written. */
function updateRow(name, id, patch) {
  var sh = sheet_(name);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) throw new Error(name + ' has no id column.');
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      headers.forEach(function (h, c) {
        if (patch[h] !== undefined) sh.getRange(r + 1, c + 1).setValue(patch[h]);
      });
      return true;
    }
  }
  return false;
}

function deleteRow(name, id) {
  var sh = sheet_(name);
  var data = sh.getDataRange().getValues();
  var idCol = data[0].indexOf('id');
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) { sh.deleteRow(r + 1); return true; }
  }
  return false;
}

/** Serialise writes. */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---- small utilities --------------------------------------------------------
function uuid_() { return Utilities.getUuid(); }
function now_() { return new Date().toISOString(); }

/** Next human reference like R-000123, based on existing row count. */
function nextRef_(name, prefix) {
  var n = getTable(name).length + 1;
  return prefix + ('000000' + n).slice(-6);
}

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function truthy_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}
