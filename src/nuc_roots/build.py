"""nucleus id -> seg_m1300 root id, from ujump.html's embedded nucdata (whose root ids were checked
against seg_m1300 voxels at the nucleus centroids, 2026-09-10). Output: nuc2root.bin =
uint32 n, then n uint32 nucleus ids (sorted), n uint32 high words, n uint32 low words; root 0 = none."""
import re, json, base64, numpy as np, sys, os
src = sys.argv[1] if len(sys.argv) > 1 else "ujump.html"
out = sys.argv[2] if len(sys.argv) > 2 else "data/nuc_roots/m1300/v1"
s = open(src, encoding="utf-8").read()
d = json.loads(re.search(r'id="nucdata">(\{.*?\})</script>', s, re.S).group(1))
u = lambda k, t: np.frombuffer(base64.b64decode(d[k]), t)
nid = u("NB", np.uint32)[:d["N"]]; lo = u("LB", np.uint32)[:d["N"]]; hb = u("HB", np.uint8)[:d["N"]]
HI = np.array(d["HI"] + [0] * (256 - len(d["HI"])), dtype=np.uint64)
hi = np.where(hb == 255, 0, HI[np.minimum(hb, 255)]).astype(np.uint32)
lo = np.where(hb == 255, 0, lo).astype(np.uint32)
o = np.argsort(nid, kind="stable"); nid, hi, lo = nid[o], hi[o], lo[o]
assert len(np.unique(nid)) == len(nid)
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "nuc2root.bin"), "wb") as f:
    f.write(np.uint32(len(nid)).tobytes()); f.write(nid.tobytes()); f.write(hi.tobytes()); f.write(lo.tobytes())
has = int(((hi != 0) | (lo != 0)).sum())
json.dump({"n": int(len(nid)), "withRoot": has, "source": "ujump.html nucdata (seg_m1300 root ids)", "format": "u32 n; u32 nucleusId[n] sorted; u32 hi[n]; u32 lo[n]"},
          open(os.path.join(out, "meta.json"), "w"), indent=1)
i = int(np.searchsorted(nid, 304871)); print(len(nid), has, nid[i], (int(hi[i]) << 32) + int(lo[i]))
