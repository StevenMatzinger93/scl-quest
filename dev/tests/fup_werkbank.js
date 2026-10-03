// FUP-Werkbank im Labor (dev/lab/fup_lab.html): node tests/fup_werkbank.js
// F1: Boxen ziehen, verschieben, löschen, Rahmen, neues Netzwerk · F2: Kaskade, Draht, Abzweig, Video-Netzwerk, SR
// F3: Operanden nur mit Tastatur, SR aus leerer Box · F4: Rückgängig, Aufgabe lösen, 390 px, keine JS-Fehler
const { open } = require('./pw.js');
let fails = 0, n = 0;
const ok = (c, m) => { n++; if(c) console.log('✓ ' + m); else { fails++; console.log('✗ ' + m); } };
const graph = page => page.evaluate(() => JSON.parse(JSON.stringify(window.labEditor.graph())));
const text = page => page.evaluate(() => window.labEditor.getValue());
async function box(page, sel){ const b = await page.locator(sel).first().boundingBox(); if(!b) throw new Error('nicht sichtbar: ' + sel); return b; }
async function center(page, sel){ const b = await box(page, sel); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function drag(page, from, to, steps){
  if(from.y < 0 || to.y < 0 || from.y > 2000) throw new Error('Ziehpunkt ausserhalb des Fensters ' + JSON.stringify([from, to]));
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: steps || 8 }); await page.mouse.up();
  await page.waitForTimeout(60);
}
const nodeSel = (id) => 'g.fwb-node[data-node="' + id + '"]';
const pinSel = (id, pin) => 'rect.pin-hit[data-node="' + id + '"][data-pin="' + pin + '"]';
async function canvasPoint(page, ni, wx, wy){
  return page.evaluate(([ni, wx, wy]) => { const svg = document.querySelector('svg[data-net="' + ni + '"]'); svg.closest('.fwb-net').scrollIntoView({ block: 'nearest' }); const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return { x: r.left + wx * r.width / vb.width, y: r.top + wy * r.height / vb.height }; }, [ni, wx, wy]);
}

async function f1(page){
  console.log('— F1: Netzwerk, Leiste, Ziehen, Platzhalter');
  let g = await graph(page);
  ok(g.networks.length === 1 && g.networks[0].nodes.length === 0, 'leeres Netzwerk geladen');
  await drag(page, await center(page, '.fwb-bar [data-pal="and"]'), await canvasPoint(page, 0, 300, 90));
  g = await graph(page);
  ok(g.networks[0].nodes.length === 1 && g.networks[0].nodes[0].t === 'and', '& ins leere Netzwerk gezogen');
  ok(await page.locator('svg[data-net="0"] text.op-ph').count() >= 2, 'Platzhalter <??.?> an den Eingängen');
  ok(await page.locator('.fwb-net[data-net="0"] .fwb-bad').count() === 1, 'rotes ⊗ beim unvollständigen Netzwerk');
  await drag(page, await center(page, '.fwb-bar [data-pal="or"]'), await canvasPoint(page, 0, 560, 200));
  g = await graph(page);
  ok(g.networks[0].nodes.length === 2 && g.networks[0].nodes[1].t === 'or', '>=1 dazu gezogen');
  const a = g.networks[0].nodes[0];
  const hb = await box(page, nodeSel(a.id) + ' rect.n-head');
  await drag(page, { x: hb.x + hb.width / 2, y: hb.y + 6 }, { x: hb.x + hb.width / 2 + 96, y: hb.y + 6 + 48 });
  g = await graph(page);
  const a2 = g.networks[0].nodes.find(x => x.id === a.id);
  ok(a2.x > a.x + 60 && a2.y > a.y + 20 && a2.x % 16 === 0, 'Box verschoben (Raster)');
  // Löschen: >=1 antippen, Entf
  const o = g.networks[0].nodes[1];
  const ob = await box(page, nodeSel(o.id) + ' rect.n-head');
  await page.mouse.click(ob.x + ob.width / 2, ob.y + 6);
  await page.keyboard.press('Delete');
  g = await graph(page);
  ok(g.networks[0].nodes.length === 1, 'Box mit Entf gelöscht');
  // Neues Netzwerk unter dem letzten: & auf „+ Netzwerk“ ziehen
  await drag(page, await center(page, '.fwb-bar [data-pal="and"]'), await center(page, '[data-act="addnet"]'));
  g = await graph(page);
  ok(g.networks.length === 2 && g.networks[1].nodes.length === 1, 'neues Netzwerk unter dem letzten angelegt (Ablegen auf + Netzwerk)');
  // Rahmen ziehen markiert, Entf löscht
  const p1 = await canvasPoint(page, 1, 4, 4), p2 = await canvasPoint(page, 1, 700, 110);
  await drag(page, p1, p2);
  await page.keyboard.press('Delete');
  g = await graph(page);
  ok(g.networks[1].nodes.length === 0, 'Rahmen markiert, Entf löscht');
  // Bibliothek: TON aus der Seitenleiste
  await page.click('[data-act="lib"]');
  await drag(page, await center(page, '.fwb-lib [data-pal="ton"]'), await canvasPoint(page, 1, 320, 80));
  g = await graph(page);
  ok(g.networks[1].nodes.length === 1 && g.networks[1].nodes[0].t === 'ton', 'TON aus der Bibliothek gezogen'); if(process.env.DBG) console.log(JSON.stringify(g.networks.map(x => x.nodes.map(n => n.t))), await page.evaluate(() => document.querySelector('.fwb-status').textContent));
  await page.click('[data-act="lib"]');
  // Text zeigt das Format
  ok(/NETWORK/.test(await text(page)) && /TON\(\?, \?\)/.test(await text(page)), 'Textansicht mit Platzhaltern');
  await page.click('[data-act="delnet"][data-net="1"]');
}

const findNode = (g, ni, t, k) => g.networks[ni].nodes.filter(x => x.t === t)[k || 0];
async function pinPoint(page, id, pin){ return center(page, pinSel(id, pin)); }
async function f2(page){
  console.log('— F2: Verdrahten und Kaskadieren, Video-Netzwerk');
  await page.evaluate(() => window.labEditor.setValue('NETWORK Video\n'));
  // Drahttest in eigenem Netzwerk: zwei Boxen, Draht vom Ausgang auf einen Eingang
  await drag(page, await center(page, '.fwb-bar [data-pal="and"]'), await canvasPoint(page, 0, 260, 80));
  await drag(page, await center(page, '.fwb-bar [data-pal="or"]'), await canvasPoint(page, 0, 560, 160));
  let g = await graph(page);
  const A = findNode(g, 0, 'and'), O = findNode(g, 0, 'or');
  await drag(page, await pinPoint(page, A.id, 'out'), await pinPoint(page, O.id, 'in:1'));
  g = await graph(page);
  ok(g.networks[0].wires.some(w => w.s === A.id && w.d === O.id && w.p === 1), 'Draht vom Ausgang & zum Eingang IN2 von >=1 gezogen');
  // Tippen-Tippen: Ausgang antippen, dann Eingang antippen
  await page.click(pinSel(O.id, 'out'));
  await drag(page, await center(page, '.fwb-bar [data-pal="assign"]'), await canvasPoint(page, 0, 820, 80));
  g = await graph(page);
  const Q = findNode(g, 0, 'assign');
  await page.click(pinSel(O.id, 'out')); await page.click(pinSel(Q.id, 'in:0'));
  g = await graph(page);
  ok(g.networks[0].wires.some(w => w.s === O.id && w.d === Q.id), 'Tippen-Tippen verbindet Ausgang >=1 mit der Zuweisung');
  // Draht antippen + Entf löscht
  const wi = g.networks[0].wires.findIndex(w => w.s === A.id);
  const wp = await page.evaluate(wi => { const pth = document.querySelector('path.w-hit[data-net="0"][data-wire="' + wi + '"]'); const L = pth.getTotalLength(), pt = pth.getPointAtLength(L * 0.25), m = pth.getScreenCTM(); return { x: m.a * pt.x + m.e, y: m.d * pt.y + m.f }; }, wi);
  await page.mouse.click(wp.x, wp.y);
  await page.keyboard.press('Delete');
  g = await graph(page);
  ok(!g.networks[0].wires.some(w => w.s === A.id), 'Draht angetippt und mit Entf gelöscht');

  // Video-Netzwerk von vorne: & (3 Eingänge, erster negiert) → >=1 → =, plus SR daneben
  await page.evaluate(() => window.labEditor.setValue('NETWORK Video\n'));
  await drag(page, await center(page, '.fwb-bar [data-pal="and"]'), await canvasPoint(page, 0, 240, 90));
  g = await graph(page);
  const a = findNode(g, 0, 'and');
  await page.click('[data-star][data-node="' + a.id + '"] rect', { force: true });
  g = await graph(page);
  ok(findNode(g, 0, 'and').ins.length === 3, '* fügt einen dritten Eingang hinzu');
  await page.click('.fwb-bar [data-pal="tool:neg"]');
  await page.click(pinSel(a.id, 'in:0'));
  await page.keyboard.press('Escape');
  g = await graph(page);
  ok(findNode(g, 0, 'and').ins[0].neg === true, '-o| negiert den ersten Eingang');
  await drag(page, await center(page, '.fwb-bar [data-pal="or"]'), await pinPoint(page, a.id, 'out'));
  g = await graph(page);
  const o = findNode(g, 0, 'or');
  ok(o && g.networks[0].wires.some(w => w.s === a.id && w.d === o.id && w.p === 0), '>=1 auf den Ausgang von & gezogen → kaskadiert (oberer Eingang)');
  await drag(page, await center(page, '.fwb-bar [data-pal="assign"]'), await pinPoint(page, o.id, 'out'));
  g = await graph(page);
  const q = findNode(g, 0, 'assign');
  ok(q && g.networks[0].wires.some(w => w.s === o.id && w.d === q.id), 'Zuweisung an den Ausgang von >=1 gehängt');
  // Abzweig ↦ auf den Ausgang von >=1
  await drag(page, await center(page, '.fwb-bar [data-pal="tool:branch"]'), await pinPoint(page, o.id, 'out'));
  g = await graph(page);
  ok(g.networks[0].nodes.filter(x => x.t === 'assign').length === 2 && g.networks[0].wires.filter(w => w.s === o.id).length === 2, 'Abzweig: zweite Zuweisung am selben Ausgang');
  ok(/=> \?, \?;/.test(await text(page)), 'Abzweig im Text: zwei Ausgänge im selben Strompfad');
  // Rechtsklick „Eingang entfernen“
  await page.click(pinSel(a.id, 'in:2'), { button: 'right' });
  await page.click('.fwb-ctx button:has-text("Eingang entfernen")');
  g = await graph(page);
  ok(findNode(g, 0, 'and').ins.length === 2, 'Kontextmenü: Eingang entfernen');
  await page.click('[data-star][data-node="' + a.id + '"] rect', { force: true });
  // Abzweig wieder weg (zweite Zuweisung löschen)
  g = await graph(page);
  const q2 = g.networks[0].nodes.filter(x => x.t === 'assign')[1];
  await page.click(nodeSel(q2.id) + ' rect.n-head', { force: true }); await page.keyboard.press('Delete');
  // SR-Box daneben (Bibliothek)
  await page.click('[data-act="lib"]');
  const vbH = await page.evaluate(() => document.querySelector('svg[data-net="0"]').viewBox.baseVal.height);
  await drag(page, await center(page, '.fwb-lib [data-pal="sr"]'), await canvasPoint(page, 0, 420, vbH - 30));
  await page.click('[data-act="lib"]');
  g = await graph(page);
  ok(findNode(g, 0, 'sr'), 'SR-Box unter der Kette abgelegt');
  const t = await text(page);
  ok(/^NOT \? AND \? AND \? OR \? => \?;$/m.test(t), 'Text der Kette: NOT ? AND ? AND ? OR ? => ?;');
  ok(!/"k":1/.test(t) && /\n\? => SR\(\?, \?\);/.test(t) && (t.match(/NETWORK/g) || []).length === 1, 'SR als zweite Kette im selben NETWORK (V4, ohne // @fup k)');
  // V4: Draht vom Ausgang & auf den Rücksetz-Eingang R1 der SR-Box (Abzweig ohne Verdoppeln)
  {
    const and = findNode(g, 0, 'and'), sr = findNode(g, 0, 'sr');
    await drag(page, await pinPoint(page, and.id, 'out'), await pinPoint(page, sr.id, 'in:1'));
    const g2 = await graph(page), t2 = await text(page);
    ok(g2.networks[0].wires.some(w => w.s === and.id && w.d === sr.id && w.p === 1), 'V4: Draht an R1 der SR-Box angenommen');
    ok(/=> \$w1;/.test(t2) && /SR\(\?, \$w1\)/.test(t2) && (t2.match(/NOT \?/g) || []).length === 1, 'V4: Abzweig als Draht $w1, Logik nicht verdoppelt: ' + JSON.stringify(t2));
    await page.evaluate(t0 => window.labEditor.setValue(t0), t);
  }
  // Aufräumen: keine Überlappung
  await page.click('[data-act="cleanup"]');
  g = await graph(page);
  const ns = g.networks[0].nodes;
  const overl = ns.some((x, i) => ns.some((y, j) => j > i && x.x < y.x + 60 && y.x < x.x + 60 && x.y < y.y + 60 && y.y < x.y + 60));
  ok(!overl && ns.length === 4, 'Aufräumen ordnet ohne Überlappung an');
}

async function f3(page){
  console.log('— F3: Operanden wie im TIA Portal (nur Tastatur), leere Box → SR');
  // Video-Netzwerk aus F2 mit echten Stellwerk-Variablen füllen – nur Tastatur
  const FILL = [
    [/Eingang IN1 von &/, 'I2.0'],            // Adresse ohne % → Not_Aus
    [/Eingang IN2 von &/, 'gleis1_fr'],       // Teil des Namens → Vorschlag 1
    [/Eingang IN3 von &/, '%I3.1'],           // Adresse mit % → Taste_A
    [/Eingang IN2 von >=1/, 'Automatik'],
    [/Operand von =/, 'Signal_A'],
    [/Eingang S von SR/, 'Taste_FS'],
    [/Eingang R1 von SR/, 'M10.0'],
    [/Operand von SR/, 'FS_eingestellt']
  ];
  await page.focus('.fwb-net[data-net="0"] input[data-k="title"]');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Signal A');
  let filled = 0, guard = 0;
  while(filled < FILL.length && guard++ < 80){
    await page.keyboard.press('Tab');
    const lab = await page.evaluate(() => { const a = document.activeElement; return a && a.getAttribute ? a.getAttribute('aria-label') || '' : ''; });
    if(!/<\?\?\.\?>/.test(lab)) continue;
    const f = FILL.find(x => x[0].test(lab)); if(!f) continue;
    await page.keyboard.press('Enter');
    await page.keyboard.type(f[1], { delay: 10 });
    await page.keyboard.press('Enter');
    filled++;
  }
  ok(filled === FILL.length, 'alle ' + FILL.length + ' Platzhalter per Tab/Enter/Tippen gefüllt (' + filled + ')');
  const t = await text(page);
  ok(/^NOT Not_Aus AND Gleis1_frei AND Taste_A OR Automatik => Signal_A;$/m.test(t), 'Video-Netzwerk mit Stellwerk-Variablen: ' + (t.match(/^.*=> Signal_A;$/m) || [''])[0]);
  ok(/^Taste_FS => SR\(FS_eingestellt, Aufloesung\);$/m.test(t), 'SR-Box gefüllt (Adresse M10.0 → Aufloesung)');
  ok(/^NETWORK Signal A$/m.test(t), 'Netzwerktitel per Tastatur');
  ok(await page.locator('.fwb-net[data-net="0"] .fwb-good').count() === 1, 'Netzwerk vollständig (✓ statt ⊗)');
  ok(await page.locator('svg[data-net="0"] text.op-addr', { hasText: '%I2.0' }).count() === 1 && await page.locator('svg[data-net="0"] text.op-sym', { hasText: '"Not_Aus"' }).count() === 1, 'zweizeilig: Adresse grün, darunter "Symbol"');
  // Tooltip %Q4.1 / Bool
  const g = await graph(page);
  const q = findNode(g, 0, 'assign');
  await page.hover('[data-fk="s:0:' + q.id + ':top"] rect');
  await page.waitForTimeout(80);
  ok(/%Q4\.1 \/ Bool/.test(await page.evaluate(() => (document.querySelector('.fwb-tip') || {}).textContent || '')), 'Tooltip beim Überfahren: %Q4.1 / Bool');
  await page.mouse.move(2, 2);
  // Vorschlagsliste: Tippen filtert (Name, Adresse, Kommentar), Pfeiltaste + Enter
  await page.evaluate(() => window.labEditor.setValue('NETWORK Test\n? AND ? => ?;'));
  const g2 = await graph(page), a = findNode(g2, 0, 'and');
  await page.focus('[data-fk="s:0:' + a.id + ':in:0"]');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Schranke', { delay: 5 });
  const opts = await page.locator('.fwb-inline li').count();
  ok(opts >= 2, 'Vorschlagsliste filtert nach Kommentar/Name (' + opts + ' Treffer für „Schranke“)');
  await page.keyboard.press('ArrowDown');
  const second = await page.locator('.fwb-inline li[aria-selected="true"] .s-name').textContent();
  await page.keyboard.press('Enter');
  ok(findNode(await graph(page), 0, 'and').ins[0].op === second, 'Pfeiltaste + Enter übernimmt den Vorschlag (' + second + ')');
  // Unbekannter Name → rot + Hinweis
  await page.focus('[data-fk="s:0:' + a.id + ':in:1"]');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Gibtsnicht', { delay: 5 });
  ok(/Nicht in der PLC-Variablentabelle/.test(await page.locator('.fwb-inline .fwb-inhint').textContent()), 'Hinweis im Eingabefeld: Nicht in der PLC-Variablentabelle');
  await page.keyboard.press('Enter');
  ok(await page.locator('svg[data-net="0"] text.op-bad', { hasText: 'Gibtsnicht' }).count() === 1, 'unbekannter Operand rot dargestellt');
  ok(/Nicht in der PLC-Variablentabelle/.test(await page.locator('.fwb-net[data-net="0"] .fwb-msgs').textContent()), 'Meldung unter dem Netzwerk');
  // Variable aus der PLC-Tabelle auf einen Eingang ziehen
  await page.fill('#labTagFilter', 'Taste_B');
  await page.evaluate(() => window.scrollTo(0, 0));
  await drag(page, await center(page, '#labTags tr[data-var="Taste_B"]'), await center(page, '[data-fk="s:0:' + a.id + ':in:1"] rect'));
  ok(findNode(await graph(page), 0, 'and').ins[1].op === 'Taste_B', 'Variable aus der PLC-Tabelle auf den Eingang gezogen');
  if(process.env.DBG) console.log(await page.evaluate(() => [document.querySelector('.fwb-status').textContent, !!document.querySelector('.fwb-inline'), !!document.querySelector('.fwb-ghost'), document.activeElement && document.activeElement.outerHTML.slice(0, 120)]));
  await page.fill('#labTagFilter', '');
  // Leere Box ?? → „SR“ tippen
  await page.evaluate(() => { window.labEditor.setValue('NETWORK Leer\n'); window.scrollTo(0, 0); });
  await drag(page, await center(page, '.fwb-bar [data-pal="empty"]'), await canvasPoint(page, 0, 300, 90));
  let g3 = await graph(page); const e = findNode(g3, 0, 'empty');
  ok(!!e, 'leere Box ?? abgelegt');
  await page.focus('[data-fk="n:0:' + e.id + '"]');
  await page.keyboard.type('SR', { delay: 20 });
  await page.keyboard.press('Enter');
  g3 = await graph(page);
  const sr = g3.networks[0].nodes[0];
  ok(sr.t === 'sr' && sr.ins.map(p => p.n).join(',') === 'S,R1' && sr.opnd === '?', 'leere Box wird durch Tippen „SR“ zur SR-Box (S, R1, Operand oben)');
  // Timer: Instanzname über der Box, PT mit Typprüfung
  await page.evaluate(() => window.labEditor.setValue('NETWORK Timer\nZug_meldet AND TON(T_Vorlauf, Anzeige) => Schranke_zu;'));
  ok(await page.locator('svg[data-net="0"] g.fwb-op[data-slot="top"]', { hasText: 'T_Vorlauf' }).count() === 1, 'Timer: Instanzname über der Box');
  ok(/erwartet wird Time/.test(await page.locator('.fwb-net[data-net="0"] .fwb-msgs').textContent()), 'PT: Typprüfung (Int statt Time gemeldet)');
}

async function f4(page){
  console.log('— F4: Rückgängig, Kopieren, Zoom, Signalanzeige, Fehlermarke, Aufgabe lösen');
  await page.evaluate(() => { window.labEditor.setValue('NETWORK Undo\nTaste_A AND Gleis1_frei => Signal_A;'); window.scrollTo(0, 0); });
  let g = await graph(page);
  const a = findNode(g, 0, 'and');
  await page.click(nodeSel(a.id) + ' rect.n-head', { force: true });
  await page.keyboard.press('Delete');
  ok(!findNode(await graph(page), 0, 'and'), 'Box gelöscht');
  await page.keyboard.press('Control+z');
  g = await graph(page);
  ok(!!findNode(g, 0, 'and') && /Taste_A AND Gleis1_frei => Signal_A;/.test(await text(page)), 'Strg+Z stellt die gelöschte Box mit Drähten wieder her: ' + (await text(page)).replace(/\n/g, ' / '));
  await page.keyboard.press('Control+y');
  ok(!findNode(await graph(page), 0, 'and'), 'Strg+Y wiederholt das Löschen');
  await page.click('[data-act="undo"]');
  ok(!!findNode(await graph(page), 0, 'and'), 'Knopf ↶ macht rückgängig');
  // Kopieren/Einfügen
  await page.click(nodeSel(a.id) + ' rect.n-head', { force: true });
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  g = await graph(page);
  ok(g.networks[0].nodes.filter(x => x.t === 'and').length === 2, 'Strg+C / Strg+V kopiert eine Box');
  await page.keyboard.press('Control+z');
  await page.click('[data-act="dupnet"][data-net="0"]');
  ok((await graph(page)).networks.length === 2, 'Netzwerk kopiert');
  await page.keyboard.press('Control+z');
  // Tastatur: Pfeile verschieben, * fügt Eingang hinzu
  const x0 = findNode(await graph(page), 0, 'and').x;
  await page.focus('[data-fk="n:0:' + a.id + '"]');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('*');
  g = await graph(page);
  ok(findNode(g, 0, 'and').x === x0 + 16 && findNode(g, 0, 'and').ins.length === 3, 'Pfeiltaste verschiebt, * fügt Eingang hinzu');
  const aria = await page.getAttribute('[data-fk="n:0:' + a.id + '"]', 'aria-label');
  ok(/UND-Box/.test(aria) && /3 Eingänge/.test(aria), 'ARIA-Beschriftung der Box: ' + aria);
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
  // Zoom
  const w1 = await page.evaluate(() => document.querySelector('svg[data-net="0"]').getBoundingClientRect().width);
  await page.click('[data-act="zoomin"]');
  const w2 = await page.evaluate(() => document.querySelector('svg[data-net="0"]').getBoundingClientRect().width);
  await page.hover('svg[data-net="0"]'); await page.keyboard.down('Control'); await page.mouse.wheel(0, 200); await page.keyboard.up('Control');
  const w3 = await page.evaluate(() => document.querySelector('svg[data-net="0"]').getBoundingClientRect().width);
  ok(w2 > w1 * 1.1 && w3 < w2, 'Zoom: + vergrössert, Strg+Mausrad verkleinert');
  await page.evaluate(() => window.labEditor.setZoom(1));
  // Fehler aus dem Übersetzen markiert die Box
  await page.evaluate(() => window.labEditor.setValue('NETWORK Fehler\n? AND Taste_A => Signal_A;'));
  await page.click('#labTranslate');
  ok(await page.locator('svg[data-net="0"] g.fwb-node.fwb-errn').count() >= 1 && /noch keine Variable/.test(await page.locator('.fwb-net[data-net="0"] .fwb-msgs').textContent()), 'Übersetzungsfehler markiert die Box (setErrorMark)');
  // Aufgabe aus dem Labor lösen: Kapitel 6 (TON), nur Ziehen + Tippen + Variablen antippen
  await page.selectOption('#labTask', 'f6_ton');
  await page.evaluate(() => window.scrollTo(0, 0));
  g = await graph(page);
  const q = findNode(g, 0, 'assign');
  await page.click('[data-act="lib"]');
  await drag(page, await center(page, '.fwb-lib [data-pal="ton"]'), await pinPoint(page, q.id, 'in:0'));
  await page.click('[data-act="lib"]');
  g = await graph(page);
  const ton = findNode(g, 0, 'ton');
  ok(ton && g.networks[0].wires.some(w => w.s === ton.id && w.d === q.id), 'TON auf den Eingang der Zuweisung gezogen');
  // Eingang antippen, dann Variable in der PLC-Tabelle antippen
  await page.click(pinSel(ton.id, 'in:0'));
  await page.fill('#labTagFilter', 'Zug_meldet'); await page.click('#labTags tr[data-var="Zug_meldet"]');
  ok(findNode(await graph(page), 0, 'ton').ins[0].op === 'Zug_meldet', 'Eingang antippen + Variable antippen');
  await page.fill('#labTagFilter', '');
  const fill = async (slot, txt) => { await page.focus('[data-fk="s:0:' + slot + '"]'); await page.keyboard.press('Enter'); await page.keyboard.type(txt, { delay: 5 }); await page.keyboard.press('Enter'); };
  await fill(ton.id + ':top', 'T_Vorlauf');
  await fill(ton.id + ':in:1', 't#3s');
  await fill(q.id + ':top', 'Schranke_zu');
  await page.click('#labCheck');
  ok(await page.locator('#labPass').count() === 1, 'Aufgabe f6_ton mit „Prüfen“ gelöst: ' + (await page.locator('#labResult').textContent()).slice(0, 120));
  // Simulation: Eingang anklicken → Signal grün
  await page.click('#labSim');
  await page.click('#labSimIn [data-in="Zug_meldet"]');
  await page.waitForTimeout(400);
  ok(await page.locator('svg[data-net="0"] g.fwb-op.op-on').count() >= 1, 'Simulation: Eingang 1 → Operand grün (showFlow)');
  await page.waitForTimeout(3100);
  ok(await page.locator('svg[data-net="0"] path.w.on').count() >= 1 && await page.locator('#labSimOut .lab-lamp.on').count() === 1, 'nach 3 s: Draht TON → Zuweisung grün, Ausgang leuchtet');
  await page.click('#labSim');
}
async function mobile(){
  console.log('— 390 px');
  const { browser, page, errors } = await open({ file: 'dev/lab/fup_lab.html', viewport: { width: 390, height: 844 } });
  await page.selectOption('#labTask', 'f1_signal');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 392, 'keine waagrechte Seiten-Scrollleiste bei 390 px (' + sw + ')');
  const g = await graph(page), q = findNode(g, 0, 'assign');
  const pw = await page.evaluate(id => document.querySelector('rect.pin-hit[data-node="' + id + '"]').getBoundingClientRect().width, q.id);
  ok(pw >= 32, 'Trefferfläche der Anschlüsse ≥ 32 px (' + Math.round(pw) + ')');
  await page.click('[data-fk="s:0:' + q.id + ':in:0"] rect');
  await page.keyboard.type('Taste_A'); await page.keyboard.press('Enter');
  await page.click('[data-fk="s:0:' + q.id + ':top"] rect');
  await page.keyboard.type('Signal_A'); await page.keyboard.press('Enter');
  await page.click('#labCheck');
  ok(await page.locator('#labPass').count() === 1, '390 px: Aufgabe f1_signal gelöst');
  // Tippen-Tippen: & antippen, dann Eingang der Zuweisung antippen
  await page.click('.fwb-bar [data-pal="and"]');
  await page.click(pinSel(q.id, 'in:0'));
  const g2 = await graph(page);
  ok(!!findNode(g2, 0, 'and') && g2.networks[0].wires.length === 1 && findNode(g2, 0, 'and').ins[0].op === 'Taste_A', '390 px: & antippen + Eingang antippen = Box davor (Operand wandert mit)');
  const sw2 = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw2 <= 392, 'nach dem Bearbeiten weiterhin 390 px breit');
  await page.screenshot({ path: require('path').join(__dirname, 'shots', 'fup_werkbank_390.png') }).catch(() => {});
  ok(errors.length === 0, '390 px ohne JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
}

(async () => {
  const { browser, page, errors } = await open({ file: 'dev/lab/fup_lab.html' });
  await f1(page);
  await f2(page);
  await f3(page);
  await f4(page);
  ok(errors.length === 0, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  require('fs').mkdirSync(require('path').join(__dirname, 'shots'), { recursive: true });
  await mobile();
  console.log(fails ? '\n' + fails + ' von ' + n + ' FEHLGESCHLAGEN' : '\nOK — ' + n + ' Prüfungen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
