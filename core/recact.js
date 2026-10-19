/* core/recact.js -- MICrONS RECORDED ACTIVITY for the tool pages (2026-10-19)
   Søren: "Could we somehow mark which cells are active during which part of the movie. Perhaps also
   in the cell identity card, so we can see before and after adding it to the VR. I guess we should
   have it also as a filter in Filter and show."

   Reads data/microns_activity/v1/index.json (made from the bake of DANDI:000402 by
   microns_activity_bake.ipynb): for every co-registered neuron (manual co-registration), its best
   oracle score and a 60-character ACTIVITY CODE -- 6 oracle clips x 10 one-second bins, each
   character base-36 of floor(2*z), z = that second's mean response over the 10 repeats (robust z
   of the raw fluorescence against the whole scan). So level 4 = z >= 2.

   UJ.recact.load()            -> Promise of the index (fetched once; null if absent)
   UJ.recact.ready()           -> true once loaded
   UJ.recact.get(root)         -> { os, n, code, s, sc, u } or null
   UJ.recact.levels(e)         -> 60 numbers, z rounded down to 0.5 steps
   UJ.recact.active(e, z, clips, t0, t1) -> true if any second in those clips (indices; empty = all)
                                   and that time window has mean z >= z
   UJ.recact.spans(e, z)       -> [{ clip, from, to, peak }] the runs of seconds at or above z
   UJ.recact.barcodeSvg(e, opt)-> an SVG: one row per clip, one square per second, coloured by z
   UJ.recact.clips             -> [{ movie, kind, duration }] once loaded */
(function(){
  const UJ = window.UJ = window.UJ || {};
  const A = "0123456789abcdefghijklmnopqrstuvwxyz";
  const R = { idx: null, p: null, base: "data/microns_activity/v1/" };
  function load(base){
    if (base) R.base = base;
    if (!R.p) R.p = fetch(R.base + "index.json").then(r => r.ok ? r.json() : null).then(j => {
      R.idx = j && j.roots ? j : null;
      if (R.idx) api.clips = R.idx.clips || [];
      try { document.dispatchEvent(new CustomEvent("recact:ready")); } catch (e){}
      return R.idx;
    }).catch(() => (R.idx = null));
    return R.p;
  }
  function get(root){
    if (!R.idx || root == null) return null;
    const v = R.idx.roots[String(root)]; if (!v) return null;
    return { os: v[0], n: v[1], code: v[2], s: v[3], sc: v[4], u: v[5] };
  }
  function levels(e){ const out = []; for (let i = 0; i < e.code.length; i++) out.push(A.indexOf(e.code[i]) / 2); return out; }
  function active(e, z, clips, t0, t1){
    const L = levels(e), cs = clips && clips.length ? clips : [0, 1, 2, 3, 4, 5];
    const a = Math.max(0, Math.floor(t0 == null ? 0 : t0)), b = Math.min(10, Math.ceil(t1 == null ? 10 : t1));
    for (const k of cs) for (let s = a; s < b; s++) if (L[k * 10 + s] >= z) return true;
    return false;
  }
  function spans(e, z){
    const L = levels(e), out = [];
    for (let k = 0; k < 6; k++){
      let st = -1, pk = 0;
      for (let s = 0; s <= 10; s++){
        const on = s < 10 && L[k * 10 + s] >= z;
        if (on){ if (st < 0){ st = s; pk = 0; } pk = Math.max(pk, L[k * 10 + s]); }
        else if (st >= 0){ out.push({ clip: k, from: st, to: s, peak: pk }); st = -1; }
      }
    }
    return out;
  }
  /* Dark → teal → green → yellow, as z goes 0 → 5+ (one colour scale on every page). */
  function colour(z){
    const t = Math.max(0, Math.min(1, z / 5));
    const stops = [[13, 17, 23], [20, 90, 90], [60, 190, 90], [250, 230, 80]];
    const x = t * 3, i = Math.min(2, Math.floor(x)), f = x - i, a = stops[i], b = stops[i + 1];
    return "rgb(" + a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",") + ")";
  }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function barcodeSvg(e, opt){
    opt = opt || {};
    const L = levels(e), sq = opt.sq || 13, gap = 2, lab = opt.labels === false ? 0 : 150, W = lab + 10 * (sq + gap), H = 6 * (sq + gap) + 16;
    const C = api.clips || [];
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="font:11px system-ui,sans-serif;display:block">';
    for (let k = 0; k < 6; k++){
      const y = k * (sq + gap), c = C[k] || {};
      if (lab) s += '<text x="0" y="' + (y + sq - 2) + '" fill="currentColor" opacity="0.8">' + (k + 1) + '. ' + esc((m => m.length > 21 ? m.slice(0, 20) + "…" : m)(String(c.movie || "clip " + (k + 1)).split(" (")[0])) + '</text>';
      for (let t = 0; t < 10; t++){
        const z = L[k * 10 + t];
        s += '<rect x="' + (lab + t * (sq + gap)) + '" y="' + y + '" width="' + sq + '" height="' + sq + '" rx="2" fill="' + colour(z) + '"'
          + (opt.z != null && z >= opt.z ? ' stroke="#ffffff" stroke-width="1.2"' : '')
          + '><title>Clip ' + (k + 1) + ', ' + t + '–' + (t + 1) + ' s: z ' + (z >= 17.5 ? "≥ 17.5" : "≈ " + z.toFixed(1)) + '</title></rect>';
      }
    }
    const y = 6 * (sq + gap) + 11;
    s += '<text x="' + lab + '" y="' + y + '" fill="currentColor" opacity="0.6">0 s</text><text x="' + (lab + 10 * (sq + gap) - 22) + '" y="' + y + '" fill="currentColor" opacity="0.6">10 s</text></svg>';
    return s;
  }
  const api = UJ.recact = { load, ready: () => !!R.idx, get, levels, active, spans, colour, barcodeSvg, clips: [] };
})();
