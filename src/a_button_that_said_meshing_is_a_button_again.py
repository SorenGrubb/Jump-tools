# -*- coding: utf-8 -*-
r"""A button that said "meshing…" is a button again afterwards.                      2026-10-12

A regression from yesterday, and one nothing would have reported. Nine functions on this card show
progress the way they have for a year:

    var label = btn.textContent;            //  the words on the button
    btn.textContent = "meshing…";
    ...
    btn.textContent = label;                //  the words back

With words on the buttons that round-tripped exactly. Since src/a_row_of_pictures_not_words.py the
buttons are glyphs, and an <svg> HAS NO TEXT: `label` is the empty string, the assignment replaces
the SVG with a text node, and the restore sets the button to "". Eight glyphs in a row and the one
you pressed is a blank green pill, for the rest of the session. Nothing threw. Nothing was logged.

THE FIX IS THE SHAPE, NOT THE SITE. Every save and every restore moves to innerHTML, in one pass,
counted -- a fix applied to the one button that was noticed would leave eight waiting. The middle
line stays `textContent = "meshing…"`: writing text over a glyph is exactly right while it is busy,
now that what comes back is the markup.

The lesson is the one this project keeps relearning from the other end: the icons change did not
touch these nine functions, and that is why it broke them. A round trip through .textContent is a
claim that the button's content IS text -- unwritten, unchecked, and true for a year.

Changes: core/tracingcard.js
Check:   tracingiconbackcheck.js (new)
Run: python3 src/a_button_that_said_meshing_is_a_button_again.py
     node tracingiconbackcheck.js
"""
import io, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(HERE, "core/tracingcard.js")
s = io.open(P, encoding="utf-8").read()
b = s

# (what it is, the text, how many there must be).  Counted, because this is one bug in nine
# places and a transform that silently found eight of them is the bug again next week.
PAIRS = [
    (u"tracingArm saves the label it swaps for its question",
     u"const label = b.textContent;",
     u"const label = b.innerHTML;", 1),
    (u"...and puts the markup back",
     u'b.textContent = label; b.style.color = "";',
     u'b.innerHTML = label; b.style.color = "";', 1),
    (u"tracingMeasureRun saves",
     u"const was = btn.textContent, wasDis = btn.disabled;",
     u"const was = btn.innerHTML, wasDis = btn.disabled;", 1),
    (u"...and restores",
     u"btn.textContent = was; btn.disabled = wasDis;",
     u"btn.innerHTML = was; btn.disabled = wasDis;", 1),
    (u"the two “Reading…” buttons save",
     u'const was = btn ? btn.textContent : "";',
     u'const was = btn ? btn.innerHTML : "";', 2),
    (u"...and restore",
     u"if (btn){ btn.disabled = false; btn.textContent = was; }",
     u"if (btn){ btn.disabled = false; btn.innerHTML = was; }", 2),
    (u"the const-label buttons save",
     u'const label = btn ? btn.textContent : "";',
     u'const label = btn ? btn.innerHTML : "";', 4),
    (u"the var-label buttons save",
     u'var label = btn ? btn.textContent : "";',
     u'var label = btn ? btn.innerHTML : "";', 2),
    (u"...and all seven of them restore",
     u"if (btn){ btn.disabled = false; btn.textContent = label; }",
     u"if (btn){ btn.disabled = false; btn.innerHTML = label; }", 7),
]
print("core/tracingcard.js")
for name, old, new, n in PAIRS:
    if s.count(new) == n and old not in s:
        print("  already there: " + name); continue
    got = s.count(old)
    assert got == n, "%s: %d of %r, wanted %d" % (name, got, old, n)
    s = s.replace(old, new)
    print("  ok: %s (%d)" % (name, n))

# ── and the comment that says why, where the next person will read it ───────────────────────
NOTE = u'''/* ── A LABEL IS MARKUP, NOT TEXT ────────────────────────────────────  2026-10-12
   Every button on this card that reports progress saves its label, writes "meshing\\u2026" over it
   and puts the label back. It saved .textContent for a year, which round-tripped exactly while
   the buttons said words -- and erased them the day they became glyphs, because an <svg> has no
   text: the saved label was "", so the restore blanked the button for the rest of the session.

   .innerHTML on BOTH ends. Writing text over a glyph while it works is right; what comes back has
   to be what was there. Asserted in tracingiconbackcheck.js by pressing one of each kind. */
/* "Remove all" asks in the button itself: a browser dialog would stop the page. */'''
OLDNOTE = u'/* "Remove all" asks in the button itself: a browser dialog would stop the page. */'
if NOTE not in s:
    assert s.count(OLDNOTE) == 1, "anchor comment: %d" % s.count(OLDNOTE)
    s = s.replace(OLDNOTE, NOTE, 1)
    print("  ok: the note above tracingArm")
else:
    print("  already there: the note above tracingArm")

if s != b: io.open(P, "w", encoding="utf-8").write(s)

# ── guards ──────────────────────────────────────────────────────────────────────────────────
_s = io.open(P, encoding="utf-8").read()
# NOT ONE LEFT. A single surviving round trip is a single button that still blanks itself, and it
# would be found by a person rather than by this.
import re as _re
_left = [m.group(0).strip() for m in
         _re.finditer(r"^.*\.textContent\s*=\s*(label|was)\b.*$", _s, _re.M)]
assert not _left, "still restoring text: %r" % _left
# Buttons only: tracingNumberAll reads #tracingStatus's own .textContent to prepend a sentence to
# it, which is a status line and the right use of it. Matching "anything named was" caught that.
_saves = [m.group(0).strip() for m in
          _re.finditer(r"^.*(label|was)\s*=\s*(btn|b)(\s*\?\s*(btn|b))?\.textContent.*$", _s, _re.M)]
assert not _saves, "still saving a button's text: %r" % _saves
assert _s.count(u"btn.innerHTML = label") == 7, _s.count(u"btn.innerHTML = label")
assert _s.count(u"btn.innerHTML = was") == 3, _s.count(u"btn.innerHTML = was")
# ...while the busy line itself still writes TEXT, which is what it should do.
assert _s.count(u'btn.textContent = "meshing\\u2026"') == 3, "the busy lines changed"
print("done")
print("all applied")
