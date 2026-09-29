// Inhalts-Validator für KOP Quest und FUP Quest: node validate_kop.js [kop|fup]  → muss „OK — keine Fehler“ melden
const fs = require('fs'), path = require('path');
global.window = global;
const SE = require('./src/engine.js');
require('./src/engine_pro.js');
const KOP = require('./src/kop.js');
require('./src/content/_helpers.js');
const QUEST = process.argv[2] === 'fup' ? 'fup' : 'kop';
global.QUEST = { id: QUEST, lang: QUEST };
const dir = path.join(__dirname, 'src/content_' + QUEST);
require(path.join(__dirname, 'src/content_kop/_kop.js'));
['manual.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^io_.*\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));   // Kommentare der PLC-Variablentabelle
['theory.js', 'theory_pro.js', 'bugs.js'].forEach(f => { if(fs.existsSync(path.join(dir, f))) require(path.join(dir, f)); });
const SCENE = require(QUEST === 'fup' ? './src/scene_stellwerk.js' : './src/scene_seilbahn.js');
const C = global.SCL_CONTENT, E = KOP.wrapEngine(SE), MANUAL_IDS = global.MANUAL_IDS || [];
const PRO = global.SCLPro = KOP.wrapPro(global.SCLPro), PT = global.ProTask;
let errors = 0, warns = 0;
const E_ = (id, m) => { errors++; console.log('✗ [' + id + '] ' + m); };
const W_ = (id, m) => { warns++; console.log('△ [' + id + '] ' + m); };

function run(t, code){
  const prog = E.compileSCL(code, t);
  const res = t.timedTestCases ? SE.runTimedTests(prog, t.initialVars, t.timedTestCases) : SE.runSinglePassTests(prog, t.initialVars, t.testCases);
  return { prog, res };
}
function proFailInfo(ev){
  if(ev.missing.length) return 'must fehlt: ' + ev.missing.join(',');
  if(ev.warnHits.length) return 'Warnung: ' + ev.warnHits.map(w => w.code + ' ' + w.msg).join(' | ');
  const f = ev.res.failed; if(!f) return '?';
  if(f.error) return f.kind + ' Fehler: ' + f.error.message + ' (Z' + f.error.line + ')';
  const c = f.failedCase; const st = c.steps ? c.steps[c.steps.length - 1] : c;
  return f.kind + (c.block ? ' ' + c.block : '') + ' Schritt ' + (c.steps ? c.steps.length : '') + ': ' + JSON.stringify(st.checks.filter(x => !x.pass).map(x => [x.name, x.actual, x.expected, x.pathError]));
}
function validatePro(t){
  if(t.lang !== 'kop') E_(t.id, 'keine KOP-Aufgabe (defKopPro verwenden)');
  let ev;
  try{ ev = PT.evaluate(t, PT.refCodes(t)); }
  catch(e){ E_(t.id, 'Referenz kompiliert nicht [' + (e.block || '') + '] Z' + e.line + ': ' + e.message); return; }
  if(!ev.ok) E_(t.id, 'Referenz besteht nicht: ' + proFailInfo(ev));
  ev.prog.warnings.forEach(w => E_(t.id, 'Referenz-Warnung ' + w.code + ' [' + w.unit + ' Z' + w.line + ']: ' + w.msg));
  t.project.blocks.forEach(b => {
    const src = b.edit ? b.ref : b.src;
    if(!b.free && !new RegExp('"' + b.name + '"').test(src)) E_(t.id, 'Block "' + b.name + '" enthält keinen gleichnamigen Baustein');
    const fr = KOP.splitBlock(src);
    if(fr && KOP.isKopBody(fr.body)){
      try{ const a = KOP.serialize(KOP.parse(fr.body)); if(fr.body.trim() && KOP.serialize(KOP.parse(a)) !== a) E_(t.id, 'Textformat nicht stabil in ' + b.name); }catch(e){ E_(t.id, 'Textformat ' + b.name + ': ' + e.message); }
      try{ const ifc = PRO.readInterface(src); if(!ifc) E_(t.id, 'Schnittstelle von ' + b.name + ' nicht lesbar'); }catch(e){ E_(t.id, 'Schnittstelle ' + b.name + ': ' + e.message); }
    }
  });
  try{ const s = PT.evaluate(t, PT.startCodes(t)); if(s.ok) E_(t.id, (t.isDebug ? 'Debug-' : '') + 'Startcode besteht bereits'); }catch(e){ /* Fehler = ok */ }
  (t._wrong || []).forEach((w, i) => {
    const codes = Object.assign(PT.refCodes(t), w);
    try{ const r = PT.evaluate(t, codes); if(r.ok) E_(t.id, 'falsche Lösung #' + (i + 1) + ' besteht'); }catch(e){}
  });
  t.sceneBindings.forEach(b => {
    if(!SCENE.CHANNELS.includes(b.channel)) E_(t.id, 'unbekannter Szenen-Kanal ' + b.channel);
    if(b.variable){ try{ ev.prog.checkPath(b.variable.includes('.') || b.variable.includes('"') ? b.variable : '"' + b.variable + '"'); }catch(e){ E_(t.id, 'Bindung ungültig: ' + b.variable + ' — ' + e.message); } }
  });
  if(!t.sceneBindings.length) W_(t.id, 'keine Szenen-Bindung');
  if(t.manualId && !MANUAL_IDS.includes(t.manualId)) E_(t.id, 'Handbuch-ID unbekannt: ' + t.manualId);
  ['title', 'story', 'briefing', 'learn', 'takeaway', 'hint'].forEach(k => { if(!t[k]) E_(t.id, 'Feld fehlt: ' + k); });
  if(!t.unit.length && !t.tests.length && !t.timed.length) E_(t.id, 'keine Tests');
}
const ids = new Set();
for(const t of C.tasks){
  if(t.pro){ if(ids.has(t.id)) E_(t.id, 'doppelte ID'); ids.add(t.id); validatePro(t); continue; }
  if(ids.has(t.id)) E_(t.id, 'doppelte ID'); ids.add(t.id);
  if(t.lang !== 'kop') E_(t.id, 'keine KOP-Aufgabe (defKop verwenden)');
  let r;
  try{ r = run(t, t.refSolution); }catch(e){ E_(t.id, 'Musterlösung übersetzt nicht: ' + e.message); continue; }
  if(!r.res.ok){ const f = r.res.failedCase; E_(t.id, 'Musterlösung besteht Tests nicht: ' + JSON.stringify(f && (f.checks || (f.steps && f.steps[f.steps.length - 1].checks)).filter(c => !c.pass)).slice(0, 220)); }
  const used = E.constructsUsed(r.prog);
  (t.mustUse || []).forEach(m => { if(!used.has(m)) E_(t.id, 'must "' + m + '" fehlt in der Musterlösung'); });
  // Startcode darf nicht bestehen
  try{ const s = run(t, t.starterCode); if(s.res.ok && !(t.mustUse || []).some(m => !E.constructsUsed(s.prog).has(m))) E_(t.id, (t.isDebug ? 'Debug-' : '') + 'Startcode besteht bereits'); }catch(e){ /* Fehler = ok */ }
  if(t.isDebug && t.starterCode === 'NETWORK Netzwerk 1\n? => ?;\n') E_(t.id, 'Debug-Aufgabe ohne Startcode');
  (t._wrong || []).forEach((w, i) => { try{ if(run(t, w).res.ok) E_(t.id, 'falsche Lösung #' + (i + 1) + ' besteht'); }catch(e){} });
  // Test-Variablen deklariert
  const decl = new Set(Object.keys(t.initialVars).map(k => k.toLowerCase()).concat(Object.keys(t.fbTypes || {}).map(k => k.toLowerCase())));
  const cases = t.timedTestCases ? t.timedTestCases.flatMap(c => [c.setup].concat(c.steps.flatMap(s => [s.inputs, s.expect]))) : t.testCases.flatMap(c => [c.setup, c.expect]);
  cases.forEach(o => Object.keys(o || {}).forEach(k => { if(!decl.has(k.split('.')[0].toLowerCase())) E_(t.id, 'Testvariable nicht deklariert: ' + k); }));
  if(!(t.testCases || []).length && !(t.timedTestCases || []).length) E_(t.id, 'keine Tests');
  // Szene
  t.sceneBindings.forEach(b => { if(!SCENE.CHANNELS.includes(b.channel)) E_(t.id, 'unbekannter Szenen-Kanal ' + b.channel); if(b.variable && !decl.has(b.variable.split('.')[0].toLowerCase())) E_(t.id, 'Bindung an unbekannte Variable ' + b.variable); });
  if(!t.sceneBindings.length) W_(t.id, 'keine Szenen-Bindung');
  if(t.manualId && !MANUAL_IDS.includes(t.manualId)) E_(t.id, 'Handbuch-ID unbekannt: ' + t.manualId);
  ['title', 'story', 'briefing', 'learn', 'takeaway', 'hint'].forEach(k => { if(!t[k]) E_(t.id, 'Feld fehlt: ' + k); });
  // Textformat stabil (parse → serialize → parse)
  try{ const a = KOP.serialize(KOP.parse(t.refSolution)); if(KOP.serialize(KOP.parse(a)) !== a) E_(t.id, 'Textformat nicht stabil'); }catch(e){ E_(t.id, 'Textformat: ' + e.message); }
}
// Kapitel: je 10 Aufgaben, 2 Theorien
const chapters = C.chapters.slice().sort((a, b) => a.n - b.n);
for(const ch of chapters){
  const n = C.tasks.filter(t => t.level === ch.n).length;
  if(n !== 10) E_('kap' + ch.n, n + ' Aufgaben (10 erwartet)');
  const th = C.theory.filter(t => t.ch === ch.n);
  if(!th.find(t => t.pos === 'start') || !th.find(t => t.pos === 'mid')) E_('kap' + ch.n, 'Theorie A oder B fehlt');
  const last = C.tasks.filter(t => t.level === ch.n).slice(-1)[0];
  if(last && !last.isBoss && !last.isFinal) W_('kap' + ch.n, 'letzte Aufgabe ist kein Boss');
}
// Theorie
for(const th of C.theory){
  if(!th.lesson || !th.questions || th.questions.length < 5) E_(th.id, 'Lektion oder mind. 5 Fragen fehlen');
  (th.questions || []).forEach((q, i) => {
    const id = th.id + ' F' + (i + 1);
    if(q.type === 'single' && !(q.correct >= 0 && q.correct < q.options.length)) E_(id, 'correct ausserhalb');
    if(q.type === 'multi' && !(Array.isArray(q.correct) && q.correct.every(c => c >= 0 && c < q.options.length))) E_(id, 'correct (multi) ungültig');
    if(q.type === 'input' && !(q.answer && q.answer.length)) E_(id, 'answer fehlt');
    if(q.kop){ try{ const fr = KOP.splitBlock(q.kop); KOP.parse(fr ? fr.body : q.kop); }catch(e){ E_(id, 'kop-Darstellung: ' + e.message); } }
    if(q.verifyKopPro){
      // { blocks:[Quelle, …], globals, types, steps:[[dt, {setzen}]], ask:'Pfad', value } — Aussage über ein Profi-Programm
      const v = q.verifyKopPro;
      try{
        const prog = PRO.compileProject({ sources: v.blocks.map((src, i) => ({ block: (/"([^"]+)"/.exec(src) || [])[1] || 'B' + i, src })), globals: v.globals || {}, globalTypes: v.types || {}, globalComments:{}, instances: v.instances || {} });
        const S = new PRO.Session(prog); S.startup();
        (v.steps || [[0.1, {}]]).forEach(st => { Object.keys(st[1] || {}).forEach(k => S.set(k, st[1][k])); S.scan(st[0]); });
        const got = S.get(v.ask);
        if(String(got) !== String(v.value)) E_(id, 'verifyKopPro: Engine=' + got + ' Erwartung=' + v.value);
        if(v.warn !== undefined && prog.warnings.some(w => w.code === v.warn) !== true) E_(id, 'verifyKopPro: Warnung ' + v.warn + ' fehlt');
      }catch(e){ E_(id, 'verifyKopPro: ' + e.message + ' Z' + e.line); }
    }
    if(q.verifyKop){
      const v = q.verifyKop, t = { lang:'kop', initialVars: v.vars || {}, fbTypes: v.fb || {}, varTypes: v.types || {} };
      try{
        const prog = E.compileSCL(v.src, t);
        const res = v.steps ? SE.runTimedTests(prog, t.initialVars, [{ setup:{}, steps: v.steps.map(s => ({ dt:s[0], inputs:s[1] || {}, expect:s[2] || {} })) }]) : SE.runSinglePassTests(prog, t.initialVars, v.tests.map(x => ({ setup:x[0] || {}, expect:x[1] || {} })));
        if(!res.ok) E_(id, 'verifyKop widerspricht der Engine');
      }catch(e){ E_(id, 'verifyKop: ' + e.message); }
    }
  });
  const re = /<pre class="kop">([\s\S]*?)<\/pre>/g; let m;
  while((m = re.exec(th.lesson))){ try{ const t0 = m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'), fr = KOP.splitBlock(t0); KOP.toSCL(KOP.parse(fr ? fr.body : t0), { pro: !!fr }); }catch(e){ E_(th.id, 'Lektions-KOP: ' + e.message); } }
}
// Handbuch-Beispiele
(global.MANUAL_CONTENT || []).forEach(pg => { const re = /<pre class="kop">([\s\S]*?)<\/pre>/g; let m; while((m = re.exec(pg.html))){ try{ const t0 = m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'), fr = KOP.splitBlock(t0); KOP.toSCL(KOP.parse(fr ? fr.body : t0), { pro: !!fr }); }catch(e){ E_('Handbuch ' + pg.id, e.message); } } });
// Störungsjagd
{
  const bugs = C.bugs || [], bIds = new Set();
  for(const b of bugs){
    if(bIds.has(b.id)) E_(b.id, 'doppelte Störungs-ID'); bIds.add(b.id);
    const t = C.tasks.find(x => x.id === b.task); if(!t){ E_(b.id, 'Aufgabe ' + b.task + ' fehlt'); continue; }
    if(!b.title || !b.symptom) E_(b.id, 'Titel oder Symptom fehlt');
    let code; try{ code = global.bugCode(t, b); }catch(e){ E_(b.id, e.message); continue; }
    try{ const ok = t.pro ? PT.evaluate(t, code).ok : run(t, code).res.ok; if(ok) E_(b.id, 'Fehlerversion besteht die Tests'); }catch(e){ E_(b.id, 'Fehlerversion übersetzt nicht (soll laufen, aber falsch): ' + e.message); }
  }
  for(const ch of chapters){ const n = bugs.filter(b => { const t = C.tasks.find(x => x.id === b.task); return t && t.level === ch.n; }).length; if(n < 2) (bugs.length ? E_ : W_)('kap' + ch.n, 'nur ' + n + ' Störungsszenario(s), mind. 2 nötig'); }
  console.log('Störungsjagd: ' + bugs.length + ' Szenarien');
}
console.log(QUEST.toUpperCase() + ' Quest: ' + chapters.length + ' Kapitel, ' + C.tasks.length + ' Aufgaben, ' + C.theory.length + ' Theorien, ' + (global.MANUAL_CONTENT || []).length + ' Handbuchseiten');
require('./textdiet.js').check(C.tasks, W_);
require('./validate_io.js')(C, { E_: (t, m) => E_(t, m), W_: (t, m) => W_(t, m) });
console.log(errors ? '\n' + errors + ' FEHLER, ' + warns + ' Warnungen' : '\nOK — keine Fehler (' + warns + ' Warnungen)');
process.exit(errors ? 1 : 0);
