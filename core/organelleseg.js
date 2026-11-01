/* core/organelleseg.js — click an organelle, get its outline.                    2026-10-31

   Søren: *"It looks like we are getting pretty good at recognizing lysosomes and mitochondria. Could
   we add some machine learning for the organelle tracing and start with those 2?"* — chosen: click
   -> outline on this section, then Follow carries it through the next ones; mitochondria learned
   from the MICrONS Layer 2/3 ("pinky") mitochondria segmentation plus mitochondria traced here.

   WHAT RUNS WHERE — as core/organelleml.js: trained in Colab (organelle_outline_train.ipynb), two
   static files in models/organelles/<dataset>/ (seg.onnx, seg.json), run in the reader's browser by
   onnxruntime-web. Nothing leaves the page.

   THE MODEL sees CROP x CROP voxels (256 at 8 nm = 2 µm) of one section, with the clicked spot in the
   middle pixel, each crop scaled by its own mean and spread (seg.json "norm": "crop") -- the notebook
   does the same, which is also why a dark cell needs no special mode here. It answers, per voxel, "is
   this part of the organelle under the middle?" The part connected to the middle (or the nearest
   piece within 5 px of it) is kept, its outer boundary traced and thinned, and handed to the pad as an
   ordinary contour in tool voxels: points you can drag, delete and add to, exactly as if drawn.

   FOLLOW: from the centre of the last outline, the next section's outline, and the next -- stopping
   where the organelle ends: no outline at the centre, an area less than a third or more than three
   times the last one, or a centre that jumps further than the organelle is wide.

   HOST CONTRACT
     UJ.organelleseg.configure({ base: "models/organelles/minnie65/" })   // probes seg.json
     UJ.organelleseg.available() / whenAvailable()
     UJ.organelleseg.outline([x, y], z)          -> Promise<{ points, areaNm2, score } | null>
     UJ.organelleseg.follow(points, z, dir, n, step, onEach) -> Promise<[{ z, points }]>
   Tested 2026-10-31 in Chromium with onnxruntime-web 1.19.2 (WASM) on a stand-in model. */
var UJ = UJ || {};
UJ.organelleseg = (function(){
  "use strict";

  var ORT_VER = "1.19.2";
  var ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@" + ORT_VER + "/dist/";
  var ORT_JS = ORT_BASE + "ort.webgpu.min.js";
  var CFG = { base: "", ok: false, probe: null, readPlane: null };
  var META = null, SESSION = null, LOADING = null, EP = "";
  var QUEUE = Promise.resolve();

  function configure(cfg){
    cfg = cfg || {};
    var b = String(cfg.base || "");
    if (b && b.slice(-1) !== "/") b += "/";
    if (b !== CFG.base){ META = null; SESSION = null; LOADING = null; }
    CFG.base = b;
    if (cfg.ortBase){ ORT_BASE = cfg.ortBase; ORT_JS = cfg.ortJs || (ORT_BASE + "ort.webgpu.min.js"); }
    if (cfg.readPlane) CFG.readPlane = cfg.readPlane;      // for a check with no imagery behind it
    CFG.ok = false;
    CFG.probe = !b ? Promise.resolve(false)
      : fetch(b + "seg.json", { method: "HEAD", cache: "no-cache" })
          .then(function(r){ CFG.ok = !!r.ok; return CFG.ok; })
          .catch(function(){ CFG.ok = false; return false; });
    return CFG.probe;
  }
  function available(){ return !!(CFG.base && CFG.ok); }
  function whenAvailable(){ return CFG.probe || Promise.resolve(false); }

  function loadScript(src){
    return new Promise(function(res, rej){
      if (window.ort){ res(); return; }
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function(){ res(); };
      s.onerror = function(){ rej(new Error("could not load onnxruntime-web from " + src)); };
      document.head.appendChild(s);
    });
  }
  function load(){
    if (SESSION) return Promise.resolve(SESSION);
    if (LOADING) return LOADING;
    LOADING = (async function(){
      var r = await fetch(CFG.base + "seg.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("no outline model has been trained for this dataset yet");
      var m = await r.json();
      if (!m || m.format !== "ujump-organelle-outline-1") throw new Error("seg.json is not an outline model this page understands");
      await loadScript(ORT_JS);
      var ort = window.ort;
      try { if (!ort.env.wasm.wasmPaths) ort.env.wasm.wasmPaths = ORT_BASE; } catch (_e){}
      var sess = null, err = null, eps = navigator.gpu ? [["webgpu"], ["wasm"]] : [["wasm"]];
      for (var i = 0; i < eps.length && !sess; i++){
        try { sess = await ort.InferenceSession.create(CFG.base + (m.onnx || "seg.onnx"), { executionProviders: eps[i] }); EP = eps[i][0]; }
        catch (e){ err = e; }
      }
      if (!sess) throw new Error("the outline model could not start: " + String(err && err.message || err));
      META = m; SESSION = sess;
      return sess;
    })();
    LOADING.catch(function(){ LOADING = null; });
    return LOADING;
  }

  /* The crop, read through the page's own EM reader at the model's voxel size. */
  async function mipFor(nm){
    var first = await UJ.emtiles.scaleAt(0, false);
    for (var i = 0; i < first.count; i++){
      var s = await UJ.emtiles.scaleAt(i, false);
      if (Math.abs(s.scale.resolution[0] - nm) < 0.01) return i;
    }
    return -1;
  }
  async function readPlane(xy, z, m){
    if (CFG.readPlane) return CFG.readPlane(xy, z, m);
    var mip = await mipFor(m.nm);
    if (mip < 0) throw new Error("this volume has no " + m.nm + " nm level for the outline model");
    var cv = document.createElement("canvas");
    var v = await UJ.emtiles.drawSection(cv, { centre: [Math.round(xy[0]), Math.round(xy[1]), z], mip: mip, zoom: 1,
                                               w: m.crop, h: m.crop, lo: 0, hi: 255 });
    return { raw: v.raw, seen: v.seen, w: v.vw, h: v.vh, x0: v.x0, y0: v.y0, res: v.resNm };
  }
  function toolRes(){
    try { return UJ.emtiles.config().res; } catch (_e){ return [4, 4, 40]; }
  }

  /* ── MASK -> CONTOUR ─────────────────────────────────────────────────────────────────────────── */
  /* The piece connected to the middle pixel, or to the first predicted pixel within 5 px of it in
     reading order -- the notebook's clicked_component(), the same rule. */
  function clicked(prob, w, h, thr){
    var c = (h >> 1) * w + (w >> 1), seed = -1;
    if (prob[c] >= thr) seed = c;
    else {
      var cy = h >> 1, cx = w >> 1;
      for (var y = cy - 5; y <= cy + 5 && seed < 0; y++) for (var x = cx - 5; x <= cx + 5; x++){
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (prob[y * w + x] >= thr){ seed = y * w + x; break; }
      }
    }
    if (seed < 0) return null;
    var m = new Uint8Array(w * h), st = [seed], n = 0; m[seed] = 1;
    while (st.length){
      var q = st.pop(); n++;
      var qy = (q / w) | 0, qx = q - qy * w;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++){
        if (!dx && !dy) continue;
        var y2 = qy + dy, x2 = qx + dx;
        if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h) continue;
        var q2 = y2 * w + x2;
        if (!m[q2] && prob[q2] >= thr){ m[q2] = 1; st.push(q2); }
      }
    }
    return { mask: m, n: n };
  }
  /* The outer boundary, Moore-neighbour tracing over pixel centres, clockwise in image coordinates. */
  var DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
  function trace(m, w, h){
    var s = -1;
    for (var i = 0; i < m.length; i++) if (m[i]){ s = i; break; }
    if (s < 0) return [];
    var sx = s % w, sy = (s / w) | 0, x = sx, y = sy, d = 0, pts = [[x, y]];
    var at = function(px, py){ return px >= 0 && py >= 0 && px < w && py < h && m[py * w + px]; };
    for (var steps = 0; steps < 4 * w * h; steps++){
      var found = false, start = (d + 6) % 8;
      for (var k = 0; k < 8; k++){
        var nd = (start + k) % 8, nx = x + DX[nd], ny = y + DY[nd];
        if (at(nx, ny)){ x = nx; y = ny; d = nd; found = true; break; }
      }
      if (!found || (x === sx && y === sy)) break;
      pts.push([x, y]);
    }
    return pts;
  }
  function rdp(pts, eps){
    if (pts.length < 4) return pts.slice();
    var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    var st = [[0, pts.length - 1]];
    while (st.length){
      var r = st.pop(), a = r[0], b = r[1], A = pts[a], B = pts[b], best = -1, bi = -1;
      var vx = B[0] - A[0], vy = B[1] - A[1], L = Math.hypot(vx, vy) || 1;
      for (var i = a + 1; i < b; i++){
        var dd = Math.abs((pts[i][0] - A[0]) * vy - (pts[i][1] - A[1]) * vx) / L;
        if (dd > best){ best = dd; bi = i; }
      }
      if (best > eps){ keep[bi] = 1; st.push([a, bi], [bi, b]); }
    }
    return pts.filter(function(_p, i){ return keep[i]; });
  }
  /* ── FEWER POINTS (2026-11-01, Søren: "the AI makes many more points for the tracing than I do when
     I trace. Dropping redundant points almost does nothing. Can we increase the amount of points
     dropped?"). The traced edge is a pixel staircase, and RDP at 0.7 px kept every step: ~100 points
     round a 400 nm lysosome. Now the staircase is smoothed first (a running mean over 5 points, round
     the ring), then simplified so no point of the edge moves more than SIMPLIFY_NM (10 nm, or
     seg.json simplifyNm) -- about a membrane's width, and coarser than the 8 nm pixels the model saw. */
  var SIMPLIFY_NM = 10;
  function simplifyRing(pts, unitNm){
    var n = pts.length;
    if (n < 8) return pts.slice();
    var sm = [];
    for (var i = 0; i < n; i++){
      var sx = 0, sy = 0;
      for (var k = -2; k <= 2; k++){ var q = pts[(i + k + n) % n]; sx += q[0]; sy += q[1]; }
      sm.push([sx / 5, sy / 5]);
    }
    var nm = (META && META.simplifyNm) || SIMPLIFY_NM;
    var out = rdp(sm, Math.max(0.7, nm / (unitNm || 1)));
    return out.length >= 4 ? out : rdp(pts, 0.7);
  }
  function area(pts){
    var s = 0;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    return Math.abs(s) / 2;
  }
  function centroid(pts){
    var sx = 0, sy = 0;
    pts.forEach(function(p){ sx += p[0]; sy += p[1]; });
    return [sx / pts.length, sy / pts.length];
  }

  /* ── ONE MODEL AT A TIME, AND A CRASH IS RECOVERED (2026-11-01) ───────────────────────────────
     Søren saw "memory access out of bounds" after a long tracing session. The suggestion model and the
     outline model share onnxruntime's one WebAssembly engine, and each had its own queue, so they
     could run at the same time. Now every run takes its turn on one page-wide chain
     (window.__ujOrtTurn), and a run that fails with an engine error drops the session, starts it
     again and tries once more; failing again, it says to reload (the tracing draft survives that). */
  function ortTurn(fn){
    var prev = window.__ujOrtTurn || Promise.resolve();
    var p = prev.then(fn, fn);
    window.__ujOrtTurn = p.catch(function(){});
    return p;
  }
  function engineError(e){ return /memory|out of bounds|abort|RuntimeError|wasm/i.test(String(e && e.message || e)); }
  async function runSafe(feeds, reload){
    try { return await ortTurn(function(){ return SESSION.run(feeds); }); }
    catch (e){
      if (!engineError(e)) throw e;
      try { if (SESSION && SESSION.release) await SESSION.release(); } catch (_e){}
      SESSION = null; LOADING = null;
      await reload();
      try { return await ortTurn(function(){ return SESSION.run(feeds); }); }
      catch (e2){ throw new Error("The AI engine in this browser tab ran out of memory (" + String(e2 && e2.message || e2)
        + "). Reload the page \u2014 your tracing is kept as a draft \u2014 and carry on."); }
    }
  }
  /* ── ONE OUTLINE ──────────────────────────────────────────────────────────────────────────── */
  function outline(xy, z){
    var p = QUEUE.then(async function(){
      await load();
      var m = META, pl = await readPlane(xy, z, m);
      var n = pl.w * pl.h, sum = 0, sq = 0, cnt = 0;
      for (var i = 0; i < n; i++) if (pl.seen[i]){ sum += pl.raw[i]; sq += pl.raw[i] * pl.raw[i]; cnt++; }
      if (cnt < n * 0.5) return null;                       // mostly outside the imagery
      var mean = sum / cnt, sd = Math.sqrt(Math.max(1e-6, sq / cnt - mean * mean));
      var d = new Float32Array(m.crop * m.crop);
      for (var y = 0; y < m.crop; y++) for (var x = 0; x < m.crop; x++){
        var o = y * pl.w + x;
        d[y * m.crop + x] = (y < pl.h && x < pl.w && pl.seen[o]) ? (pl.raw[o] - mean) / (sd + 1e-6) : 0;
      }
      var feeds = {}; feeds[SESSION.inputNames[0]] = new window.ort.Tensor("float32", d, [1, 1, m.crop, m.crop]);
      var out = (await runSafe(feeds, function(){ return load(); }))[SESSION.outputNames[0]].data;
      var prob = new Float32Array(out.length);
      for (var k = 0; k < out.length; k++) prob[k] = 1 / (1 + Math.exp(-out[k]));
      var comp = clicked(prob, m.crop, m.crop, m.threshold || 0.5);
      if (!comp || comp.n * pl.res[0] * pl.res[1] < 1e4) return null;   // under (100 nm)^2: noise, not an organelle
      var px = simplifyRing(trace(comp.mask, m.crop, m.crop), pl.res[0]);
      /* A sliver -- a membrane line, a streak -- traces to a polygon with almost no inside. */
      if (px.length < 4 || area(px) < 0.3 * comp.n) return null;
      var tr = toolRes(), sc = 0;
      for (var q = 0; q < prob.length; q++) if (comp.mask[q]) sc += prob[q];
      /* ── IS AN IMAGING ARTIFACT ACROSS IT ───────────────────────────────  2026-11-01
         Søren: "the same system as a missing slice should apply if there is an imaging artefact
         that overlaps with the organelle", and then: "The knife cutting is often much longer,
         often relatively straight and often consistently dark compared to organelles, could this
         be used to distinguish it from e.g. myelin or lysosome inclusions?"
         Two tests, over the outline's box and 100 nm round it:
           - unread voxels (a missing chunk) passing 3% of the box: always an artifact;
           - a STREAK through the box: a connected run of near-black (below seg.json artifactDark,
             15) or near-white (above artifactBright, 240) voxels anywhere in the crop that is long
             (artifactLineNm, 600 nm), straight and thin (length/width >= artifactElong, 6).
             Length and width come from the run's spread along and across its main axis (a uniform
             bar of length L has variance L^2/12). A lysosome inclusion is short; myelin curves
             round its axon, so its spread across is large -- neither passes. */
      var bx0 = m.crop, by0 = m.crop, bx1 = -1, by1 = -1;
      for (var q2 = 0; q2 < comp.mask.length; q2++) if (comp.mask[q2]){
        var qx = q2 % m.crop, qy = (q2 / m.crop) | 0;
        if (qx < bx0) bx0 = qx; if (qx > bx1) bx1 = qx; if (qy < by0) by0 = qy; if (qy > by1) by1 = qy;
      }
      var mg = Math.round(100 / pl.res[0]), dark = m.artifactDark == null ? 15 : m.artifactDark,
          bright = m.artifactBright == null ? 240 : m.artifactBright,
          lineNm = m.artifactLineNm == null ? 600 : m.artifactLineNm,
          elong = m.artifactElong == null ? 6 : m.artifactElong;
      var X0 = Math.max(0, bx0 - mg), X1 = Math.min(m.crop - 1, bx1 + mg), Y0 = Math.max(0, by0 - mg), Y1 = Math.min(m.crop - 1, by1 + mg);
      var unseen = 0, all = 0;
      for (var yy = Y0; yy <= Y1; yy++) for (var xx = X0; xx <= X1; xx++){
        all++;
        if (yy >= pl.h || xx >= pl.w || !pl.seen[yy * pl.w + xx]) unseen++;
      }
      var C = m.crop, odd = new Uint8Array(C * C), lab = new Uint8Array(C * C), streak = null;
      for (var yq = 0; yq < Math.min(C, pl.h); yq++) for (var xq = 0; xq < Math.min(C, pl.w); xq++){
        var o3 = yq * pl.w + xq;
        if (pl.seen[o3] && (pl.raw[o3] < dark || pl.raw[o3] > bright)) odd[yq * C + xq] = 1;
      }
      for (var s0 = 0; s0 < C * C && !streak; s0++){
        if (!odd[s0] || lab[s0]) continue;
        var st = [s0], pts = [], hits = false; lab[s0] = 1;
        while (st.length){
          var q3 = st.pop(), y3 = (q3 / C) | 0, x3 = q3 - y3 * C; pts.push(x3, y3);
          if (x3 >= X0 && x3 <= X1 && y3 >= Y0 && y3 <= Y1) hits = true;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++){
            var y4 = y3 + dy, x4 = x3 + dx;
            if (x4 < 0 || y4 < 0 || x4 >= C || y4 >= C) continue;
            var q4 = y4 * C + x4;
            if (odd[q4] && !lab[q4]){ lab[q4] = 1; st.push(q4); }
          }
        }
        var n3 = pts.length / 2;
        if (!hits || n3 * pl.res[0] < lineNm) continue;       // even a 1-voxel-wide line that long has this many
        var mx = 0, my = 0; for (var i3 = 0; i3 < pts.length; i3 += 2){ mx += pts[i3]; my += pts[i3 + 1]; }
        mx /= n3; my /= n3;
        var sxx = 0, syy = 0, sxy = 0;
        for (var i4 = 0; i4 < pts.length; i4 += 2){ var ux = pts[i4] - mx, uy = pts[i4 + 1] - my; sxx += ux * ux; syy += uy * uy; sxy += ux * uy; }
        sxx /= n3; syy /= n3; sxy /= n3;
        var tr2 = sxx + syy, dt = Math.sqrt(Math.max(0, (sxx - syy) * (sxx - syy) / 4 + sxy * sxy));
        var len = Math.sqrt(12 * (tr2 / 2 + dt)), wid = Math.sqrt(12 * Math.max(0, tr2 / 2 - dt)) || 1;
        if (len * pl.res[0] >= lineNm && len / Math.max(1, wid) >= elong)
          streak = { lengthNm: Math.round(len * pl.res[0]), widthNm: Math.round(Math.max(1, wid) * pl.res[0]) };
      }
      return {
        points: px.map(function(a){ return [(pl.x0 + a[0] + 0.5) * pl.res[0] / tr[0], (pl.y0 + a[1] + 0.5) * pl.res[1] / tr[1]]; }),
        areaNm2: comp.n * pl.res[0] * pl.res[1], score: sc / comp.n, ep: EP,
        artifact: all ? unseen / all : 0,
        artifactLine: !!streak, streak: streak
      };
    });
    QUEUE = p.catch(function(){});
    return p;
  }

  /* ── POLYGON TOOLS (2026-11-01) ───────────────────────────────────────────────────────────── */
  /* Is a point inside a polygon (even-odd)? */
  function inside(pt, poly){
    var x = pt[0], y = pt[1], c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++){
      var a = poly[i], b = poly[j];
      if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
    }
    return c;
  }
  /* UNION of polygons: drawn onto one grid (scanline, even-odd per polygon, OR across them) at
     `cell` tool voxels per pixel, then every connected piece traced back to a ring. Two outlines
     that touch become one; two that do not stay two. Holes are not kept.
     SUBTRACT (2026-11-01, Søren: "The backspace button should be combined with the freehand drawing
     to subtract from the tracing when you draw"): the same grid, with every `minus` polygon cleared
     from it before the pieces are traced. A cut straight through leaves two pieces. */
  function union(polys, cell, minus){
    cell = cell || 2;
    minus = minus || [];
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    polys.forEach(function(P){ P.forEach(function(p){
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
    x0 -= 3 * cell; y0 -= 3 * cell;
    var W = Math.ceil((x1 - x0) / cell) + 4, H = Math.ceil((y1 - y0) / cell) + 4;
    var m = new Uint8Array(W * H);
    var paint = function(P, v){
      var row = new Uint8Array(W);
      for (var r = 0; r < H; r++){
        var y = y0 + (r + 0.5) * cell, xs = [];
        for (var i = 0, j = P.length - 1; i < P.length; j = i++){
          var a = P[i], b = P[j];
          if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort(function(u, v){ return u - v; });
        row.fill(0);
        for (var k = 0; k + 1 < xs.length; k += 2){
          var c0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5)), c1 = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
          for (var c = c0; c <= c1; c++) row[c] = 1;
        }
        for (var c2 = 0; c2 < W; c2++) if (row[c2]) m[r * W + c2] = v;
      }
    };
    polys.forEach(function(P){ paint(P, 1); });
    if (minus.length){
      /* what is cut away is cut with a pixel to spare, so the edge left behind does not sit on it */
      var keep = m; m = new Uint8Array(W * H);
      minus.forEach(function(P){ paint(P, 1); });
      var cut = m; m = keep;
      for (var r2 = 0; r2 < H; r2++) for (var c3 = 0; c3 < W; c3++){
        if (!m[r2 * W + c3]) continue;
        for (var dy2 = -1; dy2 <= 1 && m[r2 * W + c3]; dy2++) for (var dx2 = -1; dx2 <= 1; dx2++){
          var yy2 = r2 + dy2, xx2 = c3 + dx2;
          if (yy2 >= 0 && xx2 >= 0 && yy2 < H && xx2 < W && cut[yy2 * W + xx2]){ m[r2 * W + c3] = 0; break; }
        }
      }
    }
    /* each piece */
    var seen = new Uint8Array(W * H), out = [];
    for (var s0 = 0; s0 < W * H; s0++){
      if (!m[s0] || seen[s0]) continue;
      var comp = new Uint8Array(W * H), st = [s0], n = 0; seen[s0] = 1;
      while (st.length){
        var q = st.pop(), qy = (q / W) | 0, qx = q - qy * W; comp[q] = 1; n++;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++){
          var y2 = qy + dy, x2 = qx + dx;
          if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
          var q2 = y2 * W + x2;
          if (m[q2] && !seen[q2]){ seen[q2] = 1; st.push(q2); }
        }
      }
      if (n < 4) continue;
      var ring = simplifyRing(trace(comp, W, H), cell * toolRes()[0]).map(function(p){ return [x0 + (p[0] + 0.5) * cell, y0 + (p[1] + 0.5) * cell]; });
      if (ring.length >= 3) out.push(ring);
    }
    return out;
  }
  /* A ring between two rings: both resampled to N points by length, started at their rightmost
     point, run the same way round, and averaged point by point -- the section a missing slice
     would most likely have shown. */
  function resample(P, N){
    var L = [0];
    for (var i = 1; i <= P.length; i++){ var a = P[i - 1], b = P[i % P.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    var tot = L[P.length], out = [], j = 0;
    for (var k = 0; k < N; k++){
      var t = tot * k / N;
      while (j < P.length - 1 && L[j + 1] < t) j++;
      var a2 = P[j], b2 = P[(j + 1) % P.length], f = (t - L[j]) / Math.max(1e-9, L[j + 1] - L[j]);
      out.push([a2[0] + f * (b2[0] - a2[0]), a2[1] + f * (b2[1] - a2[1])]);
    }
    return out;
  }
  function signedArea(P){
    var s = 0;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1];
    return s / 2;
  }
  function between(A, B, f){
    var N = 64;
    if (signedArea(A) * signedArea(B) < 0) B = B.slice().reverse();
    var ra = resample(A, N), rb = resample(B, N);
    var start = function(R){ var bi = 0; R.forEach(function(p, i){ if (p[0] > R[bi][0]) bi = i; }); return bi; };
    var sa = start(ra), sb = start(rb);
    var out = [];
    for (var k = 0; k < N; k++){
      var p = ra[(sa + k) % N], q = rb[(sb + k) % N];
      out.push([p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])]);
    }
    return rdp(out, Math.max(0.7, ((META && META.simplifyNm) || SIMPLIFY_NM) / toolRes()[0]));              // open: its two ends are neighbours, so nothing is lost
  }

  /* ── FOLLOW IT THROUGH THE SECTIONS ───────────────────────────────────────────────────────────
     opts.existing(z) -> points | null: a ring this structure already has there. Such a section is
     NOT outlined again -- it is stepped over and followed on from (2026-11-01, Søren: two outlines
     on one section "wastes data and is difficult to remove").

     WHEN THE SECTION IT LANDS ON FAILS (no outline there, or one that does not look like the same
     organelle) -- 2026-11-01, Søren: following every 5th section, "there is one missing exactly at
     one of the every 5th slice":
       1. THE NEAREST GOOD NEIGHBOUR FIRST: the sections 1, then 2, ... away from it, up to half a
          step either way (never back past where it came from). A missing EM section is almost
          always a single one, so the one next to it is real tissue -- a real outline beats an
          invented one. It is kept at its own z (the volume and the 3D model take any spacing), and
          the stepping carries on from the planned grid, so the cadence is not lost.
       2. Only when no neighbour fits, or the step is 1 and there is no neighbour to try: the next
          planned section, and an outline INTERPOLATED for the failed one between its two
          neighbours, marked { interpolated: true }.
       3. Two failures in a row end it. */
  /* ── NOT ON TOP OF SOMETHING ALREADY TRACED ───────────────────────────────  2026-11-01
     Søren: "If the organelles lie really close and one of the organelles have been traced, then the
     automatic tracing with either AI button or forward or backward button should not be able to
     overlap with that structure." An outline is cut back to where the `avoid` polygons are not; of
     what is left, the piece holding `near` (else the one nearest it) is kept. Nothing left: null. */
  function clip(o, avoid, near){
    if (!o || !avoid || !avoid.length) return o;
    var bb = function(P){ var b = [Infinity, Infinity, -Infinity, -Infinity];
      P.forEach(function(p){ b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }); return b; };
    var ob = bb(o.points);
    var near2 = avoid.filter(function(P){ var b = bb(P); return !(b[0] > ob[2] || b[2] < ob[0] || b[1] > ob[3] || b[3] < ob[1]); });
    if (!near2.length) return o;
    var cell = Math.max(1, Math.max(ob[2] - ob[0], ob[3] - ob[1]) / 300);
    var pieces = union([o.points], cell, near2).filter(function(P){ return P.length >= 3; });
    if (!pieces.length) return null;
    var a0 = Math.abs(area(o.points)), a1 = pieces.reduce(function(s, P){ return s + Math.abs(area(P)); }, 0);
    if (a1 >= 0.995 * a0 && pieces.length === 1) return o;     // only touched: keep the original edge
    var pick = null;
    if (near) pick = pieces.filter(function(P){ return inside(near, P); })[0] || null;
    if (!pick) pick = pieces.reduce(function(a, b){
      var ca = centroid(a), cb = centroid(b), p = near || ca;
      return Math.hypot(cb[0] - p[0], cb[1] - p[1]) < Math.hypot(ca[0] - p[0], ca[1] - p[1]) ? b : a; });
    var tr = toolRes();
    var out = {}; for (var k in o) out[k] = o[k];
    out.points = pick; out.areaNm2 = Math.abs(area(pick)) * tr[0] * tr[1]; out.clipped = true;
    return out;
  }
  async function follow(points, z, dir, n, step, onEach, opts){
    opts = opts || {};
    var tr = toolRes(), got = [], prev = points, prevZ = z, gridZ = z;
    var prevArea = area(points) * tr[0] * tr[1];
    var ART = opts.artifactFrac == null ? 0.03 : opts.artifactFrac;
    var why = {};                                  // z -> "artifact", for the status line
    var fits = function(o, from, fromArea, zz){
      if (!o) return false;
      if (o.existing) return true;                 // what is already drawn there is the answer
      /* AN ARTIFACT OVER THE ORGANELLE counts as a missing section: a fold, a knife mark, a crack,
         or one of the person's own "imaging artifact" answers on this section inside or beside it. */
      if (o.artifact > ART || o.artifactLine || (opts.artifactAt && zz != null && opts.artifactAt(zz, o.points))){ if (zz != null) why[zz] = "artifact"; return false; }
      var c = centroid(from), c2 = centroid(o.points);
      var jump = Math.hypot((c2[0] - c[0]) * tr[0], (c2[1] - c[1]) * tr[1]);
      return !(o.areaNm2 < fromArea / 3 || o.areaNm2 > fromArea * 3 || jump > Math.max(300, Math.sqrt(fromArea)));
    };
    var have = function(zz){
      var ex = opts.existing ? opts.existing(zz) : null;
      return ex ? { points: ex, areaNm2: area(ex) * tr[0] * tr[1], existing: true } : null;
    };
    /* opts.avoid(z) -> polygons of OTHER structures already traced on z: never drawn over */
    var look = async function(zz){
      var o = await outline(centroid(prev), zz);
      return opts.avoid ? clip(o, opts.avoid(zz), centroid(prev)) : o;
    };
    var take = function(o, zz){
      if (!o.existing) got.push({ z: zz, points: o.points });
      prev = o.points; prevZ = zz; prevArea = o.areaNm2;
    };
    for (var k = 1; k <= n; k++){
      var zz = gridZ + dir * step;
      gridZ = zz;
      var o = have(zz) || await look(zz);
      if (fits(o, prev, prevArea, zz)){ take(o, zz); }
      else {
        var done = false;
        /* 1. the nearest good neighbour, within half a step, never behind where it came from */
        for (var d = 1; d <= Math.floor(step / 2) && !done; d++){
          for (var sgn = 1; sgn >= -1 && !done; sgn -= 2){
            var zn = zz + sgn * d * dir;
            if ((zn - prevZ) * dir <= 0) continue;
            var on = have(zn) || await look(zn);
            if (fits(on, prev, prevArea, zn)){
              take(on, zn); done = true;
              if (!on.existing){ got[got.length - 1].insteadOf = zz; got[got.length - 1].why = why[zz] || ""; }
            }
          }
        }
        /* 2. the next planned section, and the failed one interpolated */
        if (!done && k < n){
          var z2 = zz + dir * step;
          var o2 = have(z2) || await look(z2);
          if (fits(o2, prev, prevArea, z2)){
            var mid = between(prev, o2.points, (zz - prevZ) / (z2 - prevZ));
            if (opts.avoid){ var cm = clip({ points: mid }, opts.avoid(zz), centroid(mid)); if (cm) mid = cm.points; }
            got.push({ z: zz, points: mid, interpolated: true, why: why[zz] || "" });
            take(o2, z2); gridZ = z2; k++; done = true;
          }
        }
        if (!done) break;                          // 3. two failures in a row
      }
      if (onEach) try { onEach(got.length, prevZ); } catch (_e){}
    }
    return got;
  }

  return { configure: configure, available: available, whenAvailable: whenAvailable,
           outline: outline, follow: follow, union: union, clip: clip,
           subtract: function(polys, minus, cell){ return union(polys, cell, minus); }, inside: inside, between: between,
           centroid: centroid, meta: function(){ return META; },
           _trace: trace, _rdp: rdp, _clicked: clicked, _area: area };
})();
