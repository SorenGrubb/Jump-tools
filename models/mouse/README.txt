The mouse, skull and brain around the minnie65 volume in vr.html.

Models (Creative Commons, from Thingiverse; attribution required):
  mouse.bin  -- "ねずみ（Mouse）3Dデータ" by YahooJAPAN, https://www.thingiverse.com/thing:182233
  skull.bin, brain.bin -- "Mouse Skull and Brain" by smcinturff, https://www.thingiverse.com/thing:3079327
Decimated (60k / 60k / 30k triangles) and moved into the volume's own frame by
dashboard-data-tools/build_mouse.py; the skull-in-mouse fit by dashboard-data-tools/fit_mouse_skull.py.
Every number of the placement, and its source, is in placement.json.

Format: uint32 nVerts, uint32 nTriangles, float32 xyz × nVerts (micrometres, minnie65 frame:
x lateral, y down into the cortex, z anterior), uint32 triangle indices × 3·nTriangles.
