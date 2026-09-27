// SPS Quest — Prüfungen für das Zertifikat (docs/PLAN_ZERTIFIKAT_PIKETT.md Teil A, Konzept docs/ZERTIFIKAT_KONZEPT.md).
// Der Server glaubt dem Browser nichts: Ziehung, Zeit und Bewertung laufen hier, der Browser sieht nie verdeckte Tests oder Referenzen.
import { json, fail, now, cleanText, randomBytes, hex, randomCode } from './lib.js';
import { Exam, QUEST_TASKS } from './gen/exam_bundle.js';

const QUESTS = ['scl', 'kop', 'fup', 'awl'], LEVELS = ['grund', 'profi'];
const GRACE = 30 * 1000;                              // Kulanz nach Ablauf für Abgaben
const DAY = 864e5, RETRY = { gap: DAY, window: 30 * DAY, max: 3 };
const PROGRESS_MIN = 0.8;
const LEVEL_NAME = { grund: 'Grundstufe', profi: 'Profi-Stufe' };
// Aufwärmen beim Start des Isolats: je Quest und Stufe eine Referenz bewerten (JIT). Läuft einmal beim Laden des Moduls
// und zählt zur Startzeit, nicht zum CPU-Budget einer Anfrage (Gratis-Tarif: 10 ms pro Anfrage).
(function warm(){
  try{
    for(const q of QUESTS) for(const lv of LEVELS){
      const d = Exam.pool(q, lv).tasks[0]; if(!d) continue;
      const it = Exam.instantiate(d, Exam.pickParams(d, Exam.rng('warm')));
      Exam.gradeFor(it, it.kind === 'grund' ? it.ref : Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.ref])));
    }
  }catch(e){ /* Aufwärmen ist optional */ }
})();

export async function examRoutes(C, p, m, H){
  if(!p.startsWith('/api/exams') && !p.startsWith('/api/exam-sessions')) return null;
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  let mm;
  if(p === '/api/exams/eligibility' && m === 'GET') return eligibilityRoute(C);
  if(p === '/api/exams' && m === 'POST') return startExam(C);
  if(p === '/api/exams' && m === 'GET') return myExams(C);
  if((mm = p.match(/^\/api\/exams\/(\d+)$/)) && m === 'GET') return getExam(C, +mm[1]);
  if((mm = p.match(/^\/api\/exams\/(\d+)\/answer$/)) && m === 'POST') return answer(C, +mm[1]);
  if((mm = p.match(/^\/api\/exams\/(\d+)\/focus$/)) && m === 'POST') return focus(C, +mm[1]);
  if((mm = p.match(/^\/api\/exams\/(\d+)\/submit$/)) && m === 'POST') return submit(C, +mm[1]);
  if((mm = p.match(/^\/api\/exams\/(\d+)\/void$/)) && m === 'POST') return voidExam(C, H, +mm[1]);
  // Dozent: Prüfung unter Aufsicht
  if(p === '/api/exam-sessions' && m === 'POST') return createSession(C, H);
  if(p === '/api/exam-sessions' && m === 'GET') return listSessions(C, H);
  if((mm = p.match(/^\/api\/exam-sessions\/(\d+)$/)) && m === 'GET') return sessionView(C, H, +mm[1]);
  if((mm = p.match(/^\/api\/exam-sessions\/(\d+)$/)) && m === 'DELETE') return closeSession(C, H, +mm[1]);
  fail(404, 'Unbekannte Adresse.');
}

/* ---------- Voraussetzungen ---------- */
async function progressOf(C, userId, quest){
  const r = await C.db.prepare('SELECT state FROM progress WHERE user_id = ? AND quest = ?').bind(userId, quest).first();
  try{ return r ? JSON.parse(r.state) : null; }catch(e){ return null; }
}
async function validCert(C, userId, quest, level){
  return C.db.prepare('SELECT id, issued_at FROM certificates WHERE user_id = ? AND quest = ? AND level = ? AND revoked_at IS NULL ORDER BY issued_at DESC').bind(userId, quest, level).first();
}
async function eligibility(C, user, quest, proctored){
  const st = await progressOf(C, user.id, quest), done = (st && st.doneTasks) || {};
  const tasks = QUEST_TASKS[quest] || [], out = {};
  for(const level of LEVELS){
    const [a, b] = level === 'grund' ? [1, 10] : [11, 15];
    const list = tasks.filter(t => t.ch >= a && t.ch <= b), solved = list.filter(t => done[t.id]).length;
    const finals = list.filter(t => t.final), finalOk = finals.every(t => done[t.id]);
    const missing = [];
    if(user.role === 'admin') missing.push('Mit dem Admin-Konto kann man keine Prüfung ablegen.');
    if(!proctored){
      if(list.length && solved < Math.ceil(PROGRESS_MIN * list.length)) missing.push('Im Spiel mind. 80 % der Aufgaben der Kapitel ' + a + '–' + b + ' lösen (' + solved + '/' + list.length + ', nötig ' + Math.ceil(PROGRESS_MIN * list.length) + ').');
      if(!finalOk) missing.push(level === 'grund' ? 'Den Final Boss (Kapitel 10) lösen.' : 'Den Final Boss 2 (Kapitel 15) lösen.');
    }
    if(level === 'profi' && !(await validCert(C, user.id, quest, 'grund'))) missing.push('Zuerst das Zertifikat der Grundstufe dieser Quest ablegen.');
    const pool = Exam.pool(quest, level), R = Exam.RULES[level];
    if(C.env.EXAM_DEV !== '1' && (pool.tasks.length < R.tasks || pool.questions.length < R.questions)) missing.push('Der Prüfungspool dieser Stufe ist noch im Aufbau.');
    const hist = ((await C.db.prepare('SELECT started_at, state FROM exams WHERE user_id = ? AND quest = ? AND level = ? AND started_at > ? ORDER BY started_at DESC').bind(user.id, quest, level, now() - RETRY.window).all()).results || []);
    let nextAt = 0;
    if(hist.length){ nextAt = hist[0].started_at + RETRY.gap; if(hist.length >= RETRY.max) nextAt = Math.max(nextAt, hist[RETRY.max - 1].started_at + RETRY.window); }
    const cert = await validCert(C, user.id, quest, level);
    out[level] = { ok: !missing.length && nextAt <= now(), missing, nextAt: nextAt > now() ? nextAt : 0, solved, total: list.length, finalOk,
      attempts30: hist.length, certificate: cert ? cert.id : null, running: hist.some(h => h.state === 'running') };
  }
  return out;
}
async function eligibilityRoute(C){
  const quest = C.url.searchParams.get('quest');
  if(!QUESTS.includes(quest)) fail(400, 'Unbekannte Quest.');
  const running = await C.db.prepare("SELECT id, level, deadline FROM exams WHERE user_id = ? AND quest = ? AND state = 'running' ORDER BY id DESC").bind(C.user.id, quest).first();
  return json({ quest, rules: Exam.RULES, levels: await eligibility(C, C.user, quest, false), running: running && running.deadline + GRACE > now() ? running : null,
    fee: C.env.CERT_FEE === '1' });
}

/* ---------- Prüfung starten ---------- */
async function startExam(C){
  const b = C.body;
  let quest = b.quest, level = b.level, session = null;
  if(C.user.role === 'admin') fail(403, 'Mit dem Admin-Konto kann man keine Prüfung ablegen.');
  if(b.sessionCode){
    const code = String(b.sessionCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
    session = await C.db.prepare('SELECT s.*, c.name AS class_name, u.username AS teacher, u.display_name FROM exam_sessions s JOIN users u ON u.id = s.teacher_id LEFT JOIN classes c ON c.id = s.class_id WHERE s.code = ?').bind(code).first();
    if(!session) fail(404, 'Prüfungscode unbekannt.');
    if(!quest && !level){ quest = session.quest; level = session.level; }   // Beitritt nur mit Code
    if(session.quest !== quest || session.level !== level) fail(400, 'Dieser Code gehört zu ' + session.quest.toUpperCase() + ' ' + LEVEL_NAME[session.level] + '.');
    if(now() < session.opens_at) fail(403, 'Die Prüfung ist noch nicht geöffnet.');
    if(now() > session.closes_at) fail(403, 'Das Prüfungsfenster ist geschlossen.');
    if(session.class_id && C.user.class_id !== session.class_id) fail(403, 'Diese Prüfung ist für eine andere Klasse.');
  }
  if(!QUESTS.includes(quest) || !LEVELS.includes(level)) fail(400, 'Quest oder Stufe fehlt.');
  // eine laufende Prüfung dieser Art → fortsetzen
  const run = await C.db.prepare("SELECT id, deadline FROM exams WHERE user_id = ? AND quest = ? AND level = ? AND state = 'running' ORDER BY id DESC").bind(C.user.id, quest, level).first();
  if(run && run.deadline + GRACE > now()) return getExam(C, run.id);
  if(run) await finalize(C, await examRow(C, run.id), 'expired');
  const el = (await eligibility(C, C.user, quest, !!session))[level];
  if(el.missing.length) fail(403, el.missing[0], { missing: el.missing });
  if(el.nextAt) fail(429, 'Nächster Versuch möglich ab ' + new Date(el.nextAt).toISOString() + '.', { nextAt: el.nextAt });
  if(C.env.CERT_FEE === '1') await useCredit(C);
  const seed = hex(randomBytes(12)), items = Exam.draw(quest, level, seed), t = now();
  let deadline = t + Exam.RULES[level].minutes * 60000;
  if(session) deadline = Math.min(deadline, session.closes_at);
  const r = await C.db.prepare("INSERT INTO exams (user_id, quest, level, seed, items, session_id, state, started_at, deadline) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)")
    .bind(C.user.id, quest, level, seed, JSON.stringify(items), session ? session.id : null, t, deadline).run();
  return getExam(C, r.meta.last_row_id, 201);
}
async function useCredit(C){
  const cr = await C.db.prepare('SELECT id FROM exam_credits WHERE remaining > 0 AND (user_id = ? OR (class_id IS NOT NULL AND class_id = ?)) ORDER BY user_id IS NULL, id LIMIT 1').bind(C.user.id, C.user.class_id || -1).first();
  if(!cr) fail(402, 'Für diese Prüfung ist ein Prüfungsguthaben nötig. Bitte bei der Lehrperson nachfragen.');
  await C.db.prepare('UPDATE exam_credits SET remaining = remaining - 1 WHERE id = ?').bind(cr.id).run();
}

/* ---------- Prüfung lesen ---------- */
async function examRow(C, id){ return C.db.prepare('SELECT * FROM exams WHERE id = ?').bind(id).first(); }
async function ownExam(C, id){
  const e = await examRow(C, id);
  if(!e || e.user_id !== C.user.id) fail(404, 'Prüfung nicht gefunden.');
  if(e.state === 'running' && now() > e.deadline + GRACE) return finalize(C, e, 'expired');
  return e;
}
function built(e){ return Exam.build(JSON.parse(e.items)); }
async function answersOf(C, id){ const r = await C.db.prepare('SELECT item, answer, result, points, submitted_at FROM exam_answers WHERE exam_id = ?').bind(id).all(); const o = {}; (r.results || []).forEach(a => o[a.item] = a); return o; }
async function getExam(C, id, status){
  const e = await ownExam(C, id), b = built(e), ans = await answersOf(C, id);
  const sess = e.session_id ? await C.db.prepare('SELECT s.code, c.name AS class_name, u.username AS teacher, u.display_name FROM exam_sessions s JOIN users u ON u.id = s.teacher_id LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = ?').bind(e.session_id).first() : null;
  return json({
    exam: { id: e.id, quest: e.quest, level: e.level, state: e.state, startedAt: e.started_at, deadline: e.deadline, now: now(), grace: GRACE, focusLost: e.focus_lost,
      proctored: !!sess, proctor: sess ? proctorLabel(sess) : null, rules: Exam.RULES[e.level], voidReason: e.void_reason },
    tasks: b.tasks.map(Exam.publicItem),
    questions: b.questions.map(Exam.publicQuestion),
    answers: Object.fromEntries(Object.values(ans).map(a => [a.item, { answer: parseAnswer(a.answer), result: a.result ? JSON.parse(a.result) : null, at: a.submitted_at }])),
    result: e.state !== 'running' ? resultOf(e) : null
  }, status || 200);
}
const parseAnswer = s => { try{ return JSON.parse(s); }catch(e){ return null; } };
function proctorLabel(s){ return (s.display_name || s.teacher) + (s.class_name ? ', ' + s.class_name : ''); }
function resultOf(e){ return e.score == null ? null : Object.assign({ score: e.score, passed: !!e.passed, distinction: !!e.distinction }, e.detail ? JSON.parse(e.detail) : {}); }
async function myExams(C){
  const r = await C.db.prepare('SELECT id, quest, level, state, started_at, ended_at, score, passed, distinction, session_id FROM exams WHERE user_id = ? ORDER BY started_at DESC LIMIT 50').bind(C.user.id).all();
  return json({ exams: (r.results || []).map(x => ({ id: x.id, quest: x.quest, level: x.level, state: x.state, startedAt: x.started_at, endedAt: x.ended_at, score: x.score, passed: !!x.passed, distinction: !!x.distinction, proctored: !!x.session_id })) });
}

/* ---------- Abgabe einer Aufgabe / Antwort ---------- */
async function answer(C, id){
  const e = await ownExam(C, id);
  if(e.state !== 'running') fail(409, 'Die Prüfung ist abgeschlossen.');
  if(now() > e.deadline + GRACE) fail(409, 'Die Zeit ist abgelaufen.');
  const item = String(C.body.item || ''), b = built(e);
  const task = b.tasks.find(t => t.id === item), q = b.questions.find(x => x.id === item);
  if(!task && !q) fail(404, 'Unbekannte Aufgabe.');
  const raw = C.body.answer;
  if(task){
    const ans = task.kind === 'grund' ? String(raw == null ? '' : raw) : (raw && typeof raw === 'object' ? Object.fromEntries(task.blocks.filter(x => x.edit).map(x => [x.name, String(raw[x.name] == null ? x.start : raw[x.name])])) : null);
    if(ans == null) fail(400, 'Antwort fehlt.');
    if(JSON.stringify(ans).length > Exam.LIMITS.codeBytes) fail(413, 'Code zu gross (max. 20 KB).');
    // zuerst speichern (falls die Bewertung das CPU-Budget sprengt, bleibt die Abgabe erhalten und wird erneut bewertet)
    await C.db.prepare('INSERT INTO exam_answers (exam_id, item, answer, result, points, submitted_at) VALUES (?, ?, ?, NULL, NULL, ?) ON CONFLICT(exam_id, item) DO UPDATE SET answer = excluded.answer, result = NULL, points = NULL, submitted_at = excluded.submitted_at')
      .bind(id, item, JSON.stringify(ans), now()).run();
    const g = Exam.gradeFor(task, ans);
    const result = { ok: g.ok, passed: g.passed, total: g.total, missing: g.missing || [], warn: g.warn || [], error: g.error ? { line: g.error.line, col: g.error.col, block: g.error.block, message: g.error.message } : null };
    await C.db.prepare('UPDATE exam_answers SET result = ?, points = ? WHERE exam_id = ? AND item = ?').bind(JSON.stringify(result), g.points, id, item).run();
    return json({ item, result });
  }
  const a = Number.isInteger(+raw) && +raw >= 0 && +raw < q.options.length ? +raw : fail(400, 'Ungültige Antwort.');
  const g = Exam.gradeQuestion(q, a);
  await C.db.prepare('INSERT INTO exam_answers (exam_id, item, answer, result, points, submitted_at) VALUES (?, ?, ?, NULL, ?, ?) ON CONFLICT(exam_id, item) DO UPDATE SET answer = excluded.answer, points = excluded.points, submitted_at = excluded.submitted_at')
    .bind(id, item, JSON.stringify(a), g.points, now()).run();
  return json({ item, saved: true });   // Theorie: keine Rückmeldung vor dem Abschluss
}
async function focus(C, id){
  const e = await ownExam(C, id);
  if(e.state === 'running') await C.db.prepare('UPDATE exams SET focus_lost = focus_lost + 1 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

/* ---------- Abschluss ---------- */
async function submit(C, id){
  const e = await ownExam(C, id);
  if(e.state !== 'running') return getExam(C, id);
  const ans = await answersOf(C, id), b = built(e);
  const pending = b.tasks.filter(t => ans[t.id] && ans[t.id].answer && ans[t.id].points == null).map(t => t.id);
  if(pending.length) fail(409, 'Einige Abgaben werden noch bewertet.', { pending });
  await finalize(C, e, 'submitted');
  return getExam(C, id);
}
async function finalize(C, e, state){
  const b = built(e), ans = await answersOf(C, e.id), pts = {};
  Object.values(ans).forEach(a => { pts[a.item] = a.points || 0; });
  const t = Exam.total(b, pts);
  // schwache Kapitel (für Hinweise nach dem Nichtbestehen)
  const weak = new Set();
  b.tasks.forEach(x => { if((pts[x.id] || 0) < 1) weak.add(x.ch); });
  b.questions.forEach(x => { if(!pts[x.id]) weak.add(x.ch); });
  const detail = { tasks: t.tasks, theory: t.theory, perTask: b.tasks.map(x => ({ id: x.id, title: x.title, ch: x.ch, points: pts[x.id] || 0 })),
    theoryRight: b.questions.filter(x => pts[x.id]).length, theoryTotal: b.questions.length, weakChapters: [...weak].sort((a, c) => a - c) };
  await C.db.prepare('UPDATE exams SET state = ?, ended_at = ?, score = ?, passed = ?, distinction = ?, detail = ? WHERE id = ? AND state = ?')
    .bind(state, now(), t.score, t.passed ? 1 : 0, t.distinction ? 1 : 0, JSON.stringify(detail), e.id, 'running').run();
  return examRow(C, e.id);
}

/* ---------- Dozent: Prüfung unter Aufsicht ---------- */
async function uniqueSessionCode(C){
  for(let i = 0; i < 20; i++){ const code = randomCode(6); if(!await C.db.prepare('SELECT id FROM exam_sessions WHERE code = ?').bind(code).first()) return code; }
  fail(503, 'Kein freier Code gefunden.');
}
async function createSession(C, H){
  H.requireRole(C, 'teacher', 'admin');
  const b = C.body;
  if(!QUESTS.includes(b.quest) || !LEVELS.includes(b.level)) fail(400, 'Quest oder Stufe fehlt.');
  let classId = null;
  if(b.classId){ const c = await C.db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').bind(+b.classId, C.user.id).first(); if(!c) fail(404, 'Klasse nicht gefunden.'); classId = c.id; }
  const opens = +b.opensAt || now(), minutes = Math.max(15, Math.min(8 * 60, Math.round(+b.minutes || (Exam.RULES[b.level].minutes + 30))));
  const closes = +b.closesAt || opens + minutes * 60000;
  if(closes <= opens) fail(400, 'Das Zeitfenster ist ungültig.');
  const code = await uniqueSessionCode(C);
  const r = await C.db.prepare('INSERT INTO exam_sessions (teacher_id, class_id, quest, level, code, opens_at, closes_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(C.user.id, classId, b.quest, b.level, code, opens, closes, now()).run();
  return json({ id: r.meta.last_row_id, code, opensAt: opens, closesAt: closes }, 201);
}
async function ownSession(C, H, id){
  H.requireRole(C, 'teacher', 'admin');
  const s = await C.db.prepare('SELECT s.*, c.name AS class_name FROM exam_sessions s LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = ?').bind(id).first();
  if(!s || (C.user.role !== 'admin' && s.teacher_id !== C.user.id)) fail(404, 'Prüfungssitzung nicht gefunden.');
  return s;
}
async function listSessions(C, H){
  H.requireRole(C, 'teacher', 'admin');
  const r = await C.db.prepare(`SELECT s.id, s.quest, s.level, s.code, s.opens_at, s.closes_at, s.created_at, c.name AS class_name,
      (SELECT COUNT(*) FROM exams e WHERE e.session_id = s.id) AS participants, (SELECT COUNT(*) FROM exams e WHERE e.session_id = s.id AND e.passed = 1) AS passed
    FROM exam_sessions s LEFT JOIN classes c ON c.id = s.class_id WHERE s.teacher_id = ? ORDER BY s.created_at DESC LIMIT 30`).bind(C.user.id).all();
  return json({ sessions: (r.results || []).map(s => ({ id: s.id, quest: s.quest, level: s.level, code: s.code, opensAt: s.opens_at, closesAt: s.closes_at, className: s.class_name, participants: s.participants, passed: s.passed })) });
}
async function sessionView(C, H, id){
  const s = await ownSession(C, H, id);
  const r = await C.db.prepare('SELECT e.*, u.username FROM exams e JOIN users u ON u.id = e.user_id WHERE e.session_id = ? ORDER BY u.username').bind(id).all();
  const exams = [];
  for(const e of (r.results || [])){
    const b = built(e), ans = await answersOf(C, e.id);
    const tasksDone = b.tasks.filter(t => ans[t.id] && ans[t.id].points === 1).length, tasksTried = b.tasks.filter(t => ans[t.id]).length;
    exams.push({ id: e.id, username: e.username, state: e.state === 'running' && now() > e.deadline + GRACE ? 'expired' : e.state, startedAt: e.started_at, deadline: e.deadline,
      focusLost: e.focus_lost, tasks: b.tasks.length, tasksDone, tasksTried, questions: b.questions.length, questionsAnswered: b.questions.filter(q => ans[q.id]).length,
      score: e.score, passed: !!e.passed, distinction: !!e.distinction, voidReason: e.void_reason });
  }
  return json({ session: { id: s.id, quest: s.quest, level: s.level, code: s.code, opensAt: s.opens_at, closesAt: s.closes_at, className: s.class_name, now: now() }, exams });
}
async function closeSession(C, H, id){
  await ownSession(C, H, id);
  await C.db.prepare('UPDATE exam_sessions SET closes_at = ? WHERE id = ? AND closes_at > ?').bind(now(), id, now()).run();
  return json({ ok: true });
}
async function voidExam(C, H, id){
  H.requireRole(C, 'teacher', 'admin');
  const reason = cleanText(C.body.reason, 300);
  if(!reason) fail(400, 'Bitte eine Begründung angeben.');
  const e = await examRow(C, id);
  if(!e) fail(404, 'Prüfung nicht gefunden.');
  if(C.user.role !== 'admin'){
    const own = e.session_id ? await C.db.prepare('SELECT id FROM exam_sessions WHERE id = ? AND teacher_id = ?').bind(e.session_id, C.user.id).first()
      : await C.db.prepare('SELECT u.id FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND c.teacher_id = ?').bind(e.user_id, C.user.id).first();
    if(!own) fail(404, 'Prüfung nicht gefunden.');
  }
  if(e.state === 'running') await finalize(C, e, 'voided');
  await C.db.batch([
    C.db.prepare("UPDATE exams SET state = 'voided', void_reason = ?, passed = 0, distinction = 0 WHERE id = ?").bind(reason, id),
    C.db.prepare("UPDATE certificates SET revoked_at = ?, revoke_reason = ? WHERE exam_id = ? AND revoked_at IS NULL").bind(now(), 'Prüfung annulliert: ' + reason, id)
  ]);
  return json({ ok: true });
}
export { LEVEL_NAME, validCert, examRow };
