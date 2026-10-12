/* A split outline is noticed, not looked for.                                       2026-10-12

   Søren, of the dataset list's header: *"Check outlines for split structures is so specific for
   one case. Can we avoid that button by building in a guardrail?"*

   THE BUTTON WAS A SCAN NOBODY WOULD RUN. It read every outline in the dataset — dozens of Drive
   reads — to answer a question about outlines you are usually already looking at. And it answered
   it in a panel of its own, away from the rows, so the finding had to be carried back by hand.

   So the measurement moves to where the contours already are. Every path that reads an outline —
   opening one, downloading a cell, measuring a cell, saving your own work — hands the rings to
   UJ.tracing.splitNote on the way past, and the row says what it knows. Nothing extra is fetched:
   if the geometry was never read, nothing is claimed about it, which is honest and is also why
   there is no spinner.

   AND IT MARKS, IT DOES NOT BLOCK. A primary cilium traced as base and tip IS two pieces, and so
   is a nucleus that genuinely sits in two lobes on these sections. The row says what was measured
   and gets out of the way.

   WHAT IS ASSERTED:
     - the button and its "only ones I have drawn on" tick are gone from the list
     - ...while window.tracedSplitScan survives, because a thing done once a year keeps its
       function and loses its button — the precedent is tracedMeasureAll, one card up
     - splitNote/splitKnown remember per structure, and a one-piece outline is remembered as one
     - reading a cell's outlines teaches it, with nothing asked for and nothing extra fetched
     - the row then carries a marker naming the pieces, with the measurement in its title
     - ...and a one-piece row carries none
     - pressing the marker puts the SMALLER piece's centre in the coordinate boxes
     - saving a split tracing says so and saves it anyway

   Run: node tracingguardcheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

const AT = "402334,232283,479";
const SHARED = ["split_1", "whole_1"].map((sid, i) => ({
  structureId: sid, name: i ? "Lysosome 1" : "Nucleus", kind: i ? "lysosome" : "nucleus",
  instanceOf: i ? "lysosome" : "nucleus", instanceIndex: 1,
  cellType: "Endothelial cell", nucleusId: "", rootId: "", cellCoord: AT,
  contours: 8, sections: 8, versions: 1, color: "#9740e2",
  tracedBy: "Søren Grubb", contributors: ["Søren Grubb"], timestamp: "2026-10-12T09:00:00Z" }));

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
    const T = (window.UJ && UJ.tracing) || {};
    out.api = ["splitNote", "splitKnown", "splitForget"].filter(n => typeof T[n] !== "function");
    out.scanKept = typeof window.tracedSplitScan === "function";
    out.runGone = typeof window.tracingSplitRun !== "function";

    /* A square, and the same square 10 µm away on the same sections: one object and two. The
       numbers are the ones splitcheck.js already measures against, so the two files cannot
       disagree about what "split" means. */
    const sq = (z, cx, cy) => ({ z: z,
      points: [[cx - 250, cy - 250], [cx + 250, cy - 250],
               [cx + 250, cy + 250], [cx - 250, cy + 250]] });
    const whole = [], split = [];
    for (let z = 475; z <= 482; z++){ whole.push(sq(z, 401334, 231283)); split.push(sq(z, 401334, 231283)); }
    /* TWO contours for the stray piece, not eight: with both halves the same size "the smaller
       one" is a tie and the assertion below would be about the sort's stability instead of about
       which piece a person wants taking to. */
    for (let z = 475; z <= 476; z++) split.push(sq(z, 404334, 231283));
    const RES = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];

    if (out.api.length) return out;

    /* ── it remembers, per structure ─────────────────────────────────────────────── */
    T.splitForget();
    out.beforeAnything = T.splitKnown("split_1");
    const a = T.splitNote("split_1", split, RES), w = T.splitNote("whole_1", whole, RES);
    out.noted = { split: !!(a && a.split), whole: !!(w && w.split) };
    out.remembered = { split: !!(T.splitKnown("split_1") || {}).split,
                       whole: !!(T.splitKnown("whole_1") || {}).split,
                       wholeIsKnown: !!T.splitKnown("whole_1") };

    /* ── reading a cell's outlines teaches it, unasked ───────────────────────────── */
    T.splitForget();
    let fetched = 0;
    UJ.tracing.fetchMany = async function(ep, want){
      fetched++;
      const o = {};
      (want || []).forEach(function(x){
        const sid = x.structureId;
        o[sid] = { t: { structureId: sid, color: "#9740e2", kind: "lysosome" },
                   st: { name: sid, kind: "lysosome",
                         rings: sid === "split_1" ? split : whole } };
      });
      return o;
    };
    await tracingFetchCell(["split_1", "whole_1"], null);
    out.taught = { fetches: fetched,
                   split: !!(T.splitKnown("split_1") || {}).split,
                   whole: T.splitKnown("whole_1") ? !(T.splitKnown("whole_1").split) : null };

    /* ── and the row says so ─────────────────────────────────────────────────────── */
    TRACING_SHARED = SHARED.slice();
    tracingRenderShared();
    const host = document.getElementById("tracingShared");
    [].slice.call(host.querySelectorAll("details")).forEach(d => { d.open = true; });
    out.tickGone = !document.querySelector("#tracingSplitGo")
                && !document.querySelector("#tracingSplitMine");
    const markOf = (sid) => {
      const btn = host.querySelector('.tracingopen[data-sid="' + sid + '"]');
      const row = btn && btn.parentElement;
      return row ? row.querySelector(".tracingsplitmark") : null;
    };
    const m = markOf("split_1");
    out.marked = !!m;
    out.markText = m ? String(m.textContent || "").replace(/\s+/g, " ").trim() : "";
    out.markTitle = m ? String(m.getAttribute("title") || "").replace(/\s+/g, " ") : "";
    out.markAt = m ? String(m.dataset.at || "") : "";
    out.wholeUnmarked = !markOf("whole_1");

    /* ── and pressing it goes to the smaller piece ───────────────────────────────── */
    if (m){
      ["tracingX", "tracingY", "tracingZ"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = ""; });
      m.click();
      await new Promise(r => setTimeout(r, 80));
      out.jumped = ["tracingX", "tracingY", "tracingZ"]
        .map(id => (document.getElementById(id) || {}).value || "").join(",");
      out.rowStillOpen = !!(m.closest("details") || {}).open;
    }

    /* ── and saving one says so, without stopping ────────────────────────────────── */
    if (typeof tracingKeep === "function" && typeof tracingCurrentAll === "function"){
      let said = "";
      const keptNow = [];
      window.tracingSay = tracingSay = function(t){ said = String(t || ""); };
      window.tracingPublish = tracingPublish = function(){ return false; };
      window.tracingWrite = tracingWrite = function(list){ keptNow.push((list || []).length); };
      window.tracingFlushSoon = tracingFlushSoon = function(){};
      window.tracingNumberBareAfter = tracingNumberBareAfter = function(){};
      window.tracingCurrentAll = tracingCurrentAll = function(){
        return [{ id: "pad_split", name: "Nucleus", type: "Endothelial cell", color: "#9740e2",
                  nucleus_id: "", root_id: "", cell_coord: AT, rings: split }];
      };
      T.splitForget();
      TRACINGS_KEPT = [];
      try { tracingKeep(); } catch (e){ out.keepThrew = String(e && e.message || e); }
      await new Promise(r => setTimeout(r, 120));
      out.keepSaid = said.replace(/\s+/g, " ");
      out.keepKept = TRACINGS_KEPT.length;
      out.keepNoted = !!(T.splitKnown("pad_split") || {}).split;
    }
    return out;
  }, { SHARED, AT });

  if (got.noCard){ console.log(PAGE + ": no tracing card"); await b.close();
                   console.log("\nall good"); process.exit(0); }

  console.log(PAGE + "\n\nthe scan keeps its function and loses its button");
  ok((got.api || []).length === 0,
     "UJ.tracing remembers what it has measured: splitNote, splitKnown, splitForget",
     (got.api || []).join(" ") || "all three");
  if ((got.api || []).length){ await b.close(); console.log("\n" + (fails || 1) + " FAILED");
                               process.exit(1); }
  ok(got.tickGone === true,
     "the button and its “only ones I have drawn on” tick are gone from the list",
     got.tickGone ? "gone" : "still drawn");
  ok(got.runGone === true, "...and so is the handler that filled its panel",
     String(got.runGone));
  ok(got.scanKept === true,
     "...while tracedSplitScan survives for the console — a thing done once a year keeps its "
     + "function and loses its button, which is what tracedMeasureAll already does one card up",
     String(got.scanKept));

  console.log("\nand it remembers per structure");
  ok(got.beforeAnything === null,
     "nothing is claimed about an outline whose geometry has never been read — no spinner, no "
     + "fetch, no guess", JSON.stringify(got.beforeAnything));
  ok(got.noted && got.noted.split === true && got.noted.whole === false,
     "the two-piece outline measures as split and the one-piece one does not",
     JSON.stringify(got.noted));
  ok(got.remembered && got.remembered.split === true && got.remembered.whole === false
     && got.remembered.wholeIsKnown === true,
     "...and BOTH answers are remembered. “No” has to be stored too, or every row the tool has "
     + "already cleared looks exactly like a row nobody has looked at",
     JSON.stringify(got.remembered));

  console.log("\nand reading a cell teaches it, unasked");
  ok(got.taught && got.taught.fetches === 1,
     "reading a cell's outlines costs the one request it already cost",
     got.taught ? got.taught.fetches + " request(s)" : "none");
  ok(got.taught && got.taught.split === true && got.taught.whole === true,
     "...and both outlines are measured on the way past, with nothing asked for",
     JSON.stringify(got.taught));

  console.log("\nand the row says what is known");
  ok(got.marked === true, "a split outline's row carries a marker", String(got.marked));
  ok(/2/.test(got.markText || "") && /piece/i.test(got.markText || ""),
     "...naming how many pieces, on the row rather than in a panel of its own",
     got.markText || "nothing");
  ok(/do not touch/.test(got.markTitle || "") && /apart/.test(got.markTitle || ""),
     "...with the measurement itself one hover away", (got.markTitle || "").slice(0, 120));
  ok(/cilium|two|really is/i.test(got.markTitle || ""),
     "...and saying it may be right: a primary cilium traced as base and tip IS two pieces, so "
     + "this marks and does not block", (got.markTitle || "").slice(-120));
  ok(got.wholeUnmarked === true,
     "and an outline measured as one piece carries nothing — a marker on every row is no marker",
     String(got.wholeUnmarked));

  console.log("\nand it takes you there");
  ok(/^\d+,\d+,\d+$/.test(got.jumped || ""),
     "pressing the marker puts a coordinate in the boxes — “this one is wrong” is only useful if "
     + "you can get to it", got.jumped || "nothing");
  ok((got.jumped || "").split(",")[0] > 403000,
     "...the SMALLER piece's, which is the one likely to be the stray contour rather than the "
     + "object", got.jumped || "nothing");
  ok(got.rowStillOpen === true, "...without folding the row it sits in", String(got.rowStillOpen));

  console.log("\nand saving one says so without stopping");
  ok(!got.keepThrew, "the save runs", got.keepThrew || "no throw");
  ok(got.keepNoted === true,
     "what you just drew is measured as it is saved — the one moment the contours are certainly "
     + "in hand", String(got.keepNoted));
  ok(/piece/i.test(got.keepSaid || ""),
     "...and the line says so", (got.keepSaid || "").slice(-160) || "nothing");
  ok(got.keepKept === 1,
     "...and it is saved anyway. This marks; it does not refuse work", String(got.keepKept));

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
