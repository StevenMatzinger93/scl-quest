// SPS Quest — Pikettdienst (docs/PLAN_ZERTIFIKAT_PIKETT.md Teil B.6, docs/PIKETT_KONZEPT.md).
// Der Server zieht den Schichtplan, prüft jede Behebung nach (Programmcode gegen die Tests der Spielaufgabe,
// Hardware-/Bedien-Diagnose gegen die Störung) und rechnet Punkte und Rang nur aus nachgeprüften Behebungen.
import { json, fail, now, cleanText } from './lib.js';
import { Exam, Pikett, ProTask } from './gen/exam_bundle.js';
import { PIKETT_DATA } from './gen/pikett_data.js';

const QUESTS = ['scl', 'kop', 'fup', 'awl'];
const LIMITS = { codeBytes: 20 * 1024, maxIter: 20000 };
const byId = {};
QUESTS.forEach(q => { byId[q] = Object.fromEntries(((PIKETT_DATA[q] || {}).incidents || []).map(x => [x.id, x])); });
const incOf = (q, id) => byId[q] && byId[q][id];

export async function pikettRoutes(C, p, m, H){
  let mm = p.match(/^\/api\/classes\/(\d+)\/pikett$/);
  if(!p.startsWith('/api/pikett') && !mm) return null;
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  if(mm && m === 'GET') return classBoard(C, H, +mm[1]);
  if(p === '/api/pikett/me' && m === 'GET') return me(C);
  if(p === '/api/pikett/shifts' && m === 'POST') return startShift(C);
  if((mm = p.match(/^\/api\/pikett\/shifts\/(\d+)\/fix$/)) && m === 'POST') return fix(C, +mm[1]);
  if((mm = p.match(/^\/api\/pikett\/shifts\/(\d+)\/end$/)) && m === 'POST') return endShift(C, +mm[1]);
  if((mm = p.match(/^\/api\/pikett\/shifts\/(\d+)\/handover$/)) && m === 'POST') return handover(C, +mm[1]);
  fail(404, 'Unbekannte Adresse.');
}

// Entwicklung/Tests (EXAM_DEV=1): Zeitraffer bis 60× erlaubt; sonst läuft die Schichtuhr in Echtzeit
const speedMax = C => C.env.EXAM_DEV === '1' ? 60 : 1;
const questOf = q => { if(!QUESTS.includes(q)) fail(400, 'Unbekannte Quest.'); return q; };

async function rankRow(C, userId, quest){
  const r = await C.db.prepare('SELECT * FROM pikett_ranks WHERE user_id = ? AND quest = ?').bind(userId, quest).first();
  return r || { points: 0, shifts: 0, nights: 0, good_nights: 0, rank: 1, reached_at: null };
}
function rankOut(r){
  const k = Pikett.RANKS.find(x => x.n === r.rank) || Pikett.RANKS[0];
  return { points: r.points, shifts: r.shifts, nights: r.nights, goodNights: r.good_nights, rank: k.n, rankName: k.name, reachedAt: r.reached_at || null };
}
async function me(C){
  const quest = questOf(C.url.searchParams.get('quest'));
  const r = await rankRow(C, C.user.id, quest);
  const s = await C.db.prepare("SELECT id, shift, state, started_at, ended_at, early, availability, mttr, downtime, points, counted_night, handover FROM pikett_shifts WHERE user_id = ? AND quest = ? ORDER BY started_at DESC LIMIT 10").bind(C.user.id, quest).all();
  return json(Object.assign(rankOut(r), { shiftsList: (s.results || []).map(shiftOut) }));
}
const shiftOut = x => ({ id: x.id, shift: x.shift, state: x.state, startedAt: x.started_at, endedAt: x.ended_at, early: !!x.early, availability: x.availability, mttr: x.mttr, downtime: x.downtime, points: x.points, night: !!x.counted_night, handover: x.handover || '' });

/* ---------- Schicht beginnen: Plan aus den gelösten Aufgaben (Spielstand im Konto) ---------- */
async function startShift(C){
  const quest = questOf(C.body.quest), shift = C.body.shift;
  const S = Pikett.SHIFTS[shift]; if(!S) fail(400, 'Unbekannte Schicht.');
  const r = await rankRow(C, C.user.id, quest);
  if(r.rank < S.rank) fail(403, S.name + ' erst ab Rang ' + Pikett.RANKS[S.rank - 1].name + '.');
  const pr = await C.db.prepare('SELECT state FROM progress WHERE user_id = ? AND quest = ?').bind(C.user.id, quest).first();
  let done = {}; try{ done = (pr && JSON.parse(pr.state).doneTasks) || {}; }catch(e){}
  const pool = ((PIKETT_DATA[quest] || {}).incidents || []).filter(x => done[x.base]);
  if(!pool.length) fail(409, 'Noch keine Störungen verfügbar: zuerst Aufgaben lösen (Spielstand im Konto).');
  // höchstens eine offene Schicht je Quest: ältere laufende werden als abgebrochen abgeschlossen
  await C.db.prepare("UPDATE pikett_shifts SET state = 'aborted', ended_at = ? WHERE user_id = ? AND quest = ? AND state = 'running'").bind(now(), C.user.id, quest).run();
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483646) + 1;
  const plan = Pikett.plan(pool, shift, seed);
  const res = await C.db.prepare('INSERT INTO pikett_shifts (user_id, quest, shift, seed, plan, started_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(C.user.id, quest, shift, seed, JSON.stringify(plan), now()).run();
  return json({ id: res.meta.last_row_id, shift, seed, plan, speedMax: speedMax(C) });
}

async function ownShift(C, id){
  const s = await C.db.prepare('SELECT * FROM pikett_shifts WHERE id = ? AND user_id = ?').bind(id, C.user.id).first();
  if(!s) fail(404, 'Schicht nicht gefunden.');
  s.planList = JSON.parse(s.plan); s.itemMap = JSON.parse(s.items || '{}');
  return s;
}
// Schichtzeit (s) nach Serveruhr, mit dem höchsten erlaubten Zeitraffer
const elapsed = (C, s) => (now() - s.started_at) / 1000 * speedMax(C);
const num = (v, lo, hi) => { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };

/* ---------- Eine Behebung nachprüfen (eine Störung je Anfrage: CPU-Budget) ---------- */
async function fix(C, id){
  const s = await ownShift(C, id);
  if(s.state !== 'running') fail(409, 'Die Schicht ist bereits beendet.');
  const b = C.body, incId = String(b.incident || '');
  if(!s.planList.some(x => x.id === incId)) fail(400, 'Diese Störung gehört nicht zur Schicht.');
  const inc = incOf(s.quest, incId);
  const it = s.itemMap[incId] || (s.itemMap[incId] = { fails: 0 });
  if(it.ok) return json({ ok: true, already: true });
  const dur = Pikett.SHIFTS[s.shift].minutes * 60, t = Math.min(dur, elapsed(C, s) + 5);
  const d = b.diag || {}, cause = Pikett.CAUSE[d.cause];
  let ok = false, why = '';
  if(!cause) why = 'Keine gültige Diagnose.';
  else if(inc.kind === 'program'){
    if(cause.group !== 'program') why = 'Diagnose passt nicht zur Störung.';
    else {
      const code = b.code, size = JSON.stringify(code || '').length;
      if(!code || size > LIMITS.codeBytes) why = 'Programmcode fehlt oder ist zu gross.';
      else { const r = check(s.quest, inc, code); ok = r.ok; if(!ok) why = 'Das Programm besteht die Tests der Anlage nicht.'; }
    }
  } else if(inc.kind === 'hardware'){
    ok = cause.group === 'hardware' && Pikett.causeOk(inc, d.cause) && d.part === inc.part;
    if(!ok) why = 'Diagnose oder Bauteil stimmt nicht.';
  } else {
    ok = cause.group === 'operator' && !!d.param && d.param.var === inc.param.var && String(d.param.value) === String(inc.param.right);
    if(!ok) why = 'Parameter nicht richtig eingestellt.';
  }
  if(ok){
    const fixedAt = num(b.fixedAt, 0, t), at = num(b.at, 0, fixedAt);
    Object.assign(it, { ok: true, at, fixedAt, causeOk: Pikett.causeOk(inc, d.cause), partOk: inc.kind === 'hardware' && d.part === inc.part,
      fails: Math.max(it.fails, Math.round(num(b.fails, 0, 99))), hints: Math.round(num(b.hints, 0, Pikett.SHIFTS[s.shift].hints)), verifiedAt: now() });
  } else it.fails++;
  await C.db.prepare('UPDATE pikett_shifts SET items = ? WHERE id = ?').bind(JSON.stringify(s.itemMap), s.id).run();
  return json(ok ? { ok: true } : { ok: false, error: why });
}
export function check(quest, inc, code){
  const D = PIKETT_DATA[quest], t = D.tasks[inc.base], eng = Object.assign({ ProTask }, Exam.engines()[quest]);
  if(!t) return { ok: false };
  if(t.pro && (typeof code !== 'object' || Array.isArray(code))) return { ok: false };
  if(!t.pro && typeof code !== 'string') return { ok: false };
  if(t.pro) code = Object.assign(ProTask.refCodes(t), Object.fromEntries(ProTask.editable(t).filter(k => typeof code[k] === 'string').map(k => [k, code[k]])));
  const prev = globalThis.SCL_MAX_ITER; globalThis.SCL_MAX_ITER = LIMITS.maxIter;
  try{ return Pikett.evaluate(t, code, eng); } finally{ globalThis.SCL_MAX_ITER = prev; }
}

/* ---------- Schicht beenden: Kennzahlen und Punkte aus den nachgeprüften Behebungen ---------- */
async function endShift(C, id){
  const s = await ownShift(C, id);
  if(s.state !== 'running') fail(409, 'Die Schicht ist bereits beendet.');
  const S = Pikett.SHIFTS[s.shift], dur = S.minutes * 60, el = elapsed(C, s);
  const early = !!C.body.early || el < dur - 60;
  const stop = early ? Math.min(dur, el + 5) : dur;
  // aufgetretene Störungen: nachgeprüfte plus die, die der Browser als offen meldet (Plan-Zeitpunkt vor dem Schichtende)
  const seen = new Set(((C.body.items || []).map(x => x && String(x.id))).filter(Boolean));
  const results = s.planList.filter(p => s.itemMap[p.id] && s.itemMap[p.id].ok || (seen.has(p.id) && p.at <= stop)).map(p => {
    const it = s.itemMap[p.id] || {}, cl = (C.body.items || []).find(x => x && x.id === p.id) || {};
    if(it.ok) return { id: p.id, at: it.at, fixed: true, fixedAt: it.fixedAt, fails: it.fails, hints: it.hints, causeOk: it.causeOk, partOk: it.partOk };
    return { id: p.id, at: cl.at != null ? num(cl.at, 0, stop) : Math.min(p.at, stop), fixed: false, fixedAt: null, fails: it.fails || 0, hints: 0 };
  });
  const sum = Pikett.shiftSummary(s.shift, results.map(r => ({ at: r.at, fixed: r.fixed, fixedAt: r.fixedAt })));
  // Stillstand je Störung wie im Spiel (ab Alarm bis zur Behebung, offen bis Schichtende)
  results.forEach(r => { r.downtime = Math.round((r.fixed ? r.fixedAt : dur) - r.at); r.points = Pikett.incidentPoints(r); });
  // Schichtbonus nur für eine zu Ende gearbeitete Schicht (sonst brächte Starten und sofort Beenden 500 Punkte)
  const points = results.reduce((a, r) => a + r.points, 0) + (sum.availability >= 0.95 && !early ? 500 : 0);
  const night = s.shift === 'nacht' && !early;
  const r = await rankRow(C, C.user.id, s.quest);
  const P = r.points + points, nights = r.nights + (night ? 1 : 0), good = r.good_nights + (night && sum.availability >= 0.9 ? 1 : 0);
  const rk = Math.max(r.rank, Pikett.rankOf(P, good).n), t = now();
  const reached = r.reached_at || (rk >= 4 ? t : null);
  await C.db.batch([
    C.db.prepare("UPDATE pikett_shifts SET state = 'done', ended_at = ?, early = ?, availability = ?, mttr = ?, downtime = ?, points = ?, counted_night = ?, report = ? WHERE id = ?")
      .bind(t, early ? 1 : 0, sum.availability, sum.mttr, sum.downtime, points, night ? 1 : 0, JSON.stringify(results), s.id),
    C.db.prepare(`INSERT INTO pikett_ranks (user_id, quest, points, shifts, nights, good_nights, rank, reached_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, quest) DO UPDATE SET points = excluded.points, shifts = pikett_ranks.shifts + 1, nights = excluded.nights, good_nights = excluded.good_nights, rank = excluded.rank, reached_at = excluded.reached_at, updated_at = excluded.updated_at`)
      .bind(C.user.id, s.quest, P, nights, good, rk, reached, t)
  ]);
  return json({ id: s.id, early, availability: sum.availability, mttr: sum.mttr, downtime: sum.downtime, points, night, incidents: results,
    rank: rankOut({ points: P, shifts: r.shifts + 1, nights, good_nights: good, rank: rk, reached_at: reached }), rankUp: rk > r.rank });
}

async function handover(C, id){
  const s = await ownShift(C, id);
  if(s.state !== 'done') fail(409, 'Übergabe erst nach Schichtende.');
  const text = cleanText(C.body.text, 300);
  await C.db.prepare('UPDATE pikett_shifts SET handover = ? WHERE id = ?').bind(text || null, s.id).run();
  return json({ ok: true });
}

/* ---------- Leitstand: Pikett-Tafel der Klasse ---------- */
async function classBoard(C, H, id){
  H.requireRole(C, 'teacher', 'admin');
  const c = await C.db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').bind(id).first();
  if(!c || (C.user.role !== 'admin' && c.teacher_id !== C.user.id)) fail(404, 'Klasse nicht gefunden.');
  const quest = questOf(C.url.searchParams.get('quest') || 'scl');
  const st = await C.db.prepare("SELECT u.id, u.username, r.points, r.shifts, r.nights, r.good_nights, r.rank, r.reached_at FROM users u LEFT JOIN pikett_ranks r ON r.user_id = u.id AND r.quest = ? WHERE u.class_id = ? AND u.role = 'student' ORDER BY r.points DESC, u.username").bind(quest, id).all();
  const sh = await C.db.prepare("SELECT s.id, s.user_id, u.username, s.shift, s.state, s.started_at, s.ended_at, s.early, s.availability, s.mttr, s.downtime, s.points, s.counted_night, s.handover FROM pikett_shifts s JOIN users u ON u.id = s.user_id WHERE u.class_id = ? AND s.quest = ? AND s.state <> 'aborted' ORDER BY s.started_at DESC LIMIT 60").bind(id, quest).all();
  return json({ quest, students: (st.results || []).map(x => Object.assign({ userId: x.id, username: x.username }, rankOut({ points: x.points || 0, shifts: x.shifts || 0, nights: x.nights || 0, good_nights: x.good_nights || 0, rank: x.rank || 1, reached_at: x.reached_at }))),
    shifts: (sh.results || []).map(x => Object.assign(shiftOut(x), { userId: x.user_id, username: x.username })) });
}
