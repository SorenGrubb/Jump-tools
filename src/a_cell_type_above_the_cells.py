# -*- coding: utf-8 -*-
r"""A cell type above the cells.                                                    2026-10-12

Søren, of the kept list with twelve cells in it, nine of them arachnoid barrier cells:
*"There could be a further subdivision under cell type, also for the dataset tracings."*

Asked where it should sit in the dataset list, he chose **person → cell type → cell**: the top of
that list stays the short list of people, and each person's cells sort into types underneath. The
kept list has no person level, so it is simply **cell type → cell → tracings**.

AND THE CELL HEADING STOPS SAYING IT. `tracingCellHead` has led with the type since the day it was
written; under a heading that is the type, that is the same word twice on consecutive lines. The
callers pass "" and the function is unchanged — it already omits a type it is not given.

A TYPE IS COUNTED IN CELLS, not in tracings, because that is what it is a heading over; the
tracings follow after a dot, since "9 cells" alone leaves you guessing how much is under there.
Sorted by how many cells, then by name, with the untyped pile last — the same shape as the people
sort one level up, so the two levels do not need separate explanations.

THE TWO LISTS HAND IT DIFFERENT THINGS. The kept list's rows carry `type`, the dataset's carry
`cellType`, and one of them can be the literal "traced". tracingGroupByType takes a function and
knows about neither, so the two lists cannot drift into disagreeing about what a type is.

Changes: core/tracingcard.js
Check:   tracingfoldcheck.js (extended)
Run: python3 src/a_cell_type_above_the_cells.py
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


# ── the grouping itself, beside the other two ────────────────────────────────────────────────
BYTYPE = r'''/* ── AND A CELL TYPE ABOVE THE CELLS ────────────────────────────────  2026-10-12
   Søren, of a kept list with nine arachnoid barrier cells in a row: *"There could be a further
   subdivision under cell type, also for the dataset tracings."*

   Takes cells — whatever a cell is to the caller: a group from tracingGroupByCell, or a person's
   slice of one — and buckets them by a type the CALLER reads off them. The kept list's rows carry
   `type` and the dataset's carry `cellType`, and one of them can be the literal "traced"; a
   function that knew about either would be a second opinion about what a type is.

   Counted in cells, because that is what the heading is a heading over, with the tracings after
   a dot. Sorted by how many cells, then by name, untyped last — the same shape as the people sort
   one level up, so the two levels need one explanation between them. */
var TRACING_NOTYPE = "(no cell type)";
function tracingGroupByType(cells, typeOf){
  var by = {}, order = [];
  (cells || []).forEach(function(c){
    var ty = String((typeOf ? typeOf(c) : "") || "").trim() || TRACING_NOTYPE;
    if (!by[ty]){ by[ty] = { type: ty, key: "t:" + ty, cells: [], n: 0 }; order.push(ty); }
    by[ty].cells.push(c);
    by[ty].n += ((c.items || []).length) || 0;
  });
  var out = order.map(function(k){ return by[k]; });
  out.sort(function(a, b){
    var ra = (a.type === TRACING_NOTYPE) ? 1 : 0, rb = (b.type === TRACING_NOTYPE) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (a.cells.length !== b.cells.length) return b.cells.length - a.cells.length;
    return a.type.localeCompare(b.type);
  });
  return out;
}
function tracingTypeHead(ty){
  return '<span style="flex:1 1 180px;min-width:0"><b>' + escHtml(ty.type) + '</b></span>'
    + '<span style="opacity:.6;flex:0 0 auto">' + ty.cells.length + ' cell'
    + (ty.cells.length === 1 ? "" : "s") + ' · ' + ty.n + ' tracing'
    + (ty.n === 1 ? "" : "s") + '</span>';
}
'''
edit("core/tracingcard.js", [
    (u"tracingGroupByType, beside the grouping it sits between",
     u"function tracingRenderList(){\n  const host=document.getElementById(\"tracingList\");",
     BYTYPE + u"function tracingRenderList(){\n  const host=document.getElementById(\"tracingList\");"),
])

# ── the kept list: type → cell ───────────────────────────────────────────────────────────────
KEPT_OLD = u'''  TRACING_FOLD_KEYS.kept = [];
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
        +'<summary>'+tracingFoldMark()+tracingCellHead(g.nuc,g.root,type,g.items.length,g.coord)'''
KEPT_NEW = u'''  TRACING_FOLD_KEYS.kept = [];
  groups.forEach(function(g,i){ g.gi = i; });
  const keptTypes = tracingGroupByType(groups, function(g){
    /* "traced" is the placeholder a tracing carries before anybody says what the cell is, so it
       is not a type and must not become a heading. */
    return (g.items.filter(function(x){return x.t.type&&x.t.type!=="traced";})[0]||{t:{}}).t.type||"";
  });
  const loneKT = keptTypes.length === 1;
  host.innerHTML='<label id="tracingListLabel">Kept tracings, by cell type &mdash; these go into '
    +'the 3D export</label>'
    /* OUTSIDE the label. A <button> inside a <label> activates that label's control, and the
       dataset list's label carries the "Dataset coordinates" checkbox -- so "open all" there would
       have silently toggled it. Both lists keep the buttons out, so the two read the same. */
    +'<div class="row" style="gap:6px;margin:0 0 6px;align-items:center">'
    +tracingFoldAllHtml("kept")+'</div>'
    +keptTypes.map(function(ty){
      const tk='kt:'+ty.type;
      TRACING_FOLD_KEYS.kept.push(tk);
      const lone = ty.cells.length === 1;
      return '<details '+tracingFoldAttrs(tk,"type",loneKT)+'>'
        +'<summary>'+tracingFoldMark()+tracingTypeHead(ty)+'</summary>'
        +ty.cells.map(function(g){
      const gi=g.gi;
      const fk='k:'+(g.key||"nocell");
      TRACING_FOLD_KEYS.kept.push(fk);
      return '<details '+tracingFoldAttrs(fk,"cell",lone)+' data-g="'+gi+'">'
        /* The type is the heading above this one now, so the cell line stops repeating it. */
        +'<summary>'+tracingFoldMark()+tracingCellHead(g.nuc,g.root,"",g.items.length,g.coord)'''
edit("core/tracingcard.js", [(u"the kept list sorts its cells into types", KEPT_OLD, KEPT_NEW)])

edit("core/tracingcard.js", [
    (u"...and the type fold closes with the cells in it",
     u'''            +TRACING_ICON.bin + '</button></div>';
        }).join("")
        +'</details>';
    }).join("");
  tracingFoldWire(host);''',
     u'''            +TRACING_ICON.bin + '</button></div>';
        }).join("")
        +'</details>';
        }).join("")
        +'</details>';
    }).join("");
  tracingFoldWire(host);'''),
])

# ── the dataset list: person → type → cell ───────────────────────────────────────────────────
DS_OLD = u'''          + pp.cells.map(function(c){
        const gi = c.gi;
        const fk = pp.key + "|" + c.key;
        TRACING_FOLD_KEYS.shared.push(fk);
        const type = (c.group.items.filter(function(x){ return x.t.cellType; })[0] || { t: {} }).t.cellType || "";
        const others = tracingCellPeople(c.group).filter(function(w){ return w !== pp.who; });
        return '<details ' + tracingFoldAttrs(fk, "cell", loneC) + ' data-g="' + gi + '">'
          + '<summary>' + tracingFoldMark()
          + tracingCellHead(c.nuc, c.root, type, c.items.length, c.coord, c.total)'''
DS_NEW = u'''          + tracingGroupByType(pp.cells, function(c){
              return (c.group.items.filter(function(x){ return x.t.cellType; })[0]
                      || { t: {} }).t.cellType || "";
            }).map(function(ty){
        const tk = pp.key + "|t:" + ty.type;
        TRACING_FOLD_KEYS.shared.push(tk);
        const loneTC = ty.cells.length === 1;
        return '<details ' + tracingFoldAttrs(tk, "type", loneT) + '>'
          + '<summary>' + tracingFoldMark() + tracingTypeHead(ty) + '</summary>'
          + ty.cells.map(function(c){
        const gi = c.gi;
        const fk = pp.key + "|" + c.key;
        TRACING_FOLD_KEYS.shared.push(fk);
        const others = tracingCellPeople(c.group).filter(function(w){ return w !== pp.who; });
        return '<details ' + tracingFoldAttrs(fk, "cell", loneTC) + ' data-g="' + gi + '">'
          /* The type is the heading above this one now. */
          + '<summary>' + tracingFoldMark()
          + tracingCellHead(c.nuc, c.root, "", c.items.length, c.coord, c.total)'''
edit("core/tracingcard.js", [(u"the dataset list sorts each person's cells into types", DS_OLD, DS_NEW)])

edit("core/tracingcard.js", [
    (u"...and its type fold closes too",
     u'''            }).join("")
          + '</details>';
          }).join("")
          + '</details>';
      }).join("");
  tracingFoldWire(host);''',
     u'''            }).join("")
          + '</details>';
          }).join("")
          + '</details>';
          }).join("")
          + '</details>';
      }).join("");
  tracingFoldWire(host);'''),
    (u"loneC was the old per-person count and is now per type",
     u'''        const loneC = pp.cells.length === 1;''',
     u'''        const loneT = tracingGroupByType(pp.cells, function(c){
          return (c.group.items.filter(function(x){ return x.t.cellType; })[0]
                  || { t: {} }).t.cellType || "";
        }).length === 1;'''),
])

# ── and the type fold needs a shape ────────────────────────────────
edit("core/tracingcard.js", [
    (u"the injected style knows about a third level",
     u'''    + "details.tracingperson{border-top:1px solid var(--line);padding:7px 0 3px}"
    + "details.tracingcell{border-top:1px solid var(--line);padding:6px 0 2px}"
    + "details.tracingperson>details.tracingcell{border-top:0;border-left:2px solid var(--line);"
    + "margin:3px 0 3px 5px;padding:4px 0 2px 10px}"''',
     u'''    + "details.tracingperson{border-top:1px solid var(--line);padding:7px 0 3px}"
    + "details.tracingtype,details.tracingcell{border-top:1px solid var(--line);"
    + "padding:6px 0 2px}"
    /* ONE RULE FOR BOTH NESTINGS: a type inside a person and a cell inside a type are the same
       relationship drawn twice, and a second rule is how they would stop matching. */
    + "details.tracingperson>details.tracingtype,details.tracingtype>details.tracingcell{"
    + "border-top:0;border-left:2px solid var(--line);margin:3px 0 3px 5px;"
    + "padding:4px 0 2px 10px}"'''),
])

# ── and the label says what the list is now by ───────────────────────────
edit("core/tracingcard.js", [
    (u"the dataset label names all three levels",
     u"""'<label id="tracingSharedLabel">In the dataset, by person and cell — open one to add to it '
    + 'or correct it</label>'""",
     u"""'<label id="tracingSharedLabel">In the dataset, by person, cell type and cell — open one '
    + 'to add to it or correct it</label>'"""),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_P = os.path.join(HERE, "core/tracingcard.js")
_s = io.open(_P, encoding="utf-8").read()
for _what, _n in [(u"function tracingGroupByType(cells, typeOf){", 1),
                  (u"function tracingTypeHead(ty){", 1),
                  (u'tracingFoldAttrs(tk,"type",loneKT)', 1),
                  (u'tracingFoldAttrs(tk, "type", loneT)', 1),
                  (u"var TRACING_NOTYPE", 1)]:
    assert _s.count(_what) == _n, "%d of %r, wanted %d" % (_s.count(_what), _what, _n)
assert u"const loneC" not in _s, "loneC survives and is now about the wrong level"
# EVERY FOLD OPENED IS A FOLD CLOSED: five <details> are written now -- kept type, kept cell,
# person, shared type, shared cell -- and five must be closed.
_o, _c = _s.count(u"'<details '") + _s.count(u"'<details '"), 0
_o = _s.count(u"<details ' +") + _s.count(u"<details '+")
_c = _s.count(u"'</details>'")
assert _o == 5 and _c == 5, "%d details opened, %d closed" % (_o, _c)
print("done")
print("all applied")
