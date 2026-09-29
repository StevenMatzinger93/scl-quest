// SPS Quest — Live-Challenge im Klassenzimmer.
// Dozent startet eine Challenge (Speedrun, Störungsjagd) und erhält einen 4-stelligen Code,
// Lernende treten mit ihrem Konto bei. Beamer und Spiel fragen den Stand alle 2–3 s ab (Polling, D1).
import { json, fail, now, randomDigits, cleanText } from './lib.js';
import { avatarsFor } from './avatar.js';

const MODES = ['sprint', 'bug'];   // 'pikett' (bis 29.09.2026) ist entfernt; alte Zeilen in D1 bleiben lesbar
const QUESTS = ['scl', 'kop', 'fup', 'awl', 'sensor'];
const MAX_PLAYERS = 120;
const MAX_TASKS = 10;   // Speedrun: 1–10 Aufgaben je Challenge
const ID_RE = /^[A-Za-z0-9_]+$/;
// Aufgabenliste einer Challenge (alte Zeilen ohne tasks: nur task_id)
export const taskList = ch => { try{ const a = ch.tasks ? JSON.parse(ch.tasks) : null; if(Array.isArray(a) && a.length) return a; }catch(e){} return [ch.task_id]; };
const solvedN = p => p.solved_n || (p.solved_at ? 1 : 0);

export async function challengeRoutes(C, p, m, H){
  if(!p.startsWith('/api/challenges') && !p.startsWith('/api/live')) return null;
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  let mm;
  // Dozent
  if(p === '/api/challenges' && m === 'GET') return listChallenges(C, H);
  if(p === '/api/challenges' && m === 'POST') return createChallenge(C, H);
  if((mm = p.match(/^\/api\/challenges\/(\d+)$/))){
    if(m === 'GET') return beamerState(C, H, +mm[1]);
    if(m === 'DELETE') return deleteChallenge(C, H, +mm[1]);
  }
  if((mm = p.match(/^\/api\/challenges\/(\d+)\/(start|stop|show|kick)$/)) && m === 'POST') return control(C, H, +mm[1], mm[2]);
  // Lernende
  if(p === '/api/live/join' && m === 'POST') return join(C);
  if((mm = p.match(/^\/api\/live\/(\d+)$/)) && m === 'GET') return playerState(C, +mm[1]);
  if((mm = p.match(/^\/api\/live\/(\d+)\/(attempt|hint)$/)) && m === 'POST') return report(C, +mm[1], mm[2]);
  fail(404, 'Unbekannte Adresse.');
}

// ---------- Hilfen ----------
function effState(ch, t){
  if(ch.state === 'running' && ch.ends_at && t >= ch.ends_at) return 'ended';
  return ch.state;
}
async function closeIfOver(C, ch){
  const t = now();
  if(ch.state === 'running' && ch.ends_at && t >= ch.ends_at){
    await C.db.prepare("UPDATE challenges SET state = 'ended', ended_at = ends_at WHERE id = ? AND state = 'running'").bind(ch.id).run();
    ch.state = 'ended'; ch.ended_at = ch.ends_at;
  }
  return ch;
}
export function livePoints(ch, pl){
  if(!pl.solved_at || !ch.started_at) return 0;
  const dur = Math.max(60, ch.duration);
  const t = Math.max(0, (pl.solved_at - ch.started_at) / 1000);
  const fails = Math.max(0, pl.attempts - 1);
  const base = 500 + Math.round(500 * Math.max(0, 1 - t / dur));
  return Math.max(100, base - Math.min(250, 50 * fails) - 100 * pl.hints);
}
// Rangliste: eine Aufgabe = Punkte, dann Zeit (wie bisher); gestapelter Speedrun = gelöste Aufgaben, dann Zeit der letzten Lösung
function rank(players, stacked){
  const sorted = players.slice().sort((a, b) => {
    const na = solvedN(a), nb = solvedN(b);
    if(!!nb !== !!na) return nb ? 1 : -1;
    if(na){
      if(stacked) return (nb - na) || (a.solved_at - b.solved_at) || (b.points - a.points);
      return (b.points - a.points) || (a.solved_at - b.solved_at);
    }
    return a.username.localeCompare(b.username);
  });
  let r = 0, last = null;
  sorted.forEach((p, i) => {
    if(solvedN(p)){
      const same = last && last.solved_at === p.solved_at && (stacked ? solvedN(last) === solvedN(p) : last.points === p.points);
      if(!same) r = i + 1; p.rank = r; last = p;
    } else p.rank = null;
  });
  return sorted;
}
async function ownChallenge(C, H, id){
  H.requireRole(C, 'teacher', 'admin');
  const ch = await C.db.prepare('SELECT * FROM challenges WHERE id = ?').bind(id).first();
  if(!ch || (C.user.role !== 'admin' && ch.teacher_id !== C.user.id)) fail(404, 'Challenge nicht gefunden.');
  return closeIfOver(C, ch);
}
async function players(C, id){
  return ((await C.db.prepare('SELECT * FROM challenge_players WHERE challenge_id = ?').bind(id).all()).results || []);
}
function publicChallenge(ch){
  const t = now(), st = effState(ch, t);
  return { id: ch.id, code: ch.code, quest: ch.quest, mode: ch.mode, taskId: ch.task_id, tasks: taskList(ch), bugId: ch.mode === 'bug' ? ch.bug_id : null, title: ch.title, classId: ch.class_id,
    duration: ch.duration, state: st, createdAt: ch.created_at, startedAt: ch.started_at, endsAt: ch.ends_at,
    timeLeft: st === 'running' ? Math.max(0, Math.round((ch.ends_at - t) / 1000)) : st === 'lobby' ? ch.duration : 0, serverTime: t };
}

// ---------- Dozent ----------
async function listChallenges(C, H){
  H.requireRole(C, 'teacher', 'admin');
  const r = await C.db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM challenge_players p WHERE p.challenge_id = c.id) AS n,
      (SELECT COUNT(*) FROM challenge_players p WHERE p.challenge_id = c.id AND p.solved_at IS NOT NULL AND MAX(p.solved_n, 1) >= COALESCE(json_array_length(c.tasks), 1)) AS solved
    FROM challenges c WHERE c.teacher_id = ? ORDER BY c.created_at DESC LIMIT 30`).bind(C.user.id).all();
  return json({ challenges: (r.results || []).map(ch => Object.assign(publicChallenge(ch), { players: ch.n, solved: ch.solved })) });
}
async function uniqueCode(C){
  const t = now();
  for(let i = 0; i < 30; i++){
    const code = randomDigits(4);
    if(code[0] === '0') continue;
    const ex = await C.db.prepare("SELECT id FROM challenges WHERE code = ? AND state <> 'ended' AND created_at > ?").bind(code, t - 864e5).first();
    if(!ex) return code;
  }
  fail(503, 'Gerade sind zu viele Challenges aktiv. Bitte gleich nochmal versuchen.');
}
async function createChallenge(C, H){
  H.requireRole(C, 'teacher', 'admin');
  const b = C.body;
  const mode = MODES.includes(b.mode) ? b.mode : fail(400, 'Modus fehlt (sprint oder bug).');
  const quest = QUESTS.includes(b.quest || 'scl') ? (b.quest || 'scl') : fail(400, 'Unbekannte Quest.');
  let list = null;
  if(mode === 'sprint' && Array.isArray(b.tasks)){
    list = [...new Set(b.tasks.map(x => cleanText(x, 40)))];
    if(list.length < 1 || list.length > MAX_TASKS) fail(400, 'Ein Speedrun hat 1 bis ' + MAX_TASKS + ' Aufgaben.');
    if(!list.every(x => ID_RE.test(x))) fail(400, 'Aufgabe fehlt.');
  }
  const taskId = list ? list[0] : cleanText(b.taskId, 40); if(!ID_RE.test(taskId)) fail(400, 'Aufgabe fehlt.');
  let bugId = mode === 'bug' ? cleanText(b.bugId, 40) : null;
  if(mode === 'bug' && !/^[A-Za-z0-9_]+$/.test(bugId || '')) fail(400, 'Störungsszenario fehlt.');
  const duration = Math.max(60, Math.min(3600, Math.round(+b.duration || 600)));
  let classId = null;
  if(b.classId){
    const c = await C.db.prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?').bind(+b.classId, C.user.id).first();
    if(!c) fail(404, 'Klasse nicht gefunden.');
    classId = c.id;
  }
  // alte Challenges des Dozenten beenden (eine aktive Challenge pro Dozent)
  await C.db.prepare("UPDATE challenges SET state = 'ended', ended_at = ? WHERE teacher_id = ? AND state <> 'ended'").bind(now(), C.user.id).run();
  const code = await uniqueCode(C);
  const r = await C.db.prepare('INSERT INTO challenges (code, teacher_id, class_id, quest, mode, task_id, tasks, bug_id, title, duration, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(code, C.user.id, classId, quest, mode, taskId, list && list.length > 1 ? JSON.stringify(list) : null, bugId, cleanText(b.title, 80), duration, 'lobby', now()).run();
  return json({ id: r.meta.last_row_id, code }, 201);
}
async function beamerState(C, H, id){
  const ch = await ownChallenge(C, H, id);
  const tasks = taskList(ch), stacked = tasks.length > 1;
  const pls = rank((await players(C, id)).map(p => Object.assign(p, { points: p.points || livePoints(ch, p) })), stacked);
  const done = {};   // Nutzer → Aufgaben-IDs, die gelöst sind
  ((await C.db.prepare('SELECT user_id, task_id FROM challenge_solves WHERE challenge_id = ? AND solved_at IS NOT NULL').bind(id).all()).results || []).forEach(x => { (done[x.user_id] = done[x.user_id] || new Set()).add(x.task_id); });
  const avs = await avatarsFor(C.db, pls.map(p => p.user_id));
  let shown = null;
  if(ch.show_uid){ const s = pls.find(p => p.user_id === ch.show_uid); if(s && s.code) shown = { code: JSON.parse(s.code), rank: s.rank, points: s.points, taskId: ch.task_id }; }
  if(shown){ shown.taskId = ch.task_id; if(stacked){ const lr = await C.db.prepare('SELECT task_id FROM challenge_solves WHERE challenge_id = ? AND user_id = ? AND solved_at IS NOT NULL ORDER BY solved_at DESC LIMIT 1').bind(id, ch.show_uid).first(); if(lr) shown.taskId = lr.task_id; } }
  return json({ challenge: publicChallenge(ch), shown,
    players: pls.map(p => { const n = Math.min(tasks.length, solvedN(p)); return { userId: p.user_id, username: p.username, attempts: p.attempts, hints: p.hints, solved: n >= tasks.length, solvedN: n,
      progress: tasks.map(t => stacked ? !!(done[p.user_id] && done[p.user_id].has(t)) : n >= 1),
      solvedAfter: p.solved_at && ch.started_at ? Math.round((p.solved_at - ch.started_at) / 1000) : null, points: p.points, rank: p.rank, lastAt: p.last_at, hasCode: !!p.code, avatar: avs[p.user_id] || null }; }) });
}
async function control(C, H, id, action){
  const ch = await ownChallenge(C, H, id);
  const t = now();
  if(action === 'start'){
    if(ch.state !== 'lobby') fail(409, 'Die Challenge läuft bereits oder ist beendet.');
    await C.db.prepare("UPDATE challenges SET state = 'running', started_at = ?, ends_at = ? WHERE id = ?").bind(t, t + ch.duration * 1000, id).run();
  } else if(action === 'stop'){
    if(ch.state === 'ended') return json({ ok: true });
    await C.db.prepare("UPDATE challenges SET state = 'ended', ended_at = ?, ends_at = CASE WHEN ends_at IS NULL OR ends_at > ? THEN ? ELSE ends_at END WHERE id = ?").bind(t, t, t, id).run();
  } else if(action === 'show'){
    const uid = C.body.userId ? +C.body.userId : null;
    await C.db.prepare('UPDATE challenges SET show_uid = ? WHERE id = ?').bind(uid, id).run();
  } else if(action === 'kick'){
    await C.db.batch([C.db.prepare('DELETE FROM challenge_solves WHERE challenge_id = ? AND user_id = ?').bind(id, +C.body.userId || 0), C.db.prepare('DELETE FROM challenge_players WHERE challenge_id = ? AND user_id = ?').bind(id, +C.body.userId || 0)]);
  }
  return json({ ok: true });
}
async function deleteChallenge(C, H, id){
  await ownChallenge(C, H, id);
  await C.db.batch([
    C.db.prepare('DELETE FROM challenge_solves WHERE challenge_id = ?').bind(id),
    C.db.prepare('DELETE FROM challenge_players WHERE challenge_id = ?').bind(id),
    C.db.prepare('DELETE FROM challenges WHERE id = ?').bind(id)
  ]);
  return json({ ok: true });
}

// ---------- Lernende ----------
async function join(C){
  if(C.user.role === 'admin') fail(400, 'Mit dem Admin-Konto kann man nicht mitspielen.');
  const code = String(C.body.code || '').replace(/\D/g, '');
  if(code.length !== 4) fail(400, 'Der Beitrittscode hat 4 Ziffern.');
  const ch = await C.db.prepare("SELECT * FROM challenges WHERE code = ? AND state <> 'ended' AND created_at > ? ORDER BY created_at DESC LIMIT 1").bind(code, now() - 864e5).first();
  if(!ch || effState(ch, now()) === 'ended') fail(404, 'Keine laufende Challenge mit diesem Code.');
  if(ch.class_id && C.user.role === 'student' && C.user.class_id !== ch.class_id) fail(403, 'Diese Challenge ist nur für eine andere Klasse.');
  const ex = await C.db.prepare('SELECT user_id FROM challenge_players WHERE challenge_id = ? AND user_id = ?').bind(ch.id, C.user.id).first();
  if(!ex){
    const n = await C.db.prepare('SELECT COUNT(*) AS n FROM challenge_players WHERE challenge_id = ?').bind(ch.id).first();
    if(n.n >= MAX_PLAYERS) fail(400, 'Die Challenge ist voll.');
    await C.db.prepare('INSERT INTO challenge_players (challenge_id, user_id, username, joined_at, attempts, hints, points, last_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)')
      .bind(ch.id, C.user.id, C.user.username, now(), now()).run();
  }
  return json({ challenge: publicChallenge(ch) });
}
async function playerRow(C, id){
  const ch = await C.db.prepare('SELECT * FROM challenges WHERE id = ?').bind(id).first();
  if(!ch) fail(404, 'Challenge nicht gefunden.');
  const me = await C.db.prepare('SELECT * FROM challenge_players WHERE challenge_id = ? AND user_id = ?').bind(id, C.user.id).first();
  if(!me) fail(403, 'Du bist dieser Challenge nicht beigetreten.');
  return { ch: await closeIfOver(C, ch), me };
}
async function playerState(C, id){
  const { ch, me } = await playerRow(C, id);
  const tasks = taskList(ch), stacked = tasks.length > 1;
  const pls = rank(await players(C, id), stacked);
  const mine = pls.find(p => p.user_id === C.user.id);
  const top = pls.filter(p => solvedN(p)).slice(0, 10).map(p => ({ username: p.username, points: p.points, rank: p.rank, solvedN: solvedN(p) }));
  const mineDone = stacked ? ((await C.db.prepare('SELECT task_id FROM challenge_solves WHERE challenge_id = ? AND user_id = ? AND solved_at IS NOT NULL').bind(id, C.user.id).all()).results || []).map(x => x.task_id) : (me.solved_at ? [ch.task_id] : []);
  const n = Math.min(tasks.length, stacked ? mineDone.length : solvedN(me));
  return json({ challenge: publicChallenge(ch), me: { attempts: me.attempts, hints: me.hints, solved: n >= tasks.length, solvedN: n, solvedTasks: mineDone, points: me.points, rank: mine && mine.rank },
    players: pls.length, solved: pls.filter(p => Math.min(tasks.length, solvedN(p)) >= tasks.length).length, top });
}
async function report(C, id, kind){
  const { ch, me } = await playerRow(C, id);
  if(effState(ch, now()) !== 'running') fail(409, ch.state === 'lobby' ? 'Die Challenge hat noch nicht begonnen.' : 'Die Challenge ist beendet.');
  const tasks = taskList(ch), stacked = tasks.length > 1;
  const taskId = C.body.taskId ? cleanText(C.body.taskId, 40) : tasks[0];
  if(!tasks.includes(taskId)) fail(400, 'Diese Aufgabe gehört nicht zur Challenge.');
  const t = now();
  let ok = kind === 'attempt' && !!C.body.ok;
  let code = C.body.code;
  if(code != null){ code = JSON.stringify(code); if(code.length > 60000) code = null; }
  if(!stacked){
    if(me.solved_at) return json({ ok: true, solved: true, points: me.points });
    if(kind === 'hint'){
      await C.db.prepare('UPDATE challenge_players SET hints = hints + 1, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, id, C.user.id).run();
      return json({ ok: true });
    }
    if(ok){
      const pts = livePoints(ch, { solved_at: t, attempts: me.attempts + 1, hints: me.hints });
      await C.db.prepare('UPDATE challenge_players SET attempts = attempts + 1, solved_at = ?, solved_n = 1, points = ?, code = ?, last_at = ? WHERE challenge_id = ? AND user_id = ? AND solved_at IS NULL')
        .bind(t, pts, code, t, id, C.user.id).run();
      return json({ ok: true, solved: true, points: pts, solvedN: 1, total: 1, done: true });
    }
    await C.db.prepare('UPDATE challenge_players SET attempts = attempts + 1, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, id, C.user.id).run();
    return json({ ok: true, solved: false });
  }
  // gestapelter Speedrun: Zähler je Aufgabe, Summe im Spielerdatensatz
  let row = await C.db.prepare('SELECT * FROM challenge_solves WHERE challenge_id = ? AND user_id = ? AND task_id = ?').bind(id, C.user.id, taskId).first();
  if(!row){
    await C.db.prepare('INSERT OR IGNORE INTO challenge_solves (challenge_id, user_id, task_id) VALUES (?, ?, ?)').bind(id, C.user.id, taskId).run();
    row = { attempts: 0, hints: 0, solved_at: null, points: 0 };
  }
  const total = tasks.length;
  const nSolved = async () => (await C.db.prepare('SELECT COUNT(*) AS n FROM challenge_solves WHERE challenge_id = ? AND user_id = ? AND solved_at IS NOT NULL').bind(id, C.user.id).first()).n;
  if(row.solved_at) { const n = await nSolved(); return json({ ok: true, solved: true, points: row.points, solvedN: n, total, done: n >= total }); }
  if(kind === 'hint'){
    await C.db.batch([
      C.db.prepare('UPDATE challenge_solves SET hints = hints + 1 WHERE challenge_id = ? AND user_id = ? AND task_id = ?').bind(id, C.user.id, taskId),
      C.db.prepare('UPDATE challenge_players SET hints = hints + 1, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, id, C.user.id)
    ]);
    return json({ ok: true });
  }
  if(ok){
    const pts = livePoints(ch, { solved_at: t, attempts: row.attempts + 1, hints: row.hints });
    await C.db.batch([
      C.db.prepare('UPDATE challenge_solves SET attempts = attempts + 1, solved_at = ?, points = ?, code = ? WHERE challenge_id = ? AND user_id = ? AND task_id = ? AND solved_at IS NULL').bind(t, pts, code, id, C.user.id, taskId),
      C.db.prepare('UPDATE challenge_players SET attempts = attempts + 1, solved_n = solved_n + 1, solved_at = ?, points = points + ?, code = ?, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, pts, code, t, id, C.user.id)
    ]);
    const n = await nSolved();
    return json({ ok: true, solved: true, points: pts, solvedN: n, total, done: n >= total });
  }
  await C.db.batch([
    C.db.prepare('UPDATE challenge_solves SET attempts = attempts + 1 WHERE challenge_id = ? AND user_id = ? AND task_id = ?').bind(id, C.user.id, taskId),
    C.db.prepare('UPDATE challenge_players SET attempts = attempts + 1, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, id, C.user.id)
  ]);
  return json({ ok: true, solved: false });
}
