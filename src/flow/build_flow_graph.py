"""Blood-flow network for the VR viewer's stroke model (section 30), 2026-10-22.

Input: Shih et al.'s (How et al. 2026) MICrONS vascular skeletons (gs://microns_vascular_skeleton,
segment 3 of each skeleton layer -- the same files the viewer reads; here from vessel_inputs.zip made by
src/vessel_surface/microns_vessel_inputs.ipynb) and Søren's traced network (data/vasc_net/v1).

* skelFinal_v7_branch_order is the WHOLE vasculature as one connected skeleton (capillaries AND the
  large vessels, with a radius at every point); the other files label its points: within 3 µm of a
  penetrating-arteriole point it is a PA, etc. Capillary points take their order from the branch
  orders (arterial side 1-3, venous side 3-1, the rest "mid"). Pial points are artery or vein by
  path distance along the pial skeleton to a PA/ACT or an AV/PCV/CVT (as the viewer does).
* Large-vessel radius: Søren's traced lumen (half the short axis of his outline) within 12 µm, else
  Shih's radius x (median ratio of the two where both exist). Capillaries: Shih's radius.
* Søren's pial vessels and penetrating vessels that Shih's skeleton does not reach (>10 µm away) are
  added with his own edges, and joined to the nearest Shih point where his piece comes within 10 µm.
* Open ends (degree 1): of a pial artery or a PA -- the vessel continues outside the data -- an inflow
  at an arterial pressure that rises with diameter (45 + 0.25*D mmHg, at most 70, the shape of the pial
  arteriole pressures collected by Schmid et al. 2017 PLoS Comput Biol 13:e1005392); of a vein (pial, AV,
  PCV) an outflow at 10-12 mmHg (Schmid et al.: pial venules 10 mmHg); of a capillary within 20 µm of the
  volume's faces, a pressure for its order (35 mmHg 1st arterial ... 15 mmHg 1st venous); elsewhere closed.
* Points are collapsed to chains between junctions; the viewer solves Poiseuille flow on the chains.

Output: data/flow/v1/flow.bin + flow.json (layout in flow.json). Also reports the check against the
endothelial nucleus->centriole vectors (core/vr_vectors_microns.json): the centriole should lie upstream
of the nucleus (Golgi/centrosome polarity against flow, Franco et al. 2015 PLoS Biol 13:e1002125).

Usage: python build_flow_graph.py vessel_inputs.zip ../../data/vasc_net/v1 ../../core/vr_vectors_microns.json ../../data/flow/v1
"""
import sys, os, io, json, zipfile, heapq, time
import numpy as np
from scipy.spatial import cKDTree
import scipy.sparse as sp, scipy.sparse.linalg as spl

ZIP, HIS, VEC, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
Z = zipfile.ZipFile(ZIP)
def skel(slug):
    b = Z.read("shih/" + slug + ".skel"); info = json.loads(Z.read("shih/" + slug + ".info"))
    nv, ne = np.frombuffer(b, np.uint32, 2)
    pos = np.frombuffer(b, np.float32, nv * 3, 8).reshape(-1, 3).astype(np.float64) / 1000
    e = np.frombuffer(b, np.uint32, ne * 2, 8 + nv * 12).reshape(-1, 2).astype(np.int64)
    a0 = 8 + nv * 12 + ne * 8
    att = {va["id"]: np.frombuffer(b, np.float32, nv, a0 + k * nv * 4).astype(np.float64) for k, va in enumerate(info["vertex_attributes"])}
    return pos, e, att
CLS = ["a1", "a2", "a3", "mid", "v3", "v2", "v1", "pa", "act", "cvt", "av", "pcv", "part", "pven", "pial", "unk"]
CI = {k: i for i, k in enumerate(CLS)}
t0 = time.time()
P, E, a = skel("skelFinal_v7_branch_order"); N = len(P)
R = a["radius"].copy(); A = a["BranchOrder_ACT"]; V = a["BranchOrder_CVT"]
C = np.full(N, CI["unk"], np.int64)
for i in range(N):
    A_ = A[i] if A[i] >= 0 else None; V_ = V[i] if V[i] >= 0 else None
    if A_ is None and V_ is None: continue
    if V_ is None or (A_ is not None and A_ <= V_): C[i] = CI["a1" if A_ <= 1 else "a2" if A_ == 2 else "a3" if A_ == 3 else "mid"]
    else: C[i] = CI["v1" if V_ <= 1 else "v2" if V_ == 2 else "v3" if V_ == 3 else "mid"]
LAB = [("skelFinal_PAs_v7_connected", "pa"), ("skelFinal_terminalPAs_v7", "pa"), ("skelFinal_ACTs_v7", "act"), ("skelFinal_CVTs_v7", "cvt"),
       ("skelFinal_deepCVTs_v7", "cvt"), ("skelFinal_AVs_v7_connected", "av"), ("skelFinal_terminalAVs_v7", "av"), ("skelFinal_PCVs_v7", "pcv"),
       ("skelFinal_terminalPCVs_v7", "pcv"), ("skelFinal_BBs_v7", "pial")]
best = np.full(N, 3.0); lab = np.full(N, -1)
for s, k in LAB:
    q, _, _ = skel(s); d, _ = cKDTree(q).query(P, distance_upper_bound=3)
    m = d < best; best[m] = d[m]; lab[m] = CI[k]
m = (C == CI["unk"]) & (lab >= 0); C[m] = lab[m]
# Søren's network
meta = json.load(open(os.path.join(HIS, "meta.json"))); buf = open(os.path.join(HIS, "net.bin"), "rb").read()
n, e, d_ = meta["n"], meta["e"], meta["d"]; o = 0
hp = np.frombuffer(buf, np.float32, n * 3, o).reshape(-1, 3).astype(np.float64); o += n * 12
hr = np.frombuffer(buf, np.float32, n, o).astype(np.float64); o += n * 4; o += n * 4
hc = np.frombuffer(buf, np.uint8, n, o).astype(np.int64); o += n + ((4 - n % 4) % 4)
hE = np.frombuffer(buf, np.uint32, e * 2, o).reshape(-1, 2).astype(np.int64)
hcat = np.array(meta["cats"])[hc]
HMAP = {"pial_art": "part", "pa": "pa", "av": "av", "pial_ven": "pven", "acap1": "a1", "acap2": "a2", "acap3": "a3", "vcap1": "v1", "vcap2": "v2", "vcap3": "v3"}
# large-vessel radius from his outlines
BIGC = [CI[k] for k in ["pa", "act", "cvt", "av", "pcv", "part", "pven", "pial", "unk"]]
big = np.isin(C, BIGC)
hbig = np.isin(hcat, ["pial_art", "pa", "av", "pial_ven"])
dd, jj = cKDTree(hp[hbig]).query(P[big], distance_upper_bound=12)
ok = np.isfinite(dd) & (R[big] > 0)
fac = float(np.median(hr[hbig][jj[ok]] / R[big][ok]))
ok = np.isfinite(dd)
Rb = np.where(R[big] > 0, R[big] * fac, 4.0); Rb[ok] = hr[hbig][jj[ok]]; R[big] = Rb
# his vessels Shih does not reach
dS, jS = cKDTree(P).query(hp)
addm = (dS > 10) & np.isin(hcat, ["pial_art", "pa", "av", "pial_ven"])
idx = np.full(n, -1); idx[addm] = N + np.arange(addm.sum())
P = np.vstack([P, hp[addm]]); R = np.r_[R, hr[addm]]; C = np.r_[C, [CI[HMAP[c]] for c in hcat[addm]]]
src = np.r_[np.zeros(N, np.int64), np.ones(addm.sum(), np.int64)]
extra = []
for x, y in hE:
    if idx[x] >= 0 and idx[y] >= 0: extra.append((idx[x], idx[y]))
    elif idx[x] >= 0 and dS[y] <= 10: extra.append((idx[x], jS[y]))
    elif idx[y] >= 0 and dS[x] <= 10: extra.append((idx[y], jS[x]))
if extra: E = np.vstack([E, np.array(extra)])
N = len(P)
E = E[E[:, 0] != E[:, 1]]; E = np.unique(np.sort(E, 1), axis=0)
# pial artery / vein along the pial skeleton
adj = [[] for _ in range(N)]
for x, y in E: adj[x].append(y); adj[y].append(x)
pial = np.where(C == CI["pial"])[0]; ip = set(pial.tolist())
dist = np.full(N, np.inf); pl = np.full(N, -1); h = []
for i in pial:
    for j in adj[i]:
        if C[j] in (CI["pa"], CI["act"], CI["part"]): dist[i] = 0; pl[i] = 0; h.append((0.0, i))
        elif C[j] in (CI["av"], CI["pcv"], CI["cvt"], CI["pven"]): dist[i] = 0; pl[i] = 1; h.append((0.0, i))
heapq.heapify(h)
while h:
    dv, i = heapq.heappop(h)
    if dv > dist[i]: continue
    for j in adj[i]:
        if j not in ip: continue
        w = np.linalg.norm(P[i] - P[j])
        if dv + w < dist[j]: dist[j] = dv + w; pl[j] = pl[i]; heapq.heappush(h, (dv + w, j))
C[pial[pl[pial] == 0]] = CI["part"]; C[pial[pl[pial] == 1]] = CI["pven"]
CAPC = [CI[k] for k in ["a1", "a2", "a3", "mid", "v3", "v2", "v1"]]
R = np.where(R > 0, R, np.where(np.isin(C, CAPC), 2.0, 4.0)); R = np.clip(R, 1.0, 30.0)
# boundary
deg = np.bincount(E.ravel(), minlength=N)
lo, hi = P[src == 0].min(0), P[src == 0].max(0)
nearface = np.any((P - lo < 20) | (hi - P < 20), axis=1)
PB = np.full(N, np.nan)
oe = deg == 1
art = oe & np.isin(C, [CI["part"], CI["pa"]]); PB[art] = np.clip(45 + 0.25 * 2 * R[art], 45, 70)
LADDER = {"act": 38, "a1": 35, "a2": 32, "a3": 29, "mid": 25, "v3": 21, "v2": 18, "v1": 15, "cvt": 15}
for k, v in LADDER.items(): PB[oe & nearface & (C == CI[k])] = v
for k, v in {"av": 12, "pcv": 11, "pven": 10, "pial": 10}.items(): PB[oe & (C == CI[k])] = v
bc = np.where(np.isfinite(PB))[0]
# chains between junctions (degree != 2, or a boundary point)
jun = (deg != 2) | np.isfinite(PB)
seen = np.zeros(len(E), bool)
eid = {}
for k, (x, y) in enumerate(E): eid.setdefault(x, []).append((y, k)); eid.setdefault(y, []).append((x, k))
chains = []
def walk(a, b, k):
    path = [a, b]; seen[k] = True; prev, cur = a, b
    while not jun[cur]:
        nxt = [(y, kk) for (y, kk) in eid[cur] if not seen[kk]]
        if not nxt: break
        y, kk = nxt[0]; seen[kk] = True; path.append(y); prev, cur = cur, y
    return path
for s in np.where(jun)[0]:
    for (y, k) in eid.get(s, []):
        if not seen[k]: chains.append(walk(s, y, k))
# loops with no junction
for k in np.where(~seen)[0]:
    x, y = E[k]; jun[x] = True; chains.append(walk(x, y, k))
J = np.where(jun)[0]
print("points", N, "edges", len(E), "junctions", len(J), "chains", len(chains), "boundary", len(bc), "radius factor", round(fac, 2), "added his points", int(addm.sum()), "t", round(time.time() - t0, 1))
# check: solve here, compare with centrioles
CAPD = {k: CI[k] for k in CLS}
def visc(D, H=0.3):
    m45 = 220 * np.exp(-1.3 * D) + 3.2 - 2.44 * np.exp(-0.06 * D ** 0.645)
    c = (0.8 + np.exp(-0.075 * D)) * (-1 + 1 / (1 + 1e-11 * D ** 12)) + 1 / (1 + 1e-11 * D ** 12)
    return 1 + (m45 - 1) * ((1 - H) ** c - 1) / ((1 - 0.45) ** c - 1)
L = np.maximum(np.linalg.norm(P[E[:, 0]] - P[E[:, 1]], axis=1), 0.3); r = np.minimum(R[E[:, 0]], R[E[:, 1]])
G = np.pi * r ** 4 / (8 * 1.2e-3 * visc(2 * r) * L)
Lp = sp.coo_matrix((np.r_[G, G, -G, -G], (np.r_[E[:, 0], E[:, 1], E[:, 0], E[:, 1]], np.r_[E[:, 0], E[:, 1], E[:, 1], E[:, 0]])), shape=(N, N)).tocsr()
isb = np.isfinite(PB); nc, cl = sp.csgraph.connected_components(Lp != 0, directed=False)
hb = np.zeros(nc, bool); hb[cl[isb]] = True; fr = np.where(hb[cl] & ~isb)[0]
p = np.full(N, np.nan); p[bc] = PB[bc] * 133.322
p[fr] = spl.spsolve(Lp[fr][:, fr].tocsc(), -(Lp[fr][:, bc] @ p[bc]))
Q = np.nan_to_num(G * (p[E[:, 0]] - p[E[:, 1]])); vel = np.abs(Q) / (np.pi * r ** 2) / 1000
vv = json.load(open(VEC)); T = vv["types"]; cent = [x for x in vv["cent"] if T[x[1]] == "Endothelial cell"]
nuc = np.array([x[2:5] for x in cent]); cen = np.array([x[5:8] for x in cent])
mid = (P[E[:, 0]] + P[E[:, 1]]) / 2; dm, jm = cKDTree(mid).query(nuc, distance_upper_bound=10)
cs = []; ccls = []
for i in np.where(np.isfinite(dm))[0]:
    k = jm[i]
    if vel[k] < 1e-4: continue
    t = P[E[k, 1]] - P[E[k, 0]]; nt = np.linalg.norm(t)
    if nt < 1e-6: continue
    t /= nt; t = -t if Q[k] < 0 else t
    v = cen[i] - nuc[i]; nv = np.linalg.norm(v)
    if nv < 0.5: continue
    cs.append(np.dot(v, t) / nv); ccls.append(CLS[C[E[k, 0]]])
cs = np.array(cs); ccls = np.array(ccls)
check = {"n": int(len(cs)), "upstream": round(float(np.mean(cs < -0.3)), 3), "downstream": round(float(np.mean(cs > 0.3)), 3),
         "by_class": {k: [int(np.sum(ccls == k)), round(float(np.mean(cs[ccls == k] < -0.3)), 2), round(float(np.mean(cs[ccls == k] > 0.3)), 2)] for k in np.unique(ccls)}}
vstat = {k: round(float(np.median(vel[(C[E[:, 0]] == CI[k]) & (vel > 0)])), 3) for k in CLS if np.any((C[E[:, 0]] == CI[k]) & (vel > 0))}
print("centriole check", json.dumps(check)); print("median speed mm/s", vstat)
# write
q = 0.025; org = np.floor(P.min(0)) - 1
Pq = np.round((P - org) / q).astype(np.uint16)
Rq = np.clip(np.round(R * 8), 1, 255).astype(np.uint8)
off = np.zeros(len(chains) + 1, np.uint32); off[1:] = np.cumsum([len(c) for c in chains])
cp = np.concatenate([np.array(c, np.uint32) for c in chains])
bcp = (np.round(PB[bc] * 100)).astype(np.uint16)
parts = [("pos", Pq), ("rad", Rq), ("cls", C.astype(np.uint8)), ("src", src.astype(np.uint8)), ("chainOff", off), ("chainPts", cp), ("bcIdx", bc.astype(np.uint32)), ("bcP", bcp)]
layout = []; o = 0; blob = io.BytesIO()
for name, arr in parts:
    pad = (-o) % 4; blob.write(b"\0" * pad); o += pad
    b = arr.tobytes(); layout.append({"name": name, "dtype": str(arr.dtype), "offset": o, "count": int(arr.size)}); blob.write(b); o += len(b)
open(os.path.join(OUT, "flow.bin"), "wb").write(blob.getvalue())
json.dump({"version": 1, "made": "2026-10-22", "n": int(N), "chains": len(chains), "classes": CLS, "quant": q, "origin": org.tolist(), "radius_unit": 0.125,
           "pressure_unit_mmHg": 0.01, "layout": layout, "radius_factor_his_over_shih": round(fac, 3), "check_centrioles": check, "median_speed_mm_s": vstat,
           "source": __doc__.strip().split("\n\n")[0]}, open(os.path.join(OUT, "flow.json"), "w"), indent=1)
print("wrote", os.path.getsize(os.path.join(OUT, "flow.bin")) / 1e6, "MB")
