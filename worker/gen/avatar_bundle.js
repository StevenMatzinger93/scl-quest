// ERZEUGT von dev/build.js – nicht von Hand ändern. Avatar-Katalog und Coin-Regeln (dev/src/avatar_core.js) für den Worker.
/* ===== SPS Quest: Avatare und Coins (Feedback-Auftrag Paket 3) =====
   Gemeinsamer Kern für Portal (Anzeige, Garderobe) und Worker (Prüfung, Coin-Stand; über worker/gen/avatar_bundle.js).
   - Avatare sind Tiere (eigene Zeichnungen als SVG-Ebenen): Hintergrundfarbe, Oberteil, Kette, Kopf, Augen, Brille, Kopfbedeckung.
   - Coins sind nur verdienbar (gelöste Aufgaben nach Sternen, Kapitel-Boss, Final Boss, Theorie, Speedrun-Platzierung),
     nie mit Geld kaufbar und rein kosmetisch. Ausgegeben werden sie in der Garderobe.
   API: SPSQAvatar = { ANIMALS, COLORS, ITEMS, SLOTS, DEFAULT, normalize(av), svg(av, opt), earned(progress, meta, ledger), unlockCtx(...), isUnlocked(item, ctx), balance(...) } */
(function(root){
'use strict';
const ANIMALS = {
  fuchs:     { name: 'Fuchs',     fur: '#e8772e', light: '#fff3e6' },
  baer:      { name: 'Bär',       fur: '#8b5a2b', light: '#d9b38c' },
  eule:      { name: 'Eule',      fur: '#8a7a66', light: '#d8cbb0' },
  wolf:      { name: 'Wolf',      fur: '#7d8791', light: '#dfe4e8' },
  pinguin:   { name: 'Pinguin',   fur: '#1f2429', light: '#f4f4f4' },
  biber:     { name: 'Biber',     fur: '#7a4a2a', light: '#c49a74' },
  steinbock: { name: 'Steinbock', fur: '#b89468', light: '#eadbc4' },
  katze:     { name: 'Katze',     fur: '#9aa3ab', light: '#eef1f3' }
};
const COLORS = ['#2f6f4f', '#1f5f8b', '#6b3fa0', '#8b2f3f', '#a0661f', '#2f7f7f', '#3b3f46', '#b8860b'];
const SLOTS = { oberteil: 'Oberteil', kette: 'Kette', brille: 'Brille', kopf: 'Kopfbedeckung' };
// Katalog: preis 0 = von Anfang an frei; unlock = Abzeichen-Bedingung (zusätzlich zum Preis)
const ITEMS = {
  tshirt_grau:    { slot: 'oberteil', name: 'T-Shirt grau',      price: 0,   kind: 'tshirt', color: '#6b7280' },
  tshirt_rot:     { slot: 'oberteil', name: 'T-Shirt rot',       price: 40,  kind: 'tshirt', color: '#c0392b' },
  tshirt_blau:    { slot: 'oberteil', name: 'T-Shirt blau',      price: 40,  kind: 'tshirt', color: '#2e6fd8' },
  tshirt_gruen:   { slot: 'oberteil', name: 'T-Shirt grün',      price: 40,  kind: 'tshirt', color: '#2f9e44' },
  tshirt_zahnrad: { slot: 'oberteil', name: 'T-Shirt Zahnrad',   price: 90,  kind: 'tshirt', color: '#1f2937', motif: 'zahnrad' },
  tshirt_blitz:   { slot: 'oberteil', name: 'T-Shirt Blitz',     price: 120, kind: 'tshirt', color: '#111827', motif: 'blitz', unlock: { podium: 1 } },
  hemd_weiss:     { slot: 'oberteil', name: 'Hemd weiss',        price: 80,  kind: 'hemd', color: '#f3f4f6' },
  hemd_blau:      { slot: 'oberteil', name: 'Hemd hellblau',     price: 80,  kind: 'hemd', color: '#a8c8f0' },
  hemd_kariert:   { slot: 'oberteil', name: 'Hemd kariert',      price: 110, kind: 'hemd', color: '#b83b3b', motif: 'kariert' },
  kette_silber:   { slot: 'kette',    name: 'Kette silber',      price: 60,  kind: 'kette', color: '#c9ced6' },
  kette_zahnrad:  { slot: 'kette',    name: 'Zahnrad-Anhänger',  price: 100, kind: 'kette', color: '#c9ced6', motif: 'zahnrad', unlock: { quests: 2 } },
  kette_gold:     { slot: 'kette',    name: 'Goldene Kette',     price: 150, kind: 'kette', color: '#f5c518', unlock: { final: 1 } },
  brille_rund:    { slot: 'brille',   name: 'Runde Brille',      price: 50,  kind: 'rund', color: '#1f2937' },
  brille_eckig:   { slot: 'brille',   name: 'Eckige Brille',     price: 50,  kind: 'eckig', color: '#1f2937' },
  schutzbrille:   { slot: 'brille',   name: 'Schutzbrille',      price: 70,  kind: 'schutz', color: '#9fd8ff' },
  sonnenbrille:   { slot: 'brille',   name: 'Sonnenbrille',      price: 90,  kind: 'sonne', color: '#0b0f14', unlock: { podium: 1 } },
  kappe_rot:      { slot: 'kopf',     name: 'Kappe rot',         price: 50,  kind: 'kappe', color: '#c0392b' },
  kappe_blau:     { slot: 'kopf',     name: 'Kappe blau',        price: 50,  kind: 'kappe', color: '#2e6fd8' },
  kappe_schwarz:  { slot: 'kopf',     name: 'Kappe schwarz',     price: 60,  kind: 'kappe', color: '#1f2937' },
  muetze:         { slot: 'kopf',     name: 'Wollmütze',         price: 70,  kind: 'muetze', color: '#2f9e44' },
  bauhelm:        { slot: 'kopf',     name: 'Bauhelm',           price: 120, kind: 'helm', color: '#f5c518', unlock: { bosses: 3 } }
};
const UNLOCK_TEXT = { final: 'Final Boss einer Quest lösen', bosses: n => n + ' Kapitel-Bosse lösen', podium: 'Einmal aufs Podest in einem Speedrun', quests: n => 'In ' + n + ' Quests eine Aufgabe lösen' };
const DEFAULT = { animal: 'fuchs', color: COLORS[0], equip: { oberteil: 'tshirt_grau' } };

function normalize(av){
  av = av && typeof av === 'object' ? av : {};
  const out = { animal: ANIMALS[av.animal] ? av.animal : DEFAULT.animal, color: COLORS.includes(av.color) ? av.color : DEFAULT.color, equip: {} };
  const eq = av.equip && typeof av.equip === 'object' ? av.equip : DEFAULT.equip;
  Object.keys(SLOTS).forEach(s => { const id = eq[s]; if(id && ITEMS[id] && ITEMS[id].slot === s) out.equip[s] = id; });
  if(!out.equip.oberteil) out.equip.oberteil = 'tshirt_grau';
  return out;
}

/* ---------- Zeichnung (viewBox 100×100) ---------- */
const eyes = (fur, big) => big
  ? '<g class="av-eyes"><circle cx="40" cy="44" r="8" fill="#fff"/><circle cx="60" cy="44" r="8" fill="#fff"/><circle cx="41" cy="45" r="3.6" fill="#1b1b1b"/><circle cx="59" cy="45" r="3.6" fill="#1b1b1b"/><circle cx="42.2" cy="43.6" r="1.1" fill="#fff"/><circle cx="60.2" cy="43.6" r="1.1" fill="#fff"/></g>'
  : '<g class="av-eyes"><circle cx="41" cy="44" r="3.4" fill="#1b1b1b"/><circle cx="59" cy="44" r="3.4" fill="#1b1b1b"/><circle cx="42.1" cy="42.9" r="1" fill="#fff"/><circle cx="60.1" cy="42.9" r="1" fill="#fff"/></g>';
const nose = (y, c) => '<path d="M46.5 ' + y + 'h7l-3.5 4z" fill="' + (c || '#1b1b1b') + '"/>';
const HEADS = {
  fuchs: a => '<path d="M29 32L22 10L42 24z" fill="' + a.fur + '"/><path d="M71 32L78 10L58 24z" fill="' + a.fur + '"/><path d="M29 28L25 15L37 24z" fill="#3a1f10"/><path d="M71 28L75 15L63 24z" fill="#3a1f10"/>'
    + '<ellipse cx="50" cy="46" rx="24" ry="22" fill="' + a.fur + '"/><path d="M27 48Q38 58 50 66Q62 58 73 48Q66 64 50 70Q34 64 27 48z" fill="' + a.light + '"/>' + nose(55),
  baer: a => '<circle cx="30" cy="25" r="9" fill="' + a.fur + '"/><circle cx="70" cy="25" r="9" fill="' + a.fur + '"/><circle cx="30" cy="25" r="4.5" fill="' + a.light + '"/><circle cx="70" cy="25" r="4.5" fill="' + a.light + '"/>'
    + '<circle cx="50" cy="46" r="25" fill="' + a.fur + '"/><ellipse cx="50" cy="56" rx="11" ry="8.5" fill="' + a.light + '"/>' + nose(51),
  eule: a => '<path d="M30 30L26 14L40 25z" fill="' + a.fur + '"/><path d="M70 30L74 14L60 25z" fill="' + a.fur + '"/>'
    + '<ellipse cx="50" cy="47" rx="25" ry="24" fill="' + a.fur + '"/><circle cx="40" cy="44" r="11" fill="' + a.light + '"/><circle cx="60" cy="44" r="11" fill="' + a.light + '"/><path d="M47 53h6l-3 7z" fill="#f0a93a"/>'
    + '<path d="M36 64q4 3 8 0M48 66q4 3 8 0M58 63q3 3 6 0" stroke="#5f5445" stroke-width="1.4" fill="none"/>',
  wolf: a => '<path d="M28 34L25 10L44 26z" fill="' + a.fur + '"/><path d="M72 34L75 10L56 26z" fill="' + a.fur + '"/><path d="M30 29L28 16L39 26z" fill="#4a525a"/><path d="M70 29L72 16L61 26z" fill="#4a525a"/>'
    + '<ellipse cx="50" cy="46" rx="24" ry="23" fill="' + a.fur + '"/><path d="M36 50Q50 44 64 50Q62 68 50 70Q38 68 36 50z" fill="' + a.light + '"/>' + nose(53),
  pinguin: a => '<ellipse cx="50" cy="47" rx="25" ry="25" fill="' + a.fur + '"/><path d="M50 38C44 30 30 34 31 48C32 62 42 68 50 68C58 68 68 62 69 48C70 34 56 30 50 38z" fill="' + a.light + '"/>'
    + '<path d="M44 53h12l-6 6z" fill="#f39c12"/>',
  biber: a => '<circle cx="32" cy="27" r="5.5" fill="' + a.fur + '"/><circle cx="68" cy="27" r="5.5" fill="' + a.fur + '"/>'
    + '<ellipse cx="50" cy="47" rx="24" ry="23" fill="' + a.fur + '"/><ellipse cx="50" cy="56" rx="12" ry="9" fill="' + a.light + '"/>' + nose(50, '#3a2414')
    + '<rect x="46.4" y="58" width="3.4" height="6" rx="1" fill="#fff"/><rect x="50.2" y="58" width="3.4" height="6" rx="1" fill="#fff"/>',
  steinbock: a => '<path d="M36 26C30 12 16 8 10 16C18 12 26 18 30 30z" fill="#6d5a44"/><path d="M64 26C70 12 84 8 90 16C82 12 74 18 70 30z" fill="#6d5a44"/>'
    + '<ellipse cx="27" cy="36" rx="7" ry="4" fill="' + a.fur + '" transform="rotate(-20 27 36)"/><ellipse cx="73" cy="36" rx="7" ry="4" fill="' + a.fur + '" transform="rotate(20 73 36)"/>'
    + '<ellipse cx="50" cy="46" rx="22" ry="24" fill="' + a.fur + '"/><ellipse cx="50" cy="58" rx="10" ry="8" fill="' + a.light + '"/><path d="M45 68Q50 80 55 68z" fill="' + a.light + '"/>' + nose(53, '#3b2f22'),
  katze: a => '<path d="M28 34L26 12L44 26z" fill="' + a.fur + '"/><path d="M72 34L74 12L56 26z" fill="' + a.fur + '"/><path d="M30 29L29 17L39 26z" fill="#f2b8c6"/><path d="M70 29L71 17L61 26z" fill="#f2b8c6"/>'
    + '<ellipse cx="50" cy="47" rx="24" ry="22" fill="' + a.fur + '"/><path d="M47 52h6l-3 3.5z" fill="#e58aa0"/>'
    + '<path d="M44 55q-9-1-16 1M44 57q-8 1-15 4M56 55q9-1 16 1M56 57q8 1 15 4" stroke="#3b3f46" stroke-width="1" fill="none"/>'
};
function top(it){
  if(!it) return '';
  const c = it.color;
  const base = '<path d="M14 100C14 84 28 76 50 76C72 76 86 84 86 100z" fill="' + c + '"/>';
  let extra = '';
  if(it.kind === 'hemd') extra = '<path d="M41 76L50 88L59 76L56 74L50 82L44 74z" fill="#fff" stroke="#9aa3ab" stroke-width=".6"/><circle cx="50" cy="92" r="1.3" fill="#555"/><circle cx="50" cy="97" r="1.3" fill="#555"/>';
  else extra = '<path d="M42 76Q50 84 58 76" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/>';
  if(it.motif === 'zahnrad') extra += '<g transform="translate(50 91)" fill="#f5c518"><circle r="5"/>' + [0, 45, 90, 135].map(r => '<rect x="-1.4" y="-7.5" width="2.8" height="15" transform="rotate(' + r + ')"/>').join('') + '<circle r="2" fill="' + c + '"/></g>';
  if(it.motif === 'blitz') extra += '<path d="M52 83L44 93h5l-3 7l9-11h-5z" fill="#f5c518"/>';
  if(it.motif === 'kariert') extra += '<g stroke="rgba(255,255,255,.35)" stroke-width="1.2">' + [24, 34, 44, 56, 66, 76].map(x => '<path d="M' + x + ' 78V100"/>').join('') + [84, 92].map(y => '<path d="M16 ' + y + 'H84"/>').join('') + '</g>';
  return base + extra;
}
function chain(it){
  if(!it) return '';
  let s = '<path d="M38 74Q50 88 62 74" stroke="' + it.color + '" stroke-width="2.2" fill="none" stroke-dasharray="2.5 1.2"/>';
  if(it.motif === 'zahnrad') s += '<g transform="translate(50 86)" fill="' + it.color + '"><circle r="3.6"/>' + [0, 60, 120].map(r => '<rect x="-1" y="-5.2" width="2" height="10.4" transform="rotate(' + r + ')"/>').join('') + '<circle r="1.4" fill="#333"/></g>';
  else s += '<circle cx="50" cy="84.5" r="3" fill="' + it.color + '"/>';
  return s;
}
function glasses(it, big){
  if(!it) return '';
  const r = big ? 10 : 7.5, c = it.color;
  if(it.kind === 'rund') return '<g fill="none" stroke="' + c + '" stroke-width="2"><circle cx="40" cy="44" r="' + r + '"/><circle cx="60" cy="44" r="' + r + '"/><path d="M' + (40 + r) + ' 44h' + (20 - 2 * r) + '"/></g>';
  if(it.kind === 'eckig') return '<g fill="none" stroke="' + c + '" stroke-width="2"><rect x="' + (40 - r) + '" y="' + (44 - r * 0.75) + '" width="' + 2 * r + '" height="' + 1.5 * r + '" rx="2"/><rect x="' + (60 - r) + '" y="' + (44 - r * 0.75) + '" width="' + 2 * r + '" height="' + 1.5 * r + '" rx="2"/><path d="M' + (40 + r) + ' 44h' + (20 - 2 * r) + '"/></g>';
  if(it.kind === 'sonne') return '<g fill="' + c + '"><rect x="' + (40 - r - 1) + '" y="39" width="' + (2 * r + 2) + '" height="' + (big ? 13 : 10) + '" rx="4"/><rect x="' + (60 - r - 1) + '" y="39" width="' + (2 * r + 2) + '" height="' + (big ? 13 : 10) + '" rx="4"/><path d="M' + (40 + r) + ' 42h' + (20 - 2 * r) + '" stroke="' + c + '" stroke-width="2"/></g><path d="M34 41l4-1" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>';
  return '<path d="M26 44h48" stroke="#333" stroke-width="2.4"/><rect x="29" y="36" width="42" height="15" rx="6" fill="' + c + '" fill-opacity=".45" stroke="#e5f4ff" stroke-width="1.6"/>';
}
function hat(it){
  if(!it) return '';
  const c = it.color;
  if(it.kind === 'kappe') return '<path d="M27 32C27 16 73 16 73 32z" fill="' + c + '"/><path d="M50 32H84Q86 36 80 37H50z" fill="' + c + '"/><path d="M27 32H73" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/><circle cx="50" cy="17.5" r="2.2" fill="' + c + '" stroke="rgba(0,0,0,.25)"/>';
  if(it.kind === 'muetze') return '<path d="M26 34C26 12 74 12 74 34z" fill="' + c + '"/><rect x="25" y="29" width="50" height="8" rx="4" fill="' + c + '" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 2"/><circle cx="50" cy="11" r="5" fill="#fff"/>';
  if(it.kind === 'helm') return '<path d="M24 33C24 11 76 11 76 33z" fill="' + c + '"/><path d="M19 33H81Q82 37 78 37H22Q18 37 19 33z" fill="' + c + '" stroke="rgba(0,0,0,.25)"/><path d="M50 13V33M40 16V32M60 16V32" stroke="rgba(0,0,0,.18)" stroke-width="2"/>';
  return '';
}
/* svg(av, {size, title}) – av wie normalize(); Klassen av-eyes (Blinzeln) für die Challenge-Animation im CSS */
function svg(av, opt){
  av = normalize(av); opt = opt || {};
  const a = ANIMALS[av.animal], it = s => ITEMS[av.equip[s]];
  const big = av.animal === 'eule';
  const t = opt.title ? '<title>' + String(opt.title).replace(/[<&>"]/g, '') + '</title>' : '';
  return '<svg class="av-svg" viewBox="0 0 100 100" role="img" aria-label="' + a.name + '"' + (opt.size ? ' width="' + opt.size + '" height="' + opt.size + '"' : '') + ' xmlns="http://www.w3.org/2000/svg">' + t
    + '<defs><clipPath id="avc"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#avc)">'
    + '<circle cx="50" cy="50" r="50" fill="' + av.color + '"/>'
    + top(it('oberteil')) + chain(it('kette')) + HEADS[av.animal](a) + eyes(a.fur, big) + glasses(it('brille'), big) + hat(it('kopf'))
    + '</g></svg>';
}

/* ---------- Coins ---------- */
// progress: {quest: state}; meta: {quest: {taskId: {boss, final}}}; ledger: [{amount, source, ref}]
const RULES = { star: [10, 15, 20], revealed: 3, boss: 40, final: 100, theory: 10, speedrun: { 1: 60, 2: 40, 3: 25, solved: 10, sudden: 80 } };
function earned(progress, meta){
  const out = { tasks: 0, bosses: 0, finals: 0, theory: 0, total: 0, n: 0, bossN: 0, finalN: 0, quests: 0 };
  Object.keys(progress || {}).forEach(q => {
    const st = progress[q] || {}, m = (meta && meta[q]) || {};
    const done = st.doneTasks || {}; let any = false;
    Object.keys(done).forEach(id => {
      const d = done[id] || {}; any = true; out.n++;
      out.tasks += d.revealed ? RULES.revealed : RULES.star[Math.max(1, Math.min(3, d.stars || 1)) - 1];
      const f = m[id] || {};
      if(f.final && !d.revealed){ out.finals += RULES.final; out.finalN++; }   // Final Boss: nur der Final-Zuschlag
      else if(f.boss && !d.revealed){ out.bosses += RULES.boss; out.bossN++; }
    });
    out.theory += Object.keys(st.doneTheory || {}).length * RULES.theory;
    if(any) out.quests++;
  });
  out.total = out.tasks + out.bosses + out.finals + out.theory;
  return out;
}
function unlockCtx(e, ledger){
  const L = ledger || [];
  return { final: e.finalN, bosses: e.bossN, quests: e.quests, podium: L.filter(x => x.source === 'speedrun' && /^r[123]:/.test(x.ref || '')).length };
}
function isUnlocked(id, ctx){
  const it = ITEMS[id]; if(!it) return false; if(!it.unlock) return true;
  return Object.keys(it.unlock).every(k => (ctx[k] || 0) >= it.unlock[k]);
}
function unlockText(id){
  const it = ITEMS[id]; if(!it || !it.unlock) return '';
  return Object.keys(it.unlock).map(k => typeof UNLOCK_TEXT[k] === 'function' ? UNLOCK_TEXT[k](it.unlock[k]) : UNLOCK_TEXT[k]).join(', ');
}
function balance(progress, meta, ledger){
  const e = earned(progress, meta), L = ledger || [];
  const bonus = L.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0), spent = -L.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0);
  return { earned: e, speedrun: bonus, spent, balance: e.total + bonus - spent, owned: L.filter(x => x.source === 'kauf').map(x => x.ref), ctx: unlockCtx(e, L) };
}
const API = { ANIMALS, COLORS, ITEMS, SLOTS, DEFAULT, RULES, normalize, svg, earned, unlockCtx, isUnlocked, unlockText, balance };
root.SPSQAvatar = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

export const Avatar = globalThis.SPSQAvatar;
export const AVATAR_META = {"scl":{"c1_boss":{"boss":true,"final":false},"r2t10":{"boss":true,"final":false},"c3_boss":{"boss":true,"final":false},"c4_boss":{"boss":true,"final":false},"r3t10":{"boss":true,"final":false},"r4t10":{"boss":true,"final":false},"c7_boss":{"boss":true,"final":false},"c8_boss":{"boss":true,"final":false},"r5t10":{"boss":true,"final":false},"final_boss":{"boss":true,"final":true},"p11_boss":{"boss":true,"final":false},"p12_boss":{"boss":true,"final":false},"p13_boss":{"boss":true,"final":false},"p14_boss":{"boss":true,"final":false},"p15_final":{"boss":true,"final":true}},"kop":{"k1_boss":{"boss":true,"final":false},"k2_boss":{"boss":true,"final":false},"k3_boss":{"boss":true,"final":false},"k4_boss":{"boss":true,"final":false},"k5_boss":{"boss":true,"final":false},"k6_boss":{"boss":true,"final":false},"k7_boss":{"boss":true,"final":false},"k8_boss":{"boss":true,"final":false},"k9_boss":{"boss":true,"final":false},"k10_final":{"boss":true,"final":true},"k11_boss":{"boss":true,"final":false},"k12_boss":{"boss":true,"final":false},"k13_boss":{"boss":true,"final":false},"k14_boss":{"boss":true,"final":false},"k15_final":{"boss":true,"final":true}},"fup":{"f1_boss":{"boss":true,"final":false},"f2_boss":{"boss":true,"final":false},"f3_boss":{"boss":true,"final":false},"f4_boss":{"boss":true,"final":false},"f5_boss":{"boss":true,"final":false},"f6_boss":{"boss":true,"final":false},"f7_boss":{"boss":true,"final":false},"f8_boss":{"boss":true,"final":false},"f9_boss":{"boss":true,"final":false},"f10_final":{"boss":true,"final":true},"fp11_boss":{"boss":true,"final":false},"fp12_boss":{"boss":true,"final":false},"fp13_boss":{"boss":true,"final":false},"fp14_boss":{"boss":true,"final":false},"fp15_final":{"boss":true,"final":true}},"awl":{"a1_boss":{"boss":true,"final":false},"a2_boss":{"boss":true,"final":false},"a3_boss":{"boss":true,"final":false},"a4_boss":{"boss":true,"final":false},"a5_boss":{"boss":true,"final":false},"a6_boss":{"boss":true,"final":false},"a7_boss":{"boss":true,"final":false},"a8_boss":{"boss":true,"final":false},"a9_boss":{"boss":true,"final":false},"a10_final":{"boss":true,"final":true},"ap11_boss":{"boss":true,"final":false},"ap12_boss":{"boss":true,"final":false},"ap13_boss":{"boss":true,"final":false},"ap14_boss":{"boss":true,"final":false},"ap15_final":{"boss":true,"final":true}},"sensor":{"w1_boss_sortierstrecke":{"boss":true,"final":false},"w2_boss_umbau":{"boss":true,"final":false},"w3_boss_sieben":{"boss":true,"final":false},"w4_boss_tank":{"boss":true,"final":false},"w5_boss_hmi":{"boss":true,"final":false},"w6_finale":{"boss":false,"final":true}}};
