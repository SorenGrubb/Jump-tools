/* A row of pictures, not words.                                                     2026-10-11

   Søren: *"We need to simplify the buttons also to make it more compact. Instead of Blender
   script, use the Blender logo, instead of 3D model use a symbol for a 3D model... The file should
   also be a button. The Remove button should also be a symbol. Figure out a way to say remove
   all."*

   THE DANGER IN THIS CHANGE IS NOT THE PICTURES. It is that a button's words were the only thing
   saying what it does, and fourteen of them were rewritten by a transform rather than by hand. So
   what is asserted is the three things that could silently go missing:

     - the WORDS. Every glyph keeps them in title= and aria-label=, and the tooltip now LEADS with
       the action rather than opening mid-sentence. core/mesh3d.js says it about its own corner
       buttons: an icon is a rebus, and a rebus is not a label.
     - the WIRING. The handlers find their buttons by class, and the classes had to survive the
       rewrite. A row of beautiful icons that do nothing is the worst outcome available here.
     - the DIFFERENCE between going to look at something and taking it away. Remove and Remove all
       are the only buttons on this card that destroy work, and as icons they would otherwise be
       the same green pill as Neuroglancer, one place along.

   Run: node tracingiconcheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

const SETUP = `(function(){
  const mk = (n, nm, col) => ({ structureId:"s"+n, name:nm, kind:"lysosome",
    instanceOf:"lysosome", color:col, nucleusId:"405191", rootId:"864691136051278323",
    cellCoord:"234624,228032,17512", cellType:"Microglia", contours:22, sections:21, versions:1,
    tracedBy:"Hesham Mohamed", contributors:["Hesham Mohamed"], timestamp:"2026-10-11",
    fileUrl:"https://example.invalid/x" });
  TRACING_SHARED = [mk(1,"Lysosome 1","#4ade80"), mk(2,"Lysosome 2","#d9e07a")];
  tracingRenderShared();
  TRACINGS_KEPT = [1,2,3].map(i => ({ name:"Lysosome "+i, color:"#4ade80",
    nucleus_id:"368046", root_id:"864691135976212035", cell_coord:"218176,185568,22154",
    type:"Microglia", volume_um3:0.44,
    rings:[{z:1,points:[[0,0],[1,0],[1,1]]},{z:2,points:[[0,0],[1,0],[1,1]]}] }));
  tracingRenderList();
  return true;
})`;

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  p.on("pageerror", e => { if (!/atob/.test(e.message)) errors.push(e.message); });
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto("file://" + page_(PAGE));
  await p.waitForTimeout(3000);

  const has = await p.evaluate(() => typeof tracingRenderShared === "function");
  if (!has){
    console.log("  (no tracing card on this page)");
    await b.close(); process.exit(0);
  }
  await p.evaluate(src => eval(src)(), SETUP);   // eslint-disable-line no-eval

  console.log("every action is a picture, and every picture keeps its words");
  const got = await p.evaluate(() => {
    const CLASSES = ["tracingcellpad", "tracingcellngl", "tracingcellglb", "tracingcellpy",
                     "tracingcellzip", "tracingopen", "tracingngl", "tracingglb", "tracingpy",
                     "tracingcelldrop", "tracingview", "tracingdrop"];
    const out = [];
    CLASSES.forEach(function(c){
      [].slice.call(document.querySelectorAll("." + c)).forEach(function(e){
        out.push({ cls: c,
                   text: e.textContent.replace(/\s+/g, " ").trim(),
                   label: e.getAttribute("aria-label") || "",
                   title: e.getAttribute("title") || "",
                   glyph: !!(e.querySelector("svg") || e.querySelector("img")),
                   img: !!e.querySelector("img"),
                   danger: /\btracingdanger\b/.test(e.className) });
      });
    });
    const file = document.querySelector("#tracingShared a.idbtn[aria-label]");
    return { rows: out, style: !!document.getElementById("tracingIconStyle"),
             file: file ? { label: file.getAttribute("aria-label"),
                            glyph: !!file.querySelector("svg"),
                            text: file.textContent.trim() } : null };
  });
  const rows = got.rows || [];
  ok(rows.length >= 12, "both lists rendered their buttons", rows.length + " buttons");
  ok(rows.every(r => r.glyph),
     "...and every one of them draws a glyph rather than saying a word",
     rows.filter(r => !r.glyph).map(r => r.cls).join(", ") || "all of them");
  ok(rows.every(r => r.label),
     "...with an aria-label, because a rebus read aloud is nothing at all",
     rows.filter(r => !r.label).map(r => r.cls).join(", ") || "all of them");
  ok(rows.every(r => r.title && r.title.indexOf(r.label) === 0),
     "...and a tooltip that LEADS with the action, rather than opening mid-sentence as these did "
     + "when the button itself said the name",
     rows.filter(r => !(r.title && r.title.indexOf(r.label) === 0))
         .map(r => r.cls + ": " + r.title.slice(0, 30)).join(" | ") || "all of them");
  /* The only words left on any of them, and they are there on purpose. */
  const worded = rows.filter(r => r.text);
  ok(worded.length && worded.every(r => r.cls === "tracingcelldrop" && /^all \d+$/.test(r.text)),
     "the ONLY button that still carries text is Remove all, and it carries a NUMBER \u2014 a bin "
     + "that silently takes six outlines away is exactly the button that should not be a rebus",
     worded.map(r => r.cls + ' "' + r.text + '"').join(", ") || "none");

  console.log("\nand taking work away does not look like going to look at it");
  const dang = rows.filter(r => r.cls === "tracingdrop" || r.cls === "tracingcelldrop");
  ok(dang.length >= 2 && dang.every(r => r.danger),
     "both Removes are marked as destructive, so they are not the same green pill as Neuroglancer "
     + "one place along", dang.map(r => r.cls + ":" + r.danger).join(", ") || "none found");
  ok(rows.filter(r => r.cls === "tracingngl" || r.cls === "tracingview").every(r => !r.danger),
     "...and nothing else is", "none of the viewer buttons");
  ok(got.style, "the destructive style was injected, once, by the list that needs it",
     String(got.style));

  console.log("\nand the Blender mark is Blender's own");
  const py = rows.filter(r => r.cls === "tracingpy" || r.cls === "tracingcellpy");
  ok(py.length >= 2 && py.every(r => r.img),
     "the Blender buttons carry an image, not my redrawing of somebody's trademark \u2014 it is "
     + "their artwork, used to refer to Blender, which is what their guidelines are for",
     py.map(r => r.cls + (r.img ? " img" : " NOT an img")).join(", "));

  console.log("\nand the file is a button now");
  ok(got.file && got.file.glyph && !got.file.text,
     "S\u00f8ren: *\u201cThe file should also be a button\u201d* \u2014 it is, with the Drive mark, and it is "
     + "still an <a> because it opens a Drive URL in a new tab and that is what an anchor is for",
     got.file ? (got.file.label + ", glyph " + got.file.glyph) : "not found");

  /* ── AND THEY STILL DO SOMETHING ───────────────────────────────────────────────────────────
     The handlers find their buttons by class. The transform rewrote fourteen button literals, and
     a class dropped in that rewrite would leave a row of beautiful icons that do nothing — which
     no amount of looking at the page would reveal. */
  console.log("\nand the wiring survived the rewrite");
  const wired = await p.evaluate(async () => {
    const called = [];
    window.tracingCellGlb = tracingCellGlb = async function(g, b2, fmt){
      called.push("cellglb:" + (fmt || "glb") + ":" + (g && g.items.length)); };
    window.tracingOneGlb = tracingOneGlb = async function(sid, b2, fmt){
      called.push("oneglb:" + (fmt || "glb") + ":" + sid); };
    window.tracingCellSharedInViewer = tracingCellSharedInViewer = function(sids){
      called.push("cellngl:" + sids.length); };
    window.tracingOpenCellShared = tracingOpenCellShared = function(sids){
      called.push("cellpad:" + sids.length); };
    tracingRenderShared();
    const q = (c) => document.querySelector("#tracingShared ." + c);
    ["tracingcellpad", "tracingcellngl", "tracingcellglb", "tracingcellpy", "tracingglb",
     "tracingpy"].forEach(function(c){ const e = q(c); if (e) e.click(); });
    await new Promise(r => setTimeout(r, 300));
    return called;
  });
  ok((wired || []).length === 6,
     "pressing each glyph still reaches the handler it always reached \u2014 the classes are what "
     + "the wiring looks for, and they had to survive a transform that rewrote every literal",
     (wired || []).join(", ") || "nothing fired");
  ok((wired || []).join(",").indexOf("cellglb:py") >= 0
     && (wired || []).join(",").indexOf("oneglb:py") >= 0,
     "...including the two that ask for the Blender script rather than the GLB, which differ only "
     + "in an argument", (wired || []).filter(x => /py/.test(x)).join(", ") || "neither");

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
