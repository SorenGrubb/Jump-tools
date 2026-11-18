"""Builds models/mouse/*.bin for vr.html: the Thingiverse mouse, skull and brain, decimated and moved into the
minnie65 dataset's own frame (micrometres: x lateral, y down into the cortex, z anterior).
Placement (2026-11-18): see models/mouse/placement.json for every number and where it comes from."""
import numpy as np, trimesh, fast_simplification, json, os
SRC = "/tmp/claude-0/mouse/zip"; OUT = "/home/claude/jump-tools/models/mouse"
sk = trimesh.load(SRC + "/Skull and brain/files/Mouse_Skull.stl")
br = trimesh.load(SRC + "/Skull and brain/files/Mouse_Brain.stl")
mo = trimesh.load(SRC + "/Mouse/files/Mouse_t.stl")
# ---- skull/brain frame S: x = ventral, y = right, z = posterior (units: model mm) ----
MID_Y = 13.45                      # midline (brain's lateral extent at the target AP: 8.70-18.20)
BREGMA_Z, LAMBDA_Z = 15.4, 21.0    # suture junctions read off the skull's dorsal surface (curvature)
UNITS_PER_MM_AP = (LAMBDA_Z - BREGMA_Z) / 4.2      # bregma-lambda is ~4.2 mm in an adult C57BL/6
HALF_W_MODEL, HALF_W_REAL = 4.75, 4.7              # hemisphere half-width at the target AP: model / real (mm)
AP_FROM_LAMBDA_MM, ML_MM = 1.2, 3.3                # EM volume centre: ~1.2 mm anterior of lambda, 3.3 mm lateral (right)
tz = LAMBDA_Z - AP_FROM_LAMBDA_MM * UNITS_PER_MM_AP
ty = MID_Y + ML_MM / HALF_W_REAL * HALF_W_MODEL
# brain dorsal surface height x = h(y, z) near the target, from surface samples
p, fi = trimesh.sample.sample_surface(br, 2000000)
near = (np.abs(p[:, 1] - ty) < 0.6) & (np.abs(p[:, 2] - tz) < 0.6)
q = p[near]; top = []
for (yy, zz) in [(ty + dy, tz + dz) for dy in np.linspace(-0.5, 0.5, 11) for dz in np.linspace(-0.5, 0.5, 11)]:
    s = q[(np.abs(q[:, 1] - yy) < 0.06) & (np.abs(q[:, 2] - zz) < 0.06)]
    if len(s): top.append([s[:, 0].min(), yy, zz])
top = np.array(top)
A = np.c_[top[:, 1], top[:, 2], np.ones(len(top))]; c, *_ = np.linalg.lstsq(A, top[:, 0], rcond=None)
P0 = np.array([c[0] * ty + c[1] * tz + c[2], ty, tz])
n_in_S = np.array([1.0, -c[0], -c[1]]); n_in_S /= np.linalg.norm(n_in_S)     # into the brain
# ---- dataset frame N (minnie65 µm): x lateral, y down, z anterior; layers' mid-plane gives the radial axis ----
a_, b_ = -0.0501, -0.0610                                 # plane through Søren's traced glia limitans (data/meninges/minnie65.json, 54,700 points, sd 19 µm)
n_in_N = np.array([-a_, 1.0, -b_]); n_in_N /= np.linalg.norm(n_in_N)
C_N = np.array([950.0, 335.7, 715.0])                     # the glia limitans at the volume's centre: the brain's surface goes through it
def frame(n, lat):
    e2 = n; e1 = lat - lat.dot(e2) * e2; e1 /= np.linalg.norm(e1); e3 = np.cross(e1, e2); return np.c_[e1, e2, e3]
E = frame(n_in_S, np.array([0, 1.0, 0]))                  # lateral = +y (right hemisphere)
F = frame(n_in_N, np.array([1.0, 0, 0]))
R = F @ E.T
assert np.allclose(R @ np.array([0, 0, -1.0]) @ np.array([0, 0, 1.0]) > 0.9, True), "anterior must map to +z"
S_UM = 1000.0 / UNITS_PER_MM_AP                           # µm per model unit, from the sutures
S_UM = (S_UM + 806.0) / 2                                 # ... averaged with the bulb-to-cerebellum length (12.5 mm)
def toN(v): return C_N + S_UM * (v - P0) @ R.T
# ---- the mouse body into the skull frame, fitted (fit2.py): the skull from the nose to behind the ears, its
#      upper part (all but the lower jaw and incisors) inside the fur, its top as close under the fur as fits:
#      skull 0.85x the head's units, tipped 22 deg snout-up, cranium ~1 mm under the fur ----
K, PITCH, NY, TOP = 0.85, 22.0, -34.0, -1.5
def mouse_to_S(v):   # mouse: x = left, y = posterior, z = up  ->  S: x = ventral, y = right, z = posterior
    a = np.radians(PITCH); y0, z0 = -25.0, 18.0; y, z = v[:, 1], v[:, 2]
    yr = y0 + (y - y0) * np.cos(a) + (z - z0) * np.sin(a); zr = z0 - (y - y0) * np.sin(a) + (z - z0) * np.cos(a)
    return np.c_[TOP + (24.3 - zr) / K, MID_Y - v[:, 0] / K, (yr - NY) / K]
# ---- the brain's surface ON the glia limitans over the volume (2026-11-18, Søren: "make sure that the glia limitans is
#      aligned with the surface of the brain"): the model is a smooth convex shell and the traced glia limitans nearly a
#      plane, so the brain's dorsal surface is moved radially onto the traced plane inside the volume's footprint and
#      blended back to the model 600 um outside it ----
GX0, GX1, GZ0, GZ1 = 150.0, 1750.0, 317.0, 1112.0
def glia(x, z): return -0.0501 * x - 0.0610 * z + 426.9
def glia_morph(V):
    cell = 100.0; xs = np.arange(GX0 - 900, GX1 + 900, cell); zs = np.arange(GZ0 - 900, GZ1 + 900, cell)
    top = np.full((len(zs), len(xs)), np.nan)
    ix = np.floor((V[:, 0] - xs[0]) / cell).astype(int); iz = np.floor((V[:, 2] - zs[0]) / cell).astype(int)
    ok = (ix >= 0) & (ix < len(xs)) & (iz >= 0) & (iz < len(zs)) & (V[:, 1] < 2500)
    for a_, b_, y in zip(iz[ok], ix[ok], V[ok, 1]):
        if not (top[a_, b_] <= y): top[a_, b_] = y
    from scipy.ndimage import generic_filter
    top = generic_filter(top, np.nanmean, size=3, mode="nearest")       # fill holes, smooth a little
    X, Z = np.meshgrid(xs + cell / 2, zs + cell / 2); D = glia(X, Z) - top; D = np.nan_to_num(D)
    out = np.maximum(np.maximum(GX0 - X, X - GX1), np.maximum(GZ0 - Z, Z - GZ1)).clip(0)
    W = 1 - np.clip(out / 600.0, 0, 1); W = W * W * (3 - 2 * W); D = D * W
    from scipy.interpolate import RegularGridInterpolator
    f = RegularGridInterpolator((zs + cell / 2, xs + cell / 2), D, bounds_error=False, fill_value=0.0)
    vtop = RegularGridInterpolator((zs + cell / 2, xs + cell / 2), np.nan_to_num(top, nan=1e9), bounds_error=False, fill_value=1e9)
    q = np.c_[V[:, 2], V[:, 0]]; d = f(q); t = vtop(q)
    near = np.clip(1 - (V[:, 1] - t) / 600.0, 0, 1)                      # the dorsal shell moves, the base of the brain stays
    V = V.copy(); V[:, 1] += d * near; return V
def dec(m, target):
    v, f = fast_simplification.simplify(m.vertices.astype(np.float32), m.faces.astype(np.int32), 1 - target / len(m.faces))
    return v.astype(np.float64), f
meta = {}
for name, m, tgt, pre in [("brain", br, 60000, None), ("skull", sk, 60000, None), ("mouse", mo, 30000, mouse_to_S)]:
    v, f = dec(m, tgt)
    if pre is not None: v = pre(v)
    vN = toN(v)
    if name == "brain": vN = glia_morph(vN)
    else: vN = vN - 120.0 * n_in_N     # skull and fur 120 um up, so the model skull (0.5 mm thick) clears the meninges
    vN = vN.astype(np.float32)
    idx = f.astype(np.uint32)
    with open(f"{OUT}/{name}.bin", "wb") as fh:
        fh.write(np.array([len(vN), len(idx)], np.uint32).tobytes()); fh.write(vN.tobytes()); fh.write(idx.tobytes())
    meta[name] = {"verts": int(len(vN)), "tris": int(len(idx)), "bytes": os.path.getsize(f"{OUT}/{name}.bin"),
                  "bounds_um": [vN.min(0).round(0).tolist(), vN.max(0).round(0).tolist()]}
place = {
  "what": "Thingiverse mouse (YahooJAPAN, thing:182233) + Mouse Skull and Brain (smcinturff, thing:3079327), CC-licensed, moved into the minnie65 frame",
  "frame": "minnie65 micrometres as vr.html's content group: x lateral, y down into the cortex, z anterior",
  "hemisphere": "right -- the stimulus was shown to the LEFT visual field (MICrONS Consortium, bioRxiv 2021.07.28.454025) and visual cortex is contralateral; the dataset's own areas agree: LM (posterior) has the lowest z, RL the highest, so +z is anterior, and with +x lateral and y down the axes are a proper right-handed set only on the right side",
  "craniotomy": "4 mm, centred on the V1/LM border, 3.5 mm lateral of the midline, ~1 mm anterior of lambda (same paper, Methods)",
  "em_volume_centre": {"ap_mm_anterior_of_lambda": AP_FROM_LAMBDA_MM, "ml_mm_right": ML_MM,
      "why": "the volume holds V1 medially and LM / AL / RL laterally (vr_v1areas_microns.json: V1 x 700, LM x 1180 z 610, RL x 1225 z 949, AL x 1437 z 800 um), i.e. it sits just anterior-medial of the V1/LM border the craniotomy was centred on; the exact stereotaxic position of the EM block is not published, so +-0.3 mm"},
  "skull_landmarks_model_units": {"bregma_z": BREGMA_Z, "lambda_z": LAMBDA_Z, "midline_y": MID_Y},
  "um_per_model_unit": round(S_UM, 1),
  "target_on_brain_model": P0.round(3).tolist(), "inward_normal_model": n_in_S.round(4).tolist(),
  "glia_limitans_at_volume_centre_um": C_N.tolist(), "glia_limitans_plane": "y = -0.0501 x - 0.0610 z + 426.9 (um), fitted to data/meninges/minnie65.json",
  "mouse_body_fit": {"skull_scale_in_head_units": K, "pitch_deg_snout_up": PITCH, "nose_y": NY, "top_offset": TOP, "rule": "upper skull inside the fur (99.5%), lower jaw and incisors allowed out, cranium as close under the fur as fits"}, "radial_axis_um": n_in_N.round(4).tolist(),
  "R_model_to_um": R.round(5).tolist(), "meshes": meta }
json.dump(place, open(f"{OUT}/placement.json", "w"), indent=1)
print(json.dumps(meta, indent=1)); print("target", P0.round(2), "normal", n_in_S.round(3), "S_UM", round(S_UM, 1))
