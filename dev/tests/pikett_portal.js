// Pikettdienst im Portal (Plan B.6/B.7) gegen einen laufenden Worker (npx wrangler dev -c ../wrangler.jsonc --local --var EXAM_DEV:1)
// Lernende/r angemeldet: Schichtplan vom Server, jede Behebung nachgeprüft, Schichtbericht „vom Server nachgeprüft“, Rang aus dem Konto;
// Portal-Startseite mit Pikett-Einstieg; Dozent sieht die Pikett-Tafel der Klasse im Leitstand.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8787';
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
async function ctx(browser, vp){
  const c = await browser.newContext({ viewport: vp || { width: 1366, height: 860 }, extraHTTPHeaders: { 'cf-connecting-ip': '10.8.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) } });
  const p = await c.newPage(); const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  p.on('console', m => { if(m.type() === 'error' && !/fonts\.g|net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  return { c, p, errors };
}
(async () => {
  const SD = require('./seed_helper')(RUN);
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl.json'), 'utf8'));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const L = await ctx(browser);
  await L.p.goto(BASE + '/'); await L.p.waitForSelector('.gate');
  ok(await L.p.locator('.pk-home a[href="scl/?pikett=1"]').count() === 1 && await L.p.locator('.pk-home a').count() === 4, 'Startseite: Pikett-Einstieg je Programmier-Quest');
  // Anmelden und Spielstand (alle SCL-Aufgaben gelöst) ins Konto legen
  const st = await L.p.evaluate(async ({ u, done }) => {
    const h = { 'content-type': 'application/json', 'x-spsquest': '1' };
    const a = await fetch('/api/login', { method: 'POST', headers: h, body: JSON.stringify(u) });
    const b = await fetch('/api/progress/scl', { method: 'PUT', headers: h, body: JSON.stringify({ state: { v: 4, doneTasks: done, doneTheory: {}, tours: { basic: true, pro: true } }, summary: {}, force: true }) });
    return [a.status, b.status];
  }, { u: SD.students[0], done: Object.fromEntries(meta.tasks.map(t => [t.id, { stars: 3, points: 100 }])) });
  ok(st[0] === 200 && st[1] === 200, 'Lernende/r angemeldet, Spielstand im Konto');
  await L.p.goto(BASE + '/scl/?pikett=1');
  await L.p.waitForSelector('#pikettOverlay .pk-shift', { timeout: 20000 });
  ok(/Angemeldet als/.test(await L.p.textContent('#pikettOverlay')), 'Pikett-Menü: angemeldet, Server prüft');
  await L.p.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; SCLQuest.state.settings.sound = false; });
  await L.p.evaluate(() => SCLQuest.PIKETT.start('tag', 0, { speed: 12 }));
  await L.p.waitForSelector('#pikettBar');
  const sh = await L.p.evaluate(() => ({ id: SCLQuest.PIKETT.shift.serverId, plan: SCLQuest.PIKETT.shift.plan.map(p => p.id) }));
  ok(sh.id > 0 && sh.plan.length >= 1, 'Schichtplan vom Server (Schicht ' + sh.id + ', ' + sh.plan.length + ' Störungen)');
  for(const id of sh.plan){
    await L.p.waitForFunction(id => SCLQuest.session.pikett && SCLQuest.session.pikett.id === id, id, { timeout: 90000 }).catch(async e => { console.log(JSON.stringify(await L.p.evaluate(() => ({ sp: SCLQuest.session.pikett, sh: SCLQuest.PIKETT.shift && { plan: SCLQuest.PIKETT.shift.plan, items: SCLQuest.PIKETT.shift.items, speed: SCLQuest.PIKETT.shift.speed, t: (Date.now() - SCLQuest.PIKETT.shift.t0) / 1000 } })))); throw e; });
    const inc = await L.p.evaluate(id => SCLQuest.PIKETT.incidents().find(x => x.id === id), id);
    await L.p.click('#pkDiag'); await L.p.waitForSelector('#confirmModal.active');
    await L.p.check('input[name="pkCause"][value="' + inc.cause + '"]');
    if(inc.kind === 'hardware') await L.p.selectOption('#pkPart', inc.part);
    if(inc.kind === 'operator'){ await L.p.selectOption('#pkPar', inc.param.var); await L.p.fill('#pkVal', String(inc.param.right)); }
    await L.p.click('#confirmYes');
    if(inc.kind === 'program') await L.p.evaluate(() => { const t = SCLQuest.session.task; if(t.pro) SCLQuest.setProCodes(window.ProTask.refCodes(t)); else SCLQuest.editor.setValue(t.refSolution); });
    await L.p.click('#compileBtn');
    await L.p.waitForFunction(id => { const i = SCLQuest.PIKETT.shift && SCLQuest.PIKETT.shift.items.find(i => i.id === id); return i && i.fixed; }, id, { timeout: 30000 });
    ok(true, inc.kind + '-Störung ' + inc.alarm.no + ' behoben');
  }
  await L.p.click('#pkEnd'); await L.p.click('#confirmYes');
  await L.p.waitForSelector('#pikettOverlay .pk-kpis', { timeout: 20000 });
  const txt = await L.p.textContent('#pikettOverlay');
  ok(/Vom Server nachgeprüft: (\d+) von \1 Behebungen/.test(txt), 'Schichtbericht: alle Behebungen vom Server bestätigt');
  const loc = await L.p.evaluate(() => ({ p: SCLQuest.state.pikett.points, rep: SCLQuest.state.pikett.shifts[0].points }));
  const me = await L.p.evaluate(() => fetch('/api/pikett/me?quest=scl').then(r => r.json()));
  ok(me.points > 0 && me.points === loc.p && me.shiftsList[0].points === loc.rep, 'Rangpunkte aus dem Konto (' + me.points + ')');
  await L.p.fill('#pkHand', 'Greifer 2 nachstellen.'); await L.p.click('#pkDone');
  await L.p.waitForFunction(() => fetch('/api/pikett/me?quest=scl').then(r => r.json()).then(d => d.shiftsList[0].handover === 'Greifer 2 nachstellen.'), null, { timeout: 10000, polling: 500 });
  ok(true, 'Übergabe beim Server gespeichert');
  ok(!L.errors.length, 'Lernende/r: keine JS-Fehler' + (L.errors.length ? ': ' + L.errors.slice(0, 3).join(' | ') : ''));
  L.errors.length = 0;

  // Dozent: Pikett-Tafel
  const T = await ctx(browser);
  await T.p.goto(BASE + '/');
  await T.p.evaluate(u => fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spsquest': '1' }, body: JSON.stringify(u) }), { username: SD.admin.username, password: SD.admin.password });
  const cls = await T.p.evaluate(n => fetch('/api/classes').then(r => r.json()).then(d => d.classes.find(c => c.name === n)), SD.class.name);
  await T.p.goto(BASE + '/#/leitstand/klasse/' + cls.id); await T.p.reload();
  await T.p.waitForSelector('#pkTbl', { timeout: 20000 });
  const tb = await T.p.textContent('#pkPanel');
  ok(tb.includes(SD.students[0].username) && /Greifer 2 nachstellen\./.test(tb), 'Leitstand: Pikett-Tafel mit Rang, Punkten und Übergabe');
  await T.p.screenshot({ path: __dirname + '/shots/pikett_tafel.png', fullPage: true });
  await T.p.click('#pkPanel [data-pq="kop"]'); await T.p.waitForFunction(() => /KOP Quest Pikett/.test(document.getElementById('pkPanel').textContent));
  ok(true, 'Tafel: Quest umschalten');
  // Pikett-Challenge: alle fahren dieselbe Schicht (gleicher Seed), Rangliste nach Punkten des Schichtberichts
  const post = (pg, url, body) => pg.evaluate(([u, b]) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', 'x-spsquest': '1' }, body: JSON.stringify(b) }).then(r => r.json().then(d => ({ status: r.status, data: d }))), [url, body]);
  let r = await post(T.p, '/api/challenges', { mode: 'pikett', quest: 'sensor', maxCh: 5, duration: 120 });
  ok(r.status === 400, 'Pikett-Challenge nicht für die Sensorwerkstatt');
  r = await post(T.p, '/api/challenges', { mode: 'pikett', quest: 'scl', maxCh: 5, duration: 120, classId: cls.id });
  ok(r.status === 201, 'Pikett-Challenge angelegt');
  const lc = r.data;
  r = await post(L.p, '/api/live/join', { code: lc.code });
  ok(r.status === 200 && r.data.challenge.mode === 'pikett' && r.data.challenge.pikett.maxCh === 5 && r.data.challenge.pikett.seed > 0, 'beigetreten: Seed und Kapitel kommen vom Server');
  await T.p.goto(BASE + '/#/beamer/' + lc.id); await T.p.waitForSelector('#bmStart:not([disabled])', { timeout: 15000 });
  ok(/Pikett-Challenge · Tagschicht · Störungen bis Kapitel 5/.test(await T.p.textContent('#bmTitle')), 'Beamer: Titel der Pikett-Challenge');
  await L.p.goto(BASE + '/scl/?live=' + lc.id); await L.p.waitForSelector('#liveOverlay', { timeout: 15000 });
  await T.p.click('#bmStart');
  await L.p.waitForSelector('#pikettBar', { timeout: 15000 });
  const lplan = await L.p.evaluate(() => ({ seed: SCLQuest.PIKETT.shift.seed, plan: SCLQuest.PIKETT.shift.plan.map(p => p.id), chs: SCLQuest.PIKETT.shift.plan.map(p => SCLQuest.PIKETT.incidents().find(x => x.id === p.id).chapter), live: !!SCLQuest.PIKETT.shift.live }));
  ok(lplan.live && lplan.chs.every(c => c <= 5), 'Schicht der Challenge: nur Störungen bis Kapitel 5 (' + lplan.plan.join(', ') + ')');
  const before = await L.p.evaluate(() => SCLQuest.state.pikett.points);
  const id1 = lplan.plan[0];
  await L.p.waitForFunction(id => SCLQuest.session.pikett && SCLQuest.session.pikett.id === id, id1, { timeout: 60000 });
  const inc1 = await L.p.evaluate(id => SCLQuest.PIKETT.incidents().find(x => x.id === id), id1);
  await L.p.click('#pkDiag'); await L.p.waitForSelector('#confirmModal.active');
  await L.p.check('input[name="pkCause"][value="' + inc1.cause + '"]');
  if(inc1.kind === 'hardware') await L.p.selectOption('#pkPart', inc1.part);
  if(inc1.kind === 'operator'){ await L.p.selectOption('#pkPar', inc1.param.var); await L.p.fill('#pkVal', String(inc1.param.right)); }
  await L.p.click('#confirmYes');
  if(inc1.kind === 'program') await L.p.evaluate(() => { const t = SCLQuest.session.task; if(t.pro) SCLQuest.setProCodes(window.ProTask.refCodes(t)); else SCLQuest.editor.setValue(t.refSolution); });
  await L.p.click('#compileBtn');
  await L.p.waitForFunction(id => { const i = SCLQuest.PIKETT.shift && SCLQuest.PIKETT.shift.items.find(i => i.id === id); return i && i.fixed; }, id1, { timeout: 30000 });
  ok(true, 'Challenge: erste Störung behoben');
  // Schicht endet von selbst 10 s vor der Challenge → Bericht → Rangliste
  await L.p.waitForSelector('#pikettOverlay .pk-kpis', { timeout: 150000 });
  ok(/Rangliste der Challenge/.test(await L.p.textContent('#pikettOverlay')), 'Schichtbericht der Challenge (zählt nicht für den Rang)');
  ok(await L.p.evaluate(b => SCLQuest.state.pikett.points === b, before), 'Pikett-Rang unverändert');
  await T.p.waitForFunction(() => /[1-9]\d* P|Punkte/.test(document.getElementById('bmBody').textContent) && document.querySelector('.bm-rank, .podium'), null, { timeout: 30000, polling: 1000 });
  const bs = await T.p.evaluate(id => fetch('/api/challenges/' + id).then(r => r.json()), lc.id);
  const pl = bs.players.find(p => p.username === SD.students[0].username.toLowerCase());
  ok(pl && pl.solved && pl.points > 0, 'Beamer: Punkte aus dem Schichtbericht (' + (pl && pl.points) + ')');
  await L.p.click('#pkDone');
  await L.p.waitForSelector('#liveOverlay .live-card', { timeout: 20000 });
  ok(true, 'Rangliste der Challenge im Spiel');
  await T.p.screenshot({ path: __dirname + '/shots/pikett_challenge_beamer.png' });
  ok(!L.errors.length, 'Challenge Lernende/r: keine JS-Fehler' + (L.errors.length ? ': ' + L.errors.slice(0, 3).join(' | ') : ''));
  ok(!T.errors.length, 'Dozent: keine JS-Fehler' + (T.errors.length ? ': ' + T.errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log('Pikett-Portal: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
