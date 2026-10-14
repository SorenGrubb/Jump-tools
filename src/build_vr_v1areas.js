/* Builds core/vr_v1areas_microns.json -- the V1 column and the four visual areas, for vr.html. 2026-10-14.

   Søren: "We should add the V1 column that we also have in filter and show, and also the visual
   areas." Both are taken from ujump.html AS IT RUNS, not re-derived here, so the viewer shows exactly
   what Filter-and-show filters on:

   · the V1 column envelope -- window.V1_COLUMN_BOUNDARY after ujump.html's own fit (vertical down to
     the Layer 5b/6a boundary, slanted below it, radius = 95th percentile distance from the local
     axis), and the 1,899 members of Allen's hand-classified column (window.V1_COLUMN_MEMBERS) with
     their positions and N (neuron) / G (non-neuronal) kind;
   · the four area walls -- the `areadata` block's BR branches (pia polyline paired vertex-for-vertex
     with a white-matter one, Int16 µm), which are the gs://allen-minnie-phase3/areameshes walls that
     areaAtNm() classifies against, plus NEXTSEC/PREVSEC so vr.html can name a cell's area the same way;
   · a label position per area: the median x/z of a 1-in-7 sample of its nuclei.

   ujump.html is loaded in headless Chromium with all network requests refused; only its embedded
   data and inline scripts run.

   Usage: node src/build_vr_v1areas.js ujump.html core/vr_v1areas_microns.json
   (needs Playwright; in the Claude workspace: require("/opt/npm-tools/node_modules/playwright")) */
const fs = require("fs"), path = require("path");
let pw; try { pw = require("playwright"); } catch (e){ pw = require("/opt/npm-tools/node_modules/playwright"); }
(async () => {
  const src = path.resolve(process.argv[2]), dst = process.argv[3];
  const html = fs.readFileSync(src, "utf8");
  const AD = JSON.parse(html.match(/id="areadata">([\s\S]*?)<\/script>/)[1]);
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  await p.route(/^https?:/, r => r.abort());
  await p.goto("file://" + src, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForFunction(() => window.V1_COLUMN_BOUNDARY && window.areaOfIndex, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const B = window.V1_COLUMN_BOUNDARY, M = window.V1_COLUMN_MEMBERS, um = v => Math.round(v / 100) / 10;
    const members = [];
    for (const k in M){ const i = +k; members.push([um(NX[i]*UJ_RX), um(NY[i]*UJ_RY), um(NZ[i]*UJ_RZ), M[k].k || ""]); }
    const s = [0,1,2,3].map(() => ({ x: [], z: [] }));
    for (let i = 0; i < NX.length; i += 7){ const a = areaOfIndex(i); if (a == null) continue; s[a].x.push(NX[i]*UJ_RX/1000); s[a].z.push(NZ[i]*UJ_RZ/1000); }
    const med = a => { a = a.slice().sort((p, q) => p - q); return Math.round(a[a.length >> 1]); };
    return {
      v1: { r: um(B.r), yLo: um(B.yLo), yHi: um(B.yHi), breakY: B.breakY == null ? null : um(B.breakY),
            ux: um(B.upperCx), uz: um(B.upperCz), sx: +B.axisSlopeX.toFixed(4), sz: +B.axisSlopeZ.toFixed(4), n: B.n, members },
      areas: [0,1,2,3].map(k => ({ name: AREA_NAMES[k], count: AREA_COUNTS[k], x: med(s[k].x), z: med(s[k].z) }))
    };
  });
  await b.close();
  const out = {
    source: "ujump.html: V1_COLUMN_BOUNDARY / V1_COLUMN_MEMBERS (Allen allen_v1_column_types_slanted_ref + aibs_column_nonneuronal_ref) and areadata (gs://allen-minnie-phase3/areameshes)",
    unit: "um", v1: r.v1, areas: r.areas,
    areaWalls: { note: "ujump.html areadata BR: per wall branch, Int16 um, six numbers per vertex (pia x,y,z then white-matter x,y,z), junction first; NEXTSEC/PREVSEC as in areaAtNm",
                 BR: [0,1,2,3].map(k => AD.BR[k]), NEXTSEC: [2,1,3,0], PREVSEC: [0,2,1,3] }
  };
  fs.writeFileSync(dst, JSON.stringify(out));
  console.log("members", r.v1.members.length, "areas", r.areas.map(a => a.name + " @" + a.x + "," + a.z).join(" · "), "bytes", fs.statSync(dst).size);
})();
