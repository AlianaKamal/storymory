/* ==========================================================================
   data.js — INTERNSHIP DASH 🎀
   Edit this file to change memory captions, dates and photo filenames.
   Put real photos inside the img/ folder, then set img:'img/filename.jpg'.
   ========================================================================== */

const MEL = {}; // Kept for compatibility with the original project.

const CONTENT = [
  {id:'p01', caption:'Hari pertama 😂',       date:'2026-07-08', img:null},
  {id:'p02', caption:'Lunch pertama bertiga 🍟',date:'2026-07-13', img:null},
  {id:'p03', caption:'Candid tengah sibuk 📸', date:'2026-08-15', img:null},
  {id:'p04', caption:'Gambar bertiga cun 💗',  date:'2026-09-13', img:null},
  {id:'p05', caption:'Tea break time 🧋',       date:'2026-09-25', img:null},
  {id:'p06', caption:'Senyum lebar ✨',         date:'2026-10-13', img:null},
  {id:'p07', caption:'Outing ramai-ramai 🌷',  date:'2026-11-19', img:null},
  {id:'p08', caption:'Last day November 🍰',   date:'2026-11-30', img:null},
  {id:'p09', caption:'Farewell bertiga 🥹',    date:'2026-12-24', img:null},
  {id:'p10', caption:'Balik lepas cuti 🐣',    date:'2027-01-06', img:null},
];

/* Optional extra photos. Add each filename to img/ and uncomment it.
   Example: 'lunch-bertiga.jpg' */
const PHOTOS = [
  // 'lunch-bertiga.jpg',
  // 'candid-office.jpg',
];

/* Optional shared leaderboard. Leave blank for local-only scores.
   Never publish a service_role key here. Use only Supabase anon/public key. */
const SUPABASE_URL = '';
const SUPABASE_KEY = '';

/* Optional close-up character images. If a file is missing, the game falls
   back to the coloured avatar background. Use exact filenames in img/. */
const FACES = {
  Nurin: 'img/muka-nurin.png',
  Haziq: 'img/muka-haziq.png',
  Yana:  'img/muka-yana.png',
};
