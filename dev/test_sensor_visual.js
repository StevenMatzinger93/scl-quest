// Sensorwerkstatt: Schnittstellenvertrag für die Visualisierung (Paket W3) – node test_sensor_visual.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
global.window = global;
require('./src/engine.js'); require('./src/engine_pro.js'); require('./src/kop.js');
require('./src/sensor_model.js'); require('./src/wiring.js'); require('./src/sensor_plc.js'); require('./src/content/_helpers.js');
const T = require('./src/sensor_tasks.js'), SV = require('./src/sensor_visual.js'), W = global.Wiring;
const dir = path.join(__dirname, 'src/content_sensor');
['_sensor.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^m\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
require(path.join(dir, 'plan.js'));
const C = global.SCL_CONTENT, shown = C.tasks.filter(t => t.workshop && !t.hidden);
let oks = 0, fails = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
const clone = o => JSON.parse(JSON.stringify(o));

shown.forEach(t => {
  const ctx = T.newContext(t), nl = SV.netlist(t, ctx), st = SV.state(t, ctx);
  // Netzliste: serialisierbar, eindeutige Klemmen, Adern gehören zu Bauteilen der Aufgabe, zulässige Ziele existieren
  ok(JSON.stringify(JSON.parse(JSON.stringify(nl))) === JSON.stringify(nl), t.id + ': Netzliste JSON-fähig');
  const ids = nl.terminals.map(x => x.id);
  ok(new Set(ids).size === ids.length && ids.every(id => W.TERMINALS.includes(id)), t.id + ': Klemmen eindeutig und bekannt');
  const cores = nl.parts.flatMap(p => p.cable.cores);
  ok(cores.length === (t.parts || []).reduce((n, p) => n + (W.PARTS[p] ? W.PARTS[p].pins.length : 0), 0) && cores.every(c => c.hex && c.pin), t.id + ': alle Adern der Bauteile mit Farbe');
  ok(cores.every(c => (nl.allowed[c.id] || []).length && nl.allowed[c.id].every(x => ids.includes(x))), t.id + ': zulässige Ziele je Ader');
  const targetT = nl.targets.flatMap(p => [p.a, p.b]).filter(n => !W.PARTS[n.split(':')[0]]);
  ok(targetT.every(n => ids.includes(n)), t.id + ': alle Zielklemmen der Referenz sind im Ausschnitt sichtbar');
  ok(nl.terminals.filter(x => x.relevance === 'ziel').length >= (nl.targets.length ? 1 : 0), t.id + ': Zielklemmen markiert');
  ok(nl.terminals.filter(x => x.block === 'X2' && x.level === 'S').every(x => /^%I\d+\.\d$/.test(x.address)), t.id + ': Signalebenen mit Adresse');
  // Zustand
  ok(st.version === SV.VERSION && Array.isArray(st.wires) && typeof st.results === 'object' && typeof st.leds === 'object', t.id + ': Zustand hat Adern, Ergebnisse, LEDs');
  ok(Object.keys(st.results).every(k => ['ok', 'falsch', 'fehlt', 'gesetzt'].includes(st.results[k])), t.id + ': Ergebnis je Ader ok/falsch/fehlt/gesetzt');
  // Hilfe-Schleife legt die Referenz über die Ereignisse (wie im Spiel): Verdrahtungsschritte müssen danach bestehen
  const c2 = { state: clone(ctx.state), tags: ctx.tags, hw: ctx.hw, answers: {} };
  let g = 0, h; while((h = SV.help(t, c2)) && g++ < 60){ const r = h.action === 'wireRemove' ? SV.apply(t, c2, { type: 'wireRemove', core: h.core, from: h.from, to: h.to }) : h.core ? SV.apply(t, c2, { type: 'wireDrop', core: h.core, terminal: h.terminal }) : (T.applyWireOps(c2.state, { add: [[h.from, h.to]] }), { ok: true }); if(!r.ok){ ok(false, t.id + ': ' + h.action + ' scheitert ' + JSON.stringify(r)); break; } }
  ok(g < 60, t.id + ': Hilfe-Schleife endet');
  const wsteps = t.steps.map((s, i) => [s, i]).filter(([s]) => s.kind === 'wire');
  if(wsteps.length){
    const c3 = T.newContext(t); wsteps.forEach(([s, i]) => T.applyStepRef(t, s, i, c3));   // Referenz
    const via = clone(c2.state); via.bridges = c3.state.bridges.slice(); via.shields = c3.state.shields; via.knives = c3.state.knives; via.plugs = c3.state.plugs;
    ok(wsteps.every(([s, i]) => T.checkStep(s, { state: via, answers: {}, tags: ctx.tags, hw: ctx.hw }, i).ok), t.id + ': Ereignis-Schleife (help → wireDrop) erfüllt die Verdrahtungsschritte');
  }
  const sf = SV.state(t, c2);
  ok(!Object.values(sf.results).includes('falsch'), t.id + ': nach der Schleife keine falsche Ader');
});
// Ereignisse: Ablegen ersetzt das freie Ende, Lösen entfernt, falsche Klemme bleibt „falsch“
{
  const t = C.tasks.find(x => x.id === 'w1_b1_anschliessen'), ctx = T.newContext(t);
  ok(SV.apply(t, ctx, { type: 'wireDrop', core: 'B1:BN', terminal: 'X2:5.M' }).ok && SV.state(t, ctx).results['B1:BN'] === 'falsch', 'wireDrop auf falsche Ebene → Ergebnis „falsch“');
  SV.apply(t, ctx, { type: 'wireDrop', core: 'B1:BN', terminal: 'X2:5.L+' });
  ok(ctx.state.wires.filter(w => w.from === 'B1:BN').length === 1 && SV.state(t, ctx).results['B1:BN'] === 'ok', 'erneutes wireDrop ersetzt die Ader (nur ein freies Ende)');
  ok(SV.apply(t, ctx, { type: 'wireRemove', core: 'B1:BN' }).removed === 1 && SV.state(t, ctx).results['B1:BN'] === 'fehlt', 'wireRemove → „fehlt“');
  ok(!SV.apply(t, ctx, { type: 'wireDrop', core: 'X9:1', terminal: 'X2:5.M' }).ok && !SV.apply(t, ctx, { type: 'wireDrop', core: 'B1:BN', terminal: 'X2:99.M' }).ok, 'unbekannte Ader/Klemme werden abgelehnt');
  // LEDs: Referenz angewendet (verdrahtet, montiert, eingeschaltet), Stahlteil vor -B1 → Signal-LED der Klemme -X2:5 leuchtet
  const cr = T.applyRef(t, T.newContext(t));
  const on = SV.state(t, cr, { world: { parts: { B1: 'stahl' } } }), off = SV.state(t, cr, { world: { parts: {} } });
  ok(on.powered && on.leds['X2:5.S'] === true && off.leds['X2:5.S'] === false && on.leds['A1:DIa.4'] === true, 'Signal-LED der Klemme und des CPU-Eingangs folgt dem Sensor (an/aus)');
  ok(on.complete === true && SV.state(t, T.newContext(t)).complete === false, 'complete: Verdrahtungsschritte erfüllt / nicht erfüllt');
}
// Hilfe
{
  const t = C.tasks.find(x => x.id === 'w1_b1_anschliessen'), h = SV.help(t, T.newContext(t));
  ok(h && h.core === 'B1:BN' && h.terminal === 'X2:5.L+' && /Ader BN von -B1/.test(h.text), 'Zeig mir: erste fehlende Ader mit Klartext (' + (h && h.text) + ')');
}
// Anlage: Felder wie SensorScene.setState
{
  const t = C.tasks.find(x => x.id === 'w1_b1_anschliessen'), ctx = T.newContext(t); ctx.state.mainSwitch = true;
  const p = SV.plant(t, ctx, { outputs: { 'Q0.0': true, 'Q0.6': true }, parts: { B1: 'stahl' } });
  ok(p.beltRunning === true && p.parts.length === 1 && SV.MATERIALS.includes(p.parts[0].material) && p.leds.P1 === true, 'plant(): Band läuft, Werkstück, Leuchtmelder');
  const src = fs.readFileSync(path.join(__dirname, 'src/scene_sensor.js'), 'utf8');
  ok(Object.keys(SV.PLANT_FIELDS).every(k => src.includes('sim.' + k) || ['doorOpen', 'hoodOpen', 'leds', 'hmi', 'aria', 'dist'].includes(k)), 'PLANT_FIELDS stimmen mit den sim-Feldern in scene_sensor.js überein');
  ok(Object.keys(p).every(k => k in SV.PLANT_FIELDS), 'plant() liefert nur dokumentierte Felder');
}
// Mock-Daten aktuell
{
  const r = cp.spawnSync('node', [path.join(__dirname, 'gen_visual_mock.js'), '--check'], { encoding: 'utf8' });
  ok(r.status === 0, 'mock/sensor_visual/mock_all.js ist aktuell' + (r.status ? ': ' + r.stdout : ''));
  const M = (() => { const g = {}; new Function('window', fs.readFileSync(path.join(__dirname, 'mock/sensor_visual/mock_all.js'), 'utf8'))(g); return g.SENSOR_VISUAL_MOCK; })();
  ok(Object.keys(M.tasks).length === 30 && Object.keys(M.modules).length === 6 && Object.values(M.modules).every(a => a.length === 5), 'Mock: 30 Aufgaben in 6 Modulen');
  ok(Object.values(M.tasks).every(x => x.states.start && x.states.fertig && x.states.fertig.complete), 'Mock: je Aufgabe Zustände start und fertig (Adern vollständig)');
}
console.log('Visualisierungsvertrag: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
process.exit(fails ? 1 : 0);
