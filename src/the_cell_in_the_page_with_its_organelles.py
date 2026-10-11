# -*- coding: utf-8 -*-
"""The cell in the page, with the organelles somebody drew.                         2026-10-11

Søren, pointing at the ROOT ID row of a µJump cell card: *"If organelles are traced, here should
also be a show in 3D with organelles button."*

There has been a button for this since 2026-10-07 — but it is in the Organelles section further
down, and it opens NEUROGLANCER. The row he is pointing at is the one with "Show in 3D", which
draws the cell in the page without leaving it. Those are different things and he wants the second.

WHO KNOWS WHAT. core/mesh3d.js knows where that row is, what the tool's buttons look like, and how
to draw a cell with things inside it — `ghosts` has existed since September and the pad's 3D
preview already draws lofted contours inside a see-through cell. What it does not know, and should
not, is what anybody has traced; core/panel.js knows that, because it builds the Organelles list.

So the page OFFERS. panel.js says "this root has N traced organelles, and here is how to get them
with their contours"; mesh3d.js decides where the button goes, what it says, and what the click
does. Neither learns the other's job, and the offer is keyed by ROOT ID, because the card is
rebuilt for every cell and a button left over from the last one would promise organelles belonging
to somebody else.

THE COUNT IS FREE, THE CONTOURS ARE NOT. The ?tracings=1 index carries no contours — that is what
makes listing cheap — so the button can appear immediately on a count, and the contours are
fetched on the click, which is where every other fetch on this card happens. organFetchRings()
already does that fetch and caches it; it was fire-and-forget, because its job was to re-render
when it landed. It now ALSO returns a promise, so a caller that must wait can, without a second
copy of the request.

WHAT IS DRAWN: the published cell mesh as the subject, see-through; the nucleus mesh in blue, as
"Show in 3D" already does; and every traced structure on the cell lofted in the colour it was
drawn in — organelles, and the whole cell and nucleus if he outlined those too. His own outline of
the cell is NOT a reason to drop the published one here, unlike in the download: in the pane the
published mesh is the subject, and seeing the two together is how you tell whether the tracing
agrees with the segmentation.

Changes: core/mesh3d.js   (offerTraced, the second button, one shared click)
         core/panel.js    (the offer; organFetchRings returns a promise)
Check:   organallcheck.js (new section: the offer, the button, and what it draws)
Run: python3 src/the_cell_in_the_page_with_its_organelles.py
     python3 src/build_stamps.py
     node organallcheck.js
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


# ── 1. core/mesh3d.js: the offer, the button, and one click for both ──────────────────────────
edit("core/mesh3d.js", [
    (u"the registry of offers, and the way a page makes one",
     u'''  function install(opts){
    var o = opts || {};''',
     u'''  /* ── THE CELL WITH THE ORGANELLES SOMEBODY DREW ─────────────────────────────  2026-10-11
     Søren, pointing at the ROOT ID row: *"If organelles are traced, here should also be a show in
     3D with organelles button."*

     This module knows where that row is and how to draw a cell with things inside it. It has no
     idea what anybody has traced, and should not: core/panel.js builds the Organelles list and
     knows exactly that. So the page OFFERS — a count, and a way to get the contours — and this
     decides where the button goes, what it says and what the click does.

     KEYED BY ROOT ID, because the card is rebuilt for every cell and an offer left over from the
     last one would promise organelles belonging to somebody else. Offering null withdraws it. */
  var TRACED = {}, TRACED_SYNC = [];
  function offerTraced(root, offer){
    root = String(root || "");
    if (!root) return;
    if (offer && offer.n > 0) TRACED[root] = offer; else delete TRACED[root];
    TRACED_SYNC.forEach(function(f){ try { f(); } catch (_e){} });
  }

  function install(opts){
    var o = opts || {};'''),

    (u"a second button beside the first, hidden until there is an offer",
     u'''      var btn = buttonFor(root, dl);
      var host = document.createElement("div");''',
     u'''      var btn = buttonFor(root, dl);
      /* Its own button rather than a tick on the first: looking at the cell alone is the cheap
         thing, and the organelles cost a second round of fetches. Hidden until panel.js offers,
         so it is never a button for a cell that has nothing to put in it. */
      var btn2 = buttonFor(root, dl);
      btn2.style.display = "none";
      btn2.title = "Draw this cell in the page with every outline traced on it, each in the "
                 + "colour it was drawn in, inside the see-through cell.";
      var host = document.createElement("div");'''),

    (u"...placed next to it, and kept in step with the tool's own judgement",
     u'''      dl.parentNode.insertBefore(btn, dl);''',
     u'''      dl.parentNode.insertBefore(btn, dl);
      dl.parentNode.insertBefore(btn2, dl);'''),

    (u"...so it hides when the first one does, and when the offer is withdrawn",
     u'''      function mirror(){
        btn.disabled = !!dl.disabled;
        var d = dl.style ? dl.style.display : "";
        if (btn.style.display !== d) btn.style.display = d;
        if (host.style.display !== d) host.style.display = d;
      }
      mirror();''',
     u'''      function syncTraced(){
        var t = TRACED[root];
        var d = dl.style ? dl.style.display : "";
        btn2.disabled = !!dl.disabled;
        btn2.style.display = (t && d !== "none") ? d : "none";
        if (t) btn2.textContent = "Show in 3D with " + t.n + " organelle"
                                + (t.n === 1 ? "" : "s");
      }
      function mirror(){
        btn.disabled = !!dl.disabled;
        var d = dl.style ? dl.style.display : "";
        if (btn.style.display !== d) btn.style.display = d;
        if (host.style.display !== d) host.style.display = d;
        syncTraced();
      }
      TRACED_SYNC.push(syncTraced);
      mirror();'''),

    (u"one click for both buttons, differing in one argument",
     u'''      btn.addEventListener("click", function(){
        if (btn.disabled) return;
        btn.disabled = true;
        var label = btn.textContent;
        btn.textContent = "loading…";''',
     u'''      /* ONE HANDLER, ONE ARGUMENT. The whole of the difference between the two buttons is
         whether the traced outlines go in, and everything else — the mesh, the nucleus, the
         simplified and skipped notes, the verdict, the file name — is the same work. Two
         handlers would be two chances for the plain view and the organelle view to disagree
         about what cell they are showing. */
      var runShow = function(btn, withTraced){
        if (btn.disabled) return;
        btn.disabled = true;
        var label = btn.textContent;
        btn.textContent = "loading…";'''),

    (u"...and the traced outlines go in as ghosts, each in its own colour",
     u'''            show(host, geo, opts2);
          });
        }).catch(function(e){
          host.innerHTML = "<div class='m3d'><div class='m3d-err'>Could not load the mesh: "
            + esc(e && e.message ? e.message : e) + "</div></div>";
        }).then(function(){ btn.disabled = false; btn.textContent = label; });
      });
    }''',
     u'''            if (!withTraced){ show(host, geo, opts2); return; }
            /* IN THE CELL'S FRAME, like the nucleus above and for the same reason: a loft
               centred on itself lands in the middle of the picture rather than where it is in
               the cell, which looks right and is a lie. */
            var offer = TRACED[root];
            btn.textContent = "reading outlines…";
            return Promise.resolve(offer && offer.get ? offer.get() : []).then(function(list){
              var res = (window.UJ && UJ.cfg && UJ.cfg.res) || [4, 4, 40];
              var gh = (opts2.ghosts || []).slice(), drawn = 0, lost = 0;
              (list || []).forEach(function(s){
                var lg = null;
                try {
                  if (s && (s.rings || []).length && window.UJ && UJ.traceloft)
                    lg = UJ.traceloft.loft(s.rings, res);
                } catch (_e){ lg = null; }
                if (!lg || !lg.positions || !lg.positions.length){ lost++; return; }
                var tg = prepare(lg.positions, lg.indices,
                                 { unitNm: 1, frame: { mid: geo.mid, span: geo.span } });
                if (tg.empty){ lost++; return; }
                gh.push({ geo: tg, what: "tracing", alpha: 1,
                          tint: hexToRgb(s.color, [0.25, 0.89, 0.55]) });
                drawn++;
              });
              opts2.ghosts = gh;
              /* See-through only now that there is something inside to see \\u2014 the same rule
                 the nucleus branch above follows, and for its reason. */
              if (drawn) opts2.alpha = CELL_ALPHA_WITH_NUCLEUS;
              opts2.lead = (opts2.lead ? opts2.lead + "<br>" : "")
                + "<span class='hint'>" + (drawn ? drawn + " traced outline"
                    + (drawn === 1 ? " is" : "s are") + " drawn inside it, each in the colour it "
                    + "was drawn in" : "No traced outline could be drawn")
                + (lost ? "; " + lost + " could not be read" : "") + ".</span>";
              show(host, geo, opts2);
            });
          });
        }).catch(function(e){
          host.innerHTML = "<div class='m3d'><div class='m3d-err'>Could not load the mesh: "
            + esc(e && e.message ? e.message : e) + "</div></div>";
        }).then(function(){ btn.disabled = false; btn.textContent = label; });
      };
      btn.addEventListener("click", function(){ runShow(btn, false); });
      btn2.addEventListener("click", function(){ runShow(btn2, true); });
    }'''),

    (u"offerTraced is exported",
     u'''  return { prepare: prepare, draw: draw, show: show, install: install, probe: probe,''',
     u'''  return { prepare: prepare, draw: draw, show: show, install: install, probe: probe,
           offerTraced: offerTraced,'''),
])
_M = os.path.join(HERE, "core/mesh3d.js")
_m = io.open(_M, encoding="utf-8").read()
for _what, _n in [(u"function offerTraced(root, offer){", 1), (u"var runShow = function(btn,", 1),
                  (u"offerTraced: offerTraced,", 1), (u"function syncTraced(){", 1),
                  (u"TRACED_SYNC.push(syncTraced)", 1),
                  (u'btn2.addEventListener("click"', 1),
                  (u'btn.addEventListener("click"', 1)]:
    assert _m.count(_what) == _n, "core/mesh3d.js has %d of %s, wanted %d" % (
        _m.count(_what), _what, _n)
# The handler must be DEFINED before the two listeners that call it.
assert _m.index(u"var runShow = function(btn,") < _m.index(u'btn.addEventListener("click"'), \
    "core/mesh3d.js wires the buttons before the handler exists"
print("done 1")

# ── 2. core/panel.js: organFetchRings becomes awaitable, and the offer is made ────────────────
edit("core/panel.js", [
    (u"organFetchRings hands back a promise as well as re-rendering",
     u'''function organFetchRings(nid, root, trs){
  if (PANEL_ORGAN_BUSY || typeof REPORT_ENDPOINT === "undefined" || !REPORT_ENDPOINT) return;
  var want = trs.filter(function(t){
    return t && t.structureId && !t.rings && !PANEL_ORGAN_RINGS[t.structureId];
  });
  if (!want.length) return;
  PANEL_ORGAN_BUSY = true;
  var left = want.length;
  var done = function(){
    if (--left > 0) return;
    PANEL_ORGAN_BUSY = false;''',
     u'''/* AND IT HANDS BACK A PROMISE.  2026-10-11. Its job was to re-render when the contours landed,
   so it was fire-and-forget and returned nothing. The "Show in 3D with organelles" button has to
   WAIT for the same contours, and a second copy of this request is the duplication this project
   keeps paying for — so the one request now also tells whoever asks when it is done. The pending
   promise is kept, so a caller arriving mid-flight waits for the flight rather than being told
   there is nothing to wait for. */
var PANEL_ORGAN_WAIT = null;
function organFetchRings(nid, root, trs){
  if (typeof REPORT_ENDPOINT === "undefined" || !REPORT_ENDPOINT) return Promise.resolve();
  if (PANEL_ORGAN_BUSY) return PANEL_ORGAN_WAIT || Promise.resolve();
  var want = trs.filter(function(t){
    return t && t.structureId && !t.rings && !PANEL_ORGAN_RINGS[t.structureId];
  });
  if (!want.length) return Promise.resolve();
  PANEL_ORGAN_BUSY = true;
  var settle = null;
  PANEL_ORGAN_WAIT = new Promise(function(r){ settle = r; });
  var left = want.length;
  var done = function(){
    if (--left > 0) return;
    PANEL_ORGAN_BUSY = false;
    PANEL_ORGAN_WAIT = null;
    if (settle) settle();'''),

    (u"...on both of its paths",
     u'''      .then(function(){ left = 1; done(); });
    return;
  }''',
     u'''      .then(function(){ left = 1; done(); });
    return PANEL_ORGAN_WAIT;
  }'''),

    (u"the offer, from the section that knows what is traced",
     u'''  var r = UJ.organellelink.pair(anns, withRings);''',
     u'''  /* ── AND THE SAME PICTURE WITHOUT LEAVING THE PAGE ──────────────────────────  2026-10-11
     Søren, pointing at the ROOT ID row: *"If organelles are traced, here should also be a show in
     3D with organelles button."* The button below this list opens Neuroglancer; that row draws
     the cell in the page. This section is the one place that knows what is traced on this cell,
     so it OFFERS and core/mesh3d.js decides where the button goes and what it looks like.

     The COUNT comes from the index, which carries no contours and is therefore free; the contours
     are fetched on the click by the same organFetchRings() the list uses, which now hands back a
     promise so the click can wait for it. */
  if (window.UJ && UJ.mesh3d && typeof UJ.mesh3d.offerTraced === "function")
    UJ.mesh3d.offerTraced(root, trs.length ? { n: trs.length, get: function(){
      return Promise.resolve(organFetchRings(nid, root, trs.concat(body))).then(function(){
        trs.forEach(fromCache); body.forEach(fromCache);
        /* The cell and its nucleus first, so the outermost outlines are read first, exactly as
           the Blender export orders them. */
        return body.filter(function(t){ return t.rings && t.rings.length; })
          .concat(trs.filter(function(t){ return t.rings && t.rings.length; }));
      });
    } } : null);

  var r = UJ.organellelink.pair(anns, withRings);'''),
])
_P = os.path.join(HERE, "core/panel.js")
_p = io.open(_P, encoding="utf-8").read()
for _what, _n in [(u"UJ.mesh3d.offerTraced(root,", 1), (u"var PANEL_ORGAN_WAIT = null;", 1),
                  (u"function organFetchRings(nid, root, trs){", 1),
                  (u"return PANEL_ORGAN_WAIT;", 1)]:
    assert _p.count(_what) == _n, "core/panel.js has %d of %s, wanted %d" % (
        _p.count(_what), _what, _n)
# The offer must come AFTER fromCache has run over trs/body, or it closes over unread rings.
_sec = _p.split(u"function renderOrganelleSection")[1][:4000]
assert _sec.index(u"body.forEach(fromCache);") < _sec.index(u"UJ.mesh3d.offerTraced(root,"), \
    "core/panel.js offers before it has filled the rings cache"
print("done 2")

# ── 3. the check ──────────────────────────────────────────────────────────────────────────────
# GUARDED ON A SIGNATURE rather than on the whole block: edit()'s `if new in s` compares the entire
# inserted text, so the first time anything edits an assertion inside it -- which happened here,
# strengthening one that passed vacuously -- the guard stops matching and a second copy goes in.
CHK = r'''  /* ── AND THE SAME PICTURE WITHOUT LEAVING THE PAGE ────────────────────────────  2026-10-11
     Søren, pointing at the ROOT ID row: *"If organelles are traced, here should also be a show in
     3D with organelles button."* The button above opens Neuroglancer; that row draws the cell in
     the page. core/panel.js knows WHAT is traced, core/mesh3d.js knows where that row is and how
     to draw a cell with things inside it, and the offer is the join between them.

     WHAT IS ASSERTED:
       - the button appears beside "Show in 3D", labelled with the count
       - ...and does NOT when the cell has no traced organelles, because an offer is withdrawn
         as well as made — the card is rebuilt per cell and a stale button would promise
         organelles belonging to the last one
       - pressing it LOFTS every traced outline, which is the difference between drawing them and
         saying it did
       - ...and the panel says how many went in, under the size line where the rest of the
         caveats are
       - organFetchRings() hands back a promise that resolves, which is what lets the click wait
         for the contours instead of racing them */
  console.log("\nand the ROOT ID row offers the same picture in the page");
  {
    const row = await p.evaluate(async () => {
      /* A row shaped like µJump's own: the observer in core/mesh3d.js decorates any
         .meshdl[data-root] that appears. */
      var old = document.getElementById("m3drow"); if (old) old.remove();
      document.body.insertAdjacentHTML("beforeend",
        '<div id="m3drow"><button class="idbtn meshdl" data-root="864691136741958236" '
        + 'data-nucid="521491">3D model</button></div>');
      await new Promise(r => setTimeout(r, 300));
      var r0 = document.getElementById("m3drow");
      return { decorated: !!r0.querySelector(".m3d-btn"),
               buttons: [].slice.call(r0.querySelectorAll("button"))
                 .map(b => b.textContent.trim() + (b.style.display === "none" ? " [hidden]" : "")) };
    });
    ok(row.decorated, "core/mesh3d.js decorated the row, as it always has",
       row.buttons.join(" | "));

    await setup(3);
    const off = await p.evaluate(() => {
      var b2 = [].slice.call(document.querySelectorAll("#m3drow .m3d-btn"))
        .filter(b => /organelle/.test(b.textContent))[0];
      return { there: !!b2, label: b2 ? b2.textContent.trim() : "",
               shown: !!(b2 && b2.style.display !== "none") };
    });
    ok(off.there && off.shown, "a second button appears once the cell has traced organelles",
       off.label || "no button");
    ok(/^Show in 3D with 3 organelles$/.test(off.label),
       "...labelled with how many, so it promises a number before the fetch rather than after",
       off.label);

    /* WITHDRAWN AS WELL AS MADE. A card rebuilt for a cell with nothing traced must not keep the
       last cell's button — the offer is keyed by root id for exactly this. */
    const gone = await p.evaluate(() => {
      PANEL_TRACINGS = [];
      PANEL_ORGAN_ANNS = [{ kind: "lysosome", point: [1000, 1000, 100] }];
      PANEL_ORGAN_NID = "521491";
      renderOrganelleSection("521491", "864691136741958236");
      var b2 = [].slice.call(document.querySelectorAll("#m3drow .m3d-btn"))
        .filter(b => /organelle/.test(b.textContent))[0];
      return !!(b2 && b2.style.display !== "none");
    });
    /* BOTH HALVES, or this passes vacuously on a build with no button at all — which it did,
       on the first red run. "It is not there now" is only news if it was there before. */
    ok(off.there && !gone,
       "...and goes away again for a cell with none, because the offer is withdrawn too",
       off.there ? (gone ? "still there" : "was there, now hidden") : "never appeared");

    await setup(3);
    const drew = await p.evaluate(async () => {
      /* Nothing leaves the harness: the cell mesh and the nucleus are stubs, and the LOFT is the
         real one, counted — a button that drew nothing would still have said "3 outlines". */
      var lofted = [];
      window.UJ.mesh = window.UJ.mesh || {};
      UJ.mesh.fetchCombinedMesh = async function(){
        return { positions: new Float32Array([0,0,0, 4000,0,0, 0,4000,0, 0,0,4000]),
                 indices: new Uint32Array([0,1,2, 0,1,3, 0,2,3, 1,2,3]) };
      };
      window.UJ.nucmesh = { configured: () => true, configure: () => {},
        fetchNucleus: async () => null };
      var realLoft = UJ.traceloft.loft;
      UJ.traceloft.loft = function(rings, res){
        lofted.push((rings || []).length);
        return realLoft.call(UJ.traceloft, rings, res);
      };
      var b2 = [].slice.call(document.querySelectorAll("#m3drow .m3d-btn"))
        .filter(b => /organelle/.test(b.textContent))[0];
      if (!b2) return { none: true };
      b2.click();
      var t0 = Date.now(), note = "";
      while (Date.now() - t0 < 9000){
        var n = document.querySelector("#m3drow ~ .m3d-host .m3d-note, .m3d-host .m3d-note");
        note = n ? n.textContent : "";
        if (/traced outline/.test(note)) break;
        await new Promise(r => setTimeout(r, 100));
      }
      UJ.traceloft.loft = realLoft;
      return { lofted: lofted, note: note,
               canvas: !!document.querySelector(".m3d-host .m3d-canvas") };
    });
    if (drew.none) ok(false, "the organelle button was there to press", "it was not");
    else {
      ok((drew.lofted || []).length === 3,
         "pressing it LOFTS every traced outline — the difference between drawing them and "
         + "saying it did", (drew.lofted || []).length + " lofts");
      ok(/3 traced outlines are drawn inside it/.test(drew.note),
         "...and the panel says how many went in, under the size line with the rest of the "
         + "caveats", (drew.note || "").slice(-110) || "nothing said");
      ok(drew.canvas, "...with something actually drawn", String(drew.canvas));
    }

    const waited = await p.evaluate(async () => {
      /* The click can only wait for the contours if the fetch says when it is done. */
      var r = organFetchRings("521491", "864691136741958236", []);
      return !!(r && typeof r.then === "function") && (await r, true);
    });
    ok(waited, "organFetchRings hands back a promise that resolves, which is what lets the click "
       + "wait for the contours instead of racing them", String(waited));
  }

'''
OLD = '  ok(errors.length === 0, "the page still loads with no new errors",'
_G = os.path.join(HERE, "organallcheck.js")
if u"the ROOT ID row offers the same picture in the page" in io.open(_G, encoding="utf-8").read():
    print("organallcheck.js\n  already there: the ROOT ID row's own button")
else:
    edit("organallcheck.js", [(u"the ROOT ID row's own button", OLD, CHK + OLD)])
_g = io.open(_G, encoding="utf-8").read()
assert _g.count(u"and the ROOT ID row offers the same picture in the page") == 1, \
    "organallcheck.js has two of the new block"
print("done 3")
print("all applied")
