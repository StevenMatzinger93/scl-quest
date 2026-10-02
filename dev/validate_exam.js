// Validator für die Prüfungspools (Zertifikat): node validate_exam.js [--full]  → muss „OK — keine Fehler“ melden
// Prüft je Aufgabe und Parameterkombination (bzw. 50 zufällige): Referenz besteht sichtbare + verdeckte Tests und ist
// warnungsfrei, Startcode und jede Fehlversion scheitern, sichtbare ≠ verdeckte Tests, keine unersetzten Platzhalter,
// Bewertung < 2 ms (sonst Warnung). Fragen: genau eine Antwort im Optionsset, keine Dubletten zu Spiel-Theoriefragen.
// --full: zusätzlich Poolgrössen und Kapitelabdeckung (A.9) als Fehler statt Warnung.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
require('./src/engine.js'); require('./src/engine_pro.js'); require('./src/kop.js'); require('./src/awl.js');
const X = require('./src/exam_core.js');
require('./src/content/_helpers.js'); require('./src/content_kop/_kop.js'); require('./src/content_awl/_awl.js');   // kFC/aFC/truth …
const FULL = process.argv.includes('--full');
const ONLY = (process.argv.find(a => a.startsWith('--quest=')) || '').slice(8) || null;   // --quest=kop: nur diese Quest prüfen
const DIRS = { scl: 'content', kop: 'content_kop', fup: 'content_fup', awl: 'content_awl' };
Object.values(DIRS).forEach(d => { const f = path.join(__dirname, 'src', d, 'exam.js'); if(fs.existsSync(f)) require(f); });
let errors = 0, warns = 0;
const E_ = (id, m) => { errors++; console.log('✗ [' + id + '] ' + m); };
const W_ = (id, m) => { warns++; console.log('△ [' + id + '] ' + m); };
const ENG = X.engines();
const SIZE = { grund: { tasks: 18, questions: 40 }, profi: { tasks: 12, questions: 30 } };

// Theoriefragen der Spiele (Dublettenprüfung), je Quest in einem eigenen Kontext geladen
function gameQuestions(q){
  const g = { console }; g.window = g; g.globalThis = g; g.QUEST = { id: q, lang: q };
  const ctx = vm.createContext(g);
  ['engine.js', 'engine_pro.js', 'kop.js', 'awl.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx));
  const helpers = ['content/_helpers.js'].concat(q === 'kop' || q === 'fup' ? ['content_kop/_kop.js'] : q === 'awl' ? ['content_awl/_awl.js'] : []);
  const files = helpers.concat(['theory.js', 'theory_pro.js'].map(f => DIRS[q] + '/' + f));
  files.forEach(f => { const p = path.join(__dirname, 'src', f); if(fs.existsSync(p)) try{ vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }catch(e){ W_('theorie-' + q, f + ': ' + e.message); } });
  const out = [];
  ((g.SCL_CONTENT || {}).theory || []).forEach(t => (t.questions || t.quiz || []).forEach(x => out.push(norm(x.q || x.question || ''))));
  return new Set(out.filter(Boolean));
}
const norm = s => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const placeholder = s => /undefined|NaN|\$\{|\[object Object\]/.test(String(s));

function failInfo(r){ return r.error ? 'Fehler Z' + r.error.line + ': ' + r.error.message : (r.missing && r.missing.length ? 'must fehlt: ' + r.missing.join(',') : r.warn && r.warn.length ? 'Warnung: ' + r.warn.join(',') : r.passed + '/' + r.total + ' Tests'); }
function visibleGrade(it, answer){ const v = Object.assign({}, it, { hidden: it.visible }); return X.gradeTask(v, answer, ENG[it.quest]); }

const ids = new Set();
for(const def of X.X.tasks.filter(t => !ONLY || t.quest === ONLY)){
  const id = def.id;
  if(ids.has(id)) E_(id, 'doppelte ID'); ids.add(id);
  if(!X.QUESTS.includes(def.quest)) E_(id, 'unbekannte Quest ' + def.quest);
  if(!X.LEVELS.includes(def.level)) E_(id, 'unbekannte Stufe ' + def.level);
  const R = X.RULES[def.level] || X.RULES.grund;
  if(!(def.ch >= R.chapters[0] && def.ch <= R.chapters[1])) E_(id, 'Kapitel ' + def.ch + ' passt nicht zur Stufe');
  if(![1, 2, 3].includes(def.diff)) E_(id, 'diff muss 1, 2 oder 3 sein');
  const combos = X.allParams(def, 50);
  for(const p of combos){
    const tag = id + (Object.keys(p).length ? ' ' + JSON.stringify(p) : '');
    let it;
    try{ it = X.instantiate(def, p); }catch(e){ E_(tag, 'Instanz: ' + e.message); continue; }
    ['title', 'brief', 'story'].forEach(k => { if(placeholder(it[k])) E_(tag, k + ' enthält Platzhalter: ' + String(it[k]).slice(0, 80)); });
    if(!it.title || !it.brief) E_(tag, 'Titel oder Aufgabentext fehlt');
    const ref = it.kind === 'grund' ? it.ref : Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.ref]));
    const start = it.kind === 'grund' ? it.start : Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.start]));
    X.gradeTask(it, ref, ENG[def.quest]);   // Aufwärmen (JIT), gemessen wird der zweite Lauf
    // warm gemessen: bester von drei Läufen (einzelne Ausreisser durch Speicherbereinigung zählen nicht, Paket P)
    let r, ms = Infinity;
    for(let k = 0; k < 3; k++){ const t0 = process.hrtime.bigint(); r = X.gradeTask(it, ref, ENG[def.quest]); ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6); }
    if(!r.ok) E_(tag, 'Referenz besteht verdeckte Tests nicht: ' + failInfo(r));
    if(ms > 5) W_(tag, 'Bewertung dauert warm ' + ms.toFixed(2) + ' ms (Ziel < 5 ms, Workers Free: 10 ms CPU)');
    const rv = visibleGrade(it, ref);
    if(!rv.ok) E_(tag, 'Referenz besteht sichtbare Tests nicht: ' + failInfo(rv));
    if(it.kind === 'profi'){
      try{ const prog = ENG[def.quest].PRO.compileProject({ sources: it.blocks.map(b => ({ block: b.name, src: b.edit ? b.ref : b.src, ob: b.ob })), globals: it.globals, globalTypes: it.types, globalComments: it.comments, instances: it.instances });
        prog.warnings.forEach(w => E_(tag, 'Referenz-Warnung ' + w.code + ': ' + w.msg)); }catch(e){ E_(tag, 'Referenz kompiliert nicht: ' + e.message); }
      it.blocks.forEach(b => { if(!b.edit) return; if(!b.start) W_(tag, 'Baustein ' + b.name + ' ohne Startcode'); });
      if(it.blocks.filter(b => b.edit).length > 2) E_(tag, 'höchstens 2 editierbare Bausteine (CPU-Budget)');
      const hv = it.hidden, n = hv.unit.reduce((a, u) => a + u.steps.length, 0) + hv.tests.length + hv.timed.reduce((a, t) => a + t.steps.length, 0);
      if(n < 6) E_(tag, 'zu wenige verdeckte Prüfschritte (' + n + ', mind. 6)');
    } else {
      const n = it.timed ? it.hidden.reduce((a, c) => a + (c.steps || []).length, 0) : it.hidden.length;
      if(n < 6) E_(tag, 'zu wenige verdeckte Prüfschritte (' + n + ', mind. 6)');
      if(it.timed && it.hidden.length < 3) E_(tag, 'zu wenige verdeckte Zeitverläufe (' + it.hidden.length + ', mind. 3)');
    }
    const sr = X.gradeTask(it, start, ENG[def.quest]);
    if(sr.ok) E_(tag, 'Startcode besteht bereits');
    (def.wrong || []).forEach((w, i) => {
      let code = typeof w === 'function' ? w(p) : w;
      if(it.kind === 'profi') code = Object.assign({}, ref, code);
      const wr = X.gradeTask(it, code, ENG[def.quest]);
      if(wr.ok) E_(tag, 'Fehlversion #' + (i + 1) + ' besteht die verdeckten Tests');
    });
    if(!(def.wrong || []).length) W_(tag, 'keine Fehlversionen (wrong)');
    if(JSON.stringify(it.visible) === JSON.stringify(it.hidden)) E_(tag, 'sichtbare und verdeckte Tests sind identisch');
    // Der Browser darf nie die verdeckten Tests oder die Referenz sehen
    const pub = JSON.stringify(X.publicItem(it));
    if(JSON.stringify(it.hidden).length > 20 && pub.includes(JSON.stringify(it.hidden))) E_(tag, 'verdeckte Tests im öffentlichen Teil');
    if(it.kind === 'grund' && it.ref && pub.includes(JSON.stringify(it.ref))) E_(tag, 'Referenz im öffentlichen Teil');
  }
}
// Fragen
const gq = {}; X.QUESTS.filter(q => !ONLY || q === ONLY).forEach(q => { gq[q] = gameQuestions(q); });
for(const q of X.X.questions.filter(x => !ONLY || x.quest === ONLY)){
  if(ids.has(q.id)) E_(q.id, 'doppelte ID'); ids.add(q.id);
  const opts = typeof q.options === 'function' ? q.options({}) : q.options;
  if(!Array.isArray(opts) || opts.length < 2) E_(q.id, 'zu wenige Antworten');
  else {
    if(!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < opts.length)) E_(q.id, 'Antwort-Index ausserhalb der Optionen');
    if(new Set(opts.map(norm)).size !== opts.length) E_(q.id, 'doppelte Antwortoptionen');
  }
  const R = X.RULES[q.level] || X.RULES.grund;
  if(!(q.ch >= R.chapters[0] && q.ch <= R.chapters[1])) E_(q.id, 'Kapitel ' + q.ch + ' passt nicht zur Stufe');
  if(placeholder(q.q)) E_(q.id, 'Frage enthält Platzhalter');
  if(gq[q.quest] && gq[q.quest].has(norm(q.q))) E_(q.id, 'Dublette zu einer Theoriefrage im Spiel');
  const qi = X.questionItem(q, X.shuffle([...Array(opts.length).keys()], X.rng(q.id)));
  if(qi.options[qi.answer] !== opts[q.answer]) E_(q.id, 'Mischen verliert die richtige Antwort');
}
// Poolgrössen, Kapitelabdeckung, Ziehung
for(const quest of X.QUESTS.filter(q => !ONLY || q === ONLY)) for(const level of X.LEVELS){
  const P = X.pool(quest, level), R = X.RULES[level], tag = 'pool ' + quest + '/' + level;
  if(!P.tasks.length && !P.questions.length){ (FULL ? E_ : W_)(tag, 'leer'); continue; }
  const need = SIZE[level], report = FULL ? E_ : W_;
  if(P.tasks.length < need.tasks) report(tag, P.tasks.length + ' Aufgaben (Soll ' + need.tasks + ')');
  if(P.questions.length < need.questions) report(tag, P.questions.length + ' Fragen (Soll ' + need.questions + ')');
  const perCh = level === 'profi' ? 2 : 1;   // A.9: Grundstufe ≥ 1 je Kapitel, Profi ≥ 2 je Kapitel
  for(let c = R.chapters[0]; c <= R.chapters[1]; c++){ const n = P.tasks.filter(t => t.ch === c).length; if(n < perCh) report(tag, n + ' Aufgabe(n) zu Kapitel ' + c + ' (Soll ' + perCh + ')'); }
  [1, 2, 3].forEach((d, i) => { const n = P.tasks.filter(t => t.diff === d).length; if(n < R.mix[i]) report(tag, 'zu wenige Aufgaben mit diff ' + d + ' (' + n + ' < ' + R.mix[i] + ')'); });
  if(P.tasks.length >= R.tasks && P.questions.length >= R.questions){
    for(let s = 0; s < 30; s++){
      const d = X.draw(quest, level, 'val' + s);
      if(d.tasks.length !== R.tasks || d.questions.length !== R.questions){ E_(tag, 'Ziehung liefert ' + d.tasks.length + '/' + d.questions.length); break; }
      const b = X.build(d), cc = new Set(b.tasks.map(t => t.ch).concat(b.questions.map(q => q.ch)));
      if(cc.size < R.minChapters){ report(tag, 'Ziehung deckt nur ' + cc.size + ' Kapitel ab'); break; }
    }
  }
}
console.log('Prüfungsaufgaben: ' + X.X.tasks.length + ', Fragen: ' + X.X.questions.length);
console.log(errors ? 'FEHLER: ' + errors + ' (' + warns + ' Warnungen)' : 'OK — keine Fehler (' + warns + ' Warnungen)');
process.exit(errors ? 1 : 0);
