// SPS Quest — Cloudflare Worker: API unter /api/*, alles andere liefert web/ (Static Assets).
// Rollen: admin (aus den Secrets ADMIN_USER / ADMIN_PASSWORD), teacher, student.
import { json, fail, HttpError, now, randomBytes, b64url, sha256hex, safeEqual, hashPassword, verifyPassword,
  randomCode, randomPassword, checkUsername, checkPassword, cleanText } from './lib.js';
import { ensureSchema } from './db.js';
import { challengeRoutes } from './challenge.js';
import { feedbackRoutes } from './feedback.js';
import { reportRoutes } from './reports.js';
import { examRoutes } from './exam.js';
import { certRoutes, verifyPage } from './cert.js';

const COOKIE = 'spsq_sess';
const SESSION_DAYS = 30;
const QUESTS = ['scl', 'kop', 'fup', 'awl', 'sensor'];
const MAX_STATE = 900 * 1024;           // D1: Zeilen bis 1 MB
const LOCK = { user: 5, ip: 40, window: 15 * 60 * 1000 };

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    const zc = url.pathname.match(/^\/z\/([A-Za-z0-9-]{1,20})\/?$/);
    if(!url.pathname.startsWith('/api/') && !zc) return env.ASSETS.fetch(request);
    try{
      if(!env.DB) fail(500, 'Datenbank nicht verbunden (Binding DB fehlt).');
      await ensureSchema(env.DB);
      if(zc) return verifyPage({ req: request, env, url, db: env.DB }, zc[1]);
      const res = await route(request, env, url, ctx);
      return res;
    }catch(e){
      if(e instanceof HttpError) return json(Object.assign({ error: e.message }, e.extra || {}), e.status);
      console.error(e && e.stack || e);
      return json({ error: 'Interner Fehler. Bitte später erneut versuchen.' }, 500);
    }
  }
};

// ---------------- Routing ----------------
async function route(req, env, url, ctx){
  const m = req.method, p = url.pathname.replace(/\/+$/, '');
  // einfacher CSRF-Schutz: schreibende Aufrufe nur mit JSON-Body und eigenem Header
  if(m !== 'GET' && m !== 'HEAD'){
    if(req.headers.get('x-spsquest') !== '1') fail(403, 'Ungültige Anfrage.');
  }
  const C = { req, env, url, ctx, db: env.DB };
  C.body = (m === 'POST' || m === 'PUT' || m === 'PATCH') ? await readJson(req) : {};

  if(p === '/api/health') return json({ ok: true, time: now() });
  if(p === '/api/login' && m === 'POST') return login(C);
  if(p === '/api/logout' && m === 'POST') return logout(C);
  if(p === '/api/register' && m === 'POST') return register(C);
  if(p === '/api/class-info' && m === 'GET') return classInfo(C);

  const H = { currentUser, requireRole };
  const r = (await challengeRoutes(C, p, m, H)) || (await feedbackRoutes(C, p, m, H)) || (await reportRoutes(C, p, m, H)) || (await examRoutes(C, p, m, H)) || (await certRoutes(C, p, m, H));
  if(r) return r;

  C.user = await currentUser(C);
  if(p === '/api/me' && m === 'GET') return C.user ? me(C) : json({ user: null });
  if(!C.user) fail(401, 'Nicht angemeldet.');

  if(p === '/api/me/password' && m === 'POST') return changeOwnPassword(C);
  if(p === '/api/me/notice' && m === 'POST') return ackNotice(C);
  if(p === '/api/me/display-name' && m === 'POST') return setDisplayName(C);
  if(p === '/api/me' && m === 'DELETE') return deleteSelf(C);
  let mm;
  if((mm = p.match(/^\/api\/progress\/([a-z]+)$/))){
    if(m === 'GET') return getProgress(C, mm[1]);
    if(m === 'PUT') return putProgress(C, mm[1]);
  }
  // Admin
  if(p === '/api/admin/teachers' && m === 'GET') return listTeachers(C);
  if(p === '/api/admin/teachers' && m === 'POST') return createTeacher(C);
  if((mm = p.match(/^\/api\/admin\/teachers\/(\d+)\/reset$/)) && m === 'POST') return resetPassword(C, +mm[1], 'teacher');
  if((mm = p.match(/^\/api\/admin\/teachers\/(\d+)$/)) && m === 'DELETE') return deleteTeacher(C, +mm[1]);
  if(p === '/api/admin/stats' && m === 'GET') return adminStats(C);
  // Dozent
  if(p === '/api/classes' && m === 'GET') return listClasses(C);
  if(p === '/api/classes' && m === 'POST') return createClass(C);
  if((mm = p.match(/^\/api\/classes\/(\d+)$/))){
    if(m === 'GET') return getClass(C, +mm[1]);
    if(m === 'PATCH') return patchClass(C, +mm[1]);
    if(m === 'DELETE') return deleteClass(C, +mm[1]);
  }
  if((mm = p.match(/^\/api\/classes\/(\d+)\/students$/)) && m === 'POST') return createStudents(C, +mm[1]);
  if((mm = p.match(/^\/api\/students\/(\d+)\/reset$/)) && m === 'POST') return resetPassword(C, +mm[1], 'student');
  if((mm = p.match(/^\/api\/students\/(\d+)\/progress\/([a-z]+)$/)) && m === 'GET') return studentProgress(C, +mm[1], mm[2]);
  if((mm = p.match(/^\/api\/students\/(\d+)$/)) && m === 'DELETE') return deleteStudent(C, +mm[1]);
  fail(404, 'Unbekannte Adresse.');
}

async function readJson(req){
  const len = +(req.headers.get('content-length') || 0);
  if(len > MAX_STATE + 64 * 1024) fail(413, 'Anfrage zu gross.');
  const t = await req.text();
  if(!t) return {};
  if(t.length > MAX_STATE + 64 * 1024) fail(413, 'Anfrage zu gross.');
  try{ const o = JSON.parse(t); return o && typeof o === 'object' ? o : {}; }catch(e){ fail(400, 'Ungültiges JSON.'); }
}

// ---------------- Sitzungen ----------------
function cookieOf(req, name){
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
function sessionCookie(url, token, maxAge){
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + secure;
}
async function currentUser(C){
  if(C.user !== undefined) return C.user;
  const tok = cookieOf(C.req, COOKIE);
  C.user = null;
  if(!tok || tok.length > 100) return null;
  const sid = await sha256hex(tok);
  const row = await C.db.prepare('SELECT u.*, s.expires AS s_expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?').bind(sid).first();
  if(!row || row.s_expires < now()) return null;
  row.sid = sid;
  C.user = row;
  return row;
}
function requireRole(C, ...roles){
  if(!C.user) fail(401, 'Nicht angemeldet.');
  if(!roles.includes(C.user.role)) fail(403, 'Dafür fehlt die Berechtigung.');
}
async function startSession(C, user){
  const token = b64url(randomBytes(32));
  const t = now();
  await C.db.batch([
    C.db.prepare('INSERT INTO sessions (id, user_id, created_at, expires) VALUES (?, ?, ?, ?)').bind(await sha256hex(token), user.id, t, t + SESSION_DAYS * 864e5),
    C.db.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(t, user.id),
    C.db.prepare('DELETE FROM sessions WHERE expires < ?').bind(t),
    C.db.prepare('DELETE FROM attempts WHERE until < ? AND first < ?').bind(t, t - LOCK.window)
  ]);
  return sessionCookie(C.url, token, SESSION_DAYS * 86400);
}

// ---------------- Rate-Limit ----------------
async function checkLock(C, key){
  const r = await C.db.prepare('SELECT * FROM attempts WHERE k = ?').bind(key).first();
  if(r && r.until > now()){
    const min = Math.ceil((r.until - now()) / 60000);
    fail(429, 'Zu viele Fehlversuche. Bitte in ' + min + ' Minute' + (min === 1 ? '' : 'n') + ' erneut versuchen.');
  }
}
async function noteFail(C, key, max){
  const t = now();
  const r = await C.db.prepare('SELECT * FROM attempts WHERE k = ?').bind(key).first();
  if(!r || t - r.first > LOCK.window){
    await C.db.prepare('INSERT OR REPLACE INTO attempts (k, n, first, until) VALUES (?, 1, ?, 0)').bind(key, t).run();
    return;
  }
  const n = r.n + 1;
  await C.db.prepare('UPDATE attempts SET n = ?, until = ? WHERE k = ?').bind(n, n >= max ? t + LOCK.window : 0, key).run();
}
const ipOf = req => req.headers.get('cf-connecting-ip') || 'local';

// ---------------- Öffentlich ----------------
async function login(C){
  const username = String(C.body.username || '').trim();
  const password = String(C.body.password || '');
  if(!username || !password) fail(400, 'Benutzername und Passwort eingeben.');
  const uKey = 'u:' + username.toLowerCase(), ipKey = 'ip:' + ipOf(C.req);
  await checkLock(C, uKey); await checkLock(C, ipKey);
  let user = null;
  const env = C.env;
  if(env.ADMIN_USER && env.ADMIN_PASSWORD && username.toLowerCase() === String(env.ADMIN_USER).toLowerCase()){
    if(await safeEqual(password, String(env.ADMIN_PASSWORD))){
      user = await C.db.prepare('SELECT * FROM users WHERE username = ?').bind(env.ADMIN_USER).first();
      if(!user){
        await C.db.prepare("INSERT INTO users (username, pw, role, created_at, notice_ack) VALUES (?, '!secret', 'admin', ?, 1)").bind(env.ADMIN_USER, now()).run();
        user = await C.db.prepare('SELECT * FROM users WHERE username = ?').bind(env.ADMIN_USER).first();
      } else if(user.role !== 'admin'){
        await C.db.prepare("UPDATE users SET role = 'admin', class_id = NULL WHERE id = ?").bind(user.id).run();
        user.role = 'admin';
      }
    }
  }
  if(!user){
    // Konten mit Passwort-Hash (auch Admin-Konten aus den Seed-Daten); Admin aus den Secrets hat pw '!secret'
    const row = await C.db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if(row && await verifyPassword(password, row.pw)) user = row;
    else if(!row) await verifyPassword(password, 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');  // gleiche Laufzeit
  }
  if(!user){
    await noteFail(C, uKey, LOCK.user); await noteFail(C, ipKey, LOCK.ip);
    fail(401, 'Benutzername oder Passwort falsch.');
  }
  await C.db.prepare('DELETE FROM attempts WHERE k = ?').bind(uKey).run();
  const cookie = await startSession(C, user);
  return json({ user: await publicUser(C, user) }, 200, { 'set-cookie': cookie });
}
async function logout(C){
  const u = await currentUser(C);
  if(u) await C.db.prepare('DELETE FROM sessions WHERE id = ?').bind(u.sid).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(C.url, '', 0) });
}
async function classByCode(C, code){
  code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(code.length !== 6) return null;
  return C.db.prepare('SELECT c.*, u.username AS teacher FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.code = ?').bind(code).first();
}
async function classInfo(C){
  const ipKey = 'cc:' + ipOf(C.req);
  await checkLock(C, ipKey);
  const cls = await classByCode(C, C.url.searchParams.get('code'));
  if(!cls || !cls.self_signup){ await noteFail(C, ipKey, 30); fail(404, 'Klassencode unbekannt oder Selbstanmeldung geschlossen.'); }
  return json({ name: cls.name, teacher: cls.teacher });
}
async function register(C){
  const ipKey = 'cc:' + ipOf(C.req);
  await checkLock(C, ipKey);
  const cls = await classByCode(C, C.body.code);
  if(!cls || !cls.self_signup){ await noteFail(C, ipKey, 30); fail(404, 'Klassencode unbekannt oder Selbstanmeldung geschlossen.'); }
  const username = checkUsername(C.body.username);
  const password = checkPassword(C.body.password, 6);
  await assertFreeName(C, username);
  const n = await C.db.prepare("SELECT COUNT(*) AS n FROM users WHERE class_id = ?").bind(cls.id).first();
  if(n.n >= 200) fail(400, 'Die Klasse ist voll (200 Konten).');
  await C.db.prepare("INSERT INTO users (username, pw, role, class_id, created_at) VALUES (?, ?, 'student', ?, ?)").bind(username, await hashPassword(password), cls.id, now()).run();
  const user = await C.db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const cookie = await startSession(C, user);
  return json({ user: await publicUser(C, user) }, 201, { 'set-cookie': cookie });
}
async function assertFreeName(C, username){
  if(C.env.ADMIN_USER && username.toLowerCase() === String(C.env.ADMIN_USER).toLowerCase()) fail(409, 'Dieser Benutzername ist vergeben.');
  const ex = await C.db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if(ex) fail(409, 'Der Benutzername "' + username + '" ist schon vergeben.');
}

// ---------------- Eigenes Konto ----------------
async function publicUser(C, u){
  const out = { id: u.id, username: u.username, role: u.role, noticeAck: !!u.notice_ack, mustChange: !!u.must_change };
  if(u.role === 'admin') out.secretAdmin = u.pw === '!secret';
  if(u.role !== 'student') out.displayName = u.display_name || '';   // erscheint auf Zertifikaten „unter Aufsicht“   // Passwort nur in den Worker-Secrets änderbar
  if(u.role === 'student' && u.class_id){
    const c = await C.db.prepare('SELECT c.name, u.username AS teacher FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id = ?').bind(u.class_id).first();
    if(c) out.class = { id: u.class_id, name: c.name, teacher: c.teacher };
  }
  return out;
}
async function me(C){ return json({ user: await publicUser(C, C.user) }); }
async function changeOwnPassword(C){
  if(C.user.role === 'admin' && C.user.pw === '!secret') fail(400, 'Das Admin-Passwort wird in den Worker-Secrets geändert.');
  const old = String(C.body.old || '');
  if(!await verifyPassword(old, C.user.pw)) fail(401, 'Das bisherige Passwort stimmt nicht.');
  const pw = checkPassword(C.body.password, C.user.role === 'student' ? 6 : 8);
  await C.db.batch([
    C.db.prepare('UPDATE users SET pw = ?, must_change = 0 WHERE id = ?').bind(await hashPassword(pw), C.user.id),
    C.db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').bind(C.user.id, C.user.sid)
  ]);
  return json({ ok: true });
}
async function setDisplayName(C){
  requireRole(C, 'teacher', 'admin');
  const name = cleanText(C.body.displayName, 80);
  await C.db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(name || null, C.user.id).run();
  return json({ ok: true, displayName: name });
}
async function ackNotice(C){
  await C.db.prepare('UPDATE users SET notice_ack = 1 WHERE id = ?').bind(C.user.id).run();
  return json({ ok: true });
}
async function deleteSelf(C){
  if(C.user.role !== 'student') fail(400, 'Nur Schülerkonten können sich selbst löschen.');
  if(!await verifyPassword(String(C.body.password || ''), C.user.pw)) fail(401, 'Passwort falsch.');
  await wipeUser(C, C.user.id, !!C.body.deleteCertificates);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(C.url, '', 0) });
}
// Zertifikate bleiben prüfbar (ohne Konto), ausser der Inhaber löscht sie ausdrücklich mit
async function wipeUser(C, id, deleteCertificates){
  await C.db.batch([
    C.db.prepare('DELETE FROM exam_answers WHERE exam_id IN (SELECT id FROM exams WHERE user_id = ?)').bind(id),
    C.db.prepare('DELETE FROM exams WHERE user_id = ?').bind(id),
    deleteCertificates ? C.db.prepare('DELETE FROM certificates WHERE user_id = ?').bind(id) : C.db.prepare('UPDATE certificates SET user_id = NULL WHERE user_id = ?').bind(id),
    C.db.prepare('DELETE FROM progress WHERE user_id = ?').bind(id),
    // Tabellen der entfernten Pikett-Funktion (Migration 7) bleiben bestehen; beim Löschen eines Kontos werden ihre Zeilen weiter entfernt
    C.db.prepare('DELETE FROM pikett_shifts WHERE user_id = ?').bind(id),
    C.db.prepare('DELETE FROM pikett_ranks WHERE user_id = ?').bind(id),
    C.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    C.db.prepare('DELETE FROM challenge_players WHERE user_id = ?').bind(id),
    C.db.prepare('UPDATE feedback SET user_id = NULL WHERE user_id = ?').bind(id),
    C.db.prepare('UPDATE feedback_reports SET user_id = NULL, username = NULL WHERE user_id = ?').bind(id),
    C.db.prepare('DELETE FROM users WHERE id = ?').bind(id)
  ]);
}

// ---------------- Fortschritt ----------------
function checkQuest(q){ if(!QUESTS.includes(q)) fail(404, 'Unbekannte Quest.'); return q; }
async function getProgress(C, quest){
  checkQuest(quest);
  const r = await C.db.prepare('SELECT state, updated_at FROM progress WHERE user_id = ? AND quest = ?').bind(C.user.id, quest).first();
  if(!r) return json({ state: null, updatedAt: 0 });
  return json({ state: JSON.parse(r.state), updatedAt: r.updated_at });
}
async function putProgress(C, quest){
  checkQuest(quest);
  if(C.user.role === 'admin') fail(400, 'Das Admin-Konto speichert keinen Spielstand.');
  const st = C.body.state;
  if(!st || typeof st !== 'object') fail(400, 'Spielstand fehlt.');
  delete st.name;   // keine echten Namen auf dem Server (nur fürs Zertifikat, bleibt lokal)
  const text = JSON.stringify(st);
  if(text.length > MAX_STATE) fail(413, 'Spielstand zu gross.');
  const summary = JSON.stringify(sanitizeSummary(C.body.summary));
  const base = +C.body.base || 0;
  const cur = await C.db.prepare('SELECT updated_at FROM progress WHERE user_id = ? AND quest = ?').bind(C.user.id, quest).first();
  if(cur && base && cur.updated_at > base && !C.body.force) fail(409, 'Auf einem anderen Gerät wurde weitergespielt.', { updatedAt: cur.updated_at });
  const t = Math.max(now(), cur ? cur.updated_at + 1 : 0);
  await C.db.prepare('INSERT INTO progress (user_id, quest, state, summary, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, quest) DO UPDATE SET state = excluded.state, summary = excluded.summary, updated_at = excluded.updated_at')
    .bind(C.user.id, quest, text, summary, t).run();
  return json({ ok: true, updatedAt: t });
}
function sanitizeSummary(s){
  s = s && typeof s === 'object' ? s : {};
  const num = v => Math.max(0, Math.min(1e7, +v || 0));
  return { tasks: num(s.tasks), theory: num(s.theory), points: num(s.points), stars: num(s.stars), ch: num(s.ch),
    totalTasks: num(s.totalTasks), totalTheory: num(s.totalTheory), current: cleanText(s.current, 80), lastAt: num(s.lastAt),
    ...(s.m && typeof s.m === 'object' ? { m: { n: num(s.m.n), fw: s.m.fw == null ? null : num(s.m.fw), ab: num(s.m.ab), help: num(s.m.help) } } : {}) };   // Messung Sensorwerkstatt
}

// ---------------- Admin ----------------
async function listTeachers(C){
  requireRole(C, 'admin');
  const r = await C.db.prepare(`SELECT u.id, u.username, u.created_at, u.last_login,
      (SELECT COUNT(*) FROM classes c WHERE c.teacher_id = u.id) AS classes,
      (SELECT COUNT(*) FROM users s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = u.id) AS students
    FROM users u WHERE u.role = 'teacher' ORDER BY u.username`).all();
  return json({ teachers: r.results || [] });
}
async function createTeacher(C){
  requireRole(C, 'admin');
  const username = checkUsername(C.body.username);
  await assertFreeName(C, username);
  const password = C.body.password ? checkPassword(C.body.password, 8) : randomPassword();
  await C.db.prepare("INSERT INTO users (username, pw, role, created_by, created_at, notice_ack, must_change) VALUES (?, ?, 'teacher', ?, ?, 1, 1)")
    .bind(username, await hashPassword(password), C.user.id, now()).run();
  return json({ username, password }, 201);
}
async function deleteTeacher(C, id){
  requireRole(C, 'admin');
  await C.db.prepare('DELETE FROM challenge_players WHERE challenge_id IN (SELECT id FROM challenges WHERE teacher_id = ?)').bind(id).run();
  await C.db.prepare('DELETE FROM challenges WHERE teacher_id = ?').bind(id).run();
  const t = await C.db.prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'").bind(id).first();
  if(!t) fail(404, 'Dozent nicht gefunden.');
  const cls = ((await C.db.prepare('SELECT id FROM classes WHERE teacher_id = ?').bind(id).all()).results || []);
  if(cls.length && !C.body.withClasses) fail(409, 'Der Dozent hat noch ' + cls.length + ' Klasse(n). Zuerst die Klassen löschen oder "mit Klassen löschen" wählen.');
  for(const c of cls) await wipeClass(C, c.id);
  await wipeUser(C, id);
  return json({ ok: true });
}
async function adminStats(C){
  requireRole(C, 'admin');
  const q = sql => C.db.prepare(sql).first();
  const [t, s, c, p] = await Promise.all([
    q("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher'"), q("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
    q('SELECT COUNT(*) AS n FROM classes'), q('SELECT COUNT(*) AS n FROM progress')]);
  return json({ teachers: t.n, students: s.n, classes: c.n, progress: p.n });
}

// ---------------- Dozent: Klassen und Schüler ----------------
async function ownClass(C, id){
  requireRole(C, 'teacher', 'admin');
  const c = await C.db.prepare('SELECT * FROM classes WHERE id = ?').bind(id).first();
  if(!c || (C.user.role !== 'admin' && c.teacher_id !== C.user.id)) fail(404, 'Klasse nicht gefunden.');
  return c;
}
async function uniqueClassCode(C){
  for(let i = 0; i < 20; i++){
    const code = randomCode(6);
    if(!await C.db.prepare('SELECT id FROM classes WHERE code = ?').bind(code).first()) return code;
  }
  fail(500, 'Kein freier Klassencode gefunden.');
}
async function listClasses(C){
  requireRole(C, 'teacher', 'admin');
  const r = await C.db.prepare(`SELECT c.id, c.name, c.code, c.self_signup, c.created_at,
      (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id) AS students
    FROM classes c WHERE c.teacher_id = ? ORDER BY c.name`).bind(C.user.id).all();
  return json({ classes: r.results || [] });
}
async function createClass(C){
  requireRole(C, 'teacher', 'admin');   // ein Admin-Konto kann zugleich Dozent sein
  const name = cleanText(C.body.name, 60);
  if(!name) fail(400, 'Bitte einen Klassennamen eingeben.');
  const n = await C.db.prepare('SELECT COUNT(*) AS n FROM classes WHERE teacher_id = ?').bind(C.user.id).first();
  if(n.n >= 50) fail(400, 'Höchstens 50 Klassen pro Dozent.');
  const code = await uniqueClassCode(C);
  const r = await C.db.prepare('INSERT INTO classes (name, teacher_id, code, self_signup, created_at) VALUES (?, ?, ?, 1, ?)').bind(name, C.user.id, code, now()).run();
  return json({ id: r.meta.last_row_id, name, code, self_signup: 1 }, 201);
}
async function getClass(C, id){
  const c = await ownClass(C, id);
  const r = await C.db.prepare(`SELECT u.id, u.username, u.created_at, u.last_login, u.notice_ack, u.must_change,
      p.quest, p.summary, p.updated_at
    FROM users u LEFT JOIN progress p ON p.user_id = u.id
    WHERE u.class_id = ? ORDER BY u.username`).bind(id).all();
  const by = {};
  (r.results || []).forEach(row => {
    const s = by[row.id] || (by[row.id] = { id: row.id, username: row.username, createdAt: row.created_at, lastLogin: row.last_login,
      noticeAck: !!row.notice_ack, mustChange: !!row.must_change, progress: {} });
    if(row.quest) s.progress[row.quest] = Object.assign(JSON.parse(row.summary || '{}'), { updatedAt: row.updated_at });
  });
  return json({ class: { id: c.id, name: c.name, code: c.code, selfSignup: !!c.self_signup, createdAt: c.created_at }, students: Object.values(by) });
}
async function patchClass(C, id){
  const c = await ownClass(C, id);
  const b = C.body;
  if(b.name !== undefined){ const name = cleanText(b.name, 60); if(!name) fail(400, 'Name fehlt.'); await C.db.prepare('UPDATE classes SET name = ? WHERE id = ?').bind(name, id).run(); }
  if(b.selfSignup !== undefined) await C.db.prepare('UPDATE classes SET self_signup = ? WHERE id = ?').bind(b.selfSignup ? 1 : 0, id).run();
  if(b.newCode) await C.db.prepare('UPDATE classes SET code = ? WHERE id = ?').bind(await uniqueClassCode(C), id).run();
  const n = await C.db.prepare('SELECT id, name, code, self_signup FROM classes WHERE id = ?').bind(c.id).first();
  return json({ class: { id: n.id, name: n.name, code: n.code, selfSignup: !!n.self_signup } });
}
async function wipeClass(C, id){
  const ids = ((await C.db.prepare('SELECT id FROM users WHERE class_id = ?').bind(id).all()).results || []).map(r => r.id);
  for(const uid of ids) await wipeUser(C, uid);
  await C.db.prepare('DELETE FROM classes WHERE id = ?').bind(id).run();
}
async function deleteClass(C, id){
  await ownClass(C, id);
  await wipeClass(C, id);
  return json({ ok: true });
}
async function createStudents(C, id){
  const c = await ownClass(C, id);
  let names = Array.isArray(C.body.usernames) ? C.body.usernames : [];
  if(!names.length && C.body.prefix){
    const count = Math.max(1, Math.min(40, +C.body.count || 0));
    const prefix = String(C.body.prefix).trim();
    for(let i = 1; i <= count; i++) names.push(prefix + String(i).padStart(2, '0'));
  }
  if(!names.length) fail(400, 'Keine Benutzernamen angegeben.');
  if(names.length > 40) fail(400, 'Höchstens 40 Konten auf einmal.');
  names = names.map(checkUsername);
  const lower = names.map(n => n.toLowerCase());
  if(new Set(lower).size !== lower.length) fail(400, 'Doppelte Benutzernamen in der Liste.');
  for(const n of names) await assertFreeName(C, n);
  const out = [], stmts = [];
  for(const n of names){
    const pw = randomPassword();
    out.push({ username: n, password: pw });
    stmts.push(C.db.prepare("INSERT INTO users (username, pw, role, class_id, created_by, created_at, must_change) VALUES (?, ?, 'student', ?, ?, ?, 1)")
      .bind(n, await hashPassword(pw), c.id, C.user.id, now()));
  }
  await C.db.batch(stmts);
  return json({ created: out }, 201);
}
async function studentOf(C, id){
  requireRole(C, 'teacher', 'admin');
  const s = await C.db.prepare("SELECT u.*, c.teacher_id FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND u.role = 'student'").bind(id).first();
  if(!s || (C.user.role !== 'admin' && s.teacher_id !== C.user.id)) fail(404, 'Schüler nicht gefunden.');
  return s;
}
async function resetPassword(C, id, role){
  let u;
  if(role === 'teacher'){
    requireRole(C, 'admin');
    u = await C.db.prepare("SELECT * FROM users WHERE id = ? AND role = 'teacher'").bind(id).first();
    if(!u) fail(404, 'Dozent nicht gefunden.');
  } else u = await studentOf(C, id);
  const pw = randomPassword();
  await C.db.batch([
    C.db.prepare('UPDATE users SET pw = ?, must_change = 1 WHERE id = ?').bind(await hashPassword(pw), u.id),
    C.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
    C.db.prepare('DELETE FROM attempts WHERE k = ?').bind('u:' + u.username.toLowerCase())
  ]);
  return json({ username: u.username, password: pw });
}
async function studentProgress(C, id, quest){
  checkQuest(quest);
  const s = await studentOf(C, id);
  const r = await C.db.prepare('SELECT state, summary, updated_at FROM progress WHERE user_id = ? AND quest = ?').bind(s.id, quest).first();
  return json({ student: { id: s.id, username: s.username, noticeAck: !!s.notice_ack }, state: r ? JSON.parse(r.state) : null, summary: r ? JSON.parse(r.summary || '{}') : null, updatedAt: r ? r.updated_at : 0 });
}
async function deleteStudent(C, id){
  const s = await studentOf(C, id);
  await wipeUser(C, s.id);
  return json({ ok: true });
}

export const __test = { route };
