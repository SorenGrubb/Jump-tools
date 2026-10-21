"""The VR's PVS mesh: one draco file with the anchors as a GENERIC uint8×4 attribute (dir×127+128, distance
in 0.2 µm), plus pvs.json (quantisation box). Positions pre-quantised to 16 bit in a cube, as for the
Neuroglancer copy. usage: make_vr_mesh.py pvs_mesh.bin pvs_anchor.bin outdir"""
import sys, os, json, struct, numpy as np, DracoPy
M, A, OUT = sys.argv[1:4]; os.makedirs(OUT, exist_ok=True)
b = open(M, 'rb').read(); n = struct.unpack_from('<I', b)[0]
V = np.frombuffer(b, np.float32, n * 3, 4).reshape(-1, 3).astype(np.float64); F = np.frombuffer(b, np.uint32, offset=4 + n * 12).reshape(-1, 3)
a = open(A, 'rb').read(); assert struct.unpack_from('<I', a)[0] == n
dirs = np.frombuffer(a, np.int8, n * 3, 4).reshape(-1, 3).astype(np.int16); d = np.frombuffer(a, np.uint16, n, 4 + n * 3)
sheet = (dirs[:, 0] == 0) & (dirs[:, 1] == -127) & (dirs[:, 2] == 0)
G = np.c_[dirs + 128, np.minimum(255, np.round(d / 20))].astype(np.uint8)
G[sheet, :3] = [128, 1, 128]                      # the sheet's marker
lo = np.floor(V.min(0)) - 1000; side = float(np.ceil((V.max(0) - lo).max() + 1000)); Q = 65535
q = np.rint((V - lo) / side * Q).astype(np.float32)
f = DracoPy.encode(q, F, quantization_bits=16, compression_level=7, quantization_range=float(Q), quantization_origin=[0., 0., 0.], generic_attributes={0: G})
open(os.path.join(OUT, 'pvs.drc'), 'wb').write(f)
json.dump({"lo_nm": lo.tolist(), "side_nm": side, "bits": 16, "anchor": "GENERIC uint8x4: (dir+1)*127 rounded (+128 offset), distance in 0.2 um; dir (128,1,128) = sheet, widens upward"}, open(os.path.join(OUT, 'pvs.json'), 'w'))
dd = DracoPy.decode(f); print('drc', round(len(f) / 1e6, 2), 'MB;', len(dd.points), 'points (from', n, ')')
