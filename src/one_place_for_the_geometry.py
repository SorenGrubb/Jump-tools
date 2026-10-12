# -*- coding: utf-8 -*-
r"""One place for the geometry.                                                     2026-10-12

Søren, an hour after the placement menu: *"if there is no problem with showing the 3D model
centered in the downloaded file viewer, then why do we still have two options? That complicates
things. In that case, we only need the option with the dataset coordinates."*

HE IS RIGHT, AND THE REASON MATTERS. The centred option existed to answer one symptom, on
2026-10-11: *"the 3D model in the tracing dataset looks empty because it is not centered."* We
read that as "this viewer frames the origin rather than the scene" and built a choice around it.

The same day we found the NUCLEUS UNIT BUG: scaleToNm: 1 against core/nucmesh.js, which returns
micrometres. A nucleus 1000× too far out put a 930 µm bounding box around a 200 µm cell — and a
viewer that frames the CONTENT then shows a mostly empty room with a speck in it. That is the
empty room, and it was fixed in src/a_module_says_its_own_unit.py.

AND HIS OWN TEST SETTLES IT. Today he downloaded the same cell placed 876 µm from the origin and it
displayed normally. If his viewer framed the origin, that file would have been the empty room. It
frames the content. So the two options were a fix for something that had already been fixed
somewhere else, and the price was a click on every download and a question with no wrong answer.

ONE OPTION: the geometry goes where the geometry is. Several cells line up without anybody choosing
anything, the download is one press again, and the line afterwards still reports the Location —
that part earned its place this morning and stays.

THE WRITERS KEEP opts.place. It is a legitimate option of a file writer, it is what makes the
"placed" path testable against a centred one in glbcheck.js, and it is one branch. What goes is the
question: the card has an answer and does not need to ask for it.

Changes: core/tracingcard.js
Check:   tracingplacecheck.js (superseded — it now asserts there is nothing to ask)
Run: python3 src/one_place_for_the_geometry.py
     node tracingplacecheck.js && node glbcheck.js
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


# ── the menu goes, and what is left says one thing ───────────────────────────────────────────
_P = os.path.join(HERE, "core/tracingcard.js")
_s = io.open(_P, encoding="utf-8").read()

NEWBLOCK = u'''/* ── ONE PLACE FOR THE GEOMETRY ────────────────────  2026-10-12
   Søren: *"if there is no problem with showing the 3D model centered in the downloaded file
   viewer, then why do we still have two options? That complicates things."*

   There was a menu here for an hour. It answered a symptom from 2026-10-11 — *"the 3D model
   looks empty because it is not centered"* — which we read as "this viewer frames the origin".
   The real cause was the nucleus unit bug found the same day: a nucleus 1000× too far out put a
   930 µm bounding box around a 200 µm cell, and a viewer that frames the CONTENT then shows a
   mostly empty room. His own test today closed it: a cell placed 876 µm out displayed normally.

   So the file is always placed. The geometry goes where the geometry is, several cells line up
   without anybody choosing anything, and the download is one press.

   THE LINE STILL REPORTS WHERE, which is the part of this morning that earned its place: one
   object alone looks the same wherever it sits, so a sentence that merely claimed a placement
   could not be checked. BLENDER'S AXES, because that is where the number can be read: X = x,
   Y = -z, Z = -y, the permutation core/traceloft.js applies to the vertices and to ob.location,
   and where a .glb lands after import. Turned here and nowhere else. */
function tracingPlaceWhereUm(out){
  var o = out && out.offsetUm;
  if (!o || o.length !== 3) return null;
  var n1 = function(v){ return Math.round(Number(v)); };
  return [n1(o[0]), n1(-o[2]), n1(-o[1])];
}
function tracingPlaceSay(out){
  var at = tracingPlaceWhereUm(out);
  return "At its dataset coordinates"
    + (at ? " — this object’s Location is " + at.join(", ") + " µm, which you can read "
            + "in Blender’s N panel" : "")
    + ", so several of these open in one scene in their true relative positions. One on its own "
    + "looks the same wherever it sits, because a viewer frames whatever it is given. Press Home "
    + "in Blender to frame it, or Alt+G to move it to the world origin.";
}
var TRACING_PLACE_HELP = "At its dataset coordinates, so several of these line up in one Blender scene. The line afterwards says the Location it was given.";
'''

START = u"/* ── ASKED AT THE PRESS, NOT SET IN ADVANCE"
END = u"var TRACING_GLTF_HELP"
if u"function tracingPlaceSay(out){" in _s:
    print("core/tracingcard.js\n  already there: the menu is gone and one sentence is left")
else:
    a, b2 = _s.index(START), _s.index(END)
    blk = _s[a:b2]
    for _must in [u"function tracingPlaceAsk(btn){", u"function tracingPlaceMenuClose(answer){",
                  u"var TRACING_PLACE_MENU = null;", u"function tracingPlaceSay(place, out){"]:
        assert _must in blk, "not in the block being replaced: %r" % _must
    _s = _s[:a] + NEWBLOCK + _s[b2:]
    io.open(_P, "w", encoding="utf-8").write(_s)
    print("core/tracingcard.js\n  ok: the menu is gone and one sentence is left")

# ── the two buttons stop asking ──────────────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"one tracing downloads on one press again",
     u'''async function tracingOneGlb(sid, btn, fmt){
  /* ASKED BEFORE ANYTHING IS FETCHED, so changing your mind costs nothing at all — not a
     download, not a read of somebody's Drive. */
  var place = await tracingPlaceAsk(btn);
  if (place === null) return;
  var label = btn ? btn.innerHTML : "";''',
     u'''async function tracingOneGlb(sid, btn, fmt){
  var label = btn ? btn.innerHTML : "";'''),
    (u"...and asks the writers for the one placement",
     u'''    var where = {};
    var n = (fmt === "py")
      ? tracingPySave(parts, base + "_blender.py", parts[0].name, place, where)
      : tracingGlbSave(parts, base + ".glb", place, where);''',
     u'''    var where = {};
    var n = (fmt === "py")
      ? tracingPySave(parts, base + "_blender.py", parts[0].name, true, where)
      : tracingGlbSave(parts, base + ".glb", true, where);'''),
    (u"...and reports it",
     u'''                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay(place, where)''',
     u'''                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay(where)'''),
    (u"a whole cell likewise",
     u'''async function tracingCellGlb(g, btn, fmt){
  if (!g || !g.items.length) return;
  var place = await tracingPlaceAsk(btn);
  if (place === null) return;
  var label = btn ? btn.innerHTML : "";''',
     u'''async function tracingCellGlb(g, btn, fmt){
  if (!g || !g.items.length) return;
  var label = btn ? btn.innerHTML : "";'''),
    (u"...and its writers",
     u'''    var where = {};
    var n = (fmt === "py")
      ? tracingPySave(parts, cell + "_um_blender.py", title, place, where)
      : tracingGlbSave(parts, cell + "_um.glb", place, where);''',
     u'''    var where = {};
    var n = (fmt === "py")
      ? tracingPySave(parts, cell + "_um_blender.py", title, true, where)
      : tracingGlbSave(parts, cell + "_um.glb", true, where);'''),
    (u"...and its line",
     u'''      + " Micrometres. " + tracingPlaceSay(place, where)''',
     u'''      + " Micrometres. " + tracingPlaceSay(where)'''),
])

# ── and glbcheck stops asserting a choice that no longer exists ────────────────────
# Its "placed or centred" section still tests the WRITER both ways, which is right: the
# option is the writer's and is what makes "placed" testable. What it can no longer test is
# what the card says about which it did, because the card no longer chooses.
edit("glbcheck.js", [
    (u"the writers are still tested both ways, the sentence is not",
     u'''             say: (typeof tracingPlaceSay === "function")
                  ? { on: tracingPlaceSay(true), off: tracingPlaceSay(false) } : null };''',
     u'''             /* The SENTENCE moved out of this file on 2026-10-12: the card has one placement
                now, so there is no "which did it do" to assert here. What the line says is
                tracingplacecheck.js's subject, and it is about the card rather than the file. */
             say: null };'''),
    (u"...and the assertion about it says where it went",
     u'''  if (place.say)
    ok(/dataset coordinates/i.test(place.say.on) && /[Cc]entred on itself/.test(place.say.off)
       && place.say.on !== place.say.off,
       "...and the line afterwards says which it did, because a file whose position you cannot "
       + "predict is worse than either position", place.say.off.slice(0, 70));''',
     u'''  ok(place.say === null,
     "...and this file stops asserting what the card SAYS about it. The card has one placement "
     + "since 2026-10-12, so there is no choice to report; the sentence belongs to the card and "
     + "to tracingplacecheck.js",
     "left to the card's own check");'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_s = io.open(_P, encoding="utf-8").read()
for _gone in [u"tracingPlaceAsk", u"tracingPlaceMenuClose", u"TRACING_PLACE_MENU",
              u"tracingPlaceMenu", u"tracingplacepick"]:
    assert _gone not in _s, "%s survives in core/tracingcard.js" % _gone
for _what, _n in [(u"function tracingPlaceSay(out){", 1),
                  (u"function tracingPlaceWhereUm(out){", 1),
                  (u"tracingPlaceSay(where)", 2),
                  (u"var where = {};", 2)]:
    assert _s.count(_what) == _n, "%d of %r, wanted %d" % (_s.count(_what), _what, _n)
# BOTH WRITERS, THE SAME ANSWER. A caller left passing nothing would centre silently, which is
# the one failure this change can introduce and the one nobody would see until two cells had to
# line up.
import re as _re
for _call in [u"tracingPySave(parts, base", u"tracingGlbSave(parts, base",
              u"tracingPySave(parts, cell", u"tracingGlbSave(parts, cell"]:
    _m = _re.search(_re.escape(_call) + r"[^;]*", _s)
    assert _m and "true, where" in _m.group(0), "no placement in: %r" % (_m and _m.group(0))
# ...and nothing awaits a question any more, so the download is one press.
assert u"await tracingPlaceAsk" not in _s
print("done")
print("all applied")
