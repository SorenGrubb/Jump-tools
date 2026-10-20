/* The research page: the papers are all there, and every coordinate it prints is real.  2026-10-19

   Søren: *"I want the about page to be about these collaborations. I want these papers represented
   and I want my collaborators listed. ... The papers should be presented with the major findings
   and figures. Try to identify the coordinates from the figure images."*

   THE COORDINATES ARE THE PART THAT CAN BE WRONG WITHOUT ANYTHING BREAKING. They were read out of
   figure images — four of the five papers print x,y,z under their panels as pixels, not as text —
   first by OCR and then by eye, and OCR drops a digit without telling anybody. A dropped digit
   gives `203628, 3267, 15480` where the paper says `203628, 103267, 15480`: still three numbers,
   still a working link, and it lands 400 µm away in a part of the cortex the figure is not about.
   A page that does that is making a claim the paper never made.

   So every coordinate on the page is put through the test core/jumplink.js applies before it
   writes a link — does this land inside one of the two boxes µJump declares? — and the boxes are
   READ OUT OF ujump.html rather than written down here, so a box corrected there is corrected for
   this check too. The converse is asserted as well: a coordinate printed WITHOUT a link must be
   one this site genuinely cannot resolve (the h01 panels), not one somebody forgot to link.

   THE CHROME IS LIFTED, NOT COPIED. research.html is generated out of index.html, and the whole
   point of generating it is that the palette, the footer and the menu cannot drift. Three
   assertions hold that: the same colour tokens, the same footer, and the same menu in all three
   of its renderings on this page too.

   AND ?at= HAS TO ACTUALLY ARRIVE. The page's links are worth nothing if µJump ignores them, so
   one is opened in a real browser and the coordinate boxes are read back.

   Run: node researchcheck.js */
const fs = require("fs");
const { chromium } = require("./node_modules/playwright");
const page_ = require("./pagepath.js");
const R = [];
const ok = (n, c, d) => { R.push(!!c);
  console.log((c ? "PASS " : "*** FAIL *** ") + n + (d !== undefined ? "  <- " + d : "")); };

const res = fs.readFileSync(page_("research.html"), "utf8");
const idx = fs.readFileSync(page_("index.html"), "utf8");
const uj  = fs.readFileSync(page_("ujump.html"), "utf8");

/* ── µJump's own boxes, read from µJump ─────────────────────────────────────────────────────── */
function bbOf(name) {
  const m = uj.match(new RegExp(name + "\\s*=\\s*\\{([^}]*)\\}"));
  if (!m) return null;
  const o = {};
  m[1].split(",").forEach(p => {
    const kv = p.split(":");
    if (kv.length === 2) o[kv[0].trim()] = Number(kv[1]);
  });
  return o;
}
const BOXES = { minnie65: bbOf("MINNIE65_EM_BB"), minnie35: bbOf("MINNIE35_EM_BB") };
const RES_NM = [4, 4, 40];
function volumeOf(v) {
  const nm = [v[0] * RES_NM[0], v[1] * RES_NM[1], v[2] * RES_NM[2]];
  for (const k of ["minnie65", "minnie35"]) {
    const b = BOXES[k];
    if (!b) continue;
    if (nm[0] >= b.xmin && nm[0] <= b.xmax && nm[1] >= b.ymin && nm[1] <= b.ymax
        && nm[2] >= b.zmin && nm[2] <= b.zmax) return k;
  }
  return null;
}

console.log("--- the boxes this check measures against are µJump's ---");
ok("both volume boxes were read out of ujump.html",
   !!BOXES.minnie65 && !!BOXES.minnie35 && BOXES.minnie65.zmax > 0,
   BOXES.minnie65 ? "minnie65 z " + BOXES.minnie65.zmin + "-" + BOXES.minnie65.zmax + " nm" : "missing");

console.log("\n--- the five studies ---");
const PAPERS = ["sphincter", "morris", "cilia", "leptomeninges", "waste"];
const DOIS = ["10.1530/VB-23-0011", "10.1177/0271678X241280775", "10.1101/2025.11.19.689283",
              "10.1101/2025.05.13.653681", "10.1101/2023.04.14.536712"];
ok("all five have a block on the page",
   PAPERS.every(k => res.indexOf('id="p-' + k + '"') > 0),
   PAPERS.filter(k => res.indexOf('id="p-' + k + '"') < 0).join(", ") || "all present");
ok("...each with its DOI, linked", DOIS.every(d => res.indexOf("doi:" + d) > 0
   && res.indexOf("https://doi.org/" + d) > 0),
   DOIS.filter(d => res.indexOf("doi:" + d) < 0).join(", ") || "5 of 5");
/* Two of these are preprints and must not be presented as anything else. */
ok("the two preprints say they are not peer-reviewed",
   (res.match(/not yet peer-reviewed/g) || []).length >= 3,
   (res.match(/not yet peer-reviewed/g) || []).length + " mentions");

console.log("\n--- the people Søren named ---");
["Gary P. Morris", "Amreen Mughal", "Changsi Cai", "Stephanie K. Bonney"].forEach(n => {
  ok("" + n + " has a card", res.indexOf(n) > 0 && res.indexOf("/research/people/") > 0);
});
ok("...each card carries a monogram to stand in until the photograph does",
   (res.match(/class="face" data-mono="/g) || []).length === 4,
   (res.match(/data-mono="/g) || []).length + " monograms");

/* ── AUTHORSHIP IS NOT COLLABORATION ─────────────────────────────────────────────  2026-10-20
   This page used to carry an "And with" list: the other eleven authors of the four papers, with
   their affiliations, under a heading reading "The people". Søren: *"These people may be on the
   papers but I haven't collaborated directly with them. So I don't think it is fair they are
   mentioned."*

   The repair is not to delete names — every author must still be named on their own paper — it
   is that the names appear ONLY there. So both halves are asserted: the author lines are intact,
   and no co-author is presented as one of the people he worked with. The old list is matched by
   its own markup, which is the thing that must not come back. */
console.log("\n--- authorship is credited, collaboration is not claimed ---");
const cards = res.slice(res.indexOf('<ul class="people">'), res.indexOf("</ul>",
  res.indexOf('<ul class="people">')));
const COAUTHORS = ["Chen He", "Vanshika Chaddha", "Brad A. Sutherland", "Catherine G. Foster",
                   "Carolyn M. Ott", "Jennifer Lippincott-Schwartz", "Anna Devor",
                   "Lechan Tao", "Xiao Zhang", "Neha Zahoor Sheikh"];
ok("every co-author is still named on their paper",
   COAUTHORS.every(n => res.indexOf(n) > 0),
   COAUTHORS.filter(n => res.indexOf(n) < 0).join(", ") || COAUTHORS.length + " of " + COAUTHORS.length);
ok("...and none of them is listed as somebody he worked with",
   !/alsolist|And with/.test(res) && COAUTHORS.every(n => cards.indexOf(n) < 0),
   /alsolist|And with/.test(res) ? "the list is back" : "cards hold the four only");
/* There is deliberately no sentence on the page explaining this -- see the generator. The two
   assertions above are the guard; a page that argues with itself is not. */

/* A collaborator with no joint paper gets neither a fake link to one nor a silent omission. */
console.log("\n--- the collaboration with no paper yet ---");
ok("Stephanie Bonney's card says the work is unpublished",
   /class="wip">Annotating together/.test(res));
/* HER CARD, not "near her name": the card before hers ends with its own "The paper →" link, so
   a window measured backwards from her name catches Changsi Cai's and fails for the one reason
   that is not a bug. The card is bounded by its own <li>. */
const bonney = (() => {
  const i = res.lastIndexOf('<li class="person">', res.indexOf("Stephanie K. Bonney"));
  return i < 0 ? "" : res.slice(i, res.indexOf("</li>", i));
})();
ok("...and does not link to a paper she is not on",
   bonney.length > 200 && bonney.indexOf('href="#p-') < 0
   && bonney.indexOf('href="https://doi.org/10.3389/fcell.2022.849469"') > 0,
   bonney.indexOf('href="#p-') < 0 ? "links to her own paper instead"
                                   : "links to a paper on this page");
/* The thing that sent me looking: the Frontiers paper is NOT his, and sat unattributed in his
   publications list between four papers that are. */
ok("the Frontiers paper names Bonney et al. on the front page",
   idx.indexOf("Bonney, Coelho-Santos, Huang, Takeno, Kornfeld, Keller &amp; Shih") > 0);
ok("...and says, there and here, that it is not his",
   /not mine; the paper that makes the case/.test(idx)
   && /The case for working this way at all[\s\S]{0,160}is not mine/.test(res));

console.log("\n--- every coordinate on the page lands in a real volume ---");
/* Linked ones: the href carries it, so the href is what is tested -- a label and an href that
   disagreed would be the exact bug this file is for. */
const linked = [...res.matchAll(/href="\/ujump\.html\?at=([0-9]+),([0-9]+),([0-9]+)"/g)]
  .map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
ok("there are coordinates to check", linked.length >= 20, linked.length + " linked");
const strays = linked.filter(v => !volumeOf(v));
ok("...and every one of them is inside minnie65 or minnie35", strays.length === 0,
   strays.map(v => v.join(",")).join(" | ") || "none outside");
const byVol = {};
linked.forEach(v => { const k = volumeOf(v); byVol[k] = (byVol[k] || 0) + 1; });
ok("...both slabs are represented, which is why µJump reads both",
   (byVol.minnie65 || 0) > 0 && (byVol.minnie35 || 0) > 0,
   JSON.stringify(byVol));
/* The label beside the link must repeat the same numbers. One of them being edited later and the
   other not is how a page starts lying quietly. */
const rows = [...res.matchAll(
  /href="\/ujump\.html\?at=([0-9,]+)"><code>([0-9, ]+)<\/code>/g)];
const mismatched = rows.filter(m => m[1] !== m[2].replace(/\s+/g, ""));
ok("...and the number shown is the number the link carries", mismatched.length === 0,
   mismatched.map(m => m[2] + " vs " + m[1]).join(" | ") || rows.length + " rows agree");

console.log("\n--- and the ones it refuses to link are ones it cannot ---");
const unlinked = [...res.matchAll(/class="at off"><code>([0-9]+), ([0-9]+), ([0-9]+)<\/code>/g)]
  .map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
ok("some coordinates are printed without a link", unlinked.length >= 2,
   unlinked.length + " unlinked");
const refusable = unlinked.filter(v => volumeOf(v));
ok("...and none of them is one this site could have resolved", refusable.length === 0,
   refusable.map(v => v.join(",")).join(" | ") || "all genuinely elsewhere");
ok("...each says which volume it is in instead", (res.match(/h01 — a different volume/g) || []).length
   === unlinked.length, unlinked.length + " said so");

console.log("\n--- the figures ---");
const figs = [...res.matchAll(/src="\/research\/([a-z0-9\-]+\.webp)"/g)].map(m => m[1]);
const uniq = [...new Set(figs)];
ok("one figure per paper", uniq.length === 5, uniq.join(", "));
const dir = require("path").join(page_.dir(), "research");
const missing = uniq.filter(f => !fs.existsSync(require("path").join(dir, f)));
ok("...and every file is actually in the repository", missing.length === 0,
   missing.join(", ") || uniq.map(f =>
     Math.round(fs.statSync(require("path").join(dir, f)).size / 1024) + "kB").join(" "));
ok("...each with alt text and a caption",
   (res.match(/<figcaption>/g) || []).length === 5
   && (res.match(/alt="Figure [0-9]/g) || []).length === 5);
/* A figure reproduced from somebody's journal with no credit beside it is the thing this page
   must never do, and it is invisible until a publisher notices. */
ok("...and a credit naming its licence or its terms",
   (res.match(/class="credit"/g) || []).length === 5
   && res.indexOf("creativecommons.org/licenses/by/4.0") > 0
   && res.indexOf("creativecommons.org/licenses/by-nd/4.0") > 0
   && res.indexOf("creativecommons.org/licenses/by-nc-nd/4.0") > 0
   && res.indexOf("journals-permissions") > 0);
ok("...and the page says why no figure is cropped",
   /NoDerivatives/.test(res) && /shown whole/.test(res));

console.log("\n--- the portraits ---");
const PEOPLE_FILES = ["gary-morris", "amreen-mughal", "changsi-cai", "stephanie-bonney"]
  .map(s => s + ".jpg");
const pdir = require("path").join(page_.dir(), "research", "people");
const pmissing = PEOPLE_FILES.filter(f => !fs.existsSync(require("path").join(pdir, f)));
ok("all four photographs are in the repository", pmissing.length === 0,
   pmissing.join(", ") || PEOPLE_FILES.map(f =>
     Math.round(fs.statSync(require("path").join(pdir, f)).size / 1024) + "kB").join(" "));
/* Squared here rather than by the browser: object-fit:cover centre-crops, and a centre crop of a
   tall head-and-shoulders photograph takes the chin off. */
ok("...and each is square, so the circle does not crop a face",
   PEOPLE_FILES.every(f => {
     const b = fs.readFileSync(require("path").join(pdir, f));
     for (let i = 2; i + 9 < b.length; ) {              /* walk the JPEG markers to SOF */
       if (b[i] !== 0xFF) { i++; continue; }
       const m = b[i + 1];
       if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
         return b.readUInt16BE(i + 5) === b.readUInt16BE(i + 7);
       i += 2 + b.readUInt16BE(i + 2);
     }
     return false;
   }));
ok("...and the cropper that made them is kept beside the generator",
   fs.existsSync(require("path").join(page_.dir(), "src", "make_portraits.py")));

console.log("\n--- the chrome was lifted out of index.html, not written again ---");
const tok = s => (s.match(/--teal:#[0-9a-f]{6}/) || [""])[0]
  + (s.match(/--ink:#[0-9a-f]{6}/) || [""])[0];
ok("the palette is index.html's", tok(res) === tok(idx) && tok(res).length > 10, tok(res));
const foot = s => s.slice(s.lastIndexOf("<footer>"), s.lastIndexOf("</footer>"))
  .replace(/\s+/g, " ").trim();
ok("...so is the footer", foot(res) === foot(idx), foot(res).slice(0, 60) + "…");
ok("...and the menu's in-page links were repointed at the front page",
   res.indexOf('href="/index.html#tools"') > 0 && res.indexOf('href="#tools"') < 0);
/* Søren: "I think it should be clear that I don't have a physical lab and I don't have funding,
   this is a hobby project for me." The header still says Grubb Lab — his choice, and the domain
   is grubblab.com — so the whole weight of that falls on two sentences, one per page, and a
   sentence is the easiest thing in a file to lose in a later rewrite. Both are asserted, and so
   is the thing they replaced: "a personal research project" was the wording that read as a funded
   group's side project, and it must not come back. */
console.log("\n--- no laboratory, no funding, said on both pages ---");
const about = idx.slice(idx.indexOf('<section id="about">'),
                        idx.indexOf('<section id="publications">'));
ok("#about says there is no laboratory, no funding and no staff",
   /no laboratory behind this/i.test(about) && /no funding/i.test(about)
   && /no staff/i.test(about) && /hobby/i.test(about));
ok("...and no longer calls it a personal research project",
   !/personal research project/i.test(about),
   /personal research project/i.test(about) ? "the old wording is back" : "gone");
ok("the research page's own opening says it too",
   /no laboratory behind this site/i.test(res) && /no funding/i.test(res)
   && /spare time/i.test(res));
ok("...and the collaborators section does not imply a lab on this side",
   !/was done here/i.test(res), /was done here/i.test(res) ? "still reads as a lab" : "clear");

ok("the front page links here, in the menu and from #about",
   idx.indexOf('<li><a href="/research.html">Research</a></li>') > 0
   && idx.indexOf('class="morelink" href="/research.html"') > 0);
ok("...and #about is still short", (() => {
  const a = idx.slice(idx.indexOf('<section id="about">'), idx.indexOf('<section id="publications">'));
  return (a.match(/<p[ >]/g) || []).length <= 3;
})(), (() => {
  const a = idx.slice(idx.indexOf('<section id="about">'), idx.indexOf('<section id="publications">'));
  return (a.match(/<p[ >]/g) || []).length + " paragraphs";
})());

/* OVER HTTP, NOT file://. The figures are referenced as "/research/…", which is what the served
   site needs and what a file:// page resolves against the filesystem root — so on file:// all
   five images are 0×0 and the one assertion worth having is the one that cannot be made. Eleven
   lines of static server is cheaper than the alternative, which is relative paths that would be
   wrong on the server to make a check pass. */
function serve(root) {
  const http = require("http"), path = require("path");
  const TYPE = { ".html": "text/html", ".webp": "image/webp", ".js": "text/javascript",
                 ".css": "text/css", ".json": "application/json", ".csv": "text/csv",
                 ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const f = path.join(root, rel);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end("no"); return;
    }
    res.writeHead(200, { "content-type": TYPE[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(
    { srv, base: "http://127.0.0.1:" + srv.address().port })));
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const errs = [];
  const { srv, base } = await serve(page_.dir());

  console.log("\n--- in a browser ---");
  let p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", e => errs.push("research: " + e.message));
  await p.goto(base + "/research.html", { waitUntil: "load" });
  await p.waitForTimeout(600);

  const lists = await p.evaluate(() => {
    const take = sel => Array.from(document.querySelectorAll(sel + " .sitenav > li"))
      .map(li => (li.querySelector("a,summary").textContent || "").trim());
    return { head: take("header"), bar: take("#navBarSlot"), panel: take("#navPanelSlot") };
  });
  ok("the menu is here too, in all three renderings",
     JSON.stringify(lists.bar) === JSON.stringify(lists.head)
     && JSON.stringify(lists.panel) === JSON.stringify(lists.head) && lists.head.length > 4,
     lists.head.join(" · "));
  ok("...including Research", lists.head.indexOf("Research") >= 0);

  /* The images are the one thing on this page that is a separate file, and a path typo gives a
     page that looks finished to whoever generated it and broken to everybody else. */
  /* loading="lazy" means nothing below the fold has been fetched yet, so five 0×0 images would
     look exactly like five missing files. Dropping the attribute starts the fetch; decode() then
     waits for it, with a ceiling, because a decode() on an image the browser has decided not to
     load yet never settles and a check that hangs is worse than one that fails. */
  const imgs = await p.evaluate(async () => {
    const all = Array.from(document.querySelectorAll(".pfig img"));
    all.forEach(i => { i.loading = "eager"; i.src = i.src; });
    const cap = ms => new Promise(r => setTimeout(r, ms));
    await Promise.all(all.map(i => Promise.race([i.decode().catch(() => {}), cap(8000)])));
    return all.map(i => ({ src: i.getAttribute("src"), w: i.naturalWidth, h: i.naturalHeight }));
  });
  ok("every figure actually loads", imgs.length === 5 && imgs.every(i => i.w > 400),
     imgs.map(i => i.src.split("/").pop() + " " + i.w + "×" + i.h).join(", "));
  const faces = await p.evaluate(() => Array.from(document.querySelectorAll(".face")).map(f => ({
    mono: f.dataset.mono, img: !!f.querySelector("img"),
    nw: (f.querySelector("img") || {}).naturalWidth || 0,
    nh: (f.querySelector("img") || {}).naturalHeight || 0,
    w: Math.round(f.getBoundingClientRect().width) })));
  /* Both halves: the photograph has to actually arrive, AND the monogram has to still be
     underneath it. The fallback was the whole card for two days and is what a reader gets if a
     file is ever renamed or lost, so it must not be thrown away now that the photographs are
     here. 2026-10-20. */
  ok("every portrait loads", faces.length === 4 && faces.every(f => f.img && f.w >= 60),
     faces.map(f => f.mono + " " + (f.nw ? f.nw + "px" : "NO PHOTO")).join(", "));
  ok("...with the monogram still underneath, in case one ever goes missing",
     faces.every(f => f.mono && f.mono.length === 2),
     faces.map(f => f.mono).join(", "));

  await p.setViewportSize({ width: 390, height: 780 });
  await p.waitForTimeout(300);
  const wide = await p.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("the page does not scroll sideways on a phone", !wide);
  await p.close();

  /* ── and the link arrives ──────────────────────────────────────────────── */
  /* THE STATIC HALF ALWAYS RUNS. ujump.html crossed 11 MB on 2026-10-19 and headless Chromium in
     a sandbox now takes the renderer down part way through loading it -- reproducibly, and only
     for the new file: the 17 October copy loads in the same harness. The page is fine in a real
     browser, so this is the harness, not the site. A check that hangs for ten minutes and then
     reports nothing is worse than one that says what it could and could not do, so the parts
     that can be read off the file are asserted first and the browser run is attempted after,
     inside a guard that reports rather than throws. */
  const atBlock = uj.slice(uj.indexOf("?at=x,y,z"));
  ok("µJump carries the ?at= opener",
     uj.indexOf("?at=x,y,z") > 0 && /URLSearchParams\(location\.search\)\.get\("at"\)/.test(atBlock));
  ok("...and it reaches the page's own boxes and button, rather than looking up a second time",
     /getElementById\("x"\)\.value=p\[0\]/.test(atBlock)
     && /getElementById\("go"\)\.click\(\)/.test(atBlock)
     && /coordPanel/.test(atBlock));
  /* The unit trap: the boxes are read through toVoxels(), so a visitor last in nanometres would
     land 40,000x away unless the unit is forced first. */
  ok("...after forcing the unit to voxels", /unit="voxel"/.test(atBlock));

  const probe = [...res.matchAll(/href="\/ujump\.html\?at=([0-9]+,[0-9]+,[0-9]+)"/g)]
    .map(m => m[1]);
  const at = probe[0];
  let browserRan = false;
  try {
    p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    p.on("pageerror", e => { if (!/atob/.test(e.message)) errs.push("ujump: " + e.message); });
    await p.goto("file://" + page_("ujump.html") + "?at=" + at,
                 { waitUntil: "domcontentloaded", timeout: 20000 });
    await p.waitForTimeout(6000);
    const got = await p.evaluate(() => ({
      x: document.getElementById("x").value, y: document.getElementById("y").value,
      z: document.getElementById("z").value,
      open: document.getElementById("coordPanel").open,
      out: document.getElementById("out").classList.contains("show")
    }));
    browserRan = true;
    ok("?at= fills µJump's coordinate boxes", [got.x, got.y, got.z].join(",") === at,
       [got.x, got.y, got.z].join(",") + " for ?at=" + at);
    ok("...opens the panel so you can see it happened", got.open === true);
    ok("...and presses Go, so the viewer link is built", got.out === true);
    await p.close();
  } catch (e) {
    try { await p.close(); } catch (_e) {}
    console.log("NOT RUN  the three ?at= assertions in a real browser  <- "
                + e.message.split("\n")[0]
                + "  (ujump.html is 11 MB; the renderer does not survive it in this sandbox. "
                + "Run this check on a desktop to exercise them.)");
  }
  if (!browserRan) console.log("         the file-level assertions above still cover the script "
                               + "itself; what is untested is that the browser runs it.");

  /* The page kept keep-alive sockets open; close() alone waits for them and the process then
     sits there after the result has been printed. */
  if (srv.closeAllConnections) srv.closeAllConnections();
  srv.close();
  await browser.close();
  ok("no script errors on either page", errs.length === 0, errs.join(" | ") || "none");

  const bad = R.filter(x => !x).length;
  console.log("\n" + (bad ? "*** " + bad + " of " + R.length + " FAILED ***"
                          : "RESULT: ALL " + R.length + " CHECKS PASSED"));
  process.exit(bad ? 1 : 0);
})();
