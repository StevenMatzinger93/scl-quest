// Sensorwerkstatt: 2D-Klemmleiste im Browser (docs/SENSORWERKSTATT_PLAN.md Teil 9, Paket S3)
// Auflegen/Lösen per Antippen-Antippen, Querbrücker, Aderendhülse, Spannungsfreiheitsregel, Trennklemme, Rückgängig,
// Tastaturbedienung, Messung über die Netzliste, Handy 390 px. Läuft ohne Server (Testseite aus den Quelldateien).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SRC = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
const page = level => `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:12px;background:#05070a;}</style></head><body>
<div id="host"></div>
<script>${SRC('sensor_model.js')}</script><script>${SRC('wiring.js')}</script><script>${SRC('scene_sensor2d.js')}</script>
<script>
  window.WORLD = { B1: { active: false } };
  const st = Wiring.newState({ level: '${level}' });
  window.UI = Wiring2D.mount(document.getElementById('host'), { state: st, parts: ['B1', 'S2', 'B11'], modules: ['A1', 'A2'], x2: [1, 2, 3, 4, 5, 6], x3: 2, world: () => window.WORLD });
</script></body></html>`;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async (level, vp) => { const p = await (await browser.newContext({ viewport: vp || { width: 1366, height: 900 } })).newPage(); p.on('pageerror', e => errors.push(e.message)); await p.setContent(page(level)); await p.waitForSelector('.w2d-board'); return p; };
  const id = n => '#w2d_' + n.replace(/\+/g, 'P').replace(/-/g, 'N').replace(/[^A-Za-z0-9]/g, '_');
  const tap = async (p, a, b) => { await p.click(id(a)); await p.click(id(b)); };
  const wires = p => p.evaluate(() => UI.state.wires.map(w => w.from + '>' + w.to));
  const msg = p => p.textContent('.w2d-msg');

  const P = await open('werkstatt');
  // Auflegen per Antippen-Antippen
  await tap(P, 'B1:BN', 'X2:5.L+'); await tap(P, 'B1:BU', 'X2:5.M'); await tap(P, 'B1:BK', 'X2:5.S');
  await tap(P, 'X2:5.S', 'A1:DIa.4'); await tap(P, 'A1:1M', 'X1:M2');
  ok((await wires(P)).length === 5 && /Aufgelegt/.test(await msg(P)), 'Antippen-Antippen legt Adern auf');
  ok(await P.locator('svg.w2d-wires path').count() === 5, 'Adern werden gezeichnet');
  // Querbrücker + Einschalten → Eingang und LED
  await P.click('[data-a="QB_X2_LP"]'); await P.click('[data-a="QB_X2_M"]');
  await P.evaluate(() => { WORLD.B1.active = true; });
  await P.click('[data-a="main"]');
  ok(/unter Spannung/.test(await msg(P)), 'Hauptschalter -Q0 ein');
  ok(await P.evaluate(() => UI.evaluation.di['I0.4'] === true), 'Sensor aktiv → %I0.4 = 1');
  ok(await P.locator('[data-led="5"].on').count() === 1, 'LED an der Initiatorenklemme -X2:5 leuchtet');
  // Spannungsfreiheit: unter Spannung verdrahten → Warnung + Minuspunkt (Werkstatt)
  await tap(P, 'S2:11', 'X2:2.L+');
  ok(/Unter Spannung/.test(await msg(P)) && await P.evaluate(() => UI.state.penalties.includes('spannung')), 'Werkstatt: Verdrahten unter Spannung → Warnung + Minuspunkt');
  // Lösen: dieselbe Verbindung erneut antippen
  await tap(P, 'S2:11', 'X2:2.L+');
  ok(!(await wires(P)).includes('S2:11>X2:2.L+') && /gelöst/.test(await msg(P)), 'Ader lösen durch erneutes Antippen');
  // Rückgängig / Wiederholen
  await P.click('[data-a="undo"]'); ok((await wires(P)).includes('S2:11>X2:2.L+'), 'Rückgängig');
  await P.click('[data-a="redo"]'); ok(!(await wires(P)).includes('S2:11>X2:2.L+'), 'Wiederholen');
  // Querbrücker weg → Sensor ohne Versorgung
  await P.click('[data-a="QB_X2_LP"]');
  ok(await P.evaluate(() => UI.evaluation.di['I0.4'] === false), 'Querbrücker L+ gezogen → Eingang aus');
  await P.click('[data-a="QB_X2_LP"]');
  // Aderendhülse aus → Warnung, gestrichelte Ader
  await P.click('[data-a="main"]');   // spannungsfrei
  await P.click('[data-a="ferrule"]');
  await tap(P, 'B11:+', 'X1:L+3');
  ok(/Aderendhülse/.test(await msg(P)) && await P.locator('svg.w2d-wires path[stroke-dasharray]').count() === 1, 'Ohne Aderendhülse: Warnung, Ader gestrichelt');
  await P.click('[data-a="ferrule"]');
  // Trennklemme: 2-Leiter-Schleife und Messen über die Netzliste
  await tap(P, 'B11:-', 'X3:1.a'); await tap(P, 'X3:1.b', 'A2:0+'); await tap(P, 'A2:0-', 'X1:M3');
  await P.click('[data-a="main"]');
  const raw = () => P.evaluate(() => SensorModel.rawValue(Wiring.analogAt(UI.state, 'CH0', { B11: 50 }).sig, { type: 'I_2W', range: '4..20mA', diag: { wireBreak: true } }));
  ok(await raw() === 13824, 'Stromschleife geschlossen: 50 mbar → Rohwert 13824');
  await P.click('[data-knife="X3:1"]');
  ok(await raw() === 32767 && /Trennmesser X3:1 offen/.test(await msg(P)), 'Trennmesser offen → Drahtbruch 32767');
  await P.click('[data-knife="X3:1"]');
  ok(await P.evaluate(() => Wiring.voltage(UI.state, 'X2:5.L+', 'X2:5.M')) === 24, 'Spannungsmessung L+/M = 24 V');
  // Sichtprüfung
  await P.click('[data-a="check"]'); ok(/offene Adern.*S2:11/.test(await msg(P)), 'Sichtprüfung meldet offene Adern');
  // Alle Adern eines Bauteils lösen
  await P.click('[data-free="B1"]'); ok(!(await wires(P)).some(w => w.startsWith('B1:') || w.includes('>B1:')) && /gelöst/.test(await msg(P)), 'Alle Adern von -B1 lösen');
  await P.screenshot({ path: SHOTS + '/sensor_wiring_2d.png', fullPage: true });
  // Tastatur: Fokus, Enter wählt, Pfeil, Enter legt auf, Entf löst
  await P.click('[data-a="main"]');
  await P.focus(id('B1:BN')); await P.keyboard.press('Enter');
  await P.focus(id('X2:4.L+')); await P.keyboard.press('Enter');
  ok((await wires(P)).includes('B1:BN>X2:4.L+'), 'Tastatur: Enter wählt und legt auf');
  await P.focus(id('X2:4.L+')); await P.keyboard.press('Delete');
  ok(!(await wires(P)).includes('B1:BN>X2:4.L+'), 'Tastatur: Entf löst die Ader');
  await P.focus(id('X2:4.L+')); await P.keyboard.press('ArrowDown');
  ok(await P.evaluate(() => document.activeElement && document.activeElement.dataset.n === 'X2:4.S'), 'Tastatur: Pfeiltasten wandern über die Klemmstellen');
  await P.keyboard.press('Control+z'); ok((await wires(P)).includes('B1:BN>X2:4.L+'), 'Tastatur: Strg+Z');

  // Profi: unter Spannung gesperrt
  const Q = await open('profi');
  await Q.click('[data-a="main"]');
  await tap(Q, 'B1:BN', 'X2:5.L+');
  ok(!(await wires(Q)).length && /spannungsfrei/.test(await msg(Q)), 'Profi: Verdrahten unter Spannung gesperrt');
  // Handy 390 px: grosse Trefferflächen, keine waagrechte Seitenverschiebung
  const M = await open('werkstatt', { width: 390, height: 844 });
  const box = await M.locator(id('X2:1.S')).boundingBox();
  ok(box.width >= 44 && box.height >= 44, 'Handy: Trefferfläche ≥ 44 px (' + Math.round(box.width) + '×' + Math.round(box.height) + ')');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= 390), 'Handy: keine waagrechte Seitenverschiebung (Klemmleiste scrollt in sich)');
  await tap(M, 'B1:BN', 'X2:1.L+'); ok((await wires(M)).length === 1, 'Handy: Antippen-Antippen');
  await M.screenshot({ path: SHOTS + '/sensor_wiring_2d_mobile.png' });
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('Verdrahtung 2D: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
