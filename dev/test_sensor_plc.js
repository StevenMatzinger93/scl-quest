// Sensorwerkstatt: SPS der Werkstatt (sensor_plc.js, Paket S6) — Variablentabelle, Vorverarbeitung, Laden/RUN, Prozessabbild, Diagnose
global.window = global;
require('./src/engine.js'); require('./src/kop.js');
const M = require('./src/sensor_model.js'), W = require('./src/wiring.js'), P = require('./src/sensor_plc.js');
let pass = 0, failN = 0; const fails = [];
const t = (name, fn) => { let ok; try { ok = fn(); } catch(e){ ok = false; name += ' — ' + e.message; } if(ok === false){ failN++; fails.push(name); } else pass++; };
const eq = (a, b) => { if(JSON.stringify(a) !== JSON.stringify(b)) throw new Error(JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); return true; };
const tags = () => JSON.parse(JSON.stringify(P.TAGS_WERKSTATT));

// Variablentabelle
t('Grundbelegung Werkstatt ist fehlerfrei', () => P.checkTags(P.TAGS_WERKSTATT).ok);
t('Doppelte Adresse, doppelter Name, Typ ↔ Adresse, ungültige Adresse', () => {
  const tg = tags().concat([{ name: 'Metall2', type: 'Bool', addr: '%I0.4' }, { name: 'start', type: 'Bool', addr: '%M0.0' }, { name: 'Wert', type: 'Int', addr: '%M1.0' }, { name: 'X', type: 'Bool', addr: '%Z1' }]);
  const r = P.checkTags(tg), txt = r.errors.map(e => e.text).join('\n');
  return !r.ok && /doppelt belegt/.test(txt) && /Name „start“ ist doppelt/.test(txt) && /passt nicht zur Adresse/.test(txt) && /ungültig/.test(txt);
});
t('Überlappung %MW10 / %MD10 → Warnung', () => { const r = P.checkTags([{ name: 'A', type: 'Int', addr: '%MW10' }, { name: 'B', type: 'Real', addr: '%MD10' }]); return r.ok && r.warnings.some(w => /überlappt/.test(w.text)); });
// Vorverarbeitung
t('"Name" und %Adresse werden zur selben Variablen', () => {
  const r = P.preprocess('"Band" := %I0.4 AND "Haube_Zu"; // "Kommentar" %I9.9\n%Q0.6 := \'%I0.0\' = \'\';', P.TAGS_WERKSTATT);
  return !r.errors.length && /^Band := Ind_Metall AND Haube_Zu; \/\/ "Kommentar" %I9\.9\nLampe_Gruen := '%I0\.0'/.test(r.src);
});
t('Unbekannte Variable → Fehler mit Zeile; freie Adresse → Hilfsvariable', () => {
  const r = P.preprocess('\n"Gibtsnicht" := TRUE;\n%M5.0 := TRUE;', P.TAGS_WERKSTATT);
  return r.errors.length === 1 && /Zeile 2/.test(r.errors[0].text) && r.extra.some(x => x.name === '_a_M5_0' && x.type === 'Bool');
});
// CPU: Laden, Starten, Zyklus
const SCL = '"Band" := "Start" AND "Haube_Zu";\n"Lampe_Rot" := NOT "Haube_Zu";\n%QW112 := %IW96;';
t('Übersetzen mit Fehler: Zeilennummer bleibt erhalten', () => { const c = P.Cpu(); const r = c.compile('"Band" := TRUE;\n"Band" := 5 +;', 'scl', P.TAGS_WERKSTATT); return !r.ok && r.errors[0].line === 2; });
t('Laden → STOP, Starten → RUN, Diagnosepuffer', () => {
  const c = P.Cpu(); const l = c.download({ source: SCL, lang: 'scl', tags: P.TAGS_WERKSTATT, hw: P.newHw() });
  const stop = c.mode, s = c.start();
  return l.ok && stop === 'STOP' && s.ok && c.mode === 'RUN' && /STOP → RUN/.test(c.diag[0].text) && /Laden in Gerät/.test(c.diag[1].text);
});
t('Zyklus: Eingänge → Programm → Ausgänge; STOP → Ausgänge 0 und Ersatzwert', () => {
  const c = P.Cpu(); c.download({ source: SCL, lang: 'scl', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); c.start();
  const a = c.cycle(0.05, { 'I0.0': true, 'I1.3': true, IW96: 13824 }).out;
  const b = c.cycle(0.05, { 'I0.0': true, 'I1.3': false, IW96: 13824 }).out;
  c.stop(); const s = c.cycle(0.05, { 'I0.0': true, 'I1.3': true }).out;
  return a['Q0.0'] === true && a['Q0.7'] === false && a.QW112 === 13824 && b['Q0.0'] === false && b['Q0.7'] === true && s['Q0.0'] === false && s.QW112 === 0;
});
t('Beobachten: Name, "Name", Adresse und Rohwert', () => {
  const c = P.Cpu(); c.download({ source: SCL, lang: 'scl', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); c.start();
  c.cycle(0.05, { 'I0.0': true, 'I1.3': true, IW96: 5530 });
  return c.read('Band') === true && c.read('"Band"') === true && c.read('%Q0.0') === true && c.read('%IW96') === 5530 && c.read('Druck_Roh') === 5530 && P.fmt(5530, 'hex') === '16#159A';
});
t('Konfigurationsänderung erfordert Laden', () => { const c = P.Cpu(), hw = P.newHw(); c.download({ source: SCL, lang: 'scl', tags: P.TAGS_WERKSTATT, hw }); const before = c.needsLoad(hw); hw.ai.CH0.range = '0..20mA'; return !before && c.needsLoad(hw); });
t('Laufzeitfehler (Endlosschleife) → STOP mit Eintrag', () => {
  const c = P.Cpu(); c.download({ source: 'WHILE TRUE DO\n  "Band" := NOT "Band";\nEND_WHILE;', lang: 'scl', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); c.start();
  const r = c.cycle(0.05, {}); return c.mode === 'STOP' && !!r.error && /RUN → STOP/.test(c.diag[0].text);
});
t('NORM_X/SCALE_X mit Rohwert und Merker-Real', () => {
  const tg = tags().concat([{ name: 'Druck_mbar', type: 'Real', addr: '%MD20' }]);
  const c = P.Cpu(); const l = c.download({ source: '"Druck_mbar" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648), MAX := 100.0);', lang: 'scl', tags: tg, hw: P.newHw() }); c.start();
  c.cycle(0.05, { IW96: 13824 }); return l.ok && Math.abs(c.read('Druck_mbar') - 50) < 1e-6 && Math.abs(c.read('%MD20') - 50) < 1e-6;
});
t('KOP-Netzwerk mit "Name" und %Adresse', () => {
  const c = P.Cpu(); const l = c.download({ source: 'NETWORK Band\n"Start" AND %I1.3 => "Band";', lang: 'kop', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); c.start();
  const o = c.cycle(0.05, { 'I0.0': true, 'I1.3': true }).out; return l.ok && o['Q0.0'] === true;
});
t('FUP-Netzwerk (gleiches Netzwerkformat)', () => {
  const c = P.Cpu(); const l = c.download({ source: 'NETWORK Lampe\nNOT "Haube_Zu" => "Lampe_Rot";', lang: 'fup', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); c.start();
  return l.ok && c.cycle(0.05, { 'I1.3': false }).out['Q0.7'] === true;
});
// Prozessabbild aus Verdrahtung
const base = () => { const st = W.newState({ level: 'werkstatt', bridges: ['QB_X2_LP', 'QB_X2_M'] }); W.addWire(st, 'A1:1M', 'X1:M2', { ferrule: true }); return st; };
const b1 = st => { W.addWire(st, 'B1:BN', 'X2:5.L+', { ferrule: true }); W.addWire(st, 'B1:BU', 'X2:5.M', { ferrule: true }); W.addWire(st, 'B1:BK', 'X2:5.S', { ferrule: true }); W.addWire(st, 'X2:5.S', 'A1:DIa.4', { ferrule: true }); return st; };
const b11 = st => { W.addWire(st, 'B11:+', 'X1:L+7', { ferrule: true }); W.addWire(st, 'B11:-', 'X3:1.a', { ferrule: true }); W.addWire(st, 'X3:1.b', 'A2:0+', { ferrule: true }); W.addWire(st, 'A2:0-', 'X1:M7', { ferrule: true }); return st; };
t('Prozessabbild: DI aus der Verdrahtung, IW96 aus dem 2-Leiter-Transmitter (mit Schirm ± Rauschen klein)', () => {
  const st = b11(b1(base())); st.mainSwitch = true; st.shields = { B11: true };
  const r = P.ioImage({ state: st, world: { B1: { active: true } }, phys: { B11: 50 }, hw: P.newHw(), t: 1 });
  return r.io['I0.4'] === true && Math.abs(r.io.IW96 - 13824) <= 20 && !r.diag.some(d => d.ch === 'CH0') && r.diag.some(d => d.ch === 'CH1');
});
t('Ohne Schirm: Rauschen ±1–2 % sichtbar', () => {
  const st = b11(base()); st.mainSwitch = true;
  const vals = []; for(let i = 0; i < 40; i++) vals.push(P.ioImage({ state: st, phys: { B11: 50 }, hw: P.newHw(), t: i * 0.05 }).io.IW96);
  const spread = Math.max(...vals) - Math.min(...vals); return spread > 200 && spread < 1200;
});
t('Trennmesser offen → Drahtbruch 32767, Diagnose kommend/gehend', () => {
  const st = b11(base()); st.mainSwitch = true; st.shields = { B11: true }; st.knives = { 'X3:1': true };
  const c = P.Cpu(); c.download({ source: SCL, lang: 'scl', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); c.start();
  const r = P.ioImage({ state: st, phys: { B11: 50 }, hw: P.newHw(), t: 0 }); c.cycle(0.05, r.io, r.diag);
  st.knives = {}; const r2 = P.ioImage({ state: st, phys: { B11: 50 }, hw: P.newHw(), t: 0.05 }); c.cycle(0.05, r2.io, r2.diag);
  return r.io.IW96 === 32767 && /Steckplatz 2, Kanal 0: Drahtbruch/.test(r.diag[0].text) && c.diag.some(d => /kommend/.test(d.text)) && /gehend/.test(c.diag[0].text);
});
t('Falsche Konfiguration 0–20 mA: leerer Tank (4 mA) → 5530', () => {
  const st = base(); st.mainSwitch = true; st.calib = { on: true, channel: 'CH3', mA: 4 };
  const hw = P.newHw(); hw.ai.CH3 = { type: 'I_4W', range: '0..20mA', smooth: 'keine', diag: {} };
  return P.ioImage({ state: st, hw, t: 0 }).io.IW102 === 5530;
});
t('Kanal deaktiviert → 0; Glättung stark dämpft Sprung', () => {
  const st = base(); st.mainSwitch = true; st.calib = { on: true, channel: 'CH3', mA: 20 };
  const hw = P.newHw(); const off = P.ioImage({ state: st, hw, t: 0 }).io.IW102;
  hw.ai.CH3 = { type: 'I_4W', range: '4..20mA', smooth: 'stark', diag: {} };
  const r = P.ioImage({ state: st, hw, t: 0, prev: { IW102: 0 } }).io.IW102;
  return off === 0 && r > 0 && r < 2000;
});
t('Sitzung: Spannungsausfall → STOP', () => {
  const st = b1(base()); st.mainSwitch = true;
  const s = P.session({ state: () => st, world: () => ({ B1: { active: true } }) });
  s.cpu.download({ source: '"Band" := "Ind_Metall";', lang: 'scl', tags: P.TAGS_WERKSTATT, hw: P.newHw() }); s.cpu.start();
  const a = s.step().out['Q0.0']; st.mainSwitch = false; s.step();
  return a === true && s.cpu.mode === 'STOP' && s.cpu.diag.some(d => /RUN → STOP \(Spannungsausfall\)/.test(d.text));
});

console.log('SPS-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen');
if(failN){ fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
