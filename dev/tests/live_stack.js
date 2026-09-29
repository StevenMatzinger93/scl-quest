// Speedrun mit mehreren Aufgaben (Paket 2): Dozent stapelt 3 Aufgaben, Lernende lösen nacheinander, Beamer zeigt Fortschritt, Ticker, Avatare, Musik-Modul.
// Gegen einen laufenden Worker: node tests/live_stack.js [http://localhost:8787]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; } else { fails++; console.log('✗ ' + m); } };
const api = async (cookie, method, url, body) => { const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', 'x-spsquest': '1', cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json().catch(() => ({})); return { status: r.status, data: d, cookie: (r.headers.get('set-cookie') || '').split(';')[0] }; };
async function poll(fn, ms){ const end = Date.now() + (ms || 15000); while(Date.now() < end){ if(await fn()) return true; await new Promise(r => setTimeout(r, 300)); } return false; }
async function page(browser, vp){ const c = await browser.newContext({ viewport: vp || { width: 1500, height: 900 } }); const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if(m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push('CONSOLE ' + m.text()); }); return { c, p, errors }; }
async function login(p, u, pw){ await p.goto(BASE + '/#/login'); await p.waitForSelector('#lgUser'); await p.fill('#lgUser', u); await p.fill('#lgPw', pw); await p.click('#loginForm .term-go'); await p.waitForSelector('#loginForm', { state: 'detached' }).catch(() => {}); await p.waitForTimeout(400); }
(async () => {
  const adm = await api('', 'POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  await api(adm.cookie, 'POST', '/api/admin/teachers', { username: 'stk_' + RUN, password: 'stack-lehrer' });
  const tl = await api('', 'POST', '/api/login', { username: 'stk_' + RUN, password: 'stack-lehrer' });
  await api(tl.cookie, 'POST', '/api/me/password', { old: 'stack-lehrer', password: 'stack-lehrer-2' });
  const tl2 = await api('', 'POST', '/api/login', { username: 'stk_' + RUN, password: 'stack-lehrer-2' });
  const cls = await api(tl2.cookie, 'POST', '/api/classes', { name: 'Stapel ' + RUN });
  const studs = ['Adler', 'Biber'].map(n => n + RUN), sc = {};
  for(const u of studs){ const r = await api('', 'POST', '/api/register', { code: cls.data.code, username: u, password: 'schueler-pw' }); await api(r.cookie, 'POST', '/api/me/notice', {}); const l = await api('', 'POST', '/api/login', { username: u, password: 'schueler-pw' }); sc[u] = l.cookie; }
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl.json'), 'utf8'));
  const ids = meta.tasks.filter(t => t.ch === 1).slice(0, 3).map(t => t.id);
  ok(ids.length === 3 && meta.tasks[0].brief, 'Aufgaben-Meta enthält den Auftragstext');
  // Validierung
  ok((await api(tl2.cookie, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: ids[0], tasks: Array.from({ length: 11 }, (_, i) => 'x' + i), duration: 300 })).status === 400, 'mehr als 10 Aufgaben werden abgelehnt');
  const made = await api(tl2.cookie, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: ids[0], tasks: ids, duration: 300, title: 'Speedrun · 3 Aufgaben' });
  ok(made.status === 201, 'Speedrun mit 3 Aufgaben angelegt');
  const cid = made.data.id, code = made.data.code;
  const st0 = await api(tl2.cookie, 'GET', '/api/challenges/' + cid);
  ok(JSON.stringify(st0.data.challenge.tasks) === JSON.stringify(ids), 'Aufgabenliste im Zustand');
  for(const u of studs) ok((await api(sc[u], 'POST', '/api/live/join', { code })).status === 200, 'Beitritt ' + u);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const T = await page(browser, { width: 1600, height: 900 });
  await login(T.p, 'stk_' + RUN, 'stack-lehrer-2');
  await T.p.goto(BASE + '/#/beamer/' + cid);
  await T.p.waitForSelector('.bm-lobby');
  ok(await T.p.locator('.bm-av').count() === 2 && await T.p.locator('.bm-av svg.av').count() === 2, 'Lobby: 2 animierte Avatare');
  ok(await T.p.locator('.bm-tasklist li').count() === 3, 'Lobby: Aufgabenliste');
  ok(await T.p.evaluate(() => !!(window.SPSQ.sound && window.SPSQ.sound.available)), 'Musikmodul vorhanden');
  await T.p.screenshot({ path: SHOTS + '/live_stack_lobby.png' });
  // Start mit 3-2-1-Los
  await T.p.click('#bmStart');
  ok(await T.p.waitForSelector('.bm-count', { timeout: 4000 }).then(() => true).catch(() => false), '3-2-1-Countdown sichtbar');
  await T.p.waitForSelector('#bmTime', { timeout: 15000 });
  ok(await T.p.evaluate(() => { try{ window.SPSQ.sound.unlock(); window.SPSQ.sound.sfx('solved'); return true; }catch(e){ return false; } }), 'Klänge laufen ohne Fehler');
  // Adler löst Aufgabe 1 und 2, Biber Aufgabe 1
  const solve = (u, t) => api(sc[u], 'POST', '/api/live/' + cid + '/attempt', { ok: true, code: 'x := 1;', taskId: t });
  ok((await api(sc[studs[0]], 'POST', '/api/live/' + cid + '/attempt', { ok: true, taskId: 'nicht_dabei' })).status === 400, 'fremde Aufgabe abgelehnt');
  const a1 = await solve(studs[0], ids[0]); ok(a1.data.solved && a1.data.solvedN === 1 && a1.data.total === 3 && a1.data.done === false, 'Adler: 1 von 3');
  const b1 = await solve(studs[1], ids[0]); ok(b1.data.solved && b1.data.solvedN === 1, 'Biber: 1 von 3');
  const a2 = await solve(studs[0], ids[1]); ok(a2.data.solvedN === 2, 'Adler: 2 von 3');
  ok((await solve(studs[0], ids[1])).data.points === a2.data.points, 'doppelte Lösung zählt nicht doppelt');
  await api(sc[studs[1]], 'POST', '/api/live/' + cid + '/attempt', { ok: false, taskId: ids[1] });
  await api(sc[studs[1]], 'POST', '/api/live/' + cid + '/hint', { taskId: ids[1] });
  const me = await api(sc[studs[0]], 'GET', '/api/live/' + cid);
  ok(me.data.me.solvedN === 2 && me.data.me.solvedTasks.length === 2 && !me.data.me.solved, 'Spielerzustand: 2 gelöst, noch nicht fertig');
  const st = await api(tl2.cookie, 'GET', '/api/challenges/' + cid);
  const pa = st.data.players.find(p => p.username === studs[0]), pb = st.data.players.find(p => p.username === studs[1]);
  ok(pa.rank === 1 && pb.rank === 2, 'Rang nach gelösten Aufgaben: Adler vor Biber');
  ok(JSON.stringify(pa.progress) === '[true,true,false]' && JSON.stringify(pb.progress) === '[true,false,false]', 'Fortschritt je Aufgabe');
  ok(await poll(async () => (await T.p.locator('.bm-dots').count()) === 2 && (await T.p.locator('.bm-dots i.on').count()) === 3), 'Beamer: ●●○ / ●○○');
  ok(await poll(async () => /hat Aufgabe \d gelöst/.test(await T.p.textContent('#bmTicker'))), 'Beamer: Ereignis-Ticker');
  ok(await T.p.evaluate(() => !!document.querySelector('.bm-scene img')), 'Beamer: Bild der Anlage eingebunden');
  await T.p.screenshot({ path: SHOTS + '/live_stack_running.png' });
  const a3 = await solve(studs[0], ids[2]); ok(a3.data.done === true, 'Adler: alle 3 gelöst');
  const b2 = await solve(studs[1], ids[1]);
  // Ende
  await T.p.click('#bmStop'); await T.p.click('#dlgActions button:has-text("Beenden")');
  await T.p.waitForSelector('.bm-podium .bp', { timeout: 8000 });
  ok(await T.p.locator('.bm-podium .bp svg.av').count() === 2, 'Siegerehrung: Avatare auf dem Podest');
  await T.p.screenshot({ path: SHOTS + '/live_stack_podium.png' });
  // Spiel: Lernende lösen nacheinander im Browser (frische Challenge)
  const made2 = await api(tl2.cookie, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: ids[0], tasks: ids.slice(0, 2), duration: 300 });
  const S = await page(browser, { width: 1366, height: 768 });
  await login(S.p, studs[0], 'schueler-pw');
  await S.p.goto(BASE + '/#/live'); await S.p.fill('#ljCode', made2.data.code); await S.p.click('#ljForm button');
  await S.p.waitForURL(/scl\/\?live=\d+/); await S.p.waitForSelector('#liveOverlay .live-pulse');
  await api(tl2.cookie, 'POST', '/api/challenges/' + made2.data.id + '/start', {});
  await S.p.waitForSelector('#liveBar', { timeout: 10000 });
  ok(await S.p.evaluate(() => SCLQuest.session.task.id) === ids[0], 'Spiel: erste Aufgabe');
  ok(/Aufgabe 1\/2/.test(await S.p.textContent('#liveBar')), 'Live-Leiste zeigt 1/2');
  await S.p.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  await S.p.waitForSelector('#successCard:not([style*="display: none"])', { timeout: 15000 });
  ok(/Weiter zu Aufgabe 2 von 2/.test(await S.p.textContent('#nextBtn')), 'Erfolgskarte: Weiter zu Aufgabe 2 von 2');
  await S.p.click('#nextBtn');
  await poll(async () => (await S.p.evaluate(() => SCLQuest.session.task.id)) === ids[1]);
  ok(await S.p.evaluate(() => SCLQuest.session.task.id) === ids[1] && !(await S.p.isVisible('#successCard')), 'Spiel: zweite Aufgabe geladen');
  await S.p.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  await S.p.waitForSelector('#successCard:not([style*="display: none"])', { timeout: 15000 });
  ok(/Rangliste/.test(await S.p.textContent('#nextBtn')), 'letzte Aufgabe: Zur Rangliste');
  const fin = await api(tl2.cookie, 'GET', '/api/challenges/' + made2.data.id);
  ok(fin.data.players[0].solved && fin.data.players[0].solvedN === 2, 'Server: beide Aufgaben gelöst');
  await S.p.screenshot({ path: SHOTS + '/live_stack_game.png' });
  const errs = [].concat(T.errors, S.errors);
  ok(!errs.length, 'keine JS-Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log('Speedrun-Stapel: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
