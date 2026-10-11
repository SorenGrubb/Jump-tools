# -*- coding: utf-8 -*-
"""One rule for how see-through, and the nucleus that was silently absent.           2026-10-11

Søren, having downloaded a µJump cell as a 3D model: *"The transparency of the root ID is too
much, it is hard to see the structure. But it should also include the Nucleus ID. That can also be
a bit transparent, so that you can see if there are things traced inside the nucleus, but it
should not be as transparent as the root ID."*

TWO FAULTS IN ONE SENTENCE, and they have the same shape.

1. THE NUMBERS WERE WRITTEN TWICE. tracingGlbAlpha() answered "how see-through is a cell, a
   nucleus, anything else" for the HAND-TRACED parts — 0.22 and 0.4. A thousand lines further
   down, tracingSegParts() answered the same question for the PUBLISHED meshes with its own
   literals — 0.15 and 0.35. Nobody decided they should differ; they differ because the second
   one was typed. 0.15 is the one he can barely see. So there is now ONE function, and both
   callers ask it: cell 0.30, nucleus 0.55. One order, stated once — the cell is the most
   see-through because everything is inside it, the nucleus less so because its own shape is
   worth seeing and only a few things are inside it, everything else solid.

2. THE NUCLEUS WAS LEFT OUT WITHOUT A WORD. core/nucmesh.js is configured lazily, and until today
   the ONLY place that configured it was the pad's 3D preview. The export did not configure it —
   it merely ASKED `UJ.nucmesh.configured()`, which on a freshly loaded page where nobody had
   opened the preview is false. So the download quietly had no nucleus, and the status line, which
   exists precisely to say what is missing, said nothing, because the whole branch was skipped
   before anything could be recorded. µJump has a nuclei volume (SRC.nuc, the minnie65 bossdb
   one); it was never pointed at.

   The remedy is one helper, tracingNucMeshReady(), called from BOTH places — so "is there a
   nucleus volume here, and is the reader pointed at it" has one answer, and a dataset that
   genuinely has none (βJump, where the box holds a Hoechst blob number) is NAMED in the line
   rather than passed over.

Both faults are the same fault: one question answered in two places, and the second place being
the one nobody looks at. This change removes two of those, it does not add a third.

Changes: core/tracingcard.js  (tracingGlbAlpha's two numbers; tracingSegParts asks it;
                               tracingNucMeshReady, used by the export and by the pad preview)
Check:   glbcheck.js          (new: one alpha rule, and a nucleus on an unconfigured page)
Run: python3 src/one_rule_for_how_see_through.py
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


edit("core/tracingcard.js", [
    # ── 1. the two numbers, in one place, with the reason next to them ─────────────────────────
    (u"one alpha rule, and the numbers he asked for",
     u'''function tracingGlbAlpha(kind, alone){
  var k = String(kind || "").toLowerCase();
  if (alone) return 1;
  if (k === "cell") return 0.22;
  if (k === "nucleus") return 0.4;
  return 1;
}''',
     u'''/* ── HOW SEE-THROUGH, AND WHY THESE TWO NUMBERS ─────────────────  2026-10-11
   Søren, on the µJump download: *"The transparency of the root ID is too much, it is hard to see
   the structure... [the nucleus] can also be a bit transparent, so that you can see if there are
   things traced inside the nucleus, but it should not be as transparent as the root ID."*

   One order, stated once: the CELL is the most see-through, because everything else is inside it;
   the NUCLEUS less so, because its own shape is worth seeing and only a few things are inside it;
   everything else solid, because nothing is inside it to look through it at.

   AND ONE FUNCTION. Until today the published root-ID and nucleus meshes carried their own
   literals — 0.15 and 0.35 — a thousand lines from these. Nobody decided they should differ; they
   differ because the second pair was typed. 0.15 is the one he could barely see. */
function tracingGlbAlpha(kind, alone){
  var k = String(kind || "").toLowerCase();
  if (alone) return 1;
  if (k === "cell") return 0.3;
  if (k === "nucleus") return 0.55;
  return 1;
}
/* ── IS THERE A NUCLEUS VOLUME HERE, AND IS THE READER POINTED AT IT ──  2026-10-11
   core/nucmesh.js is configured lazily, and until today the only place that configured it was the
   pad's 3D preview. The export merely ASKED `configured()` — false on a page where nobody had
   opened the preview — and left the nucleus out without a word, because the branch that would
   have recorded it was the branch being skipped. Søren: *"it should also include the Nucleus ID."*

   One helper for both callers. A dataset that genuinely has no nuclei volume (βJump, where the
   box holds a Hoechst blob number) returns false here and is NAMED in the line, rather than
   fetching the host's own 404 page as "/info". */
function tracingNucMeshReady(){
  if (!(window.UJ && UJ.nucmesh && typeof UJ.nucmesh.fetchNucleus === "function")) return false;
  if (typeof UJ.nucmesh.configured === "function" && UJ.nucmesh.configured()) return true;
  var src = "";
  try { src = String((tracingSources() || {}).nuc || ""); } catch (_e){ src = ""; }
  if (!src) return false;
  try { UJ.nucmesh.configure({ nuc: src }); } catch (_e2){ return false; }
  return typeof UJ.nucmesh.configured !== "function" || UJ.nucmesh.configured();
}'''),

    # ── 2. the published meshes ask the same function ──────────────────────────────────────────
    (u"the published cell mesh asks the one rule",
     u'''        out.push({ name: "Cell (segmentation)", kind: "cell", color: "#ff3b3b", alpha: 0.15,
                   scaleToNm: 1000, positions: m.positions, indices: m.indices });''',
     u'''        out.push({ name: "Cell (segmentation)", kind: "cell", color: "#ff3b3b",
                   alpha: tracingGlbAlpha("cell", false),
                   scaleToNm: 1000, positions: m.positions, indices: m.indices });'''),

    (u"...and so does the published nucleus",
     u'''      out.push({ name: "Nucleus (segmentation)", kind: "nucleus", color: "#3a72d8", alpha: 0.35,
                 scaleToNm: 1, positions: new Float32Array(pos), indices: new Uint32Array(idx) });''',
     u'''      out.push({ name: "Nucleus (segmentation)", kind: "nucleus", color: "#3a72d8",
                 alpha: tracingGlbAlpha("nucleus", false),
                 scaleToNm: 1, positions: new Float32Array(pos), indices: new Uint32Array(idx) });'''),

    # ── 3. the export points the reader at the volume, and says so when it cannot ──────────────
    (u"the export configures the nuclei volume itself",
     u'''  if (nuc && window.UJ && UJ.nucmesh && typeof UJ.nucmesh.fetchNucleus === "function"
      && (typeof UJ.nucmesh.configured !== "function" || UJ.nucmesh.configured())){
    var ids = [nuc];''',
     u'''  if (nuc && !tracingNucMeshReady())
    missed.push("the nucleus mesh (this dataset has no nuclei volume)");
  if (nuc && tracingNucMeshReady()){
    var ids = [nuc];'''),

    # ── 4. and the pad preview stops being the second place that knows how ─────────────────────
    (u"the pad preview uses the same helper",
     u'''  if (ids.nuc && UJ.nucmesh && tracingSources().nuc){
    try {
      if (!UJ.nucmesh.configured()) UJ.nucmesh.configure({ nuc: tracingSources().nuc });
      pad3DNote("fetching the nucleus’ mesh…");''',
     u'''  if (ids.nuc && tracingNucMeshReady()){
    try {
      pad3DNote("fetching the nucleus’ mesh…");'''),
])

_C = os.path.join(HERE, "core/tracingcard.js")
_c = io.open(_C, encoding="utf-8").read()
for _what, _n in [(u"function tracingGlbAlpha(kind, alone){", 1),
                  (u"function tracingNucMeshReady(){", 1),
                  (u"tracingNucMeshReady()", 4),
                  (u'tracingGlbAlpha("cell", false)', 1),
                  (u'tracingGlbAlpha("nucleus", false)', 1),
                  (u"UJ.nucmesh.configure({", 1),
                  (u"async function tracingSegParts(", 1)]:
    assert _c.count(_what) == _n, "core/tracingcard.js has %d of %s, wanted %d" % (
        _c.count(_what), _what, _n)
# NO LITERAL ALPHA LEFT in the published parts: the whole point is that there is one place.
for _gone in [u"alpha: 0.15,", u"alpha: 0.35,", u'if (k === "cell") return 0.22;',
              u'if (k === "nucleus") return 0.4;']:
    assert _gone not in _c, "core/tracingcard.js still has " + _gone
print("done 1")

# ── 5. the check ──────────────────────────────────────────────────────────────────────────────
CHK = u'''
  /* \\u2500\\u2500 ONE RULE FOR HOW SEE-THROUGH, AND A NUCLEUS THAT ARRIVES \\u2500\\u2500  2026-10-11
     S\\u00f8ren, on the \\u00b5Jump download: *"The transparency of the root ID is too much, it is
     hard to see the structure. But it should also include the Nucleus ID. That can also be a bit
     transparent, so that you can see if there are things traced inside the nucleus, but it should
     not be as transparent as the root ID."*

     TWO FAULTS OF THE SAME SHAPE. The alphas were written twice \\u2014 0.22/0.4 for the traced
     parts, 0.15/0.35 for the published ones a thousand lines away \\u2014 and 0.15 is the one he
     could not see. And core/nucmesh.js is configured lazily by the PAD, so an export on a page
     where nobody had opened the pad asked `configured()`, got false, and left the nucleus out in
     silence, because the branch that would have recorded it was the branch being skipped.

     WHAT IS ASSERTED:
       - the cell is more see-through than the nucleus, and the nucleus than an organelle
       - a published mesh and a hand-traced one of the SAME KIND get the SAME alpha, which is what
         "one rule" means and what a second literal would break
       - the nucleus arrives on a page where nucmesh was never configured \\u2014 the export points
         the reader at the dataset's own volume rather than waiting for the pad
       - ...and where the dataset genuinely has none, the line SAYS so rather than omitting it */
  console.log("\\nand one rule says how see-through each thing is");
  const see = await p.evaluate(async () => {
    if (typeof tracingGlbAlpha !== "function") return { noCard: true };
    const a = { cell: tracingGlbAlpha("cell", false), nuc: tracingGlbAlpha("nucleus", false),
                org: tracingGlbAlpha("lysosome", false), alone: tracingGlbAlpha("cell", true) };
    /* The published parts, read off a real tracingSegParts() run rather than off the source. */
    const missed = [];
    window.UJ.mesh = window.UJ.mesh || {};
    UJ.mesh.fetchCombinedMesh = async () => ({
      positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),
      indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) });
    window.tracingExtraRootsFor = tracingExtraRootsFor = async () => [];
    window.tracingProposedNucsFor = tracingProposedNucsFor = async () => [];
    /* A nucmesh that is NOT configured until somebody configures it \\u2014 which is the state a
       freshly loaded page is in, and the state the export used to give up in. */
    let configuredWith = "";
    window.UJ.nucmesh = {
      configured: () => !!configuredWith,
      configure: (c) => { configuredWith = String((c || {}).nuc || ""); },
      fetchNucleus: async () => ({
        positions: new Float32Array([0,0,0, 100,0,0, 0,100,0, 0,0,100]),
        indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) })
    };
    const g = { root: "864691136051278323", nuc: "405191" };
    const parts = await tracingSegParts(g, missed, {});
    /* READ IT NOW. The second scenario below resets this, and reading it at the end made the
       assertion report the second run's state while claiming to describe the first. */
    const cfgAfter = configuredWith;
    const by = {};
    parts.forEach(q => { by[q.name] = q.alpha; });
    /* ...and again on a dataset with no nuclei volume at all. */
    const realSrc = UJ.cfg && UJ.cfg.tracing ? UJ.cfg.tracing.sources : null;
    configuredWith = "";
    UJ.nucmesh.configure = () => {};                       /* refuses to become configured */
    const missed2 = [];
    const parts2 = await tracingSegParts(g, missed2, {});
    let src = "";
    try { src = String((tracingSources() || {}).nuc || ""); } catch (_e){ src = ""; }
    return { a: a, by: by, names: parts.map(q => q.name), configuredWith: cfgAfter,
             missed: missed, names2: parts2.map(q => q.name), missed2: missed2,
             src: src };
  });
  if (see.noCard) console.log("  (no tracing card on this page)");
  else {
    ok(see.a.cell < see.a.nuc && see.a.nuc < see.a.org && see.a.org === 1,
       "the cell is the most see-through, the nucleus less so, an organelle solid \\u2014 one order, "
       + "because everything is inside the cell and only a few things are inside the nucleus",
       "cell " + see.a.cell + " < nucleus " + see.a.nuc + " < organelle " + see.a.org);
    ok(see.a.cell >= 0.25,
       "...and the cell is opaque enough to SEE \\u2014 0.15 was the number he could not make out, "
       + "and it was a second literal nobody had decided on", String(see.a.cell));
    ok(see.a.alone === 1,
       "...while a tracing downloaded on its own is solid, since nothing encloses it",
       String(see.a.alone));
    ok(see.by["Cell (segmentation)"] === see.a.cell
       && (see.by["Nucleus (segmentation)"] === undefined
           || see.by["Nucleus (segmentation)"] === see.a.nuc),
       "a PUBLISHED mesh and a hand-traced one of the same kind get the same alpha, which is what "
       + "one rule means \\u2014 a second literal here is exactly the drift that caused this",
       JSON.stringify(see.by));
    /* FIVE OF THE EIGHT PAGES HAVE NO NUCLEI VOLUME, and that is not a fault: \\u03b2Jump's nuc box
       holds a Hoechst blob number, not a segment id, and \\u03b7/\\u03bb/\\u03c9/\\u03c7 have none at
       all. Asserting the nucleus arrives everywhere asserted the wrong thing \\u2014 so each page
       is held to the promise it can actually make, and BOTH halves are real assertions. */
    if (see.src){
      ok((see.names || []).indexOf("Nucleus (segmentation)") >= 0,
         "...and the nucleus ARRIVES on a page where nucmesh was never configured, because the "
         + "export points the reader at the dataset's own volume instead of waiting for the pad",
         (see.names || []).join(" | "));
      ok(see.configuredWith === see.src,
         "...which it does by configuring it from this dataset's own nuclei source",
         see.configuredWith || "nothing was configured");
      ok((see.missed || []).length === 0,
         "...with nothing reported missing when nothing was",
         (see.missed || []).join(", ") || "none");
    } else {
      ok((see.names || []).indexOf("Nucleus (segmentation)") < 0
         && (see.missed || []).join(" ").indexOf("no nuclei volume") >= 0,
         "this page has no nuclei volume, so the download says so instead of inventing one \\u2014 "
         + "and says it rather than omitting the nucleus in silence",
         (see.missed || []).join(", ") || "said nothing");
      ok(!see.configuredWith,
         "...and nothing was pointed at a volume that does not exist, which is what used to fetch "
         + "the host's own 404 page as \\"/info\\"", see.configuredWith || "nothing configured");
    }
    ok((see.names2 || []).indexOf("Nucleus (segmentation)") < 0
       && (see.missed2 || []).join(" ").indexOf("no nuclei volume") >= 0,
       "and a dataset with no nuclei volume SAYS so in the line \\u2014 silence is how this went "
       + "unnoticed, and a download missing its nucleus looks the same as a cell that has none",
       (see.missed2 || []).join(", ") || "said nothing");
  }
'''

OLD_TAIL = u'''
  /* \\u2500\\u2500 AND A FORM THAT NEEDS NO IMPORTER AT ALL \\u2500\\u2500'''
# GUARDED ON A SIGNATURE, not on the whole block -- see src/three_downloads_in_one_scene.py, where
# editing an inserted block made edit()'s `if new in s` stop matching and a second copy went in.
_G = os.path.join(HERE, "glbcheck.js")
if u"const see = await p.evaluate" in io.open(_G, encoding="utf-8").read():
    print("glbcheck.js\n  already there: one rule for how see-through")
else:
    edit("glbcheck.js", [(u"one rule for how see-through", OLD_TAIL, CHK + OLD_TAIL)])
_g = io.open(_G, encoding="utf-8").read()
assert _g.count(u"const see = await p.evaluate") == 1, "glbcheck.js has two of the new block"
print("done 2")

# ── 6. the older check asserted the numbers this change moves ─────────────────────────────────
# glbcheck.js's earlier block asserted `cellSeg.alpha < 0.2`, which was a reading of the literal
# 0.15 rather than of the rule. Superseded, not loosened: it now asserts the ORDER, which is the
# thing that must hold whatever the two numbers are.
edit("glbcheck.js", [
    (u"the older alpha assertion reads the order, not the literal",
     u'''    ok(cellSeg.alpha < 0.2 && nucSeg.alpha > cellSeg.alpha && nucSeg.alpha < 1,''',
     u'''    ok(cellSeg.alpha < nucSeg.alpha && nucSeg.alpha < 1,'''),
])
print("done 3")
print("all applied")
