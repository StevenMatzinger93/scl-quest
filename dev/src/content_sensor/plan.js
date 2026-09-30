/* Sensorwerkstatt: Auswahl und Format v2 der 30 angezeigten Aufgaben (docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md 5.2).
   Alle anderen Aufgaben bekommen hidden:true: nicht sichtbar, aber per ID weiter auflösbar (Spielstände, Leitstand, Live-Challenge,
   Störungsjagd sb_<Aufgabe>). NIE löschen. Aufgaben tauschen: Eintrag hier ändern, danach `node validate_sensor.js`.
   Felder: phase = Schwerpunkt ('verbinden'|'signale'|'programm'|'laufen'|'alle'|[Phasen]); tools = nur 'multimeter'/'kalibrator'
   (erscheinen nur in dieser Aufgabe); scene = sichtbare Anlage; prefill wird aus dem Schwerpunkt abgeleitet, wenn nicht gesetzt. */
(function(root){
const C = root.SCL_CONTENT;
const S = 'sortierstrecke', T = 'tank', M = 'multimeter', K = 'kalibrator';
const PLAN = [
  // Modul 1 – Signale und digitale Sensoren (Start: sofort verbinden)
  ['w1_b1_anschliessen',   { phase: 'verbinden', scene: S }],
  ['w1_start_stopp',       { phase: 'verbinden', scene: S }],
  ['w1_variablentabelle',  { phase: 'signale',   scene: S }],
  ['w1_band_selbsthaltung',{ phase: 'programm',  scene: S }],
  ['w1_boss_sortierstrecke',{ phase: 'alle',     scene: S }],
  // Modul 2 – PNP und NPN
  ['w2_pnp_messen',        { phase: 'laufen',    scene: S, tools: [M] }],
  ['w2_1m_cpu',            { phase: 'verbinden', scene: S }],
  ['w2_teilezaehler',      { phase: 'programm',  scene: S }],
  ['w2_fehler_npn_pnp',    { phase: 'verbinden', scene: S }],
  ['w2_boss_umbau',        { phase: 'alle',      scene: S }],
  // Modul 3 – Sensortypen im Einsatz (Abstand, Poti und Teach-in als Regler, Annahme A1)
  ['w3_schaltabstand',     { phase: 'laufen',    scene: S }],
  ['w3_b3_teach',          { phase: 'laufen',    scene: S }],
  ['w3_materialsortierung',{ phase: 'programm',  scene: S }],
  ['w3_fehler_alu',        { phase: 'laufen',    scene: S }],
  ['w3_boss_sieben',       { phase: 'alle',      scene: S }],
  // Modul 4 – Analogsignale
  ['w4_b10_anschliessen',  { phase: 'verbinden', scene: T, tools: [M] }],
  ['w4_b11_2leiter',       { phase: ['verbinden', 'signale'], scene: T, tools: [M] }],
  ['w4_loopcheck',         { phase: 'laufen',    scene: T, tools: [K] }],
  ['w4_rohwert_status',    { phase: 'programm',  scene: T }],
  ['w4_boss_tank',         { phase: 'alle',      scene: T, tools: [M, K] }],
  // Modul 5 – NORM_X und SCALE_X
  ['w5_von_hand',          { phase: 'signale',   scene: T }],
  ['w5_druck',             { phase: 'programm',  scene: T }],
  ['w5_pumpe_aq',          { phase: 'programm',  scene: T, tools: [M] }],
  ['w5_fehler_0_20',       { phase: 'signale',   scene: T }],
  ['w5_boss_hmi',          { phase: 'alle',      scene: T }],
  // Modul 6 – Messwerte sicher verarbeiten
  ['w6_heizung_hysterese', { phase: 'programm',  scene: T }],
  ['w6_zweipunkt',         { phase: 'programm',  scene: T }],
  ['w6_plausi',            { phase: 'programm',  scene: T }],
  ['w6_fehler_b8',         { phase: 'verbinden', scene: T }],
  ['w6_finale',            { phase: 'alle',      scene: T, tools: [M, K] }]
];
const byId = {}; PLAN.forEach(([id, o]) => { byId[id] = o; });
const seen = {};
C.tasks.filter(t => t.workshop).sort((a, b) => a.level - b.level || a.no - b.no).forEach(t => {
  const o = byId[t.id];
  if(!o){ t.hidden = true; t.core = false; return; }
  Object.assign(t, { core: true, hidden: false, lang: ['scl', 'fup'], tools: [], prefill: null }, o);
  seen[t.level] = (seen[t.level] || 0) + 1; t.dispNo = seen[t.level];   // angezeigte Nummer im Modul (1–5), t.no bleibt die alte Nummer
});
root.SW_PLAN = PLAN;
})(typeof window !== 'undefined' ? window : globalThis);
