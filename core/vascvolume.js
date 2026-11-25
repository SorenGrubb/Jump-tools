/* ── VESSEL VOLUME IN A BOX (Wan & Wei TriSAM) ─────────────────────────────────────  2026-11-25
   Søren: "Do we have any way in uJump to calculate the vessel volume based on the Wan et al dataset
   for a certain ROI?" ... "do it in the colab notebook and directly on the page. But, also if you
   download an excel sheet with the cells within that ROI it should have a sheet with the total
   vascular volume and volumes of different vessel segments."

   WHAT IS COUNTED. Every vessel voxel of the TriSAM segmentation (Wan & Wei 2025,
   https://doi.org/10.1109/JBHI.2025.3576643; data https://bossdb.org/project/wei2024) whose centre
   lies inside the box, read at its finest level (256 x 256 x 1280 nm per voxel; a coarser level only
   when the box would need more than MAX_CHUNKS chunks). Volume = voxels x voxel volume.

   WHICH KIND. The traced vessel network (data/vasc_net/v1, Søren's tracings, the one VR uses): the
   vessel voxels are pooled in 2 µm cubes, and each cube takes the kind and vessel id of the nearest
   traced point within max(that vessel's radius + 3 µm, 5 µm) and 12 µm. Anything further from every
   traced vessel is "untraced vessels" -- mostly capillaries beyond 3rd order, which nobody traced.

   LUMEN, NOT WALL. Checked 2026-11-25 against the traced lumen outlines: where a penetrating arteriole
   or ascending venule is cut across, TriSAM's in-plane area gives the same radius as the traced lumen
   (10.2 vs 10.3 µm, 4.8 vs 5.0, 3.1 vs 3.0), so this is luminal volume; the vessel wall (endothelium,
   pericytes, smooth muscle) is not in it. Said wherever the number is shown.

   The notebook cell (notebookCells) does the same in Python with cloud-volume, so the page, the
   Excel sheet and the notebook give the same numbers for the same box.

   Public: UJ.vascvolume.measure(boxNm, {say}) -> Promise<result>; .cached(boxNm); .sheetRows(results);
           .notebookCells({boxNM, label, csv, download}) -> [{md}, {code}]; .html(label, r); .available(). */
window.UJ = window.UJ || {};
UJ.vascvolume = (function(){
  "use strict";
  var SRC = "https://bossdb-open-data.s3.amazonaws.com/wei2024/minnie/bv";
  var NET = "data/vasc_net/v1/";
  var MAX_CHUNKS = 4000, PAR = 8, BIN = 2.0;
  var NAMES = { pial_art: "pial arteriole", pa: "penetrating arteriole",
    acap1: "1st-order arterial capillary", acap2: "2nd-order arterial capillary", acap3: "3rd-order arterial capillary",
    vcap1: "1st-order venous capillary", vcap2: "2nd-order venous capillary", vcap3: "3rd-order venous capillary",
    av: "ascending venule", pial_ven: "pial venule" };
  var ORDER = ["pial_art", "pa", "acap1", "acap2", "acap3", "vcap3", "vcap2", "vcap1", "av", "pial_ven"];
  var UNTRACED = "untraced vessels (mostly capillaries beyond 3rd order)";
  var CITE = "Wan & Wei 2025 (TriSAM), doi:10.1109/JBHI.2025.3576643; data bossdb.org/project/wei2024";

  var INFO = null, NETP = null, CHUNKS = new Map(), CACHE = new Map();

  function available(){
    var c = window.UJ && UJ.cfg;
    var vs = c && c.em && c.em.vascSource;
    return !c || !c.id || /wei2024\/minnie\/bv/.test(String(vs || "")) || c.id === "microns" || c.id === "minnie65";
  }
  async function info(){
    if (!INFO) INFO = fetch(SRC + "/info").then(function(r){ if (!r.ok) throw new Error("TriSAM info: HTTP " + r.status); return r.json(); });
    try { return await INFO; } catch (e){ INFO = null; throw e; }
  }
  async function net(){
    if (!NETP) NETP = (async function(){
      var meta = await (await fetch(NET + "meta.json")).json();
      var buf = await (await fetch(NET + "net.bin")).arrayBuffer();
      var n = meta.n, e = meta.e, d = meta.d, o = 0;
      o += n * 12;
      var rad = new Float32Array(buf, o, n); o += n * 4;
      var vid = new Uint32Array(buf, o, n); o += n * 4;
      var cat = new Uint8Array(buf, o, n); o += n + ((4 - n % 4) % 4);
      o += e * 8;
      var dq = new Uint16Array(buf, o, d * 3); o += d * 6 + ((4 - (d * 6) % 4) % 4);
      var own = new Uint32Array(buf, o, d);
      return { meta: meta, rad: rad, vid: vid, cat: cat, dq: dq, own: own, q: meta.quant };
    })();
    try { return await NETP; } catch (e){ NETP = null; throw e; }
  }

  /* compressed_segmentation, uint32, one channel. Returns the local indices (x fastest) of the
     non-zero voxels: a vessel is a few per cent of a chunk, so nothing else is kept. */
  function decode(buf, sx, sy, sz, bs){
    var u = new Uint32Array(buf), base = u[0];
    var gx = Math.ceil(sx / bs[0]), gy = Math.ceil(sy / bs[1]), gz = Math.ceil(sz / bs[2]);
    var out = [], bx, by, bz, x, y, z;
    for (bz = 0; bz < gz; bz++) for (by = 0; by < gy; by++) for (bx = 0; bx < gx; bx++){
      var h = base + 2 * ((bz * gy + by) * gx + bx);
      var w0 = u[h], w1 = u[h + 1];
      var tab = base + (w0 & 0xffffff), bits = w0 >>> 24, enc = base + w1;
      var X0 = bx * bs[0], Y0 = by * bs[1], Z0 = bz * bs[2];
      var nx = Math.min(bs[0], sx - X0), ny = Math.min(bs[1], sy - Y0), nz = Math.min(bs[2], sz - Z0);
      if (bits === 0){
        if (u[tab] === 0) continue;
        for (z = 0; z < nz; z++) for (y = 0; y < ny; y++) for (x = 0; x < nx; x++)
          out.push(((Z0 + z) * sy + (Y0 + y)) * sx + X0 + x);
        continue;
      }
      var mask = bits === 32 ? 0xffffffff : ((1 << bits) - 1);
      for (z = 0; z < nz; z++) for (y = 0; y < ny; y++) for (x = 0; x < nx; x++){
        var i = (z * bs[1] + y) * bs[0] + x, bp = i * bits;
        var idx = bits === 32 ? u[enc + i] : (u[enc + (bp >>> 5)] >>> (bp & 31)) & mask;
        if (u[tab + idx] !== 0) out.push(((Z0 + z) * sy + (Y0 + y)) * sx + X0 + x);
      }
    }
    return Int32Array.from(out);
  }

  async function chunk(sc, cx, cy, cz){
    var key = sc.key + "/" + cx + "," + cy + "," + cz;
    if (CHUNKS.has(key)) return CHUNKS.get(key);
    var cs = sc.chunk_sizes[0], off = sc.voxel_offset, sz = sc.size;
    var a = [cx, cy, cz].map(function(c, k){ return off[k] + c * cs[k]; });
    var b = a.map(function(v, k){ return Math.min(v + cs[k], off[k] + sz[k]); });
    var p = (async function(){
      var r = await fetch(SRC + "/" + sc.key + "/" + a[0] + "-" + b[0] + "_" + a[1] + "-" + b[1] + "_" + a[2] + "-" + b[2]);
      if (r.status === 404 || r.status === 403) return { a: a, s: [b[0] - a[0], b[1] - a[1], b[2] - a[2]], nz: new Int32Array(0) };
      if (!r.ok) throw new Error("TriSAM chunk HTTP " + r.status);
      var s = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      return { a: a, s: s, nz: decode(await r.arrayBuffer(), s[0], s[1], s[2], sc.compressed_segmentation_block_size) };
    })();
    CHUNKS.set(key, p);
    try { return await p; } catch (e){ CHUNKS.delete(key); throw e; }
  }

  function boxKey(b){ return [b.xmin, b.ymin, b.zmin, b.xmax, b.ymax, b.zmax].map(Math.round).join(","); }
  function cached(b){ return CACHE.get(boxKey(b)) || null; }

  async function measure(box, opts){
    opts = opts || {};
    var say = opts.say || function(){};
    var k0 = boxKey(box);
    if (CACHE.has(k0)) return CACHE.get(k0);
    var inf = await info();
    var B0 = [box.xmin, box.ymin, box.zmin], B1 = [box.xmax, box.ymax, box.zmax];
    var sc = null, lo, hi, ch;
    for (var m = 0; m < inf.scales.length; m++){
      var s = inf.scales[m], res = s.resolution, cs = s.chunk_sizes[0], off = s.voxel_offset, sz = s.size;
      var l = [0, 1, 2].map(function(k){ return Math.max(Math.ceil(B0[k] / res[k] - 0.5), off[k]); });
      var h = [0, 1, 2].map(function(k){ return Math.min(Math.floor(B1[k] / res[k] - 0.5) + 1, off[k] + sz[k]); });
      var c = [0, 1, 2].map(function(k){ return h[k] > l[k] ? [Math.floor((l[k] - off[k]) / cs[k]), Math.floor((h[k] - 1 - off[k]) / cs[k])] : [0, -1]; });
      var n = (c[0][1] - c[0][0] + 1) * (c[1][1] - c[1][0] + 1) * (c[2][1] - c[2][0] + 1);
      sc = s; lo = l; hi = h; ch = c;
      if (n <= MAX_CHUNKS) break;
    }
    var res0 = sc.resolution, voxUm3 = res0[0] * res0[1] * res0[2] / 1e9;
    var boxUm3 = (B1[0] - B0[0]) * (B1[1] - B0[1]) * (B1[2] - B0[2]) / 1e9;
    var full = [0, 1, 2].map(function(k){ return Math.floor(B1[k] / res0[k] - 0.5) + 1 - Math.ceil(B0[k] / res0[k] - 0.5); });
    var inside = (hi[0] > lo[0] && hi[1] > lo[1] && hi[2] > lo[2])
      ? (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]) / Math.max(1, full[0] * full[1] * full[2]) : 0;
    var list = [];
    if (inside > 0) for (var cz = ch[2][0]; cz <= ch[2][1]; cz++) for (var cy = ch[1][0]; cy <= ch[1][1]; cy++)
      for (var cx = ch[0][0]; cx <= ch[0][1]; cx++) list.push([cx, cy, cz]);
    var nvox = 0, bins = new Map(), done = 0, next = 0;
    async function worker(){
      while (next < list.length){
        var q = list[next++];
        var C = await chunk(sc, q[0], q[1], q[2]);
        var a = C.a, s = C.s, nz = C.nz;
        for (var t = 0; t < nz.length; t++){
          var i = nz[t], x = i % s[0], r = (i - x) / s[0], y = r % s[1], z = (r - y) / s[1];
          var X = a[0] + x, Y = a[1] + y, Z = a[2] + z;
          if (X < lo[0] || X >= hi[0] || Y < lo[1] || Y >= hi[1] || Z < lo[2] || Z >= hi[2]) continue;
          nvox++;
          var bk = Math.floor((X + 0.5) * res0[0] / 1000 / BIN) * 1e8 + Math.floor((Y + 0.5) * res0[1] / 1000 / BIN) * 1e4 + Math.floor((Z + 0.5) * res0[2] / 1000 / BIN);
          bins.set(bk, (bins.get(bk) || 0) + 1);
        }
        done++;
        if (done % 20 === 0 || done === list.length) say("Vessel volume: " + done + " of " + list.length + " TriSAM chunks read…");
      }
    }
    var ws = []; for (var w = 0; w < PAR; w++) ws.push(worker());
    await Promise.all(ws);
    var vesselUm3 = nvox * voxUm3;

    /* by kind */
    var cats = {}, ves = new Map(), untraced = vesselUm3, netErr = "";
    if (nvox){
      try {
        say("Vessel volume: sorting by vessel kind…");
        var N = await net(), q = N.q, S = 6, grid = new Map(), P = [];
        var m0 = B0.map(function(v){ return v / 1000 - 15; }), m1 = B1.map(function(v){ return v / 1000 + 15; });
        for (var k = 0, D = N.own.length; k < D; k++){
          var px = N.dq[k * 3] * q, py = N.dq[k * 3 + 1] * q, pz = N.dq[k * 3 + 2] * q;
          if (px < m0[0] || px > m1[0] || py < m0[1] || py > m1[1] || pz < m0[2] || pz > m1[2]) continue;
          var j = P.length; P.push([px, py, pz, N.own[k]]);
          var gk = Math.floor(px / S) * 1e6 + Math.floor(py / S) * 1e3 + Math.floor(pz / S);
          var L = grid.get(gk); if (!L){ L = []; grid.set(gk, L); } L.push(j);
        }
        untraced = 0;
        bins.forEach(function(cnt, bk){
          var bz = bk % 1e4, r1 = (bk - bz) / 1e4, by = r1 % 1e4, bx = (r1 - by) / 1e4;
          var c = [(bx + 0.5) * BIN, (by + 0.5) * BIN, (bz + 0.5) * BIN];
          var gx = Math.floor(c[0] / S), gy = Math.floor(c[1] / S), gz = Math.floor(c[2] / S);
          var best = -1, bd = 12;
          for (var dx = -2; dx <= 2; dx++) for (var dy = -2; dy <= 2; dy++) for (var dz = -2; dz <= 2; dz++){
            var LL = grid.get((gx + dx) * 1e6 + (gy + dy) * 1e3 + gz + dz); if (!LL) continue;
            for (var u = 0; u < LL.length; u++){
              var p = P[LL[u]], dd = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
              if (dd < bd){ bd = dd; best = LL[u]; }
            }
          }
          var v = cnt * voxUm3;
          if (best < 0){ untraced += v; return; }
          var node = P[best][3];
          if (bd > Math.max(N.rad[node] + 3, 5)){ untraced += v; return; }
          var cn = N.meta.cats[N.cat[node]], id = N.vid[node], key = id + "|" + cn;
          cats[cn] = (cats[cn] || 0) + v;
          var R = ves.get(key); if (!R){ R = { id: id, cat: cn, um3: 0, sx: 0, sy: 0, sz: 0 }; ves.set(key, R); }
          R.um3 += v; R.sx += v * c[0]; R.sy += v * c[1]; R.sz += v * c[2];
        });
      } catch (e){
        netErr = "the traced vessel network could not be read (" + (e && e.message || e) + "), so the volume is not sorted by kind";
        cats = {}; ves = new Map(); untraced = vesselUm3;
      }
    }
    var vessels = Array.from(ves.values()).map(function(R){
      return { id: R.id, cat: R.cat, name: NAMES[R.cat] || R.cat, um3: R.um3, c: [R.sx / R.um3, R.sy / R.um3, R.sz / R.um3] };
    }).sort(function(a, b){ return b.um3 - a.um3; });
    var out = { box: box, boxUm3: boxUm3, resNm: res0.slice(), scale: sc.key, chunks: list.length, voxels: nvox,
      vesselUm3: vesselUm3, fraction: boxUm3 ? vesselUm3 / boxUm3 : 0, inside: inside,
      cats: cats, untracedUm3: untraced, vessels: vessels, netError: netErr };
    CACHE.set(k0, out);
    return out;
  }

  function catRows(r){
    var rows = [];
    ORDER.concat(Object.keys(r.cats).filter(function(c){ return ORDER.indexOf(c) < 0; })).forEach(function(cn){
      if (r.cats[cn]) rows.push({ cat: cn, name: NAMES[cn] || cn, um3: r.cats[cn] });
    });
    if (r.untracedUm3 > 0) rows.push({ cat: "untraced", name: UNTRACED, um3: r.untracedUm3 });
    return rows;
  }
  function f(v, d){ return Number(v.toFixed(d)); }

  /* The "Vasculature" sheet: one block per box -- the box, all vessels, then each kind, then each
     traced vessel segment. results: [{label, r}] */
  function sheetRows(results){
    var A = [["Vessel volume in each region box — " + CITE],
      ["Every TriSAM vessel voxel whose centre is inside the box. Kinds from the traced vessel network (nearest traced vessel within its radius + 3 µm, at least 5 µm); "
        + "vessel voxels further from every traced vessel are \"" + UNTRACED + "\". TriSAM's label follows the lumen (it matches the traced lumen outlines), so this is luminal volume, without the vessel wall."],
      [],
      ["Box", "Level", "Kind", "Vessel id", "Volume (µm³)", "% of vessel volume", "% of box volume", "Centre x (µm)", "Centre y (µm)", "Centre z (µm)",
       "Box volume (µm³)", "TriSAM voxel (nm)", "Note"]];
    results.forEach(function(o){
      var r = o.r, lab = o.label, V = r.vesselUm3, pv = function(v){ return V ? f(100 * v / V, 2) : 0; }, pb = function(v){ return r.boxUm3 ? f(100 * v / r.boxUm3, 3) : 0; };
      var note = (r.inside < 0.999 ? "only " + Math.round(r.inside * 100) + "% of this box lies inside the TriSAM volume. " : "") + (r.netError || "");
      A.push([lab, "box total", "all vessels", "", f(V, 2), V ? 100 : 0, pb(V), "", "", "", f(r.boxUm3, 1), r.resNm.join(" x "), note]);
      catRows(r).forEach(function(c){ A.push([lab, "kind", c.name, "", f(c.um3, 2), pv(c.um3), pb(c.um3), "", "", "", "", "", ""]); });
      r.vessels.forEach(function(s){
        A.push([lab, "vessel segment", s.name, s.id, f(s.um3, 2), pv(s.um3), pb(s.um3), f(s.c[0], 1), f(s.c[1], 1), f(s.c[2], 1), "", "", ""]);
      });
    });
    return A;
  }

  /* A short readout for the region-box panel. */
  function html(label, r){
    var V = r.vesselUm3;
    var h = "<div style=\"margin-top:6px\"><b>" + label + "</b>: vessel volume <b>" + V.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " µm³</b> = "
      + (100 * r.fraction).toFixed(2) + "% of " + r.boxUm3.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " µm³"
      + (r.inside < 0.999 ? " <span style=\"color:#f0883e\">(only " + Math.round(r.inside * 100) + "% of the box is inside TriSAM)</span>" : "")
      + "<table style=\"font-size:11px;margin-top:3px;border-collapse:collapse\">";
    catRows(r).forEach(function(c){
      h += "<tr><td style=\"padding:0 10px 0 0\">" + c.name + "</td><td style=\"text-align:right;padding:0 8px 0 0\">" + c.um3.toLocaleString(undefined, { maximumFractionDigits: 0 })
        + " µm³</td><td style=\"text-align:right\">" + (V ? (100 * c.um3 / V).toFixed(1) : "0") + "%</td></tr>";
    });
    h += "</table><span class=\"hint\">" + r.vessels.length + " traced vessel segment" + (r.vessels.length === 1 ? "" : "s")
      + " · lumen, not wall · TriSAM " + r.resNm.join("×") + " nm voxels · " + r.chunks + " chunks" + (r.netError ? " · " + r.netError : "") + "</span></div>";
    return h;
  }

  /* The same count in a notebook. */
  var PY = "# VESSEL VOLUME IN THIS BOX -- Wan & Wei's TriSAM vessel segmentation of minnie65\n#   Wan & Wei 2025, IEEE J Biomed Health Inform, https://doi.org/10.1109/JBHI.2025.3576643\n#   data: https://bossdb.org/project/wei2024 (open access)\n# Counts every vessel voxel whose centre lies inside the box, at TriSAM's finest level\n# (256 x 256 x 1280 nm per voxel), and sorts the vessel volume by kind with the traced vessel\n# network on the page (S\u00f8ren Grubb's tracings): each vessel voxel takes the kind of the nearest\n# traced vessel point within max(that vessel's radius + 3 \u00b5m, 5 \u00b5m). Vessel voxels with no traced\n# vessel that near are \"untraced vessels\" -- mostly capillaries beyond 3rd order.\n# TriSAM's label follows the lumen (it matches the traced lumen outlines of penetrating arterioles\n# and venules), so this is luminal volume, without the vessel wall.\n# The same numbers as \"Vessel volume\" in the page's region-box panel and the \"Vasculature\" sheet.\nimport numpy as np, urllib.request, json, csv, os\nfrom cloudvolume import CloudVolume\n\nVV_SRC = __SRC__\nVV_NET = __NET__\nVV_BOX_NM = __BOX__          # [[xmin, ymin, zmin], [xmax, ymax, zmax]] in nm, minnie65\nVV_LABEL = __LABEL__\nVV_CSV = __CSV__\nVV_NAMES = __NAMES__\n\ndef _vv_net(base):\n    meta = json.loads(urllib.request.urlopen(base + 'meta.json', timeout=60).read())\n    buf = urllib.request.urlopen(base + 'net.bin', timeout=120).read()\n    n, e, d = meta['n'], meta['e'], meta['d']; o = 0\n    o += n * 12\n    rad = np.frombuffer(buf, np.float32, n, o); o += n * 4\n    vid = np.frombuffer(buf, np.uint32, n, o); o += n * 4\n    cat = np.frombuffer(buf, np.uint8, n, o); o += n + (4 - n % 4) % 4\n    o += e * 8\n    dq = np.frombuffer(buf, np.uint16, d * 3, o).reshape(-1, 3); o += d * 6 + (4 - (d * 6) % 4) % 4\n    own = np.frombuffer(buf, np.uint32, d, o)\n    return meta, rad, vid, cat, dq.astype(np.float64) * meta['quant'], own\n\nvv = CloudVolume(VV_SRC, mip=0, use_https=True, fill_missing=True, progress=False, bounded=False)\nres = np.array(vv.resolution, float)                        # nm per voxel\nB0, B1 = np.array(VV_BOX_NM[0], float), np.array(VV_BOX_NM[1], float)\nlo = np.ceil(B0 / res - 0.5).astype(int); hi = np.floor(B1 / res - 0.5).astype(int) + 1   # voxel centres inside\nbox_um3 = float(np.prod((B1 - B0) / 1000))\nlo_c = np.maximum(lo, np.array(vv.bounds.minpt)); hi_c = np.minimum(hi, np.array(vv.bounds.maxpt))\nvox_um3 = float(np.prod(res / 1000))\ninside = float(np.prod(np.maximum(hi_c - lo_c, 0))) / max(float(np.prod(np.maximum(hi - lo, 0))), 1)\nprint(f'{VV_LABEL}: {(B1-B0)[0]/1000:.1f} x {(B1-B0)[1]/1000:.1f} x {(B1-B0)[2]/1000:.1f} \u00b5m = {box_um3:,.0f} \u00b5m\u00b3; '\n      f'TriSAM at {res[0]:.0f} x {res[1]:.0f} x {res[2]:.0f} nm, {np.prod(np.maximum(hi - lo, 0)):,} voxels'\n      + ('' if inside > 0.999 else f' -- only {inside*100:.0f}% of the box is inside the TriSAM volume'))\n\n# read in slabs along y (depth), so a tall column never needs its whole array at once\nBIN = 2.0                                                   # \u00b5m: vessel voxels sorted by kind per 2 \u00b5m cube\nbins = {}\nnvox = 0\nif np.all(hi_c > lo_c):\n    step = max(1, int(4e7 // max(1, (hi_c[0] - lo_c[0]) * (hi_c[2] - lo_c[2]))))\n    for y0 in range(lo_c[1], hi_c[1], step):\n        y1 = min(hi_c[1], y0 + step)\n        a = np.asarray(vv[lo_c[0]:hi_c[0], y0:y1, lo_c[2]:hi_c[2]])[..., 0]\n        ix, iy, iz = np.nonzero(a)\n        if not len(ix): continue\n        nvox += len(ix)\n        p = (np.stack([ix + lo_c[0], iy + y0, iz + lo_c[2]], 1) + 0.5) * res / 1000     # \u00b5m\n        k, c = np.unique(np.floor(p / BIN).astype(np.int64), axis=0, return_counts=True)\n        for kk, cc in zip(map(tuple, k), c): bins[kk] = bins.get(kk, 0) + int(cc)\nvessel_um3 = nvox * vox_um3\n\n# sort by kind with the traced network\nrows_cat, rows_ves, untraced = {}, {}, 0.0\ntry:\n    from scipy.spatial import cKDTree\n    meta, rad, vid, cat, pts, own = _vv_net(VV_NET)\n    m = np.all((pts >= B0 / 1000 - 15) & (pts <= B1 / 1000 + 15), 1)\n    P, O = pts[m], own[m]\n    keys = np.array(list(bins.keys()), float).reshape(-1, 3); cnt = np.array(list(bins.values()), float)\n    if len(P) and len(keys):\n        d, j = cKDTree(P).query((keys + 0.5) * BIN, distance_upper_bound=12.0)\n        ok = np.isfinite(d)\n        jj = np.where(ok, j, 0); node = O[jj]\n        ok &= d <= np.maximum(rad[node] + 3.0, 5.0)\n        for i in np.nonzero(ok)[0]:\n            cn = meta['cats'][cat[node[i]]]; v = cnt[i] * vox_um3\n            rows_cat[cn] = rows_cat.get(cn, 0.0) + v\n            key = (int(vid[node[i]]), cn); r = rows_ves.setdefault(key, [0.0, np.zeros(3)])\n            r[0] += v; r[1] += v * (keys[i] + 0.5) * BIN\n        untraced = float(cnt[~ok].sum() * vox_um3)\n    else:\n        untraced = vessel_um3\nexcept Exception as e:\n    print('the traced vessel network could not be read (%r) -- totals only' % (e,))\n    untraced = vessel_um3\n\nprint(f'\\nvessel volume  {vessel_um3:,.1f} \u00b5m\u00b3  = {100 * vessel_um3 / box_um3 if box_um3 else 0:.2f}% of the box')\nORDER = ['pial_art', 'pa', 'acap1', 'acap2', 'acap3', 'vcap3', 'vcap2', 'vcap1', 'av', 'pial_ven']\nout = [['level', 'kind', 'vessel id', 'volume (\u00b5m\u00b3)', '% of vessel volume', '% of box', 'centre x (\u00b5m)', 'centre y (\u00b5m)', 'centre z (\u00b5m)']]\nout.append(['box', 'all vessels', '', round(vessel_um3, 2), 100.0 if vessel_um3 else 0, round(100 * vessel_um3 / box_um3, 3) if box_um3 else 0, '', '', ''])\nfor cn in ORDER + sorted(set(rows_cat) - set(ORDER)):\n    if cn in rows_cat:\n        v = rows_cat[cn]; print(f'  {VV_NAMES.get(cn, cn):32s} {v:12,.1f} \u00b5m\u00b3  {100 * v / vessel_um3:5.1f}%')\n        out.append(['kind', VV_NAMES.get(cn, cn), '', round(v, 2), round(100 * v / vessel_um3, 2), round(100 * v / box_um3, 3), '', '', ''])\nif untraced > 0:\n    print(f'  {\"untraced vessels\":32s} {untraced:12,.1f} \u00b5m\u00b3  {100 * untraced / vessel_um3:5.1f}%')\n    out.append(['kind', 'untraced vessels (mostly capillaries beyond 3rd order)', '', round(untraced, 2),\n                round(100 * untraced / vessel_um3, 2), round(100 * untraced / box_um3, 3), '', '', ''])\nfor (v_id, cn), (v, c) in sorted(rows_ves.items(), key=lambda t: -t[1][0]):\n    cc = c / v\n    out.append(['vessel segment', VV_NAMES.get(cn, cn), v_id, round(v, 2), round(100 * v / vessel_um3, 2), round(100 * v / box_um3, 3),\n                round(cc[0], 1), round(cc[1], 1), round(cc[2], 1)])\nprint(f'{len(rows_ves)} traced vessel segments in the box')\nos.makedirs(os.path.dirname(VV_CSV) or '.', exist_ok=True)\nwith open(VV_CSV, 'w', newline='') as f:\n    w = csv.writer(f)\n    w.writerow([f'# {VV_LABEL}: box {box_um3:.1f} \u00b5m\u00b3; TriSAM voxel {res[0]:.0f}x{res[1]:.0f}x{res[2]:.0f} nm; '\n                'Wan & Wei 2025 doi:10.1109/JBHI.2025.3576643; kinds from the traced vessel network'])\n    w.writerows(out)\nprint('saved', VV_CSV)\n";
  function pyStr(s){ return JSON.stringify(String(s)); }
  function notebookCells(o){
    var b = o.boxNM, netAbs;
    try { netAbs = new URL(NET, location.href).href; } catch (_e){ netAbs = "https://www.grubblab.com/" + NET; }
    if (!/^https?:/.test(netAbs)) netAbs = "https://www.grubblab.com/" + NET;
    var code = PY.replace("__SRC__", pyStr("precomputed://" + SRC))
      .replace("__NET__", pyStr(netAbs))
      .replace("__BOX__", "[[" + [b.xmin, b.ymin, b.zmin].map(Number).join(", ") + "], [" + [b.xmax, b.ymax, b.zmax].map(Number).join(", ") + "]]")
      .replace("__LABEL__", pyStr(o.label || "box"))
      .replace("__CSV__", pyStr(o.csv || "vascular_volume.csv"))
      .replace("__NAMES__", JSON.stringify(NAMES));
    var md = "## Vessel volume in this box\n\nThe blood-vessel volume inside the box from Wan & Wei's TriSAM segmentation of minnie65 "
      + "([Wan & Wei 2025](https://doi.org/10.1109/JBHI.2025.3576643); data: [BossDB wei2024](https://bossdb.org/project/wei2024)), "
      + "sorted by vessel kind with the traced vessel network. Saved as `" + (o.csv || "vascular_volume.csv") + "`. "
      + "The same numbers as \"Vessel volume\" in the page's region-box panel and the \"Vasculature\" sheet of the Filter-and-show download. "
      + "Runs whatever else is ticked; a failure here is reported and does not stop the rest.";
    return [{ md: md }, { code: "try:\n" + code.split("\n").map(function(l){ return l ? "    " + l : l; }).join("\n")
      + (o.download ? "\n    try:\n        from google.colab import files as _vvf\n        _vvf.download(VV_CSV)\n    except Exception:\n        pass" : "")
      + "\nexcept Exception as _e:\n    print('vessel volume failed, carrying on without it:', repr(_e))" }];
  }

  return { measure: measure, cached: cached, sheetRows: sheetRows, html: html, notebookCells: notebookCells,
           available: available, NAMES: NAMES, _decode: decode, _cfg: function(o){ if (o.src) SRC = o.src; if (o.net) NET = o.net; CACHE.clear(); CHUNKS.clear(); INFO = null; NETP = null; } };
})();
