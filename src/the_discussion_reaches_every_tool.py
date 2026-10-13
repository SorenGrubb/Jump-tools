# -*- coding: utf-8 -*-
r"""The discussion reaches every tool.                                               2026-10-13

Søren: *"I can see that the discussion exists in µJump but not in the other tools. Let's get it
there so I can start testing whether it works."*

ONE FORUM WITH ONE PARTICIPANT IS A NOTEBOOK. Everything built this morning -- the shared stream,
the tool badge, the per-tool colour, a post's coordinates resolving against the tool that wrote
them -- is only testable from two tools at once, and until now it has only been reachable from one.

WHAT A HOST ACTUALLY NEEDS, and it is less than it looks: a tab button, an empty panel, the two
modules, and one init call. core/jumplink.js is already on all five hand-maintained pages, and
REPORT_ENDPOINT and the Google globals have been since the reporting was built.

TWO THINGS WERE MISSING, and both were in the module rather than in the pages:

  NO PAGE BUT µJUMP DEFINES window.jumpLinkHost(). core/jumplink.js resolves against it, so on
  δJump a δJump post's own coordinates would have linkified to nothing -- the module would have
  been asking a page that has no answer. core/tools.js has that answer for five of the eight, so
  the forum now falls back to the registry for its OWN tool when the page declares no host. µJump
  is untouched: its own host carries the nucleus table, the shader and whichever viewer the reader
  picked from the dropdown, and none of that is in the registry.

  AND NO PAGE BUT µJUMP AND ωJUMP LOADS core/empreview.js. wirePreviews() returned early without
  it -- and that early return was what attached the click handlers, so every link in every post
  would have been an <a href="#"> that does nothing. A dead link is worse than a plain number. The
  anchors are wired either way now: with the preview where there is one, and opening the viewer
  where there is not.

AND THE BADGE STOPS REPEATING ITSELF. `volume` is sent by every tool and shown only where the tool
serves more than one -- ωJump's sixty-three, µJump's two. "δJump · v1dd" says nothing that "δJump"
does not.

NOT ωJUMP OR χJUMP YET. Both are generated pages that inline core/, so they are their build
scripts' business and a separate change; ωJump also has to decide what `volume` means when the
reader switches dataset with the Discussion open.

Changes: core/tools.js, core/forum.js, djump.html, pjump.html, ljump.html, hjump.html, bjump.html
Checks:  forumtabcheck.js (new), forumonecheck.js, forumcheck.js, toolscheck.js
Run: python3 src/the_discussion_reaches_every_tool.py
     node forumtabcheck.js && node forumonecheck.js && node forumcheck.js && node toolscheck.js
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


# ── 1. the registry says whether naming the volume adds anything ──────────────────────────────
edit("core/tools.js", [

 (u"a tool can say whether it serves more than one volume",
  u'''  function boxed(k){
    var t = byKey(k);
    return !!(t && t.volumes && t.volumes.length);
  }''',
  u'''  function boxed(k){
    var t = byKey(k);
    return !!(t && t.volumes && t.volumes.length);
  }
  /* ── IS THE VOLUME WORTH NAMING BESIDE THE TOOL? ───────────────────────────  2026-10-13
     Every tool sends which volume was open; only some of them are telling you something by it.
     "ωJump · jrc_hela-2" picks one of sixty-three and "µJump · minnie35" picks the slab without
     nuclei over it; "δJump · v1dd" says δJump twice. `perVolume` is for ωJump, whose sixty-three
     are not listed here at all, so volumes.length cannot answer for it. */
  function manyVolumes(k){
    var t = byKey(k);
    if (!t) return true;          /* a tool this list does not know: say everything that is known */
    return !!t.perVolume || (t.volumes || []).length > 1;
  }'''),

 (u"...and it is exported",
  u'''  return { all: all, keys: keys, byKey: byKey, label: label, dataset: dataset,
           boxed: boxed, css: css, styleEl: styleEl, hostFor: hostFor };''',
  u'''  return { all: all, keys: keys, byKey: byKey, label: label, dataset: dataset,
           boxed: boxed, manyVolumes: manyVolumes,
           css: css, styleEl: styleEl, hostFor: hostFor };'''),
])

# ── 2. the forum works on a page that declares no host and draws no preview ───────────────────
edit("core/forum.js", [

 (u"our own posts fall back to the registry where the page has no host",
  u'''function linkOpts(tool){
  if (!foreign(tool)) return null;
  var h = toolHost(tool);
  return h ? { host: h } : { none: true };
}''',
  u'''/* ── AND OUR OWN POSTS, ON A PAGE THAT DECLARES NO HOST ────────────────────────  2026-10-13
   µJump is the only page with a window.jumpLinkHost(): it was written for the Discussion when the
   Discussion was only here. Its host carries the nucleus table behind “cell 253863”, the EM
   shader, and whichever viewer the reader picked from the dropdown — none of which is in the
   registry — so where it exists it still wins. Everywhere else the registry answers for this
   tool exactly as it answers for anybody else's, which is also the honest result for ηJump and
   βJump: no verified box, no links, rather than links to a box nobody checked. */
function linkOpts(tool){
  var t = String(tool || "");
  if (!foreign(t) && typeof window.jumpLinkHost === "function") return null;
  var h = toolHost(foreign(t) ? t : TOOL);
  return h ? { host: h } : { none: true };
}'''),

 (u"a page with no EM preview still has working links",
  u'''function wirePreviews(host){
  if (!host || !window.UJ || !UJ.empreview) return;
  [].slice.call(host.querySelectorAll(".forumbody")).forEach(function(body){''',
  u'''function wirePreviews(host){
  if (!host || !window.UJ) return;
  /* ── A LINK THAT DOES NOTHING IS WORSE THAN A NUMBER ───────────────────────────  2026-10-13
     This used to return here when core/empreview.js was absent — and this function is what
     attaches the click handlers, so on the five pages that do not load it every link in every
     post would have been an <a href="#"> that swallows the click and does nothing at all. The
     anchors are wired either way now: the picture where there is one, the viewer where there is
     not. Which is also what the link meant before 2026-10-03. */
  var canDraw = !!UJ.empreview;
  [].slice.call(host.querySelectorAll(".forumbody")).forEach(function(body){'''),

 # THE DELIMITER IS CHOSEN BY THE LAST CHARACTER. Both of these blocks end in a single quote, so
 # ''' closes early and the file will not parse. """ it is, and nothing inside them is a """.
 (u"...and the foreign line does not close a preview that is not there",
  u"""          open = "";
          UJ.empreview.close(slot);
          slot.innerHTML = "<p class='forumelsewhere'""",
  u"""          open = "";
          if (canDraw) UJ.empreview.close(slot);
          slot.innerHTML = "<p class='forumelsewhere'"""),

 (u"...and a place in this volume opens the viewer where it cannot be drawn",
  u'''        var at = h.voxel;
        if (!at && h.kind === "nucleus") at = nucleusPos(h.id);''',
  u'''        if (!canDraw){
          /* The viewer, with this page's own host — which on a page without jumpLinkHost() is the
             registry's, so the link opens this tool's volume rather than nothing. */
          ev.preventDefault();
          ev.stopPropagation();
          var lo = linkOpts(btool), lu = "";
          try { if (UJ.jumplink) lu = UJ.jumplink.url([h], lo || undefined) || ""; } catch (_ve){}
          if (lu) window.open(lu, "_blank", "noopener");
          return;
        }
        var at = h.voxel;
        if (!at && h.kind === "nucleus") at = nucleusPos(h.id);'''),

 (u"the badge names the volume only where that picks one out",
  u'''  var vol = String((p && p.volume) || "");''',
  u'''  var vol = String((p && p.volume) || "");
  /* Shown where the tool serves more than one — ωJump's sixty-three, µJump's two slabs. On a
     one-volume tool it would be the tool's name twice. */
  try {
    if (vol && window.UJ && UJ.tools && UJ.tools.manyVolumes && !UJ.tools.manyVolumes(k)) vol = "";
  } catch (_ve){}'''),
])

# ── 3. the five hand-maintained pages get the tab ─────────────────────────────────────────────
# Everything per-page is the tool key, the volume key and the two anchors. The markup is µJump's,
# which is the point: one forum means one panel, not five that drifted.
TAB = (u'<button type="button" class="tabbtn" data-tab="forum" role="tab" aria-selected="false" '
       u'title="Findings, bugs and ideas — ONE discussion shared by every Jump. A post is '
       u'marked with the tool it was written from, and coordinates and ids written into it become '
       u'links in that tool\'s own frame.">@SPEECH@ Discussion</button>\n')

PANEL = (u'<!-- ── DISCUSSION ── 2026-10-13. One forum for every Jump '
         u'(core/forum.js). The panel is\n'
         u'     empty markup; everything in it is the module\'s, exactly as the tracing card works.\n'
         u'     Filled the first time the tab is opened rather than on load: it is one more request\n'
         u'     to the backend, and a page nobody has clicked Discussion on should not pay for it. -->\n'
         u'<div class="tabpanel" data-tabpanel="forum">\n'
         u'<div id="forumCard"></div>\n'
         u'</div>\n'
         u'<script>\n'
         u'(function(){\n'
         u'  var started=false;\n'
         u'  function openForum(){\n'
         u'    if(started)return; started=true;\n'
         u'    if(window.UJ&&UJ.forum)UJ.forum.init({tool:"@TOOL@",volume:"@VOL@"});\n'
         u'  }\n'
         u'  /* The tab engine switches panels by toggling .active on [data-tabpanel]; there is no\n'
         u'     event to listen for, so this watches the button that opens it. */\n'
         u'  var btn=document.querySelector(\'#mainTabs .tabbtn[data-tab="forum"]\');\n'
         u'  if(btn)btn.addEventListener("click",openForum);\n'
         u'})();\n'
         u'</script>\n')

SCRIPTS = (u'<!-- THE REGISTRY OF JUMPS: which tool a post came from, that tool\'s colour, and the\n'
           u'     volumes its coordinates are in. core/jumplink.js does not read it — it is\n'
           u'     handed a host built from it. 2026-10-13. -->\n'
           u'<script src="core/tools.js"></script>\n'
           u'<!-- The Discussion: one forum shared by every Jump, with the places a post names made\n'
           u'     clickable by core/jumplink.js above. 2026-10-13. -->\n'
           u'<script src="core/forum.js"></script>\n')

PAGES = [
    # page            tool      volume      the dashboard button, and the dashboard panel
    ("djump.html", "djump", "v1dd", u"\U0001F4AC",
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false" title="Live/static statistics dashboard built from this dataset + the community-reporting backend — opens inline, no separate tab or re-login">\U0001F4CA Statistics dashboard</button>\n',
     u'<div class="tabpanel" data-tabpanel="dashboard" id="dashPanel">'),
    ("pjump.html", "pjump", "pinky100", u"\U0001F4AC",
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false" title="Live/static statistics dashboard built from this dataset + the community-reporting backend — opens inline, no separate tab or re-login">\U0001F4CA Statistics dashboard</button>\n',
     u'<div class="tabpanel" data-tabpanel="dashboard" id="dashPanel">'),
    ("ljump.html", "ljump", "lee16", u"\U0001F4AC",
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false" title="Charts built from this page\'s own data plus the community backend — the charting library loads only when you open this tab">\U0001F4CA Statistics dashboard</button>\n',
     u'<div class="tabpanel" data-tabpanel="dashboard">'),
    ("hjump.html", "hjump", "h01", u"&#128172;",
     u'<button type="button" class="tabbtn" data-tab="dash" role="tab" aria-selected="false" title="Charts built from this page\'s own data plus the community backend — the charting library loads only when you open this tab">&#128202; Statistics</button>\n',
     u'<div class="tabpanel" data-tabpanel="dash">'),
    ("bjump.html", "bjump", "vclem-ca1", u"\U0001F4AC",
     u'<button type="button" class="tabbtn" data-tab="dashboard" role="tab" aria-selected="false" title="Charts built from this page\'s own data plus the community backend — the charting library loads only when you open this tab">\U0001F4CA Statistics dashboard</button>\n',
     u'<div class="tabpanel" data-tabpanel="dashboard">'),
]

for page, tool, vol, speech, dashbtn, dashpanel in PAGES:
    edit(page, [
        (u"a Discussion tab, before the statistics one",
         dashbtn, TAB.replace(u"@SPEECH@", speech) + dashbtn),
        (u"...the panel it opens, and the one call that fills it",
         dashpanel, PANEL.replace(u"@TOOL@", tool).replace(u"@VOL@", vol) + dashpanel),
        (u"...and the two modules, after the linkifier they use",
         u'<script src="core/jumplink.js"></script>\n',
         u'<script src="core/jumplink.js"></script>\n' + SCRIPTS),
    ])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
for page, tool, vol, _s, _b, _p in PAGES:
    s = io.open(os.path.join(HERE, page), encoding="utf-8").read()
    # Twice: the button, and the querySelector in the script that watches it.
    for what, n in [(u'data-tab="forum"', 2), (u'data-tabpanel="forum"', 1),
                    (u'id="forumCard"', 1),
                    (u'<script src="core/forum.js"></script>', 1),
                    (u'<script src="core/tools.js"></script>', 1),
                    (u'UJ.forum.init({tool:"' + tool + u'",volume:"' + vol + u'"})', 1)]:
        assert s.count(what) == n, "%s: %d of %r, wanted %d" % (page, s.count(what), what, n)
    # THE ORDER IS THE PART THAT BREAKS SILENTLY. forum.js reads the registry at render and the
    # linkifier at every body; a page that loads them the other way round works until it does not.
    assert s.index(u'src="core/jumplink.js"') < s.index(u'src="core/tools.js"') \
        < s.index(u'src="core/forum.js"'), page + ": the modules load in the wrong order"
    # ...and the panel is a sibling of the others, inside the tab wrapper rather than after it.
    assert s.index(u'data-tabpanel="forum"') < s.index(_p), page + ": the panel is misplaced"

_T = io.open(os.path.join(HERE, "core/tools.js"), encoding="utf-8").read()
assert _T.count(u"function manyVolumes(k){") == 1
assert _T.count(u"manyVolumes: manyVolumes") == 1

_F = io.open(os.path.join(HERE, "core/forum.js"), encoding="utf-8").read()
assert _F.count(u"var canDraw = !!UJ.empreview;") == 1
assert _F.count(u"if (canDraw) UJ.empreview.close(slot);") == 1
assert _F.count(u"if (!canDraw){") == 1
assert _F.count(u"typeof window.jumpLinkHost === \"function\"") == 1
# AND THE EARLY RETURN IS GONE. It is the whole bug: it is what skipped the wiring.
assert u"if (!host || !window.UJ || !UJ.empreview) return;" not in _F
print("done")
print("all applied")
