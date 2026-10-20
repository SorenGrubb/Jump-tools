import sys
P = sys.argv[1] if len(sys.argv) > 1 else "ujump.html"
s = open(P, encoding="utf-8").read()
if "function cellVolNote(" in s: print("already patched"); sys.exit(0)
def rep(a, b):
    global s
    assert s.count(a) == 1, ("anchor", s.count(a), a[:80]); s = s.replace(a, b)
rep('''function nucVolumeStr(i){const v=NV[i];return(v&&v>0)?v.toFixed(1)+" µm³":"";}''',
'''function nucVolumeStr(i){const v=NV[i];return(v&&v>0)?v.toFixed(1)+" µm³":"";}
/* WHOLE-CELL VOLUME, PRECOMPUTED (2026-10-20, Søren: "Can we also calculate their volumes at the same
   time?"). From src/nuc_roots/microns_m1300_roots_volumes.ipynb: every root's seg_m1300 mesh, read at
   its coarsest level of detail (finer when that has < 2000 vertices), volume by the divergence
   theorem -- the same formula as the Compute volume button, so an ESTIMATE of the same kind. Packed
   by src/nuc_roots/pack_volumes.py. NCF bits: 1 the root holds several nuclei (a merge -- the volume
   is the whole merged segment), 2 the segment is smaller than its own nucleus (a fragment, not the
   cell), 4 the root has no mesh in the seg_m1300 snapshot, 8 the root id was found automatically at
   the nucleus (MICrONS gave this nucleus none). */
const NCV=D.CVB?new Float32Array(b64(D.CVB).buffer):null,NCF=D.CFB?b64(D.CFB):null;
function cellVolume(i){const v=NCV?NCV[i]:NaN;return Number.isFinite(v)?v:null;}
function cellVolNote(i){const f=NCF?NCF[i]:0,o=[];
  if(f&8)o.push("root ID found at the nucleus (automatic)");
  if(f&1)o.push("merge: this root holds several nuclei");
  if(f&2)o.push("smaller than its nucleus: a fragment, not the whole cell");
  if(f&4)o.push("no mesh in the seg_m1300 snapshot");
  return o.join("; ");}''')
rep('''  if(nvStr)h+='<div class="idrow"><span class="k">nucleus volume</span>''',
'''  {const cvv=cellVolume(i),cvn=cellVolNote(i);
   if(cvv!=null||cvn)h+='<div class="idrow"><span class="k">cell volume</span><span class="idval" style="font-family:monospace" title="Whole-cell (mesh) volume, precomputed for every cell from its seg_m1300 mesh at a coarse level of detail -- an estimate. Click to copy." data-c="'+(cvv!=null?cvv.toFixed(0):"")+'">'+(cvv!=null?"≈ "+Math.round(cvv).toLocaleString("en-US")+" µm³":"–")+'</span>'+(cvn?'<span class="nsub" style="margin-left:6px">'+escHtml(cvn)+'</span>':'')+'</div>';}
  if(nvStr)h+='<div class="idrow"><span class="k">nucleus volume</span>''')
rep('''      {header:"Voxel X",get:m=>rowPos(m.row)[0]},''',
'''      /* Whole-cell volume precomputed for every nucleus (see cellVolume near nucVolumeStr). */
      {header:"Cell volume, precomputed (µm³)",get:m=>{
        if(m.row.space!=="N")return "";
        const v=cellVolume(m.row.i);return v!=null?Math.round(v):"";
      }},
      {header:"Cell volume note",get:m=>m.row.space==="N"?cellVolNote(m.row.i):""},
      {header:"Voxel X",get:m=>rowPos(m.row)[0]},''')
open(P, "w", encoding="utf-8").write(s); print("patched", len(s))
