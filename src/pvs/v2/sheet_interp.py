"""The pial sheet by interpolating its two surfaces: in every traced section and every x column, the
sheet's top (arachnoid side) and bottom (glia-limitans side) y; between consecutive traced sections
≤ MAXGAP µm apart both are interpolated linearly along z for every x column filled in both. Then the
TriSAM lumen is taken out. (Shape-based SDF interpolation fails for a sheet thinner than its own
sideways shift between sections: it vanishes half-way -- that made the v2 SAS patchy.)"""
import numpy as np, json, time
m = json.load(open('vol_meta.json')); sh = tuple(m['shape']); NZ, NY, NX = sh
L = lambda n: np.unpackbits(np.load(n + '_bits.npy'))[:np.prod(sh)].reshape(sh).astype(bool)
pial = L('pial'); MAXGAP, MAXTHICK = 12, 45
ks = np.where(pial.any(axis=(1, 2)))[0]
top = {}; bot = {}
yy = np.arange(NY)[:, None]
for k in ks:
    sl = pial[k]; has = sl.any(0)
    t = np.where(has, np.argmax(sl, 0), -1); b = np.where(has, NY - 1 - np.argmax(sl[::-1], 0), -1)
    ok = has & (b - t <= MAXTHICK); top[k] = np.where(ok, t, -1); bot[k] = np.where(ok, b, -1)
out = np.zeros(sh, bool); t0 = time.time()
def fill(z, t, b, m):
    cols = np.where(m)[0]
    for x, a, c in zip(cols, np.floor(t[m]).astype(int), np.ceil(b[m]).astype(int)): out[z, a:c + 1, x] = True
K = np.array(ks); TT = np.stack([top[k] for k in ks]); BB = np.stack([bot[k] for k in ks])
for x in range(NX):
    v = np.where(TT[:, x] >= 0)[0]
    if not len(v): continue
    for j, i in enumerate(v):
        k = K[i]; out[k, TT[i, x]:BB[i, x] + 1, x] = True
        if j + 1 < len(v):
            i2 = v[j + 1]; k2 = K[i2]
            if 1 < k2 - k <= MAXGAP:
                for z in range(k + 1, k2):
                    f = (z - k) / (k2 - k)
                    a_ = int(np.floor((1 - f) * TT[i, x] + f * TT[i2, x])); c_ = int(np.ceil((1 - f) * BB[i, x] + f * BB[i2, x]))
                    out[z, a_:c_ + 1, x] = True
del pial
lumen = L('lumen'); out &= ~lumen
np.save('sheet_interp_bits.npy', np.packbits(out, axis=None)); print('sheet voxels', int(out.sum()), round(time.time() - t0), 's')
