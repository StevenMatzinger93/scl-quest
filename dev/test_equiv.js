// Funktionsvergleich (Auftrag „Funktion zählt“, V0): node test_equiv.js
// Erzeugte Testfälle aus der Musterlösung: verschiedene richtige Wege bestehen, halb richtige fallen durch.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; } else { fail++; console.log('✗ ' + m); } };
const g = { console }; g.window = g; g.globalThis = g; vm.createContext(g);
['engine.js', 'engine_pro.js', 'kop.js', 'awl.js', 'equiv.js', 'content/_helpers.js'].forEach(f => vm.runInContext(fs.readFileSync(__dirname + '/src/' + f, 'utf8'), g, { filename: f }));
const SE = g.SCLEngine, KE = g.KOP.wrapEngine(SE), AE = g.AWL.wrapEngine(SE), X = g.SPSQEquiv;
function judge(t, E, code){
  const all = X.allCases(t), p = E.compileSCL(code, t);
  const r = all.timedTestCases ? E.runTimedTests(p, t.initialVars, all.timedTestCases) : E.runSinglePassTests(p, t.initialVars, all.testCases);
  return r;
}
// 1) Steven: Ausgang = alle 3 Bedingungen. Hand-Test absichtlich schwach (nur „alles an“).
const fup = { id: 'x_und3', lang: 'kop', initialVars: { A: false, B: false, C: false, Q: false }, testCases: [{ setup: { A: true, B: true, C: true }, expect: { Q: true } }],
  refSolution: 'NETWORK Freigabe\nA AND B AND C => Q;' };
fup.autoTests = X.autoTests(fup, KE);
ok(fup.autoTests && fup.autoTests.testCases.length === 7, 'alle 8 Kombinationen (7 neu): ' + (fup.autoTests && fup.autoTests.testCases.length));
ok(judge(fup, KE, 'NETWORK Freigabe\nA AND B AND C => Q;').ok, '&-Box mit 3 Eingängen');
ok(judge(fup, KE, 'NETWORK Freigabe\n(A AND B) AND C => Q;').ok, 'zwei &-Boxen hintereinander');
const fupM = Object.assign({}, fup, { initialVars: Object.assign({ Hilf_1: false }, fup.initialVars) });   // Hilfsmerker (Plan V2: freie Merker je Aufgabe)
ok(judge(fupM, KE, 'NETWORK Teil 1\nA AND B => Hilf_1;\n\nNETWORK Teil 2\nHilf_1 AND C => Q;').ok, 'Aufteilung auf zwei Netzwerke mit Hilfsmerker');
ok(judge(fup, KE, 'NETWORK Freigabe\nNOT A => R Q;\n\nNETWORK 2\nA AND B AND C => S Q;\n\nNETWORK 3\nNOT B OR NOT C => R Q;').ok, 'Setzen/Rücksetzen statt Zuweisung');
const half = judge(fup, KE, 'NETWORK Freigabe\nA AND B => Q;');
ok(!half.ok, 'halb richtig (nur A UND B) fällt durch – die Hand-Tests allein hätten es durchgelassen');
ok(/C = 0/.test(X.counterexample(half)) && /Q sollte 0 sein, ist aber 1/.test(X.counterexample(half)), 'Gegenbeispiel: ' + X.counterexample(half));
// gleiche Aufgabe in SCL und AWL
const scl = Object.assign({}, fup, { id: 'x_und3s', lang: undefined, refSolution: 'Q := A AND B AND C;' });
scl.autoTests = X.autoTests(scl, SE);
ok(judge(scl, SE, 'IF A THEN\n  IF B AND C THEN Q := TRUE; ELSE Q := FALSE; END_IF;\nELSE\n  Q := FALSE;\nEND_IF;').ok, 'SCL: verschachteltes IF statt Ausdruck');
ok(!judge(scl, SE, 'Q := A OR B AND C;').ok, 'SCL: falscher Ausdruck fällt durch');
const awl = Object.assign({}, fup, { id: 'x_und3a', lang: 'awl', refSolution: 'U A\nU B\nU C\n= Q' });
awl.autoTests = X.autoTests(awl, AE);
ok(judge(awl, AE, 'U(\nU A\nU B\n)\nU C\n= Q').ok, 'AWL: mit Klammer');
ok(!judge(awl, AE, 'U A\nO B\nU C\n= Q').ok, 'AWL: ODER statt UND fällt durch');
// 2) Zahlen: Grenzwert der Musterlösung wird getestet (40 / 41)
const tempo = { id: 'x_tempo', lang: 'kop', initialVars: { Tempo: 0, Warnung: false }, testCases: [{ setup: { Tempo: 80 }, expect: { Warnung: true } }, { setup: { Tempo: 0 }, expect: { Warnung: false } }],
  refSolution: 'NETWORK Zu schnell\n[Tempo > 40] => Warnung;' };
tempo.autoTests = X.autoTests(tempo, KE);
ok(tempo.autoTests.testCases.some(c => c.setup.Tempo === 40) && tempo.autoTests.testCases.some(c => c.setup.Tempo === 41), 'Grenzwerte 40/41 erzeugt');
ok(judge(tempo, KE, 'NETWORK x\n[Tempo >= 41] => Warnung;').ok, '>= 41 statt > 40 (gleiche Funktion bei INT)');
ok(!judge(tempo, KE, 'NETWORK x\n[Tempo >= 40] => Warnung;').ok, '>= 40 fällt durch');
// 3) Zeitverhalten: Selbsthaltung als ODER-Rückführung oder als SR-Box
const sh = { id: 'x_selbst', lang: 'kop', initialVars: { Start: false, Stopp: false, Motor: false },
  timedTestCases: [{ setup: {}, steps: [{ dt: 0, inputs: { Start: true }, expect: { Motor: true } }, { dt: 0.1, inputs: { Start: false }, expect: { Motor: true } }, { dt: 0.1, inputs: { Stopp: true }, expect: { Motor: false } }] }],
  refSolution: 'NETWORK Motor\n(Start OR Motor) AND NOT Stopp => Motor;' };
sh.autoTests = X.autoTests(sh, KE);
ok(sh.autoTests && sh.autoTests.timedTestCases.length >= 4, 'Zufallsabläufe erzeugt');
ok(judge(sh, KE, 'NETWORK Motor\nStart => SR(Motor, Stopp);').ok, 'SR-Box statt Rückführung (Rücksetzen dominant)');
ok(judge(sh, KE, 'NETWORK an\nStart => S Motor;\n\nNETWORK aus\nStopp => R Motor;').ok, 'Setzen/Rücksetzen in zwei Netzwerken');
ok(!judge(sh, KE, 'NETWORK Motor\nStart => RS(Motor, Stopp);').ok, 'RS (Setzen dominant) fällt durch: Start und Stopp zugleich');
// 4) Deterministisch
ok(JSON.stringify(X.autoTests(sh, KE)) === JSON.stringify(sh.autoTests), 'gleiche Aufgabe → gleiche Testfälle');
// 5) Timer: TON 3 s
const ton = { id: 'x_ton', lang: 'kop', initialVars: { Zug: false, Zu: false },
  timedTestCases: [{ setup: {}, steps: [{ dt: 0, inputs: { Zug: true }, expect: { Zu: false } }, { dt: 3.1, inputs: {}, expect: { Zu: true } }] }],
  refSolution: 'NETWORK Schranke\nZug AND TON(T1, T#3S) => Zu;' };
ton.autoTests = X.autoTests(ton, KE);
ok(!judge(ton, KE, 'NETWORK Schranke\nTON(T1, T#3S) AND Zug => Zu;').ok, 'TON vor Zug = Timer ohne Bedingung: andere Funktion, fällt durch');
ok(!judge(ton, KE, 'NETWORK Schranke\nZug AND TON(T1, T#2S) => Zu;').ok, 'TON 2 s statt 3 s fällt durch');
ok(!judge(ton, KE, 'NETWORK Schranke\nZug => Zu;').ok, 'ohne Verzögerung fällt durch (die Hand-Tests hätten es auch erwischt)');
console.log('Funktionsvergleich: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
