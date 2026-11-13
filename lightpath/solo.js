/* The Light Path, played by one person on one browser.
 *
 * On NAD Network the game has a server behind it: it keeps the shared
 * campaign — one frontier level at a time, unlocked for everybody by whoever
 * clears it — and the records. On grubblab.com there is no such server, and
 * the game does not need one: the hundred tables are generated here from a
 * fixed seed, and the optics are simulated here. The only thing missing is
 * somewhere to remember what you have done.
 *
 * So this file is that somewhere. It answers the two addresses the game asks
 * for, out of `localStorage`, before the request ever leaves the page.
 * Nothing is uploaded, nothing is downloaded, and the page works offline once
 * it has loaded.
 *
 * **It intercepts `fetch` rather than editing the game.** `lightpath.js` is
 * the same file that runs on NAD Network, byte for byte, so a fix made in one
 * place is a fix in both; and the day grubblab.com grows a real backend, you
 * delete the one <script> tag that loads this and the game starts talking to
 * it instead. The shapes below are the whole contract — see README.md.
 *
 * What is kept, under one key:
 *
 *   run       which pass through the hundred tables you are on
 *   frontier  the lowest table you have not yet aligned
 *   cleared   {level: 1} for every table you have aligned this run
 *   done      how many of them that is
 *   best      {level: {seconds, shots}} — your own record on each table
 *
 * Clearing your browser's site data resets the campaign. That is the honest
 * trade for having no account: there is nowhere else for it to live.
 */
(function () {
  'use strict';

  var KEY = 'lightpath.solo.v1';
  var LEVELS = parseInt(
    (document.body.getAttribute('data-levels') || '100'), 10) || 100;
  var API = document.body.getAttribute('data-api') || 'solo:progress';
  var BOARD = document.body.getAttribute('data-board') || 'solo:board';
  var WHO = document.body.getAttribute('data-whose') || 'You';

  function blank() {
    return { run: 1, frontier: 1, cleared: {}, done: 0, best: {} };
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) { return blank(); }
      var d = JSON.parse(raw);
      /* Anything missing or nonsense is replaced rather than trusted: this
         comes out of a store the player can edit, and a frontier of "banana"
         would lock the game rather than cheat it. */
      var out = blank();
      if (typeof d.run === 'number' && d.run >= 1) { out.run = d.run | 0; }
      if (typeof d.frontier === 'number' && d.frontier >= 1
          && d.frontier <= LEVELS) { out.frontier = d.frontier | 0; }
      if (d.cleared && typeof d.cleared === 'object') { out.cleared = d.cleared; }
      if (d.best && typeof d.best === 'object') { out.best = d.best; }
      out.done = Object.keys(out.cleared).length;
      return out;
    } catch (e) {
      /* A private window, blocked site data, a corrupted value. The game is
         entirely playable without any of this — only the memory of it is
         lost — so this is a shrug and not an error box over a puzzle. */
      return blank();
    }
  }

  function save(d) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) { /* see above */ }
  }

  function progress() {
    var d = load();
    return {
      run: d.run,
      frontier: d.frontier,
      /* **Always `solo`.** It is the mode the game already has for a player
         working through their own hundred tables, and on a one-person site
         it is the only true one: there is no network to hand a table on to.
         It is also what makes the page say *your own run* rather than
         *Run 3* under each level. */
      phase: 'solo',
      done: d.done,
      cleared: d.cleared
    };
  }

  function clear(body) {
    var d = load();
    var n = parseInt(body && body.level, 10);
    if (!(n >= 1 && n <= LEVELS)) {
      return { status: 400, data: progress() };
    }
    /* The same rule the server keeps: a table may be cleared if it is already
       cleared or it *is* the frontier. Without it, one line in the console
       finishes a run — which would not be cheating anybody but yourself, and
       is still not what the button means. */
    if (!d.cleared[n] && n !== d.frontier) {
      return { status: 409, data: progress() };
    }

    var first = !d.cleared[n];
    d.cleared[n] = 1;
    d.done = Object.keys(d.cleared).length;
    if (first && n === d.frontier) { d.frontier = Math.min(n + 1, LEVELS + 1); }

    var secs = parseInt(body.seconds, 10);
    var shots = parseInt(body.shots, 10);
    if (secs >= 1 && secs <= 24 * 60 * 60) {
      var had = d.best[n];
      /* Your record on a table is your fastest alignment of it, and the
         firings travel with the time rather than competing with it — the
         number beside a record is what that solve cost, not the fewest you
         have ever managed. */
      if (!had || secs < had.seconds) {
        d.best[n] = { seconds: secs,
                      shots: (shots >= 1 && shots <= 2000) ? shots : null };
      }
    }

    /* A hundred tables aligned rolls the run over, exactly as the shared
       campaign does — new run, same light. The cleared marks go; the records
       stay, because a fast alignment of table 12 is a fast alignment of
       table 12 whichever pass it happened on. */
    if (d.done >= LEVELS) {
      d.run += 1;
      d.cleared = {};
      d.done = 0;
      d.frontier = 1;
    }
    save(d);
    return { status: 200, data: progress() };
  }

  function board() {
    var d = load();
    var best = {}, mine = {};
    Object.keys(d.best).forEach(function (n) {
      var r = d.best[n];
      if (!r || !r.seconds) { return; }
      /* Both columns are you, because there is nobody else here. The table
         then reads as *your record, and your time* — which is the truth, and
         keeps the page the game already draws rather than needing a second
         one. */
      best[n] = { level: parseInt(n, 10), seconds: r.seconds, shots: r.shots,
                  name: WHO, slug: '', run: d.run };
      mine[n] = { seconds: r.seconds, shots: r.shots };
    });
    return { levels: LEVELS, best: best, mine: mine };
  }

  function reply(payload, status) {
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  var real = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input
      : (input && input.url) || '';
    var opts = init || {};
    var method = (opts.method || (input && input.method) || 'GET')
      .toUpperCase();

    if (url === BOARD) { return reply(board()); }

    if (url === API) {
      if (method === 'GET') { return reply(progress()); }
      if (method === 'POST') {
        var body = {};
        try { body = JSON.parse(opts.body || '{}'); } catch (e) { body = {}; }
        var res = clear(body);
        return reply(res.data, res.status);
      }
    }

    if (real) { return real(input, init); }
    return Promise.reject(new Error('fetch is not available'));
  };
}());
