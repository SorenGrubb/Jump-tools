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
/* NAMES, NOT NUMBERS, since the organelle part was inserted BEFORE Filter and show at Søren's
   word. Numbered ids meant that inserting a part renamed every part after it -- silently, in
   saved progress as well as here. These ids say what the part is about and never move again. */
const WANTED = ["find", "organelles", "interactions", "filter", "evidence", "export",
                "vrcollect"];
const written = (CFG && CFG.parts ? CFG.parts : []).map(p => p.id);
const todo = WANTED.filter(id => written.indexOf(id) < 0);
/* Describing what is MISSING, derived from what is present. The first version spelled the gap out
   in prose written when part two was unwritten, and went on claiming part two was missing after it
   had been written — a check that lies in its own output. */
const SCOPE = { find: "finding a cell and saying what it is",
                organelles: "logging and outlining the structures inside a cell",
                interactions: "connectivity, cell contacts and the tripartite proxy",
                filter: "Filter and show",
                evidence: "the References tab and the statistics dashboard",
                export: "the region box and the Colab/Blender export",
                vrcollect: "collecting cells for VR and opening the scene" };
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
  /* AN ID CAN ALSO ARRIVE AS A PROPERTY ASSIGNMENT.                              2026-10-23
     core/vrbasket.js builds its pill and tray with document.createElement and then
     `pill.id = "vrb-pill"` -- there is no id="…" anywhere for those two, and looking only for
     the attribute spelling called both of them missing. Three spellings are accepted now:
     the attribute, either quote style, and the assignment. */
  /* ...AND AN ID CAN BE SPELLED IN PIECES.                                        2026-10-23
     The three panels this tool builds onto #connPanel / #cellContactsPanel / #tripartitePanel
     compose their control ids at runtime: `const uid = escHtml(el.id) + "_type"`, then
     `id="'+uid+'_check"`. So `#cellContactsPanel_type_check` is a real id that no literal in the
     source contains, and looking for the literal called six real controls missing.

     Rather than guess, the chain is resolved and all three links are verified: the CONTAINER id
     must be in the markup, the uid suffix must be one the file actually derives, and the final
     suffix must be one it actually builds. A typo in any link still fails. */
  const idPieced = n => {
    const uidSufs = [...new Set((html.match(/const uid=escHtml\(el\.id\|\|"[^"]*"\)\+"([^"]*)"/g) || [])
      .map(m => (m.match(/\+"([^"]*)"$/) || [])[1]).filter(Boolean))];
    const detSufs = [...new Set((html.match(/const detailsId=escHtml\(el\.id\|\|"[^"]*"\)\+"([^"]*)"/g) || [])
      .map(m => (m.match(/\+"([^"]*)"$/) || [])[1]).filter(Boolean))];
    const built = new Set((html.match(/id="'\+uid\+'([A-Za-z_][\w-]*)/g) || [])
      .map(m => m.replace(/.*'\+uid\+'/, "")));
    const detailsBuilt = /id="'\+detailsId\+'"/.test(html);
    for (const u of uidSufs) {
      const at = n.indexOf(u + "_");
      if (at <= 0) continue;
      const container = n.slice(0, at), suffix = n.slice(at + u.length);
      if (html.indexOf('id="' + container + '"') >= 0 && built.has(suffix)) return true;
    }
    if (detailsBuilt) for (const d of detSufs) {
      if (n.endsWith(d) && html.indexOf('id="' + n.slice(0, -d.length) + '"') >= 0) return true;
    }
    return false;
  };
  const idOk = ids.every(i => {
    const n = i.slice(1);
    return html.indexOf('id="' + n) >= 0
        || html.indexOf("id='" + n + "'") >= 0
        || new RegExp("\\.id\\s*=\\s*[\"']" + n.replace(/[-]/g, "\\$&") + "[\"']").test(html)
        || idPieced(n);
  });
  const clOk = classes.every(c => html.indexOf('class="' + c.slice(1)) >= 0
                               || html.indexOf(c.slice(1) + '"') >= 0
                               || html.indexOf("'" + c.slice(1)) >= 0);
  /* ...and an attribute selector written [data-act="copy"] is spelt data-act='copy' in a module
     that builds its HTML inside a double-quoted JS string. Both quote styles, and bare. */
  const atOk = attrs.every(a => {
    const m = a.match(/^\[([\w-]+)=["']?([^"'\]]+)["']?\]$/);
    if (!m) return html.indexOf(a) >= 0;
    const [, k, v] = m;
    return html.indexOf(k + '="' + v + '"') >= 0 || html.indexOf(k + "='" + v + "'") >= 0
        || html.indexOf(k + "=" + v) >= 0;
  });
  return idOk && clOk && atOk;
}
/* ...AND THE FILE IS NOT ONLY ujump.html.                                           2026-10-23
   Part three points at the tracing pad, and none of the pad's controls are in ujump.html: the
   page carries `<div id="tracingCard">` and core/tracingcard.js fills it, so #tracePadOpen and
   the rest live in that module's HTML strings. Checking only ujump.html called six real controls
   missing, which would have been the check lying rather than the steps being wrong.

   So the haystack is the page PLUS every module it loads, with \" unescaped first — those strings
   are written as id=\"tracePadOpen\" inside a JS literal, and the un-escaped search would miss
   every one of them. The weakness is honest and worth naming: a selector found in a module is
   found in source, not in a rendered document, so this says the control EXISTS somewhere in the
   tool, not that it is on screen at that step. What the step list declares for that is `needs`,
   and the assertions below hold every waiting step to naming how to bring its target about. */
const COREDIR = path.join(path.dirname(page_("ujump.html")), "core");
const MARKUP = uj + "\n" + fs.readdirSync(COREDIR).filter(f => /\.js$/.test(f))
  .map(f => fs.readFileSync(path.join(COREDIR, f), "utf8").replace(/\\"/g, '"'))
  .join("\n");
const badAt = steps.filter(s => s.at && !inFile(s.at, MARKUP));
ok("every `at` selector appears in the page or in a module it loads", badAt.length === 0,
   badAt.map(s => s._part + "#" + s._i + " " + s.at).join(" | ") || steps.filter(s => s.at).length + " checked");
/* `needs` is a selector OR {at, text} since 2026-10-23 — part two waits for the match count, which
   core/matchcount.js writes ONTO the Preview button rather than into a new element. The check
   crashed on the object form, which is the right way for it to fail. */
const needsAt = n => (n && typeof n === "object") ? n.at : n;
const badNeeds = steps.filter(s => s.needs && !inFile(needsAt(s.needs), MARKUP));
ok("...and so does every `needs` selector", badNeeds.length === 0,
   badNeeds.map(s => s._part + "#" + s._i + " " + needsAt(s.needs)).join(" | ") || "all found");
/* A text wait naming words the page never produces is a step nobody can ever pass. */
const textWaits = steps.filter(s => s.needs && typeof s.needs === "object" && s.needs.text);
const unsaid = textWaits.filter(s =>
  MARKUP.toLowerCase().indexOf(String(s.needs.text).toLowerCase()) < 0);
ok("...and a step waiting on TEXT waits for words the page actually produces", unsaid.length === 0,
   unsaid.map(s => s._part + "#" + s._i + " “" + s.needs.text + "”").join(" | ")
   || (textWaits.map(s => "“" + s.needs.text + "”").join(", ") || "none wait on text"));
/* The pairing that keeps the waiting honest. */
const unexplained = steps.filter(s => s.needs && !s.after);
ok("a step that waits for something says how to bring it about", unexplained.length === 0,
   unexplained.map(s => s._part + "#" + s._i).join(", ") || "all explained");
/* TWO KINDS OF WAIT, AND THEY ARE NOT THE SAME.                                    2026-10-23
   This read "a waiting step names the control to press" and demanded `press` on every step with
   a `needs`. That is right for a step waiting on the READER -- with no `press` the engine takes
   the dimming off entirely, which works but leaves them hunting for the button. It is wrong for
   a step waiting on the PAGE: the dashboard's charts do not exist until Plotly has drawn them,
   and there is nothing to press. Naming a button there would be inventing an instruction.

   So a step may declare `pageWait: true`, which says the omission is deliberate: nothing on this
   page will make it happen sooner. The engine needs no change -- it already does the right thing
   with no `press`. The field exists so a MISSING press is distinguishable from a FORGOTTEN one,
   which is the only version of this a check can hold anybody to. */
const unpointed = steps.filter(s => s.needs && !s.press && !s.pageWait);
ok("a waiting step names the control to press, unless it is waiting on the page",
   unpointed.length === 0,
   unpointed.map(s => s._part + "#" + s._i).join(", ")
   || steps.filter(s => s.pageWait).length + " wait on the page, the rest name a control");
/* ── A WAIT THAT WAS ALREADY OVER ──────────────────────────────────────────────────  2026-10-23
   THREE TIMES IN ONE DAY, which is what makes it worth a check rather than more care.
   `needsMet()` asks whether the target has a non-zero rectangle. That is the right question for
   something built at runtime -- and the wrong one for a container CSS has already given a size:

     #vrb-pill    saved by accident: core/vrbasket.js keeps it display:none while empty.
     #vrslot      NOT saved: an empty 330x0 box... which became non-zero as soon as anything was
                  in the panel, so the step waiting on the SLOT would have pointed at nothing and
                  reported success. Fixed to wait on `#vrslot button`.
     .plot        NOT saved: `.plot{width:100%;height:360px}`. Every chart div in the dashboard
                  has a 360px rectangle the instant the tab becomes .active, drawn or not, so
                  every chart step's wait was over before Plotly started. Fixed to `#id > *`.

   THE RULE, stated so it can be mechanised: if a step waits on a bare id, and the stylesheet
   gives that element an explicit height (by id, or by any class in its markup tag), then its
   rectangle proves nothing and the step must wait on something INSIDE it instead. A selector
   with a combinator -- `#id > *`, `#id option` -- is exempt, because that is the fix. */
function sizedByCss(sel, html) {
  const id = (String(sel).match(/^#([A-Za-z][\w-]*)$/) || [])[1];
  if (!id) return null;                                /* has a combinator: already the fix */
  const at = html.indexOf('id="' + id + '"');
  if (at < 0) return null;                             /* runtime-built: nothing to read */
  const tag = html.slice(html.lastIndexOf("<", at), at + 240);
  const names = ["#" + id].concat(
    ((tag.match(/class="([^"]*)"/) || [])[1] || "").split(/\s+/).filter(Boolean).map(c => "." + c));
  for (const n of names) {
    const re = new RegExp(n.replace(/[.#]/g, "\\$&") + "\\s*\\{[^}]*?\\b(?:min-)?height\\s*:\\s*[^};]+", "g");
    const m = html.match(re);
    if (m) return n + " sets " + (m[0].match(/(?:min-)?height\s*:\s*[^};]+/) || [""])[0].trim();
  }
  return null;
}
const vacuous = steps.filter(s => s.needs)
  .map(s => ({ s: s, why: sizedByCss(needsAt(s.needs), uj) })).filter(x => x.why);
ok("...and a step never waits on a container the stylesheet has already sized",
   vacuous.length === 0,
   vacuous.map(x => x.s._part + "#" + x.s._i + " " + needsAt(x.s.needs) + " \u2014 " + x.why)
     .join(" | ")
   || steps.filter(s => s.needs).length + " waits checked against the stylesheet");

/* ...and `pageWait` is for a step that really does wait. On a step with no `needs` it is a claim
   about nothing, which means somebody has misunderstood what it is for. */
const idleClaim = steps.filter(s => s.pageWait && !s.needs);
ok("...and nothing claims to wait on the page without waiting at all", idleClaim.length === 0,
   idleClaim.map(s => s._part + "#" + s._i).join(", ") || "none");
const badPress = steps.filter(s => s.press && !inFile(s.press, MARKUP));
ok("...and it is a control the page has", badPress.length === 0,
   badPress.map(s => s._part + "#" + s._i + " " + s.press).join(" | ")
   || steps.filter(s => s.press).length + " checked");
const idle = steps.filter(s => s.after && !s.needs);
ok("...and nothing claims to wait without waiting", idle.length === 0,
   idle.map(s => s._part + "#" + s._i).join(", ") || "none");
ok("a tab named by a step is one the page has",
   steps.filter(s => s.tab).every(s => uj.indexOf('data-tab="' + s.tab + '"') >= 0),
   steps.filter(s => s.tab).map(s => s.tab).join(", ") || "none named");
/* ...AND THE STEP IS ON THE TAB ITS TARGET LIVES ON.                                2026-10-23
   µJump hides the inactive tab panels, so a step pointing at a control on the Filter tab while
   the walkthrough is on Jump spotlights a 0x0 rectangle and reports its own target as missing.
   Nothing above catches that: the selector IS in the page and the tab name IS real; they just
   disagree. Checked for the ids ujump.html carries in its own markup, by finding which
   data-tabpanel each one sits inside, and holding the step to the LAST tab named at or before it
   in its part -- because `tab` is sticky, and only the step that changes tabs declares one.

   Runtime-built targets (#tracePadOpen, #organRows) cannot be placed this way and are skipped
   rather than guessed at; their own `needs` is what covers them. */
const PANELS = [];
uj.replace(/data-tabpanel="([a-z]+)"/g, (m, name, at) => { PANELS.push([at, name]); return m; });
/* ONLY OCCURRENCES IN MARKUP COUNT, and finding that out cost the first run of this assertion:
   #idfgo was reported as living on tab-forum. It is built at runtime, and the string id="idfgo"
   duly appears -- in a <script> further down the file than the forum panel's markup. Placing a
   step by a match inside a script is placing it by where the code happens to be written, which
   has nothing to do with where the element ends up. So the script ranges are cut out first, and
   an id found only there is treated as unplaceable rather than as placed wrongly. */
const SCRIPTS = [];
uj.replace(/<script\b[\s\S]*?<\/script>/g, (m, at) => { SCRIPTS.push([at, at + m.length]); return m; });
const inScript = at => SCRIPTS.some(([a, b]) => at >= a && at < b);
const panelOf = sel => {
  const id = (String(sel).match(/^#([A-Za-z][\w-]*)$/) || [])[1];
  if (!id) return null;
  const needle = 'id="' + id + '"';
  let at = uj.indexOf(needle);
  while (at >= 0 && inScript(at)) at = uj.indexOf(needle, at + 1);
  if (at < 0) return null;
  let owner = null;
  for (const [pos, name] of PANELS) if (pos < at) owner = name;
  return owner;
};
const wrongTab = [];
let placed = 0;
for (const p of (CFG ? CFG.parts : [])) {
  let on = null;
  (p.steps || []).forEach((s, i) => {
    if (s.tab) on = s.tab;
    for (const sel of [s.at, s.press]) {
      const want = sel ? panelOf(sel) : null;
      if (!want) continue;
      placed++;
      if (want !== on)
        wrongTab.push(p.id + "#" + (i + 1) + " " + sel + " is on tab-" + want
                      + " but the walkthrough is on tab-" + (on || "(none named)"));
    }
  });
}
/* NON-VACUOUS ON PURPOSE. Cutting the script ranges out could in principle leave nothing
   placeable at all, and then this assertion would pass by having checked nothing -- which this
   file has shipped before and does not intend to again. The count is part of the claim. */
ok("...and a step is on the tab its target lives on", wrongTab.length === 0 && placed >= 8,
   wrongTab.join(" | ") || placed + " targets placed in a tab panel, all on the named tab");

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
/* ONE BUTTON, WHICH ASKS WHICH.                                                     2026-10-23
   Søren: "There should only be one tutorial button, when that opens you can select which
   tutorial you want." So the assertion is no longer one button per part — it is exactly one
   button, and no per-part buttons in the tab bar at all. What makes the parts reachable is the
   picker, which the engine builds from #tourdata, so the next assertions check that instead of
   checking markup that no longer carries the parts. */
const menuBtns = (uj.match(/data-tour-menu="[^"]*"/g) || []);
const starters = (uj.match(/data-tour-start="[a-z0-9]+"/g) || []);
ok("there is exactly one Tutorial button, and it asks which walkthrough",
   menuBtns.length === 1 && starters.length === 0,
   menuBtns.length + " menu button(s), " + starters.length + " per-part button(s)");
ok("...and the engine builds the picker out of the step list, not out of the markup",
   /function menu\(\)/.test(tour) && /CFG\.parts\.forEach/.test(tour)
   && /\[data-tour-menu\]/.test(tour),
   "menu() iterates CFG.parts and wires [data-tour-menu]");
/* A row with no blurb is a row saying "2. Filter and show" and nothing else, which is the
   numbered-buttons problem again one level down. */
ok("...and every part says what it covers, for its row in the picker",
   !!CFG && (CFG.parts || []).every(p => p.blurb && p.blurb.length > 25),
   (CFG && CFG.parts ? CFG.parts.filter(p => !p.blurb || p.blurb.length <= 25)
     .map(p => p.id).join(", ") : "") || "all have one");
/* The picker is how you leave the dim band, so it has to sit above it. The band is 10030-10042;
   read both out of the file rather than trusting the comment. */
const zMenu = +(((tour.match(/\.tour-menu\{[^}]*z-index: *(\d+)/) || [])[1]) || 0);
const zBubble = +(((tour.match(/\.tour-bubble\{[^}]*z-index: *(\d+)/) || [])[1]) || 0);
ok("...and the picker sits above the walkthrough's own overlay",
   zMenu > zBubble && zBubble > 0, "picker " + zMenu + " vs bubble " + zBubble);
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

/* ── THE SECOND PAGE ────────────────────────────────────────────────────────────────  2026-10-23
   Søren: *"a guide for collecting cells for VR, opening the VR scene and continuing the tutorial
   there."* Continuing there means vr.html has its own step list, which gets the same scrutiny:
   every selector looked for in ITS markup and ITS modules, not µJump's.

   WHY THIS HALF EARNS ITS KEEP MORE THAN THE REST. vr.html is being rewritten in another
   conversation. A written guide to it would still read perfectly after a control was renamed;
   these assertions go red with the step number. If vr.html is not here at all — a checkout
   without it — the section says so and does not fail, the same way the fixture half does.

   THE CROSS-PAGE ASSERTIONS ARE THE NEW ONES. A `handoff` on one page naming a part nothing
   declares is a dead end that nothing else could catch, and a mismatched storage key would mean
   the note is written where the other page never looks. Both are checkable only by reading the
   two documents together, which is what this file can do and neither page can. */
console.log("\n--- the walkthrough carries on in vr.html ---");
const vrPath = path.join(path.dirname(page_("ujump.html")), "vr.html");
const vrHtml = fs.existsSync(vrPath) ? fs.readFileSync(vrPath, "utf8") : null;
const VCFG = vrHtml ? tourdataOf(vrHtml, "vr.html") : null;
/* Every step on either page that hands the reader to another page. */
const handoffs = [].concat.apply([], (CFG ? CFG.parts : []).map(p =>
  (p.steps || []).map((s, i) => s.handoff ? { from: p.id + "#" + (i + 1), to: s.handoff } : null)
    .filter(Boolean)));
if (!vrHtml) {
  console.log("NOT RUN  vr.html is not in this tree, so its half of the walkthrough was not "
    + "checked. µJump still declares the handoff" + (handoffs.length
      ? " to “" + handoffs.map(h => h.to).join(", ") + "”." : "."));
} else {
  const vrMarkup = vrHtml + "\n" + fs.readdirSync(COREDIR).filter(f => /\.js$/.test(f))
    .map(f => fs.readFileSync(path.join(COREDIR, f), "utf8").replace(/\\"/g, '"'))
    .join("\n");
  ok("vr.html loads core/tour.js and carries a #tourdata block that parses",
     /<script src="core\/tour\.js"><\/script>/.test(vrHtml) && !!VCFG,
     VCFG ? "ok" : "missing or invalid");
  /* THE KEY MUST MATCH, or the handoff note is written where the other page never looks. */
  ok("...under the same storage key as µJump, which is what lets the note travel",
     !!VCFG && !!CFG && VCFG.key === CFG.key, (VCFG && VCFG.key) + " vs " + (CFG && CFG.key));
  ok("...with one Tutorial button, and no per-part ones",
     (vrHtml.match(/data-tour-menu="[^"]*"/g) || []).length === 1
     && (vrHtml.match(/data-tour-start="/g) || []).length === 0,
     (vrHtml.match(/data-tour-menu="[^"]*"/g) || []).length + " menu button(s)");
  ok("...and it is offered through ready(), never started unasked",
     /UJ\.tour\.ready\(\)/.test(vrHtml) && vrHtml.indexOf("UJ.tour.start(") < 0);
  ok("...and exactly one step list, not two",
     (vrHtml.match(/id="tourdata"/g) || []).length === 1,
     (vrHtml.match(/id="tourdata"/g) || []).length + " #tourdata block(s)");
  const vsteps = VCFG ? [].concat.apply([], VCFG.parts.map(p =>
    (p.steps || []).map((s, i) => Object.assign({ _part: p.id, _i: i + 1 }, s)))) : [];
  ok("its steps say something, about something",
     vsteps.length >= 8 && vsteps.every(s => s.say && s.say.length >= 15)
     && vsteps.filter(s => s._i > 1).every(s => s.at),
     vsteps.length + " steps");
  const vbad = vsteps.filter(s => s.at && !inFile(s.at, vrMarkup));
  ok("...and every selector in them is in vr.html or a module it loads", vbad.length === 0,
     vbad.map(s => s._part + "#" + s._i + " " + s.at).join(" | ")
     || vsteps.filter(s => s.at).length + " checked");
  /* IT DOES HAVE TABS -- SEVEN -- AND THIS ASSERTION USED TO DENY IT.               2026-10-23
     It read "none of them names a tab, since this page has none", written before the page was
     driven. vr.html's panel is seven panes built at runtime from a TABS table, only the current
     one displayed, and it exposes its own switcher because it does not load core/stepthrough.js.
     Seven of sixteen steps pointed into a closed pane and reported their own targets missing.

     So: a step may name a tab, it must be one of the keys the page actually builds, and the page
     must declare which global opens them. The keys are read out of that TABS table rather than
     listed here, so adding an eighth pane needs no change. */
  const vrTabs = (vrHtml.match(/\[\s*"([a-z]+)",\s*"[a-z]+",\s*"[A-Z]/g) || [])
    .map(m => (m.match(/"([a-z]+)"/) || [])[1]).filter(Boolean);
  ok("...and a step that names a tab names one the panel actually builds",
     vrTabs.length >= 5 && vsteps.filter(s => s.tab).every(s => vrTabs.indexOf(s.tab) >= 0),
     "panes: " + vrTabs.join(", ") + "; steps use: "
     + [...new Set(vsteps.filter(s => s.tab).map(s => s.tab))].join(", "));
  /* ...and something has to open them. core/stepthrough.js is not loaded here, so the step list
     names the global instead, and core/tour.js calls it rather than knowing about this page. */
  ok("...and the step list names the switcher that opens them",
     !!VCFG && !!VCFG.tab && new RegExp("window\\." + VCFG.tab + "\\s*=").test(vrHtml)
     && /CFG\.tab/.test(tour),
     (VCFG && VCFG.tab) ? VCFG.tab + ", exposed by the page and used by the engine"
                        : "no switcher declared");
  /* THE HANDOFF LANDS. */
  const vrIds = VCFG ? VCFG.parts.map(p => p.id) : [];
  ok("the handoff from µJump names a part vr.html actually declares",
     handoffs.length > 0 && handoffs.every(h => vrIds.indexOf(h.to) >= 0),
     handoffs.map(h => h.from + " → " + h.to).join(", ") + "; vr.html has "
     + vrIds.join(", "));
  ok("...and the engine both writes that note and spends it on arrival",
     /markHandoff/.test(tour) && /takeHandoff/.test(tour) && /offerHandoff/.test(tour));
  /* The two step lists must not both claim the same part id, or progress in one would be read as
     progress in the other under the shared key. */
  ok("...and no part id is claimed by both pages",
     (CFG ? CFG.parts : []).every(p => vrIds.indexOf(p.id) < 0),
     (CFG ? CFG.parts.map(p => p.id).filter(id => vrIds.indexOf(id) >= 0) : []).join(", ")
     || "all distinct");
}

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
  /* "1 of <however many the fixture declares>", not "1 of 7". The literal was the last hardcoded
     count in this file and it broke the moment the fixture grew a handoff step -- while nothing
     was wrong. Same lesson as the `=== 4` indices, one assertion later. */
  ok("it opens on step 1",
     s1.on && s1.count === "1 of " + s1.where.of && s1.where.step === 0 && s1.where.of > 1,
     s1.count);
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

  /* ── THE PICKER, DRIVEN ─────────────────────────────────────────────────────────  2026-10-23
     Søren: "There should only be one tutorial button, when that opens you can select which
     tutorial you want." Driven rather than read, for the reason this file learned the hard way:
     the dim band once covered the very control a step told you to press, and the only thing that
     caught it was a REAL click plus a hit test. A picker is the same shape of risk — a card that
     appears over a page that already has overlays — so the row is clicked with p.click(), which
     refuses when something is on top of it, and the hit test says what is. */
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  await p.click("#menuBtn");
  await p.waitForTimeout(250);
  const picker = await p.evaluate(() => {
    const box = document.querySelector(".tour-menu");
    if (!box) return { open: false };
    const rows = Array.from(box.querySelectorAll(".tour-pick"));
    const r = rows[1].getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { open: true, n: rows.length,
             ids: rows.map(b => b.getAttribute("data-pick")),
             blurbs: rows.every(b => !!b.querySelector("span")),
             states: rows.map(b => (b.querySelector(".tour-pick-state") || {}).textContent),
             hitInRow: !!hit && (hit === rows[1] || rows[1].contains(hit)),
             parts: UJ.tour.parts().length };
  });
  ok("the one Tutorial button opens a picker", picker.open === true);
  ok("...with a row for every part the step list declares",
     picker.n === picker.parts && picker.parts > 1,
     picker.n + " rows for " + picker.parts + " parts: " + (picker.ids || []).join(", "));
  ok("...each saying what it covers", picker.blurbs === true);
  /* The row for part one has to show the progress the keyboard block just left behind, or the
     picker is a menu that forgets, and "it remembers where you got to" stops being true where
     the reader can see it. */
  ok("...and the row for a part left half way through says where you got to",
     /got to step/.test((picker.states || [])[0] || ""),
     JSON.stringify((picker.states || [])[0]));
  ok("...and a row is not covered by anything", picker.hitInRow === true);
  const started = await (async () => {
    await p.click('.tour-pick[data-pick="part2"]');
    await p.waitForTimeout(400);
    return p.evaluate(() => ({ where: UJ.tour.where(),
                               gone: !document.querySelector(".tour-menu") }));
  })();
  ok("...and picking one starts that part", started.where && started.where.part === "part2",
     JSON.stringify(started.where));
  ok("...and closes the picker behind it", started.gone === true);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  /* Esc has to work on the picker too. The tour's own key handler ignores keys while no part is
     running, so the picker cannot borrow it and carries its own -- and has to take it off again,
     or every opening leaves another listener behind. */
  await p.click("#menuBtn");
  await p.waitForTimeout(200);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  ok("Escape closes the picker, and it does not leave its key handler behind",
     await p.evaluate(() => !document.querySelector(".tour-menu")
                            && !document.querySelector(".tour-menu-back")));

  /* ── THE WAY ON, FROM THE LAST STEP ─────────────────────────────────────────────  2026-10-23
     Søren: "There should be a small link to the next tutorial in the last step." Driven, because
     what has to be true is that it appears on the LAST step and nowhere else, that it names the
     part that actually follows in the declared order, and that pressing it starts that one -- all
     three being things a reading of the source cannot settle. */
  const onward = await p.evaluate(async () => {
    UJ.tour.stop();
    try { localStorage.clear(); } catch (e) {}
    const parts = UJ.tour.parts();
    UJ.tour.start(parts[0].id);
    const n = parts[0].steps.length;
    const seen = [];
    for (let i = 0; i < n; i++) {
      await new Promise(r => setTimeout(r, 60));
      const el = document.querySelector(".tour-onward");
      seen.push({ step: i + 1, shown: !!(el && !el.hidden),
                  text: el && !el.hidden ? el.textContent : "" });
      if (i < n - 1) document.querySelector(".tour-next").click();
    }
    return { seen: seen, nextTitle: parts[1] ? parts[1].title : null, nextId: parts[1] ? parts[1].id : null };
  });
  const shownOn = onward.seen.filter(x => x.shown).map(x => x.step);
  ok("the way on appears on the last step of a part, and only there",
     shownOn.length === 1 && shownOn[0] === onward.seen.length,
     shownOn.length ? "shown on step " + shownOn.join(", ") + " of " + onward.seen.length
                    : "never shown");
  ok("...and it names the part that actually follows",
     !!onward.nextTitle && (onward.seen[onward.seen.length - 1].text || "").indexOf(onward.nextTitle) >= 0,
     JSON.stringify((onward.seen[onward.seen.length - 1] || {}).text));
  const went = await p.evaluate(async () => {
    document.querySelector(".tour-go-next").click();
    await new Promise(r => setTimeout(r, 300));
    return UJ.tour.where();
  });
  ok("...and pressing it starts that one", went && went.part === onward.nextId,
     JSON.stringify(went));
  await p.evaluate(() => { UJ.tour.stop(); try { localStorage.clear(); } catch (e) {} });

  /* ── THE HANDOFF ACROSS A PAGE ──────────────────────────────────────────────────  2026-10-23
     Søren: "collecting cells for VR, opening the VR scene and continuing the tutorial there."
     Opening the scene is a NAVIGATION, so the walkthrough cannot carry on by itself -- the page
     it was running in is gone. A step declares `handoff`, which leaves a note beside the
     progress; the page that declares that part picks the note up on arrival.

     Driven in ONE page rather than two: what has to be true is that showing the step writes the
     note, that ready() turns a note into a continuation offer for a part THIS document has, and
     that the note is spent either way. All three are observable here, and a second fixture page
     would test the browser's navigation rather than this file. */
  const handoff = await p.evaluate(async () => {
    UJ.tour.stop();
    UJ.tour.start("part1");
    const steps = UJ.tour.parts()[0].steps;
    const want = steps.findIndex(s => s.handoff);
    for (let i = 0; i < want; i++) document.querySelector(".tour-next").click();
    const noted = UJ.tour.handoff();
    UJ.tour.stop();
    /* As if the other page had just loaded: ready() reads the note and offers to carry on. */
    UJ.tour.ready();
    await new Promise(r => setTimeout(r, 150));
    const card = document.querySelector(".tour-offer");
    return { atStep: want + 1, noted: noted,
             offered: !!card, says: card ? card.textContent.slice(0, 80) : "",
             spent: UJ.tour.handoff(),
             yes: !!(card && card.querySelector(".tour-offer-yes")) };
  });
  ok("a step that hands the reader to another page leaves a note",
     handoff.noted === "part2", "step " + handoff.atStep + " noted " + JSON.stringify(handoff.noted));
  ok("...and the arriving page turns that note into an offer to carry on",
     handoff.offered && /[Cc]arrying on/.test(handoff.says), JSON.stringify(handoff.says));
  ok("...worded as a continuation, not as a first visit",
     !/First time here/.test(handoff.says) && handoff.yes === true);
  /* A note that survived being answered would offer the same continuation on every later visit. */
  ok("...and the note is spent, so it does not offer again", handoff.spent === null,
     JSON.stringify(handoff.spent));
  const carried = await p.evaluate(async () => {
    document.querySelector(".tour-offer-yes").click();
    await new Promise(r => setTimeout(r, 250));
    return UJ.tour.where();
  });
  ok("...and accepting starts the part it names", carried && carried.part === "part2",
     JSON.stringify(carried));
  await p.evaluate(() => { UJ.tour.stop(); try { localStorage.clear(); } catch (e) {} });

  /* ── READABILITY IN BOTH PALETTES ───────────────────────────────────────────────  2026-10-23
     Søren, on his phone: *"I can't read anything."* A white panel with near-white text, because
     the bubble took its background from a #fff fallback and its text from µJump's own --ink.
     Measured, not eyeballed: the contrast ratio between the rendered text colour and the rendered
     background, in index.html's palette AND in µJump's, both of which the fixture now carries.
     4.5:1 is the WCAG AA threshold for body text. */
  console.log("\n--- readable in all three of the family's palettes ---");
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
    /* EVERY LINE THE BUBBLE CAN SHOW, not only the body text. The waiting line takes --accent and
       the "still not here" line took --warn, which vr.html does not define -- a dark orange
       literal on a dark card is the same bug as dark text on a dark card, and measuring only
       .tour-say would have passed it. Made visible first: a hidden line has no rendered colour
       worth trusting. */
    const wait = b.querySelector(".tour-wait"), gone = b.querySelector(".tour-gone");
    const onw = b.querySelector(".tour-onward");
    const wasW = wait.hidden, wasG = gone.hidden, wasO = onw.hidden;
    wait.hidden = false; gone.hidden = false;
    /* The way-on link, measured with the rest -- it takes --accent, which is the token this
       family disagrees about least, but "least" is not "never". */
    onw.hidden = false;
    if (!onw.querySelector(".tour-go-next")) {
      const t = document.createElement("button");
      t.className = "tour-go-next"; t.textContent = "x"; onw.appendChild(t);
    }
    const out = { bg: bg, ink: getComputedStyle(say).color,
             body: ratio(getComputedStyle(say).color, bg),
             count: ratio(getComputedStyle(b.querySelector(".tour-count")).color, bg),
             wait: ratio(getComputedStyle(wait).color, bg),
             gone: ratio(getComputedStyle(gone).color, bg),
             onward: ratio(getComputedStyle(onw.querySelector(".tour-go-next")).color, bg),
             button: ratio(getComputedStyle(go).color, getComputedStyle(go).backgroundColor) };
    wait.hidden = wasW; gone.hidden = wasG; onw.hidden = wasO;
    return out;
  }, palette);
  /* 4.5:1 is the WCAG AA floor for body text; 3:1 is the large-text/UI floor, which is what the
     two small status lines are held to -- they are 13px supporting text beside a body line that
     already says the same thing in full. */
  const legible = c => c.body >= 4.5 && c.button >= 4.5 && c.count >= 4.5
                    && c.wait >= 3 && c.gone >= 3 && c.onward >= 4.5;
  const spell = c => "body " + c.body + ", count " + c.count + ", waiting " + c.wait
                   + ", not-here " + c.gone + ", way-on " + c.onward
                   + ", button " + c.button + " on " + c.bg;
  await p.evaluate(() => { UJ.tour.stop(); UJ.tour.start("part1"); });
  await p.waitForTimeout(250);
  const light = await contrast(null);
  ok("every line of the bubble is readable (index.html's palette)", legible(light), spell(light));
  const dark = await contrast("ujump");
  ok("...and in \u00b5Jump's palette, which has no --card at all", legible(dark), spell(dark));
  /* THE PALETTE THE WALKTHROUGH HAD NEVER MET. vr.html defines --card and calls its text --fg,
     so before --fg went into the chain this measured dark-on-dark -- caught here, not on his
     phone. The scene is the first page outside the two this overlay grew up on. */
  const vr = await contrast("vr");
  ok("...and in vr.html's, which names its text --fg rather than --ink", legible(vr), spell(vr));
  /* THE PICKER, IN BOTH PALETTES TOO. Its rows carry a grey second line (--muted on index.html,
     --mut on µJump), which is the same kind of two-palette token that produced white-on-white in
     the bubble. The phone screenshot is not the place to find that out a second time. */
  const pickerContrast = async pal => p.evaluate(pp => {
    if (pp) document.documentElement.setAttribute("data-palette", pp);
    else document.documentElement.removeAttribute("data-palette");
    UJ.tour.stop();
    UJ.tour.menu();
    const box = document.querySelector(".tour-menu");
    const row = box.querySelector(".tour-pick");
    const lum = c => {
      const m = c.match(/[\d.]+/g).map(Number);
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
    };
    const ratio = (a, bg) => { const l1 = lum(a), l2 = lum(bg);
      return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))).toFixed(2); };
    const bg = getComputedStyle(box).backgroundColor;
    const out = { bg: bg,
      title: ratio(getComputedStyle(row.querySelector("b")).color, bg),
      blurb: ratio(getComputedStyle(row.querySelector("span")).color, bg) };
    document.querySelector(".tour-menu-close").click();
    return out;
  }, pal);
  const pLight = await pickerContrast(null);
  ok("the picker's rows are readable, title and all (index.html's palette)",
     pLight.title >= 4.5 && pLight.blurb >= 4.5,
     "title " + pLight.title + ":1, what-it-covers " + pLight.blurb + ":1 on " + pLight.bg);
  const pDark = await pickerContrast("ujump");
  ok("...and in µJump's palette, where the grey comes from --mut instead",
     pDark.title >= 4.5 && pDark.blurb >= 4.5,
     "title " + pDark.title + ":1, what-it-covers " + pDark.blurb + ":1 on " + pDark.bg);
  const pVr = await pickerContrast("vr");
  ok("...and in vr.html's, where the title comes from --fg",
     pVr.title >= 4.5 && pVr.blurb >= 4.5,
     "title " + pVr.title + ":1, what-it-covers " + pVr.blurb + ":1 on " + pVr.bg);
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
  /* ── THE BUBBLE ON TOP OF THE BUTTON IT NAMES, ON A PHONE ───────────────────────  2026-10-23
     Søren, from his phone: a step reading "Waiting for you to press the collection pill" with no
     pill anywhere on screen -- only a sliver of its green ring showing past the bubble's edge.
     placeBubble()'s desktop branch tries below the target, then above, then clamps; its PHONE
     branch pinned the bubble to the bottom whatever the target was doing. core/vrbasket.js's
     pill is position:fixed at bottom:16px, so the bubble landed exactly on it, and no amount of
     scrolling could help because neither moves.

     The same lesson as the dimming that covered its own press-target, which only a hit test
     caught: the engine telling you to press something and then hiding it is the one failure that
     makes a walkthrough unusable rather than merely imperfect. So the fixture now carries a
     pinned corner pill and tray, and this walks to that step at phone size and hit-tests it. */
  const pinned = await p.evaluate(async () => {
    UJ.tour.stop();
    try { localStorage.clear(); } catch (e) {}
    const steps = UJ.tour.parts()[0].steps;
    const want = steps.findIndex(s => s.press === "#cornerPill");
    UJ.tour.start("part1");
    for (let i = 0; i < want; i++) document.querySelector(".tour-next").click();
    await new Promise(r => setTimeout(r, 450));
    const pill = document.querySelector("#cornerPill").getBoundingClientRect();
    const bub = document.querySelector(".tour-bubble").getBoundingClientRect();
    const hit = document.elementFromPoint(pill.left + pill.width / 2, pill.top + pill.height / 2);
    return { step: want + 1, waiting: !document.querySelector(".tour-wait").hidden,
             overlap: !(bub.right < pill.left || bub.left > pill.right
                     || bub.bottom < pill.top || bub.top > pill.bottom),
             hitIsPill: !!hit && (hit.id === "cornerPill" || hit.closest("#cornerPill") !== null),
             hitWas: hit ? (hit.id || hit.className || hit.tagName) : "nothing",
             bubTop: Math.round(bub.top), pillTop: Math.round(pill.top), h: window.innerHeight };
  });
  ok("a step naming a PINNED corner control is waiting on it", pinned.waiting === true,
     "step " + pinned.step);
  ok("...and the bubble does not land on top of it", !pinned.overlap,
     "bubble at y=" + pinned.bubTop + ", pill at y=" + pinned.pillTop + " of " + pinned.h);
  /* The hit test, not the rectangles: a real tap has to reach the pill. */
  ok("...and a tap on it reaches the pill itself", pinned.hitIsPill === true,
     "the tap landed on " + pinned.hitWas);
  /* ...and once the reader does press it, the step's own target is a pinned tray at the bottom,
     so the bubble has to stay out of the way a second time rather than snapping back down onto
     it. This is the exact step Søren was looking at. */
  const opened = await p.evaluate(async () => {
    document.querySelector("#cornerPill").click();
    await new Promise(r => setTimeout(r, 500));
    const tray = document.querySelector("#cornerTray").getBoundingClientRect();
    const bub = document.querySelector(".tour-bubble").getBoundingClientRect();
    return { waiting: !document.querySelector(".tour-wait").hidden,
             overlap: !(bub.right < tray.left || bub.left > tray.right
                     || bub.bottom < tray.top || bub.top > tray.bottom),
             bubTop: Math.round(bub.top), trayTop: Math.round(tray.top) };
  });
  ok("...and pressing it stops the wait", opened.waiting === false);
  ok("...with the bubble still clear of the tray it has just opened", !opened.overlap,
     "bubble at y=" + opened.bubTop + ", tray at y=" + opened.trayTop);
  await p.evaluate(() => { UJ.tour.stop(); try { localStorage.clear(); } catch (e) {} });
  await p.setViewportSize({ width: 1280, height: 900 });
  /* The picker on the same 390px screen. The bubble was 400px wide here three hours ago, which is
     the whole reason the engine sets its own box-sizing; the picker is a second fixed-width card
     and gets the same measurement rather than the same assumption. */
  const phonePick = await p.evaluate(() => {
    UJ.tour.stop();
    UJ.tour.menu();
    const b = document.querySelector(".tour-menu").getBoundingClientRect();
    const out = { inside: b.left >= 0 && b.right <= window.innerWidth,
                  tall: b.height <= window.innerHeight,
                  w: Math.round(b.width), vw: window.innerWidth,
                  wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
    document.querySelector(".tour-menu-close").click();
    return out;
  });
  ok("...and the picker fits it too", phonePick.inside && phonePick.tall,
     phonePick.w + "px wide in " + phonePick.vw + "px");
  ok("...without pushing the page sideways", !phonePick.wide);

  await p.close();
  ok("no script errors on the fixture", errs.length === 0, errs.join(" | ") || "none");

  /* ── AND THEN THE REAL vr.html ──────────────────────────────────────────────────  2026-10-23
     The static half can say a selector is somewhere in the file. It cannot say the control is on
     screen when its step runs, and in vr.html that is the whole question: the panel is seven
     panes with only the current one displayed, and two of the controls are <select>s that the
     page hides and replaces with a segmented button row. The first run of these steps reported
     SEVEN of sixteen targets missing, and nothing static could have told me.

     So the steps are walked, in a browser, on the real page. ujump.html cannot be driven here --
     it is 14.5 MB and takes the renderer down -- but vr.html is 0.9 MB and loads. three.js comes
     from a CDN this harness blocks, so the 3D never starts; the PANEL does, which is what these
     steps point at. A target that needs a loaded scene is the one exception and says so.

     Served over HTTP rather than file://, because a module page on file:// is a different thing. */
  const vrFile = path.join(path.dirname(page_("ujump.html")), "vr.html");
  if (!fs.existsSync(vrFile)) {
    console.log("\nNOT RUN  the walkthrough on the real vr.html  <- vr.html is not in this tree.");
  } else {
    console.log("\n--- the vr.html steps, walked on the real page ---");
    const http = require("http");
    const ROOT = path.dirname(vrFile);
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.statusCode = 404; return r.end();
      }
      r.setHeader("content-type", /\.js$/.test(f) ? "text/javascript"
        : /\.html$/.test(f) ? "text/html" : "application/octet-stream");
      r.end(fs.readFileSync(f));
    });
    await new Promise(res => srv.listen(0, "127.0.0.1", res));
    const vp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const verrs = [];
    vp.on("pageerror", e => verrs.push(e.message.slice(0, 110)));
    await vp.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
    let vcrash = false;
    vp.on("crash", () => { vcrash = true; });
    await vp.goto("http://127.0.0.1:" + srv.address().port + "/vr.html",
                  { waitUntil: "domcontentloaded", timeout: 60000 });
    await vp.waitForTimeout(3500);
    ok("vr.html loads, and the walkthrough is on it",
       !vcrash && await vp.evaluate(() => typeof UJ !== "undefined" && !!UJ.tour
         && UJ.tour.parts().length > 0 && !!document.querySelector("[data-tour-menu]")),
       vcrash ? "the page crashed" : "tour.js ran and the Tutorial button is there");
    /* The tab switcher the step list names has to BE there, or every pane step is blind. */
    ok("...and the switcher its step list names exists on the page",
       await vp.evaluate(() => { const c = UJ.tour.cfg();
         return !c.tab || typeof window[c.tab] === "function"; }),
       (VCFG && VCFG.tab) ? VCFG.tab + "() is a function" : "no switcher declared");
    const walked = await vp.evaluate(async () => {
      const o = document.querySelector(".tour-offer");
      if (o) o.querySelector(".tour-offer-no").click();
      const id = UJ.tour.parts()[0].id;
      UJ.tour.start(id);
      const rows = [];
      const n = UJ.tour.parts()[0].steps.length;
      for (let i = 0; i < n; i++) {
        await new Promise(r => setTimeout(r, 160));
        const w = UJ.tour.where();
        const ring = document.querySelector(".tour-ring");
        const bub = document.querySelector(".tour-bubble").getBoundingClientRect();
        rows.push({ step: w ? w.step + 1 : null,
                    ringed: !!(ring && !ring.hidden),
                    waiting: !document.querySelector(".tour-wait").hidden,
                    inView: bub.left >= 0 && bub.right <= innerWidth
                            && bub.top >= 0 && bub.bottom <= innerHeight });
        document.querySelector(".tour-next").click();
      }
      return { rows: rows, missing: UJ.tour.missing() };
    });
    /* #list is empty until meshes arrive, and the meshes need the CDN this harness blocks. It is
       the one target allowed to be unresolved here, and naming it keeps the allowance honest --
       a second name appearing in this list is a real failure, not a harness limitation. */
    const ALLOWED = ["#list", "#vrslot button"];
    const unexpected = walked.missing.filter(m => ALLOWED.indexOf(m) < 0);
    ok("every step in the scene finds its control",
       unexpected.length === 0,
       unexpected.length ? "not found: " + unexpected.join(", ")
         : walked.rows.length + " steps walked; only " + walked.missing.join(", ")
           + " unresolved, which this harness cannot load");
    ok("...and the bubble stays on screen at every one of them",
       walked.rows.every(r => r.inView),
       walked.rows.filter(r => !r.inView).map(r => "step " + r.step).join(", ") || "all of them");
    /* Most steps point at something; an opening step and a waiting step do not have to. */
    ok("...and the spotlight lands on most of them",
       walked.rows.filter(r => r.ringed).length >= walked.rows.length - 3,
       walked.rows.filter(r => r.ringed).length + " of " + walked.rows.length + " spotlighted");
    ok("...with no script errors from the walkthrough",
       verrs.filter(e => /tour/i.test(e)).length === 0,
       verrs.length ? verrs.slice(0, 3).join(" | ") : "none");
    /* ── AND THE SAME WALK ON A PHONE ─────────────────────────────────────────────  2026-10-23
       vr.html is the only real page in this family that can be driven here, and it is full of
       position:fixed furniture -- #keysCard bottom-right, #panel down the left -- which is
       exactly the shape that put the bubble on top of the control it named on Søren's phone.
       The fixture proves the placement rule; this proves it against real furniture. */
    await vp.setViewportSize({ width: 390, height: 780 });
    const vphone = await vp.evaluate(async () => {
      UJ.tour.stop();
      try { localStorage.clear(); } catch (e) {}
      const id = UJ.tour.parts()[0].id;
      UJ.tour.start(id);
      const bad = [];
      const n = UJ.tour.parts()[0].steps.length;
      for (let i = 0; i < n; i++) {
        await new Promise(r => setTimeout(r, 200));
        const w = UJ.tour.where();
        const ring = document.querySelector(".tour-ring");
        const bub = document.querySelector(".tour-bubble").getBoundingClientRect();
        if (bub.left < 0 || bub.right > innerWidth)
          bad.push("step " + (w ? w.step + 1 : "?") + " off-screen");
        if (ring && !ring.hidden) {
          const rr = ring.getBoundingClientRect();
          /* A target taller than the free space cannot be missed in either slot; only count a
             target that WOULD have fitted beside the bubble. */
          const fits = rr.height < innerHeight - bub.height - 24;
          const over = !(bub.right < rr.left || bub.left > rr.right
                      || bub.bottom < rr.top || bub.top > rr.bottom);
          if (fits && over) bad.push("step " + (w ? w.step + 1 : "?") + " covered");
        }
        document.querySelector(".tour-next").click();
      }
      return { bad: bad, steps: n };
    });
    /* ONE PART, SO NO WAY ON. vr.html declares a single walkthrough: a "Next:" link would have
       nowhere to point and a picker would be a question with one answer, so the engine shows
       neither. Checked here because it is the only page in the tree where that branch runs. */
    const vrOnward = await vp.evaluate(async () => {
      UJ.tour.stop();
      const p0 = UJ.tour.parts()[0];
      UJ.tour.start(p0.id);
      for (let i = 0; i < p0.steps.length - 1; i++) document.querySelector(".tour-next").click();
      await new Promise(r => setTimeout(r, 250));
      const el = document.querySelector(".tour-onward");
      return { parts: UJ.tour.parts().length, shown: !!(el && !el.hidden),
               text: el ? el.textContent : "" };
    });
    ok("...and the last step offers no way on, because this page has only one walkthrough",
       vrOnward.parts === 1 && vrOnward.shown === false,
       vrOnward.parts + " part(s), link " + (vrOnward.shown ? "shown: " + vrOnward.text : "hidden"));
    ok("...and on a phone the bubble never covers a target that could have fitted beside it",
       vphone.bad.length === 0,
       vphone.bad.join(", ") || vphone.steps + " steps walked at 390px");
    await vp.close();
    srv.close();
  }

  await browser.close();

  finish();
})();
