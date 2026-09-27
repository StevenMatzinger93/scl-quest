// AWL Quest: Editor mit Hervorhebung und Statusspalte (VKE/AKKU), Profi-Bausteine, Beobachten mit Status, Handy-Breite
const { open } = require('./pw.js');
(async () => {
  const { browser, page, errors } = await open({ file:'awl.html' });
  let fails = 0; const ok = (c, m) => { if(!c){ fails++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#playerName', 'Test'); await page.click('#newGameBtn');
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.state.basicCert = true; SCLQuest.state.settings.speed = 0.05; });
  const go = id => page.evaluate(id => { document.querySelectorAll('.overlay,#levelIntroOverlay,#theoryOverlay').forEach(o => o.style.display = 'none'); document.getElementById('titleScreen').style.display = 'none'; document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === id)); }, id);
  const solved = t => page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:t || 15000 }).then(() => true).catch(() => false);
  // 1) Grundstufe: eintippen, Hervorhebung, Fehlertext, Status
  await go('a2_klammer'); await page.waitForTimeout(300);
  ok(await page.locator('#symBar button', { hasText:'UN' }).count() >= 1, 'Symbolleiste mit AWL-Anweisungen');
  await page.click('#codeEditor'); await page.keyboard.press('Control+A'); await page.keyboard.type('U  S_Walzen\nA  Pumpe_1\n=  Walzen');
  await page.waitForTimeout(900);
  const st = await page.textContent('#editorStatus');
  ok(/UND „U“/.test(st), 'Fehlertext erklärt englische Mnemonik: ' + st.trim());
  ok(await page.locator('#editorHighlight .tok-keyword').count() >= 2, 'AWL-Anweisungen hervorgehoben');
  await page.evaluate(() => SCLQuest.editor.setValue('U  S_Walzen\nO  Pumpe_1\nO  Pumpe_2\n=  Walzen'));
  await page.click('#compileBtn'); await page.waitForTimeout(1500);
  ok(await page.locator('#awlStatus .awl-srow').count() >= 3, 'Statusspalte nach dem Test sichtbar');
  ok(await page.locator('#awlStatus .awl-st-v.on').count() + await page.locator('#awlStatus .awl-st-v:not(.on):not(.none)').count() >= 3, 'VKE-Werte in der Statusspalte');
  await page.locator('.editor-card').screenshot({ path: __dirname + '/shots/awl_ui_status.png' });
  await page.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  ok(await solved(), 'Klammer-Aufgabe gelöst');
  // 2) Akku-Status
  await go('a8_minus'); await page.waitForTimeout(300);
  await page.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution.replace('L  Dicke_aus', 'L  Dicke_ein')); SCLQuest.compile(); });
  await page.waitForTimeout(1500);
  ok(await page.locator('#awlStatus .awl-st-a').count() >= 3, 'AKKU1 in der Statusspalte');
  ok(await page.locator('#awlStatus .awl-st-b').count() >= 2, 'AKKU2 in der Statusspalte');
  // 3) Sprünge: übersprungene Zeilen ohne Status
  await go('a10_spbn'); await page.waitForTimeout(300);
  await page.evaluate(() => { SCLQuest.editor.setValue('U  S_Temp\nSPB ENDE\nL  Temp\nT  Anzeige\nENDE: NOP 0'); SCLQuest.compile(); });
  await page.waitForTimeout(2000);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#awlStatus .awl-srow')].map(r => +r.dataset.line));
  ok(rows.includes(1) && rows.includes(2), 'Status für ausgeführte Zeilen: ' + rows.join(','));
  // 4) Profi: CALL und Beobachten mit Statustabelle
  await go('ap12_boss'); await page.waitForTimeout(300);
  ok(await page.locator('.ptab[data-block]').count() >= 2, 'Baustein-Tabs');
  await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.setProCodes(ProTask.refCodes(t)); SCLQuest.compile(); });
  ok(await solved(25000), 'Profi-Boss mit Referenz gelöst');
  await page.evaluate(() => SCLQuest.openObserve()); await page.waitForTimeout(400);
  ok(await page.locator('#observeBody .awl-static').count() >= 1, 'Beobachten zeigt AWL mit Status');
  ok(!/_q\w/.test(await page.textContent('#observeBody')), 'keine Hilfsvariablen in Beobachten');
  await page.screenshot({ path: __dirname + '/shots/awl_ui_observe.png' });
  await page.evaluate(() => { document.getElementById('observeModal') && document.getElementById('observeModal').classList.remove('active'); });
  // 5) Profi-Fehlermeldung
  await go('ap11_boss'); await page.waitForTimeout(300);
  await page.evaluate(() => SCLQuest.setProCodes({ FC_Geruest: SCLQuest.pro.t.project.blocks.find(b => b.name === 'FC_Geruest').ref.replace('U  #Gitter_zu', 'U  #Gitter_auf') }));
  await page.waitForTimeout(700);
  const st2 = await page.textContent('#editorStatus');
  ok(/#Gitter_auf/.test(st2), 'Profi-Fehler nennt die lokale Variable: ' + st2.trim());
  // 6) Handy
  await page.setViewportSize({ width:390, height:844 });
  await go('a5_boss'); await page.waitForTimeout(400);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 392, 'keine waagrechte Verschiebung auf 390 px (scrollWidth ' + sw + ')');
  await page.evaluate(() => { SCLQuest.editor.setValue(SCLQuest.session.task.refSolution); SCLQuest.compile(); });
  await solved(20000);
  await page.screenshot({ path: __dirname + '/shots/awl_ui_mobile.png', fullPage:true });
  const bad = errors.filter(e => !/net::/.test(e));
  ok(!bad.length, 'keine JS-Fehler ' + bad.join('\n'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
