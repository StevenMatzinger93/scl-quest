// SPS Quest — Avatare und Coins (docs/AUFTRAG_FEEDBACK1.md Paket 3).
// Coins gibt es nur zu verdienen (gelöste Aufgaben nach Sternen, Kapitel-Boss, Theorie, Speedrun-Platzierung), nie zu kaufen; rein kosmetisch.
// Die Coins werden serverseitig aus dem synchronisierten Fortschritt berechnet und im Hauptbuch (coin_ledger) festgehalten – jeder Eintrag
// gilt nur einmal (UNIQUE), darum ist die Berechnung beliebig oft wiederholbar.
import { json, fail, now } from './lib.js';
import { Avatar } from './gen/avatar_bundle.js';
import { QUEST_TASKS } from './gen/exam_bundle.js';

const QUESTS = ['scl', 'kop', 'fup', 'awl', 'sensor'];
export const COIN = { star: [4, 3, 3], boss: 20, final: 50, theory: 8, speedrun: [30, 20, 10], speedrunPlay: 3 };   // Sterne 1/2/3 einzeln aufsummiert = 4/7/10

export async function avatarRoutes(C, p, m, H){
  if(p !== '/api/avatar' && !p.startsWith('/api/avatar/')) return null;
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  if(C.user.role === 'admin') fail(400, 'Das Admin-Konto hat keinen Avatar.');
  if(p === '/api/avatar' && m === 'GET') return overview(C);
  if(p === '/api/avatar' && m === 'PUT') return save(C);
  if(p === '/api/avatar/buy' && m === 'POST') return buy(C);
  fail(404, 'Unbekannte Adresse.');
}

// Avatare mehrerer Personen (für Beamer, Klassenliste): { userId: spec }
export async function avatarsFor(db, ids){
  const out = {}; ids = [...new Set((ids || []).map(Number).filter(Boolean))]; if(!ids.length) return out;
  const r = await db.prepare('SELECT user_id, spec FROM avatars WHERE user_id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
  (r.results || []).forEach(x => { try{ out[x.user_id] = Avatar.normalize(JSON.parse(x.spec)); }catch(e){} });
  return out;
}
export async function avatarOf(db, id){ return (await avatarsFor(db, [id]))[id] || null; }

async function badgesOf(C){
  const set = new Set();
  const r = await C.db.prepare('SELECT quest, state FROM progress WHERE user_id = ?').bind(C.user.id).all();
  (r.results || []).forEach(x => { try{ (JSON.parse(x.state).badges || []).forEach(b => set.add(b)); }catch(e){} });
  return set;
}
const key = (slot, id) => slot + ':' + id;

// Coins aus Fortschritt und Speedruns ins Hauptbuch übernehmen (idempotent)
export async function syncCoins(C){
  const uid = C.user.id, t = now(), rows = [];
  const pr = await C.db.prepare('SELECT quest, state FROM progress WHERE user_id = ?').bind(uid).all();
  for(const x of (pr.results || [])){
    let st; try{ st = JSON.parse(x.state); }catch(e){ continue; }
    const meta = QUEST_TASKS[x.quest] || [];
    const lastOfCh = {}; meta.forEach(mt => { lastOfCh[mt.ch] = mt.id; });
    const byId = {}; meta.forEach(mt => { byId[mt.id] = mt; });
    Object.entries(st.doneTasks || {}).forEach(([id, d]) => {
      const mt = byId[id]; if(!mt) return;
      const stars = Math.max(1, Math.min(3, +d.stars || 1));
      for(let s = 1; s <= stars; s++) rows.push(['task', x.quest + ':' + id + ':' + s, COIN.star[s - 1]]);
      if(mt.final) rows.push(['final', x.quest + ':' + id, COIN.final]);
      else if(lastOfCh[mt.ch] === id) rows.push(['boss', x.quest + ':' + id, COIN.boss]);
    });
    Object.keys(st.doneTheory || {}).forEach(id => rows.push(['theory', x.quest + ':' + id, COIN.theory]));
  }
  // Speedrun: beendete Challenges, an denen die Person mit mindestens einer Lösung teilgenommen hat
  const cr = await C.db.prepare(`SELECT c.id, c.tasks, c.task_id, c.started_at, c.ends_at, c.ended_at, c.state FROM challenge_players p JOIN challenges c ON c.id = p.challenge_id
    WHERE p.user_id = ? AND c.mode = 'sprint' AND (c.state = 'ended' OR (c.ends_at IS NOT NULL AND c.ends_at <= ?)) LIMIT 60`).bind(uid, t).all();
  for(const c of (cr.results || [])){
    const pl = (await C.db.prepare('SELECT user_id, solved_n, solved_at, points FROM challenge_players WHERE challenge_id = ?').bind(c.id).all()).results || [];
    const n = x => x.solved_n || (x.solved_at ? 1 : 0);
    const solved = pl.filter(x => n(x) > 0).sort((a, b) => (n(b) - n(a)) || (a.solved_at - b.solved_at));
    const i = solved.findIndex(x => x.user_id === uid);
    if(i < 0) continue;
    rows.push(['speedrun', String(c.id), i < 3 ? COIN.speedrun[i] : COIN.speedrunPlay]);
  }
  if(rows.length){
    const st = C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, kind, ref, amount, created_at) VALUES (?, ?, ?, ?, ?)');
    for(let i = 0; i < rows.length; i += 90) await C.db.batch(rows.slice(i, i + 90).map(r => st.bind(uid, r[0], r[1], r[2], t)));
  }
}
async function balance(C){ const r = await C.db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM coin_ledger WHERE user_id = ?').bind(C.user.id).first(); return r.n; }
async function ownedSet(C){
  const owned = new Set(); const badges = await badgesOf(C);
  Object.keys(Avatar.ITEMS).forEach(slot => Avatar.ITEMS[slot].forEach(it => { if(!it.badge && !it.cost) owned.add(key(slot, it.id)); else if(it.badge && badges.has(it.badge)) owned.add(key(slot, it.id)); }));
  ((await C.db.prepare("SELECT ref FROM coin_ledger WHERE user_id = ? AND kind = 'buy'").bind(C.user.id).all()).results || []).forEach(x => owned.add(x.ref));
  return owned;
}
async function overview(C){
  await syncCoins(C);
  const row = await C.db.prepare('SELECT spec FROM avatars WHERE user_id = ?').bind(C.user.id).first();
  let spec = Avatar.defaultSpec(); try{ if(row) spec = Avatar.normalize(JSON.parse(row.spec)); }catch(e){}
  const earned = await C.db.prepare("SELECT kind, COALESCE(SUM(amount), 0) AS n, COUNT(*) AS c FROM coin_ledger WHERE user_id = ? AND kind <> 'buy' GROUP BY kind").bind(C.user.id).all();
  return json({ spec, owned: [...await ownedSet(C)], coins: await balance(C), earned: earned.results || [], rules: COIN });
}
async function save(C){
  const spec = Avatar.normalize(C.body.spec);
  const owned = await ownedSet(C);
  for(const n of Avatar.needed(spec)) if(!owned.has(key(n.slot, n.id))) fail(403, 'Dieses Stück gehört dir noch nicht: ' + n.it.name + '.');
  await C.db.prepare('INSERT INTO avatars (user_id, spec, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET spec = excluded.spec, updated_at = excluded.updated_at').bind(C.user.id, JSON.stringify(spec), now()).run();
  return json({ ok: true, spec });
}
async function buy(C){
  const slot = String(C.body.slot || ''), id = String(C.body.id || ''), it = Avatar.item(slot, id);
  if(!it) fail(404, 'Unbekanntes Stück.');
  if(it.badge) fail(400, 'Dieses Stück schaltest du mit einem Abzeichen frei.');
  if(!it.cost) fail(400, 'Dieses Stück ist schon frei.');
  await syncCoins(C);
  const owned = await ownedSet(C);
  if(owned.has(key(slot, id))) fail(409, 'Das hast du schon.');
  const coins = await balance(C);
  if(coins < it.cost) fail(402, 'Dafür fehlen dir ' + (it.cost - coins) + ' Coins. Coins verdienst du durch Aufgaben, Theorie und Speedruns.');
  await C.db.prepare("INSERT OR IGNORE INTO coin_ledger (user_id, kind, ref, amount, created_at) VALUES (?, 'buy', ?, ?, ?)").bind(C.user.id, key(slot, id), -it.cost, now()).run();
  return json({ ok: true, coins: await balance(C) });
}
