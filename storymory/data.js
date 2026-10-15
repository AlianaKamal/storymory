/* ===========================================================================
   data.js  —  THIS IS THE FILE YOU EDIT MOST 🎞️
   This is the list of memories the reel plays. Edit here only.
   You don't need to touch the other files (style.css / app.js).
   ===========================================================================

   The reel shuffles these every scan and plays them as a fast montage.
   For the best look, give each one a real photo (img). Items without a photo
   still show as a stylized placeholder tile.

   Each memory has:
     type      : 'photo' | 'meme' | 'chaos' | 'sound'   (just picks the emoji on a placeholder)
     rarity    : 'common' | 'rare' | 'legendary'
                 legendary = pops into COLOUR and lingers a little longer
     date      : 'YYYY-MM-DD'  (shown as the date stamp; a matching day = "on this day" ✨)
     caption   : text shown as a subtitle (for photo & meme)
     img       : null = placeholder tile. To use a real photo:
                 img:'img/sep1.jpg'   (make an 'img' folder, drop the photo in, write its filename)
     challenge : subtitle text (for type 'chaos')
     song      : subtitle text (for type 'sound')

   Want to add a memory? Copy one line, change its contents, keep 'id' unique.

   MUSIC: to add background music, put music.mp3 in the same folder.
          It won't need the MEL lines below — those are leftover and unused now.
   =========================================================================== */

const MEL = {};  // (not used by the reel — safe to ignore)

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
