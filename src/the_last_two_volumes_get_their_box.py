# -*- coding: utf-8 -*-
r"""The last two volumes get their box.                                              2026-10-14

Søren, from a phone, on an ηJump post whose coordinate is plain text: *"It doesn't work in hJump"*.

AND IT WAS NOT A BUG — IT WAS A GAP I DECLARED AND THEN DID NOT CLOSE. ηJump and βJump were the two
tools core/tools.js had no verified extent for, so nothing in their posts became a link, so there
was nothing to click and no picture. I said that was deliberate, and it was; what was wrong is that
I looked for the numbers in the PAGES, where both compute them at run time from the volume's own
info, and stopped when I found nothing to copy.

THE NUMBERS WERE ALREADY IN THIS REPOSITORY. emhjumpcheck.js and embjumpcheck.js each carry the
volume's real scale list under the heading "THE VOLUME'S REAL SHAPE, read ... on 2026-09-21" —
read live from the bucket when the tracing card was ported, and in use as those checks' fixtures
ever since. Same standard as every other box here: in the repo, verified, not guessed.

    H01 4nm_raw   finest 4 nm, 1,031,784 x 712,800 x 5,293 at 33 nm  ->  4,127 x 2,851 x 175 µm
    vCLEM em_clahe finest 8 nm,    57,344 x  55,296 x   864 at 30 nm  ->    459 x   442 x  26 µm

H01's published description is a cubic millimetre of human temporal cortex, about 4 x 3 mm and
150 µm thick: the box agrees with the paper, which is the cheapest sanity check there is.

NEITHER BUCKET SENDS CORS HEADERS. gs://h01-release and gs://vclem-xh answer the ordinary public
URL with no Access-Control-Allow-Origin, so every read has to go through Google's JSON API —
core/segread.js's useJsonApi(bucket), which each page calls for its own bucket at load. A READER IN
ANOTHER TOOL HAS NEVER HEARD OF EITHER, so the registry carries the bucket name and
core/empreview.js names it before drawing. Without that, an ηJump post would draw in ηJump and fail
in µJump, which is the asymmetry this whole registry exists to remove.

WHAT THIS TURNS ON for both tools: coordinates in their posts become links; the EM draws; and the
two 3D buttons appear, because H01's c3 and βJump's secgan16 are both flat precomputed
segmentations core/segread.js can index at a point.

Changes: core/tools.js, core/empreview.js
Checks:  toolscheck.js (extended — the sizes are read back out of the two checks that carry them),
         forumtabcheck.js, emhjumpcheck.js, embjumpcheck.js
Run: python3 src/the_last_two_volumes_get_their_box.py
     node toolscheck.js && node forumtabcheck.js && node emhjumpcheck.js && node embjumpcheck.js
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


# THE ARITHMETIC IS DONE HERE AND WRITTEN OUT, so the file carries numbers rather than a product
# nobody can check by eye — and toolscheck.js recomputes it from the two checks' own fixtures.
H01 = (1031784, 712800, 5293, 4, 4, 33)
VCL = (57344, 55296, 864, 8, 8, 30)
hx, hy, hz = H01[0] * H01[3], H01[1] * H01[4], H01[2] * H01[5]
vx, vy, vz = VCL[0] * VCL[3], VCL[1] * VCL[4], VCL[2] * VCL[5]
assert (hx, hy, hz) == (4127136, 2851200, 174669), (hx, hy, hz)
assert (vx, vy, vz) == (458752, 442368, 25920), (vx, vy, vz)

edit("core/tools.js", [

 (u"ηJump's volume, from the shape emhjumpcheck.js read off the bucket",
  u'''    { key: "hjump", label: "ηJump", dataset: "H01 — human temporal cortex",
      page: "hjump.html", dark: "#ffb454", light: "#9a3412",
      emWindow: { lo: 29, hi: 212 },
      res: [8, 8, 33], viewer: "https://h01-dot-neuroglancer-demo.appspot.com/",
      volumes: [] },''',
  u'''    /* ── H01's BOX, AND WHERE IT COMES FROM ────────────────────────────────  2026-10-14
       Søren, on an ηJump post whose coordinate stayed plain text: *"It doesn\\u2019t work in
       hJump"*. This entry had `volumes: []` because I looked for the extent in hjump.html, which
       computes it at run time from the volume\\u2019s own info and keeps no constant.

       It was in emhjumpcheck.js all along, under "THE VOLUME\\u2019S REAL SHAPE, read through the
       JSON API on 2026-09-21": 4nm_raw\\u2019s finest level is 1,031,784 \\u00d7 712,800 \\u00d7 5,293 at
       4\\u00d74\\u00d733 nm, which is 4,127 \\u00d7 2,851 \\u00d7 175 \\u00b5m \\u2014 and the H01 paper describes about
       4 \\u00d7 3 mm of temporal cortex 150 \\u00b5m thick, so the box agrees with the publication as
       well as with the bucket. toolscheck.js recomputes it from that check\\u2019s own fixture.

       jsonApi: gs://h01-release sends NO CORS headers. hjump.html calls
       UJ.segread.useJsonApi("h01-release") at load for itself; a reader in another tool has never
       heard of it, so the name travels with the volume and core/empreview.js says it. */
    { key: "hjump", label: "ηJump", dataset: "H01 — human temporal cortex",
      page: "hjump.html", dark: "#ffb454", light: "#9a3412",
      emWindow: { lo: 29, hi: 212 },
      res: [8, 8, 33], viewer: "https://h01-dot-neuroglancer-demo.appspot.com/",
      volumes: [{ key: "h01", label: "H01",
        bb: { xmin: 0, xmax: 4127136, ymin: 0, ymax: 2851200, zmin: 0, zmax: 174669 },
        jsonApi: "h01-release",
        em: "precomputed://gs://h01-release/data/20210601/4nm_raw",
        /* c3 is uint64 compressed_segmentation, flat and sharded — the format core/segread.js
           indexes at a point, so the two 3D buttons work here. No nuclei volume exists. */
        seg: "precomputed://gs://h01-release/data/20210601/c3" }] },'''),

 (u"βJump's volume, from the shape embjumpcheck.js read off the bucket",
  u'''    { key: "bjump", label: "βJump", dataset: "Alzheimer's vCLEM — hippocampal CA1",
      page: "bjump.html", dark: "#ff6b81", light: "#a4133c",
      emWindow: { lo: 10, hi: 244 },
      res: [8, 8, 30], viewer: "https://neuroglancer-demo.appspot.com/",
      volumes: [] },''',
  u'''    /* ── AND βJUMP'S, THE SAME WAY ─────────────────────────────────────────  2026-10-14
       embjumpcheck.js, "THE VOLUME'S REAL SHAPE, read from its info through the JSON API on
       2026-09-20/21": em_clahe's finest level is 57,344 × 55,296 × 864 at 8×8×30 nm, which is
       459 × 442 × 26 µm. Its box is the SERVED VOLUME, not bjump.html's TISSUE_BOX_VOX — that
       one is the sub-volume the Hoechst detector was run over, and the imagery extends past it,
       so using it would refuse coordinates that are really there.

       gs://vclem-xh sends no CORS headers either; same JSON API, same reason. */
    { key: "bjump", label: "βJump", dataset: "Alzheimer's vCLEM — hippocampal CA1",
      page: "bjump.html", dark: "#ff6b81", light: "#a4133c",
      emWindow: { lo: 10, hi: 244 },
      res: [8, 8, 30], viewer: "https://neuroglancer-demo.appspot.com/",
      volumes: [{ key: "vclem-ca1", label: "Alzheimer's vCLEM CA1",
        bb: { xmin: 0, xmax: 458752, ymin: 0, ymax: 442368, zmin: 0, zmax: 25920 },
        jsonApi: "vclem-xh",
        em: "precomputed://gs://vclem-xh/alzheimers/em_clahe",
        /* secgan16 is sharded compressed_segmentation and its ids are this page's own cells.
           The Hoechst blobs are not a segmentation, so there is still no `nuc`. */
        seg: "precomputed://gs://vclem-xh/alzheimers/segmentation_secgan_16nm" }] },'''),

 (u"...and the bucket that needs the JSON API travels with the volume",
  u'''    return { res: t.res.slice(), em: v.em || "",
             seg: readable(v.seg), nuc: readable(v.nuc),''',
  u'''    return { res: t.res.slice(), em: v.em || "",
             seg: readable(v.seg), nuc: readable(v.nuc),
             /* THE BUCKET THAT ANSWERS NOTHING WITHOUT THE JSON API. A page names its own at
                load; a reader in another tool has never heard of it, and without this an ηJump
                post would draw in ηJump and fail everywhere else. 2026-10-14. */
             jsonApi: v.jsonApi || "",'''),
])

edit("core/empreview.js", [

 (u"a bucket with no CORS headers is named before it is read",
  u'''    var mine = { em: cfg.em, res: cfg.res, skipScales: cfg.skipScales || [] };''',
  u'''    /* ── A BUCKET THAT SENDS NO CORS HEADERS ───────────────────────────────────────  2026-10-14
       gs://h01-release and gs://vclem-xh refuse the browser's ordinary public URL; Google's JSON
       API serves the same bytes with the headers, and core/segread.js routes a named bucket
       through it. Each page names its own at load — but this preview may be drawing ANOTHER
       tool's volume, and this page has never heard of that tool's bucket. Module-wide and
       idempotent, so saying it again costs nothing. */
    if (cfg.jsonApi && UJ.segread && UJ.segread.useJsonApi){
      try { UJ.segread.useJsonApi(cfg.jsonApi); } catch (_ja){}
    }
    var mine = { em: cfg.em, res: cfg.res, skipScales: cfg.skipScales || [] };'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_T = io.open(os.path.join(HERE, "core/tools.js"), encoding="utf-8").read()
for _k, _n in [(u'key: "h01"', 1), (u'key: "vclem-ca1"', 1),
               (u'jsonApi: "h01-release"', 1), (u'jsonApi: "vclem-xh"', 1),
               (u"jsonApi: v.jsonApi || \"\",", 1)]:
    assert _T.count(_k) == _n, "%d of %r in core/tools.js, wanted %d" % (_T.count(_k), _k, _n)
assert u"volumes: [] }" not in _T.replace(u'volumes: [], perVolume: true }', u"~"), \
    "a tool still has an empty volume list other than ωJump"
# ...and the numbers are the product of the shapes above, not something typed twice.
assert (u"xmax: %d" % hx) in _T and (u"ymax: %d" % hy) in _T and (u"zmax: %d" % hz) in _T
assert (u"xmax: %d" % vx) in _T and (u"ymax: %d" % vy) in _T and (u"zmax: %d" % vz) in _T

_E = io.open(os.path.join(HERE, "core/empreview.js"), encoding="utf-8").read()
assert _E.count(u"UJ.segread.useJsonApi(cfg.jsonApi)") == 1
# BEFORE THE DRAW, not after it: naming the bucket once the first fetch has already been refused
# would be a fix that works on the second click and not the first.
assert _E.index(u"UJ.segread.useJsonApi(cfg.jsonApi)") < _E.index(u"var mine = { em: cfg.em")
print("done")
print("all applied")
