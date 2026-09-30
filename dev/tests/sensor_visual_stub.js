// Sensorwerkstatt: Visualisierungs-Stubs und Demo-Seite (Paket W3) – Ereignisse, Mock-Daten aller sechs Module, Anlagen-Hülle. Läuft ohne Server.
// Dieselbe Prüfung gilt später für die Module von Fable (W4/W5): gleiche Schnittstelle, gleiche Ereignisse.
const { open } = require('./pw.js');
let oks = 0, fails = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
(async () => {
  const { browser, page: P, errors } = await open({ file: 'dev/demo_visual.html', viewport: { width: 1366, height: 768 } });
  await P.waitForSelector('#wiring .sw25-part');
  const ids = await P.evaluate(() => Object.keys(DEMO.mock.tasks));
  ok(ids.length === 30, 'Demo kennt 30 Mock-Aufgaben in 6 Modulen');
  // 1. Alle Mock-Aufgaben lassen sich mounten; Adern, Zielklemmen und Zustandszeichen sind da (kein Scrollen nötig für den Einstieg)
  for(const id of ids){
    const r = await P.evaluate(id => {
      const m = DEMO.mock.tasks[id], el = document.getElementById('wiring');
      const v = SensorWiring25D.mount(el, { netlist: m.netlist, state: m.states.start });
      const out = { cores: el.querySelectorAll('[data-core]').length, terms: el.querySelectorAll('[data-terminal]').length, syms: el.querySelectorAll('.sw25-sym').length, targets: el.querySelectorAll('.rel-ziel').length,
        nlCores: m.netlist.parts.reduce((n, p) => n + p.cable.cores.length, 0), nlTerms: m.netlist.terminals.length };
      v.destroy(); return out;
    }, id);
    if(r.cores !== r.nlCores || r.terms !== r.nlTerms || r.syms !== r.cores) ok(false, id + ': Adern/Klemmen/Zeichen ' + JSON.stringify(r));
    else oks++;
  }
  // 2. Ereignisse: Antippen–Antippen, Ziehen, Lösen, Zeig mir
  await P.selectOption('#selModule', '1'); await P.selectOption('#selTask', 'w1_b1_anschliessen'); await P.selectOption('#selState', 'start');
  await P.evaluate(() => { window.EV = []; ['wireStart', 'wireDrop', 'wireRemove', 'helpShow', 'meterProbe'].forEach(e => DEMO.view().on(e, (...a) => EV.push([e, ...a]))); });
  await P.click('[data-core="B1:BN"]'); await P.click('[data-terminal="X2:5.L+"]');
  ok(JSON.stringify(await P.evaluate(() => EV)) === JSON.stringify([['wireStart', 'B1:BN'], ['wireDrop', 'B1:BN', 'X2:5.L+']]), 'Antippen–Antippen: wireStart, wireDrop(Ader, Klemme)');
  await P.evaluate(() => { EV.length = 0; });
  await P.dragAndDrop('[data-core="B1:BU"]', '[data-terminal="X2:5.M"]');
  const ev2 = await P.evaluate(() => EV);
  ok(ev2.some(e => e[0] === 'wireStart' && e[1] === 'B1:BU') && ev2.some(e => e[0] === 'wireDrop' && e[1] === 'B1:BU' && e[2] === 'X2:5.M'), 'Ziehen: wireStart, dann wireDrop auf die Zielklemme ' + JSON.stringify(ev2));
  await P.evaluate(() => { EV.length = 0; }); await P.focus('[data-core="B1:BK"]'); await P.keyboard.press('Delete');
  ok((await P.evaluate(() => EV)).some(e => e[0] === 'wireRemove' && e[1] === 'B1:BK'), 'Tastatur: Entf löst die Ader (wireRemove)');
  await P.evaluate(() => { EV.length = 0; }); await P.click('#btnHelp');
  const h = await P.evaluate(() => ({ ev: EV.slice(), pulse: [...document.querySelectorAll('.pulse')].map(x => x.dataset.core || x.dataset.terminal) }));
  ok(h.ev.some(e => e[0] === 'helpShow' && e[1] === 'B1:BN' && e[2] === 'X2:5.L+') && h.pulse.includes('B1:BN') && h.pulse.includes('X2:5.L+'), 'Zeig mir: helpShow, Ader und Zielklemme pulsieren ' + JSON.stringify(h));
  // 3. Zustandswechsel im Demo: falsche Ader trägt Zeichen ✗ und Text, nicht nur Farbe
  await P.selectOption('#selState', 'falsch');
  const f = await P.evaluate(() => [...document.querySelectorAll('[data-result="falsch"]')].map(b => b.textContent.includes('✗') && /falsch/.test(b.getAttribute('aria-label'))));
  ok(f.length >= 1 && f.every(Boolean), 'Falsche Ader: Zeichen ✗ und Text im aria-label');
  await P.selectOption('#selState', 'fertig');
  ok(await P.evaluate(() => [...document.querySelectorAll('.sw25-core')].every(b => b.dataset.result !== 'fehlt')), 'Zustand „fertig“: keine fehlende Ader');
  // 4. Anlage: Hülle um SensorScene
  const pl = await P.evaluate(() => { const p = DEMO.plant(); const c = document.querySelector('#plant canvas'); const o = { canvas: !!c, w: c && c.width, h: c && c.height, preset: p.preset, view: p.scene.view };
    p.scenePreset('tank'); o.tankView = p.scene.view; p.scenePreset('sortierstrecke'); o.sortView = p.scene.view;
    p.setChannels({ beltRunning: true, parts: [{ x: 0.3, material: 'stahl' }] }); p.focus('B1'); p.highlight(['B1', 'X2']); o.hl = p.highlighted.join(','); o.hlAttr = document.getElementById('plant').dataset.highlight;
    p.focus('tank'); o.focusTankView = p.scene.view; p.setView('small'); o.small = p.size; p.setView('large'); o.large = p.size; o.api = ['setChannels', 'scenePreset', 'focus', 'highlight', 'setView', 'destroy'].every(k => typeof p[k] === 'function'); return o; });
  ok(pl.canvas && pl.w > 100 && pl.preset === 'sortierstrecke', 'Anlage: Canvas gemountet (' + JSON.stringify(pl) + ')');
  ok(pl.tankView === 4 && pl.sortView === 2 && pl.focusTankView === 4, 'scenePreset: tank → Ansicht 4, sortierstrecke → Ansicht 2; focus("tank") fährt zur Tankansicht');
  ok(pl.hl === 'B1,X2' && pl.hlAttr === 'B1 X2' && pl.small === 'small' && pl.large === 'large' && pl.api, 'highlight/setView/API-Umfang');
  await P.check('#chkSmall'); await P.waitForTimeout(400);
  const sm = await P.evaluate(() => { const r = document.getElementById('plant').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  ok(sm[0] === 320 && sm[1] === 200, 'Anlage klein: 320×200 (' + sm + ')');
  for(const [n, st] of [['sortierstrecke', 'laeuft'], ['tank', 'heizt']]){   // Mock-Zustände der Anlage werden ohne Fehler angewendet
    const r = await P.evaluate(([n, st]) => { try { DEMO.plant().scenePreset(n).setChannels(DEMO.mock.plant[n][st]); return true; } catch(e){ return e.message; } }, [n, st]); ok(r === true, 'Mock-Anlagenzustand ' + n + '/' + st + ': ' + r);
  }
  await P.screenshot({ path: __dirname + '/shots/sensor_visual_demo.png' });
  ok(!errors.length, 'keine JS-Fehler' + (errors.length ? ': ' + [...new Set(errors)].slice(0, 4).join(' | ') : ''));
  await browser.close();
  console.log('Visualisierungs-Stubs: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
