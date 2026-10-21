/* UI extras for the four reference screens; no external dependencies. */
(() => {
  const $ = s => document.querySelector(s);
  const emoji = {Nurin:'🐰',Haziq:'🏍️',Yana:'🛻'};
  const ride = {Nurin:'Bunny Scooter',Haziq:'Sport Bike',Yana:'Mini Hilux'};
  function decorateCards(){
    const grid=$('#char-grid'); if(!grid)return;
    grid.querySelectorAll('.char-card').forEach(card=>{
      const name=card.querySelector('.char-name')?.textContent.trim();
      if(name && !card.querySelector('.ride-label')){
        const tag=document.createElement('span');tag.className='ride-label';
        tag.textContent=`${emoji[name]||'✨'} ${ride[name]||'Ready to dash'}`;card.appendChild(tag);
      }
    });
  }
  function decorateGallery(){
    const grid=$('#gal-grid');if(!grid)return;
    [...grid.querySelectorAll('.cell')].forEach((cell,i)=>{
      const item=(typeof CONTENT!=='undefined'?CONTENT:[])[i];
      if(!item || cell.classList.contains('locked'))return;
      cell.title=[item.caption,item.date].filter(Boolean).join(' · ');
      const img=cell.querySelector('img');if(img)img.alt=item.caption||'Internship memory';
      if(!cell.querySelector('.memory-caption') && (item.caption||item.date)){
        const cap=document.createElement('span');cap.className='memory-caption';
        cap.textContent=[item.caption,item.date].filter(Boolean).join(' · ');cell.appendChild(cap);
      }
    });
  }
  const css=document.createElement('style');
  css.textContent=`.ride-label{display:inline-block;margin-top:1px;padding:3px 7px;border:1.5px solid #fff;border-radius:999px;background:#071b50aa;color:#fff;font:900 .68rem 'Nunito',sans-serif;text-shadow:1px 1px #071b50}.char-card .ride-label{color:#fff}@media(max-width:650px){.ride-label{font-size:.6rem;padding:2px 5px}}`;
  document.head.appendChild(css);
  const obs=new MutationObserver(()=>{decorateCards();decorateGallery();});
  function boot(){
    decorateCards();decorateGallery();
    ['#char-grid','#gal-grid'].forEach(sel=>{const el=$(sel);if(el)obs.observe(el,{childList:true,subtree:true});});
    document.addEventListener('click',()=>setTimeout(()=>{decorateCards();decorateGallery();},80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
