(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Schnittstellenvertrag für die Visualisierung (Paket W3, docs/SENSOR_VISUAL_VERTRAG.md)
   Rein rechnend (kein DOM, Node-testbar). Macht aus dem echten Spielzustand (Wiring + Aufgabe) die Daten, die
   SensorWiring25D (2.5D-Verdrahtung) und SensorPlant3D (Anlage) zeichnen, und setzt deren Ereignisse in Spielaktionen um.
   Regeln, Punkte und Bewertung bleiben in wiring.js / sensor_tasks.js; die Zeichenmodule dürfen nur darstellen und Ereignisse melden.

   SensorVisual.netlist(task, ctx)          → statische Beschreibung (Bauteile, Kabel, Adern, Klemmen, Baugruppen, zulässige Ziele)
   SensorVisual.state(task, ctx, opt)       → dynamischer Zustand (Adern/Verbindungen, Prüfergebnis je Ader, LEDs, Fehler, Hilfsziel)
   SensorVisual.help(task, ctx)             → nächstes Ziel für „Zeig mir“: { core, terminal, from, to, text }
   SensorVisual.apply(task, ctx, event)     → Ereignis wireDrop/wireRemove/… in den echten Spielzustand einarbeiten
   SensorVisual.plant(task, ctx, opt)       → Anlagenzustand (Format von SensorScene.setState) aus der aktuellen Auswertung
   SensorVisual.EVENTS / PLANT_FIELDS       → Dokumentation der Ereignisse und der setState-Felder
   ============================================================ */
const W = () => root.Wiring, T = () => root.SensorTasks, SM = () => root.SensorModel, PLC = () => root.SensorPLC;
const VERSION = 1;

// Ader-Farben (IEC 60757) und M12-Pin (A-codiert): 1 braun, 2 weiss, 3 blau, 4 schwarz
const CORE_COLOR = {
  BN: { name: 'braun', hex: '#8b5a2b', m12: 1 }, WH: { name: 'weiss', hex: '#e8e8e8', m12: 2 }, BU: { name: 'blau', hex: '#2f6fd0', m12: 3 }, BK: { name: 'schwarz', hex: '#222222', m12: 4 },
  '+': { name: 'rot', hex: '#c0392b' }, '-': { name: 'blau', hex: '#2f6fd0' }, 'L+': { name: 'rot', hex: '#c0392b' }, M: { name: 'blau', hex: '#2f6fd0' }, 'I+': { name: 'violett', hex: '#8e44ad' }, 'I-': { name: 'violett-weiss', hex: '#6c5ce7' }
};
// Bedeutung der Adern je Bauteiltyp
const ROLES = {
  sensor3: { BN: 'L+', BU: 'M', BK: 'Signal' }, sensor4: { BN: 'L+', BU: 'M', BK: 'Signal (Schliesser)', WH: 'Signal 2 (Öffner)' }, sender: { BN: 'L+', BU: 'M' },
  analogU: { BN: 'L+', BU: 'M', BK: 'Signal 0–10 V' }, analog2w: { '+': 'Schleife +', '-': 'Schleife −' }, analog4w: { 'L+': 'L+', M: 'M', 'I+': 'Signal +', 'I-': 'Signal −' },
  poti: { 1: 'Anschluss 1', 2: 'Schleifer', 3: 'Anschluss 3' }, contact2: {}
};
// Zeichenform je Bauteil (Schlüssel für die Darstellung, herstellerneutral)
const SHAPE = {
  B1: 'induktiv_m18', B2: 'kapazitiv_m18', B3: 'lichttaster', 'B4.1': 'lichtschranke_sender', 'B4.2': 'lichtschranke_empfaenger', B5: 'reflexlichtschranke', B6: 'zylinderschalter', B7: 'zylinderschalter',
  B8: 'kapazitiv_grenzschalter', B9: 'schwimmerschalter', S1: 'taster_gruen', S2: 'taster_rot', S3: 'not_halt', S4: 'wahlschalter', S5: 'positionsschalter', N1: 'induktiv_m18_npn',
  B10: 'ultraschall_m30', B11: 'drucktransmitter', B12: 'pt100_kopftransmitter', B13: 'durchflussmesser', R1: 'potentiometer'
};
const CONNECTOR = t => (t === 'analog2w' || t === 'poti' || t === 'contact2') ? 'litze' : 'm12';   // Leitungsende: M12-Stecker oder freie Litzen

const term = id => { const m = /^([A-Z]\d?):(.*)$/.exec(id); return m ? { block: m[1], rest: m[2] } : { block: id, rest: '' }; };
const isCore = id => !!W().PARTS[id.split(':')[0]];

/* ---------- Klemmenbeschreibung ---------- */
function terminalSpec(id){
  const Wi = W(), P = PLC(), { block, rest } = term(id);
  let m;
  if(block === 'X2' && (m = /^(\d+)\.(L\+|S|M)$/.exec(rest))){
    const row = +m[1], lvl = m[2], di = Wi.DI_OF_X2[row];
    return { id, block: 'X2', kind: 'initiatorklemme', group: 'X2:' + row, row, level: lvl, label: lvl, potential: lvl === 'S' ? 'signal' : lvl, address: lvl === 'S' && di ? '%' + di : null, led: lvl === 'S', capacity: lvl === 'S' ? 2 : 1 };
  }
  if(block === 'X1' && (m = /^(L\+|M)(\d+)$/.exec(rest))) return { id, block: 'X1', kind: 'verteiler', group: 'X1:' + m[2], row: +m[2], level: m[1], label: m[1], potential: m[1], capacity: 1 };
  if(block === 'X3' && (m = /^(\d+)\.(a|b)$/.exec(rest))) return { id, block: 'X3', kind: 'trennklemme', group: 'X3:' + m[1], row: +m[1], level: m[2], side: m[2] === 'a' ? 'feld' : 'sps', label: m[2] === 'a' ? 'Feld' : 'SPS', measureJack: true, capacity: 1 };
  if(block === 'A1'){
    if((m = /^DI([ab])\.(\d)$/.exec(rest))){ const addr = m[1] === 'a' ? 'I0.' + m[2] : 'I1.' + m[2]; return { id, block: 'A1', kind: 'cpu', group: 'A1:DI', label: '.' + m[2], address: '%' + addr, led: true, capacity: 1 }; }
    if(rest === 'AI0' || rest === 'AI1') return { id, block: 'A1', kind: 'cpu', group: 'A1:AI', label: rest === 'AI0' ? 'AI 0' : 'AI 1', address: '%' + P.AI_ADDR[rest], capacity: 1 };
    return { id, block: 'A1', kind: 'cpu', group: 'A1:' + (rest.replace(/\..*/, '')), label: rest, potential: /M/.test(rest) ? 'M' : /L\+/.test(rest) ? 'L+' : null, capacity: 1 };
  }
  if(block === 'A2'){ if((m = /^(\d)([+-])$/.exec(rest))) return { id, block: 'A2', kind: 'analogmodul', group: 'A2:' + m[1], label: 'AI ' + m[1] + m[2], channel: +m[1], polarity: m[2], address: m[2] === '+' ? '%' + P.AI_ADDR['CH' + m[1]] : null, capacity: 1 }; return { id, block: 'A2', kind: 'analogmodul', group: 'A2:V', label: rest, potential: rest === 'M' ? 'M' : 'L+', capacity: 1 }; }
  if(block === 'A3') return { id, block: 'A3', kind: 'analogausgang', group: 'A3', label: 'AQ ' + rest, capacity: 1 };
  if(block === 'A4'){ if((m = /^\.(\d)$/.exec(rest))) return { id, block: 'A4', kind: 'digitalmodul', group: 'A4:DI', label: '.' + m[1], address: '%I16.' + m[1], led: true, capacity: 1 }; return { id, block: 'A4', kind: 'digitalmodul', group: 'A4:1M', label: rest, potential: null, capacity: 1 }; }
  if(block === 'G1' || block === 'F2' || block === 'F3') return { id, block, kind: 'versorgung', group: block, label: rest, capacity: 1 };
  return { id, block, kind: 'sonst', group: block, label: rest || id, capacity: 1 };
}

/* ---------- Ausschnitt: nur, was die Aufgabe braucht ---------- */
function viewOf(task){
  const T_ = T(), x2 = (task.x2 || []).slice(), mods = (task.modules || ['A1']).slice(), x3 = task.x3 || 0;
  const Wi = W(), ids = [];
  const push = id => { if(!ids.includes(id)) ids.push(id); };
  // Klemmen der Aufgabe: Adern-Ziele der Wire-Schritte + Zeilen x2/x3 + Verteiler + Baugruppen
  x2.forEach(n => ['L+', 'S', 'M'].forEach(l => push('X2:' + n + '.' + l)));
  for(let i = 1; i <= x3; i++){ push('X3:' + i + '.a'); push('X3:' + i + '.b'); }
  [1, 2, 3, 4, 5, 6, 7, 8].forEach(i => { push('X1:L+' + i); push('X1:M' + i); });
  Wi.TERMINALS.filter(id => mods.includes(term(id).block)).forEach(push);
  // Ziele aus den Referenzen ergänzen (z. B. Klemmen ausserhalb der angegebenen Zeilen)
  task.steps.filter(s => s.kind === 'wire').forEach(s => ((s.ref || {}).add || []).forEach(([a, b]) => { [a, b].forEach(n => { if(!isCore(n)) push(n); }); }));
  return ids.filter(id => Wi.TERMINALS.includes(id));
}
function targetPairs(task){ return task.steps.flatMap((s, i) => s.kind === 'wire' ? ((s.ref || {}).add || []).map(p => ({ a: p[0], b: p[1], step: i })) : []); }
// Adern, die die Referenz löst (Fehlersuche: falsch gelegte Ader entfernen) und Bauteile, deren Adern alle wegmüssen
function removePairs(task){ return task.steps.flatMap((s, i) => s.kind === 'wire' ? ((s.ref || {}).remove || []).map(p => ({ a: p[0], b: p[1], step: i })).concat(((s.ref || {}).removePart || []).map(part => ({ part, step: i }))) : []); }

/* ---------- Netzliste (statisch) ---------- */
function netlist(task, ctx){
  const Wi = W(), P = Wi.PARTS;
  const pids = (task.parts || []).filter(p => P[p]);
  const view = viewOf(task), pairs = targetPairs(task);
  const targetT = new Set(pairs.flatMap(p => [p.a, p.b]).filter(n => !isCore(n)));
  const groupsTarget = new Set([...targetT].map(id => terminalSpec(id).group));
  const terminals = view.map(id => { const s = terminalSpec(id); s.relevance = targetT.has(id) ? 'ziel' : groupsTarget.has(s.group) ? 'nah' : 'ruhe'; return s; });
  const parts = pids.map(id => {
    const p = P[id], roles = ROLES[p.type] || {};
    return { id, label: '-' + id, name: p.name, type: p.type, shape: SHAPE[id] || 'sensor', output: p.out || null, contact: p.contact || (p.sensor && p.sensor.contact) || null, address: p.di ? '%' + p.di : p.ai ? '%' + PLC().AI_ADDR[p.ai] : null,
      cable: { connector: CONNECTOR(p.type), cores: p.pins.map(pin => ({ id: id + ':' + pin, part: id, pin, label: pin, color: (CORE_COLOR[pin] || { name: '', hex: '#888' }).name, hex: (CORE_COLOR[pin] || { hex: '#888' }).hex, m12Pin: (CORE_COLOR[pin] || {}).m12 || null, role: roles[pin] || null })) } };
  });
  const cores = parts.flatMap(p => p.cable.cores);
  // zulässige Ziele einer Ader: jede Klemmstelle des Ausschnitts (Ader → Ader gibt es nicht); Belegung und Bewertung übernimmt wiring.js
  const allowed = {}; cores.forEach(c => { allowed[c.id] = terminals.map(t => t.id); });
  const modules = [...new Set(terminals.filter(t => /^A\d$/.test(t.block)).map(t => t.block))].map(b => ({ id: b, name: ({ A1: 'CPU 1214C DC/DC/DC', A2: 'SM 1231 AI 4', A3: 'SM 1232 AQ 2', A4: 'SM 1221 DI 8' })[b] }));
  const strips = [...new Set(terminals.filter(t => /^X\d$/.test(t.block)).map(t => t.block))].map(b => ({ id: b, name: ({ X1: 'Verteiler L+/M', X2: 'Initiatorenklemmen', X3: 'Trennklemmen 4–20 mA' })[b], rows: [...new Set(terminals.filter(t => t.block === b).map(t => t.row))] }));
  return { version: VERSION, task: { id: task.id, title: task.title, module: task.level, scene: task.scene || null, phase: task.phase || null, tools: (task.tools || []).slice() },
    parts, strips, modules, terminals, allowed,
    targets: pairs.map(p => ({ a: p.a, b: p.b })),   // Referenzverbindungen (nur für „Zeig mir“, Demo und Tests; im Spiel nicht an die Anzeige geben, sonst verrät die Darstellung die Lösung)
    bridges: Object.keys(Wi.BRIDGES).map(id => ({ id, name: Wi.BRIDGES[id].name })) };
}

/* ---------- Prüfergebnis je Ader ---------- */
// Regeln, die eine Ader nennen: net:[…] (muss verbunden sein) oder notNet. Ader ohne Draht = 'fehlt', Draht und alle Regeln erfüllt = 'ok', sonst 'falsch', ohne Regel = 'gesetzt'
function coreResults(task, st){
  const Wi = W(), out = {};
  const rules = task.steps.filter(s => s.kind === 'wire').flatMap(s => s.target || []);
  const wired = new Set(); st.wires.forEach(w => { wired.add(w.from); wired.add(w.to); });
  (task.parts || []).forEach(id => (Wi.PARTS[id] || { pins: [] }).pins.forEach(pin => {
    const core = id + ':' + pin;
    if(!wired.has(core)){ out[core] = 'fehlt'; return; }
    const mine = rules.filter(r => (r.net || r.notNet || []).includes(core));
    if(!mine.length){ out[core] = 'gesetzt'; return; }
    out[core] = mine.every(r => Wi.check(st, [r]).issues.filter(i => i.rule === r).length === 0) ? 'ok' : 'falsch';
  }));
  return out;
}

/* ---------- Zustand (dynamisch) ---------- */
function state(task, ctx, opt){
  const Wi = W(), st = ctx.state, base = (opt && opt.base) || T().newContext(task, { noPrefill: true }).state;
  const fixedKeys = new Set(base.wires.map(w => w.from + '>' + w.to));
  const world = (opt && opt.world) || {};
  const ev = Wi.evaluate(st, T().worldFrom(st, world), { t: (opt && opt.t) || 0 });
  const results = coreResults(task, st);
  const wires = st.wires.filter(w => isCore(w.from) || isCore(w.to) || (opt && opt.jumpers)).map((w, i) => {
    const a = isCore(w.from) ? w.from : w.to, b = a === w.from ? w.to : w.from;
    return { id: 'w' + i, core: isCore(a) ? a : null, a, b, ferrule: !!w.ferrule, prefilled: fixedKeys.has(w.from + '>' + w.to), result: isCore(a) ? results[a] : 'gesetzt' };
  });
  // vorgegebene Klemmenbrücken (Leiter zwischen zwei Klemmstellen, z. B. -X2:5.S → -A1:DIa.4): nur Anzeige, nicht die Adern des Sensors
  const links = st.wires.filter(w => !isCore(w.from) && !isCore(w.to)).map((w, i) => ({ id: 'l' + i, a: w.from, b: w.to, prefilled: fixedKeys.has(w.from + '>' + w.to) }));
  const ledsT = {}; Object.keys(Wi.DI_OF_X2).forEach(n => { ledsT['X2:' + n + '.S'] = !!ev.di[Wi.DI_OF_X2[n]]; });
  Object.keys(ev.di).forEach(a => { const tt = Wi.diTerminal(a); if(tt) ledsT[tt] = !!ev.di[a]; });
  return { version: VERSION, taskId: task.id, powered: !!st.mainSwitch && !!(ev.supply && ev.supply.dcOk), wires, links, bridges: (st.bridges || []).slice(), results,
    complete: task.steps.every((x, i) => x.kind !== 'wire' || T().checkStep(x, Object.assign({ answers: {}, tags: ctx.tags, hw: ctx.hw }, ctx), i).ok),   // Verdrahtungsschritte der Aufgabe erfüllt (ohne die Lösung zu zeigen)
    leds: ledsT,                         // Signal-LED je Klemme/Eingang (true = leuchtet)
    sensorLeds: Object.assign({}, ev.sensorLed || {}),   // LED am Sensor
    faults: (ev.faults || []).map(f => ({ code: f.code, part: f.part || null, text: f.text })),
    help: help(task, ctx) };
}

/* ---------- „Zeig mir“ ---------- */
function help(task, ctx){
  const Wi = W(), N = Wi.nets(ctx.state), st = ctx.state;
  const labelOf = id => { if(isCore(id)){ const [pt, pin] = id.split(':'); return 'Ader ' + pin + ' von -' + pt; } const sp = terminalSpec(id); return sp.block === 'X2' ? '-X2:' + sp.row + ' Ebene ' + sp.level : sp.block === 'X1' ? '-X1 ' + sp.level + sp.row : sp.block === 'X3' ? '-X3:' + sp.row + ' ' + sp.label : '-' + sp.block + ' ' + sp.label; };
  // 1. falsch gelegte Adern lösen (Fehlersuche), 2. fehlende Adern legen
  for(const r of removePairs(task)){
    const w = r.part ? st.wires.find(x => x.from.split(':')[0] === r.part || x.to.split(':')[0] === r.part) : st.wires.find(x => (x.from === r.a && x.to === r.b) || (x.from === r.b && x.to === r.a));
    if(!w) continue;
    const core = isCore(w.from) ? w.from : isCore(w.to) ? w.to : null, terminal = core ? (core === w.from ? w.to : w.from) : null;
    return { action: 'wireRemove', core, terminal, from: w.from, to: w.to, step: r.step, text: core ? labelOf(core) + ' von ' + labelOf(terminal) + ' lösen.' : 'Leitung ' + labelOf(w.from) + ' – ' + labelOf(w.to) + ' lösen.' };
  }
  for(const p of targetPairs(task)){
    if(N.same(p.a, p.b) && st.wires.some(w => (w.from === p.a && w.to === p.b) || (w.from === p.b && w.to === p.a))) continue;
    const core = isCore(p.a) ? p.a : isCore(p.b) ? p.b : null, terminal = core ? (core === p.a ? p.b : p.a) : null;
    return { action: 'wireDrop', core, terminal, from: p.a, to: p.b, step: p.step, text: core ? labelOf(core) + ' auf ' + labelOf(terminal) + ' legen.' : 'Leitung ' + labelOf(p.a) + ' nach ' + labelOf(p.b) + ' legen.' };
  }
  return null;
}

/* ---------- Ereignisse → Spielaktionen ---------- */
const EVENTS = {
  wireStart:   '(coreId)             Ader wird gegriffen; das Modul zeigt zulässige Ziele (netlist.allowed).',
  wireDrop:    '(coreId, terminalId)  Ader auf Klemmstelle gelegt → SensorVisual.apply legt die Ader (Aderendhülse automatisch).',
  wireRemove:  '(coreId)             Ader wird gelöst (Papierkorb / aus der Klemme ziehen). apply akzeptiert auch { from, to } für Leitungen zwischen Klemmen.',
  helpShow:    '(coreId, terminalId) „Zeig mir“ wurde ausgelöst; die Zielklemme pulsiert (Daten: state.help).',
  meterProbe:  '(terminalId, probeNr) Messspitze 1 oder 2 auf eine Klemmstelle gelegt (nur mit tools).',
  focus:       '(partId)             Anlage: Kamera fährt zum Bauteil (SensorPlant3D.focus).',
  highlight:   '(ids[])              Anlage: Bauteile hervorheben (SensorPlant3D.highlight).',
  scenePreset: '(name)               Anlage: "sortierstrecke" | "tank" (SensorPlant3D.scenePreset).'
};
function apply(task, ctx, ev){
  const Wi = W(), st = ctx.state;
  if(!ev || !ev.type) return { ok: false, error: 'Ereignis ohne Typ.' };
  if(ev.type === 'wireDrop'){
    const core = ev.core, tid = ev.terminal;
    if(!core || !isCore(core)) return { ok: false, error: 'Unbekannte Ader.' };
    if(!Wi.TERMINALS.includes(tid)) return { ok: false, error: 'Unbekannte Klemmstelle.' };
    st.wires.filter(w => w.from === core || w.to === core).forEach(w => Wi.removeWire(st, w.from, w.to));   // eine Ader hat nur ein freies Ende
    const was = st.mainSwitch; st.mainSwitch = false;
    const r = Wi.addWire(st, core, tid, { ferrule: true }); st.mainSwitch = was;
    // Mechanik automatisch (Umbau: keine Werkzeuge): Querbrücker, die die Aufgabe verlangt, sind gesetzt, sobald die erste Ader liegt
    task.steps.filter(x => x.kind === 'wire').forEach(x => (x.target || []).forEach(rule => { if(rule.bridge && !(st.bridges || []).includes(rule.bridge)) (st.bridges = st.bridges || []).push(rule.bridge); }));
    return r;
  }
  if(ev.type === 'wireRemove'){
    const n = ev.core ? st.wires.filter(w => w.from === ev.core || w.to === ev.core) : st.wires.filter(w => (w.from === ev.from && w.to === ev.to) || (w.from === ev.to && w.to === ev.from));
    n.forEach(w => Wi.removeWire(st, w.from, w.to));
    return { ok: n.length > 0, removed: n.length };
  }
  return { ok: true };
}

/* ---------- Anlage ---------- */
// Felder von SensorScene.setState (scene_sensor.js); alles optional, ausgelassene Felder behalten ihren letzten Wert
const PLANT_FIELDS = {
  beltRunning: 'bool – Förderband läuft', cylinder: 'Zahl 0…1 – Auswerferzylinder ausgefahren', feeder: 'bool – Vereinzeler schiebt',
  parts: 'Liste [{ x: 0…1.3 (Lage auf dem Band, m ab Bandanfang), material: "stahl"|"edelstahl"|"aluminium"|"messing"|"kunststoff_w"|"kunststoff_s"|"glas" }]',
  pump: 'Zahl 0…1 – Pumpendrehzahl', heater: 'bool – Heizstab', level: 'Zahl 0.001…0.6 – Wasserstand im Messtank in m', inflow: 'bool – Zulauf offen', reserveLevel: 'Zahl 0…0.4 – Vorrat (Schwimmer -B9) in m',
  doorOpen: 'bool – Schranktür (wird von der Ansicht gesteuert)', hoodOpen: 'bool – Schutzhaube',
  leds: '{ P1: bool|"blink", P2: … } – Leuchtmelder/LEDs nach BMK', hmi: '{ level: mm, pressure: mbar, temp: °C, flow: l/min } – Anzeigewerte am HMI oder null', aria: 'Text – Meldung am ARIA-Monitor', dist: '{ B1: mm, B2: mm } – Schaltabstände (Sichtbarmachung)'
};
const MATERIALS = ['stahl', 'edelstahl', 'aluminium', 'messing', 'kunststoff_w', 'kunststoff_s', 'glas'];
// Anlagenzustand aus der Auswertung: Bandlage der Werkstücke wie sensor_game.js (SENSOR_AT)
const SENSOR_AT = { B1: 0.29, B2: 0.44, B3: 0.59, 'B4.2': 0.74, B5: 1.11, N1: 0.2 };
function plant(task, ctx, opt){
  opt = opt || {};
  const live = opt.parts || {}, out = opt.outputs || {}, on = !!ctx.state.mainSwitch;
  return {
    beltRunning: on && !!out['Q0.0'], cylinder: on && out['Q0.2'] ? 1 : 0, feeder: on && !!out['Q0.1'],
    parts: Object.keys(live).filter(k => live[k]).map(k => ({ x: SENSOR_AT[k] || 0.5, material: live[k] })),
    pump: on && out['Q0.3'] ? 1 : 0, heater: on && !!out['Q0.5'], leds: { P1: on && !!out['Q0.6'], P2: on && !!out['Q0.7'] },
    aria: opt.aria || 'Ich sehe alles, was du verdrahtest …'
  };
}
const SCENES = { sortierstrecke: { view: 2, show: ['Sortierstrecke', 'Bedienpult'] }, tank: { view: 4, show: ['Tankstation'] } };   // Preset → Kameraansicht (SensorScene.setView) und sichtbare Anlagenteile

root.SensorVisual = { VERSION, netlist, state, help, apply, plant, terminalSpec, coreResults, EVENTS, PLANT_FIELDS, MATERIALS, SCENES, CORE_COLOR, ROLES, SHAPE };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorVisual;
})(typeof window !== 'undefined' ? window : globalThis);
