import numpy as np, json, collections
from scipy.spatial import cKDTree
import scipy.sparse as sp, scipy.sparse.csgraph as cg
R=np.array([0.004,0.004,0.040])
CATS=["pial_art","pa","acap1","acap2","acap3","vcap1","vcap2","vcap3","av","pial_ven"]
OUTLINE={"pial_art","pa","pial_ven","av"}
DEFR={"acap1":3.25,"acap2":2.0,"acap3":1.5,"vcap1":3.0,"vcap2":2.0,"vcap3":1.5}
class UF:
    def __init__(s,n): s.p=np.arange(n)
    def f(s,a):
        r=a
        while s.p[r]!=r: r=s.p[r]
        while s.p[a]!=r: s.p[a],a=r,s.p[a]
        return r
    def u(s,a,b):
        a,b=s.f(a),s.f(b)
        if a!=b: s.p[a]=b
nodes=[];cat=[];rad=[];edges=set();dense={c:[] for c in CATS};owner={c:[] for c in CATS};rep={}
def add(p,c,r): nodes.append(p);cat.append(c);rad.append(r);return len(nodes)-1
def sample(a,b,step=1.0):
    n=max(1,int(np.ceil(np.linalg.norm(b-a)/step))); t=np.linspace(0,1,n+1)[:,None]; return a+(b-a)*t, t[:,0]
for ci,c in enumerate(CATS):
    d=np.load(c+".npz"); A=d["A"]*R; B=d["B"]*R
    if c not in OUTLINE:
        P=np.vstack([A,B]); uf=UF(len(P))
        for a,b in cKDTree(P).query_pairs(0.3,output_type='ndarray'): uf.u(int(a),int(b))
        root=np.array([uf.f(i) for i in range(len(P))]); ids={}
        for r in root:
            if r not in ids: ids[r]=add(P[r],ci,DEFR[c])
        n=len(A)
        for i in range(n):
            a,b=ids[root[i]],ids[root[i+n]]
            if a!=b: edges.add((min(a,b),max(a,b)))
            pts,t=sample(A[i],B[i]); dense[c].append(pts); owner[c].append(np.where(t<0.5,a,b))
        rep[c]={"segments":n,"nodes":len(ids)}
    else:
        z=np.round(A[:,2],3); first=len(nodes)
        for zz in np.unique(z):
            m=np.where(z==zz)[0]; a=A[m]; b=B[m]; P=np.vstack([a,b]); uf=UF(len(P))
            for i in range(len(m)): uf.u(i,i+len(m))
            for x,y in cKDTree(P[:,:2]).query_pairs(1.0): uf.u(int(x),int(y))
            g=collections.defaultdict(list)
            for i in range(len(m)): g[uf.f(i)].append(i)
            for k,L in g.items():
                mids=(a[L]+b[L])/2; ln=np.linalg.norm(a[L]-b[L],axis=1)+1e-6; cen=(mids*ln[:,None]).sum(0)/ln.sum()
                pts=np.vstack([a[L],b[L]])[:,:2]; r=float(np.mean(np.linalg.norm(pts-cen[:2],axis=1)))
                nid=add(cen,ci,max(1.0,min(r,40.0)))
                for i in L:
                    s,_=sample(a[i],b[i]); dense[c].append(s); owner[c].append(np.full(len(s),nid))
        rep[c]={"segments":len(A),"outline_pieces":len(nodes)-first}
for c in CATS: dense[c]=np.vstack(dense[c]); owner[c]=np.concatenate(owner[c])
nodes=np.array(nodes,np.float32); cat=np.array(cat,np.uint8); rad=np.array(rad,np.float32)
trees={c:cKDTree(dense[c]) for c in CATS}
LINK={"pa":10.0,"av":10.0,"pial_art":6.0,"pial_ven":6.0}
# 1. outline pieces of one vessel in neighbouring sections: any traced points within 5 µm, different section
for c in OUTLINE:
    D=dense[c]; O=owner[c]
    pr=trees[c].query_pairs(LINK[c],output_type="ndarray")
    a=O[pr[:,0]]; b=O[pr[:,1]]; m=(a!=b)&(np.abs(nodes[a,2]-nodes[b,2])>0.01)
    s=set(map(tuple,np.sort(np.stack([a[m],b[m]],1),1)))
    edges|=s; rep[c]["links_between_sections"]=len(s)
# 2. junctions: every node of the child within reach of the parent's traced points
PARENT={"acap1":"pa","acap2":"acap1","acap3":"acap2","vcap1":"av","vcap2":"vcap1","vcap3":"vcap2","pa":"pial_art","av":"pial_ven"}
LIM={"acap1":6.0,"acap2":4.0,"acap3":4.0,"vcap1":6.0,"vcap2":4.0,"vcap3":4.0,"pa":8.0,"av":8.0}
for c,p in PARENT.items():
    ci=CATS.index(c); ix=np.where(cat==ci)[0]
    # the child's own traced points, so a junction can be anywhere along it
    dd,jj=trees[p].query(dense[c],distance_upper_bound=LIM[c])
    ok=np.isfinite(dd); a=owner[c][ok]; b=owner[p][jj[ok]]
    # one junction per child node: the closest
    best={}
    for x,y,dv in zip(a,b,dd[ok]):
        if x not in best or dv<best[x][1]: best[x]=(y,dv)
    s=set((min(x,y),max(x,y)) for x,(y,_) in best.items())
    edges|=s; rep[c]["junctions_to_"+p]=len(s)
E=np.array(sorted(edges),np.uint32)
G=sp.coo_matrix((np.ones(len(E)),(E[:,0],E[:,1])),shape=(len(nodes),)*2)
nc,lab=cg.connected_components(G,directed=False)
def reach(c,t):
    has=set(lab[cat==CATS.index(t)]); return round(float(np.mean([l in has for l in lab[cat==CATS.index(c)]])),3)
rep["reach"]={"acap1→PA":reach("acap1","pa"),"acap2→PA":reach("acap2","pa"),"acap3→PA":reach("acap3","pa"),"PA→pial art":reach("pa","pial_art"),
 "acap1→pial art":reach("acap1","pial_art"),"vcap1→AV":reach("vcap1","av"),"vcap3→AV":reach("vcap3","av"),"AV→pial ven":reach("av","pial_ven")}
rep["totals"]={"nodes":int(len(nodes)),"edges":int(len(E)),"components":int(nc)}
print(json.dumps(rep,indent=1))
np.savez("net.npz",nodes=nodes,cat=cat,rad=rad,E=E)

# ── export for the viewer ──
import os, struct
OUT="/tmp/claude-0/vr/repo/data/vasc_net/v1"; os.makedirs(OUT,exist_ok=True)
# vessel identity for coherent vasomotion: components of same-category edges
same=(cat[E[:,0]]==cat[E[:,1]])
G2=sp.coo_matrix((np.ones(same.sum()),(E[same,0],E[same,1])),shape=(len(nodes),)*2)
_,vid=cg.connected_components(G2,directed=False)
# radius for outline vessels: half the short axis of each traced piece, from its own dense points
for c in OUTLINE:
    ci=CATS.index(c); O=owner[c]; Dn=dense[c]
    order=np.argsort(O); Os=O[order]; Ds=Dn[order]; cuts=np.flatnonzero(np.diff(Os))+1
    for grp_o,grp_p in zip(np.split(Os,cuts),np.split(Ds,cuts)):
        if len(grp_p)<4: continue
        ev=np.linalg.eigvalsh(np.cov(grp_p[:,:2].T))
        r=2*np.sqrt(max(ev[0],0))      # ring: std = r/sqrt2 -> r ≈ 1.41 std; a little generous for strips
        rad[grp_o[0]]=float(np.clip(r, 3.0, 25.0))
# dense traced points, thinned to ~1.5 µm, quantised to 1/40 µm
Dall=[];Oall=[]
for c in CATS:
    t=cKDTree(dense[c]); keep=np.ones(len(dense[c]),bool)
    # thin: drop points closer than 1.5 µm to an earlier kept one (greedy on a grid)
    q=np.floor(dense[c]/1.5).astype(np.int64); _,first=np.unique(q,axis=0,return_index=True)
    Dall.append(dense[c][np.sort(first)]); Oall.append(owner[c][np.sort(first)])
Dall=np.vstack(Dall); Oall=np.concatenate(Oall).astype(np.uint32)
Q=0.025; Dq=np.round(Dall/Q).astype(np.uint16)
assert Dall.max()/Q<65535
blob=b"".join([nodes.astype("<f4").tobytes(),rad.astype("<f4").tobytes(),vid.astype("<u4").tobytes(),cat.astype("u1").tobytes()+b"\0"*((4-len(cat)%4)%4),
               E.astype("<u4").tobytes(),Dq.astype("<u2").tobytes()+b"\0"*((4-(Dq.size*2)%4)%4),Oall.astype("<u4").tobytes()])
open(OUT+"/net.bin","wb").write(blob)
meta={"version":1,"made":"2026-10-19","source":"Søren Grubb's hand tracings in minnie65 (Neuroglancer line annotations, 'Vascular outlines'): lumen outlines of pial arterioles, penetrating arterioles, ascending and pial venules; centrelines of 1st-3rd order arterial and venous capillaries. Joined into one network by build2.py (outline pieces linked across sections within 10 µm for PA/AV, 6 µm pial; each capillary attached to its parent order within 4-6 µm; PA to pial arteriole and AV to pial venule within 8 µm).",
 "units":"µm, minnie65 (x,y,z) with y = depth","cats":CATS,"names":{c:n for c,n in [("pial_art","pial arteriole"),("pa","penetrating arteriole"),("acap1","1st-order arterial capillary"),("acap2","2nd-order arterial capillary"),("acap3","3rd-order arterial capillary"),("vcap1","1st-order venous capillary"),("vcap2","2nd-order venous capillary"),("vcap3","3rd-order venous capillary"),("av","ascending venule"),("pial_ven","pial venule")]},
 "n":int(len(nodes)),"e":int(len(E)),"d":int(len(Dall)),"quant":Q,
 "layout":["nodes f32 n*3","radius f32 n","vessel id u32 n","category u8 n (padded to 4)","edges u32 e*2","traced points u16 d*3 (x quant, padded to 4)","owner node u32 d"],
 "report":rep}
json.dump(meta,open(OUT+"/meta.json","w"),indent=1)
print("wrote",len(blob)/1e6,"MB; dense",len(Dall))
