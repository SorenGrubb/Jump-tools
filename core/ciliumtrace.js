/* core/ciliumtrace.js — a primary cilium from its base and tip: a skeleton, then its outline.  2026-11-25

   Søren: *"Can we build the cilia tracing now? Could be cool if it first builds a skeleton for the
   cilium after the base and tip have been reported. Then the user corrects the skeleton or accepts
   it and then it traces the outline of the cilium."*

     SKELETON  base -> the person's pins -> tip, straight between them (v3; see straight() for why the
               automatic followers were taken out). A pin is a click on the cilium on some section.
     OUTLINE   on every section the skeleton crosses, rays from the skeleton (all round where it
               crosses the section, sideways and round the ends where it lies in the section) find
               the cilium's edge -- the strongest dark-to-light step outward between 60 and 220 nm --
               smoothed across neighbouring rays. Ordinary contours: editable like any other.

   HOST CONTRACT
     UJ.ciliumtrace.straight(base, tip, pins) -> { nodes:[[x,y,z] tool voxels, z may be fractional], lengthNm }
     UJ.ciliumtrace.outline(nodes, { say }) -> Promise<[{ z, points:[[x,y] tool voxels] }]>
   It reads through UJ.emtiles.drawSection at 16 nm, like the pad's other AI tools. */
var UJ = UJ || {};
UJ.ciliumtrace = (function(){
  "use strict";
  var NM = 16;                 // read resolution
  var MAX_SIDE = 1100;         // px at 16 nm: ~17 um
  var MARGIN_NM = 900, MARGIN_Z = 6;
  var BOX = null;              // the last read block, reused by outline()

  async function mipFor(nm){
    var first = await UJ.emtiles.scaleAt(0, false);
    for (var i = 0; i < first.count; i++){
      var s = await UJ.emtiles.scaleAt(i, false);
      if (Math.abs(s.scale.resolution[0] - nm) < 0.01) return i;
    }
    return -1;
  }
  function tres(){ return UJ.emtiles.config().res; }
  function nmOf(t){ var r = tres(); return [t[0] * r[0], t[1] * r[1], t[2] * r[2]]; }

  /* 1. THE BLOCK: every section between the lowest and highest point (+ a margin), one drawSection each */
  async function readBox(pts, say){
    var r = tres();
    var lo = [1e18, 1e18, 1e18], hi = [-1e18, -1e18, -1e18];
    pts.forEach(function(p){ var q = nmOf(p); for (var i = 0; i < 3; i++){ lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } });
    var z0 = Math.floor(lo[2] / r[2]) - MARGIN_Z, z1 = Math.ceil(hi[2] / r[2]) + MARGIN_Z;
    var w = Math.ceil((hi[0] - lo[0] + 2 * MARGIN_NM) / NM / 2) * 2, h = Math.ceil((hi[1] - lo[1] + 2 * MARGIN_NM) / NM / 2) * 2;
    if (w > MAX_SIDE || h > MAX_SIDE) throw new Error("base and tip are more than " + Math.round(MAX_SIDE * NM / 1000) + " µm apart — is that one cilium?");
    if (z1 - z0 > 400) throw new Error("base and tip are " + (z1 - z0) + " sections apart — is that one cilium?");
    var key = [z0, z1, w, h, Math.round((lo[0] + hi[0]) / 2), Math.round((lo[1] + hi[1]) / 2)].join(",");
    if (BOX && BOX.key === key) return BOX;
    /* a block that contains the one asked for is good enough (pins inside the old block) */
    if (BOX && BOX.z0 <= z0 && BOX.z1 >= z1 && BOX.x0 * NM <= lo[0] - MARGIN_NM && BOX.y0 * NM <= lo[1] - MARGIN_NM
        && (BOX.x0 + BOX.w) * NM >= hi[0] + MARGIN_NM && (BOX.y0 + BOX.h) * NM >= hi[1] + MARGIN_NM) return BOX;
    var mip = await mipFor(NM);
    if (mip < 0) throw new Error("this volume has no " + NM + " nm level to read");
    var centre = [Math.round((lo[0] + hi[0]) / 2 / r[0]), Math.round((lo[1] + hi[1]) / 2 / r[1])];
    var nz = z1 - z0 + 1, secs = new Array(nz), done = 0, x0 = null, y0 = null, W = 0, H = 0;
    var order = []; for (var k = 0; k < nz; k++) order.push(k);
    var mid = (nz - 1) / 2; order.sort(function(a, b){ return Math.abs(a - mid) - Math.abs(b - mid); });
    async function one(k){
      var cv = document.createElement("canvas");
      var v = await UJ.emtiles.drawSection(cv, { centre: [centre[0], centre[1], z0 + k], mip: mip, zoom: 1, w: w, h: h, lo: 0, hi: 255 });
      secs[k] = { raw: v.raw, seen: v.seen };
      if (x0 == null){ x0 = v.x0; y0 = v.y0; W = v.vw; H = v.vh; }
      done++; if (say) say("reading the cilium’s sections: " + done + " of " + nz + "…");
    }
    var q = order.slice();
    async function worker(){ while (q.length){ var k = q.shift(); try { await one(k); } catch (_e){ done++; } } }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (x0 == null) throw new Error("the sections round the cilium could not be read");
    BOX = { key: key, z0: z0, z1: z1, nz: nz, x0: x0, y0: y0, w: W, h: H, secs: secs, blur: {} };
    return BOX;
  }

  /* separable box-of-gaussian blur of a w x h float plane */
  function blur(src, w, h, sigma){
    var R = Math.max(1, Math.ceil(sigma * 2.5)), k = [], s = 0, i, x, y;
    for (i = -R; i <= R; i++){ var v = Math.exp(-i * i / (2 * sigma * sigma)); k.push(v); s += v; }
    for (i = 0; i < k.length; i++) k[i] /= s;
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++){
      var a = 0; for (i = -R; i <= R; i++){ var xx = Math.min(w - 1, Math.max(0, x + i)); a += k[i + R] * src[y * w + xx]; } tmp[y * w + x] = a; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++){
      var b = 0; for (i = -R; i <= R; i++){ var yy = Math.min(h - 1, Math.max(0, y + i)); b += k[i + R] * tmp[yy * w + x]; } out[y * w + x] = b; }
    return out;
  }
  function fillUnseen(sec, w, h){
    var f = new Float32Array(w * h), s = 0, n = 0, i;
    for (i = 0; i < w * h; i++) if (sec && sec.seen[i]){ s += sec.raw[i]; n++; }
    var mu = n ? s / n : 128;
    for (i = 0; i < w * h; i++) f[i] = (sec && sec.seen[i]) ? sec.raw[i] : mu;
    return f;
  }

  /* 2. THE SKELETON (v3, 2026-11-25): straight lines through base, the person's pins and the tip.
     Søren on the automatic path: "It does a horrible job at following the primary cilium". Measured on
     12 of his own cilia (base -> tip, 25-105 sections, in his browser on the real EM): following the
     cilium automatically -- by darkness (v1), or by matching its profile from one section to the next
     (v2) -- ended 0.3-2 um from his tip in most of them. In neuropil a cilium is one ~250 nm profile
     among many axons and dendrites of the same size, and an untrained follower swaps onto a
     neighbour. So the skeleton is what the person says: base -> pins -> tip, every pin a click on the
     cilium, and the pad steps along it to where it should be checked. A trained cilium model will make
     the first guess later. */
  function straight(base, tip, pins){
    var bN = nmOf(base), tN = nmOf(tip), bt = [tN[0] - bN[0], tN[1] - bN[1], tN[2] - bN[2]], bt2 = Math.max(1, bt[0] * bt[0] + bt[1] * bt[1] + bt[2] * bt[2]);
    var along = function(p){ var q = nmOf(p); return ((q[0] - bN[0]) * bt[0] + (q[1] - bN[1]) * bt[1] + (q[2] - bN[2]) * bt[2]) / bt2; };
    var stops = [base].concat((pins || []).slice().sort(function(p, q){ return along(p) - along(q); })).concat([tip]);
    var P = stops.map(nmOf), out = [P[0]], L = 0;
    for (var i = 1; i < P.length; i++){
      var a = P[i - 1], b = P[i], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(d / 80));
      for (var j = 1; j <= n; j++){ var t = j / n; out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]); }
      L += d;
    }
    var r = tres();
    return { nodes: out.map(function(q){ return [q[0] / r[0], q[1] / r[1], q[2] / r[2]]; }), lengthNm: L };
  }

  /* 4. THE OUTLINE, section by section */
  function planeBlur(B, k){
    if (!B.blur[k]) B.blur[k] = blur(fillUnseen(B.secs[k], B.w, B.h), B.w, B.h, 1.0);
    return B.blur[k];
  }
  function sample(P, w, h, x, y){
    var x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return NaN;
    var fx = x - x0, fy = y - y0, o = y0 * w + x0;
    return P[o] * (1 - fx) * (1 - fy) + P[o + 1] * fx * (1 - fy) + P[o + w] * (1 - fx) * fy + P[o + w + 1] * fx * fy;
  }
  var R_MIN = 60, R_MAX = 220, R_DEF = 120;
  function edge(P, w, h, c, d){
    /* the strongest dark -> light step outward, between R_MIN and R_MAX nm from c along d (px coords) */
    var best = -1e9, bestR = R_DEF;
    for (var rn = R_MIN; rn <= R_MAX; rn += 8){
      var r = rn / NM, q = 16 / NM;
      var a = sample(P, w, h, c[0] + d[0] * (r - q), c[1] + d[1] * (r - q)), b = sample(P, w, h, c[0] + d[0] * (r + q), c[1] + d[1] * (r + q));
      if (isNaN(a) || isNaN(b)) continue;
      var s = b - a;
      if (s > best){ best = s; bestR = rn; }
    }
    return best > 4 ? bestR : R_DEF;
  }
  function smoothRadii(R, circular){
    var n = R.length, out = R.slice();
    for (var i = 0; i < n; i++){
      var w = [];
      for (var j = -2; j <= 2; j++){ var k = i + j; if (circular) k = (k + n) % n; else if (k < 0 || k >= n) continue; w.push(R[k]); }
      w.sort(function(a, b){ return a - b; }); out[i] = w[w.length >> 1];
    }
    return out;
  }
  async function outline(nodes, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    var r = tres(), B = await readBox([nodes[0], nodes[nodes.length - 1]].concat(nodes.filter(function(n, i){ return i % 10 === 5; })), say);
    /* the skeleton every 10 nm, in 16 nm px and section units */
    var S = [];
    for (var i = 0; i < nodes.length - 1; i++){
      var a = nmOf(nodes[i]), b = nmOf(nodes[i + 1]), d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(d / 10));
      for (var j = 0; j < n; j++){ var t = j / n; S.push([(a[0] + t * (b[0] - a[0])) / NM - B.x0, (a[1] + t * (b[1] - a[1])) / NM - B.y0, (a[2] + t * (b[2] - a[2])) / r[2]]); }
    }
    var e = nmOf(nodes[nodes.length - 1]); S.push([e[0] / NM - B.x0, e[1] / NM - B.y0, e[2] / r[2]]);
    var zLo = Math.round(Math.min.apply(null, S.map(function(s){ return s[2]; }))), zHi = Math.round(Math.max.apply(null, S.map(function(s){ return s[2]; })));
    var rings = [];
    for (var z = zLo; z <= zHi; z++){
      var k = z - B.z0; if (k < 0 || k >= B.nz || !B.secs[k]) continue;
      /* runs of the skeleton inside this section (within half a section of it) */
      var runs = [], cur = null;
      S.forEach(function(s){
        if (Math.abs(s[2] - z) <= 0.5){ if (!cur){ cur = []; runs.push(cur); } cur.push(s); } else cur = null;
      });
      if (!runs.length) continue;
      var P = planeBlur(B, k);
      runs.forEach(function(run){
        var pts = [], xy = run.map(function(s){ return [s[0], s[1]]; });
        var len = 0; for (var q = 1; q < xy.length; q++) len += Math.hypot(xy[q][0] - xy[q - 1][0], xy[q][1] - xy[q - 1][1]);
        if (len * NM < 60){
          /* crossing the section: rays all round */
          var c = [0, 0]; xy.forEach(function(p){ c[0] += p[0]; c[1] += p[1]; }); c[0] /= xy.length; c[1] /= xy.length;
          var R = [];
          for (var aI = 0; aI < 32; aI++){ var ang = aI * Math.PI / 16; R.push(edge(P, B.w, B.h, c, [Math.cos(ang), Math.sin(ang)])); }
          R = smoothRadii(R, true);
          for (aI = 0; aI < 32; aI++){ ang = aI * Math.PI / 16; pts.push([c[0] + Math.cos(ang) * R[aI] / NM, c[1] + Math.sin(ang) * R[aI] / NM]); }
        } else {
          /* lying in the section: both sides along it, and round both ends */
          var st = []; var accL = 0; st.push(xy[0]);
          for (q = 1; q < xy.length; q++){ accL += Math.hypot(xy[q][0] - xy[q - 1][0], xy[q][1] - xy[q - 1][1]); if (accL * NM >= 48){ st.push(xy[q]); accL = 0; } }
          if (st[st.length - 1] !== xy[xy.length - 1]) st.push(xy[xy.length - 1]);
          var T = st.map(function(p, m){
            var a0 = st[Math.max(0, m - 1)], a1 = st[Math.min(st.length - 1, m + 1)], tx = a1[0] - a0[0], ty = a1[1] - a0[1], tl = Math.hypot(tx, ty) || 1;
            return [tx / tl, ty / tl];
          });
          var L = st.map(function(p, m){ return edge(P, B.w, B.h, p, [-T[m][1], T[m][0]]); });
          var Rr = st.map(function(p, m){ return edge(P, B.w, B.h, p, [T[m][1], -T[m][0]]); });
          L = smoothRadii(L, false); Rr = smoothRadii(Rr, false);
          var cap = function(p, t, sgn){
            var out = [];
            for (var cI = 1; cI < 8; cI++){
              var ang = Math.atan2(t[1], t[0]) + sgn * (Math.PI / 2 - cI * Math.PI / 8);
              var dd = [Math.cos(ang), Math.sin(ang)], rr = edge(P, B.w, B.h, p, dd);
              out.push([p[0] + dd[0] * rr / NM, p[1] + dd[1] * rr / NM]);
            }
            return out;
          };
          st.forEach(function(p, m){ pts.push([p[0] - T[m][1] * L[m] / NM, p[1] + T[m][0] * L[m] / NM]); });
          var nE = st.length - 1;
          pts = pts.concat(cap(st[nE], T[nE], 1));
          for (var m = nE; m >= 0; m--) pts.push([st[m][0] + T[m][1] * Rr[m] / NM, st[m][1] - T[m][0] * Rr[m] / NM]);
          var t0 = [-T[0][0], -T[0][1]];
          pts = pts.concat(cap(st[0], t0, 1));
        }
        rings.push({ z: z, points: pts.map(function(p){ return [Math.round((p[0] + B.x0) * NM / r[0]), Math.round((p[1] + B.y0) * NM / r[1])]; }) });
      });
    }
    say(rings.length + " outlines.");
    return rings;
  }
  function reset(){ BOX = null; }
  return { straight: straight, outline: outline, reset: reset };
})();
