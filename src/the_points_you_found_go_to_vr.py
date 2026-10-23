# -*- coding: utf-8 -*-
u"""The points you found go to VR.                                                 2026-10-23

Søren, 2026-10-15: *"In connectivity, there should be a +VR button to add the target cell and the
input and output synapses found to VR"* — and the same for Astrocyte–synapse proximity and Cell
contacts. Eight days later, asked to make sure every way into VR was covered by the walkthrough, I
went looking for those buttons and **they were never there**.

WHAT WAS ALREADY BUILT, which is why this is three buttons and not a feature:

  core/vrbasket.js   merge({ds, root, nuc, label, syn, marks}) — unions rows into an entry that is
                     already in the collection, caps at POINT_MAX, documents the row shapes in its
                     own header. **Zero callers anywhere in the tree.**
  vr.html            reads c.syn and c.marks, draws them, and captureScene() keeps them per cell,
                     so a saved scene carries points a headset link cannot.
  the tray           already says "Synapses and contact points are too many for the headset link:
                     open the viewer here, press 💾 Save scene…" — advice about data nothing could
                     produce.

So both ends existed and agreed on the format, and the middle was missing. The row shapes, from
that header:

  syn    [x, y, z, dir, partnerRoot, partnerType]      dir 0 = input, 1 = output
  marks  [x, y, z, kind, label]                        kind "contact" | "astro"

all in tool voxels (4 × 4 × 40 nm), which is what every one of these panels already works in.

WHERE THE POINTS COME FROM, each already computed for that panel's own Neuroglancer view:

  Connectivity                  allPoints  {pos, partner, direction, size}, and allPartners
                                carries .cell_type after the type lookup — so partnerType is
                                filled rather than left blank.
  Cell contacts                 curRows    {rootId, nucleusId, cellType, cellVoxel, touchPoints}
  Astrocyte–synapse proximity   curRows    {pos, direction, partner, tripartite,
                                            astro:{rootId, nucleusId, distNm, touchVoxel}}

NOTHING IS FETCHED BY PRESSING + VR. Each button only takes what the panel has already worked out
and hands it to the basket, which is why all three are disabled until that panel has results. The
walkthrough can then describe them honestly, which is where this started.

Check: vrpointscheck.js (new) — the buttons exist, are disabled until there are results, and the
       row shapes match what core/vrbasket.js and vr.html agree on.
Run: python3 src/the_points_you_found_go_to_vr.py, then python3 src/build_stamps.py,
     then node vrpointscheck.js && node tourcheck.js
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UJ = os.path.join(HERE, "ujump.html")


def edit(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    before = s
    print(os.path.basename(path))
    for name, old, new, marker in ((p + (None,))[:4] for p in pairs):
        if marker is not None:
            if marker in s:
                print("  already there: " + name)
                continue
        elif (new and new in s) or (not new and old not in s):
            print("  already there: " + name)
            continue
        n = s.count(old)
        assert n == 1, "%s: %d" % (name, n)
        s = s.replace(old, new, 1)
        print("  ok: " + name)
    if s != before:
        io.open(path, "w", encoding="utf-8").write(s)
        return True
    return False


# ── THE ONE HELPER ALL THREE USE ──────────────────────────────────────────────────────────────
# Written once, because "take what the panel found, hand it to the basket, say what happened" is
# the whole of what each button does and three copies of it would drift. It is deliberately dumb:
# no fetching, no computing, no knowledge of which panel called it.
HELPER = u"""<script>
/* ── "+ VR" for the points a panel has already found ───────────────────────────────  2026-10-23
   Søren, 2026-10-15: "In connectivity, there should be a +VR button to add the target cell and
   the input and output synapses found to VR" -- and the same for Cell contacts and
   Astrocyte-synapse proximity. core/vrbasket.js has carried syn/marks and a merge() for them ever
   since, vr.html has drawn them ever since, and until now nothing in any tool called merge().

   This is the middle. It does not fetch or compute anything: a panel passes what it has already
   worked out for its own Neuroglancer view, and this puts it in the collection.

   MERGE, NOT ADD, on purpose. Pressing "+ VR" on the cell itself and then again in Connectivity
   should give you one cell carrying its synapses, not two entries or a refusal -- merge() unions
   the rows into an entry already there and keeps its label. */
function ujVrPoints(o){
  if (!window.UJ || !UJ.vrbasket) return;
  var root = String(o.root || "");
  if (!root) { ujVrPointsSay(o.sayEl, "No root ID for this cell yet \\u2014 nothing to attach points to.", true); return; }
  var entry = { ds: (UJ.cfg && UJ.cfg.id) || "microns", root: root, nuc: o.nuc ? String(o.nuc) : "",
                label: o.label || "Cell" };
  if (o.syn && o.syn.length) entry.syn = o.syn;
  if (o.marks && o.marks.length) entry.marks = o.marks;
  var n = (o.syn ? o.syn.length : 0) + (o.marks ? o.marks.length : 0);
  var r = UJ.vrbasket.merge(entry);
  if (!r.ok) { ujVrPointsSay(o.sayEl, "Your browser refused to store it \\u2014 the collection is full.", true); return; }
  ujVrPointsSay(o.sayEl, (r.added ? "Added this cell to the VR collection with " : "Added to this cell in the VR collection: ")
    + n + " " + (o.what || "points") + ". Open the viewer from the collection pill, bottom right."
    + (n > 400 ? " Too many points for the headset link \\u2014 use \\u00d7 Save scene in the viewer." : ""), false);
}
function ujVrPointsSay(el, msg, bad){
  var e = (typeof el === "string") ? document.getElementById(el) : el;
  if (!e) { return; }
  e.textContent = msg;
  e.style.color = bad ? "#f0883e" : "var(--accent)";
}
</script>
"""

BTN = (u'<button class="idbtn" id="%s" disabled title="%s" '
       u'style="padding:3px 10px;font-size:12px">\U0001f97d + VR</button>')

changed = edit(UJ, [
    # The helper goes in just before core/vrbasket.js is loaded, so the function exists before any
    # panel is built and the two live beside each other in the document.
    (u"the one + VR helper, loaded with the basket",
     u'<!-- "+ VR" beside each mesh button: collect cells for the VR viewer (vr.html). 2026-10-13 -->',
     HELPER +
     u'<!-- "+ VR" beside each mesh button: collect cells for the VR viewer (vr.html). 2026-10-13 -->',
     u"function ujVrPoints("),

    # ── 1. CONNECTIVITY ───────────────────────────────────────────────────────────────────────
    (u"a + VR button in Connectivity",
     u"""+'<button class="idbtn" id="connGo">Query</button>'""",
     u"""+'<button class="idbtn" id="connGo">Query</button>'
      +'""" + (BTN % (u"connVR",
                     u"Adds this cell to the VR collection together with every synapse of the "
                     u"partners shown - input and output, drawn on the cell in the viewer. "
                     u"Nothing is fetched: these are the synapses this query already found.")) +
     u"""'"""),

    (u"...which Connectivity fills once a query has returned",
     u"""        const shownIds=new Set(shown.map(p=>p.partner));
        const points=doSyn?allPoints.filter(p=>shownIds.has(p.partner)):[];""",
     u"""        const shownIds=new Set(shown.map(p=>p.partner));
        const points=doSyn?allPoints.filter(p=>shownIds.has(p.partner)):[];
        /* The same synapses, in core/vrbasket.js's row shape. Taken from the SHOWN partners (the
           ones topN/minSyn kept) rather than all of them, so what goes to VR is what the panel
           is showing -- and regardless of the "show synapse points" checkbox, which is about the
           Neuroglancer view rather than about this. 2026-10-23. */
        const typeByRoot=new Map(allPartners.map(p=>[String(p.partner),p.cell_type||""]));
        connVRPayload={root:queryRootId,nuc:nucleusId,label:(cellType||"Cell"),
          what:"synapses",
          syn:allPoints.filter(p=>shownIds.has(p.partner)).map(p=>[
            p.pos[0],p.pos[1],p.pos[2],p.direction==="input"?0:1,
            String(p.partner),typeByRoot.get(String(p.partner))||""])};
        const connVRBtn=bod.querySelector("#connVR");
        if(connVRBtn)connVRBtn.disabled=!connVRPayload.syn.length;"""),

    (u"...and the button that hands them over",
     u"""    const setStatus=(msg,cls)=>{const s2=bod.querySelector("#connStatus");if(s2){s2.textContent=msg;s2.style.color=cls==="err"?"#ff7a7a":cls==="ok"?"#6ee7a0":"var(--mut)";}};""",
     u"""    const setStatus=(msg,cls)=>{const s2=bod.querySelector("#connStatus");if(s2){s2.textContent=msg;s2.style.color=cls==="err"?"#ff7a7a":cls==="ok"?"#6ee7a0":"var(--mut)";}};
    /* Filled by the query below; the button stays disabled until it is. 2026-10-23. */
    let connVRPayload=null;
    const connVRB=bod.querySelector("#connVR");
    if(connVRB)connVRB.addEventListener("click",()=>{
      if(!connVRPayload)return;
      ujVrPoints(Object.assign({sayEl:bod.querySelector("#connStatus")},connVRPayload));
    });"""),

    # ── 2. CELL CONTACTS ──────────────────────────────────────────────────────────────────────
    (u"a + VR button in Cell contacts",
     u"""    +'<button class="idbtn" id="'+uid+'_xlsx" disabled""",
     u"""    +'<button class="idbtn" id="'+uid+'_vr" disabled title="Adds this cell to the VR collection with every touch point found, drawn on it in the viewer. Nothing is fetched: these are the points this panel already computed." style="padding:3px 10px;font-size:12px">\U0001f97d + VR</button>'
    +'<button class="idbtn" id="'+uid+'_xlsx" disabled"""),

    (u"...wired where its sibling buttons are",
     u"""    nglBtn=document.getElementById(uid+"_ngl"),xlsxBtn=document.getElementById(uid+"_xlsx"),""",
     u"""    nglBtn=document.getElementById(uid+"_ngl"),xlsxBtn=document.getElementById(uid+"_xlsx"),
    vrBtn=document.getElementById(uid+"_vr"),"""),

    (u"...and enabled with them once contacts have been checked",
     u"""      nglBtn.disabled=!results.length;xlsxBtn.disabled=!results.length;""",
     u"""      nglBtn.disabled=!results.length;xlsxBtn.disabled=!results.length;
      /* Touch points are MARKS, not synapses: a place two membranes come within the gap, which is
         a different kind of claim from "a synapse is here". vr.html colours them apart for that
         reason. 2026-10-23. */
      if(vrBtn)vrBtn.disabled=!results.some(r=>(r.touchPoints||[]).length);"""),

    # ── 3. ASTROCYTE–SYNAPSE PROXIMITY ────────────────────────────────────────────────────────
    (u"a + VR button in Astrocyte–synapse proximity",
     u"""    +'<button class="idbtn" id="'+uid+'_ngl" disabled title="Opens every checked synapse, its partner, and every astrocyte process found, together in one 4-panel Neuroglancer view.">Open all in Neuroglancer</button>'""",
     u"""    +'<button class="idbtn" id="'+uid+'_ngl" disabled title="Opens every checked synapse, its partner, and every astrocyte process found, together in one 4-panel Neuroglancer view.">Open all in Neuroglancer</button>'
    +'<button class="idbtn" id="'+uid+'_vr" disabled title="Adds this cell to the VR collection with the synapses checked AND the astrocyte contact point found at each one - so a tripartite candidate is two points you can look between in the viewer. Nothing is fetched here." style="padding:3px 10px;font-size:12px">\U0001f97d + VR</button>'"""),

    (u"...wired beside its Neuroglancer button",
     u"""    checkBtn=document.getElementById(uid+"_check"),nglBtn=document.getElementById(uid+"_ngl"),""",
     u"""    checkBtn=document.getElementById(uid+"_check"),nglBtn=document.getElementById(uid+"_ngl"),
    vrBtn=document.getElementById(uid+"_vr"),"""),

    (u"...and enabled once the check has run",
     u"""      nglBtn.disabled=!results.length;
""",
     u"""      nglBtn.disabled=!results.length;
      if(vrBtn)vrBtn.disabled=!results.length;
"""),
])

# The two click handlers whose panels build their controls into a uid-prefixed id space. Added
# separately from the enabling above because they belong at the end of each panel's wiring, where
# curRows is in scope.
changed = edit(UJ, [
    (u"Cell contacts hands its touch points over",
     u"""  nglBtn.addEventListener("click",function(){
    if(!curRows.length||!rootId0)return;
    openCellContactsAllViewer(i,rootId0,cellType,typeSel.value,curRows);
  });""",
     u"""  if(vrBtn)vrBtn.addEventListener("click",function(){
    const marks=[];
    curRows.forEach(function(r){
      (r.touchPoints||[]).forEach(function(v){
        marks.push([v[0],v[1],v[2],"contact",(r.cellType||"cell")+" \\u00b7 nuc "+r.nucleusId]);
      });
    });
    ujVrPoints({root:rootId0,nuc:nucleusId,label:(cellType||"Cell"),what:"touch points",
      marks:marks,sayEl:statusEl});
  });
  nglBtn.addEventListener("click",function(){
    if(!curRows.length||!rootId0)return;
    openCellContactsAllViewer(i,rootId0,cellType,typeSel.value,curRows);
  });"""),

    (u"Astrocyte–synapse proximity hands both kinds over",
     u"""  nglBtn.addEventListener("click",function(){
    if(!curRows.length||!rootId0)return;
    openTripartiteViewer(i,rootId0,cellType,curRows);
  });""",
     u"""  if(vrBtn)vrBtn.addEventListener("click",function(){
    /* BOTH kinds, because that is what makes the pair legible in the viewer: the synapse as a
       synapse (with its direction and partner) and the astrocyte's nearest point as a mark. A
       tripartite candidate is then two points a few tens of nanometres apart that you can stand
       between. 2026-10-23. */
    const syn=[],marks=[];
    curRows.forEach(function(r){
      if(r.pos)syn.push([r.pos[0],r.pos[1],r.pos[2],r.direction==="input"?0:1,String(r.partner||""),""]);
      if(r.astro&&r.astro.touchVoxel)
        marks.push([r.astro.touchVoxel[0],r.astro.touchVoxel[1],r.astro.touchVoxel[2],"astro",
          "astrocyte "+r.astro.rootId+(r.astro.distNm!=null?" \\u00b7 "+Math.round(r.astro.distNm)+" nm":"")]);
    });
    ujVrPoints({root:rootId0,nuc:nucleusId,label:(cellType||"Cell"),
      what:"synapses and astrocyte points",syn:syn,marks:marks,sayEl:statusEl});
  });
  nglBtn.addEventListener("click",function(){
    if(!curRows.length||!rootId0)return;
    openTripartiteViewer(i,rootId0,cellType,curRows);
  });"""),
])

print(u"\nNow: python3 src/build_stamps.py, then node vrpointscheck.js && node tourcheck.js")
