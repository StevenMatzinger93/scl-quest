const fs0 = require('fs'); fs0.mkdirSync(__dirname + '/shots', { recursive:true });
// KOP Quest: kompletter Durchlauf über die echte UI (alle Theorien + Aufgaben), erste Aufgabe per Klick im Netzwerk-Editor.
// Optional: node tests/kop_playthrough.js mobile  → schmaler Bildschirm (390×844), nur die ersten Schritte
const { open } = require('./pw.js');
const MOBILE = process.argv.includes('mobile');
(async () => {
  const { browser, page, errors } = await open({ file:'kop.html', viewport: MOBILE ? { width:390, height:844 } : undefined, dpr: MOBILE ? 2 : 1 });
  const KEY = await page.evaluate(() => window.QUEST.key);
  await page.evaluate(k => { localStorage.setItem(k, JSON.stringify({ v:4, pos:0, settings:{ sound:false, motion:true, speed:0.03, font:14 } })); }, KEY);
  await page.reload(); await page.waitForTimeout(300);
  await page.screenshot({ path:__dirname + '/shots/kop_00_title' + (MOBILE ? '_m' : '') + '.png' });
  await page.fill('#playerName', 'Test Person');
  await page.click('#newGameBtn');
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.state.settings.speed = 0.03; SCLQuest.state.settings.motion = true; });
  let tasksDone = 0, theoryDone = 0, certs = 0, clicked = false;
  const limit = MOBILE ? 3 : 1e9;
  for(let guard = 0; guard < 700 && tasksDone < limit; guard++){
    const where = await page.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; };
      if(vis('certificate')) return 'cert';
      if(vis('levelIntroOverlay')) return 'intro';
      if(vis('theoryOverlay')) return 'theory';
      if(vis('app')) return 'task';
      return 'other';
    });
    if(where === 'cert'){
      certs++;
      await page.waitForTimeout(200);
      await page.screenshot({ path:__dirname + '/shots/kop_cert_' + certs + '.png' });
      const more = await page.evaluate(() => getComputedStyle(document.getElementById('certProBtn')).display !== 'none' && SCL_CONTENT.tasks.some(t => t.pro));
      if(more){ await page.click('#certProBtn'); continue; }
      break;
    }
    if(where === 'intro'){ await page.click('#introStartBtn'); continue; }
    if(where === 'theory'){
      if(theoryDone === 0) await page.screenshot({ path:__dirname + '/shots/kop_01_theory' + (MOBILE ? '_m' : '') + '.png' });
      await page.click('#thStartQuiz');
      for(let q = 0; q < 5; q++){
        await page.evaluate(() => {
          const th = SCL_CONTENT.theory.find(t => t.title === document.getElementById('theoryTitle').textContent);
          const txt = document.querySelector('.q-text').innerHTML;
          const norm = h => { const d = document.createElement('div'); d.innerHTML = h; return d.innerHTML; }; const qq = th.questions.find(x => norm(x.q) === txt);
          if(qq.type === 'input'){ const i = document.getElementById('qInput'); i.value = qq.answer[0]; i.dispatchEvent(new Event('input')); }
          else { const corr = qq.type === 'multi' ? qq.correct : [qq.correct]; document.querySelectorAll('.q-opt').forEach(b => { if(corr.includes(+b.dataset.oi)) b.click(); }); }
        });
        await page.click('#qCheck');
        const ok = await page.$eval('.q-feedback', e => e.classList.contains('ok'));
        if(!ok) console.log('QUIZ FALSCH bewertet:', await page.$eval('.q-text', e => e.textContent));
        await page.click('#qNext');
      }
      await page.click('#thContinue'); theoryDone++;
      continue;
    }
    if(where === 'task'){
      const id = await page.evaluate(() => SCLQuest.session.task.id);
      if(!clicked){
        // erste Aufgabe: Kontakt und Spule per Klick belegen (Variablenliste)
        clicked = true;
        await page.screenshot({ path:__dirname + '/shots/kop_02_task' + (MOBILE ? '_m' : '') + '.png' });
        const t = await page.evaluate(() => ({ ref: SCLQuest.session.task.refSolution, vars: Object.keys(SCLQuest.session.task.initialVars) }));
        const m = /\n(\w+) => (\w+);/.exec(t.ref);
        if(m){
          await page.click('.khit[data-kind="e"]'); await page.click('.var-chip[data-name="' + m[1] + '"]');
          await page.click('.khit[data-kind="o"]'); await page.click('.var-chip[data-name="' + m[2] + '"]');
          await page.click('#compileBtn');
          try{ await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:15000 }); console.log('Klick-Bedienung ok (' + id + ')'); }
          catch(e){ console.log('KLICK-LÖSUNG FEHLGESCHLAGEN', id, await page.evaluate(() => SCLQuest.editor.getValue())); }
          await page.screenshot({ path:__dirname + '/shots/kop_03_solved' + (MOBILE ? '_m' : '') + '.png' });
          await page.click('#nextBtn'); tasksDone++;
          continue;
        }
      }
      if(['k1_notaus_dbg','k10_ausgaben','k10_final'].includes(id)){
        await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.editor.setValue(t._wrong ? t._wrong[0] : t.starterCode); SCLQuest.compile(); });
        await page.waitForTimeout(300);
        await page.screenshot({ path:__dirname + '/shots/kop_fail_' + id + '.png' });
      }
      await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.editor.setValue(t.refSolution); SCLQuest.compile(); });
      try{ await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:20000 }); }
      catch(e){ console.log('KEIN ERFOLG bei', id, await page.$eval('#reportBody', e => e.innerText.slice(0,400))); break; }
      if(['k3_boss','k6_boss','k10_final'].includes(id)) await page.screenshot({ path:__dirname + '/shots/kop_ok_' + id + '.png' });
      await page.click('#nextBtn'); tasksDone++;
      continue;
    }
    console.log('unbekannter Zustand'); break;
  }
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ tasks:Object.keys(SCLQuest.state.doneTasks).length, theory:Object.keys(SCLQuest.state.doneTheory).length, total:SCL_CONTENT.tasks.length, totalTh:SCL_CONTENT.theory.length, cert:!!SCLQuest.state.basicCert }));
  console.log('KOP: Aufgaben', tasksDone, 'Theorie', theoryDone, JSON.stringify(st));
  const bad = errors.filter(e => !/ERR_NAME_NOT_RESOLVED|net::/.test(e));
  console.log(bad.join('\n') || 'keine JS-Fehler');
  await browser.close();
  process.exit(!MOBILE && (st.tasks < st.total || st.theory < st.totalTh || bad.length) ? 1 : 0);
})();
