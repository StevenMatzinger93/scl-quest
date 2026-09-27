// Sensorwerkstatt: 3D-Werkstatt (docs/SENSORWERKSTATT_PLAN.md Teil 2, Paket S4)
// Leistungsbudget je Ansicht (≤ 120 000 Dreiecke, ≤ 150 Draw-Calls), alle Bauteile anklickbar (Picking über
// screenPos → pickAt in mindestens einer Ansicht oder nach focusOn), Ansichten per Taste, Zustand/LEDs, Qualität.
// Läuft ohne Server (Testseite aus den Quelldateien, three.js aus node_modules).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SRC = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const THREE_JS = fs.readFileSync(require.resolve('three/build/three.min.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
const page = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:#000;}#host{width:100vw;height:100vh;}</style></head><body>
<div id="host"></div>
<script>${THREE_JS}</script><script>${SRC('scene_sensor.js')}</script>
<script>
  window.PICKED = []; window.VIEWS_SEEN = [];
  window.SC = SensorScene.mount(document.getElementById('host'), { reduceMotion: true, preserve: true, quality: 'hoch',
    onPick: id => PICKED.push(id), onView: (n, name) => VIEWS_SEEN.push(n + ':' + name) });
</script></body></html>`;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async vp => { const p = await (await browser.newContext({ viewport: vp || { width: 1366, height: 800 } })).newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if(m.type() === 'error') errors.push(m.text()); }); await p.setContent(page); await p.waitForFunction(() => window.SC); return p; };
  const P = await open();
  const frames = n => P.evaluate(n => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);

  // Leistungsbudget je Ansicht
  const views = await P.evaluate(() => Object.keys(SensorScene.VIEWS).map(Number));
  ok(views.length === 7, '7 Ansichten definiert');
  for(const v of views){
    await P.evaluate(v => SC.setView(v), v); await frames(8);
    const s = await P.evaluate(() => SC.stats());
    ok(s.triangles <= 120000 && s.drawCalls <= 150, `Ansicht ${v}: ${s.triangles} Dreiecke, ${s.drawCalls} Draw-Calls (Budget 120 000 / 150)`);
    await P.screenshot({ path: `${SHOTS}/sensor_scene_v${v}.png` });
  }
  ok((await P.evaluate(() => VIEWS_SEEN.length)) >= 6, 'onView meldet Ansichtswechsel');

  // Alle Bauteile anklickbar
  const comps = await P.evaluate(() => SC.components());
  const all = await P.evaluate(() => Object.keys(SensorScene.COMPONENTS));
  ok(comps.length === all.length, `alle ${all.length} Bauteile haben Geometrie` + (comps.length === all.length ? '' : ' — fehlen: ' + all.filter(c => !comps.includes(c)).join(', ')));
  const missing = [];
  for(const id of all){
    const hit = await P.evaluate(async ({ id, views }) => {
      const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const tryHere = () => { const sp = SC.screenPos(id); if(!sp || !sp.visible) return false; return SC.pickAt(sp.x, sp.y) === id; };
      for(const v of views){ SC.setView(v); await wait(); await wait(); if(tryHere()) return 'Ansicht ' + v; }
      SC.focusOn(id); await wait(); await wait(); if(tryHere()) return 'Fokus';
      return null;
    }, { id, views: id === 'SCHRANK' ? [1] : [1, 2, 3, 4, 5, 6, 7] });
    if(!hit) missing.push(id);
  }
  ok(!missing.length, 'jedes Bauteil per Klick auswählbar' + (missing.length ? ' — nicht treffbar: ' + missing.join(', ') : ''));

  // Klick über Pointer-Events löst onPick aus
  await P.evaluate(() => SC.setView(3)); await frames(4);
  const sp = await P.evaluate(() => SC.screenPos('S3'));
  await P.mouse.click(sp.x, sp.y);
  ok((await P.evaluate(() => PICKED)).includes('S3'), 'Mausklick auf Not-Halt → onPick("S3")');

  // Tastatur: Ansicht per Ziffer
  await P.focus('canvas'); await P.keyboard.press('5'); await frames(4);
  ok(await P.evaluate(() => SC.view === 5), 'Taste 5 → Schaltschrank');
  await P.keyboard.press('6'); await frames(4);
  ok(await P.evaluate(() => SC.camera.isOrthographicCamera), 'Taste 6 → Klemmleiste nah (orthografisch)');

  // Zustand: LEDs, Band, Tank, Röntgen
  await P.evaluate(() => { SC.setState({ leds: { 'DI0.4': true, A1_RUN: true, A1_ERR: 'blink', X2_5: true }, beltRunning: true, level: 0.4, inflow: true, parts: [{ x: 0.3, material: 'stahl' }], aria: 'Guten Morgen im Untergeschoss.' }); SC.setXray(true); SC.setView(1); });
  await frames(10);
  ok(true, 'setState/setXray ohne Fehler');
  await P.screenshot({ path: `${SHOTS}/sensor_scene_state.png` });
  await P.evaluate(() => SC.setXray(false));

  // Qualitätsstufen
  for(const q of ['niedrig', 'mittel', 'hoch']){ await P.evaluate(q => SC.setQuality(q), q); await frames(3); const s = await P.evaluate(() => SC.stats()); ok(s.quality === q, `Qualität ${q}: ${s.drawCalls} Draw-Calls`); }

  // Bildrate (Software-Rendering, nur als Richtwert)
  await P.evaluate(() => { SC.setQuality('hoch'); SC.setView(1); });
  const fps = await P.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if(performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); }));
  console.log('  Bildrate Übersicht (SwiftShader, Richtwert): ' + fps.toFixed(1) + ' fps');

  // Handy
  const M = await open({ width: 390, height: 700 });
  await M.evaluate(() => SC.setView(3)); await M.waitForTimeout(300);
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= 390), 'Handy: keine waagrechte Seitenverschiebung');
  await M.screenshot({ path: `${SHOTS}/sensor_scene_mobile.png` });
  await M.evaluate(() => SC.destroy());
  ok(await M.evaluate(() => !document.querySelector('canvas')), 'destroy entfernt die Zeichenfläche');

  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''));
  await browser.close();
  console.log('3D-Werkstatt: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
