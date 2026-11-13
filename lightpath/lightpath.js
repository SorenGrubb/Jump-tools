/* The Light Path — the game around the engine.
 *
 * Søren's prototype, unchanged in everything a player can see: the board, the
 * tray, the spectra panel, the level strip, the hints, the banner. The engine
 * it drives is `engine.js`, verbatim.
 *
 * **What changed is the campaign.** The prototype kept it in a key-value
 * store: one key per browser session per level, and the page that solved
 * level 100 wrote the new cycle number itself. Here it is NAD Network's:
 *
 *     GET  /light-path/progress.json    where the campaign is
 *     POST /light-path/progress.json    I cleared a level
 *
 * Three things follow, and all three were wrong before by construction rather
 * than by accident:
 *
 *   *"Cleared by N members" counts members.* One person in two tabs was two.
 *
 *   *The Run turns over exactly once.* Two people finishing level 100
 *   together would have skipped a Run or not turned over at all.
 *
 *   *Nobody can skip the frontier.* The server refuses a clear for a level
 *   the network has not reached, so one POST naming level 100 cannot finish
 *   a Run for everybody. It still cannot check that the optics were aligned —
 *   that is simulated here and always will be — and it does not pretend to.
 */
(function(){
  var API = document.body.getAttribute('data-api') || '/light-path/progress.json';
  var BOARD = document.body.getAttribute('data-board') || '/light-path/board.json';
  var CSRF = document.body.getAttribute('data-csrf') || '';
  /* Who the campaign belongs to, for the one sentence that says so when a
   * Run rolls over. A data attribute because this game runs in two places:
   * here, where it is the NAD network's, and on Søren's own site, where it
   * is one person's. Everything else on the page reads the same either way,
   * which is why this is one string and not a second copy of the file. */
  var WHOSE = document.body.getAttribute('data-whose') || 'The NAD network';
  /* What the shared campaign is called in running text: 'the network' on NAD, 'the Jump community' on grubblab. */
  var COMM = document.body.getAttribute('data-community') || 'the network';
  var COMM_C = COMM.charAt(0).toUpperCase() + COMM.slice(1);

  // No session id. A clear belongs to the member, and the server knows who
  // that is from the account that asked — which is what makes the count under
  // each level a count of people rather than of page loads.
  var NLEV=parseInt(document.body.getAttribute('data-levels'),10)||100;

  // ---------- communal campaign ----------
  //
  // Read from the server, never computed here. `frontier` in particular: the
  // page could work it out from the counts, and if the two ever disagreed the
  // page would offer a level the server then refuses. One of them has to be
  // right, and it is the one holding the data.
  var cycle=1, solvedCount={}, frontier=1;

  /* Which of the two games this member is in.
   *
   * Søren, 2 October 2026: *"the first round up to 100 should be individual.
   * For those that have completed it, there should be a collaborative effort
   * to play it, like it is now."*
   *
   * The server answers with `phase`: `solo` until a member has cleared their
   * own hundred, `together` afterwards. **The page never works this out for
   * itself** — same reason as `frontier` above. It only decides what to say,
   * because the two games mean different things by the same numbers: in the
   * qualifier a count of 1 under a level is *you*, and in the shared campaign
   * it is one of the network.
   *
   * `solo` is the safe default: it says nothing about anybody else, so a page
   * that loads before the first fetch lands cannot claim the network cleared
   * something it did not.
   */
  var phase='solo', mineDone=0;

  function absorb(d){
    if(!d) return;
    if(typeof d.run==='number') cycle=d.run;
    if(typeof d.frontier==='number') frontier=d.frontier;
    if(d.phase==='solo'||d.phase==='together') phase=d.phase;
    if(typeof d.done==='number') mineDone=d.done;
    if(d.cleared){
      solvedCount={};
      for(var k in d.cleared) solvedCount[parseInt(k,10)]=d.cleared[k];
    }
  }
  function solo(){ return phase==='solo'; }

  function refreshCampaign(then){
    fetch(API, {credentials:'same-origin'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(d){ absorb(d); if(then) then(); })
      .catch(function(err){
        // Quiet: the game is entirely playable without the server — the
        // levels are generated here — and it is only the shared half that
        // stops moving. An error box over a puzzle is worse than that.
        console.error('The Light Path: could not read the campaign', err);
        if(then) then();
      });
  }

  /* The clock on a level, for the board.
   *
   * Søren: *"There should also be a score-board for fastest completion of
   * every level."*
   *
   * It runs from the moment the table is laid out to the fire that aligns it,
   * and **Reset restarts it** — Reset goes through `loadLevel`, which is the
   * same thing as being handed the table again. There is no pause: a paused
   * clock needs a rule for what counts as away, and the honest description of
   * this number is "how long that table was open in front of you".
   *
   * It is the browser's clock, so it is not evidence of anything. The server
   * drops a time outside one second to one day and records the clear anyway,
   * because a leaderboard is not worth refusing somebody their level over.
   */
  var startedAt=0;
  function elapsed(){
    if(!startedAt) return null;
    var s=Math.round((Date.now()-startedAt)/1000);
    // **A fast solve is one second, not no seconds.** This used to return
    // null below one, which treated a table aligned in half a second as a
    // table that was never timed — the row then had a firing count and no
    // time, and the board, which lists by time, left it out altogether. The
    // two numbers have to arrive together or the pair is not a pair.
    if(s < 1) s = 1;
    return s <= 24*60*60 ? s : null;
  }

  /* And how many times the laser was fired to get that time.
   *
   * Søren, 30 October 2026: *"it should be registered together with the time
   * how many tries you used to get that time."*
   *
   * A try is a press that turns the beam **on**. Blocking it again is not a
   * try — it is the half of the loop the game asks for, and charging for it
   * would mean the careful player who dumps the beam before every edit is
   * billed twice for each look.
   *
   * It lives beside `startedAt` and is reset in the same place for the same
   * reason: Reset goes through `loadLevel`, which is being handed the table
   * again, so the clock and the count start over together. They are one
   * measurement of one attempt and they must never describe different ones.
   */
  var shots=0;

  function reportClear(n){
    var body={level:n, run:cycle};
    var s=elapsed();
    if(s!==null) body.seconds=s;
    if(shots>=1 && shots<=2000) body.shots=shots;
    return fetch(API, {
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json','X-CSRFToken':CSRF},
      body:JSON.stringify(body)
    }).then(function(r){
      return r.json().then(function(d){ return {status:r.status, d:d}; });
    }).then(function(res){
      // Every reply carries the whole campaign, refused or not, so the page
      // is never left showing its own guess about where the network is.
      absorb(res.d);
      buildLevelButtons();
      return res;
    }).catch(function(err){
      console.error('The Light Path: could not record that clear', err);
      return null;
    });
  }

  function playable(n){ return solvedCount[n] || n===frontier; }

  // ---------- level state ----------
  var cur=1, L=null, placed={}, trayItems=[], selected=-1, gridFixed={};
  var segments=[], scatters=[], win=false, announced={}, rolledOver=false;
  var justJoined=false;
  /* A part being dragged from one square to another.
     Søren, 14 September 2026: *"It is annoying that you have to remove a part
     if you have placed it wrong. The user should be able to drag the instrument
     to a new location after it has been placed."*
     `drag` is null unless a finger or a mouse button is down on a placed part.
     It only becomes a *move* once the pointer has travelled far enough to mean
     it — below that threshold the gesture is still the old tap, which rotates
     the part and then lifts it off. */
  var drag=null;

  function loadLevel(n){
    cur=n; L=LM.genLevel(n);
    placed={}; selected=-1; gridFixed={};
    L.fixed.forEach(function(f){gridFixed[f.x+','+f.y]=f;});
    trayItems=L.tray.map(function(t){return {t:t,used:false};});
    startedAt=Date.now(); shots=0; flashAt=0; oneShot=false;
    // "Run 0" is what the qualifier is called in the database and it is not
    // what to call it to a person.
    document.getElementById('lvlname').textContent =
      'Level '+n+(solo() ? ' · your own run' : ' · Run '+cycle);
    document.getElementById('hint').textContent=L.hint;
    document.getElementById('banner').style.display='none';
    laserOn=false; paintFire();
    buildLevelButtons(); renderTray(); fitCanvas(); trace(); draw(); drawSpec();
    showWhy(); maybeIntroduce();
  }
  function buildLevelButtons(){
    var box=document.getElementById('levels'); box.innerHTML='';
    for(var i=1;i<=NLEV;i++){
      var b=document.createElement('button');
      b.textContent=i;
      if(solvedCount[i]) b.className='done';
      if(i===cur) b.className=(b.className?b.className+' ':'')+'cur';
      b.disabled=!playable(i);
      (function(nn){ b.onclick=function(){loadLevel(nn);}; })(i);
      box.appendChild(b);
    }
    var sb=document.getElementById('solvedby');
    // The same number means two different things in the two games, so it is
    // not read out the same way. In the qualifier a count of 1 under a level
    // is you — "cleared by 1 member" there is the page talking about the
    // player in the third person.
    if(solo()){
      sb.textContent = solvedCount[cur]
        ? '· cleared · ' + mineDone + ' of ' + NLEV + ' of your own'
        : '· table ' + mineDone + ' of ' + NLEV + ' — finish your hundred to join ' + COMM;
    } else {
      sb.textContent = solvedCount[cur] ? '· cleared by '+solvedCount[cur]+
        (solvedCount[cur]===1?' member':' members') : '· unsolved — ' + COMM + ' is counting on you';
    }
    var curBtn=box.children[cur-1];
    if(curBtn&&curBtn.scrollIntoView)curBtn.scrollIntoView({inline:'center',block:'nearest'});
  }

  function compAt(x,y){return gridFixed[x+','+y]||placed[x+','+y]||null;}

  /* The laser is off until somebody presses the button.
   *
   * Søren, 13 September 2026: *"The laser should not be on continuously, but
   * there should be a red button to turn on laser and test the setup. This
   * way, most of the planning will be without seeing the laser route, which
   * will take more imagination, and that is also how it is in real life."*
   *
   * And **touching the table turns it off again**, which is the half that
   * does the work. Leaving it on after an edit would give the beam back as a
   * live cursor and the table would go on solving itself; blocking the beam
   * before you move anything is also what you actually do, for the reason the
   * beam dump card gives — 920 nm is invisible and it will still blind you.
   *
   * So the loop is: plan it dark, fire, read what happened, block it, adjust.
   */
  var laserOn=false;

  function laserOff(){
    if(!laserOn) return;
    laserOn=false;
    document.getElementById('banner').style.display='none';
    paintFire();
  }
  function paintFire(){
    var btn=document.getElementById('fire');
    if(!btn) return;
    btn.classList.toggle('on', laserOn);
    btn.textContent = laserOn ? 'Beam live — block it' : 'Fire the laser';
    document.body.classList.toggle('live', laserOn);
  }

  function trace(){
    if(!laserOn){
      // Nothing is lit and nothing is drawn. The fixed parts have to be reset
      // by hand: simulate() normally does it, and it is not being called.
      segments=[]; scatters=[]; win=false;
      L.fixed.forEach(function(f){ f._state=undefined; f._lit=false; f._missing=null; });
      return;
    }
    var res=LM.simulate(L, placed);
    segments=res.segments; scatters=res.scatters; win=res.win;
    if(win && !announced[cycle+':'+cur]){
      announced[cycle+':'+cur]=1;
      /* **First light.** Søren, 30 October 2026: *"there should be an
       * animation that celebrates when you have only fired the laser once
       * before solving the level."*
       *
       * Which is the hardest thing this game asks for and the one it never
       * acknowledged. The whole design is *plan it dark, fire, read what
       * happened, adjust* — so building a table that is right before any
       * light has been through it means you held the entire path in your
       * head. The banner said the same four words for that as for a table
       * felt out over twenty firings.
       *
       * It is read here rather than from the clear's reply, because the
       * server is not asked to believe anything about it: the count is the
       * browser's, like the clock, and this is the browser congratulating
       * the player who is sitting in front of it. What goes to the server is
       * the number, not the verdict.
       */
      oneShot = (shots === 1);
      if(oneShot) startFirstLight();
      // Optimistic, so the banner is not waiting on the network — but the
      // reply is what the level strip is rebuilt from, and the roll-over to
      // a new Run is the server's decision, not this page's.
      solvedCount[cur]=(solvedCount[cur]||0)+1;
      var wasRun=cycle, wasSolo=solo(), at=Date.now(), shown=false;
      // The banner waits a beat so the aligned beam is seen landing before
      // anything is written over it — but it also waits for the *server*,
      // because three of the four things it might say are the server's to
      // decide: whether the Run rolled over, whether this clear was the
      // hundredth of the qualifier, and whether it counted at all.
      function reveal(){ if(shown) return; shown=true; showWin(wasSolo); }
      reportClear(cur).then(function(res){
        if(res && res.d && res.d.rolled) rolledOver=true;
        if(res && res.d && res.d.joined) justJoined=true;
        if(res && res.status!==200 && cycle!==wasRun){
          // The campaign moved on underneath this window. Say so plainly
          // rather than leave a banner claiming something that is no longer
          // true of the Run it names.
          announced={};
        }
        setTimeout(reveal, Math.max(0, 450-(Date.now()-at)));
      });
      // And a floor under it, so a server that never answers costs the player
      // a banner's delay rather than the banner.
      setTimeout(reveal, 2500);
    }
  }
  function showWin(wasSolo){
    var b=document.getElementById('banner');
    // "Last" is the server's word for it. Solving level 100 is not the end of
    // a Run unless every other table is cleared too, and only the server
    // knows whether that is so. Likewise `joined`: the hundredth table of
    // somebody's qualifier is the one moment this game changes shape, and it
    // is worth saying out loud rather than silently handing them a different
    // frontier.
    var big, sub, next;
    if(justJoined){
      big = 'You have joined ' + COMM;
      sub = 'A hundred tables of your own, all aligned. From here the Light '
          + 'Path is shared: ' + COMM + ' works one table at a time, and '
          + 'whoever clears the frontier opens it for everybody.';
      next = 'Join Run '+cycle;
    } else if(rolledOver){
      big = 'Run complete!';
      sub = WHOSE + ' cleared all ' + NLEV + ' optical tables together. The '
          + 'campaign starts over from Level 1 — new run, same light.';
      next = 'Start Run '+cycle;
    } else if(wasSolo){
      big = 'Alignment complete!';
      sub = 'The light found its way. '+mineDone+' of '+NLEV+' tables of your '
          + 'own are aligned.';
      next = 'Next level';
    } else {
      big = 'Alignment complete!';
      sub = 'The light found its way. ' + COMM_C + ' moves one table forward.';
      next = 'Next level';
    }
    b.querySelector('.big').textContent = big;
    b.querySelector('.sub').textContent = sub;
    // The badge says the thing the four cases above cannot: *how*. It is
    // added to whichever of them applies rather than replacing one, because
    // joining the network in one shot is both of those facts and not a third.
    var badge=document.getElementById('firstlight');
    badge.style.display = oneShot ? 'block' : 'none';
    document.getElementById('nextbtn').textContent = next;
    b.style.display='block';
    refreshCampaign(buildLevelButtons);
  }
  document.getElementById('nextbtn').onclick=function(){
    rolledOver=false; justJoined=false;
    refreshCampaign(function(){ loadLevel(Math.min(NLEV,frontier)); });
  };
  document.getElementById('reset').onclick=function(){loadLevel(cur);};

  // ---------- rendering ----------
  var cnv=document.getElementById('game'), ctx=cnv.getContext('2d');
  var cell,offx,offy,dashT=0;
  function fitCanvas(){
    var st=document.getElementById('stage');
    var w=st.clientWidth,h=st.clientHeight,dpr=devicePixelRatio||1;
    // The CSS size must be set explicitly, and this is the one line that
    // makes the game usable on a telephone.
    //
    // `canvas#game` is `position:absolute; inset:0`, which looks as though it
    // stretches to the stage — and on a desktop it appears to, because there
    // dpr is 1 and the width attribute below happens to equal the stage width.
    // But a canvas is a *replaced* element: when its width and height are
    // auto, `left:0; right:0` does not stretch it, the intrinsic size wins and
    // `right` is simply dropped. So on a phone with dpr 3 the element became
    // three times the stage in CSS pixels, the board was drawn at treble size
    // with only its top-left corner on screen, and every tap landed a third of
    // the way to where it was aimed. Nothing errored. — 13 September 2026
    cnv.style.width=w+'px'; cnv.style.height=h+'px';
    cnv.width=Math.round(w*dpr); cnv.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cell=Math.floor(Math.min(w/L.cols,h/L.rows));
    offx=(w-cell*L.cols)/2; offy=(h-cell*L.rows)/2;
  }
  function cx(x){return offx+x*cell+cell/2;}
  function cy(y){return offy+y*cell+cell/2;}
  var BEAMC={ir:'#c62828', blue:'#4f9cf7', green:'#43e08a', red:'#ff5c5c', farred:'#c2185b'};
  var DXv=LM.DX, DYv=LM.DY;
  var ACC='#3fd0a4';                     // --acc, which is not readable from here

  /* ------------------------------------------------- first light
   *
   * The celebration for a table aligned on a single firing. Drawn on the
   * board itself rather than thrown over it, because what is being praised
   * is the table: rings leaving every detector that counted a photon and the
   * sample that gave it one, and a flare across the whole surface for a
   * quarter of a second. Confetti would be a different game's gesture.
   *
   * It takes nothing from the player. The banner is on its own timer and the
   * beam stays lit underneath, so this runs over a board that is already
   * finished and cannot be in anybody's way.
   *
   * **Reduced motion gets the badge and no animation.** A ring expanding out
   * of four points at once is exactly the thing that setting exists for, and
   * the part worth keeping — being told you did it in one — is a word, not a
   * movement.
   */
  var FLASH_MS=1600, flashAt=0, oneShot=false;
  var CALM = !!(window.matchMedia
             && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function startFirstLight(){
    if(CALM) return;
    flashAt=Date.now();
  }

  function flashing(){ return flashAt && (Date.now()-flashAt) < FLASH_MS; }

  function drawFirstLight(){
    if(!flashAt) return;
    var t=(Date.now()-flashAt)/FLASH_MS;
    if(t>=1){ flashAt=0; return; }

    ctx.save();
    // The flare: the table itself lighting up, gone in a quarter second.
    var flare=Math.max(0, 1-t*4);
    if(flare>0){
      ctx.globalAlpha=flare*0.17; ctx.fillStyle=ACC;
      ctx.fillRect(offx-6, offy-6, cell*L.cols+12, cell*L.rows+12);
    }

    // And a ring out of everything that had to receive light for this to be
    // a win — each detector in the band it was counting, the sample and the
    // objective in the accent. Those three are exactly what `simulate()`
    // checks, so the rings mark the conditions rather than a chosen few: on
    // level 1, which has only an objective, leaving it out meant the
    // simplest table in the game got the quietest celebration in it.
    //
    // Three rings each, staggered, so it reads as one pulse travelling
    // outward rather than as a single circle growing.
    var marks=[];
    L.fixed.forEach(function(f){
      if(f.t==='pmt') marks.push({x:f.x, y:f.y, c:BEAMC[f.need]||ACC});
      else if(f.t==='sample' || f.t==='objective')
        marks.push({x:f.x, y:f.y, c:ACC});
    });
    ctx.lineWidth=2;
    marks.forEach(function(m){
      var px=cx(m.x), py=cy(m.y);
      for(var k=0;k<3;k++){
        var u=t*1.45-k*0.16;
        if(u<=0 || u>=1) continue;
        ctx.globalAlpha=(1-u)*0.6;
        ctx.strokeStyle=m.c;
        ctx.beginPath();
        ctx.arc(px, py, cell*(0.34+u*1.6), 0, 7);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function draw(){
    var w=cnv.clientWidth,h=cnv.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#10161d';
    ctx.fillRect(offx-6,offy-6,cell*L.cols+12,cell*L.rows+12);
    ctx.fillStyle='#1b232d';
    for(var gy=0;gy<L.rows;gy++)for(var gx=0;gx<L.cols;gx++){
      ctx.beginPath();ctx.arc(cx(gx),cy(gy),2,0,7);ctx.fill();
    }
    segments.forEach(function(s){
      if(s.chan!=='ir')return;
      var px=DYv[s.d],py=DXv[s.d];
      var x1=cx(s.x1),y1=cy(s.y1),x2=cx(s.x2),y2=cy(s.y2);
      ctx.fillStyle='rgba(198,40,40,.16)';
      ctx.beginPath();
      if(s.cross){
        ctx.moveTo(x1+px*s.h1,y1+py*s.h1); ctx.lineTo(x2,y2);
        ctx.lineTo(x1-px*s.h1,y1-py*s.h1); ctx.closePath();
      }else{
        ctx.moveTo(x1+px*s.h1,y1+py*s.h1); ctx.lineTo(x2+px*s.h2,y2+py*s.h2);
        ctx.lineTo(x2-px*s.h2,y2-py*s.h2); ctx.lineTo(x1-px*s.h1,y1-py*s.h1); ctx.closePath();
      }
      ctx.fill();
      ctx.strokeStyle='rgba(198,40,40,.55)'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(x1+px*s.h1,y1+py*s.h1); ctx.lineTo(x2+px*(s.cross?0:s.h2),y2+py*(s.cross?0:s.h2));
      ctx.moveTo(x1-px*s.h1,y1-py*s.h1); ctx.lineTo(x2-px*(s.cross?0:s.h2),y2-py*(s.cross?0:s.h2));
      ctx.stroke();
      ctx.strokeStyle=BEAMC.ir; ctx.lineWidth=2.5;
      ctx.shadowColor=BEAMC.ir; ctx.shadowBlur=6;
      ctx.setLineDash([7,5]); ctx.lineDashOffset=-dashT;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur=0;
    });
    segments.forEach(function(s){
      if(s.chan==='ir')return;
      var offAmt={blue:4.5,green:1.5,red:-1.5,farred:-4.5}[s.chan]||0;
      var px=DYv[s.d]*offAmt,py=DXv[s.d]*offAmt;
      ctx.strokeStyle=BEAMC[s.chan]; ctx.lineWidth=2.2;
      ctx.shadowColor=BEAMC[s.chan]; ctx.shadowBlur=7;
      ctx.beginPath();
      ctx.moveTo(cx(s.x1)+px,cy(s.y1)+py); ctx.lineTo(cx(s.x2)+px,cy(s.y2)+py);
      ctx.stroke();
    });
    ctx.shadowBlur=0;
    // scattered light — wrongly oriented lenses spray the beam everywhere
    scatters.forEach(function(sc){
      var x=cx(sc.x), y=cy(sc.y);
      ctx.strokeStyle=BEAMC[sc.chan]; ctx.lineWidth=1.6; ctx.globalAlpha=.8;
      for(var a=0;a<8;a++){
        var ang=(sc.x*13+sc.y*7+a)*0.83;
        var len=cell*(0.28+0.22*(((sc.x+sc.y+a)%3)/2));
        ctx.beginPath(); ctx.moveTo(x,y);
        ctx.lineTo(x+Math.cos(ang)*len, y+Math.sin(ang)*len); ctx.stroke();
      }
      ctx.globalAlpha=1;
      ctx.fillStyle='#e8a13d'; ctx.font='bold '+(cell*.2)+'px sans-serif'; ctx.textAlign='center';
      ctx.fillText('scatter!',x,y-cell*.5);
      // Søren, 14 September 2026: *"It is not clear to me why the pockels cell
      // is scattering the light?"* It never was — the simulation knew and the
      // board did not say. A puzzle may be hard; it must not be mysterious
      // about its own rules.
      var whyTxt=(LM.WHY_SCATTER||{})[sc.why];
      if(whyTxt){
        ctx.font=(cell*.15)+'px sans-serif'; ctx.fillStyle='#c9a06a';
        ctx.fillText(whyTxt,x,y-cell*.5+cell*.19);
      }
    });
    for(var gy2=0;gy2<L.rows;gy2++)for(var gx2=0;gx2<L.cols;gx2++){
      if(drag&&drag.moving&&drag.from===(gx2+','+gy2)) continue;  // it is on the pointer
      var c=compAt(gx2,gy2);
      if(c)drawComp(ctx,c,cx(gx2),cy(gy2),cell*0.82,false);
    }
    if(drag&&drag.moving) drawDrag();
    // Last, so the rings pass over the instruments rather than under them.
    drawFirstLight();
  }

  /* The square the part would land in, and the part itself under the pointer.
     The empty socket it came from is drawn as an outline, so it is obvious
     both where the part was and where it is going — a part that simply
     vanished while being carried would read as deleted. */
  function drawDrag(){
    if(drag.from){                      // a part lifted off the table, not the tray
      var fx=+drag.from.split(',')[0], fy=+drag.from.split(',')[1];
      ctx.strokeStyle='rgba(122,135,148,.55)'; ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      ctx.strokeRect(cx(fx)-cell*.42, cy(fy)-cell*.42, cell*.84, cell*.84);
      ctx.setLineDash([]);
    }
    var t=dropTarget();
    if(t){
      ctx.strokeStyle=t.ok?'rgba(63,208,164,.9)':'rgba(255,92,92,.85)';
      ctx.fillStyle=t.ok?'rgba(63,208,164,.10)':'rgba(255,92,92,.10)';
      ctx.lineWidth=2;
      ctx.fillRect(cx(t.x)-cell*.46, cy(t.y)-cell*.46, cell*.92, cell*.92);
      ctx.strokeRect(cx(t.x)-cell*.46, cy(t.y)-cell*.46, cell*.92, cell*.92);
    }
    ctx.globalAlpha=.85;
    drawComp(ctx, drag.part, drag.px, drag.py, cell*0.82, false);
    ctx.globalAlpha=1;
  }

  /* Where a drop would land: a square inside the board, or null when the
     pointer is off it (which puts the part back in the tray). `ok` is false
     for a square that is already taken or holds something bolted down — the
     board says so in red rather than swallowing the drop silently. */
  function dropTarget(){
    if(!drag) return null;
    var x=Math.floor((drag.px-offx)/cell), y=Math.floor((drag.py-offy)/cell);
    if(x<0||y<0||x>=L.cols||y>=L.rows) return null;
    var k=x+','+y;
    return {x:x, y:y, k:k, ok:(k===drag.from) || (!gridFixed[k] && !placed[k])};
  }

  /* The order line the objective prints — built from *this* level's needs, not
     from a fixed sentence. Early tables ask for three of the six, and naming
     parts that are not in the tray is its own kind of wrong. */
  function orderLine(needs){
    var ord=(LM.TABLE_ORDER||[]).filter(function(t){ return needs.indexOf(t)>=0; });
    return ord.map(function(t){
      return (LM.STEP_NAME&&LM.STEP_NAME[t])||t; }).join(' → ');
  }

  function drawComp(g,c,x,y,s,mini){
    var r=s/2;
    g.save(); g.translate(x,y);
    function diag(o){g.beginPath();
      if(o==='/'){g.moveTo(-r*.62,r*.62);g.lineTo(r*.62,-r*.62);}
      else{g.moveTo(-r*.62,-r*.62);g.lineTo(r*.62,r*.62);}
      g.stroke();}
    function label(txt,col){ if(mini)return;
      g.fillStyle=col||'#9aa7b4'; g.font=(s*.16)+'px sans-serif'; g.textAlign='center';
      g.fillText(txt,0,r*1.14); }
    if(c.t==='laser'){
      var lasR=(c.d||0)*Math.PI/2;          // barrel points where the beam goes
      g.rotate(lasR);
      g.fillStyle='#26313d'; g.strokeStyle='#3a4856'; g.lineWidth=2;
      g.fillRect(-r,-r*.28,s*.8,s*.56); g.strokeRect(-r,-r*.28,s*.8,s*.56);
      // Dark while the laser is blocked. A red muzzle on a laser that is not
      // running says the opposite of what the button says, and of the two the
      // picture is the one people believe.
      var lasing = (typeof laserOn === 'undefined') ? true : (laserOn || mini);
      g.fillStyle = lasing ? '#c62828' : '#3a4856';
      g.fillRect(r*-0.1,-r*.18,r*1.1,r*.36);
      if(lasing){
        g.beginPath(); g.moveTo(r*1.0,-r*.18); g.lineTo(r*1.25,0); g.lineTo(r*1.0,r*.18);
        g.closePath(); g.fill();
      }
      g.rotate(-lasR);
      label('Ti:Sa');
    }else if(c.t==='objective'){
      var accR=((c.accept===undefined?1:c.accept)-1)*Math.PI/2;
      g.rotate(accR);
      g.fillStyle='#26313d'; g.strokeStyle='#5b6b7c'; g.lineWidth=2;
      g.beginPath(); g.moveTo(-r*.5,-r*.6); g.lineTo(r*.5,-r*.6);
      g.lineTo(r*.28,r*.5); g.lineTo(-r*.28,r*.5); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle='#5b6b7c'; g.lineWidth=1.5;
      g.beginPath(); g.moveTo(-r*.18,-r*.95); g.lineTo(0,-r*.72); g.lineTo(r*.18,-r*.95); g.stroke();
      if(c._state==='lit'){g.strokeStyle='#3fd0a4';g.lineWidth=2.5;
        g.beginPath();g.arc(0,0,r*1.02,0,7);g.stroke();}
      g.rotate(-accR);
      /* Four different complaints, and they used to be two.
         S\u00f8ren, 13 September 2026: *"It keeps saying wrong order, even though
         they are in the right order, it is just the piezo motor missing."*
         He was right \u2014 a part that is not there yet and a table in the wrong
         sequence are different faults, and telling somebody to reorder a
         correct table is worse than saying nothing. So: name the part when one
         is absent, name the square when the piezo is on the table but not
         under the objective, and only say *wrong order* when everything really
         is there in the wrong order. */
      if((c._state==='under'||c._state==='order'||c._state==='missing'
          ||c._state==='piezoplace')&&!mini){
        var head, sub='';
        if(c._state==='under'){ head='fill the aperture!'; }
        else if(c._state==='piezoplace'){
          head='piezo in the wrong place!';
          sub='it bolts in the square right before the objective';
        }else if(c._state==='missing'){
          head='still needs:';
          sub=(c._missing||[]).map(function(t){
            return (LM.STEP_NAME&&LM.STEP_NAME[t])||t; }).join(', ');
        }else{
          head='wrong order!';
          sub=orderLine(c.needs||[]);
        }
        g.fillStyle='#e8a13d'; g.font='bold '+(s*.17)+'px sans-serif';
        g.textAlign='center';
        g.fillText(head,0,-r*1.2);
        if(sub){
          g.font=(s*.13)+'px sans-serif'; g.fillStyle='#c9a06a';
          g.fillText(sub,0,-r*1.2+s*.17);
        }
      }
      label('OBJ');
    }else if(c.t==='pmt'){
      g.fillStyle='#26313d'; g.strokeStyle='#5b6b7c'; g.lineWidth=2;
      g.fillRect(-r*.6,-r*.55,s*.6,s*.55); g.strokeRect(-r*.6,-r*.55,s*.6,s*.55);
      var wincol=BEAMC[c.need];
      g.fillStyle=c._state==='lit'?wincol:(c._state==='noisy'?'#e8a13d':'#131a22');
      g.beginPath(); g.arc(-r*.1,-r*.05,r*.26,0,7); g.fill();
      g.strokeStyle=wincol; g.lineWidth=1.5;
      g.beginPath(); g.arc(-r*.1,-r*.05,r*.26,0,7); g.stroke();
      if(c._state==='noisy'&&!mini){g.fillStyle='#e8a13d';g.font='bold '+(s*.18)+'px sans-serif';
        g.textAlign='center';g.fillText('noise!',0,-r*.8);}
      if(c._state==='lit'){g.strokeStyle='#3fd0a4';g.lineWidth=2.5;
        g.beginPath();g.arc(-r*.1,-r*.05,r*.95,0,7);g.stroke();}
      label('PMT');
    }else if(c.t==='sample'){
      g.strokeStyle='#3fd0a4'; g.lineWidth=1.6;
      g.fillStyle=c._lit?'rgba(63,208,164,.4)':'rgba(63,208,164,.15)';
      g.beginPath(); g.arc(0,0,r*.3,0,7); g.fill(); g.stroke();
      [[0,-1],[0.9,0.5],[-0.9,0.5],[0.6,-0.8],[-0.6,-0.8]].forEach(function(v){
        g.beginPath(); g.moveTo(v[0]*r*.28,v[1]*r*.28);
        g.quadraticCurveTo(v[0]*r*.6,v[1]*r*.7,v[0]*r*.85,v[1]*r*.95); g.stroke();
      });
      label('sample');
    }else if(c.t==='block'){
      g.fillStyle='#2a3542'; g.strokeStyle='#3a4856'; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,r*.38,0,7); g.fill(); g.stroke();
    }else if(c.t==='zone'){
      g.strokeStyle='#3a4856'; g.lineWidth=1; g.setLineDash([3,3]);
      g.strokeRect(-r*.6,-r*.6,r*1.2,r*1.2); g.setLineDash([]);
      g.beginPath();
      for(var zz=-2;zz<=2;zz++){g.moveTo(-r*.6+zz*r*.3, r*.6); g.lineTo(-r*.6+zz*r*.3+r*.3, r*.3);}
      g.strokeStyle='rgba(58,72,86,.6)'; g.stroke();
    }else if(c.t==='mic'){
      /* Manual intensity control: a half-wave plate in front of a polarising
       * beamsplitter. Drawn as the cube with the waveplate disc in front of
       * it, because that is what it looks like on a table and because the
       * disc is the part you turn. */
      g.fillStyle='rgba(232,161,61,.14)'; g.strokeStyle='#e8a13d'; g.lineWidth=2;
      g.fillRect(-r*.5,-r*.5,r*1.0,r*1.0); g.strokeRect(-r*.5,-r*.5,r*1.0,r*1.0);
      g.lineWidth=2.5; diag(c.o||'/');
      g.beginPath(); g.arc(0,0,r*.2,0,7); g.lineWidth=1.6; g.stroke();
      label('power','#e8a13d');
    }else if(c.t==='dump'){
      // A cone in a black box. The hatching says "this absorbs".
      g.fillStyle='#0a0e13'; g.strokeStyle='#6b7684'; g.lineWidth=2;
      g.fillRect(-r*.52,-r*.52,r*1.04,r*1.04); g.strokeRect(-r*.52,-r*.52,r*1.04,r*1.04);
      g.strokeStyle='#4a5563'; g.lineWidth=1.4; g.beginPath();
      for(var dz=-2;dz<=2;dz++){ g.moveTo(-r*.5+dz*r*.26,r*.5); g.lineTo(-r*.5+dz*r*.26+r*.5,-r*.5); }
      g.stroke();
      // No mouth and no chevron: this one really does absorb from any side,
      // and a glyph that points somewhere would promise otherwise.
      g.strokeStyle='#6b7684'; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,r*.2,0,7); g.stroke();
      label('dump','#6b7684');
    }else if(c.t==='pockels'){
      if((c.o||'v')==='h') g.rotate(Math.PI/2);
      // A long crystal in its housing, with the electrodes either side — the
      // narrow aperture the beam has to be walked through.
      var pOK = c._state!=='clip';
      g.fillStyle='rgba(147,120,220,.16)'; g.strokeStyle='#9378dc'; g.lineWidth=2;
      g.fillRect(-r*.62,-r*.34,r*1.24,r*.68); g.strokeRect(-r*.62,-r*.34,r*1.24,r*.68);
      g.fillStyle='#9378dc';
      g.fillRect(-r*.62,-r*.46,r*1.24,r*.1); g.fillRect(-r*.62,r*.36,r*1.24,r*.1);
      g.strokeStyle=pOK?'#9378dc':'#e8a13d'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(-r*.2,-r*.34); g.lineTo(-r*.2,r*.34);
      g.moveTo(r*.2,-r*.34); g.lineTo(r*.2,r*.34); g.stroke();
      if((c.o||'v')==='h') g.rotate(-Math.PI/2);
      label('Pockels','#9378dc');
    }else if(c.t==='shutter'){
      if((c.o||'v')==='h') g.rotate(Math.PI/2);
      // Two blades, open. Closed it would be a solid bar — but a shutter in
      // the beam during acquisition is an open one.
      g.strokeStyle='#cfd8e2'; g.lineWidth=2;
      g.fillStyle='#26313d';
      g.fillRect(-r*.5,-r*.62,r*1.0,r*.26); g.strokeRect(-r*.5,-r*.62,r*1.0,r*.26);
      g.fillRect(-r*.5,r*.36,r*1.0,r*.26); g.strokeRect(-r*.5,r*.36,r*1.0,r*.26);
      if((c.o||'v')==='h') g.rotate(-Math.PI/2);
      label('shutter');
    }else if(c.t==='piezo'){
      // The collar that carries the objective, with the travel arrows that
      // say what it does: Z, fast.
      g.fillStyle='rgba(63,208,164,.12)'; g.strokeStyle='#3fd0a4'; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,r*.5,0,7); g.fill(); g.stroke();
      g.beginPath(); g.arc(0,0,r*.26,0,7); g.stroke();
      g.lineWidth=1.6; g.beginPath();
      g.moveTo(0,-r*.78); g.lineTo(0,-r*.52); g.moveTo(-r*.1,-r*.64); g.lineTo(0,-r*.78);
      g.lineTo(r*.1,-r*.64);
      g.moveTo(0,r*.78); g.lineTo(0,r*.52); g.moveTo(-r*.1,r*.64); g.lineTo(0,r*.78);
      g.lineTo(r*.1,r*.64); g.stroke();
      label('piezo Z','#3fd0a4');
    }else if(c.t==='mirror'){
      g.strokeStyle='#cfd8e2'; g.lineWidth=5; diag(c.o||'/');
    }else if(c.t==='galvo'){
      g.strokeStyle='#ffd54f'; g.lineWidth=4; diag(c.o||'/');
      g.strokeStyle='#8a6d00'; g.lineWidth=2;
      g.save(); g.rotate((c.o||'/')==='/'?-Math.PI/4:Math.PI/4);
      g.beginPath(); g.arc(0,0,r*.34,0.5,2.6); g.stroke();
      g.beginPath(); g.arc(0,0,r*.34,3.6,5.8); g.stroke();
      g.restore();
      label('galvo','#ffd54f');
    }else if(c.t==='splitter'){
      g.fillStyle='rgba(120,180,220,.15)'; g.strokeStyle='#78b4dc'; g.lineWidth=2;
      g.fillRect(-r*.55,-r*.55,r*1.1,r*1.1); g.strokeRect(-r*.55,-r*.55,r*1.1,r*1.1);
      g.lineWidth=3; diag(c.o||'/');
      label('50/50','#78b4dc');
    }else if(LM.DC[c.t]){
      var dcol={dc495:'#4f9cf7',dc560:'#43e08a',dc640:'#ff5c5c',dc700:'#3fd0a4'}[c.t];
      g.strokeStyle=dcol; g.lineWidth=5; diag(c.o||'/');
      label(c.t.slice(2)+'LP',dcol);
    }else if(LM.BP[c.t]){
      var chn={f460:'blue',f525:'green',f605:'red',f700:'farred'}[c.t];
      var fcol=BEAMC[chn];
      g.strokeStyle=fcol; g.lineWidth=4;
      g.strokeRect(-r*.42,-r*.42,r*.84,r*.84);
      g.globalAlpha=.15; g.fillStyle=fcol; g.fillRect(-r*.42,-r*.42,r*.84,r*.84); g.globalAlpha=1;
      label(LM.NAMES[c.t].split(' ')[1],fcol);
    }else if(c.t==='lensCC'||c.t==='lensCX'){
      /* Søren, 13 September 2026: *"The concave lens in this direction does
       * not diverge the light, it converges it… We should be true to the
       * physics."*
       *
       * He was reading the picture, and the picture was wrong. The diverging
       * lens used to be drawn as a **meniscus** — both faces curving the same
       * way, a crescent — and a crescent standing in a left-to-right beam
       * reads as a *positive* meniscus, which converges. The glass in the
       * drawing was not the glass in the simulation.
       *
       * Both are drawn as double lenses now, which is the only shape that
       * cannot be misread: biconcave is thin in the middle and thick at the
       * rim, biconvex the other way about. Nothing in the simulation changed,
       * because nothing in the simulation was wrong — see the note on
       * `lensCC` in engine.js for why turning a lens round cannot make a
       * diverging one converge. */
      if((c.o||'v')==='h') g.rotate(Math.PI/2);
      g.strokeStyle='#a8c8e8'; g.lineWidth=2; g.fillStyle='rgba(168,200,232,.18)';
      g.beginPath();
      if(c.t==='lensCX'){
        // Biconvex: both faces bulge outwards, thickest on the axis.
        g.moveTo(0,-r*.62); g.quadraticCurveTo(r*.40,0,0,r*.62);
        g.quadraticCurveTo(-r*.40,0,0,-r*.62);
      }else{
        // Biconcave: both faces hollow inwards, thinnest on the axis, with
        // the flat rim top and bottom that says "thick at the edges".
        var h=r*.62, w=r*.24, waist=r*.05;
        g.moveTo(-w,-h);
        g.quadraticCurveTo(-waist,0,-w,h);   // left face, hollowed towards the axis
        g.lineTo(w,h);                       // the rim
        g.quadraticCurveTo(waist,0,w,-h);    // right face, likewise
      }
      g.closePath(); g.fill(); g.stroke();
      if((c.o||'v')==='h') g.rotate(-Math.PI/2);
      label(c.t==='lensCX'?'convex':'concave','#a8c8e8');
    }
    g.restore();
  }

  // `|| flashing()` so the celebration keeps its frames even if the beam is
  // blocked underneath it. It cannot normally be — the banner is up — but a
  // flourish that stops halfway through is worse than no flourish.
  (function anim(){dashT+=0.6;
    if(flashing() || segments.some(function(s){return s.chan==='ir';}))draw();
    requestAnimationFrame(anim);})();

  // ---------- spectra (shown by default, except on a short screen) ----------
  // The panel is 112px of fixed height and its curves are drawn at fixed
  // heights above the axis, so it cannot simply be made shorter without
  // redrawing the whole thing. On a telephone — and especially a telephone
  // held sideways — those 112px are the difference between an optical table
  // you can work on and one you cannot, so it starts folded away and the
  // member opens it with the button the prototype already had.
  var specOn=innerHeight>=700;
  var specEl=document.getElementById('spec'), specBtn=document.getElementById('specbtn');
  function applySpec(){
    specEl.style.display=specOn?'block':'none';
    specBtn.textContent=specOn?'Spectra ✓':'Spectra';
  }
  applySpec();
  specBtn.onclick=function(){
    specOn=!specOn;
    applySpec();
    fitCanvas(); draw(); if(specOn)drawSpec();
  };
  var scnv=document.getElementById('speccnv');
  function drawSpec(){
    if(!specOn)return;
    var dpr=devicePixelRatio||1, W=scnv.clientWidth||600, H=112;
    scnv.width=W*dpr; scnv.height=H*dpr;
    var g=scnv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,W,H);
    var lo=400,hi=950,pad=26, base=H-16;
    function X(nm){return pad+(nm-lo)/(hi-lo)*(W-pad-8);}
    g.strokeStyle='#2a3542'; g.lineWidth=1;
    g.beginPath(); g.moveTo(pad,base); g.lineTo(W-6,base); g.stroke();
    g.fillStyle='#7b8794'; g.font='9px sans-serif'; g.textAlign='center';
    for(var nm=400;nm<=900;nm+=100){
      g.beginPath();g.moveTo(X(nm),base);g.lineTo(X(nm),base+3);g.stroke();
      g.fillText(nm,X(nm),base+11);
    }
    var labels=[];
    L.fixed.forEach(function(f){if(f.t==='sample')(f.labels||[]).forEach(function(x){labels.push(x);});});
    labels.forEach(function(lb,i){
      var mu=lb.lam, sg=26;
      g.strokeStyle=BEAMC[lb.chan]; g.lineWidth=1.6;
      g.beginPath();
      for(var w2=mu-78;w2<=mu+91;w2+=3){
        var yv=base-62*Math.exp(-((w2-mu)*(w2-mu))/(2*sg*sg));
        (w2===mu-78)?g.moveTo(X(w2),yv):g.lineTo(X(w2),yv);
      }
      g.stroke();
      g.fillStyle=BEAMC[lb.chan]; g.textAlign='center';
      g.fillText((lb.n||lb.chan)+' '+lb.lam, X(mu), base-66-(i%2)*10);
    });
    g.strokeStyle=BEAMC.ir; g.setLineDash([4,3]);
    g.beginPath(); g.moveTo(X(920),base); g.lineTo(X(920),base-70); g.stroke();
    g.setLineDash([]);
    g.fillStyle=BEAMC.ir; g.textAlign='center'; g.fillText('Ti:Sa 920',X(920),base-76);
    var seenC={};
    function each(map){for(var k2 in map){var t=map[k2].t;
      if(seenC[t])continue; seenC[t]=1;
      if(LM.BP[t]){
        var b=LM.BP[t];
        var chn={f460:'blue',f525:'green',f605:'red',f700:'farred'}[t];
        var col=BEAMC[chn];
        g.globalAlpha=.13; g.fillStyle=col;
        g.fillRect(X(b[0]),base-70,X(b[1])-X(b[0]),70); g.globalAlpha=1;
        g.strokeStyle=col; g.strokeRect(X(b[0]),base-70,X(b[1])-X(b[0]),70);
      }
      if(LM.DC[t]){
        var cut=LM.DC[t];
        g.strokeStyle='#9aa7b4'; g.setLineDash([2,3]);
        g.beginPath(); g.moveTo(X(cut),base); g.lineTo(X(cut),base-54); g.stroke();
        g.setLineDash([]);
        g.fillStyle='#9aa7b4';
        g.fillText('\u2190R '+cut+' T\u2192', X(cut), base-58);
      }
    }}
    each(placed); each(gridFixed);
  }

  // ---------- tray ----------
  function renderTray(){
    var tr=document.getElementById('trayitems');
    if(!tr){ tr=document.createElement('div'); tr.id='trayitems';
      var tray=document.getElementById('tray');
      tray.insertBefore(tr, tray.firstChild); }
    tr.innerHTML='';
    trayItems.forEach(function(it,i){
      if(it.used)return;
      var d=document.createElement('div');
      d.className='titem'+(i===selected?' sel':'');
      var c=document.createElement('canvas'); c.width=116; c.height=116;
      var g=c.getContext('2d'); g.setTransform(2,0,0,2,0,0);
      drawComp(g,{t:it.t,o:(LM.INLINE||{})[it.t]?'v':'/'},29,27,38,true);
      var n=document.createElement('div'); n.className='n'; n.textContent=LM.NAMES[it.t];
      d.appendChild(c); d.appendChild(n);
      d.onclick=function(){
        if(suppressTrayClick){ suppressTrayClick=false; return; }
        selected=(selected===i?-1:i);renderTray();draw();showWhy();};
      trayDrag(d,i,it);
      tr.appendChild(d);
    });
  }

  /* ---------- dragging a part out of the tray ----------
   *
   * Søren, 14 September 2026: *"It could be nice to also be able to drag the
   * instruments from the tray to the board, so you don't have to click them.
   * It would be fine to have both features."*
   *
   * Both, then, and the same rule decides between them as on the board: a
   * press that does not travel is a tap and selects the part, a press that
   * travels carries it. Ten pixels rather than a quarter of a square here,
   * because the gesture starts off the board where there are no squares yet.
   *
   * The part is drawn on the board's canvas while it is being carried, so the
   * tray item itself never moves — dragging the tile out of a scrolling strip
   * would reflow the strip under the finger, which is the mistake that made
   * the info panel unusable in the first place.
   */
  var suppressTrayClick=false;

  function trayDrag(el, idx, item){
    el.addEventListener('pointerdown', function(e){
      // Cleared here rather than trusting the click to clear it: when a drag
      // ends over the board the click is dispatched to a common ancestor, not
      // to this tile, so the flag would otherwise still be standing and would
      // swallow the next real tap on the tray.
      suppressTrayClick=false;
      drag={fromTray:idx, part:{t:item.t, o:(LM.INLINE||{})[item.t]?'v':'/'},
            x0:e.clientX, y0:e.clientY, px:-999, py:-999, moving:false};
      if(el.setPointerCapture) try{ el.setPointerCapture(e.pointerId); }catch(err){}
    });
    el.addEventListener('pointermove', function(e){
      if(!drag || drag.fromTray!==idx) return;
      var r=cnv.getBoundingClientRect();
      drag.px=e.clientX-r.left; drag.py=e.clientY-r.top;
      if(!drag.moving){
        if(Math.abs(e.clientX-drag.x0)+Math.abs(e.clientY-drag.y0) < 10) return;
        drag.moving=true;
        laserOff();                     // carrying a part is editing the table
      }
      draw();
    });
    el.addEventListener('pointerup', function(){
      if(!drag || drag.fromTray!==idx) return;
      var d=drag, t=d.moving?dropTarget():null;
      drag=null;
      if(!d.moving) return;             // a tap: the click below selects it
      suppressTrayClick=true;           // a drag is not a click
      if(t && t.ok){
        placed[t.k]=d.part; trayItems[idx].used=true; selected=-1;
      }                                 // dropped anywhere else: it stays put
      renderTray(); trace(); draw(); drawSpec();
    });
    el.addEventListener('pointercancel', function(){
      if(drag && drag.fromTray===idx){ drag=null; draw(); }
    });
  }

  /* ---------- why this part is on the table ----------
   *
   * Søren, 13 September 2026: *"Please try to explain in the game why we need
   * the different instruments, so that the game becomes educational."*
   *
   * Three places, in order of how little they ask of the player:
   *
   *   1. Pick a part up and the strip under the board says what it is and why
   *      a two-photon rig has one. No extra tap — the tap that selects it is
   *      the tap that explains it.
   *   2. **Parts** lists everything on this table at once, for reading rather
   *      than for playing.
   *   3. The first level of a stage opens with a card about the part it
   *      introduces, because that is the moment somebody actually wants to
   *      know.
   *
   * Every `why` is the real reason the part exists, and every `rule` is a
   * consequence of it — see INFO in engine.js. A rule that cannot be derived
   * from the reason above it is a rule that should not be in the game.
   */
  function infoFor(t){ return LM.INFO && LM.INFO[t]; }

  function whyCard(t, into){
    var inf=infoFor(t); if(!inf) return;
    var h=document.createElement('div'); h.className='wtitle';
    h.textContent=LM.NAMES[t]||t;
    var w=document.createElement('div'); w.className='wwhat'; w.textContent=inf.what;
    var y=document.createElement('div'); y.className='wwhy'; y.textContent=inf.why;
    var rl=document.createElement('div'); rl.className='wrule'; rl.textContent=inf.rule;
    into.appendChild(h); into.appendChild(w); into.appendChild(y); into.appendChild(rl);
  }

  var TRAY_HELP='Tap a part then tap the table, or drag it straight out of the '
    + 'tray. Tap a placed part to rotate it, again to lift it off — or drag '
    + 'it to another square. '
    + 'Build it with the laser off, then press the red button to fire it — '
    + 'touching the table blocks the beam again. Pick a part up to read what '
    + 'it is for, or press Parts for all of them.';
  function showWhy(){
    var box=document.getElementById('why'); if(!box) return;
    box.innerHTML='';
    if(selected<0 || !trayItems[selected]){ box.textContent=TRAY_HELP; return; }
    whyCard(trayItems[selected].t, box);
  }

  function partsOnThisTable(){
    var set={}, order=[];
    L.fixed.forEach(function(f){ if(!set[f.t] && infoFor(f.t)){ set[f.t]=1; order.push(f.t); } });
    trayItems.forEach(function(it){ if(!set[it.t] && infoFor(it.t)){ set[it.t]=1; order.push(it.t); } });
    for(var k in placed){ var t=placed[k].t;
      if(!set[t] && infoFor(t)){ set[t]=1; order.push(t); } }
    return order;
  }

  function openParts(){
    var v=document.getElementById('parts');
    var body=document.getElementById('partsbody');
    body.innerHTML='';
    var lead=document.createElement('p'); lead.className='wlead';
    lead.textContent='Everything on this table, and why a multiphoton rig has it. '
      + 'The order along the beam is: intensity control, Pockels cell, shutter, '
      + 'beam expander, scanner, then the objective with its piezo.';
    body.appendChild(lead);
    partsOnThisTable().forEach(function(t){
      var card=document.createElement('div'); card.className='wcard';
      whyCard(t, card); body.appendChild(card);
    });
    v.style.display='flex';
  }

  function closeParts(){ document.getElementById('parts').style.display='none'; }

  // The card shown the first time a level introduces something new. Once per
  // part per browser: it is an introduction, not a lecture to sit through
  // again on a replay.
  var told={};
  function maybeIntroduce(){
    if(!L.teaches || told[L.teaches]) return;
    told[L.teaches]=1;
    var map={mirror:'mirror', shutter:'shutter', mic:'mic', pockels:'pockels',
             expand:'lensCC', piezo:'piezo', scan:'galvo', detect:'dc700',
             twocolour:'dc560', threecolour:'dc495', fourcolour:'dc640'};
    var t=map[L.teaches]; if(!t || !infoFor(t)) return;
    var v=document.getElementById('newpart');
    var body=document.getElementById('newpartbody');
    body.innerHTML='';
    var kicker=document.createElement('div'); kicker.className='wkick';
    kicker.textContent=(LM.TEACH_LINE&&LM.TEACH_LINE[L.teaches])||'Something new on the table.';
    body.appendChild(kicker);
    var c=document.createElement('canvas'); c.width=132; c.height=132; c.className='wpic';
    var g=c.getContext('2d'); g.setTransform(2,0,0,2,0,0);
    drawComp(g,{t:t,o:(LM.INLINE||{})[t]?'v':'/'},33,31,46,true);
    body.appendChild(c);
    var card=document.createElement('div'); card.className='wcard';
    whyCard(t, card); body.appendChild(card);
    // The dump arrives with the intensity control and is the reason it needs
    // explaining at all, so it is introduced in the same breath.
    if(L.teaches==='mic'){ var d2=document.createElement('div'); d2.className='wcard';
      whyCard('dump', d2); body.appendChild(d2); }
    v.style.display='flex';
  }

  /* ---------- board input ----------
   *
   * One gesture, two meanings, and the pointer's own travel decides which:
   *
   *   **tap** a placed part  → turn it, and turn it again to lift it off
   *   **drag** a placed part → carry it to another square
   *
   * Søren, 14 September 2026: *"It is annoying that you have to remove a part
   * if you have placed it wrong. The user should be able to drag the
   * instrument to a new location after it has been placed."* Quite right: on a
   * real table you slide a mount along the rail, you do not unbolt it and start
   * again — and the old way cost three taps to move a mirror one square.
   *
   * The threshold is a quarter of a square, so a finger that wobbles on a
   * telephone still turns the part rather than picking it up. Pointer events
   * rather than mouse and touch separately, and `setPointerCapture` so a drag
   * that wanders off the canvas still finishes properly.
   */
  function cellAt(e){
    var rect=cnv.getBoundingClientRect();
    return {px:e.clientX-rect.left, py:e.clientY-rect.top};
  }

  /* A pointerup is followed by a click on the same square. Everything a press
     on an occupied square means has already happened by then, so that click
     has to be swallowed — otherwise lifting a part off while another is
     selected in the tray drops the new one straight into the hole. */
  var suppressClick=false;

  cnv.addEventListener('pointerdown',function(e){
    drag=null;
    if(!L) return;
    var p=cellAt(e);
    var x=Math.floor((p.px-offx)/cell), y=Math.floor((p.py-offy)/cell);
    if(x<0||y<0||x>=L.cols||y>=L.rows) return;
    var k=x+','+y;
    if(gridFixed[k]) return;            // fixed parts and zones are untouchable
    if(!placed[k]){ drag=null; return; } // an empty square is a place-from-tray tap
    drag={from:k, part:placed[k], px:p.px, py:p.py,
          x0:p.px, y0:p.py, moving:false};
    if(cnv.setPointerCapture) try{ cnv.setPointerCapture(e.pointerId); }catch(err){}
  });

  cnv.addEventListener('pointermove',function(e){
    if(!drag) return;
    var p=cellAt(e);
    drag.px=p.px; drag.py=p.py;
    if(!drag.moving){
      var far=Math.abs(p.px-drag.x0)+Math.abs(p.py-drag.y0);
      if(far < cell*0.25) return;       // still a tap
      drag.moving=true;
      // Carrying a part means the table has changed: kill the beam, as any
      // edit does, so nobody is reading a trace of a table that no longer is.
      laserOff();
    }
    draw();
  });

  function endDrag(e){
    if(!drag) return;
    var d=drag, t=d.moving?dropTarget():null;
    drag=null; suppressClick=true;
    if(!d.moving){ tapSquare(d.from); return; }
    if(!t){
      // Dropped off the board: back to the tray, which is what the gesture
      // looks like it should do.
      delete placed[d.from];
      for(var i=0;i<trayItems.length;i++)
        if(trayItems[i].t===d.part.t&&trayItems[i].used){trayItems[i].used=false;break;}
    }else if(t.ok && t.k!==d.from){
      delete placed[d.from];
      placed[t.k]=d.part;
    }                                    // an occupied square: it goes back
    renderTray(); trace(); draw(); drawSpec();
  }
  cnv.addEventListener('pointerup', endDrag);
  cnv.addEventListener('pointercancel', function(){ drag=null; draw(); });

  /* The tap that was always there: turn, turn again, lift off. */
  function tapSquare(k){
    var pc=placed[k];
    if(!pc) return;
    // In-line parts — the lenses, the Pockels cell, the shutter — stand
    // ACROSS the beam, so they turn between 'v' and 'h'. Everything else
    // that turns is a reflector and flips between '/' and '\\'.
    var isLens=!!(LM.INLINE||{})[pc.t];
    if(isLens && pc.o==='v'){ pc.o='h'; }
    else if(!isLens && LM.ROTATABLE[pc.t] && pc.o==='/'){ pc.o='\\'; }
    else{
      delete placed[k];
      for(var i=0;i<trayItems.length;i++)
        if(trayItems[i].t===pc.t&&trayItems[i].used){trayItems[i].used=false;break;}
    }
    laserOff(); renderTray(); trace(); draw(); drawSpec();
  }

  cnv.addEventListener('click',function(e){
    if(suppressClick){ suppressClick=false; return; }
    if(drag) return;                    // a drag is not a click
    var p=cellAt(e);
    var x=Math.floor((p.px-offx)/cell), y=Math.floor((p.py-offy)/cell);
    if(x<0||y<0||x>=L.cols||y>=L.rows)return;
    var k=x+','+y;
    if(gridFixed[k]||placed[k])return;  // those are the pointer handlers' work
    if(selected>=0){
      var it=trayItems[selected];
      placed[k]={t:it.t, o:(LM.INLINE||{})[it.t]?'v':'/'};
      it.used=true; selected=-1;
      laserOff(); renderTray(); trace(); draw(); drawSpec();
    }
  });

  function fire(){
    laserOn=!laserOn;
    // Counted on the way on only — see `shots` above.
    if(laserOn) shots++;
    if(!laserOn) document.getElementById('banner').style.display='none';
    paintFire();
    trace(); draw(); drawSpec();
  }
  document.getElementById('fire').onclick=fire;
  // Space is the obvious key for it, and it is the one a hand already resting
  // on the table can reach. Not while a sheet is open, and not while the
  // pointer is in a text field there.
  addEventListener('keydown', function(e){
    if(e.key!==' ' && e.key!=='Enter') return;
    if(document.getElementById('parts').style.display==='flex') return;
    if(document.getElementById('newpart').style.display==='flex') return;
    if(document.getElementById('board').style.display==='flex') return;
    if(document.getElementById('banner').style.display==='block') return;
    e.preventDefault(); fire();
  });

  /* ---------------------------------------------------- the record board
   *
   * Søren, 2 October 2026: *"There should also be a score-board for fastest
   * completion of every level."*
   *
   * One row per level that anybody has timed, holding the fastest time and
   * who set it, with the reader's own time beside it. Levels nobody has timed
   * are left out — a hundred empty rows is not a board — and the member's own
   * rows are marked, because the question somebody actually opens this to
   * answer is "which of these could I take?".
   *
   * Fetched when it is opened, not polled: it is a hundred names and the game
   * behind it is already asking the server every twelve seconds.
   */
  function fmt(s){
    if(s<60) return s+'s';
    var m=Math.floor(s/60);
    return m+'m '+(s%60)+'s';
  }
  function openBoard(){
    var sheet=document.getElementById('board');
    var body=document.getElementById('boardbody');
    sheet.style.display='flex';
    body.innerHTML='<p class="wlead">Reading the records…</p>';
    fetch(BOARD,{credentials:'same-origin'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(d){ drawBoard(d); })
      .catch(function(err){
        console.error('The Light Path: could not read the board', err);
        body.innerHTML='<p class="wlead">The records could not be read just '
          + 'now. The game is unaffected.</p>';
      });
  }
  function drawBoard(d){
    var body=document.getElementById('boardbody');
    var best=d.best||{}, mine=d.mine||{};
    var levels=Object.keys(best).map(function(k){return parseInt(k,10);})
                     .sort(function(a,b){return a-b;});
    if(!levels.length){
      body.innerHTML='<p class="wlead">Nobody has a time on any table yet. '
        + 'The first one to align a table sets its record.</p>';
      return;
    }
    var held=0, perfect=0;
    var rows=levels.map(function(n){
      var b=best[String(n)], you=mine[String(n)];
      var isYou = you!==undefined && you.seconds<=b.seconds;
      if(isYou) held++;
      if(b.shots===1) perfect++;
      return '<tr'+(isYou?' class="me"':'')+'>'
        + '<td class="lv">'+n+'</td>'
        + '<td class="t">'+fmt(b.seconds)+'</td>'
        + '<td class="sh">'+shotcell(b.shots)+'</td>'
        + '<td class="who">'+esc(b.name||'')+'</td>'
        + '<td class="t yours">'
        + (you===undefined ? '—'
           : fmt(you.seconds)+(you.shots ? '<span class="sh">·'+you.shots+'</span>' : ''))
        + '</td></tr>';
    }).join('');
    body.innerHTML =
      '<p class="wlead">The fastest recorded alignment of every table, across '
      + 'both your own run and ' + COMM + '\'s, and how many firings it took '
      + 'to get that time. '
      + (held ? 'You hold '+held+' of them.'
              : 'None of them are yours yet.')
      + (perfect ? ' ✦ marks a table aligned on a single shot.' : '')
      + '</p>'
      + '<table class="recs"><thead><tr><th>Table</th><th>Record</th>'
      + '<th>Shots</th><th>Held by</th><th>You</th></tr></thead><tbody>'
      + rows+'</tbody></table>';
  }
  /* The firing count beside a record.
   *
   * An em dash where there is none, which is every record set before 30
   * October 2026 — the same rule the clock has had since it arrived, and for
   * the same reason: a missing count is not a count of nothing, and showing
   * it as 0 would put every old record at the top of a column it was never
   * measured for.
   */
  function shotcell(s){
    if(!s) return '<span class="none">—</span>';
    return s===1 ? '<span class="one" title="Aligned on the first firing">'
                   + '✦ 1</span>' : String(s);
  }
  function esc(s){
    return String(s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  document.getElementById('boardbtn').onclick=openBoard;
  document.getElementById('boardclose').onclick=function(){
    document.getElementById('board').style.display='none';
  };

  document.getElementById('partsbtn').onclick=openParts;
  document.getElementById('partsclose').onclick=closeParts;
  document.getElementById('newpartclose').onclick=function(){
    document.getElementById('newpart').style.display='none';
  };
  addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var np=document.getElementById('newpart');
    if(np.style.display==='flex'){ np.style.display='none'; e.stopPropagation(); return; }
    var bd=document.getElementById('board');
    if(bd.style.display==='flex'){ bd.style.display='none'; e.stopPropagation(); return; }
    var pv=document.getElementById('parts');
    if(pv.style.display==='flex'){ closeParts(); e.stopPropagation(); }
  });
  // Same guard as the observer below: a mobile browser fires a resize while
  // the first level is still being fetched, and fitCanvas reads L.cols.
  addEventListener('resize',function(){ if(!L) return;
    fitCanvas();draw();drawSpec();});

  /* The board must be refitted whenever the stage changes size — not only
   * when the window does.
   *
   * The 'why' strip taught this the hard way. It sits in the same flex column
   * as the board, so opening it makes the stage shorter; the canvas restyles
   * itself to the new height, but `cell`, `offx` and `offy` were last worked
   * out for the old one. The board was then drawn and — worse — *hit-tested*
   * against a stage that no longer existed, so taps landed a square or two
   * from where they were aimed. Every level with a beam expander became
   * unsolvable, and nothing errored.
   *
   * A ResizeObserver on the stage rather than another call bolted onto
   * showWhy(), because the next thing that changes this layout will not
   * remember to call it either. */
  if (typeof ResizeObserver === 'function') {
    var lastW = 0, lastH = 0;
    new ResizeObserver(function () {
      // The observer fires once as soon as it starts watching, which is before
      // the first level has been fetched. `fitCanvas` reads L.cols.
      if (!L) return;
      var st = document.getElementById('stage');
      if (st.clientWidth === lastW && st.clientHeight === lastH) return;
      lastW = st.clientWidth; lastH = st.clientHeight;
      fitCanvas(); draw();
    }).observe(document.getElementById('stage'));
  }
  setInterval(function(){ refreshCampaign(buildLevelButtons); }, 12000);
  refreshCampaign(function(){ loadLevel(Math.min(NLEV,frontier)); });
})();
