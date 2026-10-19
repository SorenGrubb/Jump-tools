import json,glob,numpy as np,os
SRC="/mnt/user-data/uploads/MICrONS cell classifier/Vascular outlines/"
FILES={"pial_art":("004 - pial arterioles.txt",None),"pa":("004_2 - Pen arterioles.txt",None),
 "pial_ven":("005 - pial Venules.txt",None),"av":("005_2 - Asc venules.txt",None),
 "acap1":("008_1 - arterial 1 order cap.txt",None),"acap2":("008_1 - arterial 2 order cap.txt",None),
 "acap3":("arterial 3 order cap.txt","3. order1"),
 "vcap1":("Venule 1 order cap.txt",None),"vcap2":("Venule 2 order cap.txt",None),"vcap3":("Venule 3 order cap.txt",None)}
def objs(path):
    s=open(path,encoding='utf-8',errors='replace').read(); dec=json.JSONDecoder(); i=0; out=[]
    while True:
        while i<len(s) and s[i] in ' \t\r\n,': i+=1
        if i>=len(s): break
        try: o,j=dec.raw_decode(s,i)
        except Exception: break
        out.append(o); i=j
    return out
R=np.array([0.004,0.004,0.040])
for k,(f,layer) in FILES.items():
    O=objs(SRC+f)
    if layer: O=[o for o in O if o.get('name')==layer]
    L=[a for o in O for a in o.get('annotations',[]) if a.get('type')=='line']
    A=np.array([a['pointA'] for a in L],float); B=np.array([a['pointB'] for a in L],float)
    np.savez(k+".npz",A=A,B=B)
    zs=np.unique(np.round(A[:,2]))
    print(k,len(L),"z sections",len(zs),"z step median",np.median(np.diff(zs)) if len(zs)>1 else None)
