"""dashboard-data-tools/meninges_prep.py  (2026-11-06)
Neuroglancer line annotations (glia limitans, arachnoid mater, white matter, arachnoid villus
outline / core channel / inner channel, dataset bounding box) -> data/meninges/minnie65.json for vr.html.
Run:  python meninges_prep.py <folder with the .txt layer exports> ../data/meninges/minnie65.json
Output coordinates: µm (x, y at 0.1 µm as Int16, base64), z in µm. See core/meninges.js."""
import json,glob,collections,math,sys,base64
import numpy as np
A=sys.argv[1].rstrip('/\\')+'/'   # the folder with the exported Neuroglancer layers (.txt)
F={'glia':'*glia_limitans.txt','wm':'*White_matter.txt','arach':'*014_-_arachnoid_mater.txt','vout':'*Arachnoid_villus_outline.txt','vcore':'*arachnoid_villus_core.txt','vchan':'*internal_channel.txt','bbox':'*Bounding_box*.txt'}
def load(key):
    f=glob.glob(A+F[key])[0]; t=open(f).read().strip().rstrip(',')
    return json.loads('['+t+']')
def um(p): return (p[0]*0.004,p[1]*0.004,p[2]*0.04)
def sections(layer):
    byz=collections.defaultdict(list)
    for a in layer['annotations']:
        if a['type']!='line': continue
        A_=um(a['pointA']);B_=um(a['pointB'])
        byz[round(a['pointA'][2]*0.04,2)].append((A_[:2],B_[:2]))
    return byz
def chain(segs,tol):
    """join segments into polylines: greedy, endpoint-to-endpoint within tol (µm)."""
    polys=[[np.array(a),np.array(b)] for a,b in segs if math.dist(a,b)>1e-6]
    changed=True
    while changed and len(polys)>1:
        changed=False
        ends=np.array([[p[0],p[-1]] for p in polys]).reshape(-1,2)  # 2 per poly
        n=len(polys); best=None
        D=np.linalg.norm(ends[:,None]-ends[None],axis=2)
        for i in range(2*n): D[i,i]=np.inf; D[i,i^1]=np.inf
        i,j=np.unravel_index(np.argmin(D),D.shape)
        if D[i,j]>tol: break
        pi,ei=divmod(i,2); pj,ej=divmod(j,2)
        a=polys[pi] if ei==1 else polys[pi][::-1]   # a ends at the joint
        b=polys[pj] if ej==0 else polys[pj][::-1]   # b starts at the joint
        new=a+(b[1:] if np.linalg.norm(a[-1]-b[0])<1e-6 else b)
        polys=[p for k,p in enumerate(polys) if k not in (pi,pj)]+[new]; changed=True
    return polys

OUT=sys.argv[2]   # e.g. data/meninges/minnie65.json
def rs(p,step):
    """resample a polyline at ~step µm along its length (keeps both ends)"""
    p=np.array(p); d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
    if d[-1]<step: return p[[0,-1]]
    n=max(2,int(round(d[-1]/step))+1); t=np.linspace(0,d[-1],n)
    return np.c_[np.interp(t,d,p[:,0]),np.interp(t,d,p[:,1])]
def dp(p,eps):
    p=np.array(p)
    if len(p)<3: return p
    a,b=p[0],p[-1]; ab=b-a; L=np.linalg.norm(ab)
    dd=np.abs(ab[0]*(p[:,1]-a[1])-ab[1]*(p[:,0]-a[0]))/L if L>1e-9 else np.linalg.norm(p-a,axis=1)
    i=int(np.argmax(dd))
    if dd[i]>eps: return np.vstack([dp(p[:i+1],eps)[:-1],dp(p[i:],eps)])
    return np.array([a,b])
def enc(p):
    q=np.round(np.asarray(p)*10).astype('<i2'); return base64.b64encode(q.tobytes()).decode()
out={'source':'Neuroglancer line annotations by Søren Grubb (minnie65, 4×4×40 nm voxels)','made':'2026-11-06','layers':[]}
def stats(name,secs): print(name,len(secs),'sections')
# --- sheets: one ordered polyline per section, pieces kept apart (a gap is a gap) ---
def sheet(key,name,color,label):
    L=[l for l in load(key) if l['name']==name][0]; S=sections(L)
    allp=np.vstack([np.array(s[0]) for v in S.values() for s in v])
    c=allp.mean(0); u,s_,vt=np.linalg.svd(allp-c,full_matrices=False); ax=vt[0]
    secs=[]
    for z in sorted(S):
        P=chain(S[z],1.5); pcs=[]
        for p in P:
            p=np.array(p)
            if np.dot(p[-1]-p[0],ax)<0: p=p[::-1]
            p=rs(p,4.0)
            if len(p)>=2: pcs.append(p)
        pcs.sort(key=lambda p:np.dot(p[0]-c,ax))
        secs.append([round(z,2),[enc(p) for p in pcs]])
    out['layers'].append({'key':key,'name':label,'color':color,'kind':'sheet','axis':[round(float(ax[0]),4),round(float(ax[1]),4)],'secs':secs})
    stats(label,secs)
def rings(key,name,color,label,tolClose,eps=0.05,ctol=1.0):
    L=[l for l in load(key) if l['name']==name][0]; S=sections(L)
    secs=[];nc=no=0
    for z in sorted(S):
        P=chain(S[z],ctol); rr=[]
        for p in P:
            p=np.array(p); length=np.sum(np.linalg.norm(np.diff(p,axis=0),axis=1))
            if length<0.3: continue
            gap=np.linalg.norm(p[0]-p[-1]); closed=1 if (len(p)>3 and gap<max(tolClose,0.25*length)) else 0
            if closed and gap<1e-6: p=p[:-1]
            p=dp(p,eps); nc+=closed; no+=1-closed
            rr.append([closed,enc(p)])
        if rr: secs.append([round(z,2),rr])
    out['layers'].append({'key':key,'name':label,'color':color,'kind':'rings','secs':secs})
    print(label,len(secs),'sections, closed',nc,'open',no)
sheet('glia','Glia limitans','#d9bf94','Glia limitans')
sheet('arach','Arachnoid mater','#7fb4e6','Arachnoid mater')
sheet('wm','White matter','#ffffff','White matter border')
rings('vout','Arachnoid villus outline','#f2cc60','Arachnoid villus: outline',1.5)
rings('vcore','Arachnoid villus','#ff8f6b','Arachnoid villus: core channel',1.5)
rings('vchan','Villus internal channel','#5fd7e8','Arachnoid villus: inner channel',1.5)
rings('bbox','Bounding box for entire dataset','#9da7b3','Dataset bounding box',1e9,eps=0,ctol=5)
pts={}
for l in load('arach'):
    if l['name'] in('Arterioles','Venules'):
        pts[l['name']]=[[round(a['point'][0]*0.004,1),round(a['point'][1]*0.004,1),round(a['point'][2]*0.04,1)] for a in l['annotations'] if a['type']=='point']
out['points']={'Arterioles':{'color':'#ff4d4d','p':pts.get('Arterioles',[])},'Venules':{'color':'#4d7dff','p':pts.get('Venules',[])}}
s=json.dumps(out,separators=(',',':')); open(OUT,'w').write(s); print('bytes',len(s))
