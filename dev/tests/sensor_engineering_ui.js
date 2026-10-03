// Sensorwerkstatt: Engineering-Laptop (docs/SENSORWERKSTATT_PLAN.md Teil 4.3, Paket S6)
// Gerätesicht, PLC-Variablen, Programm SCL/FUP (grafisch, Ziehen) mit Übersetzen, Laden mit Vorschau (STOP → RUN), Beobachtung mit HEX und Trend,
// Laden nötig nach Konfigurationsänderung, Diagnosepuffer (Drahtbruch kommend/gehend), Baugruppenzustand, Tastatur, Handy.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SRC = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, oks = 0;
const ok = (c, m) => { if(c){ oks++; console.log('✓ ' + m); } else { fails++; console.log('✗ ' + m); } };
const page = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:10px;background:#05070a;}</style></head><body>
<div id="host"></div>
${['styles_kop.css', 'styles_fup.css', 'styles_fup_wb.css', 'styles_fup_wb_game.css'].map(f => '<style>' + SRC(f) + '</style>').join('\n')}
${['engine.js', 'kop.js', 'kop_editor.js', 'fup_graph.js', 'fup_workbench.js', 'fup_attach.js', 'editor.js', 'sensor_model.js', 'wiring.js', 'sensor_plc.js', 'engineering_ui.js'].map(f => '<script>' + SRC(f) + '</script>').join('\n')}
<script>
  // Prüfstand: -B1 an %I0.4, -B11 als 2-Leiter an Kanal 0 über Trennklemme -X3:1
  const st = Wiring.newState({ level: 'werkstatt', bridges: ['QB_X2_LP', 'QB_X2_M'], mainSwitch: true, shields: { B11: true } });
  [['A1:1M', 'X1:M2'], ['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:5.S'], ['X2:5.S', 'A1:DIa.4'], ['B11:+', 'X1:L+7'], ['B11:-', 'X3:1.a'], ['X3:1.b', 'A2:0+'], ['A2:0-', 'X1:M7']].forEach(([a, b]) => Wiring.addWire(st, a, b, { ferrule: true }));
  window.ST = st; window.WORLD = { B1: { active: false } }; window.PHYS = { B11: 50 };
  window.SESS = SensorPLC.session({ state: () => ST, world: () => WORLD, phys: () => PHYS });
  window.ENG = Engineering.mount(document.getElementById('host'), { cpu: SESS.cpu, source: '"Band" := "Ind_Metall";\\n', starts: { scl: '"Band" := "Ind_Metall";\\n', fup: 'NETWORK Band\\n? => ?;' }, watch: ['Ind_Metall', 'Band', '%IW96'] });
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
  // FUP (KOP entfällt in der Sensorwerkstatt): grafischer Editor mit Palette, Ziehen und PLC-Variablen
  await P.evaluate(() => ENG.setSource('"Band" := "Ind_Metall";\n', 'scl'));   // unveränderte SCL-Vorlage
  await P.click('[data-tab="program"]');
  ok(await P.locator('[data-lang="kop"]').count() === 0 && await P.locator('[data-lang="fup"]').count() === 1 && await P.locator('[data-lang="scl"]').count() === 1, 'Sprachwahl nur SCL und FUP (KOP entfällt)');
  await P.click('[data-lang="fup"]');
  ok((await P.evaluate(() => ENG.source)) === 'NETWORK Band\n? => ?;', 'Sprachwechsel: unveränderte SCL-Vorlage wird durch die FUP-Vorlage ersetzt');
  ok(await P.locator('.eng-fup #fwbHost .fwb').count() === 1 && await P.locator('.eng-ed textarea.eng-ta').isHidden(), 'FUP: FUP-Werkbank statt Textfeld');
  const nChip = await P.locator('.eng-fup-vars .var-chip').count(), nPal = await P.locator('.eng-fup .fwb-bar [data-pal]').count();
  ok(nChip === await P.evaluate(() => ENG.tags.filter(t => t.name).length) && nChip >= 20 && nPal >= 4, 'FUP: PLC-Variablen als Chips (' + nChip + ') und Palette mit Boxen (' + nPal + ')');
  // Text → Grafik: Textansicht umschalten, Netzwerk eintragen, zurück
  await P.click('#kopViewBtn');
  ok(await P.locator('.eng-fta').isVisible(), 'FUP: Textansicht per Umschalter');
  await P.fill('.eng-fta', 'NETWORK Band\n"Ind_Metall" OR "Haube_Zu" => "Band";'); await P.click('#kopViewBtn');
  ok(await P.locator('.eng-fup .fwb svg.fwb-svg').count() >= 1, 'FUP: Text erscheint als Funktionsplan (Boxen)');
  await P.click('[data-e="load"]'); await P.click('[data-e="doload"]'); await P.evaluate(() => RUN(1));
  ok(await P.evaluate(() => SESS.cpu.loaded.lang === 'fup' && SESS.out['Q0.0'] === true), 'FUP aus Text geladen: Band an');
  // Ziehen: leeres Netzwerk, Variable auf Eingang, UND-Box aus der Palette, zweite Variable, Ausgang
  await P.click('#kopViewBtn'); await P.fill('.eng-fta', 'NETWORK Band\n? => ?;'); await P.click('#kopViewBtn');
  const chip = n => '.eng-fup-vars .var-chip[data-name=\'"' + n + '"\']';
  const drag = async (from, to) => { const a = await P.locator(from).first().boundingBox(), b = await P.locator(to).first().boundingBox();
    await P.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await P.mouse.down(); await P.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 2 });
    await P.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await P.mouse.up(); await P.waitForTimeout(80); };
  await drag('.eng-fup .fwb-bar [data-pal="and"]', '.eng-fup .fwb [data-slot="in:0"]');   // &-Box auf den Eingang der Zuweisung
  await drag(chip('Ind_Metall'), '.eng-fup .fwb [data-slot="in:0"]');
  await drag(chip('Haube_Zu'), '.eng-fup .fwb [data-slot="in:1"]');
  await drag(chip('Band'), '.eng-fup .fwb [data-slot="top"]');
  ok(await P.evaluate(() => ENG.source).then(v => v.includes('"Ind_Metall" AND "Haube_Zu" => "Band";')), 'FUP: Netzwerk per Ziehen gebaut: ' + JSON.stringify(await P.evaluate(() => ENG.source)));
  await P.screenshot({ path: SHOTS + '/sensor_engineering_fup.png', fullPage: true });
  await P.click('[data-e="compile"]');
  ok(/0 Fehler/.test(await msg()), 'FUP: Übersetzen fehlerfrei');
  await P.click('[data-e="load"]'); await P.click('[data-e="doload"]');
  await P.evaluate(() => { WORLD.B1.active = true; ST.wires.push({ from: 'X2:5.S', to: 'A1:DIa.4', ferrule: true }); RUN(2); });
  ok(await P.evaluate(() => SESS.cpu.loaded.lang === 'fup' && /Ind_Metall" AND "Haube_Zu/.test(SESS.cpu.loaded.source) && SESS.cpu.mode === 'RUN'), 'FUP: geladen, CPU in RUN');
  // Tap-Bedienung (ohne Ziehen): Eingang antippen, Variable antippen
  await P.click('[data-tab="tags"]'); await P.click('[data-tab="program"]');
  ok(await P.locator('.eng-fup .fwb svg.fwb-svg').count() >= 1 && (await P.evaluate(() => ENG.source)).includes('"Haube_Zu"'), 'FUP: Programm bleibt beim Reiterwechsel erhalten');
  // Sprachwechsel: SCL zeigt Textfeld, unveränderte Vorlage wird ersetzt
  await P.click('[data-lang="scl"]');
  ok(await P.locator('.eng-fup').count() === 0 && await P.locator('.eng-ta').isVisible(), 'SCL: Textfeld statt Funktionsplan');
  await P.click('[data-lang="fup"]');
  ok(await P.locator('.eng-fup .fwb').count() === 1, 'zurück zu FUP: Editor wieder da');
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
