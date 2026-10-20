"""Pack the Colab results (src/nuc_roots/results/) into ujump.html's nucdata:
   CVB float32 per nucleus = whole-cell mesh volume (µm³, seg_m1300, NaN = none)
   CFB uint8 flags: 1 root shared by several nuclei (merge), 2 cell smaller than its nucleus,
                    4 root has no mesh in seg_m1300, 8 root found at the nucleus (automatic)
   and, for root-0 nuclei whose segment at the nucleus is a real cell (bigger than the nucleus,
   >= 50 % of the labelled voxels), that root as the nucleus's root id (HB/LB, flag 8).
   Idempotent: re-running recomputes from the results and the ORIGINAL roots (OHB/OLB)."""
import re, json, base64, glob, sys, numpy as np, pandas as pd
P = sys.argv[1] if len(sys.argv) > 1 else "ujump.html"
R = "src/nuc_roots/results/"
s = open(P, encoding="utf-8").read()
m = re.search(r'(id="nucdata">)(\{.*?\})(</script>)', s, re.S)
d = json.loads(m.group(2)); N = d["N"]
b = lambda k, t: np.frombuffer(base64.b64decode(d[k]), t)[:N].copy()
e = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
if "OHB" not in d: d["OHB"], d["OLB"] = d["HB"], d["LB"]          # the roots as MICrONS gave them
hb, lo, nid, nv = b("OHB", np.uint8), b("OLB", np.uint32), b("NB", np.uint32), b("VB", np.float32)
HI = list(d["HI"])
root = np.array([0 if h == 255 else (HI[h] << 32) + int(l) for h, l in zip(hb, lo)], dtype=np.uint64)
vol = pd.read_csv(R + "cell_volumes_m1300.csv", dtype={"root_id": str})
vol["error"] = vol["error"].fillna("")
V = {int(r): (float(v) if e_ == "" else None) for r, v, e_ in zip(vol.root_id, vol.cell_volume_um3, vol.error)}
z = pd.concat([pd.read_csv(f, dtype={"voxel_root_id": str}) for f in sorted(glob.glob(R + "zero_*.csv"))])
Z = {int(a): (int(r), float(sh)) for a, r, sh in zip(z.nucleus_id, z.voxel_root_id, z.vote_share)}
flags = np.zeros(N, np.uint8); cv = np.full(N, np.nan, np.float32); added = 0; replaced = 0
# The notebook's own per-nucleus table (second version reads the segmentation at EVERY nucleus):
# where it says the table root is outdated, its seg_m1300 root replaces it (flag 16).
import os
NR = {}
if os.path.exists(R + "nuc_roots_m1300.csv"):
    t = pd.read_csv(R + "nuc_roots_m1300.csv", dtype={"root_id": str, "root_source": str})
    NR = {int(a): (int(b), s_) for a, b, s_ in zip(t.nucleus_id, t.root_id, t.root_source) if s_ == "voxels (table root outdated)"}
for i in range(N):
    if int(nid[i]) in NR and int(root[i]) != 0:
        root[i] = np.uint64(NR[int(nid[i])][0]); flags[i] |= 16; replaced += 1
for i in range(N):
    r = int(root[i])
    if r == 0 and int(nid[i]) in Z:
        vr, sh = Z[int(nid[i])]
        vv = V.get(vr)
        if vr and sh >= 0.5 and vv is not None and vv > (nv[i] or 0):
            root[i] = np.uint64(vr); r = vr; flags[i] |= 8; added += 1
    if r == 0: continue
    if r in V and V[r] is None: flags[i] |= 4
    elif r in V:
        cv[i] = V[r]
        if V[r] < (nv[i] or 0): flags[i] |= 2
u, c = np.unique(root[root != 0], return_counts=True); shared = set(u[c > 1].tolist())
for i in range(N):
    if int(root[i]) in shared: flags[i] |= 1
nhb = np.full(N, 255, np.uint8); nlo = np.zeros(N, np.uint32)
for i in range(N):
    r = int(root[i])
    if r == 0: continue
    h = r >> 32
    if h not in HI: HI.append(h)
    nhb[i] = HI.index(h); nlo[i] = r & 0xFFFFFFFF
assert len(HI) < 255
d["HI"] = HI; d["HB"] = e(nhb); d["LB"] = e(nlo); d["CVB"] = e(cv); d["CFB"] = e(flags)
s = s[:m.start(2)] + json.dumps(d, separators=(",", ":")) + s[m.end(2):]
open(P, "w", encoding="utf-8").write(s)
print("nuclei", N, "| outdated table roots replaced", replaced, "| roots added at nucleus", added, "| with cell volume", int(np.isfinite(cv).sum()),
      "| merge", int((flags & 1 > 0).sum()), "| smaller than nucleus", int((flags & 2 > 0).sum()), "| no mesh", int((flags & 4 > 0).sum()))
