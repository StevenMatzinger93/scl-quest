(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Einbindung in die Spielhülle (app.js, QUEST.lang = 'sensor'; Paket S7)
   Linke Spalte: Karte „Arbeitsschritte“ (Checkliste mit Fragen/Messwerten, Anlage bedienen) statt Live-Anlage.
   Rechte Spalte: Werkstatt (3D oder 2D + Klemmleiste) statt Code-Editor; Engineering-Laptop als Überlagerung.
   Laufende Anlage: SensorPLC.session im 50-ms-Takt (Eingänge aus Verdrahtung/Modell, CPU-Zyklus, LEDs, Band, Lampen).
   API: SensorGame.create(hooks) → { setup(t, practice), check(t), report(t, res), structHint(t), reveal(t), reset(t), solution(t), openLaptop() }
   hooks: { S(), session(), saveSoon(), meister(html, type), esc }
   ============================================================ */
const ST = () => root.SensorTasks, W = () => root.Wiring, PLC = () => root.SensorPLC;
const MATERIAL_OPTS = [['', 'kein Teil'], ['stahl', 'Stahl'], ['edelstahl', 'Edelstahl'], ['aluminium', 'Aluminium'], ['messing', 'Messing'], ['kunststoff_w', 'Kunststoff weiss'], ['kunststoff_s', 'Kunststoff schwarz'], ['glas', 'Glas']];
const SENSOR_AT = { B1: 0.29, B2: 0.44, B3: 0.59, 'B4.2': 0.74, B5: 1.11, N1: 0.2 };   // Lage auf dem Band (Szene)
const BUTTONS = { S1: 'Start', S2: 'Stopp', S3: 'Not-Halt', S4: 'Auto' };
const PHYS = { B10: ['Abstand', 'mm', 0, 800, 300], B11: ['Druck', 'mbar', 0, 100, 50], B12: ['Temperatur', '°C', 0, 100, 20], B13: ['Durchfluss', 'l/min', 0, 20, 10], R1: ['Sollwert', '%', 0, 100, 50] };
const KIND_LABEL = { quiz: 'Frage', mount: 'Montieren', plug: 'Anstecken', wire: 'Verdrahten', power: 'Einschalten', observe: 'Funktionsprobe', tags: 'Variablen', config: 'Konfigurieren', load: 'Laden', measure: 'Messen', program: 'Programmieren' };

function create(h){
  const $ = id => document.getElementById(id), esc = h.esc;
  let t = null, ctx = null, ws = null, eng = null, sess = null, timer = 0, tick = 0, practice = false, lastMarks = null;
  const live = { parts: {}, press: [], hood: 'zu', b8: false, b9: true };
  const livePhys = {};
  let tank = null, tankOn = false;   // Tank simulieren: Ausgänge der CPU → Tankphysik → Messwerte statt Schieberegler

  /* ---------- DOM einmalig umbauen ---------- */
  const left = document.querySelector('.panel-left'), right = document.querySelector('.panel-right');
  const sceneCard = document.querySelector('.scene-card'), editorCard = document.querySelector('.editor-card');
  const stepsCard = document.createElement('div'); stepsCard.className = 'card steps-card'; stepsCard.id = 'stepsCard';
  stepsCard.innerHTML = '<div class="card-label"><i class="fa-solid fa-list-check" aria-hidden="true"></i> Arbeitsschritte</div><ol class="sw-steps" id="swSteps"></ol>'
    + '<details class="sw-plant" id="swPlant" open><summary><i class="fa-solid fa-hand-pointer"></i> Anlage bedienen</summary><div id="swPlantBody"></div></details>';
  if(sceneCard){ sceneCard.style.display = 'none'; sceneCard.parentNode.insertBefore(stepsCard, sceneCard); } else left.insertBefore(stepsCard, left.firstChild);
  const wsCard = document.createElement('div'); wsCard.className = 'card sw-wscard'; wsCard.id = 'wsCard';
  wsCard.innerHTML = '<div class="ws-titlebar"><span class="ws-title"><i class="fa-solid fa-screwdriver-wrench"></i> Werkstatt · Prüfstand</span><span class="ws-tools" id="wsTools">'
    + '<button class="tool-btn" id="swLaptopBtn" title="Engineering-Laptop öffnen"><i class="fa-solid fa-laptop-code"></i> Engineering</button></span></div><div id="wsHost"></div>';
  if(editorCard){ editorCard.style.display = 'none'; right.insertBefore(wsCard, editorCard); } else right.insertBefore(wsCard, right.firstChild);
  // Hinweis- und Zurücksetzen-Knopf aus der (versteckten) Editorleiste übernehmen
  ['hintBtn', 'resetCodeBtn'].forEach(id => { const b = $(id); if(b) $('wsTools').appendChild(b); });
  if($('resetCodeBtn')) $('resetCodeBtn').title = 'Aufgabe auf den Ausgangszustand zurücksetzen';
  const vp = $('varPanel'); if(vp) vp.style.display = 'none';   // keine Variablenliste: Variablen stehen in der PLC-Variablentabelle
  const cb = $('compileBtn'); if(cb) cb.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Arbeit prüfen';
  const ov = document.createElement('div'); ov.id = 'engOverlay'; ov.className = 'eng-overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Engineering-Laptop'); ov.hidden = true;
  ov.innerHTML = '<div class="eng-frame"><div class="eng-frame-head"><i class="fa-solid fa-laptop-code"></i> Engineering-Laptop <span class="grow"></span><button class="btn" id="engCloseBtn"><i class="fa-solid fa-xmark"></i> Schliessen <kbd>Esc</kbd></button></div><div id="engHost"></div></div>';
  document.body.appendChild(ov);
  $('swLaptopBtn').addEventListener('click', openLaptop);
  $('engCloseBtn').addEventListener('click', closeLaptop);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !ov.hidden && !ov.querySelector('.eng-dlg:not([hidden])')){ e.stopPropagation(); closeLaptop(); } }, true);   // Capture: offener Laden-Dialog schliesst zuerst nur sich selbst
  function openLaptop(){ ov.hidden = false; if(eng) eng.tick(); const b = ov.querySelector('.eng-tab.on') || $('engCloseBtn'); if(b) b.focus(); }
  ov.addEventListener('focusout', () => { setTimeout(() => { if(!ov.hidden && !ov.contains(document.activeElement)) $('engCloseBtn').focus(); }, 0); });   // Fokus bleibt im Dialog
  function closeLaptop(){ ov.hidden = true; if(ws && ws.scene && ws.scene.view === 7) ws.scene.setView(1); $('swLaptopBtn').focus(); }

  /* ---------- Aufgabe aufbauen ---------- */
  function setup(task, isPractice){
    t = task; practice = !!isPractice;
    const S = h.S(), d = !practice && S.drafts[t.id] && typeof S.drafts[t.id] === 'object' ? S.drafts[t.id] : null;
    ctx = ST().newContext(t);
    if(d){ try { ctx.state = W().newState(d.state); ctx.hw = d.hw || ctx.hw; ctx.tags = d.tags || ctx.tags; ctx.lang = d.lang === 'kop' ? 'fup' : (d.lang || ctx.lang);/* KOP entfällt: alte Entwürfe öffnen als FUP (gleiches Textformat) */ ctx.source = d.source != null ? d.source : ctx.source; ctx.answers = d.answers || {}; ctx.loaded = d.loaded || null; } catch(e){ ctx = ST().newContext(t); } }
    build();
  }
  function build(){
    stopLoop();
    if(ws) ws.destroy(); if(eng) eng.destroy();
    lastWires = ctx.state.wires.length; lastFuse = ctx.state.meterFuse !== false;
    Object.keys(live.parts).forEach(k => delete live.parts[k]); live.press = []; live.hood = 'zu'; lastMarks = null;
    Object.keys(PHYS).forEach(k => { if(t.parts.includes(k)) livePhys[k] = PHYS[k][4]; });
    tank = root.SensorModel.tankNew({ level: 0.2 }); tankOn = false;
    sess = PLC().session({ cpu: ctx.cpu, state: () => ctx.state, world: liveWorld, phys: () => livePhys });
    if(ctx.loaded){ const r = ctx.cpu.download({ source: ctx.loaded.source, lang: ctx.loaded.lang, tags: ctx.loaded.tags, hw: ctx.loaded.hw, fb: ctx.fb }); if(r.ok && ctx.loaded.run) ctx.cpu.start(); }
    const S = h.S();
    ws = root.Workshop.mount($('wsHost'), { state: ctx.state, world: liveWorld, phys: () => livePhys, parts: t.parts, modules: t.modules, x2: t.x2, x3: t.x3,
      mode: S.settings.sensor2d ? '2d' : undefined, quality: 'auto', reduceMotion: !!S.settings.motion, plc: sess, xrayAllowed: !h.session().exam,
      hmi: hmiValues, onLaptop: openLaptop, onChange: () => { changed(); } });
    const tagsExtra = t.program && t.program.tagsExtra ? t.program.tagsExtra.map(x => x.name) : [];
    eng = root.Engineering.mount($('engHost'), { cpu: ctx.cpu, hw: ctx.hw, tags: ctx.tags, source: ctx.source, lang: ctx.lang, langs: t.program ? (t.program.langs || ['scl']) : ['scl', 'fup'], starts: t.program && t.program.start,
      watch: watchFor(t, tagsExtra), tab: t.program ? 'program' : t.steps.some(s => s.kind === 'tags') ? 'tags' : t.steps.some(s => s.kind === 'config') ? 'device' : 'watch',
      onChange: o => { ctx.source = o.source; ctx.lang = o.lang; changed(); }, onLoad: () => changed() });
    // passende Startansicht: Montieren/Anstecken → Sortierstrecke bzw. Tank, Verdrahten → Schaltschrank
    const first = t.steps.find(x => ['mount', 'plug', 'wire', 'measure'].includes(x.kind)), atTank = (t.parts || []).some(p => /^B1[0-3]$|^B[89]$/.test(p));
    if(ws.scene && first) ws.scene.setView(first.kind === 'wire' || first.kind === 'measure' ? 5 : atTank ? 4 : 2);
    renderSteps(); renderPlant();
    startLoop();
  }
  function watchFor(task, extra){
    const di = (task.parts || []).map(p => (W().PARTS[p] || {}).di).filter(Boolean);
    const names = PLC().TAGS_WERKSTATT.filter(x => di.some(a => '%' + a === x.addr)).map(x => x.name).concat(extra).slice(0, 8);
    return names.length ? names : ['%I0.4', '%Q0.0'];
  }
  function hmiValues(){ const c = ctx.cpu, r = n => { const v = c.read(n); return typeof v === 'number' ? v : undefined; }; return { level: r('Fuellstand_mm'), pressure: r('Druck_mbar'), temp: r('Temp_C'), flow: r('Durchfluss_lmin') }; }
  function liveWorld(){ const sc = Object.assign({}, live, { cyl: sess && sess.out && sess.out['Q0.2'] ? 'vorne' : 'hinten', t: sess ? sess.t : 0 }); return ST().worldFrom(ctx.state, sc); }

  /* ---------- Anlage im Takt ---------- */
  function startLoop(){ stopLoop(); timer = setInterval(step, 50); }
  function stopLoop(){ clearInterval(timer); timer = 0; }
  function step(){
    if(document.hidden || !t || $('app').style.display === 'none') return;
    if(tankOn) stepTank(0.05);
    sess.step(0.05);
    if(++tick % 4) return;
    { const o = sess.out || {}, on = !!ctx.state.mainSwitch; if(on && o['Q0.3'] && tick % 12 === 0) sound('pump'); if(on && o['Q1.0'] && tick % 20 === 0) sound('horn'); }
    ws.refresh();
    if(!ov.hidden) eng.tick();
    const sc = ws.scene;
    if(sc){
      const out = sess.out || {}, on = !!ctx.state.mainSwitch;
      const parts = Object.keys(live.parts).filter(k => live.parts[k]).map(k => ({ x: SENSOR_AT[k] || 0.5, material: live.parts[k] }));
      sc.setState({ beltRunning: on && !!out['Q0.0'], cylinder: on && out['Q0.2'] ? 1 : 0, feeder: on && !!out['Q0.1'], parts, pump: on && out['Q0.3'] ? 1 : 0, heater: on && !!out['Q0.5'],
        level: tankOn ? tank.level : undefined, inflow: tankOn && tank.flow > 0.1, reserveLevel: tankOn ? tank.reserve : undefined,
        leds: { P1: on && !!out['Q0.6'], P2: on && !!out['Q0.7'] }, aria: h.session().solved ? 'Gut gemacht.' : 'Ich sehe alles, was du verdrahtest …' });
    }
  }

  // Tankphysik mit den Ausgängen der CPU: -K2 Pumpe frei (%Q0.3), -T2 Drehzahl (%QW112), -MB5 Stellventil (%QW114), -MB4 Zulauf (%Q1.1), -MB3 Ablauf (%Q0.4), -K3 Heizung (%Q0.5)
  function stepTank(dt){
    const SM = root.SensorModel, out = sess.out || {}, on = !!ctx.state.mainSwitch, pct = raw => Math.max(0, Math.min(100, (raw || 0) / 276.48));
    tank = SM.tankStep(tank, { pumpFree: on && !!out['Q0.3'], pumpPct: pct(out.QW112), valvePct: out.QW114 != null && ctx.cpu.loaded && ctx.cpu.loaded.all.some(x => /QW114/.test(x.addr)) ? pct(out.QW114) : null,
      inlet: out['Q1.1'] == null ? true : on && !!out['Q1.1'], drain: on && !!out['Q0.4'], heater: on && !!out['Q0.5'] }, dt);
    const m = SM.tankMeasure(tank);
    livePhys.B10 = m.distance_mm; livePhys.B11 = m.pressure_mbar; livePhys.B12 = m.temp_c; livePhys.B13 = m.flow_lmin;
    live.b8 = tank.level >= 0.55; live.b9 = tank.reserve > 0.005;
    const o = document.getElementById('swTankInfo'); if(o && tick % 8 === 0) o.textContent = 'Füllstand ' + Math.round(tank.level * 1000) + ' mm · ' + tank.temp.toFixed(1) + ' °C · Zulauf ' + tank.flow.toFixed(1) + ' l/min · Vorrat ' + Math.round(tank.reserve * 1000) + ' l';
  }

  /* ---------- Arbeitsschritte ---------- */
  function renderSteps(){
    $('swSteps').innerHTML = t.steps.map((s, i) => {
      let ui = '';
      if(s.kind === 'quiz'){
        const a = (ctx.answers[i] || {})[0];
        ui = s.options ? '<div class="sw-opts" role="radiogroup">' + s.options.map((o, j) => '<label class="sw-opt"><input type="radio" name="swq' + i + '" data-q="' + i + '" value="' + j + '"' + (+a === j && a !== undefined && a !== '' ? ' checked' : '') + '> ' + o + '</label>').join('') + '</div>'
          : '<label class="sw-num"><input type="text" inputmode="decimal" data-q="' + i + '" value="' + esc(a == null ? '' : a) + '" aria-label="Antwort"> ' + esc(s.unit || '') + '</label>';
      }
      if(s.kind === 'measure') ui = (s.ask || []).map((a, j) => '<label class="sw-num">' + esc(a.q || 'Messwert') + ' <input type="text" inputmode="decimal" data-m="' + i + '.' + j + '" value="' + esc(((ctx.answers[i] || {})[j]) == null ? '' : ctx.answers[i][j]) + '"> ' + esc(a.unit || '') + '</label>').join('');
      return '<li class="sw-step" data-step="' + i + '"><span class="sw-ic" aria-hidden="true">' + (i + 1) + '</span><div class="sw-body"><div class="sw-text"><span class="sw-kind">' + (KIND_LABEL[s.kind] || '') + '</span> ' + s.text + '</div>' + ui + '<div class="sw-issue" hidden></div></div></li>';
    }).join('');
    if(lastMarks) mark(lastMarks);
  }
  stepsCard.addEventListener('change', e => {
    const q = e.target.dataset.q, m = e.target.dataset.m;
    if(q != null){ ctx.answers[q] = ctx.answers[q] || {}; ctx.answers[q][0] = e.target.type === 'radio' ? +e.target.value : e.target.value.trim(); changed(); }
    if(m){ const [i, j] = m.split('.'); ctx.answers[i] = ctx.answers[i] || {}; ctx.answers[i][j] = e.target.value.trim(); changed(); }
    if(e.target.dataset.part != null){ live.parts[e.target.dataset.part] = e.target.value || null; }
    if(e.target.dataset.phys){ livePhys[e.target.dataset.phys] = +e.target.value; const o = e.target.parentNode.querySelector('output'); if(o) o.textContent = e.target.value; }
  });
  stepsCard.addEventListener('input', e => { if(e.target.dataset.phys){ livePhys[e.target.dataset.phys] = +e.target.value; const o = e.target.parentNode.querySelector('output'); if(o) o.textContent = e.target.value; } });
  stepsCard.addEventListener('click', e => {
    const b = e.target.closest('[data-press]'); if(b){ const id = b.dataset.press, i = live.press.indexOf(id); if(i >= 0) live.press.splice(i, 1); else live.press.push(id); b.setAttribute('aria-pressed', String(i < 0)); b.classList.toggle('on', i < 0); return; }
    const hb = e.target.closest('[data-hood]'); if(hb){ live.hood = live.hood === 'zu' ? 'offen' : 'zu'; hb.textContent = 'Haube: ' + live.hood; hb.classList.toggle('on', live.hood === 'offen'); return; }
    const b8 = e.target.closest('[data-b8]'); if(b8){ live.b8 = !live.b8; b8.classList.toggle('on', live.b8); b8.setAttribute('aria-pressed', String(live.b8)); return; }
    const tb = e.target.closest('[data-tank]'); if(tb){ tankOn = !tankOn; tb.classList.toggle('on', tankOn); tb.setAttribute('aria-pressed', String(tankOn)); stepsCard.querySelectorAll('[data-phys]').forEach(r => { r.disabled = tankOn && ['B10', 'B11', 'B12', 'B13'].includes(r.dataset.phys); }); if(!tankOn) $('swTankInfo').textContent = 'Schieberegler steuern die Messwerte.'; return; }
    const b9 = e.target.closest('[data-b9]'); if(b9){ live.b9 = !live.b9; b9.classList.toggle('on', !live.b9); b9.textContent = 'Vorrat: ' + (live.b9 ? 'ok' : 'leer'); }
  });
  function renderPlant(){
    const ps = t.parts || [], hs = [];
    const sensors = ps.filter(p => SENSOR_AT[p] != null);
    if(sensors.length) hs.push('<div class="sw-row">' + sensors.map(p => '<label class="sw-sel">Teil vor -' + esc(p) + ' <select data-part="' + esc(p) + '">' + MATERIAL_OPTS.map(([v, n]) => '<option value="' + v + '">' + n + '</option>').join('') + '</select></label>').join('') + '</div>');
    const btns = Object.keys(BUTTONS).filter(b => ps.includes(b));
    if(btns.length) hs.push('<div class="sw-row">' + btns.map(b => '<button type="button" class="btn sw-press" data-press="' + b + '" aria-pressed="false">-' + b + ' ' + BUTTONS[b] + ' drücken</button>').join('') + '</div>');
    if(ps.includes('S5')) hs.push('<div class="sw-row"><button type="button" class="btn" data-hood>Haube: zu</button></div>');
    if(ps.includes('B8')) hs.push('<div class="sw-row"><button type="button" class="btn" data-b8 aria-pressed="false">Medium an -B8</button></div>');
    if(ps.includes('B9')) hs.push('<div class="sw-row"><button type="button" class="btn" data-b9>Vorrat: ok</button></div>');
    if(ps.some(p => /^B1[0-3]$|^B[89]$/.test(p))) hs.push('<div class="sw-row"><button type="button" class="btn" data-tank aria-pressed="false">Tank simulieren</button> <span class="report-note" id="swTankInfo">Schieberegler steuern die Messwerte.</span></div>');
    Object.keys(PHYS).filter(k => ps.includes(k)).forEach(k => { const [n, u, a, b] = PHYS[k]; hs.push('<label class="sw-range">-' + k + ' ' + n + ' <input type="range" min="' + a + '" max="' + b + '" step="1" value="' + livePhys[k] + '" data-phys="' + k + '"> <output>' + livePhys[k] + '</output> ' + u + '</label>'); });
    $('swPlantBody').innerHTML = hs.length ? hs.join('') : '<p class="report-note">Für diese Aufgabe gibt es nichts zu bedienen.</p>';
    $('swPlant').style.display = hs.length ? '' : 'none';
  }
  function mark(res){
    lastMarks = res;
    res.steps.forEach(s => {
      const li = document.querySelector('.sw-step[data-step="' + s.i + '"]'); if(!li) return;
      li.classList.toggle('ok', s.ok); li.classList.toggle('bad', !s.ok);
      li.querySelector('.sw-ic').textContent = s.ok ? '✓' : '✗';
      const is = li.querySelector('.sw-issue'); is.hidden = s.ok; is.innerHTML = s.ok ? '' : s.issues.slice(0, 3).map(esc).join('<br>');
    });
  }

  /* ---------- Speichern ---------- */
  let saveT = 0, lastWires = -1, lastFuse = true;
  const sound = k => { if(h.sound) h.sound(k); };
  function changed(){
    if(ctx){ const n = ctx.state.wires.length; if(lastWires >= 0 && n !== lastWires) sound(n > lastWires ? 'snap' : 'unsnap'); lastWires = n;
      const f = ctx.state.meterFuse !== false; if(lastFuse && !f) sound('fuse'); lastFuse = f; }
    if(practice || !t) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const S = h.S(), L = ctx.cpu.loaded;
      S.drafts[t.id] = { state: JSON.parse(W().serialize(ctx.state)), hw: ctx.hw, tags: ctx.tags, lang: ctx.lang, source: ctx.source, answers: ctx.answers,
        loaded: L ? { source: L.source, lang: L.lang, tags: L.tags, hw: L.hw, run: ctx.cpu.mode === 'RUN' } : null };
      h.saveSoon();
    }, 400);
  }

  /* ---------- Prüfen, Bericht, Hinweise ---------- */
  function sync(){ ctx.source = eng.source; ctx.lang = eng.lang; }
  function check(){ sync(); const res = ST().checkTask(t, ctx); mark(res); return res; }
  function report(task, res){
    const bad = res.steps.filter(s => !s.ok);
    let html = '<div class="sw-report"><p>' + (bad.length ? '<b>' + bad.length + ' von ' + res.steps.length + ' Arbeitsschritten</b> sind noch nicht erfüllt.' : '<b>Alle ' + res.steps.length + ' Arbeitsschritte erfüllt.</b>') + '</p><ol>'
      + res.steps.map(s => '<li class="' + (s.ok ? 'ok' : 'bad') + '"><span>' + (s.ok ? '✓' : '✗') + '</span> ' + t.steps[s.i].text + (s.ok ? '' : '<ul>' + s.issues.slice(0, 4).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>') + '</li>').join('') + '</ol>';
    const pr = ctx.lastProgram;
    if(pr && pr.cases && pr.cases.length && t.program){
      html += '<details class="sw-prog"' + (pr.ok ? '' : ' open') + '><summary>Programmtest (' + pr.cases.filter(c => c.pass).length + '/' + pr.cases.length + ' Zyklen ok)</summary><table class="tc-table"><tr><th>Test</th><th>Eingänge</th><th>Prüfung</th></tr>'
        + pr.cases.map(c => '<tr class="' + (c.pass ? 'ok' : 'bad') + '"><td>' + esc(c.name) + (c.i ? ' · ' + (c.i + 1) : '') + '</td><td>' + esc(Object.keys(c.inputs || {}).map(k => k + '=' + fmt(c.inputs[k])).join(', ')) + '</td><td>' + (c.error ? esc(c.error) : (c.checks || []).map(x => (x.pass ? '✓ ' : '✗ ') + esc(x.name + ' = ' + fmt(x.actual) + (x.pass ? '' : ' (erwartet ' + fmt(x.expected) + ')'))).join('<br>')) + '</td></tr>').join('') + '</table></details>';
    }
    $('reportTitle').textContent = res.ok ? 'Abnahme bestanden' : 'Abnahmeprotokoll';
    $('reportBody').innerHTML = html + '</div>';
    $('reportCard').style.display = '';
  }
  const fmt = v => Array.isArray(v) ? v[0] + ' ± ' + v[1] : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
  function structHint(task){
    const res = ST().checkTask(task, Object.assign(ctx, { source: eng ? eng.source : ctx.source }));
    const open = res.steps.filter(s => !s.ok).map(s => (s.i + 1) + ' (' + KIND_LABEL[s.kind] + ')');
    return 'Die Aufgabe hat <b>' + task.steps.length + ' Arbeitsschritte</b>' + (open.length ? '. Noch offen: Schritt ' + open.join(', ') : ', alle sind erfüllt — jetzt „Arbeit prüfen“') + '.';
  }
  // nur für Tests: Referenz anwenden, ohne die Aufgabe als „Lösung angesehen“ zu markieren
  function applyRef(lang){ ctx = ST().applyRef(t, ST().newContext(t), lang); ctx.loaded = null; build(); changed(); }
  function reveal(task){ ctx = ST().applyRef(task, ST().newContext(task)); ctx.loaded = null; build(); changed(); }
  function reset(task){ ctx = ST().newContext(task); build(); changed(); }
  function solution(){ sync(); return ST().describe(t, ctx); }
  document.addEventListener('visibilitychange', () => { if(!document.hidden && t && !timer) startLoop(); });
  return { setup, check, report, structHint, reveal, reset, solution, applyRef, openLaptop, closeLaptop, get ctx(){ return ctx; }, get workshop(){ return ws; }, get engineering(){ return eng; }, get plc(){ return sess; }, live, livePhys };
}
const CSS = `
.steps-card .sw-steps{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.sw-step{ display:flex; gap:8px; padding:8px; border-radius:8px; background:var(--bg-soft, rgba(255,255,255,.03)); border:1px solid var(--border, #2a3a4c); }
.sw-step.ok{ border-color:#2e8b57; } .sw-step.bad{ border-color:#c0392b; }
.sw-ic{ flex:0 0 26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font:700 12px var(--mono, monospace); background:#1d2a37; color:#9fb0c0; }
.sw-step.ok .sw-ic{ background:#1f5e3a; color:#aef5c8; } .sw-step.bad .sw-ic{ background:#5e1f1f; color:#ffc4c4; }
.sw-body{ flex:1; min-width:0; } .sw-kind{ font:700 10px var(--mono, monospace); text-transform:uppercase; letter-spacing:.06em; color:#58c4ff; margin-right:4px; }
.sw-opts{ display:flex; flex-direction:column; gap:4px; margin-top:6px; } .sw-opt{ display:flex; gap:6px; align-items:flex-start; cursor:pointer; min-height:32px; }
.sw-num{ display:inline-flex; gap:6px; align-items:center; margin:6px 8px 0 0; } .sw-num input{ width:90px; min-height:34px; }
.sw-issue{ margin-top:4px; font-size:12px; color:#ff9a8a; }
.sw-plant{ margin-top:10px; } .sw-plant summary{ cursor:pointer; font-weight:600; margin-bottom:6px; }
.sw-row{ display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; } .sw-sel{ display:flex; flex-direction:column; font-size:12px; gap:2px; } .sw-sel select{ min-height:34px; }
.sw-press.on, .sw-plant .btn.on{ border-color:#ffd166; color:#ffd166; }
.sw-range{ display:flex; align-items:center; gap:6px; font-size:12px; flex-wrap:wrap; } .sw-range input{ flex:1; min-width:120px; }
.sw-wscard{ padding:10px; min-width:0; } .ws-titlebar{ display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; } .ws-title{ font-weight:700; flex:1; } .ws-tools{ display:flex; gap:6px; flex-wrap:wrap; }
.cb-mode .w2d-led{ width:auto; min-width:14px; height:14px; border-radius:7px; font:700 9px/14px monospace; text-align:center; color:#000; } .cb-mode .w2d-led::after{ content:'0'; color:#bbb; } .cb-mode .w2d-led.on::after{ content:'1'; color:#000; }
.eng-overlay{ position:fixed; inset:0; z-index:300; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:16px; } .eng-overlay[hidden]{ display:none; }
.eng-frame{ width:min(1100px, 100%); max-height:calc(100vh - 32px); overflow:auto; background:#0a0f14; border:1px solid #2a3a4c; border-radius:12px; padding:10px; }
.eng-frame-head{ display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:700; } .eng-frame-head .grow{ flex:1; }
.sw-report ol{ list-style:none; padding:0; margin:6px 0; } .sw-report li.ok > span{ color:#39d98a; } .sw-report li.bad > span{ color:#ff6b6b; } .sw-report li{ margin:4px 0; } .sw-report ul{ margin:2px 0 4px 18px; font-size:13px; color:#ffb4a8; }
.sw-prog table{ font-size:12px; } .sw-prog tr.bad td{ color:#ffb4a8; }
@media (max-width:760px){ .eng-overlay{ padding:0; align-items:stretch; } .eng-frame{ max-height:100vh; height:100%; border-radius:0; } }
`;
function injectCss(){ if(document.getElementById('swCss')) return; const s = document.createElement('style'); s.id = 'swCss'; s.textContent = CSS; document.head.appendChild(s); }
root.SensorGame = { create: h => { injectCss(); return create(h); } };
})(typeof window !== 'undefined' ? window : globalThis);
