/* core/signin.js — ONE GOOGLE SIGN-IN FOR ALL THE JUMP TOOLS (2026-11-17)

   Søren: "Can we somehow keep the google login when changing from the tools to VR or just between the tools? Or just
   remember which google login was used and log in with that again automatically? It is annoying having to log in
   constantly."

   Every tool page signs in the same way: Google's sign-in library (gsi/client) hands the page a signed ID token
   (a JWT, valid for about an hour), and the page sends it with what it saves, where the backend checks it with Google.
   Each page kept that token to itself, so opening another tool -- or the VR viewer -- started signed out.

   This file, loaded before the sign-in library on every page, does three things and changes nothing else:

   1. SHARED. Whenever any page receives a token, it is kept in this browser (localStorage "jump_gsi_cred", with the
      time it runs out), and every Jump page opened afterwards on this site starts signed in with it, at once and
      without a prompt -- the page's own sign-in code runs exactly as if the person had just pressed the button.
      Pages already open hear of it too (the "storage" event), so signing in on one tab signs in the others.
   2. REMEMBERED. The account used is remembered (its address, only in this browser), and the sign-in library is told
      to pick it again by itself (auto_select + login_hint). So when the hour is up -- or in a browser that has no
      shared token yet, like the headset's -- Google signs the same account in again without a click wherever it can
      (it may show a small "Signing you in…" note; the very first time in a browser it asks once).
   3. KEPT FRESH. A few minutes before the token runs out, a page that is open and in view asks Google quietly for a
      new one (at most every 10 minutes), so a long session does not drop out.

   Signing out (google.accounts.id.disableAutoSelect, which the pages call when someone signs out) forgets both the
   token and the account. Nothing here is sent anywhere: the token goes only where the page already sent it.

   How it hooks in: the sign-in library is wrapped the moment it loads -- a capturing "load" listener on the document
   runs before the page's own onload code, and a short poll covers pages that wait for it -- so initialize() calls
   from any page or module (µJump, ηJump, βJump, δJump, λJump, πJump, ωJump, χJump, VR, Academy, My work) pass through
   here. A page that never signs in is untouched. */
(function(){
  if (window.JUMP_SIGNIN) return;
  var KEY = "jump_gsi_cred", HINT = "jump_gsi_hint";
  var S = window.JUMP_SIGNIN = { cb: null, fed: 0, lastPrompt: 0, patched: false };
  function ls(k, v){ try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e){ return null; } }
  function payload(tok){
    try { var b = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "=";
      return JSON.parse(decodeURIComponent(atob(b).split("").map(function(c){ return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2); }).join(""))); }
    catch (e){ return null; }
  }
  function now(){ return Date.now() / 1000; }
  /* the shared token, if it still has more than a minute to run */
  function stored(){
    var raw = ls(KEY); if (!raw) return null;
    try { var o = JSON.parse(raw); if (o && o.cred && o.exp - now() > 60) return o; } catch (e){}
    return null;
  }
  function keep(tok){
    var p = payload(tok); if (!p || !p.exp) return;
    var cur = stored(); if (cur && cur.exp >= p.exp && cur.cred === tok) return;
    ls(KEY, JSON.stringify({ cred: tok, exp: p.exp }));
    if (p.email) ls(HINT, String(p.email));
    S.fed = Math.max(S.fed, p.exp);
  }
  S.forget = function(){ ls(KEY, null); ls(HINT, null); };
  /* hand a token to this page as if it had just come from Google */
  function feed(o){
    if (!S.cb || !o || o.exp <= S.fed) return;
    S.fed = o.exp;
    try { S.cb({ credential: o.cred, select_by: "jump_shared" }); } catch (e){ try { console.warn("[signin] page callback:", e); } catch (x){} }
  }
  function patch(){
    var id = window.google && google.accounts && google.accounts.id;
    if (!id || S.patched) return !!S.patched;
    S.patched = true;
    var init = id.initialize, dis = id.disableAutoSelect;
    id.initialize = function(cfg){
      cfg = cfg || {};
      if (typeof cfg.callback === "function"){
        var pageCb = cfg.callback;
        S.cb = pageCb;
        var hint = ls(HINT);
        cfg = Object.assign({}, cfg, {
          callback: function(resp){ try { if (resp && resp.credential) keep(resp.credential); } catch (e){} return pageCb.apply(this, arguments); },
          auto_select: true
        });
        if (hint && !cfg.login_hint) cfg.login_hint = hint;
      }
      var out = init.call(this, cfg);
      /* a page opening while a shared token is still good starts signed in; with none, but a remembered account,
         Google is asked once, quietly, for that account */
      var o = stored();
      if (o) setTimeout(function(){ feed(o); }, 0);
      else if (S.cb && ls(HINT) && !S.prompted){ S.prompted = true; setTimeout(function(){ if (!stored() && !S.fed){ S.lastPrompt = Date.now(); try { id.prompt(); } catch (e){} } }, 900); }
      return out;
    };
    if (typeof dis === "function") id.disableAutoSelect = function(){ S.forget(); return dis.apply(this, arguments); };
    return true;
  }
  /* the library's own load event, caught before the page's onload handler */
  document.addEventListener("load", function(e){ var t = e.target; if (t && t.tagName === "SCRIPT" && /accounts\.google\.com\/gsi\/client/.test(t.src || "")) patch(); }, true);
  var tries = 0, poll = setInterval(function(){ if (patch() || ++tries > 600) clearInterval(poll); }, 50);
  /* another tab signed in, or renewed */
  window.addEventListener("storage", function(e){ if (e.key === KEY){ var o = stored(); if (o) feed(o); } });
  /* a few minutes before the hour is up: ask Google quietly for the same account again */
  function freshen(){
    if (document.visibilityState !== "visible" || !S.cb || !ls(HINT)) return;
    var o = stored(), left = o ? o.exp - now() : 0;
    if (o && left > 300) return;
    var other = stored(); if (other && other.exp > S.fed){ feed(other); return; }
    if (Date.now() - S.lastPrompt < 600000) return;
    S.lastPrompt = Date.now();
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.prompt(); } catch (e){}
  }
  setInterval(freshen, 60000);
  document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible"){ var o = stored(); if (o) feed(o); setTimeout(freshen, 1500); } });
})();
