// Nachprüfung im Worker (Plan B.6): node test_pikett_worker.js
// Lädt worker/pikett.js mit den erzeugten Daten (worker/gen/pikett_data.js) und prüft je Störung:
// Programm – Referenz besteht, Fehlerversion scheitert; dazu CPU-Zeit je Prüfung (Workers Free: 10 ms pro Anfrage).
const path = require('path');
(async () => {
  let t0 = performance.now();
  const W = await import(path.join(__dirname, '..', 'worker', 'pikett.js'));
  const { PIKETT_DATA } = await import(path.join(__dirname, '..', 'worker', 'gen', 'pikett_data.js'));
  const { ProTask } = await import(path.join(__dirname, '..', 'worker', 'gen', 'exam_bundle.js'));
  console.log('Import: ' + (performance.now() - t0).toFixed(1) + ' ms');
  let fails = 0, n = 0; const times = [];
  for(const q of Object.keys(PIKETT_DATA)){
    const D = PIKETT_DATA[q];
    for(const inc of D.incidents.filter(x => x.kind === 'program')){
      const t = D.tasks[inc.base], b = D.bugs[inc.bug]; n++;
      const ref = t.pro ? ProTask.refCodes(t) : t.refSolution;
      const bug = globalThis.bugCode(t, b);
      W.check(q, inc, ref);                       // warm
      let a = performance.now(); const r1 = W.check(q, inc, ref); times.push([performance.now() - a, q + ':' + inc.id]);
      const r2 = W.check(q, inc, bug);
      if(!r1.ok){ fails++; console.log('✗ ' + q + ':' + inc.id + ' Referenz besteht nicht' + (r1.error ? ': ' + r1.error.message : '')); }
      if(r2.ok){ fails++; console.log('✗ ' + q + ':' + inc.id + ' Fehlerversion besteht'); }
    }
  }
  times.sort((a, b) => b[0] - a[0]);
  console.log('langsamste: ' + times.slice(0, 6).map(x => x[1] + ' ' + x[0].toFixed(1)).join(', '));
  console.log('Prüfung warm: max ' + times[0][0].toFixed(2) + ' ms (' + times[0][1] + '), Median ' + times[Math.floor(times.length / 2)][0].toFixed(2) + ' ms');
  console.log('Pikett-Worker: ' + n + ' Programmstörungen, ' + fails + ' Fehler');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
