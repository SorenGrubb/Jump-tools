/* Folded, and filed under whoever drew it.                                           2026-10-11

   Søren, of the tracing card: *"It is getting too much with all these tracings. Let's collapse
   them. For the tracings in the dataset, let's also collapse them but also organise them under
   users."* Asked how, he chose **person, then cell**, and a collapsed header that carries
   **counts and people**.

   THE TRAP THIS CHECK EXISTS FOR. Both lists are re-rendered from scratch on nearly every action —
   a share, a removal, a refresh of the index. The "Dataset coordinates" tick was written with its
   state in the list's own innerHTML and could not be unticked, because the list was rebuilt twice
   per press. A fold is the same shape of thing with more of it: if open-ness lives in the DOM, the
   list closes under you. So it is asserted here that a fold opened by hand is STILL OPEN after a
   re-render, and keyed by what the group is rather than where it sits.

   AND A BUTTON IN A SUMMARY IS STILL A BUTTON. Six per cell header, all of them inside the thing
   you click to fold. A press that both opened Neuroglancer and collapsed the row would be a bug
   nobody would report clearly — so it is pressed here.

   WHAT IS ASSERTED:
     - the dataset list's top level is people, one fold each, counted by tracings and by cells
     - under a person, one fold per cell, and the header says how many of the cell's tracings are
       theirs and who else has worked on it
     - a cell's own buttons still act on the WHOLE cell, not on one person's share of it, because
       there is only one cell and "3D model of this cell" can only mean one thing
     - a tracing with two contributors is filed under both, and the list says so once
     - everything is closed to begin with, except a level with only one group, where folding hides
       and offers nothing
     - opening one and re-rendering leaves it open
     - pressing a button in a header does not fold the header
     - open all / close all reach every fold in that list, and survive a re-render
     - the kept list folds the same way and its header carries its count

   Run: node tracingfoldcheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

/* Three cells and three people, arranged so every question has a different answer:
     cell A -- 4 tracings, 3 of them Søren's, 1 Hesham's      (a person with a SHARE of a cell)
     cell B -- 3 tracings, all Hesham's                       (a person with all of a cell)
     cell C -- 1 tracing, two contributors                    (one tracing, two people)
   So Hesham has 5 tracings in 3 cells and Søren 4 in 2, and the two counts differ -- a fixture
   where they matched would let a header that prints the wrong number pass. */
const A = "402334,232283,479", B = "427087,220193,1940";
const row = (sid, name, at, nuc, who, extra) => Object.assign({
  structureId: sid, name: name, kind: "organelle", instanceOf: "lysosome", instanceIndex: 1,
  cellType: "Endothelial cell", nucleusId: nuc || "", rootId: "", cellCoord: at || "",
  tracedBy: who, startedBy: who, contributors: [who], versions: 1,
  contours: 4, sections: 4, vertices: 900, volumeUm3: 0.2, color: "#3a6b5a",
  fileId: "f_" + sid, fileUrl: "https://drive.google.com/x",
  timestamp: "2026-10-1" + (sid.length % 9) + "T10:00:00Z" }, extra || {});

const SHARED = [
  row("a1", "Lysosome 1", A, "", "Søren Grubb"),
  row("a2", "Lysosome 2", A, "", "Søren Grubb"),
  row("a3", "Lysosome 3", A, "", "Søren Grubb"),
  row("a4", "Mitochondrion 1", A, "", "Hesham Mohamed"),
  row("b1", "Lysosome 1", B, "", "Hesham Mohamed"),
  row("b2", "Lysosome 2", B, "", "Hesham Mohamed"),
  row("b3", "Lysosome 3", B, "", "Hesham Mohamed"),
  row("c1", "Whole cell", "", "38762771", "Søren Grubb",
      { contributors: ["Søren Grubb", "Hesham Mohamed"], versions: 2 })
];

const ring = (z) => ({ z: z, points: [[10, 10], [20, 10], [20, 20], [10, 20]] });
const KEPT = [
  { name: "Lysosome 1", color: "#3a6b5a", type: "Endothelial cell", nucleus_id: "", root_id: "",
    cell_coord: A, rings: [ring(100), ring(105)], volume_um3: 0.21 },
  { name: "Lysosome 2", color: "#9740e2", type: "Endothelial cell", nucleus_id: "", root_id: "",
    cell_coord: A, rings: [ring(100)], volume_um3: 0.08 },
  { name: "Whole cell", color: "#40e28c", type: "Endothelial cell", nucleus_id: "38762771",
    root_id: "", cell_coord: "", rings: [ring(200), ring(205)], volume_um3: 44 }
];

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  const errors = [];
  p.on("pageerror", e => { if (!/atob|no network in this check/.test(e.message)) errors.push(e.message); });
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto("file://" + page_(PAGE));
  await p.waitForTimeout(3000);

  const got = await p.evaluate(async ({ SHARED, KEPT }) => {
    const out = {};
    /* Nothing in this check wants the network: a header pressed here must not also start a fetch
       whose failure lands in the middle of the next assertion. */
    window.open = function(){ return null; };
    window.fetch = function(){ return Promise.reject(new Error("no network in this check")); };
    const host = () => document.getElementById("tracingShared");
    const kept = () => document.getElementById("tracingList");
    /* WHAT a fold is, not where it sits: a cell fold is top level in the kept list and nested in
       the dataset list, and a selector that said "depth 1" would mean different things in the two
       lists while looking like it meant one. */
    const folds = (h, kind) => [].slice.call(h.querySelectorAll("details.tracingfold"))
      .filter(d => kind === undefined || d.dataset.foldkind === kind);
    const state = (h) => folds(h).map(d => d.dataset.fold + (d.open ? ":open" : ":shut"));

    if (typeof TRACING_SHARED === "undefined" || typeof tracingRenderShared !== "function")
      return { missing: true };

    /* ── the dataset list ─────────────────────────────────────────────────────────── */
    TRACING_SHARED = SHARED.slice();
    if (typeof TRACING_OPEN !== "undefined") for (const k in TRACING_OPEN) delete TRACING_OPEN[k];
    tracingRenderShared();
    await new Promise(r => setTimeout(r, 50));

    const people = folds(host(), "person");
    out.people = people.map(d => ({
      key: d.dataset.fold, open: d.open,
      head: String((d.querySelector("summary") || {}).textContent || "").replace(/\s+/g, " ").trim(),
      cells: folds(d, 1).length
    }));
    out.foldCount = folds(host()).length;
    out.shutAtFirst = state(host()).filter(s => /:open$/.test(s));
    out.listSays = String((host().querySelector("#tracingSharedNote") || {}).textContent || "")
      .replace(/\s+/g, " ");

    /* The cell folds under the person who has only a share of one, and what their buttons aim at */
    const mine = people.filter(d => /Søren/.test(d.dataset.fold))[0];
    if (mine){
      out.myCells = folds(mine, "cell").map(d => {
        const sum = d.querySelector("summary");
        const btn = d.querySelector("button[data-g]");
        const gi = btn ? Number(btn.dataset.g) : -1;
        const grp = (typeof TRACING_SHARED_GROUPS !== "undefined" && TRACING_SHARED_GROUPS[gi])
                    || null;
        return { key: d.dataset.fold,
                 head: String((sum || {}).textContent || "").replace(/\s+/g, " ").trim(),
                 rows: d.querySelectorAll("button.tracingopen").length,
                 buttons: d.querySelectorAll("summary button[data-g]").length,
                 wholeCell: grp ? grp.items.length : -1 };
      });
    }

    /* NOTHING TO PRESS IS A FAILURE BY NAME, NOT A THROW. A check that dies here reports one line
       of stack instead of the dozen assertions below, and the dozen are the point. */
    if (!folds(host(), "person").length) return out;

    /* ── pressing one, and then a re-render ──────────────────────────────────────── */
    const first = folds(host(), "person")[0];
    const fkey = first.dataset.fold;
    first.querySelector("summary").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    out.afterPress = folds(host(), "person").filter(d => d.dataset.fold === fkey).map(d => d.open)[0];
    tracingRenderShared();
    await new Promise(r => setTimeout(r, 50));
    out.afterRerender = folds(host(), "person").filter(d => d.dataset.fold === fkey).map(d => d.open)[0];

    /* ── a button in a header is still a button ──────────────────────────────────── */
    const openPerson = folds(host(), "person").filter(d => d.dataset.fold === fkey)[0];
    const cell = folds(openPerson, "cell")[0];
    if (cell){
      cell.open = true;
      /* and the store must learn it, or the next render shuts it again */
      cell.dispatchEvent(new Event("toggle"));
      await new Promise(r => setTimeout(r, 30));
      const ckey = cell.dataset.fold;
      const btn = cell.querySelector("summary button");
      out.pressedWhat = btn ? (btn.getAttribute("aria-label") || btn.className) : "no button";
      if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 120));
      const again = [].slice.call(host().querySelectorAll("details.tracingfold"))
        .filter(d => d.dataset.fold === ckey)[0];
      out.cellStillOpen = again ? again.open : null;
    }

    /* ── open all, close all ─────────────────────────────────────────────────────── */
    const all = host().querySelector(".tracingfoldopen");
    const none = host().querySelector(".tracingfoldshut");
    out.haveAllButtons = !!all && !!none;
    if (all){
      all.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise(r => setTimeout(r, 60));
      /* THE COUNT IS CARRIED BACK TOO. "no folds are shut" is true of a list with no folds in it,
         and three assertions here passed that way while nothing worked at all. */
      out.allN = folds(host()).length;
      out.allOpen = state(host()).filter(s => /:shut$/.test(s));
      tracingRenderShared();
      await new Promise(r => setTimeout(r, 50));
      out.allOpenAfterRerenderN = folds(host()).length;
      out.allOpenAfterRerender = state(host()).filter(s => /:shut$/.test(s));
    }
    if (none){
      host().querySelector(".tracingfoldshut")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise(r => setTimeout(r, 60));
      out.allShutN = folds(host()).length;
      out.allShut = state(host()).filter(s => /:open$/.test(s));
    }

    /* ── one person, nothing to choose between ───────────────────────────────────── */
    TRACING_SHARED = SHARED.filter(t => /Hesham/.test(t.tracedBy) && !t.cellCoord.indexOf);
    TRACING_SHARED = [SHARED[4], SHARED[5], SHARED[6]];      // Hesham, one cell
    for (const k in TRACING_OPEN) delete TRACING_OPEN[k];
    tracingRenderShared();
    await new Promise(r => setTimeout(r, 50));
    out.lone = folds(host()).map(d => ({ key: d.dataset.fold, kind: d.dataset.foldkind,
                                         open: d.open }));

    /* ── and the kept list ───────────────────────────────────────────────────────── */
    if (typeof TRACINGS_KEPT !== "undefined" && typeof tracingRenderList === "function"){
      TRACINGS_KEPT = KEPT.slice();
      for (const k in TRACING_OPEN) delete TRACING_OPEN[k];
      tracingRenderList();
      await new Promise(r => setTimeout(r, 50));
      out.kept = folds(kept()).map(d => ({
        key: d.dataset.fold, open: d.open,
        head: String((d.querySelector("summary") || {}).textContent || "")
                .replace(/\s+/g, " ").trim(),
        rows: d.querySelectorAll("button.tracingdrop").length,
        buttons: d.querySelectorAll("summary button").length }));
      const k0 = folds(kept())[0];
      if (k0){
        k0.querySelector("summary").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 60));
        const kk = k0.dataset.fold;
        tracingRenderList();
        await new Promise(r => setTimeout(r, 50));
        out.keptSurvives = folds(kept()).filter(d => d.dataset.fold === kk).map(d => d.open)[0];
      }
    }
    return out;
  }, { SHARED, KEPT });

  if (got.missing){ ok(false, "the page carries the tracing card", "it does not"); await b.close();
                    process.exit(1); }

  console.log("the dataset list is filed under people");
  const ppl = got.people || [];
  ok(ppl.length === 2, "one fold per person, and only the people who have traced something",
     ppl.length + ": " + ppl.map(x => x.key).join("  "));
  const hes = ppl.filter(x => /Hesham/.test(x.key))[0];
  const sor = ppl.filter(x => /Søren/.test(x.key))[0];
  ok(!!hes && /Hesham Mohamed/.test(hes.head),
     "...named in the header", hes ? hes.head : "no Hesham");
  /* Matched as the phrases they are. \b5\b does not match "...Mohamed5 tracings": the header is
     two flex spans, so textContent runs the name straight into the count with no space. */
  ok(!!hes && /5 tracings in 3 cells/.test(hes.head),
     "...with how many tracings in how many cells — 5 in 3 here, two numbers neither of which can "
     + "be read off the other", hes ? hes.head : "none");
  ok(!!sor && /4 tracings in 2 cells/.test(sor.head),
     "...and the other person's own two numbers, which differ from his", sor ? sor.head : "none");
  ok(!!hes && !!sor && ppl[0] === hes,
     "the busiest person comes first, because a list ordered by nothing is a list you search",
     ppl.map(x => x.key).join(" then "));
  ok(/appears under each|under both|each of them/i.test(got.listSays || ""),
     "and the list says once that a tracing several people worked on is filed under each of them "
     + "— otherwise the counts look wrong and nothing explains them",
     (got.listSays || "").slice(0, 150));

  console.log("\nand under a person, the cells they have worked in");
  const mc = got.myCells || [];
  ok(mc.length === 2, "one fold per cell, only the cells this person has touched",
     mc.length + ": " + mc.map(x => x.key).join("  "));
  const share = mc.filter(x => /3 of 4|3 of the 4/.test(x.head))[0];
  ok(!!share,
     "a cell he has only part of says so — “3 of 4” — because “3 tracings” under a header whose "
     + "buttons act on 4 would be a lie about the thing you are about to download",
     mc.map(x => x.head.slice(0, 90)).join(" || "));
  ok(!!share && /Hesham/.test(share.head),
     "...and names who else has worked on that cell, which is the whole reason to look at a cell "
     + "you share", share ? share.head.slice(0, 120) : "none");
  ok(!!share && share.rows === 3,
     "...while listing only his own three", share ? String(share.rows) : "none");
  ok(!!share && share.wholeCell === 4 && share.buttons >= 4,
     "...and its buttons still aim at the whole cell, all four tracings: there is one cell, so "
     + "“3D model of this cell” can only mean one thing",
     share ? ("buttons " + share.buttons + " aimed at " + share.wholeCell + " tracings") : "none");
  const both = mc.filter(x => /38762771|Whole cell/.test(x.head) || x.rows === 1)[0];
  ok(!!both, "and the cell whose one tracing has two contributors is here too, under this one of "
     + "them", both ? both.head.slice(0, 90) : "not found");

  console.log("\nand it begins closed");
  ok(got.foldCount > 0 && (got.shutAtFirst || []).length === 0,
     "nothing is open to start with — which is what he asked for: “it is getting too much”",
     (got.foldCount || 0) + " folds, open: "
     + ((got.shutAtFirst || []).join("  ") || "none"));
  const lone = got.lone || [];
  ok(lone.length >= 2 && lone.every(x => x.open),
     "...except where there is only one person and one cell: a fold with nothing beside it hides "
     + "and offers no choice", lone.map(x => x.kind + ":" + (x.open ? "open" : "shut")).join("  "));

  console.log("\nand what you opened stays open");
  ok(got.afterPress === true, "pressing a header opens it", String(got.afterPress));
  ok(got.afterRerender === true,
     "...and it is STILL open after the list is rebuilt. The state cannot live in the list's own "
     + "innerHTML: that is how the “Dataset coordinates” tick became un-untickable",
     String(got.afterRerender));
  ok(got.cellStillOpen === true,
     "and pressing a button inside a header does not fold the header — " + (got.pressedWhat || "?")
     + " was pressed, and the cell is still open", String(got.cellStillOpen));

  console.log("\nand there is a way to open all of it at once");
  ok(got.haveAllButtons === true, "open all and close all are both there",
     String(got.haveAllButtons));
  ok(got.allN > 0 && (got.allOpen || []).length === 0,
     "open all reaches every fold, at both levels",
     (got.allN || 0) + " folds, shut: " + ((got.allOpen || []).join("  ") || "none"));
  ok(got.allOpenAfterRerenderN > 0 && (got.allOpenAfterRerender || []).length === 0,
     "...and a rebuild does not undo it",
     (got.allOpenAfterRerenderN || 0) + " folds, shut: "
     + ((got.allOpenAfterRerender || []).join("  ") || "none"));
  ok(got.allShutN > 0 && (got.allShut || []).length === 0, "close all closes every one",
     (got.allShutN || 0) + " folds, open: " + ((got.allShut || []).join("  ") || "none"));

  console.log("\nand the kept list folds the same way");
  const kp = got.kept || [];
  ok(kp.length === 2, "one fold per cell", kp.length + ": " + kp.map(x => x.key).join("  "));
  ok(kp.length > 0 && kp.every(x => !x.open), "closed to begin with",
     kp.map(x => (x.open ? "open" : "shut")).join("  "));
  ok(kp.filter(x => /2 tracings/.test(x.head)).length === 1,
     "...the header carrying its count", kp.map(x => x.head.slice(0, 70)).join(" || "));
  ok(kp.length > 0 && kp.every(x => x.buttons >= 2),
     "...and its own buttons, which are worth having without unfolding",
     kp.map(x => String(x.buttons)).join(" "));
  ok(got.keptSurvives === true, "and this list remembers what you opened too",
     String(got.keptSurvives));

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
