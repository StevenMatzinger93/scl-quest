// SPS Quest — Feedback und Fehlermeldungen jederzeit (Knopf unten links in Portal und Quests).
// Absenden geht auch ohne Login; der Benutzername kommt aus der Sitzung, nie aus dem Formular.
// Einsicht: Admin alles, Dozent die Meldungen der eigenen Lernenden und die eigenen.
import { json, fail, now, cleanText } from './lib.js';

const TYPES = ['feedback', 'fehler'];
const QUESTS = ['scl', 'kop', 'fup', 'awl'];
const LIMIT = { n: 10, window: 15 * 60 * 1000 };   // pro IP

export async function reportRoutes(C, p, m, H){
  if(!p.startsWith('/api/reports')) return null;
  C.user = await H.currentUser(C);
  if(p === '/api/reports' && m === 'POST') return submit(C);
  H.requireRole(C, 'teacher', 'admin');
  if(p === '/api/reports' && m === 'GET') return list(C);
  const mm = p.match(/^\/api\/reports\/(\d+)$/);
  if(mm && m === 'PATCH') return patch(C, H, +mm[1]);
  if(mm && m === 'DELETE') return remove(C, H, +mm[1]);
  fail(404, 'Unbekannte Adresse.');
}

async function submit(C){
  const b = C.body;
  const type = TYPES.includes(b.type) ? b.type : fail(400, 'Bitte "Feedback" oder "Fehler" wählen.');
  const message = String(b.message || '').replace(/\r\n?/g, '\n').split('\n').map(l => cleanText(l, 2000)).join('\n').replace(/\n{3,}/g, '\n\n').slice(0, 2000).trim();
  if(!message) fail(400, 'Bitte einen Text eingeben.');
  const quest = QUESTS.includes(b.quest) ? b.quest : null;
  const context = cleanText(b.context, 200) || null;
  const ua = cleanText(C.req.headers.get('user-agent'), 300) || null;
  // einfacher Spam-Schutz: höchstens 10 Meldungen pro IP in 15 Minuten
  const key = 'rp:' + (C.req.headers.get('cf-connecting-ip') || 'local'), t = now();
  const a = await C.db.prepare('SELECT n, first FROM attempts WHERE k = ?').bind(key).first();
  if(a && t - a.first < LIMIT.window && a.n >= LIMIT.n) fail(429, 'Danke! Du hast gerade schon viele Meldungen geschickt. Bitte in ein paar Minuten nochmals.');
  const u = C.user;
  await C.db.batch([
    C.db.prepare('INSERT INTO feedback_reports (created_at, type, message, quest, context, username, user_agent, user_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(t, type, message, quest, context, u ? u.username : null, ua, u ? u.id : null, u && u.role === 'student' ? u.class_id || null : null),
    !a || t - a.first >= LIMIT.window
      ? C.db.prepare('INSERT OR REPLACE INTO attempts (k, n, first, until) VALUES (?, 1, ?, ?)').bind(key, t, t + LIMIT.window)
      : C.db.prepare('UPDATE attempts SET n = n + 1 WHERE k = ?').bind(key)
  ]);
  return json({ ok: true }, 201);
}

function scope(C){
  if(C.user.role === 'admin') return { where: '1 = 1', args: [] };
  return { where: '(r.class_id IN (SELECT id FROM classes WHERE teacher_id = ?) OR r.user_id = ?)', args: [C.user.id, C.user.id] };
}
async function list(C){
  const s = scope(C), where = [s.where], args = s.args.slice();
  const type = C.url.searchParams.get('type'), quest = C.url.searchParams.get('quest');
  if(TYPES.includes(type)){ where.push('r.type = ?'); args.push(type); }
  if(quest === 'portal') where.push('r.quest IS NULL');
  else if(QUESTS.includes(quest)){ where.push('r.quest = ?'); args.push(quest); }
  const rows = await C.db.prepare(`SELECT r.id, r.created_at, r.type, r.message, r.quest, r.context, r.username, r.user_agent, r.done, c.name AS class_name
      FROM feedback_reports r LEFT JOIN classes c ON c.id = r.class_id WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC, r.id DESC LIMIT 500`).bind(...args).all();
  const cnt = await C.db.prepare(`SELECT r.type, COUNT(*) AS n, SUM(r.done = 0) AS open FROM feedback_reports r WHERE ${s.where} GROUP BY r.type`).bind(...s.args).all();
  const counts = { feedback: 0, fehler: 0, open: 0 };
  (cnt.results || []).forEach(x => { counts[x.type] = x.n; counts.open += x.open || 0; });
  return json({ reports: (rows.results || []).map(r => ({ id: r.id, at: r.created_at, type: r.type, message: r.message, quest: r.quest, context: r.context,
    username: r.username, userAgent: r.user_agent, className: r.class_name, done: !!r.done })), counts });
}
async function patch(C, H, id){
  H.requireRole(C, 'admin');
  const r = await C.db.prepare('UPDATE feedback_reports SET done = ? WHERE id = ?').bind(C.body.done ? 1 : 0, id).run();
  if(!r.meta.changes) fail(404, 'Meldung nicht gefunden.');
  return json({ ok: true });
}
async function remove(C, H, id){
  H.requireRole(C, 'admin');
  const r = await C.db.prepare('DELETE FROM feedback_reports WHERE id = ?').bind(id).run();
  if(!r.meta.changes) fail(404, 'Meldung nicht gefunden.');
  return json({ ok: true });
}
