# -*- coding: utf-8 -*-
r"""Somebody else's volume, drawn here.                                              2026-10-13

Søren: *"I would also like that the dJump coordinate can open EM and possibly 3D window in uJump.
Maybe it is too difficult because of shards, but let me know if it is realistic to do."*

IT IS, AND SHARDS WERE NEVER THE PROBLEM. δJump's own pad reads V1DD chunks in a browser every
day; the format, the CORS and the sharding all work. What stood in the way is that core/emtiles.js
is a PAGE-WIDE SINGLETON: one CFG, configured once, and the tracing pad is configured into it. A
preview that reconfigured the module to another volume and walked away would leave the pad reading
somebody else's tissue, which is a far worse bug than the one being fixed.

So the module gets withConfig(cfg, fn): swap CFG, run, restore in a finally. The swap is the
module's own, in the file where CFG lives, with the one honest caveat stated there — it is not
concurrency-safe, and a pad drawing DURING the await would use the foreign config. In practice
nobody traces with one hand while clicking a coordinate with the other, and the alternative is
threading a source through eight call sites of a module all eight tools share.

WHAT IS DRAWN AND WHAT IS NOT. The EM, from that tool's own imagery, at that tool's own frame,
contrast window and skipped scales — everything core/tools.js already holds. NOT the segmentation
overlay and NOT the two 3D buttons: core/segpaint.js is a singleton too, and the mesh store is
UJ.mesh's, configured for THIS page's volume. A cross-tool mesh needs each tool's mesh config in
the registry, which is a separate piece of work; until then the picture says so and the link to
that tool's own viewer is underneath it.

AND A ROOT ID IS A CELL, NOT A PLACE. The line under a foreign reference read "That is a place in
another volume" for an id, which is wrong twice: an id is not a place, and "another volume" is
what you get when the hit has no volume to name — which is every root id, because a bare id does
not say where it is. It now says which kind of thing it is and whose tool it belongs to.

Changes: core/emtiles.js, core/empreview.js, core/forum.js
Checks:  forumtabcheck.js (extended), empreviewcheck.js, emtilescheck.js
Run: python3 src/somebody_elses_volume_drawn_here.py
     node forumtabcheck.js && node empreviewcheck.js && node emtilescheck.js
"""
import io, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(rel, pairs):
    P = os.path.join(HERE, rel)
    s = io.open(P, encoding="utf-8").read(); b = s
    print(rel)
    for name, old, new in pairs:
        if new in s:
            print("  already there: " + name); continue
        n = s.count(old)
        assert n == 1, "@NM@ (@F@): @N@".replace("@NM@", name).replace(
            "@F@", os.path.basename(P)).replace("@N@", str(n))
        s = s.replace(old, new, 1); print("  ok: " + name)
    if s != b: io.open(P, "w", encoding="utf-8").write(s)


# ── 1. the reader can be borrowed for one draw ───────────────────────────────────────────────
edit("core/emtiles.js", [

 (u"the current configuration can be read, and borrowed",
  u'''  function configured(){ return !!CFG; }''',
  u'''  function configured(){ return !!CFG; }
  /* A COPY, so a caller holding it cannot change what this module is doing by editing what it was
     handed. Null before configure(), like configured() says. */
  function config(){
    if (!CFG) return null;
    var o = {}; for (var k in CFG) o[k] = CFG[k];
    return o;
  }
  /* ── DRAWING A VOLUME THIS PAGE IS NOT CONFIGURED FOR ──────────────────────────  2026-10-13
     Søren: *"I would also like that the dJump coordinate can open EM ... in uJump."*  A post in
     the shared Discussion may name a place in another tool's volume, and that volume's imagery is
     perfectly readable — it is read every day by the tool that owns it. What is not shareable is
     THIS module: one CFG per page, and the tracing pad is configured into it.

     So the swap is here, where CFG lives, and it is always undone:

       await UJ.emtiles.withConfig({em, res, skipScales}, function(){ return drawSection(...); });

     THE CAVEAT, STATED RATHER THAN HIDDEN: this is not concurrency-safe. A pad redrawing DURING
     the await would read the borrowed volume. The alternative is threading a source through every
     call site of a module all eight tools share, which is a much larger change to a much more
     load-bearing file; this one is eight lines and reverses itself. If a second caller ever wants
     it at the same time, that is the moment to pay for the bigger version.

     RESTORED BY ASSIGNMENT, not by re-running configure(): configure() normalises `em` through
     _httpBase and re-reads the page's fields, so round-tripping a config through it is a second
     chance to change it. The object that was there goes back exactly as it was. */
  async function withConfig(cfg, fn){
    var prev = CFG;
    configure(cfg);
    try { return await fn(); }
    finally { CFG = prev; }
  }'''),

 (u"...and both are exported",
  u'''  return { configure: configure, configured: configured,''',
  u'''  return { configure: configure, configured: configured,
           config: config, withConfig: withConfig,'''),
])

# ── 2. the preview draws through it, and offers nothing it cannot honour ─────────────────────
edit("core/empreview.js", [

 (u"a foreign volume is drawn without disturbing this page's reader",
  u'''    if (!UJ.emtiles.configured())
      UJ.emtiles.configure({ em: cfg.em, res: cfg.res, skipScales: cfg.skipScales || [] });
    var view = await UJ.emtiles.drawSection(cv, {
      centre: pos, w: W, h: H, mip: MIP, zoom: 1, slabOk: true,
      lo: (cfg.window || {}).lo, hi: (cfg.window || {}).hi, tighten: true,
      onProgress: function(d, n){ note("reading the EM… " + d + "/" + n); }
    });''',
  u'''    var mine = { em: cfg.em, res: cfg.res, skipScales: cfg.skipScales || [] };
    var draw = function(){
      return UJ.emtiles.drawSection(cv, {
        centre: pos, w: W, h: H, mip: MIP, zoom: 1, slabOk: true,
        lo: (cfg.window || {}).lo, hi: (cfg.window || {}).hi, tighten: true,
        onProgress: function(d, n){ note("reading the EM\\u2026 " + d + "/" + n); }
      });
    };
    /* ── WHOSE VOLUME IS THIS READER POINTED AT? ───────────────────────────────────  2026-10-13
       Three cases, and only the third is new. Nothing configured: configure and draw, as before.
       Configured at the volume we want: draw, as before. Configured at a DIFFERENT volume — a
       post from another tool, in the shared Discussion — borrow the reader for this one draw and
       give it back, because the tracing pad on this page is configured into the same module. */
    var want = (UJ.segread && UJ.segread._httpBase) ? UJ.segread._httpBase(cfg.em) : cfg.em;
    var now = (typeof UJ.emtiles.config === "function") ? UJ.emtiles.config() : null;
    var view;
    if (!UJ.emtiles.configured()){ UJ.emtiles.configure(mine); view = await draw(); }
    else if (now && now.em !== want && typeof UJ.emtiles.withConfig === "function")
      view = await UJ.emtiles.withConfig(mine, draw);
    else view = await draw();'''),

 (u"...and the segmentation is not painted over somebody else's tissue",
  u'''    var ids = (opts && opts.ids) || {};
    var root = String(ids.root || "").trim(), nuc = String(ids.nuc || "").trim();
    if ((root || nuc) && UJ.segpaint){''',
  u'''    var ids = (opts && opts.ids) || {};
    var root = String(ids.root || "").trim(), nuc = String(ids.nuc || "").trim();
    /* NOT ON A BORROWED VOLUME. core/segpaint.js is a page-wide singleton like the reader above,
       and the ids in a post from another tool are that tool's ids: painting them from this page's
       configuration would colour in the wrong cell, which looks like data. 2026-10-13. */
    if (cfg.foreign){ root = ""; nuc = ""; }
    if ((root || nuc) && UJ.segpaint){'''),

 (u"...and a cell cannot be looked up in a volume we only borrowed",
  u'''function pageCellAt(cfg){
  if (!cfg || cfg.seg || !cfg.own) return null;''',
  u'''function pageCellAt(cfg){
  if (!cfg || cfg.foreign || cfg.seg || !cfg.own) return null;'''),

 (u"...nor through a segmentation reader pointed somewhere else",
  u'''function canFindCell(cfg){ return !!(cfg && (cfg.seg || pageCellAt(cfg))); }''',
  u'''/* FOREIGN IS ALWAYS NO. The EM above can be borrowed for one draw; a cell lookup cannot, because
   core/segread.js is a singleton too and the mesh behind "The cell here in 3D" comes from UJ.mesh,
   configured for THIS page's volume. A cross-tool mesh needs each tool's mesh store in
   core/tools.js, which is its own piece of work. Until then the picture says so. */
function canFindCell(cfg){
  if (cfg && cfg.foreign) return false;
  return !!(cfg && (cfg.seg || pageCellAt(cfg)));
}'''),
])

# ── 3. the forum draws the foreign place, and says whose it is underneath ────────────────────
edit("core/forum.js", [

 (u"a foreign place is drawn from its own tool's imagery",
  u'''        if (foreign(btool)){
          ev.preventDefault();
          ev.stopPropagation();
          var fh = toolHost(btool), lab = "", fu = "";
          try {
            if (window.UJ && UJ.tools) lab = UJ.tools.label(btool);
            if (fh && UJ.jumplink) fu = UJ.jumplink.url([h], { host: fh }) || "";
          } catch (_fe){}
          open = "";
          if (canDraw) UJ.empreview.close(slot);
          slot.innerHTML = "<p class='forumelsewhere' style='font-size:12px;color:var(--mut);"
            + "margin:6px 0;line-height:1.5'>That is a place in <b>"
            + esc(h.label || h.volume || "another volume") + "</b>, which is "
            + esc(lab || btool) + "’s. The imagery on this page is a different block of tissue, "
            + "so it is not drawn here. "
            + (fu ? "<a href='" + esc(fu) + "' target='_blank' rel='noopener'>Open it in "
                    + "Neuroglancer</a>." : "")
            + "</p>";
          return;
        }''',
  u'''        if (foreign(btool)){
          ev.preventDefault();
          ev.stopPropagation();
          var fh = toolHost(btool), lab = "", fu = "";
          try {
            if (window.UJ && UJ.tools) lab = UJ.tools.label(btool);
            if (fh && UJ.jumplink) fu = UJ.jumplink.url([h], { host: fh }) || "";
          } catch (_fe){}
          lab = lab || btool;
          /* ── AND IT IS A CELL OR A PLACE, NOT ALWAYS A PLACE ──────────────────  2026-10-13
             This said "a place in another volume" for everything, which is wrong twice on a root
             id: an id is not a place, and "another volume" is the fallback for a hit with no
             volume to name — which is EVERY id, because a bare number does not say where it is. */
          var what = (h.kind === "root") ? ("segment <b>" + esc(h.id) + "</b>")
                   : (h.kind === "nucleus") ? ("cell <b>" + esc(h.id) + "</b>")
                   : ("a place in <b>" + esc(h.label || h.volume || "its volume") + "</b>");
          var line = "<p class='forumelsewhere' style=\\"font-size:12px;color:var(--mut);"
            + "margin:6px 0;line-height:1.5\\">That is " + what + ", in " + esc(lab)
            + "\\u2019s volume. "
            + (fu ? "<a href='" + esc(fu) + "' target='_blank' rel='noopener'>Open it in "
                    + "Neuroglancer</a>." : "")
            + "</p>";
          /* ── DRAWN FROM THAT TOOL'S OWN IMAGERY ───────────────────────────────  2026-10-13
             Søren: *"I would also like that the dJump coordinate can open EM ... in uJump."*
             The EM comes from the registry's sources for THAT tool, read through
             core/emtiles.js's withConfig(), which hands this page's reader back afterwards. No
             segmentation and no 3D: those modules are singletons too and the mesh store is this
             page's — core/empreview.js withholds the buttons for a foreign host and says why.
             Only a coordinate can be drawn; a bare id has no place to centre on. */
          var feh = null;
          if (canDraw && h.voxel){
            try {
              if (window.UJ && UJ.tools && UJ.tools.emHostFor)
                feh = UJ.tools.emHostFor(btool, h.voxel);
            } catch (_fh){}
          }
          if (feh){
            feh.foreign = true;
            feh.noSegWhy = "this is " + lab + "\\u2019s volume, borrowed to draw the tissue \\u2014 "
                         + "open it there to look the cell up";
            var fkey = h.voxel.join(",") + "|" + btool;
            if (open === fkey){ UJ.empreview.close(slot); open = ""; return; }
            open = fkey;
            UJ.empreview.open(slot, h.voxel, { host: feh })
              .then(function(){
                var p = document.createElement("div");
                p.innerHTML = line;
                slot.appendChild(p.firstChild);
              })
              .catch(function(){ slot.innerHTML = line; });
            return;
          }
          open = "";
          if (canDraw) UJ.empreview.close(slot);
          slot.innerHTML = line;
          return;
        }'''),

 (u"...and the append survives an open() that is not a promise",
  u"""            UJ.empreview.open(slot, h.voxel, { host: feh })
              .then(function(){""",
  u"""            /* Promise.resolve, NOT a bare .then(). core/empreview.js's open() is async today,
               but this is the one call in the module whose return value is used, and a page or a
               check that replaces open() with a plain function would otherwise throw here rather
               than simply not appending a caption. Found by forumonecheck.js doing exactly that. */
            Promise.resolve(UJ.empreview.open(slot, h.voxel, { host: feh }))
              .then(function(){"""),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_T = io.open(os.path.join(HERE, "core/emtiles.js"), encoding="utf-8").read()
assert _T.count(u"async function withConfig(cfg, fn){") == 1
assert _T.count(u"finally { CFG = prev; }") == 1, "the borrow is not given back in a finally"
assert _T.count(u"config: config, withConfig: withConfig,") == 1

_E = io.open(os.path.join(HERE, "core/empreview.js"), encoding="utf-8").read()
assert _E.count(u"UJ.emtiles.withConfig(mine, draw)") == 1
assert _E.count(u"if (cfg.foreign){ root = \"\"; nuc = \"\"; }") == 1
assert _E.count(u"if (cfg && cfg.foreign) return false;") == 1
# ONE DRAW, THREE WAYS IN, AND EXACTLY ONE OF THEM RUNS. A second drawSection left behind would
# paint the same canvas twice from two configurations, which is the worst possible outcome here.
assert _E.count(u"UJ.emtiles.drawSection(cv, {") == 1

_F = io.open(os.path.join(HERE, "core/forum.js"), encoding="utf-8").read()
assert _F.count(u"Promise.resolve(UJ.empreview.open(slot, h.voxel, { host: feh }))") == 1
assert _F.count(u"feh.foreign = true;") == 1
assert _F.count(u"UJ.tools.emHostFor(btool, h.voxel)") == 1
# ...and the line is built ONCE and used on every path, so the three outcomes cannot drift apart.
assert _F.count(u"var line = \"<p class='forumelsewhere'") == 1
assert _F.count(u"slot.innerHTML = line;") == 2 and _F.count(u"slot.appendChild(p.firstChild);") == 1
print("done")
print("all applied")
