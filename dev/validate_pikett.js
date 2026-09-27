// Validator Pikettdienst (docs/PLAN_ZERTIFIKAT_PIKETT.md B.4): node validate_pikett.js [--full] [--quest=kop]
// program: Referenz besteht, Fehlerversion übersetzt und scheitert · hardware: Referenz ohne force besteht, mit force scheitert,
// geforcte Variable ist ein Eingang der Aufgabe · operator: falscher Parameter scheitert, richtiger besteht ·
// Alarmnummern je Quest eindeutig und im Nummernkreis, Texte, Ursache aus der festen Liste und passend zur Art, Kapitel gültig.
// --full: Mindestanzahlen (≥ 40 Störungen, ≥ 12 Hardware, ≥ 4 Bedienung je Quest) als Fehler statt Hinweis.
const fs = require('fs'), path = require('path'), vm = require('vm');
const FULL = process.argv.includes('--full');
const ONLY = (process.argv.find(a => a.startsWith('--quest=')) || '').slice(8) || null;
const DIRS = { scl: 'content', kop: 'content_kop', fup: 'content_fup', awl: 'content_awl' };
const R = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let errors = 0, warns = 0;
const E_ = (id, m) => { errors++; console.log('✗ [' + id + '] ' + m); };
const W_ = (id, m) => { warns++; console.log('△ [' + id + '] ' + m); };

// Quest-Inhalte in eigenem Kontext laden (wie build.js), dazu Pikett-Kern und content*/pikett.js
function load(q){
  const g = { console }; g.window = g; g.globalThis = g; g.QUEST = { id: q, lang: q };
  const ctx = vm.createContext(g);
  const dir = DIRS[q];
  const files = ['engine.js', 'engine_pro.js'].concat(q === 'kop' || q === 'fup' ? ['kop.js'] : q === 'awl' ? ['awl.js'] : [], ['pikett_core.js', 'content/_helpers.js'],
    q === 'kop' || q === 'fup' ? ['content_kop/_kop.js'] : q === 'awl' ? ['content_awl/_awl.js'] : [],
    ['manual.js', 'chapters.js'].map(f => dir + '/' + f), fs.readdirSync(path.join(__dirname, 'src', dir)).filter(f => /^ch\d+\.js$/.test(f)).sort().map(f => dir + '/' + f),
    ['theory.js', 'theory_pro.js', 'bugs.js', 'pikett.js'].map(f => dir + '/' + f));
  files.forEach(f => { if(fs.existsSync(path.join(__dirname, 'src', f))) vm.runInContext(R(f), ctx, { filename: f }); });
  if(q === 'kop' || q === 'fup') g.SCLPro = g.KOP.wrapPro(g.SCLPro);
  if(q === 'awl') g.SCLPro = g.AWL.wrapPro(g.SCLPro);
  const SE = g.SCLEngine, E = q === 'kop' || q === 'fup' ? g.KOP.wrapEngine(SE) : q === 'awl' ? g.AWL.wrapEngine(SE) : SE;
  return { g, C: g.SCL_CONTENT, PK: g.SPSQPikett, eng: { E, PRO: g.SCLPro, ProTask: g.ProTask } };
}

const summary = [];
for(const q of Object.keys(DIRS).filter(q => !ONLY || q === ONLY)){
  const { g, C, PK, eng } = load(q);
  const list = PK.incidents(C, q), TBY = Object.fromEntries(C.tasks.map(t => [t.id, t])), nos = new Set(), ids = new Set();
  const P = PK.PLANT[q], causes = {};
  for(const inc of list){
    const id = q + ':' + inc.id;
    if(ids.has(inc.id)) E_(id, 'doppelte ID'); ids.add(inc.id);
    const t = TBY[inc.base];
    if(!t){ E_(id, 'Grundaufgabe „' + inc.base + '“ fehlt'); continue; }
    if(!(inc.chapter >= 1 && inc.chapter <= 15) || inc.chapter !== t.level) E_(id, 'Kapitel ' + inc.chapter + ' passt nicht zur Aufgabe (Kapitel ' + t.level + ')');
    if(!['program', 'hardware', 'operator'].includes(inc.kind)) E_(id, 'unbekannte Art ' + inc.kind);
    const c = PK.CAUSE[inc.cause];
    if(!c) E_(id, 'Ursache „' + inc.cause + '“ nicht in der Liste'); else if(c.group !== inc.kind) E_(id, 'Ursache ' + inc.cause + ' passt nicht zur Art ' + inc.kind);
    causes[inc.cause] = (causes[inc.cause] || 0) + 1;
    const no = +(inc.alarm && inc.alarm.no), rg = PK.RANGE[inc.kind] || [0, 0];
    if(!inc.alarm || !inc.alarm.text) E_(id, 'Alarmtext fehlt');
    if(!(no >= P.base + rg[0] && no <= P.base + rg[1])) E_(id, 'Alarmnummer ' + (inc.alarm || {}).no + ' ausserhalb ' + (P.base + rg[0]) + '–' + (P.base + rg[1]));
    if(nos.has(no)) E_(id, 'Alarmnummer ' + no + ' doppelt'); nos.add(no);
    if(![1, 2, 3].includes(inc.alarm && inc.alarm.prio)) E_(id, 'Priorität muss 1, 2 oder 3 sein');
    if(!(inc.hints || []).length) W_(id, 'keine Hinweise');
    const ref = PK.refCode(t, eng.ProTask);
    const r0 = PK.evaluate(t, ref, eng);
    if(!r0.ok){ E_(id, 'Referenz der Grundaufgabe besteht nicht' + (r0.error ? ': ' + r0.error.message : '')); continue; }
    if(inc.kind === 'program'){
      let code;
      try { code = PK.bugCodeOf(inc, C, g.bugCode); } catch(e){ E_(id, 'Fehlerversion: ' + e.message); continue; }
      const r = PK.evaluate(t, code, eng);
      if(r.error && !(r.error instanceof g.SCLEngine.SCLError) && !/Zeile|Netzwerk|Baustein/.test(r.error.message)) E_(id, 'Fehlerversion wirft: ' + r.error.message);
      else if(r.ok) E_(id, 'Fehlerversion besteht die Tests');
      if(r.error && /Syntax|erwartet|unbekannt|nicht deklariert/i.test(r.error.message || '')) E_(id, 'Fehlerversion übersetzt nicht: ' + r.error.message);
    } else {
      const ins = PK.inputsOf(t);
      const fv = inc.kind === 'hardware' ? inc.force : inc.param && { [inc.param.var]: inc.param.wrong };
      if(!fv || !Object.keys(fv).length){ E_(id, inc.kind === 'hardware' ? 'force fehlt' : 'param { var, wrong, right } fehlt'); continue; }
      Object.keys(fv).forEach(k => { if(!ins.includes(k)) E_(id, '„' + k + '“ ist kein Eingang der Aufgabe (Eingänge: ' + ins.join(', ') + ')'); });
      if(PK.evaluate(t, ref, eng, { force: fv }).ok) E_(id, (inc.kind === 'hardware' ? 'Referenz mit force' : 'falscher Parameter') + ' besteht – Symptom nicht sichtbar');
      if(inc.kind === 'hardware' && (!inc.part || !ins.includes(inc.part))) E_(id, 'Bauteil „' + inc.part + '“ ist kein Eingang der Aufgabe');
      if(inc.kind === 'operator' && !PK.evaluate(t, ref, eng, { force: { [inc.param.var]: inc.param.right } }).ok) E_(id, 'richtiger Parameter besteht nicht');
    }
  }
  const n = list.length, hw = list.filter(x => x.kind === 'hardware').length, op = list.filter(x => x.kind === 'operator').length;
  const chs = new Set(list.map(x => x.chapter));
  [[n >= 40, n + ' Störungen (Ziel ≥ 40)'], [hw >= 12, hw + ' Hardware-Störungen (Ziel ≥ 12)'], [op >= 4, op + ' Bedienfehler (Ziel ≥ 4)'], [chs.size >= 15, chs.size + ' Kapitel abgedeckt (Ziel 15)']]
    .forEach(([ok, m]) => { if(!ok) (FULL ? E_ : W_)(q, m); });
  summary.push(q.toUpperCase() + ': ' + n + ' Störungen (' + (n - hw - op) + ' Programm, ' + hw + ' Hardware, ' + op + ' Bedienung) · Ursachen ' + JSON.stringify(causes));
}
summary.forEach(s => console.log(s));
if(errors){ console.log(errors + ' Fehler, ' + warns + ' Hinweise'); process.exit(1); }
console.log('OK — keine Fehler (' + warns + ' Hinweise)');
