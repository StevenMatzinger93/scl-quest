// Mock-Daten für die Visualisierung (Paket W3): aus den echten Aufgaben der Sensorwerkstatt erzeugt, damit Fable ohne Spiel arbeiten kann.
// node gen_visual_mock.js          schreibt mock/sensor_visual/mock_all.js (window.SENSOR_VISUAL_MOCK)
// node gen_visual_mock.js --check  prüft, ob die Datei aktuell ist (Test)
const fs = require('fs'), path = require('path');
global.window = global;
require('./src/engine.js'); require('./src/engine_pro.js'); require('./src/kop.js');
require('./src/sensor_model.js'); require('./src/wiring.js'); require('./src/sensor_plc.js'); require('./src/content/_helpers.js');
const T = require('./src/sensor_tasks.js'), SV = require('./src/sensor_visual.js');
const dir = path.join(__dirname, 'src/content_sensor');
['_sensor.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^m\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
require(path.join(dir, 'plan.js'));
const clone = o => JSON.parse(JSON.stringify(o));
const shown = global.SCL_CONTENT.tasks.filter(t => t.workshop && !t.hidden).sort((a, b) => a.level - b.level || a.dispNo - b.dispNo);

// typische Anlagenzustände (Felder von SensorScene.setState) je Anlage
const PLANT = {
  sortierstrecke: {
    aus:     { beltRunning: false, parts: [], cylinder: 0, feeder: false, leds: { P1: false, P2: false }, aria: 'Ich sehe alles, was du verdrahtest …' },
    laeuft:  { beltRunning: true, parts: [{ x: 0.29, material: 'stahl' }, { x: 0.8, material: 'aluminium' }], cylinder: 0, feeder: true, leds: { P1: true, P2: false }, aria: 'Band läuft.' },
    sortiert:{ beltRunning: true, parts: [{ x: 1.11, material: 'kunststoff_w' }], cylinder: 1, feeder: false, leds: { P1: true, P2: false }, aria: 'Teil ausgeworfen.' }
  },
  tank: {
    aus:     { pump: 0, heater: false, inflow: false, level: 0.12, reserveLevel: 0.3, hmi: null, leds: { P1: false, P2: false } },
    laeuft:  { pump: 1, heater: false, inflow: true, level: 0.30, reserveLevel: 0.25, hmi: { level: 300, pressure: 29.4, temp: 22.5, flow: 8.0 }, leds: { P1: true, P2: false } },
    heizt:   { pump: 0.4, heater: true, inflow: false, level: 0.45, reserveLevel: 0.2, hmi: { level: 450, pressure: 44.1, temp: 61.0, flow: 0 }, leds: { P1: true, P2: true } }
  }
};

function build(){
  const out = { version: SV.VERSION, note: 'ERZEUGT von dev/gen_visual_mock.js – nicht von Hand ändern. Echte Daten aus den 30 angezeigten Aufgaben.', modules: {}, tasks: {}, plant: PLANT, plantFields: SV.PLANT_FIELDS, materials: SV.MATERIALS };
  shown.forEach(t => {
    (out.modules[t.level] = out.modules[t.level] || []).push(t.id);
    const ctx0 = T.newContext(t), nl = SV.netlist(t, ctx0), states = {};
    states.start = SV.state(t, ctx0);
    // halb: die erste Hilfe-Ader gelegt
    const ctxH = { state: clone(ctx0.state) }, h = SV.help(t, ctxH);
    if(h && h.core && h.action === 'wireDrop'){ SV.apply(t, ctxH, { type: 'wireDrop', core: h.core, terminal: h.terminal }); states.halb = SV.state(t, ctxH); }
    // fertig: alle Adern der Referenz (per Hilfe-Schleife, wie im Spiel)
    const ctxF = { state: clone(ctx0.state) }; let g = 0, hh;
    while((hh = SV.help(t, ctxF)) && g++ < 60){ if(hh.action === 'wireRemove') SV.apply(t, ctxF, { type: 'wireRemove', core: hh.core, from: hh.from, to: hh.to }); else if(hh.core) SV.apply(t, ctxF, { type: 'wireDrop', core: hh.core, terminal: hh.terminal }); else T.applyWireOps(ctxF.state, { add: [[hh.from, hh.to]] }); }
    ctxF.state.mainSwitch = true; states.fertig = SV.state(t, ctxF, { world: {} });
    // falsch: eine Ader auf die falsche Klemme (erste Ader der Referenz auf die Nachbarebene)
    const first = SV.help(t, { state: clone(ctx0.state) });
    if(first && first.core && first.action === 'wireDrop'){
      const ctxW = { state: clone(ctxF.state) }, wrongT = nl.terminals.find(x => x.id !== first.terminal && x.block === SV.terminalSpec(first.terminal).block && x.relevance !== 'ruhe');
      if(wrongT){ SV.apply(t, ctxW, { type: 'wireDrop', core: first.core, terminal: wrongT.id }); states.falsch = SV.state(t, ctxW); }
    }
    out.tasks[t.id] = { title: t.title, module: t.level, no: t.dispNo, scene: t.scene, phase: t.phase, tools: t.tools, netlist: nl, states };
  });
  return out;
}
const text = '/* ERZEUGT von dev/gen_visual_mock.js – nicht von Hand ändern (node gen_visual_mock.js). */\nwindow.SENSOR_VISUAL_MOCK = ' + JSON.stringify(build()) + ';\n';
const file = path.join(__dirname, 'mock', 'sensor_visual', 'mock_all.js');
if(process.argv.includes('--check')){
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if(cur !== text){ console.log('✗ mock_all.js ist nicht aktuell – node gen_visual_mock.js ausführen'); process.exit(1); }
  console.log('mock_all.js aktuell (' + shown.length + ' Aufgaben, ' + (text.length / 1024).toFixed(0) + ' KB)');
} else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); console.log('mock_all.js geschrieben: ' + shown.length + ' Aufgaben, ' + (text.length / 1024).toFixed(0) + ' KB'); }
