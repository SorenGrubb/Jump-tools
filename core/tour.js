/* core/tour.js — a walkthrough that points at the real control, and waits.          2026-10-23

   Søren: *"We should make a tutorial for uJump that walks the user through the functions and
   features."* Asked which form, he chose the overlay on the real page over a written page with
   screenshots, and asked for it in three parts.

   WHY AN OVERLAY AND NOT A PAGE OF SCREENSHOTS. A screenshot is a claim about the tool that stops
   being true the moment the tool changes, and nothing fails when it stops being true: the picture
   still renders, it is just wrong. A step here is a CSS selector into the live page, so the same
   question — "is this control still called that?" — becomes a thing a check can ask, and
   tourcheck.js asks it of every step.

   ── WHAT A STEP IS ─────────────────────────────────────────────────────────────────────────
     { at:    "#randomOfType"        the element to point at. Required.
       say:   "…"                    one or two sentences. Required.
       title: "Find a cell"          optional heading
       tab:   "jump"                 optional: switch the host's tab bar there first
       needs: "#nucpanel .celltype"  optional: a selector that must EXIST before the step can be
                                     read. Most of µJump's identity card does not exist until a
                                     cell has been shown.
       after: "press “Random example”"
                                     required WHENEVER `needs` is set: what the reader does to
                                     bring it into being. The engine waits, watching the DOM, and
                                     moves on by itself the moment it appears.
       wait:  12000                  optional, how long to watch before saying so out loud }

   ── WAITING IS THE WHOLE DESIGN ────────────────────────────────────────────────────────────
   The obvious implementation presses the buttons for the reader. That was rejected: half of
   µJump's controls fetch something, and a tour that quietly fires somebody's network requests and
   writes into their history is doing things they did not ask for. So the engine never clicks. It
   says which control to press, dims everything else, and watches with a MutationObserver until the
   thing the next step talks about exists. Pressing it IS the lesson.

   ── A MISSING TARGET MUST NOT BREAK THE TOUR, AND MUST NOT BE SILENT ───────────────────────
   If `at` is not in the document the step still shows, centred, with its text and a line saying
   which control it could not find. Being unable to point at something is not a reason to strand
   somebody halfway through a tutorial — but it IS a bug, so every skipped target is pushed onto
   UJ.tour.missing() for tourcheck.js to read back, and logged once to the console.

   ── NO LIBRARY, NO INLINE HANDLERS, NO STORAGE BEYOND A PLACE IN THE QUEUE ─────────────────
   One file, no dependency. Everything it remembers is which part was finished and how far the
   reader got, under the `grubblab_` prefix storagekeycheck.js holds this family to, and losing it
   costs somebody one re-read rather than any data.

   WHAT A HOST DOES
     load     <script src="core/tour.js"></script>
     declare  a <script type="application/json" id="tourdata"> block holding {key, parts:[…]}
              — JSON, not a JS literal, so the page and tourcheck.js read the SAME BYTES rather
              than two copies of one list.
     call     UJ.tour.ready()          reads that block, wires the buttons and offers the
                                       walkthrough once — and WAITS for DOMContentLoaded if the
                                       block is not in the document yet, so it may be called from
                                       anywhere on the page. Use this one.
              UJ.tour.load()           the same read, without the waiting, for a host that knows
                                       its data block is already parsed
              UJ.tour.start("part1")   from a button
              UJ.tour.offerOnce()      a dismissable invitation on a first visit — never an
                                       auto-start, which is a tutorial happening TO somebody

   Check: tourcheck.js */
var UJ = UJ || {};
(function () {
  "use strict";

  var CFG = null;           /* {key, parts:[{id,title,steps:[…]}]} */
  var PART = null;          /* the part being walked */
  var IX = 0;               /* which step */
  var MISSING = [];         /* every target this run could not find: tourcheck.js reads it */
  var EL = {};              /* the overlay's elements, built once */
  var WATCH = null;         /* the MutationObserver waiting for a `needs` selector */
  var TIMER = null;

  /* ── what it remembers ─────────────────────────────────────────────────────────────────── */
  function key() { return (CFG && CFG.key) || "grubblab_tour_v1"; }
  function readState() {
    try { return JSON.parse(localStorage.getItem(key()) || "{}") || {}; } catch (e) { return {}; }
  }
  function writeState(s) {
    try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) {}
  }
  function mark(partId, field, value) {
    var s = readState();
    s[partId] = s[partId] || {};
    s[partId][field] = value;
    writeState(s);
  }

  /* ── the overlay ───────────────────────────────────────────────────────────────────────── */
  var CSS = [
    /* The dimming is FOUR panels rather than one box-shadow, because a huge spread shadow is what
       makes this kind of overlay crawl on a long page, and µJump is a very long page. Four fixed
       divs that get their rectangles set per step cost nothing to move. */
    /* ── WHERE THESE SIT, AND WHY THESE NUMBERS ──────────────────────────────  2026-10-23
       Everything else this family puts on top of a page, read off core/ rather than guessed:
         core/gamify.js     the sign-in chip 9000, the dashboard 9500
         core/vrbasket.js   the "+ VR" pill 9998, its tray 9999
         core/report.js     toasts 99999
       The first draft used 9998/9999/10000, which put the dim level with the VR pill and the
       ring level with its tray: equal z-index, so DOM order decided it, which is not a thing
       to rely on. These clear every one of them. The toast deliberately stays above: a message
       about what just happened should not be hidden by a tutorial. */
    ".tour-dim{position:fixed;background:rgba(10,14,18,.55);z-index:10040;pointer-events:auto}",
    ".tour-ring{position:fixed;z-index:10041;border:2px solid var(--teal,var(--accent,#12a67f));",
    "  border-radius:8px;",
    "  box-shadow:0 0 0 3px rgba(18,166,127,.25);pointer-events:none;transition:all .18s ease-out}",
    /* box-sizing ON THE ENGINE'S OWN ELEMENTS. The width set in placeBubble() is a content
       width unless this says otherwise, and 366px of content plus 16px of padding each side plus
       a border is 400px on a 390px phone -- off the screen, which is how the fixture found it.
       The host's own reset cannot be relied on: core/ is loaded by eight pages and a fixture. */
    ".tour-bubble,.tour-offer,.tour-dim,.tour-ring{box-sizing:border-box}",
    /* ── THE PALETTE, AND THE BUG THAT FORCED THESE CHAINS ───────────────────  2026-10-23
       Søren, on a phone: *"I can't read anything."* A white panel with near-white text.

       core/ is loaded by pages with DIFFERENT TOKEN NAMES AND OPPOSITE POLARITY:
         index.html   light by default, dark under [data-theme="dark"]:  --card --ink --muted --teal
         ujump.html   DARK by default, light under [data-theme="light"]: --panel --ink --mut --accent
       There is no --card on µJump. So `background:var(--card,#fff)` took the #fff fallback while
       `color:var(--ink,…)` took µJump's own --ink, which is #e6edf3 — the background came from the
       fallback and the text from the host, and the two knew nothing about each other.

       The rule now: EVERY PAIR THAT MUST CONTRAST RESOLVES THROUGH THE SAME CHAIN. --card then
       --panel then the literal, so background and colour are always from one palette and the
       bubble follows whichever light/dark the host is in, with no polarity logic here at all.
       The fixture carries both palettes and tourcheck.js measures the contrast in each. */
    ".tour-bubble{position:fixed;z-index:10042;max-width:min(380px,calc(100vw - 24px));",
    "  background:var(--card,var(--panel,#fff));color:var(--ink,#1b1e22);",
    "  border:1px solid var(--line,#e4e1da);",
    "  border-radius:12px;padding:14px 16px;box-shadow:0 10px 34px var(--shadow,rgba(0,0,0,.22));",
    "  font:14px/1.5 system-ui,-apple-system,sans-serif}",
    ".tour-bubble h4{margin:0 0 6px;font-size:15px}",
    ".tour-bubble p{margin:0 0 10px}",
    ".tour-bubble .tour-wait{margin:0 0 10px;font-size:13px;color:var(--accent,#2f6f8f)}",
    ".tour-bubble .tour-gone{margin:0 0 10px;font-size:13px;color:var(--warn,#b45309)}",
    ".tour-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".tour-row .tour-count{color:var(--muted,var(--mut,#5f6873));font-size:13px;margin-right:auto}",
    ".tour-btn{font:inherit;font-size:13px;cursor:pointer;border-radius:8px;padding:6px 12px;",
    "  border:1px solid var(--line,#e4e1da);background:transparent;color:inherit}",
    ".tour-btn:hover{border-color:var(--teal,var(--accent,#12a67f));",
    "  color:var(--teal,var(--accent,#12a67f))}",
    /* THE FILLED BUTTON CARRIES ITS OWN COLOURS, and that is deliberate after measuring.
       Taking the fill from the host's accent gave white-on-#12a67f at 3.09:1 on index.html's
       palette — below the 4.5:1 floor, and it had been that way in every screenshot. Taking the
       label from --on-accent only helped where the host happens to define it (µJump does,
       index.html does not), and --accent-dim is dark on µJump's dark theme but a PALE mint on its
       light one, so there is no host token that is reliably safe behind white text.

       So the one control that must always be legible stops asking. #0e7c5f with #fff is 5.10:1,
       and it reads the same in both tools, which for a tutorial's own button is right. The outline
       buttons still tint from the host, because their text sits on the panel and measured fine. */
    ".tour-btn.go{background:#0e7c5f;border-color:#0e7c5f;color:#fff}",
    ".tour-btn.go:hover{opacity:.9}",
    /* The invitation: a quiet card, never a modal. */
    /* LEFT, not right: core/vrbasket.js pins its "+ VR" pill to right:16px bottom:16px, and the
       invitation was landing on top of it. */
    ".tour-offer{position:fixed;left:14px;bottom:14px;z-index:10030;max-width:320px;",
    "  background:var(--card,var(--panel,#fff));color:var(--ink,#1b1e22);",
    "  border:1px solid var(--line,#e4e1da);",
    "  border-radius:12px;padding:13px 15px;box-shadow:0 8px 26px var(--shadow,rgba(0,0,0,.16));",
    "  font:14px/1.45 system-ui,-apple-system,sans-serif}",
    ".tour-offer p{margin:0 0 10px}",
    /* On a phone it spans the width, so it has to clear the pill vertically instead. */
    "@media(max-width:560px){.tour-offer{left:14px;right:14px;bottom:72px;max-width:none}}"
  ].join("\n");

  function build() {
    if (EL.bubble) return;
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    EL.dim = [0, 1, 2, 3].map(function () {
      var d = document.createElement("div");
      d.className = "tour-dim";
      d.hidden = true;
      /* A click on the dimmed area is swallowed rather than acted on: the reader is being told
         which control to press, and letting them press a dimmed one behind the overlay is how a
         walkthrough and the page get out of step. */
      d.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); });
      document.body.appendChild(d);
      return d;
    });
    EL.ring = document.createElement("div");
    EL.ring.className = "tour-ring";
    EL.ring.hidden = true;
    document.body.appendChild(EL.ring);

    EL.bubble = document.createElement("div");
    EL.bubble.className = "tour-bubble";
    EL.bubble.setAttribute("role", "dialog");
    EL.bubble.setAttribute("aria-live", "polite");
    EL.bubble.hidden = true;
    EL.bubble.innerHTML =
      '<h4 class="tour-title"></h4><p class="tour-say"></p>' +
      '<p class="tour-wait" hidden></p><p class="tour-gone" hidden></p>' +
      '<div class="tour-row"><span class="tour-count"></span>' +
      '<button type="button" class="tour-btn tour-quit">Close</button>' +
      '<button type="button" class="tour-btn tour-back">Back</button>' +
      '<button type="button" class="tour-btn go tour-next">Next</button></div>';
    document.body.appendChild(EL.bubble);
    EL.bubble.querySelector(".tour-next").addEventListener("click", function () { move(1); });
    EL.bubble.querySelector(".tour-back").addEventListener("click", function () { move(-1); });
    EL.bubble.querySelector(".tour-quit").addEventListener("click", function () { stop(); });
    document.addEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (!PART) return;
    if (e.key === "Escape") { stop(); }
    else if (e.key === "ArrowRight") { move(1); }
    else if (e.key === "ArrowLeft") { move(-1); }
    else return;
    e.preventDefault();
  }

  /* Four rectangles around the hole. With no target the whole viewport is dimmed and the bubble
     sits in the middle, which is what an introductory step wants anyway. */
  /* Every panel away and the ring hidden: the page is left completely alone, which is what a
     waiting step needs. Distinct from dimAround(null), which dims EVERYTHING. */
  function dimOff() {
    if (EL.dim) EL.dim.forEach(function (d) { d.hidden = true; });
    if (EL.ring) EL.ring.hidden = true;
  }

  function dimAround(r) {
    var W = window.innerWidth, H = window.innerHeight, d = EL.dim, pad = 6;
    if (!r) {
      d[0].hidden = false; Object.assign(d[0].style, { left: 0, top: 0, width: W + "px", height: H + "px" });
      d[1].hidden = d[2].hidden = d[3].hidden = true;
      EL.ring.hidden = true;
      return;
    }
    var x0 = Math.max(0, r.left - pad), y0 = Math.max(0, r.top - pad);
    var x1 = Math.min(W, r.right + pad), y1 = Math.min(H, r.bottom + pad);
    var set = function (el, l, t, w, h) {
      el.hidden = false;
      Object.assign(el.style, { left: l + "px", top: t + "px",
                                width: Math.max(0, w) + "px", height: Math.max(0, h) + "px" });
    };
    set(d[0], 0, 0, W, y0);                 /* above  */
    set(d[1], 0, y1, W, H - y1);            /* below  */
    set(d[2], 0, y0, x0, y1 - y0);          /* left   */
    set(d[3], x1, y0, W - x1, y1 - y0);     /* right  */
    EL.ring.hidden = false;
    Object.assign(EL.ring.style, { left: x0 + "px", top: y0 + "px",
                                   width: (x1 - x0) + "px", height: (y1 - y0) + "px" });
  }

  /* THE BUBBLE MUST NOT COVER THE THING IT IS TALKING ABOUT. Below the target if it fits, else
     above, else beside, else bottom-pinned — and on a narrow screen bottom-pinned is the rule,
     with the target scrolled into the upper half so the two never meet. */
  function placeBubble(r) {
    var b = EL.bubble, W = window.innerWidth, H = window.innerHeight, gap = 12;
    b.style.maxHeight = "";
    var bw = Math.min(380, W - 24);
    b.style.width = bw + "px";
    var bh = b.offsetHeight;
    if (!r || W < 560) {
      Object.assign(b.style, { left: Math.round((W - bw) / 2) + "px",
                               top: (r ? (H - bh - gap) : Math.round((H - bh) / 2)) + "px" });
      return;
    }
    var left = Math.min(Math.max(gap, r.left), W - bw - gap), top;
    if (r.bottom + gap + bh <= H) top = r.bottom + gap;
    else if (r.top - gap - bh >= 0) top = r.top - gap - bh;
    else top = Math.max(gap, Math.min(H - bh - gap, r.top));
    Object.assign(b.style, { left: Math.round(left) + "px", top: Math.round(top) + "px" });
  }

  function rectOf(sel) {
    if (!sel) return null;
    var e;
    try { e = document.querySelector(sel); } catch (_e) { return null; }
    if (!e) return null;
    var r = e.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return null;    /* present but not drawn is not pointable */
    return r;
  }

  function scrollTo(sel) {
    var e = null;
    try { e = sel ? document.querySelector(sel) : null; } catch (_e) {}
    if (!e || !e.scrollIntoView) return;
    /* "center" on a desktop; on a phone the bubble owns the bottom, so the target goes up top. */
    e.scrollIntoView({ block: window.innerWidth < 560 ? "start" : "center", inline: "nearest" });
  }

  /* ── running ───────────────────────────────────────────────────────────────────────────── */
  function clearWatch() {
    if (WATCH) { WATCH.disconnect(); WATCH = null; }
    if (TIMER) { clearTimeout(TIMER); TIMER = null; }
  }

  function render() {
    var s = PART.steps[IX], b = EL.bubble;
    b.hidden = false;
    b.querySelector(".tour-title").textContent = s.title || PART.title || "";
    b.querySelector(".tour-title").hidden = !(s.title || PART.title);
    b.querySelector(".tour-say").innerHTML = s.say || "";
    b.querySelector(".tour-count").textContent = (IX + 1) + " of " + PART.steps.length;
    b.querySelector(".tour-back").disabled = IX === 0;
    b.querySelector(".tour-next").textContent =
      IX === PART.steps.length - 1 ? "Done" : "Next";

    var waitEl = b.querySelector(".tour-wait"), goneEl = b.querySelector(".tour-gone");
    waitEl.hidden = true; goneEl.hidden = true;
    clearWatch();

    if (s.tab) hostTab(s.tab);

    /* `needs`: wait for it, say what to press meanwhile, and go on by itself when it lands.

       THE DIMMING COMES OFF WHILE WAITING. The first version dimmed the page and swallowed clicks
       on the dim, which on a waiting step meant telling somebody to press a button and then
       covering it -- the tour could only be advanced by the engine's own Next, which defeats the
       point. A step may name the control in `press`, and then that one is spotlighted and sits in
       the hole, where it is clickable; with nothing named, the dimming is simply off and the whole
       page stays usable. */
    if (s.needs && !rectOf(s.needs)) {
      waitEl.hidden = false;
      waitEl.textContent = "Waiting for you to " + (s.after || "open this part of the page") + ".";
      var done = function () {
        if (!PART || PART.steps[IX] !== s) return;
        if (!rectOf(s.needs)) return;
        clearWatch();
        render();
      };
      WATCH = new MutationObserver(done);
      WATCH.observe(document.body, { childList: true, subtree: true, attributes: true });
      TIMER = setTimeout(function () {
        if (!PART || PART.steps[IX] !== s || rectOf(s.needs)) return;
        waitEl.hidden = true;
        goneEl.hidden = false;
        goneEl.textContent = "Still not here — " + (s.after || "that control is not open")
          + ". You can carry on and come back to it.";
      }, s.wait || 20000);
      var pressAt = s.press ? rectOf(s.press) : null;
      if (pressAt) { scrollTo(s.press); }
      requestAnimationFrame(function () {
        if (!PART || PART.steps[IX] !== s) return;
        var pr = s.press ? rectOf(s.press) : null;
        if (pr) dimAround(pr); else dimOff();
        requestAnimationFrame(function () { placeBubble(pr); });
      });
      return;
    }

    scrollTo(s.at);
    /* After a scroll the rectangle is only right on the next frame. */
    requestAnimationFrame(function () {
      if (!PART || PART.steps[IX] !== s) return;
      var r = rectOf(s.at);
      /* `s.at` ABSENT IS NOT `s.at` MISSING. An opening step deliberately points at nothing and
         dims the whole page; recording that as a target the engine could not find put a null into
         missing() and would have had tourcheck.js reporting a bug that is not one. */
      if (!r && s.at) {
        if (MISSING.indexOf(s.at) < 0) {
          MISSING.push(s.at);
          console.warn("[tour] step " + (IX + 1) + " of " + PART.id
            + " points at " + s.at + ", which is not on this page.");
        }
        goneEl.hidden = false;
        goneEl.textContent = "Could not find this control on the page (" + s.at + ").";
      }
      dimAround(r);
      requestAnimationFrame(function () { placeBubble(r); });
    });
  }

  function move(d) {
    if (!PART) return;
    var n = IX + d;
    if (n < 0) return;
    if (n >= PART.steps.length) { finish(); return; }
    IX = n;
    mark(PART.id, "at", IX);
    render();
  }

  function finish() {
    mark(PART.id, "done", true);
    stop();
  }

  function stop() {
    clearWatch();
    if (EL.bubble) EL.bubble.hidden = true;
    if (EL.ring) EL.ring.hidden = true;
    if (EL.dim) EL.dim.forEach(function (d) { d.hidden = true; });
    PART = null;
    document.documentElement.classList.remove("tour-on");
  }

  /* The host's tab bar, if it has one. core/stepthrough.js exposes activateTab on every tool that
     has tabs; a host without it simply does not get tab switching, rather than an exception. */
  function hostTab(name) {
    try {
      if (UJ.stepthrough && typeof UJ.stepthrough.activateTab === "function")
        UJ.stepthrough.activateTab(name);
    } catch (_e) {}
  }

  function partById(id) {
    var ps = (CFG && CFG.parts) || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  function start(id, from) {
    if (!CFG) return false;
    var p = partById(id);
    if (!p || !p.steps || !p.steps.length) return false;
    build();
    PART = p;
    var st = readState()[id] || {};
    IX = (from === "resume" && typeof st.at === "number"
          && st.at < p.steps.length) ? st.at : 0;
    MISSING = [];
    document.documentElement.classList.add("tour-on");
    render();
    return true;
  }

  /* An invitation, not an auto-start: it says what the tour is and waits to be accepted, and once
     dismissed or finished it does not come back. */
  function offerOnce() {
    if (!CFG || !CFG.parts || !CFG.parts.length) return;
    var first = CFG.parts[0], st = readState()[first.id] || {};
    if (st.done || st.offered) return;
    var box = document.createElement("div");
    box.className = "tour-offer";
    box.innerHTML = '<p><b>First time here?</b> ' + (CFG.offer
      || "A short walkthrough points out what each control does.") + "</p>"
      + '<div class="tour-row"><button type="button" class="tour-btn tour-offer-no">No thanks</button>'
      + '<button type="button" class="tour-btn go tour-offer-yes">Show me</button></div>';
    document.body.appendChild(box);
    var close = function () {
      mark(first.id, "offered", true);
      if (box.parentNode) box.parentNode.removeChild(box);
    };
    box.querySelector(".tour-offer-no").addEventListener("click", close);
    box.querySelector(".tour-offer-yes").addEventListener("click", function () {
      close();
      start(first.id);
    });
  }

  /* ── reading the host's declaration ────────────────────────────────────────────────────── */
  function load(el) {
    var node = el || document.getElementById("tourdata");
    if (!node) return null;
    try { CFG = JSON.parse(node.textContent); } catch (e) {
      console.warn("[tour] #tourdata is not valid JSON", e);
      CFG = null;
      return null;
    }
    /* Every button that says which part it starts. Declared in the markup, wired here. */
    Array.prototype.forEach.call(document.querySelectorAll("[data-tour-start]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-tour-start");
        var st = readState()[id] || {};
        start(id, (!st.done && typeof st.at === "number" && st.at > 0) ? "resume" : "top");
      });
    });
    return CFG;
  }

  /* ── READY: load AND offer, once the document actually has the data block ────  2026-10-23
     THE BUG THIS EXISTS FOR, found by running the deployed page in his own browser. µJump's
     init script sits at character 52,781 and its #tourdata block at 77,936 -- the script runs
     BEFORE the data exists. So load() found nothing, returned null, and
     `UJ.tour.load() && UJ.tour.offerOnce()` short-circuited: the Tutorial button was never wired
     and the walkthrough was simply dead on the live site.

     Neither half of the check could see it. The static half does not execute the page, and the
     fixture happens to declare its JSON above its script, which is the lucky order.

     Fixing it in the host would fix one page. Fixing it here fixes every host: this waits for
     DOMContentLoaded when the block is not there yet, so a page may call it from anywhere. */
  function ready() {
    var go = function () {
      if (!load()) {
        console.warn("[tour] no #tourdata block in this document \u2014 nothing to walk through.");
        return;
      }
      offerOnce();
    };
    if (!document.getElementById("tourdata") && document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", go);
    else go();
  }

  UJ.tour = {
    load: load, ready: ready, start: start, stop: stop, offerOnce: offerOnce,
    cfg: function () { return CFG; },
    parts: function () { return (CFG && CFG.parts) || []; },
    missing: function () { return MISSING.slice(); },
    /* For the check, and for anybody debugging a step: where the walkthrough currently is. */
    where: function () { return PART ? { part: PART.id, step: IX, of: PART.steps.length } : null; },
    state: readState
  };
})();
