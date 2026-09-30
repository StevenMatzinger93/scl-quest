// Sensorwerkstatt: Durchlauf über die echte Oberfläche (sensor.html) — alle Theorien und Aufgaben.
// Typische Aufgaben werden Klick für Klick gelöst (Fragen, Montieren mit Gabelschlüssel, M12, Verdrahten an der Klemmleiste,
// Variablentabelle, Programm im Engineering-Laptop mit Laden). Die übrigen Aufgaben bekommen die Referenzlösung (SensorGame.applyRef)
// und werden über „Arbeit prüfen“ abgenommen. Programme stichprobenartig auch in KOP und FUP.
// Optional: node tests/sensor_playthrough.js mobile → 390 × 844, nur die ersten Aufgaben
const fs = require('fs'); fs.mkdirSync(__dirname + '/shots', { recursive: true });
const { open } = require('./pw.js');
const MOBILE = process.argv.includes('mobile');
const FUP_TASKS = ['w1_antivalenz_prog', 'w1_boss_sortierstrecke'];   // KOP entfällt in der Sensorwerkstatt (29.09.2026)
(async () => {
  const { browser, page, errors } = await open({ file: 'sensor.html', viewport: MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, dpr: 1 });
  const P = page;
  const KEY = await P.evaluate(() => window.QUEST.key);
  await P.evaluate(k => { localStorage.setItem(k, JSON.stringify({ v: 4, pos: 0, settings: { sound: false, motion: true, speed: 0.03, font: 14, sensor2d: false } })); }, KEY);
  await P.reload(); await P.waitForTimeout(300);
  await P.screenshot({ path: __dirname + '/shots/sensor_00_title' + (MOBILE ? '_m' : '') + '.png' });
  await P.fill('#playerName', 'Test Person');
  await P.click('#newGameBtn');
  await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; });
  const id = n => '#w2d_' + n.replace(/\+/g, 'P').replace(/-/g, 'N').replace(/[^A-Za-z0-9]/g, '_');
  const tap = async (a, b) => { await P.click(id(a)); await P.click(id(b)); };
  const solved = async () => { try { await P.waitForSelector('#successCard:not([style*="display: none"])', { timeout: 20000 }); return true; } catch(e){ return false; } };
  let tasksDone = 0, theoryDone = 0, byHand = 0, fails = 0;
  const limit = MOBILE ? 2 : 1e9;
  for(let guard = 0; guard < 400 && tasksDone < limit; guard++){
    const where = await P.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; };
      if(vis('certificate')) return 'cert';
      if(vis('levelIntroOverlay')) return 'intro';
      if(vis('theoryOverlay')) return 'theory';
      if(SCLQuest.state.pos >= SCLQuest.SEQ.length) return 'end';
      if(vis('app')) return 'task';
      return 'other';
    });
    if(where === 'cert' || where === 'end') break;
    if(where === 'intro'){ await P.click('#introStartBtn'); continue; }
    if(where === 'theory'){
      if(theoryDone === 0) await P.screenshot({ path: __dirname + '/shots/sensor_01_theory' + (MOBILE ? '_m' : '') + '.png' });
      await P.click('#thStartQuiz');
      for(let q = 0; q < 5; q++){
        await P.evaluate(() => {
          const th = SCL_CONTENT.theory.find(t => t.title === document.getElementById('theoryTitle').textContent);
          const txt = document.querySelector('.q-text').innerHTML;
          const norm = h => { const d = document.createElement('div'); d.innerHTML = h; return d.innerHTML; }; const qq = th.questions.find(x => norm(x.q) === txt);
          if(qq.type === 'input'){ const i = document.getElementById('qInput'); i.value = qq.answer[0]; i.dispatchEvent(new Event('input')); }
          else { const corr = qq.type === 'multi' ? qq.correct : [qq.correct]; document.querySelectorAll('.q-opt').forEach(b => { if(corr.includes(+b.dataset.oi)) b.click(); }); }
        });
        await P.click('#qCheck');
        if(!(await P.$eval('.q-feedback', e => e.classList.contains('ok')))) console.log('QUIZ FALSCH bewertet:', await P.$eval('.q-text', e => e.textContent));
        await P.click('#qNext');
      }
      await P.click('#thContinue'); theoryDone++;
      continue;
    }
    if(where !== 'task'){ await P.waitForTimeout(200); continue; }
    const tid = await P.evaluate(() => SCLQuest.session.task.id);
    let hand = true;
    if(tid === 'w1_datenblatt'){
      await P.screenshot({ path: __dirname + '/shots/sensor_02_task' + (MOBILE ? '_m' : '') + '.png' });
      // Fragen per Klick: erst absichtlich falsch prüfen → Abnahmeprotokoll, dann richtig
      await P.click('#compileBtn');
      const bad = await P.locator('.sw-step.bad').count();
      console.log((bad === 5 ? '✓' : '✗') + ' Abnahme ohne Antworten: ' + bad + ' offene Schritte markiert'); if(bad !== 5) fails++;
      for(const [i, v] of [[0, 0], [1, 0], [3, 0], [4, 0]]) await P.check(`input[name="swq${i}"][value="${v}"]`);
      await P.fill('input[data-q="2"]', '8'); await P.press('input[data-q="2"]', 'Tab');
    } else if(tid === 'w1_b1_anschliessen'){
      // Abnahmeprotokoll: ohne Arbeit prüfen → alle 5 Schritte offen (Montage, Anstecken, Adern, Einschalten, Beobachten)
      await P.click('#compileBtn');
      const bad0 = await P.locator('.sw-step.bad').count();
      console.log((bad0 === 5 ? '✓' : '✗') + ' Abnahme ohne Arbeit: ' + bad0 + ' offene Schritte markiert'); if(bad0 !== 5) fails++;
      await P.click('[data-tool="gabel"]');
      await P.evaluate(() => SCLQuest.sensor.workshop.openCard('B1'));
      if(await P.locator('[data-act="loosen"]').count()) await P.click('[data-act="loosen"]');   // Start: Muttern schon lose
      for(let i = 0; i < 10; i++) await P.click('[data-act="minus"]');
      await P.click('[data-act="tighten"]');
      await P.click('[data-act="plug"]'); await P.click('[data-act="plugTight"]');
      await P.click('[data-tool="hand"]');
      await tap('B1:BN', 'X2:5.L+'); await tap('B1:BU', 'X2:5.M'); await tap('B1:BK', 'X2:5.S');
      await P.click('[data-a="main"]');
      await P.selectOption('select[data-part="B1"]', 'stahl'); await P.waitForTimeout(400);
      const led = await P.evaluate(() => SCLQuest.sensor.workshop.scene ? SCLQuest.sensor.workshop.scene.ledState('DI0.4') : SCLQuest.sensor.workshop.evaluation.di['I0.4']);
      console.log((led === true ? '✓' : '✗') + ' Stahlteil vor -B1: Eingangs-LED %I0.4 leuchtet'); if(led !== true) fails++;
      await P.screenshot({ path: __dirname + '/shots/sensor_03_b1' + (MOBILE ? '_m' : '') + '.png' });
    } else if(tid === 'w1_variablentabelle'){
      await P.click('#swLaptopBtn'); await P.click('#engHost [data-tab="tags"]');
      const rows = [['Start', 'Bool', '%I0.0'], ['Stopp', 'Bool', '%I0.1'], ['Ind_Metall', 'Bool', '%I0.4'], ['Rutsche_Voll', 'Bool', '%I1.0'], ['Haube_Zu', 'Bool', '%I1.3'], ['Band', 'Bool', '%Q0.0']];
      for(let i = 0; i < rows.length; i++){
        await P.click('#engHost [data-e="addtag"]');
        await P.fill(`[data-tag="${i}.name"]`, rows[i][0]); await P.press(`[data-tag="${i}.name"]`, 'Tab');
        await P.selectOption(`[data-tag="${i}.type"]`, rows[i][1]);
        await P.fill(`[data-tag="${i}.addr"]`, rows[i][2]); await P.press(`[data-tag="${i}.addr"]`, 'Tab');
      }
      await P.screenshot({ path: __dirname + '/shots/sensor_04_tags' + (MOBILE ? '_m' : '') + '.png' });
      await P.click('#engCloseBtn');
    } else if(tid === 'w1_band_selbsthaltung'){
      await P.click('#swLaptopBtn'); await P.click('#engHost [data-tab="program"]');
      // FUP im echten Spiel: grafischer Editor mit Palette und PLC-Variablen (kein Textfeld), keine KOP-Wahl
      const kopBtn = await P.locator('#engHost [data-lang="kop"]').count();
      await P.click('#engHost [data-lang="fup"]');
      const fupOk = await P.evaluate(() => !!document.querySelector('#engHost #kopCanvas') && document.querySelectorAll('#engHost .eng-fup-vars .var-chip').length > 5 && document.querySelectorAll('#engHost #kopTools .fpal').length > 3);
      if(kopBtn || !fupOk){ fails++; console.log('✗ FUP im Engineering-Laptop: KOP-Knöpfe ' + kopBtn + ', grafischer Editor ' + fupOk); } else console.log('✓ FUP im Engineering-Laptop: grafischer Editor, Palette, Variablen');
      await P.screenshot({ path: __dirname + '/shots/sensor_05_fup' + (MOBILE ? '_m' : '') + '.png' });
      await P.click('#engHost [data-lang="scl"]');
      await P.fill('#engHost .eng-ta', '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";\n');
      await P.click('#engHost [data-e="load"]'); await P.click('#engHost [data-e="doload"]');
      await P.screenshot({ path: __dirname + '/shots/sensor_05_engineering' + (MOBILE ? '_m' : '') + '.png' });
      await P.keyboard.press('Escape');
      // Anlage bedienen: Start drücken → Band läuft
      await P.click('[data-press="S1"]'); await P.waitForTimeout(400); await P.click('[data-press="S1"]');
    } else {
      hand = false;
      const lang = FUP_TASKS.includes(tid) ? 'fup' : undefined;
      try { await P.evaluate(l => SCLQuest.sensor.applyRef(l), lang); } catch(e){ console.log('✗ Referenz anwenden scheitert in ' + tid + ': ' + e.message.split('\n')[0]); fails++; break; }
      if(lang) console.log('  (' + tid + ' in ' + lang.toUpperCase() + ')');
    }
    if(hand) byHand++;
    await P.click('#compileBtn');
    if(!(await solved())){
      fails++;
      console.log('✗ NICHT GELÖST: ' + tid, await P.evaluate(() => [...document.querySelectorAll('#reportBody li.bad')].map(l => l.textContent).join(' | ')));
      await P.screenshot({ path: __dirname + '/shots/sensor_fail_' + tid + '.png', fullPage: true });
      break;
    }
    if(tid === 'w1_boss_sortierstrecke') await P.screenshot({ path: __dirname + '/shots/sensor_06_boss' + (MOBILE ? '_m' : '') + '.png' });
    await P.click('#nextBtn'); tasksDone++;
  }
  const st = await P.evaluate(() => ({ tasks: Object.keys(SCLQuest.state.doneTasks).filter(id => !SCLQuest.TASK_BY_ID[id].hidden).length, theory: Object.keys(SCLQuest.state.doneTheory).length, total: SCLQuest.TOTAL_TASKS, totalTh: SCLQuest.THEORY.length, hidden: Object.keys(SCLQuest.state.doneTasks).filter(id => SCLQuest.TASK_BY_ID[id].hidden).length }));
  if(!MOBILE && (st.total !== 30 || st.hidden)){ fails++; console.log('✗ erwartet 30 angezeigte Aufgaben ohne versteckte, gefunden ' + st.total + ' / versteckt gelöst ' + st.hidden); }
  const dw = MOBILE ? await P.evaluate(() => document.documentElement.scrollWidth) : 0;
  if(MOBILE && dw > 390){ fails++; console.log('✗ Handy: waagrechte Seitenverschiebung (' + dw + ' px)'); }
  console.log('Sensorwerkstatt: Aufgaben ' + st.tasks + '/' + st.total + ' (davon ' + byHand + ' von Hand), Theorie ' + st.theory + '/' + st.totalTh);
  if(errors.length){ fails++; console.log('JS-FEHLER:\n' + errors.slice(0, 5).join('\n')); } else console.log('keine JS-Fehler');
  await browser.close();
  process.exit(fails || (!MOBILE && st.tasks < st.total) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
