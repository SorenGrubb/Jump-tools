/* The Light Path on grubblab.com, with accounts.                                         2026-11-12
 *
 * Søren: *"I want people to log in with their Google login and when they have finished the 100 levels
 * they get the badge and then they start working together."* -- which is NAD Network's own rule
 * (the qualifier, then the shared campaign), now kept by grubblab's Apps Script backend
 * (backend/Lightpath.gs) instead of NAD's Django.
 *
 * Like solo.js, this answers the game's two addresses by intercepting `fetch`, so lightpath.js and
 * engine.js stay byte for byte NAD Network's files. It is loaded AFTER solo.js and wraps it:
 *   signed in  (the Google sign-in of the page this game is framed in -- Jump Academy)
 *              -> the server: your own hundred, then the community's campaign; records shared.
 *   signed out -> solo.js: progress kept in this browser, exactly as before.
 * The server cannot answer HTTP 409 (Apps Script always says 200), so it says `status: 409` in the
 * body and this turns it back into a 409 for the game.
 */
(function () {
  'use strict';
  var API = document.body.getAttribute('data-api');
  var BOARD = document.body.getAttribute('data-board');
  var ENDPOINT = document.body.getAttribute('data-endpoint');
  var inner = window.fetch.bind(window);      // solo.js's, which handles the signed-out case

  function cred() {
    try { var p = window.parent; if (p && p !== window && typeof p.lpCred === 'function') return p.lpCred() || ''; } catch (e) {}
    try { if (window.GOOGLE_CREDENTIAL) return window.GOOGLE_CREDENTIAL; } catch (e) {}
    return '';
  }
  function reply(payload, status) {
    return new Response(JSON.stringify(payload), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }
  /* Said out loud, once: signed in, but this table is being kept in this browser only, so it earns no
     point and is not on your account. Søren, 13 Nov: "Not getting any points for Lightpath levels." --
     the server had not been redeployed, and nothing on the page said so. */
  var saidOffline = false;
  function offline(why) {
    try { console.warn('[lightpath] kept in this browser only:', why); } catch (e) {}
    if (saidOffline) return; saidOffline = true;
    var put = function () {
      var hd = document.querySelector('header'); if (!hd) return;
      var n = document.createElement('div');
      n.style.cssText = 'margin-top:4px;font-size:.7rem;color:#f2c14e';
      n.textContent = '\u26A0 Not saved to your account and no points: ' + why + '. Your progress is kept in this browser.';
      hd.appendChild(n);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put();
  }
  function ask(body, fallback) {
    body.type = 'lightpath'; body.credential = cred();
    return inner(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        /* an expired sign-in or an Apps Script without Lightpath.gs yet: play on in this browser */
        if (!d || d.error === 'unauthenticated' || (d.ok === false && d.error && !d.status)){
          offline(!d ? 'no answer from the server'
                : d.error === 'unauthenticated' ? 'your sign-in has expired \u2014 sign in again (top right)'
                : /unknown report type|not in this Apps Script/.test(d.error) ? 'the server does not have the game yet (Lightpath.gs)'
                : d.error);
          return fallback();
        }
        var st = d && d.status ? d.status : 200;
        if (d) delete d.status;
        /* after a clear, the Academy page (if this is framed in it) may want to redraw its badges */
        try { if (body.action === 'clear' && window.parent !== window) window.parent.dispatchEvent(new CustomEvent('lightpath-clear', { detail: d })); } catch (e) {}
        return reply(d, st);
      }, function () { offline('the server could not be reached'); return fallback(); });
  }

  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var opts = init || {};
    var method = (opts.method || (input && input.method) || 'GET').toUpperCase();
    if ((url === API || url === BOARD) && cred() && ENDPOINT) {
      var fb = function () { return inner(input, init); };
      if (url === BOARD) return ask({ action: 'board' }, fb);
      if (method === 'POST') {
        var b = {}; try { b = JSON.parse(opts.body || '{}'); } catch (e) {}
        return ask({ action: 'clear', level: b.level, run: b.run, seconds: b.seconds, shots: b.shots }, fb);
      }
      return ask({ action: 'progress' }, fb);
    }
    return inner(input, init);
  };
}());

/* On a telephone grubblab.css clamps the instructions to two lines; a tap shows the rest. */
document.addEventListener('click', function (e) {
  var h = e.target && e.target.closest && e.target.closest('#hint');
  if (h) h.classList.toggle('open');
});
