(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Bedienung der Werkstatt (docs/SENSORWERKSTATT_PLAN.md Teil 2.5, 3, 4.1, 4.2; Paket S5)
   Verbindet die 3D-Werkstatt (SensorScene) mit der 2D-Klemmleiste (Wiring2D) über denselben Verdrahtungszustand (Wiring):
   - Werkzeugleiste: Hand, Schraubendreher, Gabelschlüssel, Crimpzange, Multimeter, Stromkalibrator (auch per Klick auf die Werkzeugwand)
   - Bauteil-Schild beim Überfahren, Detailkarte beim Klick (Datenblatt, M12-Belegung, Werte, Handlungen: Montieren, Anstecken, Ausrichten, Schirm …)
   - Multimeter (V DC, mA DC, Ω, Durchgang) mit Messspitzen auf Klemmstellen, Messprotokoll; Kalibrator für den Loop-Check
   - Röntgen-Schalter (Erfassungsbereiche, Leuchtpfad der Adern), Ansichten 1–7, 2D-Modus ohne WebGL (alle Handlungen über die Bauteilliste)
   API: Workshop.mount(host, { state, world(), phys(), parts, modules, x2, x3, mode:'3d'|'2d', quality, reduceMotion, xrayAllowed, onChange })
        → { state, scene, strip, tool, setTool, openCard, closeCard, setMode, meter, calib, protocol, refresh, destroy }
   ============================================================ */
const W = root.Wiring;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TOOLS = [
  { id: 'hand', name: 'Hand', icon: '✋', key: 'H' },
  { id: 'schrauber', name: 'Schraubendreher', icon: '🪛', key: 'S', part: 'T_SCHRAUBER' },
  { id: 'gabel', name: 'Gabelschlüssel', icon: '🔧', key: 'G', part: 'T_GABEL' },
  { id: 'crimp', name: 'Crimpzange', icon: '✂', key: 'C', part: 'T_CRIMP' },
  { id: 'multi', name: 'Multimeter', icon: '⎓', key: 'M', part: 'T_MULTI' },
  { id: 'kalib', name: 'Stromkalibrator', icon: '≋', key: 'K', part: 'T_KALIB' }
];
const TOOL_OF_PART = {}; TOOLS.forEach(t => { if(t.part) TOOL_OF_PART[t.part] = t.id; });
const M12 = [['1', 'BN', 'L+ (24 V)'], ['2', 'WH', 'Ausgang 2 / Öffner'], ['3', 'BU', 'M (0 V)'], ['4', 'BK', 'Schaltausgang']];
const PIN_COLOR = { BN: '#8b5a2b', BU: '#2f6fd0', BK: '#222222', WH: '#e8e8e8', '+': '#c0392b', '-': '#2f6fd0', 'L+': '#c0392b', M: '#2f6fd0', 'I+': '#8e44ad', 'I-': '#6c5ce7', '1': '#c0392b', '2': '#8e44ad', '3': '#2f6fd0' };
const METER_MODES = [['off', 'Aus'], ['V', 'V ⎓'], ['mA', 'mA ⎓'], ['ohm', 'Ω'], ['beep', 'Durchgang']];
const SIGNAL_OF = { B10: 'AI0', R1: 'AI1', B11: 'CH0', B12: 'CH1', B13: 'CH2' };

function mount(host, opt){
  opt = opt || {};
  const st = opt.state || W.newState();
  const world = opt.world || (() => ({})), phys = opt.phys || (() => ({}));
  const S3D = root.SensorScene;
  let mode = opt.mode || (S3D && S3D.isAvailable() && webgl() ? '3d' : '2d');
  let tool = 'hand', cardId = null, scene = null;
  const meterSt = { mode: 'off', red: null, black: null, last: null };
  const protocol = [];
  st.calib = st.calib || { on: false, channel: 'CH0', mA: 4, mode: 'quelle' };

  host.classList.add('ws');
  host.innerHTML = '<div class="ws-bar" role="toolbar" aria-label="Werkzeuge">'
    + TOOLS.map(t => '<button type="button" class="ws-tool" data-tool="' + t.id + '" aria-pressed="false" title="' + esc(t.name) + ' (' + t.key + ')"><span aria-hidden="true">' + t.icon + '</span> ' + esc(t.name) + '</button>').join('')
    + '<span class="ws-sep"></span>'
    + (opt.xrayAllowed === false ? '' : '<button type="button" class="ws-btn" data-x="xray" aria-pressed="false" title="Röntgen: Erfassungsbereiche und Stromfluss (Lernhilfe)">Röntgen</button>')
    + '<button type="button" class="ws-btn" data-x="mode" title="Zwischen 3D-Werkstatt und 2D-Ansicht wechseln">2D</button>'
    + '</div>'
    + '<nav class="ws-views" aria-label="Ansichten">' + [1, 2, 3, 4, 5, 6, 7].map(n => '<button type="button" class="ws-view" data-view="' + n + '" title="Taste ' + n + '">' + n + ' ' + esc(S3D ? S3D.VIEWS[n].name : '') + '</button>').join('') + '</nav>'
    + '<div class="ws-main"><div class="ws-stage"><div class="ws-canvas"></div><div class="ws-tag" role="tooltip" hidden></div></div>'
    + '<aside class="ws-card" aria-live="polite" hidden></aside></div>'
    + '<div class="ws-parts" aria-label="Bauteile"></div>'
    + '<div class="ws-inst"></div>'
    + '<div class="ws-strip"></div>'
    + '<details class="ws-proto"><summary>Messprotokoll (<span class="ws-pn">0</span>)</summary><table><thead><tr><th>#</th><th>Messung</th><th>Rot</th><th>Schwarz</th><th>Wert</th></tr></thead><tbody></tbody></table></details>';
  const $ = s => host.querySelector(s);

  /* ---------- 2D-Klemmleiste (gemeinsamer Zustand) ---------- */
  const strip = root.Wiring2D.mount($('.ws-strip'), { state: st, parts: opt.parts || ['B1'], modules: opt.modules || ['A1'], x2: opt.x2, x3: opt.x3, world,
    intercept: interceptStrip, probes: () => tool === 'multi' ? { red: meterSt.red, black: meterSt.black } : {}, onChange: () => sync() });
  function interceptStrip(kind, key){
    if(kind === 'knife' && tool !== 'schrauber') return 'Trennmesser: zuerst den Schraubendreher wählen.';
    if(kind !== 'node') return false;
    if(tool === 'multi'){
      if(!meterSt.red || (meterSt.red && meterSt.black)){ meterSt.red = key; meterSt.black = null; }
      else meterSt.black = key;
      measure(); return true;
    }
    if(tool === 'crimp'){
      const ws = st.wires.filter(w => (w.from === key || w.to === key) && !w.ferrule);
      if(!ws.length) return 'An ' + key + ' gibt es keine Ader ohne Aderendhülse.';
      strip.push(); ws.forEach(w => { w.ferrule = true; }); strip.message(ws.length + ' Aderendhülse(n) an ' + key + ' gecrimpt.', 'ok'); sync(); return true;
    }
    if(key.startsWith('B12:') && !(st.heads || {}).B12) return '-B12: Zuerst den Deckel des Anschlusskopfs öffnen (Detailkarte).';
    return false;
  }

  /* ---------- 3D ---------- */
  function mount3d(){
    if(scene || !S3D) return;
    try {
      scene = S3D.mount($('.ws-canvas'), { quality: opt.quality || 'auto', reduceMotion: opt.reduceMotion, preserve: !!opt.preserve,
        onPick: id => pick(id), onHover: (id, x, y) => tag(id, x, y), onView: n => { host.querySelectorAll('.ws-view').forEach(b => b.classList.toggle('on', +b.dataset.view === n)); } });
    } catch(e){ scene = null; mode = '2d'; }
  }
  function tag(id, x, y){
    const t = $('.ws-tag'); if(!id){ t.hidden = true; return; }
    const r = $('.ws-stage').getBoundingClientRect();
    t.innerHTML = '<b>-' + esc(id) + '</b> ' + esc(S3D.COMPONENTS[id] || '') + '<br><span>' + esc(stateText(id)) + '</span>';
    t.style.left = Math.min(r.width - 200, Math.max(0, x - r.left + 14)) + 'px'; t.style.top = Math.max(0, y - r.top + 14) + 'px'; t.hidden = false;
  }
  function pick(id){
    if(TOOL_OF_PART[id]){ setTool(TOOL_OF_PART[id]); return; }
    if(id === 'SCHRANK' && scene){ scene.setView(5); }
    if(tool === 'gabel' && W.MOUNTABLE[id] && W.MOUNTABLE[id].tool === 'gabel'){ const m = W.mountOf(st, id); act(id, m.tight ? 'loosen' : 'tighten'); }
    openCard(id);
  }

  /* ---------- Werkzeuge ---------- */
  function setTool(t){
    tool = t;
    host.querySelectorAll('.ws-tool').forEach(b => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const n = TOOLS.find(x => x.id === t);
    strip.message(t === 'multi' ? 'Multimeter: Messart wählen, dann zwei Klemmstellen antippen (rot, dann schwarz).' : t === 'crimp' ? 'Crimpzange: Klemmstelle einer Ader ohne Hülse antippen.' : t === 'kalib' ? 'Stromkalibrator: Kanal und Strom wählen, dann anklemmen.' : n.name + ' gewählt.');
    renderInst(); strip.refresh();
  }
  function renderInst(){
    const box = $('.ws-inst');
    if(tool === 'multi'){
      box.innerHTML = '<div class="ws-meter" role="group" aria-label="Multimeter"><div class="ws-lcd" aria-live="polite">' + esc(meterSt.last ? meterSt.last.text : '') + '</div>'
        + '<div class="ws-dial">' + METER_MODES.map(([k, n]) => '<button type="button" class="ws-btn" data-meter="' + k + '" aria-pressed="' + (meterSt.mode === k) + '">' + esc(n) + '</button>').join('') + '</div>'
        + '<div class="ws-probes">Rot: <b>' + esc(meterSt.red || '–') + '</b> · Schwarz: <b>' + esc(meterSt.black || '–') + '</b></div>'
        + (st.meterFuse === false ? '<button type="button" class="ws-btn warn" data-meter-fuse>Sicherung ersetzen</button>' : '')
        + '<button type="button" class="ws-btn" data-proto>Ins Protokoll</button>'
        + '<div class="ws-note">' + esc(meterSt.last && (meterSt.last.error || meterSt.last.hint) || '') + '</div></div>';
    } else if(tool === 'kalib'){
      const K = st.calib;
      box.innerHTML = '<div class="ws-meter" role="group" aria-label="Stromkalibrator"><div class="ws-lcd">' + (K.on ? (+K.mA).toFixed(2) + ' mA → ' + esc(K.channel) : 'nicht angeklemmt') + '</div>'
        + '<label>Kanal <select data-k="channel">' + ['CH0', 'CH1', 'CH2', 'CH3'].map(c => '<option' + (c === K.channel ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label> '
        + '<label>Strom <input data-k="mA" type="number" min="0" max="24" step="0.1" value="' + esc(K.mA) + '"> mA</label> '
        + '<span class="ws-quick">' + [4, 12, 20].map(v => '<button type="button" class="ws-btn" data-kset="' + v + '">' + v + ' mA</button>').join('') + '</span> '
        + '<label>Betrieb <select data-k="mode"><option value="quelle"' + (K.mode === 'quelle' ? ' selected' : '') + '>Quelle</option><option value="senke"' + (K.mode === 'senke' ? ' selected' : '') + '>Senke (simuliert 2-Leiter)</option></select></label> '
        + '<button type="button" class="ws-btn' + (K.on ? ' on' : '') + '" data-kon aria-pressed="' + !!K.on + '">' + (K.on ? 'Abklemmen' : 'Anklemmen') + '</button>'
        + '<button type="button" class="ws-btn" data-proto>Ins Protokoll</button>'
        + '<div class="ws-note">Vereinfachung: Quelle und Senke speisen den Kanal direkt. Rohwert: ' + esc(rawOf(K.channel)) + '</div></div>';
    } else box.innerHTML = '';
  }
  function measure(){
    meterSt.last = W.meter(st, meterSt.mode, meterSt.red, meterSt.black, { phys: phys() });
    if(meterSt.last.fuse) strip.message(meterSt.last.error, 'err');
    renderInst(); strip.refresh();
    return meterSt.last;
  }
  function addProto(){
    if(tool === 'multi' && meterSt.last && meterSt.last.text) protocol.push({ what: METER_MODES.find(m => m[0] === meterSt.mode)[1], red: meterSt.red, black: meterSt.black, text: meterSt.last.text, value: meterSt.last.value });
    else if(tool === 'kalib') protocol.push({ what: 'Kalibrator ' + st.calib.channel, red: (+st.calib.mA).toFixed(2) + ' mA', black: '', text: 'Rohwert ' + rawOf(st.calib.channel), value: rawOf(st.calib.channel) });
    else return;
    $('.ws-pn').textContent = protocol.length;
    $('.ws-proto tbody').innerHTML = protocol.map((p, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(p.what) + '</td><td>' + esc(p.red) + '</td><td>' + esc(p.black) + '</td><td>' + esc(p.text) + '</td></tr>').join('');
    $('.ws-proto').open = true;
  }
  function rawOf(ch){
    const a = W.analogAt(st, ch, phys()); if(!a.sig) return 32767;
    const cfg = (st.config || {})[ch] || { type: a.sig.kind === 'U' ? 'U' : 'I_2W', range: a.sig.kind === 'U' ? '0..10V' : '4..20mA', diag: { wireBreak: true } };
    return root.SensorModel.rawValue(a.sig, cfg);
  }

  /* ---------- Detailkarte ---------- */
  function stateText(id){
    const P = W.PARTS[id], ev = lastEval || {};
    if(P && P.di){ const on = (ev.di || {})[P.di]; return '%' + P.di + ' = ' + (on ? '1' : '0') + (W.HAS_M12(id) ? ' · M12 ' + W.plugState(st, id) : ''); }
    if(P && P.ai){ return 'Kanal ' + P.ai + ' · Rohwert ' + rawOf(P.ai); }
    if(id === 'Q0') return st.mainSwitch ? 'EIN' : 'AUS';
    if(id === 'G1') return ev.supply && ev.supply.dcOk && st.mainSwitch ? 'DC OK' : 'aus';
    if(id === 'F2' || id === 'F3') return st[id.toLowerCase() + 'Tripped'] ? 'ausgelöst' : 'in Ordnung';
    return '';
  }
  function openCard(id){
    cardId = id; const c = $('.ws-card'), P = W.PARTS[id];
    let h = '<header><b>-' + esc(id) + '</b> ' + esc((S3D && S3D.COMPONENTS[id]) || (P && P.name) || id) + '<button type="button" class="ws-x" data-close aria-label="Schliessen">×</button></header>';
    if(P) h += '<p class="ws-dat">' + esc(P.name) + '</p>';
    h += '<p class="ws-val">' + esc(stateText(id)) + '</p>';
    if(P && ['sensor3', 'sensor4', 'sender', 'analogU'].includes(P.type)){
      h += '<table class="ws-m12"><caption>M12-Belegung (A-codiert)</caption>' + M12.filter(r => P.pins.includes(r[1])).map(r => '<tr><td>' + r[0] + '</td><td><i style="background:' + PIN_COLOR[r[1]] + '"></i>' + r[1] + '</td><td>' + esc(r[2]) + '</td></tr>').join('') + '</table>';
      const ps = W.plugState(st, id);
      h += '<div class="ws-acts"><span>Leitung: <b data-plug-state>' + ps + '</b></span>'
        + (ps === 'ab' ? '<button type="button" class="ws-btn" data-act="plug">Anstecken</button>' : '')
        + (ps === 'lose' ? '<button type="button" class="ws-btn" data-act="plugTight">Rändelmutter festziehen</button>' : '')
        + (ps !== 'ab' ? '<button type="button" class="ws-btn" data-act="unplug">Abziehen</button>' : '') + '</div>';
    }
    if(P && (P.type === 'analog2w' || P.type === 'analog4w')) h += '<p class="ws-dat">Anschluss: ' + P.pins.map(p => '<i style="background:' + (PIN_COLOR[p] || '#999') + '"></i>' + esc(p)).join(' ') + (P.type === 'analog2w' ? ' · 2-Leiter: L+ → + ; − → AI x+ ; AI x− → M' : ' · 4-Leiter: eigene Versorgung, Ausgang I+/I− auf AI x+/x−') + '</p>';
    if(W.MOUNTABLE[id]){
      const m = W.mountOf(st, id), d = W.MOUNTABLE[id];
      h += '<div class="ws-acts"><span>' + (d.slot ? 'Position in der Nut' : 'Abstand') + ': <b data-dist>' + m.dist.toFixed(1) + ' mm</b> · ' + (m.tight ? 'fest' : 'gelöst') + '</span>'
        + '<button type="button" class="ws-btn" data-act="' + (m.tight ? 'loosen' : 'tighten') + '">' + (d.slot ? 'Klemmschraube ' : 'Kontermuttern ') + (m.tight ? 'lösen' : 'festziehen') + '</button>'
        + '<button type="button" class="ws-btn" data-act="minus" ' + (m.tight ? 'disabled' : '') + '>−0,5 mm</button><button type="button" class="ws-btn" data-act="plus" ' + (m.tight ? 'disabled' : '') + '>+0,5 mm</button></div>';
    }
    if(W.ALIGNABLE.includes(id)){
      const m = W.mountOf(st, id), q = W.alignQuality(m.align);
      h += '<div class="ws-acts"><span>Ausrichtung h ' + m.align.h + ' / v ' + m.align.v + ' · Stabilitäts-LED: <b data-align>' + ({ stabil: 'ruhig', knapp: 'blinkt', aus: 'aus' })[q] + '</b></span>'
        + ['h-', 'h+', 'v-', 'v+'].map(k => '<button type="button" class="ws-btn" data-align-k="' + k + '">' + k.replace('-', ' −').replace('+', ' +') + '</button>').join('') + '</div>';
    }
    if(id === 'B12') h += '<div class="ws-acts"><span>Anschlusskopf: <b>' + ((st.heads || {}).B12 ? 'offen' : 'zu') + '</b></span><button type="button" class="ws-btn" data-act="head">Deckel ' + ((st.heads || {}).B12 ? 'schliessen' : 'öffnen') + '</button></div>';
    if(P && P.ai) h += '<div class="ws-acts"><span>Schirm: <b>' + ((st.shields || {})[id] ? 'aufgelegt' : 'nicht aufgelegt') + '</b></span><button type="button" class="ws-btn" data-act="shield">' + ((st.shields || {})[id] ? 'Schirm lösen' : 'Schirm auf Schirmschiene -X3 legen') + '</button></div>';
    if(id === 'Q0') h += '<div class="ws-acts"><button type="button" class="ws-btn" data-act="main">' + (st.mainSwitch ? 'Ausschalten' : 'Einschalten') + '</button></div>';
    if(id === 'F2' || id === 'F3') h += '<div class="ws-acts"><button type="button" class="ws-btn" data-act="reset" ' + (st[id.toLowerCase() + 'Tripped'] ? '' : 'disabled') + '>Zurücksetzen</button></div>';
    if(/^X[1-4]$|^A[1-4]$/.test(id)) h += '<div class="ws-acts"><button type="button" class="ws-btn" data-act="strip">An der Klemmleiste verdrahten</button></div>';
    if(/^T_/.test(id)) h += '<p class="ws-dat">Werkzeug – Klick wählt es aus.</p>';
    c.innerHTML = h; c.hidden = false;
  }
  function closeCard(){ cardId = null; $('.ws-card').hidden = true; }
  function act(id, a){
    let r = { ok: true };
    const say = (text, kind) => strip.message(text, kind);
    strip.push();
    if(a === 'plug') r = W.plugAction(st, id, 'plug');
    else if(a === 'plugTight') r = W.plugAction(st, id, 'tighten');
    else if(a === 'unplug') r = W.plugAction(st, id, 'unplug');
    else if(a === 'loosen' || a === 'tighten') r = W.mountAction(st, id, a, null, tool);
    else if(a === 'minus' || a === 'plus') r = W.mountAction(st, id, 'move', W.mountOf(st, id).dist + (a === 'plus' ? 0.5 : -0.5), tool);
    else if(a === 'head'){ st.heads = st.heads || {}; st.heads[id] = !st.heads[id]; if(tool !== 'schrauber' && st.heads[id]){ st.heads[id] = false; r = { ok: false, error: 'Deckel: zuerst den Schraubendreher wählen.' }; } }
    else if(a === 'shield') r = W.shieldAction(st, id, !(st.shields || {})[id]);
    else if(a === 'main') st.mainSwitch = !st.mainSwitch;
    else if(a === 'reset'){ st[id.toLowerCase() + 'Tripped'] = false; }
    else if(a === 'strip'){ $('.ws-strip').scrollIntoView({ block: 'nearest' }); if(scene) scene.setView(6); }
    if(!r.ok) say(r.error, 'warn'); else if(r.warn) say(r.warn, 'warn'); else if(a !== 'strip') say('-' + id + ': erledigt.', 'ok');
    sync(); if(cardId) openCard(cardId);
    return r;
  }
  host.addEventListener('click', e => {
    const b = e.target.closest('button, [data-kon]'); if(!b || !host.contains(b)) return;
    if(b.dataset.tool){ setTool(b.dataset.tool); return; }
    if(b.dataset.view){ if(scene) scene.setView(+b.dataset.view); return; }
    if(b.dataset.x === 'xray'){ const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); if(scene) scene.setXray(on); sync(); return; }
    if(b.dataset.x === 'mode'){ setMode(mode === '3d' ? '2d' : '3d'); return; }
    if(b.dataset.close != null){ closeCard(); return; }
    if(b.dataset.act){ act(cardId, b.dataset.act); return; }
    if(b.dataset.alignK){ const m = W.mountOf(st, cardId).align, k = b.dataset.alignK; const nv = { h: m.h + (k === 'h+' ? 1 : k === 'h-' ? -1 : 0), v: m.v + (k === 'v+' ? 1 : k === 'v-' ? -1 : 0) }; const r = W.mountAction(st, cardId, 'align', nv, tool); if(!r.ok) strip.message(r.error, 'warn'); sync(); openCard(cardId); return; }
    if(b.dataset.part){ if(TOOL_OF_PART[b.dataset.part]) setTool(TOOL_OF_PART[b.dataset.part]); else openCard(b.dataset.part); return; }
    if(b.dataset.meter){ meterSt.mode = b.dataset.meter; measure(); return; }
    if(b.dataset.meterFuse != null){ st.meterFuse = true; strip.message('Neue Sicherung im Multimeter eingesetzt.', 'ok'); measure(); return; }
    if(b.dataset.proto != null){ addProto(); return; }
    if(b.dataset.kset){ st.calib.mA = +b.dataset.kset; sync(); renderInst(); return; }
    if(b.dataset.kon != null){ st.calib.on = !st.calib.on; strip.message(st.calib.on ? 'Kalibrator an ' + st.calib.channel + ' angeklemmt.' : 'Kalibrator abgeklemmt.', 'ok'); sync(); renderInst(); return; }
  });
  host.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.k; if(!k) return; st.calib[k] = k === 'mA' ? Math.max(0, Math.min(24, +e.target.value || 0)) : e.target.value; sync(); renderInst(); });
  host.addEventListener('keydown', e => {
    if(e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find(x => x.key === e.key.toUpperCase()); if(t && !e.target.closest('.w2d-t')){ setTool(t.id); e.preventDefault(); }
  });

  /* ---------- 2D-Modus ---------- */
  function renderParts(){
    const ids = Object.keys(S3D ? S3D.COMPONENTS : W.PARTS);
    $('.ws-parts').innerHTML = '<h4>Bauteile</h4>' + ids.map(id => '<button type="button" class="ws-chip" data-part="' + esc(id) + '">-' + esc(id) + '</button>').join('');
  }
  function setMode(m){
    mode = m === '3d' && S3D && S3D.isAvailable() && webgl() ? '3d' : '2d';
    host.classList.toggle('ws-2d', mode === '2d');
    $('[data-x="mode"]').textContent = mode === '3d' ? '2D' : '3D';
    if(mode === '3d') mount3d(); else if(scene){ scene.destroy(); scene = null; }
    if(mode === '2d') renderParts();
    sync();
  }

  /* ---------- Zustand → Szene ---------- */
  let lastEval = null;
  function sync(){
    lastEval = W.evaluate(st, world(), { t: opt.time ? opt.time() : 0 });
    strip.refresh();
    if(scene){
      const N = W.nets(st), on = !!st.mainSwitch && lastEval.supply.dcOk, leds = {};
      Object.keys(lastEval.di).forEach(a => { leds['D' + a] = lastEval.di[a]; });
      W.X2N.forEach(n => { const node = 'X2:' + n + '.S'; leds['X2_' + n] = on && ((N.isLP(node) && !N.isM(node)) || lastEval.hot.some(h => N.same(h, node))); });
      Object.keys(W.PARTS).forEach(id => {
        const P = W.PARTS[id]; if(!P.pins.includes('BN')) return;
        const powered = on && N.isLP(id + ':BN') && N.isM(id + ':BU') && (st.plugs || {})[id] !== false;
        const key = id.replace('.', '').replace(/^B4[12]$/, 'B4');
        leds[key + '_G'] = powered; leds[key + '_Y'] = powered && !!lastEval.sensorLed[id];
        if(lastEval.faults.some(f => f.part === id && f.code === 'short_output')) leds[key + '_Y'] = 'blink';
      });
      leds.G1_DCOK = on; leds.F2 = !!st.f2Tripped; leds.F3 = !!st.f3Tripped; leds.A1_RUN = on && st.cpu !== 'STOP';
      ['CH0', 'CH1', 'CH2', 'CH3'].forEach((c, i) => { const cfg = (st.config || {})[c]; leds['A2_CH' + i] = on && !!cfg && cfg.type !== 'off'; });
      scene.setState({ leds, doorOpen: scene.view === 5 || scene.view === 6, dist: Object.fromEntries(Object.keys(W.MOUNTABLE).map(k => [k, W.mountOf(st, k).dist])) });
      scene.setWires(st.wires.map(w => ({ from: w.from, to: w.to, color: wireColor(w), hot: lastEval.hot.some(h => N.same(h, w.from)) || (on && N.isLP(w.from)) })));
    }
    if(opt.onChange) opt.onChange(st, lastEval);
  }
  function wireColor(w){ const p = n => W.PARTS[n.split(':')[0]] ? PIN_COLOR[n.split(':')[1]] : null; return p(w.from) || p(w.to) || '#1f3a93'; }

  setMode(mode); setTool('hand');
  return {
    get state(){ return st; }, get scene(){ return scene; }, strip, get tool(){ return tool; }, setTool, openCard, closeCard, setMode, get mode(){ return mode; },
    meter: { get mode(){ return meterSt.mode; }, setMode: m => { meterSt.mode = m; return measure(); }, probe: (red, black) => { meterSt.red = red; meterSt.black = black; return measure(); }, get reading(){ return meterSt.last; } },
    calib: st.calib, protocol, act: (id, a) => act(id, a), refresh: sync, get evaluation(){ return lastEval; },
    destroy(){ if(scene) scene.destroy(); host.innerHTML = ''; }
  };
}
function webgl(){ try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch(e){ return false; } }
const CSS = `
.ws{ color:#dbe7f3; font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif; display:flex; flex-direction:column; gap:8px; }
.ws-bar, .ws-views{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.ws-tool, .ws-btn, .ws-view, .ws-chip{ min-height:40px; padding:6px 10px; border-radius:8px; border:1px solid #2a3a4c; background:#16202b; color:inherit; cursor:pointer; font:inherit; }
.ws-view{ min-height:32px; font-size:12px; }
.ws-tool.on, .ws-btn.on, .ws-view.on{ border-color:#39ff7a; color:#39ff7a; }
.ws-btn.warn{ border-color:#ffd166; color:#ffd166; } .ws-btn[disabled]{ opacity:.45; cursor:not-allowed; }
.ws-sep{ flex:1; }
.ws-main{ position:relative; display:flex; gap:8px; }
.ws-stage{ position:relative; flex:1; min-width:0; }
.ws-canvas{ width:100%; height:min(58vh, 560px); border-radius:10px; overflow:hidden; background:#14171b; }
.ws-canvas canvas{ display:block; width:100% !important; height:100% !important; }
.ws-tag{ position:absolute; pointer-events:none; background:rgba(8,12,16,.92); border:1px solid #39ff7a55; border-radius:8px; padding:6px 8px; font-size:12px; max-width:240px; z-index:5; }
.ws-tag span{ color:#9fb0c0; }
.ws-card{ width:300px; max-width:100%; background:#0c1218; border:1px solid #2a3a4c; border-radius:10px; padding:10px; max-height:min(58vh, 560px); overflow:auto; }
.ws-card header{ display:flex; gap:6px; align-items:baseline; margin-bottom:6px; } .ws-card header b{ color:#ffd166; }
.ws-x{ margin-left:auto; min-width:36px; min-height:36px; border:0; background:none; color:#9fb0c0; font-size:20px; cursor:pointer; }
.ws-dat{ color:#9fb0c0; font-size:12px; margin:4px 0; } .ws-val{ color:#7fe3a0; font:600 13px ui-monospace,monospace; margin:4px 0; }
.ws-m12{ border-collapse:collapse; font-size:12px; margin:6px 0; } .ws-m12 caption{ text-align:left; color:#8aa0b4; }
.ws-m12 td{ padding:2px 6px; border-bottom:1px solid #1d2a37; }
.ws-card i, .ws-m12 i{ display:inline-block; width:10px; height:10px; border-radius:50%; border:1px solid #888; margin-right:4px; vertical-align:-1px; }
.ws-acts{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:8px 0; padding-top:6px; border-top:1px solid #1d2a37; } .ws-acts span{ width:100%; font-size:12px; color:#c5d3e0; }
.ws-meter{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; background:#0c1218; border:1px solid #2a3a4c; border-radius:10px; padding:8px; }
.ws-lcd{ min-width:150px; padding:6px 10px; background:#9fb58a; color:#10180c; font:700 20px ui-monospace,monospace; border-radius:6px; text-align:right; min-height:34px; }
.ws-dial{ display:flex; flex-wrap:wrap; gap:4px; } .ws-dial .ws-btn[aria-pressed="true"]{ border-color:#ffd166; color:#ffd166; }
.ws-probes{ font-size:12px; color:#c5d3e0; } .ws-note{ width:100%; font-size:12px; color:#ffd166; }
.ws-meter input{ width:70px; min-height:32px; } .ws-meter select{ min-height:32px; }
.ws-parts{ display:none; flex-wrap:wrap; gap:4px; } .ws-parts h4{ width:100%; margin:0; font:600 12px ui-monospace,monospace; color:#8aa0b4; }
.ws-2d .ws-parts{ display:flex; } .ws-2d .ws-stage, .ws-2d .ws-views{ display:none; } .ws-2d .ws-main{ display:block; } .ws-2d .ws-card{ width:auto; max-height:none; }
.ws-chip{ min-height:44px; min-width:44px; font:600 12px ui-monospace,monospace; }
.ws-proto table{ border-collapse:collapse; font-size:12px; } .ws-proto td, .ws-proto th{ padding:2px 8px; border-bottom:1px solid #1d2a37; text-align:left; }
@media (max-width:760px){ .ws-main{ flex-direction:column; } .ws-card{ width:auto; } .ws-canvas{ height:46vh; } .ws-tool{ padding:6px 8px; font-size:12px; } }
`;
function injectCss(){ if(typeof document === 'undefined' || document.getElementById('wsCss')) return; const s = document.createElement('style'); s.id = 'wsCss'; s.textContent = CSS; document.head.appendChild(s); }
root.Workshop = { mount: (h, o) => { injectCss(); return mount(h, o); }, TOOLS, CSS };
})(typeof window !== 'undefined' ? window : globalThis);
