/* Builds core/vr_layers_microns.json -- the pia and white-matter surfaces µJump traces, sampled on a
   coarse x/z grid, for vr.html to draw the cortical layer boundaries with. 2026-10-13.

   Same inputs and same maths as ujump.html's estimateLayer(): the `layerdata` block (PIA/WM point
   clouds, nm), SURFACE_Y_OFFSET_NM applied, idwSurfaceY with k=8, and Ledderose's boundaries
   scaled to the local thickness (LEDDEROSE_ABS_BOUNDS / LEDDEROSE_REF_THICK_UM). A 40 x 20 grid
   is ~40 µm spacing -- the surfaces vary over hundreds of µm, and vr.html interpolates between.

   Usage: node src/build_vr_layers.js ujump.html core/vr_layers_microns.json */
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const LD = JSON.parse(html.match(/<script type="application\/json" id="layerdata">([\s\S]*?)<\/script>/)[1]);
const off = Number((html.match(/const SURFACE_Y_OFFSET_NM\s*=\s*(-?[\d.]+)/) || [0, 0])[1]);
const ref = Number(html.match(/LEDDEROSE_REF_THICK_UM\s*=\s*([\d.]+)/)[1]);
const bounds = JSON.parse(html.match(/LEDDEROSE_ABS_BOUNDS\s*=\s*(\[[\s\S]*?\]\s*\]);/)[1].replace(/'/g, '"'));
const f32 = s => new Float32Array(Buffer.from(s, "base64").buffer.slice(0));
function cloud(o){
  const b = k => { const buf = Buffer.from(o[k], "base64"); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); };
  const Y = Float32Array.from(b("Y"), v => v + off);
  return { X: b("X"), Y, Z: b("Z"), N: o.N };
}
const PIA = cloud(LD.PIA), WM = cloud(LD.WM);
function idw(qx, qz, C, k){
  const best = [];
  for (let i = 0; i < C.N; i++){
    const dx = qx - C.X[i], dz = qz - C.Z[i], d2 = dx*dx + dz*dz;
    if (best.length < k){ best.push({ d2, y: C.Y[i] }); best.sort((a, b) => a.d2 - b.d2); }
    else if (d2 < best[k-1].d2){ best[k-1] = { d2, y: C.Y[i] }; best.sort((a, b) => a.d2 - b.d2); }
  }
  if (best[0].d2 < 1) return best[0].y;
  let w = 0, s = 0; for (const b of best){ const ww = 1/(b.d2 + 1); w += ww; s += ww*b.y; }
  return s / w;
}
const nx = 40, nz = 20, x0 = 150000, x1 = 1750000, z0 = 317000, z1 = 1112000, pia = [], wm = [];
for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++){
  const x = x0 + (x1 - x0)*i/nx, z = z0 + (z1 - z0)*j/nz;
  pia.push(Math.round(idw(x, z, PIA, 8)/100)/10);
  wm.push(Math.round(idw(x, z, WM, 8)/100)/10);
}
let tx0 = Infinity, tx1 = -Infinity;
for (let i = 0; i < PIA.N; i++){ tx0 = Math.min(tx0, PIA.X[i]); tx1 = Math.max(tx1, PIA.X[i]); }
const out = { source: "ujump.html layerdata (traced pia + white matter), Ledderose layer proportions",
  unit: "um", grid: { x0: x0/1000, x1: x1/1000, z0: z0/1000, z1: z1/1000, nx, nz },
  refThickUm: ref, layers: bounds, pia, wm };
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log("pia[0..2]", pia.slice(0,3), "wm[0..2]", wm.slice(0,3), "n", pia.length, "bounds", bounds.length, "offset", off, "ref", ref);
