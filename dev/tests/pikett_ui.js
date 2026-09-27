// Pikettdienst im Spiel (docs/PLAN_ZERTIFIKAT_PIKETT.md B.8): je Quest eine Tagschicht mit fester Seed-Auswahl im Zeitraffer.
// Programmfehler mit Referenzkorrektur, Hardware- bzw. Bedienfehler per Diagnose, falsche Diagnose = Fehlversuch,
// Schichtbericht, Rang/Punkte lokal, Handy 390 px. Optional: node tests/pikett_ui.js kop  → nur diese Quest
const fs = require('fs'); fs.mkdirSync(__dirname + '/shots', { recursive: true });
const { open } = require('./pw.js');
const FILES = { scl: 'index.html', kop: 'kop.html', fup: 'fup.html', awl: 'awl.html' };
const ONLY = process.argv.slice(2).filter(a => FILES[a]);
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
(async () => {
  for(const q of ONLY.length ? ONLY : Object.keys(FILES)){
    const mobile = q === 'fup';   // eine Quest auf dem Handy
    const { browser, page: P, errors } = await open({ file: FILES[q], viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const KEY = await P.evaluate(() => window.QUEST ? window.QUEST.key : 'sclquest3_state_v4');
    // Spielstand: Kapitel 1–15 gelöst (alle Grundaufgaben der Störungen verfügbar)
    await P.evaluate(k => { const done = {}; SCL_CONTENT.tasks.forEach(t => { done[t.id] = { stars: 3, points: 100, fails: 0, hints: 0, at: Date.now() }; });
      localStorage.setItem(k, JSON.stringify({ v: 4, pos: 0, name: 'Test', doneTasks: done, doneTheory: {}, solutions: {}, drafts: {}, fails: {}, hints: {}, badges: [], seenIntro: [1], tours: { basic: true, pro: true }, settings: { sound: false, motion: true, speed: 0.03, font: 14 } })); }, KEY);
    await P.reload(); await P.waitForSelector('#titlePikettBtn');
    ok(await P.locator('#titlePikettBtn').count() === 1, q + ': Titelbildschirm mit „Pikettdienst“');
    await P.click('#titlePikettBtn'); await P.waitForSelector('#pikettOverlay .pk-shift');
    ok(await P.locator('.pk-shift[data-shift="tag"]:not([disabled])').count() === 1 && await P.locator('.pk-shift[data-shift="nacht"][disabled]').count() === 1, q + ': Tagschicht frei, Nachtschicht gesperrt (Rang Lehrling)');
    // Seed so wählen, dass eine Programm- und eine Hardware- bzw. Bedienstörung vorkommen
    const seed = await P.evaluate(() => { const PK = window.SPSQPikett, pool = SCLQuest.PIKETT.incidents().filter(x => SCLQuest.state.doneTasks[x.base]);
      for(let s = 1; s < 5000; s++){ const pl = PK.plan(pool, 'tag', s), kinds = pl.map(p => pool.find(x => x.id === p.id).kind); if(pl.length === 2 && kinds.includes('program') && kinds.some(k => k !== 'program')) return s; }
      for(let s = 1; s < 500; s++){ if(PK.plan(pool, 'tag', s).length === 2) return s; } return 1; });
    await P.evaluate(s => SCLQuest.PIKETT.start('tag', s, { speed: 12 }), seed);
    await P.waitForSelector('#pikettBar');
    ok(true, q + ': Schicht gestartet (Seed ' + seed + ')');
    const plan = await P.evaluate(() => SCLQuest.PIKETT.shift.plan.map(p => { const i = SCLQuest.PIKETT.incidents().find(x => x.id === p.id); return { id: p.id, kind: i.kind }; }));
    let first = true;
    for(const p of plan){
      await P.waitForFunction(id => SCLQuest.session.pikett && SCLQuest.session.pikett.id === id, p.id, { timeout: 60000 });
      const inc = await P.evaluate(id => SCLQuest.PIKETT.incidents().find(x => x.id === id), p.id);
      if(first){ await P.screenshot({ path: __dirname + '/shots/pikett_' + q + '_alarm.png' }); ok(/Störung/.test(await P.textContent('#taskTags')), q + ': Störungsmeldung ' + inc.alarm.no + ' in der Arbeitsansicht'); }
      // ohne Diagnose: Wiederanfahren verlangt die Diagnose
      if(first){
        await P.click('#compileBtn'); await P.waitForSelector('#confirmModal.active');
        ok(/Diagnose/.test(await P.textContent('#confirmText')), q + ': Wiederanfahren ohne Diagnose öffnet die Diagnose');
        // falsche Diagnose → Fehlversuch
        const wrong = inc.kind === 'program' ? 'hw_estop' : 'prog_logic';
        await P.check('input[name="pkCause"][value="' + wrong + '"]'); await P.click('#confirmYes');
        await P.click('#compileBtn');
        ok(await P.evaluate(id => SCLQuest.PIKETT.shift.items.find(i => i.id === id).fails === 1, p.id), q + ': falsche Diagnose zählt als Fehlversuch');
        first = false;
      }
      await P.click('#pkDiag'); await P.waitForSelector('#confirmModal.active');
      await P.check('input[name="pkCause"][value="' + inc.cause + '"]');
      if(inc.kind === 'hardware') await P.selectOption('#pkPart', inc.part);
      if(inc.kind === 'operator'){ await P.selectOption('#pkPar', inc.param.var); await P.fill('#pkVal', String(inc.param.right)); }
      await P.click('#confirmYes');
      if(inc.kind === 'program') await P.evaluate(() => { const t = SCLQuest.session.task; if(t.pro) SCLQuest.setProCodes(window.ProTask.refCodes(t)); else SCLQuest.editor.setValue(t.refSolution); });
      await P.click('#compileBtn');
      await P.waitForFunction(id => SCLQuest.PIKETT.shift && SCLQuest.PIKETT.shift.items.find(i => i.id === id).fixed, p.id, { timeout: 30000 });
      ok(true, q + ': ' + inc.kind + '-Störung ' + inc.alarm.no + ' behoben');
    }
    await P.click('#pkEnd'); await P.click('#confirmYes');
    await P.waitForSelector('#pikettOverlay .pk-kpis');
    const rep = await P.evaluate(() => SCLQuest.state.pikett.shifts[0]);
    ok(rep.incidents.length === plan.length && rep.incidents.every(i => i.fixed) && rep.points > 0, q + ': Schichtbericht (' + rep.points + ' Punkte, Verfügbarkeit ' + Math.round(rep.availability * 100) + ' %)');
    ok(await P.evaluate(() => SCLQuest.state.pikett.points > 0 && !document.getElementById('pikettBar')), q + ': Punkte im Rang, Leiste weg');
    await P.fill('#pkHand', 'Band 2 beobachten.'); await P.click('#pkDone');
    ok(await P.evaluate(() => SCLQuest.state.pikett.shifts[0].handover === 'Band 2 beobachten.'), q + ': Übergabetext gespeichert');
    await P.screenshot({ path: __dirname + '/shots/pikett_' + q + '_menu.png' });
    if(mobile) ok(await P.evaluate(() => document.documentElement.scrollWidth <= 390), q + ': Handy 390 px ohne waagrechte Verschiebung');
    ok(!errors.length, q + ': keine JS-Fehler' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
  }
  console.log('Pikett-UI: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
