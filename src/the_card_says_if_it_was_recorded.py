"""A one-line 'Recorded activity' badge at the top of µJump's identity card (2026-10-19), beside the
visual-area tag, so whether the cell was imaged -- and when it was active -- is seen without
scrolling to the panel. Clicking it opens and scrolls to the panel. Idempotent."""
import sys
P=sys.argv[1]; s=open(P,encoding="utf-8").read()
if 'id="recActBadge"' in s: print("badge already there"); sys.exit(0)
def rep(a,b):
    global s
    n=s.count(a)
    if n!=1: raise SystemExit(f"anchor x{n}: {a[:90]!r}")
    s=s.replace(a,b)
rep('''  if(typeof areaOfIndex==="function")h+=areaBadgeHtml(areaOfIndex(i));''',
    '''  if(typeof areaOfIndex==="function")h+=areaBadgeHtml(areaOfIndex(i));
  if(UJ.recact&&(!UJ.cfg||!UJ.cfg.id||UJ.cfg.id==="microns"))h+='<div class="meta" style="margin-top:6px"><span class="tag" id="recActBadge" style="cursor:pointer;background:var(--line);color:var(--mut)" title="Two-photon recorded activity (MICrONS, DANDI:000402). Click for the details further down.">Recorded activity: checking…</span></div>';''')
rep('''  const e=UJ.recact.get(root),Z=2;''','''  const e=UJ.recact.get(root),Z=2;
  /* The badge at the top of the card says the same in one line. */
  const bd=document.getElementById("recActBadge");
  if(bd){
    const sp0=e?UJ.recact.spans(e,Z):[],cl0=[...new Set(sp0.map(x=>x.clip+1))];
    bd.textContent=!e?"Recorded activity: not imaged":cl0.length?"Recorded activity: active in clip"+(cl0.length>1?"s ":" ")+cl0.join(", ")+" · r "+(e.os!=null?e.os.toFixed(2):"–"):"Recorded activity: imaged, no strong response · r "+(e.os!=null?e.os.toFixed(2):"–");
    bd.style.background=!e?"var(--line)":cl0.length?"rgba(63,185,80,.18)":"rgba(210,153,34,.18)";
    bd.style.color=!e?"var(--mut)":cl0.length?"#3fb950":"#d29922";
    bd.onclick=()=>{const d=el.querySelector("details");if(d)d.open=true;el.scrollIntoView({behavior:"smooth",block:"center"});};
  }''')
open(P,"w",encoding="utf-8").write(s); print("badge added")
