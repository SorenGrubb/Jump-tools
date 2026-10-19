"""µJump Browse card: Show / Review / Identify (Søren, 2026-10-18), restored from δJump's copy of
the same change. Idempotent: skips if the Review button is already there."""
import sys
P=sys.argv[1]; s=open(P,encoding="utf-8").read()
if '>Review</button>' in s: print("already has Show/Review/Identify"); sys.exit(0)
def rep(a,b):
    global s
    n=s.count(a)
    if n!=1: raise SystemExit(f"anchor x{n}: {a[:90]!r}")
    s=s.replace(a,b)
rep('''<label>Browse a cell <span style="font-weight:400;text-transform:none;letter-spacing:normal;color:var(--mut);font-size:12px">&mdash; pick a type and draw an example, or take a random one</span></label>''',
    '''<label>Browse a cell <span style="font-weight:400;text-transform:none;letter-spacing:normal;color:var(--mut);font-size:12px">&mdash; pick a type to see or review one, or identify a cell nobody has named</span></label>''')
i=s.index('<div class="row" style="gap:8px;margin-top:2px">\n<select id="randomTypeSelect"')
j=s.index('<p class="hint" id="unclCount"',i)
s=s[:i]+'''<select id="randomTypeSelect" style="width:100%;margin-top:2px"></select>
<!-- 2026-10-18, Søren: "I think we could have the community identified button next to the random
     example. Instead of random example, it should be "Show" and instead of community identified it
     should be "review" and load a cell identified as the cell type chosen in the dropdown menu, and
     instead of random unassigned it should be "Identify"." The ids are unchanged, so every handler,
     check and core/panel.js's jump-to-the-card still finds them. -->
<div class="row" style="gap:8px;margin-top:8px">
<button class="idbtn" id="randomOfType" style="flex:1 1 0" title="A random cell of the chosen type &mdash; a new one each click, for learning what the type looks like">Show</button>
<button class="idbtn" id="randomCommunityId" style="flex:1 1 0" title="A random cell the community has identified as the chosen type &mdash; confirm the call, or challenge it">Review</button>
</div>
<button class="idbtn" id="randomUnclassified" style="width:100%;margin-top:8px;margin-bottom:8px" title="A random cell that nobody has named yet, of any type &mdash; help identify it">Identify</button>
'''+s[j:]
# the community button after the unclCount line is now gone? remove the old one if it survived
old='<button class="idbtn" id="randomCommunityId" style="width:100%;margin-bottom:2px"'
k=s.find(old)
if k>=0:
    e=s.index('</button>',k)+len('</button>')
    s=s[:k]+s[e:].lstrip("\n") if False else s[:k]+s[e+1:] if s[e]=="\n" else s[:k]+s[e:]
rep('''  let i=-2;
  try{i=await window.pickCommunityIdentifiedIndex();}catch(_){i=-2;}
  randomCommunityIdBtn.disabled=false;randomCommunityIdBtn.textContent=orig;
  if(i===-2){alert("Couldn't reach the list of community reports (REPORT_ENDPOINT missing or unreachable), so there's no way to tell which cells have been identified.");return;}
  if(i===-1){alert("No community-identified cells yet — every cell the community has named will show up here. Use \\"Random unassigned cell\\" to name the first one.");return;}''',
'''  /* Review: a cell the community has identified as the type in the dropdown (pickCommunityOfType). */
  const sel=randomTypeSelect?randomTypeSelect.value:null;
  const pool=sel?(window.RAND_POOLS||{})[sel]:null;
  const opt=randomTypeSelect&&randomTypeSelect.selectedOptions[0];
  const label=(pool&&pool.label)||(opt?String(opt.textContent).replace(/\\s*\\(\\d[\\d,]*\\)\\s*$/,""):"");
  if(!label||!window.pickCommunityOfType){randomCommunityIdBtn.disabled=false;randomCommunityIdBtn.textContent=orig;alert("Pick a cell type first.");return;}
  let i=-2;
  try{i=await window.pickCommunityOfType(label);}catch(_){i=-2;}
  randomCommunityIdBtn.disabled=false;randomCommunityIdBtn.textContent=orig;
  if(i===-2){alert("Couldn't reach the list of community reports, so there's no way to tell which cells have been identified.");return;}
  if(i===-1){alert("Nobody has identified a cell as "+label+" yet. Use Identify to name one.");return;}''')
rep('''    if(!pool.length)return -1;
    return pool[Math.floor(Math.random()*pool.length)];
  };
  async function refreshUnclassifiedCounts(force){''','''    if(!pool.length)return -1;
    return pool[Math.floor(Math.random()*pool.length)];
  };
  /* REVIEW, BY TYPE (2026-10-18). The cells somebody has identified as the type chosen in the
     dropdown -- any cell, predicted or not, because a community call on a predicted cell is just as
     much a call to confirm or challenge. A report counts when its identity is the type's own name,
     the same name through longName() ("oligo" → "Oligodendrocyte"), the same code in brackets
     ("23P"), or a qualified form of it ("Mural cell - Pericyte"). -2: the report list could not
     be reached; -1: nobody has called a cell this type yet. */
  window.pickCommunityOfType=async function(label){
    const rep=await fetchAllReports();
    if(!rep)return -2;
    const norm=s=>String(s||"").toLowerCase().replace(/\\s+/g," ").trim();
    const code=s=>{const m=/\\(([^)]+)\\)\\s*$/.exec(String(s||""));return m?m[1].toLowerCase():"";};
    const L=norm(label),LC=code(label);
    const same=r=>{
      const R=norm(r);if(!R)return false;
      if(R===L)return true;
      try{if(typeof longName==="function"&&norm(longName(r))===L)return true;}catch(_e){}
      if(LC&&(R===LC||code(r)===LC))return true;
      return R.endsWith(" - "+L);
    };
    if(!window.__NID_INDEX){const m=new Map();for(let i=0;i<N;i++)m.set(String(NID[i]),i);window.__NID_INDEX=m;}
    const pool=[];
    rep.byNucleus.forEach((list,nid)=>{
      if(!Array.isArray(list))return;
      if(list.some(x=>x&&!x.notNucleus&&same(x.identified))){const i=window.__NID_INDEX.get(String(nid));if(i!=null)pool.push(i);}
    });
    if(!pool.length)return -1;
    return pool[Math.floor(Math.random()*pool.length)];
  };
  async function refreshUnclassifiedCounts(force){''')
open(P,"w",encoding="utf-8").write(s); print("Show/Review/Identify applied")
