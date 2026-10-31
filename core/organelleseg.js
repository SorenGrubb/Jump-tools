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
      var out = (await SESSION.run(feeds))[SESSION.outputNames[0]].data;
      var prob = new Float32Array(out.length);
      for (var k = 0; k < out.length; k++) prob[k] = 1 / (1 + Math.exp(-out[k]));
      var comp = clicked(prob, m.crop, m.crop, m.threshold || 0.5);
      if (!comp || comp.n * pl.res[0] * pl.res[1] < 1e4) return null;   // under (100 nm)^2: noise, not an organelle
      var px = rdp(trace(comp.mask, m.crop, m.crop), 0.7);
      /* A sliver -- a membrane line, a streak -- traces to a polygon with almost no inside. */
      if (px.length < 4 || area(px) < 0.3 * comp.n) return null;
      var tr = toolRes(), sc = 0;
      for (var q = 0; q < prob.length; q++) if (comp.mask[q]) sc += prob[q];
      return {
        points: px.map(function(a){ return [(pl.x0 + a[0] + 0.5) * pl.res[0] / tr[0], (pl.y0 + a[1] + 0.5) * pl.res[1] / tr[1]]; }),
        areaNm2: comp.n * pl.res[0] * pl.res[1], score: sc / comp.n, ep: EP
      };
    });
    QUEUE = p.catch(function(){});
    return p;
  }

  /* ── FOLLOW IT THROUGH THE SECTIONS ───────────────────────────────────────────────────────── */
  async function follow(points, z, dir, n, step, onEach){
    var tr = toolRes(), got = [], prev = points;
    var prevArea = area(points) * tr[0] * tr[1];
    for (var k = 1; k <= n; k++){
      var zz = z + dir * step * k, c = centroid(prev);
      var o = await outline(c, zz);
      if (!o) break;
      var a = o.areaNm2, c2 = centroid(o.points);
      var jump = Math.hypot((c2[0] - c[0]) * tr[0], (c2[1] - c[1]) * tr[1]);
      if (a < prevArea / 3 || a > prevArea * 3 || jump > Math.max(300, Math.sqrt(prevArea))) break;
      got.push({ z: zz, points: o.points });
      if (onEach) try { onEach(got.length, zz); } catch (_e){}
      prev = o.points; prevArea = a;
    }
    return got;
  }

  return { configure: configure, available: available, whenAvailable: whenAvailable,
           outline: outline, follow: follow, meta: function(){ return META; },
           _trace: trace, _rdp: rdp, _clicked: clicked, _area: area };
})();
