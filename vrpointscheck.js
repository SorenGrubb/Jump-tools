/* vrpointscheck.js — the "+ VR" that sends a panel's points to the viewer.         2026-10-23
   ─────────────────────────────────────────────────────────────────────────────────────────────
   Søren asked for this on 2026-10-15 and it was never wired. core/vrbasket.js grew merge() and
   the syn/marks row shapes, vr.html grew the drawing and kept them in a saved scene, the tray grew
   advice about points — and no page in the tree ever called merge(). Eight days of a feature that
   existed at both ends and nowhere in the middle.

   SO THE FIRST ASSERTION HERE IS THE ONE THAT WOULD HAVE CAUGHT IT: merge() has callers. An
   exported function with no callers is the shape this bug had, and nothing else in this repository
   was looking for it.

   WHY STATIC. ujump.html is 14.5 MB and takes the headless renderer down, so these panels cannot
   be driven here; and even in a working browser they need a CAVE token and live network, which is
   not something a check should be holding. What CAN be checked without either is that the buttons
   exist, that they start disabled, that something enables them only when that panel has results,
   and — the part that actually matters — that the rows each one builds have the SHAPE
   core/vrbasket.js documents and vr.html reads. A six-field syn row with the direction in the
   wrong column draws silently wrong things.

   Run: node vrpointscheck.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const page_ = require("./pagepath.js");

const R = [];
const ok = (n, c, d) => { R.push(!!c);
  console.log((c ? "PASS " : "*** FAIL *** ") + n + (d !== undefined ? "  <- " + d : "")); };

const UJ = page_("ujump.html");
const ROOT = path.dirname(UJ);
const uj = fs.readFileSync(UJ, "utf8");
const basket = fs.readFileSync(path.join(ROOT, "core", "vrbasket.js"), "utf8");
const vrPath = path.join(ROOT, "vr.html");
const vr = fs.existsSync(vrPath) ? fs.readFileSync(vrPath, "utf8") : null;

console.log("--- the middle of the feature exists at all ---");
/* THE ASSERTION THIS FILE IS FOR. */
const callers = (uj.match(/UJ\.vrbasket\.merge\(/g) || []).length
              + (uj.match(/ujVrPoints\(\{/g) || []).length;
ok("something actually calls the basket's merge()", callers >= 3,
   callers + " call site(s) — one helper plus the panels that use it");
ok("...and the basket still offers it", /function merge\(/.test(basket)
   && /merge: merge/.test(basket));
ok("...and vr.html still reads what it stores",
   !vr || (/c\.syn/.test(vr) && /c\.marks/.test(vr)),
   vr ? "reads c.syn and c.marks" : "vr.html not in this tree");

console.log("\n--- a button in each of the three panels ---");
const PANELS = [
  ["Connectivity", 'id="connVR"', '#connVR', "synaptic partners"],
  ["Cell contacts", `id="'+uid+'_vr"`, "uid+\"_vr\"", "mesh proximity"],
  ["Astrocyte–synapse proximity", `id="'+uid+'_vr"`, "uid+\"_vr\"", "tripartite proxy"],
];
const vrBtns = (uj.match(/\u{1F97D} \+ VR<\/button>/gu) || []).length;
ok("there are three of them, and they all say the same thing", vrBtns === 3,
   vrBtns + " “+ VR” buttons");
/* DISABLED UNTIL THERE IS SOMETHING TO SEND. A button that looks pressable before the panel has
   run would put an empty entry in somebody's collection and say it worked. */
/* `[^>]*?` CANNOT CROSS THE OPENING TAG'S OWN ">", so the first version of this matched nothing
   and then `[].every(...)` reported every button as carrying a title -- the vacuous-assertion
   trap, in a file written to catch somebody else's. Both assertions now require three tags. */
const btnTags = uj.match(/<button [^<]*?\u{1F97D} \+ VR<\/button>/gu) || [];
ok("...each shipping disabled",
   btnTags.length === 3 && btnTags.every(b => /\bdisabled\b/.test(b)),
   btnTags.length + " tag(s) read, "
   + btnTags.filter(b => !/\bdisabled\b/.test(b)).length + " enabled at rest");
ok("...and each carrying an explanation on hover",
   btnTags.length === 3 && btnTags.every(b => /title="[^"]{60,}"/.test(b)),
   btnTags.map(b => ((b.match(/title="([^"]*)"/) || [])[1] || "").length + " chars").join(", ")
   || "no tags read");
/* ...and something turns each one on, keyed to that panel having results. */
ok("...and each is enabled only once its panel has results",
   /connVRBtn\.disabled=!connVRPayload\.syn\.length/.test(uj)
   && /vrBtn\.disabled=!results\.some\(r=>\(r\.touchPoints\|\|\[\]\)\.length\)/.test(uj)
   && /if\(vrBtn\)vrBtn\.disabled=!results\.length/.test(uj),
   "one enabling per panel, each reading that panel's own result set");

console.log("\n--- the rows have the shape both ends agreed on ---");
/* core/vrbasket.js's header is the contract; it is read here rather than restated, so a change
   to it fails this instead of silently disagreeing with it. */
const synDoc = /syn:\s*\[\[x, y, z, dir, partnerRoot, partnerType\]/.test(basket);
const markDoc = /marks:\s*\[\[x, y, z, kind, label\]/.test(basket);
ok("the basket still documents the two row shapes", synDoc && markDoc,
   (synDoc ? "syn ok" : "syn CHANGED") + ", " + (markDoc ? "marks ok" : "marks CHANGED"));
/* Six fields, direction in the fourth, 0 = input — the one ordering mistake that would draw
   every input synapse as an output and never throw. */
const synRows = uj.match(/\[\s*\n?\s*p\.pos\[0\],p\.pos\[1\],p\.pos\[2\],p\.direction==="input"\?0:1,/g)
             || uj.match(/p\.pos\[0\],p\.pos\[1\],p\.pos\[2\],p\.direction==="input"\?0:1/g) || [];
ok("Connectivity builds syn rows with the direction in the fourth column and 0 for input",
   synRows.length === 1, synRows.length + " such row builder(s)");
ok("...and fills partnerType rather than leaving it blank",
   /typeByRoot=new Map\(allPartners\.map\(p=>\[String\(p\.partner\),p\.cell_type\|\|""\]\)\)/.test(uj)
   && /typeByRoot\.get\(String\(p\.partner\)\)\|\|""/.test(uj),
   "from allPartners' own cell_type lookup");
ok("Cell contacts builds marks of kind “contact”",
   /push\(\[v\[0\],v\[1\],v\[2\],"contact",/.test(uj));
ok("Astrocyte–synapse proximity builds BOTH — the synapse and the astrocyte's point",
   /syn\.push\(\[r\.pos\[0\],r\.pos\[1\],r\.pos\[2\],r\.direction==="input"\?0:1/.test(uj)
   && /marks\.push\(\[r\.astro\.touchVoxel\[0\]/.test(uj)
   && /"astro",/.test(uj),
   "a tripartite candidate is a synapse and a mark a few tens of nm apart");
/* The astrocyte point is r.astro.touchVoxel and nothing else: distNm is a distance, rootId an id,
   and either of them in a coordinate slot would put a point at the origin. */
ok("...using the astrocyte's touch point, not its id or its distance",
   !/marks\.push\(\[r\.astro\.(rootId|nucleusId|distNm)/.test(uj));

console.log("\n--- it takes, and never fetches ---");
/* The whole reason these buttons are cheap: each panel has already done the work for its own
   Neuroglancer view. A fetch here would make "+ VR" a second, slower copy of the Check button. */
const helper = (uj.match(/function ujVrPoints\(o\)\{[\s\S]*?\n\}/) || [""])[0];
ok("the helper exists and is one function", helper.length > 200, helper.length + " chars");
ok("...and fetches nothing", !/fetch\(|XMLHttpRequest|caveApiQuery/.test(helper));
ok("...and reports what happened rather than failing silently",
   /ujVrPointsSay\(/.test(helper) && /refused to store it/.test(uj),
   "says added-or-merged, and says so when localStorage refuses");
/* merge(), not add(): pressing + VR on the cell and then again in a panel has to give one cell
   carrying its points, not two entries or a refusal. */
ok("...and merges rather than adding, so a cell gains its points",
   /UJ\.vrbasket\.merge\(entry\)/.test(helper) && !/vrbasket\.add\(/.test(helper));

const bad = R.filter(x => !x).length;
console.log("\n" + (bad ? "*** " + bad + " of " + R.length + " FAILED ***"
                        : "RESULT: ALL " + R.length + " CHECKS PASSED"));
process.exit(bad ? 1 : 0);
