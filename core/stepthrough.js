/* core/stepthrough.js — shared tab-switching + step-through-review engine (2026-08-18)
   7th core module. Two independent pieces that only share a file because both are small,
   dataset-agnostic UI mechanics that both µJump and βJump need now that βJump is getting a
   Filter-and-show tab of its own for the first time:

   1. Tab bar switching (UJ.stepthrough.wireTabs) — was an inline IIFE in ujump.html, generalized
      here: the localStorage key and the ?tab= URL param name are now per-dataset
      (UJ.cfg.tabs.lsKey/urlParam) rather than hardcoded "ujump_active_tab"/"tab", so µJump and
      βJump (opened in the same browser) never clobber each other's remembered tab. The
      dashboard-tab lazy-init hook stays but is now fully optional (typeof-guarded) — µJump has
      a dashboard tab, βJump does not yet.

   2. Step-through review (UJ.stepthrough.initStepThrough / stepGoTo) — moved close to verbatim
      from ujump.html (added originally for Gary's cortical-column microglia-checking workflow):
      visits every matched cell in a fixed order exactly once, persists progress in localStorage
      keyed by a signature of the match set, resumes on the next "Preview matches". The
      localStorage key is also per-dataset now (UJ.cfg.stepthrough.lsKey) for the same
      cross-tool-clobbering reason as above — µJump used a single hardcoded "ujump_stepthrough_v1"
      key; that was fine when only one tool existed, but two tools open in the same browser origin
      would have shared (and corrupted) each other's progress counters.

   HOST CONTRACT
   -------------
   Required, must exist before wireTabs()/initStepThrough() are called:
     - `rowPos(row)`         -- returns [x,y,z] voxel position for a match's `.row`
     - `jumpToVoxel(x,y,z)`  -- navigates the Jump panel to that position (same function the
                                coordinate "Go" button and random-cell buttons already call)
   DOM ids expected to exist (all are individually null-checked; a missing one just means that
   piece of UI is inert, not a thrown error):
     - `#mainTabs` with child `.tabbtn[data-tab]` buttons, and `.tabpanel[data-tabpanel]` panels
       elsewhere in the document
     - `#stepThroughCard`, `#stepCounter`, `#stepPrev`, `#stepNext`, `#stepReset`
   Optional, guarded:
     - `initDashboardTab()` + `ensureConnPlotly()` -- if both exist, clicking the "dashboard" tab
       lazy-inits it exactly as µJump already does; if either is missing (βJump today), the
       dashboard special-case is simply skipped, tab switching still works for every other tab.

   UJ.cfg.tabs = { lsKey, urlParam } -- defaults "ujump_active_tab"/"tab" (µJump's original
   values, so its own behavior/URLs are unchanged); βJump sets "bjump_active_tab"/"tab".
   UJ.cfg.stepthrough = { lsKey, nucPanelId } -- lsKey defaults "ujump_stepthrough_v1"; βJump sets
   "bjump_stepthrough_v1". nucPanelId defaults "nucpanel" (µJump/δJump's id); βJump sets "panel"
   (its own cell panel has a different id).

   3. Full-panel relocation (2026-08-20, 6th pass on the step-through-identity thread — Søren:
      "I just want a copy... it should just show the same there as in Jump", after passes 4-5's
      read-only summary card turned out to be "a scraped version" of the real thing. Passes 4-5's
      window.CUR_STEP_CARD_HTML + core/panel.js's renderStepVotePanel() are RETIRED by this —
      see core/panel.js's own note at the top of its (now unused) renderStepVotePanel(). Rather
      than build and maintain a second, parallel identity/voting/correction UI with its own IDs
      (favourites, connections, synapse search, root-ID panel, community-report history, the
      guided-ID tree — all of it), this physically MOVES the single real panel (#nucpanel, or
      whatever UJ.cfg.stepthrough.nucPanelId names) into a mount point under the step-through card
      whenever a step-through cell is on screen, and moves it back to its original spot in the
      Jump tab when you switch away. It is the exact same DOM node, filled by the exact same
      showNucleus()/showCell() call the Jump tab uses — every button, fetch, and id inside it
      keeps working unmodified, because nothing about it was duplicated. The host page needs one
      new element: `#stepNucMount`, sitting wherever the panel should appear under the
      step-through card.
*/
(function(){
  window.UJ = window.UJ || {};
  var UJ = window.UJ;
  UJ.stepthrough = UJ.stepthrough || {};

  function tabsCfg(){ try{ return (UJ&&UJ.cfg&&UJ.cfg.tabs)||{}; }catch(_e){ return {}; } }
  function stepCfg(){ try{ return (UJ&&UJ.cfg&&UJ.cfg.stepthrough)||{}; }catch(_e){ return {}; } }

  /* ---------- 3. Full-panel relocation --------------------------------------------------
     See the module header's "3. Full-panel relocation" comment for the why. nucHomeParent/
     nucHomeNext are captured the FIRST time the panel is moved, so it can always be put back
     exactly where it started (nextSibling, not just "append to parent", so it lands back in the
     right place among its Jump-tab siblings rather than at the end). */
  /* ── AND THE GUIDED-ID PANEL GOES WITH IT ────────────────────────────────  2026-11-07
     Reported by a collaborator: *"When I'm in a filter group of cells ... I was unable to do a
     guided identification of a cell that was incorrectly classified, within the filtered
     dataset."* Only the cell panel was moved. The guided-identification tree renders into its own
     panel (#idfpanel, UJ.cfg.tree.panelId), a SIBLING of #nucpanel that stayed behind on the
     hidden Jump tab -- so the button opened the tree where nobody could see it. Both now move
     together and go home together; a tree panel that already sits inside the cell panel (an
     inline host) travels with it and is left alone. */
  var homes={};
  function nucPanelId(){ return stepCfg().nucPanelId||"nucpanel"; }
  function treePanelId(){ try{ return (UJ.cfg&&UJ.cfg.tree&&UJ.cfg.tree.panelId)||"idfpanel"; }catch(_e){ return "idfpanel"; } }
  function movedIds(){
    var ids=[nucPanelId()], np=document.getElementById(ids[0]), tp=document.getElementById(treePanelId());
    if(tp&&!(np&&np.contains(tp)))ids.push(treePanelId());
    return ids;
  }
  function relocateNucPanel(){
    var mount=document.getElementById("stepNucMount");
    if(!mount)return;
    movedIds().forEach(function(id){
      var el=document.getElementById(id);
      if(!el)return;
      if(!homes[id])homes[id]={parent:el.parentNode,next:el.nextSibling};
      if(el.parentNode!==mount)mount.appendChild(el);
    });
  }
  function restoreNucPanel(){
    /* Back in reverse, so a panel whose home is "just before" the other finds it already there. */
    movedIds().slice().reverse().forEach(function(id){
      var el=document.getElementById(id), h=homes[id];
      if(!el||!h||el.parentNode===h.parent)return;
      if(h.next&&h.next.parentNode===h.parent)h.parent.insertBefore(el,h.next);
      else h.parent.appendChild(el);
    });
  }
  /* ── THE COORDINATE, WHERE THE CELL IS ─────────────────────────────────  2026-11-07
     The same collaborator: *"when you're in the "filter" tab, you have to go back to the "Jump"
     tab to see the XYZ coordinate information."* Since 2026-09-18 the lookup's coordinate line sits
     under the coordinate box on the Jump tab (#nearestLine), which is where it belongs for a typed
     lookup and nowhere to be seen while stepping through matches. So the step-through prints the
     cell's own coordinate above the panel, with a copy button. */
  function stepCoordLine(pos){
    var mount=document.getElementById("stepNucMount");
    if(!mount)return;
    var line=document.getElementById("stepCoordLine");
    if(!line){
      line=document.createElement("div");
      line.id="stepCoordLine"; line.className="meta";
      line.style.cssText="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0";
      mount.insertBefore(line,mount.firstChild);
    }
    if(!pos||pos.length<3){ line.style.display="none"; return; }
    var txt=pos.slice(0,3).map(function(n){ return Math.round(n); }).join(", ");
    line.style.display="";
    line.innerHTML='<span>Voxel <b style="font-family:var(--mono,monospace)">'+txt+'</b></span>'
      +'<button type="button" class="idbtn" style="width:auto;padding:3px 10px;font-size:12px">Copy</button>';
    var b=line.querySelector("button");
    b.addEventListener("click",function(){
      try{ navigator.clipboard&&navigator.clipboard.writeText(txt); }catch(_e){}
      b.textContent="Copied"; setTimeout(function(){ b.textContent="Copy"; },1200);
    });
  }
  UJ.stepthrough.relocateNucPanel=relocateNucPanel;
  UJ.stepthrough.restoreNucPanel=restoreNucPanel;

  /* ---------- 1. Tab bar switching ---------------------------------------------------- */
  function wireTabs(){
    var bar=document.getElementById("mainTabs");
    if(!bar)return;
    var lsKey=tabsCfg().lsKey||"ujump_active_tab";
    var urlParam=tabsCfg().urlParam||"tab";
    var btns=Array.prototype.slice.call(bar.querySelectorAll(".tabbtn[data-tab]"));
    function activate(name){
      btns.forEach(function(b){var on=b.dataset.tab===name;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");});
      document.querySelectorAll(".tabpanel").forEach(function(p){p.classList.toggle("active",p.dataset.tabpanel===name);});
      try{localStorage.setItem(lsKey,name);}catch(e){}
      if(name==="dashboard"&&!window.__dashTabInited&&typeof initDashboardTab==="function"&&typeof ensureConnPlotly==="function"){
        window.__dashTabInited=true;
        var statusEl=document.getElementById("statusLine");
        ensureConnPlotly().then(function(){initDashboardTab();}).catch(function(err){
          if(statusEl)statusEl.textContent="Failed to load the charting library — "+err.message;
        });
      }
      /* See "3. Full-panel relocation" above: leaving the filter tab puts the real cell panel
         back in its Jump-tab home; returning to it while a step-through session is already
         active (e.g. switched away and back) re-relocates it rather than leaving it stranded on
         the Jump tab. stepMatches is declared further down in this file (section 2) but, as a
         plain `function`, is hoisted -- safe to reference here regardless of source order. */
      if(name==="filter"){ if(stepMatches)relocateNucPanel(); }
      else { restoreNucPanel(); }
    }
    btns.forEach(function(b){b.addEventListener("click",function(){activate(b.dataset.tab);});});
    UJ.stepthrough.activateTab=activate;
    document.addEventListener("DOMContentLoaded",function(){
      var fromUrl=null;try{fromUrl=new URLSearchParams(location.search).get(urlParam);}catch(e){}
      var saved=null;try{saved=localStorage.getItem(lsKey);}catch(e){}
      var pick=[fromUrl,saved].find(function(t){return t&&btns.some(function(b){return b.dataset.tab===t;});});
      activate(pick||"jump");
    });
  }
  UJ.stepthrough.wireTabs=wireTabs;

  /* ---------- 2. Step-through review --------------------------------------------------- */
  var stepMatches=null,stepIndex=0,stepVisited=[];
  var stepCard,stepCounterEl,stepPrevBtn,stepNextBtn,stepResetBtn,stepWired=false;

  function stepLsKey(){ return stepCfg().lsKey||"ujump_stepthrough_v1"; }

  function stepSig(matches){
    if(!matches||!matches.length)return "";
    if(typeof rowPos!=="function")return String(matches.length);
    var a=rowPos(matches[0].row),b=rowPos(matches[matches.length-1].row);
    return matches.length+"|"+a.join(",")+"|"+b.join(",");
  }
  function loadStepState(){
    try{return JSON.parse(localStorage.getItem(stepLsKey()))||null;}catch(e){return null;}
  }
  function saveStepState(){
    try{localStorage.setItem(stepLsKey(),JSON.stringify({sig:stepSig(stepMatches),index:stepIndex,visited:stepVisited}));}catch(e){}
  }
  function updateStepUI(){
    if(!stepCard)return;
    if(!stepMatches||!stepMatches.length){stepCard.style.display="none";return;}
    stepCard.style.display="";
    var total=stepMatches.length;
    var visitedCount=stepVisited.length;
    if(stepCounterEl)stepCounterEl.textContent="Cell "+(stepIndex+1).toLocaleString()+" of "+total.toLocaleString()+" — "+visitedCount.toLocaleString()+" checked so far";
    if(stepPrevBtn)stepPrevBtn.disabled=stepIndex<=0;
    if(stepNextBtn)stepNextBtn.textContent=stepIndex>=total-1?"Done — restart from #1":"Next →";
  }
  function stepGoTo(i){
    if(!stepMatches||i<0||i>=stepMatches.length)return;
    stepIndex=i;
    if(stepVisited.indexOf(i)<0)stepVisited.push(i);
    var pos=null;
    if(typeof rowPos==="function"&&typeof jumpToVoxel==="function"){
      pos=rowPos(stepMatches[i].row);
      jumpToVoxel(pos[0],pos[1],pos[2]);
    }
    /* jumpToVoxel() above already re-filled #nucpanel (showNucleus()/showCell() synchronously
       rebuild it, same as any other jump) -- relocate it into the step-through mount now so the
       freshly-loaded cell appears under the card, not back on the (currently hidden) Jump tab.
       Safe to call every step: a no-op once it's already sitting in the mount. */
    relocateNucPanel();
    stepCoordLine(pos);
    saveStepState();
    updateStepUI();
  }
  /* initStepThrough(matches): call with the fresh match array right after every successful
     "Preview matches" run (matches=null/[] when the filters change and invalidate the old
     preview). Lazily grabs its DOM elements and wires the Prev/Next/Reset buttons on first call,
     so a host page can load this module before those elements exist in the DOM. */
  function initStepThrough(matches){
    if(!stepWired){
      stepCard=document.getElementById("stepThroughCard");
      stepCounterEl=document.getElementById("stepCounter");
      stepPrevBtn=document.getElementById("stepPrev");
      stepNextBtn=document.getElementById("stepNext");
      stepResetBtn=document.getElementById("stepReset");
      if(stepPrevBtn)stepPrevBtn.addEventListener("click",function(){if(stepMatches)stepGoTo(Math.max(0,stepIndex-1));});
      if(stepNextBtn)stepNextBtn.addEventListener("click",function(){
        if(!stepMatches)return;
        stepGoTo(stepIndex>=stepMatches.length-1?0:stepIndex+1);
      });
      if(stepResetBtn)stepResetBtn.addEventListener("click",function(){
        if(!stepMatches)return;
        if(!confirm("Clear step-through progress ("+stepVisited.length.toLocaleString()+" cell(s) checked so far) for this set of "+stepMatches.length.toLocaleString()+" matched cells?"))return;
        stepIndex=0;stepVisited=[];
        saveStepState();
        updateStepUI();
      });
      stepWired=true;
    }
    stepMatches=(matches&&matches.length)?matches:null;
    if(!stepMatches){
      stepVisited=[];stepIndex=0;updateStepUI();
      restoreNucPanel(); // filters changed/cleared -- nothing left to step through, so the real
                          // panel (if it was relocated here) goes back to its Jump-tab home rather
                          // than sitting orphaned in a now-hidden step-through card.
      return;
    }
    var sig=stepSig(stepMatches);
    var saved=loadStepState();
    var resumeIndex=0;
    if(saved&&sig&&saved.sig===sig){
      resumeIndex=Math.min(Math.max(0,saved.index||0),stepMatches.length-1);
      stepVisited=Array.isArray(saved.visited)?saved.visited.filter(function(i){return i>=0&&i<stepMatches.length;}):[];
    } else {
      stepVisited=[];
    }
    stepGoTo(resumeIndex);
  }
  UJ.stepthrough.initStepThrough=initStepThrough;
  UJ.stepthrough.stepGoTo=stepGoTo;
  UJ.stepthrough.currentIndex=function(){return stepIndex;};
  UJ.stepthrough.currentMatches=function(){return stepMatches;};
})();
