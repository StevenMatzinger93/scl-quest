(function(root){
"use strict";
/* ============================================================
   KERNPFAD (docs/AUFTRAG_FEEDBACK1.md Paket 4.1)
   Pro Kapitel sind etwa 5 Aufgaben Pflicht (core = true), der Rest ist „Training“ (freiwillig, jederzeit spielbar).
   Ohne eigene Angabe (core in der Aufgabe) wird der Kernpfad hier bestimmt: der Kapitel-Boss, dann Aufgaben, die noch nicht abgedeckte
   Konstrukte (must-Codes) einführen, dann gleichmässig verteilt. IDs bleiben alle erhalten (Störungsjagd, Prüfungspool, Spielstände).
   ============================================================ */
const WANT = 5;
function codesOf(t){ return (t.mustUse || []).concat(t.manualId ? ['man:' + t.manualId] : []); }
function markCore(C, want){
  want = want || WANT;
  const byCh = {};
  C.tasks.forEach(t => { (byCh[t.level] = byCh[t.level] || []).push(t); });
  Object.keys(byCh).forEach(k => {
    const list = byCh[k], n = list.length;
    if(list.some(t => t.core !== undefined)){ list.forEach(t => { if(t.core === undefined) t.core = false; }); return; }   // von Hand gesetzt
    const pick = new Set([n - 1, 0]);   // Kapitel-Boss und Einstiegsaufgabe
    const covered = new Set(codesOf(list[n - 1]).concat(codesOf(list[0])));
    while(pick.size < Math.min(want, n)){
      let best = -1, gain = 0;
      list.forEach((t, i) => { if(pick.has(i)) return; const g = codesOf(t).filter(c => !covered.has(c)).length; if(g > gain){ gain = g; best = i; } });
      if(best < 0) break;
      pick.add(best); codesOf(list[best]).forEach(c => covered.add(c));
    }
    for(let j = 0; pick.size < Math.min(want, n) && j < want * 2; j++){   // auffüllen: gleichmässig über die Reihenfolge
      const i = Math.round(j * (n - 1) / (want - 1)); if(!pick.has(i)) pick.add(i);
    }
    for(let i = 0; pick.size < Math.min(want, n); i++) pick.add(i);
    list.forEach((t, i) => { t.core = pick.has(i); });
  });
  return C;
}
root.markCore = markCore;
root.SPSQCore = { markCore, WANT };
if(typeof module !== 'undefined' && module.exports) module.exports = { markCore, WANT };
})(typeof window !== 'undefined' ? window : globalThis);
