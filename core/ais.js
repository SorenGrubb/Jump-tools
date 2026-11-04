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
  function cached(nid) {
    if (!META) return undefined;
    var k = shardOf(nid);
    if (!SHARD[k]) return undefined;
    return SHARD[k][String(nid)] || null;
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
             annotationColor: COLOR, name: "Axon initial segment (computed)" };
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function describe(a) {
    var ends = a.e === "branch" ? "ends at the axon's first branch point"
             : a.e === "tip" ? "ends where the axon's skeleton ends"
             : "unbranched past " + ((META && META.maxUm) || 40) + " µm, so cut there";
    var from = a.fd ? "leaves a <b>dendrite</b> " + (+a.d).toFixed(0) + " µm from the soma"
                    : "leaves the soma";
    return "<b>" + (+a.L).toFixed(0) + " µm</b>, " + from + "; " + ends + "." + (a.pa ? "" : " The axon is not proofread, so treat it as a guide.");
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
  window.UJ.ais = { configure: configure, get: get, cached: cached, layer: layer, panel: panel, describe: describe, COLOR: COLOR, _meta: function () { return META; } };
})();
