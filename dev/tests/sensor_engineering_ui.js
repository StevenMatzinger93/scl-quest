// Sensorwerkstatt: Engineering-Laptop (docs/SENSORWERKSTATT_PLAN.md Teil 4.3, Paket S6)
// Gerätesicht, PLC-Variablen, Programm SCL/KOP/FUP mit Übersetzen, Laden mit Vorschau (STOP → RUN), Beobachtung mit HEX und Trend,
// Laden nötig nach Konfigurationsänderung, Diagnosepuffer (Drahtbruch kommend/gehend), Baugruppenzustand, Tastatur, Handy.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SRC = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
const page = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:10px;background:#05070a;}</style></head><body>
<div id="host"></div>
${['engine.js', 'kop.js', 'kop_editor.js', 'editor.js', 'sensor_model.js', 'wiring.js', 'sensor_plc.js', 'engineering_ui.js'].map(f => '<script>' + SRC(f) + '</script>').join('\n')}
<script>
  // Prüfstand: -B1 an %I0.4, -B11 als 2-Leiter an Kanal 0 über Trennklemme -X3:1
  const st = Wiring.newState({ level: 'werkstatt', bridges: ['QB_X2_LP', 'QB_X2_M'], mainSwitch: true, shields: { B11: true } });
  [['A1:1M', 'X1:M2'], ['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:5.S'], ['X2:5.S', 'A1:DIa.4'], ['B11:+', 'X1:L+7'], ['B11:-', 'X3:1.a'], ['X3:1.b', 'A2:0+'], ['A2:0-', 'X1:M7']].forEach(([a, b]) => Wiring.addWire(st, a, b, { ferrule: true }));
  window.ST = st; window.WORLD = { B1: { active: false } }; window.PHYS = { B11: 50 };
  window.SESS = SensorPLC.session({ state: () => ST, world: () => WORLD, phys: () => PHYS });
  window.ENG = Engineering.mount(document.getElementById('host'), { cpu: SESS.cpu, source: '"Band" := "Ind_Metall";\\n', watch: ['Ind_Metall', 'Band', '%IW96'] });
  window.RUN = n => { for(let i = 0; i < (n || 1); i++) SESS.step(0.05); ENG.tick(); };
</script></body></html>`;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const open = async vp => { const p = await (await browser.newContext({ viewport: vp || { width: 1280, height: 900 } })).newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if(m.type() === 'error') errors.push(m.text()); }); await p.setContent(page); await p.waitForFunction(() => window.ENG); return p; };
  const P = await open();
  const msg = () => P.textContent('.eng-msg');
  ok(await P.locator('.eng-tab').count() === 5 && /STOP/.test(await P.textContent('.eng-cpu')), 'Reiter Gerätesicht, PLC-Variablen, Programm, Beobachtung, Diagnose; CPU in STOP');
  // Gerätesicht
  ok(await P.locator('.eng-slot').count() === 4 && /SM 1231 AI 4/.test(await P.textContent('.eng-props h4')), 'Gerätesicht: 4 Steckplätze, SM 1231 gewählt');
  await P.selectOption('[data-hw="ai.CH3.type"]', 'I_4W');
  ok(await P.evaluate(() => ENG.hw.ai.CH3.type === 'I_4W' && ENG.hw.ai.CH3.range === '4..20mA'), 'Kanal 3 auf Strom 4-Draht, Bereich passt sich an');
  await P.selectOption('[data-hw="ai.CH3.range"]', '0..20mA');
  ok(await P.locator('[data-hw="ai.CH3.diag.wireBreak"][disabled]').count() === 1, 'Drahtbruchdiagnose bei 0–20 mA nicht wählbar (kein Live Zero)');
  await P.click('.eng-slot[data-slot="1"]'); ok(/Eingangsverzögerung/.test(await P.textContent('.eng-props')), 'CPU: Eingangsverzögerung und AI0/AI1');
  // Variablentabelle
  await P.click('[data-tab="tags"]');
  ok(await P.locator('.eng-tags tbody tr').count() === 32, 'PLC-Variablentabelle der Werkstatt (32 Variablen)');
  await P.click('[data-e="addtag"]'); const last = await P.locator('.eng-tags tbody tr').count() - 1;
  await P.fill(`[data-tag="${last}.name"]`, 'Metall_2'); await P.press(`[data-tag="${last}.name"]`, 'Tab');
  await P.fill(`[data-tag="${last}.addr"]`, '%I0.4'); await P.press(`[data-tag="${last}.addr"]`, 'Tab');
  ok(/doppelt belegt/.test(await P.textContent('.eng-errs')) && await P.locator('.eng-tags tr.bad').count() === 1, 'Doppelte Adresse wird gemeldet und markiert');
  await P.fill(`[data-tag="${last}.name"]`, 'Druck_mbar'); await P.press(`[data-tag="${last}.name"]`, 'Tab');
  await P.selectOption(`[data-tag="${last}.type"]`, 'Real'); await P.fill(`[data-tag="${last}.addr"]`, '%MD20'); await P.press(`[data-tag="${last}.addr"]`, 'Tab');
  ok(!(await P.textContent('.eng-errs')).trim(), 'Neue Variable Druck_mbar (Real, %MD20) fehlerfrei');
  // Programm: Fehler mit Zeile, dann richtig
  await P.click('[data-tab="program"]');
  await P.fill('.eng-ta', '"Band" := "Ind_Metall";\n"Druck_mbar" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648) MAX := 100.0);');
  await P.click('[data-e="compile"]');
  ok(/Zeile 2/.test(await P.textContent('.eng-errs')) && /Fehler/.test(await msg()) && await P.locator('.eng-gutter .err').count() === 1, 'Übersetzen: Fehler mit Zeilennummer, Zeile markiert');
  await P.fill('.eng-ta', '"Band" := "Ind_Metall";\n"Druck_mbar" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648), MAX := 100.0);');
  await P.click('[data-e="compile"]'); ok(/0 Fehler/.test(await msg()), 'Übersetzen fehlerfrei');
  ok(await P.locator('.eng-hl .tok-keyword').count() > 0 || await P.locator('.eng-hl span').count() > 0, 'SCL-Hervorhebung im Editor');
  // Laden: Vorschau, STOP → RUN
  await P.click('[data-e="load"]');
  ok(await P.locator('.eng-dlg:not([hidden])').count() === 1 && /STOP/.test(await P.textContent('.eng-dlgbox')), 'Vorschau Laden: Hinweis CPU geht in STOP');
  await P.click('[data-e="doload"]');
  ok(/RUN/.test(await P.textContent('.eng-cpu')) && await P.evaluate(() => SESS.cpu.diag.some(d => /STOP → RUN/.test(d.text))), 'Geladen und gestartet: CPU in RUN');
  // Beobachtung
  await P.click('[data-tab="watch"]');
  await P.evaluate(() => { WORLD.B1.active = true; RUN(3); });
  const vals = await P.$$eval('.eng-val', els => els.map(e => e.textContent));
  ok(vals[0] === 'TRUE' && vals[1] === 'TRUE' && Math.abs(+vals[2] - 13824) < 40, 'Beobachtung live: Ind_Metall TRUE, Band TRUE, %IW96 ≈ 13824 (' + vals.join(', ') + ')');
  await P.selectOption('[data-wf="2"]', 'hex'); await P.evaluate(() => RUN(1));
  ok(/^16#3[56][0-9A-F]{2}$/.test(await P.textContent('[data-wv="2"]')), 'Anzeigeformat HEX (' + await P.textContent('[data-wv="2"]') + ')');
  await P.click('[data-e="addw"]'); await P.fill('[data-w="3"]', '"Druck_mbar"'); await P.press('[data-w="3"]', 'Enter'); await P.evaluate(() => RUN(1));
  ok(Math.abs(parseFloat(await P.textContent('[data-wv="3"]')) - 50) < 0.5, 'Beobachtung "Druck_mbar" ≈ 50 mbar (' + await P.textContent('[data-wv="3"]') + ')');
  await P.click('[data-trend="3"]'); await P.evaluate(() => { for(let i = 0; i < 30; i++){ PHYS.B11 = 20 + i * 2; RUN(1); } });
  ok(await P.locator('.eng-trend:not([hidden])').count() === 1, 'Trendkurve für Analogwerte');
  // Konfigurationsänderung → Laden erforderlich
  await P.click('[data-tab="device"]'); await P.click('.eng-slot[data-slot="2"]');
  ok(await P.$$eval('[data-hw="ai.CH0.range"] option', o => o.map(x => x.value).join()) === '4..20mA', '2-Draht bietet nur 4–20 mA an');
  await P.selectOption('[data-hw="ai.CH0.type"]', 'I_4W'); await P.selectOption('[data-hw="ai.CH0.range"]', '0..20mA');
  ok(!(await P.locator('.eng-need').isHidden()), 'Konfiguration geändert → „Laden erforderlich“');
  await P.evaluate(() => { PHYS.B11 = 50; RUN(2); }); const before = await P.evaluate(() => SESS.io.IW96);
  await P.click('[data-e="load"]'); await P.click('[data-e="doload"]'); await P.evaluate(() => RUN(2));
  const after = await P.evaluate(() => SESS.io.IW96);
  ok(Math.abs(before - 13824) < 60 && Math.abs(after - 16589) < 60 && await P.locator('.eng-need').isHidden(), 'Erst nach dem Laden gilt 0–20 mA: 12 mA → ' + after);
  await P.selectOption('[data-hw="ai.CH1.type"]', 'off'); await P.selectOption('[data-hw="ai.CH2.type"]', 'off');   // unbenutzte Kanäle deaktivieren
  await P.selectOption('[data-hw="ai.CH0.type"]', 'I_2W'); await P.check('[data-hw="ai.CH0.diag.wireBreak"]'); await P.click('[data-e="load"]'); await P.click('[data-e="doload"]');
  // Diagnose: Trennmesser öffnen → Drahtbruch kommend, Baugruppe Fehler; schliessen → gehend
  await P.evaluate(() => { ST.knives = { 'X3:1': true }; RUN(2); });
  await P.click('[data-tab="diag"]');
  ok(/Steckplatz 2, Kanal 0: Drahtbruch oder Überlauf \(kommend\)/.test(await P.textContent('.eng-buf')) && await P.textContent('[data-mod="A2"]') === 'Fehler', 'Diagnosepuffer: Drahtbruch kommend, SM 1231 Fehler');
  await P.evaluate(() => { ST.knives = {}; RUN(2); });
  ok(/\(gehend\)/.test(await P.textContent('.eng-buf')) && await P.textContent('[data-mod="A2"]') === 'OK', 'Trennmesser zu: gehend; unbenutzte Kanäle deaktiviert → Baugruppe OK');
  // KOP und FUP
  await P.click('[data-tab="program"]'); await P.click('[data-lang="kop"]');
  ok(await P.locator('.eng-gfx .kop-wrap').count() === 1 && await P.locator('.eng-vars .var-chip').count() > 20, 'KOP: grafischer Editor mit Variablenliste statt Textfeld');
  await P.click('[data-e="view"]');
  await P.fill('.eng-ta', 'NETWORK Band\n"Ind_Metall" AND %I1.3 => "Band";');
  await P.waitForSelector('.eng-prev .kop-static');
  ok(await P.locator('.eng-prev .kop-net').count() === 1, 'KOP: Netzwerk als Kontaktplan-Vorschau');
  await P.click('[data-e="load"]'); await P.click('[data-e="doload"]'); await P.evaluate(() => RUN(1));
  ok(await P.evaluate(() => SESS.cpu.loaded.lang === 'kop' && SESS.out['Q0.0'] === false), 'KOP geladen: %I1.3 fehlt → Band aus');
  await P.click('[data-lang="fup"]'); await P.fill('.eng-ta', 'NETWORK Band\n"Ind_Metall" OR %I1.3 => "Band";');
  await P.click('[data-e="load"]'); await P.click('[data-e="doload"]'); await P.evaluate(() => RUN(1));
  ok(await P.evaluate(() => SESS.cpu.loaded.lang === 'fup' && SESS.out['Q0.0'] === true), 'FUP geladen: Band an');
  // FUP grafisch: Box auf den Eingang ziehen, Variable antippen, übersetzen, laden
  await P.fill('.eng-ta', 'NETWORK Band\n"Ind_Metall" => "Band";');
  await P.click('[data-e="view"]');
  await P.waitForSelector('.eng-gfx .kop-canvas [data-kind="e"]');
  await P.locator('.eng-gfx [data-act="par"][draggable="true"]:visible:not([disabled])').first().dragTo(P.locator('.eng-gfx .kop-canvas [data-kind="e"]').first());
  await P.click('.eng-vars .var-chip[data-name=\'"Haube_Zu"\']');
  ok(await P.evaluate(() => /\("Ind_Metall" OR "Haube_Zu"\) => "Band"|"Ind_Metall" OR "Haube_Zu" => "Band"/.test(ENG.source)), 'FUP: >=1-Box gezogen, Variable aus der PLC-Tabelle eingesetzt: ' + await P.evaluate(() => ENG.source.replace(/\n/g, ' ')));
  await P.click('[data-e="load"]'); await P.click('[data-e="doload"]'); await P.evaluate(() => RUN(1));
  ok(await P.evaluate(() => SESS.cpu.loaded.lang === 'fup' && /Haube_Zu/.test(SESS.cpu.loaded.source) && SESS.out['Q0.0'] === true), 'FUP grafisch übersetzt und geladen: Band an');
  // CPU Stopp, Tastatur
  await P.click('[data-e="stop"]'); await P.evaluate(() => RUN(1));
  ok(/STOP/.test(await P.textContent('.eng-cpu')) && await P.evaluate(() => SESS.out['Q0.0'] === false), 'CPU Stopp: Ausgänge 0');
  await P.focus('[data-tab="program"]'); await P.keyboard.press('ArrowRight');
  ok(await P.evaluate(() => document.activeElement.dataset.tab === 'watch'), 'Tastatur: Pfeiltasten zwischen den Reitern');
  await P.screenshot({ path: SHOTS + '/sensor_engineering.png', fullPage: true });
  // Handy
  const M = await open({ width: 390, height: 844 });
  for(const t of ['device', 'tags', 'watch', 'diag']){ await M.click('[data-tab="' + t + '"]'); }
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= 390), 'Handy: keine waagrechte Seitenverschiebung (Tabellen scrollen in sich)');
  await M.click('[data-tab="device"]'); await M.screenshot({ path: SHOTS + '/sensor_engineering_mobile.png' });
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''));
  await browser.close();
  console.log('Engineering-Laptop: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
