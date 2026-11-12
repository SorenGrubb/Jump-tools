/* core/verifyqueue.js -- "Check others' finds".                                         2026-11-12

   Points for correcting the AI, and for finding a type the AI cannot learn yet, wait until somebody
   else confirms them (backend Coins.gs). This is where that happens. Søren: *"there should also be a
   button somewhere to verify other people's annotations"* and *"the confirmation of other people's
   findings should be for the experts in the area"* -- so the window says that first, "Can't tell"
   is always one click away and costs nothing, and the server only takes answers from people with
   the Licence to Jump.

   BLIND. You see where the find is -- the same small ring and four pointers as the Academy -- and
   nothing about what the finder called it, or what anyone else said, until you have answered. A
   check made knowing the claim is a check of the claim.

   Checkers earn 1 point for every 5 answers ("Can't tell" does not count); the fifth brings a coin.

   UJ.verifyq.open()   opens the window. Loaded on demand by the tracing pad's button. */
(function(){
  "use strict";
  var UJ = window.UJ = window.UJ || {};
  var NOT_ORG = "not_an_organelle", ARTIFACT = "imaging_artifact";
  var VIEWS = [ { mip: 0, zoom: 2 }, { mip: 0, zoom: 1 }, { mip: 1, zoom: 1 }, { mip: 2, zoom: 1 } ];
  var RING_NM = 250, TICK_IN_NM = 350, TICK_OUT_NM = 650;
  var Q = null;          // { items, k, waiting, answeredByYou, per, busy }

  function endpoint(){
    try { if (typeof REPORT_ENDPOINT !== "undefined" && REPORT_ENDPOINT) return REPORT_ENDPOINT; } catch (_e){}
    try { return (UJ.cfg && UJ.cfg.backend && UJ.cfg.backend.endpoint) || ""; } catch (_e){ return ""; }
  }
  function cred(){
    try { if (typeof GOOGLE_CREDENTIAL !== "undefined" && GOOGLE_CREDENTIAL) return GOOGLE_CREDENTIAL; } catch (_e){}
    return window.UJ_CHAT_CRED || "";
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; });
  }
  function nameOf(k){
    if (k === NOT_ORG) return "not an organelle";
    if (k === ARTIFACT) return "an imaging artifact";
    try { if (UJ.organelleml && UJ.organelleml.nameOf) return UJ.organelleml.nameOf(k); } catch (_e){}
    var g = window.ORGANELLE_GROUPS || [];
    for (var i = 0; i < g.length; i++) for (var j = 0; j < g[i].kinds.length; j++) if (g[i].kinds[j].value === k) return g[i].kinds[j].label;
    return k;
  }
  async function api(body){
    var ep = endpoint(), c = cred();
    if (!ep) return { ok: false, error: "this page has no backend address" };
    if (!c) return { ok: false, signin: true, error: "Sign in with Google first (top right)." };
    body.credential = c;
    try {
      var r = await fetch(ep, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      var t = await r.text();
      try { return JSON.parse(t); } catch (_p){ return { ok: false, error: "the server answered with a web page instead of data" }; }
    } catch (e){ return { ok: false, error: "could not reach the server (" + (e && e.message || e) + ")" }; }
  }

  function style(){
    if (document.getElementById("vqStyle")) return;
    var s = document.createElement("style"); s.id = "vqStyle";
    s.textContent = [
      "#vqOv{position:fixed;inset:0;z-index:100000;background:rgba(1,4,9,.78);display:flex;align-items:flex-start;justify-content:center;",
      " overflow:auto;padding:24px 12px;font:14px/1.5 system-ui,sans-serif;color:var(--ink,#e6edf3)}",
      "#vqBox{position:relative;width:min(920px,100%);background:var(--card,#161b22);border:1px solid var(--line,#30363d);",
      " border-radius:14px;padding:18px 20px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}",
      "#vqBox h2{margin:0 0 4px;font-size:20px}#vqBox .sub{color:var(--mut,#8b949e);font-size:13px}",
      "#vqClose{position:absolute;right:12px;top:10px;background:none;border:0;color:var(--mut,#8b949e);font-size:22px;cursor:pointer}",
      ".vq-warn{border:1px solid #e3b341;border-radius:8px;padding:8px 10px;margin:10px 0;font-size:13px;background:rgba(227,179,65,.08)}",
      ".vq-grid{display:grid;grid-template-columns:minmax(0,512px) minmax(0,1fr);gap:16px;margin-top:10px}",
      "@media(max-width:760px){.vq-grid{grid-template-columns:1fr}}",
      ".vq-stage{position:relative;width:100%;max-width:512px;aspect-ratio:1;background:#000;border-radius:8px;overflow:hidden}",
      ".vq-stage canvas,.vq-stage svg{position:absolute;inset:0;width:100%;height:100%}",
      ".vq-load{position:absolute;left:8px;top:6px;font-size:12px;color:#ffd75a}.vq-cap{position:absolute;left:8px;bottom:6px;font-size:11.5px;color:#ddd;text-shadow:0 1px 2px #000}",
      ".vq-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}",
      ".vq-btn{border:1px solid var(--line,#30363d);background:var(--bg,#0d1117);color:var(--ink,#e6edf3);border-radius:8px;padding:6px 10px;cursor:pointer;font:13px system-ui,sans-serif}",
      ".vq-btn:hover{border-color:var(--acc,#58a6ff)}.vq-btn.go{background:#238636;border-color:#2ea043;color:#fff}",
      ".vq-btn:disabled{opacity:.5;cursor:default}",
      ".vq-fb{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:13px;display:none}",
      ".vq-fb.right{display:block;border:1px solid #3fb950;background:rgba(63,185,80,.1)}",
      ".vq-fb.wrong{display:block;border:1px solid #f85149;background:rgba(248,81,73,.08)}",
      ".vq-fb.info{display:block;border:1px solid var(--line,#30363d)}",
      "#vqSel{width:100%;margin-top:4px;padding:6px;border-radius:8px;background:var(--bg,#0d1117);color:var(--ink,#e6edf3);border:1px solid var(--line,#30363d)}"
    ].join("");
    document.head.appendChild(s);
  }
  function shell(){
    style();
    var ov = document.getElementById("vqOv");
    if (!ov){
      ov = document.createElement("div"); ov.id = "vqOv";
      ov.innerHTML = '<div id="vqBox" role="dialog" aria-modal="true" aria-label="Check others’ finds">'
        + '<button id="vqClose" type="button" title="Close (Esc)">×</button><div id="vqBody"></div></div>';
      document.body.appendChild(ov);
      ov.querySelector("#vqClose").onclick = close;
      ov.addEventListener("click", function(e){ if (e.target === ov) close(); });
    }
    ov.style.display = "flex";
    return ov;
  }
  function close(){ var ov = document.getElementById("vqOv"); if (ov) ov.style.display = "none"; Q = null; }
  function head(){
    return '<h2>🔎 Check others’ finds</h2>'
      + '<div class="vq-warn"><b>For people who know this tissue well.</b> Your answer decides whether somebody else gets '
      + 'their points, and whether their find goes into the training data. You do not see what they called it until you '
      + 'have answered. <b>If you are not sure, press “Can’t tell”</b> — it costs nothing and leaves it for '
      + 'somebody else. Want to get better first? Practise in 🎓 Jump Academy.</div>';
  }
  function setBody(h){ document.getElementById("vqBody").innerHTML = head() + h; }
  function options(){
    var g = window.ORGANELLE_GROUPS || [], h = '<option value="">— what is under the ring? —</option>';
    g.forEach(function(gr){
      var o = gr.kinds.filter(function(k){ return k.value !== "ask_expert"; });
      if (!o.length) return;
      h += '<optgroup label="' + esc(gr.label) + '">' + o.map(function(k){
        return '<option value="' + esc(k.value) + '">' + esc(k.label) + '</option>'; }).join("") + '</optgroup>';
    });
    return h;
  }
  function counter(){
    if (!Q) return "";
    var left = Q.per - (Q.answeredByYou % Q.per);
    return Q.waiting + ' find' + (Q.waiting === 1 ? "" : "s") + ' waiting · you have checked ' + Q.answeredByYou
      + ' · next point in ' + left + ' answer' + (left === 1 ? "" : "s");
  }

  async function open(){
    shell();
    setBody('<p class="sub">Fetching finds to check…</p>');
    var d = await api({ type: "coin_queue" });
    if (!d || !d.ok){ setBody('<div class="vq-fb wrong" style="display:block">' + esc((d && d.error) || "no answer from the server") + '</div>'); return; }
    Q = { items: d.items || [], k: 0, waiting: d.waiting || 0, answeredByYou: d.answeredByYou || 0, per: d.per || 5, busy: false };
    show();
  }
  function show(){
    if (!Q) return;
    if (Q.k >= Q.items.length){
      setBody('<div class="vq-fb info" style="display:block">' + (Q.items.length
        ? "That was the last one for now — thank you. New finds turn up as people correct the AI."
        : "Nothing is waiting for you to check right now. New finds turn up as people correct the AI.")
        + '</div><div class="sub" style="margin-top:8px">' + esc(counter()) + '</div>'
        + '<div class="vq-row" style="margin-top:10px"><button class="vq-btn" id="vqMore">Look again</button></div>');
      document.getElementById("vqMore").onclick = open;
      return;
    }
    var it = Q.items[Q.k];
    setBody('<div class="sub" id="vqCount">' + esc(counter()) + '</div><div class="vq-grid"><div>'
      + '<div class="vq-stage" id="vqStage"><canvas width="512" height="512"></canvas><svg viewBox="0 0 512 512"></svg>'
      + '<div class="vq-load"></div><div class="vq-cap"></div></div>'
      + '<div class="vq-row"><button class="vq-btn" data-z="-1" title="Previous section (↑ or the mouse wheel)">▲ section</button>'
      + '<button class="vq-btn" data-z="1" title="Next section (↓ or the mouse wheel)">▼ section</button>'
      + '<button class="vq-btn" data-zoom="1">＋</button><button class="vq-btn" data-zoom="-1">－</button>'
      + '<button class="vq-btn" data-home="1">↺ the marked section</button></div></div>'
      + '<div><div class="sub">What is under the small ring, where the four lines point? Scroll through the sections and zoom.</div>'
      + '<select id="vqSel">' + options() + '</select>'
      + '<div class="vq-row"><button class="vq-btn go" data-a="pick">Save</button>'
      + '<button class="vq-btn" data-a="' + NOT_ORG + '">✗ Not an organelle</button>'
      + '<button class="vq-btn" data-a="' + ARTIFACT + '">⚠ Imaging artifact</button></div>'
      + '<div class="vq-row"><button class="vq-btn" data-a="skip">⏭ Can’t tell — leave it for someone else</button></div>'
      + '<div class="vq-fb" id="vqFb"></div></div></div>');
    var body = document.getElementById("vqBody");
    var sel = document.getElementById("vqSel");
    setTimeout(function(){ try { sel.focus({ preventScroll: true }); } catch (_e){} }, 0);
    sel.addEventListener("keydown", function(e){ if (e.key === "Enter" && sel.value){ e.preventDefault(); answer(sel.value, sel); } });
    body.querySelectorAll("[data-a]").forEach(function(b){
      b.onclick = function(){
        var a = b.getAttribute("data-a");
        if (a === "pick"){ if (!sel.value){ sel.focus(); return; } a = sel.value; }
        answer(a, b);
      };
    });
    section(it);
  }
  function section(it){
    try { if (!UJ.emtiles.configured() && typeof tracingSources === "function") UJ.emtiles.configure(tracingSources()); } catch (_e){}
    var stage = document.getElementById("vqStage"), cv = stage.querySelector("canvas"), svg = stage.querySelector("svg");
    var load = stage.querySelector(".vq-load"), cap = stage.querySelector(".vq-cap");
    var V = { z: 0, view: 1, gen: 0 };
    async function draw(){
      var my = ++V.gen, vw = VIEWS[V.view];
      load.textContent = "loading…";
      try {
        var info = await UJ.emtiles.drawSection(cv, { centre: [it.pos[0], it.pos[1], it.pos[2] + V.z], mip: vw.mip,
                                                      zoom: vw.zoom, w: 512, h: 512, tighten: true });
        if (my !== V.gen) return;
        var px = function(nm){ return nm / info.effNmPerPx; };
        var r = Math.max(5, px(RING_NM)), a = Math.max(r + 4, px(TICK_IN_NM)), b2 = Math.max(a + 10, px(TICK_OUT_NM));
        var on = V.z === 0, st = ' stroke="#ffd75a" stroke-width="2.5" stroke-linecap="round"' + (on ? '' : ' stroke-dasharray="5 5" opacity=".7"');
        svg.innerHTML = '<circle cx="256" cy="256" r="' + r.toFixed(1) + '" fill="none"' + st + '/>'
          + [[0, -1], [0, 1], [-1, 0], [1, 0]].map(function(d){
              return '<line x1="' + (256 + d[0] * a).toFixed(1) + '" y1="' + (256 + d[1] * a).toFixed(1)
                + '" x2="' + (256 + d[0] * b2).toFixed(1) + '" y2="' + (256 + d[1] * b2).toFixed(1) + '"' + st + '/>'; }).join("");
        load.textContent = "";
        cap.textContent = info.umAcross.toFixed(1) + " µm across · " + (on ? "the marked section"
          : (V.z > 0 ? "+" : "") + V.z + " section" + (Math.abs(V.z) === 1 ? "" : "s") + " from the mark");
      } catch (e){ if (my === V.gen) load.textContent = "could not read the section: " + (e && e.message || e); }
    }
    var body = document.getElementById("vqBody");
    body.querySelectorAll("[data-z]").forEach(function(b){ b.onclick = function(){ V.z += +b.getAttribute("data-z"); draw(); }; });
    body.querySelectorAll("[data-zoom]").forEach(function(b){ b.onclick = function(){
      V.view = Math.max(0, Math.min(VIEWS.length - 1, V.view - (+b.getAttribute("data-zoom")))); draw(); }; });
    body.querySelector("[data-home]").onclick = function(){ V.z = 0; draw(); };
    stage.addEventListener("wheel", function(e){ e.preventDefault(); V.z += e.deltaY > 0 ? 1 : -1; draw(); }, { passive: false });
    document.getElementById("vqOv").onkeydown = function(e){
      if (e.key === "Escape") close();
      else if (e.target && e.target.tagName === "SELECT") return;
      else if (e.key === "ArrowUp"){ V.z--; draw(); e.preventDefault(); }
      else if (e.key === "ArrowDown"){ V.z++; draw(); e.preventDefault(); }
    };
    draw();
  }
  async function answer(a, btn){
    if (!Q || Q.busy) return;
    Q.busy = true;
    var mine = Q, it = Q.items[Q.k];
    document.querySelectorAll("#vqBody [data-a], #vqSel").forEach(function(b){ b.disabled = true; });
    var d = await api({ type: "coin_verify", itemId: it.id, answer: a });
    if (mine !== Q) return;
    var fb = document.getElementById("vqFb");
    if (!d || !d.ok){
      if (d && d.licenceRequired){
        fb.className = "vq-fb wrong";
        fb.innerHTML = 'Checking other people’s finds needs your Licence to Jump. '
          + '<button class="vq-btn" id="vqAcad">🎓 Open Jump Academy</button>';
        document.getElementById("vqAcad").onclick = function(){ close(); try { UJ.academy.open(); } catch (_e){} };
        Q.busy = false; return;
      }
      if (d && d.gone){ fb.className = "vq-fb info"; fb.textContent = d.error; setTimeout(function(){ if (mine === Q){ Q.busy = false; Q.k++; show(); } }, 1400); return; }
      fb.className = "vq-fb wrong"; fb.textContent = (d && d.error) || "no answer from the server";
      Q.busy = false; document.querySelectorAll("#vqBody [data-a], #vqSel").forEach(function(b){ b.disabled = false; });
      return;
    }
    if (d.answeredByYou != null) Q.answeredByYou = d.answeredByYou;
    Q.waiting = Math.max(0, Q.waiting - 1);
    if (a === "skip"){ fb.className = "vq-fb info"; fb.textContent = "Left for somebody else — thank you for saying so."; }
    else {
      var outcome = d.state === "paid" ? " That confirms it — the finder gets their points."
                  : d.state === "rejected" ? " Two people now disagree with the finder, so the find is set aside."
                  : d.needs > 1 ? " It needs " + d.needs + " agreeing checks; it has " + d.yes + "." : "";
      fb.className = "vq-fb " + (d.agree ? "right" : "wrong");
      fb.innerHTML = (d.agree ? "✓ You agree with the finder: <b>" + esc(nameOf(d.finderSaid)) + "</b>."
                              : "The finder said <b>" + esc(nameOf(d.finderSaid)) + "</b>; you said <b>" + esc(nameOf(a)) + "</b>.")
        + esc(outcome) + ' <span class="sub">Neither answer is marked right or wrong here — agreement between people decides.</span>';
    }
    var cnt = document.getElementById("vqCount"); if (cnt) cnt.textContent = counter();
    if (d.coin){
      var r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect() : null;
      var fly = function(C){ if (C) C.fly({ x: r ? r.left + r.width / 2 : null, y: r ? r.top + r.height / 2 : null, amount: d.coin.amount, label: d.coin.why || "" }); };
      if (UJ.coin) fly(UJ.coin);
      else { var sc = document.createElement("script"); sc.src = VQ_DIR + "coin.js"; sc.onload = function(){ fly(UJ.coin); }; document.head.appendChild(sc); }
    }
    setTimeout(function(){ if (mine !== Q) return; Q.busy = false; Q.k++; show(); }, a === "skip" ? 700 : 2600);
  }
  var VQ_DIR = (function(){ try { var s = document.currentScript && document.currentScript.src;
    return (s && /verifyqueue\.js(\?.*)?$/.test(s)) ? s.replace(/verifyqueue\.js(\?.*)?$/, "") : "core/"; } catch (_e){ return "core/"; } })();

  UJ.verifyq = { open: open, close: close };
})();
