"""DISTANCE TO THE VESSEL SURFACE, AND WHAT VESSEL IT IS (2026-10-21)
Søren: "make sure that the distance to any type of vasculature is based on the Wan et al and not only on
the vascular skeletons or my tracings. So that the distance is always to the nearest surface of the
vascular mesh. It should of course use my tracing and the tracing of Shih et al to determine what
vascular segment it is. Just like for the VR."

1. Every vertex of Wan & Wei's TriSAM vessel mesh gets a vessel class by the VR viewer's rules
   (vr.html nvAttach / nvShihPoints / nvPialLabels / nvShihTone / nvRecolour, v70-v73):
   · Søren's traced network (data/vasc_net/v1): nearest traced point within 12 µm; it counts where it
     lies within 6 µm (12 µm for his outline-traced arterioles and venules).
   · Shih et al. (How et al. 2026): nearest skeleton point within 6 µm, else the nearest large-vessel
     point within 30 µm. Their capillary branch orders are calibrated against his traced capillaries:
     median offset per 100 µm block (27 blocks if fewer than 5 points), else volume-wide. Pial vessels
     are named artery/vein by what they connect to (path along the pial skeleton to the nearest PA/AV
     or his pial arteriole/venule).
   · Consensus: his class where he traced, Shih's elsewhere. Vertices neither reached take the
     majority class of their mesh neighbours (12 passes, as the VR's grey fill); whole untraced vessels
     stay unknown.
2. Every nucleus (and own-data standalone point) gets the distance from its centre to the nearest point
   of the mesh SURFACE (point-to-triangle, not to a vertex or a centreline) and the class there.

Usage: python vessel_surface.py vessel_inputs.zip data/vasc_net/v1 ujump.html out_dir
"""
import sys, os, io, json, zipfile, struct, heapq, time
import numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
import re, base64

ZIP, NET, HTML, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
def log(*a): print(f"[{time.time()-T0:6.0f}s]", *a, flush=True)
z = zipfile.ZipFile(ZIP)

# ── TriSAM mesh ────────────────────────────────────────────────────────────────────────────
b = z.read("trisam_mesh.bin"); n = struct.unpack_from("<I", b)[0]
V = np.frombuffer(b, np.float32, n * 3, 4).reshape(-1, 3).astype(np.float64) / 1000.0
F = np.frombuffer(b, np.uint32, offset=4 + n * 12).reshape(-1, 3).astype(np.int64)
log("TriSAM", n, "vertices", len(F), "triangles; bbox", V.min(0).round(0), V.max(0).round(0))

# ── Søren's traced network ─────────────────────────────────────────────────────────────────
meta = json.load(open(os.path.join(NET, "meta.json"), encoding="utf-8"))
buf = open(os.path.join(NET, "net.bin"), "rb").read()
nn, ne, nd = meta["n"], meta["e"], meta["d"]; o = 0
o += nn * 12; o += nn * 4; o += nn * 4
cat = np.frombuffer(buf, np.uint8, nn, o); o += nn + ((4 - nn % 4) % 4)
o += ne * 8
Dq = np.frombuffer(buf, np.uint16, nd * 3, o).reshape(-1, 3); o += nd * 6 + ((4 - (nd * 6) % 4) % 4)
own = np.frombuffer(buf, np.uint32, nd, o)
cats = meta["cats"]
his_xyz = Dq.astype(np.float64) * meta["quant"]
his_cn = np.array(cats)[cat[own]]
log("Søren's tracing:", nd, "points,", dict(zip(*np.unique(his_cn, return_counts=True))))

STEPS = ["art", "acap1", "acap2", "acap3", "vcap3", "vcap2", "vcap1", "ven"]
def tone_of(cn): return "art" if cn in ("pial_art", "pa") else "ven" if cn in ("av", "pial_ven") else cn
his_tone = np.array([STEPS.index(tone_of(c)) for c in his_cn], np.float64)

# ── Shih et al. ────────────────────────────────────────────────────────────────────────────
def skel(slug, bo=False):
    b = z.read("shih/" + slug + ".skel"); nv, ne_ = struct.unpack_from("<II", b)
    pos = np.frombuffer(b, np.float32, nv * 3, 8).reshape(-1, 3).astype(np.float64) / 1000.0
    E = np.frombuffer(b, np.uint32, ne_ * 2, 8 + nv * 12).reshape(-1, 2)
    out = {"pos": pos, "E": E, "nv": nv}
    if bo:
        a0 = 8 + nv * 12 + ne_ * 8
        names = None
        try:
            info = json.loads(z.read("shih/" + slug + ".info"))
            names = [a["id"] for a in info.get("vertex_attributes", [])]
        except KeyError: pass
        # attributes in the info's order; the VR reads ACT at the 2nd and CVT at the 3rd slot
        ia = names.index("BranchOrder_ACT") if names and "BranchOrder_ACT" in names else 1
        ic = names.index("BranchOrder_CVT") if names and "BranchOrder_CVT" in names else 2
        out["act"] = np.frombuffer(b, np.float32, nv, a0 + nv * 4 * ia).astype(np.float64)
        out["cvt"] = np.frombuffer(b, np.float32, nv, a0 + nv * 4 * ic).astype(np.float64)
        out["attrs"] = names
    return out

# fixed classes: tone and the µJump class name
FIXED = {"skelFinal_PAs_v7_connected": (0, "pa"), "skelFinal_terminalPAs_v7": (0, "pa"),
         "skelFinal_ACTs_v7": (1, "acap1"), "skelFinal_CVTs_v7": (6, "vcap1"), "skelFinal_deepCVTs_v7": (6, "vcap1"),
         "skelFinal_AVs_v7_connected": (7, "av"), "skelFinal_terminalAVs_v7": (7, "av"),
         "skelFinal_PCVs_v7": (7, "pcv"), "skelFinal_terminalPCVs_v7": (7, "pcv")}
P_xyz, P_tone, P_cls, P_act, P_cvt = [], [], [], [], []
seeds = []
for slug, (t, c) in FIXED.items():
    S = skel(slug); m = S["nv"]
    P_xyz.append(S["pos"]); P_tone.append(np.full(m, t, float)); P_cls.append(np.full(m, c, object))
    P_act.append(np.full(m, np.nan)); P_cvt.append(np.full(m, np.nan))
    if t in (0, 7): seeds.append(np.c_[S["pos"], np.full(m, t)])
    log("Shih", slug, m, "points")
# pial vessels named by connection (nvPialLabels)
for t, c in (("art", 0), ("ven", 7)):
    sel = np.array([tone_of(x) == t for x in his_cn])
    seeds.append(np.c_[his_xyz[sel], np.full(sel.sum(), c)])
seeds = np.vstack(seeds)
BB = skel("skelFinal_BBs_v7"); Xb = BB["pos"]; nb = BB["nv"]
d0, j0 = cKDTree(seeds[:, :3]).query(Xb, distance_upper_bound=10.0)
seed_ok = np.isfinite(d0)
w = np.linalg.norm(Xb[BB["E"][:, 0]] - Xb[BB["E"][:, 1]], axis=1)
# multi-source Dijkstra: a virtual source joined to each seed point with its seed distance
src = nb
rows = np.r_[BB["E"][:, 0], BB["E"][:, 1], np.full(seed_ok.sum(), src)]
cols = np.r_[BB["E"][:, 1], BB["E"][:, 0], np.where(seed_ok)[0]]
ww = np.r_[w, w, d0[seed_ok] + 1e-9]
G = coo_matrix((ww, (rows, cols)), shape=(nb + 1, nb + 1)).tocsr()
dist_p, pred = dijkstra(G, directed=True, indices=src, return_predecessors=True)
# label = the seed each path started from: walk predecessors back to the first node after the source
lab = np.full(nb, -1)
first = np.full(nb + 1, -1); first[np.where(seed_ok)[0]] = np.where(seed_ok)[0]
order = np.argsort(dist_p[:nb])
for i in order:
    if not np.isfinite(dist_p[i]): break
    p = pred[i]
    first[i] = i if p == src else first[p]
reach = first[:nb] >= 0
lab[reach] = seeds[j0[first[:nb][reach]], 3].astype(int)
pa = lab >= 0
P_xyz.append(Xb[pa]); P_tone.append(lab[pa].astype(float))
P_cls.append(np.where(lab[pa] == 0, "pial_art", "pial_ven").astype(object))
P_act.append(np.full(pa.sum(), np.nan)); P_cvt.append(np.full(pa.sum(), np.nan))
log("Shih pial:", nb, "points;", int((lab == 0).sum()), "artery,", int((lab == 7).sum()), "vein,", int((lab < 0).sum()), "unconnected")
CB = skel("skelFinal_v7_branch_order", bo=True)
log("Shih capillary bed:", CB["nv"], "points; attributes", CB["attrs"])
P_xyz.append(CB["pos"]); P_tone.append(np.full(CB["nv"], np.nan)); P_cls.append(np.full(CB["nv"], None, object))
P_act.append(np.where(CB["act"] > -1e8, CB["act"], np.nan)); P_cvt.append(np.where(CB["cvt"] > -1e8, CB["cvt"], np.nan))
P_xyz = np.vstack(P_xyz); P_tone = np.concatenate(P_tone); P_cls = np.concatenate(P_cls)
P_act = np.concatenate(P_act); P_cvt = np.concatenate(P_cvt)
big = np.isfinite(P_tone)
tree_all, tree_big = cKDTree(P_xyz), cKDTree(P_xyz[big]); big_idx = np.where(big)[0]

# calibration against his traced capillaries (within 3 µm)
cap = np.array([c[1:4] == "cap" for c in his_cn])
d3, j3 = tree_all.query(his_xyz[cap], distance_upper_bound=3.0)
hc = his_cn[cap]; hx = his_xyz[cap]
anc = []
for k in np.where(np.isfinite(d3))[0]:
    j = j3[k]; side, order = hc[k][0], int(hc[k][-1])
    if side == "a" and np.isfinite(P_act[j]): anc.append((hx[k], "a", P_act[j] - order, order, P_act[j]))
    if side == "v" and np.isfinite(P_cvt[j]): anc.append((hx[k], "v", P_cvt[j] - order, order, P_cvt[j]))
def med(a): a = sorted(a); return a[len(a) >> 1] if a else None
dA = [a[2] for a in anc if a[1] == "a"]; dV = [a[2] for a in anc if a[1] == "v"]
offA, offV = med(dA) or 0, med(dV) or 0
blocks = {}
def bk(x, sd): return (int(np.floor(x[0] / 100)), int(np.floor(x[1] / 100)), int(np.floor(x[2] / 100)), sd)
for a in anc: blocks.setdefault(bk(a[0], a[1]), []).append(a[2])
memo = {}
def off_at(x, sd):
    k = bk(x, sd)
    if k in memo: return memo[k]
    l = blocks.get(k, [])
    if len(l) < 5:
        l = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1): l += blocks.get((k[0] + dx, k[1] + dy, k[2] + dz, sd), [])
    o = med(l) if len(l) >= 5 else (offA if sd == "a" else offV)
    memo[k] = o; return o
within = lambda a, o: round(100 * sum(abs(d - o) <= 1 for d in a) / len(a)) if a else None
loc = lambda sd: (round(100 * np.mean([abs(a[4] - off_at(a[0], sd) - a[3]) <= 1 for a in anc if a[1] == sd])) if any(a[1] == sd for a in anc) else None)
CAL = {"offA": offA, "offV": offV, "nA": len(dA), "nV": len(dV), "agreeA": within(dA, offA), "agreeV": within(dV, offV),
       "agreeLocA": loc("a"), "agreeLocV": loc("v")}
log("calibration", CAL)

def shih_tone(j):
    """nvShihTone, plus the class it stands for."""
    if np.isfinite(P_tone[j]): return P_tone[j], P_cls[j]
    x = P_xyz[j]
    a = P_act[j] - off_at(x, "a") if np.isfinite(P_act[j]) else None
    v = P_cvt[j] - off_at(x, "v") if np.isfinite(P_cvt[j]) else None
    if a is None and v is None: return None, None
    art = v is None or (a is not None and a <= v)
    if art and a <= 3: t = max(1, a); return t, "acap%d" % int(round(t))
    if not art and v <= 3: t = 7 - max(1, v); return t, "vcap%d" % int(round(max(1, v)))
    return 3.5, "mid"

# ── each TriSAM vertex ─────────────────────────────────────────────────────────────────────
dh, jh = cKDTree(his_xyz).query(V, distance_upper_bound=12.0)
dn, jn = tree_all.query(V, distance_upper_bound=6.0)
db, jb = tree_big.query(V, distance_upper_bound=30.0)
CLS = ["pial_art", "pa", "acap1", "acap2", "acap3", "mid", "vcap3", "vcap2", "vcap1", "av", "pcv", "pial_ven"]
CI = {c: i for i, c in enumerate(CLS)}
vc = np.full(n, -1, np.int16)            # class index per vertex
vsrc = np.zeros(n, np.uint8)             # 1 his, 2 Shih, 3 filled
both = agree = 0
cache = {}
for v in range(n):
    hisOk = np.isfinite(dh[v]) and dh[v] <= (12 if his_tone[jh[v]] in (0, 7) else 6)
    st = sc = None
    if np.isfinite(dn[v]):
        j = jn[v]
        if j not in cache: cache[j] = shih_tone(j)
        st, sc = cache[j]
    if st is None and np.isfinite(db[v]):
        j = big_idx[jb[v]]; st, sc = P_tone[j], P_cls[j]
    if hisOk:
        if st is not None:
            both += 1; agree += abs(his_tone[jh[v]] - st) <= 1
        vc[v] = CI[his_cn[jh[v]]]; vsrc[v] = 1
    elif st is not None:
        vc[v] = CI[sc]; vsrc[v] = 2
log("vertices:", int((vsrc == 1).sum()), "his,", int((vsrc == 2).sum()), "Shih,", int((vc < 0).sum()), "neither; agreement where both",
    round(100 * agree / max(1, both)), "%")
# grey fill: majority class of mesh neighbours (12 passes, seams welded at 0.05 µm)
key = np.round(V * 20).astype(np.int64)
_, weld = np.unique(key, axis=0, return_inverse=True); weld = weld.ravel()
E2 = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]
E2 = weld[E2]; E2 = E2[E2[:, 0] != E2[:, 1]]
nw = weld.max() + 1
wc = np.full(nw, -1, np.int16)
np.maximum.at(wc, weld, vc)              # a welded vertex takes any label one of its copies has
A = np.r_[E2[:, 0], E2[:, 1]]; B = np.r_[E2[:, 1], E2[:, 0]]
filled = 0
for _ in range(12):
    lb = wc[B]; ok = (wc[A] < 0) & (lb >= 0)
    if not ok.any(): break
    cnt = coo_matrix((np.ones(ok.sum()), (A[ok], lb[ok])), shape=(nw, len(CLS))).toarray()
    tgt = np.where((wc < 0) & (cnt.sum(1) > 0))[0]
    wc[tgt] = cnt[tgt].argmax(1); filled += len(tgt)
vc2 = wc[weld]
vsrc[(vc < 0) & (vc2 >= 0)] = 3; vc = vc2
log("filled", int((vsrc == 3).sum()), "vertices; unknown", int((vc < 0).sum()), "(", round(100 * (vc < 0).mean(), 1), "% )")

# ── query points ───────────────────────────────────────────────────────────────────────────
s = open(HTML, encoding="utf-8").read()
d = json.loads(re.search(r'id="nucdata">(\{.*?\})</script>', s, re.S).group(1)); N = d["N"]
bb_ = lambda dd, k, t, m: np.frombuffer(base64.b64decode(dd[k]), t)[:m]
QN = np.stack([bb_(d, "XB", np.uint32, N) * .004, bb_(d, "YB", np.uint32, N) * .004, bb_(d, "ZB", np.uint16, N) * .04], 1)
od = json.loads(re.search(r'id="owndata">(\{.*?\})</script>', s, re.S).group(1))["STANDALONE"]; SN = od["N"]
QS = np.stack([bb_(od, "X", np.uint32, SN) * .004, bb_(od, "Y", np.uint32, SN) * .004, bb_(od, "Z", np.uint16, SN) * .04], 1)
Q = np.vstack([QN, QS])

# point-to-triangle distance over the triangles around the 8 nearest vertices
order_t = np.argsort(np.r_[F[:, 0], F[:, 1], F[:, 2]], kind="stable")
vt_v = np.r_[F[:, 0], F[:, 1], F[:, 2]][order_t]; vt_t = np.tile(np.arange(len(F)), 3)[order_t]
start = np.searchsorted(vt_v, np.arange(n + 1))
def closest_on_tri(p, a, b, c):
    """Ericson, Real-Time Collision Detection 5.1.5, vectorised. Returns closest points."""
    ab, ac, ap = b - a, c - a, p - a
    d1 = (ab * ap).sum(1); d2 = (ac * ap).sum(1)
    bp = p - b; d3 = (ab * bp).sum(1); d4 = (ac * bp).sum(1)
    cp = p - c; d5 = (ab * cp).sum(1); d6 = (ac * cp).sum(1)
    va = d3 * d6 - d5 * d4; vb = d5 * d2 - d1 * d6; vc_ = d1 * d4 - d3 * d2
    den = va + vb + vc_; den = np.where(np.abs(den) < 1e-18, 1e-18, den)
    v_ = vb / den; w_ = vc_ / den
    out = a + ab * v_[:, None] + ac * w_[:, None]
    m = (d1 <= 0) & (d2 <= 0); out[m] = a[m]
    m = (d3 >= 0) & (d4 <= d3); out[m] = b[m]
    m = (d6 >= 0) & (d5 <= d6); out[m] = c[m]
    m = (vc_ <= 0) & (d1 >= 0) & (d3 <= 0) & ~((d1 <= 0) & (d2 <= 0)) & ~((d3 >= 0) & (d4 <= d3))
    t_ = d1 / np.where(d1 - d3 == 0, 1e-18, d1 - d3); out[m] = (a + ab * t_[:, None])[m]
    m = (vb <= 0) & (d2 >= 0) & (d6 <= 0) & ~((d1 <= 0) & (d2 <= 0)) & ~((d6 >= 0) & (d5 <= d6))
    t_ = d2 / np.where(d2 - d6 == 0, 1e-18, d2 - d6); out[m] = (a + ac * t_[:, None])[m]
    m = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0) & ~((d3 >= 0) & (d4 <= d3)) & ~((d6 >= 0) & (d5 <= d6))
    t_ = (d4 - d3) / np.where((d4 - d3) + (d5 - d6) == 0, 1e-18, (d4 - d3) + (d5 - d6)); out[m] = (b + (c - b) * t_[:, None])[m]
    return out
vtree = cKDTree(V)
dv, jv = vtree.query(Q, k=8, workers=-1)
qd = np.full(len(Q), np.inf); qv = np.full(len(Q), -1)
pairs_q, pairs_t = [], []
for k in range(8):
    vv = jv[:, k]; s0, s1 = start[vv], start[vv + 1]
    L = s1 - s0
    qi = np.repeat(np.arange(len(Q)), L)
    ti = vt_t[np.repeat(s0, L) + (np.arange(L.sum()) - np.repeat(np.cumsum(L) - L, L))]
    pairs_q.append(qi); pairs_t.append(ti)
pq = np.concatenate(pairs_q); pt = np.concatenate(pairs_t)
key2 = pq * len(F) + pt; _, u = np.unique(key2, return_index=True); pq, pt = pq[u], pt[u]
for c0 in range(0, len(pq), 4_000_000):
    a_, t_ = pq[c0:c0 + 4_000_000], pt[c0:c0 + 4_000_000]
    cpt = closest_on_tri(Q[a_], V[F[t_, 0]], V[F[t_, 1]], V[F[t_, 2]])
    dd = np.linalg.norm(Q[a_] - cpt, axis=1)
    # nearest corner of that triangle carries the class
    corners = F[t_]; cd = np.linalg.norm(V[corners] - cpt[:, None, :], axis=2); cv = corners[np.arange(len(t_)), cd.argmin(1)]
    better = dd < qd[a_]
    # resolve duplicates within the chunk: sort by distance, last write wins for the smallest
    o_ = np.argsort(-dd); a2, d2_, v2 = a_[o_], dd[o_], cv[o_]
    m_ = d2_ < qd[a2]
    qd[a2[m_]] = d2_[m_]; qv[a2[m_]] = v2[m_]
log("surface distance: median", round(float(np.median(qd)), 2), "µm; vs nearest vertex",
    round(float(np.median(dv[:, 0])), 2), "µm; max saving", round(float((dv[:, 0] - qd).max()), 2), "µm")
qc = vc[qv]
FINE_OLD = ["3rd-order arterial capillary", "2nd-order venous capillary", "penetrating arteriole", "ascending venule",
            "1st-order arterial capillary", "pial arteriole", "pial venule", "3rd-order venous capillary",
            "2nd-order arterial capillary", "1st-order venous capillary"]
FINE = FINE_OLD + ["capillary beyond the 3rd order (mid-bed)", "principal cortical venule"]
NAME = {"pial_art": "pial arteriole", "pa": "penetrating arteriole", "acap1": "1st-order arterial capillary",
        "acap2": "2nd-order arterial capillary", "acap3": "3rd-order arterial capillary", "mid": FINE[10],
        "vcap3": "3rd-order venous capillary", "vcap2": "2nd-order venous capillary", "vcap1": "1st-order venous capillary",
        "av": "ascending venule", "pcv": FINE[11], "pial_ven": "pial venule"}
cls2fine = np.array([FINE.index(NAME[c]) for c in CLS] + [255], np.uint8)   # index -1 -> 255
qf = cls2fine[np.where(qc < 0, len(CLS), qc)]
qs = vsrc[qv]
dist_u = np.minimum(np.rint(qd * 10), 65534).astype(np.uint16)
np.savez_compressed(os.path.join(OUT, "vessel_surface.npz"), N=N, SN=SN, dist01=dist_u, fine=qf, src=qs,
                    vclass=vc, vsrc=vsrc)
summ = {"made": time.strftime("%Y-%m-%d"), "trisam_vertices": int(n), "calibration": CAL,
        "vertices": {"his": int((vsrc == 1).sum()), "shih": int((vsrc == 2).sum()), "filled": int((vsrc == 3).sum()), "unknown": int((vc < 0).sum())},
        "agree_where_both_pct": round(100 * agree / max(1, both)),
        "points": int(len(Q)), "median_um": round(float(np.median(qd)), 2),
        "within_um": {str(t): int((qd <= t).sum()) for t in (2, 5, 10, 20, 50)},
        "fine_counts_within_10um": {FINE[i] if i < 255 else "unknown": int(((qf == i) & (qd <= 10)).sum()) for i in np.unique(qf)},
        "FINE_NAMES": FINE}
json.dump(summ, open(os.path.join(OUT, "vessel_surface_summary.json"), "w"), indent=1, ensure_ascii=False)
log(json.dumps(summ, ensure_ascii=False)[:2000])
