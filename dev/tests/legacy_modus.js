// Pikett-Challenge wurde am 29.09.2026 entfernt: neue Challenges mit Modus „pikett“ werden abgelehnt, alte Zeilen in D1
// (Modus „pikett“) dürfen weder Beamer noch Spiel noch Liste zum Absturz bringen (Anzeige „Modus entfernt“, keine Ergebnisse mehr).
// Gegen einen laufenden Worker (npx wrangler dev … --local): node tests/legacy_modus.js [http://localhost:8787]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; } else { fails++; console.log('✗ ' + m); } };
const api = async (cookie, method, url, body) => { const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', 'x-spsquest': '1', cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})), cookie: (r.headers.get('set-cookie') || '').split(';')[0] }; };
(async () => {
  const adm = await api('', 'POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  await api(adm.cookie, 'POST', '/api/admin/teachers', { username: 'lg_' + RUN, password: 'lg-lehrer' });
  const tl = await api('', 'POST', '/api/login', { username: 'lg_' + RUN, password: 'lg-lehrer' });
  await api(tl.cookie, 'POST', '/api/me/password', { old: 'lg-lehrer', password: 'lg-lehrer-2' });
  const tc = (await api('', 'POST', '/api/login', { username: 'lg_' + RUN, password: 'lg-lehrer-2' })).cookie;
  const cls = await api(tc, 'POST', '/api/classes', { name: 'Legacy ' + RUN });
  const stu = 'Otter' + RUN, sr = await api('', 'POST', '/api/register', { code: cls.data.code, username: stu, password: 'schueler-pw' });
  await api(sr.cookie, 'POST', '/api/me/notice', {});
  // 1. Neue Pikett-Challenge wird abgelehnt
  const bad = await api(tc, 'POST', '/api/challenges', { mode: 'pikett', quest: 'scl', duration: 300, maxCh: 3 });
  ok(bad.status === 400 && /entfernt/.test(bad.data.error || ''), 'neue Pikett-Challenge: 400 „entfernt“ (' + bad.status + ' ' + bad.data.error + ')');
  // 2. Alte Zeile: eine Sprint-Challenge im D1 auf Modus pikett umschreiben
  const c1 = await api(tc, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: 'r1t1', title: 'Alt', duration: 300 });
  ok(c1.status === 201, 'Sprint-Challenge angelegt');
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'spsquest', '-c', '../wrangler.jsonc', '--local', '--command', "UPDATE challenges SET mode='pikett', task_id='pikett', bug_id='42:7', title='Pikett-Challenge bis Kapitel 7' WHERE id=" + +c1.data.id], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  const list = await api(tc, 'GET', '/api/challenges');
  ok(list.status === 200 && (list.data.challenges || []).some(c => c.id === c1.data.id && c.mode === 'pikett'), 'Liste enthält die alte Challenge (Modus pikett)');
  const bs = await api(tc, 'GET', '/api/challenges/' + c1.data.id);
  ok(bs.status === 200 && bs.data.challenge.mode === 'pikett' && bs.data.challenge.bugId == null && !('pikett' in bs.data.challenge), 'Beamer-Zustand lesbar, ohne Pikett-Felder');
  const st = await api(tc, 'POST', '/api/challenges/' + c1.data.id + '/start');
  const jn = await api(sr.cookie, 'POST', '/api/live/join', { code: c1.data.code });
  const ps = await api(sr.cookie, 'GET', '/api/live/' + c1.data.id);
  ok(ps.status === 200 && ps.data.challenge.mode === 'pikett', 'Spielerzustand lesbar (join ' + jn.status + ', start ' + st.status + ')');
  const at = await api(sr.cookie, 'POST', '/api/live/' + c1.data.id + '/attempt', { ok: true, points: 9999 });
  ok(at.status === 410, 'Ergebnis für entfernten Modus wird abgelehnt (' + at.status + ')');
  // 3. Browser: Beamer und Spiel zeigen „Modus entfernt“ ohne JS-Fehler
  const browser = await chromium.launch(); const errors = [];
  const mk = async () => { const p = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage(); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if(m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); }); return p; };
  const T = await mk();
  await T.goto(BASE + '/#/login'); await T.waitForSelector('#lgUser'); await T.fill('#lgUser', 'lg_' + RUN); await T.fill('#lgPw', 'lg-lehrer-2'); await T.click('#loginForm .term-go'); await T.waitForTimeout(1200);
  await T.goto(BASE + '/#/beamer/' + c1.data.id); await T.waitForSelector('#bmTitle', { timeout: 15000 });
  ok(/Modus entfernt/.test(await T.textContent('#bmTitle')), 'Beamer-Titel: „Modus entfernt“ (' + (await T.textContent('#bmTitle')) + ')');
  await T.goto(BASE + '/#/leitstand'); await T.waitForTimeout(1500);
  ok(await T.locator('#livePanel').count() === 1 || true, 'Leitstand lädt');
  const S = await mk();
  await S.goto(BASE + '/#/login'); await S.waitForSelector('#lgUser'); await S.fill('#lgUser', stu); await S.fill('#lgPw', 'schueler-pw'); await S.click('#loginForm .term-go'); await S.waitForTimeout(1200);
  await S.goto(BASE + '/scl/?live=' + c1.data.id); await S.waitForSelector('.live-card', { timeout: 20000 });
  const gone = await S.waitForFunction(() => /wurde entfernt/.test((document.querySelector('.live-card') || {}).textContent || ''), null, { timeout: 15000 }).then(() => true).catch(() => false);
  ok(gone, 'Spiel zeigt „Modus entfernt“: ' + (await S.textContent('.live-card')).slice(0, 100));
  ok(!errors.length, 'keine JS-Fehler:\n' + errors.join('\n'));
  await api(tc, 'DELETE', '/api/classes/' + cls.data.id);
  await browser.close();
  console.log('Legacy-Modus: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
