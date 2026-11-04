/* core/organelleml.js — the tracing pad suggests what the organelles are.          2026-10-30

   Søren: *"I imagine that you open an em window and then the organelles are identified and shown
   with an annotation, so that people new to EM could get an idea of what is what."* And, on how:
   no dedicated server.

   WHAT RUNS WHERE
     - TRAINING happens in Colab (organelle_ml_train.ipynb, beside this repo), on the community's
       own organelle points and traced contours, and writes two files: model.onnx and model.json.
     - THE TWO FILES ARE STATIC: they sit in this repo under models/organelles/<dataset>/ and are
       served by GitHub Pages like any picture.
     - INFERENCE RUNS IN THE READER'S BROWSER, through onnxruntime-web (WebGPU where the browser
       has it, WebAssembly where it does not). Nothing about a section leaves the page.

   WHAT THE MODEL IS
     A fully convolutional classifier: one grey EM plane in, one class score per 8 x 8 block of it
     out (128 nm at 16 nm data). It was trained on crops centred on points people placed, so it
     answers "what is at this spot", and a mark is drawn where a class wins its neighbourhood with
     more confidence than that class's own threshold, chosen in training on held-out tissue.

   WHAT IT IS NOT
     A segmentation. It puts a labelled ring where it thinks something is; it does not outline
     it. Its labels are SUGGESTIONS — the caption says so, and the threshold per class is the one
     that held up on tissue it never saw, not a promise about this section.

   THE RAW PLANE, NOT THE PICTURE
     A model trained on raw uint8 values is shown raw uint8 values: core/emtiles.js hands back the
     plane it read before any contrast window (view.raw). A window chosen for a person's eyes
     would be a different microscope to the model.

   ONE RESOLUTION
     The model knows one voxel size (model.json "nm"). When the pad shows another, the same patch
     of tissue is read again at the model's level — through the same reader and the same chunk
     cache, so at the default 16 nm pad that is free — and capped at 1024 px a side.

   HOST CONTRACT
     UJ.organelleml.configure({ base: "models/organelles/minnie65/" })   // where model.json is;
                                                                          // probes for it
     UJ.organelleml.available() / whenAvailable()                         // is there one?
     UJ.organelleml.run(view, { say })  -> Promise<marks | null>          // view from drawSection
     UJ.organelleml.paint(ctx, view, z)                                   // after the base
   Tested 2026-10-30 in Chromium with onnxruntime-web 1.19.2 (WASM) on a stand-in model: marks land
   on the right blocks at the pad's own level and when the plane is re-read at the model's level. */
var UJ = UJ || {};
UJ.organelleml = (function(){
  "use strict";

  /* onnxruntime-web, pinned. The WebGPU bundle carries the WebAssembly backend as well, so one
     script serves both; the .wasm files are fetched from beside it. */
  var ORT_VER = "1.19.2";
  var ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@" + ORT_VER + "/dist/";
  var ORT_JS = ORT_BASE + "ort.webgpu.min.js";
  var LS_ON = "ujump_organelleml_on_v1";

  var CFG = { base: "" };
  var META = null, SESSION = null, LOADING = null, EP = "";
  var LAST = null;           // { key, marks, z }
  var QUEUE = Promise.resolve();
  var TOKEN = 0;
  var MAX_SIDE = 1024, MAX_MARKS = 80, EDGE = 24;

  /* A FALLBACK BASE, 2026-11-03. Søren: "I guess we can also reuse some of the uJump for hJump, no?"
     configure({ base: "models/organelles/h01/", fallback: "models/organelles/minnie65/" }) uses the
     page's own model when one has been trained for it, and the other dataset's until then. The model
     reads EM at its own nm (model.json "nm"), so another volume's model runs as long as the volume
     has that level; whether it is any GOOD there is for the reader to judge, which is why
     source() says whose model it is. */
  function configure(cfg){
    cfg = cfg || {};
    var slash = function(x){ x = String(x || ""); return (x && x.slice(-1) !== "/") ? x + "/" : x; };
    var list = [slash(cfg.base)].concat([].concat(cfg.fallback || []).map(slash)).filter(Boolean);
    var b = list[0] || "";
    if (b !== CFG.base || CFG.list + "" !== list + ""){ META = null; SESSION = null; LOADING = null; LAST = null; }
    CFG.base = b; CFG.list = list;
    if (cfg.ortBase){ ORT_BASE = cfg.ortBase; ORT_JS = cfg.ortJs || (ORT_BASE + "ort.webgpu.min.js"); }
    /* IS THERE A MODEL YET? One small request per page, so the tick only appears once a model has
       actually been trained and uploaded: until then a box that can only say "nothing here" is
       noise on every reader's pad. */
    CFG.ok = false;
    CFG.probe = (async function(){
      for (var i = 0; i < list.length; i++){
        try {
          var r = await fetch(list[i] + "model.json", { method: "HEAD", cache: "no-cache" });
          if (r.ok){ CFG.base = list[i]; CFG.ok = true; return true; }
        } catch (_e){}
      }
      return false;
    })();
    return CFG.probe;
  }
  /* Which folder the model in use comes from ("" before the probe has answered). */
  function source(){ return CFG.ok ? CFG.base : ""; }
  function available(){ return !!(CFG.base && CFG.ok); }
  function whenAvailable(){ return CFG.probe || Promise.resolve(false); }
  function on(){
    try { return localStorage.getItem(LS_ON) === "1"; } catch (_e){ return false; }
  }
  function setOn(v){
    try { localStorage.setItem(LS_ON, v ? "1" : "0"); } catch (_e){}
    if (!v) LAST = null;
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

  /* The model is fetched once per page, on the first tick of the box — never on load. */
  function load(say){
    if (SESSION) return Promise.resolve(SESSION);
    if (LOADING) return LOADING;
    LOADING = (async function(){
      if (!CFG.base) throw new Error("no organelle model is set up for this dataset");
      if (say) say("reading the organelle model…");
      var r = await fetch(CFG.base + "model.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status === 404
        ? "no organelle model has been trained for this dataset yet"
        : "the organelle model's description could not be read (" + r.status + ")");
      var m = await r.json();
      if (!m || m.format !== "ujump-organelle-model-1" || !Array.isArray(m.classes))
        throw new Error("model.json is not an organelle model this page understands");
      await loadScript(ORT_JS);
      var ort = window.ort;
      try { ort.env.wasm.wasmPaths = ORT_BASE; } catch (_e){}
      var url = CFG.base + (m.onnx || "model.onnx");
      if (say) say("starting the organelle model…");
      var sess = null, err = null;
      var eps = (navigator.gpu ? [["webgpu"], ["wasm"]] : [["wasm"]]);
      for (var i = 0; i < eps.length && !sess; i++){
        try { sess = await ort.InferenceSession.create(url, { executionProviders: eps[i] }); EP = eps[i][0]; }
        catch (e){ err = e; }
      }
      if (!sess) throw new Error("the organelle model could not start: " + String(err && err.message || err));
      META = m; SESSION = sess;
      return sess;
    })();
    LOADING.catch(function(){ LOADING = null; });
    return LOADING;
  }

  /* Which level of the reader's list has the model's voxel size. Asked of the reader rather than
     assumed, because the index of a resolution differs between volumes. */
  async function mipFor(nm){
    var first = await UJ.emtiles.scaleAt(0, false);
    for (var i = 0; i < first.count; i++){
      var s = await UJ.emtiles.scaleAt(i, false);
      if (Math.abs(s.scale.resolution[0] - nm) < 0.01) return i;
    }
    return -1;
  }

  /* The plane at the model's resolution, covering what the pad shows (centre outward, capped). */
  async function planeFor(view, nm){
    if (view.raw && view.resNm && Math.abs(view.resNm[0] - nm) < 0.01)
      return { raw: view.raw, seen: view.seen, w: view.vw, h: view.vh, x0: view.x0, y0: view.y0, res: view.resNm };
    var mip = await mipFor(nm);
    if (mip < 0) throw new Error("this volume has no " + nm + " nm level for the model to read");
    var a = view.toolAt(0, 0), b = view.toolAt(view.w, view.h);
    var tres = UJ.emtiles.config().res;
    var w = Math.min(MAX_SIDE, Math.max(32, Math.round(Math.abs(b[0] - a[0]) * tres[0] / nm)));
    var h = Math.min(MAX_SIDE, Math.max(32, Math.round(Math.abs(b[1] - a[1]) * tres[1] / nm)));
    var centre = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), view.z];
    var cv = document.createElement("canvas");
    var v2 = await UJ.emtiles.drawSection(cv, { centre: centre, mip: mip, zoom: 1, w: w, h: h, lo: 0, hi: 255 });
    return { raw: v2.raw, seen: v2.seen, w: v2.vw, h: v2.vh, x0: v2.x0, y0: v2.y0, res: v2.resNm };
  }

  /* Normalise, pad to the network's multiple, and say where the padding is. */
  /* ── DARK-CELL MODE ────────────────────────────────────────────────────────────  2026-10-30
     Søren: *"what do we do about cells like endothelial cells that are much darker? It does not
     recognize anything in them. Can we make a separate mode for dark cells?"*

     A dark cell is the same organelles on a lower, flatter grey, and a model that learned its
     greys in ordinary neuropil sees nothing there. So in this mode every voxel is measured against
     its own 2 um neighbourhood (a box of round(1000 / nm) voxels each way, clipped at the edges)
     before the model sees it: v' = (v - local mean) * (model std / local std) + model mean. A dark
     cytoplasm lands on the grey the model knows, with its organelles standing out by as much as
     they do from their own surroundings. The notebook (v9 on) trains on the same transform for a
     quarter of its crops, so the model has seen tissue that looks like this; organelle_ml_train's
     flatten() is this function, line for line. Off by default: in ordinary tissue the raw plane is
     what the model was mostly trained on. */
  var LS_DARK = "ujump_organelleml_dark_v1";
  function dark(){ try { return localStorage.getItem(LS_DARK) === "1"; } catch (_e){ return false; } }
  function setDark(v){ try { localStorage.setItem(LS_DARK, v ? "1" : "0"); } catch (_e){} LAST = null; }
  function flatten(raw, seen, w, h, R, mean, sd){
    var W1 = w + 1, S = new Float64Array(W1 * (h + 1)), Q = new Float64Array(W1 * (h + 1)), N = new Float64Array(W1 * (h + 1));
    for (var y = 0; y < h; y++){
      var rs = 0, rq = 0, rn = 0;
      for (var x = 0; x < w; x++){
        var o = y * w + x;
        if (seen[o]){ var v = raw[o]; rs += v; rq += v * v; rn += 1; }
        var i = (y + 1) * W1 + x + 1;
        S[i] = S[i - W1] + rs; Q[i] = Q[i - W1] + rq; N[i] = N[i - W1] + rn;
      }
    }
    var out = new Float32Array(w * h);
    for (var y2 = 0; y2 < h; y2++){
      var a0 = Math.max(0, y2 - R), a1 = Math.min(h, y2 + R + 1);
      for (var x2 = 0; x2 < w; x2++){
        var o2 = y2 * w + x2;
        if (!seen[o2]){ out[o2] = mean; continue; }
        var b0 = Math.max(0, x2 - R), b1 = Math.min(w, x2 + R + 1);
        var i11 = a1 * W1 + b1, i01 = a0 * W1 + b1, i10 = a1 * W1 + b0, i00 = a0 * W1 + b0;
        var n = N[i11] - N[i01] - N[i10] + N[i00];
        var su = S[i11] - S[i01] - S[i10] + S[i00], sq = Q[i11] - Q[i01] - Q[i10] + Q[i00];
        var lm = su / n, lsd = Math.sqrt(Math.max(0, sq / n - lm * lm));
        var v2 = (raw[o2] - lm) * (sd / Math.max(lsd, 4)) + mean;
        out[o2] = v2 < 0 ? 0 : v2 > 255 ? 255 : v2;
      }
    }
    return out;
  }

  function tensorData(pl, m, darkMode){
    var mult = m.inputMultiple || 16;
    var W = Math.ceil(pl.w / mult) * mult, H = Math.ceil(pl.h / mult) * mult;
    var d = new Float32Array(W * H), mean = m.mean, sd = m.std || 1;
    var src = darkMode ? flatten(pl.raw, pl.seen, pl.w, pl.h, (m.flatR || Math.round(1000 / (m.nm || 16))), mean, sd) : pl.raw;
    for (var y = 0; y < pl.h; y++){
      for (var x = 0; x < pl.w; x++){
        var o = y * pl.w + x;
        d[y * W + x] = pl.seen[o] ? (src[o] - mean) / sd : 0;
      }
    }
    return { data: d, W: W, H: H };
  }

  /* Scores -> marks. logits is C x h x w, channel 0 is background. A block is marked when its
     best class is not background, beats that class's threshold, and is the highest score for that
     class in its 3 x 3 neighbourhood. Blocks mostly outside the read tissue are skipped. */
  function peaks(logits, C, h, w, m, pl){
    var n = h * w, prob = new Float32Array(C * n), best = new Int32Array(n);
    for (var i = 0; i < n; i++){
      var mx = -1e30, k;
      for (k = 0; k < C; k++) if (logits[k * n + i] > mx) mx = logits[k * n + i];
      var s = 0;
      for (k = 0; k < C; k++){ var e = Math.exp(logits[k * n + i] - mx); prob[k * n + i] = e; s += e; }
      var bk = 0, bp = -1;
      for (k = 0; k < C; k++){ prob[k * n + i] /= s; if (prob[k * n + i] > bp){ bp = prob[k * n + i]; bk = k; } }
      best[i] = bk;
    }
    var st = m.stride || 8, half = st / 2, thr = m.thresholds || {}, out = [];
    /* A block qualifies when its best class is not background, that class is shown, it beats the
       class's threshold, it is not at the edge, and it is on tissue that was read. */
    var ok = new Uint8Array(n);
    for (var yy = 0; yy < h; yy++){
      for (var xx = 0; xx < w; xx++){
        var c = yy * w + xx, kk = best[c];
        if (kk === 0) continue;
        var name = m.classes[kk];
        /* A class the held-out tissue said the model cannot yet tell apart is not shown at all. */
        if (m.show && m.show.indexOf(name) < 0) continue;
        if (prob[kk * n + c] < (thr[name] == null ? 0.5 : thr[name])) continue;
        var px = xx * st + half, py = yy * st + half;
        /* NOT AT THE EDGE. The network never saw the end of a picture in training (every crop was
           tissue all the way out), and next to one it guesses. 24 px is 384 nm at 16 nm. */
        if (px < EDGE || py < EDGE || px > pl.w - EDGE || py > pl.h - EDGE) continue;
        if (px >= pl.w || py >= pl.h || !pl.seen[py * pl.w + px]) continue;
        ok[c] = 1;
      }
    }
    /* ONE MARK PER PATCH (2026-10-30, after the first real model ringed one long lysosome nine
       times): qualifying blocks of the same class that touch, diagonals included, are one thing,
       marked once at their most confident block. The notebook's window_marks() does the same. */
    var seenB = new Uint8Array(n), stack = [];
    for (var s0 = 0; s0 < n; s0++){
      if (!ok[s0] || seenB[s0]) continue;
      var k0 = best[s0], bi = s0, bp2 = prob[k0 * n + s0];
      stack.length = 0; stack.push(s0); seenB[s0] = 1;
      while (stack.length){
        var q0 = stack.pop(), qy = (q0 / w) | 0, qx = q0 - qy * w;
        if (prob[k0 * n + q0] > bp2){ bp2 = prob[k0 * n + q0]; bi = q0; }
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++){
          var y2 = qy + dy, x2 = qx + dx;
          if (y2 < 0 || x2 < 0 || y2 >= h || x2 >= w) continue;
          var q2 = y2 * w + x2;
          if (ok[q2] && !seenB[q2] && best[q2] === k0){ seenB[q2] = 1; stack.push(q2); }
        }
      }
      var by = (bi / w) | 0, bx = bi - by * w;
      out.push({ k: m.classes[k0], p: bp2, px: bx * st + half, py: by * st + half });
    }
    out.sort(function(a, b){ return b.p - a.p; });
    /* ONE MARK PER THING. A block next to a confident one often scores some other class on the
       organelle's own rim; within nmsNm (300 nm unless model.json says otherwise) of a stronger
       mark, of any class, a weaker one is dropped. */
    var r = (m.nmsNm || 300) / (m.nm || 16), r2 = r * r, kept = [];
    for (var a = 0; a < out.length && kept.length < MAX_MARKS; a++){
      var ok = true;
      for (var b = 0; b < kept.length; b++){
        var ddx = out[a].px - kept[b].px, ddy = out[a].py - kept[b].py;
        if (ddx * ddx + ddy * ddy < r2){ ok = false; break; }
      }
      if (ok) kept.push(out[a]);
    }
    return kept;
  }

  function toTool(pl, px, py, z){
    var tres = UJ.emtiles.config().res;
    return [Math.round((pl.x0 + px) * pl.res[0] / tres[0]), Math.round((pl.y0 + py) * pl.res[1] / tres[1]), z];
  }

  /* One run at a time: a second section asked for while the first is in the model waits, and a
     run whose answer arrives after a newer one was asked for is dropped. */
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
  function run(view, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    var my = ++TOKEN;
    var p = QUEUE.then(async function(){
      if (my !== TOKEN) return null;
      await load(say);
      if (my !== TOKEN) return null;
      var m = META;
      var dk = dark();
      var key = [view.z, view.x0, view.y0, view.vw, view.vh, view.resNm && view.resNm[0], m.nm, dk ? "dark" : ""].join(":");
      if (LAST && LAST.key === key) return LAST.marks;
      say("looking for organelles…");
      var pl = await planeFor(view, m.nm);
      if (my !== TOKEN) return null;
      var td = tensorData(pl, m, dk);
      var ort = window.ort;
      var feeds = {};
      feeds[SESSION.inputNames[0]] = new ort.Tensor("float32", td.data, [1, 1, td.H, td.W]);
      var t0 = performance.now();
      var res = await runSafe(feeds, function(){ return load(say); });
      var o = res[SESSION.outputNames[0]];
      var C = o.dims[1], h = o.dims[2], w = o.dims[3];
      var found = peaks(o.data, C, h, w, m, pl).map(function(k){
        return { k: k.k, p: k.p, t: toTool(pl, k.px, k.py, view.z) };
      });
      LAST = { key: key, marks: found, z: view.z, ms: Math.round(performance.now() - t0), ep: EP, dark: dk,
               /* the raw scores too, for kindOf(): what an outline is, even where no mark was drawn */
               grid: { logits: o.data, C: C, h: h, w: w, st: m.stride || 8, x0: pl.x0, y0: pl.y0, res: pl.res } };
      return found;
    });
    QUEUE = p.catch(function(){});
    return p;
  }

  /* ── HOW A MARK LOOKS ──────────────────────────────────────────────────────────────────────
     A ring the reader can see through, and the organelle's name beside it with the model's
     confidence, outlined dark so it reads on any grey. The colour is per class and the same on
     every section, golden-angle hues as the Filter-and-show point layers use. */
  var COLOURS = {};
  function colourOf(k){
    if (COLOURS[k]) return COLOURS[k];
    var cls = (META && META.classes) || [], i = Math.max(0, cls.indexOf(k));
    var hue = (i * 137.508) % 360;
    return (COLOURS[k] = "hsl(" + hue.toFixed(0) + ",85%,62%)");
  }
  function nameOf(k){
    try {
      var g = window.ORGANELLE_GROUPS || [];
      for (var i = 0; i < g.length; i++) for (var j = 0; j < g[i].kinds.length; j++)
        if (g[i].kinds[j].value === k) return g[i].kinds[j].label;
    } catch (_e){}
    /* Two answers the pad gives that are not organelles (2026-10-30). */
    if (k === ARTIFACT) return "Imaging artifact";
    if (k === NOT_ORGANELLE) return "not an organelle";
    return String(k).replace(/_/g, " ");
  }
  /* ── CORRECTIONS ───────────────────────────────────────────────────────────────  2026-10-30
     Søren: *"Can we train it just by it guessing and then instead of saying yes or no, I can tell
     it exactly what it is and that trains it?"* A correction is kept here for this page's life (so
     it stays drawn when you come back to the section) and sent by the pad as an ordinary organelle
     report; the notebook reads it at the next training. `verdict` is "ok" (the mark was right),
     "no" (nothing there: kind "not_an_organelle") or "kind" (it is something else, or a missed one).
     Each: { t:[x,y,z], k: what it really is, was: what the model said or "", p, verdict }. */
  /* KEPT IN THIS BROWSER (2026-10-31): Søren put an artifact where there was none and could not take
     it back. Your answers are remembered here across visits so they are drawn again -- and so a
     wrong one can be clicked and undone. Only this browser's own answers; nothing is read back from
     the server, and a clear of site data forgets them (the reports themselves stay). */
  var LS_CORR = "ujump_organelleml_corr_v1";
  var CORR = (function(){ try { return JSON.parse(localStorage.getItem(LS_CORR) || "[]") || []; } catch (_e){ return []; } })();
  function keep(){ try { localStorage.setItem(LS_CORR, JSON.stringify(CORR.slice(-2000))); } catch (_e){} }
  var NOT_ORGANELLE = "not_an_organelle";
  /* A FOLD, A KNIFE MARK, DIRT, A CRACK IN THE RESIN -- Søren, 2026-10-30: "We should be able to
     label artifacts, so that they will be recognized as not being organelles." Its own kind rather
     than "not an organelle": once there are enough, the model learns artifacts as a class of their
     own -- worth showing a beginner too -- and until then the notebook counts them as background. */
  var ARTIFACT = "imaging_artifact";
  function same(a, b){ return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function markAt(view, px, py, z, radius){
    var r = radius || 14, best = null, bd = r * r;
    var all = (LAST && LAST.z === z ? LAST.marks.filter(function(m){ return shown(m.k); }) : [])
      .concat(CORR.filter(function(c){ return c.t[2] === z && answerShown(c); }));
    all.forEach(function(mk){
      var q = view.pxAt(mk.t), d = (q[0] - px) * (q[0] - px) + (q[1] - py) * (q[1] - py);
      if (d <= bd){ bd = d; best = mk; }
    });
    return best;
  }
  function correct(c){
    CORR = CORR.filter(function(o){ return !same(o.t, c.t); });
    c.at = c.at || Date.now();
    CORR.push(c); keep();
    return CORR.length;
  }
  /* UNDO: the answer leaves this browser's list. What reaches the training is a RETRACTION, sent by
     the pad as kind "retract:<kind>" at the same voxel -- the notebook removes one report of that
     kind at that exact place per retraction, so answering, undoing and answering again counts once. */
  function uncorrect(t){
    var n = CORR.length;
    CORR = CORR.filter(function(o){ return !same(o.t, t); }); keep();
    return n !== CORR.length;
  }
  function corrections(){ return CORR.slice(); }

  /* ── SHOW ONLY SOME KINDS ───────────────────────────────────────────────────────  2026-11-04
     Søren: "It is getting too crowded. We should have a way to select for a certain organelle type."
     One chip per kind on this section (with its count and colour) and one for your own answers:
     a click hides or shows that kind, shift+click shows ONLY that kind, "all" brings everything back.
     Remembered in this browser. Hidden marks are not drawn and cannot be clicked; nothing else changes
     (the AI outline still names a structure from every mark). */
  var LS_HIDE = "ujump_organelleml_hide_v1", ANS = "__answers";
  var HIDE = (function(){ try { return new Set(JSON.parse(localStorage.getItem(LS_HIDE) || "[]")); } catch (_e){ return new Set(); } })();
  function keepHide(){ try { localStorage.setItem(LS_HIDE, JSON.stringify(Array.from(HIDE))); } catch (_e){} }
  function shown(k){ return !HIDE.has(k); }
  function answerShown(c){ return !HIDE.has(ANS) && shown(c.verdict === "no" ? NOT_ORGANELLE : c.k); }
  function chips(host, z){
    if (!host) return;
    if (!LAST || !on()){ host.innerHTML = ""; host.style.display = "none"; return; }
    host.style.display = "";
    var by = {};
    LAST.marks.forEach(function(m){ by[m.k] = (by[m.k] || 0) + 1; });
    var zz = z != null ? z : LAST.z, nAns = CORR.filter(function(c){ return c.t[2] === zz; }).length;
    var ks = Object.keys(by).sort(function(a, b){ return by[b] - by[a]; });
    HIDE.forEach(function(k){ if (k !== ANS && ks.indexOf(k) < 0) ks.push(k); });     // a hidden kind stays offered
    var esc = function(x){ return String(x).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var chip = function(k, label, n, col){
      var off = HIDE.has(k);
      return '<button type="button" class="orgchip" data-k="' + esc(k) + '" title="Click: hide or show. Shift+click: show only this." '
        + 'style="margin:2px 4px 2px 0;padding:1px 8px;border-radius:12px;font-size:11px;cursor:pointer;'
        + 'border:1px solid ' + col + ';background:' + (off ? "transparent" : "rgba(255,255,255,.06)") + ';color:inherit;opacity:' + (off ? 0.4 : 1) + '">'
        + '<span style="color:' + col + '">\u25cf</span> ' + esc(label) + (n ? " " + n : "") + '</button>';
    };
    var h = '<span style="font-size:11px;opacity:.75;margin-right:4px">Show:</span>';
    ks.forEach(function(k){ h += chip(k, nameOf(k).toLowerCase(), by[k] || 0, colourOf(k)); });
    h += chip(ANS, "your answers", nAns, "#ffffff");
    if (HIDE.size) h += '<button type="button" class="orgchip" data-k="__all" style="margin:2px 0;padding:1px 8px;border-radius:12px;font-size:11px;cursor:pointer;border:1px solid var(--accent,#3fb950);background:transparent;color:var(--accent,#3fb950)">all</button>';
    host.innerHTML = h;
    if (!host.__wired){
      host.__wired = true;
      host.addEventListener("click", function(e){
        var b = e.target.closest && e.target.closest(".orgchip"); if (!b) return;
        var k = b.dataset.k;
        if (k === "__all") HIDE.clear();
        else if (e.shiftKey){
          HIDE.clear();
          Array.prototype.forEach.call(host.querySelectorAll(".orgchip"), function(o){ var kk = o.dataset.k; if (kk !== k && kk !== "__all") HIDE.add(kk); });
        } else if (HIDE.has(k)) HIDE.delete(k); else HIDE.add(k);
        keepHide(); chips(host, zz);
        try { document.dispatchEvent(new CustomEvent("ujorgfilter")); } catch (_e){}
      });
    }
  }

  function ring(g, q, col, dashed){
    g.beginPath(); g.arc(q[0], q[1], 7, 0, 6.2832);
    g.setLineDash([]); g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.7)"; g.stroke();
    if (dashed) g.setLineDash([3, 2]);
    g.lineWidth = 1.6; g.strokeStyle = col; g.stroke(); g.setLineDash([]);
  }
  function text(g, q, label, col){
    g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(label, q[0] + 10, q[1]);
    g.fillStyle = col; g.fillText(label, q[0] + 10, q[1]);
  }
  function inView(q, view){ return !(q[0] < -10 || q[1] < -10 || q[0] > view.w + 10 || q[1] > view.h + 10); }
  function paint(g, view, z){
    if (!view) return 0;
    var n = 0, mine = CORR.filter(function(c){ return c.t[2] === z; });
    g.save();
    g.font = "600 11px system-ui, sans-serif";
    g.textBaseline = "middle";
    if (LAST && LAST.marks && LAST.z === z){
      LAST.marks.forEach(function(mk){
        /* A corrected mark is drawn as its correction, below, not twice. */
        if (mine.some(function(c){ return same(c.t, mk.t); })) return;
        if (!shown(mk.k)) return;
        var q = view.pxAt(mk.t);
        if (!inView(q, view)) return;
        var col = colourOf(mk.k);
        ring(g, q, col, false);
        text(g, q, nameOf(mk.k) + " " + Math.round(mk.p * 100) + "%", col);
        n++;
      });
    }
    /* YOUR ANSWERS, in white with a dashed ring, so what you said and what it guessed never look
       alike: ✓ name (it was right), ✗ not an organelle, → name (it is something else, or a miss). */
    mine.forEach(function(c){
      if (!answerShown(c)) return;
      var q = view.pxAt(c.t);
      if (!inView(q, view)) return;
      ring(g, q, "#ffffff", true);
      text(g, q, c.verdict === "ok" ? "\u2713 " + nameOf(c.k)
              : c.verdict === "no" ? "\u2717 not an organelle"
              : c.k === ARTIFACT ? "\u26a0 imaging artifact"
              : "\u2192 " + nameOf(c.k), "#ffffff");
      n++;
    });
    g.restore();
    return n;
  }
  /* WHAT IS THIS OUTLINE? (2026-11-01, Søren: an AI-outlined mitochondrion should be filed as a
     mitochondrion, not as the default whole cell.) The outline model draws edges and knows no names;
     this model knows names. Its marks on this section that fall INSIDE the outline -- or, failing
     that, the nearest within 300 nm of its centre -- say what it is: the most confident one wins.
     Imaging artifacts are not an answer. Runs the model on the view if it has not run there yet. */
  async function kindOf(view, z, points){
    if (!available() || !view) return null;
    var marks = await run(view, {});
    if (!marks) return null;
    var tres = (UJ.emtiles && UJ.emtiles.config && UJ.emtiles.config()) ? UJ.emtiles.config().res : [4, 4, 40];
    var inPoly = function(pt, poly){
      var x = pt[0], y = pt[1], c = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++){
        var a = poly[i], b = poly[j];
        if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
      }
      return c;
    };
    var cx = 0, cy = 0;
    points.forEach(function(p){ cx += p[0]; cy += p[1]; }); cx /= points.length; cy /= points.length;
    var cand = marks.filter(function(m){ return m.t[2] === z && m.k !== ARTIFACT; });
    var inside = cand.filter(function(m){ return inPoly(m.t, points); });
    if (!inside.length) inside = cand.filter(function(m){
      return Math.hypot((m.t[0] - cx) * tres[0], (m.t[1] - cy) * tres[1]) <= 300; });
    if (inside.length){
      inside.sort(function(a, b){ return b.p - a.p; });
      return { k: inside[0].k, p: inside[0].p };
    }
    /* NO MARK THERE -- under a threshold, or merged into a neighbour's mark. The scores themselves:
       every block whose centre falls inside the outline, class probabilities averaged, and the
       best class other than background and artifact, among those the pad shows, if it averages
       at least 0.3 (2026-11-01: "it still shows whole cell mesh as default"). */
    var G = LAST && LAST.grid, M = META;
    if (!G || !M || LAST.z !== z) return null;
    var n = G.h * G.w, sum = new Float64Array(G.C), cnt = 0;
    for (var yy = 0; yy < G.h; yy++) for (var xx = 0; xx < G.w; xx++){
      var px = xx * G.st + G.st / 2, py = yy * G.st + G.st / 2;
      var tp = [(G.x0 + px) * G.res[0] / tres[0], (G.y0 + py) * G.res[1] / tres[1]];
      if (!inPoly(tp, points)) continue;
      var c = yy * G.w + xx, mx = -1e30, k2, sm = 0;
      for (k2 = 0; k2 < G.C; k2++) if (G.logits[k2 * n + c] > mx) mx = G.logits[k2 * n + c];
      var e = new Float64Array(G.C);
      for (k2 = 0; k2 < G.C; k2++){ e[k2] = Math.exp(G.logits[k2 * n + c] - mx); sm += e[k2]; }
      for (k2 = 0; k2 < G.C; k2++) sum[k2] += e[k2] / sm;
      cnt++;
    }
    if (!cnt) return null;
    var bk = -1, bp = 0;
    for (var k3 = 1; k3 < G.C; k3++){
      var name = M.classes[k3];
      if (name === ARTIFACT || (M.show && M.show.indexOf(name) < 0)) continue;
      if (sum[k3] / cnt > bp){ bp = sum[k3] / cnt; bk = k3; }
    }
    return (bk > 0 && bp >= 0.3) ? { k: M.classes[bk], p: bp } : null;
  }
  function summary(){
    if (!LAST) return "";
    var by = {};
    LAST.marks.forEach(function(m){ by[m.k] = (by[m.k] || 0) + 1; });
    var n = LAST.marks.length, hid = LAST.marks.filter(function(m){ return !shown(m.k); }).length;
    return (n ? n + " suggestion" + (n > 1 ? "s" : "") + (hid ? " (" + hid + " hidden)" : "") : "nothing above the thresholds here")
      + " — suggestions from a model, not answers (" + LAST.ms + " ms, " + LAST.ep + (LAST.dark ? ", dark-cell mode" : "") + ")"
      + (CORR.length ? " · " + CORR.length + " answer" + (CORR.length > 1 ? "s" : "") + " of yours (click one to undo or change it)" : "");
  }

  return { configure: configure, source: source, chips: chips, available: available, whenAvailable: whenAvailable, on: on, setOn: setOn, run: run,
           paint: paint, summary: summary, meta: function(){ return META; },
           kindOf: kindOf, markAt: markAt, correct: correct, uncorrect: uncorrect, corrections: corrections, nameOf: nameOf,
           NOT_ORGANELLE: NOT_ORGANELLE, ARTIFACT: ARTIFACT, dark: dark, setDark: setDark, _flatten: flatten,
           _peaks: peaks, _tensorData: tensorData, _last: function(){ return LAST; }, _setLast: function(x){ LAST = x; } };
})();
