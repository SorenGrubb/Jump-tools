# -*- coding: utf-8 -*-
"""Placed or centred is his to choose.                                              2026-10-11

Søren: *"Now the 3D model in the tracing dataset looks empty because it is not centered. Can we do
something so that it is centered when opening alone but has the correct coordinate when opening in
Blender?"*  — and, asked which viewer: **Windows 3D Viewer / Paint 3D**.

NO, AND THAT IS WORTH SAYING PLAINLY: a single GLB cannot be at the origin and at its dataset
coordinates at the same time. The geometry is in one place; what differs between viewers is only
whether they frame the scene they were given. Blender frames on Home, Windows 3D Viewer frames on
the origin — so a cell 1.6 mm away opens as an empty grey room, which is exactly what he saw.

So it is a CHOICE, and he made it: one tick, "Dataset coordinates", default ON, beside the
dataset list. Ticked, the download is placed and several cells line up in one Blender scene —
yesterday's fix, which he asked for and still wants. Unticked, it is centred on itself and opens
framed in anything.

ONE TICK FOR BOTH FORMATS AND BOTH BUTTONS. The GLB and the Blender script are two renderings of
one scene, and a tick that moved one and not the other would make the two downloads of one cell
disagree about where it is — which is the thing yesterday's check exists to prevent. So the tick
is read once, at the save, and handed to both writers; traceloft's `glb()` and `blenderPy()` each
take `place:false` and put the scene at the origin, by the same route they use to put it anywhere
else. There is no second way to centre something.

AND THE LINE SAYS WHICH IT DID, because a file whose position you cannot predict is worse than
either position. TRACING_PLACE_HELP becomes a function of the tick rather than a constant that
always claims placement.

Changes: core/traceloft.js   (glb(parts, res, opts) and blenderPy's meta.place)
         core/tracingcard.js (the tick; tracingPlaceWanted(); the two saves pass it; the help
                              sentence follows it)
Check:   glbcheck.js         (new: the tick moves both writers, together)
Run: python3 src/placed_or_centred_is_his_to_choose.py
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


# ── 1. both writers can put the scene at the origin, by the route they already use ───────────
edit("core/traceloft.js", [
    (u"glb() takes the choice",
     u'''  function glb(parts, resNm){
    var prep = glbParts(parts, resNm);
    if (!prep) return null;''',
     u'''  /* `opts.place === false` centres the scene on itself instead of putting it at its dataset
     coordinates. Søren, 2026-10-11, of a cell opened in Windows 3D Viewer: *"the 3D model ... looks
     empty because it is not centered"* — that viewer frames the origin rather than the scene, so a
     cell 1.6 mm away is an empty grey room. One file cannot be in two places; the tick on the card
     decides which, and hands the same answer to blenderPy() below. */
  function glb(parts, resNm, opts){
    var prep = glbParts(parts, resNm);
    if (!prep) return null;'''),

    (u"...and uses it where the place is computed",
     u'''    var place = [prep.offsetUm[0], -prep.offsetUm[1], prep.offsetUm[2]];''',
     u'''    var place = (opts && opts.place === false) ? [0, 0, 0]
              : [prep.offsetUm[0], -prep.offsetUm[1], prep.offsetUm[2]];'''),

    (u"the Blender script takes the same choice",
     u'''    var at = "(" + n3(b.offsetUm[0]) + "," + n3(-b.offsetUm[2]) + "," + n3(-b.offsetUm[1]) + ")";''',
     u'''    var at = (m.place === false) ? "(0,0,0)"
           : "(" + n3(b.offsetUm[0]) + "," + n3(-b.offsetUm[2]) + "," + n3(-b.offsetUm[1]) + ")";'''),

    (u"...and its header says which it did",
     u'''    L.push("# One Blender unit is one MICROMETRE. Each object's MESH is local to its own middle");
    L.push("# and the object is PLACED at voxel " + b.centreVoxel.join(", ") + " of this tool's");
    L.push("# frame, so several of these run into one scene land in their true relative positions.");
    L.push("# Home frames everything; Alt+G on an object clears its location to the world origin.");''',
     u'''    L.push("# One Blender unit is one MICROMETRE. Each object's MESH is local to its own middle");
    if (m.place === false){
      L.push("# and the scene is CENTRED ON ITSELF, so it opens framed. It came from voxel "
             + b.centreVoxel.join(", ") + " of this tool's frame; tick Dataset coordinates on the");
      L.push("# card if you want several of these to line up in one scene.");
    } else {
      L.push("# and the object is PLACED at voxel " + b.centreVoxel.join(", ") + " of this tool's");
      L.push("# frame, so several of these run into one scene land in their true relative positions.");
      L.push("# Home frames everything; Alt+G on an object clears its location to the world origin.");
    }'''),
])
_T = os.path.join(HERE, "core/traceloft.js")
_t = io.open(_T, encoding="utf-8").read()
for _what, _n in [(u"function glb(parts, resNm, opts){", 1),
                  (u'(opts && opts.place === false) ? [0, 0, 0]', 1),
                  (u'(m.place === false) ? "(0,0,0)"', 1),
                  (u"CENTRED ON ITSELF, so it opens framed", 1)]:
    assert _t.count(_what) == _n, "core/traceloft.js has %d of %s, wanted %d" % (
        _t.count(_what), _what, _n)
print("done 1")

# ── 2. the tick, read once and handed to both writers ─────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the tick itself, and what the help sentence says once it exists",
     u'''var TRACING_PLACE_HELP = "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \\u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin.";''',
     u'''/* ── PLACED OR CENTRED, AND HE CHOOSES ─────────────────────────────  2026-10-11
   Søren, of a cell opened in Windows 3D Viewer: *"the 3D model in the tracing dataset looks empty
   because it is not centered. Can we do something so that it is centered when opening alone but
   has the correct coordinate when opening in Blender?"*

   Not in one file: the geometry is in one place, and what differs between viewers is only whether
   they frame the scene they were given. Blender frames on Home; Windows 3D Viewer frames the
   origin, so a cell 1.6 mm away is an empty grey room.

   So: one tick, default ON, read at the save and handed to BOTH writers. A tick that moved the
   GLB and not the script would make the two downloads of one cell disagree about where it is,
   which is what yesterday's check exists to catch. */
function tracingPlaceWanted(){
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
}
function tracingPlaceSay(){
  return tracingPlaceWanted()
    ? "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \\u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin."
    : "Centred on itself, so it opens framed in any viewer \\u2014 tick Dataset coordinates above if you want several of these to line up in one scene.";
}
var TRACING_PLACE_HELP = "Placed at its dataset coordinates, so several of these open in one scene in their true relative positions \\u2014 press Home in Blender to frame it, or Alt+G to move it to the world origin.";'''),

    (u"the two saves read it and hand it on",
     u'''function tracingPySave(parts, filename, title){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var txt = UJ.traceloft.blenderPy(parts, res, { title: title || "", file: filename });''',
     u'''function tracingPySave(parts, filename, title){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var txt = UJ.traceloft.blenderPy(parts, res, { title: title || "", file: filename,
                                                 place: tracingPlaceWanted() });'''),

    (u"...and so does the GLB",
     u'''function tracingGlbSave(parts, filename){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var bytes = UJ.traceloft.glb(parts, res);''',
     u'''function tracingGlbSave(parts, filename){
  var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
  var bytes = UJ.traceloft.glb(parts, res, { place: tracingPlaceWanted() });'''),

    (u"the tick sits with the list the buttons are in",
     u'''    + '<label>In the dataset, by cell — open one to add to it or correct it</label>\'''',
     u'''    + '<label>In the dataset, by cell — open one to add to it or correct it'
    + tracingPlaceTickHtml() + '</label>\''''),

    (u"the lone status line follows the tick",
     u'''                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + TRACING_PLACE_HELP
                      + " " + TRACING_GLTF_HELP)''',
     u'''                      + "Blender: File \\u203a Import \\u203a glTF 2.0. " + tracingPlaceSay()
                      + " " + TRACING_GLTF_HELP)'''),

    (u"...and so does the combined one",
     u'''      + " Micrometres. " + TRACING_PLACE_HELP''',
     u'''      + " Micrometres. " + tracingPlaceSay()'''),
])
_C = os.path.join(HERE, "core/tracingcard.js")
_c = io.open(_C, encoding="utf-8").read()
for _what, _n in [(u"function tracingPlaceWanted(){", 1), (u"function tracingPlaceTickHtml(){", 1),
                  (u"function tracingPlaceSay(){", 1), (u'id="tracingPlaceAt"', 1),
                  (u"tracingPlaceWanted()", 4), (u"tracingPlaceSay()", 3),
                  (u"tracingPlaceTickHtml()", 2),
                  (u"UJ.traceloft.glb(parts, res, { place:", 1),
                  (u"place: tracingPlaceWanted() });", 2)]:
    assert _c.count(_what) == _n, "core/tracingcard.js has %d of %s, wanted %d" % (
        _c.count(_what), _what, _n)
# NO SAVE MAY BYPASS IT. Either writer called without the tick would be a second rule.
assert u"UJ.traceloft.glb(parts, res);" not in _c, "a GLB save still ignores the tick"
# The tooltips keep the constant: on the BUTTON, before any tick has been read, the default is
# what the sentence should describe, and the default is placed.
assert _c.count(u"TRACING_PLACE_HELP") == 3, "the button tooltips lost the default sentence"
print("done 2")

# ── 3. the check ──────────────────────────────────────────────────────────────────────────────
# Signature-guarded, not whole-block-guarded: an edit inside an inserted block makes edit()'s
# `if new in s` stop matching, and the next run adds a second copy. See
# src/three_downloads_in_one_scene.py, where that happened.
CHK = r'''
  /* ── PLACED OR CENTRED IS HIS TO CHOOSE ───────────────────────────────────────  2026-10-11
     Søren, of a cell opened in Windows 3D Viewer: *"the 3D model in the tracing dataset looks
     empty because it is not centered. Can we do something so that it is centered when opening
     alone but has the correct coordinate when opening in Blender?"*

     Not in one file, and saying so was the answer: the geometry is in ONE place, and what differs
     between viewers is only whether they frame the scene they were given. Blender frames on Home;
     Windows 3D Viewer frames the origin, so a cell 1.6 mm away is an empty grey room.

     So it is a tick, default ON. WHAT IS ASSERTED:
       - the tick is there, and ticked, so today's behaviour is the default
       - unticked, the GLB sits at the origin — which is the whole of what Windows 3D Viewer needs
       - ...and the Blender script centres WITH it, because two downloads of one cell that
         disagree about where it is are worse than either position
       - ticked, both are placed again, so this is a choice and not a retreat
       - and the line says which it did, because a file whose position you cannot predict is
         worse than either position */
  console.log("\nand placed or centred is his to choose");
  const pick = await p.evaluate(() => {
    /* GUARDED ON THE CARD, NOT ON THE FEATURE. Guarding on tracingPlaceTickHtml meant a build
       without the tick reported "no tracing card on this page" and passed \u2014 a check that
       excuses its own subject. The card is what some pages lack; the tick is what must be there
       when it does. */
    if (typeof tracingGlbSave !== "function") return { noCard: true };
    if (typeof tracingPlaceTickHtml !== "function") return { missing: true };
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
    const loc = (py) => (py.match(/_add\('Whole cell',[^[]*?,\s*\(([-0-9.,]+)\),\s*\[/) || [])[1];
    /* The tick, through the real list, so what is read is what he would click. */
    const d = document.createElement("div");
    d.innerHTML = tracingPlaceTickHtml();
    document.body.appendChild(d);
    const el = document.getElementById("tracingPlaceAt");
    const was = el ? el.checked : null;
    const run = () => ({ glb: tx(UJ.traceloft.glb(parts, res, { place: tracingPlaceWanted() })),
                         py: loc(UJ.traceloft.blenderPy(parts, res,
                               { title: "t", place: tracingPlaceWanted() })),
                         say: tracingPlaceSay() });
    const on = run();
    el.checked = false;
    const off = run();
    el.checked = true;
    const back = run();
    d.remove();
    return { was: was, on: on, off: off, back: back };
  });
  if (pick.noCard) console.log("  (no tracing card on this page)");
  else if (pick.missing)
    ok(false, "the card offers the Dataset coordinates tick", "tracingPlaceTickHtml is not here");
  else {
    ok(pick.was === true,
       "the tick is there and ticked, so the placement he asked for yesterday is still the default",
       String(pick.was));
    ok(Math.max.apply(null, (pick.off.glb || []).map(Math.abs)) === 0,
       "unticked, the GLB sits at the origin — which is the whole of what a viewer that frames "
       + "the origin rather than the scene needs in order to show it",
       JSON.stringify(pick.off.glb));
    ok(pick.off.py === "0,0,0",
       "...and the Blender script centres WITH it, because two downloads of one cell that disagree "
       + "about where it is are worse than either position", String(pick.off.py));
    ok(Math.max.apply(null, (pick.on.glb || []).map(Math.abs)) > 100
       && pick.on.py !== "0,0,0" && pick.back.py === pick.on.py,
       "ticked, both are placed again — a choice, not a retreat",
       JSON.stringify(pick.on.glb) + " / " + String(pick.on.py));
    ok(/dataset coordinates/i.test(pick.on.say) && /[Cc]entred on itself/.test(pick.off.say)
       && pick.on.say !== pick.off.say,
       "...and the line says which it did, because a file whose position you cannot predict is "
       + "worse than either position", pick.off.say.slice(0, 70));
  }
'''
OLD = "\n  /* \\u2500\\u2500 AND A FORM THAT NEEDS NO IMPORTER AT ALL \\u2500\\u2500"
_G = os.path.join(HERE, "glbcheck.js")
if u"placed or centred is his to choose" in io.open(_G, encoding="utf-8").read():
    print("glbcheck.js\n  already there: placed or centred is his to choose")
else:
    edit("glbcheck.js", [(u"placed or centred is his to choose", OLD, CHK + OLD)])
_g = io.open(_G, encoding="utf-8").read()
assert _g.count(u"and placed or centred is his to choose") == 1, "glbcheck.js has two of the block"
print("done 3")
print("all applied")
