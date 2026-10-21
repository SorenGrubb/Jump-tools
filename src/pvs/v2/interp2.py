"""Sleeves by shape-based interpolation: in every 40 µm xy tile, the traced loops (holes filled = the
outer boundary of the PVS) are interpolated between consecutive traced sections through their signed
distance maps (gap <= MAXGAP µm), then the TriSAM lumen of each slice is taken out."""
import numpy as np, json, time
from scipy.ndimage import distance_transform_edt as edt, binary_fill_holes
m = json.load(open('vol_meta.json')); sh = tuple(m['shape'])
L = lambda n: np.unpackbits(np.load(n + '_bits.npy'))[:np.prod(sh)].reshape(sh).astype(bool)
import sys; SRC = sys.argv[1]; loops = L(SRC)
NZ, NY, NX = sh; TILE, MARG, MAXGAP = 40, 12, 12
out = np.zeros(sh, bool); t0 = time.time()
# filled loops per traced slice (outer boundary)
ks = np.where(loops.any(axis=(1, 2)))[0]
filled = {}
for k in ks: filled[k] = binary_fill_holes(loops[k])
del loops
def sdf(mk):
    if not mk.any(): return np.full(mk.shape, 1e3, np.float32)
    return (edt(~mk) - edt(mk)).astype(np.float32)
n_interp = 0
for ty in range(0, NY, TILE):
    for tx in range(0, NX, TILE):
        ya, yb = max(0, ty - MARG), min(NY, ty + TILE + MARG); xa, xb = max(0, tx - MARG), min(NX, tx + TILE + MARG)
        zs = [k for k in ks if filled[k][ya:yb, xa:xb].any()]
        if not zs: continue
        prev = None
        for k in zs:
            mk = filled[k][ya:yb, xa:xb]; s = sdf(mk)
            out[k, ya:yb, xa:xb] |= mk
            if prev is not None and 1 < k - prev[0] <= MAXGAP:
                kp, sp = prev
                for z in range(kp + 1, k):
                    t = (z - kp) / (k - kp); out[z, ya:yb, xa:xb] |= ((1 - t) * sp + t * s) < 0; n_interp += 1
            prev = (k, s)
    print('tile row', ty, round(time.time() - t0), 's', flush=True)
lumen = L('lumen'); out &= ~lumen
np.save(SRC + '_interp_bits.npy', np.packbits(out, axis=None)); print('sleeve voxels', int(out.sum()), 'interpolated slices', n_interp)
