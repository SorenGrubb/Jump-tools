/* core/coin.js -- a gold coin that jumps out of what you found and flies to your points.  2026-11-12

   Søren: *"an animated reward that jumps out of the organelle after identifying it and flies to the
   points in the top right corner, where when it gets there the points increase and there is a glow
   around the points. This could be a gold coin [that] rotates a bit after jumping out and then flies
   with a tail or afterburn towards top right points collection."*

   UJ.coin.fly({ x, y, amount, label })  -> Promise, resolved when the coin has landed.
     x, y     where it starts, in viewport pixels (the organelle on the pad)
     amount   the points it carries (shown on the coin's "+n" and added to the chip)
     label    optional short text under "+n" on arrival, e.g. "rare: centriole"

   The coin only ANIMATES points the server has already granted. It never decides them: the page
   cannot be trusted with that, and a coin the server later refuses would be a lie told in gold.

   Everything is drawn on one fixed, pointer-transparent layer, so nothing underneath can be clicked
   by mistake and the page's own layout never moves. prefers-reduced-motion gets a short fade and
   the glow, without the flight. */
(function(){
  "use strict";
  var UJ = window.UJ = window.UJ || {};
  var S = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

  function style(){
    if (document.getElementById("ujCoinStyle")) return;
    var st = document.createElement("style"); st.id = "ujCoinStyle";
    st.textContent =
      ".ujcoin-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483600}"
    + ".ujcoin-layer canvas{position:absolute;inset:0;width:100%;height:100%}"
    + ".ujcoin{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;will-change:transform}"
    + ".ujcoin i{display:block;width:100%;height:100%;border-radius:50%;"
    +   "background:radial-gradient(circle at 34% 30%,#fff6c8 0,#ffd95a 22%,#f2b01e 55%,#b9770e 100%);"
    +   "box-shadow:inset 0 0 0 2px #fbe39a,inset 0 0 0 4px #c98a12,0 0 12px rgba(255,200,60,.65);"
    +   "font:800 15px/34px system-ui,sans-serif;color:#8a5a00;text-align:center;text-shadow:0 1px 0 #ffe9a3}"
    + ".ujcoin-plus{position:absolute;font:800 15px system-ui,sans-serif;color:#ffd95a;"
    +   "text-shadow:0 1px 3px rgba(0,0,0,.7);white-space:nowrap;transform:translate(-50%,-50%);transition:transform 1s ease-out,opacity 1s ease-out}"
    + ".ujcoin-plus small{display:block;font-weight:600;font-size:11px;color:#f4e3b0;text-align:center}"
    + "@keyframes ujcoinGlow{0%{box-shadow:0 0 0 0 rgba(255,210,80,.0)}25%{box-shadow:0 0 18px 6px rgba(255,210,80,.85)}100%{box-shadow:0 0 0 0 rgba(255,210,80,0)}}"
    + ".ujcoin-glow{animation:ujcoinGlow 1.1s ease-out;border-radius:999px}"
    + "@keyframes ujcoinPop{0%{transform:scale(1)}35%{transform:scale(1.25)}100%{transform:scale(1)}}"
    + ".ujcoin-pop{display:inline-block;animation:ujcoinPop .5s ease-out;color:#ffd95a}";
    document.head.appendChild(st);
  }

  var layer = null, ctx = null, sparks = [], drawing = false;
  function ensureLayer(){
    if (layer && document.body.contains(layer)) return;
    layer = document.createElement("div"); layer.className = "ujcoin-layer";
    var cv = document.createElement("canvas"); layer.appendChild(cv);
    document.body.appendChild(layer);
    ctx = cv.getContext("2d");
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
  }
  function sizeCanvas(){
    if (!ctx) return;
    var d = window.devicePixelRatio || 1, cv = ctx.canvas;
    cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  /* The afterburn: sparks left behind each frame, each fading and drifting a little. One loop draws
     every coin's sparks, so several coins in a row do not start several loops. */
  function spark(x, y, vx, vy){
    sparks.push({ x: x, y: y, vx: vx + (Math.random() - .5) * .6, vy: vy + (Math.random() - .5) * .6,
                  r: 2 + Math.random() * 3.5, life: 1 });
    if (!drawing){ drawing = true; requestAnimationFrame(drawSparks); }
  }
  function drawSparks(){
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    for (var i = sparks.length - 1; i >= 0; i--){
      var p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vx *= .94; p.vy *= .94; p.life -= .035;
      if (p.life <= 0){ sparks.splice(i, 1); continue; }
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
      g.addColorStop(0, "rgba(255,245,200," + (p.life * .95) + ")");
      g.addColorStop(.4, "rgba(255,180,40," + (p.life * .7) + ")");
      g.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    if (sparks.length) requestAnimationFrame(drawSparks); else { drawing = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  function chipTarget(){
    var pts = document.querySelector("#gameChip .pts"), chip = document.querySelector("#gameChip .chipbtn") || document.getElementById("gameChip");
    var el = pts || chip;
    if (!el){ return { x: innerWidth - 60, y: 28, pts: null, chip: null }; }
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, pts: pts, chip: chip };
  }
  function anim(dur, step){
    return new Promise(function(res){
      var t0 = performance.now();
      function fr(now){ var t = Math.min(1, (now - t0) / dur); step(t); if (t < 1) requestAnimationFrame(fr); else res(); }
      requestAnimationFrame(fr);
    });
  }
  var easeOut = function(t){ return 1 - Math.pow(1 - t, 3); };

  /* The number on the chip counts up rather than jumping, and the chip glows as the coin lands.
     The real total is redrawn from MYSTATS afterwards, so whatever the count-up showed is replaced
     by the server's figure, not trusted. */
  function land(target, amount){
    var chip = target.chip, pts = target.pts;
    if (chip){ chip.classList.remove("ujcoin-glow"); void chip.offsetWidth; chip.classList.add("ujcoin-glow");
               setTimeout(function(){ chip.classList.remove("ujcoin-glow"); }, 1200); }
    if (window.MYSTATS && typeof MYSTATS.points === "number"){
      var from = MYSTATS.points;
      MYSTATS.points = from + amount;
      if (pts){
        var fmt = (UJ.points && UJ.points.text) ? UJ.points.text : function(n){ return String(Math.round(n)); };
        var base = 0;
        try { if (typeof combinedPoints === "function") base = combinedPoints().points - (from + amount); } catch (_e){ base = 0; }
        return anim(600, function(t){
          pts.innerHTML = "<span class=\"ujcoin-pop\">" + fmt(base + from + amount * t) + " pts</span>";
        }).then(function(){ setTimeout(function(){ try { if (typeof renderChip === "function") renderChip(); } catch (_e){} }, 900); });
      }
      try { if (typeof renderChip === "function") renderChip(); } catch (_e){}
    }
    return Promise.resolve();
  }

  async function fly(o){
    o = o || {};
    style(); ensureLayer();
    var amount = +o.amount || 1;
    var x0 = o.x != null ? o.x : innerWidth / 2, y0 = o.y != null ? o.y : innerHeight / 2;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coin = document.createElement("div"); coin.className = "ujcoin";
    coin.innerHTML = "<i>" + (amount >= 10 ? "★" : "µ") + "</i>";
    layer.appendChild(coin);
    var face = coin.firstChild;
    var put = function(x, y, sc, spin){
      coin.style.transform = "translate(" + x + "px," + y + "px) scale(" + sc + ")";
      face.style.transform = "scaleX(" + spin + ")";
    };
    var plus = document.createElement("div"); plus.className = "ujcoin-plus";
    plus.innerHTML = "+" + amount + (o.label ? "<small>" + String(o.label).replace(/[<>&]/g, "") + "</small>" : "");
    var target = chipTarget();

    if (reduce){
      put(target.x, target.y, 1, 1); coin.style.opacity = "0";
      await land(target, amount); coin.remove(); return;
    }

    /* 1. JUMP OUT: up and a little to the side, growing from nothing, landing in a hover. */
    var side = (target.x > x0 ? 1 : -1) * 18, hx = x0 + side, hy = y0 - 70;
    await anim(420, function(t){
      var e = easeOut(t);
      put(x0 + side * e, y0 - 70 * e - Math.sin(t * Math.PI) * 18, .2 + .9 * e, Math.cos(t * Math.PI * 3));
    });
    /* 2. SPIN in the air, the "+n" rising off it. */
    plus.style.left = hx + "px"; plus.style.top = (hy - 30) + "px"; layer.appendChild(plus);
    requestAnimationFrame(function(){ plus.style.transform = "translate(-50%,-160%)"; plus.style.opacity = "0"; });
    await anim(650, function(t){ put(hx, hy + Math.sin(t * Math.PI * 2) * 3, 1.1 - .1 * t, Math.cos(t * Math.PI * 4)); });
    setTimeout(function(){ plus.remove(); }, 1100);

    /* 3. FLY to the chip on a curve that first dips back (wind-up), accelerating, shedding sparks. */
    target = chipTarget();                 // the page may have scrolled while it spun
    var tx = target.x, ty = target.y;
    var c1x = hx - (tx - hx) * .15, c1y = hy + 60, c2x = tx - 40, c2y = ty + 140;
    var px = hx, py = hy;
    await anim(900, function(t){
      var u = t * t * (3 - 2 * t) * .35 + t * t * .65, v = 1 - u;
      var x = v*v*v*hx + 3*v*v*u*c1x + 3*v*u*u*c2x + u*u*u*tx;
      var y = v*v*v*hy + 3*v*v*u*c1y + 3*v*u*u*c2y + u*u*u*ty;
      put(x, y, 1 - .45 * u, Math.cos(t * Math.PI * 6) * .25 + .75);
      var vx = (px - x) * .25, vy = (py - y) * .25;
      for (var k = 0; k < 3; k++) spark(x + (px - x) * k / 3, y + (py - y) * k / 3, vx, vy);
      px = x; py = y;
    });
    coin.remove();
    for (var k = 0; k < 14; k++){ var a = Math.random() * 6.28; spark(tx, ty, Math.cos(a) * 3, Math.sin(a) * 3); }
    await land(target, amount);
  }

  /* Several rewards at once go one after another, a third of a second apart, not as one blob. */
  var queue = Promise.resolve();
  UJ.coin = {
    fly: function(o){ var p = queue.then(function(){ return fly(o); }); queue = p.then(function(){ return S(120); }); return p; }
  };
})();
