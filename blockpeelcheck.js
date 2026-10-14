/* The block tick: on every panel, and what it writes into the notebook.             2026-10-14

   Søren, with a WEBKNOSSOS still: "a box of tissue like this with pale segmentations and then
   animates by removing layers from the top and revealing the 3D structure", chosen by *a tick on
   the panel*.

   Three things can be wrong here and none of them raises anything:

     THE TICK IS ON FOUR PANELS OF FIVE.  The region box is hand-written in ujump, djump, pjump
     and hjump and shared in core/regionbox.js, and every correction to that control so far has
     reached some of them. ηJump's copy is indented two columns differently from the other three,
     which is exactly how a generator misses one page.
     THE TICK IS NOT READ.  Markup on the panel and no `emStyle` in the options is a tick that
     does nothing, and a notebook that quietly writes the sweep looks completely normal.
     THE BLOCK IS WRITTEN WITHOUT THE SEGMENTATION.  Then there is no wash, the four cut faces
     are grey noise, and the result is worse than the sweep it replaced.

   Run: node blockpeelcheck.js */
const fs = require("fs"), vm = require("vm");
const core = require("./corepath.js");
let fails = 0;
const ok = (c, what, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + what + (d !== undefined ? "  <- " + d : ""));
  if (!c) fails++;
};

const sandbox = { console, JSON, Math, Number, String, Array, Object, isFinite, Date, RegExp };
sandbox.window = sandbox;
sandbox.document = { documentElement: {}, createElement: () => ({ style: {} }),
                     querySelectorAll: () => [] };
sandbox.getComputedStyle = () => ({ getPropertyValue: () => "" });
vm.createContext(sandbox);
sandbox.UJ = {};
vm.runInContext(fs.readFileSync(core("blenderexport.js"), "utf8"), sandbox);
const B = sandbox.UJ.blender;

const boxNM = { xmin: 1160000, xmax: 1200000, ymin: 600000, ymax: 640000,
                zmin: 712000, zmax: 716000 };
const base = {
  datasetId: "ujump", datasetLabel: "MICrONS minnie65", boxNM: boxNM, boxLabel: "Box 1",
  emSource: "gs://x/em", segSource: "gs://x/seg", nucSource: "",
  resNm: [4, 4, 40], brand: { name: "uJump", accent: "#27e0b3" },
  include: { em: true, seg: true, meshes: true, nuclei: false, vasc: false },
  cells: [{ type: "Microglia", root_id: "864691135345326066", nucleus_id: "292554" }],
  tracings: []
};
const paramsOf = o => B.buildNotebook(o).cells
  .filter(c => c.metadata && c.metadata.ujump === "params").map(c => c.source.join(""))[0];

console.log("what the notebook is told");
const swept = paramsOf(base);
ok(/EM_STYLE\s*=\s*'sweep'/.test(swept), "unticked, it is the sweep every export has had",
   (swept.match(/EM_STYLE.*/) || [""])[0]);
const blocked = paramsOf(Object.assign({}, base, { emStyle: "block" }));
ok(/EM_STYLE\s*=\s*'block'/.test(blocked), "ticked, it is the block",
   (blocked.match(/EM_STYLE.*/) || [""])[0]);
ok(/EM_WASH_OPACITY\s*=\s*0\.35/.test(blocked) && /EM_WASH_OPACITY/.test(swept),
   "...and the wash is named either way, so the fetch cell always has it",
   (blocked.match(/EM_WASH_OPACITY.*/) || [""])[0]);
/* THE SEGMENTATION HAS A VETO. The wash is what makes a cut face read as tissue; with the
   segmentation off there is none, and four walls of grey noise is a worse picture than the sweep.
   Asked for and refused, rather than asked for and half delivered. */
const noSeg = paramsOf(Object.assign({}, base, {
  emStyle: "block",
  include: Object.assign({}, base.include, { seg: false })
}));
ok(/EM_STYLE\s*=\s*'sweep'/.test(noSeg),
   "asked for with Segmentation off, it falls back to the sweep rather than writing bare walls",
   (noSeg.match(/EM_STYLE.*/) || [""])[0]);

console.log("\nthe tick itself");
const html = B.blockTickHtml();
ok(/class="colab-block"/.test(html) && /type="checkbox"/.test(html),
   "the markup is a checkbox the panels can find by class");
ok(/Segmentation/.test(html), "...and its tooltip says what it needs");
/* A tiny stand-in for a panel row: the three functions only ever touch the two elements. */
const row = (checked, disabled) => {
  const tick = { checked: checked, disabled: disabled };
  const lab = { style: {}, title: "" };
  return { querySelector: s => s === ".colab-block" ? tick
                             : s === ".colab-block-lab" ? lab : null };
};
ok(B.blockStyleFrom(row(true, false)) === "block", "a ticked row reads as the block");
ok(B.blockStyleFrom(row(false, false)) === "sweep", "...an unticked one as the sweep");
/* DISABLED IS NOT TICKED. The tick is Blender-only and stays visible but greyed when the Blender
   file box is off, so a tick left over from a previous choice must not reach a notebook that has
   no scene to put a block in. */
ok(B.blockStyleFrom(row(true, true)) === "sweep",
   "...and a ticked but DISABLED one as the sweep, because the Blender box is off");
const r = row(true, true);
B.blockTickSync(r, true);
ok(r.querySelector(".colab-block").disabled === false, "the Blender tick enables it");
B.blockTickSync(r, false);
ok(r.querySelector(".colab-block").disabled === true, "...and switching it off disables it again");
ok(/Blender file/.test(r.querySelector(".colab-block-lab").title),
   "...and says why, on the label, rather than just going grey");

console.log("\non every panel, not four of five");
const panels = ["ujump.html", "djump.html", "pjump.html", "hjump.html"];
panels.forEach(p => {
  const s = fs.readFileSync(require("path").join(__dirname, p), "utf8");
  ok(/UJ\.blender\.blockTickHtml/.test(s), p + " draws the tick");
  ok(/UJ\.blender\.blockTickSync/.test(s), "  ...follows the Blender tick");
  ok(/emStyle\s*:/.test(s), "  ...and sends what it says");
});
const rb = fs.readFileSync(core("regionbox.js"), "utf8");
ok(/UJ\.blender\.blockTickHtml/.test(rb), "core/regionbox.js draws the tick");
ok(/UJ\.blender\.blockTickSync/.test(rb), "  ...follows the Blender tick");
ok(/emStyle\s*:/.test(rb), "  ...and sends what it says");

console.log("\nthe notebook knows what to do with it");
/* The embedded notebook is the shipped pipeline; these three lines are what carry the tick from
   the parameter into the pictures and into the scene. Static, because running the notebook needs
   cloud-volume and Blender, and a missing one of them is silent: the parameter would be set, the
   fetch would ignore it, and the export would be a sweep that was asked to be a block. */
const nb = JSON.parse(JSON.parse((fs.readFileSync(core("blenderexport.js"), "utf8")
  .match(/const NB_SOURCE = ("(?:[^"\\]|\\.)*");/s) || [])[1]));
const all = nb.cells.map(c => (Array.isArray(c.source) ? c.source.join("") : c.source)).join("\n");
ok(/_block = str\(EM_STYLE\)\.lower\(\) == 'block'/.test(all), "the fetch cell reads EM_STYLE");
ok(/walls=_block/.test(all) && /wash_opacity=EM_WASH_OPACITY/.test(all),
   "...and asks the fetch for the walls and the wash together");
ok(/EM_MANIFEST\['style'\]/.test(all), "...and the style travels in the manifest");
ok(/def add_em_walls/.test(all) && /def ortho_for_box/.test(all),
   "blend_scene builds the walls and frames the oblique camera they need");
ok(/def _pastel/.test(all), "em_fetch carries the pale wash");

console.log(fails ? "\n*** " + fails + " FAILED ***" : "\nALL PASSED");
process.exit(fails ? 1 : 0);
