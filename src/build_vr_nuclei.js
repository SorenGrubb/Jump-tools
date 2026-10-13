/* Builds core/vr_nuc/microns/ -- ujump.html's nucleus table (the `nucdata` block: position, MICrONS
   cell-type prediction, nucleus id, root id) cut into 100 µm x/z tiles, so vr.html can find a cell's
   neighbours by fetching one or a few ~60 KB files instead of the 10 MB page. 2026-10-13.

   Each tile: {"rows": [[x_um, y_um, z_um, typeIndex, nucleusId, rootId|""], ...]}, positions in µm
   in the MICrONS frame (tool voxels x 4/4/40 nm), typeIndex into index.json's "types" (0 = none).

   Usage: node src/build_vr_nuclei.js ujump.html core/vr_nuc/microns */
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(process.argv[2], "utf8"), out = process.argv[3];
const D = JSON.parse(html.match(/<script type="application\/json" id="nucdata">([\s\S]*?)<\/script>/)[1]);
const buf = s => Buffer.from(s, "base64");
const u32 = s => { const b = buf(s); return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const u16 = s => { const b = buf(s); return new Uint16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const NX = u32(D.XB), NY = u32(D.YB), NZ = u16(D.ZB), NT = buf(D.TB), NH = buf(D.HB), NLO = u32(D.LB), NID = u32(D.NB);
const RES = [4, 4, 40], TILE = 100;
/* The page's own short names for the type codes ("23P" -> "L2/3 pyramidal"), so a neighbour is
   labelled the way the Jump tab labels it. */
const LABELS = JSON.parse(html.match(/const LABELS=(\{[^;]*?\});/)[1]);
const tiles = {};
for (let i = 0; i < D.N; i++){
  const x = NX[i] * RES[0] / 1000, y = NY[i] * RES[1] / 1000, z = NZ[i] * RES[2] / 1000;
  const root = NH[i] === 255 ? "" : (BigInt(D.HI[NH[i]]) * 4294967296n + BigInt(NLO[i] >>> 0)).toString();
  const k = Math.floor(x / TILE) + "_" + Math.floor(z / TILE);
  (tiles[k] = tiles[k] || []).push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), NT[i], NID[i], root]);
}
fs.mkdirSync(out, { recursive: true });
let bytes = 0;
for (const k in tiles){ const s = JSON.stringify({ rows: tiles[k] }); bytes += s.length; fs.writeFileSync(path.join(out, k + ".json"), s); }
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify({ tileUm: TILE, types: ["Unclassified"].concat(D.CT_NAMES), labels: LABELS, n: D.N, tiles: Object.keys(tiles) }));
console.log("nuclei", D.N, "tiles", Object.keys(tiles).length, "bytes", bytes, "types", D.CT_NAMES.length);
