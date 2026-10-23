# -*- coding: utf-8 -*-
u"""The tab bar says six short words.                                              2026-10-23

Søren: *"I think we should change the menu buttons to Jump, Filter, Discuss, Tutorial, Stats,
Refs. In that order and in these shorter forms."*

    before                                   after
    🔍 Jump                                  🔍 Jump
    📥 Filter and show                       📥 Filter
    📚 References                            💬 Discuss
    💬 Discussion                            ❓ Tutorial
    ❓ Tutorial                              📊 Stats
    📊 Statistics dashboard                  📚 Refs

Two changes at once: the labels lose everything after the first word, and **References moves to
the end**. Both are the same judgement — the tab bar is navigation, and navigation that wraps onto
two lines on a phone has stopped navigating. Refs goes last because it is the one tab you consult
rather than work in.

THE REGION IS REGENERATED, NOT PATCHED. Five pairs editing five button labels would be five
anchors to keep in step with whatever the labels say next, and this project has paid five times
over for a pair whose `new` text changed. So the whole `<div class="tabbar">…</div>` is replaced
by the canonical list below, every run.

IT PRESERVES A TUTORIAL BUTTON IT FINDS. That button belongs to
src/a_walkthrough_that_points_at_the_real_control.py, which sweeps and rewrites it anchored on the
Stats button. If this file simply dropped it, the two generators would have to be run in one fixed
order or the page would lose its Tutorial button. Instead it carries the button across and puts it
back in fourth place, so either order works and running one of them alone leaves a correct page.

WHAT ELSE HAD TO CHANGE. The walkthrough's own step text named the old labels -- "Filter and show"
eleven times, "References", "Statistics dashboard". A tutorial that calls a button something the
button does not say is the exact failure this family's walkthroughs exist to avoid, so that text
moved with the labels; see the generator above for the wording.

Check: tourcheck.js (the tab assertions and every step's `tab`), and tabbarcheck below.
Run: python3 src/the_tab_bar_says_six_short_words.py, then
     python3 src/a_walkthrough_that_points_at_the_real_control.py, then
     python3 src/build_stamps.py, then node tourcheck.js
"""
import io
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UJ = os.path.join(HERE, "ujump.html")

# The order is Søren's, and the titles are kept verbatim from the buttons they replace -- a label
# can be shortened without taking the explanation away from the reader who hovers it.
TABS = [
    (u'<button type="button" class="tabbtn active" data-tab="jump" role="tab" '
     u'aria-selected="true">\U0001f50d Jump</button>'),
    (u'<button type="button" class="tabbtn" data-tab="filter" role="tab" aria-selected="false" '
     u'title="Describe a population — by type, layer, size, place or organelle — and get '
     u'back every cell in the volume that matches, as a count, a sheet, or a 3D view.">'
     u'\U0001f4e5 Filter</button>'),
    (u'<button type="button" class="tabbtn" data-tab="forum" role="tab" aria-selected="false" '
     u'title="Findings, bugs and ideas. Coordinates and ids written into a post become links '
     u'— a reader opens exactly what you saw.">\U0001f4ac Discuss</button>'),
    (u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" '
     u'aria-selected="false" title="Live/static statistics dashboard built from this dataset + '
     u'the community-reporting backend — opens inline, no separate tab or re-login">'
     u'\U0001f4ca Stats</button>'),
    (u'<button type="button" class="tabbtn" data-tab="refs" role="tab" aria-selected="false" '
     u'title="Every paper the identification criteria rest on, with a link to each one.">'
     u'\U0001f4da Refs</button>'),
]
# Tutorial sits fourth, between Discuss and Stats.
TUTORIAL_AT = 3


def rebuild(path):
    s = io.open(path, encoding="utf-8").read()
    m = re.search(r'<div class="tabbar" id="mainTabs" role="tablist">[\s\S]*?\n</div>\n', s)
    assert m, "the tab bar is not where this generator expects it"
    old = m.group(0)

    # Carry a Tutorial button across rather than dropping it -- see the header.
    keep = re.search(r'<button type="button" class="tabbtn" data-tour-menu="[^"]*"[\s\S]*?</button>\n',
                     old)
    rows = list(TABS)
    if keep:
        rows.insert(TUTORIAL_AT, keep.group(0).rstrip("\n"))

    new = (u'<div class="tabbar" id="mainTabs" role="tablist">\n'
           + u"\n".join(rows) + u"\n</div>\n")
    if new == old:
        print("  already there: the tab bar reads Jump / Filter / Discuss / Stats / Refs")
        return False
    io.open(path, "w", encoding="utf-8").write(s[:m.start()] + new + s[m.end():])
    print("  ok: the tab bar rewritten — %d buttons%s"
          % (len(rows), ", Tutorial carried across" if keep else ", no Tutorial button to carry"))
    return True


print(os.path.basename(UJ) + u" — the tab bar")
rebuild(UJ)

# A SHORT CHECK OF ITS OWN, because tourcheck.js knows about tabs a step NAMES and nothing about
# what the bar reads or what order it is in. Both are the whole of what Søren asked for.
s = io.open(UJ, encoding="utf-8").read()
bar = re.search(r'<div class="tabbar" id="mainTabs" role="tablist">[\s\S]*?\n</div>\n', s).group(0)
labels = re.findall(r'>(?:[^<]*?)([A-Z][a-z]+)</button>', bar)
want = [u"Jump", u"Filter", u"Discuss", u"Tutorial", u"Stats", u"Refs"]
print("  reads: " + " / ".join(labels))
assert labels == want, "wanted %s, got %s" % (want, labels)
# Every label one word: the point of the change.
assert all(len(l.split()) == 1 for l in labels), labels
# And every tab a step can name still exists.
for t in ["jump", "filter", "forum", "dashboard", "refs"]:
    assert ('data-tab="%s"' % t) in bar, t
print("  ok: six buttons, one word each, in the order asked for")
print("\nNow: python3 src/a_walkthrough_that_points_at_the_real_control.py, "
      "then python3 src/build_stamps.py, then node tourcheck.js")
