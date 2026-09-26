const fs = require('fs'), path = require('path');
global.window = global;
const E = require('./src/engine.js');
const PRO = require('./src/engine_pro.js');
require('./src/content/_helpers.js');
require('./src/content/manual.js');
const dir = path.join(__dirname, 'src/content');
fs.readdirSync(dir).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
['theory.js','theory_pro.js','chapters.js'].forEach(f => { if(fs.existsSync(path.join(dir,f))) require(path.join(dir,f)); });
const C = global.SCL_CONTENT;
const CHANNELS = ['armAngle','gripperOpen','beltRunning','lightRed','lightYellow','lightGreen','sensorActive','partVisible','partColor','gateAngle','displayValue','displayLabel','faultActive','hornActive','belt2Running','fanRunning','displayText','partLabel','motorFault1','motorFault2'];
const MANUAL_IDS = (global.MANUAL_IDS || null);
let errors = 0, warns = 0;
const E_ = (t, m) => { errors++; console.log('✗ ['+t+'] '+m); };
const W_ = (t, m) => { warns++; console.log('⚠ ['+t+'] '+m); };
function run(task, code){
  const prog = E.compileSCL(code, task);
  return task.timedTestCases ? E.runTimedTests(prog, task.initialVars, task.timedTestCases) : E.runSinglePassTests(prog, task.initialVars, task.testCases);
}
const ids = new Set();
const perCh = {};
const PT = global.ProTask;
function proFailInfo(ev){
  if(ev.missing.length) return 'must fehlt: ' + ev.missing.join(',');
  if(ev.warnHits.length) return 'Warnung: ' + ev.warnHits.map(w => w.code + ' ' + w.msg).join(' | ');
  const f = ev.res.failed; if(!f) return '?';
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
  // Export-Rundreise
  try{
    const ex = PRO.exportProject(ev.prog, ev.prog.project);
    const p2 = PRO.compileProject({sources: [{block: 'Export', src: ex.combined}], globals: t.project.globals, globalTypes: t.project.types, instances: {}});
    const r2 = PRO.runAll(p2, {tests: t.tests, timed: t.timed, unit: t.unit});
    if(!r2.ok) E_(t.id, 'Export-Rundreise besteht Tests nicht');
  }catch(e){ E_(t.id, 'Export-Rundreise: ' + e.message + ' Z' + e.line); }
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
    try{ const r = run(t, w); if(r.ok){
        let mu = false;
        if(t.mustUse.length){ const used = E.constructsUsed(E.compileSCL(w, t)); mu = t.mustUse.some(m => !used.has(m)); }
        if(!mu) E_(t.id, 'Falsche Lösung #'+(i+1)+' besteht die Tests: '+w.replace(/\n/g,' ⏎ '));
      } }catch(e){}
  });
  // leerer Code / nur Startcode darf nicht bestehen
  if(!t.isDebug){
    try{ const code = t.starterCode || ';'; const r = run(t, code);
      let mu = true; if(t.mustUse.length){ const used = E.constructsUsed(E.compileSCL(code, t)); mu = t.mustUse.every(m => used.has(m)); }
      if(r.ok && mu) E_(t.id, 'Leerer/Start-Code besteht bereits'); }catch(e){}
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
  if(!t.isDebug) expKeys.forEach(k => { if(!t.briefing.includes(k)) W_(t.id, 'Briefing erwähnt geprüfte Variable nicht: '+k); });
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
console.log(errors ? '\n'+errors+' FEHLER, '+warns+' Warnungen' : '\nOK — keine Fehler ('+warns+' Warnungen)');
process.exit(errors ? 1 : 0);
