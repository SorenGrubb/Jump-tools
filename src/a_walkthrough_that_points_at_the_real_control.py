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
  a "Tutorial" button     in the tab bar, carrying data-tour-start="part1"; the engine wires it
  UJ.tour.ready()         reads the block, wires the button, offers it once -- and waits for
                          DOMContentLoaded, because this script block sits above #tourdata in the
                          document and load() on its own found nothing there

ONLY PART ONE IS DECLARED. Parts two and three are real and are coming, but a button that opens an
empty walkthrough is worse than no button, so nothing is declared until its steps are written.
tourcheck.js asserts that every part that EXISTS has steps and a button, rather than asserting a
count that would force an empty one into being.

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
                u"<b>Show in VR</b> opens them as meshes you can walk through. Part three covers "
                u"those properly — the EM plane, the 3D mesh, the viewer, VR, and tracing "
                u"structures of your own."},
    ],
}

CFG = {
    "key": "grubblab_ujump_tour_v1",
    "offer": u"A short walkthrough of the Jump tab &mdash; finding a cell and saying what it is. "
             u"About two minutes.",
    "parts": [PART1, PART2],
}

TOURDATA = (u'<script type="application/json" id="tourdata">\n'
            + json.dumps(CFG, indent=1, ensure_ascii=False)
            + u'\n</script>\n')

changed = edit(UJ, [
    (u"core/tour.js is loaded after stepthrough, whose activateTab a step may use",
     u'<script src="core/stepthrough.js"></script>',
     u'<script src="core/stepthrough.js"></script>\n'
     u'<!-- The walkthrough overlay. AFTER core/stepthrough.js: a step may name a tab, and that is\n'
     u'     stepthrough\'s activateTab. core/tour.js, 2026-10-23. -->\n'
     u'<script src="core/tour.js"></script>'),

    (u"a Tutorial button in the tab bar",
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false"',
     u'<button type="button" class="tabbtn" data-tour-start="part1"\n'
     u'        title="A guided walkthrough of the Jump tab, pointing at each control in turn. '
     u'Esc leaves it; it remembers where you got to.">❓ Tutorial</button>\n'
     u'<button type="button" class="tabbtn" data-tour-start="part2"\n'
     u'        title="A guided walkthrough of Filter and show — describing a population and '
     u'getting back every cell that matches.">❓ Tutorial 2</button>\n'
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

    # 2026-10-23, part two. The button pair above now writes TWO buttons, and on a tree where the
    # one-button version has already run it inserts beside it rather than replacing it, leaving
    # two "Tutorial" buttons for part one. Fourth time this project has paid for an insert where a
    # replace was meant; the removal is guarded on its input, as every removal here is.
    (u"...and the superseded single Tutorial button is taken out",
     u"""<button type="button" class="tabbtn" data-tour-start="part1"
        title="A guided walkthrough of this tab, pointing at each control in turn. Esc leaves it; it remembers where you got to.">❓ Tutorial</button>
""",
     u""),

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

print("\n%d steps in part one. Now: python3 src/build_stamps.py, then node tourcheck.js"
      % len(PART1["steps"]))
