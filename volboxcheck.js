/* The scale models on the index page, measured.                                    2026-09-02

   Søren: "These boxes should be the relative sizes of their datasets, so that a user can visually
   compare their individual sizes."

   That sentence is the whole specification, and it is a claim about PIXELS, so this measures
   pixels. A figure that is merely present, merely pretty, or merely in the right corner satisfies
   none of it: what has to be true is that one micrometre is the same number of pixels on all eight
   cards, and that each box's drawn shape is its dataset's real proportions.

   NOT CHECKED AGAINST A TABLE IN THIS FILE. Every box carries its own <title> stating the
   dimensions a reader is being shown -- "cb2 — 998 × 922 × 48 µm, about 4.4 × 10⁷ µm³" -- so the
   geometry is checked against THAT, and the title against its own arithmetic. A shared constants
   table would only prove the generator agrees with itself; parsing what the page says makes the
   picture and the caption answer to each other. Get the dimensions wrong in one place and this
   fails; get them wrong in both and the check is honest about what it can see.

   EIGHT CARDS, NINE BOXES... TWELVE. ωJump holds forty-six volumes spanning four orders of
   magnitude, so its card draws five of them side by side (Søren, 2026-09-02: "5 different dataset
   sizes ranging from the smallest to the largest"). Every box is therefore a <g> with its own
   title, and everything below iterates boxes rather than cards -- which is the only way the five
   in ωJump's row are held to the same scale as the seven single ones.

   Run in chromium rather than jsdom because jsdom has no layout, and "in the upper right corner"
   is a layout claim.

   Run: node volboxcheck.js */
const { chromium } = require("./node_modules/playwright");
const path = require("path");
/* index.html lives in the served repo; this check lives in a build folder beside it. */
const page_ = require("./pagepath.js");
const R = [];
const ok = (n, c, d) => { R.push(!!c); console.log((c ? "PASS " : "*** FAIL *** ") + n
                                                   + (d ? "  <- " + d : "")); };
const TOOLS = ["ujump", "djump", "pjump", "ljump", "hjump", "bjump", "wjump", "xjump"];
const COS30 = Math.cos(Math.PI / 6);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errs = []; page.on("pageerror", e => errs.push(String(e.message)));
  await page.goto("file://" + page_("index.html"), { waitUntil: "load" });

  const figs = await page.evaluate(tools => tools.map(t => {
    /* `a.feature`, not any link to the tool: since 2026-10-17 the menu links to all eight
       as well, and it comes first in the document. */
    const card = document.querySelector('a.feature[href="/' + t + '.html"]');
    const fig = card && card.querySelector(".volbox");
    const svg = fig && fig.querySelector("svg");
    if (!svg) return { tool: t, boxes: [] };
    const boxes = [...svg.querySelectorAll("g")].map(g => {
      const pts = [...g.querySelectorAll("polygon")].map(p =>
        p.getAttribute("points").trim().split(/\s+/).map(q => q.split(",").map(Number)));
      const flat = [].concat(...pts);
      return { title: (g.querySelector("title") || {}).textContent || "", pts: pts,
               faces: pts.length,
               w: Math.max(...flat.map(p => p[0])) - Math.min(...flat.map(p => p[0])),
               h: Math.max(...flat.map(p => p[1])) - Math.min(...flat.map(p => p[1])) };
    });
    return { tool: t, boxes: boxes,
             /* The svg's own title describes the figure; each g's describes one box. */
             title: (svg.querySelector("title") || {}).textContent || "",
             viewBox: svg.getAttribute("viewBox"),
             caption: (fig.querySelector("figcaption") || {}).textContent || "",
             /* Where it sits on the card, which is the half of the request that is about layout. */
             right: Math.round(card.getBoundingClientRect().right - fig.getBoundingClientRect().right),
             top: Math.round(fig.getBoundingClientRect().top - card.getBoundingClientRect().top) };
  }), TOOLS);
  /* Every drawn box, with the card it belongs to, because the scale claim is about boxes. */
  const boxes = [];
  figs.forEach(f => f.boxes.forEach(b => boxes.push(Object.assign({ tool: f.tool }, b))));

  console.log("--- one figure per card ---");
  ok("all eight cards carry one", figs.every(f => f.boxes.length >= 1),
     figs.map(f => f.tool + " " + f.boxes.length).join(", "));
  ok("...drawn as three visible faces each", boxes.every(b => b.faces === 3),
     boxes.length + " boxes across 8 cards");
  /* ωJump's five, and only ωJump's. Its roster spans 1.2 × 10⁴ to 2.5 × 10⁸ µm³, which one box
     cannot state; the other seven are one volume each and a second box there would be a fiction. */
  ok("...and ωJump draws five, for its five orders of magnitude",
     figs.find(f => f.tool === "wjump").boxes.length === 5
     && figs.filter(f => f.tool !== "wjump").every(f => f.boxes.length === 1),
     "46 volumes, five of them shown");
  ok("...each with a title a reader can hover", boxes.every(b => /µm³/.test(b.title)),
     (boxes[0].title || "").slice(0, 74) + "…");
  ok("...and its volume under it", figs.every(f => /µm³/.test(f.caption)),
     figs.map(f => f.caption.trim()).join(" · "));

  /* THE CLAIM. Same viewBox on every card is necessary but not sufficient -- it only means the
     drawings share a coordinate space. What makes them comparable is that one micrometre is the
     same number of those coordinates everywhere, which is measured below. */
  console.log("\n--- one scale, on all eight ---");
  ok("the eight share one viewBox", new Set(figs.map(f => f.viewBox)).size === 1,
     figs[0].viewBox);

  const dims = f => {
    const m = /([\d.]+) × ([\d.]+) × ([\d.]+) µm/.exec(f.title);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  ok("every title states three dimensions", boxes.every(dims),
     boxes.filter(b => !dims(b)).map(b => b.tool).join(", ") || boxes.length + " titles parsed");

  /* An isometric box of w x d x h draws (w+d)·cos30 wide and (w+d)/2 + h tall. Solve each card
     for its own pixels-per-micrometre and they must all be the same number: that IS "the relative
     sizes of their datasets". */
  const scales = boxes.map(b => {
    const [w, d, h] = dims(b);
    return { tool: b.tool, s: b.w / ((w + d) * COS30) };
  });
  const s0 = scales[0].s;
  /* ωJump's smallest is 20 × 20 × 30 µm -- 0.6 px on a side. The tolerance has to survive a box
     that small being measured off a stroked polygon, without becoming so loose that a genuinely
     mis-scaled box would slip through: 6% of 0.6 px is a twenty-fifth of a pixel. */
  ok("...and one micrometre is the same number of pixels on all of them",
     scales.every(s => Math.abs(s.s - s0) / s0 < 0.06),
     scales.map(s => s.tool + " " + s.s.toFixed(5)).join(", "));
  /* THE THICKNESS, not only the footprint. z is where these datasets differ most -- H01 is a
     170 µm slab across 3 mm, βJump a 26 µm one -- and a drawing that got the footprint right and
     squared the box off would pass the test above while being a different picture.

     Measured off the +x FACE rather than off the whole silhouette. Three faces of a cuboid are
     visible in isometric and the far-bottom corner is not one of them, so the outline's height is
     max(w/2, d/2, (w+d)/2 - h) + h -- a formula with a max() in it, which is a formula worth not
     reproducing in a check. The +x face is a plain parallelogram: its bounding box is exactly
     w/2 + h tall, so h falls straight out of it. */
  const rightFace = f => {
    const two = f.pts.filter(p => new Set(p.map(q => q[0].toFixed(2))).size === 2);
    return two.sort((a, b) => Math.max(...b.map(q => q[0])) - Math.max(...a.map(q => q[0])))[0];
  };
  const thick = boxes.map(b => {
    const [w, d, h] = dims(b), face = rightFace(b);
    const bboxH = Math.max(...face.map(p => p[1])) - Math.min(...face.map(p => p[1]));
    const drawn = bboxH - w * s0 / 2;               // the h edge, in pixels, as drawn
    return { tool: b.tool, s: drawn / h, off: Math.abs(drawn - h * s0) };
  });
  /* RELATIVE **OR** ABSOLUTE, and the second half is not slack. ωJump's smallest volume is 4.5 µm
     thick, which is 0.14 px at this scale, and the polygon coordinates are written to two decimal
     places -- so its thickness is knowable to about ±0.01 px, or ±7%, however correct the drawing
     is. Demanding 3% of a seventh of a pixel would be demanding precision the SVG does not carry.
     A box that is actually mis-scaled fails both tests: 0.05 px is a twentieth of the smallest
     thing on the page and a two-hundredth of the largest. */
  ok("...and the thickness is at that same scale",
     thick.every(t => Math.abs(t.s - s0) / s0 < 0.03 || t.off < 0.05),
     thick.map(t => t.tool + " " + t.s.toFixed(5)
                  + (t.off < 0.05 && Math.abs(t.s - s0) / s0 >= 0.03
                       ? " (±" + t.off.toFixed(3) + "px)" : "")).join(", "));

  console.log("\n--- the numbers agree with the picture ---");
  const parseVol = t => {
    const m = /([\d.]+) × 10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/.exec(t);
    if (!m) return null;
    const e = Number([...m[2]].map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join(""));
    return Number(m[1]) * Math.pow(10, e);
  };
  const wrong = boxes.filter(b => {
    const [w, d, h] = dims(b), said = parseVol(b.title);
    return !said || Math.abs(said - w * d * h) / (w * d * h) > 0.06;
  });
  ok("each title's volume is its own three dimensions multiplied", wrong.length === 0,
     wrong.map(b => b.tool).join(", ") || boxes.map(b =>
       b.tool + " " + (dims(b)[0] * dims(b)[1] * dims(b)[2]).toExponential(1)).join(", "));
  /* The caption is one number where there is one box and a RANGE where there are five, and both
     have to be the boxes' own. A range that did not reach its own extremes would be the figure
     claiming a span it does not draw. */
  const capBad = figs.filter(f => {
    const vols = f.boxes.map(b => parseVol(b.title));
    const lo = Math.min(...vols), hi = Math.max(...vols);
    const said = (f.caption.match(/[\d.]+ × 10[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g) || []).map(parseVol);
    if (f.boxes.length === 1) return said.length !== 1 || Math.abs(said[0] - hi) > 1e-9;
    return said.length !== 2 || Math.abs(said[0] - lo) > 1e-9 || Math.abs(said[1] - hi) > 1e-9;
  });
  ok("...and the caption is the boxes' own numbers", capBad.length === 0,
     capBad.map(f => f.tool).join(", ") || "one volume where there is one box, a range where five");
  /* A SANITY ANCHOR, and the reason it earns its place: the πJump card said "roughly a thousandth
     of its volume" from the day it was written, and drawing the two boxes at one scale is what
     showed it to be wrong -- 1.19 × 10⁹ over 6.7 × 10⁶ is a 180th, not a thousandth. The prose now
     says 180th and this holds it there. A picture that catches an error in the text beside it is
     the argument for drawing it to scale rather than to fit. */
  const vol = t => parseVol(figs.find(f => f.tool === t).boxes[0].title);
  ok("...and πJump really is about a thousandth of µJump",
     vol("ujump") / vol("pjump") > 100 && vol("ujump") / vol("pjump") < 300,
     Math.round(vol("ujump") / vol("pjump")) + "×  <- the card said 'a thousandth' until these "
     + "boxes were drawn at one scale and showed otherwise");

  console.log("\n--- where he asked for it ---");
  ok("in the upper right corner of the card", figs.every(f => f.right < 40 && f.top < 40),
     "right " + figs[0].right + "px, top " + figs[0].top + "px from the card's own corner");
  /* AND NOT HIDDEN ON A PHONE. There is no corner to be in at 380px, so it moves above the
     description rather than disappearing -- the comparison is the point of the figure, and a
     figure that vanishes on the device most people read a link on is a figure for nobody. */
  await page.setViewportSize({ width: 380, height: 800 });
  await page.waitForTimeout(150);
  const narrow = await page.evaluate(() => {
    const f = document.querySelector('a[href="/ujump.html"] .volbox');
    const r = f.getBoundingClientRect();
    return { shown: r.width > 0 && r.height > 0 && getComputedStyle(f).display !== "none",
             pos: getComputedStyle(f).position };
  });
  ok("...and still shown on a narrow screen", narrow.shown && narrow.pos === "static",
     "static above the description, " + narrow.pos);

  ok("no page errors", errs.length === 0, errs.slice(0, 2).join(" | ") || "none");
  await browser.close();
  const bad = R.filter(x => !x).length;
  console.log("\n" + (bad ? "*** " + bad + " OF " + R.length + " FAILED ***"
                          : "RESULT: ALL " + R.length + " CHECKS PASSED"));
  process.exit(bad ? 1 : 0);
})();
