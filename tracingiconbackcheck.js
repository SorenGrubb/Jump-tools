/* A button that says "meshing…" has to be a button again afterwards.                 2026-10-12

   Yesterday the tracing card's buttons became glyphs (src/a_row_of_pictures_not_words.py). Every
   one of them that shows progress does it the same way, and has for a year:

       var label = btn.textContent;          //  ""   -- an <svg> has no text
       btn.textContent = "meshing…";    //  the SVG is gone, replaced by a text node
       ...
       btn.textContent = label;              //  ""   -- the button is now permanently blank

   With words on the buttons that round-tripped exactly. With pictures on them it erases the
   picture on the first press and never puts it back: eight glyphs in a row, and the one you used
   is a blank green pill. Nothing threw, nothing was logged, and the page goes on working.

   THE SHAPE OF THE BUG, not one site of it: nine functions save and restore a label this way, in
   two lists and on rows as well as cell headers. So this presses a button of each kind and asserts
   the mark comes back -- and asserts the saved label is the MARKUP and not the text, because a fix
   that restored the right glyph to one button while the other eight still read .textContent would
   pass a check that only pressed one.

   Run: node tracingiconbackcheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

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
  p.on("pageerror", e => { if (!/atob|no network in this check/.test(e.message)) errors.push(e.message); });
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto("file://" + page_(PAGE));
  await p.waitForTimeout(3000);

  const got = await p.evaluate(async ({ SHARED, AT }) => {
    if (typeof tracingRenderShared !== "function" || !document.getElementById("tracingShared"))
      return { noCard: true };
    const out = { pressed: [] };
    window.open = function(){ return null; };

    /* Nothing is downloaded and nothing is fetched: what is under test is the button, not the
       file. Each stub answers instantly so the restore has certainly run by the time it is read. */
    const sq = (z) => ({ z: z, points: [[399750, 229750], [400250, 229750],
                                        [400250, 230250], [399750, 230250]] });
    const rings = []; for (let z = 400; z <= 406; z++) rings.push(sq(z));
    window.tracingSaveBlob = tracingSaveBlob = function(){};
    window.tracingFetchCell = tracingFetchCell = async function(sids){
      return sids.map(s => ({ sid: s, t: { color: "#cddc39", kind: "cell" },
        st: { name: "Whole cell", kind: "cell", rings: rings } })); };
    window.tracingFetchShared = tracingFetchShared = async function(){
      return { t: { color: "#cddc39", kind: "cell" },
               st: { name: "Whole cell", kind: "cell", rings: rings } }; };
    /* The placement menu, if this page has one, answers itself: this check is about the button. */
    if (typeof tracingPlaceAsk === "function")
      window.tracingPlaceAsk = tracingPlaceAsk = async function(){ return false; };

    TRACING_SHARED = SHARED.slice();
    tracingRenderShared();
    const host = document.getElementById("tracingShared");
    /* Open everything, so a row button is reachable as well as a header one. */
    [].slice.call(host.querySelectorAll("details")).forEach(d => { d.open = true; });

    /* SAVED, NOT SPELLED OUT. What each of these does differs; what they must all do is put back
       whatever was in the button. */
    const marks = ["tracingcellglb", "tracingcellpy", "tracingcellpad", "tracingcellngl",
                   "tracingglb", "tracingpy", "tracingopen", "tracingngl"];
    for (const cls of marks){
      const btn = host.querySelector("." + cls);
      if (!btn){ out.pressed.push({ cls: cls, missing: true }); continue; }
      const before = btn.innerHTML;
      const hadMark = /<svg|<img/i.test(before);
      btn.click();
      /* Long enough for a stubbed fetch, a mesh and the finally{} to have run. */
      const t0 = Date.now();
      while (Date.now() - t0 < 4000 && btn.disabled) await new Promise(r => setTimeout(r, 40));
      await new Promise(r => setTimeout(r, 120));
      out.pressed.push({ cls: cls, hadMark: hadMark, back: btn.innerHTML === before,
                         now: btn.innerHTML.replace(/\s+/g, " ").slice(0, 46),
                         disabled: btn.disabled });
    }

    /* And the same for "Remove all", which arms itself by swapping its own label. */
    if (typeof tracingRenderList === "function" && typeof TRACINGS_KEPT !== "undefined"){
      TRACINGS_KEPT = [{ name: "Lysosome 1", color: "#3a6b5a", type: "Endothelial cell",
                         nucleus_id: "", root_id: "", cell_coord: AT, rings: rings }];
      tracingRenderList();
      const kept = document.getElementById("tracingList");
      [].slice.call(kept.querySelectorAll("details")).forEach(d => { d.open = true; });
      const drop = kept.querySelector(".tracingcelldrop");
      if (drop){
        const before = drop.innerHTML;
        drop.click();                                   /* arms: swaps the label for the question */
        out.armedText = String(drop.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        /* ...and disarms itself after its own timeout. Rather than waiting four seconds, the
           timeout is what the code restores through, so it is driven here. */
        out.armedWipes = !/<svg|<img/i.test(drop.innerHTML);
        out.armedBefore = before;
        /* tracingArm disarms itself after four seconds, and that timeout is the OTHER end of the
           same round trip. Waited out rather than reasoned about: it is the path a person takes
           by changing their mind, and it restored "" until today. */
        await new Promise(r => setTimeout(r, 4400));
        out.disarmedBack = drop.innerHTML === before;
        out.disarmedNow = drop.innerHTML.replace(/\s+/g, " ").slice(0, 46);
      }
    }
    return out;
  }, { SHARED, AT });

  if (got.noCard){ console.log(PAGE + ": no tracing card"); await b.close();
                   console.log("\nall good"); process.exit(0); }

  console.log(PAGE + "\n\nevery button that reports progress is a button again afterwards");
  const seen = (got.pressed || []).filter(x => !x.missing);
  ok(seen.length >= 6,
     "there are buttons of both kinds to press — cell headers and the rows under them",
     seen.length + " of " + (got.pressed || []).length + ": "
     + (got.pressed || []).filter(x => x.missing).map(x => x.cls).join(" ") || "all found");
  ok(seen.length > 0 && seen.every(x => x.hadMark),
     "...and each of them carried a glyph before it was pressed, or this check is pressing "
     + "something else", seen.filter(x => !x.hadMark).map(x => x.cls).join(" ") || "all marked");
  const lost = seen.filter(x => !x.back);
  ok(lost.length === 0,
     "...and every one of them is unchanged afterwards. A label saved with .textContent is \"\" "
     + "for a glyph, so restoring it blanks the button for good",
     lost.map(x => x.cls + " → “" + x.now + "”").join("   ") || "all put back");
  ok(seen.every(x => !x.disabled),
     "...and re-enabled", seen.filter(x => x.disabled).map(x => x.cls).join(" ") || "all enabled");

  console.log("\nand “Remove all” still asks in the button itself");
  ok(/Click again/i.test(got.armedText || ""),
     "pressing it once replaces the glyph with the question, which is the point of it",
     got.armedText || "nothing");
  ok(got.armedWipes === true,
     "...so the glyph really is gone while it is armed — if it were not, the restore below would "
     + "be asserting nothing", String(got.armedWipes));
  ok(/<svg|<img/i.test(got.armedBefore || ""),
     "...and what it has to put back is markup, not text", (got.armedBefore || "").slice(0, 40));
  ok(got.disarmedBack === true,
     "...and four seconds later, having changed your mind, you have a bin again rather than an "
     + "empty pill", got.disarmedBack ? "back" : ("left as “" + (got.disarmedNow || "") + "”"));

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
