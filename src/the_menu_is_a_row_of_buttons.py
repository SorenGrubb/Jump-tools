# -*- coding: utf-8 -*-
u"""The front page's menu becomes visible, follows you down, and folds into a burger. 2026-10-17

Søren: *"I think the menu buttons should be more clear, I didn't see them. Also, it should be a
budget menu on the mobile devices."*

He is describing two different failures of the same control.

WHY IT WAS INVISIBLE. The seven links were 14 px, `--muted`, with no background and no border,
set immediately under the lede with a 6 px gap. On the hero's own background that is a third
paragraph of body text, not a menu — and it sat between the lede and the build line, which is the
one place on the page nobody looks. They are now pills: card background, a border, the page's ink
rather than its muted grey, and enough padding to be a comfortable tap target. Separated from the
lede by real space, so they read as controls rather than as the end of a sentence.

AND IT FOLLOWED THE HERO OFF THE SCREEN. The old comment beside the nav said anchored sections
"land under nothing -- the nav does not float", which was true and was the problem: this page is
very long (the dataset table alone is 62 rows), so for all but the first screen there was no menu
at all. A slim bar now slides in once the hero has gone — not before, so the first frame is
unchanged — carrying the same menu and the theme toggle. `scroll-margin-top` grows from 18 px to
74 px to clear it, which also gives an anchored heading more breathing room on the first screen.

ONE DEFINITION, THREE RENDERINGS. The bar and the phone panel do not repeat the markup: the
script CLONES `ul.sitenav` out of the header into each of them, so a link added to the header is
in all three. That is why nothing inside the menu carries an id — a cloned id is two elements
answering to one name, and the theme button is the standing example in this file of why that
hurts. The bar's and the panel's theme buttons therefore proxy a click to the real one and mirror
its label rather than being copies of it.

THE EIGHT TOOLS ARE IN THE MENU. Søren chose this: "The tools" is now a `<details>` holding a link
to each tool's own page, so reaching δJump from the bottom of the dataset table is one tap rather
than a scroll to the top and a hunt through eight cards. `<details>`/`<summary>` rather than a
hand-built dropdown because the open/close behaviour, the keyboard handling and the ARIA come with
it; the only script is closing it when you click elsewhere.

NO STORAGE. The panel's open state lives in the DOM and dies with the page. storagekeycheck.js
holds this page to the `grubblab_` prefix for anything it does persist, and a menu that remembered
whether it was open would be a key that earns nothing.

Check: frontnavcheck.js (new)
Run: python3 src/the_menu_is_a_row_of_buttons.py, then python3 src/build_stamps.py,
     then node frontnavcheck.js
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(HERE, "index.html")


def edit(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    before = s
    print(os.path.basename(path))
    for name, old, new in pairs:
        # A REMOVAL CANNOT BE GUARDED BY ITS REPLACEMENT. "is the new text already there" is the
        # right idempotence test for every pair that puts something in, and always true for one
        # that takes something out, since the empty string is in every file. A removal is guarded
        # on the thing it removes being gone instead.
        if (new and new in s) or (not new and old not in s):
            print("  already there: " + name)
            continue
        n = s.count(old)
        assert n == 1, "%s: %d" % (name, n)
        s = s.replace(old, new, 1)
        print("  ok: " + name)
    if s != before:
        io.open(path, "w", encoding="utf-8").write(s)


OLD_CSS = u""" .sitenav{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 6px;padding:0;list-style:none}
 .sitenav a{color:var(--muted);text-decoration:none;font-size:14px;padding:3px 0;
   border-bottom:1px solid transparent}
 .sitenav a:hover,.sitenav a:focus{color:var(--ink);border-bottom-color:var(--teal)}
 /* Anchored sections land under nothing -- the nav does not float -- but a little breathing
    room above a jumped-to heading reads far better than the heading hard against the viewport. */
 [id]{scroll-margin-top:18px}"""

NEW_CSS = u""" /* ── THE MENU ─────────────────────────────────────────────────────────────────  2026-10-17
    Søren: "the menu buttons should be more clear, I didn't see them." They were 14 px muted text
    with no border, six pixels under the lede: a third paragraph, not a menu. Pills, with the
    page's ink and a card background, set off from the lede by real space.

    One definition, three renderings: this list is the only copy in the markup, and the script at
    the foot of the page clones it into the sticky bar and the phone panel. Nothing in it carries
    an id, because a clone would then answer to the same name as the original. */
 .sitenav{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 10px;padding:0;list-style:none}
 .sitenav a,.sitenav summary{display:inline-flex;align-items:center;gap:6px;color:var(--ink);
   text-decoration:none;font-size:14px;line-height:1.2;background:var(--card);
   border:1px solid var(--line);border-radius:20px;padding:8px 14px;cursor:pointer}
 .sitenav a:hover,.sitenav a:focus-visible,.sitenav summary:hover{border-color:var(--teal);
   color:var(--teal);text-decoration:none}
 .sitenav a:focus-visible,.sitenav summary:focus-visible{outline:2px solid var(--teal);
   outline-offset:2px}
 /* The tools group. <details> rather than a hand-built dropdown: the open/close, the keyboard and
    the ARIA come with the element, and the only script is closing it on an outside click. */
 .navtools{position:relative}
 .navtools summary{list-style:none}
 .navtools summary::-webkit-details-marker{display:none}
 .navtools summary::after{content:"\\25be";font-size:11px;opacity:.7}
 .navtools[open] summary{border-color:var(--teal);color:var(--teal)}
 .navtools .toolmenu{position:absolute;z-index:40;top:calc(100% + 6px);left:0;min-width:210px;
   margin:0;padding:6px;list-style:none;background:var(--card);border:1px solid var(--line);
   border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.14)}
 .navtools .toolmenu a{display:flex;width:100%;border:0;background:transparent;border-radius:8px;
   padding:7px 10px;font-size:14px}
 .navtools .toolmenu a:hover{background:var(--teal-soft);color:var(--teal)}
 .navtools .toolmenu .tname{font-weight:600;min-width:4.4em}
 .navtools .toolmenu .tds{color:var(--muted);font-size:13px}
 .navtools .toolmenu a:hover .tds{color:inherit}

 /* ── THE BAR THAT ARRIVES AFTER THE HERO ─────────────────────────────────────────────────
    Hidden until the header has scrolled completely out of view, so the first frame of the page
    is exactly what it was. Fixed, never sticky: the header is not its parent. */
 .navbar{position:fixed;top:0;left:0;right:0;z-index:50;background:var(--hero);
   border-bottom:1px solid var(--line);transform:translateY(-100%);transition:transform .18s ease;
   padding-top:env(safe-area-inset-top,0px)}
 .navbar.on{transform:none}
 .navbar .wrap{display:flex;align-items:center;gap:14px;min-height:52px;padding-top:7px;
   padding-bottom:7px}
 .navbar .barbrand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;
   color:var(--ink);text-decoration:none;flex:0 0 auto}
 .navbar .barbrand svg{width:19px;height:19px}
 .navbar .barbrand:hover{text-decoration:none;color:var(--teal)}
 .navbar .sitenav{margin:0;flex:1 1 auto;justify-content:flex-end;flex-wrap:nowrap;
   overflow:visible}
 .navbar .sitenav a,.navbar .sitenav summary{font-size:13px;padding:6px 11px}
 .navtheme{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:12px;
   color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:20px;
   padding:6px 12px;cursor:pointer;flex:0 0 auto}
 .navtheme:hover{border-color:var(--teal)}
 .burger{display:none;margin-left:auto;align-items:center;gap:8px;font:inherit;font-size:14px;
   color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:20px;
   padding:8px 14px;cursor:pointer;flex:0 0 auto}
 .burger:hover{border-color:var(--teal)}
 .burger i{display:block;width:16px;height:11px;position:relative;flex:0 0 auto}
 .burger i::before,.burger i::after,.burger i span{content:"";position:absolute;left:0;right:0;
   height:1.8px;background:currentColor;border-radius:2px}
 .burger i::before{top:0}
 .burger i span{top:4.6px}
 .burger i::after{bottom:0}
 .navpanel{position:fixed;z-index:49;left:0;right:0;top:0;background:var(--card);
   border-bottom:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.18);
   max-height:min(78vh,560px);overflow:auto;padding:calc(60px + env(safe-area-inset-top,0px)) 0 14px}
 .navpanel[hidden]{display:none}
 .navpanel .sitenav{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:4px;margin:0}
 .navpanel .sitenav a,.navpanel .sitenav summary{border:0;border-radius:10px;padding:12px 12px;
   font-size:16px;background:transparent;justify-content:flex-start}
 .navpanel .sitenav>li>a,.navpanel .sitenav .navtools>summary{border-bottom:1px solid var(--line);
   border-radius:0}
 .navpanel .navtools{position:static}
 .navpanel .navtools .toolmenu{position:static;box-shadow:none;border:0;background:transparent;
   padding:2px 0 8px 10px;min-width:0}
 .navpanel .navtools .toolmenu a{font-size:15px;padding:10px 10px;border-bottom:0}
 .navpanel .paneltheme{margin:12px 0 0;display:flex}
 /* THE BAR CARRIES FIVE OF THE SEVEN. All seven fit the header, where they wrap; in one 52 px
    row beside the brand and the theme button they do not, and a menu that overflows its own bar
    is worse than one that is two items shorter. Privacy and Data & attribution are the two
    nobody arrives looking for, and both are still in the header and in the phone panel. */
 .navbar .navminor{display:none}
 @media (max-width:760px){
   .navbar .sitenav{display:none}
   .navbar .navtheme{display:none}
   .burger{display:inline-flex}
 }
 /* ANCHORS CLEAR THE BAR. 18 px was right when nothing floated; the bar is 52 px plus its own
    border, and a heading that lands underneath it reads as a page that jumped to the wrong
    place. On the first screen, where the bar is not shown yet, this is simply more air. */
 [id]{scroll-margin-top:74px}"""

OLD_NAV = u"""    <nav aria-label="Sections of this page">
      <ul class="sitenav">
        <li><a href="#tools">The tools</a></li>
        <li><a href="#leaderboard">Leaderboard</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#publications">Publications</a></li>
        <li><a href="#data">Data &amp; attribution</a></li>
        <li><a href="#privacy">Privacy</a></li>
        <li><a href="#datasets">Every dataset</a></li>
      </ul>
    </nav>"""

TOOLS = [
    (u"µJump", u"ujump.html", u"MICrONS minnie65"),
    (u"δJump", u"djump.html", u"V1DD"),
    (u"πJump", u"pjump.html", u"MICrONS pinky100"),
    (u"λJump", u"ljump.html", u"Lee16"),
    (u"ηJump", u"hjump.html", u"H01 human cortex"),
    (u"βJump", u"bjump.html", u"Alzheimer’s vCLEM"),
    (u"χJump", u"xjump.html", u"cb2 cerebellum"),
    (u"ωJump", u"wjump.html", u"62 volumes"),
]

TOOL_LINKS = u"\n".join(
    u'          <li><a href="/%s"><span class="tname">%s</span>'
    u'<span class="tds">%s</span></a></li>' % (f, n, d) for n, f, d in TOOLS)

NEW_NAV = u"""    <nav aria-label="Sections of this page">
      <ul class="sitenav">
        <li><details class="navtools"><summary>The tools</summary>
          <ul class="toolmenu">
            <li><a href="#tools"><span class="tname">All eight</span><span class="tds">on this page</span></a></li>
@TOOLS@
          </ul></details></li>
        <li><a href="#leaderboard">Leaderboard</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#publications">Publications</a></li>
        <li class="navminor"><a href="#data">Data &amp; attribution</a></li>
        <li class="navminor"><a href="#privacy">Privacy</a></li>
        <li><a href="#datasets">Every dataset</a></li>
      </ul>
    </nav>""".replace(u"@TOOLS@", TOOL_LINKS)

BAR = u"""</header>

<!-- The bar and the phone panel. Both are filled by cloning ul.sitenav out of the header, so the
     menu has exactly one definition in this file. See src/the_menu_is_a_row_of_buttons.py. -->
<div class="navbar" id="navBar">
  <div class="wrap">
    <a class="barbrand" href="#top" aria-label="Back to the top of the page">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--teal)" stroke-width="9"/>
        <circle cx="50" cy="50" r="13" fill="var(--teal)"/>
      </svg>Grubb Lab</a>
    <nav aria-label="Sections of this page" id="navBarSlot"></nav>
    <button type="button" class="navtheme" data-theme-proxy
            aria-label="Switch between dark and light mode">☀︎ <span>Light</span></button>
    <button type="button" class="burger" id="navBurger" aria-expanded="false"
            aria-controls="navPanel"><i><span></span></i>Menu</button>
  </div>
</div>
<div class="navpanel" id="navPanel" hidden>
  <div class="wrap">
    <nav aria-label="Site menu" id="navPanelSlot"></nav>
    <div class="paneltheme">
      <button type="button" class="navtheme" data-theme-proxy
              aria-label="Switch between dark and light mode">☀︎ <span>Light</span></button>
    </div>
  </div>
</div>"""

SCRIPT = u"""<script>
/* ── THE MENU: one definition, three renderings ───────────────────────────────  2026-10-17
   The header's ul.sitenav is the only copy in the markup. It is cloned into the fixed bar and
   into the phone panel, so a link added to the header reaches all three. Nothing inside it has
   an id for exactly this reason.

   The bar is shown only once the header has left the viewport, which is why there is an observer
   rather than position:sticky — the first frame of the page has to be what it always was. */
(function(){
  var src = document.querySelector("header .sitenav");
  var bar = document.getElementById("navBar"), panel = document.getElementById("navPanel"),
      burger = document.getElementById("navBurger"), head = document.querySelector("header");
  if (!src || !bar || !panel || !burger || !head) return;
  var barSlot = document.getElementById("navBarSlot"),
      panelSlot = document.getElementById("navPanelSlot");
  barSlot.appendChild(src.cloneNode(true));
  panelSlot.appendChild(src.cloneNode(true));

  function closePanel(){
    panel.hidden = true;
    burger.setAttribute("aria-expanded", "false");
  }
  function closeTools(except){
    document.querySelectorAll("details.navtools[open]").forEach(function(d){
      if (d !== except) d.open = false;
    });
  }
  burger.addEventListener("click", function(){
    var open = panel.hidden;
    panel.hidden = !open;
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) closeTools(null);
  });
  /* A link inside the panel has done its job the moment it is followed. */
  panel.addEventListener("click", function(e){ if (e.target.closest("a")) closePanel(); });
  document.addEventListener("keydown", function(e){
    if (e.key !== "Escape") return;
    closeTools(null);
    if (!panel.hidden){ closePanel(); burger.focus(); }
  });
  document.addEventListener("click", function(e){
    var inTools = e.target.closest("details.navtools");
    closeTools(inTools);
    if (!panel.hidden && !e.target.closest("#navPanel") && e.target !== burger
        && !burger.contains(e.target)) closePanel();
  });

  /* THE REAL TOGGLE IS THE HEADER'S. These proxy a click to it and mirror its label, rather than
     being copies of a button whose id the theme script binds to. */
  var realBtn = document.getElementById("themeToggleBtn"),
      realLabel = document.getElementById("themeToggleLabel"),
      realIcon = document.getElementById("themeToggleIcon");
  var proxies = document.querySelectorAll("[data-theme-proxy]");
  function syncTheme(){
    proxies.forEach(function(p){
      var sp = p.querySelector("span");
      if (sp && realLabel) sp.textContent = realLabel.textContent;
      if (realIcon) p.firstChild.nodeValue = realIcon.textContent + " ";
    });
  }
  proxies.forEach(function(p){
    p.addEventListener("click", function(){
      if (realBtn) realBtn.click();
      setTimeout(syncTheme, 0);
    });
  });
  if (realBtn) realBtn.addEventListener("click", function(){ setTimeout(syncTheme, 0); });
  syncTheme();

  /* Shown once the header is entirely above the viewport. IntersectionObserver rather than a
     scroll handler: no work on every frame, and it is right at any zoom or font size. */
  function show(on){
    bar.classList.toggle("on", on);
    if (!on){ closePanel(); closeTools(null); }
  }
  if (window.IntersectionObserver){
    new IntersectionObserver(function(entries){
      show(!entries[0].isIntersecting);
    }, {threshold: 0}).observe(head);
  } else {
    /* No observer (very old browsers): the bar simply never appears, and the header's own menu
       is still there. Better than a scroll handler nobody will measure. */
    show(false);
  }
})();
</script>
</body>"""

# ── and the scale note goes ───────────────────────────────────────────────────────────────────
# Søren, 2026-10-17: "Remove this". The sentence explained a thing the pictures already say —
# every box is drawn at one scale — and it stood between the section heading and the first card,
# which is where the eye is going anyway. Its own <title> on each box still carries the claim for
# anyone who hovers, and volboxcheck.js still measures that the claim is true.
SCALENOTE = (u'  <p class="scalenote">Each card carries a scale model of its volume in the corner'
             u' &mdash; <b>all eight are drawn at the same scale</b>, so their sizes can be'
             u' compared directly. &omega;Jump holds volumes of very different sizes, so its card'
             u' stacks five of them, from the smallest on the roster to the largest.</p>\n')
SCALECSS = u"  .scalenote{color:var(--muted);font-size:13px;margin:26px 0 -14px}\n"

edit(IDX, [
    (u"the menu is a row of buttons, and a bar that follows you down", OLD_CSS, NEW_CSS),
    (u"...the tools are in it, each linking to its own page", OLD_NAV, NEW_NAV),
    (u"...the bar and the phone panel exist", u"</header>", BAR),
    (u"...and one script fills both from the header's own list", u"</body>", SCRIPT),
    # The brand in the bar goes back to the top, which needs something to go back TO.
    (u"the header is an anchor, so the bar's wordmark can return to it",
     u"\n<header>\n", u"\n<header id=\"top\">\n"),
    (u"the scale note is gone", SCALENOTE, u""),
    (u"...and so is the rule that styled it", SCALECSS, u""),
])

# ── two things the phone panel got wrong on first render ──────────────────────────────────────
# Seen in the picture rather than in the markup: the rows inherited `display:inline-flex` from
# the pill rule, so each one shrank to its own text and the dividing line under it stopped where
# the word did — a list that looked ragged for no reason. And 78vh cut the eighth item in half
# on a 780 px screen, which reads as a bug even though the panel scrolls.
edit(IDX, [
    (u"a row in the phone panel is as wide as the panel",
     u" .navpanel .sitenav a,.navpanel .sitenav summary{border:0;border-radius:10px;"
     u"padding:12px 12px;\n   font-size:16px;background:transparent;justify-content:flex-start}",
     u" .navpanel .sitenav a,.navpanel .sitenav summary{display:flex;width:100%;border:0;\n"
     u"   border-radius:10px;padding:12px 12px;font-size:16px;background:transparent;\n"
     u"   justify-content:flex-start}"),
    (u"...and the panel shows more of itself before it has to scroll",
     u"max-height:min(78vh,560px);overflow:auto",
     u"max-height:min(85vh,640px);overflow:auto"),
])

# ── and one check has to say WHICH link it means ──────────────────────────────────────────────
# volboxcheck.js found each card with `a[href="/ujump.html"]`, which was unambiguous while the
# only link to a tool was its card. The menu now carries one too, and the menu is above the
# cards, so every card lookup returned a pill with no figure in it and all eight assertions went
# red at once. The cards are the elements with class "feature"; naming that is both the fix and
# the more honest selector.
edit(os.path.join(HERE, "volboxcheck.js"), [
    (u"the card is found by its own class, not by being the first link to the tool",
     u"""    const card = document.querySelector('a[href="/' + t + '.html"]');""",
     u"""    /* `a.feature`, not any link to the tool: since 2026-10-17 the menu links to all eight
       as well, and it comes first in the document. */
    const card = document.querySelector('a.feature[href="/' + t + '.html"]');"""),
])

print("\nNow: python3 src/build_stamps.py, then node frontnavcheck.js")
