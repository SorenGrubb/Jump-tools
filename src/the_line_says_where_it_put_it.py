# -*- coding: utf-8 -*-
r"""The line says where it put it.                                                  2026-10-12

Søren, an hour after the placement menu went in: *"The centred on itself worked fine, but then when
I tried dataset coordinates it looks like it is still centred on itself"* — with a screenshot of a
cell filling the frame.

THE FILE WAS RIGHT. Measured rather than argued about, by reading the three .glb files in his own
Downloads folder:

    cell_at_218176_185568_22154_um.glb       [0, 0, 0]
    ...(1).glb                               [875.7, -760.0, 883.0]
    ...(2).glb                               [875.7, -760.0, 883.0]

A VIEWER FRAMES WHATEVER IT IS GIVEN, so ONE object looks identical at the origin and 876 µm away.
The difference exists only in relation to something else — a second cell, or the N panel. The menu
promised "so several of these line up in one Blender scene" and then produced a file in which that
promise is, by construction, invisible. He did the only test available to him and it came back
inconclusive, which reads exactly like a bug.

SO THE LINE STOPS CLAIMING AND STARTS REPORTING. It names the Location the object will have, in
Blender's own axes, and says out loud that one object alone looks the same either way. A sentence
he can check against the N panel in four seconds beats a sentence he has to believe.

HOW THE NUMBER GETS OUT. glb() and blenderPy() both already compute it — glbParts().offsetUm, the
one place that knows — and both threw it away. `opts.out` is an object they fill in passing, so
neither writer gains a second return type and the card does not recompute a bounding box that was
just computed. The card turns it into Blender's axes ONCE, in tracingPlaceWhereUm, because the two
writers already agree about that permutation and a third opinion is how they would stop agreeing.

Changes: core/traceloft.js, core/tracingcard.js
Check:   tracingplacecheck.js (extended)
Run: python3 src/the_line_says_where_it_put_it.py
     node tracingplacecheck.js
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


# ── both writers hand back where they put it ─────────────────────────────────────────────────
edit("core/traceloft.js", [
    (u"glb reports the place it used",
     u'''    var place = (opts && opts.place === false) ? [0, 0, 0]
              : [prep.offsetUm[0], -prep.offsetUm[1], prep.offsetUm[2]];''',
     u'''    var place = (opts && opts.place === false) ? [0, 0, 0]
              : [prep.offsetUm[0], -prep.offsetUm[1], prep.offsetUm[2]];
    /* WHERE IT WENT, for whoever has to say so. glbParts() is the one thing that knows, and both
       writers threw it away -- so the card could promise a placement and not report it, which is
       how Søren spent an evening deciding the menu was broken when the file was right. An out
       object rather than a second return type: nothing else about either writer changes. */
    if (opts && opts.out){
      opts.out.offsetUm = prep.offsetUm.slice();
      opts.out.centreVoxel = prep.centreVoxel.slice();
      opts.out.placed = !(opts.place === false);
    }'''),
    (u"...and so does blenderPy",
     u'''    var at = (m.place === false) ? "(0,0,0)"
           : "(" + n3(b.offsetUm[0]) + "," + n3(-b.offsetUm[2]) + "," + n3(-b.offsetUm[1]) + ")";''',
     u'''    var at = (m.place === false) ? "(0,0,0)"
           : "(" + n3(b.offsetUm[0]) + "," + n3(-b.offsetUm[2]) + "," + n3(-b.offsetUm[1]) + ")";
    if (m && m.out){
      m.out.offsetUm = b.offsetUm.slice();
      m.out.centreVoxel = b.centreVoxel.slice();
      m.out.placed = !(m.place === false);
    }'''),
])

# ── the card turns it into Blender's axes, once ──────────────────────────────────────────────
WHERE = r'''/* ── AND WHERE IT ACTUALLY WENT ─────────────────────────────────────  2026-10-12
   Søren: *"The centred on itself worked fine, but then when I tried dataset coordinates it looks
   like it is still centred on itself."* The file was right -- 876 µm out, measured in his own
   Downloads folder -- and the picture could not have shown it: a viewer frames whatever it is
   given, so one object alone looks the same at the origin and a millimetre away. The difference
   is relational, and the line promised it without ever reporting it.

   BLENDER'S AXES, because Blender is where the number can be read: X = x, Y = -z, Z = -y, the
   same permutation core/traceloft.js applies to the vertices and to ob.location, and the place a
   .glb lands at after import. Turned here and nowhere else -- a third opinion about the
   permutation is how the two writers would stop agreeing about it. */
function tracingPlaceWhereUm(out){
  var o = out && out.offsetUm;
  if (!o || o.length !== 3) return null;
  var n1 = function(v){ return Math.round(Number(v)); };
  return [n1(o[0]), n1(-o[2]), n1(-o[1])];
}
function tracingPlaceSay(place, out){
  var at = tracingPlaceWhereUm(out);
  if (place)
    return "Placed at its dataset coordinates"
      + (at ? " \u2014 this object’s Location is " + at.join(", ") + " µm, which you can "
              + "read in Blender’s N panel" : "")
      + ". ON ITS OWN IT LOOKS THE SAME AS THE CENTRED ONE: a viewer frames whatever it is given, "
      + "so the placement only shows against something else \u2014 a second cell in the same scene. "
      + "Press Home in Blender to frame it, or Alt+G to move it to the world origin.";
  return "Centred on itself, so it opens framed in any viewer"
    + (at ? " \u2014 it would have sat at " + at.join(", ") + " µm" : "")
    + ". Press 3D model again and choose dataset coordinates if you want several of these to line "
    + "up in one scene.";
}'''
OLDSAY = r'''function tracingPlaceSay(place){
  return place
    ? "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin."
    : "Centred on itself, so it opens framed in any viewer \u2014 press 3D model again and choose dataset coordinates if you want several of these to line up in one scene.";
}'''
edit("core/tracingcard.js", [(u"the line reports rather than promises", OLDSAY, WHERE)])

# ── the savers pass the out object back ──────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"tracingPySave hands back where it put it",
     u'''function tracingPySave(parts, filename, title, place){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var txt = UJ.traceloft.blenderPy(parts, res, { title: title || "", file: filename,
                                                 place: !!place });
  if (!txt) return 0;
  tracingSaveBlob(new Blob([txt], { type: "text/x-python" }), filename);
  return parts.length;
}''',
     u'''/* Both savers return the number written and, on `where`, what the writer did with it — so
   the sentence afterwards reports a fact instead of repeating the button's promise. */
function tracingPySave(parts, filename, title, place, where){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var txt = UJ.traceloft.blenderPy(parts, res, { title: title || "", file: filename,
                                                 place: !!place, out: where || {} });
  if (!txt) return 0;
  tracingSaveBlob(new Blob([txt], { type: "text/x-python" }), filename);
  return parts.length;
}'''),
    (u"...and tracingGlbSave likewise",
     u'''function tracingGlbSave(parts, filename, place){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var bytes = UJ.traceloft.glb(parts, res, { place: !!place });''',
     u'''function tracingGlbSave(parts, filename, place, where){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var bytes = UJ.traceloft.glb(parts, res, { place: !!place, out: where || {} });'''),
])

edit("core/tracingcard.js", [
    (u"one tracing passes the box in and the answer out",
     u'''    var n = (fmt === "py") ? tracingPySave(parts, base + "_blender.py", parts[0].name, place)
                           : tracingGlbSave(parts, base + ".glb", place);''',
     u'''    var where = {};
    var n = (fmt === "py")
      ? tracingPySave(parts, base + "_blender.py", parts[0].name, place, where)
      : tracingGlbSave(parts, base + ".glb", place, where);'''),
    (u"...and says what came back",
     u'''                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay(place)''',
     u'''                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay(place, where)'''),
    (u"a whole cell too",
     u'''    var n = (fmt === "py") ? tracingPySave(parts, cell + "_um_blender.py", title, place)
                           : tracingGlbSave(parts, cell + "_um.glb", place);''',
     u'''    var where = {};
    var n = (fmt === "py")
      ? tracingPySave(parts, cell + "_um_blender.py", title, place, where)
      : tracingGlbSave(parts, cell + "_um.glb", place, where);'''),
    (u"...and says it",
     u'''      + " Micrometres. " + tracingPlaceSay(place)''',
     u'''      + " Micrometres. " + tracingPlaceSay(place, where)'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_T = os.path.join(HERE, "core/traceloft.js")
_t = io.open(_T, encoding="utf-8").read()
assert _t.count(u"opts.out.offsetUm = prep.offsetUm.slice();") == 1
assert _t.count(u"m.out.offsetUm = b.offsetUm.slice();") == 1
_P = os.path.join(HERE, "core/tracingcard.js")
_s = io.open(_P, encoding="utf-8").read()
for _what, _n in [(u"function tracingPlaceWhereUm(out){", 1),
                  (u"function tracingPlaceSay(place, out){", 1),
                  (u"var where = {};", 2),
                  (u"tracingPlaceSay(place, where)", 2)]:
    assert _s.count(_what) == _n, "%d of %r, wanted %d" % (_s.count(_what), _what, _n)
assert u"tracingPlaceSay(place)" not in _s.replace(u"tracingPlaceSay(place, ", u""), \
    "a caller still asks without the box, and would promise without reporting"
print("done")
print("all applied")
