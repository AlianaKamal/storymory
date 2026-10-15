/* ===========================================================================
   app.js  —  THE LOGIC 🧠
   You normally don't need to touch this. It uses the list from data.js.
   (data.js must load BEFORE app.js — see index.html)
   =========================================================================== */

const $=s=>document.querySelector(s);
const MONTH_NAME={7:'Julai',8:'Ogos',9:'September',10:'Oktober',11:'November',12:'Disember',1:'Januari'};
const TYPE_EMOJI={photo:'📸',meme:'😂',chaos:'🎲',sound:'🎵'};
const GRADS=['linear-gradient(145deg,#ff9ebb,#ff5c8a)','linear-gradient(145deg,#a78bfa,#7c5cf0)',
  'linear-gradient(145deg,#ffd36e,#f3a712)','linear-gradient(145deg,#6ee7d8,#17b3a0)',
  'linear-gradient(145deg,#ffb088,#ff6f61)','linear-gradient(145deg,#8fcaff,#5b8def)'];
function gradFor(id){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return GRADS[h%GRADS.length];}
function monthOf(it){return +it.date.split('-')[1];}
function dayOf(it){return +it.date.split('-')[2];}
function fmtDate(it){const[,m,d]=it.date.split('-').map(Number);return `${d} ${MONTH_NAME[m]||''}`;}
function phHTML(it){return `<div class="ph" style="background:${gradFor(it.id)}"><span class="ph-emoji">${TYPE_EMOJI[it.type]}</span><span class="ph-tag">CONTOH</span></div>`;}
function mediaInner(it){return it.img?`<img src="${it.img}" alt="">`:phHTML(it);}

const today=new Date(); const T={m:today.getMonth()+1,d:today.getDate()};
$('#today-str').textContent=`${T.d} ${MONTH_NAME[T.m]||''}`;
function isOnThisDay(it){return dayOf(it)===T.d;}

/* ---- sound (generated in the phone, no files) ---- */
let actx=null;
function ac(){if(!actx){try{actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(actx&&actx.state==='suspended')actx.resume();return actx;}
const NOTES={C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880,C6:1046.5,G4:392,A4:440};
function playGrab(){const c=ac();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type='square';
  o.frequency.setValueAtTime(420,c.currentTime);o.frequency.exponentialRampToValueAtTime(140,c.currentTime+.14);
  g.gain.setValueAtTime(.22,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);
  o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.18);}
function playReveal(r){const c=ac();if(!c)return;const base=r==='legendary'?[523.25,659.25,783.99,1046.5]:r==='rare'?[523.25,659.25,783.99]:[523.25,659.25];
  base.forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.09;o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.5);
    o.connect(g).connect(c.destination);o.start(t);o.stop(t+.52);});}
function playMelody(name){const c=ac();if(!c)return;const mel=MEL[name]||MEL.twinkle;let t=c.currentTime+.02;
  for(const[n,dur]of mel){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=NOTES[n]||440;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.32,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02);t+=dur;}}

/* ---- confetti ---- */
const cv=$('#confetti'),cx=cv.getContext('2d');
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function confetti(strong){if(reduce)return;cv.hidden=false;cv.width=innerWidth;cv.height=innerHeight;
  const cols=['#ff4f87','#8b5cf6','#f3a712','#17b3a0','#ff8a3c','#ffffff'];const n=strong?150:70;const P=[];
  for(let i=0;i<n;i++)P.push({x:innerWidth/2,y:innerHeight*.4,vx:(Math.random()-.5)*15,vy:Math.random()*-15-4,
    g:.4+Math.random()*.3,s:5+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function loop(){cx.clearRect(0,0,cv.width,cv.height);f++;
    for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;cx.save();cx.translate(p.x,p.y);cx.rotate(p.r);cx.fillStyle=p.c;cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cx.restore();}
    if(f<95)requestAnimationFrame(loop);else cv.hidden=true;})();}

/* ---- reveal (cinematic prize card) ---- */
const overlay=$('#overlay'),reveal=$('#reveal'),fx=$('#fx'),flash=$('#flash');
const AURA={common:'rgba(255,140,185,.9)',rare:'rgba(167,139,250,.95)',legendary:'rgba(255,210,90,.98)'};
const RAY={common:'rgba(255,255,255,.4)',rare:'rgba(167,139,250,.5)',legendary:'rgba(255,210,90,.6)'};
function fillReveal(it){
  reveal.dataset.r=it.rarity;
  const top=$('#reveal-top');top.innerHTML='';
  const rc=document.createElement('span');rc.className='rchip';rc.dataset.r=it.rarity;rc.textContent=it.rarity;top.appendChild(rc);
  if(isOnThisDay(it)){const o=document.createElement('span');o.className='otd';o.textContent='📅 Pada hari ini';top.appendChild(o);}
  const media=$('#reveal-media');let label='',cap='';
  if(it.type==='photo'){media.innerHTML=`<div class="media">${mediaInner(it)}</div>`;label='Photo Drop 📸';cap=it.caption;}
  else if(it.type==='meme'){media.innerHTML=`<div class="media">${mediaInner(it)}<div class="meme-cap top">${it.caption}</div></div>`;label='Meme Attack 😂';}
  else if(it.type==='chaos'){media.innerHTML=`<div class="media chaos"><div class="ctxt">${it.challenge}</div></div>`;label='Chaos Card 🎲';cap='Cabaran mini untuk korang!';}
  else if(it.type==='sound'){media.innerHTML=`<div class="media sound"><div class="bigdisc">🎵</div><div style="font-weight:800;color:var(--ink)">${it.song}</div></div>`;label='Sound Drop 🎵';cap='';}
  $('#reveal-label').textContent=label;
  $('#reveal-cap').textContent=cap;$('#reveal-cap').style.display=cap?'':'none';
  $('#reveal-date').textContent='🗓️ '+fmtDate(it);
}
function cinematic(it,extraNote){
  fx.style.setProperty('--aura',AURA[it.rarity]);fx.style.setProperty('--ray',RAY[it.rarity]);
  reveal.classList.remove('in');reveal.style.opacity='0';
  overlay.hidden=false; fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go');
  if(it.rarity==='legendary'){flash.classList.remove('go');void flash.offsetWidth;flash.classList.add('go');}
  setTimeout(()=>{
    fillReveal(it);
    reveal.style.opacity='';reveal.classList.add('in');
    playReveal(it.rarity); if(it.type==='sound')setTimeout(()=>playMelody(it.melody),400);
    confetti(it.rarity!=='common');
    if(extraNote){const cp=$('#reveal-cap');cp.textContent=extraNote;cp.style.display='';}
  },480);
}
function closeOverlay(){overlay.hidden=true;cv.hidden=true;}
$('#again-btn').addEventListener('click',closeOverlay);
overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay();});

/* ===========================================================================
   REAL CLAW MACHINE (Matter.js physics)
   Drag the claw with your finger, release to grab the ball under it.
   =========================================================================== */
const hint=$('#hint');
function setHint(t){hint.textContent=t;}

(function(){
  const canvas=$('#game');
  if(typeof Matter==='undefined'){ setHint('Enjin fizik gagal dimuat — semak sambungan internet.'); return; }
  const {Engine,Render,Runner,Bodies,Composite,Body,Constraint,Events,Vector}=Matter;

  const W=360,H=440;                 // logical play area (matches canvas width/height)
  const RAIL_Y=40, TOP_Y=66;         // claw rest height & rail line
  const CHUTE_X=40;                  // prize hole (top-left) the claw carries to
  const CAT_WALL=0x0001, CAT_BALL=0x0002, CAT_CLAW=0x0004;
  const RARITY_FILL={common:'#ff9ebb',rare:'#b79cff',legendary:'#ffd36e'};
  const BALL_R=17;

  const engine=Engine.create(); engine.gravity.y=1;
  const world=engine.world;
  const render=Render.create({canvas,engine,options:{width:W,height:H,background:'transparent',wireframes:false,pixelRatio:1}});
  Render.run(render); const runner=Runner.create(); Runner.run(runner,engine);

  // walls at the canvas edges (invisible)
  const wallOpt={isStatic:true,render:{visible:false},collisionFilter:{category:CAT_WALL}};
  Composite.add(world,[
    Bodies.rectangle(-10,H/2,20,H*2,wallOpt),
    Bodies.rectangle(W+10,H/2,20,H*2,wallOpt),
    Bodies.rectangle(W/2,H+10,W*2,20,wallOpt),
  ]);

  // claw (static body we move by hand; it pushes the balls around)
  const claw=Bodies.circle(W/2,TOP_Y,12,{isStatic:true,render:{visible:false},
    collisionFilter:{category:CAT_CLAW,mask:CAT_BALL|CAT_WALL}});
  Composite.add(world,claw);

  // balls = the surprises
  let balls=[];                      // {body,item}
  function spawnBalls(){
    balls.forEach(b=>Composite.remove(world,b.body)); balls=[];
    CONTENT.forEach((it,i)=>{
      const x=30+Math.random()*(W-60), y=-20-i*26;
      const b=Bodies.circle(x,y,BALL_R,{restitution:.35,friction:.02,frictionAir:.008,density:.0012,
        collisionFilter:{category:CAT_BALL,mask:CAT_WALL|CAT_BALL|CAT_CLAW},
        render:{fillStyle:RARITY_FILL[it.rarity]||'#ff9ebb',
          strokeStyle:isOnThisDay(it)?'#ffd24d':'rgba(0,0,0,.12)',lineWidth:isOnThisDay(it)?3.5:1}});
      b.plugin={item:it}; balls.push({body:b,item:it}); Composite.add(world,b);
    });
  }
  spawnBalls();

  // ---- control state ----
  let state='idle';                  // idle | lifting | toChute | reveal
  let dragging=false, grabbed=null, link=null;
  let target={x:W/2,y:TOP_Y};

  function pointerLogical(e){const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H};}
  function clamp(v,a,b){return v<a?a:v>b?b:v;}

  canvas.addEventListener('pointerdown',e=>{ if(state!=='idle')return; dragging=true;
    canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId); aim(e); });
  canvas.addEventListener('pointermove',e=>{ if(dragging&&state==='idle')aim(e); });
  canvas.addEventListener('pointerup',()=>{ if(dragging){dragging=false; if(state==='idle')tryGrab();} });
  canvas.addEventListener('pointercancel',()=>{ if(dragging){dragging=false; if(state==='idle')tryGrab();} });
  function aim(e){const p=pointerLogical(e);
    target.x=clamp(p.x,26,W-26); target.y=clamp(p.y,TOP_Y,H-30);}

  function tryGrab(){
    const jaw={x:claw.position.x,y:claw.position.y+16};
    let best=null,bestD=1e9;
    for(const b of balls){const d=Math.hypot(b.body.position.x-jaw.x,b.body.position.y-jaw.y);
      if(d<bestD){bestD=d;best=b;}}
    playGrab();
    if(best && bestD < BALL_R+20){
      grabbed=best;
      grabbed.body.collisionFilter.mask=CAT_WALL;      // rise clean through the pile
      link=Constraint.create({bodyA:claw,bodyB:grabbed.body,stiffness:.9,length:16,render:{visible:false}});
      Composite.add(world,link);
      state='lifting'; target={x:claw.position.x,y:TOP_Y};
      setHint('Naik… 🙌');
    }else{
      grabbed=null; state='lifting'; target={x:claw.position.x,y:TOP_Y};
      setHint('Tak kena — cuba lagi! 🤏');
    }
  }

  function drop(){
    const item=grabbed.item;
    if(link){Composite.remove(world,link);link=null;}
    Composite.remove(world,grabbed.body);
    balls=balls.filter(b=>b!==grabbed); grabbed=null;
    state='reveal'; target={x:W/2,y:TOP_Y};
    const empty=balls.length===0;
    cinematic(item, empty?'Semua bola dah habis — di-isi semula!':null);
    setHint('Seret cakar dengan jari · lepas untuk cengkam 🕹️');
    if(empty) setTimeout(spawnBalls,900);
    setTimeout(()=>{ if(state==='reveal')state='idle'; },300);
  }

  // ---- SHAKE THE PHONE → jiggle the balls ----
  function jiggle(power){                    // power ~1 normal shake, bigger = harder
    const p=Math.min(power,3);
    for(const b of balls){ if(b===grabbed)continue;
      Body.applyForce(b.body, b.body.position,
        {x:(Math.random()-.5)*0.010*p*b.body.mass, y:-Math.random()*0.012*p*b.body.mass});
    }
  }
  (function shakeSetup(){
    const btn=$('#shakebtn');
    let last={x:0,y:0,z:0}, lastT=0, primed=false;
    function onMotion(e){
      const a=e.accelerationIncludingGravity||e.acceleration; if(!a)return;
      const now=Date.now(); if(now-lastT<80)return; lastT=now;
      const dx=Math.abs((a.x||0)-last.x),dy=Math.abs((a.y||0)-last.y),dz=Math.abs((a.z||0)-last.z);
      last={x:a.x||0,y:a.y||0,z:a.z||0};
      const delta=dx+dy+dz;
      if(primed && delta>16){ jiggle(delta/16); setHint('Goncang! Bola bergerak 🌀');
        if(navigator.vibrate)navigator.vibrate(30); }
    }
    function start(){ window.addEventListener('devicemotion',onMotion);
      setTimeout(()=>primed=true,400);   // ignore the first jerk from tapping the button
      btn.hidden=true; setHint('Goncang telefon untuk kacau bola 📳'); }
    if(typeof DeviceMotionEvent==='undefined'){ return; }         // no sensor (desktop) → hide button
    if(typeof DeviceMotionEvent.requestPermission==='function'){  // iOS: needs a tap to allow
      btn.hidden=false;
      btn.addEventListener('click',async()=>{ try{ const r=await DeviceMotionEvent.requestPermission();
        if(r==='granted')start(); else setHint('Kebenaran gerakan ditolak — guna jari je 🕹️'); }
        catch(err){ setHint('Gerakan tak disokong — guna jari je 🕹️'); } });
    }else{ start(); }                                             // Android & others: just works
  })();

  // drive the claw every physics tick
  Events.on(engine,'beforeUpdate',()=>{
    if(state==='idle' && !dragging && !reduce){        // gentle arcade sway at rest
      target.x=W/2+Math.sin(Date.now()/650)*46; target.y=TOP_Y;
    }
    const nx=claw.position.x+(target.x-claw.position.x)*(dragging?0.4:0.18);
    const ny=claw.position.y+(target.y-claw.position.y)*(dragging?0.4:0.18);
    Body.setPosition(claw,{x:nx,y:ny});
    const atTarget=Math.hypot(target.x-nx,target.y-ny)<1.5;
    if(state==='lifting' && atTarget){
      if(grabbed){ state='toChute'; target={x:CHUTE_X,y:TOP_Y}; }
      else { state='idle'; }
    } else if(state==='toChute' && atTarget){ drop(); }
  });

  // draw cable, claw, rail, chute and ball emojis on top of the physics render
  Events.on(render,'afterRender',()=>{
    const ctx=render.context;
    // rail
    ctx.fillStyle='rgba(58,34,48,.9)'; ctx.fillRect(10,RAIL_Y-6,W-20,8);
    // chute (prize hole, top-left)
    ctx.fillStyle='rgba(0,0,0,.30)'; roundRect(ctx,18,RAIL_Y+6,48,34,8); ctx.fill();
    ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🎁',42,RAIL_Y+23);
    // ball emojis
    balls.forEach(b=>{ ctx.font=`${BALL_R}px sans-serif`;
      ctx.fillText(TYPE_EMOJI[b.item.type],b.body.position.x,b.body.position.y); });
    // cable + claw
    const cxp=claw.position.x, cyp=claw.position.y;
    ctx.strokeStyle='#cbc4d1'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(cxp,RAIL_Y); ctx.lineTo(cxp,cyp); ctx.stroke();
    // hub
    ctx.fillStyle='#f3a712'; roundRect(ctx,cxp-10,cyp-6,20,10,3); ctx.fill();
    // prongs (closed while carrying)
    const closed = state!=='idle' && grabbed;
    ctx.strokeStyle='#e8a21c'; ctx.lineWidth=4; ctx.lineCap='round';
    const spread=closed?4:12;
    ctx.beginPath(); ctx.moveTo(cxp-2,cyp+2); ctx.quadraticCurveTo(cxp-spread,cyp+14,cxp-spread+2,cyp+24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxp+2,cyp+2); ctx.quadraticCurveTo(cxp+spread,cyp+14,cxp+spread-2,cyp+24); ctx.stroke();
  });
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
})();

/* ---- SPLASH (NFC → 7s blurred video; tap anywhere to skip) ---- */
(function(){
  const splash=$('#splash'),vid=$('#introvid'),ph=$('#phvid');
  let done=false,timer=null;
  function finish(){if(done)return;done=true;clearTimeout(timer);
    try{vid.pause();}catch(e){} splash.classList.add('gone');
    setTimeout(()=>{splash.remove();},900);}
  splash.addEventListener('click',finish);   // tap anywhere = skip
  timer=setTimeout(finish,7000);              // 7 seconds
  vid.addEventListener('ended',finish);        // or when the video ends

  let playing=false;
  vid.addEventListener('playing',()=>{playing=true;});
  function usePlaceholder(){splash.classList.add('novid');runPh();}
  vid.addEventListener('error',usePlaceholder);
  const p=vid.play&&vid.play();
  if(p&&p.catch)p.catch(()=>{ if(!playing)usePlaceholder(); });
  setTimeout(()=>{if(!playing&&vid.readyState<2)usePlaceholder();},1200);

  function runPh(){const c=ph,g=c.getContext('2d');function sz(){c.width=innerWidth;c.height=innerHeight;}sz();addEventListener('resize',sz);
    const blobs=[...Array(6)].map(()=>({x:Math.random(),y:Math.random(),r:.25+Math.random()*.3,vx:(Math.random()-.5)*.0006,vy:(Math.random()-.5)*.0006,b:120+Math.random()*90}));
    function frame(){if(done)return;g.clearRect(0,0,c.width,c.height);g.fillStyle='#0b0b0b';g.fillRect(0,0,c.width,c.height);
      for(const b of blobs){b.x+=b.vx;b.y+=b.vy;if(b.x<0||b.x>1)b.vx*=-1;if(b.y<0||b.y>1)b.vy*=-1;
        const gx=b.x*c.width,gy=b.y*c.height,rad=b.r*Math.max(c.width,c.height);
        const gr=g.createRadialGradient(gx,gy,0,gx,gy,rad);const sh=Math.round(b.b);
        gr.addColorStop(0,`rgba(${sh},${sh},${sh},.5)`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(gx,gy,rad,0,7);g.fill();}
      requestAnimationFrame(frame);}
    frame();}
})();
