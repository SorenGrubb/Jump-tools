# -*- coding: utf-8 -*-
r"""Placed or centred is asked, not remembered.                                     2026-10-12

Søren, of the two controls above the dataset list: *"These are also not clear what their function
is. Perhaps it should be a choice you make when you click the 3D model button whether you want it
ready for Blender or as a standalone model?"*

A TICK IS A SETTING FOR WHAT IS A DECISION. It sits between presses holding an answer to a question
nobody asked it today, and the state is invisible at the moment it matters -- the press. That is
not a hypothetical: the same tick, written into the list's markup, came back on after a re-render
and handed him a file he had not asked for (src/the_tick_outlives_the_list.py). Moving its state
out of the DOM fixed the bug and left the shape: a control you have to remember having set.

So the press asks. Two answers, named by what they are FOR rather than by what they do to the
coordinates -- "centred on itself" for a viewer that frames the origin, "at its dataset
coordinates" for several cells in one Blender scene. The Blender script asks the same question and
takes the same answer, because two downloads of one cell that disagree about where it is are worse
than either position.

AND NOTHING IS REMEMBERED BETWEEN PRESSES, deliberately. ωJump's build guard refuses browser
storage with a sentence that is just as true of a downloaded file: *"a half-remembered state that
disagrees with what you think you did is a debugging trap."* The cost is one extra click; the first
answer is focused, so Enter takes it.

DISMISSING DOWNLOADS NOTHING. Escape, or a click elsewhere, and no file is written -- the one thing
a tick could never get wrong, because it never asked, and the one thing a menu gets wrong by
treating dismissal as the default.

THE MENU IS FIXED-POSITION ON <body>, not appended beside the button. Those buttons live inside a
<summary> inside a flex row inside a <details>: a popover there is clipped by the row, wrapped by
the flex, and its clicks run through the summary's fold handler. One element on the body, placed
from the button's rectangle and clamped to the window, has none of those arguments to lose.

Changes: core/tracingcard.js
Check:   tracingplacecheck.js (new); the two tick sections of glbcheck.js are superseded
Run: python3 src/placed_or_centred_is_asked_not_remembered.py
     node tracingplacecheck.js && node glbcheck.js
"""
import io, os, re
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


# ── the menu replaces the tick, in the same place in the file ────────────────────────────────
OLD_TICK = r'''var TRACING_PLACE_AT = false;
function tracingPlaceWanted(){ return !!TRACING_PLACE_AT; }
function tracingPlaceSet(on){ TRACING_PLACE_AT = !!on; }
function tracingPlaceTickHtml(){
  return '<label style="font-size:11px;color:var(--mut);margin-left:6px" title="Ticked, a 3D '
    + 'model download carries its dataset coordinates, so several cells opened in one Blender '
    + 'scene land in their true relative positions. Unticked \u2014 the default \u2014 it is '
    + 'centred on itself, which is what a viewer that frames the origin rather than the scene '
    + '\u2014 Windows 3D Viewer, Paint 3D \u2014 needs in order to show it at all. Remembered.">'
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
}
function tracingPlaceSay(){
  return tracingPlaceWanted()
    ? "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin."
    : "Centred on itself, so it opens framed in any viewer \u2014 tick Dataset coordinates above if you want several of these to line up in one scene.";
}
/* What the BUTTON says before anything is clicked: the default, which is now centred. The line
   after the click says what actually happened \u2014 see tracingPlaceSay(). */
var TRACING_PLACE_HELP = "Centred on itself, so it opens framed in any viewer \u2014 tick Dataset coordinates by the list if you want several of these to line up in one Blender scene.";'''

NEW_MENU = r'''/* ── ASKED AT THE PRESS, NOT SET IN ADVANCE ─────────────────────────  2026-10-12
   Søren: *"Perhaps it should be a choice you make when you click the 3D model button whether you
   want it ready for Blender or as a standalone model?"*

   A tick was a setting for what is a decision: it held an answer between presses to a question
   nobody had asked it today, and its state was invisible at the moment it mattered. Moving that
   state out of the DOM, yesterday, fixed the bug it caused and left the shape.

   NOTHING IS REMEMBERED. One extra click, and the first answer is focused so Enter takes it. The
   reason is ωJump's, about storage: a half-remembered state that disagrees with what you think you
   did is a debugging trap, and a .glb in your Downloads folder is exactly that kind of state.

   ON THE BODY, FIXED. These buttons live in a <summary> in a flex row in a <details>; a popover
   appended beside one is clipped by the row, wrapped by the flex, and has its clicks read by the
   fold handler. One element on the body, placed from the button's rectangle, has none of that. */
var TRACING_PLACE_MENU = null;
function tracingPlaceMenuClose(answer){
  var m = TRACING_PLACE_MENU;
  TRACING_PLACE_MENU = null;
  if (!m) return;
  document.removeEventListener("keydown", m.onKey, true);
  document.removeEventListener("mousedown", m.onOut, true);
  window.removeEventListener("resize", m.onGone, true);
  window.removeEventListener("scroll", m.onGone, true);
  if (m.el && m.el.parentNode) m.el.parentNode.removeChild(m.el);
  try { if (m.btn && m.btn.isConnected) m.btn.focus(); } catch (_e){}
  /* NULL IS NOT FALSE. "Centred" and "I changed my mind" are different answers, and a caller that
     cannot tell them apart downloads a file for somebody who pressed Escape. */
  m.done(answer === undefined ? null : answer);
}
function tracingPlaceAsk(btn){
  return new Promise(function(done){
    tracingPlaceMenuClose();
    var el = document.createElement("div");
    el.id = "tracingPlaceMenu";
    el.className = "tracingplacemenu";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Where should this 3D model sit?");
    el.style.cssText = "position:fixed;z-index:9999;max-width:360px;padding:8px;border-radius:9px;"
      + "border:1px solid var(--line,#2a3550);background:var(--bg2,#131a2b);"
      + "box-shadow:0 10px 28px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:5px";
    var one = function(v, title, why){
      return '<button type="button" class="idbtn tracingplacepick" data-place="' + v + '" '
        + 'style="display:block;width:100%;text-align:left;padding:6px 9px;font-size:12px;'
        + 'line-height:1.35"><b style="font-weight:600">' + title + '</b>'
        + '<span style="display:block;opacity:.72;font-size:11px">' + why + '</span></button>';
    };
    el.innerHTML = '<div style="font-size:11px;color:var(--mut,#8b96a8);padding:0 3px 1px">'
        + 'Where should it sit?</div>'
      + one(0, "Centred on itself",
            "opens framed in any viewer \u2014 Windows 3D Viewer, Paint 3D")
      + one(1, "At its dataset coordinates",
            "so several of these line up in one Blender scene");
    document.body.appendChild(el);
    /* Under the button, nudged back inside the window rather than off the edge of it. */
    var r = btn ? btn.getBoundingClientRect() : { left: 20, bottom: 20, top: 20 };
    var w = el.offsetWidth || 300, h = el.offsetHeight || 90;
    var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    var top = (r.bottom + h + 8 <= window.innerHeight) ? (r.bottom + 5)
                                                       : Math.max(8, r.top - h - 5);
    el.style.left = left + "px"; el.style.top = top + "px";

    var m = { el: el, btn: btn, done: done };
    m.onKey = function(e){ if (e.key === "Escape"){ e.preventDefault(); tracingPlaceMenuClose(); } };
    m.onOut = function(e){ if (!el.contains(e.target)) tracingPlaceMenuClose(); };
    m.onGone = function(){ tracingPlaceMenuClose(); };
    TRACING_PLACE_MENU = m;
    document.addEventListener("keydown", m.onKey, true);
    document.addEventListener("mousedown", m.onOut, true);
    window.addEventListener("resize", m.onGone, true);
    window.addEventListener("scroll", m.onGone, true);
    [].slice.call(el.querySelectorAll(".tracingplacepick")).forEach(function(bb){
      bb.addEventListener("click", function(e){
        e.preventDefault(); e.stopPropagation();
        tracingPlaceMenuClose(bb.dataset.place === "1");
      });
    });
    try { el.querySelector(".tracingplacepick").focus(); } catch (_e2){}
  });
}
function tracingPlaceSay(place){
  return place
    ? "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin."
    : "Centred on itself, so it opens framed in any viewer \u2014 press 3D model again and choose dataset coordinates if you want several of these to line up in one scene.";
}
/* What the BUTTON says before it is pressed. It no longer has a default to describe: it asks. */
var TRACING_PLACE_HELP = "You choose when you press it: centred on itself, so it opens framed in any viewer, or at its dataset coordinates, so several line up in one Blender scene.";'''

edit("core/tracingcard.js", [(u"the menu replaces the tick", OLD_TICK, NEW_MENU)])

# ── the two writers take the answer rather than reading a global ─────────────────────────────
edit("core/tracingcard.js", [
    (u"tracingPySave is told where to put it",
     u'''function tracingPySave(parts, filename, title){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var txt = UJ.traceloft.blenderPy(parts, res, { title: title || "", file: filename,
                                                 place: tracingPlaceWanted() });''',
     u'''function tracingPySave(parts, filename, title, place){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var txt = UJ.traceloft.blenderPy(parts, res, { title: title || "", file: filename,
                                                 place: !!place });'''),
    (u"...and so is tracingGlbSave",
     u'''function tracingGlbSave(parts, filename){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var bytes = UJ.traceloft.glb(parts, res, { place: tracingPlaceWanted() });''',
     u'''function tracingGlbSave(parts, filename, place){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var bytes = UJ.traceloft.glb(parts, res, { place: !!place });'''),
])

# ── the two buttons ask first ────────────────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"one tracing asks before it meshes",
     u'''async function tracingOneGlb(sid, btn, fmt){
  var label = btn ? btn.innerHTML : "";
  try {''',
     u'''async function tracingOneGlb(sid, btn, fmt){
  /* ASKED BEFORE ANYTHING IS FETCHED, so changing your mind costs nothing at all — not a
     download, not a read of somebody's Drive. */
  var place = await tracingPlaceAsk(btn);
  if (place === null) return;
  var label = btn ? btn.innerHTML : "";
  try {'''),
    (u"...and passes the answer to whichever writer",
     u'''    var n = (fmt === "py") ? tracingPySave(parts, base + "_blender.py", parts[0].name)
                           : tracingGlbSave(parts, base + ".glb");''',
     u'''    var n = (fmt === "py") ? tracingPySave(parts, base + "_blender.py", parts[0].name, place)
                           : tracingGlbSave(parts, base + ".glb", place);'''),
    (u"...and says which it did",
     u'''                    : "Saved " + parts[0].name + " as a 3D model (GLB, micrometres). "
                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay()''',
     u'''                    : "Saved " + parts[0].name + " as a 3D model (GLB, micrometres). "
                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay(place)'''),
    (u"a whole cell asks before it meshes",
     u'''async function tracingCellGlb(g, btn, fmt){
  if (!g || !g.items.length) return;
  var label = btn ? btn.innerHTML : "";''',
     u'''async function tracingCellGlb(g, btn, fmt){
  if (!g || !g.items.length) return;
  var place = await tracingPlaceAsk(btn);
  if (place === null) return;
  var label = btn ? btn.innerHTML : "";'''),
    (u"...and passes it on",
     u'''    var n = (fmt === "py") ? tracingPySave(parts, cell + "_um_blender.py", title)
                           : tracingGlbSave(parts, cell + "_um.glb");''',
     u'''    var n = (fmt === "py") ? tracingPySave(parts, cell + "_um_blender.py", title, place)
                           : tracingGlbSave(parts, cell + "_um.glb", place);'''),
    (u"...and says which it did too",
     u'''      + " Micrometres. " + tracingPlaceSay()''',
     u'''      + " Micrometres. " + tracingPlaceSay(place)'''),
])

# ── and the list stops drawing the tick ──────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the label loses the tick",
     u'''    + '<label id="tracingSharedLabel">In the dataset, by person and cell — open one to add to it '
    + 'or correct it' + tracingPlaceTickHtml() + '</label>\'''',
     u'''    + '<label id="tracingSharedLabel">In the dataset, by person and cell — open one to add to it '
    + 'or correct it</label>\''''),
])

_P = os.path.join(HERE, "core/tracingcard.js")
_s = io.open(_P, encoding="utf-8").read()
if u"  tracingPlaceWire(host);\n" in _s:
    _s = _s.replace(u"  tracingPlaceWire(host);\n", u"", 1)
    io.open(_P, "w", encoding="utf-8").write(_s)
    print("  ok: the render stops wiring the tick")
else:
    print("  already there: the render stops wiring the tick")

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_s = io.open(_P, encoding="utf-8").read()
for _gone in [u"TRACING_PLACE_AT", u"tracingPlaceWanted", u"tracingPlaceSet",
              u"tracingPlaceTickHtml", u"tracingPlaceWire", u"tracingPlaceAt"]:
    assert _gone not in _s, "%s survives in core/tracingcard.js" % _gone
for _what, _n in [(u"function tracingPlaceAsk(btn){", 1),
                  (u"function tracingPlaceMenuClose(answer){", 1),
                  (u"function tracingPlaceSay(place){", 1),
                  (u"var place = await tracingPlaceAsk(btn);", 2),
                  (u"if (place === null) return;", 2),
                  # three: the definition's own signature is one of them
                  (u"tracingPlaceSay(place)", 3),
                  (u"function tracingPySave(parts, filename, title, place){", 1),
                  (u"function tracingGlbSave(parts, filename, place){", 1)]:
    assert _s.count(_what) == _n, "%d of %r, wanted %d" % (_s.count(_what), _what, _n)
# BOTH WRITERS, ONE ANSWER. A call that still passed no place would silently centre everything,
# which looks like working software until the day two cells have to line up.
for _call in [u"tracingPySave(parts, base", u"tracingGlbSave(parts, base",
              u"tracingPySave(parts, cell", u"tracingGlbSave(parts, cell"]:
    _m = re.search(re.escape(_call) + r"[^\n]*", _s)
    assert _m and "place" in _m.group(0), "no place in: %r" % (_m and _m.group(0))
print("done")

# ── and the checks that pressed the tick ─────────────────────────────────────────────────────
# Two sections of glbcheck.js owned the tick: one set it and read the writers back, one unticked
# it, re-rendered the list and pressed the button. Both are gone, and their subject moved to
# tracingplacecheck.js, which can press the thing that now exists. What stays here is the half
# that is about the FILE rather than about the question: both writers, both answers, no card.
NEW_SECTION = u'''  /* \\u2500\\u2500 PLACED OR CENTRED, IN THE FILE \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500  2026-10-12
     S\\u00f8ren, of a cell opened in Windows 3D Viewer: *"it is not centered... can we do something
     so that it is centered when opening alone but has the correct coordinate when opening in
     Blender?"* \\u2014 and then, of the tick that answered it: *"Perhaps it should be a choice you
     make when you click the 3D model button?"*

     THE QUESTION MOVED TO tracingplacecheck.js, which presses the menu, dismisses it, and checks
     that nothing is downloaded when you change your mind. What belongs here is the half about the
     file: one option, honoured the same way by both writers. Two downloads of one cell that
     disagree about where it is are worse than either position, and only this can see both. */
  console.log("\\nand placed or centred is one option, honoured by both writers");
  const place = await p.evaluate(() => {
    const sq = (z, cx, cy, h) => ({ z: z,
      points: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] });
    const rings = [];
    for (let z = 400; z <= 406; z++) rings.push(sq(z, 400000, 230000, 250));
    const parts = [{ name: "Whole cell", rings: rings, color: "#cddc39", alpha: 0.3 }];
    const res = [4, 4, 40];
    const tx = (u8) => {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));
      return (j.nodes[0] || {}).translation || [0, 0, 0];
    };
    const loc = (py) => (py.match(/_add\\('Whole cell',[^[]*?,\\s*\\(([-0-9.,]+)\\),\\s*\\[/) || [])[1];
    const run = (p2) => ({ glb: tx(UJ.traceloft.glb(parts, res, { place: p2 })),
                           py: loc(UJ.traceloft.blenderPy(parts, res, { title: "t", place: p2 })) });
    return { off: run(false), on: run(true),
             /* Omitted entirely, which is what every other caller of these two writers does. */
             bare: { glb: tx(UJ.traceloft.glb(parts, res)),
                     py: loc(UJ.traceloft.blenderPy(parts, res, { title: "t" })) },
             say: (typeof tracingPlaceSay === "function")
                  ? { on: tracingPlaceSay(true), off: tracingPlaceSay(false) } : null };
  });
  ok(Math.max.apply(null, place.off.glb.map(Math.abs)) === 0 && place.off.py === "0,0,0",
     "centred puts BOTH at the origin \\u2014 which is the whole of what a viewer that frames the "
     + "origin rather than the scene needs in order to show it at all",
     JSON.stringify(place.off.glb) + " / " + place.off.py);
  ok(Math.max.apply(null, place.on.glb.map(Math.abs)) > 100 && place.on.py !== "0,0,0",
     "...and placed puts both where the cell is",
     JSON.stringify(place.on.glb) + " / " + place.on.py);
  ok(place.bare.glb.join(",") === place.on.glb.join(",") && place.bare.py === place.on.py,
     "...and the WRITER'S own default, with no option passed, is PLACED \\u2014 it writes the "
     + "geometry where the geometry is, and centring is the simplification a caller asks for. "
     + "Worth pinning down because the card's default is the other one: the card always passes "
     + "an answer, and the day it stops, this says which way it will fall",
     JSON.stringify(place.bare.glb) + " / " + place.bare.py);
  if (place.say)
    ok(/dataset coordinates/i.test(place.say.on) && /[Cc]entred on itself/.test(place.say.off)
       && place.say.on !== place.say.off,
       "...and the line afterwards says which it did, because a file whose position you cannot "
       + "predict is worse than either position", place.say.off.slice(0, 70));

'''
_G = os.path.join(HERE, "glbcheck.js")
_g = io.open(_G, encoding="utf-8").read()
_START = u"  /* ── PLACED OR CENTRED IS HIS TO CHOOSE"
_END = u"  /* ── A SURFACE RATHER THAN A STACK OF PLATES"
if u"and placed or centred is one option, honoured by both writers" in _g:
    print("glbcheck.js\n  already there: the two tick sections are superseded")
else:
    _i, _j = _g.index(_START), _g.index(_END)
    assert _i < _j, "section markers out of order"
    _g = _g[:_i] + NEW_SECTION + _g[_j:]
    io.open(_G, "w", encoding="utf-8").write(_g)
    print("glbcheck.js\n  ok: the two tick sections are superseded by one about the file")

# ── and the sections that call the buttons must answer the menu ──────────────────────────────
_g = io.open(_G, encoding="utf-8").read()
_STUB = u'''    /* THE QUESTION IS NOT THIS SECTION'S SUBJECT. tracingCellGlb now asks where to put the
       model and waits for an answer; with nobody to click, an await here never returns and the
       whole file hangs rather than failing. Answered "centred", which is what it used to do.
       The menu itself is pressed in tracingplacecheck.js. */
    if (typeof tracingPlaceAsk === "function")
      window.tracingPlaceAsk = tracingPlaceAsk = async function(){ return false; };
'''
_n = 0
for _anchor in [u'''    window.tracingSaveBlob = tracingSaveBlob = function(){};
    await tracingCellGlb({ nuc: "405191",''',
                u'''    window.tracingSaveBlob = tracingSaveBlob = function(){};
    window.tracingSay = tracingSay = function(t){ said = String(t || ""); };''']:
    if _STUB.split("\n")[-2] in _g[max(0, _g.find(_anchor) - 600):_g.find(_anchor) + 10]:
        continue
    assert _g.count(_anchor) == 1, "anchor %d" % _g.count(_anchor)
    _g = _g.replace(_anchor, _STUB + _anchor, 1); _n += 1
if _n:
    io.open(_G, "w", encoding="utf-8").write(_g)
    print("  ok: %d section(s) answer the menu so they can go on testing what they test" % _n)
else:
    print("  already there: the sections answer the menu")

_g = io.open(_G, encoding="utf-8").read()
for _gone in [u"tracingPlaceTickHtml", u"tracingPlaceWire", u"tracingPlaceWanted",
              u"tracingPlaceSet", u"tracingPlaceAt"]:
    assert _gone not in _g, "glbcheck.js still reaches for %s" % _gone
assert _g.count(u"window.tracingPlaceAsk = tracingPlaceAsk") == 2, _g.count(
    u"window.tracingPlaceAsk = tracingPlaceAsk")
print("done 2")
print("all applied")
