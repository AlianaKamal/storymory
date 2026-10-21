/* ===========================================================================
   app.js — INTERNSHIP DASH (vehicles + secret photos) 🎮🔥
   Collect coins across 4 stages (last = AUTO-RUN). Find the 1 hidden SECRET
   photo to unlock a new memory into the collection. Most photos = winner.
   Each character rides a cute vehicle (Nurin=cat, Haziq=motor, Yana=hilux).
   Edit photos in data.js. You normally don't touch this file.
   =========================================================================== */

const $=s=>document.querySelector(s);
const CHARS=[
  {id:'Nurin', color:'#ff5c8a', emoji:'🧕', vehicle:'rabbit'},
  {id:'Haziq', color:'#38bdf8', emoji:'🧑', vehicle:'motorsport'},
  {id:'Yana',  color:'#a855f7', emoji:'👩', vehicle:'hilux'},
];
const FACE_SRC = (typeof FACES!=='undefined') ? FACES : {};

/* ---- which character THIS phone is locked to ----
   Set by the link ( ?me=Nurin  or  #Nurin ) or by the first pick on this phone.
   Each person gets their own NFC tag/link, so they can only play their own. */
function getOwner(){ try{return localStorage.getItem('dash_owner')||'';}catch(e){return '';} }
function setOwner(c){ try{localStorage.setItem('dash_owner',c);}catch(e){} }
(function initOwner(){
  const q=new URLSearchParams(location.search).get('me');
  const h=decodeURIComponent((location.hash||'').replace('#','')).trim();
  const want=(q||h||'').toLowerCase();
  const match=CHARS.find(c=>c.id.toLowerCase()===want);
  if(match) setOwner(match.id);     // link always wins (lets you re-assign a phone)
})();

/* ---- photo pool (from data.js) ---- */
const POOL=[];
CONTENT.forEach(it=>POOL.push({id:it.id, img:it.img||null, caption:it.caption||''}));
if(typeof PHOTOS!=='undefined' && PHOTOS.length) PHOTOS.forEach((n,i)=>POOL.push({id:'ph'+i, img:'img/'+n, caption:''}));

/* ---- per-character data (per phone) ---- */
function collKey(c){return 'dash_coll_'+c;}
function coinKey(c){return 'dash_coins_'+c;}
function getColl(c){ try{return new Set(JSON.parse(localStorage.getItem(collKey(c))||'[]'));}catch(e){return new Set();} }
function saveColl(c,set){ try{localStorage.setItem(collKey(c),JSON.stringify([...set]));}catch(e){} }
function getBestCoins(c){ try{return +localStorage.getItem(coinKey(c))||0;}catch(e){return 0;} }
function saveBestCoins(c,v){ try{localStorage.setItem(coinKey(c),String(v));}catch(e){} }

/* ---- leaderboard = photos collected (shared via Supabase if configured) ---- */
const SUPA = (typeof SUPABASE_URL!=='undefined' && SUPABASE_URL && SUPABASE_KEY);
let scores={Nurin:0,Haziq:0,Yana:0};
function localColl(){ const o={}; CHARS.forEach(c=>o[c.id]=getColl(c.id).size); return o; }
async function loadScores(){
  if(SUPA){ try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/scores?select=character,total`,
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    const rows=await r.json(); const o={Nurin:0,Haziq:0,Yana:0};
    if(Array.isArray(rows)) rows.forEach(x=>{ if(x.character in o) o[x.character]=x.total||0; });
    const loc=localColl(); CHARS.forEach(c=>{ o[c.id]=Math.max(o[c.id],loc[c.id]); });
    scores=o; return;
  }catch(e){} }
  scores=localColl();
}
async function pushScore(c){ scores[c]=getColl(c).size;
  if(SUPA){ try{ await fetch(`${SUPABASE_URL}/rest/v1/scores`,{method:'POST',
    headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify([{character:c,total:scores[c]}])}); }catch(e){} }
}

/* ---- screens & sound ---- */
function showScreen(id){ document.querySelectorAll('.screen').forEach(s=>{s.hidden=true;s.classList.remove('show');});
  const el=$('#'+id); el.hidden=false; el.classList.add('show'); }
let actx=null;
function ac(){if(!actx){try{actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(actx&&actx.state==='suspended')actx.resume();return actx;}
function beep(f1,f2,type,dur,vol){const c=ac();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=type||'square';
  o.frequency.setValueAtTime(f1,c.currentTime); if(f2)o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+dur);
  g.gain.setValueAtTime(vol||.2,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+dur);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+dur+.02);}
const sJump=()=>beep(300,620,'square',.14,.18);
const sCoin=()=>{beep(880,1320,'triangle',.1,.18);};
const sUp  =()=>{[523,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,f,'square',.12,.18),i*70));};
const sSecret=()=>{[659,880,1046,1318,1568].forEach((f,i)=>setTimeout(()=>beep(f,f,'triangle',.2,.22),i*110));};
const sOver=()=>{[400,300,200].forEach((f,i)=>setTimeout(()=>beep(f,f*0.8,'sawtooth',.2,.2),i*120));};

/* ===========================================================================
   GAME
   =========================================================================== */
const canvas=$('#game'); const ctx=canvas.getContext('2d');
let W=360,H=640,dpr=1,groundY=560;
function resize(){ const r=canvas.getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(320,r.width); H=Math.max(360,r.height); canvas.width=W*dpr; canvas.height=H*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0); groundY=H-80; }
window.addEventListener('resize',()=>{ if(!$('#screen-game').hidden) resize(); });

let me=null;
const keys={left:false,right:false,jump:false};
let player,solids,coins,secret,obstacles,goalX,worldW,camX,running,lastSafe,coinScore,stage,prevStage,wheelSpin;

const GRAV=0.62, MAXFALL=15, JUMP=-12.6;
const PER_ZONE=7, ZONES=4;
const SPD=[3.3,4.1,5.0,6.6];
const AMP=[4,12,28,16], MSPD=[0.0015,0.003,0.005,0.006];

function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function zoneOf(i){ return Math.min(ZONES-1, Math.floor(i/PER_ZONE)); }
function stageAtX(x){ const i=(x-760)/300; return Math.max(1, Math.min(ZONES, Math.floor(i/PER_ZONE)+1)); }

function buildLevel(){
  const total=PER_ZONE*ZONES;
  // coins show real photos (decoration) — cycle through the pool
  const deco = POOL.length? POOL : [{id:'x',img:null}];
  worldW = 760 + total*300 + 700;
  solids=[]; coins=[]; obstacles=[]; secret=null;
  const gTop=groundY;
  solids.push({x:0,y:gTop,w:worldW,h:220,ground:true});

  for(let i=0;i<total;i++){
    const z=zoneOf(i), x=760+i*300; let baseY;
    if(z<3){ if(i%2===0) baseY=gTop-58; else { solids.push({x:x-55,y:gTop-96,w:110,h:16,ground:false}); baseY=gTop-150; } }
    else baseY = (i%2===0)? gTop-70 : gTop-124;
    coins.push({x,baseY,y:baseY,r:16,item:deco[i%deco.length],got:false,z,phase:Math.random()*6});
  }
  // obstacles in auto-run zone
  const z4=760+(ZONES-1)*PER_ZONE*300;
  for(let k=0;k<PER_ZONE-1;k++) obstacles.push({x:z4+150+k*300,y:gTop-26,w:26,h:26});

  // the ONE secret = first uncollected photo, placed high in stage 3 (needs a jump)
  const coll=getColl(me.id);
  const next=POOL.find(p=>!coll.has(p.id));
  if(next){ const sx=760+(PER_ZONE*2+3)*300;
    solids.push({x:sx-60,y:gTop-104,w:120,h:16,ground:false});
    secret={x:sx,y:gTop-168,baseY:gTop-168,r:24,item:next,got:false,phase:0}; }

  goalX=worldW-130;
  player={x:120,y:gTop-60,w:30,h:42,vx:0,vy:0,onGround:false,face:1,squash:0};
  lastSafe={x:player.x,y:player.y}; camX=0; coinScore=0; stage=1; prevStage=1; wheelSpin=0;
  $('#hud-char').textContent=me.id; $('#hud-score').textContent=0; $('#hud-stage').textContent='Stage 1';
}

function rectsHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

function update(){
  stage=stageAtX(player.x);
  if(stage!==prevStage){ prevStage=stage; sUp(); $('#hud-stage').textContent=stage>=ZONES?'AUTO-RUN! 🔥':'Stage '+stage; }
  const autorun=stage>=ZONES, spd=SPD[stage-1];
  $('#btn-left').style.opacity=autorun?'.3':'1'; $('#btn-right').style.opacity=autorun?'.3':'1';

  if(autorun){ player.vx=spd; player.face=1; }
  else if(keys.left){player.vx=-spd;player.face=-1;}
  else if(keys.right){player.vx=spd;player.face=1;}
  else player.vx*=0.7;
  wheelSpin += Math.abs(player.vx)*0.12;
  player.x+=player.vx;
  for(const s of solids){ if(rectsHit(player,s)){ if(player.vx>0)player.x=s.x-player.w; else if(player.vx<0)player.x=s.x+s.w; player.vx=0; } }
  if(player.x<0)player.x=0;

  player.vy=Math.min(player.vy+GRAV,MAXFALL); player.y+=player.vy; player.onGround=false;
  for(const s of solids){ if(rectsHit(player,s)){
      if(player.vy>0){ player.y=s.y-player.h; player.vy=0; player.onGround=true; if(player.squash<1)player.squash=1; }
      else if(player.vy<0){ player.y=s.y+s.h; player.vy=0; } } }
  if(player.onGround){ player.squash*=0.8; lastSafe={x:player.x,y:player.y-4}; }

  if(keys.jump && player.onGround){ player.vy=JUMP; player.onGround=false; sJump(); }
  keys.jump=false;

  const now=Date.now();
  for(const t of coins){ t.y=t.baseY+Math.sin(now*MSPD[t.z]+t.phase)*AMP[t.z]; }

  for(const o of obstacles){ if(rectsHit(player,o)) return endRun('over'); }
  if(player.y>H+150){ player.x=lastSafe.x; player.y=lastSafe.y-40; player.vy=0; }

  camX=Math.max(0,Math.min(player.x-W*0.34, worldW-W));

  // coins
  for(const t of coins){ if(t.got)continue;
    const dx=(player.x+player.w/2)-t.x, dy=(player.y+player.h/2)-t.y;
    if(Math.hypot(dx,dy)<t.r+22){ t.got=true; coinScore++; sCoin(); $('#hud-score').textContent=coinScore; popAt(t.x,t.y,'+1'); } }
  // secret
  if(secret && !secret.got){ const dx=(player.x+player.w/2)-secret.x, dy=(player.y+player.h/2)-secret.y;
    if(Math.hypot(dx,dy)<secret.r+24){ secret.got=true; return endRun('secret'); } }

  if(player.x>goalX) endRun('win');
}
function popAt(x,y,txt){ const pop=document.createElement('div'); pop.className='pickpop'; pop.textContent=txt;
  pop.style.left=(x-camX-10)+'px'; pop.style.top=(y-10)+'px'; $('#screen-game').appendChild(pop); setTimeout(()=>pop.remove(),1000); }

/* ---- drawing ---- */
const imgCache={};
function getImg(src){ if(!src)return null; if(!imgCache[src]){const im=new Image();im.src=src;imgCache[src]=im;} return imgCache[src]; }
function ready(im){ return im&&im.complete&&im.naturalWidth; }

const FLOOR_DEPTH=150;
function draw(){
  const warm = stage>=ZONES;
  // candy sky
  const g=ctx.createLinearGradient(0,0,0,H);
  if(warm){ g.addColorStop(0,'#ffe8a8'); g.addColorStop(1,'#ff9f7a'); }
  else { g.addColorStop(0,'#ffd1ec'); g.addColorStop(1,'#bfeaff'); }
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const horizon=groundY-FLOOR_DEPTH;
  ctx.fillStyle=warm?'#ffcf9a':'#c9a9ff'; drawHills(0.25, horizon+16, 58);
  ctx.fillStyle=warm?'#ff9f7a':'#ffc69a'; drawHills(0.45, horizon+32, 42);
  ctx.fillStyle='rgba(255,255,255,.82)'; for(let i=0;i<6;i++){ const cx=((i*520-camX*0.35)%worldW+worldW)%worldW; cloud(cx, 58+(i%3)*32); }
  drawFloor(warm);

  ctx.save(); ctx.translate(-camX,0);
  // soft shadows on the floor
  ctx.fillStyle='rgba(70,20,70,.16)';
  for(const t of coins){ if(!t.got) shadowEllipse(t.x, groundY, 18); }
  shadowEllipse(player.x+player.w/2, groundY, 26);

  // platforms / ground
  for(const s of solids){
    if(s.ground){ ctx.fillStyle=warm?'#e08a5a':'#59d99a'; ctx.fillRect(s.x,s.y,s.w,s.h);
      ctx.fillStyle='rgba(255,255,255,.4)'; ctx.fillRect(s.x,s.y,s.w,10); }
    else { ctx.fillStyle='#b57bff'; roundRect(s.x,s.y+4,s.w,s.h,6); ctx.fill();        // block side
      ctx.fillStyle='#ffe15c'; roundRect(s.x,s.y,s.w,Math.max(6,s.h-4),6); ctx.fill(); // top
      ctx.fillStyle='rgba(255,255,255,.45)'; ctx.fillRect(s.x+4,s.y+3,s.w-8,3); }
  }
  // candy spikes
  ctx.fillStyle='#ff4d6d'; for(const o of obstacles){ ctx.beginPath(); ctx.moveTo(o.x,o.y+o.h); ctx.lineTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.closePath(); ctx.fill(); }

  for(const t of coins){ if(t.got)continue; drawCoin(t.x,t.y,t.r,t.item); }
  if(secret && !secret.got) drawSecret(secret);

  // goal flag
  ctx.fillStyle='#fff'; ctx.fillRect(goalX,groundY-150,6,150);
  ctx.fillStyle=me.color; ctx.beginPath(); ctx.moveTo(goalX+6,groundY-150); ctx.lineTo(goalX+52,groundY-134); ctx.lineTo(goalX+6,groundY-118); ctx.fill();
  ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.fillText('🏁',goalX+28,groundY-126);

  drawVehicle();
  ctx.restore();
}
function shadowEllipse(x,y,w){ ctx.beginPath(); ctx.ellipse(x,y,w,w*0.32,0,0,7); ctx.fill(); }
function drawFloor(warm){
  const frontY=groundY, backY=groundY-FLOOR_DEPTH, inset=W*0.18;
  ctx.fillStyle=warm?'#f0a56a':'#7fe6b5';
  ctx.beginPath(); ctx.moveTo(0,frontY); ctx.lineTo(W,frontY); ctx.lineTo(W-inset,backY); ctx.lineTo(inset,backY); ctx.closePath(); ctx.fill();
  // depth lines that scroll (sense of motion) and converge to the back
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=2;
  const sp=70, off=((camX%sp)+sp)%sp;
  for(let fx=-off; fx<=W+sp; fx+=sp){ const t=fx/W, bx=inset+(W-2*inset)*t;
    ctx.beginPath(); ctx.moveTo(fx,frontY); ctx.lineTo(bx,backY); ctx.stroke(); }
  // depth bands (closer toward the back)
  ctx.strokeStyle='rgba(255,255,255,.22)';
  [0.3,0.58,0.8].forEach(d=>{ const y=frontY-(frontY-backY)*d, ix=inset*d;
    ctx.beginPath(); ctx.moveTo(ix,y); ctx.lineTo(W-ix,y); ctx.stroke(); });
  // front edge band
  ctx.fillStyle=warm?'#c76a3f':'#49c98a'; ctx.fillRect(0,frontY,W,H-frontY);
}
function drawHills(f,baseY,h){ const off=-camX*f; ctx.beginPath(); ctx.moveTo(0,baseY+h);
  for(let x=-200;x<W+200;x+=20){ const y=baseY-Math.abs(Math.sin((x+off)/160))*h; ctx.lineTo(x,y); } ctx.lineTo(W,baseY+h); ctx.closePath(); ctx.fill(); }
function cloud(x,y){ ctx.beginPath(); ctx.arc(x,y,16,0,7); ctx.arc(x+18,y+4,20,0,7); ctx.arc(x+40,y,15,0,7); ctx.fill(); }
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function drawCoin(x,y,r,item){ ctx.save(); ctx.translate(x,y); ctx.shadowColor='rgba(255,210,63,.9)'; ctx.shadowBlur=12;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,r+3,0,7); ctx.fill(); ctx.shadowBlur=0;
  const im=item&&item.img?getImg(item.img):null;
  if(ready(im)){ ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.clip(); ctx.drawImage(im,-r,-r,r*2,r*2); ctx.restore(); }
  else { ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
    ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('📸',0,1); }
  ctx.restore(); }
function drawSecret(s){ const t=Date.now()/300; const pr=1+Math.sin(t)*0.08; ctx.save(); ctx.translate(s.x,s.y); ctx.scale(pr,pr);
  // rainbow glow ring
  ctx.save(); ctx.rotate(t); const grd=ctx.createConicGradient?ctx.createConicGradient(0,0,0):null;
  if(grd){ grd.addColorStop(0,'#ff5c8a');grd.addColorStop(.33,'#ffd23f');grd.addColorStop(.66,'#38bdf8');grd.addColorStop(1,'#ff5c8a');
    ctx.fillStyle=grd; } else ctx.fillStyle='#ffd23f';
  ctx.beginPath(); ctx.arc(0,0,s.r+8,0,7); ctx.fill(); ctx.restore();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,s.r+2,0,7); ctx.fill();
  ctx.font=(s.r*1.3)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎁',0,2);
  ctx.restore();
  // label
  ctx.save(); ctx.font='bold 12px sans-serif'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; ctx.textAlign='center';
  ctx.strokeText('SECRET!',s.x,s.y-s.r-16); ctx.fillText('SECRET!',s.x,s.y-s.r-16); ctx.restore(); }

/* ---- cute vehicles (face bobs; flips with direction) ---- */
function drawFace(r,bob,f){ // draws the rider head/face, un-mirrored
  const src=FACE_SRC[me.id]; const im=src?getImg(src):null;
  ctx.save(); ctx.translate(0,bob); ctx.scale(f,1);
  if(ready(im)){ const s=r*2.3; ctx.drawImage(im,-s/2,-s/2,s,s); }   // cutout head (transparent), no rim
  else { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,r+2,0,7); ctx.fill();   // white rim (fallback)
    ctx.fillStyle='#ffd9a8'; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();   // cute face
    ctx.fillStyle='#223'; ctx.beginPath(); ctx.arc(-r*0.32,-r*0.1,r*0.14,0,7); ctx.arc(r*0.32,-r*0.1,r*0.14,0,7); ctx.fill();
    ctx.strokeStyle='#c0392b'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.arc(0,r*0.18,r*0.4,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    ctx.fillStyle='rgba(255,120,150,.5)'; ctx.beginPath(); ctx.arc(-r*0.5,r*0.22,r*0.16,0,7); ctx.arc(r*0.5,r*0.22,r*0.16,0,7); ctx.fill(); }
  ctx.restore();
}
function wheel(x,y,r){ ctx.save(); ctx.translate(x,y); ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
  ctx.fillStyle='#777'; ctx.beginPath(); ctx.arc(0,0,r*0.45,0,7); ctx.fill();
  ctx.strokeStyle='#bbb'; ctx.lineWidth=2; ctx.rotate(wheelSpin);
  for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(i*Math.PI/2)*r*0.8,Math.sin(i*Math.PI/2)*r*0.8); ctx.stroke(); } ctx.restore(); }
function drawVehicle(){
  const p=player, f=p.face, bob=Math.sin(Date.now()*0.012)*3 + (p.onGround?0:-2);
  const cx=p.x+p.w/2, feet=p.y+p.h;
  ctx.save(); ctx.translate(cx,feet); ctx.scale(f,1);   // forward = +x
  ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=6;

  if(me.vehicle==='motorsport'){
    wheel(-24,-14,15); wheel(26,-14,15);
    ctx.shadowBlur=0;
    // low sleek body
    ctx.fillStyle=me.color; ctx.beginPath(); ctx.moveTo(-26,-20); ctx.lineTo(18,-20); ctx.lineTo(32,-30); ctx.lineTo(36,-20); ctx.lineTo(30,-13); ctx.lineTo(-24,-13); ctx.closePath(); ctx.fill();
    // front windscreen / fairing
    ctx.fillStyle='#1b2d53'; ctx.beginPath(); ctx.moveTo(32,-30); ctx.lineTo(42,-35); ctx.lineTo(37,-22); ctx.closePath(); ctx.fill();
    // tail cowl (sporty up-kick)
    ctx.fillStyle=me.color; ctx.beginPath(); ctx.moveTo(-26,-20); ctx.lineTo(-34,-36); ctx.lineTo(-20,-27); ctx.closePath(); ctx.fill();
    // seat + exhaust
    ctx.fillStyle='#111'; roundRect(-14,-31,26,8,3); ctx.fill();
    ctx.fillStyle='#cfcfcf'; roundRect(20,-12,16,5,2); ctx.fill();
    // rider leaning forward
    ctx.fillStyle=me.color; roundRect(-4,-52,16,22,7); ctx.fill();
    drawFaceAt(6,-68,20,bob,f);
    // speed lines
    ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=2;
    for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(-42-i*9,-16-i*7); ctx.lineTo(-26-i*9,-16-i*7); ctx.stroke(); }
  } else if(me.vehicle==='rabbit'){
    ctx.shadowBlur=0;
    // body
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(0,-20,32,18,0,0,7); ctx.fill();
    // feet
    ctx.fillStyle='#f0f0f3'; [-20,16].forEach(lx=>{ roundRect(lx,-8,18,8,4); ctx.fill(); });
    // puff tail
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-32,-20,8,0,7); ctx.fill();
    // head
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(28,-30,15,0,7); ctx.fill();
    // long ears
    ctx.fillStyle='#fff'; roundRect(21,-66,8,28,4); ctx.fill(); roundRect(32,-66,8,28,4); ctx.fill();
    ctx.fillStyle='#ffc0d4'; roundRect(23,-62,4,20,2); ctx.fill(); roundRect(34,-62,4,20,2); ctx.fill();
    // face
    ctx.fillStyle='#223'; ctx.beginPath(); ctx.arc(24,-31,2,0,7); ctx.arc(33,-31,2,0,7); ctx.fill();
    ctx.fillStyle='#ff6f91'; ctx.beginPath(); ctx.arc(28,-26,2.2,0,7); ctx.fill();
    // rider
    ctx.fillStyle=me.color; roundRect(-10,-46,16,22,7); ctx.fill();
    drawFaceAt(-2,-62,19,bob,f);
  } else { // hilux (nicer)
    wheel(-22,-13,14); wheel(24,-13,14);
    ctx.shadowBlur=0;
    // lower body + highlight
    ctx.fillStyle=me.color; roundRect(-38,-32,80,20,8); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)'; roundRect(-38,-32,80,7,8); ctx.fill();
    // cab
    ctx.fillStyle=me.color; roundRect(-38,-54,42,26,9); ctx.fill();
    // two windows
    ctx.fillStyle='#bfe3ff'; roundRect(-34,-50,17,16,4); ctx.fill(); roundRect(-15,-50,15,16,4); ctx.fill();
    // bed rails
    ctx.strokeStyle=me.color; ctx.lineWidth=3; ctx.strokeRect(4,-30,32,12);
    // headlight + chrome bumper
    ctx.fillStyle='#ffe08a'; roundRect(39,-27,5,9,2); ctx.fill();
    ctx.fillStyle='#e6e6e6'; roundRect(-40,-16,84,4,2); ctx.fill();
    // driver head above cab
    drawFaceAt(-20,-62,18,bob,f);
  }
  ctx.restore();

  // name tag (unflipped, screen-stable)
  ctx.save(); ctx.font='bold 11px sans-serif'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; ctx.textAlign='center';
  const ny=feet-96; ctx.strokeText(me.id,cx,ny); ctx.fillText(me.id,cx,ny); ctx.restore();
}
function drawFaceAt(x,y,r,bob,f){ ctx.save(); ctx.translate(x,y); drawFace(r,bob,f); ctx.restore(); }

let raf=null;
function loop(){ if(!running)return; update(); if(running) draw(); raf=requestAnimationFrame(loop); }
function startGame(){ showScreen('screen-game'); resize(); buildLevel(); running=true; cancelAnimationFrame(raf); loop(); }

function endRun(result){
  if(!running)return; running=false; cancelAnimationFrame(raf);
  const bc=Math.max(getBestCoins(me.id),coinScore); saveBestCoins(me.id,bc);
  if(result==='secret' && secret){ const coll=getColl(me.id); coll.add(secret.item.id); saveColl(me.id,coll); }
  pushScore(me.id);
  const total=getColl(me.id).size;

  if(result==='secret'){ sSecret(); confetti(true);
    $('#win-emoji').textContent='🎁'; $('#win-title').textContent='SECRET FOUND!';
    const cap=secret.item.caption?` — "${secret.item.caption}"`:'';
    $('#win-sub').textContent=`New photo added to ${me.id}'s collection${cap} 🎉  ·  coins: ${coinScore}  ·  photos: ${total}`;
  } else if(result==='win'){ sUp();
    const left=POOL.some(p=>!getColl(me.id).has(p.id));
    $('#win-emoji').textContent = left?'🏁':'🏆';
    $('#win-title').textContent = left?'Finished! But no secret found' : 'All photos collected!';
    $('#win-sub').textContent = `coins: ${coinScore}  ·  ${me.id}'s photos: ${total}`;
  } else { sOver();
    $('#win-emoji').textContent='💥'; $('#win-title').textContent='Hit a spike! Game over';
    $('#win-sub').textContent = `coins: ${coinScore}  ·  ${me.id}'s photos: ${total}`;
  }
  loadScores().then(()=>buildBoard('#win-board'));
  showScreen('screen-win');
}

/* ---- leaderboard (photos collected) ---- */
function buildBoard(sel){ const el=$(sel); el.innerHTML='';
  const max=Math.max(1,...CHARS.map(c=>scores[c.id]||0)); const lead=Math.max(...CHARS.map(c=>scores[c.id]||0));
  CHARS.slice().sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).forEach(c=>{ const v=scores[c.id]||0;
    const row=document.createElement('div'); row.className='board-row'+(v===lead&&v>0?' lead':'');
    row.innerHTML=`<div class="board-ava" style="background:${c.color}">${c.emoji}</div>
      <div class="board-name">${c.id}${v===lead&&v>0?'<span class="crown">👑</span>':''}</div>
      <div class="board-bar"><i style="width:${Math.round(v/max*100)}%"></i></div>
      <div class="board-num">${v}</div>`;
    el.appendChild(row); });
}

/* ---- gallery ---- */
function buildGallery(char){ $('#gal-char').textContent=char;
  const coll=getColl(char); const grid=$('#gal-grid'); grid.innerHTML='';
  POOL.forEach(p=>{ const c=document.createElement('div'); c.className='cell';
    if(coll.has(p.id)){ c.innerHTML=p.img?`<img src="${p.img}" alt="">`:`<div class="ph">📸</div>`; }
    else{ c.classList.add('locked'); c.textContent='?'; } grid.appendChild(c); });
  loadScores().then(()=>buildBoard('#gal-board'));
}

/* ---- confetti ---- */
const cv=$('#confetti'),cctx=cv.getContext('2d');
function confetti(strong){ cv.hidden=false; cv.width=innerWidth; cv.height=innerHeight;
  const cols=['#ff5c8a','#38bdf8','#a855f7','#ffd23f','#ffffff']; const P=[];
  for(let i=0;i<(strong?150:70);i++)P.push({x:innerWidth/2,y:innerHeight*.3,vx:(Math.random()-.5)*15,vy:Math.random()*-14-3,g:.4,s:5+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function l(){cctx.clearRect(0,0,cv.width,cv.height);f++;for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;cctx.save();cctx.translate(p.x,p.y);cctx.rotate(p.r);cctx.fillStyle=p.c;cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cctx.restore();}if(f<90)requestAnimationFrame(l);else cv.hidden=true;})(); }

/* ---- character select ---- */
function buildCharSelect(){ const g=$('#char-grid'); g.innerHTML='';
  const veh={rabbit:'🐰',motorsport:'🏍️',hilux:'🛻'};
  const owner=getOwner();
  CHARS.forEach(c=>{ const v=getColl(c.id).size; const locked = owner && c.id!==owner;
    const card=document.createElement('button'); card.className='char-card'+(locked?' locked':'');
    card.innerHTML=`<div class="char-ava" style="background:${c.color}">${locked?'🔒':c.emoji}</div>
      <div class="char-name">${c.id} ${veh[c.vehicle]}</div>
      <div class="char-count">${locked?'Not you':('📸 '+v+' photos')}</div>`;
    if(locked){ card.disabled=true; }
    else card.addEventListener('click',()=>{ ac(); me=c; if(!owner) setOwner(c.id); startGame(); });
    g.appendChild(card); });
}

/* ---- controls ---- */
function hold(btn,key){ const on=e=>{e.preventDefault();keys[key]=true;}; const off=e=>{e.preventDefault();keys[key]=false;};
  btn.addEventListener('pointerdown',on); btn.addEventListener('pointerup',off); btn.addEventListener('pointerleave',off); btn.addEventListener('pointercancel',off); }
hold($('#btn-left'),'left'); hold($('#btn-right'),'right');
$('#btn-jump').addEventListener('pointerdown',e=>{e.preventDefault();keys.jump=true;});
document.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft')keys.left=true; if(e.key==='ArrowRight')keys.right=true; if(e.key===' '||e.key==='ArrowUp'){keys.jump=true;e.preventDefault();} });
document.addEventListener('keyup',e=>{ if(e.key==='ArrowLeft')keys.left=false; if(e.key==='ArrowRight')keys.right=false; });

/* ---- nav ---- */
$('#hud-gallery').addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); buildGallery(me.id); showScreen('screen-gallery'); });
$('#win-again').addEventListener('click',()=>startGame());
$('#win-gallery').addEventListener('click',()=>{ buildGallery(me.id); showScreen('screen-gallery'); });
$('#gal-back').addEventListener('click',()=>{ if(me) startGame(); else { buildCharSelect(); showScreen('screen-select'); } });

/* ---- boot: link (?me=Name) decides the character → straight into the game ---- */
loadScores();
(function boot(){
  const owner=getOwner();
  if(owner){ me=CHARS.find(c=>c.id===owner); startGame(); }
  else { buildCharSelect(); showScreen('screen-select'); }   // fallback if link has no ?me=
})();
