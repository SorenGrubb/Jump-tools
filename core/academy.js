/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   core/academy.js — JUMP ACADEMY and the Licence to Jump                               2026-11-12
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   Søren: *"before any user logs anything in the tools, they have been through the tutorial and
   have tried to identify some organelles and cells that have been verified by us or the AI. I
   imagine that there will be a message about this when they first log in with their account, that
   they need to accept along with a signature ... If they correctly identify 8/10 organelles, they
   can be allowed to use the dataset ... cell types ... Excitatory neurons, Inhibitory neurons,
   Glia, or vascular cells ... they can skip if the segmentation is bad or if they are not sure.
   This should also be 8/10. We should call it Jump Academy and when they finish they should get
   the 'License to Jump!' and there should be a celebration animation."*

   FIVE STEPS, IN ORDER
     1  the agreement, signed by typing one's name;
     2  the tutorial: µJump's own walkthroughs "find" and "organelles" (core/tour.js), finished;
     3  organelles: an EM section from the same reader the tracing pad uses (core/emtiles.js), a
        ring round something a person or a checked AI suggestion has named, and a choice of eight
        kinds -- or skip. Sections and zoom move like the pad. 8 right of 10 answered;
     4  cells: a cell in 3D (core/mesh.js + core/mesh3d.js, the panel the cards use), excitatory /
        inhibitory / glia / vascular -- or skip ("bad segmentation / not sure"). 8 of 10;
     5  the licence, with a celebration.

   THE SERVER DECIDES (backend/Academy.gs). It issues the items without their answers, grades each
   answer, and keeps the licence. This file only shows things, and it never knows an answer before
   the server has said whether it was right. The tests need MICrONS imagery and meshes, so they run
   in µJump; every other tool loads this file for the agreement, the gate and a link there -- one
   licence serves every tool.

   THE GATE. postReport is wrapped: an annotation from an account without a licence opens the
   Academy instead of being sent. The backend refuses it as well (the page can be bypassed; the
   server cannot), and a refusal that says so opens the Academy too.

   Self-installing; needs nothing from the page except what it finds: REPORT_ENDPOINT or
   UJ.cfg.backend.endpoint, GOOGLE_CREDENTIAL, and -- for the tests -- UJ.emtiles, UJ.mesh,
   UJ.mesh3d, tracingSources and UJ.tour. */
(function(){
  "use strict";
  window.UJ = window.UJ || {};
  if (UJ.academy) return;

  var VERSION = "agreement-1";      // must equal ACADEMY_VERSION in backend/Academy.gs
  var TUTORIAL_PARTS = ["find", "organelles"];
  var REQUIRED = { new_identification:1, confirmation:1, discrepancy:1, merged_split:1,
    organelle_location:1, traced_structure:1, not_a_nucleus:1, new_cell_no_nucleus:1,
    propose_root_id:1, vote_root_id:1, remove_root_id:1, vote_identity:1, nucleus_position_fix:1,
    wjump_nucleus_found:1, wjump_nucleus_name:1, wjump_nucleus_reject:1, xjump_cell_build:1,
    xjump_cell_add:1, xjump_cell_remove:1, xjump_cell_name:1, xjump_cell_reject:1,
    xjump_nuclei_found:1, xjump_nucleus_join:1 };

  var STATUS = null, STATUS_FOR = "", OPEN = false, STEP = 0, WHY = "", WHY_TONE = "";

  /* ── the page's own things, found rather than assumed ─────────────────────────────────── */
  function endpoint(){
    try { if (typeof REPORT_ENDPOINT !== "undefined" && REPORT_ENDPOINT) return REPORT_ENDPOINT; } catch (_e){}
    try { return (UJ.cfg && UJ.cfg.backend && UJ.cfg.backend.endpoint) || ""; } catch (_e){ return ""; }
  }
  function cred(){
    try { if (typeof GOOGLE_CREDENTIAL !== "undefined" && GOOGLE_CREDENTIAL) return GOOGLE_CREDENTIAL; } catch (_e){}
    return window.UJ_CHAT_CRED || "";
  }
  function email(){
    try { if (typeof REPORTER_EMAIL !== "undefined" && REPORTER_EMAIL) return String(REPORTER_EMAIL).toLowerCase(); } catch (_e){}
    return "";
  }
  function myName(){
    try { if (typeof REPORTER_NAME !== "undefined" && REPORTER_NAME) return String(REPORTER_NAME); } catch (_e){}
    return "";
  }
  function canTest(){
    try {
      return !!(UJ.emtiles && UJ.mesh && UJ.mesh.fetchCombinedMesh && UJ.mesh3d && UJ.mesh3d.show
                && typeof tracingSources === "function"
                && /ujump/i.test(location.pathname + " " + document.title + " " + ((UJ.cfg && UJ.cfg.dataset) || "")));
    } catch (_e){ return false; }
  }
  function ujumpUrl(){
    var p = location.pathname.replace(/[^\/]*$/, "");
    return location.origin + p + "ujump.html#academy";
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; });
  }

  async function api(body){
    var ep = endpoint();
    if (!ep) return { ok: false, error: "this page has no backend address" };
    var c = cred();
    if (!c) return { ok: false, error: "signin" };
    body.type = "academy"; body.credential = c;
    try {
      var r = await fetch(ep, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                                body: JSON.stringify(body) });
      var t = await r.text();
      try { return JSON.parse(t); }
      catch (_p){ return { ok: false, error: "the server answered with a web page instead of data (usually the deployment needs re-authorising)" }; }
    } catch (e){ return { ok: false, error: "could not reach the server (" + (e && e.message || e) + ")" }; }
  }

  /* ── status, remembered per account so the badge is right before the server answers ──── */
  function cacheKey(){ return "jump_academy_status_" + (email() || "anon"); }
  function remembered(){
    try { var v = JSON.parse(localStorage.getItem(cacheKey()) || "null"); return v; } catch (_e){ return null; }
  }
  function remember(st){ try { localStorage.setItem(cacheKey(), JSON.stringify(st)); } catch (_e){} }
  async function refresh(){
    var d = await api({ action: "status" });
    if (d && d.ok && d.status){ STATUS = d.status; STATUS_FOR = email(); remember(STATUS); badge(); }
    return STATUS;
  }
  function licensed(){ return !!(STATUS && STATUS.licensed); }

  /* ── styles ─────────────────────────────────────────────────────────────────────────────── */
  function style(){
    if (document.getElementById("jaStyle")) return;
    var s = document.createElement("style"); s.id = "jaStyle";
    s.textContent = [
      "#jaBadge{cursor:pointer;border:1px solid var(--acc,#58a6ff);background:transparent;color:var(--acc,#58a6ff);",
      " border-radius:999px;padding:4px 12px;font:600 12px system-ui,sans-serif;margin-left:8px;white-space:nowrap}",
      "#jaBadge.lic{border-color:#3fb950;color:#3fb950}",
      "#jaBadge.float{position:fixed;left:12px;top:10px;z-index:9990;background:var(--card,#161b22)}",
      "#jaOv{position:fixed;inset:0;z-index:100000;background:rgba(1,4,9,.78);display:flex;align-items:flex-start;",
      " justify-content:center;overflow:auto;padding:24px 12px;font:14px/1.5 system-ui,sans-serif;color:var(--ink,#e6edf3)}",
      "#jaBox{position:relative;width:min(920px,100%);background:var(--card,#161b22);border:1px solid var(--line,#30363d);",
      " border-radius:14px;padding:18px 20px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}",
      "#jaBox h2{margin:0 0 2px;font-size:22px}#jaBox h3{margin:14px 0 6px;font-size:16px}",
      "#jaBox .ja-sub{color:var(--mut,#8b949e);font-size:13px}",
      "#jaClose{position:absolute;right:12px;top:10px;background:none;border:0;color:var(--mut,#8b949e);font-size:22px;cursor:pointer}",
      ".ja-steps{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px}",
      ".ja-steps button{flex:1 1 120px;text-align:center;padding:6px 4px;border-radius:8px;font:12px system-ui,sans-serif;cursor:pointer;",
      " background:transparent;border:1px solid var(--line,#30363d);color:var(--mut,#8b949e)}",
      ".ja-steps button:hover:not([disabled]){background:rgba(127,127,127,.12)}.ja-steps button[disabled]{cursor:default;opacity:.55}",
      ".ja-steps button.ok{border-color:#3fb950;color:#3fb950}",
      ".ja-steps button.on{border-color:var(--acc,#58a6ff);color:var(--ink,#e6edf3);box-shadow:inset 0 0 0 1px var(--acc,#58a6ff)}",
      ".ja-steps button.ok.on{border-color:#3fb950;color:#3fb950;box-shadow:inset 0 0 0 1px #3fb950;background:rgba(46,160,67,.10)}",
      ".ja-btn{cursor:pointer;border:1px solid var(--line,#30363d);background:var(--bg2,#21262d);color:var(--ink,#e6edf3);border-radius:8px;padding:7px 14px;font:600 13px system-ui,sans-serif}",
      ".ja-btn:hover{border-color:var(--acc,#58a6ff)}.ja-btn[disabled]{opacity:.45;cursor:default}",
      ".ja-btn.go{background:#238636;border-color:#2ea043;color:#fff}",
      ".ja-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}",
      ".ja-agree{background:var(--bg,#0d1117);border:1px solid var(--line,#30363d);border-radius:10px;padding:10px 14px;max-height:46vh;overflow:auto}",
      ".ja-agree li{margin:6px 0}",
      ".ja-sig{font:22px 'Segoe Script','Brush Script MT','Snell Roundhand',cursive;padding:6px 10px;width:min(360px,100%);",
      " background:var(--bg,#0d1117);color:var(--ink,#e6edf3);border:0;border-bottom:2px solid var(--acc,#58a6ff);outline:none}",
      ".ja-test{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px;margin-top:8px}",
      "@media(max-width:720px){.ja-test{grid-template-columns:1fr}}",
      ".ja-stage{position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:1/1;max-height:62vh}",
      ".ja-stage canvas.em{width:100%;height:100%;image-rendering:pixelated;display:block}",
      ".ja-stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
      ".ja-stage .ja-load{position:absolute;left:10px;top:8px;color:#fff;font-size:12px;text-shadow:0 1px 2px #000}",
      ".ja-stage .ja-cap{position:absolute;left:10px;bottom:8px;color:#fff;font-size:12px;text-shadow:0 1px 2px #000}",
      ".ja-3d{position:relative;min-height:380px;border-radius:10px}",
      ".ja-choices{display:flex;flex-direction:column;gap:6px}",
      ".ja-choices .ja-btn{text-align:left}",
      ".ja-score{font-size:13px;color:var(--mut,#8b949e);margin:4px 0 8px}",
      ".ja-fb{min-height:44px;font-size:14px;margin-top:8px;padding:6px 10px;border-radius:8px}",
      ".ja-fb.info{background:rgba(56,139,253,.13);color:var(--ink,#e6edf3)}",
      ".ja-fb.right{background:rgba(46,160,67,.15);color:#3fb950}.ja-fb.wrong{background:rgba(248,81,73,.13);color:#f85149}",
      ".ja-dots{display:flex;gap:4px;margin:4px 0}.ja-dots i{width:12px;height:12px;border-radius:50%;background:var(--line,#30363d)}",
      ".ja-dots i.r{background:#3fb950}.ja-dots i.w{background:#f85149}",
      ".ja-done{padding:14px;border-radius:10px;border:1px solid var(--line,#30363d);margin-top:10px}",
      /* the licence */
      ".ja-lic{position:relative;margin:18px auto 6px;width:min(560px,100%);aspect-ratio:1.586/1;border-radius:16px;overflow:hidden;",
      " background:linear-gradient(135deg,#0b3d2e 0%,#126b4f 45%,#0f4c75 100%);color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.55);",
      " animation:jaIn .9s cubic-bezier(.2,1.4,.4,1) both;font-family:system-ui,sans-serif}",
      ".ja-lic::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 2px,transparent 2px 14px)}",
      ".ja-lic::after{content:'';position:absolute;inset:-40%;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:jaShine 2.6s 1s ease-in-out}",
      ".ja-lic .t{position:absolute;left:5%;top:7%;font:800 clamp(18px,5.4vw,34px)/1 system-ui,sans-serif;letter-spacing:.04em}",
      ".ja-lic .s{position:absolute;left:5.2%;top:22%;font-size:clamp(10px,2.2vw,13px);opacity:.85;letter-spacing:.12em;text-transform:uppercase}",
      ".ja-lic .f{position:absolute;left:5%;top:36%;font-size:clamp(11px,2.4vw,14px);line-height:1.7}",
      ".ja-lic .f b{display:inline-block;min-width:7.5em;opacity:.75;font-weight:500}",
      ".ja-lic .sig{position:absolute;left:5%;bottom:8%;font:clamp(18px,4.4vw,28px) 'Segoe Script','Brush Script MT','Snell Roundhand',cursive}",
      ".ja-lic .stamp{position:absolute;right:4%;top:24%;width:17%;aspect-ratio:1;border-radius:50%;border:3px solid rgba(255,215,90,.95);",
      " color:rgba(255,215,90,.95);display:flex;align-items:center;justify-content:center;text-align:center;font:800 clamp(9px,2vw,13px)/1.15 system-ui;",
      " transform:rotate(-14deg);animation:jaStamp .5s 1.1s cubic-bezier(.3,1.8,.5,1) both}",
      ".ja-lic .diver{position:absolute;right:2%;bottom:5%;width:57%;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}",
      "@keyframes jaIn{from{transform:scale(.2) rotate(-8deg);opacity:0}to{transform:none;opacity:1}}",
      "@keyframes jaStamp{from{transform:scale(3) rotate(-14deg);opacity:0}to{transform:scale(1) rotate(-14deg);opacity:1}}",
      "@keyframes jaShine{from{transform:translateX(-60%)}to{transform:translateX(60%)}}",
      "#jaConfetti{position:fixed;inset:0;pointer-events:none;z-index:100001}"
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ── the button that is always there ────────────────────────────────────────────────────── */
  function badge(){
    style();
    var b = document.getElementById("jaBadge");
    if (!b){
      b = document.createElement("button"); b.id = "jaBadge"; b.type = "button";
      b.addEventListener("click", function(){ open(); });
      /* beside the tabs when the page has them, so it reads as part of the tool */
      var tab = document.querySelector("[data-tab]");
      if (tab && tab.parentNode){ tab.parentNode.appendChild(b); }
      else { b.className = "float"; document.body.appendChild(b); }
    }
    var lic = licensed();
    b.classList.toggle("lic", lic);
    b.textContent = lic ? "🪪 Licence to Jump" + (STATUS.licenceNo ? " · " + STATUS.licenceNo : "")
                        : "🎓 Jump Academy";
    b.title = lic ? "You have your Licence to Jump. Open it to see your licence."
                  : "Before you log anything: sign the agreement, do the tutorial and pass two short tests.";
  }

  /* ── the overlay ────────────────────────────────────────────────────────────────────────── */
  var STEPS = ["Agreement", "Tutorial", "Organelles", "Cells", "Licence"];
  function stepDone(i){
    var s = STATUS || {};
    return i === 0 ? !!s.agreed : i === 1 ? tutorialDone() : i === 2 ? !!(s.organelles && s.organelles.passed)
         : i === 3 ? !!(s.cells && s.cells.passed) : !!s.licensed;
  }
  function firstOpenStep(){ for (var i = 0; i < 5; i++) if (!stepDone(i)) return i; return 4; }

  function shell(){
    style();
    var ov = document.getElementById("jaOv");
    if (!ov){
      ov = document.createElement("div"); ov.id = "jaOv";
      ov.innerHTML = '<div id="jaBox" role="dialog" aria-modal="true" aria-label="Jump Academy">'
        + '<button id="jaClose" type="button" title="Close (Esc)">×</button><div id="jaBody"></div></div>';
      document.body.appendChild(ov);
      ov.querySelector("#jaClose").addEventListener("click", close);
      ov.addEventListener("keydown", function(e){ if (e.key === "Escape") close(); });
    }
    return ov;
  }
  function head(){
    var h = '<h2>🎓 Jump Academy</h2><div class="ja-sub">Everything logged in the Jump tools becomes part of shared '
      + 'scientific datasets. Before you add to them: an agreement, the tutorial, and two short tests on cells and '
      + 'organelles that experts or checked AI suggestions have already identified. Pass both and you get your '
      + '<b>Licence to Jump</b> — for every Jump tool.</div>';
    if (WHY) h += '<div class="ja-fb ' + (WHY_TONE === "info" ? "info" : "wrong") + '" style="margin-top:8px">' + esc(WHY) + '</div>';
    /* ── THE STEPS ARE TABS ──────────────────────────────────────────────────────────  2026-11-12
       Gary: *"I accidentally clicked forward too fast without reading the agreement. Can you make it
       so that you can go back if you want to view the previous tab?"* Every step already reached --
       anything done, and the first one not yet done -- can be opened again by clicking its tab;
       later ones stay shut until the ones before them are done. Leaving a test half-way only drops
       that round; a new round starts when you come back. */
    var reach = firstOpenStep();
    h += '<div class="ja-steps">' + STEPS.map(function(t, i){
      var can = i <= reach || stepDone(i);
      return '<button type="button" data-jastep="' + i + '" class="' + (stepDone(i) ? "ok " : "") + (i === STEP ? "on" : "") + '"'
        + (can ? ' title="Open ' + t.toLowerCase() + '"' : ' disabled title="Finish the steps before this one first"') + '>'
        + (stepDone(i) ? "\u2713 " : (i + 1) + ". ") + t + '</button>';
    }).join("")
      /* PRACTICE (2026-11-12) is always open: no agreement, no licence, nothing saved but your score. */
      + '<button type="button" data-jastep="5" class="' + (STEP === 5 ? "on" : "") + '" title="Practise on known answers \u2014 nothing goes into the dataset, no points">\ud83c\udfaf Practice</button>'
      + '</div>';
    return h;
  }
  function body(html){
    var b = document.getElementById("jaBody");
    b.innerHTML = head() + html;
    b.querySelectorAll("[data-jastep]").forEach(function(x){
      x.onclick = function(){ var i = +x.getAttribute("data-jastep"); if (i === STEP) return; WHY = ""; stopTest(); go(i); };
    });
    return b;
  }

  async function open(why, step, tone){
    WHY = why || ""; WHY_TONE = tone || "";
    shell(); OPEN = true;
    document.getElementById("jaOv").style.display = "flex";
    if (!cred()){
      body('<div class="ja-done"><b>Sign in with Google first</b> (the account button in the top-right corner). '
        + 'The licence belongs to your account, so it follows you to every Jump tool and every computer.</div>');
      return;
    }
    if (!STATUS || STATUS_FOR !== email()){
      body('<p class="ja-sub">Reading your progress…</p>');
      await refresh();
      if (!STATUS){ body('<div class="ja-fb wrong">Could not read your Academy progress from the server. '
        + 'If this keeps happening, the backend needs Academy.gs and a new deployment.</div>'); return; }
    }
    STEP = step == null ? firstOpenStep() : step;
    render();
  }
  function close(){
    OPEN = false; WHY = "";
    var ov = document.getElementById("jaOv"); if (ov) ov.style.display = "none";
    stopTest();
  }
  function render(){
    [renderAgreement, renderTutorial, renderOrganelles, renderCells, renderLicence, renderPractice][STEP]();
  }
  function go(i){ STEP = i; render(); }

  /* ── 1. the agreement ───────────────────────────────────────────────────────────────────── */
  function renderAgreement(){
    var s = STATUS || {};
    var b = body('<h3>1. The agreement</h3>'
      + '<div class="ja-agree"><p>The Jump tools are shared scientific instruments. What you log — cell identifications, '
      + 'organelle points, tracings, corrections — is stored under your Google account name and becomes part of open '
      + 'datasets that other people analyse and publish. So, by signing:</p><ol>'
      + '<li><b>I will annotate honestly and as well as I can.</b> When I am not sure, I say so (or skip, or leave it for '
      + 'someone else) rather than guess.</li>'
      + '<li>I will not enter false, copied or machine-generated annotations as my own, and I will not try to get around '
      + 'the Academy tests.</li>'
      + '<li><b>If I use the Jump tools, their data or the databases behind them</b> (community identifications, organelle '
      + 'annotations, tracings) in a publication, preprint, thesis, poster or shared dataset, <b>I will reference them</b>: '
      + 'the Jump methods paper and the original datasets (for example MICrONS), as listed under the References tab.</li>'
      + '<li>It is enough to acknowledge the Jump annotators <b>as a community</b> (for example “We thank the Jump '
      + 'community annotators”). I do not have to name every individual annotator.</li>'
      + '<li>I understand that my annotations are credited to my account name and are shared openly with the datasets.</li>'
      + '</ol></div>'
      + (s.agreed
          ? '<div class="ja-done">✓ Signed as <span style="font-family:\'Segoe Script\',\'Brush Script MT\',cursive;font-size:18px">'
            + esc(s.signature) + '</span>.</div><div class="ja-row"><button class="ja-btn go" id="jaNext">Next: the tutorial →</button></div>'
          : '<div class="ja-row" style="margin-top:14px"><label style="display:flex;flex-direction:column;gap:4px">'
            + '<span class="ja-sub">Sign by typing your full name</span>'
            + '<input class="ja-sig" id="jaSig" autocomplete="name" value="' + esc(myName()) + '"></label></div>'
            + '<div class="ja-row"><label><input type="checkbox" id="jaOk"> I have read this and I agree</label></div>'
            + '<div class="ja-row"><button class="ja-btn go" id="jaSign" disabled>Sign</button><span id="jaMsg" class="ja-sub"></span></div>'));
    var nx = b.querySelector("#jaNext"); if (nx) nx.onclick = function(){ go(1); };
    var sg = b.querySelector("#jaSign");
    if (sg){
      var ok = b.querySelector("#jaOk"), sig = b.querySelector("#jaSig");
      var upd = function(){ sg.disabled = !(ok.checked && sig.value.trim().length >= 3); };
      ok.onchange = upd; sig.oninput = upd; upd();
      sg.onclick = async function(){
        sg.disabled = true; b.querySelector("#jaMsg").textContent = "signing…";
        var d = await api({ action: "agree", signature: sig.value.trim(), version: VERSION });
        if (d && d.ok){ STATUS = d.status; remember(STATUS); badge(); go(1); }
        else { b.querySelector("#jaMsg").textContent = "Not signed: " + ((d && d.error) || "no answer"); sg.disabled = false; }
      };
    }
  }

  /* ── 2. the tutorial ────────────────────────────────────────────────────────────────────── */
  function tourState(){ try { return (UJ.tour && UJ.tour.state) ? UJ.tour.state() : {}; } catch (_e){ return {}; } }
  function tutorialDone(){
    if (STATUS && STATUS.tutorialAt) return true;
    var st = tourState();
    return TUTORIAL_PARTS.every(function(p){ return st[p] && st[p].done; });
  }
  function renderTutorial(){
    var hasTour = !!(UJ.tour && UJ.tour.parts && UJ.tour.parts().length);
    if (!hasTour){
      body('<h3>2. The tutorial</h3><div class="ja-done">The tutorial and the tests run in <b>µJump</b>. '
        + '<a href="' + esc(ujumpUrl()) + '">Open Jump Academy in µJump →</a> — the licence you get there '
        + 'counts in this tool too.</div>');
      return;
    }
    var st = tourState(), parts = UJ.tour.parts();
    var rows = TUTORIAL_PARTS.map(function(id){
      var p = parts.filter(function(x){ return x.id === id; })[0];
      if (!p) return "";
      var done = st[id] && st[id].done;
      return '<div class="ja-row" style="justify-content:space-between;border-top:1px solid var(--line,#30363d);padding-top:8px">'
        + '<div><b>' + esc(p.title || id) + '</b><div class="ja-sub">' + (p.steps || []).length + ' steps'
        + (done ? ' · <span style="color:#3fb950">✓ done</span>' : (st[id] && st[id].at ? ' · you got to step ' + (st[id].at + 1) : '')) + '</div></div>'
        + '<button class="ja-btn' + (done ? '' : ' go') + '" data-part="' + esc(id) + '">' + (done ? 'Again' : 'Start') + '</button></div>';
    }).join("");
    var all = tutorialDone();
    var b = body('<h3>2. The tutorial</h3><p>Walk through how a cell is found and named, and how organelles are logged and '
      + 'outlined on the tracing pad. Each walkthrough points at the real controls; the Academy closes while you do it, '
      + 'and the 🎓 button brings you back.</p>' + rows
      + '<div class="ja-row" style="margin-top:14px"><button class="ja-btn go" id="jaNext"' + (all ? '' : ' disabled') + '>'
      + 'Next: organelles on the pad →</button>' + (all ? '' : '<span class="ja-sub">Finish both walkthroughs first.</span>') + '</div>');
    b.querySelectorAll("[data-part]").forEach(function(x){
      x.onclick = function(){
        close(); try { UJ.tour.start(x.getAttribute("data-part"), "top"); } catch (_e){}
        /* back to the Academy by itself once the walkthrough is finished */
        var id = x.getAttribute("data-part"), n = 0;
        var iv = setInterval(function(){
          var st = tourState();
          if (st[id] && st[id].done){ clearInterval(iv); if (!OPEN) open("", 1); }
          else if (++n > 1800 || (UJ.tour.where && !UJ.tour.where() && n > 5 && !(st[id] && st[id].at))) clearInterval(iv);
        }, 2000);
      };
    });
    b.querySelector("#jaNext").onclick = async function(){
      if (!(STATUS && STATUS.tutorialAt)){
        var d = await api({ action: "tutorial" });
        if (d && d.ok){ STATUS = d.status; remember(STATUS); }
      }
      go(2);
    };
  }

  /* ── the two tests share a driver ───────────────────────────────────────────────────────── */
  var T = null;   // {part, attemptId, items, choices, k (index into items), dots:[], busy}
  function stopTest(){ if (T){ T.stopped = true; } T = null; }

  async function startTest(part, practice){
    var host = document.getElementById("jaTest");
    host.innerHTML = '<p class="ja-sub">' + (practice ? "Getting twenty to practise on…" : "Getting ten things to identify…") + '</p>';
    var d = await api({ action: "start", part: part, practice: !!practice });
    if (!d || !d.ok){ host.innerHTML = '<div class="ja-fb wrong">' + esc((d && d.error) || "no answer from the server") + '</div>'; return; }
    T = { part: part, attemptId: d.attemptId, items: d.items, choices: d.choices, k: 0, need: d.need, pass: d.pass,
          answered: 0, correct: 0, skipped: 0, dots: [], busy: false, practice: !!d.practice };
    showItem();
  }
  function scoreHtml(){
    if (T.practice){
      var pd = ""; for (var j = 0; j < T.need; j++) pd += '<i class="' + (T.dots[j] || "") + '"></i>';
      return '<div class="ja-dots">' + pd + '</div><div class="ja-score">Practice \u00b7 ' + T.answered + ' answered \u00b7 '
        + T.correct + ' right' + (T.answered ? ' (' + Math.round(100 * T.correct / T.answered) + '%)' : '') + ' \u00b7 '
        + T.skipped + ' skipped \u00b7 not saved to the dataset, no points</div>';
    }
    var dots = "";
    for (var i = 0; i < T.need; i++) dots += '<i class="' + (T.dots[i] || "") + '"></i>';
    return '<div class="ja-dots">' + dots + '</div><div class="ja-score">' + T.answered + ' of ' + T.need + ' answered · '
      + T.correct + ' right · ' + T.skipped + ' skipped · ' + T.pass + ' right needed</div>';
  }
  function showItem(){
    if (!T) return;
    if (T.k >= T.items.length){ return; }
    var host = document.getElementById("jaTest");
    var it = T.items[T.k];
    host.innerHTML = '<div class="ja-test"><div>' + (T.part === "cells"
        ? '<div class="ja-3d" id="jaStage"><div class="ja-sub" style="padding:12px">fetching the cell…</div></div>'
        : '<div class="ja-stage" id="jaStage"><canvas class="em" width="512" height="512"></canvas>'
          + '<svg viewBox="0 0 512 512"></svg><div class="ja-load"></div><div class="ja-cap"></div></div>'
          + '<div class="ja-row" style="margin-top:6px">'
          + '<button class="ja-btn" data-z="-1" title="Previous section (↑ or the mouse wheel)">▲ section</button>'
          + '<button class="ja-btn" data-z="1" title="Next section (↓ or the mouse wheel)">▼ section</button>'
          + '<button class="ja-btn" data-zoom="1" title="Closer">＋</button><button class="ja-btn" data-zoom="-1" title="Further out">－</button>'
          + '<button class="ja-btn" data-home="1" title="Back to the marked section">↺ the marked section</button></div>')
      + '</div><div>' + scoreHtml()
      + '<div class="ja-sub" style="margin-bottom:6px">' + (T.part === "cells"
          ? 'What kind of cell is this? Drag to turn it, scroll to zoom.'
          : 'What is under the small ring, where the four lines point? Scroll through the sections and zoom; the mark stays on the spot.')
      + '</div><div class="ja-choices">'
      + T.choices.map(function(c){ return '<button class="ja-btn" data-a="' + esc(c.value) + '">' + esc(c.label) + '</button>'; }).join("")
      + '<button class="ja-btn" data-a="skip" style="opacity:.8">⏭ Skip — ' + (T.part === "cells" ? "bad segmentation / not sure" : "can’t tell / not sure") + '</button>'
      + '</div><div class="ja-fb" id="jaFb"></div></div></div>';
    host.querySelectorAll("[data-a]").forEach(function(b){ b.onclick = function(){ answer(b.getAttribute("data-a"), b); }; });
    if (T.part === "cells") showCell(it); else showSection(it);
    /* the next cell is fetched while this one is looked at */
    if (T.part === "cells" && T.items[T.k + 1]) prefetch(T.items[T.k + 1].rootId);
  }
  async function answer(a, btn, auto){
    if (!T || T.busy) return;
    T.busy = true;
    var mine = T;
    document.querySelectorAll("#jaTest [data-a]").forEach(function(b){ b.disabled = true; });
    var d = await api({ action: "answer", part: T.part, attemptId: T.attemptId, n: T.items[T.k].n, answer: a });
    if (mine !== T) return;
    var fb = document.getElementById("jaFb");
    if (!d || !d.ok){
      fb.className = "ja-fb wrong"; fb.textContent = (d && d.error) || "no answer from the server";
      T.busy = false; document.querySelectorAll("#jaTest [data-a]").forEach(function(b){ b.disabled = false; });
      return;
    }
    T.answered = d.answered; T.correct = d.correctCount; T.skipped = d.skippedCount;
    if (d.skipped && T.practice) T.dots.push("");
    if (d.skipped){ fb.className = "ja-fb"; fb.textContent = auto ? "Skipped automatically \u2014 that one could not be shown properly." : "Skipped \u2014 that does not count against you."; }
    else {
      T.dots.push(d.correct ? "r" : "w");
      fb.className = "ja-fb " + (d.correct ? "right" : "wrong");
      fb.innerHTML = d.correct ? "✓ Right — " + esc(d.truthLabel) + (d.detail ? ' <span class="ja-sub">(' + esc(d.detail) + ')</span>' : "")
                               : "✗ Not quite — it is a <b>" + esc(d.truthLabel) + "</b>" + (d.detail ? ' <span class="ja-sub">(' + esc(d.detail) + ')</span>' : "") + ".";
      if (btn) btn.style.borderColor = d.correct ? "#3fb950" : "#f85149";
    }
    if (d.status){ STATUS = d.status; remember(STATUS); badge(); }
    setTimeout(function(){
      if (mine !== T) return;
      T.busy = false;
      if (d.done) finished(d);
      else { T.k++; showItem(); }
    }, d.skipped ? 500 : 1600);
  }
  function finished(d){
    if (T.practice){ practiceDone(d); return; }
    var host = document.getElementById("jaTest"), part = T.part;
    var label = part === "cells" ? "cells" : "organelles";
    if (d.passed){
      var next = part === "organelles" ? 3 : 4;
      host.innerHTML = scoreHtml() + '<div class="ja-done" style="border-color:#3fb950"><b style="color:#3fb950">Passed — '
        + d.correctCount + ' of ' + d.answered + ' right.</b> ' + (part === "organelles" ? "Now the cells." : "") + '</div>'
        + '<div class="ja-row"><button class="ja-btn go" id="jaNext">' + (next === 3 ? "Next: cells in 3D →" : "🪪 Get your licence") + '</button></div>';
      host.querySelector("#jaNext").onclick = function(){ stopTest(); go(next); };
    } else {
      host.innerHTML = scoreHtml() + '<div class="ja-done"><b>' + (d.outOfItems ? "Too many skipped to reach ten answers this round." : d.correctCount + " of " + d.answered + " right")
        + '</b> — ' + d.pass + ' right of ' + d.need + ' answered are needed. Every round is a new set of ' + label
        + ', so try again whenever you like.</div><div class="ja-row"><button class="ja-btn go" id="jaAgain">Try again</button></div>';
      host.querySelector("#jaAgain").onclick = function(){ startTest(part); };
    }
  }

  /* ── PRACTICE ───────────────────────────────────────────────────────────────  2026-11-12
     Søren: *"a practice mode, where your accuracy is measured but you are not contributing to the
     dataset or earning real points."* The test's own questions and banks, twenty at a time, with no
     pass mark. Every answer is told right or wrong at once; the round ends with how you did per
     type, and the panel shows your score over every practice round so far (backend Academy.gs keeps
     the rounds in "Academy attempts" -- that is the measuring -- and never writes a report). */
  function practiceTable(o){
    var ks = Object.keys(o.byKind || {}).sort(function(a, b){ return o.byKind[b][1] - o.byKind[a][1]; });
    if (!ks.length) return "";
    return '<table class="ja-pt" style="border-collapse:collapse;margin-top:6px;font-size:12.5px">'
      + ks.map(function(k){ var b = o.byKind[k], pc = Math.round(100 * b[0] / b[1]);
          return '<tr><td style="padding:2px 12px 2px 0">' + esc(k) + '</td><td style="padding:2px 8px;text-align:right">'
            + b[0] + ' / ' + b[1] + '</td><td style="padding:2px 0;min-width:90px"><span style="display:inline-block;height:8px;border-radius:4px;width:'
            + Math.max(4, pc) + 'px;background:' + (pc >= 80 ? "#3fb950" : pc >= 50 ? "#e3b341" : "#f85149") + '"></span> ' + pc + '%</td></tr>'; }).join("")
      + '</table>';
  }
  async function practiceStats(){
    var el = document.getElementById("jaPStats"); if (!el) return;
    var d = await api({ action: "practiceStats" });
    if (!document.body.contains(el)) return;
    if (!d || !d.ok){ el.innerHTML = ""; return; }
    var h = "";
    ["organelles", "cells"].forEach(function(w){
      var o = d.practice[w]; if (!o || !o.rounds) return;
      h += '<div style="margin-top:10px"><b>' + (w === "cells" ? "Cells" : "Organelles") + '</b> \u2014 ' + o.rounds + ' round'
        + (o.rounds === 1 ? "" : "s") + ', ' + o.correct + ' of ' + o.answered + ' right (' + (o.answered ? Math.round(100 * o.correct / o.answered) : 0) + '%)'
        + practiceTable(o) + '</div>';
    });
    el.innerHTML = h ? '<div class="ja-sub" style="margin-top:12px">Your practice so far:</div>' + h : '';
  }
  function renderPractice(){
    if (!canTest()){
      body('<h3>\ud83c\udfaf Practice</h3><div class="ja-done">Practice uses MICrONS imagery and meshes, so it runs in <b>\u00b5Jump</b>. '
        + '<a href="' + esc(ujumpUrl()) + '">Practise in \u00b5Jump \u2192</a></div>');
      return;
    }
    body('<h3>\ud83c\udfaf Practice</h3><p>The same kind of questions as the tests, twenty at a time, on things experts or '
      + 'checked AI suggestions have already identified. You are told straight away whether you were right. '
      + '<b>Nothing you answer here goes into the dataset and it earns no points</b> \u2014 only your score is kept, so you '
      + 'can see how you improve. You do not need the agreement or the licence to practise.</p>'
      + '<div id="jaTest"><div class="ja-row"><button class="ja-btn go" id="jaPO">Practise organelles</button>'
      + '<button class="ja-btn go" id="jaPC">Practise cells in 3D</button></div><div id="jaPStats"></div></div>');
    document.getElementById("jaPO").onclick = function(){ startTest("organelles", true); };
    document.getElementById("jaPC").onclick = function(){ startTest("cells", true); };
    practiceStats();
  }
  function practiceDone(d){
    var host = document.getElementById("jaTest"), part = T.part;
    host.innerHTML = scoreHtml() + '<div class="ja-done"><b>' + d.correctCount + ' of ' + d.answered + ' right'
      + (d.answered ? ' (' + Math.round(100 * d.correctCount / d.answered) + '%)' : '') + '</b> this round.'
      + practiceTable({ byKind: d.byKind || {} }) + '</div>'
      + '<div class="ja-row"><button class="ja-btn go" id="jaAgain">Practise ' + (part === "cells" ? "cells" : "organelles") + ' again</button>'
      + '<button class="ja-btn" id="jaPBack">Back</button></div>';
    host.querySelector("#jaAgain").onclick = function(){ startTest(part, true); };
    host.querySelector("#jaPBack").onclick = function(){ stopTest(); go(5); };
  }

  /* ── 3. organelles: the pad's EM, a ring, eight kinds ──────────────────────────────────── */
  var VIEWS = [ { mip: 0, zoom: 2 }, { mip: 0, zoom: 1 }, { mip: 1, zoom: 1 }, { mip: 2, zoom: 1 } ];
  /* ── A SMALL RING AND FOUR POINTERS, NOT A BIG CIRCLE ───────────────────────────────  2026-11-12
     Søren, on a 1.4 µm-wide ring round a myelinated axon: *"The ring is too big, it is hard to know
     what you are focused on."* A 700 nm ring held several structures. The mark is a POINT on the
     organelle, so the target is now a 250 nm ring on that point (smaller than a lysosome is wide) with
     four short ticks pointing in at it from 350-650 nm out, which leave the structure itself uncovered.
     Never drawn smaller than 10 px across or the ticks shorter than 10 px, however far out you zoom. */
  var RING_NM = 250, TICK_IN_NM = 350, TICK_OUT_NM = 650;
  function renderOrganelles(){
    if (!canTest()){ renderElsewhere("organelles"); return; }
    var s = STATUS || {};
    body('<h3>3. Organelles on the tracing pad</h3><p>Ten organelles, one at a time, on the same EM sections the tracing pad '
      + 'shows. A small ring with four pointers marks a spot on each one; nothing else gives away what it is. Move up and down through the sections, zoom, and '
      + 'pick what it is. Skip anything you cannot tell — a skip costs nothing. <b>8 right out of 10 answered</b> passes. '
      + 'Each was named by a person or is an AI suggestion a person checked.</p>'
      + (s.organelles && s.organelles.passed ? '<div class="ja-done">✓ Passed (' + esc(s.organelles.score) + '). You can '
        + 'take it again for practice, or <a href="#" id="jaSkipTo">go on to the cells</a>.</div>' : '')
      + '<div id="jaTest"><div class="ja-row"><button class="ja-btn go" id="jaStart">Start</button></div></div>');
    var st = document.getElementById("jaStart"); st.onclick = function(){ startTest("organelles"); };
    var sk = document.getElementById("jaSkipTo"); if (sk) sk.onclick = function(e){ e.preventDefault(); go(3); };
  }
  function showSection(it){
    try { if (!UJ.emtiles.configured()) UJ.emtiles.configure(tracingSources()); } catch (_e){}
    var stage = document.getElementById("jaStage");
    var V = { z: 0, view: 1, gen: 0 };
    var cv = stage.querySelector("canvas"), svg = stage.querySelector("svg");
    var load = stage.querySelector(".ja-load"), cap = stage.querySelector(".ja-cap");
    async function draw(){
      var my = ++V.gen, vw = VIEWS[V.view];
      load.textContent = "loading…";
      try {
        var info = await UJ.emtiles.drawSection(cv, { centre: [it.pos[0], it.pos[1], it.pos[2] + V.z], mip: vw.mip,
                                                      zoom: vw.zoom, w: 512, h: 512, tighten: true });
        if (my !== V.gen || !T) return;
        var px = function(nm){ return nm / info.effNmPerPx; };
        var r = Math.max(5, px(RING_NM)), a = Math.max(r + 4, px(TICK_IN_NM)), b2 = Math.max(a + 10, px(TICK_OUT_NM));
        var on = V.z === 0, st = ' stroke="#ffd75a" stroke-width="2.5" stroke-linecap="round"'
          + (on ? '' : ' stroke-dasharray="5 5" opacity=".7"');
        svg.innerHTML = '<circle cx="256" cy="256" r="' + r.toFixed(1) + '" fill="none"' + st + '/>'
          + [[0, -1], [0, 1], [-1, 0], [1, 0]].map(function(d){
              return '<line x1="' + (256 + d[0] * a).toFixed(1) + '" y1="' + (256 + d[1] * a).toFixed(1)
                + '" x2="' + (256 + d[0] * b2).toFixed(1) + '" y2="' + (256 + d[1] * b2).toFixed(1) + '"' + st + '/>'; }).join("");
        load.textContent = "";
        cap.textContent = (info.umAcross).toFixed(1) + " µm across · "
          + (on ? "the marked section" : (V.z > 0 ? "+" : "") + V.z + " section" + (Math.abs(V.z) === 1 ? "" : "s") + " from the mark");
      } catch (e){ if (my === V.gen) load.textContent = "could not read the section: " + (e && e.message || e); }
    }
    var host = document.getElementById("jaTest");
    host.querySelectorAll("[data-z]").forEach(function(b){ b.onclick = function(){ V.z += +b.getAttribute("data-z"); draw(); }; });
    host.querySelectorAll("[data-zoom]").forEach(function(b){ b.onclick = function(){
      V.view = Math.max(0, Math.min(VIEWS.length - 1, V.view - (+b.getAttribute("data-zoom")))); draw(); }; });
    host.querySelector("[data-home]").onclick = function(){ V.z = 0; draw(); };
    stage.addEventListener("wheel", function(e){ e.preventDefault(); V.z += e.deltaY > 0 ? 1 : -1; draw(); }, { passive: false });
    document.getElementById("jaOv").onkeydown = function(e){
      if (e.key === "Escape") close();
      else if (e.key === "ArrowUp"){ V.z--; draw(); e.preventDefault(); }
      else if (e.key === "ArrowDown"){ V.z++; draw(); e.preventDefault(); }
    };
    draw();
  }

  /* ── 4. cells in 3D ─────────────────────────────────────────────────────────────────────── */
  var MESHES = {};
  function prefetch(root){
    if (!root || MESHES[root]) return;
    /* The coarsest level of detail, and ONLY this root: a full pyramidal cell is ~3 million vertices
       and half a minute; its coarsest level is ~40 thousand and 1.4 s (measured 2026-11-12), and the
       shape is all the question needs. [] keeps the page's own extra root IDs -- the cell on the card
       behind the Academy -- out of the test cell. */
    MESHES[root] = UJ.mesh.fetchCombinedMesh(root, function(){}, false, [], true)
      .catch(function(e){ delete MESHES[root]; throw e; });
  }
  function renderCells(){
    if (!canTest()){ renderElsewhere("cells"); return; }
    var s = STATUS || {};
    body('<h3>4. Cells in 3D</h3><p>Ten cells from Allen’s hand-classified V1 column and our own verified cell types, '
      + 'as their 3D segmentation. Is it an <b>excitatory neuron</b>, an <b>inhibitory neuron</b>, <b>glia</b> (astrocyte, '
      + 'microglia, oligodendrocyte, OPC) or a <b>vascular cell</b> (pericyte, smooth muscle, endothelial, perivascular '
      + 'fibroblast)? Turn it, zoom in on the soma and the processes. If the segmentation is broken or you are not sure, '
      + 'skip. <b>8 right out of 10 answered</b> passes.</p>'
      + (!(s.organelles && s.organelles.passed) ? '<div class="ja-fb wrong">Pass the organelles first — '
        + '<a href="#" id="jaBack">back to the organelles</a>.</div>' : '')
      + (s.cells && s.cells.passed ? '<div class="ja-done">✓ Passed (' + esc(s.cells.score) + ').</div>' : '')
      + '<div id="jaTest"><div class="ja-row"><button class="ja-btn go" id="jaStart">Start</button></div></div>');
    document.getElementById("jaStart").onclick = function(){ startTest("cells"); };
    var bk = document.getElementById("jaBack"); if (bk) bk.onclick = function(e){ e.preventDefault(); go(2); };
  }
  function showCell(it){
    var stage = document.getElementById("jaStage"), mine = T;
    prefetch(it.rootId);
    MESHES[it.rootId].then(function(m){
      if (mine !== T || !document.body.contains(stage)) return;
      /* ── A NUCLEUS IS NOT A CELL ────────────────────────────────────────────  2026-11-12
         Søren, after taking the test: *"I got a nucleus without rootID which would have been
         impossible for anyone else."* The bank is checked (backend/Academy.gs drops every root whose
         mesh is not a whole cell), but segmentations change, so the page checks too: a mesh that
         did not load, or whose largest extent is under 20 µm -- a nucleus or a bare soma -- is not
         put in front of anybody. It is skipped on their behalf, and a skip costs nothing. */
      var P = m.positions || [], mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (var i = 0; i < P.length; i += 3) for (var k = 0; k < 3; k++){
        var v = P[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
      var ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
      if (!(P.length >= 300 && ext >= 20)){ autoSkip(stage, "this cell\u2019s segmentation is only a fragment (" + (isFinite(ext) ? ext.toFixed(0) + " \u00b5m" : "empty") + ")"); return; }
      var geo = UJ.mesh3d.prepare(m.positions, m.indices, { unitNm: 1000 });
      stage.innerHTML = "";
      UJ.mesh3d.show(stage, geo, { emptyMessage: "This cell’s mesh came back empty — skip it." });
    }, function(e){
      if (mine !== T) return;
      autoSkip(stage, "its mesh could not be loaded (" + (e && e.message || e) + ")");
    });
  }
  function autoSkip(stage, why){
    stage.innerHTML = '<div class="ja-fb info" style="margin:10px">Skipped for you: ' + esc(why)
      + '. It does not count. Fetching the next cell\u2026</div>';
    setTimeout(function(){ if (T && !T.busy) answer("skip", null, true); }, 1400);
  }

  function renderElsewhere(what){
    body('<h3>' + (what === "cells" ? "4. Cells in 3D" : "3. Organelles on the tracing pad") + '</h3>'
      + '<div class="ja-done">The tests use MICrONS imagery and meshes, so they run in <b>µJump</b>. '
      + '<a href="' + esc(ujumpUrl()) + '">Continue Jump Academy in µJump →</a> — the licence counts in every Jump tool.</div>');
  }

  /* ── 5. the licence ─────────────────────────────────────────────────────────────────────── */
  function renderLicence(){
    var s = STATUS || {};
    if (!s.licensed){
      body('<h3>5. Your licence</h3><div class="ja-done">Not yet — ' + STEPS.slice(0, 4).filter(function(_t, i){ return !stepDone(i); })
        .map(function(t){ return t.toLowerCase(); }).join(", ") + ' still to do.</div>'
        + '<div class="ja-row"><button class="ja-btn go" id="jaNext">Continue</button></div>');
      document.getElementById("jaNext").onclick = function(){ go(firstOpenStep()); };
      return;
    }
    var when = s.licensedAt ? new Date(s.licensedAt) : new Date();
    var b = body('<div class="ja-lic"><div class="t">LICENCE TO JUMP!</div><div class="s">Jump Academy · every Jump tool</div>'
      + diverSvg()
      + '<div class="f"><b>Holder</b> ' + esc(s.name || myName()) + '<br><b>Licence no.</b> ' + esc(s.licenceNo) + '<br><b>Issued</b> '
      + esc(when.toLocaleDateString()) + '<br><b>Organelles</b> ' + esc(s.organelles.score) + ' · <b style="min-width:0">Cells</b> ' + esc(s.cells.score) + '</div>'
      + '<div class="sig">' + esc(s.signature) + '</div><div class="stamp">CLEARED<br>TO<br>JUMP</div></div>'
      + '<p style="text-align:center">You can now log identifications, organelles and tracings in every Jump tool. '
      + 'Thank you for doing it carefully — your work is what makes these datasets trustworthy.</p>'
      + '<div class="ja-row" style="justify-content:center"><button class="ja-btn go" id="jaGo">Start jumping →</button>'
      + '<button class="ja-btn" id="jaParty">🎉 Again!</button></div>');
    b.querySelector("#jaGo").onclick = close;
    b.querySelector("#jaParty").onclick = confetti;
    confetti();
  }
  /* ── THE DIVER ─────────────────────────────────────────────────────────────────────  2026-11-12
     Søren: *"I liked the one jumping into the pool of EM. Here I have a picture of an astrocyte. I
     would like if the stick figure could have the arrow in the logo as an indicator of where he has
     jumped from."* -- and then: *"The whole logo should be a part of it."* core/academy_dive.png:
     the µJump wordmark (µ in the accent teal, Jump, ↗), the dotted arc leaving from its ↗, and the
     stick figure of the µJump dive logo going head first, with a splash, into his render of an
     astrocyte round an EM cube (its dark background keyed out). Made by academy_dive_make.py. Found beside this script, so it works from any page that loads it. */
  var ART = (function(){
    try { var src = (document.currentScript && document.currentScript.src) || "";
          return src ? src.replace(/[^\/]*$/, "") + "academy_dive.png" : "core/academy_dive.png"; }
    catch (_e){ return "core/academy_dive.png"; }
  })();
  function diverSvg(){
    return '<img class="diver" src="' + esc(ART) + '" alt="A stick figure diving from the \u00b5Jump arrow into a block of EM with an astrocyte">';
  }
  function confetti(){
    var c = document.getElementById("jaConfetti");
    if (!c){ c = document.createElement("canvas"); c.id = "jaConfetti"; document.body.appendChild(c); }
    var W = c.width = innerWidth, H = c.height = innerHeight, g = c.getContext("2d");
    var cols = ["#ffd75a", "#3fb950", "#58a6ff", "#f778ba", "#ff7b72", "#d2a8ff"], P = [];
    for (var i = 0; i < 220; i++) P.push({ x: W / 2 + (Math.random() - .5) * 120, y: H * .45, vx: (Math.random() - .5) * 18,
      vy: -Math.random() * 18 - 6, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4,
      c: cols[i % cols.length] });
    var t0 = performance.now();
    (function frame(t){
      var el = (t - t0) / 1000;
      g.clearRect(0, 0, W, H);
      P.forEach(function(p){
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, 1 - el / 4);
        g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore();
      });
      if (el < 4) requestAnimationFrame(frame); else g.clearRect(0, 0, W, H);
    })(t0);
  }

  /* ── the gate ───────────────────────────────────────────────────────────────────────────── */
  function wrapPostReport(){
    if (typeof window.postReport !== "function" || window.postReport.__academy) return false;
    var orig = window.postReport;
    var wrapped = function(payload, okMsg){
      var t = payload && payload.type;
      if (t && REQUIRED[t] && STATUS && STATUS_FOR === email() && !STATUS.licensed){
        open("You need your Licence to Jump before you can log this. It takes about 15 minutes.");
        return false;
      }
      var r = orig.apply(this, arguments);
      if (r && typeof r.then === "function")
        r.then(function(d){
          if (d && d.ok === false && /Licence to Jump/i.test(String(d.error || ""))){
            refresh(); open("The server did not record that: you need your Licence to Jump first.");
          }
        }, function(){});
      return r;
    };
    wrapped.__academy = true;
    window.postReport = wrapped;
    return true;
  }

  /* ── start-up: the badge, the gate, and the first-sign-in welcome ───────────────────────── */
  function boot(){
    STATUS = remembered(); STATUS_FOR = STATUS ? email() : "";
    badge();
    if (!wrapPostReport()){ var n = 0; var iv = setInterval(function(){ if (wrapPostReport() || ++n > 40) clearInterval(iv); }, 250); }
    if (/#academy\b/.test(location.hash)) setTimeout(function(){ open(); }, 600);
    /* Watch for the sign-in: when an account appears (or changes), ask the server, and greet an
       account that has no licence once per browser session. */
    var lastCred = "";
    setInterval(async function(){
      var c = cred(), e = email();
      if (!c || c === lastCred) return;
      lastCred = c;
      if (STATUS_FOR !== e){ STATUS = remembered(); STATUS_FOR = STATUS ? e : ""; badge(); }
      await refresh();
      var k = "jump_academy_greeted_" + e;
      var greeted = false; try { greeted = sessionStorage.getItem(k) === "1"; } catch (_e){}
      if (STATUS && !STATUS.licensed && !greeted && !OPEN){
        try { sessionStorage.setItem(k, "1"); } catch (_e){}
        open("Welcome! Before you log anything in the Jump tools, there is Jump Academy \u2014 about 15 minutes, once, "
          + "and it counts in every Jump tool. You can look around freely without it.", null, "info");
      }
    }, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  UJ.academy = { open: open, close: close, status: function(){ return STATUS; }, refresh: refresh,
                 licensed: licensed, version: VERSION, required: REQUIRED };
})();
