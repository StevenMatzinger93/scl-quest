// Screenshots der Visualisierung (Paket W4/W5): je Modul bei 1366×768, 1920×1080 und 390 px → tests/shots/visual/. Läuft ohne Server (Demo-Seite).
// node tests/visual_shots.js [--quick]   (quick: nur Modul 1 und 4)
const fs = require('fs'), path = require('path');
const { open } = require('./pw.js');
const OUT = path.join(__dirname, 'shots', 'visual'); fs.mkdirSync(OUT, { recursive: true });
const QUICK = process.argv.includes('--quick');
(async () => {
  const { browser, page: P, errors } = await open({ file: 'dev/demo_visual.html', viewport: { width: 1366, height: 768 } });
  await P.waitForSelector('#wiring .sw25-part');
  const mods = QUICK ? ['1', '4'] : ['1', '2', '3', '4', '5', '6'];
  for(const [w, h, tag] of [[1366, 768, '1366'], [1920, 1080, '1920'], [390, 844, '390']]){
    await P.setViewportSize({ width: w, height: h });
    for(const m of mods){
      await P.selectOption('#selModule', m); await P.selectOption('#selState', 'halb').catch(() => {}); await P.selectOption('#selPlant', 'laeuft').catch(() => {});
      await P.waitForTimeout(500);
      await P.screenshot({ path: path.join(OUT, 'modul' + m + '_' + tag + '.png') });
      const sw = await P.evaluate(() => document.documentElement.scrollWidth);
      if(sw > w) console.log('✗ waagrechtes Scrollen bei ' + tag + ' px, Modul ' + m + ' (' + sw + ')');
    }
  }
  // Anlage gross und klein (Modul 1 und 4)
  await P.setViewportSize({ width: 1366, height: 768 });
  for(const [m, st] of [['1', 'laeuft'], ['4', 'heizt']]){ await P.selectOption('#selModule', m); await P.selectOption('#selPlant', st); await P.waitForTimeout(600); await P.locator('#plant').screenshot({ path: path.join(OUT, 'anlage_modul' + m + '_gross.png') }); }
  await P.check('#chkSmall'); await P.waitForTimeout(600); await P.locator('#plant').screenshot({ path: path.join(OUT, 'anlage_klein.png') });
  console.log((errors.length ? 'JS-Fehler: ' + errors.slice(0, 3).join(' | ') : 'keine JS-Fehler') + ' · Screenshots in tests/shots/visual/');
  await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
