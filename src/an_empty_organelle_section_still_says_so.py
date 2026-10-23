# -*- coding: utf-8 -*-
u"""An empty Organelles section still says so.                                     2026-10-23

Søren, from his phone, on step 2 of the organelle walkthrough: *"Second part did not register
even though I had pressed show."* His screenshot shows a cell plainly on screen — L2/3 pyramidal
neuron (23P), 4,129 of 19,735 — and the step still reading *"Waiting for you to show a cell."*

THE STEP WAS NOT WRONG; THE SECTION WAS NOT THERE. `renderOrganelleSection()` in core/panel.js
ended with

    if (!anns.length && !trs.length){ host.innerHTML = ""; return; }

so a cell with nothing logged and nothing traced — which is most cells, and certainly a random
pyramidal neuron — got **no Organelles section at all**. The step waits for `#cellOrganDetails`,
which for that cell would never exist, so it waited for ever.

WHY THE TOOL CHANGES RATHER THAN THE STEP. The step could have been made to wait for something
else, and the walkthrough would have moved on while the real problem stayed: the one place that
would tell you *nothing is known about this cell's organelles yet* is the one place that
disappears when nothing is known. For a site whose purpose is collecting exactly that, an absent
section is a missed invitation — and silence is indistinguishable from a tool that has not
finished loading, which is precisely how it read on his phone.

So the empty case now renders the same `<details>`, shut, saying what is true and where to start.
It costs one line in a panel and it makes the walkthrough's step true for every cell.

IT SAYS "LOOKING" WHILE IT IS LOOKING. PANEL_ORGAN_BUSY is already set while the outlines are
being read, and the full branch below uses it. Without that distinction a cell WITH organelles
would read "nothing recorded" for as long as the fetch took, which is a worse lie than the one
this is fixing.

EVERY TOOL THAT LOADS core/panel.js GETS THIS — µJump, δJump, πJump, ηJump, λJump, βJump, χJump.
That is the right scope: the reasoning is about the panel, not about one dataset.

Check: panelcheck below (this file's own), and tourcheck.js for the step that depends on it.
Run: python3 src/an_empty_organelle_section_still_says_so.py, then python3 src/build_stamps.py
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PANEL = os.path.join(HERE, "core", "panel.js")

OLD = u'''  if (!anns.length && !trs.length){ host.innerHTML = ""; return; }
'''

NEW = u'''  /* ── NOTHING RECORDED IS STILL SOMETHING TO SAY ──────────────────────────────  2026-10-23
     This used to be `host.innerHTML = ""; return;` -- a cell with no annotation and no tracing
     got no Organelles section at all, which is most cells. Søren found it from the other end:
     the organelle walkthrough's step waits for #cellOrganDetails and sat there for ever on a
     random pyramidal neuron, saying "Waiting for you to show a cell" with the cell on screen.

     An absent section cannot be told apart from a panel that has not finished loading, and it
     withholds the one line that might make somebody log the first organelle on that cell. So the
     empty case renders the same shut <details>, says what is true, and says where to begin. */
  if (!anns.length && !trs.length){
    var busy = (typeof PANEL_ORGAN_BUSY !== "undefined" && PANEL_ORGAN_BUSY);
    host.innerHTML = '<details id="cellOrganDetails">'
      + '<summary style="cursor:pointer;font-size:12px;text-transform:uppercase;'
      + 'letter-spacing:.06em;color:var(--mut);font-weight:600">Organelles \\u2014 '
      + (busy ? 'looking\\u2026' : 'nothing recorded on this cell yet') + '</summary>'
      + '<p class="hint" style="margin-top:4px">'
      + (busy
         ? 'Reading what has been outlined on this cell\\u2026'
         : 'No structure has been logged as a point or outlined on this cell. '
           + '<b>Log one \\u2192</b> on the guided identification\\u2019s result screen adds the '
           + 'first; the tracing card below outlines one. A logged point says <b>where</b>, an '
           + 'outline says <b>what shape</b>, and a point inside an outline is the same organelle '
           + 'recorded both ways.')
      + '</p></details>';
    return;
  }
'''


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


edit(PANEL, [(u"an empty Organelles section that still says so", OLD, NEW,
              u"nothing recorded on this cell yet")])

# ── ITS OWN CHECK ─────────────────────────────────────────────────────────────────────────────
s = io.open(PANEL, encoding="utf-8").read()
# NARROWLY, on the branch this file owns. Two other guards in panel.js end the same way and
# should: one for a different section, one for "core/organellelink.js is not loaded on this page",
# where there genuinely is nothing to say. The first version of this assertion caught both and
# called them the bug.
assert u'if (!anns.length && !trs.length){ host.innerHTML = ""; return; }' not in s, \
    "the silent-empty organelle branch is back"
assert s.count(u'id="cellOrganDetails"') == 2, \
    "expected the section in both branches, found %d" % s.count(u'id="cellOrganDetails"')
assert u"PANEL_ORGAN_BUSY" in s
# The summary has to read as a section header in both branches, so the walkthrough's step can
# point at one element whatever the cell has on it.
for want in (u"Organelles \\u2014 ", u"nothing recorded on this cell yet", u"looking\\u2026"):
    assert want in s, want
print("  ok: #cellOrganDetails is rendered for every cell, busy or empty or full")
print("\nNow: python3 src/build_stamps.py, then node tourcheck.js")
