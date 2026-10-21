"""The sheet's two surfaces smoothed before it is drawn: the traced top (arachnoid side) and bottom
(glia-limitans side) jump by 3-5 µm from one section to the next, so a 2-3 µm thin sheet became a
staircase whose steps do not touch -- and the smoothed surface lost them (the patchy SAS). Top and
bottom maps (z, x) are smoothed (Gaussian σ z 3, x 1.5 µm, over covered columns only), the sheet is
redrawn between them with at least 3 µm thickness, and the lumen taken out again."""
import numpy as np, json
from scipy.ndimage import gaussian_filter
m = json.load(open('vol_meta.json')); sh = tuple(m['shape']); NZ, NY, NX = sh
L = lambda n: np.unpackbits(np.load(n + '_bits.npy'))[:np.prod(sh)].reshape(sh).astype(bool)
S = L('sheet_filled'); C = S.any(1)
top = np.where(C, np.argmax(S, 1), 0).astype(np.float32); bot = np.where(C, NY - 1 - np.argmax(S[:, ::-1, :], 1), 0).astype(np.float32)
del S
sg = (3.0, 1.5); w = gaussian_filter(C.astype(np.float32), sg)
ts = gaussian_filter(top * C, sg) / np.maximum(w, 1e-6); bs = gaussian_filter(bot * C, sg) / np.maximum(w, 1e-6)
out = np.zeros(sh, bool); MIN = 3
zz, xx = np.nonzero(C)
t = ts[zz, xx]; b = np.maximum(bs[zz, xx], t + MIN - 1)
c = (t + b) / 2; half = np.maximum((b - t + 1) / 2, MIN / 2)
a0 = np.floor(c - half + 0.5).astype(int).clip(0, NY - 1); a1 = np.ceil(c + half - 0.5).astype(int).clip(0, NY - 1)
for z, x, a, e in zip(zz, xx, a0, a1): out[z, a:e + 1, x] = True
lumen = L('lumen'); out &= ~lumen
np.save('sheet_smooth_bits.npy', np.packbits(out, axis=None)); print('columns', len(zz), 'voxels', int(out.sum()))
# check: how much of it would the smoothed surface still lose?
mx = np.zeros((NZ, NX), np.float32)
for y0 in range(0, 220, 24):
    a, b_ = max(0, y0 - 4), min(NY, y0 + 28); sub = out[:, a:b_].astype(np.float32)
    if not sub.any(): continue
    f = gaussian_filter(sub, 0.8, mode='constant'); mx = np.maximum(mx, f[:, max(0, y0 - a):y0 - a + 24].max(1))
Cc = out.any(1); print('covered', int(Cc.sum()), 'lost after smoothing', int((Cc & (mx < 0.5)).sum()))
