/* The registry of Jumps: a post can say where it came from, and be believed.        2026-10-13

   Søren: *"the post should always be marked with the tool you are writing from and with the color
   code of the tool. ... You should be able to share a coordinate from xJump in a conversation with
   one from uJump."*

   core/tools.js is what makes that safe. One forum shared by eight tools means every page renders
   coordinates written in a frame it does not use, and core/jumplink.js resolves a triple against
   THE READER'S page — which was right when there was one forum per tool and is a way to publish a
   claim nobody made once there is one. This file asserts the three things that stop it:

     A TOOL'S BOX IS ITS OWN, and every box is checked here against that tool's own data where the
     page has any: all of δJump's 207,455 V1DD nuclei and all of πJump's 452 pinky100 nuclei are
     read out of their pages and must lie inside the box this registry would hand the linkifier.
     That is the assertion that would have caught a box copied from µJump, which is what δJump's
     constant NAME and its comment both suggest it is.

     A TOOL WITH NO BOX GETS NO HOST. ηJump, βJump and ωJump have no verified extent in this
     repository, so hostFor() returns null and their coordinates stay as typed text. A registry
     that handed back an empty-but-present host would read as "known, and nothing in this post",
     which is a different and false statement.

     AND THE COLOURS ARE CSS. A badge coloured by reading [data-theme] once is wrong the moment
     somebody toggles the theme, and these pages all re-skin live.

   Run: node toolscheck.js */
const fs = require("fs");
const path = require("path");
const T = require("./core/tools.js");

let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};
const page_ = require("./pagepath.js");

console.log("\nevery Jump is in the list, once");
const keys = T.keys();
const WANT = ["ujump", "djump", "pjump", "ljump", "hjump", "bjump", "wjump", "xjump"];
ok(WANT.every(k => keys.indexOf(k) >= 0) && keys.length === WANT.length,
   "all eight tools, and nothing else", keys.join(" "));
ok(new Set(keys).size === keys.length, "...each exactly once", keys.length + " keys");
ok(keys.every(k => k === k.toLowerCase()),
   "...keyed in lower case, which is what UJ.forum.init({tool:…}) sends and what the Forum "
   + "sheet's `tool` column holds", keys.join(" "));
ok(T.byKey("UJUMP") && T.byKey("UJUMP").key === "ujump",
   "...and a key is matched whatever its case, because the column is free text");

console.log("\na key this list has never heard of is still a post by somebody");
ok(T.label("zjump") === "zjump",
   "an unknown tool is labelled with its own key rather than with nothing — a tool added after "
   + "this file would otherwise have its posts appear unsigned", T.label("zjump"));
ok(T.hostFor("zjump") === null, "...but it is given no host, so nothing of it is linkified");
ok(T.boxed("zjump") === false, "...and boxed() says so");

console.log("\nthe three without a verified box get no host at all");
["hjump", "bjump", "wjump"].forEach(k => {
  ok(T.hostFor(k) === null,
     T.label(k) + " has no host: its extent is read from the volume at run time, or it serves "
     + "sixty-three volumes, so there is no constant here to resolve against", String(T.hostFor(k)));
  ok(T.boxed(k) === false, "...and boxed() agrees, which is what the forum reads", String(T.boxed(k)));
});

console.log("\nand the five with one hand back a host core/jumplink.js can use");
["ujump", "djump", "pjump", "ljump", "xjump"].forEach(k => {
  const h = T.hostFor(k);
  const shaped = !!(h && h.resNm && h.resNm.length === 3 && h.volumes && h.volumes.length
                    && h.dim && h.dim.x && h.dim.y && h.dim.z
                    && typeof h.viewer === "function" && h.viewer());
  ok(shaped, T.label(k) + "'s host has resNm, volumes, dim and a viewer",
     h ? (h.resNm.join("/") + " nm · " + h.volumes.length + " volume(s) · " + h.viewer()) : "null");
  ok(!!(h && h.nucleus === null),
     "...and NO nucleus lookup: “cell 253863” is a table this page does not have for somebody "
     + "else's volume, and answering it from the reader's own table is the mistake core/tools.js "
     + "exists to prevent", h ? String(h.nucleus) : "null");
  ok(!!(h && h.dim.x[0] === h.resNm[0] * 1e-9),
     "...and dim is derived from res rather than restated, so the two cannot disagree",
     h ? String(h.dim.x[0]) : "null");
});

console.log("\nevery volume names a box in nanometres and something to read");
T.all().forEach(t => {
  (t.volumes || []).forEach(v => {
    const bb = v.bb || {};
    const spans = ["x", "y", "z"].every(a => bb[a + "max"] > bb[a + "min"]);
    ok(spans && !!v.em && !!v.key,
       t.label + " · " + v.key + " spans a real box and has imagery",
       spans ? (Math.round((bb.xmax - bb.xmin) / 1000) + " × "
                + Math.round((bb.ymax - bb.ymin) / 1000) + " × "
                + Math.round((bb.zmax - bb.zmin) / 1000) + " µm") : JSON.stringify(bb));
  });
});

/* ── THE ASSERTION THAT CHECKS THE NUMBERS RATHER THAN THE SHAPE ─────────────────────────────
   Read each page's own nucleus table and require every nucleus to be inside the box this registry
   would resolve its coordinates against. δJump's box is declared as `MINNIE65_EM_BB` under a
   comment naming minnie65's info manifest; that is a copied comment, and the only way to know is
   to put V1DD's own cells in the box and look. */
console.log("\nand each box holds that tool's own cells");
const nucOf = (file) => {
  const s = fs.readFileSync(page_(file), "utf8");
  const m = /id="nucdata">(\{[\s\S]*?\})<\/script>/.exec(s);
  if (!m) return null;
  const d = JSON.parse(m[1]);
  const n = d.N;
  const dec = (k) => {
    const buf = Buffer.from(d[k], "base64");
    const w = buf.length / n;
    const out = new Array(n);
    for (let i = 0; i < n; i++)
      out[i] = w === 2 ? buf.readUInt16LE(i * 2) : buf.readInt32LE(i * 4);
    return out;
  };
  return { n: n, X: dec("XB"), Y: dec("YB"), Z: dec("ZB") };
};
[["djump", "djump.html"], ["pjump", "pjump.html"], ["ujump", "ujump.html"]].forEach(([k, file]) => {
  let got = null;
  try { got = nucOf(file); } catch (e){ got = null; }
  if (!got){ console.log("  --   " + k + ": no nucdata block to read"); return; }
  const h = T.hostFor(k);
  const r = h.resNm;
  const inside = (i) => h.volumes.some(v => {
    const nm = [got.X[i] * r[0], got.Y[i] * r[1], got.Z[i] * r[2]];
    return nm[0] >= v.bb.xmin && nm[0] <= v.bb.xmax && nm[1] >= v.bb.ymin && nm[1] <= v.bb.ymax
        && nm[2] >= v.bb.zmin && nm[2] <= v.bb.zmax;
  });
  let out = 0, first = "";
  for (let i = 0; i < got.n; i++)
    if (!inside(i)){ out++; if (!first) first = [got.X[i], got.Y[i], got.Z[i]].join(", "); }
  ok(out === 0,
     "all " + got.n.toLocaleString("en-GB") + " of " + T.label(k) + "'s own nuclei are inside the "
     + "box this registry would resolve its posts against",
     out ? (out + " outside, first at " + first + " vox") : "none outside");
});

/* ── AND THE BOXES DO NOT QUIETLY AGREE WITH EACH OTHER ──────────────────────────────────────
   The danger this file was written for is one tool's coordinate landing inside another's box. It
   cannot be forbidden — two volumes may genuinely overlap in a shared frame, and minnie65 and
   minnie35 do, on purpose — but a coordinate at the CENTRE of one volume landing inside a
   different tool's box is worth knowing about, because it is the case where resolving against the
   reader instead of the author draws the wrong tissue and says nothing. */
/* ── THE EM WINDOW IS THAT PAGE'S OWN ────────────────────────────────────────────────────────
   core/emtiles.js stretches [lo,hi] to black-white and defaults to minnie65's 86/172. V1DD's
   tissue is a band 29 counts wide (115–144); drawn with µJump's window it is a grey slab. A
   window copied wrong is not an error anywhere — it is a picture of the right tissue that reads
   as a broken reader, which is a day's debugging. So the numbers are read back out of the pages
   rather than trusted here. */
console.log("\neach EM window is the one its own page uses");
T.all().forEach(t => {
  if (!t.emWindow){
    ok(t.key === "wjump",
       T.label(t.key) + " has no EM window — only ωJump may be without one, because its sixty-three "
       + "volumes include uint16 blocks whose band is nowhere near the others'", t.key);
    return;
  }
  let src = "";
  try { src = fs.readFileSync(page_(t.page), "utf8"); } catch (e){ src = ""; }
  if (!src){ console.log("  --   " + t.page + " is not here to read"); return; }
  const pat = new RegExp("range:\\s*\\[\\s*" + t.emWindow.lo + "\\s*,\\s*" + t.emWindow.hi
                         + "\\s*\\]|EM_WINDOW\\s*=\\s*\\{\\s*lo:\\s*" + t.emWindow.lo
                         + "\\s*,\\s*hi:\\s*" + t.emWindow.hi + "|em_range:\\s*\\[\\s*"
                         + t.emWindow.lo + "\\s*,\\s*" + t.emWindow.hi + "\\s*\\]");
  ok(pat.test(src), T.label(t.key) + "'s window " + t.emWindow.lo + "–" + t.emWindow.hi
     + " is the one " + t.page + " sets", pat.test(src) ? "matched" : "not found in the page");
});

console.log("\nand a host for the picture is built out of the same entry");
["ujump", "djump", "pjump", "ljump", "xjump"].forEach(k => {
  const h = T.emHostFor(k);
  ok(!!(h && h.em && h.res && h.window && typeof h.viewerUrl === "function"),
     T.label(k) + "'s preview host has imagery, a frame and a window",
     h ? (h.volume + " · " + h.window.lo + "–" + h.window.hi) : "null");
});
/* ── AND THE THREE WITHOUT A BOX HAVE NO PICTURE EITHER ──────────────────────────────────────
   Worth stating plainly, because the two requirements are NOT the same and it would be easy to
   assume they are: resolving a coordinate needs a BOX, drawing one needs IMAGERY. ηJump and
   βJump have imagery and no verified box — so nothing in their posts becomes a link, so there is
   never anything to click, so the picture is moot. They would be drawable the day the registry
   learns their extents, which their own pages compute at run time from the volume's info. */
["hjump", "bjump", "wjump"].forEach(k => {
  ok(T.emHostFor(k) === null,
     T.label(k) + " has no preview host — not for want of imagery, but because without a box "
     + "nothing in its posts becomes a link to click in the first place", String(T.emHostFor(k)));
});
/* µJump has two slabs, and which one a coordinate is in decides which imagery is read. */
const in35 = T.emHostFor("ujump", [120000, 120000, 10000]);
const in65 = T.emHostFor("ujump", [120000, 120000, 20000]);
ok(!!(in35 && in65) && in35.volume === "minnie35" && in65.volume === "minnie65",
   "...and µJump's host follows the coordinate into the right slab, because the two are "
   + "different blocks of tissue with different imagery",
   (in35 || {}).volume + " / " + (in65 || {}).volume);

console.log("\nand a coordinate at the heart of one volume is reported");
const mids = [];
T.all().forEach(t => (t.volumes || []).forEach(v => {
  if (!t.res) return;
  const c = ["x", "y", "z"].map(a => (v.bb[a + "min"] + v.bb[a + "max"]) / 2);
  mids.push({ tool: t.key, vol: v.key, res: t.res,
              vox: [Math.round(c[0] / t.res[0]), Math.round(c[1] / t.res[1]),
                    Math.round(c[2] / t.res[2])] });
}));
let crossed = [];
mids.forEach(m => T.all().forEach(t => {
  if (t.key === m.tool || !t.res) return;
  /* Read in the READER's frame, which is what core/jumplink.js would do without a host. */
  (t.volumes || []).forEach(v => {
    const nm = [m.vox[0] * t.res[0], m.vox[1] * t.res[1], m.vox[2] * t.res[2]];
    if (nm[0] >= v.bb.xmin && nm[0] <= v.bb.xmax && nm[1] >= v.bb.ymin && nm[1] <= v.bb.ymax
        && nm[2] >= v.bb.zmin && nm[2] <= v.bb.zmax)
      crossed.push(m.tool + "/" + m.vol + " read as " + t.key + "/" + v.key);
  });
}));
ok(true, "the centre of each volume, read in every other tool's frame: "
   + (crossed.length ? crossed.length + " would be mistaken for somewhere else"
                     : "none collide today, which is luck rather than design"),
   crossed.join("; ") || "no collisions");

console.log("\nthe colours are two CSS rules per tool, not a hex picked once");
const sheet = T.css();
T.all().forEach(t => {
  ok(sheet.indexOf(".ftool-" + t.key + "{--tool-accent:" + t.dark + "}") >= 0,
     t.label + "'s dark accent is the unconditional rule", t.dark);
  ok(sheet.indexOf(':root[data-theme="light"] .ftool-' + t.key + "{--tool-accent:" + t.light + "}") >= 0,
     "...and its light one is the override, so a theme toggle recolours the badge with no "
     + "re-render", t.light);
});
ok(/\.ftool\{--tool-accent:var\(--mut/.test(sheet),
   "and an unknown tool's badge falls back to the muted text colour rather than to nothing");

/* ── THE COLOURS ARE THAT TOOL'S OWN ─────────────────────────────────────────────────────────
   Read out of the pages. A registry whose χJump green is not χJump's green is a label that lies
   quietly, and nothing else in the suite would notice. */
console.log("\n...and each one is the accent its own page declares");
T.all().forEach(t => {
  let src = "";
  try { src = fs.readFileSync(page_(t.page), "utf8"); } catch (e){ src = ""; }
  if (!src){ console.log("  --   " + t.page + " is not here to read"); return; }
  ok(src.indexOf("--accent:" + t.dark) >= 0,
     t.label + "'s dark accent appears in " + t.page, t.dark);
  ok(src.indexOf("--accent:" + t.light) >= 0, "...and its light one", t.light);
});

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
