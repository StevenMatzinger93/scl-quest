// Sammelt alle KOP-/FUP-Texte der Inhalte (Aufgaben, Startcodes, falsche Lösungen, Störungsjagd, Theorie, Prüfungspools)
// und übersetzt sie mit einer wählbaren kop.js. Für die Abwärtskompatibilität des Textformats (test_kop_format.js).
// corpus(quest, kopPath) → { g, items:[{ src, kind:'plain'|'pro', where }] } · fingerprint(KOP, item) → Übersetzung als Text
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, 'src');

function load(quest, kopPath){
  const g = { console, Math, JSON, Date }; g.window = g; g.globalThis = g; g.QUEST = { id: quest, lang: quest };
  const ctx = vm.createContext(g);
  const run = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  ['engine.js', 'engine_pro.js'].forEach(f => run(path.join(SRC, f)));
  run(kopPath || path.join(SRC, 'kop.js'));
  run(path.join(SRC, 'exam_core.js'));
  run(path.join(SRC, 'content/_helpers.js'));
  run(path.join(SRC, 'content_kop/_kop.js'));
  const dir = path.join(SRC, 'content_' + quest);
  ['manual.js', 'chapters.js'].forEach(f => run(path.join(dir, f)));
  fs.readdirSync(dir).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => run(path.join(dir, f)));
  ['theory.js', 'theory_pro.js', 'bugs.js', 'exam.js'].forEach(f => { if(fs.existsSync(path.join(dir, f))) run(path.join(dir, f)); });
  return g;
}

function corpus(quest, kopPath){
  const g = load(quest, kopPath), K = g.KOP, C = g.SCL_CONTENT, out = [], seen = new Set();
  const add = (src, where) => {
    if(typeof src !== 'string' || !/\bNETWORK\b|=>/.test(src) || /<\/?[a-z]+[ >]/i.test(src)) return;   // HTML-Lektionen nicht
    const sp = K.splitBlock(src);
    const kind = sp ? (K.isKopBody(sp.body) && sp.body.trim() ? 'pro' : null) : (/^\s*NETWORK\b/m.test(src) ? 'plain' : null);
    if(!kind || seen.has(kind + '\u0000' + src)) return;
    seen.add(kind + '\u0000' + src); out.push({ src, kind, where });
  };
  const scan = (o, where, depth) => {
    if(depth > 7 || o == null) return;
    if(typeof o === 'string') return add(o, where);
    if(typeof o === 'function') return;
    if(Array.isArray(o)) return o.forEach(x => scan(x, where, depth + 1));
    if(typeof o === 'object') Object.keys(o).forEach(k => scan(o[k], where, depth + 1));
  };
  C.tasks.forEach(t => {
    scan(t, t.id, 0);
    if(t.pro){ const PT = g.ProTask; [PT.refCodes(t), PT.startCodes(t)].concat(t._wrong || []).forEach(c => scan(c, t.id, 0)); }
  });
  (C.bugs || []).forEach(b => { const t = C.tasks.find(x => x.id === b.task); try{ scan(g.bugCode(t, b), b.id, 0); }catch(e){} });
  (C.theory || []).forEach(th => scan(th, th.id, 0));
  const X = g.SPSQExam;
  X.X.tasks.filter(d => d.quest === quest).forEach(def => {
    X.allParams(def, 50).forEach(p => {
      try{ scan(X.instantiate(def, p), def.id, 0); }catch(e){}
      (def.wrong || []).forEach(w => { try{ scan(w(p), def.id, 0); }catch(e){} });
      ['ref', 'start'].forEach(k => { if(typeof def[k] === 'function') try{ scan(def[k](p), def.id, 0); }catch(e){} });
      if(typeof def.blocks === 'function') try{ scan(def.blocks(p), def.id, 0); }catch(e){}
    });
  });
  return { g, items: out };
}

// Übersetzung als vergleichbarer Text (SCL, Instanzen, Hilfsvariablen, Zeilen, Text nach serialize, Konstrukte, Elemente)
function fingerprint(K, it){
  const r = {};
  try{
    if(it.kind === 'plain'){
      const tr = K.toSCL(it.src);
      r.scl = tr.scl; r.fb = tr.fb; r.vars = Object.keys(tr.vars); r.lines = tr.lineMap;
      r.ser = K.serialize(K.parse(it.src));
      r.cons = [...K.constructs(K.parse(it.src))].sort();
      r.n = K.elementCount(it.src);
    } else {
      const ps = K.proSource(it.src);
      r.src = ps.src;
      const sp = K.splitBlock(it.src);
      r.ser = K.serialize(K.parse(sp.body));
      r.cons = [...K.constructs(K.parse(sp.body))].sort();
      r.n = K.elementCount(sp.body);
    }
  }catch(e){ r.err = String(e.message); }
  return JSON.stringify(r);
}
module.exports = { load, corpus, fingerprint };
