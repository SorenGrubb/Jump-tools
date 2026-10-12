# -*- coding: utf-8 -*-
r"""A split outline is noticed, not looked for.                                     2026-10-12

Søren, of the two controls above the dataset list: *"Check outlines for split structures is so
specific for one case. Can we avoid that button by building in a guardrail?"*

THE BUTTON WAS A SCAN NOBODY WOULD RUN. It read every outline in the dataset -- dozens of Drive
reads -- to answer a question about outlines you are usually already looking at, and it answered in
a panel of its own, away from the rows, so the finding had to be carried back by hand.

The measurement moves to where the contours already are. Opening an outline, downloading a cell,
measuring a cell, saving your own work: every one of those has the rings in hand, and every one now
hands them to UJ.tracing.splitNote on the way past. Nothing extra is fetched. An outline whose
geometry has never been read is not claimed to be anything -- which is honest, and is also why
there is no spinner anywhere in this.

BOTH ANSWERS ARE REMEMBERED, not just the bad one. "No, this is one piece" has to be stored too, or
a row the tool has already cleared looks exactly like a row nobody has looked at.

AND IT MARKS, IT DOES NOT BLOCK. A primary cilium traced as base and tip IS two pieces; so is a
nucleus that really does sit in two lobes on these sections. His own dataset has the cilium. The
row says what was measured, offers the smaller piece's coordinate, and gets out of the way.

THE SCAN KEEPS ITS FUNCTION AND LOSES ITS BUTTON, which is what window.tracedMeasureAll already
does one card up: a thing done once a year is reached from the console, and a button for it is a
button pressed by mistake.

AND TWO DEAD COPIES GO WITH IT. tracingSplitRun and tracingCellHeadPlain were each in this file
TWICE -- the insert-then-edit trap, from a session before the count assertions went in. They were
byte-identical but for one escape, so the second definition quietly won and nobody could tell.

Changes: core/tracing.js, core/tracingcard.js, core/tracedoutlines.js
Check:   tracingguardcheck.js (new); splitcheck.js's UI section superseded
Run: python3 src/a_split_outline_is_noticed_not_looked_for.py
     node tracingguardcheck.js && node splitcheck.js
"""
import io, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(rel, pairs):
    P = os.path.join(HERE, rel)
    s = io.open(P, encoding="utf-8").read(); b = s
    print(rel)
    for name, old, new in pairs:
        if new in s:
            print("  already there: " + name); continue
        n = s.count(old)
        assert n == 1, "@NM@ (@F@): @N@".replace("@NM@", name).replace(
            "@F@", os.path.basename(P)).replace("@N@", str(n))
        s = s.replace(old, new, 1); print("  ok: " + name)
    if s != b: io.open(P, "w", encoding="utf-8").write(s)


# ── what the tool has measured, in the module that measures it ───────────────────────────────
MEMO = r'''  /* ── WHAT HAS ALREADY BEEN MEASURED ──────────────────────────────  2026-10-12
     Søren: *"Check outlines for split structures is so specific for one case. Can we avoid that
     button by building in a guardrail?"*

     splitOf() is cheap once the rings are in hand and impossible without them, so the answer is
     remembered per structure by whoever happened to read the geometry -- the pad on save, a cell
     download, a measurement, opening one outline. Nothing here fetches anything.

     BOTH ANSWERS ARE KEPT. An outline measured as ONE piece is stored as one, because "no" and
     "nobody has looked" have to be different: otherwise every row the tool has already cleared
     looks like a row it has not seen. splitKnown returns null for the second, never false.

     IT LIVES HERE because core/tracing.js is the module every page loads and the only one that
     owns splitOf -- the card and core/tracedoutlines.js both feed it, and neither has to know the
     other does. */
  var SPLIT_SEEN = {};
  function splitNote(sid, rings, resNm){
    sid = String(sid || "");
    if (!sid || !rings) return null;
    var s;
    try { s = splitOf(rings, resNm || null); } catch (_e){ return null; }
    SPLIT_SEEN[sid] = s;
    return s;
  }
  function splitKnown(sid){
    var s = SPLIT_SEEN[String(sid || "")];
    return s === undefined ? null : s;
  }
  function splitForget(sid){
    if (sid === undefined) SPLIT_SEEN = {}; else delete SPLIT_SEEN[String(sid)];
  }
  /* The structures measured as split, as one string: what a list uses to tell whether redrawing
     would show anything new. */
  function splitMarks(){
    return Object.keys(SPLIT_SEEN).filter(function(k){
      return SPLIT_SEEN[k] && SPLIT_SEEN[k].split; }).sort().join(" ");
  }
'''
edit("core/tracing.js", [
    (u"the memo, beside splitOf",
     u"  function splitOf(rings, resNm){",
     MEMO + u"  function splitOf(rings, resNm){"),
    (u"...and it is exported",
     u"           sameCellWhy: sameCellWhy, splitOf: splitOf,",
     u"""           sameCellWhy: sameCellWhy, splitOf: splitOf,
           splitNote: splitNote, splitKnown: splitKnown, splitForget: splitForget,
           splitMarks: splitMarks,"""),
])

# ── the card: learn on the way past, and say what is known ───────────────────────────────────
LEARN = r'''/* ── THE GUARDRAIL ──────────────────────────────────────────────────  2026-10-12
   Søren: *"Check outlines for split structures is so specific for one case. Can we avoid that
   button by building in a guardrail?"*

   Every path in this file that ends up holding an outline's rings calls this. It costs one pass
   over a few hundred contour centroids and no network at all. */
function tracingSplitRes(){
  return (window.UJ && UJ.cfg && UJ.cfg.res) || null;
}
function tracingSplitLearn(sid, rings){
  if (!(window.UJ && UJ.tracing && typeof UJ.tracing.splitNote === "function")) return null;
  var s = UJ.tracing.splitNote(sid, rings, tracingSplitRes());
  tracingSplitRefreshSoon();
  return s;
}
/* ── AND THE LIST REDRAWS WHEN, AND ONLY WHEN, IT WOULD LOOK DIFFERENT ──
   Learning happens in the middle of a download, and redrawing the list there would replace the
   button that is in the middle of saying "meshing…". So: debounced past the operation, and
   skipped entirely unless the set of SPLIT structures has changed -- which, splits being rare, is
   almost never. */
var TRACING_SPLIT_SHOWN = "", TRACING_SPLIT_TIMER = null;
function tracingSplitRefreshSoon(){
  if (!(window.UJ && UJ.tracing && typeof UJ.tracing.splitMarks === "function")) return;
  if (TRACING_SPLIT_TIMER) clearTimeout(TRACING_SPLIT_TIMER);
  TRACING_SPLIT_TIMER = setTimeout(function(){
    TRACING_SPLIT_TIMER = null;
    var now = UJ.tracing.splitMarks();
    if (now === TRACING_SPLIT_SHOWN) return;
    TRACING_SPLIT_SHOWN = now;
    try {
      if (document.getElementById("tracingShared") && TRACING_SHARED.length) tracingRenderShared();
    } catch (_e){}
  }, 1500);
}
/* One measurement, one sentence, wherever it is shown. */
function tracingSplitWords(s){
  if (!s || !s.split) return "";
  var um = function(nm){ return (Math.round(Number(nm) / 100) / 10) + " µm"; };
  return "In " + s.clusters.length + " pieces that do not touch: "
    + s.clusters.map(function(c){
        return c.contours + " contour" + (c.contours === 1 ? "" : "s") + " at " + c.centre.join(", ");
      }).join(" and ")
    + " — " + um(s.gapNm) + " apart, " + (Math.round(s.ratio * 10) / 10)
    + "× their own reach.";
}
/* THE MARKER, on the row and nowhere else. Only for what has actually been measured: a row with
   no marker means "one piece, or not read", and the two are the same thing to look at. */
function tracingSplitMarkHtml(sid){
  if (!(window.UJ && UJ.tracing && typeof UJ.tracing.splitKnown === "function")) return "";
  var s = UJ.tracing.splitKnown(sid);
  if (!s || !s.split) return "";
  var small = s.clusters.slice().sort(function(a, b){ return a.contours - b.contours; })[0];
  return '<button type="button" class="idbtn tracingdanger tracingsplitmark" data-at="'
    + escHtml(small ? small.centre.join(",") : "") + '" style="padding:1px 7px;font-size:11px;'
    + 'flex:0 0 auto" title="' + escHtml(tracingSplitWords(s)) + ' Nothing has been changed, and '
    + 'it may be right — a primary cilium traced as base and tip really is two pieces. Press '
    + 'this to put the smaller piece’s centre in the coordinate boxes.">⚠ '
    + s.clusters.length + ' pieces</button>';
}
function tracingSplitMarkWire(host){
  [].slice.call(host.querySelectorAll(".tracingsplitmark")).forEach(function(b){
    b.addEventListener("click", function(e){
      e.preventDefault(); e.stopPropagation();
      var p = String(b.dataset.at || "").split(",");
      ["tracingX", "tracingY", "tracingZ"].forEach(function(id, k){
        var el = document.getElementById(id);
        if (el && p[k] !== undefined) el.value = String(p[k]).trim();
      });
      tracingSay("Coordinate set to " + p.join(", ") + " — the smaller piece of that outline.");
    });
  });
}
/* What the save says about what was just saved. Appended to the card's own sentence rather than
   replacing it: this is a remark, not a refusal. */
function tracingSplitKeepSay(all){
  if (!(window.UJ && UJ.tracing && typeof UJ.tracing.splitKnown === "function")) return "";
  var bad = (all || []).map(function(t){
    return { t: t, s: UJ.tracing.splitKnown(t && t.id) };
  }).filter(function(x){ return x.s && x.s.split; });
  if (!bad.length) return "";
  return " ⚠ " + (bad.length === 1
      ? "“" + (bad[0].t.name || "that one") + "” is"
      : bad.length + " of them are")
    + " in more than one piece. " + tracingSplitWords(bad[0].s)
    + " That may be right — a cilium traced as base and tip is two pieces — so nothing "
    + "has been stopped; the row in the dataset list says so if you want to look.";
}
'''
edit("core/tracingcard.js", [
    (u"the guardrail, above the list that shows it",
     u"function tracingRenderList(){\n  const host=document.getElementById(\"tracingList\");",
     LEARN + u"function tracingRenderList(){\n  const host=document.getElementById(\"tracingList\");"),
])

# ── one sentence, one definition ─────────────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"tracingSplitSay goes through the one wording",
     u'''function tracingSplitSay(st, resNm){
  var s;
  try {
    s = UJ.tracing.splitOf((st && (st.rings || st)) || [],
                           resNm || (window.UJ && UJ.cfg && UJ.cfg.res) || null);
  } catch (_e){ return ""; }
  if (!s || !s.split) return "";
  var um = function(nm){ return (Math.round(Number(nm) / 100) / 10) + " \\u00b5m"; };
  return "In " + s.clusters.length + " pieces that do not touch: "
    + s.clusters.map(function(c){
        return c.contours + " contour" + (c.contours === 1 ? "" : "s") + " at " + c.centre.join(", ");
      }).join(" and ")
    + " \\u2014 " + um(s.gapNm) + " apart, " + (Math.round(s.ratio * 10) / 10)
    + "\\u00d7 their own reach.";
}''',
     u'''function tracingSplitSay(st, resNm){
  var s;
  try {
    s = UJ.tracing.splitOf((st && (st.rings || st)) || [],
                           resNm || (window.UJ && UJ.cfg && UJ.cfg.res) || null);
  } catch (_e){ return ""; }
  return tracingSplitWords(s);
}'''),
])

# ── learn wherever the rings arrive ──────────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"opening one outline measures it",
     u'''  if (!st || !st.rings.length) throw new Error("that tracing came back with no contours on it");
  return { t: t, st: st };''',
     u'''  if (!st || !st.rings.length) throw new Error("that tracing came back with no contours on it");
  tracingSplitLearn(sid, st.rings);
  return { t: t, st: st };'''),
    (u"...and so does reading a whole cell",
     u'''      return sids.map(function(s){
        const x = res[s] || { error: "not read" };
        return x.error ? { sid: s, error: x.error } : { sid: s, t: x.t, st: x.st };
      });''',
     u'''      return sids.map(function(s){
        const x = res[s] || { error: "not read" };
        if (!x.error && x.st && (x.st.rings || []).length) tracingSplitLearn(s, x.st.rings);
        return x.error ? { sid: s, error: x.error } : { sid: s, t: x.t, st: x.st };
      });'''),
    (u"...and saving your own work",
     u'''  tracingWrite(TRACINGS_KEPT);
  /* Committed: the contours are in the dataset now and the card is about nothing.''',
     u'''  tracingWrite(TRACINGS_KEPT);
  /* MEASURED AS IT IS SAVED. The one moment the contours are certainly in hand, and the one
     moment a split is still cheap to fix — it is on the pad in front of you. */
  all.forEach(function(t){ tracingSplitLearn(t.id, t.rings); });
  /* Committed: the contours are in the dataset now and the card is about nothing.'''),
    # THE WHOLE TERNARY IS ONE STRING and the remark is added to it, so a bracket goes in at the
    # front as well as at the back. tracingSay REPLACES the status line, so a second call would
    # delete the sentence this is a remark on -- which is why it is not two calls.
    (u"...and the save line is opened for a remark",
     u'''  tracingSay(sent+same===all.length''',
     u'''  tracingSay((sent+same===all.length'''),
    (u"...and the save says so",
     u'''     +(all.length===1?'its':'their')+' own.');''',
     u'''     +(all.length===1?'its':'their')+' own.')
    +tracingSplitKeepSay(all));'''),
])

# ── the row carries the marker ───────────────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the marker goes on the row, next to what it is about",
     u'''                + '<span style="opacity:.7;flex:0 0 auto">' + (t.contours || 0) + " contour"
                  + ((t.contours === 1) ? "" : "s") + " on " + (t.sections || 0) + " section"
                  + ((t.sections === 1) ? "" : "s") + '</span>\'''',
     u'''                + '<span style="opacity:.7;flex:0 0 auto">' + (t.contours || 0) + " contour"
                  + ((t.contours === 1) ? "" : "s") + " on " + (t.sections || 0) + " section"
                  + ((t.sections === 1) ? "" : "s") + '</span>'
                + tracingSplitMarkHtml(t.structureId)'''),
    (u"...and is wired with the rest of the list",
     u'''  tracingFoldWire(host);
  [].slice.call(host.querySelectorAll(".tracingopen")).forEach(function(b){''',
     u'''  tracingFoldWire(host);
  tracingSplitMarkWire(host);
  [].slice.call(host.querySelectorAll(".tracingopen")).forEach(function(b){'''),
])

# ── and the button goes ──────────────────────────────────────────────────────────────────────
_P = os.path.join(HERE, "core/tracingcard.js")
_s = io.open(_P, encoding="utf-8").read()
_b = _s

SPLITBOX = u'''  const splitBox = '<div style="border:1px solid var(--line);border-radius:7px;padding:8px 10px;'
    + 'margin:6px 0 10px 0">'
    + '<button class="idbtn" id="tracingSplitGo" ' + TRACING_BTN + ' title="Reads every outline\\u2019s '
    + 'contours and reports any whose contours sit in two places that do not touch \\u2014 one tracing '
    + 'holding two objects. Nothing is changed: this is a list of what to look at.">'
    + 'Check outlines for split structures</button>'
    + ' <label style="font-size:11px;color:var(--mut)"><input type="checkbox" id="tracingSplitMine" '
    + 'checked style="width:auto;vertical-align:-1px"> only ones I have drawn on</label>'
    + '<div class="hint" id="tracingSplitSayEl" style="margin-top:5px"></div>'
    + '<div id="tracingSplitOut"></div></div>';
'''
if SPLITBOX in _s:
    _s = _s.replace(SPLITBOX, u"", 1)
    _s = _s.replace(u"  host.innerHTML = splitBox\n    + '<label id=\"tracingSharedLabel\">",
                    u"  host.innerHTML = '<label id=\"tracingSharedLabel\">", 1)
    print("core/tracingcard.js\n  ok: the split box is gone from the list")
else:
    print("core/tracingcard.js\n  already there: the split box is gone from the list")

WIRE = u'''  {
    const go = host.querySelector("#tracingSplitGo");
    if (go) go.addEventListener("click", function(){ tracingSplitRun(go); });
  }
'''
if WIRE in _s:
    _s = _s.replace(WIRE, u"", 1); print("  ok: ...and so is its wiring")
else:
    print("  already there: ...and so is its wiring")

# TWO COPIES, BOTH DEAD. tracingSplitRun and tracingCellHeadPlain were each written into this file
# twice -- the insert-then-edit trap, before the count assertions. Byte-identical but for one
# escape, so the second definition won and nothing ever said so.
MARK = u"/* The button's half: ask, then write what came back."
END = u"/* window.tracedMeasureAll() has no button on purpose"
if MARK in _s:
    a, bb = _s.index(MARK), _s.index(END)
    n = _s[a:bb].count(MARK)
    assert n == 2, "expected two copies of tracingSplitRun, found %d" % n
    _s = _s[:a] + _s[bb:]
    print("  ok: both copies of tracingSplitRun and tracingCellHeadPlain removed")
else:
    print("  already there: both copies of tracingSplitRun removed")
if _s != _b: io.open(_P, "w", encoding="utf-8").write(_s)

# ── measuring a cell teaches it too ──────────────────────────────────────────────────────────
edit("core/tracedoutlines.js", [
    (u"measuring a cell measures its pieces as well",
     u'''  const out=[];
  mine.forEach(function(t){
    const one=tracedOneFrom(t,res[t.structureId]);
    if(one)out.push(one);
  });
  return {tracings:out,capped:capped};''',
     u'''  const out=[];
  /* ── AND THE SPLIT GUARDRAIL, FOR FREE ──────────────────────────────  2026-10-12
     These contours were just read for the measurement. splitOf over them costs one pass and no
     network, and "Measure this cell" is a button somebody presses on purpose after outlining
     something \\u2014 the moment a stray contour is most worth hearing about. */
  const splitRes=(window.UJ&&UJ.cfg&&UJ.cfg.res)||null;
  mine.forEach(function(t){
    const x=res[t.structureId];
    if(x&&x.st&&(x.st.rings||[]).length&&UJ.tracing&&UJ.tracing.splitNote)
      UJ.tracing.splitNote(t.structureId,x.st.rings,splitRes);
    const one=tracedOneFrom(t,res[t.structureId]);
    if(one)out.push(one);
  });
  return {tracings:out,capped:capped};'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_t = io.open(os.path.join(HERE, "core/tracing.js"), encoding="utf-8").read()
for _what in [u"function splitNote(sid, rings, resNm){", u"function splitKnown(sid){",
              u"function splitForget(sid){", u"function splitMarks(){",
              u"splitNote: splitNote, splitKnown: splitKnown, splitForget: splitForget,"]:
    assert _t.count(_what) == 1, "%d of %r in core/tracing.js" % (_t.count(_what), _what)
_s = io.open(_P, encoding="utf-8").read()
for _gone in [u"tracingSplitGo", u"tracingSplitMine", u"tracingSplitOut", u"tracingSplitSayEl",
              u"tracingSplitRun", u"tracingCellHeadPlain", u"splitBox"]:
    assert _gone not in _s, "%s survives in core/tracingcard.js" % _gone
for _what, _n in [(u"function tracingSplitLearn(sid, rings){", 1),
                  (u"function tracingSplitWords(s){", 1),
                  (u"function tracingSplitMarkHtml(sid){", 1),
                  (u"function tracingSplitKeepSay(all){", 1),
                  (u"tracingSplitLearn(", 4),
                  (u"tracingSplitMarkHtml(t.structureId)", 1),
                  (u"tracingSplitMarkWire(host);", 1)]:
    assert _s.count(_what) == _n, "%d of %r, wanted %d" % (_s.count(_what), _what, _n)
# ONE WORDING. tracingSplitWords is the only place the sentence is built; a second copy is how the
# row and the save line would start disagreeing about the same measurement.
assert _s.count(u"pieces that do not touch:") == 1, "the sentence is written twice"
print("done")

# ── and the check that looked for the button ─────────────────────────────────────────────────
# splitcheck.js owned the measurement and ended by asserting the dataset list had a button to run
# it. SUPERSEDED, NOT DELETED: it now asserts that the measurement is REMEMBERED and that the
# scan kept its function, which is the part of the old claim that is still true. Where the
# finding shows up is tracingguardcheck.js's subject, because that is the file that can press it.
_C = os.path.join(HERE, "splitcheck.js")
_c = io.open(_C, encoding="utf-8").read()
OLDUI = u'''  console.log("\\nand there is somewhere to read it");
  const ui = await p.evaluate(() => ({
    scan: typeof window.tracedSplitScan === "function",
    say: typeof window.tracingSplitSay === "function",
    btn: !!document.querySelector("#tracingSplitGo")
         || !!(typeof tracingRenderShared === "function" && (function(){
              const h = document.getElementById("tracingShared");
              if (!h) return false;
              TRACING_SHARED = [{ structureId: "a", name: "Nucleus", nucleusId: "1",
                                  contours: 4, sections: 2 }];
              tracingRenderShared();
              return !!document.querySelector("#tracingSplitGo");
            })())
  }));
  ok(ui.scan, "tracedSplitScan() walks every outline in the dataset and reports, nothing else",
     String(ui.scan));
  ok(ui.say, "tracingSplitSay() turns one structure's answer into one sentence, in one place",
     String(ui.say));
  ok(ui.btn, "...and the dataset list has the button that runs it", String(ui.btn));'''
NEWUI = u'''  /* \\u2500\\u2500 AND SOMEWHERE TO READ IT \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500  superseded 2026-10-12
     This used to end "...and the dataset list has the button that runs it". S\\u00f8ren: *"Check
     outlines for split structures is so specific for one case. Can we avoid that button by
     building in a guardrail?"* \\u2014 so the button is gone and the measurement happens wherever
     the contours are already in hand. What is still this file's business is that the measurement
     can be remembered and said in one sentence; WHERE it then shows up is
     tracingguardcheck.js's, because that is the file that can press it. */
  console.log("\\nand somewhere to keep it");
  const ui = await p.evaluate(() => ({
    scan: typeof window.tracedSplitScan === "function",
    say: typeof window.tracingSplitSay === "function",
    memo: ["splitNote", "splitKnown", "splitForget", "splitMarks"]
            .filter(n => !(window.UJ && UJ.tracing && typeof UJ.tracing[n] === "function")),
    gone: !document.querySelector("#tracingSplitGo")
  }));
  ok(ui.scan, "tracedSplitScan() walks every outline in the dataset and reports, nothing else \\u2014 "
     + "kept for the console, the way tracedMeasureAll is", String(ui.scan));
  ok(ui.say, "tracingSplitSay() turns one structure's answer into one sentence, in one place",
     String(ui.say));
  ok(ui.memo.length === 0,
     "...and the answer can be remembered per structure, so the paths that already hold the "
     + "contours can measure them for nothing", ui.memo.join(" ") || "all four");
  ok(ui.gone, "...and the button that read the whole dataset to ask is gone", String(ui.gone));'''
if NEWUI.split("\n")[-1] in _c:
    print("splitcheck.js\n  already there: the UI section is superseded")
else:
    assert _c.count(OLDUI) == 1, "anchor: %d" % _c.count(OLDUI)
    io.open(_C, "w", encoding="utf-8").write(_c.replace(OLDUI, NEWUI, 1))
    print("splitcheck.js\n  ok: the UI section is superseded")
_c = io.open(_C, encoding="utf-8").read()
assert u"tracingSplitGo" in _c, "splitcheck should still check the button is GONE"
assert _c.count(u'ok(ui.btn,') == 0
print("done 2")
print("all applied")
