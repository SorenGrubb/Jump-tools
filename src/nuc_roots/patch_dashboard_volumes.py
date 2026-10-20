import sys
P = sys.argv[1] if len(sys.argv) > 1 else "ujump.html"
s = open(P, encoding="utf-8").read()
if "function precomputedVolumeRows(" in s: print("already"); sys.exit(0)
def rep(a, b):
    global s
    assert s.count(a) == 1, ("anchor", s.count(a), a[:80]); s = s.replace(a, b)
rep('''function meshVolumeByType(){
  const byType={};''', '''/* PRECOMPUTED WHOLE-CELL VOLUMES (2026-10-20, Søren: "I'm not sure there are more points on the
   volume graph"). The two mesh-volume charts used to grow only from "Compute volume" clicks. Every
   MICrONS nucleus now carries a precomputed seg_m1300 mesh volume (cellVolume/cellVolNote, packed by
   src/nuc_roots/pack_volumes.py), so the charts draw from that: one row per identified cell, its
   CURRENT identity (buildAllIdentities -- own-verified, community, MICrONS prediction, in that
   order), merges and fragments left out (NCF bits 1 and 2), merged-nucleus sub-cells left out (their
   volume is the whole blob's). A type with more than PRECOMP_MAX_DOTS cells is drawn from an evenly
   spaced sample of its sorted volumes -- the same distribution, without 30,000 jittered dots on a
   phone; the footnote gives the real n. */
const PRECOMP_MAX_DOTS=1500;
let _precompRows=null;
function precomputedVolumeRows(){
  if(_precompRows)return _precompRows;
  if(typeof window.buildAllIdentities!=="function"||typeof cellVolume!=="function"||typeof NCF==="undefined"||!NCF)return null;
  const out=[];
  for(const r of window.buildAllIdentities()){
    if(r.space!=="N"||r.merged)continue;
    const v=cellVolume(r.i);if(v==null||!(v>0))continue;
    if(NCF[r.i]&3)continue;
    const t=typeof longName==="function"?longName(r.type):r.type;
    out.push({cellType:t,volumeUm3:v,nucVolumeUm3:(typeof NV!=="undefined"&&NV[r.i]>0)?NV[r.i]:0});
  }
  _precompRows=out;return out;
}
function sampleSorted_(a,k){
  if(a.length<=k)return a;
  const b=a.slice().sort((x,y)=>x-y),o=[];
  for(let j=0;j<k;j++)o.push(b[Math.floor((j+0.5)*b.length/k)]);
  return o;
}
function precomputedByType_(valueOf){
  const rows=precomputedVolumeRows();if(!rows)return null;
  const byType={},n={};
  rows.forEach(function(r){
    if(isUnclassifiedType(r.cellType)||isMergedBlobType(r.cellType)||!inSelectedVolumeCategory(r.cellType))return;
    const v=valueOf(r);if(v==null)return;
    (byType[r.cellType]=byType[r.cellType]||[]).push(v);
  });
  Object.keys(byType).forEach(function(t){n[t]=byType[t].length;byType[t]=sampleSorted_(byType[t],PRECOMP_MAX_DOTS);});
  return {byType,n};
}
function precompNote_(area,n,what){
  const tot=Object.values(n).reduce((a,b)=>a+b,0);if(!tot)return;
  const p=document.createElement("p");p.className="footnote";
  p.title="Whole-cell volumes precomputed for every MICrONS nucleus from its seg_m1300 mesh (coarse level of detail, so an estimate). Merges (one segment holding several nuclei) and fragments (a segment smaller than its own nucleus) are left out.";
  p.textContent=what+" · n = "+tot.toLocaleString("en-US")+" cells ("+Object.keys(n).map(t=>shortAxisLabel(t)+" "+n[t].toLocaleString("en-US")).join(", ")+")"+(Object.values(n).some(x=>x>PRECOMP_MAX_DOTS)?" · large types drawn from "+PRECOMP_MAX_DOTS+" evenly spaced values each":"");
  area.parentNode.querySelectorAll(".footnote.precomp").forEach(e=>e.remove());p.classList.add("precomp");
  area.parentNode.insertBefore(p,area.nextSibling);
}
function meshVolumeByType(){
  const pc=precomputedByType_(r=>r.volumeUm3);
  if(pc&&Object.keys(pc.byType).length){meshVolumeByType.n=pc.n;return pc.byType;}
  meshVolumeByType.n=null;
  const byType={};''')
rep('''  area.innerHTML="";
  dotMedianChart(area.id,byType,"Whole-cell (mesh) volume (µm³)",true,true);
}''', '''  area.innerHTML="";
  dotMedianChart(area.id,byType,"Whole-cell (mesh) volume (µm³)",true,true);
  if(meshVolumeByType.n)precompNote_(area,meshVolumeByType.n,"Precomputed for every identified cell");
}''')
rep('''  const allRows=(rows||[]).filter(r=>r.cellType&&r.volumeUm3&&!isMergedBlobType(r.cellType)&&!isUnclassifiedType(r.cellType)&&inSelectedCategory(r.cellType));''',
'''  /* Precomputed whole-cell volumes, when there, make every identified cell a same-cell pair (its
     nucleus volume NV and its mesh volume) -- see precomputedVolumeRows(). */
  const pcRows=precomputedVolumeRows();
  const allRows=(pcRows&&pcRows.length?pcRows:(rows||[])).filter(r=>r.cellType&&r.volumeUm3&&!isMergedBlobType(r.cellType)&&!isUnclassifiedType(r.cellType)&&inSelectedCategory(r.cellType));''')
rep('''    dotMedianChart(area.id,filteredByType,"Nucleus volume (% of whole-cell mesh volume)",true,true);''',
'''    Object.keys(filteredByType).forEach(function(t){filteredByType[t]=sampleSorted_(filteredByType[t],PRECOMP_MAX_DOTS);});
    dotMedianChart(area.id,filteredByType,"Nucleus volume (% of whole-cell mesh volume)",true,true);''')
# subtitles
rep('''LIVE, grows with every signed-in &ldquo;Compute volume&rdquo; click, identified cells only (unclassified cells excluded). Uses the same category selector as the nucleus-volume chart above.</p>''',
'''Precomputed for every identified cell from its seg_m1300 mesh (merges and fragments left out); falls back to the live &ldquo;Compute volume&rdquo; clicks if that data is missing. Pick the category with the selector on the nucleus-volume chart above.</p>''')
rep('''LIVE, grows with every signed-in &ldquo;Compute volume&rdquo; click, identified cells only (unclassified cells excluded). Uses the same category selector as the two volume charts above.</p>''',
'''Every identified cell: its nucleus volume ÷ its precomputed whole-cell volume. Uses the same category selector as the two volume charts above.</p>''')
open(P, "w", encoding="utf-8").write(s); print("patched", len(s))
