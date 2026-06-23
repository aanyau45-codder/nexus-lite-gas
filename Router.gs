/**
 * Router.gs — JSON API for the Cloudflare-hosted frontend.
 *
 * The static frontend (web/) can't use google.script.run, so it POSTs
 * { fn, args } to this Web App's /exec URL instead. We send the body as
 * text/plain (a CORS "simple request"), so the browser skips the preflight
 * OPTIONS that Apps Script can't answer; the redirected response carries
 * Access-Control-Allow-Origin:* so the result is readable cross-origin.
 *
 * This is purely additive: doGet() (Code.gs) still serves the original SPA via
 * google.script.run, so the Google-hosted app keeps working unchanged.
 */

// Only these server functions may be invoked from the public JSON endpoint.
var API_ALLOW = {
  apiPing: 1, apiBootstrap: 1, apiLogin: 1, apiForgotPassword: 1, apiMe: 1, apiLogout: 1,
  apiGetProducts: 1, apiGetCategories: 1, apiDashboard: 1, apiCreateSale: 1,
  apiGetSales: 1, apiGetSale: 1, apiSaveProduct: 1, apiSaveCategory: 1, apiRestock: 1,
  apiDeleteProduct: 1, apiDeleteCategory: 1, apiGetCustomers: 1, apiSaveCustomer: 1,
  apiDeleteCustomer: 1, apiSalesSummary: 1, apiInventoryValue: 1, apiSaveSettings: 1,
  apiChangePassword: 1, apiGetUsers: 1, apiSaveUser: 1, apiDeleteUser: 1
};

function doPost(e) {
  var out;
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    var fn = body.fn;
    var args = Array.isArray(body.args) ? body.args : [];
    if (!fn || !API_ALLOW[fn]) throw new Error('Unknown action: ' + fn);
    if (typeof globalThis[fn] !== 'function') throw new Error('Action not available: ' + fn);
    out = { ok: true, data: globalThis[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: (err && err.message) || String(err) };
  }
  return jsonOut_(out);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
