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
  function ask(body, fallback) {
    body.type = 'lightpath'; body.credential = cred();
    return inner(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        /* an expired sign-in or an Apps Script without Lightpath.gs yet: play on in this browser */
        if (!d || d.error === 'unauthenticated' || (d.ok === false && d.error && !d.status)) return fallback();
        var st = d && d.status ? d.status : 200;
        if (d) delete d.status;
        /* after a clear, the Academy page (if this is framed in it) may want to redraw its badges */
        try { if (body.action === 'clear' && window.parent !== window) window.parent.dispatchEvent(new CustomEvent('lightpath-clear', { detail: d })); } catch (e) {}
        return reply(d, st);
      }, function () { return fallback(); });
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
