"""PVS volume v2: the pial sheet and the vessel sleeves separately, plus the TriSAM lumen in every slice.
Writes pial.bits, loops.bits, lumen.bits (packbits of (NZ,NY,NX) bool)."""
import json, os, numpy as np, time, math
nb = json.load(open("/tmp/claude-0/pvs/nb/microns_pvs_layer.ipynb"))
ns = {}
cells = [c for c in nb["cells"] if c["cell_type"] == "code"]
for c in cells[:5]:
    src = "".join(c["source"])
    src = "\n".join(("# " + l) if l.lstrip().startswith(("!", "%")) else l for l in src.splitlines())
    src = src.replace("USE_DRIVE = True", "USE_DRIVE = False")
    exec(compile(src, "cell", "exec"), ns)
g = ns; NX, NY, NZ, O, RES = g["NX"], g["NY"], g["NZ"], g["O"], g["RES"]
S, zkey, levels = g["S"], g["zkey"], g["levels"]
pial = np.zeros((NZ, NY, NX), bool); loops = np.zeros((NZ, NY, NX), bool); lumen = np.zeros((NZ, NY, NX), bool)
t0 = time.time()
# split section_mask: run it twice with the parts switched off by monkeypatching components()
comp0 = g["components"]
for n_, z in enumerate(levels):
    segs2 = S[zkey == z][:, :, :2]
    comps = comp0(segs2)
    k = min(NZ - 1, max(0, int(round((z - O[2]) / RES))))
    st = {"pial_cols": 0, "closed_by_us": 0, "open_drawn": 0, "loops": 0, "lumen_removed": 0}
    # pial part: only the long open curves
    g["components"] = lambda s, comps=comps: [c for c in comps if not c["closed"] and c["w"] > g["LONG_UM"]]
    pial[k] |= g["section_mask"](segs2, z, st)
    g["components"] = lambda s, comps=comps: [c for c in comps if c["closed"] or c["w"] <= g["LONG_UM"]]
    loops[k] |= g["section_mask"](segs2, z, st)
    if n_ % 200 == 0: print("section", n_, round(time.time() - t0), "s", flush=True)
g["components"] = comp0
for k in range(NZ):
    z = O[2] + k * RES
    ls = g["lumen_segments"](z)
    if len(ls): g["scan_fill"](ls, lumen[k])
    if k % 200 == 0: print("lumen slice", k, round(time.time() - t0), "s", flush=True)
for name, v in (("pial", pial), ("loops", loops), ("lumen", lumen)):
    np.save(name + "_bits.npy", np.packbits(v, axis=None)); print(name, int(v.sum()))
