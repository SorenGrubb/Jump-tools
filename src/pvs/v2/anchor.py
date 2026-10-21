"""Per-vertex anchor for widening the PVS as one space (2026-10-21):
 sleeve vertices: away from the nearest point of the TriSAM lumen surface, by their distance from it
   (the inner wall, on the vessel, stays; the outer wall moves out in proportion);
 sheet vertices: up, towards the arachnoid (−y), by their height above the glia-limitans side of the
   sheet in their 2 µm column (the brain side stays).
Out: uint32 n, int8 dir[n*3] (×127), uint16 d[n] (0.01 µm) — same vertex order as the mesh."""
import numpy as np, json, struct, sys
from scipy.spatial import cKDTree
MESH, OUT = sys.argv[1], sys.argv[2]
m = json.load(open('vol_meta.json')); sh = tuple(m['shape']); O = np.array(m['O']); RES = m['RES']
b = open(MESH, 'rb').read(); b_all = b; n = struct.unpack_from('<I', b)[0]
V = np.frombuffer(b, np.float32, n * 3, 4).reshape(-1, 3).astype(np.float64) / 1000
pial = np.unpackbits(np.load('sheet_smooth_bits.npy'))[:np.prod(sh)].reshape(sh).astype(bool)
pz, py, px = np.nonzero(pial)
P = np.c_[O[0] + px * RES, O[1] + py * RES, O[2] + pz * RES]
dp, jp = cKDTree(P).query(V, workers=-1)
sheet = dp <= 1.6
# sheet: the vertex's height above the bottom (glia-limitans side) of ITS OWN filled run in the column
Lrun = np.zeros(sh, np.uint8)
for y in range(sh[1] - 2, -1, -1):
    Lrun[:, y, :] = np.where(pial[:, y, :], np.minimum(254, Lrun[:, y + 1, :].astype(np.int16) + 1), 0)
runlen = Lrun[pz[jp], py[jp], px[jp]].astype(float) * RES          # filled voxels from this one down
dsheet = np.clip(P[jp, 1] + runlen - 0.5 * RES - V[:, 1], 0, 20.0)
del Lrun
# smooth that height over the mesh (12 passes), so neighbouring vertices move together
F = np.frombuffer(b_all, np.uint32, offset=4 + n * 12).reshape(-1, 3).astype(np.int64)
E = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]; E = np.r_[E, E[:, ::-1]]
from scipy.sparse import coo_matrix
A = coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)).tocsr()
deg = np.asarray(A.sum(1)).ravel()
h = dsheet.copy()
for _ in range(12):
    h = np.where(sheet, 0.5 * h + 0.5 * (A @ (h * sheet)) / np.maximum(1, A @ sheet.astype(float)), h)
dsheet = h
# sleeves: nearest point on the TriSAM surface
import zipfile
zb = zipfile.ZipFile('/tmp/claude-0/vsurf/vessel_inputs.zip').read('trisam_mesh.bin'); tn = struct.unpack_from('<I', zb)[0]
TV = np.frombuffer(zb, np.float32, tn * 3, 4).reshape(-1, 3).astype(np.float64) / 1000
TF = np.frombuffer(zb, np.uint32, offset=4 + tn * 12).reshape(-1, 3).astype(np.int64)
exec(open('/tmp/claude-0/vsurf/vessel_surface.py').read().split('def closest_on_tri')[1].split('vtree = cKDTree(V)')[0].join(['def closest_on_tri', '']))
o = np.argsort(np.r_[TF[:, 0], TF[:, 1], TF[:, 2]], kind='stable'); vv = np.r_[TF[:, 0], TF[:, 1], TF[:, 2]][o]; tt = np.tile(np.arange(len(TF)), 3)[o]
st = np.searchsorted(vv, np.arange(tn + 1))
_, jv = cKDTree(TV).query(V, k=6, workers=-1)
best = np.full(n, np.inf); cp_best = np.zeros((n, 3))
for k in range(6):
    s0, s1 = st[jv[:, k]], st[jv[:, k] + 1]; Lk = s1 - s0
    qi = np.repeat(np.arange(n), Lk); ti = tt[np.repeat(s0, Lk) + (np.arange(Lk.sum()) - np.repeat(np.cumsum(Lk) - Lk, Lk))]
    for c0 in range(0, len(qi), 3_000_000):
        q_, t_ = qi[c0:c0 + 3_000_000], ti[c0:c0 + 3_000_000]
        cp = closest_on_tri(V[q_], TV[TF[t_, 0]], TV[TF[t_, 1]], TV[TF[t_, 2]]); dd = np.linalg.norm(V[q_] - cp, axis=1)
        o_ = np.argsort(-dd); q2, d2, c2 = q_[o_], dd[o_], cp[o_]; m_ = d2 < best[q2]; best[q2[m_]] = d2[m_]; cp_best[q2[m_]] = c2[m_]
dirs = np.zeros((n, 3)); d = np.zeros(n)
sl = ~sheet & (best <= 15)
dv = V[sl] - cp_best[sl]; nrm = np.linalg.norm(dv, axis=1, keepdims=True); dirs[sl] = dv / np.maximum(nrm, 1e-9); d[sl] = best[sl]
dirs[sheet] = [0, -1, 0]; d[sheet] = dsheet[sheet]
print('vertices', n, '| sheet', int(sheet.sum()), 'median height', np.median(dsheet[sheet]).round(2), 'p90', np.percentile(dsheet[sheet], 90).round(1),
      '| sleeve', int(sl.sum()), 'median dist to lumen', np.median(best[sl]).round(2), 'p90', np.percentile(best[sl], 90).round(1), '| static', int((~sheet & ~sl).sum()))
open(OUT, 'wb').write(np.uint32(n).tobytes() + np.round(dirs * 127).astype(np.int8).tobytes() + np.minimum(65535, np.round(d * 100)).astype(np.uint16).tobytes())
