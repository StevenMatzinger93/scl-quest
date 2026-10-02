// Live-Challenge im Browser: Dozent legt an → Beamer → 3 Lernende treten bei → Start → lösen/scheitern → Siegerehrung → Lösung anonym zeigen
// Gegen einen laufenden Worker: node tests/live.js [http://localhost:8787]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive:true });
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
const api = async (cookie, method, url, body) => { const r = await fetch(BASE + url, { method, headers:{ 'content-type':'application/json', 'x-spsquest':'1', cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})), cookie: (r.headers.get('set-cookie') || '').split(';')[0] }; };
async function page(browser, vp){
  const c = await browser.newContext({ viewport: vp || { width:1366, height:860 } }); const p = await c.newPage(); const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if(m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  return { c, p, errors };
}
async function login(p, u, pw){ await p.goto(BASE + '/#/login'); await p.waitForSelector('#lgUser'); await p.fill('#lgUser', u); await p.fill('#lgPw', pw); await p.click('#loginForm .term-go'); await p.waitForSelector('#termOverlay', { state:'hidden' }); }
async function poll(fn, ms){ const end = Date.now() + (ms || 15000); while(Date.now() < end){ if(await fn()) return true; await new Promise(r => setTimeout(r, 300)); } return false; }
(async () => {
  // Vorbereitung per API: Dozent + Klasse + 3 Konten (Passwort bereits geändert)
  const adm = await api('', 'POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  await api(adm.cookie, 'POST', '/api/admin/teachers', { username: 'live_' + RUN, password: 'live-lehrer' });
  const tl = await api('', 'POST', '/api/login', { username: 'live_' + RUN, password: 'live-lehrer' });
  await api(tl.cookie, 'POST', '/api/me/password', { old: 'live-lehrer', password: 'live-lehrer-2' });
  const cls = await api(tl.cookie, 'POST', '/api/classes', { name: 'Live ' + RUN });
  const studs = ['Adler', 'Biber', 'Chamaeleon'].map(n => n + RUN);
  const sc = [];
  for(const u of studs){ const r = await api('', 'POST', '/api/register', { code: cls.data.code, username: u, password: 'schueler-pw' }); await api(r.cookie, 'POST', '/api/me/notice', {}); sc.push(r.cookie); }
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const all = [];
  // Dozent: Challenge anlegen (Störungsjagd)
  const T = await page(browser, { width:1600, height:900 }); all.push(T);
  await login(T.p, 'live_' + RUN, 'live-lehrer-2');
  await T.p.waitForSelector('#livePanel a[href="#/live/neu"]');
  await T.p.click('#livePanel a[href="#/live/neu"]');
  await T.p.waitForSelector('#lcForm');
  await T.p.click('label.mode-card:has(input[value=bug])');
  await T.p.selectOption('#lcCh', '1');
  await T.p.selectOption('#lcTask', 's1_bilanz');
  ok((await T.p.textContent('#lcInfo')).includes('HMI'), 'Symptom wird angezeigt');
  await T.p.selectOption('#lcDur', '300');
  await T.p.click('#lcForm button.pri');
  await T.p.waitForSelector('.bm-code');
  const code = (await T.p.textContent('.bm-code')).trim();
  ok(/^\d{4}$/.test(code), 'Beamer zeigt Code ' + code);
  // Lernende treten bei
  const S = [];
  for(const u of studs){
    const x = await page(browser, u === studs[2] ? { width:390, height:844 } : undefined); all.push(x); S.push(x);
    await login(x.p, u, 'schueler-pw');
    await x.p.goto(BASE + '/#/live'); await x.p.waitForSelector('#ljCode');
    await x.p.fill('#ljCode', code); await x.p.click('#ljForm button');
    await x.p.waitForURL(/scl\/\?live=\d+/);
    await x.p.waitForSelector('#liveOverlay .live-pulse');
  }
  ok((await S[0].p.textContent('#liveOverlay')).includes('Warte auf den Start'), 'Lobby im Spiel');
  await T.p.waitForSelector('.bm-who:nth-child(3)', { timeout:8000 }).catch(() => {});
  ok(await T.p.locator('.bm-who').count() === 3, 'Beamer: 3 Teilnehmende');
  await T.p.screenshot({ path: SHOTS + '/live_lobby.png' });
  ok(await T.p.evaluate(() => { const M = window.SPSQ_MUSIC; if(!M) return false; M.unlock(); M.play('lobby'); M.sfx('join'); M.play('challenge'); M.urgent(true); M.sfx('solved'); M.sfx('count'); M.sfx('timeup'); M.play('victory'); M.volume(0.3); M.mute(true); M.mute(false); M.stop(); return M.current === null; }), 'Beamer-Musik: alle Stücke und Effekte spielbar (WebAudio)');
  ok(await T.p.locator('#bmMute').count() === 1 && await T.p.locator('#bmVol').count() === 1, 'Musik-Knopf und Lautstärke am Beamer');
  // Start
  await T.p.click('#bmStart');
  await T.p.waitForSelector('#bmTime');
  for(const x of S) await x.p.waitForSelector('#liveBar', { timeout:10000 });
  ok(await S[0].p.evaluate(() => SCLQuest.session.task && SCLQuest.session.task.id === 'c1_boss' && SCLQuest.editor.getValue().includes('Teile_Gesamt + Teile_Defekt')), 'Spiel lädt Fehlerversion');
  ok((await S[0].p.textContent('#storyText')).includes('STÖRUNGSMELDUNG'), 'Störungsmeldung im Spiel');
  // Adler: ein Fehlversuch, dann behoben
  await S[0].p.evaluate(() => SCLQuest.compile());
  await S[0].p.evaluate(() => { const c = SCLQuest.editor.getValue().replace('Teile_Gesamt + Teile_Defekt', 'Teile_Gesamt - Teile_Defekt'); SCLQuest.editor.setValue(c); SCLQuest.compile(); });
  // Biber: sofort richtig, mit Hinweis
  await S[1].p.evaluate(() => { document.getElementById('hintBtn').click(); const c = SCLQuest.editor.getValue().replace('Teile_Gesamt + Teile_Defekt', 'Teile_Gesamt - Teile_Defekt'); SCLQuest.editor.setValue(c); SCLQuest.compile(); });
  // Chamäleon (Handy): nur Fehlversuche
  await S[2].p.evaluate(() => { SCLQuest.compile(); SCLQuest.compile(); });
  ok(await poll(async () => (await T.p.locator('.bm-tbl tr.ok').count()) === 2), 'Beamer: 2 gelöst');
  await T.p.screenshot({ path: SHOTS + '/live_running.png' });
  await S[0].p.waitForSelector('.lb-ok', { timeout:8000 }).catch(() => {});
  ok((await S[0].p.textContent('#liveBar')).includes('gelöst'), 'Live-Leiste zeigt gelöst');
  await S[2].p.screenshot({ path: SHOTS + '/live_mobile.png' });
  // Rangliste: Biber (0 Fehlversuche, 1 Hinweis) vs Adler (1 Fehlversuch, 0 Hinweise)
  const st = await api(tl.cookie, 'GET', '/api/challenges/' + (await T.p.evaluate(() => location.hash.split('/')[2])));
  const A = st.data.players.find(p => p.username === studs[0]), B = st.data.players.find(p => p.username === studs[1]), Cc = st.data.players.find(p => p.username === studs[2]);
  ok(A.solved && A.attempts === 2 && A.hints === 0, 'Adler: 2 Versuche ' + JSON.stringify(A));
  ok(B.solved && B.attempts === 1 && B.hints === 1, 'Biber: 1 Versuch, 1 Hinweis ' + JSON.stringify(B));
  ok(!Cc.solved && Cc.attempts === 2, 'Chamäleon: 2 Fehlversuche ' + JSON.stringify(Cc));
  // Beenden → Siegerehrung
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  await T.p.waitForSelector('.bm-podium .bp', { timeout:8000 });
  ok(await T.p.locator('.bm-podium .bp').count() === 2, 'Podest mit 2 Plätzen');
  await T.p.waitForTimeout(1500);
  await T.p.click('[data-show]');
  await T.p.waitForSelector('.bm-diff');
  const diff = await T.p.textContent('#bmShow');
  ok(diff.includes('Teile_Gesamt - Teile_Defekt') && !studs.some(u => diff.includes(u)), 'Lösung anonym mit Vergleich');
  await T.p.screenshot({ path: SHOTS + '/live_podium.png' });
  for(const x of S) await x.p.waitForSelector('#liveOverlay .live-actions a', { timeout:10000 }).catch(() => {});
  ok((await S[1].p.textContent('#liveOverlay')).includes('Rang'), 'Spiel zeigt Endergebnis');
  await S[1].p.screenshot({ path: SHOTS + '/live_end_student.png' });
  // KOP-Challenge: Quest wählen, Beitritt landet in kop/, falscher Link wird umgeleitet
  await T.p.goto(BASE + '/#/live/neu'); await T.p.waitForSelector('#lcQuest');
  await T.p.selectOption('#lcQuest', 'kop');
  await T.p.waitForSelector('#lcCh option:has-text("Strom fliesst")', { state:'attached' });
  await T.p.click('label.mode-card:has(input[value=bug])');
  await T.p.selectOption('#lcCh', '1'); await T.p.selectOption('#lcTask', 'ks1_sperre');
  ok((await T.p.textContent('#lcInfo')).includes('Karte'), 'KOP-Störung wählbar');
  await T.p.click('#lcForm button.pri'); await T.p.waitForSelector('.bm-code');
  ok((await T.p.textContent('#bmTitle')).startsWith('KOP'), 'Beamer zeigt KOP');
  const kcode = (await T.p.textContent('.bm-code')).trim();
  const K = S[0];
  await K.p.goto(BASE + '/#/live'); await K.p.waitForSelector('#ljCode');
  await K.p.fill('#ljCode', kcode); await K.p.click('#ljForm button');
  await K.p.waitForURL(/kop\/\?live=\d+/); ok(true, 'Beitritt öffnet KOP Quest');
  const kid = K.p.url().split('live=')[1];
  const R2 = S[1];
  await R2.p.evaluate(c => fetch('/api/live/join', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json', 'x-spsquest':'1' }, body: JSON.stringify({ code:c }) }), kcode);
  await R2.p.goto(BASE + '/scl/?live=' + kid);
  await R2.p.waitForURL(/kop\/\?live=\d+/, { timeout:10000 }).catch(() => {});
  ok(/\/kop\//.test(R2.p.url()), 'SCL-Link auf KOP-Challenge wird umgeleitet');
  await K.p.waitForSelector('#liveOverlay .live-pulse');
  await T.p.waitForSelector('#bmStart:not([disabled])'); await T.p.click('#bmStart');
  await K.p.waitForSelector('#liveBar', { timeout:10000 });
  ok(await K.p.evaluate(() => SCLQuest.session.task.id === 'k1_sperre' && !/Karte_OK/.test(SCLQuest.editor.getValue())), 'KOP-Fehlerversion geladen');
  await K.p.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  ok(await poll(async () => (await T.p.locator('.bm-tbl tr.ok').count()) === 1), 'KOP: Beamer zeigt gelöst');
  await T.p.screenshot({ path: SHOTS + '/live_kop.png' });
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  // FUP-Challenge: Störungsjagd im Stellwerk
  await T.p.goto(BASE + '/#/live/neu'); await T.p.waitForSelector('#lcQuest');
  await T.p.selectOption('#lcQuest', 'fup');
  await T.p.waitForSelector('#lcCh option:has-text("Boxen und Zuweisung")', { state:'attached' });
  await T.p.click('label.mode-card:has(input[value=bug])');
  await T.p.selectOption('#lcCh', '1'); await T.p.selectOption('#lcTask', 'fs1_gleis');
  await T.p.click('#lcForm button.pri'); await T.p.waitForSelector('.bm-code');
  ok((await T.p.textContent('#bmTitle')).startsWith('FUP'), 'Beamer zeigt FUP');
  const fcode = (await T.p.textContent('.bm-code')).trim();
  await K.p.goto(BASE + '/#/live'); await K.p.waitForSelector('#ljCode');
  await K.p.fill('#ljCode', fcode); await K.p.click('#ljForm button');
  await K.p.waitForURL(/fup\/\?live=\d+/); ok(true, 'Beitritt öffnet FUP Quest');
  await K.p.waitForSelector('#liveOverlay .live-pulse');
  await T.p.waitForSelector('#bmStart:not([disabled])'); await T.p.click('#bmStart');
  await K.p.waitForSelector('#liveBar', { timeout:10000 });
  ok(await K.p.evaluate(() => SCLQuest.session.task.id === 'f1_und' && !/Gleis1_frei/.test(SCLQuest.editor.getValue())), 'FUP-Fehlerversion geladen');
  await K.p.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  ok(await poll(async () => (await T.p.locator('.bm-tbl tr.ok').count()) === 1), 'FUP: Beamer zeigt gelöst');
  await T.p.screenshot({ path: SHOTS + '/live_fup.png' });
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  // AWL-Challenge: Störungsjagd im Walzwerk
  await T.p.goto(BASE + '/#/live/neu'); await T.p.waitForSelector('#lcQuest');
  await T.p.selectOption('#lcQuest', 'awl');
  await T.p.waitForSelector('#lcCh option:has-text("Erste Anweisungen")', { state:'attached' });
  await T.p.click('label.mode-card:has(input[value=bug])');
  await T.p.selectOption('#lcCh', '1'); await T.p.selectOption('#lcTask', 'as1_gitter');
  await T.p.click('#lcForm button.pri'); await T.p.waitForSelector('.bm-code');
  ok((await T.p.textContent('#bmTitle')).startsWith('AWL'), 'Beamer zeigt AWL');
  const acode = (await T.p.textContent('.bm-code')).trim();
  await K.p.goto(BASE + '/#/live'); await K.p.waitForSelector('#ljCode');
  await K.p.fill('#ljCode', acode); await K.p.click('#ljForm button');
  await K.p.waitForURL(/awl\/\?live=\d+/); ok(true, 'Beitritt öffnet AWL Quest');
  await K.p.waitForSelector('#liveOverlay .live-pulse');
  await T.p.waitForSelector('#bmStart:not([disabled])'); await T.p.click('#bmStart');
  await K.p.waitForSelector('#liveBar', { timeout:10000 });
  ok(await K.p.evaluate(() => SCLQuest.session.task.id === 'a1_und' && /O  Gitter_zu/.test(SCLQuest.editor.getValue())), 'AWL-Fehlerversion geladen');
  await K.p.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  ok(await poll(async () => (await T.p.locator('.bm-tbl tr.ok').count()) === 1), 'AWL: Beamer zeigt gelöst');
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  // Sensorwerkstatt: Störungsjagd am Prüfstand (Fehler steckt im Ausgangszustand der Fehlersuche-Aufgabe)
  await T.p.goto(BASE + '/#/live/neu'); await T.p.waitForSelector('#lcQuest');
  await T.p.selectOption('#lcQuest', 'sensor');
  await T.p.waitForSelector('#lcCh option:has-text("Signale und digitale Sensoren")', { state:'attached' });
  await T.p.click('label.mode-card:has(input[value=bug])');
  await T.p.selectOption('#lcCh', '2'); await T.p.selectOption('#lcTask', 'sb_w2_fehler_npn_pnp');
  await T.p.click('#lcForm button.pri'); await T.p.waitForSelector('.bm-code');
  const scode = (await T.p.textContent('.bm-code')).trim();
  await K.p.goto(BASE + '/#/live'); await K.p.waitForSelector('#ljCode');
  await K.p.fill('#ljCode', scode); await K.p.click('#ljForm button');
  await K.p.waitForURL(/sensor\/\?live=\d+/); ok(true, 'Beitritt öffnet die Sensorwerkstatt');
  await K.p.waitForSelector('#liveOverlay .live-pulse');
  await T.p.waitForSelector('#bmStart:not([disabled])'); await T.p.click('#bmStart');
  await K.p.waitForSelector('#liveBar', { timeout:10000 });
  ok(await K.p.evaluate(() => SCLQuest.session.task.id === 'w2_fehler_npn_pnp' && /STÖRUNGSMELDUNG/.test(document.getElementById('storyText').textContent) && SCLQuest.sensor.ctx.state.wires.length > 0), 'Werkstatt-Störung geladen (w2_fehler_npn_pnp, Fehler im Ausgangszustand)');
  await K.p.evaluate(() => { SCLQuest.sensor.applyRef(); SCLQuest.compile(); });
  ok(await poll(async () => (await T.p.locator('.bm-tbl tr.ok').count()) === 1), 'Sensorwerkstatt: Beamer zeigt gelöst');
  await T.p.screenshot({ path: SHOTS + '/live_sensor.png' });
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  // Speedrun stapelbar (Paket 2.3): drei Aufgaben aus Kapitel 1, Fortschritt je Person, Rangliste nach gelösten Aufgaben
  await T.p.goto(BASE + '/#/live/neu'); await T.p.waitForSelector('#lcForm');
  if(await T.p.$('#lcQuest')) await T.p.selectOption('#lcQuest', 'scl');
  await T.p.waitForSelector('#lcPick');
  await T.p.selectOption('#lcCh', '1'); await T.p.selectOption('#lcPick', 'mehrere');
  await T.p.waitForSelector('#lcMulti input');
  const pickIds = await T.p.evaluate(() => [...document.querySelectorAll('#lcMulti input')].slice(0, 3).map(x => x.value));
  for(const v of pickIds) await T.p.check('#lcMulti input[value="' + v + '"]');
  await T.p.click('#lcForm button.pri'); await T.p.waitForSelector('.bm-code');
  ok((await T.p.textContent('#bmTitle')).includes('Speedrun · 3 Aufgaben'), 'Beamer: Speedrun mit 3 Aufgaben');
  ok(await T.p.locator('.bm-tasks li').count() === 3, 'Lobby zeigt die 3 Aufgaben');
  const mcode = (await T.p.textContent('.bm-code')).trim();
  for(const x of [S[0], S[1]]){ await x.p.goto(BASE + '/#/live'); await x.p.waitForSelector('#ljCode'); await x.p.fill('#ljCode', mcode); await x.p.click('#ljForm button'); await x.p.waitForURL(/scl\/\?live=\d+/); await x.p.waitForSelector('#liveOverlay .live-pulse'); }
  await T.p.waitForSelector('#bmStart:not([disabled])'); await T.p.click('#bmStart');
  for(const x of [S[0], S[1]]) await x.p.waitForSelector('#liveBar .lb-dots', { timeout:10000 });
  ok(await S[0].p.evaluate(ids => SCLQuest.session.task.id === ids[0], pickIds), 'Spiel startet mit Aufgabe 1 des Speedruns');
  const solveCur = x => x.p.evaluate(() => { const t = SCLQuest.session.task; if(t.pro) SCLQuest.setProCodes(SCLQuest.pro.refCodes ? SCLQuest.pro.refCodes(t) : {}); else SCLQuest.editor.setValue(t.refSolution); SCLQuest.compile(); });
  // Adler löst alle drei, Biber nur die erste
  for(let k = 0; k < 3; k++){
    await solveCur(S[0]);
    await S[0].p.waitForSelector('#successCard:not([style*="display: none"])', { timeout:8000 });
    await S[0].p.waitForFunction(k => (SCLQuest.state && document.getElementById('liveBar').querySelectorAll('.lb-dots i.on').length) >= k + 1, k, { timeout:8000 }).catch(() => {});
    if(k < 2){ ok((await S[0].p.textContent('#nextBtn')).includes('Nächste Aufgabe'), 'Weiter führt zur nächsten Speedrun-Aufgabe (' + (k + 1) + ')'); await S[0].p.click('#nextBtn'); await S[0].p.waitForFunction(i => SCLQuest.session.task.id === i, pickIds[k + 1], { timeout:5000 }).catch(() => {}); }
  }
  await solveCur(S[1]);
  ok(await poll(async () => { const r = await api(tl.cookie, 'GET', '/api/challenges/' + (await T.p.evaluate(() => location.hash.split('/')[2]))); const a = r.data.players.find(p => p.username === studs[0]), b = r.data.players.find(p => p.username === studs[1]); return a && b && a.solvedN === 3 && a.solved && b.solvedN === 1 && !b.solved && a.rank === 1 && b.rank === 2; }), 'Rangliste nach gelösten Aufgaben (Adler 3/3 vor Biber 1/3)');
  ok(await poll(async () => (await T.p.locator('.bm-dots i.on').count()) === 4), 'Beamer zeigt Fortschritt je Person (●●● / ●○○)');
  ok(await poll(async () => /Aufgabe 3 von 3 gelöst/.test(await T.p.textContent('.bm-ticker'))), 'Ereignis-Ticker meldet gelöste Aufgaben');
  await T.p.screenshot({ path: SHOTS + '/live_speedrun.png' });
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  await T.p.waitForSelector('.bm-podium .bp', { timeout:8000 });
  ok(await T.p.locator('.bm-podium .bm-av.dance').count() === 2, 'Podest mit tanzenden Avataren');
  await T.p.screenshot({ path: SHOTS + '/live_speedrun_podium.png' });
  // Sudden Death (L1): per API – Sieger, Absage 409, gleichzeitige Meldungen, Zeitablauf ohne Sieger
  const sdNew = async (extra) => { const r = await api(tl.cookie, 'POST', '/api/challenges', Object.assign({ mode: 'sprint', quest: 'scl', taskId: 'r1t3', duration: 300, endRule: 'first' }, extra || {})); for(const c of sc) await api(c, 'POST', '/api/live/join', { code: r.data.code }); await api(tl.cookie, 'POST', '/api/challenges/' + r.data.id + '/start', {}); return r.data.id; };
  let sid = await sdNew();
  let ra = await api(sc[0], 'POST', '/api/live/' + sid + '/attempt', { ok: true, code: 'x := 1;' });
  ok(ra.status === 200 && ra.data.winner === true, 'Sudden Death: erste Lösung gewinnt ' + JSON.stringify(ra.data));
  let rb = await api(sc[1], 'POST', '/api/live/' + sid + '/attempt', { ok: true, code: 'y := 2;' });
  ok(rb.status === 409 && /Sudden Death – .* war schneller/.test(rb.data.error || ''), 'Sudden Death: spätere Lösung → 409 ' + (rb.data.error || ''));
  let bs = await api(tl.cookie, 'GET', '/api/challenges/' + sid);
  ok(bs.data.challenge.state === 'ended' && bs.data.challenge.endRule === 'first' && bs.data.winner && bs.data.winner.username === studs[0], 'Sudden Death: Challenge beendet, Sieger ' + (bs.data.winner || {}).username);
  ok(bs.data.players.find(p => p.username === studs[1]).hasCode, 'Sudden Death: Code des Verlierers für die Besprechung gespeichert');
  ok(bs.data.players[0].username === studs[0] && bs.data.players[0].rank === 1, 'Sudden Death: Sieger auf Platz 1');
  const coins = (await api(sc[0], 'GET', '/api/avatar')).data.coins.speedrun;
  ok(coins >= 60 + 80, 'Sudden Death: Sieger bekommt Platz-1-Prämie + Zuschlag (' + coins + ')');
  // gleichzeitig
  sid = await sdNew();
  const both = await Promise.all([0, 1, 2].map(i => api(sc[i], 'POST', '/api/live/' + sid + '/attempt', { ok: true, code: 'z' + i })));
  const wins = both.filter(r => r.status === 200 && r.data.winner === true).length;
  bs = await api(tl.cookie, 'GET', '/api/challenges/' + sid);
  ok(wins === 1 && bs.data.winner && both.find(r => r.data.winner === true), 'Sudden Death: gleichzeitige Lösungen → genau ein Sieger (' + both.map(r => r.status + ':' + r.data.winner).join(', ') + ')');
  // Zeitablauf ohne Sieger (60 s ist das Minimum – Ende per Stopp simulieren)
  sid = await sdNew();
  await api(sc[2], 'POST', '/api/live/' + sid + '/attempt', { ok: false });
  await api(tl.cookie, 'POST', '/api/challenges/' + sid + '/stop', {});
  bs = await api(tl.cookie, 'GET', '/api/challenges/' + sid);
  ok(bs.data.challenge.state === 'ended' && !bs.data.winner, 'Sudden Death: Ende ohne Sieger');
  // Oberfläche: Beamer-Ende und Spiel-Vollbild
  sid = await sdNew({ endRule: 'first' });
  await S[1].p.goto(BASE + '/scl/?live=' + sid); await S[1].p.waitForSelector('#liveBar', { timeout: 10000 });
  ok(/SUDDEN DEATH/.test(await S[1].p.textContent('#liveBar')), 'Spiel: Live-Leiste zeigt Sudden Death');
  await T.p.goto(BASE + '/#/beamer/' + sid); await T.p.waitForSelector('.bm-sd');
  await api(sc[0], 'POST', '/api/live/' + sid + '/attempt', { ok: true, code: 'x' });
  await T.p.waitForSelector('.bm-sd-win', { timeout: 10000 }).catch(() => {});
  ok(/hat gewonnen/.test(await T.p.textContent('#bmBody')) && await T.p.locator('.bm-lost .bm-av.sad').count() === 2, 'Beamer: Sieger allein auf dem Podest, Verlierer-Reihe');
  await T.p.screenshot({ path: SHOTS + '/live_sudden_death.png' });
  await S[1].p.waitForSelector('#liveOverlay h2', { timeout: 10000 }).catch(() => {});
  ok(new RegExp(studs[0] + ' war schneller').test(await S[1].p.textContent('#liveOverlay')) && await S[1].p.evaluate(() => document.getElementById('compileBtn').disabled), 'Spiel: „… war schneller!“ und Editor gesperrt');
  await S[1].p.screenshot({ path: SHOTS + '/live_sudden_death_student.png' });
  const errs = all.flatMap(x => x.errors);
  ok(!errs.length, 'keine JS-Fehler:\n' + errs.join('\n'));
  // Aufräumen
  await api(tl.cookie, 'DELETE', '/api/classes/' + cls.data.id);
  console.log('Live-Tests: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
