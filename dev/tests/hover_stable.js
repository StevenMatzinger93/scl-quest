// Knopf „Zum Verständnis-Check“ (und alle .compile-btn) darf bei Hover nicht wandern: steht der Zeiger im untersten Pixel,
// flackerte der Knopf früher zwischen Hover/Nicht-Hover und war für Playwright „not stable“ (tests/playthrough.js, Theorie t10b).
const { open } = require('./pw.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if(!c) fails++; };
(async () => {
  const { browser, page, errors } = await open();
  await page.evaluate(() => { localStorage.setItem('sclquest3_state_v4', JSON.stringify({ v:4, pos:0, settings:{ sound:false, motion:true, speed:0.03, font:14 } })); });
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('#playerName', 'Test Person'); await page.click('#newGameBtn');
  await page.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.openTheory(SCLQuest.THEORY.find(t => t.id === 't10b')); });
  await page.mouse.move(10, 10); await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const b = document.getElementById('thStartQuiz').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; });
  for(const dy of [0.5, 1, 2]){
    await page.mouse.move(r[0] + 50, r[1] + r[3] - dy); await page.waitForTimeout(400);
    const ys = await page.evaluate(() => new Promise(res => { const b = document.getElementById('thStartQuiz'); const out = []; let n = 0; (function f(){ out.push(b.getBoundingClientRect().y); if(++n < 20) requestAnimationFrame(f); else res(out); })(); }));
    ok(Math.max(...ys) - Math.min(...ys) < 0.01, 'Knopf steht still, Zeiger ' + dy + ' px über dem unteren Rand (y-Spanne ' + (Math.max(...ys) - Math.min(...ys)).toFixed(2) + ')');
  }
  await page.mouse.move(r[0] + 50, r[1] + r[3] - 2);
  try { await page.click('#thStartQuiz', { timeout: 4000, position: { x: 50, y: r[3] - 2 } }); ok(true, 'Klick am unteren Rand geht durch'); } catch(e) { ok(false, 'Klick am unteren Rand: ' + e.message.split('\n').slice(0, 30).join(' | ')); }
  ok(!errors.length, errors.join(' ') || 'keine JS-Fehler');
  await browser.close(); process.exit(fails ? 1 : 0);
})();
