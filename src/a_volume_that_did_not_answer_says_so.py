# -*- coding: utf-8 -*-
r"""A volume that did not answer with an info says so.                               2026-10-14

Søren, from a phone, on a πJump post: *"Problem with EM in pJump. 3D works fine"* — with

    the EM could not be read here: undefined is not an object (evaluating 'info.scales.filter')

THAT MESSAGE IS A DEAD END AND IT IS OUR FAULT. `info.scales.filter` is core/emtiles.js's
realScales(), and the TypeError says only that what came back from the volume's `/info` was not a
precomputed info. It does not say WHICH volume, what the URL was, or what did come back — so the
screenshot cannot be diagnosed, which is why this file exists before any fix does.

WHAT IS RULED OUT ALREADY. pinky100's imagery is readable: empjumpcheck.js drives this exact page
against that bucket's real info and its real chunks, and a section draws. The Discussion's own path
was driven against the same fixture today and drew. So the fixture and the live answer differ, and
nothing short of the live answer will say how.

So realScales() refuses with a sentence instead of a type error: the base it asked, and the shape
of what it got — the top-level keys, which is exactly enough to tell a GCS error document from a
Zarr header from an info whose scales are named something else, and is nobody's private data.

THE CHECK THAT MATTERS IS THE RED ONE. emtilescheck.js gets a volume that answers 200 with an
object that is not an info, and asserts the message names the volume rather than a property.

Changes: core/emtiles.js
Check:   emtilescheck.js (extended)
Run: python3 src/a_volume_that_did_not_answer_says_so.py
     node emtilescheck.js && node empjumpcheck.js
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


edit("core/emtiles.js", [

 (u"a volume that answered with something else is named",
  u'''  function realScales(info){
    var skip = (CFG && CFG.skipScales) || [];
    var kept = info.scales.filter(function(s){''',
  u'''  function realScales(info){
    /* ── WHAT CAME BACK, AND FROM WHERE ────────────────────────────────────────────  2026-10-14
       Søren, from a phone: "the EM could not be read here: undefined is not an object (evaluating
       'info.scales.filter')". A TypeError from this line is the end of the trail: it does not say
       which volume was asked, what URL it was asked at, or what it answered — and the three
       plausible causes (a GCS error document served 200, a Zarr header reached through the wrong
       branch, an info whose scales are under another name) are told apart by exactly that.

       The top-level keys, because that is the smallest thing that distinguishes them. Nothing in
       a precomputed info is anybody's private data, and the base is already in the page's own
       source — this is making a failure readable, not exposing anything. */
    if (!info || !info.scales || typeof info.scales.filter !== "function"){
      var saw = (info && typeof info === "object")
        ? ("it answered with { " + Object.keys(info).slice(0, 8).join(", ") + " }")
        : ("it answered with " + (typeof info) + " " + String(info).slice(0, 40));
      throw new Error("the volume at " + ((CFG && CFG.em) || "(nothing configured)")
                    + " did not answer with a precomputed info \\u2014 " + saw
                    + ". Its /info is what every scale, chunk and mip here is read from.");
    }
    var skip = (CFG && CFG.skipScales) || [];
    var kept = info.scales.filter(function(s){'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_E = io.open(os.path.join(HERE, "core/emtiles.js"), encoding="utf-8").read()
assert _E.count(u"did not answer with a precomputed info") == 1
# ...AND THE HAPPY PATH IS UNTOUCHED: one filter, one fallback, exactly as before.
assert _E.count(u"return kept.length ? kept : info.scales;") == 1
assert _E.count(u"var kept = info.scales.filter(function(s){") == 1
print("done")
print("all applied")
