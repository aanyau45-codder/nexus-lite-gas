/**
 * Nexus Lite — Apps Script POS / Inventory.
 * The bound Google Sheet is the database (see Setup.gs). The browser SPA talks to
 * these api* functions via google.script.run. Deploy as a Web app (Execute as Me,
 * Anyone with the link). After the first push, run ensureSeed() once.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Nexus Lite')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Inject another HTML file (used by index.html for styles + app). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Health check — proves the client⇄server bridge works. */
function apiPing() {
  return { ok: true, time: now_(), tabs: listTabs() };
}

/** What the SPA loads on boot (before login). Seeds the DB on first run. */
function apiBootstrap() {
  ensureSeed();
  // Return the full settings (no secrets here) so the client has currency, VAT,
  // logo, hasStore, etc. available before login.
  return {
    ok: true,
    settings: readSettings_(),
    version: '1.1'
  };
}
