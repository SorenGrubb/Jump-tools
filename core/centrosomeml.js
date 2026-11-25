/* core/centrosomeml.js — the tracing pad finds centrosomes and cilium bases.          2026-11-25

   Søren: *"Regarding the ML training of centrioles. It does not work. The reason is that I have placed
   the annotation coordinate for centrioles in between the two centrioles ... Could we somehow make a
   different way of analysing the planes above and below the centriole coordinate ...?"*

   WHAT THE MODEL IS (centrosome_ml_train_v1.ipynb, beside this repo)
     11 sections in -- every second one, +-400 nm around a centre section -- at 16 nm, raw 0-255 (the
     network normalises its own input). Two maps out at 64 nm cells: "the centre of a centrosome is
     here" and "a cilium leaves its mother centriole here". It learned from Søren's own 12,420
     centrosome marks and ~4,500 cilium bases plus the community's checked reports.

   HOW THE PAD USES IT
     One press searches what the pad shows (capped at 640 px = 10 um a side) from 24 sections below
     to 24 above the current one: the model runs with every fourth section as its centre, the maps
     are stacked, and the strongest cells that beat the threshold, one per 600 nm in 3D, are the
     finds. On held-out tissue (4 x 4 um windows, +-1 um): at 0.70 it found 81% of centrosomes and
     84% of cilium bases, median 120 nm from the mark, with ~0.7 extra peaks per window -- some of
     them neighbours' unmarked centrosomes. Every find is a suggestion to confirm or reject.

   HOST CONTRACT
     UJ.centrosomeml.configure({ base: "models/centrosome/minnie65/" })   // probes for model.json
     UJ.centrosomeml.available() / whenAvailable()
     UJ.centrosomeml.find(view, z, { say, dz }) -> Promise<[{ k, p, t:[x,y,z] }]>   // view from drawSection
     UJ.centrosomeml.meta()
   It shares onnxruntime-web and the page-wide model queue (window.__ujOrtTurn) with
   core/organelleml.js, so the two never run at the same time. */
var UJ = UJ || {};
UJ.centrosomeml = (function(){
  "use strict";
  var ORT_VER = "1.19.2";
  var ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@" + ORT_VER + "/dist/";
  var ORT_JS = ORT_BASE + "ort.webgpu.min.js";
  var CFG = { base: "", ok: false, probe: null };
  var META = null, SESSION = null, LOADING = null, EP = "";
  var MAX_SIDE = 640;          // px at the model's 16 nm: 10 um
  var CENTRE_STEP = 4;         // sections between centres (160 nm); the maps are 300 nm deep
  var EDGE_CELLS = 3;          // the outermost 192 nm of the field has no context: no finds there

  function configure(cfg){
    cfg = cfg || {};
    var b = String(cfg.base || ""); if (b && b.slice(-1) !== "/") b += "/";
    if (b !== CFG.base){ META = null; SESSION = null; LOADING = null; }
    CFG.base = b; CFG.ok = false;
    if (cfg.ortBase){ ORT_BASE = cfg.ortBase; ORT_JS = cfg.ortJs || (ORT_BASE + "ort.webgpu.min.js"); }
    CFG.probe = (async function(){
      if (!b) return false;
      try { var r = await fetch(b + "model.json", { method: "HEAD", cache: "no-cache" }); CFG.ok = r.ok; }
      catch (_e){ CFG.ok = false; }
      return CFG.ok;
    })();
    return CFG.probe;
  }
  function available(){ return !!(CFG.base && CFG.ok); }
  function whenAvailable(){ return CFG.probe || Promise.resolve(false); }
  function meta(){ return META; }

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
  function load(say){
    if (SESSION) return Promise.resolve(SESSION);
    if (LOADING) return LOADING;
    LOADING = (async function(){
      if (!CFG.base) throw new Error("no centrosome model is set up for this dataset");
      if (say) say("reading the centrosome model…");
      var r = await fetch(CFG.base + "model.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("the centrosome model's description could not be read (" + r.status + ")");
      var m = await r.json();
      if (!m || m.kind !== "centrosome_finder" || !m.input || !m.output) throw new Error("model.json is not a centrosome model this page understands");
      await loadScript(ORT_JS);
      var ort = window.ort;
      try { if (!ort.env.wasm.wasmPaths) ort.env.wasm.wasmPaths = ORT_BASE; } catch (_e){}
      if (say) say("starting the centrosome model (about 14 MB, once)…");
      var url = CFG.base + (m.onnx || "model.onnx"), sess = null, err = null;
      var eps = (navigator.gpu ? [["webgpu"], ["wasm"]] : [["wasm"]]);
      for (var i = 0; i < eps.length && !sess; i++){
        try { sess = await ort.InferenceSession.create(url, { executionProviders: eps[i] }); EP = eps[i][0]; }
        catch (e){ err = e; }
      }
      if (!sess) throw new Error("the centrosome model could not start: " + String(err && err.message || err));
      META = m; SESSION = sess;
      return sess;
    })();
    LOADING.catch(function(){ LOADING = null; });
    return LOADING;
  }
  function ortTurn(fn){
    var prev = window.__ujOrtTurn || Promise.resolve();
    var p = prev.then(fn, fn);
    window.__ujOrtTurn = p.catch(function(){});
    return p;
  }
  function engineError(e){ return /memory|out of bounds|abort|RuntimeError|wasm/i.test(String(e && e.message || e)); }
  async function runSafe(feeds, say){
    try { return await ortTurn(function(){ return SESSION.run(feeds); }); }
    catch (e){
      if (!engineError(e)) throw e;
      try { if (SESSION && SESSION.release) await SESSION.release(); } catch (_e){}
      SESSION = null; LOADING = null;
      await load(say);
      try { return await ortTurn(function(){ return SESSION.run(feeds); }); }
      catch (e2){ throw new Error("The AI engine in this browser tab ran out of memory (" + String(e2 && e2.message || e2)
        + "). Reload the page — your tracing is kept as a draft — and try again."); }
    }
  }

  async function mipFor(nm){
    var first = await UJ.emtiles.scaleAt(0, false);
    for (var i = 0; i < first.count; i++){
      var s = await UJ.emtiles.scaleAt(i, false);
      if (Math.abs(s.scale.resolution[0] - nm) < 0.01) return i;
    }
    return -1;
  }
  function seenFrac(pl){ var c = 0; for (var i = 0; i < pl.seen.length; i++) if (pl.seen[i]) c++; return c / Math.max(1, pl.seen.length); }

  /* A run asked for while another is going replaces it: the older one stops at its next section. */
  var TOKEN = 0;
  async function find(view, z, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    var my = ++TOKEN;
    await load(say);
    var m = META, nm = m.input.nm, tres = UJ.emtiles.config().res;
    if (Math.abs(tres[2] - m.input.zNm) > 0.5) throw new Error("this model was trained on " + m.input.zNm + " nm sections; this volume's are " + tres[2] + " nm");
    var mip = await mipFor(nm);
    if (mip < 0) throw new Error("this volume has no " + nm + " nm level for the model to read");
    var a = view.toolAt(0, 0), b = view.toolAt(view.w, view.h);
    var mult = m.input.multipleOf || 16;
    var side = function(d, r){ return Math.max(mult * 4, Math.floor(Math.min(MAX_SIDE, Math.abs(d) * r / nm) / mult) * mult); };
    var W = side(b[0] - a[0], tres[0]), H = side(b[1] - a[1], tres[1]);
    var centre = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), z];
    var dz = opts.dz != null ? opts.dz : ((m.peaks && m.peaks.searchDzSections) || 24);
    var offs = m.input.zOffsets, NCH = offs.length;
    var centres = [];
    for (var c = -dz; c <= dz; c += CENTRE_STEP) centres.push(c);
    var need = {};
    centres.forEach(function(c){ offs.forEach(function(o){ need[c + o] = 1; }); });
    var keys = Object.keys(need).map(Number).sort(function(p, q){ return Math.abs(p) - Math.abs(q) || p - q; });   // centre outward

    /* 1. the sections, read four at a time through the pad's own reader and chunk cache */
    var planes = {}, done = 0, geo = null;
    async function readOne(o){
      var cv = document.createElement("canvas");
      var v = await UJ.emtiles.drawSection(cv, { centre: [centre[0], centre[1], z + o], mip: mip, zoom: 1, w: W, h: H, lo: 0, hi: 255 });
      planes[o] = { raw: v.raw, seen: v.seen, w: v.vw, h: v.vh, x0: v.x0, y0: v.y0, res: v.resNm };
      if (o === 0 || !geo) geo = planes[o];
      done++;
      if (my === TOKEN) say("reading section " + done + " of " + keys.length + "…");
    }
    var q = keys.slice();
    async function worker(){ while (q.length){ if (my !== TOKEN) return; var o = q.shift(); try { await readOne(o); } catch (_e){ done++; } } }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (my !== TOKEN) return null;
    var P0 = planes[0];
    if (!P0) throw new Error("this section could not be read");
    var w = P0.w, h = P0.h;
    var Wt = Math.floor(w / mult) * mult, Ht = Math.floor(h / mult) * mult;
    var good = {};
    keys.forEach(function(o){ var p = planes[o]; good[o] = !!(p && p.w === w && p.h === h && seenFrac(p) >= 0.5); });
    var means = {};
    keys.forEach(function(o){
      if (!good[o]) return;
      var p = planes[o], s = 0, n = 0;
      for (var i = 0; i < p.raw.length; i++) if (p.seen[i]){ s += p.raw[i]; n++; }
      means[o] = n ? s / n : 128;
    });

    /* 2. the model, every CENTRE_STEP sections */
    var stride = m.output.stride, cc = m.output.cellCentre != null ? m.output.cellCentre : (stride - 1) / 2;
    var oh = Ht / stride, ow = Wt / stride;
    var heads = m.output.heads, thr = m.padThresholds || m.thresholds;
    var thrMin = heads.map(function(k){ return thr[k] != null ? thr[k] : 0.7; });
    var cand = heads.map(function(){ return []; });
    var data = new Float32Array(NCH * Wt * Ht);
    for (var ci = 0; ci < centres.length; ci++){
      if (my !== TOKEN) return null;
      var c0 = centres[ci];
      if (!good[c0]) continue;
      say("looking for centrioles: " + (ci + 1) + " of " + centres.length + " depths…");
      for (var ch = 0; ch < NCH; ch++){
        var o = c0 + offs[ch];
        /* a missing section: the nearest good one on the way to the centre (as in training) */
        while (!good[o] && o !== c0) o += (o < c0 ? 2 : -2);
        var p = planes[o], mu = means[o], base = ch * Wt * Ht;
        for (var y = 0; y < Ht; y++) for (var x = 0; x < Wt; x++){
          var k = y * w + x;
          data[base + y * Wt + x] = p.seen[k] ? p.raw[k] : mu;
        }
      }
      var feeds = {}; feeds[m.input.name || "em"] = new window.ort.Tensor("float32", data, [1, NCH, Ht, Wt]);
      var out = await runSafe(feeds, say);
      var M = out[m.output.name || "maps"] || out[Object.keys(out)[0]];
      var md = M.data, pc = planes[c0];
      for (var hd = 0; hd < heads.length; hd++){
        var off = hd * oh * ow;
        for (var yy = EDGE_CELLS; yy < oh - EDGE_CELLS; yy++) for (var xx = EDGE_CELLS; xx < ow - EDGE_CELLS; xx++){
          var v = md[off + yy * ow + xx];
          if (v < thrMin[hd]) continue;
          var px = xx * stride + cc, py = yy * stride + cc;
          if (!pc.seen[Math.round(py) * w + Math.round(px)]) continue;
          cand[hd].push({ p: v, px: px, py: py, dz: c0 });
        }
      }
    }
    /* 3. one find per thing: the strongest, and nothing else of that kind within nmsNm in 3D */
    var nms = (m.peaks && m.peaks.nmsNm) || 600, res = P0.res;
    var finds = [];
    cand.forEach(function(list, hd){
      list.sort(function(p, q){ return q.p - p.p; });
      var kept = [];
      list.forEach(function(c){
        for (var i = 0; i < kept.length; i++){
          var dx = (c.px - kept[i].px) * res[0], dy = (c.py - kept[i].py) * res[1], dzn = (c.dz - kept[i].dz) * tres[2];
          if (dx * dx + dy * dy + dzn * dzn < nms * nms) return;
        }
        kept.push(c);
      });
      kept.forEach(function(c){
        finds.push({ k: heads[hd], p: c.p,
          t: [Math.round((P0.x0 + c.px) * res[0] / tres[0]), Math.round((P0.y0 + c.py) * res[1] / tres[1]), z + c.dz] });
      });
    });
    finds.sort(function(p, q){ return q.p - p.p; });
    return finds;
  }
  function cancel(){ TOKEN++; }
  return { configure: configure, available: available, whenAvailable: whenAvailable, meta: meta, find: find, cancel: cancel,
           load: load, _set: function(o){ if (o.maxSide) MAX_SIDE = o.maxSide; if (o.centreStep) CENTRE_STEP = o.centreStep; } };
})();
