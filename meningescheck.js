// node meningescheck.js — the meninges surfaces build, with sane sizes and no stray long triangles. 2026-11-06
require("./core/traceloft.js"); const M = require("./core/meninges.js");
const D = JSON.parse(require("fs").readFileSync(__dirname + "/data/meninges/minnie65.json", "utf8"));
let bad = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
{ const P = [], I = []; const n = M.stitch([[0,0],[4,0],[8,0],[12,0]], 0, [[6,0],[10,0],[14,0]], 4, P, I);
  ok(n >= 3, "toy stitch makes " + n + " triangles"); }
for (const l of D.layers){
  const g = l.kind === "sheet" ? M.sheet(l) : M.rings(l, UJ.traceloft.loft);
  const nv = g.positions.length / 3, nt = g.indices.length / 3;
  let maxE = 0; const bb = [1e9,1e9,1e9,-1e9,-1e9,-1e9];
  for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++){ const v = g.positions[i*3+a]; bb[a] = Math.min(bb[a], v); bb[a+3] = Math.max(bb[a+3], v); }
  if (l.kind === "sheet") for (let t = 0; t < g.indices.length; t += 3){
    const p = k => [g.positions[g.indices[t+k]*3], g.positions[g.indices[t+k]*3+1], g.positions[g.indices[t+k]*3+2]];
    for (const [a, b] of [[0,1],[1,2],[2,0]]){ const A = p(a), B = p(b); maxE = Math.max(maxE, Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2])); }
  }
  console.log(l.name.padEnd(34), "verts", nv, "tris", nt, "lines", g.lines.length / 6, l.kind === "rings" ? "closed rings " + g.closed : "max edge " + maxE.toFixed(1),
    "box", bb.map(v => v.toFixed(0)).join(","), "anchor", M.anchor(l).map(v => v.toFixed(0)).join(","));
  ok(nt > 0, l.name + " has a surface");
  ok(bb.every(Number.isFinite) && bb[0] > 0 && bb[3] < 2000 && bb[5] < 1200, l.name + " lies in the µm frame");
  ok(maxE <= M.MAX_EDGE + 1e-3, l.name + " no sheet triangle edge over " + M.MAX_EDGE + " µm");
}
ok(D.points.Arterioles.p.length === 12 && D.points.Venules.p.length === 25, "12 arteriole and 25 venule points");
process.exit(bad ? 1 : 0);
