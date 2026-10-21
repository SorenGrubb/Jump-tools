import numpy as np, json, time, sys
from scipy.ndimage import distance_transform_edt, binary_erosion, maximum_filter
m = json.load(open('vol_meta.json')); sh = tuple(m['shape'])
L = lambda n: np.unpackbits(np.load(n + '_bits.npy'))[:np.prod(sh)].reshape(sh).astype(bool)
loops, lumen = L('loops'), L('lumen')
t0 = time.time()
T = np.zeros(sh, np.uint8)        # 0.5 µm units
ks = np.where(loops.any(axis=(1, 2)))[0]
vals = []
for k in ks:
    lp = loops[k]
    if not lumen[k].any(): continue
    d = distance_transform_edt(~lumen[k])
    outer = lp & ~binary_erosion(lp)
    outer &= d > 1.0                       # not the side touching the vessel wall
    v = d[outer]; ok = v <= 12
    yy, xx = np.nonzero(outer); T[k, yy[ok], xx[ok]] = np.minimum(255, np.round(v[ok] * 2)).astype(np.uint8)
    vals.append(v[ok])
vals = np.concatenate(vals); print('outer-wall distance to lumen µm pct 10/25/50/75/90:', np.percentile(vals, [10, 25, 50, 75, 90]).round(1), 'n', len(vals), round(time.time()-t0), 's', flush=True)
np.save('T_sample.npy', T)
