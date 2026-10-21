"""Perivascular space (PVS) in µJump (2026-10-21, Søren: "make it a layer you can add to the VR and in
Filter and show").
 1. nucdata PDB: uint16 per nucleus = distance from the nucleus centre to the nearest vertex of the
    traced PVS surface (data/pvs/v1/pvs_mesh.bin), in 0.1 µm; 65535 = none. Recomputed every run.
 2. pvsDist(i) + a "perivascular space" row on the cell card.
 3. Excel column "Distance to perivascular space (µm)".
 4. Filter-and-show section "Perivascular space": distance between min and max µm.
 5. Extra 3D layer: data/pvs/v1/ng (Neuroglancer multilod-draco mesh, segment 1).
Usage: python patch_ujump_pvs.py ujump.html data/pvs/v1/pvs_mesh.bin   (idempotent)"""
import sys, re, json, base64, struct, numpy as np
from scipy.spatial import cKDTree
P = sys.argv[1] if len(sys.argv) > 1 else "ujump.html"
M = sys.argv[2] if len(sys.argv) > 2 else "data/pvs/v1/pvs_mesh.bin"
s = open(P, encoding="utf-8").read()

# 1. distances
m = re.search(r'(id="nucdata">)(\{.*?\})(</script>)', s, re.S)
d = json.loads(m.group(2)); N = d["N"]
b = lambda k, t: np.frombuffer(base64.b64decode(d[k]), t)[:N]
X = np.stack([b("XB", np.uint32) * 0.004, b("YB", np.uint32) * 0.004, b("ZB", np.uint16) * 0.04], 1)
mb = open(M, "rb").read(); n = struct.unpack_from("<I", mb)[0]
V = np.frombuffer(mb, np.float32, n * 3, 4).reshape(-1, 3) / 1000.0
dist, _ = cKDTree(V).query(X, workers=-1)
pdb = np.minimum(np.rint(dist * 10), 65534).astype(np.uint16)
d["PDB"] = base64.b64encode(pdb.tobytes()).decode()
s = s[:m.start(2)] + json.dumps(d, separators=(",", ":")) + s[m.end(2):]
print("nuclei", N, "| within 5 µm", int((dist <= 5).sum()), "| within 20 µm", int((dist <= 20).sum()),
      "| median", round(float(np.median(dist)), 1), "µm")

if "function pvsDist(" in s:
    open(P, "w", encoding="utf-8").write(s); print("distances refreshed; code already patched"); sys.exit(0)

def rep(a, bb):
    global s
    assert s.count(a) == 1, ("anchor", s.count(a), a[:90]); s = s.replace(a, bb)

# 2. decode + card row
rep('''function cellVolume(i){const v=NCV?NCV[i]:NaN;return Number.isFinite(v)?v:null;}''',
'''function cellVolume(i){const v=NCV?NCV[i]:NaN;return Number.isFinite(v)?v:null;}
/* PERIVASCULAR SPACE (2026-10-21). Distance from each nucleus centre to the nearest point of Søren's
   traced perivascular space (glia limitans / arachnoid along the pia + the PVS around penetrating
   vessels, Wan & Wei vessel lumen subtracted; src/pvs/microns_pvs_layer.ipynb -> data/pvs/v1/).
   Packed by src/pvs/patch_ujump_pvs.py as uint16 in 0.1 µm, 65535 = none. Most of the traced
   surface is the pial one; deeper down only some penetrating vessels were traced, so a deep cell's
   distance is usually to the pia, not to its nearest vessel. */
const NPD=D.PDB?new Uint16Array(b64(D.PDB).buffer):null;
function pvsDist(i){if(!NPD)return null;const v=NPD[i];return v===65535?null:v/10;}''')
rep('''  if(nvStr)h+='<div class="idrow"><span class="k">nucleus volume</span>''',
'''  {const pd=pvsDist(i);
   if(pd!=null)h+='<div class="idrow"><span class="k">perivascular space</span><span class="idval" style="font-family:monospace" title="Distance from the nucleus centre to the nearest traced perivascular space (Søren Grubb\\'s tracing: pial glia limitans/arachnoid and the space around penetrating vessels, vessel lumen removed). Deep in the cortex only some vessels were traced, so this is often the distance to the pia. Click to copy." data-c="'+pd.toFixed(1)+'">'+(pd<1?"&lt; 1 µm":pd.toFixed(pd<10?1:0)+" µm")+'</span></div>';}
  if(nvStr)h+='<div class="idrow"><span class="k">nucleus volume</span>''')

# 3. Excel
rep('''      {header:"Cell volume note",get:m=>m.row.space==="N"?cellVolNote(m.row.i):""},''',
'''      {header:"Cell volume note",get:m=>m.row.space==="N"?cellVolNote(m.row.i):""},
      /* Distance to the traced perivascular space (pvsDist, near cellVolume). */
      {header:"Distance to perivascular space (µm)",get:m=>{
        if(m.row.space!=="N")return "";
        const v=pvsDist(m.row.i);return v!=null?Math.round(v*10)/10:"";
      }},''')

# 4. filter section + logic
rep('''<div style="margin-top:6px;color:var(--mut)">While this is ticked, cells with no volume (no root ID, or no mesh in the seg_m1300 snapshot) are left out. The volume and its note are always in the Excel download.</div>
</div>
</details>''', '''<div style="margin-top:6px;color:var(--mut)">While this is ticked, cells with no volume (no root ID, or no mesh in the seg_m1300 snapshot) are left out. The volume and its note are always in the Excel download.</div>
</div>
</details>
<details class="rv-panel filter-section" id="filterSecPvs">
<summary title="Distance from each nucleus to Søren Grubb's traced perivascular space: the glia limitans / arachnoid along the pia and the space around penetrating vessels, with the Wan &amp; Wei vessel lumen removed. Tick the types above (or &quot;include unclassified&quot;), as for every other filter here.">Perivascular space</summary>
<div style="margin-top:10px;font-size:12px">
<div class="row" style="align-items:center;gap:6px;flex-wrap:wrap">
<label><input type="checkbox" id="filterPvsOn"> Nucleus between</label>
<input type="text" id="filterPvsMin" value="0" style="width:56px;padding:4px 6px" inputmode="decimal">
<span>and</span>
<input type="text" id="filterPvsMax" value="20" style="width:56px;padding:4px 6px" inputmode="decimal">
<span style="color:var(--mut)">µm from the perivascular space</span>
</div>
<div style="margin-top:6px;color:var(--mut)">Most of the traced space lies along the pia; deeper down only some penetrating vessels were traced, so a deep cell's distance is usually to the pia. Only MICrONS nuclei have a distance. To see the space itself, tick it under "Add extra layers to the 3D view". The distance is always in the Excel download.</div>
</div>
</details>''')
rep('''    const recSel=document.getElementById("filterRecAct")?document.getElementById("filterRecAct").value:"";''',
'''    /* PERIVASCULAR SPACE (2026-10-21): pvsDist(), near cellVolume. */
    const pvsOn=!!(document.getElementById("filterPvsOn")||{}).checked;
    const pvsMin=numIn("filterPvsMin",0),pvsMax=numIn("filterPvsMax",Infinity);
    const recSel=document.getElementById("filterRecAct")?document.getElementById("filterRecAct").value:"";''')
rep('''      let recAct=null;
      if(recOn){''', '''      if(pvsOn){
        if(row.space!=="N")return null;
        const pd=pvsDist(row.i);
        if(pd==null||pd<pvsMin||pd>pvsMax)return null;
      }
      let recAct=null;
      if(recOn){''')
rep('''recClips,volActive:volOn};''', '''recClips,volActive:volOn,pvsActive:pvsOn};''')

# 5. 3D layer
rep('''<input type="checkbox" id="filterVascSeg" style="width:auto"> Include vasculature segmentation (Wan &amp; Wei 2024, TriSAM)</label>''',
'''<input type="checkbox" id="filterVascSeg" style="width:auto"> Include vasculature segmentation (Wan &amp; Wei 2024, TriSAM)</label>
<label style="margin-top:8px;text-transform:none;font-size:13px;display:flex;align-items:center;gap:7px;color:var(--ink);cursor:pointer" title="Søren Grubb's traced perivascular space: the glia limitans / arachnoid along the pia plus the space around penetrating vessels, with the Wan &amp; Wei vessel lumen removed. One mesh, served from this site (data/pvs/v1/ng)."><input type="checkbox" id="filterPvsLayer" style="width:auto"> Include perivascular space (Søren Grubb's tracing)</label>''')
rep('''    if(vascTraceLayers.length)state.layers.push(...vascTraceLayers);''',
'''    if(vascTraceLayers.length)state.layers.push(...vascTraceLayers);
    /* PERIVASCULAR SPACE layer (2026-10-21): a mesh-only precomputed source (multilod draco,
       segment 1) next to this page; Neuroglancer needs the absolute URL. */
    const pvsLayerChk=document.getElementById("filterPvsLayer");
    if(pvsLayerChk&&pvsLayerChk.checked){
      state.layers.push({type:"segmentation",source:"precomputed://"+new URL("data/pvs/v1/ng",location.href).href,
        tab:"source",name:"Perivascular space (Søren Grubb)",segments:["1"],segmentColors:{"1":"#3cc8d8"},objectAlpha:0.45});
    }''')
rep('''const STALE_IGNORE_IDS=new Set(["filterVasc","filterVascSeg",''', '''const STALE_IGNORE_IDS=new Set(["filterVasc","filterVascSeg","filterPvsLayer",''')
open(P, "w", encoding="utf-8").write(s); print("patched", len(s))
