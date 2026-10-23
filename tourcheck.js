/* The walkthrough points at controls that exist, and behaves when one does not.      2026-10-23

   Søren: *"We should make a tutorial for uJump that walks the user through the functions and
   features."*

   A tutorial is a set of claims about a tool, and claims rot. The particular way THIS one rots is
   narrow and worth naming: a step says `#randomOfType`, somebody renames that button, and the
   tutorial still runs — it just stops pointing at anything, which looks to a reader like the
   feature is gone. Nothing throws. So:

     EVERY SELECTOR IS CHECKED AGAINST THE MARKUP. The step list is a JSON block inside
     ujump.html, read here out of the same bytes the page reads, and every `at` and `needs` is
     looked for in that file. A step whose target is NOT in the static markup must declare
     `after` — the control only exists once the reader has done something — and the check then
     insists that the something is itself nameable.

     THE ENGINE IS DRIVEN ON A FIXTURE. ujump.html is 14.5 MB and takes the renderer down in this
     sandbox part way through loading (reproducibly; a 17-October copy loads in about a second in
     the same harness), so the browser half runs on tourfixture.html, which is four controls with
     µJump's names. What that proves is the ENGINE: the spotlight lands on the target, the bubble
     does not cover it, waiting works, a missing target is survived AND reported, the keyboard
     moves, and the place in the queue is remembered. What it cannot prove is that µJump itself
     drives it — run this on a desktop for that, where the three browser steps against the real
     page run too.

     A MISSING TARGET IS SURVIVED AND SAID OUT LOUD. Both halves are asserted: the tour does not
     break, and UJ.tour.missing() names what it could not find. A walkthrough that silently
     skipped a step would be the failure this file exists to prevent.

   Run: node tourcheck.js */
const fs = require("fs");
const path = require("path");
const page_ = require("./pagepath.js");
/* PLAYWRIGHT IS LOADED LATE, AND ITS ABSENCE IS NOT A FAILURE. The half of this file that matters
   most -- every selector in µJump's step list, checked against µJump's markup -- needs no browser
   at all, and on Søren's machine there is no browser to be had: the Linux VM has node but no
   Chromium, and the egress allowlist refuses the download. A top-level require() would have made
   the whole check unrunnable there over a dependency only its second half needs. So the static
   half always runs, and the fixture half says NOT RUN when it cannot. */
let chromium = null;
try { chromium = require("./node_modules/playwright").chromium; } catch (_e) {}
const R = [];
const ok = (n, c, d) => { R.push(!!c);
  console.log((c ? "PASS " : "*** FAIL *** ") + n + (d !== undefined ? "  <- " + d : "")); };

const uj = fs.readFileSync(page_("ujump.html"), "utf8");
const tour = fs.readFileSync(path.join(path.dirname(page_("ujump.html")), "core", "tour.js"), "utf8");

/* ── the step list, read out of the page ───────────────────────────────────────────────────── */
function tourdataOf(html, what) {
  const m = html.match(
    /<script type="application\/json" id="tourdata">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) {
    console.log("  (" + what + ": #tourdata is not valid JSON — " + e.message + ")");
    return null;
  }
}
const CFG = tourdataOf(uj, "ujump.html");

console.log("--- µJump declares a walkthrough ---");
ok("ujump.html loads core/tour.js", /<script src="core\/tour\.js"><\/script>/.test(uj));
ok("...and carries a #tourdata block that parses", !!CFG,
   CFG ? "ok" : "missing or invalid");
ok("...with the storage key under the grubblab_ prefix",
   !!CFG && /^grubblab_/.test(CFG.key || ""), CFG && CFG.key);
/* NOT A COUNT OF THREE. Søren asked for three parts and part one is written; asserting 3 here
   would only force two empty parts into existence to satisfy it, and a button that opens an empty
   walkthrough is worse than no button. What IS asserted is the invariant that holds at every
   stage: no part is declared without steps. The parts still to come are printed, so nobody can
   mistake one part for the finished job. */
ok("no part is declared without steps",
   !!CFG && Array.isArray(CFG.parts) && CFG.parts.length > 0
   && CFG.parts.every(p => (p.steps || []).length > 0),
   CFG && CFG.parts ? CFG.parts.map(p => p.id + " (" + (p.steps || []).length + " steps)").join(", ")
                    : "none");
const WANTED = ["part1", "part2", "part3"];
const written = (CFG && CFG.parts ? CFG.parts : []).map(p => p.id);
const todo = WANTED.filter(id => written.indexOf(id) < 0);
/* Describing what is MISSING, derived from what is present. The first version spelled the gap out
   in prose written when part two was unwritten, and went on claiming part two was missing after it
   had been written — a check that lies in its own output. */
const SCOPE = { part1: "finding a cell and saying what it is",
                part2: "Filter and show",
                part3: "the EM plane, 3D, the viewer, VR and the tracing pad" };
if (todo.length) console.log("NOT YET  " + todo.join(" and ") + "  <- "
  + todo.map(id => SCOPE[id] || id).join("; ")
  + (todo.length === 1 ? " is" : " are") + " not written. This check covers what exists.");
ok("...each with a title and at least one step",
   !!CFG && (CFG.parts || []).every(p => p.id && p.title && (p.steps || []).length));

console.log("\n--- every step says something, and says it about something ---");
const steps = CFG ? [].concat.apply([], CFG.parts.map(p =>
  (p.steps || []).map((s, i) => Object.assign({ _part: p.id, _i: i + 1 }, s)))) : [];
ok("there are steps to check", steps.length >= 12, steps.length + " across the parts");
const mute = steps.filter(s => !s.say || s.say.length < 15);
ok("every step has text", mute.length === 0,
   mute.map(s => s._part + "#" + s._i).join(", ") || "all have it");
/* The first step of each part introduces the part and may point at nothing; every other step
   must point at something, or it is a slide, not a walkthrough. */
const aimless = steps.filter(s => !s.at && s._i > 1);
ok("...and every step after the first points at a control", aimless.length === 0,
   aimless.map(s => s._part + "#" + s._i).join(", ") || "all do");

console.log("\n--- the selectors are real ---");
/* An id in the markup, or an id a script writes into innerHTML: both are "in the file", which is
   what can be checked without a browser. A selector that is in the file in NEITHER form is
   either a typo or a control that has been renamed, and both are the bug this file is for. */
function inFile(sel, html) {
  const ids = sel.match(/#[A-Za-z][\w-]*/g) || [];
  const classes = sel.match(/\.[A-Za-z][\w-]*/g) || [];
  const attrs = sel.match(/\[[^\]]+\]/g) || [];
  const idOk = ids.every(i => html.indexOf('id="' + i.slice(1) + '"') >= 0
                           || html.indexOf("id='" + i.slice(1) + "'") >= 0
                           || html.indexOf('id="' + i.slice(1)) >= 0);
  const clOk = classes.every(c => html.indexOf('class="' + c.slice(1)) >= 0
                               || html.indexOf(c.slice(1) + '"') >= 0
                               || html.indexOf("'" + c.slice(1)) >= 0);
  const atOk = attrs.every(a => html.indexOf(a) >= 0);
  return idOk && clOk && atOk;
}
const badAt = steps.filter(s => s.at && !inFile(s.at, uj));
ok("every `at` selector appears in ujump.html", badAt.length === 0,
   badAt.map(s => s._part + "#" + s._i + " " + s.at).join(" | ") || steps.filter(s => s.at).length + " checked");
/* `needs` is a selector OR {at, text} since 2026-10-23 — part two waits for the match count, which
   core/matchcount.js writes ONTO the Preview button rather than into a new element. The check
   crashed on the object form, which is the right way for it to fail. */
const needsAt = n => (n && typeof n === "object") ? n.at : n;
const badNeeds = steps.filter(s => s.needs && !inFile(needsAt(s.needs), uj));
ok("...and so does every `needs` selector", badNeeds.length === 0,
   badNeeds.map(s => s._part + "#" + s._i + " " + needsAt(s.needs)).join(" | ") || "all found");
/* A text wait naming words the page never produces is a step nobody can ever pass. */
const textWaits = steps.filter(s => s.needs && typeof s.needs === "object" && s.needs.text);
const unsaid = textWaits.filter(s =>
  uj.toLowerCase().indexOf(String(s.needs.text).toLowerCase()) < 0);
ok("...and a step waiting on TEXT waits for words the page actually produces", unsaid.length === 0,
   unsaid.map(s => s._part + "#" + s._i + " “" + s.needs.text + "”").join(" | ")
   || (textWaits.map(s => "“" + s.needs.text + "”").join(", ") || "none wait on text"));
/* The pairing that keeps the waiting honest. */
const unexplained = steps.filter(s => s.needs && !s.after);
ok("a step that waits for something says how to bring it about", unexplained.length === 0,
   unexplained.map(s => s._part + "#" + s._i).join(", ") || "all explained");
/* A waiting step must name the control to press, and it must be a real one: with no `press` the
   engine takes the dimming off entirely, which works but leaves the reader hunting for it. */
const unpointed = steps.filter(s => s.needs && !s.press);
ok("a waiting step names the control to press, so it can be spotlighted", unpointed.length === 0,
   unpointed.map(s => s._part + "#" + s._i).join(", ") || "all named");
const badPress = steps.filter(s => s.press && !inFile(s.press, uj));
ok("...and it is a control the page has", badPress.length === 0,
   badPress.map(s => s._part + "#" + s._i + " " + s.press).join(" | ")
   || steps.filter(s => s.press).length + " checked");
const idle = steps.filter(s => s.after && !s.needs);
ok("...and nothing claims to wait without waiting", idle.length === 0,
   idle.map(s => s._part + "#" + s._i).join(", ") || "none");
ok("a tab named by a step is one the page has",
   steps.filter(s => s.tab).every(s => uj.indexOf('data-tab="' + s.tab + '"') >= 0),
   steps.filter(s => s.tab).map(s => s.tab).join(", ") || "none named");

/* ── WHERE THE OVERLAY SITS ON A PAGE THAT ALREADY HAS OVERLAYS ──────────────────  2026-10-23
   Found statically, with no browser, which is the point: the first draft put the dim at 9998 and
   the ring at 9999 -- level with core/vrbasket.js's "+ VR" pill and its tray -- so which one was
   on top came down to DOM order. Worse, the invitation card was pinned to right:14px bottom:14px,
   which is exactly where that pill lives, so it landed on top of it.

   core/report.js's toasts stay above the tour on purpose: a message about what just happened
   should not be hidden by a tutorial. So the rule is "above every other overlay except the
   toast", and it is asserted against what core/ actually declares rather than a number typed in
   here that would drift the moment somebody adds a panel. */
console.log("\n--- it sits above the other overlays, and not on top of the VR pill ---");
const coreDir = path.join(path.dirname(page_("ujump.html")), "core");
const others = fs.readdirSync(coreDir).filter(f => /\.js$/.test(f) && f !== "tour.js");
let highest = { z: 0, file: "none" };
others.forEach(f => {
  const src = fs.readFileSync(path.join(coreDir, f), "utf8");
  (src.match(/z-index: *([0-9]+)/g) || []).forEach(m => {
    const z = Number(m.replace(/\D/g, ""));
    /* The toast is meant to be above everything, tour included. */
    if (z >= 99999) return;
    if (z > highest.z) highest = { z: z, file: f };
  });
});
const tourZ = (tour.match(/z-index: *([0-9]+)/g) || []).map(m => Number(m.replace(/\D/g, "")));
ok("every layer of the tour is above every other overlay in core/",
   tourZ.length >= 4 && Math.min.apply(null, tourZ) > highest.z,
   "tour " + Math.min.apply(null, tourZ) + "\u2013" + Math.max.apply(null, tourZ)
   + " against " + highest.file + " at " + highest.z);
ok("...and below core/report.js's toasts, which should not be hidden by a tutorial",
   Math.max.apply(null, tourZ) < 99999);
/* The pill's own corner, read out of vrbasket.js rather than written down here. */
const vrb = fs.readFileSync(path.join(coreDir, "vrbasket.js"), "utf8");
const pill = (vrb.match(/vrb-pill\{[^"]*/) || [""])[0];
const pillRight = /right: *\d+px/.test(pill) && /bottom: *\d+px/.test(pill);
const offer = (tour.match(/\.tour-offer\{[^"]*/) || [""])[0];
ok("the invitation does not share a corner with the \u201c+ VR\u201d pill",
   !pillRight || !/right: *\d+px/.test(offer),
   pillRight ? "pill bottom-right, invitation " + (/left/.test(offer) ? "bottom-left" : "ALSO RIGHT")
             : "pill is not in a corner");
ok("...and clears it on a phone, where the invitation spans the width",
   /@media\(max-width:560px\)\{\.tour-offer\{[^}]*bottom: *(7[0-9]|[89][0-9])px/.test(tour),
   (tour.match(/@media\(max-width:560px\)\{\.tour-offer\{[^}]*\}/) || ["not set"])[0].slice(0, 90));

console.log("\n--- the control that starts it ---");
const starters = (uj.match(/data-tour-start="[a-z0-9]+"/g) || []);
ok("there is a button for each part, and a part for each button",
   !!CFG && (CFG.parts || []).length > 0
   && (CFG.parts || []).every(p => uj.indexOf('data-tour-start="' + p.id + '"') >= 0)
   && starters.length === (CFG.parts || []).length,
   starters.join(", ") || "no start buttons");
/* The page asks; it does not begin. The engine wires every [data-tour-start] button itself,
   so the page has no reason to call start() at all, and a call there would be a tutorial
   happening TO somebody. */
/* The invariant is "the page never starts it", and that has not changed. What changed is HOW the
   offer is made: the page used to call offerOnce() itself and now goes through ready(), which
   does the offering after the document is complete. Rewritten to the new truth rather than
   deleted -- the thing worth forbidding is still forbidden. */
ok("...and the page offers it once, rather than starting it unasked",
   (/UJ\.tour\.ready\(\)/.test(uj) || /UJ\.tour\.offerOnce\(\)/.test(uj))
   && uj.indexOf("UJ.tour.start(") < 0
   && /offerOnce\(\)/.test(tour),
   uj.indexOf("UJ.tour.start(") < 0 ? "offered through ready(), never auto-started"
                                    : "the page calls start()");
/* THE ORDERING BUG, 2026-10-23. µJump's init script sits ~25,000 characters above its #tourdata
   block, so when it ran, the data was not in the document: load() returned null, the `&&` chain
   short-circuited, and the walkthrough was dead on the deployed page. Neither half of this file
   could see it -- the static half does not execute anything, and the fixture declares its JSON
   above its script, which is the lucky order.

   Two assertions now. The page must use ready(), the entry point that waits; and the engine must
   actually wait, rather than ready() being a renamed load(). */
const initAt = uj.indexOf("UJ.tour.ready()");
const dataAt = uj.indexOf('id="tourdata"');
ok("the page wires the walkthrough through ready(), which waits for the document",
   initAt > 0 && uj.indexOf("UJ.tour.load()") < 0,
   initAt > 0 ? (initAt < dataAt
     ? "init at " + initAt + " is above #tourdata at " + dataAt + " \u2014 which is exactly why"
     : "init below the data block") : "the page still calls load() directly");
ok("...and ready() really defers when the block is not there yet",
   /document\.readyState === "loading"/.test(tour)
   && /addEventListener\("DOMContentLoaded"/.test(tour)
   && /getElementById\("tourdata"\)/.test(tour));

ok("the engine never presses anything itself",
   !/\.click\(\)/.test(tour),
   /\.click\(\)/.test(tour) ? "tour.js calls .click()" : "no .click() in tour.js");
ok("...and the engine keeps its own storage under the prefix",
   /grubblab_/.test(tour) && (tour.match(/localStorage\.(get|set)Item\(/g) || []).length <= 4);

function finish() {
  const bad = R.filter(x => !x).length;
  console.log("\n" + (bad ? "*** " + bad + " of " + R.length + " FAILED ***"
                           : "RESULT: ALL " + R.length + " CHECKS PASSED"));
  process.exit(bad ? 1 : 0);
}

(async () => {
  const exe = ["/opt/pw-browsers/chromium",
               (process.env.HOME || "") + "/.cache/ms-playwright"].find(p => fs.existsSync(p));
  if (!chromium || !exe) {
    console.log("\nNOT RUN  the engine on tourfixture.html  <- "
      + (chromium ? "no browser on this machine" : "playwright is not installed here")
      + ". The step list above was checked against the markup, which is the half that rots; the "
      + "engine's own behaviour (spotlight, waiting, keyboard, phone layout) needs a browser. "
      + "Run this where one is available to cover it.");
    finish();
    return;
  }
  const browser = await chromium.launch(
    fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium",
      args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] }
    : { args: ["--no-sandbox"] });
  const errs = [];
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + page_("tourfixture.html"), { waitUntil: "load" });
  await p.waitForTimeout(250);

  console.log("\n--- the engine, driven on the fixture ---");
  const shown = await p.evaluate(() => !!UJ.tour.cfg());
  ok("the fixture's #tourdata is read", shown);

  await p.click("#startBtn");
  await p.waitForTimeout(250);
  const s1 = await p.evaluate(() => {
    const b = document.querySelector(".tour-bubble");
    return { on: !b.hidden, count: b.querySelector(".tour-count").textContent,
             where: UJ.tour.where(), ringOn: !document.querySelector(".tour-ring").hidden };
  });
  ok("it opens on step 1", s1.on && s1.count === "1 of 7" && s1.where.step === 0, s1.count);
  ok("...with no spotlight, because step 1 points at nothing", !s1.ringOn);

  await p.click(".tour-next");
  await p.waitForTimeout(300);
  const s2 = await p.evaluate(() => {
    const ring = document.querySelector(".tour-ring").getBoundingClientRect();
    const tgt = document.querySelector("#randomTypeSelect").getBoundingClientRect();
    const bub = document.querySelector(".tour-bubble").getBoundingClientRect();
    const overlap = !(bub.right < tgt.left || bub.left > tgt.right
                   || bub.bottom < tgt.top || bub.top > tgt.bottom);
    return { dx: Math.abs(ring.left - (tgt.left - 6)), dy: Math.abs(ring.top - (tgt.top - 6)),
             overlap, count: document.querySelector(".tour-count").textContent };
  });
  ok("the spotlight lands on the target", s2.dx < 2 && s2.dy < 2,
     "off by " + s2.dx.toFixed(1) + ", " + s2.dy.toFixed(1) + " px");
  ok("...and the bubble does not cover it", !s2.overlap, s2.count);

  /* The waiting step: the card does not exist, so the tour should say what to press and then
     move by itself once it does. */
  await p.click(".tour-next"); await p.waitForTimeout(150);
  await p.click(".tour-next"); await p.waitForTimeout(250);
  const waiting = await p.evaluate(() => {
    const w = document.querySelector(".tour-wait");
    return { shown: !w.hidden, text: w.textContent, step: UJ.tour.where().step };
  });
  ok("a step whose target does not exist yet waits", waiting.shown && waiting.step === 3,
     JSON.stringify(waiting.text));
  ok("...and names the control to press", /Random example/.test(waiting.text));
  /* A REAL CLICK, NOT element.click(). This is the assertion that matters and the first version
     got it wrong: evaluate(() => el.click()) dispatches the event straight at the element and
     sails through any overlay on top of it, so it passed while the engine was dimming the page
     and swallowing clicks on the dim -- telling somebody to press a button and then covering it.
     p.click() goes through the hit test a finger would, and fails if anything is in the way. */
  ok("...and the control it tells you to press is not covered by the overlay",
     await p.evaluate(() => {
       const b = document.getElementById("randomOfType").getBoundingClientRect();
       const el = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
       return !!el && (el.id === "randomOfType" || el.closest("#randomOfType") !== null);
     }), "hit test lands on the button itself");
  await p.click("#randomOfType");
  await p.waitForTimeout(400);
  const arrived = await p.evaluate(() => ({
    waiting: !document.querySelector(".tour-wait").hidden,
    ring: !document.querySelector(".tour-ring").hidden,
    step: UJ.tour.where().step }));
  ok("...and stops waiting the moment it appears, without a click on Next",
     !arrived.waiting && arrived.ring && arrived.step === 3);

  /* ── INTO A CLOSED DRAWER ─────────────────────────────────────────────────────  2026-10-23
     Every one of µJump's twelve filter sections is a <details> that ships COLLAPSED, and part two
     points at a tick inside one. Before the engine learned to open them the step found a zero-size
     element and said "could not find this control" — true, and useless. */
  await p.click(".tour-next");
  await p.waitForTimeout(500);
  const drawer = await p.evaluate(() => {
    const d = document.getElementById("filterSecSelect");
    const t = document.getElementById("filterIncludeUnclassified").getBoundingClientRect();
    const r = document.querySelector(".tour-ring").getBoundingClientRect();
    return { opened: d.open, ringOff: +Math.hypot(r.left - (t.left - 6), r.top - (t.top - 6)).toFixed(1),
             missing: UJ.tour.missing() };
  });
  ok("a step pointing inside a collapsed <details> opens it", drawer.opened);
  ok("...and the spotlight lands on the control within", drawer.ringOff < 2,
     "off by " + drawer.ringOff + " px");
  ok("...so nothing is reported as missing", drawer.missing.indexOf("#filterIncludeUnclassified") < 0,
     JSON.stringify(drawer.missing));

  /* The bottom of a long page: the target must be scrolled into view, not merely pointed at. */
  await p.click(".tour-next");
  await p.waitForTimeout(500);
  const low = await p.evaluate(() => {
    const t = document.querySelector("#bottomThing").getBoundingClientRect();
    const b = document.querySelector(".tour-bubble").getBoundingClientRect();
    return { visible: t.top >= 0 && t.bottom <= window.innerHeight,
             overlap: !(b.right < t.left || b.left > t.right || b.bottom < t.top || b.top > t.bottom) };
  });
  ok("a target near the foot of the page is scrolled into view", low.visible);
  ok("...and the bubble still clears it", !low.overlap);

  /* The one that is not there. */
  await p.click(".tour-next");
  await p.waitForTimeout(400);
  const gone = await p.evaluate(() => ({
    gone: document.querySelector(".tour-gone").hidden === false,
    text: document.querySelector(".tour-gone").textContent,
    missing: UJ.tour.missing(),
    stillOpen: !document.querySelector(".tour-bubble").hidden }));
  ok("a target that is not on the page does not break the tour", gone.stillOpen);
  ok("...it says so on the step", gone.gone && /noSuchControl/.test(gone.text));
  ok("...and reports it for this check to read", gone.missing.indexOf("#noSuchControl") >= 0,
     JSON.stringify(gone.missing));

  console.log("\n--- keyboard, memory and leaving ---");
  /* RELATIVE, not a hardcoded index. These assertions said `=== 4`, and adding one step to the
     fixture broke three of them at once while nothing was actually wrong — a check that has to be
     renumbered whenever the thing it checks grows is a check that will eventually be renumbered
     carelessly. */
  const beforeBack = await p.evaluate(() => UJ.tour.where().step);
  await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(200);
  const afterBack = await p.evaluate(() => UJ.tour.where().step);
  ok("the left arrow steps back", afterBack === beforeBack - 1,
     beforeBack + " \u2192 " + afterBack);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  const closed = await p.evaluate(() => ({
    where: UJ.tour.where(), bubble: document.querySelector(".tour-bubble").hidden,
    dim: Array.from(document.querySelectorAll(".tour-dim")).every(d => d.hidden) }));
  ok("Escape closes it and clears the dimming",
     closed.where === null && closed.bubble && closed.dim);
  const kept = await p.evaluate(() => UJ.tour.state());
  ok("...and it remembers how far you got", !!kept.part1 && kept.part1.at === afterBack,
     JSON.stringify(kept) + " against step " + afterBack);
  await p.click("#startBtn");
  await p.waitForTimeout(300);
  ok("...so pressing the button again resumes there",
     (await p.evaluate(() => UJ.tour.where().step)) === afterBack);

  /* ── READABILITY IN BOTH PALETTES ───────────────────────────────────────────────  2026-10-23
     Søren, on his phone: *"I can't read anything."* A white panel with near-white text, because
     the bubble took its background from a #fff fallback and its text from µJump's own --ink.
     Measured, not eyeballed: the contrast ratio between the rendered text colour and the rendered
     background, in index.html's palette AND in µJump's, both of which the fixture now carries.
     4.5:1 is the WCAG AA threshold for body text. */
  console.log("\n--- readable in both of the family's palettes ---");
  const contrast = async palette => p.evaluate(pal => {
    if (pal) document.documentElement.setAttribute("data-palette", pal);
    else document.documentElement.removeAttribute("data-palette");
    const b = document.querySelector(".tour-bubble");
    const say = b.querySelector(".tour-say");
    const go = b.querySelector(".tour-next");
    const lum = c => {
      const m = c.match(/[\d.]+/g).map(Number);
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
    };
    const ratio = (a, bg) => { const l1 = lum(a), l2 = lum(bg);
      return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2); };
    const bg = getComputedStyle(b).backgroundColor;
    return { bg: bg, ink: getComputedStyle(say).color,
             body: ratio(getComputedStyle(say).color, bg),
             button: ratio(getComputedStyle(go).color, getComputedStyle(go).backgroundColor) };
  }, palette);
  await p.evaluate(() => { UJ.tour.stop(); UJ.tour.start("part1"); });
  await p.waitForTimeout(250);
  const light = await contrast(null);
  ok("the bubble's text is readable on its own background (index.html's palette)",
     light.body >= 4.5, light.body + ":1  " + light.ink + " on " + light.bg);
  ok("...and so is the label on the filled button", light.button >= 4.5, light.button + ":1");
  const dark = await contrast("ujump");
  ok("...and in \u00b5Jump's palette, which has no --card at all",
     dark.body >= 4.5, dark.body + ":1  " + dark.ink + " on " + dark.bg);
  ok("...and its filled button too", dark.button >= 4.5, dark.button + ":1");
  await p.evaluate(() => document.documentElement.removeAttribute("data-palette"));

  console.log("\n--- on a phone ---");
  await p.keyboard.press("Escape");
  await p.setViewportSize({ width: 390, height: 780 });
  await p.evaluate(() => { UJ.tour.stop(); UJ.tour.start("part1"); });
  await p.evaluate(() => { document.querySelector(".tour-next").click(); });
  await p.waitForTimeout(500);
  const phone = await p.evaluate(() => {
    const t = document.querySelector("#randomTypeSelect").getBoundingClientRect();
    const b = document.querySelector(".tour-bubble").getBoundingClientRect();
    return { overlap: !(b.right < t.left || b.left > t.right
                     || b.bottom < t.top || b.top > t.bottom),
             inside: b.left >= 0 && b.right <= window.innerWidth && b.bottom <= window.innerHeight,
             wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  ok("the bubble fits the screen", phone.inside);
  ok("...does not cover the control", !phone.overlap);
  ok("...and nothing scrolls sideways", !phone.wide);

  await p.close();
  await browser.close();
  ok("no script errors on the fixture", errs.length === 0, errs.join(" | ") || "none");

  finish();
})();
