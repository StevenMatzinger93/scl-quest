(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — SPS der Werkstatt (docs/SENSORWERKSTATT_PLAN.md Teil 4.3, 8.3; Paket S6), rein rechnend, ohne DOM
   - PLC-Variablentabelle (Name, Datentyp, Adresse, Kommentar) mit Prüfung (doppelte Namen/Adressen, Typ ↔ Adressbreite)
   - Vorverarbeitung: "Name" und %I0.4 / %IW96 / %Q0.0 / %MD20 → Bezeichner der Engine (symbolisch und absolut auf dieselbe Variable)
   - Gerätekonfiguration (CPU 1214C, SM 1231 AI 4, SM 1232 AQ 2, SM 1221 DI 8) mit Messart, Messbereich, Glättung, Diagnose
   - CPU: Übersetzen, Laden (STOP), Starten (RUN), Zyklus mit Prozessabbild, Diagnosepuffer, Laden nötig nach Konfigurationsänderung
   - Prozessabbild aus der Verdrahtung (Wiring.evaluate / analogAt) und dem Modell (SensorModel.rawValue, Rauschen ohne Schirm)
   Engine: Grundstufe (SCLEngine) für SCL, KOP.wrapEngine(SCLEngine) für KOP/FUP (Netzwerktext).
   ============================================================ */
const SM = root.SensorModel, Wi = root.Wiring;

/* ---------- Variablentabelle ---------- */
const T = (name, type, addr, comment) => ({ name, type, addr, comment });
const TAGS_WERKSTATT = [
  T('Start', 'Bool', '%I0.0', '-S1 Taster Start (NO)'), T('Stopp', 'Bool', '%I0.1', '-S2 Taster Stopp (NC)'), T('NotHalt_Meldung', 'Bool', '%I0.2', '-S3 Kanal 2 (NC)'), T('Auto', 'Bool', '%I0.3', '-S4 Wahlschalter'),
  T('Ind_Metall', 'Bool', '%I0.4', '-B1 induktiv'), T('Kap_Teil', 'Bool', '%I0.5', '-B2 kapazitiv'), T('Taster_Hell', 'Bool', '%I0.6', '-B3 Lichttaster'), T('LS_Band', 'Bool', '%I0.7', '-B4.2 Einweg-Lichtschranke'),
  T('Rutsche_Voll', 'Bool', '%I1.0', '-B5 Reflexions-Lichtschranke'), T('Zyl_Hinten', 'Bool', '%I1.1', '-B6'), T('Zyl_Vorne', 'Bool', '%I1.2', '-B7'), T('Haube_Zu', 'Bool', '%I1.3', '-S5 (NC)'),
  T('Tank_Nicht_Voll', 'Bool', '%I1.4', '-B8 als NC'), T('Vorrat_Ok', 'Bool', '%I1.5', '-B9 Reed'),
  T('Abstand_Roh', 'Int', '%IW64', '-B10 0–10 V, CPU AI0'), T('Sollwert_Roh', 'Int', '%IW66', '-R1 0–10 V, CPU AI1'),
  T('Druck_Roh', 'Int', '%IW96', '-B11 4–20 mA, SM 1231 Kanal 0'), T('Temp_Roh', 'Int', '%IW98', '-B12 4–20 mA, Kanal 1'), T('Durchfluss_Roh', 'Int', '%IW100', '-B13 4–20 mA, Kanal 2'), T('Reserve_Roh', 'Int', '%IW102', 'Kanal 3 / Kalibrator'),
  T('Pumpe_Soll_Roh', 'Int', '%QW112', '-T2 0–10 V, SM 1232 Kanal 0'), T('Ventil_Soll_Roh', 'Int', '%QW114', '-MB5 4–20 mA, Kanal 1'),
  T('Band', 'Bool', '%Q0.0', '-K1'), T('Vereinzeler', 'Bool', '%Q0.1', '-MB1'), T('Auswerfer', 'Bool', '%Q0.2', '-MB2'), T('Pumpe_Frei', 'Bool', '%Q0.3', '-K2'), T('Ablauf', 'Bool', '%Q0.4', '-MB3'),
  T('Heizung', 'Bool', '%Q0.5', '-K3'), T('Lampe_Gruen', 'Bool', '%Q0.6', '-P1'), T('Lampe_Rot', 'Bool', '%Q0.7', '-P2'), T('Hupe', 'Bool', '%Q1.0', '-P3'), T('Zulauf', 'Bool', '%Q1.1', '-MB4')
];
const TYPES = { Bool: 'bit', Int: 'W', UInt: 'W', Word: 'W', DInt: 'D', UDInt: 'D', DWord: 'D', Real: 'D', Byte: 'B', SInt: 'B', USInt: 'B' };
function parseAddr(a){
  const s = String(a || '').trim().toUpperCase(); let m;
  if((m = /^%([IQM])(\d+)\.([0-7])$/.exec(s))) return { area: m[1], width: 'bit', byte: +m[2], bit: +m[3], key: m[1] + m[2] + '.' + m[3] };
  if((m = /^%([IQM])([BWD])(\d+)$/.exec(s))) return { area: m[1], width: m[2], byte: +m[3], key: m[1] + m[2] + m[3] };
  return null;
}
const bytesOf = p => p.width === 'bit' || p.width === 'B' ? 1 : p.width === 'W' ? 2 : 4;
// Prüfung wie im TIA Portal (vereinfacht): Name, Datentyp, Adresse, Doppelbelegung, Überlappung (Warnung)
function checkTags(tags){
  const errors = [], warnings = [], names = {}, addrs = {};
  (tags || []).forEach((t, i) => {
    const row = 'Zeile ' + (i + 1) + ' („' + (t.name || '') + '“)';
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.name || '')) errors.push({ row: i, text: row + ': Name nur aus Buchstaben, Ziffern und _ (Vereinfachung: keine Leerzeichen).' });
    const lk = String(t.name || '').toLowerCase(); if(names[lk] != null) errors.push({ row: i, text: row + ': Name „' + t.name + '“ ist doppelt (auch Zeile ' + (names[lk] + 1) + ').' }); else names[lk] = i;
    const w = TYPES[t.type]; if(!w) errors.push({ row: i, text: row + ': unbekannter Datentyp „' + t.type + '“.' });
    const p = parseAddr(t.addr);
    if(!p){ errors.push({ row: i, text: row + ': Adresse „' + t.addr + '“ ungültig (z. B. %I0.4, %IW96, %MD20).' }); return; }
    if(w && w !== p.width) errors.push({ row: i, text: row + ': Datentyp ' + t.type + ' passt nicht zur Adresse ' + t.addr + (w === 'bit' ? ' (Bool braucht eine Bitadresse wie %I0.4).' : ' (braucht %' + p.area + w + '…).') });
    if(p.width === 'W' && p.byte % 2) warnings.push({ row: i, text: row + ': Wortadresse ' + t.addr + ' ist ungerade – bei Analogwerten unüblich.' });
    if(addrs[p.key] != null) errors.push({ row: i, text: row + ': Adresse ' + t.addr + ' ist doppelt belegt (auch „' + tags[addrs[p.key]].name + '“).' }); else addrs[p.key] = i;
  });
  // Überlappung (z. B. %MW10 und %MD10) – Warnung
  const ps = (tags || []).map((t, i) => ({ i, p: parseAddr(t.addr) })).filter(x => x.p && x.p.width !== 'bit');
  ps.forEach((a, k) => ps.slice(k + 1).forEach(b => { if(a.p.area === b.p.area && a.p.key !== b.p.key && a.p.byte < b.p.byte + bytesOf(b.p) && b.p.byte < a.p.byte + bytesOf(a.p)) warnings.push({ row: b.i, text: '„' + tags[b.i].name + '“ überlappt mit „' + tags[a.i].name + '“.' }); }));
  return { ok: !errors.length, errors, warnings };
}
const initOf = type => type === 'Bool' ? false : type === 'Real' ? 0.0 : 0;
const engineType = type => type === 'Real' ? 'REAL' : type === 'Bool' ? 'BOOL' : 'INT';

/* ---------- Vorverarbeitung ---------- */
// Ersetzt "Name" → Name und %Adresse → Variablenname (Tag mit dieser Adresse, sonst _a_<Adresse>). Kommentare/Strings bleiben unberührt, Zeilen bleiben erhalten.
function preprocess(src, tags){
  const byName = {}, byAddr = {}; (tags || []).forEach(t => { byName[t.name.toLowerCase()] = t; const p = parseAddr(t.addr); if(p) byAddr[p.key] = t; });
  const extra = {}, errors = []; let out = '', i = 0, line = 1; src = String(src || '');
  const idOf = p => byAddr[p.key] ? byAddr[p.key].name : '_a_' + p.key.replace('.', '_');
  while(i < src.length){
    const c = src[i], two = src.substr(i, 2);
    if(two === '//'){ const e = src.indexOf('\n', i); const j = e < 0 ? src.length : e; out += src.slice(i, j); i = j; continue; }
    if(two === '(*'){ const e = src.indexOf('*)', i + 2); const j = e < 0 ? src.length : e + 2; const part = src.slice(i, j); line += (part.match(/\n/g) || []).length; out += part; i = j; continue; }
    if(c === "'"){ const e = src.indexOf("'", i + 1); const j = e < 0 ? src.length : e + 1; out += src.slice(i, j); i = j; continue; }
    if(c === '\n'){ line++; out += c; i++; continue; }
    if(c === '"'){
      const m = /^"([^"\n]*)"/.exec(src.slice(i));
      if(m){ const t = byName[m[1].toLowerCase()]; if(!t) errors.push({ line, text: 'Zeile ' + line + ': Variable "' + m[1] + '" steht nicht in der PLC-Variablentabelle.' }); out += t ? t.name : m[1].replace(/\W/g, '_'); i += m[0].length; continue; }
    }
    if(c === '%'){
      const m = /^%[IQMiqm][BWDbwd]?\d+(\.\d)?/.exec(src.slice(i)); const p = m && parseAddr(m[0]);
      if(p){ const id = idOf(p); if(!byAddr[p.key]) extra[id] = { name: id, type: p.width === 'bit' ? 'Bool' : p.width === 'D' ? 'DInt' : 'Int', addr: '%' + p.key }; out += id; i += m[0].length; continue; }
      if(m) errors.push({ line, text: 'Zeile ' + line + ': Adresse ' + m[0] + ' ungültig.' });
    }
    out += c; i++;
  }
  return { src: out, extra: Object.values(extra), errors };
}

/* ---------- Gerätekonfiguration ---------- */
const HW_DEFAULT = {
  cpu: { diDelay: '6.4', AI0: { type: 'U', range: '0..10V', smooth: 'keine' }, AI1: { type: 'U', range: '0..10V', smooth: 'keine' } },
  ai: { CH0: { type: 'I_2W', range: '4..20mA', smooth: 'keine', diag: { wireBreak: true, over: true, under: true } },
        CH1: { type: 'I_2W', range: '4..20mA', smooth: 'keine', diag: { wireBreak: true, over: true, under: true } },
        CH2: { type: 'I_4W', range: '4..20mA', smooth: 'keine', diag: { wireBreak: true, over: true, under: true } },
        CH3: { type: 'off', range: '4..20mA', smooth: 'keine', diag: { wireBreak: false, over: false, under: false } } },
  aq: { CH0: { type: 'U', range: '0..10V', stopValue: 0 }, CH1: { type: 'I', range: '4..20mA', stopValue: 0 } }
};
// Steckplätze, Adressen (TIA-Standard, Plan 2.4) und Angebote je Modul ([prüfen] gegen die Gerätehandbücher, docs/SENSORWERKSTATT_FAKTEN.md)
const SLOTS = [
  { slot: 1, id: 'A1', name: 'CPU 1214C DC/DC/DC', order: '6ES7 214-1AG40-0XB0', addr: 'I0.0–I1.5, Q0.0–Q1.1, IW64/IW66' },
  { slot: 2, id: 'A2', name: 'SM 1231 AI 4', order: '6ES7 231-4HD32-0XB0', addr: 'IW96–IW102' },
  { slot: 3, id: 'A3', name: 'SM 1232 AQ 2', order: '6ES7 232-4HB32-0XB0', addr: 'QW112–QW114' },
  { slot: 4, id: 'A4', name: 'SM 1221 DI 8', order: '6ES7 221-1BF32-0XB0', addr: 'I16.0–I16.7' }
];
const AI_ADDR = { AI0: 'IW64', AI1: 'IW66', CH0: 'IW96', CH1: 'IW98', CH2: 'IW100', CH3: 'IW102' };
const AQ_ADDR = { CH0: 'QW112', CH1: 'QW114' };
const AI_TYPES = [['off', 'deaktiviert'], ['U', 'Spannung'], ['I_4W', 'Strom 4-Draht'], ['I_2W', 'Strom 2-Draht']];
const AI_RANGES = { U: ['±10V', '0..10V'], I_4W: ['0..20mA', '4..20mA'], I_2W: ['4..20mA'], off: [] };
const SMOOTH = ['keine', 'schwach', 'mittel', 'stark'];
const DI_DELAYS = ['0.2', '0.4', '0.8', '1.6', '3.2', '6.4', '12.8'];
function newHw(){ return JSON.parse(JSON.stringify(HW_DEFAULT)); }
function hwEqual(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
// Kanalkonfiguration für SensorModel.rawValue
function aiCfg(hw, ch){ const c = ch.startsWith('AI') ? hw.cpu[ch] : hw.ai[ch]; return c; }

/* ---------- Prozessabbild der Eingänge aus Verdrahtung und Modell ---------- */
// ctx: { state (Wiring), world, phys, hw (geladene Konfiguration), t, prev (vorheriges Abbild für Glättung) }
function ioImage(ctx){
  const io = {}, diag = [];
  const ev = Wi.evaluate(ctx.state, ctx.world || {}, { t: ctx.t || 0 });
  Object.keys(ev.di).forEach(a => { io[a] = ev.di[a]; });
  Object.keys(AI_ADDR).forEach(ch => {
    const cfg = aiCfg(ctx.hw, ch), key = AI_ADDR[ch];
    if(!cfg || cfg.type === 'off'){ io[key] = 0; return; }
    const a = Wi.analogAt(ctx.state, ch, ctx.phys || {});
    let raw = a.sig ? SM.rawValue(a.sig, cfg) : SM.rawValue({ kind: cfg.type === 'U' ? 'U' : 'I', value: 0 }, cfg);
    if(a.part && a.part !== 'KALIB' && raw > SM.RAW.UNDER && raw < SM.RAW.OVER) raw = Math.max(SM.RAW.UNDER, Math.min(SM.RAW.OVER, raw + SM.noise(a.part, ctx.t || 0, !!(ctx.state.shields || {})[a.part])));
    if(ctx.prev && ctx.prev[key] != null && raw < SM.RAW.OVER && raw > SM.RAW.UNDER) raw = SM.smooth(ctx.prev[key], raw, cfg.smooth);
    io[key] = raw;
    const d = SM.rawDiag(raw, cfg);
    if(d && cfg.diag && ((/Drahtbruch/.test(d) && cfg.diag.wireBreak) || (/Überlauf/.test(d) && cfg.diag.over) || (/Unterlauf/.test(d) && cfg.diag.under))) diag.push({ ch, text: (ch.startsWith('AI') ? 'CPU 1214C Steckplatz 1, ' + ch : 'SM 1231 AI 4 Steckplatz 2, Kanal ' + ch.slice(2)) + ': ' + d });
  });
  return { io, diag, eval: ev };
}

/* ---------- CPU ---------- */
function Cpu(o){
  o = o || {};
  const E = o.engine || root.SCLEngine, K = o.kop || (root.KOP && root.KOP.wrapEngine ? root.KOP.wrapEngine(E) : null);
  const cpu = { mode: 'STOP', loaded: null, rt: null, diag: [], t: 0, lastIo: null, alarms: {} };
  const log = text => { cpu.diag.unshift({ t: Math.round(cpu.t * 10) / 10, text }); if(cpu.diag.length > 50) cpu.diag.pop(); };
  // Übersetzen: { ok, prog, errors:[{line, text}], warnings, vars }
  cpu.compile = function(source, lang, tags){
    const tc = checkTags(tags);
    if(!tc.ok) return { ok: false, errors: tc.errors.map(e => ({ line: 0, text: 'Variablentabelle: ' + e.text })) };
    const pre = preprocess(source, tags);
    if(pre.errors.length) return { ok: false, errors: pre.errors };
    const all = tags.concat(pre.extra), vars = {}, varTypes = {};
    all.forEach(t => { vars[t.name] = initOf(t.type); varTypes[t.name] = engineType(t.type); });
    const task = { lang: lang === 'scl' ? undefined : 'kop', initialVars: vars, varTypes };
    try {
      const prog = (lang === 'scl' ? E : K).compileSCL(pre.src, lang === 'scl' ? { vars, varTypes, fbTypes: {} } : task);
      return { ok: true, prog, vars, varTypes, all, warnings: tc.warnings };
    } catch(e){ return { ok: false, errors: [{ line: e.line || 0, text: e.message || String(e) }] }; }
  };
  // Laden: CPU geht in STOP, Programm + Konfiguration + Variablentabelle werden übernommen
  cpu.download = function(p){
    const c = cpu.compile(p.source, p.lang || 'scl', p.tags || TAGS_WERKSTATT);
    if(!c.ok) return c;
    if(cpu.mode === 'RUN') log('Betriebszustand RUN → STOP (Laden)');
    cpu.mode = 'STOP'; cpu.rt = null;
    const hwChanged = cpu.loaded && !hwEqual(cpu.loaded.hw, p.hw);
    cpu.loaded = { prog: c.prog, vars: c.vars, all: c.all, hw: JSON.parse(JSON.stringify(p.hw || HW_DEFAULT)), lang: p.lang || 'scl', source: p.source };
    log('Laden in Gerät: Programm' + (hwChanged ? ' und Hardwarekonfiguration' : '') + ' übernommen');
    return { ok: true, warnings: c.warnings };
  };
  cpu.start = function(){
    if(!cpu.loaded) return { ok: false, error: 'Kein Programm geladen.' };
    if(cpu.mode === 'RUN') return { ok: true };
    cpu.rt = E.createRuntime(cpu.loaded.prog, cpu.loaded.vars); cpu.mode = 'RUN'; log('Betriebszustand STOP → RUN');
    return { ok: true };
  };
  cpu.stop = function(reason){ if(cpu.mode === 'RUN') log('Betriebszustand RUN → STOP' + (reason ? ' (' + reason + ')' : '')); cpu.mode = 'STOP'; };
  cpu.needsLoad = hw => !!cpu.loaded && !hwEqual(cpu.loaded.hw, hw);
  // Ein Zyklus: Eingänge aus dem Prozessabbild, OB1, Ausgänge. io: { 'I0.4': true, 'IW96': 13824, … }
  cpu.cycle = function(dt, io, diag){
    cpu.t += dt || 0; cpu.lastIo = io;
    // Diagnosealarme kommend/gehend
    const now = {}; (diag || []).forEach(d => { now[d.text] = true; if(!cpu.alarms[d.text]) log(d.text + ' (kommend)'); });
    Object.keys(cpu.alarms).forEach(k => { if(!now[k]) log(k + ' (gehend)'); }); cpu.alarms = now;
    const out = {};
    if(cpu.mode !== 'RUN' || !cpu.rt){ outputsStop(out); return { mode: cpu.mode, out }; }
    const inputs = {};
    cpu.loaded.all.forEach(t => { const p = parseAddr(t.addr); if(p && p.area === 'I' && io[p.key] !== undefined) inputs[t.name] = io[p.key]; });
    try { cpu.rt.scan(dt, inputs); }
    catch(e){ cpu.stop('Fehler: ' + (e.message || e)); outputsStop(out); return { mode: cpu.mode, out, error: e.message }; }
    cpu.loaded.all.forEach(t => { const p = parseAddr(t.addr); if(p && p.area === 'Q') out[p.key] = cpu.rt.env[t.name]; });
    return { mode: cpu.mode, out };
  };
  function outputsStop(out){
    (cpu.loaded ? cpu.loaded.all : TAGS_WERKSTATT).forEach(t => { const p = parseAddr(t.addr); if(p && p.area === 'Q') out[p.key] = p.width === 'bit' ? false : 0; });
    if(cpu.loaded) Object.keys(AQ_ADDR).forEach(ch => { out[AQ_ADDR[ch]] = cpu.loaded.hw.aq[ch].stopValue || 0; });   // Ersatzwert bei STOP
  }
  // Wert einer Variablen oder Adresse (Beobachtung): in RUN aus dem Programm, sonst aus dem Prozessabbild
  cpu.read = function(ref){
    const p = parseAddr(ref.startsWith('%') ? ref : '%' + ref);
    if(p){
      const t = cpu.loaded && cpu.loaded.all.find(x => { const q = parseAddr(x.addr); return q && q.key === p.key; });
      if(t && cpu.rt) return cpu.rt.env[t.name];
      return cpu.lastIo ? cpu.lastIo[p.key] : undefined;
    }
    const name = String(ref).replace(/"/g, '');
    if(cpu.rt && cpu.rt.env[name] !== undefined) return cpu.rt.env[name];
    const t = cpu.loaded && cpu.loaded.all.find(x => x.name.toLowerCase() === name.toLowerCase());
    if(t){ const q = parseAddr(t.addr); if(q && cpu.lastIo && cpu.lastIo[q.key] !== undefined) return cpu.lastIo[q.key]; return initOf(t.type); }
    return undefined;
  };
  return cpu;
}

/* ---------- Werkstatt-Sitzung: Verdrahtung + CPU + Zeit ---------- */
function session(o){
  const cpu = o.cpu || Cpu(o), s = { cpu, t: 0, io: null, out: {}, diag: [] };
  s.step = function(dt){
    dt = dt == null ? SM.DT : dt; s.t += dt;
    const hw = cpu.loaded ? cpu.loaded.hw : (o.hw ? o.hw() : HW_DEFAULT);
    const img = ioImage({ state: o.state(), world: o.world ? o.world() : {}, phys: o.phys ? o.phys() : {}, hw, t: s.t, prev: s.io });
    const on = !!o.state().mainSwitch && img.eval.supply.dcOk;
    if(!on && cpu.mode === 'RUN') cpu.stop('Spannungsausfall');
    s.io = img.io; s.diag = img.diag;
    const r = cpu.cycle(dt, img.io, on ? img.diag : []);
    s.out = r.out;
    return r;
  };
  return s;
}
const fmt = (v, f) => v === undefined || v === null ? '—' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : f === 'hex' ? '16#' + ((v & 0xFFFF) >>> 0).toString(16).toUpperCase().padStart(4, '0') : Number.isInteger(v) ? String(v) : (Math.round(v * 1000) / 1000).toString();

root.SensorPLC = { TAGS_WERKSTATT, TYPES, parseAddr, checkTags, preprocess, HW_DEFAULT, SLOTS, AI_ADDR, AQ_ADDR, AI_TYPES, AI_RANGES, SMOOTH, DI_DELAYS, newHw, hwEqual, aiCfg, ioImage, Cpu, session, fmt };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorPLC;
})(typeof window !== 'undefined' ? window : globalThis);
