// Zertifikat rendern: Druckansicht (A4 quer → PDF) und PNG (1600×1131); QR-Codes lesbar und zeigen auf /z/<code>.
// Läuft gegen einen laufenden Worker (npx wrangler dev …) und braucht ein ausgestelltes Zertifikat:
// legt dafür selbst eine Testklasse an und schliesst eine Grundstufen-Prüfung (Referenzlösungen) ab.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = 'http://localhost:8787', RUN = Date.now().toString(36).slice(-5);
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const JSQR = path.join(__dirname, '..', 'node_modules', 'jsqr', 'dist', 'jsQR.js');
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
(async () => {
  const { Exam } = await import(path.join(__dirname, '..', '..', 'worker', 'gen', 'exam_bundle.js'));
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl.json'), 'utf8'));
  const SD = require('./seed_helper')(RUN);
  const browser = await chromium.launch();
  const c = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, extraHTTPHeaders: { 'cf-connecting-ip': '10.3.' + Math.floor(Math.random() * 250) + '.9' } });
  const p = await c.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const api = (m, u, b) => p.evaluate(([m, u, b]) => fetch('/api/' + u, { method: m, headers: { 'content-type': 'application/json', 'x-spsquest': '1' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json().then(d => ({ status: r.status, data: d }))), [m, u, b]);
  await p.goto(BASE + '/');
  await api('POST', 'login', SD.students[0]); await api('POST', 'me/notice', {});
  await api('PUT', 'progress/scl', { state: { v: 4, doneTasks: Object.fromEntries(meta.tasks.filter(t => t.ch <= 10).map(t => [t.id, { stars: 3 }])), doneTheory: {} }, summary: {}, force: true });
  const ex = (await api('POST', 'exams', { quest: 'scl', level: 'grund' })).data;
  const recover = pub => { const def = Exam.taskDef(pub.id); for(const pp of Exam.allParams(def)){ const it = Exam.instantiate(def, pp); if(JSON.stringify(Exam.publicItem(it)) === JSON.stringify(pub)) return it; } };
  for(const pub of ex.tasks){ const it = recover(pub); await api('POST', 'exams/' + ex.exam.id + '/answer', { item: it.id, answer: it.kind === 'grund' ? it.ref : Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.ref])) }); }
  for(const q of ex.questions){ const d = Exam.questionDef(q.id); await api('POST', 'exams/' + ex.exam.id + '/answer', { item: q.id, answer: q.options.indexOf(d.options[d.answer]) }); }
  await api('POST', 'exams/' + ex.exam.id + '/submit', {});
  const cert = (await api('POST', 'certificates', { examId: ex.exam.id, holderName: 'Renate Muster-Überprüfung', consent: true })).data.certificate;
  ok(cert && cert.code, 'Zertifikat für den Test ausgestellt');
  const url = BASE + '/z/' + cert.code;
  await p.goto(BASE + '/?c=1#/zertifikat/' + cert.code); await p.waitForSelector('.cert-sheet .cert-qr svg');
  await p.addScriptTag({ path: JSQR });
  const decode = dataUrl => p.evaluate(src => new Promise(res => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height); const r = window.jsQR(d.data, d.width, d.height); res(r ? r.data : null); }; img.onerror = () => res(null); img.src = src; }), dataUrl);
  // QR auf dem Bildschirm-Zertifikat
  const shot = await p.locator('.cert-sheet .cert-qr').screenshot();
  ok(await decode('data:image/png;base64,' + shot.toString('base64')) === url, 'QR auf dem Zertifikat → ' + url);
  // PNG (Download) 1600×1131
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#xcPng')]);
  const png = fs.readFileSync(await dl.path());
  fs.writeFileSync(path.join(SHOTS, 'cert.png'), png);
  ok(png.readUInt32BE(16) === 1600 && png.readUInt32BE(20) === 1131, 'PNG 1600×1131');
  ok(await decode('data:image/png;base64,' + png.toString('base64')) === url, 'QR im PNG lesbar');
  // Druckansicht → PDF (A4 quer, eine Seite)
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '@page{ size:A4 landscape; margin:0; }'; document.head.appendChild(st); document.body.classList.add('print-cert'); });
  await p.evaluate(sheet => { document.getElementById('printArea').innerHTML = sheet; }, await p.locator('.cert-wrap').innerHTML());
  await p.emulateMedia({ media: 'print' });
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(SHOTS, 'cert.pdf'), pdf);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pdf.length > 5000 && pages === 1, 'PDF: eine Seite (' + pages + '), ' + Math.round(pdf.length / 1024) + ' KB');
  const box = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  ok(box && +box[1] > +box[2] && Math.abs(+box[1] - 841.9) < 3, 'PDF im Querformat A4 (' + (box ? box[1] + '×' + box[2] : '?') + ')');
  await p.emulateMedia({ media: 'screen' });
  await p.screenshot({ path: path.join(SHOTS, 'cert_print_preview.png') });
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('Zertifikat-Rendering: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
