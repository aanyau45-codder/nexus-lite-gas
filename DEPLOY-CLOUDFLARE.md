# Deploying the Nexus Lite frontend to Cloudflare Pages

The app is now split:

- **Backend (data + logic):** Google Apps Script + the bound Google Sheet. It exposes a JSON
  API at the Web App `/exec` URL (`doPost` in `Router.gs`). Nothing about the database moves.
- **Frontend (the UI):** the static files in [`web/`](web/) — `index.html`, `styles.css`,
  `app.js`, `config.js`. These get hosted on Cloudflare Pages.

The original Google-hosted SPA still works too (`doGet` is unchanged), so you can migrate at
your own pace.

---

## How it talks across origins

The browser POSTs `{ fn, args }` to the `/exec` URL with `Content-Type: text/plain`. That keeps
it a CORS "simple request", so the browser skips the preflight `OPTIONS` call that Apps Script
can't answer. The token still travels inside the request body (no custom headers), so there's
nothing for CORS to block.

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

### Option C — Connect a Git repo
If you push this project to GitHub/GitLab, in Pages choose **Connect to Git** and set:
- **Build command:** _(none)_
- **Build output directory:** `web`

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
