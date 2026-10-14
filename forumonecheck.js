/* One discussion for every tool.                                                    2026-10-13

   Søren: *"I want one stream for all the tools (when we implement it) the post should always be
   marked with the tool you are writing from and with the color code of the tool. So, there is one
   discussion forum for all the tools. ... You should be able to share a coordinate from xJump in a
   conversation with one from uJump to show an example from your dataset and then the person from
   uJump can show an example from there."*  And, of the chooser and the blurb above the index:
   *"For now, let's leave out the choice between this volume and the tools. Also remove the helper
   text."*

   WHAT THIS FILE IS ABOUT, and it is not the chips. Removing them is two lines. One shared stream
   means each page now renders coordinates written in a frame it does not use, and core/jumplink.js
   resolves a triple against window.jumpLinkHost() — THE READER'S PAGE. That was right when there
   was a forum per tool. It is a way to publish a claim nobody made once there is one:

     δJump's own volume centre is 109743, 79665, 8811 in V1DD's 9×9×45 nm frame. Read in µJump's
     4×4×40 frame those same three numbers are 438,972 / 318,660 / 352,440 nm, which is INSIDE
     minnie35. So a post written in δJump, read in µJump, used to linkify to a place in mouse
     visual cortex that the author never mentioned — and the link would have looked perfectly
     ordinary. toolscheck.js counts eight such pairs across the family.

   So the assertions here are, in order of what matters:
     1. a post's places resolve against ITS OWN tool, and the link opens THAT volume's imagery
     2. a post from a tool with no verified box linkifies nothing, rather than linkifying wrongly
     3. clicking a foreign coordinate does not draw this page's tissue under it
     4. every post and every index row says which tool it came from, in that tool's colour
     5. a new post is tagged for the shared stream, so every Jump reads it
     6. and the chooser and the helper text are gone

   Run: node forumonecheck.js [page.html]      (default ujump.html) */
const { chromium } = require("playwright");
const page_ = require("./pagepath.js");
const PAGE = process.argv[2] || "ujump.html";
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

/* The centre of V1DD, in V1DD's voxels. See the header: in µJump's frame this is inside minnie35,
   which is what makes it the right coordinate to test with rather than a safe one. */
const DJ = [109743, 79665, 8811];

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  p.on("pageerror", e => { if (!/atob/.test(e.message)) errors.push(e.message); });
  /* The backend answers with an empty forum, so init() runs to the end and TOOL is set from the
     page's own init({tool:"ujump"}) — which is what `foreign()` compares against, and therefore
     what every assertion below depends on. A check that drove the panel without opening the tab
     would be testing a module that does not yet know which tool it is in. */
  const posts = [];
  /* THE CATCH-ALL IS REGISTERED FIRST ON PURPOSE. Playwright checks the most recently added
     handler first, so a catch-all added last would swallow the backend stub below and send the
     forum's own requests at the real network — which fails as a tunnel error and looks exactly
     like a bug in the module. */
  await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.route("**script.google.com/**", async r => {
    if (r.request().method() === "POST"){
      posts.push(JSON.parse(r.request().postData() || "{}"));
      return r.fulfill({ status: 200, contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, postId: "new1" }) });
    }
    return r.fulfill({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, posts: [], canModerate: false, signedIn: false }) });
  });
  await p.goto("file://" + page_(PAGE));
  await p.waitForTimeout(3000);

  const have = await p.evaluate(() => ({
    forum: !!(window.UJ && UJ.forum), tools: !!(window.UJ && UJ.tools),
    card: !!document.getElementById("forumCard") }));
  if (!have.forum || !have.card){
    console.log(PAGE + ": no discussion panel here");
    await b.close(); console.log("\nall good"); process.exit(0);
  }
  ok(have.tools, "core/tools.js is loaded on the page that has the forum", String(have.tools));
  await p.click('#mainTabs .tabbtn[data-tab="forum"]');
  await p.waitForTimeout(900);

  /* ── 1. THE REGISTRY IS WHAT THE LINKIFIER IS HANDED ──────────────────────────────────────── */
  console.log("\na coordinate belongs to the tool that wrote it");
  const resolved = await p.evaluate(({ DJ }) => {
    const text = "the capillary at " + DJ.join(", ") + " is odd";
    const reader = (UJ.jumplink.scan(text) || [])[0] || null;
    const h = UJ.tools.hostFor("djump");
    const author = (UJ.jumplink.scan(text, { host: h }) || [])[0] || null;
    const url = UJ.jumplink.url(author ? [author] : [], { host: h });
    return { readerVol: reader ? reader.volume : "", authorVol: author ? author.volume : "",
             url: url || "", unboxed: UJ.tools.hostFor("wjump") };
  }, { DJ });
  ok(resolved.readerVol === "minnie35",
     "read against THIS page, δJump's volume centre is a place in minnie35 — the bug, demonstrated "
     + "rather than described", resolved.readerVol || "nowhere");
  ok(resolved.authorVol === "v1dd",
     "...and read against δJump's own volumes it is V1DD, which is what the author meant",
     resolved.authorVol || "nowhere");
  ok(/v1dd_imagery/.test(resolved.url) && !/minnie/.test(resolved.url),
     "...and the viewer link carries V1DD's imagery, not minnie65's — otherwise the link would "
     + "open the right coordinates over the wrong tissue",
     resolved.url ? resolved.url.slice(0, 120) : "no url");
  /* ωJump, since 2026-10-14: ηJump and βJump got their boxes out of emhjumpcheck.js and
     embjumpcheck.js, where the volumes' real shapes had been sitting since the tracing card was
     ported. ωJump keeps none, because one box for sixty-three volumes would be false for
     sixty-two of them — and the rule is unchanged, only the list of who it applies to. */
  ok(resolved.unboxed === null,
     "a tool with no verified extent is handed no host at all, so its coordinates stay as typed "
     + "text rather than resolving against the reader", String(resolved.unboxed));

  /* ── 2 & 4. WHAT THE PANEL DRAWS ──────────────────────────────────────────────────────────── */
  console.log("\none index, and every row says where it came from");
  const idx = await p.evaluate(({ DJ }) => {
    const body = "look at " + DJ.join(", ");
    UJ.forum._set([
      { postId: "v1", scope: "volume", kind: "finding", title: "In this volume", body: "x",
        tool: "ujump", authorName: "A", timestamp: "2026-10-10T00:00:00Z", replyTo: "" },
      { postId: "t1", scope: "tools", kind: "bug", title: "In the pad", body: "y",
        tool: "wjump", volume: "jrc_hela-2", authorName: "B",
        timestamp: "2026-10-11T00:00:00Z", replyTo: "" },
      { postId: "d1", scope: "tools", kind: "finding", title: "A V1DD capillary", body: body,
        tool: "djump", authorName: "C", timestamp: "2026-10-12T00:00:00Z", replyTo: "" },
      { postId: "h1", scope: "tools", kind: "finding", title: "From ωJump", body: body,
        tool: "wjump", volume: "jrc_mus-liver", authorName: "D",
        timestamp: "2026-10-13T00:00:00Z", replyTo: "" }
    ], false);
    UJ.forum.render();
    const host = document.getElementById("forumCard");
    [].slice.call(host.querySelectorAll("details")).forEach(d => { d.open = true; });
    const rows = [].slice.call(host.querySelectorAll(".fthread"));
    const badge = (el) => el ? el.className + "|" + el.textContent.trim() : "";
    const colourOf = (el) => el ? getComputedStyle(el).color : "";
    return {
      pids: rows.map(r => r.dataset.pid),
      chips: host.querySelectorAll(".fscope").length,
      text: host.textContent,
      badges: rows.map(r => badge(r.querySelector(".ftool"))),
      colours: rows.map(r => colourOf(r.querySelector(".ftool"))),
      wBadge: badge((rows.filter(r => r.dataset.pid === "t1")[0] || {})
                    .querySelector ? rows.filter(r => r.dataset.pid === "t1")[0]
                                         .querySelector(".ftool") : null)
    };
  }, { DJ });
  ok(idx.pids.length === 4,
     "all four threads are listed together, whichever stream they were written to — this is the "
     + "one forum", idx.pids.join(" ") || "none");
  ok(idx.chips === 0, "the This volume / The tools chooser is gone", idx.chips + " chips");
  ok(!/This volume|The tools/.test(idx.text) && !/shared across every/i.test(idx.text),
     "...and so is the helper text under it",
     (idx.text.match(/This volume|The tools|shared across every/) || ["none"])[0]);
  ok(idx.badges.every(s => /ftool-/.test(s)),
     "every row carries its tool's badge", idx.badges.join("  ") || "none");
  ok(/ωJump/.test(idx.badges.join(" ")) && /δJump/.test(idx.badges.join(" ")),
     "...named as the tool rather than as a sheet key", idx.badges.join("  "));
  ok(/jrc_hela-2/.test(idx.text),
     "...and ωJump's row says WHICH of its sixty-three volumes, because the tool alone does not "
     + "say what the post is about",
     (idx.text.match(/jrc_hela-2/) || ["not shown"])[0]);
  /* #b388ff is δJump's dark accent; the page loads dark by default. */
  const dj = idx.pids.indexOf("d1");
  ok(dj >= 0 && /179,\s*136,\s*255/.test(idx.colours[dj] || ""),
     "...in that tool's own colour, resolved by the browser so a theme toggle follows it",
     idx.colours[dj] || "no colour");

  /* ── 2b. AND IN THE THREAD ITSELF ─────────────────────────────────────────────────────────── */
  console.log("\nand the post's own places are the author's");
  const open = await p.evaluate(() => {
    UJ.forum._open("d1");
    const host = document.getElementById("forumCard");
    const body = host.querySelector(".forumbody");
    const a = body ? body.querySelector("a[data-jl]") : null;
    return { tool: body ? body.dataset.tool : "",
             title: a ? a.getAttribute("title") : "",
             links: body ? body.querySelectorAll("a[data-jl]").length : -1,
             badge: (host.querySelector(".forumpost .ftool") || {}).textContent || "" };
  });
  ok(open.links === 1, "the coordinate in the body is a link", String(open.links));
  ok(/V1DD|v1dd/.test(open.title),
     "...and it says it is a place in V1DD, which is the only way a reader can tell it is not "
     + "theirs", open.title || "no title");
  ok(/δJump/.test(open.badge), "...under a badge saying who wrote it", open.badge || "none");

  console.log("\nand a post from the one tool with no box linkifies nothing");
  const unboxed = await p.evaluate(() => {
    UJ.forum._open("h1");
    const body = document.querySelector("#forumCard .forumbody");
    return { links: body ? body.querySelectorAll("a[data-jl]").length : -1,
             text: body ? body.textContent.trim() : "" };
  });
  ok(unboxed.links === 0,
     "ωJump serves sixty-three volumes and the registry holds a box for none of them, so the "
     + "numbers in its posts stay numbers rather than becoming a link to minnie35",
     unboxed.links + " links");
  ok(/109743/.test(unboxed.text), "...and are still there to read and copy",
     unboxed.text.slice(0, 60));

  /* ── 3. CLICKING ONE DOES NOT DRAW THE WRONG TISSUE ───────────────────────────────────────── */
  /* ── CLICKING A FOREIGN COORDINATE DRAWS THE RIGHT TISSUE ───────────────  2026-10-13
     This section used to assert that NOTHING was drawn, and that was right while the only way to
     draw was with this page's own reader: a picture of minnie65 captioned with a V1DD coordinate
     is the worst of both. Søren then asked for the other half — *"I would also like that the
     dJump coordinate can open EM ... in uJump"* — so now it IS drawn, from δJump's own imagery,
     through core/emtiles.js's withConfig(). What is asserted is therefore not "nothing happened"
     but WHOSE VOLUME: the host handed to the preview must be V1DD's, never this page's. */
  console.log("\nclicking a foreign coordinate draws THAT tool's tissue, not this one's");
  const clicked = await p.evaluate(async () => {
    const seen = [];
    const real = UJ.empreview.open;
    /* Returns undefined on purpose: core/forum.js uses this return value, and a module that
       assumes a promise would throw rather than merely skip its caption. */
    UJ.empreview.open = function(el, pos, o){ seen.push(o && o.host ? o.host : null); };
    UJ.forum._open("d1");
    const host = document.getElementById("forumCard");
    const a = host.querySelector(".forumbody a[data-jl]");
    if (a) a.click();
    await new Promise(r => setTimeout(r, 250));
    const slot = host.querySelector(".forumprev");
    const out = { drew: seen.length, host: seen[0] || null,
                  html: slot ? slot.innerHTML : "",
                  href: (slot && slot.querySelector("a")) ? slot.querySelector("a").href : "" };
    UJ.empreview.open = real;
    return out;
  });
  ok(clicked.drew === 1, "the tissue IS drawn now", clicked.drew + " previews drawn");
  ok(!!clicked.host && /v1dd_imagery/.test(clicked.host.em || ""),
     "...from δJump's own imagery, which is the whole point — this page's reader is pointed at "
     + "minnie65 and is handed back afterwards",
     clicked.host ? (clicked.host.em || "").slice(0, 60) : "no host given");
  ok(!!clicked.host && clicked.host.foreign === true && clicked.host.own !== true,
     "...marked foreign, so core/empreview.js withholds the cell lookup and the two 3D buttons: "
     + "core/segpaint.js is a singleton too and the mesh store is this page's",
     clicked.host ? ("foreign " + clicked.host.foreign + ", own " + clicked.host.own) : "none");
  ok((clicked.host && (clicked.host.skipScales || []).indexOf("placeholder") >= 0),
     "...and carries V1DD's dead 4.85 nm scale, or every mip shifts by one and the preview reads "
     + "four times the pixels it meant to",
     clicked.host ? JSON.stringify(clicked.host.skipScales) : "none");
  ok(/V1DD|δJump/.test(clicked.html),
     "...with a line under it saying whose volume it is", clicked.html.slice(0, 160));
  ok(/v1dd_imagery/.test(decodeURIComponent(clicked.href || "")),
     "...and a link into that tool's own viewer",
     (clicked.href || "none").slice(0, 110));

  /* ── 5. A NEW POST GOES TO THE SHARED STREAM ──────────────────────────────────────────────── */
  console.log("\nand what you write goes where every Jump will read it");
  const sent = await p.evaluate(async () => {
    /* Bare assignments: these are `let` at the page's top level, so they live in the global
       lexical environment and window.GOOGLE_VERIFIED would be a different variable the module
       never reads. */
    GOOGLE_VERIFIED = true; GOOGLE_CREDENTIAL = "fake";
    UJ.forum._new();
    const ta = document.querySelector("#forumCard textarea");
    const id = ta ? ta.id.replace(/_body$/, "") : "";
    if (ta){ ta.value = "the pad forgets my colour"; }
    const go = document.getElementById(id + "_go");
    if (go) go.click();
    await new Promise(r => setTimeout(r, 600));
    return { id: id };
  });
  await p.waitForTimeout(400);
  sent.sent = posts.filter(x => x.type === "forum_post")[0] || null;
  ok(!!sent.sent, "the new-thread form posts", sent.id || "no form");
  ok(!!sent.sent && sent.sent.scope === "tools",
     "...tagged for the stream the backend keeps in the primary book, which every deployment "
     + "already reads — one shared forum needs no change to Code.gs",
     sent.sent ? String(sent.sent.scope) : "nothing sent");
  ok(!!sent.sent && sent.sent.tool === "ujump",
     "...stamped with the tool it was written from", sent.sent ? String(sent.sent.tool) : "");
  ok(!!sent.sent && sent.sent.volume === "minnie65",
     "...and with the volume open at the time, which is what ωJump needs and what the badge shows "
     + "once Code.gs keeps the column", sent.sent ? String(sent.sent.volume) : "");

  ok(errors.length === 0, "the page still loads with no new errors",
     errors.slice(0, 2).join(" | ") || "none");
  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
