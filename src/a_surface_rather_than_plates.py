# -*- coding: utf-8 -*-
"""A surface rather than a stack of plates.                                         2026-10-11

Søren, of a cell in Blender: *"I think the vasculature looks a bit segmented and not very smooth.
Also, the primary cilium is not very clear and the background is grey rather than white."*

THREE THINGS, AND THE FIRST ONE IS OURS AND WAS INVISIBLE.

1. NO NORMALS. This writer emitted POSITION and nothing else, and the glTF specification says a
   client MUST then compute FLAT normals. Every triangle a plate, in Blender and in every other
   viewer, for every file we have ever written. That is the faceting.

   WELDING IS THE OTHER HALF, and without it normals would not have helped. band() gives each
   pair of contours its own copy of BOTH rings, so two vertices at the same position are different
   indices; an index-wise average leaves a visible crease at every section — "segmented", exactly
   the word he used. So the positions are welded first, and the average is taken over the welded
   mesh.

   AND THE CAPS STAY SHARP. A corner whose own face normal is more than 35 degrees from its
   vertex's average gets a vertex of its own carrying the face normal. A lofted end cap meets its
   wall at about ninety degrees and splits; two adjacent bands differ by a degree or two and do
   not. Smoothing everything would round the one part of the shape the tracer actually drew flat.

   The Blender script welds too, which is what makes its own use_smooth mean anything, and says in
   its header that Shade Auto Smooth is there for crisper caps.

2. THE PUBLISHED MESHES GET A COLLECTION OF THEIR OWN. *"the primary cilium is not very clear"* —
   it is a thin thing inside a root-ID mesh that fills the frame. The script already makes a
   collection per kind, but the published cell mesh carried kind "cell", so it landed in the same
   collection as his own traced Whole cell and could not be hidden without hiding that too. They
   are now a "Segmentation" group: one tick in the outliner and what he drew is on its own.

3. A WHITE BACKGROUND, FROM THE SCRIPT. *"the background is grey rather than white"* — and when he
   set the world to white it stayed grey, because AgX (Blender's default view transform since 4.0)
   maps a scene-linear 1.0 to about three-quarters grey. So the script sets the world white, the
   view transform to Standard, and the 3D viewport to Material Preview on a white background —
   Material Preview because SOLID shading fakes transparency with a screen-door dither, which is
   the speckle in his screenshot. Every one of those in its own try: a script that dies on an
   AttributeError leaves half a scene.

Changes: core/traceloft.js    (weld; welded+angle-split NORMALs in the GLB; the script's weld,
                               its header, and the white-background block)
         core/tracingcard.js  (the published meshes say group "Segmentation")
Check:   glbcheck.js          (NORMAL exists and is unit; a band seam is smooth; a cap is not;
                               the collection; the white background)
Run: python3 src/a_surface_rather_than_plates.py
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


# ── 1. weld, and normals over the welded mesh ────────────────────────────────────────────────
WELD = u'''  /* ── ONE VERTEX PER PLACE ───────────────────────────────────────────  2026-10-11
     band() gives every pair of contours its own copy of both rings, so the loft has two vertices
     at each section's ring for every band that touches it. Nothing downstream minded until
     smooth shading did: an average taken per INDEX leaves a crease at every section, which is
     the "segmented" look Søren saw. 1e-4 µm is 0.1 nm — far below any feature in this data, far
     above float32's noise at these magnitudes. */
  function weld(pos, idx){
    var map = {}, remap = new Int32Array(pos.length / 3), out = [], i;
    for (i = 0; i < pos.length; i += 3){
      var k = Math.round(pos[i] * 1e4) + "," + Math.round(pos[i + 1] * 1e4)
            + "," + Math.round(pos[i + 2] * 1e4);
      if (map[k] === undefined){
        map[k] = out.length / 3;
        out.push(pos[i], pos[i + 1], pos[i + 2]);
      }
      remap[i / 3] = map[k];
    }
    var ni = new Uint32Array(idx.length);
    for (i = 0; i < idx.length; i++) ni[i] = remap[idx[i]];
    return { pos: new Float32Array(out), idx: ni };
  }
  /* ── AND A NORMAL AT EACH OF THEM ───────────────────────────────────  2026-10-11
     Søren: *"the vasculature looks a bit segmented and not very smooth."* Partly the published
     mesh's LOD, and partly this: a glTF primitive with no NORMAL attribute MUST be shaded flat
     by the client, per the specification. Every file written before today was a stack of plates
     in every viewer.

     Area-weighted, because the cross product's length is twice the triangle's area and a big
     face should count for more than a sliver. Then the SPLIT: a corner whose own face normal is
     more than HARD_DEG from its vertex's average gets a vertex of its own carrying the face
     normal. A lofted end cap meets its wall at about ninety degrees and splits; two adjacent
     bands differ by a degree or two and do not. Smoothing everything would round off the one
     part of the shape the tracer drew flat. */
  var HARD_DEG = 35;
  function smoothNormals(pos, idx){
    var n = pos.length / 3, i, t, e;
    var acc = new Float64Array(n * 3), fn = new Float64Array(idx.length);
    for (t = 0; t + 2 < idx.length; t += 3){
      var a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      var ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      var vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      fn[t] = nx; fn[t + 1] = ny; fn[t + 2] = nz;
      for (e = 0; e < 3; e++){
        var r = idx[t + e] * 3;
        acc[r] += nx; acc[r + 1] += ny; acc[r + 2] += nz;
      }
    }
    var unit = function(x, y, z){
      var L = Math.sqrt(x * x + y * y + z * z);
      return L > 0 ? [x / L, y / L, z / L] : [0, 0, 1];
    };
    var sm = new Float32Array(n * 3);
    for (i = 0; i < n; i++){
      var u = unit(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]);
      sm[i * 3] = u[0]; sm[i * 3 + 1] = u[1]; sm[i * 3 + 2] = u[2];
    }
    var lim = Math.cos(HARD_DEG * Math.PI / 180);
    var oP = [], oN = [], oI = new Uint32Array(idx.length), extra = {};
    for (i = 0; i < n * 3; i++){ oP.push(pos[i]); oN.push(sm[i]); }
    for (t = 0; t + 2 < idx.length; t += 3){
      var f = unit(fn[t], fn[t + 1], fn[t + 2]);
      for (e = 0; e < 3; e++){
        var vi = idx[t + e];
        var d = f[0] * sm[vi * 3] + f[1] * sm[vi * 3 + 1] + f[2] * sm[vi * 3 + 2];
        if (d >= lim){ oI[t + e] = vi; continue; }
        var ek = vi + "|" + Math.round(f[0] * 64) + "," + Math.round(f[1] * 64)
               + "," + Math.round(f[2] * 64);
        if (extra[ek] === undefined){
          extra[ek] = oP.length / 3;
          oP.push(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
          oN.push(f[0], f[1], f[2]);
        }
        oI[t + e] = extra[ek];
      }
    }
    return { pos: new Float32Array(oP), nrm: new Float32Array(oN), idx: oI };
  }
'''

edit("core/traceloft.js", [
    (u"weld and smoothNormals, before the writers that use them",
     u'''  function blenderPy(parts, resNm, meta){''',
     WELD + u'''  function blenderPy(parts, resNm, meta){'''),
])

# ── 2. the GLB writes them ───────────────────────────────────────────────────────────────────
edit("core/traceloft.js", [
    (u"the GLB welds, shades and writes a NORMAL",
     u'''      /* ...and the winding back, or every face is lit from inside. */
      var idx = new Uint32Array(q.indices.length);
      for (var t = 0; t + 2 < q.indices.length; t += 3){
        idx[t] = q.indices[t]; idx[t + 1] = q.indices[t + 2]; idx[t + 2] = q.indices[t + 1];
      }
      var ivRef = push(idx, 34963), pvRef = push(pos, 34962);
      accessors.push({ bufferView: ivRef, componentType: 5125, count: idx.length, type: "SCALAR" });
      accessors.push({ bufferView: pvRef, componentType: 5126, count: n, type: "VEC3",
                       min: mn, max: mx });''',
     u'''      /* ...and the winding back, or every face is lit from inside. */
      var idx = new Uint32Array(q.indices.length);
      for (var t = 0; t + 2 < q.indices.length; t += 3){
        idx[t] = q.indices[t]; idx[t + 1] = q.indices[t + 2]; idx[t + 2] = q.indices[t + 1];
      }
      /* AFTER the flip and the rewind, so the face normals come out pointing outward. */
      var w = weld(pos, idx);
      var sh = smoothNormals(w.pos, w.idx);
      pos = sh.pos; idx = sh.idx; n = pos.length / 3;
      mn = [Infinity, Infinity, Infinity]; mx = [-Infinity, -Infinity, -Infinity];
      for (var bi = 0; bi < pos.length; bi += 3)
        for (var bk = 0; bk < 3; bk++){
          if (pos[bi + bk] < mn[bk]) mn[bk] = pos[bi + bk];
          if (pos[bi + bk] > mx[bk]) mx[bk] = pos[bi + bk];
        }
      var ivRef = push(idx, 34963), pvRef = push(pos, 34962), nvRef = push(sh.nrm, 34962);
      /* THE INDEX IS WHAT push() RETURNED, not qi*2 and qi*2+1. That arithmetic was a stride
         hidden in two expressions, and adding a third accessor per part is exactly the change it
         would have broken silently. */
      var iAcc = accessors.push({ bufferView: ivRef, componentType: 5125, count: idx.length,
                                  type: "SCALAR" }) - 1;
      var pAcc = accessors.push({ bufferView: pvRef, componentType: 5126, count: n, type: "VEC3",
                                  min: mn, max: mx }) - 1;
      var nAcc = accessors.push({ bufferView: nvRef, componentType: 5126, count: n,
                                  type: "VEC3" }) - 1;'''),

    (u"...and the primitive points at all three",
     u'''      meshes.push({ name: q.name, primitives: [{ attributes: { POSITION: qi * 2 + 1 },
                                                 indices: qi * 2, material: qi, mode: 4 }] });''',
     u'''      meshes.push({ name: q.name,
        primitives: [{ attributes: { POSITION: pAcc, NORMAL: nAcc },
                       indices: iAcc, material: qi, mode: 4 }] });'''),

    (u"...and the asset says the surface is shaded",
     u'''                         note: "Scaled to micrometres; y is negated for glTF's Y-up. The vertices "''',
     u'''                         shaded: "welded, area-weighted vertex normals, hard edges above "
                                 + HARD_DEG + " degrees",
                         note: "Scaled to micrometres; y is negated for glTF's Y-up. The vertices "'''),
])

# ── 3. the Blender script: welded, and a white room to look at it in ─────────────────────────
edit("core/traceloft.js", [
    (u"the script welds too, so its own smooth shading means something",
     u'''    b.parts.forEach(function(q){
      var v = [];
      for (var i = 0; i < q.xyz.length; i += 3)
        v.push("(" + n3(q.xyz[i]) + "," + n3(-q.xyz[i + 2]) + "," + n3(-q.xyz[i + 1]) + ")");
      var f = [];
      for (var t = 0; t + 2 < q.indices.length; t += 3)
        f.push("(" + q.indices[t] + "," + q.indices[t + 1] + "," + q.indices[t + 2] + ")");''',
     u'''    b.parts.forEach(function(q){
      /* WELDED, for the reason the GLB is: from_pydata() keeps the vertices it is given, and
         use_smooth over a loft whose bands do not share vertices leaves a crease at every
         section. Same function, same tolerance, so the two downloads agree about the surface as
         well as about where it is. */
      var wq = weld(q.xyz, q.indices);
      var v = [];
      for (var i = 0; i < wq.pos.length; i += 3)
        v.push("(" + n3(wq.pos[i]) + "," + n3(-wq.pos[i + 2]) + "," + n3(-wq.pos[i + 1]) + ")");
      var f = [];
      for (var t = 0; t + 2 < wq.idx.length; t += 3)
        f.push("(" + wq.idx[t] + "," + wq.idx[t + 1] + "," + wq.idx[t + 2] + ")");'''),

    (u"...and says so, with the one key that makes the caps crisp again",
     u'''    L.push("# This file fetches nothing and runs nothing: it is vertices, faces and materials.");''',
     u'''    L.push("# Vertices are welded, so Shade Smooth has no crease at every section. For crisper");
    L.push("# end caps: select all, Object > Shade Auto Smooth (Blender 4.1+ \\u2014 the old Normals");
    L.push("# > Auto Smooth panel in Object Data Properties is gone).");
    L.push("# This file fetches nothing and runs nothing: it is vertices, faces and materials.");'''),

    (u"a white room to look at it in",
     u'''    L.push("print('" + b.parts.length + " structure(s) added — micrometres, placed at voxel "''',
     u'''    /* ── A WHITE BACKGROUND, AND WHY IT TAKES THREE SETTINGS ────────────────────  2026-10-11
       Søren: *"the background is grey rather than white"* — and setting the world to white left
       it grey, because AgX, Blender's default view transform since 4.0, maps a scene-linear 1.0
       to about three-quarters grey. So: the world, the view transform, AND the viewport, which in
       Solid shading does not use the world at all. Material Preview as well, because SOLID fakes
       transparency with a screen-door dither — the speckle in his screenshot.
       Each in its own try, and the viewport loop guarded: bpy.context.screen is None under
       `blender --python`, and a script that dies there leaves half a scene. */
    L.push("try:");
    L.push("    _w = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')");
    L.push("    bpy.context.scene.world = _w");
    L.push("    _w.use_nodes = True");
    L.push("    _bg = _w.node_tree.nodes.get('Background')");
    L.push("    if _bg is not None:");
    L.push("        _bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)");
    L.push("        _bg.inputs[1].default_value = 1.0");
    L.push("except Exception: pass");
    L.push("# AgX would render that white as light grey. Standard is the one that does not lie");
    L.push("# about the colours you drew. Change it back in Render > Color Management.");
    L.push("try: bpy.context.scene.view_settings.view_transform = 'Standard'");
    L.push("except Exception: pass");
    L.push("for _a in getattr(getattr(bpy.context, 'screen', None), 'areas', []) or []:");
    L.push("    if _a.type != 'VIEW_3D': continue");
    L.push("    for _s in _a.spaces:");
    L.push("        if _s.type != 'VIEW_3D': continue");
    L.push("        try: _s.shading.type = 'MATERIAL'   # SOLID dithers transparency");
    L.push("        except Exception: pass");
    L.push("        try:");
    L.push("            _s.shading.background_type = 'VIEWPORT'");
    L.push("            _s.shading.background_color = (1.0, 1.0, 1.0)");
    L.push("        except Exception: pass");
    L.push("        try: _s.shading.use_scene_world = True");
    L.push("        except Exception: pass");
    L.push("print('" + b.parts.length + " structure(s) added — micrometres, placed at voxel "'''),
])
_T = os.path.join(HERE, "core/traceloft.js")
_t = io.open(_T, encoding="utf-8").read()
for _what, _n in [(u"function weld(pos, idx){", 1), (u"function smoothNormals(pos, idx){", 1),
                  (u"var HARD_DEG = 35;", 1), (u"NORMAL: nAcc", 1),
                  (u"var w = weld(pos, idx);", 1), (u"var wq = weld(q.xyz, q.indices);", 1),
                  (u"qi * 2", 0), (u"view_transform = 'Standard'", 1),
                  (u"background_color = (1.0, 1.0, 1.0)", 1)]:
    assert _t.count(_what) == _n, "core/traceloft.js has %d of %s, wanted %d" % (
        _t.count(_what), _what, _n)
assert _t.index(u"function weld(pos, idx){") < _t.index(u"var wq = weld(q.xyz, q.indices);"), \
    "core/traceloft.js uses weld() before it is defined"
print("done 1")

# ── 4. the published meshes get a collection of their own ────────────────────────────────────
edit("core/tracingcard.js", [
    (u"the published cell mesh is filed under Segmentation",
     u'''        out.push({ name: "Cell (segmentation)", kind: "cell", color: "#ff3b3b",''',
     u'''        /* ITS OWN COLLECTION, so one tick in Blender's outliner hides the published pair
           and leaves what he drew. Søren: *"the primary cilium is not very clear"* — it was a
           thin thing inside a root-ID mesh that fills the frame, and `kind` put that mesh in the
           same collection as his own traced Whole cell. */
        out.push({ name: "Cell (segmentation)", kind: "cell", group: "Segmentation",
                   color: "#ff3b3b",'''),

    (u"...and so is the published nucleus",
     u'''      out.push({ name: "Nucleus (segmentation)", kind: "nucleus", color: "#3a72d8",''',
     u'''      out.push({ name: "Nucleus (segmentation)", kind: "nucleus", group: "Segmentation",
                 color: "#3a72d8",'''),
])
_C = os.path.join(HERE, "core/tracingcard.js")
_c = io.open(_C, encoding="utf-8").read()
assert _c.count(u'group: "Segmentation"') == 2, "core/tracingcard.js has %d of the group" % (
    _c.count(u'group: "Segmentation"'))
print("done 2")

# ── 5. the check knew POSITION only as "the VEC3 one" ───────────────────────
# Every primitive now has a NORMAL, which is also VEC3 and carries no min/max, so four
# positional reads started throwing. glTF requires min/max on POSITION and nowhere else,
# so "VEC3 with min" names it without walking the primitives.
_PAIRS5 = [
    ('POSITION is the VEC3 accessor that carries min/max',
     '      bounds: (json.accessors || []).filter(a => a.type === "VEC3").map(a => ({',
     '      /* POSITION, not just VEC3: since 2026-10-11 every primitive also has a NORMAL, which\n         is VEC3 and carries no min/max. The bounds are the POSITION accessor\'s, and glTF\n         requires min/max exactly there \\u2014 so "VEC3 with min" names the right one without\n         walking the primitives. */\n      bounds: (json.accessors || []).filter(a => a.type === "VEC3" && a.min).map(a => ({'),
    ('...at the unit comparison too',
     '    const box = json.accessors.filter(a => a.type === "VEC3").map(a => ({ min: a.min, max: a.max }));',
     '    const box = json.accessors.filter(a => a.type === "VEC3" && a.min)\n      .map(a => ({ min: a.min, max: a.max }));'),
    ('...at the separation test',
     '      const acc = (j.accessors || []).filter(x => x.type === "VEC3")[i];',
     '      const acc = (j.accessors || []).filter(x => x.type === "VEC3" && x.min)[i];'),
    ('...and at the axis test',
     '      const g = json.accessors.filter(x => x.type === "VEC3")[0];',
     '      const g = json.accessors.filter(x => x.type === "VEC3" && x.min)[0];'),
]
edit("glbcheck.js", _PAIRS5)

# ── 6. and what the three changes are for ─────────────────────────────────
CHK = '\n  /* ── A SURFACE RATHER THAN A STACK OF PLATES ──────────────────────────────────  2026-10-11\n     Søren, of a cell in Blender: *"I think the vasculature looks a bit segmented and not very\n     smooth. Also, the primary cilium is not very clear and the background is grey rather than\n     white."*\n\n     The first of those was ours and invisible: this writer emitted POSITION and nothing else,\n     and the glTF specification says a client MUST then compute FLAT normals. Every file we have\n     ever written was a stack of plates in every viewer.\n\n     AND WELDING IS THE OTHER HALF. band() gives each pair of contours its own copy of both\n     rings, so an index-wise average leaves a crease at every section — "segmented", his word.\n\n     WHAT IS ASSERTED:\n       - every primitive has a NORMAL, and every normal is a unit vector\n       - a vertex on the WALL of a lofted tube, where two bands meet, is smooth: its normal is\n         the radial one, not either face\'s. This is the fix; the rest is scaffolding\n       - a vertex on the end CAP is not smoothed into the wall — a cap is flat because the tracer\n         drew it flat, and rounding it off would be inventing geometry\n       - the published meshes are filed in their own collection, so one tick hides them\n       - and the Blender script sets the world, the view transform AND the viewport, because a\n         white world alone renders grey under AgX and Solid shading ignores the world entirely */\n  console.log("\\nand it is a surface rather than a stack of plates");\n  const surf = await p.evaluate(() => {\n    /* A tube: six sections of the same circle, so every wall vertex has an unambiguous radial\n       normal and every band seam is a place an unwelded average would crease. */\n    const ring = (z, r) => {\n      const pts = [];\n      for (let k = 0; k < 24; k++){\n        const a = 2 * Math.PI * k / 24;\n        pts.push([400000 + Math.round(r * Math.cos(a)), 230000 + Math.round(r * Math.sin(a))]);\n      }\n      return { z: z, points: pts };\n    };\n    const rings = [];\n    for (let z = 400; z <= 405; z++) rings.push(ring(z, 500));\n    const u8 = UJ.traceloft.glb([{ name: "Tube", rings: rings, color: "#cddc39" }], [4, 4, 40]);\n    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);\n    const jLen = dv.getUint32(12, true);\n    const j = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jLen)));\n    const binAt = 20 + jLen + ((4 - (jLen % 4)) % 4 ? 0 : 0) + 8;\n    const read = (ai) => {\n      const a = j.accessors[ai], bv = j.bufferViews[a.bufferView];\n      const o = binAt + bv.byteOffset;\n      const n = a.count * (a.type === "VEC3" ? 3 : 1);\n      return a.componentType === 5126\n        ? new Float32Array(u8.buffer.slice(u8.byteOffset + o, u8.byteOffset + o + n * 4))\n        : new Uint32Array(u8.buffer.slice(u8.byteOffset + o, u8.byteOffset + o + n * 4));\n    };\n    const prim = j.meshes[0].primitives[0];\n    /* NAMED, NOT THROWN. Without this the red run died on `read(undefined)` and reported a stack\n       trace instead of the one sentence that says what is missing. */\n    if (prim.attributes.NORMAL === undefined)\n      return { has: false, worst: 9, wall: null, cap: null, shaded: "" };\n    const P = read(prim.attributes.POSITION), N = read(prim.attributes.NORMAL);\n    /* Every normal a unit vector. */\n    let worst = 0;\n    for (let i = 0; i < N.length; i += 3){\n      const L = Math.hypot(N[i], N[i + 1], N[i + 2]);\n      worst = Math.max(worst, Math.abs(L - 1));\n    }\n    /* THE WALL. A vertex at mid-height, away from both caps: its normal should be radial, which\n       in glTF\'s frame is (x, -y, 0) of its own offset from the axis, and FLAT shading would give\n       it the normal of one triangle instead — tilted along z by the band. z is the tube\'s long\n       axis in data, which glTF keeps as z. */\n    let wall = null, cap = null;\n    const zs = [];\n    for (let i = 0; i < P.length; i += 3) zs.push(P[i + 2]);\n    const zMin = Math.min.apply(null, zs), zMax = Math.max.apply(null, zs);\n    for (let i = 0; i < P.length; i += 3){\n      const z = P[i + 2], r = Math.hypot(P[i], P[i + 1]);\n      /* ANY INTERIOR SECTION. Six sections have no vertex at the exact mid-height, and asking\n         for one found nothing \\u2014 the assertion reported "no wall vertex" rather than passing,\n         which is the right way round for a check to be wrong. */\n      if (r > 1.5 && z > zMin + 1e-3 && z < zMax - 1e-3 && wall === null)\n        wall = { nz: Math.abs(N[i + 2]), radial: (P[i] * N[i] + P[i + 1] * N[i + 1]) / (r || 1) };\n      if (r > 1.5 && Math.abs(z - zMax) < 1e-3 && Math.abs(N[i + 2]) > 0.9 && cap === null)\n        cap = { nz: Math.abs(N[i + 2]) };\n    }\n    return { has: !!prim.attributes.NORMAL, worst: worst, wall: wall, cap: cap,\n             verts: P.length / 3, tris: prim.indices !== undefined,\n             shaded: (j.asset.extras || {}).shaded || "" };\n  });\n  ok(surf.has, "every primitive carries a NORMAL — without one the glTF spec REQUIRES a viewer "\n     + "to shade it flat, which is every file this tool has written until today",\n     String(surf.has));\n  ok(surf.worst < 1e-3, "...and every normal is a unit vector",\n     "worst length error " + surf.worst.toExponential(1));\n  ok(!!surf.wall && surf.wall.nz < 0.05 && surf.wall.radial > 0.99,\n     "a vertex where two bands meet on the wall of a tube has the RADIAL normal, not either "\n     + "face\'s — this is the fix; unwelded, its normal would tilt along the tube and leave the "\n     + "crease at every section that he called segmented",\n     surf.wall ? ("z-component " + surf.wall.nz.toFixed(3) + ", radial "\n                  + surf.wall.radial.toFixed(3)) : "no wall vertex found");\n  ok(!!surf.cap,\n     "...while the end cap keeps a normal along the axis: a cap is flat because the tracer drew "\n     + "it flat, and smoothing it into the wall would be inventing the one part of the shape "\n     + "nobody outlined", surf.cap ? ("cap z-component " + surf.cap.nz.toFixed(3)) : "none found");\n  ok(/hard edges/.test(surf.shaded),\n     "...and the file says so in its own asset extras", surf.shaded || "said nothing");\n\n  console.log("\\nand the published meshes have a collection of their own");\n  const grp = await p.evaluate(async () => {\n    if (typeof tracingSegParts !== "function") return { noCard: true };\n    window.UJ.mesh = window.UJ.mesh || {};\n    UJ.mesh.fetchCombinedMesh = async () => ({\n      positions: new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,1]),\n      indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) });\n    window.UJ.nucmesh = { configured: () => true, configure: () => {},\n      fetchNucleus: async () => ({\n        positions: new Float32Array([0,0,0, 100,0,0, 0,100,0, 0,0,100]),\n        indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) }) };\n    window.tracingExtraRootsFor = tracingExtraRootsFor = async () => [];\n    window.tracingProposedNucsFor = tracingProposedNucsFor = async () => [];\n    const parts = await tracingSegParts({ root: "1", nuc: "2" }, [], {});\n    /* ...and what the Blender script makes of it: _coll(group). */\n    const py = UJ.traceloft.blenderPy(parts.concat([{ name: "Lysosome 1", kind: "lysosome",\n      color: "#9c27b0", rings: [{ z: 400, points: [[400000,230000],[400100,230000],\n        [400100,230100],[400000,230100]] }, { z: 401, points: [[400000,230000],[400100,230000],\n        [400100,230100],[400000,230100]] }] }]), [4, 4, 40], { title: "t" });\n    return { groups: parts.map(q => q.group || q.kind),\n             colls: (py.match(/_add\\(\'[^\']*\', \'([^\']*)\'/g) || []) };\n  });\n  if (grp.noCard) console.log("  (no tracing card on this page)");\n  else {\n    ok((grp.groups || []).join(",") === "Segmentation,Segmentation",\n       "the published cell and nucleus are filed under Segmentation, not under the same kind as "\n       + "the outlines he drew — so one tick in Blender\'s outliner hides the pair and leaves "\n       + "his own", (grp.groups || []).join(", ") || "none");\n    ok((grp.colls || []).join(" ").indexOf("Segmentation") >= 0,\n       "...and the Blender script makes that collection", (grp.colls || []).join("  ") || "none");\n  }\n\n  console.log("\\nand the script opens in a white room");\n  const room = await p.evaluate(() => {\n    const py = UJ.traceloft.blenderPy([{ name: "Whole cell", color: "#cddc39",\n      rings: [{ z: 400, points: [[400000,230000],[400100,230000],[400100,230100],[400000,230100]] },\n              { z: 401, points: [[400000,230000],[400100,230000],[400100,230100],[400000,230100]] }]\n    }], [4, 4, 40], { title: "t" });\n    return { world: /_bg\\.inputs\\[0\\]\\.default_value = \\(1\\.0, 1\\.0, 1\\.0, 1\\.0\\)/.test(py),\n             std: /view_transform = \'Standard\'/.test(py),\n             vp: /background_color = \\(1\\.0, 1\\.0, 1\\.0\\)/.test(py),\n             mat: /shading\\.type = \'MATERIAL\'/.test(py),\n             guarded: /getattr\\(getattr\\(bpy\\.context, \'screen\', None\\), \'areas\', \\[\\]\\)/.test(py),\n             tries: (py.match(/except Exception: pass/g) || []).length };\n  });\n  ok(room.world && room.std,\n     "the script sets a white world AND the Standard view transform — a white world alone "\n     + "renders light grey, because AgX maps a scene-linear 1.0 to about three-quarters",\n     "world " + room.world + ", Standard " + room.std);\n  ok(room.vp && room.mat,\n     "...and the viewport too, because Solid shading does not use the world at all — and in "\n     + "Material Preview, since Solid fakes transparency with a screen-door dither, which is the "\n     + "speckle in his screenshot", "background " + room.vp + ", Material Preview " + room.mat);\n  ok(room.guarded && room.tries >= 6,\n     "...each in its own try, and the viewport loop guarded, because bpy.context.screen is None "\n     + "under `blender --python` and a script that dies there leaves half a scene",\n     "guarded " + room.guarded + ", " + room.tries + " tries");\n'
OLD = '\n  /* \\u2500\\u2500 AND A FORM THAT NEEDS NO IMPORTER AT ALL \\u2500\\u2500'
_G = os.path.join(HERE, "glbcheck.js")
if u"a surface rather than a stack of plates" in io.open(_G, encoding="utf-8").read():
    print("glbcheck.js\n  already there: a surface rather than a stack of plates")
else:
    edit("glbcheck.js", [(u"a surface rather than a stack of plates", OLD, CHK + OLD)])
_g = io.open(_G, encoding="utf-8").read()
assert _g.count(u"and it is a surface rather than a stack of plates") == 1, "two copies"
print("done 3")
print("all applied")
