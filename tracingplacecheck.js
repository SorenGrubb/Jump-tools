/* Placed or centred is asked, not remembered.                                       2026-10-12

   Søren, of the two controls in the dataset list's header: *"These are also not clear what their
   function is. Perhaps it should be a choice you make when you click the 3D model button whether
   you want it ready for Blender or as a standalone model?"*

   THE TICK WAS A SETTING FOR A DECISION. A tick sits there between presses holding an answer to a
   question nobody asked it today — which is how the same tick, written into the list's markup,
   came back on after a re-render and gave him a file he had not asked for. Even working perfectly
   it is a thing to remember: the state is invisible at the moment it matters, which is the press.

   So the press asks, and the two answers are named by what they are FOR rather than by what they
   do to the coordinates. Nothing is remembered between presses, deliberately: a half-remembered
   placement that disagrees with what you think you did is the debugging trap ωJump's build guard
   refuses storage over, and it applies to a downloaded file just as well.

   WHAT IS ASSERTED:
     - the "Dataset coordinates" tick is GONE, from the list and from the module
     - pressing 3D model downloads nothing and asks instead
     - the menu offers exactly two answers, each saying what it is for
     - "centred" puts the GLB at the origin; "dataset coordinates" puts it where the cell is
     - the Blender script takes the SAME answer, because two downloads of one cell that disagree
       about where it is are worse than either position
     - dismissing it — Escape, or a click elsewhere — downloads NOTHING, which is the thing a tick
       could never get wrong because it never asked
     - a second press closes the first menu rather than stacking
     - asking does not fold the row the button sits in
     - and the line afterwards says which was chosen

   Run: node tracingplacecheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

/* A cell far from the origin, so "placed" and "centred" cannot be confused: 1.6 mm out. */
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
    out.hasAsk = typeof tracingPlaceAsk === "function";
    /* THE TICK IS GONE, not hidden. A tick still in the module is a tick some other page still
       draws, and two ways to answer one question is the thing being removed. */
    out.tickLeft = ["tracingPlaceTickHtml", "tracingPlaceWire", "tracingPlaceWanted",
                    "tracingPlaceSet"].filter(n => typeof window[n] === "function");

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
    out.tickInList = !!host.querySelector("#tracingPlaceAt");
    out.labelSays = String((host.querySelector("#tracingSharedLabel") || {}).textContent || "")
      .replace(/\s+/g, " ");

    const menu = () => document.getElementById("tracingPlaceMenu");
    const settle = async (ms) => { await new Promise(r => setTimeout(r, ms || 120)); };
    const where = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 5000 && !saved.length) await settle(60);
      if (!saved.length) return null;
      const u8 = new Uint8Array(await saved[0].blob.arrayBuffer());
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));
      return (j.nodes[0] || {}).translation || [0, 0, 0];
    };
    const py = async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 5000 && !saved.length) await settle(60);
      if (!saved.length) return null;
      const txt = await saved[0].blob.text();
      return (txt.match(/_add\('Whole cell',[^[]*?,\s*\(([-0-9.,]+)\),\s*\[/) || [])[1] || "none";
    };
    const glbBtn = () => host.querySelector(".tracingcellglb");
    const pyBtn  = () => host.querySelector(".tracingcellpy");

    /* ── pressing it asks ─────────────────────────────────────────────────────────── */
    saved = [];
    glbBtn().click();
    await settle(200);
    const m = menu();
    out.asked = !!m;
    if (!m) return out;
    const picks = [].slice.call(m.querySelectorAll(".tracingplacepick"));
    out.choices = picks.map(x => ({ v: x.dataset.place,
                                    text: String(x.textContent || "").replace(/\s+/g, " ").trim() }));
    out.nothingYet = saved.length;
    out.nearButton = (function(){
      const a = m.getBoundingClientRect(), r = glbBtn().getBoundingClientRect();
      return Math.round(Math.abs(a.left - r.left)) + "," + Math.round(a.top - r.bottom);
    })();
    out.rowStillOpen = !!(glbBtn().closest("details") || {}).open;

    /* ── centred ──────────────────────────────────────────────────────────────────── */
    picks.filter(x => x.dataset.place === "0")[0].click();
    out.centred = await where();
    out.centredSaid = String((document.getElementById("tracingStatus") || {}).textContent || "")
      .replace(/\s+/g, " ");
    out.menuGone = !menu();

    /* ── at its dataset coordinates ───────────────────────────────────────────────── */
    saved = [];
    glbBtn().click(); await settle(200);
    menu().querySelectorAll(".tracingplacepick")[1].click();
    out.placed = await where();
    out.placedSaid = String((document.getElementById("tracingStatus") || {}).textContent || "")
      .replace(/\s+/g, " ");
    /* The writers' own report, read through the same door the card uses. */
    if (typeof tracingPlaceWhereUm === "function"){
      const box = {};
      UJ.traceloft.glb([{ name: "Whole cell", rings: rings, color: "#cddc39" }],
                       (UJ.cfg && UJ.cfg.res) || [4, 4, 40], { place: true, out: box });
      out.placedWhere = tracingPlaceWhereUm(box);
    }

    /* ── and the Blender script takes the same answer ─────────────────────────────── */
    saved = [];
    pyBtn().click(); await settle(200);
    out.pyAsked = !!menu();
    if (menu()) menu().querySelectorAll(".tracingplacepick")[0].click();
    out.pyCentred = await py();
    saved = [];
    pyBtn().click(); await settle(200);
    if (menu()) menu().querySelectorAll(".tracingplacepick")[1].click();
    out.pyPlaced = await py();

    /* ── dismissing downloads nothing ─────────────────────────────────────────────── */
    saved = [];
    glbBtn().click(); await settle(200);
    out.upBeforeEsc = !!menu();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(250);
    out.escClosed = !menu();
    out.escSaved = saved.length;
    out.escEnabled = !glbBtn().disabled;

    saved = [];
    glbBtn().click(); await settle(200);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(250);
    out.outsideClosed = !menu();
    out.outsideSaved = saved.length;

    /* ── and two presses do not stack ─────────────────────────────────────────────── */
    saved = [];
    glbBtn().click(); await settle(150);
    pyBtn().click();  await settle(150);
    out.menus = document.querySelectorAll("#tracingPlaceMenu, .tracingplacemenu").length;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(200);
    out.stackSaved = saved.length;
    return out;
  }, { SHARED, AT });

  if (got.noCard){ console.log(PAGE + ": no tracing card"); await b.close();
                   console.log("\nall good"); process.exit(0); }

  console.log(PAGE + "\n\nthe tick is gone");
  ok(got.hasAsk === true, "the card asks instead: tracingPlaceAsk is here", String(got.hasAsk));
  ok(got.tickInList === false, "the dataset list's header no longer carries it",
     got.tickInList ? "#tracingPlaceAt is still drawn" : "not in the list");
  ok((got.tickLeft || []).length === 0,
     "...and neither does the module. A tick left behind is a tick some other page still draws, "
     + "and two ways to answer one question is what is being removed",
     (got.tickLeft || []).join(" ") || "all gone");
  ok(!/dataset coordinates/i.test(got.labelSays || ""),
     "...and the label above the list stops mentioning it", (got.labelSays || "").slice(0, 110));

  console.log("\nand the press asks");
  ok(got.asked === true, "pressing 3D model opens the menu", String(got.asked));
  ok(got.nothingYet === 0,
     "...and has downloaded nothing yet, because the question has not been answered",
     String(got.nothingYet) + " file(s) saved");
  const ch = got.choices || [];
  ok(ch.length === 2, "two answers, no more", ch.length + ": " + ch.map(x => x.v).join(","));
  ok(ch.length === 2 && /centred|centered/i.test(ch[0].text) && /viewer/i.test(ch[0].text),
     "the first says what it is FOR — a viewer that frames the origin rather than the scene",
     ch[0] ? ch[0].text.slice(0, 95) : "none");
  ok(ch.length === 2 && /coordinate/i.test(ch[1].text) && /scene|line up|together/i.test(ch[1].text),
     "...and the second likewise: several cells landing in one scene where they belong. Named by "
     + "the job, not by what it does to the numbers",
     ch[1] ? ch[1].text.slice(0, 95) : "none");
  ok(got.rowStillOpen === true,
     "asking does not fold the row the button sits in", String(got.rowStillOpen));

  console.log("\nand the answer reaches the file");
  ok(got.centred && Math.max.apply(null, got.centred.map(Math.abs)) === 0,
     "centred puts the model at the origin — the whole of what Windows 3D Viewer needs to show "
     + "it at all", JSON.stringify(got.centred));
  ok(got.placed && Math.max.apply(null, got.placed.map(Math.abs)) > 100,
     "...and dataset coordinates put it where the cell is", JSON.stringify(got.placed));
  ok(got.menuGone === true, "...and the menu closes once answered", String(got.menuGone));
  ok(got.pyAsked === true, "the Blender script asks the same question", String(got.pyAsked));
  ok(got.pyCentred === "0,0,0" && got.pyPlaced && got.pyPlaced !== "0,0,0",
     "...and takes the same answer, both ways. Two downloads of one cell that disagree about "
     + "where it is are worse than either position",
     "centred " + got.pyCentred + ", placed " + got.pyPlaced);
  ok(/centred on itself|framed/i.test(got.centredSaid || "")
     && /dataset coordinates/i.test(got.placedSaid || ""),
     "and the line afterwards says which it did", (got.centredSaid || "").slice(-80));
  /* \u2500\u2500 AND SAYS WHERE, NOT JUST WHETHER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  2026-10-12
     S\u00f8ren, an hour after this went in: *"The centred on itself worked fine, but then when I
     tried dataset coordinates it looks like it is still centred on itself."* The file was right
     \u2014 876 \u00b5m out, read from his own Downloads folder \u2014 and the picture could not
     have shown it: a viewer frames whatever it is given, so one object alone looks the same at
     the origin and a millimetre away. The promise was unfalsifiable, which reads as a bug. */
  const num = (s2) => (String(s2 || "").match(/-?\d+(?:,\s*-?\d+){2}\s*\u00b5m/) || [])[0] || "";
  ok(/\d/.test(num(got.placedSaid)),
     "placed, the line names the Location the object will have \u2014 a number he can read off "
     + "Blender\u2019s N panel in four seconds, instead of a promise he has to believe",
     num(got.placedSaid) || (got.placedSaid || "").slice(0, 90));
  ok(/looks the same|same as the centred/i.test(got.placedSaid || ""),
     "...and says out loud that ONE object looks the same either way, because that is the test he "
     + "will run and it cannot tell them apart", (got.placedSaid || "").slice(0, 130));
  ok(got.placedWhere && Math.max.apply(null, got.placedWhere.map(Math.abs)) > 100,
     "...and the writer hands the place back rather than the card recomputing a bounding box "
     + "that was just computed", JSON.stringify(got.placedWhere));

  console.log("\nand changing your mind costs nothing");
  ok(got.upBeforeEsc === true && got.escClosed === true, "Escape closes it",
     "up " + got.upBeforeEsc + ", closed " + got.escClosed);
  ok(got.escSaved === 0,
     "...and downloads NOTHING. This is the thing the tick could never get wrong, because it "
     + "never asked — and the thing a menu gets wrong by treating dismissal as the default",
     String(got.escSaved) + " file(s)");
  ok(got.escEnabled === true, "...and the button is usable again", String(got.escEnabled));
  ok(got.outsideClosed === true && got.outsideSaved === 0,
     "a click elsewhere does the same", "closed " + got.outsideClosed
     + ", " + got.outsideSaved + " file(s)");
  ok(got.menus === 1,
     "and pressing a second button replaces the menu rather than stacking two of them, each "
     + "holding a different button's question", String(got.menus));
  ok(got.stackSaved === 0, "...with nothing downloaded by the one that was replaced",
     String(got.stackSaved) + " file(s)");

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
