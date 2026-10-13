# -*- coding: utf-8 -*-
r"""The picture offers only what it can read, and reads it at the right scale.       2026-10-13

Søren, with the Discussion's EM drawn in δJump: *"When I test it in the show in 3D, it works, but
in the discussion it gives me an error. It is super slow though."*

TWO FAULTS, BOTH MINE, BOTH FROM THE SAME SHORTCUT: core/tools.js was built to answer "where is
this coordinate and what imagery covers it", and this morning it was asked to answer "what can be
READ here" as well. Those are different questions and I handed over the first answer twice.

── “the segmentation could not be configured” ────────────────────────────────────────────────
V1DD's cell segmentation is graphene://middleauth+ — a live CAVE-authenticated volume — and
core/segread.js REFUSES one, deliberately and with a message saying why: indexing a graphene source
returns supervoxel ids, not the root ids the tool hands out. δJump knows this about itself and
configures `seg: ""` everywhere; its own 3D works because the page already has the root id from its
nucleus table and fetches the mesh by id, which needs no segmentation read at all. The registry
carried the graphene URL in `seg` because that IS the right layer for a viewer link — and
emHostFor() passed it to the reader, which offered a button and then refused its own source.

So the host handed to core/empreview.js now drops any source core/segread.js will not read, using
segread's own test. The viewer link still gets the graphene layer, because there it is correct: a
reader signed in to CAVE sees the cells. And where the buttons are withheld the picture SAYS WHY,
rather than leaving a gap somebody has to guess at.

── “super slow” ──────────────────────────────────────────────────────────────────────────────
V1DD's scale list opens with `key: "placeholder"`, 4.85 nm, an entry with no bytes behind it.
core/emtiles.js can only know that from the page, which is what skipScales is for, and δJump passes
["placeholder"] everywhere it configures the reader. The registry did not carry it and
core/empreview.js never forwarded it, so the placeholder stayed in the list — and since the INDEX
IS THE MIP, every level shifted by one: the preview asked for mip 3 and got the level above it,
four times the pixels for the same picture on screen. That is the slowness, and it is also a
hazard in the other direction: whichever of the pad and the preview configures the reader first
wins, so a Discussion opened before the pad left the pad reading at the wrong level too.

Changes: core/tools.js, core/empreview.js
Checks:  toolscheck.js (extended), empreviewcheck.js, forumtabcheck.js
Run: python3 src/the_picture_offers_only_what_it_can_read.py
     node toolscheck.js && node empreviewcheck.js && node forumtabcheck.js
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


edit("core/tools.js", [

 (u"V1DD's dead scale is named, as δJump names it everywhere else",
  u'''        em: "precomputed://gs://v1dd_imagery/image/aligned_image",''',
  u'''        em: "precomputed://gs://v1dd_imagery/image/aligned_image",
        /* ── THE LEVEL THAT IS NOT THERE ───────────────────────────────────────  2026-10-13
           V1DD's scale list opens with `key: "placeholder"`, 4.85 nm, chunk 2048×2048×128, and
           404s at its own voxel_offset and at the origin: an entry with no bytes behind it. Its z
           is 45 nm like the real scales, so core/emtiles.js's sectionScales() keeps it unless the
           page says otherwise — and THE INDEX IS THE MIP, so keeping it shifts every level by
           one. A preview that asked for mip 3 got the level above: four times the pixels for the
           same picture, which is what Søren saw as "super slow".

           Nothing in an info file marks a scale as empty; the only honest test is to fetch one.
           So the page names it, and djump.html has named it at every call site since 2026-09-20.
           This is the fourth, and the first that is not on djump.html. */
        skipScales: ["placeholder"],'''),

 (u"the reader is handed only what it can read",
  u'''    var h = hostFor(k);
    return { res: t.res.slice(), em: v.em || "", seg: v.seg || "", nuc: v.nuc || "",
             window: t.emWindow ? { lo: t.emWindow.lo, hi: t.emWindow.hi } : null,
             volume: v.key, tool: t.key, label: t.label,''',
  u'''    var h = hostFor(k);
    /* ── ONLY WHAT core/segread.js WILL READ ───────────────────────────────────────  2026-10-13
       Søren, on the Discussion in δJump: *"in the discussion it gives me an error"* — “the
       segmentation could not be configured”.

       V1DD's cell segmentation is graphene://middleauth+, and core/segread.js refuses a graphene
       source on purpose: indexing one returns SUPERVOXEL ids, not the root ids these tools hand
       out, so an answer from it would be a wrong cell id rather than no cell id. δJump has always
       known this about itself and configures `seg: ""`; its own 3D works because the page already
       has the root id from its nucleus table and never reads the segmentation at a point.

       The registry carries the graphene URL because that is the right LAYER for a viewer link —
       a reader signed in to CAVE sees the cells there. It is the wrong thing to hand a reader,
       and this is the line that keeps those two apart. hostFor() above is untouched. */
    var readable = function(src){
      return (src && !/^graphene:\\/\\//.test(String(src))) ? src : "";
    };
    /* AND WHERE A VOLUME DOES PUBLISH ONE AND THIS REGISTRY STILL DOES NOT NAME IT, the entry
       says so itself — "publishes no segmentation" would be a false statement about cb2. */
    var why = "";
    if (!readable(v.seg))
      why = v.segWhy ? v.segWhy
          : v.seg ? ("its segmentation is a live CAVE volume (graphene://), which cannot be "
                     + "indexed at a point without returning supervoxels rather than cells")
                  : "this volume publishes no segmentation";
    return { res: t.res.slice(), em: v.em || "",
             seg: readable(v.seg), nuc: readable(v.nuc),
             /* The scales this volume lists and does not serve — see the entry it comes from. */
             skipScales: (v.skipScales || []).slice(),
             /* Said out loud where the two 3D buttons are withheld, so the gap reads as an answer
                rather than as something that failed to load. */
             noSegWhy: why,
             window: t.emWindow ? { lo: t.emWindow.lo, hi: t.emWindow.hi } : null,
             volume: v.key, tool: t.key, label: t.label,'''),
])

edit("core/tools.js", [

 (u"cb2 says why its segmentation is not named here, because it has one",
  u'''      volumes: [{ key: "cb2", label: "cb2",
        bb: { xmin: 0, xmax: 998400, ymin: 0, ymax: 921600, zmin: 0, zmax: 48000 },''',
  u'''      volumes: [{ key: "cb2", label: "cb2",
        bb: { xmin: 0, xmax: 998400, ymin: 0, ymax: 921600, zmin: 0, zmax: 48000 },
        /* "publishes no segmentation" would be false here: cb2 publishes one, 1,216 sections
           below its imagery, and χJump corrects for it with a transform on the source. Neither a
           jumplink layer nor core/segread.js has anywhere to carry that, so the picture says the
           real reason rather than the default one. */
        segWhy: "cb2's segmentation is published 1,216 sections below its imagery, and neither "
              + "the viewer link nor the reader here has anywhere to carry that correction",'''),
])

edit("core/empreview.js", [

 (u"the reader is configured with the scales the volume does not really serve",
  u'''    if (!UJ.emtiles.configured()) UJ.emtiles.configure({ em: cfg.em, res: cfg.res });''',
  u'''    /* skipScales NAMES THE LEVELS A VOLUME LISTS AND DOES NOT SERVE, and it was not forwarded
       until 2026-10-13. V1DD's list opens with a dead 4.85 nm `placeholder`; since the index IS
       the mip, keeping it shifted every level by one and this preview read four times the pixels
       it meant to. The hazard runs both ways — whichever of the pad and this configures the
       reader first wins — so the full set is passed rather than the two fields this used to. */
    if (!UJ.emtiles.configured())
      UJ.emtiles.configure({ em: cfg.em, res: cfg.res, skipScales: cfg.skipScales || [] });'''),

 (u"...and the withheld buttons say why they are withheld",
  u'''          : "")
       + '<span class="hint emp-say" style="flex:1 1 140px;min-width:0"></span>'
       + "</div></div>";''',
  u'''          : '<span class="hint" style="flex:1 1 200px;min-width:0">No cell lookup here \\u2014 '
            + esc(cfg && cfg.noSegWhy ? cfg.noSegWhy : "this volume publishes no segmentation")
            + ".</span>")
       + '<span class="hint emp-say" style="flex:1 1 140px;min-width:0"></span>'
       + "</div></div>";'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_T = io.open(os.path.join(HERE, "core/tools.js"), encoding="utf-8").read()
assert _T.count(u'skipScales: ["placeholder"]') == 1
assert _T.count(u"var readable = function(src){") == 1
assert _T.count(u"noSegWhy: why,") == 1
# THE VIEWER STILL GETS THE GRAPHENE LAYER. Stripping it from hostFor() too would quietly drop the
# cells out of every V1DD link this family writes, which is the opposite mistake and a quieter one.
assert _T.count(u"graphene://middleauth+https://api.em.brain.allentech.org") == 1, \
    "V1DD's segmentation is no longer named for the viewer"

_E = io.open(os.path.join(HERE, "core/empreview.js"), encoding="utf-8").read()
assert _E.count(u"skipScales: cfg.skipScales || []") == 1
assert _E.count(u"No cell lookup here") == 1
print("done")
print("all applied")
