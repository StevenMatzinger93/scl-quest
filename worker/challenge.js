// SPS Quest — Live-Challenge im Klassenzimmer.
// Dozent startet eine Challenge (Speedrun – interne ID 'sprint' – oder Störungsjagd) und erhält einen 4-stelligen Code,
// Lernende treten mit ihrem Konto bei. Beamer und Spiel fragen den Stand alle 2–3 s ab (Polling, D1).
import { json, fail, now, randomDigits, cleanText } from './lib.js';
import { avatarsFor, awardSpeedrun } from './avatar.js';

const MODES = ['sprint', 'bug'];
// Der Modus 'pikett' (Pikett-Challenge) wurde am 29.09.2026 entfernt. Alte Challenges in D1 bleiben lesbar (Anzeige „Modus entfernt“), neue gibt es nicht, Ergebnisse werden nicht mehr angenommen.
const REMOVED_MODES = ['pikett'];
const QUESTS = ['scl', 'kop', 'fup', 'awl', 'sensor'];
const MAX_PLAYERS = 120;

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
    const r = await C.db.prepare("UPDATE challenges SET state = 'ended', ended_at = ends_at WHERE id = ? AND state = 'running'").bind(ch.id).run();
    ch.state = 'ended'; ch.ended_at = ch.ends_at;
    if(r.meta && r.meta.changes) await finished(C, ch);
  }
  return ch;
}
// Challenge-Ende: Speedrun-Prämien (Coins, Paket 3) – einmal pro Challenge (coin_ledger ist eindeutig je Konto/Challenge)
async function finished(C, ch){
  try{ await awardSpeedrun(C, ch, rank(await players(C, ch.id), !!taskList(ch))); }catch(e){ console.warn('Speedrun-Prämie', e && e.message); }
}
export function livePoints(ch, pl){
  if(!pl.solved_at || !ch.started_at) return 0;
  const dur = Math.max(60, ch.duration);
  const t = Math.max(0, (pl.solved_at - ch.started_at) / 1000);
  const fails = Math.max(0, pl.attempts - 1);
  const base = 500 + Math.round(500 * Math.max(0, 1 - t / dur));
  return Math.max(100, base - Math.min(250, 50 * fails) - 100 * pl.hints);
}
// Speedrun mit mehreren Aufgaben (Paket 2.3): Fortschritt je Aufgabe in challenge_players.progress = {taskId: {a, h, s, p}}
const taskList = ch => { try{ const t = JSON.parse(ch.tasks || 'null'); return Array.isArray(t) && t.length > 1 ? t : null; }catch(e){ return null; } };
const progOf = pl => { try{ return JSON.parse(pl.progress || '{}') || {}; }catch(e){ return {}; } };
const lastSolve = pl => Math.max(0, ...Object.values(progOf(pl)).map(x => x.s || 0));
function rank(players, multi){
  if(multi){
    const sorted = players.slice().sort((a, b) => (b.solved_n - a.solved_n) || (b.solved_n ? lastSolve(a) - lastSolve(b) : 0) || a.username.localeCompare(b.username));
    let r = 0, last = null;
    sorted.forEach((p, i) => { if(p.solved_n){ if(!last || last.solved_n !== p.solved_n || lastSolve(last) !== lastSolve(p)) r = i + 1; p.rank = r; last = p; } else p.rank = null; });
    return sorted;
  }
  const sorted = players.slice().sort((a, b) => {
    if(!!b.solved_at !== !!a.solved_at) return b.solved_at ? 1 : -1;
    if(a.solved_at) return (b.points - a.points) || (a.solved_at - b.solved_at);
    return a.username.localeCompare(b.username);
  });
  let r = 0, last = null;
  sorted.forEach((p, i) => { if(p.solved_at){ if(!last || last.points !== p.points || last.solved_at !== p.solved_at) r = i + 1; p.rank = r; last = p; } else p.rank = null; });
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
  return { id: ch.id, code: ch.code, quest: ch.quest, mode: ch.mode, taskId: ch.task_id, tasks: taskList(ch) || [ch.task_id], bugId: REMOVED_MODES.includes(ch.mode) ? null : ch.bug_id, title: ch.title, classId: ch.class_id,
    duration: ch.duration, state: st, createdAt: ch.created_at, startedAt: ch.started_at, endsAt: ch.ends_at,
    timeLeft: st === 'running' ? Math.max(0, Math.round((ch.ends_at - t) / 1000)) : st === 'lobby' ? ch.duration : 0, serverTime: t };
}

// ---------- Dozent ----------
async function listChallenges(C, H){
  H.requireRole(C, 'teacher', 'admin');
  const r = await C.db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM challenge_players p WHERE p.challenge_id = c.id) AS n,
      (SELECT COUNT(*) FROM challenge_players p WHERE p.challenge_id = c.id AND p.solved_at IS NOT NULL) AS solved
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
  const mode = MODES.includes(b.mode) ? b.mode : fail(400, b.mode === 'pikett' ? 'Die Pikett-Challenge wurde entfernt.' : 'Modus fehlt (sprint oder bug).');
  const quest = QUESTS.includes(b.quest || 'scl') ? (b.quest || 'scl') : fail(400, 'Unbekannte Quest.');
  // tasks (Speedrun, 2–10 Aufgaben) oder taskId (eine Aufgabe, rückwärtskompatibel)
  let tasks = mode === 'sprint' && Array.isArray(b.tasks) ? [...new Set(b.tasks.map(x => cleanText(x, 40)).filter(x => /^[A-Za-z0-9_]+$/.test(x)))] : null;
  if(tasks && tasks.length > 10) fail(400, 'Höchstens 10 Aufgaben pro Speedrun.');
  if(tasks && tasks.length < 2) tasks = tasks.length ? (b.taskId = tasks[0], null) : null;
  const taskId = tasks ? tasks[0] : cleanText(b.taskId, 40); if(!/^[A-Za-z0-9_]+$/.test(taskId || '')) fail(400, 'Aufgabe fehlt.');
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
    .bind(code, C.user.id, classId, quest, mode, taskId, tasks ? JSON.stringify(tasks) : null, bugId, cleanText(b.title, 80), duration, 'lobby', now()).run();
  return json({ id: r.meta.last_row_id, code }, 201);
}
async function beamerState(C, H, id){
  const ch = await ownChallenge(C, H, id);
  const multi = !!taskList(ch);
  const pls = rank((await players(C, id)).map(p => Object.assign(p, { points: p.points || (multi ? 0 : livePoints(ch, p)) })), multi);
  const avs = await avatarsFor(C, pls.map(p => p.user_id));
  let shown = null;
  if(ch.show_uid){ const s = pls.find(p => p.user_id === ch.show_uid); if(s && s.code) shown = { code: JSON.parse(s.code), rank: s.rank, points: s.points }; }
  return json({ challenge: publicChallenge(ch), shown,
    players: pls.map(p => ({ userId: p.user_id, username: p.username, avatar: avs[p.user_id] || null, attempts: p.attempts, hints: p.hints, solved: !!p.solved_at,
      solvedAfter: p.solved_at && ch.started_at ? Math.round((p.solved_at - ch.started_at) / 1000) : null, points: p.points, rank: p.rank, lastAt: p.last_at, hasCode: !!p.code,
      solvedN: multi ? p.solved_n : (p.solved_at ? 1 : 0), progress: multi ? Object.fromEntries(Object.entries(progOf(p)).map(([k, v]) => [k, { solved: !!v.s, attempts: v.a || 0, after: v.s && ch.started_at ? Math.round((v.s - ch.started_at) / 1000) : null }])) : null })) });
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
    if(ch.state === 'running') await finished(C, ch);
  } else if(action === 'show'){
    const uid = C.body.userId ? +C.body.userId : null;
    await C.db.prepare('UPDATE challenges SET show_uid = ? WHERE id = ?').bind(uid, id).run();
  } else if(action === 'kick'){
    await C.db.prepare('DELETE FROM challenge_players WHERE challenge_id = ? AND user_id = ?').bind(id, +C.body.userId || 0).run();
  }
  return json({ ok: true });
}
async function deleteChallenge(C, H, id){
  await ownChallenge(C, H, id);
  await C.db.batch([
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
  const multi = !!taskList(ch);
  const pls = rank(await players(C, id), multi);
  const mine = pls.find(p => p.user_id === C.user.id);
  const top = pls.filter(p => multi ? p.solved_n : p.solved_at).slice(0, 10).map(p => ({ username: p.username, points: p.points, rank: p.rank, solvedN: multi ? p.solved_n : 1 }));
  const prog = progOf(me);
  return json({ challenge: publicChallenge(ch), me: { attempts: me.attempts, hints: me.hints, solved: !!me.solved_at, points: me.points, rank: mine && mine.rank,
      solvedN: multi ? me.solved_n : (me.solved_at ? 1 : 0), done: multi ? Object.keys(prog).filter(k => prog[k].s) : (me.solved_at ? [ch.task_id] : []) },
    players: pls.length, solved: pls.filter(p => p.solved_at).length, top });
}
async function report(C, id, kind){
  const { ch, me } = await playerRow(C, id);
  if(REMOVED_MODES.includes(ch.mode)) fail(410, 'Dieser Challenge-Modus wurde entfernt.');
  if(effState(ch, now()) !== 'running') fail(409, ch.state === 'lobby' ? 'Die Challenge hat noch nicht begonnen.' : 'Die Challenge ist beendet.');
  if(me.solved_at) return json({ ok: true, solved: true, points: me.points, finished: true });
  const t = now();
  const list = taskList(ch);
  if(list){
    // Speedrun mit mehreren Aufgaben: Versuche/Hinweise/Lösung je Aufgabe; fertig, wenn alle gelöst
    const tid = String(C.body.taskId || '');
    if(!list.includes(tid)) fail(400, 'Diese Aufgabe gehört nicht zum Speedrun.');
    const prog = progOf(me), e = prog[tid] = prog[tid] || { a: 0, h: 0 };
    if(e.s) return json({ ok: true, solved: true, points: e.p, solvedN: me.solved_n });
    if(kind === 'hint') e.h++;
    else { e.a++; if(C.body.ok){ e.s = t; e.p = livePoints(ch, { solved_at: t, attempts: e.a, hints: e.h }); } }
    const n = list.filter(k => prog[k] && prog[k].s).length, pts = Object.values(prog).reduce((a, x) => a + (x.p || 0), 0);
    let code = C.body.code; if(code != null){ code = JSON.stringify(code); if(code.length > 60000) code = null; }
    await C.db.prepare('UPDATE challenge_players SET progress = ?, solved_n = ?, points = ?, attempts = attempts + ?, hints = hints + ?, solved_at = ?, code = COALESCE(?, code), last_at = ? WHERE challenge_id = ? AND user_id = ?')
      .bind(JSON.stringify(prog), n, pts, kind === 'hint' ? 0 : 1, kind === 'hint' ? 1 : 0, n === list.length ? t : null, e.s === t ? code : null, t, id, C.user.id).run();
    return json({ ok: true, solved: !!e.s, points: e.p || 0, solvedN: n, finished: n === list.length });
  }
  if(kind === 'hint'){
    await C.db.prepare('UPDATE challenge_players SET hints = hints + 1, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, id, C.user.id).run();
    return json({ ok: true });
  }
  const ok = !!C.body.ok;
  let code = C.body.code;
  if(code != null){ code = JSON.stringify(code); if(code.length > 60000) code = null; }
  if(ok){
    const pl = { solved_at: t, attempts: me.attempts + 1, hints: me.hints };
    const pts = livePoints(ch, pl);
    await C.db.prepare('UPDATE challenge_players SET attempts = attempts + 1, solved_at = ?, points = ?, code = ?, last_at = ? WHERE challenge_id = ? AND user_id = ? AND solved_at IS NULL')
      .bind(t, pts, code, t, id, C.user.id).run();
    return json({ ok: true, solved: true, points: pts });
  }
  await C.db.prepare('UPDATE challenge_players SET attempts = attempts + 1, last_at = ? WHERE challenge_id = ? AND user_id = ?').bind(t, id, C.user.id).run();
  return json({ ok: true, solved: false });
}
