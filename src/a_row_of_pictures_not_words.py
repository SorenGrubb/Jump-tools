# -*- coding: utf-8 -*-
"""A row of pictures, not words.                                                    2026-10-11

Søren: *"We need to simplify the buttons also to make it more compact. Instead of Blender script,
use the Blender logo, instead of 3D model use a symbol for a 3D model... The file should also be a
button. The Remove button should also be a symbol. Figure out a way to say remove all."*

He picked from a sheet: pen for the pad, Neuroglancer's own four panes, a cube for the 3D model,
the official Blender mark, the Drive triangle for the file, and a bin for Remove.

EVERY ONE KEEPS ITS WORDS. core/mesh3d.js already says why about its own corner buttons: "an icon
is a rebus and a rebus is not a label". So each button carries title= AND aria-label=, and the
tooltip now LEADS with the action — "3D model — Every tracing of this cell as ONE 3D model..." —
rather than opening mid-sentence as it used to.

AND REMOVE KEEPS A NUMBER. Søren: *"Figure out a way to say remove all. You can use text if it is
not clear without it."* One tracing is a bare bin; a whole cell is a bin and the count, "all 6",
because a naked bin that silently takes six outlines away is exactly the button that should not be
a rebus, and the number is the thing worth reading BEFORE pressing. Both are muted rather than
green and go red only on hover: taking work away must not look like going to look at it.

THE BLENDER MARK IS BLENDER'S. It is used here to refer to Blender, which is what their trademark
guidelines are for, and it is their artwork rather than my redrawing of it — Søren supplied the
file. Carried as a 59x48 PNG data URI (768 bytes) so the card stays one file that works offline,
and because a logo is the one glyph that must not be recoloured by currentColor.

DONE AS A TRANSFORM, NOT AS THIRTEEN ANCHORS. Thirteen hand-copied button literals across two
lists is thirteen chances to mistype one, and the failure would be a button that silently kept its
word. The table below says class, label and glyph; the code does the same thing to each and then
COUNTS: thirteen converted, none left carrying a text label, every one with both a title and an
aria-label.

Changes: core/tracingcard.js  (the glyphs, the two button styles, thirteen buttons, the file link)
Check:   tracingiconcheck.js  (new)
Run: python3 src/a_row_of_pictures_not_words.py
     python3 src/build_stamps.py
     node tracingiconcheck.js
"""
import io, os, re
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(HERE, "core/tracingcard.js")

BLENDER_URI = io.open(os.path.join(HERE, "src/blender_mark_datauri.txt"),
                      encoding="utf-8").read().strip()

# ── the glyphs, one definition each ───────────────────────────────────────────────────────────
SVG = (u'<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false" '
       u'fill="none" stroke="currentColor" stroke-width="@W@" stroke-linecap="round" '
       u'stroke-linejoin="round" style="display:block;pointer-events:none">@D@</svg>')


def svg(d, w="1.6"):
    return SVG.replace(u"@D@", d).replace(u"@W@", w)


ICONS = u'''/* ── THE GLYPHS, ONE DEFINITION EACH ────────────────────────────────  2026-10-11
   Søren: *"We need to simplify the buttons also to make it more compact."* He chose these from a
   sheet: a pen for the pad, Neuroglancer's own four panes, a cube for the 3D model, the Blender
   mark, the Drive triangle for the file, a bin for Remove.

   ONE PLACE, because the kept list and the dataset list offer the same actions and a second
   drawing of the same action is a second thing to keep in step. Inline SVG rather than a font or
   a sprite sheet: this card is served as one file and has to work with nothing fetched.

   THE WORDS DO NOT GO AWAY. They move to title= and aria-label= — core/mesh3d.js says it about
   its own corner buttons, and it is just as true here: an icon is a rebus, and a rebus is not a
   label.

   THE BLENDER MARK is Blender's own artwork, used to refer to Blender, which is what their
   trademark guidelines are for. It is a PNG data URI rather than an SVG because it is a logo:
   it must not take currentColor, and it must not be my redrawing of somebody's trademark. */
var TRACING_ICON = {
  pad:   '@PAD@',
  ngl:   '@NGL@',
  glb:   '@GLB@',
  py:    '<img src="@BLENDER@" alt="" aria-hidden="true" width="20" height="16" '
       + 'style="display:block;pointer-events:none;object-fit:contain">',
  file:  '@FILE@',
  zip:   '@ZIP@',
  ruler: '@RULER@',
  bin:   '@BIN@'
};
/* An icon button is square-ish; a text one is not. Kept beside TRACING_BTN rather than replacing
   it, because the card still has buttons that say words and should. */
const TRACING_ICOBTN = 'style="padding:3px 7px;font-size:12px;flex:0 0 auto;display:inline-flex;'
  + 'align-items:center;gap:5px;line-height:1"';
'''.replace(u"@PAD@", svg(u'<path d="M3 17l1.2-4L13 4.2a1.8 1.8 0 0 1 2.6 2.6L6.9 15.8 3 17Z"/>'
                          u'<path d="M11.4 5.8 14.2 8.6"/>'))\
   .replace(u"@NGL@", svg(u'<rect x="2.5" y="2.5" width="15" height="15" rx="2"/>'
                          u'<path d="M10 2.5v15M2.5 10h15"/>'))\
   .replace(u"@GLB@", svg(u'<path d="M10 2.2 17 6v8l-7 3.8L3 14V6l7-3.8Z"/>'
                          u'<path d="M3.4 6.2 10 9.8l6.6-3.6M10 9.8v7.8"/>'))\
   .replace(u"@FILE@", svg(u'<path d="M7.6 2.6h4.8l5 8.4-2.4 4.2H5l-2.4-4.2 5-8.4Z"/>'
                           u'<path d="m7.6 2.6 5 8.4M17.4 11h-9.8M5 15.2l4.9-8.4" opacity=".55"/>'))\
   .replace(u"@ZIP@", svg(u'<path d="M10 2.6v9.2M6.4 8.6 10 12.2l3.6-3.6"/>'
                          u'<path d="M3 13.4v2.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-2.2"/>'))\
   .replace(u"@RULER@", svg(u'<rect x="1.6" y="6.4" width="16.8" height="7.2" rx="1.4" '
                            u'transform="rotate(-20 10 10)"/>'
                            u'<path d="M6.2 7.4v2.1M9 6.4v3M11.8 5.4v2.1M14.6 4.4v3"/>'))\
   .replace(u"@BIN@", svg(u'<path d="M3.6 5.6h12.8M8 5.6V3.9h4v1.7"/>'
                          u'<path d="M5.2 5.6l.8 10.2a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4'
                          u'l.8-10.2"/><path d="M8.6 8.8v5M11.4 8.8v5"/>'))\
   .replace(u"@BLENDER@", BLENDER_URI)

# class, the words, which glyph
BUTTONS = [
    ("tracingcellpad",    u"Open all in the pad", "pad"),
    ("tracingcellngl",    u"Neuroglancer",        "ngl"),
    ("tracingcellglb",    u"3D model",            "glb"),
    ("tracingcellpy",     u"Blender script",      "py"),
    ("tracingcellzip",    u"Download zip",        "zip"),
    ("tracedmeasurecell", u"Measure this cell",   "ruler"),
    ("tracingopen",       u"Open it in the pad",  "pad"),
    ("tracingngl",        u"Neuroglancer",        "ngl"),
    ("tracingglb",        u"3D model",            "glb"),
    ("tracingpy",         u"Blender script",      "py"),
    ("tracingcelldrop",   u"Remove all",          "bin"),
    ("tracingview",       u"Neuroglancer",        "ngl"),
    ("tracingdrop",       u"Remove",              "bin"),
]
# For the one button that never had a tooltip: it has one now, because it is a picture.
# The two that never had a tooltip get one, because a picture without words is a riddle.
TIP = {"tracingopen": u"opens this tracing on the pad, as the next version of it.",
       "tracingdrop": u"takes this tracing off this page. What is already in the dataset "
                      u"stays there."}
DANGER = ("tracingdrop", "tracingcelldrop")

s = io.open(P, encoding="utf-8").read()

if u"var TRACING_ICON = {" in s:
    print("core/tracingcard.js\n  already there: the glyphs")
else:
    anchor = u"const TRACING_BTN = "
    assert s.count(anchor) == 1, "TRACING_BTN"
    s = s.replace(anchor, ICONS + anchor, 1)
    print("core/tracingcard.js\n  ok: the glyphs and the icon button style")

done, already = 0, 0
# POSITIONS GO STALE. `s` is rewritten after every button, so a list of match offsets taken once
# per class is wrong from the second match on -- and the second match is a real one: Neuroglancer
# appears on both lists. Found by the counter below reporting one button "already a glyph" that
# was nothing of the kind. So each pass re-searches the CURRENT string for the first one that
# still says a word.
for cls, label, key in BUTTONS:
    while True:
        m = None
        for cand in re.finditer(r"'<button class=\"idbtn " + cls + r"\b", s):
            lit = s[cand.start(): s.index(u"</button>", cand.start()) + len(u"</button>")]
            if u"TRACING_ICON." not in lit: m = cand; break
            already += 1
        if m is None: break
        i = m.start()
        # two of the thirteen close with </button></div>', so the tag is the terminator
        j = s.index(u"</button>", i) + len(u"</button>")
        old = s[i:j]
        assert s.count(old) == 1, cls + ": that literal is not unique"
        ico = u"TRACING_ICON." + key
        # Remove all keeps a number: a bin that takes six things away is not a rebus you guess at.
        inner = ((ico + u" + '<b style=\"font-weight:600;font-size:12px\">all ' "
                  u"+ g.items.length + '</b>")
                 if cls == "tracingcelldrop" else ico + u" + '")
        k = old.rindex(label + u"</button>")
        pre = old[:k]
        if pre.endswith(u"'"):
            new = pre[:-1] + inner + u"</button>"
        else:
            assert pre.endswith(u">"), cls + ": unexpected shape"
            new = pre + u"' + " + inner + u"</button>"
        new = new.replace(u"TRACING_BTN", u"TRACING_ICOBTN")
        new = new.replace(u'style="padding:2px 9px;font-size:12px"', u"' + TRACING_ICOBTN + '")
        new = new.replace(u'class="idbtn ' + cls + u'"',
                          u'class="idbtn ' + cls + u'" aria-label="' + label + u'"', 1)
        if u'title="' in new:
            new = new.replace(u'title="', u'title="' + label + u' \\u2014 ', 1)
        else:
            # No tooltip at all, which was fine for a button that said its own name.
            new = new.replace(u'aria-label="' + label + u'"',
                              u'aria-label="' + label + u'" title="' + label + u' \\u2014 '
                              + TIP[cls] + u'"', 1)
        if cls in DANGER:
            new = new.replace(u'class="idbtn ' + cls + u'"',
                              u'class="idbtn tracingdanger ' + cls + u'"', 1)
        assert u'title="' + label in new, cls + ": lost its tooltip"
        assert u'aria-label="' + label in new, cls + ": lost its label"
        assert u"TRACING_BTN" not in new and u"padding:2px 9px" not in new, cls + ": still text-sized"
        s = s.replace(old, new, 1)
        done += 1

# ── the file link becomes a button too ───────────────────────────────────────────────────────
# Søren: *"The file should also be a button."* It stays an <a>, because it opens a Drive URL in a
# new tab and that is what an <a> is for; it is only dressed as one and given the same glyph
# treatment as its neighbours.
OLD_FILE = (u"""(t.fileUrl ? ' <a href="' + escHtml(t.fileUrl) + '" target="_blank" rel="noopener" '
                    + 'style="font-size:12px;opacity:.7" title="The tracing’s own file in Drive">file</a>' : "")""")
NEW_FILE = (u"""(t.fileUrl ? ' <a class="idbtn" href="' + escHtml(t.fileUrl) + '" target="_blank" '
                    + 'rel="noopener" aria-label="The file in Drive" ' + TRACING_ICOBTN
                    + ' title="The file in Drive \\u2014 this tracing’s own file, as it was saved.">'
                    + TRACING_ICON.file + '</a>' : "")""")
if NEW_FILE in s:
    print("  already there: the file is a button")
elif OLD_FILE in s:
    assert s.count(OLD_FILE) == 1
    s = s.replace(OLD_FILE, NEW_FILE, 1)
    print("  ok: the file is a button")
else:
    raise AssertionError("the file link is not where this expected it")

# ── and taking work away does not look like going to look at it ──────────────────────────────
STYLE = u'''/* ── A DESTRUCTIVE BUTTON SHOULD NOT BE GREEN ───────────────────────  2026-10-11
   Remove and Remove all are the only buttons on this card that take work away, and as icons they
   would otherwise be the same green pill as Neuroglancer, one place along. Muted by default, red
   only under the pointer. Injected once, guarded on its own id, because this module is loaded by
   eight pages it cannot edit. */
function tracingIconStyle(){
  if (document.getElementById("tracingIconStyle")) return;
  var el = document.createElement("style");
  el.id = "tracingIconStyle";
  el.textContent = ".idbtn.tracingdanger{background:transparent;color:var(--mut,#8b96a8);"
    + "border-color:var(--line,#2a3550)}"
    + ".idbtn.tracingdanger:hover,.idbtn.tracingdanger:focus-visible{color:#ff8d85;"
    + "border-color:#7a3a38;background:rgba(255,120,110,.10)}";
  document.head.appendChild(el);
}
'''
if u"function tracingIconStyle(){" in s:
    print("  already there: the destructive style")
else:
    a = u"const TRACING_ICOBTN = "
    assert s.count(a) == 1
    s = s.replace(a, STYLE + a, 1)
    print("  ok: the destructive style")
for call in [u"function tracingRenderList(){\n  const host=document.getElementById(\"tracingList\");",
             u"function tracingRenderShared(){"]:
    assert s.count(call) == 1, "render entry point: " + call[:40]
    if call + u"\n  tracingIconStyle();" not in s:
        s = s.replace(call, call + u"\n  tracingIconStyle();", 1)

io.open(P, "w", encoding="utf-8").write(s)
print("  ok: %d button(s) converted" % done)

# ── COUNTED, because a transform that half-ran is worse than one that did not ────────────────
_c = io.open(P, encoding="utf-8").read()
assert _c.count(u"var TRACING_ICON = {") == 1
assert _c.count(u"const TRACING_ICOBTN = ") == 1
assert _c.count(u"function tracingIconStyle(){") == 1
assert _c.count(u"tracingIconStyle();") == 2, "both lists must inject the style (%d)" % (
    _c.count(u"tracingIconStyle();"))
for cls, label, key in BUTTONS:
    for m in re.finditer(r"'<button class=\"idbtn " + cls + r"\b", _c):
        i = m.start(); j = _c.index(u"</button>", i) + len(u"</button>")
        lit = _c[i:j]
        assert u"TRACING_ICON." + key in lit, cls + " kept its words"
        assert u'aria-label="' + label in lit, cls + " has no aria-label"
        assert u'title="' + label in lit, cls + " does not lead with its name"
assert u">file</a>" not in _c, "the file link is still a word"
print("done 1")

# ── the check travels with the change ───────────────────────────────────────
# tracingiconcheck.js is written by hand rather than generated: it is a reader of the result, not
# a producer of it, and generating a check from the same table that produced the code would make
# the two agree about a mistake. Asserted present so the pair cannot be separated.
assert os.path.exists(os.path.join(HERE, "tracingiconcheck.js")), \
    "tracingiconcheck.js is missing — the change and its check travel together"
print("done 2")
print("all applied")
