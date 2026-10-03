(function(root){
"use strict";
/* ============================================================
   PRÜFUNGEN (Zertifikat) — gemeinsamer Kern für Browser, Validator und Worker
   ------------------------------------------------------------
   defExamTask({
     id, quest:'scl'|'kop'|'fup'|'awl', level:'grund'|'profi', ch (Kapitel), diff:1|2|3,
     params:{ MAX:[80, 90], … },                 // pro Prüfung per Seed gewählt
     title, brief: p => 'HTML', story?: p => 'HTML',
     // Grundstufe (Anweisungen gegen vorgegebene Variablen):
     vars: p => ({…}), types?: p => ({…}), fb?: p => ({Inst:'TON'}), timed?:true,
     start?: p => '', ref: p => '', must?:['IF'],
     visible: p => [[setup, expect], …] | [{setup, steps:[[dt, inputs, expect]]}],
     hidden:  p => (gleiches Format, ≥ 6 Fälle inkl. Grenzwerte),
     // Profi-Stufe (Bausteine):
     blocks: p => [{name, kind, edit:true, start, ref} | {name, kind, src}], globals?, types?, instances?, warnFree?,
     visible: p => ({unit:[…], tests:[…], timed:[…]}), hidden: p => ({…}),
     wrong: [ p => 'Code' | p => ({Block:'Quelltext'}) ]   // typische Fehler, müssen scheitern (Validator)
   })
   defExamQuestion({ id, quest, level, ch, q:'HTML', options:['…'], answer: Index })
   Der Browser bekommt nur publicItem(): nie ref, hidden oder wrong.
   ============================================================ */
const X = root.SPSQ_EXAM = root.SPSQ_EXAM || { tasks: [], questions: [] };
const QUESTS = ['scl', 'kop', 'fup', 'awl'], LEVELS = ['grund', 'profi'];
// Aufbau je Stufe (docs/PLAN_ZERTIFIKAT_PIKETT.md A.3)
const RULES = {
  grund: { tasks: 6, questions: 12, minutes: 60, mix: [2, 3, 1], chapters: [1, 10], minChapters: 5 },
  profi: { tasks: 4, questions: 10, minutes: 90, mix: [1, 2, 1], chapters: [11, 15], minChapters: 5 }
};
const WEIGHT = { tasks: 0.7, theory: 0.3 }, PASS = 0.7, DISTINCTION = 0.9, PARTIAL = 0.6;
const LIMITS = { codeBytes: 20 * 1024, maxIter: 20000 };

root.defExamTask = function(o){ o.kind = o.level === 'profi' ? 'profi' : 'grund'; o.diff = o.diff || 2; X.tasks.push(o); return o; };
root.defExamQuestion = function(o){ X.questions.push(o); return o; };

/* ---------- Zufall (deterministisch) ---------- */
function hashStr(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed)); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const langOf = q => q === 'fup' || q === 'kop' ? 'kop' : q === 'awl' ? 'awl' : 'scl';

// freie Hilfsmerker wie im Spiel (Funktion zählt) – werden nie geprüft
const HELPERS = { Hilf_1:false, Hilf_2:false, Hilf_3:false, Hilf_4:false, Hilfswert_1:0, Hilfswert_2:0 };

/* ---------- Parameter ---------- */
function paramKeys(def){ return Object.keys(def.params || {}); }
function pickParams(def, r){ const p = {}; paramKeys(def).forEach(k => { const v = def.params[k]; p[k] = v[Math.floor(r() * v.length)]; }); return p; }
// alle Kombinationen (für den Validator); bei grossen Räumen n zufällige
function allParams(def, n){
  const keys = paramKeys(def); let out = [{}];
  keys.forEach(k => { const nx = []; out.forEach(o => def.params[k].forEach(v => nx.push(Object.assign({}, o, { [k]: v })))); out = nx; });
  if(n && out.length > n){ const r = rng('all:' + def.id); out = shuffle(out, r).slice(0, n); }
  return out;
}
const call = (f, p, dflt) => typeof f === 'function' ? f(p) : (f === undefined ? dflt : f);

/* ---------- Instanz einer Aufgabe ---------- */
function instantiate(def, p){
  const it = { id: def.id, quest: def.quest, level: def.level, lang: langOf(def.quest), kind: def.kind, ch: def.ch, diff: def.diff,
    title: call(def.title, p, ''), brief: call(def.brief, p, ''), story: call(def.story, p, ''), must: def.must || [], params: p };
  if(def.kind === 'grund'){
    Object.assign(it, { vars: Object.assign(call(def.vars, p, {}), Object.fromEntries(Object.entries(HELPERS).filter(([k]) => !(k in call(def.vars, p, {}))))), types: call(def.types, p, {}), fb: call(def.fb, p, {}), timed: !!def.timed,
      start: call(def.start, p, ''), ref: call(def.ref, p, ''), visible: call(def.visible, p, []), hidden: call(def.hidden, p, []) });
  } else {
    const blocks = call(def.blocks, p, []).map(b => ({ name: b.name, kind: b.kind, edit: !!b.edit, start: b.start || '', src: b.src || '', ref: b.ref || '', ob: b.ob }));
    Object.assign(it, { blocks, globals: call(def.globals, p, {}), types: call(def.types, p, {}), comments: call(def.comments, p, {}), instances: call(def.instances, p, {}),
      warnFree: def.warnFree || [], visible: normPro(call(def.visible, p, {})), hidden: normPro(call(def.hidden, p, {})) });
  }
  return it;
}
function normStep(s){
  if(!Array.isArray(s)) return { dt: s.dt || 0, inputs: s.inputs || {}, expect: s.expect || {} };
  if(s.length === 3) return { dt: s[0] || 0, inputs: s[1] || {}, expect: s[2] || {} };
  return { dt: 0, inputs: s[0] || {}, expect: s[1] || {} };
}
function normPro(t){
  return { unit: (t.unit || []).map(u => ({ block: u.block, setup: u.setup || {}, steps: (u.steps || []).map(normStep) })),
    tests: (t.tests || []).map(x => Array.isArray(x) ? { setup: x[0] || {}, expect: x[1] || {} } : x),
    timed: (t.timed || []).map(tc => ({ setup: tc.setup || {}, steps: (tc.steps || []).map(normStep) })) };
}
function grundCases(it, list){
  return it.timed ? { timedTestCases: list.map(tc => ({ setup: tc.setup || {}, steps: tc.steps.map(s => Array.isArray(s) ? { dt: s[0], inputs: s[1] || {}, expect: s[2] || {} } : s) })) }
    : { testCases: list.map(x => Array.isArray(x) ? { setup: x[0] || {}, expect: x[1] || {} } : x) };
}
// Aufgabe im Format der Spiel-Aufgaben (defTask/defProTask), mit den sichtbaren oder den verdeckten Tests
function toTask(it, which){
  const base = { id: it.id, level: it.ch, title: it.title, story: it.story, briefing: it.brief, learn: '', takeaway: '', exam: true,
    lang: it.lang === 'scl' ? undefined : it.lang, mustUse: it.must || [], hint: '', hint2: '', sceneBindings: it.bind || [], refLines: 0 };
  if(it.kind === 'grund'){
    return Object.assign(base, { initialVars: it.vars, varTypes: it.types || {}, fbTypes: it.fb || {}, starterCode: it.start || '', refSolution: it.ref || '' },
      grundCases(it, (which === 'hidden' ? it.hidden : it.visible) || []));
  }
  const tests = (which === 'hidden' ? it.hidden : it.visible) || { unit: [], tests: [], timed: [] };
  return Object.assign(base, { pro: true, warnFree: it.warnFree || [], tableMode: true, starterCode: '',
    project: { blocks: it.blocks, globals: it.globals || {}, types: it.types || {}, comments: it.comments || {}, instances: it.instances || {} },
    unit: tests.unit, tests: tests.tests, timed: tests.timed, initialVars: it.globals || {}, varTypes: {}, fbTypes: {} });
}
// Was der Browser sehen darf
function publicItem(it){
  const o = { id: it.id, quest: it.quest, level: it.level, lang: it.lang, kind: it.kind, ch: it.ch, title: it.title, brief: it.brief, story: it.story, must: it.must, visible: it.visible };
  if(it.kind === 'grund') Object.assign(o, { vars: it.vars, types: it.types, fb: it.fb, timed: it.timed, start: it.start });
  else Object.assign(o, { blocks: it.blocks.map(b => b.edit ? { name: b.name, kind: b.kind, edit: true, start: b.start, ob: b.ob } : { name: b.name, kind: b.kind, src: b.src, ob: b.ob }),
    globals: it.globals, types: it.types, comments: it.comments, instances: it.instances, warnFree: it.warnFree });
  return o;
}

/* ---------- Fragen ---------- */
function questionItem(def, perm){
  const opts = call(def.options, {}, []);
  perm = perm || opts.map((_, i) => i);
  return { id: def.id, quest: def.quest, level: def.level, ch: def.ch, q: call(def.q, {}, ''), options: perm.map(i => opts[i]), perm, answer: perm.indexOf(def.answer) };
}
function publicQuestion(qi){ return { id: qi.id, ch: qi.ch, q: qi.q, options: qi.options }; }

/* ---------- Ziehung ---------- */
function pool(quest, level){ return { tasks: X.tasks.filter(t => t.quest === quest && t.level === level), questions: X.questions.filter(q => q.quest === quest && q.level === level) }; }
function draw(quest, level, seed){
  const R = RULES[level], r = rng('exam:' + seed), P = pool(quest, level);
  const chosen = [], chs = new Set();
  [1, 2, 3].forEach((d, di) => {
    let cand = shuffle(P.tasks.filter(t => t.diff === d), r);
    for(let n = 0; n < R.mix[di] && cand.length; n++){
      const fresh = cand.find(t => !chs.has(t.ch)) || cand[0];
      cand = cand.filter(t => t !== fresh); chosen.push(fresh); chs.add(fresh.ch);
    }
  });
  // zu wenig in einer Stufe → mit beliebigen auffüllen
  shuffle(P.tasks.filter(t => !chosen.includes(t)), r).slice(0, Math.max(0, R.tasks - chosen.length)).forEach(t => { chosen.push(t); chs.add(t.ch); });
  const qs = []; let qc = shuffle(P.questions, r);
  while(qs.length < R.questions && qc.length){
    const need = qc.find(q => !chs.has(q.ch)) || qc[0];
    qc = qc.filter(q => q !== need); qs.push(need); chs.add(need.ch);
  }
  chosen.sort((a, b) => a.ch - b.ch || a.diff - b.diff);
  return {
    tasks: chosen.map(t => ({ t: 'task', id: t.id, params: pickParams(t, r) })),
    questions: qs.sort((a, b) => a.ch - b.ch).map(q => { const n = call(q.options, {}, []).length; return { t: 'q', id: q.id, perm: shuffle(n ? [...Array(n).keys()] : [], r) }; })
  };
}
function taskDef(id){ return X.tasks.find(t => t.id === id); }
function questionDef(id){ return X.questions.find(q => q.id === id); }
function build(items){   // items aus draw() → vollständige Instanzen (nur Server/Validator)
  return { tasks: items.tasks.map(x => instantiate(taskDef(x.id), x.params)), questions: items.questions.map(x => questionItem(questionDef(x.id), x.perm)) };
}

/* ---------- Bewertung ---------- */
// eng = { E: (gewrappte) Grundstufen-Engine der Sprache, PRO: (gewrappte) Profi-Engine }
function errInfo(e){ return { line: e.line || 0, col: e.col || 0, message: String(e.message || e), block: e.block || null }; }
function gradeTask(it, answer, eng){
  const size = JSON.stringify(answer || '').length;
  if(size > LIMITS.codeBytes) return { points: 0, passed: 0, total: 0, ok: false, error: { line: 0, message: 'Code zu gross (max. 20 KB).' } };
  const prevIter = root.SCL_MAX_ITER; root.SCL_MAX_ITER = LIMITS.maxIter;
  try{ return it.kind === 'grund' ? gradeGrund(it, String(answer || ''), eng) : gradePro(it, answer && typeof answer === 'object' ? answer : {}, eng); }
  finally{ root.SCL_MAX_ITER = prevIter; }
}
function score(passed, total, mustOk){ if(!total) return 0; if(passed === total && mustOk) return 1; return Math.round(PARTIAL * passed / total * 1000) / 1000; }
function gradeGrund(it, code, eng){
  const t = toTask(it, 'hidden'), E = eng.E;
  if(!code.trim()) return { points: 0, passed: 0, total: 0, ok: false, error: { line: 0, message: 'Kein Code abgegeben.' } };
  let prog;
  try{ prog = E.compileSCL(code, t); }catch(e){ return { points: 0, passed: 0, total: casesOf(t).length, ok: false, error: errInfo(e) }; }
  const cases = casesOf(t); let passed = 0, rtErr = null;
  cases.forEach(c => {
    let r;
    try{ r = t.timedTestCases ? E.runTimedTests(prog, t.initialVars, [c]) : E.runSinglePassTests(prog, t.initialVars, [c]); }catch(e){ r = { ok: false, error: e }; }
    if(r.ok) passed++; else if(r.error && !rtErr) rtErr = errInfo(r.error);
  });
  // Funktion zählt: erzeugte Tests aus der Musterlösung als zusätzliche Gruppe; Bausteine (must) nur noch als Hinweis
  let total = cases.length;
  const a = autoFor(it, () => root.SPSQEquiv.autoTests(t, E, EXAM_AUTO));
  if(a && passed === cases.length){ total++; let r; try{ r = t.timedTestCases ? E.runTimedTests(prog, t.initialVars, a.timedTestCases) : E.runSinglePassTests(prog, t.initialVars, a.testCases); }catch(e){ r = { ok: false }; } if(r.ok) passed++; }
  else if(a) total++;
  let missing = [];
  if(it.must && it.must.length){ try{ const used = E.constructsUsed(prog); missing = it.must.filter(m => !used.has(m)); }catch(e){} }
  const points = score(passed, total, true);
  return { points, passed, total, ok: points === 1, missing, error: rtErr };
}
// erzeugte Tests je Aufgabe + Parameter einmal berechnen (Worker: je Isolat zwischengespeichert)
const AUTO = new Map();
const EXAM_AUTO = { sequences: 4, changes: 10, maxCombos: 256 };   // Rechenzeit im Worker (10 ms CPU) begrenzen
function autoFor(it, make){
  if(!root.SPSQEquiv || !it.ref && !(it.blocks || []).some(b => b.ref)) return null;
  const k = it.id + '|' + JSON.stringify(it.params || {});
  if(!AUTO.has(k)){ let a = null; try{ a = make(); }catch(e){} AUTO.set(k, a); if(AUTO.size > 400) AUTO.delete(AUTO.keys().next().value); }
  return AUTO.get(k);
}
function casesOf(t){ return t.timedTestCases || t.testCases || []; }
function gradePro(it, codes, eng){
  const t = toTask(it, 'hidden'), PRO = eng.PRO;
  const editable = it.blocks.filter(b => b.edit).map(b => b.name);
  const project = { sources: it.blocks.map(b => ({ block: b.name, src: b.edit ? (codes[b.name] !== undefined ? String(codes[b.name]) : b.start) : b.src, ob: b.ob })),
    globals: it.globals, globalTypes: it.types, globalComments: it.comments, instances: it.instances };
  let prog;
  try{ prog = PRO.compileProject(project); }catch(e){ return { points: 0, passed: 0, total: 1, ok: false, error: errInfo(e) }; }
  const groups = [].concat(t.unit.map(u => ({ unit: [u], tests: [], timed: [] })), t.tests.map(x => ({ unit: [], tests: [x], timed: [] })), t.timed.map(x => ({ unit: [], tests: [], timed: [x] })));
  let passed = 0, rtErr = null;
  groups.forEach(g => {
    let r;
    try{ r = PRO.runAll(prog, g); }catch(e){ r = { ok: false, error: e }; }
    if(r.ok) passed++; else if(!rtErr){ const f = r.failed; if(f && f.error) rtErr = errInfo(f.error); else if(r.error) rtErr = errInfo(r.error); }
  });
  let total = groups.length;
  const refProject = c => PRO.compileProject({ sources: it.blocks.map(b => ({ block: b.name, src: b.edit ? (c[b.name] !== undefined ? c[b.name] : b.ref) : b.src, ob: b.ob })), globals: it.globals, globalTypes: it.types, globalComments: it.comments, instances: it.instances });
  const a = autoFor(it, () => root.SPSQEquiv.autoTestsPro(Object.assign({}, t, { project: { blocks: it.blocks.map(b => Object.assign({}, b)) } }), PRO, refProject, EXAM_AUTO));
  if(a){ total++; if(passed === groups.length){ let r; try{ r = PRO.runAll(prog, a); }catch(e){ r = { ok: false }; } if(r.ok) passed++; } }
  let missing = [], warn = [];
  try{ const used = PRO.constructsUsed(prog, editable); missing = (it.must || []).filter(m => !used.has(m)); }catch(e){}
  warn = (prog.warnings || []).filter(w => (it.warnFree || []).includes(w.code)).map(w => w.code);
  const points = score(passed, total, true);
  return { points, passed, total, ok: points === 1, missing, warn, error: rtErr };
}
function gradeQuestion(qi, answer){ const a = +answer; return { points: Number.isInteger(a) && a === qi.answer ? 1 : 0, ok: a === qi.answer }; }
// Gesamtpunkte aus gespeicherten Einzelpunkten
function total(built, pts){
  const tp = built.tasks.map(t => pts[t.id] || 0), qp = built.questions.map(q => pts[q.id] || 0);
  const tAvg = tp.length ? tp.reduce((a, b) => a + b, 0) / tp.length : 0, qAvg = qp.length ? qp.reduce((a, b) => a + b, 0) / qp.length : 0;
  const s = Math.round((WEIGHT.tasks * tAvg + WEIGHT.theory * qAvg) * 1000) / 1000;
  return { score: s, tasks: Math.round(tAvg * 1000) / 1000, theory: Math.round(qAvg * 1000) / 1000, passed: s >= PASS, distinction: s >= DISTINCTION };
}

// Engines je Quest (Worker/Validator: rohe Globals SCLEngine, SCLPro, KOP, AWL)
let ENG = null;
function engines(){
  if(ENG) return ENG;
  const SE = root.SCLEngine, PRO = root.SCLPro, K = root.KOP, A = root.AWL;
  const kop = K ? { E: K.wrapEngine(SE), PRO: K.wrapPro(PRO) } : null, awl = A ? { E: A.wrapEngine(SE), PRO: A.wrapPro(PRO) } : null;
  ENG = { scl: { E: SE, PRO }, kop, fup: kop, awl };
  return ENG;
}
function gradeFor(it, answer){ return gradeTask(it, answer, engines()[it.quest]); }
// Spiel-Aufgabe (Final Boss) gegen ihre Tests prüfen – Garderobe 2.0: legendäre Teile nur mit echter Lösung (Worker beim Kauf)
function checkGameTask(t, code, quest){
  const E = engines()[quest].E;
  if(typeof code !== 'string' || !code.trim() || code.length > LIMITS.codeBytes) return false;
  const prev = root.SCL_MAX_ITER; root.SCL_MAX_ITER = LIMITS.maxIter;
  try{
    const prog = E.compileSCL(code, t);
    if((t.testCases || []).length && !E.runSinglePassTests(prog, t.initialVars, t.testCases).ok) return false;
    if((t.timedTestCases || []).length && !E.runTimedTests(prog, t.initialVars, t.timedTestCases).ok) return false;
    // Funktion zählt: zusätzlich die erzeugten Tests (Bausteine sind egal)
    const a = root.SPSQEquiv && t.refSolution ? autoFor({ id: 'game:' + quest + ':' + t.id }, () => root.SPSQEquiv.autoTests(t, E)) : null;
    if(a && (a.testCases || []).length && !E.runSinglePassTests(prog, t.initialVars, a.testCases).ok) return false;
    if(a && (a.timedTestCases || []).length && !E.runTimedTests(prog, t.initialVars, a.timedTestCases).ok) return false;
    return true;
  }catch(e){ return false; }
  finally{ root.SCL_MAX_ITER = prev; }
}

root.SPSQExam = { engines, gradeFor, RULES, WEIGHT, PASS, DISTINCTION, PARTIAL, LIMITS, QUESTS, LEVELS, X, rng, shuffle, hashStr, langOf,
  instantiate, allParams, pickParams, toTask, publicItem, questionItem, publicQuestion, pool, draw, build, taskDef, questionDef,
  gradeTask, gradeQuestion, total, checkGameTask };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SPSQExam;
})(typeof window !== 'undefined' ? window : globalThis);
