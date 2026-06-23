/**
 * Cloudflare Pages Function — same-origin proxy to the Apps Script backend.
 *
 * Why this exists:
 * A browser calling the Apps Script /exec URL directly fails. Apps Script
 * 302-redirects the POST to script.googleusercontent.com, and that host returns
 * 404 whenever the request carries an `Origin` header — which browsers always add
 * on cross-origin calls. Running the request from this Worker is server-side, so
 * no Origin header is sent and the redirect resolves to the JSON result normally.
 *
 * The browser calls same-origin /api (no CORS, no preflight); we forward it here.
 * Routes: this file maps to the path /api on the deployed site.
 */
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby1LdTRreTqxZnSAwmKAQZPZSjEBmdscOnNget1DkrhXe0mMM8WJpqo25zXIebqbcuo/exec';

export async function onRequestPost(context) {
  try {
    const payload = await context.request.text();
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
      redirect: 'follow'
    });
    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Proxy error: ' + ((err && err.message) || err) }),
      { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } }
    );
  }
}

export async function onRequestGet() {
  return new Response(
    JSON.stringify({ ok: false, error: 'This endpoint accepts POST only.' }),
    { status: 405, headers: { 'Content-Type': 'application/json;charset=utf-8' } }
  );
}
