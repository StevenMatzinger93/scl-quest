// SPS Quest — Avatare und Coins (Feedback-Auftrag Paket 3).
// Coins sind nur verdienbar und rein kosmetisch: Stand = aus dem synchronisierten Fortschritt berechnet (Aufgaben nach Sternen,
// Kapitel-Boss, Final Boss, Theorie) + Speedrun-Prämien im coin_ledger − Käufe im coin_ledger. Kein Geld, kein Spielvorteil.
import { json, fail, now, cleanText } from './lib.js';
import { Avatar, AVATAR_META } from './gen/avatar_bundle.js';
import { Exam, FINAL_TASKS } from './gen/exam_bundle.js';
import { rank } from './challenge.js';

export async function avatarRoutes(C, p, m, H){
  if(!p.startsWith('/api/avatar')) return null;
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  if(p === '/api/avatar' && m === 'GET') return getOwn(C);
  if(p === '/api/avatar' && m === 'PUT') return saveOwn(C);
  if(p === '/api/avatar/buy' && m === 'POST') return buy(C);
  fail(404, 'Unbekannte Adresse.');
}

async function ledgerOf(C, uid){
  return ((await C.db.prepare('SELECT amount, source, ref, created_at FROM coin_ledger WHERE user_id = ? ORDER BY id').bind(uid).all()).results || []);
}
async function progressOf(C, uid){
  const rows = (await C.db.prepare('SELECT quest, state FROM progress WHERE user_id = ?').bind(uid).all()).results || [];
  const out = {};
  rows.forEach(r => { try{ const s = JSON.parse(r.state || '{}'); out[r.quest] = { doneTasks: s.doneTasks || {}, doneTheory: s.doneTheory || {} }; }catch(e){} });
  return out;
}
async function certsOf(C, uid){
  return ((await C.db.prepare('SELECT quest, level FROM certificates WHERE user_id = ? AND revoked_at IS NULL').bind(uid).all()).results || []);
}
// Challenge-Statistik (Garderobe 2.0, 12.4) – nur serverseitig: eine Challenge zählt, wenn sie beendet ist, ≥ 3 Teilnehmende hatte
// und ≥ 2 min lief (gestartet wird sie immer von einer Lehrperson); jede Leistung höchstens einmal je Challenge
export const CH_RULES = { minPlayers: 3, minMs: 120000 };
export async function challengeStats(C, uid){
  const out = { challenges: 0, podium: 0, wins: 0, sdWins: 0, bugFixed: 0, flawless: 0 };
  const chs = ((await C.db.prepare("SELECT c.* FROM challenges c JOIN challenge_players me ON me.challenge_id = c.id AND me.user_id = ? WHERE c.state = 'ended' AND c.started_at IS NOT NULL AND COALESCE(c.ended_at, c.ends_at) - c.started_at >= ?")
    .bind(uid, CH_RULES.minMs).all()).results || []);
  for(let i = 0; i < chs.length; i += 90){
    const part = chs.slice(i, i + 90), ids = part.map(c => c.id);
    const rows = ((await C.db.prepare('SELECT * FROM challenge_players WHERE challenge_id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all()).results || []);
    part.forEach(ch => {
      const pl = rows.filter(r => r.challenge_id === ch.id); if(pl.length < CH_RULES.minPlayers) return;
      let tl = null; try{ tl = JSON.parse(ch.tasks || 'null'); }catch(e){}
      const multi = Array.isArray(tl) && tl.length > 1, ranked = rank(pl, multi, ch.end_rule === 'first' ? ch.winner_id : null), me = ranked.find(p => p.user_id === uid);
      if(!me) return;
      const solved = !!(me.solved_at || me.solved_n);
      out.challenges++;
      if(me.rank && me.rank <= 3) out.podium++;
      if(me.rank === 1) out.wins++;
      if(ch.end_rule === 'first' && ch.winner_id === uid) out.sdWins++;
      if(ch.mode === 'bug' && solved) out.bugFixed++;
      if(solved && !me.hints && (me.attempts || 0) <= (multi ? (me.solved_n || 1) : 1)) out.flawless++;
    });
  }
  return out;
}
export async function coinState(C, uid){
  const [prog, ledger, certs, stats] = await Promise.all([progressOf(C, uid), ledgerOf(C, uid), certsOf(C, uid), challengeStats(C, uid)]);
  return Avatar.balance(prog, AVATAR_META, ledger, certs, stats);
}
// Final Boss serverseitig nachprüfen: synchronisierte Lösung gegen die Tests (legendäre Teile, Auftrag 12.6)
async function verifiedFinals(C, uid, quests){
  const ok = {};
  for(const q of quests){
    const t = FINAL_TASKS[q]; if(!t){ ok[q] = false; continue; }
    const r = await C.db.prepare('SELECT state FROM progress WHERE user_id = ? AND quest = ?').bind(uid, q).first();
    let code = null; try{ const st = JSON.parse((r && r.state) || '{}'); code = (st.solutions || {})[t.id]; }catch(e){}
    ok[q] = typeof code === 'string' && Exam.checkGameTask(t, code, q);
  }
  return ok;
}
// Paket P: bestandenes Zertifikat → Coins (+300, mit Auszeichnung +500), einmal je Quest und Stufe; bleibt beim Zurückziehen
export async function awardCert(C, uid, quest, level, distinction){
  const R = Avatar.RULES.cert;
  await C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(uid, distinction ? R.distinction : R.pass, 'zertifikat', quest + ':' + level, now()).run();
}
export async function avatarOf(C, uid){
  const r = await C.db.prepare('SELECT animal, color, equip FROM avatars WHERE user_id = ?').bind(uid).first();
  return r ? Avatar.normalize({ animal: r.animal, color: r.color, equip: JSON.parse(r.equip || '{}') }) : null;
}
// Avatare vieler Konten (Klassenliste, Challenge) – null = noch kein Avatar gewählt (Platzhalter)
export async function avatarsFor(C, ids){
  const out = {}; ids = [...new Set(ids.filter(Boolean))];
  for(let i = 0; i < ids.length; i += 90){
    const part = ids.slice(i, i + 90);
    const rows = (await C.db.prepare('SELECT user_id, animal, color, equip FROM avatars WHERE user_id IN (' + part.map(() => '?').join(',') + ')').bind(...part).all()).results || [];
    rows.forEach(r => { out[r.user_id] = Avatar.normalize({ animal: r.animal, color: r.color, equip: JSON.parse(r.equip || '{}') }); });
  }
  return out;
}
async function getOwn(C){
  const [av, coins] = await Promise.all([avatarOf(C, C.user.id), coinState(C, C.user.id)]);
  return json({ avatar: av, chosen: !!av, coins: { balance: coins.balance, earned: coins.earned, speedrun: coins.speedrun, spent: coins.spent }, owned: coins.owned, unlock: coins.ctx, rules: Avatar.RULES,
    shopSet: Avatar.shopSetOf(now()), chRules: CH_RULES });
}
const owns = (id, coins) => Avatar.owns(id, coins.owned, coins.ctx);
async function saveOwn(C){
  const b = C.body || {};
  const coins = await coinState(C, C.user.id);
  const av = Avatar.normalize({ animal: b.animal, color: b.color, equip: b.equip });
  Object.keys(av.equip).forEach(s => { const id = av.equip[s]; if(!owns(id, coins)) fail(403, '„' + Avatar.item(id).name + '“ gehört dir noch nicht.'); });
  await C.db.prepare('INSERT INTO avatars (user_id, animal, color, equip, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET animal = excluded.animal, color = excluded.color, equip = excluded.equip, updated_at = excluded.updated_at')
    .bind(C.user.id, av.animal, av.color, JSON.stringify(av.equip), now()).run();
  return json({ avatar: av });
}
async function buy(C){
  const id = cleanText(C.body.item, 40), it = Avatar.item(id);
  if(!it) fail(404, 'Diesen Gegenstand gibt es nicht.');
  const coins = await coinState(C, C.user.id);
  if(owns(id, coins)) return json({ ok: true, owned: true, balance: coins.balance });
  if(it.earnOnly) fail(403, '„' + it.name + '“ kann man nicht kaufen, nur verdienen: ' + Avatar.unlockText(id, coins.ctx) + '.');
  if(!Avatar.onSale(id, now())) fail(403, '„' + it.name + '“ gibt es nur im Monats-Schaufenster – es kommt später wieder.');
  if(!Avatar.isUnlocked(id, coins.ctx)) fail(403, 'Noch gesperrt – ' + it.name + ': ' + Avatar.unlockText(id, coins.ctx) + '.');
  // Final Boss: der lokale Spielstand allein reicht nicht – die synchronisierte Lösung muss die Tests bestehen
  const u = it.unlock || {};
  if(u.questFinal || u.finals3){
    const quests = u.questFinal ? [u.questFinal] : Object.keys(coins.ctx.questFinal || {});
    const v = await verifiedFinals(C, C.user.id, quests), good = quests.filter(q => v[q]).length;
    if(u.questFinal && !v[u.questFinal]) fail(403, 'Deine Lösung des Final Boss (' + u.questFinal.toUpperCase() + ') besteht die Tests nicht oder ist noch nicht mit deinem Konto gespeichert.');
    if(u.finals3 && good < u.finals3) fail(403, 'Nur ' + good + ' von ' + u.finals3 + ' Final-Boss-Lösungen bestehen die Tests auf dem Server.');
  }
  if(coins.balance < it.price) fail(400, 'Dafür reichen deine Coins noch nicht (' + coins.balance + ' von ' + it.price + ').');
  await C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(C.user.id, -it.price, 'kauf', id, now()).run();
  return json({ ok: true, owned: true, balance: coins.balance - it.price });
}
// Speedrun-Prämie beim Ende einer Challenge (Modus 'sprint', mindestens 2 Teilnehmende): Rang 1–3 und „gelöst“; einmal pro Challenge
export async function awardSpeedrun(C, ch, ranked){
  const R = Avatar.RULES.speedrun, t = now(), stmts = [];
  // Teilnahme +5 (12.5): nur wenn die Challenge zählt (≥ 3 Teilnehmende, ≥ 2 min)
  if(ranked.length >= CH_RULES.minPlayers && ch.started_at && (ch.ended_at || t) - ch.started_at >= CH_RULES.minMs)
    await C.db.batch(ranked.map(p => C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(p.user_id, R.teilnahme || 5, 'teilnahme', 't:' + ch.id, t)));
  // Sudden Death (L1): nur der Sieger bekommt die Platz-1-Prämie und den Sudden-Death-Zuschlag, auch in der Störungsjagd
  if(ch.end_rule === 'first'){
    if(!ch.winner_id || ranked.length < 2) return;
    await C.db.batch([
      C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(ch.winner_id, R[1], 'speedrun', 'r1:' + ch.id, t),
      C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(ch.winner_id, R.sudden || 80, 'sudden', 'sd:' + ch.id, t)
    ]);
    return;
  }
  if(ch.mode !== 'sprint' || ranked.length < 2) return;
  ranked.forEach(p => {
    const solved = p.solved_at || p.solved_n;
    if(!solved) return;
    const rank = p.rank && p.rank <= 3 ? p.rank : 0;
    stmts.push(C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(p.user_id, rank ? R[rank] : R.solved, 'speedrun', (rank ? 'r' + rank : 's') + ':' + ch.id, t));
  });
  if(stmts.length) await C.db.batch(stmts);
}
