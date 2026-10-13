# -*- coding: utf-8 -*-
r"""A coordinate is a picture in every tool.                                         2026-10-13

Søren, having opened the Discussion in δJump: *"when I paste a coordinate and then open it, it
opens neuroglancer and not EM with a possibility of a 3D window."*

HE IS RIGHT AND IT WAS HALF-DELIBERATE. This morning's change (src/the_discussion_reaches_every_tool
.py) found that core/forum.js's wirePreviews() returned before attaching ANY handler when
core/empreview.js was absent, so every link on the five pages that do not load it would have been
dead. The fix was to open the viewer instead, which is better than nothing and is not what the
Discussion was built to do: a coordinate in a post is a promise that something is there, and the
picture beside the sentence is what keeps it.

SO THE FIVE PAGES LOAD IT NOW, and the surprise is how little else they need. core/empreview.js
wants emtiles, segread, segpaint, mesh, nucmesh and mesh3d -- and every one of those is already on
all five, because the tracing card is built on them. The module itself was the only thing missing.

AND NOBODY HAND-WRITES emPreviewHost(). That hook is µJump's, written when the Discussion was only
there; it carries the nucleus table behind "cell 253863", the type name drawn in the corner of the
picture, and whichever viewer the reader picked -- none of which the other tools have. Writing six
more of them would be six more copies of six volumes' sources, drifting. core/tools.js already
holds those sources, verified, so emHostFor() builds the same object out of the registry and the
forum hands it over. µJump's own hook still wins where it exists.

THE EM WINDOW IS PART OF A VOLUME, which is the one new fact per tool. core/emtiles.js stretches
[lo,hi] to black-white and defaults to 86/172 -- minnie65's numbers. V1DD's tissue is a band 29
counts wide (115-144) and λJump's is 27-240; drawn with µJump's window either one is a grey slab.
Each page already has its own EM_WINDOW constant and they are copied here beside the sources they
belong to, with a check that reads them back out of the pages.

AND THE TWO 3D BUTTONS GO WHERE THERE IS NO SEGMENTATION. λJump is image only. A button whose only
possible outcome is "there is no segmentation here" is a worse answer than no button.

NOT ωJUMP. It inlines no core/empreview.js and its emPreviewHost would have to follow sixty-three
volumes; and not the FOREIGN case yet -- a δJump coordinate read in µJump still opens the viewer,
because drawing it means pointing core/emtiles.js at another volume and back, and that module is a
page-wide singleton the tracing pad is also using.

Changes: core/tools.js, core/empreview.js, core/forum.js,
         djump.html, pjump.html, ljump.html, hjump.html, bjump.html
Checks:  forumtabcheck.js (extended), empreviewcheck.js, toolscheck.js (extended)
Run: python3 src/a_coordinate_is_a_picture_in_every_tool.py
     node toolscheck.js && node forumtabcheck.js && node empreviewcheck.js
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


# ── 1. the registry carries each volume's EM window, and can hand out a preview host ──────────
# THE NUMBERS ARE EACH PAGE'S OWN EM_WINDOW, and toolscheck.js reads them back out of the pages
# rather than taking this file's word for it. A window copied wrong is not an error anywhere: it
# is a picture of the right tissue that looks like a grey slab, which reads as a broken reader.
WINDOWS = [
    ("ujump", 86, 172), ("djump", 115, 144), ("pjump", 33, 231), ("ljump", 27, 240),
    ("hjump", 29, 212), ("bjump", 10, 244), ("xjump", 29, 233),
]
# Inserted immediately before each entry's `res:`, which is the line the window belongs beside —
# a volume's contrast and its voxel size are the same kind of fact. Done by hand rather than
# through edit() because the anchor is the same six characters in every entry.
_P = os.path.join(HERE, "core/tools.js")
_s = io.open(_P, encoding="utf-8").read()
print("core/tools.js")
for key, lo, hi in WINDOWS:
    marker = u'{ key: "' + key + u'", label:'
    assert _s.count(marker) == 1, "%d entries for %s" % (_s.count(marker), key)
    i = _s.index(marker)
    j = _s.index(u"res: ", i)
    if _s[i:j].find(u"emWindow:") >= 0:
        print("  already there: the EM window for " + key); continue
    _s = _s[:j] + (u"emWindow: { lo: %d, hi: %d },\n      " % (lo, hi)) + _s[j:]
    print("  ok: the EM window for " + key)
io.open(_P, "w", encoding="utf-8").write(_s)

edit("core/tools.js", [

 (u"ωJump's window is per dataset, and is not one number",
  u'''    { key: "wjump", label: "ωJump", dataset: "63 volumes — OpenOrganelle and others",
      page: "wjump.html", dark: "#fbbf24", light: "#854d0e",
      res: null, viewer: "https://neuroglancer-demo.appspot.com/",''',
  u'''    /* NO emWindow: ωJump's sixty-three volumes include two uint16 blocks whose tissue is a
       band 2,000 counts wide at 33,000, and a single pair of numbers for "ωJump" would be a
       false statement about sixty-two of them. Its own page reads each dataset's own. */
    { key: "wjump", label: "ωJump", dataset: "63 volumes — OpenOrganelle and others",
      page: "wjump.html", dark: "#fbbf24", light: "#854d0e",
      res: null, viewer: "https://neuroglancer-demo.appspot.com/",'''),

 (u"a host core/empreview.js can draw from",
  u'''  function hostFor(k){''',
  u'''  /* ── AND A HOST FOR THE PICTURE ────────────────────────────────────────────────  2026-10-13
     Søren, with the Discussion open in δJump: *"when I paste a coordinate and then open it, it
     opens neuroglancer and not EM with a possibility of a 3D window."*

     core/empreview.js reads window.emPreviewHost(). µJump has one, written when the Discussion
     was only there, and it carries things the registry cannot: the nucleus table behind
     “cell 253863”, the long type name drawn in the corner of the picture, the viewer the reader
     picked from the dropdown. The other seven have none, and writing seven would be seven more
     copies of seven volumes' sources to keep in step.

     So this builds one out of what is already here. The page's own hook still wins where it
     exists; core/forum.js reaches for this only when there is none.

     `vox` PICKS THE VOLUME where a tool has more than one — µJump's two slabs — and is ignored
     by everything else. Null for a tool with no verified box, which is the same answer hostFor()
     gives and for the same reason. */
  function emHostFor(k, vox){
    var t = byKey(k);
    if (!t || !t.res || !(t.volumes || []).length) return null;
    var v = t.volumes[0], i;
    if (vox && t.volumes.length > 1){
      var nm = [vox[0] * t.res[0], vox[1] * t.res[1], vox[2] * t.res[2]];
      for (i = 0; i < t.volumes.length; i++){
        var bb = t.volumes[i].bb;
        if (bb && nm[0] >= bb.xmin && nm[0] <= bb.xmax && nm[1] >= bb.ymin && nm[1] <= bb.ymax
            && nm[2] >= bb.zmin && nm[2] <= bb.zmax){ v = t.volumes[i]; break; }
      }
    }
    var h = hostFor(k);
    return { res: t.res.slice(), em: v.em || "", seg: v.seg || "", nuc: v.nuc || "",
             window: t.emWindow ? { lo: t.emWindow.lo, hi: t.emWindow.hi } : null,
             volume: v.key, tool: t.key, label: t.label,
             /* The picture is a link, and it is the same link core/jumplink.js would write for
                this place in this tool — built from the host rather than from a second opinion. */
             viewerUrl: function(pos){
               try {
                 if (window.UJ && UJ.jumplink && h)
                   return UJ.jumplink.url(UJ.jumplink.scan(pos.join(", "), { host: h }),
                                          { host: h }) || "";
               } catch (_e){}
               return "";
             } };
  }

  function hostFor(k){'''),

 (u"...and it is exported too",
  u'''  return { all: all, keys: keys, byKey: byKey, label: label, dataset: dataset,
           boxed: boxed, manyVolumes: manyVolumes,
           css: css, styleEl: styleEl, hostFor: hostFor };''',
  u'''  return { all: all, keys: keys, byKey: byKey, label: label, dataset: dataset,
           boxed: boxed, manyVolumes: manyVolumes,
           css: css, styleEl: styleEl, hostFor: hostFor, emHostFor: emHostFor };'''),
])

# ── 2. the preview can be told which host to draw from, and drops the buttons it cannot honour ─
edit("core/empreview.js", [

 (u"the host may be given rather than looked up",
  u'''async function open(hostEl, pos, opts){
  if (!hostEl) return;
  var cfg = hostCfg();''',
  u'''async function open(hostEl, pos, opts){
  if (!hostEl) return;
  /* ── A HOST MAY BE HANDED IN ───────────────────────────────────────────────────  2026-10-13
     window.emPreviewHost() is this page's own, and it is the right answer wherever it exists —
     µJump's carries a nucleus table, a type name and the reader's chosen viewer. Seven tools have
     none, and core/tools.js can build one out of the registry's verified sources, so core/forum.js
     passes that instead of leaving the picture undrawn. Nothing else changes: `cfg` is read
     exactly as before, from one place or the other. */
  var cfg = (opts && opts.host) || hostCfg();'''),

 (u"...and the 3D buttons are not offered where there is nothing to segment",
  u'''       + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">'
       + '<button type="button" class="hist-chip emp-cell" title="Looks up the cell whose '
         + 'segmentation covers this exact point, fetches its mesh and draws it beside the EM. The '
         + 'mesh is megabytes, so it is only fetched when you press this.">The cell here in 3D</button>'
       + '<button type="button" class="hist-chip emp-nuc" title="The nucleus of that same cell, '
         + 'from the nuclei volume, drawn in blue inside it.">and its nucleus</button>'
       + '<span class="hint emp-say" style="flex:1 1 140px;min-width:0"></span>'
       + "</div></div>";''',
  u'''       + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">'
       /* ── ONLY WHERE THERE IS A SEGMENTATION TO READ ────────────────────────────  2026-10-13
          λJump is image only, and the Eyewire-style volumes behind other tools may be too. A
          button whose single possible outcome is "there is no segmentation here" is a worse
          answer than no button: it offers something and then explains that it was never there. */
       + ((cfg && cfg.seg)
          ? '<button type="button" class="hist-chip emp-cell" title="Looks up the cell whose '
            + 'segmentation covers this exact point, fetches its mesh and draws it beside the EM. '
            + 'The mesh is megabytes, so it is only fetched when you press this.">The cell here in '
            + '3D</button>'
            + '<button type="button" class="hist-chip emp-nuc" title="The nucleus of that same '
            + 'cell, from the nuclei volume, drawn in blue inside it.">and its nucleus</button>'
          : "")
       + '<span class="hint emp-say" style="flex:1 1 140px;min-width:0"></span>'
       + "</div></div>";'''),

 (u"...and the wiring says their absence is intended",
  u'''  var cellBtn = hostEl.querySelector(".emp-cell"), nucBtn = hostEl.querySelector(".emp-nuc");''',
  u'''  /* BOTH ARE ABSENT ON AN IMAGE-ONLY VOLUME since 2026-10-13, and both uses below were already
     guarded — this is the note that says the null is intended rather than a selector that quietly
     stopped matching. */
  var cellBtn = hostEl.querySelector(".emp-cell"), nucBtn = hostEl.querySelector(".emp-nuc");'''),
])

# ── 3. the forum draws with the registry's host where the page has none ──────────────────────
edit("core/forum.js", [

 (u"a post's own places are drawn, not only linked",
  u'''        if (!canDraw){''',
  u'''        /* ── AND THE PICTURE, ON A PAGE THAT DECLARES NO HOST ──────────────────────  2026-10-13
           Søren: *"when I paste a coordinate and then open it, it opens neuroglancer and not EM
           with a possibility of a 3D window."*  core/empreview.js is loaded on these pages now;
           what it has nowhere but µJump is window.emPreviewHost(). core/tools.js builds one from
           the registry's verified sources, so the picture is drawn here rather than left to a
           new tab. µJump's own hook wins where it exists — it carries a nucleus table and a type
           name the registry has no idea about. */
        if (canDraw && typeof window.emPreviewHost !== "function" && !EMHOST){
          try {
            if (window.UJ && UJ.tools && UJ.tools.emHostFor)
              EMHOST = UJ.tools.emHostFor(TOOL, h.voxel) || null;
          } catch (_eh){}
        }
        if (canDraw && !EMHOST && typeof window.emPreviewHost !== "function") canDraw = false;
        if (!canDraw){'''),

 (u"...and the host it found is used for the drawing",
  u'''        open = key;
        UJ.empreview.open(slot, at, { ids: ids });''',
  u'''        open = key;
        UJ.empreview.open(slot, at, EMHOST ? { ids: ids, host: EMHOST } : { ids: ids });'''),

 (u"...and the compose box's preview too",
  u'''    if (!at){ UJ.empreview.close(slot); return; }
    UJ.empreview.open(slot, at, { ids: ids });''',
  u'''    if (!at){ UJ.empreview.close(slot); return; }
    var eh = null;
    if (typeof window.emPreviewHost !== "function"){
      try {
        if (window.UJ && UJ.tools && UJ.tools.emHostFor) eh = UJ.tools.emHostFor(TOOL, at);
      } catch (_eh){}
      if (!eh) return;
    }
    UJ.empreview.open(slot, at, eh ? { ids: ids, host: eh } : { ids: ids });'''),

 (u"the host the registry built is remembered for the session",
  u'''var OPEN = "", MODE = "";
var STREAM = "tools";''',
  u'''var OPEN = "", MODE = "";
var STREAM = "tools";
/* This tool's EM host, built once from core/tools.js on a page that declares no emPreviewHost().
   Held rather than rebuilt per click because it closes over a viewerUrl() the picture uses, and
   because rebuilding it would make two pictures of the same place two different objects. */
var EMHOST = null;'''),
])

# ── 4. the five pages load the module they already have every dependency for ─────────────────
SCRIPT = (u'<!-- A coordinate in a post becomes a picture: the EM here, its scale bar, and the cell\n'
          u'     in 3D beside it — core/empreview.js, 2026-10-13. Before core/forum.js, which opens\n'
          u'     one per coordinate. Everything it is built on (emtiles, segread, segpaint, mesh,\n'
          u'     nucmesh, mesh3d) is already here for the tracing card. -->\n'
          u'<script src="core/empreview.js"></script>\n')

for page in ["djump.html", "pjump.html", "ljump.html", "hjump.html", "bjump.html"]:
    edit(page, [
        (u"core/empreview.js, before the forum that opens it",
         u'<!-- THE REGISTRY OF JUMPS:', SCRIPT + u'<!-- THE REGISTRY OF JUMPS:'),
    ])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_T = io.open(os.path.join(HERE, "core/tools.js"), encoding="utf-8").read()
assert _T.count(u"function emHostFor(k, vox){") == 1
assert _T.count(u"emHostFor: emHostFor") == 1
assert _T.count(u"emWindow: { lo:") == 7, \
    "%d EM windows, wanted 7 (ωJump has none on purpose)" % _T.count(u"emWindow: { lo:")

_E = io.open(os.path.join(HERE, "core/empreview.js"), encoding="utf-8").read()
assert _E.count(u"var cfg = (opts && opts.host) || hostCfg();") == 1
assert _E.count(u"? '<button type=\"button\" class=\"hist-chip emp-cell\"") == 1
# ...and each button's whole block is behind a null check, because they are now sometimes absent.
for _b in [u"cellBtn", u"nucBtn"]:
    assert _E.count(u"if (" + _b + u") " + _b + u".addEventListener") == 1, \
        "%s is wired without a null check" % _b

_F = io.open(os.path.join(HERE, "core/forum.js"), encoding="utf-8").read()
assert _F.count(u"var EMHOST = null;") == 1
# Two: the post's own places, and the compose box's live preview.
assert _F.count(u"UJ.tools.emHostFor(") == 2, \
    "%d calls, wanted 2 (the post and the compose box)" % _F.count(u"UJ.tools.emHostFor(")

for page in ["djump.html", "pjump.html", "ljump.html", "hjump.html", "bjump.html"]:
    s = io.open(os.path.join(HERE, page), encoding="utf-8").read()
    assert s.count(u'<script src="core/empreview.js"></script>') == 1, page
    assert s.index(u'src="core/empreview.js"') < s.index(u'src="core/forum.js"'), \
        page + ": the preview must load before the forum that opens it"
print("done")
print("all applied")
