/**
 * Frontend configuration for the Cloudflare Pages build.
 *
 * The browser calls the SAME-ORIGIN proxy at /api (a Cloudflare Pages Function,
 * see functions/api.js). The Function forwards to Apps Script server-side, which
 * avoids the cross-origin redirect Google blocks when an Origin header is present.
 *
 * The actual Apps Script /exec URL lives in functions/api.js — update it there if
 * you redeploy the backend to a new deployment id.
 */
window.NEXUS = {
  API_URL: '/api'
};
