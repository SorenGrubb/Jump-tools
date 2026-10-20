# -*- coding: utf-8 -*-
u"""A research page about the collaborations, not about me.  2026-10-19

Søren: *"I want the about page to be about these collaborations. I want these papers represented
and I want my collaborators listed. The most important are Gary Morris, Amreen Mughal, and
Changsi Cai. I want their profile pictures there as well. The papers should be presented with the
major findings and figures. Try to identify the coordinates from the figure images."*

WHAT THIS BUILDS
  research.html   — generated here, not hand-written, so the site chrome has ONE definition.
  index.html      — "Research" in the menu, and #about becomes three lines and a link.
  ujump.html      — ?at=x,y,z fills the coordinate box and presses Go, which is what makes a
                    figure caption on the research page a place you can actually stand in.

ONE DEFINITION OF THE CHROME. index.html holds the palette, the header, the sticky bar, the phone
panel, the footer and the two scripts that drive them. A second page that copied any of that would
be the fourth thing in this project to drift apart from its twin. So this generator READS
index.html and lifts those pieces verbatim; research.html is a build product, and a colour changed
on the front page is changed here by re-running this file.

THE COORDINATES ARE READ, NOT GUESSED. Four of the five papers print x,y,z under their figure
panels, inside the figure image — not in the PDF's text. They were pulled out by rendering each
figure at 400 dpi, running OCR over it and then reading the ones that mattered by eye, and every
triple was then put through the SAME test core/jumplink.js applies before it writes a link: does
it land inside one of µJump's two declared boxes? 152 of 168 candidates did. The 16 that did not
were either OCR damage (`3163, 99435, 17588` for `316354, 99435, 17588`; `203628, 3267, 15480` for
`203628, 103267, 15480`) or coordinates into h01 and CA1, which are different volumes with
different boxes. The h01 ones are printed here as text with no link, because ηJump does not
declare a box and a link this page cannot verify is a claim the paper did not make.

TWO OF THE FIVE SIT IN minnie35, not minnie65 — the leptomeninges work is on the pial surface,
which is in the lower slab. µJump has read both since 2026-10-03, so the links work; there is no
nucleus detection out there, and the caption says so rather than letting the panel look broken.

WHOLE FIGURES. Three of the five carry a NoDerivatives term (CC BY-ND on the waste-clearance
preprint, CC BY-NC-ND on the leptomeninges preprint) and one is a journal's typeset figure. Each
figure is therefore shown as published and downscaled, never cropped to the panel that would have
looked better, and #credits says which licence each one is under. The two that need Søren's
decision rather than mine are named there too.

THE PORTRAITS ARRIVED ON 2026-10-20 and are in research/people/. They are squared and cut down
by src/make_portraits.py, not by the browser: the circle uses object-fit:cover, which centre-crops,
and a centre crop of a tall head-and-shoulders photograph takes the chin off. The monogram stays
underneath as the fallback — a broken image icon on somebody's name is worse than their initials —
and is wired in script rather than in an onerror attribute, for the same reason everything else on
this site is.

Check: researchcheck.js (new)
Run: python3 src/the_research_page_is_about_collaborations.py, then python3 src/build_stamps.py,
     then node researchcheck.js && node frontnavcheck.js && node licencecheck.js
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(HERE, "index.html")
RES = os.path.join(HERE, "research.html")
UJ = os.path.join(HERE, "ujump.html")


def edit(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    before = s
    print(os.path.basename(path))
    for name, old, new, marker in ((p + (None,))[:4] for p in pairs):
        # AN OPTIONAL 4th ELEMENT, THE MARKER, and this file is why. Pair 2 below inserts the
        # #about teaser by replacing the whole paragraph above it; pair 3, added a day later,
        # rewrites that same paragraph. After pair 3 has run once, pair 2's "is my output already
        # here" test is false (its output contained the old paragraph) and so is "is my input
        # still here" -- so the run asserts on a file that is perfectly correct. The marker is the
        # one fragment the pair OWNS and nothing else edits: present, and the pair is done.
        if marker is not None:
            if marker in s:
                print("  already there: " + name)
                continue
        # A removal cannot be guarded by its replacement: the empty string is in every file.
        elif (new and new in s) or (not new and old not in s):
            print("  already there: " + name)
            continue
        n = s.count(old)
        assert n == 1, "%s: %d" % (name, n)
        s = s.replace(old, new, 1)
        print("  ok: " + name)
    if s != before:
        io.open(path, "w", encoding="utf-8").write(s)


def lift(s, start, end, what):
    u"""The slice from `start` through the first `end` after it. Both markers must be unique
    enough to be found once; a chrome piece that silently lifted the wrong region would put a
    plausible-looking wrong page on the server, which is the failure mode worth asserting on."""
    assert s.count(start) == 1, "%s: start marker appears %d times" % (what, s.count(start))
    i = s.index(start)
    j = s.index(end, i)
    assert j > i, what
    return s[i:j + len(end)]


# ══ 1. index.html: the menu gains Research, and #about becomes a doorway ═══════════════════════
edit(IDX, [
    (u"Research in the menu — one definition, cloned into the bar and the phone panel",
     u"""        <li><a href="#about">About</a></li>""",
     u"""        <li><a href="/research.html">Research</a></li>
        <li><a href="#about">About</a></li>"""),

    (u"#about points at the research page instead of ending on a full stop",
     u"""    <p>
      This site hosts research tools built on open, publicly licensed electron microscopy datasets,
      developed independently as a personal research project.
    </p>""",
     u"""    <p>
      This site hosts research tools built on open, publicly licensed electron microscopy datasets,
      developed independently as a personal research project.
    </p>
    <!-- 2026-10-19. The long version is its own page, because it is not about me: it is five
         studies done with people in Hobart, Bethesda and Copenhagen, and it is as long as five
         studies need to be. This stays three lines. -->
    <p class="aboutmore">
      Five studies with collaborators in Hobart, Bethesda and Copenhagen — precapillary sphincters,
      microglia at the vessel wall, primary cilia on mural cells, the leptomeningeal fibroblasts and
      the brain's waste-clearance route. The findings, the figures, and the coordinates they were
      read from.
      <a class="morelink" href="/research.html">Research &amp; collaborations &rarr;</a>
    </p>""",
     u'class="morelink" href="/research.html"'),

    # ── 2026-10-19, later the same day ────────────────────────────────────────────────────────
    # Søren: *"I think it should be clear that I don't have a physical lab and I don't have
    # funding, this is a hobby project for me."*
    #
    # "developed independently as a personal research project" was doing this job and doing it
    # badly: it is the sentence an institute writes when it means "a side project of a funded
    # group". The header says Grubb Lab, which he is keeping — the domain is grubblab.com and the
    # name is already in print — so the honesty has to be in a sentence rather than in the name,
    # and the sentence has to say the plain thing: no bench, no money, no staff.
    (u"#about says there is no laboratory",
     u"""    <p>
      This site hosts research tools built on open, publicly licensed electron microscopy datasets,
      developed independently as a personal research project.
    </p>""",
     u"""    <p>
      There is no laboratory behind this. No bench, no funding and no staff &mdash;
      &ldquo;Grubb&nbsp;Lab&rdquo; is what the site is called, not a place you could visit. It is a
      hobby, built in spare time on electron microscopy volumes that other people collected,
      imaged and released publicly.
    </p>"""),

    # ── 2026-10-20 ────────────────────────────────────────────────────────────────────────────
    # Adding Stephanie Bonney to the collaborators sent me to look up the Frontiers 2022 paper,
    # and it is NOT Søren's paper: Bonney, Coelho-Santos, Huang, Takeno, Kornfeld, Keller & Shih.
    # It sat under "Selected publications" between four of his own with no author line, which is
    # the one place on this site where a reader would reasonably assume authorship. The other
    # entries name their authors whenever he is not the only one, so this one now does too, and
    # says what it is doing in the list.
    (u"the Frontiers paper names its authors, because they are not him",
     u"""        <span class="t">Public volume electron microscopy data: an essential resource to study the brain microvasculature</span>
        <em>Frontiers in Cell and Developmental Biology</em> (2022).
        <a href="https://doi.org/10.3389/fcell.2022.849469" rel="noopener">doi:10.3389/fcell.2022.849469</a>""",
     u"""        <span class="t">Public volume electron microscopy data: an essential resource to study the brain microvasculature</span>
        Bonney, Coelho-Santos, Huang, Takeno, Kornfeld, Keller &amp; Shih.
        <em>Frontiers in Cell and Developmental Biology</em> (2022).
        <a href="https://doi.org/10.3389/fcell.2022.849469" rel="noopener">doi:10.3389/fcell.2022.849469</a>
        <span class="note">&mdash; not mine; the paper that makes the case this site is built on</span>""",
     u"Bonney, Coelho-Santos, Huang, Takeno, Kornfeld, Keller &amp; Shih."),

    # 2026-10-20, an hour later. Søren, with a screenshot of the Frontiers page: *"Bonneys paper
    # is not a review."* It is filed as ORIGINAL RESEARCH, and I had called it a review in four
    # places. Its own pair above cannot fix a tree where it has already run -- the note is
    # written, so neither its input nor its output is present and the run would assert on a file
    # that is correct apart from one word. This pair repairs that word, and on a fresh checkout
    # the pair above writes "paper" straight away and the default guard skips this one.
    (u"...and it is a paper, not a review",
     u"&mdash; not mine; the review that makes the case this site is built on",
     u"&mdash; not mine; the paper that makes the case this site is built on"),

    (u"a style for that one paragraph",
     u""" /* ── THE MENU ──""",
     u""" /* The doorway out of #about. The link is a block of its own on a phone, because a text
    link at the end of a paragraph is the thing people miss — which is the same complaint the
    menu got on 2026-10-17. */
 .aboutmore{max-width:64ch}
 .aboutmore .morelink{display:inline-block;margin-top:6px;font-weight:600;color:var(--teal);
   text-decoration:none;border-bottom:1px solid transparent}
 .aboutmore .morelink:hover{border-bottom-color:var(--teal)}
 /* ── THE MENU ──"""),
])

# ══ 2. ujump.html: ?at=x,y,z ═══════════════════════════════════════════════════════════════════
AT_SCRIPT = u"""
/* ── ?at=x,y,z — a coordinate in somebody's sentence, opened here ─────────────  2026-10-19
   research.html prints the coordinates its figures were read from, and a printed coordinate that
   you then have to copy into a box is a coordinate most people will not follow. So a link may
   carry one.

   IT PRESSES THE PAGE'S OWN BUTTON. There is no second lookup here: this fills #x #y #z and
   clicks #go, so the nearest nucleus, the cell type, the location diagram and the Neuroglancer
   link are the ones this page has always built. A parallel implementation would be a second
   answer to "what is at this place", and this project has paid for that kind of twin four times.

   VOXELS, said out loud. The boxes are read through toVoxels(), which honours the unit toggle, so
   a visitor who last left the page in nanometres would otherwise land 40,000x away. The unit is
   set to voxel first, exactly as goToPrevCell() does.

   OUT OF BOTH BOXES IS NOT AN ERROR HERE. UJ.volumes decides; a point outside falls through to
   showNucleus()'s own "no predictions for this part of the dataset" path, which is the honest
   answer and already written. minnie35 points land there by design -- there is no nucleus
   detection over the lower slab. */
(function(){
  function run(){
    var raw=null;
    try{ raw=new URLSearchParams(location.search).get("at"); }catch(e){}
    if(!raw)return;
    var p=String(raw).split(/[^0-9.\\-]+/).filter(function(v){return v!=="";}).map(Number);
    if(p.length!==3||p.some(function(v){return !isFinite(v);}))return;
    try{
      if(typeof unit!=="undefined"&&typeof unitsEl!=="undefined"&&unitsEl){
        unit="voxel";
        [].slice.call(unitsEl.children).forEach(function(c){
          c.classList.toggle("on",c.dataset.u==="voxel");
        });
      }
      var panel=document.getElementById("coordPanel");
      if(panel)panel.open=true;
      document.getElementById("x").value=p[0];
      document.getElementById("y").value=p[1];
      document.getElementById("z").value=p[2];
      document.getElementById("go").click();
      if(panel&&panel.scrollIntoView)panel.scrollIntoView({block:"start"});
    }catch(err){ console.warn("[?at] could not open that coordinate",err); }
  }
  /* After the page's own DOMContentLoaded wiring, not racing it: #go's listener is attached in a
     script block above, and the tab bar and the pad init on DOMContentLoaded themselves. */
  function later(){ setTimeout(run,0); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",later);
  else later();
})();
"""

ujs = io.open(UJ, encoding="utf-8").read()
if u"?at=x,y,z" in ujs:
    print("ujump.html\n  already there: the ?at= opener")
else:
    tail = u"\n</script>\n</body>\n</html>"
    assert ujs.count(tail) == 1, "ujump.html: %d candidate tails" % ujs.count(tail)
    ujs = ujs.replace(tail, AT_SCRIPT + tail, 1)
    io.open(UJ, "w", encoding="utf-8").write(ujs)
    print("ujump.html\n  ok: the ?at= opener")


# ══ 3. research.html ═══════════════════════════════════════════════════════════════════════════
src = io.open(IDX, encoding="utf-8").read()

PREPAINT = lift(src, u"<script>\n/* THEME, resolved before the first paint.", u"</script>",
                "pre-paint theme script")
ICON = lift(src, u'<link rel="icon"', u'">', "icon")
STYLE = lift(src, u"<style>\n  :root{", u"\n</style>", "palette and layout")
BRAND = lift(src, u'  <div class="wrap">\n    <div class="brand">', u"    </div>\n", "brand row")
MENU = lift(src, u'    <nav aria-label="Sections of this page">\n      <ul class="sitenav">',
            u"      </ul>\n    </nav>", "the menu")
BARS = lift(src, u"<!-- The bar and the phone panel.",
            u'<div class="navpanel" id="navPanel" hidden>', "sticky bar") \
    + src.split(u'<div class="navpanel" id="navPanel" hidden>')[1].split(u"\n</div>\n")[0] \
    + u"\n</div>\n"
FOOTER = lift(src, u"<footer>", u"</footer>", "footer")
THEMEFNS = lift(src, u"function currentTheme(){",
                u'function toggleTheme(){ setTheme(currentTheme() === "dark" ? "light" : "dark"); }',
                "theme functions")
NAVJS = lift(src, u"/* ── THE MENU: one definition, three renderings ─", u"\n})();", "menu script")

# THE STAMP IS THIS PAGE'S OWN, not index.html's. Lifting the build line with the rest of the
# chrome would have had research.html state the time the FRONT page was last built, which is a
# falsehood in a monospace font -- exactly what src/build_stamps.py's docstring is about. A
# generated page's build script writes its own stamp, as build_xjump.py and build_wjump.py do;
# and it is written only when something other than the stamp changed, so re-running this file
# does not move a time that means "when this page last changed".
STAMP_TITLE = (u"When this file was built. If it does not match the file you think you are "
               u"looking at, your browser is showing you a cached copy — reload with "
               u"ctrl-shift-R.")
BUILD = (u'<p class="buildline"><span class="build" title="%s">build @STAMP@</span></p>'
         % STAMP_TITLE)

# The menu's in-page anchors belong to the front page once they are on a second page.
MENU_OUT = MENU.replace(u'href="#', u'href="/index.html#')
assert u'href="/index.html#tools"' in MENU_OUT

# ── the people ────────────────────────────────────────────────────────────────────────────────
# `slug` names the photograph in research/people/; `mono` is what shows if it will not load.
PEOPLE = [
    dict(slug="gary-morris", name=u"Gary P. Morris", mono="GM",
         where=u"Tasmanian School of Medicine, University of Tasmania, Hobart",
         what=u"Led the microglia study: 307 microglia annotated one z-plane at a time to ask how "
              u"often a microglial process reaches the vessel wall through a gap between astrocyte "
              u"endfeet.",
         paper=u"morris"),
    dict(slug="amreen-mughal", name=u"Amreen Mughal", mono="AM",
         where=u"Neurovascular Research Unit, NINDS &amp; NHLBI, National Institutes of Health, "
               u"Bethesda",
         what=u"Co-corresponding author on the primary cilia work — pericyte and endothelial cilia "
              u"and centrioles across mouse and human microvasculature, in three volumes and nine "
              u"other tissues.",
         paper=u"cilia"),
    dict(slug="changsi-cai", name=u"Changsi Cai", mono="CC",
         where=u"Department of Neuroscience, University of Copenhagen",
         what=u"Corresponding author on the leptomeningeal fibroblast work — two-photon Ca²⁺ "
              u"imaging in awake mice. The volume EM half, tracing the fibroblast groups over the "
              u"pial surface, was the contribution from this side.",
         paper=u"leptomeninges"),
    # 2026-10-20. Søren: *"I think Stephanie Bonney should also be mentioned as a main
    # collaborator. Although we haven't published together yet, we have annotated a lot of
    # fibroblasts together. She did the perivascular fibroblasts."*
    #
    # A collaborator with no joint paper cannot have the card the other three have, and faking
    # one — linking her to a paper she is not on, or leaving the link off and saying nothing —
    # would be the two wrong answers. The card says plainly that the work is unpublished, and
    # links instead to the paper she is first author of, which is the argument this whole site
    # rests on and which was until today sitting unattributed in his publications list.
    dict(slug="stephanie-bonney", name=u"Stephanie K. Bonney", mono="SB",
         where=u"University of Colorado Anschutz Medical Campus",
         what=u"Perivascular fibroblasts. A long run of fibroblast annotation in the MICrONS "
              u"volume done between the two of us, with the perivascular ones hers. She is also "
              u"first author of the 2022 paper that makes the case for working in public "
              u"volumes at all — the argument this site is built on.",
         wip=u"Annotating together — no joint paper yet",
         href=u"https://doi.org/10.3389/fcell.2022.849469",
         hreftext=u"Her 2022 paper"),
]

# ── NO "AND WITH" LIST ────────────────────────────────────────────────────────────  2026-10-20
# There was one: the other eleven authors of the four papers, with their affiliations and which
# study they were on. Søren, looking at it: *"These people may be on the papers but I haven't
# collaborated directly with them. So I don't think it is fair they are mentioned."*
#
# He is right, and the mistake was mine: being an author on a paper and having worked with
# somebody are different facts, and a page headed "The people" turns the first into a claim about
# the second. Nobody loses credit by this going — every author is still named, in full and in
# order, on their own paper's block below, which is where authorship belongs. The cards are for
# the four people he actually worked with.
#
# AND THE PAGE DOES NOT EXPLAIN THIS. A paragraph went in saying why the distinction was being
# drawn; Søren: *"We don't need this comment."* He is right -- it was me narrating a correction
# of my own on his page, and a reader who never saw the old list has no idea what it is answering.
# The distinction is kept by where the names sit, not by a sentence about it. The check holds it
# the same way.

# ── the papers ────────────────────────────────────────────────────────────────────────────────
# `places` is (label, "x, y, z", volume). volume "" means a volume this site cannot resolve, and
# that row is printed without a link.
PAPERS = [
    dict(
        key="sphincter",
        title=u"Ultrastructure of precapillary sphincters and the neurovascular unit",
        authors=u"Søren Grubb",
        where=u"<em>Vascular Biology</em> 5(1), e230011 (2023)",
        doi=u"https://doi.org/10.1530/VB-23-0011", doitext=u"10.1530/VB-23-0011",
        tag=u"Single author · peer-reviewed",
        lede=u"The paper that started the tools. A precapillary sphincter is a ring-shaped "
             u"narrowing where a penetrating arteriole gives off its first capillary, and almost "
             u"nothing was known about what it is made of. Reading it in a volume meant every "
             u"cell of the neurovascular unit could be looked at in the same place at once.",
        findings=[
            u"At the sphincter the mural cell is not a band but several layers of processes "
            u"wrapped around the indentation — against a single layer on the arteriole above it "
            u"and on the capillary below.",
            u"Endothelial pinocytic vesicles are densest immediately downstream of the sphincter "
            u"(≈10/µm² on first-order capillaries against ≈3.5/µm² on the arteriole), and denser "
            u"on branch points that have a sphincter than on those that do not.",
            u"Collagen fibrils made by perivascular fibroblasts reinforce the proximal first-order "
            u"capillary, where the pressure drop is steepest.",
            u"Neuronal processes lie perpendicular to the vessel around penetrating arterioles and "
            u"arterial-end capillaries — in mouse, and again in the human h01 volume — but not "
            u"around ascending venules.",
        ],
        fig="sphincter-fig1.webp",
        figalt=u"Figure 1 of the Vascular Biology paper: 3D segmentations and electron micrographs "
               u"of mural cells, fibroblasts, collagen and myoendothelial junctions around "
               u"precapillary sphincters.",
        figcap=u"Figure 1 — the sphincter in seven views, from the whole vascular lumen of the "
               u"volume down to a 300 nm inset of the indentation itself. Every panel prints the "
               u"coordinate it was taken at; those are the links below.",
        credit=u"Figure 1, Grubb 2023, <em>Vascular Biology</em>. "
               u"<a href=\"https://creativecommons.org/licenses/by/4.0/\" rel=\"noopener\">CC BY 4.0</a>.",
        places=[
            (u"Mural cell with arteriolar and capillary processes (B2)", u"167448, 199645, 17966", u"minnie65"),
            (u"3D lumen, sphincter and first three capillary orders (C1)", u"203690, 103364, 15476", u"minnie65"),
            (u"Ultrastructure of the sphincter itself (C4)", u"203628, 103267, 15480", u"minnie65"),
            (u"Collagen fibrils on the proximal first-order capillary (C6)", u"198903, 103296, 15500", u"minnie65"),
            (u"Myoendothelial junctions at a sphincter (D1)", u"357832, 95089, 25032", u"minnie65"),
            (u"Elastin and collagen around a sphincter (E)", u"356880, 106934, 25456", u"minnie65"),
            (u"Collagen holding mural cells to astrocyte endfeet (G)", u"174692, 101945, 19228", u"minnie65"),
        ],
    ),
    dict(
        key="morris",
        title=u"Microglia contact cerebral vasculature through gaps between astrocyte endfeet",
        authors=u"Gary P. Morris, Catherine G. Foster, Brad A. Sutherland &amp; Søren Grubb",
        where=u"<em>Journal of Cerebral Blood Flow &amp; Metabolism</em> 44(12), 1472–1486 (2024)",
        doi=u"https://doi.org/10.1177/0271678X241280775", doitext=u"10.1177/0271678X241280775",
        tag=u"With Hobart · peer-reviewed",
        lede=u"Astrocyte endfeet are usually described as covering the vessel completely. They do "
             u"not quite: there are gaps between neighbouring endfeet, and the question was "
             u"whether anything uses them. Three regions of interest were cut through the volume — "
             u"one around a venule, one around an arteriole, one through the capillary bed between "
             u"them — and every microglial nucleus in them was annotated by hand.",
        findings=[
            u"Of 307 microglia annotated, 21.4% (63 of 295 scored) touch the vessel directly "
            u"through a gap between adjacent astrocyte endfeet. We called the contacts plugs.",
            u"A plug-forming microglia makes a median of 2 and as many as 17, almost all within a "
            u"few micrometres of the soma; the closer the cell sits to the vessel, the more it "
            u"makes.",
            u"Plugs are enriched at the venule end of the tree, and contact endothelial cells over "
            u"pericytes 3:1.",
            u"They range from 0.01 µm² to about 15 µm², but 95% are under 1 µm² — small enough "
            u"that light microscopy would not have separated them from a near miss. 61.8% are "
            u"bounded by two endfeet and 33.9% by three.",
        ],
        fig="morris-fig2.webp",
        figalt=u"Figure 2 of the microglia paper: annotations of every microglial nucleus in three "
               u"regions of interest, an electron micrograph and 3D reconstruction of a microglia "
               u"beside a vessel, and a plug between four coloured astrocyte endfeet.",
        figcap=u"Figure 2 — (a) every microglial nucleus in the three regions of interest; (b, c) a "
               u"microglia against a vessel; (e, f) one plug, with the four astrocyte endfeet that "
               u"surround it coloured; (g) 21.4% of microglia form at least one.",
        credit=u"Figure 2, Morris <em>et al.</em> 2024, <em>J Cereb Blood Flow Metab</em>, "
               u"© The Author(s) 2024, published by SAGE. Shown here by an author; reuse terms at "
               u"<a href=\"https://us.sagepub.com/en-us/nam/journals-permissions\" rel=\"noopener\">"
               u"sagepub.com/journals-permissions</a>.",
        places=[
            (u"A microglia against a capillary (2b)", u"280875, 111577, 24306", u"minnie65"),
            (u"A plug between two astrocyte endfeet (2e)", u"280808, 163922, 24394", u"minnie65"),
            (u"Venule region of interest, upper corner", u"189377, 73419, 26850", u"minnie65"),
            (u"Capillary region of interest, upper corner", u"223825, 73419, 26850", u"minnie65"),
            (u"Arteriole region of interest, upper corner", u"258374, 73419, 26850", u"minnie65"),
        ],
    ),
    dict(
        key="cilia",
        title=u"Pericyte and endothelial primary cilia and centrioles have disparate organization "
              u"across the brain microvasculature",
        authors=u"Søren Grubb*, Vanshika Chaddha*, Jennifer Lippincott-Schwartz, Carolyn M. Ott "
                u"&amp; Amreen Mughal",
        where=u"bioRxiv 2025.11.19.689283 (2025) — preprint, not yet peer-reviewed",
        doi=u"https://doi.org/10.1101/2025.11.19.689283", doitext=u"10.1101/2025.11.19.689283",
        tag=u"With the NIH and Janelia · preprint",
        lede=u"A primary cilium is a single antenna a cell puts out to feel its surroundings. "
             u"Whether the cells of the brain's blood vessels have one, and where, had never been "
             u"surveyed — because you need a volume to see a structure that is one micrometre "
             u"long and attached to a cell you must first identify. Three volumes were read: "
             u"MICrONS mouse visual cortex, a mouse hippocampal CA1 volume and the human h01 "
             u"temporal cortex, plus nine other tissues.",
        findings=[
            u"Human cortical endothelial cells carry primary cilia, protruding into the lumen. Not "
            u"one mouse endothelial cell in either mouse volume did — a species difference, not a "
            u"sampling accident.",
            u"Mural cell cilia follow a gradient along the vascular tree: 83% of pial venular and "
            u"92% of ascending venular mural cells have one, against 3% of pial arteriolar and "
            u"under 1% of penetrating arteriolar.",
            u"Three ways of building the base were found, including a <em>partial pocket</em> — "
            u"some distal appendages at the plasma membrane and the rest on an invaginating one — "
            u"in 25–50% of mural cells. Photoreceptors are the only other cell known to do this.",
            u"In mouse, about 75% of mural cell cilia point away from the vessel; most are "
            u"ensheathed by an astrocyte endfoot, with the tip pressed into the astrocyte, and a "
            u"few reach into the neuropil and pass close to synapses. In human, nearly all stay "
            u"inside the basal lamina against the endothelium.",
            u"Endothelial centrioles sit consistently on the upstream side of the nucleus, against "
            u"the direction of flow — which makes them a structural marker for which way the "
            u"blood is going.",
        ],
        fig="cilia-fig4.webp",
        figalt=u"Figure 4 of the primary cilia preprint: schematics and electron micrographs of "
               u"mural cell primary cilia oriented into the parenchyma or against the endothelium, "
               u"with quantification across vessel orders in three datasets.",
        figcap=u"Figure 4 — where a mural cell points its cilium. Top left: one ensheathed by an "
               u"astrocyte endfoot; next to it, one that enters the neuropil and runs past a "
               u"synapse. The two human panels are h01 coordinates, in a different volume from the "
               u"three below.",
        credit=u"Figure 4, Grubb, Chaddha, Lippincott-Schwartz, Ott &amp; Mughal 2025, bioRxiv. "
               u"Posted with all rights reserved; shown here by a co-corresponding author.",
        places=[
            (u"Cilium ensheathed by an astrocyte endfoot — arteriole-end 3rd-order capillary (4a)",
             u"162828, 143997, 16416", u"minnie65"),
            (u"Cilium entering the neuropil past a synapse — venule-end 1st-order capillary (4a)",
             u"86824, 131247, 17600", u"minnie65"),
            (u"Cilium against both endothelium and neuropil — arteriole-end 3rd-order capillary (4b)",
             u"112565, 209954, 21701", u"minnie65"),
            (u"Cilium restrained by the basal lamina — human capillary (4a)",
             u"288512, 204551, 2743", u""),
            (u"Cilium against an endothelial cell — human capillary (4b)",
             u"187537, 236500, 1394", u""),
        ],
    ),
    dict(
        key="leptomeninges",
        title=u"Distinct Ca²⁺ signatures of leptomeningeal fibroblast subgroups in awake mouse "
              u"brains in health and inflammation",
        authors=u"Chen He, Søren Grubb, Lechan Tao, Kıvılcım Kılıç, Xiao Zhang, Anna Devor, "
                u"Neha Zahoor Sheikh &amp; Changsi Cai",
        where=u"bioRxiv 2025.05.13.653681 (2025) — preprint, not yet peer-reviewed",
        doi=u"https://doi.org/10.1101/2025.05.13.653681", doitext=u"10.1101/2025.05.13.653681",
        tag=u"With Copenhagen and Boston · preprint",
        lede=u"The leptomeninges are the two thin sheets between skull and cortex, built mostly of "
             u"fibroblasts. Two-photon imaging in awake mice can watch them signal but cannot tell "
             u"the groups apart with any confidence; the ultrastructure can. The pial surface is "
             u"not segmented in the public MICrONS release, so this half of the paper is a "
             u"hand-traced reconstruction: a CloudVolume cut-out around one pial arteriole, "
             u"segmented cell by cell in TrakEM2.",
        findings=[
            u"Five kinds of fibroblast, told apart by position and ultrastructure: arachnoid "
            u"barrier cells, fibroblast reticular cells and inner arachnoid fibroblasts in the "
            u"arachnoid mater, pia mater fibroblasts on the surface, and perivascular fibroblasts "
            u"wrapped around the pial vessels.",
            u"Each group has its own Ca²⁺ profile at rest in awake mice, and pia mater fibroblasts "
            u"carry the largest transients.",
            u"Vasodilation during locomotion is <em>followed</em> by a fibroblast Ca²⁺ rise that "
            u"depends on TRPV4 — a channel opened by stretch, in the order you would expect if the "
            u"vessel moves first.",
            u"Seven days after a systemic LPS challenge, spontaneous Ca²⁺ in pia mater fibroblasts "
            u"falls, and macrophages have infiltrated every leptomeningeal layer.",
        ],
        fig="leptomeninges-fig1.webp",
        figalt=u"Figure 1 of the leptomeningeal fibroblast preprint: immunohistochemistry and "
               u"two-photon images of the leptomeninges, then electron micrographs and a stepwise "
               u"3D reconstruction of five fibroblast groups around a pial arteriole in MICrONS.",
        figcap=u"Figure 1 — panels C and D are the volume EM half: the five fibroblast groups "
               u"around a pial arteriole, then the same reconstruction built up one group at a "
               u"time over the pial surface of the dataset. Traced in TrakEM2, rendered in "
               u"Blender.",
        credit=u"Figure 1, He <em>et al.</em> 2025, bioRxiv. "
               u"<a href=\"https://creativecommons.org/licenses/by-nc-nd/4.0/\" rel=\"noopener\">"
               u"CC BY-NC-ND 4.0</a>.",
        places=[
            (u"The pial arteriole the cut-out was taken around", u"87644, 91688, 8900", u"minnie35"),
            (u"Arachnoid and pia around the same vessel", u"88674, 88433, 9644", u"minnie35"),
            (u"Perivascular fibroblast on the pial vessel", u"89967, 89599, 9450", u"minnie35"),
            (u"Macrophage in the subarachnoid space, against a fibroblast",
             u"91713, 92739, 9066", u"minnie35"),
        ],
    ),
    dict(
        key="waste",
        title=u"Ultrastructure of the brain waste-clearance pathway",
        authors=u"Søren Grubb",
        where=u"bioRxiv 2023.04.14.536712 (2023) — preprint, not yet peer-reviewed",
        doi=u"https://doi.org/10.1101/2023.04.14.536712", doitext=u"10.1101/2023.04.14.536712",
        tag=u"Single author · preprint",
        lede=u"Where does the brain's waste actually leave? The argument is usually between "
             u"lymphatic vessels and the arachnoid villi, and it is usually made with tracers. "
             u"This is the same question asked of the ultrastructure instead: follow the cells "
             u"that carry waste and see where they put it down. Observational, and meant to "
             u"generate hypotheses rather than settle one.",
        findings=[
            u"Twenty-one penetrating arterioles in the volume carry a perivascular space, and its "
            u"depth is nothing like constant: from about 35 µm on one of them to over 500 on "
            u"another.",
            u"Meningeal macrophages carry indigestible waste in large lysosomes into the arachnoid "
            u"villus and appear to exocytose it through ducts into the villus lumen, which drains "
            u"to the venous sinus — a route a PEGylated tracer designed to avoid macrophages would "
            u"never report.",
            u"Leptomeningeal fibroblasts reach macrophages with their primary cilia, which is a "
            u"contact between the two cell types nobody was looking for.",
            u"Glia limitans astrocytes carry GFAP bundles 1–2 µm across that run from the brain "
            u"surface to capillaries, and some reach the villus lumen itself.",
        ],
        fig="waste-fig3.webp",
        figalt=u"Figure 3 of the waste-clearance preprint: 3D reconstructions of an arachnoid "
               u"villus with macrophages and dendritic cells, and electron micrographs of the "
               u"villus base, its ducts and its core processes.",
        figcap=u"Figure 3 — the arachnoid villus. Macrophages at the base (b), dendritic cell "
               u"processes crossing the lumen (c), and the ducts through which lysosomal contents "
               u"reach it (d).",
        credit=u"Figure 3, Grubb 2023, bioRxiv. "
               u"<a href=\"https://creativecommons.org/licenses/by-nd/4.0/\" rel=\"noopener\">"
               u"CC BY-ND 4.0</a>.",
        places=[
            (u"The arachnoid villus base (3b)", u"276156, 71787, 26421", u"minnie65"),
            (u"Dendritic cell processes crossing the villus lumen (3c)", u"312419, 69925, 23685", u"minnie65"),
            (u"GFAP and collagen at the villus base (3d)", u"274768, 71185, 26523", u"minnie65"),
            (u"Ducts inside a villus dendritic cell (3d)", u"280176, 71147, 25971", u"minnie65"),
            (u"Putative lysosome exocytosis into the lumen", u"336838, 68337, 24175", u"minnie65"),
            (u"A perivascular space 508 µm deep", u"320752, 84727, 12738", u"minnie35"),
        ],
    ),
]


def place_rows(places):
    out = []
    for label, coord, vol in places:
        q = coord.replace(u" ", u"")
        if vol:
            note = u"" if vol == u"minnie65" else \
                u' <span class="vol">minnie35 — no nucleus table out here</span>'
            out.append(
                u'      <li><a class="at" href="/ujump.html?at=%s"><code>%s</code></a>'
                u'<span class="pl">%s</span>%s</li>' % (q, coord, label, note))
        else:
            out.append(
                u'      <li><span class="at off"><code>%s</code></span>'
                u'<span class="pl">%s</span> <span class="vol">h01 — a different volume, not '
                u'resolvable here</span></li>' % (coord, label))
    return u"\n".join(out)


def paper_block(p):
    finds = u"\n".join(u"      <li>%s</li>" % f for f in p["findings"])
    return u"""
<article class="paper" id="p-%(key)s">
  <p class="ptag">%(tag)s</p>
  <h3>%(title)s</h3>
  <p class="pauth">%(authors)s</p>
  <p class="pwhere">%(where)s · <a href="%(doi)s" rel="noopener">doi:%(doitext)s</a></p>
  <p class="plede">%(lede)s</p>
  <h4>What we found</h4>
  <ul class="finds">
%(finds)s
  </ul>
  <figure class="pfig">
    <a href="/research/%(fig)s"><img src="/research/%(fig)s" alt="%(figalt)s" loading="lazy"></a>
    <figcaption>%(figcap)s <span class="credit">%(credit)s</span></figcaption>
  </figure>
  <h4>Go and look</h4>
  <ul class="places">
%(places)s
  </ul>
</article>""" % dict(p, finds=finds, places=place_rows(p["places"]))


def person_card(d):
    u"""A card either points at a paper on this page or says there is not one yet. Nothing in
    between: a collaborator with no joint paper must not be linked to somebody else's."""
    if d.get("paper"):
        tail = u'<a href="#p-%s">The paper &rarr;</a>' % d["paper"]
    else:
        tail = (u'<p class="wip">%s</p>\n        <a href="%s" rel="noopener">%s &rarr;</a>'
                % (d["wip"], d["href"], d["hreftext"]))
    return u"""
    <li class="person">
      <span class="face" data-mono="%(mono)s"><img src="/research/people/%(slug)s.jpg" alt="%(name)s"></span>
      <div>
        <b>%(name)s</b>
        <span class="aff">%(where)s</span>
        <p>%(what)s</p>
        %(tail)s
      </div>
    </li>""" % dict(d, tail=tail)


PEOPLE_HTML = u"".join(person_card(d) for d in PEOPLE)
PAPERS_HTML = u"\n".join(paper_block(p) for p in PAPERS)

PAGE_CSS = u"""
<style>
  /* research.html's own layer, on top of the front page's palette. Nothing here redefines a
     colour: every value below is one of the tokens index.html already declares, so dark mode
     needs no second set of rules. */
  .pagenav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}
  .pagenav a{display:inline-flex;align-items:center;font-size:13px;color:var(--muted);
    text-decoration:none;border:1px solid var(--line);border-radius:14px;padding:5px 11px}
  .pagenav a:hover{color:var(--teal);border-color:var(--teal)}
  .rsec{padding:34px 0 10px}
  .rsec h2{font-size:24px;margin:0 0 6px}
  .rsec .sub{color:var(--muted);max-width:68ch;margin:0 0 18px}
  /* ── the people ─────────────────────────────────────────────────────────────────────────── */
  /* Two columns rather than three: with four people, three-up leaves an orphan and squeezes
     every card to about 260 px beside a 72 px portrait. 2026-10-20. */
  .people{display:grid;gap:16px;grid-template-columns:1fr;margin:0;padding:0;list-style:none}
  @media(min-width:760px){.people{grid-template-columns:repeat(2,1fr)}}
  /* The card for work that has no paper yet. Said on the card, not left to be inferred from a
     missing link. */
  /* width:fit-content rather than inline-block: inline-block let the link that follows sit on
     the same line and wrap mid-phrase ("Her" / "2022 paper"), and a plain block would stretch the
     chip's border the whole width of the card. 2026-10-20. */
  .person .wip{display:block;width:-moz-fit-content;width:fit-content;margin:0 0 10px;
    font-size:12px;color:var(--accent);background:var(--hero);border:1px solid var(--line);
    border-radius:10px;padding:3px 9px}
  .person{display:flex;gap:14px;background:var(--card);border:1px solid var(--line);
    border-radius:14px;padding:16px}
  .person>div{min-width:0}
  .person b{display:block;font-size:16px}
  .person .aff{display:block;color:var(--muted);font-size:13px;margin:2px 0 8px}
  .person p{margin:0 0 8px;font-size:14px;line-height:1.5}
  .person a{color:var(--teal);text-decoration:none;font-size:13px;font-weight:600}
  .person a:hover{text-decoration:underline}
  /* THE MONOGRAM IS THE FALLBACK, not the error state: a broken image icon on somebody's name
     is worse than their initials, so the circle carries the initials and the photograph is laid
     over them. The script at the foot of this page removes the <img> if it fails, and the
     initials are what is left. */
  .face{flex:none;width:72px;height:72px;border-radius:50%;overflow:hidden;position:relative;
    background:var(--teal-soft);display:flex;align-items:center;justify-content:center}
  .face::before{content:attr(data-mono);font:600 24px/1 system-ui,sans-serif;color:var(--teal)}
  .face img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  /* ── the papers ─────────────────────────────────────────────────────────────────────────── */
  .paper{background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:22px 22px 10px;margin:0 0 22px}
  .paper .ptag{display:inline-block;margin:0 0 8px;font-size:12px;letter-spacing:.02em;
    color:var(--teal);background:var(--teal-soft);border-radius:10px;padding:3px 9px}
  .paper h3{font-size:21px;line-height:1.3;margin:0 0 6px;max-width:58ch}
  .paper h4{font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);
    margin:22px 0 8px}
  .pauth{margin:0;font-size:14px}
  .pwhere{margin:3px 0 0;font-size:14px;color:var(--muted)}
  .pwhere a{color:var(--accent)}
  .plede{max-width:68ch;margin:14px 0 0}
  .finds{max-width:68ch;margin:0;padding-left:20px}
  .finds li{margin:0 0 9px;line-height:1.55}
  .pfig{margin:18px 0 0}
  .pfig img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:10px;
    background:#fff}
  .pfig figcaption{margin-top:8px;font-size:13px;color:var(--muted);max-width:76ch;line-height:1.5}
  .pfig .credit{display:block;margin-top:5px;font-size:12px}
  .pfig .credit a{color:var(--accent)}
  /* ── the coordinates ────────────────────────────────────────────────────────────────────── */
  .places{margin:0 0 18px;padding:0;list-style:none}
  .places li{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;padding:6px 0;
    border-top:1px solid var(--line);font-size:14px}
  .places .at{text-decoration:none}
  .places .at code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
    border:1px solid var(--line);border-radius:7px;padding:3px 8px;background:var(--bg);
    color:var(--ink);white-space:nowrap}
  .places .at:hover code{border-color:var(--teal);color:var(--teal)}
  .places .at.off code{opacity:.55}
  .places .pl{flex:1 1 16ch;color:var(--muted)}
  .places .vol{font-size:12px;color:var(--muted);opacity:.85}
  /* ── the method note and the credits ────────────────────────────────────────────────────── */
  .method{max-width:70ch}
  .method p{line-height:1.6}
  .credits{max-width:76ch;font-size:14px;color:var(--muted);line-height:1.6}
  .credits li{margin:0 0 8px}
  .credits a{color:var(--accent)}
</style>"""

PAGE_JS = u"""
<script>
/* The monogram stands unless the photograph loads. An error listener rather than an onerror
   attribute, to keep this page's markup free of inline handlers like every other page here. */
(function(){
  Array.prototype.forEach.call(document.querySelectorAll(".face img"), function(img){
    function drop(){ if (img.parentNode) img.parentNode.removeChild(img); }
    img.addEventListener("error", drop);
    if (img.complete && img.naturalWidth === 0) drop();
  });
})();
</script>"""

page = u"""<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) --> <script async src="https://www.googletagmanager.com/gtag/js?id=G-DV02FHZ57V"></script> <script> window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-DV02FHZ57V'); </script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
%(prepaint)s
<title>Research &amp; collaborations — Grubb Lab</title>
<meta name="description" content="Five volume electron microscopy studies of the neurovascular unit, done with Gary Morris (Hobart), Amreen Mughal (NIH) and Changsi Cai (Copenhagen): precapillary sphincters, microglia at the vessel wall, pericyte primary cilia, leptomeningeal fibroblasts and the brain's waste-clearance route — with the coordinates each figure was read from.">
%(icon)s
<!-- GENERATED by src/the_research_page_is_about_collaborations.py. The palette, the header, the
     sticky bar, the phone panel, the footer and both scripts are lifted out of index.html when
     this file is built, so there is ONE definition of the site's chrome. Edit index.html, or the
     generator, and re-run it; editing this file by hand loses the change on the next build. -->
%(style)s
%(pagecss)s
</head>
<body>

<header id="top">
%(brand)s
    <h1>Research &amp; collaborations</h1>
    <p class="lede">
      Five studies of the neurovascular unit, all read out of public electron microscopy volumes
      rather than collected at a microscope. That is what makes them possible at all here: there is
      no laboratory behind this site and no funding — a volume somebody else has already imaged and
      released is something one person can work through in their spare time, which is what this is.
    </p>
    <p class="lede">
      Each study below carries what we found, the figure, and the coordinates the figure was taken
      at — so you can open the same place in the tools on this site and look for yourself.
    </p>
%(menu)s
    <ul class="pagenav">
      <li><a href="#collaborators">The people</a></li>
      <li><a href="#papers">The five studies</a></li>
      <li><a href="#method">How this became the tools</a></li>
      <li><a href="#credits">Figure credits</a></li>
    </ul>
%(build)s
  </div>
</header>

%(bars)s

<section class="rsec" id="collaborators">
  <div class="wrap">
    <h2>The people</h2>
    <p class="sub">
      Four collaborations, three of which have produced a paper. They brought the questions, the
      animals and the physiology, and each of them has a laboratory. The volume electron
      microscopy is the half done on this side: one person, a laptop and a dataset somebody else
      paid to collect.
    </p>
    <ul class="people">%(people)s
    </ul>
  </div>
</section>

<section class="rsec" id="papers">
  <div class="wrap">
    <h2>The five studies</h2>
    <p class="sub">
      In the order they are easiest to read, not the order they were written. Two preprints among
      them are not yet peer-reviewed, and say so.
    </p>
%(papers)s
  </div>
</section>

<section class="rsec" id="method">
  <div class="wrap">
    <h2>How this became the tools</h2>
    <div class="method">
      <p>
        Every study above was done the same way, and the way is slow. Find a cell. Decide what it
        is from its ultrastructure and its shape. Write the coordinate down. Do it again, four
        hundred times, and then count.
      </p>
      <p>
        That loop is what the eight <a href="/index.html#tools">Jump tools</a> automate. µJump is
        the step where you stand at a coordinate and say what the cell is; the coordinate, not the
        segmentation's nucleus id, is what identifies it — which is a rule these papers taught,
        because around vessels the public segmentation is often wrong. The region-box download
        writes the Colab notebook that cuts a block out of the volume and opens it in Blender,
        which is the route the leptomeningeal reconstruction took by hand: a CloudVolume cut-out,
        traced in TrakEM2 under FIJI, rendered in Blender.
      </p>
      <p>
        The case for working this way at all — that the public volumes already contain more
        microvascular anatomy than any one laboratory will ever collect — is not mine. It is set
        out in <a href="https://doi.org/10.3389/fcell.2022.849469" rel="noopener">Public volume
        electron microscopy data: an essential resource to study the brain microvasculature</a>
        by Bonney, Coelho-Santos, Huang, Takeno, Kornfeld, Keller and Shih
        (<em>Frontiers in Cell and Developmental Biology</em>, 2022), and these tools are in a
        sense an attempt to do what that paper says is possible.
      </p>
      <p>
        The tools: <a href="/ujump.html">µJump</a> (MICrONS minnie65 and minnie35, where four of
        these five studies were done), <a href="/hjump.html">ηJump</a> (the human h01 volume, the
        comparison in two of them), and <a href="/wjump.html">ωJump</a>, which carries 62 further
        volumes that nobody has published a soma list for.
      </p>
    </div>
  </div>
</section>

<section class="rsec" id="credits">
  <div class="wrap">
    <h2>Figure credits</h2>
    <ul class="credits">
      <li>
        Each figure is shown whole and downscaled for the web, never cropped to a single panel:
        two of the five are published under a licence with a NoDerivatives term, and a cropped
        panel is exactly what that term is about.
      </li>
      <li>
        <b>Vascular Biology 2023</b> — <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0</a>, reuse with attribution.
      </li>
      <li>
        <b>bioRxiv 2023.04.14.536712</b> — <a href="https://creativecommons.org/licenses/by-nd/4.0/" rel="noopener">CC BY-ND 4.0</a>.
      </li>
      <li>
        <b>bioRxiv 2025.05.13.653681</b> — <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" rel="noopener">CC BY-NC-ND 4.0</a>. This site carries no advertising and sells nothing, so the non-commercial term is met.
      </li>
      <li>
        <b>J Cereb Blood Flow Metab 2024</b> — © The Author(s) 2024, published by SAGE. Shown by an author under the journal's own
        <a href="https://us.sagepub.com/en-us/nam/journals-permissions" rel="noopener">author re-use terms</a>.
      </li>
      <li>
        <b>bioRxiv 2025.11.19.689283</b> — posted with all rights reserved, shown by a co-corresponding author.
      </li>
      <li>
        The underlying imagery belongs to the consortia that released it, not to this site: see
        <a href="/index.html#data">Data &amp; attribution</a>. The text of this page is under
        <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0</a> and the
        code behind it under the <a href="https://github.com/SorenGrubb/microns-neuroglancer-tool/blob/main/LICENSE" rel="noopener">MIT License</a>.
      </li>
    </ul>
  </div>
</section>

%(footer)s

<script>
%(themefns)s
  var btn = document.getElementById("themeToggleBtn");
  if (btn) btn.addEventListener("click", toggleTheme);
</script>

<script>
%(navjs)s
</script>
%(pagejs)s
</body>
</html>
""" % dict(prepaint=PREPAINT, icon=ICON, style=STYLE, pagecss=PAGE_CSS, brand=BRAND,
           menu=MENU_OUT, build=BUILD, bars=BARS, people=PEOPLE_HTML,
           papers=PAPERS_HTML, footer=FOOTER, themefns=THEMEFNS, navjs=NAVJS, pagejs=PAGE_JS)

import datetime
import re as _re

_STAMP = _re.compile(r"build (?:@STAMP@|\d{4}-\d{2}-\d{2} \d{2}:\d{2})")
old = io.open(RES, encoding="utf-8").read() if os.path.exists(RES) else u""
same = _STAMP.sub(u"build X", old) == _STAMP.sub(u"build X", page)
if same:
    kept = (_re.search(r"build (\d{4}-\d{2}-\d{2} \d{2}:\d{2})", old) or [None, u""])[1]
    page = page.replace(u"@STAMP@", kept or datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
else:
    page = page.replace(u"@STAMP@", datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))

io.open(RES, "w", encoding="utf-8").write(page)
print("research.html\n  %s (%d bytes, %d papers, %d coordinates)"
      % ("unchanged — stamp kept" if same else "ok: written",
         len(page.encode("utf-8")), len(PAPERS), sum(len(p["places"]) for p in PAPERS)))

print("\nNow: python3 src/build_stamps.py, then node researchcheck.js")
