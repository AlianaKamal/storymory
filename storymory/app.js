/* ===========================================================================
   app.js — INTERNSHIP DASH (staged difficulty) 🎮🔥
   Pick a character, run & jump, collect photo-coins. Harder each stage;
   final stage = AUTO-RUN (only jump). Highest run score wins the race.
   Edit your photos in data.js. You normally don't touch this file.
   =========================================================================== */

const $=s=>document.querySelector(s);
const CHARS=[
  {id:'Nurin', color:'#ff5c8a', emoji:'🧕'},
  {id:'Haziq', color:'#38bdf8', emoji:'🧑'},
  {id:'Yana',  color:'#a855f7', emoji:'👩'},
];

/* ---- photo pool (from data.js) ---- */
const POOL=[];
CONTENT.forEach(it=>POOL.push({id:it.id, img:it.img||null, caption:it.caption||''}));
if(typeof PHOTOS!=='undefined' && PHOTOS.length) PHOTOS.forEach((n,i)=>POOL.push({id:'ph'+i, img:'img/'+n, caption:''}));

/* ---- per-character data (per phone) ---- */
function collKey(c){return 'dash_coll_'+c;}
function bestKey(c){return 'dash_best_'+c;}
function getColl(c){ try{return new Set(JSON.parse(localStorage.getItem(collKey(c))||'[]'));}catch(e){return new Set();} }
function saveColl(c,set){ try{localStorage.setItem(collKey(c),JSON.stringify([...set]));}catch(e){} }
function getBest(c){ try{return +localStorage.getItem(bestKey(c))||0;}catch(e){return 0;} }
function saveBest(c,v){ try{localStorage.setItem(bestKey(c),String(v));}catch(e){} }

/* ---- leaderboard (best run score; shared via Supabase if configured) ---- */
const SUPA = (typeof SUPABASE_URL!=='undefined' && SUPABASE_URL && SUPABASE_KEY);
let scores={Nurin:0,Haziq:0,Yana:0};
function localBests(){ const o={}; CHARS.forEach(c=>o[c.id]=getBest(c.id)); return o; }
async function loadScores(){
  if(SUPA){ try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/scores?select=character,total`,
      {headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    const rows=await r.json(); const o={Nurin:0,Haziq:0,Yana:0};
    if(Array.isArray(rows)) rows.forEach(x=>{ if(x.character in o) o[x.character]=x.total||0; });
    const loc=localBests(); CHARS.forEach(c=>{ o[c.id]=Math.max(o[c.id],loc[c.id]); });
    scores=o; return;
  }catch(e){} }
  scores=localBests();
}
async function pushScore(c){
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
const sCoin=()=>{beep(880,1320,'triangle',.12,.2); setTimeout(()=>beep(1320,1760,'triangle',.1,.15),60);};
const sUp  =()=>{[523,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,f,'square',.12,.18),i*70));};
const sWin =()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,f,'triangle',.18,.2),i*110));};
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
let player,solids,tokens,obstacles,goalX,worldW,camX,running,lastSafe,collectedThisRun,stage,prevStage;

const GRAV=0.62, MAXFALL=15, JUMP=-12.6;
const PER_ZONE=7;                     // tokens per stage zone
const ZONES=4;                        // total stages
const SPD=[3.3, 4.1, 5.0, 6.6];       // run speed per stage (stage4 = auto-run)
const AMP=[4, 12, 28, 16];            // token vertical motion per stage
const MSPD=[0.0015,0.003,0.005,0.006];// token motion speed per stage

function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function zoneOf(i){ return Math.min(ZONES-1, Math.floor(i/PER_ZONE)); }
function stageAtX(x){ const i=(x-760)/300; return Math.max(1, Math.min(ZONES, Math.floor(i/PER_ZONE)+1)); }

function buildLevel(){
  const total=PER_ZONE*ZONES;                         // 28 tokens, ramping
  const uncoll=shuffle(POOL.filter(p=>!getColl(me.id).has(p.id)));
  const items=[]; for(let i=0;i<total;i++){ items.push( uncoll.length? uncoll[i%uncoll.length] : POOL[i%POOL.length] ); }

  worldW = 760 + total*300 + 700;
  solids=[]; tokens=[]; obstacles=[];
  const gTop=groundY, gH=220;
  // ground: continuous (no deadly pits) so only obstacles/auto-run create risk
  solids.push({x:0,y:gTop,w:worldW,h:gH,ground:true});

  items.forEach((it,i)=>{
    const z=zoneOf(i), x=760+i*300;
    let baseY;
    if(z<3){
      if(i%2===0){ baseY=gTop-58; }
      else { solids.push({x:x-55,y:gTop-96,w:110,h:16,ground:false}); baseY=gTop-150; }
    }else{ baseY = (i%2===0)? gTop-70 : gTop-124; }       // auto-run: grab mid-jump
    tokens.push({x, baseY, y:baseY, r:18, item:it, got:false, z, phase:Math.random()*6});
  });

  // obstacles (spikes) in the AUTO-RUN zone — jump to survive
  const z4start=760+(ZONES-1)*PER_ZONE*300;
  for(let k=0;k<PER_ZONE-1;k++){ const x=z4start+150+k*300; obstacles.push({x,y:gTop-26,w:26,h:26}); }

  goalX=worldW-130;
  player={x:120,y:gTop-60,w:30,h:42,vx:0,vy:0,onGround:false,face:1,squash:0};
  lastSafe={x:player.x,y:player.y}; camX=0; collectedThisRun=0; stage=1; prevStage=1;
  $('#hud-char').textContent=me.id; $('#hud-score').textContent=0; $('#hud-stage').textContent='Stage 1';
}

function rectsHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

function update(){
  stage=stageAtX(player.x);
  if(stage!==prevStage){ prevStage=stage; sUp();
    $('#hud-stage').textContent = stage>=ZONES?'AUTO-LARI! 🔥':'Stage '+stage; }
  const autorun = stage>=ZONES;
  const spd = SPD[stage-1];
  $('#btn-left').style.opacity = autorun?'.3':'1';
  $('#btn-right').style.opacity = autorun?'.3':'1';

  // horizontal
  if(autorun){ player.vx=spd; player.face=1; }               // forced forward, no steering
  else if(keys.left){player.vx=-spd;player.face=-1;}
  else if(keys.right){player.vx=spd;player.face=1;}
  else player.vx*=0.7;
  player.x+=player.vx;
  for(const s of solids){ if(rectsHit(player,s)){ if(player.vx>0)player.x=s.x-player.w; else if(player.vx<0)player.x=s.x+s.w; player.vx=0; } }
  if(player.x<0)player.x=0;

  // vertical
  player.vy=Math.min(player.vy+GRAV,MAXFALL); player.y+=player.vy; player.onGround=false;
  for(const s of solids){ if(rectsHit(player,s)){
      if(player.vy>0){ player.y=s.y-player.h; player.vy=0; player.onGround=true; if(player.squash<1)player.squash=1; }
      else if(player.vy<0){ player.y=s.y+s.h; player.vy=0; } } }
  if(player.onGround){ player.squash*=0.8; lastSafe={x:player.x,y:player.y-4}; }

  // jump
  if(keys.jump && player.onGround){ player.vy=JUMP; player.onGround=false; sJump(); }
  keys.jump=false;

  // token motion
  const now=Date.now();
  for(const t of tokens){ t.y=t.baseY + Math.sin(now*MSPD[t.z]+t.phase)*AMP[t.z]; }

  // obstacles → hit ends the run
  for(const o of obstacles){ if(rectsHit(player,o)){ return endRun('over'); } }

  // fell off screen (shouldn't normally — ground is continuous) → respawn
  if(player.y>H+150){ player.x=lastSafe.x; player.y=lastSafe.y-40; player.vy=0; }

  // camera
  camX=Math.max(0,Math.min(player.x-W*0.34, worldW-W));

  // collect
  for(const t of tokens){ if(t.got)continue;
    const dx=(player.x+player.w/2)-t.x, dy=(player.y+player.h/2)-t.y;
    if(Math.hypot(dx,dy)<t.r+22) collect(t);
  }

  if(player.x>goalX) endRun('win');
}

function collect(t){
  t.got=true; collectedThisRun++; sCoin();
  const coll=getColl(me.id); if(!coll.has(t.item.id)){ coll.add(t.item.id); saveColl(me.id,coll); }
  $('#hud-score').textContent=collectedThisRun;
  const pop=document.createElement('div'); pop.className='pickpop'; pop.textContent='+1 📸';
  pop.style.left=(t.x-camX-10)+'px'; pop.style.top=(t.y-10)+'px';
  $('#screen-game').appendChild(pop); setTimeout(()=>pop.remove(),1000);
}

/* ---- drawing ---- */
const imgCache={};
function getImg(src){ if(!imgCache[src]){const im=new Image();im.src=src;imgCache[src]=im;} return imgCache[src]; }
function draw(){
  const g=ctx.createLinearGradient(0,0,0,H);
  if(stage>=ZONES){ g.addColorStop(0,'#5a2a3a'); g.addColorStop(1,'#ff8a5c'); }   // auto-run = sunset/heat
  else { g.addColorStop(0,'#2a4d7a'); g.addColorStop(1,'#5ec8ff'); }
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=stage>=ZONES?'#7a3b52':'#3e6fa6'; drawHills(0.3,groundY+40,90);
  ctx.fillStyle=stage>=ZONES?'#9c4f68':'#4f86c6'; drawHills(0.6,groundY+70,70);
  ctx.fillStyle='rgba(255,255,255,.7)';
  for(let i=0;i<6;i++){ const cx=((i*520-camX*0.4)%worldW+worldW)%worldW; cloud(cx,70+(i%3)*40); }

  ctx.save(); ctx.translate(-camX,0);
  for(const s of solids){
    if(s.ground){ ctx.fillStyle='#6b4a2b'; ctx.fillRect(s.x,s.y,s.w,s.h); ctx.fillStyle='#3fae57'; ctx.fillRect(s.x,s.y,s.w,14); }
    else{ ctx.fillStyle='#caa24a'; roundRect(s.x,s.y,s.w,s.h,5); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(s.x,s.y,s.w,4); }
  }
  // obstacles (spikes)
  ctx.fillStyle='#e23b4e';
  for(const o of obstacles){ ctx.beginPath(); ctx.moveTo(o.x,o.y+o.h); ctx.lineTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.closePath(); ctx.fill(); }
  // tokens
  for(const t of tokens){ if(t.got)continue;
    ctx.save(); ctx.translate(t.x,t.y); ctx.shadowColor='rgba(255,210,63,.9)'; ctx.shadowBlur=14;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,t.r+3,0,7); ctx.fill(); ctx.shadowBlur=0;
    if(t.item.img){ const im=getImg(t.item.img); ctx.save(); ctx.beginPath(); ctx.arc(0,0,t.r,0,7); ctx.clip();
        if(im.complete&&im.naturalWidth) ctx.drawImage(im,-t.r,-t.r,t.r*2,t.r*2); else {ctx.fillStyle='#ffd23f';ctx.fillRect(-t.r,-t.r,t.r*2,t.r*2);} ctx.restore();
    } else { ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.arc(0,0,t.r,0,7); ctx.fill();
        ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('📸',0,1); }
    ctx.restore();
  }
  // goal
  ctx.fillStyle='#e8e8e8'; ctx.fillRect(goalX,groundY-150,6,150);
  ctx.fillStyle=me.color; ctx.beginPath(); ctx.moveTo(goalX+6,groundY-150); ctx.lineTo(goalX+52,groundY-134); ctx.lineTo(goalX+6,groundY-118); ctx.fill();
  ctx.font='13px sans-serif'; ctx.textAlign='center'; ctx.fillText('🏁',goalX+28,groundY-126);
  drawPlayer();
  ctx.restore();
}
function drawHills(f,baseY,h){ const off=-camX*f; ctx.beginPath(); ctx.moveTo(0,H);
  for(let x=-200;x<W+200;x+=20){ const y=baseY-Math.abs(Math.sin((x+off)/160))*h; ctx.lineTo(x,y); }
  ctx.lineTo(W,H); ctx.closePath(); ctx.fill(); }
function cloud(x,y){ ctx.beginPath(); ctx.arc(x,y,16,0,7); ctx.arc(x+18,y+4,20,0,7); ctx.arc(x+40,y,15,0,7); ctx.fill(); }
function drawPlayer(){ const p=player,sq=p.squash,w=p.w*(1+sq*0.12),h=p.h*(1-sq*0.12),x=p.x-(w-p.w)/2,y=p.y+(p.h-h);
  ctx.save(); ctx.shadowColor='rgba(0,0,0,.3)'; ctx.shadowBlur=8; ctx.fillStyle=me.color; roundRect(x,y,w,h,9); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x+w/2-6+(p.face>0?4:-4),y+15,3.4,0,7); ctx.arc(x+w/2+6+(p.face>0?4:-4),y+15,3.4,0,7); ctx.fill();
  ctx.fillStyle='#223'; ctx.beginPath(); ctx.arc(x+w/2-6+(p.face>0?5:-3),y+15,1.6,0,7); ctx.arc(x+w/2+6+(p.face>0?5:-3),y+15,1.6,0,7); ctx.fill();
  ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(me.emoji,x+w/2,y+h-12);
  ctx.font='bold 11px sans-serif'; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=3;
  ctx.strokeText(me.id,x+w/2,y-8); ctx.fillText(me.id,x+w/2,y-8); ctx.restore(); }
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

let raf=null;
function loop(){ if(!running)return; update(); if(running) draw(); raf=requestAnimationFrame(loop); }
function startGame(){ showScreen('screen-game'); resize(); buildLevel(); running=true; cancelAnimationFrame(raf); loop(); }

function endRun(result){
  if(!running)return; running=false; cancelAnimationFrame(raf);
  const best=Math.max(getBest(me.id),collectedThisRun); saveBest(me.id,best); scores[me.id]=Math.max(scores[me.id]||0,best); pushScore(me.id);
  if(result==='win'){ sWin(); confetti(true); $('#win-emoji').textContent='🏆'; $('#win-title').textContent='Habis semua stage!';
    $('#win-sub').textContent=`${me.id} kutip ${collectedThisRun} gambar · rekod terbaik: ${best}`; }
  else { sOver(); $('#win-emoji').textContent='💥'; $('#win-title').textContent='Kena duri! Tamat.';
    $('#win-sub').textContent=`${me.id} kutip ${collectedThisRun} gambar kali ni · rekod terbaik: ${best}`; }
  loadScores().then(()=>buildBoard('#win-board'));
  showScreen('screen-win');
}

/* ---- leaderboard UI ---- */
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
    else{ c.classList.add('locked'); c.textContent='?'; }
    grid.appendChild(c); });
  loadScores().then(()=>buildBoard('#gal-board'));
}

/* ---- confetti ---- */
const cv=$('#confetti'),cctx=cv.getContext('2d');
function confetti(strong){ cv.hidden=false; cv.width=innerWidth; cv.height=innerHeight;
  const cols=['#ff5c8a','#38bdf8','#a855f7','#ffd23f','#ffffff']; const P=[];
  for(let i=0;i<(strong?140:70);i++)P.push({x:innerWidth/2,y:innerHeight*.3,vx:(Math.random()-.5)*15,vy:Math.random()*-14-3,g:.4,s:5+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function l(){cctx.clearRect(0,0,cv.width,cv.height);f++;for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;cctx.save();cctx.translate(p.x,p.y);cctx.rotate(p.r);cctx.fillStyle=p.c;cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cctx.restore();}if(f<90)requestAnimationFrame(l);else cv.hidden=true;})(); }

/* ---- character select ---- */
function buildCharSelect(){ const g=$('#char-grid'); g.innerHTML='';
  CHARS.forEach(c=>{ const v=getColl(c.id).size,bs=getBest(c.id); const card=document.createElement('button'); card.className='char-card';
    card.innerHTML=`<div class="char-ava" style="background:${c.color}">${c.emoji}</div>
      <div class="char-name">${c.id}</div><div class="char-count">📸 ${v} · 🏆 ${bs}</div>`;
    card.addEventListener('click',()=>{ ac(); me=c; startGame(); }); g.appendChild(card); });
}

/* ---- controls ---- */
function hold(btn,key){ const on=e=>{e.preventDefault();keys[key]=true;}; const off=e=>{e.preventDefault();keys[key]=false;};
  btn.addEventListener('pointerdown',on); btn.addEventListener('pointerup',off); btn.addEventListener('pointerleave',off); btn.addEventListener('pointercancel',off); }
hold($('#btn-left'),'left'); hold($('#btn-right'),'right');
$('#btn-jump').addEventListener('pointerdown',e=>{e.preventDefault();keys.jump=true;});
document.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft')keys.left=true; if(e.key==='ArrowRight')keys.right=true; if(e.key===' '||e.key==='ArrowUp'){keys.jump=true;e.preventDefault();} });
document.addEventListener('keyup',e=>{ if(e.key==='ArrowLeft')keys.left=false; if(e.key==='ArrowRight')keys.right=false; });

/* ---- nav ---- */
$('#to-select').addEventListener('click',()=>{ ac(); buildCharSelect(); showScreen('screen-select'); });
$('#to-gallery-1').addEventListener('click',()=>{ me=me||CHARS[0]; buildGallery(me.id); showScreen('screen-gallery'); });
$('#back-title').addEventListener('click',()=>showScreen('screen-title'));
$('#hud-exit').addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); showScreen('screen-title'); });
$('#win-again').addEventListener('click',()=>startGame());
$('#win-gallery').addEventListener('click',()=>{ buildGallery(me.id); showScreen('screen-gallery'); });
$('#gal-back').addEventListener('click',()=>showScreen('screen-title'));

/* ---- boot ---- */
loadScores();
showScreen('screen-title');
