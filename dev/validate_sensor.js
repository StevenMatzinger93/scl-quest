// Validator Sensorwerkstatt (docs/SENSORWERKSTATT_PLAN.md 8.4, Umbau W2): node validate_sensor.js [--strict]
// Textlimits (Story ≤ 2 Sätze, Auftrag ≤ 25 Wörter, Infokarte ≤ 3 Sätze) sind Fehler; --lax macht sie zu Hinweisen.
// Referenz erfüllt alle Schritte (Programme in allen angebotenen Sprachen), Startzustand scheitert, wrong-Varianten scheitern,
// Fehlersuche-Symptome treten im Startzustand auf, Messwerte = Modellwerte, Theorie/Handbuch vorhanden, Modellstützpunkte, Mindestanzahlen.
const fs = require('fs'), path = require('path');
global.window = global;
require('./src/engine.js'); require('./src/engine_pro.js'); require('./src/kop.js');
const SM = require('./src/sensor_model.js'), W = require('./src/wiring.js'), PLC = require('./src/sensor_plc.js');
require('./src/content/_helpers.js');
const T = require('./src/sensor_tasks.js'), F = require('./src/sensor_flow.js');
const dir = path.join(__dirname, 'src/content_sensor');
['_sensor.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^m\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
['plan.js', 'texte.js', 'theory.js', 'manual.js'].forEach(f => { if(fs.existsSync(path.join(dir, f))) require(path.join(dir, f)); });
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
  (t.modules || []).forEach(m => { if(!['A1', 'A2', 'A3', 'A4'].includes(m)) err(t.id, 'unbekannte Baugruppe ' + m); });
  (t.x2 || []).forEach(n => { if(!W.X2N.includes(n)) err(t.id, 'unbekannte Klemme -X2:' + n); });
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
        const ctx = T.newContext(t, { noPrefill: true }); t.steps.slice(0, i).forEach((x, k) => T.applyStepRef(t, x, k, ctx));
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
/* ---------- Format v2 (W2): die angezeigten 30 Aufgaben ---------- */
const STRICT = !process.argv.includes('--lax');   // seit W7: Textlimits und Infokarte sind Fehler (--lax = nur Hinweis)
const shown = tasks.filter(t => !t.hidden);
const plan = global.SW_PLAN || [];
if(!plan.length) err('Plan', 'content_sensor/plan.js fehlt oder ist leer');
{
  const pid = plan.map(x => x[0]); const dup = pid.filter((x, i) => pid.indexOf(x) !== i);
  if(dup.length) err('Plan', 'doppelte IDs: ' + dup.join(', '));
  pid.forEach(id => { if(!tasks.some(t => t.id === id)) err('Plan', 'unbekannte Aufgabe ' + id); });
  if(shown.length !== 30) err('Plan', shown.length + ' angezeigte Aufgaben (Ziel 30)');
  tasks.filter(t => t.hidden && pid.includes(t.id)).forEach(t => err(t.id, 'im Plan, aber hidden'));
  tasks.filter(t => !t.hidden && !pid.includes(t.id)).forEach(t => err(t.id, 'angezeigt, aber nicht im Plan'));
}
const TANKPART = /^B1[0-3]$|^(E1|M2|TANK|T2|MB3|MB4|MB5)$/;   // eindeutig Tankstation; B8/B9 kommen auch an der Sortierstrecke vor
const words = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter(Boolean).length;
const sentences = h => (String(h || '').replace(/<[^>]+>/g, ' ').replace(/\b(z\.\s?B|ca|bzw|Nr|Sn|Sr)\./g, '$1').match(/[^.!?]+[.!?]+(\s|$)/g) || [String(h || '')]).filter(x => x.trim()).length;
let overWords = 0, overSent = 0;
shown.forEach(t => {
  const id = t.id, PHASES = T.PHASES;
  if(!t.core) err(id, 'core fehlt');
  const foc = T.focusOf(t);
  if(!foc || !foc.length) { err(id, 'phase fehlt oder ungültig'); return; }
  if(t.hidden) err(id, 'hidden');
  if(!t.dispNo) err(id, 'keine angezeigte Nummer');
  // Werkzeuge
  (t.tools || []).forEach(x => { if(!T.TOOLS_ALLOWED.includes(x)) err(id, 'Werkzeug „' + x + '“ nicht erlaubt (nur ' + T.TOOLS_ALLOWED.join(', ') + ')'); });
  const asks = t.steps.filter(s => s.kind === 'measure').flatMap(s => (s.ask || []).map(a => a.q || ''));
  if(asks.some(q => /Kalibrator/.test(q)) && !(t.tools || []).includes('kalibrator')) err(id, 'Messaufgabe mit Kalibrator, aber tools ohne kalibrator');
  if(asks.some(q => /gegen M|Spannung an/.test(q)) && !(t.tools || []).includes('multimeter')) err(id, 'Messaufgabe mit Multimeter, aber tools ohne multimeter');
  if((t.tools || []).length && !t.steps.some(s => s.kind === 'measure')) err(id, 'tools gesetzt, aber kein Messschritt');
  // Anlage
  if(!['sortierstrecke', 'tank'].includes(t.scene)) err(id, 'scene fehlt oder ungültig');
  else { const tank = (t.parts || []).some(p => TANKPART.test(p)); if((tank && t.scene !== 'tank') || (t.scene === 'tank' && t.level <= 3) || (!tank && t.level <= 3 && t.scene !== 'sortierstrecke')) err(id, 'scene „' + t.scene + '“ passt nicht zu Modul ' + t.level + ' / Bauteilen ' + (t.parts || []).join(',')); }
  // Programmiersprachen
  const pl = t.program ? (t.program.langs || ['scl']) : null;
  if(!Array.isArray(t.lang) || t.lang.some(l => !['scl', 'fup'].includes(l))) err(id, 'lang muss aus scl/fup bestehen');
  else if(pl && JSON.stringify(pl) !== JSON.stringify(t.lang)) err(id, 'lang ' + JSON.stringify(t.lang) + ' ≠ Sprachen des Programmschritts ' + JSON.stringify(pl));
  // Vorbefüllung: jede Phase mit Schritten ist Schwerpunkt oder vorbefüllt (ausser Laufen lassen: das ist der Probelauf)
  const pre = T.prefillOf(t);
  PHASES.forEach(ph => {
    const st = T.stepsOfPhase(t, ph);
    if(pre.includes(ph) && !st.length) err(id, 'prefill „' + ph + '“ ohne Schritte');
    if(ph !== 'laufen' && st.length && !foc.includes(ph) && !pre.includes(ph)) err(id, 'Phase „' + ph + '“ hat Schritte, ist aber weder Schwerpunkt noch vorbefüllt');
    if(pre.includes(ph) && foc.includes(ph)) err(id, 'Phase „' + ph + '“ ist Schwerpunkt und zugleich vorbefüllt');
  });
  const start = T.newContext(t);
  pre.forEach(ph => T.stepsOfPhase(t, ph).forEach(i => { const r = T.checkStep(t.steps[i], start, i); if(!r.ok) err(id, 'vorbefüllte Phase „' + ph + '“ erfüllt im Startzustand Schritt ' + (i + 1) + ' nicht: ' + r.issues[0]); }));
  const focusSteps = foc.flatMap(ph => T.stepsOfPhase(t, ph));
  if(focusSteps.length && focusSteps.every(i => T.checkStep(t.steps[i], start, i).ok)) err(id, 'Schwerpunkt-Phase ist im Startzustand schon erfüllt');
  // Referenz in allen Phasen: Phase für Phase anwenden, jede Phase muss danach erfüllt sein; danach Zustandsautomat durchspielen
  const langs = pl || ['scl'];
  langs.forEach(lang => {
    const ctx = T.newContext(t), flow = F.create(t);
    PHASES.forEach(ph => {
      T.stepsOfPhase(t, ph).forEach(i => T.applyStepRef(t, t.steps[i], i, ctx, lang));
      T.stepsOfPhase(t, ph).forEach(i => { const r = T.checkStep(t.steps[i], ctx, i); if(!r.ok) err(id, 'Referenz (' + lang + ') erfüllt Phase „' + ph + '“ nicht (Schritt ' + (i + 1) + ' ' + t.steps[i].kind + '): ' + r.issues.slice(0, 2).join(' | ')); });
      if(ph !== 'laufen'){ const a = flow.accept(ctx, ph); if(!a.ok) err(id, 'Zustandsautomat: „' + ph + '“ nicht bestätigbar: ' + a.reason); }
    });
    if(!flow.canRun(ctx)) err(id, 'Zustandsautomat: Laufen lassen bleibt gesperrt');
    flow.markRun(ctx);
    if(!flow.done(ctx)) err(id, 'Zustandsautomat: Aufgabe nicht erledigt nach der Referenz (' + F.create(t).status(ctx).filter(x => x.state !== 'erledigt' && x.state !== 'leer').map(x => x.key + ':' + x.state).join(',') + ')');
  });
  {   // Startzustand: Laufen lassen ist gesperrt, solange der Schwerpunkt fehlt (ausser Schwerpunkt = nur Laufen lassen)
    const fl = F.create(t), c0 = T.newContext(t);
    if(!(foc.length === 1 && foc[0] === 'laufen') && fl.canRun(c0)) err(id, 'Zustandsautomat: Laufen lassen ist im Startzustand schon freigeschaltet');
  }
  // Konsistenz Verdrahtung ⇄ Signaltabelle ⇄ Programm (Adressen)
  {
    const ctx = T.applyRef(t, T.newContext(t), (t.lang || ['scl'])[0]);
    const chk = PLC.checkTags(ctx.tags); chk.errors.forEach(e => err(id, 'Variablentabelle (Referenz): ' + e.text));
    const names = new Set(ctx.tags.map(x => x.name)), hasAddr = new Map(ctx.tags.map(x => [(PLC.parseAddr(x.addr) || {}).key, x]));
    if(t.program){
      const used = new Set();
      (t.program.tests || []).forEach(tc => { Object.keys(tc.in || {}).concat(Object.keys(tc.expect || {})).forEach(k => used.add(k)); Object.keys(tc.phys || {}).forEach(pt => { const P = W.PARTS[pt]; if(!P || !P.ai) err(id, 'phys-Bauteil ' + pt + ' ist kein Analogsensor'); else if(!hasAddr.has(PLC.AI_ADDR[P.ai])) err(id, 'phys ' + pt + ': keine Variable mit Adresse ' + PLC.AI_ADDR[P.ai] + ' in der Tabelle'); }); });
      (t.program.timed || []).forEach(sq => sq.steps.forEach(st => { [st[1], st[2]].forEach(o => { if(o && !Array.isArray(o)) Object.keys(o).filter(k => !['in', 'phys', 'raw'].includes(k)).forEach(k => used.add(k)); if(o && o.in) Object.keys(o.in).forEach(k => used.add(k)); }); }));
      used.forEach(k => { if(!names.has(k)) err(id, 'Programmtest nutzt „' + k + '“, das nicht in der Variablentabelle steht'); });
    }
    // Digitale Eingänge: ist eine Sensorader auf einer Reihenklemme -X2 verdrahtet und hat die Aufgabe Variablen/Programm, muss die Adresse in der Tabelle stehen
    if(t.steps.some(s => s.kind === 'tags' || s.kind === 'program')){
      const N = W.nets(ctx.state);
      (t.x2 || []).forEach(n => { const addr = W.DI_OF_X2[n]; if(!addr) return; const sig = 'X2:' + n + '.S';
        const wired = t.steps.filter(x => x.kind === 'wire').some(x => ((x.ref || {}).add || []).some(([p, q]) => p === sig || q === sig));   // nur Adern, die die Aufgabe selbst legt
        if(wired && !hasAddr.has((PLC.parseAddr('%' + addr) || {}).key) && (t.parts || []).length) warn(id, 'Signalklemme -X2:' + n + ' (%' + addr + ') ist verdrahtet, aber ohne Variable'); });
    }
  }
  // Textlimits (Umbau 4/5.1): Story ≤ 2 Sätze, Auftrag ≤ 25 Wörter
  const w = words(t.briefing), sn = sentences(t.story);
  if(w > 25){ overWords++; if(STRICT) err(id, 'Auftrag hat ' + w + ' Wörter (max. 25)'); }
  if(sn > 2){ overSent++; if(STRICT) err(id, 'Story hat ' + sn + ' Sätze (max. 2)'); }
  // Infokarte (Umbau 5.4): vorhanden, Fliesstext höchstens 3 Sätze (Tabellen zählen nicht)
  if(!t.info) (STRICT ? err : warn)(id, 'Infokarte fehlt');
  else { const prose = String(t.info).replace(/<table[\s\S]*?<\/table>/g, ''); if(prose.trim() && sentences(prose) > 3) (STRICT ? err : warn)(id, 'Infokarte hat ' + sentences(prose) + ' Sätze (max. 3)'); }
});
if(overWords || overSent) warn('Textdiät (W7)', overWords + ' von ' + shown.length + ' Aufträgen über 25 Wörter, ' + overSent + ' Stories über 2 Sätze (mit --strict Fehler)');
// Angezeigte Module: 5 Aufgaben, Nummern 1–5, Aufgabe 5 = Boss bzw. Finale
[...new Set(shown.map(t => t.level))].sort((a, b) => a - b).forEach(m => {
  const ts = shown.filter(t => t.level === m).sort((a, b) => a.dispNo - b.dispNo);
  if(ts.length !== 5) err('Modul ' + m, ts.length + ' angezeigte Aufgaben (Ziel 5)');
  if(ts.map(t => t.dispNo).join() !== ts.map((_, i) => i + 1).join()) err('Modul ' + m, 'angezeigte Nummern ' + ts.map(t => t.dispNo).join());
  const last = ts[ts.length - 1]; if(last && !(last.isBoss || last.isFinal)) err('Modul ' + m, 'Aufgabe 5 (' + last.id + ') ist kein Boss');
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
