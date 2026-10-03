// Avatare und Coins (Feedback-Auftrag Paket 3): API (Stand aus Fortschritt, Kauf, Sperren, Speedrun-Prämie) und Oberfläche (Garderobe, Kopf, Klassenliste, Beamer)
// Gegen einen laufenden Worker: node tests/avatar.js [http://localhost:8787]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const sql = cmd => execFileSync('npx', ['wrangler', 'd1', 'execute', 'spsquest', '-c', '../wrangler.jsonc', '--local', '--command', cmd], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
const api = async (cookie, method, url, body) => { const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', 'x-spsquest': '1', cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})), cookie: (r.headers.get('set-cookie') || '').split(';')[0] }; };
(async () => {
  const adm = await api('', 'POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  await api(adm.cookie, 'POST', '/api/admin/teachers', { username: 'av_' + RUN, password: 'av-lehrer-1' });
  const tl = await api('', 'POST', '/api/login', { username: 'av_' + RUN, password: 'av-lehrer-1' });
  await api(tl.cookie, 'POST', '/api/me/password', { old: 'av-lehrer-1', password: 'av-lehrer-2' });
  const cls = await api(tl.cookie, 'POST', '/api/classes', { name: 'Avatar ' + RUN });
  const names = ['Otter' + RUN, 'Luchs' + RUN], ck = [];
  for(const u of names){ const r = await api('', 'POST', '/api/register', { code: cls.data.code, username: u, password: 'schueler-pw' }); await api(r.cookie, 'POST', '/api/me/notice', {}); ck.push(r.cookie); }
  const [A, B] = ck;
  // 1) Stand aus dem Fortschritt: 3 Aufgaben (1★, 2★, 3★), 1 Kapitel-Boss, 1 Theorie
  let r = await api(A, 'GET', '/api/avatar');
  ok(r.status === 200 && r.data.coins.balance === 0 && r.data.avatar === null, 'neues Konto: 0 Coins, noch kein Avatar');
  const state = { doneTasks: { r1t1: { stars: 1 }, r1t2: { stars: 2 }, c1_boss: { stars: 3 } }, doneTheory: { th1a: { score: 5, n: 5 } } };
  await api(A, 'PUT', '/api/progress/scl', { state, summary: { tasks: 3 }, base: 0 });
  r = await api(A, 'GET', '/api/avatar');
  ok(r.data.coins.balance === 10 + 15 + 20 + 40 + 10, 'Coins aus dem Fortschritt: 10 + 15 + 20 + Boss 40 + Theorie 10 = ' + r.data.coins.balance);
  // 2) Kaufen, Sperren, Besitz
  ok((await api(A, 'PUT', '/api/avatar', { animal: 'wolf', color: '#1f5f8b', equip: { kopf: 'kappe_rot' } })).status === 403, 'Anziehen ohne Besitz wird abgelehnt');
  ok((await api(A, 'POST', '/api/avatar/buy', { item: 'kette_gold' })).status === 403, 'Goldene Kette gesperrt (Final Boss fehlt)');
  ok((await api(A, 'POST', '/api/avatar/buy', { item: 'hemd_kariert' })).status === 400, 'zu teuer wird abgelehnt');
  r = await api(A, 'POST', '/api/avatar/buy', { item: 'kappe_rot' });
  ok(r.status === 200 && r.data.balance === 95 - 50, 'Kappe gekauft, Stand 45');
  ok((await api(A, 'PUT', '/api/avatar', { animal: 'wolf', color: '#1f5f8b', equip: { kopf: 'kappe_rot' } })).status === 200, 'gekaufte Kappe anziehen');
  r = await api(A, 'GET', '/api/avatar'); ok(r.data.owned.includes('kappe_rot') && r.data.coins.spent === 50, 'Kauf im Coin-Buch');
  // Final Boss schaltet die goldene Kette frei (Preis 150): Fortschritt mit Final Boss
  state.doneTasks.final_boss = { stars: 3 }; await api(A, 'PUT', '/api/progress/scl', { state, summary: { tasks: 4 }, base: 0, force: true });
  r = await api(A, 'GET', '/api/avatar'); ok(r.data.unlock.final === 1 && r.data.coins.balance === 45 + 20 + 100, 'Final Boss: +120 Coins, Freischaltung „final“');
  ok((await api(A, 'POST', '/api/avatar/buy', { item: 'kette_gold' })).status === 200, 'Goldene Kette nach dem Final Boss kaufbar');
  // 3) Speedrun-Prämie: zwei lösen, Otter zuerst → Rang 1 (60) und Rang 2 (40), einmal pro Challenge
  const ch = await api(tl.cookie, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: 'r1t3', duration: 300 });
  const code = ch.data.code;
  for(const c of ck) await api(c, 'POST', '/api/live/join', { code });
  await api(tl.cookie, 'POST', '/api/challenges/' + ch.data.id + '/start', {});
  await api(A, 'POST', '/api/live/' + ch.data.id + '/attempt', { ok: true, code: 'x' });
  await new Promise(res => setTimeout(res, 30));
  await api(B, 'POST', '/api/live/' + ch.data.id + '/attempt', { ok: true, code: 'y' });
  const beforeB = (await api(B, 'GET', '/api/avatar')).data.coins.balance;
  await api(tl.cookie, 'POST', '/api/challenges/' + ch.data.id + '/stop', {});
  await api(tl.cookie, 'POST', '/api/challenges/' + ch.data.id + '/stop', {});
  const a2 = (await api(A, 'GET', '/api/avatar')).data, b2 = (await api(B, 'GET', '/api/avatar')).data;
  ok(a2.coins.speedrun === 60 && a2.unlock.podium === 1, 'Speedrun Rang 1: +60 Coins, Podest zählt');
  ok(b2.coins.speedrun === 40 && b2.coins.balance === beforeB + 40, 'Speedrun Rang 2: +40 Coins (einmal, auch bei doppeltem Stopp)');
  // 5) Garderobe 2.0 (A5): Final Boss wird auf dem Server geprüft, Challenge-Statistik mit Regeln gegen Ausnutzen, Varianten, Schaufenster, nur verdienbar
  const uidOf = async c => (await api(c, 'GET', '/api/me')).data.user.id;
  const uA = await uidOf(A), uB = await uidOf(B);
  sql('INSERT INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (' + uA + ', 9000, \'test\', \'t' + RUN + '\', 0), (' + uB + ', 9000, \'test\', \'t' + RUN + '\', 0)');
  r = await api(A, 'POST', '/api/avatar/buy', { item: 'scl_greifarm' });
  ok(r.status === 403 && /Final Boss/.test(r.data.error), 'Legendär: Final Boss nur im Spielstand reicht nicht (' + r.data.error + ')');
  const refs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl_live.json'), 'utf8')).refs;
  await api(B, 'PUT', '/api/progress/scl', { state: { doneTasks: { final_boss: { stars: 3 } }, doneTheory: {}, solutions: { final_boss: 'Alarm := TRUE;' } }, summary: {}, base: 0, force: true });
  r = await api(B, 'POST', '/api/avatar/buy', { item: 'scl_greifarm' });
  ok(r.status === 403 && /Tests/.test(r.data.error), 'Legendär: falsche Final-Boss-Lösung abgelehnt');
  state.solutions = { final_boss: refs.final_boss }; await api(A, 'PUT', '/api/progress/scl', { state, summary: { tasks: 4 }, base: 0, force: true });
  r = await api(A, 'POST', '/api/avatar/buy', { item: 'scl_greifarm' });
  ok(r.status === 200, 'Legendär: echte Final-Boss-Lösung → Greifarm-Rucksack gekauft ' + JSON.stringify(r.data));
  ok((await api(A, 'POST', '/api/avatar/buy', { item: 'kopf_krone' })).status === 403, 'SPS-Meister-Krone ist nicht kaufbar');
  ok((await api(A, 'POST', '/api/avatar/buy', { item: 'kappe_rot~1' })).status === 404, 'Variante ohne Vorlage gibt es nicht');
  const off = Object.keys(JSON.parse(JSON.stringify(require('../src/avatar_core.js').ITEMS))).find(id => { const A0 = require('../src/avatar_core.js'); return A0.ITEMS[id].shop && !A0.onSale(id, Date.now()); });
  r = await api(A, 'POST', '/api/avatar/buy', { item: off });
  ok(r.status === 403 && /Schaufenster/.test(r.data.error), 'Schaufenster: ' + off + ' nur in seinem Monat');
  r = await api(A, 'GET', '/api/avatar');
  ok(r.data.unlock.challenges === 0 && r.data.unlock.podium === 1, 'Challenge mit 2 Teilnehmenden und < 2 min zählt nicht für Trophäen (Podest aus Paket 3 bleibt)');
  r = await api(A, 'POST', '/api/avatar/buy', { item: 'sockel_holz' });
  ok(r.status === 403 && /0\/1|teilnehmen/.test(r.data.error), 'Holz-Sockel gesperrt mit Fortschritt: ' + r.data.error);
  // Challenge, die zählt: 3 Teilnehmende, > 2 min (Startzeit zurückgesetzt), Otter gewinnt
  const c3 = (await api('', 'POST', '/api/register', { code: cls.data.code, username: 'Dachs' + RUN, password: 'schueler-pw' })).cookie; await api(c3, 'POST', '/api/me/notice', {});
  const ch2 = await api(tl.cookie, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: 'r1t3', duration: 600 });
  for(const c of [A, B, c3]) await api(c, 'POST', '/api/live/join', { code: ch2.data.code });
  await api(tl.cookie, 'POST', '/api/challenges/' + ch2.data.id + '/start', {});
  sql('UPDATE challenges SET started_at = started_at - 180000 WHERE id = ' + ch2.data.id);
  await api(A, 'POST', '/api/live/' + ch2.data.id + '/attempt', { ok: true, code: 'x' });
  await api(tl.cookie, 'POST', '/api/challenges/' + ch2.data.id + '/stop', {});
  const a3 = (await api(A, 'GET', '/api/avatar')).data, d3 = (await api(c3, 'GET', '/api/avatar')).data;
  ok(a3.unlock.challenges === 1 && a3.unlock.wins === 1 && a3.unlock.flawless === 1, 'Statistik: Teilnahme, Sieg, fehlerfrei zählen ' + JSON.stringify(a3.unlock));
  ok(d3.unlock.challenges === 1 && d3.unlock.wins === 0 && d3.coins.speedrun === 5, 'Teilnahme +5 Coins, kein Sieg für Dachs');
  ok((await api(A, 'POST', '/api/avatar/buy', { item: 'sockel_holz' })).status === 200 && (await api(A, 'POST', '/api/avatar/buy', { item: 'kopf_kranz' })).status === 200, 'Holz-Sockel und Siegerkranz jetzt kaufbar');
  r = await api(A, 'PUT', '/api/avatar', { animal: 'wolf', color: '#1f5f8b', equip: { kopf: 'kopf_kranz', kette: 'kette_gold', ruecken: 'scl_greifarm', sockel: 'sockel_holz', oberteil: 'tshirt_grau' } });
  ok(r.status === 200 && r.data.avatar.equip.ruecken === 'scl_greifarm' && r.data.avatar.equip.kette === 'kette_gold', 'neue Plätze anziehen; alte Teile bleiben gültig');
  ok((await api(A, 'PUT', '/api/avatar', { animal: 'wolf', equip: { hand: 'hand_pokal' } })).status === 403, 'nicht gekauftes Teil im neuen Platz abgelehnt');
  await api(A, 'PUT', '/api/avatar', { animal: 'wolf', color: '#1f5f8b', equip: { kopf: 'kappe_rot', oberteil: 'tshirt_grau' } });
  // 4) Oberfläche
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } }); const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await ctx.addCookies([{ name: A.split('=')[0], value: A.split('=').slice(1).join('='), url: BASE }]);
  await p.goto(BASE + '/#/avatar'); await p.waitForSelector('.av-page');
  ok(await p.locator('.av-pick').count() === 8, '8 Tiere zur Auswahl');
  await p.click('.av-pick[data-animal="eule"]'); await p.click('.av-col[data-color="#6b3fa0"]');
  await p.click('.av-item[data-item="kappe_rot"]');
  ok(await p.locator('.av-item.locked[data-item="bauhelm"]').count() === 1 && /Kapitel-Bosse/.test(await p.getAttribute('.av-item[data-item="bauhelm"]', 'title')), 'Bauhelm gesperrt mit Hinweis auf die Bedingung');
  await p.click('.av-item[data-item="tshirt_rot"]'); await p.click('#dlgActions button:has-text("Kaufen")');
  await p.waitForSelector('.av-item.on[data-item="tshirt_rot"]');
  await p.click('#avSave'); await p.waitForSelector('#avMsg:has-text("Gespeichert")');
  r = await api(A, 'GET', '/api/avatar');
  ok(r.data.avatar.animal === 'eule' && r.data.avatar.color === '#6b3fa0' && r.data.avatar.equip.oberteil === 'tshirt_rot' && r.data.avatar.equip.kopf === 'kappe_rot', 'Garderobe speichert Tier, Farbe, T-Shirt und Kappe');
  ok(await p.locator('#userName .av svg').count() === 1, 'Avatar im Portal-Kopf');
  await p.screenshot({ path: SHOTS + '/avatar_garderobe.png' });
  // Dozent: Klassenliste mit Avatar, Beamer mit Tier
  const t = await ctx.browser().newContext({ viewport: { width: 1600, height: 900 } }); const tp = await t.newPage();
  await t.addCookies([{ name: tl.cookie.split('=')[0], value: tl.cookie.split('=').slice(1).join('='), url: BASE }]);
  await tp.goto(BASE + '/#/leitstand/klasse/' + cls.data.id); await tp.waitForSelector('.av-cell');
  ok(await tp.locator('.av-cell .av svg').count() === 1 && await tp.locator('.av-cell .av.ph').count() === 2, 'Klassenliste: Tier für Otter, Platzhalter für Luchs und Dachs');
  await tp.goto(BASE + '/#/beamer/' + ch.data.id); await tp.waitForSelector('.bm-podium .bp');
  ok(await tp.locator('.bm-podium .bm-av svg').count() === 1, 'Podest zeigt das Tier');
  await tp.waitForTimeout(2000); await tp.screenshot({ path: SHOTS + '/avatar_podest.png' });
  ok(!errors.length, 'keine JS-Fehler ' + errors.join(' | '));
  await api(tl.cookie, 'DELETE', '/api/classes/' + cls.data.id);
  await browser.close();
  console.log('Avatare/Coins: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
