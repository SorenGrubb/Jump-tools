/* ── core/vrbasket.js — collect cells, then look at them together in VR ─────────────  2026-10-13
   Søren: *"Could we somehow let the user collect some cells they want to view in 3D and then let
   them open a [VR] environment with them and play around in VR also?"*

   WHAT IT DOES
   Puts a "+ VR" button beside every mesh-download button (`.meshdl[data-root]`), the same
   self-installing way core/mesh3d.js adds "Show in 3D": no tool's own handlers are touched, the
   page needs one <script> line. Collected cells go into one list, shown in a small tray in the
   bottom-right corner, and "Open VR viewer" opens vr.html with them.

   WHERE THE LIST LIVES
   localStorage key `jump_vr_basket_v1`, shared by every tool on this domain ON PURPOSE: each entry
   carries its own dataset id (UJ.cfg.id), so one collection could one day hold cells from several
   tools. vr.html reads the same key when opened in the same browser (desktop, or the PC browser
   with Quest Link), and also accepts the list in its URL (#c=…) for the standalone headset, which
   has its own browser and therefore its own, empty, localStorage.

   POINTS THAT TRAVEL WITH A CELL (2026-10-15, Søren: "In connectivity, there should be a +VR button
   to add the target cell and the input and output synapses found to VR" -- and the same for
   Astrocyte–synapse proximity and Cell contacts). An entry may carry
     syn:   [[x, y, z, dir, partnerRoot, partnerType], …]   dir 0 = input, 1 = output
     marks: [[x, y, z, kind, label], …]                      kind "contact" | "astro"
   in tool voxels (4 × 4 × 40 nm), drawn by vr.html on that cell. merge() adds to an entry already in
   the collection instead of refusing it, so pressing "+ VR" in Connectivity after the cell's own
   "+ VR" puts the synapses on it. Points do not fit in the headset link; they travel in a saved
   scene, which the tray says.

   WHAT IT DOES NOT DO
   Nothing here fetches a mesh. vr.html does that itself with core/mesh.js, so the collection is a
   list of ids, a few hundred bytes, not megabytes of geometry.                                    */
window.UJ = window.UJ || {};
UJ.vrbasket = (function(){
  "use strict";
  var KEY = "jump_vr_basket_v1";
  var SOFT_MAX = 20;              // above this the Quest 2 starts to struggle; warned, not refused
  var LISTENERS = [];

  function ds(){ return (UJ.cfg && UJ.cfg.id) || "microns"; }
  /* TOOLS WHOSE CELLS ARE TRACINGS (2026-10-17). λJump has no segmentation and χJump's meshes are
     its own renderer's, so there is no mesh button to put "+ VR" beside. The pill is always there
     instead and opens the viewer on every cell traced in this dataset (vr.html#ds=…&traced=1). */
  var TRACED_ONLY = { ljump: 1, xjump: 1 };
  function tracedOnly(){ return !!TRACED_ONLY[ds()]; }
  function tracedLink(){
    var base = location.href.replace(/[#?].*$/, "").replace(/[^\/]*$/, "");
    return base + "vr.html#ds=" + encodeURIComponent(ds()) + "&traced=1";
  }

  function load(){
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a.filter(function(e){ return e && e.root; }) : [];
    } catch (e){ return []; }
  }
  function save(list){
    var ok = true;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e){ ok = false; }
    LISTENERS.forEach(function(f){ try { f(list); } catch (_e){} });
    return ok;
  }
  function keyOf(d, root){ return d + ":" + root; }
  function has(root, d){
    var k = keyOf(d || ds(), String(root));
    return load().some(function(e){ return keyOf(e.ds, e.root) === k; });
  }
  function add(entry){
    var list = load(), k = keyOf(entry.ds, entry.root);
    if (list.some(function(e){ return keyOf(e.ds, e.root) === k; })) return list;
    list.push(entry); save(list); return list;
  }
  function remove(root, d){
    var k = keyOf(d || ds(), String(root));
    var list = load().filter(function(e){ return keyOf(e.ds, e.root) !== k; });
    save(list); return list;
  }
  /* Several at once, one write: the tray's "remove all" on a group. */
  function removeKeys(keys){
    var drop = {}; keys.forEach(function(k){ drop[k] = 1; });
    var list = load().filter(function(e){ return !drop[keyOf(e.ds, e.root)]; });
    save(list); return list;
  }
  /* SEPARATE PER TOOL (2026-10-18, Søren in δJump: "It said 6 cells in the VR already, but they
     were from uJump. I think we should keep them separate, or else it will be confusing.") One
     stored list still, every entry carrying its dataset, but each tool sees, counts, opens and
     clears only its own: mine() is the whole of what a tool shows. Clearing in δJump leaves
     µJump's cells where they were. */
  function isMine(e){ return (e.ds || "microns") === ds(); }
  function mine(list){ return (list || load()).filter(isMine); }
  function clear(){ save(load().filter(function(e){ return !isMine(e); })); }
  /* Add, or add TO: an entry already here keeps its label and gains the new extra root ids,
     synapses and marks (no duplicates). Returns {ok, added, merged}; ok is false when the browser
     refused to store it (localStorage is ~5 MB per site). */
  var POINT_MAX = 20000;
  function unionRows(a, b){
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function(r){
      var k = JSON.stringify(r); if (seen[k]) return; seen[k] = 1; out.push(r);
    });
    return out.slice(0, POINT_MAX);
  }
  function merge(entry){
    var list = load(), k = keyOf(entry.ds, entry.root), old = null;
    list.forEach(function(e){ if (keyOf(e.ds, e.root) === k) old = e; });
    if (!old){
      var e2 = Object.assign({ t: Date.now() }, entry);
      if (e2.syn) e2.syn = e2.syn.slice(0, POINT_MAX);
      if (e2.marks) e2.marks = e2.marks.slice(0, POINT_MAX);
      list.push(e2);
      return { ok: save(list), added: true, merged: false };
    }
    old.extra = unionRows(old.extra, entry.extra);
    if (entry.syn) old.syn = unionRows(old.syn, entry.syn);
    if (entry.marks) old.marks = unionRows(old.marks, entry.marks);
    if (!old.nuc && entry.nuc) old.nuc = entry.nuc;
    return { ok: save(list), added: false, merged: true };
  }
  /* Several at once (a cell and its partners), one write. */
  function mergeAll(entries){
    var r = { ok: true, added: 0, merged: 0 };
    (entries || []).forEach(function(e){ var x = merge(e); r.ok = r.ok && x.ok; if (x.added) r.added++; if (x.merged) r.merged++; });
    return r;
  }

  /* The link vr.html understands. ds~root~nucleus~label, comma-separated, each part
     URI-encoded -- so a label with a comma or a tilde in it cannot break the list. */
  /* ONE DATASET PER VIEWER (2026-10-17): vr.html shows one volume at a time -- two volumes have
     unrelated coordinate frames -- so a tool opens the viewer with ITS cells and says which
     dataset (&ds=). Since 2026-10-18 the other tools' cells are not even shown (see mine()). */
  function linkFor(list){
    var here = mine(list), d = ds();
    var parts = here.map(function(e){
      return [e.ds, e.root, e.nuc || "", e.label || "", (e.extra || []).join("+")].map(encodeURIComponent).join("~");
    });
    var base = location.href.replace(/[#?].*$/, "").replace(/[^\/]*$/, "");
    return base + "vr.html#c=" + parts.join(",") + (d !== "microns" ? "&ds=" + encodeURIComponent(d) : "");
  }

  /* The cell-type line for the panel the button sits in: the nearest ancestor that has a
     `.celltype` element. Text only, minus the favourite star, kept short. */
  function labelNear(el){
    var n = el;
    for (var i = 0; n && i < 12; i++, n = n.parentElement){
      var ct = n.querySelector && n.querySelector(".celltype");
      if (ct){
        /* Cut at the "\u2197 MICrONS prediction" link the panel appends to the name. */
        var t = (ct.textContent || "").split("\u2197")[0]
                  .replace(/[\u2605\u2606]/g, "").replace(/\s+/g, " ").trim();
        if (t) return t.length > 60 ? t.slice(0, 57) + "…" : t;
      }
    }
    return "Cell";
  }

  /* Community-proposed root IDs for this cell (the "propose or vote on a root ID" panel), as the
     page has them right now -- the same list "Show in 3D" and the .glb fold in. Only when the
     collected root is the cell on screen, since CUR_EXTRA_ROOTS belongs to that cell alone.
     vr.html ALSO asks the backend afresh, so a proposal made after collecting still counts;
     this copy is what travels in the link when the backend cannot be reached. */
  function extrasFor(root){
    try {
      if (typeof CUR_ROOT === "undefined" || String(CUR_ROOT) !== String(root)) return [];
      var want = (UJ.cfg && UJ.cfg.mesh && UJ.cfg.mesh.extraRootSegType) || "img65";
      return (Array.isArray(CUR_EXTRA_ROOTS) ? CUR_EXTRA_ROOTS : [])
        .filter(function(r){ return r && r.id && String(r.id) !== String(root) && (!r.segType || r.segType === want); })
        .map(function(r){ return String(r.id); });
    } catch (e){ return []; }
  }

  /* ── styles ─────────────────────────────────────────────────────────────── */
  var STYLE =
    ".vrb-btn.vrb-in{background:var(--accent-dim,#1f3a2a)!important;color:var(--accent,#3fb950)!important;}" +
    "#vrb-pill{position:fixed;right:16px;bottom:16px;z-index:9998;font:600 13px system-ui,sans-serif;" +
    "background:var(--accent,#3fb950);color:#0d1117;border:0;border-radius:999px;padding:9px 14px;" +
    "box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;display:none}" +
    "#vrb-tray{position:fixed;right:16px;bottom:60px;z-index:9999;width:min(340px,calc(100vw - 32px));" +
    "max-height:60vh;overflow:auto;background:var(--card,#161b22);color:var(--fg,#e6edf3);" +
    "border:1px solid var(--line,#30363d);border-radius:10px;padding:12px;font:13px system-ui,sans-serif;" +
    "box-shadow:0 8px 28px rgba(0,0,0,.45);display:none}" +
    "#vrb-tray h4{margin:0 0 8px;font-size:14px}" +
    "#vrb-tray .vrb-row{display:flex;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line,#30363d)}" +
    "#vrb-tray .vrb-row div{flex:1;min-width:0}" +
    "#vrb-tray .vrb-row small{display:block;color:var(--mut,#8b949e);font-family:ui-monospace,monospace;font-size:11px}" +
    "#vrb-tray .vrb-row b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "#vrb-tray button{font:inherit;cursor:pointer;border-radius:6px;border:1px solid var(--line,#30363d);" +
    "background:transparent;color:inherit;padding:4px 8px}" +
    "#vrb-tray .vrb-go{background:var(--accent,#3fb950);color:#0d1117;border:0;font-weight:600;padding:7px 12px}" +
    "#vrb-tray .vrb-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}" +
    "#vrb-tray .vrb-note{color:var(--mut,#8b949e);font-size:12px;margin-top:8px;line-height:1.4}" +
    "#vrb-tray .vrb-warn{color:#f0883e}" +
    "#vrb-tray details{border-top:1px solid var(--line,#30363d)}" +
    "#vrb-tray details details{border-top:0;margin-left:10px}" +
    "#vrb-tray summary{display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;list-style:none;font-weight:600}" +
    "#vrb-tray summary::-webkit-details-marker{display:none}" +
    "#vrb-tray summary:before{content:'\\25B8';color:var(--mut,#8b949e);width:10px;display:inline-block}" +
    "#vrb-tray details[open]>summary:before{content:'\\25BE'}" +
    "#vrb-tray summary span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "#vrb-tray summary i{font-style:normal;color:var(--mut,#8b949e);font-weight:400}" +
    "#vrb-tray details details summary{font-weight:500}" +
    "#vrb-tray details .vrb-row{margin-left:18px}" +
    "#vrb-tray .vrb-acts.top{margin:0 0 8px}";
  function injectStyle(){
    if (document.getElementById("vrb-style")) return;
    var s = document.createElement("style"); s.id = "vrb-style"; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  /* ── the tray ───────────────────────────────────────────────────────────── */
  var pill, tray;
  function buildTray(){
    if (pill) return;
    pill = document.createElement("button");
    pill.id = "vrb-pill"; pill.type = "button";
    pill.title = "Cells you have collected for the VR viewer";
    pill.addEventListener("click", function(){
      tray.style.display = tray.style.display === "block" ? "none" : "block";
    });
    tray = document.createElement("div"); tray.id = "vrb-tray";
    tray.addEventListener("click", function(ev){
      var b = ev.target.closest("button"); if (!b) return;
      if (b.closest("summary")) ev.preventDefault();          // a button in a fold's title must not fold it
      if (b.dataset.rmgrp){ var ks = GROUPKEYS[b.dataset.rmgrp] || [];
        if (ks.length < 2 || window.confirm("Remove these " + ks.length + " cells from the VR collection?")) removeKeys(ks); }
      else if (b.dataset.rm){ remove(b.dataset.rm, b.dataset.ds); }
      else if (b.dataset.act === "open"){ window.open(linkFor(), "_blank"); }
      else if (b.dataset.act === "traced"){ window.open(tracedLink(), "_blank"); }
      else if (b.dataset.act === "copy"){
        var l = linkFor();
        (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject())
          .then(function(){ b.textContent = "Copied ✓"; },
                function(){ window.prompt("Copy this link:", l); });
        setTimeout(function(){ b.textContent = "Copy headset link"; }, 2000);
      }
      else if (b.dataset.act === "clear"){ clear(); tray.style.display = "none"; }
    });
    tray.addEventListener("toggle", function(ev){
      var d = ev.target; if (d && d.dataset && d.dataset.k) setOpen(d.dataset.k, d.open);
    }, true);
    document.body.appendChild(pill); document.body.appendChild(tray);
    render(load());
  }
  /* ── GROUPS (2026-10-23, Søren: "This list is getting ridiculously long, we need to collapse it or
     organise it.") Connectivity brings in partners by the dozen, so the tray sorts them:
     the cells you collected yourself, then input partners, then output partners -- read from the
     label the partner was given ("…, input partner)") -- and inside each, one fold per cell type
     ("PTC ×3"). Every fold has its own × to remove the lot. Which folds are open is remembered per
     browser; partners start folded, your own cells open. */
  var OPEN_KEY = "jump_vr_tray_open_v1", OPEN = {};
  try { OPEN = JSON.parse(localStorage.getItem(OPEN_KEY) || "{}") || {}; } catch (e){ OPEN = {}; }
  function isOpen(k, dflt){ return k in OPEN ? !!OPEN[k] : dflt; }
  function setOpen(k, v){ OPEN[k] = v ? 1 : 0; try { localStorage.setItem(OPEN_KEY, JSON.stringify(OPEN)); } catch (e){} }
  var ROLES = [["cell", "Your cells"], ["in", "Input partners"], ["out", "Output partners"]];
  function roleOf(e){
    var l = String(e.label || "");
    return /\binput partner\b/i.test(l) ? "in" : /\boutput partner\b/i.test(l) ? "out" : "cell";
  }
  function typeOf(e){ return String(e.label || "Cell").replace(/\s*\(.*$/, "").trim() || "Cell"; }
  function rowHtml(e){
    var pts = (e.syn && e.syn.length ? " · " + e.syn.length + " synapses" : "") +
              (e.marks && e.marks.length ? " · " + e.marks.length + " points" : "");
    return "<div class='vrb-row'><div><b title='" + esc(e.label) + "'>" + esc(e.label || "Cell") + "</b>" +
           "<small>" + esc(e.root) + esc(pts) + "</small></div>" +
           "<button data-rm='" + esc(e.root) + "' data-ds='" + esc(e.ds) + "' title='Remove'>×</button></div>";
  }
  var GROUPKEYS = {};
  function foldHtml(key, title, n, inner, dflt){
    return "<details data-k='" + esc(key) + "'" + (isOpen(key, dflt) ? " open" : "") + "><summary><span>" + esc(title) +
           " <i>×" + n + "</i></span><button data-rmgrp='" + esc(key) + "' title='Remove all " + n + "'>×</button></summary>" +
           inner + "</details>";
  }
  function groupsHtml(list){
    GROUPKEYS = {};
    var h = "";
    ROLES.forEach(function(R){
      var role = R[0], items = list.filter(function(e){ return roleOf(e) === role; });
      if (!items.length) return;
      GROUPKEYS[role] = items.map(function(e){ return keyOf(e.ds, e.root); });
      var byType = {}, order = [];
      items.forEach(function(e){ var t = typeOf(e); if (!byType[t]){ byType[t] = []; order.push(t); } byType[t].push(e); });
      order.sort(function(a, b){ return byType[b].length - byType[a].length || a.localeCompare(b); });
      var inner = "";
      order.forEach(function(t){
        var g = byType[t];
        if (g.length === 1 || (role === "cell" && items.length <= 6)){ g.forEach(function(e){ inner += rowHtml(e); }); return; }
        var k = role + "|" + t;
        GROUPKEYS[k] = g.map(function(e){ return keyOf(e.ds, e.root); });
        inner += foldHtml(k, t, g.length, g.map(rowHtml).join(""), false);
      });
      h += foldHtml(role, R[1], items.length, inner, role === "cell");
    });
    return h;
  }
  function render(all){
    if (!pill) return;
    var list = mine(all);
    pill.textContent = "🥽 VR collection (" + list.length + ")";
    pill.style.display = list.length || tracedOnly() ? "block" : "none";
    if (!list.length && !tracedOnly()){ tray.style.display = "none"; }
    if (tracedOnly()){
      pill.textContent = "🥽 Traced cells in VR";
      tray.innerHTML = "<h4>Traced cells in VR</h4>" +
        "<div class='vrb-note'>This dataset has no segmentation meshes here, so the viewer shows what has been traced: " +
        "each cell's traced outline as the cell, its traced nucleus, and the structures traced inside it. " +
        "Choose a cell type or a kind of structure in the viewer's <b>Objects</b> tab.</div>" +
        "<div class='vrb-acts'><button class='vrb-go' data-act='traced'>Open the traced cells in VR</button></div>";
      return;
    }
    var h = "<h4>VR collection</h4>" +
            "<div class='vrb-acts top'><button class='vrb-go' data-act='open'>Open VR viewer</button>" +
            "<button data-act='copy'>Copy headset link</button><button data-act='clear'>Clear</button></div>";
    h += groupsHtml(list);
    if (list.length > SOFT_MAX)
      h += "<div class='vrb-note vrb-warn'>More than " + SOFT_MAX + " cells may be too heavy for a standalone Quest 2.</div>";
    h += "<div class='vrb-note'>On the PC with Quest Link: open the viewer and press <b>Enter VR</b>.<br>" +
         "Standalone Quest: send yourself the headset link and open it in the Quest browser.</div>" +
         (list.some(function(e){ return (e.syn && e.syn.length) || (e.marks && e.marks.length); })
           ? "<div class='vrb-note'>Synapses and contact points are too many for the headset link: open the viewer here, " +
             "press <b>💾 Save scene</b>, and open the scene's link in the headset.</div>" : "");
    tray.innerHTML = h;
    syncButtons();
  }

  /* ── the buttons ────────────────────────────────────────────────────────── */
  function paint(b){
    var inB = has(b.getAttribute("data-root"));
    b.textContent = inB ? "✓ In VR" : "+ VR";
    b.title = inB ? "In your VR collection — click to remove"
                  : "Add this cell to your VR collection, to view several cells together in 3D / VR";
    b.classList.toggle("vrb-in", inB);
  }
  function syncButtons(){
    Array.prototype.forEach.call(document.querySelectorAll(".vrb-btn"), function(b){
      var dl = b.__vrbDl;
      if (dl){
        b.setAttribute("data-root", dl.getAttribute("data-root") || "");
        b.style.display = dl.style.display;   // the tool hides its download button until a root id exists
      }
      paint(b);
    });
  }
  function decorate(dl){
    if (dl.__vrb) return;
    dl.__vrb = true;
    var b = document.createElement("button");
    b.type = "button";
    b.className = (String(dl.className || "idbtn").replace(/\bmeshdl\b/g, " ").replace(/\s+/g, " ").trim() || "idbtn") + " vrb-btn";
    b.__vrbDl = dl;
    ["padding","fontSize","lineHeight","verticalAlign","borderRadius","marginLeft","marginRight"].forEach(function(p){
      if (dl.style[p]) b.style[p] = dl.style[p];
    });
    b.setAttribute("data-root", dl.getAttribute("data-root") || "");
    b.style.display = dl.style.display;
    b.addEventListener("click", function(ev){
      ev.stopPropagation();
      var root = b.getAttribute("data-root");
      if (!root || root === "0") return;
      if (has(root)) remove(root);
      else add({ ds: ds(), root: String(root), nuc: dl.getAttribute("data-nucid") || "",
                 extra: extrasFor(root), label: labelNear(b), t: Date.now() });
    });
    /* After "Show in 3D" if that is already there, so the row reads download · 3D · VR. */
    var after = dl;
    var nx = dl.nextElementSibling;
    while (nx && nx.classList && nx.classList.contains("m3d-btn")){ after = nx; nx = nx.nextElementSibling; }
    after.parentNode.insertBefore(b, after.nextSibling);
    if (window.MutationObserver)
      new MutationObserver(function(){ syncButtons(); })
        .observe(dl, { attributes:true, attributeFilter:["style","data-root","data-nucid"] });
    paint(b);
  }
  function sweep(){
    Array.prototype.forEach.call(document.querySelectorAll(".meshdl[data-root]"), decorate);
  }

  function install(){
    injectStyle(); buildTray(); sweep();
    LISTENERS.push(render);
    if (window.MutationObserver)
      new MutationObserver(function(){ sweep(); })
        .observe(document.body, { childList:true, subtree:true });
    /* Another tab (or vr.html) changed the list. */
    window.addEventListener("storage", function(e){ if (e.key === KEY) render(load()); });
  }
  if (typeof document !== "undefined" && !UJ.vrbasketNoAutoInstall){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else install();
  }

  return { KEY: KEY, load: load, save: save, add: add, remove: remove, clear: clear, has: has,
           merge: merge, mergeAll: mergeAll, removeKeys: removeKeys, linkFor: linkFor, sweep: sweep };
})();
