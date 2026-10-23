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
                                     cell has been shown. May instead be
                                     {at:"#filterRun", text:"matching"} to wait for an element
                                     that is already there to SAY something -- the match count is
                                     written onto the button, not into a new element.
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
              UJ.tour.menu()           the picker: one Tutorial button, listing every part with
                                       what it covers and how far the reader got. Declare it in
                                       the markup as [data-tour-menu] and this file wires it.
              UJ.tour.offerOnce()      a dismissable invitation on a first visit — never an
                                       auto-start, which is a tutorial happening TO somebody

     markup   [data-tour-menu]         a button that opens the picker (one per page)
              [data-tour-start="id"]   a button that starts one named part directly

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
  var AIM = null;           /* the selector the overlay is currently following */
  var LAST = null;          /* its last placed rectangle, as a string, so a still page is free */
  var DOCKED = false;      /* this step's oversized target has been scrolled to the top once */
  var FRAME = 0;            /* the follow() frame request, while a step is showing */

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

  /* ── A WALKTHROUGH THAT CROSSES A PAGE ─────────────────────────────────────────  2026-10-23
     Søren: *"Now we need a guide for collecting cells for VR, opening the VR scene and
     continuing the tutorial there."* Opening the scene is a navigation to another document, so
     the walkthrough cannot simply carry on -- the page it was running in is gone.

     A step may therefore declare `handoff: "<partId>"`, meaning "the reader is about to be sent
     somewhere else, where that part is waiting". Rendering such a step writes the part's id
     beside the progress, under the SAME storage key; the page that declares that part sees the
     note on arrival, offers to carry on, and clears it.

     AN OFFER, NOT AN AUTO-START, like everything else here -- but a DIFFERENT offer. "First time
     here?" would be wrong for somebody who was told two seconds ago that the walkthrough
     continues in the scene, and silence would be a broken promise.

     WHAT THE HEADSET DOES INSTEAD. A standalone Quest has its own browser and therefore its own
     localStorage, so a note written on the PC is not there when the scene opens in the headset.
     Nothing breaks: no note means no continuation offer, and the Tutorial button in the scene
     still has the part. That is the honest degradation, and the reason the note is a nicety
     rather than the mechanism. */
  function markHandoff(partId) {
    var s = readState();
    if (s.handoff === partId) return;
    s.handoff = partId;
    writeState(s);
  }
  function takeHandoff() {
    var s = readState();
    var h = s.handoff;
    if (h === undefined) return null;
    delete s.handoff;
    writeState(s);
    return h || null;
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
    /* .tour-menu and .tour-pick are in this list because leaving them out cost 6px on a 390px
       phone the moment the picker existed: min(420px,100vw - 28px) is a CONTENT width, and the
       card's 16px padding and 1px border went on the outside of it. Measured by tourcheck.js,
       not noticed by eye -- which is the same way the bubble's 400px-on-a-390px-screen was
       found. Anything this file positions by number belongs here. */
    ".tour-bubble,.tour-offer,.tour-dim,.tour-ring,.tour-menu,.tour-pick{box-sizing:border-box}",
    /* ── THE PALETTE, AND THE BUG THAT FORCED THESE CHAINS ───────────────────  2026-10-23
       Søren, on a phone: *"I can't read anything."* A white panel with near-white text.

       core/ is loaded by pages with DIFFERENT TOKEN NAMES AND OPPOSITE POLARITY:
         index.html   light by default, dark under [data-theme="dark"]:  --card --ink --muted --teal
         ujump.html   DARK by default, light under [data-theme="light"]: --panel --ink --mut --accent
         vr.html      dark, one palette, no theme switch:                --card --fg  --mut --accent
       There is no --card on µJump. So `background:var(--card,#fff)` took the #fff fallback while
       `color:var(--ink,…)` took µJump's own --ink, which is #e6edf3 — the background came from the
       fallback and the text from the host, and the two knew nothing about each other.

       The rule now: EVERY PAIR THAT MUST CONTRAST RESOLVES THROUGH THE SAME CHAIN. --card then
       --panel then the literal, so background and colour are always from one palette and the
       bubble follows whichever light/dark the host is in, with no polarity logic here at all.
       The fixture carries all three palettes and tourcheck.js measures the contrast in each.

       THE THIRD PALETTE, FOUND BEFORE IT SHIPPED (2026-10-23). vr.html defines --card as #161b22
       and names its text --fg, NOT --ink. So the bubble would have taken a DARK background from
       the host and the near-black #1b1e22 from its own fallback: the phone bug again, in a page
       nobody had put this overlay on yet. --fg is in the chain now, and the measurement is what
       says so rather than this comment. The case no chain can save is a host that defines a dark
       --card and no text token at all; such a host is better off naming one. */
    ".tour-bubble{position:fixed;z-index:10042;max-width:min(380px,calc(100vw - 24px));",
    "  background:var(--card,var(--panel,#fff));color:var(--ink,var(--fg,#1b1e22));",
    "  border:1px solid var(--line,#e4e1da);",
    "  border-radius:12px;padding:14px 16px;box-shadow:0 10px 34px var(--shadow,rgba(0,0,0,.22));",
    "  font:14px/1.5 system-ui,-apple-system,sans-serif}",
    ".tour-bubble h4{margin:0 0 6px;font-size:15px}",
    ".tour-bubble p{margin:0 0 10px}",
    ".tour-bubble .tour-wait{margin:0 0 10px;font-size:13px;color:var(--accent,#2f6f8f)}",
    ".tour-bubble .tour-gone{margin:0 0 10px;font-size:13px;color:var(--warn,var(--accent,#b45309))}",
    ".tour-bubble .tour-example{margin:-4px 0 10px}",
    ".tour-bubble.tour-dock{max-width:min(760px,calc(100vw - 24px))}",
    /* THE WAY ON, on the last step of a part.                                      2026-10-23
       Søren: "There should be a small link to the next tutorial in the last step." Small is the
       point -- it is an offer, not the end of a funnel -- so it is a text link rather than a
       second filled button competing with Done. The colour chain is --accent, which every host in
       this family defines, falling back to a literal that reads on a light panel. */
    ".tour-bubble .tour-onward{margin:0 0 10px;font-size:13px}",
    ".tour-onward .tour-go-next{background:none;border:0;padding:0;font:inherit;cursor:pointer;",
    "  color:var(--accent,var(--teal,#0e7c5f));text-decoration:underline;text-align:left}",
    ".tour-onward .tour-go-next:hover{opacity:.8}",
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
    "  background:var(--card,var(--panel,#fff));color:var(--ink,var(--fg,#1b1e22));",
    "  border:1px solid var(--line,#e4e1da);",
    "  border-radius:12px;padding:13px 15px;box-shadow:0 8px 26px var(--shadow,rgba(0,0,0,.16));",
    "  font:14px/1.45 system-ui,-apple-system,sans-serif}",
    ".tour-offer p{margin:0 0 10px}",
    /* On a phone it spans the width, so it has to clear the pill vertically instead. */
    "@media(max-width:560px){.tour-offer{left:14px;right:14px;bottom:72px;max-width:none}}",
    /* THE PICKER. One Tutorial button, and this says which walkthrough.               2026-10-23
       Three buttons labelled Tutorial, Tutorial 2, Tutorial 3 made the tab bar carry the
       tutorial's own structure, and "Tutorial 2" tells you nothing about what is in it. One
       button opens this, and the rows can say what each part covers and how far you got.
       Above the dim band (10030-10042) because it is what you use to leave the band. */
    ".tour-menu-back{position:fixed;inset:0;z-index:10048;background:rgba(0,0,0,.45)}",
    ".tour-menu{position:fixed;z-index:10050;left:50%;top:50%;transform:translate(-50%,-50%);",
    "  width:min(420px,calc(100vw - 28px));max-height:calc(100vh - 40px);overflow:auto;",
    "  background:var(--card,var(--panel,#fff));color:var(--ink,var(--fg,#1b1e22));",
    "  border:1px solid var(--line,#e4e1da);border-radius:14px;padding:16px;",
    "  box-shadow:0 14px 44px var(--shadow,rgba(0,0,0,.3));",
    "  font:14px/1.5 system-ui,-apple-system,sans-serif}",
    ".tour-menu h4{margin:0 0 4px;font-size:16px}",
    ".tour-menu .tour-menu-lead{margin:0 0 12px;color:var(--muted,var(--mut,#5f6873));",
    "  font-size:13px}",
    /* A row is a button, not a link with a click handler: it is reachable by tab and by Enter
       without this file having to reimplement either. */
    ".tour-pick{display:block;width:100%;text-align:left;font:inherit;cursor:pointer;",
    "  margin:0 0 8px;padding:10px 12px;border-radius:10px;",
    "  border:1px solid var(--line,#e4e1da);background:transparent;color:inherit}",
    ".tour-pick:hover{border-color:var(--teal,var(--accent,#12a67f))}",
    ".tour-pick b{display:block;font-size:14px}",
    ".tour-pick span{display:block;margin-top:2px;font-size:13px;",
    "  color:var(--muted,var(--mut,#5f6873))}",
    ".tour-pick .tour-pick-state{margin-top:4px;font-size:12px}",
    ".tour-pick .tour-pick-state.done{color:var(--teal,var(--accent,#12a67f))}"
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
      '<p class="tour-example" hidden><button type="button" class="tour-btn go"></button></p>' +
      '<p class="tour-onward" hidden></p>' +
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

  /* ── WHERE TO GO NEXT ──────────────────────────────────────────────────────────  2026-10-23
     Søren: *"There should be a small link to the next tutorial in the last step."*

     Built from CFG.parts, like the picker: the part AFTER this one in the declared order, named,
     one click away. No step says what follows it -- which is deliberate, because every time the
     order changed today some step's prose about "the next one" went stale, and this cannot.

     The final part offers the picker instead, and a page with only one part (vr.html) offers
     nothing, because a picker with one row is a question with one answer. */
  function onward(show) {
    var el = EL.bubble.querySelector(".tour-onward");
    if (!el) return;
    el.hidden = true;
    el.innerHTML = "";
    if (!show || !CFG || !CFG.parts) return;
    var ps = CFG.parts, at = -1, i;
    for (i = 0; i < ps.length; i++) if (ps[i].id === PART.id) at = i;
    var next = (at >= 0 && at + 1 < ps.length) ? ps[at + 1] : null;
    if (!next && ps.length < 2) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tour-go-next";
    btn.textContent = next ? ("Next: " + next.title + " \u2192")
                           : "Pick another walkthrough \u2192";
    btn.addEventListener("click", function () {
      stop();
      if (next) startFromState(next.id); else menu();
    });
    el.appendChild(btn);
    el.hidden = false;
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
    /* SCROLLED OUT OF VIEW IS NOT "AT THE EDGE".                                  2026-10-23
       The clamp below pins the hole to the viewport, which is right while the target is PARTLY
       visible. With the target fully above or below the fold it produced y1 < y0 -- a ring of
       negative height drawn as a bar at the edge, which is a ring "covering only part of it"
       with nothing inside it. Nothing to point at means point at nothing. */
    if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) {
      d[0].hidden = false;
      Object.assign(d[0].style, { left: 0, top: 0, width: W + "px", height: H + "px" });
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

  /* ── THE OVERLAY FOLLOWS ITS TARGET ────────────────────────────────────────────  2026-10-23
     Søren, from his phone: *"The ring circling the things in focus does not work very well on a
     phone, it sometimes missed the target, sometimes only covers parts of it and moves around if
     you accidentally scroll the page."* His screenshot shows the ring at the top of the page with
     the target far below it, which is all three complaints with one cause.

     The dim, the ring and the bubble are position:fixed and were placed ONCE per step, from a
     rectangle read at that moment. Nothing ever read it again. So:

       scrolling        the element moves, the overlay does not -- "moves around if you scroll"
       measured early   on a page this heavy the rAF chain queues behind µJump's own work, so the
                        rect can be read before the scrollIntoView has settled -- "missed it"
       reflow           an image or a fetched card landing changes the layout underneath -- the
                        ring keeps the old size, "covers only part of it"

     A listener on `scroll` would catch the first of those and neither of the others, so this is a
     frame loop instead: read the live rectangle, and when it has actually moved, place everything
     again. It runs only while a step is showing, and does nothing but compare four numbers when
     the page is still -- which is what makes it affordable on a 14.5 MB page.

     IT FOLLOWS WHICHEVER RECTANGLE THE STEP IS POINTING AT: the press-target while a step is
     waiting for the reader, the step's own target otherwise. That is the one the hole is cut
     around, so it is the one that has to stay under it. */
  function aimAt(sel) {
    AIM = sel || null;
    LAST = null;
    DOCKED = false;
  }
  function follow() {
    if (FRAME) return;
    var tick = function () {
      FRAME = PART ? requestAnimationFrame(tick) : 0;
      if (!PART) return;
      var r = AIM ? rectOf(AIM) : null;
      if (!r && !AIM) return;                       /* a step that points at nothing: nothing to do */
      var key = r ? [Math.round(r.left), Math.round(r.top),
                     Math.round(r.width), Math.round(r.height)].join(",") : "gone";
      if (key === LAST) return;
      LAST = key;
      dimAround(r);
      placeBubble(r);
    };
    FRAME = requestAnimationFrame(tick);
  }
  function unfollow() {
    if (FRAME) cancelAnimationFrame(FRAME);
    FRAME = 0;
    AIM = null;
    LAST = null;
  }

  /* THE BUBBLE MUST NOT COVER THE THING IT IS TALKING ABOUT. Below the target if it fits, else
     above, else beside, else bottom-pinned — and on a narrow screen bottom-pinned is the rule,
     with the target scrolled into the upper half so the two never meet. */
  function placeBubble(r) {
    var b = EL.bubble, W = window.innerWidth, H = window.innerHeight, gap = 12;
    b.style.maxHeight = "";
    b.classList.remove("tour-dock");
    var bw = Math.min(380, W - 24);
    b.style.width = bw + "px";
    var bh = b.offsetHeight;
    /* ── THE PHONE BRANCH USED TO IGNORE THE TARGET ENTIRELY ──────────────────────  2026-10-23
       Søren, from his phone: a step reading "Waiting for you to press the collection pill" with
       no pill on screen -- just a sliver of its ring past the bubble's edge. This branch pinned
       the bubble to the bottom whatever the target was doing, and core/vrbasket.js's pill is
       position:fixed at bottom:16px. The bubble landed on it, and scrolling could not help
       because neither of them moves.

       It now does what the desktop branch has always done -- try a slot, and if the target is in
       it, use the other one. Bottom stays the preference, because that is where a thumb is and
       what every other step has trained the reader to look at; the top is the fallback, and when
       a tall bubble cannot miss the target in either slot it takes the lesser overlap. */
    if (!r || W < 560) {
      var cx = Math.round((W - bw) / 2);
      if (!r) {
        Object.assign(b.style, { left: cx + "px", top: Math.round((H - bh) / 2) + "px" });
        return;
      }
      var lo = H - bh - gap, hi = gap;
      var over = function (t) {
        return Math.max(0, Math.min(t + bh, r.bottom) - Math.max(t, r.top));
      };
      var pick = over(lo) === 0 ? lo
               : over(hi) === 0 ? hi
               : (over(lo) <= over(hi) ? lo : hi);
      Object.assign(b.style, { left: cx + "px", top: Math.round(pick) + "px" });
      return;
    }
    var left = Math.min(Math.max(gap, r.left), W - bw - gap), top;
    var clampTop = function (t) { return Math.max(gap, Math.min(H - bh - gap, t)); };
    if (r.bottom + gap + bh <= H) top = r.bottom + gap;
    else if (r.top - gap - bh >= 0) top = r.top - gap - bh;
    /* BESIDE, which the comment above always promised and the code never did. */
    else if (r.right + gap + bw <= W - gap) { left = r.right + gap; top = clampTop(r.top); }
    else if (r.left - gap - bw >= gap) { left = r.left - gap - bw; top = clampTop(r.top); }
    else {
      /* ── A TARGET BIGGER THAN THE ROOM AROUND IT ────────────────────────────  2026-10-23
         Søren, three screenshots of Filter-tab steps: "it is shadowing what we need to see". A
         whole fieldset is often most of the window, so none of below / above / beside fits, and
         the old fallback pinned the bubble to the target's own top-left -- on top of the very
         heading and first options the step was describing.

         Now the bubble turns into a wide, short bar at the bottom of the window (twice as wide, so
         about half as tall), and the target is scrolled once so its TOP sits at the top of the
         window. What gets covered is the far end of the section, which the reader can scroll to
         -- the overlay follows the scroll -- rather than its beginning. If the bottom still
         covers more of it than the top would, it goes to the top instead. */
      b.classList.add("tour-dock");
      bw = Math.min(760, W - 24);
      b.style.width = bw + "px";
      bh = b.offsetHeight;
      if (!DOCKED) {
        DOCKED = true;
        var el = null;
        try { el = AIM ? document.querySelector(AIM) : null; } catch (_e) {}
        if (el && el.scrollIntoView && Math.abs(r.top - gap) > 4) {
          el.scrollIntoView({ block: "start", inline: "nearest" });
          return;                     /* the follow loop places it again from the scrolled rect */
        }
      }
      var lo = H - bh - gap, hi = gap;
      var over = function (t) { return Math.max(0, Math.min(t + bh, r.bottom) - Math.max(t, r.top)); };
      top = over(lo) <= over(hi) ? lo : hi;
      left = Math.round((W - bw) / 2);
    }
    Object.assign(b.style, { left: Math.round(left) + "px", top: Math.round(top) + "px" });
  }

  /* ── WAITING ON TEXT, NOT ONLY ON EXISTENCE ──────────────────────────────────  2026-10-23
     Part two's central step is "press Preview matches", and what that produces is not a new
     element: core/matchcount.js writes the count ONTO THE BUTTON ("1,234 matching cells found"),
     deliberately, because a line of text under a row of buttons is a line people do not read.
     So `needs` may be an object as well as a selector:

        "needs": "#idfgo"                                  exists
        "needs": {"at": "#filterRun", "text": "matching"}  exists AND says that

     One concept, two shapes, and the string form is untouched. `text` is matched case-insensitively
     as a plain substring rather than a regex: a regex in a JSON step list is a thing that throws
     at the reader rather than at a check. */
  function needsSel(n) { return (n && typeof n === "object") ? n.at : n; }
  function needsMet(n) {
    var sel = needsSel(n);
    if (!sel) return true;
    if (!rectOf(sel)) return false;
    if (n && typeof n === "object" && n.text) {
      var e = null;
      try { e = document.querySelector(sel); } catch (_e) { return false; }
      if (!e) return false;
      return (e.textContent || "").toLowerCase().indexOf(String(n.text).toLowerCase()) >= 0;
    }
    return true;
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

  /* ── A STEP MAY POINT INSIDE A CLOSED DRAWER ─────────────────────────────────  2026-10-23
     µJump's filter panel is twelve <details> sections and every one of them is COLLAPSED by
     default, so a step pointing at a control inside one found a zero-size element and reported
     "could not find this control on the page" — truthfully, and uselessly. Opening the drawer is
     what a walkthrough pointing into it should do anyway: it is showing the reader where the
     control lives.

     It is left open afterwards. Closing it again would undo the thing the step just demonstrated,
     and the reader is mid-tutorial, not mid-task. */
  function revealAncestors(sel) {
    var e = null;
    try { e = sel ? document.querySelector(sel) : null; } catch (_e) { return; }
    while (e && e !== document.body) {
      if (e.tagName === "DETAILS" && !e.open) e.open = true;
      e = e.parentElement;
    }
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
    unfollow();
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
    /* AN EXAMPLE, FETCHED FOR YOU.                                                 2026-10-23
       Søren: "If the walkthrough depends on finding a cell with organelles, nobody can use it
       because they won't go through hundreds of cells to find one that has organelles annotated."
       A waiting step may name an `example`; the host page answers it with
       window.UJ_TOUR_EXAMPLE(name), which takes the reader to a cell that has the thing, and the
       ordinary `needs` watch then carries the step on by itself. The engine knows nothing about
       cells -- which cell, and how to get there, is the page's business. */
    var exEl = b.querySelector(".tour-example"), exBtn = exEl.querySelector("button");
    exEl.hidden = true;
    var canExample = !!(s.example && typeof window.UJ_TOUR_EXAMPLE === "function");
    if (canExample) {
      exBtn.disabled = false;
      exBtn.textContent = s.exampleLabel || "Take me to one";
      exBtn.onclick = function () {
        exBtn.disabled = true; exBtn.textContent = "Finding one…";
        Promise.resolve().then(function () { return window.UJ_TOUR_EXAMPLE(s.example); })
          .then(function (r) {
            if (!PART || PART.steps[IX] !== s) return;
            if (r && r.ok === false) {
              goneEl.hidden = false; goneEl.textContent = r.msg || "No example was found.";
              exBtn.disabled = false; exBtn.textContent = s.exampleLabel || "Take me to one";
            } else {
              /* Already arrived (a fast page): the step has re-rendered itself; say nothing. */
              if (needsMet(s.needs)) return;
              exBtn.textContent = "On its way…";
              if (r && r.msg) { waitEl.hidden = false; waitEl.textContent = r.msg; }
            }
          }, function (err) {
            goneEl.hidden = false; goneEl.textContent = "Could not fetch an example (" + (err && err.message || err) + ").";
            exBtn.disabled = false; exBtn.textContent = s.exampleLabel || "Take me to one";
          });
      };
    }
    onward(IX === PART.steps.length - 1);
    clearWatch();

    if (s.tab) hostTab(s.tab);
    /* Written when the step is SHOWN, not when the reader leaves: by the time they have pressed
       the button this step is about, this page is unloading and there is no later moment. */
    if (s.handoff) markHandoff(s.handoff);

    /* `needs`: wait for it, say what to press meanwhile, and go on by itself when it lands.

       THE DIMMING COMES OFF WHILE WAITING. The first version dimmed the page and swallowed clicks
       on the dim, which on a waiting step meant telling somebody to press a button and then
       covering it -- the tour could only be advanced by the engine's own Next, which defeats the
       point. A step may name the control in `press`, and then that one is spotlighted and sits in
       the hole, where it is clickable; with nothing named, the dimming is simply off and the whole
       page stays usable. */
    if (s.needs && !needsMet(s.needs)) {
      waitEl.hidden = false;
      waitEl.textContent = "Waiting for you to " + (s.after || "open this part of the page") + ".";
      if (canExample) exEl.hidden = false;
      var done = function () {
        if (!PART || PART.steps[IX] !== s) return;
        if (!needsMet(s.needs)) return;
        clearWatch();
        render();
      };
      WATCH = new MutationObserver(done);
      /* characterData too: a count written onto a button changes a text node, not the tree. */
      WATCH.observe(document.body, { childList: true, subtree: true, attributes: true,
                                     characterData: true });
      TIMER = setTimeout(function () {
        if (!PART || PART.steps[IX] !== s || needsMet(s.needs)) return;
        waitEl.hidden = true;
        goneEl.hidden = false;
        goneEl.textContent = "Still not here — " + (s.after || "that control is not open")
          + ". You can carry on and come back to it.";
      }, s.wait || 20000);
      revealAncestors(s.press);
      if (s.press && rectOf(s.press)) scrollTo(s.press);
      /* With no `press` there is nothing to point at while waiting, so the dimming comes off
         entirely and the whole page stays usable -- see the comment above. */
      if (!s.press) { aimAt(null); dimOff(); placeBubble(null); }
      else aimAt(s.press);
      follow();
      return;
    }

    revealAncestors(s.at);
    scrollTo(s.at);
    var r0 = rectOf(s.at);
    /* `s.at` ABSENT IS NOT `s.at` MISSING. An opening step deliberately points at nothing and
       dims the whole page; recording that as a target the engine could not find put a null into
       missing() and would have had tourcheck.js reporting a bug that is not one.

       Reported from the FIRST reading rather than from the follow loop: the loop runs every frame
       and would otherwise push the same selector into missing() forever. */
    if (!r0 && s.at) {
      if (MISSING.indexOf(s.at) < 0) {
        MISSING.push(s.at);
        console.warn("[tour] step " + (IX + 1) + " of " + PART.id
          + " points at " + s.at + ", which is not on this page.");
      }
      goneEl.hidden = false;
      goneEl.textContent = "Could not find this control on the page (" + s.at + ").";
    }
    /* No rAF dance here any more: the first frame of follow() does the placing, and every frame
       after it does the correcting -- which is the whole point. A step pointing at nothing dims
       the page and centres the bubble, once. */
    if (!s.at) { aimAt(null); dimAround(null); placeBubble(null); }
    else aimAt(s.at);
    follow();
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
      /* A HOST MAY NAME ITS OWN SWITCHER IN THE STEP LIST.                        2026-10-23
         vr.html does not load core/stepthrough.js and has tabs of its own: its panel is seven
         panes built at runtime, only the current one displayed, and it exposes window.uiOpenTab.
         A step there pointing at a control in a pane that is not open finds a 0x0 element and
         reports its own target as missing -- which is exactly what the first run of this did,
         for seven of fifteen steps.

         Hardcoding uiOpenTab here would be core/ knowing about one page. So the step list says
         which global does it (`"tab": "uiOpenTab"` beside the parts), the same way it says
         everything else, and a page with no tabs simply does not declare one. */
      if (CFG && CFG.tab && typeof window[CFG.tab] === "function") { window[CFG.tab](name); return; }
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

  /* The card both offers use. Same shape, different words: what differs between "first time
     here?" and "you were sent here to carry on" is the sentence and which part it starts, and
     writing it twice is how the two drift apart. */
  function offerCard(lead, say, yes, onYes, onClose) {
    var box = document.createElement("div");
    box.className = "tour-offer";
    box.innerHTML = "<p><b>" + lead + "</b> " + say + "</p>"
      + '<div class="tour-row"><button type="button" class="tour-btn tour-offer-no">No thanks</button>'
      + '<button type="button" class="tour-btn go tour-offer-yes">' + yes + "</button></div>";
    document.body.appendChild(box);
    var close = function () {
      if (onClose) onClose();
      if (box.parentNode) box.parentNode.removeChild(box);
    };
    box.querySelector(".tour-offer-no").addEventListener("click", close);
    box.querySelector(".tour-offer-yes").addEventListener("click", function () {
      close();
      onYes();
    });
    return box;
  }

  /* An invitation, not an auto-start: it says what the tour is and waits to be accepted, and once
     dismissed or finished it does not come back. */
  function offerOnce() {
    if (!CFG || !CFG.parts || !CFG.parts.length) return;
    var first = CFG.parts[0], st = readState()[first.id] || {};
    if (st.done || st.offered) return;
    offerCard("First time here?",
      CFG.offer || "A short walkthrough points out what each control does.",
      "Show me",
      function () { start(first.id); },
      function () { mark(first.id, "offered", true); });
  }

  /* The continuation, for a reader who was sent here by a `handoff` step on another page. Offered
     however many times they arrive this way -- unlike offerOnce, which is a first-visit thing:
     being sent here again IS the reason to ask again. */
  function offerHandoff(p) {
    offerCard("Carrying on &mdash;",
      "the walkthrough you were following continues here, with <b>" + p.title + "</b>.",
      "Carry on",
      function () { startFromState(p.id); });
  }

  /* Resuming, or starting at the top — the one rule, in one place, because both the Tutorial
     button and every row of the picker have to apply it identically. A part you left half way
     through carries on; a part you finished starts again from the beginning. */
  function startFromState(id) {
    var st = readState()[id] || {};
    return start(id, (!st.done && typeof st.at === "number" && st.at > 0) ? "resume" : "top");
  }

  /* ── THE PICKER ───────────────────────────────────────────────────────────  2026-10-23
     ONE Tutorial button, which opens this. The tab bar briefly carried three buttons —
     "Tutorial", "Tutorial 2", "Tutorial 3" — and that put the tutorial's own structure into the
     tool's navigation while telling you nothing about what was in each one. Here there is room
     to say what a part covers and how far you got, and the tab bar goes back to being tabs.

     Built from CFG.parts, so a part added to the step list appears here with no change to any
     page: the declaration stays the single definition. */
  function menu() {
    if (!CFG || !CFG.parts || !CFG.parts.length) return false;
    if (EL.menu) return true;                      /* already open — not a second copy */
    build();                                       /* the stylesheet lives with the rest */
    var back = document.createElement("div");
    back.className = "tour-menu-back";
    var box = document.createElement("div");
    box.className = "tour-menu";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Choose a walkthrough");

    var st = readState();
    var html = "<h4>Walkthroughs</h4><p class=\"tour-menu-lead\">"
      + (CFG.menu || "Each one points at the real controls, in order. Esc leaves at any time.")
      + "</p>";
    CFG.parts.forEach(function (p, i) {
      var s = st[p.id] || {}, n = (p.steps || []).length, state;
      if (s.done) state = '<span class="tour-pick-state done">✓ you have been through this one'
        + " — it starts again from the beginning</span>";
      else if (typeof s.at === "number" && s.at > 0)
        state = '<span class="tour-pick-state">you got to step ' + (s.at + 1) + " of " + n
          + " — this carries on from there</span>";
      else state = '<span class="tour-pick-state">' + n + " steps</span>";
      html += '<button type="button" class="tour-pick" data-pick="' + p.id + '">'
        + "<b>" + (i + 1) + ". " + p.title + "</b>"
        + (p.blurb ? "<span>" + p.blurb + "</span>" : "")
        + state + "</button>";
    });
    html += '<div class="tour-row"><span class="tour-count"></span>'
      + '<button type="button" class="tour-btn tour-menu-close">Close</button></div>';
    box.innerHTML = html;
    document.body.appendChild(back);
    document.body.appendChild(box);
    EL.menu = box;
    EL.menuBack = back;

    var close = function () {
      if (box.parentNode) box.parentNode.removeChild(box);
      if (back.parentNode) back.parentNode.removeChild(back);
      EL.menu = null;
      EL.menuBack = null;
      document.removeEventListener("keydown", onMenuKey);
    };
    /* Esc closes the picker. The tour's own onKey ignores keys while no part is running, so the
       picker cannot borrow it and has its own, removed again on close. */
    var onMenuKey = function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    document.addEventListener("keydown", onMenuKey);
    back.addEventListener("click", close);
    box.querySelector(".tour-menu-close").addEventListener("click", close);
    Array.prototype.forEach.call(box.querySelectorAll(".tour-pick"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-pick");
        close();
        startFromState(id);
      });
    });
    return true;
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
      b.addEventListener("click", function () { startFromState(b.getAttribute("data-tour-start")); });
    });
    /* ...and every button that asks WHICH. One of these replaces a row of numbered Tutorial
       buttons: the parts are listed by the engine, from the step list. */
    Array.prototype.forEach.call(document.querySelectorAll("[data-tour-menu]"), function (b) {
      b.addEventListener("click", function () { menu(); });
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
      /* A note left by a `handoff` step on the page the reader came from takes precedence: they
         were told the walkthrough continues here. Taken rather than read -- it is spent whether
         they accept or decline, because a note that survives being answered would offer the same
         continuation on every later visit. */
      var h = takeHandoff();
      var p = h ? partById(h) : null;
      if (p && p.steps && p.steps.length) { offerHandoff(p); return; }
      offerOnce();
    };
    if (!document.getElementById("tourdata") && document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", go);
    else go();
  }

  UJ.tour = {
    load: load, ready: ready, start: start, stop: stop, offerOnce: offerOnce, menu: menu,
    /* For the check, and for anybody debugging a cross-page handoff: what note is pending, read
       without spending it. takeHandoff() is deliberately not exported -- ready() owns that. */
    handoff: function () { var v = readState().handoff; return v === undefined ? null : v; },
    cfg: function () { return CFG; },
    parts: function () { return (CFG && CFG.parts) || []; },
    missing: function () { return MISSING.slice(); },
    /* For the check, and for anybody debugging a step: where the walkthrough currently is. */
    where: function () { return PART ? { part: PART.id, step: IX, of: PART.steps.length } : null; },
    state: readState
  };
})();
