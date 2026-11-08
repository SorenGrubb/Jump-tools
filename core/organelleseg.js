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
  /* ── MORE THAN ONE OUTLINE MODEL (2026-11-02) ──────────────────────────────────────────────────
     Søren: "I think our next big step should be tracing nuclei ... Can we train the nucleus AI tracing on
     the existing nucleus segmentations?" -- and: "this will mainly be preparation for getting AI in the
     other tools." A nucleus does not fit in the organelle model's 2 um at 8 nm, so it has a model of its
     own, nucleus.json / nucleus.onnx beside seg.json (12 um at 32 nm, trained by
     nucleus_outline_train.ipynb on the MICrONS nucleus segmentation). Each model keeps its own meta and
     session in MODELS; the one in use is swapped into META / SESSION / LOADING inside the queue, so
     every line below that reads them is unchanged and two models never run on each other's state. */
  var MODELS = { seg: { file: "seg.json", ok: false, probe: null, meta: null, session: null, loading: null },
                 nucleus: { file: "nucleus.json", ok: false, probe: null, meta: null, session: null, loading: null } };
  var CUR = "seg";
  function use(name){
    name = MODELS[name] ? name : "seg";
    if (name === CUR) return;
    var a = MODELS[CUR]; a.meta = META; a.session = SESSION; a.loading = LOADING;
    var b = MODELS[name]; META = b.meta; SESSION = b.session; LOADING = b.loading;
    CUR = name;
  }

  /* A FALLBACK BASE, 2026-11-03 (see core/organelleml.js): configure({ base, fallback }) -- each
     model is looked for in the page's own folder first and in the fallback after, separately, so a
     dataset can have its own outline model and still borrow another's nucleus model. */
  function configure(cfg){
    cfg = cfg || {};
    var slash = function(x){ x = String(x || ""); return (x && x.slice(-1) !== "/") ? x + "/" : x; };
    var list = [slash(cfg.base)].concat([].concat(cfg.fallback || []).map(slash)).filter(Boolean);
    var b = list[0] || "";
    if (b !== CFG.base || CFG.list + "" !== list + ""){
      META = null; SESSION = null; LOADING = null;
      Object.keys(MODELS).forEach(function(k){ MODELS[k].meta = MODELS[k].session = MODELS[k].loading = null; });
    }
    CFG.base = b; CFG.list = list;
    if (cfg.ortBase){ ORT_BASE = cfg.ortBase; ORT_JS = cfg.ortJs || (ORT_BASE + "ort.webgpu.min.js"); }
    if (cfg.readPlane) CFG.readPlane = cfg.readPlane;      // for a check with no imagery behind it
    CFG.ok = false;
    Object.keys(MODELS).forEach(function(k){
      var M = MODELS[k]; M.ok = false; M.base = b;
      M.probe = (async function(){
        for (var i = 0; i < list.length; i++){
          try {
            var r = await fetch(list[i] + M.file, { method: "HEAD", cache: "no-cache" });
            if (r.ok){ M.base = list[i]; M.ok = true; return true; }
          } catch (_e){}
        }
        return false;
      })();
    });
    CFG.probe = MODELS.seg.probe.then(function(v){ CFG.ok = v; return v; });
    return CFG.probe;
  }
  /* Which folder a model comes from ("" if none was found). */
  function source(name){ var M = MODELS[name || "seg"]; return M && M.ok ? M.base : ""; }
  /* available() / whenAvailable(): the organelle model, as before. With a name: that model. */
  function available(name){ return !!(CFG.base && (name ? (MODELS[name] && MODELS[name].ok) : CFG.ok)); }
  function whenAvailable(name){
    if (name && MODELS[name]) return MODELS[name].probe || Promise.resolve(false);
    return CFG.probe || Promise.resolve(false);
  }

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
      var file = MODELS[CUR].file;
      var base = MODELS[CUR].base || CFG.base;
      var r = await fetch(base + file, { cache: "no-cache" });
      if (!r.ok) throw new Error(CUR === "nucleus" ? "no nucleus outline model has been trained for this dataset yet"
                                                   : "no outline model has been trained for this dataset yet");
      var m = await r.json();
      if (!m || m.format !== "ujump-organelle-outline-1") throw new Error(file + " is not an outline model this page understands");
      await loadScript(ORT_JS);
      var ort = window.ort;
      try { if (!ort.env.wasm.wasmPaths) ort.env.wasm.wasmPaths = ORT_BASE; } catch (_e){}
      var sess = null, err = null, eps = navigator.gpu ? [["webgpu"], ["wasm"]] : [["wasm"]];
      for (var i = 0; i < eps.length && !sess; i++){
        try { sess = await ort.InferenceSession.create(base + (m.onnx || file.replace(/\.json$/, ".onnx")), { executionProviders: eps[i] }); EP = eps[i][0]; }
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
  /* The level to read: the one at the model's voxel size, or -- on another dataset, 2026-11-02 -- the
     nearest one at least as fine (else the finest there is), which readPlane then resamples. */
  async function mipFor(nm){
    var first = await UJ.emtiles.scaleAt(0, false), best = -1, bestR = 0;
    for (var i = 0; i < first.count; i++){
      var s = await UJ.emtiles.scaleAt(i, false), r = s.scale.resolution[0];
      if (Math.abs(r - nm) < 0.01) return i;
      if (r <= nm * 1.0001 && r > bestR){ best = i; bestR = r; }
    }
    return best >= 0 ? best : 0;
  }
  async function readPlane(xy, z, m){
    if (CFG.readPlane) return CFG.readPlane(xy, z, m);
    var mip = await mipFor(m.nm);
    var sc = await UJ.emtiles.scaleAt(mip, false), r = sc.scale.resolution[0];
    var cv = document.createElement("canvas");
    /* The same stretch of tissue the model was trained on, read at this level, then resampled to the
       model's own pixels -- bilinear for the picture, nearest for "was this read". */
    var n = Math.max(8, Math.round(m.crop * m.nm / r));
    var v = await UJ.emtiles.drawSection(cv, { centre: [Math.round(xy[0]), Math.round(xy[1]), z], mip: mip, zoom: 1,
                                               w: n, h: n, lo: 0, hi: 255 });
    if (Math.abs(v.resNm[0] - m.nm) < 0.01)
      return { raw: v.raw, seen: v.seen, w: v.vw, h: v.vh, x0: v.x0, y0: v.y0, res: v.resNm };
    var C = m.crop, k = v.resNm[0] / m.nm, W = v.vw, H = v.vh;
    var raw = new Uint8Array(C * C), seen = new Uint8Array(C * C);
    for (var y = 0; y < C; y++) for (var x = 0; x < C; x++){
      var fx = (x + 0.5) / k - 0.5, fy = (y + 0.5) / k - 0.5;
      var x0 = Math.max(0, Math.min(W - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(H - 1, Math.floor(fy)));
      var x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), ax = Math.max(0, Math.min(1, fx - x0)), ay = Math.max(0, Math.min(1, fy - y0));
      var o = y * C + x;
      raw[o] = Math.round((v.raw[y0 * W + x0] * (1 - ax) + v.raw[y0 * W + x1] * ax) * (1 - ay)
                        + (v.raw[y1 * W + x0] * (1 - ax) + v.raw[y1 * W + x1] * ax) * ay);
      var nx = Math.max(0, Math.min(W - 1, Math.round(fx))), ny = Math.max(0, Math.min(H - 1, Math.round(fy)));
      seen[o] = v.seen[ny * W + nx];
    }
    return { raw: raw, seen: seen, w: C, h: C, x0: v.x0 * k, y0: v.y0 * k, res: [m.nm, m.nm, v.resNm[2]] };
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
  function outline(xy, z, opts){
    var want = (opts && opts.model) || "seg";
    var p = QUEUE.then(async function(){
      use(want);
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
      /* the whole probability picture, for fill() below, which weighs it against your own outlines */
      if (opts && opts.probOnly) return { prob: prob, crop: m.crop, x0: pl.x0, y0: pl.y0, res: pl.res, thr: m.threshold || 0.5 };
      var comp = clicked(prob, m.crop, m.crop, m.threshold || 0.5);
      if (!comp || comp.n * pl.res[0] * pl.res[1] < (m.minAreaNm2 || 1e4)) return null;   // under (100 nm)^2 (a nucleus: its own floor): noise
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

  /* ── FILL THE GAPS BETWEEN YOUR OUTLINES, WITH THE AI AS A SECOND OPINION ──────────  2026-11-08
     Søren: *"When you have segmented every 3-5 segments and then press the Follow the last outline
     either way. Then it should fill the gaps out with an interpolation between the segmentations but
     take the AI prediction into consideration ... I don't want it to be a simple interpolation, but
     also I don't want it only based on AI, if the segmentations I have made myself is better."*

     For each section between two of YOUR outlines (A below, B above), three things are measured, and
     only then mixed:

       PRIOR    the shape between A and B at that height (between(): both rings resampled, aligned and
                blended) -- turned into a soft map: 1 well inside, 0 well outside, a ~30 nm ramp over
                its edge.
       AI       the model's probability map on that section, centred on the prior.
       SKILL    how good the AI is ON THIS ORGANELLE: its outline on A's and B's own sections compared
                with yours there (IoU). Your drawn sections are the test it is marked against. Under
                IoU 0.7 it gets no say at all; from 0.9 it gets its full say. (Tested on a stand-in
                organelle that bulges between the drawn sections: an AI that matched the drawn ones
                raised the filled sections' overlap with the truth from 0.95 to 0.97, 0.91 to 0.98 in
                the bulge; one that did not -- IoU 0.62 -- was given no say, and changed nothing.)

     weight w = skill x agreement x middle, where agreement is how much the AI's piece and the prior
     overlap on that section (an AI piece that wanders off to the neighbouring organelle gets no say),
     and middle is 0.5 next to your outline rising to 1 halfway between (near what you drew, what you
     drew counts most). The outline drawn is where (1-w)·prior + w·AI passes 0.5 -- the piece holding
     the prior's centre. So: an AI that has shown it matches you, agrees with the shape, and has
     something to add (a bulge, a narrowing the straight blend cannot know about) moves the edge; an
     AI that missed on your sections, or disagrees, leaves the interpolation as it is. Your own
     outlines are never touched. Every filled ring says how it was made: { filled: true, w, skill,
     agree }, or { interpolated: true } where the AI could not be read there. */
  function rasterOn(P, g){
    /* polygon (tool voxels) -> mask on a model grid g {crop, x0, y0, res} */
    var tr = toolRes(), C = g.crop, m = new Uint8Array(C * C), Q = P.map(function(p){
      return [p[0] * tr[0] / g.res[0] - g.x0 - 0.5, p[1] * tr[1] / g.res[1] - g.y0 - 0.5]; });
    for (var r = 0; r < C; r++){
      var xs = [];
      for (var i = 0, j = Q.length - 1; i < Q.length; j = i++){
        var a = Q[i], b = Q[j];
        if ((a[1] > r) !== (b[1] > r)) xs.push(a[0] + (r - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort(function(u, v){ return u - v; });
      for (var k = 0; k + 1 < xs.length; k += 2){
        var c0 = Math.max(0, Math.ceil(xs[k])), c1 = Math.min(C - 1, Math.floor(xs[k + 1]));
        for (var c = c0; c <= c1; c++) m[r * C + c] = 1;
      }
    }
    var inGrid = Q.every(function(q){ return q[0] > 1 && q[1] > 1 && q[0] < C - 2 && q[1] < C - 2; });
    return { mask: m, inGrid: inGrid };
  }
  function chamfer(mask, C, inside){
    /* distance (px) to the nearest pixel of the other kind; 3-4 chamfer, two passes */
    var INF = 1e9, d = new Float32Array(C * C), x, y, o;
    for (o = 0; o < C * C; o++) d[o] = (!!mask[o] === inside) ? INF : 0;
    for (y = 0; y < C; y++) for (x = 0; x < C; x++){ o = y * C + x; if (!d[o]) continue;
      if (x > 0) d[o] = Math.min(d[o], d[o - 1] + 3);
      if (y > 0){ d[o] = Math.min(d[o], d[o - C] + 3); if (x > 0) d[o] = Math.min(d[o], d[o - C - 1] + 4); if (x < C - 1) d[o] = Math.min(d[o], d[o - C + 1] + 4); } }
    for (y = C - 1; y >= 0; y--) for (x = C - 1; x >= 0; x--){ o = y * C + x; if (!d[o]) continue;
      if (x < C - 1) d[o] = Math.min(d[o], d[o + 1] + 3);
      if (y < C - 1){ d[o] = Math.min(d[o], d[o + C] + 3); if (x < C - 1) d[o] = Math.min(d[o], d[o + C + 1] + 4); if (x > 0) d[o] = Math.min(d[o], d[o + C - 1] + 4); } }
    for (o = 0; o < C * C; o++) d[o] /= 3;
    return d;
  }
  function softPrior(mask, C, edgePx){
    var dIn = chamfer(mask, C, true), dOut = chamfer(mask, C, false), out = new Float32Array(C * C);
    for (var o = 0; o < C * C; o++){
      var sd = mask[o] ? -(dIn[o] - 0.5) : (dOut[o] - 0.5);       // negative inside
      out[o] = 1 / (1 + Math.exp(sd / edgePx));
    }
    return out;
  }
  function biggestOverlap(prob, thr, C, ref){
    /* the thresholded piece of `prob` that overlaps `ref` most */
    var lab = new Int32Array(C * C), best = null, bestOv = 0, id = 0;
    for (var s0 = 0; s0 < C * C; s0++){
      if (prob[s0] < thr || lab[s0]) continue;
      id++; var st = [s0], cells = [], ov = 0; lab[s0] = id;
      while (st.length){
        var q = st.pop(); cells.push(q); if (ref[q]) ov++;
        var qy = (q / C) | 0, qx = q - qy * C;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++){
          var y2 = qy + dy, x2 = qx + dx; if (x2 < 0 || y2 < 0 || x2 >= C || y2 >= C) continue;
          var q2 = y2 * C + x2; if (!lab[q2] && prob[q2] >= thr){ lab[q2] = id; st.push(q2); }
        }
      }
      if (ov > bestOv){ bestOv = ov; best = cells; }
    }
    if (!best) return null;
    var m = new Uint8Array(C * C); best.forEach(function(q){ m[q] = 1; });
    return m;
  }
  function iou(a, b){
    var i = 0, u = 0; for (var o = 0; o < a.length; o++){ if (a[o] || b[o]){ u++; if (a[o] && b[o]) i++; } }
    return u ? i / u : 0;
  }
  async function skillOn(points, z, model, probAt){
    /* the AI's outline on one of YOUR sections, marked against yours (IoU) */
    var g = probAt ? await probAt(centroid(points), z) : await outline(centroid(points), z, { model: model, probOnly: true });
    if (!g) return null;
    var you = rasterOn(points, g);
    if (!you.inGrid) return null;
    var ai = biggestOverlap(g.prob, g.thr, g.crop, you.mask);
    return ai ? iou(ai, you.mask) : 0;
  }
  async function fillOne(A, zA, B, zB, z, ctx){
    var f = (z - zA) / (zB - zA), prior = between(A, B, f), tr = toolRes();
    var g = null;
    try { g = ctx.probAt ? await ctx.probAt(centroid(prior), z) : await outline(centroid(prior), z, { model: ctx.model, probOnly: true }); } catch (_e){ g = null; }
    var plain = function(){ return { z: z, points: prior, interpolated: true }; };
    if (!g || !(ctx.skill > 0)) return plain();
    var C = g.crop, pr = rasterOn(prior, g);
    if (!pr.inGrid) return plain();                       // bigger than the AI's window: the blend alone
    var aiPiece = biggestOverlap(g.prob, g.thr, C, pr.mask);
    var agree = aiPiece ? iou(aiPiece, pr.mask) : 0;
    var ss = function(x, a, b){ var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    var skillW = ss(ctx.skill, 0.7, 0.9), agreeW = ss(agree, 0.25, 0.6), middle = 0.5 + 0.5 * Math.sin(Math.PI * f);
    var w = Math.min(0.9, skillW * agreeW * middle);
    if (w < 0.05) { var o0 = plain(); o0.agree = agree; o0.skill = ctx.skill; return o0; }
    var soft = softPrior(pr.mask, C, Math.max(1, 30 / g.res[0]));
    var fused = new Float32Array(C * C);
    for (var o = 0; o < C * C; o++) fused[o] = (1 - w) * soft[o] + w * (aiPiece && aiPiece[o] ? g.prob[o] : g.prob[o] * 0.5);
    var piece = biggestOverlap(fused, 0.5, C, pr.mask);
    if (!piece) return plain();
    var px = simplifyRing(trace(piece, C, C), g.res[0]);
    if (px.length < 4) return plain();
    /* the boundary is traced through the centres of the edge pixels, half a pixel inside the edge
       (3% of a lysosome's area): put that half pixel back, so a filled ring is the same size as the
       rings you drew beside it */
    var sa = signedArea(px) > 0 ? 1 : -1, n0 = px.length;
    px = px.map(function(p, i){
      var a0 = px[(i - 1 + n0) % n0], b0 = px[(i + 1) % n0], tx = b0[0] - a0[0], ty = b0[1] - a0[1], L = Math.hypot(tx, ty) || 1;
      /* outward normal for this winding (image y points down) */
      return [p[0] + sa * ty / L * 0.5, p[1] - sa * tx / L * 0.5];
    });
    var pts = px.map(function(a){ return [(g.x0 + a[0] + 0.5) * g.res[0] / tr[0], (g.y0 + a[1] + 0.5) * g.res[1] / tr[1]]; });
    /* a fused ring wildly off the blend (less than half or more than twice its area) is not trusted */
    var ap = Math.abs(area(prior)), af = Math.abs(area(pts));
    if (!(af > 0.5 * ap && af < 2 * ap)) return plain();
    return { z: z, points: pts, filled: true, w: Math.round(w * 100) / 100, skill: Math.round(ctx.skill * 100) / 100, agree: Math.round(agree * 100) / 100 };
  }
  /* rings: [{ z, points }] of ONE structure (the largest on each section is used). Fills every
     section between two of them that are more than one section apart and at most opts.maxGap
     (default 25) apart. opts: { model, avoid(z) -> polygons, onEach(k, z), probAt(xy, z) -> a
     probability picture as outline(..., {probOnly:true}) gives (for testing: a stand-in AI) }. */
  async function fill(rings, opts){
    opts = opts || {};
    var byZ = {};
    rings.forEach(function(r){ var z = Math.round(r.z); if (!byZ[z] || Math.abs(area(r.points)) > Math.abs(area(byZ[z]))) byZ[z] = r.points; });
    var zs = Object.keys(byZ).map(Number).sort(function(a, b){ return a - b; });
    var maxGap = opts.maxGap || 25, got = [], skills = {};
    var skillAt = async function(z){
      if (!(z in skills)){ try { skills[z] = await skillOn(byZ[z], z, opts.model, opts.probAt); } catch (_e){ skills[z] = null; } }
      return skills[z];
    };
    for (var i = 0; i + 1 < zs.length; i++){
      var zA = zs[i], zB = zs[i + 1];
      if (zB - zA < 2 || zB - zA > maxGap) continue;
      var sA = await skillAt(zA), sB = await skillAt(zB);
      var known = [sA, sB].filter(function(v){ return v != null; });
      var ctx = { model: opts.model, probAt: opts.probAt, skill: known.length ? known.reduce(function(a, b){ return a + b; }, 0) / known.length : 0 };
      for (var z = zA + 1; z < zB; z++){
        var r = await fillOne(byZ[zA], zA, byZ[zB], zB, z, ctx);
        if (opts.avoid){ var cl = clip({ points: r.points }, opts.avoid(z), centroid(r.points)); if (cl) r.points = cl.points; }
        got.push(r);
        if (opts.onEach) try { opts.onEach(got.length, z); } catch (_e){}
      }
    }
    return got;
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
      var o = await outline(centroid(prev), zz, { model: opts.model });
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

  return { configure: configure, source: source, available: available, whenAvailable: whenAvailable,
           outline: outline, follow: follow, fill: fill, union: union, clip: clip,
           subtract: function(polys, minus, cell){ return union(polys, cell, minus); }, inside: inside, between: between,
           centroid: centroid, meta: function(){ return META; },
           _trace: trace, _rdp: rdp, _clicked: clicked, _area: area };
})();
