(function(root){
"use strict";
/* ============================================================
   CONTENT-HELFER: kompakte Schreibweise für Aufgaben & Theorie
   ------------------------------------------------------------
   defTask({
     id, ch (Kapitel 1..10), title, story, brief, learn, take,
     vars:{...}, types:{Var:'REAL'|'TIME'|'ARRAY OF REAL'}, fb:{Inst:'TON'},
     tests:[[setup, expect], ...]              // Einzelzyklus
     timed:[{setup, steps:[[dt, inputs, expect], ...]}]   // Zeitverlauf
     ref, start (Startcode), debug, boss, man (Handbuch-ID), must:['FOR'],
     hint, hint2,
     bind:['gripperOpen=Greifer_Auf', 'displayLabel:"STUFE"', {channel, variable, map}]
   })
   ============================================================ */
const C = root.SCL_CONTENT = root.SCL_CONTENT || { tasks: [], theory: [], chapters: [] };

function parseBind(b){
  if(typeof b === 'object') return b;
  const eq = b.indexOf('='), col = b.indexOf(':');
  if(col > -1 && (eq === -1 || col < eq)){
    return { channel: b.slice(0, col), value: JSON.parse(b.slice(col + 1)) };
  }
  return { channel: b.slice(0, eq), variable: b.slice(eq + 1) };
}
function lines(code){ return code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).length; }

root.defTask = function(o){
  const t = {
    id: o.id, level: o.ch, title: o.title, story: o.story, briefing: o.brief,
    learn: o.learn || '', takeaway: o.take || '',
    isDebug: !!o.debug, isBoss: !!o.boss,
    starterCode: o.start || '',
    initialVars: o.vars || {}, varTypes: o.types || {}, fbTypes: o.fb || {},
    refSolution: o.ref, refLines: lines(o.ref),
    manualId: o.man || null, mustUse: o.must || [],
    hint: o.hint || '', hint2: o.hint2 || '',
    sceneBindings: (o.bind || []).map(parseBind)
  };
  if(o.timed) t.timedTestCases = o.timed.map(tc => ({ setup: tc.setup || {}, steps: tc.steps.map(s => ({ dt: s[0], inputs: s[1] || {}, expect: s[2] || {} })) }));
  else t.testCases = (o.tests || []).map(x => ({ setup: x[0] || {}, expect: x[1] || {} }));
  if(o.final) t.isFinal = true;
  if(o.wrong) t._wrong = o.wrong;           // nur für den Validator
  C.tasks.push(t);
  return t;
};

/* ============================================================
   PROFI-STUFE (Kapitel 11–15): Projekt-Aufgaben
   defProTask({
     id, ch, title, story, brief, learn, take, man, hint, hint2, debug, boss, final,
     blocks:[{name, kind:'FB'|'FC'|'OB'|'UDT'|'DB', edit:true, start, ref} | {name, kind, src}],
     globals:{Name:Startwert}, types:{Name:'DINT'|'STRING[24]'|'ARRAY[1..8] OF REAL'},
     comments:{Name:'Kommentar'}, instances:{Band1_DB:'FB_Motor'},
     unit:[{block, setup, steps:[[dt, inputs, expect] | [inputs, expect]]}],   // Baustein isoliert
     tests:[[setup, expect]],  timed:[{setup, steps:[[dt, inputs, expect]]}], // ganzes Programm
     must:['FB','MULTI',…], warnFree:['TEMP_READ_BEFORE_WRITE',…], table:true|false,
     bind:[…], wrong:[{Baustein:'Quelltext'}]
   })
   ============================================================ */
function normStep(s){
  if(!Array.isArray(s)) return { dt: s.dt || 0, inputs: s.inputs || {}, expect: s.expect || {} };
  if(s.length === 3) return { dt: s[0] || 0, inputs: s[1] || {}, expect: s[2] || {} };
  return { dt: 0, inputs: s[0] || {}, expect: s[1] || {} };
}
root.defProTask = function(o){
  const blocks = o.blocks.map(b => ({ name: b.name, kind: b.kind, edit: !!b.edit, start: b.start || '', src: b.src || '', ref: b.ref || '', ob: b.ob, title: b.title || '', free: !!b.free }));
  const refLines = blocks.filter(b => b.edit).reduce((n, b) => n + lines((b.ref.split(/\bBEGIN\b/)[1] || b.ref)), 0);
  const t = {
    id: o.id, level: o.ch, pro: true, title: o.title, story: o.story, briefing: o.brief,
    learn: o.learn || '', takeaway: o.take || '',
    isDebug: !!o.debug, isBoss: !!o.boss, isFinal: !!o.final,
    manualId: o.man || null, mustUse: o.must || [], warnFree: o.warnFree || [],
    hint: o.hint || '', hint2: o.hint2 || '',
    tableMode: o.table !== undefined ? !!o.table : o.ch >= 12,
    project: { blocks, globals: o.globals || {}, types: o.types || {}, comments: o.comments || {}, instances: o.instances || {} },
    unit: (o.unit || []).map(u => ({ block: u.block, setup: u.setup || {}, steps: u.steps.map(normStep) })),
    tests: (o.tests || []).map(x => ({ setup: x[0] || {}, expect: x[1] || {} })),
    timed: (o.timed || []).map(tc => ({ setup: tc.setup || {}, steps: tc.steps.map(normStep) })),
    initialVars: o.globals || {}, varTypes: {}, fbTypes: {},
    refLines, sceneBindings: (o.bind || []).map(parseBind), starterCode: ''
  };
  if(o.wrong) t._wrong = o.wrong;
  C.tasks.push(t);
  return t;
};
// Gemeinsame Logik für App und Validator
root.ProTask = {
  editable(t){ return t.project.blocks.filter(b => b.edit).map(b => b.name); },
  startCodes(t){ const o = {}; t.project.blocks.forEach(b => { if(b.edit) o[b.name] = b.start; }); return o; },
  refCodes(t){ const o = {}; t.project.blocks.forEach(b => { if(b.edit) o[b.name] = b.ref; }); return o; },
  project(t, codes){
    return {
      sources: t.project.blocks.map(b => ({ block: b.name, src: b.edit ? ((codes && codes[b.name] !== undefined) ? codes[b.name] : b.start) : b.src, ob: b.ob })),
      globals: t.project.globals, globalTypes: t.project.types, globalComments: t.project.comments, instances: t.project.instances
    };
  },
  compile(t, codes){ return root.SCLPro.compileProject(this.project(t, codes)); },
  evaluate(t, codes, opts){
    const prog = this.compile(t, codes);
    const res = root.SCLPro.runAll(prog, { unit: t.unit, tests: t.tests, timed: t.timed }, opts);
    const used = root.SCLPro.constructsUsed(prog, this.editable(t));
    const missing = t.mustUse.filter(m => !used.has(m));
    const warnHits = prog.warnings.filter(w => t.warnFree.includes(w.code));
    return { prog, res, used, missing, warnHits, ok: res.ok && !missing.length && !warnHits.length };
  }
};

root.defChapter = function(o){ C.chapters.push(o); };
root.defTheory = function(o){ C.theory.push(o); };
})(typeof window !== 'undefined' ? window : globalThis);
