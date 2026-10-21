"""Vessel distance and vessel type from the TriSAM SURFACE (2026-10-21), into ujump.html.
Reads vessel_surface.npz (from vessel_surface.py) and embeds, densely for every nucleus (N) and every
own-data standalone point (ST):
  dist  uint16, 0.1 µm, distance from the point to the nearest point of the TriSAM mesh surface
  fine  uint8, index into FINE_NAMES (10 old names + "capillary beyond the 3rd order (mid-bed)" +
        "principal cortical venule"), 255 = a vessel neither tracing reaches
  src   uint8, 1 Søren's tracing, 2 Shih et al., 3 filled in from the surrounding surface, 0 none
These REPLACE OWN_FINE / ST_FINE / OWN_FINE_DIST / ST_FINE_DIST (the old skeleton-based ones stay
readable as window.OWN_FINE_SKEL etc.). Idempotent: re-running replaces the block.
Usage: python patch_ujump_vsurf.py ujump.html vessel_surface.npz"""
import sys, re, json, base64, numpy as np
P, NPZ = sys.argv[1], sys.argv[2]
s = open(P, encoding="utf-8").read()
d = np.load(NPZ, allow_pickle=True)
N, SN = int(d["N"]), int(d["SN"])
nuc = json.loads(re.search(r'id="nucdata">(\{.*?\})</script>', s, re.S).group(1))
assert nuc["N"] == N, "nucleus count changed -- recompute vessel_surface.npz"
e = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
dist, fine, src = d["dist01"], d["fine"].astype(np.uint8), d["src"].astype(np.uint8)
blk = {"UNIT_NM": 100, "NONE": 65535, "N": N, "SN": SN,
       "NEW_NAMES": ["capillary beyond the 3rd order (mid-bed)", "principal cortical venule"],
       "OV_DIST": e(dist[:N]), "ST_DIST": e(dist[N:]), "OV_FINE": e(fine[:N]), "ST_FINE": e(fine[N:]),
       "OV_SRC": e(src[:N]), "ST_SRC": e(src[N:])}
BLOCK = ('<script type="application/json" id="vascsurf13">' + json.dumps(blk, separators=(",", ":")) + '</script>\n<script>\n'
'''(function(){
  /* ── VESSEL DISTANCE AND TYPE FROM THE VESSEL SURFACE ── 2026-10-21 ───────────────────────────
     Søren: "make sure that the distance to any type of vasculature is based on the Wan et al and not
     only on the vascular skeletons or my tracings. So that the distance is always to the nearest
     surface of the vascular mesh. It should of course use my tracing and the tracing of Shih et al
     to determine what vascular segment it is. Just like for the VR."
     src/vessel_surface/vessel_surface.py: every vertex of Wan & Wei's TriSAM mesh is named by the VR
     viewer's rules (Søren's tracing where he traced, Shih et al.'s calibrated orders elsewhere, pial
     vessels by what they connect to, gaps filled from the surrounding surface); each point's
     distance is to the nearest point of the mesh SURFACE (point-to-triangle), and its type is the
     type there. Dense for every nucleus and standalone point; replaces the skeleton-based arrays
     (kept as *_SKEL). fine 255 = the nearest vessel is one neither tracing reaches. */
  const VS=JSON.parse(document.getElementById("vascsurf13").textContent);
  window.OWN_FINE_SKEL=window.OWN_FINE;window.ST_FINE_SKEL=window.ST_FINE;
  window.OWN_FINE_DIST_SKEL=window.OWN_FINE_DIST;window.ST_FINE_DIST_SKEL=window.ST_FINE_DIST;
  for(const nm of VS.NEW_NAMES)if(FINE_NAMES.indexOf(nm)<0)FINE_NAMES.push(nm);
  const dist=(k,n)=>{const u=new Uint16Array(b64(VS[k]).buffer),o=new Float32Array(n);for(let i=0;i<n;i++){const v=i<u.length?u[i]:VS.NONE;o[i]=v===VS.NONE?DIST_NONE:v*VS.UNIT_NM;}return o;};
  const u8=(k,n,f)=>{const u=b64(VS[k]),o=new Uint8Array(n).fill(f);o.set(u.subarray(0,Math.min(n,u.length)));return o;};
  window.OWN_FINE_DIST=dist("OV_DIST",N);window.ST_FINE_DIST=dist("ST_DIST",ST_N);
  window.OWN_FINE=u8("OV_FINE",N,255);window.ST_FINE=u8("ST_FINE",ST_N,255);
  window.OWN_FINE_SRC=u8("OV_SRC",N,0);window.ST_FINE_SRC=u8("ST_SRC",ST_N,0);
})();
function fineSrcName(v){return v===1?"Søren's tracing":v===2?"Shih et al.":v===3?"filled in from the surrounding surface":"";}
</script>
''')
if 'id="vascsurf13"' in s:
    a = s.index('<script type="application/json" id="vascsurf13">')
    b = s.index('function fineSrcName(v)', a); b = s.index('</script>\n', b) + len('</script>\n')
    s = s[:a] + BLOCK + s[b:]
    open(P, "w", encoding="utf-8").write(s); print("block replaced"); sys.exit(0)

def rep(a, b):
    global s
    assert s.count(a) == 1, ("anchor", s.count(a), a[:90]); s = s.replace(a, b)
# 1. the block, after the last vessel-type script (the VD11 fix)
anchor = '''  for(let k=0;k<stIdx11f.length;k++){const idx=stIdx11f[k];if(ST_FINE[idx]===255)ST_FINE[idx]=stVal11f[k];}
})();
</script>
'''
rep(anchor, anchor + BLOCK)
# 2. dropdown: the two new classes in their places
rep("const FINE_DISPLAY_ORDER=[5,2,4,8,0,7,1,9,3,6];", "const FINE_DISPLAY_ORDER=[5,2,4,8,0,10,7,1,9,3,11,6];")
rep('''<option value="__any__">Near any vessel type</option>';''', '''<option value="__any__">Near any vessel</option>';''')
# 3. a type picked without a distance means within 10 µm of the surface (the data is now dense:
#    every cell has a nearest vessel, however far)
rep('''      if(vesselSel){
        if(vesselSel==="__any__"){
          if(fineDist===null)return null;
        } else {
          if(fine===null)return null;
          if(String(fine)!==vesselSel)return null;
        }
      }''', '''      if(vesselSel){
        if(vesselSel==="__any__"){
          if(fineDist===null)return null;
        } else {
          if(fine===null)return null;
          if(String(fine)!==vesselSel)return null;
        }
        /* 2026-10-21: since the vessel data is dense (every cell has a nearest vessel surface, however
           far), "near" a vessel picked here without the distance box means within 10 µm of its surface. */
        if(!vesselDistOn&&(fineDist===null||fineDist>10000))return null;
      }''')
# 4. texts
rep('''title="Vessel proximity comes from Søren's hand-traced vessel skeleton;''',
    '''title="Vessel proximity is the distance to the nearest point of the vessel SURFACE (Wan &amp; Wei's TriSAM mesh), and the vessel type there comes from Søren's tracing and, where he did not trace, Shih et al.'s (How et al. 2026) calibrated branch orders -- the same rules as the VR viewer;''')
rep('''<span style="font-size:12px;color:var(--mut)">µm of the nearest traced vessel point</span>''',
    '''<span style="font-size:12px;color:var(--mut)">µm of the nearest vessel surface (TriSAM). A vessel type picked above without this box means within 10 µm.</span>''')
s = re.sub(r'(<input type="text" id="filterVesselDist" value="10" style="width:50px;padding:4px 6px" inputmode="decimal" title=")[^"]*(")',
           lambda m: m.group(1) + "Distance from the nucleus centre to the nearest point of the vessel SURFACE in Wan &amp; Wei&#39;s TriSAM segmentation (point to triangle), for every cell, recomputed 2026-10-21. A nucleus touching a vessel reads a few µm (its own radius); a cell inside the vessel wall can read less." + m.group(2), s, count=1)
# 5. Excel
rep('''      {header:"Distance to nearest vessel (µm)",get:m=>m.fineDist!=null&&m.fineDist!==DIST_NONE?(m.fineDist/1000).toFixed(1):""},''',
    '''      {header:"Distance to nearest vessel surface (µm)",get:m=>m.fineDist!=null&&m.fineDist!==DIST_NONE?(m.fineDist/1000).toFixed(1):""},
      {header:"Vessel type from",get:m=>{if(m.fine==null||m.row.space==="MS")return "";const a=m.row.space==="N"?window.OWN_FINE_SRC:window.ST_FINE_SRC;return a?fineSrcName(a[m.row.i]):"";}},''')
open(P, "w", encoding="utf-8").write(s); print("patched", len(s))
