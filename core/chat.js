/* core/chat.js — talk to the people working beside you, in every Jump tool and in VR.   2026-10-23

   Søren: "flags next to the users to show where they are from ... whenever someone contributes a tracing
   or cell identification to the dataset, there should be an announcement to the other active users. It
   should be discrete, but visible ... a chat window ... semi transparent with a gradient so that closer to
   the newest message in the bottom it is more visible and expandable by the user or only visible when a
   new message arrives. This chat should not be stored long term ... In this chat it should also be possible
   to share coordinates or scenes ... The chat should have the tool first, then the user with a flag in
   front, and then the message. ... smart commands by adding a / ... reachable by a dropdown that appears
   and filters commands when you start writing. There should be an all tools chat and a this tool chat ...
   direct messages ... by # first ... @ should highlight the user that you are talking to, but not be
   private ... a mute button." · "/vote “coordinates” “cell type” “old cell type” ... a button in the cell
   identity card to ask people to vote in the chat." · Backend chosen: Firebase.

   ── WHERE IT LIVES ──────────────────────────────────────────────────────────────────────────────────
   Firebase Realtime Database (free plan), because the Apps Script backend cannot push: every open page
   would have to ask for news every few seconds. Firebase pushes, keeps "who is here" with onDisconnect,
   and the same Google sign-in the tools already use signs into it (the Google ID token is exchanged with
   signInWithCredential -- no second sign-in). Nothing about the chat goes to the Google Sheet.

   ── NOT KEPT ────────────────────────────────────────────────────────────────────────────────────────
   Only the last 24 h are ever read, and every client deletes what is older when it connects (the
   security rules allow anyone signed in to delete a message older than 24 h, and nothing else of
   anybody's). Direct messages are readable only by the two people in them. Names and flags are shown,
   never e-mail addresses.

   ── THE CONFIG ──────────────────────────────────────────────────────────────────────────────────────
   FIREBASE_CONFIG below is filled from the Firebase console (see backend/CHAT-SETUP.md). While it still
   holds REPLACE_WITH_ the chat says so in its own window instead of silently doing nothing.          */
window.UJ = window.UJ || {};
UJ.chat = (function(){
  "use strict";

  var FIREBASE_CONFIG = window.UJ_FIREBASE_CONFIG || {
    apiKey: "AIzaSyAeIpUWPcFIfZ0eYGAkiT9YREZVkvRBfh8",
    authDomain: "grubblab.firebaseapp.com",
    databaseURL: "https://grubblab-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "grubblab",
    appId: "1:240227117082:web:0a6ef07ac644855e7ec9a3"
  };
  var FB_VER = "10.14.1";
  var DAY = 86400000, KEEP = 200;
  var CONFIGURED = !/REPLACE_WITH_/.test(JSON.stringify(FIREBASE_CONFIG));

  /* ── which tool this is ── */
  var TOOLS = { ujump: ["µJump", "#3fb950"], djump: ["δJump", "#58a6ff"], hjump: ["ηJump", "#d2a8ff"], bjump: ["βJump", "#ff7b72"],
                ljump: ["λJump", "#e3b341"], pjump: ["πJump", "#f778ba"], wjump: ["ωJump", "#79c0ff"], xjump: ["χJump", "#ffa657"],
                vr: ["VR", "#56d4c8"], index: ["Home", "#8b949e"] };
  function toolId(){
    var p = (location.pathname.split("/").pop() || "index.html").replace(/\.html?$/, "").toLowerCase() || "index";
    if (p === "microns_neuroglancer_jump") p = "ujump";
    /* THE VR VIEWER IS NOT A TOOL (2026-10-23, Søren: "the VR is not a tool, so it should still state that we are in
       the uJump tool"). vr.html says which tool's cells it is showing (UJ_CHAT_TOOL, from its dataset) and the chat
       files its messages, presence and room under that tool. IS_VR only moves the launcher clear of its panel. */
    if (p === "vr"){ IS_VR = true; return TOOLS[window.UJ_CHAT_TOOL] ? window.UJ_CHAT_TOOL : "ujump"; }
    return TOOLS[p] ? p : (window.UJ_CHAT_TOOL || p);
  }
  var IS_VR = false;
  var TOOL = toolId();
  function toolName(t){ return (TOOLS[t] || [t])[0]; }
  function toolCol(t){ return (TOOLS[t] || [0, "#8b949e"])[1]; }
  function toolUrl(t){ return location.href.replace(/[#?].*$/, "").replace(/[^\/]*$/, "") + (t === "index" ? "" : t + ".html"); }

  /* ── flags: chosen by the user, never guessed from the network ── */
  var CC = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ "
          + "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP "
          + "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ "
          + "OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ "
          + "UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");
  function flag(cc){ cc = String(cc || "").toUpperCase(); if (!/^[A-Z]{2}$/.test(cc)) return ""; return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65); }
  var REGION = null; try { REGION = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e){}
  function countryName(cc){ try { return REGION ? REGION.of(cc) : cc; } catch (e){ return cc; } }

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ls(k, v){ var K = "ujchat_" + (window.UJ_CHAT_TEST ? window.UJ_CHAT_TEST.uid + "_" : "") + k; try { if (v === undefined) return JSON.parse(localStorage.getItem(K) || "null"); localStorage.setItem(K, JSON.stringify(v)); } catch (e){ return null; } }

  /* ── the Google credential the page already holds ── */
  function cred(){
    try { if (typeof window.UJ_CHAT_CRED === "function"){ var c = window.UJ_CHAT_CRED(); if (c) return c; } } catch (e){}
    try { if (typeof GOOGLE_CREDENTIAL !== "undefined" && GOOGLE_CREDENTIAL && (typeof GOOGLE_VERIFIED === "undefined" || GOOGLE_VERIFIED)) return GOOGLE_CREDENTIAL; } catch (e){}
    return "";
  }
  function credName(c){ try { var p = JSON.parse(decodeURIComponent(escape(atob(c.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))); return p.given_name || p.name || (p.email || "").split("@")[0] || ""; } catch (e){ return ""; } }

  /* ════════════════════════════════════ ADAPTERS ════════════════════════════════════════════════
     One interface, two implementations: Firebase for real, and an in-browser one (BroadcastChannel
     between tabs) for the page's own tests (window.UJ_CHAT_TEST). */
  function firebaseAdapter(){
    var F = {}, db = null, me = null, sid = null, mods = {};
    F.start = async function(idToken){
      var base = "https://www.gstatic.com/firebasejs/" + FB_VER + "/";
      var A = await import(base + "firebase-app.js"), Au = await import(base + "firebase-auth.js"), D = await import(base + "firebase-database.js");
      F.D = D;
      var app = A.getApps().length ? A.getApp() : A.initializeApp(FIREBASE_CONFIG);
      var auth = Au.getAuth(app);
      if (!auth.currentUser || (idToken && F._tok !== idToken)){
        if (!idToken && !auth.currentUser) throw new Error("not signed in");
        if (idToken) await Au.signInWithCredential(auth, Au.GoogleAuthProvider.credential(idToken));
        F._tok = idToken;
      }
      db = D.getDatabase(app); me = auth.currentUser.uid;
      D.onValue(D.ref(db, "mods"), function(s){ mods = s.val() || {}; });
      return { uid: me };
    };
    F.isMod = function(uid){ return !!mods[uid]; };
    F.setProfile = function(p){ var D = F.D; return D.set(D.ref(db, "profiles/" + me), { name: p.name, flag: p.flag || "", at: D.serverTimestamp() }); };
    F.onProfiles = function(cb){ var D = F.D; D.onValue(D.ref(db, "profiles"), function(s){ cb(s.val() || {}); }); };
    F.setPresence = function(p){
      var D = F.D; if (!sid) sid = Math.random().toString(36).slice(2, 10);
      var r = D.ref(db, "presence/" + me + "/" + sid);
      D.onValue(D.ref(db, ".info/connected"), function(s){ if (s.val() === true){ D.onDisconnect(r).remove(); D.set(r, Object.assign({}, p, { at: D.serverTimestamp() })); } });
      return D.set(r, Object.assign({}, p, { at: D.serverTimestamp() }));
    };
    F.onPresence = function(cb){ var D = F.D; D.onValue(D.ref(db, "presence"), function(s){ var v = s.val() || {}, out = []; Object.keys(v).forEach(function(u){ Object.keys(v[u] || {}).forEach(function(k){ out.push(Object.assign({ uid: u, sid: k }, v[u][k])); }); }); cb(out); }); };
    function path(room){ return room.indexOf("dm_") === 0 ? "dms/" + room.slice(3) : "rooms/" + room; }
    F.send = function(room, m){ var D = F.D; return D.push(D.ref(db, path(room)), Object.assign({}, m, { uid: me, ts: D.serverTimestamp() })); };
    F.onRoom = function(room, cb){
      var D = F.D, q = D.query(D.ref(db, path(room)), D.orderByChild("ts"), D.startAt(Date.now() - DAY), D.limitToLast(KEEP));
      return D.onValue(q, function(s){ var out = []; s.forEach(function(c){ out.push(Object.assign({ id: c.key }, c.val())); }); cb(out); });
    };
    F.remove = function(room, id){ var D = F.D; return D.remove(D.ref(db, path(room) + "/" + id)); };
    F.touchDm = function(other){ var D = F.D; return Promise.all([D.set(D.ref(db, "dmIndex/" + me + "/" + other), D.serverTimestamp()), D.set(D.ref(db, "dmIndex/" + other + "/" + me), D.serverTimestamp())]); };
    F.onDmIndex = function(cb){ var D = F.D; D.onValue(D.ref(db, "dmIndex/" + me), function(s){ cb(s.val() || {}); }); };
    F.createVote = function(vid, meta){ var D = F.D; return D.set(D.ref(db, "votes/" + vid + "/meta"), Object.assign({}, meta, { uid: me, ts: D.serverTimestamp() })); };
    F.castVote = function(vid, val){ var D = F.D; return D.set(D.ref(db, "votes/" + vid + "/ballots/" + me), val); };
    F.onVote = function(vid, cb){ var D = F.D; return D.onValue(D.ref(db, "votes/" + vid), function(s){ cb(s.val() || {}); }); };
    F.announce = function(ev){ var D = F.D; return D.push(D.ref(db, "announce"), Object.assign({}, ev, { uid: me, ts: D.serverTimestamp() })); };
    F.onAnnounce = function(cb){ var D = F.D, q = D.query(D.ref(db, "announce"), D.orderByChild("ts"), D.startAt(Date.now() - 60000)); D.onChildAdded(q, function(s){ cb(Object.assign({ id: s.key }, s.val())); }); };
    /* anything older than a day is removed by whoever connects (the rules allow exactly that) */
    F.prune = async function(rooms){
      var D = F.D, cut = Date.now() - DAY;
      for (var i = 0; i < rooms.length; i++){
        try { var s = await D.get(D.query(D.ref(db, path(rooms[i])), D.orderByChild("ts"), D.endAt(cut), D.limitToFirst(100)));
              s.forEach(function(c){ D.remove(c.ref); }); } catch (e){}
      }
      try { var a = await D.get(D.query(D.ref(db, "announce"), D.orderByChild("ts"), D.endAt(cut), D.limitToFirst(100))); a.forEach(function(c){ D.remove(c.ref); }); } catch (e){}
    };
    return F;
  }
  /* The tests' adapter: every tab of the page in one browser shares one store through BroadcastChannel. */
  function testAdapter(){
    var T = {}, me = null, bc = new BroadcastChannel("ujchat_test"), S = { profiles: {}, presence: {}, rooms: {}, dmIndex: {}, votes: {}, announce: [] }, subs = [];
    function emit(){ subs.forEach(function(f){ try { f(); } catch (e){} }); }
    function put(op){ apply(op); bc.postMessage(op); }
    function apply(op){
      if (op.t === "snap"){ if (op.S) S = op.S; }
      if (op.t === "set"){ var o = S, p = op.p.split("/"); for (var i = 0; i < p.length - 1; i++) o = o[p[i]] = o[p[i]] || {}; if (op.v === null) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = op.v; }
      if (op.t === "ann"){ S.announce.push(op.v); annSubs.forEach(function(f){ f(op.v); }); }
      emit();
    }
    var annSubs = [];
    bc.onmessage = function(e){ var op = e.data; if (op.t === "hello"){ bc.postMessage({ t: "snap", S: S }); return; } apply(op); };
    T.start = async function(idToken){ me = (window.UJ_CHAT_TEST && window.UJ_CHAT_TEST.uid) || "u" + Math.random().toString(36).slice(2, 7); bc.postMessage({ t: "hello" }); await new Promise(function(r){ setTimeout(r, 150); }); return { uid: me }; };
    T.isMod = function(uid){ return !!(window.UJ_CHAT_TEST && window.UJ_CHAT_TEST.mod === uid); };
    T.setProfile = function(p){ put({ t: "set", p: "profiles/" + me, v: { name: p.name, flag: p.flag || "", at: Date.now() } }); return Promise.resolve(); };
    T.onProfiles = function(cb){ subs.push(function(){ cb(S.profiles); }); cb(S.profiles); };
    T.setPresence = function(p){ put({ t: "set", p: "presence/" + me + "/s1", v: Object.assign({}, p, { at: Date.now() }) }); return Promise.resolve(); };
    T.onPresence = function(cb){ var f = function(){ var out = []; Object.keys(S.presence).forEach(function(u){ Object.keys(S.presence[u] || {}).forEach(function(k){ out.push(Object.assign({ uid: u, sid: k }, S.presence[u][k])); }); }); cb(out); }; subs.push(f); f(); };
    T.send = function(room, m){ var id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); put({ t: "set", p: "rooms/" + room + "/" + id, v: Object.assign({}, m, { uid: me, ts: Date.now() }) }); return Promise.resolve({ key: id }); };
    T.onRoom = function(room, cb){ var f = function(){ var r = S.rooms[room] || {}; cb(Object.keys(r).map(function(k){ return Object.assign({ id: k }, r[k]); }).filter(function(m){ return m.ts > Date.now() - DAY; }).sort(function(a, b){ return a.ts - b.ts; })); }; subs.push(f); f(); return function(){ subs.splice(subs.indexOf(f), 1); }; };
    T.remove = function(room, id){ put({ t: "set", p: "rooms/" + room + "/" + id, v: null }); return Promise.resolve(); };
    T.touchDm = function(o){ put({ t: "set", p: "dmIndex/" + me + "/" + o, v: Date.now() }); put({ t: "set", p: "dmIndex/" + o + "/" + me, v: Date.now() }); return Promise.resolve(); };
    T.onDmIndex = function(cb){ subs.push(function(){ cb(S.dmIndex[me] || {}); }); cb(S.dmIndex[me] || {}); };
    T.createVote = function(vid, meta){ put({ t: "set", p: "votes/" + vid + "/meta", v: Object.assign({}, meta, { uid: me, ts: Date.now() }) }); return Promise.resolve(); };
    T.castVote = function(vid, val){ put({ t: "set", p: "votes/" + vid + "/ballots/" + me, v: val }); return Promise.resolve(); };
    T.onVote = function(vid, cb){ var f = function(){ cb(S.votes[vid] || {}); }; subs.push(f); f(); return function(){ subs.splice(subs.indexOf(f), 1); }; };
    T.announce = function(ev){ put({ t: "ann", v: Object.assign({}, ev, { uid: me, ts: Date.now() }) }); return Promise.resolve(); };
    T.onAnnounce = function(cb){ annSubs.push(cb); };
    T.prune = function(){ return Promise.resolve(); };
    return T;
  }

  /* ════════════════════════════════════ STATE ════════════════════════════════════════════════ */
  var A = null, ME = null, ON = false, STARTING = null;
  var ST = { room: "all", rooms: {}, unread: {}, profiles: {}, presence: [], dms: {}, open: !!ls("open"), big: !!ls("big"),
             muted: !!ls("muted"), mutedUsers: ls("mutedUsers") || {}, away: false, name: ls("name") || "", flag: ls("flag") || "", seen: ls("seen") || {}, votes: {} };
  var THIS_ROOM = "tool_" + TOOL;
  function roomName(r){ if (r === "all") return "All tools"; if (r === THIS_ROOM) return "This tool · " + toolName(TOOL); if (r.indexOf("dm_") === 0) return "# " + nameOf(otherOf(r)); return r; }
  function pairKey(a, b){ return a < b ? a + "_" + b : b + "_" + a; }
  function otherOf(room){ var p = room.slice(3).split("_"); return p[0] === ME ? p[1] : p[0]; }
  function nameOf(uid){ var p = ST.profiles[uid]; return (p && p.name) || "somebody"; }
  function flagOf(uid){ var p = ST.profiles[uid]; return flag(p && p.flag); }
  function online(){ var by = {}; ST.presence.forEach(function(p){ if (Date.now() - (p.at || 0) < 10 * 60000 || p.at > Date.now()) { var o = by[p.uid] = by[p.uid] || { uid: p.uid, tools: {}, away: true }; o.tools[p.tool] = 1; if (!p.away) o.away = false; } }); return Object.keys(by).map(function(k){ return by[k]; }); }

  /* ════════════════════════════════════ UI ═══════════════════════════════════════════════════ */
  var EL = {};
  var CSS = ''
    /* Windows has no flag emoji (it shows the letters "DK"), so flags come from a small font that only covers flag characters */
    + "@font-face{font-family:'Twemoji Country Flags';unicode-range:U+1F1E6-1F1FF,U+1F3F4,U+E0062-E0063,U+E0065,U+E0067,U+E006C,U+E006E,U+E0073-E0074,U+E0077,U+E007F;src:url('https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1.8/dist/TwemojiCountryFlags.woff2') format('woff2');font-display:swap}"
    + '#ujc-launch{position:fixed;left:12px;bottom:12px;z-index:9990;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:18px;border:1px solid #30363d;background:rgba(13,17,23,.88);color:#e6edf3;font:13px \'Twemoji Country Flags\',system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35)}'
    + '#ujc-launch .b{background:#f85149;color:#fff;border-radius:9px;padding:0 6px;font-size:11px;display:none}'
    + '#ujc{position:fixed;left:12px;bottom:52px;z-index:9991;width:min(380px,calc(100vw - 24px));height:min(42vh,420px);display:none;flex-direction:column;font:13px \'Twemoji Country Flags\',system-ui,sans-serif;color:#e6edf3;border-radius:12px;overflow:hidden;'
    + 'background:linear-gradient(to top,rgba(13,17,23,.93) 0%,rgba(13,17,23,.78) 45%,rgba(13,17,23,.18) 100%);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}'
    + '#ujc.big{height:min(78vh,760px);background:rgba(13,17,23,.95)}'
    + '#ujc.peek{display:flex;pointer-events:none;height:auto;max-height:30vh}#ujc.peek .hd,#ujc.peek .in,#ujc.peek .dd{display:none}#ujc.peek .ms{mask-image:none;-webkit-mask-image:none;overflow:hidden}'
    + '#ujc .hd{display:flex;gap:4px;align-items:center;padding:6px 8px;flex-wrap:wrap;background:rgba(13,17,23,.6)}'
    + '#ujc .hd button,#ujc .hd select{background:transparent;color:#e6edf3;border:1px solid #30363d;border-radius:12px;padding:2px 8px;font:12px \'Twemoji Country Flags\',system-ui;cursor:pointer}'
    + '#ujc .hd button.on{background:#238636;border-color:#2ea043}#ujc .hd .sp{flex:1}'
    + '#ujc .ms{flex:1;overflow-y:auto;padding:6px 10px;display:flex;flex-direction:column;gap:3px;-webkit-mask-image:linear-gradient(to top,#000 60%,rgba(0,0,0,.35) 100%);mask-image:linear-gradient(to top,#000 60%,rgba(0,0,0,.35) 100%)}'
    + '#ujc.big .ms{-webkit-mask-image:none;mask-image:none}'
    + '#ujc .m{line-height:1.35;word-wrap:break-word}#ujc .m .t{display:inline-block;font-size:10.5px;font-weight:600;border-radius:7px;padding:0 5px;margin-right:4px;color:#0d1117;vertical-align:1px}'
    + '#ujc .m .n{font-weight:600;margin-right:4px}#ujc .m.me .n{color:#7ee787}#ujc .m.sys{color:#8b949e;font-size:12px}#ujc .m.hl{background:rgba(227,179,65,.18);border-radius:6px;padding:0 4px}'
    + '#ujc .m .at{color:#e3b341;font-weight:600}#ujc .m .at.me{background:#e3b341;color:#0d1117;border-radius:4px;padding:0 3px}'
    + '#ujc .m .x{float:right;color:#8b949e;cursor:pointer;font-size:11px;margin-left:6px;display:none}#ujc .m:hover .x{display:inline}'
    + '#ujc .chip{display:inline-block;border:1px solid #30363d;border-radius:10px;padding:0 7px;margin:0 2px;color:#79c0ff;cursor:pointer;background:rgba(56,139,253,.12)}'
    + '#ujc .vote{border:1px solid #30363d;border-radius:8px;padding:6px 8px;margin:3px 0;background:rgba(22,27,34,.9)}#ujc .vote button{margin:4px 4px 0 0;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:2px 8px;cursor:pointer}#ujc .vote button.mine{border-color:#2ea043;background:#238636}'
    + '#ujc .in{display:flex;gap:6px;padding:6px 8px;background:rgba(13,17,23,.85);position:relative}#ujc .in input{flex:1;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:6px 8px;font:13px \'Twemoji Country Flags\',system-ui}'
    + '#ujc .dd{position:absolute;left:8px;right:8px;bottom:42px;background:#161b22;border:1px solid #30363d;border-radius:8px;max-height:220px;overflow-y:auto;display:none;z-index:2}'
    + '#ujc .dd div{padding:5px 8px;cursor:pointer}#ujc .dd div.sel,#ujc .dd div:hover{background:#1f6feb33}#ujc .dd small{color:#8b949e;margin-left:6px}'
    + '#ujc .pane{position:absolute;inset:40px 8px 48px 8px;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:auto;padding:8px;display:none;z-index:3}'
    + '#ujc-toast{position:fixed;left:12px;bottom:52px;z-index:9992;max-width:min(380px,calc(100vw - 24px));padding:6px 10px;border-radius:10px;background:rgba(13,17,23,.88);border:1px solid #30363d;color:#e6edf3;font:12.5px \'Twemoji Country Flags\',system-ui;opacity:0;transition:opacity .5s;pointer-events:none}'
    + '#ujc-toast.show{opacity:1}';

  function build(){
    if (EL.root) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var l = document.createElement("div"); l.id = "ujc-launch"; l.title = "Chat with the people working in the Jump tools now";
    l.innerHTML = '💬 <span class="c">Chat</span><span class="b"></span>'; document.body.appendChild(l); EL.launch = l;
    var r = document.createElement("div"); r.id = "ujc";
    r.innerHTML = '<div class="hd"><button data-room="all">All tools</button><button data-room="' + THIS_ROOM + '">' + esc(toolName(TOOL)) + '</button><select class="dm" title="Direct messages"><option value="">#…</option></select>'
      + '<span class="sp"></span><button class="who" title="Who is here">👥 0</button><button class="me" title="Your name and flag">⚙</button><button class="mute" title="Mute: no pop-ups and no announcements (messages are still kept for you)">🔔</button><button class="big" title="Larger, solid window">⤢</button><button class="x" title="Close">✕</button></div>'
      + '<div class="ms"></div><div class="dd"></div><div class="pane"></div>'
      + '<div class="in"><input placeholder="Message · / commands · @name highlights · #name direct" maxlength="1000"><button class="go" style="background:#238636;color:#fff;border:0;border-radius:8px;padding:0 10px">Send</button></div>';
    document.body.appendChild(r); EL.root = r; EL.ms = r.querySelector(".ms"); EL.inp = r.querySelector("input"); EL.dd = r.querySelector(".dd"); EL.pane = r.querySelector(".pane");
    var t = document.createElement("div"); t.id = "ujc-toast"; document.body.appendChild(t); EL.toast = t;
    l.addEventListener("click", function(){ setOpen(!ST.open); });
    r.querySelector(".x").addEventListener("click", function(){ setOpen(false); });
    r.querySelector(".big").addEventListener("click", function(){ ST.big = !ST.big; ls("big", ST.big); r.classList.toggle("big", ST.big); scrollEnd(); });
    r.querySelector(".mute").addEventListener("click", function(){ ST.muted = !ST.muted; ls("muted", ST.muted); syncHead(); sys(ST.muted ? "Muted: no pop-ups or announcements. 🔔 to unmute." : "Unmuted."); });
    r.querySelector(".who").addEventListener("click", function(){ paneWho(); });
    r.querySelector(".me").addEventListener("click", function(){ paneMe(); });
    r.querySelectorAll("[data-room]").forEach(function(b){ b.addEventListener("click", function(){ setRoom(b.dataset.room); }); });
    r.querySelector(".dm").addEventListener("change", function(e){ if (e.target.value) setRoom(e.target.value); });
    r.querySelector(".go").addEventListener("click", submit);
    EL.inp.addEventListener("keydown", onKey);
    EL.inp.addEventListener("input", suggest);
    r.classList.toggle("big", ST.big);
    /* the VR viewer's own panel sits bottom-left too: stand clear of it */
    if (IS_VR){ l.style.left = "auto"; l.style.right = "12px"; l.style.bottom = "64px"; r.style.left = "auto"; r.style.right = "12px"; r.style.bottom = "104px"; t.style.left = "auto"; t.style.right = "12px"; t.style.bottom = "104px"; }
  }
  function setOpen(v){
    ST.open = !!v; ls("open", ST.open); EL.root.classList.remove("peek");
    EL.root.style.display = ST.open ? "flex" : "none";
    if (ST.open){ ensure(); render(); markRead(); setTimeout(function(){ EL.inp.focus(); }, 30); }
    syncLaunch();
  }
  function syncLaunch(){
    var n = 0; Object.keys(ST.unread).forEach(function(k){ n += ST.unread[k] || 0; });
    var b = EL.launch.querySelector(".b"); b.textContent = n; b.style.display = n ? "inline-block" : "none";
    EL.launch.querySelector(".c").textContent = ON ? "Chat · " + online().length + " here" : "Chat";
  }
  function syncHead(){
    if (!EL.root) return;
    EL.root.querySelectorAll("[data-room]").forEach(function(b){ var u = ST.unread[b.dataset.room]; b.classList.toggle("on", b.dataset.room === ST.room); b.textContent = (b.dataset.room === "all" ? "All tools" : toolName(TOOL)) + (u ? " (" + u + ")" : ""); });
    var sel = EL.root.querySelector(".dm"), keys = Object.keys(ST.dms).sort(function(a, b){ return (ST.dms[b] || 0) - (ST.dms[a] || 0); });
    sel.innerHTML = '<option value="">#…</option>' + keys.map(function(o){ var r = "dm_" + pairKey(ME, o), u = ST.unread[r]; return '<option value="' + r + '"' + (ST.room === r ? " selected" : "") + ">" + flagOf(o) + " " + esc(nameOf(o)) + (u ? " (" + u + ")" : "") + "</option>"; }).join("");
    EL.root.querySelector(".who").textContent = "👥 " + online().length;
    EL.root.querySelector(".mute").textContent = ST.muted ? "🔕" : "🔔";
  }
  function setRoom(r){ ST.room = r; listen(r); render(); markRead(); syncHead(); }
  function markRead(){ ST.unread[ST.room] = 0; var L = ST.rooms[ST.room] || []; if (L.length){ ST.seen[ST.room] = L[L.length - 1].ts; ls("seen", ST.seen); } syncLaunch(); syncHead(); }
  function scrollEnd(){ EL.ms.scrollTop = EL.ms.scrollHeight; }

  /* a message's text: escaped, @names lit, coordinates and root ids as chips */
  function body(m){
    var s = String(m.text || "");
    var out = esc(s);
    out = out.replace(/@([\p{L}\p{N}_.\-]{1,40})/gu, function(all, n){ var mine = ST.name && n.toLowerCase() === ST.name.replace(/\s+/g, "").toLowerCase(); return '<span class="at' + (mine ? " me" : "") + '">@' + n + "</span>"; });
    /* coordinates (three numbers) → open that cell in the tool the message came from */
    out = out.replace(/(^|[\s(\[])(\d{3,7})\s*[, ]\s*(\d{3,7})\s*[, ]\s*(\d{2,6})(?=$|[\s)\].,;])/g, function(all, pre, x, y, z){
      var t = m.tool && m.tool !== "vr" && m.tool !== "index" ? m.tool : "ujump";
      return pre + '<span class="chip" data-href="' + esc(toolUrl(t) + "?at=" + x + "," + y + "," + z) + '" title="Open this place in ' + esc(toolName(t)) + '">📍 ' + x + ", " + y + ", " + z + "</span>"; });
    out = out.replace(/(^|[\s(\[])(8646\d{14})(?=$|[\s)\].,;])/g, function(all, pre, id){ return pre + '<span class="chip" data-href="' + esc(toolUrl("vr") + "#c=microns~" + id + "~~Segment~") + '" title="Open this segment in the VR viewer">🧩 …' + id.slice(-5) + "</span>"; });
    if (m.kind === "scene" && m.data && m.data.url) out += ' <span class="chip" data-href="' + esc(m.data.url) + '" title="Open the scene">🎬 ' + esc(m.data.title || "scene") + "</span>";
    if (m.kind === "cell" && m.data && m.data.url) out += ' <span class="chip" data-href="' + esc(m.data.url) + '">📍 ' + esc(m.data.label || "cell") + "</span>";
    return out;
  }
  function line(m){
    if (ST.mutedUsers[m.uid]) return "";
    var mine = m.uid === ME, mention = !mine && ST.name && new RegExp("@" + ST.name.replace(/\s+/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}_])", "iu").test(m.text || "");
    if (m.kind === "sys") return '<div class="m sys">' + esc(m.text) + "</div>";
    var del = (mine || (A && A.isMod(ME))) ? '<span class="x" data-del="' + esc(m.id) + '" title="Delete">✕</span>' : "";
    var head = '<span class="t" style="background:' + toolCol(m.tool) + '">' + esc(toolName(m.tool)) + "</span>"
      + '<span class="n" title="' + esc(m.flag ? countryName(m.flag) : "") + '">' + flag(m.flag) + " " + esc(m.name || nameOf(m.uid)) + "</span>";
    if (m.kind === "vote") return '<div class="m' + (mention ? " hl" : "") + (mine ? " me" : "") + '">' + del + head + voteCard(m) + "</div>";
    return '<div class="m' + (mention ? " hl" : "") + (mine ? " me" : "") + '">' + del + head + body(m) + "</div>";
  }
  function render(){
    if (!EL.root || !ST.open) return;
    var L = (ST.rooms[ST.room] || []).filter(function(m){ return !ST.mutedUsers[m.uid]; });
    var near = EL.ms.scrollHeight - EL.ms.scrollTop - EL.ms.clientHeight < 60;
    EL.ms.innerHTML = (!ON ? '<div class="m sys">' + esc(STATUS) + "</div>" + (NEED_SIGNIN ? '<div class="ujc-gsi" style="margin:8px 0"></div>' : "") : "") + (L.length ? "" : (ON ? '<div class="m sys">No messages in the last 24 h in ' + esc(roomName(ST.room)) + ". Say hello — or type / for commands.</div>" : "")) + L.map(line).join("") + (LOCAL[ST.room] || []).map(function(t){ return '<div class="m sys">' + esc(t) + "</div>"; }).join("");
    wire(EL.ms);
    var gb = EL.ms.querySelector(".ujc-gsi"); if (gb) signInto(gb);
    if (near) scrollEnd();
  }
  /* ── A SIGN-IN BUTTON IN THE CHAT ITSELF ──────────────────────────────────────  2026-10-23
     Søren: "I don't see a google login button anywhere, we need to have that clearly there, also in VR." The chat
     used to say "Sign in with Google (the button in the tool)", and in several tools that button sits in a panel
     you may not have open. Now the chat draws Google's own button. It is the PAGE's sign-in: a page that offers
     UJ_CHAT_SIGNIN(el) draws it (vr.html does), otherwise Google's button is drawn with the callback the page
     already gave google.accounts.id.initialize -- so signing in here signs you in to the tool too, and the chat
     notices the new credential by itself. */
  var NEED_SIGNIN = false, SIGNIN_POLL = 0;
  function signInto(el){
    try {
      if (typeof window.UJ_CHAT_SIGNIN === "function"){ window.UJ_CHAT_SIGNIN(el); return; }
      if (window.google && google.accounts && google.accounts.id){ google.accounts.id.renderButton(el, { theme: "filled_black", size: "medium", text: "signin_with" }); return; }
    } catch (e){}
    el.innerHTML = '<span style="color:#8b949e">Google sign-in is still loading…</span>';
    setTimeout(function(){ if (el.isConnected && !ON) signInto(el); }, 1000);
  }
  function waitForCred(){
    if (SIGNIN_POLL) return;
    SIGNIN_POLL = setInterval(function(){
      if (ON){ clearInterval(SIGNIN_POLL); SIGNIN_POLL = 0; return; }
      if (!STARTING && cred()){ clearInterval(SIGNIN_POLL); SIGNIN_POLL = 0; NEED_SIGNIN = false; ensure(); }
    }, 1500);
  }
  function wire(el){
    el.querySelectorAll("[data-href]").forEach(function(c){ c.onclick = function(){ window.open(c.dataset.href, "_blank", "noopener"); }; });
    el.querySelectorAll("[data-del]").forEach(function(c){ c.onclick = function(){ if (confirm("Delete this message?")) A.remove(ST.room.indexOf("dm_") === 0 ? ST.room : ST.room, c.dataset.del); }; });
    el.querySelectorAll("[data-vote]").forEach(function(b){ b.onclick = function(){ A.castVote(b.dataset.vote, b.dataset.v); }; });
  }
  var LOCAL = {};
  function sys(t){ (LOCAL[ST.room] = LOCAL[ST.room] || []).push(t); if (LOCAL[ST.room].length > 8) LOCAL[ST.room].shift(); render(); }
  /* a new message while the window is closed: a moment's peek at the last few lines, unless muted */
  var peekT = 0;
  function peek(room){
    if (ST.muted || ST.open || !EL.root) return;
    var L = (ST.rooms[room] || []).filter(function(m){ return !ST.mutedUsers[m.uid] && m.uid !== ME; }).slice(-3);
    if (!L.length) return;
    EL.root.classList.add("peek"); EL.root.style.display = "flex";
    EL.ms.innerHTML = '<div class="m sys">' + esc(roomName(room)) + "</div>" + L.map(line).join(""); scrollEnd();
    clearTimeout(peekT); peekT = setTimeout(function(){ if (!ST.open){ EL.root.classList.remove("peek"); EL.root.style.display = "none"; } }, 7000);
  }
  function toast(html){
    if (ST.muted || !EL.toast) return;
    EL.toast.innerHTML = html; EL.toast.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function(){ EL.toast.classList.remove("show"); }, 6000);
  }

  /* ── votes ── */
  var VOTE_SUB = {};
  function voteCard(m){
    var d = m.data || {}, v = ST.votes[d.vid] || {}, b = v.ballots || {}, n = { yes: 0, no: 0, unsure: 0 };
    Object.keys(b).forEach(function(k){ if (n[b[k]] != null) n[b[k]]++; });
    if (!VOTE_SUB[d.vid] && A){ VOTE_SUB[d.vid] = true; A.onVote(d.vid, function(val){ ST.votes[d.vid] = val; clearTimeout(VOTE_SUB._t); VOTE_SUB._t = setTimeout(render, 0); }); }
    var at = d.at ? '<span class="chip" data-href="' + esc(toolUrl(d.tool || "ujump") + "?at=" + d.at) + '">📍 ' + esc(d.at) + "</span>" : "";
    var mine = b[ME];
    return '<div class="vote">🗳 <b>Is this ' + esc(d.newType || "?") + "?</b> " + at + (d.oldType ? '<div style="color:#8b949e;font-size:12px">currently: ' + esc(d.oldType) + "</div>" : "")
      + (d.note ? '<div style="font-size:12px">' + esc(d.note) + "</div>" : "")
      + ["yes", "no", "unsure"].map(function(k){ return '<button data-vote="' + esc(d.vid) + '" data-v="' + k + '"' + (mine === k ? ' class="mine"' : "") + ">" + { yes: "👍 " + esc(d.newType || "yes"), no: "👎 " + esc(d.oldType || "no"), unsure: "🤷 not sure" }[k] + " · " + n[k] + "</button>"; }).join("") + "</div>";
  }

  /* ── commands ── */
  var CMDS = [
    ["help", "", "list the commands"],
    ["cell", "[x,y,z | root id] [what]", "share a place or a cell; opens on click. Without arguments: the cell you have open"],
    ["scene", "[title]", "share the VR scene you have open (it is saved first)"],
    ["vote", "x,y,z  “new type”  [“old type”]", "ask everyone: is the cell at x,y,z a new type? One click to answer"],
    ["forum", "[question|idea|bug|finding] title — text", "post to the Discussion forum"],
    ["here", "", "who is online, and in which tool"],
    ["name", "your name", "how you are shown"],
    ["flag", "country (e.g. DK, Denmark)", "the flag in front of your name"],
    ["away", "", "show yourself as away"],
    ["back", "", "show yourself as here again"],
    ["mute", "[@name]", "mute the chat, or one person"],
    ["unmute", "[@name]", "undo /mute"],
    ["clear", "", "clear this window (the messages are not deleted)"]
  ];
  function curCell(){
    try { if (typeof window.UJ_CHAT_CELL === "function"){ var c = window.UJ_CHAT_CELL(); if (c) return c; } } catch (e){}
    try { if (window.CUR_POS && window.CUR_POS.length === 3) return { at: window.CUR_POS.map(Math.round).join(","), label: (window.CUR_CELLTYPE_DISPLAY || "cell") }; } catch (e){}
    return null;
  }
  function parseArgs(s){ var out = [], re = /“([^”]*)”|"([^"]*)"|'([^']*)'|(\S+)/g, m; while ((m = re.exec(s))) out.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]); return out; }
  function userByName(n){
    n = String(n || "").replace(/^[@#]/, "").toLowerCase(); if (!n) return null;
    var hit = null; Object.keys(ST.profiles).forEach(function(u){ var p = ST.profiles[u]; if (p && p.name && p.name.toLowerCase() === n) hit = u; });
    if (!hit) Object.keys(ST.profiles).forEach(function(u){ var p = ST.profiles[u]; if (!hit && p && p.name && p.name.toLowerCase().indexOf(n) === 0) hit = u; });
    return hit;
  }
  async function command(text){
    var sp = text.indexOf(" "), cmd = (sp < 0 ? text.slice(1) : text.slice(1, sp)).toLowerCase(), rest = sp < 0 ? "" : text.slice(sp + 1).trim();
    if (cmd === "help"){ sys("Commands: " + CMDS.map(function(c){ return "/" + c[0] + (c[1] ? " " + c[1] : "") + " — " + c[2]; }).join(" · ") + " · #name message = direct message · @name = highlight (public)"); return; }
    if (cmd === "here"){ var on = online(); sys(on.length ? on.map(function(o){ return flagOf(o.uid) + " " + nameOf(o.uid) + " (" + Object.keys(o.tools).map(toolName).join(", ") + (o.away ? ", away" : "") + ")"; }).join(" · ") : "Nobody else is here right now."); return; }
    if (cmd === "name"){ if (!rest){ sys("Usage: /name Your Name"); return; } ST.name = rest.slice(0, 40); ls("name", ST.name); await A.setProfile({ name: ST.name, flag: ST.flag }); presence(); sys("You are shown as " + ST.name + "."); return; }
    if (cmd === "flag"){ var cc = toCC(rest); if (!cc){ sys("Which country? e.g. /flag DK or /flag Denmark"); return; } ST.flag = cc; ls("flag", cc); await A.setProfile({ name: ST.name, flag: cc }); presence(); sys("Flag set: " + flag(cc) + " " + countryName(cc) + "."); return; }
    if (cmd === "away" || cmd === "back"){ ST.away = cmd === "away"; presence(); sys(ST.away ? "You are shown as away." : "Welcome back."); return; }
    if (cmd === "mute" || cmd === "unmute"){
      var who = userByName(rest);
      if (rest && !who){ sys("Nobody called " + rest + " here."); return; }
      if (who){ if (cmd === "mute") ST.mutedUsers[who] = 1; else delete ST.mutedUsers[who]; ls("mutedUsers", ST.mutedUsers); render(); sys((cmd === "mute" ? "Muted " : "Unmuted ") + nameOf(who) + " (only for you)."); return; }
      ST.muted = cmd === "mute"; ls("muted", ST.muted); syncHead(); sys(ST.muted ? "Chat muted." : "Chat unmuted."); return;
    }
    if (cmd === "clear"){ LOCAL[ST.room] = []; EL.ms.innerHTML = ""; return; }
    if (cmd === "cell"){
      var a = parseArgs(rest), xyz = rest.match(/(\d{3,7})\s*[, ]\s*(\d{3,7})\s*[, ]\s*(\d{2,6})/), root = rest.match(/8646\d{14}/), data = null;
      if (xyz) data = { at: xyz[1] + "," + xyz[2] + "," + xyz[3], label: rest.replace(xyz[0], "").trim() || "this place" };
      else if (root) data = { root: root[0], label: rest.replace(root[0], "").trim() || "segment …" + root[0].slice(-5) };
      else { var c = curCell(); if (c) data = { at: c.at, root: c.root, label: c.label }; }
      if (!data){ sys("Usage: /cell x,y,z  (voxels)  or  /cell <root id> — or open a cell first."); return; }
      var t = TOOL === "vr" || TOOL === "index" ? "ujump" : TOOL;
      data.url = data.at ? toolUrl(t) + "?at=" + data.at : toolUrl("vr") + "#c=microns~" + data.root + "~~Segment~";
      await post({ kind: "cell", text: "", data: data }); return;
    }
    if (cmd === "scene"){
      if (typeof window.UJ_CHAT_SCENE !== "function"){ sys("/scene works in the VR viewer: open a scene there."); return; }
      sys("Saving the scene to share it…");
      try { var s = await window.UJ_CHAT_SCENE(rest); if (!s || !s.url){ sys("The scene could not be saved" + (s && s.error ? ": " + s.error : ".")); return; } await post({ kind: "scene", text: rest, data: s }); }
      catch (e){ sys("The scene could not be saved: " + (e.message || e)); }
      return;
    }
    if (cmd === "vote"){
      var xy = rest.match(/(\d{3,7})\s*[, ]\s*(\d{3,7})\s*[, ]\s*(\d{2,6})/), args = parseArgs(xy ? rest.replace(xy[0], "") : rest);
      var at = xy ? xy[1] + "," + xy[2] + "," + xy[3] : (curCell() || {}).at;
      if (!at || !args[0]){ sys("Usage: /vote x,y,z “new type” “old type”"); return; }
      var vid = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var meta = { at: at, newType: args[0], oldType: args[1] || "", note: args.slice(2).join(" "), tool: TOOL === "vr" || TOOL === "index" ? "ujump" : TOOL };
      await A.createVote(vid, meta);
      await post({ kind: "vote", text: "vote: " + args[0], data: Object.assign({ vid: vid }, meta) }); return;
    }
    if (cmd === "forum"){
      var kinds = ["question", "idea", "bug", "finding"], w = rest.split(/\s+/), kind = kinds.indexOf((w[0] || "").toLowerCase()) >= 0 ? w.shift().toLowerCase() : "question";
      var r2 = w.join(" "), parts = r2.split(/\s+[—–-]{1,2}\s+/), title = (parts[0] || "").trim(), txt = parts.slice(1).join(" — ").trim() || title;
      if (!title){ sys("Usage: /forum question Title — the text"); return; }
      var ep = (window.UJ && UJ.cfg && UJ.cfg.backend && UJ.cfg.backend.endpoint) || window.UJ_CHAT_BACKEND || (typeof REPORT_ENDPOINT !== "undefined" ? REPORT_ENDPOINT : "");
      if (!ep){ sys("No forum on this page."); return; }
      try {
        var r = await fetch(ep, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ type: "forum_post", scope: "tools", kind: kind, title: title.slice(0, 140), body: txt + "\n\n(posted from the chat)", credential: cred(), tool: TOOL }) });
        var d = {}; try { d = JSON.parse(await r.text()); } catch (e){}
        if (d.ok === false){ sys("Not posted: " + (d.error || "refused")); return; }
        await post({ kind: "msg", text: "📝 posted to the Discussion forum (" + kind + "): " + title });
      } catch (e){ sys("The forum could not be reached."); }
      return;
    }
    sys("Unknown command /" + cmd + " — type /help.");
  }
  function toCC(s){ s = String(s || "").trim(); if (!s) return ""; var u = s.toUpperCase(); if (/^[A-Z]{2}$/.test(u) && CC.indexOf(u) >= 0) return u; var lo = s.toLowerCase(); for (var i = 0; i < CC.length; i++) if (countryName(CC[i]).toLowerCase() === lo) return CC[i]; for (i = 0; i < CC.length; i++) if (countryName(CC[i]).toLowerCase().indexOf(lo) === 0) return CC[i]; return ""; }

  async function post(m){
    if (!ON){ sys("Not connected."); return; }
    var room = ST.room;
    var msg = Object.assign({ name: ST.name, flag: ST.flag, tool: TOOL, kind: "msg", text: "" }, m);
    msg.text = String(msg.text || "").slice(0, 1000);
    await A.send(room, msg);
    if (room.indexOf("dm_") === 0) A.touchDm(otherOf(room));
  }
  async function submit(){
    var text = EL.inp.value.trim(); if (!text) return;
    EL.inp.value = ""; hideDd();
    if (!ON){ sys(STATUS); return; }
    if (text[0] === "/") return command(text);
    if (text[0] === "#"){
      var m = text.match(/^#(\S+)\s*([\s\S]*)$/), who = m && userByName(m[1]);
      if (!who){ sys("Nobody called " + (m ? m[1] : "") + " — direct messages go to someone who has used the chat."); return; }
      if (who === ME){ sys("That is you."); return; }
      var room = "dm_" + pairKey(ME, who); ST.dms[who] = Date.now(); setRoom(room);
      if (m[2]) await post({ text: m[2] });
      return;
    }
    await post({ text: text });
  }
  /* the dropdown: commands after "/", people after "@" or "#" */
  var DD = { items: [], sel: 0 };
  function suggest(){
    var v = EL.inp.value, items = [];
    if (/^\/\S*$/.test(v)){ var q = v.slice(1).toLowerCase(); items = CMDS.filter(function(c){ return c[0].indexOf(q) === 0; }).map(function(c){ return { ins: "/" + c[0] + " ", html: "<b>/" + c[0] + "</b> " + esc(c[1]) + "<small>" + esc(c[2]) + "</small>" }; }); }
    var at = v.match(/(^|\s)([@#])([\p{L}\p{N}_.\-]*)$/u);
    if (at){ var q2 = at[3].toLowerCase(), seen = {};
      var people = online().map(function(o){ return o.uid; }).concat(Object.keys(ST.profiles));
      people.forEach(function(u){ if (seen[u] || u === ME) return; seen[u] = 1; var n = nameOf(u); if (n.toLowerCase().indexOf(q2) === 0) items.push({ ins: v.slice(0, v.length - at[3].length - 1) + at[2] + n.replace(/\s+/g, "") + " ", html: flagOf(u) + " " + esc(n) + "<small>" + (at[2] === "#" ? "direct message" : "highlight") + "</small>" }); });
      items = items.slice(0, 8);
    }
    DD.items = items; DD.sel = 0;
    if (!items.length){ hideDd(); return; }
    EL.dd.innerHTML = items.map(function(it, i){ return '<div data-i="' + i + '"' + (i === 0 ? ' class="sel"' : "") + ">" + it.html + "</div>"; }).join("");
    EL.dd.style.display = "block";
    EL.dd.querySelectorAll("[data-i]").forEach(function(d){ d.onmousedown = function(e){ e.preventDefault(); pick(+d.dataset.i); }; });
  }
  function hideDd(){ EL.dd.style.display = "none"; DD.items = []; }
  function pick(i){ var it = DD.items[i]; if (!it) return; EL.inp.value = it.ins; hideDd(); EL.inp.focus(); }
  function onKey(e){
    if (DD.items.length && EL.dd.style.display === "block"){
      if (e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); DD.sel = (DD.sel + (e.key === "ArrowDown" ? 1 : DD.items.length - 1)) % DD.items.length; EL.dd.querySelectorAll("[data-i]").forEach(function(d, i){ d.classList.toggle("sel", i === DD.sel); }); return; }
      if (e.key === "Tab" || (e.key === "Enter" && DD.items[DD.sel] && EL.inp.value.trim() !== DD.items[DD.sel].ins.trim())){ e.preventDefault(); pick(DD.sel); return; }
      if (e.key === "Escape"){ hideDd(); return; }
    }
    if (e.key === "Enter"){ e.preventDefault(); submit(); }
    e.stopPropagation();          // the tools' own keys (WASD in VR, shortcuts) stay out of the chat
  }
  function paneWho(){
    var on = online();
    EL.pane.innerHTML = "<b>Here now (" + on.length + ")</b><br>" + (on.length ? on.map(function(o){ return '<div style="margin:4px 0">' + flagOf(o.uid) + " " + esc(nameOf(o.uid)) + ' <span style="color:#8b949e">' + Object.keys(o.tools).map(toolName).join(", ") + (o.away ? " · away" : "") + "</span>" + (o.uid !== ME ? ' <button data-dm="' + o.uid + '">#</button>' : "") + "</div>"; }).join("") : "Nobody") + '<div style="margin-top:8px"><button class="close">Close</button></div>';
    EL.pane.style.display = "block";
    EL.pane.querySelector(".close").onclick = function(){ EL.pane.style.display = "none"; };
    EL.pane.querySelectorAll("[data-dm]").forEach(function(b){ b.onclick = function(){ EL.pane.style.display = "none"; ST.dms[b.dataset.dm] = Date.now(); setRoom("dm_" + pairKey(ME, b.dataset.dm)); }; });
  }
  function paneMe(){
    EL.pane.innerHTML = '<b>You in the chat</b><div style="margin:6px 0">Name <input class="nm" maxlength="40" value="' + esc(ST.name) + '" style="width:60%"></div>'
      + '<div>Flag <select class="fl"><option value="">— none —</option>' + CC.map(function(c){ return { c: c, n: countryName(c) }; }).sort(function(a, b){ return a.n.localeCompare(b.n); }).map(function(o){ return '<option value="' + o.c + '"' + (o.c === ST.flag ? " selected" : "") + ">" + flag(o.c) + " " + esc(o.n) + "</option>"; }).join("") + "</select></div>"
      + '<div style="color:#8b949e;font-size:12px;margin:6px 0">Shown to everybody next to your messages. Your e-mail is never shown.</div><button class="save">Save</button> <button class="close">Close</button>';
    EL.pane.style.display = "block";
    EL.pane.querySelector(".close").onclick = function(){ EL.pane.style.display = "none"; };
    EL.pane.querySelector(".save").onclick = async function(){ ST.name = EL.pane.querySelector(".nm").value.trim().slice(0, 40) || ST.name; ST.flag = EL.pane.querySelector(".fl").value; ls("name", ST.name); ls("flag", ST.flag); if (ON){ await A.setProfile({ name: ST.name, flag: ST.flag }); presence(); } EL.pane.style.display = "none"; render(); };
  }

  /* ════════════════════════════════════ CONNECTING ══════════════════════════════════════════ */
  var STATUS = "Sign in with Google to chat:", LISTEN = {};
  function presence(){ if (ON) A.setPresence({ name: ST.name, flag: ST.flag, tool: TOOL, away: !!ST.away }); }
  function listen(room){
    if (LISTEN[room] || !ON) return;
    LISTEN[room] = A.onRoom(room, function(list){
      var before = (ST.rooms[room] || []).length;
      ST.rooms[room] = list;
      var last = ST.seen[room] || 0, fresh = list.filter(function(m){ return m.ts > last && m.uid !== ME && !ST.mutedUsers[m.uid]; }).length;
      if (!(ST.open && ST.room === room)) ST.unread[room] = fresh;
      else markRead();
      if (room === ST.room) render();
      if (list.length > before && before && !(ST.open && ST.room === room)){ var nm = list[list.length - 1]; if (nm.uid !== ME) peek(room); }
      syncLaunch(); syncHead();
    });
  }
  function ensure(){
    if (ON || STARTING) return STARTING;
    if (!CONFIGURED && !window.UJ_CHAT_TEST){ STATUS = "The chat is not set up yet: the Firebase project has to be created and its settings pasted into core/chat.js (see backend/CHAT-SETUP.md)."; render(); return null; }
    var c = cred();
    if (!c && !window.UJ_CHAT_TEST){ STATUS = "Sign in with Google to chat:"; NEED_SIGNIN = true; waitForCred(); render(); return null; }
    NEED_SIGNIN = false;
    STATUS = "Connecting…"; render();
    A = window.UJ_CHAT_TEST ? testAdapter() : firebaseAdapter();
    STARTING = (async function(){
      try {
        var u = await A.start(c); ME = u.uid;
        if (!ST.name) ST.name = (window.UJ_CHAT_TEST && window.UJ_CHAT_TEST.name) || credName(c) || "Guest";
        ls("name", ST.name);
        await A.setProfile({ name: ST.name, flag: ST.flag });
        A.onProfiles(function(p){ ST.profiles = p; syncHead(); render(); });
        A.onPresence(function(list){ ST.presence = list; syncLaunch(); syncHead(); });
        A.onDmIndex(function(ix){ ST.dms = ix; Object.keys(ix).forEach(function(o){ listen("dm_" + pairKey(ME, o)); }); syncHead(); });
        A.onAnnounce(onAnnounce);
        ON = true; presence();
        listen("all"); listen(THIS_ROOM); listen(ST.room);
        setInterval(presence, 4 * 60000);
        setTimeout(function(){ A.prune(["all", THIS_ROOM]); }, 5000);
        if (!ST.flag) sys("Welcome, " + ST.name + "! Choose your flag with ⚙ or /flag DK. Type / for commands.");
        render(); syncLaunch();
      } catch (e){ STATUS = "The chat could not connect: " + (e.message || e); ON = false; render(); }
      STARTING = null;
    })();
    return STARTING;
  }

  /* ════════════════════════════════════ ANNOUNCEMENTS ═══════════════════════════════════════
     Seen on the wire, not wired into every page: a POST of one of these kinds to the backend is a
     contribution, and it is announced once it has gone (a reply that says ok:false is not). Several of
     a kind within half a minute are one announcement ("12 organelles"). */
  var ANN = { new_identification: ["🔬", "identified a cell"], discrepancy: ["✏️", "corrected a cell's type"], confirmation: ["✅", "confirmed a cell"],
              traced_structure: ["✏️", "traced"], organelle_location: ["📍", "reported"], propose_root_id: ["🧩", "added a missing part to a cell"],
              new_cell_no_nucleus: ["✨", "found a new cell"], merged_split: ["✂️", "split merged nuclei"], not_a_nucleus: ["🚫", "flagged a false nucleus"],
              vote_identity: ["🗳", "voted on a cell's identity"] };
  var annBuf = {};
  function noteContribution(p){
    if (!p || !ANN[p.type] || !ON) return;
    var k = p.type, b = annBuf[k] = annBuf[k] || { n: 0, what: {}, t: 0 };
    b.n++; var w = p.identified || p.cellType || p.kind || p.name || ""; if (w) b.what[w] = (b.what[w] || 0) + 1;
    clearTimeout(b.t);
    b.t = setTimeout(function(){
      var whats = Object.keys(b.what), what = whats.slice(0, 3).map(function(x){ return String(x).replace(/_/g, " ") + (b.what[x] > 1 ? " ×" + b.what[x] : ""); }).join(", ");
      A.announce({ name: ST.name, flag: ST.flag, tool: TOOL, kind: k, n: b.n, what: what.slice(0, 120) }).catch(function(){});
      delete annBuf[k];
    }, 4000);
  }
  function onAnnounce(ev){
    if (ev.uid === ME || ST.mutedUsers[ev.uid] || !(ev.ts > Date.now() - 60000)) return;
    var a = ANN[ev.kind] || ["•", "contributed"];
    var txt = a[0] + " " + flag(ev.flag) + " <b>" + esc(ev.name || "Someone") + "</b> " + esc(a[1]) + (ev.what ? ": " + esc(ev.what) : "") + (ev.n > 1 && ev.kind === "organelle_location" ? " (" + ev.n + ")" : "")
      + ' <span style="color:#8b949e">in ' + esc(toolName(ev.tool)) + "</span>";
    toast(txt);
  }
  (function hookFetch(){
    if (window.__ujChatFetch) return; window.__ujChatFetch = true;
    var orig = window.fetch;
    window.fetch = function(input, init){
      var p = null;
      try { if (init && init.method === "POST" && typeof init.body === "string" && /script\.google\.com/.test(String(input && input.url || input))){ var j = JSON.parse(init.body); if (j && ANN[j.type]) p = j; } } catch (e){}
      var r = orig.apply(this, arguments);
      if (p) r.then(function(res){
        if (res.type === "opaque"){ noteContribution(p); return; }
        res.clone().text().then(function(t){ var d = {}; try { d = JSON.parse(t); } catch (e){} if (d.ok !== false) noteContribution(p); }).catch(function(){});
      }).catch(function(){});
      return r;
    };
  })();

  /* ════════════════════════════════════ START ═══════════════════════════════════════════════ */
  function boot(){
    if (window.UJ_CHAT_OFF) return;
    build(); syncHead(); syncLaunch();
    if (ST.open) setOpen(true);
    /* connect as soon as the page has a sign-in, so announcements and the "here" count work while the window is shut */
    var tries = 0, iv = setInterval(function(){ tries++; if (ON || ++tries > 600){ clearInterval(iv); return; } if (cred() || window.UJ_CHAT_TEST) ensure(); }, 2000);
    if (cred() || window.UJ_CHAT_TEST) ensure();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  /* for the identity card's "Ask the chat to vote" and other pages' own buttons */
  function askVote(at, newType, oldType){
    if (!EL.root) build();
    setOpen(true);
    EL.inp.value = "/vote " + at + " “" + (newType || "") + "” “" + (oldType || "") + "”";
    EL.inp.focus();
  }
  return { open: function(){ setOpen(true); }, close: function(){ setOpen(false); }, askVote: askVote, post: post, command: command,
           _st: ST, _flag: flag, _toCC: toCC, _body: body, _configured: function(){ return CONFIGURED; }, _note: noteContribution };
})();
