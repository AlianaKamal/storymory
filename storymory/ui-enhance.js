/* UI polish for the reference-style Internship Dash mockup.
   Additive only: keeps the existing game engine and localStorage behaviour. */
(() => {
  const $ = s => document.querySelector(s);
  const captions = typeof CONTENT !== 'undefined' ? CONTENT : [];
  const names = {Nurin:'🐰 Team Bunny', Haziq:'🏍️ Team Zoom', Yana:'🛻 Team Hilux'};

  function decorateCharacterCards() {
    const grid = $('#char-grid');
    if (!grid) return;
    grid.querySelectorAll('.char-card').forEach(card => {
      const name = card.querySelector('.char-name')?.textContent.trim();
      const avatar = card.querySelector('.char-ava');
      if (avatar && !avatar.querySelector('img') && !avatar.textContent.trim()) {
        avatar.textContent = name === 'Nurin' ? '🐰' : name === 'Haziq' ? '🏍️' : '🛻';
      }
      if (name && !card.querySelector('.ride-label')) {
        const label = document.createElement('span');
        label.className = 'ride-label';
        label.textContent = names[name] || '✨ Ready to dash';
        card.appendChild(label);
      }
    });
  }

  function decorateGallery() {
    const grid = $('#gal-grid');
    if (!grid) return;
    [...grid.querySelectorAll('.cell')].forEach((cell, i) => {
      const item = captions[i];
      if (!item || cell.classList.contains('locked')) return;
      cell.title = item.date ? `${item.caption} · ${item.date}` : (item.caption || 'Memory unlocked');
      if (item.caption && !cell.querySelector('.memory-caption')) {
        const cap = document.createElement('span');
        cap.className = 'memory-caption';
        cap.textContent = item.caption;
        cell.appendChild(cap);
      }
      const img = cell.querySelector('img');
      if (img) img.alt = item.caption || 'Internship memory';
    });
  }

  const extra = document.createElement('style');
  extra.textContent = `
    .ride-label{font:900 .72rem 'Nunito',sans-serif;color:#fff;text-shadow:1px 2px #09265f}
    .memory-caption{position:absolute;left:2px;right:2px;bottom:2px;padding:4px 3px;background:#fffef0ee;color:#77275f;border-radius:2px;font:900 clamp(7px,1vw,10px)/1.1 'Nunito',sans-serif;text-align:center}
    .cell.locked .memory-caption{display:none}
    @media(max-width:650px){.ride-label{font-size:.62rem}.memory-caption{font-size:7px}}
  `;
  document.head.appendChild(extra);

  const observer = new MutationObserver(() => {
    decorateCharacterCards();
    decorateGallery();
  });
  function boot() {
    decorateCharacterCards();
    decorateGallery();
    const grid = $('#char-grid');
    const gallery = $('#gal-grid');
    if (grid) observer.observe(grid, {childList:true,subtree:true});
    if (gallery) observer.observe(gallery, {childList:true,subtree:true});
    // Also decorate after screen transitions where app.js rebuilds its contents.
    document.addEventListener('click', () => setTimeout(() => {
      decorateCharacterCards();
      decorateGallery();
    }, 60));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
