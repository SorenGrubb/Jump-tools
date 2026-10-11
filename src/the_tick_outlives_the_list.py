# -*- coding: utf-8 -*-
"""The tick outlives the list, and centred is the default.                          2026-10-11

Søren: *"Even though I have ticked the dataset coordinates off, it is still not centered. Also, I
think the default should be centered and you can tick it if you need to download and open in
Blender."*

MY BUG, AND A PLAIN ONE. I put the tick inside the dataset list's innerHTML and gave it
`checked` in the markup — so the tick's state lived in the DOM, in a block that is REBUILT. And
the list rebuilds on its own: tracingOpenShared() renders what is in hand, then awaits
tracingIndexFetch() and renders again. Untick, wait for the refresh to land, press 3D model, and
the file is placed — because by then the tick had been recreated ticked and nobody had been told.

The mechanism was right and the state was in the wrong place. Measured: with no re-render in
between, unticking already produced translation [0,0,0] — which is why my own check passed and
his download did not. A check that sets a control and reads it back in the same breath never
meets the thing that breaks it.

SO THE ANSWER LIVES OUTSIDE THE DOM, and outside the session: one variable, written to
a module variable, read when the tick is drawn and written when it changes. A re-render cannot
lose it. NOT localStorage: ωJump's build refuses any key but the theme, and its reason is the
right one here too — "a half-remembered state that disagrees with what you think you did is a
debugging trap". Tick it on Monday and on Friday your downloads are placed and you have forgotten
why. It resets to centred on reload, which is the safe answer.

AND CENTRED IS THE DEFAULT, as he asked. Most downloads are looked at on their own, in whatever
opens a .glb; the dataset coordinates are for the day you are assembling several cells in Blender,
and that day you can tick.

Changes: core/tracingcard.js  (the answer in a variable; the tick reads and writes it; the wording)
Check:   glbcheck.js          (the tick survives a re-render — the thing that actually broke)
Run: python3 src/the_tick_outlives_the_list.py
     python3 src/build_stamps.py
     node glbcheck.js
"""
import io, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(rel, pairs):
    P = os.path.join(HERE, rel)
    s = io.open(P, encoding="utf-8").read(); b = s
    print(rel)
    for name, old, new in pairs:
        if new in s:
            print("  already there: " + name); continue
        n = s.count(old)
        assert n == 1, "@NM@ (@F@): @N@".replace("@NM@", name).replace(
            "@F@", os.path.basename(P)).replace("@N@", str(n))
        s = s.replace(old, new, 1); print("  ok: " + name)
    if s != b: io.open(P, "w", encoding="utf-8").write(s)


# ── 1. the answer lives outside the DOM ───────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the stored answer, and a tick that reads and writes it",
     u'''function tracingPlaceWanted(){
  var el = document.getElementById("tracingPlaceAt");
  return el ? !!el.checked : true;
}
function tracingPlaceTickHtml(){
  return '<label style="font-size:11px;color:var(--mut);margin-left:6px" title="Ticked, a 3D '
    + 'model download carries its dataset coordinates, so several cells opened in one Blender '
    + 'scene land in their true relative positions. Unticked, it is centred on itself, which is '
    + 'what a viewer that frames the origin rather than the scene — Windows 3D Viewer, Paint '
    + '3D — needs in order to show it at all.">'
    + '<input type="checkbox" id="tracingPlaceAt" checked style="width:auto;vertical-align:-1px"> '
    + 'Dataset coordinates</label>';
}''',
     u'''/* ── AND THE ANSWER LIVES OUTSIDE THE DOM ───────────────────────────  2026-10-11
   Søren: *"Even though I have ticked the dataset coordinates off, it is still not centered."*

   My bug. The tick was written into the dataset list's innerHTML with `checked` in the markup, so
   its state lived in a block that is REBUILT — tracingOpenShared() renders what is in hand, then
   awaits the index and renders again. Untick, let the refresh land, press 3D model, and the tick
   is back on with nobody told. The mechanism was right; the state was in the wrong place.

   One module variable, read when the tick is drawn and written when it changes. A re-render
   cannot lose it. NOT localStorage: \u03c9Jump refuses any key but the theme, and its reason is the
   right one here too \u2014 "a half-remembered state that disagrees with what you think you did is
   a debugging trap". Tick it on Monday, and on Friday your downloads are placed and you have
   forgotten why. It resets to centred on reload, which is the safe answer.

   CENTRED IS THE DEFAULT, as he asked: most downloads are looked at on their own, in whatever
   opens a .glb. The dataset coordinates are for the day you assemble several cells in Blender. */
var TRACING_PLACE_AT = false;
function tracingPlaceWanted(){ return !!TRACING_PLACE_AT; }
function tracingPlaceSet(on){ TRACING_PLACE_AT = !!on; }
function tracingPlaceTickHtml(){
  return '<label style="font-size:11px;color:var(--mut);margin-left:6px" title="Ticked, a 3D '
    + 'model download carries its dataset coordinates, so several cells opened in one Blender '
    + 'scene land in their true relative positions. Unticked \\u2014 the default \\u2014 it is '
    + 'centred on itself, which is what a viewer that frames the origin rather than the scene '
    + '\\u2014 Windows 3D Viewer, Paint 3D \\u2014 needs in order to show it at all. Remembered.">'
    + '<input type="checkbox" id="tracingPlaceAt"' + (tracingPlaceWanted() ? " checked" : "")
    + ' style="width:auto;vertical-align:-1px"> Dataset coordinates</label>';
}
/* Re-attached on every render, because the list it sits in is replaced wholesale. */
function tracingPlaceWire(host){
  var el = (host || document).querySelector("#tracingPlaceAt");
  if (!el || el.getAttribute("data-wired")) return;
  el.setAttribute("data-wired", "1");
  el.checked = tracingPlaceWanted();
  el.addEventListener("change", function(){ tracingPlaceSet(el.checked); });
}'''),

    (u"...and the wiring runs with the rest of the list's",
     u'''  [].slice.call(host.querySelectorAll(".tracingcellpad")).forEach(function(b){
    b.addEventListener("click", function(){ tracingOpenCellShared(sidsOf(b), b); });
  });''',
     u'''  tracingPlaceWire(host);
  [].slice.call(host.querySelectorAll(".tracingcellpad")).forEach(function(b){
    b.addEventListener("click", function(){ tracingOpenCellShared(sidsOf(b), b); });
  });'''),

    (u"the default sentence on the buttons is centred now",
     u'''var TRACING_PLACE_HELP = "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \\u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin.";''',
     u'''/* What the BUTTON says before anything is clicked: the default, which is now centred. The line
   after the click says what actually happened \\u2014 see tracingPlaceSay(). */
var TRACING_PLACE_HELP = "Centred on itself, so it opens framed in any viewer \\u2014 tick Dataset coordinates by the list if you want several of these to line up in one Blender scene.";'''),
])
_C = os.path.join(HERE, "core/tracingcard.js")
_c = io.open(_C, encoding="utf-8").read()
for _what, _n in [(u"var TRACING_PLACE_AT = false;", 1), (u"function tracingPlaceWanted(){", 1),
                  (u"function tracingPlaceSet(on){", 1), (u"function tracingPlaceWire(host){", 1),
                  (u"tracingPlaceWire(host);", 1), (u"tracingPlaceTickHtml()", 2),
                  (u'id="tracingPlaceAt"', 1),
                  (u'querySelector("#tracingPlaceAt")', 1)]:
    assert _c.count(_what) == _n, "core/tracingcard.js has %d of %s, wanted %d" % (
        _c.count(_what), _what, _n)
# NOT FROM THE DOM. The whole bug was reading the answer out of a block that gets rebuilt.
assert u'var el = document.getElementById("tracingPlaceAt");\n  return el ? !!el.checked' not in _c, \
    "tracingPlaceWanted still reads the tick out of the DOM"
assert u'checked style="width:auto;vertical-align:-1px"> '\
       u"'\n    + 'Dataset coordinates</label>'" not in _c, "the tick is still hardcoded checked"
print("done 1")

# NO NEW STORAGE KEY. The first version of this put the answer in localStorage under
# jump_place_at_dataset_v1, and ωJump's build refused it: "localStorage is only for the theme ...
# Work state belongs in the sheet: a half-remembered state that disagrees with what you think you
# did is a debugging trap." That guard is right about this too, so the answer lives in a variable
# and resets to centred on reload. storagekeycheck.js is untouched.

# ── 3. the earlier block tested the old mechanism ─────────────────────────────
# It flipped el.checked directly and read the answer straight back -- the one sequence that
# worked. Through the event now, and WIRED the way the list wires it: a tick with no listener
# is a tick nobody is told about, which was his bug in miniature.
# Written with repr() rather than triple quotes: these strings carry both kinds of quote and
# a backslash-u, and getting the quoting wrong here would be a third way to lose a day.
_PAIRS = [
    ('the tick is read through the event, and the default is centred',
     '    ok(pick.was === true,\n       "the tick is there and ticked, so the placement he asked for yesterday is still the default",\n       String(pick.was));',
     '    ok(pick.was === false,\n       "the tick is there and NOT ticked \\u2014 S\\u00f8ren: *\\u201cthe default should be centered "\n       + "and you can tick it if you need to download and open in Blender\\u201d*. Most downloads "\n       + "are looked at on their own; the dataset coordinates are for the day you assemble "\n       + "several cells", String(pick.was));'),
    ('...and the tick is wired, as the list wires it',
     '    document.body.appendChild(d);\n    const el = document.getElementById("tracingPlaceAt");',
     '    document.body.appendChild(d);\n    /* WIRED, as the list wires it. A tick with no listener is a tick nobody is told about —\n       which was the whole of his bug, in miniature. */\n    tracingPlaceWire(d);\n    const el = document.getElementById("tracingPlaceAt");'),
    ('...and it is asked for by name before it is used',
     '    if (typeof tracingPlaceTickHtml !== "function") return { missing: true };',
     '    if (typeof tracingPlaceTickHtml !== "function"\n        || typeof tracingPlaceWire !== "function") return { missing: true };'),
    ('...and set through the event rather than by assignment',
     '    const on = run();\n    el.checked = false;\n    const off = run();\n    el.checked = true;\n    const back = run();\n    d.remove();\n    return { was: was, on: on, off: off, back: back };',
     '    /* THROUGH THE EVENT A CLICK FIRES, not by assigning .checked. The answer now lives in\n       storage, and setting the box without telling anybody is exactly the state that used to\n       look fine here and fail for him \\u2014 see the re-render section below. */\n    const set = (v) => { el.checked = v; el.dispatchEvent(new Event("change", { bubbles: true })); };\n    const off = run();\n    set(true);\n    const on = run();\n    set(false);\n    const back = run();\n    d.remove();\n    return { was: was, on: on, off: off, back: back };'),
    ('...and unticking puts it back where it was',
     '    ok(Math.max.apply(null, (pick.on.glb || []).map(Math.abs)) > 100\n       && pick.on.py !== "0,0,0" && pick.back.py === pick.on.py,\n       "ticked, both are placed again — a choice, not a retreat",\n       JSON.stringify(pick.on.glb) + " / " + String(pick.on.py));',
     '    ok(Math.max.apply(null, (pick.on.glb || []).map(Math.abs)) > 100\n       && pick.on.py !== "0,0,0" && pick.back.py === pick.off.py,\n       "ticked, both are placed — a choice, not a retreat; and unticking again puts them back "\n       + "where they were", JSON.stringify(pick.on.glb) + " / " + String(pick.on.py));'),
]
edit("glbcheck.js", _PAIRS)

# ── 4. and the sequence he actually lived ──────────────────────────────────
CHK = '\n  /* ── AND THE TICK OUTLIVES THE LIST IT SITS IN ────────────────────────────────  2026-10-11\n     Søren: *"Even though I have ticked the dataset coordinates off, it is still not centered."*\n\n     My bug, and the check above could not have caught it: it set the tick and read it back in the\n     same breath, which is the one sequence that works. The tick\'s state lived in the dataset\n     list\'s innerHTML — and that list is REBUILT, by tracingOpenShared(), which renders what is in\n     hand and then renders again once the index lands. Untick, let the refresh arrive, press 3D\n     model, and the file is placed, because the tick had been recreated ticked and nobody was told.\n\n     SO THE ASSERTION IS THE SEQUENCE HE LIVED: untick, re-render the real list, then ask. The\n     answer now lives in a module variable, which a re-render cannot reach. */\n  console.log("\\nand the tick outlives the list it sits in");\n  const kept = await p.evaluate(async () => {\n    if (typeof tracingGlbSave !== "function") return { noCard: true };\n    if (typeof tracingRenderShared !== "function") return { noList: true };\n    /* A FAILURE, NOT AN EXCUSE: on a page with the card and the list, the tick\'s answer must\n       live somewhere a re-render cannot reach. */\n    if (typeof tracingPlaceWire !== "function"\n        || typeof tracingPlaceWanted !== "function") return { noTick: true };\n    const sq = (z, cx, cy, h) => ({ z: z,\n      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });\n    const rings = [];\n    for (let z = 400; z <= 406; z++) rings.push(sq(z, 400000, 230000, 250));\n    window.TRACING_SHARED = TRACING_SHARED = [{ structureId: "s1", name: "Whole cell",\n      kind: "cell", instanceOf: "cell", color: "#cddc39", nucleusId: "", rootId: "",\n      cellCoord: "234624,228032,17512", contours: 7, sections: 7, versions: 1,\n      tracedBy: "me", timestamp: "2026-10-11" }];\n    tracingRenderShared();\n    const el0 = document.getElementById("tracingPlaceAt");\n    if (!el0) return { noTick: true };\n    /* TICK IT ON, through the event a person\'s click fires. */\n    el0.checked = true;\n    el0.dispatchEvent(new Event("change", { bubbles: true }));\n    const onBefore = tracingPlaceWanted();\n    tracingRenderShared();                      /* the refresh he waited through */\n    const onAfter = tracingPlaceWanted();\n    const onBox = !!document.getElementById("tracingPlaceAt").checked;\n    /* ...and off again, which is the direction that failed him. */\n    const el1 = document.getElementById("tracingPlaceAt");\n    el1.checked = false;\n    el1.dispatchEvent(new Event("change", { bubbles: true }));\n    tracingRenderShared();\n    const offAfter = tracingPlaceWanted();\n    const offBox = !!document.getElementById("tracingPlaceAt").checked;\n    /* And what the download actually does, after that re-render — the only thing he can see. */\n    let saved = null;\n    window.tracingSaveBlob = tracingSaveBlob = function(blob){ saved = blob; };\n    window.tracingFetchCell = tracingFetchCell = async function(sids){\n      return sids.map(s => ({ sid: s, t: { color: "#cddc39", kind: "cell" },\n        st: { name: "Whole cell", kind: "cell", rings: rings } }));\n    };\n    const btn = document.querySelector(".tracingcellglb");\n    if (btn) btn.click();\n    const t0 = Date.now();\n    while (Date.now() - t0 < 8000 && !saved) await new Promise(r => setTimeout(r, 100));\n    let tx = null;\n    if (saved){\n      const u8 = new Uint8Array(await saved.arrayBuffer());\n      const dv = new DataView(u8.buffer);\n      const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));\n      tx = (j.nodes[0] || {}).translation || null;\n    }\n    return { onBefore, onAfter, onBox, offAfter, offBox, tx, pressed: !!btn };\n  });\n  if (kept.noCard) console.log("  (no tracing card on this page)");\n  else if (kept.noList) console.log("  (no dataset list on this page)");\n  else if (kept.noTick)\n    ok(false, "the tick\'s answer lives outside the list it sits in",\n       "tracingPlaceWire is not here \\u2014 the answer is still in the DOM");\n  else {\n    ok(kept.onBefore === true && kept.onAfter === true && kept.onBox === true,\n       "ticked ON, the choice survives a re-render of the list — both the answer and the box, "\n       + "because a box that disagrees with the answer is the next bug",\n       "answer " + kept.onAfter + ", box " + kept.onBox);\n    ok(kept.offAfter === false && kept.offBox === false,\n       "...and ticked OFF it survives too, which is the direction that failed him: untick, the "\n       + "index lands, the list is rebuilt, and the old tick came back ticked",\n       "answer " + kept.offAfter + ", box " + kept.offBox);\n    ok(kept.pressed && kept.tx && Math.max.apply(null, kept.tx.map(Math.abs)) === 0,\n       "...so the download made AFTER that re-render is centred, which is the only part of this "\n       + "he can see", kept.pressed ? JSON.stringify(kept.tx) : "no cell button to press");\n  }\n'
OLD = '\n  /* \\u2500\\u2500 AND A FORM THAT NEEDS NO IMPORTER AT ALL \\u2500\\u2500'
_G = os.path.join(HERE, "glbcheck.js")
if u"the tick outlives the list it sits in" in io.open(_G, encoding="utf-8").read():
    print("glbcheck.js\n  already there: the tick outlives the list it sits in")
else:
    edit("glbcheck.js", [(u"the tick outlives the list it sits in", OLD, CHK + OLD)])
_g = io.open(_G, encoding="utf-8").read()
assert _g.count(u"and the tick outlives the list it sits in") == 1, "two of the new block"
assert u"pick.was === true" not in _g, "glbcheck.js still expects the old default"
print("done 3")
print("all applied")
