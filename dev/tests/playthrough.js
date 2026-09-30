const fs0 = require('fs'); fs0.mkdirSync(__dirname + '/shots', { recursive:true });
// Kompletter Durchlauf: alle 30 Theorie-Aufträge + 150 Aufgaben über die echte UI (inkl. Grundstufen-Zertifikat)
const { open } = require('./pw.js');
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { localStorage.setItem('sclquest3_state_v4', JSON.stringify({ v:4, pos:0, settings:{ sound:false, motion:true, speed:0.03, font:14 } })); });
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#playerName', 'Test Person');
  await page.click('#newGameBtn'); // kein Fortschritt -> kein Dialog
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.state.settings.training = true; });   // alle 150 Aufgaben (Training im Ablauf)
  // newGame setzt Standard-Settings zurück -> Geschwindigkeit erneut setzen
  await page.evaluate(() => { SCLQuest.state.settings.speed = 0.03; SCLQuest.state.settings.motion = true; });
  let shot = 0, tasksDone = 0, theoryDone = 0;
  let certs = 0;
  for(let guard = 0; guard < 700; guard++){
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
      await page.screenshot({ path:__dirname + '/shots/cert_' + certs + '.png' });
      const basic = await page.evaluate(() => getComputedStyle(document.getElementById('certProBtn')).display !== 'none');
      if(basic){ await page.click('#certProBtn'); continue; }
      break;
    }
    if(where === 'intro'){ await page.click('#introStartBtn'); continue; }
    if(where === 'theory'){
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
        if(!ok){ console.log('QUIZ FALSCH bewertet:', await page.$eval('.q-text', e => e.textContent)); }
        await page.click('#qNext');
      }
      if(theoryDone === 0) await page.screenshot({ path:__dirname + '/shots/05_quiz_result.png' });
      await page.click('#thContinue'); theoryDone++;
      continue;
    }
    if(where === 'task'){
      const id = await page.evaluate(() => SCLQuest.session.task.id);
      if(tasksDone === 0) await page.screenshot({ path:__dirname + '/shots/06_task.png' });
      // erst eine falsche Lösung (leerer Startcode) → Bericht prüfen, dann Referenz
      const isPro = await page.evaluate(() => !!SCLQuest.session.task.pro);
      if(isPro){
        if(['p11_temp_dbg','p13_multiinstanz','p14_boss','p15_final'].includes(id)){
          await page.evaluate(() => { const t = SCLQuest.session.task; if(t._wrong) SCLQuest.setProCodes(Object.assign(ProTask.refCodes(t), t._wrong[0])); SCLQuest.compile(); });
          await page.waitForTimeout(300);
          await page.screenshot({ path:__dirname + '/shots/fail_' + id + '.png' });
        }
        await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.setProCodes(ProTask.refCodes(t)); SCLQuest.compile(); });
        try{ await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:20000 }); }
        catch(e){ console.log('KEIN ERFOLG bei', id, await page.$eval('#reportBody', e => e.innerText.slice(0,400))); break; }
        if(['p11_boss','p13_boss','p15_final'].includes(id)) await page.screenshot({ path:__dirname + '/shots/ok_' + id + '.png' });
        await page.click('#nextBtn'); tasksDone++;
        continue;
      }
      if(['c1_copy','r4t5','c8_zaehlen','c9_anlauf','final_boss','c2_klammer_dbg'].includes(id)){
        await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.editor.setValue(t._wrong ? t._wrong[0] : (t.starterCode || 'x := 1;')); SCLQuest.compile(); });
        await page.waitForTimeout(250);
        await page.screenshot({ path:__dirname + '/shots/fail_' + id + '.png', fullPage:false });
      }
      await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.editor.setValue(t.refSolution); SCLQuest.compile(); });
      try{ await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:15000 }); }
      catch(e){ console.log('KEIN ERFOLG bei', id, await page.$eval('#reportBody', e => e.innerText.slice(0,400))); break; }
      if(['c1_boss','r1t10','c4_boss','final_boss'].includes(id)) await page.screenshot({ path:__dirname + '/shots/ok_' + id + '.png' });
      await page.click('#nextBtn'); tasksDone++;
      continue;
    }
    console.log('unbekannter Zustand'); break;
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path:__dirname + '/shots/99_cert.png' });
  const st = await page.evaluate(() => ({ tasks:Object.keys(SCLQuest.state.doneTasks).length, theory:Object.keys(SCLQuest.state.doneTheory).length, badges:SCLQuest.state.badges, pos:SCLQuest.state.pos }));
  console.log('Aufgaben', tasksDone, 'Theorie', theoryDone, JSON.stringify(st));
  console.log(errors.join('\n') || 'keine JS-Fehler');
  await browser.close();
})();
