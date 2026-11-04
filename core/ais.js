/* ── THE AXON INITIAL SEGMENT, COMPUTED FROM THE SKELETON ──────────────────────────  2026-11-04
   Søren: "Is there a way we could mark the axon initial segment automatically?"

   minnie65_skeletons_ais.ipynb reads every neuron's skeleton from the MICrONS skeleton service
   (whose nodes are labelled soma / axon / basal / apical dendrite) and follows the axon from where it
   leaves the cell to its first branch point or 40 µm, whichever comes first -- the rule behind the
   hand-marked AIS of Schneider-Mizell et al., eLife 2021. The result is static files:

     data/ais/<dataset>/meta.json          {format "ujump-ais-1", shards, res, materialization, rule}
     data/ais/<dataset>/ais_NN.json        {nucleusId: {r, p: [[x,y,z] voxels...], L µm, e ends-at,
                                            d µm from the soma, fd from-a-dendrite, pa axon proofread}}

   NN = nucleus id mod shards, so a cell costs one small file, fetched the first time it is shown.
   Nothing here until the files exist: no files, no row, no layer.

     UJ.ais.configure({ base: "data/ais/minnie65/" })
     UJ.ais.get(nucId)        -> Promise<entry|null>
     UJ.ais.cached(nucId)     -> entry | null | undefined (not read yet)
     UJ.ais.layer(nucId)      -> a Neuroglancer annotation layer, if the entry is already read
     UJ.ais.panel(nucId, el)  -> fills el (or adds a row to #nucpanel) once the entry is read */
(function () {
  window.UJ = window.UJ || {};
  var TRACED = {};          // nucleusId -> {key, state: "tracing"|"done"|"failed", entry, msg, n}
  var CFG = { base: "" }, META = null, METAP = null, SHARD = {}, SHARDP = {};

  function configure(cfg) {
    var b = String((cfg && cfg.base) || "");
    if (b && b.slice(-1) !== "/") b += "/";
    CFG.base = b; META = null; METAP = null; SHARD = {}; SHARDP = {};
  }
  function meta() {
    if (!CFG.base) return Promise.resolve(null);
    if (!METAP) METAP = fetch(CFG.base + "meta.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { META = (m && m.format === "ujump-ais-1") ? m : null; return META; })
      .catch(function () { return null; });
    return METAP;
  }
  function shardOf(nid) {
    var n = META && META.shards || 64;
    try { return Number(BigInt(String(nid)) % BigInt(n)); } catch (_e) { return Number(nid) % n; }
  }
  function pad(k) { return (k < 10 ? "0" : "") + k; }
  function get(nid) {
    nid = String(nid || "");
    if (!nid) return Promise.resolve(null);
    return meta().then(function (m) {
      if (!m) return null;
      var k = shardOf(nid);
      if (!SHARDP[k]) SHARDP[k] = fetch(CFG.base + "ais_" + pad(k) + ".json")
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (d) { SHARD[k] = d || {}; return SHARD[k]; });
      return SHARDP[k].then(function (d) { return d[nid] || null; });
    });
  }
  function cachedComputed(nid) {
    if (!META) return undefined;
    var k = shardOf(nid);
    if (!SHARD[k]) return undefined;
    return SHARD[k][String(nid)] || null;
  }
  /* the computed AIS if there is one, else one traced from a community mark (below) */
  function cached(nid) {
    var a = cachedComputed(nid);
    if (a) return a;
    var t = TRACED[String(nid)];
    if (t && t.entry) return t.entry;
    return a;
  }
  var COLOR = "#ff9f1a";
  function layer(nid) {
    var a = cached(nid);
    if (!a || !a.p || a.p.length < 2) return null;
    var anns = [];
    for (var i = 1; i < a.p.length; i++)
      anns.push({ type: "line", id: "ais_" + nid + "_" + i, pointA: a.p[i - 1], pointB: a.p[i] });
    anns.push({ type: "point", id: "ais_" + nid + "_start", point: a.p[0], description: "AIS start" });
    return { type: "annotation", source: "local://annotations", tab: "annotations", annotations: anns,
             annotationColor: COLOR, name: "Axon initial segment (" + (a.src === "mark" ? "traced from a community mark" : "computed") + ")" };
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function describe(a) {
    if (a.src === "mark") {
      var e2 = a.e === "branch" ? "ends at the axon's first branch point"
             : a.e === "40 µm" ? "unbranched past 40 µm, so cut there"
             : a.e === "wide" ? "stops where the mesh widens (a merge or another process)"
             : "ends where the axon's mesh ends";
      return "<b>" + (+a.L).toFixed(0) + " µm</b> from the axon start " + (a.n > 1 ? a.n + " people marked" : "someone marked")
        + " (traced from the cell's mesh); " + e2 + ".";
    }
    var ends = a.e === "branch" ? "ends at the axon's first branch point"
             : a.e === "tip" ? "ends where the axon's skeleton ends"
             : "unbranched past " + ((META && META.maxUm) || 40) + " µm, so cut there";
    var from = a.fd ? "leaves a <b>dendrite</b> " + (+a.d).toFixed(0) + " µm from the soma"
                    : "leaves the soma";
    return "<b>" + (+a.L).toFixed(0) + " µm</b>, " + from + "; " + ends + "." + (a.pa ? "" : " The axon is not proofread, so treat it as a guide.");
  }

  /* ── AN AXON START MARKED BY HAND, AND THE AIS TRACED FROM IT ─────────────────────────────  2026-11-04
     Søren: "For these neurons without an AIS skeleton. Could we mark a coordinate in the beginning of the Axon
     and then the AIS could be marked automatically based on that?"

     The mark is an ordinary organelle report of kind "axon_start" (core/ontology.js), logged with "Log one →".
     loadCommunityReports hands this cell's reports to marks(); when the cell has no computed AIS, the marks
     are pooled (the largest group within 5 µm of each other; the earliest group on a tie) and the AIS is
     traced from their mean on the cell's own mesh (UJ.mesh.fetchCombinedMesh -- public, no sign-in):

       1. vertices within 50 µm of the mark; duplicate vertices welded, and the open edges where mesh
          chunks meet joined to any other open edge within 0.2 µm, so the surface is one piece;
       2. distance ALONG THE SURFACE from the mark (the start is every vertex within 0.6 µm of the nearest
          one: the axon's whole cross-section, since a mark sits inside the axon, not on its membrane);
       3. 2 µm bands of that distance, each split into its connected pieces. In the first band the piece
          farthest from the nucleus is the axon (the other one is the way back into the soma or dendrite);
          after that, the axon is the piece of the next band touching the axon's piece in this one:
            two such pieces (each ≥ 20 % of the axon's) = the first branch point: stop;
            none = the mesh ends: stop;
            a piece more than 4 µm across = it ran into something wide (a merge): stop;
            40 µm = the same cap as the computed AIS: stop.
       4. the AIS line is the mark followed by the centre of the axon's piece in every band.            */
  function res() { return (window.UJ.cfg && UJ.cfg.res) || [4, 4, 40]; }
  function v2um(v) { var R = res(); return [v[0] * R[0] / 1000, v[1] * R[1] / 1000, v[2] * R[2] / 1000]; }
  function um2v(u) { var R = res(); return [Math.round(u[0] * 1000 / R[0]), Math.round(u[1] * 1000 / R[1]), Math.round(u[2] * 1000 / R[2])]; }
  function parseVox(s) { var m = String(s || "").match(/-?\d+(\.\d+)?/g); return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null; }
  function poolMarks(pts) {
    var best = null;
    for (var i = 0; i < pts.length; i++) {
      var g = [], a = v2um(pts[i]);
      for (var j = 0; j < pts.length; j++) { var b = v2um(pts[j]); if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 5) g.push(pts[j]); }
      if (!best || g.length > best.length) best = g;
    }
    var m = [0, 0, 0]; best.forEach(function (p) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; });
    return { at: [m[0] / best.length, m[1] / best.length, m[2] / best.length], n: best.length };
  }
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) { var k = this.k, v = this.v, i = k.length; k.push(key); v.push(val);
    while (i > 0) { var p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; };
  Heap.prototype.pop = function () { var k = this.k, v = this.v, top = v[0], tk = k[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) { var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i, mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) { m = r; mk = k[r]; } if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; } k[i] = lk; v[i] = lv; }
    this.lastKey = tk; return top; };
  /* positions in µm, indices; mark and nucleus centre in µm. Returns {pts (µm), L, e} or {fail}. */
  function traceOnMesh(P, I, mark, nuc, opt) {
    opt = opt || {};
    var R = opt.R || 50, MAXL = opt.maxUm || 40, BAND = opt.band || 2;
    // 1. crop + weld
    var nV = P.length / 3, keep = new Int32Array(nV).fill(-1), map = new Map(), pos = [], q = 0.02;
    for (var v = 0; v < nV; v++) {
      var x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      if (Math.abs(x - mark[0]) > R || Math.abs(y - mark[1]) > R || Math.abs(z - mark[2]) > R) continue;
      if (Math.hypot(x - mark[0], y - mark[1], z - mark[2]) > R) continue;
      var key = Math.round(x / q) + "," + Math.round(y / q) + "," + Math.round(z / q), id = map.get(key);
      if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(x, y, z); }
      keep[v] = id;
    }
    var n = pos.length / 3;
    if (n < 20) return { fail: "the cell's mesh has nothing near the mark" };
    var adj = []; for (var i = 0; i < n; i++) adj.push([]);
    var ecount = new Map();
    function edge(a, b) { if (a === b) return; var k = a < b ? a * n + b : b * n + a; var c = ecount.get(k); if (c === undefined) { ecount.set(k, 1); adj[a].push(b); adj[b].push(a); } else ecount.set(k, c + 1); }
    for (var t = 0; t < I.length; t += 3) {
      var a = keep[I[t]], b = keep[I[t + 1]], c = keep[I[t + 2]];
      if (a < 0 || b < 0 || c < 0) continue;
      edge(a, b); edge(b, c); edge(c, a);
    }
    // open edges (one triangle) where chunks meet: join their vertices to other open-edge vertices within 0.2 µm
    var open = new Uint8Array(n);
    ecount.forEach(function (cnt, k) { if (cnt === 1) { open[Math.floor(k / n)] = 1; open[k % n] = 1; } });
    var G = 0.2, grid = new Map();
    for (i = 0; i < n; i++) if (open[i]) { var gk = Math.floor(pos[i * 3] / G) + "," + Math.floor(pos[i * 3 + 1] / G) + "," + Math.floor(pos[i * 3 + 2] / G); var l = grid.get(gk); if (!l) grid.set(gk, l = []); l.push(i); }
    for (i = 0; i < n; i++) if (open[i]) {
      var gx = Math.floor(pos[i * 3] / G), gy = Math.floor(pos[i * 3 + 1] / G), gz = Math.floor(pos[i * 3 + 2] / G);
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) {
        var L2 = grid.get((gx + dx) + "," + (gy + dy) + "," + (gz + dz)); if (!L2) continue;
        for (var u = 0; u < L2.length; u++) { var j = L2[u]; if (j <= i) continue;
          if (Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]) <= G && adj[i].indexOf(j) < 0) { adj[i].push(j); adj[j].push(i); } } }
    }
    // 2. surface distance from the mark's cross-section
    var dmin = 1e9; for (i = 0; i < n; i++) dmin = Math.min(dmin, Math.hypot(pos[i * 3] - mark[0], pos[i * 3 + 1] - mark[1], pos[i * 3 + 2] - mark[2]));
    if (dmin > 3) return { fail: "the mark is " + dmin.toFixed(1) + " µm from this cell's surface -- it should be inside the axon" };
    var D = new Float64Array(n).fill(Infinity), h = new Heap();
    for (i = 0; i < n; i++) if (Math.hypot(pos[i * 3] - mark[0], pos[i * 3 + 1] - mark[1], pos[i * 3 + 2] - mark[2]) <= dmin + 0.6) { D[i] = 0; h.push(0, i); }
    var LIM = MAXL + 2 * BAND;
    while (h.k.length) { var w = h.pop(), dw = h.lastKey; if (dw > D[w]) continue;
      var aw = adj[w]; for (u = 0; u < aw.length; u++) { var z2 = aw[u], nd = dw + Math.hypot(pos[w * 3] - pos[z2 * 3], pos[w * 3 + 1] - pos[z2 * 3 + 1], pos[w * 3 + 2] - pos[z2 * 3 + 2]);
        if (nd < D[z2] && nd <= LIM) { D[z2] = nd; h.push(nd, z2); } } }
    // 3. bands and their pieces
    var band = new Int32Array(n).fill(-1); for (i = 0; i < n; i++) if (D[i] <= LIM) band[i] = Math.floor(D[i] / BAND);
    var comp = new Int32Array(n).fill(-1), comps = [];
    for (i = 0; i < n; i++) { if (band[i] < 0 || comp[i] >= 0) continue;
      var id2 = comps.length, st = [i], mem = []; comp[i] = id2;
      while (st.length) { var x2 = st.pop(); mem.push(x2); var ax = adj[x2]; for (u = 0; u < ax.length; u++) { var y2 = ax[u]; if (comp[y2] < 0 && band[y2] === band[i]) { comp[y2] = id2; st.push(y2); } } }
      var cx = 0, cy = 0, cz = 0; mem.forEach(function (m) { cx += pos[m * 3]; cy += pos[m * 3 + 1]; cz += pos[m * 3 + 2]; });
      cx /= mem.length; cy /= mem.length; cz /= mem.length;
      var ext = 0; mem.forEach(function (m) { ext = Math.max(ext, Math.hypot(pos[m * 3] - cx, pos[m * 3 + 1] - cy, pos[m * 3 + 2] - cz)); });
      comps.push({ band: band[i], mem: mem, c: [cx, cy, cz], ext: ext });
    }
    function nextOf(ci) {        // pieces of the next band touching piece ci
      var out = {}, b = comps[ci].band + 1;
      comps[ci].mem.forEach(function (m) { var am = adj[m]; for (var t2 = 0; t2 < am.length; t2++) { var o = am[t2]; if (band[o] === b) out[comp[o]] = 1; } });
      return Object.keys(out).map(Number);
    }
    // the first band beyond the start: the piece farthest from the nucleus
    var start = comps.filter(function (c) { return c.band === 0; });
    var cand = {}; start.forEach(function (c) { nextOf(comps.indexOf(c)).forEach(function (k) { cand[k] = 1; }); });
    cand = Object.keys(cand).map(Number).filter(function (k) { return comps[k].mem.length >= 4; });
    if (!cand.length) return { fail: "no axon leaves the mark on the mesh" };
    var dn = function (k) { return nuc ? Math.hypot(comps[k].c[0] - nuc[0], comps[k].c[1] - nuc[1], comps[k].c[2] - nuc[2]) : -comps[k].ext; };
    cand.sort(function (a2, b2) { return dn(b2) - dn(a2); });
    var cur = cand[0], pts = [mark.slice()], e = "40 µm";
    for (;;) {
      if (comps[cur].ext > 4) { e = "wide"; break; }
      pts.push(comps[cur].c);
      if ((comps[cur].band + 1) * BAND >= MAXL) { e = "40 µm"; break; }
      var nx = nextOf(cur), big = nx.filter(function (k) { return comps[k].mem.length >= Math.max(4, 0.2 * comps[cur].mem.length); });
      if (!big.length) { e = "tip"; break; }
      if (big.length > 1) { e = "branch"; break; }
      cur = big[0];
    }
    var Ls = 0; for (i = 1; i < pts.length; i++) Ls += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    if (pts.length < 2) return { fail: "the mesh widens right at the mark -- is it on the axon?" };
    return { pts: pts, L: Ls, e: e };
  }
  function refreshRow() { if (window.UJ.skel && UJ.skel.refresh) UJ.skel.refresh(); }
  /* this cell's organelle reports (core/panel.js, after every fetch of them) */
  function marks(nid, anns) {
    nid = String(nid || ""); if (!nid) return;
    var pts = (anns || []).filter(function (a) { return a && a.kind === "axon_start"; }).map(function (a) { return parseVox(a.pointA); }).filter(Boolean);
    if (!pts.length) { if (TRACED[nid]) { delete TRACED[nid]; refreshRow(); } return; }
    Promise.resolve(get(nid)).then(function (comp) {
      if (comp) return;                                               // the computed AIS stands
      var pool = poolMarks(pts), key = pool.at.map(function (x) { return x.toFixed(0); }).join(",") + "/" + pool.n;
      if (TRACED[nid] && TRACED[nid].key === key) return;             // already traced (or tracing) from this
      var root = (typeof CUR_ROOT !== "undefined" && CUR_ROOT) ? String(CUR_ROOT) : "";
      var T = TRACED[nid] = { key: key, state: "tracing", n: pool.n };
      refreshRow();
      if (!root || !window.UJ.mesh || !UJ.mesh.fetchCombinedMesh) { T.state = "failed"; T.msg = "no root id / mesh for this cell"; refreshRow(); return; }
      var nc = window.CUR_NUC_CENTER_VOX ? v2um(window.CUR_NUC_CENTER_VOX) : null;
      UJ.mesh.fetchCombinedMesh(root).then(function (m) {
        if (TRACED[nid] !== T) return;
        var r = traceOnMesh(m.positions, m.indices, v2um(pool.at), nc);
        if (r.fail) { T.state = "failed"; T.msg = r.fail; }
        else { T.state = "done"; T.entry = { r: root, p: r.pts.map(um2v), L: +r.L.toFixed(1), e: r.e, src: "mark", n: pool.n, pa: 0, fd: 0 }; }
        refreshRow();
      }, function (err) { if (TRACED[nid] !== T) return; T.state = "failed"; T.msg = (err && err.message) || "the mesh could not be read"; refreshRow(); });
    });
  }
  /* what the skeleton row says while a cell has a mark but no traced AIS yet */
  function status(nid) {
    var t = TRACED[String(nid || "")]; if (!t || t.state === "done") return "";
    return t.state === "tracing" ? "Axon start marked — tracing the axon initial segment from the cell’s mesh…"
      : "Axon start marked, but the AIS could not be traced: " + esc(t.msg || "") + ".";
  }
  /* The cell panel has ONE Neuroglancer link for the cell's skeleton (Søren, 2026-11-04: "I guess we don't need
     to have 2 links to the same neuroglancer ... drop the Axon initial segment line and mark it on the skeleton
     line"). So the AIS has no row of its own: once its entry is read, the skeleton row (core/skel.js) is drawn
     again and says the AIS is marked; that link's Neuroglancer state carries the AIS layer (buildState). */
  function panel(nid) {
    nid = String(nid || "");
    var old = document.getElementById("aisRow"); if (old) old.remove();
    return get(nid).then(function (a) {
      var cur = (typeof CUR_NUCID !== "undefined" && CUR_NUCID) ? String(CUR_NUCID) : nid;
      if (cur !== nid) return;                                       // the reader has moved on
      if (window.UJ.skel && UJ.skel.refresh) UJ.skel.refresh();
      return a;
    });
  }
  /* "View →": Neuroglancer at the AIS's start; buildState adds the AIS layer for the cell on screen. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".aisview");
    if (!b || typeof neuroglancerLinkForPos !== "function") return;
    e.preventDefault();
    var url = neuroglancerLinkForPos([+b.dataset.x, +b.dataset.y, +b.dataset.z]);
    if (url) window.open(url, "_blank", "noopener");
  });
  window.UJ.ais = { configure: configure, get: get, cached: cached, layer: layer, panel: panel, describe: describe, COLOR: COLOR, marks: marks, status: status, _trace: traceOnMesh, _meta: function () { return META; } };
})();
