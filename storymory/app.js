/* ===========================================================================
   app.js — INTERNSHIP DASH (real 3D runner, Three.js) 🏃‍♀️🧊
   3 lanes · swipe left/right to change lane · swipe up to jump.
   Low-poly office world (Kolej Komuniti Temerloh). Gold coins = score,
   dodge office obstacles, grab the SECRET gift for a new photo.
   Edit photos in data.js.
   =========================================================================== */

const $=s=>document.querySelector(s);
const CHARS=[
  {id:'Nurin', color:0xff5c8a, vehicle:'rabbit'},
  {id:'Haziq', color:0x38bdf8, vehicle:'motorsport'},
  {id:'Yana',  color:0xa855f7, vehicle:'hilux'},
];
const FACE_SRC = (typeof FACES!=='undefined') ? FACES : {};
const hexCss = n => '#'+n.toString(16).padStart(6,'0');

/* ---- photo pool ---- */
const POOL=[];
CONTENT.forEach(it=>POOL.push({id:it.id, img:it.img||null, caption:it.caption||''}));
if(typeof PHOTOS!=='undefined' && PHOTOS.length) PHOTOS.forEach((n,i)=>POOL.push({id:'ph'+i, img:'img/'+n, caption:''}));

/* ---- owner lock (?me=Name) ---- */
function getOwner(){ try{return localStorage.getItem('dash_owner')||'';}catch(e){return '';} }
function setOwner(c){ try{localStorage.setItem('dash_owner',c);}catch(e){} }
(function(){ const q=new URLSearchParams(location.search).get('me'); const h=decodeURIComponent((location.hash||'').replace('#','')).trim();
  const w=(q||h||'').toLowerCase(); const m=CHARS.find(c=>c.id.toLowerCase()===w); if(m) setOwner(m.id); })();

/* ---- per-character data ---- */
function collKey(c){return 'dash_coll_'+c;} function coinKey(c){return 'dash_coins_'+c;}
function getColl(c){ try{return new Set(JSON.parse(localStorage.getItem(collKey(c))||'[]'));}catch(e){return new Set();} }
function saveColl(c,set){ try{localStorage.setItem(collKey(c),JSON.stringify([...set]));}catch(e){} }
function getBestCoins(c){ try{return +localStorage.getItem(coinKey(c))||0;}catch(e){return 0;} }
function saveBestCoins(c,v){ try{localStorage.setItem(coinKey(c),String(v));}catch(e){} }

/* ---- leaderboard (Supabase optional) ---- */
const SUPA=(typeof SUPABASE_URL!=='undefined'&&SUPABASE_URL&&SUPABASE_KEY);
let scores={Nurin:0,Haziq:0,Yana:0};
function localColl(){const o={};CHARS.forEach(c=>o[c.id]=getColl(c.id).size);return o;}
async function loadScores(){ if(SUPA){ try{
  const r=await fetch(`${SUPABASE_URL}/rest/v1/scores?select=character,total`,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
  const rows=await r.json(); const o={Nurin:0,Haziq:0,Yana:0}; if(Array.isArray(rows))rows.forEach(x=>{if(x.character in o)o[x.character]=x.total||0;});
  const loc=localColl(); CHARS.forEach(c=>o[c.id]=Math.max(o[c.id],loc[c.id])); scores=o; return; }catch(e){} }
  scores=localColl(); }
async function pushScore(c){ scores[c]=getColl(c).size; if(SUPA){ try{ await fetch(`${SUPABASE_URL}/rest/v1/scores`,{method:'POST',
  headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
  body:JSON.stringify([{character:c,total:scores[c]}])}); }catch(e){} } }

/* ---- screens & sound ---- */
function showScreen(id){ document.querySelectorAll('.screen').forEach(s=>{s.hidden=true;s.classList.remove('show');}); const el=$('#'+id); el.hidden=false; el.classList.add('show'); }
let actx=null; function ac(){if(!actx){try{actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(actx&&actx.state==='suspended')actx.resume();return actx;}
function beep(f1,f2,t,d,v){const c=ac();if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=t||'square';
  o.frequency.setValueAtTime(f1,c.currentTime); if(f2)o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+d);
  g.gain.setValueAtTime(v||.2,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+d+.02);}
const sCoin=()=>beep(880,1320,'triangle',.09,.16);
const sJump=()=>beep(380,720,'square',.14,.16);
const sSwish=()=>beep(600,300,'sine',.08,.1);
const sSecret=()=>{[659,880,1046,1318,1568].forEach((f,i)=>setTimeout(()=>beep(f,f,'triangle',.2,.22),i*110));};
const sOver=()=>{[400,300,200].forEach((f,i)=>setTimeout(()=>beep(f,f*0.8,'sawtooth',.2,.2),i*120));};

/* ===========================================================================
   3D OFFICE RUNNER (Three.js)
   =========================================================================== */
const ZONES=[
  {id:'entrance',    name:'KOLEJ KOMUNITI TEMERLOH', bg:0x9fc4f0, fog:0x9fc4f0, floor:0xdce6f5, lane:0xbcd0ec, wall:0x6fa8e8, accent:0xffd23f},
  {id:'pengambilan', name:'Bilik Pengambilan',       bg:0xffd4b4, fog:0xffd9c2, floor:0xffe9cf, lane:0xffd0b0, wall:0xff9ec4, accent:0xff5c8a},
];
const ZONE_LEN=230, LANE=2.2, SPAWN_Z=-130;

let me=null;
let renderer, scene, camera, clock, THREEok=false;
let floorMesh, floorTex, walls=[], player3d, legL, legR;
let items=[];            // {mesh,kind,lane,z,done,item,spin}
let travel, speed, nextSpawn, coinLane, coinScore, zoneIdx, prevZone, running, raf;
let pLane, pLaneF, jumpY, jumpVy, animT, secretArmed, caughtSecret;
const keys={};

function zoneOf(d){ return Math.min(ZONES.length-1, Math.floor(d/ZONE_LEN)); }

function makeFloorTexture(Z){
  const c=document.createElement('canvas'); c.width=256; c.height=256; const x=c.getContext('2d');
  x.fillStyle=hexCss(Z.floor); x.fillRect(0,0,256,256);
  x.fillStyle=hexCss(Z.lane); x.globalAlpha=.6; x.fillRect(84,0,3,256); x.fillRect(169,0,3,256); x.globalAlpha=1;
  x.strokeStyle='rgba(255,255,255,.7)'; x.lineWidth=4; x.setLineDash([26,26]);
  x.beginPath(); x.moveTo(85.5,0); x.lineTo(85.5,256); x.moveTo(170.5,0); x.lineTo(170.5,256); x.stroke();
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1,40); return t;
}

function init3D(){
  renderer=new THREE.WebGLRenderer({canvas:$('#game'),antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(62,1,0.1,300);
  camera.position.set(0,4.6,7.6); camera.lookAt(0,1.1,-12);
  scene.add(new THREE.AmbientLight(0xffffff,0.9));
  const dir=new THREE.DirectionalLight(0xffffff,0.65); dir.position.set(5,12,6); scene.add(dir);
  clock=new THREE.Clock();

  // floor
  floorTex=makeFloorTexture(ZONES[0]);
  floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(9,300), new THREE.MeshBasicMaterial({map:floorTex}));
  floorMesh.rotation.x=-Math.PI/2; floorMesh.position.set(0,0,-130); scene.add(floorMesh);
  // side walls
  for(const sx of [-6.2,6.2]){ const m=new THREE.Mesh(new THREE.BoxGeometry(1,6,300), new THREE.MeshLambertMaterial({color:ZONES[0].wall}));
    m.position.set(sx,3,-130); scene.add(m); walls.push(m); }
  // ceiling light strip
  const ceil=new THREE.Mesh(new THREE.BoxGeometry(5,0.2,300), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5}));
  ceil.position.set(0,6,-130); scene.add(ceil);

  // player — cute chibi runner (rounded shapes)
  player3d=new THREE.Group();
  const col=me.color, skin=0xffdcb0;
  // body (rounded, shirt colour)
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.44,0.5,8,16), new THREE.MeshLambertMaterial({color:col})); body.position.y=1.15; player3d.add(body);
  // big round head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.52,24,24), new THREE.MeshLambertMaterial({color:skin})); head.position.y=2.0; player3d.add(head);
  // hair cap (top dome, a bit bigger than head)
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.55,24,24,0,Math.PI*2,0,Math.PI*0.6), new THREE.MeshLambertMaterial({color:0x3a2a22})); hair.position.y=2.03; player3d.add(hair);
  // little arms
  const armMat=new THREE.MeshLambertMaterial({color:col});
  const armL=new THREE.Mesh(new THREE.CapsuleGeometry(0.15,0.38,6,10), armMat); armL.position.set(-0.56,1.2,0); armL.rotation.z=0.35; player3d.add(armL);
  const armR=new THREE.Mesh(new THREE.CapsuleGeometry(0.15,0.38,6,10), armMat); armR.position.set(0.56,1.2,0); armR.rotation.z=-0.35; player3d.add(armR);
  // legs (groups so they swing from the hip, with shoes attached)
  const legMat=new THREE.MeshLambertMaterial({color:0x3c4663}), shoeMat=new THREE.MeshLambertMaterial({color:0xffffff});
  function makeLeg(x){ const grp=new THREE.Group(); grp.position.set(x,0.8,0);
    const calf=new THREE.Mesh(new THREE.CapsuleGeometry(0.17,0.44,6,10), legMat); calf.position.y=-0.3; grp.add(calf);
    const shoe=new THREE.Mesh(new THREE.SphereGeometry(0.2,12,12), shoeMat); shoe.scale.set(1,0.68,1.5); shoe.position.set(0,-0.6,0.14); grp.add(shoe);
    player3d.add(grp); return grp; }
  legL=makeLeg(-0.22); legR=makeLeg(0.22);
  scene.add(player3d);

  THREEok=true;
  window.addEventListener('resize',()=>{ if(!$('#screen-game').hidden) resize3D(); });
}
function resize3D(){ const r=$('#game').getBoundingClientRect(); renderer.setSize(r.width,r.height,false);
  camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); }

function applyZone(Z){ scene.background=new THREE.Color(Z.bg); scene.fog=new THREE.Fog(Z.fog,18,95);
  floorTex.dispose&&0; const nt=makeFloorTexture(Z); floorMesh.material.map=nt; floorMesh.material.needsUpdate=true; floorTex=nt;
  walls.forEach(w=>w.material.color.setHex(Z.wall)); }

function clearItems(){ for(const o of items) scene.remove(o.mesh); items=[]; }

function makeCoin(){ const g=new THREE.Group();
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.12,20), new THREE.MeshLambertMaterial({color:0xffd23f,emissive:0x7a5c00,emissiveIntensity:.3}));
  coin.rotation.x=Math.PI/2; g.add(coin); return g; }
function makeObstacle(typ,Z){ const g=new THREE.Group();
  if(typ===0){ // cute round office chair
    const seat=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.26,18),new THREE.MeshLambertMaterial({color:0x6678a8})); seat.position.y=0.95; g.add(seat);
    const back=new THREE.Mesh(new THREE.CapsuleGeometry(0.46,0.5,6,12),new THREE.MeshLambertMaterial({color:0x4a5a8c})); back.position.set(0,1.5,-0.42); back.scale.set(1,1,0.42); g.add(back);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.7,10),new THREE.MeshLambertMaterial({color:0xaab0bd})); pole.position.y=0.5; g.add(pole); }
  else if(typ===1){ // water cooler
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.58,0.52,1.25,20),new THREE.MeshLambertMaterial({color:0x56c7e8})); b.position.y=0.63; g.add(b);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16),new THREE.MeshLambertMaterial({color:0xcff3ff,transparent:true,opacity:.9})); cap.position.y=1.45; cap.scale.set(1,0.85,1); g.add(cap); }
  else { // round table
    const top=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,0.22,24),new THREE.MeshLambertMaterial({color:Z.accent})); top.position.y=1.05; g.add(top);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,1.0,12),new THREE.MeshLambertMaterial({color:0xa06a34})); leg.position.y=0.5; g.add(leg);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.12,16),new THREE.MeshLambertMaterial({color:0xa06a34})); base.position.y=0.06; g.add(base); }
  return g; }
function makeSecret(){ const g=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.0,1.1), new THREE.MeshLambertMaterial({color:0xff5c8a,emissive:0xff2e97,emissiveIntensity:.45})); box.position.y=1.05; g.add(box);
  const ribV=new THREE.Mesh(new THREE.BoxGeometry(0.24,1.02,1.12),new THREE.MeshLambertMaterial({color:0xffd23f})); ribV.position.y=1.05; g.add(ribV);
  const ribH=new THREE.Mesh(new THREE.BoxGeometry(1.12,1.02,0.24),new THREE.MeshLambertMaterial({color:0xffd23f})); ribH.position.y=1.05; g.add(ribH);
  const bowMat=new THREE.MeshLambertMaterial({color:0xffe066,emissive:0xffcf33,emissiveIntensity:.4});
  for(const bx of [-0.26,0.26]){ const b=new THREE.Mesh(new THREE.SphereGeometry(0.28,14,14),bowMat); b.position.set(bx,1.66,0); b.scale.set(1,0.72,0.72); g.add(b); }
  return g; }
function makeProp(side,Z){ const g=new THREE.Group(); const t=Math.floor(Math.random()*3);
  if(t===0){ const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.25,0.5,10),new THREE.MeshLambertMaterial({color:0xb5651d})); pot.position.y=0.25; g.add(pot);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,8),new THREE.MeshLambertMaterial({color:0x4caf50})); leaf.position.y=0.9; g.add(leaf); }
  else if(t===1){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.4,1.1),new THREE.MeshLambertMaterial({color:0x8d6e63})); b.position.y=1.4; g.add(b);
    const w=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.0,0.8),new THREE.MeshLambertMaterial({color:0xffffff})); w.position.set(side*0.05,1.4,0); g.add(w); }
  else { const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.0,8),new THREE.MeshLambertMaterial({color:0x9aa0ad})); pole.position.y=1.0; g.add(pole);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8),new THREE.MeshLambertMaterial({color:0xfff3b0,emissive:0xffe066,emissiveIntensity:.5})); lamp.position.y=2.0; g.add(lamp); }
  return g; }

function startGame(){
  showScreen('screen-game'); if(!THREEok) init3D(); resize3D();
  clearItems(); travel=0; speed=18; nextSpawn=14; coinLane=1; coinScore=0; secretArmed=true; caughtSecret=null;
  pLane=1; pLaneF=1; jumpY=0; jumpVy=0; animT=0; zoneIdx=0; prevZone=-1;
  applyZone(ZONES[0]); player3d.position.set(0,0,0);
  $('#hud-char').textContent=me.id; $('#hud-score').textContent=0; $('#hud-stage').textContent=ZONES[0].name;
  running=true; clock.start(); cancelAnimationFrame(raf); loop();
}

function spawnRow(){
  const z=zoneIdx; let obsLane=-1;
  if(Math.random()<0.45+z*0.12){ obsLane=(Math.random()*3)|0; const typ=(Math.random()*3)|0;
    const m=makeObstacle(typ,ZONES[z]); items.push({mesh:m,kind:'obs',lane:obsLane,z:SPAWN_Z,done:false}); scene.add(m); }
  if(Math.random()<0.85){ if(Math.random()<0.4||coinLane===obsLane){ const free=[0,1,2].filter(l=>l!==obsLane); coinLane=free[(Math.random()*free.length)|0]; }
    for(let k=0;k<3;k++){ const m=makeCoin(); items.push({mesh:m,kind:'coin',lane:coinLane,z:SPAWN_Z-k*4,done:false,spin:0}); scene.add(m); } }
  // side props (decor, non-colliding)
  for(const side of [-1,1]){ if(Math.random()<0.6){ const m=makeProp(side,ZONES[zoneIdx]); items.push({mesh:m,kind:'prop',lane:side,z:SPAWN_Z,done:true}); scene.add(m);
    m.position.set(side*5.0,0,SPAWN_Z); } }
}

function laneX(l){ return (l-1)*LANE; }
function update(dt){
  zoneIdx=zoneOf(travel);
  if(zoneIdx!==prevZone){ prevZone=zoneIdx; applyZone(ZONES[zoneIdx]); $('#hud-stage').textContent=ZONES[zoneIdx].name; sSwish(); }
  speed=18+zoneIdx*5+travel*0.02; if(speed>44)speed=44;
  travel+=speed*dt;

  // scroll floor
  floorTex.offset.y -= speed*dt*0.03;

  // player lane + jump + run anim
  pLaneF += (pLane-pLaneF)*Math.min(1,dt*12);
  player3d.position.x = laneX(pLaneF);
  if(jumpY>0||jumpVy!==0){ jumpVy-=28*dt; jumpY+=jumpVy*dt; if(jumpY<=0){jumpY=0;jumpVy=0;} }
  player3d.position.y=jumpY;
  animT+=speed*dt*0.25; const lg=Math.sin(animT)*0.5; legL.rotation.x=lg; legR.rotation.x=-lg;
  camera.position.x += (laneX(pLaneF)*0.35 - camera.position.x)*Math.min(1,dt*6);

  // spawns
  while(travel>nextSpawn){ spawnRow(); nextSpawn+=8; }
  if(secretArmed && travel>ZONE_LEN*1.5){ secretArmed=false; const coll=getColl(me.id); const nx=POOL.find(p=>!coll.has(p.id));
    if(nx){ const m=makeSecret(); items.push({mesh:m,kind:'secret',lane:(Math.random()*3)|0,z:SPAWN_Z,done:false,item:nx}); scene.add(m); } }

  // move items toward camera; resolve
  const pr=Math.round(pLaneF);
  for(const o of items){ o.z+=speed*dt; o.mesh.position.z=o.z;
    if(o.kind==='prop'){ o.mesh.position.x=o.lane*5.0; continue; }
    o.mesh.position.x=laneX(o.lane);
    if(o.kind==='coin'){ o.spin+=dt*6; o.mesh.rotation.z=o.spin; o.mesh.position.y=0.9; }
    else if(o.kind==='secret'){ o.mesh.rotation.y+=dt*2; o.mesh.position.y=1.1+Math.sin(travel*0.1)*0.2; }
    if(!o.done && o.z>-0.6){ o.done=true; const same=o.lane===pr;
      if(o.kind==='coin'){ if(same && jumpY<1.6){ coinScore++; sCoin(); $('#hud-score').textContent=coinScore; o.hide=true; } }
      else if(o.kind==='secret'){ if(same){ caughtSecret=o.item; return endRun('secret'); } }
      else { if(same && jumpY<1.2){ return endRun('over'); } }
    }
  }
  for(const o of items){ if(o.hide){ o.mesh.visible=false; } }
  items=items.filter(o=>{ if(o.z>12||o.hide){ scene.remove(o.mesh); return false; } return true; });

  if(travel>ZONES.length*ZONE_LEN && !items.some(o=>o.kind==='secret'&&!o.done)) endRun('win');
}

function loop(){ if(!running)return; let dt=clock.getDelta(); if(dt>0.05)dt=0.05; update(dt); if(running) renderer.render(scene,camera); raf=requestAnimationFrame(loop); }

/* ---- controls ---- */
function moveLane(d){ const n=Math.max(0,Math.min(2,pLane+d)); if(n!==pLane){ pLane=n; sSwish(); } }
function doJump(){ if(jumpY<=0){ jumpVy=12; jumpY=0.01; sJump(); } }
const gameScreen=$('#screen-game'); let sx=0,sy=0,sw=false;
gameScreen.addEventListener('pointerdown',e=>{ if(e.target.closest('.hud'))return; sx=e.clientX; sy=e.clientY; sw=true; });
gameScreen.addEventListener('pointerup',e=>{ if(!sw)return; sw=false; const dx=e.clientX-sx, dy=e.clientY-sy;
  if(Math.abs(dx)<24&&Math.abs(dy)<24){ doJump(); return; }
  if(Math.abs(dx)>Math.abs(dy)) moveLane(dx>0?1:-1); else if(dy<0) doJump(); });
document.addEventListener('keydown',e=>{ if(!running)return; if(e.key==='ArrowLeft')moveLane(-1); if(e.key==='ArrowRight')moveLane(1); if(e.key==='ArrowUp'||e.key===' '){doJump();e.preventDefault();} });

/* ---- end / result ---- */
function endRun(result){
  if(!running)return; running=false; cancelAnimationFrame(raf);
  saveBestCoins(me.id,Math.max(getBestCoins(me.id),coinScore));
  if(result==='secret'&&caughtSecret){ const coll=getColl(me.id); coll.add(caughtSecret.id); saveColl(me.id,coll); }
  pushScore(me.id); const total=getColl(me.id).size;
  if(result==='secret'){ sSecret(); confetti(true); $('#win-emoji').textContent='🎁'; $('#win-title').textContent='SECRET FOUND!';
    const cap=caughtSecret&&caughtSecret.caption?` — "${caughtSecret.caption}"`:''; $('#win-sub').textContent=`New photo for ${me.id}${cap} 🎉 · coins: ${coinScore} · photos: ${total}`;
    if(caughtSecret&&caughtSecret.img) showReveal(caughtSecret.img); }
  else if(result==='win'){ sSecret(); const left=POOL.some(p=>!getColl(me.id).has(p.id)); $('#win-emoji').textContent=left?'🏁':'🏆';
    $('#win-title').textContent=left?'Finished the office!':'All photos collected!'; $('#win-sub').textContent=`coins: ${coinScore} · ${me.id}'s photos: ${total}`; }
  else { sOver(); $('#win-emoji').textContent='💥'; $('#win-title').textContent='Crashed! Game over'; $('#win-sub').textContent=`coins: ${coinScore} · ${me.id}'s photos: ${total}`; }
  loadScores().then(()=>buildBoard('#win-board')); showScreen('screen-win');
}
function showReveal(src){ const m=$('#reveal-media'); if(!m)return; m.innerHTML=`<img src="${src}" alt="">`; }

/* ---- leaderboard / gallery / confetti / select / nav / boot ---- */
function buildBoard(sel){ const el=$(sel); el.innerHTML='';
  const max=Math.max(1,...CHARS.map(c=>scores[c.id]||0)), lead=Math.max(...CHARS.map(c=>scores[c.id]||0));
  CHARS.slice().sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).forEach(c=>{ const v=scores[c.id]||0, src=FACE_SRC[c.id];
    const row=document.createElement('div'); row.className='board-row'+(v===lead&&v>0?' lead':'');
    row.innerHTML=`<div class="board-ava" style="background:${hexCss(c.color)}">${src?`<img src="${src}" alt="">`:''}</div>
      <div class="board-name">${c.id}${v===lead&&v>0?'<span class="crown">👑</span>':''}</div>
      <div class="board-bar"><i style="width:${Math.round(v/max*100)}%"></i></div><div class="board-num">${v}</div>`; el.appendChild(row); });
}
function buildGallery(char){ $('#gal-char').textContent=char; const coll=getColl(char); const grid=$('#gal-grid'); grid.innerHTML='';
  POOL.forEach(p=>{ const c=document.createElement('div'); c.className='cell';
    if(coll.has(p.id)){ c.innerHTML=p.img?`<img src="${p.img}" alt="">`:`<div class="ph">📸</div>`; } else { c.classList.add('locked'); c.textContent='?'; } grid.appendChild(c); });
  loadScores().then(()=>buildBoard('#gal-board'));
}
const cv=$('#confetti'),cctx=cv.getContext('2d');
function confetti(strong){ cv.hidden=false; cv.width=innerWidth; cv.height=innerHeight; const cols=['#ff5c8a','#38bdf8','#a855f7','#ffd23f','#fff'],P=[];
  for(let i=0;i<(strong?150:70);i++)P.push({x:innerWidth/2,y:innerHeight*.3,vx:(Math.random()-.5)*15,vy:Math.random()*-14-3,g:.4,s:5+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function l(){cctx.clearRect(0,0,cv.width,cv.height);f++;for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;cctx.save();cctx.translate(p.x,p.y);cctx.rotate(p.r);cctx.fillStyle=p.c;cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cctx.restore();}if(f<90)requestAnimationFrame(l);else cv.hidden=true;})(); }
function buildCharSelect(){ const g=$('#char-grid'); g.innerHTML=''; const owner=getOwner();
  CHARS.forEach(c=>{ const v=getColl(c.id).size, locked=owner&&c.id!==owner, src=FACE_SRC[c.id];
    const card=document.createElement('button'); card.className='char-card'+(locked?' locked':'');
    card.innerHTML=`<div class="char-ava" style="background:${hexCss(c.color)};overflow:hidden">${locked?'🔒':(src?`<img src="${src}" style="width:100%;height:100%;object-fit:cover">`:'')}</div>
      <div class="char-name">${c.id}</div><div class="char-count">${locked?'Not you':('📸 '+v+' photos')}</div>`;
    if(locked) card.disabled=true; else card.addEventListener('click',()=>{ ac(); me=c; startGame(); }); g.appendChild(card); });
}
$('#hud-gallery').addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); buildGallery(me.id); showScreen('screen-gallery'); });
$('#win-again').addEventListener('click',()=>startGame());
$('#win-gallery').addEventListener('click',()=>{ buildGallery(me.id); showScreen('screen-gallery'); });
$('#gal-back').addEventListener('click',()=>{ if(me) startGame(); else { buildCharSelect(); showScreen('screen-select'); } });

loadScores();
(function boot(){ const owner=getOwner(); if(owner){ me=CHARS.find(c=>c.id===owner); startGame(); } else { buildCharSelect(); showScreen('screen-select'); } })();
