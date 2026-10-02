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

(async () => {
  const { browser, page, errors } = await open({ file: 'dev/lab/fup_lab.html' });
  await f1(page);
  if(global.F2) await global.F2(page);
  ok(errors.length === 0, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? '\n' + fails + ' von ' + n + ' FEHLGESCHLAGEN' : '\nOK — ' + n + ' Prüfungen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
