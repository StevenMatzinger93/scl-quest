const fs = require('fs'), path = require('path');
global.window = global;
const E = require('./src/engine.js');
const PRO = require('./src/engine_pro.js');
require('./src/content/_helpers.js');
require('./src/equiv.js');   // Funktion zählt: erzeugte Tests aus der Musterlösung
require('./src/content/manual.js');
const dir = path.join(__dirname, 'src/content');
fs.readdirSync(dir).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
['theory.js','theory_pro.js','chapters.js','bugs.js'].forEach(f => { if(fs.existsSync(path.join(dir,f))) require(path.join(dir,f)); });
const C = global.SCL_CONTENT;
const CHANNELS = ['armAngle','gripperOpen','beltRunning','lightRed','lightYellow','lightGreen','sensorActive','partVisible','partColor','gateAngle','displayValue','displayLabel','faultActive','hornActive','belt2Running','fanRunning','displayText','partLabel','motorFault1','motorFault2'];
const MANUAL_IDS = (global.MANUAL_IDS || null);
let errors = 0, warns = 0;
const E_ = (t, m) => { errors++; console.log('✗ ['+t+'] '+m); };
const W_ = (t, m) => { warns++; console.log('⚠ ['+t+'] '+m); };
// Funktion zählt: Hand-Tests + aus der Musterlösung erzeugte Tests (equiv.js)
function run(task, code){
  const prog = E.compileSCL(code, task);
  const hand = task.timedTestCases ? E.runTimedTests(prog, task.initialVars, task.timedTestCases) : E.runSinglePassTests(prog, task.initialVars, task.testCases);
  if(!hand.ok) return hand;
  if(task.autoTests === undefined){ try{ task.autoTests = global.SPSQEquiv.autoTests(task, E); }catch(e){ task.autoTests = null; } }
  const a = task.autoTests; if(!a) return hand;
  return task.timedTestCases ? E.runTimedTests(prog, task.initialVars, a.timedTestCases) : E.runSinglePassTests(prog, task.initialVars, a.testCases);
}
const ids = new Set();
const perCh = {};
const PT = global.ProTask;
function proFailInfo(ev){
  const f = (ev.res.failed || (ev.auto && ev.auto.failed)); if(!f) return '?';
  if(f.error) return f.kind + ' Fehler: ' + f.error.message + ' (Z' + f.error.line + ')';
  const c = f.failedCase; const st = c.steps ? c.steps[c.steps.length - 1] : c;
  return f.kind + (c.block ? ' ' + c.block : '') + ' Schritt ' + (c.steps ? c.steps.length : '') + ': ' + JSON.stringify(st.checks.filter(x => !x.pass).map(x => [x.name, x.actual, x.expected, x.pathError]));
}
function validatePro(t){
  let ev;
  try{ ev = PT.evaluate(t, PT.refCodes(t)); }
  catch(e){ E_(t.id, 'Referenz kompiliert nicht [' + (e.block||'') + '] Z' + e.line + ': ' + e.message); return; }
  if(!ev.ok) E_(t.id, 'Referenz besteht nicht: ' + proFailInfo(ev));
  ev.prog.warnings.forEach(w => W_(t.id, 'Referenz-Warnung ' + w.code + ' [' + w.unit + ' Z' + w.line + ']: ' + w.msg));
  // Blocknamen = Bausteinnamen
  t.project.blocks.forEach(b => {
    const src = b.edit ? b.ref : b.src;
    if(b.free) return;
    try{ const u = PRO.parseSource(src).units; if(!u.some(x => x.name.toLowerCase() === b.name.toLowerCase())) E_(t.id, 'Block "' + b.name + '" enthält keinen gleichnamigen Baustein'); }catch(e){ E_(t.id, 'Block ' + b.name + ' parse: ' + e.message); }
    if(b.edit && !b.start && !t.isDebug) W_(t.id, 'Block ' + b.name + ' ohne Startcode');
  });
  // Startcode darf nicht bestehen
  try{ const s = PT.evaluate(t, PT.startCodes(t)); if(s.ok) E_(t.id, (t.isDebug ? 'Debug-' : '') + 'Startcode besteht bereits!'); }catch(e){ /* Fehler = ok */ }
  // falsche Lösungen
  (t._wrong || []).forEach((w, i) => {
    const codes = Object.assign(PT.refCodes(t), w);
    try{ const r = PT.evaluate(t, codes); if(r.ok) E_(t.id, 'Falsche Lösung #' + (i+1) + ' besteht: ' + JSON.stringify(w).slice(0, 160)); }catch(e){}
  });
  // Bindungen
  t.sceneBindings.forEach(b => {
    if(!CHANNELS.includes(b.channel)) E_(t.id, 'Unbekannter Kanal ' + b.channel);
    if(b.variable){ try{ ev.prog.checkPath(b.variable.includes('.') || b.variable.includes('"') ? b.variable : '"' + b.variable + '"'); }catch(e){ E_(t.id, 'Binding-Pfad ungültig: ' + b.variable + ' — ' + e.message); } }
  });
  if(!t.sceneBindings.length) W_(t.id, 'keine Szenen-Bindung');
  if(MANUAL_IDS && t.manualId && !MANUAL_IDS.includes(t.manualId)) E_(t.id, 'Handbuch-ID unbekannt: ' + t.manualId);
  if(!t.takeaway) W_(t.id, 'kein Merksatz');
  if(!t.learn) W_(t.id, 'kein Lernziel');
  if(!t.unit.length && !t.tests.length && !t.timed.length) E_(t.id, 'keine Tests');
}
// TIA-Export ist ausgebaut (ENTSCHEIDUNGEN.md) — Inhalte dürfen ihn nicht mehr anbieten
{
  const all = JSON.stringify(C.tasks) + JSON.stringify(global.MANUAL_CONTENT || []) + JSON.stringify(C.theory || global.THEORY || []);
  const m = all.match(/TIA-Export|TIA-Quelle|Export nach TIA|exportPro|exportProject/);
  if(m) E_('export', 'Verweis auf den entfernten TIA-Export: ' + m[0]);
}
// Kernpfad (Feedback 4.1): genau 5 Kernaufgaben je Kapitel, Boss immer dabei, je Hälfte mindestens 2
require(path.join(dir, 'kern.js'));
{ const byCh = {}; C.tasks.filter(t => !t.hidden).forEach(t => (byCh[t.level] = byCh[t.level] || []).push(t));
  Object.keys(byCh).forEach(ch => { const L = byCh[ch], k = L.filter(t => t.core), boss = L[L.length - 1];
    if(k.length !== 5) E_('Kapitel ' + ch, 'Kernpfad: ' + k.length + ' Kernaufgaben statt 5');
    if(!boss.core) E_(boss.id, 'Kernpfad: der Boss muss Kernaufgabe sein');
    if(L.slice(0, 5).filter(t => t.core).length < 2 || L.slice(5, 9).filter(t => t.core).length < 2) E_('Kapitel ' + ch, 'Kernpfad: je Hälfte mindestens 2 Kernaufgaben'); });
  Object.values(global.KERN_PLAN || {}).flat().forEach(id => { if(!C.tasks.some(t => t.id === id)) E_('kern.js', 'unbekannte Aufgabe ' + id); }); }
// PLC-Variablen (Feedback 5.2): Adresse/Typ/Kommentar vollständig, keine Doppelbelegung, Aufträge ab Aufgabe 3 ohne Variablennamen
{ const r = require('./check_briefs.js').check('scl'); r.errs.forEach(m => E_('PLC-Variablen', m)); }
const TD = require('./textdiet.js'), TD_STRICT = process.argv.includes('--strict-text');
for(const t of C.tasks) TD.check(t).forEach(m => (TD_STRICT ? E_ : W_)(t.id, 'Textdiät: ' + m));
for(const t of C.tasks){
  if(ids.has(t.id)) E_(t.id, 'doppelte ID');
  ids.add(t.id);
  perCh[t.level] = (perCh[t.level]||0) + 1;
  if(t.pro){ validatePro(t); continue; }
  // Referenz muss bestehen
  try{
    const r = run(t, t.refSolution);
    if(!r.ok){
      const f = r.failedCase;
      E_(t.id, 'Referenz besteht Tests nicht: ' + JSON.stringify(f.checks || (f.steps && f.steps[f.steps.length-1].checks)) + (r.error ? ' ERR '+r.error.message : ''));
    }
  }catch(e){ E_(t.id, 'Referenz kompiliert nicht: Z'+e.line+' '+e.message); }
  // mustUse
  if(t.mustUse.length){
    try{ const used = E.constructsUsed(E.compileSCL(t.refSolution, t)); t.mustUse.forEach(m => { if(!used.has(m)) E_(t.id, 'Referenz nutzt mustUse "'+m+'" nicht'); }); }catch(e){}
  }
  // Debug-Startcode muss scheitern
  if(t.isDebug){
    if(!t.starterCode) E_(t.id, 'Debug-Aufgabe ohne Startcode');
    else { try{ const r = run(t, t.starterCode); if(r.ok) E_(t.id, 'Debug-Startcode besteht die Tests bereits!'); }catch(e){ /* Compilerfehler = ok */ } }
  }
  // Falsche Lösungen müssen scheitern
  (t._wrong||[]).forEach((w,i) => {
    try{ const r = run(t, w); if(r.ok) E_(t.id, 'Falsche Lösung #'+(i+1)+' besteht die Tests (Funktion stimmt – dann ist sie nicht falsch): '+w.replace(/\n/g,' ⏎ ')); }catch(e){}
  });
  // leerer Code / nur Startcode darf nicht bestehen
  if(!t.isDebug){
    try{ const code = t.starterCode || ';'; const r = run(t, code);
      if(r.ok) E_(t.id, 'Leerer/Start-Code besteht bereits (Funktion stimmt schon)'); }catch(e){}
  }
  // Variablen in Tests
  const vars = Object.keys(t.initialVars);
  const cases = t.testCases ? t.testCases.map(c=>[c.setup,c.expect]) : [].concat(...t.timedTestCases.map(c=>[[c.setup,{}]].concat(c.steps.map(s=>[s.inputs,s.expect]))));
  cases.forEach(([s,x]) => {
    Object.keys(s||{}).forEach(k => { if(!vars.includes(k)) E_(t.id, 'Setup-Variable fehlt in vars: '+k); });
    Object.keys(x||{}).forEach(k => { if(!vars.includes(k) && !(t.fbTypes[k])) E_(t.id, 'Erwartete Variable fehlt in vars: '+k); });
  });
  // Bindings
  t.sceneBindings.forEach(b => {
    if(!CHANNELS.includes(b.channel)) E_(t.id, 'Unbekannter Kanal '+b.channel);
    if(b.variable && !vars.includes(b.variable)) E_(t.id, 'Binding-Variable fehlt: '+b.variable);
  });
  if(!t.sceneBindings.length) W_(t.id, 'keine Szenen-Bindung');
  if(MANUAL_IDS && t.manualId && !MANUAL_IDS.includes(t.manualId)) E_(t.id, 'Handbuch-ID unbekannt: '+t.manualId);
  if(!t.takeaway) W_(t.id, 'kein Merksatz');
  if(!t.learn) W_(t.id, 'kein Lernziel');
  // Briefing erwähnt alle Ausgangsvariablen?
  const expKeys = new Set(); cases.forEach(([s,x]) => Object.keys(x||{}).forEach(k => expKeys.add(k)));
  if(!t.isDebug && C.tasks.filter(x => !x.hidden).indexOf(t) < 2) expKeys.forEach(k => { if(!t.briefing.includes(k)) W_(t.id, 'Briefing erwähnt geprüfte Variable nicht: '+k); });
}
console.log('\nAufgaben pro Kapitel:', JSON.stringify(perCh), 'gesamt', C.tasks.length);
// Theorie
(C.theory||[]).forEach(th => {
  if(!th.questions || th.questions.length < 4) E_(th.id, 'zu wenige Fragen');
  th.questions.forEach((q,i) => {
    const tag = th.id+'#'+(i+1);
    if(q.type==='single' && !(q.correct >= 0 && q.correct < q.options.length)) E_(tag, 'correct ungültig');
    if(q.type==='multi' && !(Array.isArray(q.correct) && q.correct.every(c => c>=0 && c<q.options.length))) E_(tag, 'correct ungültig');
    if(!q.explain) W_(tag, 'keine Erklärung');
    if(q.verify){   // Code-Vorhersage automatisch nachrechnen
      try{
        const v = q.verify;
        const prog = E.compileSCL(v.code, {vars:v.vars, fbTypes:v.fb||{}, varTypes:v.types||{}});
        let env;
        if(v.steps) env = E.executeTimed(prog, v.vars, {}, v.steps.map(s=>({dt:s[0], inputs:s[1]||{}}))).pop();
        else env = E.executeOnce(prog, v.vars, {});
        const got = env[v.ask];
        const want = q.type==='input' ? q.answer[0] : q.options[q.correct];
        if(String(got).toUpperCase() !== String(want).toUpperCase()) E_(tag, 'Vorhersage falsch: Engine='+got+' Antwort='+want);
      }catch(e){ E_(tag, 'verify-Code Fehler: '+e.message); }
    }
    if(q.verifyPro){
      try{
        const v = q.verifyPro;
        const prog = PRO.compileProject({sources:[{block:'Q', src:v.src}], globals:v.globals||{}, globalTypes:v.types||{}});
        const S = new PRO.Session(prog); S.startup();
        (v.steps || [[0,{}]]).forEach(st => { Object.keys(st[1]||{}).forEach(k => S.set(k, st[1][k])); S.scan(st[0]); });
        const got = S.get(v.ask);
        const want = q.type==='input' ? String(q.answer[0]).replace(/^'|'$/g,'') : (v.answerValue !== undefined ? v.answerValue : q.options[q.correct]);
        if(String(got).toUpperCase() !== String(want).toUpperCase()) E_(tag, 'Pro-Vorhersage falsch: Engine='+got+' Antwort='+want);
      }catch(e){ E_(tag, 'verifyPro Fehler: '+e.message+' Z'+e.line); }
    }
    if(q.compilesPro){
      let ok = true; try{ PRO.compileProject({sources:[{block:'Q', src:q.compilesPro.src}], globals:q.compilesPro.globals||{}}); }catch(e){ ok = false; }
      if(ok !== q.compilesPro.expect) E_(tag, 'compilesPro-Erwartung falsch (Engine: '+ok+')');
    }
    if(q.warnPro){
      try{ const p = PRO.compileProject({sources:[{block:'Q', src:q.warnPro.src}], globals:q.warnPro.globals||{}}); const has = p.warnings.some(w => w.code === q.warnPro.code); if(has !== q.warnPro.expect) E_(tag, 'warnPro falsch: '+JSON.stringify(p.warnings.map(w=>w.code))); }
      catch(e){ E_(tag, 'warnPro kompiliert nicht: '+e.message); }
    }
    if(q.compiles !== undefined){ // Aussage "kompiliert / kompiliert nicht" prüfen
      let ok = true; try{ E.compileSCL(q.compiles.code, {vars:q.compiles.vars||{}, fbTypes:q.compiles.fb||{}, varTypes:q.compiles.types||{}}); }catch(e){ ok = false; }
      if(ok !== q.compiles.expect) E_(tag, 'compiles-Erwartung falsch (Engine: '+ok+')');
    }
  });
});
console.log('Theorie-Aufträge:', (C.theory||[]).length, 'Fragen:', (C.theory||[]).reduce((a,t)=>a+t.questions.length,0));
// Störungsjagd: Fehlerszenarien
{
  const bugs = C.bugs || [], bIds = new Set();
  for(const b of bugs){
    if(bIds.has(b.id)) E_(b.id, 'doppelte Störungs-ID'); bIds.add(b.id);
    const t = C.tasks.find(x => x.id === b.task);
    if(!t){ E_(b.id, 'Aufgabe ' + b.task + ' fehlt'); continue; }
    if(!b.title || !b.symptom) E_(b.id, 'Titel oder Symptom fehlt');
    let code;
    try{ code = global.bugCode(t, b); }catch(e){ E_(b.id, e.message); continue; }
    try{
      if(t.pro){ PT.compile(t, code); const r = PT.evaluate(t, code); if(r.ok) E_(b.id, 'Fehlerversion besteht die Tests'); }
      else { const prog = E.compileSCL(code, t); const r = t.timedTestCases ? E.runTimedTests(prog, t.initialVars, t.timedTestCases) : E.runSinglePassTests(prog, t.initialVars, t.testCases); if(r.ok) E_(b.id, 'Fehlerversion besteht die Tests'); }
    }catch(e){ E_(b.id, 'Fehlerversion übersetzt nicht (soll laufen, aber falsch): ' + e.message); }
  }
  for(const ch of C.chapters){ const n = bugs.filter(b => { const t = C.tasks.find(x => x.id === b.task); return t && t.level === ch.n; }).length; if(n < 2) E_('kap' + ch.n, 'nur ' + n + ' Störungsszenario(s), mind. 2 nötig'); }
  console.log('Störungsjagd: ' + bugs.length + ' Szenarien');
}
console.log(errors ? '\n'+errors+' FEHLER, '+warns+' Warnungen' : '\nOK — keine Fehler ('+warns+' Warnungen)');
process.exit(errors ? 1 : 0);
