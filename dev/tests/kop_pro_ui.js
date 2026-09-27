// KOP Quest Profi-Oberfläche: Baustein-Tabs, Netzwerk-Editor im Baustein, Tabelle, Aufruf-Box per Klick
const { open } = require('./pw.js');
(async () => {
  const { browser, page, errors } = await open({ file:'kop.html' });
  let fails = 0; const ok = (c, m) => { if(!c){ fails++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#playerName', 'Test'); await page.click('#newGameBtn');
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.state.basicCert = true; SCLQuest.state.settings.speed = 0.03; });
  const go = id => page.evaluate(id => { document.querySelectorAll('.overlay,#levelIntroOverlay,#theoryOverlay').forEach(o => o.style.display = 'none'); document.getElementById('titleScreen').style.display = 'none'; document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS.find(t => t.id === id)); }, id);
  // 1) erste FC: Netzwerk per Klick
  await go('k11_erste_fc'); await page.waitForTimeout(300);
  ok(await page.locator('.ptab[data-block]').count() >= 2, 'Baustein-Tabs');
  ok(await page.locator('.var-chip[data-name="#Tuer_Zu"]').count() === 1, 'lokale Variable #Tuer_Zu in der Liste');
  await page.click('.kop-addnet');
  await page.click('.khit[data-kind="e"]'); await page.click('.var-chip[data-name="#Tuer_Zu"]');
  for(const v of ['#Seil_OK', '#Not_Halt_OK']){ await page.click('#kopTools [data-act="ser"]'); await page.click('.var-chip[data-name="' + v + '"]'); }
  await page.click('.khit[data-kind="o"]'); await page.click('.var-chip[data-name="#Freigabe"]');
  const code = await page.evaluate(() => SCLQuest.pro.codes.FC_Freigabe);
  ok(/BEGIN\nNETWORK[^\n]*\n#Tuer_Zu AND #Seil_OK AND #Not_Halt_OK => #Freigabe;\nEND_FUNCTION/.test(code), 'Baustein-Text mit Netzwerk: ' + JSON.stringify(code.split('BEGIN')[1]));
  await page.screenshot({ path: __dirname + '/shots/kop_pro_fc.png' });
  await page.click('#compileBtn');
  ok(await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:15000 }).then(() => true).catch(() => false), 'FC per Klick gelöst');
  // 2) Aufruf-Box per Klick in Main
  await go('k11_aufruf'); await page.waitForTimeout(300);
  await page.click('.ptab[data-block="Main"]');
  await page.click('.kop-addnet');
  await page.click('.khit[data-kind="e"]'); await page.click('#kopTools [data-act="rail"]');
  await page.click('.khit[data-kind="o"]'); await page.click('#kopTools [data-act="call"]');
  await page.click('.var-chip[data-name="\\"FC_Freigabe\\""]');
  ok(await page.locator('#kopProps [data-k="arg"]').count() === 4, 'Aufruf-Box zeigt 4 Parameter');
  for(const [n, v] of [['Tuer_Zu', '"Tuer_Zu"'], ['Seil_OK', '"Seil_OK"'], ['Not_Halt_OK', '"Not_Halt_OK"'], ['Freigabe', '"Freigabe"']]){
    await page.fill('#kopProps [data-k="arg"][data-n="' + n + '"]', v); await page.press('#kopProps [data-k="arg"][data-n="' + n + '"]', 'Enter');
  }
  const main = await page.evaluate(() => SCLQuest.pro.codes.Main);
  ok(main.includes('=> "FC_Freigabe"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Freigabe => "Freigabe");'), 'Aufruf im Text: ' + main.split('BEGIN')[1]);
  await page.screenshot({ path: __dirname + '/shots/kop_pro_call.png' });
  await page.click('#compileBtn');
  ok(await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:15000 }).then(() => true).catch(() => false), 'Aufruf per Klick gelöst');
  // 3) Tabelle: Schnittstelle anlegen
  await go('k11_schnittstelle'); await page.waitForTimeout(300);
  await page.click('#tableToggleBtn'); await page.waitForSelector('#declAddBtn');
  const addRow = async (sec, name, type) => {
    await page.click('#declAddBtn');
    const tr = page.locator('#declPanel tbody tr').last();
    await tr.locator('[data-f="sec"]').selectOption(sec); await tr.locator('[data-f="type"]').fill(type); await tr.locator('[data-f="name"]').fill(name); await tr.locator('[data-f="name"]').press('Tab');
  };
  await addRow('Input', 'Wind_kmh', 'Int'); await addRow('Input', 'Grenze', 'Int'); await addRow('Output', 'Wind_Stopp', 'Bool');
  await page.screenshot({ path: __dirname + '/shots/kop_pro_table.png' });
  await page.click('#tableToggleBtn');
  ok(await page.locator('.kop-net').count() === 1, 'Netzwerk nach Tabelle weiter sichtbar');
  await page.click('#compileBtn');
  ok(await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:15000 }).then(() => true).catch(() => false), 'Schnittstelle per Tabelle gelöst');
  // 4) Fehlermeldung zeigt Netzwerk
  await go('k11_boss'); await page.waitForTimeout(300);
  await page.evaluate(() => SCLQuest.setProCodes({ FC_Station: SCLQuest.pro.t.project.blocks[0].ref.replace('#Freigabe AND #S_Start', '#Freigabe AND #S_Stop') }));
  await page.waitForTimeout(600);
  const st = await page.textContent('#editorStatus');
  ok(/Netzwerk 2/.test(st), 'Fehler nennt Netzwerk: ' + st.trim());
  await page.screenshot({ path: __dirname + '/shots/kop_pro_err.png' });
  // 5) Beobachten: Netzwerke mit Stromfluss, keine Hilfsvariablen
  await go('k14_boss'); await page.waitForTimeout(300);
  await page.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.setProCodes(ProTask.refCodes(t)); SCLQuest.compile(); });
  await page.waitForSelector('#successCard:not([style*="display: none"])', { timeout:20000 });
  await page.evaluate(() => SCLQuest.openObserve()); await page.waitForTimeout(300);
  ok(await page.locator('#observeBody .obs-kop svg.kop-svg').count() >= 1, 'Beobachten zeigt Netzwerke');
  ok(!/_f\d+_\d+/.test(await page.textContent('#observeBody')), 'keine Hilfsvariablen in Beobachten');
  ok(await page.locator('#observeBody .obs-kop line.kw.on').count() > 0, 'Stromfluss eingefärbt');
  await page.screenshot({ path: __dirname + '/shots/kop_pro_observe.png' });
  const bad = errors.filter(e => !/net::/.test(e));
  ok(!bad.length, 'keine JS-Fehler ' + bad.join('\n'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
