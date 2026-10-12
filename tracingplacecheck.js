/* One place for the geometry.                                                       2026-10-12

   Søren: *"if there is no problem with showing the 3D model centered in the downloaded file
   viewer, then why do we still have two options? That complicates things. In that case, we only
   need the option with the dataset coordinates."*

   THIS FILE HELD A MENU FOR AN HOUR, and before that a tick, and the whole sequence is worth the
   paragraph because it is one mistake with three dresses:

     2026-10-11  *"the 3D model in the tracing dataset looks empty because it is not centered."*
                 Read as "this viewer frames the origin rather than the scene". A tick.
     2026-10-11  the tick could not be unticked: its state lived in the list's own markup.
     2026-10-12  the tick became a question asked at the press.
     2026-10-12  and the question turned out to have no wrong answer.

   THE EMPTY ROOM WAS THE NUCLEUS UNIT BUG. scaleToNm: 1 against core/nucmesh.js, which returns
   micrometres: a nucleus 1000× too far out put a 930 µm bounding box around a 200 µm cell, and a
   viewer that frames the CONTENT then shows a mostly empty room with a speck in it. Fixed in
   src/a_module_says_its_own_unit.py, the same day, independently — and nobody went back to ask
   whether the other fix was still needed.

   HIS OWN TEST CLOSED IT. A cell placed 876 µm from the origin displayed normally in his viewer.
   If it framed the origin, that file would have been the empty room.

   So: one option. What is asserted here is that there is nothing left to ask, that the file is
   placed anyway, and that the line says WHERE — because one object alone looks the same wherever
   it sits, so a sentence that only claimed a placement could not be checked by the person
   reading it. That last part is the whole reason this check still exists.

   Run: node tracingplacecheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

/* A cell 1.6 mm from the origin, so "placed" cannot be mistaken for "near enough to zero". */
const AT = "402334,232283,479";
const SHARED = [{
  structureId: "s1", name: "Whole cell", kind: "cell", instanceOf: "cell", color: "#cddc39",
  cellType: "Endothelial cell", nucleusId: "", rootId: "", cellCoord: AT,
  contours: 7, sections: 7, versions: 1, vertices: 900, volumeUm3: 44,
  tracedBy: "Søren Grubb", contributors: ["Søren Grubb"],
  fileUrl: "https://drive.google.com/x", timestamp: "2026-10-12T09:00:00Z" }];

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  const errors = [];
  p.on("pageerror", e => { if (!/atob/.test(e.message)) errors.push(e.message); });
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto("file://" + page_(PAGE));
  await p.waitForTimeout(3000);

  const got = await p.evaluate(async ({ SHARED, AT }) => {
    if (typeof tracingRenderShared !== "function" || !document.getElementById("tracingShared"))
      return { noCard: true };
    const out = {};
    /* NOTHING IS LEFT TO ANSWER WITH. Each of these was a way to say where the file should go;
       all three are gone, and a survivor is a second way to answer a question nobody asks. */
    out.leftovers = ["tracingPlaceAsk", "tracingPlaceTickHtml", "tracingPlaceWire",
                     "tracingPlaceWanted", "tracingPlaceSet"]
                    .filter(n => typeof window[n] === "function");
    out.saysWhere = typeof tracingPlaceSay === "function"
                 && typeof tracingPlaceWhereUm === "function";

    const sq = (z) => ({ z: z, points: [[401334, 231283], [403334, 231283],
                                        [403334, 233283], [401334, 233283]] });
    const rings = []; for (let z = 475; z <= 483; z++) rings.push(sq(z));
    let saved = [];
    window.tracingSaveBlob = tracingSaveBlob = function(blob, name){ saved.push({ blob, name }); };
    window.tracingFetchCell = tracingFetchCell = async function(sids){
      return sids.map(s => ({ sid: s, t: { color: "#cddc39", kind: "cell" },
        st: { name: "Whole cell", kind: "cell", rings: rings } })); };
    window.tracingFetchShared = tracingFetchShared = async function(){
      return { t: { color: "#cddc39", kind: "cell" },
               st: { name: "Whole cell", kind: "cell", rings: rings } }; };

    TRACING_SHARED = SHARED.slice();
    tracingRenderShared();
    const host = document.getElementById("tracingShared");
    [].slice.call(host.querySelectorAll("details")).forEach(d => { d.open = true; });
    out.noTick = !host.querySelector("#tracingPlaceAt");
    out.help = String((host.querySelector(".tracingcellglb") || {}).title || "")
      .replace(/\s+/g, " ");

    const settle = async (ms) => { await new Promise(r => setTimeout(r, ms || 120)); };
    const wait = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 6000 && !saved.length) await settle(60);
      return saved.length ? saved[0] : null;
    };
    const glbBtn = () => host.querySelector(".tracingcellglb");
    const pyBtn  = () => host.querySelector(".tracingcellpy");

    /* ── one press, no question ──────────────────────────────────────────────────── */
    saved = [];
    glbBtn().click();
    await settle(250);
    out.askedAnyway = !!document.querySelector("#tracingPlaceMenu, .tracingplacemenu");
    const f = await wait();
    if (f){
      const u8 = new Uint8Array(await f.blob.arrayBuffer());
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));
      out.glbAt = (j.nodes[0] || {}).translation || [0, 0, 0];
      out.everyNodeSame = (j.nodes || []).every(n =>
        (n.translation || [0, 0, 0]).join(",") === (j.nodes[0].translation || [0, 0, 0]).join(","));
      out.name = f.name;
    }
    out.said = String((document.getElementById("tracingStatus") || {}).textContent || "")
      .replace(/\s+/g, " ");

    /* ── and the script agrees about where ───────────────────────────────────────── */
    saved = [];
    pyBtn().click();
    await settle(250);
    const g = await wait();
    if (g){
      const txt = await g.blob.text();
      out.pyAt = (txt.match(/_add\('Whole cell',[^[]*?,\s*\(([-0-9.,]+)\),\s*\[/) || [])[1] || "";
    }

    /* ── and the number in the line is the one in the file ───────────────────────── */
    const box = {};
    UJ.traceloft.glb([{ name: "Whole cell", rings: rings, color: "#cddc39" }],
                     (UJ.cfg && UJ.cfg.res) || [4, 4, 40], { place: true, out: box });
    out.where = tracingPlaceWhereUm(box);
    return out;
  }, { SHARED, AT });

  if (got.noCard){ console.log(PAGE + ": no tracing card"); await b.close();
                   console.log("\nall good"); process.exit(0); }

  console.log(PAGE + "\n\nthere is nothing left to ask");
  ok((got.leftovers || []).length === 0,
     "the tick, its wiring and the menu are all gone from the module — three ways to answer one "
     + "question, and the question turned out to have one answer",
     (got.leftovers || []).join(" ") || "all gone");
  ok(got.noTick === true, "...and nothing is drawn in the list either", String(got.noTick));
  ok(got.askedAnyway === false,
     "pressing 3D model downloads, rather than opening a menu: one press again",
     got.askedAnyway ? "a menu appeared" : "no menu");
  ok(/dataset coordinates/i.test(got.help || "") && !/you choose|centred on itself/i.test(got.help || ""),
     "...and the button says what it will do rather than offering",
     (got.help || "").slice(0, 110));

  console.log("\nand the file is placed where the cell is");
  ok(got.glbAt && Math.max.apply(null, got.glbAt.map(Math.abs)) > 100,
     "the GLB carries its dataset coordinates", JSON.stringify(got.glbAt));
  ok(got.everyNodeSame === true,
     "...and every part of the cell carries the SAME one, or the cell comes apart in the scene "
     + "it was placed for", String(got.everyNodeSame));
  ok(got.pyAt && got.pyAt !== "0,0,0",
     "...and the Blender script puts it in the same place. Two downloads of one cell that "
     + "disagree about where it is are worse than either position", String(got.pyAt));

  console.log("\nand the line says where, which is the only way to check it");
  ok(/\d/.test((got.said || "").match(/-?\d+(?:,\s*-?\d+){2}\s*µm/) || ""),
     "the line names the Location the object will have — readable in Blender's N panel in four "
     + "seconds. Søren spent an evening deciding this was broken when the file was right",
     ((got.said || "").match(/-?\d+(?:,\s*-?\d+){2}\s*µm/) || [])[0] || (got.said || "").slice(0, 90));
  ok(/looks the same wherever it sits|frames whatever it is given/i.test(got.said || ""),
     "...and says out loud that one object alone looks the same wherever it sits, because that "
     + "is the test he will run and it cannot tell anything apart",
     (got.said || "").slice(0, 150));
  ok(got.where && Math.max.apply(null, got.where.map(Math.abs)) > 100,
     "...and the number comes from the writer, which computed it anyway, rather than from a "
     + "second bounding box that could disagree with the first", JSON.stringify(got.where));

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
