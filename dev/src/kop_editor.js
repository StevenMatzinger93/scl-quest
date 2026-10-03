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
const PH = '<??.?>';   // Platzhalter wie im TIA Portal (offener Operand)

let DEFAULT_FLAVOR = (root.QUEST && (root.QUEST.lang === 'fup' || root.QUEST.lang === 'sensor')) ? 'fup' : 'kop';   // Darstellung: Kontaktplan oder Funktionsplan
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
const outH = o => o.t === 'op' ? (o.args.length > 3 ? 3 : 2) : o.t === 'call' ? Math.max(2, Math.ceil((o.args.length * 13 + 34) / CH)) : 1;
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
        label(mid, y - 18, e.v === '?' ? PH : e.v, 'kl' + (open ? ' kred' : ''));
        if(flow && e.v !== '?' && typeof flow[e.v] === 'boolean') label(mid, y + 27, flow[e.v] ? '1' : '0', 'kv' + (flow[e.v] ? ' on' : ''));
        parts.push(hit(1, 1)); return e._f;
      }
      case 'cmp': {
        const fo = on(e._f), mid = x + CW / 2;
        wire(x, y, mid - 22, y, finCls); wire(mid + 22, y, x + CW, y, fo);
        parts.push('<rect class="kbox' + fo + '" x="' + (mid - 22) + '" y="' + (y - 15) + '" width="44" height="30" rx="3"/>');
        label(mid, y + 5, e.op, 'kin');
        label(mid, y - 20, e.a === '?' ? PH : e.a, 'kl' + (e.a === '?' ? ' kred' : ''));
        label(mid, y + 28, e.b === '?' ? PH : e.b, 'kl kl2' + (e.b === '?' ? ' kred' : ''));
        parts.push(hit(1, 1)); return e._f;
      }
      case 'box': {
        const fo = on(e._f), bx = x + 12, bw = CW - 24;
        wire(x, y, bx, y, finCls); wire(bx + bw, y, x + CW, y, fo);
        parts.push('<rect class="kbox' + fo + '" x="' + bx + '" y="' + (y - 16) + '" width="' + bw + '" height="' + (CH * 2 - 26) + '" rx="4"/>');
        label(x + CW / 2, y - 20, e.inst === '?' ? PH : e.inst, 'kl' + (e.inst === '?' ? ' kred' : ''));
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
      label(mid, y - 19, open ? PH : o.v, 'kl' + (open ? ' kred' : ''));
      if(flow && !open && typeof flow[o.v] === 'boolean') label(mid, y + 27, flow[o.v] ? '1' : '0', 'kv' + (flow[o.v] ? ' on' : ''));
    } else if(o.t === 'call'){
      const bw = CW * outW(o) - 16, bx = x + 8, h = outH(o) * CH - 22, mc = bx + bw / 2, open2 = o.target === '?';
      wire(x, y, bx, y, fcls); wire(bx + bw, y, px(outX + OW), y, fcls);
      parts.push('<rect class="kbox' + fcls + '" x="' + bx + '" y="' + (y - 16) + '" width="' + bw + '" height="' + h + '" rx="4"/>');
      label(mc, y - 20, open2 ? PH : o.target, 'kl' + (open2 ? ' kred' : ''));
      parts.push('<text class="kps" x="' + (bx + 6) + '" y="' + (y - 3) + '">EN</text><text class="kps" x="' + (bx + bw - 6) + '" y="' + (y - 3) + '" text-anchor="end">ENO</text>');
      o.args.forEach((a, i) => parts.push('<text class="kps' + (a.v === '?' ? ' kred' : '') + '" x="' + (a.d === ':=' ? bx + 6 : bx + bw - 6) + '" y="' + (y + 13 + i * 13) + '"' + (a.d === ':=' ? '' : ' text-anchor="end"') + '>' + svgT(a.d === ':=' ? a.n + ' := ' + a.v : a.v + ' ⇐ ' + a.n) + '</text>'));
      if(!o.args.length) label(mc, y + 14, '(keine Parameter)', 'kps');
    } else {
      const bx = x + 8, bw = CW - 16;
      wire(x, y, bx, y, fcls); wire(bx + bw, y, x + CW, y, fcls);
      parts.push('<rect class="kbox' + fcls + '" x="' + bx + '" y="' + (y - 16) + '" width="' + bw + '" height="' + (CH * 2 - 26) + '" rx="4"/>');
      label(mid, y - 2, o.k, 'kbt');
      const names = { MOVE:['IN','OUT'], ADD:['IN1','IN2','OUT'], SUB:['IN1','IN2','OUT'], MUL:['IN1','IN2','OUT'], DIV:['IN1','IN2','OUT'], INC:['IN/OUT'], DEC:['IN/OUT'], NORM_X:['MIN','VALUE','MAX','OUT'], SCALE_X:['MIN','VALUE','MAX','OUT'] }[o.k] || [];
      o.args.forEach((a, i) => label(mid, y + 14 + i * 13, names[i] + ' ' + (a === '?' ? PH : a), 'kps' + (a === '?' ? ' kred' : '')));
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

/* ---------- FUP-Darstellung (Funktionsplan) ----------
   Derselbe Baum wie im Kontaktplan, gezeichnet als Boxen von rechts nach links:
   Reihe → &-Box, Parallel → >=1-Box, XOR → X-Box, Öffner → negierter Eingang (Kreis),
   Timer/Zähler in einer Reihe → Box, deren IN die Verknüpfung davor ist. */
const RH = 30, BW = 60, GAP = 26, LW = 118, OUTW = 150, FPAD = 12;
function fupTree(e, path){
  if(!e) return { k:'rail', path };
  switch(e.t){
    case 'c': return e.edge ? { k:'edge', e, path, h:2 } : { k:'leaf', e, path, h:1 };
    case 'cmp': return { k:'cmp', e, path, h:2 };
    case 'box': return { k:'tbox', e, path, inp:{ k:'rail', path }, h:0 };
    case 'p': return { k:'or', e, path, kids: e.items.map((x, i) => fupTree(x, path.concat(i))) };
    case 'x': return { k:'xor', e, path, kids: e.items.map((x, i) => fupTree(x, path.concat(i))) };
    case 's': {
      if(!e.items.length) return { k:'rail', e, path, h:1 };
      let acc = [];
      e.items.forEach((x, i) => {
        if(x.t === 'box'){
          const inp = !acc.length ? { k:'rail', path } : acc.length === 1 ? acc[0] : { k:'and', e, path, kids: acc, lastF: acc[acc.length - 1] };
          acc = [{ k:'tbox', e: x, path: path.concat(i), inp }];
        } else acc.push(fupTree(x, path.concat(i)));
      });
      return acc.length === 1 ? acc[0] : { k:'and', e, path, kids: acc };
    }
  }
  return { k:'rail', path };
}
function outF(n){   // Stromfluss-Variable am Ausgang eines Knotens
  if(n.k === 'and') return n.lastF ? outF(n.lastF) : n.e._f;
  if(n.k === 'rail') return 'TRUE';
  return n.e && n.e._f;
}
function fupMeasure(n){
  switch(n.k){
    case 'leaf': case 'rail': n.h = 1; n.d = 0; break;
    case 'edge': case 'cmp': n.h = 2; n.d = 1; break;
    case 'tbox': fupMeasure(n.inp); n.h = Math.max(n.inp.h, 3); n.d = 1 + (n.inp.k === 'leaf' || n.inp.k === 'rail' ? 0 : n.inp.d); break;
    default: n.kids.forEach(fupMeasure); n.h = Math.max(2, n.kids.reduce((a, c) => a + c.h, 0)); n.d = 1 + Math.max(0, ...n.kids.map(c => c.k === 'leaf' || c.k === 'rail' ? 0 : c.d));
  }
  return n;
}
function drawFup(n, ni, sel, flow){
  // linker Rand so breit, dass der längste Operand nicht abgeschnitten wird
  const names = []; (function walk(x){ if(!x || typeof x !== 'object') return; if(Array.isArray(x)){ x.forEach(walk); return; } if(x.t === 'c' && typeof x.v === 'string') names.push(x.v); if(x.t === 'cmp'){ names.push(String(x.a)); names.push(String(x.b)); } if(x.items) walk(x.items); if(x.e) walk(x.e); })(n.expr);
  const LWX = Math.max(LW, 60 + 7 * Math.max(0, ...names.map(v => v === '?' ? PH.length : v.length)));
  const parts = [];
  const selPath = sel && sel.net === ni ? sel : null;
  const isSel = (kind, id) => selPath && selPath.kind === kind && String(selPath.id) === String(id);
  const val = v => flow ? (v === 'TRUE' ? true : flow[v]) : undefined;
  const lcls = v => { const x = val(v); return x === true ? ' on' : ''; };
  const line = (x1, y1, x2, y2, c) => parts.push('<line class="kw' + (c || '') + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>');
  const text = (x, y, t, cls, anchor) => parts.push('<text class="' + (cls || 'kl') + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '">' + svgT(t) + '</text>');
  const hit = (x, y, w, h, kind, id) => parts.push('<rect class="khit' + (isSel(kind, id) ? ' ksel' : '') + '" data-net="' + ni + '" data-kind="' + kind + '" data-id="' + id + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5"/>');
  const tree = n.expr ? fupMeasure(fupTree(n.expr, [])) : fupMeasure({ k:'rail', path:[] });
  const depth = tree.k === 'leaf' || tree.k === 'rail' ? 0 : tree.d;
  const X0 = LWX + depth * (BW + GAP) + GAP;           // rechte Kante des Wurzel-Knotens (= Ausgang)
  // Aufruf-Box: Höhe nach Anzahl Parameterzeilen (13 px), Breite nach längster Zeile
  const callLines = o => o.args.map(a => a.d === ':=' ? a.n + ' := ' + a.v : a.n + ' => ' + a.v);
  const outRows = o => o.t === 'coil' ? 1 : o.t === 'call' ? Math.max(2, Math.ceil((40 + o.args.length * 13) / RH)) : o.k === 'SR' || o.k === 'RS' ? 2 : o.args && o.args.length > 3 ? 4 : 3;
  const callW = o => Math.max(150, 14 + 6 * Math.max(String(o.target).length + 2, ...callLines(o).map(t => t.length)));
  const outsH = n.outs.reduce((a, o) => a + outRows(o), 0) || 1;
  const H = Math.max(tree.h, outsH);
  const yOf = r => FPAD + r * RH + RH / 2;
  // Eingangs-Operand an einem Pin (rechts bündig am Pin)
  function operand(node, pinX, y){
    const e = node.e, open = e.v === '?', id = node.path.join('.');
    const v = val(e.v), onPin = v === undefined ? '' : ((e.neg ? !v : v) ? ' on' : '');
    line(pinX - 44, y, pinX - (e.neg ? 7 : 0), y, onPin);
    if(e.neg) parts.push('<circle class="kneg' + onPin + '" cx="' + (pinX - 4) + '" cy="' + y + '" r="4"/>');
    text(pinX - 48, y + 4, open ? PH : e.v, 'kl' + (open ? ' kred' : ''), 'end');
    if(flow && !open && typeof v === 'boolean') text(pinX - 22, y - 5, v ? '1' : '0', 'kv' + (v ? ' on' : ''));
    hit(pinX - LWX + 6, y - RH / 2 + 2, LWX - 20, RH - 4, 'e', id);
    // Klick auf den Anschluss (Pin) negiert den Eingang – wie im TIA Portal
    if(!e.edge) parts.push('<rect class="kpin" data-net="' + ni + '" data-kind="e" data-id="' + id + '" data-pin="neg" x="' + (pinX - 14) + '" y="' + (y - 7) + '" width="14" height="14" rx="3"><title>Eingang negieren</title></rect>');
  }
  // Knoten zeichnen: rechte Kante xr, Zeilen ab r0; liefert y des Ausgangs
  function draw(node, xr, r0){
    const id = node.path.join('.');
    if(node.k === 'leaf'){ const y = yOf(r0); operand(node, xr, y); return y; }
    if(node.k === 'rail'){ const y = yOf(r0); line(xr - 44, y, xr, y, flow ? ' on' : ''); text(xr - 48, y + 4, node.e ? 'immer' : '1', 'kv', 'end'); if(node.e) hit(xr - LWX + 6, y - RH / 2 + 2, LWX - 6, RH - 4, 'e', id); return y; }
    const top = FPAD + r0 * RH + 4, h = node.h * RH - 8, bx = xr - BW, yc = top + Math.min(h / 2, RH / 2 + 4);
    const fo = lcls(node.k === 'and' || node.k === 'or' || node.k === 'xor' ? outF(node) : node.e._f);
    const box = (title) => { parts.push('<rect class="kbox' + fo + '" x="' + bx + '" y="' + top + '" width="' + BW + '" height="' + h + '" rx="3"/>'); text(bx + BW / 2, top + 14, title, 'kbt'); };
    if(node.k === 'edge' || node.k === 'cmp'){
      box(node.k === 'edge' ? node.e.edge : 'CMP ' + node.e.op);
      if(node.k === 'edge'){ const y1 = yOf(r0) + 8, v = val(node.e.v); line(bx - 30, y1, bx, y1, v === true ? ' on' : ''); text(bx - 34, y1 + 4, node.e.v === '?' ? PH : node.e.v, 'kl' + (node.e.v === '?' ? ' kred' : ''), 'end'); if(flow && typeof v === 'boolean') text(bx - 16, y1 - 5, v ? '1' : '0', 'kv' + (v ? ' on' : '')); }
      else { const y1 = yOf(r0) + 8, y2 = yOf(r0 + 1); [[node.e.a, y1], [node.e.b, y2]].forEach(([op, y]) => { line(bx - 30, y, bx, y); text(bx - 34, y + 4, op === '?' ? PH : op, 'kl' + (op === '?' ? ' kred' : ''), 'end'); }); }
      hit(bx - (node.k === 'cmp' ? 90 : 4), top - 6, BW + (node.k === 'cmp' ? 94 : 8), h + 10, 'e', id);
      return yc;
    }
    if(node.k === 'tbox'){
      const e = node.e; box(e.k);
      text(bx + BW / 2, top - 3, e.inst === '?' ? PH : e.inst, 'kl' + (e.inst === '?' ? ' kred' : ''));
      const yin = draw(node.inp, bx - (node.inp.k === 'leaf' || node.inp.k === 'rail' ? 0 : GAP), r0);
      if(node.inp.k !== 'leaf' && node.inp.k !== 'rail') line(bx - GAP, yin, bx, yin, lcls(outF(node.inp))); else if(yin !== yc) {}
      text(bx + 4, yin + 4, e.k === 'CTU' ? 'CU' : e.k === 'CTD' ? 'CD' : 'IN', 'kps', 'start');
      const ps = Object.keys(e.p).map(k => k + ' ' + e.p[k]);
      ps.slice(0, 3).forEach((t, i) => text(bx + 4, top + 44 + i * 12, t, 'kps', 'start'));
      if(flow && flow[e.inst] && typeof flow[e.inst] === 'object'){ const st = flow[e.inst]; const x2 = st.ET !== undefined ? 'ET ' + (+st.ET).toFixed(1) : st.CV !== undefined ? 'CV ' + st.CV : ''; if(x2) text(bx + BW / 2, top + h - 4, x2, 'kv on'); }
      hit(bx - 2, top - 14, BW + 4, h + 16, 'e', id);
      return yin;
    }
    // Verknüpfungsbox mit Eingängen
    box(node.k === 'and' ? '&' : node.k === 'or' ? '>=1' : 'X');
    let r = r0;
    node.kids.forEach(c => {
      const direct = c.k === 'leaf' || c.k === 'rail';
      const y = draw(c, direct ? bx : bx - GAP, r);
      if(!direct){ const yp = yOf(r); line(bx - GAP, y, bx - GAP / 2, y, lcls(outF(c))); line(bx - GAP / 2, y, bx - GAP / 2, yp, lcls(outF(c))); line(bx - GAP / 2, yp, bx, yp, lcls(outF(c))); }
      r += c.h;
    });
    hit(bx + 2, top + 18, BW - 4, Math.max(14, h - 22), 'e', id);
    // Stern unten links: weiteren Eingang hinzufügen (TIA: „*“)
    parts.push('<text class="kstar" x="' + (bx + 6) + '" y="' + (top + h - 4) + '">*</text><rect class="kpin kstarhit" data-net="' + ni + '" data-kind="e" data-id="' + id + '" data-pin="addin" x="' + (bx + 1) + '" y="' + (top + h - 16) + '" width="16" height="15" rx="3"><title>Eingang hinzufügen</title></rect>');
    return yc;
  }
  const yRoot = draw(tree, X0 - GAP, 0);
  const rootDirect = tree.k === 'leaf' || tree.k === 'rail';
  const F = n._f || 'TRUE', fc = lcls(F);
  if(!rootDirect) line(X0 - GAP, yRoot, X0, yRoot, fc);
  // Ausgänge (Zuweisung, S, R, SR/RS, Boxen, Aufruf)
  let oy = 0; const xo = X0 + GAP;
  line(X0, yRoot, xo - 6, yRoot, fc);
  n.outs.forEach((o, k) => {
    const rows = outRows(o);
    const y = yOf(oy), top = FPAD + oy * RH + 4, h = rows * RH - 8;
    if(oy > 0){ line(X0 + GAP / 2, yRoot, X0 + GAP / 2, y, fc); line(X0 + GAP / 2, y, xo, y, fc); } else line(xo - 6, yRoot, xo, y, fc);
    if(o.t === 'coil'){
      const open = o.v === '?', v = val(o.v);
      parts.push('<rect class="kbox' + fc + '" x="' + xo + '" y="' + (y - 12) + '" width="34" height="24" rx="3"/>');
      text(xo + 17, y + 5, o.mode === 'S' ? 'S' : o.mode === 'R' ? 'R' : '=', 'kbt');
      if(o.mode === 'NOT') parts.push('<circle class="kneg' + fc + '" cx="' + (xo - 4) + '" cy="' + y + '" r="4"/>');
      text(xo + 40, y + 4, open ? PH : o.v, 'kl' + (open ? ' kred' : ''), 'start');
      if(flow && !open && typeof v === 'boolean') text(xo + 17, y - 15, v ? '1' : '0', 'kv' + (v ? ' on' : ''));
      parts.push('<rect class="khit' + (isSel('o', k) ? ' ksel' : '') + '" data-net="' + ni + '" data-kind="o" data-id="' + k + '" x="' + (xo - 6) + '" y="' + (y - 14) + '" width="' + (48 + Math.max(4, String(o.v).length) * 7) + '" height="' + (RH - 2) + '" rx="5"/>');
    } else {
      const title = o.t === 'call' ? (o.target === '?' ? PH : o.target) : o.k;
      const bw = o.t === 'call' ? callW(o) : 92;
      parts.push('<rect class="kbox' + fc + '" x="' + xo + '" y="' + top + '" width="' + bw + '" height="' + h + '" rx="3"/>');
      text(xo + bw / 2, top + 14, title, 'kbt' + (o.t === 'call' && o.target === '?' ? ' kred' : ''));
      text(xo + 4, y + 4, 'EN', 'kps', 'start');
      let lines2;
      if(o.t === 'call') lines2 = callLines(o);
      else if(o.k === 'SR' || o.k === 'RS') lines2 = ['R: ' + o.args[1], 'Q: ' + o.args[0]];
      else { const names = { MOVE:['IN','OUT'], INC:['IN/OUT'], DEC:['IN/OUT'], NORM_X:['MIN','VALUE','MAX','OUT'], SCALE_X:['MIN','VALUE','MAX','OUT'] }[o.k] || ['IN1','IN2','OUT']; lines2 = o.args.map((a, i) => names[i] + ' ' + a); }
      lines2.forEach((t, i) => text(xo + 6, top + 34 + i * 13, t, 'kps' + (/\?\?|\s\?$|: \?$/.test(t) ? ' kred' : ''), 'start'));
      parts.push('<rect class="khit' + (isSel('o', k) ? ' ksel' : '') + '" data-net="' + ni + '" data-kind="o" data-id="' + k + '" x="' + (xo - 4) + '" y="' + (top - 4) + '" width="' + (bw + 8) + '" height="' + (h + 8) + '" rx="5"/>');
    }
    oy += rows;
  });
  const longest = Math.max(0, ...n.outs.filter(o => o.t === 'coil').map(o => o.v === '?' ? PH.length : String(o.v).length));
  const W = xo + Math.max(Math.max(0, ...n.outs.filter(o => o.t === 'call').map(o => callW(o) + 14)), n.outs.some(o => o.t === 'op') ? 110 : 0, 48 + longest * 7) + 10;
  const hh = FPAD * 2 + H * RH;
  return '<svg class="kop-svg fup-svg" width="' + W + '" height="' + hh + '" viewBox="0 0 ' + W + ' ' + hh + '" role="img" aria-label="Netzwerk ' + (ni + 1) + '">' + parts.join('') + '</svg>';
}

// Statische Darstellung (Theorie, Handbuch, Lösungsvergleich)
function renderStatic(src, flow, flavor){
  flavor = flavor || DEFAULT_FLAVOR;
  let prog;
  const fr = K.splitBlock(src);
  if(fr && K.isKopBody(fr.body)){ try{ prog = K.parse(fr.body); K.toSCL(prog, { dry:true }); }catch(e){ return '<pre class="code">' + esc(src) + '</pre>'; }
    if(K.isExtended && K.isExtended(prog)) return '<pre class="code">' + esc(src) + '</pre>';   // erweiterte Textformen (mehrere Strompfade, Drähte …): als Text
    return '<pre class="code kop-head">' + esc(fr.head.trim()) + '</pre>' + renderStatic(fr.body, flow, flavor) + '<pre class="code kop-head">' + esc(fr.foot.trim()) + '</pre>'; }
  if(/^\s*(TYPE|DATA_BLOCK|FUNCTION|ORGANIZATION_BLOCK)/im.test(src)) return '<pre class="code">' + esc(src) + '</pre>';
  try{ prog = K.parse(src); K.toSCL(prog, { dry:true }); }catch(e){ return '<pre class="code">' + esc(src) + '</pre>'; }
  if(K.isExtended && K.isExtended(prog)) return '<pre class="code">' + esc(src) + '</pre>';
  return '<div class="kop-static">' + prog.networks.map((n, i) => '<div class="kop-net"><div class="kop-nethead"><b>Netzwerk ' + (i + 1) + '</b> ' + esc(n.title || '') + '</div><div class="kop-scroll">' + (flavor === 'fup' ? drawFup : drawNet)(n, i, null, flow || null) + '</div></div>').join('') + '</div>';
}

/* ---------- Editor ---------- */
function attach(textEditor, opts){
  opts = opts || {};
  const FUP = (opts.flavor || DEFAULT_FLAVOR) === 'fup', draw = FUP ? drawFup : drawNet, LANG = FUP ? 'FUP' : 'KOP';
  // opts.body / toolsBar / symBar / varList: eigene Elemente (Engineering-Laptop der Sensorwerkstatt); ohne Angabe die Elemente der Spielhülle
  const body = opts.body || document.getElementById('editorBody');
  const wrap = document.createElement('div'); wrap.className = 'kop-wrap'; wrap.id = 'kopWrap';
  wrap.innerHTML = '<div class="kop-tools" id="kopTools" role="toolbar" aria-label="Netzwerk bearbeiten"></div><div class="kop-lib" id="kopLib" hidden></div><div class="kop-props" id="kopProps"></div><div class="kop-canvas" id="kopCanvas" tabindex="0" aria-label="' + (FUP ? 'Funktionsplan' : 'Kontaktplan') + '"></div>';
  body.parentNode.insertBefore(wrap, body);
  const tools = wrap.querySelector('#kopTools'), props = wrap.querySelector('#kopProps'), canvas = wrap.querySelector('#kopCanvas'), lib = wrap.querySelector('#kopLib');
  const toggle = document.createElement('button'); toggle.className = 'tool-btn'; toggle.id = 'kopViewBtn'; toggle.title = 'Zwischen ' + (FUP ? 'Funktionsplan' : 'Kontaktplan') + ' und Textansicht wechseln';
  const toolsBar = opts.toolsBar || document.querySelector('.editor-tools'); toolsBar.insertBefore(toggle, toolsBar.firstChild);
  let prog = { networks: [] }, sel = null, mode = 'graph', flow = null, errNet = 0, errMsg = '', parseErr = null, symbols = [], readOnly = false;
  let frame = null, noGraph = false, extended = false, callables = {};   // Profi: Bausteinkopf/-ende um die Netzwerke; Aufrufziele mit Parametern
  const symBar = opts.symBar !== undefined ? opts.symBar : document.getElementById('symBar');

  function setMode(m){
    mode = m;
    body.style.display = m === 'text' ? '' : 'none'; wrap.style.display = m === 'graph' ? '' : 'none';
    if(symBar) symBar.style.display = m === 'text' ? '' : 'none';
    toggle.innerHTML = m === 'graph' ? '<i class="fa-solid fa-code"></i> <span class="btn-text">Text</span>' : '<i class="fa-solid fa-diagram-project"></i> <span class="btn-text">' + LANG + '</span>';
    if(m === 'graph') loadFromText(); else textEditor.refresh && textEditor.refresh();
  }
  toggle.addEventListener('click', () => setMode(mode === 'graph' ? 'text' : 'graph'));
  function readFrame(txt){
    frame = K.splitBlock(txt);
    noGraph = !frame && /^\s*(TYPE|DATA_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/im.test(txt) || !!(frame && !K.isKopBody(frame.body));
  }
  function loadFromText(){
    const txt = textEditor.getValue(); readFrame(txt);
    if(noGraph){ parseErr = null; extended = false; prog = { networks: [] }; render(); return; }
    try{ prog = frame ? K.parse(frame.body, { lineOffset: frame.offset }) : K.parse(txt); parseErr = null; }
    catch(e){ parseErr = e; }
    // Formen, die dieser Editor nicht zeichnen kann (mehrere Strompfade je Netzwerk, Drähte, NOT (…), Box mit IN:= …): Textansicht
    extended = !parseErr && !!(K.isExtended && K.isExtended(prog));
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
    if(extended){
      canvas.innerHTML = '<div class="kop-err kop-info"><i class="fa-solid fa-circle-info"></i> Dieses Programm nutzt Textformen, die die grafische Ansicht nicht zeichnen kann (z. B. mehrere Strompfade in einem Netzwerk, Drähte $…, NOT ( … ) oder eine Box mit IN:=). Es wird in der <b>Textansicht</b> bearbeitet und funktioniert normal.</div>';
      tools.innerHTML = ''; props.innerHTML = ''; return;
    }
    if(parseErr){
      canvas.innerHTML = '<div class="kop-err"><i class="fa-solid fa-triangle-exclamation"></i> Die Textansicht enthält einen Fehler (' + esc(K.words(parseErr.message)) + '). Korrigiere ihn in der Textansicht.</div>';
      tools.innerHTML = ''; props.innerHTML = ''; return;
    }
    try{ K.toSCL(prog, { dry:true }); }catch(e){}
    canvas.innerHTML = prog.networks.map((n, i) =>
      '<div class="kop-net' + (errNet === i + 1 ? ' kop-neterr' : '') + (sel && sel.net === i ? ' kop-netsel' : '') + '" data-net="' + i + '">' +
      '<div class="kop-nethead" data-net="' + i + '" data-kind="n"><b>Netzwerk ' + (i + 1) + '</b> <span class="kop-title">' + esc(n.title || '') + '</span>' +
      (errNet === i + 1 && errMsg ? '<span class="kop-errmsg">' + esc(errMsg) + '</span>' : '') + '</div>' +
      '<div class="kop-scroll">' + draw(n, i, sel, flow) + '</div></div>').join('') +
      (readOnly ? '' : '<button class="tool-btn kop-addnet" data-act="addnet"><i class="fa-solid fa-plus"></i> Netzwerk</button>');
    renderTools();
  }
  const B = (act, icon, label, dis, title) => '<button class="tool-btn" data-act="' + act + '"' + (dis ? ' disabled' : '') + ' title="' + esc(title || label) + '"><i class="fa-solid ' + icon + '"></i> <span>' + label + '</span></button>';
  function renderTools(){
    if(readOnly){ tools.innerHTML = '<span class="kop-hint">Nur ansehen</span>'; props.innerHTML = ''; return; }
    const s = selected();
    let h = '';
    if(FUP){ tools.innerHTML = libBtn() + '<span class="kop-fav" title="Favoriten">★</span>' + fupTools(s); renderProps(s); renderLib(s); return; }
    if(!s){ h = ''; }   // Hinweis steht in der Eigenschaftenzeile
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
    tools.innerHTML = libBtn() + h;
    renderProps(s); renderLib(s);
  }
  // FUP: Palette (auch zum Ziehen auf einen Eingang) — aktiv, soweit zur Auswahl passend
  const D = (act, label, ok, title) => '<button class="tool-btn fpal" draggable="true" data-act="' + act + '"' + (ok ? '' : ' disabled') + ' title="' + esc(title || label) + '">' + label + '</button>';
  function fupTools(s){
    const e = s && s.e, o = s && s.o, isBox = e && (e.t === 's' || e.t === 'p' || e.t === 'x') && e.items.length, leafIn = e && !isBox;
    const rail = e && e.t === 's' && !e.items.length;
    let h = '';   // Bedienhinweis steht in der festen Eigenschaftenzeile (kein Springen der Zeichnung)
    h += D('ser', '&amp;', leafIn || isBox, 'UND-Box: Eingang mit einem weiteren Eingang verknüpfen') + D('par', '&gt;=1', leafIn || isBox, 'ODER-Box') + D('xor', 'X', leafIn || isBox, 'XOR-Box (exklusiv)');
    h += D('addin', '+ Eingang', isBox, 'Weiteren Eingang an diese Box') + D('nc', '○ negieren', e && e.t === 'c' && !e.edge, 'Eingang negieren (Kreis)');
    h += '<span class="kop-sep"></span>' + D('edge', 'P/N', e && e.t === 'c', 'Flankenauswertung P (0→1) / N (1→0)') + D('ton', 'Timer', leafIn || isBox, 'Zeitglied: dieser Eingang wird IN') + D('ctu', 'Zähler', leafIn || isBox, 'Zähler: dieser Eingang wird CU') + D('cmp', 'CMP', leafIn || isBox, 'Vergleicher');
    h += D('rail', 'immer', e && s.path.length === 0 && !rail, 'Keine Bedingung: Ausgang immer aktiv') + D('del', '🗑', e && !rail, 'Löschen');
    h += '<span class="kop-sep"></span>' + D('coil', '=', o, 'Zuweisung') + D('set', 'S', o, 'Setzen') + D('reset', 'R', o, 'Rücksetzen') + D('ncoil', '○=', o, 'Zuweisung negiert') + D('sr', 'SR', o, 'Flipflop, Rücksetzen dominant') + D('rs', 'RS', o, 'Flipflop, Setzen dominant');
    h += D('move', 'MOVE', o) + D('add', 'Rechnen', o) + (Object.keys(callables).length ? D('call', 'Aufruf', o, 'Baustein aufrufen') : '') + D('addout', '+ Ausgang', o, 'Weitere Zuweisung am selben Ausgang') + D('delout', '🗑 Ausgang', o && s.n.outs.length > 1);
    if(s && s.n && !s.e && !s.o) h += '<span class="kop-sep"></span>' + D('up', '↑ Netzwerk', sel.net > 0) + D('down', '↓ Netzwerk', sel.net < prog.networks.length - 1) + D('delnet', '🗑 Netzwerk', prog.networks.length > 1);
    return h;
  }
  // Anweisungs-Palette mit Ordnern (wie „Anweisungen“ im TIA Portal); die Werkzeugleiste darüber ist die Favoritenleiste
  const LIB = FUP ? [
    ['Bitverknüpfungen', [['ser', '&amp; UND'], ['par', '&gt;=1 ODER'], ['xor', 'X XOR'], ['addin', '* Eingang hinzufügen'], ['nc', '○ Eingang negieren'], ['edge', 'P/N Flanke'], ['coil', '= Zuweisung'], ['ncoil', '○= Zuweisung negiert'], ['set', 'S Setzen'], ['reset', 'R Rücksetzen'], ['sr', 'SR Flipflop'], ['rs', 'RS Flipflop'], ['rail', 'immer (ohne Bedingung)']]],
    ['Zeiten', [['ton', 'TON Einschaltverzögerung'], ['tof', 'TOF Ausschaltverzögerung'], ['tp', 'TP Impuls']]],
    ['Zähler', [['ctu', 'CTU Vorwärtszähler'], ['ctd', 'CTD Rückwärtszähler']]],
    ['Vergleicher', [['cmp', 'CMP Vergleich']]],
    ['Übertragen', [['move', 'MOVE']]],
    ['Mathematik', [['add', 'ADD'], ['sub', 'SUB'], ['mul', 'MUL'], ['div', 'DIV'], ['inc', 'INC'], ['dec', 'DEC'], ['norm', 'NORM_X'], ['scale', 'SCALE_X']]],
    ['Programmsteuerung', [['call', 'Aufruf (FC/FB)']]],
    ['Netzwerk', [['addnet', '+ Netzwerk'], ['addout', '+ Ausgang'], ['del', 'Element löschen'], ['delout', 'Ausgang löschen']]]
  ] : [
    ['Bitverknüpfungen', [['ser', '─┤ ├─ Kontakt in Reihe'], ['par', 'Parallelzweig'], ['nc', '─┤/├─ Öffner/Schliesser'], ['edge', 'P/N Flanke'], ['coil', '─( )─ Spule'], ['ncoil', '─(/)─ Spule negiert'], ['set', '─(S)─ Setzen'], ['reset', '─(R)─ Rücksetzen'], ['rail', 'ohne Bedingung']]],
    ['Zeiten', [['ton', 'TON Einschaltverzögerung'], ['tof', 'TOF Ausschaltverzögerung'], ['tp', 'TP Impuls']]],
    ['Zähler', [['ctu', 'CTU Vorwärtszähler'], ['ctd', 'CTD Rückwärtszähler']]],
    ['Vergleicher', [['cmp', 'CMP Vergleichskontakt']]],
    ['Übertragen', [['move', 'MOVE']]],
    ['Mathematik', [['add', 'ADD'], ['sub', 'SUB'], ['mul', 'MUL'], ['div', 'DIV'], ['inc', 'INC'], ['dec', 'DEC']]],
    ['Programmsteuerung', [['call', 'Aufruf (FC/FB)']]],
    ['Netzwerk', [['addnet', '+ Netzwerk'], ['addout', '+ Spule'], ['del', 'Element löschen'], ['delout', 'Spule löschen']]]
  ];
  function libAllowed(a, s){
    const e = s && s.e, o = s && s.o, isBox = e && (e.t === 's' || e.t === 'p' || e.t === 'x') && e.items.length;
    const leaf = e && (FUP ? !isBox : ((e.t !== 's' && e.t !== 'p') || (e.t === 's' && !e.items.length))), rail = e && e.t === 's' && !e.items.length;
    switch(a){
      case 'addnet': return true;
      case 'ser': case 'ton': case 'tof': case 'tp': case 'ctu': case 'ctd': case 'cmp': return FUP ? !!(leaf || isBox) : !!leaf;
      case 'par': case 'xor': return FUP ? !!(leaf || isBox) : !!e;
      case 'addin': return !!isBox;
      case 'nc': return !!(e && e.t === 'c' && !e.edge);
      case 'edge': return !!(e && e.t === 'c');
      case 'rail': return !!(e && s.path.length === 0 && !rail);
      case 'del': return !!(e && !rail);
      case 'call': return !!o && Object.keys(callables).length > 0;
      case 'delout': return !!o && s.n.outs.length > 1;
      default: return !!o;   // Ausgänge und Boxen am Ausgang
    }
  }
  let libOpen = false;
  function renderLib(s){
    lib.hidden = !libOpen || readOnly; if(lib.hidden) return;
    const open = JSON.parse(lib.dataset.open || '{}');
    lib.innerHTML = '<div class="kop-lib-head">Anweisungen <span class="kop-hint">– antippen oder auf einen Eingang ziehen</span></div>' + LIB.map(([f, items]) => '<details data-f="' + esc(f) + '"' + (open[f] !== false ? ' open' : '') + '><summary>📁 ' + esc(f) + '</summary><div class="kop-lib-items">'
      + items.map(([a, l]) => '<button class="tool-btn fpal" draggable="' + (FUP ? 'true' : 'false') + '" data-act="' + a + '"' + (libAllowed(a, s) ? '' : ' disabled') + '>' + l + '</button>').join('') + '</div></details>').join('');
  }
  lib.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details'); if(!d) return; const o = JSON.parse(lib.dataset.open || '{}'); o[d.dataset.f] = d.open; lib.dataset.open = JSON.stringify(o); }, true);
  lib.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(b && !b.disabled) act(b.dataset.act); });
  lib.addEventListener('dragstart', ev => { const b = ev.target.closest && ev.target.closest('[data-act]'); if(b){ ev.dataTransfer.setData('text/plain', 'act:' + b.dataset.act); ev.dataTransfer.effectAllowed = 'copy'; } });
  const libBtn = () => '<button class="tool-btn kop-libbtn' + (libOpen ? ' on' : '') + '" data-lib="1" aria-expanded="' + libOpen + '" title="Anweisungs-Palette mit Ordnern ein-/ausblenden"><i class="fa-solid fa-folder-tree"></i> <span>Anweisungen</span></button>';
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
      h = '<label class="kop-f">Box <select data-k="k">' + ['MOVE','ADD','SUB','MUL','DIV','INC','DEC','NORM_X','SCALE_X'].map(o => '<option' + (o === s.o.k ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></label>';
      const names = { MOVE:['IN','OUT'], INC:['IN/OUT'], DEC:['IN/OUT'], NORM_X:['MIN','VALUE','MAX','OUT'], SCALE_X:['MIN','VALUE','MAX','OUT'] }[s.o.k] || ['IN1','IN2','OUT'];
      s.o.args.forEach((a, i) => { h += field(names[i], 'a' + i, a, 90); });
    }
    else if(s && s.n && !s.e && !s.o) h = '<label class="kop-f">Titel <input data-k="title" value="' + esc(s.n.title || '') + '" style="width:220px"></label>';
    // Zeile bleibt immer stehen (kein Springen der Zeichnung beim Antippen); ohne Auswahl ein Bedienhinweis
    props.innerHTML = h ? h + dl() : (readOnly || noGraph || extended ? '' : '<span class="kop-hint"><i class="fa-solid fa-hand-pointer"></i> ' + (FUP ? 'Eingang oder Box antippen — oder eine Box / Variable auf einen Eingang ziehen. ' : 'Element antippen, um es zu bearbeiten. ') + 'Doppelklick: Operand eintippen · Rechtsklick: Befehle' + (FUP ? ' · Anschluss antippen: negieren · * an der Box: Eingang dazu' : '') + '</span>');
    props.style.display = props.innerHTML ? '' : 'none';
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
      case 'ser': if(FUP && s.e && s.e.t === 's' && s.e.items.length){ s.e.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.concat(s.e.items.length - 1).join('.') }; } else insertSeriesAfter(s, newContact()); break;
      case 'xor': {
        const par = parentOf(s.n, s.path);
        if(s.e.t === 'x'){ s.e.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.concat(s.e.items.length - 1).join('.') }; }
        else if(par && par.t === 'x'){ par.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.slice(0, -1).concat(par.items.length - 1).join('.') }; }
        else { replaceAt(s.n, s.path, x => ({ t:'x', items:[x, newContact()] })); sel = { net: ni, kind:'e', id: s.path.concat(1).join('.') }; }
        break;
      }
      case 'addin': s.e.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.concat(s.e.items.length - 1).join('.') }; break;
      case 'sr': case 'rs': { const q = s.o.t === 'coil' ? s.o.v : (s.o.args && s.o.args[0]) || '?'; s.n.outs[s.k] = { t:'op', k: a.toUpperCase(), args:[q || '?', '?'] }; break; }
      case 'par': {
        const par = parentOf(s.n, s.path);
        if(FUP && s.e.t === 'p' && s.e.items.length){ s.e.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.concat(s.e.items.length - 1).join('.') }; }
        else if(par && par.t === 'p'){ par.items.push(newContact()); sel = { net: ni, kind:'e', id: s.path.slice(0, -1).concat(par.items.length - 1).join('.') }; }
        else { replaceAt(s.n, s.path, x => ({ t:'p', items:[x, newContact()] })); sel = { net: ni, kind:'e', id: s.path.concat(1).join('.') }; }
        break;
      }
      case 'rail': s.n.expr = { t:'s', items:[] }; sel = { net: ni, kind:'e', id:'' }; break;
      case 'nc': s.e.neg = !s.e.neg; break;
      case 'edge': s.e.edge = s.e.edge === 'P' ? 'N' : s.e.edge === 'N' ? undefined : 'P'; if(s.e.edge) s.e.neg = false; if(!s.e.edge) delete s.e.edge; break;
      case 'ton': insertSeriesAfter(s, { t:'box', k:'TON', inst: nextInst(prog, 'T'), p:{ PT:'T#1S' } }); break;
      case 'tof': case 'tp': insertSeriesAfter(s, { t:'box', k: a.toUpperCase(), inst: nextInst(prog, 'T'), p:{ PT:'T#1S' } }); break;
      case 'ctd': insertSeriesAfter(s, { t:'box', k:'CTD', inst: nextInst(prog, 'Z'), p:{ PV:'5' } }); break;
      case 'sub': case 'mul': case 'div': s.n.outs[s.k] = { t:'op', k: a.toUpperCase(), args:['?', '?', '?'] }; break;
      case 'inc': case 'dec': s.n.outs[s.k] = { t:'op', k: a.toUpperCase(), args:['?'] }; break;
      case 'norm': case 'scale': s.n.outs[s.k] = { t:'op', k: a === 'norm' ? 'NORM_X' : 'SCALE_X', args:['?', '?', '?', '?'] }; break;
      case 'ctu': insertSeriesAfter(s, { t:'box', k:'CTU', inst: nextInst(prog, 'Z'), p:{ PV:'5' } }); break;
      case 'cmp': if(FUP && s.e && s.e.t === 'c' && s.e.v === '?'){ replaceAt(s.n, s.path, () => ({ t:'cmp', a:'?', op:'>', b:'0' })); break; } insertSeriesAfter(s, { t:'cmp', a:'?', op:'>', b:'0' }); break;
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
  tools.addEventListener('click', e => { if(e.target.closest('[data-lib]')){ libOpen = !libOpen; renderTools(); return; } const b = e.target.closest('[data-act]'); if(b && !b.disabled) act(b.dataset.act); });
  // FUP: Ziehen + verbinden — Box aus der Palette oder Variable aus der Liste auf einen Eingang/Ausgang ziehen
  if(FUP){
    const allowed = a => libAllowed(a, selected());
    tools.addEventListener('dragstart', ev => { const b = ev.target.closest && ev.target.closest('[data-act]'); if(b){ ev.dataTransfer.setData('text/plain', 'act:' + b.dataset.act); ev.dataTransfer.effectAllowed = 'copy'; } });
    const vl = opts.varList || document.getElementById('varList');
    if(vl){ const mk = () => vl.querySelectorAll('.var-chip').forEach(c => { c.draggable = true; }); new MutationObserver(mk).observe(vl, { childList:true }); mk();
      vl.addEventListener('dragstart', ev => { const c = ev.target.closest && ev.target.closest('.var-chip'); if(c){ ev.dataTransfer.setData('text/plain', 'var:' + c.dataset.name); ev.dataTransfer.effectAllowed = 'copy'; } }); }
    canvas.addEventListener('dragover', ev => { if(!readOnly && ev.target.closest && ev.target.closest('[data-kind]')){ ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
    canvas.addEventListener('drop', ev => {
      const h = ev.target.closest && ev.target.closest('[data-kind]'); if(!h || readOnly) return;
      ev.preventDefault();
      const d = ev.dataTransfer.getData('text/plain') || '';
      sel = { net: +h.dataset.net, kind: h.dataset.kind, id: h.dataset.id || '' };
      if(d.startsWith('var:')){ if(!assignVar(d.slice(4))) render(); }
      else if(d.startsWith('act:')){ const a2 = d.slice(4); if(allowed(a2)) act(a2); else { render(); opts.onNoSelection && opts.onNoSelection(); } }
      else render();
    });
  }
  canvas.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(b){ if(!readOnly) act(b.dataset.act); return; }
    const pin = e.target.closest('[data-pin]');
    if(pin && !readOnly){ sel = { net: +pin.dataset.net, kind: pin.dataset.kind, id: pin.dataset.id || '' }; act(pin.dataset.pin === 'neg' ? 'nc' : 'addin'); return; }
    const h = e.target.closest('[data-kind]');
    if(h){ sel = { net: +h.dataset.net, kind: h.dataset.kind, id: h.dataset.id || '' }; }
    else sel = null;
    render();
    // Doppelklick (zweiter Klick auf dasselbe Element innerhalb 450 ms) → Operand eintippen; die Zeichnung wird bei jedem Klick neu aufgebaut
    const key = h ? h.dataset.net + '|' + h.dataset.kind + '|' + (h.dataset.id || '') : '', now = Date.now();
    if(h && !readOnly && lastClick.key === key && now - lastClick.t < 450){ lastClick = { key: '', t: 0 }; openInline(canvas.querySelector('.ksel')); return; }
    lastClick = { key, t: now };
  });
  // Operand direkt in der Box eintippen (Doppelklick, Enter oder F2) – mit Autovervollständigung aus den PLC-Variablen
  const symList = () => { const vl = opts.varList || document.getElementById('varList'); const fromList = vl ? [...vl.querySelectorAll('.var-chip')].map(c => c.dataset.name) : []; return [...new Set(symbols.concat(fromList))]; };
  let inline = null;
  function closeInline(){ if(inline){ inline.remove(); inline = null; } }
  function openInline(target){
    const s = selected(); if(!s || readOnly) return;
    const field = s.e && s.e.t === 'c' ? 'v' : s.e && s.e.t === 'cmp' ? (s.e.a === '?' ? 'a' : 'b') : s.e && s.e.t === 'box' ? 'inst' : s.o && s.o.t === 'coil' ? 'v' : s.o && s.o.t === 'call' ? 'target' : null;
    if(!field) return;
    const tgt = s.e || s.o, cur = tgt[field] === '?' ? '' : tgt[field];
    const hitEl = target || canvas.querySelector('.ksel'); if(!hitEl) return;
    const r = hitEl.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    closeInline();
    inline = document.createElement('div'); inline.className = 'kop-inline';
    inline.style.left = Math.max(0, r.left - c.left + canvas.scrollLeft) + 'px'; inline.style.top = Math.max(0, r.top - c.top + canvas.scrollTop - 4) + 'px';
    inline.innerHTML = '<input type="text" value="' + esc(cur) + '" list="kopInlineVars" aria-label="Operand eingeben" autocomplete="off" spellcheck="false" placeholder="' + esc(PH) + '"><datalist id="kopInlineVars">' + (field === 'target' ? Object.keys(callables) : symList()).map(n => '<option value="' + esc(n) + '">').join('') + '</datalist>';
    canvas.appendChild(inline);
    const inp = inline.querySelector('input'); inp.focus(); inp.select();
    let done = false;
    const apply = ok => { if(done) return; done = true; const v = inp.value.trim(); closeInline(); if(ok && v){ const s2 = selected(); const t2 = s2 && (s2.e || s2.o); if(t2){ t2[field] = v; commit(); } } else render(); canvas.focus(); };
    inp.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); apply(true); } else if(ev.key === 'Escape'){ ev.preventDefault(); apply(false); } ev.stopPropagation(); });
    inp.addEventListener('blur', () => setTimeout(() => apply(true), 120));
  }
  let lastClick = { key: '', t: 0 };
  // Rechtsklick-Menü: alle Befehle, die zur Auswahl passen
  let ctxMenu = null;
  const closeCtx = () => { if(ctxMenu){ ctxMenu.remove(); ctxMenu = null; } };
  document.addEventListener('click', e => { if(ctxMenu && !ctxMenu.contains(e.target)) closeCtx(); });
  canvas.addEventListener('contextmenu', e => {
    const h = e.target.closest('[data-kind]'); if(!h || readOnly) return;
    e.preventDefault(); closeCtx();
    sel = { net: +h.dataset.net, kind: h.dataset.kind, id: h.dataset.id || '' }; render();
    const items = [...tools.querySelectorAll('[data-act]:not([disabled])')].map(b => ({ act: b.dataset.act, label: b.textContent.trim() || b.title, title: b.title }));
    const s = selected(), canType = s && ((s.e && ['c', 'cmp', 'box'].includes(s.e.t)) || (s.o && (s.o.t === 'coil' || s.o.t === 'call')));
    ctxMenu = document.createElement('div'); ctxMenu.className = 'kop-ctx'; ctxMenu.setAttribute('role', 'menu');
    ctxMenu.innerHTML = (canType ? '<button role="menuitem" data-ctx="type">Operand eingeben … <kbd>F2</kbd></button>' : '') + items.map(x => '<button role="menuitem" data-ctx="' + esc(x.act) + '" title="' + esc(x.title) + '">' + esc(x.title && x.title.length < 40 ? x.title : x.label) + '</button>').join('');
    document.body.appendChild(ctxMenu);
    const W = ctxMenu.offsetWidth, H2 = ctxMenu.offsetHeight;
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - W - 8) + 'px'; ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - H2 - 8) + 'px';
    ctxMenu.addEventListener('click', ev => { const b = ev.target.closest('[data-ctx]'); if(!b) return; const a2 = b.dataset.ctx; closeCtx(); if(a2 === 'type') openInline(canvas.querySelector('.ksel')); else act(a2); });
    const f = ctxMenu.querySelector('button'); if(f) f.focus();
  });
  canvas.addEventListener('keydown', e => {
    if(readOnly) return;
    if((e.key === 'Enter' || e.key === 'F2') && sel && !e.target.closest('input')){ e.preventDefault(); openInline(canvas.querySelector('.ksel')); return; }
    if(e.key === '*' && sel && !e.target.closest('input')){ const s = selected(); if(s && s.e && ['s', 'p', 'x'].includes(s.e.t) && s.e.items.length){ e.preventDefault(); act('addin'); return; } }
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
