(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Verdrahtung als Netzliste (docs/SENSORWERKSTATT_PLAN.md Teil 3.1–3.5)
   Knoten = Klemmstellen („B1:BN“, „X2:5.L+“, „A1:DIa.4“), Kanten = Adern, Querbrücker, interne Verbindungen.
   Bewertet wird die elektrische Funktion (welche Klemmstellen liegen auf demselben Potential), nicht die exakte Klemme.
   Speicherformat: { wires:[{from, to, ferrule, label}], bridges:['QB_X2_LP', …], mounts:{B1:{dist, tight}}, plugs:{B1:true}, config:{…}, knives:{'X3:1':true}, shields:{B11:true} }
   Klemmenbezeichnungen der S7-Module: docs/SENSORWERKSTATT_FAKTEN.md ([prüfen]).
   ============================================================ */
const SM = root.SensorModel;

/* ---------- Katalog: Bauteile und ihre Anschlüsse ---------- */
// pins: Name → Bedeutung; wires: Adern der Anschlussleitung (M12 oder Litze)
const PARTS = {
  B1:  { name: 'Induktiver Sensor M18, bündig, PNP NO, Sn 8 mm', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.4', sensor: { kind: 'ind', sn: 8, out: 'PNP', contact: 'NO' } },
  B2:  { name: 'Kapazitiver Sensor M18, PNP NO, Sn 1–8 mm', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.5', sensor: { kind: 'kap', sn: 8, out: 'PNP', contact: 'NO', poti: 0.5 } },
  B3:  { name: 'Lichttaster mit Hintergrundausblendung, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.6', sensor: { kind: 'opt_bgs', sn: 120, out: 'PNP', contact: 'NO' } },
  'B4.1': { name: 'Einweg-Lichtschranke Sender', type: 'sender', pins: ['BN', 'BU'] },
  'B4.2': { name: 'Einweg-Lichtschranke Empfänger, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.7', sensor: { kind: 'opt_einweg', out: 'PNP', contact: 'NO' } },
  B5:  { name: 'Reflexions-Lichtschranke, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I1.0', sensor: { kind: 'opt_reflex', out: 'PNP', contact: 'NO' } },
  B6:  { name: 'Zylinderschalter hinten, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I1.1', sensor: { kind: 'zylinder', sn: 3, out: 'PNP', contact: 'NO' } },
  B7:  { name: 'Zylinderschalter vorne, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I1.2', sensor: { kind: 'zylinder', sn: 3, out: 'PNP', contact: 'NO' } },
  B8:  { name: 'Kapazitiver Grenzschalter „Tank voll“, PNP, als Öffner', type: 'sensor4', out: 'PNP', pins: ['BN', 'BU', 'BK', 'WH'], di: 'I1.4', sensor: { kind: 'kap', sn: 8, out: 'PNP', contact: 'antivalent', poti: 0.5 } },
  B9:  { name: 'Schwimmerschalter Trockenlauf (Reed)', type: 'contact2', pins: ['1', '2'], di: 'I1.5' },
  S1:  { name: 'Taster Start (Schliesser)', type: 'contact2', contact: 'NO', pins: ['13', '14'], di: 'I0.0' },
  S2:  { name: 'Taster Stopp (Öffner)', type: 'contact2', contact: 'NC', pins: ['11', '12'], di: 'I0.1' },
  S3:  { name: 'Not-Halt Kanal 2 (Öffner)', type: 'contact2', contact: 'NC', pins: ['21', '22'], di: 'I0.2' },
  S4:  { name: 'Wahlschalter Auto (Schliesser)', type: 'contact2', contact: 'NO', pins: ['13', '14'], di: 'I0.3' },
  S5:  { name: 'Sicherheits-Positionsschalter Haube (Öffner)', type: 'contact2', contact: 'NC', pins: ['11', '12'], di: 'I1.3' },
  N1:  { name: 'NPN-Sensor (Übung, minusschaltend NO)', type: 'sensor3', out: 'NPN', pins: ['BN', 'BU', 'BK'], di: 'I16.0', sensor: { kind: 'ind', sn: 8, out: 'NPN', contact: 'NO' } },
  B10: { name: 'Ultraschall M30, 0–10 V', type: 'analogU', pins: ['BN', 'BU', 'BK'], ai: 'AI0' },
  B11: { name: 'Drucktransmitter 0–100 mbar, 4–20 mA, 2-Leiter', type: 'analog2w', pins: ['+', '-'], ai: 'CH0' },
  B12: { name: 'PT100 mit Kopftransmitter 0–100 °C, 4–20 mA, 2-Leiter', type: 'analog2w', pins: ['+', '-'], ai: 'CH1' },
  B13: { name: 'MID 0–20 l/min, 4–20 mA, 4-Leiter (aktiv)', type: 'analog4w', pins: ['L+', 'M', 'I+', 'I-'], ai: 'CH2' },
  R1:  { name: 'Sollwertsteller 0–10 V (Potentiometer)', type: 'poti', pins: ['1', '2', '3'], ai: 'AI1' }
};
// Klemmen im Schrank. Knoten-IDs: „X1:L+3“, „X2:5.L+“, „X2:5.S“, „X2:5.M“, „X3:1.a“ (Feld), „X3:1.b“ (SPS), „A1:DIa.4“ …
const X2N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 22, 23, 24, 25, 26, 27, 28];
const DI_OF_X2 = { 1: 'I0.0', 2: 'I0.1', 3: 'I0.2', 4: 'I0.3', 5: 'I0.4', 6: 'I0.5', 7: 'I0.6', 8: 'I0.7', 9: 'I1.0', 10: 'I1.1', 11: 'I1.2', 12: 'I1.3', 13: 'I1.4', 14: 'I1.5', 21: 'I16.0', 22: 'I16.1', 23: 'I16.2', 24: 'I16.3', 25: 'I16.4', 26: 'I16.5', 27: 'I16.6', 28: 'I16.7' };
// Eingänge der CPU (1214C: DIa .0–.7 = I0.0–I0.7, DIb .0–.5 = I1.0–I1.5) und der SM 1221 (A4 .0–.7 = I16.0–I16.7)
function diTerminal(addr){
  const m = /^I(\d+)\.(\d)$/.exec(addr); if(!m) return null;
  const by = +m[1], bit = +m[2];
  if(by === 0) return 'A1:DIa.' + bit;
  if(by === 1 && bit <= 5) return 'A1:DIb.' + bit;
  if(by === 16) return 'A4:.' + bit;
  return null;
}
function terminals(){
  const t = ['G1:L+', 'G1:M', 'F2:1', 'F2:2', 'F3:1', 'F3:2'];
  for(let i = 1; i <= 8; i++){ t.push('X1:L+' + i, 'X1:M' + i); }
  X2N.forEach(n => ['L+', 'S', 'M'].forEach(l => t.push('X2:' + n + '.' + l)));
  for(let i = 1; i <= 8; i++) t.push('X3:' + i + '.a', 'X3:' + i + '.b');
  t.push('A1:L+', 'A1:M', 'A1:1M', 'A1:2M', 'A1:AI0', 'A1:AI1', 'A1:3L+', 'A1:3M', 'A1:SL+', 'A1:SM');
  for(let b = 0; b < 8; b++) t.push('A1:DIa.' + b);
  for(let b = 0; b < 6; b++) t.push('A1:DIb.' + b);
  t.push('A2:L+', 'A2:M'); for(let c = 0; c < 4; c++) t.push('A2:' + c + '+', 'A2:' + c + '-');
  t.push('A3:L+', 'A3:M'); for(let c = 0; c < 2; c++) t.push('A3:' + c, 'A3:' + c + 'M');
  t.push('A4:1M', 'A4:2M'); for(let b = 0; b < 8; b++) t.push('A4:.' + b);
  Object.keys(PARTS).forEach(p => PARTS[p].pins.forEach(pin => t.push(p + ':' + pin)));
  return t;
}
const TERMINALS = terminals(), TSET = new Set(TERMINALS);
// Querbrücker: verbinden die L+- bzw. M-Ebenen aller Klemmen einer Leiste mit dem Verteiler X1
const BRIDGES = {
  QB_X2_LP: { name: 'Querbrücker X2 Ebene L+', nodes: ['X1:L+1'].concat(X2N.map(n => 'X2:' + n + '.L+')) },
  QB_X2_M:  { name: 'Querbrücker X2 Ebene M', nodes: ['X1:M1'].concat(X2N.map(n => 'X2:' + n + '.M')) }
};
// feste interne Verbindungen (Verteiler, Netzteil über Sicherungen, Trennmesser geschlossen)
function internal(state){
  const e = [];
  for(let i = 2; i <= 8; i++){ e.push(['X1:L+1', 'X1:L+' + i]); e.push(['X1:M1', 'X1:M' + i]); }
  e.push(['G1:L+', 'F2:1'], ['G1:L+', 'F3:1'], ['F2:2', 'X1:L+1'], ['G1:M', 'X1:M1']);
  if(!state.f2Tripped) e.push(['F2:1', 'F2:2']);          // Sicherung Sensoren (ausgelöst = offen)
  if(!state.f3Tripped) e.push(['F3:1', 'F3:2']);          // Sicherung Aktoren
  e.push(['A1:SL+', 'G1:L+'], ['A1:SM', 'G1:M']);   // Geberversorgung der CPU (Vereinfachung: gleiches 24-V-Netz)
  for(let i = 1; i <= 8; i++) if(!(state.knives && state.knives['X3:' + i])) e.push(['X3:' + i + '.a', 'X3:' + i + '.b']);   // Trennmesser zu
  return e;
}

/* ---------- Netzliste (Union-Find) ---------- */
function nets(state){
  const parent = {};
  const find = x => { while(parent[x] !== undefined && parent[x] !== x){ parent[x] = parent[parent[x]] !== undefined ? parent[parent[x]] : parent[x]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if(ra !== rb) parent[ra] = rb; };
  TERMINALS.forEach(t => { parent[t] = t; });
  internal(state).forEach(([a, b]) => union(a, b));
  (state.bridges || []).forEach(id => { const b = BRIDGES[id]; if(b) b.nodes.forEach(n => union(b.nodes[0], n)); });
  (state.wires || []).forEach(w => { if(TSET.has(w.from) && TSET.has(w.to)) union(w.from, w.to); });
  const same = (a, b) => find(a) === find(b);
  return { find, same, isLP: n => same(n, 'G1:L+'), isM: n => same(n, 'G1:M') };
}
// Potential eines Knotens: 'L+', 'M', 'L+M' (Kurzschluss) oder null (offen)
function potential(N, node){ const lp = N.isLP(node), m = N.isM(node); return lp && m ? 'L+M' : lp ? 'L+' : m ? 'M' : null; }

/* ---------- Auflegen (Handlungen) mit Arbeitsregeln ---------- */
const LEVELS = ['schnell', 'werkstatt', 'profi'];
function newState(preset){ return Object.assign({ wires: [], bridges: [], mounts: {}, plugs: {}, config: {}, knives: {}, shields: {}, level: 'werkstatt', mainSwitch: false, penalties: [] }, preset ? JSON.parse(JSON.stringify(preset)) : {}); }
// Querbrücker sitzen im Brückenschacht der Klemme und belegen keine Klemmstelle.
// Signalebene der Initiatorenklemme (X2:n.S) = Durchgangsklemme mit zwei Klemmstellen (Feld- und SPS-Seite).
function occupants(state, node){ return state.wires.filter(w => w.from === node || w.to === node).length; }
const capacity = node => /^X2:\d+\.S$/.test(node) ? 2 : 1;
function isBridgeLevel(state, node){ return (state.bridges || []).some(id => BRIDGES[id].nodes.slice(1).includes(node)); }
// Ader auflegen. Rückgabe { ok, warnings:[…], error } — bei Fehlern (Profi-Regeln) wird nichts geändert
function addWire(state, from, to, opt){
  opt = opt || {};
  const out = { ok: true, warnings: [] };
  if(!TSET.has(from) || !TSET.has(to)) return { ok: false, error: 'Unbekannte Klemmstelle.' };
  if(from === to) return { ok: false, error: 'Anfang und Ende sind dieselbe Klemmstelle.' };
  const lvl = state.level || 'werkstatt';
  if(state.mainSwitch){
    if(lvl === 'profi') return { ok: false, error: 'Nur im spannungsfreien Zustand verdrahten: zuerst -Q0 ausschalten.' };
    if(lvl === 'werkstatt'){ out.warnings.push('Unter Spannung verdrahtet! (Sicherheits-Minuspunkt)'); state.penalties.push('spannung'); }
    else out.warnings.push('Achtung: Die Anlage steht unter Spannung.');
  }
  [from, to].forEach(n => { if(!isPartPin(n) && occupants(state, n) >= capacity(n)) out.warnings.push(n + ': schon belegt – für zwei Leiter Querbrücker oder Doppelstock-Klemme verwenden.'); });
  const ferrule = opt.ferrule !== undefined ? !!opt.ferrule : lvl === 'schnell';
  if(!ferrule && lvl !== 'schnell') out.warnings.push('Feindrähtige Ader ohne Aderendhülse – Wackelkontakt möglich.');
  state.wires.push({ from, to, ferrule, label: opt.label || '' });
  return out;
}
function removeWire(state, from, to){ const i = state.wires.findIndex(w => (w.from === from && w.to === to) || (w.from === to && w.to === from)); if(i >= 0) state.wires.splice(i, 1); return i >= 0; }
function removePart(state, part){ const n = state.wires.length; state.wires = state.wires.filter(w => !w.from.startsWith(part + ':') && !w.to.startsWith(part + ':')); return n - state.wires.length; }
const isPartPin = n => !!PARTS[n.split(':')[0]];

/* ---------- Elektrische Auswertung ---------- */
// Digitale Eingänge: Wert je Adresse aus Sensor-/Kontaktzustand, Verdrahtung, Bezugspotential und Versorgung
// world: { B1:{active:true} | S1:{pressed:true}, … }  opts: { t, seed }
function evaluate(state, world, opts){
  world = world || {}; opts = opts || {};
  const N = nets(state), res = { di: {}, leds: {}, sensorLed: {}, faults: [], supply: null, ai: {}, hot: [] };   // hot: Knoten, an denen ein aktives 24-V-Signal anliegt (LEDs der Klemmen)
  // Kurzschluss L+/M?
  const short = N.same('G1:L+', 'G1:M');
  const sup = SM.supply({ lplusToM: short });
  res.supply = sup;
  if(short) res.faults.push({ code: 'psu_overload', text: '-G1: Überlast – L+ und M kurzgeschlossen, „DC OK“ aus.' });
  const on = !!state.mainSwitch && sup.dcOk;
  const potOf = n => on ? potential(N, n) : null;
  // welche Signal-Knoten liegen an welchem DI?
  const diAddr = {}; Object.keys(DI_OF_X2).forEach(k => { const a = DI_OF_X2[k], t = diTerminal(a); if(t) diAddr[a] = t; });
  const groupRef = { A1: potOf('A1:1M'), A4lo: potOf('A4:1M'), A4hi: potOf('A4:2M') };
  const refOf = term => term.startsWith('A4:') ? (+term.slice(-1) <= 3 ? groupRef.A4lo : groupRef.A4hi) : groupRef.A1;
  Object.keys(diAddr).forEach(a => { res.di[a] = false; });
  Object.keys(PARTS).forEach(id => {
    const P = PARTS[id], w = world[id] || {};
    if(P.type === 'sensor3' || P.type === 'sensor4'){
      const bn = potOf(id + ':BN'), bu = potOf(id + ':BU');
      if(!state.plugs || state.plugs[id] === false) return;
      const powered = bn === 'L+' && bu === 'M', reversed = bn === 'M' && bu === 'L+';
      const out = SM.outputs(P.sensor, !!w.active);
      ['BK', 'WH'].forEach(pin => {
        if(!P.pins.includes(pin) || out[pin] == null) return;
        const node = id + ':' + pin, p = potential(N, node);
        const loose = (state.plugs && state.plugs[id] === 'loose') || wireLoose(state, node);
        const dropout = loose && SM.looseContact(id + pin, opts.t || 0);
        if(on && powered && P.out === 'PNP' && out[pin] && p !== 'M' && !dropout) res.hot.push(node);
        if(on && p === 'M' && P.out === 'PNP' && out[pin]) res.faults.push({ code: 'short_output', part: id, text: id + ': Schaltausgang auf M – Kurzschlussschutz, LED blinkt.' });
        const dis = Object.keys(diAddr).filter(a => N.same(node, diAddr[a]));
        dis.forEach(a => {
          const r = SM.digitalInput({ out: P.out, group1M: refOf(diAddr[a]), active: !!out[pin], supply: on && powered, fault: reversed ? 'swap_bn_bu' : (p === 'M' && P.out === 'PNP') ? 'bk_on_m' : null, dropout });
          res.di[a] = res.di[a] || r.value;
          res.sensorLed[id] = r.sensorLed;
        });
        if(!dis.length) res.sensorLed[id] = on && powered ? !!out[pin] : false;
      });
      if(on && reversed) res.faults.push({ code: 'reversed', part: id, text: id + ': BN und BU vertauscht – Sensor ohne Funktion.' });
    }
    if(P.type === 'contact2'){
      const closed = P.contact === 'NC' ? !w.pressed && !w.open : !!w.pressed;
      const a = id + ':' + P.pins[0], b = id + ':' + P.pins[1];
      if(!closed) return;
      // Kontakt schaltet L+ weiter: ein Anschluss an L+, der andere an einen Eingang
      [[a, b], [b, a]].forEach(([src, dst]) => {
        if(potOf(src) !== 'L+') return;
        res.hot.push(dst);
        Object.keys(diAddr).forEach(addr => { if(N.same(dst, diAddr[addr]) && refOf(diAddr[addr]) === 'M' && !wireLoose(state, dst)) res.di[addr] = true; });
      });
    }
  });
  Object.keys(res.di).forEach(a => { res.leds[a] = res.di[a]; });
  return res;
}
function wireLoose(state, node){ return state.wires.some(w => (w.from === node || w.to === node) && !w.ferrule && (state.level || 'werkstatt') !== 'schnell'); }

/* ---------- Analog: Signal an einem AI-Kanal aus der Verdrahtung ---------- */
// Liefert die elektrische Grösse an den Klemmen des Kanals (für SensorModel.rawValue)
function analogAt(state, channel, phys){
  const N = nets(state), on = !!state.mainSwitch && !N.same('G1:L+', 'G1:M');
  const pos = channel.startsWith('AI') ? 'A1:' + channel : 'A2:' + channel.slice(2) + '+';
  const neg = channel.startsWith('AI') ? 'A1:2M' : 'A2:' + channel.slice(2) + '-';
  for(const id of Object.keys(PARTS)){
    const P = PARTS[id]; if(!P.ai) continue;
    const x = phys && phys[id] != null ? phys[id] : 0;
    if(P.type === 'analog2w'){
      // 2-Leiter: L+ → Transmitter + ; Transmitter − → AI x+ ; AI x− → M
      const plus = id + ':+', minus = id + ':-';
      if(!N.same(minus, pos)) continue;
      const loop = on && N.isLP(plus) && N.isM(neg) ? 'ok' : N.isLP(plus) ? 'no_return' : 'no_supply';
      return { part: id, sig: loop === 'ok' ? SM.transmitterSignal(id, x) : { kind: 'I', value: 0 }, loop };
    }
    if(P.type === 'analog4w'){
      const sup = on && N.isLP(id + ':L+') && N.isM(id + ':M');
      if(N.same(id + ':I+', pos) && N.same(id + ':I-', neg)) return { part: id, sig: SM.transmitterSignal(id, x, { powered: sup }), loop: sup ? 'ok' : 'no_supply' };
      if(N.same(id + ':I-', pos) || N.same(id + ':L+', pos)) return { part: id, sig: { kind: 'I', value: 0 }, loop: 'as_2wire' };   // wie 2-Leiter angeschlossen
      continue;
    }
    if(P.type === 'analogU' || P.type === 'poti'){
      const sigPin = P.type === 'poti' ? id + ':2' : id + ':BK', gnd = P.type === 'poti' ? id + ':3' : id + ':BU', sup = P.type === 'poti' ? id + ':1' : id + ':BN';
      if(!N.same(sigPin, pos)) continue;
      const okSup = on && N.isLP(sup) && N.isM(gnd) && N.same(gnd, neg);
      return { part: id, sig: okSup ? (P.type === 'poti' ? { kind: 'U', value: SM.signal('U0_10', x, 0, 100) } : SM.transmitterSignal(id, x)) : { kind: 'U', value: 0 }, loop: okSup ? 'ok' : 'no_supply' };
    }
  }
  return { part: null, sig: null, loop: 'open' };
}

/* ---------- Prüfung gegen Funktionsanforderungen (Plan 3.5) ---------- */
/* target: [{ net:['B11:+', 'POT:L+'] } | { net:['B1:BK', 'DI:I0.4'] } | { notNet:[…] } | { bridge:'QB_X2_LP' } | { ferrules:true } | { shield:'B11' } | { knife:'X3:1', closed:true }]
   Pseudoknoten: POT:L+, POT:M, DI:<Adresse>, AI:<Kanal>+/- */
function resolve(n){
  if(n === 'POT:L+') return 'G1:L+';
  if(n === 'POT:M') return 'G1:M';
  if(n.startsWith('DI:')) return diTerminal(n.slice(3));
  if(n.startsWith('AI:')){ const c = n.slice(3); return c.startsWith('AI') ? 'A1:' + c.replace(/[+-]$/, '') : 'A2:' + c.replace(/^CH/, ''); }
  return n;
}
function check(state, target){
  const N = nets(state), issues = [];
  (target || []).forEach(r => {
    if(r.net){ const ns = r.net.map(resolve); for(let i = 1; i < ns.length; i++) if(!ns[0] || !ns[i] || !N.same(ns[0], ns[i])){ issues.push({ rule: r, text: r.msg || describeNet(r.net) }); break; } }
    if(r.notNet){ const ns = r.notNet.map(resolve); if(ns[0] && ns[1] && N.same(ns[0], ns[1])) issues.push({ rule: r, text: r.msg || (r.notNet.join(' und ') + ' dürfen nicht verbunden sein.') }); }
    if(r.bridge && !(state.bridges || []).includes(r.bridge)) issues.push({ rule: r, text: r.msg || BRIDGES[r.bridge].name + ' fehlt.' });
    if(r.shield && (state.level === 'profi' || r.always) && !(state.shields || {})[r.shield]) issues.push({ rule: r, text: r.msg || '-' + r.shield + ': Schirm nicht aufgelegt.' });
    if(r.knife && !!(state.knives || {})[r.knife] === !!r.closed) issues.push({ rule: r, text: r.msg || r.knife + ': Trennmesser ' + (r.closed ? 'offen' : 'geschlossen') + '.' });
  });
  // allgemeine Regeln
  if(N.same('G1:L+', 'G1:M')) issues.push({ text: 'Kurzschluss zwischen L+ und M.' });
  const lvl = state.level || 'werkstatt';
  if(lvl !== 'schnell'){
    const count = {};
    state.wires.forEach(w => [w.from, w.to].forEach(n => { if(!isPartPin(n)) count[n] = (count[n] || 0) + 1; }));
    Object.keys(count).forEach(n => { if(count[n] > capacity(n)) issues.push({ text: n + ': zwei Leiter an einer Klemmstelle.' }); });
    const noHuelse = state.wires.filter(w => !w.ferrule).length;
    if(noHuelse && lvl === 'profi') issues.push({ text: noHuelse + ' Ader(n) ohne Aderendhülse.' });
  }
  return { ok: !issues.length, issues };
}
function describeNet(ns){
  const [a, b] = ns;
  const nice = n => n === 'POT:L+' ? 'L+' : n === 'POT:M' ? 'M' : n.startsWith('DI:') ? 'Eingang %' + n.slice(3) : n.startsWith('AI:') ? 'Analogkanal ' + n.slice(3) : '-' + n;
  if(/:\+$|:-$/.test(a) && (b === 'POT:L+' || b.startsWith('AI:'))) return nice(a).split(':')[0] + ': Stromschleife nicht geschlossen.';
  return nice(a) + ' ist nicht mit ' + nice(b) + ' verbunden.';
}
// Sichtprüfung: offene Adern (nur ein Ende an einer Klemme ist hier nicht möglich) → Bauteilpins ohne Ader
function visualCheck(state, parts){
  const used = new Set(); state.wires.forEach(w => { used.add(w.from); used.add(w.to); });
  const open = [];
  (parts || Object.keys(PARTS)).forEach(id => PARTS[id].pins.forEach(p => { if(!used.has(id + ':' + p)) open.push(id + ':' + p); }));
  return open;
}
// Durchgangsprüfung (Multimeter, spannungsfrei)
function continuity(state, a, b){ if(state.mainSwitch) return { error: 'Durchgang nur spannungsfrei messen (-Q0 aus).' }; const N = nets(state); return { beep: N.same(a, b) }; }
// Spannungsmessung (Multimeter V DC) zwischen zwei Knoten
function voltage(state, a, b){
  const N = nets(state), on = !!state.mainSwitch && !N.same('G1:L+', 'G1:M');
  if(!on) return 0;
  const v = n => N.isLP(n) ? 24 : N.isM(n) ? 0 : null;
  const va = v(a), vb = v(b);
  return va == null || vb == null ? 0 : va - vb;
}
function serialize(state){ const s = Object.assign({}, state); delete s.penalties; return JSON.stringify(s); }
function deserialize(text){ return newState(JSON.parse(text)); }

root.Wiring = { PARTS, TERMINALS, BRIDGES, X2N, DI_OF_X2, LEVELS, diTerminal, nets, potential, newState, addWire, removeWire, removePart,
  evaluate, analogAt, check, resolve, visualCheck, continuity, voltage, serialize, deserialize };
if(typeof module !== 'undefined' && module.exports) module.exports = root.Wiring;
})(typeof window !== 'undefined' ? window : globalThis);
