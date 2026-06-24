/* =========================================================================
   Nexus Lite — SPA (Cloudflare Pages build)
   Talks to the Apps Script JSON API (Router.gs doPost) via fetch().
   ========================================================================= */
(function () {
  'use strict';

  var API_URL = (window.NEXUS && window.NEXUS.API_URL) || '';

  // ---- tiny helpers ---------------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(v) { return Number(v) || 0; }
  function cur() { return state.settings.currency || 'UGX'; }
  function fmtNum(n) { return Math.round(num(n)).toLocaleString('en-US'); }
  function money(n) { return cur() + ' ' + fmtNum(n); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function dt(s) { return esc(String(s).slice(0, 16).replace('T', ' ')); }

  // ---- icons (Lucide, inline SVG) -------------------------------------------
  var ICONS = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'bar-chart': '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'dollar-sign': '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'
  };
  function icon(name) {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  // ---- server bridge (fetch → Apps Script JSON API) -------------------------
  function api(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (!API_URL) return Promise.reject(new Error('API URL is not set. Edit config.js.'));
    return fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      // text/plain keeps this a CORS "simple request" (no preflight Apps Script can't answer)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Server error (' + r.status + ')');
        return r.json();
      })
      .then(function (res) {
        if (!res || res.ok !== true) throw new Error((res && res.error) || 'Request failed');
        return res.data;
      });
  }

  // ---- state ----------------------------------------------------------------
  var state = {
    token: localStorage.getItem('nl-token') || '',
    user: null,
    settings: { businessName: 'Nexus Lite', currency: 'UGX', theme: 'light' },
    products: [], categories: [], customers: [],
    cart: [], discType: 'flat', discVal: 0, payMethod: 'Cash',
    invFilter: 'all', invSearch: ''
  };
  window.__nl = state;

  // ---- toast ----------------------------------------------------------------
  var toastT;
  function toast(msg, err) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  // ---- modal ----------------------------------------------------------------
  function modal(title, body, mount) {
    closeModal();
    var bg = document.createElement('div');
    bg.className = 'modal-bg'; bg.id = 'modalBg';
    bg.innerHTML = '<div class="modal"><div class="modal-head"><h2>' + esc(title) +
      '</h2><div class="spacer"></div><button class="icon-btn" id="mClose">✕</button></div>' +
      '<div id="mBody">' + body + '</div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeModal(); });
    $('#mClose').addEventListener('click', closeModal);
    if (mount) mount($('#mBody'));
  }
  function closeModal() { var m = $('#modalBg'); if (m) m.remove(); }

  // ---- theme ----------------------------------------------------------------
  function applyTheme(mode) {
    var m = mode || localStorage.getItem('nl-theme') || state.settings.theme || 'light';
    var dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('nl-theme', m);
  }
  function toggleTheme() {
    applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    var b = $('#themeBtn'); if (b) b.innerHTML = icon(document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
  }

  // ---- navigation -----------------------------------------------------------
  var NAV = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'pos', label: 'POS', icon: 'shopping-cart' },
    { id: 'inventory', label: 'Stock', icon: 'package' },
    { id: 'sales', label: 'Sales', icon: 'receipt' },
    { id: 'invoices', label: 'Invoices', icon: 'file-text' },
    { id: 'purchases', label: 'Purchases', icon: 'shopping-bag' },
    { id: 'cash', label: 'Cash', icon: 'wallet' },
    { id: 'customers', label: 'Customers', icon: 'users' },
    { id: 'suppliers', label: 'Suppliers', icon: 'truck' },
    { id: 'reports', label: 'Reports', icon: 'bar-chart' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];
  function allowed() {
    if (!state.user) return [];
    if (state.user.role === 'cashier') return ['dashboard', 'pos', 'sales'];
    return NAV.map(function (n) { return n.id; });
  }
  function currentRoute() {
    var r = location.hash.replace(/^#\/?/, '') || 'dashboard';
    return allowed().indexOf(r) >= 0 ? r : (allowed()[0] || 'dashboard');
  }
  function go(r) { location.hash = '#/' + r; }

  // ===========================================================================
  // AUTH
  // ===========================================================================
  function brandInitial() { return (state.settings.businessName || 'N').trim().charAt(0).toUpperCase() || 'N'; }

  function renderLogin() {
    $('#app').className = '';
    $('#app').innerHTML =
      '<div class="auth"><div class="auth-card card">' +
        '<div class="auth-logo">' + esc(brandInitial()) + '</div>' +
        '<h1>' + esc(state.settings.businessName || 'Nexus Lite') + '</h1>' +
        '<p class="sub muted">Sign in to open the till</p>' +
        '<div class="field"><label class="label">Username</label>' +
          '<input class="input" id="lu" autocomplete="off" placeholder="owner"></div>' +
        '<div class="field"><label class="label">Password</label>' +
          '<input class="input" id="lp" type="password" autocomplete="new-password" placeholder="••••••"></div>' +
        '<button class="btn btn-primary btn-block" id="loginBtn">Sign in</button>' +
        '<p style="text-align:center;margin-top:14px"><span class="link" id="forgotLink">Forgot password?</span></p>' +
      '</div></div>';
    $('#loginBtn').addEventListener('click', doLogin);
    $('#lp').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#forgotLink').addEventListener('click', renderForgot);
  }
  function doLogin() {
    var u = $('#lu').value.trim(), p = $('#lp').value;
    if (!u || !p) { toast('Enter username and password', true); return; }
    var btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Signing in…';
    api('apiLogin', u, p).then(function (res) {
      state.token = res.token; state.user = res.user;
      localStorage.setItem('nl-token', res.token);
      return afterLogin();
    }).catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Sign in'; });
  }
  function renderForgot() {
    $('#app').innerHTML =
      '<div class="auth"><div class="auth-card card">' +
        '<div class="auth-logo">' + esc(brandInitial()) + '</div>' +
        '<h1>Reset password</h1>' +
        '<p class="sub muted">We\'ll email a temporary password if your account has an email on file.</p>' +
        '<div class="field"><label class="label">Username or email</label>' +
          '<input class="input" id="fi" autocomplete="off"></div>' +
        '<button class="btn btn-primary btn-block" id="fBtn">Send reset email</button>' +
        '<p style="text-align:center;margin-top:14px"><span class="link" id="backLink">' + icon('arrow-left') + ' Back to sign in</span></p>' +
      '</div></div>';
    $('#backLink').addEventListener('click', renderLogin);
    $('#fBtn').addEventListener('click', function () {
      var id = $('#fi').value.trim(); if (!id) { toast('Enter your username or email', true); return; }
      var b = $('#fBtn'); b.disabled = true; b.textContent = 'Sending…';
      api('apiForgotPassword', id).then(function (res) {
        toast(res.message || 'Done.'); renderLogin();
      }).catch(function (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Send reset email'; });
    });
  }
  function logout() {
    api('apiLogout', state.token).catch(function () {});
    localStorage.removeItem('nl-token');
    state.token = ''; state.user = null;
    location.hash = '';
    renderLogin();
  }

  function afterLogin() {
    return Promise.all([api('apiGetProducts'), api('apiGetCategories')]).then(function (r) {
      state.products = r[0]; state.categories = r[1];
      if (!location.hash) location.hash = '#/dashboard';
      route();
    });
  }

  // ===========================================================================
  // APP SHELL
  // ===========================================================================
  function renderShell() {
    var app = $('#app'); app.className = 'app';
    var nav = NAV.filter(function (n) { return allowed().indexOf(n.id) >= 0; });
    var isDark = document.documentElement.classList.contains('dark');
    app.innerHTML =
      '<aside class="sidebar"><div class="brand"><span class="brand-mark">' + esc(brandInitial()) + '</span>' +
        '<span>' + esc(state.settings.businessName || 'Nexus Lite') + '</span></div>' +
        '<nav class="nav">' + nav.map(function (n) {
          return '<div class="nav-item" data-go="' + n.id + '"><span class="nav-ico">' + icon(n.icon) + '</span><span>' + n.label + '</span></div>';
        }).join('') + '</nav>' +
        '<div class="side-foot">' + esc(state.user.name) + ' · ' + esc(state.user.role) + '</div></aside>' +
      '<div class="main"><header class="topbar">' +
        '<button class="icon-btn only-mobile" id="menuBtn" title="Menu">' + icon('menu') + '</button>' +
        '<div class="biz">' + esc(state.settings.businessName || 'Nexus Lite') + '</div>' +
        '<div class="spacer"></div>' +
        '<span class="who only-desktop">' + esc(state.user.name) + ' · ' + esc(state.user.role) + '</span>' +
        '<button class="icon-btn" id="themeBtn" title="Toggle theme">' + icon(isDark ? 'sun' : 'moon') + '</button>' +
        '<button class="icon-btn" id="logoutBtn" title="Sign out">' + icon('log-out') + '</button>' +
      '</header><main class="view" id="view"></main></div>' +
      '<nav class="bottom-nav">' + nav.slice(0, 5).map(function (n) {
        return '<div class="bn-item" data-go="' + n.id + '"><span class="bn-ico">' + icon(n.icon) + '</span><small>' + n.label + '</small></div>';
      }).join('') + '</nav><div class="backdrop"></div>';

    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#logoutBtn').addEventListener('click', logout);
    $('#menuBtn').addEventListener('click', function () { app.classList.toggle('nav-open'); });
    $('.backdrop').addEventListener('click', function () { app.classList.remove('nav-open'); });
    $all('[data-go]').forEach(function (e) {
      e.addEventListener('click', function () { go(e.getAttribute('data-go')); app.classList.remove('nav-open'); });
    });
    route();
  }

  function route() {
    if (!state.user) { renderLogin(); return; }
    if (!$('.sidebar')) { renderShell(); return; }
    var r = currentRoute();
    $all('[data-go]').forEach(function (e) { e.classList.toggle('active', e.getAttribute('data-go') === r); });
    var v = VIEWS[r] ? VIEWS[r]() : VIEWS.dashboard();
    var root = $('#view'); root.innerHTML = v.html;
    if (v.mount) v.mount(root);
    window.scrollTo(0, 0);
  }

  // ===========================================================================
  // VIEWS
  // ===========================================================================
  var VIEWS = {};

  // ---- Dashboard ------------------------------------------------------------
  VIEWS.dashboard = function () {
    return {
      html: '<div class="view-head"><h1>Dashboard</h1><div class="spacer"></div>' +
        (financeRole() ? '<button class="btn btn-ghost btn-sm" id="dashCustomize">' + icon('sliders') + ' Customize</button>' : '') +
        '</div><div id="dash"><div class="empty">Loading…</div></div>',
      mount: function () {
        api('apiDashboard', state.token).then(function (d) {
          if (!financeRole()) {
            $('#dash').innerHTML = '<div class="card hero"><div class="stat-label">Today’s sales</div>' +
              '<div class="hero-money"><span class="hero-cur">' + esc(cur()) + '</span><span class="hero-amt">' + fmtNum(d.todayTotal) + '</span></div>' +
              '<div class="hero-sub"><div>Sales today<strong>' + d.todayCount + '</strong></div><div>Low / Out<strong>' + d.lowCount + ' / ' + d.outCount + '</strong></div></div></div>' +
              '<div class="dash-card-wrap">' + dashCardDefs().filter(function (c) { return c.id === 'recent'; })[0].render(d) + '</div>';
            wireDash();
            return;
          }
          var vis = dashVisible(), defs = dashCardDefs();
          $('#dash').innerHTML = defs.filter(function (c) { return vis[c.id] !== false; }).map(function (c) {
            var h = c.render(d); return h ? '<div class="dash-card-wrap">' + h + '</div>' : '';
          }).join('');
          wireDash();
          var cz = $('#dashCustomize'); if (cz) cz.addEventListener('click', function () { customizeDash(defs); });
        }).catch(function (e) { $('#dash').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
      }
    };
  };
  function statCard(label, val, tone) {
    return '<div class="card stat-card' + (tone ? ' tone-' + tone : '') + '">' +
      '<div class="stat-label">' + esc(label) + '</div><div class="stat num">' + esc(val) + '</div></div>';
  }
  function reportTable(title, rows) {
    return '<div class="card" style="margin-top:16px"><h2>' + esc(title) + '</h2>' + (rows && rows.length ?
      '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Count</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td>' + esc(x.name) + '</td><td class="num">' + x.count + '</td><td class="num">' + money(x.total) +
          '</td><td class="num">' + money(x.paid) + '</td><td class="num">' + money(x.balance) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted">No data.</p>') + '</div>';
  }
  function barChart(byDay) {
    var max = Math.max.apply(null, byDay.map(function (d) { return d.total; }).concat([1]));
    return byDay.map(function (d) {
      var h = Math.max(3, Math.round((d.total / max) * 100));
      return '<div class="bar-col"><div class="bar" style="height:' + h + '%"></div>' +
        '<div class="bar-lbl">' + esc(d.day.slice(5)) + '</div></div>';
    }).join('');
  }
  function lineChart(series) {
    if (!series || series.length < 2) return '<div class="empty">Not enough data yet.</div>';
    var w = 640, h = 150, pad = 8, n = series.length;
    var vals = series.map(function (p) { return Number(p.balance) || 0; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min > 0) min = 0;                  // anchor baseline at zero when all positive
    if (min === max) max = min + 1;
    var range = max - min;
    var coords = series.map(function (p, i) {
      return {
        x: pad + (i / (n - 1)) * (w - 2 * pad),
        y: pad + (1 - ((Number(p.balance) || 0) - min) / range) * (h - 2 * pad)
      };
    });
    var poly = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
    var area = 'M ' + coords[0].x.toFixed(1) + ',' + (h - pad).toFixed(1) +
      coords.map(function (c) { return ' L ' + c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join('') +
      ' L ' + coords[n - 1].x.toFixed(1) + ',' + (h - pad).toFixed(1) + ' Z';
    return '<svg class="line-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<path class="lc-area" d="' + area + '"/><polyline class="lc-line" points="' + poly + '"/></svg>' +
      '<div class="chart-foot"><span>' + esc(series[0].day.slice(5)) + '</span>' +
      '<span>now: ' + money(series[n - 1].balance) + '</span>' +
      '<span>' + esc(series[n - 1].day.slice(5)) + '</span></div>';
  }

  // ---- POS ------------------------------------------------------------------
  VIEWS.pos = function () {
    return {
      html: '<div class="view-head"><h1>POS</h1><div class="spacer"></div>' +
        '<input class="input" id="posSearch" placeholder="Search name / SKU / barcode" style="max-width:340px"></div>' +
        '<div class="pos"><div id="posGrid" class="pos-products"></div>' +
        '<div id="cartPanel"></div></div>' +
        '<div class="cart-cta" id="cartCta"></div>',
      mount: function () {
        var search = '';
        function drawGrid() {
          var q = search.trim().toLowerCase();
          var list = state.products.filter(function (p) {
            return !q || (p.name + ' ' + p.sku + ' ' + p.barcode).toLowerCase().indexOf(q) >= 0;
          });
          $('#posGrid').innerHTML = list.length ? list.map(function (p) {
            return '<div class="tile' + (p.stock <= 0 ? ' out' : '') + '" data-add="' + p.id + '">' +
              '<div class="ph">' + (p.imageUrl ? '<img src="' + esc(p.imageUrl) + '" alt="">' : icon('package')) + '</div>' +
              '<div class="nm">' + esc(p.name) + '</div>' +
              '<div class="pr">' + money(p.price) + '</div>' +
              '<div class="st">' + (p.stock <= 0 ? 'Out of stock' : p.stock + ' in stock') + '</div></div>';
          }).join('') : '<div class="empty">No products. Add some in Stock.</div>';
          $all('[data-add]').forEach(function (t) {
            t.addEventListener('click', function () { addToCart(t.getAttribute('data-add')); });
          });
        }
        function addToCart(id) {
          var p = state.products.filter(function (x) { return x.id === id; })[0];
          if (!p) return;
          if (p.stock <= 0) { toast('Out of stock', true); return; }
          var line = state.cart.filter(function (c) { return c.productId === id; })[0];
          if (line) { if (line.qty < p.stock) line.qty++; else { toast('Only ' + p.stock + ' available', true); return; } }
          else state.cart.push({ productId: id, name: p.name, price: p.price, qty: 1, stock: p.stock, serialized: !!(p.serials && String(p.serials).trim()), serials: '' });
          drawCart();
        }
        function totals() {
          var sub = state.cart.reduce(function (a, c) { return a + c.price * c.qty; }, 0);
          var disc = state.discType === 'pct' ? Math.round(sub * Math.min(100, num(state.discVal)) / 100) : Math.min(sub, num(state.discVal));
          var taxable = sub - disc;
          var tax = state.settings.vatEnabled ? Math.round(taxable * num(state.settings.vatRate) / 100) : 0;
          return { sub: sub, disc: disc, tax: tax, total: taxable + tax };
        }
        function drawCart() {
          var t = totals();
          var items = state.cart.length ? state.cart.map(function (c, i) {
            return '<div class="cart-item"><div style="flex:1"><div class="ci-name">' + esc(c.name) + '</div>' +
              '<div class="ci-price-wrap"><span class="ci-cur">' + esc(cur()) + '</span>' +
              '<input class="input ci-price-in num" type="number" min="0" data-price="' + i + '" value="' + c.price + '" title="Unit price — editable"></div>' +
              (c.serialized ? '<input class="input ci-serial" data-serialin="' + i + '" placeholder="Serial no(s) — comma or line" value="' + esc(c.serials || '') + '">' : '') +
              '</div>' +
              '<button class="qtybtn" data-dec="' + i + '">−</button>' +
              '<span class="num" style="min-width:24px;text-align:center">' + c.qty + '</span>' +
              '<button class="qtybtn" data-inc="' + i + '">+</button>' +
              '<button class="qtybtn" data-rm="' + i + '" style="color:var(--destructive)">✕</button></div>';
          }).join('') : '<p class="empty">Cart is empty</p>';
          var body = '<div class="cart"><h2>' + icon('receipt') + 'Cart</h2>' + items +
            '<div style="display:flex;gap:8px;margin:12px 0">' +
              '<button class="chip ' + (state.discType === 'flat' ? 'active' : '') + '" data-dt="flat">Flat</button>' +
              '<button class="chip ' + (state.discType === 'pct' ? 'active' : '') + '" data-dt="pct">%</button>' +
              '<input class="input" id="discIn" placeholder="Discount" value="' + (state.discVal || '') + '" style="height:34px"></div>' +
            '<div class="row"><span class="muted">Subtotal</span><span class="num">' + money(t.sub) + '</span></div>' +
            (t.disc ? '<div class="row"><span class="muted">Discount</span><span class="num">-' + money(t.disc) + '</span></div>' : '') +
            (t.tax ? '<div class="row"><span class="muted">VAT</span><span class="num">' + money(t.tax) + '</span></div>' : '') +
            '<div class="row"><strong>Total</strong><strong class="num">' + money(t.total) + '</strong></div>' +
            '<button class="btn btn-primary btn-block charge" id="checkoutBtn" ' + (state.cart.length ? '' : 'disabled') + '>' +
              'Charge <span class="charge-amt" id="chargeAmt">' + money(t.total) + '</span></button></div>';
          $('#cartPanel').innerHTML = body;
          $('#cartCta').innerHTML = state.cart.length ?
            '<button class="btn btn-primary btn-block" id="ctaBtn">View cart (' + state.cart.length + ') · ' + money(t.total) + '</button>' : '';
          var cta = $('#ctaBtn'); if (cta) cta.addEventListener('click', function () { $('#cartPanel').scrollIntoView({ behavior: 'smooth' }); });
          $all('[data-inc]').forEach(function (b) { b.addEventListener('click', function () { var c = state.cart[+b.getAttribute('data-inc')]; if (c.qty < c.stock) c.qty++; else toast('Max stock', true); drawCart(); }); });
          $all('[data-dec]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-dec'); state.cart[i].qty--; if (state.cart[i].qty <= 0) state.cart.splice(i, 1); drawCart(); }); });
          $all('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { state.cart.splice(+b.getAttribute('data-rm'), 1); drawCart(); }); });
          $all('[data-price]').forEach(function (b) { b.addEventListener('change', function () { state.cart[+b.getAttribute('data-price')].price = Math.max(0, num(b.value)); drawCart(); }); });
          $all('[data-serialin]').forEach(function (b) { b.addEventListener('change', function () { state.cart[+b.getAttribute('data-serialin')].serials = b.value; }); });
          $all('[data-dt]').forEach(function (b) { b.addEventListener('click', function () { state.discType = b.getAttribute('data-dt'); drawCart(); }); });
          var di = $('#discIn'); if (di) di.addEventListener('input', function () { state.discVal = num(di.value); var ca = $('#chargeAmt'); if (ca) ca.textContent = money(totals().total); });
          var cb = $('#checkoutBtn'); if (cb) cb.addEventListener('click', checkout);
        }
        function checkout() {
          var t = totals();
          modal('Complete sale',
            '<div class="row"><strong>Total</strong><strong class="num">' + money(t.total) + '</strong></div>' +
            '<div class="field"><label class="label">Payment method</label><select class="input" id="pm">' +
              '<option>Cash</option><option>Mobile Money</option><option>Card</option><option>Credit</option></select></div>' +
            '<div class="grid2"><div class="field"><label class="label">Customer (for credit / receipt)</label><input class="input" id="custName" placeholder="Optional"></div>' +
            '<div class="field"><label class="label">Due date (credit)</label><input class="input" id="saleDue" type="date"></div></div>' +
            '<div class="field"><label class="label">Amount paid</label><input class="input num" id="paid" type="number" value="' + t.total + '"></div>' +
            '<div class="row"><span class="muted" id="balLbl">Change</span><strong class="num" id="chg">' + money(0) + '</strong></div>' +
            '<button class="btn btn-primary btn-block" id="doSale" style="margin-top:12px">Complete sale</button>',
            function () {
              function recompute() {
                var diff = num($('#paid').value) - t.total;
                if (diff >= 0) {
                  $('#balLbl').textContent = 'Change'; $('#chg').textContent = money(diff); $('#chg').style.color = '';
                } else {
                  $('#balLbl').textContent = 'Balance due (credit)'; $('#chg').textContent = money(-diff);
                  $('#chg').style.color = 'var(--destructive)';
                }
              }
              $('#paid').addEventListener('input', recompute);
              $('#pm').addEventListener('change', function () {
                $('#paid').value = this.value === 'Credit' ? 0 : t.total; recompute();
              });
              $('#doSale').addEventListener('click', function () {
                var btn = $('#doSale'); btn.disabled = true; btn.textContent = 'Saving…';
                var draft = {
                  items: state.cart.map(function (c) { return { productId: c.productId, qty: c.qty, price: c.price, serials: c.serials || '' }; }),
                  discount: num(state.discVal), discountType: state.discType,
                  paymentMethod: $('#pm').value, amountPaid: num($('#paid').value),
                  customerName: $('#custName').value.trim(), dueDate: $('#saleDue').value
                };
                api('apiCreateSale', state.token, draft).then(function (res) {
                  state.cart = []; state.discVal = 0;
                  return refreshProducts().then(function () { return res; });
                }).then(function (res) {
                  closeModal();
                  renderReceiptModal(res); // {sale, items} straight from the server
                }).catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Complete sale'; });
              });
            });
        }
        $('#posSearch').addEventListener('input', function () { search = this.value; drawGrid(); });
        drawGrid(); drawCart();
      }
    };
  };

  function renderReceiptModal(data) {
    var s = data.sale, items = data.items, set = state.settings;
    var bal = (Number(s.total) || 0) - (Number(s.amountPaid) || 0);
    var html = '<div id="receipt">' +
      (set.logoUrl ? '<img class="r-logo" src="' + esc(set.logoUrl) + '" alt="">' : '') +
      '<div class="r-center"><div class="r-biz">' + esc(set.businessName) + '</div>' +
        (set.phone ? esc(set.phone) + '<br>' : '') + (set.address ? esc(set.address) : '') + '</div>' +
      '<div class="r-rule"></div>' +
      '<div class="muted" style="font-size:.76rem">Ref ' + esc(s.ref) + ' · ' + dt(s.date) + '<br>Cashier: ' + esc(s.cashier) + '</div>' +
      '<div class="r-rule"></div>' +
      items.map(function (i) {
        return '<div class="r-line"><span>' + i.qty + '× ' + esc(i.name) + '</span><span>' + money(i.subtotal) + '</span></div>';
      }).join('') + '<div class="r-rule"></div>' +
      '<div class="r-line"><span>Subtotal</span><span>' + money(s.itemsSubtotal) + '</span></div>' +
      (num(s.discount) ? '<div class="r-line"><span>Discount</span><span>-' + money(s.discount) + '</span></div>' : '') +
      (num(s.tax) ? '<div class="r-line"><span>VAT</span><span>' + money(s.tax) + '</span></div>' : '') +
      '<div class="r-line"><strong>Total</strong><strong>' + money(s.total) + '</strong></div>' +
      '<div class="r-line"><span>Paid (' + esc(s.paymentMethod) + ')</span><span>' + money(s.amountPaid) + '</span></div>' +
      (bal > 0 ? '<div class="r-line"><strong>Balance due</strong><strong>' + money(bal) + '</strong></div>'
               : '<div class="r-line"><span>Change</span><span>' + money(s.changeDue) + '</span></div>') +
      '<div class="r-rule"></div>' +
      '<div class="r-center muted">' + esc(set.receiptFooter || '') + '</div></div>';
    modal('Receipt', html + '<div style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="btn btn-ghost btn-block" id="rPrint">Print</button>' +
      '<button class="btn btn-ghost btn-block" id="rShare">WhatsApp</button>' +
      '<button class="btn btn-primary btn-block" id="rNew">New sale</button></div>', function () {
        $('#rPrint').addEventListener('click', function () { window.print(); });
        $('#rNew').addEventListener('click', function () { closeModal(); route(); });
        $('#rShare').addEventListener('click', function () {
          window.open('https://wa.me/?text=' + encodeURIComponent(receiptText(s, items, state.settings)), '_blank');
        });
      });
  }
  function receiptText(s, items, set) {
    var L = [set.businessName, 'Ref ' + s.ref, ''];
    items.forEach(function (i) { L.push(i.qty + 'x ' + i.name + '  ' + money(i.subtotal)); });
    L.push('', 'Total: ' + money(s.total), 'Paid: ' + money(s.amountPaid) + ' (' + s.paymentMethod + ')', 'Change: ' + money(s.changeDue));
    if (set.receiptFooter) L.push('', set.receiptFooter);
    return L.join('\n');
  }

  // ---- Inventory ------------------------------------------------------------
  VIEWS.inventory = function () {
    return {
      html: '<div class="view-head"><h1>Stock</h1><div class="spacer"></div>' +
        '<button class="btn btn-ghost btn-sm" data-go2="categories">Categories</button>' +
        '<button class="btn btn-ghost btn-sm" id="bulkProd">Bulk add</button>' +
        '<button class="btn btn-primary btn-sm" id="addProd">+ Add product</button></div>' +
        '<div class="toolbar">' +
          '<input class="input" id="invSearch" placeholder="Search…" style="max-width:280px" value="' + esc(state.invSearch) + '">' +
          '<button class="chip" data-f="all">All</button><button class="chip" data-f="low">Low</button><button class="chip" data-f="out">Out</button></div>' +
        '<div id="invList"></div>',
      mount: function () {
        $('[data-go2="categories"]').addEventListener('click', function () { go('categories'); });
        $('#addProd').addEventListener('click', function () { productModal(null); });
        $('#bulkProd').addEventListener('click', bulkProductModal);
        $('#invSearch').addEventListener('input', function () { state.invSearch = this.value; drawList(); });
        $all('[data-f]').forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-f') === state.invFilter);
          c.addEventListener('click', function () {
            state.invFilter = c.getAttribute('data-f');
            $all('[data-f]').forEach(function (x) { x.classList.toggle('active', x === c); });
            drawList();
          });
        });
        function drawList() {
          var q = state.invSearch.trim().toLowerCase();
          var def = num(state.settings.lowStockDefault) || 5;
          var list = state.products.filter(function (p) {
            if (q && (p.name + ' ' + p.sku + ' ' + p.barcode).toLowerCase().indexOf(q) < 0) return false;
            var thr = p.lowStock || def;
            if (state.invFilter === 'out') return p.stock <= 0;
            if (state.invFilter === 'low') return p.stock > 0 && p.stock <= thr;
            return true;
          });
          if (!list.length) { $('#invList').innerHTML = '<div class="empty">No products.</div>'; return; }
          $('#invList').innerHTML =
            '<div class="table-wrap"><table class="table"><thead><tr>' +
              '<th>Product</th><th>SKU</th><th>Stock</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>' +
            list.map(function (p) {
              var thr = p.lowStock || def;
              var st = p.stock <= 0 ? '<span class="badge bad">Out</span>' : p.stock <= thr ? '<span class="badge warn">Low</span>' : '<span class="badge ok">In stock</span>';
              return '<tr><td><strong>' + esc(p.name) + '</strong><br><span class="muted" style="font-size:.76rem">' + esc(p.category || '') + '</span></td>' +
                '<td class="mono" style="font-size:.8rem">' + esc(p.sku || '—') + '</td>' +
                '<td><strong class="num">' + p.stock + '</strong></td><td class="num">' + money(p.price) + '</td><td>' + st + '</td>' +
                '<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-re="' + p.id + '">Restock</button> ' +
                '<button class="btn btn-ghost btn-sm" data-ed="' + p.id + '">Edit</button> ' +
                '<button class="btn btn-ghost btn-sm" data-del="' + p.id + '" style="color:var(--destructive)">✕</button></td></tr>';
            }).join('') + '</tbody></table></div>';
          $all('[data-ed]').forEach(function (b) { b.addEventListener('click', function () { productModal(find(b.getAttribute('data-ed'))); }); });
          $all('[data-re]').forEach(function (b) { b.addEventListener('click', function () { restockModal(find(b.getAttribute('data-re'))); }); });
          $all('[data-del]').forEach(function (b) { b.addEventListener('click', function () { delProduct(find(b.getAttribute('data-del'))); }); });
        }
        function find(id) { return state.products.filter(function (p) { return p.id === id; })[0]; }
        window.__invDraw = drawList;
        drawList();
      }
    };
  };

  // Next auto SKU (PRD###) from the products already loaded; editable in the form.
  function nextSku() {
    var max = 0;
    state.products.forEach(function (p) {
      var m = /^PRD(\d+)$/i.exec(String(p.sku || '').trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'PRD' + ('000' + (max + 1)).slice(-3);
  }

  function productModal(p) {
    var isEdit = !!p;
    p = p || { name: '', sku: '', barcode: '', category: '', location: '', cost: 0, price: 0, stock: 0, lowStock: '', serials: '', imageUrl: '' };
    var skuVal = isEdit ? (p.sku || '') : nextSku();
    var hasStore = !!state.settings.hasStore;
    var body =
      '<div class="field"><label class="label">SKU</label><input class="input mono" id="f_sku" value="' + esc(skuVal) + '">' +
        '<div class="muted" style="font-size:.72rem;margin-top:5px;display:flex;align-items:center;gap:4px">' + icon('plus') + 'Auto-generated — edit if you need to</div></div>' +
      '<div class="field"><label class="label">Product name *</label><input class="input" id="f_name" value="' + esc(p.name) + '" placeholder="e.g. Samsung Galaxy S24, 128GB"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label class="label">Category *</label><div class="combo" id="catCombo">' +
          '<input class="input" id="f_cat" value="' + esc(p.category) + '" placeholder="Search or type…" autocomplete="off"></div></div>' +
        (hasStore
          ? '<div class="field"><label class="label">Branch / Store *</label><select class="input" id="f_loc">' +
              ['Branch', 'Store'].map(function (o) { return '<option' + (p.location === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
              '</select></div>'
          : '<input type="hidden" id="f_loc" value="' + esc(p.location || '') + '">') +
      '</div>' +
      '<div class="grid2"><div class="field"><label class="label">Buying price (' + esc(cur()) + ') *</label><input class="input num" id="f_cost" type="number" value="' + p.cost + '" placeholder="e.g. 350000"></div>' +
        '<div class="field"><label class="label">Selling price (' + esc(cur()) + ') *</label><input class="input num" id="f_price" type="number" value="' + p.price + '" placeholder="e.g. 500000"></div></div>' +
      '<div class="grid2"><div class="field"><label class="label">Re-order level *</label><input class="input num" id="f_low" type="number" value="' + (p.lowStock || '') + '" placeholder="' + (num(state.settings.lowStockDefault) || 5) + '"></div>' +
        '<div class="field"><label class="label">Current stock *</label><input class="input num" id="f_stock" type="number" value="' + p.stock + '" placeholder="e.g. 100"></div></div>' +
      '<div class="field"><label class="label">Barcode (optional)</label><input class="input mono" id="f_bar" value="' + esc(p.barcode) + '" placeholder="Scan or type…"></div>' +
      '<div class="field"><label class="label">Image URL (optional)</label><input class="input" id="f_img" value="' + esc(p.imageUrl) + '" placeholder="https://…"></div>' +
      '<div class="field"><button class="btn btn-ghost btn-block btn-sm" id="serBtn" type="button">' + icon('plus') + 'Add serial numbers</button>' +
        '<div id="serWrap" style="display:' + (p.serials ? 'block' : 'none') + ';margin-top:8px">' +
          '<textarea class="input" id="f_serials" placeholder="One serial number per line">' + esc(p.serials || '') + '</textarea>' +
          '<div class="muted" style="font-size:.72rem;margin-top:4px">One serial per line — a product can have many.</div></div></div>' +
      '<button class="btn btn-primary btn-block" id="saveProd">' + (isEdit ? 'Save changes' : 'Add product') + '</button>';
    modal(isEdit ? 'Edit product' : 'Add product', body, function () {
      categoryCombo($('#catCombo'), $('#f_cat'));
      $('#serBtn').addEventListener('click', function () {
        var w = $('#serWrap');
        w.style.display = w.style.display === 'none' ? 'block' : 'none';
        if (w.style.display === 'block') $('#f_serials').focus();
      });
      $('#saveProd').addEventListener('click', function () {
        var loc = $('#f_loc');
        var data = {
          id: isEdit ? p.id : '', name: $('#f_name').value.trim(), sku: $('#f_sku').value.trim(),
          barcode: $('#f_bar').value.trim(), category: $('#f_cat').value.trim(),
          location: loc ? loc.value.trim() : '',
          cost: num($('#f_cost').value), price: num($('#f_price').value),
          stock: num($('#f_stock').value), lowStock: num($('#f_low').value),
          serials: $('#f_serials') ? $('#f_serials').value.trim() : '',
          imageUrl: $('#f_img').value.trim()
        };
        if (!data.name) { toast('Name is required', true); return; }
        var btn = $('#saveProd'); btn.disabled = true; btn.textContent = 'Saving…';
        api('apiSaveProduct', state.token, data).then(function () { return refreshProducts(); })
          .then(function () { closeModal(); toast('Saved'); if (window.__invDraw) window.__invDraw(); })
          .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Save'; });
      });
    });
  }

  // searchable category dropdown
  function categoryCombo(box, input) {
    var pop;
    function open() {
      close();
      var q = input.value.trim().toLowerCase();
      var list = state.categories.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; });
      pop = document.createElement('div'); pop.className = 'combo-pop';
      pop.innerHTML = (list.length ? list.map(function (c) { return '<div class="combo-opt" data-c="' + esc(c.name) + '">' + esc(c.name) + '</div>'; }).join('') : '<div class="combo-opt muted">No match</div>') +
        (q ? '<div class="combo-opt" data-new="' + esc(input.value.trim()) + '" style="color:var(--primary);border-top:1px solid var(--border)">+ Add “' + esc(input.value.trim()) + '”</div>' : '');
      box.appendChild(pop);
      $all('[data-c]', pop).forEach(function (o) { o.addEventListener('mousedown', function () { input.value = o.getAttribute('data-c'); close(); }); });
      var nw = $('[data-new]', pop); if (nw) nw.addEventListener('mousedown', function () {
        var name = nw.getAttribute('data-new'); input.value = name;
        api('apiSaveCategory', state.token, name).then(function (c) {
          if (!state.categories.filter(function (x) { return x.id === c.id; }).length) state.categories.push(c);
        }); close();
      });
    }
    function close() { if (pop) { pop.remove(); pop = null; } }
    input.addEventListener('focus', open);
    input.addEventListener('input', open);
    input.addEventListener('blur', function () { setTimeout(close, 150); });
  }

  function restockModal(p) {
    modal('Restock — ' + p.name,
      '<div class="field"><label class="label">Add quantity</label><input class="input num" id="rq" type="number" placeholder="0"></div>' +
      '<div class="field"><label class="label">Note (optional)</label><input class="input" id="rn"></div>' +
      '<button class="btn btn-primary btn-block" id="rsave">Add to stock</button>', function () {
        $('#rsave').addEventListener('click', function () {
          var q = num($('#rq').value); if (q <= 0) { toast('Enter a quantity', true); return; }
          api('apiRestock', state.token, p.id, q, $('#rn').value.trim()).then(function () { return refreshProducts(); })
            .then(function () { closeModal(); toast('Stock added'); if (window.__invDraw) window.__invDraw(); })
            .catch(function (e) { toast(e.message, true); });
        });
      });
  }
  function delProduct(p) {
    modal('Delete product', '<p>Delete <strong>' + esc(p.name) + '</strong>? This cannot be undone.</p>' +
      '<div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-ghost btn-block" id="dno">Cancel</button>' +
      '<button class="btn btn-danger btn-block" id="dyes">Delete</button></div>', function () {
        $('#dno').addEventListener('click', closeModal);
        $('#dyes').addEventListener('click', function () {
          api('apiDeleteProduct', state.token, p.id).then(function () { return refreshProducts(); })
            .then(function () { closeModal(); toast('Deleted'); if (window.__invDraw) window.__invDraw(); })
            .catch(function (e) { toast(e.message, true); });
        });
      });
  }
  function refreshProducts() { return api('apiGetProducts').then(function (ps) { state.products = ps; }); }

  function bulkProductModal() {
    modal('Bulk add products',
      '<p class="muted" style="font-size:.82rem;margin-top:0">One product per line, comma or tab separated — paste straight from a spreadsheet:</p>' +
      '<p class="muted" style="font-size:.78rem"><code>Name, Category, Buying price, Selling price, Stock, Re-order(optional)</code></p>' +
      '<textarea class="input mono" id="bulkP" style="min-height:170px" placeholder="HP 650 Laptop, Laptops, 850000, 1100000, 5\nUSB-C Cable, Accessories, 3000, 8000, 50"></textarea>' +
      '<p class="muted" style="font-size:.72rem;margin-top:6px">SKUs (PRD###) are generated automatically.</p>' +
      '<button class="btn btn-primary btn-block" id="bulkPSave" style="margin-top:6px">Add products</button>', function () {
        $('#bulkPSave').addEventListener('click', function () {
          var list = $('#bulkP').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
            var p = l.split(/\t|,/).map(function (x) { return x.trim(); });
            return { name: p[0], category: p[1] || '', cost: num(p[2]), price: num(p[3]), stock: num(p[4]), lowStock: num(p[5]) };
          }).filter(function (p) { return p.name; });
          if (!list.length) { toast('Paste at least one row', true); return; }
          var btn = $('#bulkPSave'); btn.disabled = true; btn.textContent = 'Adding…';
          api('apiBulkSaveProducts', state.token, list).then(function (r) { return refreshProducts().then(function () { return r; }); })
            .then(function (r) { closeModal(); toast('Added ' + r.count + ' products'); if (window.__invDraw) window.__invDraw(); })
            .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Add products'; });
        });
      });
  }

  // ---- Categories -----------------------------------------------------------
  VIEWS.categories = function () {
    return {
      html: '<div class="view-head"><button class="icon-btn" data-go3="inventory" title="Back">' + icon('arrow-left') + '</button><h1>Categories</h1></div>' +
        '<div class="card"><div style="display:flex;gap:8px"><input class="input" id="newCat" placeholder="New category name">' +
        '<button class="btn btn-primary" id="addCat">Add</button></div></div><div id="catList" style="margin-top:16px"></div>',
      mount: function () {
        $('[data-go3]').addEventListener('click', function () { go('inventory'); });
        function draw() {
          $('#catList').innerHTML = state.categories.length ? '<div class="card">' + state.categories.map(function (c) {
            return '<div class="row"><span>' + esc(c.name) + '</span><button class="btn btn-ghost btn-sm" data-dc="' + c.id + '" style="color:var(--destructive)">Delete</button></div>';
          }).join('') + '</div>' : '<div class="empty">No categories yet.</div>';
          $all('[data-dc]').forEach(function (b) {
            b.addEventListener('click', function () {
              api('apiDeleteCategory', state.token, b.getAttribute('data-dc')).then(function () {
                state.categories = state.categories.filter(function (c) { return c.id !== b.getAttribute('data-dc'); }); draw();
              }).catch(function (e) { toast(e.message, true); });
            });
          });
        }
        $('#addCat').addEventListener('click', function () {
          var n = $('#newCat').value.trim(); if (!n) return;
          api('apiSaveCategory', state.token, n).then(function (c) {
            if (!state.categories.filter(function (x) { return x.id === c.id; }).length) state.categories.push(c);
            $('#newCat').value = ''; draw();
          }).catch(function (e) { toast(e.message, true); });
        });
        draw();
      }
    };
  };

  // ---- Sales ----------------------------------------------------------------
  VIEWS.sales = function () {
    return {
      html: '<div class="view-head"><h1>Sales</h1></div>' +
        '<div class="toolbar">' +
          '<input class="input" id="sFrom" type="date" style="max-width:170px">' +
          '<input class="input" id="sTo" type="date" style="max-width:170px">' +
          '<button class="btn btn-ghost btn-sm" id="sGo">Filter</button></div><div id="sList"><div class="empty">Loading…</div></div>',
      mount: function () {
        function load() {
          var opts = { limit: 200 };
          if ($('#sFrom').value) opts.from = $('#sFrom').value;
          if ($('#sTo').value) opts.to = $('#sTo').value;
          api('apiGetSales', state.token, opts).then(function (rows) {
            $('#sList').innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Ref</th><th>Date</th><th>Customer</th><th>Total</th></tr></thead><tbody>' +
              rows.map(function (s) {
                return '<tr data-sale="' + s.id + '" style="cursor:pointer"><td class="mono">' + esc(s.ref) + '</td><td>' + dt(s.date) + '</td>' +
                  '<td>' + esc(s.customerName || '—') + '</td><td><strong class="num">' + money(s.total) + '</strong></td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty">No sales in range.</div>';
            $all('[data-sale]').forEach(function (r) {
              r.addEventListener('click', function () {
                api('apiGetSale', state.token, r.getAttribute('data-sale')).then(renderReceiptModal);
              });
            });
          }).catch(function (e) { $('#sList').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        }
        $('#sGo').addEventListener('click', load); load();
      }
    };
  };

  // ---- Cash -----------------------------------------------------------------
  VIEWS.cash = function () {
    return {
      html: '<div class="view-head"><h1>Cash</h1><div class="spacer"></div>' +
        '<button class="btn btn-ghost btn-sm" id="bulkExpense">Bulk expenses</button>' +
        '<button class="btn btn-ghost btn-sm" id="addExpense">' + icon('minus') + ' Expense</button>' +
        '<button class="btn btn-primary btn-sm" id="addIncome">' + icon('plus') + ' Add money</button></div>' +
        '<div id="cashTop"></div><div id="cashList" style="margin-top:16px"><div class="empty">Loading…</div></div>',
      mount: function () {
        $('#addIncome').addEventListener('click', incomeModal);
        $('#addExpense').addEventListener('click', expenseModal);
        $('#bulkExpense').addEventListener('click', bulkExpenseModal);
        function load() {
          api('apiGetCashFlow', state.token, { limit: 200 }).then(function (r) {
            $('#cashTop').innerHTML =
              '<div class="card hero"><div class="stat-label">Money in hand</div>' +
                '<div class="hero-money"><span class="hero-cur">' + esc(cur()) + '</span>' +
                '<span class="hero-amt">' + fmtNum(r.balance) + '</span></div></div>' +
              (r.series && r.series.length ? '<div class="card" style="margin-top:16px">' +
                '<h2>Running balance · 30 days</h2>' + lineChart(r.series) + '</div>' : '');
            $('#cashList').innerHTML = r.rows.length ? '<div class="card"><h2>Ledger</h2>' +
              r.rows.map(function (x) {
                var out = String(x.direction) === 'out';
                return '<div class="led"><div class="led-ico ' + (out ? 'out' : '') + '">' + icon(out ? 'minus' : 'plus') + '</div>' +
                  '<div style="flex:1"><div style="font-weight:500;text-transform:capitalize">' + esc(String(x.type).replace(/_/g, ' ')) + '</div>' +
                  '<div class="muted" style="font-size:.76rem">' + dt(x.date) + (x.note ? ' · ' + esc(x.note) : '') + '</div></div>' +
                  '<div class="led-amt ' + (out ? 'out' : 'in') + '">' + (out ? '−' : '+') + money(x.amount) + '</div></div>';
              }).join('') + '</div>' : '<div class="empty">No cash movements yet. Add money or record an expense.</div>';
          }).catch(function (e) { $('#cashList').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        }
        window.__cashLoad = load;
        load();
      }
    };
  };
  function incomeModal() {
    modal('Add money',
      '<div class="field"><label class="label">Source</label><select class="input" id="ci_type">' +
        '<option value="owner_injection">Owner injection</option>' +
        '<option value="loan">Loan</option>' +
        '<option value="other_income">Other income</option>' +
        '<option value="opening_balance">Opening balance</option>' +
        '<option value="drawing">Owner drawing (cash out)</option></select></div>' +
      '<div class="field"><label class="label">Amount</label><input class="input num" id="ci_amt" type="number" placeholder="0"></div>' +
      '<div class="field"><label class="label">Note (optional)</label><input class="input" id="ci_note"></div>' +
      '<button class="btn btn-primary btn-block" id="ci_save">Save</button>', function () {
        $('#ci_save').addEventListener('click', function () {
          var amt = num($('#ci_amt').value); if (amt <= 0) { toast('Enter an amount', true); return; }
          api('apiAddCashEntry', state.token, { type: $('#ci_type').value, amount: amt, note: $('#ci_note').value.trim() })
            .then(function () { closeModal(); toast('Saved'); if (window.__cashLoad) window.__cashLoad(); })
            .catch(function (e) { toast(e.message, true); });
        });
      });
  }
  function expenseModal() {
    modal('Record expense',
      '<div class="field"><label class="label">Category</label><input class="input" id="ce_cat" placeholder="e.g. Rent, Transport, Airtime"></div>' +
      '<div class="field"><label class="label">Amount</label><input class="input num" id="ce_amt" type="number" placeholder="0"></div>' +
      '<div class="field"><label class="label">Note (optional)</label><input class="input" id="ce_note"></div>' +
      '<button class="btn btn-primary btn-block" id="ce_save">Record expense</button>', function () {
        $('#ce_save').addEventListener('click', function () {
          var amt = num($('#ce_amt').value); if (amt <= 0) { toast('Enter an amount', true); return; }
          api('apiAddExpense', state.token, { category: $('#ce_cat').value.trim() || 'General', amount: amt, note: $('#ce_note').value.trim() })
            .then(function () { closeModal(); toast('Recorded'); if (window.__cashLoad) window.__cashLoad(); })
            .catch(function (e) { toast(e.message, true); });
        });
      });
  }

  function bulkExpenseModal() {
    modal('Bulk add expenses',
      '<p class="muted" style="font-size:.82rem;margin-top:0">One expense per line, comma or tab separated:</p>' +
      '<p class="muted" style="font-size:.78rem"><code>Category, Amount, Note(optional)</code></p>' +
      '<textarea class="input mono" id="bulkE" style="min-height:150px" placeholder="Rent, 300000, June\nTransport, 15000\nAirtime, 20000, MTN"></textarea>' +
      '<button class="btn btn-primary btn-block" id="bulkESave" style="margin-top:8px">Add expenses</button>', function () {
        $('#bulkESave').addEventListener('click', function () {
          var list = $('#bulkE').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
            var p = l.split(/\t|,/).map(function (x) { return x.trim(); });
            return { category: p[0] || 'General', amount: num(p[1]), note: p[2] || '' };
          }).filter(function (e) { return e.amount > 0; });
          if (!list.length) { toast('Paste at least one row with an amount', true); return; }
          var btn = $('#bulkESave'); btn.disabled = true; btn.textContent = 'Adding…';
          api('apiBulkAddExpenses', state.token, list)
            .then(function (r) { closeModal(); toast('Added ' + r.count + ' expenses'); if (window.__cashLoad) window.__cashLoad(); })
            .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Add expenses'; });
        });
      });
  }

  // ---- shared bits for purchases / invoices ---------------------------------
  function statusBadge(s) {
    s = String(s || 'unpaid').toLowerCase();
    var cls = s === 'paid' ? 'ok' : (s === 'partial' ? 'warn' : 'bad');
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }

  // A reusable line-item editor (product picker + qty + unit price/cost).
  function itemsEditor(unitLabel, unitKey, initial) {
    var lines = (initial || []).map(function (l) { return { productId: l.productId, name: l.name, qty: Number(l.qty) || 0, unit: Number(l.unit) || 0 }; });
    var wrap = document.createElement('div');
    var onChangeCb = null;
    wrap.innerHTML =
      '<div class="grid2"><div class="field"><label class="label">Product</label>' +
        '<select class="input" data-ie="prod"><option value="">— select product —</option>' +
        state.products.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label class="label">Qty</label><input class="input num" data-ie="qty" type="number" value="1" min="1"></div></div>' +
      '<div class="grid2"><div class="field"><label class="label">' + esc(unitLabel) + '</label><input class="input num" data-ie="unit" type="number" value="0"></div>' +
        '<div class="field" style="display:flex;align-items:flex-end"><button class="btn btn-ghost btn-block" data-ie="add" type="button">' + icon('plus') + 'Add line</button></div></div>' +
      '<div data-ie="list"></div>';
    var prodSel = $('[data-ie="prod"]', wrap);
    prodSel.addEventListener('change', function () {
      var p = state.products.filter(function (x) { return x.id === prodSel.value; })[0];
      if (p) $('[data-ie="unit"]', wrap).value = unitKey === 'cost' ? (p.cost || 0) : (p.price || 0);
    });
    $('[data-ie="add"]', wrap).addEventListener('click', function () {
      var p = state.products.filter(function (x) { return x.id === prodSel.value; })[0];
      var qty = Math.floor(num($('[data-ie="qty"]', wrap).value)) || 0;
      var unit = num($('[data-ie="unit"]', wrap).value);
      if (!p) { toast('Pick a product', true); return; }
      if (qty <= 0) { toast('Qty must be above 0', true); return; }
      lines.push({ productId: p.id, name: p.name, qty: qty, unit: unit });
      $('[data-ie="qty"]', wrap).value = 1; render();
    });
    function render() {
      var total = lines.reduce(function (a, l) { return a + l.qty * l.unit; }, 0);
      $('[data-ie="list"]', wrap).innerHTML = lines.length ? '<div class="table-wrap" style="margin-top:8px"><table class="table"><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th><th></th></tr></thead><tbody>' +
        lines.map(function (l, i) {
          return '<tr><td>' + esc(l.name) + '</td><td class="num">' + l.qty + '</td><td class="num">' + money(l.unit) + '</td><td class="num">' + money(l.qty * l.unit) + '</td>' +
            '<td><button class="btn btn-ghost btn-sm" data-rmline="' + i + '" type="button">✕</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted" style="font-size:.82rem">No items added yet.</p>';
      $all('[data-rmline]', wrap).forEach(function (b) { b.addEventListener('click', function () { lines.splice(+b.getAttribute('data-rmline'), 1); render(); }); });
      if (onChangeCb) onChangeCb();
    }
    render();
    return {
      node: wrap,
      getLines: function () { return lines.map(function (l) { return { productId: l.productId, name: l.name, qty: l.qty, price: l.unit, cost: l.unit }; }); },
      getTotal: function () { return lines.reduce(function (a, l) { return a + l.qty * l.unit; }, 0); },
      onChange: function (cb) { onChangeCb = cb; }
    };
  }

  function recordPaymentModal(refType, refId, reload) {
    modal('Record payment',
      '<div class="field"><label class="label">Amount</label><input class="input num" id="rp_amt" type="number" placeholder="0"></div>' +
      '<div class="field"><label class="label">Method</label><select class="input" id="rp_m"><option>Cash</option><option>Mobile Money</option><option>Card</option><option>Bank</option></select></div>' +
      '<div class="field"><label class="label">Note (optional)</label><input class="input" id="rp_note"></div>' +
      '<button class="btn btn-primary btn-block" id="rp_save">Record</button>', function () {
        $('#rp_save').addEventListener('click', function () {
          var amt = num($('#rp_amt').value); if (amt <= 0) { toast('Enter an amount', true); return; }
          api('apiRecordPayment', state.token, { refType: refType, refId: refId, amount: amt, method: $('#rp_m').value, note: $('#rp_note').value.trim() })
            .then(function () { closeModal(); toast('Payment recorded'); if (reload) reload(); })
            .catch(function (e) { toast(e.message, true); });
        });
      });
  }

  // ---- Suppliers ------------------------------------------------------------
  VIEWS.suppliers = function () {
    return {
      html: '<div class="view-head"><h1>Suppliers</h1><div class="spacer"></div><button class="btn btn-primary btn-sm" id="addSup">' + icon('plus') + ' Add supplier</button></div><div id="supList"><div class="empty">Loading…</div></div>',
      mount: function () {
        $('#addSup').addEventListener('click', function () { supplierModal(null); });
        function load() {
          api('apiGetSuppliers', state.token).then(function (ss) {
            $('#supList').innerHTML = ss.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Phone</th><th></th></tr></thead><tbody>' +
              ss.map(function (s) {
                return '<tr><td><strong>' + esc(s.name) + '</strong><br><span class="muted" style="font-size:.76rem">' + esc(s.email || '') + '</span></td><td>' + esc(s.phone || '—') + '</td>' +
                  '<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-es="' + s.id + '">Edit</button> <button class="btn btn-ghost btn-sm" data-xs="' + s.id + '" style="color:var(--destructive)">✕</button></td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty">No suppliers yet.</div>';
            $all('[data-es]').forEach(function (b) { b.addEventListener('click', function () { supplierModal(ss.filter(function (x) { return x.id === b.getAttribute('data-es'); })[0]); }); });
            $all('[data-xs]').forEach(function (b) { b.addEventListener('click', function () { api('apiDeleteSupplier', state.token, b.getAttribute('data-xs')).then(load).catch(function (e) { toast(e.message, true); }); }); });
          }).catch(function (e) { $('#supList').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        }
        window.__supLoad = load; load();
      }
    };
  };
  function supplierModal(s) {
    var e = !!s; s = s || { name: '', phone: '', email: '', address: '' };
    modal(e ? 'Edit supplier' : 'Add supplier',
      '<div class="field"><label class="label">Name</label><input class="input" id="su_name" value="' + esc(s.name) + '"></div>' +
      '<div class="grid2"><div class="field"><label class="label">Phone</label><input class="input" id="su_phone" value="' + esc(s.phone) + '"></div>' +
      '<div class="field"><label class="label">Email</label><input class="input" id="su_email" value="' + esc(s.email) + '"></div></div>' +
      '<div class="field"><label class="label">Address</label><input class="input" id="su_addr" value="' + esc(s.address) + '"></div>' +
      '<button class="btn btn-primary btn-block" id="su_save">Save</button>', function () {
        $('#su_save').addEventListener('click', function () {
          var data = { id: e ? s.id : '', name: $('#su_name').value.trim(), phone: $('#su_phone').value.trim(), email: $('#su_email').value.trim(), address: $('#su_addr').value.trim() };
          if (!data.name) { toast('Name required', true); return; }
          api('apiSaveSupplier', state.token, data).then(function () { closeModal(); toast('Saved'); if (window.__supLoad) window.__supLoad(); }).catch(function (er) { toast(er.message, true); });
        });
      });
  }

  // ---- Purchases (credit) ---------------------------------------------------
  VIEWS.purchases = function () {
    return {
      html: '<div class="view-head"><h1>Purchases</h1><div class="spacer"></div><button class="btn btn-primary btn-sm" id="newPur">' + icon('plus') + ' New purchase</button></div><div id="purList"><div class="empty">Loading…</div></div>',
      mount: function () {
        $('#newPur').addEventListener('click', purchaseModal);
        function load() {
          api('apiGetPurchases', state.token, { limit: 200 }).then(function (rows) {
            $('#purList').innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Ref</th><th>Date</th><th>Supplier</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>' +
              rows.map(function (p) {
                var bal = (Number(p.total) || 0) - (Number(p.amountPaid) || 0);
                return '<tr><td class="mono">' + esc(p.ref) + '</td><td>' + dt(p.date) + '</td><td>' + esc(p.supplierName || '—') + '</td>' +
                  '<td class="num">' + money(p.total) + '</td><td class="num">' + money(bal) + '</td><td>' + statusBadge(p.status) + '</td>' +
                  '<td>' + (bal > 0 ? '<button class="btn btn-ghost btn-sm" data-pay="' + p.id + '">Pay</button>' : '') + '</td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty">No purchases yet.</div>';
            $all('[data-pay]').forEach(function (b) { b.addEventListener('click', function () { recordPaymentModal('purchase', b.getAttribute('data-pay'), load); }); });
          }).catch(function (e) { $('#purList').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        }
        window.__purLoad = load; load();
      }
    };
  };
  function purchaseModal() {
    api('apiGetSuppliers', state.token).then(function (sups) {
      var ed = itemsEditor('Buying price (' + cur() + ')', 'cost', []);
      modal('New credit purchase',
        '<div class="field"><label class="label">Supplier</label><select class="input" id="pu_sup"><option value="">— none —</option>' +
          sups.map(function (s) { return '<option value="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(s.name) + '</option>'; }).join('') + '</select></div>' +
        '<div id="pu_items"></div>' +
        '<div class="grid2"><div class="field"><label class="label">Amount paid now</label><input class="input num" id="pu_paid" type="number" value="0"></div>' +
          '<div class="field"><label class="label">Due date</label><input class="input" id="pu_due" type="date"></div></div>' +
        '<div class="row"><strong>Total</strong><strong class="num" id="pu_total">' + money(0) + '</strong></div>' +
        '<div class="row"><span class="muted">Balance (payable)</span><strong class="num" id="pu_bal">' + money(0) + '</strong></div>' +
        '<button class="btn btn-primary btn-block" id="pu_save">Save purchase</button>', function () {
          $('#pu_items').appendChild(ed.node);
          function upd() { var t = ed.getTotal(); $('#pu_total').textContent = money(t); $('#pu_bal').textContent = money(Math.max(0, t - num($('#pu_paid').value))); }
          ed.onChange(upd); $('#pu_paid').addEventListener('input', upd); upd();
          $('#pu_save').addEventListener('click', function () {
            var lines = ed.getLines(); if (!lines.length) { toast('Add at least one item', true); return; }
            var sel = $('#pu_sup'); var opt = sel.options[sel.selectedIndex];
            var draft = { supplierId: sel.value, supplierName: opt ? (opt.getAttribute('data-name') || '') : '', items: lines, amountPaid: num($('#pu_paid').value), dueDate: $('#pu_due').value };
            var btn = $('#pu_save'); btn.disabled = true; btn.textContent = 'Saving…';
            api('apiCreatePurchase', state.token, draft).then(function () { return refreshProducts(); })
              .then(function () { closeModal(); toast('Purchase saved'); if (window.__purLoad) window.__purLoad(); })
              .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Save purchase'; });
          });
        });
    }).catch(function (e) { toast(e.message, true); });
  }

  // ---- Invoices -------------------------------------------------------------
  VIEWS.invoices = function () {
    return {
      html: '<div class="view-head"><h1>Invoices</h1><div class="spacer"></div><button class="btn btn-primary btn-sm" id="newInv">' + icon('plus') + ' New invoice</button></div><div id="invListV"><div class="empty">Loading…</div></div>',
      mount: function () {
        $('#newInv').addEventListener('click', function () { invoiceModal(null); });
        function load() {
          api('apiGetInvoices', state.token, { limit: 200 }).then(function (rows) {
            $('#invListV').innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Ref</th><th>Date</th><th>Customer</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>' +
              rows.map(function (v) {
                var bal = (Number(v.total) || 0) - (Number(v.amountPaid) || 0);
                return '<tr><td class="mono">' + esc(v.ref) + '</td><td>' + dt(v.date) + '</td><td>' + esc(v.customerName || '—') + '</td>' +
                  '<td class="num">' + money(v.total) + '</td><td class="num">' + money(bal) + '</td><td>' + statusBadge(v.status) + '</td>' +
                  '<td><button class="btn btn-ghost btn-sm" data-vv="' + v.id + '">Open</button></td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty">No invoices yet.</div>';
            $all('[data-vv]').forEach(function (b) { b.addEventListener('click', function () { openInvoice(b.getAttribute('data-vv')); }); });
          }).catch(function (e) { $('#invListV').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        }
        window.__invvLoad = load; load();
      }
    };
  };
  function invoiceModal(existing) {
    var isEdit = !!existing, inv = isEdit ? existing.invoice : null;
    var initItems = isEdit ? existing.items.map(function (it) { return { productId: it.productId, name: it.name, qty: Number(it.qty) || 0, unit: Number(it.price) || 0 }; }) : [];
    api('apiGetCustomers', state.token).then(function (custs) {
      var ed = itemsEditor('Unit price (' + cur() + ')', 'price', initItems);
      modal(isEdit ? 'Edit invoice ' + inv.ref : 'New invoice',
        '<div class="grid2"><div class="field"><label class="label">Customer</label><input class="input" id="iv_cust" list="iv_custs" value="' + (isEdit ? esc(inv.customerName || '') : '') + '" placeholder="Name">' +
          '<datalist id="iv_custs">' + custs.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('') + '</datalist></div>' +
          '<div class="field"><label class="label">Due date</label><input class="input" id="iv_due" type="date" value="' + (isEdit && inv.dueDate ? esc(String(inv.dueDate).slice(0, 10)) : '') + '"></div></div>' +
        '<div id="iv_items"></div>' +
        '<div class="grid2"><div class="field"><label class="label">Amount paid</label><input class="input num" id="iv_paid" type="number" value="' + (isEdit ? (Number(inv.amountPaid) || 0) : 0) + '"></div>' +
          '<div class="field"><label class="label">Notes</label><input class="input" id="iv_notes" value="' + (isEdit ? esc(inv.notes || '') : '') + '"></div></div>' +
        '<div class="row"><strong>Items total</strong><strong class="num" id="iv_total">' + money(0) + '</strong></div>' +
        '<p class="muted" style="font-size:.72rem">VAT/discount applied on save per Settings.</p>' +
        '<button class="btn btn-primary btn-block" id="iv_save">' + (isEdit ? 'Save changes' : 'Create invoice') + '</button>', function () {
          $('#iv_items').appendChild(ed.node);
          function upd() { $('#iv_total').textContent = money(ed.getTotal()); }
          ed.onChange(upd); upd();
          $('#iv_save').addEventListener('click', function () {
            var lines = ed.getLines(); if (!lines.length) { toast('Add at least one item', true); return; }
            var draft = { id: isEdit ? inv.id : '', customerName: $('#iv_cust').value.trim(), dueDate: $('#iv_due').value, items: lines, amountPaid: num($('#iv_paid').value), notes: $('#iv_notes').value.trim() };
            var btn = $('#iv_save'); btn.disabled = true; btn.textContent = 'Saving…';
            (isEdit ? api('apiUpdateInvoice', state.token, draft) : api('apiCreateInvoice', state.token, draft))
              .then(function (res) { closeModal(); toast('Saved'); if (window.__invvLoad) window.__invvLoad(); openInvoiceData(res); })
              .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Save'; });
          });
        });
    }).catch(function (e) { toast(e.message, true); });
  }
  function openInvoice(id) { api('apiGetInvoice', state.token, id).then(openInvoiceData).catch(function (e) { toast(e.message, true); }); }
  function openInvoiceData(data) {
    var v = data.invoice, items = data.items, set = state.settings;
    var bal = (Number(v.total) || 0) - (Number(v.amountPaid) || 0);
    var doc = '<div id="receipt" class="invoice-doc">' +
      (set.logoUrl ? '<img class="r-logo" src="' + esc(set.logoUrl) + '" alt="">' : '') +
      '<div class="inv-head"><div><div class="r-biz">' + esc(set.businessName) + '</div>' +
        '<div class="muted" style="font-size:.78rem">' + esc(set.address || '') + (set.phone ? '<br>' + esc(set.phone) : '') + '</div></div>' +
        '<div style="text-align:right"><div style="font-family:var(--font-display);font-weight:700;font-size:1.1rem">INVOICE</div><div class="mono">' + esc(v.ref) + '</div>' +
          '<div class="muted" style="font-size:.78rem">' + dt(v.date) + (v.dueDate ? '<br>Due: ' + esc(String(v.dueDate).slice(0, 10)) : '') + '</div></div></div>' +
      '<div class="r-rule"></div>' +
      '<div style="margin:8px 0"><span class="muted">Bill to:</span> <strong>' + esc(v.customerName || '—') + '</strong></div>' +
      '<table class="table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>' +
        items.map(function (it) { return '<tr><td>' + esc(it.name) + '</td><td class="num">' + it.qty + '</td><td class="num">' + money(it.price) + '</td><td class="num">' + money(it.subtotal) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<div class="r-line"><span>Subtotal</span><span>' + money(v.itemsSubtotal) + '</span></div>' +
      (num(v.discount) ? '<div class="r-line"><span>Discount</span><span>-' + money(v.discount) + '</span></div>' : '') +
      (num(v.tax) ? '<div class="r-line"><span>VAT</span><span>' + money(v.tax) + '</span></div>' : '') +
      '<div class="r-line"><strong>Total</strong><strong>' + money(v.total) + '</strong></div>' +
      '<div class="r-line"><span>Paid</span><span>' + money(v.amountPaid) + '</span></div>' +
      '<div class="r-line"><strong>Balance</strong><strong>' + money(bal) + '</strong></div>' +
      (v.notes ? '<div class="r-rule"></div><div class="muted">' + esc(v.notes) + '</div>' : '') +
      '<div class="r-center muted" style="margin-top:10px">' + esc(set.receiptFooter || '') + '</div></div>';
    modal('Invoice ' + v.ref, doc + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost" id="iv_print">Print</button>' +
      '<button class="btn btn-ghost" id="iv_edit">Edit</button>' +
      (bal > 0 ? '<button class="btn btn-ghost" id="iv_pay">Record payment</button>' : '') +
      '<button class="btn btn-danger" id="iv_del">Delete</button></div>', function () {
        $('#iv_print').addEventListener('click', function () { window.print(); });
        $('#iv_edit').addEventListener('click', function () { invoiceModal(data); });
        var pb = $('#iv_pay'); if (pb) pb.addEventListener('click', function () { recordPaymentModal('invoice', v.id, function () { openInvoice(v.id); if (window.__invvLoad) window.__invvLoad(); }); });
        $('#iv_del').addEventListener('click', function () {
          api('apiDeleteInvoice', state.token, v.id).then(function () { closeModal(); toast('Deleted'); if (window.__invvLoad) window.__invvLoad(); }).catch(function (e) { toast(e.message, true); });
        });
      });
  }

  // ---- dashboard helpers (cards + customize) --------------------------------
  function financeRole() { return state.user && (state.user.role === 'owner' || state.user.role === 'manager'); }
  function dashVisible() { try { return JSON.parse(localStorage.getItem('nl-dash') || '{}'); } catch (e) { return {}; } }
  function dashSet(v) { localStorage.setItem('nl-dash', JSON.stringify(v)); }
  function plRow(l, v) { return '<div class="row"><span class="muted">' + esc(l) + '</span><span class="num">' + v + '</span></div>'; }
  function creditTable(title, list) {
    return '<div class="card"><h2>' + esc(title) + '</h2>' + (list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Total</th><th>Paid</th><th>Balance</th><th>Due</th><th></th></tr></thead><tbody>' +
      list.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td><td class="num">' + money(r.total) + '</td><td class="num">' + money(r.amountPaid) + '</td><td class="num">' + money(r.balance) + '</td>' +
          '<td>' + (r.dueDate ? esc(String(r.dueDate).slice(0, 10)) : '—') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" data-rp="' + r.refType + ':' + r.refId + '">Pay</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted">Nothing outstanding.</p>') + '</div>';
  }
  function dashCardDefs() {
    return [
      { id: 'stats', label: 'Key figures', render: function (d) {
        return '<div class="stat-grid">' +
          statCard('Inventory value', money(d.stockValue)) + statCard('Cash balance', money(d.cashBalance)) +
          statCard('Transactions', d.transactionCount) + statCard('Products', d.productCount) +
          statCard('Yearly revenue', money(d.yearlyRevenue)) + statCard('Suppliers', d.supplierCount) +
          statCard('Money due to you', money(d.receivables), 'amber') + statCard('You owe', money(d.payables), 'red') + '</div>';
      } },
      { id: 'quick', label: 'Quick actions', render: function () {
        return '<div class="card"><h2>Quick actions</h2><div class="quick-actions">' +
          '<button class="btn btn-primary" data-qa="pos">' + icon('shopping-cart') + 'New sale</button>' +
          '<button class="btn btn-ghost" data-qa="invoice">' + icon('file-text') + 'New invoice</button>' +
          '<button class="btn btn-ghost" data-qa="purchase">' + icon('shopping-bag') + 'Credit purchase</button>' +
          '<button class="btn btn-ghost" data-qa="expense">' + icon('minus') + 'Expense</button>' +
          '<button class="btn btn-ghost" data-qa="income">' + icon('plus') + 'Add money</button></div></div>';
      } },
      { id: 'graph', label: 'Running balance graph', render: function (d) {
        return (d.cashSeries && d.cashSeries.length) ? '<div class="card"><h2>Running balance · 30 days</h2>' + lineChart(d.cashSeries) + '</div>' : '';
      } },
      { id: 'pnl', label: 'Profit & Loss', render: function (d) {
        var p = d.pnl || {};
        return '<div class="card"><h2>Profit &amp; Loss · this month</h2>' +
          plRow('Revenue', money(p.revenue)) + plRow('Cost of goods', money(p.cogs)) +
          plRow('Gross profit', money(p.grossProfit)) + plRow('Expenses', money(p.expenses)) +
          '<div class="row"><strong>Net profit</strong><strong class="num">' + money(p.netProfit) + '</strong></div>' +
          plRow('Top selling', p.topSelling ? esc(p.topSelling.name) : '—') +
          plRow('Most profitable', p.mostProfitable ? esc(p.mostProfitable.name) : '—') + '</div>';
      } },
      { id: 'invoices', label: 'Invoice status', render: function (d) {
        var s = d.invoiceStatus || {};
        return '<div class="card"><h2>Invoice status</h2><div class="stat-grid" style="margin-bottom:0">' +
          statCard('Unpaid', s.unpaid || 0) + statCard('Overdue', s.overdue || 0, 'red') + statCard('Paid', s.paid || 0) + '</div></div>';
      } },
      { id: 'receivables', label: 'Receivables (due to you)', render: function (d) { return creditTable('Receivables — money due to you', d.receivablesList || []); } },
      { id: 'payables', label: 'Payables (you owe)', render: function (d) { return creditTable('Payables — what you owe', d.payablesList || []); } },
      { id: 'lowstock', label: 'Low-stock alerts', render: function (d) {
        return '<div class="card"><h2>Low-stock alerts</h2>' + ((d.lowCount + d.outCount) ? '<div class="row"><span><span class="badge bad">' + d.outCount + ' out</span> <span class="badge warn">' + d.lowCount + ' low</span></span><span class="link" data-qa2="inventory">View stock</span></div>' : '<p class="muted">All good — nothing low.</p>') + '</div>';
      } },
      { id: 'recent', label: 'Recent transactions', render: function (d) {
        return '<div class="card"><h2>Recent transactions</h2>' + ((d.recentTx || []).length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Customer</th><th>Total</th></tr></thead><tbody>' +
          d.recentTx.map(function (t) { return '<tr><td>' + dt(t.date) + '</td><td>' + esc(t.item) + '</td><td class="num">' + t.qty + '</td><td>' + esc(t.customer) + '</td><td class="num">' + money(t.total) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No sales yet.</p>') + '</div>';
      } }
    ];
  }
  function wireDash() {
    $all('[data-qa]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-qa');
        if (a === 'pos') go('pos');
        else if (a === 'invoice') { go('invoices'); setTimeout(function () { invoiceModal(null); }, 60); }
        else if (a === 'purchase') { go('purchases'); setTimeout(purchaseModal, 60); }
        else if (a === 'expense') { go('cash'); setTimeout(expenseModal, 60); }
        else if (a === 'income') { go('cash'); setTimeout(incomeModal, 60); }
      });
    });
    $all('[data-qa2]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-qa2')); }); });
    $all('[data-rp]').forEach(function (b) { b.addEventListener('click', function () { var p = b.getAttribute('data-rp').split(':'); recordPaymentModal(p[0], p[1], function () { route(); }); }); });
  }
  function customizeDash(defs) {
    var vis = dashVisible();
    modal('Customize dashboard',
      '<p class="muted" style="font-size:.82rem;margin-top:0">Show or hide cards.</p>' +
      defs.map(function (c) { return '<label class="row" style="cursor:pointer"><span>' + esc(c.label) + '</span><input type="checkbox" data-dc="' + c.id + '"' + (vis[c.id] !== false ? ' checked' : '') + '></label>'; }).join('') +
      '<button class="btn btn-primary btn-block" id="dc_save" style="margin-top:12px">Done</button>', function () {
        $('#dc_save').addEventListener('click', function () {
          var v = {}; $all('[data-dc]').forEach(function (cb) { v[cb.getAttribute('data-dc')] = cb.checked; });
          dashSet(v); closeModal(); route();
        });
      });
  }

  // ---- Customers ------------------------------------------------------------
  VIEWS.customers = function () {
    return {
      html: '<div class="view-head"><h1>Customers</h1><div class="spacer"></div><button class="btn btn-primary btn-sm" id="addCust">+ Add</button></div><div id="cList"><div class="empty">Loading…</div></div>',
      mount: function () {
        $('#addCust').addEventListener('click', function () { custModal(null); });
        function load() {
          api('apiGetCustomers', state.token).then(function (cs) {
            state.customers = cs;
            $('#cList').innerHTML = cs.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Phone</th><th></th></tr></thead><tbody>' +
              cs.map(function (c) {
                return '<tr><td><strong>' + esc(c.name) + '</strong><br><span class="muted" style="font-size:.76rem">' + esc(c.email || '') + '</span></td><td>' + esc(c.phone || '—') + '</td>' +
                  '<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ec="' + c.id + '">Edit</button> <button class="btn btn-ghost btn-sm" data-xc="' + c.id + '" style="color:var(--destructive)">✕</button></td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty">No customers yet.</div>';
            $all('[data-ec]').forEach(function (b) { b.addEventListener('click', function () { custModal(cs.filter(function (c) { return c.id === b.getAttribute('data-ec'); })[0]); }); });
            $all('[data-xc]').forEach(function (b) { b.addEventListener('click', function () { api('apiDeleteCustomer', state.token, b.getAttribute('data-xc')).then(load).catch(function (e) { toast(e.message, true); }); }); });
          });
        }
        window.__custLoad = load; load();
      }
    };
  };
  function custModal(c) {
    var e = !!c; c = c || { name: '', phone: '', email: '', address: '' };
    modal(e ? 'Edit customer' : 'Add customer',
      '<div class="field"><label class="label">Name</label><input class="input" id="c_name" value="' + esc(c.name) + '"></div>' +
      '<div class="grid2"><div class="field"><label class="label">Phone</label><input class="input" id="c_phone" value="' + esc(c.phone) + '"></div>' +
      '<div class="field"><label class="label">Email</label><input class="input" id="c_email" value="' + esc(c.email) + '"></div></div>' +
      '<div class="field"><label class="label">Address</label><input class="input" id="c_addr" value="' + esc(c.address) + '"></div>' +
      '<button class="btn btn-primary btn-block" id="c_save">Save</button>', function () {
        $('#c_save').addEventListener('click', function () {
          var data = { id: e ? c.id : '', name: $('#c_name').value.trim(), phone: $('#c_phone').value.trim(), email: $('#c_email').value.trim(), address: $('#c_addr').value.trim() };
          if (!data.name) { toast('Name required', true); return; }
          api('apiSaveCustomer', state.token, data).then(function () { closeModal(); toast('Saved'); if (window.__custLoad) window.__custLoad(); }).catch(function (er) { toast(er.message, true); });
        });
      });
  }

  // ---- Reports --------------------------------------------------------------
  VIEWS.reports = function () {
    return {
      html: '<div class="view-head"><h1>Reports</h1></div>' +
        '<div class="toolbar"><input class="input" id="rFrom" type="date" style="max-width:170px">' +
        '<input class="input" id="rTo" type="date" style="max-width:170px"><button class="btn btn-ghost btn-sm" id="rGo">Run</button>' +
        '<button class="btn btn-ghost btn-sm" id="rCsv">Export CSV</button></div><div id="rOut"><div class="empty">Pick a range and Run.</div></div>',
      mount: function () {
        function run() {
          var opts = {}; if ($('#rFrom').value) opts.from = $('#rFrom').value; if ($('#rTo').value) opts.to = $('#rTo').value;
          Promise.all([api('apiSalesSummary', state.token, opts), api('apiInventoryValue', state.token),
            api('apiCustomerReport', state.token), api('apiSupplierReport', state.token)]).then(function (r) {
            var s = r[0], inv = r[1], custs = r[2], sups = r[3];
            window.__lastReport = s;
            $('#rOut').innerHTML =
              '<div class="stat-grid">' +
                statCard('Revenue', money(s.total)) + statCard('Sales', s.count) + statCard('VAT collected', money(s.tax), 'amber') +
                statCard('Stock value (retail)', money(inv.retailValue)) + '</div>' +
              (s.byDay.length ? '<div class="card"><h2>By day</h2><div class="bars">' + barChart(s.byDay) + '</div></div>' : '') +
              '<div class="card" style="margin-top:16px"><h2>Top products</h2>' + (s.topProducts.length ? s.topProducts.map(function (p) {
                return '<div class="row"><span>' + esc(p.name) + ' <span class="muted">×' + p.qty + '</span></span><strong class="num">' + money(p.revenue) + '</strong></div>';
              }).join('') : '<p class="muted">No data.</p>') + '</div>' +
              reportTable('Customer report', custs) + reportTable('Supplier report', sups);
          }).catch(function (e) { $('#rOut').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        }
        $('#rGo').addEventListener('click', run);
        $('#rCsv').addEventListener('click', function () {
          var s = window.__lastReport; if (!s) { toast('Run a report first', true); return; }
          var csv = 'Product,Qty,Revenue\n' + s.topProducts.map(function (p) { return '"' + p.name + '",' + p.qty + ',' + p.revenue; }).join('\n');
          var blob = new Blob([csv], { type: 'text/csv' }); var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = 'report.csv'; a.click();
        });
        run();
      }
    };
  };

  // ---- Settings -------------------------------------------------------------
  VIEWS.settings = function () {
    var s = state.settings;
    return {
      html: '<div class="view-head"><h1>Settings</h1></div>' +
        '<div class="card"><h2>Business</h2>' +
          field('Name', 's_name', s.businessName) + '<div class="grid2">' + field('Phone', 's_phone', s.phone || '') + field('Currency', 's_cur', s.currency || 'UGX') + '</div>' +
          field('Address', 's_addr', s.address || '') + field('Receipt footer', 's_foot', s.receiptFooter || '') +
          field('Logo URL', 's_logo', s.logoUrl || '') +
          '<div class="grid2">' +
            '<div class="field"><label class="label">VAT</label><select class="input" id="s_vat"><option value="false"' + (!s.vatEnabled ? ' selected' : '') + '>Off</option><option value="true"' + (s.vatEnabled ? ' selected' : '') + '>On</option></select></div>' +
            field('VAT rate %', 's_rate', s.vatRate || 18) + '</div>' +
          '<div class="grid2">' +
            '<div class="field"><label class="label">I have a separate store</label><select class="input" id="s_store"><option value="false"' + (!s.hasStore ? ' selected' : '') + '>No</option><option value="true"' + (s.hasStore ? ' selected' : '') + '>Yes</option></select></div>' +
            field('Low-stock default', 's_low', s.lowStockDefault || 5) + '</div>' +
          '<button class="btn btn-primary" id="saveSet">Save settings</button></div>' +
        '<div class="card"><h2>Appearance</h2><div class="row"><span class="muted">Theme</span><button class="btn btn-ghost" id="thBtn">Toggle light / dark</button></div></div>' +
        '<div class="card"><h2>My password</h2>' + field('Current', 'p_cur', '', 'password') + field('New', 'p_new', '', 'password') +
          '<button class="btn btn-ghost" id="chPw">Change password</button></div>' +
        (state.user.role === 'owner' ? '<div class="card"><div style="display:flex;align-items:center"><h2>Users</h2><div class="spacer"></div><button class="btn btn-primary btn-sm" id="addUser">+ Add</button></div><div id="uList" style="margin-top:8px"></div></div>' : ''),
      mount: function () {
        $('#saveSet').addEventListener('click', function () {
          var patch = {
            businessName: $('#s_name').value.trim(), phone: $('#s_phone').value.trim(), currency: $('#s_cur').value.trim() || 'UGX',
            address: $('#s_addr').value.trim(), receiptFooter: $('#s_foot').value.trim(), logoUrl: $('#s_logo').value.trim(),
            vatEnabled: $('#s_vat').value === 'true', vatRate: num($('#s_rate').value),
            lowStockDefault: num($('#s_low').value), hasStore: $('#s_store').value === 'true'
          };
          api('apiSaveSettings', state.token, patch).then(function (ns) {
            state.settings = Object.assign(state.settings, ns); toast('Saved');
            $all('.biz').forEach(function (b) { b.textContent = ns.businessName; });
          }).catch(function (e) { toast(e.message, true); });
        });
        $('#thBtn').addEventListener('click', toggleTheme);
        $('#chPw').addEventListener('click', function () {
          api('apiChangePassword', state.token, $('#p_cur').value, $('#p_new').value)
            .then(function () { $('#p_cur').value = ''; $('#p_new').value = ''; toast('Password changed'); })
            .catch(function (e) { toast(e.message, true); });
        });
        if (state.user.role === 'owner') {
          var addBtn = $('#addUser'); if (addBtn) addBtn.addEventListener('click', function () { userModal(null); });
          loadUsers();
        }
      }
    };
  };
  function loadUsers() {
    api('apiGetUsers', state.token).then(function (us) {
      var box = $('#uList'); if (!box) return;
      box.innerHTML = us.map(function (u) {
        return '<div class="row"><div><strong>' + esc(u.name) + '</strong> <span class="badge">' + esc(u.role) + '</span><br><span class="muted" style="font-size:.76rem">' + esc(u.username) + (u.email ? ' · ' + esc(u.email) : '') + '</span></div>' +
          '<div style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-eu="' + u.id + '">Edit</button>' + (u.id !== state.user.id ? ' <button class="btn btn-ghost btn-sm" data-du="' + u.id + '" style="color:var(--destructive)">✕</button>' : '') + '</div></div>';
      }).join('');
      $all('[data-eu]').forEach(function (b) { b.addEventListener('click', function () { userModal(us.filter(function (u) { return u.id === b.getAttribute('data-eu'); })[0]); }); });
      $all('[data-du]').forEach(function (b) { b.addEventListener('click', function () { api('apiDeleteUser', state.token, b.getAttribute('data-du')).then(loadUsers).catch(function (e) { toast(e.message, true); }); }); });
    });
  }
  function userModal(u) {
    var e = !!u; u = u || { name: '', username: '', email: '', role: 'cashier', active: true };
    modal(e ? 'Edit user' : 'Add user',
      field('Name', 'u_name', u.name) + '<div class="grid2">' + field('Username', 'u_user', u.username) + field('Email', 'u_email', u.email || '') + '</div>' +
      '<div class="grid2"><div class="field"><label class="label">Role</label><select class="input" id="u_role">' +
        ['cashier', 'manager', 'owner'].map(function (r) { return '<option' + (u.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
        field(e ? 'New password (blank = keep)' : 'Password', 'u_pw', '', 'password') + '</div>' +
      '<button class="btn btn-primary btn-block" id="u_save">Save</button>', function () {
        $('#u_save').addEventListener('click', function () {
          var data = { id: e ? u.id : '', name: $('#u_name').value.trim(), username: $('#u_user').value.trim(), email: $('#u_email').value.trim(), role: $('#u_role').value, password: $('#u_pw').value };
          if (!data.name || !data.username) { toast('Name and username required', true); return; }
          api('apiSaveUser', state.token, data).then(function () { closeModal(); toast('Saved'); loadUsers(); }).catch(function (er) { toast(er.message, true); });
        });
      });
  }
  function field(label, id, val, type) {
    return '<div class="field"><label class="label">' + esc(label) + '</label><input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '"></div>';
  }

  // ===========================================================================
  // BOOT
  // ===========================================================================
  applyTheme();
  window.addEventListener('hashchange', route);

  if (!API_URL) {
    $('#app').innerHTML = '<div class="boot"><p>Backend URL not configured.</p>' +
      '<p class="muted">Set <code>API_URL</code> in <code>config.js</code> to your Apps Script /exec URL, then reload.</p></div>';
    return;
  }

  api('apiBootstrap').then(function (res) {
    if (res && res.settings) state.settings = Object.assign(state.settings, res.settings);
    applyTheme(state.settings.theme);
    if (state.token) {
      return api('apiMe', state.token).then(function (u) { state.user = u; return afterLogin(); })
        .catch(function () { localStorage.removeItem('nl-token'); state.token = ''; renderLogin(); });
    }
    renderLogin();
  }).catch(function (e) {
    $('#app').innerHTML = '<div class="boot"><p>Could not reach the server.</p><p class="muted">' + esc(e.message) +
      '</p><p class="muted">Check the <code>API_URL</code> in config.js, that the Web App is deployed (Anyone), and that <code>ensureSeed()</code> has been run once.</p></div>';
  });
})();
