// FUP-Werkbank in der FUP Quest (V5): node tests/fup_wb_quest.js
// Umschalten Text/Funktionsplan, Fehlermarke, Lösen durch Antippen, Tipp 3 und Lösungsvergleich als Werkbank-Bild,
// Profi: Aufruf-Box mit Parametern aus der Schnittstelle, Beobachten, Rückfall ?werkbank=0, 390 px
const { open } = require('./pw.js');
let fails = 0, n = 0;
const ok = (c, m) => { n++; if(c) console.log('✓ ' + m); else { fails++; console.log('✗ ' + m); } };
async function start(file, vp){
  const r = await open({ file, viewport: vp });
  const P = r.page;
  const KEY = await P.evaluate(() => window.QUEST.key);
  await P.evaluate(k => { localStorage.setItem(k, JSON.stringify({ v:4, pos:0, settings:{ sound:false, motion:true, speed:0.03, font:14 } })); }, KEY);
  await P.reload(); await P.waitForTimeout(300);
  await P.fill('#playerName', 'Test'); await P.click('#newGameBtn');
  await P.evaluate(() => { SCLQuest.state.tours = { basic:true, pro:true }; SCLQuest.state.settings.speed = 0.03; });
  return r;
}
const openTask = (P, id) => P.evaluate(id => { document.querySelectorAll('#theoryOverlay,#levelIntroOverlay,#titleScreen').forEach(e => { e.style.display = 'none'; }); document.getElementById('app').style.display = ''; SCLQuest.renderTask(SCLQuest.TASK_BY_ID[id], false); }, id);
const solved = P => P.waitForSelector('#successCard:not([style*="display: none"])', { timeout: 15000 }).then(() => true, () => false);
async function drag(P, from, to){
  const a = await P.locator(from).first().boundingBox(), b = await P.locator(to).first().boundingBox();
  await P.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await P.mouse.down(); await P.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 2 });
  await P.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await P.mouse.up(); await P.waitForTimeout(80);
}

(async () => {
  let { browser, page: P, errors } = await start('fup.html');
  // Grundstufe
  await openTask(P, 'f1_signal'); await P.waitForTimeout(200);
  ok(await P.locator('#fwbHost .fwb').isVisible() && await P.locator('#editorBody').isHidden(), 'Werkbank statt Textfeld, Textansicht ausgeblendet');
  ok(await P.locator('#kopCanvas').count() === 0, 'bisheriger FUP-Editor nicht eingehängt');
  ok(await P.locator('#fwbHost .fwb-bar [data-pal="and"]').count() === 1 && await P.locator('#fwbHost [data-slot]').count() >= 2, 'Favoritenleiste und Platzhalter');
  // Text → Grafik
  await P.click('#kopViewBtn');
  ok(await P.locator('#editorBody').isVisible() && await P.locator('#fwbHost').isHidden(), 'Umschalter zeigt die Textansicht');
  await P.evaluate(() => { const ta = document.getElementById('codeEditor'); ta.value = 'NETWORK Signal\nTaste_A AND Hilf_1 => Signal_A;\n'; ta.dispatchEvent(new Event('input')); });
  await P.click('#kopViewBtn');
  ok(await P.evaluate(() => SCLQuest.editor.workbench.graph().networks[0].nodes.some(x => x.t === 'and')), 'Text erscheint als Funktionsplan (&-Box)');
  // Fehlermarke: unbekannte Variable
  await P.evaluate(() => { SCLQuest.editor.setValue('NETWORK Signal\nTaste_X => Signal_A;\n'); SCLQuest.compile(); });
  await P.waitForTimeout(400);
  ok(await P.locator('#fwbHost .fwb-bad').count() >= 1, 'Übersetzungsfehler: Netzwerk mit ⊗ markiert');
  // Lösen durch Antippen: Eingang → Variable, Operand → Variable
  await P.evaluate(() => SCLQuest.editor.setValue('NETWORK Netzwerk 1\n? => ?;\n'));
  await P.click('#fwbHost [data-slot="in:0"]'); await P.click('.var-chip[data-name="Taste_A"]');
  await P.click('#fwbHost [data-slot="top"]'); await P.click('.var-chip[data-name="Signal_A"]');
  ok(/Taste_A => Signal_A;/.test(await P.evaluate(() => SCLQuest.editor.getValue())), 'Antippen schreibt den Text');
  await P.click('#compileBtn');
  ok(await solved(P), 'Aufgabe durch Antippen gelöst');
  await P.click('#successCmpBtn').catch(() => {});
  await P.waitForTimeout(300);
  ok(await P.locator('.kop-diff .fwb-static svg').count() >= 2, 'Lösungsvergleich als Werkbank-Bild (deine Lösung + Musterlösung)');
  await P.keyboard.press('Escape');
  // Tipp 3: Lösungsvorschlag als Funktionsplan
  await openTask(P, 'f2_oder'); await P.waitForTimeout(150);
  await P.evaluate(() => { SCLQuest.state.hints.f2_oder = 3; SCLQuest.renderTask(SCLQuest.TASK_BY_ID.f2_oder, false); });
  ok(await P.locator('#hintBox .fwb-static svg').count() >= 1, 'Tipp 3: Lösungsvorschlag als Werkbank-Bild');
  // Laufen lassen: Signalzustände im Funktionsplan
  await P.evaluate(() => { const t = SCLQuest.session.task; SCLQuest.editor.setValue(t.refSolution); SCLQuest.compile(); });
  ok(await solved(P), 'Musterlösung über die Werkbank geladen und bestanden');
  // Profi: Aufruf-Box
  await openTask(P, 'fp11_aufruf'); await P.waitForTimeout(300);
  await P.evaluate(() => SCLQuest.showProBlock('Main'));
  await P.waitForTimeout(200);
  ok(await P.locator('#fwbHost .fwb').isVisible(), 'Profi: Werkbank im OB Main');
  await P.click('#fwbHost [data-act="lib"]');
  await drag(P, '#fwbHost .fwb-lib [data-pal="call"]', '#fwbHost .fwb-canvas');
  await P.click('#fwbHost [data-act="lib"]');
  await P.click('#fwbHost [data-slot="top"]'); await P.click('.var-chip[data-name=\'"FC_Signal"\']');
  const call = await P.evaluate(() => { const nn = SCLQuest.editor.workbench.graph().networks[0].nodes.find(x => x.t === 'call'); return nn && { target: nn.target, ins: nn.ins.map(p => p.n), outs: nn.outs.map(p => p.n) }; });
  ok(call && call.target === '"FC_Signal"' && call.ins.join() === 'EN,Taste,Gleis_frei,Weiche_Endlage' && call.outs.join() === 'Fahrt', 'Aufruf-Box übernimmt die Parameter der Schnittstelle: ' + JSON.stringify(call));
  for(const [i, v] of [[1, 'Taste_A'], [2, 'Gleis1_frei'], [3, 'W1_Endlage']]){ await P.click('#fwbHost [data-slot="in:' + i + '"]'); await P.click('.var-chip[data-name=\'"' + v + '"\']'); }
  await P.click('#fwbHost [data-slot="o:0"]'); await P.click('.var-chip[data-name=\'"Signal_A"\']');
  const src = await P.evaluate(() => SCLQuest.editor.getValue());
  ok(/"FC_Signal"\(Taste := "Taste_A", Gleis_frei := "Gleis1_frei", Weiche_Endlage := "W1_Endlage", Fahrt => "Signal_A"\)/.test(src), 'Profi: Aufruf vollständig verschaltet (globale Variablen in Anführungszeichen)');
  await P.click('#compileBtn');
  ok(await solved(P), 'Profi-Aufgabe mit der Aufruf-Box gelöst');
  // Beobachten (Profi): Netzwerke mit Signalzuständen
  await P.evaluate(() => SCLQuest.openObserve());
  await P.waitForTimeout(400);
  ok(await P.locator('.obs-kop .fwb-static svg').count() >= 1, 'Beobachten: Netzwerke als Werkbank-Bild');
  ok(!errors.length, 'keine JS-Fehler ' + errors.join(' | '));
  await browser.close();

  // Rückfall auf den bisherigen Editor
  ({ browser, page: P, errors } = await start('fup.html?werkbank=0'));
  await openTask(P, 'f1_signal'); await P.waitForTimeout(200);
  ok(await P.locator('#kopCanvas').count() === 1 && await P.locator('#fwbHost').count() === 0, '?werkbank=0: bisheriger Editor');
  await browser.close();

  // Handy 390 px
  ({ browser, page: P, errors } = await start('fup.html?werkbank=1', { width: 390, height: 844 }));
  await openTask(P, 'f1_signal'); await P.waitForTimeout(200);
  ok(await P.locator('#fwbHost .fwb').isVisible(), '390 px: Werkbank sichtbar');
  const sw = await P.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, '390 px: keine waagrechte Verschiebung (scrollWidth ' + sw + ')');
  await P.click('#fwbHost [data-slot="in:0"]'); await P.click('.var-chip[data-name="Taste_A"]');
  await P.click('#fwbHost [data-slot="top"]'); await P.click('.var-chip[data-name="Signal_A"]');
  await P.click('#compileBtn');
  ok(await solved(P), '390 px: Aufgabe durch Antippen gelöst');
  ok(!errors.length, '390 px: keine JS-Fehler ' + errors.join(' | '));
  await browser.close();
  console.log('FUP-Werkbank im Spiel: ' + (n - fails) + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
