import numpy as np, trimesh
from scipy.ndimage import distance_transform_edt
mo=trimesh.load('zip/Mouse/files/Mouse_t.stl')
vx=mo.voxelized(0.25).fill(); M=vx.matrix; inv=np.linalg.inv(vx.transform); D=distance_transform_edt(M)*0.25
def look(p):
    q=(np.c_[p,np.ones(len(p))]@inv.T)[:,:3]; i=np.round(q).astype(int)
    ok=(i>=0).all(1)&(i<np.array(M.shape)).all(1); r=np.zeros(len(p)); r[ok]=D[i[ok,0],i[ok,1],i[ok,2]]; return r
sk=trimesh.load('zip/Skull and brain/files/Mouse_Skull.stl').vertices[::6]
up=sk[sk[:,0]<7.0]          # all but the lower jaw and the incisors must stay under the fur
def s2m(p, K, pitch, ny, top):
    xS,yS,zS=p[:,0],p[:,1],p[:,2]
    x=-(yS-13.45)*K; zr=24.3-(xS-top)*K; yr=zS*K+ny
    a=np.radians(pitch); y0,z0=-25,18
    y=y0+(yr-y0)*np.cos(a)-(zr-z0)*np.sin(a); z=z0+(yr-y0)*np.sin(a)+(zr-z0)*np.cos(a)
    return np.c_[x,y,z]
best=None
for K in np.arange(0.70,0.92,0.02):
  for pitch in range(8,36,2):
    for ny in np.arange(-36,-29,0.5):
      for top in np.arange(-4,3,0.25):
        d=look(s2m(up,K,pitch,ny,top))
        if (d < 0.5).mean() > 0.0005: continue        # every upper-skull point at least 0.5 under the fur
        if best is None or K>best[0] or (K==best[0] and d.min()>best[5]): best=(K,pitch,ny,top,(d<0.5).mean(),d.min())
  print(round(K,2),best,flush=True)
print("BEST",best)
import numpy as np, trimesh
from trimesh.proximity import signed_distance
from scipy.ndimage import distance_transform_edt
mo0=trimesh.load('zip/Mouse/files/Mouse_t.stl')
full=trimesh.load('zip/Skull and brain/files/Mouse_Skull.stl').vertices; upf=full[full[:,0]<7.0]
def s2m(p, K, pitch, ny, top):
    xS,yS,zS=p[:,0],p[:,1],p[:,2]
    x=-(yS-13.45)*K; zr=24.3-(xS-top)*K; yr=zS*K+ny
    a=np.radians(pitch); y0,z0=-25,18
    y=y0+(yr-y0)*np.cos(a)-(zr-z0)*np.sin(a); z=z0+(yr-y0)*np.sin(a)+(zr-z0)*np.cos(a)
    return np.c_[x,y,z]
def inflate(m, amt):
    v=m.vertices.copy(); n=m.vertex_normals
    wy=np.clip(1-np.abs(v[:,1]+29)/5.5,0,1); wz=np.clip((v[:,2]-13.5)/3,0,1)
    w=(wy*wy*(3-2*wy))*wz
    return trimesh.Trimesh(v+n*(amt*w)[:,None], m.faces, process=False)
def checker(mo):
    vx=mo.voxelized(0.25).fill(); M=vx.matrix; inv=np.linalg.inv(vx.transform); D=distance_transform_edt(M)*0.25
    def look(p):
        q=(np.c_[p,np.ones(len(p))]@inv.T)[:,:3]; i=np.round(q).astype(int)
        ok=(i>=0).all(1)&(i<np.array(M.shape)).all(1); r=np.zeros(len(p)); r[ok]=D[i[ok,0],i[ok,1],i[ok,2]]; return r
    def exact(P):
        d=look(P); idx=np.argsort(d)[:1500]; return signed_distance(mo,P[idx]).min()
    return exact
import sys
for amt in [0.5]:
  ex=checker(inflate(mo0,amt))
  for (ny,top) in [(-34.75,-2.65),(-34.75,-2.55),(-34.85,-2.65),(-34.7,-2.6)]:
    print(amt,ny,top,'min',round(float(ex(s2m(upf,0.8,20,ny,top))),3),flush=True)
