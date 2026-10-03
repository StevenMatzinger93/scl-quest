// Feedback-Auftrag 5.1: FUP-/KOP-Editor nach TIA-Vorbild – Anweisungs-Palette mit Ordnern + Favoriten, Platzhalter <??.?>,
// Operand in der Box eintippen (Autovervollständigung), „*“ = Eingang hinzufügen, Klick auf den Anschluss = negieren, Rechtsklick-Menü.
const { open } = require('./pw.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } };
(async () => {
  for(const f of ['fup.html', 'kop.html']){
    const q = f.replace('.html', '');
    const { browser, page: P, errors } = await open({ file: f === 'fup.html' ? 'fup.html?werkbank=0' : f, viewport: { width: 1366, height: 860 }, dpr: 1 });   // bisheriger Editor; Werkbank: tests/fup_wb_quest.js
    await P.evaluate(() => localStorage.setItem(window.QUEST.key, JSON.stringify({ v: 4, pos: 0, settings: { sound: false, speed: 0.03 } })));
    await P.reload(); await P.waitForTimeout(300); await P.fill('#playerName', 'TIA'); await P.click('#newGameBtn');
    await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; document.querySelectorAll('.overlay, #levelIntroOverlay, #theoryOverlay').forEach(e => e.style.display = 'none'); document.getElementById('app').style.display = '';
      const t = SCLQuest.TASKS.find(t => !t.pro && t.level === 2); SCLQuest.renderTask(t, false); SCLQuest.editor.setValue('NETWORK Test\n? => ?;\n'); });
    await P.waitForSelector('#kopCanvas .kop-net');
    const text = () => P.evaluate(() => SCLQuest.editor.getValue());
    // PLC-Variablen wie im TIA Portal: Name · Adresse · Datentyp · Kommentar
    const tags = await P.evaluate(() => ({ head: [...document.querySelectorAll('#varList .plc-tags th')].map(x => x.textContent).join('|'), rows: [...document.querySelectorAll('#varList .plc-tags tbody tr')].map(r => [...r.children].map(c => c.textContent)) }));
    ok(tags.head === 'Name|Adresse|Datentyp|Kommentar' && tags.rows.length > 0 && tags.rows.every(r => /^%[IQM]|IEC|Daten/.test(r[1]) && r[3].length > 2), q + ': PLC-Variablen mit Adresse und Kommentar (' + tags.rows.map(r => r[0] + ' ' + r[1]).join(', ') + ')');
    await P.screenshot({ path: __dirname + '/shots/tia_' + q + '.png' });
    // Platzhalter
    ok(await P.evaluate(() => document.querySelector('#kopCanvas').textContent.includes('<??.?>')), q + ': offener Operand als <??.?>');
    // Palette mit Ordnern
    await P.click('[data-lib]'); await P.waitForSelector('#kopLib:not([hidden])');
    const folders = await P.$$eval('#kopLib details summary', s => s.map(x => x.textContent));
    ok(folders.length >= 7 && folders.some(x => /Zeiten/.test(x)) && folders.some(x => /Mathematik/.test(x)), q + ': Anweisungs-Palette mit ' + folders.length + ' Ordnern');
    ok(await P.locator('#kopTools .kop-libbtn').count() === 1, q + ': Favoritenleiste mit Knopf „Anweisungen“');
    // Operand eintippen (Doppelklick) mit Autovervollständigung
    const v1 = await P.evaluate(() => { const c = document.querySelector('#varList .var-chip'); return c ? c.dataset.name : 'X'; });
    await P.dblclick('#kopCanvas .khit[data-kind="e"]');
    await P.waitForSelector('.kop-inline input');
    ok(await P.evaluate(() => document.querySelectorAll('#kopInlineVars option').length > 0), q + ': Eintippen mit Vorschlagsliste (PLC-Variablen)');
    await P.fill('.kop-inline input', v1); await P.press('.kop-inline input', 'Enter');
    ok((await text()).includes(v1), q + ': Operand „' + v1 + '“ direkt in der Box eingetippt');
    if(q === 'fup'){
      // UND-Box aus der Palette, dann Stern = weiterer Eingang, Pin-Klick = negieren
      await P.click('#kopCanvas .khit[data-kind="e"]'); await P.click('#kopLib [data-act="ser"]');
      const n0 = await P.evaluate(() => (SCLQuest.editor.getValue().match(/\?/g) || []).length);
      await P.click('#kopCanvas [data-pin="addin"]');
      const n1 = await P.evaluate(() => (SCLQuest.editor.getValue().match(/\?/g) || []).length);
      ok(n1 === n0 + 1, q + ': „*“ fügt einen Eingang hinzu');
      await P.click('#kopCanvas [data-pin="neg"]');
      ok(/NOT /.test(await text()), q + ': Klick auf den Anschluss negiert den Eingang');
      // TOF aus dem Ordner „Zeiten“
      await P.click('#kopCanvas .khit[data-kind="e"]'); await P.click('#kopLib [data-act="tof"]');
      ok(/TOF\(/.test(await text()), q + ': TOF aus dem Ordner „Zeiten“ eingefügt');
    }
    // Rechtsklick-Menü
    await P.click('#kopCanvas .khit[data-kind="o"]', { button: 'right' });
    await P.waitForSelector('.kop-ctx');
    const items = await P.$$eval('.kop-ctx button', b => b.map(x => x.textContent));
    ok(items.length >= 4 && items.some(x => /Operand eingeben/.test(x)), q + ': Rechtsklick-Menü mit ' + items.length + ' Befehlen');
    await P.click('.kop-ctx [data-ctx="set"]');
    ok(/=> S /.test(await text()), q + ': Rechtsklick → Setzen');
    ok(!errors.length, q + ': keine JS-Fehler' + (errors.length ? ' ' + errors.slice(0, 2).join(' | ') : ''));
    await browser.close();
  }
  console.log('Editor nach TIA-Vorbild: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
