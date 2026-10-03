// Auftrag „Funktion zählt“, V1: Freiheit absichern. node check_funktion.js [scl|kop|fup|awl] [--md]
// Je Aufgabe (Musterlösung + Hand-Tests + erzeugte Tests aus equiv.js):
//  – Mutanten: kleine Fehler an der Musterlösung (Negation weg/dazu, UND↔ODER, Vergleich, Zahl ±1, Zeit ×2, S↔R, SR↔RS, TON↔TOF …)
//    müssen durchfallen. „Überlebt“ = die Tests sind zu schwach oder der Mutant ist zufällig gleichwertig → Liste zum Nachsehen.
//  – Alternativen: andere richtige Wege müssen bestehen (Operanden vertauschen, Zuweisung als IF, SR als S/R-Spulen, Netzwerke umsortieren
//    bei unabhängigen Netzwerken). Fällt eine durch, ist die Prüfung zu streng (meist Zeitverhalten) → Liste.
// --md schreibt den Bericht nach ../docs/FUNKTION_BERICHT.md (bei allen Quests).
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIRS = { scl: 'content', kop: 'content_kop', fup: 'content_fup', awl: 'content_awl' };
const args = process.argv.slice(2), MD = args.includes('--md');
const quests = args.filter(a => DIRS[a]).length ? args.filter(a => DIRS[a]) : Object.keys(DIRS);

function load(q){
  const g = { console }; g.window = g; g.globalThis = g; vm.createContext(g);
  const run = f => vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'), g, { filename: f });
  ['engine.js', 'engine_pro.js', 'kop.js', 'awl.js', 'equiv.js', 'content/_helpers.js'].concat(q === 'kop' || q === 'fup' ? ['content_kop/_kop.js'] : q === 'awl' ? ['content_awl/_awl.js'] : []).forEach(run);
  if(q === 'kop' || q === 'fup') g.SCLPro = g.KOP.wrapPro(g.SCLPro);
  if(q === 'awl') g.SCLPro = g.AWL.wrapPro(g.SCLPro);
  fs.readdirSync(path.join(__dirname, 'src', DIRS[q])).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => run(DIRS[q] + '/' + f));
  return g;
}

/* ---------- Text-Mutationen (alle Sprachen, je Fundstelle ein Mutant) ---------- */
// geschützte Bereiche: Netzwerktitel, Kommentare, Texte – dort ist eine Änderung keine Funktionsänderung
function protectedRanges(src){
  const out = []; let m;
  const re = /^\s*(NETWORK|TITLE)\b.*$|\/\/.*$|\(\*[\s\S]*?\*\)|\/\*[\s\S]*?\*\/|'[^'\n]*'/gm;
  while((m = re.exec(src))){ out.push([m.index, m.index + m[0].length]); if(m[0] === '') re.lastIndex++; }
  return out;
}
let PROT = [];
function occurrences(src, re){ const out = []; let m; const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while((m = r.exec(src))){ if(!PROT.some(([a, b]) => m.index >= a && m.index < b)) out.push(m); if(m[0] === '') r.lastIndex++; } return out; }
function replAt(src, m, rep){ return src.slice(0, m.index) + rep + src.slice(m.index + m[0].length); }
function textMutants(src, lang){
  PROT = protectedRanges(src);
  const out = [], add = (d, s) => { if(s !== src) out.push({ d, src: s }); };
  const body = s => s;
  // Zahlen ±1 (nicht in Zeit-Literalen, nicht in Bezeichnern/Adressen)
  occurrences(src, /(?<![\w#.%])\d+(?![\w#.])/g).slice(0, 6).forEach(m => { const v = +m[0]; add('Zahl ' + v + ' → ' + (v + 1), replAt(src, m, String(v + 1))); if(v > 0) add('Zahl ' + v + ' → ' + (v - 1), replAt(src, m, String(v - 1))); });
  // Zeiten ×2
  occurrences(src, /T#(\d+)(MS|S|M)\b/gi).slice(0, 3).forEach(m => add('Zeit ' + m[0] + ' ×2', replAt(src, m, 'T#' + (2 * +m[1]) + m[2])));
  // Vergleiche
  occurrences(src, /(>=|<=|<>|>|<)/g).filter(m => !/=>|:=/.test(src.slice(m.index - 1, m.index + 2))).slice(0, 4).forEach(m => {
    const alt = { '>': '>=', '>=': '>', '<': '<=', '<=': '<', '<>': '=' }[m[0]]; if(alt) add('Vergleich ' + m[0] + ' → ' + alt, replAt(src, m, alt)); });
  if(lang === 'awl'){
    // Erstabfrage (erste Zeile einer Verknüpfung): U und O wirken gleich → kein echter Mutant
    const firstCheck = m => { const before = src.slice(0, m.index).split('\n').map(x => x.replace(/\/\/.*$/, '').trim()).filter(Boolean); const prev = before[before.length - 1] || '';
      return !prev || /^(=|S\s|R\s|NETWORK|TITLE|BEGIN|[UO]N?\($|X\($|SPB?N?\s|SPA\s|L\s|T\s|BEA|BEB|\w+:)/i.test(prev) || /^(SE|SA|SI|SV|ZV|ZR|CALL)\b/i.test(prev); };
    occurrences(src, /^(\s*)(UN|ON|U|O)(\s+)(?=["#A-Za-z_])/gm).filter(m => !firstCheck(m) || m[2].endsWith('N')).slice(0, 6).forEach(m => {
      const alt = { U: 'O', O: 'U', UN: 'U', ON: 'O' }[m[2]]; add('Zeile „' + m[2] + '“ → „' + alt + '“', replAt(src, m, m[1] + alt + m[3]));
      if(m[2] === 'U' || m[2] === 'O') add('„' + m[2] + '“ → „' + m[2] + 'N“ (negiert)', replAt(src, m, m[1] + m[2] + 'N' + m[3])); });
    occurrences(src, /^(\s*)(S|R)(\s+)(?=["#A-Za-z_])/gm).slice(0, 3).forEach(m => add(m[2] + ' → ' + (m[2] === 'S' ? 'R' : 'S'), replAt(src, m, m[1] + (m[2] === 'S' ? 'R' : 'S') + m[3])));
    occurrences(src, /\b(SE|SA|SI|SV)\b/g).slice(0, 2).forEach(m => add(m[0] + ' → ' + (m[0] === 'SE' ? 'SA' : 'SE'), replAt(src, m, m[0] === 'SE' ? 'SA' : 'SE')));
    occurrences(src, /\b(FP|FN)\b/g).slice(0, 2).forEach(m => add(m[0] + ' → ' + (m[0] === 'FP' ? 'FN' : 'FP'), replAt(src, m, m[0] === 'FP' ? 'FN' : 'FP')));
    return out;
  }
  occurrences(src, /\bAND\b/g).slice(0, 4).forEach(m => add('AND → OR', replAt(src, m, 'OR')));
  occurrences(src, /\bOR\b/g).slice(0, 4).forEach(m => add('OR → AND', replAt(src, m, 'AND')));
  occurrences(src, /\bNOT\s+/g).slice(0, 4).forEach(m => add('NOT weg', replAt(src, m, '')));
  if(lang === 'kop'){
    occurrences(src, /(=>\s*|,\s*)(?=["#]?[A-Za-z_][\w.]*\s*[;,])/g).slice(0, 3).forEach(m => add('Spule negiert', replAt(src, m, m[1] + 'NOT ')));
    occurrences(src, /(=>\s*|,\s*)S\s+/g).slice(0, 2).forEach(m => add('S → R', replAt(src, m, m[1] + 'R ')));
    occurrences(src, /(=>\s*|,\s*)R\s+/g).slice(0, 2).forEach(m => add('R → S', replAt(src, m, m[1] + 'S ')));
    occurrences(src, /\b(SR|RS)\(/g).slice(0, 2).forEach(m => add(m[1] + ' → ' + (m[1] === 'SR' ? 'RS' : 'SR'), replAt(src, m, (m[1] === 'SR' ? 'RS' : 'SR') + '(')));
    occurrences(src, /\b(TON|TOF|TP)\(/g).slice(0, 2).forEach(m => add(m[1] + ' → ' + (m[1] === 'TON' ? 'TOF' : 'TON'), replAt(src, m, (m[1] === 'TON' ? 'TOF' : 'TON') + '(')));
    occurrences(src, /\b([PN])\(/g).slice(0, 2).forEach(m => add('Flanke ' + m[1] + ' → ' + (m[1] === 'P' ? 'N' : 'P'), replAt(src, m, (m[1] === 'P' ? 'N' : 'P') + '(')));
    occurrences(src, /\bP\(([^)]+)\)/g).slice(0, 2).forEach(m => add('Flanke P weg', replAt(src, m, m[1])));
  } else {
    occurrences(src, /\bTRUE\b/g).slice(0, 3).forEach(m => add('TRUE → FALSE', replAt(src, m, 'FALSE')));
    occurrences(src, /:=\s*(?=[^;]*;)/g).slice(0, 4).forEach(m => add('Zuweisung negiert', replAt(src, m, ':= NOT ')));
    occurrences(src, /\bR_TRIG\b/g).slice(0, 1).forEach(m => add('R_TRIG → F_TRIG', replAt(src, m, 'F_TRIG')));
  }
  return out;
}

/* ---------- Alternativen (müssen bestehen) ---------- */
function kopAlternatives(src, K){
  const out = [];
  let prog; try{ prog = K.parse(src); }catch(e){ return out; }
  const plain = e => !e || e.t === 'c' && !e.edge || e.t === 'cmp' || ((e.t === 's' || e.t === 'p' || e.t === 'x') && e.items.every(plain));
  const clone = x => JSON.parse(JSON.stringify(x));
  // 1) Operanden in UND/ODER ohne Boxen vertauschen
  const p1 = clone(prog); let changed = false;
  const rev = e => { if(!e) return; if((e.t === 's' || e.t === 'p') && e.items.length > 1 && e.items.every(plain)){ e.items.reverse(); changed = true; } (e.items || []).forEach(rev); };
  p1.networks.forEach(n => rev(n.expr));
  if(changed) out.push({ d: 'Operanden vertauscht', src: K.serialize(p1) });
  // 2) SR(Q, R) → zwei Netzwerke mit S- und R-Spule (Rücksetzen danach = dominant); RS → umgekehrt
  const p2 = clone(prog), nets = []; let did = false;
  p2.networks.forEach(n => {
    const sr = (n.outs || []).find(o => o.t === 'op' && (o.k === 'SR' || o.k === 'RS'));
    if(!sr || n.outs.length !== 1 || !/^[A-Za-z_]\w*$/.test(sr.args[1] || '')){ nets.push(n); return; }
    did = true;
    const s = { title: n.title + ' S', expr: n.expr, outs: [{ t: 'coil', mode: 'S', v: sr.args[0] }] };
    const r = { title: n.title + ' R', expr: { t: 's', items: [{ t: 'c', v: sr.args[1] }] }, outs: [{ t: 'coil', mode: 'R', v: sr.args[0] }] };
    if(sr.k === 'SR') nets.push(s, r); else nets.push(r, s);
  });
  if(did){ p2.networks = nets; out.push({ d: 'SR/RS als S- und R-Spule', src: K.serialize(p2) }); }
  // 3) Zwei unabhängige Netzwerke vertauschen (keines liest, was das andere schreibt) – Reihenfolge darf egal sein
  return out;
}
function sclAlternatives(src, t){
  const out = [];
  // Bool-Zuweisung X := Ausdruck; → IF Ausdruck THEN X := TRUE; ELSE X := FALSE; END_IF;
  const bools = new Set(Object.keys(t.initialVars || {}).filter(k => typeof t.initialVars[k] === 'boolean').map(k => k.toLowerCase()));
  let n = 0;
  const s = src.replace(/^(\s*)([A-Za-z_]\w*)\s*:=\s*([^;]+);[ \t]*$/gm, (m, ind, v, e) => {
    if(!bools.has(v.toLowerCase()) || /^(TRUE|FALSE)$/i.test(e.trim()) || n > 3) return m;
    n++; return ind + 'IF ' + e.trim() + ' THEN\n' + ind + '  ' + v + ' := TRUE;\n' + ind + 'ELSE\n' + ind + '  ' + v + ' := FALSE;\n' + ind + 'END_IF;';
  });
  if(n) out.push({ d: 'Zuweisung als IF/ELSE', src: s });
  return out;
}

function awlAlternatives(src){
  // zwei aufeinanderfolgende UND-Abfragen vertauschen (U A / U B → U B / U A)
  const L = src.split('\n'), out = [];
  for(let i = 0; i + 1 < L.length; i++){
    if(/^\s*UN?\s+["#A-Za-z_][\w."]*\s*(\/\/.*)?$/.test(L[i]) && /^\s*UN?\s+["#A-Za-z_][\w."]*\s*(\/\/.*)?$/.test(L[i + 1])){
      const M = L.slice(); [M[i], M[i + 1]] = [M[i + 1], M[i]]; out.push({ d: 'UND-Abfragen vertauscht (Zeile ' + (i + 1) + ')', src: M.join('\n') }); break;
    }
  }
  return out;
}
/* ---------- Prüfen ---------- */
function runGrund(E, t, code){
  let p; try{ p = E.compileSCL(code, t); }catch(e){ return { compile: false }; }
  const hand = t.timedTestCases ? E.runTimedTests(p, t.initialVars, t.timedTestCases) : E.runSinglePassTests(p, t.initialVars, t.testCases || []);
  const a = t.autoTests || {};
  const auto = t.timedTestCases ? (a.timedTestCases ? E.runTimedTests(p, t.initialVars, a.timedTestCases) : { ok: true }) : (a.testCases ? E.runSinglePassTests(p, t.initialVars, a.testCases) : { ok: true });
  return { compile: true, hand: hand.ok, auto: auto.ok, res: !hand.ok ? hand : auto };
}
function runPro(g, t, codes){
  const PT = g.ProTask, PRO = g.SCLPro;
  let p; try{ p = PT.compile(t, codes); }catch(e){ return { compile: false }; }
  let hand, auto;
  try{ hand = PRO.runAll(p, { unit: t.unit, tests: t.tests, timed: t.timed }); }catch(e){ return { compile: false }; }
  const a = t.autoTests || { unit: [], tests: [], timed: [] };
  try{ auto = PRO.runAll(p, a); }catch(e){ auto = { ok: false }; }
  return { compile: true, hand: hand.ok, auto: auto.ok };
}

function checkQuest(q){
  const g = load(q), X = g.SPSQEquiv, K = g.KOP, SE = g.SCLEngine;
  const lang = q === 'scl' ? 'scl' : q === 'awl' ? 'awl' : 'kop';
  const E = q === 'awl' ? g.AWL.wrapEngine(SE) : q === 'scl' ? SE : K.wrapEngine(SE);
  const rep = { quest: q, tasks: 0, mutants: 0, killedHand: 0, killedAuto: 0, survived: [], altFail: [], altOk: 0 };
  g.SCL_CONTENT.tasks.forEach(t => {
    rep.tasks++;
    if(t.pro){
      t.autoTests = X.autoTestsPro(t, g.SCLPro, c => g.ProTask.compile(t, c));
      const ref = g.ProTask.refCodes(t);
      Object.keys(ref).forEach(b => {
        const src = ref[b];
        let frame = null;
        if(lang === 'kop'){ try{ frame = K.splitBlock(src); }catch(e){} }
        textMutants(frame ? frame.body : src, lang).forEach(m => {
          const codes = Object.assign({}, ref, { [b]: frame ? frame.head + m.src + frame.foot : m.src });
          const r = runPro(g, t, codes); if(!r.compile) return;
          rep.mutants++;
          if(!r.hand) rep.killedHand++; else if(!r.auto) rep.killedAuto++; else rep.survived.push({ id: t.id, d: b + ': ' + m.d, debug: t.isDebug });
        });
      });
      return;
    }
    if(!t.refSolution || t.workshop) return;
    t.autoTests = X.autoTests(t, E);
    textMutants(t.refSolution, lang).forEach(m => {
      const r = runGrund(E, t, m.src); if(!r.compile) return;
      rep.mutants++;
      if(!r.hand) rep.killedHand++; else if(!r.auto) rep.killedAuto++; else rep.survived.push({ id: t.id, d: m.d, debug: t.isDebug });
    });
    const alts = lang === 'kop' ? kopAlternatives(t.refSolution, K) : lang === 'scl' ? sclAlternatives(t.refSolution, t) : awlAlternatives(t.refSolution);
    alts.forEach(a => {
      const r = runGrund(E, t, a.src); if(!r.compile) return;
      if(r.hand && r.auto) rep.altOk++;
      else rep.altFail.push({ id: t.id, d: a.d, where: !r.hand ? 'Hand-Tests' : 'erzeugte Tests', ce: X.counterexample(r.res) });
    });
  });
  return rep;
}

const reps = quests.map(checkQuest);
reps.forEach(r => {
  const n = r.mutants, k = r.killedHand + r.killedAuto;
  console.log(r.quest.toUpperCase() + ': ' + r.tasks + ' Aufgaben · Mutanten ' + n + ' · erkannt ' + k + ' (' + Math.round(100 * k / Math.max(1, n)) + ' %; davon nur dank erzeugter Tests ' + r.killedAuto + ') · überlebt ' + r.survived.length +
    ' · Alternativen bestanden ' + r.altOk + ', durchgefallen ' + r.altFail.length);
});
if(MD){
  let md = '# Bericht „Funktion zählt“ (V1) – erzeugt mit `node check_funktion.js --md`\n\nStand: ' + new Date().toISOString().slice(0, 10) + '. Mutanten = kleine Fehler an der Musterlösung, die durchfallen müssen. Alternativen = andere richtige Wege, die bestehen müssen.\n\n';
  md += '| Quest | Aufgaben | Mutanten | erkannt | nur dank erzeugter Tests | überlebt | Alternativen ok | Alternativen durchgefallen |\n|---|---|---|---|---|---|---|---|\n';
  reps.forEach(r => { const k = r.killedHand + r.killedAuto; md += '| ' + r.quest.toUpperCase() + ' | ' + r.tasks + ' | ' + r.mutants + ' | ' + k + ' (' + Math.round(100 * k / Math.max(1, r.mutants)) + ' %) | ' + r.killedAuto + ' | ' + r.survived.length + ' | ' + r.altOk + ' | ' + r.altFail.length + ' |\n'; });
  reps.forEach(r => {
    md += '\n## ' + r.quest.toUpperCase() + '\n\n### Alternativen durchgefallen (Prüfung zu streng?)\n\n' + (r.altFail.length ? r.altFail.map(a => '- `' + a.id + '` – ' + a.d + ' – ' + a.where + ': ' + a.ce).join('\n') : '– keine –') + '\n';
    const by = {}; r.survived.forEach(s => { (by[s.id] = by[s.id] || []).push(s.d); });
    md += '\n### Überlebende Mutanten (Tests zu schwach oder Mutant gleichwertig)\n\n' + (Object.keys(by).length ? Object.keys(by).map(id => '- `' + id + '`: ' + by[id].join(' · ')).join('\n') : '– keine –') + '\n';
  });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'FUNKTION_BERICHT.md'), md);
  console.log('Bericht: docs/FUNKTION_BERICHT.md');
}
module.exports = { textMutants, kopAlternatives, sclAlternatives, awlAlternatives };
