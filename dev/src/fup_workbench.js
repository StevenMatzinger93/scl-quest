(function(root){
"use strict";
/* ============================================================
   FUP-Werkbank · Editor (FUPWorkbench) – Funktionsplan wie im TIA Portal
   ------------------------------------------------------------
   Arbeitet auf dem Graphen aus fup_graph.js und speichert das Textformat
   von kop.js (unverändert). Zeichnung als SVG, Bedienung mit Pointer Events
   (Maus, Stift, Touch).

   FUPWorkbench.create(host, opts) → api
     opts: { tags: PLC_TAGS, onChange(text), title, readOnly }
   api: getValue, setValue, setErrorMark, setErrorLine, showFlow(env), clearFlow,
        insertAtCursor(name), setSymbols(list), setReadOnly(ro), mode, check(), graph(),
        bindVarDrag(container)   (Elemente mit data-var lassen sich auf Eingänge ziehen)
   FUPWorkbench.attach(textEditor, opts) – gleiche Schnittstelle wie KOPEditor.attach
   ============================================================ */
const G = root.FUPGraph, K = root.KOP;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const PH = '<??.?>';
const LITRE = /^(TRUE|FALSE|-?\d[\d_]*(\.\d+)?([eE][-+]?\d+)?|T(IME)?#\S*|16#[0-9A-F_]+)$/i;
const { GRID, PIN, HEAD, TOPH, OPW } = G;
const snap = v => Math.round(v / GRID) * GRID;

// Favoriten wie im Video: &  >=1  ??  -|  -o|  ↦  -[=]
const FAV = [
  ['and', '&', 'UND-Box (&)'], ['or', '>=1', 'ODER-Box (>=1)'], ['empty', '??', 'Leere Box – Typ eintippen'],
  ['tool:open', '-|', 'Eingang hinzufügen (auf eine Box oder einen Eingang)'], ['tool:neg', '-o|', 'Negieren (auf einen Eingang oder Ausgang)'],
  ['tool:branch', '↦', 'Abzweig (auf einen Ausgang oder eine Linie)'], ['assign', '-[=]', 'Zuweisung']
];
const LIB = [
  ['Bitverknüpfungen', [['and', '&'], ['or', '>=1'], ['xor', 'X'], ['assign', '='], ['set', 'S'], ['reset', 'R'], ['sr', 'SR'], ['rs', 'RS'], ['edgeP', 'P'], ['edgeN', 'N'], ['empty', '??']]],
  ['Zeiten', [['ton', 'TON'], ['tof', 'TOF'], ['tp', 'TP']]],
  ['Zähler', [['ctu', 'CTU'], ['ctd', 'CTD']]],
  ['Vergleicher', [['cmp:==', 'CMP =='], ['cmp:<>', 'CMP <>'], ['cmp:>', 'CMP >'], ['cmp:>=', 'CMP >='], ['cmp:<', 'CMP <'], ['cmp:<=', 'CMP <=']]],
  ['Übertragen', [['move', 'MOVE']]],
  ['Mathematik', [['calc:ADD', 'ADD'], ['calc:SUB', 'SUB'], ['calc:MUL', 'MUL'], ['calc:DIV', 'DIV'], ['calc:INC', 'INC'], ['calc:DEC', 'DEC'], ['calc:NORM_X', 'NORM_X'], ['calc:SCALE_X', 'SCALE_X']]]
];
function parseSpec(spec){
  if(/^tool:/.test(spec)) return { tool: spec.slice(5) };
  const [t, a] = spec.split(':');
  return t === 'cmp' ? { t, o: { cmp: a } } : t === 'calc' ? { t, o: { calc: a } } : { t, o: {} };
}
const specLabel = spec => { const f = FAV.find(x => x[0] === spec); if(f) return f[1]; for(const [, items] of LIB){ const i = items.find(x => x[0] === spec); if(i) return i[1]; } return spec; };

function create(host, opts){
  opts = opts || {};
  const tags = opts.tags || {};
  const tagNames = Object.keys(tags);
  let prog = { seq: 0, networks: [G.emptyNet('')] }, frame = null, rawErr = null, rawText = '';
  let sel = { net: 0, nodes: new Set(), wire: null }, armed = null, pend = null, zoom = 1, flow = null, readOnly = !!opts.readOnly;
  let errMark = null, symbols = [], hist = [], fut = [], clip = null, lastCheck = { items: [] }, status = { msg: '', cls: '' };

  const rootEl = document.createElement('div');
  rootEl.className = 'fwb' + (readOnly ? ' fwb-ro' : '');
  rootEl.setAttribute('role', 'application'); rootEl.tabIndex = -1;
  rootEl.setAttribute('aria-label', 'FUP-Editor (Funktionsplan)');
  rootEl.innerHTML = '<div class="fwb-bar" role="toolbar" aria-label="Favoriten und Werkzeuge"></div>' +
    '<div class="fwb-main"><div class="fwb-nets"></div><aside class="fwb-lib" aria-label="Anweisungen" hidden></aside></div>' +
    '<div class="fwb-status" role="status" aria-live="polite"></div>';
  host.appendChild(rootEl);
  const bar = rootEl.querySelector('.fwb-bar'), netsEl = rootEl.querySelector('.fwb-nets'), libEl = rootEl.querySelector('.fwb-lib'), statusEl = rootEl.querySelector('.fwb-status');

  /* ---------- Leiste und Bibliothek ---------- */
  const palBtn = (spec, label, title, cls) => '<button type="button" class="fwb-b ' + (cls || '') + '" data-pal="' + esc(spec) + '" title="' + esc(title || label) + '" aria-label="' + esc(title || label) + '">' + esc(label) + '</button>';
  function renderBar(){
    bar.innerHTML = FAV.map(f => palBtn(f[0], f[1], f[2], 'fwb-fav')).join('') +
      '<span class="fwb-sep"></span>' +
      '<button type="button" class="fwb-b" data-act="lib" aria-expanded="false" title="Anweisungen (Bibliothek)">☰ <span class="fwb-txt">Anweisungen</span></button>' +
      '<button type="button" class="fwb-b" data-act="cleanup" title="Aufräumen (automatisch anordnen)">⇶ <span class="fwb-txt">Aufräumen</span></button>';
    libEl.innerHTML = LIB.map(([h, items]) => '<h4>' + esc(h) + '</h4><div class="fwb-libgrid">' + items.map(i => palBtn(i[0], i[1], G.NAME[parseSpec(i[0]).t] ? G.NAME[parseSpec(i[0]).t] + (i[0].includes(':') ? ' ' + i[1] : '') : i[1])).join('') + '</div>').join('');
    updateArmed();
  }
  function updateArmed(){
    rootEl.querySelectorAll('[data-pal]').forEach(b => { const on = armed === b.dataset.pal; b.classList.toggle('fwb-armed', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function setStatus(msg, cls){ status = { msg: msg || '', cls: cls || '' }; statusEl.textContent = status.msg; statusEl.className = 'fwb-status' + (status.cls ? ' fwb-' + status.cls : ''); }

  /* ---------- Hilfen ---------- */
  const N = ni => prog.networks[ni];
  const nodeOf = (ni, id) => N(ni) && N(ni).nodes.find(n => n.id === id);
  const tagOf = v => { if(!v) return null; const b = G.baseName(v); const k = tagNames.find(x => x.toLowerCase() === b.toLowerCase()); return k ? Object.assign({ name: k }, tags[k]) : null; };
  const isLit = v => LITRE.test(String(v));
  function opInfo(v){
    if(v === null || v === undefined) return { kind:'none' };
    if(v === '?' || v === '') return { kind:'ph' };
    if(isLit(v)) return { kind:'lit', v };
    if(/^#/.test(v)) return { kind:'local', v, known: !symbols.length || symbols.some(s => s.toLowerCase() === String(v).toLowerCase()) };
    const t = tagOf(v);
    if(t && G.baseName(v) === v) return { kind:'tag', v, t };
    if(t) return { kind:'tag', v, t, member: true };
    const inst = prog.networks.some(n => n.nodes.some(x => x.inst && G.baseName(x.inst).toLowerCase() === G.baseName(v).toLowerCase()));
    if(inst) return { kind:'local', v, known: true };
    return { kind: tagNames.length ? 'bad' : 'local', v, known: !tagNames.length };
  }

  /* ---------- Zeichnen ---------- */
  function opText(v, x, y, anchor){
    const o = opInfo(v), a = ' text-anchor="' + anchor + '"';
    if(o.kind === 'none') return '<text class="op-none" x="' + x + '" y="' + (y + 4) + '"' + a + '>…</text>';
    if(o.kind === 'ph') return '<text class="op-ph" x="' + x + '" y="' + (y + 4) + '"' + a + '>' + esc(PH) + '</text>';
    if(o.kind === 'tag') return '<text class="op-addr" x="' + x + '" y="' + (y - 3) + '"' + a + '>' + esc(o.member ? '' : o.t.addr) + '</text><text class="op-sym" x="' + x + '" y="' + (y + 10) + '"' + a + '>' + esc(o.member ? v : '"' + o.t.name + '"') + '</text>';
    if(o.kind === 'bad') return '<text class="op-bad" x="' + x + '" y="' + (y + 4) + '"' + a + '>' + esc(v) + '</text>';
    if(o.kind === 'lit') return '<text class="op-lit" x="' + x + '" y="' + (y + 4) + '"' + a + '>' + esc(v) + '</text>';
    return '<text class="op-sym' + (o.known ? '' : ' op-bad') + '" x="' + x + '" y="' + (y + 4) + '"' + a + '>' + esc(v) + '</text>';
  }
  function slotLabel(n, slot){
    const nm = nodeTitle(n);
    if(slot === 'top') return (G.TIMERS[n.t] || G.COUNTERS[n.t] ? 'Instanz' : n.t === 'call' ? 'Baustein' : 'Operand') + ' von ' + nm;
    const [k, i] = slot.split(':');
    const p = k === 'in' ? n.ins[+i] : n.outs[+i];
    return (k === 'in' ? 'Eingang ' : 'Ausgang ') + p.n + ' von ' + nm;
  }
  function slotValue(n, slot){ if(slot === 'top') return G.TIMERS[n.t] || G.COUNTERS[n.t] ? n.inst : n.t === 'call' ? n.target : n.opnd; const [k, i] = slot.split(':'); return (k === 'in' ? n.ins[+i] : n.outs[+i]).op; }
  function slotAria(n, slot){
    const v = slotValue(n, slot), o = opInfo(v);
    return slotLabel(n, slot) + ': ' + (o.kind === 'ph' ? PH + ' (Operand fehlt)' : o.kind === 'none' ? 'nicht belegt' : o.kind === 'tag' ? v + ' (' + o.t.addr + ', ' + o.t.type + ')' : o.kind === 'bad' ? v + ' – nicht in der PLC-Variablentabelle' : v);
  }
  function nodeTitle(n){
    if(n.t === 'cmp') return 'CMP ' + n.cmp;
    if(n.t === 'calc') return n.calc;
    if(n.t === 'call') return String(n.target || '?');
    return G.LABEL[n.t];
  }
  function drawNode(n, ni, vals, errs){
    const { w, h } = G.size(n), x = n.x, y = n.y, out = [];
    const cls = ['fwb-node'];
    if(sel.net === ni && sel.nodes.has(n.id)) cls.push('fwb-sel');
    if(errs.has(n.id)) cls.push('fwb-errn');
    if(vals && vals.nodes[n.id] === true) cls.push('fwb-on');
    const pinsTxt = n.ins.length + ' Eingänge';
    out.push('<g class="' + cls.join(' ') + '" data-net="' + ni + '" data-node="' + n.id + '" tabindex="0" role="group" data-fk="n:' + ni + ':' + n.id + '" aria-label="' + esc(G.NAME[n.t] + ' ' + nodeTitle(n) + ', ' + pinsTxt + (errs.has(n.id) ? ', fehlerhaft' : '')) + '">');
    out.push('<rect class="n-box" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2"/>');
    out.push('<rect class="n-head" x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (w - 2) + '" height="' + (HEAD - 4) + '"/>');
    const title = nodeTitle(n);
    out.push('<text class="n-title" x="' + (x + w / 2) + '" y="' + (y + 16) + '" text-anchor="middle">' + esc(title.length > 18 ? title.slice(0, 17) + '…' : title) + '</text>');
    const named = !['and', 'or', 'xor', 'assign', 'set', 'reset', 'empty'].includes(n.t);
    // Eingänge
    n.ins.forEach((p, i) => {
      const pp = G.inPos(n, i), py = pp.y;
      const wired = (inWire[n.id] || {})[i];
      out.push('<line class="n-stub" x1="' + (x - 14) + '" y1="' + py + '" x2="' + (p.neg ? x - 9 : x) + '" y2="' + py + '"/>');
      if(p.neg) out.push('<circle class="n-neg" cx="' + (x - 4.5) + '" cy="' + py + '" r="4.5"/>');
      if(named) out.push('<text class="n-pinname" x="' + (x + 4) + '" y="' + (py + 3) + '">' + esc(p.n) + '</text>');
      if(!wired){
        const pv = vals ? vals.pins[n.id + ':' + i] : undefined;
        const on = pv === true ? ' op-on' : '';
        out.push('<g class="fwb-op' + on + '" data-net="' + ni + '" data-node="' + n.id + '" data-slot="in:' + i + '" data-fk="s:' + ni + ':' + n.id + ':in:' + i + '" tabindex="0" role="button" aria-label="' + esc(slotAria(n, 'in:' + i)) + '">' +
          '<rect class="op-hit" x="' + (x - OPW) + '" y="' + (py - 16) + '" width="' + (OPW - 16) + '" height="32" rx="3"/>' + opText(p.op, x - 18, py, 'end') + '</g>');
      }
      out.push('<rect class="pin-hit' + (pend && pend.net === ni && pend.node === n.id && pend.i === i ? ' fwb-pend' : '') + '" data-net="' + ni + '" data-node="' + n.id + '" data-pin="in:' + i + '" x="' + (x - 16) + '" y="' + (py - 16) + '" width="22" height="32"/>');
    });
    // Ausgang Q/OUT
    if(G.hasOut(n)){
      const op = G.outPos(n);
      out.push('<line class="n-stub" x1="' + (x + w) + '" y1="' + op.y + '" x2="' + (x + w + 14) + '" y2="' + op.y + '"/>');
      if(named) out.push('<text class="n-pinname" x="' + (x + w - 4) + '" y="' + (op.y + 3) + '" text-anchor="end">' + (n.t === 'cmp' || n.t === 'empty' || /^edge/.test(n.t) ? 'OUT' : 'Q') + '</text>');
      out.push('<rect class="pin-hit' + (pend && pend.net === ni && pend.node === n.id && pend.i === 'out' ? ' fwb-pend' : '') + '" data-net="' + ni + '" data-node="' + n.id + '" data-pin="out" x="' + (x + w - 6) + '" y="' + (op.y - 16) + '" width="22" height="32"/>');
    }
    // Wert-Ausgänge (MOVE OUT1, ADD OUT, Aufruf-Ausgänge)
    n.outs.forEach((p, i) => {
      const op = G.oPos(n, i);
      out.push('<line class="n-stub" x1="' + (x + w) + '" y1="' + op.y + '" x2="' + (x + w + 14) + '" y2="' + op.y + '"/>');
      out.push('<text class="n-pinname" x="' + (x + w - 4) + '" y="' + (op.y + 3) + '" text-anchor="end">' + esc(p.n) + '</text>');
      out.push('<g class="fwb-op" data-net="' + ni + '" data-node="' + n.id + '" data-slot="o:' + i + '" data-fk="s:' + ni + ':' + n.id + ':o:' + i + '" tabindex="0" role="button" aria-label="' + esc(slotAria(n, 'o:' + i)) + '">' +
        '<rect class="op-hit" x="' + (x + w + 16) + '" y="' + (op.y - 16) + '" width="' + (OPW - 16) + '" height="32" rx="3"/>' + opText(p.op, x + w + 18, op.y, 'start') + '</g>');
    });
    // Operand / Instanz über der Box
    if(G.hasTop(n)){
      const v = slotValue(n, 'top'), cx = x + w / 2;
      out.push('<g class="fwb-op" data-net="' + ni + '" data-node="' + n.id + '" data-slot="top" data-fk="s:' + ni + ':' + n.id + ':top" tabindex="0" role="button" aria-label="' + esc(slotAria(n, 'top')) + '">' +
        '<rect class="op-hit" x="' + (cx - 64) + '" y="' + (y - TOPH) + '" width="128" height="' + (TOPH - 2) + '" rx="3"/>' +
        (G.TIMERS[n.t] || G.COUNTERS[n.t] ? opText(v, cx, y - 14, 'middle').replace(/op-addr/, 'op-addr') : opText(v, cx, y - 14, 'middle')) + '</g>');
    }
    // Stern: Eingang hinzufügen
    if(['and', 'or', 'xor', 'empty'].includes(n.t) && !readOnly){
      const ly = G.inPos(n, n.ins.length - 1).y;
      out.push('<g class="fwb-starg" data-net="' + ni + '" data-node="' + n.id + '" data-star="1"><rect class="fwb-starhit" x="' + (x + 1) + '" y="' + (ly + 5) + '" width="24" height="22"/><text class="fwb-star" x="' + (x + 6) + '" y="' + (ly + 22) + '">*</text><title>Eingang hinzufügen</title></g>');
    }
    out.push('</g>');
    return out.join('');
  }
  let inWire = {};
  function wirePath(net, w){
    const s = net.nodes.find(n => n.id === w.s), d = net.nodes.find(n => n.id === w.d);
    if(!s || !d) return null;
    const a = G.outPos(s), b = G.inPos(d, w.p);
    const sx = a.x + 14, sy = a.y, dx = b.x - 14, dy = b.y, mx = sx + Math.max(4, Math.min(12, Math.floor((dx - sx) / 2)));
    if(dx >= mx) return { d: 'M' + sx + ' ' + sy + 'H' + mx + 'V' + dy + 'H' + dx, mx, sy };
    const yb = Math.max(s.y + G.size(s).h, d.y + G.size(d).h) + 12;
    return { d: 'M' + sx + ' ' + sy + 'H' + mx + 'V' + yb + 'H' + (dx - 12) + 'V' + dy + 'H' + dx, mx, sy };
  }
  function netSvg(net, ni){
    inWire = {}; net.wires.forEach(w => { (inWire[w.d] = inWire[w.d] || {})[w.p] = w; });
    const vals = flow ? flowVals(ni) : null;
    const errs = new Set(lastCheck.items.filter(x => x.net === ni && x.level === 'error').map(x => x.node));
    if(errMark && errMark.net === ni) errMark.nodes.forEach(id => errs.add(id));
    let maxX = 0, maxY = 0;
    net.nodes.forEach(n => { const s = G.size(n); maxX = Math.max(maxX, n.x + s.w + (n.outs.length ? OPW + 24 : 40)); maxY = Math.max(maxY, n.y + s.h); });
    const W = Math.max(720, maxX + 120), H = Math.max(net.nodes.length ? 120 : 96, maxY + 56);
    const parts = [];
    const srcCount = {}; net.wires.forEach(w => { srcCount[w.s] = (srcCount[w.s] || 0) + 1; });
    const dots = new Set();
    net.wires.forEach((w, wi) => {
      const p = wirePath(net, w); if(!p) return;
      const v = vals ? vals.nodes[w.s] : undefined;
      const fc = v === true ? ' on' : v === false ? ' off' : '';
      const isSel = sel.net === ni && sel.wire === wi;
      parts.push('<path class="w' + fc + (isSel ? ' fwb-sel' : '') + '" d="' + p.d + '"/>');
      parts.push('<path class="w-hit" data-net="' + ni + '" data-wire="' + wi + '" d="' + p.d + '"><title>Verbindung (antippen, dann Entf zum Löschen)</title></path>');
      if(srcCount[w.s] > 1 && !dots.has(w.s)){ dots.add(w.s); parts.push('<circle class="w-dot" cx="' + p.mx + '" cy="' + p.sy + '" r="3.2"/>'); }
    });
    net.nodes.forEach(n => parts.push(drawNode(n, ni, vals, errs)));
    if(!net.nodes.length) parts.push('<text x="24" y="52" fill="#7d8791" style="font-family:system-ui,sans-serif;font-size:13px">Box aus der Leiste hierher ziehen (oder antippen, dann hier tippen).</text>');
    return '<svg class="fwb-svg" data-net="' + ni + '" width="' + Math.round(W * zoom) + '" height="' + Math.round(H * zoom) + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Netzwerk ' + (ni + 1) + '">' + parts.join('') + '</svg>';
  }
  function netMsgs(ni){
    const items = lastCheck.items.filter(x => x.net === ni);
    const list = items.slice(0, 4).map(x => '<li class="fwb-' + (x.level === 'error' ? 'err' : 'warn') + '">' + esc(x.msg) + '</li>');
    if(items.length > 4) list.push('<li>… und ' + (items.length - 4) + ' weitere</li>');
    if(errMark && errMark.net === ni && errMark.msg) list.unshift('<li>' + esc(errMark.msg) + '</li>');
    return list.join('');
  }
  function render(){
    if(rawErr){
      netsEl.innerHTML = '<div class="fwb-errbox">Der Text lässt sich nicht als Funktionsplan darstellen: ' + esc(K.words ? K.words(rawErr.message) : rawErr.message) + '</div>';
      return;
    }
    const keep = keepView();
    lastCheck = G.check(prog, { tags: tagNames.length ? tags : null, locals: symbols.filter(s => /^#/.test(s)).map(s => s.slice(1)) });
    const title = opts.title ? '<div class="fwb-blocktitle">' + esc(opts.title) + '</div>' : '';
    netsEl.innerHTML = title + prog.networks.map((net, ni) => {
      const errs = lastCheck.items.filter(x => x.net === ni && x.level === 'error').length + (errMark && errMark.net === ni ? 1 : 0);
      return '<section class="fwb-net' + (net.collapsed ? ' fwb-collapsed' : '') + (sel.net === ni ? ' fwb-netsel' : '') + '" data-net="' + ni + '" aria-label="Netzwerk ' + (ni + 1) + '">' +
        '<div class="fwb-nethead"><button type="button" class="fwb-b" data-act="collapse" data-net="' + ni + '" aria-expanded="' + (!net.collapsed) + '" title="Ein-/ausklappen">' + (net.collapsed ? '▸' : '▾') + '</button>' +
        '<span class="fwb-no">Netzwerk ' + (ni + 1) + ':</span><input type="text" data-k="title" data-net="' + ni + '" value="' + esc(net.title) + '" placeholder="Titel" aria-label="Titel Netzwerk ' + (ni + 1) + '"' + (readOnly ? ' readonly' : '') + '>' +
        (errs ? '<span class="fwb-bad" title="Netzwerk unvollständig oder fehlerhaft" aria-label="' + errs + ' Fehler">⊗</span>' : net.nodes.length ? '<span class="fwb-good" title="Netzwerk vollständig" aria-label="vollständig">✓</span>' : '') +
        (readOnly ? '' : '<button type="button" class="fwb-b" data-act="delnet" data-net="' + ni + '" title="Netzwerk löschen" aria-label="Netzwerk ' + (ni + 1) + ' löschen">🗑</button>') + '</div>' +
        '<textarea class="fwb-comment" data-k="comment" data-net="' + ni + '" rows="1" placeholder="Kommentar" aria-label="Kommentar Netzwerk ' + (ni + 1) + '"' + (readOnly ? ' readonly' : '') + '>' + esc(net.comment) + '</textarea>' +
        '<div class="fwb-canvas" data-net="' + ni + '">' + netSvg(net, ni) + '</div><ul class="fwb-msgs">' + netMsgs(ni) + '</ul></section>' +
        '<div class="fwb-newnet" data-newnet="' + (ni + 1) + '" aria-hidden="true"></div>';
    }).join('') + (readOnly ? '' : '<button type="button" class="fwb-b fwb-addnet" data-act="addnet">＋ Netzwerk</button>');
    restoreView(keep);
  }
  function keepView(){
    const a = document.activeElement;
    return { top: netsEl.scrollTop, left: [...netsEl.querySelectorAll('.fwb-canvas')].map(c => c.scrollLeft), fk: a && rootEl.contains(a) && a.dataset ? a.dataset.fk : null };
  }
  function restoreView(k){
    netsEl.scrollTop = k.top;
    netsEl.querySelectorAll('.fwb-canvas').forEach((c, i) => { if(k.left[i]) c.scrollLeft = k.left[i]; });
    if(k.fk){ const el = netsEl.querySelector('[data-fk="' + k.fk + '"]'); if(el) el.focus({ preventScroll: true }); }
  }
  function flowVals(ni){ return null; }
  function focusKey(k){ const el = netsEl.querySelector('[data-fk="' + k + '"]'); if(el) el.focus({ preventScroll: true }); }

  /* ---------- Änderungen ---------- */
  function snapshot(){ return JSON.stringify(prog); }
  function mutate(fn){
    if(readOnly) return;
    const before = snapshot();
    const r = fn();
    if(r === false) return;
    const after = snapshot();
    if(after !== before){ hist.push(before); if(hist.length > 200) hist.shift(); fut = []; errMark = null; flow = null; }
    commit();
  }
  function commit(){ render(); if(opts.onChange) opts.onChange(getValue()); }
  function getValue(){
    if(rawErr) return rawText;
    const body = G.toText(prog);
    return frame ? frame.head + body.replace(/\n$/, '') + frame.foot : body;
  }
  function newNode(ni, t, o, x, y){
    const n = G.makeNode(t, o); n.id = 'n' + (++prog.seq);
    n.x = snap(Math.max(8, x)); n.y = snap(Math.max(G.hasTop(n) ? TOPH : 8, y));
    N(ni).nodes.push(n); return n;
  }
  const isLogicSrc = n => G.hasOut(n);
  function removeNodes(ni, ids){
    const net = N(ni);
    net.wires.filter(w => ids.has(w.s) && !ids.has(w.d)).forEach(w => { const d = nodeOf(ni, w.d); if(d) clearPin(d, w.p); });
    net.wires = net.wires.filter(w => !ids.has(w.s) && !ids.has(w.d));
    net.nodes = net.nodes.filter(n => !ids.has(n.id));
  }
  function clearPin(n, i){ const p = n.ins[i]; p.op = p.k === 'f' && ['move', 'calc', 'call'].includes(n.t) ? null : '?'; }

  /* ---------- Ablegen (aus Leiste/Bibliothek) ---------- */
  function placeNew(ni, spec, x, y){
    const s = parseSpec(spec); if(s.tool){ setStatus('Werkzeug „' + specLabel(spec) + '“ auf einen Anschluss oder eine Box anwenden.', 'warnmsg'); return false; }
    const n = newNode(ni, s.t, s.o, x - G.boxW({ t: s.t }) / 2, y - 14);
    sel = { net: ni, nodes: new Set([n.id]), wire: null };
    setStatus(G.NAME[n.t] + ' eingefügt.');
    return n;
  }
  function applyDrop(spec, tg){
    if(!tg) return false;
    if(tg.kind === 'newnet'){
      const s = parseSpec(spec); if(s.tool){ setStatus('Werkzeuge wirken auf Anschlüsse, nicht auf neue Netzwerke.', 'warnmsg'); return false; }
      prog.networks.splice(tg.idx, 0, G.emptyNet(''));
      placeNew(tg.idx, spec, 24 + OPW + 40, 40 + TOPH);
      return true;
    }
    if(tg.kind === 'canvas') return !!placeNew(tg.net, spec, tg.x, tg.y);
    return dropOn(spec, tg);
  }
  function dropOn(spec, tg){ setStatus('Hier kann „' + specLabel(spec) + '“ nicht abgelegt werden.', 'warnmsg'); return false; }

  /* ---------- Ziele unter dem Zeiger ---------- */
  function worldAt(svg, cx, cy){ const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return { x: (cx - r.left) * vb.width / r.width, y: (cy - r.top) * vb.height / r.height }; }
  function targetAt(cx, cy){
    const el = document.elementFromPoint(cx, cy);
    if(!el || !rootEl.contains(el)) return null;
    const nn = el.closest('[data-newnet]'); if(nn) return { kind:'newnet', idx: +nn.dataset.newnet, el: nn };
    const add = el.closest('[data-act="addnet"]'); if(add) return { kind:'newnet', idx: prog.networks.length, el: add };
    const ni = el.closest('[data-net]') ? +el.closest('[data-net]').dataset.net : -1;
    const pin = el.closest('[data-pin]');
    if(pin){ const [k, i] = pin.dataset.pin.split(':'); return k === 'out' ? { kind:'out', net: ni, node: pin.dataset.node, el: pin } : { kind:'in', net: ni, node: pin.dataset.node, i: +i, el: pin }; }
    const slot = el.closest('[data-slot]');
    if(slot){ const sl = slot.dataset.slot; if(/^in:/.test(sl)) return { kind:'in', net: ni, node: slot.dataset.node, i: +sl.split(':')[1], el: slot.querySelector('rect') || slot, slot: sl }; return { kind:'slot', net: ni, node: slot.dataset.node, slot: sl, el: slot.querySelector('rect') || slot }; }
    const wire = el.closest('[data-wire]'); if(wire) return { kind:'wire', net: ni, w: +wire.dataset.wire, el: wire };
    const node = el.closest('[data-node]'); if(node) return { kind:'node', net: ni, node: node.dataset.node, el: node.querySelector('.n-box') || node };
    const cv = el.closest('.fwb-canvas');
    if(cv){ const svg = cv.querySelector('svg'); const p = worldAt(svg, cx, cy); return { kind:'canvas', net: +cv.dataset.net, x: p.x, y: p.y, el: cv }; }
    return null;
  }
  let hl = null;
  function highlight(tg){
    if(hl && hl !== (tg && tg.el)){ hl.classList.remove('fwb-drop'); hl = null; }
    if(tg && tg.el){ tg.el.classList.add('fwb-drop'); hl = tg.el; }
  }
  rootEl._fwbTargetAt = targetAt;

  /* ---------- Zeiger: Ziehen, Verschieben, Rahmen ---------- */
  let drag = null, ghost = null, raf = 0;
  const DIST = 6;
  function startGhost(label){ ghost = document.createElement('div'); ghost.className = 'fwb-ghost'; ghost.textContent = label; document.body.appendChild(ghost); }
  function endGhost(){ if(ghost){ ghost.remove(); ghost = null; } highlight(null); }
  rootEl.addEventListener('pointerdown', e => {
    if(e.button !== 0 && e.pointerType === 'mouse') return;
    const t = e.target;
    if(t.closest('input,textarea,.fwb-inline')) return;
    const pal = t.closest('[data-pal]');
    if(pal){ if(readOnly) return; e.preventDefault(); drag = { kind:'pal', spec: pal.dataset.pal, x0: e.clientX, y0: e.clientY, id: e.pointerId, moved: false }; return; }
    if(readOnly) return;
    const cv = t.closest('.fwb-canvas'); if(!cv) return;
    const ni = +cv.dataset.net;
    if(t.closest('[data-slot]') || t.closest('[data-star]') || t.closest('[data-pin]') || t.closest('[data-wire]')) return;
    const nodeEl = t.closest('[data-node]');
    const svg = cv.querySelector('svg');
    if(nodeEl){
      const id = nodeEl.dataset.node;
      if(e.shiftKey || e.ctrlKey || e.metaKey){ if(sel.net !== ni) sel = { net: ni, nodes: new Set(), wire: null }; if(sel.nodes.has(id)) sel.nodes.delete(id); else sel.nodes.add(id); sel.wire = null; render(); return; }
      if(sel.net !== ni || !sel.nodes.has(id)){ sel = { net: ni, nodes: new Set([id]), wire: null }; }
      const p = worldAt(svg, e.clientX, e.clientY);
      drag = { kind:'move', net: ni, x0: e.clientX, y0: e.clientY, w0: p, orig: [...sel.nodes].map(i => { const n = nodeOf(ni, i); return [n, n.x, n.y]; }), before: snapshot(), moved: false, id: e.pointerId };
      e.preventDefault();
      render(); focusKey('n:' + ni + ':' + id);
      return;
    }
    // freie Fläche: Rahmen ziehen (Maus/Stift); Touch scrollt
    rootEl.focus({ preventScroll: true });
    if(e.pointerType !== 'touch'){
      e.preventDefault();
      const p = worldAt(svg, e.clientX, e.clientY);
      drag = { kind:'marquee', net: ni, w0: p, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
    } else drag = { kind:'tapcanvas', net: ni, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if(!drag.moved && dist < DIST) return;
    if(!drag.moved){ drag.moved = true; if(drag.kind === 'pal') startGhost(specLabel(drag.spec)); }
    if(drag.kind === 'pal'){
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      highlight(dropTarget(drag.spec, targetAt(e.clientX, e.clientY)));
      autoScroll(e.clientY);
    } else if(drag.kind === 'move'){
      const svg = netsEl.querySelector('svg[data-net="' + drag.net + '"]'); if(!svg) return;
      const p = worldAt(svg, e.clientX, e.clientY), dx = p.x - drag.w0.x, dy = p.y - drag.w0.y;
      drag.orig.forEach(([n, x, y]) => { n.x = Math.max(4, x + dx); n.y = Math.max(G.hasTop(n) ? TOPH : 4, y + dy); });
      if(!raf) raf = requestAnimationFrame(() => { raf = 0; redrawNet(drag ? drag.net : 0); });
    } else if(drag.kind === 'marquee'){
      const svg = netsEl.querySelector('svg[data-net="' + drag.net + '"]'); if(!svg) return;
      const p = worldAt(svg, e.clientX, e.clientY);
      drag.w1 = p;
      let r = svg.querySelector('rect.marquee');
      if(!r){ r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); r.setAttribute('class', 'marquee'); svg.appendChild(r); }
      r.setAttribute('x', Math.min(p.x, drag.w0.x)); r.setAttribute('y', Math.min(p.y, drag.w0.y)); r.setAttribute('width', Math.abs(p.x - drag.w0.x)); r.setAttribute('height', Math.abs(p.y - drag.w0.y));
    }
  });
  window.addEventListener('pointerup', e => {
    if(!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if(d.kind === 'pal'){
      if(d.moved){ const tg = dropTarget(d.spec, targetAt(e.clientX, e.clientY)); endGhost(); if(tg) mutate(() => applyDrop(d.spec, tg)); else setStatus('Nicht abgelegt – ziehe auf das Netzwerk, einen Anschluss oder eine Linie.', 'warnmsg'); }
      else { armed = armed === d.spec ? null : d.spec; pend = null; updateArmed(); setStatus(armed ? '„' + specLabel(armed) + '“ gewählt – jetzt das Ziel im Netzwerk antippen (Esc bricht ab).' : ''); }
      return;
    }
    if(d.kind === 'move'){
      if(d.moved){
        d.orig.forEach(([n]) => { n.x = snap(n.x); n.y = snap(n.y); });
        const after = snapshot();
        if(after !== d.before){ hist.push(d.before); fut = []; }
        commit();
      } else if(armed){ const n = nodeOf(d.net, d.orig[0][0].id); useArmed({ kind:'node', net: d.net, node: n.id }); }
      return;
    }
    if(d.kind === 'marquee' || d.kind === 'tapcanvas'){
      if(d.moved && d.kind === 'marquee' && d.w1){
        const x1 = Math.min(d.w0.x, d.w1.x), x2 = Math.max(d.w0.x, d.w1.x), y1 = Math.min(d.w0.y, d.w1.y), y2 = Math.max(d.w0.y, d.w1.y);
        const ids = N(d.net).nodes.filter(n => { const s = G.size(n); return n.x < x2 && n.x + s.w > x1 && n.y < y2 && n.y + s.h > y1; }).map(n => n.id);
        sel = { net: d.net, nodes: new Set(ids), wire: null };
        setStatus(ids.length ? ids.length + ' Box(en) markiert – Entf löscht, Ziehen verschiebt.' : '');
        render();
      } else if(!d.moved){
        if(armed){ const svg = netsEl.querySelector('svg[data-net="' + d.net + '"]'); const p = worldAt(svg, e.clientX, e.clientY); useArmed({ kind:'canvas', net: d.net, x: p.x, y: p.y }); }
        else { sel = { net: d.net, nodes: new Set(), wire: null }; pend = null; render(); }
      }
    }
  });
  window.addEventListener('pointercancel', () => { if(drag){ if(drag.kind === 'move'){ drag.orig.forEach(([n, x, y]) => { n.x = x; n.y = y; }); render(); } drag = null; endGhost(); } });
  function autoScroll(cy){ const r = netsEl.getBoundingClientRect(); if(cy < r.top + 30) netsEl.scrollTop -= 12; else if(cy > r.bottom - 30) netsEl.scrollTop += 12; }
  function redrawNet(ni){ const cv = netsEl.querySelector('.fwb-canvas[data-net="' + ni + '"]'); if(cv){ const sl = cv.scrollLeft; cv.innerHTML = netSvg(N(ni), ni); cv.scrollLeft = sl; } }
  // Welche Ziele passen zu welchem Baustein?
  function dropTarget(spec, tg){
    if(!tg) return null;
    const s = parseSpec(spec);
    if(s.tool) return ['in', 'out', 'wire', 'node'].includes(tg.kind) ? tg : null;
    if(tg.kind === 'slot') return null;
    return tg;
  }
  function useArmed(tg){
    const spec = armed; if(!spec) return;
    const t = dropTarget(spec, tg);
    if(!t){ setStatus('Dieses Ziel passt nicht zu „' + specLabel(spec) + '“.', 'warnmsg'); return; }
    mutate(() => applyDrop(spec, t));
    // Box-Werkzeuge bleiben nicht aktiv; Negieren/Eingang dürfen mehrfach angewendet werden
    if(!parseSpec(spec).tool){ armed = null; updateArmed(); }
  }

  /* ---------- Klicks ---------- */
  rootEl.addEventListener('click', e => {
    const t = e.target;
    const act = t.closest('[data-act]');
    if(act){ doAct(act.dataset.act, act); return; }
    if(readOnly) return;
    const wire = t.closest('[data-wire]');
    if(wire){ const ni = +wire.dataset.net, wi = +wire.dataset.wire; if(armed){ useArmed({ kind:'wire', net: ni, w: wi }); return; } sel = { net: ni, nodes: new Set(), wire: wi }; setStatus('Verbindung markiert – Entf löscht sie.'); render(); return; }
  });
  function doAct(a, el){
    if(a === 'lib'){ libEl.hidden = !libEl.hidden; el.setAttribute('aria-expanded', String(!libEl.hidden)); return; }
    if(readOnly) return;
    const ni = el.dataset.net !== undefined ? +el.dataset.net : sel.net;
    if(a === 'addnet') mutate(() => { prog.networks.push(G.emptyNet('')); sel = { net: prog.networks.length - 1, nodes: new Set(), wire: null }; });
    else if(a === 'delnet') mutate(() => { prog.networks.splice(ni, 1); if(!prog.networks.length) prog.networks.push(G.emptyNet('')); sel = { net: 0, nodes: new Set(), wire: null }; });
    else if(a === 'collapse') mutate(() => { N(ni).collapsed = !N(ni).collapsed; });
    else if(a === 'cleanup') mutate(() => { (sel.nodes.size ? [N(sel.net)] : prog.networks).forEach(G.layoutNet); setStatus('Aufgeräumt.'); });
  }
  rootEl.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.k; if(!k) return;
    const ni = +e.target.dataset.net;
    mutate(() => { N(ni)[k] = e.target.value; });
  });

  /* ---------- Tastatur ---------- */
  rootEl.addEventListener('keydown', e => {
    if(e.target.closest('input,textarea')) return;
    if(e.key === 'Escape'){ armed = null; pend = null; updateArmed(); sel.nodes.clear(); sel.wire = null; setStatus(''); render(); return; }
    if(readOnly) return;
    if(e.key === 'Delete' || e.key === 'Backspace'){
      if(sel.wire !== null && sel.wire !== undefined){ e.preventDefault(); mutate(() => { const net = N(sel.net), w = net.wires[sel.wire]; if(w){ const d = nodeOf(sel.net, w.d); net.wires.splice(sel.wire, 1); if(d) clearPin(d, w.p); } sel.wire = null; }); return; }
      if(sel.nodes.size){ e.preventDefault(); const ids = new Set(sel.nodes); mutate(() => { removeNodes(sel.net, ids); sel.nodes.clear(); setStatus(ids.size + ' Box(en) gelöscht.'); }); }
    }
  });

  /* ---------- Schnittstelle ---------- */
  function setValue(text){
    text = String(text || '');
    frame = /^\s*(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/im.test(text) ? K.splitBlock(text) : null;
    const body = frame ? frame.body : text;
    try{ prog = G.fromText(body); rawErr = null; if(!prog.networks.length) prog.networks.push(G.emptyNet('')); }
    catch(e){ rawErr = e; rawText = text; }
    sel = { net: 0, nodes: new Set(), wire: null }; pend = null; flow = null; errMark = null; hist = []; fut = [];
    render();
  }
  const api = {
    isFup: true, isKop: true,
    getValue, setValue,
    get mode(){ return 'graph'; },
    setMode(){},
    graph: () => prog,
    check: () => G.check(prog, { tags: tagNames.length ? tags : null }),
    setErrorLine(line){ api.setErrorMark(line, 1, ''); },
    setErrorMark(){},
    showFlow(){}, clearFlow(){},
    insertAtCursor(){}, setSymbols(list){ symbols = list || []; render(); },
    setReadOnly(ro){ readOnly = !!ro; rootEl.classList.toggle('fwb-ro', readOnly); render(); },
    relayout(){}, refresh(){ render(); },
    el: rootEl
  };
  renderBar();
  render();
  return api;
}

root.FUPWorkbench = { create, FAV, LIB };
if(typeof module !== 'undefined' && module.exports) module.exports = root.FUPWorkbench;
})(typeof window !== 'undefined' ? window : globalThis);
