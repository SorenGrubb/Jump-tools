/* The front page's menu: visible, reachable, and the same list in all three places.  2026-10-17

   Søren: *"I think the menu buttons should be more clear, I didn't see them. Also, it should be
   a budget menu on the mobile devices."*

   "I didn't see them" is a claim about PIXELS, so this measures pixels rather than reading the
   markup: the links had no border and no background, and the test that they are buttons now is
   that they have both. The rest of the file is about the three failures this control can have
   without anything erroring:

     THE BAR ARRIVES TOO EARLY OR NOT AT ALL. It must be off on the first frame — the hero was
     not to change — and on once the header has gone. An IntersectionObserver that never fires,
     or one wired to the wrong element, gives a page that looks right until you scroll.

     THE THREE COPIES DRIFT. The header's list is cloned into the bar and the phone panel, so a
     link added to the header reaches all three. If someone later writes a second copy by hand
     this check fails, which is the point.

     THE BURGER IS A DEAD BUTTON. On a phone the bar's links are hidden and the burger is the
     only way in, so it is opened, its panel measured, a link clicked, and the panel required to
     close again.

   Run: node frontnavcheck.js */
const { chromium } = require("./node_modules/playwright");
const page_ = require("./pagepath.js");
const R = [];
const ok = (n, c, d) => { R.push(!!c);
  console.log((c ? "PASS " : "*** FAIL *** ") + n + (d !== undefined ? "  <- " + d : "")); };

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const errs = [];

  // ── desktop ────────────────────────────────────────────────────────────────────────────
  let page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on("pageerror", e => errs.push("desktop: " + e.message));
  await page.goto("file://" + page_("index.html"), { waitUntil: "load" });
  await page.waitForTimeout(400);

  console.log("--- the menu looks like buttons ---");
  const look = await page.evaluate(() => {
    /* A TOP-LEVEL item. The first `.sitenav a` in the document is inside the tools dropdown,
       where a flat row without a border is the right design — measuring that one proved
       nothing and failed for the wrong reason. */
    const a = document.querySelector("header .sitenav > li > a");
    if (!a) return null;
    const s = getComputedStyle(a), r = a.getBoundingClientRect();
    return { bw: parseFloat(s.borderTopWidth), radius: parseFloat(s.borderTopLeftRadius),
             bg: s.backgroundColor, h: r.height, w: r.width,
             padX: parseFloat(s.paddingLeft) };
  });
  ok("a menu item has a border", look && look.bw >= 1, look && look.bw + "px");
  ok("...a background of its own", look && !/rgba\(0, 0, 0, 0\)|transparent/.test(look.bg),
     look && look.bg);
  ok("...and rounded ends, so it reads as a control", look && look.radius >= 8,
     look && look.radius + "px");
  /* 44 px is the usual finger target; these are in a desktop header, but the old 20-px-tall
     text links are what "I didn't see them" was about, so the floor is worth keeping. */
  ok("...big enough to aim at", look && look.h >= 30 && look.padX >= 10,
     look && look.h.toFixed(0) + "px tall, " + look.padX + "px side padding");

  console.log("\n--- the bar arrives only after the hero ---");
  ok("it is not shown on the first frame",
     !(await page.evaluate(() => document.getElementById("navBar").classList.contains("on"))));
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(500);
  ok("...and is shown once the header has gone",
     await page.evaluate(() => document.getElementById("navBar").classList.contains("on")));
  const barBox = await page.evaluate(() => {
    const b = document.getElementById("navBar").getBoundingClientRect();
    return { top: b.top, height: b.height };
  });
  ok("...pinned to the top of the window", Math.abs(barBox.top) < 1.5,
     "top " + barBox.top.toFixed(1) + "px, " + barBox.height.toFixed(0) + "px tall");
  /* A bar whose own content overflows it is worse than no bar: the last items are unreachable
     and nothing says so. */
  const fits = await page.evaluate(() => {
    const w = document.querySelector("#navBar .wrap");
    return w.scrollWidth <= w.clientWidth + 1;
  });
  ok("...and its contents fit inside it", fits);

  console.log("\n--- one list, three renderings ---");
  const lists = await page.evaluate(() => {
    const take = sel => Array.from(document.querySelectorAll(sel + " .sitenav > li"))
      .map(li => (li.querySelector("a,summary").textContent || "").trim());
    return { head: take("header"), bar: take("#navBarSlot"), panel: take("#navPanelSlot") };
  });
  ok("the bar's menu is the header's", JSON.stringify(lists.bar) === JSON.stringify(lists.head),
     lists.head.length + " items");
  ok("...and so is the phone panel's",
     JSON.stringify(lists.panel) === JSON.stringify(lists.head), lists.panel.join(" · "));

  console.log("\n--- the eight tools are one tap away ---");
  await page.click("#navBar details.navtools summary");
  await page.waitForTimeout(250);
  const tools = await page.evaluate(() => Array.from(
    document.querySelectorAll("#navBarSlot .toolmenu a")).map(a => a.getAttribute("href")));
  const WANT = ["/ujump.html", "/djump.html", "/pjump.html", "/ljump.html",
                "/hjump.html", "/bjump.html", "/xjump.html", "/wjump.html"];
  ok("every tool has a link in the menu", WANT.every(h => tools.indexOf(h) >= 0),
     tools.length + " links; missing: "
     + (WANT.filter(h => tools.indexOf(h) < 0).join(", ") || "none"));
  const open = await page.evaluate(() => {
    const m = document.querySelector("#navBarSlot .toolmenu").getBoundingClientRect();
    return { on: m.height > 20, right: m.right, w: window.innerWidth };
  });
  ok("...and the menu opens inside the window", open.on && open.right <= open.w,
     "right edge at " + open.right.toFixed(0) + " of " + open.w);
  /* Clicking away closes it. Without this the dropdown stays open over the page for ever, which
     is the one behaviour <details> does not bring with it. */
  await page.mouse.click(40, 400);
  await page.waitForTimeout(200);
  ok("...and closes when you click elsewhere",
     !(await page.evaluate(() => document.querySelector("#navBarSlot details.navtools").open)));
  await page.close();

  // ── phone ──────────────────────────────────────────────────────────────────────────────
  console.log("\n--- the burger ---");
  page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  page.on("pageerror", e => errs.push("phone: " + e.message));
  await page.goto("file://" + page_("index.html"), { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.waitForTimeout(500);
  const ph = await page.evaluate(() => {
    const burger = document.getElementById("navBurger");
    const links = document.querySelector("#navBar .sitenav");
    return { burger: getComputedStyle(burger).display,
             links: getComputedStyle(links).display,
             panelHidden: document.getElementById("navPanel").hidden,
             expanded: burger.getAttribute("aria-expanded") };
  });
  ok("the bar's links give way to a burger", ph.burger !== "none" && ph.links === "none",
     "burger " + ph.burger + ", links " + ph.links);
  ok("...which starts closed and says so",
     ph.panelHidden === true && ph.expanded === "false");
  await page.click("#navBurger");
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => {
    const p = document.getElementById("navPanel");
    const b = p.getBoundingClientRect();
    const first = p.querySelector(".sitenav a, .sitenav summary").getBoundingClientRect();
    return { hidden: p.hidden, h: b.height, rowH: first.height,
             expanded: document.getElementById("navBurger").getAttribute("aria-expanded") };
  });
  ok("...opens on a tap", !opened.hidden && opened.expanded === "true",
     opened.h.toFixed(0) + "px tall");
  ok("...with rows you can hit with a thumb", opened.rowH >= 40,
     opened.rowH.toFixed(0) + "px per row");
  await page.click("#navPanel .sitenav a[href='#leaderboard']");
  await page.waitForTimeout(300);
  ok("...and closes itself once a link is followed",
     await page.evaluate(() => document.getElementById("navPanel").hidden));
  const wide = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("the page still does not scroll sideways on a phone", !wide);
  await page.close();

  await browser.close();
  ok("no script errors on either width", errs.length === 0, errs.join(" | ") || "none");

  const bad = R.filter(x => !x).length;
  console.log("\n" + (bad ? "*** " + bad + " of " + R.length + " FAILED ***"
                          : "RESULT: ALL " + R.length + " CHECKS PASSED"));
  process.exit(bad ? 1 : 0);
})();
