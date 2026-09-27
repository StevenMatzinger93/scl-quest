// Validator Sensorwerkstatt (docs/SENSORWERKSTATT_PLAN.md 8.4): node validate_sensor.js
// Referenz erfüllt alle Schritte (Programme in allen angebotenen Sprachen), Startzustand scheitert, wrong-Varianten scheitern,
// Fehlersuche-Symptome treten im Startzustand auf, Messwerte = Modellwerte, Theorie/Handbuch vorhanden, Modellstützpunkte, Mindestanzahlen.
const fs = require('fs'), path = require('path');
global.window = global;
require('./src/engine.js'); require('./src/engine_pro.js'); require('./src/kop.js');
const SM = require('./src/sensor_model.js'), W = require('./src/wiring.js'), PLC = require('./src/sensor_plc.js');
require('./src/content/_helpers.js');
const T = require('./src/sensor_tasks.js');
const dir = path.join(__dirname, 'src/content_sensor');
['_sensor.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^m\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
['theory.js', 'manual.js'].forEach(f => { if(fs.existsSync(path.join(dir, f))) require(path.join(dir, f)); });
const C = global.SCL_CONTENT, MANUAL = global.MANUAL_IDS || [];
const errors = [], warns = [];
const err = (id, m) => errors.push(id + ': ' + m), warn = (id, m) => warns.push(id + ': ' + m);
const clone = o => JSON.parse(JSON.stringify(o));

// Modellstützpunkte
const R = (sig, range) => SM.rawValue(sig, { type: /mA/.test(range) ? 'I_2W' : 'U', range, diag: { wireBreak: true } });
[[{ kind: 'I', value: 4 }, '4..20mA', 0], [{ kind: 'I', value: 12 }, '4..20mA', 13824], [{ kind: 'I', value: 20 }, '4..20mA', 27648], [{ kind: 'U', value: 5 }, '0..10V', 13824]].forEach(([s, r, want]) => { if(R(s, r) !== want) err('Modell', s.value + ' ' + s.kind + ' → ' + R(s, r) + ', erwartet ' + want); });
// Presets konsistent: kein Kurzschluss L+/M
Object.keys(T.PRESETS).forEach(p => { const st = T.buildState('preset:' + p); if(W.nets(st).same('G1:L+', 'G1:M')) err('Preset ' + p, 'Kurzschluss L+/M'); });

const tasks = C.tasks.filter(t => t.workshop), ids = new Set();
const theoryIds = new Set(C.theory.map(t => t.id));
tasks.forEach(t => {
  if(ids.has(t.id)) err(t.id, 'doppelte ID'); ids.add(t.id);
  ['title', 'story', 'briefing', 'learn', 'takeaway', 'hint', 'hint2'].forEach(k => { if(!t[k]) err(t.id, 'Feld ' + k + ' fehlt'); });
  if(!t.steps.length) err(t.id, 'keine Schritte');
  if(t.manualId && MANUAL.length && !MANUAL.includes(t.manualId)) err(t.id, 'Handbuchseite „' + t.manualId + '“ fehlt');
  if(!t.manualId) err(t.id, 'keine Handbuchseite');
  if(!t.theoryId) err(t.id, 'keine Theorie'); else if(C.theory.length && !theoryIds.has(t.theoryId)) err(t.id, 'Theorie „' + t.theoryId + '“ fehlt');
  (t.parts || []).forEach(p => { if(!W.PARTS[p]) err(t.id, 'unbekanntes Bauteil ' + p); });
  // Startzustand muss scheitern
  const start = T.newContext(t);
  if(t.symptom){
    const st = clone(start.state); st.mainSwitch = true; st.plugs = st.plugs || {};
    (t.symptom.cases || []).forEach(c => { const ev = W.evaluate(st, T.worldFrom(st, c.world)); Object.keys(c.di || {}).forEach(a => { if(!!ev.di[a] !== !!c.di[a]) err(t.id, 'Symptom tritt im Startzustand nicht auf (%' + a + ' = ' + (ev.di[a] ? 1 : 0) + ')'); }); });
  }
  if(T.checkTask(t, start).ok) err(t.id, 'Startzustand besteht bereits');
  // Referenz in jeder Sprache
  const p = t.program, langs = p ? (p.langs || ['scl']) : ['scl'];
  langs.forEach(lang => {
    const ctx = T.applyRef(t, T.newContext(t), lang);
    const r = T.checkTask(t, ctx);
    if(!r.ok) err(t.id, 'Referenz (' + lang + ') scheitert in Schritt ' + (r.first.i + 1) + ' (' + r.first.kind + '): ' + r.first.issues.slice(0, 3).join(' | '));
  });
  // Schrittweise Prüfungen
  t.steps.forEach((s, i) => {
    const tag = t.id + ' Schritt ' + (i + 1);
    if(!s.text) err(tag, 'Schritt ohne Text');
    if(s.kind === 'quiz'){ if(s.options){ if(!(s.correct >= 0 && s.correct < s.options.length)) err(tag, 'correct ausserhalb'); } else if(!isFinite(s.answer)) err(tag, 'Antwort fehlt'); }
    if(s.kind === 'measure') (s.ask || []).forEach((a, j) => { const ctx = T.applyRef(t, T.newContext(t)); const v = T.expectedMeasure(a, ctx); if(!isFinite(v)) err(tag, 'Messwert ' + (j + 1) + ' nicht berechenbar'); if(a.answer != null && a.model && Math.abs(a.answer - a.model(SM)) > (a.tol || 0)) err(tag, 'Musterwert ≠ Modellwert'); });
    if(s.kind === 'wire'){
      // Zustand vor diesem Schritt + wrong statt ref → Schritt muss scheitern
      (s.wrong || []).forEach((wv, j) => {
        const ctx = T.newContext(t); t.steps.slice(0, i).forEach((x, k) => T.applyStepRef(t, x, k, ctx));
        T.applyWireOps(ctx.state, wv);
        if(T.checkStep(s, ctx, i).ok) err(tag, 'wrong ' + (j + 1) + ' besteht');
      });
    }
    if(s.kind === 'program'){
      const ctx = T.applyRef(t, T.newContext(t));
      langs.forEach(lang => {
        if(!(s.ref || {})[lang]) err(tag, 'Referenz ' + lang + ' fehlt');
        const st = (s.start || {})[lang] || '';
        const r0 = T.runProgram(s, lang, st, ctx.tags, ctx.hw); if(r0.ok) err(tag, 'Startcode ' + lang + ' besteht');
        const r1 = T.runProgram(s, lang, (s.ref || {})[lang] || '', ctx.tags, ctx.hw); if(!r1.ok) err(tag, 'Referenz ' + lang + ': ' + (r1.compile ? r1.compile.map(e => e.text).join(' | ') : r1.failed ? T.programFailText(r1.failed) : 'fehlt ' + r1.missing.join(', ')));
      });
      (s.wrong || []).forEach((wv, j) => Object.keys(wv).forEach(lang => { const r = T.runProgram(s, lang, wv[lang], ctx.tags, ctx.hw); if(r.ok) err(tag, 'wrong ' + (j + 1) + ' (' + lang + ') besteht'); }));
      if(!(s.tests || []).length && !(s.timed || []).length) err(tag, 'keine Tests');
    }
  });
});
// Module: je 10 Aufgaben, Nummern 1–10, ein Boss (Nr. 10), Theorie A/B
const mods = [...new Set(tasks.map(t => t.level))].sort((a, b) => a - b);
mods.forEach(m => {
  const ts = tasks.filter(t => t.level === m);
  if(ts.length !== 10) warn('Modul ' + m, ts.length + ' Aufgaben (Ziel 10)');
  const nos = ts.map(t => t.no).sort((a, b) => a - b).join(); if(nos !== ts.map((_, i) => i + 1).join()) err('Modul ' + m, 'Nummern ' + nos);
  if(!ts.some(t => t.no === 10 && (t.isBoss || t.isFinal)) && ts.length === 10) err('Modul ' + m, 'Aufgabe 10 ist kein Boss');
  if(!C.chapters.some(c => c.n === m)) err('Modul ' + m, 'kein Kapitel');
  ['start', 'mid'].forEach(pos => { if(C.theory.length && !C.theory.some(th => th.ch === m && th.pos === pos)) err('Modul ' + m, 'Theorie ' + (pos === 'start' ? 'A' : 'B') + ' fehlt'); });
});
// Theorie: 5 Fragen, correct gültig
// verifyModel: { raw:{ kind:'I'|'U', value, range }, expect } | { detect:{ sensor:{kind, sn, poti, teach}, obj:{material, dist} }, expect } | { calc:'(SM) => …', expect, tol }
function verifyModel(th, i, v){
  let got;
  if(v.raw) got = R({ kind: v.raw.kind, value: v.raw.value }, v.raw.range);
  else if(v.detect) got = SM.detects(v.detect.sensor, v.detect.obj);
  else if(v.calc) got = (0, eval)(v.calc)(SM, W);
  const ok = typeof v.expect === 'number' && typeof got === 'number' ? Math.abs(got - v.expect) <= (v.tol || 0) : got === v.expect;
  if(!ok) err(th.id, 'Frage ' + (i + 1) + ': Modell liefert ' + JSON.stringify(got) + ', Aussage ' + JSON.stringify(v.expect));
}
C.theory.forEach(th => (th.questions || []).forEach((q, i) => { if(q.verifyModel) verifyModel(th, i, q.verifyModel); }));
C.theory.forEach(th => { if((th.questions || []).length < 5) err(th.id, 'weniger als 5 Fragen'); (th.questions || []).forEach((q, i) => { if(q.options && !(q.correct >= 0 && q.correct < q.options.length) && q.type === 'single') err(th.id, 'Frage ' + (i + 1) + ': correct ungültig'); }); });
warns.forEach(w => console.log('Hinweis: ' + w));
if(errors.length){ errors.forEach(e => console.log('✗ ' + e)); console.log(errors.length + ' Fehler'); process.exit(1); }
console.log('OK — keine Fehler (' + tasks.length + ' Werkstatt-Aufgaben, ' + C.theory.length + ' Theorien, ' + mods.length + ' Module)');
