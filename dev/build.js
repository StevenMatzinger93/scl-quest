const fs = require('fs'), path = require('path'), vm = require('vm');
/* Build
   node build.js            → ../index.html (SCL Quest) und ../kop.html (KOP Quest), vollständig offline
   node build.js --cdn      → schlanke Varianten, laden three.js und Icons aus dem Netz
   Zusätzlich entsteht immer web/: SPS-Quest-Portal + web/scl/ + web/kop/ (installierbar, Service Worker). */
const CDN = process.argv.includes('--cdn');
const MODS = [path.join(__dirname, 'node_modules'), path.join(__dirname, 'npmtmp/node_modules'), path.join(__dirname, '..', 'node_modules')];
function mod(rel){ for(const m of MODS){ const f = path.join(m, rel); if(fs.existsSync(f)) return f; } return null; }
const R = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const script = (name, code) => '<script>\n/* ==================== ' + name + ' ==================== */\n' + code.replace(/<\/script>/gi, '<\\/script>') + '\n</script>\n';
const chFiles = dir => fs.readdirSync(path.join(__dirname, 'src', dir)).filter(f => /^ch\d+\.js$/.test(f)).sort().map(f => dir + '/' + f);
const has = f => fs.existsSync(path.join(__dirname, 'src', f));

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

/* ---------- Quests ---------- */
const QUESTS = {
  scl: {
    out: 'index.html', title: 'SCL Quest 3: Aufstand der Maschinen', short: 'SCL Quest', icon: 'SCL', color: '%2339ff14',
    desc: 'SCL Quest 3 – Aufstand der Maschinen: Das Lernspiel für Siemens SCL mit 150 Programmieraufgaben, 30 Theorie-Aufträgen, Profi-Stufe mit Bausteinen sowie einer Live-Roboterzelle in 2D und 3D.',
    manifestDesc: 'Lernspiel für Siemens SCL mit Live-Anlage in 2D und 3D.',
    config: null, styles: ['styles_base.css', 'styles_new.css'],
    scripts: [['SCL-ENGINE', 'engine.js'], ['SCL-ENGINE PRO', 'engine_pro.js'], 'THREE', ['SCENE 2D', 'scene2d.js'], ['SCENE 3D', 'scene3d.js']],
    content: ['content/_helpers.js', 'content/manual.js', 'content/chapters.js'].concat(chFiles('content'), ['content/theory.js', 'content/theory_pro.js', 'content/bugs.js']),
    editor: [['SCL-EDITOR', 'editor.js']], body: s => s
  },
  kop: {
    out: 'kop.html', title: 'KOP Quest: Sturm auf die Gratbahn', short: 'KOP Quest', icon: 'KOP', color: '%23ffb000',
    desc: 'KOP Quest – Sturm auf die Gratbahn: Das Lernspiel für den Kontaktplan (KOP) mit grafischem Netzwerk-Editor, Stromfluss-Anzeige und einer Live-Seilbahnstation.',
    manifestDesc: 'Lernspiel für den Kontaktplan (KOP) mit Live-Seilbahnstation.',
    config: { id:'kop', lang:'kop', name:'KOP Quest', key:'kopquest_state_v1', oldKey:'kopquest_state_v0', viewKey:'kopquest_view', ext:'.kop',
      langLong:'Kontaktplan (KOP)', langShort:'KOP', certPrefix:'KQ1', obf:'KOP-QUEST-ARIA-2026', titleFoot:'Echte Kontaktpläne · echte Tests · offline spielbar',
      basicText:'die Bergstation der Gratbahn mit vollständiger Sicherheitskette zurückerobert und ARIAs Sabotage beendet hat.',
      proText:'inklusive eigener Funktionen und Funktionsbausteine in KOP, Datenbausteine und eines Stationsprogramms nach Standard.', finalBadge:'Befreier der Gratbahn' },
    styles: ['styles_base.css', 'styles_new.css', 'styles_kop.css'],
    scripts: [['SCL-ENGINE', 'engine.js'], ['SCL-ENGINE PRO', 'engine_pro.js'], ['KOP (Modell, Übersetzung)', 'kop.js'], ['SZENE SEILBAHN', 'scene_seilbahn.js']],
    content: ['content/_helpers.js', 'content_kop/_kop.js', 'content_kop/manual.js', 'content_kop/chapters.js'].concat(chFiles('content_kop'), ['content_kop/theory.js', 'content_kop/theory_pro.js', 'content_kop/bugs.js']).filter(has),
    editor: [['SCL-EDITOR (Textansicht)', 'editor.js'], ['KOP-EDITOR', 'kop_editor.js']],
    body: s => s.replace(/Robotik-Trainingszentrum · Sektor 7/g, 'Seilbahn-Ausbildungszentrum · Gratbahn').replace(/SCL QUEST <span>3<\/span>/g, 'KOP QUEST').replace(/Aufstand der Maschinen/g, 'Sturm auf die Gratbahn')
      .replace(/fa-solid fa-robot/g, 'fa-solid fa-cable-car').replace('Das SCL-Lernspiel für Siemens-Steuerungen', 'Das Kontaktplan-Lernspiel für Siemens-Steuerungen')
      .replace('Live-Anlage in 2D &amp; 3D', 'Seilbahnstation live').replace('Echter SCL-Code · echte Tests', 'Echte Kontaktpläne · echte Tests')
      .replace('aria-label="SCL-Code-Editor" placeholder="// Schreibe hier deinen SCL-Code …"', 'aria-label="KOP-Textansicht" placeholder="NETWORK …"')
      .replace('SCL Quest 3 · Version', 'KOP Quest · Version').replace('Zertifikat <span>SCL-Programmierung</span>', 'Zertifikat <span>KOP-Programmierung</span>')
  },
  fup: {
    out: 'fup.html', title: 'FUP Quest: Das Geisterstellwerk', short: 'FUP Quest', icon: 'FUP', color: '%231ec8e0',
    desc: 'FUP Quest – Das Geisterstellwerk: Das Lernspiel für den Funktionsplan (FUP) mit Baustein-Editor (ziehen und verbinden), farbigen Signalzuständen und einem Live-Stellwerk mit Weichen, Signalen und Bahnübergang.',
    manifestDesc: 'Lernspiel für den Funktionsplan (FUP) mit Live-Stellwerk.',
    config: { id:'fup', lang:'fup', name:'FUP Quest', key:'fupquest_state_v1', oldKey:'fupquest_state_v0', viewKey:'fupquest_view', ext:'.fup',
      langLong:'Funktionsplan (FUP)', langShort:'FUP', certPrefix:'FQ1', obf:'FUP-QUEST-ARIA-2026', titleFoot:'Echte Funktionspläne · echte Tests · offline spielbar',
      basicText:'das Stellwerk Brünigkreuz mit gesicherten Fahrstrassen zurückerobert und ARIAs Sabotage beendet hat.',
      proText:'inklusive eigener Funktionen und Funktionsbausteine in FUP, Datenbausteine und eines Stellwerksprogramms nach Standard.', finalBadge:'Befreier des Stellwerks' },
    styles: ['styles_base.css', 'styles_new.css', 'styles_kop.css', 'styles_fup.css'],
    scripts: [['SCL-ENGINE', 'engine.js'], ['SCL-ENGINE PRO', 'engine_pro.js'], ['KOP/FUP (Modell, Übersetzung)', 'kop.js'], ['SZENE STELLWERK', 'scene_stellwerk.js']],
    content: ['content/_helpers.js', 'content_kop/_kop.js', 'content_fup/manual.js', 'content_fup/chapters.js'].concat(chFiles('content_fup'), ['content_fup/theory.js', 'content_fup/theory_pro.js', 'content_fup/bugs.js']).filter(has),
    editor: [['SCL-EDITOR (Textansicht)', 'editor.js'], ['FUP-EDITOR', 'kop_editor.js']],
    body: s => s.replace(/Robotik-Trainingszentrum · Sektor 7/g, 'Bahntechnik-Ausbildungszentrum · Brünigkreuz').replace(/SCL QUEST <span>3<\/span>/g, 'FUP QUEST').replace(/Aufstand der Maschinen/g, 'Das Geisterstellwerk')
      .replace(/fa-solid fa-robot/g, 'fa-solid fa-train').replace('Das SCL-Lernspiel für Siemens-Steuerungen', 'Das Funktionsplan-Lernspiel für Siemens-Steuerungen')
      .replace('Live-Anlage in 2D &amp; 3D', 'Stellwerk live').replace('Echter SCL-Code · echte Tests', 'Echte Funktionspläne · echte Tests')
      .replace('aria-label="SCL-Code-Editor" placeholder="// Schreibe hier deinen SCL-Code …"', 'aria-label="FUP-Textansicht" placeholder="NETWORK …"')
      .replace('SCL Quest 3 · Version', 'FUP Quest · Version').replace('Zertifikat <span>SCL-Programmierung</span>', 'Zertifikat <span>FUP-Programmierung</span>')
  },
  awl: {
    out: 'awl.html', title: 'AWL Quest: Das vergessene Walzwerk', short: 'AWL Quest', icon: 'AWL', color: '%23ff5a36',
    desc: 'AWL Quest – Das vergessene Walzwerk: Das Lernspiel für die Anweisungsliste (AWL) der S7-300 mit Statusanzeige (VKE, AKKU1, AKKU2) je Zeile und einem Live-Walzwerk.',
    manifestDesc: 'Lernspiel für die Anweisungsliste (AWL) der S7-300 mit Live-Walzwerk.',
    config: { id:'awl', lang:'awl', name:'AWL Quest', key:'awlquest_state_v1', oldKey:'awlquest_state_v0', viewKey:'awlquest_view', ext:'.awl',
      langLong:'Anweisungsliste (AWL)', langShort:'AWL', certPrefix:'AQ1', obf:'AWL-QUEST-ARIA-2026', titleFoot:'Echte Anweisungslisten · echte Tests · offline spielbar',
      basicText:'das alte Walzwerk im Keller Zeile für Zeile zurückerobert und ARIAs Sabotage an der S7-300 beendet hat.',
      proText:'inklusive eigener Funktionen und Funktionsbausteine in AWL, Datenbausteine und eines Walzwerksprogramms nach Standard.', finalBadge:'Befreier des Walzwerks' },
    styles: ['styles_base.css', 'styles_new.css', 'styles_awl.css'],
    scripts: [['SCL-ENGINE', 'engine.js'], ['SCL-ENGINE PRO', 'engine_pro.js'], ['AWL (Übersetzung, Status)', 'awl.js'], ['SZENE WALZWERK', 'scene_walzwerk.js']],
    content: ['content/_helpers.js', 'content_awl/_awl.js', 'content_awl/manual.js', 'content_awl/chapters.js'].concat(chFiles('content_awl'), ['content_awl/theory.js', 'content_awl/theory_pro.js', 'content_awl/bugs.js']).filter(has),
    editor: [['SCL-EDITOR (mit AWL-Hervorhebung)', 'editor.js'], ['AWL-STATUS', 'awl_editor.js']],
    body: s => s.replace(/Robotik-Trainingszentrum · Sektor 7/g, 'Walzwerk Keller 2 · S7-300').replace(/SCL QUEST <span>3<\/span>/g, 'AWL QUEST').replace(/Aufstand der Maschinen/g, 'Das vergessene Walzwerk')
      .replace(/fa-solid fa-robot/g, 'fa-solid fa-industry').replace('Das SCL-Lernspiel für Siemens-Steuerungen', 'Das AWL-Lernspiel für die S7-300')
      .replace('Live-Anlage in 2D &amp; 3D', 'Walzwerk live').replace('Echter SCL-Code · echte Tests', 'Echte Anweisungslisten · echte Tests')
      .replace('aria-label="SCL-Code-Editor" placeholder="// Schreibe hier deinen SCL-Code …"', 'aria-label="AWL-Editor" placeholder="// Schreibe hier deine Anweisungsliste …"')
      .replace('SCL Quest 3 · Version', 'AWL Quest · Version').replace('Zertifikat <span>SCL-Programmierung</span>', 'Zertifikat <span>AWL-Programmierung</span>')
  }
};

function gameHtml(key){
  const q = QUESTS[key];
  let html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${q.desc}">
<meta name="theme-color" content="#121212">
<title>${q.title}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23121212'/%3E%3Ctext x='32' y='42' font-size='24' font-family='monospace' font-weight='700' text-anchor='middle' fill='${q.color}'%3E${q.icon}%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
${ICON_CSS}
<style>
${q.styles.map(R).join('\n')}
</style>
</head>
<body${key !== 'scl' ? ' class="quest-' + key + '"' : ''}>
${q.config ? '<script>window.QUEST = ' + JSON.stringify(q.config) + ';</script>\n' : ''}${q.body(R('body.html'))}
`;
  q.scripts.forEach(s => { html += s === 'THREE' ? THREE_TAG : script(s[0], R(s[1])); });
  q.content.forEach(f => { html += script('INHALT: ' + f, R(f)); });
  q.editor.forEach(s => { html += script(s[0], R(s[1])); });
  html += script('APP (Spiel-Controller)', R('app.js'));
  html += '</body>\n</html>\n';
  return html;
}
// Inhalte im Node-Kontext laden (für Leitstand-Metadaten und Live-Challenge)
function loadContent(key){
  const q = QUESTS[key];
  const g = { window:{}, console }; g.window = g; g.globalThis = g;
  const ctx = vm.createContext(g);
  ['engine.js', 'engine_pro.js'].concat(key === 'kop' || key === 'fup' ? ['kop.js'] : key === 'awl' ? ['awl.js'] : []).forEach(f => vm.runInContext(R(f), ctx, { filename:f }));
  q.content.forEach(f => vm.runInContext(R(f), ctx, { filename:f }));
  return g;
}

const WEB = path.join(__dirname, '..', 'web');
fs.mkdirSync(path.join(WEB, 'data'), { recursive:true });
const built = {};
Object.keys(QUESTS).forEach(key => {
  const q = QUESTS[key];
  if(!has(q.content[0]) || (key !== 'scl' && !q.content.some(f => /chapters\.js$/.test(f)))){ console.log('– ' + key + ': noch keine Inhalte, übersprungen'); return; }
  const html = gameHtml(key);
  fs.writeFileSync(path.join(__dirname, '..', q.out), html);
  console.log(q.out, (html.length / 1024).toFixed(0) + ' KB', html.split('\n').length + ' Zeilen', OFFLINE ? '(offline, alles eingebettet)' : '(CDN)');
  // Portal-Version: Konto-Abgleich (window.SPSQ_PORTAL), ohne Google-Fonts (Datenschutz)
  const dir = path.join(WEB, key); fs.mkdirSync(dir, { recursive:true });
  const portalHtml = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link href="https:\/\/fonts\.googleapis\.com[^\n]*\n/, '')
    .replace(/<body([^>]*)>\n/, '<body$1>\n<script>window.SPSQ_PORTAL = true;</script>\n');
  fs.writeFileSync(path.join(dir, 'index.html'), portalHtml);
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify({
    name: q.title.replace(':', ' –'), short_name: q.short, lang:'de', start_url:'./', scope:'../', display:'standalone',
    background_color:'#121212', theme_color:'#121212', description: q.manifestDesc,
    icons:[{ src:'../icon-192.png', sizes:'192x192', type:'image/png' }, { src:'../icon-512.png', sizes:'512x512', type:'image/png' }, { src:'../icon-512.png', sizes:'512x512', type:'image/png', purpose:'maskable' }]
  }, null, 2));
  ['icon-192.png','icon-512.png'].forEach(f => { const src = path.join(__dirname, 'assets', f); if(fs.existsSync(src)){ fs.copyFileSync(src, path.join(WEB, f)); fs.copyFileSync(src, path.join(dir, f)); } });
  // Aufgaben-Metadaten (gleiche Nummerierung wie im Spiel) + Live-Challenge-Daten
  const g = loadContent(key), C = g.SCL_CONTENT; const chapters = C.chapters.slice().sort((a, b) => a.n - b.n);
  const tasks = [], theory = []; let no = 0;
  chapters.forEach(ch => {
    C.theory.filter(t => t.ch === ch.n).sort((a, b) => (a.pos === 'start' ? 0 : 1) - (b.pos === 'start' ? 0 : 1)).forEach(t => theory.push({ id:t.id, ch:ch.n, title:t.title }));
    C.tasks.filter(t => t.level === ch.n).forEach(t => tasks.push({ id:t.id, no:++no, ch:ch.n, title:t.title, pro:!!t.pro }));
  });
  const meta = JSON.stringify({ quest:key, lang: q.config ? q.config.lang : 'scl', chapters: chapters.map(c => ({ n:c.n, title:c.title, pro:!!c.pro })), tasks, theory });
  fs.writeFileSync(path.join(WEB, 'data', key + '.json'), meta);
  const refs = {};
  C.tasks.forEach(t => { refs[t.id] = t.pro ? g.ProTask.refCodes(t) : t.refSolution; });
  const bugs = (C.bugs || []).map(b => { const t = C.tasks.find(x => x.id === b.task); return { id:b.id, task:b.task, ch:t.level, title:b.title, symptom:b.symptom }; });
  fs.writeFileSync(path.join(WEB, 'data', key + '_live.json'), JSON.stringify({ refs, bugs }));
  built[key] = portalHtml + meta;
});

// ---- Portal ----
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
// Portal-Hilfsdateien, die Inhalte darstellen (KOP-Leiterbild im Leitstand)
const portalLibs = [['KOP (Modell)', 'kop.js'], ['KOP-DARSTELLUNG', 'kop_editor.js']].filter(x => has(x[1]));
const portal = portalHead('SPS Quest – Lernspiele für Steuerungstechnik', 'SPS Quest: Lernspiele für SCL, KOP, FUP und AWL mit Live-Simulation. Klassen, Konten und Live-Challenge für den Unterricht.')
  + '<script>window.SPSQ_QUESTS = ' + JSON.stringify(Object.keys(built)) + ';</script>\n'
  + P('body.html') + portalLibs.map(x => script(x[0], R(x[1]))).join('') + portalScripts.map(f => script('PORTAL: ' + f, P(f))).join('') + '</body>\n</html>\n';
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
const FILES = ['./', './index.html', './impressum.html', './datenschutz.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']
  .concat(...Object.keys(built).map(k => ['./data/' + k + '.json', './data/' + k + '_live.json', './' + k + '/', './' + k + '/index.html', './' + k + '/manifest.webmanifest']));
const ver = require('crypto').createHash('sha1').update(portal + Object.values(built).join('')).digest('hex').slice(0, 10);
const questDirs = JSON.stringify(Object.keys(built));
fs.writeFileSync(path.join(WEB, 'sw.js'), `// Service Worker: hält Portal und Spiele offline verfügbar (Cache-first, Version ${ver})
const CACHE = 'spsquest-${ver}';
const FILES = ${JSON.stringify(FILES)};
const QUESTS = ${questDirs};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(r => r || fetch(e.request).then(res => {
    if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => { const q = QUESTS.find(k => url.pathname.startsWith('/' + k + '/')); return caches.match(q ? './' + q + '/index.html' : './index.html'); })));
});
`);
console.log('web/ (Portal + ' + Object.keys(built).join(', ') + ' + PWA) aktualisiert');
