// API-Test gegen einen laufenden Worker (npx wrangler dev -c ../wrangler.jsonc --local)
// Aufruf: node tests/api.js [http://localhost:8787]   — Admin aus ../.dev.vars
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
let fails = 0, oks = 0;
const ok = (c, msg) => { if(c) oks++; else { fails++; console.log('✗ ' + msg); } };
function client(){
  let cookie = '';
  return async function call(method, url, body, headers){
    const h = Object.assign({ 'content-type': 'application/json', 'x-spsquest': '1' }, headers || {});
    if(cookie) h.cookie = cookie;
    const r = await fetch(BASE + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if(sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    let data = null; try{ data = await r.json(); }catch(e){}
    return { status: r.status, data };
  };
}
const RUN = Date.now().toString(36).slice(-5);
(async () => {
  const admin = client(), teacher = client(), stud = client(), stud2 = client(), anon = client();
  // Grundlagen
  ok((await anon('GET', '/api/health')).status === 200, 'health');
  ok((await anon('GET', '/api/me')).data.user === null, 'me ohne Login: user null');
  ok((await anon('POST', '/api/login', { username: 'x', password: 'y' }, { 'x-spsquest': '' })).status === 403, 'CSRF-Header nötig');
  const home = await fetch(BASE + '/'); ok(home.status === 200, 'Startseite ausgeliefert');
  // Admin
  let r = await admin('POST', '/api/login', { username: vars.ADMIN_USER, password: 'falsch' });
  ok(r.status === 401, 'Admin falsches Passwort');
  r = await admin('POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  ok(r.status === 200 && r.data.user.role === 'admin', 'Admin-Login ' + JSON.stringify(r.data));
  r = await admin('POST', '/api/admin/teachers', { username: 'doz_' + RUN });
  ok(r.status === 201 && r.data.password, 'Dozent anlegen');
  const tPw = r.data.password;
  ok((await admin('POST', '/api/admin/teachers', { username: 'doz_' + RUN })).status === 409, 'doppelter Name 409');
  ok((await admin('POST', '/api/admin/teachers', { username: vars.ADMIN_USER })).status === 409, 'Admin-Name gesperrt');
  ok((await admin('POST', '/api/admin/teachers', { username: 'mit leer' })).status === 400, 'ungültiger Name');
  r = await admin('GET', '/api/admin/teachers');
  ok(r.data.teachers.some(t => t.username === 'doz_' + RUN), 'Dozentenliste');
  // Dozent
  r = await teacher('POST', '/api/login', { username: 'doz_' + RUN, password: tPw });
  ok(r.status === 200 && r.data.user.mustChange, 'Dozent-Login, muss Passwort ändern');
  ok((await teacher('POST', '/api/me/password', { old: tPw, password: 'kurz' })).status === 400, 'zu kurzes Passwort');
  ok((await teacher('POST', '/api/me/password', { old: tPw, password: 'neues-passwort' })).status === 200, 'Passwort ändern');
  ok((await teacher('GET', '/api/me')).data.user.mustChange === false, 'mustChange weg');
  ok((await teacher('GET', '/api/admin/teachers')).status === 403, 'Dozent darf nicht in Admin');
  r = await teacher('POST', '/api/classes', { name: 'EM 3a' });
  ok(r.status === 201 && /^[A-Z0-9]{6}$/.test(r.data.code), 'Klasse anlegen');
  const cls = r.data;
  ok((await anon('GET', '/api/class-info?code=' + cls.code)).data.name === 'EM 3a', 'Klassencode prüfen');
  // Selbstanmeldung
  r = await stud('POST', '/api/register', { code: cls.code.toLowerCase(), username: 'Fuchs_' + RUN, password: 'geheim1' });
  ok(r.status === 201 && r.data.user.class.name === 'EM 3a' && !r.data.user.noticeAck, 'Selbstanmeldung ' + JSON.stringify(r.data));
  ok((await anon('POST', '/api/register', { code: 'ZZZZZZ', username: 'x_' + RUN, password: 'geheim1' })).status === 404, 'falscher Klassencode');
  ok((await stud('POST', '/api/me/notice', {})).status === 200, 'Hinweis bestätigt');
  // Dozent erzeugt Konten
  r = await teacher('POST', '/api/classes/' + cls.id + '/students', { prefix: 'em' + RUN + '_', count: 3 });
  ok(r.status === 201 && r.data.created.length === 3, 'Konten erzeugen');
  const gen = r.data.created[0];
  r = await stud2('POST', '/api/login', { username: gen.username, password: gen.password });
  ok(r.status === 200 && r.data.user.mustChange, 'erzeugtes Konto Login');
  // Fortschritt
  const state = { v: 4, name: 'Echter Name', doneTasks: { c1_t1: { stars: 3 } }, drafts: { c1_t2: 'x := 1;' } };
  r = await stud('PUT', '/api/progress/scl', { state, summary: { tasks: 1, theory: 0, points: 100, ch: 1, current: 'Kapitel 1' }, base: 0 });
  ok(r.status === 200 && r.data.updatedAt, 'Fortschritt speichern');
  const t1 = r.data.updatedAt;
  r = await stud('GET', '/api/progress/scl');
  ok(r.data.state.doneTasks.c1_t1.stars === 3 && r.data.state.name === undefined, 'Fortschritt laden, Name nicht gespeichert');
  r = await stud('PUT', '/api/progress/scl', { state, summary: { tasks: 1, points: 100 }, base: t1 });
  ok(r.status === 200, 'zweites Speichern');
  r = await stud('PUT', '/api/progress/scl', { state, summary: { tasks: 1, points: 100 }, base: t1 });
  ok(r.status === 409, 'Konflikt bei veralteter Basis');
  ok((await stud('PUT', '/api/progress/xyz', { state })).status === 404, 'unbekannte Quest');
  // Dozent sieht Klasse und Code
  r = await teacher('GET', '/api/classes/' + cls.id);
  const me = r.data.students.find(s => s.username === 'Fuchs_' + RUN);
  if(!(me && me.progress.scl)) console.log(JSON.stringify(r.data));
  ok(r.data.students.length === 4 && me && me.progress.scl && me.progress.scl.points === 100, 'Klassenübersicht');
  r = await teacher('GET', '/api/students/' + me.id + '/progress/scl');
  ok(r.data.state && r.data.state.drafts.c1_t2 === 'x := 1;', 'Dozent sieht Code');
  // Fremder Dozent sieht nichts
  const t2 = client();
  const d2 = await admin('POST', '/api/admin/teachers', { username: 'doz2_' + RUN, password: 'passwort-2' });
  await t2('POST', '/api/login', { username: 'doz2_' + RUN, password: 'passwort-2' });
  ok((await t2('GET', '/api/classes/' + cls.id)).status === 404, 'fremde Klasse gesperrt');
  ok((await t2('GET', '/api/students/' + me.id + '/progress/scl')).status === 404, 'fremder Schüler gesperrt');
  ok((await stud('GET', '/api/classes/' + cls.id)).status === 403, 'Schüler sieht keine Klasse');
  // Passwort-Reset durch Dozent
  r = await teacher('POST', '/api/students/' + me.id + '/reset', {});
  ok(r.status === 200 && r.data.password, 'Reset');
  ok((await stud('GET', '/api/me')).data.user === null, 'Sitzung nach Reset beendet');
  r = await stud('POST', '/api/login', { username: 'fuchs_' + RUN, password: r.data.password });
  ok(r.status === 200 && r.data.user.mustChange, 'Login mit neuem Passwort (Gross-/Kleinschreibung egal)');
  // Selbstanmeldung schliessen, Code neu
  r = await teacher('PATCH', '/api/classes/' + cls.id, { selfSignup: false, newCode: true });
  ok(r.data.class.code !== cls.code && !r.data.class.selfSignup, 'Klasse ändern');
  ok((await anon('POST', '/api/register', { code: r.data.class.code, username: 'zu_' + RUN, password: 'geheim1' })).status === 404, 'Anmeldung geschlossen');
  // Live-Challenge
  r = await teacher('POST', '/api/challenges', { mode: 'sprint', taskId: 'r1t1', duration: 300, classId: cls.id });
  ok(r.status === 201 && /^[1-9]\d{3}$/.test(r.data.code), 'Challenge anlegen ' + JSON.stringify(r.data));
  const chal = r.data;
  ok((await stud('POST', '/api/challenges', { mode: 'sprint', taskId: 'r1t1' })).status === 403, 'Schüler darf keine Challenge anlegen');
  ok((await teacher('POST', '/api/challenges', { mode: 'bug', taskId: 'c1_boss' })).status === 400, 'Störungsjagd ohne Szenario');
  const s2 = client(); await s2('POST', '/api/login', { username: gen.username, password: gen.password });
  ok((await stud('POST', '/api/live/join', { code: '0000' })).status === 404, 'falscher Beitrittscode');
  r = await stud('POST', '/api/live/join', { code: chal.code });
  ok(r.status === 200 && r.data.challenge.state === 'lobby', 'Beitritt');
  ok((await s2('POST', '/api/live/join', { code: chal.code })).status === 200, 'zweiter Beitritt');
  ok((await stud('POST', '/api/live/' + chal.id + '/attempt', { ok: true })).status === 409, 'vor dem Start keine Versuche');
  ok((await t2('GET', '/api/challenges/' + chal.id)).status === 404, 'fremder Dozent sieht Beamer nicht');
  ok((await teacher('POST', '/api/challenges/' + chal.id + '/start', {})).status === 200, 'Start');
  ok((await teacher('POST', '/api/challenges/' + chal.id + '/start', {})).status === 409, 'doppelter Start');
  await stud('POST', '/api/live/' + chal.id + '/attempt', { ok: false });
  await stud('POST', '/api/live/' + chal.id + '/hint', {});
  r = await stud('POST', '/api/live/' + chal.id + '/attempt', { ok: true, code: 'Greifer_Auf := TRUE;' });
  ok(r.data.solved && r.data.points >= 100 && r.data.points <= 1000, 'Lösung gewertet: ' + r.data.points);
  r = await s2('POST', '/api/live/' + chal.id + '/attempt', { ok: true, code: 'Greifer_Auf := 1 = 1;' });
  const p2 = r.data.points;
  ok(p2 > 0, 'zweite Lösung');
  r = await stud('GET', '/api/live/' + chal.id);
  ok(r.data.me.solved && r.data.me.rank === 2 && r.data.solved === 2 && r.data.top[0].points === p2, 'Rangliste für Schüler ' + JSON.stringify(r.data.me));
  r = await teacher('GET', '/api/challenges/' + chal.id);
  ok(r.data.players.length >= 2 && r.data.players[0].rank === 1 && r.data.players[0].hasCode, 'Beamer-Rangliste');
  const uid = r.data.players[0].userId;
  await teacher('POST', '/api/challenges/' + chal.id + '/show', { userId: uid });
  r = await teacher('GET', '/api/challenges/' + chal.id);
  ok(r.data.shown && r.data.shown.code === 'Greifer_Auf := 1 = 1;' && !('username' in r.data.shown), 'Lösung anonym gezeigt');
  ok((await teacher('POST', '/api/challenges/' + chal.id + '/stop', {})).status === 200, 'Stopp');
  ok((await stud('POST', '/api/live/' + chal.id + '/attempt', { ok: false })).status === 409, 'nach dem Ende keine Versuche');
  ok((await anon('POST', '/api/live/join', { code: chal.code })).status === 401, 'Beitritt nur mit Konto');
  ok((await teacher('GET', '/api/challenges')).data.challenges[0].state === 'ended', 'Challenge-Liste');
  // Challenge nur für die eigene Klasse
  const cOther = await t2('POST', '/api/classes', { name: 'Andere' });
  const ch2 = await t2('POST', '/api/challenges', { mode: 'bug', taskId: 'c1_boss', bugId: 's1_bilanz', classId: cOther.data.id });
  ok((await stud('POST', '/api/live/join', { code: ch2.data.code })).status === 403, 'fremde Klasse gesperrt');
  await t2('DELETE', '/api/classes/' + cOther.data.id);
  // Feedback
  ok((await stud('POST', '/api/feedback', { answers: {} })).status === 400, 'leeres Feedback abgelehnt');
  ok((await stud('POST', '/api/feedback', { answers: { verstaendlich: 4, spass: 5, niveau: 'passend', geraet: 'Handy', gut: 'Die 3D-Anlage', x: 'y', anlage: 9 } })).status === 201, 'Feedback senden');
  await s2('POST', '/api/feedback', { answers: { verstaendlich: 2, niveau: 'zu schwer', stoerend: 'Kapitel 6 zu schnell' } });
  r = await teacher('GET', '/api/feedback?classId=' + cls.id);
  ok(r.data.n === 2 && r.data.avg.verstaendlich === 3 && r.data.choices.niveau['zu schwer'] === 1 && r.data.texts.gut[0].text === 'Die 3D-Anlage' && r.data.avg.anlage === null, 'Feedback-Auswertung ' + JSON.stringify(r.data).slice(0, 200));
  ok(!JSON.stringify(r.data).includes('Fuchs_'), 'Feedback ohne Namen');
  ok((await t2('GET', '/api/feedback?classId=' + cls.id)).status === 404, 'fremde Klasse: kein Feedback');
  ok((await stud('GET', '/api/feedback?classId=' + cls.id)).status === 403, 'Schüler sieht keine Auswertung');
  ok((await admin('GET', '/api/feedback')).data.n >= 2, 'Admin sieht alles');
  // Rate-Limit
  const rl = client();
  let last;
  for(let i = 0; i < 6; i++) last = await rl('POST', '/api/login', { username: gen.username, password: 'falsch' + i });
  ok(last.status === 429, 'Sperre nach 5 Fehlversuchen (' + last.status + ')');
  ok((await rl('POST', '/api/login', { username: gen.username, password: gen.password })).status === 429, 'auch richtiges Passwort gesperrt');
  // Feedback / Fehler melden (Knopf 💬) – auch ohne Login
  const ip = { 'cf-connecting-ip': '10.9.' + (Date.now() % 250) + '.' + Math.floor(Math.random() * 250) };
  ok((await anon('POST', '/api/reports', { type: 'fehler', message: '   ' }, ip)).status === 400, 'Meldung: leerer Text abgelehnt');
  ok((await anon('POST', '/api/reports', { type: 'lob', message: 'x' }, ip)).status === 400, 'Meldung: ungültiger Typ');
  ok((await anon('POST', '/api/reports', { type: 'feedback', message: 'Anonym ' + RUN, quest: null, context: '#/' }, ip)).status === 201, 'Meldung ohne Login');
  ok((await stud('POST', '/api/reports', { type: 'fehler', message: 'Fehler ' + RUN + '\nZeile 2', quest: 'kop', context: 'Aufgabe 3 (k1_x)', username: 'gefälscht' }, Object.assign({ 'user-agent': 'TestBrowser/1.0' }, ip))).status === 201, 'Meldung mit Login');
  r = await admin('GET', '/api/reports');
  const repS = r.data.reports.find(x => x.message === 'Fehler ' + RUN + '\nZeile 2'), repA = r.data.reports.find(x => x.message === 'Anonym ' + RUN);
  ok(repS && repS.username === 'Fuchs_' + RUN && repS.quest === 'kop' && repS.context === 'Aufgabe 3 (k1_x)' && repS.userAgent === 'TestBrowser/1.0' && repS.className === 'EM 3a', 'Admin sieht Meldung mit Kontext ' + JSON.stringify(repS));
  ok(repA && repA.username === null && repA.quest === null, 'anonyme Meldung ohne Benutzer');
  ok((await admin('GET', '/api/reports?type=feedback')).data.reports.every(x => x.type === 'feedback'), 'Filter nach Typ');
  ok((await admin('GET', '/api/reports?quest=kop')).data.reports.every(x => x.quest === 'kop'), 'Filter nach Quest');
  r = await teacher('GET', '/api/reports');
  ok(r.data.reports.some(x => x.id === repS.id) && !r.data.reports.some(x => x.id === repA.id), 'Dozent sieht Meldungen der eigenen Klasse');
  ok(!(await t2('GET', '/api/reports')).data.reports.some(x => x.id === repS.id), 'fremder Dozent sieht sie nicht');
  ok((await stud('GET', '/api/reports')).status === 403, 'Schüler sieht keine Meldungen');
  ok((await teacher('PATCH', '/api/reports/' + repS.id, { done: true })).status === 403, 'nur Admin hakt ab');
  ok((await admin('PATCH', '/api/reports/' + repS.id, { done: true })).status === 200 && (await admin('GET', '/api/reports')).data.reports.find(x => x.id === repS.id).done, 'Admin hakt ab');
  ok((await admin('DELETE', '/api/reports/' + repA.id)).status === 200, 'Admin löscht Meldung');
  const spam = { 'cf-connecting-ip': '10.8.' + (Date.now() % 250) + '.' + Math.floor(Math.random() * 250) };
  let sp; for(let i = 0; i < 11; i++) sp = await anon('POST', '/api/reports', { type: 'feedback', message: 'spam ' + i }, spam);
  ok(sp.status === 429, 'Spam-Schutz nach 10 Meldungen (' + sp.status + ')');
  // Seed aus lokaler Datei (dev/seed.js): Admin-Konto als Dozent + Lernende; zweimal eingespielt → keine Duplikate
  const SD = require('./seed_helper')(RUN); SD.replay();
  const stv = client();
  r = await stv('POST', '/api/login', { username: SD.admin.username, password: SD.admin.password });
  ok(r.status === 200 && r.data.user.role === 'admin' && r.data.user.secretAdmin === false, 'Seed: Admin-Konto ' + JSON.stringify(r.data));
  ok((await stv('GET', '/api/admin/stats')).status === 200, 'Seed: Admin-Rechte');
  r = await stv('GET', '/api/classes');
  const sps = r.data.classes.filter(c => c.name === SD.class.name);
  ok(sps.length === 1 && sps[0].students === 3, 'Seed: genau eine Klasse mit 3 Lernenden ' + JSON.stringify(r.data));
  for(const st of SD.students){
    const sc = client(); r = await sc('POST', '/api/login', st);
    ok(r.status === 200 && r.data.user.role === 'student' && r.data.user.class && r.data.user.class.name === SD.class.name && r.data.user.class.teacher === SD.admin.username, 'Seed: Login ' + st.username);
  }
  ok((await stv('POST', '/api/me/password', { old: SD.admin.password, password: 'neu-' + SD.admin.password })).status === 200, 'Seed: Admin ändert Passwort');
  SD.replay();   // erneut einspielen darf das geänderte Passwort nicht überschreiben
  ok((await client()('POST', '/api/login', { username: SD.admin.username, password: 'neu-' + SD.admin.password })).status === 200, 'Seed: geändertes Passwort bleibt');
  ok((await stv('GET', '/api/classes')).data.classes.filter(c => c.name === SD.class.name).length === 1, 'Seed: keine doppelte Klasse');

  // Löschen
  ok((await teacher('DELETE', '/api/students/' + me.id)).status === 200, 'Schüler löschen');
  ok((await admin('DELETE', '/api/admin/teachers/' + (await admin('GET', '/api/admin/teachers')).data.teachers.find(t => t.username === 'doz_' + RUN).id)).status === 409, 'Dozent mit Klassen nicht löschbar');
  ok((await teacher('DELETE', '/api/classes/' + cls.id)).status === 200, 'Klasse löschen');
  ok((await stud2('GET', '/api/me')).data.user === null, 'Konten der Klasse gelöscht');
  ok((await teacher('POST', '/api/logout', {})).status === 200, 'Logout');
  ok((await teacher('GET', '/api/me')).data.user === null, 'nach Logout abgemeldet');
  console.log('API-Tests: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
