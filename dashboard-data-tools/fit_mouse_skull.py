import numpy as np, trimesh
from scipy.ndimage import distance_transform_edt
mo=trimesh.load('zip/Mouse/files/Mouse_t.stl')
vx=mo.voxelized(0.4).fill(); M=vx.matrix; inv=np.linalg.inv(vx.transform); D=distance_transform_edt(M)*0.4
def look(p):
    q=(np.c_[p,np.ones(len(p))]@inv.T)[:,:3]; i=np.round(q).astype(int)
    ok=(i>=0).all(1)&(i<np.array(M.shape)).all(1); r=np.zeros(len(p)); r[ok]=D[i[ok,0],i[ok,1],i[ok,2]]; return r
skm=trimesh.load('zip/Skull and brain/files/Mouse_Skull.stl'); sk=skm.vertices[::12]
up=sk[sk[:,0]<7.0]
# the skull's outer shell seen from above and the sides: per (y,z) cell, the min-x point (top)
top_pts=[]
for zz in np.arange(0,24,0.5):
  for yy in np.arange(7,20,0.5):
    s=sk[(np.abs(sk[:,1]-yy)<0.25)&(np.abs(sk[:,2]-zz)<0.25)]
    if len(s): top_pts.append(s[s[:,0].argmin()])
top_pts=np.array(top_pts)
def s2m(p, K, pitch, ny, top):
    xS,yS,zS=p[:,0],p[:,1],p[:,2]
    x=-(yS-13.45)*K; zr=24.3-(xS-top)*K; yr=zS*K+ny
    a=np.radians(pitch); y0,z0=-25,18
    y=y0+(yr-y0)*np.cos(a)-(zr-z0)*np.sin(a); z=z0+(yr-y0)*np.sin(a)+(zr-z0)*np.cos(a)
    return np.c_[x,y,z]
best=None
for K in [0.8,0.85,0.9,0.95,1.0,1.05]:
  for pitch in range(-10,40,2):
    for ny in np.arange(-37,-29,0.5):
      for top in np.arange(-5,6,0.25):
        d=look(s2m(up,K,pitch,ny,top)); ins=(d>0).mean()
        if ins<0.995: continue
        gap=look(s2m(top_pts,K,pitch,ny,top)).mean()   # how deep the skull's top sits under the fur
        score=gap/K          # in skull units: snug and as large as fits
        if best is None or score<best[0]: best=(score,gap,K,pitch,ny,top,ins)
print(best)
