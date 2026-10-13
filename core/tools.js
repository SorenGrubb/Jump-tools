/* core/tools.js — one list of the Jumps, so a post can say where it came from.      2026-10-13

   Søren: *"I want one stream for all the tools (when we implement it) the post should always be
   marked with the tool you are writing from and with the color code of the tool. So, there is one
   discussion forum for all the tools. ... You should be able to share a coordinate from xJump in a
   conversation with one from uJump to show an example from your dataset and then the person from
   uJump can show an example from there."*

   ── WHY THIS IS A FILE AND NOT A COLOUR MAP IN core/forum.js ─────────────────────────────────
   One shared stream means every page renders text written from a tool it is not. Two things in
   that sentence need knowledge no single page has, and only one of them is cosmetic:

     THE COLOUR. Each Jump declares its own --accent in its own <style>, so a badge in µJump
     saying “χJump” has to be χJump's green — a colour µJump has never heard of.

     AND THE COORDINATE, which is the half with teeth. core/jumplink.js resolves a triple against
     window.jumpLinkHost() — THE READER'S PAGE. With one forum per tool that was exactly right.
     In one shared stream it is a way to publish a claim nobody made: cb2 is 4×4×40 nm and so is
     minnie65, so a χJump coordinate pasted into a post and read in µJump would be tested against
     minnie65's box in the reader's own units and could land inside it. The link would then open
     unrelated cortex and attribute it to the person who wrote the post. core/jumplink.js exists
     to refuse to guess; this is the registry that lets it keep that promise across tools.

   So a post resolves against ITS OWN tool, and hostFor() is that: a jumpLinkHost shaped like the
   one the writer's page would have handed the linkifier.

   ── EVERY BOX HERE IS ALREADY IN THIS REPOSITORY ─────────────────────────────────────────────
   Nothing was fetched, scaled or inferred to fill a gap. Each entry names where its numbers come
   from, and two of them were checked against the tool's own data rather than taken on trust:

     δJump's box is declared in djump.html as MINNIE65_EM_BB with a comment naming minnie65's info
     manifest — a comment copied from µJump, which makes the numbers look copied too. They are not:
     all 207,455 V1DD nuclei in that page's own nucdata lie inside it (x 105,615–1,785,960 nm
     against 88,745–1,886,631; y 163,656–1,249,281 against 145,277–1,288,694; z 1,260–791,775
     against 765–792,270), which a minnie65 box in a 9×9×45 frame would not do.

     πJump's the same way: its 452 pinky100 nuclei run x 168,260–473,868 nm inside 140,000–500,000,
     y 142,360–310,824 inside 124,000–338,000, z 840–86,240 inside 40–87,080.

   ── AND THREE TOOLS HAVE NO BOX, DELIBERATELY ────────────────────────────────────────────────
     ηJump (H01) and βJump read their extents from the volume's own `info` at run time, so there
     is no verified constant here to copy; βJump's only literal box is the sub-volume its nucleus
     detector was run over, and its imagery extends past it.

     ωJump serves 63 volumes and a post is about ONE of them. A single box for “ωJump” would be
     false for sixty-two of them, so its coordinates wait for the dataset stamp (see `volumeKey`).

   A tool with no box linkifies nothing in its posts: those coordinates stay as the text somebody
   typed. That is core/jumplink.js's own rule — a missed link is a number a reader can still copy,
   a wrong one is a claim the author never made — and a guessed box would buy the worse half.

   WHAT A CALLER DOES
     colours   document.head.appendChild(UJ.tools.styleEl());   once, then class="ftool ftool-<key>"
               and the badge's colour is var(--tool-accent), which follows [data-theme].
     places    UJ.jumplink.html(post.body, { host: UJ.tools.hostFor(post.tool) })
               — null host means “this tool is not in the registry”, and the caller should then
               render the body with no links rather than with the reader's.

   Check: toolscheck.js */
var UJ = UJ || {};
UJ.tools = (function(){
  "use strict";

  /* The MICrONS minnie block, as two imaged volumes. Both boxes are µJump's own constants
     (MINNIE65_EM_BB / MINNIE35_EM_BB in ujump.html), in nanometres, and minnie65 is first for the
     reason core/volumes.js documents: forty-four sections are inside both, and a point in the seam
     belongs to the volume that has segmentation, nuclei and cell types over it. */
  var MINNIE65 = {
    key: "minnie65", label: "minnie65",
    bb: { xmin: 110592, xmax: 1814528, ymin: 110592, ymax: 1552384,
          zmin: 592640, zmax: 1116160 },
    em: "precomputed://https://storage.googleapis.com/iarpa_microns/minnie/minnie65/em",
    seg: "precomputed://gs://iarpa_microns/minnie/minnie65/seg_m1300",
    nuc: "precomputed://https://bossdb-open-data.s3.amazonaws.com/iarpa_microns/minnie/minnie65/nuclei"
  };
  var MINNIE35 = {
    key: "minnie35", label: "minnie35",
    bb: { xmin: 0, xmax: 2097152, ymin: 0, ymax: 2097152, zmin: 317240, zmax: 594400 },
    em: "precomputed://https://storage.googleapis.com/iarpa_microns/minnie/minnie35/em",
    seg: "precomputed://https://storage.googleapis.com/iarpa_microns/minnie/minnie35/seg"
    /* No `nuc`, and absent rather than empty: there is no nucleus detection over minnie35, and an
       empty nuclei layer out there looks like a dataset with nothing in it. */
  };

  /* ── THE EIGHT ─────────────────────────────────────────────────────────────────────────────
       key        what init({tool:…}) sends and what is stored in the Forum sheet's `tool` column
       label      the badge
       dataset    what the tool is about, for the badge's title
       page       so a reader can go and look for themselves
       dark/light the tool's own --accent, in both themes, copied from that page's :root rules
       res        nm per voxel, x/y/z — the frame every coordinate that tool writes is in
       viewer     the viewer that volume loads in, which is NOT one answer for all of them
       volumes    [] where there is no verified box; see the header */
  var LIST = [
    { key: "ujump", label: "µJump", dataset: "MICrONS minnie65 + minnie35",
      page: "ujump.html", dark: "#27e0b3", light: "#0f766e",
      emWindow: { lo: 86, hi: 172 },
      res: [4, 4, 40], viewer: "https://ngl.microns-explorer.org/",
      volumes: [MINNIE65, MINNIE35] },

    { key: "djump", label: "δJump", dataset: "V1DD — Allen Institute V1 Deep Dive",
      page: "djump.html", dark: "#b388ff", light: "#6d28d9",
      emWindow: { lo: 115, hi: 144 },
      res: [9, 9, 45], viewer: "https://spelunker.cave-explorer.org/",
      volumes: [{ key: "v1dd", label: "V1DD",
        bb: { xmin: 88745, xmax: 1886631, ymin: 145277, ymax: 1288694,
              zmin: 765, zmax: 792270 },
        em: "precomputed://gs://v1dd_imagery/image/aligned_image",
        /* The segmentation is graphene://middleauth+, which asks the reader to be logged in to
           CAVE. Named anyway: a link that prompts for a login the reader may already have is
           better than one that silently leaves the cell out. */
        seg: "graphene://middleauth+https://api.em.brain.allentech.org/segmentation/table/v1dd_public",
        nuc: "precomputed://gs://v1dd_imagery/v1dd_nuclei/segmentation" }] },

    { key: "pjump", label: "πJump", dataset: "MICrONS pinky100 (Layer 2/3)",
      page: "pjump.html", dark: "#f78ad4", light: "#b81a8f",
      emWindow: { lo: 33, hi: 231 },
      res: [4, 4, 40], viewer: "https://ngl.microns-explorer.org/",
      volumes: [{ key: "pinky100", label: "pinky100",
        bb: { xmin: 140000, xmax: 500000, ymin: 124000, ymax: 338000,
              zmin: 40, zmax: 87080 },
        em: "precomputed://https://storage.googleapis.com/neuroglancer/pinky100_v0/son_of_alignment_v15_rechunked",
        seg: "precomputed://gs://microns_public_datasets/pinky100_v185/seg",
        nuc: "precomputed://https://td.princeton.edu/sseung-archive/pinky100-nuclei/seg" }] },

    /* λJump's box is the SERVED volume, 163,840 × 163,840 × 822 voxels from #ljumpdata's size_vox,
       not the ~454 × 447 µm of tissue inside it. A coordinate in the black padding is a real place
       in the volume that happens to be empty, and refusing to link it would be a lie about where
       the volume ends. Image only: no segmentation, no nuclei. */
    { key: "ljump", label: "λJump", dataset: "Lee16 — mouse V1 serial-section TEM",
      page: "ljump.html", dark: "#7aa2ff", light: "#1d4ed8",
      emWindow: { lo: 27, hi: 240 },
      res: [4, 4, 40], viewer: "https://ngl.microns-explorer.org/",
      volumes: [{ key: "lee16", label: "Lee16",
        bb: { xmin: 0, xmax: 655360, ymin: 0, ymax: 655360, zmin: 0, zmax: 32880 },
        em: "precomputed://s3://open-neurodata/lee/lee16/image" }] },

    { key: "hjump", label: "ηJump", dataset: "H01 — human temporal cortex",
      page: "hjump.html", dark: "#ffb454", light: "#9a3412",
      emWindow: { lo: 29, hi: 212 },
      res: [8, 8, 33], viewer: "https://h01-dot-neuroglancer-demo.appspot.com/",
      volumes: [] },

    { key: "bjump", label: "βJump", dataset: "Alzheimer's vCLEM — hippocampal CA1",
      page: "bjump.html", dark: "#ff6b81", light: "#a4133c",
      emWindow: { lo: 10, hi: 244 },
      res: [8, 8, 30], viewer: "https://neuroglancer-demo.appspot.com/",
      volumes: [] },

    /* NO emWindow: ωJump's sixty-three volumes include two uint16 blocks whose tissue is a
       band 2,000 counts wide at 33,000, and a single pair of numbers for "ωJump" would be a
       false statement about sixty-two of them. Its own page reads each dataset's own. */
    { key: "wjump", label: "ωJump", dataset: "63 volumes — OpenOrganelle and others",
      page: "wjump.html", dark: "#fbbf24", light: "#854d0e",
      res: null, viewer: "https://neuroglancer-demo.appspot.com/",
      volumes: [], perVolume: true },

    /* χJump's box is cb2's own shape, UJ.cfg.volume in xjump.html: shape [1200, 230400, 249600]
       at res_nm [40, 4, 4], both z-first, which is 998,400 × 921,600 × 48,000 nm.

       EM ONLY, AND THAT IS NOT AN OVERSIGHT. cb2's published segmentation sits 1,216 sections
       below its imagery and χJump corrects for it with a transform on the source. core/jumplink.js
       writes a plain source string and has nowhere to put that transform, so a seg layer here
       would draw the right cells 48 µm from the tissue they belong to. */
    { key: "xjump", label: "χJump", dataset: "cb2 — mouse cerebellum (lobule V)",
      page: "xjump.html", dark: "#4ade80", light: "#166534",
      emWindow: { lo: 29, hi: 233 },
      res: [4, 4, 40], viewer: "https://neuroglancer-demo.appspot.com/",
      volumes: [{ key: "cb2", label: "cb2",
        bb: { xmin: 0, xmax: 998400, ymin: 0, ymax: 921600, zmin: 0, zmax: 48000 },
        em: "precomputed://https://bossdb-open-data.s3.amazonaws.com/nguyen_thomas2022/cb2/em" }] }
  ];

  function all(){ return LIST.slice(); }
  function keys(){ return LIST.map(function(t){ return t.key; }); }
  function byKey(k){
    var want = String(k || "").toLowerCase();
    for (var i = 0; i < LIST.length; i++) if (LIST[i].key === want) return LIST[i];
    return null;
  }
  /* The badge's text for a key this registry does not know: the key itself, lower-cased, rather
     than nothing. A row in the sheet written by a tool added after this file is still a post by
     somebody, and showing it unlabelled would read as a bug in the forum. */
  function label(k){
    var t = byKey(k);
    return t ? t.label : String(k || "");
  }
  function dataset(k){
    var t = byKey(k);
    return t ? t.dataset : "";
  }
  function boxed(k){
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
  }

  /* ── THE COLOURS, AS CSS RATHER THAN AS JAVASCRIPT ─────────────────────────────────────────
     A badge could be coloured by reading [data-theme] and picking a hex, and then it would be
     wrong the moment somebody toggles the theme — every one of these pages re-skins live, and the
     forum does not re-render on a toggle. Two rules per tool let the browser do it, which is also
     what every page already does with its own --accent.

     The dark rule is unconditional and the light rule is the override, in that order, because dark
     is these pages' default: :root carries the dark palette and :root[data-theme="light"]
     replaces it. */
  function css(){
    var out = [".ftool{--tool-accent:var(--mut,#8b949e)}"];
    LIST.forEach(function(t){
      out.push(".ftool-" + t.key + "{--tool-accent:" + t.dark + "}");
    });
    LIST.forEach(function(t){
      out.push(':root[data-theme="light"] .ftool-' + t.key + "{--tool-accent:" + t.light + "}");
    });
    return out.join("\n");
  }
  var STYLE_ID = "ujtoolscss";
  /* Idempotent, because the forum re-renders and a module should not need to remember whether it
     has already done this once. */
  function styleEl(doc){
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) return null;
    var el = d.getElementById(STYLE_ID);
    if (el) return el;
    el = d.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css();
    (d.head || d.documentElement).appendChild(el);
    return el;
  }

  /* ── A HOST FOR SOMEBODY ELSE'S TOOL ───────────────────────────────────────────────────────
     Shaped like window.jumpLinkHost(): core/jumplink.js reads resNm, volumes, dim, viewer() and
     nucleus(), and nothing else of it.

     NULL WHERE THERE IS NO BOX, which is the whole point. A host with an empty `volumes` would
     make placeOf() return null for every triple — the same outcome — but it would also tell the
     caller that this tool is known and simply has nothing in this post, when what is true is that
     the registry cannot place its coordinates at all. The forum says so out loud instead.

     NO nucleus(), AND NO WAY AROUND IT. “cell 253863” is a lookup in a nucleus table this page
     does not have for somebody else's volume, so a cued number in a foreign post stays text. It
     is the one reference that cannot cross tools without a server, and pretending otherwise would
     mean resolving it against the READER'S table, which is the exact mistake this file prevents. */
  /* ── AND A HOST FOR THE PICTURE ────────────────────────────────────────────────  2026-10-13
     Søren, with the Discussion open in δJump: *"when I paste a coordinate and then open it, it
     opens neuroglancer and not EM with a possibility of a 3D window."*

     core/empreview.js reads window.emPreviewHost(). µJump has one, written when the Discussion
     was only there, and it carries things the registry cannot: the nucleus table behind
     “cell 253863”, the long type name drawn in the corner of the picture, the viewer the reader
     picked from the dropdown. The other seven have none, and writing seven would be seven more
     copies of seven volumes' sources to keep in step.

     So this builds one out of what is already here. The page's own hook still wins where it
     exists; core/forum.js reaches for this only when there is none.

     `vox` PICKS THE VOLUME where a tool has more than one — µJump's two slabs — and is ignored
     by everything else. Null for a tool with no verified box, which is the same answer hostFor()
     gives and for the same reason. */
  function emHostFor(k, vox){
    var t = byKey(k);
    if (!t || !t.res || !(t.volumes || []).length) return null;
    var v = t.volumes[0], i;
    if (vox && t.volumes.length > 1){
      var nm = [vox[0] * t.res[0], vox[1] * t.res[1], vox[2] * t.res[2]];
      for (i = 0; i < t.volumes.length; i++){
        var bb = t.volumes[i].bb;
        if (bb && nm[0] >= bb.xmin && nm[0] <= bb.xmax && nm[1] >= bb.ymin && nm[1] <= bb.ymax
            && nm[2] >= bb.zmin && nm[2] <= bb.zmax){ v = t.volumes[i]; break; }
      }
    }
    var h = hostFor(k);
    return { res: t.res.slice(), em: v.em || "", seg: v.seg || "", nuc: v.nuc || "",
             window: t.emWindow ? { lo: t.emWindow.lo, hi: t.emWindow.hi } : null,
             volume: v.key, tool: t.key, label: t.label,
             /* The picture is a link, and it is the same link core/jumplink.js would write for
                this place in this tool — built from the host rather than from a second opinion. */
             viewerUrl: function(pos){
               try {
                 if (window.UJ && UJ.jumplink && h)
                   return UJ.jumplink.url(UJ.jumplink.scan(pos.join(", "), { host: h }),
                                          { host: h }) || "";
               } catch (_e){}
               return "";
             } };
  }

  function hostFor(k){
    var t = byKey(k);
    if (!t || !t.res || !t.volumes || !t.volumes.length) return null;
    var r = t.res;
    return {
      resNm: r.slice(),
      volumes: t.volumes.map(function(v){ return v; }),
      dim: { x: [r[0] * 1e-9, "m"], y: [r[1] * 1e-9, "m"], z: [r[2] * 1e-9, "m"] },
      viewer: function(){ return t.viewer; },
      nucleus: null,
      /* Read by nobody in core/jumplink.js; here so a caller that was handed a host can say which
         tool it belongs to without looking it up again. */
      tool: t.key
    };
  }

  return { all: all, keys: keys, byKey: byKey, label: label, dataset: dataset,
           boxed: boxed, manyVolumes: manyVolumes,
           css: css, styleEl: styleEl, hostFor: hostFor, emHostFor: emHostFor };
})();
if (typeof module !== "undefined" && module.exports) module.exports = UJ.tools;
