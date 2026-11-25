/* core/ciliumtrace.js — a primary cilium from its base and tip: a skeleton, then its outline.  2026-11-25

   Søren: *"Can we build the cilia tracing now? Could be cool if it first builds a skeleton for the
   cilium after the base and tip have been reported. Then the user corrects the skeleton or accepts
   it and then it traces the outline of the cilium."*

     SKELETON  the person's clicks along the cilium, base -> points -> tip, straight between them (v3;
               see straight() for why the automatic followers were taken out).
     OUTLINE   on every section the line crosses: its shape there (a circle where it crosses the
               section, a capsule where it lies in it) at the cilium's measured radius, which is kept
               to 80-150 nm (160-300 nm across). Ordinary contours: editable like any other.

   HOST CONTRACT
     UJ.ciliumtrace.line([base, point, ..., tip]) -> { nodes:[[x,y,z] tool voxels, z fractional], lengthNm }, in that order
     UJ.ciliumtrace.straight(base, tip, pins)   -> the same, with the pins sorted along base -> tip
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
  /* line(stops): straight segments through the stops IN THE ORDER GIVEN (the pad orders them: the
     points as they were clicked along the cilium, a later correction where it lengthens the line least) */
  function line(stops){
    var P = stops.map(nmOf), out = [P[0]], L = 0;
    for (var i = 1; i < P.length; i++){
      var a = P[i - 1], b = P[i], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(d / 80));
      for (var j = 1; j <= n; j++){ var t = j / n; out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]); }
      L += d;
    }
    var r = tres();
    return { nodes: out.map(function(q){ return [q[0] / r[0], q[1] / r[1], q[2] / r[2]]; }), lengthNm: L };
  }
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
  /* THE CILIUM'S THICKNESS IS BOUNDED, ITS LENGTH IS NOT (2026-11-25). Søren on the first outlines:
     "the outlining of the cilium is horrible. Can we put a restraint to how big the cilium can be? ...
     However, this should not prohibit a cilium that is long along the length of the plane."
     A primary cilium is about 200 nm wide (Mohieldin et al. 2015, Sci Rep 5:15982,
     https://doi.org/10.1038/srep15982); with its membrane, ~200-300 nm in EM. So:
       - its RADIUS is measured, not each ray's: the strongest dark -> light step outward between 60 and
         150 nm, on rays across the cilium, and the median of those is the radius on that section;
       - the radius is smoothed along the cilium (median over +-2 sections) and kept within 80-150 nm,
         i.e. 160-300 nm across; 110 nm where no edge stands out;
       - the outline is the cilium's SHAPE at that radius: the stretch of the line inside this section
         (within half a section of it), widened by the radius on both sides and rounded at the ends -- a
         circle where it crosses the section, a long capsule where it lies in it. Length is whatever the
         line says. */
  var R_MIN = 60, R_MAX = 150, R_LO = 80, R_HI = 150, R_DEF = 110;
  function edge(P, w, h, c, d){
    var best = -1e9, bestR = NaN;
    for (var rn = R_MIN; rn <= R_MAX; rn += 6){
      var r = rn / NM, q = 16 / NM;
      var a = sample(P, w, h, c[0] + d[0] * (r - q), c[1] + d[1] * (r - q)), b = sample(P, w, h, c[0] + d[0] * (r + q), c[1] + d[1] * (r + q));
      if (isNaN(a) || isNaN(b)) continue;
      if (b - a > best){ best = b - a; bestR = rn; }
    }
    return best > 4 ? bestR : NaN;
  }
  function median(v){ v = v.filter(function(x){ return !isNaN(x); }).sort(function(a, b){ return a - b; }); return v.length ? v[v.length >> 1] : NaN; }
  function capsule(st, rpx){
    /* st: the run's points (px), rpx: radius in px -> a closed outline round them */
    var pts = [], i;
    if (st.length < 2){
      for (i = 0; i < 32; i++){ var an = i * Math.PI / 16; pts.push([st[0][0] + Math.cos(an) * rpx, st[0][1] + Math.sin(an) * rpx]); }
      return pts;
    }
    var T = st.map(function(p, m){
      var a0 = st[Math.max(0, m - 1)], a1 = st[Math.min(st.length - 1, m + 1)], tx = a1[0] - a0[0], ty = a1[1] - a0[1], tl = Math.hypot(tx, ty) || 1;
      return [tx / tl, ty / tl];
    });
    var arc = function(p, t){                       // from the left of t, round the front, to the right
      var o = [], th = Math.atan2(t[1], t[0]);
      for (var c = 1; c < 12; c++){ var an = th + Math.PI / 2 - c * Math.PI / 12; o.push([p[0] + Math.cos(an) * rpx, p[1] + Math.sin(an) * rpx]); }
      return o;
    };
    st.forEach(function(p, m){ pts.push([p[0] - T[m][1] * rpx, p[1] + T[m][0] * rpx]); });
    var n = st.length - 1;
    pts = pts.concat(arc(st[n], T[n]));
    for (i = n; i >= 0; i--) pts.push([st[i][0] + T[i][1] * rpx, st[i][1] - T[i][0] * rpx]);
    pts = pts.concat(arc(st[0], [-T[0][0], -T[0][1]]));
    return pts;
  }
  async function outline(nodes, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    var r = tres(), B = await readBox([nodes[0], nodes[nodes.length - 1]].concat(nodes.filter(function(n, i){ return i % 10 === 5; })), say);
    /* the line every 10 nm, in 16 nm px and section units */
    var S = [];
    for (var i = 0; i < nodes.length - 1; i++){
      var a = nmOf(nodes[i]), b = nmOf(nodes[i + 1]), d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(d / 10));
      for (var j = 0; j < n; j++){ var t = j / n; S.push([(a[0] + t * (b[0] - a[0])) / NM - B.x0, (a[1] + t * (b[1] - a[1])) / NM - B.y0, (a[2] + t * (b[2] - a[2])) / r[2]]); }
    }
    var e = nmOf(nodes[nodes.length - 1]); S.push([e[0] / NM - B.x0, e[1] / NM - B.y0, e[2] / r[2]]);
    var zLo = Math.round(Math.min.apply(null, S.map(function(s){ return s[2]; }))), zHi = Math.round(Math.max.apply(null, S.map(function(s){ return s[2]; })));
    /* 1. per section: the runs of the line in it, and the radius measured across them */
    var secs = [];
    for (var z = zLo; z <= zHi; z++){
      var k = z - B.z0; if (k < 0 || k >= B.nz || !B.secs[k]) continue;
      var runs = [], cur = null;
      S.forEach(function(s){
        if (Math.abs(s[2] - z) <= 0.5){ if (!cur){ cur = []; runs.push(cur); } cur.push([s[0], s[1]]); } else cur = null;
      });
      if (!runs.length) continue;
      var P = planeBlur(B, k), meas = [];
      runs = runs.map(function(xy){
        var st = [xy[0]], acc = 0;
        for (var q = 1; q < xy.length; q++){ acc += Math.hypot(xy[q][0] - xy[q - 1][0], xy[q][1] - xy[q - 1][1]); if (acc * NM >= 48){ st.push(xy[q]); acc = 0; } }
        var last = xy[xy.length - 1];
        if (Math.hypot(last[0] - st[st.length - 1][0], last[1] - st[st.length - 1][1]) * NM > 15) st.push(last);
        if (st.length === 1){                       // crossing: rays all round
          for (var aI = 0; aI < 24; aI++){ var an = aI * Math.PI / 12; meas.push(edge(P, B.w, B.h, st[0], [Math.cos(an), Math.sin(an)])); }
        } else {                                    // lying in the section: rays across it
          for (var m = 0; m < st.length; m++){
            var a0 = st[Math.max(0, m - 1)], a1 = st[Math.min(st.length - 1, m + 1)], tx = a1[0] - a0[0], ty = a1[1] - a0[1], tl = Math.hypot(tx, ty) || 1;
            meas.push(edge(P, B.w, B.h, st[m], [-ty / tl, tx / tl]), edge(P, B.w, B.h, st[m], [ty / tl, -tx / tl]));
          }
        }
        return st;
      });
      secs.push({ z: z, runs: runs, r: median(meas) });
    }
    /* 2. the radius along the cilium: median over +-2 sections, kept to 80-150 nm */
    var rings = [];
    secs.forEach(function(sc, i){
      var rr = median(secs.slice(Math.max(0, i - 2), i + 3).map(function(x){ return x.r; }));
      rr = isNaN(rr) ? R_DEF : Math.max(R_LO, Math.min(R_HI, rr));
      sc.runs.forEach(function(st){
        var pts = capsule(st, rr / NM);
        rings.push({ z: sc.z, rNm: Math.round(rr), points: pts.map(function(p){ return [Math.round((p[0] + B.x0) * NM / r[0]), Math.round((p[1] + B.y0) * NM / r[1])]; }) });
      });
    });
    say(rings.length + " outlines.");
    return rings;
  }
  function reset(){ BOX = null; }
  return { line: line, straight: straight, outline: outline, reset: reset };
})();
