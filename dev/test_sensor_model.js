// Unit-Tests Sensorwerkstatt-Modell (docs/SENSORWERKSTATT_PLAN.md Teil 9): node test_sensor_model.js
const M = require('./src/sensor_model.js');
let pass = 0, failN = 0; const fails = [];
function t(name, fn){ try{ const r = fn(); if(r === false) throw new Error('false'); pass++; }catch(e){ failN++; fails.push(name + ': ' + e.message); } }
function eq(a, b, msg){ if(JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a)); }
function near(a, b, tol, msg){ if(!(Math.abs(a - b) <= tol)) throw new Error((msg || '') + ' erwartet ' + b + ' ± ' + tol + ', erhalten ' + a); }
const I = v => ({ kind: 'I', value: v }), U = v => ({ kind: 'U', value: v });
const C420 = { type: 'I_2W', range: '4..20mA', diag: { wireBreak: true } }, C010 = { type: 'U', range: '0..10V' };

// Kennlinien und Stützpunkte (Plan 8.4)
t('Stützpunkt 4 mA → 0', () => eq(M.rawValue(I(4), C420), 0));
t('Stützpunkt 12 mA → 13824', () => eq(M.rawValue(I(12), C420), 13824));
t('Stützpunkt 20 mA → 27648', () => eq(M.rawValue(I(20), C420), 27648));
t('Stützpunkt 5 V → 13824', () => eq(M.rawValue(U(5), C010), 13824));
t('10 V → 27648', () => eq(M.rawValue(U(10), C010), 27648));
t('Kennlinie 4–20 mA', () => { near(M.signal('I4_20', 50, 0, 100), 12, 1e-9); near(M.signal('I4_20', 0, 0, 100), 4, 1e-9); });
t('Kennlinie 0–10 V', () => near(M.signal('U0_10', 430, 60, 800), 5, 1e-9));
t('Umkehrung', () => near(M.physical('I4_20', 12, 0, 100), 50, 1e-9));
// Über-/Untersteuerung, Sonderwerte
t('Übersteuerung 22 mA', () => { const r = M.rawValue(I(22), C420); return r > 27648 && r <= 32511; });
t('Übersteuerung Grenze 32511', () => near(M.rawValue(I(22.8), C420), 32511, 40));
t('Überlauf 23 mA → 32767', () => eq(M.rawValue(I(23), C420), 32767));
t('Untersteuerung 2 mA', () => { const r = M.rawValue(I(2), C420); return r < 0 && r >= -4864; });
t('Drahtbruch mit Diagnose → 32767', () => eq(M.rawValue(I(0), C420), 32767));
t('Drahtbruch ohne Diagnose → −32768', () => eq(M.rawValue(I(0), { type: 'I_2W', range: '4..20mA', diag: {} }), -32768));
t('nicht angeschlossen = Drahtbruch', () => eq(M.rawValue(null, C420), 32767));
t('0–20 mA statt 4–20 mA: leerer Tank zeigt 20 % (5530)', () => eq(M.rawValue(I(4), { type: 'I_2W', range: '0..20mA' }), 5530));
t('Strom an Spannungskanal ≈ 0', () => M.rawValue(I(12), C010) < 30);
t('Kanal deaktiviert → 0', () => eq(M.rawValue(I(12), { type: 'off' }), 0));
t('Diagnosetexte', () => { eq(M.rawDiag(32767, C420), 'Drahtbruch oder Überlauf'); eq(M.rawDiag(-100, C420), 'Untersteuerung'); eq(M.rawDiag(30000, C420), 'Übersteuerung'); eq(M.rawDiag(1000, C420), null); });
t('Analogausgabe', () => { near(M.aqSignal(13824, { range: '0..10V' }), 5, 1e-9); near(M.aqSignal(0, { range: '4..20mA' }), 4, 1e-9); near(M.aqSignal(27648, { range: '4..20mA' }), 20, 1e-9); });

// PNP/NPN × 1M (alle vier Fälle, Plan 3.4)
t('PNP, 1M an M → Eingang 1', () => { const r = M.digitalInput({ out: 'PNP', group1M: 'M', active: true }); return r.sensorLed === true && r.value === true; });
t('PNP, 1M an L+ → Sensor-LED an, Eingang aus (Klassiker)', () => { const r = M.digitalInput({ out: 'PNP', group1M: 'L+', active: true }); return r.sensorLed === true && r.value === false && r.inputLed === false; });
t('NPN, 1M an L+ → Eingang 1', () => M.digitalInput({ out: 'NPN', group1M: 'L+', active: true }).value === true);
t('NPN, 1M an M → Eingang aus', () => { const r = M.digitalInput({ out: 'NPN', group1M: 'M', active: true }); return r.sensorLed && !r.value; });
t('inaktiv → immer 0', () => ['M', 'L+'].every(g => ['PNP', 'NPN'].every(o => !M.digitalInput({ out: o, group1M: g, active: false }).value)));
t('BN/BU vertauscht → Sensor tot', () => { const r = M.digitalInput({ out: 'PNP', active: true, fault: 'swap_bn_bu' }); return !r.sensorLed && !r.value; });
t('BK auf M → Kurzschluss, LED blinkt', () => { const r = M.digitalInput({ out: 'PNP', active: true, fault: 'bk_on_m' }); return r.shortCircuit && r.sensorLed === 'blink' && !r.value; });
t('Wackelkontakt-Aussetzer', () => !M.digitalInput({ out: 'PNP', active: true, dropout: true }).value);

// Materialfaktoren und Hysterese (Tabelle 6.1)
const IND = { kind: 'ind', sn: 8, out: 'PNP', contact: 'NO' };
t('Induktiv Stahl bis 8 mm', () => M.detects(IND, { material: 'stahl', dist: 8 }) && !M.detects(IND, { material: 'stahl', dist: 8.2 }));
t('Induktiv Edelstahl bis 5,6 mm', () => M.detects(IND, { material: 'edelstahl', dist: 5.6 }) && !M.detects(IND, { material: 'edelstahl', dist: 5.8 }));
t('Induktiv Aluminium bis 3,2 mm', () => M.detects(IND, { material: 'aluminium', dist: 3.2 }) && !M.detects(IND, { material: 'aluminium', dist: 3.4 }));
t('Induktiv Messing bis 4 mm', () => M.detects(IND, { material: 'messing', dist: 4 }) && !M.detects(IND, { material: 'messing', dist: 4.2 }));
t('Induktiv Kunststoff/Glas nie', () => !M.detects(IND, { material: 'kunststoff_w', dist: 0 }) && !M.detects(IND, { material: 'glas', dist: 0 }));
t('Hysterese 10 %', () => { const st = { on: true }; return M.detects(IND, { material: 'stahl', dist: 8.7 }, st) && !M.detects(IND, { material: 'stahl', dist: 8.9 }, st) && !M.detects(IND, { material: 'stahl', dist: 8.7 }, { on: false }); });
const KAP = p => ({ kind: 'kap', sn: 8, poti: p });
t('Kapazitiv: Kunststoff ab „mittel“', () => M.detects(KAP(0.5), { material: 'kunststoff_w', dist: 2 }) && !M.detects(KAP(0.4), { material: 'kunststoff_w', dist: 2 }));
t('Kapazitiv: Band nicht bei „mittel“', () => !M.detects(KAP(0.6), { material: 'band', dist: 2 }) && M.detects(KAP(0.8), { material: 'band', dist: 2 }));
t('Kapazitiv: Glas nur „hoch“', () => M.detects(KAP(0.8), { material: 'glas', dist: 2 }) && !M.detects(KAP(0.6), { material: 'glas', dist: 2 }));
t('Kapazitiv: Wasser durch Acryl, leere Wand nicht', () => M.detects(KAP(0.5), { material: 'wasser', dist: 3 }) && !M.detects(KAP(0.5), { material: 'acryl', dist: 3 }));
const TST = { kind: 'opt_taster', sn: 100 };
t('Optisch: Weiss weiter als Schwarz', () => M.detects(TST, { material: 'kunststoff_w', dist: 90 }) && !M.detects(TST, { material: 'kunststoff_s', dist: 90 }) && M.detects(TST, { material: 'kunststoff_s', dist: 30 }));
t('Hintergrundausblendung ignoriert Band nach Teach', () => { const s = { kind: 'opt_bgs', sn: 120, teach: 60 }; return !M.detects(s, { material: 'band', dist: 60 }) && M.detects(s, { material: 'stahl', dist: 40 }); });
t('Reflex-Lichtschranke: Glas unsicher', () => !M.detects({ kind: 'opt_reflex' }, { material: 'glas', dist: 50 }) && M.detects({ kind: 'opt_reflex' }, { material: 'glas', dist: 50 }, { glassFlip: true }));
t('Einweg: auch Glas unterbricht', () => M.detects({ kind: 'opt_einweg' }, { material: 'glas', dist: 50 }));
t('NO/NC/hell-dunkel/antivalent', () => { eq(M.outputs({ contact: 'NO' }, true).BK, true); eq(M.outputs({ contact: 'NC' }, true).BK, false); eq(M.outputs({ contact: 'NO', light: 'dunkel' }, true).BK, false); const a = M.outputs({ contact: 'antivalent' }, true); eq([a.BK, a.WH], [true, false]); });

// Versorgung
t('L+ auf M → Netzteil Überlast, alles aus', () => { const s = M.supply({ lplusToM: true }); return !s.dcOk && s.psuOverload && !M.digitalInput({ out: 'PNP', active: true, psuOverload: true }).sensorPower; });
t('Sicherung -F2 → Sensoren aus', () => M.supply({ sensorShort: true }).f2Tripped && !M.digitalInput({ out: 'PNP', active: true, fuseTripped: true }).value);

// Rauschen deterministisch, Schirm
t('Rauschen deterministisch mit Seed', () => eq([1, 2, 3].map(i => M.noise('B11', i * 0.05, false)), [1, 2, 3].map(i => M.noise('B11', i * 0.05, false))));
t('Ohne Schirm ±1–2 %, mit Schirm fast nichts', () => { let mx0 = 0, mx1 = 0; for(let i = 0; i < 400; i++){ mx0 = Math.max(mx0, Math.abs(M.noise('B12', i * 0.05, false))); mx1 = Math.max(mx1, Math.abs(M.noise('B12', i * 0.05, true))); } return mx0 >= 0.01 * 27648 && mx0 <= 0.02 * 27648 && mx1 <= 20; });
t('Wackelkontakt: ~8 % Aussetzer, reproduzierbar', () => { let n = 0; for(let i = 0; i < 2000; i++) if(M.looseContact('B1', i * 0.05)) n++; const again = [...Array(50).keys()].every(i => M.looseContact('B1', i * 0.05) === M.looseContact('B1', i * 0.05)); return n > 80 && n < 250 && again; });
t('Montage lose: Abstand driftet nur bei Bandlauf', () => M.mountDrift(4, false, true, 10) > 4 && M.mountDrift(4, true, true, 10) === 4 && M.mountDrift(4, false, false, 10) === 4);
t('Glättung nähert sich an', () => { let v = 0; for(let i = 0; i < 64; i++) v = M.smooth(v, 10000, 'mittel'); return v > 9000 && v <= 10000 && M.smooth(0, 10000, 'keine') === 10000; });

// Tankphysik
t('Füllen: 20 l/min → nach 60 s ≈ 20 l', () => { let s = M.tankNew(); for(let i = 0; i < 1200; i++) s = M.tankStep(s, { pumpFree: true, pumpPct: 100, inlet: true }); near(s.level * M.TANK.area * 1000, 20, 0.2); near(s.flow, 20, 0.01); });
t('Massebilanz Tank + Vorrat konstant', () => { let s = M.tankNew(); const tot0 = s.reserve; for(let i = 0; i < 3000; i++) s = M.tankStep(s, { pumpFree: true, pumpPct: 70, inlet: true, drain: i > 1500 }); near(s.level * M.TANK.area + s.reserve, tot0, 1e-9); });
t('Hydrostatik: 600 mm Wassersäule ≈ 59 mbar', () => { const s = Object.assign(M.tankNew(), { level: 0.6 }); near(M.tankStep(s, {}, 1e-6).pressure, 58.9, 0.1); });
t('Ablauf senkt den Pegel (∝ √h)', () => { let s = Object.assign(M.tankNew(), { level: 0.4 }); const a = M.tankStep(s, { drain: true }, 1); const b = M.tankStep(Object.assign(M.tankNew(), { level: 0.1 }), { drain: true }, 1); return a.level < 0.4 && (0.4 - a.level) > (0.1 - b.level); });
t('Heizen erwärmt, ohne Heizen kühlt ab', () => { let s = Object.assign(M.tankNew(), { level: 0.3, temp: 40 }); let h = s; for(let i = 0; i < 1200; i++) h = M.tankStep(h, { heater: true }); let c = s; for(let i = 0; i < 1200; i++) c = M.tankStep(c, {}); return h.temp > 40.5 && c.temp < 40 && c.temp > 20; });
t('Energiebilanz plausibel (2 kW, 21 l, 60 s ≈ +1,4 K)', () => { let s = Object.assign(M.tankNew(), { level: 0.3, temp: 20 }); for(let i = 0; i < 1200; i++) s = M.tankStep(s, { heater: true }); near(s.temp - 20, 2000 * 60 / (0.3 * M.TANK.area * 1000 * 4186), 0.05); });
t('Überlauf gemeldet, Pegel begrenzt', () => { let s = Object.assign(M.tankNew(), { level: 0.599, reserve: 0.03 }); s = M.tankStep(s, { pumpFree: true, pumpPct: 100, inlet: true }, 1); return s.overflow && s.level <= 0.6 + 1e-12; });
t('Trockenlauf: leerer Vorrat → kein Zulauf', () => { const s = M.tankStep(Object.assign(M.tankNew(), { reserve: 0 }), { pumpFree: true, pumpPct: 100, inlet: true }, 1); eq(s.flow, 0); });
// Messumformer
t('Ultraschall: Abstand und Blindzone', () => { const m = M.tankMeasure(Object.assign(M.tankNew(), { level: 0.37 }), 0.8); near(m.distance_mm, 430, 1e-6); near(M.transmitterSignal('B10', m.distance_mm).value, 5, 1e-6); near(M.transmitterSignal('B10', 20).value, 0, 1e-9); });
t('Druck 50 mbar → 12 mA → 13824', () => eq(M.rawValue(M.transmitterSignal('B11', 50), C420), 13824));
t('2-Leiter ohne Versorgung → 0 mA → Drahtbruch', () => eq(M.rawValue(M.transmitterSignal('B11', 50, { loop: 'no_supply' }), C420), 32767));
t('4-Leiter wie 2-Leiter angeschlossen → 0 mA', () => eq(M.transmitterSignal('B13', 10, { loop: 'as_2wire' }).value, 0));
t('Trennmesser offen → Drahtbruch', () => eq(M.rawValue(M.transmitterSignal('B12', 60, { trennOpen: true }), C420), 32767));
t('Temperatur 60 °C → 13,6 mA', () => near(M.transmitterSignal('B12', 60).value, 13.6, 1e-9));

console.log('Sensormodell-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen');
if(failN){ fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
