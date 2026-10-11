# -*- coding: utf-8 -*-
"""A module says its own unit.                                                      2026-10-11

Søren: *"Even though the dataset coordinates are unticked now, the cell is not centered!"*

HE IS RIGHT AND THE TICK WAS INNOCENT. His file, measured:

    Cell (segmentation)     span 202 x 235 x 143 um   centre  418, -438,  334
    Nucleus (segmentation)  span   0 x   0 x   0 um   centre -517,  474, -368
    Lysosome 1/2/3          span ~1.6 um              centre  418, -438,  334
    every node's translation [0, 0, 0]

The translations are zero, so "centred" did exactly what it says: the file is centred on its own
bounding box. That bounding box is 930 um across, because the NUCLEUS collapsed to a dot a
millimetre away, and the cell is therefore in one corner of a mostly empty room.

THE UNIT. core/nucmesh.js divides by 1000 and says so, in a comment I had read past:
"NANOMETRES IN, MICROMETRES OUT — the unit core/mesh.js hands back, so the caller has one frame
for the cell, the nucleus and the tracing." tracingSegParts declared `scaleToNm: 1` — nanometres.
So a nucleus at 517,000 (micrometres) was read as 517,000 nanometres: a tenth of a millimetre from
the dataset origin, and a tenth of its true size in every direction.

core/mesh3d.js had it right all along — `prepare(nm.positions, nm.indices, { unitNm: 1000 })` —
which is why the 3D pane has drawn the nucleus correctly for a month while the download did not.
It only became visible yesterday: until then nucmesh was never configured during an export, so the
nucleus was silently absent, and fixing that absence exposed the wrong unit underneath it.

SO THE DECLARATION MOVES TO THE MODULE THAT DOES THE DIVIDING. core/nucmesh.js and core/mesh.js
each export `unitNm`, and every caller asks rather than restating. A literal in the caller is the
same fact in a second place, and the second place is the one that goes wrong — this file could
have been written about half the week.

Changes: core/nucmesh.js   (unitNm: 1000, beside the division)
         core/mesh.js      (unitNm: 1000, beside its own)
         core/tracingcard.js, core/mesh3d.js  (ask, do not restate)
Check:   glbcheck.js       (the real tracingSegParts, a nucleus where a real one is, on the cell)
Run: python3 src/a_module_says_its_own_unit.py
     python3 src/build_stamps.py
     node glbcheck.js
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


# ── 1. each module states the unit it hands back ─────────────────────────────────────────────
edit("core/nucmesh.js", [
    (u"nucmesh says what it returns",
     u'''  return { configure: configure, configured: configured, fetchNucleus: fetchNucleus,''',
     u'''  /* ── THE UNIT, SAID HERE AND NOWHERE ELSE ──────────────────────────  2026-10-11
     fetchNucleus divides by 1000 twenty lines up. A caller that restates that as a literal is the
     same fact in a second place, and the second place is the one that goes wrong: the 3D export
     declared nanometres, so a nucleus at 517,000 µm was read as 517,000 nm — a tenth of its size,
     a millimetre from the cell, and the cell pushed into the corner of a mostly empty file.
     Søren found it: *"even though the dataset coordinates are unticked now, the cell is not
     centered!"* Nanometres per unit of what this module returns. */
  return { unitNm: 1000,
           configure: configure, configured: configured, fetchNucleus: fetchNucleus,'''),
])

edit("core/mesh.js", [
    (u"mesh says what it returns too",
     u'''  return {downloadRoot,downloadRootPptx,computeVolume,clearMeshNotFoundCache,forgetRootNotFound,currentFragmentCount,''',
     u'''  /* Nanometres per unit of the positions fetchCombinedMesh hands back -- `const scale=1000;
     // micrometres` above. Exported for the same reason core/nucmesh.js exports its own: a
     caller that restates a unit is a caller that can be wrong about it alone. 2026-10-11. */
  return {unitNm:1000,
          downloadRoot,downloadRootPptx,computeVolume,clearMeshNotFoundCache,forgetRootNotFound,currentFragmentCount,'''),
])

# ── 2. and the callers ask ───────────────────────────────────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the published cell asks core/mesh.js for its unit",
     u'''        /* MICROMETRES — core/mesh.js's own frame, stated at its nm -> µm line. */''',
     u'''        /* THE MODULE'S OWN ANSWER, not a literal here. core/mesh.js returns micrometres and
           says so with unitNm; restating it was how the nucleus below came to be wrong. */'''),

    (u"...and uses it",
     u'''                   alpha: tracingGlbAlpha("cell", false),
                   scaleToNm: 1000, positions: m.positions, indices: m.indices });''',
     u'''                   alpha: tracingGlbAlpha("cell", false),
                   scaleToNm: (UJ.mesh.unitNm || 1000),
                   positions: m.positions, indices: m.indices });'''),

    (u"the published nucleus asks core/nucmesh.js, which is the bug",
     u'''      /* NANOMETRES — core/nucmesh.js returns the legacy fragment vertices unscaled. */
      out.push({ name: "Nucleus (segmentation)", kind: "nucleus", group: "Segmentation",
                 color: "#3a72d8",
                 alpha: tracingGlbAlpha("nucleus", false),
                 scaleToNm: 1, positions: new Float32Array(pos), indices: new Uint32Array(idx) });''',
     u'''      /* NOT NANOMETRES. This said 1, on the belief that core/nucmesh.js returned the legacy
         fragment vertices unscaled; it divides them by 1000 and says so in a comment. A nucleus
         at 517,000 µm was therefore read as 517,000 nm — a tenth of a millimetre from the dataset
         origin and a thousandth of its true size — which put a 930 µm bounding box around a
         200 µm cell and pushed it into the corner. Ask the module. 2026-10-11. */
      out.push({ name: "Nucleus (segmentation)", kind: "nucleus", group: "Segmentation",
                 color: "#3a72d8",
                 alpha: tracingGlbAlpha("nucleus", false),
                 scaleToNm: (UJ.nucmesh.unitNm || 1000),
                 positions: new Float32Array(pos), indices: new Uint32Array(idx) });'''),
])

edit("core/mesh3d.js", [
    (u"the 3D pane asks as well, though it had the number right",
     u'''              var ng = prepare(nm.positions, nm.indices,
                               { unitNm: 1000, frame: { mid: geo.mid, span: geo.span } });''',
     u'''              /* This one was right all along, which is why the pane has drawn the nucleus
                 correctly for a month while the download did not. It asks anyway: a correct
                 literal and a wrong literal look identical until somebody measures. */
              var ng = prepare(nm.positions, nm.indices,
                               { unitNm: ((UJ.nucmesh && UJ.nucmesh.unitNm) || 1000),
                                 frame: { mid: geo.mid, span: geo.span } });'''),
])

for _rel, _what, _n in [("core/nucmesh.js", u"unitNm: 1000", 1),
                        ("core/mesh.js", u"unitNm:1000", 1),
                        ("core/tracingcard.js", u"scaleToNm: (UJ.mesh.unitNm || 1000)", 1),
                        ("core/tracingcard.js", u"scaleToNm: (UJ.nucmesh.unitNm || 1000)", 1),
                        ("core/tracingcard.js", u"scaleToNm: 1,", 0),
                        ("core/mesh3d.js", u"UJ.nucmesh.unitNm) || 1000", 1)]:
    _s = io.open(os.path.join(HERE, _rel), encoding="utf-8").read()
    assert _s.count(_what) == _n, "%s has %d of %s, wanted %d" % (
        _rel, _s.count(_what), _what, _n)
print("done 1")

# ── 2. the assertion that agreed with the bug ────────────────────────────
# It asserted that core/nucmesh.js returns nanometres. It does not, and the check agreed with
# the code because both were wrong. Corrected, not loosened.
edit("glbcheck.js", [
    ('both published modules hand back micrometres',
     '    ok(cellSeg.scale === 1000 && nucSeg.scale === 1,\n       "...each declaring its own unit \\u2014 core/mesh.js is micrometres, core/nucmesh.js is "\n       + "nanometres, and the lofter is nanometres",\n       "cell \\u00d7" + cellSeg.scale + ", nucleus \\u00d7" + nucSeg.scale);',
     '    /* THIS SAID core/nucmesh.js WAS NANOMETRES, and it is not: it divides by 1000 and says so\n       in a comment at that line. The assertion agreed with the code because both were wrong, and\n       it took Søren measuring a download \\u2014 a nucleus printed as 0.0 \\u00d7 0.0 \\u00d7 0.0 a\n       millimetre from its cell \\u2014 to find it. Corrected, not loosened: both are micrometres,\n       the lofter is nanometres, and each is now ASKED rather than restated. 2026-10-11. */\n    ok(cellSeg.scale === 1000 && nucSeg.scale === 1000,\n       "...each declaring its own unit \\u2014 core/mesh.js and core/nucmesh.js both hand back "\n       + "micrometres, and the lofter nanometres",\n       "cell \\u00d7" + cellSeg.scale + ", nucleus \\u00d7" + nucSeg.scale);'),
])

# ── 3. and the check that drives the real path ───────────────────────────
CHK = '\n  /* ── AND THE PUBLISHED PARTS LAND ON THE CELL ─────────────────────────────────  2026-10-11\n     Søren: *"Even though the dataset coordinates are unticked now, the cell is not centered!"*\n     His file, measured:\n\n       Cell (segmentation)     span 202 x 235 x 143 µm   centre  418, -438,  334\n       Nucleus (segmentation)  span   0 x   0 x   0 µm   centre -517,  474, -368\n       every node\'s translation [0, 0, 0]\n\n     The translations were zero, so the tick was innocent and "centred" did what it says — on a\n     bounding box 930 µm across, because the nucleus had collapsed to a dot a millimetre away.\n     core/nucmesh.js divides by 1000 and SAYS so; tracingSegParts declared `scaleToNm: 1`.\n\n     THE OLD UNIT ASSERTION COULD NOT HAVE CAUGHT THIS. It built its own part with\n     `scaleToNm: 1000` and checked that the lofter and a 1000-scaled mesh agree — the mechanism,\n     not the declaration. This drives the REAL tracingSegParts, with stubs that return what the\n     real modules return, in the unit they really return it in.\n\n     WHAT IS ASSERTED:\n       - the published cell and nucleus declare the unit their own module declares, not a literal\n       - and, end to end, a nucleus inside a cell comes out INSIDE it rather than a millimetre away\n       - ...and keeps its size, which is the other half of a wrong unit */\n  console.log("\\nand the published parts land on the cell, in the cell\'s own unit");\n  const unit = await p.evaluate(async () => {\n    if (typeof tracingSegParts !== "function") return { noCard: true };\n    /* A cell 20 µm across at a REAL dataset place, and a nucleus 10 µm across inside it. Both in\n       MICROMETRES, because that is what core/mesh.js and core/nucmesh.js both hand back — the\n       stubs lie about nothing. */\n    const box = (cx, cy, cz, h) => {\n      const v = [], f = [];\n      for (let i = 0; i < 8; i++)\n        v.push(cx + ((i & 1) ? h : -h), cy + ((i & 2) ? h : -h), cz + ((i & 4) ? h : -h));\n      const q = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];\n      q.forEach(c => f.push(c[0], c[1], c[2], c[0], c[2], c[3]));\n      return { positions: new Float32Array(v), indices: new Uint32Array(f) };\n    };\n    window.UJ.mesh = window.UJ.mesh || {};\n    const realUnit = UJ.mesh.unitNm;\n    UJ.mesh.fetchCombinedMesh = async () => box(418, 438, 334, 10);\n    window.UJ.nucmesh = { unitNm: 1000, configured: () => true, configure: () => {},\n      fetchNucleus: async () => box(418, 438, 334, 5) };\n    window.tracingExtraRootsFor = tracingExtraRootsFor = async () => [];\n    window.tracingProposedNucsFor = tracingProposedNucsFor = async () => [];\n    const parts = await tracingSegParts({ root: "1", nuc: "2" }, [], {});\n    const byName = {};\n    parts.forEach(q => { byName[q.name] = q; });\n    /* End to end: through glbParts, which is where a part\'s declared unit is actually applied. */\n    const prep = UJ.traceloft.glbParts(parts, [4, 4, 40]);\n    const bb = (q) => {\n      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];\n      for (let i = 0; i < q.xyz.length; i += 3)\n        for (let k = 0; k < 3; k++){\n          if (q.xyz[i + k] < lo[k]) lo[k] = q.xyz[i + k];\n          if (q.xyz[i + k] > hi[k]) hi[k] = q.xyz[i + k];\n        }\n      return { mid: [0,1,2].map(k => (lo[k] + hi[k]) / 2),\n               span: Math.max.apply(null, [0,1,2].map(k => hi[k] - lo[k])) };\n    };\n    const cell = bb(prep.parts.filter(q => /Cell/.test(q.name))[0]);\n    const nuc = bb(prep.parts.filter(q => /Nucleus/.test(q.name))[0]);\n    return { declaredCell: (byName["Cell (segmentation)"] || {}).scaleToNm,\n             declaredNuc: (byName["Nucleus (segmentation)"] || {}).scaleToNm,\n             moduleUnit: realUnit,\n             apart: Math.max.apply(null, [0,1,2].map(k => Math.abs(cell.mid[k] - nuc.mid[k]))),\n             cellSpan: cell.span, nucSpan: nuc.span };\n  });\n  if (unit.noCard) console.log("  (no tracing card on this page)");\n  else {\n    ok(unit.declaredNuc === 1000,\n       "the published nucleus declares the unit core/nucmesh.js declares — it divides by 1000 "\n       + "and says so, and `scaleToNm: 1` here is what put a dot a millimetre from the cell",\n       "declared " + unit.declaredNuc);\n    ok(unit.declaredCell === 1000 && (unit.moduleUnit === undefined || unit.moduleUnit === 1000),\n       "...and the published cell likewise, from core/mesh.js\'s own unitNm rather than a literal "\n       + "— a correct literal and a wrong one look identical until somebody measures",\n       "declared " + unit.declaredCell + ", module says " + unit.moduleUnit);\n    ok(unit.apart < 0.1,\n       "and end to end, a nucleus drawn INSIDE a cell comes out inside it: the two centres are "\n       + "on top of each other, not a millimetre apart",\n       unit.apart.toFixed(3) + " µm apart");\n    ok(unit.nucSpan > 9 && unit.nucSpan < 11 && unit.cellSpan > 19 && unit.cellSpan < 21,\n       "...and each keeps its size, which is the other half of a wrong unit — his nucleus came "\n       + "out a thousandth of itself and printed as 0.0 × 0.0 × 0.0",\n       "cell " + unit.cellSpan.toFixed(1) + " µm, nucleus " + unit.nucSpan.toFixed(1) + " µm");\n  }\n'
OLD = '\n  /* \\u2500\\u2500 AND A FORM THAT NEEDS NO IMPORTER AT ALL \\u2500\\u2500'
_G = os.path.join(HERE, "glbcheck.js")
if u"land on the cell, in the cell's own unit" in io.open(_G, encoding="utf-8").read():
    print("glbcheck.js\n  already there: the published parts land on the cell")
else:
    edit("glbcheck.js", [(u"the published parts land on the cell", OLD, CHK + OLD)])
_g = io.open(_G, encoding="utf-8").read()
assert _g.count(u"land on the cell, in the cell's own unit") == 1, "two copies"
assert u"core/nucmesh.js is \\u2014 nanometres" not in _g
print("done 2")
print("all applied")
