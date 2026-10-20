import sys
P = sys.argv[1] if len(sys.argv) > 1 else "ujump.html"
s = open(P, encoding="utf-8").read()
if 'id="filterSecVol"' in s: print("already"); sys.exit(0)
def rep(a, b):
    global s
    assert s.count(a) == 1, ("anchor", s.count(a), a[:80]); s = s.replace(a, b)
rep('''<div id="filterRecMsg" style="margin-top:6px;color:var(--mut)"></div>
</div>
</details>''', '''<div id="filterRecMsg" style="margin-top:6px;color:var(--mut)"></div>
</div>
</details>
<details class="rv-panel filter-section" id="filterSecVol">
<summary title="The whole-cell volume precomputed for every MICrONS nucleus from its seg_m1300 mesh (2026-10-20) -- an estimate, read at a coarse level of detail. Tick the types above (or &quot;include unclassified&quot;), as for every other filter here.">Cell volume</summary>
<div style="margin-top:10px;font-size:12px">
<div class="row" style="align-items:center;gap:6px;flex-wrap:wrap">
<label><input type="checkbox" id="filterVolOn"> Whole-cell volume between</label>
<input type="text" id="filterVolMin" value="0" style="width:64px;padding:4px 6px" inputmode="decimal">
<span>and</span>
<input type="text" id="filterVolMax" value="" placeholder="no limit" style="width:72px;padding:4px 6px" inputmode="decimal">
<span style="color:var(--mut)">µm³</span>
</div>
<div style="margin-top:6px"><label><input type="checkbox" id="filterVolNoFrag" checked> leave out fragments (segment smaller than its own nucleus)</label></div>
<div style="margin-top:4px"><label><input type="checkbox" id="filterVolNoMerge" checked> leave out merges (one segment holding several nuclei)</label></div>
<div style="margin-top:6px;color:var(--mut)">While this is ticked, cells with no volume (no root ID, or no mesh in the seg_m1300 snapshot) are left out. The volume and its note are always in the Excel download.</div>
</div>
</details>''')
rep('''    const recSel=document.getElementById("filterRecAct")?document.getElementById("filterRecAct").value:"";''',
'''    /* CELL VOLUME (2026-10-20): the precomputed whole-cell volume (cellVolume/cellVolNote near
       nucVolumeStr). Only "N"-space rows have one. */
    const volOn=!!(document.getElementById("filterVolOn")||{}).checked;
    const numIn=(id,dflt)=>{const v=parseFloat(String((document.getElementById(id)||{}).value||"").replace(/\\s/g,"").replace(",","."));return Number.isFinite(v)?v:dflt;};
    const volMin=numIn("filterVolMin",0),volMax=numIn("filterVolMax",Infinity);
    const volNoFrag=!!(document.getElementById("filterVolNoFrag")||{}).checked,volNoMerge=!!(document.getElementById("filterVolNoMerge")||{}).checked;
    const recSel=document.getElementById("filterRecAct")?document.getElementById("filterRecAct").value:"";''')
rep('''      let recAct=null;
      if(recOn){''', '''      if(volOn){
        if(row.space!=="N")return null;
        const cv=cellVolume(row.i),cf=NCF?NCF[row.i]:0;
        if(cv==null||cv<volMin||cv>volMax)return null;
        if(volNoFrag&&(cf&2))return null;
        if(volNoMerge&&(cf&1))return null;
      }
      let recAct=null;
      if(recOn){''')
rep('''recActive:recOn&&recSel!=="not",recSel,recClips};''', '''recActive:recOn&&recSel!=="not",recSel,recClips,volActive:volOn};''')
open(P, "w", encoding="utf-8").write(s); print("patched", len(s))
