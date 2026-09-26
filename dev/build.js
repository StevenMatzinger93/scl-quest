const fs = require('fs'), path = require('path');
/* Build-Varianten
   node build.js            → index.html (vollständig offline: three.js und Icons eingebettet)
   node build.js --cdn      → index.html schlank, lädt three.js und Icons aus dem Netz
   Zusätzlich entsteht immer web/ (index.html + manifest + Service Worker + Icons)
   zum Hosten als installierbare App (PWA). */
const CDN = process.argv.includes('--cdn');
const MODS = [path.join(__dirname, 'node_modules'), path.join(__dirname, 'npmtmp/node_modules'), path.join(__dirname, '..', 'node_modules')];
function mod(rel){ for(const m of MODS){ const f = path.join(m, rel); if(fs.existsSync(f)) return f; } return null; }
const R = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const content = ['content/_helpers.js','content/manual.js','content/chapters.js'].concat(
  fs.readdirSync(path.join(__dirname,'src/content')).filter(f => /^ch\d+\.js$/.test(f)).sort().map(f => 'content/'+f), ['content/theory.js','content/theory_pro.js']);
const script = (name, code) => '<script>\n/* ==================== ' + name + ' ==================== */\n' + code.replace(/<\/script>/gi, '<\\/script>') + '\n</script>\n';
let ICON_CSS = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">';
let THREE_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n';
let OFFLINE = false;
if(!CDN){
  const faCss = mod('@fortawesome/fontawesome-free/css/all.min.css'), faSolid = mod('@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2'), faReg = mod('@fortawesome/fontawesome-free/webfonts/fa-regular-400.woff2'), three = mod('three/build/three.min.js');
  if(faCss && faSolid && faReg && three){
    const css = fs.readFileSync(faCss, 'utf8').replace(/@font-face\{[^}]*\}/g, '')
      + '@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;font-display:block;src:url(data:font/woff2;base64,' + fs.readFileSync(faSolid).toString('base64') + ') format("woff2")}'
      + '@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,' + fs.readFileSync(faReg).toString('base64') + ') format("woff2")}';
    ICON_CSS = '<style>/* Font Awesome Free 6.5.1 (Icons: CC BY 4.0, Code: MIT) — eingebettet für Offline-Betrieb */\n' + css + '</style>';
    THREE_TAG = '<script>/* three.js r128 (MIT) — eingebettet für Offline-Betrieb */\n' + fs.readFileSync(three, 'utf8').replace(/<\/script>/gi, '<\\/script>') + '\n</script>\n';
    OFFLINE = true;
  } else console.warn('Hinweis: three.js/Font Awesome nicht gefunden (npm install) — baue mit CDN-Links.');
}
let html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="SCL Quest 3 – Aufstand der Maschinen: Das Lernspiel für Siemens SCL mit 150 Programmieraufgaben, 30 Theorie-Aufträgen, Profi-Stufe mit Bausteinen und TIA-Export sowie einer Live-Roboterzelle in 2D und 3D.">
<meta name="theme-color" content="#121212">
<title>SCL Quest 3: Aufstand der Maschinen</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23121212'/%3E%3Ctext x='32' y='42' font-size='26' font-family='monospace' font-weight='700' text-anchor='middle' fill='%2339ff14'%3ESCL%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
${ICON_CSS}
<style>
${R('styles_base.css')}
${R('styles_new.css')}
</style>
</head>
<body>
${R('body.html')}
`;
html += script('SCL-ENGINE (Tokenizer, Parser, Typprüfung, Interpreter)', R('engine.js'));
html += script('SCL-ENGINE PRO (Bausteine, Projekte, Export)', R('engine_pro.js'));
html += THREE_TAG;
html += script('SCENE 2D (SVG-Live-Anlage)', R('scene2d.js'));
html += script('SCENE 3D (three.js)', R('scene3d.js'));
content.forEach(f => { html += script('INHALT: ' + f, R(f)); });
html += script('SCL-EDITOR', R('editor.js'));
html += script('APP (Spiel-Controller)', R('app.js'));
html += '</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html', (html.length/1024).toFixed(0)+' KB', html.split('\n').length+' Zeilen', OFFLINE ? '(offline, alles eingebettet)' : '(CDN)');
// ---- web/: installierbare App (PWA) zum Hosten ----
const WEB = path.join(__dirname, '..', 'web');
fs.mkdirSync(WEB, { recursive:true });
fs.writeFileSync(path.join(WEB, 'index.html'), html);
fs.writeFileSync(path.join(WEB, 'manifest.webmanifest'), JSON.stringify({
  name:'SCL Quest 3 – Aufstand der Maschinen', short_name:'SCL Quest', lang:'de', start_url:'./index.html', scope:'./', display:'standalone',
  background_color:'#121212', theme_color:'#121212', description:'Lernspiel für Siemens SCL mit Live-Anlage in 2D und 3D.',
  icons:[{ src:'icon-192.png', sizes:'192x192', type:'image/png' }, { src:'icon-512.png', sizes:'512x512', type:'image/png' }, { src:'icon-512.png', sizes:'512x512', type:'image/png', purpose:'maskable' }]
}, null, 2));
const ver = require('crypto').createHash('sha1').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(WEB, 'sw.js'), `// Service Worker: hält das Spiel offline verfügbar (Cache-first, Version ${ver})
const CACHE = 'sclquest-${ver}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(r => r || fetch(e.request).then(res => {
    if(res.ok && new URL(e.request.url).origin === location.origin){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
`);
['icon-192.png','icon-512.png'].forEach(f => { const src = path.join(__dirname, 'assets', f); if(fs.existsSync(src)) fs.copyFileSync(src, path.join(WEB, f)); });
console.log('web/ (PWA) aktualisiert');
