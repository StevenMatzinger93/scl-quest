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
  fs.readdirSync(path.join(__dirname,'src/content')).filter(f => /^ch\d+\.js$/.test(f)).sort().map(f => 'content/'+f), ['content/theory.js','content/theory_pro.js','content/bugs.js']);
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
<meta name="description" content="SCL Quest 3 – Aufstand der Maschinen: Das Lernspiel für Siemens SCL mit 150 Programmieraufgaben, 30 Theorie-Aufträgen, Profi-Stufe mit Bausteinen sowie einer Live-Roboterzelle in 2D und 3D.">
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
// ---- web/: SPS-Quest-Portal (Startseite, Login, Dashboards) + SCL Quest unter web/scl/ ----
const WEB = path.join(__dirname, '..', 'web');
const SCL = path.join(WEB, 'scl');
fs.mkdirSync(path.join(SCL), { recursive:true }); fs.mkdirSync(path.join(WEB, 'data'), { recursive:true });
// SCL Quest in der Portal-Version: gleiche Datei, zusätzlich Konto-Abgleich (window.SPSQ_PORTAL)
// ohne Google-Fonts (Datenschutz: keine Verbindung zu Drittservern), Systemschriften als Ersatz
const sclHtml = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link href="https:\/\/fonts\.googleapis\.com[^\n]*\n/, '')
  .replace('<body>\n', '<body>\n<script>window.SPSQ_PORTAL = true;</script>\n');
fs.writeFileSync(path.join(SCL, 'index.html'), sclHtml);
fs.writeFileSync(path.join(SCL, 'manifest.webmanifest'), JSON.stringify({
  name:'SCL Quest 3 – Aufstand der Maschinen', short_name:'SCL Quest', lang:'de', start_url:'./', scope:'../', display:'standalone',
  background_color:'#121212', theme_color:'#121212', description:'Lernspiel für Siemens SCL mit Live-Anlage in 2D und 3D.',
  icons:[{ src:'../icon-192.png', sizes:'192x192', type:'image/png' }, { src:'../icon-512.png', sizes:'512x512', type:'image/png' }, { src:'../icon-512.png', sizes:'512x512', type:'image/png', purpose:'maskable' }]
}, null, 2));
['icon-192.png','icon-512.png'].forEach(f => { const src = path.join(__dirname, 'assets', f); if(fs.existsSync(src)){ fs.copyFileSync(src, path.join(WEB, f)); fs.copyFileSync(src, path.join(SCL, f)); } });
// Aufgaben-Metadaten für den Leitstand (gleiche Nummerierung wie im Spiel)
{
  const g = { window:{} }; g.window = g;
  const vm = require('vm'); const ctx = vm.createContext(g);
  ['content/_helpers.js','content/manual.js','content/chapters.js'].concat(content.filter(f => /ch\d+/.test(f)), ['content/theory.js','content/theory_pro.js','content/bugs.js'])
    .filter((f, i, a) => a.indexOf(f) === i).forEach(f => vm.runInContext(R(f), ctx, { filename:f }));
  const C = g.SCL_CONTENT; const chapters = C.chapters.slice().sort((a, b) => a.n - b.n);
  const tasks = [], theory = []; let no = 0;
  chapters.forEach(ch => {
    C.theory.filter(t => t.ch === ch.n).sort((a, b) => (a.pos === 'start' ? 0 : 1) - (b.pos === 'start' ? 0 : 1)).forEach(t => theory.push({ id:t.id, ch:ch.n, title:t.title }));
    C.tasks.filter(t => t.level === ch.n).forEach(t => tasks.push({ id:t.id, no:++no, ch:ch.n, title:t.title, pro:!!t.pro }));
  });
  fs.writeFileSync(path.join(WEB, 'data', 'scl.json'), JSON.stringify({ chapters: chapters.map(c => ({ n:c.n, title:c.title, pro:!!c.pro })), tasks, theory }));
  // Live-Challenge: Aufgaben, Störungsszenarien und Referenzlösungen (für den Lösungsvergleich am Beamer)
  const refs = {};
  C.tasks.forEach(t => { refs[t.id] = t.pro ? g.ProTask.refCodes(t) : t.refSolution; });
  const bugs = (C.bugs || []).map(b => { const t = C.tasks.find(x => x.id === b.task); return { id:b.id, task:b.task, ch:t.level, title:b.title, symptom:b.symptom }; });
  fs.writeFileSync(path.join(WEB, 'data', 'scl_live.json'), JSON.stringify({ refs, bugs }));
}
// Portal
const P = f => fs.readFileSync(path.join(__dirname, 'portal', f), 'utf8');
const portalHead = (title, desc) => `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${desc}">
<meta name="theme-color" content="#05070a">
<title>${title}</title>
<link rel="icon" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-192.png">
<style>
${P('portal.css')}
</style>
</head>
<body>
`;
const portalScripts = ['portal.js'].concat(fs.readdirSync(path.join(__dirname, 'portal')).filter(f => /^portal_.*\.js$/.test(f)).sort());
let portal = portalHead('SPS Quest – Lernspiele für Steuerungstechnik', 'SPS Quest: Lernspiele für SCL, KOP, FUP und AWL mit Live-Simulation. Klassen, Konten und Live-Challenge für den Unterricht.')
  + P('body.html') + portalScripts.map(f => script('PORTAL: ' + f, P(f))).join('') + '</body>\n</html>\n';
fs.writeFileSync(path.join(WEB, 'index.html'), portal);
['impressum.html','datenschutz.html'].forEach(f => {
  const src = P(f); const m = src.match(/<title>(.*?)<\/title>/);
  fs.writeFileSync(path.join(WEB, f), portalHead((m ? m[1] : f) + ' – SPS Quest', 'SPS Quest – ' + (m ? m[1] : f)) + src.replace(/<title>.*?<\/title>\n?/, '') + '</body>\n</html>\n');
});
fs.writeFileSync(path.join(WEB, 'manifest.webmanifest'), JSON.stringify({
  name:'SPS Quest', short_name:'SPS Quest', lang:'de', start_url:'./', scope:'./', display:'standalone',
  background_color:'#05070a', theme_color:'#05070a', description:'Lernspiele für Steuerungstechnik: SCL, KOP, FUP, AWL.',
  icons:[{ src:'icon-192.png', sizes:'192x192', type:'image/png' }, { src:'icon-512.png', sizes:'512x512', type:'image/png' }, { src:'icon-512.png', sizes:'512x512', type:'image/png', purpose:'maskable' }]
}, null, 2));
// Service Worker (Wurzel): Portal und Spiele offline, /api/ nie aus dem Cache
const FILES = ['./', './index.html', './impressum.html', './datenschutz.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './data/scl.json', './data/scl_live.json', './scl/', './scl/index.html', './scl/manifest.webmanifest'];
const ver = require('crypto').createHash('sha1').update(portal + sclHtml + fs.readFileSync(path.join(WEB, 'data', 'scl.json'))).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(WEB, 'sw.js'), `// Service Worker: hält Portal und Spiele offline verfügbar (Cache-first, Version ${ver})
const CACHE = 'spsquest-${ver}';
const FILES = ${JSON.stringify(FILES)};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(r => r || fetch(e.request).then(res => {
    if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => caches.match(url.pathname.startsWith('/scl/') ? './scl/index.html' : './index.html'))));
});
`);
// alte Datei aus v5.1 (Spiel lag direkt in web/) wird durch das Portal ersetzt
console.log('web/ (Portal + scl/ + PWA) aktualisiert');
