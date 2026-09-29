// Geführte Sensorwerkstatt (Paket 4.3): Schrittleiste, Zeig mir, Rundgang, Typenschild-Bild – node tests/sensor_guide_ui.js
const { open } = require('./pw.js');
let fails = 0, oks = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
(async () => {
  const { browser, page: P, errors } = await open({ file: 'sensor.html', viewport: { width: 1440, height: 900 } });
  await P.fill('#playerName', 'Fuehrung'); await P.click('#newGameBtn');
  await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; document.getElementById('levelIntroOverlay').style.display = 'none'; document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS[0], false); });
  // Rundgang beim ersten Start
  await P.waitForSelector('#tourOverlay', { state: 'visible', timeout: 5000 }).catch(() => {});
  ok(await P.evaluate(() => getComputedStyle(document.getElementById('tourOverlay')).display !== 'none'), 'Rundgang startet bei der ersten Werkstatt-Aufgabe');
  const tourTitles = [];
  for(let i = 0; i < 9; i++){ const vis = await P.evaluate(() => getComputedStyle(document.getElementById('tourOverlay')).display !== 'none'); if(!vis) break; tourTitles.push(await P.evaluate(() => (document.querySelector('#tourTitle') || {}).textContent)); await P.click('#tourNext'); await P.waitForTimeout(120); }
  ok(tourTitles.length >= 6 && /Arbeitsschritte/.test(tourTitles[0]), 'Rundgang zeigt ' + tourTitles.length + ' Stationen, beginnt bei den Arbeitsschritten');
  ok(await P.evaluate(() => !!SCLQuest.state.tours.sensor), 'Rundgang wird gemerkt');
  // Leiste
  const n = await P.evaluate(() => SCLQuest.TASKS[0].steps.length);
  ok(await P.locator('#swChips .sw-chip').count() === n, 'Schrittleiste: ' + n + ' Punkte');
  ok(await P.locator('#swChips .sw-chip.now').count() === 1 && /Schritt 1 von/.test(await P.textContent('#swNow')), 'Genau ein Schritt ist aktiv');
  ok(await P.locator('.ws-plate svg.np, .np-wrap svg.np').count() >= 1, 'Typenschild als Bild in der Aufgabe');
  // Schritt lösen → springt weiter
  const t0 = await P.evaluate(() => SCLQuest.TASKS[0]);
  await P.evaluate(() => { const t = SCLQuest.TASKS[0]; const g = SCLQuest.sensor.ctx; g.answers = g.answers || {}; g.answers[0] = { 0: t.steps[0].options ? t.steps[0].correct : t.steps[0].answer }; SCLQuest.sensor.applyRefStep && 0; });
  await P.evaluate(() => { const rs = document.querySelector('.sw-step[data-step="0"] input'); if(rs){ if(rs.type === 'radio'){ const t = SCLQuest.TASKS[0].steps[0]; document.querySelector('.sw-step[data-step="0"] input[value="' + t.correct + '"]').click(); } else { rs.value = SCLQuest.TASKS[0].steps[0].answer; rs.dispatchEvent(new Event('change', { bubbles: true })); } } });
  await P.waitForFunction(() => document.querySelector('#swChips .sw-chip[data-g="0"]').classList.contains('ok'), null, { timeout: 5000 }).catch(() => {});
  ok(await P.evaluate(() => document.querySelector('#swChips .sw-chip[data-g="0"]').classList.contains('ok')), 'Erledigter Schritt bekommt ein Häkchen');
  ok(await P.evaluate(() => document.querySelector('#swChips .sw-chip.now').dataset.g !== '0'), 'Die Leiste springt zum nächsten offenen Schritt');
  // Zeig mir bei einer Montage-Aufgabe
  await P.evaluate(() => { const t = SCLQuest.TASKS.find(x => x.steps.some(s => s.kind === 'mount')); SCLQuest.renderTask(t, true); });
  await P.waitForSelector('#swChips .sw-chip'); await P.waitForTimeout(500);
  await P.evaluate(() => { const t = SCLQuest.session.task; const i = t.steps.findIndex(s => s.kind === 'mount'); document.querySelector('#swChips .sw-chip[data-g="' + i + '"]').click(); });
  ok(await P.isVisible('#swShow'), 'Zeig mir sichtbar bei Montage');
  await P.click('#swShow'); await P.waitForTimeout(700);
  ok(await P.evaluate(() => SCLQuest.sensor.workshop.tool === 'gabel' || SCLQuest.sensor.workshop.tool === 'schrauber'), 'Zeig mir wählt das passende Werkzeug');
  ok(await P.locator('.ws-tool.ws-hint').count() === 1, 'Werkzeug wird hervorgehoben');
  ok(await P.evaluate(() => { const w = SCLQuest.sensor.workshop; return !!(w.scene ? w.scene.view : 1); }), 'Ansicht gewählt');
  // Verdrahten → Klemmleiste
  await P.evaluate(() => { const t = SCLQuest.session.task; const i = t.steps.findIndex(s => s.kind === 'wire'); document.querySelector('#swChips .sw-chip[data-g="' + i + '"]').click(); });
  await P.click('#swShow'); await P.waitForTimeout(500);
  ok(await P.evaluate(() => SCLQuest.sensor.workshop.tool === 'schrauber' && (!SCLQuest.sensor.workshop.scene || SCLQuest.sensor.workshop.scene.view === 6)), 'Zeig mir bei Verdrahten: Schraubendreher, Klemmleiste');
  // Referenz anwenden → alle Schritte ok, Prüfen-Knopf pulsiert
  await P.evaluate(() => SCLQuest.sensor.applyRef()); await P.waitForFunction(() => /Alle Schritte erfüllt/.test(document.getElementById('swNow').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(/Alle Schritte erfüllt/.test(await P.textContent('#swNow')), 'Alle Schritte erfüllt → Hinweis auf „Arbeit prüfen“');
  ok(await P.evaluate(() => document.getElementById('compileBtn').classList.contains('pulse')), 'Prüfen-Knopf pulsiert');
  // Detailkarte mit Typenschild
  await P.evaluate(() => SCLQuest.sensor.workshop.openCard('B1'));
  ok(await P.locator('.ws-card .ws-plate svg.np').count() === 1, 'Detailkarte zeigt das Typenschild als Bild');
  await P.screenshot({ path: __dirname + '/shots/sensor_guide.png' });
  ok(errors.length === 0, 'keine JS-Fehler' + (errors.length ? ': ' + errors[0] : ''));
  await browser.close();
  console.log('Geführte Werkstatt: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})();
