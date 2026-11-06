/* core/meninges.js — the brain's borders as surfaces: glia limitans, arachnoid mater, the white-matter
   border, the arachnoid villus and the box the whole dataset fills. 2026-11-06

   Søren: *"The white matter, the arachnoid mater, and the glia limitans should be shown like sheets
   similar to the division of the visual areas… The arachnoid villus… outlines of the structure, an
   outline of the channel inside it and an outline of the inner channel… I also want to be able to
   show the bounding box for the entire dataset."*

   WHERE THE DATA COMES FROM. Søren's own Neuroglancer line annotations (4 × 4 × 40 nm voxels), one
   polyline per traced section. web/meninges_prep.py chains the clicked segments into polylines,
   puts each sheet's polylines in the same direction (along the sheet's main axis), resamples them
   to 4 µm and writes data/meninges/minnie65.json: x, y at 0.1 µm (Int16, base64), z in µm. That
   frame is the VR's content frame (µm, x·0.004, y·0.004, z·0.04 of the voxels), so nothing here
   moves anything.

   TWO KINDS OF SURFACE, because they are two kinds of drawing.
     · A SHEET (glia limitans, arachnoid mater, white matter) is an open curve across each section.
       Neighbouring sections are joined by the classic greedy contour stitch: walk both curves and
       always take the shorter of the two possible diagonals. It needs no equal point counts and
       copes with a curve that starts 200 µm further along than its neighbour.
       Where the annotation itself has a gap — two pieces on one section, a skipped stretch of
       sections — no surface is invented: a triangle with an edge longer than MAX_EDGE, or across
       a z gap longer than MAX_DZ, is dropped. A gap in the drawing stays a gap in the sheet.
     · RINGS (the villus layers, the dataset box) are closed outlines, lofted by core/traceloft.js —
       the tracing pad's own loft, which already pairs several outlines per section and makes an
       outline inside another a hole. Open outlines (half of the villus outline, where it opens onto
       the subarachnoid space) are stitched like a sheet between consecutive sections that each have
       one, so they are not forced shut with an invented chord.
   The section polylines themselves are always drawn as lines too — they are the data; the skin
   between them is interpolation.

   Run: node web/meningescheck.js */
(typeof window !== "undefined" ? window : global).UJ =
  (typeof window !== "undefined" ? window : global).UJ || {};
UJ.meninges = (function(){
  "use strict";
  var MAX_EDGE = 40;     // µm: a longer triangle edge is a gap in the annotation, not tissue
  var MAX_DZ = 40;       // µm: sections further apart than this are not joined
  var MIN_FILL = 30;     // µm: a gap in one or two sections longer than this along the sheet is bridged

  function b64ToInt16(s){
    var bin = typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("binary");
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Int16Array(u.buffer);
  }
  /* One polyline: [[x, y], ...] in µm. */
  function decode(s){
    var a = b64ToInt16(s), p = [];
    for (var i = 0; i + 1 < a.length; i += 2) p.push([a[i] / 10, a[i + 1] / 10]);
    return p;
  }
  function d3(a, b){ var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); }

  /* Greedy stitch of two polylines A (at za) and B (at zb), both [[x,y],...] running the same way.
     Pushes vertices into P (flat xyz) and triangle indices into I; returns the number of triangles. */
  function stitch(A, za, B, zb, P, I, maxEdge){
    maxEdge = maxEdge || MAX_EDGE;
    if (!A.length || !B.length || A.length + B.length < 3) return 0;
    var a0 = P.length / 3, b0 = a0 + A.length, k, n = 0;
    for (k = 0; k < A.length; k++) P.push(A[k][0], A[k][1], za);
    for (k = 0; k < B.length; k++) P.push(B[k][0], B[k][1], zb);
    var V = function(i){ return [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; };
    var ok = function(i, j, l){
      var p = V(i), q = V(j), r = V(l);
      return d3(p, q) <= maxEdge && d3(q, r) <= maxEdge && d3(r, p) <= maxEdge;
    };
    /* Start where the two are closest to each other's start, so a curve that begins further along
       does not fan from one corner. */
    var i = 0, j = 0;
    var pa = [A[0][0], A[0][1], za], pb = [B[0][0], B[0][1], zb];
    var bi = 0, bd = Infinity;
    for (k = 0; k < A.length; k++){ var dd = d3([A[k][0], A[k][1], za], pb); if (dd < bd){ bd = dd; bi = k; } }
    var bj = 0, be = Infinity;
    for (k = 0; k < B.length; k++){ var de = d3([B[k][0], B[k][1], zb], pa); if (de < be){ be = de; bj = k; } }
    if (bd <= be) i = bi; else j = bj;
    while (i < A.length - 1 || j < B.length - 1){
      var advA;
      if (i >= A.length - 1) advA = false;
      else if (j >= B.length - 1) advA = true;
      else {
        var dA = d3([A[i + 1][0], A[i + 1][1], za], [B[j][0], B[j][1], zb]);
        var dB = d3([A[i][0], A[i][1], za], [B[j + 1][0], B[j + 1][1], zb]);
        advA = dA <= dB;
      }
      if (advA){ if (ok(a0 + i, a0 + i + 1, b0 + j)){ I.push(a0 + i, a0 + i + 1, b0 + j); n++; } i++; }
      else { if (ok(a0 + i, b0 + j + 1, b0 + j)){ I.push(a0 + i, b0 + j + 1, b0 + j); n++; } j++; }
    }
    return n;
  }
  /* Pieces of two sections: each piece is joined to the piece on the other section that overlaps it
     most along the sheet's axis — or to the whole other section when both have one piece. */
  function along(p, ax){ return p[0] * ax[0] + p[1] * ax[1]; }
  function span(p, ax){ var a = along(p[0], ax), b = along(p[p.length - 1], ax); return [Math.min(a, b), Math.max(a, b)]; }
  function overlap(s, t){ return Math.min(s[1], t[1]) - Math.max(s[0], t[0]); }

  /* A sheet layer -> { positions: Float32Array, indices: Uint32Array, lines: Float32Array (segments) } */
  /* Intervals along the axis: cover of a section, intersection, subtraction. */
  function coverOf(pcs, ax){
    var iv = pcs.map(function(p){ return span(p, ax); }).sort(function(a, b){ return a[0] - b[0]; }), out = [];
    iv.forEach(function(v){ var l = out[out.length - 1]; if (l && v[0] <= l[1]) l[1] = Math.max(l[1], v[1]); else out.push(v.slice()); });
    return out;
  }
  function intersect(A, B){
    var out = [];
    A.forEach(function(a){ B.forEach(function(b){ var lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]); if (hi > lo) out.push([lo, hi]); }); });
    return out;
  }
  function subtract(A, B){
    var out = A.map(function(a){ return a.slice(); });
    B.forEach(function(b){
      var nx = [];
      out.forEach(function(a){
        if (b[1] <= a[0] || b[0] >= a[1]){ nx.push(a); return; }
        if (b[0] > a[0]) nx.push([a[0], b[0]]);
        if (b[1] < a[1]) nx.push([b[1], a[1]]);
      });
      out = nx;
    });
    return out;
  }
  /* The part of a section's pieces that lies in [lo, hi] along the axis, as polylines. */
  function clip(pcs, ax, lo, hi){
    var out = [];
    pcs.forEach(function(p){
      var cur = [];
      p.forEach(function(q){ var a = along(q, ax); if (a >= lo && a <= hi) cur.push(q); else if (cur.length){ out.push(cur); cur = []; } });
      if (cur.length) out.push(cur);
    });
    return out.filter(function(c){ return c.length >= 2; });
  }

  /* A sheet layer -> { positions: Float32Array, indices: Uint32Array, lines: Float32Array (segments) } */
  function sheet(layer, opts){
    opts = opts || {};
    var ax = layer.axis || [1, 0], P = [], I = [], L = [];
    var maxDz = opts.maxDz || MAX_DZ, maxEdge = opts.maxEdge || MAX_EDGE, minFill = opts.minFill || MIN_FILL;
    var raw = layer.secs.map(function(s){ return { z: s[0], pcs: s[1].map(decode) }; });
    raw.sort(function(a, b){ return a.z - b.z; });
    /* One section drawn at two z a fraction of a µm apart is one section (arachnoid, z 1033.3/1033.4). */
    var secs = [];
    raw.forEach(function(s){ var l = secs[secs.length - 1]; if (l && s.z - l.z < 0.5) l.pcs = l.pcs.concat(s.pcs); else secs.push(s); });
    secs.forEach(function(s){
      s.pcs.forEach(function(p){ for (var k = 0; k + 1 < p.length; k++) L.push(p[k][0], p[k][1], s.z, p[k + 1][0], p[k + 1][1], s.z); });
      s.cov = coverOf(s.pcs, ax);
    });
    /* Neighbouring sections: every piece joined to EVERY piece of the section below that it overlaps
       along the axis (2026-11-06, v2). Joining only the most-overlapping one left a long hole wherever
       one section was drawn in two pieces and its neighbour in one. */
    for (var i = 1; i < secs.length; i++){
      var s = secs[i], prev = secs[i - 1].pcs, prevZ = secs[i - 1].z;
      if (s.z - prevZ > maxDz) continue;
      s.pcs.forEach(function(B){
        var sb = span(B, ax);
        prev.forEach(function(A){ if (overlap(span(A, ax), sb) > -maxEdge) stitch(A, prevZ, B, s.z, P, I, maxEdge); });
      });
    }
    /* BRIDGING A SECTION'S GAP (2026-11-06, v3). Søren: *"there are a lot of long stretches with
       holes in the segmentation. It is fine with the holes for the penetrating vessels, but can we
       close the very long holes?"* -- and the same for the arachnoid mater. Those holes are one or two
       sections where a long stretch was simply not drawn (gaps of 30–200 µm along the sheet) while
       the sections on both sides run straight through. So: where sections i and j (j = i+2 or i+3,
       closer than MAX_DZ) both cover a stretch that NONE of the sections between them covers, and
       that stretch is longer than MIN_FILL, i and j are joined directly across it. A penetrating
       vessel leaves a hole that is short along the sheet, or one that runs through more than two
       sections, so it stays open. */
    for (i = 0; i < secs.length; i++){
      for (var j = i + 2; j <= i + 3 && j < secs.length; j++){
        if (secs[j].z - secs[i].z > maxDz) break;
        var mid = [];
        for (var k = i + 1; k < j; k++) mid = mid.concat(secs[k].cov);
        var gaps = subtract(intersect(secs[i].cov, secs[j].cov), coverOf(mid.map(function(v){ return [[v[0] * ax[0], v[0] * ax[1]], [v[1] * ax[0], v[1] * ax[1]]]; }), ax));
        gaps.forEach(function(g){
          if (g[1] - g[0] < minFill) return;
          var lo = g[0] - 6, hi = g[1] + 6;          // one resampled point (4 µm) past each side, to meet the edges
          clip(secs[i].pcs, ax, lo, hi).forEach(function(A){
            clip(secs[j].pcs, ax, lo, hi).forEach(function(B){
              if (overlap(span(A, ax), span(B, ax)) > 0) stitch(A, secs[i].z, B, secs[j].z, P, I, maxEdge);
            });
          });
        });
      }
    }
    return { positions: new Float32Array(P), indices: new Uint32Array(I), lines: new Float32Array(L) };
  }

  /* A rings layer. loft = UJ.traceloft.loft (rings in voxels + resolution in nm -> nm). */
  function rings(layer, loft, opts){
    opts = opts || {};
    var P = [], I = [], L = [], closed = [], prevOpen = null, prevZ = 0;
    var secs = layer.secs.slice().sort(function(a, b){ return a[0] - b[0]; });
    secs.forEach(function(s){
      var z = s[0], open = [];
      s[1].forEach(function(r){
        var p = decode(r[1]); if (p.length < 2) return;
        for (var k = 0; k + 1 < p.length; k++) L.push(p[k][0], p[k][1], z, p[k + 1][0], p[k + 1][1], z);
        if (r[0]){
          var q = p[p.length - 1]; L.push(q[0], q[1], z, p[0][0], p[0][1], z);
          if (p.length >= 3) closed.push({ z: Math.round(z / 0.04), points: p.map(function(v){ return [v[0] / 0.004, v[1] / 0.004]; }) });
        } else open.push(p);
      });
      if (prevOpen && open.length === 1 && prevOpen.length === 1 && z - prevZ <= (opts.maxDz || MAX_DZ)){
        var A = prevOpen[0], B = open[0];
        /* the same direction as the one below */
        var f = d3([A[0][0], A[0][1], 0], [B[0][0], B[0][1], 0]) + d3([A[A.length - 1][0], A[A.length - 1][1], 0], [B[B.length - 1][0], B[B.length - 1][1], 0]);
        var r_ = d3([A[0][0], A[0][1], 0], [B[B.length - 1][0], B[B.length - 1][1], 0]) + d3([A[A.length - 1][0], A[A.length - 1][1], 0], [B[0][0], B[0][1], 0]);
        if (r_ < f){ B = B.slice().reverse(); open[0] = B; }
        stitch(A, prevZ, B, z, P, I, opts.maxEdge || 15);
      }
      if (open.length) { prevOpen = open; prevZ = z; } else prevOpen = null;
    });
    if (loft && closed.length){
      var Lf = null;
      try { Lf = loft(closed, [4, 4, 40]); } catch (e){ Lf = null; }
      if (Lf && Lf.positions && Lf.indices){
        var off = P.length / 3;
        for (var k = 0; k < Lf.positions.length; k++) P.push(Lf.positions[k] / 1000);     // nm -> µm
        for (k = 0; k < Lf.indices.length; k++) I.push(Lf.indices[k] + off);
      }
    }
    return { positions: new Float32Array(P), indices: new Uint32Array(I), lines: new Float32Array(L), closed: closed.length };
  }

  /* Where a label goes: the middle point of the middle section. */
  function anchor(layer){
    var s = layer.secs.slice().sort(function(a, b){ return a[0] - b[0]; })[Math.floor(layer.secs.length / 2)];
    var raw = layer.kind === "sheet" ? s[1][0] : s[1][0][1];
    var p = decode(raw), q = p[Math.floor(p.length / 2)];
    return [q[0], q[1], s[0]];
  }
  return { decode: decode, stitch: stitch, sheet: sheet, rings: rings, anchor: anchor, MAX_EDGE: MAX_EDGE, MAX_DZ: MAX_DZ };
})();
if (typeof module !== "undefined") module.exports = UJ.meninges;
