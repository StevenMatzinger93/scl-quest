// Profil-Seite im Portal (Paket 3): Avatar gestalten, Shop, Kopfleiste – gegen einen laufenden Worker: node tests/profil_ui.js [http://localhost:8787]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
const api = async (cookie, method, url, body) => { const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', 'x-spsquest': '1', cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json().catch(() => ({})); return { status: r.status, data: d, cookie: (r.headers.get('set-cookie') || '').split(';')[0] }; };
(async () => {
  const adm = await api('', 'POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  await api(adm.cookie, 'POST', '/api/admin/teachers', { username: 'pf_' + RUN, password: 'profil-lehrer' });
  const t0 = await api('', 'POST', '/api/login', { username: 'pf_' + RUN, password: 'profil-lehrer' });
  await api(t0.cookie, 'POST', '/api/me/password', { old: 'profil-lehrer', password: 'profil-lehrer-2' });
  const tl = await api('', 'POST', '/api/login', { username: 'pf_' + RUN, password: 'profil-lehrer-2' });
  const cls = await api(tl.cookie, 'POST', '/api/classes', { name: 'Profil ' + RUN });
  const reg = await api('', 'POST', '/api/register', { code: cls.data.code, username: 'Otter' + RUN, password: 'schueler-pw' });
  await api(reg.cookie, 'POST', '/api/me/notice', {});
  const S = (await api('', 'POST', '/api/login', { username: 'Otter' + RUN, password: 'schueler-pw' })).cookie;
  // Coins: 10 Aufgaben Kapitel 1 → 120 Coins
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl.json'), 'utf8'));
  const doneTasks = {}; meta.tasks.filter(t => t.ch === 1).forEach(t => { doneTasks[t.id] = { stars: 3 }; });
  await api(S, 'PUT', '/api/progress/scl', { state: { v: 4, doneTasks, doneTheory: {}, badges: [] }, summary: {} });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if(m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await p.goto(BASE + '/#/login'); await p.waitForSelector('#lgUser'); await p.fill('#lgUser', 'Otter' + RUN); await p.fill('#lgPw', 'schueler-pw'); await p.click('#loginForm .term-go'); await p.waitForTimeout(600);
  await p.goto(BASE + '/#/profil'); await p.waitForSelector('#pfBig svg.av');
  ok(await p.evaluate(() => /Profil/.test(document.getElementById('topnav').textContent)), 'Navigation: Profil');
  ok(await p.textContent('#pfCoins') === '120', 'Guthaben 120 Coins');
  ok(await p.locator('.pf-it').count() === 8, '8 Tiere zur Auswahl');
  await p.click('.pf-it[data-pick="a:baer"]');
  ok(await p.isEnabled('#pfSave'), 'Speichern nach Änderung möglich');
  await p.click('[data-tab="hat"]');
  ok(await p.locator('.pf-it[data-locked] .pf-price').count() >= 5 && await p.locator('.pf-it[data-locked] .pf-lock').count() === 1, 'Kopfbedeckung: Preise und ein Abzeichen-Stück');
  // Kaufen: Kappe rot (40)
  await p.click('.pf-it[data-pick="hat:kappe_rot"]');
  await p.waitForSelector('#dlgActions button:has-text("Kaufen")'); await p.click('#dlgActions button:has-text("Kaufen")');
  await p.waitForFunction(() => document.getElementById('pfCoins').textContent === '80');
  ok(await p.evaluate(() => document.querySelector('.pf-it[data-pick="hat:kappe_rot"]').getAttribute('aria-pressed') === 'true'), 'Kappe gekauft und angezogen (80 Coins)');
  await p.click('#pfSave'); await p.waitForFunction(() => /Gespeichert/.test(document.getElementById('pfMsg').textContent));
  ok(await p.evaluate(() => !!document.querySelector('#userAv svg.av')), 'Kopfleiste zeigt den Avatar');
  await p.screenshot({ path: SHOTS + '/profil.png' });
  const me = await api(S, 'GET', '/api/me');
  ok(me.data.user.avatar.a === 'baer' && me.data.user.avatar.hat === 'kappe_rot', 'Server hat den Avatar gespeichert');
  // Handy
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 392), 'Handy: kein waagrechtes Scrollen');
  await p.screenshot({ path: SHOTS + '/profil_mobile.png' });
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + errors[0] : ''));
  await browser.close();
  console.log('Profil-UI: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
