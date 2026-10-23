# -*- coding: utf-8 -*-
u"""µJump gets a walkthrough: part one, finding a cell and saying what it is.       2026-10-23

Søren: *"We should make a tutorial for uJump that walks the user through the functions and
features."* Asked which form, he chose **the overlay on the real page** over a written page with
screenshots, asked for it **in three parts**, and scoped part one as *finding a cell* and
*identifying one*. Audience: a neuroscientist who has not seen this tool — it explains the tool,
not the biology.

WHY NOT SCREENSHOTS, IN ONE EXAMPLE FROM TODAY. Three days ago those three buttons read "Random
example", "Random unassigned cell — help identify one" and "Random community-identified cell —
review someone's call". Today they read **Show**, **Identify** and **Review**. A tutorial built
from pictures would still show the old ones and nothing would have failed. Here the step points at
`#randomOfType` and `tourcheck.js` reads the selector out of the page, so a rename is a red check
rather than a lie on a help page.

WHAT GOES IN
  core/tour.js            the engine (written separately; see its header)
  <script src>            loaded after core/stepthrough.js, because a step may switch tabs and
                          that is stepthrough's activateTab
  #tourdata               the step list, as JSON, in a <script type="application/json"> block.
                          JSON RATHER THAN A JS LITERAL so the page and the check read the SAME
                          BYTES -- the alternative is two copies of one list, which is the shape
                          this project has paid for four times.
  a "Tutorial" button     ONE of them, in the tab bar, carrying data-tour-menu; the engine wires
                          it to a picker it builds out of the step list. Three numbered buttons
                          -- "Tutorial", "Tutorial 2", "Tutorial 3" -- were tried first and
                          Søren said so: *"There should only be one tutorial button, when that
                          opens you can select which tutorial you want."* The picker has room to
                          say what each part covers and how far the reader got, which a label
                          reading "Tutorial 2" does not.
  UJ.tour.ready()         reads the block, wires the button, offers it once -- and waits for
                          DOMContentLoaded, because this script block sits above #tourdata in the
                          document and load() on its own found nothing there

ALL THREE PARTS ARE NOW DECLARED -- finding a cell (15 steps), Filter and show (14), and the
tracing pad with the region/Blender export (13). VR IS DELIBERATELY ABSENT: vr.html is being
rewritten elsewhere, and a walkthrough pointing at controls about to move is worse than none.
tourcheck.js still asserts the invariant rather than a count of three -- every part that EXISTS
has steps, a title and a line saying what it covers -- so adding a fourth needs no change there.

THE STEPS THAT WAIT. Most of the identity card does not exist until a cell has been shown -- it is
rendered into #nucpanel at runtime. Those steps carry `needs` (the selector to wait for) and
`after` (what the reader presses), and the engine watches the DOM and moves on by itself. It never
presses anything: half of these controls fetch something, and a walkthrough that quietly fires
somebody's requests is doing things they did not ask for.

Check: tourcheck.js (new), driven on tourfixture.html (new) for the engine and on this file's
       #tourdata for the steps
Run: python3 src/a_walkthrough_that_points_at_the_real_control.py, then
     python3 src/build_stamps.py, then node tourcheck.js
"""
import io
import json
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UJ = os.path.join(HERE, "ujump.html")


def sweep_tutorial_buttons(path):
    u"""Take out every Tutorial button there is, so the pair below can write the one.

    FIFTH TIME, AND THE LAST. The pair that writes the button has been rewritten four times --
    one button, then two, then three, now one again -- and each time, on a tree where an earlier
    version had already run, it INSERTED beside the old buttons instead of replacing them,
    because `edit()` matches an exact string and the old string was still there under a different
    label. The tab bar in this tree currently carries FIVE Tutorial buttons for that reason.

    A removal pair per stale version does not scale: it needs the exact bytes of every version
    that ever shipped, and a version I forget leaves a duplicate nobody notices until Søren sees
    two Tutorial buttons. So this region is now REGENERATED rather than patched: everything
    matching a Tutorial button goes, whatever it says, and the insert that follows puts back
    exactly one. Idempotent by construction -- a second run removes the button it wrote on the
    first and writes it again.

    Narrow on purpose: a .tabbtn carrying data-tour-start or data-tour-menu. Nothing else in the
    document matches, and the count is printed so a sweep that eats more than it should is loud.
    """
    import re
    s = io.open(path, encoding="utf-8").read()
    pat = re.compile(
        r'<button type="button" class="tabbtn" data-tour-(?:start|menu)="[^"]*"\s*\n'
        r'[^\n]*</button>\n')
    s2, n = pat.subn(u"", s)
    if n:
        io.open(path, "w", encoding="utf-8").write(s2)
    print("  swept %d existing Tutorial button(s)" % n)
    return n


def edit(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    before = s
    print(os.path.basename(path))
    for name, old, new, marker in ((p + (None,))[:4] for p in pairs):
        if marker is not None:
            if marker in s:
                print("  already there: " + name)
                continue
        elif (new and new in s) or (not new and old not in s):
            print("  already there: " + name)
            continue
        n = s.count(old)
        assert n == 1, "%s: %d" % (name, n)
        s = s.replace(old, new, 1)
        print("  ok: " + name)
    if s != before:
        io.open(path, "w", encoding="utf-8").write(s)
        return True
    return False


# ── THE STEPS ─────────────────────────────────────────────────────────────────────────────────
# Written as Python, emitted as JSON, so the one list in the repository is this one and the page
# carries a build product of it. Every `at` is a selector tourcheck.js looks for in ujump.html.
PART1 = {
    "id": "part1",
    "title": "Finding a cell, and saying what it is",
    "blurb": u"The Jump tab: landing on a cell, reading its identity card, and recording what "
             u"you think it is.",
    "steps": [
        {"say": u"This tool reads one volume: <b>MICrONS minnie65</b>, about 1.7 &times; 1.4 "
                u"&times; 0.5&nbsp;mm of mouse visual cortex imaged at 4&nbsp;&times;&nbsp;4 "
                u"&times; 40&nbsp;nm. A nucleus detector found 144,118 cells in it. Roughly two "
                u"thirds carry a machine-made guess at what they are; the rest carry nothing at "
                u"all. This walkthrough is about looking at one and deciding."},

        {"at": "#mainTabs", "title": u"Five tabs",
         "say": u"<b>Jump</b> is one cell at a time, and is where this part stays. <b>Filter and "
                u"show</b> is the opposite &mdash; every cell matching a set of conditions. The "
                u"other three are the references behind the cell types, a discussion board, and "
                u"the statistics for this dataset."},

        {"at": "#randomTypeSelect", "tab": "jump", "title": u"Start from a type",
         "say": u"Thirty-three cell types, from pyramidal neurons down to pericytes. Picking one "
                u"here does not filter anything yet &mdash; it just says which type the three "
                u"buttons below should fetch."},

        {"at": "#randomOfType", "title": u"Show",
         "say": u"A random cell of that type, and a different one on every press. This is the "
                u"fastest way to learn what a type actually looks like: press it six or seven "
                u"times for one type before you try to identify anything."},

        {"at": "#nucpanel", "needs": "#nucpanel .celltype", "press": "#randomOfType",
         "after": u"press “Show”", "title": u"The identity card",
         "say": u"Everything known about the cell now in front of you: where it is, what the "
                u"segmentation claims it is, its organelles, its neighbours, and the links that "
                u"open it elsewhere."},

        {"at": "#nucpanel .celltype", "needs": "#nucpanel .celltype", "press": "#randomOfType",
         "after": u"press “Show”", "title": u"What the heading is, and is not",
         "say": u"This is MICrONS's own machine prediction, not a fact. It is right most of the "
                u"time for neurons and wrong often enough around blood vessels that this site "
                u"exists. Treat it as the first opinion, not the answer."},

        {"at": "#idfgo", "needs": "#idfgo", "press": "#randomOfType",
         "after": u"press “Show”", "title": u"Say what you think it is",
         "say": u"This opens a decision tree &mdash; one question at a time about what you can "
                u"see, rather than a list of 33 names to choose between. Every question is "
                u"backed by a reference you can open from the References tab."},

        {"at": "#randomUnclassified", "title": u"Identify",
         "say": u"A cell nobody has named yet, of any type. This is the actual work: these cells "
                u"have no prediction at all, so whatever you say is the first thing anyone has "
                u"said about them."},

        {"at": "#unclCount", "title": u"How much is left",
         "say": u"How many the community has named, how many are still unnamed, and how many have "
                u"been verified by hand. The unnamed number is the one this site is trying to "
                u"bring down."},

        {"at": "#randomCommunityId", "title": u"Review",
         "say": u"A cell somebody else has already identified. You either confirm their call or "
                u"challenge it, and agreement between independent readers is what turns a pile of "
                u"opinions into data worth using."},

        {"at": "#coordPanel", "title": u"Arriving from somewhere else",
         "say": u"Paste an <code>x, y, z</code> out of Neuroglancer &mdash; or off a figure in a "
                u"paper &mdash; and this says which cell is there and what type it is. All three "
                u"boxes fill from one paste."},

        {"at": "#rootNucSearchPanel", "title": u"Or by id",
         "say": u"A root ID or a nucleus ID, if you already have one. Root IDs change whenever a "
                u"cell is re-proofread, which is why a coordinate is the more durable way to "
                u"refer to a cell here."},

        {"at": "#recentlyViewedPanel", "title": u"Where you have been",
         "say": u"The cells you have looked at this session, so comparing two of them is a click "
                u"rather than a re-search. Back and Forward above it do the same thing in order."},

        {"at": "#gameChipSlot", "title": u"Signing in is optional",
         "say": u"Browsing needs no account. Signing in is what lets your identifications be "
                u"saved and credited, and it earns points &mdash; more for a cell nobody has "
                u"named than for one that already has three votes."},

        {"at": "#mainTabs", "title": u"That is part one",
         "say": u"You can now find a cell and say what it is. Part two is the other direction "
                u"&mdash; <b>Filter and show</b>, where you describe a population and get back "
                u"every cell that matches. Part three is looking at them properly: the EM plane, "
                u"the 3D mesh, the viewer, VR, and tracing structures of your own."},
    ],
}

PART2 = {
    "id": "part2",
    "title": u"Filter and show \u2014 every cell that matches",
    "blurb": u"Describing a population by type, layer, size or place, then counting it and "
             u"taking it away as a sheet.",
    "steps": [
        {"tab": "filter",
         "say": u"The Jump tab is one cell at a time. This tab is the opposite: you describe a "
                u"population &mdash; a type, a place, a distance, an organelle &mdash; and get "
                u"back every cell in the volume that matches. The answer comes as a table, a 3D "
                u"view, or a VR scene."},

        {"at": "#filterSecSelect", "tab": "filter", "title": u"Start with what counts as a cell",
         "say": u"Which types are in play. Everything below this narrows that set, so if nothing "
                u"is ticked here nothing else matters. Tick several and you get them all; the "
                u"table says which is which."},

        {"at": "#filterIncludeUnclassified", "title": u"And the ones with no prediction",
         "say": u"Fifty thousand of the 144,118 cells carry no machine guess at all. They are off "
                u"by default because they would swamp a count &mdash; but when you are after "
                u"something the predictor is bad at, which around vessels is most things, this is "
                u"the tick that finds it."},

        {"at": "#filterSecBorders", "title": u"How close to a vessel, or to the edge",
         "say": u"Distance to the vasculature, to the glia limitans, or to the white matter. This "
                u"is the condition most of the papers on this site were written from: "
                u"&ldquo;every pericyte within 5&nbsp;&micro;m of a penetrating arteriole&rdquo; "
                u"is a question you can ask here and almost nowhere else."},

        {"at": "#filterSecNear", "title": u"Or close to another kind of cell",
         "say": u"Cells of one type within a chosen distance of another &mdash; microglia near "
                u"endothelium, say. The distance is between nucleus centres, not surfaces, so set "
                u"it wider than the contact you actually have in mind."},

        {"at": "#filterSecLayer", "title": u"Where in the cortex",
         "say": u"Cortical layer, fitted to this volume rather than assumed from depth. "
                u"<b>Which visual area</b> just below does the same across V1 and the higher "
                u"areas, and the <b>V1 column</b> section restricts you to the Allen Institute's "
                u"hand-proofread ground truth — the subset to use when you need to be certain."},

        {"at": "#filterSecVol", "title": u"How big, and what is around it",
         "say": u"Cell volume in cubic micrometres, measured from the mesh. "
                u"<b>Perivascular space</b> below it filters on the depth of the space around a "
                u"vessel, which is how the waste-clearance work picked its arterioles."},

        {"at": "#filterSecOrganelle", "title": u"What people have found inside it",
         "say": u"Filter on organelles the community has logged &mdash; a cilium, a centriole, a "
                u"lysosome. This is the part that compounds: every identification anyone makes in "
                u"the Jump tab becomes a condition you can select on here."},

        {"at": "#filterSecRec", "title": u"Whether it was watched while alive",
         "say": u"About 1,900 excitatory neurons in this volume were imaged with two-photon "
                u"calcium before the tissue was fixed, and matched to their EM cell by hand. You "
                u"can ask for only those &mdash; and for the ones active during a particular "
                u"second of a particular movie clip."},

        {"at": "#filterSecRegion", "title": u"Inside a box you draw",
         "say": u"One or more bounding boxes, typed in or pasted from Neuroglancer. A box is also "
                u"what the Blender and Colab downloads cut out, so this is usually where a figure "
                u"starts."},

        {"at": "#filterSecViewer", "title": u"Scenery, not conditions",
         "say": u"Extra layers for the 3D view &mdash; the pia, the white matter, the vasculature. "
                u"The heading says it does not change which cells match, and that is worth "
                u"believing: it only changes what you see around them."},

        {"at": "#filterRun", "needs": {"at": "#filterRun", "text": "matching"},
         "press": "#filterRun", "after": u"press \u201cPreview matches\u201d",
         "title": u"Count them before you fetch them",
         "say": u"Nothing is downloaded until you press this. The number comes back <b>on the "
                u"button itself</b> &mdash; deliberately, because a line of text under a row of "
                u"buttons is a line nobody reads. Press it and watch the label change."},

        {"at": "#filterDownload", "title": u"Then take it away",
         "say": u"An Excel sheet of every match: coordinates, ids, type, layer, volume, and "
                u"whatever else your conditions touched. It stays disabled until you have "
                u"previewed, so the sheet and the number on the button are always the same "
                u"population."},

        {"at": "#filterVR", "title": u"Or look at all of them at once",
         "say": u"<b>Open all matches in Neuroglancer</b> puts the whole set in the viewer; "
                u"<b>Show in VR</b> opens them as meshes you can walk through. Part three goes "
                u"the other way — making geometry of your own, by hand or by the box."},
    ],
}

# ── PART THREE ────────────────────────────────────────────────────────────────────  2026-10-23
# Drawing rather than reading. The two places in µJump where you produce something instead of
# fetching something: the tracing pad, where you draw a contour on the EM plane, and the region
# box, which hands you a notebook for a cube of the volume.
#
# VR IS DELIBERATELY NOT HERE. vr.html is being rewritten in another conversation and a
# walkthrough that points at controls which are about to move is worse than no walkthrough; it
# gets its own part once that settles. Part two's closing step says so rather than promising it.
PART3 = {
    "id": "part3",
    "title": u"Drawing your own — the tracing pad and the region box",
    "blurb": u"Making geometry instead of fetching it: contours drawn by hand on the EM plane, "
             u"and a cube of volume exported to a notebook or to Blender.",
    "steps": [
        {"say": u"Everything so far has been <b>reading</b> the volume &mdash; landing on a cell, "
                u"asking what it is, asking for every cell like it. This part is about the two "
                u"places where you <b>make</b> something: drawing a structure nobody has "
                u"segmented, and cutting out a cube of the volume to work on elsewhere. "
                u"About three minutes.",
         "title": u"Making something, rather than finding it"},

        {"at": "#tracingCard", "tab": "jump", "press": "#randomOfType",
         "needs": "#tracingCard", "after": u"show a cell, so there is a plane to draw on",
         "title": u"Where the drawing happens",
         "say": u"This card appears once a cell is on screen. The EM plane you are looking at is "
                u"a real 4 &times; 4 &times; 40 nm image, and anything you draw on it is in "
                u"<b>volume coordinates</b> &mdash; not pixels of your screen &mdash; so a "
                u"contour keeps its meaning when you come back to it or open it somewhere else."},

        {"at": "#tracePadOpen", "needs": "#tracePadOpen", "press": "#tracePadOpen",
         "after": u"press “Trace it here”",
         "title": u"Open the pad",
         "say": u"<b>Trace it here</b> opens the pad over the plane. It is a polygon tool by "
                u"default: click once per vertex, and close the shape by clicking the first "
                u"point again. That suits a vessel lumen or a nuclear outline, where a dozen "
                u"points describe the boundary better than two hundred do."},

        {"at": "#tracePadPen", "needs": "#tracePadPen", "press": "#tracePadOpen",
         "after": u"open the pad with \u201cTrace it here\u201d",
         "title": u"Or draw it freehand",
         "say": u"<b>Pen</b> follows the pointer continuously, which is what you want with a "
                u"graphics tablet and a pen in your hand &mdash; a mitochondrion or an astrocytic "
                u"process has no corners to click. The two modes write the same contour; only the "
                u"number of points differs."},

        {"at": "#tracePadGhosts", "needs": "#tracePadGhosts", "press": "#tracePadOpen",
         "after": u"open the pad with \u201cTrace it here\u201d",
         "title": u"See what is already segmented",
         "say": u"This lays the cell and its nucleus underneath your drawing, see-through. Use it "
                u"to check that what you are outlining really is inside the cell you think it is "
                u"&mdash; the commonest tracing error is a process that belongs to the neighbour."},

        {"at": "#tracePadDraft", "needs": "#tracePadDraft", "press": "#tracePadOpen",
         "after": u"open the pad with \u201cTrace it here\u201d",
         "title": u"It keeps your work in this browser",
         "say": u"<b>Save draft</b> puts the contour in this browser's own storage, under the "
                u"cell it belongs to, so closing the pad does not lose it. It is a draft, in one "
                u"browser &mdash; not a submission and not a backup. Export anything you want to "
                u"keep."},

        {"at": "#tracePad3D", "needs": "#tracePad3D", "press": "#tracePadOpen",
         "after": u"open the pad with \u201cTrace it here\u201d",
         "title": u"Stack the contours into a shape",
         "say": u"Trace the same structure on several planes and this lifts the stack into 3D "
                u"&mdash; the same thing you would do in TrakEM2, at a smaller scale. It is how "
                u"you get a surface out of a structure the automated segmentation never gave a "
                u"label to."},

        {"at": "#tracingRead", "needs": "#tracingRead", "press": "#randomOfType",
         "after": u"show a cell, so the tracing card is there",
         "title": u"And read them back out",
         "say": u"<b>Read the contours</b> gives you the drafts as coordinates you can paste into "
                u"Python, FIJI or Blender. Plain numbers, with the resolution written next to "
                u"them, because a contour whose units you have to guess is not data."},

        {"at": "#filterSecRegion", "tab": "filter",
         "title": u"The other way: ask for a box",
         "say": u"Back in <b>Filter and show</b>. Instead of naming a kind of cell, you can name "
                u"a <b>cube of the volume</b> and take everything inside it. This is the section "
                u"for that &mdash; open it and you can type the corners, or use the cell on "
                u"screen as the centre."},

        {"at": "#regionAddBox",
         "title": u"One box, or several",
         "say": u"<b>+ Add another box</b> gives you a second region, and a third. Boxes are "
                u"independent, so you can sample three cortical layers at once, or the same "
                u"column at three depths, and keep them apart in what comes out."},

        {"at": ".rbox-colab", "needs": ".rbox-colab", "press": "#regionAddBox",
         "after": u"add a box, so there is a region to export",
         "title": u"A notebook for that box",
         "say": u"Each box carries its own <b>Colab notebook</b> &mdash; a ready-made notebook "
                u"with that box's coordinates already filled in. You do not install anything: it "
                u"opens in the browser and runs against the public CAVE service, the same one "
                u"this tool uses."},

        {"at": ".colab-blender", "needs": ".colab-blender", "press": "#regionAddBox",
         "after": u"add a box, so there is a region to export",
         "title": u"...including one that writes a .blend",
         "say": u"The flavours differ in what they fetch: <b>EM</b> gives the raw image stack, "
                u"<b>seg</b> the labels, <b>meshes</b> the surfaces, <b>nuclei</b> and "
                u"<b>vasculature</b> those alone. <b>Blender</b> is the one to take if you want a "
                u"figure &mdash; it writes the meshes out ready to open, which is the short way "
                u"to a 3D render or a file you can print."},

        {"at": "#mainTabs",
         "title": u"That is the tool",
         "say": u"Three parts: finding a cell and saying what it is, asking for every cell that "
                u"matches, and making geometry of your own. VR gets its own walkthrough once "
                u"that viewer settles. The Tutorial button brings this list back whenever you "
                u"want a part again."},
    ],
}

CFG = {
    "key": "grubblab_ujump_tour_v1",
    "offer": u"A short walkthrough of the Jump tab &mdash; finding a cell and saying what it is. "
             u"About two minutes.",
    "menu": u"Three short walkthroughs. Each one points at the real controls, in order, and "
            u"waits for you &mdash; nothing is pressed for you. Esc leaves at any time and it "
            u"remembers where you got to.",
    "parts": [PART1, PART2, PART3],
}

TOURDATA = (u'<script type="application/json" id="tourdata">\n'
            + json.dumps(CFG, indent=1, ensure_ascii=False)
            + u'\n</script>\n')

print(os.path.basename(UJ) + " — tab bar")
sweep_tutorial_buttons(UJ)

changed = edit(UJ, [
    (u"core/tour.js is loaded after stepthrough, whose activateTab a step may use",
     u'<script src="core/stepthrough.js"></script>',
     u'<script src="core/stepthrough.js"></script>\n'
     u'<!-- The walkthrough overlay. AFTER core/stepthrough.js: a step may name a tab, and that is\n'
     u'     stepthrough\'s activateTab. core/tour.js, 2026-10-23. -->\n'
     u'<script src="core/tour.js"></script>'),

    # ONE button, which asks which. 2026-10-23, at Søren's word: "There should only be one
    # tutorial button, when that opens you can select which tutorial you want." Three buttons
    # labelled Tutorial, Tutorial 2, Tutorial 3 put the tutorial's structure into the tool's
    # navigation, and "Tutorial 2" says nothing about what is in it. The picker core/tour.js
    # builds from the step list has room to say what each part covers and how far you got, and
    # it needs no change here when a part is added.
    (u"a Tutorial button in the tab bar",
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false"',
     u'<button type="button" class="tabbtn" data-tour-menu="1"\n'
     u'        title="Guided walkthroughs of the tool, pointing at each control in turn. '
     u'Pick one; Esc leaves it; it remembers where you got to.">❓ Tutorial</button>\n'
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false"'),

    (u"the step list, as JSON, in one place",
     u'<div class="tabbar" id="mainTabs" role="tablist">',
     TOURDATA + u'<div class="tabbar" id="mainTabs" role="tablist">',
     u'id="tourdata"'),

    (u"...and the page reads it and offers the walkthrough once",
     u'<script>UJ.recact&&(!UJ.cfg||!UJ.cfg.id||UJ.cfg.id==="microns")&&UJ.recact.load();</script>',
     u'<script>UJ.recact&&(!UJ.cfg||!UJ.cfg.id||UJ.cfg.id==="microns")&&UJ.recact.load();</script>\n'
     u'<!-- The walkthrough: read the step list, wire the Tutorial button, and OFFER it on a first\n'
     u'     visit. ready(), never start(): a tutorial that begins by itself is one happening to\n'
     u'     somebody rather than one they asked for.\n'
     u'     ready() RATHER THAN load(): this script block sits ~25,000 characters ABOVE the\n'
     u'     #tourdata block, so at this point the data is not in the document yet. load() returned\n'
     u'     null here and the whole walkthrough was dead on the deployed page until 2026-10-23;\n'
     u'     ready() waits for DOMContentLoaded when it has to. -->\n'
     u'<script>UJ.tour&&UJ.tour.ready();</script>'),

    # The removal pair that used to sit here -- "...and the superseded single Tutorial button is
    # taken out" -- is gone: sweep_tutorial_buttons() above does that job for every version of
    # that button at once, including the ones this file no longer remembers the bytes of.

    # 2026-10-23, after running the deployed page. The pair above now writes a ready() init, but on
    # a tree where the earlier load() init has already been written it INSERTS rather than
    # replaces, leaving two init blocks. This takes the stale one out; on a fresh checkout its
    # input is absent and the removal guard skips it. A removal is guarded on its input being
    # gone, never on its (empty) output.
    (u"...and the superseded load() init is taken out",
     u"""<!-- The walkthrough: read the step list, wire the Tutorial button, and OFFER it on a first
     visit. offerOnce, never start: a tutorial that begins by itself is one happening to
     somebody rather than one they asked for. -->
<script>UJ.tour&&UJ.tour.load()&&UJ.tour.offerOnce();</script>
""",
     u""),
])

# The JSON block is rewritten wholesale whenever the steps here change, which is what keeps this
# file the single definition rather than a thing that was once copied into the page.
s = io.open(UJ, encoding="utf-8").read()
import re as _re
cur = _re.search(r'<script type="application/json" id="tourdata">[\s\S]*?</script>\n', s)
assert cur, "the #tourdata block went missing"
if cur.group(0) != TOURDATA:
    s = s[:cur.start()] + TOURDATA + s[cur.end():]
    io.open(UJ, "w", encoding="utf-8").write(s)
    print("  ok: the step list was rewritten from this file")
else:
    print("  already there: the step list matches this file")

print("\n%s. Now: python3 src/build_stamps.py, then node tourcheck.js"
      % ", ".join("%s: %d steps" % (p["id"], len(p["steps"])) for p in CFG["parts"]))
