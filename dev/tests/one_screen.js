// Feedback-Auftrag 1.2: Ein-Bildschirm-Layout. Vier Quests × Grund-/Profi-Aufgabe bei 1366×768 und 1920×1080:
// keine Seitenverschiebung, Anlage und Testbericht gleichzeitig sichtbar, Editor und Knopf „Testen“ im Bild. 390 px: altes Stapel-Layout.
const { open } = require('./pw.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } };
const inView = (r, h) => r && r.top >= 0 && r.bottom <= h + 1 && r.height > 20;
(async () => {
  for(const f of ['index.html', 'kop.html', 'fup.html', 'awl.html']) for(const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]){
    const { browser, page: P, errors } = await open({ file: f, viewport: { width: w, height: h }, dpr: 1 });
    const KEY = await P.evaluate(() => window.QUEST ? window.QUEST.key : 'sclquest3_state_v4');
    await P.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 4, pos: 0, settings: { sound: false } })), KEY);
    await P.reload(); await P.waitForTimeout(300); await P.fill('#playerName', 'X'); await P.click('#newGameBtn');
    for(const pro of [false, true]){
      await P.evaluate(pro => { SCLQuest.state.tours = { basic: true, pro: true }; document.querySelectorAll('.overlay, #levelIntroOverlay, #theoryOverlay').forEach(e => e.style.display = 'none'); document.getElementById('app').style.display = '';
        SCLQuest.renderTask(SCLQuest.TASKS.filter(t => !!t.pro === pro)[2], false); }, pro);
      await P.waitForTimeout(400);
      await P.evaluate(() => SCLQuest.compile()); await P.waitForTimeout(1200);
      const m = await P.evaluate(() => { const r = s => { const e = document.querySelector(s); if(!e || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height, left: b.left, right: b.right }; };
        return { one: document.body.classList.contains('one-screen'), sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, scene: r('.scene-card'), report: r('#reportCard'), editor: r('.editor-card'), btn: r('#compileBtn'), task: r('#taskDescription') }; });
      const tag = f.replace('.html', '') + ' ' + w + ' ' + (pro ? 'Profi' : 'Grund');
      if(w === 390){ ok(!m.one && m.sw <= 390, tag + ': Handy behält das Stapel-Layout ohne waagrechte Verschiebung'); continue; }
      ok(m.one && m.sh <= h && m.sw <= w, tag + ': keine Seitenverschiebung (' + m.sh + ')');
      ok(inView(m.scene, h) && m.report && m.report.top >= 0 && m.report.top < h - 120 && m.report.left >= m.scene.right - 1, tag + ': Anlage und Testbericht nebeneinander sichtbar');
      ok(inView(m.editor, h) && inView(m.btn, h) && m.task && m.task.top < h / 2, tag + ': Auftrag oben, Editor und Knopf im Bild');
    }
    ok(!errors.length, f + ' ' + w + ': keine JS-Fehler' + (errors.length ? ' ' + errors[0] : ''));
    await browser.close();
  }
  console.log('Ein-Bildschirm-Layout: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
