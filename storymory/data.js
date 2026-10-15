/* ===========================================================================
   data.js  —  THIS IS THE FILE YOU EDIT MOST 🎮
   These are the PHOTOS that become collectibles ("coins") in the game.
   Edit here only. You don't need to touch index.html / style.css / app.js.
   ===========================================================================

   Each memory has:
     id        : unique short id (don't repeat)
     caption   : text shown when collected (optional)
     date      : 'YYYY-MM-DD' (optional)
     img       : null = coloured placeholder. Real photo:
                 img:'img/lunch.jpg'   (put photos in the 'img' folder)
   =========================================================================== */

const MEL = {};  // (unused, ignore)

const CONTENT = [
  {id:'p01', caption:'Hari pertama 😂',        date:'2026-07-08', img:null},
  {id:'p02', caption:'Lunch pertama bertiga',  date:'2026-07-13', img:null},
  {id:'p03', caption:'Candid tengah sibuk',    date:'2026-08-15', img:null},
  {id:'p04', caption:'Gambar bertiga cun',     date:'2026-09-13', img:null},
  {id:'p05', caption:'Tea break',              date:'2026-09-25', img:null},
  {id:'p06', caption:'Senyum lebar ✨',         date:'2026-10-13', img:null},
  {id:'p07', caption:'Outing ramai-ramai',     date:'2026-11-19', img:null},
  {id:'p08', caption:'Last day November',      date:'2026-11-30', img:null},
  {id:'p09', caption:'Farewell bertiga 🥹',     date:'2026-12-24', img:null},
  {id:'p10', caption:'Balik lepas cuti',       date:'2027-01-06', img:null},
];

/* ---------------------------------------------------------------------------
   BANYAK GAMBAR? Senaraikan nama fail je di sini (dalam folder 'img').
   Tarikh & caption tak wajib. Boleh sampai ratusan keping.
   --------------------------------------------------------------------------- */
const PHOTOS = [
  // 'gambar1.jpg',
  // 'gambar2.jpg',
];

/* ---------------------------------------------------------------------------
   SKOR DIKONGSI (pilihan) — supaya 3 telefon kongsi papan pendahulu.
   Biar kosong = skor simpan dalam telefon masing-masing (game tetap jalan).
   Nak kongsi: isi URL + anon key Supabase awak (saya tolong set up).
   --------------------------------------------------------------------------- */
const SUPABASE_URL = '';   // cth 'https://xxxx.supabase.co'
const SUPABASE_KEY = '';   // anon public key
