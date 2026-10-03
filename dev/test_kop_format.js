// Textformat KOP/FUP (kop.js): neue Formen (V4 „Editor ohne Grenzen“) und Abwärtskompatibilität.
// node test_kop_format.js            → Parser, Übersetzung, Ausführung jeder Form + Vergleich aller Inhaltstexte mit der Grundlinie
// node test_kop_format.js --baseline → Grundlinie neu schreiben (nur mit der alten, unveränderten kop.js sinnvoll!)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CORPUS = require('./kop_corpus.js');
const BASE = path.join(__dirname, 'tests/baseline/kop_format.json');
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
let fails = 0, passed = 0;
const ok = (c, name, info) => { if(c) passed++; else { fails++; console.log('✗ ' + name + (info !== undefined ? '\n   ' + String(info).replace(/\n/g, '\n   ') : '')); } };

/* ---------- Abwärtskompatibilität: alle Inhaltstexte übersetzen wie vorher ---------- */
if(process.argv.includes('--baseline')){
  const kopPath = (process.argv.find(a => a.startsWith('--kop=')) || '').slice(6) || undefined;
  const out = {};
  ['kop', 'fup'].forEach(q => { const r = CORPUS.corpus(q, kopPath); r.items.forEach(it => { out[h(it.kind + '\u0000' + it.src)] = h(CORPUS.fingerprint(r.g.KOP, it)); }); });
  fs.writeFileSync(BASE, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n');
  console.log('Grundlinie geschrieben: ' + Object.keys(out).length + ' Texte');
  process.exit(0);
}
{
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  let same = 0, unknown = 0;
  ['kop', 'fup'].forEach(q => {
    const r = CORPUS.corpus(q);
    r.items.forEach(it => {
      const k = h(it.kind + '\u0000' + it.src);
      if(!(k in base)){ unknown++; return; }
      const f = CORPUS.fingerprint(r.g.KOP, it);
      if(h(f) === base[k]) same++;
      else ok(false, 'Abwärtskompatibilität ' + q + ' ' + it.where, it.src + '\n→ ' + f.slice(0, 400));
    });
  });
  passed += same;
  console.log('Abwärtskompatibilität: ' + same + ' Inhaltstexte gleich übersetzt' + (unknown ? ' (' + unknown + ' neue Texte ohne Grundlinie)' : ''));
}

/* ---------- Neue Formen: Parser, Text, Übersetzung, Ausführung ---------- */
global.window = global;
const SE = require('./src/engine.js');
require('./src/engine_pro.js');
const K = require('./src/kop.js');
const KE = K.wrapEngine(SE), KP = K.wrapPro(global.SCLPro);
const V = { A:false, B:false, C:false, D:false, Q:false, Q2:false, Q3:false, Rst:false, Lauf:false, Imp:false, W:0, Z_Wert:0 };
const task = (vars, fb) => ({ lang:'kop', initialVars: Object.assign({}, V, vars || {}), fbTypes: fb || {} });
function sim(name, src, steps, vars){   // steps: [[dt, inputs, expect], …] in einem Durchlauf
  let prog;
  try{ prog = KE.compileSCL(src, task(vars)); }catch(e){ ok(false, name + ': übersetzt nicht', e.message + '\n' + src); return; }
  const r = SE.runTimedTests(prog, task(vars).initialVars, [{ setup:{}, steps: steps.map(s => ({ dt:s[0], inputs:s[1], expect:s[2] })) }]);
  const st = r.report[0].steps, bad = st.length && st[st.length - 1].checks.filter(c => !c.pass);
  ok(r.ok, name, r.ok ? '' : 'Schritt ' + st.length + ': ' + JSON.stringify(bad) + '\n' + prog.kopSCL);
  return prog;
}
function truthOf(name, src, ins, fn){   // alle Kombinationen, je ein Zyklus
  const steps = [];
  for(let m = 0; m < (1 << ins.length); m++){ const env = {}; ins.forEach((n, i) => { env[n] = !!(m & (1 << i)); }); steps.push([0.1, env, fn(env)]); }
  sim(name, src, steps);
}
const fails0 = fails;
const rt = (name, src, expectText) => {   // Text stabil: parse → serialize → parse → serialize
  let a;
  try{ a = K.serialize(K.parse(src)); }catch(e){ ok(false, name + ': parse', e.message); return; }
  ok(K.serialize(K.parse(a)) === a, name + ': Text stabil', a);
  if(expectText !== undefined) ok(a === expectText, name + ': Text', a + '\nerwartet:\n' + expectText);
};
const errOf = (src, vars) => { try{ KE.compileSCL(src, task(vars)); return ''; }catch(e){ return e.message; } };

// 1. Mehrere Strompfade (Ketten) je Netzwerk: Reihenfolge = Ausführung, im selben Zyklus sichtbar
{
  const src = 'NETWORK Zwei Ketten\nA AND B => Q;\nQ OR C => Q2;\n=> MOVE(7, W);';
  rt('Ketten', src, 'NETWORK Zwei Ketten\nA AND B => Q;\nQ OR C => Q2;\n=> MOVE(7, W);\n');
  truthOf('Ketten Ausführung', src, ['A', 'B', 'C'], e => ({ Q: e.A && e.B, Q2: (e.A && e.B) || e.C, W: 7 }));
  const p = K.parse(src);
  ok(p.networks.length === 1 && K.rungsOf(p.networks[0]).length === 3, 'Ketten: ein Netzwerk, drei Strompfade');
  ok(K.isExtended(p), 'Ketten: isExtended');
  const tr = K.toSCL(src);
  ok(tr.lineMap.filter(l => l === 3).length > 0 && tr.lineMap.filter(l => l === 4).length > 0, 'Ketten: Zeilen je Strompfad', JSON.stringify(tr.lineMap));
  const c = K.constructs(p); ok(c.has('RUNGS') && c.has('NETWORKS') && c.has('MOVE') && c.has('PARALLEL'), 'Ketten: constructs', [...c]);
  ok(K.elementCount(src) === 7, 'Ketten: elementCount', K.elementCount(src));
  try{ KE.compileSCL('NETWORK X\nA => Q;\n? => ?;', task()); ok(false, 'Ketten: offene Stelle'); }catch(e){ ok(/keine Variable/.test(e.message) && e.line === 3, 'Ketten: offene Stelle in Kette 2 auf deren Zeile', e.line + ' ' + e.message); }
  // Fehler in Kette 2 wird auf deren Zeile gemeldet
  try{ KE.compileSCL('NETWORK X\nA => Q;\nB => W;', task()); ok(false, 'Ketten: Typfehler erwartet'); }catch(e){ ok(e.line === 3 && /Netzwerk 1/.test(e.message), 'Ketten: Fehlerzeile Kette 2', e.line + ' ' + e.message); }
}
// 2. Verknüpfungen an Wert-/Rücksetz-Eingängen
{
  const sr = 'NETWORK SR\nA => SR(Q, B OR C);';
  rt('SR Ausdruck', sr, 'NETWORK SR\nA => SR(Q, (B OR C));\n');
  rt('SR R1:=', 'NETWORK SR\nA => SR(Q, R1:=(B OR C));', 'NETWORK SR\nA => SR(Q, (B OR C));\n');
  rt('RS R:=NOT', 'NETWORK RS\nA => RS(Q, R:=NOT B);', 'NETWORK RS\nA => RS(Q, NOT B);\n');
  ok(/an Stelle 2 steht der Anschluss R1, nicht R\b/.test(errOf('NETWORK SR\nA => SR(Q, R:=B);')), 'SR falscher Anschlussname', errOf('NETWORK SR\nA => SR(Q, R:=B);'));
  sim('SR Ausdruck setzt/rücksetzt (Rücksetzen dominant)', sr, [
    [0.1, { A:true }, { Q:true }], [0.1, { A:false }, { Q:true }], [0.1, { C:true }, { Q:false }],
    [0.1, { C:false, A:true }, { Q:true }], [0.1, { B:true }, { Q:false }], [0.1, { A:false, B:false }, { Q:false }]]);
  sim('RS mit NOT am R', 'NETWORK RS\nA => RS(Q, NOT B);', [[0.1, { B:true }, { Q:false }], [0.1, { A:true }, { Q:true }], [0.1, { A:false }, { Q:true }], [0.1, { B:false }, { Q:false }]]);
  const c = K.constructs(K.parse(sr)); ok(c.has('SR') && c.has('PARALLEL') && !c.has('SET'), 'SR bleibt SR', [...c]);
  // Zähler mit Verknüpfung am Rücksetzen, Box als Kontaktplan-Box (CU = Strom davor)
  const ctu = 'NETWORK Zaehlen\nP(Imp) AND CTU(Z1, PV:=2, R:=(Rst AND NOT Lauf)) => Q;';
  rt('CTU R Ausdruck', ctu, 'NETWORK Zaehlen\nP(Imp) AND CTU(Z1, PV:=2, R:=(Rst AND NOT Lauf)) => Q;\n');
  sim('CTU R:=(Rst AND NOT Lauf)', ctu, [
    [0.1, { Imp:true }, { Q:false }], [0.1, { Imp:false }, {}], [0.1, { Imp:true }, { Q:true }], [0.1, { Imp:false }, { Q:true }],
    [0.1, { Rst:true, Lauf:true }, { Q:true }], [0.1, { Lauf:false }, { Q:false }], [0.1, { Rst:false }, { Q:false }]]);
  // Aufruf-/MOVE-Eingang mit Verknüpfung (Bool nach Bool)
  sim('MOVE IN Verknüpfung', 'NETWORK M\n=> MOVE(A AND NOT B, Q);', [[0.1, { A:true }, { Q:true }], [0.1, { B:true }, { Q:false }]]);
  // Timer-Eingang PT als Operand bleibt Operand
  ok(K.parse('NETWORK T\nA AND TON(T1, T#2S) => Q;').networks[0].expr.items[1].p.PT === 'T#2S', 'PT bleibt Operand');
}
// 3. Funktionale Boxen mit eigenem Eingang
{
  const two = 'NETWORK Zwei Timer\nTON(T1, T#1S, IN:=A) AND TON(T2, T#2S, IN:=B) => Q;';
  rt('zwei Timer', two, two + '\n');
  rt('IN zuerst', 'NETWORK X\nTON(T1, IN:=(A AND B), PT:=T#1S) => Q;', 'NETWORK X\nTON(T1, T#1S, IN:=(A AND B)) => Q;\n');
  sim('zwei Timer an einer &-Box', two, [
    [0.1, { A:true, B:true }, { Q:false }], [1.0, {}, { Q:false }], [1.0, {}, { Q:true }], [0.1, { A:false }, { Q:false }], [0.1, { A:true }, { Q:false }], [1.0, {}, { Q:true }]]);
  // Box in einer Reihe: Strom davor ist NICHT der Eingang
  sim('C AND TON(IN:=A)', 'NETWORK X\nC AND TON(T1, T#1S, IN:=A) => Q;', [
    [0.1, { A:true }, { Q:false }], [1.0, {}, { Q:false }], [0.1, { C:true }, { Q:true }], [0.1, { C:false }, { Q:false }]]);
  sim('NOT TON(IN:=…)', 'NETWORK X\nNOT TON(T1, T#1S, IN:=(A AND B)) => Q;', [
    [0.1, {}, { Q:true }], [0.1, { A:true, B:true }, { Q:true }], [1.0, {}, { Q:false }], [0.1, { B:false }, { Q:true }]]);
  sim('NOT hinter Kontaktplan-Box', 'NETWORK X\nA AND NOT TON(T1, T#1S) => Q;', [
    [0.1, {}, { Q:true }], [0.1, { A:true }, { Q:true }], [1.0, {}, { Q:false }], [0.1, { A:false }, { Q:true }]]);
  sim('CTU mit CU:=, CTD mit IN:=', 'NETWORK X\nCTU(Z1, PV:=2, CU:=P(A), R:=Rst) OR CTD(Z2, PV:=1, IN:=P(B), LD:=Rst) => Q;', [
    [0.1, { Rst:true }, { Q:false }], [0.1, { Rst:false }, { Q:false }], [0.1, { A:true }, { Q:false }], [0.1, { A:false }, {}], [0.1, { A:true }, { Q:true }],
    [0.1, { Rst:true }, { Q:false }], [0.1, { Rst:false, B:true }, { Q:true }]]);
  rt('CTU IN → CU', 'NETWORK X\nCTU(Z1, PV:=2, IN:=A) => Q;', 'NETWORK X\nCTU(Z1, PV:=2, CU:=A) => Q;\n');
  ok(/doppelt/.test(errOf('NETWORK X\nTON(T1, T#1S, IN:=A, IN:=B) => Q;')), 'IN doppelt');
  const c = K.constructs(K.parse(two)); ok(c.has('TON') && c.has('SERIES'), 'zwei Timer constructs', [...c]);
}
// 4. Negation beliebiger Teilausdrücke, Flanke einer Verknüpfung
{
  rt('NOT Klammer', 'NETWORK N\nNOT (A AND B) OR C => Q;', 'NETWORK N\nNOT (A AND B) OR C => Q;\n');
  rt('NOT einzeln wird Öffner', 'NETWORK N\nNOT (A) => Q;', 'NETWORK N\nNOT A => Q;\n');
  rt('NOT NOT', 'NETWORK N\nNOT NOT (A OR B) => Q;', 'NETWORK N\nA OR B => Q;\n');
  rt('NOT Vergleich', 'NETWORK N\nNOT [W > 5] => Q;');
  rt('NOT Flanke', 'NETWORK N\nA AND NOT P(B) => Q;');
  truthOf('NOT (A AND B) OR C', 'NETWORK N\nNOT (A AND B) OR C => Q;', ['A', 'B', 'C'], e => ({ Q: !(e.A && e.B) || e.C }));
  truthOf('A AND NOT (B OR C)', 'NETWORK N\nA AND NOT (B OR C) => Q;', ['A', 'B', 'C'], e => ({ Q: e.A && !(e.B || e.C) }));
  truthOf('NOT (A XOR B) AND NOT (C)', 'NETWORK N\nNOT (A XOR B) AND NOT (C) => Q;', ['A', 'B', 'C'], e => ({ Q: e.A === e.B && !e.C }));
  sim('NOT [W > 5]', 'NETWORK N\nNOT [W > 5] => Q;', [[0.1, { W:3 }, { Q:true }], [0.1, { W:7 }, { Q:false }]]);
  sim('P(A AND B)', 'NETWORK N\nP(A AND B) => Q;', [[0.1, { A:true }, { Q:false }], [0.1, { B:true }, { Q:true }], [0.1, {}, { Q:false }], [0.1, { A:false }, { Q:false }], [0.1, { A:true }, { Q:true }]]);
  sim('C AND NOT P(A)', 'NETWORK N\nC AND NOT P(A) => Q;', [[0.1, { C:true }, { Q:true }], [0.1, { A:true }, { Q:false }], [0.1, {}, { Q:true }]]);
  rt('P Ausdruck Text', 'NETWORK N\nP(A OR B) => Q;', 'NETWORK N\nP(A OR B) => Q;\n');
  const c = K.constructs(K.parse('NETWORK N\nNOT (A AND B) => Q;\nN(A OR B) => Q2;')); ok(c.has('NOT') && c.has('NC') && c.has('EDGE_N'), 'NOT/Flanke constructs', [...c]);
}
// 5. Drähte: Abzweig ohne Verdoppeln
{
  const w = 'NETWORK Abzweig\nA AND B => $UND;\n$UND AND C => Q;\n$UND OR D => Q2, NOT Q3;';
  rt('Draht', w, w + '\n');
  truthOf('Draht Ausführung', w, ['A', 'B', 'C', 'D'], e => ({ Q: e.A && e.B && e.C, Q2: (e.A && e.B) || e.D, Q3: !((e.A && e.B) || e.D) }));
  const tr = K.toSCL(w);
  ok(/_w1_UND := _f1_\d+;/.test(tr.scl) && '_w1_UND' in tr.vars, 'Draht → _w1_UND', tr.scl);
  ok((tr.scl.match(/\bA\b/g) || []).length === 1, 'Draht: Logik davor nur einmal', tr.scl);
  sim('Draht an SR-R1 und Timer-IN', 'NETWORK X\nRst OR NOT Lauf => $Aus;\nA => SR(Q, $Aus);\nTON(T1, T#1S, IN:=$Aus) => Q2;', [
    [0.1, { Lauf:true, A:true }, { Q:true, Q2:false }], [0.1, { A:false }, { Q:true }], [0.1, { Rst:true }, { Q:false, Q2:false }], [1.0, {}, { Q2:true }]]);
  sim('Draht mit Flanke und Vergleich', 'NETWORK X\n[W >= 5] => $Hoch;\nP($Hoch) => Q;\nNOT $Hoch => Q2;', [[0.1, { W:6 }, { Q:true, Q2:false }], [0.1, {}, { Q:false }], [0.1, { W:1 }, { Q2:true }]]);
  const c = K.constructs(K.parse(w)); ok(c.has('WIRE') && !c.has('SET'), 'Draht constructs', [...c]);
  // Fehler
  const e1 = errOf('NETWORK X\n$x AND A => Q;\nB => $x;'); ok(/Draht \$x ist hier noch nicht belegt/.test(e1), 'Draht vor dem Belegen', e1);
  const e2 = errOf('NETWORK X\nA => $x;\nB => $x;'); ok(/schon belegt/.test(e2), 'Draht doppelt', e2);
  const e3 = errOf('NETWORK X\nA => $x;\nNETWORK Y\n$x => Q;'); ok(/Netzwerk 2: .*noch nicht belegt.*selben Netzwerk/.test(e3), 'Draht in anderem Netzwerk', e3);
  const e4 = errOf('NETWORK X\nA => S $x;'); ok(/einfachen Zuweisung/.test(e4), 'Draht mit S', e4);
  const e5 = errOf('NETWORK X\nA => MOVE(B, $x);'); ok(/einfachen Zuweisung/.test(e5), 'Draht als MOVE-Ziel', e5);
  const e6 = errOf('NETWORK X\nA AND TON($t, T#1S) => Q;'); ok(/Instanz/.test(e6), 'Draht als Instanz', e6);
  // Draht in der Online-Ansicht unsichtbar: Name beginnt mit _w
  ok(Object.keys(tr.vars).every(v => /^_[fw]\d+_/.test(v)), 'Hilfsvariablen _f/_w');
}
// 6. Fehlermeldungen deutsch, FUP-Begriffe
{
  const m = errOf('NETWORK X\nA => SR(Q, (B OR));'); ok(/Netzwerk 1:/.test(m), 'Fehler in Klammer', m);
  ok(/NOT fehlt/.test(errOf('NETWORK X\nA AND NOT => Q;')) || /Unerwartet/.test(errOf('NETWORK X\nA AND NOT => Q;')), 'NOT ohne Operand', errOf('NETWORK X\nA AND NOT => Q;'));
  ok(/braucht einen Operanden/.test(errOf('NETWORK X\nP() => Q;')), 'P() leer');
  const prev = global.QUEST; global.QUEST = { lang:'fup' };
  ok(/Zuweisung/.test(K.words('Netzwerk 1 hat keine Spule.')), 'words FUP');
  global.QUEST = prev;
  const tt = errOf('NETWORK X\nA => $w;\n$w => W;'); ok(/Draht \$w|Stromfluss|Typ/.test(tt) && !/_w1_/.test(tt), 'Typfehler mit Draht lesbar', tt);
}
// 7. Profi-Bausteine (#lokal) mit allen neuen Formen
{
  const fb = 'FUNCTION_BLOCK "FB_Neu"\nVAR_INPUT\n  A : Bool;\n  B : Bool;\n  Rst : Bool;\nEND_VAR\nVAR_OUTPUT\n  Q : Bool;\n  Q2 : Bool;\n  Q3 : Bool;\nEND_VAR\nVAR\n  T1 : TON;\n  T2 : TON;\n  Z1 : CTU;\nEND_VAR\nBEGIN\n' +
    'NETWORK Alles\n#A AND #B => $ab;\nTON(#T1, T#1S, IN:=$ab) AND NOT TON(#T2, T#2S, IN:=#A) => #Q;\n$ab => SR(#Q2, R1:=(#Rst OR NOT #A));\n' +
    'NETWORK Zaehler\nP(#A AND #B) AND CTU(#Z1, PV:=2, R:=(#Rst AND NOT #B)) => #Q3;\nEND_FUNCTION_BLOCK';
  let p;
  try{ p = KP.compileProject({ sources:[{ block:'FB_Neu', src: fb }], globals:{}, globalTypes:{}, instances:{} }); }catch(e){ ok(false, 'Profi: übersetzt', e.message + ' Z' + e.line); }
  if(p){
    ok(!p.warnings.length, 'Profi: keine Warnungen', JSON.stringify(p.warnings));
    const r = KP.runUnitTests(p, [{ block:'FB_Neu', setup:{}, steps: [
      [0.1, { A:true, B:true }, { Q:false, Q2:true, Q3:false }], [1.0, {}, { Q:true }], [1.0, {}, { Q:false }], [0.1, { A:false }, { Q2:false }],
      [0.1, { A:true }, { Q3:true }], [0.1, { Rst:true }, { Q2:false, Q3:true }], [0.1, { B:false }, { Q3:false }]].map(s => ({ dt:s[0], inputs:s[1], expect:s[2] })) }]);
    const st = r.report[0].steps;
    ok(r.ok, 'Profi: Ablauf', r.ok ? '' : (r.report[0].error ? r.report[0].error.message : 'Schritt ' + st.length + ' ' + JSON.stringify(st[st.length - 1].checks.filter(c => !c.pass))));
    const used = KP.constructsUsed(p, ['FB_Neu']);
    ok(used.has('SR') && used.has('TON') && used.has('CTU') && used.has('WIRE') && !used.has('TEMP'), 'Profi: constructsUsed', [...used]);
  }
  const ps = K.proSource(fb);
  ok(/VAR_TEMP .*_w1_ab : Bool;/.test(ps.src) && ps.src.split('\n').length === fb.split('\n').length, 'Profi: Draht als VAR_TEMP, Zeilen gleich');
  const fc = 'FUNCTION "FC_X" : Void\nVAR_INPUT\n  A : Bool;\n  B : Bool;\nEND_VAR\nBEGIN\nNETWORK N\nA => Q;\nP(#A AND #B) => #Q;\nEND_FUNCTION';
  try{ K.proSource(fc); ok(false, 'Profi: Flanke in FC muss scheitern'); }catch(e){ ok(/Flanke/.test(e.message) && e.line === 9, 'Profi: Flanke in FC (Zeile der Kette)', e.line + ' ' + e.message); }
  const ifc = KP.readInterface(fb); ok(ifc && ifc.rows.some(r => r.name === 'T2'), 'Profi: readInterface');
}
// 8. Alte Formen unverändert (Stichproben, ganze Inhalte siehe oben)
{
  const old = ['NETWORK A\n(Start OR Motor) AND NOT Stopp => Motor;\n', 'NETWORK A\nA AND TON(T1, T#3S) => Q;\n', 'NETWORK A\nP(A) AND CTU(Z1, PV:=5, R:=Rst) => Q, S Q2;\n', 'NETWORK A\n=> MOVE(5, W);\n', 'NETWORK A\nA => SR(Q, Rst);\n', 'NETWORK A\nA XOR B OR C => Q;\n'];
  old.forEach(s => { rt('alt ' + s.split('\n')[1], s, s); ok(!K.isExtended(K.parse(s)), 'alt nicht erweitert: ' + s.split('\n')[1]); });
  ok(K.toSCL(old[1]).scl === '// Netzwerk 1: A\n_f1_1 := A;\nT1(IN := _f1_1, PT := T#3S);\n_f1_2 := T1.Q;\nQ := _f1_2;', 'alte Box-Übersetzung', K.toSCL(old[1]).scl);
}
console.log('Neue Formen: ' + (fails === fails0 ? 'alle bestanden' : (fails - fails0) + ' Fehler'));

console.log(fails ? '\n' + fails + ' FEHLER (' + passed + ' ok)' : '\nALLE TEXTFORMAT-TESTS BESTANDEN (' + passed + ')');
process.exit(fails ? 1 : 0);
