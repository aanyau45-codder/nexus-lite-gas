# Deploying the Nexus Lite frontend to Cloudflare Pages

The app is now split:

- **Backend (data + logic):** Google Apps Script + the bound Google Sheet. It exposes a JSON
  API at the Web App `/exec` URL (`doPost` in `Router.gs`). Nothing about the database moves.
- **Frontend (the UI):** the static files in [`web/`](web/) — `index.html`, `styles.css`,
  `app.js`, `config.js`. These get hosted on Cloudflare Pages.

The original Google-hosted SPA still works too (`doGet` is unchanged), so you can migrate at
your own pace.

---

## How it talks to the backend (via a proxy)

A browser **cannot** call the Apps Script `/exec` URL directly: Apps Script 302-redirects the POST
to `script.googleusercontent.com`, and that host returns **404** whenever the request carries an
`Origin` header (which browsers always add cross-origin). A CORS preflight to `/exec` also returns
405. So direct browser calls are out.

Instead, the frontend calls a **same-origin proxy** at `/api` — a Cloudflare Pages Function
([`functions/api.js`](functions/api.js)). Because the browser talks to its own origin, there's no
CORS and no preflight at all. The Function then calls Apps Script **server-side**, where no `Origin`
header is sent, so the redirect resolves to JSON normally. The Apps Script `/exec` URL lives in
`functions/api.js`; `web/config.js` just sets `API_URL = '/api'`.

---

## One-time backend step

The frontend calls the **production** Web App URL. Make sure that deployment includes `Router.gs`
(`doPost`). From this folder:

```bash
clasp push -f
clasp create-version "Add JSON API for Cloudflare frontend"
clasp redeploy AKfycby1LdTRreTqxZnSAwmKAQZPZSjEBmdscOnNget1DkrhXe0mMM8WJpqo25zXIebqbcuo -V <n> -d "JSON API"
```

`config.js` already points at that production `/exec` URL. If you ever deploy to a new id, update
`web/config.js`.

> Tip: confirm the API is live by opening the `/exec` URL in a browser — `doGet` should return
> the old SPA, and a `POST` of `{"fn":"apiPing","args":[]}` returns `{"ok":true,...}`.

---

## Deploy to Cloudflare Pages

### Option A — Dashboard (no Git needed)
1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets**.
2. Upload the **contents of the `web/` folder** (not the folder itself).
3. Name the project (e.g. `nexus-lite`) and deploy. You get a `*.pages.dev` URL.
4. Open it, log in (`owner` / your password). Done.

### Option B — Wrangler CLI
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy web --project-name nexus-lite
```

### Option C — Connect a Git repo (recommended — needed for the /api proxy)
The `/api` proxy is a Pages Function in [`functions/`](functions/) at the **repo root**. For
Cloudflare to pick it up, deploy the whole repo (not just the `web/` folder). In Pages choose
**Connect to Git** and set:
- **Root directory:** _(leave default — the repo root)_
- **Build command:** _(none)_
- **Build output directory:** `web`

Cloudflare serves the static site from `web/` and the Function from `functions/` → `/api`.

> Direct-upload of only the `web/` folder will **not** include the Function (it lives at the repo
> root), so the app won't reach the backend. Use Git connect.

---

## Updating later
- **Frontend change:** edit files in `web/`, re-upload / `wrangler pages deploy web` / push to Git.
- **Backend change:** edit the `.gs` files, then `clasp push -f` and `clasp redeploy …` (keep the
  same deployment id so `config.js` stays valid).

## Notes
- `web/_redirects` sends every path to `index.html` (200) so deep links / refreshes work with the
  hash router.
- The Web App must be deployed with access **Anyone** (anonymous) for the public POST to work.
- This is a public JSON endpoint; the server still checks the session token on every protected
  call, so only `apiLogin` / `apiBootstrap` / `apiForgotPassword` work unauthenticated.
