/* The Light Path — the optics engine.
 *
 * Søren's ray tracer and seeded level generator. The physics — the wavelength
 * rules for the dichroics and bandpass filters, the lens behaviour, the beam
 * envelope arithmetic — is his and unchanged.
 *
 * **Extended 13 September 2026**, after he played to level 30 and found it
 * repetitive: *"we need to introduce new instruments faster… Please try to
 * explain in the game why we need the different instruments, so that the game
 * becomes educational."* Five parts a real multiphoton table has were added —
 * intensity control, beam dump, Pockels cell, shutter and piezo Z-drive — and
 * with them the thing they teach, which is that **a table has an order**. See
 * `TABLE_ORDER` and `INFO`.
 *
 * The levels are *generated*, from `seed = 0x51ED2701 ^ (n * 2654435761)`, so
 * every member's level 37 is the same level 37 only for as long as this
 * arithmetic is identical everywhere. Change one constant and the campaign
 * quietly fragments: the frontier the server is tracking stops meaning the
 * same puzzle for two different people. **Editing this file therefore means
 * starting a fresh Run**, which is one number in the admin.
 *
 * Checked on every test run: all 100 levels generate, each one's own recorded
 * solution wins when replayed through `simulate()`, and a lens does the same
 * thing whichever way the light arrives. See `tests_lightpath.py`.
 *
 * It is its own file rather than part of the page because it is also a
 * module — `module.exports` at the foot — which is what lets the test drive
 * it with no browser at all.
 */
// The Light Path — engine v2: physics + adversarial seeded level generator
var LM = (function(){
  var DX=[1,0,-1,0], DY=[0,1,0,-1];
  function reflect(o,d){ return o==='/' ? [3,2,1,0][d] : [1,0,3,2][d]; }
  function mirrorFor(din,dout){ return reflect('/',din)===dout ? '/' : '\\'; }
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
    var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;};}

  var DC={dc495:495,dc560:560,dc640:640,dc700:700};
  var BP={f460:[435,485],f525:[500,550],f605:[570,640],f700:[662,738]};
  var CHANFILT={blue:'f460',green:'f525',red:'f605',farred:'f700'};
  var IRLAM=920;

  var LABELS={
    blue:[
      {n:'SHG \u2014 collagen',lam:460,cell:'collagen fibres (second harmonic, exactly 920/2)'},
      {n:'DAPI',lam:461,cell:'cell nuclei'},
      {n:'NADH autofluorescence',lam:460,cell:'metabolically active tissue'},
      {n:'CFP',lam:477,cell:'neurons'}],
    green:[
      {n:'GCaMP6',lam:515,cell:'neurons'},
      {n:'GFAP-GFP',lam:510,cell:'astrocytes'},
      {n:'FITC-dextran',lam:520,cell:'blood plasma / vasculature'},
      {n:'FAD autofluorescence',lam:530,cell:'metabolically active tissue'},
      {n:'PLP-GFP',lam:510,cell:'oligodendrocytes'}],
    red:[
      {n:'SR101',lam:605,cell:'astrocytes'},
      {n:'tdTomato',lam:581,cell:'neurons'},
      {n:'NG2-DsRed',lam:587,cell:'pericytes'},
      {n:'Texas Red dextran',lam:615,cell:'vasculature'},
      {n:'jRGECO1a',lam:587,cell:'neurons'},
      {n:'Sox10-mCherry',lam:610,cell:'oligodendrocytes'}],
    farred:[
      {n:'Alexa 647-dextran',lam:668,cell:'vasculature'},
      {n:'iRFP670',lam:670,cell:'neurons'},
      {n:'SiR-actin',lam:674,cell:'the cytoskeleton'}]
  };
  var NAMES={laser:'Ti:Sapphire laser', mirror:'Mirror', splitter:'50/50 splitter', galvo:'Galvo XY',
    lensCC:'Lens (concave)', lensCX:'Lens (convex)',
    dc495:'Dichroic 495LP', dc560:'Dichroic 560LP', dc640:'Dichroic 640LP', dc700:'Dichroic 700LP',
    f460:'Filter 460/50', f525:'Filter 525/50', f605:'Filter 605/70', f700:'Filter 700/75',
    mic:'Intensity control', pockels:'Pockels cell', shutter:'Shutter',
    piezo:'Piezo Z-drive', dump:'Beam dump'};

  /* Why every one of these is on a real table.
   *
   * Søren, 13 September 2026: *"Please try to explain in the game why we need
   * the different instruments, so that the game becomes educational."*
   *
   * `what` is the part, `why` is the reason a two-photon rig has one, and
   * `rule` is what this game asks of it — always a consequence of the reason,
   * never an arbitrary puzzle constraint. If a rule here cannot be justified
   * by the sentence above it, the rule is wrong and should go.
   */
  var INFO={
    laser:{what:'A mode-locked Ti:Sapphire laser, tuned to 920 nm.',
      why:'Two-photon excitation needs a hundred-femtosecond pulse: the photons have to arrive close enough together that two are absorbed at once, and that only happens where the light is densest — the focus. At 920 nm the beam is invisible, and it is powerful enough to burn.',
      rule:'It does not run while you are building. Press the red button to fire it, and it goes out again the moment you touch the table — which is what you do on a real rig, and for the same reason.'},
    mirror:{what:'A dielectric mirror on a kinematic mount.',
      why:'Steering mirrors are how a beam is aimed. One mirror can only move the beam sideways or tilt it — never both — so a real table always uses them in pairs: two mirrors give the four adjustments needed to put a beam anywhere, at any angle.',
      rule:'Reflects the beam 90°. Tap a placed mirror to flip it the other way.'},
    mic:{what:'Manual intensity control — a half-wave plate in front of a polarising beamsplitter.',
      why:'The laser puts out far more power than a living sample can take. The waveplate turns the polarisation and the polariser passes the part that matches; the rest is full-power light that has to go somewhere safe. This is the coarse setting you make once at the start of a session.',
      rule:'Passes the beam on and throws the rejected part off at 90°. That rejected beam MUST land in a beam dump — an unterminated beam on an optical table is the commonest way people get hurt.'},
    dump:{what:'A beam dump — an anodised cone or a stack of razor blades in a black box.',
      why:'Every beam a table makes has to end somewhere deliberate. A stray reflection at 920 nm is invisible and will still blind you, which is why the first thing anybody is taught is to terminate what they are not using.',
      rule:'Absorbs whatever hits it. The intensity control’s rejected beam has to end here.'},
    pockels:{what:'A Pockels cell — an electro-optic crystal that rotates polarisation with an applied voltage.',
      why:'Scattering means deeper planes need more power, so the excitation is ramped with depth — and blanked during the scanner flyback so the sample is not illuminated between lines. That has to happen in microseconds, which no mechanical shutter can do.',
      rule:'Turn it to stand across the beam \u2014 it is a long crystal with a narrow bore. Needs a collimated beam, because the aperture is a couple of millimetres and a spreading beam clips on it. And at least two steering mirrors between it and the laser, because you cannot walk a beam through that aperture with only one.'},
    shutter:{what:'A mechanical shutter.',
      why:'Between acquisitions the sample should see no light at all. Photobleaching and heating are cumulative, and the beam is on whether or not anybody is imaging.',
      rule:'Turn it to stand across the beam, so the blades open across it. Goes after the Pockels cell and before the scope.'},
    lensCC:{what:'A diverging (concave) lens.',
      why:'First half of a Galilean beam expander. The objective only reaches its full resolution when its back aperture is filled, and a laser beam leaves the head far too narrow for that.',
      rule:'Spreads the beam. Stands across the beam — edge-on it scatters. Turning it round does not change what it does.'},
    lensCX:{what:'A converging (convex) lens.',
      why:'Second half of the expander: it catches the spreading beam and makes it parallel again, now several times wider. The ratio of the two focal lengths is the expansion.',
      rule:'Re-collimates the beam. Put it far enough past the concave lens for the beam to have grown.'},
    piezo:{what:'A piezoelectric objective positioner.',
      why:'Volumetric imaging means moving the focus in Z faster than a stage can — tens of planes a second. The piezo carries the objective itself, so it has to be bolted directly to it.',
      rule:'Sits in the square immediately before the objective. That is the square the filter cube wants, so everything above it has to move up.'},
    galvo:{what:'A galvanometer scan mirror pair.',
      why:'A two-photon microscope makes an image one point at a time. Without a scanner there is no image — only a single bright spot.',
      rule:'Reflects like a mirror, and the beam must come off it before the objective.'},
    splitter:{what:'A 50/50 beamsplitter.',
      why:'A Ti:Sapphire laser is the most expensive thing in the room and one of them can feed two microscopes. The splitter takes the beam just after the intensity control and sends half to each rig; from there the two tables are independent, each with its own modulation and its own scope.',
      rule:'Half carries straight on, half turns 90°. Both halves have to reach an objective — a shared laser means the other rig is somebody else\u2019s experiment, and leaving their half in the air is not an option.'},
    objective:{what:'The objective.',
      why:'It focuses the excitation to a point and collects the emission back through the same glass. Two-photon excitation only happens in the tiny volume where the light is dense enough, which is why no pinhole is needed: all the signal comes from the focus already.',
      rule:'Takes light only along its own axis — the chevron marks the entrance — and wants its back aperture filled.'},
    sample:{what:'The sample.',
      why:'Two photons of 920 nm arrive within a femtosecond of each other and together excite a dye that would normally need one photon of 460 nm. The emission comes straight back up the objective.',
      rule:'Lights up when the focus reaches it, and sends its emission back the way the excitation came.'},
    dc700:{what:'The primary dichroic, in the filter cube.',
      why:'Excitation and emission travel the same glass in opposite directions. A long-pass dichroic passes the 920 nm excitation down and reflects the shorter emission sideways to the detectors.',
      rule:'Passes light longer than 700 nm, reflects light shorter.'},
    pmt:{what:'A photomultiplier tube.',
      why:'Emission from a focus a few hundred microns deep is a handful of photons. A PMT counts them; a camera would not see them at all.',
      rule:'Must receive one colour and only that colour, through its own bandpass filter.'}
  };
  INFO.dc495 = INFO.dc560 = INFO.dc640 = {
    what:'A long-pass dichroic in the detection cascade.',
    why:'With several dyes at once the colours must be separated before they reach the detectors. Cascading long-pass dichroics peels off the shortest wavelength first, then the next, and so on.',
    rule:'Passes wavelengths longer than its number, reflects those shorter.'};
  INFO.f460 = INFO.f525 = INFO.f605 = INFO.f700 = {
    what:'A bandpass emission filter.',
    why:'A dichroic gets a colour approximately right; the bandpass in front of each PMT decides exactly what that detector counts. Without one a PMT sees every stray photon in the room.',
    rule:'Only its own band gets through. Every PMT needs the filter that matches it.'};

  var ROTATABLE={mirror:1,splitter:1,galvo:1,dc495:1,dc560:1,dc640:1,dc700:1,
    lensCC:1,lensCX:1,mic:1,pockels:1,shutter:1};
  // In-line parts with an aperture: they stand ACROSS the beam ('v' for a
  // beam running left-right, 'h' for one running up-down) rather than turning
  // between '/' and '\\' the way a mirror does.
  var INLINE={lensCC:1,lensCX:1,pockels:1,shutter:1};

  /* The order things stand in on a real table, from the laser to the sample.
   *
   * This is not a puzzle rule invented for the game — it is the order in
   * Søren's own layout, and each step is forced by the one before it: set the
   * power while the beam is still raw, modulate it while it is still narrow
   * enough for the crystal, shutter it, expand it to fill the aperture, scan
   * it, then focus it. Build the table in a different order and something
   * downstream cannot do its job.
   */
  var TABLE_ORDER=['mic','pockels','shutter','expand','scan','piezo'];

  /* Why a beam scattered, in words.
   *
   * Søren, 14 September 2026: *"It is not clear to me why the pockels cell is
   * scattering the light?"* — and it was not, because the board said
   * "scatter!" and nothing else. The simulation knew exactly why the whole
   * time and was throwing the reason away.
   *
   * A puzzle may be hard. It must never be mysterious about its own rules. */
  var WHY_SCATTER={
    align:'needs 2 mirrors before it',
    clip:'beam too wide for the crystal',
    edge:'edge-on \u2014 turn it to face the beam'
  };

  /* Did the beam meet everything it needed, and in the right order?
   *
   * `seen` is what the ray collected on its way — ">mic>pockels>shutter" —
   * and `needs` is what this level's objective insists on. Both tests matter:
   * a table missing its shutter is incomplete, and a table with the expander
   * before the Pockels cell is one where the cell clips the beam. Only the
   * *relative* order of the things asked for is checked, so a level that does
   * not use a shutter does not care where a shutter would have gone.
   */
  /* What is wrong with this table, if anything — and **missing is not the
   * same as out of order**.
   *
   * Søren, 14 September 2026: *"It keeps saying wrong order, even though they
   * are in the right order, it is just the piezo motor missing."* He was
   * right: `orderOK` answered one boolean for two quite different faults, and
   * the objective printed the wronger of the two explanations. Somebody with
   * a correctly built table was being told to rearrange it.
   *
   * Returns `null` when the table is good, `{missing:[…]}` naming what is not
   * there yet, or `{outOfOrder:true}` when everything is present but in the
   * wrong sequence. The missing list comes back in table order, so the first
   * name in it is the next thing to put down.
   */
  function orderProblem(seen, needs){
    if(!needs || !needs.length) return null;
    var got = (seen||'').split('>').filter(function(x){return x;});
    var missing = TABLE_ORDER.filter(function(t){
      return needs.indexOf(t)>=0 && got.indexOf(t)<0; });
    if(missing.length) return {missing:missing};
    var wanted = TABLE_ORDER.filter(function(t){ return needs.indexOf(t)>=0; });
    var at = -1;
    for(var j=0;j<wanted.length;j++){
      var k = got.indexOf(wanted[j]);
      if(k<=at) return {outOfOrder:true};
      at = k;
    }
    return null;
  }
  function orderOK(seen, needs){ return !orderProblem(seen, needs); }

  // What to call each step when the objective has to name it.
  var STEP_NAME={mic:'intensity control', pockels:'Pockels cell',
    shutter:'shutter', expand:'beam expander', scan:'galvo',
    piezo:'piezo Z-drive'};
  // ================== SIMULATION ==================
  function simulate(L, placed){
    var grid={};
    L.fixed.forEach(function(f){grid[f.x+','+f.y]=f;
      f._state=undefined; f._lit=false; f._missing=null;});
    for(var k in placed){ grid[k]=placed[k]; }
    var segments=[], scatters=[], strays=[], pmtHits={}, rays=[], seen={};
    var rejects=0, dumped=0;
    L.fixed.forEach(function(f){ if(f.t==='laser')
      rays.push({x:f.x,y:f.y,d:f.d,lam:IRLAM,chan:'ir',hw:2,v:'col',scanned:false,
                 filt:null, folds:0, seen:''}); });
    var guard=0;
    while(rays.length && guard++<8000){
      var r=rays.shift();
      var key=[r.x,r.y,r.d,r.lam,Math.round(r.hw),r.v,r.scanned?1:0,r.filt||''].join('|');
      if(seen[key])continue; seen[key]=1;
      var nx=r.x+DX[r.d], ny=r.y+DY[r.d];
      if(nx<0||ny<0||nx>=L.cols||ny>=L.rows){
        // A rejected beam that walks off the table is the stray that matters.
        if(r.reject) strays.push({x:r.x,y:r.y,off:true});
        continue;
      }
      var hw2=r.hw, cross=false;
      if(r.chan==='ir'){
        if(r.v==='div')hw2=Math.min(9,r.hw+3);
        else if(r.v==='con'){hw2=r.hw-5;if(hw2<=0){hw2=0;cross=true;}}
      }
      segments.push({x1:r.x,y1:r.y,x2:nx,y2:ny,chan:r.chan,d:r.d,h1:r.hw,h2:hw2,cross:cross});
      var v2=r.v; if(cross){v2='div';hw2=0.5;}
      var comp=grid[nx+','+ny];
      function go(d,extra){
        var n2={x:nx,y:ny,d:d,lam:r.lam,chan:r.chan,hw:hw2,v:v2,scanned:r.scanned,
                filt:r.filt, folds:r.folds||0, seen:r.seen||'', reject:r.reject};
        if(extra)for(var kk in extra)n2[kk]=extra[kk];
        rays.push(n2);
      }
      // What this beam has been through, in the order it met it. The
      // objective reads it to decide whether the table was built in the right
      // order — see TABLE_ORDER.
      function met(tok){ return ((r.seen||'') + '>' + tok); }
      if(!comp || comp.t==='zone'){ go(r.d); continue; }
      var t=comp.t;
      // A rejected beam that ends anywhere but a dump is a stray beam, and
      // that is the thing on an optical table that actually hurts somebody.
      if(r.reject && t!=='dump' && t!=='mirror' && t!=='mic'){ strays.push({x:nx,y:ny}); continue; }
      if(t==='block'||t==='laser'){ if(r.reject) strays.push({x:nx,y:ny}); continue; }
      if(t==='dump'){ if(r.reject) dumped++; comp._lit=true; continue; }
      if(t==='mic'){
        // Half-wave plate plus polarising beamsplitter. What passes is the
        // matched polarisation; what leaves at 90° is the rest of the laser's
        // power, and it has to be terminated.
        if(r.chan!=='ir' || r.reject){ go(r.d); continue; }
        go(r.d,{seen:met('mic')});
        rejects++;
        go(reflect(comp.o,r.d),{reject:true});
        continue;
      }
      if(t==='shutter'){
        if(r.chan!=='ir'){ go(r.d); continue; }
        // Blades that open across the beam. Søren, 14 September 2026: *"the
        // design of the pockels cell and the shutter indicates that they have
        // to be placed in a certain direction, either they need to be able to
        // be turned, or they should have another design."* They are turnable
        // now, and the drawing was right all along.
        if((comp.o||'v')!==((r.d===0||r.d===2)?'v':'h')){
          scatters.push({x:nx,y:ny,chan:r.chan,why:'edge'}); continue; }
        go(r.d,{seen:met('shutter')});
        continue;
      }
      if(t==='piezo'){
        if(r.chan!=='ir'){ go(r.d); continue; }
        go(r.d,{seen:met('piezo')});
        continue;
      }
      if(t==='pockels'){
        if(r.chan!=='ir'){ go(r.d); continue; }
        // The crystal aperture is a couple of millimetres: a beam that is not
        // collimated clips on it. So the cell belongs before the expander,
        // which is also where a real table puts it.
        // A long crystal with a narrow bore: it has to lie along the beam.
        if((comp.o||'v')!==((r.d===0||r.d===2)?'v':'h')){
          scatters.push({x:nx,y:ny,chan:r.chan,why:'edge'}); continue; }
        if(r.v!=='col'){ scatters.push({x:nx,y:ny,chan:r.chan,why:'clip'}); continue; }
        // And you cannot walk a beam through that aperture with one mirror —
        // two are needed to set position and angle independently.
        if((r.folds||0)<2){ scatters.push({x:nx,y:ny,chan:r.chan,why:'align'}); continue; }
        go(r.d,{seen:met('pockels')});
        continue;
      }
      if(t==='objective'){
        var acc = (comp.accept===undefined)?1:comp.accept;
        if(r.d===acc && r.chan==='ir'){
          var okW=!comp.needWide||(r.v==='col'&&hw2>=6);
          var okS=!comp.needScan||r.scanned;
          var prob=orderProblem(r.seen||'', comp.needs||[]);
          if(okW&&okS&&!prob){comp._state='lit'; go(acc,{v:'con',hw:6});}
          else if(comp._state!=='lit'){
            comp._state = !prob ? 'under'
                        : prob.missing ? 'missing' : 'order';
            comp._missing = prob && prob.missing ? prob.missing : null;
          }
        }else if(r.d===((acc+2)%4) && r.chan!=='ir'){ go(r.d); }
        continue;
      }
      if(t==='pmt'){
        var id=nx+','+ny;
        (pmtHits[id]=pmtHits[id]||{})[r.chan+(r.filt===r.chan?'*':'')]=1;
        continue;
      }
      if(t==='mirror'){ go(reflect(comp.o,r.d),{folds:(r.folds||0)+1}); continue; }
      if(t==='galvo'){ go(reflect(comp.o,r.d),
                          {scanned:true, folds:(r.folds||0)+1, seen:met('scan')}); continue; }
      if(t==='splitter'){ go(r.d); go(reflect(comp.o,r.d)); continue; }
      if(DC[t]){ if(r.lam>DC[t]) go(r.d); else go(reflect(comp.o,r.d)); continue; }
      if(BP[t]){ var b=BP[t];
        if(r.lam>=b[0]&&r.lam<=b[1]) go(r.d,{filt:r.chan});
        continue; }
      if(t==='lensCC'||t==='lensCX'){
        /* A lens has one power, and it is the same from either side.
         *
         * Turning a lens end-for-end swaps its two surfaces *and* flips the
         * sign of both radii, because the light now runs the other way:
         * R1' = -R2 and R2' = -R1. Put that through the lensmaker's equation,
         *
         *     1/f = (n-1)(1/R1 - 1/R2)
         *     1/f' = (n-1)(1/(-R2) - 1/(-R1)) = (n-1)(1/R1 - 1/R2) = 1/f
         *
         * and the focal length is unchanged. So a diverging lens cannot be
         * turned round to converge, and the two branches below depend on
         * which lens it is and never on `r.d`. This is deliberate, and it is
         * the one thing here not to "fix" — see the note on the drawing in
         * lightpath.js, which is where the real mistake was.
         *
         * What the orientation *does* decide is whether the beam meets the
         * lens face-on at all. Edge-on, the light hits the rim rather than
         * the polished surface and scatters, which is the line below. */
        var need = (r.d===0||r.d===2)?'v':'h';
        if((comp.o||'v')!==need){
          scatters.push({x:nx,y:ny,chan:r.chan,why:'edge'}); continue; }
        if(r.chan!=='ir'){ go(r.d); continue; }
        if(t==='lensCC'){
          if(r.v==='col')go(r.d,{v:'div'});
          else if(r.v==='con')go(r.d,{v:'col'});
          else go(r.d,{v:'div'});
        }else{
          // Catching a spreading beam and making it parallel again is the
          // moment the expander has done its work, so that is where the
          // 'expand' step is recorded.
          if(r.v==='div')go(r.d,{v:'col', seen:met('expand')});
          else if(r.v==='col')go(r.d,{v:'con'});
          else go(r.d);
        }
        continue;
      }
      if(t==='sample'){
        if(r.chan==='ir'){
          comp._lit=true;
          var back=(r.d+2)%4;
          (comp.labels||[]).forEach(function(lb){
            rays.push({x:nx,y:ny,d:back,lam:lb.lam,chan:lb.chan,hw:2,v:'col',scanned:false,filt:null});
          });
        }
        continue;
      }
    }
    var win=true;
    L.fixed.forEach(function(f){
      if(f.t==='objective'){ if(f._state!=='lit'){win=false; if(f._state===undefined)f._state='dark';} }
      if(f.t==='sample'){ if(!f._lit) win=false; }
      if(f.t==='pmt'){
        var h=pmtHits[f.x+','+f.y]||{}, ks=Object.keys(h);
        var ok=ks.length===1&&ks[0]===f.need+'*';
        f._state=ok?'lit':(ks.length?'noisy':'dark');
        if(!ok)win=false;
      }
    });
    // Every beam the table makes has to end somewhere deliberate. The
    // intensity control throws away most of the laser's power, and that beam
    // is as dangerous as the one you are using.
    if(rejects!==dumped || strays.length) win=false;
    // The piezo carries the objective, so it is bolted to it: the square
    // immediately in front. Checked here rather than as the beam passes,
    // because what matters is *where it is*, not that the light went through.
    var piezoOnTable=false;
    for(var gk in grid){ if(grid[gk] && grid[gk].t==='piezo'){ piezoOnTable=true; break; } }
    L.fixed.forEach(function(f){
      if(f.t!=='objective' || (f.needs||[]).indexOf('piezo')<0) return;
      var acc=(f.accept===undefined)?1:f.accept;
      var bx=f.x-DX[acc], by=f.y-DY[acc];
      var at=grid[bx+','+by];
      if(!at || at.t!=='piezo'){
        win=false;
        // Present but bolted somewhere else. Saying "wrong order" — or "still
        // needs a piezo" — here would send somebody hunting for a part that is
        // already on the table, or rearranging one that is already in order.
        // A piezo off the beam never reaches `seen`, so it reads as missing
        // until we say otherwise.
        if(!piezoOnTable) return;
        if(f._state==='lit'){ f._state='piezoplace'; f._missing=null; }
        else if(f._state==='missing' && f._missing
                && f._missing.length===1 && f._missing[0]==='piezo'){
          f._state='piezoplace'; f._missing=null;
        }
      }
    });
    return {win:win, segments:segments, scatters:scatters, strays:strays,
            rejects:rejects, dumped:dumped};
  }

  // ================== GENERATOR ==================
  /* Eleven stages, and something new in every one of them.
   *
   * Søren, 13 September 2026, having played to level 30: *"around the 30's it
   * gets really repetitive and too easy when you already understood what the
   * different instruments are for."* He was right, and measurably so — the old
   * eight tiers introduced their last new part at level 41 and then repeated
   * for fifty-nine levels, while every knob but the mirror count was at its
   * ceiling by level 54.
   *
   * Three things changed:
   *
   * **Something new every three to six levels** instead of every six to
   * sixteen, so the last genuinely new idea lands at 47 rather than 41 with
   * nothing between.
   *
   * **The fold count no longer resets at a stage boundary.** It used to drop
   * from five back to two at every new tier, which made the game easier five
   * times over and bought one interesting level for four dull ones. It now
   * climbs across the whole campaign.
   *
   * **The obstacles keep climbing to 100** rather than stopping at 54.
   *
   * The 50/50 splitter lost its stage. Søren: *"why would you split the beam
   * if you don't need that?"* — and he is right that a multiphoton excitation
   * path does not. It stays in the decoy pool, where being offered a part you
   * should not use is its own small lesson.
   */
  var STAGES=[
    {from:1,  teaches:'mirror',  needs:[]},
    {from:6,  teaches:'shutter', needs:['shutter']},
    {from:11, teaches:'mic',     needs:['mic','shutter']},
    {from:17, teaches:'detect',  needs:['mic','shutter']},
    {from:23, teaches:'pockels', needs:['mic','pockels','shutter']},
    {from:29, teaches:'expand',  needs:['mic','pockels','shutter','expand']},
    {from:35, teaches:'piezo',   needs:['mic','pockels','shutter','expand','piezo']},
    {from:41, teaches:'scan',    needs:['mic','pockels','shutter','expand','scan','piezo']},
    {from:52, teaches:'twocolour', needs:['mic','pockels','shutter','expand','scan','piezo']},
    {from:60, teaches:'share', needs:['mic','pockels','shutter','expand','scan','piezo']},
    {from:72, teaches:'threecolour', needs:['mic','pockels','shutter','expand','scan','piezo']},
    {from:86, teaches:'fourcolour', needs:['mic','pockels','shutter','expand','scan','piezo']}
  ];
  function stageOf(n){
    var s=0;
    for(var i=0;i<STAGES.length;i++){ if(n>=STAGES[i].from) s=i; }
    return s;
  }
  function tierOf(n){ return stageOf(n)+1; }

  function genLevel(n){
    var si=stageOf(n), stage=STAGES[si], tier=si+1;
    var q=n-stage.from;
    var kCh = si<3?0 : si<8?1 : si<10?2 : si===10?3 : 4;
    var detect = si>=3;
    var hasShutter = stage.needs.indexOf('shutter')>=0;
    var hasMIC = stage.needs.indexOf('mic')>=0;
    var hasPockels = stage.needs.indexOf('pockels')>=0;
    var needLens = stage.needs.indexOf('expand')>=0;
    var needPiezo = stage.needs.indexOf('piezo')>=0;
    var needScan = stage.needs.indexOf('scan')>=0;

    // Room for what the stage puts on the table, and no more.
    var C = si<3?7 : si<6?8 : si<9?9 : 10;
    var R = si<2?9 : si<4?10 : si<7?11 : 12;
    // Sharing the laser needs room for a second rig beside the first.
    var share = stage.needs && si>=9 && si<10;
    if(share){ C += 1; }

    /* Folds climb across the whole campaign rather than resetting at every
     * stage, which is what used to make the game easier five times over.
     *
     * The ceiling is the board: seven squares across will not take seven
     * folds and a beam expander. The Pockels cell needs two steering mirrors
     * before it, so from the stage that introduces it there is a floor of
     * three. */
    var foldCap = si<3?4 : si<6?5 : si<9?6 : 7;
    if(share) foldCap = 5;   // the branch needs space too
    var foldsBase = Math.min(foldCap, 1 + Math.floor((n+2)/5));
    if(hasPockels) foldsBase = Math.max(3, foldsBase);
    if(hasMIC) foldsBase = Math.max(2, foldsBase);

    var chanSets={1:[['green'],['red']],2:[['green','red']],
                  3:[['blue','green','red'],['green','red','farred']],
                  4:[['blue','green','red','farred']]};
    var CUT={'blue':495,'green':560,'red':640};

    var seed = 0x51ED2701 ^ (n*2654435761);
    for(var attempt=0; attempt<400; attempt++){
      var relax = Math.floor(attempt/80);
      var floor = hasPockels?3 : hasMIC?2 : 1;
      var folds = Math.max(floor, foldsBase - relax);
      var lvl = tryBuild(mulberry32(seed ^ (attempt*7919+1)), {
        C:C, R:R, tier:tier, stage:si, kCh:kCh, folds:folds, detect:detect,
        needLens:needLens, needScan:needScan, needPiezo:needPiezo,
        hasMIC:hasMIC, hasPockels:hasPockels, hasShutter:hasShutter,
        needs:stage.needs, share:share,
        // The obstacles now go on climbing to the end of the campaign
        // instead of reaching their ceiling at level 54.
        corridors: Math.max(0, Math.min(1+Math.floor(n/9),8) - relax),
        zones: n>6 ? Math.max(0, Math.min(1+Math.floor(n/14),6) - relax) : 0,
        decoys: Math.min(1+Math.floor(n/10),6),
        chanSet: chanSets[kCh]||null, CUT:CUT
      });
      if(lvl){
        var res=simulate(lvl, lvl.solution);
        if(res.win){
          lvl.n=n; lvl.name='Level '+n; lvl.tier=tier; lvl.stage=si;
          lvl.teaches=(q===0)?stage.teaches:null;
          lvl.hint = hintFor(si, lvl);
          return lvl;
        }
      }
    }
    throw new Error('generator failed for level '+n);
  }

  /* The line under the title. One sentence of what this stage is about, and
   * on the level that introduces a part, what that part is for.
   *
   * Søren: *"Please try to explain in the game why we need the different
   * instruments, so that the game becomes educational."* The full explanation
   * is in INFO and shown when a part is picked up; this is the reminder.
   */
  var STAGE_HINT=[
    'Build it with the laser off, then press the red button to fire it \u2014 touching the table blocks the beam again, exactly as on a real rig. Fold the 920 nm beam into the objective: it only accepts light along its optical axis, and the chevron marks the entrance. Two mirrors is how a table aims a beam \u2014 one to move it, one to angle it.',
    'Put the shutter in the beam. The laser runs all session; the sample should only see light while you are actually imaging.',
    'The intensity control passes the power you want and throws the rest off at 90°. That rejected beam is still full-power invisible infrared — it must end in a beam dump.',
    'The emission comes back up the same path. The 700LP dichroic passes your 920 nm down and reflects the shorter emission sideways; each PMT needs its own bandpass or it only sees noise.',
    'The Pockels cell ramps the power with depth and blanks it during flyback. Its crystal aperture is millimetres wide, so it needs a collimated beam — and at least two steering mirrors between it and the laser to walk the beam through.',
    'Fill the objective’s back aperture: concave to spread the beam, convex to make it parallel again once it has grown. Expand AFTER the Pockels cell — a wide beam clips on the crystal.',
    'The piezo carries the objective so the focus can step in Z. It bolts directly underneath, in the square the filter cube would like — so everything above has to move up.',
    'No image without scanning. The beam must come off the galvo before the objective, and after the expander.',
    'Two colours at once: the cascade takes the shorter wavelength off first, then the rest.',
    'One Ti:Sapphire, two microscopes. Split the beam just after the intensity control and deliver half to the second rig \u2014 their half is somebody else\u2019s experiment, and it has to reach their objective too.',
    'Three colours. Shortest reflects first; give every PMT the bandpass that matches it.',
    'Four colours, a full cascade, and a table with no room left to be careless.'
  ];
  var TEACH_LINE={
    mirror:'New: the mirror.',
    shutter:'New on the table: the shutter.',
    mic:'New on the table: intensity control, and the beam dump it makes necessary.',
    detect:'New: the sample, the filter cube and a detector.',
    pockels:'New on the table: the Pockels cell.',
    expand:'New on the table: the beam expander.',
    piezo:'New on the table: the piezo Z-drive.',
    scan:'New on the table: the galvo scanner.',
    twocolour:'Now two colours at once.',
    share:'New on the table: the beamsplitter, and a second microscope sharing your laser.',
    threecolour:'Now three colours.',
    fourcolour:'Now four colours.'
  };

  function hintFor(si, lvl){
    var h = STAGE_HINT[si] || STAGE_HINT[STAGE_HINT.length-1];
    var s=null; lvl.fixed.forEach(function(f){if(f.t==='sample')s=f;});
    if(s && s.desc) h += ' Sample: ' + s.desc.join(' · ') + '.';
    return h;
  }

  function tryBuild(rnd, cfg){
    var C=cfg.C, R=cfg.R;
    function ri(a,b){ if(b<a)return a; return a + Math.floor(rnd()*(b-a+1)); }
    function pick(arr){ return arr.length?arr[Math.floor(rnd()*arr.length)]:null; }
    var occ={}, path={}, detCells={};
    var fixed=[], sol={}, tray=[];
    function inb(x,y){return x>=0&&y>=0&&x<C&&y<R;}
    function free(x,y){var k=x+','+y;
      return inb(x,y)&&!occ[k]&&!path[k]&&!detCells[k];}
    function fix(o){fixed.push(o); occ[o.x+','+o.y]=1;}
    function put(x,y,t,o){ sol[x+','+y]={t:t,o:o}; occ[x+','+y]=1; tray.push(t); }

    function dirSeq(d0, folds, forceFinal){
      for(var tr=0; tr<40; tr++){
        var ds=[d0];
        for(var i=0;i<folds;i++){
          var turn = rnd()<0.5?1:3;
          ds.push((ds[ds.length-1]+turn)%4);
        }
        if(forceFinal===undefined || ds[ds.length-1]===forceFinal) return ds;
      }
      return null;
    }

    function layWalk(sx,sy,ds,opt){
      opt=opt||{};
      var pos={x:sx,y:sy}, foldCells=[], runs=[];
      for(var i=0;i<ds.length;i++){
        var d=ds[i], last=(i===ds.length-1);
        var minL = (opt.minRuns && opt.minRuns[i]) ? opt.minRuns[i] : 2;
        var margin = last ? (opt.endMargin||0) : 0;
        var maxL=0, tx=pos.x, ty=pos.y;
        while(true){
          tx+=DX[d]; ty+=DY[d];
          if(!inb(tx,ty))break;
          if(occ[tx+','+ty]||path[tx+','+ty]||detCells[tx+','+ty])break;
          maxL++;
        }
        maxL-=margin;
        if(maxL<minL) return null;
        var Lr=ri(minL, Math.min(maxL, minL+2+Math.floor(rnd()*4)));
        var cells=[];
        for(var s2=1;s2<=Lr;s2++){
          cells.push({x:pos.x+DX[d]*s2, y:pos.y+DY[d]*s2});
        }
        cells.forEach(function(c,idx){
          if(idx<cells.length-1) path[c.x+','+c.y]=1;
        });
        var end=cells[cells.length-1];
        if(!last){
          foldCells.push({x:end.x,y:end.y,din:d,dout:ds[i+1]});
          occ[end.x+','+end.y]=1;
        }
        runs.push({d:d, cells:cells});
        pos=end;
      }
      return {end:pos, folds:foldCells, runs:runs, endDir:ds[ds.length-1]};
    }

    /* Lay the in-line parts along the path, in the order a table has them.
     *
     * MIC first, straight out of the laser; Pockels cell only after two
     * steering mirrors, because that is the least you can align a beam
     * through a millimetre aperture with; shutter after the cell; the
     * expander after that, so the cell never sees a beam too wide for it;
     * the piezo bolted to the objective. Each of those is the real reason,
     * not a puzzle constraint — see INFO at the top of this file.
     *
     * The cursor only ever moves forwards through `pathSeq`, so the order on
     * the finished table is the order in this function.
     */
    function layInline(w){
      var seq = pathSeq(w), at = 0;
      function take(minRun){
        while(at < seq.length){
          var c = seq[at];
          if(c.run >= (minRun||0) && !occ[c.x+','+c.y]){ at++; return c; }
          at++;
        }
        return null;
      }

      if(cfg.hasMIC){
        // Straight out of the laser, before anything else touches the beam.
        var m = take(0);
        if(!m || m.run>0) return false;
        // The rejected polarisation leaves at 90°, and it has to be able to
        // reach somewhere a dump will fit. If neither side is clear the layout
        // is not usable — a table you cannot make safe is not a table.
        var side = null, dumpAt = null;
        [1,3].forEach(function(turn){
          if(side!==null) return;
          var rd = (m.d + turn) % 4;
          var tx = m.x + DX[rd], ty = m.y + DY[rd], steps = 0;
          while(inb(tx,ty) && free(tx,ty) && steps < 4){
            dumpAt = {x:tx, y:ty}; side = rd; steps++;
            if(steps >= 2 && rnd() < 0.5) break;
            tx += DX[rd]; ty += DY[rd];
          }
          if(steps === 0){ side = null; dumpAt = null; }
        });
        if(side === null) return false;
        delete path[m.x+','+m.y];
        put(m.x, m.y, 'mic', mirrorFor(m.d, side));
        put(dumpAt.x, dumpAt.y, 'dump', null);
        // The squares the rejected beam crosses must stay clear, or an
        // obstacle drops into it later and the level becomes unsolvable.
        var cx2 = m.x + DX[side], cy2 = m.y + DY[side];
        while(cx2 !== dumpAt.x || cy2 !== dumpAt.y){
          path[cx2+','+cy2] = 1; cx2 += DX[side]; cy2 += DY[side];
        }
      }

      if(cfg.share){
        /* Søren, 13 September 2026: *"Sometimes lasers can be shared between
         * two two-photon setups, I guess that is when a beam splitter may be
         * relevant."* — and he found it by noticing the splitter was offered
         * and never once the answer.
         *
         * So it splits here, straight after the intensity control and before
         * the Pockels cell, which is where a shared Ti:Sa really is tapped:
         * from the splitter on, the two rigs are independent and each does
         * its own modulating and scanning. The second objective asks for
         * nothing but light on its axis, because the rest of that table is
         * not this puzzle. */
        var sp = take(0);
        if(!sp) return false;
        var outd = (sp.d + (rnd()<0.5?1:3)) % 4;
        delete path[sp.x+','+sp.y];
        put(sp.x, sp.y, 'splitter', mirrorFor(sp.d, outd));
        var bFolds = Math.max(1, Math.min(2, cfg.folds - 2));
        var ds2 = dirSeq(outd, bFolds);
        if(!ds2) return false;
        var bw = layWalk(sp.x, sp.y, ds2, {});
        if(!bw) return false;
        bw.folds.forEach(function(f){ put(f.x, f.y, 'mirror', mirrorFor(f.din, f.dout)); });
        fix({t:'objective', x:bw.end.x, y:bw.end.y, accept:bw.endDir, needs:[]});
      }

      if(cfg.hasPockels){
        // run >= 2 is exactly "two steering mirrors between here and the
        // laser", which is the alignment rule the INFO card explains.
        var pc = take(2);
        if(!pc || pc.run < 2) return false;
        delete path[pc.x+','+pc.y];
        // Across the beam, like a lens: it is a crystal with a bore, not a
        // thing light passes any way round.
        put(pc.x, pc.y, 'pockels', (pc.d===0||pc.d===2)?'v':'h');
      }

      if(cfg.hasShutter){
        var sh = take(0);
        if(!sh) return false;
        delete path[sh.x+','+sh.y];
        put(sh.x, sh.y, 'shutter', (sh.d===0||sh.d===2)?'v':'h');
      }

      if(cfg.needLens){
        // Two cells in the same run with a gap between them, so the beam has
        // room to grow before the convex lens catches it.
        var a2=null, b2=null;
        while(at < seq.length-1){
          var c1 = seq[at];
          for(var k2 = at+1; k2 < seq.length; k2++){
            var c2 = seq[k2];
            if(c2.run !== c1.run) break;
            var gap = Math.abs(c2.x-c1.x) + Math.abs(c2.y-c1.y);
            if(gap >= 2 && !occ[c1.x+','+c1.y] && !occ[c2.x+','+c2.y]){
              a2=c1; b2=c2; at=k2+1; break;
            }
          }
          if(a2) break;
          at++;
        }
        if(!a2) return false;
        var o2 = (a2.d===0||a2.d===2) ? 'v' : 'h';
        delete path[a2.x+','+a2.y]; delete path[b2.x+','+b2.y];
        put(a2.x, a2.y, 'lensCC', o2); put(b2.x, b2.y, 'lensCX', o2);
      }

      if(cfg.needPiezo){
        // Bolted to the objective: the square immediately in front of it,
        // which is the square the filter cube would otherwise want.
        var last = seq[seq.length-1];
        if(!last || occ[last.x+','+last.y]) return false;
        if(at > seq.length-1) return false;
        delete path[last.x+','+last.y];
        put(last.x, last.y, 'piezo', null);
      }
      return true;
    }

    // laser on a random edge
    var edge=ri(0,3), lx,ly,d0;
    if(edge===0){lx=0; ly=ri(1,R-2); d0=0;}
    else if(edge===2){lx=C-1; ly=ri(1,R-2); d0=2;}
    else if(edge===1){lx=ri(1,C-2); ly=0; d0=1;}
    else {lx=ri(1,C-2); ly=R-1; d0=3;}
    fix({t:'laser',x:lx,y:ly,d:d0});

    /* The cells the beam passes through, in the order it passes through them.
     *
     * This is what makes a table *order* expressible. The parts a real
     * multiphoton path carries — intensity control, Pockels cell, shutter,
     * expander, piezo — are not interchangeable: each is where it is because
     * of the one before it. Laying them out therefore needs the path as a
     * sequence rather than as a set of runs, and a cursor that only ever
     * moves forwards.
     *
     * Folds are left out: those cells hold steering mirrors.
     */
    function pathSeq(w){
      var out=[];
      w.runs.forEach(function(rr, rIdx){
        rr.cells.forEach(function(c, cIdx){
          var isFold = (rIdx < w.runs.length-1) && (cIdx === rr.cells.length-1);
          var isEnd  = (rIdx === w.runs.length-1) && (cIdx === rr.cells.length-1);
          if(isFold || isEnd) return;
          out.push({x:c.x, y:c.y, run:rIdx, d:rr.d});
        });
      });
      return out;
    }

    var walk, mainAccept;
    if(!cfg.detect){
      var ds0=dirSeq(d0,cfg.folds);
      if(!ds0)return null;
      walk=layWalk(lx,ly,ds0,{minRuns:{0:3}});
      if(!walk)return null;
      mainAccept=walk.endDir;
      fix({t:'objective',x:walk.end.x,y:walk.end.y,accept:mainAccept,
           needs:cfg.needs});
      walk.folds.forEach(function(f){ put(f.x,f.y,'mirror',mirrorFor(f.din,f.dout)); });
      if(!layInline(walk)) return null;
    }else{
      var parityNeeded = (d0===1||d0===3) ? 0 : 1;
      var folds=cfg.folds;
      if((folds%2)!==parityNeeded) folds++;
      var ds1=dirSeq(d0,folds,1);
      if(!ds1)return null;
      var minRuns={}; minRuns[ds1.length-1]=cfg.needPiezo?5:4;
      minRuns[0]=cfg.hasMIC?4:3;
      walk=layWalk(lx,ly,ds1,{minRuns:minRuns, endMargin:1});
      if(!walk)return null;
      mainAccept=1;
      var ox=walk.end.x, oy=walk.end.y;
      if(!free(ox,oy+1)) return null;
      fix({t:'objective',x:ox,y:oy,accept:1,
           needWide:cfg.needLens, needScan:cfg.needScan, needs:cfg.needs});
      var chans=cfg.chanSet?pick(cfg.chanSet):['green'];
      var labels=[],descr=[];
      chans.forEach(function(ch){var lb=pick(LABELS[ch]);
        labels.push({chan:ch,lam:lb.lam,n:lb.n});
        descr.push(lb.n+' in '+lb.cell+' ('+lb.lam+' nm)');});
      fix({t:'sample',x:ox,y:oy+1,labels:labels,desc:descr});
      if(!layInline(walk)) return null;
      // The scanner goes on one of the later folds: the beam has to come off
      // it before the objective, and it belongs after the expander.
      var firstLate = Math.max(1, Math.floor(walk.folds.length/2));
      var gi=cfg.needScan? ri(firstLate, walk.folds.length-1) : -1;
      walk.folds.forEach(function(f,idx){
        put(f.x,f.y, idx===gi?'galvo':'mirror', mirrorFor(f.din,f.dout));
      });
      var dx0=ox, dy0=oy-2;
      if(!path[dx0+','+dy0]) return null;
      delete path[dx0+','+dy0];
      function tryside(side){
        var sorted=chans.slice().sort(function(a,b){
          var o2={blue:0,green:1,red:2,farred:3};return o2[a]-o2[b];});
        var col=dx0, found=0, chosen=[];
        while(found<sorted.length){
          col+=(side===0?1:-1);
          if(!inb(col,dy0)) return null;
          if(free(col,dy0)&&free(col,dy0+1)&&free(col,dy0+2)){ chosen.push(col); found++; }
          else if(!path[col+','+dy0] || occ[col+','+dy0]) return null;
        }
        return {sorted:sorted, chosen:chosen, side:side};
      }
      var side0=(dx0>C/2)?2:0; if(rnd()<0.3)side0=(side0===0)?2:0;
      var det=tryside(side0)||tryside(side0===0?2:0);
      if(!det)return null;
      put(dx0,dy0,'dc700', det.side===0?'/':'\\');
      det.chosen.forEach(function(cc,i5){
        var ch2=det.sorted[i5];
        var horiz=det.side===0?0:2;
        if(i5<det.sorted.length-1) put(cc,dy0,'dc'+cfg.CUT[ch2], mirrorFor(horiz,1));
        else put(cc,dy0,'mirror', mirrorFor(horiz,1));
        put(cc,dy0+1, CHANFILT[ch2]);
        fix({t:'pmt',x:cc,y:dy0+2,need:ch2});
        detCells[cc+','+(dy0+1)]=1;
      });
      var lastc=det.chosen[det.chosen.length-1];
      for(var cc2=Math.min(dx0,lastc); cc2<=Math.max(dx0,lastc); cc2++){
        if(!occ[cc2+','+dy0]) detCells[cc2+','+dy0]=1;
      }
    }

    // The 50/50 splitter had a stage of its own and no longer does. Søren:
    // *"why would you split the beam if you don't need that?"* — a multiphoton
    // excitation path does not. It stays in the decoy pool below, where being
    // offered a part you should not use is its own small lesson.

    // ---- adversarial obstacles ----
    if(walk.folds.length){
      var f0=walk.folds[0];
      var bx=f0.x+DX[f0.din], by=f0.y+DY[f0.din];
      if(free(bx,by)) fix({t:'block',x:bx,y:by});
    }
    fixed.slice().forEach(function(f){
      if(f.t!=='objective')return;
      var acc=(f.accept===undefined)?1:f.accept;
      var ix,iy;
      if((d0===0||d0===2)&&(acc===1||acc===3)){ ix=f.x; iy=ly; }
      else if((d0===1||d0===3)&&(acc===0||acc===2)){ ix=lx; iy=f.y; }
      else return;
      var entryOK = acc===1? iy<f.y : acc===3? iy>f.y : acc===0? ix<f.x : ix>f.x;
      var fwdOK = d0===0? ix>lx : d0===2? ix<lx : d0===1? iy>ly : iy<ly;
      if(entryOK && fwdOK && free(ix,iy)) fix({t:'block',x:ix,y:iy});
    });
    var pcells=Object.keys(path);
    for(var cor=0; cor<cfg.corridors && pcells.length; cor++){
      var pk=pcells.splice(Math.floor(rnd()*pcells.length),1)[0].split(',');
      var px2=+pk[0], py2=+pk[1];
      var cands=(rnd()<0.5)?[[px2,py2-1],[px2,py2+1]]:[[px2-1,py2],[px2+1,py2]];
      for(var ci=0;ci<2;ci++){
        if(free(cands[ci][0],cands[ci][1])){
          fix({t:'block',x:cands[ci][0],y:cands[ci][1]}); break;
        }
      }
    }
    var pz=Object.keys(path);
    for(var z=0; z<cfg.zones && pz.length; z++){
      var zk=pz.splice(Math.floor(rnd()*pz.length),1)[0].split(',');
      fix({t:'zone',x:+zk[0],y:+zk[1]});
    }
    var decoyPool=['mirror','mirror','lensCX','splitter','f525','f605','dc560',
                   'shutter','dump'];
    for(var d3=0;d3<cfg.decoys;d3++) tray.push(pick(decoyPool));
    for(var i6=tray.length-1;i6>0;i6--){var j6=Math.floor(rnd()*(i6+1));
      var tp=tray[i6];tray[i6]=tray[j6];tray[j6]=tp;}

    return {cols:C, rows:R, fixed:fixed, tray:tray, solution:sol};
  }

  return {simulate:simulate, genLevel:genLevel, NAMES:NAMES, ROTATABLE:ROTATABLE,
          DC:DC, BP:BP, CHANFILT:CHANFILT, LABELS:LABELS, reflect:reflect,
          DX:DX, DY:DY, INFO:INFO, TABLE_ORDER:TABLE_ORDER, orderOK:orderOK,
          WHY_SCATTER:WHY_SCATTER, INLINE:INLINE,
          orderProblem:orderProblem, STEP_NAME:STEP_NAME,
          TEACH_LINE:TEACH_LINE, STAGES:STAGES};
})();
if(typeof module!=='undefined') module.exports=LM;
