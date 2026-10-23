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
  UJ.tour.offerOnce()     a dismissable invitation on a first visit, never an auto-start

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
         "say": u"You can now find a cell and say what it is. Part two is about looking at it "
                u"properly &mdash; the EM plane, the 3D mesh, the viewer and VR. Part three is "
                u"tracing your own structures and taking a block of the volume into Blender."},
    ],
}

CFG = {
    "key": "grubblab_ujump_tour_v1",
    "offer": u"A short walkthrough of the Jump tab &mdash; finding a cell and saying what it is. "
             u"About two minutes.",
    "parts": [PART1],
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
     u'        title="A guided walkthrough of this tab, pointing at each control in turn. '
     u'Esc leaves it; it remembers where you got to.">❓ Tutorial</button>\n'
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false"'),

    (u"the step list, as JSON, in one place",
     u'<div class="tabbar" id="mainTabs" role="tablist">',
     TOURDATA + u'<div class="tabbar" id="mainTabs" role="tablist">',
     u'id="tourdata"'),

    (u"...and the page reads it and offers the walkthrough once",
     u'<script>UJ.recact&&(!UJ.cfg||!UJ.cfg.id||UJ.cfg.id==="microns")&&UJ.recact.load();</script>',
     u'<script>UJ.recact&&(!UJ.cfg||!UJ.cfg.id||UJ.cfg.id==="microns")&&UJ.recact.load();</script>\n'
     u'<!-- The walkthrough: read the step list, wire the Tutorial button, and OFFER it on a first\n'
     u'     visit. offerOnce, never start: a tutorial that begins by itself is one happening to\n'
     u'     somebody rather than one they asked for. -->\n'
     u'<script>UJ.tour&&UJ.tour.load()&&UJ.tour.offerOnce();</script>'),
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
