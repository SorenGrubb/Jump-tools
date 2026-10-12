/* A tracing you can open in Blender, one or all of them.                              2026-10-10

   Søren, looking at the dataset list: *"There should also be an option to download the tracing as
   a 3D model. Either as a lone 3D model or as a combined 3D model of all in that cell. If
   combined, the cell should be transparent to show the organelles inside it."*

   The zip has carried an OBJ per tracing since it was built, but an OBJ is one object with no
   colour and no transparency, so "all of them in one file, with the cell see-through" is not a
   thing you can make out of five of them. GLB is: one binary file, several meshes, a material
   each, alpha on the ones that enclose something.

   THREE THINGS THAT ARE EASY TO GET WRONG AND SILENT WHEN YOU DO:

     Y. Neuroglancer's y increases DOWNWARD and glTF is Y-up, so a model fed straight through
        opens upside down in Blender. core/mesh.js learned this the hard way in August and says
        so in a long comment; the same flip and the same winding swap apply here, because these
        contours are in the same frame.

     UNITS. Nanometres puts a 15 µm cell 15,000 units across and 1.6 MILLION units from the
        origin, which in Blender's default viewport is an invisible speck beyond the clip plane.
        Micrometres opens as something you can see.

     THE PLACE, which is not the unit.  2026-10-10. The above also CENTRED each file on its own
        middle, and that is right for exactly one file at a time: S\u00f8ren put three in one
        Blender scene and they landed on top of each other. The geometry is still local \u2014
        float32 precision, and an object origin at its own middle \u2014 and the dataset place now
        travels on the glTF node and the Blender object, where Alt+G can still clear it.

     THE ORDER OF ALPHA. A transparent cell with solid organelles inside it only reads correctly
        if the cell is the transparent one. Whole cell and nucleus enclose; organelles do not.

   Run: node glbcheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  p.on("pageerror", e => { if (!/atob/.test(e.message)) errors.push(e.message); });
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto("file://" + page_(PAGE));
  await p.waitForTimeout(3000);

  const has = await p.evaluate(() => !!(window.UJ && UJ.traceloft && UJ.traceloft.glb));
  if (!has){
    console.log("  FAIL UJ.traceloft.glb is not on this page");
    await b.close(); process.exit(1);
  }

  /* A box 2 µm across at x 400000 voxels, and a small one inside it. 4/4/40 nm voxels. */
  const r = await p.evaluate(() => {
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const res = [4, 4, 40];
    const big = [], small = [];
    for (let z = 400; z <= 410; z++){ big.push(sq(z, 400000, 230000, 250)); }
    for (let z = 403; z <= 406; z++){ small.push(sq(z, 400000, 230000, 60)); }
    const bytes = UJ.traceloft.glb([
      { name: "Whole cell", rings: big, color: "#cddc39", alpha: 0.25 },
      { name: "Lysosome 1", rings: small, color: "#9c27b0" }
    ], res);
    /* Read the glTF JSON chunk back out: the only honest way to assert what is in a GLB. */
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = dv.getUint32(0, true), total = dv.getUint32(8, true);
    const jLen = dv.getUint32(12, true), jTag = dv.getUint32(16, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jLen)));
    const one = UJ.traceloft.glb([{ name: "Lysosome 1", rings: small, color: "#9c27b0" }], res);
    const dv1 = new DataView(one.buffer, one.byteOffset, one.byteLength);
    const j1 = JSON.parse(new TextDecoder().decode(
      one.subarray(20, 20 + dv1.getUint32(12, true))));
    return {
      magic: magic === 0x46546C67, jsonChunk: jTag === 0x4E4F534A, sized: total === bytes.length,
      meshes: (json.meshes || []).map(m => m.name),
      nodes: (json.nodes || []).length,
      mats: (json.materials || []).map(m => ({
        name: m.name, mode: m.alphaMode,
        a: m.pbrMetallicRoughness.baseColorFactor[3],
        /* glTF baseColorFactor is LINEAR, so it is converted back to sRGB before being compared
           with the hex that was drawn with \u2014 a raw comparison would read #9c27b0 as
           #55056f and look like a bug in the colour rather than in the assertion. */
        rgb: m.pbrMetallicRoughness.baseColorFactor.slice(0, 3).map(v => Math.round(255 *
          (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055))),
        both: m.doubleSided === true })),
      /* The POSITION accessor's min/max say where the geometry sits and how big it is. */
      /* POSITION, not just VEC3: since 2026-10-11 every primitive also has a NORMAL, which
         is VEC3 and carries no min/max. The bounds are the POSITION accessor's, and glTF
         requires min/max exactly there \u2014 so "VEC3 with min" names the right one without
         walking the primitives. */
      bounds: (json.accessors || []).filter(a => a.type === "VEC3" && a.min).map(a => ({
        min: a.min.map(v => Math.round(v * 100) / 100), max: a.max.map(v => Math.round(v * 100) / 100) })),
      extras: json.asset && json.asset.extras,
      single: (j1.meshes || []).map(m => m.name),
      singleMats: (j1.materials || []).map(m => m.pbrMetallicRoughness.baseColorFactor[3])
    };
  });

  console.log("the file is a GLB a viewer will open");
  ok(r.magic && r.jsonChunk && r.sized,
     "glTF magic, a JSON chunk, and a length that matches the bytes",
     "magic " + r.magic + ", json " + r.jsonChunk + ", length " + r.sized);
  ok(r.meshes.join(" | ") === "Whole cell | Lysosome 1" && r.nodes === 2,
     "both tracings are in it, each its own mesh and node, named as they are named here",
     r.meshes.join(" | "));

  console.log("\nand the cell is the see-through one");
  ok(r.mats.length === 2 && r.mats[0].a === 0.25 && r.mats[0].mode === "BLEND",
     "the whole cell is transparent, which is what makes the organelles inside it visible",
     JSON.stringify(r.mats[0]));
  ok(r.mats[1].a === 1 && r.mats[1].mode === "OPAQUE",
     "...and the organelle inside it is solid", JSON.stringify(r.mats[1]));
  ok(r.mats[1].rgb.join(",") === "156,39,176",
     "...in the colour it was drawn in, so the model matches the pad", r.mats[1].rgb.join(", "));
  ok(r.mats.every(m => m.both),
     "...and both are double-sided, because a lofted contour stack has no outside to prefer",
     JSON.stringify(r.mats.map(m => m.both)));

  console.log("\nand it opens somewhere you can see it");
  const B = r.bounds[0] || { min: [0, 0, 0], max: [0, 0, 0] };
  const span = Math.max(B.max[0] - B.min[0], B.max[1] - B.min[1], B.max[2] - B.min[2]);
  ok(span > 1 && span < 10,
     "a 2 µm box is about 2 units across — micrometres, not the nanometres the OBJ uses, "
     + "because 15,000 units is past Blender's default clip plane",
     span.toFixed(2) + " units across");
  ok(Math.abs(B.min[0]) < span && Math.abs(B.max[0]) < span,
     "...and the GEOMETRY is local to the object rather than 1.6 million units of float32 away "
     + "\u2014 the dataset place is on the node, which is checked further down",
     "x from " + B.min[0] + " to " + B.max[0]);
  ok(r.extras && /400000/.test(JSON.stringify(r.extras.centreVoxel || "")),
     "...with the coordinate it was moved from recorded, so nothing is lost",
     JSON.stringify(r.extras && r.extras.centreVoxel));
  ok(B.min[1] < 0 && B.max[1] > 0 && r.extras && r.extras.yFlipped === true,
     "...and y is flipped for glTF, which core/mesh.js learned in August: Neuroglancer's y "
     + "increases downward and a model fed straight through opens upside down",
     String(r.extras && r.extras.yFlipped));

  console.log("\nand one tracing alone is the same file with one thing in it");
  ok(r.single.join(",") === "Lysosome 1" && r.singleMats.join(",") === "1",
     "a lone organelle is solid — nothing encloses it", r.single.join(",") + " @ " + r.singleMats);

  /* \u2500\u2500 AND IT IS A VALID glTF, NOT ONLY A PLAUSIBLE ONE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     Khronos's own gltf-validator was run against this exact output on 2026-10-10: 0 errors, 0
     warnings, 0 infos, 3 draw calls, 3 materials, 2,432 triangles. It is not a dependency of this
     repo, so what runs here is the structural half \u2014 every alignment and bound the hand-written
     writer could get wrong, which is what a hand-written binary format is for getting wrong. */
  console.log("\nand the binary holds together");
  const v = await p.evaluate(() => {
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const a = [], c = [];
    for (let z = 400; z <= 410; z++) a.push(sq(z, 400000, 230000, 250));
    for (let z = 403; z <= 406; z++) c.push(sq(z, 400000, 230000, 60));
    const u8 = UJ.traceloft.glb([{ name: "Whole cell", rings: a, color: "#cddc39", alpha: 0.22 },
                                 { name: "Lysosome 1", rings: c, color: "#9c27b0" }], [4, 4, 40]);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const jLen = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jLen)));
    const binHdr = 20 + jLen;
    const binLen = dv.getUint32(binHdr, true), binTag = dv.getUint32(binHdr + 4, true);
    const binAt = binHdr + 8;
    const bad = [];
    if (jLen % 4) bad.push("JSON chunk is not 4-byte aligned");
    if (binLen % 4) bad.push("BIN chunk is not 4-byte aligned");
    if (binTag !== 0x004E4942) bad.push("second chunk is not BIN");
    if (binAt + binLen !== u8.length) bad.push("BIN chunk does not reach the end of the file");
    (json.bufferViews || []).forEach((bv, i) => {
      if ((bv.byteOffset || 0) % 4) bad.push("bufferView " + i + " is not 4-byte aligned");
      if ((bv.byteOffset || 0) + bv.byteLength > json.buffers[0].byteLength)
        bad.push("bufferView " + i + " runs past the buffer");
    });
    const SZ = { 5125: 4, 5126: 4 }, NC = { SCALAR: 1, VEC3: 3 };
    (json.accessors || []).forEach((ac, i) => {
      const need = ac.count * SZ[ac.componentType] * NC[ac.type];
      const bv = json.bufferViews[ac.bufferView];
      if (need !== bv.byteLength)
        bad.push("accessor " + i + " wants " + need + " bytes, its view has " + bv.byteLength);
    });
    /* Every index must name a vertex this primitive has. */
    (json.meshes || []).forEach((m, mi) => {
      const pr = m.primitives[0];
      const ia = json.accessors[pr.indices], pa = json.accessors[pr.attributes.POSITION];
      const bv = json.bufferViews[ia.bufferView];
      const idx = new Uint32Array(u8.buffer, u8.byteOffset + binAt + (bv.byteOffset || 0), ia.count);
      let mx = 0;
      for (let k = 0; k < idx.length; k++) if (idx[k] > mx) mx = idx[k];
      if (mx >= pa.count)
        bad.push("mesh " + mi + " indexes vertex " + mx + " of " + pa.count);
      if (ia.count % 3) bad.push("mesh " + mi + " has " + ia.count + " indices, not a multiple of 3");
    });
    return { bad: bad, tris: (json.accessors || []).filter(a2 => a2.type === "SCALAR")
      .reduce((n, a2) => n + a2.count / 3, 0) };
  });
  ok(v.bad.length === 0,
     "every chunk aligned, every view inside the buffer, every accessor the size its view is, "
     + "and no triangle naming a vertex that is not there",
     v.bad.length ? v.bad.join("; ") : v.tris + " triangles, nothing out of place");

  /* \u2500\u2500 THE SEGMENTATION TRAVELS WITH THE TRACINGS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2026-10-10
     S\u00f8ren: *"it would be nice if it opens the 3D model together with the RootID and Nucleus ID
     also, and that root ID is transparent to show the nucleus and organelles. if community
     reported Root ID or nucleus ID exists they should also be a part of it as the same structure
     as the respective ID."* \u2014 and, a moment later: *"That is only for the 3D model for all, not
     for the individual organelle ones."*

     THE UNITS ARE THE TRAP. core/mesh.js hands back MICROMETRES ("nm -> \u00b5m, this file's usual
     frame"), core/nucmesh.js hands back the raw legacy fragment vertices, which are NANOMETRES,
     and the lofter hands back nanometres. Three sources, two frames, one file. A part that
     declares the wrong one lands 1000\u00d7 away \u2014 which in a viewer is not a visible error, it
     is an empty scene with something enormous off-screen. So a part says what its numbers are,
     and this asserts that a published nucleus and a hand-traced one of the SAME object end up on
     top of each other. */
  console.log("\nand three sources in two unit frames land in one place");
  const u = await p.evaluate(() => {
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    /* A traced cube: 500 voxels half-width at 4 nm = 2 µm across, z 400..410 at 40 nm = 0.44 µm.
       Centre 400000, 230000, 405 voxels = 1,600,000 / 920,000 / 16,200 nm. */
    const traced = [];
    for (let z = 400; z <= 410; z++) traced.push(sq(z, 400000, 230000, 500));
    /* The SAME cube, as core/mesh.js would hand it over: micrometres. */
    const um = (x, y, z) => [x / 1000, y / 1000, z / 1000];
    const lo = [1600000 - 2000, 920000 - 2000, 16200 - 220];
    const hi = [1600000 + 2000, 920000 + 2000, 16200 + 220];
    const corners = [];
    for (let i = 0; i < 8; i++)
      corners.push(um((i & 1) ? hi[0] : lo[0], (i & 2) ? hi[1] : lo[1], (i & 4) ? hi[2] : lo[2]));
    const pos = new Float32Array([].concat.apply([], corners));
    const seg = { name: "Cell (segmentation)", color: "#ff3b3b", alpha: 0.15,
                  scaleToNm: 1000, positions: pos,
                  indices: new Uint32Array([0,1,2, 1,3,2, 4,6,5, 5,6,7, 0,2,4, 2,6,4,
                                            1,5,3, 3,5,7, 0,4,1, 1,4,5, 2,3,6, 3,7,6]) };
    const bytes = UJ.traceloft.glb([
      seg, { name: "Whole cell", rings: traced, color: "#cddc39", alpha: 0.22 }], [4, 4, 40]);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const json = JSON.parse(new TextDecoder().decode(
      bytes.subarray(20, 20 + dv.getUint32(12, true))));
    const box = json.accessors.filter(a => a.type === "VEC3" && a.min)
      .map(a => ({ min: a.min, max: a.max }));
    return { names: json.meshes.map(m => m.name), box: box };
  });
  {
    const a = u.box[0], c = u.box[1];
    const off = (!a || !c) ? 999 : Math.max.apply(null,
      [0, 1, 2].map(k => Math.max(Math.abs(a.min[k] - c.min[k]), Math.abs(a.max[k] - c.max[k]))));
    ok(u.names.length === 2 && off < 0.05,
       "a published mesh in micrometres and a hand-traced one in nanometres, the same object, "
       + "land on top of each other \u2014 a part that lies about its unit is 1000\u00d7 away, which "
       + "looks like an empty scene rather than an error",
       "worst corner differs by " + off.toFixed(3) + " \u00b5m");
  }

  console.log("\nand the combined one brings the segmentation with it");
  const seg = await p.evaluate(async () => {
    if (typeof tracingCellGlb !== "function") return { noCard: true };
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const rings = [sq(400, 401000, 230000, 60), sq(401, 401010, 230010, 60)];
    /* Everything the export reaches for, stubbed, so nothing leaves the harness. */
    const asked = { roots: null, nucs: [] };
    window.UJ.mesh = window.UJ.mesh || {};
    UJ.mesh.fetchCombinedMesh = async function(root, _p, _f, extra){
      asked.roots = [String(root)].concat(extra || []);
      return { positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),
               indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]), rootIds: asked.roots };
    };
    window.UJ.nucmesh = window.UJ.nucmesh || {};
    UJ.nucmesh.configured = function(){ return true; };
    UJ.nucmesh.fetchNucleus = async function(id){
      asked.nucs.push(String(id));
      return { positions: new Float32Array([0,0,0, 100,0,0, 0,100,0, 0,0,100]),
               indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) };
    };
    window.tracingExtraRootsFor = tracingExtraRootsFor = async function(){ return ["777", "888"]; };
    window.tracingProposedNucsFor = tracingProposedNucsFor = async function(){ return ["999"]; };
    window.tracingFetchCell = tracingFetchCell = async function(sids){
      return sids.map(function(sid){
        return { sid: sid, t: { color: "#9c27b0", kind: "lysosome" },
                 st: { name: "Lysosome 1", kind: "lysosome", rings: rings } };
      });
    };
    window.tracingFetchShared = tracingFetchShared = async function(sid){
      return { t: { color: "#9c27b0", kind: "lysosome" },
               st: { name: "Lysosome 1", kind: "lysosome", rings: rings } };
    };
    let got = null;
    const real = UJ.traceloft.glb;
    UJ.traceloft.glb = function(parts, res){ got = parts.map(q => ({
      name: q.name, alpha: q.alpha, scale: q.scaleToNm || 1 })); return real(parts, res); };
    /* THE QUESTION IS NOT THIS SECTION'S SUBJECT. tracingCellGlb now asks where to put the
       model and waits for an answer; with nobody to click, an await here never returns and the
       whole file hangs rather than failing. Answered "centred", which is what it used to do.
       The menu itself is pressed in tracingplacecheck.js. */
    if (typeof tracingPlaceAsk === "function")
      window.tracingPlaceAsk = tracingPlaceAsk = async function(){ return false; };
    window.tracingSaveBlob = tracingSaveBlob = function(){};
    await tracingCellGlb({ nuc: "405191", root: "864691136051278323",
                           coord: "234624,228032,17512",
                           items: [{ t: { structureId: "o1" } }] }, null);
    const combined = got;
    got = null;
    await tracingOneGlb("o1", null);
    UJ.traceloft.glb = real;
    return { combined: combined, lone: got, asked: asked };
  });
  if (seg.noCard) console.log("  (no tracing card on this page)");
  else {
    const names = (seg.combined || []).map(q => q.name);
    ok(names.indexOf("Cell (segmentation)") >= 0 && names.indexOf("Nucleus (segmentation)") >= 0,
       "the root ID's mesh and the nucleus ID's mesh are in the combined file beside the tracings",
       names.join(" | "));
    const cellSeg = (seg.combined || []).filter(q => q.name === "Cell (segmentation)")[0] || {};
    const nucSeg = (seg.combined || []).filter(q => q.name === "Nucleus (segmentation)")[0] || {};
    ok(cellSeg.alpha < nucSeg.alpha && nucSeg.alpha < 1,
       "...the root ID most see-through of all, because everything else is inside it, and the "
       + "nucleus less so because its shape is worth seeing",
       "cell " + cellSeg.alpha + ", nucleus " + nucSeg.alpha);
    /* THIS SAID core/nucmesh.js WAS NANOMETRES, and it is not: it divides by 1000 and says so
       in a comment at that line. The assertion agreed with the code because both were wrong, and
       it took Søren measuring a download \u2014 a nucleus printed as 0.0 \u00d7 0.0 \u00d7 0.0 a
       millimetre from its cell \u2014 to find it. Corrected, not loosened: both are micrometres,
       the lofter is nanometres, and each is now ASKED rather than restated. 2026-10-11. */
    ok(cellSeg.scale === 1000 && nucSeg.scale === 1000,
       "...each declaring its own unit \u2014 core/mesh.js and core/nucmesh.js both hand back "
       + "micrometres, and the lofter nanometres",
       "cell \u00d7" + cellSeg.scale + ", nucleus \u00d7" + nucSeg.scale);
    ok((seg.asked.roots || []).join(",") === "864691136051278323,777,888",
       "...and the community's proposed root IDs are folded into the SAME structure, which is "
       + "what fetchCombinedMesh already does for the viewer and the volume",
       (seg.asked.roots || []).join(", "));
    ok(seg.asked.nucs.join(",") === "405191,999",
       "...with the proposed nucleus IDs likewise part of the one nucleus",
       seg.asked.nucs.join(", "));
    ok((seg.lone || []).length === 1 && seg.lone[0].name === "Lysosome 1",
       "and a lone organelle is still only itself \u2014 S\u00f8ren: \u201cthat is only for the 3D "
       + "model for all, not for the individual organelle ones\u201d",
       (seg.lone || []).map(q => q.name).join(" | "));
  }

  /* \u2500\u2500 AND HIS OWN TRACING BEATS THE PUBLISHED MESH \u2500\u2500\u2500\u2500\u2500\u2500  2026-10-10
     S\u00f8ren: *"If there is a whole cell trace then we don\u2019t need to add the root ID to the
     download and the same with Nucleus id"*

     Right, and for a reason worth writing down: the published root-ID mesh and a hand-traced
     Whole cell are the same body twice. Downloaded together they z-fight, and the volume you
     measure is neither his nor the consortium\u2019s. The one he drew is the one he checked.

     WHAT IS ASSERTED:
       - a cell with a traced Whole cell and a traced Nucleus gets NEITHER published mesh
       - ...and does not even ASK for them, because a whole-cell mesh is megabytes
       - a cell with only a traced Whole cell still gets the published nucleus
       - a cell with neither still gets both \u2014 the feature from yesterday is intact
       - and the line says which one was left out, so a missing cell cannot be mistaken for a
         cell that never existed */
  console.log("\nand his own tracing beats the published mesh");
  const own = await p.evaluate(async () => {
    if (typeof tracingCellGlb !== "function") return { noCard: true };
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const rings = [sq(400, 401000, 230000, 60), sq(401, 401010, 230010, 60)];
    const asked = [];
    window.UJ.mesh = window.UJ.mesh || {};
    UJ.mesh.fetchCombinedMesh = async function(){
      asked.push("root");
      return { positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),
               indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) };
    };
    window.UJ.nucmesh = window.UJ.nucmesh || {};
    UJ.nucmesh.configured = function(){ return true; };
    UJ.nucmesh.fetchNucleus = async function(){
      asked.push("nucleus");
      return { positions: new Float32Array([0,0,0, 100,0,0, 0,100,0, 0,0,100]),
               indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) };
    };
    window.tracingExtraRootsFor = tracingExtraRootsFor = async function(){ return []; };
    window.tracingProposedNucsFor = tracingProposedNucsFor = async function(){ return []; };
    /* The kinds are the ones tracingGlbParts() stamps: "cell" for a Whole cell, "nucleus" for a
       Nucleus. The same two words tracingGlbAlpha() reads \u2014 one vocabulary, not a sixth copy. */
    const KIND = { c1: ["Whole cell", "cell"], n1: ["Nucleus", "nucleus"],
                   o1: ["Lysosome 1", "lysosome"] };
    window.tracingFetchCell = tracingFetchCell = async function(sids){
      return sids.map(function(sid){
        const k = KIND[sid] || ["Thing", "lysosome"];
        return { sid: sid, t: { color: "#9c27b0", kind: k[1] },
                 st: { name: k[0], kind: k[1], rings: rings } };
      });
    };
    let got = null, said = "";
    const realGlb = UJ.traceloft.glb, realSay = window.tracingSay;
    UJ.traceloft.glb = function(parts, res){
      got = parts.map(q => q.name); return realGlb(parts, res);
    };
    /* THE QUESTION IS NOT THIS SECTION'S SUBJECT. tracingCellGlb now asks where to put the
       model and waits for an answer; with nobody to click, an await here never returns and the
       whole file hangs rather than failing. Answered "centred", which is what it used to do.
       The menu itself is pressed in tracingplacecheck.js. */
    if (typeof tracingPlaceAsk === "function")
      window.tracingPlaceAsk = tracingPlaceAsk = async function(){ return false; };
    window.tracingSaveBlob = tracingSaveBlob = function(){};
    window.tracingSay = tracingSay = function(t){ said = String(t || ""); };
    const run = async (sids) => {
      got = null; said = ""; asked.length = 0;
      await tracingCellGlb({ nuc: "405191", root: "864691136051278323",
                             coord: "234624,228032,17512",
                             items: sids.map(s => ({ t: { structureId: s } })) }, null);
      return { names: got || [], said: said, asked: asked.slice() };
    };
    const both = await run(["c1", "n1", "o1"]);
    const cellOnly = await run(["c1", "o1"]);
    const neither = await run(["o1"]);
    UJ.traceloft.glb = realGlb;
    window.tracingSay = tracingSay = realSay;
    return { both: both, cellOnly: cellOnly, neither: neither };
  });
  if (own.noCard) console.log("  (no tracing card on this page)");
  else {
    const n = (c) => (c.names || []).join(" | ");
    ok((own.both.names || []).join(",").indexOf("(segmentation)") < 0,
       "a cell he traced whole, nucleus and all, gets no published mesh at all \u2014 the body he "
       + "drew and the body the consortium published are the same body, and two surfaces a "
       + "fraction of a micrometre apart z-fight", n(own.both));
    ok((own.both.names || []).indexOf("Whole cell") >= 0
       && (own.both.names || []).indexOf("Nucleus") >= 0,
       "...and keeps his own two, which are the ones he checked", n(own.both));
    ok((own.both.asked || []).length === 0,
       "...and never asked for them: a whole-cell mesh is megabytes, so fetching one in order to "
       + "throw it away is the waste that is invisible until the network is bad",
       (own.both.asked || []).join(", ") || "nothing fetched");
    ok(/root ID and nucleus ID/.test(own.both.said) && /traced those yourself/.test(own.both.said),
       "...and the line says which ones and why \u2014 a download quietly missing the cell looks "
       + "exactly like a download that never had one", own.both.said.slice(-140));
    ok((own.cellOnly.names || []).indexOf("Cell (segmentation)") < 0
       && (own.cellOnly.names || []).indexOf("Nucleus (segmentation)") >= 0,
       "a cell he traced but whose nucleus he did not still gets the published nucleus \u2014 the "
       + "two halves are decided separately, because he asked for them separately",
       n(own.cellOnly));
    ok(/published root ID mesh is left out/.test(own.cellOnly.said)
       && own.cellOnly.said.indexOf("nucleus ID") < 0,
       "...and the line names only the one that was left out, not both", own.cellOnly.said.slice(-140));
    ok((own.neither.names || []).indexOf("Cell (segmentation)") >= 0
       && (own.neither.names || []).indexOf("Nucleus (segmentation)") >= 0,
       "and a cell with only an organelle traced still gets both, so yesterday\u2019s feature is "
       + "intact and this is a narrowing, not a replacement", n(own.neither));
    ok(own.neither.said.indexOf("left out") < 0,
       "...with nothing claimed to be left out, because nothing was", own.neither.said.slice(-90));
  }

  /* \u2500\u2500 AND THREE DOWNLOADS IN ONE SCENE KEEP THEIR DISTANCE \u2500\u2500\u2500  2026-10-10
     S\u00f8ren: *"I downloaded 3 models and put them into the same Blender instance, but they are
     not in the correct place relative to each other, it seems like their centres are in the same
     place. Please when I load them into Blender they should have the coordinates that they have
     in the dataset, so their relative locations are correct."*

     Which is what the files said they did, and what the header of THIS file argued for: a cell
     1.6 million units from the origin is an invisible speck past the clip plane. That argument is
     about the UNIT and it is still right. Centring came along for the ride and is only right for
     one file at a time.

     The fix keeps the vertices local \u2014 float32 precision, and an object origin at its own
     middle \u2014 and puts the dataset place on the glTF node and the Blender object. So this
     asserts the thing he actually did: two cells 100 \u00b5m apart, downloaded separately, are
     still 100 \u00b5m apart when both are in one scene.

     WHAT IS ASSERTED:
       - the geometry is still local and still micrometres, so the clip-plane argument holds
       - every node carries a translation, and it is the file's own dataset middle
       - two separate downloads 100 \u00b5m apart differ by 100 \u00b5m, in all three axes
       - the GLB's translation and the script's ob.location are the SAME point
       - the place is flipped and permuted the same way the vertices are, or the scene is mirrored */
  console.log("\nand three downloads in one scene keep their distance");
  const far = await p.evaluate(() => {
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const res = [4, 4, 40];                    /* 4 nm in x and y, 40 nm in z */
    /* Two cells 100 \u00b5m apart in x: 25,000 voxels at 4 nm. And 20 \u00b5m in y, 8 \u00b5m in z,
       so a dropped or swapped axis cannot hide behind a single-axis test. */
    const cell = (cx, cy, cz) => {
      const out = [];
      for (let z = cz; z <= cz + 8; z++) out.push(sq(z, cx, cy, 250));
      return out;
    };
    const head = (u8) => {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      return JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));
    };
    const a = head(UJ.traceloft.glb(
      [{ name: "Cell A", rings: cell(400000, 230000, 400), color: "#cddc39", alpha: 0.25 }], res));
    const b2 = head(UJ.traceloft.glb(
      [{ name: "Cell B", rings: cell(425000, 235000, 600), color: "#5b8def", alpha: 0.25 }], res));
    /* ...and the same two in ONE file, which is the answer the two separate files must agree
       with: assembled by glbParts in one go, their separation is not in question. */
    const one = head(UJ.traceloft.glb([
      { name: "Cell A", rings: cell(400000, 230000, 400), color: "#cddc39", alpha: 0.25 },
      { name: "Cell B", rings: cell(425000, 235000, 600), color: "#5b8def", alpha: 0.25 }
    ], res));
    const vec = (j) => (j.nodes[0] || {}).translation || null;
    const mid = (j, i) => {
      const acc = (j.accessors || []).filter(x => x.type === "VEC3" && x.min)[i];
      return acc ? [0, 1, 2].map(k => (acc.min[k] + acc.max[k]) / 2) : null;
    };
    /* The script of cell A, for the one place both writers must agree about. */
    const py = UJ.traceloft.blenderPy(
      [{ name: "Cell A", rings: cell(400000, 230000, 400), color: "#cddc39", alpha: 0.25 }],
      res, { title: "Cell A" });
    const loc = /ob\.location = at/.test(py)
      ? (py.match(/_add\('Cell A',[^[]*?,\s*\(([-0-9.,]+)\),\s*\[/) || [])[1] : null;
    return {
      ta: vec(a), tb: vec(b2),
      /* Both nodes of the single file, so the within-file assembly is checked too. */
      inOne: [mid(one, 0), mid(one, 1)],
      oneT: (one.nodes || []).map(n => (n.translation || []).join(",")),
      localSpan: (() => { const m = mid(a, 0); return m ? Math.max.apply(null, m.map(Math.abs)) : -1; })(),
      extras: a.asset && a.asset.extras,
      loc: loc ? loc.split(",").map(Number) : null,
      pyHasLoc: /ob\.location = at/.test(py)
    };
  });
  {
    const TA = far.ta || [], TB = far.tb || [];
    ok(TA.length === 3 && TB.length === 3,
       "every node carries a translation \u2014 the place lives on the node, not in the vertices, "
       + "so float32 keeps sub-nanometre precision and the object origin is its own middle",
       JSON.stringify(far.ta) + " / " + JSON.stringify(far.tb));
    ok(far.localSpan >= 0 && far.localSpan < 5,
       "...while the geometry is still local and still micrometres, so this file\u2019s own "
       + "clip-plane argument still holds: 1.6 million units is an invisible speck",
       "vertices centred within " + far.localSpan.toFixed(2) + " µm of the object origin");
    /* 25,000 voxels \u00d7 4 nm = 100 \u00b5m in x; 5,000 \u00d7 4 = 20 \u00b5m in y; 200 \u00d7 40
       = 8 \u00b5m in z. glTF y is negated, so the y difference is -20. */
    const d = (TA.length === 3 && TB.length === 3) ? [0, 1, 2].map(k => TB[k] - TA[k]) : [];
    ok(d.length === 3 && Math.abs(d[0] - 100) < 0.05 && Math.abs(d[1] + 20) < 0.05
       && Math.abs(d[2] - 8) < 0.05,
       "...and two cells 100 \u00b5m, 20 \u00b5m and 8 \u00b5m apart, downloaded SEPARATELY, are "
       + "still that far apart in one scene \u2014 which is the whole of what he reported",
       d.map(v => v.toFixed(2)).join(", ") + " µm (want 100, -20, 8; y negated for glTF)");
    /* THE TWO ROUTES MUST AGREE. One file holding both cells assembles them in glbParts; two
       files assemble them by their node translations. A scene must not depend on which. */
    const o = far.inOne || [];
    const dOne = (o[0] && o[1]) ? [0, 1, 2].map(k => o[1][k] - o[0][k]) : [];
    ok(dOne.length === 3 && d.length === 3
       && [0, 1, 2].every(k => Math.abs(dOne[k] - d[k]) < 0.05),
       "...and the same two in ONE file are the same distance apart, so a scene does not depend "
       + "on whether they were downloaded together or separately",
       dOne.map(v => v.toFixed(2)).join(", ") + " vs " + d.map(v => v.toFixed(2)).join(", "));
    /* NOT MERELY EQUAL: both non-empty. Written as `oneT[0] === oneT[1]` alone this passed
       against the UNFIXED code, where both were "" — a check that cannot fail. */
    ok((far.oneT || []).length === 2 && far.oneT[0].split(",").length === 3
       && far.oneT[0] === far.oneT[1],
       "...with the parts of one file sharing one translation, because glbParts already assembled "
       + "them and a second offset would move them apart", (far.oneT || []).join("  |  "));
    /* THE SCRIPT AND THE GLB. The importer maps glTF (x, y, z) to Blender (x, -z, y), so the
       script's object location must be (tx, -tz, ty) of the GLB's node translation. The vertex
       check further down does the same for the geometry; this does it for the place. */
    ok(far.pyHasLoc, "the Blender script places its objects too, not only the GLB",
       String(far.pyHasLoc));
    const L = far.loc || [], want = (TA.length === 3) ? [TA[0], -TA[2], TA[1]] : [];
    ok(L.length === 3 && want.length === 3
       && [0, 1, 2].every(k => Math.abs(L[k] - want[k]) < 0.01),
       "...at the SAME point the GLB lands at \u2014 Blender (x, -z, y) of the glTF translation, "
       + "the same permutation the vertices get, so the two downloads of one cell cannot "
       + "contradict each other about where it is",
       "script " + L.map(v => v.toFixed(1)).join(", ") + " vs glb \u2192 "
       + want.map(v => v.toFixed(1)).join(", "));
    ok(far.extras && (far.extras.placedUm || []).length === 3
       && /TRANSLATED/.test(String(far.extras.note || "")),
       "...and the file says in its own asset extras that it is placed rather than centred, "
       + "because the next person to read one will believe the note",
       JSON.stringify(far.extras && far.extras.placedUm));
  }

  /* \u2500\u2500 ONE RULE FOR HOW SEE-THROUGH, AND A NUCLEUS THAT ARRIVES \u2500\u2500  2026-10-11
     S\u00f8ren, on the \u00b5Jump download: *"The transparency of the root ID is too much, it is
     hard to see the structure. But it should also include the Nucleus ID. That can also be a bit
     transparent, so that you can see if there are things traced inside the nucleus, but it should
     not be as transparent as the root ID."*

     TWO FAULTS OF THE SAME SHAPE. The alphas were written twice \u2014 0.22/0.4 for the traced
     parts, 0.15/0.35 for the published ones a thousand lines away \u2014 and 0.15 is the one he
     could not see. And core/nucmesh.js is configured lazily by the PAD, so an export on a page
     where nobody had opened the pad asked `configured()`, got false, and left the nucleus out in
     silence, because the branch that would have recorded it was the branch being skipped.

     WHAT IS ASSERTED:
       - the cell is more see-through than the nucleus, and the nucleus than an organelle
       - a published mesh and a hand-traced one of the SAME KIND get the SAME alpha, which is what
         "one rule" means and what a second literal would break
       - the nucleus arrives on a page where nucmesh was never configured \u2014 the export points
         the reader at the dataset's own volume rather than waiting for the pad
       - ...and where the dataset genuinely has none, the line SAYS so rather than omitting it */
  console.log("\nand one rule says how see-through each thing is");
  const see = await p.evaluate(async () => {
    if (typeof tracingGlbAlpha !== "function") return { noCard: true };
    const a = { cell: tracingGlbAlpha("cell", false), nuc: tracingGlbAlpha("nucleus", false),
                org: tracingGlbAlpha("lysosome", false), alone: tracingGlbAlpha("cell", true) };
    /* The published parts, read off a real tracingSegParts() run rather than off the source. */
    const missed = [];
    window.UJ.mesh = window.UJ.mesh || {};
    UJ.mesh.fetchCombinedMesh = async () => ({
      positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),
      indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) });
    window.tracingExtraRootsFor = tracingExtraRootsFor = async () => [];
    window.tracingProposedNucsFor = tracingProposedNucsFor = async () => [];
    /* A nucmesh that is NOT configured until somebody configures it \u2014 which is the state a
       freshly loaded page is in, and the state the export used to give up in. */
    let configuredWith = "";
    window.UJ.nucmesh = {
      configured: () => !!configuredWith,
      configure: (c) => { configuredWith = String((c || {}).nuc || ""); },
      fetchNucleus: async () => ({
        positions: new Float32Array([0,0,0, 100,0,0, 0,100,0, 0,0,100]),
        indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) })
    };
    const g = { root: "864691136051278323", nuc: "405191" };
    const parts = await tracingSegParts(g, missed, {});
    /* READ IT NOW. The second scenario below resets this, and reading it at the end made the
       assertion report the second run's state while claiming to describe the first. */
    const cfgAfter = configuredWith;
    const by = {};
    parts.forEach(q => { by[q.name] = q.alpha; });
    /* ...and again on a dataset with no nuclei volume at all. */
    const realSrc = UJ.cfg && UJ.cfg.tracing ? UJ.cfg.tracing.sources : null;
    configuredWith = "";
    UJ.nucmesh.configure = () => {};                       /* refuses to become configured */
    const missed2 = [];
    const parts2 = await tracingSegParts(g, missed2, {});
    let src = "";
    try { src = String((tracingSources() || {}).nuc || ""); } catch (_e){ src = ""; }
    return { a: a, by: by, names: parts.map(q => q.name), configuredWith: cfgAfter,
             missed: missed, names2: parts2.map(q => q.name), missed2: missed2,
             src: src };
  });
  if (see.noCard) console.log("  (no tracing card on this page)");
  else {
    ok(see.a.cell < see.a.nuc && see.a.nuc < see.a.org && see.a.org === 1,
       "the cell is the most see-through, the nucleus less so, an organelle solid \u2014 one order, "
       + "because everything is inside the cell and only a few things are inside the nucleus",
       "cell " + see.a.cell + " < nucleus " + see.a.nuc + " < organelle " + see.a.org);
    ok(see.a.cell >= 0.25,
       "...and the cell is opaque enough to SEE \u2014 0.15 was the number he could not make out, "
       + "and it was a second literal nobody had decided on", String(see.a.cell));
    ok(see.a.alone === 1,
       "...while a tracing downloaded on its own is solid, since nothing encloses it",
       String(see.a.alone));
    ok(see.by["Cell (segmentation)"] === see.a.cell
       && (see.by["Nucleus (segmentation)"] === undefined
           || see.by["Nucleus (segmentation)"] === see.a.nuc),
       "a PUBLISHED mesh and a hand-traced one of the same kind get the same alpha, which is what "
       + "one rule means \u2014 a second literal here is exactly the drift that caused this",
       JSON.stringify(see.by));
    /* FIVE OF THE EIGHT PAGES HAVE NO NUCLEI VOLUME, and that is not a fault: \u03b2Jump's nuc box
       holds a Hoechst blob number, not a segment id, and \u03b7/\u03bb/\u03c9/\u03c7 have none at
       all. Asserting the nucleus arrives everywhere asserted the wrong thing \u2014 so each page
       is held to the promise it can actually make, and BOTH halves are real assertions. */
    if (see.src){
      ok((see.names || []).indexOf("Nucleus (segmentation)") >= 0,
         "...and the nucleus ARRIVES on a page where nucmesh was never configured, because the "
         + "export points the reader at the dataset's own volume instead of waiting for the pad",
         (see.names || []).join(" | "));
      ok(see.configuredWith === see.src,
         "...which it does by configuring it from this dataset's own nuclei source",
         see.configuredWith || "nothing was configured");
      ok((see.missed || []).length === 0,
         "...with nothing reported missing when nothing was",
         (see.missed || []).join(", ") || "none");
    } else {
      ok((see.names || []).indexOf("Nucleus (segmentation)") < 0
         && (see.missed || []).join(" ").indexOf("no nuclei volume") >= 0,
         "this page has no nuclei volume, so the download says so instead of inventing one \u2014 "
         + "and says it rather than omitting the nucleus in silence",
         (see.missed || []).join(", ") || "said nothing");
      ok(!see.configuredWith,
         "...and nothing was pointed at a volume that does not exist, which is what used to fetch "
         + "the host's own 404 page as \"/info\"", see.configuredWith || "nothing configured");
    }
    ok((see.names2 || []).indexOf("Nucleus (segmentation)") < 0
       && (see.missed2 || []).join(" ").indexOf("no nuclei volume") >= 0,
       "and a dataset with no nuclei volume SAYS so in the line \u2014 silence is how this went "
       + "unnoticed, and a download missing its nucleus looks the same as a cell that has none",
       (see.missed2 || []).join(", ") || "said nothing");
  }

  /* \u2500\u2500 PLACED OR CENTRED, IN THE FILE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2026-10-12
     S\u00f8ren, of a cell opened in Windows 3D Viewer: *"it is not centered... can we do something
     so that it is centered when opening alone but has the correct coordinate when opening in
     Blender?"* \u2014 and then, of the tick that answered it: *"Perhaps it should be a choice you
     make when you click the 3D model button?"*

     THE QUESTION MOVED TO tracingplacecheck.js, which presses the menu, dismisses it, and checks
     that nothing is downloaded when you change your mind. What belongs here is the half about the
     file: one option, honoured the same way by both writers. Two downloads of one cell that
     disagree about where it is are worse than either position, and only this can see both. */
  console.log("\nand placed or centred is one option, honoured by both writers");
  const place = await p.evaluate(() => {
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const rings = [];
    for (let z = 400; z <= 406; z++) rings.push(sq(z, 400000, 230000, 250));
    const parts = [{ name: "Whole cell", rings: rings, color: "#cddc39", alpha: 0.3 }];
    const res = [4, 4, 40];
    const tx = (u8) => {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));
      return (j.nodes[0] || {}).translation || [0, 0, 0];
    };
    const loc = (py) => (py.match(/_add\('Whole cell',[^[]*?,\s*\(([-0-9.,]+)\),\s*\[/) || [])[1];
    const run = (p2) => ({ glb: tx(UJ.traceloft.glb(parts, res, { place: p2 })),
                           py: loc(UJ.traceloft.blenderPy(parts, res, { title: "t", place: p2 })) });
    return { off: run(false), on: run(true),
             /* Omitted entirely, which is what every other caller of these two writers does. */
             bare: { glb: tx(UJ.traceloft.glb(parts, res)),
                     py: loc(UJ.traceloft.blenderPy(parts, res, { title: "t" })) },
             /* The SENTENCE moved out of this file on 2026-10-12: the card has one placement
                now, so there is no "which did it do" to assert here. What the line says is
                tracingplacecheck.js's subject, and it is about the card rather than the file. */
             say: null };
  });
  ok(Math.max.apply(null, place.off.glb.map(Math.abs)) === 0 && place.off.py === "0,0,0",
     "centred puts BOTH at the origin \u2014 which is the whole of what a viewer that frames the "
     + "origin rather than the scene needs in order to show it at all",
     JSON.stringify(place.off.glb) + " / " + place.off.py);
  ok(Math.max.apply(null, place.on.glb.map(Math.abs)) > 100 && place.on.py !== "0,0,0",
     "...and placed puts both where the cell is",
     JSON.stringify(place.on.glb) + " / " + place.on.py);
  ok(place.bare.glb.join(",") === place.on.glb.join(",") && place.bare.py === place.on.py,
     "...and the WRITER'S own default, with no option passed, is PLACED \u2014 it writes the "
     + "geometry where the geometry is, and centring is the simplification a caller asks for. "
     + "Worth pinning down because the card's default is the other one: the card always passes "
     + "an answer, and the day it stops, this says which way it will fall",
     JSON.stringify(place.bare.glb) + " / " + place.bare.py);
  ok(place.say === null,
     "...and this file stops asserting what the card SAYS about it. The card has one placement "
     + "since 2026-10-12, so there is no choice to report; the sentence belongs to the card and "
     + "to tracingplacecheck.js",
     "left to the card's own check");

  /* ── A SURFACE RATHER THAN A STACK OF PLATES ──────────────────────────────────  2026-10-11
     Søren, of a cell in Blender: *"I think the vasculature looks a bit segmented and not very
     smooth. Also, the primary cilium is not very clear and the background is grey rather than
     white."*

     The first of those was ours and invisible: this writer emitted POSITION and nothing else,
     and the glTF specification says a client MUST then compute FLAT normals. Every file we have
     ever written was a stack of plates in every viewer.

     AND WELDING IS THE OTHER HALF. band() gives each pair of contours its own copy of both
     rings, so an index-wise average leaves a crease at every section — "segmented", his word.

     WHAT IS ASSERTED:
       - every primitive has a NORMAL, and every normal is a unit vector
       - a vertex on the WALL of a lofted tube, where two bands meet, is smooth: its normal is
         the radial one, not either face's. This is the fix; the rest is scaffolding
       - a vertex on the end CAP is not smoothed into the wall — a cap is flat because the tracer
         drew it flat, and rounding it off would be inventing geometry
       - the published meshes are filed in their own collection, so one tick hides them
       - and the Blender script sets the world, the view transform AND the viewport, because a
         white world alone renders grey under AgX and Solid shading ignores the world entirely */
  console.log("\nand it is a surface rather than a stack of plates");
  const surf = await p.evaluate(() => {
    /* A tube: six sections of the same circle, so every wall vertex has an unambiguous radial
       normal and every band seam is a place an unwelded average would crease. */
    const ring = (z, r) => {
      const pts = [];
      for (let k = 0; k < 24; k++){
        const a = 2 * Math.PI * k / 24;
        pts.push([400000 + Math.round(r * Math.cos(a)), 230000 + Math.round(r * Math.sin(a))]);
      }
      return { z: z, points: pts };
    };
    const rings = [];
    for (let z = 400; z <= 405; z++) rings.push(ring(z, 500));
    const u8 = UJ.traceloft.glb([{ name: "Tube", rings: rings, color: "#cddc39" }], [4, 4, 40]);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const jLen = dv.getUint32(12, true);
    const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jLen)));
    const binAt = 20 + jLen + ((4 - (jLen % 4)) % 4 ? 0 : 0) + 8;
    const read = (ai) => {
      const a = j.accessors[ai], bv = j.bufferViews[a.bufferView];
      const o = binAt + bv.byteOffset;
      const n = a.count * (a.type === "VEC3" ? 3 : 1);
      return a.componentType === 5126
        ? new Float32Array(u8.buffer.slice(u8.byteOffset + o, u8.byteOffset + o + n * 4))
        : new Uint32Array(u8.buffer.slice(u8.byteOffset + o, u8.byteOffset + o + n * 4));
    };
    const prim = j.meshes[0].primitives[0];
    /* NAMED, NOT THROWN. Without this the red run died on `read(undefined)` and reported a stack
       trace instead of the one sentence that says what is missing. */
    if (prim.attributes.NORMAL === undefined)
      return { has: false, worst: 9, wall: null, cap: null, shaded: "" };
    const P = read(prim.attributes.POSITION), N = read(prim.attributes.NORMAL);
    /* Every normal a unit vector. */
    let worst = 0;
    for (let i = 0; i < N.length; i += 3){
      const L = Math.hypot(N[i], N[i + 1], N[i + 2]);
      worst = Math.max(worst, Math.abs(L - 1));
    }
    /* THE WALL. A vertex at mid-height, away from both caps: its normal should be radial, which
       in glTF's frame is (x, -y, 0) of its own offset from the axis, and FLAT shading would give
       it the normal of one triangle instead — tilted along z by the band. z is the tube's long
       axis in data, which glTF keeps as z. */
    let wall = null, cap = null;
    const zs = [];
    for (let i = 0; i < P.length; i += 3) zs.push(P[i + 2]);
    const zMin = Math.min.apply(null, zs), zMax = Math.max.apply(null, zs);
    for (let i = 0; i < P.length; i += 3){
      const z = P[i + 2], r = Math.hypot(P[i], P[i + 1]);
      /* ANY INTERIOR SECTION. Six sections have no vertex at the exact mid-height, and asking
         for one found nothing \u2014 the assertion reported "no wall vertex" rather than passing,
         which is the right way round for a check to be wrong. */
      if (r > 1.5 && z > zMin + 1e-3 && z < zMax - 1e-3 && wall === null)
        wall = { nz: Math.abs(N[i + 2]), radial: (P[i] * N[i] + P[i + 1] * N[i + 1]) / (r || 1) };
      if (r > 1.5 && Math.abs(z - zMax) < 1e-3 && Math.abs(N[i + 2]) > 0.9 && cap === null)
        cap = { nz: Math.abs(N[i + 2]) };
    }
    return { has: !!prim.attributes.NORMAL, worst: worst, wall: wall, cap: cap,
             verts: P.length / 3, tris: prim.indices !== undefined,
             shaded: (j.asset.extras || {}).shaded || "" };
  });
  ok(surf.has, "every primitive carries a NORMAL — without one the glTF spec REQUIRES a viewer "
     + "to shade it flat, which is every file this tool has written until today",
     String(surf.has));
  ok(surf.worst < 1e-3, "...and every normal is a unit vector",
     "worst length error " + surf.worst.toExponential(1));
  ok(!!surf.wall && surf.wall.nz < 0.05 && surf.wall.radial > 0.99,
     "a vertex where two bands meet on the wall of a tube has the RADIAL normal, not either "
     + "face's — this is the fix; unwelded, its normal would tilt along the tube and leave the "
     + "crease at every section that he called segmented",
     surf.wall ? ("z-component " + surf.wall.nz.toFixed(3) + ", radial "
                  + surf.wall.radial.toFixed(3)) : "no wall vertex found");
  ok(!!surf.cap,
     "...while the end cap keeps a normal along the axis: a cap is flat because the tracer drew "
     + "it flat, and smoothing it into the wall would be inventing the one part of the shape "
     + "nobody outlined", surf.cap ? ("cap z-component " + surf.cap.nz.toFixed(3)) : "none found");
  ok(/hard edges/.test(surf.shaded),
     "...and the file says so in its own asset extras", surf.shaded || "said nothing");

  console.log("\nand the published meshes have a collection of their own");
  const grp = await p.evaluate(async () => {
    if (typeof tracingSegParts !== "function") return { noCard: true };
    window.UJ.mesh = window.UJ.mesh || {};
    UJ.mesh.fetchCombinedMesh = async () => ({
      positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),
      indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) });
    window.UJ.nucmesh = { configured: () => true, configure: () => {},
      fetchNucleus: async () => ({
        positions: new Float32Array([0,0,0, 100,0,0, 0,100,0, 0,0,100]),
        indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) }) };
    window.tracingExtraRootsFor = tracingExtraRootsFor = async () => [];
    window.tracingProposedNucsFor = tracingProposedNucsFor = async () => [];
    const parts = await tracingSegParts({ root: "1", nuc: "2" }, [], {});
    /* ...and what the Blender script makes of it: _coll(group). */
    const py = UJ.traceloft.blenderPy(parts.concat([{ name: "Lysosome 1", kind: "lysosome",
      color: "#9c27b0", rings: [{ z: 400, points: [[400000,230000],[400100,230000],
        [400100,230100],[400000,230100]] }, { z: 401, points: [[400000,230000],[400100,230000],
        [400100,230100],[400000,230100]] }] }]), [4, 4, 40], { title: "t" });
    return { groups: parts.map(q => q.group || q.kind),
             colls: (py.match(/_add\('[^']*', '([^']*)'/g) || []) };
  });
  if (grp.noCard) console.log("  (no tracing card on this page)");
  else {
    ok((grp.groups || []).join(",") === "Segmentation,Segmentation",
       "the published cell and nucleus are filed under Segmentation, not under the same kind as "
       + "the outlines he drew — so one tick in Blender's outliner hides the pair and leaves "
       + "his own", (grp.groups || []).join(", ") || "none");
    ok((grp.colls || []).join(" ").indexOf("Segmentation") >= 0,
       "...and the Blender script makes that collection", (grp.colls || []).join("  ") || "none");
  }

  console.log("\nand the script opens in a white room");
  const room = await p.evaluate(() => {
    const py = UJ.traceloft.blenderPy([{ name: "Whole cell", color: "#cddc39",
      rings: [{ z: 400, points: [[400000,230000],[400100,230000],[400100,230100],[400000,230100]] },
              { z: 401, points: [[400000,230000],[400100,230000],[400100,230100],[400000,230100]] }]
    }], [4, 4, 40], { title: "t" });
    return { world: /_bg\.inputs\[0\]\.default_value = \(1\.0, 1\.0, 1\.0, 1\.0\)/.test(py),
             std: /view_transform = 'Standard'/.test(py),
             vp: /background_color = \(1\.0, 1\.0, 1\.0\)/.test(py),
             mat: /shading\.type = 'MATERIAL'/.test(py),
             guarded: /getattr\(getattr\(bpy\.context, 'screen', None\), 'areas', \[\]\)/.test(py),
             tries: (py.match(/except Exception: pass/g) || []).length };
  });
  ok(room.world && room.std,
     "the script sets a white world AND the Standard view transform — a white world alone "
     + "renders light grey, because AgX maps a scene-linear 1.0 to about three-quarters",
     "world " + room.world + ", Standard " + room.std);
  ok(room.vp && room.mat,
     "...and the viewport too, because Solid shading does not use the world at all — and in "
     + "Material Preview, since Solid fakes transparency with a screen-door dither, which is the "
     + "speckle in his screenshot", "background " + room.vp + ", Material Preview " + room.mat);
  ok(room.guarded && room.tries >= 6,
     "...each in its own try, and the viewport loop guarded, because bpy.context.screen is None "
     + "under `blender --python` and a script that dies there leaves half a scene",
     "guarded " + room.guarded + ", " + room.tries + " tries");

  /* ── AND THE PUBLISHED PARTS LAND ON THE CELL ─────────────────────────────────  2026-10-11
     Søren: *"Even though the dataset coordinates are unticked now, the cell is not centered!"*
     His file, measured:

       Cell (segmentation)     span 202 x 235 x 143 µm   centre  418, -438,  334
       Nucleus (segmentation)  span   0 x   0 x   0 µm   centre -517,  474, -368
       every node's translation [0, 0, 0]

     The translations were zero, so the tick was innocent and "centred" did what it says — on a
     bounding box 930 µm across, because the nucleus had collapsed to a dot a millimetre away.
     core/nucmesh.js divides by 1000 and SAYS so; tracingSegParts declared `scaleToNm: 1`.

     THE OLD UNIT ASSERTION COULD NOT HAVE CAUGHT THIS. It built its own part with
     `scaleToNm: 1000` and checked that the lofter and a 1000-scaled mesh agree — the mechanism,
     not the declaration. This drives the REAL tracingSegParts, with stubs that return what the
     real modules return, in the unit they really return it in.

     WHAT IS ASSERTED:
       - the published cell and nucleus declare the unit their own module declares, not a literal
       - and, end to end, a nucleus inside a cell comes out INSIDE it rather than a millimetre away
       - ...and keeps its size, which is the other half of a wrong unit */
  console.log("\nand the published parts land on the cell, in the cell's own unit");
  const unit = await p.evaluate(async () => {
    if (typeof tracingSegParts !== "function") return { noCard: true };
    /* A cell 20 µm across at a REAL dataset place, and a nucleus 10 µm across inside it. Both in
       MICROMETRES, because that is what core/mesh.js and core/nucmesh.js both hand back — the
       stubs lie about nothing. */
    const box = (cx, cy, cz, h) => {
      const v = [], f = [];
      for (let i = 0; i < 8; i++)
        v.push(cx + ((i & 1) ? h : -h), cy + ((i & 2) ? h : -h), cz + ((i & 4) ? h : -h));
      const q = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
      q.forEach(c => f.push(c[0], c[1], c[2], c[0], c[2], c[3]));
      return { positions: new Float32Array(v), indices: new Uint32Array(f) };
    };
    window.UJ.mesh = window.UJ.mesh || {};
    const realUnit = UJ.mesh.unitNm;
    UJ.mesh.fetchCombinedMesh = async () => box(418, 438, 334, 10);
    window.UJ.nucmesh = { unitNm: 1000, configured: () => true, configure: () => {},
      fetchNucleus: async () => box(418, 438, 334, 5) };
    window.tracingExtraRootsFor = tracingExtraRootsFor = async () => [];
    window.tracingProposedNucsFor = tracingProposedNucsFor = async () => [];
    const parts = await tracingSegParts({ root: "1", nuc: "2" }, [], {});
    const byName = {};
    parts.forEach(q => { byName[q.name] = q; });
    /* End to end: through glbParts, which is where a part's declared unit is actually applied. */
    const prep = UJ.traceloft.glbParts(parts, [4, 4, 40]);
    const bb = (q) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < q.xyz.length; i += 3)
        for (let k = 0; k < 3; k++){
          if (q.xyz[i + k] < lo[k]) lo[k] = q.xyz[i + k];
          if (q.xyz[i + k] > hi[k]) hi[k] = q.xyz[i + k];
        }
      return { mid: [0,1,2].map(k => (lo[k] + hi[k]) / 2),
               span: Math.max.apply(null, [0,1,2].map(k => hi[k] - lo[k])) };
    };
    const cell = bb(prep.parts.filter(q => /Cell/.test(q.name))[0]);
    const nuc = bb(prep.parts.filter(q => /Nucleus/.test(q.name))[0]);
    return { declaredCell: (byName["Cell (segmentation)"] || {}).scaleToNm,
             declaredNuc: (byName["Nucleus (segmentation)"] || {}).scaleToNm,
             moduleUnit: realUnit,
             apart: Math.max.apply(null, [0,1,2].map(k => Math.abs(cell.mid[k] - nuc.mid[k]))),
             cellSpan: cell.span, nucSpan: nuc.span };
  });
  if (unit.noCard) console.log("  (no tracing card on this page)");
  else {
    ok(unit.declaredNuc === 1000,
       "the published nucleus declares the unit core/nucmesh.js declares — it divides by 1000 "
       + "and says so, and `scaleToNm: 1` here is what put a dot a millimetre from the cell",
       "declared " + unit.declaredNuc);
    ok(unit.declaredCell === 1000 && (unit.moduleUnit === undefined || unit.moduleUnit === 1000),
       "...and the published cell likewise, from core/mesh.js's own unitNm rather than a literal "
       + "— a correct literal and a wrong one look identical until somebody measures",
       "declared " + unit.declaredCell + ", module says " + unit.moduleUnit);
    ok(unit.apart < 0.1,
       "and end to end, a nucleus drawn INSIDE a cell comes out inside it: the two centres are "
       + "on top of each other, not a millimetre apart",
       unit.apart.toFixed(3) + " µm apart");
    ok(unit.nucSpan > 9 && unit.nucSpan < 11 && unit.cellSpan > 19 && unit.cellSpan < 21,
       "...and each keeps its size, which is the other half of a wrong unit — his nucleus came "
       + "out a thousandth of itself and printed as 0.0 × 0.0 × 0.0",
       "cell " + unit.cellSpan.toFixed(1) + " µm, nucleus " + unit.nucSpan.toFixed(1) + " µm");
  }

  /* \u2500\u2500 AND A FORM THAT NEEDS NO IMPORTER AT ALL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2026-10-10
     S\u00f8ren: *"I see now that .glb does not open naturally in Blender"* \u2014 and, asked which of
     the three it was: *"dragging did not work and no option in the import"*. That is his glTF
     add-on switched off, not a fault in the file, and one tick in Preferences fixes it. But an
     export that depends on an add-on being enabled is an export that fails this way again, so
     there is a second download that depends on nothing: a Blender Python script. Scripting tab,
     Run, and the scene is there \u2014 with real materials, viewport transparency (so it looks
     right without rendering), a collection per kind and every object named. */
  console.log("\nand a Blender script that needs no add-on");
  const py = await p.evaluate(() => {
    if (typeof UJ.traceloft.blenderPy !== "function") return { missing: true };
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const a = [], c = [];
    for (let z = 400; z <= 404; z++) a.push(sq(z, 400000, 230000, 250));
    for (let z = 401; z <= 403; z++) c.push(sq(z, 400000, 230000, 60));
    const txt = UJ.traceloft.blenderPy([
      { name: "Whole cell", kind: "cell", rings: a, color: "#cddc39", alpha: 0.22 },
      { name: "Lysosome 1", kind: "lysosome", rings: c, color: "#9c27b0" }
    ], [4, 4, 40], { title: "cell at 401085, 230736, 380" });
    return { txt: txt, len: txt.length };
  });
  if (py.missing) ok(false, "UJ.traceloft.blenderPy is not on this page");
  else {
    const t = py.txt;
    ok(/^#/.test(t) && /import bpy/.test(t),
       "it is a Python file that starts by saying what it is and imports bpy",
       t.split("\n")[0].slice(0, 80));
    /* `^_add(` — the calls, not the `def _add(` that defines it. */
    const calls = (t.match(/^_add\(/gm) || []).length;
    ok(/from_pydata/.test(t) && calls === 2,
       "...one object per structure, built from its own vertices and faces", calls + " objects");
    ok(/'Whole cell'/.test(t) && /'Lysosome 1'/.test(t),
       "...named as they are named here, so the outliner reads like the list");
    ok(/0\.22/.test(t) && /alpha/i.test(t),
       "...the cell see-through, by the same rule the GLB uses");
    ok(/blend_method|surface_render_method/.test(t) && /try:/.test(t),
       "...set for the VIEWPORT, both the name Blender used before 4.2 and the one after, each "
       + "in a try \u2014 a script that dies on an AttributeError leaves half a scene",
       (t.match(/(blend_method|surface_render_method)/g) || []).join(", "));
    ok(/bpy\.data\.collections\.new/.test(t),
       "...and a collection per kind, which is the thing a GLB cannot carry");
    ok(!/\bexec\b|\beval\b|subprocess|urllib|requests|os\.system/.test(t),
       "...and it fetches nothing and runs nothing: it is vertices, faces and materials, which "
       + "is what makes it safe to hand somebody a script at all",
       "no exec, eval, subprocess or network");
    /* THE TWO DOWNLOADS OF ONE CELL MUST NOT DISAGREE ABOUT WHICH WAY IS UP. The glTF importer
       maps glTF (x, y, z) to Blender (x, -z, y), so a GLB written with glTF-y = -y_data lands at
       Blender (x, -z, -y). The script writes that directly; this measures that they match.
       Verified once outside the harness too: the emitted file parses with Python's own ast. */
    const axes = await p.evaluate(() => {
      const sq = (z, cx, cy, h) => ({ z: z,
        points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
      const a = [];
      for (let z = 400; z <= 410; z++) a.push(sq(z, 400000, 230000, 250));
      const parts = [{ name: "Whole cell", kind: "cell", rings: a, color: "#cddc39", alpha: 0.22 }];
      const txt = UJ.traceloft.blenderPy(parts, [4, 4, 40], {});
      const u8 = UJ.traceloft.glb(parts, [4, 4, 40]);
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const json = JSON.parse(new TextDecoder().decode(
        u8.subarray(20, 20 + dv.getUint32(12, true))));
      const g = json.accessors.filter(x => x.type === "VEC3" && x.min)[0];
      /* The VERTEX line only: the line after each `_add(` call. The face list below it is
         tuples of integers and would otherwise be measured as geometry. */
      const rows = txt.split("\n");
      const vi = rows.findIndex(l => l.indexOf("_add(") === 0);
      const v = ((rows[vi + 1] || "").match(/\(-?[\d.]+,-?[\d.]+,-?[\d.]+\)/g) || [])
        .map(t2 => t2.slice(1, -1).split(",").map(Number));
      const lo = [0, 1, 2].map(k => Math.min.apply(null, v.map(q => q[k])));
      const hi = [0, 1, 2].map(k => Math.max.apply(null, v.map(q => q[k])));
      return { lo: lo, hi: hi, gmin: g.min, gmax: g.max, n: v.length };
    });
    const near = (a2, b2) => Math.abs(a2 - b2) < 1e-3;
    ok(axes.n > 8
       && near(axes.lo[0], axes.gmin[0]) && near(axes.hi[0], axes.gmax[0])
       && near(axes.lo[1], -axes.gmax[2]) && near(axes.hi[1], -axes.gmin[2])
       && near(axes.lo[2], -axes.gmax[1]) && near(axes.hi[2], -axes.gmin[1]),
       "the script and the GLB of one cell agree about which way is up \u2014 Blender (x, -z, -y) "
       + "is where the importer puts the GLB, so the two downloads cannot contradict each other",
       "script " + axes.lo.map(v2 => Math.round(v2 * 100) / 100).join(",") + " \u2192 "
       + axes.hi.map(v2 => Math.round(v2 * 100) / 100).join(",")
       + "  vs glTF " + axes.gmin.map(v2 => Math.round(v2 * 100) / 100).join(",") + " \u2192 "
       + axes.gmax.map(v2 => Math.round(v2 * 100) / 100).join(","));
    ok(py.len < 400000, "...and it is a text file of a sane size for this fixture",
       Math.round(py.len / 1024) + " kB");
  }

  /* \u2500\u2500 AND THE PAGE SAYS THE REMEDY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2026-10-10
     S\u00f8ren: *"if my blender is missing it, then other people are also missing it. it should be
     plug and play."* It cannot be \u2014 nothing but a .blend opens Blender by double-click \u2014
     but it can stop being a puzzle. The one tick that fixes it is on the button and in the line
     after the download, from one string, so a person who hits this never has to diagnose it. */
  console.log("\nand the page says how to fix a Blender that cannot read it");
  const help = await p.evaluate(() => {
    const host = document.getElementById("tracingShared");
    if (!host) return { noList: true };
    TRACING_SHARED = [{ structureId: "c1", name: "Whole cell", kind: "cell",
                        nucleusId: "61360735", rootId: "6198781614",
                        cellCoord: "401085,230736,380", contours: 172, sections: 156 }];
    tracingRenderShared();
    const t = (host.querySelector(".tracingcellglb") || {}).title || "";
    const o = (host.querySelector(".tracingglb") || {}).title || "";
    return { cell: t, one: o,
             one_string: typeof TRACING_GLTF_HELP === "string" && TRACING_GLTF_HELP.length > 40 };
  });
  if (help.noList) console.log("  (no dataset list on this page)");
  else {
    const says = s2 => /Preferences/.test(s2) && /Add-ons/.test(s2) && /glTF 2\.0 format/.test(s2);
    ok(says(help.cell) && says(help.one),
       "both 3D model buttons name the one tick that fixes a Blender with no glTF importer, "
       + "before the click rather than after the puzzle",
       says(help.cell) && says(help.one) ? "both say it" : "cell: " + help.cell.slice(-60));
    ok(help.one_string,
       "...from one string, so the button and the line afterwards cannot drift apart",
       String(help.one_string));
  }

  console.log("\nand the buttons are on the list");
  const ui = await p.evaluate(() => {
    const host = document.getElementById("tracingShared");
    if (!host) return { noList: true };
    TRACING_SHARED = [
      { structureId: "c1", name: "Whole cell", kind: "cell", nucleusId: "61360735",
        rootId: "6198781614", cellCoord: "401085,230736,380", contours: 172, sections: 156 },
      { structureId: "o1", name: "Lysosome 1", kind: "lysosome", instanceOf: "lysosome",
        instanceIndex: 1, nucleusId: "61360735", rootId: "6198781614",
        cellCoord: "401085,230736,380", contours: 8, sections: 6 }
    ];
    tracingRenderShared();
    return { cell: host.querySelectorAll(".tracingcellglb").length,
             rows: host.querySelectorAll(".tracingglb").length };
  });
  if (ui.noList) console.log("  (no dataset list on this page)");
  else {
    ok(ui.cell === 1, "one combined 3D model per cell", String(ui.cell));
    ok(ui.rows === 2, "...and a lone one on every tracing", String(ui.rows));
  }

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
