// Erzeugt die Bilder der Anlagen für den Beamer: node make_scene_images.js  → assets/scene_<quest>.png
// Läuft gegen die gebauten Spiele (../index.html, ../kop.html …) mit Playwright; das Ergebnis wird eingecheckt und vom Build nach web/data/ kopiert.
const fs = require('fs'), path = require('path');
const { open } = require('./tests/pw.js');
const TARGETS = [['scl', 'index.html', '#sceneStageWrap', 12], ['kop', 'kop.html', '#sceneStageWrap', 20], ['fup', 'fup.html', '#sceneStageWrap', 20], ['awl', 'awl.html', '#sceneStageWrap', 20], ['sensor', 'sensor.html', '#wsHost canvas', 2]];
(async () => {
  for(const [key, file, sel, idx] of TARGETS){
    const { browser, page, errors } = await open({ file, viewport: { width: 1200, height: 800 }, dpr: 1.5 });
    try{
      await page.evaluate(() => { try{ localStorage.clear(); }catch(e){} });
      await page.reload(); await page.waitForTimeout(300);
      if(key === 'sensor') await page.fill('#playerName', 'Bild');
      await page.click('#newGameBtn');
      await page.evaluate(i => { SCLQuest.state.tours = { basic: true, pro: true }; document.getElementById('levelIntroOverlay').style.display = 'none'; document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASKS[i]); }, idx);
      await page.waitForTimeout(key === 'sensor' ? 2500 : 900);
      await page.evaluate(() => { const r = document.getElementById('radioPop'); if(r) r.style.display = 'none'; if(window.SCLQuest && SCLQuest.sensor && SCLQuest.sensor.view) try{ SCLQuest.sensor.view(2); }catch(e){} });
      await page.waitForTimeout(400);
      const el = await page.$(sel);
      const out = path.join(__dirname, 'assets', 'scene_' + key + '.png');
      await el.screenshot({ path: out });
      console.log(key, fs.statSync(out).size + ' Byte', errors.length ? errors.slice(0, 2).join(' | ') : '');
    }catch(e){ console.log(key, 'FEHLER', e.message.split('\n')[0]); }
    await browser.close();
  }
})();
