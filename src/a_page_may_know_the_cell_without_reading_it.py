# -*- coding: utf-8 -*-
r"""A page may know the cell without reading the segmentation.                       2026-10-13

Søren, having seen "No cell lookup here" under a δJump coordinate: he wants the 3D window to work
for δJump's own posts.

AND δJUMP ALREADY KNOWS THE ANSWER — it is on screen two cards up. Its cell card says "nearest
nucleus at voxel 112373, 55501, 7096 · 0.00 µm from query", and beside it the nucleus id and the
root id. That comes from the page's own nucleus table, not from reading the segmentation at a
point, which is why "show in 3D" works there while the Discussion's button could not: V1DD's
segmentation is graphene://middleauth+ and core/segread.js refuses one.

SO THE PAGE ANSWERS. core/empreview.js asks window.emPreviewCellAt(posVox) when it has no readable
segmentation, exactly as it already asks window.emPreviewHost() for the sources — one more optional
hook, defined by the one page that needs it.

AND IT IS A WEAKER ANSWER, SAID SO. segread.resolveAt names the cell the point is INSIDE; a nucleus
table names the cell whose nucleus is NEAREST. Those differ out in a process, and the preview
already has a place to say which of the two it used — `nucFrom`, written beside the ids. The hook
is consulted only where the strong answer is impossible: `!cfg.seg`.

CAPPED AT δJUMP'S OWN FAR_NUCLEUS_THRESH_NM, which is 3 µm there — the "trust this match"
distance its cell card has used since July, read from the page rather than retyped here. Past it
the hook says there is no nucleus near enough rather than naming one 40 µm away, and the preview
prints that sentence instead of a cell id.

AND ONLY FOR THIS PAGE'S OWN VOLUME. The hook reads δJump's table, which is about V1DD. Asked
about a µJump coordinate in a δJump post it would name a V1DD cell for a place in minnie65 —
the exact class of mistake core/tools.js exists to prevent — so core/forum.js marks the host it
builds for its own tool `own: true`, and the hook is consulted only then.

Changes: core/empreview.js, core/forum.js, djump.html
Checks:  forumtabcheck.js (extended), empreviewcheck.js
Run: python3 src/a_page_may_know_the_cell_without_reading_it.py
     node forumtabcheck.js && node empreviewcheck.js
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


edit("core/empreview.js", [

 (u"a page may answer the question the segmentation cannot be asked",
  u'''var NUC_NEAR_NM = 4000;
var AT = {};
async function cellAt(pos, cfg, note){
  var key = pos.join(",");
  if (AT[key]) return AT[key];
  if (!UJ.segread) return { error: "the segmentation reader did not load" };''',
  u'''var NUC_NEAR_NM = 4000;
/* ── OR THE PAGE'S OWN TABLE, WHERE THE SEGMENTATION CANNOT BE ASKED ───────────  2026-10-13
   V1DD's segmentation is graphene://middleauth+ and core/segread.js refuses one on purpose, so
   on δJump the question above has no answer — and yet the page knows it: its cell card reads the
   nearest nucleus out of its own table and shows that cell's root id. "Show in 3D" has always
   worked there for exactly this reason.

   window.emPreviewCellAt(posVox) -> { root, nuc, nucFrom } | null, defined by a page that has a
   nucleus table and no readable segmentation. One more optional hook beside emPreviewHost().

   IT IS THE WEAKER ANSWER AND IT SAYS SO. resolveAt names the cell the point is INSIDE; a table
   names the cell whose nucleus is NEAREST, and out in a process those are different cells. So it
   is asked ONLY where the strong answer is impossible, and whatever it puts in `nucFrom` is
   printed beside the ids.

   AND ONLY ABOUT THIS PAGE'S OWN VOLUME: cfg.own, set by core/forum.js for the tool it is running
   in. Asked about somebody else's coordinate this table would name a cell in the wrong tissue. */
function pageCellAt(cfg){
  if (!cfg || cfg.seg || !cfg.own) return null;
  return (typeof window.emPreviewCellAt === "function") ? window.emPreviewCellAt : null;
}
/* Whether a cell can be named here AT ALL, by either route. The two 3D buttons are drawn only
   when it can; before 2026-10-13 they were drawn always and δJump's answered "the segmentation
   could not be configured", which is a button apologising for having been offered. */
function canFindCell(cfg){ return !!(cfg && (cfg.seg || pageCellAt(cfg))); }
var AT = {};
async function cellAt(pos, cfg, note){
  var key = pos.join(",");
  if (AT[key]) return AT[key];
  var ask = pageCellAt(cfg);
  if (ask){
    note && note("looking up the cell here\\u2026");
    var hit = null;
    try { hit = await ask(pos.slice()); } catch (e){ hit = null; }
    if (hit && (hit.root || hit.nuc))
      return (AT[key] = { root: String(hit.root || ""), nuc: String(hit.nuc || ""),
                          nucFrom: hit.nucFrom || "from this page's nucleus table" });
    return { error: (hit && hit.why)
                 || "no nucleus near enough to this point in this page's own table" };
  }
  if (!UJ.segread) return { error: "the segmentation reader did not load" };'''),

 (u"...and the buttons follow whether a cell can be named at all",
  u'''       + ((cfg && cfg.seg)
          ? '<button type="button" class="hist-chip emp-cell" title="Looks up the cell whose ''',
  u'''       + (canFindCell(cfg)
          ? '<button type="button" class="hist-chip emp-cell" title="Looks up the cell whose '''),
])

edit("core/forum.js", [

 (u"the host built for our own tool says it is ours",
  u'''            if (window.UJ && UJ.tools && UJ.tools.emHostFor)
              EMHOST = UJ.tools.emHostFor(TOOL, h.voxel) || null;''',
  u'''            if (window.UJ && UJ.tools && UJ.tools.emHostFor)
              EMHOST = UJ.tools.emHostFor(TOOL, h.voxel) || null;
            /* OURS, so core/empreview.js may ask this page's own nucleus table about a point it
               cannot read the segmentation at. A host for somebody else's tool never carries
               this: that table is about this volume. */
            if (EMHOST) EMHOST.own = true;'''),

 (u"...and so does the compose box's",
  u'''        if (window.UJ && UJ.tools && UJ.tools.emHostFor) eh = UJ.tools.emHostFor(TOOL, at);
      } catch (_eh){}''',
  u'''        if (window.UJ && UJ.tools && UJ.tools.emHostFor) eh = UJ.tools.emHostFor(TOOL, at);
        if (eh) eh.own = true;
      } catch (_eh){}'''),
])

# ── δJump answers it, out of the table its own cell card reads ───────────────────────────────
# Inserted AFTER nearest(), in the script block that defines it, rather than beside the <script
# src> that reads it. Function declarations hoist, so either position runs — but a hook that reads
# a table printed above a hook that builds it is the order somebody checking this will expect, and
# the guard below asserts it rather than leaving it to luck.
HOOK = u'''
/* ── WHICH CELL IS AT THIS POINT, WITHOUT READING THE SEGMENTATION ─────  2026-10-13
   core/empreview.js asks this when it has no segmentation it can index — which is δJump's
   permanent situation, because V1DD's is graphene://middleauth+ and core/segread.js refuses one
   rather than hand back supervoxel ids. See src/a_page_may_know_the_cell_without_reading_it.py.

   THIS IS THE CELL CARD'S OWN ANSWER, through the same nearest() and the same rootId() the panel
   two cards up already prints as "nearest nucleus at voxel … · 0.00 µm from query". Not a
   second opinion: a cell this page can find by clicking is a cell the Discussion can draw.

   AND THE SAME 5 µm CAP, FAR_NUCLEUS_THRESH_NM, which this tool has used since July for exactly
   this question. Past it there is genuinely no detected nucleus near the point, and saying so is
   better than naming one 40 µm away and calling it the cell here. */
window.emPreviewCellAt=function(vox){
  try{
    if(typeof nearest!=="function"||typeof N==="undefined"||!N)return null;
    const r=nearest(vox[0],vox[1],vox[2]);
    if(!r||r.i<0)return null;
    const cap=(typeof FAR_NUCLEUS_THRESH_NM!=="undefined")?FAR_NUCLEUS_THRESH_NM:5000;
    if(r.dist>cap)
      return {why:"the nearest detected nucleus is "+(r.dist/1000).toFixed(1)+" \\u00b5m away, past "
                 +"this tool's "+(cap/1000)+" \\u00b5m limit \\u2014 too far to call it the cell here"};
    const root=rootId(r.i);
    return {root:root||"",nuc:String(NID[r.i]||""),
            nucFrom:"nearest nucleus in this tool's table, "+(r.dist/1000).toFixed(1)+" \\u00b5m away"};
  }catch(e){ return null; }
};
'''

NEAREST = (u"function nearest(vx,vy,vz){let b=-1,bd=Infinity;for(let i=0;i<N;i++)"
           u"{const dx=(vx-NX[i])*UJ_RX,dy=(vy-NY[i])*UJ_RY,dz=(vz-NZ[i])*UJ_RZ,"
           u"d=dx*dx+dy*dy+dz*dz;if(d<bd){bd=d;b=i;}}return{i:b,dist:Math.sqrt(bd)};}\n")

edit("djump.html", [
    (u"δJump answers which cell is at a point, from its own table",
     NEAREST, NEAREST + HOOK),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_E = io.open(os.path.join(HERE, "core/empreview.js"), encoding="utf-8").read()
assert _E.count(u"function pageCellAt(cfg){") == 1
assert _E.count(u"function canFindCell(cfg){") == 1
assert _E.count(u"canFindCell(cfg)") == 2, \
    "%d uses of canFindCell -- its definition and the buttons" % _E.count(u"canFindCell(cfg)")
# THE STRONG ANSWER STILL WINS WHERE IT EXISTS. pageCellAt() returns null the moment there is a
# segmentation to read, so µJump's path through resolveAt is untouched -- the one thing this
# change must not do is make a page prefer a nearest-nucleus guess to a voxel it can read.
assert _E.count(u"if (!cfg || cfg.seg || !cfg.own) return null;") == 1

_F = io.open(os.path.join(HERE, "core/forum.js"), encoding="utf-8").read()
assert _F.count(u".own = true;") == 2, \
    "%d hosts marked ours -- the post's and the compose box's" % _F.count(u".own = true;")
assert u"EMHOST.own = true" in _F and u"eh.own = true" in _F

_D = io.open(os.path.join(HERE, "djump.html"), encoding="utf-8").read()
assert _D.count(u"window.emPreviewCellAt=function(vox){") == 1
# ...AND IT IS DEFINED AFTER THE TABLE IT READS. nearest(), rootId() and NID are declared further
# up this file; a hook defined before them still works (it runs on a click, long after parse), but
# the ORDER IS ASSERTED anyway because a reader will ask, and because moving it above the data
# block would make the first click throw instead of answering.
assert _D.index(u"function rootId(i){") < _D.index(u"window.emPreviewCellAt=function(vox){")
assert _D.index(u"function nearest(vx,vy,vz){") < _D.index(u"window.emPreviewCellAt=function(vox){")
# core/empreview.js's <script> is earlier in the file than this hook, and that is fine: the hook
# is read on a click, long after the whole document has parsed. What matters is that it comes
# after the table, which the two assertions above hold.
print("done")
print("all applied")
