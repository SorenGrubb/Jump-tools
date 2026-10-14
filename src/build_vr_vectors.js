/* Builds core/vr_vectors_microns.json -- the verified nucleus→centriole and cilium base→tip vectors,
   for vr.html. 2026-10-14.

   Søren: "I meant that the vector between the nucleus and centrioles should be shown as 3D arrows.
   We should have the same from primary cilium base to tip." Filter-and-show draws these two vector
   layers from TWO sources; the community reports (?allOrganelles=1) vr.html reads live, and Søren's
   own verified dataset, which lives only inside ujump.html. This file carries the second:

   · nucleus-table cells with a verified centriole / cilium -- ownOverride(i), anchored on the
     nucleus table's own position for that nucleus (NX/NY/NZ), exactly as buildFilterViewerState does;
   · standalone verified points (Img35 / out-of-region) -- ST_X/Y/Z with ST_CENT* and ST_CIL*.

   Rows, in µm (one decimal):  cent: [nucleusId or "", from x,y,z, to x,y,z]
                               cil:  [nucleusId or "", base x,y,z, tip x,y,z]

   ujump.html is loaded in headless Chromium with all network requests refused.
   Usage: node src/build_vr_vectors.js ujump.html core/vr_vectors_microns.json */
const fs = require("fs"), path = require("path");
let pw; try { pw = require("playwright"); } catch (e){ pw = require("/opt/npm-tools/node_modules/playwright"); }
(async () => {
  const src = path.resolve(process.argv[2]), dst = process.argv[3];
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  await p.route(/^https?:/, r => r.abort());
  await p.goto("file://" + src, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForFunction(() => typeof ownOverride === "function" && typeof ST_N === "number", null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const um = (v, k) => Math.round(v * [UJ_RX, UJ_RY, UJ_RZ][k] / 100) / 10;
    const P = v => [um(v[0], 0), um(v[1], 1), um(v[2], 2)];
    const cent = [], cil = [];
    for (let i = 0; i < NX.length; i++){
      const own = ownOverride(i); if (!own) continue;
      const nid = typeof NID !== "undefined" ? String(NID[i]) : "";
      if (own.centriole) cent.push([nid, ...P([NX[i], NY[i], NZ[i]]), ...P(own.centriole)]);
      if (own.cilium) cil.push([nid, ...P(own.cilium[0]), ...P(own.cilium[1])]);
    }
    for (let i = 0; i < ST_N; i++){
      if (ST_HASCENT[i]) cent.push(["", ...P([ST_X[i], ST_Y[i], ST_Z[i]]), ...P([ST_CENTX[i], ST_CENTY[i], ST_CENTZ[i]])]);
      if (ST_HASCIL[i]) cil.push(["", ...P([ST_CILSX[i], ST_CILSY[i], ST_CILSZ[i]]), ...P([ST_CILEX[i], ST_CILEY[i], ST_CILEZ[i]])]);
    }
    return { cent, cil };
  });
  await b.close();
  const out = { source: "ujump.html own verified dataset (ownOverride + STANDALONE), as Filter-and-show's vector layers", unit: "um", cent: r.cent, cil: r.cil };
  fs.writeFileSync(dst, JSON.stringify(out));
  console.log("centriole vectors", r.cent.length, "cilium vectors", r.cil.length, "bytes", fs.statSync(dst).size, "e.g.", JSON.stringify(r.cent[0]), JSON.stringify(r.cil[0]));
})();
