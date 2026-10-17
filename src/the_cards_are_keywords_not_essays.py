# -*- coding: utf-8 -*-
u"""The front page loses its explanatory prose; the keywords carry it.            2026-10-17

Søren, pointing at µJump's card paragraph and then at four more blocks in turn: *"Remove this"*,
*"Also remove this explanation from all tools, but make sure the keywords cover it"*, *"This can
also be removed"*, *"And this"*, *"Also this"*.

Five pieces of prose go:

  the scale note above the cards      (in src/the_menu_is_a_row_of_buttons.py, with the menu)
  the eight card descriptions         up to 230 words each, above a row of chips saying the same
  "One account across all eight tools…"
  "Points pooled across every tool…"
  "The seven tools first, then the 61 volumes…"

THE CONDITION HE SET IS THE WHOLE JOB: *make sure the keywords cover it*. Each description was
read against its own chips and anything the chips did not already carry became a chip. What was
missing was almost always the dataset's NAME and its one distinguishing fact — a card that says
"Mouse visual cortex, 1.7 × 1.4 × 0.5 mm" and never says "minnie65" has lost the word a reader
would search for. So: µJump gains `MICrONS minnie65` and `16 cell classes`; δJump gains
`Allen V1DD` and `Neurons only — glia unnamed`, which is the reason its 159,378 unclassified
nuclei are not a backlog but a gap in the classifier; λJump gains `Depth from the traced pia`;
and so on. Three of the five removed blocks were also quietly stale — "the seven tools",
"the 61 volumes", "the most heavily annotated of the seven" — which is what a page of hand-written
prose about a growing roster does.

ωJUMP'S CARD IS THE ONE WITH A CHECK ATTACHED. wjcardcheck.js reads that card's claims back out
of the live registry: 62 volumes, six species, 23 tissues, the four publishers and their counts,
the box grid, the share of it in the largest three. It is the check that caught the Eyewire II
row when it landed. Deleting the prose would have left it asserting against nothing, so the
claims move into chips and the check moves with them — the same facts, now read from
`20 OpenOrganelle · 28 WEBKNOSSOS · 13 BossDB · 1 Eyewire II` rather than from "twenty Janelia
OpenOrganelle FIB-SEM blocks, twenty-eight served through WEBKNOSSOS…". Its spelled-out WORD[n]
table goes with the prose that needed it.

One assertion could not move. "The prose repeats the total (…, N of them)" existed because the
sentence and the chip had once disagreed about the box count; with one statement left there is
nothing to disagree with, so it becomes "the card states the box total exactly once", which is
the property that now matters.

Checks: wjcardcheck.js (updated here), frontnavcheck.js, volboxcheck.js
Run: python3 src/the_cards_are_keywords_not_essays.py, then python3 src/build_stamps.py,
     then node wjcardcheck.js
"""
import io
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(HERE, "index.html")
WJC = os.path.join(HERE, "..", "wjump-build", "wjcardcheck.js")

# ── what each card gains, read against what its description said ──────────────────────────────
# Only facts the chips did NOT already carry. Sizes, voxel sizes, nucleus counts and the
# classified/unclassified split were all chipped already; the names and the one-line "why this
# dataset is different" were not.
ADD = {
    "ujump": [u"MICrONS minnie65", u"16 cell classes"],
    "djump": [u"Allen Institute V1DD", u"Pia to white matter",
              u"Neurons only &mdash; glia unnamed"],
    "pjump": [u"MICrONS pinky100", u"Proofread soma-to-soma graph"],
    "ljump": [u"Lee16 serial-section TEM", u"Depth from the traced pia"],
    "hjump": [u"H01 &mdash; Lichtman lab &amp; Google", u"Pia to white matter",
              u"Oligodendrocytes the largest class"],
    "xjump": [u"cb2 &mdash; one cell, many fragments"],
    "bjump": [u"vCLEM &mdash; fluorescence on EM", u"No machine prediction"],
}

# ωJump's chips are replaced outright: they now carry every claim wjcardcheck.js reads, in the
# entity spellings it matches on (&ndash;, &nbsp;, &micro;). Edit these and that check fails,
# which is the point of writing them here rather than in prose.
WJUMP_CHIPS = [
    u"Mouse, human, macaque, zebrafish, zebra finch, rat",
    u"62 volumes &middot; 6 species &middot; 23 tissues",
    u"20 OpenOrganelle &middot; 28 WEBKNOSSOS &middot; 13 BossDB &middot; 1 Eyewire II",
    # NO PUBLICATION COUNT. A chip saying "17 publications" would be read as covering all
    # 62 volumes; 17 is the number of distinct DOIs among the 28 WEBKNOSSOS rows, which is
    # wjcardcheck.js's own figure and not a fact about the roster. The card has never
    # claimed one, and that check is written to pass when it does not.
    u"4&ndash;8&nbsp;nm isotropic FIB-SEM",
    u"Serial-section 4&ndash;16&nbsp;nm in plane, 25&ndash;50&nbsp;nm thick",
    u"Developmental series, P6 to P523",
    u"No nucleus table &mdash; you build it",
    u"0 classified",
    u"40&nbsp;&micro;m boxes, 16,298 to cover",
    u"Largest three hold three fifths of the grid",
    u"Free-text cell names",
    u"Community mapping",
    u"Terms shown per dataset",
]


def card_span(s, tool):
    """The one <a class="feature…" href="/<tool>.html"> … </a> block, by index."""
    m = re.search(r'<a class="feature[^"]*" href="/%s\.html">' % tool, s)
    assert m, tool + ": no card"
    end = s.index("\n  </a>", m.start())
    return m.start(), end


def strip_desc(s, tool):
    a, b = card_span(s, tool)
    block = s[a:b]
    found = re.findall(r'\n    <p class="desc">.*?</p>', block, re.S)
    if not found:
        return s, False
    assert len(found) == 1, tool + ": %d descriptions" % len(found)
    return s[:a] + block.replace(found[0], "", 1) + s[b:], True


def set_chips(s, tool, chips=None, add=None):
    a, b = card_span(s, tool)
    block = s[a:b]
    m = re.search(r'    <div class="chips">\n(.*?)\n    </div>\n', block, re.S)
    assert m, tool + ": no chips"
    have = re.findall(r'<span class="chip">(.*?)</span>', m.group(1), re.S)
    want = list(chips) if chips is not None else (
        [u" ".join(h.split()) for h in have] + [c for c in (add or [])
                                                if c not in [u" ".join(h.split()) for h in have]])
    if [u" ".join(h.split()) for h in have] == want:
        return s, False
    body = u"\n".join(u'      <span class="chip">%s</span>' % c for c in want)
    out = block[:m.start()] + u'    <div class="chips">\n' + body + u"\n    </div>\n" \
        + block[m.end():]
    return s[:a] + out + s[b:], True


def drop(s, pattern, name, flags=re.S):
    found = re.findall(pattern, s, flags)
    if not found:
        print("  already there: " + name)
        return s
    assert len(found) == 1, "%s: %d" % (name, len(found))
    print("  ok: " + name)
    return s.replace(found[0], "", 1)


src = io.open(IDX, encoding="utf-8").read()
before = src
print("index.html")

for tool in ["ujump", "djump", "pjump", "ljump", "hjump", "xjump", "bjump", "wjump"]:
    src, did = strip_desc(src, tool)
    print(("  ok: " if did else "  already there: ") + tool + " loses its description")
    if tool == "wjump":
        src, did = set_chips(src, tool, chips=WJUMP_CHIPS)
    else:
        src, did = set_chips(src, tool, add=ADD[tool])
    print(("  ok: " if did else "  already there: ") + tool + "'s keywords cover it")

# ── the three standalone paragraphs ───────────────────────────────────────────────────────────
src = drop(src, r'\n  <!-- Stated once here rather than repeated on every card.*?\n  </p>\n',
           "the one-account note goes")
# The whole <p>, not only its text: a paragraph stripped of its words leaves an empty one behind,
# which is a gap above the leaderboard and an element no stylesheet accounts for. Written to
# match whether the text is still in it or not, and anchored on the leaderboard that follows.
src = drop(src,
           r'    <p>\n(?:      Points pooled across every tool\..*?</p>\n)?'
           r'(?=    <div class="lb")',
           "the leaderboard's scoring note goes")
src = drop(src, r'<!-- Directly after the eight cards, which is where Søren asked for it and also '
                r'where the sentence\n     above stops being a promise and starts being a '
                r'demonstration\. -->\n',
           "...and the comment that pointed at it")
src = re.sub(r'\n{3,}(?=</div>\n\n<section id="leaderboard")', "\n", src)
src = drop(src, r'    <p class="lede2">The seven tools first.*?</p>\n',
           "the dataset tables' intro goes")
src = drop(src, r'    <p class="lede2">One tool, \d+ volumes.*?</p>\n',
           "the ωJump table's intro goes")
src = drop(src, r'    <p class="dsfoot">Sizes are the <b>imaged</b> extent.*?</p>\n',
           "the note under the tables goes")
# .desc styled only those eight paragraphs.
src = drop(src, r'\n  \.desc\{[^}]*\}', "and the rule that styled them")

# ── THE CHIPS INHERIT THE JOB THE PARAGRAPH WAS DOING ─────────────────────────────────────────
# `.feature .desc` carried `max-width:64ch`, and from 820 px up that was the only thing keeping
# the card's text out of the scale figure in its corner. With the paragraph gone the chips ran
# full width and the last one on the first row landed underneath "1.2 × 10⁹ µm³". Measured: the
# figure's left edge sits 594 px into a 752 px content box on ωJump's card (the widest of the
# eight, because it stacks five boxes), so 180 px of clearance leaves fourteen to spare.
CHIPCSS = u"""  .chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 22px}
  @media(min-width:820px){
    /* Clear of the corner figure, which is absolutely positioned from this width up. */
    .feature .chips{max-width:calc(100% - 180px)}
  }"""
OLDCHIPCSS = u"  .chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 22px}"
if CHIPCSS in src:
    print("  already there: the chips clear the corner figure")
else:
    assert src.count(OLDCHIPCSS) == 1
    src = src.replace(OLDCHIPCSS, CHIPCSS, 1)
    print("  ok: the chips clear the corner figure")

if src != before:
    io.open(IDX, "w", encoding="utf-8").write(src)

# ── the check follows the claims out of the prose and into the chips ──────────────────────────
js = io.open(WJC, encoding="utf-8").read()
js_before = js
print("\nwjcardcheck.js")
PAIRS = [
    (u"the counts are read as digits, because chips are written as digits",
     u'''chk("species count matches", says(WORD[species.size]+" species"),''',
     u'''/* DIGITS, NOT WORDS, SINCE 2026-10-17. These claims lived in a paragraph, where "six
   species" is how you write it; they live in chips now, where "6 species" is. The numbers are
   still the config's -- only the spelling of the expectation changed. */
chk("species count matches", says(String(species.size)+" species"),'''),
    (u"...OpenOrganelle",
     u'''says(WORD[jrc]+" Janelia OpenOrganelle"), "jrc="+jrc);''',
     u'''says(String(jrc)+" OpenOrganelle"), "jrc="+jrc);'''),
    (u"...WEBKNOSSOS",
     u'''says(WORD[wk]+" served through"), "wk="+wk);''',
     u'''says(String(wk)+" WEBKNOSSOS"), "wk="+wk);'''),
    (u"...BossDB",
     u'''says(WORD[bd]+" from <em>BossDB</em>"), "bd="+bd);''',
     u'''says(String(bd)+" BossDB"), "bd="+bd);'''),
    (u"...Eyewire II",
     u'''says(WORD[ew]+" from the <em>Eyewire II</em> consortium"), "ew2="+ew);''',
     u'''says(String(ew)+" Eyewire II"), "ew2="+ew);'''),
    (u"...and the publications",
     u'''  !/ publications/.test(flat) || says("from "+WORD[pubs.size]+" publications"),''',
     u'''  !/ publications/.test(flat) || says(String(pubs.size)+" publications"),'''),
]
for name, old, new in PAIRS:
    if new in js:
        print("  already there: " + name)
        continue
    n = js.count(old)
    assert n == 1, "%s: %d" % (name, n)
    js = js.replace(old, new, 1)
    print("  ok: " + name)

OLD_OF_THEM = u'''chk("the prose's box count is the grid's too",'''
if OLD_OF_THEM in js:
    i = js.index(OLD_OF_THEM)
    j = js.index("\n", js.index(");", i))
    js = js[:i] + (
        u'''/* ONE STATEMENT, SO NOTHING TO DISAGREE WITH. This read the prose's "…, N of them"
   against the chip, because the two had once said 11,707 and 13,031. The prose went on
   2026-10-17 and the chip is now the only place the total appears, so the property worth
   holding is that it appears once -- a second copy anywhere is the old bug coming back. */
const totalSaid = (card.match(new RegExp(total.toLocaleString("en-US").replace(",", ","), "g"))||[]).length;
chk("the card states the box total exactly once", totalSaid === 1, totalSaid + " occurrence(s)");'''
    ) + js[j:]
    print("  ok: the box total is stated once, not repeated")
else:
    print("  already there: the box total is stated once, not repeated")

if js != js_before:
    io.open(WJC, "w", encoding="utf-8").write(js)

# ── and the table check loses the lede it was reading ─────────────────────────────────────────
# wjtablecheck.js (2026-10-17) held three typed numbers to the rows present: the heading, the
# lede and the group counts. The lede is gone, so two of its assertions have nothing to read.
# The heading still carries the count, which is the one that caught the missing row, and the
# four sources are now chips on the ωJump card where wjcardcheck.js holds them to the registry.
# Both assertions are rewritten rather than deleted, so the file still says what is being relied
# on and where it moved to.
WJT = os.path.join(HERE, "..", "wjump-build", "wjtablecheck.js")
jt = io.open(WJT, encoding="utf-8").read()
jt_before = jt
print("\nwjtablecheck.js")
T_PAIRS = [
    (u"the lede is gone, so the heading is the count",
     u'''const lede = (table.match(/One tool, (\\d+) volumes/) || [])[1];
ok("...and so does the lede", Number(lede) === rows.length,
   "lede says " + lede + ", " + rows.length + " rows");''',
     u'''/* THE LEDE WENT ON 2026-10-17 (Søren: "And this"), and with it a second typed number. The
   heading above the table is now the only one a person writes, which is also the one that
   failed when Eyewire II's row was missing -- so nothing this check was for has been lost. */
ok("...and nothing else in the table restates a volume count",
   !/One tool, \\d+ volumes/.test(table), "no lede to disagree with the heading");'''),
    (u"...and the sources are claimed on the card, not here",
     u'''const unnamed = SRC.filter(([re, name]) => rows.some(r => re.test(r.id)) && !table.includes(name))
                   .map(([, name]) => name);
ok("the lede names every source in the table", unnamed.length === 0,
   unnamed.length ? unnamed.join(", ") + " has rows but is not named" : "all named");''',
     u'''/* The four publishers were named in the lede; they are chips on the ωJump card now, where
   wjcardcheck.js holds each one's COUNT to the registry rather than merely its name. Checking
   for the names here as well would be a second, weaker copy of that. What is still worth
   asserting is that no prefix has appeared that neither check knows about. */
const unknown = [...new Set(rows.filter(r => !SRC.some(([re]) => re.test(r.id)))
                                .map(r => r.id.split(/[-_]/)[0]))];
ok("every row belongs to a source the card accounts for", unknown.length === 0,
   unknown.length ? unknown.join(", ") + " is a prefix nothing names" : SRC.length + " sources");'''),
]
for name, old, new in T_PAIRS:
    if new in jt:
        print("  already there: " + name)
        continue
    n = jt.count(old)
    assert n == 1, "%s: %d" % (name, n)
    jt = jt.replace(old, new, 1)
    print("  ok: " + name)
if jt != jt_before:
    io.open(WJT, "w", encoding="utf-8").write(jt)

print("\nNow: python3 src/build_stamps.py, then node wjcardcheck.js and node wjtablecheck.js")
