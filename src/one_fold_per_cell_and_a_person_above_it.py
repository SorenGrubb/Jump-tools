# -*- coding: utf-8 -*-
r"""One fold per cell, and a person above it.                                        2026-10-11

Søren: *"It is getting too much with all these tracings. Let's collapse them. For the tracings in
the dataset, let's also collapse them but also organise them under users."* Asked how, he chose
**person, then cell**, and a collapsed header that carries **counts and people**.

THE STATE LIVES OUTSIDE THE LIST. Both lists are rebuilt from scratch on nearly every action, and
the "Dataset coordinates" tick was written with its state in the list's own innerHTML -- so it could
not be unticked, because the list was rebuilt twice per press. A fold is the same shape of thing
with more of it. TRACING_OPEN is a module object keyed by WHAT the group is (`p:Hesham Mohamed`,
`p:Hesham Mohamed|c:402334,232283,479`, `k:c:402334,232283,479`) and not by where it sits, so
adding a tracing does not shuffle what is open.

CLOSED TO BEGIN WITH, except a level with one group: a fold with nothing beside it hides and offers
no choice. That is the whole rule, and `tracingFoldOpen(key, lone)` is the whole of it.

A SQUARE OF A CELL IS STILL THE WHOLE CELL. Under a person, a cell shows only that person's
outlines -- but the cell's own buttons act on all of it, because there is one cell and "3D model of
this cell" cannot mean two things. So the header says "3 of 4 tracings" rather than "3", and names
who else has worked on it. A header that said "3" over a button that downloads 4 would be a lie
about the thing you are about to open.

A TRACING WITH TWO CONTRIBUTORS IS FILED UNDER BOTH. That is what "organise them under users" is
for -- finding your own work, including the parts of it you added to somebody else's tracing. It
makes the per-person counts sum to more than the total, so the list says so once, in a sentence, and
the number is never left to look like a mistake.

AND A BUTTON IN A SUMMARY IS STILL A BUTTON. Six of them per cell header, all inside the thing you
click to fold. The summary's click handler cancels the fold when the press landed on a control --
and the fold buttons go OUTSIDE the <label>, because a <button> inside a <label> activates that
label's control, and this label already contains the "Dataset coordinates" checkbox.

Changes: core/tracingcard.js
Check:   tracingfoldcheck.js (new)
Run: python3 src/one_fold_per_cell_and_a_person_above_it.py
     node tracingfoldcheck.js
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


# ── the folding machinery ────────────────────────────────────────────────────────────────────
FOLD = r"""/* ── OPEN AND SHUT, KEPT OUTSIDE THE LIST ───────────────────────────  2026-10-11
   Søren: *"It is getting too much with all these tracings. Let's collapse them."*

   Keyed by WHAT the group is, never by where it sits. Both lists are rebuilt on nearly every
   action, so a fold whose open-ness lived in the list's own markup would shut under him -- which is
   exactly how the "Dataset coordinates" tick became un-untickable, two days ago, in this file.

   A key not in here has never been pressed, and `lone` decides what that means: closed, unless
   there is only one group at that level, where folding hides and offers no choice. */
var TRACING_OPEN = {};
var TRACING_FOLD_KEYS = { kept: [], shared: [] };
function tracingFoldOpen(key, lone){
  return (key in TRACING_OPEN) ? !!TRACING_OPEN[key] : !!lone;
}
function tracingFoldMark(){ return '<span class="foldmark" aria-hidden="true">▸</span>'; }
/* `kind` is "cell" or "person" -- what the fold is, not how deep it is drawn. A cell fold is top
   level in the kept list and nested in the dataset list; one name for the two of them is what lets
   a check ask for "the cell folds" and get the same answer on either. */
function tracingFoldAttrs(key, kind, lone){
  /* THE KIND IT WAS GIVEN, not a two-way test. This read `kind === "cell" ? "cell" : "person"`,
     so the day a third kind arrived \u2014 the cell type, 2026-10-12 \u2014 every type fold came
     out labelled "person" and every selector that asked for one found nothing. 2026-10-12. */
  var k = (kind === "cell" || kind === "type") ? kind : "person";
  return 'class="tracingfold tracing' + k + '" data-fold="'
    + escHtml(key) + '" data-foldkind="' + k + '"'
    + (tracingFoldOpen(key, lone) ? " open" : "");
}
function tracingFoldAllHtml(which){
  return '<button type="button" class="idbtn tracingfoldall tracingfoldopen" data-which="'
    + which + '" style="padding:1px 8px;font-size:11px;flex:0 0 auto" '
    + 'title="Open every group in this list.">open all</button>'
    + '<button type="button" class="idbtn tracingfoldall tracingfoldshut" data-which="'
    + which + '" style="padding:1px 8px;font-size:11px;flex:0 0 auto" '
    + 'title="Close every group in this list.">close all</button>';
}
function tracingFoldWire(host){
  [].slice.call(host.querySelectorAll("details.tracingfold")).forEach(function(d){
    d.addEventListener("toggle", function(){ TRACING_OPEN[d.dataset.fold] = !!d.open; });
    var s = d.querySelector("summary");
    /* A BUTTON IN A SUMMARY IS STILL A BUTTON. Six per cell header. A press that opened
       Neuroglancer and collapsed the row on the way out would be a bug nobody reports clearly. */
    if (s) s.addEventListener("click", function(e){
      var t = e.target;
      if (t && t.closest && t.closest("button,a,input,select,textarea")) e.preventDefault();
    });
  });
  [].slice.call(host.querySelectorAll(".tracingfoldall")).forEach(function(b){
    b.addEventListener("click", function(e){
      e.preventDefault();
      var which = b.dataset.which, on = /tracingfoldopen/.test(b.className);
      (TRACING_FOLD_KEYS[which] || []).forEach(function(k){ TRACING_OPEN[k] = on; });
      if (which === "kept") tracingRenderList(); else tracingRenderShared();
    });
  });
}
/* ── WHO DREW IT ────────────────────────────────────────────────────  2026-10-11
   contributors is the real answer -- everyone who has added a version, in the order they first did.
   tracedBy is the one-name fallback for rows written before that column existed, and it holds a
   comma-joined list on some of them, so it is split the same way it was joined. */
var TRACING_NOBODY = "(not named)";
function tracingWhoList(t){
  var a = (t && t.contributors && t.contributors.length)
          ? t.contributors.slice()
          : String((t && t.tracedBy) || "").split(/\s*,\s*/);
  var out = [], seen = {};
  a.forEach(function(s){
    s = String(s || "").trim();
    if (!s || seen[s.toLowerCase()]) return;
    seen[s.toLowerCase()] = 1; out.push(s);
  });
  return out.length ? out : [TRACING_NOBODY];
}
/* Everyone on a cell, in the order they first appear. */
function tracingCellPeople(group){
  var out = [], seen = {};
  ((group && group.items) || []).forEach(function(x){
    tracingWhoList(x.t).forEach(function(w){
      if (seen[w.toLowerCase()]) return; seen[w.toLowerCase()] = 1; out.push(w);
    });
  });
  return out;
}
/* The signed-in handle, if this page carries the gamify chip at all -- eight pages load this module
   and not all of them do. Only used to float one group to the top and mark it; a handle that
   matches nobody changes nothing. */
function tracingMeName(){
  try {
    if (typeof MYSTATS === "undefined" || !MYSTATS) return "";
    return String(MYSTATS.handle || MYSTATS.name || "").trim();
  } catch (_e){ return ""; }
}
/* ── PERSON, THEN CELL ──────────────────────────────────────────────  2026-10-11
   Takes the cell groups tracingGroupByCell() already made and turns them inside out, so the top
   level is people and each person carries the cells they have worked in with only their own
   outlines in them -- plus `total`, the cell's full count, because the cell's buttons act on all
   of it and the header has to be able to say so.

   A tracing with two contributors is filed under BOTH: that is what grouping by person is for.
   The per-person counts therefore sum to more than the list holds, which the list says out loud
   rather than leaving to look like an error. */
function tracingGroupByPerson(groups){
  var by = {}, order = [];
  (groups || []).forEach(function(g){
    (g.items || []).forEach(function(x){
      tracingWhoList(x.t).forEach(function(who){
        var pk = "p:" + who;
        if (!by[pk]){ by[pk] = { who: who, key: pk, n: 0, cells: {}, order: [] };
                      order.push(pk); }
        var p = by[pk];
        if (!p.cells[g.key]){
          p.cells[g.key] = { key: g.key, nuc: g.nuc, root: g.root, coord: g.coord,
                             gi: g.gi, total: (g.items || []).length, group: g, items: [] };
          p.order.push(g.key);
        }
        p.cells[g.key].items.push(x);
        p.n++;
      });
    });
  });
  var me = tracingMeName().toLowerCase();
  var rank = function(w){
    if (w === TRACING_NOBODY) return 2;            /* nobody's pile goes last */
    return (me && w.toLowerCase() === me) ? 0 : 1;
  };
  var out = order.map(function(pk){
    var p = by[pk];
    return { who: p.who, key: pk, n: p.n, me: rank(p.who) === 0,
             cells: p.order.map(function(ck){ return p.cells[ck]; }) };
  });
  /* You first if this page knows who you are, then whoever has done the most: a list ordered by
     nothing is a list you have to search. */
  out.sort(function(a, b){
    var ra = rank(a.who), rb = rank(b.who);
    if (ra !== rb) return ra - rb;
    if (a.n !== b.n) return b.n - a.n;
    return a.who.localeCompare(b.who);
  });
  return out;
}
"""

edit("core/tracingcard.js", [
    (u"the folding machinery, above the first list that uses it",
     u"""function tracingRenderList(){
  const host=document.getElementById("tracingList");""",
     FOLD + u"""function tracingRenderList(){
  const host=document.getElementById("tracingList");"""),

    # ── the style, beside the icon style it is injected with ────────────────────────────────
    (u"the fold's own style, in the one block this card injects",
     u"""  el.textContent = ".idbtn.tracingdanger{background:transparent;color:var(--mut,#8b96a8);\"""",
     u"""  el.textContent = "details.tracingfold>summary{cursor:pointer;list-style:none;display:flex;"
    + "align-items:center;gap:8px;font-size:12px;flex-wrap:wrap}"
    + "details.tracingfold>summary::-webkit-details-marker{display:none}"
    + "details.tracingfold>summary::marker{content:\\"\\"}"
    + ".foldmark{display:inline-block;flex:0 0 auto;opacity:.6;font-size:10px;"
    + "transition:transform .12s ease}"
    + "details.tracingfold[open]>summary .foldmark{transform:rotate(90deg)}"
    + "details.tracingperson{border-top:1px solid var(--line);padding:7px 0 3px}"
    + "details.tracingcell{border-top:1px solid var(--line);padding:6px 0 2px}"
    + "details.tracingperson>details.tracingcell{border-top:0;border-left:2px solid var(--line);"
    + "margin:3px 0 3px 5px;padding:4px 0 2px 10px}"
    + ".idbtn.tracingdanger{background:transparent;color:var(--mut,#8b96a8);\""""),

    # ── tracingCellHead learns the cell's full count ────────────────────────────────────────
    (u"tracingCellHead can say “3 of 4”",
     u"""function tracingCellHead(nuc, root, type, n, coord){""",
     u"""/* `total`, when given and larger than `n`, is the cell's FULL count: under a person this header
   sits over buttons that act on the whole cell, and "3 tracings" above a button that downloads 4
   would be a lie about the thing you are about to open. */
function tracingCellHead(nuc, root, type, n, coord, total){"""),
    (u"...and prints it",
     u"""    + ' <span style="opacity:.6">&middot; ' + n + " tracing" + (n === 1 ? "" : "s") + "</span></span>";""",
     u"""    + ' <span style="opacity:.6">&middot; '
    + ((total && total !== n) ? (n + " of " + total + " tracings")
                             : (n + " tracing" + (n === 1 ? "" : "s")))
    + "</span></span>";"""),
])

# ── the kept list becomes folds ──────────────────────────────────────────────────────────────
KEPT_OLD = u"""  host.innerHTML='<label>Kept tracings, by cell &mdash; these go into the 3D export</label>'
    +groups.map(function(g,gi){
      const type=(g.items.filter(function(x){return x.t.type&&x.t.type!=="traced";})[0]||{t:{}}).t.type||"";
      return '<div '+TRACING_CELL_BOX+' data-g="'+gi+'">'
        +'<div '+TRACING_CELL_ROW+'>'+tracingCellHead(g.nuc,g.root,type,g.items.length,g.coord)"""
KEPT_NEW = u"""  TRACING_FOLD_KEYS.kept = [];
  const lone = groups.length === 1;
  host.innerHTML='<label id="tracingListLabel">Kept tracings, by cell &mdash; these go into the 3D '
    +'export</label>'
    /* OUTSIDE the label. A <button> inside a <label> activates that label's control, and the
       dataset list's label carries the "Dataset coordinates" checkbox -- so "open all" there would
       have silently toggled it. Both lists keep the buttons out, so the two read the same. */
    +'<div class="row" style="gap:6px;margin:0 0 6px;align-items:center">'
    +tracingFoldAllHtml("kept")+'</div>'
    +groups.map(function(g,gi){
      const type=(g.items.filter(function(x){return x.t.type&&x.t.type!=="traced";})[0]||{t:{}}).t.type||"";
      const fk='k:'+(g.key||"nocell");
      TRACING_FOLD_KEYS.kept.push(fk);
      return '<details '+tracingFoldAttrs(fk,"cell",lone)+' data-g="'+gi+'">'
        +'<summary>'+tracingFoldMark()+tracingCellHead(g.nuc,g.root,type,g.items.length,g.coord)"""
assert KEPT_OLD != KEPT_NEW

edit("core/tracingcard.js", [
    (u"the kept list's cells become folds", KEPT_OLD, KEPT_NEW),
    (u"...and the head row becomes the summary",
     u"""        +TRACING_ICON.bin + '<b style="font-weight:600;font-size:12px">all ' + g.items.length + '</b></button></div>'
        +g.items.map(function(x){""",
     u"""        +TRACING_ICON.bin + '<b style="font-weight:600;font-size:12px">all ' + g.items.length + '</b></button></summary>'
        +g.items.map(function(x){"""),
    (u"...and the box closes as a details",
     u"""            +TRACING_ICON.bin + '</button></div>';
        }).join("")
        +'</div>';
    }).join("");
  host.querySelectorAll(".tracingview").forEach(function(b){""",
     u"""            +TRACING_ICON.bin + '</button></div>';
        }).join("")
        +'</details>';
    }).join("");
  tracingFoldWire(host);
  host.querySelectorAll(".tracingview").forEach(function(b){"""),
])

# ── the dataset list becomes person → cell ───────────────────────────────────────────────────
SHARED_OLD = u"""  host.innerHTML = splitBox
    + '<label>In the dataset, by cell — open one to add to it or correct it'
    + tracingPlaceTickHtml() + '</label>'
    + groups.map(function(g, gi){
        const type = (g.items.filter(function(x){ return x.t.cellType; })[0] || { t: {} }).t.cellType || "";
        return '<div ' + TRACING_CELL_BOX + ' data-g="' + gi + '">'
          + '<div ' + TRACING_CELL_ROW + '>' + tracingCellHead(g.nuc, g.root, type, g.items.length, g.coord)
          + '<button class="idbtn tracingcellpad" aria-label="Open all in the pad" data-g="' + gi + '" '"""
SHARED_NEW = u"""  groups.forEach(function(g, i){ g.gi = i; });
  const people = tracingGroupByPerson(groups);
  const loneP = people.length === 1;
  TRACING_FOLD_KEYS.shared = [];
  host.innerHTML = splitBox
    + '<label id="tracingSharedLabel">In the dataset, by person and cell — open one to add to it '
    + 'or correct it' + tracingPlaceTickHtml() + '</label>'
    + '<div class="row" style="gap:6px;margin:0 0 6px;align-items:center;flex-wrap:wrap">'
    + tracingFoldAllHtml("shared")
    + '<span class="hint" id="tracingSharedNote" style="margin:0;flex:1 1 220px">A tracing several '
    + 'people have worked on appears under each of them, so these counts add up to more than the '
    + 'list holds.</span></div>'
    + people.map(function(pp){
        TRACING_FOLD_KEYS.shared.push(pp.key);
        const loneC = pp.cells.length === 1;
        return '<details ' + tracingFoldAttrs(pp.key, "person", loneP) + '>'
          + '<summary>' + tracingFoldMark()
          + '<span style="flex:1 1 180px;min-width:0"><b>' + escHtml(pp.who) + '</b>'
          + (pp.me ? ' <span style="opacity:.6">(you)</span>' : "")
          + '</span><span style="opacity:.6;flex:0 0 auto">' + pp.n + ' tracing'
          + (pp.n === 1 ? "" : "s") + ' in ' + pp.cells.length + ' cell'
          + (pp.cells.length === 1 ? "" : "s") + '</span></summary>'
          + pp.cells.map(function(c){
        const gi = c.gi;
        const fk = pp.key + "|" + c.key;
        TRACING_FOLD_KEYS.shared.push(fk);
        const type = (c.group.items.filter(function(x){ return x.t.cellType; })[0] || { t: {} }).t.cellType || "";
        const others = tracingCellPeople(c.group).filter(function(w){ return w !== pp.who; });
        return '<details ' + tracingFoldAttrs(fk, "cell", loneC) + ' data-g="' + gi + '">'
          + '<summary>' + tracingFoldMark()
          + tracingCellHead(c.nuc, c.root, type, c.items.length, c.coord, c.total)
          + (others.length ? '<span style="opacity:.6;flex:0 0 auto" title="Everyone else who has '
              + 'worked on this cell. The buttons here act on all of it.">with '
              + escHtml(others.join(", ")) + '</span>' : "")
          + '<button class="idbtn tracingcellpad" aria-label="Open all in the pad" data-g="' + gi + '" '"""
assert SHARED_OLD != SHARED_NEW

SHARED_TAIL_OLD = u"""          + '</div>'
          + g.items.map(function(x){
              const t = x.t;
              const who = (t.contributors && t.contributors.length) ? t.contributors.join(", ")
                                                                    : (t.tracedBy || "");
              return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 18px;'"""
SHARED_TAIL_NEW = u"""          + '</summary>'
          + c.items.map(function(x){
              const t = x.t;
              /* Under a person's own heading, their own name on every row is noise. What is worth
                 saying is who ELSE is on this one tracing. */
              const who = tracingWhoList(t).filter(function(w){ return w !== pp.who; }).join(", ");
              return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 18px;'"""

SHARED_END_OLD = u"""                    + TRACING_ICON.file + '</a>' : "")
                + '</div>';
            }).join("")
          + '</div>';
      }).join("");
  [].slice.call(host.querySelectorAll(".tracingopen")).forEach(function(b){"""
SHARED_END_NEW = u"""                    + TRACING_ICON.file + '</a>' : "")
                + '</div>';
            }).join("")
          + '</details>';
          }).join("")
          + '</details>';
      }).join("");
  tracingFoldWire(host);
  [].slice.call(host.querySelectorAll(".tracingopen")).forEach(function(b){"""

edit("core/tracingcard.js", [
    (u"the dataset list is filed under people", SHARED_OLD, SHARED_NEW),
    (u"...the cell head row becomes the summary", SHARED_TAIL_OLD, SHARED_TAIL_NEW),
    (u"...and both folds close", SHARED_END_OLD, SHARED_END_NEW),
])

# ── and one more: the "who" title no longer describes what it shows ──────────────────────────
edit("core/tracingcard.js", [
    (u"the row's people column says what it now means",
     u"""                + '<span style="opacity:.7;flex:1 1 120px;min-width:0" title="Everyone who has added a '
                  + 'version of this tracing, in the order they first did.">' + escHtml(who)""",
     u"""                + '<span style="opacity:.7;flex:1 1 120px;min-width:0" title="Anyone ELSE who has '
                  + 'added a version of this tracing \\u2014 you are the heading it is under.">' + escHtml(who)"""),
])

# ── and the two constants the folds replaced ─────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the cell box and head row move into the injected CSS",
     u"""const TRACING_CELL_BOX = 'class="tracingcell" style="border-top:1px solid var(--line);padding:6px 0 2px"';
const TRACING_CELL_ROW = 'style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap"';""",
     u"""/* TRACING_CELL_BOX and TRACING_CELL_ROW were here until the lists folded. Both are now
   details.tracingcell and details.tracingfold>summary in tracingIconStyle(): a style that was
   pasted into two template strings is a style that gets changed in one of them. */"""),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_P = os.path.join(HERE, "core/tracingcard.js")
_s = io.open(_P, encoding="utf-8").read()
for _what, _n in [(u"var TRACING_OPEN = {};", 1),
                  (u"function tracingFoldOpen(key, lone){", 1),
                  (u"function tracingFoldAttrs(key, kind, lone){", 1),
                  (u"function tracingFoldWire(host){", 1),
                  (u"function tracingGroupByPerson(groups){", 1),
                  (u"function tracingWhoList(t){", 1),
                  (u"function tracingCellPeople(group){", 1),
                  (u"function tracingMeName(){", 1),
                  (u"tracingFoldAllHtml(\"kept\")", 1),
                  (u"tracingFoldAllHtml(\"shared\")", 1),
                  (u'id="tracingSharedNote"', 1),
                  (u"tracingFoldWire(host);", 2)]:
    assert _s.count(_what) == _n, "core/tracingcard.js has %d of %r, wanted %d" % (
        _s.count(_what), _what, _n)
# INSERT-THEN-EDIT: this file has grown a second copy of a block twice this week, each time because
# an edit inside an inserted block stopped the `if new in s` guard matching. Counted, not assumed.
for _what in [u"function tracingRenderList(){", u"function tracingRenderShared(){",
              u"function tracingCellHead(nuc, root, type, n, coord, total){"]:
    assert _s.count(_what) == 1, "%r appears %d times" % (_what, _s.count(_what))
# EVERY FOLD OPENED IS A FOLD CLOSED. Three <details> are written (one kept cell, one person, one
# shared cell) and three must be closed; a count that drifted would leave the dataset list nested
# inside itself, which renders as something plausible and wrong.
_o, _c = _s.count(u"'<details '"), _s.count(u"'</details>'")
assert _o == 3 and _c == 3, "%d details opened, %d closed" % (_o, _c)
print("done")

# ── and the check this supersedes ────────────────────────────────────────────────────────────
# tracinggroupcheck.js counted ".tracingcell" in the dataset list and wanted 3: cell A, cell B and
# the no-cell pile. Under person -> cell there are 4, because cell A appears under both of the
# people who have worked in it. SUPERSEDED, NOT LOOSENED: it now asserts the person level as well,
# names the person whose folds it then reads, and says why the total is 4 -- a check that had been
# relaxed to ">= 3" would have stopped noticing that the grouping works at all.
edit("tracinggroupcheck.js", [
    (u"what the dataset list is now grouped by, in the file's own summary",
     u"""     DATASET   one group per cell, and a group for tracings filed with no cell; the cell's""",
     u"""     DATASET   one group per PERSON (2026-10-11), and under each the cells they have worked in
               -- cell A under both S and T, because both have added a version of lys_a2, which is
               why four cell groups hold three cells; the cell's"""),

    (u"the dataset list is read through its person folds",
     u"""    const host = document.getElementById("tracingShared");
    const cells = [].slice.call(host.querySelectorAll(".tracingcell"));
    return { cells: cells.length, rows: cells.map(c => c.querySelectorAll(".tracingopen").length),""",
     u"""    const host = document.getElementById("tracingShared");
    const cells = [].slice.call(host.querySelectorAll(".tracingcell"));
    /* THROUGH THE PERSON, NOT BY INDEX. S has done the most so S sorts first today, but reading
       "the first fold" would turn a change in the ordering rule into a failure about grouping. */
    const mine = host.querySelector('details[data-fold="p:S"]');
    const myCells = mine ? [].slice.call(mine.querySelectorAll(".tracingcell")) : [];
    return { people: host.querySelectorAll('details[data-foldkind="person"]').length,
             myCells: myCells.length,
             myHeads: myCells.map(c => (c.querySelector(".tracingcellhead") || {}).textContent || ""),
             myRows: myCells.map(c => c.querySelectorAll(".tracingopen").length),
             cells: cells.length, rows: cells.map(c => c.querySelectorAll(".tracingopen").length),"""),

    (u"...and the counts it now expects",
     u"""  ok(ds.cells === (scope ? 2 : 3), "one group per cell" + (scope ? "" : ", and one for tracings with no cell"), ds.cells);
  const iA = ds.heads.findIndex(h => h.indexOf(nA.split(":").pop()) >= 0);
  ok(iA >= 0 && ds.rows[iA] === 3, "cell A holds its three tracings", JSON.stringify(ds.rows));""",
     u"""  ok(ds.people === 2, "one fold per person who has added a version \\u2014 S and T, and T only "
     + "because she worked on one of S's tracings", ds.people);
  ok(ds.myCells === (scope ? 2 : 3),
     "under a person, the cells THEY have worked in"
     + (scope ? "" : ", the no-cell pile among them"), ds.myCells);
  ok(ds.cells === (scope ? 3 : 4),
     "...so three cells make " + (scope ? 3 : 4) + " cell folds in all: cell A is under both of "
     + "them. The counts add to more than the list holds, which is what the list says out loud",
     ds.cells);
  const iA = ds.myHeads.findIndex(h => h.indexOf(nA.split(":").pop()) >= 0);
  ok(iA >= 0 && ds.myRows[iA] === 3, "cell A holds its three tracings", JSON.stringify(ds.myRows));"""),
])

# The three clicks that followed read the list by index. They now go through S's fold, or they would
# press cell A's twin under T -- one tracing, not three -- and report it as the pad losing two.
_G = os.path.join(HERE, "tracinggroupcheck.js")
_g = io.open(_G, encoding="utf-8").read()
_old = u'''document.querySelectorAll("#tracingShared .tracingcell")[iA]'''
_new = u'''document.querySelector('#tracingShared details[data-fold="p:S"]')
      .querySelectorAll(".tracingcell")[iA]'''
_n = _g.count(_old)
if _n:
    assert _n == 3, "wanted 3 index reads of the shared list, found %d" % _n
    _g = _g.replace(_old, _new)
    io.open(_G, "w", encoding="utf-8").write(_g)
    print("tracinggroupcheck.js\n  ok: three clicks go through S's fold")
else:
    print("tracinggroupcheck.js\n  already there: three clicks go through S's fold")
assert _g.count(_new) == 3, "%d of the new form" % _g.count(_new)
assert u'''.tracingcell")[iA].querySelector''' in _g
print("done 2")
print("all applied")
