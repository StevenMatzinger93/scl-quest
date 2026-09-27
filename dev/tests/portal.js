// Portal-Durchlauf im Browser gegen einen laufenden Worker (npx wrangler dev -c ../wrangler.jsonc --local)
// Admin → Dozent → Klasse → Konten → Selbstanmeldung → Spielstand-Abgleich → Leitstand → Abmelden
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive:true });
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
async function ctx(browser, vp){
  // eigene "IP" je Kontext (lokal wertet der Worker cf-connecting-ip aus), damit der Spam-Schutz der Meldungen Testläufe nicht bremst
  const c = await browser.newContext({ viewport: vp || { width:1366, height:860 }, extraHTTPHeaders: { 'cf-connecting-ip': '10.7.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) } });
  const p = await c.newPage(); const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  p.on('console', m => { if(m.type() === 'error' && !/fonts\.g|net::ERR_FAILED/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  return { c, p, errors };
}
async function termLogin(p, u, pw){
  await p.click('#loginBtn'); await p.fill('#lgUser', u); await p.fill('#lgPw', pw); await p.click('#loginForm .term-go');
  await p.waitForSelector('#termOverlay', { state:'hidden' });
}
async function poll(p, fn, ms){ const end = Date.now() + (ms || 10000); while(Date.now() < end){ if(await p.evaluate(fn)) return true; await new Promise(r => setTimeout(r, 400)); } return false; }
async function dlgClick(p, label){ await p.waitForSelector('#dlgOverlay:not([hidden])'); await p.click('#dlgActions button:has-text("' + label + '")'); }
(async () => {
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const all = [];
  // 1) Admin legt Dozent an
  const A = await ctx(browser); all.push(A);
  await A.p.goto(BASE + '/'); await A.p.waitForSelector('.gate');
  ok(await A.p.locator('.gate').count() === 5, '5 Tore (inkl. Sensorwerkstatt)');
  await termLogin(A.p, vars.ADMIN_USER, vars.ADMIN_PASSWORD);
  await A.p.waitForSelector('#newT');
  ok(A.p.url().endsWith('#/admin'), 'Admin landet in Administration');
  await A.p.fill('#ntName', 'lehrer_' + RUN); await A.p.click('#newT button');
  await A.p.waitForSelector('#dlgOverlay:not([hidden]) .creds');
  const tPw = (await A.p.textContent('.creds b')).trim();
  ok(tPw.length >= 8, 'Startpasswort angezeigt');
  await dlgClick(A.p, 'OK');
  await A.p.waitForSelector('#tList td:has-text("lehrer_' + RUN + '")');
  await A.p.screenshot({ path: SHOTS + '/portal_admin.png' });
  // 2) Dozent: Passwort ändern, Klasse, Konten
  const T = await ctx(browser); all.push(T);
  await T.p.goto(BASE + '/#/login'); await T.p.waitForSelector('#lgUser');
  await T.p.fill('#lgUser', 'lehrer_' + RUN); await T.p.fill('#lgPw', tPw); await T.p.click('#loginForm .term-go');
  await T.p.waitForSelector('#fpNew'); await T.p.fill('#fpNew', 'lehrer-passwort'); await T.p.fill('#fpNew2', 'lehrer-passwort'); await dlgClick(T.p, 'Speichern');
  await T.p.waitForSelector('#newClass');
  ok(T.p.url().endsWith('#/leitstand'), 'Dozent landet im Leitstand');
  await T.p.fill('#ncName', 'EM 3a'); await T.p.click('#newClass button');
  await T.p.waitForSelector('#clsCode');
  const code = (await T.p.textContent('#clsCode')).trim();
  ok(/^[A-Z0-9]{6}$/.test(code), 'Klassencode ' + code);
  await T.p.fill('#genPrefix', 'k' + RUN + '_'); await T.p.fill('#genCount', '3'); await T.p.click('#genForm button.pri');
  await T.p.waitForSelector('#dlgOverlay:not([hidden]) .creds');
  const creds = await T.p.$$eval('.creds div', ds => ds.map(d => ({ u: d.querySelector('span').textContent, pw: d.querySelector('b').textContent })));
  ok(creds.length === 3, '3 Konten erzeugt');
  await dlgClick(T.p, 'Fertig');
  await T.p.waitForSelector('td a:has-text("k' + RUN + '_03")');
  // 3) Selbstanmeldung mit Klassencode, Hinweis, Spiel mit Konto
  const S = await ctx(browser); all.push(S);
  await S.p.goto(BASE + '/#/code/' + code); await S.p.waitForSelector('#rgUser');
  await S.p.waitForSelector('#rgClass:has-text("EM 3a")');
  ok(true, 'Klassencode erkannt');
  await S.p.fill('#rgUser', 'Fuchs' + RUN); await S.p.fill('#rgPw', 'fuchs-pw'); await S.p.fill('#rgPw2', 'fuchs-pw'); await S.p.click('#codeForm .term-go');
  await S.p.waitForSelector('#dlgOverlay:not([hidden]) .notice');
  ok((await S.p.textContent('#dlgBody')).includes('Programmcode'), 'Hinweis: Dozent sieht Code');
  await dlgClick(S.p, 'Verstanden');
  await S.p.click('.gate[data-q=scl]');
  await S.p.waitForSelector('#acctChip.on', { state:'attached' });
  ok((await S.p.textContent('#acctChip')).includes('Fuchs' + RUN), 'Spiel zeigt Konto');
  // Aufgabe als gelöst eintragen und speichern → Abgleich
  await S.p.evaluate(() => SCLQuest.ACCT.ready);
  await S.p.evaluate(() => { const st = SCLQuest.state; st.doneTasks.r1t1 = { stars:3, points:100, fails:0, hints:0, at:Date.now() }; st.solutions.r1t1 = 'Lampe := TRUE;'; st.drafts.c1_arm = 'Motor := '; st.name = 'Echter Name'; });
  await S.p.evaluate(() => { SCLQuest.ACCT.changed(); return SCLQuest.ACCT.push(); });
  await poll(S.p, () => fetch('/api/progress/scl').then(r => r.json()).then(d => !!(d.state && d.state.doneTasks.r1t1)));
  const srv = await S.p.evaluate(() => fetch('/api/progress/scl').then(r => r.json()));
  if(!srv.state || !srv.state.solutions.r1t1) console.log('srv', JSON.stringify(srv).slice(0, 400));
  ok(srv.state && srv.state.doneTasks.r1t1 && !srv.state.name, 'Spielstand im Konto (ohne Namen)');
  // 4) Dozent sieht Fortschritt und Code
  await T.p.reload(); await T.p.waitForSelector('td a:has-text("Fuchs' + RUN + '")');
  const row = await T.p.textContent('tr:has(a:has-text("Fuchs' + RUN + '"))');
  ok(/Kapitel/.test(row), 'Klassenliste zeigt Stand: ' + row.replace(/\s+/g, ' '));
  await T.p.screenshot({ path: SHOTS + '/portal_class.png', fullPage:true });
  await T.p.click('td a:has-text("Fuchs' + RUN + '")');
  await T.p.waitForSelector('.cells .cell.s3');
  await T.p.click('.cells .cell.s3'); await T.p.waitForSelector('pre.code', { timeout:5000 }).catch(async () => { await T.p.screenshot({ path: SHOTS + '/dbg.png' }); console.log(await T.p.evaluate(() => document.querySelector('.cells .cell.s3').outerHTML + ' ' + document.getElementById('dlgOverlay').hidden)); });
  ok((await T.p.textContent('pre.code')).includes('Lampe := TRUE;'), 'Dozent sieht Lösung');
  await dlgClick(T.p, 'Schliessen');
  await T.p.click('.cells .cell.draft'); await T.p.waitForSelector('pre.code');
  ok((await T.p.textContent('#dlgBody')).includes('Entwurf'), 'Dozent sieht Entwurf');
  await T.p.screenshot({ path: SHOTS + '/portal_student.png' });
  await dlgClick(T.p, 'Schliessen');
  // 4a) Anleitungen auf der Titelseite
  await S.p.goto(BASE + '/'); await S.p.waitForSelector('.man-card');
  ok(await S.p.locator('.man-card').count() === 3, 'Titelseite: drei Anleitungen (Lernende, Dozenten, Admin)');
  for(const t of ['lernende', 'dozenten', 'admin']){ await S.p.goto(BASE + '/#/anleitung/' + t); await S.p.waitForSelector('.man-step'); }
  ok((await S.p.textContent('.man h1')).includes('Admin') && await S.p.locator('.man-step').count() >= 4, 'Anleitung Admin wird angezeigt');
  // 4b) KOP Quest: Tor offen, Konto im Spiel, Dozent sieht Lösung als Leiterbild
  await S.p.goto(BASE + '/'); await S.p.waitForSelector('.gate[data-q=kop].open');
  await S.p.click('.gate[data-q=kop]');
  await S.p.waitForSelector('#acctChip.on', { state:'attached' });
  await S.p.evaluate(() => SCLQuest.ACCT.ready);
  ok(await S.p.evaluate(() => window.QUEST && window.QUEST.id === 'kop'), 'KOP-Spiel geöffnet');
  await S.p.evaluate(() => { const st = SCLQuest.state; st.doneTasks.k1_licht = { stars:3, points:100, fails:0, hints:0, at:Date.now() }; st.solutions.k1_licht = 'NETWORK Beleuchtung\nS_Licht => Beleuchtung;\n'; });
  await S.p.evaluate(() => { SCLQuest.ACCT.changed(); return SCLQuest.ACCT.push(); });
  ok(await poll(S.p, () => fetch('/api/progress/kop').then(r => r.json()).then(d => !!(d.state && d.state.doneTasks.k1_licht))), 'KOP-Spielstand im Konto');
  const scl2 = await S.p.evaluate(() => fetch('/api/progress/scl').then(r => r.json()));
  ok(scl2.state && scl2.state.doneTasks.r1t1 && !scl2.state.doneTasks.k1_licht, 'SCL- und KOP-Stand getrennt');
  await T.p.waitForSelector('[data-lq=kop]'); await T.p.click('[data-lq=kop]');
  await T.p.waitForSelector('.lead:has-text("KOP Quest")');
  await T.p.waitForSelector('.cells .cell.s3'); await T.p.click('.cells .cell.s3');
  await T.p.waitForSelector('#dlgBody svg.kop-svg', { timeout:5000 }).catch(() => null);
  ok(await T.p.locator('#dlgBody svg.kop-svg').count() === 1, 'Dozent sieht KOP-Lösung als Leiterbild');
  await T.p.screenshot({ path: SHOTS + '/portal_student_kop.png' });
  await dlgClick(T.p, 'Schliessen');
  // 4c) FUP Quest: Tor offen, eigener Spielstand, Dozent sieht Lösung als Funktionsplan (auch Profi-Bausteine)
  await S.p.goto(BASE + '/'); await S.p.waitForSelector('.gate[data-q=fup].open');
  await S.p.click('.gate[data-q=fup]');
  await S.p.waitForSelector('#acctChip.on', { state:'attached' });
  await S.p.evaluate(() => SCLQuest.ACCT.ready);
  ok(await S.p.evaluate(() => window.QUEST && window.QUEST.id === 'fup'), 'FUP-Spiel geöffnet');
  await S.p.evaluate(() => { const st = SCLQuest.state; st.doneTasks.f1_signal = { stars:3, points:100, fails:0, hints:0, at:Date.now() }; st.solutions.f1_signal = 'NETWORK Signal A\nTaste_A => Signal_A;\n';
    st.doneTasks.fp11_erste_fc = { stars:2, points:80, fails:1, hints:0, at:Date.now() }; st.solutions.fp11_erste_fc = ProTask.refCodes(SCLQuest.TASKS.find(t => t.id === 'fp11_erste_fc')); });
  await S.p.evaluate(() => { SCLQuest.ACCT.changed(); return SCLQuest.ACCT.push(); });
  ok(await poll(S.p, () => fetch('/api/progress/fup').then(r => r.json()).then(d => !!(d.state && d.state.doneTasks.f1_signal))), 'FUP-Spielstand im Konto');
  const kop2 = await S.p.evaluate(() => fetch('/api/progress/kop').then(r => r.json()));
  ok(kop2.state && kop2.state.doneTasks.k1_licht && !kop2.state.doneTasks.f1_signal, 'KOP- und FUP-Stand getrennt');
  await T.p.click('[data-lq=fup]');
  await T.p.waitForSelector('.lead:has-text("FUP Quest")');
  await T.p.waitForSelector('.cells .cell.s3'); await T.p.click('.cells .cell.s3');
  await T.p.waitForSelector('#dlgBody svg.fup-svg', { timeout:5000 }).catch(() => null);
  ok(await T.p.locator('#dlgBody svg.fup-svg').count() === 1, 'Dozent sieht FUP-Lösung als Funktionsplan');
  await T.p.screenshot({ path: SHOTS + '/portal_student_fup.png' });
  await dlgClick(T.p, 'Schliessen');
  await T.p.click('.cells .cell.s2:not(.th)'); await T.p.waitForSelector('#dlgBody svg.fup-svg', { timeout:5000 }).catch(() => null);
  ok(await T.p.locator('#dlgBody svg.fup-svg').count() >= 1 && (await T.p.textContent('#dlgBody h4')) === 'FC_Signal', 'Profi-Lösung: Baustein als Funktionsplan');
  await T.p.screenshot({ path: SHOTS + '/portal_student_fup_pro.png' });
  await dlgClick(T.p, 'Schliessen');
  // 4d) AWL Quest: Tor offen, eigener Spielstand, Dozent sieht AWL-Lösung als Text
  await S.p.goto(BASE + '/'); await S.p.waitForSelector('.gate[data-q=awl].open');
  await S.p.click('.gate[data-q=awl]');
  await S.p.waitForSelector('#acctChip.on', { state:'attached' });
  await S.p.evaluate(() => SCLQuest.ACCT.ready);
  ok(await S.p.evaluate(() => window.QUEST && window.QUEST.id === 'awl'), 'AWL-Spiel geöffnet');
  await S.p.evaluate(() => { const st = SCLQuest.state; st.doneTasks.a1_rollgang = { stars:3, points:100, fails:0, hints:0, at:Date.now() }; st.solutions.a1_rollgang = 'U  S_Rollgang\n=  Rollgang'; });
  await S.p.evaluate(() => { SCLQuest.ACCT.changed(); return SCLQuest.ACCT.push(); });
  ok(await poll(S.p, () => fetch('/api/progress/awl').then(r => r.json()).then(d => !!(d.state && d.state.doneTasks.a1_rollgang))), 'AWL-Spielstand im Konto');
  await T.p.click('[data-lq=awl]');
  await T.p.waitForSelector('.lead:has-text("AWL Quest")');
  await T.p.waitForSelector('.cells .cell.s3'); await T.p.click('.cells .cell.s3');
  await T.p.waitForSelector('#dlgBody pre.code', { timeout:5000 }).catch(() => null);
  ok((await T.p.textContent('#dlgBody')).includes('S_Rollgang'), 'Dozent sieht AWL-Lösung');
  await dlgClick(T.p, 'Schliessen');
  // 4e) Sensorwerkstatt: Tor offen, Spielstand im Konto, Dozent sieht die Verdrahtung als Bild
  await S.p.goto(BASE + '/'); await S.p.waitForSelector('.gate[data-q=sensor].open');
  await S.p.click('.gate[data-q=sensor]');
  await S.p.waitForSelector('#acctChip.on', { state:'attached' });
  await S.p.evaluate(() => SCLQuest.ACCT.ready);
  ok(await S.p.evaluate(() => window.QUEST && window.QUEST.id === 'sensor'), 'Sensorwerkstatt geöffnet');
  await S.p.evaluate(() => { const st = SCLQuest.state; st.doneTasks.w1_b1_anschliessen = { stars:3, points:100, fails:0, hints:0, at:Date.now() }; st.solutions.w1_b1_anschliessen = 'Montage -B1: 4.0 mm, fest\nAder B1:BN → X2:5.L+\nAder B1:BU → X2:5.M\nAder B1:BK → X2:5.S'; });
  await S.p.evaluate(() => { SCLQuest.ACCT.changed(); return SCLQuest.ACCT.push(); });
  ok(await poll(S.p, () => fetch('/api/progress/sensor').then(r => r.json()).then(d => !!(d.state && d.state.doneTasks.w1_b1_anschliessen))), 'Werkstatt-Spielstand im Konto');
  await T.p.click('[data-lq=sensor]');
  await T.p.waitForSelector('.lead:has-text("Sensorwerkstatt")');
  await T.p.waitForSelector('.cells .cell.s3'); await T.p.click('.cells .cell.s3');
  await T.p.waitForSelector('#dlgBody svg.wire-pic', { timeout:5000 }).catch(() => null);
  ok(await T.p.locator('#dlgBody svg.wire-pic path').count() === 3 && (await T.p.textContent('#dlgBody')).includes('X2:5.L+'), 'Dozent sieht die Verdrahtung als Bild');
  await T.p.screenshot({ path: SHOTS + '/portal_teacher_sensor.png' });
  await dlgClick(T.p, 'Schliessen');
  await T.p.click('[data-lq=scl]'); await T.p.waitForSelector('.lead:has-text("SCL Quest")');
  // 5) Erster Login mit lokalem Spielstand → Übernahme auf Nachfrage
  const L = await ctx(browser); all.push(L);
  await L.p.goto(BASE + '/scl/'); await L.p.waitForSelector('#newGameBtn');
  await L.p.evaluate(() => { localStorage.setItem('sclquest3_state_v4', JSON.stringify({ v:4, pos:3, doneTasks:{ r1t1:{stars:2, points:60}, c1_arm:{stars:3, points:100} }, doneTheory:{}, solutions:{ c1_arm:'x := 1;' }, badges:[], seenIntro:[1] })); });
  await L.p.goto(BASE + '/#/login'); await L.p.waitForSelector('#lgUser');
  await L.p.fill('#lgUser', creds[0].u); await L.p.fill('#lgPw', creds[0].pw); await L.p.click('#loginForm .term-go');
  await L.p.waitForSelector('#fpNew'); await L.p.fill('#fpNew', 'mein-pw-1'); await L.p.fill('#fpNew2', 'mein-pw-1'); await dlgClick(L.p, 'Speichern');
  await dlgClick(L.p, 'Verstanden');
  await L.p.goto(BASE + '/scl/');
  await L.p.waitForSelector('#confirmModal.active');
  ok((await L.p.textContent('#confirmText')).includes('übernommen'), 'Nachfrage Übernahme');
  await L.p.click('#confirmYes');
  await poll(L.p, () => fetch('/api/progress/scl').then(r => r.json()).then(d => !!(d.state && Object.keys(d.state.doneTasks).length === 2)));
  const srv2 = await L.p.evaluate(() => fetch('/api/progress/scl').then(r => r.json()));
  ok(srv2.state && Object.keys(srv2.state.doneTasks).length === 2, 'lokaler Stand übernommen');
  // 6) Abmelden entfernt den Spielstand aus dem Browser, erneuter Login holt ihn zurück
  await L.p.goto(BASE + '/'); await L.p.waitForSelector('#userBtn');
  await L.p.click('#userBtn'); await L.p.click('#logoutBtn');
  await L.p.waitForSelector('#loginBtn:not([hidden])');
  const local = await L.p.evaluate(() => JSON.parse(localStorage.getItem('sclquest3_state_v4') || '{}'));
  ok(!local.doneTasks || !Object.keys(local.doneTasks).length, 'lokaler Stand nach Abmelden entfernt');
  await termLogin(L.p, creds[0].u, 'mein-pw-1');
  await L.p.goto(BASE + '/scl/'); await L.p.waitForSelector('#acctChip.on', { state:'attached' }); await L.p.evaluate(() => SCLQuest.ACCT.ready);
  await L.p.waitForFunction(() => Object.keys(SCLQuest.state.doneTasks).length === 2, null, { timeout:8000 }).catch(() => null);
  ok(await L.p.evaluate(() => Object.keys(SCLQuest.state.doneTasks).length) === 2, 'Stand nach erneutem Login zurück');
  // 7) Anderes Konto auf demselben Browser mischt nicht
  await L.p.goto(BASE + '/'); await L.p.waitForSelector('#userBtn'); await L.p.click('#userBtn'); await L.p.click('#logoutBtn'); await L.p.waitForSelector('#loginBtn:not([hidden])');
  await termLogin(L.p, 'Fuchs' + RUN, 'fuchs-pw');
  await L.p.goto(BASE + '/scl/'); await L.p.waitForSelector('#acctChip.on', { state:'attached' });
  await L.p.waitForFunction(() => SCLQuest.state.doneTasks.r1t1 && !SCLQuest.state.doneTasks.c1_arm, null, { timeout:8000 }).catch(() => null);
  ok(await L.p.evaluate(() => !!SCLQuest.state.doneTasks.r1t1 && !SCLQuest.state.doneTasks.c1_arm), 'zweites Konto bekommt eigenen Stand');
  // 8) Passwort-Reset durch Dozent
  await T.p.goto(BASE + '/#/leitstand'); await T.p.click('.ccard'); await T.p.waitForSelector('[data-reset]');
  await T.p.click('tr:has(a:has-text("' + creds[1].u + '")) [data-reset]'); await dlgClick(T.p, 'Zurücksetzen');
  await T.p.waitForSelector('#dlgOverlay:not([hidden]) .creds'); ok(true, 'Reset zeigt neues Passwort'); await dlgClick(T.p, 'OK');
  // Feedback-Formular (Schüler) und Auswertung (Dozent)
  await L.p.goto(BASE + '/#/feedback'); await L.p.waitForSelector('#fbForm');
  await L.p.click('label:has(input[name=verstaendlich][value="4"])'); await L.p.click('label:has(input[name=niveau][value="passend"])');
  await L.p.fill('#fb_gut', 'Die Live-Anlage'); await L.p.click('#fbForm button.pri');
  await L.p.waitForSelector('.fb-thanks');
  ok(true, 'Feedback gesendet');
  await T.p.goto(BASE + '/#/leitstand'); await T.p.click('.ccard'); await T.p.waitForSelector('#fbPanel .fb-texts');
  ok((await T.p.textContent('#fbPanel')).includes('Die Live-Anlage'), 'Dozent sieht Feedback');
  // 8b) Knopf „Feedback / Fehler melden“: Portal und alle vier Quests, auch ohne Login
  const R = await ctx(browser); all.push(R);
  const tag = 'Knopf-' + RUN;
  async function report(p, type, text){
    await p.waitForSelector('#spsqRpBtn', { state:'visible' }); await p.click('#spsqRpBtn');
    await p.waitForSelector('#spsqRp:not([hidden])');
    await p.click('#spsqRp .rp-send'); await p.waitForSelector('#spsqRpMsg:has-text("Text")');
    await p.check('#spsqRp input[value=' + type + ']'); await p.fill('#spsqRpText', text); await p.click('#spsqRp .rp-send');
    await p.waitForSelector('#spsqRpDone:not([hidden])'); await p.waitForSelector('#spsqRp', { state:'hidden', timeout:5000 });
    return p.evaluate(() => document.getElementById('spsqRpText').value === '');
  }
  await R.p.goto(BASE + '/'); await R.p.waitForSelector('.gate');
  ok(await report(R.p, 'feedback', tag + ' Startseite'), 'Knopf auf der Startseite (ohne Login), Formular geleert');
  for(const q of ['scl', 'kop', 'fup', 'awl']){
    await R.p.goto(BASE + '/' + q + '/'); await R.p.waitForSelector('#newGameBtn');
    if(q === 'awl'){ await R.p.click('#newGameBtn'); await R.p.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; const t = SCLQuest.TASKS[0]; SCLQuest.renderTask(t); }); }
    ok(await report(R.p, q === 'awl' ? 'fehler' : 'feedback', tag + ' ' + q), 'Knopf in ' + q.toUpperCase() + ' Quest');
  }
  const stv = await ctx(browser); all.push(stv);
  const SD = require('./seed_helper')(RUN);
  await stv.p.goto(BASE + '/'); await termLogin(stv.p, SD.admin.username, SD.admin.password);
  await stv.p.waitForSelector('#newT'); ok(stv.p.url().endsWith('#/admin'), 'Seed-Admin: Administration');
  ok(await stv.p.locator('#topnav a[href="#/leitstand"]').count() === 1, 'Seed-Admin: Leitstand im Menü');
  await stv.p.goto(BASE + '/#/leitstand'); await stv.p.waitForSelector('.ccard:has-text("' + SD.class.name + '")');
  ok((await stv.p.textContent('.ccard:has-text("' + SD.class.name + '")')).includes('3 Konten'), 'Seed-Admin: Testklasse mit 3 Konten');
  ok(await report(stv.p, 'feedback', tag + ' Leitstand'), 'Knopf im Leitstand');
  await stv.p.goto(BASE + '/#/meldungen'); await stv.p.waitForSelector('.rp-item');
  const items = await stv.p.$$eval('.rp-item', els => els.map(e => e.textContent));
  ok(items.filter(t => t.includes(tag)).length === 6, 'Meldungen: alle 6 Einträge sichtbar');
  const awlItem = items.find(t => t.includes(tag + ' awl')) || '';
  ok(/Fehler/.test(awlItem) && /AWL Quest/.test(awlItem) && /Aufgabe 1 /.test(awlItem) && /ohne Anmeldung/.test(awlItem), 'Meldung mit Kontext: ' + awlItem.slice(0, 160));
  ok((items.find(t => t.includes(tag + ' Leitstand')) || '').includes(SD.admin.username), 'Meldung mit Benutzername');
  await stv.p.click('[data-ft=fehler]'); await stv.p.waitForSelector('[data-ft=fehler].pri');
  await stv.p.waitForSelector('.rp-item');
  ok((await stv.p.$$eval('.rp-item .pill.warn', e => e.length)) === await stv.p.locator('.rp-item').count(), 'Filter Fehler');
  await stv.p.screenshot({ path: SHOTS + '/portal_meldungen.png' });
  // 9) Handy-Ansicht Leitstand
  const M = await ctx(browser, { width:390, height:844 }); all.push(M);
  await M.p.goto(BASE + '/'); await termLogin(M.p, 'lehrer_' + RUN, 'lehrer-passwort');
  await M.p.waitForSelector('.ccard'); await M.p.click('.ccard'); await M.p.waitForSelector('#clsCode');
  const overflow = await M.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(!overflow, 'Handy: kein horizontales Scrollen');
  await M.p.screenshot({ path: SHOTS + '/portal_mobile_class.png', fullPage:true });
  // Aufräumen: Klasse löschen
  await T.p.goto(BASE + '/#/leitstand'); await T.p.click('.ccard'); await T.p.waitForSelector('#delCls');
  await T.p.click('#delCls'); await dlgClick(T.p, 'Endgültig löschen'); await T.p.waitForSelector('#newClass');
  const errs = all.flatMap(x => x.errors);
  ok(!errs.length, 'keine JS-Fehler:\n' + errs.join('\n'));
  console.log('Portal-Tests: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
