# -*- coding: utf-8 -*-
u"""The walkthrough follows you into the VR scene.                                 2026-10-23

Søren: *"Now we need a guide for collecting cells for VR, opening the VR scene and continuing the
tutorial there."*

WHY THIS IS A SECOND FILE. A walkthrough cannot survive a navigation — the document it was
running in is gone. So the guide is in two halves, one per page:

  µJump      the `vrcollect` part: + VR, the collection pill and tray, the headset link, Show in
             VR, and the button that opens the scene. Lives in
             src/a_walkthrough_that_points_at_the_real_control.py, which owns µJump's #tourdata.
  vr.html    the `vrscene` part: this file. Moving about, seeing inside the cells, the EM plane,
             and the tracings and organelles from the earlier walkthroughs drawn on the cells.

One generator per page, because each page's #tourdata has exactly one author. Two generators
writing one block would fight, and the loser would be whichever ran first.

HOW THE HANDOFF WORKS. µJump's last VR step carries `handoff: "vrscene"`. Showing that step writes
the id beside the progress under the SAME storage key; core/tour.js's ready() finds the note here,
offers to carry on, and spends it. THE KEY IS THEREFORE SHARED, and it is still called
grubblab_ujump_tour_v1 — the name records where the walkthrough starts, not which page owns it.
tourcheck.js asserts both pages declare the same key, which is the part that has to be true.

A STANDALONE HEADSET WILL NOT SEE THE NOTE: it is a different browser with its own localStorage.
Nothing breaks — no note means no continuation offer, and the Tutorial button here still has the
part. Said in µJump's last step so the promise is not silently broken.

VR.HTML IS BEING REWRITTEN IN ANOTHER CONVERSATION, and that is the reason these steps are
SELECTORS rather than prose: if a control moves or is renamed, `node tourcheck.js` says so, in
red, with the step number. A written guide would still read perfectly and be wrong. Only the
source files are committed and this generator is run IN PLACE on his machine, so it edits whatever
vr.html is at that moment rather than a copy of it from an hour ago.

Check: tourcheck.js — its vr.html half reads this block back out and looks for every selector.
Run: python3 src/the_walkthrough_follows_you_into_vr.py, then python3 src/build_stamps.py,
     then node tourcheck.js
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VR = os.path.join(HERE, "vr.html")

# ── THE STEPS ─────────────────────────────────────────────────────────────────────────────────
# Every `at` is a selector tourcheck.js looks for in vr.html's markup. #vrslot is the one that
# waits: the Enter VR button is only put there when the browser actually has WebXR, so on a plain
# monitor that step says what it is for and lets the reader carry on.
PART_VRSCENE = {
    "id": "vrscene",
    "title": u"In the scene \u2014 moving about, and what is on the cells",
    "blurb": u"Getting around, seeing inside, the EM plane, and finding your own tracings and "
             u"the community's organelles drawn on the cells you collected.",
    "steps": [
        {"say": u"You are standing in whatever was sent to this viewer &mdash; a collection "
                u"you built, a set of filter matches, or a saved scene. The meshes are being "
                u"fetched now; nothing was downloaded while you were choosing. "
                u"This part is about getting around, and about the things from the earlier "
                u"walkthroughs that turn up here on the cells. About three minutes.",
         "title": u"The collection, at scale"},

        {"at": "#sub",
         "title": u"What it is doing, and how heavy it is",
         "say": u"This line is the scene's running commentary: what it is fetching, how many "
                u"cells arrived, and how many million triangles it is drawing. That last "
                u"number is the one that decides whether a headset keeps up, and <b>Light</b> "
                u"below is the lever for it."},

        {"at": "#keysCard",
         "title": u"Moving about",
         "say": u"<b>W A S D</b> walk, <b>Q</b> and <b>E</b> go down and up. With the mouse: drag "
                u"to turn, scroll to zoom, right-drag to pan, and <b>right-click to fly to a "
                u"point</b> &mdash; which is the fastest way to get to a cell you can see. Click "
                u"a cell to pick it. This card folds away with <b>H</b> or a click."},

        # THE TABS, EARLY AND DELIBERATELY. The panel is seven panes and the steps below switch
        # between them; a reader who has not been told that will think the panel is rearranging
        # itself. It is also the step that makes the rest findable again afterwards.
        {"at": "#tabs",
         "title": u"The panel is seven tabs",
         "say": u"<b>View</b>, <b>Map</b>, <b>Objects</b>, <b>Activity</b>, <b>Tools</b>, "
                u"<b>Spray</b> and <b>Share</b>. The walkthrough will move between them, so "
                u"watch this row rather than hunting for a control that has gone: it has not, "
                u"its tab is simply not the open one. <b>Aa</b> at the top turns the labels off "
                u"once you know the icons."},

        {"at": "#resetBtn", "tab": "view",
         "title": u"When you get lost",
         "say": u"You will. Cells are hundreds of micrometres across at this scale and it is easy "
                u"to end up inside one, or well outside the lot. <b>Reset view</b> puts the whole "
                u"collection back in front of you."},

        # #list is empty, and therefore 0x0, until cells arrive -- so this one waits. No `press`:
        # there is nothing for the reader to do but let the fetch finish, and with nothing named
        # the dimming comes off entirely rather than pointing at a button that would not help.
        {"at": "#list", "needs": "#list", "after": u"let the cells finish arriving",
         "pageWait": True, "wait": 15000,
         "title": u"Everything that is in here",
         "say": u"The list above the tabs is one row per thing in the scene &mdash; your cells, "
                u"their nuclei, and anything else you switch on. Clicking a row picks that cell, "
                u"which is what most of the panel then acts on."},

        # The <select> is hidden and replaced by a segmented button row, so the SELECT has no
        # rectangle and the wrapper around it is the visible control. :has() is how you point at
        # a parent; the check looks for both halves of the selector.
        {"at": ".segwrap:has(#detail)", "tab": "view",
         "title": u"How fine the meshes are",
         "say": u"<b>Light</b> is the coarsest level of detail &mdash; about 50k triangles for a "
                u"pyramidal cell &mdash; and is what a standalone Quest 2 handles comfortably. "
                u"<b>Full</b> is the finest level under 8 MB, about 5 million triangles. On a PC "
                u"take Full; in a headset start Light and work up."},

        {"at": "#glassBtn", "tab": "view",
         "title": u"Seeing inside",
         "say": u"<b>See-through</b> makes the cells glassy, which is how you see a nucleus "
                u"sitting inside its soma rather than guessing. Beside it, <b>Nuclei</b> turns "
                u"the blue nuclei on and off, and <b>See-through others</b> keeps the cell you "
                u"picked solid and glasses the rest &mdash; the one you want when a cell is "
                u"buried in company."},

        {"at": ".segwrap:has(#colourSel)", "tab": "view",
         "title": u"Colour that means something",
         "say": u"<b>By type</b> gives each cell type its own colour; <b>excitatory / inhibitory "
                u"/ non-neuronal</b> reduces it to amber, lavender and green, which is the view "
                u"to take when you want the balance of a population rather than its variety."},

        # #vrslot is always in the document; the BUTTON inside it is only put there when the
        # browser can actually enter VR. So the step waits on the button, not the slot -- waiting
        # on the slot would spotlight an empty 330x0 box and claim success.
        {"at": "#vrslot button", "needs": "#vrslot button", "wait": 6000, "pageWait": True,
         "after": u"open this on a machine that has a headset",
         "title": u"Into the headset",
         "say": u"<b>Enter VR</b> appears here when the browser can do it &mdash; a PC with Quest "
                u"Link, or the Quest's own browser. On a plain monitor there is no button and "
                u"nothing is lost: the whole scene works with the mouse, and everything the rest "
                u"of this walkthrough points at works in both."},

        {"at": "#emBtn", "tab": "tools",
         "title": u"The electron micrograph, as a plane",
         "say": u"<b>EM section</b> draws the real micrograph through the picked cell's nucleus "
                u"as a plane the cells pass through. It is the thing that keeps this honest: the "
                u"meshes are an interpretation of that image, and here you see both at once, in "
                u"register."},

        {"at": "#gameBtn", "tab": "tools",
         "title": u"A reason to come back",
         "say": u"<b>Identify a cell (game)</b> drops a cell in front of you, alone and unnamed, "
                u"with the EM section through its nucleus: say what it is and score. Half are "
                u"from the verified dataset and half are MICrONS predictions, so it tests you and "
                u"the predictions at the same time."},

        {"at": "#trcBtn", "tab": "struct",
         "title": u"Your own tracings turn up here",
         "say": u"In <b>Objects</b>: <b>Traced</b> draws the structures traced by hand in "
                u"\u00b5Jump's tracing pad &mdash; lysosomes, whole cells, nuclei &mdash; on the "
                u"cells they belong to. The contours you drew on a flat EM plane are a surface "
                u"you can walk around."},

        {"at": "#orgBtn", "tab": "struct",
         "title": u"...and so do the logged organelles",
         "say": u"<b>Organelles</b> brings in the community-reported points from \u00b5Jump "
                u"that fall inside the bounding box enclosing the cells you brought. A "
                u"centriole gets a 3D arrow from its cell's "
                u"nucleus; a cilium an arrow from base to tip. This is the other half of the "
                u"organelle walkthrough: what was a coordinate in a form is a direction in a "
                u"room."},

        {"at": "#sceneSave", "tab": "share",
         "title": u"Keeping it, and taking it to the headset",
         "say": u"<b>&#128190; Save scene</b> saves everything as it stands &mdash; the cells, "
                u"the view, the EM plane, the cut, the measurements, the paint &mdash; as a link "
                u"you can share or reopen &mdash; and the only way to get synapses and "
                u"contact points into a standalone headset, as the collecting walkthrough "
                u"explains. <b>Copy headset link</b> beside it does the cells alone."},

        {"at": "#panel",
         "title": u"That is the scene",
         "say": u"There is a great deal more in these tabs than one walkthrough should cover "
                u"&mdash; flow, stimulation, recorded activity, a timeline, a tissue block. Every "
                u"control carries a real explanation on hover, which is the right way to meet "
                u"them: one at a time, when you want one. The <b>Tutorial</b> button at the top "
                u"brings this back."},
    ],
}

CFG = {
    # THE SAME KEY AS µJUMP'S, deliberately -- see the header. The handoff note is written under
    # this key on one page and read under it on the other, and the name records where the
    # walkthrough starts rather than which page owns the storage.
    "key": "grubblab_ujump_tour_v1",
    # WHICH GLOBAL SWITCHES THE PANEL'S TABS. vr.html builds seven panes at runtime and exposes
    # window.uiOpenTab(key); it does not load core/stepthrough.js, so the engine has no other way
    # to open the pane a step points into. Declared here rather than hardcoded in core/tour.js,
    # which has no business knowing about one page.
    "tab": "uiOpenTab",
    "offer": u"A short walkthrough of the scene &mdash; moving about, seeing inside the cells, "
             u"and what else can be drawn on them. About three minutes.",
    "menu": u"The walkthrough for the scene. It points at the real controls, in order, and waits "
            u"for you &mdash; nothing is pressed for you. Esc leaves at any time.",
    "parts": [PART_VRSCENE],
}

TOURDATA = (u'<script type="application/json" id="tourdata">\n'
            + json.dumps(CFG, indent=1, ensure_ascii=False)
            + u'\n</script>\n')


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


assert os.path.exists(VR), "vr.html is not here -- this generator edits it in place"

# ── THE BUTTON REGION IS SWEPT, NOT PATCHED ───────────────────────────────────────────────────
# The same lesson µJump's generator learned five times over: a pair whose `new` text changes
# INSERTS beside the old text on an already-generated tree instead of replacing it. So the one
# Tutorial button here is removed and rewritten every run, whatever it currently says.
def sweep_button(path):
    """BOTH THINGS THE PAIR WRITES, or the next run duplicates the one it did not sweep.

    Caught on the second run: sweeping only the button row left the #tourdata block behind, the
    pair's `new` text (block + row) was then no longer present, and it inserted the pair again --
    two #tourdata blocks in one document, which is exactly the "two copies of one list" this
    whole arrangement exists to prevent. A sweep must cover the WHOLE region its pair owns.
    """
    s = io.open(path, encoding="utf-8").read()
    n = 0
    s, k = re.subn(r'<div class="ctl" id="tourRow">[\s\S]*?</div>\n', u"", s)
    n += k
    s, k = re.subn(r'<script type="application/json" id="tourdata">[\s\S]*?</script>\n', u"", s)
    n += k
    io.open(path, "w", encoding="utf-8").write(s)
    print("  swept %d existing piece(s) of the Tutorial row" % n)


print(os.path.basename(VR) + u" — the Tutorial row")
sweep_button(VR)

changed = edit(VR, [
    (u"core/tour.js is loaded with the rest of core/",
     u'<script src="core/traceloft.js"></script>',
     u'<script src="core/traceloft.js"></script>\n'
     u'<!-- The walkthrough overlay, the same one µJump uses. No core/stepthrough.js here:\n'
     u'     this page has no tab bar, so no step names a tab. core/tour.js, 2026-10-23. -->\n'
     u'<script src="core/tour.js"></script>'),

    (u"the step list, as JSON, and one Tutorial button in the panel",
     u'  <h1>\U0001f97d VR collection</h1>\n',
     u'  <h1>\U0001f97d VR collection</h1>\n'
     + TOURDATA +
     u'  <div class="ctl" id="tourRow"><button type="button" data-tour-menu="1"\n'
     u'      title="A guided walkthrough of this scene, pointing at each control in turn. '
     u'Esc leaves it; it remembers where you got to.">❓ Tutorial</button></div>\n'),

    (u"...and the page reads it, picks up a handoff, and offers it once",
     u'</script>\n</body>\n</html>\n',
     u'</script>\n'
     u'<!-- The walkthrough. ready(), never start(): a tutorial that begins by itself is one\n'
     u'     happening to somebody rather than one they asked for. ready() also picks up the note\n'
     u'     left by µJump\'s `handoff` step, so a reader who was told the walkthrough carries\n'
     u'     on here is offered exactly that instead of "First time here?". -->\n'
     u'<script>UJ.tour&&UJ.tour.ready();</script>\n'
     u'</body>\n</html>\n'),
])

# The JSON block is rewritten wholesale whenever the steps here change, which is what keeps this
# file the single definition rather than a thing that was once copied into the page.
s = io.open(VR, encoding="utf-8").read()
cur = re.search(r'<script type="application/json" id="tourdata">[\s\S]*?</script>\n', s)
assert cur, "the #tourdata block went missing"
if cur.group(0) != TOURDATA:
    s = s[:cur.start()] + TOURDATA + s[cur.end():]
    io.open(VR, "w", encoding="utf-8").write(s)
    print("  ok: the step list was rewritten from this file")
else:
    print("  already there: the step list matches this file")

print(u"\n%s: %d steps. Now: python3 src/build_stamps.py, then node tourcheck.js"
      % (PART_VRSCENE["id"], len(PART_VRSCENE["steps"])))
