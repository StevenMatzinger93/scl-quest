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
  const seq = await P.evaluate(() => SCLQuest.SEQ.slice(0, 5).map(x => x.type + (x.optional ? '?' : '')).join(' '));
  if(seq === 'task theory? task task theory?') console.log('✓ Theorie nach Aufgabe 1 und 3, freiwillig (' + seq + ')');
  else { fails++; console.log('✗ Reihenfolge am Modulanfang: ' + seq); }
  let skipped = false;
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
      if(MOBILE && !skipped && await P.$('#thSkipBtn')){
        skipped = true; await P.click('#thSkipBtn'); await P.waitForTimeout(200);
        const ok = await P.evaluate(() => getComputedStyle(document.getElementById('theoryOverlay')).display === 'none' && Object.keys(SCLQuest.state.skippedTheory || {}).length === 1);
        if(ok) console.log('✓ „Später“ überspringt die freiwillige Theorie, sie bleibt offen');
        else { fails++; console.log('✗ „Später“ wirkt nicht'); }
        continue;
      }
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
    const ui = await P.evaluate(() => SCLQuest.sensor.current === SCLQuest.sensor.v2);
    if(!ui){ fails++; console.log('✗ ' + tid + ': nicht in der neuen Kernschleife (v2)'); break; }
    const flowState = () => P.evaluate(() => SCLQuest.sensor.flow.status(SCLQuest.sensor.ctx).map(x => x.key + ':' + x.state).join(' '));
    const runIt = async () => { await P.click('#svRun'); await P.waitForTimeout(300); };
    if(tid === 'w1_b1_anschliessen'){
      // Abnahmeprotokoll: ohne Arbeit prüfen → Verdrahten und Beobachten offen, Mechanik (Montage, Stecker, Einschalten) automatisch erfüllt
      await P.click('#compileBtn');
      const bad0 = await P.evaluate(() => [...document.querySelectorAll('#reportBody li.bad')].length);
      console.log((bad0 === 2 ? '✓' : '✗') + ' Abnahme ohne Arbeit: ' + bad0 + ' offene Punkte (Adern, Funktionsprobe)'); if(bad0 !== 2) fails++;
      await P.screenshot({ path: __dirname + '/shots/sensor_02_task' + (MOBILE ? '_m' : '') + '.png' });
      // ① Verbinden in der 2.5D-Ansicht: antippen, ziehen, Zeig mir
      await P.click('#svHelp');
      const pulse = await P.evaluate(() => [...document.querySelectorAll('#svWiring .pulse')].map(x => x.dataset.core || x.dataset.terminal).join(','));
      console.log((pulse.includes('B1:BN') && pulse.includes('X2:5.L+') ? '✓' : '✗') + ' Zeig mir markiert Ader und Zielklemme (' + pulse + ')');
      await P.click('[data-core="B1:BN"]'); await P.click('[data-terminal="X2:5.L+"]');
      if(!MOBILE) await P.dragAndDrop('[data-core="B1:BU"]', '[data-terminal="X2:5.M"]'); else { await P.click('[data-core="B1:BU"]'); await P.click('[data-terminal="X2:5.M"]'); }
      await P.click('[data-core="B1:BK"]'); await P.click('[data-terminal="X2:5.S"]');
      await P.screenshot({ path: __dirname + '/shots/sensor_03_b1' + (MOBILE ? '_m' : '') + '.png' });
      const fs1 = await flowState();
      console.log((fs1.startsWith('verbinden:bereit') ? '✓' : '✗') + ' nach den Adern: ' + fs1); if(!fs1.startsWith('verbinden:bereit')) fails++;
      await P.click('#svAccept'); await runIt();
      await P.selectOption('select[data-part="B1"]', 'stahl'); await P.waitForTimeout(500);
      const led = await P.evaluate(() => SCLQuest.sensor.plant ? SCLQuest.sensor.plant.scene.ledState('DI0.4') : true);
      console.log((led === true ? '✓' : '✗') + ' Laufen lassen: Stahlteil vor -B1, Eingangs-LED %I0.4 leuchtet'); if(led !== true) fails++;
      await P.screenshot({ path: __dirname + '/shots/sensor_03b_laufen' + (MOBILE ? '_m' : '') + '.png' });
    } else if(tid === 'w1_start_stopp'){
      // Taster anschliessen und Fragen im Verbinden-Schritt beantworten
      for(const [a, b] of [['S1:13', 'X2:1.L+'], ['S1:14', 'X2:1.S'], ['S2:11', 'X2:2.L+'], ['S2:12', 'X2:2.S']]){ await P.click('[data-core="' + a + '"]'); await P.click('[data-terminal="' + b + '"]'); }
      await P.evaluate(() => { const t = SCLQuest.session.task; t.steps.forEach((s, i) => { if(s.kind !== 'quiz') return; const el = document.querySelector('#svQuestions [data-q="' + i + '"]' + (s.options ? '[value="' + s.correct + '"]' : '')); if(!el) return; if(s.options) el.click(); else { el.value = String(s.answer); el.dispatchEvent(new Event('change', { bubbles: true })); } }); });
      await P.waitForTimeout(200); await P.click('#svAccept'); await runIt();
    } else if(tid === 'w1_variablentabelle'){
      // ② Signale: PLC-Variablen im eingebetteten Engineering
      const ph = await P.evaluate(() => SCLQuest.sensor.phase);
      console.log((ph === 'signale' ? '✓' : '✗') + ' Start in ② Signale (' + ph + ')');
      const rows = await P.evaluate(() => { const t = SCLQuest.session.task, s = t.steps.find(x => x.kind === 'tags'); return (s.ref || s.require).map(r => [r.name, r.type, r.addr]); });
      for(const [name, type, addr] of rows){
        const exists = await P.evaluate(n => SCLQuest.sensor.ctx.tags.findIndex(x => x.name.toLowerCase() === n.toLowerCase()), name);
        const i = exists >= 0 ? exists : await P.evaluate(() => SCLQuest.sensor.ctx.tags.length);
        if(exists < 0) await P.click('#svEng [data-e="addtag"]');
        await P.fill(`#svEng [data-tag="${i}.name"]`, name); await P.press(`#svEng [data-tag="${i}.name"]`, 'Tab');
        await P.selectOption(`#svEng [data-tag="${i}.type"]`, type);
        await P.fill(`#svEng [data-tag="${i}.addr"]`, addr); await P.press(`#svEng [data-tag="${i}.addr"]`, 'Tab');
      }
      await P.screenshot({ path: __dirname + '/shots/sensor_04_tags' + (MOBILE ? '_m' : '') + '.png' });
      await P.click('#svAccept'); await runIt();
    } else if(tid === 'w1_band_selbsthaltung'){
      // ③ Programm: FUP grafisch vorhanden, dann SCL schreiben, Laufen lassen, Taster bedienen
      const kopBtn = await P.locator('#svEng [data-lang="kop"]').count();
      await P.click('#svEng [data-lang="fup"]');
      const fupOk = await P.evaluate(() => !!document.querySelector('#svEng #fwbHost .fwb, #svEng #kopCanvas') && document.querySelectorAll('#svEng .eng-fup-vars .var-chip').length > 5);
      if(kopBtn || !fupOk){ fails++; console.log('✗ FUP im Programm-Schritt: KOP-Knöpfe ' + kopBtn + ', grafischer Editor ' + fupOk); } else console.log('✓ FUP im Programm-Schritt: grafischer Editor, Palette, Variablen');
      await P.screenshot({ path: __dirname + '/shots/sensor_05_fup' + (MOBILE ? '_m' : '') + '.png' });
      await P.click('#svEng [data-lang="scl"]');
      const chips = await P.locator('#svEng .eng-scl-vars .var-chip').count();
      console.log((chips > 5 ? '✓' : '✗') + ' SCL: PLC-Variablen als Chips über dem Editor (' + chips + ')');
      await P.fill('#svEng .eng-ta', ''); await P.click('#svEng .eng-scl-vars .var-chip[data-name=\'"Band"\']');
      const ins = await P.evaluate(() => document.querySelector('#svEng .eng-ta').value);
      console.log((ins === '"Band"' ? '✓' : '✗') + ' Klick auf eine PLC-Variable fügt den Namen ein (' + ins + ')'); if(ins !== '"Band"') fails++;
      await P.fill('#svEng .eng-ta', '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";\n');
      await P.waitForTimeout(300); await P.click('#svAccept'); await runIt();
      await P.click('[data-press="S1"]'); await P.waitForTimeout(400); await P.click('[data-press="S1"]'); await P.waitForTimeout(300);
      const band = await P.evaluate(() => SCLQuest.sensor.plc.out['Q0.0'] === true);
      console.log((band ? '✓' : '✗') + ' Probebetrieb: Start drücken → Band läuft (Selbsthaltung)'); if(!band) fails++;
      await P.screenshot({ path: __dirname + '/shots/sensor_05_engineering' + (MOBILE ? '_m' : '') + '.png' });
    } else if(tid === 'w2_pnp_messen'){
      // ④ Messen mit dem Multimeter
      await runIt();
      await P.selectOption('#svControls [data-mm="a"]', 'X2:5.S'); await P.selectOption('#svControls [data-mm="b"]', 'X2:5.M');
      await P.selectOption('select[data-part="B1"]', 'stahl'); await P.waitForTimeout(400);
      const v1 = await P.evaluate(() => document.getElementById('svMeter').textContent);
      console.log((/^2[34]\./.test(v1) ? '✓' : '✗') + ' Multimeter: -X2:5 Signal gegen M mit Stahlteil = ' + v1); if(!/^2[34]\./.test(v1)) fails++;
      await P.evaluate(() => { const t = SCLQuest.session.task, c = SCLQuest.sensor.ctx; t.steps.forEach((s, i) => { if(s.kind === 'measure') (s.ask || []).forEach((a, j) => { const el = document.querySelector('[data-m="' + i + '.' + j + '"]'); el.value = String(SensorTasks.expectedMeasure(a, c)); el.dispatchEvent(new Event('change', { bubbles: true })); }); if(s.kind === 'quiz'){ const el = document.querySelector('#svQuestions [data-q="' + i + '"]' + (s.options ? '[value="' + s.correct + '"]' : '')); if(el){ if(s.options) el.click(); else { el.value = String(s.answer); el.dispatchEvent(new Event('change', { bubbles: true })); } } } }); });
      await P.screenshot({ path: __dirname + '/shots/sensor_06_messen' + (MOBILE ? '_m' : '') + '.png' });
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
  const mt = await P.evaluate(() => { const id = SCLQuest.SEQ.find(x => x.type === 'task').id; return { id, m: (SCLQuest.state.sensorMetrics || {})[id] }; });
  if(mt.m && mt.m.opens >= 1 && mt.m.firstWireMs > 0 && mt.m.solvedMs > 0 && mt.m.phaseMs.verbinden > 0 && mt.m.aborts === 0) console.log('✓ Messung ' + mt.id + ': erste Ader nach ' + (mt.m.firstWireMs / 1000).toFixed(1) + ' s, gelöst nach ' + (mt.m.solvedMs / 1000).toFixed(1) + ' s, Phasen ' + Object.keys(mt.m.phaseMs).join('/') + ', Zeig mir ' + mt.m.help + '×');
  else { fails++; console.log('✗ Messung fehlt oder unvollständig: ' + JSON.stringify(mt)); }
  const dw = MOBILE ? await P.evaluate(() => document.documentElement.scrollWidth) : 0;
  if(MOBILE && dw > 390){ fails++; console.log('✗ Handy: waagrechte Seitenverschiebung (' + dw + ' px)'); }
  console.log('Sensorwerkstatt: Aufgaben ' + st.tasks + '/' + st.total + ' (davon ' + byHand + ' von Hand), Theorie ' + st.theory + '/' + st.totalTh);
  if(errors.length){ fails++; console.log('JS-FEHLER:\n' + errors.slice(0, 5).join('\n')); } else console.log('keine JS-Fehler');
  await browser.close();
  process.exit(fails || (!MOBILE && st.tasks < st.total) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
