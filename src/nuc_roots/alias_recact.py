"""Recorded activity (data/microns_activity/v1/index.json) is keyed by the root ids the functional
co-registration used. After pack_volumes.py updated 16,045 outdated nucleus roots to the seg_m1300
root at the nucleus, µJump looks cells up by the NEW root -- so each such nucleus gets an alias entry
(new root -> same record). Idempotent; aliases are listed under idx["aliases"]."""
import json, re, base64, numpy as np
P = "data/microns_activity/v1/index.json"
idx = json.load(open(P)); R = idx["roots"]
s = open("ujump.html", encoding="utf-8").read()
d = json.loads(re.search(r'id="nucdata">(\{.*?\})</script>', s, re.S).group(1)); N = d["N"]; HI = d["HI"]
b = lambda k, t: np.frombuffer(base64.b64decode(d[k]), t)[:N]
def roots(hk, lk):
    h, l = b(hk, np.uint8), b(lk, np.uint32); return [0 if x == 255 else (HI[x] << 32) + int(y) for x, y in zip(h, l)]
old, new = roots("OHB", "OLB"), roots("HB", "LB")
al = idx.get("aliases", {}); n = 0
for o, w in zip(old, new):
    if o and w and o != w and str(o) in R and str(w) not in R:
        R[str(w)] = R[str(o)]; al[str(w)] = str(o); n += 1
idx["aliases"] = al
json.dump(idx, open(P, "w"), separators=(",", ":"))
print("aliases added", n, "total", len(al))
