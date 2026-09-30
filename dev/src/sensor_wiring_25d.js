(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — 2.5D-Verdrahtungsansicht (Paket W4, Vertrag docs/SENSOR_VISUAL_VERTRAG.md Abschnitt 2.4)
   Drei Zonen von links nach rechts: Sensor mit Kabel und freien Adern · Klemmleisten (-X1 Verteiler, -X2 Initiatorenklemmen mit
   drei Ebenen und Signal-LED, -X3 Trennklemmen) · CPU / Baugruppen (Frontansicht, herstellerneutral). Adern und Klemmstellen sind
   echte Schaltflächen (Ziehen, Antippen–Antippen, Tastatur, Touch ≥ 44 px); Kabel, Sensor-Illustrationen und Schatten liegen als
   SVG-Ebenen darunter/darüber. Zustände immer als Farbe UND Zeichen/Text (✓ ✗ ○ •). Kein eigener Wahrheitszustand: das Spiel ruft
   update(SensorVisual.state(…)) nach jedem Ereignis.

   const view = SensorWiring25D.mount(container, { netlist, state, options:{ lang:'de', reducedMotion:false, touch:false, colorAid:false } });
   view.update(state) · view.help(coreId?) · view.on/off(ev, fn) · view.select(coreId) · view.destroy()
   Ereignisse: wireStart(coreId) · wireDrop(coreId, terminalId) · wireRemove(coreId) · helpShow(coreId, terminalId) · meterProbe(terminalId, probeNr)
   ============================================================ */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SYM = { ok: '✓', falsch: '✗', fehlt: '○', gesetzt: '•' };
const TXT = { ok: 'richtig', falsch: 'falsch', fehlt: 'fehlt', gesetzt: 'gelegt' };
const DASH = { BN: '', BU: '10 6', BK: '3 5', WH: '14 5 3 5', '+': '', '-': '10 6', 'L+': '', M: '10 6', 'I+': '3 5', 'I-': '14 5 3 5' };   // Farbsehhilfe: Strichmuster je Ader
const MODULE_NAME = { A1: 'CPU 1214C DC/DC/DC', A2: 'SM 1231 AI 4', A3: 'SM 1232 AQ 2', A4: 'SM 1221 DI 8' };
const STRIP_NAME = { X1: '-X1 Verteiler L+ / M', X2: '-X2 Initiatorenklemmen', X3: '-X3 Trennklemmen 4–20 mA' };
const LEVEL_TITLE = { 'L+': 'Ebene L+ (24 V)', S: 'Ebene Signal', M: 'Ebene M (0 V)' };

/* ---------- Sensor-Illustrationen (SVG, herstellerneutral) ---------- */
function shapeSvg(p, led){
  const S = p.shape, lit = led ? '#ffd21e' : '#4a4a30', glow = led ? '<circle cx="66" cy="22" r="7" fill="#ffd21e" opacity=".35"/>' : '';
  const ring = '<rect x="4" y="30" width="20" height="60" rx="3" fill="#6b727a"/><rect x="4" y="34" width="20" height="4" fill="#3f454c"/><rect x="4" y="80" width="20" height="4" fill="#3f454c"/>';
  if(/induktiv|kapazitiv|zylinderschalter|ultraschall/.test(S)){
    const col = /kapazitiv/.test(S) ? '#d9b04a' : /ultraschall/.test(S) ? '#5aa9e6' : '#8f959c', face = /kapazitiv/.test(S) ? '#e7c766' : /ultraschall/.test(S) ? '#9fd0ff' : '#c9ced4';
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><defs><linearGradient id="g' + esc(p.id) + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs>'
      + '<ellipse cx="60" cy="108" rx="44" ry="6" fill="#000" opacity=".35"/><rect x="20" y="36" width="80" height="48" rx="6" fill="' + col + '"/><rect x="20" y="36" width="80" height="48" rx="6" fill="url(#g' + esc(p.id) + ')"/>'
      + [28, 40, 52, 64, 76, 88].map(x => '<rect x="' + x + '" y="38" width="3" height="44" fill="#000" opacity=".18"/>').join('')
      + '<rect x="8" y="46" width="14" height="28" rx="3" fill="' + face + '"/><rect x="100" y="42" width="14" height="36" rx="3" fill="#3a3f45"/>'
      + glow + '<circle cx="66" cy="22" r="4" fill="' + lit + '"/><text x="60" y="100" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  if(/lichttaster|lichtschranke|reflexlichtschranke/.test(S)){
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><ellipse cx="60" cy="108" rx="40" ry="6" fill="#000" opacity=".35"/><rect x="28" y="30" width="64" height="60" rx="8" fill="#2f5ba8"/><rect x="28" y="30" width="64" height="18" rx="8" fill="#3d6fc4"/>'
      + '<circle cx="46" cy="66" r="9" fill="#dfe9ff"/><circle cx="74" cy="66" r="9" fill="#ffb3b3"/><circle cx="46" cy="66" r="4" fill="#20304a"/><circle cx="74" cy="66" r="4" fill="#802020"/>'
      + glow + '<circle cx="66" cy="22" r="4" fill="' + lit + '"/><text x="60" y="104" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  if(/drucktransmitter|pt100|durchflussmesser/.test(S)){
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><ellipse cx="60" cy="110" rx="40" ry="6" fill="#000" opacity=".35"/><rect x="36" y="70" width="48" height="26" rx="4" fill="#8f959c"/><rect x="42" y="94" width="36" height="12" fill="#6b727a"/>'
      + '<rect x="24" y="24" width="72" height="48" rx="10" fill="#4a6b8a"/><rect x="24" y="24" width="72" height="14" rx="10" fill="#5e84a8"/><rect x="34" y="42" width="52" height="22" rx="3" fill="#0b1a26"/><text x="60" y="58" text-anchor="middle" font-size="12" fill="#9fdcff" font-family="ui-monospace,monospace">4–20 mA</text>'
      + '<text x="60" y="118" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  if(/taster|not_halt|wahlschalter|positionsschalter|schwimmer|potentiometer/.test(S)){
    const col = /rot|not_halt/.test(S) ? '#d63a3a' : /gruen/.test(S) ? '#39b54a' : '#c9ced4';
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><ellipse cx="60" cy="108" rx="40" ry="6" fill="#000" opacity=".35"/><rect x="24" y="44" width="72" height="50" rx="6" fill="#3a3f45"/><rect x="30" y="50" width="60" height="38" rx="4" fill="#20242a"/>'
      + '<circle cx="60" cy="44" r="26" fill="#2a2e33"/><circle cx="60" cy="42" r="20" fill="' + col + '"/><circle cx="60" cy="38" r="14" fill="#fff" opacity=".18"/>'
      + '<text x="60" y="106" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><rect x="20" y="30" width="80" height="60" rx="8" fill="#6b727a"/>' + ring + '<text x="60" y="106" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
}

function mount(container, opt){
  opt = opt || {};
  const o = Object.assign({ lang: 'de', reducedMotion: false, touch: false, colorAid: false }, opt.options || {});
  if(o.reducedMotion == null && root.matchMedia) o.reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  injectCss();
  let nl = opt.netlist, st = opt.state || null, sel = null, helpPair = null, drag = null, raf = 0;
  const handlers = {};
  const emit = (ev, ...a) => (handlers[ev] || []).slice().forEach(f => { try { f(...a); } catch(e){ if(root.console) console.error(e); } });
  container.classList.add('sw25'); container.classList.toggle('sw25-coloraid', !!o.colorAid); container.classList.toggle('sw25-reduced', !!o.reducedMotion); container.classList.toggle('sw25-touch', !!o.touch);
  container.innerHTML = '<div class="sw25-msg" role="status" aria-live="polite"></div><div class="sw25-stage"><svg class="sw25-wires sw25-under" aria-hidden="true"></svg><div class="sw25-body"></div><svg class="sw25-wires sw25-over" aria-hidden="true"></svg></div>';
  const body = container.querySelector('.sw25-body'), msg = container.querySelector('.sw25-msg'), stage = container.querySelector('.sw25-stage');
  const under = container.querySelector('.sw25-under'), over = container.querySelector('.sw25-over');
  const say = t => { msg.textContent = t || ''; };
  const resultOf = core => (st && st.results && st.results[core]) || 'fehlt';
  const wireOf = core => st && st.wires ? st.wires.find(w => w.core === core) : null;
  const termSpec = id => nl.terminals.find(t => t.id === id);
  const partOf = core => nl.parts.find(p => p.id === core.split(':')[0]);
  const busyOf = id => st && st.wires ? st.wires.filter(w => w.b === id || w.a === id).length + (st.links || []).filter(l => l.a === id || l.b === id).length : 0;
  // wirksame Bedeutung: Klemmen mit liegender Ader/Leitung sind nie „ruhe“ (vorbefüllte Aufgaben ohne eigenen Verdrahtungsschritt)
  const relOfT = t => t.relevance !== 'ruhe' ? t.relevance : busyOf(t.id) ? 'nah' : 'ruhe';

  /* ---------- Aufbau ---------- */
  function partHtml(p){
    const led = st && st.sensorLeds && st.sensorLeds[p.id];
    const cores = p.cable.cores.map(c => {
      const r = resultOf(c.id), w = wireOf(c.id), pin = c.m12Pin ? ' · Pin ' + c.m12Pin : '';
      return '<button type="button" class="sw25-core r-' + r + (sel === c.id ? ' sel' : '') + '" draggable="true" data-core="' + esc(c.id) + '" data-pin="' + esc(c.pin) + '" data-result="' + r + '" aria-pressed="' + (sel === c.id) + '"'
        + ' aria-label="Ader ' + esc(c.pin) + ' (' + esc(c.color) + pin + ') von ' + esc(p.label) + (c.role ? ', ' + esc(c.role) : '') + ', ' + TXT[r] + (w ? ', liegt auf ' + esc(w.b) : '') + '" title="' + esc(c.color) + (c.role ? ' · ' + esc(c.role) : '') + ' – ziehen oder antippen">'
        + '<i class="sw25-chip" style="background:' + esc(c.hex) + '" aria-hidden="true"></i><span class="sw25-pin">' + esc(c.pin) + '</span><small>' + esc(c.color) + (c.role ? ' · ' + esc(c.role) : '') + '</small><b class="sw25-sym" aria-hidden="true">' + SYM[r] + '</b></button>';
    }).join('');
    return '<section class="sw25-part" data-part="' + esc(p.id) + '"><div class="sw25-sensor">' + shapeSvg(p, led) + '<div class="sw25-sensorled" data-lit="' + (led ? 1 : 0) + '" aria-hidden="true"></div></div>'
      + '<div class="sw25-cable"><div class="sw25-cabletrunk" data-conn="' + esc(p.cable.connector) + '"><span class="sw25-conn">' + (p.cable.connector === 'm12' ? 'M12' : 'Litze') + '</span></div><div class="sw25-cores">' + cores + '</div></div>'
      + '<h3><b>' + esc(p.label) + '</b> <span>' + esc(p.name) + '</span>' + (p.address ? ' <code>' + esc(p.address) + '</code>' : '') + '</h3></section>';
  }
  function termBtn(t){
    const lit = st && st.leds && st.leds[t.id], target = helpPair && (helpPair.terminal === t.id || helpPair.to === t.id || helpPair.from === t.id);
    const busy = st && st.wires ? st.wires.filter(w => w.b === t.id || w.a === t.id).length : 0;
    return '<button type="button" class="sw25-term rel-' + relOfT(t) + ' lv-' + esc((t.level || t.polarity || '').replace('+', 'P')) + (target ? ' pulse' : '') + '" data-terminal="' + esc(t.id) + '" data-lit="' + (lit ? 1 : 0) + '" data-busy="' + busy + '"'
      + ' aria-label="Klemme ' + esc(t.id) + (t.address ? ', Adresse ' + esc(t.address) : '') + (t.potential ? ', Potential ' + esc(t.potential) : '') + (lit ? ', Signal aktiv' : '') + '" title="' + esc(t.id) + (t.address ? ' · ' + esc(t.address) : '') + '">'
      + '<i class="sw25-hole" aria-hidden="true"></i><span class="sw25-tl">' + esc(t.label) + '</span>' + (t.address ? '<small class="sw25-addr">' + esc(t.address) + '</small>' : '') + (t.led ? '<b class="sw25-led" aria-hidden="true">' + (lit ? '●' : '○') + '</b>' : '') + '</button>';
  }
  function stripsHtml(){
    const byBlock = {};
    nl.terminals.filter(t => /^X\d$/.test(t.block)).forEach(t => { (byBlock[t.block] = byBlock[t.block] || {})[t.group] = (byBlock[t.block][t.group] || []).concat(t); });
    return ['X2', 'X3', 'X1'].filter(b => byBlock[b]).map(b => {
      const groups = byBlock[b], keys = Object.keys(groups).sort((x, y) => groups[x][0].row - groups[y][0].row);
      const order = b === 'X2' ? ['L+', 'S', 'M'] : b === 'X3' ? ['a', 'b'] : ['L+', 'M'];
      const relOf = ts => ts.some(t => relOfT(t) === 'ziel') ? 'ziel' : ts.some(t => relOfT(t) === 'nah') ? 'nah' : 'ruhe';
      const row = g => { const ts = groups[g]; return '<div class="sw25-tgroup rel-' + relOf(ts) + '" data-group="' + esc(g) + '"><span class="sw25-rowno">' + esc(String(ts[0].row)) + '</span>' + order.map(l => { const t = ts.find(x => x.level === l); return t ? termBtn(t) : ''; }).join('') + '</div>'; };
      const shown = keys.filter(g => relOf(groups[g]) !== 'ruhe'), rest = keys.filter(g => relOf(groups[g]) === 'ruhe');
      // Nie 60 gleiche Klemmen: unbeteiligte Zeilen eingeklappt („weitere Klemmen“), beim Ziehen aufgeklappt
      const more = rest.length ? '<details class="sw25-more"><summary>' + rest.length + ' weitere Klemmen' + (shown.length ? '' : ' (alle frei)') + '</summary><div class="sw25-rows">' + rest.map(row).join('') + '</div></details>' : '';
      return '<section class="sw25-strip sw25-strip-' + b + '" data-block="' + b + '"><h4>' + esc(STRIP_NAME[b] || b) + '</h4>' + (b === 'X2' ? '<div class="sw25-levels" aria-hidden="true"><span></span><span>L+</span><span>Signal</span><span>M</span></div>' : '') + '<div class="sw25-rows">' + shown.map(row).join('') + '</div>' + more + '</section>';
    }).join('');
  }
  function modulesHtml(){
    const mods = nl.modules.map(m => m.id);
    return mods.map(mid => {
      const ts = nl.terminals.filter(t => t.block === mid), groups = {};
      ts.forEach(t => { (groups[t.group] = groups[t.group] || []).push(t); });
      const gk = Object.keys(groups).sort((a, b) => (/DI/.test(b) ? 1 : 0) - (/DI/.test(a) ? 1 : 0) || a.localeCompare(b));
      const rel = ts.some(t => relOfT(t) === 'ziel') ? 'ziel' : ts.some(t => relOfT(t) === 'nah') ? 'nah' : 'ruhe';
      return '<section class="sw25-module rel-' + rel + '" data-module="' + mid + '"><div class="sw25-modhead"><b>-' + mid + '</b> ' + esc(MODULE_NAME[mid] || mid) + '<span class="sw25-modleds" aria-hidden="true"><i class="on"></i><i></i><i></i></span></div>'
        + (() => { const grp = g => '<div class="sw25-mgroup" data-group="' + esc(g) + '"><span class="sw25-gname">' + esc(g.split(':')[1] || g) + '</span><div class="sw25-mrow">' + groups[g].sort((a, b) => (a.address || a.label).localeCompare(b.address || b.label, 'de', { numeric: true })).map(termBtn).join('') + '</div></div>';
          const relG = g => groups[g].some(t => relOfT(t) === 'ziel') ? 'ziel' : groups[g].some(t => relOfT(t) === 'nah') ? 'nah' : 'ruhe';
          const shown = gk.filter(g => relG(g) !== 'ruhe'), rest = gk.filter(g => relG(g) === 'ruhe');
          return shown.map(grp).join('') + (rest.length ? '<details class="sw25-more"><summary>' + rest.reduce((n, g) => n + groups[g].length, 0) + ' weitere Klemmen</summary>' + rest.map(grp).join('') + '</details>' : ''); })() + '</section>';
    }).join('');
  }
  function render(){
    body.innerHTML = '<div class="sw25-zone sw25-zone-parts">' + nl.parts.map(partHtml).join('') + '</div>'
      + '<div class="sw25-zone sw25-zone-strips">' + stripsHtml() + '</div>'
      + '<div class="sw25-zone sw25-zone-modules">' + modulesHtml() + '</div>';
    body.querySelectorAll('.sw25-core').forEach(b => { if(helpPair && helpPair.core === b.dataset.core) b.classList.add('pulse'); });
    schedule();
  }

  /* ---------- Kabel zeichnen (SVG-Ebenen) ---------- */
  function rect(el){ const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top, cx: r.left + r.width / 2 - s.left, cy: r.top + r.height / 2 - s.top }; }
  // Anschlusspunkte und Kurve: liegt die Klemme rechts, geht die Ader waagrecht (S-Kurve); liegt sie darunter (Handy: eine Spalte), senkrecht
  function route(A, B){
    const a = rect(A), b = rect(B);
    if(b.l - a.r > 40){ const p = { x: a.r, y: a.cy }, q = { x: b.l + 10, y: b.cy }, dx = Math.max(40, (q.x - p.x) * 0.45); return { a: p, b: q, d: 'M' + p.x + ' ' + p.y + ' C' + (p.x + dx) + ' ' + p.y + ' ' + (q.x - dx) + ' ' + q.y + ' ' + q.x + ' ' + q.y }; }
    const p = { x: a.cx, y: a.b }, q = { x: b.l + 10, y: b.t }, dy = Math.max(30, (q.y - p.y) * 0.5);
    return { a: p, b: q, d: 'M' + p.x + ' ' + p.y + ' C' + p.x + ' ' + (p.y + dy) + ' ' + q.x + ' ' + (q.y - dy) + ' ' + q.x + ' ' + q.y };
  }
  function pos(el, side){ const r = rect(el); return { x: side === 'right' ? r.r : side === 'left' ? r.l : r.cx, y: r.cy }; }
  function path(a, b){ const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45); return 'M' + a.x + ' ' + a.y + ' C' + (a.x + dx) + ' ' + a.y + ' ' + (b.x - dx) + ' ' + b.y + ' ' + b.x + ' ' + b.y; }
  function draw(){
    const s = stage.getBoundingClientRect(); [under, over].forEach(svg => { svg.setAttribute('width', s.width); svg.setAttribute('height', s.height); svg.setAttribute('viewBox', '0 0 ' + s.width + ' ' + s.height); });
    let u = '', v = '';
    const coreEl = id => body.querySelector('[data-core="' + CSS.escape(id) + '"]'), termEl = id => body.querySelector('[data-terminal="' + CSS.escape(id) + '"]');
    // Leitungen zwischen Klemmen (vorgegeben) – unter den Schaltflächen, dunkelblau wie im Schrank
    (st && st.links || []).forEach(l => { const A = termEl(l.a), B = termEl(l.b); if(!A || !B || A.closest('details:not([open])') || B.closest('details:not([open])')) return; u += '<path d="' + route(A, B).d + '" class="sw25-link"/>'; });
    // Adern der Bauteile
    (st && st.wires || []).forEach(w => {
      if(!w.core) return; const A = coreEl(w.core), B = termEl(w.b); if(!A || !B) return;
      if(B.closest('details:not([open])')) B.closest('details').open = true;
      const c = (partOf(w.core) || { cable: { cores: [] } }).cable.cores.find(x => x.id === w.core) || {}, rt = route(A, B), a = rt.a, b = rt.b, d = rt.d, r = resultOf(w.core);
      u += '<path d="' + d + '" class="sw25-shadow"/>';
      v += '<path d="' + d + '" class="sw25-wire r-' + r + '" stroke="' + esc(c.hex || '#888') + '"' + (o.colorAid && DASH[c.pin] ? ' stroke-dasharray="' + DASH[c.pin] + '"' : '') + '/>'
        + (r === 'ok' || r === 'falsch' ? '<g class="sw25-mark r-' + r + '" transform="translate(' + (b.x - 14) + ' ' + (b.y - 14) + ')"><circle cx="0" cy="0" r="9"/><text x="0" y="4" text-anchor="middle">' + SYM[r] + '</text></g>' : '')
        + '<text class="sw25-wlabel" x="' + ((a.x + b.x) / 2) + '" y="' + ((a.y + b.y) / 2 - 6) + '" text-anchor="middle">' + esc(c.pin || '') + '</text>';
    });
    if(drag && drag.x != null){ const A = coreEl(drag.core); if(A){ const a = pos(A, 'right'); v += '<path d="' + path(a, { x: drag.x, y: drag.y }) + '" class="sw25-wire sw25-preview" stroke="' + esc(drag.hex) + '"/>'; } }
    under.innerHTML = u; over.innerHTML = v;
  }
  function schedule(){ if(raf) return; raf = (root.requestAnimationFrame || setTimeout)(() => { raf = 0; draw(); }); }
  const ro = root.ResizeObserver ? new ResizeObserver(schedule) : null; if(ro) ro.observe(stage);
  root.addEventListener('resize', schedule);

  /* ---------- Bedienung ---------- */
  function select(core){ sel = core || null; if(sel) emit('wireStart', sel); say(sel ? 'Ader ' + sel.split(':')[1] + ' gewählt – jetzt eine Klemmstelle antippen (Esc bricht ab).' : ''); render(); }
  function drop(core, term){ if(!core || !term) return; helpPair = null; emit('wireDrop', core, term); sel = null; say('Ader ' + core.split(':')[1] + ' auf ' + term + ' gelegt.'); render(); }
  function markAllowed(core){ body.querySelectorAll('details.sw25-more').forEach(d => { d.open = true; }); schedule(); const ok = new Set((nl.allowed[core] || [])); body.querySelectorAll('[data-terminal]').forEach(b => { b.classList.toggle('allowed', ok.has(b.dataset.terminal)); b.classList.toggle('dim', !ok.has(b.dataset.terminal)); }); container.classList.add('sw25-dragging'); }
  function clearAllowed(){ body.querySelectorAll('.allowed,.dim').forEach(b => b.classList.remove('allowed', 'dim')); container.classList.remove('sw25-dragging'); }
  body.addEventListener('click', e => {
    const c = e.target.closest('[data-core]'), t = e.target.closest('[data-terminal]');
    if(c){ select(sel === c.dataset.core ? null : c.dataset.core); return; }
    if(t){ if(sel) drop(sel, t.dataset.terminal); else emit('meterProbe', t.dataset.terminal, 1); }
  });
  body.addEventListener('keydown', e => {
    const c = e.target.closest && e.target.closest('[data-core]'), t = e.target.closest && e.target.closest('[data-terminal]');
    if((e.key === 'Delete' || e.key === 'Backspace') && c){ e.preventDefault(); emit('wireRemove', c.dataset.core); say('Ader ' + c.dataset.core.split(':')[1] + ' gelöst.'); return; }
    if(e.key === 'Escape'){ sel = null; clearAllowed(); render(); return; }
    if(/^Arrow/.test(e.key) && (c || t)){
      const list = [...body.querySelectorAll(c ? '[data-core]' : '[data-terminal]')], i = list.indexOf(e.target), d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const n = list[(i + d + list.length) % list.length]; if(n){ e.preventDefault(); n.focus(); }
    }
  });
  // HTML5 Drag & Drop (Maus)
  body.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-core]'); if(!c) return; sel = c.dataset.core; e.dataTransfer.setData('text/plain', 'core:' + sel); e.dataTransfer.effectAllowed = 'move'; emit('wireStart', sel); markAllowed(sel); });
  body.addEventListener('dragend', () => { clearAllowed(); drag = null; schedule(); });
  body.addEventListener('dragover', e => { const t = e.target.closest && e.target.closest('[data-terminal]'); if(t){ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; body.querySelectorAll('.over').forEach(x => x.classList.remove('over')); t.classList.add('over'); } });
  body.addEventListener('drop', e => { const t = e.target.closest && e.target.closest('[data-terminal]'); if(!t) return; e.preventDefault(); const d = (e.dataTransfer.getData('text/plain') || '').replace(/^core:/, ''); clearAllowed(); drop(d || sel, t.dataset.terminal); });
  // Zeiger-Ziehen (Touch/Stift): Vorschau-Ader folgt dem Finger, Loslassen über einer Klemmstelle legt auf
  body.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse') return; const c = e.target.closest && e.target.closest('[data-core]'); if(!c) return;
    const core = c.dataset.core, cc = (partOf(core) || { cable: { cores: [] } }).cable.cores.find(x => x.id === core) || {};
    drag = { core, hex: cc.hex || '#888', x: null, y: null, id: e.pointerId, moved: false }; c.setPointerCapture && c.setPointerCapture(e.pointerId);
  });
  body.addEventListener('pointermove', e => { if(!drag || e.pointerId !== drag.id) return; const s = stage.getBoundingClientRect(); drag.x = e.clientX - s.left; drag.y = e.clientY - s.top; if(!drag.moved){ drag.moved = true; sel = drag.core; emit('wireStart', sel); markAllowed(sel); } e.preventDefault(); schedule(); });
  body.addEventListener('pointerup', e => { if(!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; clearAllowed(); if(!d.moved){ schedule(); return; } const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest('[data-terminal]'); if(t) drop(d.core, t.dataset.terminal); else { sel = null; render(); } });
  body.addEventListener('pointercancel', () => { drag = null; clearAllowed(); schedule(); });

  render();
  const api = {
    update(s){ st = s; render(); },
    help(coreId){
      const h = st && st.help;
      helpPair = coreId ? { core: coreId, terminal: (nl.targets.find(p => p.a === coreId || p.b === coreId) || {}).b } : h;
      if(helpPair){ emit('helpShow', helpPair.core, helpPair.terminal); say(h && h.text ? h.text : 'Zielklemme markiert.'); }
      render();
      const t = helpPair && body.querySelector('[data-terminal="' + CSS.escape(helpPair.terminal || helpPair.to || '') + '"]'); if(t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: o.reducedMotion ? 'auto' : 'smooth' });
    },
    on(ev, fn){ (handlers[ev] = handlers[ev] || []).push(fn); return api; },
    off(ev, fn){ handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); return api; },
    select(core){ sel = core || null; render(); },
    get selected(){ return sel; },
    destroy(){ if(ro) ro.disconnect(); root.removeEventListener('resize', schedule); container.innerHTML = ''; container.classList.remove('sw25', 'sw25-coloraid', 'sw25-reduced', 'sw25-touch', 'sw25-dragging'); Object.keys(handlers).forEach(k => delete handlers[k]); }
  };
  return api;
}

const STYLE = `
.sw25{ --sw-bg:#0f151c; --sw-panel:#151d26; --sw-line:#2a3a4c; --sw-txt:#e6eef6; --sw-dim:#9fb0c0; --sw-lp:#d64545; --sw-m:#3b7fd6; --sw-sig:#ffd21e; --sw-ok:#39ff7a; --sw-bad:#ff4d7d; --sw-acc:#39ff14; color:var(--sw-txt); font:14px/1.35 Inter,system-ui,sans-serif; min-width:0; }
.sw25 *{ box-sizing:border-box; }
.sw25-msg{ min-height:20px; margin:0 0 6px; font-size:13px; color:var(--sw-dim); }
.sw25-stage{ position:relative; }
.sw25-wires{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; } .sw25-over{ z-index:3; } .sw25-under{ z-index:0; }
.sw25-body{ position:relative; z-index:1; display:grid; grid-template-columns:minmax(240px,1.15fr) minmax(220px,1.35fr) minmax(170px,.9fr); gap:18px; align-items:start; }
.sw25-zone{ display:flex; flex-direction:column; gap:12px; min-width:0; }
/* Sensor mit Kabel */
.sw25-part{ background:var(--sw-panel); border:1px solid var(--sw-line); border-radius:12px; padding:10px; display:grid; grid-template-columns:84px 1fr; grid-template-areas:"sensor cable" "title title"; gap:6px 10px; box-shadow:0 6px 18px rgba(0,0,0,.35); }
.sw25-sensor{ grid-area:sensor; position:relative; } .sw25-shape{ width:84px; height:84px; display:block; }
.sw25-sensorled{ position:absolute; right:8px; top:6px; width:12px; height:12px; border-radius:50%; background:#4a4a30; border:1px solid #000; } .sw25-sensorled[data-lit="1"]{ background:var(--sw-sig); box-shadow:0 0 10px var(--sw-sig); }
.sw25-cable{ grid-area:cable; display:flex; align-items:stretch; gap:6px; min-width:0; }
.sw25-cabletrunk{ width:20px; border-radius:8px; background:linear-gradient(90deg,#1a1d22,#3a3f45 45%,#1a1d22); position:relative; flex:none; }
.sw25-cabletrunk .sw25-conn{ position:absolute; left:50%; top:4px; transform:translateX(-50%); font:700 9px ui-monospace,monospace; color:#9fb0c0; background:#0b0e12; padding:1px 3px; border-radius:3px; }
.sw25-cores{ display:flex; flex-direction:column; gap:6px; flex:1; min-width:0; }
.sw25-core{ display:flex; align-items:center; gap:6px; min-height:44px; padding:4px 8px; min-width:0; border-radius:22px; border:2px solid var(--sw-line); background:#0d1218; color:var(--sw-txt); font:inherit; cursor:grab; text-align:left; transition:transform .12s ease, box-shadow .12s ease; }
.sw25-core:active{ cursor:grabbing; } .sw25-core:hover{ box-shadow:0 0 0 2px rgba(255,255,255,.08); } .sw25-core:focus-visible, .sw25-term:focus-visible{ outline:3px solid #58c4ff; outline-offset:2px; }
.sw25-core.sel{ border-color:var(--sw-acc); box-shadow:0 0 14px rgba(57,255,20,.35); }
.sw25-core.r-ok{ border-color:var(--sw-ok); } .sw25-core.r-falsch{ border-color:var(--sw-bad); } .sw25-core.r-fehlt{ border-style:dashed; }
.sw25-chip{ width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,.5); flex:none; }
.sw25-pin{ font:700 14px ui-monospace,monospace; letter-spacing:.04em; } .sw25-core small{ color:var(--sw-dim); font-size:11px; line-height:1.15; flex:1; min-width:0; }
.sw25-sym{ font-size:16px; width:20px; text-align:center; flex:none; } .r-ok .sw25-sym{ color:var(--sw-ok); } .r-falsch .sw25-sym{ color:var(--sw-bad); } .r-fehlt .sw25-sym{ color:var(--sw-dim); }
.sw25-part h3{ grid-area:title; margin:2px 0 0; font-size:13px; font-weight:400; color:var(--sw-dim); } .sw25-part h3 b{ color:var(--sw-txt); font-size:14px; } .sw25-part h3 code{ color:#9fdcff; }
/* Klemmleisten */
.sw25-strip{ background:linear-gradient(180deg,#242a31,#1a1f26); border:1px solid var(--sw-line); border-radius:10px; padding:8px 10px 10px; box-shadow:0 6px 18px rgba(0,0,0,.35); }
.sw25-strip h4, .sw25-modhead{ margin:0 0 6px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--sw-dim); }
.sw25-levels{ display:grid; grid-template-columns:22px repeat(3,1fr); gap:4px; font-size:11px; color:var(--sw-dim); margin-bottom:2px; padding:0 3px; } .sw25-levels span{ text-align:center; }
.sw25-rows{ display:flex; flex-direction:column; gap:4px; }
.sw25-tgroup{ display:grid; grid-template-columns:22px repeat(3,1fr); gap:4px; align-items:stretch; padding:3px; border-radius:8px; background:#8f959c; }
.sw25-strip-X1 .sw25-tgroup, .sw25-strip-X3 .sw25-tgroup{ grid-template-columns:22px repeat(2,1fr); }
.sw25-tgroup.rel-ruhe{ opacity:.45; } .sw25-dragging .sw25-tgroup.rel-ruhe{ opacity:.7; }
.sw25-rowno{ align-self:center; text-align:center; font:700 12px ui-monospace,monospace; color:#111; }
.sw25-term{ position:relative; display:flex; align-items:center; gap:6px; min-height:44px; min-width:44px; padding:4px 6px 4px 22px; border-radius:6px; border:1px solid #5b6168; background:#c9ced4; color:#111; font:700 12px ui-monospace,monospace; cursor:pointer; transition:box-shadow .12s ease, transform .12s ease; }
.sw25-term .sw25-hole{ position:absolute; left:6px; top:50%; width:10px; height:12px; margin-top:-6px; border-radius:2px; background:#2b2f34; box-shadow:inset 0 0 0 2px #7d8790, inset 0 -3px 0 #d8b24a; }
.sw25-term[data-busy="1"] .sw25-hole, .sw25-term[data-busy="2"] .sw25-hole{ box-shadow:inset 0 0 0 2px #7d8790, inset 0 -3px 0 #d8b24a, 0 0 0 2px #444; background:#1a1d22; }
.sw25-term.lv-LP{ border-top:4px solid var(--sw-lp); } .sw25-term.lv-M{ border-top:4px solid var(--sw-m); } .sw25-term.lv-S{ border-top:4px solid #e8e2c6; background:#e2e5e9; }
.sw25-term.lv-a, .sw25-term.lv-b{ border-top:4px solid #8e44ad; }
.sw25-tl{ flex:1; } .sw25-addr{ font-weight:400; font-size:11px; color:#334; } .sw25-led{ font-size:14px; color:#7a6a20; } .sw25-term[data-lit="1"] .sw25-led{ color:#e0a800; text-shadow:0 0 8px var(--sw-sig); }
.sw25-term.allowed{ box-shadow:0 0 0 3px var(--sw-acc), 0 0 14px rgba(57,255,20,.5); } .sw25-term.dim{ opacity:.35; } .sw25-term.over{ transform:scale(1.06); }
.sw25-term.rel-ziel{ } .sw25-term:hover{ box-shadow:0 0 0 2px #58c4ff; }
/* Baugruppen */
.sw25-module{ background:linear-gradient(180deg,#e9ecef,#cfd4d9); color:#111; border:1px solid #9aa3ab; border-radius:8px; padding:8px 10px 10px; box-shadow:0 6px 18px rgba(0,0,0,.35); }
.sw25-modhead{ color:#223; display:flex; align-items:center; gap:6px; text-transform:none; letter-spacing:0; font-size:12px; } .sw25-modhead b{ font-size:13px; }
.sw25-modleds{ margin-left:auto; display:flex; gap:4px; } .sw25-modleds i{ width:8px; height:8px; border-radius:50%; background:#8a9098; display:inline-block; } .sw25-modleds i.on{ background:#39b54a; box-shadow:0 0 6px #39b54a; }
.sw25-mgroup{ margin-top:6px; } .sw25-gname{ font:700 11px ui-monospace,monospace; color:#334; display:block; margin-bottom:2px; }
.sw25-mrow{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; padding:4px; border-radius:6px; background:#8f959c; }
.sw25-module.rel-ruhe{ opacity:.55; } .sw25-dragging .sw25-module.rel-ruhe{ opacity:.85; }
.sw25-module .sw25-term{ min-width:0; padding-right:4px; }
.sw25-more{ margin-top:6px; } .sw25-more summary{ cursor:pointer; font-size:12px; color:var(--sw-dim); padding:6px 4px; min-height:32px; } .sw25-more[open] summary{ margin-bottom:4px; }
/* Kabel */
.sw25-shadow{ fill:none; stroke:#000; stroke-width:9; stroke-opacity:.45; stroke-linecap:round; transform:translate(2px,4px); }
.sw25-wire{ fill:none; stroke-width:5; stroke-linecap:round; } .sw25-wire.r-falsch{ filter:drop-shadow(0 0 4px var(--sw-bad)); } .sw25-wire.r-ok{ filter:drop-shadow(0 0 3px rgba(57,255,122,.5)); }
.sw25-preview{ stroke-dasharray:8 6; opacity:.85; }
.sw25-link{ fill:none; stroke:#1f3a93; stroke-width:4; stroke-linecap:round; opacity:.75; }
.sw25-wlabel{ font:700 11px ui-monospace,monospace; fill:#fff; paint-order:stroke; stroke:#000; stroke-width:3px; }
.sw25-mark circle{ fill:#0d1218; stroke-width:2; } .sw25-mark text{ font:700 12px ui-monospace,monospace; } .sw25-mark.r-ok circle{ stroke:var(--sw-ok); } .sw25-mark.r-ok text{ fill:var(--sw-ok); } .sw25-mark.r-falsch circle{ stroke:var(--sw-bad); } .sw25-mark.r-falsch text{ fill:var(--sw-bad); }
/* Zeig mir */
.sw25 .pulse{ animation:sw25pulse 1.1s ease-in-out infinite; box-shadow:0 0 0 3px var(--sw-sig), 0 0 18px var(--sw-sig); z-index:2; }
@keyframes sw25pulse{ 0%,100%{ box-shadow:0 0 0 3px var(--sw-sig), 0 0 10px var(--sw-sig); } 50%{ box-shadow:0 0 0 6px var(--sw-sig), 0 0 26px var(--sw-sig); } }
.sw25-reduced .pulse, .sw25-reduced .sw25-core, .sw25-reduced .sw25-term{ animation:none !important; transition:none !important; }
@media (prefers-reduced-motion: reduce){ .sw25 .pulse{ animation:none; } }
/* Farbsehhilfe: Ebenen zusätzlich beschriftet, Chips mit Muster */
.sw25-coloraid .sw25-term.lv-LP::after{ content:"+"; position:absolute; right:4px; top:0; font-size:11px; color:var(--sw-lp); } .sw25-coloraid .sw25-term.lv-M::after{ content:"−"; position:absolute; right:4px; top:0; font-size:11px; color:var(--sw-m); }
.sw25-coloraid .sw25-core[data-pin="BU"] .sw25-chip{ background-image:repeating-linear-gradient(45deg,transparent 0 3px,rgba(255,255,255,.7) 3px 5px); } .sw25-coloraid .sw25-core[data-pin="BK"] .sw25-chip{ background-image:radial-gradient(circle,rgba(255,255,255,.8) 2px,transparent 2.5px); }
/* Handy */
@media (max-width:760px){ .sw25-body{ grid-template-columns:1fr; gap:12px; } .sw25-part{ grid-template-columns:72px 1fr; } .sw25-shape{ width:72px; height:72px; } .sw25-term{ min-height:44px; } }
`;
function injectCss(){ if(typeof document === 'undefined' || document.getElementById('sw25Css')) return; const s = document.createElement('style'); s.id = 'sw25Css'; s.textContent = STYLE; document.head.appendChild(s); }
root.SensorWiring25D = { mount, CSS: STYLE, version: 1 };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorWiring25D;
})(typeof window !== 'undefined' ? window : globalThis);
