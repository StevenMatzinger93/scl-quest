(function(root){
"use strict";
/* ============================================================
   KOP-EDITOR — grafischer Netzwerk-Editor (Kontaktplan)
   ------------------------------------------------------------
   Legt sich über den Text-Editor (SCLEditor) und bietet dieselbe
   Schnittstelle (getValue, setValue, setErrorMark, insertAtCursor …).
   Bearbeitet wird strukturell: Element antippen → Werkzeugleiste.
   Gespeichert wird das Textformat aus kop.js.
   showFlow(env) färbt den Stromfluss eines Zyklus ein.
   ============================================================ */
const K = root.KOP;
const CW = 92, CH = 58, RAIL = 14, PADT = 10;
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const svgT = s => esc(s);

/* ---------- Layout (Einheiten: Zellen) ---------- */
function size(e){
  switch(e.t){
    case 'c': case 'cmp': e._w = 1; e._h = 1; break;
    case 'box': e._w = 1; e._h = 2; break;
    case 's': if(!e.items.length){ e._w = 1; e._h = 1; break; }
      e.items.forEach(size); e._w = e.items.reduce((a, x) => a + x._w, 0); e._h = Math.max(...e.items.map(x => x._h)); break;
    case 'p': e.items.forEach(size); e._w = Math.max(...e.items.map(x => x._w)); e._h = e.items.reduce((a, x) => a + x._h, 0); break;
  }
}
function place(e, x, y){
  e._x = x; e._y = y;
  if(e.t === 's'){ let cx = x; e.items.forEach(it => { place(it, cx, y); cx += it._w; }); }
  else if(e.t === 'p'){ let cy = y; e.items.forEach(it => { place(it, x, cy); cy += it._h; }); }
}
const outH = o => o.t === 'op' ? 2 : o.t === 'call' ? Math.max(2, Math.ceil((o.args.length * 13 + 34) / CH)) : 1;
const outW = o => o.t === 'call' ? 2.4 : 1;

/* ---------- Pfade im Baum ---------- */
function at(net, path){ let e = net.expr; for(const i of path) e = e.items[i]; return e; }
function parentOf(net, path){ return path.length ? at(net, path.slice(0, -1)) : null; }
function newContact(){ return { t:'c', v:'?' }; }
function nextInst(prog, prefix){
  const used = new Set(); const walk = e => { if(!e) return; if(e.t === 'box') used.add(String(e.inst).toUpperCase()); if(e.items) e.items.forEach(walk); };
  prog.networks.forEach(n => walk(n.expr));
  for(let i = 1; ; i++) if(!used.has((prefix + i).toUpperCase())) return prefix + i;
}
function normalize(e){
  if(!e || !e.items) return e;
  e.items = e.items.map(normalize).flatMap(x => (x.t === e.t) ? x.items : [x]);
  if(e.t === 'p' && e.items.length === 1) return e.items[0];
  if(e.t === 's' && e.items.length === 1) return e.items[0];
  return e;
}

/* ---------- Zeichnen ---------- */
function drawNet(n, ni, sel, flow){
  const parts = [];
  const exprOk = !!n.expr;
  if(exprOk){ size(n.expr); place(n.expr, 0, 0); }
  const ew = exprOk ? Math.max(n.expr._w, 1) : 1, eh = exprOk ? n.expr._h : 1;
  const oh = n.outs.reduce((a, o) => a + outH(o), 0) || 1;
  const outX = Math.max(ew, n.outs.some(o => o.t === 'call') ? 1 : 3) + 0.4;   // Aufruf-Boxen rücken nach links (schmale Bildschirme)
  const H = Math.max(eh, oh);
  const px = u => RAIL + u * CW, py = u => PADT + u * CH + CH / 2;
  const on = v => flow && v ? (flow[v] === true ? ' on' : '') : '';
  const OW = Math.max(1, ...n.outs.map(outW));
  const W = px(outX + OW) + 26;
  const selPath = sel && sel.net === ni ? sel : null;
  const isSel = (kind, id) => selPath && selPath.kind === kind && String(selPath.id) === String(id);
  const wire = (x1, y1, x2, y2, f) => parts.push('<line class="kw' + f + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>');
  // linke Stromschiene
  parts.push('<line class="krail" x1="' + RAIL + '" y1="' + (PADT - 4) + '" x2="' + RAIL + '" y2="' + (PADT + H * CH + 4) + '"/>');
  function label(x, y, txt, cls){ parts.push('<text class="' + (cls || 'kl') + '" x="' + x + '" y="' + y + '" text-anchor="middle">' + svgT(txt) + '</text>'); }
  function node(e, path, inF){
    const x = px(e._x), y = py(e._y), fin = inF === 'TRUE' ? ' on' + (flow ? '' : '') : on(inF);
    const finCls = flow ? (inF === 'TRUE' ? ' on' : on(inF)) : '';
    const id = path.join('.');
    const hit = (w, h) => '<rect class="khit' + (isSel('e', id) ? ' ksel' : '') + '" data-net="' + ni + '" data-kind="e" data-id="' + id + '" x="' + (x + 4) + '" y="' + (y - CH / 2 + 3) + '" width="' + (w * CW - 8) + '" height="' + (h * CH - 6) + '" rx="6"/>';
    switch(e.t){
      case 'c': {
        const fo = on(e._f), mid = x + CW / 2, open = e.v === '?';
        wire(x, y, mid - 11, y, finCls); wire(mid + 11, y, x + CW, y, fo);
        parts.push('<g class="kel' + fo + (open ? ' kopen' : '') + '"><line x1="' + (mid - 11) + '" y1="' + (y - 13) + '" x2="' + (mid - 11) + '" y2="' + (y + 13) + '"/><line x1="' + (mid + 11) + '" y1="' + (y - 13) + '" x2="' + (mid + 11) + '" y2="' + (y + 13) + '"/>' +
          (e.neg ? '<line x1="' + (mid - 9) + '" y1="' + (y + 11) + '" x2="' + (mid + 9) + '" y2="' + (y - 11) + '"/>' : '') +
          (e.edge ? '<text class="kin" x="' + mid + '" y="' + (y + 5) + '" text-anchor="middle">' + e.edge + '</text>' : '') + '</g>');
        label(mid, y - 18, e.v === '?' ? '??' : e.v, 'kl' + (open ? ' kred' : ''));
        if(flow && e.v !== '?' && typeof flow[e.v] === 'boolean') label(mid, y + 27, flow[e.v] ? '1' : '0', 'kv' + (flow[e.v] ? ' on' : ''));
        parts.push(hit(1, 1)); return e._f;
      }
      case 'cmp': {
        const fo = on(e._f), mid = x + CW / 2;
        wire(x, y, mid - 22, y, finCls); wire(mid + 22, y, x + CW, y, fo);
        parts.push('<rect class="kbox' + fo + '" x="' + (mid - 22) + '" y="' + (y - 15) + '" width="44" height="30" rx="3"/>');
        label(mid, y + 5, e.op, 'kin');
        label(mid, y - 20, e.a === '?' ? '??' : e.a, 'kl' + (e.a === '?' ? ' kred' : ''));
        label(mid, y + 28, e.b === '?' ? '??' : e.b, 'kl kl2' + (e.b === '?' ? ' kred' : ''));
        parts.push(hit(1, 1)); return e._f;
      }
      case 'box': {
        const fo = on(e._f), bx = x + 12, bw = CW - 24;
        wire(x, y, bx, y, finCls); wire(bx + bw, y, x + CW, y, fo);
        parts.push('<rect class="kbox' + fo + '" x="' + bx + '" y="' + (y - 16) + '" width="' + bw + '" height="' + (CH * 2 - 26) + '" rx="4"/>');
        label(x + CW / 2, y - 20, e.inst === '?' ? '??' : e.inst, 'kl' + (e.inst === '?' ? ' kred' : ''));
        label(x + CW / 2, y - 2, e.k, 'kbt');
        const ps = Object.keys(e.p).map(k => k + ' ' + e.p[k]);
        ps.slice(0, 3).forEach((t, i) => label(x + CW / 2, y + 14 + i * 13, t, 'kps'));
        if(flow && flow[e.inst] && typeof flow[e.inst] === 'object'){ const st = flow[e.inst]; const extra = st.ET !== undefined ? 'ET ' + (+st.ET).toFixed(1) + 's' : st.CV !== undefined ? 'CV ' + st.CV : ''; if(extra) label(x + CW / 2, y + 14 + Math.min(ps.length, 3) * 13, extra, 'kv on'); }
        parts.push(hit(1, 2)); return e._f;
      }
      case 's': {
        if(!e.items.length){ wire(x, y, x + CW, y, finCls); label(x + CW / 2, y - 12, 'immer', 'kv'); parts.push(hit(1, 1)); return inF; }
        let f = inF; e.items.forEach((it, i) => { f = node(it, path.concat(i), f); }); return f;
      }
      case 'p': {
        const last = e.items[e.items.length - 1], ylast = py(last._y), xr = px(e._x + e._w);
        wire(x, y, x, ylast, finCls);
        e.items.forEach((it, i) => { const fo = node(it, path.concat(i), inF); if(it._w < e._w) wire(px(it._x + it._w), py(it._y), xr, py(it._y), on(fo)); wire(xr, py(it._y), xr, y, on(fo)); });
        return e._f;
      }
    }
    return inF;
  }
  let F = 'TRUE';
  if(exprOk) F = node(n.expr, [], 'TRUE');
  // Verbindung zu den Spulen
  const fcls = flow ? (F === 'TRUE' ? ' on' : on(F)) : '';
  wire(px(ew), py(0), px(outX), py(0), fcls);
  let oy = 0;
  n.outs.forEach((o, k) => {
    const y = py(oy), x = px(outX), mid = x + CW / 2;
    if(oy > 0) wire(x, py(0), x, y, fcls);
    const open = o.t === 'coil' && o.v === '?';
    if(o.t === 'coil'){
      wire(x, y, mid - 13, y, fcls); wire(mid + 13, y, x + CW, y, fcls);
      parts.push('<g class="kel' + fcls + (open ? ' kopen' : '') + '"><path d="M' + (mid - 7) + ' ' + (y - 14) + ' Q' + (mid - 16) + ' ' + y + ' ' + (mid - 7) + ' ' + (y + 14) + '"/><path d="M' + (mid + 7) + ' ' + (y - 14) + ' Q' + (mid + 16) + ' ' + y + ' ' + (mid + 7) + ' ' + (y + 14) + '"/>' +
        (o.mode ? '<text class="kin" x="' + mid + '" y="' + (y + 5) + '" text-anchor="middle">' + (o.mode === 'NOT' ? '/' : o.mode) + '</text>' : '') + '</g>');
      label(mid, y - 19, open ? '??' : o.v, 'kl' + (open ? ' kred' : ''));
      if(flow && !open && typeof flow[o.v] === 'boolean') label(mid, y + 27, flow[o.v] ? '1' : '0', 'kv' + (flow[o.v] ? ' on' : ''));
    } else if(o.t === 'call'){
      const bw = CW * outW(o) - 16, bx = x + 8, h = outH(o) * CH - 22, mc = bx + bw / 2, open2 = o.target === '?';
      wire(x, y, bx, y, fcls); wire(bx + bw, y, px(outX + OW), y, fcls);
      parts.push('<rect class="kbox' + fcls + '" x="' + bx + '" y="' + (y - 16) + '" width="' + bw + '" height="' + h + '" rx="4"/>');
      label(mc, y - 20, open2 ? '??' : o.target, 'kl' + (open2 ? ' kred' : ''));
      parts.push('<text class="kps" x="' + (bx + 6) + '" y="' + (y - 3) + '">EN</text><text class="kps" x="' + (bx + bw - 6) + '" y="' + (y - 3) + '" text-anchor="end">ENO</text>');
      o.args.forEach((a, i) => parts.push('<text class="kps' + (a.v === '?' ? ' kred' : '') + '" x="' + (a.d === ':=' ? bx + 6 : bx + bw - 6) + '" y="' + (y + 13 + i * 13) + '"' + (a.d === ':=' ? '' : ' text-anchor="end"') + '>' + svgT(a.d === ':=' ? a.n + ' := ' + a.v : a.v + ' ⇐ ' + a.n) + '</text>'));
      if(!o.args.length) label(mc, y + 14, '(keine Parameter)', 'kps');
    } else {
      const bx = x + 8, bw = CW - 16;
      wire(x, y, bx, y, fcls); wire(bx + bw, y, x + CW, y, fcls);
      parts.push('<rect class="kbox' + fcls + '" x="' + bx + '" y="' + (y - 16) + '" width="' + bw + '" height="' + (CH * 2 - 26) + '" rx="4"/>');
      label(mid, y - 2, o.k, 'kbt');
      const names = { MOVE:['IN','OUT'], ADD:['IN1','IN2','OUT'], SUB:['IN1','IN2','OUT'], MUL:['IN1','IN2','OUT'], DIV:['IN1','IN2','OUT'], INC:['IN/OUT'], DEC:['IN/OUT'] }[o.k] || [];
      o.args.forEach((a, i) => label(mid, y + 14 + i * 13, names[i] + ' ' + (a === '?' ? '??' : a), 'kps' + (a === '?' ? ' kred' : '')));
    }
    parts.push('<rect class="khit' + (isSel('o', k) ? ' ksel' : '') + '" data-net="' + ni + '" data-kind="o" data-id="' + k + '" x="' + (x + 4) + '" y="' + (y - CH / 2 + 3) + '" width="' + (CW * outW(o) - 8) + '" height="' + (outH(o) * CH - 6) + '" rx="6"/>');
    if(o.t !== 'call' && OW > 1) wire(x + CW, y, px(outX + OW), y, fcls);
    oy += outH(o);
  });
  // rechte Stromschiene
  parts.push('<line class="krail" x1="' + px(outX + OW) + '" y1="' + (PADT - 4) + '" x2="' + px(outX + OW) + '" y2="' + (PADT + H * CH + 4) + '"/>');
  const h = PADT * 2 + H * CH + 8;
  return '<svg class="kop-svg" width="' + W + '" height="' + h + '" viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="Netzwerk ' + (ni + 1) + '">' + parts.join('') + '</svg>';
}

// Statische Darstellung (Theorie, Handbuch, Lösungsvergleich)
function renderStatic(src, flow){
  let prog;
  const fr = K.splitBlock(src);
  if(fr && K.isKopBody(fr.body)){ try{ prog = K.parse(fr.body); K.toSCL(prog, { dry:true }); }catch(e){ return '<pre class="code">' + esc(src) + '</pre>'; }
    return '<pre class="code kop-head">' + esc(fr.head.trim()) + '</pre>' + renderStatic(fr.body, flow) + '<pre class="code kop-head">' + esc(fr.foot.trim()) + '</pre>'; }
  if(/^\s*(TYPE|DATA_BLOCK|FUNCTION|ORGANIZATION_BLOCK)/im.test(src)) return '<pre class="code">' + esc(src) + '</pre>';
  try{ prog = K.parse(src); K.toSCL(prog, { dry:true }); }catch(e){ return '<pre class="code">' + esc(src) + '</pre>'; }
  return '<div class="kop-static">' + prog.networks.map((n, i) => '<div class="kop-net"><div class="kop-nethead"><b>Netzwerk ' + (i + 1) + '</b> ' + esc(n.title || '') + '</div><div class="kop-scroll">' + drawNet(n, i, null, flow || null) + '</div></div>').join('') + '</div>';
}

/* ---------- Editor ---------- */
function attach(textEditor, opts){
  opts = opts || {};
  const body = document.getElementById('editorBody');
  const wrap = document.createElement('div'); wrap.className = 'kop-wrap'; wrap.id = 'kopWrap';
  wrap.innerHTML = '<div class="kop-tools" id="kopTools" role="toolbar" aria-label="Netzwerk bearbeiten"></div><div class="kop-props" id="kopProps"></div><div class="kop-canvas" id="kopCanvas" tabindex="0" aria-label="Kontaktplan"></div>';
  body.parentNode.insertBefore(wrap, body);
  const tools = wrap.querySelector('#kopTools'), props = wrap.querySelector('#kopProps'), canvas = wrap.querySelector('#kopCanvas');
  const toggle = document.createElement('button'); toggle.className = 'tool-btn'; toggle.id = 'kopViewBtn'; toggle.title = 'Zwischen Kontaktplan und Textansicht wechseln';
  const toolsBar = document.querySelector('.editor-tools'); toolsBar.insertBefore(toggle, toolsBar.firstChild);
  let prog = { networks: [] }, sel = null, mode = 'graph', flow = null, errNet = 0, errMsg = '', parseErr = null, symbols = [], readOnly = false;
  let frame = null, noGraph = false, callables = {};   // Profi: Bausteinkopf/-ende um die Netzwerke; Aufrufziele mit Parametern
  const symBar = document.getElementById('symBar');

  function setMode(m){
    mode = m;
    body.style.display = m === 'text' ? '' : 'none'; wrap.style.display = m === 'graph' ? '' : 'none';
    if(symBar) symBar.style.display = m === 'text' ? '' : 'none';
    toggle.innerHTML = m === 'graph' ? '<i class="fa-solid fa-code"></i> <span class="btn-text">Text</span>' : '<i class="fa-solid fa-diagram-project"></i> <span class="btn-text">KOP</span>';
    if(m === 'graph') loadFromText(); else textEditor.refresh && textEditor.refresh();
  }
  toggle.addEventListener('click', () => setMode(mode === 'graph' ? 'text' : 'graph'));
  function readFrame(txt){
    frame = K.splitBlock(txt);
    noGraph = !frame && /^\s*(TYPE|DATA_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/im.test(txt) || !!(frame && !K.isKopBody(frame.body));
  }
  function loadFromText(){
    const txt = textEditor.getValue(); readFrame(txt);
    if(noGraph){ parseErr = null; prog = { networks: [] }; render(); return; }
    try{ prog = frame ? K.parse(frame.body, { lineOffset: frame.offset }) : K.parse(txt); parseErr = null; }
    catch(e){ parseErr = e; }
    render();
  }
  function commit(){
    prog.networks.forEach(n => { if(n.expr) n.expr = normalize(n.expr); });
    const txt = frame ? frame.head + (prog.networks.length ? K.serialize(prog) : '').replace(/\n$/, '') + frame.foot : K.serialize(prog);
    textEditor.setValue(txt);
    flow = null;
    if(opts.onChange) opts.onChange(txt);
    render();
  }
  function selected(){
    if(!sel) return null;
    const n = prog.networks[sel.net]; if(!n) return null;
    if(sel.kind === 'e'){ const path = sel.id === '' ? [] : String(sel.id).split('.').map(Number); try{ return { n, path, e: at(n, path) }; }catch(e){ return null; } }
    if(sel.kind === 'o') return { n, o: n.outs[+sel.id], k: +sel.id };
    if(sel.kind === 'n') return { n };
    return null;
  }
  function render(){
    if(noGraph){
      canvas.innerHTML = '<div class="kop-err kop-info"><i class="fa-solid fa-circle-info"></i> Dieser Baustein hat keine Netzwerke (Datentyp oder Datenbaustein). Er wird in der <b>Textansicht</b> bearbeitet.</div>';
      tools.innerHTML = ''; props.innerHTML = ''; props.style.display = 'none'; return;
    }
    if(parseErr){
      canvas.innerHTML = '<div class="kop-err"><i class="fa-solid fa-triangle-exclamation"></i> Die Textansicht enthält einen Fehler (' + esc(parseErr.message) + '). Korrigiere ihn in der Textansicht.</div>';
      tools.innerHTML = ''; props.innerHTML = ''; return;
    }
    try{ K.toSCL(prog, { dry:true }); }catch(e){}
    canvas.innerHTML = prog.networks.map((n, i) =>
      '<div class="kop-net' + (errNet === i + 1 ? ' kop-neterr' : '') + (sel && sel.net === i ? ' kop-netsel' : '') + '" data-net="' + i + '">' +
      '<div class="kop-nethead" data-net="' + i + '" data-kind="n"><b>Netzwerk ' + (i + 1) + '</b> <span class="kop-title">' + esc(n.title || '') + '</span>' +
      (errNet === i + 1 && errMsg ? '<span class="kop-errmsg">' + esc(errMsg) + '</span>' : '') + '</div>' +
      '<div class="kop-scroll">' + drawNet(n, i, sel, flow) + '</div></div>').join('') +
      (readOnly ? '' : '<button class="tool-btn kop-addnet" data-act="addnet"><i class="fa-solid fa-plus"></i> Netzwerk</button>');
    renderTools();
  }
  const B = (act, icon, label, dis, title) => '<button class="tool-btn" data-act="' + act + '"' + (dis ? ' disabled' : '') + ' title="' + esc(title || label) + '"><i class="fa-solid ' + icon + '"></i> <span>' + label + '</span></button>';
  function renderTools(){
    if(readOnly){ tools.innerHTML = '<span class="kop-hint">Nur ansehen</span>'; props.innerHTML = ''; return; }
    const s = selected();
    let h = '';
    if(!s){ h = '<span class="kop-hint"><i class="fa-solid fa-hand-pointer"></i> Element antippen, um es zu bearbeiten. Variable dann links in der Liste anklicken.</span>'; }
    else if(s.e){
      const e = s.e, leaf = (e.t !== 's' && e.t !== 'p') || (e.t === 's' && !e.items.length);
      h += B('ser', 'fa-arrow-right', 'Kontakt dahinter', !leaf, 'Neuen Kontakt in Reihe (UND) dahinter einfügen');
      h += B('par', 'fa-code-branch', 'Parallelzweig', false, 'Zweig parallel (ODER) zu diesem Element');
      if(e.t === 'c'){ h += B('nc', 'fa-slash', e.neg ? 'Schliesser' : 'Öffner', !!e.edge); h += B('edge', 'fa-wave-square', e.edge === 'P' ? 'Flanke N' : e.edge === 'N' ? 'ohne Flanke' : 'Flanke P'); }
      h += '<span class="kop-sep"></span>';
      h += B('ton', 'fa-stopwatch', 'Timer', !leaf, 'Zeitglied (TON) dahinter'); h += B('ctu', 'fa-list-ol', 'Zähler', !leaf, 'Zähler (CTU) dahinter'); h += B('cmp', 'fa-greater-than-equal', 'Vergleich', !leaf, 'Vergleichskontakt dahinter');
      h += '<span class="kop-sep"></span>' + B('rail', 'fa-bolt', 'ohne Bedingung', s.path.length === 0 && e.t === 's' && !e.items.length, 'Strompfad ohne Kontakte: Spulen/Boxen hängen direkt an der Stromschiene') + B('del', 'fa-trash', 'Löschen', e.t === 's' && !e.items.length);
    } else if(s.o){
      h += B('coil', 'fa-circle', 'Spule', s.o.t === 'coil' && !s.o.mode) + B('set', 'fa-s', 'Setzen', s.o.mode === 'S') + B('reset', 'fa-r', 'Rücksetzen', s.o.mode === 'R') + B('ncoil', 'fa-slash', 'Negiert', s.o.mode === 'NOT');
      h += '<span class="kop-sep"></span>' + B('addout', 'fa-plus', 'weitere Spule') + B('move', 'fa-right-to-bracket', 'MOVE') + B('add', 'fa-plus-minus', 'Rechnen') + (Object.keys(callables).length ? B('call', 'fa-cube', 'Aufruf', s.o.t === 'call', 'Baustein aufrufen (FC, FB-Instanz)') : '');
      h += '<span class="kop-sep"></span>' + B('delout', 'fa-trash', 'Löschen', s.n.outs.length < 2);
    } else if(s.n){
      h += B('up', 'fa-arrow-up', 'nach oben', sel.net === 0) + B('down', 'fa-arrow-down', 'nach unten', sel.net >= prog.networks.length - 1) + B('delnet', 'fa-trash', 'Netzwerk löschen', prog.networks.length < 2);
    }
    tools.innerHTML = h;
    renderProps(s);
  }
  const dl = () => '<datalist id="kopVars">' + symbols.map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
  function field(label, key, val, w){ return '<label class="kop-f">' + label + ' <input data-k="' + key + '" value="' + esc(val === '?' ? '' : val) + '" list="kopVars" style="width:' + (w || 110) + 'px" autocomplete="off" spellcheck="false"></label>'; }
  function renderProps(s){
    let h = '';
    if(s && s.e && s.e.t === 'c') h = field('Variable', 'v', s.e.v, 150);
    else if(s && s.e && s.e.t === 'cmp') h = field('Wert A', 'a', s.e.a) + '<label class="kop-f">Vergleich <select data-k="op">' + K.CMP.map(o => '<option' + (o === s.e.op ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></label>' + field('Wert B', 'b', s.e.b);
    else if(s && s.e && s.e.t === 'box'){
      h = '<label class="kop-f">Typ <select data-k="k">' + (K.BOXES[s.e.k] === 'timer' ? ['TON','TOF','TP'] : ['CTU','CTD']).map(o => '<option' + (o === s.e.k ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></label>' + field('Instanz', 'inst', s.e.inst, 90);
      if(K.BOXES[s.e.k] === 'timer') h += field('Zeit PT', 'p.PT', s.e.p.PT || 'T#1S', 80);
      else { h += field('PV', 'p.PV', s.e.p.PV || '5', 50); h += s.e.k === 'CTU' ? field('Reset R', 'p.R', s.e.p.R || '', 100) : field('Laden LD', 'p.LD', s.e.p.LD || '', 100); }
    }
    else if(s && s.o && s.o.t === 'coil') h = field('Variable', 'v', s.o.v, 150);
    else if(s && s.o && s.o.t === 'call'){
      h = '<label class="kop-f">Aufruf <input data-k="target" value="' + esc(s.o.target === '?' ? '' : s.o.target) + '" list="kopCalls" style="width:170px" autocomplete="off" spellcheck="false"></label>' +
        '<datalist id="kopCalls">' + Object.keys(callables).map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
      const known = callables[s.o.target] || [];
      const names = known.map(p => p.n).concat(s.o.args.filter(a => !known.some(p => p.n.toLowerCase() === a.n.toLowerCase())).map(a => a.n));
      names.forEach(nm => { const kp = known.find(p => p.n === nm), a = s.o.args.find(x => x.n.toLowerCase() === nm.toLowerCase()); const d = kp ? kp.d : a.d;
        h += '<label class="kop-f" title="' + (d === ':=' ? 'Eingang' : 'Ausgang') + '">' + esc(nm) + ' ' + (d === ':=' ? ':=' : '=&gt;') + ' <input data-k="arg" data-n="' + esc(nm) + '" data-d="' + d + '" value="' + esc(a ? a.v : '') + '" list="kopVars" style="width:110px" autocomplete="off" spellcheck="false"></label>'; });
    }
    else if(s && s.o && s.o.t === 'op'){
      h = '<label class="kop-f">Box <select data-k="k">' + ['MOVE','ADD','SUB','MUL','DIV','INC','DEC'].map(o => '<option' + (o === s.o.k ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></label>';
      const names = { MOVE:['IN','OUT'], INC:['IN/OUT'], DEC:['IN/OUT'] }[s.o.k] || ['IN1','IN2','OUT'];
      s.o.args.forEach((a, i) => { h += field(names[i], 'a' + i, a, 90); });
    }
    else if(s && s.n && !s.e && !s.o) h = '<label class="kop-f">Titel <input data-k="title" value="' + esc(s.n.title || '') + '" style="width:220px"></label>';
    props.innerHTML = h ? h + dl() : '';
    props.style.display = h ? '' : 'none';
    props.querySelectorAll('input,select').forEach(inp => {
      const apply = () => {
        const s2 = selected(); if(!s2) return;
        const k = inp.dataset.k, v = inp.value.trim() || '?';
        const tgt = s2.e || s2.o || s2.n;
        if(k === 'title') s2.n.title = inp.value.replace(/[\r\n]/g, ' ').trim();
        else if(k === 'target'){ tgt.target = v; const known = callables[v]; if(known) tgt.args = known.map(p => tgt.args.find(a => a.n.toLowerCase() === p.n.toLowerCase()) || null).filter(Boolean); }
        else if(k === 'arg'){ const nm = inp.dataset.n, a = tgt.args.find(x => x.n.toLowerCase() === nm.toLowerCase());
          if(!inp.value.trim()){ tgt.args = tgt.args.filter(x => x !== a); }
          else if(a) a.v = inp.value.trim();
          else { const known = callables[tgt.target] || []; tgt.args.push({ n: nm, d: inp.dataset.d, v: inp.value.trim() }); tgt.args.sort((x, y) => known.findIndex(p => p.n === x.n) - known.findIndex(p => p.n === y.n)); } }
        else if(k.startsWith('p.')){ const pk = k.slice(2); if(v === '?' && (pk === 'R' || pk === 'LD')) delete tgt.p[pk]; else tgt.p[pk] = v; }
        else if(/^a\d$/.test(k)) tgt.args[+k.slice(1)] = v;
        else if(k === 'k'){
          if(s2.o){ const n = K.OUTBOX[v]; const old = tgt.args; tgt.k = v; tgt.args = Array.from({ length: n }, (_, i) => old[i] || '?'); }
          else { const wasT = K.BOXES[tgt.k] === 'timer'; tgt.k = v; if(wasT !== (K.BOXES[v] === 'timer')) tgt.p = K.BOXES[v] === 'timer' ? { PT:'T#1S' } : { PV:'5' }; if(v === 'CTD'){ delete tgt.p.R; } if(v === 'CTU'){ delete tgt.p.LD; } }
        }
        else tgt[k] = (k === 'op') ? inp.value : v;
        const focusKey = k === 'arg' ? 'arg"][data-n="' + inp.dataset.n : k; commit();
        const again = props.querySelector('[data-k="' + focusKey + '"]'); if(again && inp.tagName === 'INPUT'){ again.focus(); const L = again.value.length; again.setSelectionRange(L, L); }
      };
      if(inp.tagName === 'SELECT') inp.addEventListener('change', apply);
      else { inp.addEventListener('change', apply); inp.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); apply(); } }); }
    });
  }
  function replaceAt(n, path, fn){
    if(!path.length){ n.expr = fn(n.expr); return; }
    const par = parentOf(n, path); const i = path[path.length - 1];
    par.items[i] = fn(par.items[i]);
  }
  function insertSeriesAfter(s, el){
    if(s.e.t === 's' && !s.e.items.length){ replaceAt(s.n, s.path, () => el); return; }   // „immer“ durch Element ersetzen
    const par = parentOf(s.n, s.path);
    if(par && par.t === 's'){ par.items.splice(s.path[s.path.length - 1] + 1, 0, el); sel = { net: sel.net, kind:'e', id: s.path.slice(0, -1).concat(s.path[s.path.length - 1] + 1).join('.') }; }
    else { replaceAt(s.n, s.path, x => ({ t:'s', items:[x, el] })); sel = { net: sel.net, kind:'e', id: s.path.concat(1).join('.') }; }
  }
  function act(a){
    const s = selected(); const ni = sel ? sel.net : prog.networks.length - 1;
    switch(a){
      case 'addnet': { const at2 = sel ? sel.net + 1 : prog.networks.length; prog.networks.splice(at2, 0, { title:'', expr: newContact(), outs:[{ t:'coil', mode:'', v:'?' }] }); sel = { net: at2, kind:'e', id:'' }; break; }
      case 'ser': insertSeriesAfter(s, newContact()); break;
      case 'par': {
        const par = parentOf(s.n, s.path);
        if(par && par.t === 'p'){ par.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.slice(0, -1).concat(par.items.length - 1).join('.') }; }
        else { replaceAt(s.n, s.path, x => ({ t:'p', items:[x, newContact()] })); sel = { net: ni, kind:'e', id: s.path.concat(1).join('.') }; }
        break;
      }
      case 'rail': s.n.expr = { t:'s', items:[] }; sel = { net: ni, kind:'e', id:'' }; break;
      case 'nc': s.e.neg = !s.e.neg; break;
      case 'edge': s.e.edge = s.e.edge === 'P' ? 'N' : s.e.edge === 'N' ? undefined : 'P'; if(s.e.edge) s.e.neg = false; if(!s.e.edge) delete s.e.edge; break;
      case 'ton': insertSeriesAfter(s, { t:'box', k:'TON', inst: nextInst(prog, 'T'), p:{ PT:'T#1S' } }); break;
      case 'ctu': insertSeriesAfter(s, { t:'box', k:'CTU', inst: nextInst(prog, 'Z'), p:{ PV:'5' } }); break;
      case 'cmp': insertSeriesAfter(s, { t:'cmp', a:'?', op:'>', b:'0' }); break;
      case 'del': {
        const par = parentOf(s.n, s.path);
        if(!par){ s.n.expr = newContact(); sel = { net: ni, kind:'e', id:'' }; }
        else { par.items.splice(s.path[s.path.length - 1], 1); if(!par.items.length) par.items.push(newContact()); sel = null; }
        break;
      }
      case 'coil': s.o.t = 'coil'; s.o.mode = ''; if(!s.o.v) s.o.v = '?'; delete s.o.k; delete s.o.args; break;
      case 'set': Object.assign(s.o, { t:'coil', mode:'S', v: s.o.v || '?' }); delete s.o.k; delete s.o.args; break;
      case 'reset': Object.assign(s.o, { t:'coil', mode:'R', v: s.o.v || '?' }); delete s.o.k; delete s.o.args; break;
      case 'ncoil': Object.assign(s.o, { t:'coil', mode:'NOT', v: s.o.v || '?' }); delete s.o.k; delete s.o.args; break;
      case 'addout': s.n.outs.push({ t:'coil', mode:'', v:'?' }); sel = { net: ni, kind:'o', id: s.n.outs.length - 1 }; break;
      case 'move': s.n.outs[s.k] = { t:'op', k:'MOVE', args:['?', '?'] }; break;
      case 'add': s.n.outs[s.k] = { t:'op', k:'ADD', args:['?', '?', '?'] }; break;
      case 'call': s.n.outs[s.k] = { t:'call', target:'?', args:[] }; break;
      case 'delout': s.n.outs.splice(s.k, 1); sel = null; break;
      case 'up': if(ni > 0){ const [x] = prog.networks.splice(ni, 1); prog.networks.splice(ni - 1, 0, x); sel = { net: ni - 1, kind:'n', id:'' }; } break;
      case 'down': if(ni < prog.networks.length - 1){ const [x] = prog.networks.splice(ni, 1); prog.networks.splice(ni + 1, 0, x); sel = { net: ni + 1, kind:'n', id:'' }; } break;
      case 'delnet': prog.networks.splice(ni, 1); sel = null; break;
    }
    commit();
    if(opts.onAction) opts.onAction(a);
  }
  tools.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(b && !b.disabled) act(b.dataset.act); });
  canvas.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(b){ if(!readOnly) act(b.dataset.act); return; }
    const h = e.target.closest('[data-kind]');
    if(h){ sel = { net: +h.dataset.net, kind: h.dataset.kind, id: h.dataset.id || '' }; }
    else sel = null;
    render();
  });
  canvas.addEventListener('keydown', e => {
    if(readOnly) return;
    if((e.key === 'Delete' || e.key === 'Backspace') && sel && !e.target.closest('input')){ e.preventDefault(); const s = selected(); if(s && s.e) act('del'); else if(s && s.o && s.n.outs.length > 1) act('delout'); }
    if(e.key === 'Escape'){ sel = null; render(); }
  });
  function assignVar(name){
    const s = selected();
    if(!s){ opts.onNoSelection && opts.onNoSelection(); return false; }
    if(s.e && s.e.t === 'c') s.e.v = name;
    else if(s.e && s.e.t === 'cmp') { if(s.e.a === '?') s.e.a = name; else s.e.b = name; }
    else if(s.e && s.e.t === 'box'){ if(K.BOXES[s.e.k] === 'counter' && s.e.k === 'CTU') s.e.p.R = name; else if(s.e.k === 'CTD') s.e.p.LD = name; else return false; }
    else if(s.o && s.o.t === 'coil') s.o.v = name;
    else if(s.o && s.o.t === 'op'){ const i = s.o.args.indexOf('?'); s.o.args[i >= 0 ? i : s.o.args.length - 1] = name; }
    else if(s.o && s.o.t === 'call'){ if(s.o.target === '?' || callables[name]){ s.o.target = name; const known = callables[name]; if(known) s.o.args = s.o.args.filter(a => known.some(p => p.n.toLowerCase() === a.n.toLowerCase())); }
      else { const inp = props.querySelector('[data-k="arg"]:focus') || [...props.querySelectorAll('[data-k="arg"]')].find(x => !x.value); if(!inp) return false; inp.value = name; inp.dispatchEvent(new Event('change')); return true; } }
    else return false;
    commit(); return true;
  }

  const api = {
    isKop: true,
    getValue: () => textEditor.getValue(),
    setValue(v){ textEditor.setValue(v); sel = null; flow = null; errNet = 0; errMsg = ''; if(mode === 'graph') loadFromText(); },
    insertAtCursor(txt){ if(mode === 'text') return textEditor.insertAtCursor(txt); if(readOnly) return; assignVar(txt); },
    setErrorLine(n){ textEditor.setErrorLine(n); markNet(n, ''); },
    setErrorMark(line, col, msg, quiet){ textEditor.setErrorMark(line, col, msg, quiet); markNet(line, msg); },
    relayout(){ textEditor.relayout && textEditor.relayout(); },
    refresh(){ textEditor.refresh && textEditor.refresh(); },
    setFbNames(n){ textEditor.setFbNames && textEditor.setFbNames(n); },
    setSymbols(list){ symbols = list || []; },
    setCallables(map){ callables = map || {}; if(mode === 'graph') render(); },
    offsetOf(...a){ return textEditor.offsetOf(...a); }, tokenAt(...a){ return textEditor.tokenAt(...a); }, replaceRange(...a){ return textEditor.replaceRange(...a); },
    showFlow(env){ flow = env || null; if(mode === 'graph') render(); },
    clearFlow(){ if(flow){ flow = null; if(mode === 'graph') render(); } },
    setReadOnly(ro){ readOnly = !!ro; if(mode === 'graph') render(); },
    get mode(){ return mode; }, setMode
  };
  function markNet(line, msg){
    errNet = 0; errMsg = '';
    if(line){ let p; try{ const txt = textEditor.getValue(), fr = K.splitBlock(txt); p = fr ? K.parse(fr.body, { lineOffset: fr.offset }) : K.parse(txt); }catch(e){ p = null; }
      if(p){ p.networks.forEach((n, i) => { if(n.line <= line) errNet = i + 1; }); errMsg = msg ? String(msg).replace(/^Netzwerk \d+: /, '') : ''; } }
    if(mode === 'graph') render();
  }
  setMode('graph');
  return api;
}

root.KOPEditor = { attach, renderStatic, drawNet };
})(typeof window !== 'undefined' ? window : globalThis);
