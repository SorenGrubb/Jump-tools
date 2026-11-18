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
exec(open('fit3.py').read().split("best=None")[0])
for K in [0.8,0.85]:
  best=None
  for pitch in range(-6,40,2):
    for ny in np.arange(-35,-32.9,0.5):
      for top in np.arange(-8,3,0.25):
        d=look(s2m(up,K,pitch,ny,top)); m=np.percentile(d,0.1)
        if best is None or m>best[0]: best=(m,pitch,ny,top,d.min(),(d<0.3).mean())
  print(K,"BEST",best,flush=True)
exec(open('fit3.py').read().split("best=None")[0])
for pitch in [14,16,18,20,22]:
  best=None
  for top in np.arange(-6,0,0.25):
    d=look(s2m(up,0.8,pitch,-34.0,top)); m=np.percentile(d,0.1)
    if best is None or m>best[0]: best=(round(m,2),pitch,top,round(d.min(),2))
  print(best)
