"""Turn data/pvs/v1/pvs_mesh.bin (uint32 n, float32 xyz nm, uint32 idx) into a Neuroglancer
mesh-only precomputed source, unsharded neuroglancer_multilod_draco, segment 1:
   <out>/info, <out>/1.index (manifest), <out>/1 (one draco fragment, one LOD).
No colons in file names (the legacy mesh format needs '1:0', which Windows cannot store).
Vertices are pre-quantised to 16-bit integers in a cube that encloses the mesh, then draco-encoded
with origin 0 / range 2**16-1 so the decoded values ARE those integers (as igneous does)."""
import sys, os, json, struct, numpy as np, DracoPy
src, out = sys.argv[1], sys.argv[2]
b = open(src, "rb").read()
n = struct.unpack_from("<I", b)[0]
V = np.frombuffer(b, np.float32, n * 3, 4).reshape(-1, 3).astype(np.float64)
I = np.frombuffer(b, np.uint32, offset=4 + n * 12).reshape(-1, 3)
BITS = 16; Q = 2 ** BITS - 1
lo = np.floor(V.min(0)) - 1000.0; side = float(np.ceil((V.max(0) - lo).max() + 1000.0))
q = np.rint((V - lo) / side * Q).astype(np.float32)
frag = DracoPy.encode(q, I, quantization_bits=BITS, compression_level=7,
                      quantization_range=float(Q), quantization_origin=[0.0, 0.0, 0.0], preserve_order=False)
os.makedirs(out, exist_ok=True)
open(os.path.join(out, "1"), "wb").write(frag)
man = struct.pack("<3f", side, side, side) + struct.pack("<3f", *lo) + struct.pack("<I", 1) \
    + struct.pack("<f", 1.0) + struct.pack("<3f", 0, 0, 0) + struct.pack("<I", 1) \
    + struct.pack("<3I", 0, 0, 0) + struct.pack("<I", len(frag))
open(os.path.join(out, "1.index"), "wb").write(man)
json.dump({"@type": "neuroglancer_multilod_draco", "vertex_quantization_bits": BITS,
           "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], "lod_scale_multiplier": 1.0,
           "segment_properties": "props"}, open(os.path.join(out, "info"), "w"))
os.makedirs(os.path.join(out, "props"), exist_ok=True)
json.dump({"@type": "neuroglancer_segment_properties", "inline": {"ids": ["1"], "properties": [
    {"id": "label", "type": "label", "values": ["Perivascular space (Søren Grubb's tracing, vessel lumen subtracted)"]}]}},
    open(os.path.join(out, "props", "info"), "w"), ensure_ascii=False)
# check: decode and compare
d = DracoPy.decode(frag); P = np.asarray(d.points, np.float64)
back = lo + side * P / Q
print("verts", n, "->", len(P), "faces", len(I), "->", len(d.faces), "| fragment", round(len(frag) / 1e6, 2), "MB",
      "| max err after dequant (nm, vs nearest original, sampled)", end=" ")
from scipy.spatial import cKDTree
t = cKDTree(V); e, _ = t.query(back[::50]); print(round(float(e.max()), 1))
print("decoded ints?", np.allclose(P, np.rint(P)), "range", P.min(), P.max())
