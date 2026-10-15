/* ===========================================================================
   app.js  —  CINEMATIC MEMORY REEL 🎞️
   Scan NFC → page loads → plays a fast memory montage from your photos,
   reshuffled every scan, looping forever.
   You normally don't touch this — edit your photos/captions in data.js.
   (data.js must load BEFORE app.js — see index.html)
   =========================================================================== */

const $=s=>document.querySelector(s);
const MONTH_NAME={7:'Julai',8:'Ogos',9:'September',10:'Oktober',11:'November',12:'Disember',1:'Januari'};
const TYPE_EMOJI={photo:'📸',meme:'😂',chaos:'🎲',sound:'🎵'};
const GRADS=['linear-gradient(145deg,#4b4b4b,#1a1a1a)','linear-gradient(145deg,#3a2b45,#15101c)',
  'linear-gradient(145deg,#2b3a45,#101820)','linear-gradient(145deg,#45392b,#1c1710)',
  'linear-gradient(145deg,#402b38,#180f14)','linear-gradient(145deg,#2b4540,#101c18)'];
function gradFor(id){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return GRADS[h%GRADS.length];}
function dayOf(it){return +it.date.split('-')[2];}
function monthOf(it){return +it.date.split('-')[1];}
function isOnThisDay(it){return dayOf(it)===new Date().getDate();}
function capOf(it){return it.caption||it.challenge||it.song||'';}
function stampOf(it){const[y,m,d]=it.date.split('-');return `${d} · ${m} · ${y}`;}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ---- elements ---- */
const layA=$('#layA'),layB=$('#layB'),leak=$('#leak'),title=$('#title'),titleTxt=$('#title-txt'),
      lower=$('#lower'),stamp=$('#stamp'),otd=$('#otd'),loadnote=$('#loadnote'),bgm=$('#bgm'),unmute=$('#unmute');
let front=layB, back=layA;          // 'front' = currently visible layer
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---- preload real photos so cuts don't flash ---- */
function preload(){
  const imgs=CONTENT.filter(it=>it.img).map(it=>it.img);
  if(!imgs.length) return Promise.resolve();
  return Promise.all(imgs.map(src=>new Promise(res=>{const im=new Image();im.onload=im.onerror=res;im.src=src;})));
}

/* ---- paint one memory onto a layer ---- */
function paint(layer,it,color){
  layer.innerHTML=''; layer.style.backgroundImage='';
  layer.style.filter = color ? 'grayscale(0) contrast(1.05) saturate(1.1)' : 'grayscale(1) contrast(1.15) brightness(.95)';
  if(it.img){
    layer.style.background='#000';
    layer.style.backgroundImage=`url("${it.img}")`;
  }else{
    // stylized placeholder tile (works before real photos are added)
    layer.style.background=gradFor(it.id);
    const d=document.createElement('div'); d.className='phframe';
    d.innerHTML=`<span class="e">${TYPE_EMOJI[it.type]}</span>`;
    layer.appendChild(d);
  }
}
function kbClass(){return ['kb1','kb2','kb3'][Math.floor(Math.random()*3)];}

/* ---- show one frame (crossfade front<->back) ---- */
function showFrame(it,dur,color){
  paint(back,it,color);
  back.style.setProperty('--dur',dur+'ms');
  back.classList.remove('kb1','kb2','kb3'); void back.offsetWidth;
  back.classList.add(kbClass(),'show');
  front.classList.remove('show');
  [front,back]=[back,front];          // swap
  if(!reduce){ leak.classList.remove('go'); void leak.offsetWidth; leak.classList.add('go'); }
}

/* ---- title / interstitial card ---- */
async function showTitle(text,dur){
  titleTxt.textContent=text;
  title.classList.remove('go'); void title.offsetWidth; title.classList.add('go');
  await sleep(dur);
}

/* ---- the reel loop ---- */
let started=false;
async function runReel(){
  if(started)return; started=true;
  await preload();
  loadnote.hidden=true;

  const OPENERS=['Kenangan internship korang','3 bulan · tak terlupa','Tekan main balik dalam hati 🥹'];
  let first=true;

  while(true){                                   // loop forever, reshuffle each round
    const list=shuffle(CONTENT);

    // opening title card
    stamp.textContent=''; otd.hidden=true; lower.classList.remove('go');
    await showTitle(first?OPENERS[0]:OPENERS[1+Math.floor(Math.random()*2)], 1600);
    first=false;

    for(let i=0;i<list.length;i++){
      const it=list[i];
      const special = it.rarity==='legendary' || isOnThisDay(it);
      const dur = special ? 1250 : 500;          // fast cuts; special ones linger
      showFrame(it,dur,special);

      // date stamp
      stamp.textContent=stampOf(it);
      // "on this day" badge
      otd.hidden=!isOnThisDay(it);
      // caption: always on special frames, sometimes on normal ones
      const cap=capOf(it);
      if(cap && (special || i%4===2)){
        lower.querySelector('span')?.remove();
        const s=document.createElement('span'); s.textContent=cap; lower.innerHTML=''; lower.appendChild(s);
        lower.classList.remove('go'); void lower.offsetWidth; lower.classList.add('go');
      }

      await sleep(dur);

      // occasional month interstitial between bursts
      if(i>0 && i%6===0 && i<list.length-1){
        const nextMonth=monthOf(list[i+1]);
        await showTitle(MONTH_NAME[nextMonth]||'…', 900);
      }
    }
  }
}

/* ---- music: tap anywhere to enable sound (autoplay is blocked until a tap) ---- */
(function audioSetup(){
  let hasAudio=false;
  bgm.addEventListener('canplay',()=>{hasAudio=true; if(!muted) unmute.hidden=false;});
  bgm.addEventListener('error',()=>{hasAudio=false; unmute.hidden=true;});
  let muted=true;
  function enable(){ if(!hasAudio)return; bgm.muted=false; bgm.play().catch(()=>{}); muted=false; unmute.hidden=true; }
  unmute.addEventListener('click',e=>{e.stopPropagation();enable();});
  document.addEventListener('click',enable,{once:false});
  // try muted autoplay (allowed) so it's ready to unmute instantly
  bgm.muted=true; bgm.play().catch(()=>{});
})();

/* start as soon as the page opens (that's the NFC scan) */
if(typeof CONTENT!=='undefined' && CONTENT.length){ runReel(); }
else{ loadnote.textContent='Tiada kenangan dalam data.js'; }
