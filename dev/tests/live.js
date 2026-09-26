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
  for(const u of studs){ const r = await api('', 'POST', '/api/register', { code: cls.data.code, username: u, password: 'schueler-pw' }); await api(r.cookie, 'POST', '/api/me/notice', {}); }
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
  await T.p.waitForSelector('.bm-chip:nth-child(3)', { timeout:8000 }).catch(() => {});
  ok(await T.p.locator('.bm-chip').count() === 3, 'Beamer: 3 Teilnehmende');
  await T.p.screenshot({ path: SHOTS + '/live_lobby.png' });
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
  const errs = all.flatMap(x => x.errors);
  ok(!errs.length, 'keine JS-Fehler:\n' + errs.join('\n'));
  // Aufräumen
  await api(tl.cookie, 'DELETE', '/api/classes/' + cls.data.id);
  console.log('Live-Tests: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
