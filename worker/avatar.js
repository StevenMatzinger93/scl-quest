// SPS Quest — Avatare und Coins (Feedback-Auftrag Paket 3).
// Coins sind nur verdienbar und rein kosmetisch: Stand = aus dem synchronisierten Fortschritt berechnet (Aufgaben nach Sternen,
// Kapitel-Boss, Final Boss, Theorie) + Speedrun-Prämien im coin_ledger − Käufe im coin_ledger. Kein Geld, kein Spielvorteil.
import { json, fail, now, cleanText } from './lib.js';
import { Avatar, AVATAR_META } from './gen/avatar_bundle.js';

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
export async function coinState(C, uid){
  const [prog, ledger, certs] = await Promise.all([progressOf(C, uid), ledgerOf(C, uid), certsOf(C, uid)]);
  return Avatar.balance(prog, AVATAR_META, ledger, certs);
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
  return json({ avatar: av, chosen: !!av, coins: { balance: coins.balance, earned: coins.earned, speedrun: coins.speedrun, spent: coins.spent }, owned: coins.owned, unlock: coins.ctx, rules: Avatar.RULES });
}
const owns = (id, coins) => Avatar.ITEMS[id] && (Avatar.ITEMS[id].price === 0 || coins.owned.includes(id));
async function saveOwn(C){
  const b = C.body || {};
  const coins = await coinState(C, C.user.id);
  const av = Avatar.normalize({ animal: b.animal, color: b.color, equip: b.equip });
  Object.keys(av.equip).forEach(s => { const id = av.equip[s]; if(!owns(id, coins)) fail(403, '„' + Avatar.ITEMS[id].name + '“ gehört dir noch nicht.'); });
  await C.db.prepare('INSERT INTO avatars (user_id, animal, color, equip, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET animal = excluded.animal, color = excluded.color, equip = excluded.equip, updated_at = excluded.updated_at')
    .bind(C.user.id, av.animal, av.color, JSON.stringify(av.equip), now()).run();
  return json({ avatar: av });
}
async function buy(C){
  const id = cleanText(C.body.item, 40), it = Avatar.ITEMS[id];
  if(!it) fail(404, 'Diesen Gegenstand gibt es nicht.');
  const coins = await coinState(C, C.user.id);
  if(owns(id, coins)) return json({ ok: true, owned: true, balance: coins.balance });
  if(!Avatar.isUnlocked(id, coins.ctx)) fail(403, 'Noch gesperrt: ' + Avatar.unlockText(id) + '.');
  if(coins.balance < it.price) fail(400, 'Dafür reichen deine Coins noch nicht (' + coins.balance + ' von ' + it.price + ').');
  await C.db.prepare('INSERT OR IGNORE INTO coin_ledger (user_id, amount, source, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(C.user.id, -it.price, 'kauf', id, now()).run();
  return json({ ok: true, owned: true, balance: coins.balance - it.price });
}
// Speedrun-Prämie beim Ende einer Challenge (Modus 'sprint', mindestens 2 Teilnehmende): Rang 1–3 und „gelöst“; einmal pro Challenge
export async function awardSpeedrun(C, ch, ranked){
  const R = Avatar.RULES.speedrun, t = now(), stmts = [];
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
