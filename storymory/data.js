/* ===========================================================================
   data.js  —  THIS IS THE FILE YOU EDIT MOST 🎁
   Change the photos, captions, dates, rarity and songs here only.
   You don't need to touch the other files (style.css / app.js).
   ===========================================================================

   Each surprise has:
     type      : 'photo' | 'meme' | 'chaos' | 'sound'
     rarity    : 'common' | 'rare' | 'legendary'   (legendary shows up least often)
     date      : 'YYYY-MM-DD'  (date the photo was taken — drives the "on this day" feature)
     caption   : text (for photo & meme)
     img       : null = a coloured sample tile. To use a real photo:
                 img:'img/sep1.jpg'   (make an 'img' folder, drop the photo in, write its filename)
     challenge : the task text (for type 'chaos' only)
     song+melody : for type 'sound' (melody: 'twinkle' | 'bounce' | 'arp')

   Want to add a surprise? Copy one line, change its contents, and keep 'id' unique.
   =========================================================================== */

// Jingle tunes (placeholder, generated in the phone). You can leave these for now.
const MEL = {
  twinkle:[['C5',.18],['E5',.18],['G5',.18],['C6',.3],['G5',.16],['E5',.16],['C5',.3]],
  bounce :[['G4',.16],['C5',.16],['E5',.16],['D5',.16],['G5',.24],['E5',.16],['C5',.3]],
  arp    :[['A4',.15],['C5',.15],['E5',.15],['A5',.28],['E5',.14],['A4',.3]],
};

// ↓↓↓ SENARAI KEJUTAN — edit di sini ↓↓↓
const CONTENT = [
  {id:'p01', type:'photo', rarity:'common',    date:'2026-07-08', caption:'Hari pertama. Semua pakai baju paling formal 😂', img:null},
  {id:'p02', type:'photo', rarity:'common',    date:'2026-07-13', caption:'JULY DROP! Lunch pertama bertiga', img:null},
  {id:'p03', type:'photo', rarity:'common',    date:'2026-08-15', caption:'AUGUST DROP! Candid tengah sibuk', img:null},
  {id:'m01', type:'meme',  rarity:'rare',      date:'2026-08-20', caption:'When the supervisor walks in', img:null},
  {id:'p04', type:'photo', rarity:'rare',      date:'2026-09-13', caption:'SEPTEMBER DROP! Gambar bertiga paling cun', img:null},
  {id:'p05', type:'photo', rarity:'common',    date:'2026-09-25', caption:'Tea break yang tak habis-habis', img:null},
  {id:'c01', type:'chaos', rarity:'common',    date:'2026-09-09', challenge:'Teka siapa yang amik gambar paling banyak masa internship 🤔'},
  {id:'m02', type:'meme',  rarity:'common',    date:'2026-10-02', caption:'Me pretending to understand', img:null},
  {id:'p06', type:'photo', rarity:'legendary', date:'2026-10-13', caption:'LEGENDARY! Gambar hari ni tahun internship ✨', img:null},
  {id:'m03', type:'meme',  rarity:'rare',      date:'2026-10-21', caption:'Deadline esok, kami tengah', img:null},
  {id:'c02', type:'chaos', rarity:'common',    date:'2026-10-28', challenge:'Cari objek warna pink dalam pejabat dalam 10 saat! 🎲'},
  {id:'s01', type:'sound', rarity:'rare',      date:'2026-11-05', song:'Opening Theme Internship', melody:'bounce'},
  {id:'p07', type:'photo', rarity:'common',    date:'2026-11-19', caption:'Outing ramai-ramai', img:null},
  {id:'p08', type:'photo', rarity:'common',    date:'2026-11-30', caption:'Last day bulan November', img:null},
  {id:'m04', type:'meme',  rarity:'common',    date:'2026-12-01', caption:'December energy', img:null},
  {id:'c03', type:'chaos', rarity:'rare',      date:'2026-12-13', challenge:'Hantar satu voice note buat bunyi haiwan kesukaan 🐥'},
  {id:'p09', type:'photo', rarity:'legendary', date:'2026-12-24', caption:'LEGENDARY! Gambar farewell bertiga 🥹', img:null},
  {id:'p10', type:'photo', rarity:'common',    date:'2027-01-06', caption:'JANUARY DROP! Balik semula lepas cuti', img:null},
  {id:'s02', type:'sound', rarity:'legendary', date:'2027-01-13', song:'Lagu Kenangan (Legendary)', melody:'twinkle'},
  {id:'s03', type:'sound', rarity:'common',    date:'2026-08-03', song:'Morning Vibes', melody:'arp'},
];
