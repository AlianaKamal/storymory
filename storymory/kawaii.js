/* ==========================================================================
   kawaii.js — gentle UI polish for Internship Dash 🎀
   Add <script src="kawaii.js"></script> AFTER app.js in index.html.
   This file decorates the existing UI without replacing the runner logic.
   ========================================================================== */
(() => {
  const $ = (s) => document.querySelector(s);
  const style = document.createElement('style');
  style.textContent = `
    .kawaii-kicker{font:800 .9rem 'Nunito',sans-serif;color:#a477a4;margin:0;letter-spacing:.04em}
    .kawaii-note{font:800 .83rem 'Nunito',sans-serif;color:#a477a4;margin:0}
    .kawaii-title{font-family:'Fredoka',sans-serif;color:#e94f98;text-shadow:0 2px #fff}
    .kawaii-sticker{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:10px;background:#fff;border:2px solid #fff0f8;box-shadow:0 3px 0 #f2d4e7;margin-right:6px}
    .cell{transition:transform .16s ease,filter .16s ease}
    .cell:not(.locked):hover{transform:translateY(-3px) rotate(-1deg);filter:saturate(1.08)}
    .cell .memory-caption{position:absolute;left:3px;right:3px;bottom:3px;padding:4px 3px;background:rgba(255,250,253,.92);color:#78536e;border-radius:8px;font:800 9px/1.15 'Nunito',sans-serif}
    .cell .ph{font-size:1.9rem}
    .board-row{transition:transform .15s ease}
    .board-row:hover{transform:translateX(2px)}
    .kawaii-bubble{display:inline-block;background:#fff;border:2px solid #fff;border-radius:999px;padding:6px 11px;color:#a85f91;box-shadow:0 3px 0 #f3d2e5;font:800 .78rem 'Nunito',sans-serif}
    @media(max-width:520px){.cell .memory-caption{font-size:8px}.kawaii-kicker{font-size:.78rem}}
  `;
  document.head.appendChild(style);

  function addKicker(parent, text, className='kawaii-kicker') {
    if (!parent || parent.querySelector('.'+className)) return;
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    parent.insertBefore(p, parent.firstChild);
  }

  function decorateStaticUI() {
    const select = $('#screen-select');
    if (select) {
      const title = select.querySelector('.scr-title');
      if (title) {
        title.textContent = 'Pilih geng awak! 🎀';
        title.classList.add('kawaii-title');
      }
      addKicker(select, 'INTERNSHIP DASH · CUTE LITTLE ADVENTURE');
      const grid = $('#char-grid');
      if (grid) {
        const observer = new MutationObserver(() => {
          grid.querySelectorAll('.char-card').forEach((card) => {
            const name = card.querySelector('.char-name');
            if (name && !card.querySelector('.kawaii-char-tag')) {
              const tag = document.createElement('div');
              tag.className = 'kawaii-note kawaii-char-tag';
              const n = name.textContent.trim();
              tag.textContent = n === 'Nurin' ? '🐰 Team Bunny' : n === 'Haziq' ? '🏍️ Team Zoom' : n === 'Yana' ? '🛻 Team Hilux' : '✨ Team';
              card.appendChild(tag);
            }
          });
        });
        observer.observe(grid, {childList:true,subtree:true});
        observer.disconnect();
        grid.querySelectorAll('.char-card').forEach((card) => {
          const name = card.querySelector('.char-name');
          if (!name) return;
          const tag = document.createElement('div');
          tag.className = 'kawaii-note kawaii-char-tag';
          const n = name.textContent.trim();
          tag.textContent = n === 'Nurin' ? '🐰 Team Bunny' : n === 'Haziq' ? '🏍️ Team Zoom' : n === 'Yana' ? '🛻 Team Hilux' : '✨ Team';
          card.appendChild(tag);
        });
      }
    }
    const galleryTitle = $('#screen-gallery .scr-title');
    if (galleryTitle) {
      galleryTitle.textContent = 'Memory Hall of Fame 🏆';
      galleryTitle.classList.add('kawaii-title');
    }
    const winTitle = $('#win-title');
    if (winTitle) winTitle.classList.add('kawaii-title');
  }

  // Enrich the existing gallery after the original app renders it.
  function decorateGallery(char) {
    const grid = $('#gal-grid');
    if (!grid || typeof CONTENT === 'undefined') return;
    const cells = [...grid.querySelectorAll('.cell')];
    CONTENT.forEach((memory, i) => {
      const cell = cells[i];
      if (!cell || cell.classList.contains('locked')) return;
      if (memory.img) {
        const img = cell.querySelector('img');
        if (img) img.alt = memory.caption || 'Internship memory';
      } else {
        const ph = cell.querySelector('.ph');
        if (ph) ph.textContent = '📸';
      }
      if (memory.caption && !cell.querySelector('.memory-caption')) {
        const cap = document.createElement('span');
        cap.className = 'memory-caption';
        cap.textContent = memory.caption;
        cell.appendChild(cap);
        cell.title = memory.date ? `${memory.caption} · ${memory.date}` : memory.caption;
      }
    });
  }

  function patchFunctions() {
    // In classic-script mode these functions are normally exposed on window.
    if (typeof window.buildGallery === 'function' && !window.buildGallery.__kawaiiPatched) {
      const original = window.buildGallery;
      const wrapped = function(char) {
        const result = original.apply(this, arguments);
        decorateGallery(char);
        requestAnimationFrame(() => decorateGallery(char));
        return result;
      };
      wrapped.__kawaiiPatched = true;
      window.buildGallery = wrapped;
    }
  }

  function boot() {
    decorateStaticUI();
    patchFunctions();
    // The app's boot code may populate the character cards immediately before
    // this script runs; decorate them once more after the browser paints.
    requestAnimationFrame(() => {
      decorateStaticUI();
      patchFunctions();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
