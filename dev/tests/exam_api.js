// API-Test Prüfungen + Zertifikate gegen einen laufenden Worker (npx wrangler dev -c ../wrangler.jsonc --local)
// Aufruf: node tests/exam_api.js [http://localhost:8787]   — lokale .dev.vars mit EXAM_DEV=1, solange die Pools im Aufbau sind
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const BASE = process.argv[2] || 'http://localhost:8787';
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, msg) => { if(c) oks++; else { fails++; console.log('✗ ' + msg); } };
const IP = () => '10.6.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
function client(ip){
  let cookie = ''; ip = ip || IP();
  return async function call(method, url, body, headers){
    const h = Object.assign({ 'content-type': 'application/json', 'x-spsquest': '1', 'cf-connecting-ip': ip }, headers || {});
    if(cookie) h.cookie = cookie;
    const r = await fetch(BASE + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if(sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const text = await r.text(); let data = null; try{ data = JSON.parse(text); }catch(e){ data = text; }
    return { status: r.status, data };
  };
}
const sql = cmd => execFileSync('npx', ['wrangler', 'd1', 'execute', 'spsquest', '-c', '../wrangler.jsonc', '--local', '--command', cmd], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });

(async () => {
  const { Exam } = await import(path.join(__dirname, '..', '..', 'worker', 'gen', 'exam_bundle.js'));
  const meta = q => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', q + '.json'), 'utf8'));
  // Parameter einer gezogenen Aufgabe aus der öffentlichen Sicht rekonstruieren (Test kennt den Seed nicht)
  const recover = pub => { const def = Exam.taskDef(pub.id); for(const p of Exam.allParams(def)){ const it = Exam.instantiate(def, p); if(JSON.stringify(Exam.publicItem(it)) === JSON.stringify(pub)) return it; } return null; };
  const rightAnswer = pq => { const d = Exam.questionDef(pq.id); return pq.options.indexOf(d.options[d.answer]); };
  const refOf = it => it.kind === 'grund' ? it.ref : Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.ref]));
  const done = (q, a, b) => Object.fromEntries(meta(q).tasks.filter(t => t.ch >= a && t.ch <= b).map(t => [t.id, { stars: 3, points: 100 }]));

  const SD = require('./seed_helper')(RUN);
  const T = client(), S1 = client(), S2 = client(), anon = client();
  ok((await T('POST', '/api/login', { username: SD.admin.username, password: SD.admin.password })).status === 200, 'Dozent (Seed-Admin) angemeldet');
  ok((await S1('POST', '/api/login', SD.students[0])).status === 200, 'Lernende/r 1 angemeldet');
  ok((await S2('POST', '/api/login', SD.students[1])).status === 200, 'Lernende/r 2 angemeldet');

  // Voraussetzungen
  let r = await S1('GET', '/api/exams/eligibility?quest=scl');
  ok(r.status === 200 && !r.data.levels.grund.ok && r.data.levels.grund.missing.some(m => /80 %/.test(m)), 'ohne Fortschritt nicht zugelassen ' + JSON.stringify(r.data).slice(0, 200));
  ok((await S1('POST', '/api/exams', { quest: 'scl', level: 'grund' })).status === 403, 'Start ohne Voraussetzungen abgelehnt');
  ok((await T('POST', '/api/exams', { quest: 'scl', level: 'grund' })).status === 403, 'Admin kann keine Prüfung ablegen');
  await S1('PUT', '/api/progress/scl', { state: { v: 4, doneTasks: done('scl', 1, 10), doneTheory: {} }, summary: {}, force: true });
  r = await S1('GET', '/api/exams/eligibility?quest=scl');
  ok(r.data.levels.grund.ok && !r.data.levels.profi.ok && r.data.levels.profi.missing.some(m => /Grundstufe/.test(m)), 'nach Fortschritt zugelassen, Profi braucht Grundstufe');

  // Prüfung starten: keine verdeckten Tests, keine Referenz im Browser
  r = await S1('POST', '/api/exams', { quest: 'scl', level: 'grund' });
  ok(r.status === 201 && r.data.exam.state === 'running' && r.data.tasks.length >= 1, 'Prüfung gestartet ' + r.status);
  const ex = r.data, eid = ex.exam.id;
  const raw = JSON.stringify(ex);
  const items = ex.tasks.map(recover);
  ok(items.every(Boolean), 'Aufgaben eindeutig (Parameter rekonstruierbar)');
  ok(!/"ref"|"hidden"|"wrong"|"answer":\d/.test(raw) && items.every(it => !raw.includes(JSON.stringify(it.hidden))), 'keine verdeckten Tests / Referenz / Antworten im Browser');
  ok(ex.exam.deadline - ex.exam.startedAt === 60 * 60000, 'Grundstufe: 60 Minuten');
  ok((await S1('POST', '/api/exams', { quest: 'scl', level: 'grund' })).data.exam.id === eid, 'zweiter Start setzt die laufende Prüfung fort');
  ok((await S2('GET', '/api/exams/' + eid)).status === 404, 'fremde Prüfung nicht lesbar');

  // Abgaben: falsch, Kompilierfehler, richtig; Punkte vom Browser werden ignoriert
  const t0 = items[0];
  r = await S1('POST', '/api/exams/' + eid + '/answer', { item: t0.id, answer: 'Alarm := ;', points: 1, ok: true });
  ok(r.status === 200 && r.data.result.ok === false && r.data.result.error && r.data.result.error.line >= 1, 'Kompilierfehler mit Zeile');
  const wrong = Exam.taskDef(t0.id).wrong[0](t0.params);
  r = await S1('POST', '/api/exams/' + eid + '/answer', { item: t0.id, answer: t0.kind === 'grund' ? wrong : Object.assign(refOf(t0), wrong) });
  ok(r.data.result.ok === false && r.data.result.passed < r.data.result.total && !JSON.stringify(r.data).includes('expected'), 'Fehlversion scheitert, ohne erwartete Werte ' + JSON.stringify(r.data.result));
  for(const it of items){ r = await S1('POST', '/api/exams/' + eid + '/answer', { item: it.id, answer: refOf(it) }); ok(r.data.result && r.data.result.ok, 'Referenz besteht: ' + it.id); }
  for(const q of ex.questions){ r = await S1('POST', '/api/exams/' + eid + '/answer', { item: q.id, answer: rightAnswer(q) }); ok(r.data.saved && !('ok' in r.data), 'Theorie gespeichert ohne Rückmeldung'); }
  ok((await S1('POST', '/api/exams/' + eid + '/answer', { item: 'gibtsnicht', answer: 'x' })).status === 404, 'unbekannte Aufgabe 404');
  ok((await S1('POST', '/api/exams/' + eid + '/focus', {})).status === 200, 'Fokusverlust gezählt');
  r = await S1('POST', '/api/exams/' + eid + '/submit', {});
  ok(r.status === 200 && r.data.exam.state === 'submitted' && r.data.result.passed && r.data.result.score === 1 && r.data.result.distinction, 'abgeschlossen: bestanden mit Auszeichnung ' + JSON.stringify(r.data.result));
  ok((await S1('POST', '/api/exams/' + eid + '/answer', { item: t0.id, answer: 'x' })).status === 409, 'nach Abschluss keine Abgabe');
  r = await S1('POST', '/api/exams', { quest: 'scl', level: 'grund' });
  ok(r.status === 429 && r.data.nextAt > Date.now(), 'Wartefrist 24 h');

  // Zertifikat
  ok((await S1('POST', '/api/certificates', { examId: eid, holderName: 'Test Person' })).status === 400, 'ohne Einwilligung kein Zertifikat');
  ok((await S1('POST', '/api/certificates', { examId: eid, holderName: 'x', consent: true })).status === 400, 'Name zu kurz');
  ok((await S2('POST', '/api/certificates', { examId: eid, holderName: 'Fremd Name', consent: true })).status === 404, 'fremde Prüfung: kein Zertifikat');
  const coins0 = (await S1('GET', '/api/avatar')).data;
  r = await S1('POST', '/api/certificates', { examId: eid, holderName: 'Anna-Lena Müller ' + RUN.replace(/\d/g, 'x'), consent: true });
  ok(r.status === 201 && /^SPSQ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.data.certificate.code), 'Zertifikat ausgestellt ' + JSON.stringify(r.data));
  const code = r.data.certificate.code;
  ok((await S1('POST', '/api/certificates', { examId: eid, holderName: 'Anders', consent: true })).data.certificate.code === code, 'zweimal ausstellen liefert dasselbe Zertifikat');
  // Paket P: Zertifikat → Coins (+500 mit Auszeichnung, nur einmal) und Meister-Teil freigeschaltet
  const coins1 = (await S1('GET', '/api/avatar')).data;
  ok(coins1.coins.balance - coins0.coins.balance === 500 && coins1.unlock.certs === 1 && coins0.unlock.certs === 0, 'Zertifikat mit Auszeichnung: +500 Coins, Meister-Anhänger frei (' + coins0.coins.balance + ' → ' + coins1.coins.balance + ')');
  const buyM = await S1('POST', '/api/avatar/buy', { item: 'helm_meister' });
  ok(buyM.status === 403 && /Profi-Zertifikat/.test(buyM.data.error || ''), 'Meister-Helm braucht ein Profi-Zertifikat: ' + (buyM.data.error || buyM.status));
  r = await anon('GET', '/api/certificates/' + code);
  ok(r.data.status === 'valid' && r.data.holder.startsWith('Anna-Lena') && r.data.score === 100 && r.data.proctored === false && !('user_id' in r.data) && !('username' in r.data), 'Prüf-API: gültig, keine weiteren Daten');
  r = await anon('GET', '/z/' + code);
  ok(r.status === 200 && /Zertifikat gültig/.test(r.data) && /og:title/.test(r.data) && /Kein Zertifikat der Siemens AG/.test(r.data), 'Prüfseite /z/ mit Open Graph und Markenhinweis');
  ok((await anon('GET', '/z/SPSQ-AAAA-AAAA')).status === 404, 'unbekannter Code 404');
  ok((await anon('GET', '/z/%3Cscript%3E')).status !== 500, 'Prüfseite robust gegen Unsinn');
  r = await S1('GET', '/api/exams/eligibility?quest=scl');
  ok(r.data.levels.grund.certificate === code && r.data.levels.profi.missing.some(m => /80 %/.test(m)) && !r.data.levels.profi.missing.some(m => /Grundstufe/.test(m)), 'Profi: Grundstufe erfüllt, Fortschritt fehlt');

  // Profi: nicht bestanden → kein Zertifikat
  await S1('PUT', '/api/progress/scl', { state: { v: 4, doneTasks: Object.assign(done('scl', 1, 10), done('scl', 11, 15)), doneTheory: {} }, summary: {}, force: true });
  r = await S1('POST', '/api/exams', { quest: 'scl', level: 'profi' });
  ok(r.status === 201 && r.data.exam.deadline - r.data.exam.startedAt === 90 * 60000, 'Profi gestartet (90 min)');
  const pid = r.data.exam.id;
  r = await S1('POST', '/api/exams/' + pid + '/submit', {});
  ok(r.data.exam.state === 'submitted' && !r.data.result.passed && r.data.result.weakChapters.length, 'leer abgegeben: nicht bestanden, schwache Kapitel');
  ok((await S1('POST', '/api/certificates', { examId: pid, holderName: 'Test Person', consent: true })).status === 409, 'nicht bestanden: kein Zertifikat');

  // Ablauf der Zeit: serverseitig
  await S2('PUT', '/api/progress/kop', { state: { v: 4, doneTasks: done('kop', 1, 10), doneTheory: {} }, summary: {}, force: true });
  r = await S2('POST', '/api/exams', { quest: 'kop', level: 'grund' });
  const kid = r.data.exam.id;
  sql('UPDATE exams SET deadline = ' + (Date.now() - 60000) + ' WHERE id = ' + kid);
  r = await S2('POST', '/api/exams/' + kid + '/answer', { item: r.data.tasks[0].id, answer: 'x' });
  ok(r.status === 409, 'Abgabe nach Ablauf + Kulanz abgelehnt');
  ok((await S2('GET', '/api/exams/' + kid)).data.exam.state === 'expired', 'Prüfung abgelaufen');

  // Unter Aufsicht: Dozent legt Sitzung an, Voraussetzungen im Spiel entfallen, Annullieren
  ok((await S1('POST', '/api/exam-sessions', { quest: 'fup', level: 'grund' })).status === 403, 'Lernende legen keine Sitzung an');
  ok((await T('POST', '/api/me/display-name', { displayName: 'S. Muster, Berufsfachschule' })).status === 200, 'Anzeigename für Zertifikate');
  const cls = (await T('GET', '/api/classes')).data.classes.find(c => c.name === SD.class.name);
  r = await T('POST', '/api/exam-sessions', { quest: 'fup', level: 'grund', classId: cls.id, minutes: 90 });
  ok(r.status === 201 && /^[A-Z2-9]{6}$/.test(r.data.code), 'Prüfungssitzung angelegt');
  const sess = r.data;
  r = await S2('POST', '/api/exams', { quest: 'fup', level: 'grund', sessionCode: sess.code.toLowerCase() });
  ok(r.status === 201 && r.data.exam.proctored && /S\. Muster/.test(r.data.exam.proctor), 'Beitritt mit Code (ohne Spielfortschritt) ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 160));
  const fid = r.data.exam.id;
  ok((await S2('POST', '/api/exams', { quest: 'kop', level: 'grund', sessionCode: sess.code })).status === 400, 'Code passt nicht zur Quest');
  await S2('POST', '/api/exams/' + fid + '/focus', {}); await S2('POST', '/api/exams/' + fid + '/focus', {});
  r = await T('GET', '/api/exam-sessions/' + sess.id);
  ok(r.status === 200 && r.data.exams.length === 1 && r.data.exams[0].focusLost === 2 && r.data.exams[0].state === 'running', 'Dozent sieht Teilnehmende und Fokusverluste');
  ok((await T('GET', '/api/exam-sessions')).data.sessions.some(s => s.id === sess.id), 'Sitzungsliste');
  ok((await T('POST', '/api/exams/' + fid + '/void', {})).status === 400, 'Annullieren braucht Begründung');
  ok((await T('POST', '/api/exams/' + fid + '/void', { reason: 'Test: Handy benutzt' })).status === 200, 'Prüfung annulliert');
  r = await S2('GET', '/api/exams/' + fid);
  ok(r.data.exam.state === 'voided' && r.data.exam.voidReason === 'Test: Handy benutzt', 'Lernende sehen die Annullierung');
  ok((await T('DELETE', '/api/exam-sessions/' + sess.id)).status === 200, 'Sitzung geschlossen');
  ok((await S1('POST', '/api/exams', { quest: 'fup', level: 'grund', sessionCode: sess.code })).status === 403, 'nach dem Schliessen kein Beitritt');
  r = await T('GET', '/api/classes/' + cls.id + '/certificates');
  ok(r.status === 200 && r.data.certificates.some(c => c.code === code) && r.data.exams.some(e => e.id === fid && e.state === 'voided'), 'Klassenansicht: Zertifikate und Prüfungen');

  // Zurückziehen und Widerruf
  ok((await S2('DELETE', '/api/certificates/' + code)).status === 404, 'fremdes Zertifikat nicht zurückziehbar');
  ok((await S1('DELETE', '/api/certificates/' + code)).status === 200, 'Inhaber zieht Zertifikat zurück');
  r = await anon('GET', '/api/certificates/' + code);
  ok(r.data.status === 'withdrawn' && !r.data.holder, 'zurückgezogen: Name nicht mehr sichtbar');
  const coins2 = (await S1('GET', '/api/avatar')).data;
  ok(coins2.unlock.certs === 0 && coins2.coins.speedrun === coins1.coins.speedrun, 'zurückgezogen: Coins bleiben, Meister-Freischaltung ruht ' + JSON.stringify([coins1.coins, coins2.coins, coins2.unlock]));
  ok((await T('POST', '/api/certificates/' + code + '/revoke', { reason: 'x' })).status === 404, 'bereits ungültig: kein Widerruf');
  ok((await S1('POST', '/api/certificates/' + code + '/revoke', { reason: 'x' })).status === 403, 'nur Admin widerruft');
  ok((await T('GET', '/api/admin/certificates')).data.certificates.some(c => c.code === code && c.status === 'withdrawn'), 'Admin-Übersicht');

  // Kernpfad (Paket P): Zulassung zählt je Quest die Kernaufgaben und zeigt „x/y Kernaufgaben“
  const S3 = client(); ok((await S3('POST', '/api/login', SD.students[2])).status === 200, 'Lernende/r 3 angemeldet');
  for(const q of ['scl', 'kop', 'fup', 'awl']){
    const QT = (await import(path.join(__dirname, '..', '..', 'worker', 'gen', 'exam_bundle.js'))).QUEST_TASKS[q].filter(t => t.ch <= 10);
    const core = QT.filter(t => t.core), tr = QT.filter(t => !t.core), fin = core.filter(t => t.final), need = Math.ceil(0.8 * core.length);
    // alle Trainingsaufgaben + zu wenige Kernaufgaben (ohne Final Boss): Training zählt nicht
    const some = core.filter(t => !t.final).slice(0, need - 1).concat(tr);
    await S3('PUT', '/api/progress/' + q, { state: { v: 4, doneTasks: Object.fromEntries(some.map(t => [t.id, { stars: 3 }])), doneTheory: {} }, summary: {}, force: true });
    r = await S3('GET', '/api/exams/eligibility?quest=' + q);
    const g = r.data.levels.grund;
    ok(g.total === core.length && g.solved === need - 1 && !g.ok && g.missing.some(m => m.includes('Kernaufgaben') && m.includes((need - 1) + '/' + core.length)), q + ': Zulassung zeigt ' + g.solved + '/' + g.total + ' Kernaufgaben ' + JSON.stringify(g.missing));
    const all = fin.concat(core.filter(t => !t.final).slice(0, need - fin.length));
    await S3('PUT', '/api/progress/' + q, { state: { v: 4, doneTasks: Object.fromEntries(all.map(t => [t.id, { stars: 3 }])), doneTheory: {} }, summary: {}, force: true });
    r = await S3('GET', '/api/exams/eligibility?quest=' + q);
    ok(r.data.levels.grund.ok && r.data.levels.grund.solved >= need, q + ': 80 % der Kernaufgaben + Final Boss reichen (' + r.data.levels.grund.solved + '/' + r.data.levels.grund.total + ')');
  }

  // Rate-Limit Prüfcode
  const rl = client(IP()); let last;
  for(let i = 0; i < 61; i++) last = await rl('GET', '/api/certificates/SPSQ-ABCD-EFGH');
  ok(last.status === 429, 'Rate-Limit Prüfcode (' + last.status + ')');

  // Konto löschen: Zertifikate bleiben prüfbar, ausser ausdrücklich mitgelöscht
  console.log('Prüfungs-API: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
