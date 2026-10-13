/* The Discussion is on every tool, and each one is itself.                          2026-10-13

   Søren: *"I can see that the discussion exists in µJump but not in the other tools. Let's get it
   there so I can start testing whether it works."*

   forumcheck.js and forumonecheck.js are about µJump in depth. This one is about BREADTH, and it
   asks the questions that only have an answer once the same module is mounted on six pages:

     IT IS THERE AT ALL, and reads the forum saying which tool is asking — the `tool` column is
     what the badge, the colour and the whole cross-tool fix are keyed on, so a page that reports
     the wrong one poisons the sheet rather than failing.

     A POST FROM ANOTHER JUMP IS LISTED AND LABELLED, which is the point of one stream.

     ITS OWN COORDINATES STILL LINKIFY, which is the trap this change nearly shipped: no page but
     µJump defines window.jumpLinkHost(), so the linkifier had nothing to resolve against and
     every post's own places would have gone quiet. The registry answers instead.

     AND EVERY LINK DOES SOMETHING. The other trap, and the worse one: core/empreview.js is
     µJump's and ωJump's only, and wirePreviews() used to return before attaching any handler
     without it — so every link on five pages would have been an <a href="#"> that eats the click.
     A dead link reads as a broken page; a plain number does not.

     ηJump AND βJump LINKIFY NOTHING, on purpose: no verified extent in this repository, so their
     own coordinates stay as text rather than resolving against a box nobody checked.

   Run: node forumtabcheck.js [page.html ...]      (default: every page that should have one) */
const { chromium } = require("playwright");
const fs = require("fs");
const page_ = require("./pagepath.js");
const T = require("./core/tools.js");

let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

/* page, the tool key it must report, and a coordinate IN THAT TOOL'S OWN FRAME that its own
   volumes contain — the centre of the first box the registry holds for it, or null where it has
   none and nothing should link. */
const PAGES = (process.argv.length > 2 ? process.argv.slice(2)
  : ["ujump.html", "djump.html", "pjump.html", "ljump.html", "hjump.html", "bjump.html",
     "wjump.html", "xjump.html"]);
const TOOL_OF = { "ujump.html": "ujump", "djump.html": "djump", "pjump.html": "pjump",
                  "ljump.html": "ljump", "hjump.html": "hjump", "bjump.html": "bjump",
                  "wjump.html": "wjump", "xjump.html": "xjump" };

const centreVox = (key) => {
  const t = T.byKey(key);
  if (!t || !t.res || !(t.volumes || []).length) return null;
  const bb = t.volumes[0].bb;
  return ["x", "y", "z"].map((a, i) =>
    Math.round(((bb[a + "min"] + bb[a + "max"]) / 2) / t.res[i]));
};

/* A post written from a DIFFERENT tool that has a box, so "a foreign post is listed, labelled and
   resolved against its author" can be asked on every page including the ones with no box at all. */
const otherWithBox = (key) =>
  T.keys().filter(k => k !== key && T.boxed(k))[0];

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  for (const PAGE of PAGES){
    const key = TOOL_OF[PAGE] || PAGE.replace(/\.html$/, "");
    console.log("\n\n=== " + PAGE + "  (" + T.label(key) + ")");

    const src = fs.readFileSync(page_(PAGE), "utf8");
    /* NOT BY data-tab="forum", which core/forum.js's own header comment contains — and ωJump
       inlines that header, so every page in the family "has a tab" by that test. The foldable
       card is the thing only ωJump has. */
    const tabbed = !/id="forum-card"/.test(src);
    ok(/id="forumCard"/.test(src)
       && (tabbed ? /data-tabpanel="forum"/.test(src) : true),
       "the card core/forum.js fills is in the file, with "
       + (tabbed ? "a tab and a panel" : "a foldable card to open it"));
    /* ωJump inlines core/ rather than linking it — it ships as one file — so the order to assert
       there is the order the three modules' own headers appear in. */
    const at = (n) => src.indexOf(tabbed ? 'src="core/' + n + '"' : "core/" + n + " —");
    ok(at("jumplink.js") >= 0 && at("jumplink.js") < at("tools.js") && at("tools.js") < at("forum.js"),
       "...and the three modules come in the order they depend on each other",
       [at("jumplink.js"), at("tools.js"), at("forum.js")].join(" < "));

    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    const asked = [];
    p.on("pageerror", e => { if (!/atob/.test(e.message)) errors.push(e.message); });
    await p.route("**/*", r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.route("**script.google.com/**", async r => {
      const u = r.request().url();
      if (/forum=1/.test(u)) asked.push(u);
      return r.fulfill({ status: 200, contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, posts: [], canModerate: false, signedIn: false }) });
    });
    await p.goto("file://" + page_(PAGE));
    await p.waitForTimeout(2500);
    /* HOW THE DISCUSSION IS OPENED IS THE PAGE'S OWN SHAPE. Seven tools have a tab bar; ωJump is
       one scrolling column of cards and has never had one, so there it is a <details> that is
       opened. Either way the module is not asked for anything until somebody does it. */
    const opened = await p.evaluate(() => {
      const card = document.getElementById("forum-card");
      if (card){ card.open = true; card.dispatchEvent(new Event("toggle")); return "card"; }
      const btn = document.querySelector('#mainTabs .tabbtn[data-tab="forum"]');
      if (btn){ btn.click(); return "tab"; }
      return "";
    });
    ok(!!opened, "there is something to open the Discussion with", opened || "neither tab nor card");
    await p.waitForTimeout(900);

    ok(asked.length === 1, "opening the tab reads the forum, once", asked.length + " read(s)");
    ok(asked.length === 1 && new RegExp("tool=" + key + "(&|$)").test(asked[0]),
       "...saying it is " + T.label(key) + " asking — the column the badge, the colour and every "
       + "coordinate in every post are keyed on",
       (asked[0] || "").replace(/^.*\?/, "?").slice(0, 60));

    const mine = centreVox(key), other = otherWithBox(key), theirs = centreVox(other);
    const got = await p.evaluate(({ mine, other, theirs, key }) => {
      /* A tool with no box still gets NUMBERS in its post — another tool's, in fact — because
         "stays as text" is only an assertion when there is something that could have become a
         link. An empty body would pass it by saying nothing. */
      const say = (v) => "look at " + (v || theirs || [1, 2, 3]).join(", ");
      UJ.forum._set([
        { postId: "m1", scope: "tools", kind: "finding", title: "Mine", body: say(mine),
          tool: key, authorName: "A", timestamp: "2026-10-12T00:00:00Z", replyTo: "" },
        { postId: "o1", scope: "tools", kind: "bug", title: "Theirs", body: say(theirs),
          tool: other, authorName: "B", timestamp: "2026-10-13T00:00:00Z", replyTo: "" }
      ], false);
      UJ.forum.render();
      const host = document.getElementById("forumCard");
      [].slice.call(host.querySelectorAll("details")).forEach(d => { d.open = true; });
      const rows = [].slice.call(host.querySelectorAll(".fthread"));
      const badges = rows.map(r => (r.querySelector(".ftool") || {}).className || "");
      const read = (pid) => {
        UJ.forum._open(pid);
        const body = document.querySelector("#forumCard .forumbody");
        const a = body ? body.querySelector("a[data-jl]") : null;
        return { links: body ? body.querySelectorAll("a[data-jl]").length : -1,
                 title: a ? (a.getAttribute("title") || "") : "",
                 text: body ? body.textContent.trim() : "" };
      };
      const out = { pids: rows.map(r => r.dataset.pid).sort(), badges: badges,
                    chips: host.querySelectorAll(".fscope").length,
                    hasEmPreview: !!(window.UJ && UJ.empreview),
                    ownHost: typeof window.jumpLinkHost === "function",
                    own: read("m1"), foreign: read("o1") };
      /* ── AND THE LINK DOES SOMETHING ────────────────────────────────────────────────
         ON OUR OWN POST, because that is where the two answers live: drawing the tissue
         (UJ.empreview.open) where the page has a preview, opening the viewer (window.open) where
         it does not. Which of the two is the page's business; doing NOTHING is the bug this
         asserts against, and it is what every link on five pages would have done. */
      let opened = 0, drew = 0;
      const realOpen = window.open;
      window.open = function(){ opened++; return null; };
      const realDraw = (window.UJ && UJ.empreview) ? UJ.empreview.open : null;
      if (realDraw) UJ.empreview.open = function(){ drew++; };
      UJ.forum._open("m1");
      const ma = document.querySelector("#forumCard .forumbody a[data-jl]");
      if (ma) ma.click();
      window.open = realOpen;
      if (realDraw) UJ.empreview.open = realDraw;
      out.acted = opened + drew;
      /* A FOREIGN ONE DOES NEITHER, and that is the right answer: it writes the line offering
         that volume, with a link in it the reader chooses to follow. Opening a viewer under
         somebody's cursor because they clicked a word in a sentence would be a surprise. */
      UJ.forum._open("o1");
      const fa = document.querySelector("#forumCard .forumbody a[data-jl]");
      if (fa) fa.click();
      const line = document.querySelector("#forumCard .forumelsewhere");
      out.offered = !!line;
      out.offeredHref = (line && line.querySelector("a")) ? line.querySelector("a").href : "";
      return out;
    }, { mine, other, theirs, key });

    ok(got.chips === 0, "there is no stream chooser on this page either", got.chips + " chips");
    ok(got.pids.join(",") === "m1,o1",
       "a post from here and a post from " + T.label(other) + " are in the same index",
       got.pids.join(","));
    ok(got.badges.every(c => /ftool-/.test(c)) && got.badges.some(c => c.indexOf(other) >= 0),
       "...each badged with the tool that wrote it, " + T.label(other) + "'s included",
       got.badges.join("  ") || "none");

    if (mine){
      ok(got.own.links === 1,
         "this page's OWN coordinate is a link"
         + (got.ownHost ? "" : " — and this page declares no jumpLinkHost(), so that link exists "
                               + "only because the forum falls back to the registry"),
         got.own.links + " links");
      ok(/place in/i.test(got.own.title),
         "...naming the volume it is in", got.own.title || "no title");
      ok(got.acted === 1,
         "...and clicking it DOES something — the tissue where this page can draw it, the viewer "
         + "where it cannot. An <a href=\"#\"> that eats the click is what this asserts against, "
         + "and it is what every link on five pages would have been",
         got.acted + " of (window.open, empreview.open)"
         + (got.hasEmPreview ? ", preview available" : ", no preview on this page"));
    } else {
      ok(got.own.links === 0,
         T.label(key) + " has no verified extent in this repository, so a coordinate in its own "
         + "post stays text — even this one, which IS a place in " + T.label(other) + " and would "
         + "have linked if the post said so", got.own.links + " links");
      ok(/\d/.test(got.own.text), "...and is still there to read and copy",
         got.own.text.slice(0, 50));
    }

    ok(got.foreign.links === 1,
       T.label(other) + "'s coordinate is a link here too", got.foreign.links + " links");
    ok(got.offered === true,
       "...and clicking it writes a line saying whose volume it is, rather than drawing this "
       + "page's tissue under somebody else's numbers", got.offered ? "offered" : "nothing said");
    ok(/#!/.test(decodeURIComponent(got.offeredHref || "")),
       "...with a viewer link in it, built from " + T.label(other) + "'s own sources",
       (got.offeredHref || "none").slice(0, 70));

    ok(errors.length === 0, "and the page loads with no new errors",
       errors.slice(0, 2).join(" | ") || "none");
    await p.close();
  }

  await b.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("THREW: " + e.stack); process.exit(1); });
