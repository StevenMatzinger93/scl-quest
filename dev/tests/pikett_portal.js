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
  ok(!T.errors.length, 'Dozent: keine JS-Fehler' + (T.errors.length ? ': ' + T.errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log('Pikett-Portal: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
