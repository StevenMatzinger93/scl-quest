(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — 2D-Klemmleiste (Rückfall zur 3D-Werkstatt, gleichwertig bedienbar)
   Antippen-Antippen: Ader/Anschluss antippen, dann Klemmstelle antippen → aufgelegt.
   Tastatur: Tab/Pfeile wandern über die Klemmstellen, Enter wählt bzw. legt auf, Entf löst die gewählte Ader, Esc bricht ab.
   Trefferflächen ≥ 44 px auf Touch. Aderfarben immer zusätzlich beschriftet (BN/BU/BK/WH).
   API: Wiring2D.mount(host, { state, parts:['B1',…], modules:['A1','A2','A4'], x2:[1,2,…], world, onChange, onMessage })
        → { refresh(), select(node), place(node), undo(), redo(), state }
   ============================================================ */
const W = root.Wiring;
const COLOR = { BN: '#8b5a2b', BU: '#2f6fd0', BK: '#222', WH: '#e8e8e8', '+': '#c0392b', '-': '#2f6fd0', 'L+': '#c0392b', M: '#2f6fd0', 'I+': '#8e44ad', 'I-': '#6c5ce7' };
const CAB = '#1f3a93';   // dunkelblau: DC-Steuerstromkreis im Schrank
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// eindeutige Element-ID je Klemmstelle (+ und − müssen unterscheidbar bleiben)
const nid = n => 'w2d_' + n.replace(/\+/g, 'P').replace(/-/g, 'N').replace(/[^A-Za-z0-9]/g, '_');
function pinColor(node){ const pin = node.split(':')[1]; return COLOR[pin] || CAB; }
const MODULE_TERMS = {
  A1: ['A1:L+', 'A1:M', 'A1:1M'].concat([0, 1, 2, 3, 4, 5, 6, 7].map(b => 'A1:DIa.' + b), [0, 1, 2, 3, 4, 5].map(b => 'A1:DIb.' + b), ['A1:2M', 'A1:AI0', 'A1:AI1']),
  A2: ['A2:L+', 'A2:M'].concat([0, 1, 2, 3].reduce((a, c) => a.concat(['A2:' + c + '+', 'A2:' + c + '-']), [])),
  A3: ['A3:L+', 'A3:M', 'A3:0', 'A3:0M', 'A3:1', 'A3:1M'],
  A4: ['A4:1M', 'A4:2M'].concat([0, 1, 2, 3, 4, 5, 6, 7].map(b => 'A4:.' + b))
};
const MODULE_NAME = { A1: '-A1 CPU 1214C DC/DC/DC', A2: '-A2 SM 1231 AI 4', A3: '-A3 SM 1232 AQ 2', A4: '-A4 SM 1221 DI 8' };
const label = n => n.split(':')[1];

function mount(host, opt){
  opt = opt || {};
  const st = opt.state || W.newState();
  const parts = opt.parts || ['B1'], mods = opt.modules || ['A1'], x2 = opt.x2 || [1, 2, 3, 4, 5, 6, 7, 8], x3 = opt.x3 || 0;
  let sel = null, undo = [], redo = [], ferrule = st.level === 'schnell' ? true : opt.ferrule !== false;
  const msg = (text, kind) => { const m = host.querySelector('.w2d-msg'); if(m){ m.textContent = text || ''; m.className = 'w2d-msg' + (kind ? ' ' + kind : ''); } if(opt.onMessage) opt.onMessage(text, kind); };
  const snapshot = () => JSON.stringify({ wires: st.wires, bridges: st.bridges, knives: st.knives, mainSwitch: st.mainSwitch });
  const push = () => { undo.push(snapshot()); if(undo.length > 100) undo.shift(); redo = []; };
  const restore = s => { const o = JSON.parse(s); Object.assign(st, o); };
  const changed = () => { render(); if(opt.onChange) opt.onChange(st); };

  host.classList.add('w2d');
  host.innerHTML = '<div class="w2d-bar" role="toolbar" aria-label="Werkzeuge Verdrahtung">'
    + '<button type="button" class="w2d-btn" data-a="main" aria-pressed="false">-Q0 Hauptschalter</button>'
    + '<button type="button" class="w2d-btn" data-a="QB_X2_LP" aria-pressed="false">Querbrücker L+</button>'
    + '<button type="button" class="w2d-btn" data-a="QB_X2_M" aria-pressed="false">Querbrücker M</button>'
    + '<button type="button" class="w2d-btn" data-a="ferrule" aria-pressed="true">Aderendhülse</button>'
    + '<button type="button" class="w2d-btn" data-a="undo" title="Rückgängig (Strg+Z)">↶</button><button type="button" class="w2d-btn" data-a="redo" title="Wiederholen (Strg+Y)">↷</button>'
    + '<button type="button" class="w2d-btn" data-a="check">Sichtprüfung</button></div>'
    + '<div class="w2d-msg" role="status" aria-live="polite"></div>'
    + '<div class="w2d-board"><svg class="w2d-wires" aria-hidden="true"></svg>'
    + '<section class="w2d-col" aria-label="Feld: Sensoren und Geber">' + parts.map(p => partHTML(p)).join('') + '</section>'
    + '<section class="w2d-col" aria-label="Klemmleiste -X2 (Initiatorenklemmen)"><h4>-X2 Initiatorenklemmen</h4><div class="w2d-x2">' + x2.map(n => '<div class="w2d-x2row"><span class="w2d-tn">' + n + '</span>'
      + ['L+', 'S', 'M'].map(l => termBtn('X2:' + n + '.' + l, l === 'S' ? 'Signal' : l)).join('') + '<span class="w2d-led" data-led="' + n + '" title="LED Signal"></span></div>').join('') + '</div>'
      + (x3 ? '<h4>-X3 Trennklemmen</h4><div class="w2d-x3">' + Array.from({ length: x3 }, (_, i) => i + 1).map(n => '<div class="w2d-x2row"><span class="w2d-tn">' + n + '</span>' + termBtn('X3:' + n + '.a', 'Feld') + '<button type="button" class="w2d-knife" data-knife="X3:' + n + '" aria-pressed="false" title="Trennmesser">⎍</button>' + termBtn('X3:' + n + '.b', 'SPS') + '</div>').join('') + '</div>' : '')
      + '</section>'
    + '<section class="w2d-col" aria-label="Verteiler -X1"><h4>-X1 Versorgung</h4><div class="w2d-x1">' + [1, 2, 3, 4, 5, 6, 7, 8].map(i => termBtn('X1:L+' + i, 'L+' + i, 'lp') + termBtn('X1:M' + i, 'M' + i, 'm')).join('') + '</div></section>'
    + '<section class="w2d-col" aria-label="Steuerung">' + mods.map(m => '<h4>' + esc(MODULE_NAME[m]) + '</h4><div class="w2d-mod">' + MODULE_TERMS[m].map(t => termBtn(t, label(t))).join('') + '</div>').join('') + '</section>'
    + '</div>';
  function partHTML(p){
    const P = W.PARTS[p];
    return '<div class="w2d-part"><div class="w2d-pname"><b>-' + esc(p) + '</b> <span>' + esc(P.name) + '</span></div><div class="w2d-pins">'
      + P.pins.map(pin => '<button type="button" class="w2d-t w2d-pin" id="' + nid(p + ':' + pin) + '" data-n="' + esc(p + ':' + pin) + '" style="--c:' + (COLOR[pin] || '#999') + '" aria-label="-' + esc(p) + ' Ader ' + esc(pin) + '"><i></i>' + esc(pin) + '</button>').join('')
      + '<button type="button" class="w2d-btn w2d-free" data-free="' + esc(p) + '" title="Alle Adern dieses Bauteils lösen">lösen</button></div></div>';
  }
  function termBtn(node, text, cls){ return '<button type="button" class="w2d-t' + (cls ? ' ' + cls : '') + '" id="' + nid(node) + '" data-n="' + esc(node) + '" aria-label="Klemmstelle ' + esc(node) + '">' + esc(text) + '</button>'; }

  function select(node){ sel = node; host.querySelectorAll('.w2d-t.sel').forEach(b => b.classList.remove('sel')); const b = host.querySelector('#' + nid(node)); if(b) b.classList.add('sel'); msg('Gewählt: ' + node + ' – jetzt die Klemmstelle antippen, auf die die Ader soll.'); }
  function place(node){
    if(!sel){ select(node); return; }
    if(sel === node){ sel = null; render(); msg(''); return; }
    const existing = st.wires.find(w => (w.from === sel && w.to === node) || (w.from === node && w.to === sel));
    push();
    if(existing){ W.removeWire(st, sel, node); msg('Ader gelöst: ' + sel + ' ↔ ' + node + '.'); }
    else {
      const r = W.addWire(st, sel, node, { ferrule });
      if(!r.ok){ undo.pop(); msg(r.error, 'err'); sel = null; render(); return; }
      msg(r.warnings.length ? r.warnings.join(' ') : 'Aufgelegt: ' + sel + ' → ' + node + '.', r.warnings.length ? 'warn' : 'ok');
    }
    sel = null; changed();
  }
  host.addEventListener('click', e => {
    const t = e.target.closest('[data-n]'); if(t && host.contains(t)){ if(intercept('node', t.dataset.n)) return; place(t.dataset.n); return; }
    const a = e.target.closest('[data-a]');
    if(a){
      const k = a.dataset.a;
      if(k === 'main'){ push(); st.mainSwitch = !st.mainSwitch; msg(st.mainSwitch ? '-Q0 eingeschaltet – die Anlage steht unter Spannung.' : '-Q0 ausgeschaltet – spannungsfrei.', st.mainSwitch ? 'warn' : 'ok'); changed(); }
      else if(k === 'QB_X2_LP' || k === 'QB_X2_M'){ push(); const i = st.bridges.indexOf(k); if(i >= 0) st.bridges.splice(i, 1); else st.bridges.push(k); msg(W.BRIDGES[k].name + (i >= 0 ? ' entfernt.' : ' gesteckt.')); changed(); }
      else if(k === 'ferrule'){ if(st.level === 'schnell'){ msg('Realitätsstufe „Schnell“: Aderendhülsen werden automatisch gesetzt.'); return; } ferrule = !ferrule; render(); msg(ferrule ? 'Neue Adern bekommen eine Aderendhülse.' : 'Neue Adern ohne Aderendhülse (feindrähtig!).', ferrule ? 'ok' : 'warn'); }
      else if(k === 'undo') doUndo();
      else if(k === 'redo') doRedo();
      else if(k === 'check'){ const open = W.visualCheck(st, parts); msg(open.length ? 'Sichtprüfung: offene Adern ' + open.join(', ') + '.' : 'Sichtprüfung: alle Adern aufgelegt.', open.length ? 'warn' : 'ok'); }
      return;
    }
    const kn = e.target.closest('[data-knife]'); if(kn){ if(intercept('knife', kn.dataset.knife)) return; push(); st.knives = st.knives || {}; st.knives[kn.dataset.knife] = !st.knives[kn.dataset.knife]; msg('Trennmesser ' + kn.dataset.knife + (st.knives[kn.dataset.knife] ? ' offen – Schleife unterbrochen.' : ' geschlossen.')); changed(); return; }
    const fr = e.target.closest('[data-free]'); if(fr){ push(); const n = W.removePart(st, fr.dataset.free); msg(n + ' Ader(n) von -' + fr.dataset.free + ' gelöst.'); changed(); }
  });
  // Werkzeuge der Werkstatt (Multimeter, Crimpzange, Schraubendreher) können Klicks übernehmen: true = erledigt, Text = gesperrt mit Meldung
  function intercept(kind, key){ if(!opt.intercept) return false; const r = opt.intercept(kind, key); if(typeof r === 'string'){ msg(r, 'warn'); return true; } if(r){ render(); return true; } return false; }
  function doUndo(){ if(!undo.length) return; redo.push(snapshot()); restore(undo.pop()); msg('Rückgängig gemacht.'); changed(); }
  function doRedo(){ if(!redo.length) return; undo.push(snapshot()); restore(redo.pop()); msg('Wiederholt.'); changed(); }
  host.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ sel = null; render(); msg('Abgebrochen.'); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); doUndo(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){ e.preventDefault(); doRedo(); return; }
    const t = e.target.closest && e.target.closest('.w2d-t');
    if(t && (e.key === 'Delete' || e.key === 'Backspace')){ e.preventDefault(); push(); const n = t.dataset.n; const before = st.wires.length; st.wires = st.wires.filter(w => w.from !== n && w.to !== n); msg((before - st.wires.length) + ' Ader(n) an ' + n + ' gelöst.'); changed(); return; }
    if(t && /^Arrow/.test(e.key)){
      e.preventDefault();
      const all = [...host.querySelectorAll('.w2d-t')], i = all.indexOf(t);
      const nx = all[e.key === 'ArrowDown' || e.key === 'ArrowRight' ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1)];
      if(nx) nx.focus();
    }
  });
  function render(){
    host.querySelector('[data-a="main"]').setAttribute('aria-pressed', String(!!st.mainSwitch));
    host.querySelector('[data-a="main"]').classList.toggle('on', !!st.mainSwitch);
    ['QB_X2_LP', 'QB_X2_M'].forEach(k => { const b = host.querySelector('[data-a="' + k + '"]'); b.setAttribute('aria-pressed', String(st.bridges.includes(k))); b.classList.toggle('on', st.bridges.includes(k)); });
    const fb = host.querySelector('[data-a="ferrule"]'); fb.setAttribute('aria-pressed', String(ferrule)); fb.classList.toggle('on', ferrule);
    host.querySelectorAll('[data-knife]').forEach(k => { const o = !!(st.knives || {})[k.dataset.knife]; k.setAttribute('aria-pressed', String(o)); k.classList.toggle('open', o); });
    const used = new Set(); st.wires.forEach(w => { used.add(w.from); used.add(w.to); });
    const probes = opt.probes ? opt.probes() : {};
    host.querySelectorAll('.w2d-t').forEach(b => { b.classList.toggle('used', used.has(b.dataset.n)); b.classList.toggle('sel', b.dataset.n === sel); b.classList.toggle('probe-r', probes.red === b.dataset.n); b.classList.toggle('probe-b', probes.black === b.dataset.n); });
    // LEDs der Initiatorenklemmen: Signal liegt auf L+-Potential
    const N = W.nets(st), ev = W.evaluate(st, opt.world ? opt.world() : {});
    const on = !!st.mainSwitch && ev.supply.dcOk;
    host.querySelectorAll('[data-led]').forEach(l => { const node = 'X2:' + l.dataset.led + '.S', lit = on && ((N.isLP(node) && !N.isM(node)) || (ev.hot || []).some(h => N.same(h, node))); l.classList.toggle('on', lit); l.title = 'LED Signal ' + (lit ? 'an' : 'aus'); });
    drawWires();
    host._eval = ev;
  }
  function drawWires(){
    const svg = host.querySelector('.w2d-wires'), board = host.querySelector('.w2d-board');
    const br = board.getBoundingClientRect();
    svg.setAttribute('width', board.scrollWidth); svg.setAttribute('height', board.scrollHeight);
    const c = n => { const b = host.querySelector('#' + nid(n)); if(!b) return null; const r = b.getBoundingClientRect(); return [r.left - br.left + r.width / 2 + board.scrollLeft, r.top - br.top + r.height / 2 + board.scrollTop]; };
    svg.innerHTML = st.wires.map(w => {
      const a = c(w.from), b = c(w.to); if(!a || !b) return '';
      const col = W.PARTS[w.from.split(':')[0]] ? pinColor(w.from) : W.PARTS[w.to.split(':')[0]] ? pinColor(w.to) : CAB;
      const mx = (a[0] + b[0]) / 2;
      return '<path d="M' + a[0] + ' ' + a[1] + ' C' + mx + ' ' + a[1] + ' ' + mx + ' ' + b[1] + ' ' + b[0] + ' ' + b[1] + '" stroke="' + col + '" stroke-width="3" fill="none" stroke-linecap="round"' + (w.ferrule ? '' : ' stroke-dasharray="6 4"') + '/>';
    }).join('');
  }
  addEventListener('resize', () => drawWires());
  render();
  return { refresh: render, select, place, undo: doUndo, redo: doRedo, message: msg, push, get state(){ return st; }, get evaluation(){ return host._eval; } };
}
const CSS = `
.w2d{ --w2d-bg:#10161d; --w2d-line:#2a3a4c; color:#dbe7f3; font:14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif; }
.w2d-bar{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
.w2d-btn{ min-height:36px; padding:6px 10px; border-radius:8px; border:1px solid var(--w2d-line); background:#16202b; color:inherit; cursor:pointer; font:inherit; }
.w2d-btn.on{ border-color:#39ff7a; color:#39ff7a; }
.w2d-btn[data-a="main"].on{ border-color:#ff5a36; color:#ff8a6a; }
.w2d-msg{ min-height:20px; font-size:13px; color:#9fb0c0; margin-bottom:6px; }
.w2d-msg.ok{ color:#7fe3a0; } .w2d-msg.warn{ color:#ffd166; } .w2d-msg.err{ color:#ff8f8f; }
.w2d-board{ position:relative; display:grid; grid-template-columns:repeat(4, minmax(150px, 1fr)); gap:18px; background:var(--w2d-bg); border:1px solid var(--w2d-line); border-radius:10px; padding:12px; overflow:auto; }
.w2d-wires{ position:absolute; left:0; top:0; pointer-events:none; z-index:2; }
.w2d-col{ display:flex; flex-direction:column; gap:10px; min-width:0; }
.w2d-col h4{ margin:4px 0 2px; font:600 12px ui-monospace,monospace; color:#8aa0b4; letter-spacing:.06em; }
.w2d-part{ border:1px solid var(--w2d-line); border-radius:8px; padding:8px; background:#0c1218; }
.w2d-pname span{ display:block; font-size:12px; color:#8aa0b4; }
.w2d-pins{ display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; align-items:center; }
.w2d-t{ position:relative; z-index:3; min-width:44px; min-height:44px; padding:4px 6px; border-radius:8px; border:2px solid #3a4c60; background:#1a2430; color:#e6eef6; font:600 12px ui-monospace,monospace; cursor:pointer; }
.w2d-t:focus-visible{ outline:3px solid #58c4ff; outline-offset:2px; }
.w2d-t.used{ border-color:#58c4ff; }
.w2d-t.sel{ background:#12324a; border-color:#ffd166; box-shadow:0 0 0 3px rgba(255,209,102,.35); }
.w2d-t.probe-r{ box-shadow:0 0 0 3px #ff3b30; } .w2d-t.probe-b{ box-shadow:0 0 0 3px #111, 0 0 0 5px #bbb; }
.w2d-t.lp{ color:#ff9a8a; } .w2d-t.m{ color:#8ab4ff; }
.w2d-pin i{ display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--c); border:1px solid #888; margin-right:4px; vertical-align:-1px; }
.w2d-free{ min-height:30px; padding:2px 8px; font-size:12px; margin-left:auto; }
.w2d-x2, .w2d-x3{ display:flex; flex-direction:column; gap:4px; }
.w2d-x2row{ display:flex; align-items:center; gap:4px; }
.w2d-tn{ width:22px; text-align:right; font:600 12px ui-monospace,monospace; color:#8aa0b4; }
.w2d-led{ width:12px; height:12px; border-radius:50%; background:#3a3320; border:1px solid #6a5a2a; }
.w2d-led.on{ background:#ffd21e; box-shadow:0 0 8px #ffd21e; }
.w2d-knife{ min-width:36px; min-height:44px; border-radius:6px; border:1px solid var(--w2d-line); background:#1a2430; color:#ffd166; cursor:pointer; }
.w2d-knife.open{ color:#ff8f8f; transform:rotate(30deg); }
.w2d-x1, .w2d-mod{ display:grid; grid-template-columns:repeat(2, minmax(44px, 1fr)); gap:4px; }
@media (max-width:700px){ .w2d-board{ grid-template-columns:repeat(4, 160px); } }
`;
function injectCss(){ if(typeof document === 'undefined' || document.getElementById('w2dCss')) return; const s = document.createElement('style'); s.id = 'w2dCss'; s.textContent = CSS; document.head.appendChild(s); }
root.Wiring2D = { mount: (h, o) => { injectCss(); return mount(h, o); }, CSS, MODULES: Object.keys(MODULE_TERMS) };
})(typeof window !== 'undefined' ? window : globalThis);
