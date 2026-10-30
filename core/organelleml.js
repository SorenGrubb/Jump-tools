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

  function configure(cfg){
    cfg = cfg || {};
    var b = String(cfg.base || "");
    if (b && b.slice(-1) !== "/") b += "/";
    if (b !== CFG.base){ META = null; SESSION = null; LOADING = null; LAST = null; }
    CFG.base = b;
    if (cfg.ortBase){ ORT_BASE = cfg.ortBase; ORT_JS = cfg.ortJs || (ORT_BASE + "ort.webgpu.min.js"); }
    /* IS THERE A MODEL YET? One small request per page, so the tick only appears once a model has
       actually been trained and uploaded: until then a box that can only say "nothing here" is
       noise on every reader's pad. */
    CFG.ok = false;
    CFG.probe = !b ? Promise.resolve(false)
      : fetch(b + "model.json", { method: "HEAD", cache: "no-cache" })
          .then(function(r){ CFG.ok = !!r.ok; return CFG.ok; })
          .catch(function(){ CFG.ok = false; return false; });
    return CFG.probe;
  }
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
  function tensorData(pl, m){
    var mult = m.inputMultiple || 16;
    var W = Math.ceil(pl.w / mult) * mult, H = Math.ceil(pl.h / mult) * mult;
    var d = new Float32Array(W * H), mean = m.mean, sd = m.std || 1;
    for (var y = 0; y < pl.h; y++){
      for (var x = 0; x < pl.w; x++){
        var o = y * pl.w + x;
        d[y * W + x] = pl.seen[o] ? (pl.raw[o] - mean) / sd : 0;
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
  function run(view, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    var my = ++TOKEN;
    var p = QUEUE.then(async function(){
      if (my !== TOKEN) return null;
      await load(say);
      if (my !== TOKEN) return null;
      var m = META;
      var key = [view.z, view.x0, view.y0, view.vw, view.vh, view.resNm && view.resNm[0], m.nm].join(":");
      if (LAST && LAST.key === key) return LAST.marks;
      say("looking for organelles…");
      var pl = await planeFor(view, m.nm);
      if (my !== TOKEN) return null;
      var td = tensorData(pl, m);
      var ort = window.ort;
      var feeds = {};
      feeds[SESSION.inputNames[0]] = new ort.Tensor("float32", td.data, [1, 1, td.H, td.W]);
      var t0 = performance.now();
      var res = await SESSION.run(feeds);
      var o = res[SESSION.outputNames[0]];
      var C = o.dims[1], h = o.dims[2], w = o.dims[3];
      var found = peaks(o.data, C, h, w, m, pl).map(function(k){
        return { k: k.k, p: k.p, t: toTool(pl, k.px, k.py, view.z) };
      });
      LAST = { key: key, marks: found, z: view.z, ms: Math.round(performance.now() - t0), ep: EP };
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
  var CORR = [];
  var NOT_ORGANELLE = "not_an_organelle";
  /* A FOLD, A KNIFE MARK, DIRT, A CRACK IN THE RESIN -- Søren, 2026-10-30: "We should be able to
     label artifacts, so that they will be recognized as not being organelles." Its own kind rather
     than "not an organelle": once there are enough, the model learns artifacts as a class of their
     own -- worth showing a beginner too -- and until then the notebook counts them as background. */
  var ARTIFACT = "imaging_artifact";
  function same(a, b){ return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function markAt(view, px, py, z, radius){
    var r = radius || 14, best = null, bd = r * r;
    var all = (LAST && LAST.z === z ? LAST.marks : []).concat(CORR.filter(function(c){ return c.t[2] === z; }));
    all.forEach(function(mk){
      var q = view.pxAt(mk.t), d = (q[0] - px) * (q[0] - px) + (q[1] - py) * (q[1] - py);
      if (d <= bd){ bd = d; best = mk; }
    });
    return best;
  }
  function correct(c){
    CORR = CORR.filter(function(o){ return !same(o.t, c.t); });
    CORR.push(c);
    return CORR.length;
  }
  function corrections(){ return CORR.slice(); }

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
  function summary(){
    if (!LAST) return "";
    var by = {};
    LAST.marks.forEach(function(m){ by[m.k] = (by[m.k] || 0) + 1; });
    var parts = Object.keys(by).sort(function(a, b){ return by[b] - by[a]; })
      .map(function(k){ return by[k] + "× " + nameOf(k).toLowerCase(); });
    return (parts.length ? parts.join(", ") : "nothing above the thresholds here")
      + " — suggestions from a model, not answers (" + LAST.ms + " ms, " + LAST.ep + ")"
      + (CORR.length ? " · " + CORR.length + " correction" + (CORR.length > 1 ? "s" : "") + " sent this visit" : "");
  }

  return { configure: configure, available: available, whenAvailable: whenAvailable, on: on, setOn: setOn, run: run,
           paint: paint, summary: summary, meta: function(){ return META; },
           markAt: markAt, correct: correct, corrections: corrections, nameOf: nameOf,
           NOT_ORGANELLE: NOT_ORGANELLE, ARTIFACT: ARTIFACT,
           _peaks: peaks, _tensorData: tensorData, _last: function(){ return LAST; } };
})();
