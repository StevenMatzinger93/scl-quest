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
  ok((await anon('GET', '/api/me')).status === 401, 'me ohne Login 401');
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
  ok((await stud('GET', '/api/me')).status === 401, 'Sitzung nach Reset beendet');
  r = await stud('POST', '/api/login', { username: 'fuchs_' + RUN, password: r.data.password });
  ok(r.status === 200 && r.data.user.mustChange, 'Login mit neuem Passwort (Gross-/Kleinschreibung egal)');
  // Selbstanmeldung schliessen, Code neu
  r = await teacher('PATCH', '/api/classes/' + cls.id, { selfSignup: false, newCode: true });
  ok(r.data.class.code !== cls.code && !r.data.class.selfSignup, 'Klasse ändern');
  ok((await anon('POST', '/api/register', { code: r.data.class.code, username: 'zu_' + RUN, password: 'geheim1' })).status === 404, 'Anmeldung geschlossen');
  // Rate-Limit
  const rl = client();
  let last;
  for(let i = 0; i < 6; i++) last = await rl('POST', '/api/login', { username: gen.username, password: 'falsch' + i });
  ok(last.status === 429, 'Sperre nach 5 Fehlversuchen (' + last.status + ')');
  ok((await rl('POST', '/api/login', { username: gen.username, password: gen.password })).status === 429, 'auch richtiges Passwort gesperrt');
  // Löschen
  ok((await teacher('DELETE', '/api/students/' + me.id)).status === 200, 'Schüler löschen');
  ok((await admin('DELETE', '/api/admin/teachers/' + (await admin('GET', '/api/admin/teachers')).data.teachers.find(t => t.username === 'doz_' + RUN).id)).status === 409, 'Dozent mit Klassen nicht löschbar');
  ok((await teacher('DELETE', '/api/classes/' + cls.id)).status === 200, 'Klasse löschen');
  ok((await stud2('GET', '/api/me')).status === 401, 'Konten der Klasse gelöscht');
  ok((await teacher('POST', '/api/logout', {})).status === 200, 'Logout');
  ok((await teacher('GET', '/api/me')).status === 401, 'nach Logout abgemeldet');
  console.log('API-Tests: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
