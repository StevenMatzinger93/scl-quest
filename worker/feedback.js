// SPS Quest — Feedback-Formular für den Praxistest in der Klasse.
// Lernende geben Feedback (ohne Namen für die Lehrperson), Dozenten sehen die Auswertung ihrer Klassen, der Admin alles.
import { json, fail, now, cleanText } from './lib.js';

export const FEEDBACK_QUESTIONS = {
  scale: ['verstaendlich', 'anlage', 'hinweise', 'gelernt', 'spass', 'challenge', 'empfehlen'],
  choice: { niveau: ['zu leicht', 'passend', 'zu schwer'], geraet: ['PC/Laptop', 'Tablet', 'Handy'], kapitel: ['1–2', '3–5', '6–10', '11–15'] },
  text: ['gut', 'stoerend', 'fehler']
};

export async function feedbackRoutes(C, p, m, H){
  if(!p.startsWith('/api/feedback')) return null;
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  if(p === '/api/feedback' && m === 'POST') return submit(C);
  if(p === '/api/feedback' && m === 'GET') return results(C, H);
  fail(404, 'Unbekannte Adresse.');
}
function clean(a){
  a = a && typeof a === 'object' ? a : {};
  const out = {};
  FEEDBACK_QUESTIONS.scale.forEach(k => { const v = Math.round(+a[k]); if(v >= 1 && v <= 5) out[k] = v; });
  Object.keys(FEEDBACK_QUESTIONS.choice).forEach(k => { if(FEEDBACK_QUESTIONS.choice[k].includes(a[k])) out[k] = a[k]; });
  FEEDBACK_QUESTIONS.text.forEach(k => { const t = cleanText(String(a[k] || '').replace(/[\r\n]+/g, ' '), 1000); if(t) out[k] = t; });
  return out;
}
async function submit(C){
  const a = clean(C.body.answers);
  if(!Object.keys(a).length) fail(400, 'Bitte mindestens eine Frage beantworten.');
  const recent = await C.db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND created_at > ?').bind(C.user.id, now() - 3600e3).first();
  if(recent.n >= 3) fail(429, 'Danke! Du hast in der letzten Stunde schon Feedback gegeben.');
  await C.db.prepare('INSERT INTO feedback (user_id, role, class_id, quest, answers, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(C.user.id, C.user.role, C.user.class_id || null, 'scl', JSON.stringify(a), now()).run();
  return json({ ok: true }, 201);
}
async function results(C, H){
  H.requireRole(C, 'teacher', 'admin');
  const classId = +C.url.searchParams.get('classId') || 0;
  let rows;
  if(C.user.role === 'admin' && !classId) rows = await C.db.prepare('SELECT role, class_id, answers, created_at FROM feedback ORDER BY created_at DESC LIMIT 1000').all();
  else {
    const c = await C.db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').bind(classId).first();
    if(!c || (C.user.role !== 'admin' && c.teacher_id !== C.user.id)) fail(404, 'Klasse nicht gefunden.');
    rows = await C.db.prepare('SELECT role, class_id, answers, created_at FROM feedback WHERE class_id = ? ORDER BY created_at DESC LIMIT 1000').bind(classId).all();
  }
  const list = (rows.results || []).map(r => Object.assign({ at: r.created_at, role: r.role }, JSON.parse(r.answers)));
  const avg = {}, counts = {};
  FEEDBACK_QUESTIONS.scale.forEach(k => { const v = list.map(x => x[k]).filter(Boolean); avg[k] = v.length ? Math.round(10 * v.reduce((a, b) => a + b, 0) / v.length) / 10 : null; counts[k] = v.length; });
  const choices = {};
  Object.keys(FEEDBACK_QUESTIONS.choice).forEach(k => { choices[k] = {}; FEEDBACK_QUESTIONS.choice[k].forEach(o => choices[k][o] = list.filter(x => x[k] === o).length); });
  const texts = {};
  FEEDBACK_QUESTIONS.text.forEach(k => texts[k] = list.filter(x => x[k]).map(x => ({ at: x.at, text: x[k] })));
  return json({ n: list.length, avg, counts, choices, texts });
}
