// API-Test Pikettdienst (Plan B.6/B.7) gegen einen laufenden Worker (npx wrangler dev -c ../wrangler.jsonc --local --var EXAM_DEV:1)
// Aufruf: node tests/pikett_api.js [http://localhost:8787]
// Schicht mit Serverplan, Nachprüfung je Störung (falscher Code / falsche Diagnose abgelehnt), Punkte nur aus nachgeprüften
// Behebungen, Rangsperre der Nachtschicht, Übergabe, Pikett-Tafel der Klasse, Pikettchef → Zeile auf der Prüfseite.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const BASE = process.argv[2] || 'http://localhost:8787';
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, msg) => { if(c) oks++; else { fails++; console.log('✗ ' + msg); } };
const IP = () => '10.7.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
function client(ip){
  let cookie = ''; ip = ip || IP();
  return async function call(method, url, body){
    const h = { 'content-type': 'application/json', 'x-spsquest': '1', 'cf-connecting-ip': ip };
    if(cookie) h.cookie = cookie;
    // nach „wrangler d1 execute“ schliesst der lokale Server gelegentlich die offene Verbindung: einmal neu versuchen
    const go = () => fetch(BASE + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const r = await go().catch(e => { if(e.cause && e.cause.code === 'UND_ERR_SOCKET') return go(); throw e; });
    const sc = r.headers.get('set-cookie'); if(sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const text = await r.text(); let data = null; try{ data = JSON.parse(text); }catch(e){ data = text; }
    return { status: r.status, data };
  };
}
const sql = cmd => execFileSync('npx', ['wrangler', 'd1', 'execute', 'spsquest', '-c', '../wrangler.jsonc', '--local', '--command', cmd], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });

(async () => {
  const { PIKETT_DATA } = await import(path.join(__dirname, '..', '..', 'worker', 'gen', 'pikett_data.js'));
  const { ProTask } = await import(path.join(__dirname, '..', '..', 'worker', 'gen', 'exam_bundle.js'));
  const D = PIKETT_DATA.scl, INC = Object.fromEntries(D.incidents.map(x => [x.id, x]));
  const refOf = inc => { const t = D.tasks[inc.base]; return t.pro ? ProTask.refCodes(t) : t.refSolution; };
  const bugOf = inc => globalThis.bugCode(D.tasks[inc.base], D.bugs[inc.bug]);
  const rightDiag = inc => ({ cause: inc.cause, part: inc.kind === 'hardware' ? inc.part : null, param: inc.kind === 'operator' ? { var: inc.param.var, value: inc.param.right } : null });
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl.json'), 'utf8'));
  const done = Object.fromEntries(meta.tasks.map(t => [t.id, { stars: 3, points: 100 }]));

  const SD = require('./seed_helper')(RUN);
  const T = client(), S1 = client(), S2 = client(), anon = client();
  ok((await T('POST', '/api/login', { username: SD.admin.username, password: SD.admin.password })).status === 200, 'Dozent angemeldet');
  ok((await S1('POST', '/api/login', SD.students[0])).status === 200, 'Lernende/r 1 angemeldet');
  ok((await S2('POST', '/api/login', SD.students[1])).status === 200, 'Lernende/r 2 angemeldet');
  ok((await anon('GET', '/api/pikett/me?quest=scl')).status === 401, 'ohne Login gesperrt');

  // Ohne Spielstand keine Störungen
  let r = await S1('POST', '/api/pikett/shifts', { quest: 'scl', shift: 'tag' });
  ok(r.status === 409 && /Aufgaben/.test(r.data.error), 'ohne gelöste Aufgaben keine Schicht');
  ok((await S1('POST', '/api/pikett/shifts', { quest: 'xyz', shift: 'tag' })).status === 400, 'unbekannte Quest');
  await S1('PUT', '/api/progress/scl', { state: { v: 4, doneTasks: done, doneTheory: {} }, summary: {}, force: true });
  r = await S1('GET', '/api/pikett/me?quest=scl');
  ok(r.status === 200 && r.data.rank === 1 && r.data.points === 0, 'Rang Lehrling, 0 Punkte');
  ok((await S1('POST', '/api/pikett/shifts', { quest: 'scl', shift: 'nacht' })).status === 403, 'Nachtschicht als Lehrling gesperrt');
  ok((await S1('POST', '/api/pikett/shifts', { quest: 'scl', shift: 'spaet' })).status === 403, 'Spätschicht als Lehrling gesperrt');

  // Tagschicht: Plan vom Server; jede Behebung wird nachgeprüft
  r = await S1('POST', '/api/pikett/shifts', { quest: 'scl', shift: 'tag' });
  ok(r.status === 200 && r.data.plan.length >= 1 && r.data.plan.every(p => INC[p.id]), 'Tagschicht gestartet, Plan aus Störungen der Quest (' + (r.data.plan || []).length + ')');
  ok(r.data.speedMax === 60, 'Testbetrieb: Zeitraffer erlaubt (' + r.data.speedMax + ')');
  const sid = r.data.id, plan = r.data.plan;
  ok((await S2('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: plan[0].id })).status === 404, 'fremde Schicht gesperrt');
  ok((await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: 'pk_gibtsnicht', diag: { cause: 'prog_logic' } })).status === 400, 'Störung ausserhalb des Plans abgelehnt');
  // Programm-Störung mit Fehlerversion bzw. Hardware mit falschem Bauteil → abgelehnt; danach richtig → bestätigt
  const pg = D.incidents.find(x => x.kind === 'program');
  for(const p of plan){
    const inc = INC[p.id];
    if(inc.kind === 'program'){
      r = await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: p.id, diag: { cause: inc.cause }, code: bugOf(inc), at: p.at, fixedAt: p.at + 30 });
      ok(r.status === 200 && r.data.ok === false, 'Fehlerversion als Behebung abgelehnt (' + p.id + ')');
      r = await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: p.id, diag: { cause: 'hw_sensor', part: 'x' }, code: refOf(inc), at: p.at, fixedAt: p.at + 30 });
      ok(r.data.ok === false, 'Programmstörung mit Hardware-Diagnose abgelehnt');
      r = await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: p.id, diag: { cause: inc.cause }, code: refOf(inc), at: p.at, fixedAt: p.at + 30, fails: 0 });
    } else {
      r = await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: p.id, diag: Object.assign(rightDiag(inc), { part: 'Falsch', param: inc.param ? { var: inc.param.var, value: inc.param.wrong } : null }), at: p.at, fixedAt: p.at + 30 });
      ok(r.status === 200 && r.data.ok === false, 'falsches Bauteil/Parameter abgelehnt (' + p.id + ')');
      r = await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: p.id, diag: rightDiag(inc), at: p.at, fixedAt: p.at + 30 });
    }
    ok(r.status === 200 && r.data.ok === true, 'Behebung bestätigt (' + inc.kind + ' ' + p.id + ')');
  }
  // Schicht vorzeitig beenden: Punkte nur aus Serverdaten, Fehlversuche des Servers zählen
  r = await S1('POST', '/api/pikett/shifts/' + sid + '/end', { early: true, items: plan.map(p => ({ id: p.id, at: p.at })), points: 999999 });
  ok(r.status === 200 && r.data.points > 0 && r.data.points < 5000 && r.data.incidents.every(i => i.fixed && i.fails >= 1), 'Schichtende: Punkte aus nachgeprüften Behebungen, Fehlversuche gezählt (' + r.data.points + ')');
  ok(r.data.night === false && r.data.rank.points === r.data.points, 'Rangpunkte aktualisiert');
  const pts1 = r.data.points;
  ok((await S1('POST', '/api/pikett/shifts/' + sid + '/end', {})).status === 409, 'zweimal beenden abgelehnt');
  ok((await S1('POST', '/api/pikett/shifts/' + sid + '/fix', { incident: plan[0].id })).status === 409, 'nach Schichtende keine Behebung');
  ok((await S1('POST', '/api/pikett/shifts/' + sid + '/handover', { text: 'Band 2 beobachten.' })).status === 200, 'Übergabe gespeichert');

  // Unbestätigte Störung bringt keine Punkte
  r = await S1('POST', '/api/pikett/shifts', { quest: 'scl', shift: 'tag' });
  const sid2 = r.data.id;
  r = await S1('POST', '/api/pikett/shifts/' + sid2 + '/end', { early: true, items: r.data.plan.map(p => ({ id: p.id, at: 0 })) });
  ok(r.status === 200 && r.data.incidents.every(i => !i.fixed && i.points === 0) && r.data.points === 0, 'ohne Nachprüfung 0 Punkte (Browserangaben zählen nicht)');

  // Pikettchef: Punkte per SQL nahe an die Grenze, dann Nachtschichten (Zeitraffer erlaubt im Testbetrieb)
  const uid = JSON.parse(sql("SELECT id FROM users WHERE username = '" + SD.students[0].username.toLowerCase() + "'").toString().replace(/^[^\[]*/, ''))[0].results[0].id;
  sql('UPDATE pikett_ranks SET points = 39000, good_nights = 2, nights = 2, rank = 3 WHERE user_id = ' + uid + " AND quest = 'scl'");
  r = await S1('POST', '/api/pikett/shifts', { quest: 'scl', shift: 'nacht' });
  ok(r.status === 200 && r.data.plan.length >= 3, 'Nachtschicht als Servicetechniker (' + (r.data.plan || []).length + ' Störungen)');
  const sid3 = r.data.id, plan3 = r.data.plan;
  sql('UPDATE pikett_shifts SET started_at = ' + (Date.now() - 25 * 60000) + ' WHERE id = ' + sid3);   // Schichtzeit abgelaufen
  for(const p of plan3){ const inc = INC[p.id]; r = await S1('POST', '/api/pikett/shifts/' + sid3 + '/fix', { incident: p.id, diag: rightDiag(inc), code: inc.kind === 'program' ? refOf(inc) : undefined, at: p.at, fixedAt: p.at + 20 }); ok(r.data.ok, 'Nacht: ' + p.id + ' bestätigt'); }
  r = await S1('POST', '/api/pikett/shifts/' + sid3 + '/end', { items: plan3.map(p => ({ id: p.id, at: p.at })) });
  ok(r.status === 200 && r.data.night && r.data.availability >= 0.9, 'Nachtschicht zählt (Verfügbarkeit ' + r.data.availability + ')');
  ok(r.data.rank.rank === 4 && r.data.rank.rankName === 'Pikettchef' && r.data.rank.reachedAt && r.data.rankUp, 'Rang Pikettchef erreicht');
  r = await S1('GET', '/api/pikett/me?quest=scl');
  ok(r.data.rank === 4 && r.data.goodNights === 3 && r.data.shiftsList.length === 3 && r.data.shiftsList.some(s => s.handover === 'Band 2 beobachten.'), 'eigener Rang und Schichtliste');

  // Zertifikat Profi-Stufe derselben Quest: Prüfseite zeigt „Pikettbereit“ (Zeile aus pikett_ranks)
  const A4 = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''), code = 'SPSQ-' + A4() + '-' + A4();
  sql("INSERT INTO certificates (id, user_id, exam_id, quest, level, holder_name, score, distinction, proctored, issued_at) VALUES ('" + code + "', " + uid + ", NULL, 'scl', 'profi', 'Test Person', 0.9, 1, 0, " + Date.now() + ")");
  r = await anon('GET', '/api/certificates/' + code);
  ok(r.status === 200 && r.data.pikett && r.data.pikett.rank === 'Pikettchef', 'Zertifikat: Pikett-Nachweis ' + JSON.stringify(r.data && r.data.pikett));
  const page = await (await fetch(BASE + '/z/' + code)).text();
  ok(/Pikettbereit – Rang Pikettchef/.test(page), 'Prüfseite /z/: Zeile „Pikettbereit“');
  // Leitstand: Pikett-Tafel
  const cls = (await T('GET', '/api/classes')).data.classes.find(c => c.name === SD.class.name);
  r = await T('GET', '/api/classes/' + cls.id + '/pikett?quest=scl');
  const row = r.status === 200 && r.data.students.find(s => s.username === SD.students[0].username.toLowerCase());
  ok(row && row.rank === 4 && row.points >= 40000 && r.data.students.length === 3, 'Pikett-Tafel: Rang und Punkte je Lernende/r');
  ok(r.data.shifts.length === 3 && r.data.shifts.some(s => s.handover), 'Pikett-Tafel: Schichten mit Übergabe');
  ok((await S2('GET', '/api/classes/' + cls.id + '/pikett?quest=scl')).status === 403, 'Lernende sehen keine Tafel');
  ok(pts1 > 0, 'Punkte Tagschicht');
  console.log('Pikett-API: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
