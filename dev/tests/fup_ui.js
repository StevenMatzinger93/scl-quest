// FUP Quest: Funktionsplan-Editor — Ziehen + Verbinden (Palette und Variablen), Profi-Bausteine, Aufruf-Box, Beobachten, Handy-Breite
const { open } = require('./pw.js');
(async () => {
  const { browser, page, errors } = await open({ file:'fup.html' });
  let fails = 0; const ok = (c, m) => { if(!c){ fails++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#playerName', 'Test'); await page.click('#newGameBtn');
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.state.basicCert = true; SCLQuest.state.settings.speed = 0.03; });
  const go = id => page.evaluate(id => { document.querySelectorAll('.overlay,#levelIntroOverlay,#theoryOverlay').forEach(o => o.style.display = 'none'); document.getElementById('titleScreen').style.display = 'none'; document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === id)); }, id);
  const chip = n => '.var-chip[data-name="' + n.replace(/"/g, '\\"') + '"]';
  const solved = t => page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:t || 15000 }).then(() => true).catch(() => false);
  // 1) Grundstufe: Netzwerk nur per Ziehen bauen
  await go('f1_und'); await page.waitForTimeout(300);
  const ref1 = await page.evaluate(() => SCLQuest.session.task.refSolution);
  const m1 = /\n(\w+) AND (\w+) => (\w+);/.exec(ref1);
  ok(!!m1, 'Referenz f1_und hat die Form A AND B => Q');
  if(m1){
    await page.evaluate(() => SCLQuest.editor.setValue('NETWORK Test\n? => ?;'));
    await page.waitForTimeout(200);
    await page.dragAndDrop(chip(m1[1]), '.khit[data-kind="e"]');
    await page.dragAndDrop('#kopTools .fpal[data-act="ser"]', '.khit[data-kind="e"]');
    await page.dragAndDrop(chip(m1[2]), '.khit.ksel[data-kind="e"]');
    await page.dragAndDrop(chip(m1[3]), '.khit[data-kind="o"]');
    const v = await page.evaluate(() => SCLQuest.editor.getValue());
    ok(v.includes(m1[1] + ' AND ' + m1[2] + ' => ' + m1[3] + ';'), 'Netzwerk per Ziehen: ' + JSON.stringify(v));
    ok(await page.locator('#kopCanvas svg.fup-svg').count() >= 1, 'Funktionsplan (Boxen) statt Leiterbild');
    await page.screenshot({ path: __dirname + '/shots/fup_ui_drag.png' });
    await page.click('#compileBtn');
    ok(await solved(), 'Aufgabe per Ziehen gelöst');
  }
  // 2) Profi: FC-Netzwerk per Ziehen, drei Eingänge an einer &-Box
  await go('fp11_erste_fc'); await page.waitForTimeout(300);
  ok(await page.locator('.ptab[data-block]').count() >= 2, 'Baustein-Tabs');
  await page.click('.kop-addnet');
  await page.dragAndDrop(chip('#Taste'), '.khit[data-kind="e"]');
  for(const v of ['#Gleis_frei', '#Weiche_Endlage']){
    await page.dragAndDrop('#kopTools .fpal[data-act="ser"]', '.khit.ksel[data-kind="e"]');
    await page.dragAndDrop(chip(v), '.khit.ksel[data-kind="e"]');
  }
  await page.dragAndDrop(chip('#Fahrt'), '.khit[data-kind="o"]');
  const code = await page.evaluate(() => SCLQuest.pro.codes.FC_Signal);
  ok(/BEGIN\nNETWORK[^\n]*\n#Taste AND #Gleis_frei AND #Weiche_Endlage => #Fahrt;\nEND_FUNCTION/.test(code), 'Baustein-Text: ' + JSON.stringify(code.split('BEGIN')[1]));
  await page.screenshot({ path: __dirname + '/shots/fup_ui_fc.png' });
  await page.click('#compileBtn');
  ok(await solved(), 'FC per Ziehen gelöst');
  // 3) Aufruf-Box: „immer“ und „Aufruf“ aus der Palette ziehen
  await go('fp11_aufruf'); await page.waitForTimeout(300);
  await page.click('.ptab[data-block="Main"]');
  await page.click('.kop-addnet');
  await page.click('.khit[data-kind="e"]');
  await page.click('#kopTools .fpal[data-act="rail"]');
  await page.click('.khit[data-kind="o"]');
  await page.dragAndDrop('#kopTools .fpal[data-act="call"]:not([disabled])', '.khit[data-kind="o"]');
  await page.click(chip('"FC_Signal"'));
  ok(await page.locator('#kopProps [data-k="arg"]').count() === 4, 'Aufruf-Box zeigt 4 Parameter');
  for(const [n, v] of [['Taste', '"Taste_A"'], ['Gleis_frei', '"Gleis1_frei"'], ['Weiche_Endlage', '"W1_Endlage"'], ['Fahrt', '"Signal_A"']]){
    await page.fill('#kopProps [data-k="arg"][data-n="' + n + '"]', v); await page.press('#kopProps [data-k="arg"][data-n="' + n + '"]', 'Enter');
  }
  const main = await page.evaluate(() => SCLQuest.pro.codes.Main);
  ok(main.includes('=> "FC_Signal"(Taste := "Taste_A", Gleis_frei := "Gleis1_frei", Weiche_Endlage := "W1_Endlage", Fahrt => "Signal_A");'), 'Aufruf im Text: ' + main.split('BEGIN')[1]);
  await page.screenshot({ path: __dirname + '/shots/fup_ui_call.png' });
  await page.click('#compileBtn');
  ok(await solved(), 'Aufruf gelöst');
  // 4) Fehlermeldung in FUP-Worten
  await go('fp11_boss'); await page.waitForTimeout(300);
  await page.evaluate(() => SCLQuest.setProCodes({ FC_Einfahrt: SCLQuest.pro.t.project.blocks.find(b => b.name === 'FC_Einfahrt').ref.replace('#Taste_A AND #Gleis1_frei', '#Taste_A AND #Gleis9_frei') }));
  await page.waitForTimeout(600);
  const st = await page.textContent('#editorStatus');
  ok(/Netzwerk 2/.test(st), 'Fehler nennt Netzwerk: ' + st.trim());
  ok(!/Kontakt|Spule|Strompfad/.test(st), 'Fehlertext ohne KOP-Begriffe');
  // 5) Beobachten im Profi-Boss
  await go('fp15_final'); await page.waitForTimeout(300);
  await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.setProCodes(ProTask.refCodes(t)); SCLQuest.compile(); });
  ok(await solved(25000), 'Final Boss 2 mit Referenz gelöst');
  await page.evaluate(() => SCLQuest.openObserve()); await page.waitForTimeout(300);
  ok(await page.locator('#observeBody svg.fup-svg').count() >= 1, 'Beobachten zeigt Funktionsplan');
  ok(!/_f\d+_\d+/.test(await page.textContent('#observeBody')), 'keine Hilfsvariablen in Beobachten');
  await page.screenshot({ path: __dirname + '/shots/fup_ui_observe.png' });
  // 6) Handy-Breite: keine waagrechte Seitenverschiebung
  await page.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none'); });
  await page.setViewportSize({ width:390, height:844 });
  await go('fp14_boss'); await page.waitForTimeout(400);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 392, 'keine waagrechte Verschiebung auf 390 px (scrollWidth ' + sw + ')');
  await page.screenshot({ path: __dirname + '/shots/fup_ui_mobile.png', fullPage:false });
  const bad = errors.filter(e => !/net::/.test(e));
  ok(!bad.length, 'keine JS-Fehler ' + bad.join('\n'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
