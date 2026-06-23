# Build Instructions: Nexus Lite (Google Apps Script Edition)

**Goal:** A responsive **Inventory + POS (Point of Sale)** web app for a small shop, with
**Google Apps Script + a Google Sheet as the entire backend/database**, and a **vanilla
HTML/CSS/JS** front end served by Apps Script's `HtmlService`. No frameworks, no build step.
One Google account, one Sheet, one deployed Web App URL.

> This is a from-scratch rebuild of a larger Next.js/Supabase POS, simplified to fit the
> Apps Script model. Build it module by module in the order in **§12 Build Plan**.

---

## 1. Stack & Hard Rules

- **Backend:** Google Apps Script (`.gs` server files). A **Google Sheet** is the database —
  one tab per "table", row 1 = headers.
- **Frontend:** One HTML app shell + CSS + JS, served via `HtmlService`. A **single-page app**
  with hash-based view switching (`#/pos`, `#/inventory`, …). **No React/Vue/Tailwind/jQuery.**
  Plain ES2020+ JS only.
- **Client⇄Server bridge:** `google.script.run` (async, callback-based). Wrap it in a Promise
  helper (`api()` in §6) and use `async/await` everywhere on the client.
- **No external DB, no npm, no bundler.** Everything runs inside the Apps Script project.
- **Money:** store as plain numbers (UGX, no decimals by default). Currency symbol comes from
  Settings. **Never** trust client-sent prices on a sale — re-read the product price on the
  server when completing a sale.
- **IDs:** `Utilities.getUuid()`. **Dates:** ISO strings (`new Date().toISOString()`).
- **Writes:** wrap every sheet mutation in `LockService.getScriptLock()` to avoid race
  conditions (two cashiers at once).
- **Responsive:** mobile-first; must be fully usable one-handed on a phone (see §9).

---

## 2. Architecture

```
[ Browser SPA (HtmlService) ]  --google.script.run-->  [ Apps Script (Code.gs + modules) ]
        index.html                                              |  reads/writes
        styles (CSS vars)                                       v
        app.js (router + views)                          [ Google Sheet = database ]
                                                          tabs: Products, Sales, …
```

- `doGet()` serves the SPA. The client loads once, then talks to the server only through
  `google.script.run` API functions that return JSON-able objects/arrays.
- The Sheet is the source of truth. Read whole tabs into memory per request, filter in JS.
- Caching: use `CacheService.getScriptCache()` for read-heavy data (Products, Settings) with a
  short TTL (e.g. 30s) and bust it on writes. Keeps the POS snappy.

**Limitations to accept (vs the original):** no true offline mode (Apps Script needs the
network); slower cold starts; ~6 min execution limit (never an issue for CRUD). Keep payloads
small and read tabs once per call.

---

## 3. The Database — Google Sheet tabs

Create one spreadsheet. Each tab below is a table; **row 1 is the header row** with exactly
these column names (snake or camel — pick one and be consistent; this doc uses camelCase).

**Settings** (single row of config under headers, OR key/value rows — use single row):
`businessName, currency, phone, address, vatEnabled, vatRate, lowStockDefault, receiptFooter, logoUrl, theme`

**Users** (login):
`id, name, username, passwordHash, role, active, createdAt`
- `role`: `owner` | `cashier` | `manager`. `passwordHash` = SHA-256 hex of the password (see §5).

**Categories:** `id, name, createdAt`

**Products:** `id, name, sku, barcode, category, cost, price, stock, lowStock, imageUrl, createdAt, updatedAt`
- `stock` = current quantity. `lowStock` = threshold for the amber warning. `cost` is owner-only
  (never shown to a cashier or on a receipt).

**Customers:** `id, name, phone, email, address, createdAt`

**Sales:** `id, ref, date, customerId, customerName, itemsSubtotal, discount, tax, total, paymentMethod, amountPaid, changeDue, cashier`
- `ref` = human receipt number, e.g. `R-000123` (incrementing, see §7 Sales).

**SaleItems:** `id, saleId, productId, name, sku, price, qty, subtotal`

**StockMovements:** `id, date, productId, productName, change, reason, ref, note`
- `reason`: `sale` | `restock` | `adjustment` | `new`. Lets the owner audit every stock change.

**Expenses** (basic cash flow, optional): `id, date, category, amount, note, recordedBy`

> Helper `getTable(name)` returns `[{header:value,…}, …]`; `appendRow(name, obj)`,
> `updateRow(name, id, patch)`, `deleteRow(name, id)`. Build these once (§4) and reuse.

---

## 4. Backend — `Code.gs` and modules

Split server code into logical `.gs` files (Apps Script merges them into one scope):
`Code.gs` (entry + router), `Sheets.gs` (generic table helpers), `Auth.gs`, `Products.gs`,
`Sales.gs`, `Customers.gs`, `Reports.gs`, `Settings.gs`.

### Entry point
```js
// Code.gs
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Nexus Lite')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// Lets index.html pull in other HTML partials: <?!= include('styles') ?>
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
```

### Generic sheet helpers (`Sheets.gs`)
```js
const SS = () => SpreadsheetApp.getActiveSpreadsheet();
function sheet(name){ return SS().getSheetByName(name); }

function getTable(name){
  const sh = sheet(name); const rng = sh.getDataRange().getValues();
  const headers = rng.shift();
  return rng.filter(r => r.join('') !== '').map(r => {
    const o = {}; headers.forEach((h,i)=> o[h] = r[i]); return o;
  });
}
function appendRow(name, obj){
  const sh = sheet(name); const headers = sh.getDataRange().getValues()[0];
  sh.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
  return obj;
}
function updateRow(name, id, patch){
  const sh = sheet(name); const data = sh.getDataRange().getValues();
  const headers = data[0]; const idCol = headers.indexOf('id');
  for (let r=1; r<data.length; r++){
    if (data[r][idCol] === id){
      headers.forEach((h,c)=>{ if (patch[h] !== undefined) sh.getRange(r+1,c+1).setValue(patch[h]); });
      return true;
    }
  }
  return false;
}
function deleteRow(name, id){ /* find row by id, sh.deleteRow(r+1) */ }

// Always wrap mutations:
function withLock(fn){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
```

### API surface (functions the client calls via `google.script.run`)
Each returns plain JSON-able data and throws on auth/validation failure (the client shows the
message). Validate the token (§5) at the top of every protected call.

```
Auth:       apiLogin(username, password) -> {token, user}
            apiMe(token) -> user
Settings:   apiGetSettings() -> settings
            apiSaveSettings(token, settings) -> settings        (owner only)
Catalog:    apiGetProducts() -> [product]
            apiSaveProduct(token, product) -> product           (insert or update by id)
            apiDeleteProduct(token, id) -> ok
            apiRestock(token, id, qty, note) -> product
            apiGetCategories() / apiSaveCategory(token, name) / apiDeleteCategory(token, id)
Sales:      apiCreateSale(token, saleDraft) -> {sale, items}    (server re-prices + decrements stock)
            apiGetSales(token, {from, to, limit}) -> [sale]
            apiGetSale(token, id) -> {sale, items}
Customers:  apiGetCustomers() / apiSaveCustomer / apiDeleteCustomer
Reports:    apiSalesSummary(token, {from,to}) -> {total, count, byDay[], topProducts[], tax}
            apiInventoryValue(token) -> {costValue, retailValue, lowCount, outCount}
Users:      apiGetUsers(token) / apiSaveUser(token, user) / apiDeleteUser(token, id)  (owner only)
Expenses:   apiGetExpenses / apiAddExpense                       (optional)
```

### `apiCreateSale` — the critical one (do it carefully)
```
1. Validate token + that items[] is non-empty.
2. withLock(() => {
     - Read products once. For each cart item, look up the product by id.
     - Use the SERVER price (ignore any client price), compute subtotal per line.
     - itemsSubtotal = Σ line subtotals; apply cart discount; tax = vatEnabled ? round(subtotal*rate) : 0.
     - total = subtotal - discount + tax. changeDue = amountPaid - total.
     - ref = nextRef('Sales')  // R-000001, padded, based on row count.
     - Append Sales row + one SaleItems row per line.
     - For each line: product.stock -= qty (floor at 0); updateRow('Products', …); append a
       StockMovements row {reason:'sale', ref}.
   })
3. Bust the products cache. Return {sale, items} for the receipt.
```

---

## 5. Auth (simple, sheet-based)

Apps Script web apps deployed "anyone with the link" are public, so add a light auth layer.

- **Password hash:** `Utilities.computeDigest(SHA_256, password)` → hex string. Store in
  `Users.passwordHash`. Seed one owner on first run (`ensureSeed()`): username `owner`, a default
  password the user changes in Settings.
- **Token:** on `apiLogin`, verify hash, then create a token = `Utilities.getUuid()`, store it in
  `CacheService.getUserCache()`/`ScriptCache` mapped to the userId with a 12h TTL, and also persist
  a `sessions` map (id→{token, expires}) if you want longer sessions. Return `{token, user}`.
- **Client:** store `token` + `user` in `localStorage`; send `token` to every protected API;
  on `apiMe` failure, bounce to the login view. **Never** store the password.
- **Roles:** `owner` sees everything; `cashier` sees only POS + (read-only) their sales; `manager`
  = everything except Users/Settings. Enforce on the **server** (check role in each api), and also
  hide nav items on the client.

> This is "good enough for a shop" security, not bank-grade. Note it in the README.

---

## 6. Frontend — files & the SPA shell

Apps Script HTML files (create as separate files in the editor):
`index.html` (shell), `styles.html` (the `<style>` block), `app.html` (the `<script>` app).
`index.html` includes the others:

```html
<!-- index.html -->
<!DOCTYPE html><html lang="en"><head>
  <base target="_top">
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&family=Merriweather&display=swap" rel="stylesheet">
  <?!= include('styles'); ?>
</head><body>
  <div id="app" class="app"></div>
  <?!= include('app'); ?>
</body></html>
```

### The `google.script.run` Promise wrapper (use this everywhere)
```js
function api(fn, ...args){
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(err => reject(new Error(err.message || 'Request failed')))
      [fn](...args);
  });
}
// usage: const products = await api('apiGetProducts');
```

### Router (hash-based)
- Views: `login, dashboard, pos, inventory, categories, sales, customers, reports, settings`.
- `window.addEventListener('hashchange', render)`. `render()` reads `location.hash`, checks auth +
  role, and swaps the `#app` inner HTML for that view's render function.
- Each view = a function `renderPos(root)` that builds DOM (template strings + `innerHTML`, then
  wire events). Keep a tiny `state` object in memory (current user, settings, products cache).
- Show a top loading bar / skeletons while `api()` calls resolve.

### App layout (every authed view)
```
┌───────────────────────────────────────────────┐
│ Topbar: business name · search · theme · user  │  (sticky)
├──────────┬────────────────────────────────────┤
│ Sidebar  │  View content (scrolls)             │   desktop ≥ 1024px
│ (nav)    │                                     │
└──────────┴────────────────────────────────────┘
Mobile (< 768px): sidebar hidden → bottom nav bar (Home·POS·Stock·Sales·More)
```

---

## 7. Feature specs (the "basic functionality")

**Auth / Login** — username + password form → `apiLogin` → store token → `#/dashboard`. Logout
clears localStorage. No field prefill (`autocomplete="off"`).

**Dashboard** — cards: Today's Sales (UGX), # Sales today, Low/Out of stock count, Total Stock
Value. A simple 7-day sales bar chart (draw with divs or a tiny inline `<svg>` — no chart lib).
Recent sales list (last 5). All from `apiSalesSummary` + `apiInventoryValue`.

**POS** (the core) —
- Left: searchable product grid (search by name/SKU/barcode; Enter on exact barcode adds to cart).
  Tiles show name, price, stock, optional image. Category filter chips.
- Right (desktop) / bottom-sheet (mobile): the **cart** — line items with qty +/- and remove, a
  cart-level discount (flat or %), live subtotal/tax/total.
- Checkout: choose payment method (Cash / Mobile Money), enter amount paid → show change → **Complete
  Sale** → `apiCreateSale` → show a **receipt** (printable `<div>`, `window.print()`, and a
  "Share on WhatsApp" link `https://wa.me/?text=…` with the receipt text). Clear cart.
- Guard: can't sell more than `stock`; block or warn at 0.

**Inventory** —
- Product table (desktop) / cards (mobile): image, name, SKU, stock (color-coded: red out, amber
  low, normal), price, status, actions (edit, delete, restock).
- Filters: All / Low / Out, + search. "Show N" page size.
- Add/Edit modal: image URL, name, **searchable category dropdown** (filter-as-you-type combobox +
  "＋ Add new category"), SKU (auto from category prefix + number, overrideable), barcode, cost,
  price, stock, low-stock threshold. Stock is directly editable here (single-location model — no
  branches in this edition).
- Restock action: add a quantity → updates stock + logs a `restock` StockMovement.
- Categories sub-page: list/add/rename/delete categories.

**Sales history** — list (date, ref, customer, total, payment) with date filter + search; click a
row → detail (items, totals) → reprint/share receipt.

**Customers** — list + search; add/edit/delete (name, phone, email, address). Optional: pick a
customer at POS so it's stamped on the sale.

**Reports** — date-range picker → Sales summary (total, count, by-day chart), Top products,
Tax/VAT collected, Inventory value (cost vs retail). "Export CSV" = build a CSV string client-side
and download via a Blob.

**Settings** (owner) — Business profile (name, phone, address, logo URL, receipt footer), Currency,
VAT (on/off + rate), **Theme** (Light/Dark/System toggle, persisted), Users management
(add/edit/deactivate, set role, reset password). Low-stock default threshold.

---

## 8. Theme & Design System

Use these CSS custom properties **verbatim** (light = `:root`, dark = `.dark` on `<html>`).
The `@theme inline` block in the source is **Tailwind v4 syntax — ignore it** for this vanilla
build; just use the `var(--…)` tokens directly in plain CSS.

```css
:root {
  --card:#ffffff; --ring:#6366f1; --input:#d1d5db; --muted:#f3f4f6; --accent:#e0e7ff;
  --border:#d1d5db; --radius:0.5rem; --chart-1:#6366f1; --chart-2:#4f46e5; --chart-3:#4338ca;
  --chart-4:#3730a3; --chart-5:#312e81; --popover:#ffffff; --primary:#6366f1; --sidebar:#f3f4f6;
  --font-mono:"JetBrains Mono",monospace; --font-sans:"Inter",sans-serif; --secondary:#e5e7eb;
  --background:#f8fafc; --font-serif:"Merriweather",serif; --foreground:#1e293b;
  --destructive:#ef4444; --shadow-offset-y:4px; --shadow-blur:8px; --shadow-color:hsl(0 0% 0%);
  --shadow-opacity:0.1; --sidebar-ring:#6366f1; --sidebar-accent:#e0e7ff; --sidebar-border:#d1d5db;
  --card-foreground:#1e293b; --sidebar-primary:#6366f1; --muted-foreground:#6b7280;
  --accent-foreground:#374151; --popover-foreground:#1e293b; --primary-foreground:#ffffff;
  --sidebar-foreground:#1e293b; --secondary-foreground:#374151; --destructive-foreground:#ffffff;
  --sidebar-accent-foreground:#374151; --sidebar-primary-foreground:#ffffff;
}
.dark {
  --card:#1e293b; --ring:#818cf8; --input:#4b5563; --muted:#1e293b; --accent:#374151;
  --border:#4b5563; --chart-1:#818cf8; --chart-2:#6366f1; --chart-3:#4f46e5; --chart-4:#4338ca;
  --chart-5:#3730a3; --popover:#1e293b; --primary:#818cf8; --sidebar:#1e293b; --secondary:#2d3748;
  --background:#0f172a; --foreground:#e2e8f0; --destructive:#ef4444; --sidebar-ring:#818cf8;
  --sidebar-accent:#374151; --sidebar-border:#4b5563; --card-foreground:#e2e8f0;
  --sidebar-primary:#818cf8; --muted-foreground:#9ca3af; --accent-foreground:#d1d5db;
  --popover-foreground:#e2e8f0; --primary-foreground:#0f172a; --sidebar-foreground:#e2e8f0;
  --secondary-foreground:#d1d5db; --destructive-foreground:#0f172a;
  --sidebar-accent-foreground:#d1d5db; --sidebar-primary-foreground:#0f172a;
}
* { box-sizing:border-box; }
body { margin:0; font-family:var(--font-sans); background:var(--background); color:var(--foreground); }
.shadow-card { box-shadow: var(--shadow-offset-x,0) var(--shadow-offset-y) var(--shadow-blur)
  var(--shadow-spread,-1px) hsl(0 0% 0% / var(--shadow-opacity)); }
```

**Design tokens / usage:**
- Surfaces: `background` (page), `card`/`popover` (panels, modals), `sidebar` (nav).
- Text: `foreground` (default), `muted-foreground` (secondary), `*-foreground` pairs on colored bg.
- Brand: `primary` for buttons/active states, `accent` for soft highlights, `destructive` for delete.
- Borders/inputs use `border`/`input`; focus ring uses `ring` (`box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 35%,transparent)`).
- Radius from `--radius`. Numbers/SKUs/refs use `--font-mono`. Headings may use `--font-serif` sparingly.
- Charts: cycle `--chart-1..5`.
- **Build a small utility layer** (`.btn`, `.btn-primary`, `.btn-ghost`, `.card`, `.input`,
  `.badge`, `.modal`, `.chip`, `.table`) on top of these tokens. Keep components consistent.

---

## 9. Responsiveness (must be excellent)

- **Mobile-first.** Base styles target phones; add `@media (min-width:768px)` / `1024px`
  enhancements. Test at 360px wide.
- **Nav:** desktop ≥1024 = left sidebar; <768 = fixed **bottom nav** (5 icons). 768–1023 = collapsible
  sidebar / hamburger.
- **POS:** desktop = product grid + cart side-by-side; mobile = full-width product grid with a
  sticky **"View Cart (N) · UGX total"** bar that opens the cart as a **bottom sheet**.
- **Tables → cards:** on <768, render list rows as stacked cards (label/value pairs), not h-scroll
  tables.
- **Grids:** product tiles use `display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr))`.
- Touch targets ≥ 44px. Inputs ≥ 16px font (prevents iOS zoom). Modals are full-screen sheets on
  mobile, centered dialogs on desktop.
- Respect safe areas (`env(safe-area-inset-bottom)` on the bottom nav).
- Theme toggle persists to `localStorage` and also honors `prefers-color-scheme` for "System".

---

## 10. Receipts & printing

- Build the receipt as a hidden `.receipt` div (mono font, 58/80mm-friendly width). A print stylesheet
  `@media print { body * {visibility:hidden} .receipt,.receipt * {visibility:visible} … }` then
  `window.print()`.
- Include: business name/logo/phone, ref, date, cashier, item lines (qty × name … price), subtotal,
  discount, VAT, total, paid, change, footer text. Pull these from Settings + the sale.
- "Share" = `https://wa.me/?text=` + `encodeURIComponent(plainTextReceipt)`.

---

## 11. Setup & Deploy (write this into README.md too)

1. Create a Google Sheet; add the tabs from §3 with their header rows. Copy the Sheet's URL.
2. Extensions → **Apps Script**. Create the `.gs` and `.html` files from §4/§6.
3. Run `ensureSeed()` once (creates the owner user + default Settings row if missing). Authorize scopes.
4. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone** (or
   "Anyone with Google account" for a little more safety). Copy the Web App URL — that's the app.
5. Log in with the seeded owner, change the password in Settings, add categories + products, start
   selling.
6. To update: edit the script → **Deploy → Manage deployments → Edit → New version**.

> Back up: File → Make a copy of the Sheet periodically (it *is* the database).

---

## 12. Build Plan (do in this order)

1. **Foundation:** Sheet + tabs; `Sheets.gs` helpers + `withLock`; `doGet`/`include`; the SPA shell,
   theme CSS (§8), `api()` wrapper, router, and the responsive layout skeleton (sidebar + bottom nav).
2. **Auth:** `ensureSeed`, `apiLogin`/`apiMe`, login view, token storage, route guards, roles.
3. **Settings + Catalog:** Settings load/save; Products + Categories CRUD; Inventory view (table/cards,
   filters, add/edit modal with searchable category, restock).
4. **POS:** product grid + search, cart, discount, totals, `apiCreateSale` (server re-price + stock
   decrement + movements), receipt + print/share.
5. **Sales history + Customers.**
6. **Reports** (summary, charts via divs/SVG, CSV export) + **Dashboard** cards.
7. **Polish:** dark mode toggle, skeleton loaders, empty states, toasts, low-stock badges, print CSS,
   safe-area + 360px pass.

---

## 13. Conventions

- One source of truth in a client `state = { user, settings, products, categories }`, refreshed after
  writes; bust server cache on writes.
- Every server mutation: validate token → check role → `withLock` → mutate → return fresh data.
- Show user-friendly errors (try/catch around every `api()` call → toast).
- Currency formatting: `new Intl.NumberFormat('en-UG').format(n)` prefixed with the Settings symbol.
- Keep functions small; comment the *why*. Match the existing file's style when extending.
- Accessibility: labels on inputs, focus styles via `--ring`, `aria-*` on modals/nav.
```
