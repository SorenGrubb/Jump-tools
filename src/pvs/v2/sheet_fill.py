"""Close the remaining holes in the pial sheet seen from above: on the (z, x) map of the sheet, holes
that a closing with a disk of radius R µm bridges are filled, their top and bottom surfaces taken as
the Gaussian-weighted mean (σ 4 µm) of the sheet around them; then the lumen is taken out again."""
import numpy as np, json
from scipy.ndimage import binary_closing, gaussian_filter
m = json.load(open('vol_meta.json')); sh = tuple(m['shape']); NZ, NY, NX = sh
L = lambda n: np.unpackbits(np.load(n + '_bits.npy'))[:np.prod(sh)].reshape(sh).astype(bool)
S = L('sheet_interp')
C = S.any(1)                                                  # (z, x)
top = np.where(C, np.argmax(S, 1), 0).astype(np.float32); bot = np.where(C, NY - 1 - np.argmax(S[:, ::-1, :], 1), 0).astype(np.float32)
R = 8; yy, xx = np.mgrid[-R:R + 1, -R:R + 1]; disk = yy**2 + xx**2 <= R * R
Cc = binary_closing(np.pad(C, R), structure=disk)[R:-R, R:-R]
hole = Cc & ~C
w = gaussian_filter(C.astype(np.float32), 4); tt = gaussian_filter(top * C, 4) / np.maximum(w, 1e-6); bb = gaussian_filter(bot * C, 4) / np.maximum(w, 1e-6)
zz, xs = np.nonzero(hole & (w > 1e-3))
for z, x in zip(zz, xs): S[z, int(np.floor(tt[z, x])):int(np.ceil(bb[z, x])) + 1, x] = True
lumen = L('lumen'); S &= ~lumen
np.save('sheet_filled_bits.npy', np.packbits(S, axis=None)); print('sheet coverage', int(C.sum()), '-> filled', int(len(zz)), 'columns; voxels', int(S.sum()))
