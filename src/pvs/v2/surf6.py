"""PVS surface v2: pial sheet + traced loops smoothed (anisotropic Gaussian), plus a SHELL around the
TriSAM lumen wherever sleeves were traced, its thickness the local mean of the traced outer wall's
distance from the lumen (window z ±WZ, xy ±WXY µm). usage: surf2.py out.bin [WZ WXY]"""
import numpy as np, json, sys, time
from scipy.ndimage import gaussian_filter, uniform_filter, distance_transform_edt
from skimage.measure import marching_cubes
OUT = sys.argv[1]; GZ, GXY, CMIN, TSCALE = [float(x) for x in (sys.argv[4:8] if len(sys.argv) > 7 else (6, 3, 0.002, 1.0))]; DIAG = [0, 0, 0]; RBIG = float(sys.argv[8]) if len(sys.argv) > 8 else 3.0; NEAR = float(sys.argv[9]) if len(sys.argv) > 9 else 4.0; SG0 = 0.8; TARGET = 1_700_000; WZ = int(sys.argv[2]) if len(sys.argv) > 2 else 12; WXY = int(sys.argv[3]) if len(sys.argv) > 3 else 6
SZ, SXY, LVL = 3.0, 1.0, 0.10
m = json.load(open('vol_meta.json')); sh = tuple(m['shape']); O = np.array(m['O']); RES = m['RES']
def ymajor(n):
    v = np.unpackbits(np.load(n + '_bits.npy'))[:np.prod(sh)].reshape(sh)
    rows = [np.packbits(v[:, y, :]) for y in range(sh[1])]; del v; return rows
class Rows:
    def __init__(self, rows, kind): self.rows, self.kind = rows, kind
    def get(self, a, b):
        if self.kind == 'bits': return np.stack([np.unpackbits(self.rows[y])[:sh[0] * sh[2]].reshape(sh[0], sh[2]) for y in range(a, b)], 1).astype(bool)
        out = np.zeros((sh[0], b - a, sh[2]), np.uint8)
        for y in range(a, b):
            k, x, val = self.rows[y]; out[k, y - a, x] = val
        return out
pial, loops, lumen = Rows(ymajor('sheet_filled'), 'bits'), Rows(ymajor('loops_interp'), 'bits'), Rows(ymajor('lumen'), 'bits')
RAW = Rows(ymajor('loops'), 'bits')
_T = np.load('T_sample.npy', mmap_mode='r')
T = Rows([(lambda s_: (lambda nz: (nz[0], nz[1], s_[nz]))(np.nonzero(s_)))(np.asarray(_T[:, y, :])) for y in range(sh[1])], 'u8'); del _T
occ_y = np.array([np.unpackbits(pial.rows[y]).any() or np.unpackbits(loops.rows[y]).any() for y in range(sh[1])])
ys = np.where(occ_y)[0]; Y0, Y1 = ys.min(), ys.max() + 1
pad = max(WXY, 14) + 2
CH = 16; verts, faces, nv = [], [], 0; t0 = time.time(); shell_vox = 0
for y0 in range(Y0, Y1, CH):
    y1 = min(Y1, y0 + CH); a, b = max(0, y0 - pad), min(sh[1], y1 + pad)
    Pf, Lf = pial.get(a, b), loops.get(a, b)
    occ = (Pf | Lf).any(axis=1)
    if not occ.any(): continue
    zz = np.where(occ.any(1))[0]; xx = np.where(occ.any(0))[0]; q = WZ + 14
    za, zb = max(0, zz.min() - q), min(sh[0], zz.max() + q + 1); xa, xb = max(0, xx.min() - q), min(sh[2], xx.max() + q + 1)
    P = Pf[za:zb, :, xa:xb]; Lp = Lf[za:zb, :, xa:xb]; del Pf, Lf
    Lu = lumen.get(a, b)[za:zb, :, xa:xb]; Tc = T.get(a, b)[za:zb, :, xa:xb]
    f = gaussian_filter((P | Lp).astype(np.float32), SG0, mode='constant')
    has = Tc > 0
    if has.any():
        sg = (GZ, GXY, GXY)
        cnt = gaussian_filter(has.astype(np.float32), sg, mode='constant')
        sm = gaussian_filter((Tc.astype(np.float32) / 2), sg, mode='constant')
        Tf = np.where(cnt > CMIN, sm / np.maximum(cnt, 1e-9), 0) * TSCALE
        del sm
        # only the larger vessels carry a sleeve: the lumen opened by RBIG µm (capillaries drop out)
        din = distance_transform_edt(Lu).astype(np.float32); core = din >= RBIG; del din
        big = distance_transform_edt(~core).astype(np.float32) <= RBIG + 0.5; del core
        big &= Lu
        d = distance_transform_edt(~big).astype(np.float32); d[Lu] = 0
        near = distance_transform_edt(~Lp).astype(np.float32) <= NEAR
        shell = (cnt > CMIN) & ~Lu & (d <= Tf + 0.5) & near; del near
        tr = Lp.any(axis=(1, 2)); c0, c1 = y0 - a, y0 - a + (y1 - y0)
        DIAG[0] += int((shell[tr, c0:c1] & Lp[tr, c0:c1]).sum()); DIAG[1] += int(shell[tr, c0:c1].sum()); DIAG[2] += int(Lp[tr, c0:c1].sum())
        shell_vox += int(shell[:, y0 - a: y0 - a + (y1 - y0)].sum())
        del Tc
        f = np.maximum(f, gaussian_filter(shell.astype(np.float32), 0.8, mode='constant'))
        del d, cnt, Tf, shell
    f = np.pad(f, 1)
    if f.max() < 0.5: continue
    v, fc, _, _ = marching_cubes(f, 0.5, step_size=1, allow_degenerate=False)
    v -= 1; v[:, 0] += za; v[:, 1] += a; v[:, 2] += xa
    cy = v[fc][:, :, 1].mean(1); fc = fc[(cy >= y0 - 0.5) & (cy < y1 - 0.5)]
    used = np.unique(fc); remap = np.full(len(v), -1); remap[used] = np.arange(len(used)); v = v[used]; fc = remap[fc]
    xyz = np.stack([O[0] + v[:, 2] * RES, O[1] + v[:, 1] * RES, O[2] + v[:, 0] * RES], 1) * 1000.0
    verts.append(xyz.astype(np.float32)); faces.append((fc + nv).astype(np.uint32)); nv += len(xyz)
    print(f"y {y0}-{y1}: {len(fc)} tris ({time.time()-t0:.0f}s)", flush=True)
V = np.concatenate(verts); F = np.concatenate(faces)
# step-1 marching cubes keeps the 2-3 µm thin parts of the sheet; decimate back to a VR-sized mesh
import fast_simplification
print('before decimation', len(V), len(F), flush=True)
red = max(0.0, 1 - TARGET / len(F))
V, F = fast_simplification.simplify(V, F.astype(np.int64), target_reduction=red)
V = V.astype(np.float32); F = F.astype(np.uint32)
open(OUT, 'wb').write(np.uint32(len(V)).tobytes() + V.tobytes() + F.tobytes())
print("total", len(V), "verts", len(F), "tris; shell voxels", shell_vox, "| traced slices: loops covered by shell", round(DIAG[0]/max(1,DIAG[2]),3), "shell/loops area", round(DIAG[1]/max(1,DIAG[2]),2))
