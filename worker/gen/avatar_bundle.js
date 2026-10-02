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
// Plätze am Körper (Garderobe 2.0, Auftrag 12.2) – Reihenfolge = Reihenfolge in der Garderobe
const SLOTS = { kopf: 'Kopfbedeckung', brille: 'Brille / Visier', oberteil: 'Oberteil', kette: 'Kette / Anhänger', hand: 'Hand', ruecken: 'Rücken', schuhe: 'Schuhe',
  aura: 'Aura', sockel: 'Sockel', siegerpose: 'Siegerpose', titel: 'Titel' };
// Seltenheitsstufen (12.1): Rahmenfarbe überall gleich
const RARITY = { gewoehnlich: { name: 'Gewöhnlich', color: '#9aa3ab', n: 0 }, selten: { name: 'Selten', color: '#3b82f6', n: 1 }, episch: { name: 'Episch', color: '#a855f7', n: 2 },
  legendaer: { name: 'Legendär', color: '#f5c518', n: 3 }, mythisch: { name: 'Mythisch', color: '#e0457b', n: 4 } };
// Quest-Kollektionen (12.3): Set = alle Teile einer Quest zugleich getragen → Sockel-Effekt
const SETS = { scl: { name: 'Roboterzelle (SCL)', bonus: 'Code-Ring' }, kop: { name: 'Seilbahn (KOP)', bonus: 'Schneekante' }, fup: { name: 'Stellwerk (FUP)', bonus: 'Schienen-Sockel' },
  awl: { name: 'Walzwerk (AWL)', bonus: 'Glutrand' }, sensor: { name: 'Werkstatt (Sensor)', bonus: 'Kabelring' } };
// Katalog: price 0 ohne unlock = von Anfang an frei; unlock = Bedingung zusätzlich zum Preis; earnOnly = nicht kaufbar, gehört einem bei erfüllter Bedingung
// rarity (Standard gewoehnlich), set, anim (bewegt sich), alt = Farbvarianten (je +30 %), shop:'monat' = Monats-Schaufenster
const ITEMS = {
  // Gewöhnlich (Paket 3, Preise und Besitz bleiben)
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
  bauhelm:        { slot: 'kopf',     name: 'Bauhelm',           price: 120, kind: 'helm', color: '#f5c518', unlock: { bosses: 3 } },
  schuhe_turn:    { slot: 'schuhe',   name: 'Turnschuhe',        price: 60,  kind: 'sneaker', color: '#e5e7eb' },
  schuhe_rot:     { slot: 'schuhe',   name: 'Turnschuhe rot',    price: 60,  kind: 'sneaker', color: '#dc2626' },
  schuhe_sicher:  { slot: 'schuhe',   name: 'Sicherheitsschuhe', price: 120, kind: 'sicher', color: '#1f2937' },
  // Zertifikate (Paket P)
  kette_meister:  { slot: 'kette',    name: 'Meister-Anhänger',  price: 300, rarity: 'selten', kind: 'kette', color: '#f5c518', motif: 'zahnrad', unlock: { certs: 1 } },
  helm_meister:   { slot: 'kopf',     name: 'Meister-Helm',      price: 900, rarity: 'episch', kind: 'helm', color: '#e5e7eb', unlock: { profiCerts: 1 } },
  // Selten ohne Leistung
  schuhe_neon:    { slot: 'schuhe',   name: 'Neon-Sneaker',      price: 350, rarity: 'selten', kind: 'neon', color: '#a3e635' },
  tshirt_verlauf: { slot: 'oberteil', name: 'T-Shirt Sonnenuntergang', price: 300, rarity: 'selten', kind: 'tshirt', color: '#f97316', motif: 'verlauf' },
  // Quest-Kollektion SCL (Roboterzelle)
  scl_hoodie:     { slot: 'oberteil', name: 'Hoodie „IF…THEN“',  price: 400,  rarity: 'selten',    set: 'scl', kind: 'hoodie', color: '#1f2937', unlock: { questSolved: { scl: 25 } } },
  scl_visor:      { slot: 'brille',   name: 'Cyber-Visor',       price: 1200, rarity: 'episch',    set: 'scl', kind: 'visor', color: '#22d3ee', anim: true, alt: ['#f43f5e', '#a3e635'], unlock: { questSolved: { scl: 75 } } },
  scl_greifarm:   { slot: 'ruecken',  name: 'Greifarm-Rucksack', price: 2500, rarity: 'legendaer', set: 'scl', kind: 'greifarm', color: '#f59e0b', anim: true, alt: ['#64748b', '#ef4444'], unlock: { questFinal: 'scl' } },
  scl_aura:       { slot: 'aura',     name: 'Code-Aura',         price: 5000, rarity: 'mythisch',  set: 'scl', kind: 'code', color: '#39ff14', anim: true, unlock: { cert: { quest: 'scl', level: 'profi' } } },
  scl_titel:      { slot: 'titel',    name: 'Syntax-Sensei',     price: 600,  rarity: 'episch',    set: 'scl', kind: 'titel', unlock: { questSolved: { scl: 75 } } },
  // KOP (Seilbahn)
  kop_muetze:     { slot: 'kopf',     name: 'Bergführer-Mütze',  price: 400,  rarity: 'selten',    set: 'kop', kind: 'bergmuetze', color: '#b91c1c', unlock: { questSolved: { kop: 25 } } },
  kop_skibrille:  { slot: 'brille',   name: 'Skibrille verspiegelt', price: 1200, rarity: 'episch', set: 'kop', kind: 'ski', color: '#f97316', alt: ['#38bdf8', '#a855f7'], unlock: { questSolved: { kop: 75 } } },
  kop_kabine:     { slot: 'kette',    name: 'Seilbahn-Kabine',   price: 2500, rarity: 'legendaer', set: 'kop', kind: 'kabine', color: '#dc2626', anim: true, alt: ['#2563eb', '#16a34a'], unlock: { questFinal: 'kop' } },
  kop_sockel:     { slot: 'sockel',   name: 'Gipfel-Sockel mit Schneefall', price: 5000, rarity: 'mythisch', set: 'kop', kind: 'gipfel', color: '#e2e8f0', anim: true, unlock: { cert: { quest: 'kop', level: 'profi' } } },
  kop_titel:      { slot: 'titel',    name: 'Stromlaufplan-Profi', price: 600, rarity: 'episch',   set: 'kop', kind: 'titel', unlock: { questSolved: { kop: 75 } } },
  // FUP (Stellwerk)
  fup_lokmuetze:  { slot: 'kopf',     name: 'Lokführer-Mütze',   price: 400,  rarity: 'selten',    set: 'fup', kind: 'lokmuetze', color: '#1e3a8a', unlock: { questSolved: { fup: 25 } } },
  fup_kelle:      { slot: 'hand',     name: 'Signalkelle',       price: 1200, rarity: 'episch',    set: 'fup', kind: 'kelle', color: '#16a34a', alt: ['#dc2626', '#f5c518'], unlock: { questSolved: { fup: 75 } } },
  fup_laterne:    { slot: 'kette',    name: 'Weichenlaterne',    price: 2500, rarity: 'legendaer', set: 'fup', kind: 'laterne', color: '#1f2937', anim: true, alt: ['#7c2d12', '#334155'], unlock: { questFinal: 'fup' } },
  fup_dampf:      { slot: 'aura',     name: 'Dampf-Aura',        price: 5000, rarity: 'mythisch',  set: 'fup', kind: 'dampf', color: '#f1f5f9', anim: true, unlock: { cert: { quest: 'fup', level: 'profi' } } },
  fup_pfiff:      { slot: 'siegerpose', name: 'Pfiff-Siegerpose', price: 4000, rarity: 'mythisch', set: 'fup', kind: 'pfiff', color: '#cbd5e1', anim: true, unlock: { cert: { quest: 'fup', level: 'profi' } } },
  fup_titel:      { slot: 'titel',    name: 'Fahrdienstleiter',  price: 600,  rarity: 'episch',    set: 'fup', kind: 'titel', unlock: { questSolved: { fup: 75 } } },
  // AWL (Walzwerk)
  awl_schuerze:   { slot: 'oberteil', name: 'Lederschürze',      price: 400,  rarity: 'selten',    set: 'awl', kind: 'schuerze', color: '#7c4a24', unlock: { questSolved: { awl: 25 } } },
  awl_helm:       { slot: 'kopf',     name: 'Giesser-Helm mit Hitzevisier', price: 1200, rarity: 'episch', set: 'awl', kind: 'giesser', color: '#cbd5e1', alt: ['#f5c518', '#334155'], unlock: { questSolved: { awl: 75 } } },
  awl_stahl:      { slot: 'kette',    name: 'Glühender Stahlblock', price: 2500, rarity: 'legendaer', set: 'awl', kind: 'stahl', color: '#f97316', anim: true, alt: ['#ef4444', '#facc15'], unlock: { questFinal: 'awl' } },
  awl_funken:     { slot: 'aura',     name: 'Funkenregen',       price: 5000, rarity: 'mythisch',  set: 'awl', kind: 'funken', color: '#fb923c', anim: true, unlock: { cert: { quest: 'awl', level: 'profi' } } },
  awl_titel:      { slot: 'titel',    name: 'Akku-Legende',      price: 600,  rarity: 'episch',    set: 'awl', kind: 'titel', unlock: { questSolved: { awl: 75 } } },
  // Sensorwerkstatt (30 angezeigte Aufgaben, noch ohne Prüfung)
  sen_guertel:    { slot: 'oberteil', name: 'Werkzeuggürtel',    price: 400,  rarity: 'selten',    set: 'sensor', kind: 'guertel', color: '#475569', unlock: { questSolved: { sensor: 10 } } },
  sen_lampe:      { slot: 'kopf',     name: 'Stirnlampe',        price: 1200, rarity: 'episch',    set: 'sensor', kind: 'stirnlampe', color: '#facc15', anim: true, alt: ['#38bdf8', '#f472b6'], unlock: { questSolved: { sensor: 20 } } },
  sen_multimeter: { slot: 'hand',     name: 'Multimeter',        price: 2500, rarity: 'legendaer', set: 'sensor', kind: 'multimeter', color: '#facc15', anim: true, alt: ['#ef4444', '#22c55e'], unlock: { sensorAll: 1 } },
  sen_umhang:     { slot: 'ruecken',  name: 'Kabelbaum-Umhang',  price: 5000, rarity: 'mythisch',  set: 'sensor', kind: 'kabel', color: '#1d4ed8', anim: true, unlock: { sensorClean: 1 } },
  sen_titel:      { slot: 'titel',    name: 'Klemmen-König',     price: 600,  rarity: 'episch',    set: 'sensor', kind: 'titel', unlock: { questSolved: { sensor: 20 } } },
  // Challenge-Trophäen (12.4, nur serverseitig gezählt)
  sockel_holz:    { slot: 'sockel',   name: 'Holz-Sockel',       price: 250,  rarity: 'selten',    kind: 'holz', color: '#a16207', unlock: { challenges: 1 } },
  sockel_metall:  { slot: 'sockel',   name: 'Metall-Sockel',     price: 450,  rarity: 'selten',    kind: 'metall', color: '#94a3b8', unlock: { challenges: 5 } },
  sockel_neon:    { slot: 'sockel',   name: 'Neon-Sockel',       price: 900,  rarity: 'episch',    kind: 'neon', color: '#22d3ee', alt: ['#f472b6', '#39ff14'], unlock: { challenges: 15 } },
  sockel_holo:    { slot: 'sockel',   name: 'Hologramm-Sockel',  price: 2500, rarity: 'legendaer', kind: 'holo', color: '#67e8f9', anim: true, alt: ['#c084fc', '#86efac'], unlock: { challenges: 30 } },
  titel_stamm:    { slot: 'titel',    name: 'Stammgast',         price: 600,  rarity: 'episch',    kind: 'titel', unlock: { challenges: 50 } },
  hand_pokal:     { slot: 'hand',     name: 'Pokal',             price: 900,  rarity: 'episch',    kind: 'pokal', color: '#f5c518', alt: ['#cbd5e1', '#d97706'], unlock: { podium: 5 } },
  sp_konfetti:    { slot: 'siegerpose', name: 'Konfetti-Siegerpose', price: 2500, rarity: 'legendaer', kind: 'konfetti', color: '#f472b6', anim: true, unlock: { podium: 15 } },
  kopf_kranz:     { slot: 'kopf',     name: 'Siegerkranz',       price: 450,  rarity: 'selten',    kind: 'kranz', color: '#65a30d', unlock: { wins: 1 } },
  sockel_gold:    { slot: 'sockel',   name: 'Goldener Sockel',   price: 2200, rarity: 'legendaer', kind: 'gold', color: '#f5c518', anim: true, unlock: { wins: 10 } },
  aura_champion:  { slot: 'aura',     name: 'Champion-Aura',     price: 5500, rarity: 'mythisch',  kind: 'champion', color: '#fde047', anim: true, unlock: { wins: 25 } },
  aura_blitz:     { slot: 'aura',     name: 'Blitz-Aura',        price: 2500, rarity: 'legendaer', kind: 'blitz', color: '#facc15', anim: true, alt: ['#38bdf8', '#f472b6'], unlock: { sdWins: 1 } },
  titel_schnell:  { slot: 'titel',    name: 'Schnellster Finger', price: 800, rarity: 'episch',    kind: 'titel', unlock: { sdWins: 5 } },
  hand_lupe:      { slot: 'hand',     name: 'Detektiv-Lupe',     price: 350,  rarity: 'selten',    kind: 'lupe', color: '#7c4a24', unlock: { bugFixed: 5 } },
  kopf_deer:      { slot: 'kopf',     name: 'Deerstalker-Mütze', price: 900,  rarity: 'episch',    kind: 'deer', color: '#92724a', alt: ['#475569', '#14532d'], unlock: { bugFixed: 20 } },
  titel_null:     { slot: 'titel',    name: 'Null-Fehler',       price: 800,  rarity: 'episch',    kind: 'titel', glanz: true, unlock: { flawless: 10 } },
  // Questübergreifend
  ruecken_poly:   { slot: 'ruecken',  name: 'Polyglott-Umhang',  price: 3000, rarity: 'legendaer', kind: 'umhang', color: '#6d28d9', anim: true, alt: ['#0f766e', '#9f1239'], unlock: { finals3: 3 } },
  kopf_krone:     { slot: 'kopf',     name: 'SPS-Meister-Krone', price: 0,    rarity: 'mythisch',  kind: 'krone', color: '#f5c518', anim: true, earnOnly: true, unlock: { profiCerts: 4 } },
  // Monats-Schaufenster (je Monat 3 Teile, kommen später wieder)
  mon_schirm:     { slot: 'hand',     name: 'Regenschirm',       price: 450,  rarity: 'selten',    kind: 'schirm', color: '#0ea5e9', shop: 'monat', shopSet: 0 },
  mon_schal:      { slot: 'kette',    name: 'Ringelschal',       price: 400,  rarity: 'selten',    kind: 'schal', color: '#dc2626', shop: 'monat', shopSet: 0 },
  mon_jetpack:    { slot: 'ruecken',  name: 'Jetpack',           price: 1500, rarity: 'episch',    kind: 'jetpack', color: '#94a3b8', anim: true, shop: 'monat', shopSet: 0 },
  mon_kuerbis:    { slot: 'kopf',     name: 'Kürbis-Hut',        price: 900,  rarity: 'episch',    kind: 'kuerbis', color: '#f97316', shop: 'monat', shopSet: 1 },
  mon_strohhut:   { slot: 'kopf',     name: 'Strohhut',          price: 500,  rarity: 'selten',    kind: 'stroh', color: '#e7c77a', shop: 'monat', shopSet: 1 },
  mon_ballon:     { slot: 'hand',     name: 'Ballon',            price: 500,  rarity: 'selten',    kind: 'ballon', color: '#e11d48', anim: true, shop: 'monat', shopSet: 1 }
};
Object.keys(ITEMS).forEach(id => { const it = ITEMS[id]; it.id = id; it.rarity = it.rarity || 'gewoehnlich'; });
const QN = { scl: 'SCL', kop: 'KOP', fup: 'FUP', awl: 'AWL', sensor: 'Sensor' };
const UNLOCK_TEXT = { final: () => 'Final Boss einer Quest lösen', bosses: n => n + ' Kapitel-Bosse lösen', podium: n => n === 1 ? 'Einmal aufs Podest in einer Live-Challenge' : n + '× aufs Podest in Live-Challenges',
  quests: n => 'In ' + n + ' Quests eine Aufgabe lösen', certs: n => n === 1 ? 'Ein Zertifikat bestehen' : n + ' Zertifikate bestehen',
  profiCerts: n => n === 1 ? 'Ein Profi-Zertifikat bestehen' : n === 4 ? 'Alle vier Profi-Zertifikate bestehen' : n + ' Profi-Zertifikate bestehen',
  questSolved: o => Object.keys(o).map(q => o[q] + ' ' + QN[q] + '-Aufgaben lösen').join(', '), questFinal: q => 'Final Boss der ' + QN[q] + ' Quest lösen',
  cert: o => 'Zertifikat ' + QN[o.quest] + ' ' + (o.level === 'profi' ? 'Profi-Stufe' : 'Grundstufe'), challenges: n => n === 1 ? 'An einer Live-Challenge teilnehmen' : 'An ' + n + ' Live-Challenges teilnehmen',
  wins: n => n === 1 ? 'Eine Live-Challenge gewinnen' : n + ' Live-Challenges gewinnen', sdWins: n => n === 1 ? 'Ein Sudden Death gewinnen' : n + ' Sudden Deaths gewinnen',
  bugFixed: n => n + ' Störungsjagden lösen', flawless: n => n + ' Challenge-Aufgaben fehlerfrei lösen (ohne Fehlversuch und Tipp)', finals3: n => 'Final Boss in ' + n + ' Sprachen lösen',
  sensorAll: () => 'Alle 30 Sensor-Aufgaben und alle Sensor-Theorien lösen', sensorClean: () => 'Alle 30 Sensor-Aufgaben ohne „Lösung zeigen“ lösen' };
const DEFAULT = { animal: 'fuchs', color: COLORS[0], equip: { oberteil: 'tshirt_grau' } };

// Farbvarianten: „id~1“ / „id~2“ = Teil in der Farbe alt[0] / alt[1], Preis +30 %, gleiche Bedingung
function item(id){
  if(!id) return null;
  if(ITEMS[id]) return ITEMS[id];
  const m = /^([a-z0-9_]+)~([12])$/.exec(String(id)); const b = m && ITEMS[m[1]];
  if(!b || !b.alt || !b.alt[m[2] - 1]) return null;
  return Object.assign({}, b, { id, base: b.id, color: b.alt[m[2] - 1], name: b.name + ' (Variante ' + m[2] + ')', price: Math.ceil(b.price * 1.3 / 10) * 10, variant: +m[2], alt: null });
}
function variants(id){ const b = ITEMS[id]; return b && b.alt ? b.alt.map((c, i) => id + '~' + (i + 1)) : []; }
// Monats-Schaufenster: gerade Monate Set 0, ungerade Set 1 (Monatsindex seit Jahr 0, UTC)
function shopSetOf(t){ const d = new Date(t || Date.now()); return (d.getUTCFullYear() * 12 + d.getUTCMonth()) % 2; }
function onSale(id, t){ const it = item(id); return !!it && (it.shop !== 'monat' || it.shopSet === shopSetOf(t)); }

function normalize(av){
  av = av && typeof av === 'object' ? av : {};
  const out = { animal: ANIMALS[av.animal] ? av.animal : DEFAULT.animal, color: COLORS.includes(av.color) ? av.color : DEFAULT.color, equip: {} };
  const eq = av.equip && typeof av.equip === 'object' ? av.equip : DEFAULT.equip;
  Object.keys(SLOTS).forEach(s => { const it = item(eq[s]); if(it && it.slot === s) out.equip[s] = it.id; });
  if(!out.equip.oberteil) out.equip.oberteil = 'tshirt_grau';
  return out;
}
// Titel (Schriftzug unter dem Namen) und das seltenste getragene Teil (für „trägt …“ und den Chip-Rahmen)
function title(av){ const it = av && av.equip && item(av.equip.titel); return it ? { text: it.name, rarity: it.rarity, glanz: !!it.glanz } : null; }
function best(av){
  const n = normalize(av); let top = null;
  Object.keys(n.equip).forEach(s => { const it = item(n.equip[s]); if(it && s !== 'titel' && (!top || RARITY[it.rarity].n > RARITY[top.rarity].n)) top = it; });
  return top && top.rarity !== 'gewoehnlich' ? { name: top.name, rarity: top.rarity, rarityName: RARITY[top.rarity].name, color: RARITY[top.rarity].color } : null;
}
function setDone(av){
  const ids = Object.values(av.equip).map(id => item(id)).filter(Boolean);
  return Object.keys(SETS).find(s => { const all = Object.keys(ITEMS).filter(k => ITEMS[k].set === s && ITEMS[k].slot !== 'titel'); return all.every(k => ids.some(i => (i.base || i.id) === k)); }) || null;
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
function glasses(it, big, u){
  if(!it) return '';
  if(it.kind === 'visor' || it.kind === 'ski') return glasses2(it, u || 'x-');
  const r = big ? 10 : 7.5, c = it.color;
  if(it.kind === 'rund') return '<g fill="none" stroke="' + c + '" stroke-width="2"><circle cx="40" cy="44" r="' + r + '"/><circle cx="60" cy="44" r="' + r + '"/><path d="M' + (40 + r) + ' 44h' + (20 - 2 * r) + '"/></g>';
  if(it.kind === 'eckig') return '<g fill="none" stroke="' + c + '" stroke-width="2"><rect x="' + (40 - r) + '" y="' + (44 - r * 0.75) + '" width="' + 2 * r + '" height="' + 1.5 * r + '" rx="2"/><rect x="' + (60 - r) + '" y="' + (44 - r * 0.75) + '" width="' + 2 * r + '" height="' + 1.5 * r + '" rx="2"/><path d="M' + (40 + r) + ' 44h' + (20 - 2 * r) + '"/></g>';
  if(it.kind === 'sonne') return '<g fill="' + c + '"><rect x="' + (40 - r - 1) + '" y="39" width="' + (2 * r + 2) + '" height="' + (big ? 13 : 10) + '" rx="4"/><rect x="' + (60 - r - 1) + '" y="39" width="' + (2 * r + 2) + '" height="' + (big ? 13 : 10) + '" rx="4"/><path d="M' + (40 + r) + ' 42h' + (20 - 2 * r) + '" stroke="' + c + '" stroke-width="2"/></g><path d="M34 41l4-1" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>';
  return '<path d="M26 44h48" stroke="#333" stroke-width="2.4"/><rect x="29" y="36" width="42" height="15" rx="6" fill="' + c + '" fill-opacity=".45" stroke="#e5f4ff" stroke-width="1.6"/>';
}
function hat(it, u){
  if(!it) return '';
  { const h = hat2(it, u || 'x-'); if(h) return h; }
  const c = it.color;
  if(it.kind === 'kappe') return '<path d="M27 32C27 16 73 16 73 32z" fill="' + c + '"/><path d="M50 32H84Q86 36 80 37H50z" fill="' + c + '"/><path d="M27 32H73" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/><circle cx="50" cy="17.5" r="2.2" fill="' + c + '" stroke="rgba(0,0,0,.25)"/>';
  if(it.kind === 'muetze') return '<path d="M26 34C26 12 74 12 74 34z" fill="' + c + '"/><rect x="25" y="29" width="50" height="8" rx="4" fill="' + c + '" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 2"/><circle cx="50" cy="11" r="5" fill="#fff"/>';
  if(it.kind === 'helm') return '<path d="M24 33C24 11 76 11 76 33z" fill="' + c + '"/><path d="M19 33H81Q82 37 78 37H22Q18 37 19 33z" fill="' + c + '" stroke="rgba(0,0,0,.25)"/><path d="M50 13V33M40 16V32M60 16V32" stroke="rgba(0,0,0,.18)" stroke-width="2"/>';
  return '';
}
/* ---------- Avatare 2.0 (Auftrag A0–A3): Ganzkörper im 2.5D-Stil ----------
   svg(av, {size:'chip'|'card'|'stage', pose:'idle'|'wave'|'jubel'|'dance'|'sad', style:'soft'|'flat'|'knete', anim, uid, title})
   - chip: nur Kopf im Kreis, ohne Verläufe (24–40 px: Portal-Kopf, Listen, Rangliste)
   - card/stage: ganzer Körper (Chibi, Kopf ≈ halbe Höhe) auf einem isometrischen Sockel in der Avatarfarbe; stage mit grösserem Sockel und Lichtkegel
   - style: soft = 2.5D weich schattiert (Standard, Entscheid A0), flat = Kahoot-nah flach, knete = Spielzeug-Look mit mehr Volumen
   - Verlauf-/Clip-IDs sind je Instanz eindeutig (uid), damit 40 Avatare auf einer Seite nicht kollidieren.
   - anim: CSS-Klassen für Wippen, Blinzeln, Jubelsprung, Siegestanz (CSS in SPSQAvatar.CSS, im Browser einmal eingefügt; prefers-reduced-motion → statisch). */
let SEQ = 0;
const POSES = ['idle', 'wave', 'jubel', 'dance', 'sad'];
const STYLES = ['soft', 'flat', 'knete'];
function mix(hex, f){   // f < 0: dunkler, f > 0: heller
  const n = parseInt(String(hex).slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return '#' + c.map(v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)).map(v => ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2)).join('');
}
// Kopf-Silhouette je Tier (für Schattierung und Randlicht) und Höhe der Nase (Mund darunter)
const HEAD_SIL = { fuchs: [50, 46, 24, 22], baer: [50, 46, 25, 25], eule: [50, 47, 25, 24], wolf: [50, 46, 24, 23], pinguin: [50, 47, 25, 25], biber: [50, 47, 24, 23], steinbock: [50, 46, 22, 24], katze: [50, 47, 24, 22] };
const MOUTH_Y = { fuchs: 60.5, baer: 57, wolf: 58.5, steinbock: 58.5, katze: 57.5 };
const ARMS = { idle: [14, -14], wave: [14, -150], jubel: [152, -152], dance: [140, -35], sad: [5, -5] };
const TAILS = {
  fuchs: a => '<path d="M64 88C80 90 92 78 88 62C86 72 78 76 68 78z" fill="' + a.fur + '"/><path d="M88 62C86 68 84 70 80 72C84 66 86 62 88 62z" fill="' + a.light + '"/>',
  wolf: a => '<path d="M64 88C78 92 90 84 90 70C86 78 78 80 68 80z" fill="' + a.fur + '"/><path d="M90 70C88 75 86 77 83 78C86 74 88 72 90 70z" fill="' + a.light + '"/>',
  katze: a => '<path d="M66 90C80 92 84 80 80 70" stroke="' + a.fur + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
  biber: () => '<ellipse cx="74" cy="98" rx="11" ry="5.5" fill="#5a3a22" transform="rotate(-18 74 98)"/><path d="M66 96l14-4M68 100l14-4" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>',
  baer: a => '<circle cx="67" cy="88" r="4.5" fill="' + a.fur + '"/>',
  steinbock: a => '<ellipse cx="67" cy="84" rx="3" ry="5" fill="' + a.fur + '" transform="rotate(30 67 84)"/>',
  eule: a => '<path d="M44 94l6 8l6-8z" fill="' + mix(a.fur, -0.2) + '"/>',
  pinguin: () => ''
};
function eyes2(a, big, pose){
  if(pose === 'jubel' || pose === 'dance'){   // fröhlich zugekniffen
    const y = 45, w = big ? 7 : 5;
    return '<g class="av-eyes" fill="none" stroke="#1b1b1b" stroke-width="2.4" stroke-linecap="round"><path d="M' + (41 - w) + ' ' + (y + 2) + 'Q41 ' + (y - 4) + ' ' + (41 + w) + ' ' + (y + 2) + '"/><path d="M' + (59 - w) + ' ' + (y + 2) + 'Q59 ' + (y - 4) + ' ' + (59 + w) + ' ' + (y + 2) + '"/></g>';
  }
  const r = big ? 8 : 4.4, p = big ? 3.8 : r;
  let s = '<g class="av-eyes">';
  if(big) s += '<circle cx="40" cy="44" r="' + r + '" fill="#fff"/><circle cx="60" cy="44" r="' + r + '" fill="#fff"/>';
  s += '<circle cx="41" cy="45" r="' + p + '" fill="#1b1b1b"/><circle cx="59" cy="45" r="' + p + '" fill="#1b1b1b"/>'
    + '<circle cx="42.6" cy="43.2" r="' + (p * 0.38) + '" fill="#fff"/><circle cx="60.6" cy="43.2" r="' + (p * 0.38) + '" fill="#fff"/>'
    + '<circle cx="40" cy="46.6" r="' + (p * 0.16) + '" fill="#fff" opacity=".8"/><circle cx="58" cy="46.6" r="' + (p * 0.16) + '" fill="#fff" opacity=".8"/></g>';
  if(pose === 'sad') s += '<path d="M34 36l9 3M66 36l-9 3" stroke="#1b1b1b" stroke-width="1.8" stroke-linecap="round"/><path d="M38 50q-1.6 3.2 0 4.4q1.6-1.2 0-4.4z" fill="#7cc4ff"/>';
  return s;
}
function mouth(animal, pose){
  const y = MOUTH_Y[animal]; if(!y) return '';
  if(pose === 'sad') return '<path d="M45 ' + (y + 2.5) + 'Q50 ' + (y - 1) + ' 55 ' + (y + 2.5) + '" stroke="#1b1b1b" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  if(pose === 'jubel' || pose === 'dance') return '<path d="M44.5 ' + y + 'Q50 ' + (y + 8) + ' 55.5 ' + y + 'z" fill="#7a1f2b"/><path d="M47 ' + (y + 3.6) + 'Q50 ' + (y + 6) + ' 53 ' + (y + 3.6) + '" fill="#e8798b"/>';
  return '<path d="M46 ' + y + 'Q48 ' + (y + 2.4) + ' 50 ' + y + 'Q52 ' + (y + 2.4) + ' 54 ' + y + '" stroke="#1b1b1b" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
}
function torsoDeco(it, u){
  if(!it) return '';
  let s = '';
  if(it.kind === 'hemd') s += '<path d="M44 56L50 66L56 56L54 55L50 61L46 55z" fill="#fff" stroke="#9aa3ab" stroke-width=".5"/><circle cx="50" cy="71" r="1.1" fill="#555"/><circle cx="50" cy="77" r="1.1" fill="#555"/><circle cx="50" cy="83" r="1.1" fill="#555"/>';
  else s += '<path d="M43 56.5Q50 63 57 56.5" stroke="rgba(0,0,0,.28)" stroke-width="1.8" fill="none"/>';
  if(it.motif === 'zahnrad') s += '<g transform="translate(50 74)" fill="#f5c518"><circle r="4.2"/>' + [0, 45, 90, 135].map(r => '<rect x="-1.2" y="-6.3" width="2.4" height="12.6" transform="rotate(' + r + ')"/>').join('') + '<circle r="1.7" fill="' + it.color + '"/></g>';
  if(it.motif === 'blitz') s += '<path d="M52 67L44 77h5l-3 8l9-11h-5z" fill="#f5c518"/>';
  if(it.motif === 'kariert') s += '<g clip-path="url(#' + u + 't)" stroke="rgba(255,255,255,.35)" stroke-width="1.1">' + [33, 39, 45, 55, 61, 67].map(x => '<path d="M' + x + ' 54V96"/>').join('') + [66, 74, 82, 90].map(y => '<path d="M28 ' + y + 'H72"/>').join('') + '</g>';
  return s;
}
function chain2(it, u){
  if(!it) return '';
  const c = it.color === '#f5c518' ? 'url(#' + u + 'g)' : it.color;
  let s = '<path d="M41 56Q50 68 59 56" stroke="' + c + '" stroke-width="1.8" fill="none" stroke-dasharray="2.2 1"/>';
  if(it.motif === 'zahnrad') s += '<g transform="translate(50 66)" fill="' + c + '"><circle r="3.2"/>' + [0, 60, 120].map(r => '<rect x="-.9" y="-4.6" width="1.8" height="9.2" transform="rotate(' + r + ')"/>').join('') + '<circle r="1.2" fill="#333"/></g>';
  else s += '<circle cx="50" cy="65" r="2.6" fill="' + c + '"/>';
  return s + '<circle cx="49" cy="64" r=".9" fill="#fff" opacity=".7"/>';
}
/* ---------- Garderobe 2.0: Zeichnungen der neuen Teile ----------
   Kopf/Brille im Kopf-Koordinatensystem (100×100, wie der Chip), alles andere im Figur-System (100×120). u = Instanz-Präfix für IDs. */
function hat2(it, u){
  const c = it.color, d = mix(c, -0.3), l = mix(c, 0.35);
  switch(it.kind){
    case 'bergmuetze': return '<path d="M25 35C25 9 75 9 75 35z" fill="' + c + '"/><path d="M26 27H74" stroke="#fff" stroke-width="3" stroke-dasharray="4 3"/><rect x="24" y="31" width="52" height="7" rx="3.5" fill="' + d + '"/>'
      + '<path d="M26 36Q22 48 28 52Q32 46 32 38z" fill="' + c + '"/><path d="M74 36Q78 48 72 52Q68 46 68 38z" fill="' + c + '"/><circle cx="50" cy="9" r="5.5" fill="#fff"/><circle cx="48.5" cy="7.5" r="1.6" fill="#e2e8f0"/>';
    case 'lokmuetze': return '<path d="M27 33C26 14 74 14 73 33z" fill="' + c + '"/>' + [32, 38, 44, 50, 56, 62, 68].map(x => '<path d="M' + x + ' 17V33" stroke="#e2e8f0" stroke-width="1.6" opacity=".8"/>').join('')
      + '<path d="M26 33H74" stroke="' + d + '" stroke-width="3"/><path d="M30 34Q50 46 70 34Q66 40 50 41Q34 40 30 34z" fill="#111827"/>';
    case 'giesser': return '<path d="M23 34C23 10 77 10 77 34z" fill="' + c + '"/><path d="M28 18Q50 6 72 18" stroke="' + l + '" stroke-width="2.4" fill="none"/>'
      + '<path d="M19 34H81Q82 38 78 38H22Q18 38 19 34z" fill="' + d + '"/><rect x="27" y="36" width="46" height="17" rx="6" fill="url(#' + u + 'v)" opacity=".86"/><path d="M31 39h12" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/>'
      + '<path d="M22 38Q20 60 28 66L32 52z" fill="#cbd5e1" opacity=".9"/><path d="M78 38Q80 60 72 66L68 52z" fill="#cbd5e1" opacity=".9"/>';
    case 'stirnlampe': return '<path d="M25 31Q50 24 75 31" stroke="#111827" stroke-width="5" fill="none"/><path class="av-beam" d="M50 28L88 6L96 24z" fill="' + c + '" opacity=".28"/>'
      + '<rect x="43" y="22" width="14" height="11" rx="3" fill="#334155"/><circle cx="50" cy="27.5" r="4" fill="' + c + '"/><circle cx="48.8" cy="26.3" r="1.3" fill="#fff"/>';
    case 'kranz': return '<g fill="' + c + '">' + Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.05 + i * 0.1125), x = 50 + 27 * Math.cos(a), y = 38 + 22 * Math.sin(a); return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="5" ry="2.4" transform="rotate(' + (a * 180 / Math.PI + 60).toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>'; }).join('') + '</g>'
      + '<g fill="' + l + '">' + Array.from({ length: 8 }, (_, i) => { const a = Math.PI * (1.1 + i * 0.115), x = 50 + 24 * Math.cos(a), y = 38 + 19 * Math.sin(a); return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="3.6" ry="1.8" transform="rotate(' + (a * 180 / Math.PI - 60).toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>'; }).join('') + '</g><circle cx="50" cy="16" r="2.4" fill="#f5c518"/>';
    case 'deer': return '<path d="M25 34C25 13 75 13 75 34z" fill="' + c + '"/><g stroke="' + d + '" stroke-width="1" opacity=".7">' + [30, 38, 46, 54, 62, 70].map(x => '<path d="M' + x + ' 16V34"/>').join('') + [22, 28].map(y => '<path d="M27 ' + y + 'H73"/>').join('') + '</g>'
      + '<path d="M25 33Q18 34 16 40Q24 40 30 35z" fill="' + c + '"/><path d="M75 33Q82 34 84 40Q76 40 70 35z" fill="' + c + '"/><path d="M46 14q4 -6 8 0" stroke="' + d + '" stroke-width="2" fill="none"/><path d="M40 34Q50 40 60 34" stroke="' + d + '" stroke-width="2" fill="none"/>';
    case 'krone': return '<path d="M27 32L29 12L39 22L50 8L61 22L71 12L73 32z" fill="url(#' + u + 'g)" stroke="#a87a00" stroke-width="1"/><rect x="27" y="29" width="46" height="6" rx="2" fill="url(#' + u + 'g)" stroke="#a87a00" stroke-width="1"/>'
      + '<circle cx="50" cy="20" r="3" fill="#e0457b"/><circle cx="37" cy="25" r="2.2" fill="#38bdf8"/><circle cx="63" cy="25" r="2.2" fill="#22c55e"/><path class="av-spark" d="M66 9l1.2 3l3 1.2l-3 1.2l-1.2 3l-1.2-3l-3-1.2l3-1.2z" fill="#fff"/>';
    case 'kuerbis': return '<ellipse cx="50" cy="24" rx="24" ry="14" fill="' + c + '"/><path d="M38 12Q34 24 38 36M50 10V38M62 12Q66 24 62 36" stroke="' + d + '" stroke-width="1.6" fill="none"/><path d="M50 10Q52 2 58 2" stroke="#3f6212" stroke-width="3" fill="none"/>';
    case 'stroh': return '<ellipse cx="50" cy="31" rx="36" ry="8" fill="' + c + '"/><path d="M32 30C32 12 68 12 68 30z" fill="' + c + '"/><path d="M33 26H67" stroke="#b91c1c" stroke-width="3.5"/><path d="M18 31Q50 40 82 31" stroke="' + d + '" stroke-width="1" fill="none"/>';
  }
  return '';
}
function glasses2(it, u){
  const c = it.color;
  if(it.kind === 'visor') return '<path d="M24 44h52" stroke="#111827" stroke-width="2.4"/><rect x="26" y="36" width="48" height="15" rx="7.5" fill="#0b1220" fill-opacity=".85" stroke="' + c + '" stroke-width="1.4"/>'
    + '<g clip-path="url(#' + u + 'vc)"><rect class="av-led" x="27" y="41.5" width="9" height="4" rx="2" fill="' + c + '"/></g><path d="M30 39h14" stroke="' + c + '" stroke-opacity=".5" stroke-width="1"/>';
  if(it.kind === 'ski') return '<path d="M22 42Q50 36 78 42" stroke="#111827" stroke-width="4" fill="none"/><rect x="27" y="34" width="46" height="19" rx="9" fill="#111827"/><rect x="29" y="36" width="42" height="15" rx="7.5" fill="url(#' + u + 'm)"/>'
    + '<path d="M33 39q6 -2 12 0" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none"/>';
  return '';
}
function torso2(it, u){
  const c = it.color, d = mix(c, -0.3);
  if(it.kind === 'hoodie') return '<path d="M38 57Q50 64 62 57Q60 70 50 72Q40 70 38 57z" fill="' + d + '"/><path d="M38 80H62L60 90H40z" fill="' + d + '"/><path d="M46 60v9M54 60v9" stroke="#e2e8f0" stroke-width="1"/>'
    + '<text x="50" y="78.5" font-family="monospace" font-weight="700" font-size="5.2" text-anchor="middle" fill="#39ff14">IF…THEN</text>';
  if(it.kind === 'schuerze') return '<path d="M38 60Q50 56 62 60L64 96Q50 100 36 96z" fill="' + c + '"/><path d="M38 60L44 54M62 60L56 54" stroke="' + d + '" stroke-width="2"/><path d="M40 74H60" stroke="' + d + '" stroke-width="1.4"/>'
    + '<circle cx="40" cy="62" r="1.1" fill="#d6d3d1"/><circle cx="60" cy="62" r="1.1" fill="#d6d3d1"/><rect x="45" y="78" width="10" height="7" rx="1.5" fill="' + d + '"/>';
  if(it.kind === 'guertel') return '<rect x="31" y="84" width="38" height="5" rx="2" fill="#78350f"/><rect x="47" y="84" width="6" height="5" rx="1" fill="#d6d3d1"/><rect x="34" y="88" width="7" height="8" rx="1.5" fill="#92400e"/>'
    + '<path d="M60 88v9" stroke="#facc15" stroke-width="2.4"/><path d="M60 97v3" stroke="#94a3b8" stroke-width="1.2"/><path d="M64 88l2 9M67 88l-2 9" stroke="#ef4444" stroke-width="1.6"/>';
  if(it.motif === 'verlauf') return '<path d="' + TORSO + '" fill="url(#' + u + 'sun)"/><circle cx="50" cy="76" r="5" fill="#fde047" opacity=".9"/><path d="M38 82H62M40 86H60" stroke="#7c2d12" stroke-width="1.4" opacity=".6"/>';
  return '';
}
function chain3(it, u){
  const c = it.color, strap = '<path d="M41 56Q50 64 59 56" stroke="#94a3b8" stroke-width="1.2" fill="none"/>';
  if(it.kind === 'kabine') return strap + '<g class="av-swing"><path d="M50 61v4" stroke="#334155" stroke-width="1.2"/><rect x="44" y="65" width="12" height="10" rx="2" fill="' + c + '"/><rect x="45.5" y="66.5" width="4" height="4" fill="#bfdbfe"/><rect x="50.5" y="66.5" width="4" height="4" fill="#bfdbfe"/></g>';
  if(it.kind === 'laterne') return strap + '<rect x="45" y="62" width="10" height="13" rx="2" fill="' + c + '"/><path d="M47 62v-2h6v2" stroke="' + c + '" stroke-width="1.2" fill="none"/>'
    + '<circle class="av-lamp-r" cx="50" cy="66" r="2.4" fill="#ef4444"/><circle class="av-lamp-g" cx="50" cy="71.5" r="2.4" fill="#22c55e"/>';
  if(it.kind === 'stahl') return strap + '<circle class="av-glow" cx="50" cy="68" r="8" fill="' + c + '" opacity=".35"/><rect x="45" y="63" width="10" height="9" rx="1.5" fill="url(#' + u + 'h)"/>';
  if(it.kind === 'schal') return '<path d="M38 57Q50 64 62 57L62 61Q50 68 38 61z" fill="' + c + '"/><path d="M56 60l3 18l5-1l-3-17z" fill="' + c + '"/><path d="M40 59v3M45 61v3M50 62v3M55 61v3M57.5 66l4 -1M58.5 71l4 -1" stroke="#fff" stroke-width="1.6"/>';
  return '';
}
// Gegenstand in der Hand: aufrecht im Bild, Ursprung = Hand (gegen die Armdrehung zurückgedreht)
function handItem(it, u){
  const c = it.color, d = mix(c, -0.3);
  switch(it.kind){
    case 'kelle': return '<path d="M0 2V-14" stroke="#1f2937" stroke-width="2.4" stroke-linecap="round"/><circle cx="0" cy="-20" r="7" fill="#fff"/><circle cx="0" cy="-20" r="5.4" fill="' + c + '"/><circle cx="-2" cy="-22" r="1.4" fill="#fff" opacity=".6"/>';
    case 'multimeter': return '<rect x="-6.5" y="-15" width="13" height="18" rx="2.5" fill="' + c + '"/><rect x="-4.5" y="-13" width="9" height="5.5" rx="1" fill="#0f172a"/>'
      + '<text class="av-mm1" x="0" y="-8.8" font-family="monospace" font-size="4.2" text-anchor="middle" fill="#4ade80">24.0</text><text class="av-mm2" x="0" y="-8.8" font-family="monospace" font-size="4.2" text-anchor="middle" fill="#4ade80">23.8</text>'
      + '<circle cx="0" cy="-2.5" r="2.6" fill="#1f2937"/><path d="M-3 3l-4 9M3 3l4 9" stroke="#ef4444" stroke-width="1.2"/><path d="M3 3l4 9" stroke="#111827" stroke-width="1.2"/>';
    case 'pokal': return '<path d="M-6 -16H6Q6 -6 0 -5Q-6 -6 -6 -16z" fill="url(#' + u + 'g)"/><path d="M-6 -14q-4 0 -3 4q1 2 4 2M6 -14q4 0 3 4q-1 2 -4 2" stroke="' + d + '" stroke-width="1.2" fill="none"/><rect x="-1.2" y="-5" width="2.4" height="4" fill="' + d + '"/><rect x="-4.5" y="-1.5" width="9" height="3" rx="1" fill="' + d + '"/>';
    case 'lupe': return '<path d="M0 2L5 -8" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="-14" r="7" fill="#bae6fd" fill-opacity=".45" stroke="#334155" stroke-width="2"/><path d="M5 -17q2 -2 4 -1" stroke="#fff" stroke-width="1.2" fill="none"/>';
    case 'schirm': return '<path d="M0 4V-22" stroke="#334155" stroke-width="1.4"/><path d="M0 4q0 3 -3 3" stroke="#334155" stroke-width="1.4" fill="none"/><path d="M-17 -18Q0 -36 17 -18Q12 -21 8.5 -18Q4 -21 0 -18Q-4 -21 -8.5 -18Q-12 -21 -17 -18z" fill="' + c + '"/>';
    case 'ballon': return '<path d="M0 2Q4 -10 -1 -22" stroke="#94a3b8" stroke-width=".8" fill="none"/><g class="av-float"><ellipse cx="-1" cy="-30" rx="7" ry="8.5" fill="' + c + '"/><path d="M-1 -21.5l-1.5 2h3z" fill="' + c + '"/><ellipse cx="-3.5" cy="-33" rx="1.8" ry="2.6" fill="#fff" opacity=".5"/></g>';
  }
  return '';
}
function back(it, u){
  const c = it.color, d = mix(c, -0.3);
  switch(it.kind){
    case 'greifarm': return '<rect x="29" y="58" width="42" height="30" rx="6" fill="' + d + '"/><g class="av-robo"><path d="M64 60L76 44L86 32" stroke="' + c + '" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="64" cy="60" r="3.6" fill="#334155"/><circle cx="76" cy="44" r="3" fill="#334155"/>'
      + '<path d="M86 32l-2 -7M86 32l6 -4" stroke="#334155" stroke-width="2.4" stroke-linecap="round"/></g>';
    case 'umhang': return '<path d="M35 58Q50 54 65 58L78 104Q50 112 22 104z" fill="' + c + '"/><path d="M22 104Q50 112 78 104" stroke="#f5c518" stroke-width="2" fill="none"/><text x="72" y="96" font-size="6" fill="#f5c518" font-family="monospace">:=</text><text x="22" y="96" font-size="6" fill="#f5c518" font-family="monospace">U</text>';
    case 'kabel': return ['#7c4a24', '#1d4ed8', '#111827', '#64748b', '#16a34a', '#facc15'].map((k, i) => { const x0 = 37 + i * 5.2, x1 = 26 + i * 9.6; return '<path class="av-wave" d="M' + x0 + ' 58Q' + (x0 + (i % 2 ? 4 : -4)) + ' 80 ' + x1 + ' 104" stroke="' + k + '" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="' + (x1 - 1.4) + '" y="103" width="2.8" height="4" fill="#cbd5e1"/>'; }).join('');
    case 'jetpack': return '<rect x="30" y="58" width="12" height="26" rx="5" fill="' + c + '"/><rect x="58" y="58" width="12" height="26" rx="5" fill="' + c + '"/><path class="av-flame" d="M32 85Q36 98 40 85z" fill="#f97316"/><path class="av-flame" d="M60 85Q64 98 68 85z" fill="#f97316"/>';
  }
  return '';
}
function feet(it, dark, part){
  if(!it) return part('ellipse', 'cx="41.5" cy="103" rx="7.5" ry="4.2"', dark) + part('ellipse', 'cx="58.5" cy="103" rx="7.5" ry="4.2"', dark);
  const c = it.color, sole = it.kind === 'sicher' ? '#111827' : '#f8fafc';
  return [41.5, 58.5].map(x => '<ellipse cx="' + x + '" cy="104.6" rx="8.4" ry="3" fill="' + sole + '"/>' + part('ellipse', 'cx="' + x + '" cy="102.6" rx="7.8" ry="4.2"', c)
    + (it.kind === 'sicher' ? '<path d="M' + (x - 7) + ' 103q3 -4 6 -4" stroke="#facc15" stroke-width="2" fill="none"/>' : '<path d="M' + (x - 2) + ' 100.5l3 1.5M' + (x - 3.5) + ' 102l3 1.5" stroke="' + (it.kind === 'neon' ? '#0f172a' : '#94a3b8') + '" stroke-width=".9"/>')
    + (it.kind === 'neon' ? '<ellipse cx="' + x + '" cy="105.5" rx="9" ry="1.6" fill="' + c + '" opacity=".45"/>' : '')).join('');
}
function aura(it){
  const c = it.color;
  switch(it.kind){
    case 'code': return '<g class="av-aura" font-family="monospace" font-weight="700" fill="' + c + '">' + [['{', 14, 40, 0], ['}', 82, 46, .8], [':=', 10, 70, 1.6], ['IF', 80, 74, 2.4], ['}', 20, 22, 3.2], ['{', 74, 20, .4]].map(([t, x, y, dl]) => '<text class="av-rise" style="animation-delay:-' + dl + 's" x="' + x + '" y="' + y + '" font-size="9">' + t + '</text>').join('') + '</g>';
    case 'dampf': return '<g class="av-aura" fill="' + c + '">' + [[22, 92, 6, 0], [78, 90, 7, .7], [16, 72, 5, 1.4], [84, 66, 5.5, 2.1], [30, 50, 4, 2.8]].map(([x, y, r, dl]) => '<circle class="av-rise" style="animation-delay:-' + dl + 's" cx="' + x + '" cy="' + y + '" r="' + r + '" opacity=".75"/>').join('') + '</g>';
    case 'funken': return '<g class="av-aura" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round">' + [[16, 20, 0], [84, 14, .5], [26, 8, 1], [72, 30, 1.5], [12, 46, 2], [88, 52, .8], [50, 4, 1.2]].map(([x, y, dl]) => '<path class="av-fall" style="animation-delay:-' + dl + 's" d="M' + x + ' ' + y + 'l1.5 4"/>').join('') + '</g>';
    case 'champion': return '<g class="av-aura"><circle cx="50" cy="56" r="42" fill="' + c + '" opacity=".18"/><g class="av-spin" stroke="' + c + '" stroke-width="2.4" opacity=".55">' + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return '<path d="M' + (50 + 30 * Math.cos(a)).toFixed(1) + ' ' + (56 + 30 * Math.sin(a)).toFixed(1) + 'L' + (50 + 44 * Math.cos(a)).toFixed(1) + ' ' + (56 + 44 * Math.sin(a)).toFixed(1) + '"/>'; }).join('') + '</g></g>';
    case 'blitz': return '<g class="av-aura" fill="' + c + '">' + [[12, 30, 0], [80, 22, .35], [86, 70, .7], [10, 74, 1.05]].map(([x, y, dl]) => '<path class="av-flash" style="animation-delay:-' + dl + 's" d="M' + x + ' ' + y + 'l-5 9h4l-3 8l8-11h-4l3-6z"/>').join('') + '</g>';
  }
  return '';
}
function plate(it, av, u, stage, style, setKey){
  const rx = stage ? 40 : 34, h = style === 'knete' ? 8 : 5.5, pc = av.color;
  let top = 'url(#' + u + 'p)', side = mix(pc, -0.35), bottom = mix(pc, -0.45), deco = '';
  if(it){
    const c = it.color;
    if(it.kind === 'holz'){ top = c; side = mix(c, -0.35); bottom = mix(c, -0.5); deco = '<path d="M' + (50 - rx + 8) + ' 106Q50 101 ' + (50 + rx - 8) + ' 106M' + (50 - rx + 14) + ' 110Q50 106 ' + (50 + rx - 14) + ' 110" stroke="' + mix(c, -0.3) + '" stroke-width="1" fill="none"/>'; }
    else if(it.kind === 'metall'){ top = 'url(#' + u + 'mt)'; side = '#475569'; bottom = '#334155'; deco = [-0.7, -0.25, 0.25, 0.7].map(f => '<circle cx="' + (50 + f * rx).toFixed(1) + '" cy="' + (107 + (Math.abs(f) > 0.5 ? 2 : 6)) + '" r="1.1" fill="#e2e8f0"/>').join(''); }
    else if(it.kind === 'neon'){ top = '#0b1220'; side = '#111827'; bottom = '#020617'; deco = '<ellipse cx="50" cy="107" rx="' + (rx - 1) + '" ry="8.2" fill="none" stroke="' + c + '" stroke-width="2"/><ellipse cx="50" cy="107" rx="' + (rx + 1) + '" ry="9.6" fill="none" stroke="' + c + '" stroke-width="3" opacity=".3"/>'; }
    else if(it.kind === 'holo'){ top = c; side = mix(c, -0.3); bottom = mix(c, -0.5); deco = '<g class="av-holo"><ellipse cx="50" cy="107" rx="' + rx + '" ry="9" fill="' + c + '" opacity=".25"/>' + [-6, -2, 2, 6].map(y => '<path d="M' + (50 - rx + 6) + ' ' + (107 + y) + 'H' + (50 + rx - 6) + '" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/>').join('') + '<path d="M' + (50 - rx * 0.8) + ' 107L36 70H64L' + (50 + rx * 0.8) + ' 107z" fill="' + c + '" opacity=".12"/></g>'; }
    else if(it.kind === 'gold'){ top = 'url(#' + u + 'g)'; side = '#a87a00'; bottom = '#7c5a00'; deco = '<path class="av-shine" d="M' + (50 - rx + 10) + ' 103l6 0l-4 8l-6 0z" fill="#fff" opacity=".6"/>'; }
    else if(it.kind === 'gipfel'){ deco = '<path d="M' + (50 - rx + 4) + ' 108L28 92L36 98L46 84L56 96L64 90L' + (50 + rx - 4) + ' 108z" fill="#64748b"/><path d="M46 84L41 91L46 89L50 92L52 90z" fill="#fff"/><path d="M28 92L25 97L29 96L32 97z" fill="#fff"/><path d="M64 90L61 95L65 94L67 95z" fill="#fff"/>'
      + '<g class="av-snow" fill="#fff">' + [[14, 10, 0], [30, 2, 1], [62, 8, 2], [84, 4, .5], [46, 0, 1.5], [76, 20, 2.5], [20, 30, 3]].map(([x, y, dl]) => '<circle class="av-fall" style="animation-delay:-' + dl + 's" cx="' + x + '" cy="' + y + '" r="1.3"/>').join('') + '</g>'; top = '#e2e8f0'; side = '#94a3b8'; bottom = '#64748b'; }
  }
  // Set-Bonus: ganze Kollektion getragen
  if(setKey === 'scl') deco += '<ellipse cx="50" cy="107" rx="' + (rx - 5) + '" ry="6.4" fill="none" stroke="#39ff14" stroke-width="1.4" stroke-dasharray="3 2"/>';
  if(setKey === 'kop') deco += '<path d="M' + (50 - rx) + ' 107Q50 95 ' + (50 + rx) + ' 107Q50 101 ' + (50 - rx) + ' 107z" fill="#fff" opacity=".85"/>';
  if(setKey === 'fup') deco += '<g stroke="#6b4423" stroke-width="2.2">' + [-24, -14, -4, 6, 16, 26].map(x => '<path d="M' + (50 + x) + ' 101.5l-2 11"/>').join('') + '</g><path d="M' + (50 - rx + 4) + ' 104.5H' + (50 + rx - 4) + 'M' + (50 - rx + 2) + ' 109.5H' + (50 + rx - 2) + '" stroke="#cbd5e1" stroke-width="1.6"/>';
  if(setKey === 'awl') deco += '<ellipse class="av-glow" cx="50" cy="107" rx="' + rx + '" ry="9" fill="none" stroke="#f97316" stroke-width="2.4"/>';
  if(setKey === 'sensor') deco += '<ellipse cx="50" cy="107" rx="' + (rx - 4) + '" ry="6.8" fill="none" stroke="url(#' + u + 'k)" stroke-width="2"/>';
  return '<ellipse cx="50" cy="' + (107 + h) + '" rx="' + rx + '" ry="9" fill="' + bottom + '"/><rect x="' + (50 - rx) + '" y="107" width="' + 2 * rx + '" height="' + h + '" fill="' + side + '"/>'
    + '<ellipse cx="50" cy="107" rx="' + rx + '" ry="9" fill="' + top + '"/><ellipse cx="50" cy="107" rx="' + (rx - 1.5) + '" ry="7.8" fill="none" stroke="#fff" stroke-opacity=".22"/>' + deco
    + '<ellipse cx="50" cy="105.5" rx="21" ry="4.6" fill="url(#' + u + 'd)"/>';
}
function victory(it, u){
  if(it.kind === 'konfetti') return '<g class="av-aura">' + [[16, 8, '#f472b6', 0], [30, 2, '#38bdf8', .4], [70, 6, '#facc15', .8], [86, 14, '#4ade80', 1.2], [50, 0, '#a78bfa', .2], [22, 24, '#facc15', 1], [80, 30, '#f472b6', .6]].map(([x, y, k, dl], i) => '<rect class="av-fall" style="animation-delay:-' + dl + 's" x="' + x + '" y="' + y + '" width="3" height="1.6" fill="' + k + '" transform="rotate(' + (i * 37) + ' ' + x + ' ' + y + ')"/>').join('') + '</g>';
  if(it.kind === 'pfiff') return '<g class="av-aura"><circle class="av-rise" cx="66" cy="22" r="4" fill="#f1f5f9"/><circle class="av-rise" style="animation-delay:-.6s" cx="72" cy="14" r="5" fill="#f1f5f9"/><text x="76" y="30" font-size="7" font-weight="800" fill="#f8fafc" font-family="system-ui,sans-serif">Pfiff!</text></g>';
  return '';
}

function figure(av, opt){
  const a = ANIMALS[av.animal], it = s => item(av.equip[s]), big = av.animal === 'eule';
  let pose = POSES.includes(opt.pose) ? opt.pose : 'idle';
  const style = STYLES.includes(opt.style) ? opt.style : 'soft', stage = opt.size === 'stage';
  const u = opt.uid || ('av' + (++SEQ).toString(36)) + '-';
  const shade = style !== 'flat', K = style === 'knete' ? 1.5 : 1;
  const ol = style === 'knete' ? c => ' stroke="' + mix(c, -0.35) + '" stroke-width="1.4"' : style === 'flat' ? c => ' stroke="' + mix(c, -0.3) + '" stroke-width="1"' : () => '';
  const ov = shape => shade ? shape.replace(/fill="[^"]*"/, 'fill="url(#' + u + 's)"').replace(/ stroke="[^"]*" stroke-width="[^"]*"/, '') : '';
  const part = (tag, attrs, fill) => { const s = '<' + tag + ' ' + attrs + ' fill="' + fill + '"' + ol(fill) + '/>'; return s + ov(s); };
  const shirt = it('oberteil'), shirtC = shirt ? shirt.color : a.fur, fur = a.fur, dark = mix(fur, -0.3);
  const vic = pose === 'dance' && it('siegerpose');
  const setKey = setDone(av), hatIt = it('kopf'), brIt = it('brille');
  const defs = '<defs>'
    + '<radialGradient id="' + u + 's" cx=".34" cy=".26" r=".9"><stop offset="0" stop-color="#fff" stop-opacity="' + (0.42 * K).toFixed(2) + '"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="' + (0.06 * K).toFixed(2) + '"/><stop offset="1" stop-color="#000" stop-opacity="' + (0.32 * K).toFixed(2) + '"/></radialGradient>'
    + '<radialGradient id="' + u + 'd"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="' + u + 'p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + mix(av.color, 0.35) + '"/><stop offset="1" stop-color="' + mix(av.color, -0.1) + '"/></linearGradient>'
    + '<linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f5c518"/><stop offset="1" stop-color="#a87a00"/></linearGradient>'
    + '<clipPath id="' + u + 't"><path d="' + TORSO + '"/></clipPath>'
    + (stage ? '<radialGradient id="' + u + 'l" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' : '')
    + (brIt && brIt.kind === 'visor' ? '<clipPath id="' + u + 'vc"><rect x="27" y="37" width="46" height="13" rx="6.5"/></clipPath>' : '')
    + (brIt && brIt.kind === 'ski' ? '<linearGradient id="' + u + 'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + mix(brIt.color, 0.45) + '"/><stop offset=".5" stop-color="' + brIt.color + '"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>' : '')
    + (hatIt && hatIt.kind === 'giesser' ? '<linearGradient id="' + u + 'v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient>' : '')
    + '<linearGradient id="' + u + 'h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset=".5" stop-color="' + ((it('kette') || {}).color || '#f97316') + '"/><stop offset="1" stop-color="#991b1b"/></linearGradient>'
    + '<linearGradient id="' + u + 'mt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#64748b"/></linearGradient>'
    + '<linearGradient id="' + u + 'sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset=".55" stop-color="#f97316"/><stop offset="1" stop-color="#7c2d12"/></linearGradient>'
    + '<linearGradient id="' + u + 'k" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c4a24"/><stop offset=".25" stop-color="#1d4ed8"/><stop offset=".5" stop-color="#111827"/><stop offset=".75" stop-color="#64748b"/><stop offset="1" stop-color="#16a34a"/></linearGradient>'
    + '</defs>';
  // Sockel / Kachel, Aura dahinter
  let base = '';
  if(stage) base += '<path d="M28 0H72L96 110H4z" fill="url(#' + u + 'l)"/>';
  if(style === 'flat') base += '<rect x="8" y="10" width="84" height="104" rx="18" fill="' + av.color + '"/><ellipse cx="50" cy="106" rx="24" ry="4.5" fill="' + mix(av.color, -0.25) + '"/>';
  else base += plate(it('sockel'), av, u, stage, style, setKey);
  if(it('aura')) base += aura(it('aura'));
  // Arme (Siegerpose: beide hoch)
  const [aL, aR] = vic ? ARMS.jubel : ARMS[pose];
  const hand = it('hand');
  const arm = (x, ang, side) => '<g class="av-arm av-arm-' + side + '" transform="translate(' + x + ' 60) rotate(' + ang + ')">'
    + part('rect', 'x="-4.6" y="-2" width="9.2" height="24" rx="4.6"', fur) + part('rect', 'x="-5.2" y="-3" width="10.4" height="10" rx="4.4"', shirtC)
    + (side === 'r' && hand ? '<g transform="translate(0 22) rotate(' + (-ang) + ')">' + handItem(hand, u) + '</g>' : '')
    + part('circle', 'cx="0" cy="22" r="5"', mix(a.light, -0.05)) + '</g>';
  const legs = part('rect', 'x="37" y="86" width="11" height="17" rx="5.5"', fur) + part('rect', 'x="52" y="86" width="11" height="17" rx="5.5"', fur)
    + feet(it('schuhe'), av.animal === 'pinguin' ? '#f39c12' : dark, part);
  const ch = it('kette');
  const torso = part('path', 'd="' + TORSO + '"', shirtC) + torsoDeco(shirt, u) + (shirt ? torso2(shirt, u) : '') + (ch && ['kabine', 'laterne', 'stahl', 'schal'].includes(ch.kind) ? chain3(ch, u) : chain2(ch, u));
  const [hx, hy, hrx, hry] = HEAD_SIL[av.animal];
  const rim = shade ? '<path d="M' + (hx - hrx * 0.92).toFixed(1) + ' ' + (hy - hry * 0.2).toFixed(1) + 'A' + hrx + ' ' + hry + ' 0 0 1 ' + (hx - hrx * 0.3).toFixed(1) + ' ' + (hy - hry * 0.94).toFixed(1) + '" stroke="#fff" stroke-opacity="' + (0.4 * K).toFixed(2) + '" stroke-width="2" fill="none" stroke-linecap="round"/>' : '';
  const headOv = shade ? '<ellipse cx="' + hx + '" cy="' + hy + '" rx="' + hrx + '" ry="' + hry + '" fill="url(#' + u + 's)"/>' : '';
  const gloss = style === 'knete' ? '<ellipse cx="' + (hx - 9) + '" cy="' + (hy - 13) + '" rx="6" ry="3" fill="#fff" opacity=".35" transform="rotate(-25 ' + (hx - 9) + ' ' + (hy - 13) + ')"/>' : '';
  const tilt = pose === 'sad' ? 8 : pose === 'dance' ? -6 : -3;
  const whistle = vic && vic.kind === 'pfiff' && MOUTH_Y[av.animal] ? '<rect x="52" y="' + (MOUTH_Y[av.animal] - 1) + '" width="9" height="4" rx="1.5" fill="#cbd5e1" stroke="#64748b" stroke-width=".6"/>' : '';
  const head = '<g class="av-head" transform="translate(50 36) rotate(' + tilt + ') scale(.8) translate(-50 -46)">'
    + HEADS[av.animal](a) + headOv + rim + gloss + eyes2(a, big, pose) + mouth(av.animal, pose) + whistle + glasses(brIt, big, u) + hat(hatIt, u) + '</g>';
  const fig = '<g class="av-fig">' + (it('ruecken') ? back(it('ruecken'), u) : '') + (TAILS[av.animal] || (() => ''))(a) + legs + torso + arm(36, aL, 'l') + arm(64, aR, 'r') + head + '</g>';
  const t = opt.title ? '<title>' + String(opt.title).replace(/[<&>"]/g, '') + '</title>' : '';
  const cls = 'av-svg avf av-' + (stage ? 'stage' : 'card') + ' p-' + pose + ' s-' + style + (opt.anim ? ' av-anim' : '');
  return '<svg class="' + cls + '" viewBox="0 0 100 120" role="img" aria-label="' + a.name + '" xmlns="http://www.w3.org/2000/svg">' + t + defs + base + fig + (vic ? victory(vic, u) : '') + '</svg>';
}
const TORSO = 'M36 56Q50 51 64 56Q72 72 68.5 91Q50 97 31.5 91Q28 72 36 56z';
// Animationen (nur mit opt.anim; im Browser einmal als <style> eingefügt)
const CSS = '.avf .av-fig,.avf .av-arm,.avf .av-head{transform-box:fill-box}'
  + '.avf.av-anim .av-fig{transform-origin:50% 100%}'
  + '.avf.av-anim.p-idle .av-fig,.avf.av-anim.p-wave .av-fig{animation:avfBob 2.6s ease-in-out infinite}'
  + '.avf.av-anim.p-wave .av-arm-r{transform-origin:50% 8%;animation:avfWave 1.2s ease-in-out infinite}'
  + '.avf.av-anim.p-jubel .av-fig{animation:avfJump .8s cubic-bezier(.3,1.6,.5,1) infinite}'
  + '.avf.av-anim.p-dance .av-fig{animation:avfDance 1s ease-in-out infinite}'
  + '.avf.av-anim.p-dance .av-arm-l{transform-origin:50% 8%;animation:avfWave .5s ease-in-out infinite alternate}'
  + '.avf.av-anim.p-sad .av-fig{animation:avfSad 3.4s ease-in-out infinite}'
  + '.avf.av-anim .av-eyes{transform-box:fill-box;transform-origin:center;animation:avfBlink 4.4s infinite}'
  + '@keyframes avfBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}'
  + '@keyframes avfWave{0%,100%{rotate:0deg}50%{rotate:-22deg}}'
  + '@keyframes avfJump{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.06,.92)}50%{transform:translateY(-14px) scale(.96,1.05)}}'
  + '@keyframes avfDance{0%,100%{transform:rotate(-7deg) translateY(0)}25%{transform:rotate(0) translateY(-6px)}50%{transform:rotate(7deg) translateY(0)}75%{transform:rotate(0) translateY(-6px)}}'
  + '@keyframes avfSad{0%,100%{transform:translateY(0)}50%{transform:translateY(1.5px) scale(1,.98)}}'
  + '@keyframes avfBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}'
  // Garderobe 2.0: bewegte Teile (individuelle transform-Eigenschaften, damit SVG-transform-Attribute erhalten bleiben)
  + '.avf.av-anim .av-led{animation:avfLed 1.8s ease-in-out infinite alternate}'
  + '.avf.av-anim .av-beam,.avf.av-anim .av-glow{animation:avfPulse 1.6s ease-in-out infinite}'
  + '.avf.av-anim .av-spark,.avf.av-anim .av-shine{animation:avfTwinkle 2.2s ease-in-out infinite}'
  + '.avf.av-anim .av-swing{transform-box:fill-box;transform-origin:50% 0;animation:avfSwing 2s ease-in-out infinite}'
  + '.avf.av-anim .av-robo{transform-box:view-box;transform-origin:64px 60px;animation:avfRobo 3s ease-in-out infinite}'
  + '.avf.av-anim .av-lamp-r{animation:avfBlinkA 1.4s steps(1) infinite}.avf.av-anim .av-lamp-g{animation:avfBlinkB 1.4s steps(1) infinite}'
  + '.avf.av-anim .av-mm1{animation:avfBlinkA 1.2s steps(1) infinite}.avf.av-anim .av-mm2{animation:avfBlinkB 1.2s steps(1) infinite}'
  + '.avf .av-mm2{opacity:0}.avf.av-anim .av-wave{animation:avfSway 2.4s ease-in-out infinite}'
  + '.avf.av-anim .av-flame{transform-box:fill-box;transform-origin:50% 0;animation:avfFlame .25s ease-in-out infinite alternate}'
  + '.avf.av-anim .av-rise{animation:avfRise 3.2s linear infinite}.avf.av-anim .av-fall{animation:avfFall 2.6s linear infinite}'
  + '.avf.av-anim .av-spin{transform-box:fill-box;transform-origin:center;animation:avfSpin 12s linear infinite}'
  + '.avf.av-anim .av-flash{animation:avfFlash 1.4s steps(2) infinite}.avf.av-anim .av-holo{animation:avfHolo 2.4s steps(6) infinite}'
  + '.avf.av-anim .av-float{animation:avfFloat 2.4s ease-in-out infinite}'
  + '@keyframes avfLed{from{translate:0 0}to{translate:28px 0}}'
  + '@keyframes avfPulse{0%,100%{opacity:.25}50%{opacity:.6}}@keyframes avfTwinkle{0%,100%{opacity:.2}50%{opacity:1}}'
  + '@keyframes avfSwing{0%,100%{rotate:-10deg}50%{rotate:10deg}}@keyframes avfRobo{0%,100%{rotate:0deg}50%{rotate:-12deg}}'
  + '@keyframes avfBlinkA{0%{opacity:1}50%{opacity:0}}@keyframes avfBlinkB{0%{opacity:0}50%{opacity:1}}'
  + '@keyframes avfSway{0%,100%{translate:0 0}50%{translate:2px 0}}@keyframes avfFlame{from{scale:1 .8}to{scale:1 1.2}}'
  + '@keyframes avfRise{0%{translate:0 6px;opacity:0}20%{opacity:.9}100%{translate:0 -22px;opacity:0}}'
  + '@keyframes avfFall{0%{translate:0 -6px;opacity:0}15%{opacity:1}100%{translate:0 30px;opacity:0}}'
  + '@keyframes avfSpin{to{rotate:360deg}}@keyframes avfFlash{0%{opacity:1}50%{opacity:.15}}@keyframes avfHolo{0%,100%{opacity:1}50%{opacity:.55}}'
  + '@keyframes avfFloat{0%,100%{translate:0 0}50%{translate:0 -3px}}'
  // Titel unter dem Namen (Portal/Beamer): Rahmenfarbe der Seltenheit, „Null-Fehler“ mit Glanz
  + '.av-title{display:inline-block;font-size:.72em;font-weight:700;letter-spacing:.02em;padding:1px 7px;border-radius:999px;border:1px solid currentColor;line-height:1.5;white-space:nowrap}'
  + '.av-title.glanz{background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);background-size:250% 100%;animation:avfGlanz 2.6s linear infinite}'
  + '@keyframes avfGlanz{from{background-position:120% 0}to{background-position:-120% 0}}'
  + '@media (prefers-reduced-motion: reduce){.avf.av-anim *,.avf.av-anim .av-fig,.av-title.glanz{animation:none!important}}';
function ensureCSS(){
  if(typeof document === 'undefined' || !document.head || document.getElementById('spsq-av-css')) return;
  const s = document.createElement('style'); s.id = 'spsq-av-css'; s.textContent = CSS; document.head.appendChild(s);
}

/* svg(av, opt): opt.size 'card'/'stage' → Ganzkörper (figure), sonst Kopf im Kreis (chip; Zahl = Pixelgrösse wie bisher) */
function svg(av, opt){
  av = normalize(av); opt = opt || {};
  if(opt.size === 'card' || opt.size === 'stage'){ if(opt.anim) ensureCSS(); return figure(av, opt); }
  const a = ANIMALS[av.animal], it = s => item(av.equip[s]);
  const big = av.animal === 'eule', u = opt.uid || ('av' + (++SEQ).toString(36)) + '-';
  // Chip ohne Verläufe: Verweise der neuen Teile auf flache Farben
  const flat = h => h.replace(/url\(#x-g\)/g, '#f5c518').replace(/url\(#x-v\)/g, '#f59e0b').replace(/url\(#x-m\)/g, (it('brille') || {}).color || '#f97316').replace(/ clip-path="url\(#x-vc\)"/g, '');
  const top1 = best(av), ring = top1 ? '<circle cx="50" cy="50" r="47" fill="none" stroke="' + top1.color + '" stroke-width="6"/>' : '';
  const t = opt.title ? '<title>' + String(opt.title).replace(/[<&>"]/g, '') + '</title>' : '';
  const px = typeof opt.size === 'number' ? opt.size : 0;
  return '<svg class="av-svg av-chip" viewBox="0 0 100 100" role="img" aria-label="' + a.name + '"' + (px ? ' width="' + px + '" height="' + px + '"' : '') + ' xmlns="http://www.w3.org/2000/svg">' + t
    + '<defs><clipPath id="' + u + 'c"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#' + u + 'c)">'
    + '<circle cx="50" cy="50" r="50" fill="' + av.color + '"/>'
    + top(it('oberteil')) + chain(it('kette')) + HEADS[av.animal](a) + eyes(a.fur, big) + flat(glasses(it('brille'), big) + hat(it('kopf')))
    + '</g>' + ring + '</svg>';
}

/* ---------- Coins ---------- */
// progress: {quest: state}; meta: {quest: {taskId: {boss, final}}}; ledger: [{amount, source, ref}]
const RULES = { star: [10, 15, 20], revealed: 3, boss: 40, final: 100, theory: 10, speedrun: { 1: 60, 2: 40, 3: 25, solved: 10, sudden: 80, teilnahme: 5 }, cert: { pass: 300, distinction: 500 } };
function earned(progress, meta){
  const out = { tasks: 0, bosses: 0, finals: 0, theory: 0, total: 0, n: 0, bossN: 0, finalN: 0, quests: 0, q: {}, clean: {}, finalQ: {}, theoryQ: {} };
  Object.keys(progress || {}).forEach(q => {
    const st = progress[q] || {}, m = (meta && meta[q]) || {};
    const done = st.doneTasks || {}; let any = false;
    out.q[q] = 0; out.clean[q] = 0;
    Object.keys(done).forEach(id => {
      const d = done[id] || {}; any = true; out.n++; out.q[q]++; if(!d.revealed) out.clean[q]++;
      out.tasks += d.revealed ? RULES.revealed : RULES.star[Math.max(1, Math.min(3, d.stars || 1)) - 1];
      const f = m[id] || {};
      if(f.final && !d.revealed){ out.finals += RULES.final; out.finalN++; if(f.ch !== 15) out.finalQ[q] = id; }   // Final Boss: nur der Final-Zuschlag
      else if(f.boss && !d.revealed){ out.bosses += RULES.boss; out.bossN++; }
    });
    // Sensorwerkstatt: nur die 30 angezeigten Aufgaben zählen für die Kollektion
    if(m.$ && m.$.shown){ out.q[q] = m.$.shown.filter(id => done[id]).length; out.clean[q] = m.$.shown.filter(id => done[id] && !done[id].revealed).length; }
    out.theoryQ[q] = Object.keys(st.doneTheory || {}).length;
    out.theory += out.theoryQ[q] * RULES.theory;
    if(any) out.quests++;
  });
  out.total = out.tasks + out.bosses + out.finals + out.theory;
  return out;
}
// Freischalt-Kontext aus drei Quellen: synchronisierter Fortschritt (e), gültige Zertifikate (certs [{quest, level}]) und Challenge-Statistik (stats, serverseitig, 12.4)
function unlockCtx(e, ledger, certs, stats, meta){
  const L = ledger || [], Z = certs || [], S = stats || {}, sm = meta && meta.sensor && meta.sensor.$;
  const sensorN = sm ? sm.shown.length : 30;
  return { final: e.finalN, bosses: e.bossN, quests: e.quests,
    podium: Math.max(L.filter(x => x.source === 'speedrun' && /^r[123]:/.test(x.ref || '')).length, S.podium || 0),
    certs: Z.length, profiCerts: new Set(Z.filter(z => z.level === 'profi').map(z => z.quest)).size, certList: Z.map(z => ({ quest: z.quest, level: z.level })),
    questSolved: e.q || {}, questFinal: e.finalQ || {}, finals3: Object.keys(e.finalQ || {}).length,
    sensorAll: (e.q && e.q.sensor || 0) >= sensorN && (!sm || (e.theoryQ.sensor || 0) >= sm.theory) ? 1 : 0,
    sensorClean: (e.clean && e.clean.sensor || 0) >= sensorN ? 1 : 0,
    challenges: S.challenges || 0, wins: S.wins || 0, sdWins: S.sdWins || 0, bugFixed: S.bugFixed || 0, flawless: S.flawless || 0 };
}
// Fortschritt je Bedingung: [{text, have, need, ok}] (Fortschrittsbalken in der Garderobe, Fehlermeldung beim Kauf)
function unlockProgress(id, ctx){
  const it = item(id); if(!it || !it.unlock) return [];
  ctx = ctx || {}; const out = [];
  Object.keys(it.unlock).forEach(k => {
    const v = it.unlock[k], txt = UNLOCK_TEXT[k] ? UNLOCK_TEXT[k](v) : k;
    if(k === 'questSolved') Object.keys(v).forEach(q => { const have = (ctx.questSolved || {})[q] || 0; out.push({ text: UNLOCK_TEXT.questSolved({ [q]: v[q] }), have: Math.min(have, v[q]), need: v[q], ok: have >= v[q], unit: QN[q] + '-Aufgaben' }); });
    else if(k === 'questFinal') out.push({ text: txt, have: (ctx.questFinal || {})[v] ? 1 : 0, need: 1, ok: !!(ctx.questFinal || {})[v] });
    else if(k === 'cert'){ const ok = (ctx.certList || []).some(z => z.quest === v.quest && z.level === v.level); out.push({ text: txt, have: ok ? 1 : 0, need: 1, ok }); }
    else { const have = ctx[k] || 0; out.push({ text: txt, have: Math.min(have, v), need: v, ok: have >= v }); }
  });
  return out;
}
function isUnlocked(id, ctx){ const it = item(id); return !!it && unlockProgress(id, ctx).every(p => p.ok); }
function unlockText(id, ctx){
  const p = unlockProgress(id, ctx); if(!p.length) return '';
  return p.map(x => x.text + (ctx && x.need > 1 && !x.ok ? ' (' + x.have + '/' + x.need + ')' : '')).join(', ');
}
// Besitz: frei (Preis 0 ohne Bedingung), „nur verdienbar“ (Bedingung erfüllt) oder gekauft (coin_ledger)
function owns(id, owned, ctx){
  const it = item(id); if(!it) return false;
  if(it.price === 0 && !it.unlock) return true;
  if(it.earnOnly) return isUnlocked(id, ctx);
  return (owned || []).includes(id);
}
function balance(progress, meta, ledger, certs, stats){
  const e = earned(progress, meta), L = ledger || [];
  const bonus = L.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0), spent = -L.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0);
  return { earned: e, speedrun: bonus, spent, balance: e.total + bonus - spent, owned: L.filter(x => x.source === 'kauf').map(x => x.ref), ctx: unlockCtx(e, L, certs, stats, meta) };
}
// Wirtschaft (A4): Katalogsumme je Stufe und Coins je Quest (Obergrenze: alle Aufgaben 3★, alle Bosse, Final Bosse, Theorien)
function economy(meta){
  const sum = {}; let total = 0;
  Object.keys(ITEMS).forEach(id => { const it = ITEMS[id]; if(it.earnOnly || it.shop) return; const p = it.price + (it.alt ? it.alt.length * Math.ceil(it.price * 1.3 / 10) * 10 : 0); sum[it.rarity] = (sum[it.rarity] || 0) + it.price; total += it.price; sum.varianten = (sum.varianten || 0) + (p - it.price); });
  const perQuest = {};
  Object.keys(meta || {}).forEach(q => { const m = meta[q], ids = Object.keys(m).filter(k => k !== '$'); const n = m.$ && m.$.tasks || 150;
    perQuest[q] = n * RULES.star[2] + ids.filter(k => m[k].boss).length * RULES.boss + ids.filter(k => m[k].final).length * RULES.final + (m.$ && m.$.theoryAll || 30) * RULES.theory; });
  return { byRarity: sum, total, perQuest };
}
const API = { ANIMALS, COLORS, ITEMS, SLOTS, RARITY, SETS, DEFAULT, RULES, POSES, STYLES, CSS, ensureCSS, normalize, svg, item, variants, onSale, shopSetOf, title, best, setDone,
  earned, unlockCtx, unlockProgress, isUnlocked, unlockText, owns, balance, economy };
root.SPSQAvatar = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

export const Avatar = globalThis.SPSQAvatar;
export const AVATAR_META = {"scl":{"c1_boss":{"boss":true,"final":false,"ch":1},"r2t10":{"boss":true,"final":false,"ch":2},"c3_boss":{"boss":true,"final":false,"ch":3},"c4_boss":{"boss":true,"final":false,"ch":4},"r3t10":{"boss":true,"final":false,"ch":5},"r4t10":{"boss":true,"final":false,"ch":6},"c7_boss":{"boss":true,"final":false,"ch":7},"c8_boss":{"boss":true,"final":false,"ch":8},"r5t10":{"boss":true,"final":false,"ch":9},"final_boss":{"boss":true,"final":true,"ch":10},"p11_boss":{"boss":true,"final":false,"ch":11},"p12_boss":{"boss":true,"final":false,"ch":12},"p13_boss":{"boss":true,"final":false,"ch":13},"p14_boss":{"boss":true,"final":false,"ch":14},"p15_final":{"boss":true,"final":true,"ch":15},"$":{"tasks":150,"theoryAll":30}},"kop":{"k1_boss":{"boss":true,"final":false,"ch":1},"k2_boss":{"boss":true,"final":false,"ch":2},"k3_boss":{"boss":true,"final":false,"ch":3},"k4_boss":{"boss":true,"final":false,"ch":4},"k5_boss":{"boss":true,"final":false,"ch":5},"k6_boss":{"boss":true,"final":false,"ch":6},"k7_boss":{"boss":true,"final":false,"ch":7},"k8_boss":{"boss":true,"final":false,"ch":8},"k9_boss":{"boss":true,"final":false,"ch":9},"k10_final":{"boss":true,"final":true,"ch":10},"k11_boss":{"boss":true,"final":false,"ch":11},"k12_boss":{"boss":true,"final":false,"ch":12},"k13_boss":{"boss":true,"final":false,"ch":13},"k14_boss":{"boss":true,"final":false,"ch":14},"k15_final":{"boss":true,"final":true,"ch":15},"$":{"tasks":150,"theoryAll":30}},"fup":{"f1_boss":{"boss":true,"final":false,"ch":1},"f2_boss":{"boss":true,"final":false,"ch":2},"f3_boss":{"boss":true,"final":false,"ch":3},"f4_boss":{"boss":true,"final":false,"ch":4},"f5_boss":{"boss":true,"final":false,"ch":5},"f6_boss":{"boss":true,"final":false,"ch":6},"f7_boss":{"boss":true,"final":false,"ch":7},"f8_boss":{"boss":true,"final":false,"ch":8},"f9_boss":{"boss":true,"final":false,"ch":9},"f10_final":{"boss":true,"final":true,"ch":10},"fp11_boss":{"boss":true,"final":false,"ch":11},"fp12_boss":{"boss":true,"final":false,"ch":12},"fp13_boss":{"boss":true,"final":false,"ch":13},"fp14_boss":{"boss":true,"final":false,"ch":14},"fp15_final":{"boss":true,"final":true,"ch":15},"$":{"tasks":150,"theoryAll":30}},"awl":{"a1_boss":{"boss":true,"final":false,"ch":1},"a2_boss":{"boss":true,"final":false,"ch":2},"a3_boss":{"boss":true,"final":false,"ch":3},"a4_boss":{"boss":true,"final":false,"ch":4},"a5_boss":{"boss":true,"final":false,"ch":5},"a6_boss":{"boss":true,"final":false,"ch":6},"a7_boss":{"boss":true,"final":false,"ch":7},"a8_boss":{"boss":true,"final":false,"ch":8},"a9_boss":{"boss":true,"final":false,"ch":9},"a10_final":{"boss":true,"final":true,"ch":10},"ap11_boss":{"boss":true,"final":false,"ch":11},"ap12_boss":{"boss":true,"final":false,"ch":12},"ap13_boss":{"boss":true,"final":false,"ch":13},"ap14_boss":{"boss":true,"final":false,"ch":14},"ap15_final":{"boss":true,"final":true,"ch":15},"$":{"tasks":150,"theoryAll":30}},"sensor":{"w1_boss_sortierstrecke":{"boss":true,"final":false,"ch":1},"w2_boss_umbau":{"boss":true,"final":false,"ch":2},"w3_boss_sieben":{"boss":true,"final":false,"ch":3},"w4_boss_tank":{"boss":true,"final":false,"ch":4},"w5_boss_hmi":{"boss":true,"final":false,"ch":5},"w6_finale":{"boss":false,"final":true,"ch":6},"$":{"tasks":30,"theoryAll":12,"shown":["w1_b1_anschliessen","w1_start_stopp","w1_variablentabelle","w1_band_selbsthaltung","w1_boss_sortierstrecke","w2_pnp_messen","w2_1m_cpu","w2_teilezaehler","w2_fehler_npn_pnp","w2_boss_umbau","w3_schaltabstand","w3_b3_teach","w3_materialsortierung","w3_fehler_alu","w3_boss_sieben","w4_b10_anschliessen","w4_b11_2leiter","w4_loopcheck","w4_rohwert_status","w4_boss_tank","w5_von_hand","w5_druck","w5_pumpe_aq","w5_fehler_0_20","w5_boss_hmi","w6_heizung_hysterese","w6_zweipunkt","w6_plausi","w6_fehler_b8","w6_finale"],"theory":12}}};
