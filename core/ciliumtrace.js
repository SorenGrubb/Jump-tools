/* core/ciliumtrace.js — a primary cilium from its base and tip: a skeleton, then its outline.  2026-11-25

   Søren: *"Can we build the cilia tracing now? Could be cool if it first builds a skeleton for the
   cilium after the base and tip have been reported. Then the user corrects the skeleton or accepts
   it and then it traces the outline of the cilium."*

   NO TRAINED MODEL. A cilium in EM is a rod about 250 nm across, darker than the cytoplasm or the
   extracellular space it lies in. Blurred at ~50 nm, a plasma membrane (8 nm) almost disappears and
   the rod stays dark, so:
     SKELETON  the cheapest path from base to tip through a 32 nm x 1-section grid, where a voxel
               costs less the darker its blurred neighbourhood is, kept inside a corridor round the
               straight line (or the line through the person's pins). Smoothed, resampled every 80 nm.
               A wrong turn is corrected with a PIN: a click on the cilium on some section, and the
               path is found again through every pin in order along it.
     OUTLINE   on every section the skeleton crosses, rays from the skeleton (all round where it
               crosses the section, sideways and round the ends where it lies in the section) find
               the cilium's edge -- the strongest dark-to-light step outward between 60 and 220 nm --
               smoothed across neighbouring rays. Ordinary contours: editable like any other.

   HOST CONTRACT
     UJ.ciliumtrace.skeleton(base, tip, pins, { say }) -> Promise<{ nodes:[[x,y,z] tool voxels, z may be
                                                         fractional], lengthNm }>
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

  /* 2. THE COST GRID: 32 nm in x/y, one section in z */
  function costGrid(B){
    var cw = B.w >> 1, ch = B.h >> 1, nz = B.nz, C = new Float32Array(cw * ch * nz);
    for (var k = 0; k < nz; k++){
      var sec = B.secs[k], g = new Float32Array(cw * ch), sg = new Uint8Array(cw * ch);
      for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++){
        var s = 0, n = 0;
        for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++){
          var o = (2 * y + dy) * B.w + 2 * x + dx;
          if (sec && sec.seen[o]){ s += sec.raw[o]; n++; }
        }
        if (n){ g[y * cw + x] = s / n; sg[y * cw + x] = 1; }
      }
      var vals = []; for (var i = 0; i < g.length; i += 7) if (sg[i]) vals.push(g[i]);
      vals.sort(function(a, b){ return a - b; });
      var med = vals.length ? vals[vals.length >> 1] : 128;
      for (i = 0; i < g.length; i++) if (!sg[i]) g[i] = med;
      var bl = blur(g, cw, ch, 1.6);                                  // ~50 nm: membranes fade, the rod stays
      var dev = vals.map(function(v){ return Math.abs(v - med); }).sort(function(a, b){ return a - b; });
      var mad = (dev.length ? dev[dev.length >> 1] : 10) * 1.4826 + 1;
      for (i = 0; i < g.length; i++){
        var d = (med - bl[i]) / mad;                                   // darker than usual -> d > 0
        C[k * cw * ch + i] = sg[i] ? (0.03 + 1 / (1 + Math.exp(2.5 * (d - 0.7)))) : 3;
      }
    }
    /* a little smoothing in z, so one bad section does not make a hole */
    var C2 = new Float32Array(C.length), sl = cw * ch;
    for (k = 0; k < nz; k++) for (i = 0; i < sl; i++){
      var a0 = C[Math.max(0, k - 1) * sl + i], a1 = C[k * sl + i], a2 = C[Math.min(nz - 1, k + 1) * sl + i];
      C2[k * sl + i] = (a0 + 2 * a1 + a2) / 4;
    }
    return { C: C2, cw: cw, ch: ch, nz: nz };
  }

  /* a binary heap of (cost, index) */
  function Heap(){ this.k = []; this.v = []; }
  Heap.prototype.push = function(c, i){
    var k = this.k, v = this.v, n = k.length; k.push(c); v.push(i);
    while (n > 0){ var p = (n - 1) >> 1; if (k[p] <= c) break; k[n] = k[p]; v[n] = v[p]; n = p; }
    k[n] = c; v[n] = i;
  };
  Heap.prototype.pop = function(){
    var k = this.k, v = this.v, topK = k[0], topV = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n){
      var i = 0;
      for (;;){
        var l = 2 * i + 1, r = l + 1, m = i, mk = lk;
        if (l < n && k[l] < mk){ m = l; mk = k[l]; }
        if (r < n && k[r] < mk){ m = r; mk = k[r]; }
        if (m === i) break;
        k[i] = k[m]; v[i] = v[m]; i = m;
      }
      k[i] = lk; v[i] = lv;
    }
    this.lastK = topK; return topV;
  };

  /* 3. THE CHEAPEST PATH from a to b (grid coords), inside a corridor round the segment a-b */
  function path(G, a, b, zNm){
    var cw = G.cw, ch = G.ch, nz = G.nz, sl = cw * ch, N = sl * nz;
    var XY = 2 * NM;
    var A = [a[0] * XY, a[1] * XY, a[2] * zNm], Bn = [b[0] * XY, b[1] * XY, b[2] * zNm];
    var L = Math.hypot(Bn[0] - A[0], Bn[1] - A[1], Bn[2] - A[2]);
    var Rc = Math.min(1500, Math.max(600, 0.3 * L));
    var ab = [Bn[0] - A[0], Bn[1] - A[1], Bn[2] - A[2]], ab2 = Math.max(1, ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]);
    function inside(x, y, z){
      var p = [x * XY - A[0], y * XY - A[1], z * zNm - A[2]];
      var t = Math.max(0, Math.min(1, (p[0] * ab[0] + p[1] * ab[1] + p[2] * ab[2]) / ab2));
      var dx = p[0] - t * ab[0], dy = p[1] - t * ab[1], dz = p[2] - t * ab[2];
      return dx * dx + dy * dy + dz * dz <= Rc * Rc;
    }
    var offs = [];
    for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++){
      if (!dx && !dy && !dz) continue;
      offs.push([dx, dy, dz, Math.hypot(dx * XY, dy * XY, dz * zNm) / XY]);
    }
    var dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    var s = a[2] * sl + a[1] * cw + a[0], g = b[2] * sl + b[1] * cw + b[0];
    dist[s] = 0; var H = new Heap(); H.push(0, s);
    while (H.k.length){
      var i = H.pop();
      if (done[i]) continue; done[i] = 1;
      if (i === g) break;
      var z = (i / sl) | 0, rem = i - z * sl, y = (rem / cw) | 0, x = rem - y * cw;
      for (var j = 0; j < offs.length; j++){
        var o = offs[j], X = x + o[0], Y = y + o[1], Z = z + o[2];
        if (X < 0 || Y < 0 || Z < 0 || X >= cw || Y >= ch || Z >= nz) continue;
        var n = Z * sl + Y * cw + X;
        if (done[n] || !inside(X, Y, Z)) continue;
        var nd = dist[i] + o[3] * (G.C[i] + G.C[n]) / 2;
        if (nd < dist[n]){ dist[n] = nd; prev[n] = i; H.push(nd, n); }
      }
    }
    if (prev[g] < 0 && g !== s) return null;
    var out = [];
    for (var c = g; c >= 0; c = prev[c]){
      var zz = (c / sl) | 0, rr = c - zz * sl, yy = (rr / cw) | 0;
      out.push([rr - yy * cw, yy, zz]);
      if (c === s) break;
    }
    return out.reverse();
  }

  function smoothResample(P, step){
    /* moving average (window 7), ends fixed; then a point every `step` nm along it */
    var n = P.length, S = P.map(function(p){ return p.slice(); });
    for (var i = 1; i < n - 1; i++){
      var a = [0, 0, 0], c = 0;
      for (var j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++){ a[0] += P[j][0]; a[1] += P[j][1]; a[2] += P[j][2]; c++; }
      S[i] = [a[0] / c, a[1] / c, a[2] / c];
    }
    var out = [S[0]], acc = 0, L = 0;
    for (i = 1; i < n; i++){
      var d = Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1], S[i][2] - S[i - 1][2]);
      L += d; acc += d;
      while (acc >= step && d > 0){
        var t = 1 - (acc - step) / d;
        out.push([S[i - 1][0] + t * (S[i][0] - S[i - 1][0]), S[i - 1][1] + t * (S[i][1] - S[i - 1][1]), S[i - 1][2] + t * (S[i][2] - S[i - 1][2])]);
        acc -= step;
      }
    }
    var last = S[n - 1], pl = out[out.length - 1];
    if (Math.hypot(last[0] - pl[0], last[1] - pl[1], last[2] - pl[2]) > step * 0.3) out.push(last); else out[out.length - 1] = last;
    return { pts: out, length: L };
  }

  async function skeleton(base, tip, pins, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    pins = pins || [];
    var r = tres(), B = await readBox([base, tip].concat(pins), say);
    say("finding the cilium’s path…");
    await new Promise(function(res){ setTimeout(res, 0); });
    if (!B.grid) B.grid = costGrid(B);
    var G = B.grid, XY = 2 * NM;
    function toGrid(t){
      var q = nmOf(t);
      return [Math.max(0, Math.min(G.cw - 1, Math.round(q[0] / XY - B.x0 / 2))),
              Math.max(0, Math.min(G.ch - 1, Math.round(q[1] / XY - B.y0 / 2))),
              Math.max(0, Math.min(G.nz - 1, Math.round(t[2]) - B.z0))];
    }
    /* pins in their order along the base -> tip line */
    var bN = nmOf(base), tN = nmOf(tip), bt = [tN[0] - bN[0], tN[1] - bN[1], tN[2] - bN[2]], bt2 = Math.max(1, bt[0] * bt[0] + bt[1] * bt[1] + bt[2] * bt[2]);
    var along = function(p){ var q = nmOf(p); return ((q[0] - bN[0]) * bt[0] + (q[1] - bN[1]) * bt[1] + (q[2] - bN[2]) * bt[2]) / bt2; };
    var stops = [base].concat(pins.slice().sort(function(p, q){ return along(p) - along(q); })).concat([tip]);
    var all = [];
    for (var i = 0; i < stops.length - 1; i++){
      var seg = path(G, toGrid(stops[i]), toGrid(stops[i + 1]), r[2]);
      if (!seg) throw new Error("no path found between " + (i ? "pin " + i : "the base") + " and " + (i === stops.length - 2 ? "the tip" : "pin " + (i + 1)));
      if (all.length) seg.shift();
      all = all.concat(seg);
    }
    /* grid -> nm, the clicked ends exact */
    var P = all.map(function(g){ return [(g[0] * 2 + B.x0 + 1) * NM, (g[1] * 2 + B.y0 + 1) * NM, (g[2] + B.z0) * r[2]]; });
    P[0] = bN; P[P.length - 1] = tN;
    var sr = smoothResample(P, 80);
    return { nodes: sr.pts.map(function(q){ return [q[0] / r[0], q[1] / r[1], q[2] / r[2]]; }), lengthNm: sr.length };
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
    var r = tres(), B = BOX;
    if (!B) throw new Error("make the skeleton first");
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
  return { skeleton: skeleton, outline: outline, reset: reset };
})();
