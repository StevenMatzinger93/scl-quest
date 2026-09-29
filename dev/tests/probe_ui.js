// Probebetrieb „▶ Anlage testen“ (Paket 4.2) in allen Quests – node tests/probe_ui.js
const { open } = require('./pw.js');
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
(async () => {
  for(const [file, q] of [['index.html', 'SCL'], ['kop.html', 'KOP'], ['fup.html', 'FUP'], ['awl.html', 'AWL']]){
    const { browser, page: P, errors } = await open({ file, viewport: { width: 1366, height: 768 } });
    await P.click('#newGameBtn');
    await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; document.getElementById('levelIntroOverlay').style.display = 'none'; document.getElementById('app').style.display = ''; });
    // Aufgabe mit Bool-Eingang und Bool-Ausgang, einzelner Zyklus
    const id = await P.evaluate(() => { const T = SCLQuest.TASKS.find(t => !t.pro && t.testCases && t.testCases.length && Object.values(t.testCases[0].setup || {}).some(v => typeof v === 'boolean') && Object.values(t.testCases[0].expect || {}).some(v => typeof v === 'boolean')); return T.id; });
    await P.evaluate(i => SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === i), false), id);
    ok(await P.isVisible('#probeBtn'), q + ': Knopf „Anlage testen“ sichtbar');
    // Fehlerfall: leerer Editor → kein Probebetrieb, kein Fehlversuch
    await P.evaluate(() => SCLQuest.editor.setValue('')); await P.click('#probeBtn'); await P.waitForTimeout(200);
    ok(!(await P.isVisible('#probeCard')), q + ': leerer Editor startet nicht');
    // Syntaxfehler: Fehlermeldung, kein Fehlversuch
    const fails0 = await P.evaluate(i => SCLQuest.state.fails[i] || 0, id);
    await P.evaluate(() => SCLQuest.editor.setValue('((( kaputt')); await P.click('#probeBtn'); await P.waitForTimeout(300);
    ok(!(await P.isVisible('#probeCard')) && await P.evaluate(i => (SCLQuest.state.fails[i] || 0), id) === fails0, q + ': Fehler im Code zählt nicht als Fehlversuch');
    // Referenzlösung läuft
    await P.evaluate(() => SCLQuest.editor.setValue(SCLQuest.session.task.refSolution)); await P.click('#probeBtn');
    await P.waitForSelector('#probeCard .probe-sw', { timeout: 5000 });
    ok(await P.textContent('#probeState') === 'RUN', q + ': Probebetrieb läuft (RUN)');
    const c1 = await P.textContent('.probe-cy'); await P.waitForTimeout(600); const c2 = await P.textContent('.probe-cy');
    ok(c1 !== c2, q + ': Zyklen laufen weiter (' + c1 + ' → ' + c2 + ')');
    // Eingang schalten ändert den Schalter und läuft weiter
    const before = await P.getAttribute('.probe-sw', 'aria-checked'); await P.click('.probe-sw'); await P.waitForTimeout(350);
    ok(await P.getAttribute('.probe-sw', 'aria-checked') !== before, q + ': Eingang umschaltbar');
    // Prüfen beendet den Probebetrieb; zählt normal
    await P.click('#probePause'); ok(await P.textContent('#probeState') === 'PAUSE', q + ': Pause');
    await P.click('#probeStep'); await P.click('#probeClose');
    ok(!(await P.isVisible('#probeCard')), q + ': Probebetrieb beenden');
    await P.click('#probeBtn'); await P.waitForSelector('#probeCard .probe-sw'); await P.click('#compileBtn');
    ok(!(await P.isVisible('#probeCard')), q + ': „Prüfen“ beendet den Probebetrieb');
    if(q === 'SCL'){
      // Logik: c2_not — Tür zu = FALSE → Ampel_Rot TRUE
      await P.evaluate(() => SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === 'c2_not'), true));
      await P.evaluate(() => SCLQuest.editor.setValue(SCLQuest.session.task.refSolution)); await P.click('#probeBtn'); await P.waitForSelector('#probeCard .probe-sw');
      const rot = () => P.textContent('[data-pv="Ampel_Rot"]');
      await P.waitForTimeout(250); const r1 = await rot(); const sw = P.locator('.probe-sw'); const t1 = await sw.getAttribute('aria-checked'); await sw.click(); await P.waitForTimeout(350);
      const r2 = await rot(); ok(r1 !== r2 && [r1, r2].sort().join() === 'FALSE,TRUE', 'SCL: Ampel_Rot folgt der Tür (' + t1 + ': ' + r1 + ' → ' + r2 + ')');
      // Profi-Aufgabe
      await P.evaluate(() => SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.pro && t.timed && t.timed.length), true));
      await P.evaluate(() => SCLQuest.setProCodes(ProTask.refCodes(SCLQuest.session.task))); await P.click('#probeBtn');
      await P.waitForSelector('#probeCard .probe-cy', { timeout: 5000 });
      ok(/Zyklus \d+/.test(await P.textContent('.probe-cy')) && await P.textContent('#probeState') === 'RUN', 'SCL Profi: Probebetrieb mit OB1-Zyklen');
    }
    await P.screenshot({ path: __dirname + '/shots/probe_' + q.toLowerCase() + '.png' });
    ok(errors.length === 0, q + ': keine JS-Fehler' + (errors.length ? ' – ' + errors[0] : ''));
    await browser.close();
  }
  console.log('Probebetrieb: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})();
