# -*- coding: utf-8 -*-
r"""One discussion for every tool.                                                   2026-10-13

Søren: *"I want one stream for all the tools (when we implement it) the post should always be
marked with the tool you are writing from and with the color code of the tool. So, there is one
discussion forum for all the tools. For wJump it should depend which dataset you have open when you
enter the discussion. ... You should be able to share a coordinate from xJump in a conversation with
one from uJump to show an example from your dataset and then the person from uJump can show an
example from there."*  And, of the chooser and the paragraph above the index: *"For now, let's leave
out the choice between this volume and the tools. Also remove the helper text."*

THE CHOOSER IS TWO LINES. THE REST OF THIS IS WHY IT TOOK A FILE.

ONE SHARED FORUM ALREADY EXISTED, and nobody had noticed: backend/Code.gs's forumSS_("tools")
returns primarySS(), and every deployment's read takes `tools` rows from that one book. So tagging
new posts scope:"tools" makes one stream for the whole family with NO change to Code.gs. The chips
were not a feature with a backend behind it; they were a filter over two things already there.

WHAT DOES NEED WRITING IS THE PART THAT MAKES IT SAFE. core/jumplink.js resolves a triple against
window.jumpLinkHost() -- THE READER'S PAGE -- and with one forum per tool that was exactly right.
In one shared stream it is a way to publish a claim the author never made:

    δJump's own volume centre is 109743, 79665, 8811 in V1DD's 9x9x45 nm frame. Read in µJump's
    4x4x40 frame, those same three numbers are 438,972 / 318,660 / 352,440 nm -- INSIDE minnie35.
    So a post written in δJump and read in µJump would have linkified to mouse visual cortex the
    author never mentioned, and the link would have looked completely ordinary.

toolscheck.js counts the pairs: EIGHT of them across the family, before anybody writes a post. The
fix is that a post resolves against ITS OWN tool, which needs a list of the tools -- their frames,
their boxes, their imagery and their colours -- that no single page has. That is core/tools.js.

AND THREE TOOLS GET NO BOX ON PURPOSE. ηJump and βJump read their extents from the volume's own
`info` at run time, so there is no verified constant to copy; ωJump serves 63 volumes and one box
for "ωJump" would be false for sixty-two of them. Their posts linkify nothing, which is
core/jumplink.js's own rule: a missed link is a number a reader can still copy, a wrong one is a
claim nobody made.

WHAT IS STILL OWED, and it is one line of Code.gs rather than anything here: fmRow is built from a
fixed list of fields, so `volume` -- which dataset was open when the post was written -- is sent,
accepted by appendByHeader_'s ensureHeaderColumn, and then dropped by the handler. Until that line
lands an ωJump post's badge says "ωJump" and not which of the sixty-three it is about. The page is
already sending it and already shows it the moment the column exists.

Changes: core/tools.js (new, written beside this), core/jumplink.js, core/forum.js, ujump.html
Checks:  toolscheck.js (new), forumonecheck.js (new), forumcheck.js (the chip section retired)
Run: python3 src/one_discussion_for_every_tool.py
     node toolscheck.js && node forumonecheck.js && node forumcheck.js
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


# ── 0. the registry has to be on the page before the forum reads it ──────────────────────────
assert os.path.exists(os.path.join(HERE, "core/tools.js")), \
    "core/tools.js is missing -- it is written beside this generator, not by it"

edit("ujump.html", [
    (u"core/tools.js loads before the forum that asks it who wrote a post",
     u'<script src="core/forum.js"></script>',
     u'<!-- THE REGISTRY OF JUMPS, before the forum, which asks it which tool a post came from and\n'
     u'     what that tool\'s volumes are. core/jumplink.js does not read it: it is handed a host. -->\n'
     u'<script src="core/tools.js"></script>\n'
     u'<script src="core/forum.js"></script>'),
])

# ── 1. the linkifier will resolve against a host it is given ─────────────────────────────────
# Its default is unchanged: no host, the reader's page, exactly as before. What is new is that a
# caller holding somebody else's host can say so, which is the whole of the cross-tool fix.
edit("core/jumplink.js", [

 (u"scan() takes the host it should resolve against",
  u'''function scan(text){
  var s = String(text == null ? "" : text), host = hostOf();''',
  u'''/* ── WHOSE PAGE DECIDES WHERE A COORDINATE IS ──────────────────────────────────  2026-10-13
   Søren: *"You should be able to share a coordinate from xJump in a conversation with one from
   uJump."*  Until today this file had one answer to "which volumes": window.jumpLinkHost(), the
   page doing the reading. One forum per tool made that correct. One shared forum makes it a way
   to publish a claim nobody made -- δJump's volume centre, read in µJump's frame, is inside
   minnie35, so the link would open mouse visual cortex under a V1DD coordinate.

   So `opts.host` is the author's page, handed in by core/forum.js from core/tools.js. No host is
   the old behaviour, unchanged, which is what every other caller still relies on. */
function scan(text, opts){
  var s = String(text == null ? "" : text);
  var host = (opts && opts.host) ? opts.host : hostOf();'''),

 (u"html() passes it through, rather than scanning against the reader",
  u'''function html(text, opts){
  var s = String(text == null ? "" : text);
  var hits;
  try { hits = scan(s); } catch (_e){ hits = []; }
  if (!hits.length) return esc(s);
  var o = opts || {}, cls = o.className || "jumplink";''',
  u'''function html(text, opts){
  var s = String(text == null ? "" : text);
  var o = opts || {}, cls = o.className || "jumplink";
  var hits;
  /* THE SAME OPTIONS THE CALLER GAVE, so the anchors, their titles and their indices all come
     from one scan of one host. Scanning here against the reader and resolving on click against
     the author would put the two out of step by exactly the hits one of them refuses. */
  try { hits = scan(s, o); } catch (_e){ hits = []; }
  if (!hits.length) return esc(s);'''),

 (u"state() uses it too, so the viewer opens the author's volume",
  u'''function state(hits, opts){
  var host = hostOf();
  if (!host) return null;
  var o = opts || {};''',
  u'''function state(hits, opts){
  var o = opts || {};
  var host = o.host || hostOf();
  if (!host) return null;'''),

 (u"...and so does url()",
  u'''function url(hits, opts){
  var host = hostOf();
  if (!host) return "";''',
  u'''function url(hits, opts){
  var host = (opts && opts.host) ? opts.host : hostOf();
  if (!host) return "";'''),

 (u"and wire() scans the text it is linkifying the same way it rendered it",
  u'''  el.innerHTML = html(text, opts);
  var hits = scan(text);''',
  u'''  el.innerHTML = html(text, opts);
  var hits = scan(text, opts);'''),
])

# ── 2. the forum: one stream, and every post says whose frame it is in ───────────────────────
edit("core/forum.js", [

 (u"the header says there is one stream now",
  u'''   ── TWO STREAMS, BECAUSE THEY ARE ABOUT DIFFERENT THINGS ─────────────────────────────────────
   "The capillary at 240640, 207872, 21360 has an odd pericyte" is about minnie65 and means nothing
   in H01, so it belongs to this volume. "The pad forgets my colour" is about the tracing pad, which
   is the same code in all eight tools — scattered across eight forums it would be eight half-dead
   threads, so the tools stream is ONE conversation, written here and visible from every Jump. They
   are now the two chips at the top of the index rather than two stacked cards.''',
  u'''   ── ONE STREAM, FOR ALL EIGHT TOOLS ──────────────────────────────────────────  2026-10-13
   Søren: *"I want one stream for all the tools... So, there is one discussion forum for all the
   tools."*  And of the two chips that used to be here: *"For now, let's leave out the choice
   between this volume and the tools. Also remove the helper text."*

   It was two streams: posts about THIS VOLUME in this dataset's book, posts about THE TOOLS in the
   primary one. That division was defensible and it was also a filter the reader had to operate
   before seeing anything, over a forum with a few dozen posts in it.

   THE SHARED STREAM ALREADY EXISTED. backend/Code.gs's forumSS_("tools") returns primarySS(), and
   every deployment's read takes `tools` rows from that one book — so a post tagged scope:"tools"
   is, and always was, visible from every Jump. New posts are tagged that way and the index lists
   every root it was given, whichever stream it came from. Nothing in Code.gs changed.

   AND THEN A POST IS NOT NECESSARILY IN YOUR FRAME. This is the part that needed care rather than
   deletion. core/jumplink.js resolved coordinates against the READER'S page, which was right when
   a forum could only hold one tool's posts. δJump's volume centre is 109743, 79665, 8811 in its
   own 9×9×45 nm frame; read in µJump's 4×4×40 that is inside minnie35, so the link would have
   opened unrelated cortex under somebody else's coordinate. So a post's places resolve against the
   tool that WROTE it, from core/tools.js, and a tool whose extent this family cannot verify
   (ηJump, βJump, ωJump) linkifies nothing rather than linkifying wrongly.'''),

 (u"the shared stream has a name, and the tool badge needs the registry",
  u'''var POSTS = [], CAN_MODERATE = false, LOADED = false, TOOL = "", VOLUME = "", BUSY = false;
/* WHAT THE PANEL IS SHOWING. `SCOPE` is which stream's index is listed, `OPEN` the thread in the
   right-hand pane, `MODE` "new" when that pane is holding a new-thread form instead. */
var SCOPE = "volume", OPEN = "", MODE = "";''',
  u'''var POSTS = [], CAN_MODERATE = false, LOADED = false, TOOL = "", VOLUME = "", BUSY = false;
/* WHAT THE PANEL IS SHOWING. `OPEN` is the thread in the right-hand pane, `MODE` "new" when that
   pane is holding a new-thread form instead. There is no SCOPE any more: the index lists every
   root, and `STREAM` is where a new one is written — the primary book, which every deployment
   reads, so one post reaches every Jump. */
var OPEN = "", MODE = "";
var STREAM = "tools";

/* ── WHOSE FRAME A POST'S COORDINATES ARE IN ──────────────────────────────────────────────────
   The dangerous half of one shared forum. A post from another tool was written in another frame
   against another volume, and resolving its numbers here would answer a question nobody asked.

   THREE OUTCOMES, AND THE THIRD IS THE ONE THAT MATTERS:
     our own tool    -> null: this page's jumpLinkHost() is the right one, unchanged behaviour
     another, known  -> that tool's host, built by core/tools.js from boxes verified in this
                        repository, so the link opens THAT volume's imagery
     another, no box -> { none: true }: nothing is linkified. ηJump and βJump read their extents
                        from the volume at run time and ωJump serves 63 volumes, so there is no
                        constant here to resolve against — and a guessed box would be the worse
                        half of core/jumplink.js's own rule. */
function foreign(tool){
  var t = String(tool || "");
  return !!(t && TOOL && t !== TOOL);
}
function toolHost(tool){
  try { if (window.UJ && UJ.tools) return UJ.tools.hostFor(tool); } catch (_e){}
  return null;
}
function linkOpts(tool){
  if (!foreign(tool)) return null;
  var h = toolHost(tool);
  return h ? { host: h } : { none: true };
}
/* ── THE BADGE ────────────────────────────────────────────────────────────────────────────────
   Søren: *"the post should always be marked with the tool you are writing from and with the color
   code of the tool."*  The colour is var(--tool-accent), set by two CSS rules per tool in
   core/tools.js rather than by a hex picked here: every one of these pages re-skins live when the
   theme is toggled, and the forum does not re-render when it does.

   AND WHICH VOLUME, where the tool alone does not say. `volume` is sent with every post from
   today; backend/Code.gs builds its row from a fixed list of fields and so drops it until one line
   is added there, after which ωJump's badge names the dataset that was open. Read rather than
   assumed, so the day it arrives nothing here changes. */
function toolBadge(p){
  var k = String((p && p.tool) || "");
  if (!k) return "";
  var lab = k, about = "";
  try {
    if (window.UJ && UJ.tools){ lab = UJ.tools.label(k); about = UJ.tools.dataset(k) || ""; }
  } catch (_e){}
  var vol = String((p && p.volume) || "");
  return "<span class=\\"ftool ftool-" + esc(k) + "\\" title=\\"Written from " + esc(lab)
       + (about ? " — " + esc(about) : "") + "\\" style=\\"color:var(--tool-accent);"
       + "border:1px solid var(--tool-accent);border-radius:999px;padding:0 6px;font-size:11px;"
       + "white-space:nowrap\\">" + esc(lab) + (vol ? " · " + esc(vol) : "") + "</span>";
}'''),

 (u"a body is rendered in its author's frame",
  u'''function bodyHtml(s){
  try { if (window.UJ && UJ.jumplink) return UJ.jumplink.html(s); } catch (_e){}
  return esc(s);
}
function hits(s){
  try { if (window.UJ && UJ.jumplink) return UJ.jumplink.scan(s) || []; } catch (_e){}
  return [];
}''',
  u'''function bodyHtml(s, tool){
  var o = linkOpts(tool);
  if (o && o.none) return esc(s);
  try { if (window.UJ && UJ.jumplink) return UJ.jumplink.html(s, o || undefined); } catch (_e){}
  return esc(s);
}
function hits(s, tool){
  var o = linkOpts(tool);
  if (o && o.none) return [];
  try { if (window.UJ && UJ.jumplink) return UJ.jumplink.scan(s, o || undefined) || []; }
  catch (_e){}
  return [];
}'''),

 (u"every root is a thread, whichever stream it was written to",
  u'''function roots(scope){
  return POSTS.filter(function(p){ return String(p.scope) === scope && !p.replyTo; });
}''',
  u'''/* ONE INDEX. The scope a post was written with says which BOOK it lives in, which is the
   backend's business; it is not a category a reader should have to pick before reading anything. */
function roots(){
  return POSTS.filter(function(p){ return !p.replyTo; });
}'''),
])

# ── 3. the index: no chooser, no blurb, a badge on every row ──────────────────────────────────
edit("core/forum.js", [

 (u"the index asks for every thread rather than for one stream's",
  u'''function indexHtml(){
  var rs = roots(SCOPE);''',
  u'''function indexHtml(){
  var rs = roots();'''),

 (u"the index heading says what it draws now",
  u'''/* ── THE INDEX ────────────────────────────────────────────────────────────────────────────────
   Left column. Two chips for the two streams, a button to start something, then one <details> per
   category with the threads inside it.''',
  u'''/* ── THE INDEX ────────────────────────────────────────────────────────────────────────────────
   Left column. A button to start something, then one <details> per category with the threads
   inside it. The two chips and the paragraph under them went on 2026-10-13: one forum, and a
   reader should not have to operate a filter before seeing anything.'''),

 (u"the chooser and the helper text go, and each row says who wrote it",
  u'''  var chip = function(s, label){
    return '<button type="button" class="hist-chip fscope' + (SCOPE === s ? " on" : "")
         + '" data-scope="' + s + '"' + (SCOPE === s ? ' style="border-color:var(--accent);'
         + 'color:var(--accent)"' : "") + ">" + esc(label) + "</button>";
  };
  var groups = KINDS.map(function(k){''',
  u'''  /* No chip row. The two streams are one index; see the heading above. */
  var groups = KINDS.map(function(k){'''),

 (u"...and the row carries the badge rather than a bare key",
  u'''                    + esc(p.authorName || "somebody") + " · " + esc(when(lastAt(p)))
                    + (n ? " · " + n + (n === 1 ? " reply" : " replies") : "")
                    + (SCOPE === "tools" && p.tool ? " · " + esc(p.tool) : "")
                  + "</span></button>";''',
  u'''                    + esc(p.authorName || "somebody") + " · " + esc(when(lastAt(p)))
                    + (n ? " · " + n + (n === 1 ? " reply" : " replies") : "")
                  + "</span>"
                  + (p.tool ? "<span style='display:block;margin-top:2px'>" + toolBadge(p)
                              + "</span>" : "")
                  + "</button>";'''),

 (u"the index is a list and a button, with nothing above it to choose",
  u'''  return "<div class='forum-index' style='flex:1 1 230px;min-width:0;max-width:320px'>"
       + "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px'>"
         + chip("volume", "This volume") + chip("tools", "The tools") + "</div>"
       + "<p class='hint' style='margin:0 0 8px'>"
       + (SCOPE === "tools"
            ? "Bugs and ideas about the Jump tools themselves. <b>Shared across every Jump</b> "
              + "— the tracing pad is the same code everywhere, so one conversation about it "
              + "is worth more than eight."
            : "Findings, oddities and questions about the cells themselves. Posts here belong to "
              + "this dataset. Write coordinates and ids straight into the sentence: a reader "
              + "clicks one and sees the tissue.")
       + "</p>"
       + "<button type='button' class='idbtn' id='forum_new' style=\\"width:auto;padding:3px 12px;"''',
  u'''  return "<div class='forum-index' style='flex:1 1 230px;min-width:0;max-width:320px'>"
       + "<button type='button' class='idbtn' id='forum_new' style=\\"width:auto;padding:3px 12px;"'''),

 (u"a post carries the badge and the frame its coordinates are in",
  u'''function postHtml(p, isRoot){
  var n = hits(p.body || "").filter(function(h){
    return h.voxel || h.kind === "root"; }).length;''',
  u'''function postHtml(p, isRoot){
  var n = hits(p.body || "", p.tool).filter(function(h){
    return h.voxel || h.kind === "root"; }).length;'''),

 (u"...in the line above it, instead of a bare key in a sentence",
  u'''         + esc(p.authorName || "somebody") + " · " + esc(when(p.timestamp))
         + (p.editedAt ? " · edited" : "")
         + (isRoot && String(p.scope) === "tools" && p.tool ? " · from " + esc(p.tool) : "")
       + "</div>"
       + "<div class='forumbody' data-raw='" + esc(p.body || "") + "' style='margin:4px 0'>"
         + bodyHtml(p.body || "") + "</div>"''',
  u'''         + esc(p.authorName || "somebody") + " · " + esc(when(p.timestamp))
         + (p.editedAt ? " · edited" : "")
         + (p.tool ? " · " + toolBadge(p) : "")
       + "</div>"
       /* data-tool TRAVELS WITH THE TEXT, because wirePreviews() re-scans data-raw on every click
          and has to scan it the same way it was rendered. A body whose links were resolved against
          V1DD and whose clicks resolve against minnie65 is worse than either. */
       + "<div class='forumbody' data-raw='" + esc(p.body || "") + "' data-tool='"
         + esc(p.tool || "") + "' style='margin:4px 0'>"
         + bodyHtml(p.body || "", p.tool) + "</div>"'''),
])

# ── 4. one compose box, and it writes to the shared stream ───────────────────────────────────
edit("core/forum.js", [

 (u"the new-thread form has one id rather than one per stream",
  u'''    inner = "<h3 style='margin:0 0 2px;font-size:16px'>A new thread</h3>"
          + "<p class='hint' style='margin:0 0 4px'>In "
          + (SCOPE === "tools" ? "<b>The tools</b>, where every Jump will see it"
                               : "<b>this volume</b>") + ".</p>"
          + composeHtml("forum_" + SCOPE, { kinds: true, rows: 5, go: "Post it",
              placeholder: SCOPE === "tools"
                ? "What the tool did, and what you expected."
                : "What you saw, and where. Write coordinates and ids straight into the sentence "
                  + "— they become links." });''',
  u'''    inner = "<h3 style='margin:0 0 2px;font-size:16px'>A new thread</h3>"
          + composeHtml("forum_thread", { kinds: true, rows: 5, go: "Post it",
              placeholder: "What you saw, and where. Write coordinates and ids straight into the "
                + "sentence — they become links, in this volume's frame, for readers in every "
                + "Jump." });'''),

 (u"and the drafts follow the one form",
  u'''function formIds(){ return ["forum_volume", "forum_tools", "forum_reply"]; }''',
  u'''function formIds(){ return ["forum_thread", "forum_reply"]; }'''),

 (u"a post says which volume was open, for the tools that have more than one",
  u'''  body.credential = GOOGLE_CREDENTIAL;
  body.tool = TOOL;''',
  u'''  body.credential = GOOGLE_CREDENTIAL;
  body.tool = TOOL;
  /* WHICH VOLUME WAS OPEN. Søren: *"For wJump it should depend which dataset you have open when
     you enter the discussion."*  ωJump serves 63 and the tool alone does not say which a post is
     about. Sent from today; backend/Code.gs assembles its row from a fixed list of fields, so it
     is dropped there until one line is added — and the badge reads it rather than assuming it, so
     the day the column exists nothing here changes. */
  if (VOLUME) body.volume = VOLUME;'''),

 (u"the chooser's wiring goes with the chooser",
  u'''  [].slice.call(host.querySelectorAll(".fscope")).forEach(function(b){
    b.addEventListener("click", function(){
      if (SCOPE === b.dataset.scope) return;
      SCOPE = b.dataset.scope; OPEN = ""; MODE = "";
      render();
    });
  });
  [].slice.call(host.querySelectorAll(".fthread")).forEach(function(b){''',
  u'''  /* Nothing to wire above the index: one stream, no chooser. */
  [].slice.call(host.querySelectorAll(".fthread")).forEach(function(b){'''),

 (u"and both composers write to the shared stream",
  u'''  composer("forum_" + SCOPE, function(){ return { type: "forum_post", scope: SCOPE }; });
  composer("forum_reply", function(){
    var p = postById(OPEN) || {};
    return { type: "forum_post", scope: p.scope || SCOPE, kind: "reply", replyTo: OPEN };
  });''',
  u'''  composer("forum_thread", function(){ return { type: "forum_post", scope: STREAM }; });
  /* A REPLY GOES TO THE SHARED STREAM TOO, even when the post it answers is an old `volume` one.
     Code.gs writes a scope:"volume" row into the DEPLOYMENT'S OWN book, so a reply written in
     δJump to a µJump thread would land where no µJump reader would ever see it. The read
     concatenates both books and joins on replyTo, so a thread whose root and replies live in
     different books reads as one thread. */
  composer("forum_reply", function(){
    return { type: "forum_post", scope: STREAM, kind: "reply", replyTo: OPEN };
  });'''),

 (u"the open-all button opens the author's volume",
  u'''      var u = UJ.jumplink.url(UJ.jumplink.scan(p.body || ""));
      if (u) window.open(u, "_blank", "noopener");''',
  u'''      var o = linkOpts(p.tool);
      if (o && o.none) return;
      var u = UJ.jumplink.url(UJ.jumplink.scan(p.body || "", o || undefined), o || undefined);
      if (u) window.open(u, "_blank", "noopener");'''),

 (u"the colours are on the page before anything is drawn with them",
  u'''function render(){
  var host = document.getElementById("forumCard");
  if (!host) return;
  grabDrafts();''',
  u'''function render(){
  var host = document.getElementById("forumCard");
  if (!host) return;
  /* One <style> for every tool's accent, added once. Idempotent in core/tools.js, so this does not
     have to remember whether it has already run. */
  try { if (window.UJ && UJ.tools && UJ.tools.styleEl) UJ.tools.styleEl(); } catch (_e){}
  grabDrafts();'''),

 (u"the test hooks drop the stream that no longer exists",
  u'''UJ.forum = { init: init, render: render,
             _foundSay: foundSay, _postHtml: postHtml, _indexHtml: indexHtml,
             _open: function(pid){ OPEN = pid || ""; MODE = ""; render(); },
             _scope: function(s){ if (s){ SCOPE = s; OPEN = ""; MODE = ""; } return SCOPE; },
             _new: function(){ MODE = "new"; OPEN = ""; render(); },''',
  u'''UJ.forum = { init: init, render: render,
             _foundSay: foundSay, _postHtml: postHtml, _indexHtml: indexHtml,
             _open: function(pid){ OPEN = pid || ""; MODE = ""; render(); },
             _new: function(){ MODE = "new"; OPEN = ""; render(); },'''),
])

# ── 5. clicking somebody else's coordinate does not draw this page's tissue ───────────────────
# THE ONE THAT WOULD HAVE BEEN MISSED. Even with the link resolved correctly, the click handler
# called UJ.empreview.open() on this page's imagery at those voxels -- a picture of minnie65 under
# a V1DD coordinate, captioned by somebody else's sentence. It is the most convincing wrong answer
# in the whole feature, because it looks like data.
edit("core/forum.js", [

 (u"the preview reads the body in its author's frame",
  u'''      a.addEventListener("click", function(ev){
        var hs = hits(body.dataset.raw || "");
        var h = hs[Number(a.getAttribute("data-jl"))];
        if (!h) return;
        /* A VIEWER LINK KEEPS ITS OLD MEANING: it is already a state somebody built. */
        if (h.kind === "viewer") return;''',
  u'''      a.addEventListener("click", function(ev){
        var btool = body.dataset.tool || "";
        var hs = hits(body.dataset.raw || "", btool);
        var h = hs[Number(a.getAttribute("data-jl"))];
        if (!h) return;
        /* A VIEWER LINK KEEPS ITS OLD MEANING: it is already a state somebody built. */
        if (h.kind === "viewer") return;
        /* ── SOMEBODY ELSE'S VOLUME IS NOT DRAWN HERE ───────────────────────────  2026-10-13
           The imagery on this page is this page's volume. Drawing it at another tool's voxels
           would produce a picture of the wrong tissue under the right numbers, with somebody
           else's sentence as its caption — the most convincing wrong answer in the feature,
           because it looks like data rather than like a bug. So a foreign place is OFFERED
           instead: which volume it is in, which Jump it belongs to, and the one link that can
           show it, built from that tool's own sources. */
        if (foreign(btool)){
          ev.preventDefault();
          ev.stopPropagation();
          var fh = toolHost(btool), lab = "", fu = "";
          try {
            if (window.UJ && UJ.tools) lab = UJ.tools.label(btool);
            if (fh && UJ.jumplink) fu = UJ.jumplink.url([h], { host: fh }) || "";
          } catch (_fe){}
          open = "";
          UJ.empreview.close(slot);
          slot.innerHTML = "<p class='forumelsewhere' style='font-size:12px;color:var(--mut);"
            + "margin:6px 0;line-height:1.5'>That is a place in <b>"
            + esc(h.label || h.volume || "another volume") + "</b>, which is "
            + esc(lab || btool) + "’s. The imagery on this page is a different block of tissue, "
            + "so it is not drawn here. "
            + (fu ? "<a href='" + esc(fu) + "' target='_blank' rel='noopener'>Open it in "
                    + "Neuroglancer</a>." : "")
            + "</p>";
          return;
        }'''),
])

# ── 6. forumcheck.js stops asserting the chooser it was written around ───────────────────────
# IT IS NOT DELETED. Everything it says about the tab, the index, the categories, the escaping and
# the sign-in race is still the contract and still passes. What goes is the part that described two
# streams as a user-facing choice, which forumonecheck.js now describes as one.
edit("forumcheck.js", [

 (u"the title says one stream",
  u'''/* The Discussion tab: two streams, and a post that is prose.                       2026-10-01''',
  u'''/* The Discussion tab: one stream, and a post that is prose.                        2026-10-01
                                                                     (one stream, 2026-10-13)'''),

 (u"...and so does the note under it",
  u'''   Gary: *"a separate space where users can make suggestions for new features, log bug reports, or
   even discuss interesting findings they've noticed."*  Søren: *"one forum for each jump."*''',
  u'''   Gary: *"a separate space where users can make suggestions for new features, log bug reports, or
   even discuss interesting findings they've noticed."*  Søren: *"one forum for each jump."* — and
   then, on 2026-10-13: *"I want one stream for all the tools... So, there is one discussion forum
   for all the tools."*  The chooser this file was written around is gone; what one shared stream
   has to get right instead — a post's coordinates belonging to the tool that wrote them — is
   forumonecheck.js, because it is a different subject and a longer one.'''),

 (u"the layout no longer counts chips",
  u'''             leftOf: !!(a && b2 && a.left < b2.left),
             chips: document.querySelectorAll("#forumCard .fscope").length,
             text: document.getElementById("forumCard").textContent };''',
  u'''             leftOf: !!(a && b2 && a.left < b2.left),
             text: document.getElementById("forumCard").textContent };'''),

 (u"...and asserts there is nothing above the index to choose",
  u'''  ok(layout.chips === 2, "two streams, as two chips rather than two stacked cards", layout.chips);
  ok(/This volume/.test(layout.text) && /The tools/.test(layout.text),
     "...named for what they are about");
  ok(/shared across every/i.test(layout.text) || /This volume/.test(layout.text),
     "...and the blurb belongs to the one you are looking at");''',
  u'''  ok(!/This volume|The tools|shared across every/i.test(layout.text),
     "...and there is nothing above it to choose between, nor a paragraph explaining the choice "
     + "— Søren, 2026-10-13: \\"let's leave out the choice between this volume and the tools. Also "
     + "remove the helper text.\\"",
     (layout.text.match(/This volume|The tools|shared across every/i) || ["nothing"])[0]);'''),

 (u"the two-stream section becomes the one-stream one",
  u'''  console.log("\\nthe two streams are separate indexes");
  const scoped = await p.evaluate(() => {
    UJ.forum._set([
      { postId: "v1", scope: "volume", kind: "finding", title: "In the data", body: "x",
        authorName: "A", timestamp: "2026-10-01T00:00:00Z", replyTo: "", isMine: false },
      { postId: "t1", scope: "tools", kind: "bug", title: "In the pad", body: "y", tool: "wjump",
        authorName: "B", timestamp: "2026-10-01T00:00:00Z", replyTo: "", isMine: false }
    ], false);
    UJ.forum._scope("volume"); UJ.forum.render();
    const vol = [].slice.call(document.querySelectorAll("#forumCard .fthread"))
                  .map(x => x.dataset.pid);
    document.querySelector("#forumCard .fscope[data-scope='tools']").click();
    const tools = [].slice.call(document.querySelectorAll("#forumCard .fthread"))
                    .map(x => x.dataset.pid);
    return { vol: vol, tools: tools,
             says: document.getElementById("forumCard").textContent };
  });
  ok(scoped.vol.join(",") === "v1", "this volume's index holds only its own", scoped.vol.join(","));
  ok(scoped.tools.join(",") === "t1", "...and the tools index only the tools' ones",
     scoped.tools.join(","));
  ok(/wjump/.test(scoped.says),
     "...which still say which tool they were written from, read from any Jump");''',
  u'''  /* WHAT THE SCOPE MEANS NOW. It says which BOOK a row lives in, which is the backend's
     business; it was never a thing a reader should have had to pick before seeing anything. Both
     kinds of row are listed together, and the badge is what says where a post came from. */
  console.log("\\nboth books' posts are one index");
  const scoped = await p.evaluate(() => {
    UJ.forum._set([
      { postId: "v1", scope: "volume", kind: "finding", title: "In the data", body: "x",
        tool: "ujump", authorName: "A", timestamp: "2026-10-01T00:00:00Z", replyTo: "",
        isMine: false },
      { postId: "t1", scope: "tools", kind: "bug", title: "In the pad", body: "y", tool: "wjump",
        authorName: "B", timestamp: "2026-10-01T00:00:00Z", replyTo: "", isMine: false }
    ], false);
    UJ.forum.render();
    [].slice.call(document.querySelectorAll("#forumCard details")).forEach(d => { d.open = true; });
    return { pids: [].slice.call(document.querySelectorAll("#forumCard .fthread"))
                      .map(x => x.dataset.pid).sort(),
             says: document.getElementById("forumCard").textContent };
  });
  ok(scoped.pids.join(",") === "t1,v1",
     "a post written to this dataset's book and one written to the shared one are listed in the "
     + "same index", scoped.pids.join(","));
  ok(/ωJump/.test(scoped.says),
     "...each saying which tool it was written from, read from any Jump",
     (scoped.says.match(/[µδπλημωχ]Jump/g) || ["none"]).join(" "));'''),

 (u"the grouped-threads fixture does not pick a stream",
  u'''    UJ.forum._scope("volume"); UJ.forum.render();
    const cats = [].slice.call(document.querySelectorAll("#forumCard .fcat"));''',
  u'''    UJ.forum.render();
    const cats = [].slice.call(document.querySelectorAll("#forumCard .fcat"));'''),

 (u"and neither does the sign-in one",
  u'''    UJ.forum._set([], false);
    /* BACK TO THE VOLUME STREAM. The section above left the panel on "The tools", and the compose
       box is named for the stream it is in -- so without this these assertions would be about
       forum_tools_* while looking for forum_volume_*. */
    UJ.forum._scope("volume");
    UJ.forum._new();''',
  u'''    UJ.forum._set([], false);
    UJ.forum._new();'''),

 # AND THIS ONE IS ANCHORED ON THE LINE BEFORE IT. Its `new` would otherwise be exactly the two
 # lines the edit above produces, so the guard would match text a previous pair wrote and the edit
 # would be skipped in silence -- the insert-then-edit trap in its other direction. Anchored on the
 # credential rather than on an element id, because the ids are renamed further down this file and
 # an anchor that moves with another edit is the same trap once more.
 (u"...nor the one that posts",
  u'''GOOGLE_CREDENTIAL = "tok";
    UJ.forum._set([], false);
    UJ.forum._scope("volume");
    UJ.forum._new();''',
  u'''GOOGLE_CREDENTIAL = "tok";
    UJ.forum._set([], false);
    UJ.forum._new();'''),

 (u"and a post goes to the shared stream",
  u'''  ok(d.scope === "volume", "...in the stream it was written in", d.scope);''',
  u'''  ok(d.scope === "tools",
     "...in the ONE stream: forumSS_(\\"tools\\") is the primary book and every deployment's read "
     + "takes its rows, so a post written here is read from every Jump", d.scope);'''),
])

# THE ONE FORM, RENAMED. There is one compose box rather than one per stream, so the ids it builds
# are forum_thread_*. Counted rather than replaced blind: a rename that silently hits nothing
# leaves a check looking for elements that no longer exist, which reads as a broken feature.
_C = os.path.join(HERE, "forumcheck.js")
_cs = io.open(_C, encoding="utf-8").read()
if u"forum_volume" in _cs:
    _n = _cs.count(u"forum_volume")
    # Thirteen: the fourteenth was inside the comment the sign-in edit above removed.
    assert _n == 13, "%d forum_volume ids in forumcheck.js, expected 13" % _n
    io.open(_C, "w", encoding="utf-8").write(_cs.replace(u"forum_volume", u"forum_thread"))
    print("forumcheck.js\n  ok: the compose box's id is forum_thread, in %d places" % _n)
else:
    print("forumcheck.js\n  already there: the compose box's id is forum_thread")

# ── guards ───────────────────────────────────────────────────────────────────────────────────
_C2 = io.open(_C, encoding="utf-8").read()
for _gone in [u"_scope(", u".fscope", u"forum_volume", u"forum_tools"]:
    assert _gone not in _C2, "%s survives in forumcheck.js" % _gone

_F = io.open(os.path.join(HERE, "core/forum.js"), encoding="utf-8").read()
for _gone, _why in [(u"fscope", u"the chooser's class"),
                    (u"SCOPE =", u"the stream filter"),
                    (u"SCOPE ===", u"a branch on the stream filter"),
                    (u"+ SCOPE", u"a form id built from the stream filter"),
                    (u"roots(SCOPE)", u"the index asking for one stream"),
                    (u"This volume", u"the chip label"),
                    (u"Shared across every", u"the helper text")]:
    assert _gone not in _F, "%s survives in core/forum.js (%s)" % (_gone, _why)
for _what, _n in [(u"function roots(){", 1), (u"function toolBadge(p){", 1),
                  (u"function linkOpts(tool){", 1), (u"function foreign(tool){", 1),
                  (u"var STREAM = \"tools\";", 1),
                  # one definition and two call sites: the index row and the post's byline
                  (u"toolBadge(p)", 3),
                  (u"composer(\"forum_thread\"", 1),
                  (u"if (VOLUME) body.volume = VOLUME;", 1)]:
    assert _F.count(_what) == _n, "%d of %r in core/forum.js, wanted %d" % (
        _F.count(_what), _what, _n)
# EVERY READ OF A BODY CARRIES ITS TOOL. The one failure this change can introduce is a call site
# left scanning a foreign post against the reader, which looks right and links to the wrong place.
import re as _re
for _call in _re.findall(r"(?:hits|bodyHtml)\([^)]*\)", _F):
    if "dataset.raw" in _call or "p.body" in _call:
        assert "tool" in _call, "a body is read without its tool: %r" % _call
assert _F.count(u"data-tool=") == 1, "the body does not carry its tool"

_J = io.open(os.path.join(HERE, "core/jumplink.js"), encoding="utf-8").read()
assert _J.count(u"function scan(text, opts){") == 1
# html()'s scan, and wire()'s -- plus the definition, which the second pattern also matches.
assert _J.count(u"scan(s, o)") == 1 and _J.count(u"scan(text, opts)") == 2
assert _J.count(u"var host = o.host || hostOf();") == 1
# ...AND THE DEFAULT IS STILL THE READER'S PAGE, which every other caller in the family relies on:
# three fallbacks, one per entry point, and the one definition they fall back to.
for _fb in [u"var host = (opts && opts.host) ? opts.host : hostOf();",
            u"var host = o.host || hostOf();",
            u"function hostOf(){"]:
    assert _J.count(_fb) >= 1, "the default path moved: %r" % _fb
assert _J.count(u"? opts.host : hostOf();") == 2, \
    "%d of scan()/url()'s fallback -- one of them stopped falling back" % _J.count(
        u"? opts.host : hostOf();")

_U = io.open(os.path.join(HERE, "ujump.html"), encoding="utf-8").read()
assert _U.count(u'<script src="core/tools.js"></script>') == 1
assert _U.index(u'core/tools.js') < _U.index(u'<script src="core/forum.js">')
print("done")
print("all applied")
