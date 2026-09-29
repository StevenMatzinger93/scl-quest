// Editor nach TIA-Vorbild (Paket 5.1): Palette mit Ordnern und Favoriten, Platzhalter <??.?>, Operand eintippen mit Vorschlägen, ✱ = Eingang, Klick auf Pin = negieren, Kontextmenü
const { open } = require('./pw.js');
(async () => {
  let fails = 0; const ok = (c, m) => { if(!c){ fails++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
  for(const [file, flavor] of [['fup.html', 'fup'], ['kop.html', 'kop']]){
    const { browser, page, errors } = await open({ file });
    await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForTimeout(300);
    await page.fill('#playerName', 'Test'); await page.click('#newGameBtn');
    await page.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; SCLQuest.state.basicCert = true; SCLQuest.state.settings.speed = 0.03; });
    const id = flavor === 'fup' ? 'f1_und' : 'k1_und';
    const tid = await page.evaluate(([f]) => { const t = SCLQuest.TASKS.find(x => /^(f1_und|k1_und)$/.test(x.id)) || SCLQuest.TASKS.find(x => !x.pro && / AND /.test(x.refSolution)); return t.id; }, [flavor]);
    await page.evaluate(i => { document.querySelectorAll('.overlay,#levelIntroOverlay,#theoryOverlay').forEach(o => o.style.display = 'none'); document.getElementById('titleScreen').style.display = 'none'; document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === i), false); }, tid);
    await page.waitForTimeout(400);
    const ref = await page.evaluate(() => SCLQuest.session.task.refSolution);
    const m = /\n(\w+) AND (\w+) => (\w+);/.exec(ref);
    const F = flavor.toUpperCase();
    ok(!!m, F + ': Referenz hat die Form A AND B => Q (' + tid + ')');
    if(!m){ await browser.close(); continue; }
    await page.evaluate(() => SCLQuest.editor.setValue('NETWORK Test\n? => ?;')); await page.waitForTimeout(200);
    // Favoritenleiste und Palette
    ok(await page.locator('.kop-fav .pal-fav').count() >= 5, F + ': Favoritenleiste');
    await page.click('.kop-palbtn'); ok(await page.locator('.kop-paltree details').count() >= 5 && await page.isVisible('#kopPalTree'), F + ': Palette mit Ordnern');
    const n0 = await page.locator('.kop-fav .pal-fav').count();
    await page.click('.pal-star[data-fav="cmp"]'); ok(await page.locator('.kop-fav .pal-fav').count() === n0 + 1, F + ': Favorit hinzufügen');
    ok(await page.evaluate(k => (localStorage.getItem('spsq_pal_fav_' + k) || '').includes('cmp'), flavor), F + ': Favoriten bleiben gespeichert');
    await page.click('.pal-star[data-fav="cmp"]'); await page.click('.kop-palbtn');
    // Anweisung ins Netzwerk ziehen → leere Box mit Platzhaltern
    await page.dragAndDrop('.kop-fav .fpal[data-act="ser"]', '.kop-net .kop-scroll', { targetPosition: { x: 300, y: 8 } });
    await page.waitForTimeout(200);
    if(flavor === 'fup') ok((await page.locator('#kopCanvas svg text.kred').allTextContents()).filter(t => t === '<??.?>').length >= 2, F + ': leere Box mit Platzhaltern <??.?>');
    else ok(await page.locator('#kopCanvas [data-kind="e"]').count() >= 2, F + ': zweiter Kontakt eingefügt');
    // Operand direkt eintippen mit Vorschlag
    await page.click('#kopCanvas .khit[data-kind="e"]');
    await page.keyboard.type(m[1].slice(0, 3));
    ok(await page.isVisible('.kop-inline .kop-inp') && await page.locator('.kop-sug li').count() >= 1, F + ': Eintippen öffnet Feld mit Vorschlägen');
    await page.keyboard.press('Enter');
    let v = await page.evaluate(() => SCLQuest.editor.getValue());
    ok(v.includes(m[1]), F + ': Operand 1 = ' + m[1] + ' (' + JSON.stringify(v) + ')');
    // zweiter Operand per Doppelklick + Tippen
    const second = flavor === 'fup' ? await page.locator('#kopCanvas .khit[data-kind="e"]').nth(1) : await page.locator('#kopCanvas .khit[data-kind="e"]').nth(1);
    await second.dblclick(); await page.keyboard.type(m[2]); await page.keyboard.press('Enter');
    v = await page.evaluate(() => SCLQuest.editor.getValue()); ok(v.includes(m[1]) && v.includes(m[2]), F + ': Operand 2 per Doppelklick: ' + JSON.stringify(v));
    // Ausgang eintippen
    await page.click('#kopCanvas .khit[data-kind="o"]'); await page.keyboard.type(m[3]); await page.keyboard.press('Tab');
    v = await page.evaluate(() => SCLQuest.editor.getValue()); ok(v.includes('=> ' + m[3]) || v.includes(m[3]), F + ': Ausgang eingetippt');
    ok(v.includes(m[1] + ' AND ' + m[2] + ' => ' + m[3] + ';'), F + ': komplettes Netzwerk nur per Tippen: ' + JSON.stringify(v));
    await page.screenshot({ path: __dirname + '/shots/editor_' + flavor + '.png' });
    if(flavor === 'fup'){
      // ✱ = Eingang hinzufügen
      const c0 = await page.locator('#kopCanvas .khit[data-kind="e"]').count();
      await page.click('#kopCanvas .kstar');
      ok(await page.locator('#kopCanvas .khit[data-kind="e"]').count() === c0 + 1 || (await page.evaluate(() => SCLQuest.editor.getValue())).split('AND').length === 3, F + ': ✱ fügt einen Eingang hinzu');
      await page.click('#kopTools .fpal[data-act="del"]').catch(() => {});
      // Klick auf den Anschluss negiert
      await page.evaluate(([a, b, q]) => SCLQuest.editor.setValue('NETWORK Test\n' + a + ' AND ' + b + ' => ' + q + ';'), m.slice(1));
      await page.waitForTimeout(250);
      await page.click('#kopCanvas .kpin >> nth=0', { force: true });
      v = await page.evaluate(() => SCLQuest.editor.getValue()); ok(/NOT/.test(v), F + ': Klick auf den Anschluss negiert: ' + JSON.stringify(v));
      await page.click('#kopCanvas .kpin >> nth=0', { force: true });
      ok(!/NOT/.test(await page.evaluate(() => SCLQuest.editor.getValue())), F + ': zweiter Klick nimmt die Negation zurück');
    }
    // Kontextmenü
    await page.click('#kopCanvas .khit[data-kind="e"]', { button: 'right' });
    ok(await page.isVisible('.kop-menu') && await page.locator('.kop-menu button').count() >= 3, F + ': Rechtsklick öffnet das Kontextmenü');
    await page.keyboard.press('Escape'); ok(!(await page.locator('.kop-menu').count()), F + ': Escape schliesst das Menü');
    // Lösen
    await page.evaluate(([a, b, q]) => SCLQuest.editor.setValue('NETWORK Test\n' + a + ' AND ' + b + ' => ' + q + ';'), m.slice(1));
    await page.click('#compileBtn'); ok(await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout: 15000 }).then(() => true).catch(() => false), F + ': Aufgabe gelöst');
    ok(errors.length === 0, F + ': keine JS-Fehler' + (errors.length ? ' – ' + errors[0] : ''));
    await browser.close();
  }
  console.log(fails ? fails + ' FEHLER' : 'Editor-UI: alles bestanden');
  process.exit(fails ? 1 : 0);
})();
