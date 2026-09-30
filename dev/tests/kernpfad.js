// Feedback-Auftrag Paket 4: Kernpfad (5 Kernaufgaben je Kapitel, Training freiwillig), Schnellspur, „▶ Anlage testen“ (Probebetrieb)
// in allen vier Quests. Läuft offline gegen die gebauten Dateien.
const { open } = require('./pw.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } };
(async () => {
  for(const f of ['index.html', 'kop.html', 'fup.html', 'awl.html']){
    const q = f.replace('.html', '').replace('index', 'scl');
    const { browser, page: P, errors } = await open({ file: f, viewport: { width: 1366, height: 768 }, dpr: 1 });
    const KEY = await P.evaluate(() => window.QUEST ? window.QUEST.key : 'sclquest3_state_v4');
    await P.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 4, pos: 0, settings: { sound: false, speed: 0.03, motion: true } })), KEY);
    await P.reload(); await P.waitForTimeout(300); await P.fill('#playerName', 'Kern'); await P.click('#newGameBtn');
    await P.evaluate(() => { SCLQuest.state.tours = { basic: true, pro: true }; });
    // Kernpfad: 75 Trainingsaufgaben im Ablauf markiert, 5 Kernaufgaben je Kapitel
    const seq = await P.evaluate(() => { const T = SCLQuest.SEQ.filter(x => x.type === 'task'); return { n: T.length, training: T.filter(x => x.training).length, perCh: [...new Set(T.map(x => x.ch))].map(ch => T.filter(x => x.ch === ch && !x.training).length) }; });
    ok(seq.n === 150 && seq.training === 75 && seq.perCh.every(n => n === 5), q + ': Kernpfad 75 von 150, 5 je Kapitel (' + JSON.stringify(seq.perCh) + ')');
    // Ablauf: nach der ersten Kernaufgabe geht es mit der nächsten Kernaufgabe weiter (Training übersprungen)
    const flow = await P.evaluate(() => {
      const S = SCLQuest.state, T = SCLQuest.SEQ.filter(x => x.type === 'task' && x.ch === 1), core = T.filter(x => !x.training);
      S.doneTheory[SCLQuest.SEQ[0].id] = { score: 5, n: 5, attempts: 1 };
      // Kernaufgaben lösen, bis vor der nächsten Kernaufgabe Training liegt
      const firstTr = T.findIndex(x => x.training), k = core.findIndex(x => T.indexOf(x) > firstTr);
      core.slice(0, k).forEach(x => { S.doneTasks[x.id] = { stars: 3, points: 100, fails: 0, hints: 0 }; });
      core[0] = core[k - 1]; core[1] = core[k];
      SCLQuest.goToPos();
      const cur = SCLQuest.SEQ[S.pos];
      return { cur: cur && cur.id, theory: cur && cur.type === 'theory', want: core[1].id, skipped: T.slice(0, T.findIndex(x => x.id === core[1].id)).filter(x => x.training).map(x => x.id) };
    });
    ok(flow.cur === flow.want || (flow.theory && !flow.skipped.includes(flow.cur)), q + ': Ablauf springt zur nächsten Kernaufgabe (' + flow.cur + ', Training übersprungen: ' + flow.skipped.join(', ') + ')');
    // Training im Ablauf per Einstellung
    const tr = await P.evaluate(() => { const S = SCLQuest.state; S.settings.training = true; S.pos = 0; SCLQuest.goToPos(); const a = SCLQuest.SEQ[S.pos].id; S.settings.training = false; S.pos = 0; SCLQuest.goToPos(); return { a, b: SCLQuest.SEQ[S.pos].id, at: SCLQuest.SEQ.find(x => x.id === a).training }; });
    ok(tr.a !== tr.b && tr.at, q + ': Einstellung „Training im Ablauf“ wirkt (' + tr.a + ' / ' + tr.b + ')');
    // Karte: Training vor der aktuellen Position ist spielbar
    await P.evaluate(() => { document.querySelectorAll('.overlay, #levelIntroOverlay, #theoryOverlay').forEach(e => e.style.display = 'none'); document.getElementById('app').style.display = ''; });
    await P.click('#openMapBtn'); await P.waitForSelector('#mapGrid .map-chip');
    const chip = await P.$('#mapGrid .map-chip.open.trainchip');
    ok(!!chip, q + ': Karte zeigt übersprungenes Training als spielbar');
    if(chip){ await chip.click(); await P.waitForSelector('#mdOpen'); ok(/Training starten/.test(await P.textContent('#mdOpen')), q + ': Karte bietet „Training starten“'); await P.click('#mdOpen'); await P.waitForTimeout(300);
      ok(await P.evaluate(() => /Training \(freiwillig\)/.test(document.getElementById('taskTags').textContent) && !SCLQuest.session.practice), q + ': Trainingsaufgabe offen, zählt für den Fortschritt'); }
    // Probebetrieb „▶ Anlage testen“ auf der Referenzlösung einer Grundstufen-Aufgabe mit Bool-Eingängen
    await P.evaluate(() => { document.querySelectorAll('.overlay, #levelIntroOverlay, #theoryOverlay').forEach(e => e.style.display = 'none'); document.getElementById('app').style.display = ''; });
    const tid = await P.evaluate(() => { const t = SCLQuest.TASKS.find(t => !t.pro && t.level <= 3 && (t.testCases || []).some(c => Object.values(c.setup || {}).some(v => typeof v === 'boolean'))); SCLQuest.renderTask(t, false); SCLQuest.editor.setValue(t.refSolution); return t.id; });
    const fails0 = await P.evaluate(id => SCLQuest.state.fails[id] || 0, tid);
    await P.click('#simBtn'); await P.waitForSelector('.sim-table');
    ok(await P.evaluate(() => /Probebetrieb läuft/.test(document.getElementById('reportTitle').textContent)), q + ': ' + tid + ' Probebetrieb läuft');
    const outs = async () => P.evaluate(() => [...document.querySelectorAll('.sim-out')].map(td => td.textContent).join('|'));
    await P.waitForTimeout(400); const o1 = await outs();
    await P.evaluate(() => document.querySelectorAll('.sim-toggle').forEach(b => b.click()));
    await P.waitForTimeout(500); const o2 = await outs();
    ok(o1 !== o2, q + ': Eingänge schalten ändert die Ausgänge (' + o1 + ' → ' + o2 + ')');
    await P.click('#simStop');
    ok(await P.evaluate(id => (SCLQuest.state.fails[id] || 0), tid) === fails0, q + ': Probebetrieb zählt nicht als Fehlversuch');
    // Compiler-Fehler im Probebetrieb: Meldung, aber kein Fehlversuch
    await P.evaluate(() => SCLQuest.editor.setValue('dies ist kein Programm ;;'));
    await P.click('#simBtn'); await P.waitForTimeout(200);
    ok(await P.evaluate(id => /Probebetrieb nicht möglich/.test(document.getElementById('reportTitle').textContent) && (SCLQuest.state.fails[id] || 0) === 0, tid), q + ': Compiler-Fehler im Probebetrieb ohne Fehlversuch');
    // Profi: Probebetrieb auf der Referenz
    const pro = await P.evaluate(async () => { const t = SCLQuest.TASKS.find(t => t.pro && (t.timed || []).length); SCLQuest.renderTask(t, false); SCLQuest.setProCodes(window.ProTask.refCodes(t)); document.getElementById('simBtn').click(); await new Promise(r => setTimeout(r, 600)); const r = { id: t.id, run: /Probebetrieb läuft/.test(document.getElementById('reportTitle').textContent), outs: document.querySelectorAll('.sim-out').length }; document.getElementById('simBtn').click(); return r; });
    ok(pro.run && pro.outs > 0, q + ': Profi-Probebetrieb (' + pro.id + ', ' + pro.outs + ' Ausgänge)');
    // Schnellspur: erste Lösung ohne Hinweis → Knopf, wenn die nächste Kernaufgabe dasselbe übt
    const fl = await P.evaluate(() => {
      const S = SCLQuest.state, T = SCLQuest.TASKS.filter(t => t.core && !t.pro && !t.isBoss);
      for(const t of T){ S.doneTasks = {}; S.fastSkip = {}; S.fails = {}; S.hints = {};
        const i = SCLQuest.SEQ.findIndex(x => x.id === t.id); S.pos = i; SCLQuest.renderTask(t, false);
        const n = SCLQuest.SEQ.slice(i + 1).find(x => x.type === 'task' && !x.training && x.ch === t.level);
        const nt = n && SCLQuest.TASK_BY_ID[n.id];
        if(!nt || nt.isBoss || !((t.manualId && t.manualId === nt.manualId) || (t.mustUse || []).some(m => (nt.mustUse || []).includes(m)))) continue;
        SCLQuest.editor.setValue(t.refSolution); return { id: t.id, next: nt.id };
      }
      return null;
    });
    if(fl){
      await P.evaluate(() => SCLQuest.compile());
      await P.waitForSelector('#fastLaneBtn', { timeout: 15000 }).catch(() => {});
      ok(!!(await P.$('#fastLaneBtn')), q + ': Schnellspur-Knopf nach ' + fl.id + ' (nächste gleichartige: ' + fl.next + ')');
      if(await P.$('#fastLaneBtn')){ await P.click('#fastLaneBtn'); await P.waitForTimeout(300);
        ok(await P.evaluate(n => !!SCLQuest.state.fastSkip[n] && SCLQuest.SEQ[SCLQuest.state.pos].id !== n && !SCLQuest.state.doneTasks[n], fl.next), q + ': Schnellspur überspringt ' + fl.next + ' (nicht als gelöst gezählt)'); }
    } else ok(true, q + ': keine gleichartigen Kernaufgaben-Paare (Schnellspur nicht anwendbar)');
    ok(!errors.length, q + ': keine JS-Fehler' + (errors.length ? ' ' + errors.slice(0, 2).join(' | ') : ''));
    await browser.close();
  }
  console.log('Kernpfad/Probebetrieb: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
