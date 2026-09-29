// Avatare und Coins (Paket 3) gegen einen laufenden Worker: node tests/avatar_api.js [http://localhost:8787]
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://localhost:8787';
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '..', '.dev.vars'), 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const RUN = Date.now().toString(36).slice(-5);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
const api = async (cookie, method, url, body) => { const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json', 'x-spsquest': '1', cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json().catch(() => ({})); return { status: r.status, data: d, cookie: (r.headers.get('set-cookie') || '').split(';')[0] }; };
(async () => {
  const adm = await api('', 'POST', '/api/login', { username: vars.ADMIN_USER, password: vars.ADMIN_PASSWORD });
  await api(adm.cookie, 'POST', '/api/admin/teachers', { username: 'av_' + RUN, password: 'avatar-lehrer' });
  const t0 = await api('', 'POST', '/api/login', { username: 'av_' + RUN, password: 'avatar-lehrer' });
  await api(t0.cookie, 'POST', '/api/me/password', { old: 'avatar-lehrer', password: 'avatar-lehrer-2' });
  const tl = await api('', 'POST', '/api/login', { username: 'av_' + RUN, password: 'avatar-lehrer-2' });
  const cls = await api(tl.cookie, 'POST', '/api/classes', { name: 'Avatar ' + RUN });
  const reg = await api('', 'POST', '/api/register', { code: cls.data.code, username: 'Igel' + RUN, password: 'schueler-pw' });
  await api(reg.cookie, 'POST', '/api/me/notice', {});
  const S = (await api('', 'POST', '/api/login', { username: 'Igel' + RUN, password: 'schueler-pw' })).cookie;
  // Zugriff
  ok((await api('', 'GET', '/api/avatar')).status === 401, 'ohne Anmeldung: 401');
  ok((await api(adm.cookie, 'GET', '/api/avatar')).status === 400, 'Admin hat keinen Avatar');
  // Start: Vorgabe, 0 Coins
  let o = await api(S, 'GET', '/api/avatar');
  ok(o.status === 200 && o.data.spec.a === 'fuchs' && o.data.coins === 0, 'Vorgabe-Avatar, 0 Coins');
  ok(!o.data.owned.includes('hat:kappe_rot') && !o.data.owned.includes('ch:gold'), 'nichts Gekauftes/Freigeschaltetes');
  ok((await api(S, 'PUT', '/api/avatar', { spec: { a: 'baer', c: 2 } })).status === 200, 'Tier und Farbe sind frei');
  ok((await api(S, 'PUT', '/api/avatar', { spec: { a: 'baer', hat: 'kappe_rot' } })).status === 403, 'ungekaufte Kappe abgelehnt');
  ok((await api(S, 'POST', '/api/avatar/buy', { slot: 'hat', id: 'kappe_rot' })).status === 402, 'Kauf ohne Coins: 402');
  ok((await api(S, 'POST', '/api/avatar/buy', { slot: 'ch', id: 'gold' })).status === 400, 'Abzeichen-Stück nicht käuflich');
  ok((await api(S, 'POST', '/api/avatar/buy', { slot: 'xx', id: 'nix' })).status === 404, 'unbekanntes Stück');
  // Coins aus dem Fortschritt: 10 Aufgaben Kapitel 1 mit 3 Sternen (10 × 10 + Kapitel-Boss 20) und eine Theorie
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'data', 'scl.json'), 'utf8'));
  const ch1 = meta.tasks.filter(t => t.ch === 1), th = meta.theory.filter(t => t.ch === 1)[0];
  const doneTasks = {}; ch1.forEach(t => { doneTasks[t.id] = { stars: 3, points: 100 }; });
  const state = { v: 4, doneTasks, doneTheory: { [th.id]: { score: 5 } }, badges: [] };
  ok((await api(S, 'PUT', '/api/progress/scl', { state, summary: { tasks: ch1.length } })).status === 200, 'Fortschritt gespeichert');
  o = await api(S, 'GET', '/api/avatar');
  ok(o.data.coins === ch1.length * 10 + 20 + 8, 'Coins: ' + ch1.length + '×10 + Boss 20 + Theorie 8 = ' + (ch1.length * 10 + 28) + ' (ist ' + o.data.coins + ')');
  const again = await api(S, 'GET', '/api/avatar'); ok(again.data.coins === o.data.coins, 'wiederholtes Abrufen zählt nichts doppelt');
  // Stern-Verbesserung: eine Aufgabe von 1 auf 3 Sterne
  const st2 = JSON.parse(JSON.stringify(state)); st2.doneTasks[ch1[0].id] = { stars: 1 };
  // Kauf
  const b = await api(S, 'POST', '/api/avatar/buy', { slot: 'hat', id: 'kappe_rot' });
  ok(b.status === 200 && b.data.coins === o.data.coins - 40, 'Kappe gekauft (−40)');
  ok((await api(S, 'POST', '/api/avatar/buy', { slot: 'hat', id: 'kappe_rot' })).status === 409, 'doppelter Kauf abgelehnt');
  ok((await api(S, 'PUT', '/api/avatar', { spec: { a: 'eule', c: 0, hat: 'kappe_rot' } })).status === 200, 'gekaufte Kappe tragbar');
  // Abzeichen schaltet die goldene Kette frei
  ok((await api(S, 'PUT', '/api/avatar', { spec: { a: 'eule', ch: 'gold' } })).status === 403, 'goldene Kette ohne Abzeichen gesperrt');
  state.badges = ['befreier'];
  await api(S, 'PUT', '/api/progress/scl', { state, summary: {}, force: true });
  ok((await api(S, 'PUT', '/api/avatar', { spec: { a: 'eule', ch: 'gold' } })).status === 200, 'Abzeichen „Befreier“ schaltet die goldene Kette frei');
  // ungültige Angaben werden gesäubert
  const bad = await api(S, 'PUT', '/api/avatar', { spec: { a: 'drache', c: 99, hat: '<script>', sh: 5 } });
  ok(bad.status === 200 && bad.data.spec.a === 'fuchs' && bad.data.spec.c === 0 && bad.data.spec.hat === '', 'ungültige Werte fallen auf die Vorgabe zurück');
  await api(S, 'PUT', '/api/avatar', { spec: { a: 'wolf', c: 3, hat: 'kappe_rot' } });
  // Sichtbarkeit: eigenes Konto, Klassenliste, Beamer
  const me = await api(S, 'GET', '/api/me');
  ok(me.data.user.avatar && me.data.user.avatar.a === 'wolf', '/api/me enthält den Avatar');
  const cl = await api(tl.cookie, 'GET', '/api/classes/' + cls.data.id);
  ok(cl.data.students[0].avatar && cl.data.students[0].avatar.hat === 'kappe_rot', 'Klassenliste zeigt den Avatar');
  const ch = await api(tl.cookie, 'POST', '/api/challenges', { mode: 'sprint', quest: 'scl', taskId: ch1[0].id, duration: 300 });
  await api(S, 'POST', '/api/live/join', { code: ch.data.code });
  const bs = await api(tl.cookie, 'GET', '/api/challenges/' + ch.data.id);
  ok(bs.data.players[0].avatar && bs.data.players[0].avatar.a === 'wolf', 'Beamer-Zustand enthält den Avatar');
  // Speedrun-Coins: beendet, gelöst → Platz 1 = 30
  await api(tl.cookie, 'POST', '/api/challenges/' + ch.data.id + '/start', {});
  await api(S, 'POST', '/api/live/' + ch.data.id + '/attempt', { ok: true, code: 'x', taskId: ch1[0].id });
  await api(tl.cookie, 'POST', '/api/challenges/' + ch.data.id + '/stop', {});
  const before = (await api(S, 'GET', '/api/avatar')).data.coins;
  const after = await api(S, 'GET', '/api/avatar');
  ok(after.data.earned.some(e => e.kind === 'speedrun' && e.n === 30), 'Speedrun-Platz 1: +30 Coins');
  ok(before === after.data.coins, 'Speedrun-Coins nur einmal');
  // Konto löschen räumt auf
  const del = await api(S, 'DELETE', '/api/me', { password: 'schueler-pw' });
  ok(del.status === 200, 'Konto löschen (' + del.status + ' ' + JSON.stringify(del.data) + ')');
  console.log('Avatare und Coins: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
