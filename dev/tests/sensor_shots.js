// Sensorwerkstatt W8: Bildschirmfotos der neuen Kernschleife bei 1366×768, 1920×1080 und 390 px
// und Prüfung „ein Bildschirm“: am Desktop keine Seitenverschiebung (weder senkrecht noch waagrecht), am Handy keine waagrechte.
// Zusätzlich: Messung zählt einen Abbruch, wenn eine Aufgabe ohne Lösung verlassen wird.
// Bilder: tests/shots/sensor_v2/<aufgabe>_<phase>_<breite>.png
const fs = require('fs'), OUT = __dirname + '/shots/sensor_v2'; fs.mkdirSync(OUT, { recursive: true });
const { open } = require('./pw.js');
const VIEWS = [{ w: 1366, h: 768 }, { w: 1920, h: 1080 }, { w: 390, h: 844, mobile: true }];
const SHOTS = [['w1_b1_anschliessen', 'verbinden'], ['w1_variablentabelle', 'signale'], ['w1_band_selbsthaltung', 'programm'], ['w2_pnp_messen', 'laufen'], ['w4_loopcheck', 'laufen']];
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } };
(async () => {
  for(const V of VIEWS){
    const { browser, page: P, errors } = await open({ file: 'sensor.html', viewport: { width: V.w, height: V.h }, dpr: 1 });
    const KEY = await P.evaluate(() => window.QUEST.key);
    await P.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 4, pos: 0, settings: { sound: false, motion: false, speed: 0.03, font: 14 } })), KEY);
    if(V.w === 1366) await P.context().setOffline(true);   // offline spielbar: ohne Netz
    await P.reload(); await P.waitForTimeout(300);
    await P.fill('#playerName', 'Messung'); await P.click('#newGameBtn');
    await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; });
    for(const [id, ph] of SHOTS){
      await P.evaluate(([id, ph]) => { document.querySelectorAll('.overlay, #levelIntroOverlay, #theoryOverlay').forEach(e => { e.style.display = 'none'; }); document.getElementById('app').style.display = '';
        SCLQuest.renderTask(SCLQuest.TASK_BY_ID[id], false); SCLQuest.sensor.showPhase(ph, true); }, [id, ph]);
      await P.waitForTimeout(700);
      const m = await P.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, v2: SCLQuest.sensor.current === SCLQuest.sensor.v2, ph: SCLQuest.sensor.phase }));
      await P.screenshot({ path: OUT + '/' + id + '_' + ph + '_' + V.w + '.png' });
      ok(m.v2 && m.ph === ph, V.w + ' ' + id + ': Kernschleife in Phase ' + ph);
      ok(m.sw <= V.w, V.w + ' ' + id + ': keine waagrechte Seitenverschiebung (' + m.sw + ')');
      if(!V.mobile) ok(m.sh <= V.h + 1, V.w + ' ' + id + ': passt auf einen Bildschirm (' + m.sh + ' ≤ ' + V.h + ')');
    }
    if(V.w === 1366){
      // Abbruch: Aufgabe öffnen und ohne Lösung verlassen
      const r = await P.evaluate(() => { const S = SCLQuest.state, id = 'w1_start_stopp'; SCLQuest.renderTask(SCLQuest.TASK_BY_ID[id], false); const a0 = ((S.sensorMetrics || {})[id] || {}).aborts || 0;
        SCLQuest.renderTask(SCLQuest.TASK_BY_ID['w1_b1_anschliessen'], false); return { a0, a1: S.sensorMetrics[id].aborts, opens: S.sensorMetrics[id].opens }; });
      ok(r.a1 === r.a0 + 1 && r.opens >= 1, 'Messung: Verlassen ohne Lösung zählt als Abbruch (' + JSON.stringify(r) + ')');
    }
    ok(!errors.filter(e => !/ERR_INTERNET_DISCONNECTED|fonts\.g/.test(e)).length, V.w + (V.w === 1366 ? ' (offline)' : '') + ': keine JS-Fehler' + (errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
  }
  console.log('Sensorwerkstatt Bildschirme: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
