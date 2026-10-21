INTERNSHIP DASH — KAWAII UPGRADE 🎀

Files:
- data.js: replace the existing data.js with this version.
- kawaii.js: add this as a new file in the same folder as index.html.

To enable kawaii.js:
In index.html, immediately after:
  <script src="app.js"></script>
add:
  <script src="kawaii.js"></script>

Keep your existing index.html, app.js, style.css and three.min.js.
Use the previously provided cute CSS as style.css.

Photo setup:
1. Put actual photos in the img/ folder.
2. In data.js, change the relevant img:null to a path such as:
   img:'img/lunch-bertiga.jpg'
3. Commit the photo and code changes to GitHub.

Note: Supabase is intentionally blank, so leaderboard remains local to each
device until a shared database is configured. The existing game stores photos
and scores in localStorage per browser/device.
