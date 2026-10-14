# -*- coding: utf-8 -*-
u"""A tick that turns the EM sweep into a block of tissue being peeled.                 2026-10-14

Søren, with a WEBKNOSSOS still: *"Can we make something like this instead for our Blender script
for colab? So that the limit to region download shows a box of tissue like this with pale
segmentations and then animates by removing layers from the top and revealing the 3D structure?"*
Asked how it should be chosen, and what the other segments should look like, he picked **a tick on
the panel** and **matched cells strong, the rest pale**.

── WHAT THE TICK TURNS ON, AND WHAT IT COSTS ─────────────────────────────────────────────────

Nothing is downloaded twice. The sweep already fetches the EM and the segmentation for the box and
writes every section as a PNG with the matched cells painted on it. The block adds:

  the four CUT faces   em_fetch.py keeps one strip of pixels per section from the finished
                       picture and writes em_wall_x0/x1/y0/y1.png -- a few hundred KB
  the pale wash        every OTHER segment at 35%, lifted towards white, UNDER the matched
                       cells. Without it a cut face is grey noise: a wall is mostly segments
                       nobody selected, so with only the matched cells painted there is nothing
                       on it to see. This is the "pale segmentations" in what he pointed at.

and blend_scene.py's add_em_walls() stands the four faces behind the sweeping plane, cropped at
the plane's own position -- so act zero builds the block up and act one eats it away, with the
cells coming out of solid tissue. The sweep's camera moves off the axis for a block, because
face-on the four walls are edge-on and a block is indistinguishable from a plane.

THE SEGMENTATION IS REQUIRED. With it off there is no wash, and four walls of grey noise is worse
than the sweep it replaced, so the tick falls back to 'sweep' rather than writing them.

── ONE DEFINITION, FIVE PANELS ───────────────────────────────────────────────────────────────

The same arrangement the traced-vasculature tick settled on in October, for the same reason: the
region box is hand-written in ujump, djump, pjump and hjump and shared in core/regionbox.js, and a
control written five times is a control corrected four times. The markup, the enable/disable and
the reading are UJ.blender.blockTickHtml / blockTickSync / blockStyleFrom, and each panel inserts
one expression, one line and one option.

Checks: blockpeelcheck.js (the tick and what it writes), emfetchcheck.py (the walls and the wash),
        blendscenecheck.py (the peel in the built scene)
Run: python3 src/a_block_of_tissue_that_peels.py
     python3 src/build_stamps.py
     node blockpeelcheck.js
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(rel, pairs):
    P = os.path.join(HERE, rel)
    s = io.open(P, encoding="utf-8").read()
    b = s
    print(rel)
    for name, old, new in pairs:
        if new in s:
            print("  already there: " + name)
            continue
        n = s.count(old)
        assert n == 1, "%s (%s): %d" % (name, os.path.basename(P), n)
        s = s.replace(old, new, 1)
        print("  ok: " + name)
    if s != b:
        io.open(P, "w", encoding="utf-8").write(s)


# ── 1. the tick, its enable/disable, and its reading ──────────────────────────────────────────
TICK = u'''
  /* ── THE BLOCK TICK ──────────────────────────────────────────────────────────  2026-10-14
     Søren, with a WEBKNOSSOS still: "a box of tissue like this with pale segmentations ... and
     then animates by removing layers from the top and revealing the 3D structure."

     Off is the plain sweep, which is what every export has done so far. On, the same sections
     are the near face of a solid block whose four cut faces stand behind them and are peeled
     back in step, and every other segment gets a pale wash so those faces read as tissue.

     THE WASH NEEDS THE SEGMENTATION, so with Segmentation unticked this says sweep: four walls
     of grey noise would be worse than the sweep it replaced. The same condition is applied again
     where the parameter is written, because a page cached from before this change sends no
     emStyle at all and the notebook must still be right.

     Markup here rather than in the five panels, for the reason vesselTickHtml gives above. */
  function blockTickHtml(){
    return '<label class="colab-block-lab" style="font-size:11px;color:var(--mut);display:flex;'
      + 'align-items:center;gap:3px;cursor:pointer" title="Instead of one plane travelling '
      + 'through the sections, the box is a solid block of tissue: the sections are its near face '
      + 'and its four cut faces stand behind them, with every segment the box contains washed in '
      + 'pale colour and the matched cells painted strongly over it. The animation then peels the '
      + 'block away from the front, so the 3D models come out of the tissue. Needs Segmentation. '
      + 'Blender file only.">'
      + '<input type="checkbox" class="colab-block">Peel a block</label>';
  }
  /* Blender-only, like the Nuclei and Vasculature ticks: the EM/segmentation notebook writes PNG
     sections and has no scene to put a block in. Each panel adds this one line to the closure
     that already follows its Blender tick. */
  function blockTickSync(row, on){
    var tick = row && row.querySelector(".colab-block");
    var lab = row && row.querySelector(".colab-block-lab");
    if (!tick) return;
    tick.disabled = !on;
    if (lab){
      lab.style.opacity = on ? "" : "0.45";
      if (!on) lab.title = "The block is part of the Blender scene only \\u2014 the "
        + "EM/segmentation notebook has no 3D step. Tick \\u201cBlender file\\u201d to enable this.";
    }
  }
  function blockStyleFrom(row){
    var tick = row && row.querySelector(".colab-block");
    return (tick && tick.checked && !tick.disabled) ? "block" : "sweep";
  }
'''

ANCHOR = u'''  return {buildNotebook, downloadNotebook, filenameFor, brandFromPage,'''

edit("core/blenderexport.js", [
    (u"the tick, its sync and its reading, in one place", ANCHOR, TICK + ANCHOR),
    (u"...on the module",
     u'''          vesselTickHtml, vesselWantFrom, vesselTickSync};''',
     u'''          vesselTickHtml, vesselWantFrom, vesselTickSync,
          blockTickHtml, blockTickSync, blockStyleFrom};'''),
    # ── 2. the two parameters the notebook reads ──────────────────────────────────────────────
    (u"the style and the wash go into the params cell",
     u'''    lines.push("OVERLAY_OPACITY = 0.35");''',
     u'''    lines.push("OVERLAY_OPACITY = 0.35");
    /* ── A SWEEP, OR A BLOCK ──────────────────────────────────────────────────  2026-10-14
       'block' costs four more PNGs -- the box's cut faces, one strip of pixels per section -- and
       turns on the pale wash, which is what makes a cut face read as tissue. Both are written
       here as one decision, and the segmentation has a veto: see src/a_block_of_tissue_that_peels
       .py. A page that sends no emStyle gets the sweep, which is what it has always got. */
    var blockStyle = opts.emStyle === "block" && inc.seg !== false;
    lines.push("EM_STYLE        = " + pyStr(blockStyle ? "block" : "sweep"));
    lines.push("EM_WASH_OPACITY = 0.35    # every OTHER segment, pale, under the matched cells");'''),
])

# ── 3. the five panels ────────────────────────────────────────────────────────────────────────
# Four hand-written ones in the pages, and the shared one in core/regionbox.js. Each gets the
# markup beside the vasculature tick, the sync line beside the vasculature sync, and the option
# beside `vessels`. The pages write their panel without spaces and the module with them, which is
# why the anchors differ -- the same three insertions either way.
#
# THE INDENT IS THE PAGE'S OWN. ηJump's panel sits two columns to the left of the other three, so
# an anchor written out with ten spaces in front of it matched nothing there -- and the generator
# stopped half way through that page rather than writing a wrong one, which is the behaviour to
# keep. The option line is therefore anchored on whatever indentation the page's own `vessels:`
# line carries, and the new line is given the same.
def vessels_anchor(rel):
    s = io.open(os.path.join(HERE, rel), encoding="utf-8").read()
    hits = [l for l in s.split("\n") if l.strip() == "vessels:_ves,"]
    assert len(hits) == 1, "%s: %d vessels:_ves, lines" % (rel, len(hits))
    return hits[0], hits[0][:len(hits[0]) - len(hits[0].lstrip())]


for page in ("ujump.html", "djump.html", "pjump.html", "hjump.html"):
    _ves_line, _pad = vessels_anchor(page)
    edit(page, [
        (u"the tick is on the panel",
         u'''      +((window.UJ&&UJ.blender&&UJ.blender.vesselTickHtml)?UJ.blender.vesselTickHtml():"")''',
         u'''      +((window.UJ&&UJ.blender&&UJ.blender.vesselTickHtml)?UJ.blender.vesselTickHtml():"")
      +((window.UJ&&UJ.blender&&UJ.blender.blockTickHtml)?UJ.blender.blockTickHtml():"")'''),
        (u"...and follows the Blender tick",
         u'''        if(window.UJ&&UJ.blender&&UJ.blender.vesselTickSync)UJ.blender.vesselTickSync(row,bl.checked);''',
         u'''        if(window.UJ&&UJ.blender&&UJ.blender.vesselTickSync)UJ.blender.vesselTickSync(row,bl.checked);
        if(window.UJ&&UJ.blender&&UJ.blender.blockTickSync)UJ.blender.blockTickSync(row,bl.checked);'''),
        (u"...and what it says reaches the notebook", _ves_line,
         _ves_line + u'''
@PAD@emStyle:(window.UJ&&UJ.blender&&UJ.blender.blockStyleFrom)?UJ.blender.blockStyleFrom(row):"sweep",'''
         .replace(u"@PAD@", _pad)),
    ])

edit("core/regionbox.js", [
    (u"the tick is on the panel",
     u'''        + ((window.UJ && UJ.blender && UJ.blender.vesselTickHtml) ? UJ.blender.vesselTickHtml() : "")''',
     u'''        + ((window.UJ && UJ.blender && UJ.blender.vesselTickHtml) ? UJ.blender.vesselTickHtml() : "")
        + ((window.UJ && UJ.blender && UJ.blender.blockTickHtml) ? UJ.blender.blockTickHtml() : "")'''),
    (u"...and follows the Blender tick",
     u'''          if (UJ.blender && UJ.blender.vesselTickSync) UJ.blender.vesselTickSync(row, on);''',
     u'''          if (UJ.blender && UJ.blender.vesselTickSync) UJ.blender.vesselTickSync(row, on);
          if (UJ.blender && UJ.blender.blockTickSync) UJ.blender.blockTickSync(row, on);'''),
    (u"...and what it says reaches the notebook",
     u'''          vessels: _ves,''',
     u'''          vessels: _ves,
          /* Sweep or block -- see src/a_block_of_tissue_that_peels.py. */
          emStyle: (window.UJ && UJ.blender && UJ.blender.blockStyleFrom)
                   ? UJ.blender.blockStyleFrom(row) : "sweep",'''),
])

print("\nNow: python3 src/build_stamps.py, then python3 wjump-build/build_wjump.py"
      " and python3 xjump-build/build_xjump.py")
