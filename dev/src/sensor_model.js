(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Simulationsmodell (docs/SENSORWERKSTATT_PLAN.md Teil 5, Fehlerliste Teil 3.4)
   Physik → Sensor/Messumformer → Montage/Stecker → Leitung/Klemmen → Versorgung → DI-Gruppe (1M) / AI-Kanal → Rohwert
   Rein rechnend, ohne DOM. Szene, Tests, Validator und Pikettdienst nutzen dasselbe Modell.
   Werte mit [prüfen] stammen aus docs/SENSORWERKSTATT_FAKTEN.md und sind gegen die Siemens-Handbücher zu kontrollieren.
   ============================================================ */
const DT = 0.05;                                   // Zeitschritt Physik + SPS-Zyklus: 50 ms
const RAW = { NOM: 27648, OVER: 32511, UNDER: -4864, OVERFLOW: 32767, UNDERFLOW: -32768 };
// Analogwertdarstellung S7-1200/1500 (Faktenblatt 5)
const LIMITS = {
  U0_10:  { lo: 0, hi: 10, over: 11.759, overflow: 11.852, unit: 'V' },
  I4_20:  { lo: 4, hi: 20, over: 22.81, overflow: 22.96, under: 1.185, unit: 'mA' },
  I0_20:  { lo: 0, hi: 20, over: 23.52, overflow: 23.70, unit: 'mA' },
  U_PM10: { lo: -10, hi: 10, over: 11.759, overflow: 11.852, unit: 'V' }
};
const RANGE_OF = { '0..10V': 'U0_10', '4..20mA': 'I4_20', '0..20mA': 'I0_20', '±10V': 'U_PM10', '+-10V': 'U_PM10' };

/* ---------- Zufall (deterministisch) ---------- */
function rng(seed){ let a = (typeof seed === 'number' ? seed : hashStr(String(seed))) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Analoge Kennlinien ---------- */
// physikalischer Wert x im Messbereich xmin…xmax → Signal (V oder mA) des Messumformers
function signal(kind, x, xmin, xmax){
  const f = (x - xmin) / (xmax - xmin);
  if(kind === 'U0_10') return 10 * f;
  if(kind === 'I4_20') return 4 + 16 * f;
  if(kind === 'I0_20') return 20 * f;
  if(kind === 'U_PM10') return -10 + 20 * f;
  throw new Error('Unbekannte Signalart ' + kind);
}
// Signal → physikalischer Wert (Umkehrung)
function physical(kind, s, xmin, xmax){
  const f = kind === 'U0_10' ? s / 10 : kind === 'I4_20' ? (s - 4) / 16 : kind === 'I0_20' ? s / 20 : (s + 10) / 20;
  return xmin + f * (xmax - xmin);
}
// Signal am Kanal → Rohwert, abhängig von der Kanal-Konfiguration { type:'U'|'I_2W'|'I_4W'|'off', range, diag:{wireBreak, overflow, underflow} }
// sig: { kind:'U'|'I', value } — elektrische Grösse, die tatsächlich an den Klemmen ansteht (null = nichts angeschlossen / Schleife offen)
function rawValue(sig, cfg){
  cfg = cfg || {};
  if(!cfg.type || cfg.type === 'off') return 0;
  const rk = RANGE_OF[cfg.range] || (cfg.type === 'U' ? 'U0_10' : 'I4_20'), L = LIMITS[rk];
  const diag = cfg.diag || {};
  const isCurrentCh = cfg.type !== 'U';
  let v;
  if(!sig || sig.value == null){ v = isCurrentCh ? 0 : 0; }
  else if(sig.kind === 'I' && !isCurrentCh){ v = sig.value * 0.0005; }          // Strom in Spannungskanal: ≈ 0 V (hochohmiger Eingang, Vereinfachung)
  else if(sig.kind === 'U' && isCurrentCh){ v = clamp(sig.value * 4, 0, 30); }  // Spannung an Stromkanal: Unsinn / Übersteuerung (Vereinfachung)
  else v = sig.value;
  // Drahtbruch / Unterlauf bei 4–20 mA
  if(rk === 'I4_20' && v < L.under){ return diag.wireBreak ? RAW.OVERFLOW : RAW.UNDERFLOW; }   // [prüfen] Sonderwerte je Diagnose-Einstellung
  if(v >= L.overflow) return RAW.OVERFLOW;
  if(rk === 'U_PM10' && v <= -L.overflow) return RAW.UNDERFLOW;
  let raw;
  if(rk === 'U_PM10') raw = Math.round(v / 10 * RAW.NOM);
  else raw = Math.round((v - L.lo) / (L.hi - L.lo) * RAW.NOM);
  if(raw > RAW.OVER) return RAW.OVERFLOW;
  if(rk === 'I4_20' && raw < RAW.UNDER) return RAW.UNDERFLOW;
  if(rk === 'U0_10' || rk === 'I0_20') raw = Math.max(0, raw);
  return raw;
}
// Rohwert → Diagnose (für Diagnosepuffer, LED am Modul)
function rawDiag(raw, cfg){
  const diag = (cfg && cfg.diag) || {};
  if(raw === RAW.OVERFLOW) return diag.wireBreak && (RANGE_OF[cfg.range] === 'I4_20') ? 'Drahtbruch oder Überlauf' : 'Überlauf';
  if(raw === RAW.UNDERFLOW) return 'Unterlauf';
  if(raw > RAW.NOM) return 'Übersteuerung';
  if(raw < 0) return 'Untersteuerung';
  return null;
}
// Analogausgabe: Rohwert (%QW) → Signal
function aqSignal(raw, cfg){
  const rk = RANGE_OF[(cfg && cfg.range) || '0..10V'] || 'U0_10', L = LIMITS[rk];
  raw = clamp(raw, rk === 'U_PM10' ? -RAW.OVER : 0, RAW.OVER);
  return rk === 'U_PM10' ? raw / RAW.NOM * 10 : L.lo + raw / RAW.NOM * (L.hi - L.lo);
}

/* ---------- Digitale Sensoren ---------- */
// Reduktionsfaktoren induktiv (Richtwerte, Faktenblatt 7 [prüfen])
const MATERIALS = {
  stahl:        { name: 'Stahl', ind: 1.0, kap: 1.0, opt: 1.0, glass: false, metal: true },
  edelstahl:    { name: 'Edelstahl', ind: 0.7, kap: 1.0, opt: 1.0, glass: false, metal: true },
  aluminium:    { name: 'Aluminium', ind: 0.4, kap: 1.0, opt: 0.9, glass: false, metal: true },
  messing:      { name: 'Messing', ind: 0.5, kap: 1.0, opt: 1.0, glass: false, metal: true },
  kunststoff_w: { name: 'Kunststoff weiss', ind: 0, kap: 0.5, opt: 1.0, glass: false, metal: false },
  kunststoff_s: { name: 'Kunststoff schwarz', ind: 0, kap: 0.5, opt: 0.35, glass: false, metal: false },
  glas:         { name: 'Glas', ind: 0, kap: 0.25, opt: 0.15, glass: true, metal: false },
  wasser:       { name: 'Wasser', ind: 0, kap: 0.9, opt: 0.2, glass: false, metal: false },
  band:         { name: 'Transportband (Gummi)', ind: 0, kap: 0.3, opt: 0.6, glass: false, metal: false },
  acryl:        { name: 'Acrylwand (leerer Tank)', ind: 0, kap: 0.35, opt: 0.1, glass: true, metal: false }
};
/* Kapazitiv: Poti p (0…1) = Empfindlichkeit. Erkannt wird ein Material mit kap ≥ 1 − p.
   Metall (1,0) immer · Wasser (0,9) ab p ≥ 0,1 · Kunststoff (0,5) ab „mittel“ p ≥ 0,5 · Band (0,3) erst ab p ≥ 0,7 · Glas (0,25) nur „hoch“ p ≥ 0,75 */
const HYST = 0.10;   // Schalthysterese 10 % (Vereinfachung, im Spiel markiert)
/* Sensor-Definition: { kind:'ind'|'kap'|'opt_taster'|'opt_bgs'|'opt_einweg'|'opt_reflex'|'reed'|'zylinder'|'taster'|'schwimmer',
   sn (mm, Nennschaltabstand), out:'PNP'|'NPN', contact:'NO'|'NC'|'antivalent', light:'hell'|'dunkel', poti (0…1, kapazitiv), teach (mm, Hintergrundausblendung) }
   Objekt: { material, dist (mm) } oder null (kein Objekt)
   state: { on } – für die Hysterese; wird aktualisiert */
function detects(s, obj, state){
  state = state || {};
  if(!obj) return false;
  const m = MATERIALS[obj.material] || MATERIALS.stahl;
  let reach;
  if(s.kind === 'ind') reach = (s.sn || 8) * m.ind;
  else if(s.kind === 'kap'){ const p = clamp(s.poti == null ? 0.5 : s.poti, 0, 1); reach = m.kap >= 1 - p - 1e-9 ? (s.sn || 8) * Math.max(0.1, p) : 0; }
  else if(s.kind === 'opt_taster') reach = (s.sn || 100) * m.opt;
  else if(s.kind === 'opt_bgs'){ reach = s.teach == null ? (s.sn || 100) : s.teach - 3; if(m.glass) reach *= 0.5; }   // Hintergrundausblendung: alles vor der Teach-Distanz
  else if(s.kind === 'opt_einweg') return !!obj && (obj.dist == null || obj.dist >= 0);                                 // unterbricht den Strahl (auch Glas)
  else if(s.kind === 'opt_reflex') return !m.glass || !!state.glassFlip;                                                // Glas nur unsicher (Polarisationsfilter)
  else if(s.kind === 'zylinder' || s.kind === 'reed' || s.kind === 'schwimmer') reach = s.sn || 3;
  else reach = s.sn || 0;
  const d = obj.dist == null ? 0 : obj.dist;
  const on = state.on ? d <= reach * (1 + HYST) : d <= reach;
  return reach > 0 && on;
}
// Schaltzustand am Ausgang (logisch, vor Verdrahtung): NO/NC/hell-dunkel
function outputs(s, detected){
  const dark = s.light === 'dunkel';
  const act = dark ? !detected : detected;
  if(s.contact === 'NC') return { BK: !act, WH: null };
  if(s.contact === 'antivalent') return { BK: act, WH: !act };
  return { BK: act, WH: null };
}

/* ---------- Digitaleingang mit Eingangsbeschaltung (1M) ---------- */
/* PNP (plusschaltend): Ausgang aktiv = L+ auf BK. Eingang „stromziehend“ (1M an M) sieht Strom → 1.
   NPN (minusschaltend): Ausgang aktiv = M auf BK. Eingang „stromliefernd“ (1M an L+) sieht Strom → 1.
   Rückgabe: { sensorLed, inputLed, value } */
function digitalInput(o){
  const out = o.out || 'PNP', m1 = o.group1M || 'M', powered = o.supply !== false && !o.psuOverload && !o.fuseTripped;
  const res = { sensorPower: powered, sensorLed: false, inputLed: false, value: false, shortCircuit: false };
  if(!powered) return res;
  if(o.fault === 'swap_bn_bu'){ return res; }                      // verpolt: Sensor ohne Funktion (verpolungsgeschützt)
  const active = !!o.active;
  res.sensorLed = active;
  if(o.fault === 'bk_on_m' && out === 'PNP' && active){ res.shortCircuit = true; res.sensorLed = 'blink'; return res; }   // Kurzschlussschutz
  if(o.fault === 'wire_open') return res;
  let current;
  if(out === 'PNP') current = active && m1 === 'M';
  else current = active && m1 === 'L+';
  if(o.dropout) current = false;                                    // Wackelkontakt in diesem Zyklus
  res.inputLed = current; res.value = current;
  return res;
}

/* ---------- Versorgung, Sicherungen ---------- */
function supply(net){
  // net: { lplusToM:true (Kurzschluss L+/M), sensorShort:true (Kurzschluss hinter -F2), load_mA }
  const r = { dcOk: true, psuOverload: false, f2Tripped: false, f3Tripped: false };
  if(net && net.lplusToM){ r.dcOk = false; r.psuOverload = true; return r; }
  if(net && net.sensorShort) r.f2Tripped = true;
  if(net && net.actorShort) r.f3Tripped = true;
  if(net && net.load_mA > 5000){ r.dcOk = false; r.psuOverload = true; }
  return r;
}

/* ---------- Wackelkontakt, Rauschen, Drift ---------- */
// Wackelkontakt (Stecker nicht festgezogen / Ader ohne Hülse): sporadische Aussetzer, deterministisch per Seed
function looseContact(seed, t, rate){
  const r = rng(hashStr(String(seed)) ^ Math.floor(t / DT));
  return r() < (rate == null ? 0.08 : rate);
}
// Rauschen auf dem Rohwert: Schirm nicht aufgelegt → ±1–2 % vom Nennbereich; mit Schirm sehr klein
function noise(seed, t, shielded, amp){
  const r = rng(hashStr(String(seed)) ^ Math.floor(t / DT) * 2654435761);
  const a = amp != null ? amp : shielded ? 0.0005 : 0.015;
  return Math.round((r() * 2 - 1) * a * RAW.NOM);
}
// Sensor nicht festgezogen: Schaltabstand driftet durch Vibration (mm pro Sekunde Bandlauf)
function mountDrift(dist, tight, running, dt){ return tight || !running ? dist : dist + 0.02 * dt; }
// Glättung des Moduls: gleitender Mittelwert über n Zyklen
function smooth(prev, raw, level){ const n = { keine: 1, schwach: 4, mittel: 16, stark: 32 }[level || 'keine'] || 1; return prev == null ? raw : Math.round(prev + (raw - prev) / n); }

/* ---------- Tankstation ---------- */
const TANK = { d: 0.30, h: 0.60, area: Math.PI * 0.15 * 0.15, rho: 1000, g: 9.81, c: 4186, qMax: 20 / 60000, kOut: 0.00010, heater: 2000, ua: 6, tAmb: 20, tIn: 15, reserveL: 40 };
function tankNew(o){ return Object.assign({ level: 0, temp: TANK.tAmb, reserve: TANK.reserveL / 1000, t: 0 }, o || {}); }
/* Ein Schritt (dt s). u: { pumpFree, pumpPct (0…100), valvePct (Stellventil 0…100, null = offen), inlet (Zulauf-Magnetventil), drain (Ablauf), heater } */
function tankStep(st, u, dt){
  dt = dt || DT;
  const s = Object.assign({}, st);
  const pump = u.pumpFree && u.inlet !== false ? clamp(u.pumpPct == null ? 100 : u.pumpPct, 0, 100) / 100 : 0;
  const valve = u.valvePct == null ? 1 : clamp(u.valvePct, 0, 100) / 100;
  let qIn = TANK.qMax * pump * valve;                                                // m³/s
  if(s.reserve <= 0) qIn = 0;                                                      // Trockenlauf
  let qOut = u.drain ? TANK.kOut * Math.sqrt(Math.max(0, s.level)) : 0;
  let vol = s.level * TANK.area;
  const vMax = TANK.h * TANK.area;
  qIn = Math.min(qIn, s.reserve / dt);
  const mBefore = vol * TANK.rho;
  vol = vol + (qIn - qOut) * dt;
  let overflow = 0; if(vol > vMax){ overflow = vol - vMax; vol = vMax; }
  qOut = Math.min(qOut, (vol + qOut * dt) / dt);
  vol = Math.max(0, vol);
  s.reserve = Math.max(0, s.reserve - qIn * dt + qOut * dt + overflow);            // Kreislauf: Ablauf und Überlauf zurück in den Vorrat
  // Temperatur: Mischung mit Zulauf, Heizleistung, Verlust an die Umgebung
  const m = vol * TANK.rho;
  if(m > 0.05){
    const mixIn = qIn * dt * TANK.rho;
    let T = (s.temp * mBefore + TANK.tIn * mixIn) / Math.max(0.05, mBefore + mixIn);
    T += ((u.heater && s.level > 0.05 ? TANK.heater : 0) - TANK.ua * (T - TANK.tAmb)) * dt / (m * TANK.c);
    s.temp = T;
  }
  s.level = vol / TANK.area; s.t = (st.t || 0) + dt;
  s.flow = qIn * 60000;                                                             // l/min
  s.pressure = TANK.rho * TANK.g * s.level / 100;                                   // mbar (1 mbar = 100 Pa)
  s.overflow = overflow > 0;
  return s;
}
// Messgrössen der Tankstation (vor Signalumwandlung)
function tankMeasure(s, mountHeight){
  const H = mountHeight == null ? 0.80 : mountHeight;                              // Einbauhöhe Ultraschall über Boden [m]
  const dist = Math.max(0, (H - s.level) * 1000);                                  // mm
  return { level_mm: s.level * 1000, distance_mm: dist, distance_valid: dist >= 60 && dist <= 800, pressure_mbar: s.pressure || 0, temp_c: s.temp, flow_lmin: s.flow || 0 };
}
// Transmitter der Tankstation (Grundbelegung, Plan 2.2/2.4)
const TRANSMITTERS = {
  B10: { kind: 'U0_10', min: 60, max: 800, quantity: 'distance_mm', wires: 3, name: 'Ultraschall 60–800 mm, 0–10 V' },
  B11: { kind: 'I4_20', min: 0, max: 100, quantity: 'pressure_mbar', wires: 2, name: 'Drucktransmitter 0–100 mbar, 4–20 mA, 2-Leiter' },
  B12: { kind: 'I4_20', min: 0, max: 100, quantity: 'temp_c', wires: 2, name: 'PT100 mit Kopftransmitter 0–100 °C, 4–20 mA, 2-Leiter' },
  B13: { kind: 'I4_20', min: 0, max: 20, quantity: 'flow_lmin', wires: 4, name: 'MID 0–20 l/min, 4–20 mA, 4-Leiter' },
  R1:  { kind: 'U0_10', min: 0, max: 100, quantity: 'setpoint_pct', wires: 3, name: 'Sollwertsteller 0–10 V' }
};
/* Signal eines Messumformers an den Klemmen, inkl. Verdrahtungs-/Montagefehler
   w: { powered, loop:'ok'|'open'|'no_supply'|'as_2wire' (4-Leiter wie 2-Leiter angeschlossen), trennOpen, blindZone } */
function transmitterSignal(id, x, w){
  const T = TRANSMITTERS[id]; if(!T) throw new Error('Unbekannter Messumformer ' + id);
  w = w || {};
  if(w.powered === false || w.trennOpen || w.loop === 'open' || w.loop === 'no_supply' || (T.wires === 4 && w.loop === 'as_2wire')) return { kind: T.kind[0], value: 0 };
  if(T.quantity === 'distance_mm' && x < 60) x = 60;                               // Blindzone: näher als 60 mm wird nicht gemessen (Vereinfachung)
  const s = signal(T.kind, clamp(x, T.min - (T.max - T.min) * 0.15, T.max + (T.max - T.min) * 0.2), T.min, T.max);
  return { kind: T.kind[0], value: s };
}

root.SensorModel = { DT, RAW, LIMITS, RANGE_OF, MATERIALS, HYST, TANK, TRANSMITTERS, rng, hashStr,
  signal, physical, rawValue, rawDiag, aqSignal, detects, outputs, digitalInput, supply, looseContact, noise, mountDrift, smooth,
  tankNew, tankStep, tankMeasure, transmitterSignal };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorModel;
})(typeof window !== 'undefined' ? window : globalThis);
