(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT v2 — Kernschleife im Spiel (Paket W6, docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md Abschnitte 3, 4, 6)
   Phasenleiste ① Verbinden → ② Signale → ③ Programm → ④ Laufen lassen (SensorFlow), Arbeitsfläche je Phase:
     ① 2.5D-Verdrahtung (SensorWiring25D, Ereignisse → SensorVisual.apply)
     ② PLC-Variablen / Gerätesicht (Engineering eingebettet)   ③ Programm SCL/FUP (Engineering eingebettet)
     ④ grosse Anlage (SensorPlant3D) mit Bedienung, Einstellen (Abstand/Poti/Teach), Beobachtung, Messwerten, Multimeter/Kalibrator
   Kleine Live-Anlage immer sichtbar (dieselbe Szene, umgehängt). Mechanik automatisch (sensor_tasks.newContext).
   „▶ Laufen lassen“: Programm/Variablen/Konfiguration laden, CPU RUN, Probebetrieb – zählt nie als Fehlversuch. „Prüfen“ bleibt getrennt.
   Gilt für Aufgaben mit core:true; versteckte Aufgaben laufen weiter in der alten Werkstatt (sensor_game.js).
   API wie SensorGame: create(hooks) → { setup, check, report, structHint, reveal, reset, solution, applyRef, activate, run, … }
   ============================================================ */
const ST = () => root.SensorTasks, W = () => root.Wiring, PLC = () => root.SensorPLC, SV = () => root.SensorVisual, FL = () => root.SensorFlow;
const PH = ['verbinden', 'signale', 'programm', 'laufen'];
const PH_LABEL = { verbinden: 'Verbinden', signale: 'Signale', programm: 'Programm', laufen: 'Laufen lassen' };
const PH_ICON = { verbinden: 'fa-plug', signale: 'fa-table-list', programm: 'fa-code', laufen: 'fa-play' };
const MATERIAL_OPTS = [['', 'kein Teil'], ['stahl', 'Stahl'], ['edelstahl', 'Edelstahl'], ['aluminium', 'Aluminium'], ['messing', 'Messing'], ['kunststoff_w', 'Kunststoff weiss'], ['kunststoff_s', 'Kunststoff schwarz'], ['glas', 'Glas']];
const SENSOR_AT = { B1: 0.29, B2: 0.44, B3: 0.59, 'B4.2': 0.74, B5: 1.11, N1: 0.2 };
const PART_OF_LIVE = { 'B4.2': 'B4' };
const BUTTONS = { S1: 'Start', S2: 'Stopp', S3: 'Not-Halt', S4: 'Auto' };
const PHYS = { B10: ['Abstand', 'mm', 0, 800, 300], B11: ['Druck', 'mbar', 0, 100, 50], B12: ['Temperatur', '°C', 0, 100, 20], B13: ['Durchfluss', 'l/min', 0, 20, 10], R1: ['Sollwert', '%', 0, 100, 50] };
const STATE_SYM = { leer: '–', gesperrt: '🔒', offen: '○', bereit: '●', erledigt: '✓' };
const STATE_TXT = { leer: 'nichts zu tun', gesperrt: 'gesperrt', offen: 'offen', bereit: 'bereit', erledigt: 'erledigt' };

function create(h){
  const $ = id => document.getElementById(id), esc = h.esc;
  let t = null, ctx = null, flow = null, view = null, plant = null, eng = null, sess = null, timer = 0, tick = 0, practice = false, active = false;
  let phase = 'verbinden', lastSig = '', tank = null, tankOn = false, meter = { mode: 'V', a: '', b: '', probe: 1 };
  const live = { parts: {}, press: [], hood: 'zu', b8: false, b9: true };
  const livePhys = {};
  const events = [];   // Messung W8: Zeitstempel-Ereignisse der Aufgabe
  const logEv = (type, data) => { const ev = Object.assign({ type, at: Date.now(), task: t && t.id, phase }, data || {}); events.push(ev); measure(ev); if(h.onEvent) h.onEvent(ev); };
  // Zusammenfassung je Aufgabe im Spielstand (S.sensorMetrics[id]) – wird mit dem Konto synchronisiert, der Leitstand wertet sie aus.
  // firstWireMs: Zeit vom ersten Öffnen bis zur ersten aufgelegten Ader (Ziel < 30 s); aborts: verlassen ohne Lösung; help: „Zeig mir“; phaseMs: Zeit je Phase.
  let M = null;
  const IDLE_CAP = 10 * 60e3;
  function mrec(){ const S = h.S(); S.sensorMetrics = S.sensorMetrics || {}; return S.sensorMetrics[t.id] = S.sensorMetrics[t.id] || { opens: 0, checks: 0, help: 0, aborts: 0, firstGrabMs: null, firstWireMs: null, solvedMs: null, phaseMs: {} }; }
  function flushPhase(r, now){ if(!M) return; const d = Math.min(IDLE_CAP, now - M.phaseAt); r.phaseMs[M.phase] = (r.phaseMs[M.phase] || 0) + d; M.active += d; M.phaseAt = now; }
  function measure(ev){
    if(!t || practice || document.body.classList.contains('exam-mode')) return;
    const r = mrec(), now = ev.at;
    if(ev.type === 'open'){ r.opens++; M = { start: now, phaseAt: now, phase, active: 0, done: !!h.S().doneTasks[t.id] }; return; }
    if(!M) return;
    if(ev.type === 'phase'){ flushPhase(r, now); M.phase = ev.to; }
    else if(ev.type === 'firstGrab' && r.firstGrabMs == null) r.firstGrabMs = now - M.start;
    else if(ev.type === 'firstWire' && r.firstWireMs == null) r.firstWireMs = now - M.start;
    else if(ev.type === 'help') r.help++;
    else if(ev.type === 'check'){ r.checks++; if(ev.ok && !M.done){ M.done = true; flushPhase(r, now); if(r.solvedMs == null) r.solvedMs = M.active; } }
    else if(ev.type === 'leave'){ flushPhase(r, now); if(!M.done) r.aborts++; M = null; if(h.saveSoon) h.saveSoon(); }
  }
  const leave = () => { if(M) logEv('leave'); };
  window.addEventListener('pagehide', () => { if(active) leave(); });

  /* ---------- DOM ---------- */
  const left = document.querySelector('.panel-left'), right = document.querySelector('.panel-right');
  const card = document.createElement('div'); card.className = 'card sv-card'; card.id = 'svCard'; card.hidden = true;
  card.innerHTML = '<nav class="sv-phases" id="svPhases" role="tablist" aria-label="Arbeitsphasen"></nav>'
    + '<div class="sv-bar"><span class="sv-status" id="svStatus" role="status" aria-live="polite"></span>'
    + '<button type="button" class="btn" id="svHelp"><i class="fa-solid fa-location-crosshairs"></i> Zeig mir</button>'
    + '<button type="button" class="btn sv-accept" id="svAccept" hidden></button>'
    + '<button type="button" class="btn sv-run" id="svRun"><i class="fa-solid fa-play"></i> Laufen lassen</button></div>'
    + '<div class="sv-work" id="svWork">'
    + '<section class="sv-pane" data-pane="verbinden"><div id="svWiring"></div></section>'
    + '<section class="sv-pane" data-pane="eng"><div id="svEng"></div></section>'
    + '<section class="sv-pane" data-pane="laufen"><div class="sv-run-grid"><div class="sv-plant-big" id="svPlantBig"></div><div class="sv-controls" id="svControls"></div></div></section>'
    + '</div><div class="sv-questions" id="svQuestions"></div>';
  const tile = document.createElement('div'); tile.className = 'card sv-tile'; tile.id = 'svTile'; tile.hidden = true;
  tile.innerHTML = '<div class="card-label"><i class="fa-solid fa-video" aria-hidden="true"></i> Live-Anlage <span class="sv-tile-note" id="svTileNote"></span></div><div class="sv-plant-small" id="svPlantSmall"></div>';
  const plantHost = document.createElement('div'); plantHost.className = 'sv-plant-host';
  const cb = $('compileBtn');
  right.insertBefore(card, cb || right.firstChild);
  left.appendChild(tile);

  function activate(on){
    active = !!on; card.hidden = !on; tile.hidden = !on;
    const ib = $('svInfo'); if(ib && !on) ib.hidden = true;
    document.body.classList.toggle('sensor-v2', active);
    ['.scene-card', '.editor-card', '.radio-card'].forEach(sel => { const e = document.querySelector(sel); if(e && on) e.style.display = 'none'; });
    const vp = $('varPanel'); if(vp && on) vp.style.display = 'none';
    if(cb && on) cb.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Prüfen <kbd>Strg</kbd>+<kbd>Enter</kbd>';
    if(!on){ leave(); stopLoop(); if(plant){ try { plant.destroy(); } catch(e){} plant = null; } }
  }

  /* ---------- Aufgabe aufbauen ---------- */
  function setup(task, isPractice){
    leave();
    t = task; practice = !!isPractice; events.length = 0;
    const S = h.S(), d = !practice && S.drafts[t.id] && typeof S.drafts[t.id] === 'object' ? S.drafts[t.id] : null;
    ctx = ST().newContext(t);
    let snap = null;
    if(d && d.v2){ try { ctx.state = W().newState(d.state); ctx.hw = d.hw || ctx.hw; ctx.tags = d.tags || ctx.tags; ctx.lang = d.lang === 'kop' ? 'fup' : (d.lang || ctx.lang); ctx.source = d.source != null ? d.source : ctx.source; ctx.answers = d.answers || {}; snap = d.flow || null; } catch(e){ ctx = ST().newContext(t); } }
    ctx.state.level = 'schnell'; ctx.state.mainSwitch = true;
    flow = FL().create(t, snap);
    build();
    phase = flow.current;
    showPhase(phase, true);
    renderInfo();
    const auto = t.steps.filter(s => ST().isAutoStep(t, s) && s.kind !== 'power').length;
    if(auto && !d) h.meister(t.steps.some(s => s.kind === 'mount') ? 'Sensor sitzt, Leitung steckt. Du kannst direkt loslegen.' : 'Leitung steckt. Du kannst direkt loslegen.');
    logEv('open');
  }
  function build(){
    stopLoop();
    if(view){ view.destroy(); view = null; } if(eng){ eng.destroy(); eng = null; }
    Object.keys(live.parts).forEach(k => delete live.parts[k]); live.press = []; live.hood = 'zu'; live.b8 = false; live.b9 = true;
    Object.keys(PHYS).forEach(k => { if((t.parts || []).includes(k)) livePhys[k] = PHYS[k][4]; });
    tank = root.SensorModel.tankNew({ level: 0.2 }); tankOn = false; meter = { mode: 'V', a: '', b: '', probe: 1 };
    ctx.state.calib = ctx.state.calib || { on: false, channel: 'CH0', mA: 4, mode: 'quelle' };
    sess = PLC().session({ cpu: ctx.cpu, state: () => ctx.state, world: liveWorld, phys: () => livePhys });
    // ① 2.5D-Verdrahtung
    view = root.SensorWiring25D.mount($('svWiring'), { netlist: SV().netlist(t, ctx), state: visState(), options: { lang: 'de', reducedMotion: !!h.S().settings.motion, touch: root.matchMedia ? root.matchMedia('(pointer:coarse)').matches : false, colorAid: !!h.S().settings.colorAid } });
    view.on('wireStart', core => { if(!events.some(e => e.type === 'firstGrab')) logEv('firstGrab', { core }); });
    view.on('wireDrop', (core, term) => { const r = SV().apply(t, ctx, { type: 'wireDrop', core, terminal: term }); logEv('wireDrop', { core, term, ok: r.ok }); if(!events.some(e => e.type === 'firstWire')) logEv('firstWire', { core, term }); sound('snap'); changed(); refreshView(true); });
    view.on('wireRemove', core => { SV().apply(t, ctx, { type: 'wireRemove', core }); sound('unsnap'); changed(); refreshView(true); });
    view.on('meterProbe', term => { if(!(t.tools || []).includes('multimeter')) return; if(meter.probe === 1){ meter.a = term; meter.probe = 2; } else { meter.b = term; meter.probe = 1; } renderControls(); });
    // ②/③ Engineering eingebettet
    const tagsExtra = t.program && t.program.tagsExtra ? t.program.tagsExtra.map(x => x.name) : [];
    eng = root.Engineering.mount($('svEng'), { cpu: ctx.cpu, hw: ctx.hw, tags: ctx.tags, source: ctx.source, lang: ctx.lang, langs: t.program ? (t.program.langs || ['scl']) : ['scl', 'fup'], starts: t.program && t.program.start,
      watch: watchFor(tagsExtra), tab: 'tags', onChange: o => { ctx.source = o.source; ctx.lang = o.lang; changed(); }, onLoad: () => changed() });
    // Anlage (eine Szene, zwischen klein und gross umgehängt)
    if(!plant && root.SensorPlant3D && root.SensorScene && root.SensorScene.isAvailable()){
      try { $('svPlantSmall').appendChild(plantHost); plant = root.SensorPlant3D.mount(plantHost, { preset: t.scene || 'sortierstrecke', quality: 'auto', reducedMotion: !!h.S().settings.motion, size: 'small' }); }
      catch(e){ plant = null; $('svTileNote').textContent = '(3D nicht verfügbar)'; }
    }
    if(plant){ plant.scenePreset(t.scene || 'sortierstrecke'); plant.setLabels(true); plant.highlight([]); }
    renderPhases(); renderControls(); renderQuestions();
    startLoop();
  }
  function visState(){ return SV().state(t, ctx, { world: liveScenario() }); }
  function liveScenario(){ return Object.assign({}, live, { parts: Object.assign({}, live.parts), cyl: sess && sess.out && sess.out['Q0.2'] ? 'vorne' : 'hinten', t: sess ? sess.t : 0 }); }
  function liveWorld(){ return ST().worldFrom(ctx.state, liveScenario()); }
  function watchFor(extra){
    const di = (t.parts || []).map(p => (W().PARTS[p] || {}).di || '').filter(Boolean), ai = (t.parts || []).map(p => (W().PARTS[p] || {}).ai).filter(Boolean).map(ch => '%' + PLC().AI_ADDR[ch]);
    const names = PLC().TAGS_WERKSTATT.filter(x => di.some(a => '%' + a === x.addr) || ai.includes(x.addr)).map(x => x.name).concat(extra).concat(measureTags());
    const u = [...new Set(names)].slice(0, 10); return u.length ? u : ['%I0.4', '%Q0.0'];
  }
  function measureTags(){ return t.steps.filter(s => s.kind === 'measure').flatMap(s => (s.ask || []).map(a => (/"([^"]+)"/.exec(a.q || '') || [])[1]).filter(Boolean)); }

  /* ---------- Infokarte und Lernziel (Umbau 4/5.4) ---------- */
  function renderInfo(){
    let box = $('svInfo'); const td = $('taskDescription');
    if(!box && td){ box = document.createElement('details'); box.id = 'svInfo'; box.className = 'sv-info'; td.parentNode.insertBefore(box, td.nextSibling); }
    if(box){ box.hidden = !t.info; box.open = true; box.innerHTML = '<summary><i class="fa-solid fa-circle-info"></i> Infokarte</summary><div class="sv-info-body">' + (t.info || '') + '</div>'; }
    const lg = $('learnGoal'); if(lg) lg.classList.add('sv-learn');
  }
  /* ---------- Phasen ---------- */
  function renderPhases(){
    const st = flow.status(ctx);
    $('svPhases').innerHTML = st.map((x, i) => '<button type="button" role="tab" class="sv-ph st-' + x.state + (x.key === phase ? ' on' : '') + (x.focus ? ' focus' : '') + '" data-ph="' + x.key + '" aria-selected="' + (x.key === phase) + '"'
      + (x.state === 'gesperrt' ? ' aria-disabled="true"' : '') + ' title="' + esc(PH_LABEL[x.key] + ': ' + STATE_TXT[x.state] + (x.kind === 'vorbefuellt' ? ' (vorgegeben)' : '')) + '">'
      + '<span class="sv-no">' + (i + 1) + '</span><i class="fa-solid ' + PH_ICON[x.key] + '" aria-hidden="true"></i><span class="sv-lbl">' + PH_LABEL[x.key] + '</span><b class="sv-sym" aria-hidden="true">' + STATE_SYM[x.state] + '</b>'
      + '<span class="sr-only">, ' + STATE_TXT[x.state] + (x.kind === 'vorbefuellt' ? ', vorgegeben' : '') + '</span></button>').join('');
    const cur = st.find(x => x.key === phase) || st[0];
    const acc = $('svAccept');
    acc.hidden = !(cur.state === 'bereit' && phase !== 'laufen');
    acc.innerHTML = cur.kind === 'vorbefuellt' ? '<i class="fa-solid fa-check"></i> Übernehmen' : '<i class="fa-solid fa-arrow-right"></i> Weiter';
    const canRun = flow.canRun(ctx);
    $('svRun').disabled = !canRun; $('svRun').title = canRun ? 'Probebetrieb starten (zählt nie als Fehlversuch)' : 'Erst die Phasen davor abschliessen';
    $('svStatus').innerHTML = statusText(cur);
    $('svTileNote').textContent = ctx.cpu.mode === 'RUN' ? '· RUN' : '';
  }
  function statusText(cur){
    if(cur.state === 'leer') return 'In dieser Aufgabe gibt es hier nichts zu tun.';
    if(cur.state === 'gesperrt') return 'Zuerst ' + PH.slice(0, 3).filter(p => { const s = flow.status(ctx).find(x => x.key === p); return s.state !== 'erledigt' && s.state !== 'leer'; }).map(p => '<b>' + PH_LABEL[p] + '</b>').join(', ') + ' abschliessen.';
    if(cur.state === 'erledigt') return '<span class="ok">✓ ' + PH_LABEL[cur.key] + ' erledigt.</span>';
    if(cur.state === 'bereit') return cur.key === 'laufen' ? 'Alles bereit: <b>▶ Laufen lassen</b> und zuschauen.' : cur.kind === 'vorbefuellt' ? 'Diese Phase ist vorgegeben – ansehen und <b>Übernehmen</b>.' : '<span class="ok">✓ Erfüllt</span> – <b>Weiter</b>.';
    return cur.kind === 'vorbefuellt' ? 'Vorgegeben, aber geändert: ' + esc(cur.issues[0] || '') : (cur.issues.length ? 'Noch offen: ' + esc(cur.issues[0]) : '');
  }
  function showPhase(p, silent){
    const st = flow.status(ctx).find(x => x.key === p);
    if(st && st.state === 'gesperrt' && !silent){ $('svStatus').innerHTML = statusText(st); return; }
    const g = flow.goto(ctx, p); if(!g.ok && !silent && p !== 'laufen'){ $('svStatus').textContent = g.reason; }
    phase = p; logEv('phase', { to: p });
    document.querySelectorAll('#svWork .sv-pane').forEach(el => { el.hidden = !(el.dataset.pane === p || (el.dataset.pane === 'eng' && (p === 'signale' || p === 'programm'))); });
    if(p === 'signale') eng.tab(t.steps.some(s => s.kind === 'tags') || !t.steps.some(s => s.kind === 'config') ? 'tags' : 'device');
    if(p === 'programm') eng.tab('program');
    // Anlage: gross in ④, sonst klein
    if(plant){ const big = p === 'laufen'; (big ? $('svPlantBig') : $('svPlantSmall')).appendChild(plantHost); plant.setView(big ? 'large' : 'small'); plant.setLabels(big); tile.classList.toggle('sv-tile-empty', big); }
    renderPhases(); renderQuestions(); if(p === 'laufen') renderControls(); else refreshView(true);
  }
  card.addEventListener('click', e => {
    const b = e.target.closest('[data-ph]'); if(b){ showPhase(b.dataset.ph); return; }
    if(e.target.closest('#svAccept')){ sync(); const r = flow.accept(ctx, phase); if(!r.ok){ $('svStatus').textContent = r.reason; return; } logEv('accept', { phase }); changed(); showPhase(flow.current); return; }
    if(e.target.closest('#svRun')){ run(); return; }
    if(e.target.closest('#svHelp')){ help(); return; }
  });
  card.addEventListener('keydown', e => {
    const b = e.target.closest && e.target.closest('[data-ph]'); if(!b || !/^Arrow(Left|Right)$/.test(e.key)) return;
    const list = [...card.querySelectorAll('[data-ph]')], i = list.indexOf(b), n = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]; e.preventDefault(); n.focus();
  });

  /* ---------- Zeig mir ---------- */
  function help(){
    logEv('help');
    const st = flow.status(ctx).find(x => x.key === phase);
    if(phase === 'verbinden'){
      const hh = SV().help(t, ctx);
      if(hh){ view.help(hh.core || undefined); if(plant && hh.core){ const pid = hh.core.split(':')[0]; plant.highlight([pid]); } $('svStatus').textContent = hh.text; return; }
    }
    if(phase === 'laufen'){
      const adj = t.steps.map((s, i) => [s, i]).find(([s, i]) => ST().isAdjust(s) && !ST().checkStep(s, ctx, i).ok);
      if(adj && plant){ plant.focus(adj[0].part); plant.highlight([adj[0].part]); }
      else if(plant){ plant.highlight((t.parts || []).filter(p => /^[BSN]\d/.test(p)).slice(0, 3)); }
    }
    if(phase === 'signale' || phase === 'programm'){ const q = document.querySelector('#svEng .eng-errs li, #svEng .eng-tags tr.bad input'); if(q && q.scrollIntoView) q.scrollIntoView({ block: 'nearest' }); }
    $('svStatus').innerHTML = st && st.issues.length ? 'Tipp: ' + esc(st.issues[0]) : statusText(st || flow.status(ctx)[0]);
  }

  /* ---------- Laufen lassen (Probebetrieb) ---------- */
  function loadCpu(){
    sync();
    const r = ctx.cpu.download({ source: t.program ? ctx.source : (ctx.source || ''), lang: ctx.lang, tags: ctx.tags, hw: ctx.hw, fb: ctx.fb });
    if(r.ok){ ctx.cpu.start(); }
    return r;
  }
  function run(){
    if(!flow.canRun(ctx)){ showPhase('laufen'); return; }
    ctx.state.mainSwitch = true;
    const r = loadCpu();
    if(!r.ok){ $('svStatus').innerHTML = '<span class="bad">Programm lässt sich nicht übersetzen:</span> ' + esc((r.errors || [])[0] ? r.errors[0].text : ''); showPhase('programm'); return; }
    flow.markRun(ctx); logEv('run');
    if(eng) eng.tick();
    showPhase('laufen'); changed();
    h.meister('Anlage läuft. Bediene sie rechts und schau zu – der Probebetrieb zählt nie als Fehlversuch.');
  }

  /* ---------- Bedienung, Einstellen, Messen (Phase ④) ---------- */
  function renderControls(){
    const ps = t.parts || [], hs = [];
    const sensors = ps.filter(p => SENSOR_AT[p] != null);
    if(sensors.length) hs.push('<fieldset class="sv-fs"><legend>Werkstück</legend>' + sensors.map(p => '<label class="sv-sel">vor -' + esc(p) + ' <select data-part="' + esc(PART_OF_LIVE[p] || p) + '">' + MATERIAL_OPTS.map(([v, n]) => '<option value="' + v + '"' + (live.parts[PART_OF_LIVE[p] || p] === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>').join('') + '</fieldset>');
    const btns = Object.keys(BUTTONS).filter(b => ps.includes(b)), extra = [];
    btns.forEach(b => extra.push('<button type="button" class="btn sv-press' + (live.press.includes(b) ? ' on' : '') + '" data-press="' + b + '" aria-pressed="' + live.press.includes(b) + '">-' + b + ' ' + BUTTONS[b] + '</button>'));
    if(ps.includes('S5')) extra.push('<button type="button" class="btn' + (live.hood === 'offen' ? ' on' : '') + '" data-hood>Haube: ' + live.hood + '</button>');
    if(ps.includes('B8')) extra.push('<button type="button" class="btn' + (live.b8 ? ' on' : '') + '" data-b8 aria-pressed="' + live.b8 + '">Medium an -B8</button>');
    if(ps.includes('B9')) extra.push('<button type="button" class="btn" data-b9>Vorrat: ' + (live.b9 ? 'ok' : 'leer') + '</button>');
    if(ps.some(p => /^B1[0-3]$|^B[89]$/.test(p))) extra.push('<button type="button" class="btn' + (tankOn ? ' on' : '') + '" data-tank aria-pressed="' + tankOn + '">Tank simulieren</button>');
    if(extra.length) hs.push('<fieldset class="sv-fs"><legend>Bedienen</legend><div class="sv-row">' + extra.join('') + '</div></fieldset>');
    const phys = Object.keys(PHYS).filter(k => ps.includes(k));
    if(phys.length) hs.push('<fieldset class="sv-fs"><legend>Messgrössen</legend>' + phys.map(k => { const [n, u, a, b] = PHYS[k]; return '<label class="sv-range">-' + k + ' ' + n + ' <input type="range" min="' + a + '" max="' + b + '" step="1" value="' + livePhys[k] + '" data-phys="' + k + '"' + (tankOn && k !== 'R1' ? ' disabled' : '') + '> <output>' + livePhys[k] + '</output> ' + u + '</label>'; }).join('') + '</fieldset>');
    // Einstellen (Annahme A1): Abstand, Poti, Teach-in als Regler
    const adj = t.steps.filter(s => ST().isAdjust(s));
    if(adj.length) hs.push('<fieldset class="sv-fs"><legend>Einstellen</legend>' + [...new Set(adj.map(s => s.part))].map(p => {
      const m = W().mountOf(ctx.state, p), d = W().MOUNTABLE[p] || { max: 20 }, ss = adj.filter(s => s.part === p);
      let x = '<div class="sv-adj"><b>-' + esc(p) + '</b>';
      if(ss.some(s => s.dist)) x += '<label class="sv-range">Abstand <input type="range" min="0" max="' + d.max + '" step="0.5" value="' + m.dist + '" data-dist="' + esc(p) + '"> <output>' + m.dist.toFixed(1) + '</output> mm</label>';
      if(ss.some(s => s.poti)) x += '<label class="sv-range">Empfindlichkeit <input type="range" min="0" max="1" step="0.05" value="' + m.poti + '" data-poti="' + esc(p) + '"> <output>' + Math.round(m.poti * 100) + '</output> %</label>';
      if(ss.some(s => s.teach)) x += '<button type="button" class="btn" data-teach="' + esc(p) + '">Teach-in (Band leer)</button> <span class="report-note">' + (m.teach == null ? 'nicht eingelernt' : 'eingelernt auf ' + m.teach + ' mm') + '</span>';
      return x + '</div>'; }).join('') + '</fieldset>');
    // Werkzeuge nur, wenn die Aufgabe sie freigibt
    const tools = t.tools || [];
    if(tools.includes('multimeter')){
      const opts = sel => '<option value="">– Klemme –</option>' + SV().netlist(t, ctx).terminals.map(x => '<option value="' + esc(x.id) + '"' + (sel === x.id ? ' selected' : '') + '>' + esc(x.id + (x.address ? ' ' + x.address : '')) + '</option>').join('');
      const r = W().meter(ctx.state, meter.mode, meter.a, meter.b, { phys: livePhys, world: liveWorld() });
      hs.push('<fieldset class="sv-fs sv-tool"><legend><i class="fa-solid fa-gauge"></i> Multimeter</legend><div class="sv-row"><select data-mm="mode"><option value="V"' + (meter.mode === 'V' ? ' selected' : '') + '>V DC</option><option value="mA"' + (meter.mode === 'mA' ? ' selected' : '') + '>mA</option></select>'
        + '<label class="sv-sel">rot (+) <select data-mm="a">' + opts(meter.a) + '</select></label><label class="sv-sel">schwarz (COM) <select data-mm="b">' + opts(meter.b) + '</select></label>'
        + '<output class="sv-display" id="svMeter">' + esc(r.text || '') + '</output></div>' + (r.hint ? '<p class="report-note">' + esc(r.hint) + '</p>' : r.error ? '<p class="bad">' + esc(r.error) + '</p>' : '')
        + ((t.x3 || 0) ? '<div class="sv-row">' + Array.from({ length: t.x3 }, (_, i) => i + 1).map(n => '<button type="button" class="btn' + ((ctx.state.knives || {})['X3:' + n] ? ' on' : '') + '" data-knife="X3:' + n + '">Trennmesser -X3:' + n + ' ' + ((ctx.state.knives || {})['X3:' + n] ? 'offen' : 'zu') + '</button>').join('') + '</div>' : '')
        + '<p class="report-note">Tipp: In ① Verbinden eine Klemme antippen setzt abwechselnd die rote und die schwarze Messspitze.</p></fieldset>');
    }
    if(tools.includes('kalibrator')){
      const K = ctx.state.calib;
      hs.push('<fieldset class="sv-fs sv-tool"><legend><i class="fa-solid fa-sliders"></i> Stromkalibrator</legend><div class="sv-row"><button type="button" class="btn' + (K.on ? ' on' : '') + '" data-kon aria-pressed="' + !!K.on + '">' + (K.on ? 'angeklemmt' : 'abgeklemmt') + '</button>'
        + '<label class="sv-sel">Kanal <select data-k="channel">' + ['CH0', 'CH1', 'CH2', 'CH3'].map(c => '<option' + (K.channel === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>'
        + [4, 12, 20].map(v => '<button type="button" class="btn' + (+K.mA === v ? ' on' : '') + '" data-kset="' + v + '">' + v + ' mA</button>').join('')
        + '<label class="sv-sel">Wert <input type="number" min="0" max="24" step="0.1" value="' + K.mA + '" data-k="mA"> mA</label></div></fieldset>');
    }
    // Beobachtung (Werte live)
    const w = watchFor(t.program && t.program.tagsExtra ? t.program.tagsExtra.map(x => x.name) : []);
    hs.push('<fieldset class="sv-fs"><legend>Beobachten</legend><table class="sv-watch"><tbody>' + w.map(n => '<tr><th>' + esc(n) + '</th><td data-watch="' + esc(n) + '">—</td></tr>').join('') + '</tbody></table><p class="report-note" id="svCpu"></p></fieldset>');
    // Messwerte (Messschritte)
    const ms = t.steps.map((s, i) => [s, i]).filter(([s]) => s.kind === 'measure');
    if(ms.length) hs.push('<fieldset class="sv-fs"><legend>Messprotokoll</legend>' + ms.map(([s, i]) => '<p class="sv-steptext">' + s.text + '</p>' + (s.ask || []).map((a, j) => '<label class="sv-num">' + esc(a.q || 'Messwert') + ' <input type="text" inputmode="decimal" data-m="' + i + '.' + j + '" value="' + esc(((ctx.answers[i] || {})[j]) == null ? '' : ctx.answers[i][j]) + '"> ' + esc(a.unit || '') + '</label>').join('')).join('') + '</fieldset>');
    $('svControls').innerHTML = hs.join('');
    updateWatch();
  }
  function updateWatch(){
    document.querySelectorAll('#svControls [data-watch]').forEach(td => { const v = ctx.cpu.read(td.dataset.watch); td.textContent = PLC().fmt(v, 'dez'); });
    const c = $('svCpu'); if(c) c.textContent = 'CPU: ' + ctx.cpu.mode + (ctx.cpu.mode === 'RUN' ? '' : ' – ▶ Laufen lassen lädt und startet');
    const m = $('svMeter'); if(m && (t.tools || []).includes('multimeter')){ const r = W().meter(ctx.state, meter.mode, meter.a, meter.b, { phys: livePhys, world: liveWorld() }); m.textContent = r.text || ''; }
  }
  const ctl = $('svWork');
  ctl.addEventListener('change', e => {
    const d = e.target.dataset;
    if(d.part != null){ live.parts[d.part] = e.target.value || null; logEv('operate', { part: d.part }); }
    if(d.m){ const [i, j] = d.m.split('.'); ctx.answers[i] = ctx.answers[i] || {}; ctx.answers[i][j] = e.target.value.trim(); changed(); }
    if(d.mm){ meter[d.mm] = e.target.value; renderControls(); }
    if(d.k){ ctx.state.calib[d.k] = d.k === 'mA' ? Math.max(0, Math.min(24, +e.target.value || 0)) : e.target.value; changed(); renderControls(); }
    if(d.dist || d.poti) setAdj(e.target);
  });
  ctl.addEventListener('input', e => { const d = e.target.dataset; if(d.phys){ livePhys[d.phys] = +e.target.value; const o = e.target.parentNode.querySelector('output'); if(o) o.textContent = e.target.value; } if(d.dist || d.poti) setAdj(e.target, true); });
  function setAdj(el, quiet){
    const d = el.dataset, id = d.dist || d.poti; ctx.state.mounts = ctx.state.mounts || {};
    const m = ctx.state.mounts[id] = Object.assign(W().mountOf(ctx.state, id), ctx.state.mounts[id] || {}, { tight: true });
    if(d.dist) m.dist = Math.round(+el.value * 2) / 2; if(d.poti) m.poti = Math.round(+el.value * 20) / 20;
    const o = el.parentNode.querySelector('output'); if(o) o.textContent = d.dist ? m.dist.toFixed(1) : Math.round(m.poti * 100);
    changed(); if(!quiet) renderPhases();
  }
  ctl.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || !b.closest('#svControls')) return; const d = b.dataset;
    if(d.press){ const i = live.press.indexOf(d.press); if(i >= 0) live.press.splice(i, 1); else live.press.push(d.press); logEv('operate', { press: d.press }); }
    else if(d.hood != null) live.hood = live.hood === 'zu' ? 'offen' : 'zu';
    else if(d.b8 != null) live.b8 = !live.b8;
    else if(d.b9 != null) live.b9 = !live.b9;
    else if(d.tank != null) tankOn = !tankOn;
    else if(d.teach){ const m = W().mountOf(ctx.state, d.teach); ctx.state.mounts = ctx.state.mounts || {}; ctx.state.mounts[d.teach] = Object.assign(m, ctx.state.mounts[d.teach] || {}, { teach: m.dist, tight: true }); changed(); }
    else if(d.knife){ ctx.state.knives = ctx.state.knives || {}; ctx.state.knives[d.knife] = !ctx.state.knives[d.knife]; changed(); }
    else if(d.kon != null){ ctx.state.calib.on = !ctx.state.calib.on; changed(); }
    else if(d.kset){ ctx.state.calib.mA = +d.kset; changed(); }
    else return;
    renderControls(); renderPhases();
  });

  /* ---------- Fragen der aktuellen Phase ---------- */
  function renderQuestions(){
    const qs = t.steps.map((s, i) => [s, i]).filter(([s]) => s.kind === 'quiz' && ST().phaseOfStep(t, s) === phase);
    $('svQuestions').hidden = !qs.length;
    $('svQuestions').innerHTML = qs.length ? '<div class="card-label"><i class="fa-solid fa-circle-question"></i> Fragen</div>' + qs.map(([s, i]) => {
      const a = (ctx.answers[i] || {})[0];
      return '<div class="sv-q"><p>' + s.text + '</p>' + (s.options ? '<div class="sv-opts" role="radiogroup">' + s.options.map((o, j) => '<label class="sv-opt"><input type="radio" name="svq' + i + '" data-q="' + i + '" value="' + j + '"' + (a !== undefined && a !== '' && +a === j ? ' checked' : '') + '> ' + o + '</label>').join('') + '</div>'
        : '<label class="sv-num"><input type="text" inputmode="decimal" data-q="' + i + '" value="' + esc(a == null ? '' : a) + '" aria-label="Antwort"> ' + esc(s.unit || '') + '</label>') + '</div>';
    }).join('') : '';
  }
  $('svQuestions').addEventListener('change', e => { const q = e.target.dataset.q; if(q == null) return; ctx.answers[q] = ctx.answers[q] || {}; ctx.answers[q][0] = e.target.type === 'radio' ? +e.target.value : e.target.value.trim(); changed(); renderPhases(); });

  /* ---------- Takt ---------- */
  function startLoop(){ stopLoop(); timer = setInterval(step, 50); }
  function stopLoop(){ clearInterval(timer); timer = 0; }
  function step(){
    if(!active || document.hidden || !t || $('app').style.display === 'none') return;
    if(tankOn) stepTank(0.05);
    sess.step(0.05);
    if(++tick % 4) return;
    const out = sess.out || {}, on = !!ctx.state.mainSwitch;
    if(plant){
      const p = SV().plant(t, ctx, { outputs: out, parts: live.parts, aria: h.session().solved ? 'Gut gemacht.' : undefined });
      p.dist = { B1: W().mountOf(ctx.state, 'B1').dist, B2: W().mountOf(ctx.state, 'B2').dist };
      if(tankOn){ p.level = tank.level; p.inflow = tank.flow > 0.1; p.reserveLevel = tank.reserve; }
      const hv = hmiValues(); if(Object.values(hv).some(v => v !== undefined)) p.hmi = hv;
      p.leds = Object.assign({}, p.leds || {}, sensorLeds());
      plant.setChannels(p);
    }
    if(phase === 'laufen') updateWatch(); else refreshView();
    if(tick % 20 === 0){ renderPhases(); if(eng && phase !== 'verbinden') eng.tick(); }
    if(on && out['Q0.3'] && tick % 12 === 0) sound('pump');
  }
  function sensorLeds(){ const ev = sess.io && W().evaluate(ctx.state, liveWorld(), { t: sess.t }); const o = {}; if(ev) Object.keys(ev.di).forEach(a => { const tt = W().diTerminal(a); if(tt) o['DI' + a.slice(1)] = !!ev.di[a]; }); return o; }
  function hmiValues(){ const c = ctx.cpu, r = n => { const v = c.read(n); return typeof v === 'number' ? v : undefined; }; return { level: r('Fuellstand_mm'), pressure: r('Druck_mbar'), temp: r('Temp_C'), flow: r('Durchfluss_lmin') }; }
  function refreshView(force){
    if(!view || phase !== 'verbinden') return;
    if(document.querySelector('#svWiring.sw25-dragging') || document.querySelector('#svWiring .sw25-core.sel')) { if(!force) return; }
    const s = visState(), sig = JSON.stringify([s.results, s.leds, s.sensorLeds, s.wires.length]);
    if(!force && sig === lastSig) return; lastSig = sig; view.update(s);
  }
  function stepTank(dt){
    const SM = root.SensorModel, out = sess.out || {}, on = !!ctx.state.mainSwitch, pct = raw => Math.max(0, Math.min(100, (raw || 0) / 276.48));
    tank = SM.tankStep(tank, { pumpFree: on && !!out['Q0.3'], pumpPct: pct(out.QW112), valvePct: out.QW114 != null && ctx.cpu.loaded && ctx.cpu.loaded.all.some(x => /QW114/.test(x.addr)) ? pct(out.QW114) : null,
      inlet: out['Q1.1'] == null ? true : on && !!out['Q1.1'], drain: on && !!out['Q0.4'], heater: on && !!out['Q0.5'] }, dt);
    const m = SM.tankMeasure(tank);
    livePhys.B10 = m.distance_mm; livePhys.B11 = m.pressure_mbar; livePhys.B12 = m.temp_c; livePhys.B13 = m.flow_lmin;
    live.b8 = tank.level >= 0.55; live.b9 = tank.reserve > 0.005;
  }

  /* ---------- Speichern ---------- */
  let saveT = 0;
  const sound = k => { if(h.sound) h.sound(k); };
  function changed(){
    if(practice || !t) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const S = h.S();
      S.drafts[t.id] = { v2: true, state: JSON.parse(W().serialize(ctx.state)), hw: ctx.hw, tags: ctx.tags, lang: ctx.lang, source: ctx.source, answers: ctx.answers, flow: flow.snapshot() };
      h.saveSoon();
    }, 400);
    renderPhases();
  }

  /* ---------- Prüfen ---------- */
  function sync(){ if(eng){ ctx.source = eng.source; ctx.lang = eng.lang; } }
  function check(){
    sync();
    if(t.steps.some(s => s.kind === 'load')){ ctx.state.mainSwitch = true; loadCpu(); }   // Laden/Einschalten ist Mechanik
    const res = ST().checkTask(t, ctx);
    logEv('check', { ok: res.ok });
    const first = res.first ? ST().phaseOfStep(t, t.steps[res.first.i]) : null;
    if(!res.ok && first && first !== phase) { const st = flow.status(ctx).find(x => x.key === first); if(st && st.state !== 'gesperrt') showPhase(first, true); }
    renderPhases();
    return res;
  }
  function report(task, res){
    const byPh = {}; res.steps.forEach(s => { const p = ST().phaseOfStep(t, t.steps[s.i]); (byPh[p] = byPh[p] || []).push(s); });
    const bad = res.steps.filter(s => !s.ok);
    let html = '<div class="sw-report"><p>' + (bad.length ? '<b>' + bad.length + ' von ' + res.steps.length + ' Punkten</b> sind noch nicht erfüllt.' : '<b>Alles erfüllt.</b>') + '</p>'
      + PH.filter(p => byPh[p]).map(p => '<h4>' + PH_LABEL[p] + '</h4><ol>' + byPh[p].map(s => '<li class="' + (s.ok ? 'ok' : 'bad') + '"><span>' + (s.ok ? '✓' : '✗') + '</span> ' + t.steps[s.i].text + (s.ok ? '' : '<ul>' + s.issues.slice(0, 4).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>') + '</li>').join('') + '</ol>').join('');
    const pr = ctx.lastProgram;
    if(pr && pr.cases && pr.cases.length && t.program){
      const fmt = v => Array.isArray(v) ? v[0] + ' ± ' + v[1] : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
      html += '<details class="sw-prog"' + (pr.ok ? '' : ' open') + '><summary>Programmtest (' + pr.cases.filter(c => c.pass).length + '/' + pr.cases.length + ' Zyklen ok)</summary><table class="tc-table"><tr><th>Test</th><th>Eingänge</th><th>Prüfung</th></tr>'
        + pr.cases.map(c => '<tr class="' + (c.pass ? 'ok' : 'bad') + '"><td>' + esc(c.name) + (c.i ? ' · ' + (c.i + 1) : '') + '</td><td>' + esc(Object.keys(c.inputs || {}).map(k => k + '=' + fmt(c.inputs[k])).join(', ')) + '</td><td>' + (c.error ? esc(c.error) : (c.checks || []).map(x => (x.pass ? '✓ ' : '✗ ') + esc(x.name + ' = ' + fmt(x.actual) + (x.pass ? '' : ' (erwartet ' + fmt(x.expected) + ')'))).join('<br>')) + '</td></tr>').join('') + '</table></details>';
    }
    $('reportTitle').textContent = res.ok ? 'Abnahme bestanden' : 'Abnahmeprotokoll';
    $('reportBody').innerHTML = html + '</div>';
    $('reportCard').style.display = '';
  }
  function structHint(task){
    const st = flow.status(ctx), open = st.filter(x => x.state !== 'erledigt' && x.state !== 'leer').map(x => '<b>' + PH_LABEL[x.key] + '</b>');
    return 'Die Aufgabe hat den Schwerpunkt <b>' + (ST().focusOf(task) || []).map(p => PH_LABEL[p]).join(', ') + '</b>. ' + (open.length ? 'Noch offen: ' + open.join(', ') + '.' : 'Alle Phasen sind erledigt – jetzt „Prüfen“.');
  }
  function applyRef(lang){ ctx = ST().applyRef(t, ST().newContext(t), lang); ctx.state.level = 'schnell'; ctx.state.mainSwitch = true; flow = FL().create(t); build(); PH.slice(0, 3).forEach(p => flow.accept(ctx, p)); showPhase(flow.current, true); changed(); }
  function reveal(task){ applyRef(); }
  function reset(task){ ctx = ST().newContext(task); ctx.state.level = 'schnell'; flow = FL().create(task); build(); showPhase(flow.current, true); changed(); }
  function solution(){ sync(); return ST().describe(t, ctx); }
  document.addEventListener('visibilitychange', () => { if(!document.hidden && t && active && !timer) startLoop(); });
  return { setup, check, report, structHint, reveal, reset, solution, applyRef, activate, run, help, showPhase, accept: p => { const r = flow.accept(ctx, p || phase); changed(); showPhase(flow.current, true); return r; },
    get ctx(){ return ctx; }, get flow(){ return flow; }, get view(){ return view; }, get plant(){ return plant; }, get engineering(){ return eng; }, get plc(){ return sess; }, get phase(){ return phase; }, events, live, livePhys, v2: true };
}

const CSS = `
body.sensor-v2 main#gameView{ grid-template-columns:minmax(300px,30fr) minmax(0,70fr); }
body.sensor-v2 .panel-right{ min-width:0; } body.sensor-v2 .panel-left{ min-width:0; overflow:hidden; }
body.sensor-v2 .panel-left > .card{ flex:none; } body.sensor-v2 .panel-left > .task-card{ flex:1 1 auto; min-height:0; overflow-y:auto; }
.sv-bar [hidden]{ display:none !important; }
.sv-work{ overflow-x:auto; }
body.sensor-v2 .sw25-body{ grid-template-columns:minmax(210px,1fr) minmax(220px,1.25fr) minmax(170px,.9fr); }
@media (max-width:1100px){ body.sensor-v2 main#gameView{ grid-template-columns:minmax(260px,34fr) minmax(0,66fr); } }
.sv-card{ padding:10px; display:flex; flex-direction:column; gap:8px; min-width:0; }
.sv-phases{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:6px; }
.sv-ph{ display:flex; align-items:center; gap:6px; min-height:46px; padding:6px 10px; border-radius:10px; border:1px solid var(--border-col, #2a3a4c); background:#10161d; color:var(--text-dim, #9fb0c0); font:600 13px var(--font-ui, system-ui); cursor:pointer; text-align:left; min-width:0; }
.sv-ph .sv-no{ width:22px; height:22px; flex:none; border-radius:50%; display:flex; align-items:center; justify-content:center; font:700 12px var(--font-code, monospace); background:#1d2a37; color:#cfe0ee; }
.sv-ph .sv-lbl{ flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .sv-ph .sv-sym{ font-size:14px; }
.sv-ph.on{ border-color:#58c4ff; color:#e6eef6; box-shadow:0 0 0 2px rgba(88,196,255,.25); } .sv-ph.focus .sv-no{ background:#2a4b6a; }
.sv-ph.st-erledigt .sv-sym{ color:#39ff7a; } .sv-ph.st-bereit .sv-sym{ color:#ffd21e; } .sv-ph.st-gesperrt{ opacity:.55; cursor:not-allowed; } .sv-ph.st-leer{ opacity:.45; }
.sv-ph:focus-visible{ outline:3px solid #58c4ff; outline-offset:2px; }
.sv-bar{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; } .sv-status{ flex:1; min-width:200px; font-size:13px; color:var(--text-dim, #9fb0c0); } .sv-status .ok{ color:#39ff7a; } .sv-status .bad{ color:#ff6b6b; }
.sv-bar .btn{ min-height:40px; } .sv-run{ border-color:#39ff7a !important; color:#39ff7a !important; font-weight:700; } .sv-run:disabled{ opacity:.45; } .sv-accept{ border-color:#ffd21e !important; color:#ffd21e !important; }
.sv-work{ min-width:0; } .sv-pane[hidden]{ display:none; }
.sv-run-grid{ display:grid; grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr); gap:10px; align-items:start; }
.sv-plant-big{ height:min(56vh, 480px); border-radius:10px; overflow:hidden; background:#000; } .sv-plant-big .sv-plant-host{ width:100%; height:100%; }
.sv-plant-small{ height:190px; border-radius:8px; overflow:hidden; background:#000; } .sv-plant-small .sv-plant-host{ width:100%; height:100%; }
.sv-tile{ padding:8px; } .sv-tile.sv-tile-empty .sv-plant-small{ display:none; } .sv-tile.sv-tile-empty::after{ content:'Die Anlage ist gross rechts (④ Laufen lassen).'; font-size:12px; color:var(--text-dim, #9fb0c0); }
.sv-tile-note{ color:#39ff7a; font-weight:700; }
.sv-controls{ display:flex; flex-direction:column; gap:8px; max-height:min(56vh, 480px); overflow:auto; padding-right:2px; }
.sv-fs{ border:1px solid var(--border-col, #2a3a4c); border-radius:8px; padding:6px 8px 8px; margin:0; } .sv-fs legend{ font:700 11px var(--font-code, monospace); text-transform:uppercase; letter-spacing:.06em; color:#58c4ff; padding:0 4px; }
.sv-row{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; } .sv-sel{ display:inline-flex; flex-direction:column; font-size:12px; gap:2px; margin:2px 6px 2px 0; } .sv-sel select, .sv-sel input{ min-height:34px; }
.sv-controls .btn.on{ border-color:#ffd166; color:#ffd166; } .sv-range{ display:flex; align-items:center; gap:6px; font-size:12px; flex-wrap:wrap; } .sv-range input{ flex:1; min-width:110px; }
.sv-adj{ display:flex; flex-direction:column; gap:4px; margin:4px 0; } .sv-display{ font:700 18px var(--font-code, monospace); background:#0b1a26; color:#9fdcff; padding:4px 10px; border-radius:6px; min-width:110px; text-align:right; }
.sv-watch{ width:100%; font:12px var(--font-code, monospace); border-collapse:collapse; } .sv-watch th{ text-align:left; font-weight:400; color:var(--text-dim, #9fb0c0); padding:2px 4px; } .sv-watch td{ text-align:right; color:#9fdcff; padding:2px 4px; }
.sv-num{ display:inline-flex; gap:6px; align-items:center; margin:4px 8px 0 0; font-size:13px; } .sv-num input{ width:90px; min-height:34px; } .sv-steptext{ margin:4px 0; font-size:13px; }
.sv-questions{ border-top:1px solid var(--border-col, #2a3a4c); padding-top:6px; } .sv-questions[hidden]{ display:none; } .sv-q p{ margin:6px 0 4px; } .sv-opts{ display:flex; flex-direction:column; gap:4px; } .sv-opt{ display:flex; gap:8px; align-items:center; cursor:pointer; min-height:36px; padding:4px 10px; border:1px solid var(--border-col, #2a3a4c); border-radius:8px; background:rgba(255,255,255,.02); font-size:14px; } .sv-opt:has(input:checked){ border-color:#58c4ff; background:rgba(88,196,255,.08); } .sv-opt input{ accent-color:#58c4ff; margin:0; }
.sw-report h4{ margin:8px 0 2px; font-size:12px; color:#58c4ff; text-transform:uppercase; letter-spacing:.06em; }
.sv-info{ margin:8px 0; border:1px solid #2f5b7a; border-radius:8px; background:rgba(88,196,255,.06); padding:4px 10px; } .sv-info summary{ cursor:pointer; font-weight:700; color:#58c4ff; min-height:30px; display:flex; align-items:center; gap:6px; }
.sv-info-body{ font-size:13px; line-height:1.45; padding:2px 0 6px; } .sv-info-t{ border-collapse:collapse; font-size:12px; margin-top:4px; } .sv-info-t th, .sv-info-t td{ padding:2px 10px 2px 0; text-align:left; } .sv-info-t th{ color:var(--text-dim, #9fb0c0); font-weight:400; }
body.sensor-v2 #storyText{ font-size:13px; } body.sensor-v2 .learn-goal.sv-learn{ font-size:12px; opacity:.85; }
.sr-only{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
#svEng .eng{ border:0; padding:0; background:transparent; }
@media (max-height:860px) and (min-width:981px){ .sv-plant-small{ height:130px; } }
@media (max-width:980px){ body.sensor-v2 main#gameView{ grid-template-columns:1fr; } }
@media (max-width:900px){ .sv-run-grid{ grid-template-columns:1fr; } .sv-controls{ max-height:none; } .sv-plant-big{ height:280px; } }
@media (max-width:640px){ .sv-phases{ grid-template-columns:repeat(4, minmax(0,1fr)); gap:4px; } .sv-ph{ flex-direction:column; gap:2px; padding:4px 2px; font-size:11px; text-align:center; } .sv-ph .sv-lbl{ white-space:normal; } .sv-ph i{ display:none; }
  body.sensor-v2 .sv-tile{ order:-1; } body.sensor-v2 .panel-left{ display:flex; flex-direction:column; overflow:visible; } body.sensor-v2 .panel-left > .task-card{ overflow:visible; } }
`;
function injectCss(){ if(document.getElementById('svCss')) return; const s = document.createElement('style'); s.id = 'svCss'; s.textContent = CSS; document.head.appendChild(s); }
root.SensorGameV2 = { create: h => { injectCss(); return create(h); } };
})(typeof window !== 'undefined' ? window : globalThis);
