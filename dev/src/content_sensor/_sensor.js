/* ===== SENSORWERKSTATT: Presets (Ausgangszustände) und Klemmenplan-Helfer =====
   Klemmenplan (docs/SENSORWERKSTATT_PLAN.md 2.4): -X2:1 S1 · 2 S2 · 3 S3 · 4 S4 · 5 B1 · 6 B2 · 7 B3 · 8 B4.2 · 9 B5 · 10 B6 · 11 B7 · 12 S5 · 13 B8 · 14 B9 · 21…28 SM 1221
   Signalebene -X2:n.S ist zur CPU vorverdrahtet (Plan 3.1 Ebene C, Punkt 6), 1M liegt auf M (PNP). */
(function(root){
const W = root.Wiring;
const X2_OF = { S1: 1, S2: 2, S3: 3, S4: 4, B1: 5, B2: 6, B3: 7, 'B4.2': 8, B5: 9, B6: 10, B7: 11, S5: 12, B8: 13, B9: 14 };
// 3-Leiter-Sensor auf Initiatorenklemme n: BN → L+, BU → M, BK → Signal
const w3 = (p, n) => [[p + ':BN', 'X2:' + n + '.L+'], [p + ':BU', 'X2:' + n + '.M'], [p + ':BK', 'X2:' + n + '.S']];
// Kontakt (Taster, Positionsschalter, Reed) auf Klemme n: erster Pin → L+, zweiter Pin → Signal
const c2 = (p, n) => { const P = W.PARTS[p]; return [[p + ':' + P.pins[0], 'X2:' + n + '.L+'], [p + ':' + P.pins[1], 'X2:' + n + '.S']]; };
const field = p => { const P = W.PARTS[p]; return P.type === 'contact2' ? c2(p, X2_OF[p]) : p === 'B4.1' ? [['B4.1:BN', 'X1:L+3'], ['B4.1:BU', 'X1:M3']] : w3(p, X2_OF[p]); };
// Funktionsanforderungen für Wiring.check (Plan 3.5): Sensor versorgt und Signal am richtigen Eingang
const need3 = p => [{ net: [p + ':BN', 'POT:L+'] }, { net: [p + ':BU', 'POT:M'] }, { net: [p + ':BK', 'DI:' + W.PARTS[p].di] }];
const needC = p => { const P = W.PARTS[p]; return [{ net: [p + ':' + P.pins[0], 'POT:L+'] }, { net: [p + ':' + P.pins[1], 'DI:' + P.di] }]; };
const need = p => W.PARTS[p].type === 'contact2' ? needC(p) : p === 'B4.1' ? [{ net: ['B4.1:BN', 'POT:L+'] }, { net: ['B4.1:BU', 'POT:M'] }] : need3(p);
// Vorverdrahtung im Schrank: Signalebene -X2:1…14 → CPU, -X2:21…28 → SM 1221
const PRE_CPU = Object.keys(W.DI_OF_X2).map(Number).filter(n => n <= 14).map(n => ['X2:' + n + '.S', W.diTerminal(W.DI_OF_X2[n])]);
const PRE_SM = [21, 22, 23, 24, 25, 26, 27, 28].map(n => ['X2:' + n + '.S', W.diTerminal(W.DI_OF_X2[n])]);
root.SW = { X2_OF, w3, c2, field, need3, needC, need, PRE_CPU, PRE_SM };

// Schrank vorverdrahtet, Feld leer: Querbrücker gesteckt, 1M auf M, Signalebenen zur CPU
defPreset('schrank', { wires: PRE_CPU.concat([['A1:1M', 'X1:M2']]), bridges: ['QB_X2_LP', 'QB_X2_M'] });
// wie oben, aber ohne Querbrücker (Modul 1 Boss, Modul 2)
defPreset('schrank_ohne_qb', { wires: PRE_CPU.concat([['A1:1M', 'X1:M2']]) });
// Sortierstrecke fertig verdrahtet und montiert (Programmieraufgaben)
const SORT = ['S1', 'S2', 'S3', 'S4', 'B1', 'B2', 'B3', 'B4.1', 'B4.2', 'B5', 'B6', 'B7', 'S5'];
defPreset('sortier_fertig', { base: 'schrank', wires: [].concat(...SORT.map(field)),
  mounts: { B1: { dist: 4, tight: true }, B2: { dist: 4, tight: true, poti: 0.6 }, B3: { dist: 60, tight: true, teach: 60 }, B6: { dist: 5, tight: true }, B7: { dist: 35, tight: true } } });
// SM 1221 vorbereitet: Signalebenen 21…28 zur SM 1221, 1M/2M auf M
defPreset('sm1221', { base: 'schrank', wires: PRE_SM.concat([['A4:1M', 'X1:M4'], ['A4:2M', 'X1:M5']]) });
})(typeof window !== 'undefined' ? window : globalThis);
