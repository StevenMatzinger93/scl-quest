// Kernpfad (Paket 4.1): Pflicht vs. Training im Spiel – node tests/core_path.js
const { open } = require('./pw.js');
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
(async () => {
  for(const file of ['index.html', 'kop.html', 'sensor.html']){
    const { browser, page: P, errors } = await open({ file, viewport: { width: 1366, height: 768 } });
    if(file === 'sensor.html') await P.fill('#playerName', 'Kern');
    await P.click('#newGameBtn');
    await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true, sensor: true }; });
    const info = await P.evaluate(() => { const T = SCLQuest.TASKS, by = {}; T.forEach(t => { (by[t.level] = by[t.level] || []).push(t); });
      return { total: T.length, core: T.filter(t => t.core !== false).length, perCh: Object.keys(by).map(k => [by[k].length, by[k].filter(t => t.core !== false).length]), bossCore: Object.keys(by).every(k => by[k][by[k].length - 1].core !== false), firstCore: Object.keys(by).every(k => by[k][0].core !== false) }; });
    ok(info.perCh.every(([n, c]) => c >= 5 && c <= n), file + ': jedes Kapitel hat mind. 5 Pflichtaufgaben');
    ok(info.core < info.total && info.core >= info.perCh.length * 5 && info.core <= info.perCh.length * 6, file + ': Kernpfad ' + info.core + ' von ' + info.total + ' Aufgaben');
    ok(info.bossCore && info.firstCore, file + ': Boss und Einstieg sind Pflicht');
    // Ablauf: nur Pflicht (Grundstufe/Kapitel 1)
    const seq = await P.evaluate(() => {
      const S = SCLQuest.state; S.seenIntro = SCLQuest.TASKS.map(t => t.level).filter((v, i, a) => a.indexOf(v) === i); S.basicCert = true;
      const seen = [];
      for(let i = 0; i < 40; i++){ SCLQuest.goToPos(); const t = SCLQuest.session.task; const it = SCLQuest.SEQ[S.pos]; if(!it) break; if(it.type === 'task'){ seen.push(it.id); S.doneTasks[it.id] = { stars: 3, points: 10 }; } else { S.doneTheory[it.id] = { score: 5, n: 5 }; } S.pos++; }
      return seen; });
    const trainingSeen = await P.evaluate(ids => ids.filter(id => SCLQuest.TASKS.find(t => t.id === id).core === false).length, seq);
    ok(seq.length > 0 && trainingSeen === 0, file + ': der Ablauf überspringt Training');
    // Karte: Training ist wählbar
    await P.evaluate(() => { document.getElementById('app').style.display = ''; document.getElementById('openMapBtn').click(); });
    ok(await P.locator('#mapGrid .map-chip.training').count() > 0, file + ': Karte zeigt Training');
    const trainId = await P.evaluate(() => { const t = SCLQuest.TASKS.find(x => x.core === false && !SCLQuest.state.doneTasks[x.id] && x.level === 1) || SCLQuest.TASKS.find(x => x.core === false && !SCLQuest.state.doneTasks[x.id]); return t.id; });
    await P.click('#mapGrid .map-chip.training[data-id="' + trainId + '"]');
    ok(await P.locator('#mdTrain').count() === 1, file + ': Detail bietet „Training spielen“');
    await P.click('#mdTrain');
    ok(await P.evaluate(id => SCLQuest.session.task && SCLQuest.session.task.id === id && SCLQuest.session.side === true, trainId), file + ': Training-Aufgabe geöffnet');
    // Einstellung „Alle Aufgaben der Reihe nach“
    const full = await P.evaluate(() => { const S = SCLQuest.state; S.settings.fullPath = true; S.pos = 0; SCLQuest.goToPos(); return SCLQuest.SEQ[S.pos].id; });
    ok(!!full, file + ': fullPath schaltbar');
    if(file === 'index.html'){
      // Schnellspur: erste Aufgabe ohne Fehler und Hinweis → nächste gleichartige überspringbar
      const pair = await P.evaluate(() => { const T = SCLQuest.TASKS; for(let i = 0; i < T.length; i++){ const a = T[i]; if(a.core === false || a.pro || a.isBoss || a.isDebug || !a.manualId || SCLQuest.state.doneTasks[a.id]) continue; const nx = T.slice(i + 1).find(x => x.level === a.level && x.core !== false); if(nx && !SCLQuest.state.doneTasks[nx.id] && !nx.isBoss && !nx.isDebug && nx.manualId === a.manualId && (nx.mustUse || []).every(m => (a.mustUse || []).includes(m))) return [a.id, nx.id]; } return null; });
      ok(!!pair, 'Schnellspur: es gibt gleichartige Aufgabenpaare');
      if(pair){
        await P.evaluate(() => { const S = SCLQuest.state; S.settings.fullPath = false; });
        await P.evaluate(id => { document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === id), false); }, pair[0]);
        await P.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
        await P.waitForSelector('#successCard:not([style*="display: none"])', { timeout: 15000 });
        ok(await P.locator('#fastLaneBtn').count() === 1, 'Schnellspur-Knopf nach fehlerfreier Lösung');
        if(await P.locator('#fastLaneBtn').count()) await P.click('#fastLaneBtn');
        ok(await P.evaluate(id => !!(SCLQuest.state.doneTasks[id] && SCLQuest.state.doneTasks[id].skipped), pair[1]), 'Schnellspur: gleichartige Aufgabe übersprungen');
      }
    }
    ok(errors.length === 0, file + ': keine JS-Fehler' + (errors.length ? ' – ' + errors[0] : ''));
    await browser.close();
  }
  console.log('Kernpfad: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})();
