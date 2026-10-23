# -*- coding: utf-8 -*-
u"""µJump gets a walkthrough — four of them, behind one Tutorial button.           2026-10-23

Søren: *"We should make a tutorial for uJump that walks the user through the functions and
features."* Asked which form, he chose **the overlay on the real page** over a written page with
screenshots and asked for it **in parts**. The parts, in the order he set them:

  find         finding a cell, and saying what it is                             15 steps
  organelles   logging a structure, outlining it, and the two being paired       18 steps
  filter       Filter and show — describing a population instead of a cell       14 steps
  export       taking a cube of the volume away, to Colab or to Blender           6 steps

ORGANELLES SITS BEFORE FILTER AND SHOW at his word: *"Ok now we need the organelle annotation
and tracing tutorial, but that should be before the filter and show."* Tracing moved in there
with it, out of the export part, so a contour is described once and beside the annotation it
serves. Audience: a neuroscientist who has not seen this tool — it explains the tool, not the
biology.

THE IDS ARE NAMES, NOT NUMBERS. They were part1/part2/part3, and inserting a part in the middle
renamed every part after it — silently, in saved progress as well as in the code, and in every
line of prose that said "part three". Names do not move, the picker numbers its own rows, and
the steps refer to each other by what they cover.

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

VR IS DELIBERATELY ABSENT: vr.html is being rewritten elsewhere, and a walkthrough pointing at
controls about to move is worse than none. It gets a fifth part once that settles, and
tourcheck.js asserts the invariant rather than a count -- every part that EXISTS has steps, a
title and a line saying what it covers -- so adding one needs no change there.

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
PART_FIND = {
    "id": "find",
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

        # NAMED, NOT NUMBERED. Every cross-reference between parts used to say "part two" and
        # "part three", and inserting the organelle part before Filter and show made all of them
        # wrong at once -- in prose, where nothing can check it. The picker numbers its own rows;
        # the text names the walkthrough instead, so reordering costs nothing.
        {"at": "#mainTabs", "title": u"That is the first part",
         "say": u"You can now find a cell and say what it is. The rest go outwards from there: "
                u"<b>organelles</b>, logging where a structure sits and outlining what shape it "
                u"is; <b>Filter and show</b>, describing a population instead of a cell; "
                u"<b>where the numbers come from</b>, which is what all of it adds up to; and "
                u"two on taking it elsewhere &mdash; a <b>region</b> exported to a notebook, and "
                u"a collection of cells opened <b>in VR</b>."},
    ],
}

# ── ORGANELLES ────────────────────────────────────────────────────────────────────  2026-10-23
# Søren: *"Ok now we need the organelle annotation and tracing tutorial, but that should be before
# the filter and show."* Asked where tracing should end up, he chose to move it out of the export
# part and in here, next to the annotation it serves -- so tracing is described once, and the part
# that follows Filter and show shrinks to taking data away.
#
# WHY THESE TWO BELONG TOGETHER, which is also the thing the part has to teach: µJump logs an
# organelle two different ways and they are not alternatives. A POINT says WHERE a structure is
# (a point, or a pair of points for anything with two ends); an OUTLINE says WHAT SHAPE it is,
# contour by contour, with a volume. core/organellelink.js is the rule that marries them -- a
# point inside an outline is the same organelle -- and the cell panel's Organelles section counts
# all three: outlined, logged, paired. A tutorial that covered them in different parts would be
# teaching them as two features, which is exactly the mistake that module was written to undo.
#
# THREE ROUTES IN, and the order here is the order of effort: the section on the cell panel that
# shows what is already known, the per-cell form behind "Log one", and the bulk card for the day
# you have marked the same kind of structure in forty cells.
PART_ORGAN = {
    "id": "organelles",
    "title": u"Organelles — logging them, and outlining them",
    "blurb": u"Where a structure sits, what shape it is, and how the two are paired: the cell's "
             u"Organelles section, the report form, the bulk route, and the tracing pad.",
    "steps": [
        {"say": u"A cell's identity is one answer about the whole cell. This part is about the "
                u"<b>structures inside it</b> &mdash; centrioles, cilia, mitochondria, and the "
                u"rest of a 61-kind list. Two things can be recorded about each one, and they "
                u"are not alternatives: a <b>point</b> saying where it is, and an <b>outline</b> "
                u"saying what shape it is. About four minutes.",
         "title": u"Where a structure is, and what shape it is"},

        {"at": "#cellOrganDetails", "tab": "jump", "press": "#randomOfType",
         "needs": "#cellOrganDetails", "after": u"show a cell, so there is something to count",
         "title": u"What is already known about this cell",
         "say": u"The cell panel's <b>Organelles</b> section counts three things: how many "
                u"structures are <b>outlined</b>, how many are <b>logged</b> as points, and how "
                u"many are <b>paired</b> &mdash; a point that falls inside an outline, which is "
                u"the same organelle recorded both ways. Open it and each one is listed."},

        {"at": ".organshowall", "needs": ".organshowall", "press": "#randomOfType",
         "after": u"open the Organelles section on a cell that has some",
         "title": u"All of them at once, in the viewer",
         "say": u"This opens Neuroglancer with the cell and every outline on it &mdash; one "
                u"annotation layer each, in the colours they were drawn in, cell see-through in "
                u"the 3D pane. It is the quickest way to see whether a set of outlines is "
                u"distributed the way you expect, or clustered where you happened to be looking."},

        {"at": "#idfOrganelleToggle", "needs": "#idfOrganelleToggle", "press": "#idfgo",
         "after": u"work through Identify to its result screen",
         "title": u"Logging one yourself",
         "say": u"At the end of the guided identification, <b>Log one &rarr;</b> opens the "
                u"organelle form on the same cell, at the same coordinate. It is deliberately a "
                u"small line rather than a panel: it is the thing you do <i>after</i> saying what "
                u"the cell is, not instead of it."},

        {"at": "#organRows", "needs": "#organRows", "press": "#idfOrganelleToggle",
         "after": u"press “Log one”",
         "title": u"One row per structure, from a list of 61",
         "say": u"Each row is one structure: pick its kind from the topic-organised list and give "
                u"its coordinate. Anything with two ends &mdash; a primary cilium, an NR type II "
                u"&mdash; takes <b>two</b> points, base and tip. Paste “x, y, z” into "
                u"the first box and all three fill themselves."},

        {"at": "#organAddRow", "needs": "#organAddRow", "press": "#idfOrganelleToggle",
         "after": u"press “Log one”",
         "title": u"As many as the cell has",
         "say": u"<b>+ Add another structure</b> gives you another row, of any kind. Log two "
                u"centrioles if there are two; log a centriole and the cilium sitting on it, "
                u"which is the usual pair. One report, one cell, however many structures."},

        {"at": ".organ-paste-box", "needs": ".organ-paste-box", "press": "#idfOrganelleToggle",
         "after": u"press “Log one”",
         "title": u"Or point at them in the viewer instead",
         "say": u"Typing coordinates is the slow way. Ctrl+click each structure in Neuroglancer, "
                u"paste that link in here, pick what they all are, and every marker becomes a "
                u"row. It stays shut by default because it is the shortcut for the day you have "
                u"twelve mitochondria &mdash; not the way in."},

        {"at": "#organSubmit", "needs": "#organSubmit", "press": "#idfOrganelleToggle",
         "after": u"press “Log one”",
         "title": u"Submitting it",
         "say": u"One submission carries every row, with an optional comment on all of them "
                u"&mdash; the place to say “cilium is short, hard to trace to a clear "
                u"tip”. Signing in with Google is what credits the report to you and tells "
                u"you if it is confirmed."},

        {"at": "#bulkOrganPanel", "tab": "jump",
         "title": u"The other end of the scale: one kind, many cells",
         "say": u"<b>Bulk organelle annotation</b> is for a survey rather than a cell. Mark the "
                u"same kind of structure in as many cells as you like in Neuroglancer &mdash; a "
                u"point, or a line for anything with two ends &mdash; and paste the whole address "
                u"bar here. You never visit the cells one at a time."},

        {"at": "#bulkOrganResolve",
         "title": u"It works out which cell each marker is in",
         "say": u"<b>Find the cells</b> looks every marker up in the real segmentation, in order: "
                u"the cell at that point; failing that the nucleus at it; failing that the "
                u"nearest nucleus, with the distance shown so you can judge it. A marker in "
                u"nothing is listed with the reason and cannot be ticked. Then tick the rows you "
                u"trust, add a comment, and submit them together &mdash; nothing is guessed."},

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

        {"at": "#mainTabs",
         "title": u"Both halves, on one cell",
         "say": u"That is the pair: a <b>point</b> from the report form saying a structure is "
                u"there, and an <b>outline</b> from the pad saying what shape it is. Record both "
                u"on the same organelle and the cell panel's Organelles section shows it as "
                u"<b>paired</b> &mdash; which is the strongest thing this tool can say about a "
                u"structure."},
    ],
}

PART_FILTER = {
    "id": "filter",
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

        # ── STEPPING THROUGH THE MATCHES ──────────────────────────────────────  2026-10-23
        # The one card in the Filter tab nothing pointed at, and the least guessable thing in
        # the tool: it is a WORKLIST, with memory, and it moves the identification panel into
        # itself so you never leave the tab. It is display:none until a preview has run, so all
        # three steps wait on it.
        {"at": "#stepThroughCard", "needs": "#stepThroughCard", "press": "#filterRun",
         "after": u"press \u201cPreview matches\u201d",
         "title": u"Going through them one at a time",
         "say": u"Once you have previewed a set, this card appears. <b>Systematically step "
                u"through matches</b> visits every matched cell <b>exactly once, in a fixed "
                u"order</b> &mdash; which is the difference between it and the random buttons on "
                u"the Jump tab, where nothing stops a cell coming up twice or never."},

        {"at": "#stepNext", "needs": "#stepNext", "press": "#filterRun",
         "after": u"press \u201cPreview matches\u201d",
         "title": u"...without leaving the tab",
         "say": u"<b>Next \u2192</b> loads the next match, and the cell panel and the whole "
                u"identification screen move <b>into this card</b> rather than sending you back "
                u"to the Jump tab. The counter above says where you are and how many you have "
                u"checked. This is the shape to use for a survey: describe the population once, "
                u"then work down it."},

        {"at": "#stepReset", "needs": "#stepReset", "press": "#filterRun",
         "after": u"press \u201cPreview matches\u201d",
         "title": u"It remembers, per set of matches",
         "say": u"Your position is kept in this browser <b>for this exact set of matches</b>, so "
                u"you can close the tab and resume tomorrow. Change the conditions and preview "
                u"again and the count starts fresh &mdash; which is right: it is a different "
                u"population, so being \u201chalf way\u201d through the old one means nothing. "
                u"<b>Reset progress</b> does it deliberately."},

        {"at": "#filterVR", "title": u"Or look at all of them at once",
         "say": u"<b>Open all matches in Neuroglancer</b> puts the whole set in the viewer; "
                u"<b>Show in VR</b> opens them as meshes you can walk through. The "
                u"<b>region</b> walkthrough does the same for a <b>cube of the volume</b> rather "
                u"than a set of cells &mdash; exported to a notebook or straight to Blender."},
    ],
}

# ── WHERE THE NUMBERS COME FROM ──────────────────────────────────  2026-10-23
# Søren: *"Let's do a common one for ref and stats."* One part, and it is the right pairing
# rather than a convenience: the References tab says where the CRITERIA come from and the
# dashboard says what applying them has produced. Separately, References is three steps of
# "here are some links" and the dashboard is sixteen charts with nothing to anchor them.
#
# WHY REFERENCES WOULD NOT CARRY A PART ALONE. It is one card of citations. The thing worth
# saying about it is not the list, it is that every rung of the guided tree is traceable to a
# paper, and that one of those papers argues the subtypes grade into one another -- which is why
# the tree offers a plain "Pericyte". That is a sentence, not a walkthrough.
#
# THE REFS TAB HAS NO IDS AT ALL in its markup, so these steps point at the tab panel itself and
# at a citation link by class. Both are real selectors tourcheck.js can find; neither is an id,
# which is why `inFile` grew its class and attribute spellings.
#
# THE CHARTS DO NOT EXIST UNTIL THE TAB IS OPENED. core/stepthrough.js loads Plotly and calls
# initDashboardTab the first time the dashboard tab is activated, so the plot divs are empty --
# and therefore 0x0 -- before that. Every chart step waits. The `tab` on the first dashboard step
# is what sets the load going, so by the time the reader reaches a chart it is usually there.
PART_EVIDENCE = {
    "id": "evidence",
    "title": u"Where the numbers come from — references and the dashboard",
    "blurb": u"What every classification rests on, and what the whole dataset looks like once "
             u"everybody's identifications are counted up.",
    "steps": [
        {"say": u"Two tabs that are easy to walk past, and they are a pair. <b>References</b> "
                u"says where the criteria come from; the <b>Statistics dashboard</b> says what "
                u"applying them has produced across the whole volume &mdash; including your own "
                u"contributions. About three minutes.",
         "title": u"The evidence, and the totals"},

        {"at": "[data-tabpanel=\"refs\"]", "tab": "refs",
         "title": u"Nothing here is this tool's opinion",
         "say": u"Every rung of the guided identification traces to a paper, and they are all "
                u"here: the pericyte subtype naming, the criteria tested against serial "
                u"block-face SEM, the MICrONS cell-type predictions, the perisomatic "
                u"classification. If you disagree with a branch of the tree, this is where to go "
                u"and argue with it."},

        {"at": "a.ref", "tab": "refs",
         "title": u"...and every one is a link you can follow",
         "say": u"DOIs and PMC links, not just titles. One of them matters more than the rest: "
                u"the 2023 review argues the mural subtypes <b>grade into one another</b> rather "
                u"than forming discrete classes, which is exactly why the tree always offers a "
                u"plain <b>Pericyte</b> as well as the three subtypes. A classifier that hides "
                u"that is lying about its own confidence."},

        {"at": "#dashPanel", "tab": "dashboard",
         "title": u"What it all adds up to",
         "say": u"Sixteen charts over the whole dataset, drawn from the same tables this tool "
                u"reads &mdash; not a snapshot pasted in. Each one carries its own note saying "
                u"what it is counting and which identifications it trusts, which is worth "
                u"reading before quoting a number from it."},

        {"at": "#refreshBtn",
         "title": u"“Live” means live",
         "say": u"The charts are built when you first open this tab. <b>↻ Refresh live "
                u"data</b> fetches again, so an identification somebody submitted ten minutes "
                u"ago is in it. The line beside the button says what state it is in."},

        {"at": "#plotCellsPerType", "needs": "#plotCellsPerType > *",
         "after": u"let the charts finish drawing", "pageWait": True, "wait": 20000,
         "title": u"How many of each kind there are",
         "say": u"<b>Cells per cell type</b>, across the whole volume. The companion below it, "
                u"<b>cells per type per cortical layer</b>, is the one to look at before "
                u"believing a count: a type that looks rare overall may simply live in a layer "
                u"this volume barely reaches."},

        {"at": "#plotIdentifiedUnclassified", "needs": "#plotIdentifiedUnclassified > *",
         "after": u"let the charts finish drawing", "pageWait": True,
         "title": u"How much is still unknown",
         "say": u"<b>Identified vs. unclassified</b> is the size of the job, and the reason this "
                u"tool exists. Beside it, unclassified cells per layer shows where the gaps are "
                u"&mdash; which is a reasonable way to choose what to work on next, rather than "
                u"taking random cells."},

        {"at": "#plotIdentitySource", "needs": "#plotIdentitySource > *",
         "after": u"let the charts finish drawing", "pageWait": True,
         "title": u"Who said so — the chart to understand first",
         "say": u"<b>MICrONS-predicted vs. verified by Grubb et al. vs. community-identified</b> "
                u"separates an automatic prediction from a checked call from a crowd call. It is "
                u"where your own identifications appear, and it is the chart that decides how "
                u"much any of the others can be trusted. Read it as provenance, not as a score."},

        {"at": "#plotCiliaPercent", "needs": "#plotCiliaPercent > *",
         "after": u"let the charts finish drawing", "pageWait": True,
         "title": u"Where the organelle logging ends up",
         "say": u"<b>% of cells with a primary cilium, by cell type</b> &mdash; and below it, "
                u"cilium length and nucleus-to-centriole distance by type. These are built from "
                u"exactly the points logged in the organelle walkthrough. One cilium is an "
                u"observation; three hundred is a distribution with a shape to it."},

        {"at": "#neighborTypePicker", "needs": "#neighborTypePicker option",
         "after": u"let the charts finish drawing", "pageWait": True,
         "title": u"Charts you can re-aim",
         "say": u"Several charts have a picker above them &mdash; this one chooses whose "
                u"<b>5 nearest physical neighbours</b> you are looking at. The same goes for the "
                u"volume charts, the connectivity ones and the synapse ones: the question is "
                u"fixed, the cell type is yours."},

        {"at": "#connectivityArea", "needs": "#connectivityArea > *",
         "after": u"let the charts finish drawing", "pageWait": True,
         "title": u"...and what the cells do to each other",
         "say": u"Below the counting charts: the types with the most synaptic connections, "
                u"<b>input vs. output synapses</b> per type, and average mesh contact points "
                u"between types. This is the part of the dashboard that is about relationships "
                u"rather than inventory."},

        {"at": "#plotReportsOverTime", "needs": "#plotReportsOverTime > *",
         "after": u"let the charts finish drawing", "pageWait": True,
         "title": u"And the project's own history",
         "say": u"<b>Cumulative community reports over time</b> is this tool watching itself "
                u"fill up. It is also the honest answer to “how much of this is crowd "
                u"data?” &mdash; you can see the curve and judge for yourself."},

        {"at": "#dashXlsxBtn",
         "title": u"Take the numbers, not a screenshot",
         "say": u"<b>Download the numbers as Excel</b> gives you every chart's underlying "
                u"figures in one workbook, a sheet per chart. If a number from here is going "
                u"into a paper or a talk, take it from this file &mdash; then the figure and "
                u"your source agree, and you can say which day you pulled it."},

        {"at": "#mainTabs",
         "title": u"That is the evidence",
         "say": u"Criteria you can check in <b>References</b>, totals you can check in the "
                u"<b>dashboard</b>, and provenance on every one of them. What is left is taking "
                u"the data somewhere else: a <b>region</b> exported to a notebook or Blender, "
                u"and a collection of cells opened <b>in VR</b>."},
    ],
}

# ── INTO VR ───────────────────────────────────────────────────  2026-10-23
# Søren: *"Now we need a guide for collecting cells for VR, opening the VR scene and continuing
# the tutorial there."* This part is the FIRST half of that -- everything that happens in µJump,
# ending at the button that opens the scene. The second half lives in vr.html's own step list
# (src/the_walkthrough_follows_you_into_vr.py) because it is a different document: a walkthrough
# cannot survive a navigation, so the last step here declares `handoff` and the scene picks it up.
#
# THE CONTROLS ARE core/vrbasket.js's AND ARE ALL BUILT AT RUNTIME. ".vrb-btn" is installed beside
# every mesh-download button, and "#vrb-pill" is display:none until the collection has something
# in it -- so every step here waits, and `needs` is a VISIBILITY test (rectOf), not an existence
# test, which is what makes a hidden pill wait rather than spotlight nothing.
PART_TOVR = {
    "id": "vrcollect",
    "title": u"Into VR — collecting cells and opening the scene",
    "blurb": u"Gathering the cells you want to stand among, what travels with them, and the two "
             u"ways into the scene: this machine, or a standalone headset.",
    "steps": [
        {"say": u"The viewer is a second page, and you decide what goes into it. You build a "
                u"<b>collection</b> here — a list of cell ids, a few hundred bytes, not "
                u"megabytes of geometry — and the scene fetches the meshes itself. This part "
                u"gets you there; the walkthrough then carries on inside the scene. "
                u"About two minutes.",
         "title": u"You choose what goes in"},

        {"at": ".vrb-btn", "tab": "jump", "needs": ".vrb-btn", "press": "#randomOfType",
         "after": u"show a cell, so there is something to collect",
         "title": u"+ VR, beside every mesh",
         "say": u"Wherever this tool offers a cell's mesh, there is a <b>+ VR</b> beside it. "
                u"Pressing it adds that cell to the collection and the button turns into "
                u"<b>✓ In VR</b> — press it again to take it out. Nothing is fetched by "
                u"pressing it: you are building a list."},

        {"at": "#vrb-pill", "needs": "#vrb-pill", "press": ".vrb-btn",
         "after": u"add a cell with “+ VR”",
         "title": u"The collection, bottom right",
         "say": u"<b>🥽 VR collection (n)</b> appears once there is something in it and "
                u"says how many. The collection lives in this browser and is shared by every Jump "
                u"tool on the site, so cells you gather here are still there tomorrow, and still "
                u"there if you wander off into another tool."},

        {"at": "#vrb-tray", "needs": "#vrb-tray", "press": "#vrb-pill",
         "after": u"press the collection pill",
         "title": u"What is in it, and what travels with it",
         "say": u"Each row is one cell, with its id and a × to drop it. A row may also say "
                u"“· n synapses” or “· n points”: pressing + VR in "
                u"<b>Connectivity</b>, <b>Cell contacts</b> or <b>Astrocyte–synapse "
                u"proximity</b> attaches those points to the cell, and the scene draws them on "
                u"it. More than about thirty cells and the tray warns you — a standalone "
                u"Quest 2 will struggle."},

        {"at": ".vrb-go", "needs": ".vrb-go", "press": "#vrb-pill",
         "after": u"press the collection pill",
         "title": u"Opening the scene on this machine",
         "say": u"<b>Open VR viewer</b> opens the scene in a new tab with this collection in it. "
                u"On a PC with Quest Link that is the route to take: open it here, then press "
                u"<b>Enter VR</b> in the scene. On a plain monitor it is still the 3D viewer, "
                u"with the mouse."},

        {"at": "[data-act=\"copy\"]", "needs": "[data-act=\"copy\"]", "press": "#vrb-pill",
         "after": u"press the collection pill",
         "title": u"...or on a standalone headset",
         "say": u"A standalone Quest has its own browser, which cannot see this collection. "
                u"<b>Copy headset link</b> puts the list in a URL to send yourself. One "
                u"limitation the tray states: synapses and contact points are too many for a "
                u"link — for those, open the scene here, press <b>💾 Save "
                u"scene</b>, and open the saved scene’s link in the headset instead."},

        {"at": "#filterVR", "tab": "filter",
         "title": u"Or send a whole population at once",
         "say": u"Back in <b>Filter and show</b>: once you have previewed a set of matches, "
                u"<b>🥽 Show in VR</b> sends them straight to the scene without "
                u"collecting them one at a time, and the dropdown beside it caps how many "
                u"— evenly spread through the list when there are more. Thirty for a "
                u"headset or a laptop; several hundred on a strong PC."},

        # THE HANDOFF. Declared on the step that points at the button which leaves this page, and
        # written when the step is SHOWN -- by the time they have pressed it there is no later
        # moment to write anything in.
        {"at": ".vrb-go", "needs": ".vrb-go", "press": "#vrb-pill", "handoff": "vrscene",
         "after": u"press the collection pill",
         "title": u"Go on, then",
         "say": u"Press <b>Open VR viewer</b>. The walkthrough carries on in the scene itself "
                u"— moving about, seeing inside the cells, and finding the tracings and "
                u"organelles from earlier drawn on them. If the scene opens and does not offer "
                u"to continue, its own <b>Tutorial</b> button has it."},
    ],
}

# ── THE EXPORT ────────────────────────────────────────────────────────────────────  2026-10-23
# What is left once tracing moved into the organelle part: taking a CUBE of the volume away. Not
# a set of cells (that is Filter and show) and not one structure (that is the pad) -- a region,
# with a notebook that already knows its coordinates.
#
# VR IS DELIBERATELY NOT HERE. vr.html is being rewritten in another conversation and a
# walkthrough pointing at controls which are about to move is worse than no walkthrough; it gets
# its own part once that settles, and Filter and show's closing step says so rather than
# promising it.
PART_EXPORT = {
    "id": "export",
    "title": u"Taking a region away — the box, Colab and Blender",
    "blurb": u"A cube of the volume rather than a list of cells: the region box, and the "
             u"ready-made notebooks that fetch it, including one that writes a .blend.",
    "steps": [
        {"say": u"Everything so far has happened <b>in</b> the tool. This part is about getting "
                u"a piece of the volume <b>out</b> of it &mdash; a cube, with its image data, its "
                u"labels or its meshes, ready to open in a notebook or in Blender. About two "
                u"minutes.",
         "title": u"Getting a piece of it out"},

        {"at": "#filterSecRegion", "tab": "filter",
         "title": u"Where to ask for one",
         "say": u"It lives in <b>Filter and show</b>, alongside the conditions, because it is the "
                u"same question asked geometrically: instead of naming a kind of cell, name a "
                u"<b>cube</b> and take what is inside it. Open this section and you can type the "
                u"corners, or use the cell on screen as the centre."},

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
         "say": u"Four walkthroughs: finding a cell and saying what it is, recording the "
                u"structures inside it, asking for every cell that matches a description, and "
                u"taking a region away. VR gets its own once that viewer settles. The Tutorial "
                u"button brings this list back whenever you want one again."},
    ],
}

CFG = {
    "key": "grubblab_ujump_tour_v1",
    "offer": u"A short walkthrough of the Jump tab &mdash; finding a cell and saying what it is. "
             u"About two minutes.",
    "menu": u"Four short walkthroughs. Each one points at the real controls, in order, and "
            u"waits for you &mdash; nothing is pressed for you. Esc leaves at any time and it "
            u"remembers where you got to.",
    # ORDER IS SØREN'S: organelles BEFORE Filter and show. "Ok now we need the organelle
    # annotation and tracing tutorial, but that should be before the filter and show." It is also
    # the right order on its own terms -- organelles are about one cell, which is where somebody
    # who has just done part one still is, and Filter and show is the first thing here that asks
    # you to think in populations.
    "parts": [PART_FIND, PART_ORGAN, PART_FILTER, PART_EVIDENCE, PART_EXPORT,
              PART_TOVR],
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
