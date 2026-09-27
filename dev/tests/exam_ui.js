// Prüfungsmodus + Zertifikat im Browser gegen einen laufenden Worker (npx wrangler dev -c ../wrangler.jsonc --local)
// Je Quest: Grundstufe mit Referenzlösungen → bestanden → Zertifikat ausstellen → Prüfseite gültig;
// Profi-Stufe absichtlich falsch → nicht bestanden. Dazu Handy 390 px.
// Aufruf: node tests/exam_ui.js [quest …]   (Standard: scl kop fup awl) — lokale .dev.vars mit EXAM_DEV=1, solange die Pools im Aufbau sind
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = 'http://localhost:8787';
const QS = process.argv.slice(2).filter(a => ['scl', 'kop', 'fup', 'awl'].includes(a));
const QUESTS = QS.length ? QS : ['scl', 'kop', 'fup', 'awl'];
const RUN = Date.now().toString(36).slice(-5);
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };

(async () => {
  const { Exam } = await import(path.join(__dirname, '..', '..', 'worker', 'gen', 'exam_bundle.js'));
  const meta = q => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', q + '.json'), 'utf8'));
  const recover = pub => { const def = Exam.taskDef(pub.id); for(const p of Exam.allParams(def)){ const it = Exam.instantiate(def, p); if(JSON.stringify(Exam.publicItem(it)) === JSON.stringify(pub)) return it; } return null; };
  const done = (q, a, b) => Object.fromEntries(meta(q).tasks.filter(t => t.ch >= a && t.ch <= b).map(t => [t.id, { stars: 3, points: 100 }]));
  const SD = require('./seed_helper')(RUN);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const errors = [];
  async function ctx(vp, ip){
    const c = await browser.newContext({ viewport: vp || { width: 1366, height: 860 }, extraHTTPHeaders: { 'cf-connecting-ip': ip || ('10.4.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250)) } });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    p.on('console', m => { if(m.type() === 'error' && !/fonts\.g|net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
    p.on('dialog', d => d.accept());
    return p;
  }
  const api = (p, method, url, body) => p.evaluate(([m, u, b]) => fetch('/api/' + u, { method: m, headers: { 'content-type': 'application/json', 'x-spsquest': '1' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json().then(d => ({ status: r.status, data: d }))), [method, url, body]);
  const P = await ctx();
  await P.goto(BASE + '/');
  ok((await api(P, 'POST', 'login', SD.students[0])).status === 200, 'Lernende/r angemeldet');
  await api(P, 'POST', 'me/notice', {}); await P.reload();

  for(const q of QUESTS){
    await api(P, 'PUT', 'progress/' + q, { state: { v: 4, doneTasks: Object.assign(done(q, 1, 10), done(q, 11, 15)), doneTheory: {} }, summary: {}, force: true });
    // Portal: Zertifikatsseite → Prüfung starten
    await P.goto(BASE + '/#/zertifikate/' + q);
    await P.waitForSelector('[data-start="' + q + ':grund"]', { timeout: 10000 });
    await P.click('[data-start="' + q + ':grund"]');
    await P.waitForSelector('#dlgOverlay:not([hidden])');
    await P.check('#xsConfirm'); await P.click('#dlgActions button:has-text("Prüfung starten")');
    await P.waitForURL(new RegExp('/' + q + '/\\?exam=\\d+'), { timeout: 15000 });
    const eid = +new URL(P.url()).searchParams.get('exam');
    await P.waitForSelector('#examBar .eb-item', { timeout: 20000 });
    ok(true, q + ': Prüfungsmodus geöffnet (Prüfung ' + eid + ')');
    ok(await P.evaluate(() => getComputedStyle(document.getElementById('hintBtn')).display === 'none' && getComputedStyle(document.getElementById('openMapBtn')).display === 'none'), q + ': Hinweise und Karte ausgeblendet');
    const d = (await api(P, 'GET', 'exams/' + eid)).data;
    const items = d.tasks.map(recover);
    for(let i = 0; i < items.length; i++){
      const it = items[i];
      await P.click('#examBar .eb-item[data-i="' + i + '"]');
      await P.waitForFunction(n => (document.getElementById('taskIdLabel').textContent || '').includes('PRÜFUNGSAUFGABE ' + n), i + 1);
      if(it.kind === 'grund') await P.evaluate(code => { SCLQuest.editor.setValue(code); }, it.ref);
      else await P.evaluate(codes => { SCLQuest.setProCodes(codes); }, Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.ref])));
      if(i === 0){
        await P.click('#compileBtn');
        await P.waitForFunction(() => /Beispiel-Tests/.test(document.getElementById('radioLog').textContent), null, { timeout: 15000 }).catch(() => null);
        ok(await P.evaluate(() => /Beispiel-Tests/.test(document.getElementById('radioLog').textContent) && document.getElementById('successCard').style.display === 'none'), q + ': lokal testen mit Beispiel-Tests, keine Erfolgskarte');
      }
      await P.click('#examSend');
      await P.waitForSelector('#examResult.ok', { timeout: 15000 }).catch(() => null);
      ok(await P.locator('#examResult.ok').count() === 1, q + ': Abgabe ' + (i + 1) + ' bestanden (' + it.id + ')');
    }
    // Theorie
    await P.click('#examBar .eb-th');
    await P.waitForSelector('#examTheory .exam-q');
    for(const pq of d.questions){
      const def = Exam.questionDef(pq.id), right = pq.options.indexOf(def.options[def.answer]);
      await P.check('input[data-q="' + pq.id + '"][value="' + right + '"]');
    }
    await P.waitForFunction(n => (document.querySelector('#examBar .eb-th') || {}).textContent === 'Theorie ' + n + '/' + n, d.questions.length);
    await P.screenshot({ path: SHOTS + '/exam_' + q + '_theorie.png' });
    await P.click('#examTheoryBack');
    await P.click('#examFinish'); await P.waitForSelector('#confirmModal.active'); await P.click('#confirmYes');
    await P.waitForSelector('#examOverlay .exam-sum', { timeout: 20000 });
    ok(/Bestanden/.test(await P.textContent('#examOverlay h2')), q + ': Prüfung bestanden');
    await P.screenshot({ path: SHOTS + '/exam_' + q + '_ergebnis.png' });
    // Zertifikat ausstellen
    await P.click('#examOverlay a:has-text("Zertifikat ausstellen")');
    await P.waitForSelector('#xcName');
    await P.fill('#xcName', 'Test Person ' + q.toUpperCase());
    ok((await P.textContent('.cert-preview')).includes('Test Person'), q + ': Namensvorschau live');
    await P.click('#xcIssue'); ok(true, q + ': Einwilligung fehlt → Hinweis');
    await P.check('#xcConsent'); await P.click('#xcIssue');
    await P.waitForSelector('.cert-sheet .cert-code', { timeout: 10000 });
    const code = (await P.textContent('.cert-sheet .cert-code')).trim();
    ok(/^SPSQ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), q + ': Zertifikat ' + code);
    ok(await P.locator('.cert-sheet .cert-qr svg, .cert-sheet .cert-qr img, .cert-sheet .cert-qr canvas').count() === 1, q + ': QR-Code auf dem Zertifikat');
    ok(/linkedin\.com\/profile\/add\?startTask=CERTIFICATION_NAME/.test(await P.getAttribute('#xcLinkedIn', 'href')), q + ': LinkedIn-Link');
    await P.screenshot({ path: SHOTS + '/exam_' + q + '_zertifikat.png' });
    const V = await ctx();
    await V.goto(BASE + '/z/' + code);
    ok(/Zertifikat gültig/.test(await V.textContent('h1')) && (await V.textContent('main')).includes('Test Person'), q + ': Prüfseite gültig');
    await V.context().close();
    // Profi absichtlich falsch (leer abgeben)
    await P.goto(BASE + '/#/zertifikate/' + q);
    await P.waitForSelector('[data-start="' + q + ':profi"]');
    await P.click('[data-start="' + q + ':profi"]'); await P.waitForSelector('#dlgOverlay:not([hidden])');
    await P.check('#xsConfirm'); await P.click('#dlgActions button:has-text("Prüfung starten")');
    await P.waitForSelector('#examBar .eb-item', { timeout: 20000 });
    await P.click('#examFinish'); await P.waitForSelector('#confirmModal.active'); await P.click('#confirmYes');
    await P.waitForSelector('#examOverlay .exam-sum', { timeout: 20000 });
    ok(/Nicht bestanden/.test(await P.textContent('#examOverlay h2')) && await P.locator('#examOverlay .exam-weak').count() === 1, q + ': Profi falsch → nicht bestanden mit Hinweisen');
  }
  // Meine Zertifikate
  await P.goto(BASE + '/#/zertifikate');
  await P.waitForSelector('.cert-list .cert-row');
  ok(await P.locator('.cert-list .cert-row').count() >= QUESTS.length, 'Meine Zertifikate: ' + QUESTS.length);
  // Handy 390 px
  const M = await ctx({ width: 390, height: 844 });
  await M.goto(BASE + '/'); await api(M, 'POST', 'login', SD.students[1]); await api(M, 'POST', 'me/notice', {}); await M.reload();
  const q = QUESTS[0];
  await api(M, 'PUT', 'progress/' + q, { state: { v: 4, doneTasks: done(q, 1, 10), doneTheory: {} }, summary: {}, force: true });
  await M.goto(BASE + '/#/zertifikate/' + q); await M.waitForSelector('[data-start="' + q + ':grund"]');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= 390), 'Handy: Zertifikatsseite ohne waagrechtes Scrollen');
  await M.screenshot({ path: SHOTS + '/exam_mobile_portal.png' });
  await M.click('[data-start="' + q + ':grund"]'); await M.waitForSelector('#dlgOverlay:not([hidden])'); await M.check('#xsConfirm'); await M.click('#dlgActions button:has-text("Prüfung starten")');
  await M.waitForSelector('#examBar .eb-item', { timeout: 20000 });
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= 390), 'Handy: Prüfung ohne waagrechtes Scrollen');
  await M.screenshot({ path: SHOTS + '/exam_mobile.png' });
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  await browser.close();
  console.log('Prüfungs-UI: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
