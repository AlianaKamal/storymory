/* ===========================================================================
   app.js — INTERNSHIP DASH (office runner, Subway-Surfers style) 🏃‍♀️
   3 lanes, swipe left/right to change lane, swipe up to jump.
   Run through the Kolej Komuniti Temerloh office; collect photo-coins,
   dodge office obstacles, grab the hidden SECRET for a new memory.
   Edit photos in data.js.
   =========================================================================== */

const $=s=>document.querySelector(s);
const CHARS=[
  {id:'Nurin', color:'#ff5c8a', vehicle:'rabbit'},
  {id:'Haziq', color:'#38bdf8', vehicle:'motorsport'},
  {id:'Yana',  color:'#a855f7', vehicle:'hilux'},
];
const FACE_SRC = (typeof FACES!=='undefined') ? FACES : {};

/* ---- photo pool (from data.js) ---- */
const POOL=[];
CONTENT.forEach(it=>POOL.push({id:it.id, img:it.img||null, caption:it.caption||''}));
if(typeof PHOTOS!=='undefined' && PHOTOS.length) PHOTOS.forEach((n,i)=>POOL.push({id:'ph'+i, img:'img/'+n, caption:''}));

/* ---- owner lock (link ?me=Name) ---- */
function getOwner(){ try{return localStorage.getItem('dash_owner')||'';}catch(e){return '';} }
function setOwner(c){ try{localStorage.setItem('dash_owner',c);}catch(e){} }
(function initOwner(){
  const q=new URLSearchParams(location.search).get('me');
  const h=decodeURIComponent((location.hash||'').replace('#','')).trim();
  const want=(q||h||'').toLowerCase();
  const m=CHARS.find(c=>c.id.toLowerCase()===want); if(m) setOwner(m.id);
})();

/* ---- per-character data ---- */
function collKey(c){return 'dash_coll_'+c;}
function coinKey(c){return 'dash_coins_'+c;}
function getColl(c){ try{return new Set(JSON.parse(localStorage.getItem(collKey(c))||'[]'));}catch(e){return new Set();} }
function saveColl(c,set){ try{localStorage.setItem(collKey(c),JSON.stringify([...set]));}catch(e){} }
function getBestCoins(c){ try{return +localStorage.getItem(coinKey(c))||0;}catch(e){return 0;} }
function saveBestCoins(c,v){ try{localStorage.setItem(coinKey(c),String(v));}catch(e){} }

/* ---- leaderboard = photos collected (Supabase if configured) ---- */
const SUPA = (typeof SUPABASE_URL!=='undefined' && SUPABASE_URL && SUPABASE_KEY);
let scores={Nurin:0,Haziq:0,Yana:0};
function localColl(){ const o={}; CHARS.forEach(c=>o[c.id]=getColl(c.id).size); return o; }
async function loadScores(){
  if(SUPA){ try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/scores?select=character,total`,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
    const rows=await r.json(); const o={Nurin:0,Haziq:0,Yana:0};
    if(Array.isArray(rows)) rows.forEach(x=>{ if(x.character in o) o[x.character]=x.total||0; });
    const loc=localColl(); CHARS.forEach(c=>{ o[c.id]=Math.max(o[c.id],loc[c.id]); }); scores=o; return;
  }catch(e){} }
  scores=localColl();
}
async function pushScore(c){ scores[c]=getColl(c).size;
  if(SUPA){ try{ await fetch(`${SUPABASE_URL}/rest/v1/scores`,{method:'POST',
    headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify([{character:c,total:scores[c]}])}); }catch(e){} }
}

/* ---- screens & sound ---- */
function showScreen(id){ document.querySelectorAll('.screen').forEach(s=>{s.hidden=true;s.classList.remove('show');}); const el=$('#'+id); el.hidden=false; el.classList.add('show'); }
let actx=null;
function ac(){if(!actx){try{actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(actx&&actx.state==='suspended')actx.resume();return actx;}
function beep(f1,f2,t,d,v){const c=ac();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=t||'square';
  o.frequency.setValueAtTime(f1,c.currentTime); if(f2)o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+d);
  g.gain.setValueAtTime(v||.2,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+d+.02);}
const sCoin=()=>beep(880,1320,'triangle',.1,.18);
const sJump=()=>beep(400,760,'square',.14,.16);
const sSwish=()=>beep(600,300,'sine',.08,.12);
const sSecret=()=>{[659,880,1046,1318,1568].forEach((f,i)=>setTimeout(()=>beep(f,f,'triangle',.2,.22),i*110));};
const sOver=()=>{[400,300,200].forEach((f,i)=>setTimeout(()=>beep(f,f*0.8,'sawtooth',.2,.2),i*120));};

/* ===========================================================================
   OFFICE RUNNER
   =========================================================================== */
const canvas=$('#game'); const ctx=canvas.getContext('2d');
let W=360,H=640,dpr=1;
function resize(){ const r=canvas.getBoundingClientRect(); dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(320,r.width); H=Math.max(360,r.height); canvas.width=W*dpr; canvas.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
window.addEventListener('resize',()=>{ if(!$('#screen-game').hidden) resize(); });

// the office route (preview = 2 zones; more to come)
const ZONES=[
  {id:'entrance',    name:'KOLEJ KOMUNITI TEMERLOH', sky:['#cfe0ff','#9fc0ef'], floor:'#b9c6dd', floor2:'#aab9d3', wall:'#7FA8E0', deco:'#ffd23f'},
  {id:'pengambilan', name:'Bilik Pengambilan',       sky:['#ffe6f3','#ffd0a8'], floor:'#ffe0b0', floor2:'#ffd49a', wall:'#ff9ec4', deco:'#ff5c8a'},
];
const ZONE_LEN=2600;

let me=null;
const keys={fly:false};
let player, objs, dist, speed, goalDist, running, coinScore, zoneIdx, prevZone, secret, secretArmed;

const CAMF=260, SPAWNZ=1150, GRAV=1.1;
function proj(z){ return CAMF/(CAMF+Math.max(z,-CAMF*0.9)); }
function horizonY(){ return H*0.34; }
function groundNearY(){ return H*0.92; }
function laneGap(){ return W*0.22; }
function laneScreenX(lane,s){ return W/2 + (lane-1)*laneGap()*s; }

function zoneOfDist(d){ return Math.min(ZONES.length-1, Math.floor(d/ZONE_LEN)); }

function buildLevel(){
  objs=[]; dist=0; speed=7; coinScore=0; secret=null; secretArmed=true;
  goalDist = ZONES.length*ZONE_LEN;
  player={ lane:1, lx:1, jumpY:0, jumpVy:0, anim:0 };
  zoneIdx=0; prevZone=-1; nextSpawn=160;
  $('#hud-char').textContent=me.id; $('#hud-score').textContent=0; $('#hud-stage').textContent=ZONES[0].name;
}

let nextSpawn=0, coinLane=1;
function spawnRow(){
  const z=zoneIdx;
  // obstacle?
  const obChance = 0.45 + z*0.12;
  let obsLane=-1;
  if(Math.random()<obChance){ obsLane=Math.floor(Math.random()*3);
    objs.push({z:SPAWNZ, lane:obsLane, kind:'obs', typ:Math.floor(Math.random()*3), done:false}); }
  // coins — keep a flowing trail, avoid the obstacle lane
  if(Math.random()<0.8){
    if(Math.random()<0.4 || coinLane===obsLane){ coinLane=[0,1,2].filter(l=>l!==obsLane)[Math.floor(Math.random()*(obsLane<0?3:2))]; }
    const it=POOL.length?POOL[(Math.random()*POOL.length)|0]:{id:'x',img:null};
    objs.push({z:SPAWNZ, lane:coinLane, kind:'coin', item:it, done:false});
  }
}

function update(){
  zoneIdx=zoneOfDist(dist);
  if(zoneIdx!==prevZone){ prevZone=zoneIdx; $('#hud-stage').textContent=ZONES[zoneIdx].name; sSwish(); }
  speed = 7 + zoneIdx*1.4 + dist*0.00035; if(speed>16) speed=16;
  dist += speed;

  // lane lerp
  player.lx += (player.lane - player.lx)*0.25;
  // jump
  if(player.jumpY>0 || player.jumpVy!==0){ player.jumpVy -= GRAV; player.jumpY += player.jumpVy;
    if(player.jumpY<=0){ player.jumpY=0; player.jumpVy=0; } }
  player.anim += speed*0.03;

  // spawns (by distance)
  while(dist > nextSpawn){ spawnRow(); nextSpawn += 300; }
  // secret in zone 2
  if(secretArmed && dist > ZONE_LEN*1.5){ secretArmed=false;
    const coll=getColl(me.id); const next=POOL.find(p=>!coll.has(p.id));
    if(next){ secret={z:SPAWNZ, lane:Math.floor(Math.random()*3), kind:'secret', item:next, done:false}; objs.push(secret); } }

  // move objects toward camera; resolve at player plane
  const plane=0, pr=Math.round(player.lx);
  for(const o of objs){
    o.z -= speed;
    if(!o.done && o.z<=plane){ o.done=true;
      const sameLane = o.lane===pr;
      if(o.kind==='coin'){ if(sameLane){ coinScore++; sCoin(); $('#hud-score').textContent=coinScore; pop('+1'); } }
      else if(o.kind==='secret'){ if(sameLane){ return endRun('secret', o.item); } }
      else { if(sameLane && player.jumpY<70){ return endRun('over'); } }
    }
  }
  objs=objs.filter(o=>o.z>-80);

  if(dist>goalDist && objs.every(o=>o.kind!=='secret'||o.done)) endRun('win');
}
function pop(txt){ const d=document.createElement('div'); d.className='pickpop'; d.textContent=txt;
  d.style.left=(laneScreenX(player.lx,1)-14)+'px'; d.style.top=(groundNearY()-player.jumpY-70)+'px';
  $('#screen-game').appendChild(d); setTimeout(()=>d.remove(),900); }

/* ---- drawing ---- */
const imgCache={}; function getImg(s){ if(!s)return null; if(!imgCache[s]){const i=new Image();i.src=s;imgCache[s]=i;} return imgCache[s]; }
function ready(im){ return im&&im.complete&&im.naturalWidth; }
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function draw(){
  const Z=ZONES[zoneIdx], hy=horizonY(), gy=groundNearY(), cx=W/2;
  // sky / upper wall
  const g=ctx.createLinearGradient(0,0,0,hy); g.addColorStop(0,Z.sky[0]); g.addColorStop(1,Z.sky[1]);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,hy);
  // back wall band + zone sign
  ctx.fillStyle=Z.wall; ctx.fillRect(W*0.30,hy-46,W*0.40,46);
  ctx.fillStyle='#fff'; ctx.font='bold '+Math.max(9,Math.min(13,W*0.02))+'px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle';
  wrapText(Z.name, cx, hy-23, W*0.36, 13);

  // floor trapezoid
  const nL=W*0.06, nR=W*0.94, fL=cx-W*0.07, fR=cx+W*0.07;
  ctx.fillStyle=Z.floor; ctx.beginPath(); ctx.moveTo(nL,gy); ctx.lineTo(nR,gy); ctx.lineTo(fR,hy); ctx.lineTo(fL,hy); ctx.closePath(); ctx.fill();
  // moving floor stripes (motion)
  ctx.strokeStyle=Z.floor2; ctx.lineWidth=2;
  const period=240, off=((dist*1)%period);
  for(let d=off; d<2600; d+=period){ const s=proj(d); const y=hy+(gy-hy)*s; ctx.globalAlpha=Math.min(1,s*1.4);
    ctx.beginPath(); ctx.moveTo(cx-(W*0.44)*s,y); ctx.lineTo(cx+(W*0.44)*s,y); ctx.stroke(); }
  ctx.globalAlpha=1;
  // lane dividers (converge to vanishing point)
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.setLineDash([14,14]); ctx.lineWidth=3;
  [-0.5,0.5].forEach(k=>{ ctx.beginPath(); ctx.moveTo(cx+k*laneGap(),gy); ctx.lineTo(cx+k*8,hy); ctx.stroke(); });
  ctx.setLineDash([]);
  // side walls
  ctx.fillStyle=shade(Z.wall,-10); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(nL,gy); ctx.lineTo(fL,hy); ctx.lineTo(0,hy); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W,0); ctx.lineTo(nR,gy); ctx.lineTo(fR,hy); ctx.lineTo(W,hy); ctx.closePath(); ctx.fill();
  // scrolling wall panels (doors/posters)
  drawWallPanels(Z,hy,gy,nL,fL,-1); drawWallPanels(Z,hy,gy,nR,fR,1);

  // objects far -> near
  const order=objs.slice().sort((a,b)=>b.z-a.z);
  for(const o of order){ if(o.z<-40)continue; const s=proj(o.z); const x=laneScreenX(o.lane,s); const y=hy+(gy-hy)*s;
    if(o.kind==='coin') drawCoinP(x,y,s,o.item);
    else if(o.kind==='secret') drawSecretP(x,y,s);
    else drawObstacle(x,y,s,o.typ,Z);
  }

  // player
  drawRunner(laneScreenX(player.lx,1), gy-player.jumpY);

  // goal gate near the end
  if(dist>goalDist-900){ const gz=goalDist-dist; if(gz>-60){ const s=proj(gz); const y=hy+(gy-hy)*s;
    ctx.font=(40*s)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🏁',cx,y); } }
}
const FONT="'Fredoka',sans-serif";
function wrapText(t,x,y,maxW,lh){ const words=t.split(' '); let line='',yy=y, lines=[];
  for(const w of words){ const test=line?line+' '+w:w; if(ctx.measureText(test).width>maxW&&line){lines.push(line);line=w;} else line=test; }
  lines.push(line); yy=y-(lines.length-1)*lh/2; lines.forEach((l,i)=>ctx.fillText(l,x,yy+i*lh)); }
function shade(hex,p){ const n=parseInt(hex.slice(1),16); let r=(n>>16)+p,gg=((n>>8)&255)+p,b=(n&255)+p;
  r=Math.max(0,Math.min(255,r));gg=Math.max(0,Math.min(255,gg));b=Math.max(0,Math.min(255,b));
  return '#'+((1<<24)+(r<<16)+(gg<<8)+b).toString(16).slice(1); }
function drawWallPanels(Z,hy,gy,nX,fX,side){
  const period=320, off=((dist*1)%period);
  for(let d=off; d<2600; d+=period){ const s=proj(d), s2=proj(d+120);
    const y1=hy+(gy-hy)*s, y2=hy+(gy-hy)*s2;
    const x1=nX+(fX-nX)*(1-s), x2=nX+(fX-nX)*(1-s2);
    ctx.fillStyle=shade(Z.wall,20); ctx.globalAlpha=Math.min(1,s*1.5);
    ctx.beginPath(); ctx.moveTo(x1,y1-70*s); ctx.lineTo(x2,y2-70*s2); ctx.lineTo(x2,y2-18*s2); ctx.lineTo(x1,y1-18*s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
  }
}
function drawCoinP(x,y,s,item){ const r=26*s; if(r<3)return; ctx.save(); ctx.translate(x,y-40*s);
  ctx.shadowColor='rgba(255,210,63,.9)'; ctx.shadowBlur=12*s; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,r+3*s,0,7); ctx.fill(); ctx.shadowBlur=0;
  const im=item&&item.img?getImg(item.img):null;
  if(ready(im)){ ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.clip(); ctx.drawImage(im,-r,-r,r*2,r*2); ctx.restore(); }
  else { ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill(); ctx.font=(r*1.1)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('📸',0,1); }
  ctx.restore(); }
function drawSecretP(x,y,s){ const r=30*s; if(r<3)return; const t=Date.now()/300; ctx.save(); ctx.translate(x,y-46*s);
  ctx.save(); ctx.rotate(t); const grd=ctx.createConicGradient?ctx.createConicGradient(0,0,0):null;
  if(grd){grd.addColorStop(0,'#ff5c8a');grd.addColorStop(.33,'#ffd23f');grd.addColorStop(.66,'#38bdf8');grd.addColorStop(1,'#ff5c8a');ctx.fillStyle=grd;} else ctx.fillStyle='#ffd23f';
  ctx.beginPath(); ctx.arc(0,0,r+8*s,0,7); ctx.fill(); ctx.restore();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,r+2*s,0,7); ctx.fill();
  ctx.font=(r*1.3)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎁',0,2); ctx.restore(); }
function drawObstacle(x,y,s,typ,Z){ if(s<0.06)return; ctx.save(); ctx.translate(x,y);
  const w=70*s, h=58*s;
  if(typ===0){ // office chair
    ctx.fillStyle='#4a5568'; roundRect(-w*0.3,-h,w*0.6,h*0.7,6*s); ctx.fill(); ctx.fillStyle='#2d3748'; roundRect(-w*0.34,-h*0.35,w*0.68,h*0.3,5*s); ctx.fill();
    ctx.fillStyle='#1a202c'; ctx.fillRect(-2*s,-h*0.1,4*s,h*0.3); ctx.beginPath(); ctx.arc(0,h*0.18,w*0.28,0,7); ctx.fill();
  } else if(typ===1){ // boxes
    ctx.fillStyle='#d9a66b'; roundRect(-w*0.4,-h*0.8,w*0.8,h*0.8,4*s); ctx.fill(); ctx.fillStyle='rgba(0,0,0,.12)'; ctx.fillRect(-w*0.4,-h*0.5,w*0.8,4*s);
    ctx.strokeStyle='#a5763f'; ctx.lineWidth=3*s; ctx.beginPath(); ctx.moveTo(0,-h*0.8); ctx.lineTo(0,0); ctx.stroke();
  } else { // desk
    ctx.fillStyle=shade(Z.deco,-30); roundRect(-w*0.5,-h*0.55,w,h*0.22,4*s); ctx.fill();
    ctx.fillStyle=shade(Z.deco,-50); ctx.fillRect(-w*0.42,-h*0.33,6*s,h*0.33); ctx.fillRect(w*0.36,-h*0.33,6*s,h*0.33);
  }
  ctx.restore(); }

function drawFace(r,f){ const src=FACE_SRC[me.id], im=src?getImg(src):null;
  ctx.save(); ctx.scale(f,1);
  if(ready(im)){ const s=r*2.3; ctx.drawImage(im,-s/2,-s/2,s,s); }
  else { ctx.fillStyle='#ffd9a8'; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill(); }
  ctx.restore(); }
function drawRunner(px,py){
  const bob=Math.sin(player.anim)*3, legA=Math.sin(player.anim)*8;
  ctx.save(); ctx.translate(px,py);
  // shadow
  ctx.fillStyle='rgba(40,20,40,.2)'; ctx.beginPath(); ctx.ellipse(0,2,30,9,0,0,7); ctx.fill();
  // hoverboard in char colour
  ctx.fillStyle=me.color; roundRect(-30,-8,60,12,6); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.4)'; roundRect(-26,-6,52,3,2); ctx.fill();
  // legs
  ctx.fillStyle='#394056'; roundRect(-12,-34+bob,9,28+legA,4); ctx.fill(); roundRect(3,-34+bob,9,28-legA,4); ctx.fill();
  // body
  ctx.fillStyle=me.color; roundRect(-16,-62+bob,32,34,10); ctx.fill();
  // head (face)
  ctx.save(); ctx.translate(0,-80+bob); drawFace(19,1); ctx.restore();
  // name
  ctx.font='bold 11px '+FONT; ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3; ctx.textAlign='center';
  ctx.strokeText(me.id,0,-104+bob); ctx.fillText(me.id,0,-104+bob);
  ctx.restore();
}

let raf=null;
function loop(){ if(!running)return; update(); if(running) draw(); raf=requestAnimationFrame(loop); }
function startGame(){ showScreen('screen-game'); resize(); buildLevel(); running=true; cancelAnimationFrame(raf); loop(); }

function endRun(result, secretItem){
  if(!running)return; running=false; cancelAnimationFrame(raf);
  saveBestCoins(me.id, Math.max(getBestCoins(me.id),coinScore));
  if(result==='secret' && secretItem){ const coll=getColl(me.id); coll.add(secretItem.id); saveColl(me.id,coll); }
  pushScore(me.id); const total=getColl(me.id).size;
  if(result==='secret'){ sSecret(); confetti(true); $('#win-emoji').textContent='🎁'; $('#win-title').textContent='SECRET FOUND!';
    const cap=secretItem&&secretItem.caption?` — "${secretItem.caption}"`:''; $('#win-sub').textContent=`New photo for ${me.id}${cap} 🎉 · coins: ${coinScore} · photos: ${total}`; }
  else if(result==='win'){ sSecret(); const left=POOL.some(p=>!getColl(me.id).has(p.id)); $('#win-emoji').textContent=left?'🏁':'🏆';
    $('#win-title').textContent=left?'Finished the office!':'All photos collected!'; $('#win-sub').textContent=`coins: ${coinScore} · ${me.id}'s photos: ${total}`; }
  else { sOver(); $('#win-emoji').textContent='💥'; $('#win-title').textContent='Crashed! Game over'; $('#win-sub').textContent=`coins: ${coinScore} · ${me.id}'s photos: ${total}`; }
  loadScores().then(()=>buildBoard('#win-board')); showScreen('screen-win');
}

/* ---- leaderboard ---- */
function buildBoard(sel){ const el=$(sel); el.innerHTML='';
  const max=Math.max(1,...CHARS.map(c=>scores[c.id]||0)), lead=Math.max(...CHARS.map(c=>scores[c.id]||0));
  CHARS.slice().sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).forEach(c=>{ const v=scores[c.id]||0; const src=FACE_SRC[c.id];
    const row=document.createElement('div'); row.className='board-row'+(v===lead&&v>0?' lead':'');
    row.innerHTML=`<div class="board-ava" style="background:${c.color}">${src?`<img src="${src}" alt="">`:''}</div>
      <div class="board-name">${c.id}${v===lead&&v>0?'<span class="crown">👑</span>':''}</div>
      <div class="board-bar"><i style="width:${Math.round(v/max*100)}%"></i></div>
      <div class="board-num">${v}</div>`; el.appendChild(row); });
}
/* ---- gallery ---- */
function buildGallery(char){ $('#gal-char').textContent=char; const coll=getColl(char); const grid=$('#gal-grid'); grid.innerHTML='';
  POOL.forEach(p=>{ const c=document.createElement('div'); c.className='cell';
    if(coll.has(p.id)){ c.innerHTML=p.img?`<img src="${p.img}" alt="">`:`<div class="ph">📸</div>`; } else { c.classList.add('locked'); c.textContent='?'; } grid.appendChild(c); });
  loadScores().then(()=>buildBoard('#gal-board'));
}
/* ---- confetti ---- */
const cv=$('#confetti'),cctx=cv.getContext('2d');
function confetti(strong){ cv.hidden=false; cv.width=innerWidth; cv.height=innerHeight; const cols=['#ff5c8a','#38bdf8','#a855f7','#ffd23f','#fff']; const P=[];
  for(let i=0;i<(strong?150:70);i++)P.push({x:innerWidth/2,y:innerHeight*.3,vx:(Math.random()-.5)*15,vy:Math.random()*-14-3,g:.4,s:5+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function l(){cctx.clearRect(0,0,cv.width,cv.height);f++;for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;cctx.save();cctx.translate(p.x,p.y);cctx.rotate(p.r);cctx.fillStyle=p.c;cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cctx.restore();}if(f<90)requestAnimationFrame(l);else cv.hidden=true;})(); }

/* ---- character select (fallback) ---- */
function buildCharSelect(){ const g=$('#char-grid'); g.innerHTML=''; const owner=getOwner();
  CHARS.forEach(c=>{ const v=getColl(c.id).size, locked=owner&&c.id!==owner, src=FACE_SRC[c.id];
    const card=document.createElement('button'); card.className='char-card'+(locked?' locked':'');
    card.innerHTML=`<div class="char-ava" style="background:${c.color};overflow:hidden">${locked?'🔒':(src?`<img src="${src}" style="width:100%;height:100%;object-fit:cover">`:'')}</div>
      <div class="char-name">${c.id}</div><div class="char-count">${locked?'Not you':('📸 '+v+' photos')}</div>`;
    if(locked) card.disabled=true; else card.addEventListener('click',()=>{ ac(); me=c; if(!owner)setOwner(c.id); startGame(); });
    g.appendChild(card); });
}

/* ---- controls: swipe (left/right lane, up jump) + keyboard ---- */
function moveLane(d){ const n=Math.max(0,Math.min(2,player.lane+d)); if(n!==player.lane){ player.lane=n; sSwish(); } }
function doJump(){ if(player.jumpY<=0){ player.jumpVy=18; player.jumpY=1; sJump(); } }
const gameScreen=$('#screen-game'); let sx=0,sy=0,sw=false;
gameScreen.addEventListener('pointerdown',e=>{ if(e.target.closest('.hud'))return; sx=e.clientX; sy=e.clientY; sw=true; });
gameScreen.addEventListener('pointerup',e=>{ if(!sw)return; sw=false; const dx=e.clientX-sx, dy=e.clientY-sy;
  if(Math.abs(dx)<24 && Math.abs(dy)<24){ doJump(); return; }   // tap = jump
  if(Math.abs(dx)>Math.abs(dy)){ moveLane(dx>0?1:-1); } else if(dy<0){ doJump(); } });
document.addEventListener('keydown',e=>{ if(!running)return;
  if(e.key==='ArrowLeft')moveLane(-1); if(e.key==='ArrowRight')moveLane(1);
  if(e.key==='ArrowUp'||e.key===' '){ doJump(); e.preventDefault(); } });

/* ---- nav ---- */
$('#hud-gallery').addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); buildGallery(me.id); showScreen('screen-gallery'); });
$('#win-again').addEventListener('click',()=>startGame());
$('#win-gallery').addEventListener('click',()=>{ buildGallery(me.id); showScreen('screen-gallery'); });
$('#gal-back').addEventListener('click',()=>{ if(me) startGame(); else { buildCharSelect(); showScreen('screen-select'); } });

/* ---- boot ---- */
loadScores();
(function boot(){ const owner=getOwner(); if(owner){ me=CHARS.find(c=>c.id===owner); startGame(); } else { buildCharSelect(); showScreen('screen-select'); } })();
