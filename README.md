# Nexus Lite

A responsive **Point of Sale + Inventory** web app for a small shop. It runs on a
**Google Apps Script + Google Sheet** backend, with a **vanilla HTML/CSS/JS** frontend —
no frameworks, no build step.

The frontend is split out so it can be hosted on **Cloudflare Pages**, talking to the
Apps Script backend as a JSON API.

## Layout

```
Code.gs, Sheets.gs, Auth.gs, Products.gs, Sales.gs,    Apps Script backend
  Customers.gs, Reports.gs, Settings.gs, Setup.gs      (the Google Sheet is the database)
Router.gs                                               JSON API (doPost) for the static frontend
index.html, styles.html, app.html                      original Google-hosted SPA (still works via doGet)
web/                                                    static frontend for Cloudflare Pages
  ├─ index.html, styles.css, app.js                     the redesigned "Market Ledger" UI
  ├─ config.js                                           set API_URL to your Web App /exec URL
  └─ _redirects                                          SPA fallback for the hash router
```

## Backend (Apps Script)

Pushed with [clasp](https://github.com/google/clasp). The Sheet is the source of truth.
The build spec lives in [CLAUDE.md](CLAUDE.md).

- `clasp push -f` to upload source.
- `clasp create-version "<msg>"` + `clasp redeploy <id> -V <n>` to ship to the stable Web App URL.

## Frontend (Cloudflare Pages)

The static site in [`web/`](web/) calls the backend with `fetch` (token in the body,
`text/plain` to skip CORS preflight). Full deploy steps — dashboard upload, Wrangler CLI, or
Git-connected auto-deploy — are in [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md).

> Deploying from this repo: in Cloudflare Pages, connect the repo with **no build command** and
> **build output directory = `web`**.

## Security note

Sheet-based auth with SHA-256 password hashing — "good enough for a shop," not bank-grade. The
Web App is deployed for public access, so change the seeded owner password before real use.
