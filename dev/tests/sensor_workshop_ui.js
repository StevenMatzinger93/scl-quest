// Sensorwerkstatt: Bedienung in 3D (docs/SENSORWERKSTATT_PLAN.md Teil 3/4, Paket S5)
// Werkzeuge über die Werkzeugwand, Montieren mit Gabelschlüssel, M12 anstecken/festziehen, Auflegen über die Klemmleiste
// mit Adern und LEDs im 3D-Schrank, Multimeter (V, Sicherung bei mA parallel, mA in Reihe am Trennmesser, Protokoll),
// Crimpzange, Anschlusskopf -B12, Schirm, Kalibrator, Ausrichten, Röntgen, Tastatur, 2D-Modus, Handy. Läuft ohne Server.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SRC = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const THREE_JS = fs.readFileSync(require.resolve('three/build/three.min.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
const page = mode => `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:10px;background:#05070a;}</style></head><body>
<div id="host"></div>
<script>${THREE_JS}</script>
<script>${SRC('sensor_model.js')}</script><script>${SRC('wiring.js')}</script><script>${SRC('scene_sensor.js')}</script><script>${SRC('scene_sensor2d.js')}</script><script>${SRC('workshop_ui.js')}</script>
<script>
  window.WORLD = { B1: { active: false } }; window.PHYS = { B11: 0 };
  window.WS = Workshop.mount(document.getElementById('host'), { state: Wiring.newState({ level: 'werkstatt' }), parts: ['B1', 'B11', 'B12', 'B5'], modules: ['A1', 'A2'], x2: [1, 2, 3, 4, 5, 6, 7, 8], x3: 2,
    world: () => WORLD, phys: () => PHYS, mode: '${mode}', quality: 'niedrig', reduceMotion: true });
</script></body></html>`;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (mode, vp) => { const p = await (await browser.newContext({ viewport: vp || { width: 1200, height: 900 } })).newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if(m.type() === 'error') errors.push(m.text()); }); await p.setContent(page(mode)); await p.waitForFunction(() => window.WS); return p; };
  const id = n => '#w2d_' + n.replace(/\+/g, 'P').replace(/-/g, 'N').replace(/[^A-Za-z0-9]/g, '_');
  const tap = async (p, a, b) => { await p.click(id(a)); if(b) await p.click(id(b)); };
  const msg = p => p.textContent('.w2d-msg');
  const frames = (p, n) => p.evaluate(n => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n || 3);
  const click3d = async (p, part, view) => { await p.evaluate(v => WS.scene.setView(v), view); await frames(p); let sp = await p.evaluate(x => WS.scene.screenPos(x), part); if(!sp || !sp.visible){ await p.evaluate(x => WS.scene.focusOn(x), part); await frames(p); sp = await p.evaluate(x => WS.scene.screenPos(x), part); } await p.mouse.click(sp.x, sp.y); };

  const P = await open('3d');
  ok(await P.evaluate(() => WS.mode === '3d' && !!document.querySelector('.ws-canvas canvas')), '3D-Werkstatt mit Werkzeugleiste und Klemmleiste');
  // Werkzeug von der Werkzeugwand nehmen
  await click3d(P, 'T_GABEL', 1);
  ok(await P.evaluate(() => WS.tool === 'gabel'), 'Klick auf den Gabelschlüssel an der Werkzeugwand wählt das Werkzeug');
  // Montieren: -B1 mit Gabelschlüssel anklicken → Kontermuttern gelöst, Karte offen
  await click3d(P, 'B1', 2);
  ok(await P.evaluate(() => !WS.state.mounts.B1.tight) && /-B1/.test(await P.textContent('.ws-card header')), 'Gabelschlüssel auf -B1: Kontermuttern gelöst, Detailkarte offen');
  await P.click('[data-act="plus"]'); await P.click('[data-act="plus"]');
  ok(await P.evaluate(() => WS.state.mounts.B1.dist === 5), 'Abstand in 0,5-mm-Schritten verstellt (4 → 5 mm)');
  await P.click('[data-act="tighten"]');
  ok(await P.evaluate(() => WS.state.mounts.B1.tight) && await P.locator('[data-act="plus"][disabled]').count() === 1, 'Kontermuttern festgezogen, Verstellen gesperrt');
  ok(/M12-Belegung/.test(await P.textContent('.ws-card')) && /BN/.test(await P.textContent('.ws-m12')), 'Detailkarte zeigt die M12-Belegung');
  // M12: abziehen, anstecken (lose), festziehen
  await P.click('[data-act="unplug"]'); ok(await P.textContent('[data-plug-state]') === 'ab', 'M12-Leitung abgezogen');
  await P.click('[data-act="plug"]'); ok(await P.textContent('[data-plug-state]') === 'lose' && /Rändelmutter/.test(await msg(P)), 'Angesteckt: Rändelmutter noch lose (Hinweis Wackelkontakt)');
  await P.click('[data-act="plugTight"]'); ok(await P.textContent('[data-plug-state]') === 'fest', 'Rändelmutter festgezogen');
  // Verdrahten über die Klemmleiste → Adern im 3D-Schrank, LEDs
  await P.click('[data-tool="hand"]');
  await tap(P, 'B1:BN', 'X2:5.L+'); await tap(P, 'B1:BU', 'X2:5.M'); await tap(P, 'B1:BK', 'X2:5.S'); await tap(P, 'X2:5.S', 'A1:DIa.4'); await tap(P, 'A1:1M', 'X1:M2');
  await P.click('[data-a="QB_X2_LP"]'); await P.click('[data-a="QB_X2_M"]');
  ok(await P.evaluate(() => WS.scene.wireCount() === WS.state.wires.length && WS.state.wires.length === 5), '5 Adern auch als Linien im 3D-Schrank');
  await P.evaluate(() => { WORLD.B1.active = true; }); await P.click('[data-a="main"]');
  ok(await P.evaluate(() => WS.evaluation.di['I0.4'] === true && WS.scene.ledState('DI0.4') === true && WS.scene.ledState('X2_5') === true && WS.scene.ledState('B1_Y') === true && WS.scene.ledState('G1_DCOK') === true), 'Eingang %I0.4: LEDs an CPU, Initiatorenklemme, Sensor und Netzteil leuchten in 3D');
  await P.evaluate(() => WS.scene.setView(6)); await frames(P, 4);
  await P.screenshot({ path: SHOTS + '/sensor_workshop_cabinet.png' });
  // Multimeter: V DC, Protokoll, mA parallel → Sicherung
  await P.click('[data-tool="multi"]'); await P.click('[data-meter="V"]');
  await tap(P, 'X2:5.L+', 'X2:5.M');
  ok(/24\.00 V/.test(await P.textContent('.ws-lcd')), 'Multimeter V ⎓ an -X2:5 L+/M: 24.00 V');
  ok(await P.locator('.w2d-t.probe-r').count() === 1 && await P.locator('.w2d-t.probe-b').count() === 1, 'Messspitzen rot/schwarz an den Klemmstellen markiert');
  await P.click('[data-proto]'); ok(await P.locator('.ws-proto tbody tr').count() === 1, 'Messwert ins Messprotokoll übernommen');
  await P.click('[data-meter="mA"]');
  ok(/FUSE/.test(await P.textContent('.ws-lcd')) && await P.evaluate(() => WS.state.penalties.includes('multimeter')) && /in Reihe/.test(await msg(P)), 'mA parallel zur Spannung: Sicherung löst aus, Minuspunkt, Hinweis „in Reihe“');
  await P.click('[data-meter-fuse]'); ok(await P.evaluate(() => WS.state.meterFuse === true), 'Sicherung ersetzt');
  // Durchgang nur spannungsfrei
  await P.click('[data-meter="beep"]'); ok(/spannungsfrei/.test(await P.textContent('.ws-note')), 'Durchgangsprüfung unter Spannung: Hinweis spannungsfrei');
  // Trennmesser nur mit Schraubendreher; Stromschleife -B11 in Reihe messen
  await P.click('[data-a="main"]');   // aus
  await P.click('[data-tool="hand"]');
  await tap(P, 'B11:+', 'X1:L+3'); await tap(P, 'B11:-', 'X3:1.a'); await tap(P, 'X3:1.b', 'A2:0+'); await tap(P, 'A2:0-', 'X1:M3');
  await P.click('[data-knife="X3:1"]'); ok(/Schraubendreher/.test(await msg(P)) && await P.evaluate(() => !WS.state.knives['X3:1']), 'Trennmesser mit der Hand: gesperrt (Schraubendreher nötig)');
  await P.click('[data-tool="schrauber"]'); await P.click('[data-knife="X3:1"]');
  ok(await P.evaluate(() => WS.state.knives['X3:1'] === true), 'Trennmesser mit dem Schraubendreher geöffnet');
  await P.click('[data-a="main"]');   // ein
  await P.evaluate(() => { PHYS.B11 = 50; });
  await P.click('[data-tool="multi"]'); await P.click('[data-meter="mA"]'); await tap(P, 'X3:1.a', 'X3:1.b');
  ok(/12\.00 mA/.test(await P.textContent('.ws-lcd')), 'mA in Reihe über dem offenen Trennmesser: 50 mbar → 12.00 mA');
  await P.click('[data-a="main"]');   // aus
  // Crimpzange: Ader ohne Hülse nachträglich crimpen
  await P.click('[data-tool="hand"]'); await P.click('[data-a="ferrule"]');
  await tap(P, 'B5:BN', 'X2:7.L+'); await P.click('[data-a="ferrule"]');
  ok(await P.evaluate(() => WS.state.wires.some(w => w.from === 'B5:BN' && !w.ferrule)), 'Ader ohne Aderendhülse aufgelegt');
  await P.click('[data-tool="crimp"]'); await tap(P, 'X2:7.L+');
  ok(await P.evaluate(() => WS.state.wires.find(w => w.from === 'B5:BN').ferrule === true) && /gecrimpt/.test(await msg(P)), 'Crimpzange: Aderendhülse gecrimpt');
  // Anschlusskopf -B12
  await P.click('[data-tool="hand"]'); await tap(P, 'B12:+');
  ok(/Deckel/.test(await msg(P)), '-B12: Adern erst nach Öffnen des Anschlusskopfs');
  await P.evaluate(() => WS.openCard('B12')); await P.click('[data-act="head"]');
  ok(/Schraubendreher/.test(await msg(P)), 'Deckel öffnen ohne Schraubendreher: Hinweis');
  await P.click('[data-tool="schrauber"]'); await P.click('[data-act="head"]'); await P.click('[data-tool="hand"]');
  await tap(P, 'B12:+', 'X1:L+4'); ok(await P.evaluate(() => WS.state.wires.some(w => w.from === 'B12:+')), 'Deckel offen: Ader im Kopf aufgelegt');
  // Schirm
  await P.evaluate(() => WS.openCard('B11')); await P.click('[data-act="shield"]');
  ok(await P.evaluate(() => WS.state.shields.B11 === true), 'Schirm von -B11 auf die Schirmschiene gelegt');
  // Kalibrator: 12 mA in CH1 → Rohwert 13824
  await P.click('[data-tool="kalib"]'); await P.selectOption('[data-k="channel"]', 'CH1'); await P.click('[data-kset="12"]'); await P.click('[data-kon]');
  ok(/12\.00 mA → CH1/.test(await P.textContent('.ws-lcd')) && /13824/.test(await P.textContent('.ws-note')), 'Kalibrator 12 mA an CH1 → Rohwert 13824');
  await P.click('[data-proto]'); ok(await P.locator('.ws-proto tbody tr').count() === 2, 'Loop-Check im Messprotokoll');
  // Ausrichten der Reflexions-Lichtschranke
  await P.click('[data-tool="schrauber"]'); await P.evaluate(() => WS.openCard('B5'));
  for(let i = 0; i < 4; i++) await P.click('[data-align-k="h+"]');
  ok(await P.textContent('[data-align]') === 'aus', 'Lichtschranke verstellt: Stabilitäts-LED aus');
  for(let i = 0; i < 4; i++) await P.click('[data-align-k="h-"]');
  ok(await P.textContent('[data-align]') === 'ruhig', 'Wieder ausgerichtet: Stabilitäts-LED ruhig');
  // Röntgen, Tastatur, Budget mit Adern
  await P.click('[data-x="xray"]'); ok(await P.evaluate(() => WS.scene.xray === true), 'Röntgen-Schalter');
  await P.focus('[data-tool="hand"]'); await P.keyboard.press('g'); ok(await P.evaluate(() => WS.tool === 'gabel'), 'Taste G wählt den Gabelschlüssel');
  const s = await P.evaluate(() => { WS.scene.setView(1); return WS.scene.stats(); });
  ok(s.triangles <= 120000 && s.drawCalls <= 150, `Budget mit Adern: ${s.triangles} Dreiecke, ${s.drawCalls} Draw-Calls`);
  await P.screenshot({ path: SHOTS + '/sensor_workshop_3d.png' });
  // 2D-Modus: gleiche Handlungen über die Bauteilliste
  await P.click('[data-x="mode"]');
  ok(await P.evaluate(() => WS.mode === '2d' && !document.querySelector('.ws-canvas canvas')) && await P.locator('.ws-chip').count() > 40, '2D-Modus: ohne 3D, Bauteilliste');
  await P.click('.ws-chip[data-part="Q0"]'); await P.click('[data-act="main"]');
  ok(await P.evaluate(() => WS.state.mainSwitch === true), '2D: -Q0 über die Detailkarte eingeschaltet');
  await P.click('.ws-chip[data-part="T_MULTI"]'); ok(await P.evaluate(() => WS.tool === 'multi'), '2D: Werkzeug über die Bauteilliste');
  await P.click('[data-x="mode"]'); ok(await P.evaluate(() => WS.mode === '3d' && WS.scene.wireCount() === WS.state.wires.length), 'Zurück in 3D: Adern wieder da');
  // Handy
  for(const mode of ['3d', '2d']){
    const M = await open(mode, { width: 390, height: 844 });
    ok(await M.evaluate(() => document.documentElement.scrollWidth <= 390), 'Handy ' + mode + ': keine waagrechte Seitenverschiebung');
    const box = await M.locator('[data-tool="multi"]').boundingBox(); ok(box.height >= 40, 'Handy ' + mode + ': Werkzeugknöpfe gross genug');
    await M.screenshot({ path: SHOTS + '/sensor_workshop_mobile_' + mode + '.png' });
  }
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''));
  await browser.close();
  console.log('Werkstatt-Bedienung 3D: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
