# -*- coding: utf-8 -*-
u"""The tool cards read at a glance.                                               2026-10-18

Søren, looking at µJump's card on his phone: *"I think the resolution and the dimensions could be
written together with the volume. Maybe with symbols making it quicker to understand. Write
percentage of classified cells instead of classified and unclassified. Drop the hand verified.
Cell contacts and connectivity. Show in VR and make movies. Move microns to beginning and remove
the 65. Segment cells and organelles online. Change in a similar way for all tools."*

WHAT MOVES WHERE

  The figure under the box now carries three lines, each behind a small drawn symbol rather than a
  word: the VOLUME (a cube, as before), the EXTENT (a double arrow) and the VOXEL (a pixel grid).
  They are the three numbers that describe the box the drawing shows, so they belong beside it,
  and taking them out of the chips leaves the chips for what the tool DOES. ωJump keeps its range
  of volumes there and its resolution ranges in chips: 62 volumes have no one extent or voxel, and
  wjcardcheck.js reads those ranges back off the card.

  The two counts "N classified" and "M unclassified" become one "P% classified" beside the
  nucleus count. Rounded to a whole percent, except where rounding would say 0% of something that
  is not nothing or 100% of something that is not everything (πJump: 451 of 452 is 99.8%).
  χJump and ωJump have no cell list, so they had "0 classified" against nothing; that chip goes
  and their "you build it" chips already say why.

  The dataset's NAME is the first chip ("MICrONS", no longer "MICrONS minnie65" -- the name a
  reader knows, and the card for pinky100 still says pinky100 because there it is the
  distinction).

  The features, one wording on every card that has them, so they can be compared:
    Cell contacts & connectivity   µJump, δJump, πJump (πJump's "no login" kept)
    Cell contacts                  ηJump, χJump, βJump (contacts, no synapse table)
    Show in VR & make movies       the five tools with meshes in the VR viewer
    Traced cells in VR & movies    λJump and χJump, whose cells are their tracings
    Segment cells & organelles online   all eight (the tracing pad)
  "Hand-verified layers & vasculature" is dropped, as asked.

"33 cell types to choose from" (2026-10-18, replacing "16 cell classes", which counted the
  labels of the Allen metamodel table embedded in µJump): the end points of µJump's guided-ID tree
  in core/ontology.js -- 33 reachable leaves. The three pericyte subtypes are asked but recorded as
  "Pericyte" (LEAF_SUBMIT_CANON), and the generic excitatory/inhibitory fallbacks are no longer
  offered, so neither adds to the count.

Idempotent: a card already rewritten (it has a .vf line in its figure) is left alone.
"""
import re, sys, io

PATH = sys.argv[1] if len(sys.argv) > 1 else "index.html"
s = io.open(PATH, encoding="utf-8").read()

ICONS = u'''<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="vi-vol" viewBox="0 0 16 16"><path d="M8 1.8 14 5v6.2L8 14.4 2 11.2V5Z M2 5l6 3.2L14 5 M8 8.2v6.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></symbol>
  <symbol id="vi-ext" viewBox="0 0 16 16"><path d="M1.5 8h13 M1.5 8l3-3 M1.5 8l3 3 M14.5 8l-3-3 M14.5 8l-3 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="vi-vox" viewBox="0 0 16 16"><path d="M2 2h12v12H2Z M6 2v12 M10 2v12 M2 6h12 M2 10h12" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M6 6h4v4H6Z" fill="currentColor" fill-opacity=".55"/></symbol>
</svg>'''

CSS = u'''  /* The three numbers that describe the drawn box, each behind its own symbol (2026-10-18):
     volume (cube), extent (double arrow), voxel (pixel grid). See the_card_reads_at_a_glance.py. */
  .volbox .vf{display:flex;align-items:center;gap:6px;line-height:1.55}
  .volbox .vi{width:12px;height:12px;flex:none;opacity:.8}
  @media(min-width:820px){ .volbox .vf{justify-content:flex-end} }
'''

def fig(vol, ext=None, vox=None):
    out = [u'<span class="vf" title="Volume"><svg class="vi"><use href="#vi-vol"/></svg>' + vol + u'</span>']
    if ext: out.append(u'<span class="vf" title="Extent (x × y × z)"><svg class="vi"><use href="#vi-ext"/></svg>' + ext + u'</span>')
    if vox: out.append(u'<span class="vf" title="Voxel size (x × y × z)"><svg class="vi"><use href="#vi-vox"/></svg>' + vox + u'</span>')
    return u'<figcaption>\n        ' + u'\n        '.join(out) + u'\n      </figcaption>'

def pct(c, n):
    p = 100.0 * c / n
    r = int(round(p))
    if (r == 100 and c < n) or (r == 0 and c > 0): return u"%.1f%%" % p
    return u"%d%%" % r

NM = u"&nbsp;nm"; MM = u"&nbsp;mm"; UM = u"&nbsp;&micro;m"
FEAT = {
  "conn": u"Cell contacts &amp; connectivity", "cont": u"Cell contacts",
  "vr": u"Show in VR &amp; make movies", "vrt": u"Traced cells in VR &amp; movies",
  "seg": u"Segment cells &amp; organelles online", "mesh": u"3D mesh, PowerPoint &amp; Excel",
}
CARDS = [
  # href, volume caption (as it stands), extent, voxel, chips
  ("/ujump.html", u"1.7 &times; 1.4 &times; 0.5" + MM, u"4 &times; 4 &times; 40" + NM,
   [u"MICrONS", u"Mouse visual cortex", u"144,118 nuclei", pct(94008, 144118) + u" classified", u"33 cell types to choose from",
    FEAT["conn"], FEAT["vr"], FEAT["seg"], FEAT["mesh"]]),
  ("/djump.html", u"1.8 &times; 1.1 &times; 0.8" + MM, u"9 &times; 9 &times; 45" + NM,
   [u"Allen Institute V1DD", u"Mouse visual cortex", u"207,455 nuclei", pct(48077, 207455) + u" classified",
    u"Neurons only &mdash; glia unnamed", u"Pia to white matter", u"Layers fitted from the data",
    FEAT["conn"], FEAT["vr"], FEAT["seg"], FEAT["mesh"], u"Free CAVE account to view segmentation"]),
  ("/pjump.html", u"360 &times; 215 &times; 87" + UM, u"4 &times; 4 &times; 40" + NM,
   [u"MICrONS pinky100", u"Mouse visual cortex", u"452 somas &mdash; finishable", pct(451, 452) + u" classified",
    u"Proofread soma-to-soma graph", u"Cell contacts &amp; connectivity, no login",
    FEAT["vr"], FEAT["seg"], FEAT["mesh"], u"Cell table CC-BY-4.0"]),
  ("/ljump.html", u"454 &times; 448 &times; 33" + UM, u"4 &times; 4 &times; 40" + NM,
   [u"Lee16 serial-section TEM", u"Mouse visual cortex", u"488 nuclei", pct(0, 488) + u" classified",
    u"Leptomeninges imaged", u"Depth from the traced pia", u"No segmentation &mdash; cells are traced",
    FEAT["seg"], FEAT["vrt"], u"ODC-By v1.0"]),
  ("/hjump.html", u"3 &times; 2 &times; 0.17" + MM, u"8 &times; 8 &times; 33" + NM,
   [u"H01 &mdash; Lichtman lab &amp; Google", u"Human cortex", u"47,447 cells", pct(46173, 47447) + u" classified",
    u"Oligodendrocytes the largest class", u"Pia to white matter", u"Cortical layers from the volume",
    FEAT["cont"], FEAT["vr"], FEAT["seg"], FEAT["mesh"]]),
  ("/xjump.html", u"998 &times; 922 &times; 48" + UM, u"4 &times; 4 &times; 40" + NM,
   [u"cb2 &mdash; one cell, many fragments", u"Mouse cerebellar cortex", u"No cell list &mdash; fragments, not cells",
    u"Every cell &mdash; you build it", u"Free-text cell names", u"Community assembly",
    FEAT["cont"], FEAT["seg"], FEAT["vrt"], u"Public via BossDB; no reuse terms stated"]),
  ("/bjump.html", u"240 &times; 245 &times; 26" + UM, u"8 &times; 8 &times; 30" + NM,
   [u"vCLEM &mdash; fluorescence on EM", u"Alzheimer's model, hippocampal CA1", u"220 nuclei", pct(0, 220) + u" classified",
    u"No machine prediction", u"Amyloid-&beta;, pTau &amp; CD11b readout", u"Correct the detections",
    FEAT["cont"], FEAT["vr"], FEAT["seg"], FEAT["mesh"]]),
]

def card_span(href):
    i = s.index(u'" href="' + href + u'">')
    i = s.rindex(u'<a class="feature', 0, i)
    j = s.index(u'</a>', s.index(u'<span class="cta">', i)) + 4
    return i, j

def rewrite(c, ext, vox, chips):
    if u'class="vf"' in c: return c
    m = re.search(u'<figcaption>([\\s\\S]*?)</figcaption>', c)
    c = c[:m.start()] + fig(m.group(1).strip(), ext, vox) + c[m.end():]
    m = re.search(u'<div class="chips">[\\s\\S]*?</div>', c)
    body = u'\n'.join(u'      <span class="chip">' + x + u'</span>' for x in chips)
    return c[:m.start()] + u'<div class="chips">\n' + body + u'\n    </div>' + c[m.end():]

for href, ext, vox, chips in CARDS:
    i, j = card_span(href)
    s = s[:i] + rewrite(s[i:j], ext, vox, chips) + s[j:]

# ωJump: its range stays the only line in the figure; its chips keep their wording (wjcardcheck
# reads them), gain the tracing pad, lose "0 classified", and lead with the sources.
i, j = card_span(u"/wjump.html")
c = s[i:j]
if u'class="vf"' not in c:
    m = re.search(u'<figcaption>([\\s\\S]*?)</figcaption>', c)
    c = c[:m.start()] + fig(m.group(1).strip()) + c[m.end():]
    chips = re.findall(u'<span class="chip">([\\s\\S]*?)</span>', c)
    chips = [x for x in chips if x.strip() != u"0 classified"]
    src = [x for x in chips if u"OpenOrganelle" in x and u"WEBKNOSSOS" in x]
    rest = [x for x in chips if x not in src]
    terms = [x for x in rest if x.startswith(u"Terms shown")]
    rest = [x for x in rest if x not in terms]
    chips = src + rest + [FEAT["seg"]] + terms
    m = re.search(u'<div class="chips">[\\s\\S]*?</div>', c)
    c = c[:m.start()] + u'<div class="chips">\n' + u'\n'.join(u'      <span class="chip">' + x + u'</span>' for x in chips) + u'\n    </div>' + c[m.end():]
    s = s[:i] + c + s[j:]

if u'id="vi-vol"' not in s:
    k = s.index(u'<div class="wrap" id="tools">')
    s = s[:k] + ICONS + u'\n' + s[k:]
if u'.volbox .vf{' not in s:
    k = s.index(u'  /* featured tool card */')
    s = s[:k] + CSS + s[k:]

io.open(PATH, "w", encoding="utf-8", newline="").write(s)
print("ok")
