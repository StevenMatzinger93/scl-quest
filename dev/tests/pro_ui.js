const fs0 = require('fs'); fs0.mkdirSync(__dirname + '/shots', { recursive:true });
// Profi-Stufe UI-Smoke: Aufgaben laden, Referenz einsetzen, testen, Tabelle, Beobachten, Export
const { open } = require('./pw.js');
(async () => {
  const { browser, page, errors } = await open();
  await page.click('#newGameBtn');
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; });
  await page.waitForTimeout(300);
  const ids = await page.evaluate(() => SCLQuest.TASKS.filter(t => t.pro).map(t => t.id));
  console.log('pro tasks', ids.length);
  const shots = process.argv.includes('--shots');
  for(const id of ids){
    const r = await page.evaluate(async (id) => {
      const t = SCLQuest.TASKS.find(x => x.id === id);
      document.getElementById('levelIntroOverlay').style.display = 'none'; document.getElementById('theoryOverlay').style.display = 'none';
      document.getElementById('app').style.display = '';
      SCLQuest.renderTask(t, true);
      const st1 = document.getElementById('editorStatus').textContent;
      SCLQuest.setProCodes(ProTask.refCodes(t));
      SCLQuest.compile();
      await new Promise(r => setTimeout(r, 50));
      return { ok: SCLQuest.session.solved, st1, title: document.getElementById('reportTitle').textContent, tabs: document.querySelectorAll('.ptab').length };
    }, id);
    if(!r.ok) console.log('FAIL', id, JSON.stringify(r));
  }
  // Tabelle in p12_skalieren
  const tb = await page.evaluate(async () => {
    const t = SCLQuest.TASKS.find(x => x.id === 'p12_skalieren');
    SCLQuest.renderTask(t, true);
    document.getElementById('tableToggleBtn').click();
    const rows0 = document.querySelectorAll('#declPanel tbody tr').length;
    document.getElementById('declAddBtn').click();
    const tr = document.querySelector('#declPanel tbody tr:last-child');
    tr.querySelector('[data-f=name]').value = 'Roh'; tr.querySelector('[data-f=type]').value = 'Int';
    tr.querySelector('[data-f=name]').dispatchEvent(new Event('change', {bubbles:true}));
    const code = SCLQuest.pro.codes.FC_Skalieren;
    document.getElementById('tableToggleBtn').click();
    return { rows0, has: /Roh : Int;/.test(code), editor: SCLQuest.editor.getValue().includes('Roh : Int;') };
  });
  console.log('table', JSON.stringify(tb));
  // Fehlversuch + Beobachten
  const ob = await page.evaluate(async () => {
    const t = SCLQuest.TASKS.find(x => x.id === 'p11_temp_dbg');
    SCLQuest.renderTask(t, true);
    SCLQuest.compile();
    await new Promise(r => setTimeout(r, 50));
    document.getElementById('observeBtn').click();
    const n = document.querySelectorAll('.obs-block').length, temp = document.querySelectorAll('.obs-var.temp').length;
    document.getElementById('obsNext').click();
    return { n, temp, open: document.getElementById('observeModal').classList.contains('active'), warn: document.getElementById('reportBody').textContent.includes('MUSS VERSCHWINDEN') };
  });
  console.log('observe', JSON.stringify(ob));
  if(shots){ await page.screenshot({ path:__dirname + '/shots/obs.png' }); }
  await page.evaluate(() => document.querySelector('[data-close=observeModal]').click());
  // Export
  const [dl] = await Promise.all([ page.waitForEvent('download', { timeout:5000 }).catch(() => null), page.evaluate(() => { const t = SCLQuest.TASKS.find(x => x.id === 'p15_final'); SCLQuest.renderTask(t, true); SCLQuest.setProCodes(ProTask.refCodes(t)); SCLQuest.exportPro(); }) ]);
  console.log('download', dl ? dl.suggestedFilename() : null);
  if(dl){ await dl.saveAs('' + __dirname + '/shots/export.zip'); }
  if(shots){
    await page.evaluate(() => { const t = SCLQuest.TASKS.find(x => x.id === 'p15_final'); SCLQuest.renderTask(t, true); SCLQuest.setProCodes(ProTask.refCodes(t)); SCLQuest.compile(); });
    await page.waitForTimeout(2500); await page.screenshot({ path:__dirname + '/shots/final.png' });
    await page.evaluate(() => { const t = SCLQuest.TASKS.find(x => x.id === 'p13_boss'); SCLQuest.renderTask(t, false); document.getElementById('tableToggleBtn').click(); });
    await page.waitForTimeout(300); await page.screenshot({ path:__dirname + '/shots/table.png' });
  }
  console.log('errors', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
