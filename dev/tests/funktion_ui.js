// Auftrag „Funktion zählt“ (V3/V3b): im Spiel zählt nur die Funktion.
// FUP: SR-Aufgabe mit S- und R-Spule gelöst → bestanden + Lernhinweis; halb richtige Lösung, die nur die Beispiel-Tests besteht → „Weitere Prüfung“ mit Gegenbeispiel;
// Tipp 3 = Lösungsvorschlag mit Lücken (verrät keine Operanden); gewählter Weg wird gespeichert. SCL: Zuweisung statt geforderter Struktur.
const { open } = require('./pw.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } };
async function start(file){
  const { browser, page: P, errors } = await open({ file, viewport: { width: 1366, height: 860 }, dpr: 1 });
  await P.evaluate(() => localStorage.setItem(window.QUEST ? window.QUEST.key : 'sclquest3_state_v4', JSON.stringify({ v: 4, pos: 0, settings: { sound: false, speed: 0.03 } })));
  await P.reload(); await P.waitForTimeout(300); await P.fill('#playerName', 'Frei'); await P.click('#newGameBtn');
  await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; document.querySelectorAll('.overlay, #levelIntroOverlay, #theoryOverlay').forEach(e => e.style.display = 'none'); document.getElementById('app').style.display = ''; });
  return { browser, P, errors };
}
const solve = (P, id, code) => P.evaluate(async ([id, code]) => {
  const t = SCLQuest.TASK_BY_ID[id]; SCLQuest.renderTask(t, false); SCLQuest.editor.setValue(code); SCLQuest.compile();
  await new Promise(r => setTimeout(r, 400));
  return { solved: !!SCLQuest.session.solved, report: document.getElementById('reportBody').textContent, success: document.getElementById('successTakeaway').innerHTML, way: (SCLQuest.state.ways || {})[id] };
}, [id, code]);
(async () => {
  // ---------- FUP ----------
  let { browser, P, errors } = await start('fup.html');
  let r = await solve(P, 'f4_sr', 'NETWORK Setzen\nTaste_FS => S FS_eingestellt;\n\nNETWORK Ruecksetzen\nAufloesung => R FS_eingestellt;');
  ok(r.solved, 'FUP: SR-Aufgabe mit S- und R-Spule gelöst (Bausteinwahl frei)');
  ok(/Übrigens/.test(r.success) && /SR/.test(r.success), 'Lernhinweis „Übrigens: Die Musterlösung nutzt … SR“');
  ok(Array.isArray(r.way) && r.way.length > 0, 'gewählter Weg gespeichert: ' + JSON.stringify(r.way));
  r = await solve(P, 'f4_sr', 'NETWORK Falsch\nTaste_FS => RS(FS_eingestellt, Aufloesung);');
  ok(!r.solved, 'FUP: RS statt SR (Setzen dominant) fällt durch');
  // halb richtig: Beispiel-Tests absichtlich schwach → nur die erzeugten Tests finden den Fehler
  r = await P.evaluate(async () => {
    const t = SCLQuest.TASK_BY_ID['f2_oder'] || SCLQuest.TASKS.find(x => !x.pro && /OR/.test(x.refSolution || '') && x.testCases);
    t.testCases = t.testCases.filter(c => Object.values(c.expect).every(v => v === true)).slice(0, 1); delete t.autoTests;
    const outs = Object.keys(t.testCases[0].expect), ins = Object.keys(t.testCases[0].setup).filter(k => t.testCases[0].setup[k] === true);
    SCLQuest.renderTask(t, false); SCLQuest.editor.setValue('NETWORK Halb\n' + (ins[0] || 'Stoerung') + ' => ' + outs[0] + ';'); SCLQuest.compile();
    await new Promise(r => setTimeout(r, 400));
    return { id: t.id, solved: !!SCLQuest.session.solved, report: document.getElementById('reportBody').textContent };
  });
  ok(!r.solved && /WEITERE PRÜFUNG/.test(r.report) && /sollte/.test(r.report), 'halb richtig (' + r.id + '): „Weitere Prüfung“ mit Gegenbeispiel – ' + (r.report.match(/Bei [^.]*\./) || [''])[0]);
  // Tipp 3: Lösungsvorschlag
  const h = await P.evaluate(async () => {
    const t = SCLQuest.TASK_BY_ID['f4_sr']; SCLQuest.renderTask(t, false);
    SCLQuest.state.hints[t.id] = 0; for(let i = 0; i < 3; i++) document.getElementById('hintBtn').click();
    await new Promise(r => setTimeout(r, 200));
    return document.getElementById('hintBox').innerHTML;
  });
  ok(/Lösungsvorschlag/.test(h) && /möglicher Weg/.test(h), 'Tipp 3: Lösungsvorschlag als „ein möglicher Weg“');
  ok(!/Taste_FS|Aufloesung|FS_eingestellt/.test(h.replace(/<code>\?<\/code>/g, '')), 'Lösungsvorschlag verrät keine Operanden');
  await P.screenshot({ path: __dirname + '/shots/funktion_tipp3.png' });
  ok(!errors.length, 'FUP: keine JS-Fehler ' + errors.slice(0, 2).join(' | '));
  await browser.close();
  // ---------- SCL: CASE-Aufgabe mit IF gelöst ----------
  ({ browser, P, errors } = await start('index.html'));
  r = await solve(P, 'c5_umbau', 'IF Rezept = 1 THEN Soll_Temp := 180;\nELSIF Rezept = 2 THEN Soll_Temp := 220;\nELSIF Rezept = 3 OR Rezept = 4 THEN Soll_Temp := 250;\nELSIF Rezept = 5 THEN Soll_Temp := 200;\nELSIF Rezept >= 6 AND Rezept <= 9 THEN Soll_Temp := 160;\nELSE Soll_Temp := 0;\nEND_IF;');
  ok(r.solved && /CASE/.test(r.success), 'SCL: Rezeptliste mit IF statt CASE gelöst, Lernhinweis nennt CASE');
  r = await solve(P, 'c5_umbau', 'CASE Rezept OF\n  1: Soll_Temp := 180;\n  2: Soll_Temp := 220;\n  3, 4: Soll_Temp := 250;\n  5: Soll_Temp := 200;\n  6..8: Soll_Temp := 160;\nELSE\n  Soll_Temp := 0;\nEND_CASE;');
  ok(!r.solved, 'SCL: Bereich 6..8 statt 6..9 fällt durch');
  // Hilfsmerker in der Variablenliste, gedämpft
  const hv = await P.evaluate(() => [...document.querySelectorAll('#varList tr.pt-help')].map(tr => tr.textContent).join(' | '));
  ok(/Hilf_1/.test(hv) && /Hilfswert_2/.test(hv), 'freie Hilfsmerker in der Variablenliste');
  ok(!errors.length, 'SCL: keine JS-Fehler ' + errors.slice(0, 2).join(' | '));
  await browser.close();
  // ---------- AWL Profi: FC mit S/R → Lokaldaten-Rest ----------
  ({ browser, P, errors } = await start('awl.html'));
  const pr = await P.evaluate(async () => {
    const t = SCLQuest.TASK_BY_ID['ap11_speicher_dbg']; SCLQuest.renderTask(t, false);
    const codes = window.ProTask.startCodes(t); SCLQuest.setProCodes(codes); SCLQuest.compile(); await new Promise(r => setTimeout(r, 400));
    return { solved: !!SCLQuest.session.solved, report: document.getElementById('reportBody').textContent };
  });
  ok(!pr.solved, 'AWL: FC mit S ohne R fällt funktional durch (Lokaldaten-Rest wie in der CPU)');
  ok(!errors.length, 'AWL: keine JS-Fehler ' + errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log('Funktion zählt (Spiel): ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
