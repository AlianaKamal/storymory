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
  {id:'entrance',    name:'KOLEJ KOMUNITI TEMERLOH', bg:0x4fb8ef, fog:0x8fd3f5, floor:0xcdd8e8, lane:0xaebdd4, accent:0xffd23f,
    ground:0x7bc96a, blds:[0xff5c5c,0xffa23a,0x2ec4ff,0x4ec96a,0xffd23f,0xb57bff,0xff7ab8]},
  {id:'pengambilan', name:'Bilik Pengambilan',       bg:0xff9a6b, fog:0xffbd96, floor:0xffe0c4, lane:0xffc49a, accent:0xff2e97,
    ground:0xe88a4a, blds:[0xff2e6a,0xff7a1f,0xffc21f,0xff5c8a,0xc44bff,0x2ec4ff,0x3ad16a]},
];
const ZONE_LEN=230, LANE=2.2, SPAWN_Z=-96;

let me=null;
let renderer, scene, camera, clock, THREEok=false;
let floorMesh, floorTex, groundMesh, player3d, legL, legR, rideGroup, campusSign;
const rideWheels=[];
let items=[];            // {mesh,kind,lane,z,done,item,spin}
let scenery=[], nextScene;   // side buildings/trees
let travel, speed, nextSpawn, coinLane, coinScore, zoneIdx, prevZone, running, raf;
let pLane, pLaneF, jumpY, jumpVy, animT, secretArmed, caughtSecret;
let lives=3, hitCooldown=0;
function updateLivesHud(){const el=$('#hud-lives');if(el)el.textContent='💗'.repeat(Math.max(0,lives))+'♡'.repeat(Math.max(0,3-lives));}
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


/* ---- character rides: cute rabbit scooter, sport bike and mini Hilux ---- */
function makeWheel(radius, width, color=0x20233a){
  const g=new THREE.Group();
  const tire=new THREE.Mesh(new THREE.TorusGeometry(radius, width, 10, 18),new THREE.MeshLambertMaterial({color}));
  tire.rotation.y=Math.PI/2; g.add(tire);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(radius*.38,radius*.38,width*2.2,12),new THREE.MeshLambertMaterial({color:0xeaf7ff}));
  hub.rotation.z=Math.PI/2; g.add(hub);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(radius*.16,8,8),new THREE.MeshLambertMaterial({color:0xffd83d}));
  dot.position.x=width*1.2; g.add(dot);
  rideWheels.push(g);
  return g;
}
function makeRide(vehicle){
  const g=new THREE.Group();
  const mat=(color,extra={})=>new THREE.MeshLambertMaterial({color,...extra});
  if(vehicle==='rabbit'){
    // Nurin's rabbit scooter: rounded white body, candy-pink panels and a visible rear silhouette.
    const white=mat(0xfffbff), pink=mat(0xff4fa5), palePink=mat(0xffb7d8);
    const dark=mat(0x263052), chrome=mat(0xeaf7ff), gold=mat(0xffdf53);
    // Low step-through chassis and broad rounded fairings.
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.66,.17,1.05),pink);
    deck.position.set(0,.38,.05); g.add(deck);
    const lowerBody=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),white);
    lowerBody.position.set(0,.56,-.17); lowerBody.scale.set(.36,.31,.53); g.add(lowerBody);
    const frontCowl=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),white);
    frontCowl.position.set(0,.72,-.53); frontCowl.scale.set(.32,.31,.27); g.add(frontCowl);
    // Pink side cheeks and trim make the silhouette readable from the rear camera.
    for(const side of [-1,1]){
      const cheek=new THREE.Mesh(new THREE.SphereGeometry(1,14,12),pink);
      cheek.position.set(side*.285,.49,-.15); cheek.scale.set(.10,.18,.38); g.add(cheek);
      const trim=new THREE.Mesh(new THREE.BoxGeometry(.035,.12,.52),palePink);
      trim.position.set(side*.337,.42,.02); g.add(trim);
    }
    // Seat sits between the rider's legs.
    const seat=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),dark);
    seat.position.set(0,.72,.32); seat.scale.set(.245,.12,.36); g.add(seat);
    // Rear wheel, pink mudguard, white tail panel and a bright tail lamp are visible from behind.
    const rearWheel=makeWheel(.235,.095,0x20233a);
    rearWheel.position.set(0,.245,.53); g.add(rearWheel);
    const rearFender=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),pink);
    rearFender.position.set(0,.40,.51); rearFender.scale.set(.25,.13,.22); g.add(rearFender);
    const tailPanel=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),white);
    tailPanel.position.set(0,.53,.585); tailPanel.scale.set(.19,.13,.085); g.add(tailPanel);
    const tailLamp=new THREE.Mesh(new THREE.SphereGeometry(1,12,10),pink);
    tailLamp.position.set(0,.55,.66); tailLamp.scale.set(.105,.065,.035); g.add(tailLamp);
    // Front fork and handlebars.
    const fork=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,.53,12),chrome);
    fork.position.set(0,.72,-.49); fork.rotation.x=-.12; g.add(fork);
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.58,10),dark);
    handle.position.set(0,1.00,-.48); handle.rotation.z=Math.PI/2; g.add(handle);
    for(const side of [-1,1]){
      const grip=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.14,10),pink);
      grip.position.set(side*.31,1.00,-.48); grip.rotation.z=Math.PI/2; g.add(grip);
    }
    // Bunny ears are positioned on the side silhouette, visible from behind the rider.
    for(const side of [-1,1]){
      const ear=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.34,5,12),white);
      ear.position.set(side*.37,1.02,.31); ear.rotation.z=side*.10; g.add(ear);
      const inner=new THREE.Mesh(new THREE.CapsuleGeometry(.043,.255,4,10),palePink);
      inner.position.set(side*.37,1.03,.405); inner.rotation.z=side*.10; g.add(inner);
      const earBase=new THREE.Mesh(new THREE.SphereGeometry(.105,12,10),white);
      earBase.position.set(side*.34,.80,.30); g.add(earBase);
    }
    // Small bunny face badge on the front of the scooter (toward -Z).
    const facePlate=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),white);
    facePlate.position.set(0,.69,-.785); facePlate.scale.set(.19,.16,.045); g.add(facePlate);
    for(const side of [-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),dark);
      eye.position.set(side*.065,.71,-.831); g.add(eye);
      const blush=new THREE.Mesh(new THREE.SphereGeometry(.032,8,6),palePink);
      blush.position.set(side*.11,.66,-.831); g.add(blush);
    }
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.026,8,6),pink);
    nose.position.set(0,.675,-.836); g.add(nose);
    // Front wheel and small yellow reflectors.
    const frontWheel=makeWheel(.235,.095,0x20233a);
    frontWheel.position.set(0,.245,-.59); g.add(frontWheel);
    for(const side of [-1,1]){
      const reflector=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),gold);
      reflector.position.set(side*.29,.52,.17); g.add(reflector);
    }
  } else if(vehicle==='motorsport'){
    // Blue sport motorcycle
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.23,.66,5,10),mat(0x078eff)); body.rotation.x=Math.PI/2; body.position.set(0,.58,0); body.scale.set(1,.75,1);g.add(body);
    const tank=new THREE.Mesh(new THREE.SphereGeometry(.3,14,12),mat(0x00d9ff));tank.scale.set(.85,.7,1.2);tank.position.set(0,.78,-.08);g.add(tank);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.38,.13,.52),mat(0x253050));seat.position.set(0,.83,.34);g.add(seat);
    const fork=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.72,10),mat(0xd7edff));fork.position.set(0,.55,-.62);fork.rotation.x=-.18;g.add(fork);
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.65,10),mat(0x273451));bar.position.set(0,1.02,-.57);bar.rotation.z=Math.PI/2;g.add(bar);
    const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.56,10),mat(0x9caac2));exhaust.rotation.x=Math.PI/2;exhaust.position.set(.22,.38,.35);g.add(exhaust);
    g.add(makeWheel(.29,.10));g.children[g.children.length-1].position.set(0,.3,-.68);
    g.add(makeWheel(.29,.10));g.children[g.children.length-1].position.set(0,.3,.62);
  } else {
    // Purple mini Hilux with cabin, windscreen, bumper and chunky wheels
    const chassis=new THREE.Mesh(new THREE.BoxGeometry(1.12,.3,1.55),mat(0x7d42ed));chassis.position.set(0,.48,.05);g.add(chassis);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(.92,.58,.76),mat(0x9e78ff));cabin.position.set(0,.88,-.22);g.add(cabin);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.76,.34,.045),mat(0x9beaff,{transparent:true,opacity:.9}));glass.position.set(0,.94,-.615);g.add(glass);
    const bed=new THREE.Mesh(new THREE.BoxGeometry(.86,.16,.5),mat(0x5a2cb9));bed.position.set(0,.68,.55);g.add(bed);
    const bumper=new THREE.Mesh(new THREE.BoxGeometry(1.16,.13,.12),mat(0xeaf7ff));bumper.position.set(0,.37,-.78);g.add(bumper);
    for(const x of [-.35,.35]){const light=new THREE.Mesh(new THREE.BoxGeometry(.18,.13,.06),mat(0xfff17a,{emissive:0xffb800,emissiveIntensity:.4}));light.position.set(x,.55,-.78);g.add(light);}
    for(const x of [-.57,.57])for(const z of [-.48,.55]){const wheel=makeWheel(.23,.10,0x20233a);wheel.position.set(x,.28,z);g.add(wheel);}
  }
  g.position.y=-.03;
  return g;
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

  // wide ground under everything (open-sky street look)
  groundMesh=new THREE.Mesh(new THREE.PlaneGeometry(90,300), new THREE.MeshLambertMaterial({color:ZONES[0].ground}));
  groundMesh.rotation.x=-Math.PI/2; groundMesh.position.set(0,-0.03,-130); scene.add(groundMesh);
  // running floor (lanes) on top
  floorTex=makeFloorTexture(ZONES[0]);
  floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(9,300), new THREE.MeshBasicMaterial({map:floorTex}));
  floorMesh.rotation.x=-Math.PI/2; floorMesh.position.set(0,0,-130); scene.add(floorMesh);

  // player — chibi rider, seated on the selected vehicle
  player3d=new THREE.Group();
  const col=me.color, skin=0xffdcb0;
  const shirtMat=new THREE.MeshLambertMaterial({color:col});
  const skinMat=new THREE.MeshLambertMaterial({color:skin});
  const hairColor=me.id==='Haziq'?0x34221c:(me.id==='Yana'?0x4b2925:0x4a2a22);
  // Torso lowered to make the character look seated rather than running upright.
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.37,0.38,8,16),shirtMat);
  body.position.set(0,0.98,0.06); body.rotation.x=-0.12; player3d.add(body);
  // Big chibi head with a friendly face, facing the camera (+Z).
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.47,24,20),skinMat);
  head.position.set(0,1.62,0.12); player3d.add(head);
  const hairMat=new THREE.MeshLambertMaterial({color:hairColor});
  if(me.id==='Haziq'){
    // Haziq keeps the tousled, spiky dark-brown hairstyle from the character card.
    const hair=new THREE.Mesh(new THREE.SphereGeometry(0.50,24,20,0,Math.PI*2,0,Math.PI*0.64),hairMat);
    hair.position.set(0,1.68,0.08); player3d.add(hair);
    const fringe=new THREE.Mesh(new THREE.SphereGeometry(0.22,14,12),hairMat);
    fringe.scale.set(1.25,.58,.6); fringe.position.set(0,1.94,-.43); player3d.add(fringe);
    for(let i=0;i<4;i++){
      const spike=new THREE.Mesh(new THREE.ConeGeometry(.12,.25,8),hairMat);
      spike.position.set((i-1.5)*.18,2.00,.02); spike.rotation.z=(i-1.5)*-.19; player3d.add(spike);
    }
    for(const side of [-1,1]){
      const lock=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),hairMat);
      lock.position.set(side*.37,1.58,-.25); lock.scale.set(.8,1.2,.7); player3d.add(lock);
    }
  } else {
    // Nurin and Yana wear a dark-brown hijab. The hood covers the back and sides
    // of the head, while leaving the face opening on the forward (-Z) side clear.
    const hijabMat=new THREE.MeshLambertMaterial({color:0x4a2b26});
    // Smooth full hood silhouette: from the trailing camera it reads as a hijab,
    // not exposed hair. The face details are on the forward side of the head.
    const hoodBack=new THREE.Mesh(new THREE.SphereGeometry(.505,28,24),hijabMat);
    hoodBack.position.set(0,1.67,.115);
    hoodBack.scale.set(1.00,1.04,.86);
    player3d.add(hoodBack);
    // Side panels frame the cheeks and continue down over the shoulders.
    for(const side of [-1,1]){
      const fold=new THREE.Mesh(new THREE.SphereGeometry(1,18,14),hijabMat);
      fold.position.set(side*.335,1.45,.15);
      fold.scale.set(.205,.43,.31);
      player3d.add(fold);
    }
    // Broad rounded triangular drape: this gives the rear silhouette a scarf/khimar shape.
    const drape=new THREE.Mesh(new THREE.ConeGeometry(.49,.72,24,1,false),hijabMat);
    drape.position.set(0,1.17,.20);
    drape.scale.set(1.12,1.0,.72);
    drape.rotation.x=Math.PI;
    player3d.add(drape);
    const shoulderDrape=new THREE.Mesh(new THREE.SphereGeometry(1,22,16),hijabMat);
    shoulderDrape.position.set(0,1.18,.19);
    shoulderDrape.scale.set(.48,.25,.31);
    player3d.add(shoulderDrape);
    // Subtle curved seam around the lower back edge of the scarf.
    const seam=new THREE.Mesh(new THREE.TorusGeometry(.29,.009,6,32,Math.PI),new THREE.MeshLambertMaterial({color:0x70423a}));
    seam.position.set(0,1.31,.445); seam.rotation.x=Math.PI/2; player3d.add(seam);
  }
  // Eyes, blush and smile are simple geometry so no external art files are needed.
  const eyeMat=new THREE.MeshBasicMaterial({color:0x30233a});
  const shineMat=new THREE.MeshBasicMaterial({color:0xffffff});
  const blushMat=new THREE.MeshBasicMaterial({color:0xff9eb5,transparent:true,opacity:.82});
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),eyeMat);
    eye.position.set(side*.16,1.62,-.555); player3d.add(eye);
    const shine=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),shineMat);
    shine.position.set(side*.14,1.645,-.601); player3d.add(shine);
    const cheek=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),blushMat);
    cheek.scale.set(1,.58,.25); cheek.position.set(side*.27,1.51,-.52); player3d.add(cheek);
  }
  const mouth=new THREE.Mesh(new THREE.TorusGeometry(.055,.012,6,12,Math.PI),new THREE.MeshBasicMaterial({color:0x8b3d53}));
  mouth.position.set(0,1.49,-.575); mouth.rotation.z=Math.PI; player3d.add(mouth);
  // Optional cute hair accessories distinguish the characters.
  if(me.id==='Haziq'){
    const spikeMat=new THREE.MeshLambertMaterial({color:0x34221c});
    for(let i=0;i<3;i++){
      const spike=new THREE.Mesh(new THREE.ConeGeometry(.12,.27,8),spikeMat);
      spike.position.set((i-1)*.17,2.02,-.12); spike.rotation.z=(i-1)*-.25; player3d.add(spike);
    }
  } else {
    // Tiny pink / gold stitch charm on the hijab edge; no exposed hair clips.
    const charmColor=me.id==='Nurin'?0xff70ad:0xffd83d;
    const charm=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),new THREE.MeshLambertMaterial({color:charmColor}));
    charm.position.set(me.id==='Nurin'?.30:-.30,1.48,-.25); player3d.add(charm);
  }
  // Arms angle forward to the handlebars.
  const armMat=new THREE.MeshLambertMaterial({color:col});
  const armL=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.34,6,10),armMat);
  armL.position.set(-.36,1.12,-.31); armL.rotation.x=-(Math.PI/2-.25); armL.rotation.z=.13; player3d.add(armL);
  const armR=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.34,6,10),armMat);
  armR.position.set(.36,1.12,-.31); armR.rotation.x=-(Math.PI/2-.25); armR.rotation.z=-.13; player3d.add(armR);
  // Bent legs sit to either side of the ride; no running swing while riding.
  const legMat=new THREE.MeshLambertMaterial({color:0x303c62});
  const shoeMat=new THREE.MeshLambertMaterial({color:0xffffff});
  function makeLeg(x){
    const grp=new THREE.Group(); grp.position.set(x,.57,.06);
    const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.28,6,10),legMat);
    thigh.rotation.x=1.05; thigh.position.set(0,-.03,-.10); grp.add(thigh);
    const shoe=new THREE.Mesh(new THREE.SphereGeometry(.15,12,10),shoeMat);
    shoe.scale.set(1,.65,1.35); shoe.position.set(0,-.08,-.32); grp.add(shoe);
    player3d.add(grp); return grp;
  }
  legL=makeLeg(-.26); legR=makeLeg(.26);
  // Keep the vehicle aligned with the rider's forward travel direction (-Z).
  rideWheels.length=0;
  rideGroup=makeRide(me.vehicle);
  // Vehicle front already points toward -Z; do not rotate it toward the camera.
  player3d.add(rideGroup);
  scene.add(player3d);

  campusSign=makeCampusSign();
  THREEok=true;
  window.addEventListener('resize',()=>{ if(!$('#screen-game').hidden) resize3D(); });
}
function resize3D(){ const r=$('#game').getBoundingClientRect(); renderer.setSize(r.width,r.height,false);
  camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); }

function applyZone(Z){ scene.background=new THREE.Color(Z.bg); scene.fog=new THREE.Fog(Z.fog,22,120);
  const nt=makeFloorTexture(Z); floorMesh.material.map=nt; floorMesh.material.needsUpdate=true; floorTex=nt;
  groundMesh.material.color.setHex(Z.ground); }

function clearItems(){ for(const o of items) scene.remove(o.mesh); items=[]; }

function makeCoin(){ const g=new THREE.Group();
  const gold=new THREE.MeshLambertMaterial({color:0xffc928,emissive:0x8b5700,emissiveIntensity:.32});
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.43,.075,8,24),new THREE.MeshLambertMaterial({color:0xfff1a1}));
  rim.position.z=.02;g.add(rim);
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.14,24),gold);
  coin.rotation.x=Math.PI/2;g.add(coin);
  const starShape=new THREE.Shape();starShape.moveTo(0,.23);
  for(let i=1;i<10;i++){const a=Math.PI/2+i*Math.PI/5;const r=i%2?.10:.23;starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  starShape.closePath();
  const star=new THREE.Mesh(new THREE.ShapeGeometry(starShape),new THREE.MeshBasicMaterial({color:0xfff18a,side:THREE.DoubleSide}));
  star.position.z=.09;g.add(star); return g; }
function makeObstacle(typ,Z){
  const g=new THREE.Group();
  const mat=(color,extra={})=>new THREE.MeshLambertMaterial({color,...extra});
  if(typ===0){
    // Rolling office chair — one of the key props in the reference.
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.92,.18,.82),mat(0x303747)); seat.position.set(0,.92,.02); g.add(seat);
    const back=new THREE.Mesh(new THREE.BoxGeometry(.84,.88,.18),mat(0x252d3b)); back.position.set(0,1.42,-.34); g.add(back);
    const cushion=new THREE.Mesh(new THREE.BoxGeometry(.7,.09,.64),mat(0x475165)); cushion.position.set(0,1.04,.02); g.add(cushion);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.56,10),mat(0xa8b4c8)); stem.position.y=.58; g.add(stem);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.08,12),mat(0x252d3b)); base.position.y=.27; g.add(base);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const arm=new THREE.Mesh(new THREE.BoxGeometry(.38,.06,.07),mat(0x252d3b));arm.position.set(Math.cos(a)*.3,.27,Math.sin(a)*.3);arm.rotation.y=-a;g.add(arm);}
  } else if(typ===1){
    // Stacked cardboard delivery boxes.
    const boxColors=[0xc88a4b,0xd9a064,0xb8793f];
    const sizes=[[.92,.78,.8],[.58,.55,.58],[.36,.34,.4]];
    sizes.slice(0,Math.random()<.5?2:3).forEach((s,i)=>{
      const b=new THREE.Mesh(new THREE.BoxGeometry(...s),mat(boxColors[i]));
      b.position.set((i%2?-.14:.12),s[1]/2+(i===0?0:.72),i===0?.02:-.04);g.add(b);
      const tape=new THREE.Mesh(new THREE.BoxGeometry(.09,s[1]+.01,s[2]+.02),mat(0xf6d79a));
      tape.position.set(b.position.x,b.position.y,b.position.z);g.add(tape);
    });
  } else if(typ===2){
    // Bright orange-and-white traffic cone.
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.43,.48,.12,16),mat(0xff6b22));base.position.y=.06;g.add(base);
    const cone=new THREE.Mesh(new THREE.CylinderGeometry(.06,.34,.88,16),mat(0xff6b22));cone.position.y=.54;g.add(cone);
    const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.19,.25,.16,16),mat(0xffffff));stripe.position.y=.53;g.add(stripe);
    const top=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),mat(0xffffff));top.position.y=1.0;g.add(top);
  } else {
    // A neat stack of paper / files from the office.
    for(let i=0;i<5;i++){
      const sheet=new THREE.Mesh(new THREE.BoxGeometry(.86,.09,.66),mat(i%2?0xf7f3e8:0xffffff));
      sheet.position.set((i%2)*.035,.13+i*.105,(i%2)*-.025);g.add(sheet);
    }
    const file=new THREE.Mesh(new THREE.BoxGeometry(.7,.22,.54),mat(0x36a9ed));file.position.set(.02,.78,.01);g.add(file);
    const label=new THREE.Mesh(new THREE.BoxGeometry(.34,.1,.02),mat(0xffe45c));label.position.set(.02,.8,-.265);g.add(label);
  }
  return g;
}
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

/* ---- side scenery: cute buildings + trees ---- */
function makeBuilding(side,Z){ const g=new THREE.Group();
  const w=2.6+Math.random()*2.2, h=6+Math.random()*8, d=3.0+Math.random()*2.5;   // tall city blocks
  const col=Z.blds[(Math.random()*Z.blds.length)|0];
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color:col})); body.position.y=h/2; g.add(body);
  // flat-roof trim band + rooftop block (urban look)
  const trim=new THREE.Mesh(new THREE.BoxGeometry(w+0.12,0.5,d+0.12), new THREE.MeshLambertMaterial({color:0xffffff})); trim.position.y=h-0.25; g.add(trim);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(w*0.5,0.6,d*0.5), new THREE.MeshLambertMaterial({color:0x3a4356})); cap.position.y=h+0.3; g.add(cap);
  // bright lit windows on the face toward the lane
  const faceX=-side*(w/2+0.03); const rows=Math.max(2,Math.floor(h/1.5)), cols=Math.max(1,Math.floor(w/1.0));
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){ const lit=Math.random()<0.75;
    const winMat=new THREE.MeshLambertMaterial({color:lit?0xfff3b0:0x5a6b86, emissive:lit?0xffdf4d:0x000000, emissiveIntensity:lit?.7:0});
    const win=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.6,0.5), winMat);
    win.position.set(faceX, 1.2+r*1.5, (c-(cols-1)/2)*1.05); g.add(win); }
  return g; }
function makeTree(){ const g=new THREE.Group();
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,1.2,10), new THREE.MeshLambertMaterial({color:0x9c6b3f})); tr.position.y=0.6; g.add(tr);
  const gr=[0x6fcf6f,0x57c96a,0x8bdc7a]; const top=gr[(Math.random()*gr.length)|0];
  for(const o of [[0,1.9,0,1.0],[-0.5,1.6,0.2,0.7],[0.5,1.65,-0.2,0.72]]){ const f=new THREE.Mesh(new THREE.SphereGeometry(o[3],12,12), new THREE.MeshLambertMaterial({color:top})); f.position.set(o[0],o[1],o[2]); g.add(f); }
  return g; }
function placeScene(side,z,Z){ const isTree=Math.random()<0.12; const m=isTree?makeTree():makeBuilding(side,Z);
  const x=side*(4.9+Math.random()*1.3); m.position.set(x,0,z);     // rapat ke tepi lorong
  scene.add(m); scenery.push({mesh:m,x,z}); }
function clearScenery(){ for(const s of scenery) scene.remove(s.mesh); scenery=[]; }
function spawnSceneRow(){ const Z=ZONES[zoneOf(travel)]; for(const side of [-1,1]) placeScene(side,SPAWN_Z,Z); }

function makeCampusSign(){
  const g=new THREE.Group();
  const blue=new THREE.MeshLambertMaterial({color:0x087bf4});
  const white=new THREE.MeshLambertMaterial({color:0xffffff});
  const gold=new THREE.MeshLambertMaterial({color:0xffdf42});
  const postGeo=new THREE.BoxGeometry(.22,4.1,.22);
  for(const x of [-5.2,5.2]){const p=new THREE.Mesh(postGeo,white);p.position.set(x,2.05,-88);g.add(p);}
  const board=new THREE.Mesh(new THREE.BoxGeometry(10.8,1.05,.34),blue);board.position.set(0,4.0,-88);g.add(board);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(10.95,.13,.39),gold);trim.position.set(0,4.55,-88);g.add(trim);
  // Tiny decorative blocks stand in for lettering while remaining crisp at distance.
  for(let i=0;i<18;i++){const w=new THREE.Mesh(new THREE.BoxGeometry(.22,.08,.025),white);w.position.set(-3.55+i*.42,4.08,-87.81);g.add(w);}
  scene.add(g);return g;
}

let paused=false;
function togglePause(){
  if(!running && !paused) return;
  if(paused){ paused=false; running=true; clock.start(); loop(); const b=$('#hud-pause'); if(b)b.textContent='Ⅱ'; }
  else { paused=true; running=false; cancelAnimationFrame(raf); const b=$('#hud-pause'); if(b)b.textContent='▶'; }
}
function startGame(){
  showScreen('screen-game'); if(!THREEok) init3D(); resize3D();
  paused=false; lives=3; hitCooldown=0; updateLivesHud(); const pauseBtn=$('#hud-pause'); if(pauseBtn)pauseBtn.textContent='Ⅱ'; clearItems(); clearScenery(); travel=0; speed=18; nextSpawn=0; nextScene=6; coinLane=1; coinScore=0; secretArmed=true; caughtSecret=null;
  for(let z=-5; z>SPAWN_Z; z-=6){ for(const side of [-1,1]) placeScene(side,z,ZONES[0]); }  // prefill both sides, dense
  pLane=1; pLaneF=1; jumpY=0; jumpVy=0; animT=0; zoneIdx=0; prevZone=-1;
  applyZone(ZONES[0]); player3d.position.set(0,0,0);
  $('#hud-char').textContent=me.id; $('#hud-score').textContent=0; $('#hud-stage').textContent='STAGE 1';
  const face=$('#hud-avatar'); if(face){const src=FACE_SRC[me.id]; face.innerHTML=src?`<img src="${src}" alt="">`:(me.id==='Nurin'?'🐰':me.id==='Haziq'?'🏍️':'🛻');}
  const photoCount=$('#hud-photos'); if(photoCount)photoCount.textContent=`${getColl(me.id).size}/${POOL.length}`;
  running=true; clock.start(); cancelAnimationFrame(raf); loop();
}

function spawnRow(){
  const z=zoneIdx; let obsLane=-1;
  if(Math.random()<0.68+z*0.08){ obsLane=(Math.random()*3)|0; const typ=(Math.random()*4)|0;
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
  if(zoneIdx!==prevZone){ prevZone=zoneIdx; applyZone(ZONES[zoneIdx]); $('#hud-stage').textContent='STAGE '+(zoneIdx+1); sSwish(); }
  speed=18+zoneIdx*5+travel*0.02; if(speed>44)speed=44;
  travel+=speed*dt;

  // scroll floor
  floorTex.offset.y -= speed*dt*0.03;

  // player lane + jump + run anim
  pLaneF += (pLane-pLaneF)*Math.min(1,dt*12);
  player3d.position.x = laneX(pLaneF);
  if(jumpY>0||jumpVy!==0){ jumpVy-=28*dt; jumpY+=jumpVy*dt; if(jumpY<=0){jumpY=0;jumpVy=0;} }
  player3d.position.y=jumpY;
  animT+=speed*dt*0.25;
  if(player3d) player3d.rotation.z=Math.sin(animT*1.4)*0.025;
  if(rideGroup) rideGroup.position.y=-0.03+Math.sin(animT*2)*0.025;
  rideWheels.forEach(w=>{w.rotation.x+=speed*dt*0.22;});
  camera.position.x += (laneX(pLaneF)*0.35 - camera.position.x)*Math.min(1,dt*6);

  // side scenery scroll + spawn + recycle
  while(travel>nextScene){ spawnSceneRow(); nextScene+=6; }
  for(const s of scenery){ s.z+=speed*dt; s.mesh.position.z=s.z; }
  scenery=scenery.filter(s=>{ if(s.z>16){ scene.remove(s.mesh); return false; } return true; });

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
      else { if(same && jumpY<1.2 && hitCooldown<=0){
        lives--; updateLivesHud(); hitCooldown=1.15; o.hide=true;
        if(player3d)player3d.scale.set(.92,.92,.92);
        beep(220,130,'sawtooth',.16,.15);
        if(lives<=0)return endRun('over');
      } }
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
  if(result==='secret'&&caughtSecret){ const coll=getColl(me.id); coll.add(caughtSecret.id); saveColl(me.id,coll); const photoCount=$('#hud-photos');if(photoCount)photoCount.textContent=`${coll.size}/${POOL.length}`; }
  pushScore(me.id); const total=getColl(me.id).size;
  const banner=$('.win-confetti-label'), sticker=$('.win-sticker');
  const winScreen=$('#screen-win'); if(winScreen) winScreen.dataset.result=result;
  if(result==='secret'){
    sSecret(); confetti(true); $('#win-emoji').textContent='🎁'; $('#win-title').textContent='MEMORY UNLOCKED!';
    if(banner)banner.textContent='✦ NEW MEMORY! ✦'; if(sticker)sticker.hidden=false;
    const cap=caughtSecret&&caughtSecret.caption?`“${caughtSecret.caption}”`: 'A little internship memory';
    $('#win-sub').textContent=`${cap} · coins: ${coinScore} · photos: ${total}`;
    showRevealMemory(caughtSecret);
  }
  else if(result==='win'){
    sSecret(); confetti(true); const left=POOL.some(p=>!getColl(me.id).has(p.id)); $('#win-emoji').textContent=left?'🏁':'🏆';
    $('#win-title').textContent=left?'Round complete!':'All memories collected!';
    if(banner)banner.textContent='✦ ROUND COMPLETE! ✦'; if(sticker)sticker.hidden=true;
    $('#win-sub').textContent=`coins: ${coinScore} · ${me.id}'s photos: ${total}`;
  }
  else {
    sOver(); $('#win-emoji').textContent='💥'; $('#win-title').textContent='Oops! Game over';
    if(banner)banner.textContent='✦ TRY AGAIN! ✦'; if(sticker)sticker.hidden=true;
    $('#win-sub').textContent=`coins: ${coinScore} · ${me.id}'s photos: ${total}`;
    $('#reveal-media').innerHTML='';
  }
  loadScores().then(()=>buildBoard('#win-board')); showScreen('screen-win');
}
function showReveal(src){ const m=$('#reveal-media'); if(!m)return; m.innerHTML=`<img src="${src}" alt="Internship memory">`; }
function showRevealMemory(item){
  const m=$('#reveal-media'); if(!m)return;
  if(item && item.img){ showReveal(item.img); return; }
  const caption=item&&item.caption?item.caption:'A little internship memory';
  const date=item&&item.date?new Date(item.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Internship memories';
  m.innerHTML=`<div class="memory-reveal-card"><div class="memory-reveal-photo"><span>📸</span><b>MEMORY UNLOCKED</b></div><strong>${caption}</strong><small>${date}</small></div>`;
}

/* ---- leaderboard / gallery / confetti / select / nav / boot ---- */
function buildBoard(sel){ const el=$(sel); el.innerHTML='';
  const max=Math.max(1,...CHARS.map(c=>scores[c.id]||0)), lead=Math.max(...CHARS.map(c=>scores[c.id]||0));
  CHARS.slice().sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).forEach(c=>{ const v=scores[c.id]||0, src=FACE_SRC[c.id];
    const row=document.createElement('div'); row.className='board-row'+(v===lead&&v>0?' lead':'');
    row.innerHTML=`<div class="board-ava" style="background:${hexCss(c.color)}">${src?`<img src="${src}" alt="" onerror="this.remove();this.parentElement.textContent='${c.id==='Nurin'?'🐰':c.id==='Haziq'?'🏍️':'🛻'}'">`:(c.id==='Nurin'?'🐰':c.id==='Haziq'?'🏍️':'🛻')}</div>
      <div class="board-name">${c.id}${v===lead&&v>0?'<span class="crown">👑</span>':''}</div>
      <div class="board-bar"><i style="width:${Math.round(v/max*100)}%"></i></div><div class="board-num">${v}</div>`; el.appendChild(row); });
}
function buildGallery(char){ $('#gal-char').textContent=char; const coll=getColl(char); const grid=$('#gal-grid'); grid.innerHTML='';
  POOL.forEach(p=>{ const c=document.createElement('div'); c.className='cell';
    if(coll.has(p.id)){
      c.innerHTML=p.img?`<img src="${p.img}" alt="${p.caption||'Internship memory'}">`:`<div class="ph memory-placeholder"><span>📸</span><small>Photo not added yet</small></div>`;
      const meta=CONTENT.find(it=>it.id===p.id);
      if(meta && (meta.caption||meta.date)){
        const cap=document.createElement('span');cap.className='memory-caption';
        const d=meta.date?new Date(meta.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
        cap.textContent=[meta.caption,d].filter(Boolean).join(' · ');c.appendChild(cap);
      }
    } else { c.classList.add('locked'); c.innerHTML='<span class="lock-mark">🔒</span><small>???</small>'; }
    grid.appendChild(c);
  });
  loadScores().then(()=>buildBoard('#gal-board'));
}
const cv=$('#confetti'),cctx=cv.getContext('2d');
function confetti(strong){ cv.hidden=false; cv.width=innerWidth; cv.height=innerHeight; const cols=['#ff5c8a','#38bdf8','#a855f7','#ffd23f','#fff'],P=[];
  for(let i=0;i<(strong?150:70);i++)P.push({x:innerWidth/2,y:innerHeight*.3,vx:(Math.random()-.5)*15,vy:Math.random()*-14-3,g:.4,s:5+Math.random()*7,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4});
  let f=0;(function l(){cctx.clearRect(0,0,cv.width,cv.height);f++;for(const p of P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;cctx.save();cctx.translate(p.x,p.y);cctx.rotate(p.r);cctx.fillStyle=p.c;cctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);cctx.restore();}if(f<90)requestAnimationFrame(l);else cv.hidden=true;})(); }
function buildCharSelect(){ const g=$('#char-grid'); g.innerHTML=''; const owner=getOwner();
  CHARS.forEach(c=>{ const v=getColl(c.id).size, locked=owner&&c.id!==owner, src=FACE_SRC[c.id];
    const card=document.createElement('button'); card.className='char-card'+(locked?' locked':'');
    card.innerHTML=`<div class="char-ava" style="background:${hexCss(c.color)};overflow:hidden">${locked?'🔒':(src?`<img src="${src}" style="width:100%;height:100%;object-fit:cover" onerror="this.remove();this.parentElement.textContent='${c.id==='Nurin'?'🐰':c.id==='Haziq'?'🏍️':'🛻'}'">`:(c.id==='Nurin'?'🐰':c.id==='Haziq'?'🏍️':'🛻'))}</div>
      <div class="char-name">${c.id}</div><div class="char-count">${locked?'Not you':('📸 '+v+' photos')}</div>`;
    if(locked) card.disabled=true; else card.addEventListener('click',()=>{ ac(); me=c; startGame(); }); g.appendChild(card); });
}
const pauseBtn=$('#hud-pause'); if(pauseBtn)pauseBtn.addEventListener('click',togglePause);
$('#hud-gallery').addEventListener('click',()=>{ running=false; cancelAnimationFrame(raf); buildGallery(me.id); showScreen('screen-gallery'); });
$('#win-again').addEventListener('click',()=>startGame());
$('#win-gallery').addEventListener('click',()=>{ buildGallery(me.id); showScreen('screen-gallery'); });
$('#gal-back').addEventListener('click',()=>{ if(me) startGame(); else { buildCharSelect(); showScreen('screen-select'); } });

loadScores();
(function boot(){ const owner=getOwner(); if(owner){ me=CHARS.find(c=>c.id===owner); startGame(); } else { buildCharSelect(); showScreen('screen-select'); } })();
