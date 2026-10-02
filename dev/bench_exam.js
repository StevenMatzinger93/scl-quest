// CPU-Messung der Prüfungsbewertung (Spike A2): node bench_exam.js [--alle]  (--alle: jede Parameterkombination, Paket P)
// Lädt das Worker-Bundle (worker/gen/exam_bundle.js) als ES-Modul und misst je Prüfungsaufgabe die Bewertung der Referenz
// kalt (erster Aufruf dieses Aufgabentyps) und warm (Median aus 5 Läufen). Ziel: warm < 5 ms pro Aufgabe (Workers Free: 10 ms CPU).
const path = require('path');
(async () => {
  const t0 = performance.now();
  const { Exam } = await import(path.join(__dirname, '..', 'worker', 'gen', 'exam_bundle.js'));
  console.log('Bundle-Import: ' + (performance.now() - t0).toFixed(1) + ' ms');
  const rows = [];
  const ALL = process.argv.includes('--alle');
  for(const def of Exam.X.tasks) for(const params of (ALL ? Exam.allParams(def, 40) : [Exam.pickParams(def, Exam.rng('bench'))])){
    const it = Exam.instantiate(def, params);
    const ref = it.kind === 'grund' ? it.ref : Object.fromEntries(it.blocks.filter(b => b.edit).map(b => [b.name, b.ref]));
    let a = performance.now(); Exam.gradeFor(it, ref); const cold = performance.now() - a;
    const warm = [];
    for(let i = 0; i < 5; i++){ a = performance.now(); Exam.gradeFor(it, ref); warm.push(performance.now() - a); }
    warm.sort((x, y) => x - y);
    rows.push({ id: def.id + (ALL && Object.keys(params).length ? ' ' + JSON.stringify(params) : ''), cold, warm: warm[2] });
  }
  rows.sort((x, y) => y.warm - x.warm);
  const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  const w = rows.map(r => r.warm).sort((x, y) => x - y);
  console.log('Aufgaben: ' + rows.length + ' · warm Median ' + pct(w, 0.5).toFixed(2) + ' ms · 90 % ' + pct(w, 0.9).toFixed(2) + ' ms · max ' + w[w.length - 1].toFixed(2) + ' ms');
  rows.slice(0, 8).forEach(r => console.log('  ' + r.id.padEnd(ALL ? 46 : 30) + ' warm ' + r.warm.toFixed(2).padStart(6) + ' ms · kalt ' + r.cold.toFixed(2).padStart(6) + ' ms'));
  const over = rows.filter(r => r.warm > 5);
  console.log(over.length ? 'ACHTUNG: ' + over.length + ' Aufgabe(n) über 5 ms warm' : 'OK — alle Aufgaben warm unter 5 ms');
})();
