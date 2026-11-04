/* ── SKELETONS, READ STRAIGHT FROM MICRONS' PUBLIC BUCKET ─────────────────────────  2026-11-04
   Søren: "is there somehow I don't need to save the skeletons on a server but can read them from the
   CAVE server?" -- The CAVE server wants a token from every reader, but MICrONS also publishes the
   v1300 skeletons as plain SWC files, no sign-in, in the same root ids as µJump's segmentation
   (seg_m1300), and the bucket answers a web page (checked from grubblab.com, 2026-11-04):

     storage.googleapis.com/microns-static-links/skel/swc/proofread/<root>.swc   proofread cells, with the axon
     storage.googleapis.com/microns-static-links/skel/swc/dendrite/<root>.swc    every other cell, axon removed

   SWC node types: 1 soma, 2 axon, 3 basal dendrite, 4 apical dendrite. Coordinates are read as µm
   (nm if they are too large to be µm), and kept in µm here -- the VR scene's own unit.

     UJ.skel.get(root)            -> Promise<{kind, n, pos (µm, xyz), par, type, rad} | null>
     UJ.skel.cached(root)         -> the same, or undefined if not read yet
     UJ.skel.segments(sk, maxN)   -> [[a, b, type], ...] thinned so there are at most maxN
     UJ.skel.ngLayers(sk, res)    -> Neuroglancer annotation layers (one per node type), in voxels of res
     UJ.skel.threeLines(sk, THREE)-> a THREE.LineSegments in µm, coloured by node type */
(function () {
  window.UJ = window.UJ || {};
  var BASE = "https://storage.googleapis.com/microns-static-links/skel/swc/";
  var API = "https://storage.googleapis.com/storage/v1/b/microns-static-links/o/";
  var KINDS = ["proofread", "dendrite"];
  var CACHE = {}, PROM = {};
  var COLOR = { 1: "#ffffff", 2: "#ff6b6b", 3: "#4fc3f7", 4: "#c792ea", 0: "#b0bec5" };
  var NAME = { 1: "soma", 2: "axon", 3: "basal dendrite", 4: "apical dendrite", 0: "other" };

  function parse(txt) {
    var ids = [], type = [], x = [], r = [], pid = [];
    var lines = txt.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (!l || l[0] === "#") continue;
      var f = l.split(/\s+/);
      if (f.length < 7) continue;
      ids.push(+f[0]); type.push(+f[1] | 0); x.push(+f[2], +f[3], +f[4]); r.push(+f[5]); pid.push(+f[6]);
    }
    var n = ids.length; if (!n) return null;
    var idx = {}; for (var k = 0; k < n; k++) idx[ids[k]] = k;
    var mx = 0; for (k = 0; k < x.length; k++) mx = Math.max(mx, Math.abs(x[k]));
    var s = mx > 20000 ? 0.001 : 1;                      // nm -> µm; MICrONS' SWCs are µm
    var pos = new Float32Array(n * 3), par = new Int32Array(n), tp = new Uint8Array(n), rad = new Float32Array(n);
    for (k = 0; k < n; k++) {
      pos[k * 3] = x[k * 3] * s; pos[k * 3 + 1] = x[k * 3 + 1] * s; pos[k * 3 + 2] = x[k * 3 + 2] * s;
      par[k] = pid[k] in idx ? idx[pid[k]] : -1; tp[k] = type[k] > 4 ? 0 : type[k]; rad[k] = r[k] * s;
    }
    return { n: n, pos: pos, par: par, type: tp, rad: rad };
  }
  function grab(path) {
    return fetch(BASE + path).then(function (r) { return r.ok ? r.text() : null; }, function () {
      // the same object through the JSON API, which certainly answers a web page
      return fetch(API + encodeURIComponent("skel/swc/" + path) + "?alt=media").then(function (r) { return r.ok ? r.text() : null; }, function () { return null; });
    });
  }
  function get(root) {
    root = String(root || "");
    if (!/^\d+$/.test(root)) return Promise.resolve(null);
    if (root in CACHE) return Promise.resolve(CACHE[root]);
    if (!PROM[root]) PROM[root] = (async function () {
      for (var i = 0; i < KINDS.length; i++) {
        var t = await grab(KINDS[i] + "/" + root + ".swc");
        if (t) { var sk = parse(t); if (sk) { sk.kind = KINDS[i]; sk.root = root; CACHE[root] = sk; return sk; } }
      }
      CACHE[root] = null; return null;
    })();
    return PROM[root];
  }
  function cached(root) { root = String(root || ""); return root in CACHE ? CACHE[root] : undefined; }

  /* Keep the root, tips, branch points, type changes and one node per `step` µm of path; choose the
     step so there are at most maxN segments (a proofread axon can be tens of millimetres). */
  function segments(sk, maxN) {
    maxN = maxN || 3000;
    var n = sk.n, P = sk.pos, par = sk.par, T = sk.type, kids = new Int32Array(n), len = 0, k;
    for (k = 0; k < n; k++) if (par[k] >= 0) {
      kids[par[k]]++;
      var a = par[k]; len += Math.hypot(P[k * 3] - P[a * 3], P[k * 3 + 1] - P[a * 3 + 1], P[k * 3 + 2] - P[a * 3 + 2]);
    }
    var step = Math.max(0.5, len / maxN);
    // nodes in an order where every parent comes first
    var order = [], seen = new Uint8Array(n), ch = []; for (k = 0; k < n; k++) ch.push([]);
    for (k = 0; k < n; k++) if (par[k] >= 0) ch[par[k]].push(k);
    for (k = 0; k < n; k++) if (par[k] < 0) { var st = [k]; while (st.length) { var v = st.pop(); if (seen[v]) continue; seen[v] = 1; order.push(v); for (var j = 0; j < ch[v].length; j++) st.push(ch[v][j]); } }
    var keepAt = new Int32Array(n).fill(-1), since = new Float32Array(n), out = [];
    for (var o = 0; o < order.length; o++) {
      var b = order[o], p = par[b];
      if (p < 0) { keepAt[b] = b; continue; }
      var d = Math.hypot(P[b * 3] - P[p * 3], P[b * 3 + 1] - P[p * 3 + 1], P[b * 3 + 2] - P[p * 3 + 2]);
      var anc = keepAt[p] === p ? p : keepAt[p];               // the last kept node above b
      since[b] = (keepAt[p] === p ? 0 : since[p]) + d;
      if (kids[b] !== 1 || T[b] !== T[p] || since[b] >= step) { keepAt[b] = b; out.push([anc, b, T[b]]); }
      else keepAt[b] = anc;
    }
    return out;
  }
  function ngLayers(sk, res, maxN) {
    res = res || [4, 4, 40];
    var segs = segments(sk, maxN || 2500), by = {}, P = sk.pos;
    function vox(i) { return [Math.round(P[i * 3] * 1000 / res[0]), Math.round(P[i * 3 + 1] * 1000 / res[1]), Math.round(P[i * 3 + 2] * 1000 / res[2])]; }
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], t = s[2];
      (by[t] = by[t] || []).push({ type: "line", id: "k" + i, pointA: vox(s[0]), pointB: vox(s[1]) });
    }
    return Object.keys(by).map(function (t) {
      return { type: "annotation", source: "local://annotations", tab: "annotations", annotations: by[t],
               annotationColor: COLOR[t] || COLOR[0], name: "Skeleton: " + (NAME[t] || "other") };
    });
  }
  function threeLines(sk, THREE, maxN) {
    var segs = segments(sk, maxN || 20000), P = sk.pos;
    var pos = new Float32Array(segs.length * 6), col = new Float32Array(segs.length * 6), c = new THREE.Color();
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i]; c.set(COLOR[s[2]] || COLOR[0]);
      for (var e = 0; e < 2; e++) {
        var v = s[e]; pos[i * 6 + e * 3] = P[v * 3]; pos[i * 6 + e * 3 + 1] = P[v * 3 + 1]; pos[i * 6 + e * 3 + 2] = P[v * 3 + 2];
        col[i * 6 + e * 3] = c.r; col[i * 6 + e * 3 + 1] = c.g; col[i * 6 + e * 3 + 2] = c.b;
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
  }
  function describe(sk) {
    var cnt = {}; for (var k = 0; k < sk.n; k++) cnt[sk.type[k]] = 1;
    return sk.kind === "proofread" ? "proofread, axon included" : "dendrites only (the axon is not proofread, so MICrONS leaves it out)";
  }
  /* µJump's cell panel: one row and a button. The skeleton is read only when the button is pressed, and
     from then on every Neuroglancer link for that cell carries it (buildState asks wanted()). */
  var WANT = {};
  function wanted(root) { return !!WANT[String(root)]; }
  function panel(root) {
    root = String(root || "");
    var np = document.getElementById("nucpanel"); if (!np || !/^\d+$/.test(root)) return;
    var host = document.getElementById("skelRow");
    if (!host) {
      host = document.createElement("div"); host.id = "skelRow"; host.className = "meta";
      var after = np.querySelector("#aisRow") || np.querySelector("#commReports");
      if (after && after.parentNode) after.parentNode.insertBefore(host, after.nextSibling); else np.appendChild(host);
    }
    var sk = cached(root), warn = "";
    /* A CHECK ON THE FRAME: the skeleton's soma should sit on this cell's nucleus. */
    var nc = window.CUR_NUC_CENTER_VOX, res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
    if (sk && nc) {
      var s0 = 0; for (var k = 0; k < sk.n; k++) if (sk.par[k] < 0) { s0 = k; break; }
      var d = Math.hypot(sk.pos[s0 * 3] - nc[0] * res[0] / 1000, sk.pos[s0 * 3 + 1] - nc[1] * res[1] / 1000, sk.pos[s0 * 3 + 2] - nc[2] * res[2] / 1000);
      if (d > 40) warn = ' <span style="color:#f0883e">\u26a0 its soma is ' + d.toFixed(0) + ' \u00b5m from this nucleus</span>';
    }
    /* "Skeleton" IS the link (Søren, 2026-11-04: "should just be a link for the Skeleton part of the text
       instead of a button"), styled like the panel's other links (.idf-back, "Log one →"). */
    var label = sk === null ? '<b>Skeleton</b>'
      : '<a href="#" class="skelview idf-back" data-root="' + root + '" style="margin:0;font-size:inherit;font-weight:700" '
      + 'title="Opens Neuroglancer with the cell\u2019s skeleton drawn over it (read from MICrONS\u2019 public files): '
      + 'red axon, blue basal dendrites, purple apical dendrite">Skeleton \u2197</a>';
    host.innerHTML = label + ' <span class="nsub">(MICrONS v1300' + (sk ? ", " + describe(sk) : sk === null ? ": none published for this root id" : "") + ')</span>' + warn;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".skelview");
    if (!b || typeof neuroglancerLinkForPos !== "function") return;
    e.preventDefault();
    if (b.dataset.busy) return; b.dataset.busy = "1";
    var root = b.dataset.root, w = window.open("", "_blank");       // opened now, so no pop-up blocker
    b.textContent = "Skeleton (reading\u2026)";
    get(root).then(function (sk) {
      if (!sk) { if (w) w.close(); panel(root); return; }
      WANT[root] = true; panel(root);
      var url = neuroglancerLinkForPos(window.CUR_POS);
      if (w && url) w.location = url; else if (url) window.open(url, "_blank");
    });
  });
  window.UJ.skel = { get: get, wanted: wanted, panel: panel, cached: cached, segments: segments, ngLayers: ngLayers, threeLines: threeLines,
                     describe: describe, COLOR: COLOR, NAME: NAME, _parse: parse };
})();
