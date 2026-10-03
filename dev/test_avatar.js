// Garderobe 2.0 (A4–A6), reine Logik: node test_avatar.js
// Katalog (Seltenheit, Preise je Stufe, Bedingungen nur aus Server-Quellen für Legendär/Mythisch), Zeichnung aller Teile,
// Freischaltregeln und Fortschritt, alte Inventare, Varianten, Schaufenster, Sets, Wirtschaft.
const A = require('./src/avatar_core.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; } else { fail++; console.log('✗ ' + m); } };
const BAND = { gewoehnlich: [0, 150], selten: [250, 500], episch: [800, 1500], legendaer: [2000, 3500], mythisch: [4000, 8000] };
const SERVER = ['cert', 'certs', 'profiCerts', 'challenges', 'podium', 'wins', 'sdWins', 'bugFixed', 'flawless', 'questFinal', 'finals3', 'sensorAll', 'sensorClean'];
const ids = Object.keys(A.ITEMS);
ids.forEach(id => {
  const it = A.ITEMS[id];
  ok(A.SLOTS[it.slot] && A.RARITY[it.rarity], id + ': Platz und Seltenheit gültig');
  // Titel (Episch) und Paket-3-/P-Teile dürfen ausserhalb des Bandes liegen
  if(!['titel'].includes(it.slot) && !it.earnOnly && !['kette_meister', 'helm_meister'].includes(id)) ok(it.price >= BAND[it.rarity][0] && it.price <= BAND[it.rarity][1], id + ': Preis ' + it.price + ' im Band ' + it.rarity);
  if(['legendaer', 'mythisch'].includes(it.rarity) && !it.shop) ok(it.unlock && Object.keys(it.unlock).every(k => SERVER.includes(k)), id + ': Legendär/Mythisch nur mit Server-Bedingung');
  if(it.anim) ok(it.rarity !== 'gewoehnlich', id + ': bewegte Teile sind mindestens selten');
  if(it.unlock) ok(A.unlockText(id).length > 5, id + ': Bedingungstext');
  // Zeichnung: Ganzkörper in allen Posen ohne doppelte IDs und mit aufgelösten Verweisen; Chip ohne Verläufe
  const av = { animal: 'baer', color: A.COLORS[2], equip: { oberteil: 'tshirt_grau', [it.slot]: id } };
  for(const pose of A.POSES){
    const s = A.svg(av, { size: 'card', pose, anim: true, uid: 'q-' });
    const d = [...s.matchAll(/ id="([^"]+)"/g)].map(m => m[1]), refs = [...s.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);
    ok(new Set(d).size === d.length && refs.every(r => d.includes(r)) && !/undefined|NaN/.test(s), id + '/' + pose + ': Zeichnung sauber');
  }
  ok(!/url\(#/.test(A.svg(av, { size: 'chip' }).replace(/clip-path="url\(#[^)]+c\)"/, '')) && !/undefined|NaN/.test(A.svg(av)), id + ': Chip ohne Verläufe');
});
// alte Inventare (Paket 3): Preise, Plätze und Besitz unverändert
const OLD = { tshirt_grau: 0, tshirt_rot: 40, tshirt_blitz: 120, hemd_kariert: 110, kette_gold: 150, sonnenbrille: 90, kappe_rot: 50, bauhelm: 120 };
Object.keys(OLD).forEach(id => ok(A.ITEMS[id] && A.ITEMS[id].price === OLD[id] && A.ITEMS[id].rarity === 'gewoehnlich', id + ': Preis aus Paket 3 bleibt'));
const old = A.normalize({ animal: 'wolf', color: '#1f5f8b', equip: { oberteil: 'hemd_kariert', kette: 'kette_gold', brille: 'sonnenbrille', kopf: 'bauhelm' } });
ok(old.equip.kopf === 'bauhelm' && old.equip.kette === 'kette_gold', 'alter Avatar bleibt angezogen');
ok(A.owns('tshirt_grau', [], {}) && A.owns('kappe_rot', ['kappe_rot'], {}) && !A.owns('kappe_rot', [], {}), 'Besitz: frei / gekauft / nicht gekauft');
// Freischaltregeln und Fortschritt
const meta = { scl: { final_boss: { final: true, ch: 10 }, p15_final: { final: true, ch: 15 }, $: { tasks: 150 } }, sensor: { $: { shown: Array.from({ length: 30 }, (_, i) => 's' + i), theory: 12, tasks: 30 } } };
const prog = { scl: { doneTasks: Object.fromEntries(Array.from({ length: 52 }, (_, i) => ['t' + i, { stars: 3 }])), doneTheory: {} } };
let ctx = A.balance(prog, meta, [], [], {}).ctx;
ok(A.isUnlocked('scl_hoodie', ctx) && !A.isUnlocked('scl_visor', ctx), '25 SCL-Aufgaben: Hoodie frei, Visor (75) nicht');
ok(/52\/75/.test(A.unlockText('scl_visor', ctx)), 'Fortschritt im Text: ' + A.unlockText('scl_visor', ctx));
const pr = A.unlockProgress('scl_visor', ctx)[0]; ok(pr.have === 52 && pr.need === 75 && !pr.ok, 'Fortschrittsbalken 52/75');
ok(!A.isUnlocked('scl_greifarm', ctx), 'Greifarm ohne Final Boss gesperrt');
prog.scl.doneTasks.final_boss = { stars: 3 }; ctx = A.balance(prog, meta, [], [], {}).ctx;
ok(A.isUnlocked('scl_greifarm', ctx) && ctx.questFinal.scl === 'final_boss', 'Final Boss im Spielstand: Greifarm freischaltbar (Kauf prüft der Worker)');
prog.scl.doneTasks.p15_final = { stars: 3 }; ctx = A.balance(prog, meta, [], [], {}).ctx;
ok(ctx.finals3 === 1, 'Final Boss 2 zählt nicht als weitere Sprache');
prog.scl.doneTasks.final_boss = { revealed: true }; ctx = A.balance(prog, meta, [], [], {}).ctx;
ok(!A.isUnlocked('scl_greifarm', ctx), 'Final Boss mit „Lösung zeigen“ schaltet nichts frei');
ctx = A.balance(prog, meta, [], [{ quest: 'scl', level: 'grund' }, { quest: 'scl', level: 'profi' }], {}).ctx;
ok(A.isUnlocked('scl_aura', ctx) && !A.isUnlocked('kop_sockel', ctx) && ctx.profiCerts === 1, 'Zertifikat SCL Profi: Code-Aura frei, KOP nicht');
ok(!A.owns('kopf_krone', [], ctx), 'Krone erst mit allen vier Profi-Zertifikaten');
ctx = A.balance(prog, meta, [], ['scl', 'kop', 'fup', 'awl'].map(q => ({ quest: q, level: 'profi' })), {}).ctx;
ok(A.owns('kopf_krone', [], ctx), 'vier Profi-Zertifikate: Krone gehört einem (nur verdienbar)');
ctx = A.balance({}, meta, [], [], { challenges: 15, podium: 4, wins: 1, sdWins: 1, bugFixed: 5, flawless: 9 }).ctx;
ok(A.isUnlocked('sockel_neon', ctx) && !A.isUnlocked('sockel_holo', ctx) && !A.isUnlocked('hand_pokal', ctx) && A.isUnlocked('aura_blitz', ctx) && A.isUnlocked('hand_lupe', ctx) && !A.isUnlocked('titel_null', ctx), 'Challenge-Trophäen nach Stufen');
const sp = { sensor: { doneTasks: Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['s' + i, { stars: 2 }]).concat([['hidden1', {}]])), doneTheory: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['th' + i, {}])) } };
ctx = A.balance(sp, meta, [], [], {}).ctx;
ok(A.isUnlocked('sen_multimeter', ctx) && A.isUnlocked('sen_umhang', ctx) && ctx.questSolved.sensor === 30, 'Sensor: alle 30 angezeigten + Theorien');
sp.sensor.doneTasks.s3 = { revealed: true }; ctx = A.balance(sp, meta, [], [], {}).ctx;
ok(A.isUnlocked('sen_multimeter', ctx) && !A.isUnlocked('sen_umhang', ctx), 'Sensor-Meister nur ohne „Lösung zeigen“');
// Varianten
const v1 = A.item('scl_visor~1');
ok(v1 && v1.price === 1560 && v1.color === A.ITEMS.scl_visor.alt[0] && v1.slot === 'brille', 'Variante +30 %: ' + (v1 && v1.price));
ok(!A.item('kappe_rot~1') && !A.item('scl_visor~3') && !A.item('x~1'), 'ungültige Varianten');
ok(A.normalize({ equip: { brille: 'scl_visor~2' } }).equip.brille === 'scl_visor~2', 'Variante bleibt beim Normalisieren');
// Schaufenster: je Monat 3, wechselt monatlich
const jan = Date.UTC(2026, 0, 15), feb = Date.UTC(2026, 1, 15);
const sale = t => ids.filter(id => A.ITEMS[id].shop && A.onSale(id, t));
ok(sale(jan).length === 3 && sale(feb).length === 3 && sale(jan).every(id => !sale(feb).includes(id)), 'Schaufenster: 3 Teile je Monat, monatlich wechselnd');
ok(A.onSale('kappe_rot', jan), 'normale Teile immer kaufbar');
// Sets und Titel
const fupSet = { animal: 'katze', equip: { kopf: 'fup_lokmuetze', hand: 'fup_kelle~1', kette: 'fup_laterne', aura: 'fup_dampf', siegerpose: 'fup_pfiff', titel: 'fup_titel' } };
ok(A.setDone(A.normalize(fupSet)) === 'fup' && /stroke="#cbd5e1" stroke-width="1.6"/.test(A.svg(fupSet, { size: 'card' })), 'FUP-Set komplett (auch mit Variante): Schienen-Sockel');
ok(A.title(fupSet).text === 'Fahrdienstleiter' && A.best(fupSet).rarity === 'mythisch', 'Titel und seltenstes Teil');
// Wirtschaft: Katalog ≈ 60 000–80 000 (ohne Varianten/Schaufenster), mehr als alle Quests zusammen
const E = A.economy({ scl: { $: { tasks: 150 } }, kop: { $: { tasks: 150 } }, fup: { $: { tasks: 150 } }, awl: { $: { tasks: 150 } }, sensor: { $: { tasks: 30, theoryAll: 12 } } });
ok(E.total >= 60000 && E.total <= 82000, 'Katalogsumme ' + E.total);
ok(Object.values(E.perQuest).reduce((a, b) => a + b, 0) < E.total / 3, 'Quests allein reichen nicht für den ganzen Katalog');
console.log('Garderobe 2.0: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
