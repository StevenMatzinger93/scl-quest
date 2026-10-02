(function(root){
"use strict";
/* ============================================================
   FUP-Werkbank · Graphmodell (FUPGraph) — reine Logik, in Node testbar
   ------------------------------------------------------------
   Der Editor arbeitet auf einem Graphen; gespeichert wird weiter das
   Textformat aus kop.js (NETWORK Titel + "<pfad> => <ausgänge>;").

   Programm  { networks: [Netz] }
   Netz      { title, comment, collapsed, nodes: [Knoten], wires: [Draht] }
   Knoten    { id, t, x, y, ins: [Pin], outs: [Pin], opnd?, inst?, cmp?, calc?, target?, pdy? }
             t: and|or|xor|assign|set|reset|sr|rs|ton|tof|tp|ctu|ctd|cmp|move|calc|call|edgeP|edgeN|empty
   Pin       { n: Name, k: 'b'|'f'|'v'|'o', neg, op }
             b = Bool-Eingang (Draht oder Operand), f = Freigabe/Ansteuerung einer Ausgangsbox
             (Draht oder Operand), v = Wert-Eingang (nur Operand), o = Wert-Ausgang (nur Operand)
             op: null = nichts angeschlossen, '?' = Platzhalter <??.?>, sonst Operand
   Draht     { s: Quellknoten, d: Zielknoten, p: Eingangs-Index }   (ein Ausgang → mehrere Ziele = Abzweig)

   Semantik: Der Graph ist rein funktional (Ausgang = Funktion der Eingänge).
   Das Textformat hat Kontaktplan-Semantik (Zeit-/Zählerboxen bekommen den
   „Strom“ links von ihnen als IN). fromText rechnet das in den Graphen um,
   toText ordnet so an, dass die Bedeutung gleich bleibt.

   Grenzen des Textformats (kop.js bleibt unverändert, siehe docs/FUP_WERKBANK_F0.md):
   – ein Netzwerk im Text hat genau eine Verknüpfung: weitere Ketten im selben
     Netzwerk werden als eigene NETWORK-Abschnitte mit "// @fup {"k":1}" gespeichert
   – Rücksetz-/Wert-Eingänge (R1 bei SR, PT, PV, R, LD, MOVE …) nur mit Operand
   – Negation hinter Zeit-/Zähler-/Flankenbox nicht möglich (sonst De Morgan)
   – höchstens eine Zeit-/Zählerbox je &-Box-Eingang
   – Abzweig in mehrere Logikboxen: wird beim Speichern verdoppelt
   Layout steht als Kommentarzeile "// @fup {…}" im Netzwerk (kop.js überliest //).
   ============================================================ */
const K = root.KOP || (typeof require === 'function' ? require('./kop.js') : null);

/* ---------- Geometrie (gemeinsam für Layout und Zeichnung) ---------- */
const GRID = 16, PIN = 32, HEAD = 26, TOPH = 36, OPW = 128, GAP = 56;
const SINKS = new Set(['assign', 'set', 'reset', 'sr', 'rs', 'move', 'calc', 'call']);
const TIMERS = { ton:'TON', tof:'TOF', tp:'TP' }, COUNTERS = { ctu:'CTU', ctd:'CTD' };
const CALC2 = ['ADD', 'SUB', 'MUL', 'DIV'], CALC1 = ['INC', 'DEC'], CALC4 = ['NORM_X', 'SCALE_X'];
const CMPS = ['==', '<>', '>=', '<=', '>', '<'];
const LABEL = { and:'&', or:'>=1', xor:'X', assign:'=', set:'S', reset:'R', sr:'SR', rs:'RS', ton:'TON', tof:'TOF', tp:'TP', ctu:'CTU', ctd:'CTD', cmp:'CMP', move:'MOVE', calc:'', call:'', edgeP:'P', edgeN:'N', empty:'??' };
const NAME = { and:'UND-Box', or:'ODER-Box', xor:'XOR-Box', assign:'Zuweisung', set:'Setzen', reset:'Rücksetzen', sr:'SR-Speicher', rs:'RS-Speicher', ton:'Einschaltverzögerung TON', tof:'Ausschaltverzögerung TOF', tp:'Impuls TP', ctu:'Vorwärtszähler CTU', ctd:'Rückwärtszähler CTD', cmp:'Vergleicher', move:'MOVE', calc:'Rechnen', call:'Bausteinaufruf', edgeP:'Flanke positiv P', edgeN:'Flanke negativ N', empty:'leere Box' };
function boxW(n){
  switch(n.t){
    case 'and': case 'or': case 'xor': case 'empty': return 64;
    case 'assign': case 'set': case 'reset': return 48;
    case 'edgeP': case 'edgeN': return 48;
    case 'sr': case 'rs': return 64;
    case 'cmp': return 80;
    case 'call': return 160;
    default: return 96;
  }
}
const hasTop = n => ['assign', 'set', 'reset', 'sr', 'rs', 'edgeP', 'edgeN', 'ton', 'tof', 'tp', 'ctu', 'ctd', 'call'].includes(n.t);
const hasOut = n => !SINKS.has(n.t);
function pinDy(n, i){ return n.pdy && n.pdy.length === n.ins.length ? n.pdy[i] : HEAD + i * PIN + PIN / 2; }
function size(n){
  const rows = Math.max(n.ins.length, n.outs.length + (hasOut(n) ? 1 : 0), 1);
  const lastIn = n.ins.length ? pinDy(n, n.ins.length - 1) + PIN / 2 : 0;
  return { w: boxW(n), h: Math.max(HEAD + rows * PIN, lastIn) + 6 };
}
// Pin-Positionen (Welt-Koordinaten): Eingänge links, Ausgang Q/OUT rechts oben, Wert-Ausgänge rechts darunter
function inPos(n, i){ return { x: n.x, y: n.y + pinDy(n, i) }; }
function outPos(n){ return { x: n.x + boxW(n), y: n.y + HEAD + PIN / 2 }; }
function oPos(n, i){ return { x: n.x + boxW(n), y: n.y + HEAD + (i + (hasOut(n) ? 1 : 0)) * PIN + PIN / 2 }; }
const fIndex = n => n.t === 'rs' ? 1 : SINKS.has(n.t) ? 0 : -1;

/* ---------- Knoten anlegen ---------- */
const P = (n, k, op, neg) => ({ n, k, neg: !!neg, op: op === undefined ? '?' : op });
function makeNode(t, o){
  o = o || {};
  const n = { id: o.id || '', t, x: o.x || 0, y: o.y || 0, ins: [], outs: [] };
  switch(t){
    case 'and': case 'or': case 'xor': case 'empty': { const c = Math.max(2, o.inputs || 2); for(let i = 0; i < c; i++) n.ins.push(P('IN' + (i + 1), 'b')); break; }
    case 'assign': case 'set': case 'reset': n.ins.push(P(t === 'assign' ? 'IN' : t === 'set' ? 'S' : 'R', 'f')); n.opnd = '?'; break;
    case 'sr': n.ins.push(P('S', 'f'), P('R1', 'v')); n.opnd = '?'; break;
    case 'rs': n.ins.push(P('R', 'v'), P('S1', 'f')); n.opnd = '?'; break;
    case 'ton': case 'tof': case 'tp': n.ins.push(P('IN', 'b'), P('PT', 'v')); n.inst = '?'; break;
    case 'ctu': n.ins.push(P('CU', 'b'), P('R', 'v', null), P('PV', 'v')); n.inst = '?'; break;
    case 'ctd': n.ins.push(P('CD', 'b'), P('LD', 'v', null), P('PV', 'v')); n.inst = '?'; break;
    case 'cmp': n.ins.push(P('IN1', 'v'), P('IN2', 'v')); n.cmp = o.cmp || '=='; break;
    case 'edgeP': case 'edgeN': n.opnd = '?'; break;
    case 'move': n.ins.push(P('EN', 'f', null), P('IN', 'v')); n.outs.push(P('OUT1', 'o')); break;
    case 'calc': {
      const k = n.calc = (o.calc || 'ADD').toUpperCase(); n.ins.push(P('EN', 'f', null));
      if(CALC1.includes(k)) n.ins.push(P('IN_OUT', 'v'));
      else if(CALC4.includes(k)){ n.ins.push(P('MIN', 'v'), P('VALUE', 'v'), P('MAX', 'v')); n.outs.push(P('OUT', 'o')); }
      else { n.ins.push(P('IN1', 'v'), P('IN2', 'v')); n.outs.push(P('OUT', 'o')); }
      break;
    }
    case 'call': n.ins.push(P('EN', 'f', null)); n.target = o.target || '?';
      (o.params || []).forEach(p => (p.d === '=>' ? n.outs : n.ins).push(P(p.n, p.d === '=>' ? 'o' : 'v', p.v === undefined ? '?' : p.v))); break;
    default: throw new Error('Unbekannter Boxtyp ' + t);
  }
  return n;
}
// Eingetippter Boxtyp (leere Box ??) → Typ + Optionen
const TYPE_WORDS = [
  ['&', 'and'], ['AND', 'and'], ['UND', 'and'], ['>=1', 'or'], ['OR', 'or'], ['ODER', 'or'], ['X', 'xor'], ['XOR', 'xor'],
  ['=', 'assign'], ['S', 'set'], ['R', 'reset'], ['SR', 'sr'], ['RS', 'rs'], ['TON', 'ton'], ['TOF', 'tof'], ['TP', 'tp'], ['CTU', 'ctu'], ['CTD', 'ctd'],
  ['P', 'edgeP'], ['N', 'edgeN'], ['MOVE', 'move'], ['CMP==', 'cmp', { cmp:'==' }], ['CMP<>', 'cmp', { cmp:'<>' }], ['CMP>', 'cmp', { cmp:'>' }], ['CMP>=', 'cmp', { cmp:'>=' }], ['CMP<', 'cmp', { cmp:'<' }], ['CMP<=', 'cmp', { cmp:'<=' }],
  ['ADD', 'calc', { calc:'ADD' }], ['SUB', 'calc', { calc:'SUB' }], ['MUL', 'calc', { calc:'MUL' }], ['DIV', 'calc', { calc:'DIV' }], ['INC', 'calc', { calc:'INC' }], ['DEC', 'calc', { calc:'DEC' }],
  ['NORM_X', 'calc', { calc:'NORM_X' }], ['SCALE_X', 'calc', { calc:'SCALE_X' }]
];
const TYPE_HELP = { and:'UND', or:'ODER', xor:'Exklusiv-ODER', assign:'Zuweisung', set:'Setzen', reset:'Rücksetzen', sr:'Speicher, Rücksetzen dominant', rs:'Speicher, Setzen dominant', ton:'Einschaltverzögerung', tof:'Ausschaltverzögerung', tp:'Impuls', ctu:'Vorwärtszähler', ctd:'Rückwärtszähler', edgeP:'positive Flanke', edgeN:'negative Flanke', move:'Wert kopieren', cmp:'Vergleich', calc:'Rechnen' };
function typeFromWord(w){
  const s = String(w || '').trim().toUpperCase().replace(/\s+/g, '');
  const hit = TYPE_WORDS.find(x => x[0] === s) || (/^CMP?(==|<>|>=|<=|>|<)$/.test(s) ? ['', 'cmp', { cmp: s.replace(/^CMP?/, '') }] : null) || (CMPS.includes(s) && s !== '>' ? ['', 'cmp', { cmp: s }] : null);
  return hit ? { t: hit[1], o: hit[2] || {} } : null;
}
function typeSuggest(prefix){
  const s = String(prefix || '').trim().toUpperCase();
  return TYPE_WORDS.filter(x => !['AND', 'UND', 'OR', 'ODER', 'XOR'].includes(x[0]) || s.length > 1).filter(x => !s || x[0].startsWith(s))
    .map(x => ({ word: x[0], t: x[1], o: x[2] || {}, help: x[1] === 'calc' ? x[2].calc : x[1] === 'cmp' ? 'Vergleich ' + x[2].cmp : TYPE_HELP[x[1]] }));
}

/* ---------- Meta-Zeile "// @fup {…}" ---------- */
const META_RE = /^\s*\/\/\s*@fup\s+(\{.*\})\s*$/;
function readMeta(text){
  // Meta je Text-Netzwerk (Index wie in KOP.parse)
  const metas = []; let idx = -1, rung = false;
  String(text || '').replace(/\r/g, '').split('\n').forEach(l => {
    const s = l.trim(); if(!s) return;
    if(/^NETWORK\b/i.test(s)){ idx++; rung = false; return; }
    const m = META_RE.exec(s);
    if(m){ if(idx < 0) idx = 0; try{ metas[idx] = JSON.parse(m[1]); }catch(e){} return; }
    if(s.startsWith('//')) return;
    if(idx < 0) idx = 0;
    rung = true;
  });
  return metas;
}

/* ---------- Text → reiner FUP-Ausdruck (PE) ---------- */
// PE: {k:'op',v,neg} {k:'true'} {k:'and'|'or'|'xor',items} {k:'edge',E,v} {k:'cmp',a,op,b} {k:'box',K,inst,p,IN}
function hasBox(e){ return !!e && (e.t === 'box' || (e.items || []).some(hasBox)); }
function pAnd(a, b){
  if(!a || a.k === 'true') return b || { k:'true' };
  if(!b || b.k === 'true') return a;
  return { k:'and', items: (a.k === 'and' ? a.items : [a]).concat(b.k === 'and' ? b.items : [b]) };
}
function pGroup(k, items){
  const flat = []; items.forEach(x => { if(x.k === k && k !== 'xor') flat.push(...x.items); else flat.push(x); });
  return flat.length === 1 ? flat[0] : { k, items: flat };
}
function conv(e, inF){
  switch(e.t){
    case 'c': return pAnd(inF, e.edge ? { k:'edge', E: e.edge, v: e.v } : { k:'op', v: e.v, neg: !!e.neg });
    case 'cmp': return pAnd(inF, { k:'cmp', a: e.a, op: e.op, b: e.b });
    case 'box': return { k:'box', K: e.k, inst: e.inst, p: Object.assign({}, e.p), IN: inF && inF.k !== 'true' ? inF : null };
    case 's': { let f = inF; e.items.forEach(x => { f = conv(x, f); }); return f || { k:'true' }; }
    case 'p': case 'x': {
      const k = e.t === 'p' ? 'or' : 'xor';
      if(!hasBox(e)) return pAnd(inF, pGroup(k, e.items.map(x => conv(x, null))));
      return pGroup(k, e.items.map(x => conv(x, inF)));
    }
  }
  throw new Error('Unbekanntes Element ' + e.t);
}

/* ---------- Graph aus einem Text-Netzwerk ---------- */
function chainFromKop(kn, g){
  const nodes = [], wires = [];
  const add = (t, o) => { const n = makeNode(t, o); n.id = 'n' + (++g.seq); nodes.push(n); return n; };
  const feed = (sig, n, i) => {
    const pin = n.ins[i];
    if(!sig || sig.k === 'true'){ pin.op = 'TRUE'; pin.neg = false; return; }
    if(sig.k === 'op'){ pin.op = sig.v; pin.neg = !!sig.neg; return; }
    pin.op = null; pin.neg = false; wires.push({ s: sig.node.id, d: n.id, p: i });
  };
  function mat(pe){
    switch(pe.k){
      case 'true': return { k:'true' };
      case 'op': return pe;
      case 'and': case 'or': case 'xor': { const n = add(pe.k, { inputs: pe.items.length }); pe.items.forEach((x, i) => feed(mat(x), n, i)); return { k:'node', node: n }; }
      case 'edge': { const n = add(pe.E === 'P' ? 'edgeP' : 'edgeN'); n.opnd = pe.v; return { k:'node', node: n }; }
      case 'cmp': { const n = add('cmp', { cmp: pe.op }); n.ins[0].op = pe.a; n.ins[1].op = pe.b; return { k:'node', node: n }; }
      case 'box': {
        const t = pe.K.toLowerCase(), n = add(t); n.inst = pe.inst;
        if(pe.IN) feed(mat(pe.IN), n, 0); else { n.ins[0].op = 'TRUE'; }
        if(TIMERS[t]) n.ins[1].op = pe.p.PT !== undefined ? pe.p.PT : '?';
        else { n.ins[1].op = (t === 'ctu' ? pe.p.R : pe.p.LD) !== undefined ? (t === 'ctu' ? pe.p.R : pe.p.LD) : null; n.ins[2].op = pe.p.PV !== undefined ? pe.p.PV : '?'; }
        n._p = Object.keys(pe.p);
        return { k:'node', node: n };
      }
    }
    throw new Error('PE ' + pe.k);
  }
  const F = kn.expr ? conv(kn.expr, null) : null;
  const sig = F ? mat(F) : null;
  (kn.outs || []).forEach(o => {
    let n;
    if(o.t === 'coil'){
      n = add(o.mode === 'S' ? 'set' : o.mode === 'R' ? 'reset' : 'assign'); n.opnd = o.v;
      feed(sig, n, 0);
      if(o.mode === 'NOT'){ n.ins[0].neg = !n.ins[0].neg; n.ncoil = true; }
      return;
    }
    if(o.t === 'call'){
      n = add('call', { target: o.target, params: o.args.map(a => ({ n: a.n, d: a.d, v: a.v })) });
    } else if(o.k === 'SR' || o.k === 'RS'){
      n = add(o.k.toLowerCase()); n.opnd = o.args[0]; n.ins[o.k === 'SR' ? 1 : 0].op = o.args[1];
    } else if(o.k === 'MOVE'){ n = add('move'); n.ins[1].op = o.args[0]; n.outs[0].op = o.args[1]; }
    else {
      n = add('calc', { calc: o.k });
      const pins = n.ins.slice(1).concat(n.outs); o.args.forEach((a, i) => { if(pins[i]) pins[i].op = a; });
    }
    const fi = fIndex(n);
    if(!sig || sig.k === 'true'){ if(n.ins[fi].k === 'f' && (n.t === 'sr' || n.t === 'rs')) n.ins[fi].op = 'TRUE'; else n.ins[fi].op = null; }
    else feed(sig, n, fi);
  });
  return { nodes, wires, empty: !kn.expr && !(kn.outs || []).length };
}

function fromText(text, opts){
  opts = opts || {};
  const src = String(text || '');
  const prog = K.parse(src);
  const metas = readMeta(src);
  const g = { seq: 0, networks: [] };
  prog.networks.forEach((kn, i) => {
    const meta = metas[i] || {};
    const ch = chainFromKop(kn, g);
    const prev = g.networks[g.networks.length - 1];
    let net;
    if(meta.k && prev){ net = prev; }
    else { net = { title: kn.title || '', comment: meta.cm || '', collapsed: !!meta.z, nodes: [], wires: [] }; g.networks.push(net); }
    const pos = Array.isArray(meta.p) ? meta.p : null;
    const known = pos && pos.length === ch.nodes.length && ch.nodes.every((n, j) => Array.isArray(pos[j]));
    if(known && opts.layout !== 'auto'){
      ch.nodes.forEach((n, j) => { n.x = +pos[j][0] || 0; n.y = +pos[j][1] || 0; if(Array.isArray(pos[j][2]) && pos[j][2].length === n.ins.length) n.pdy = pos[j][2].slice(); });
    } else {
      const top = net.nodes.length ? bottomOf(net) + 24 : 8;
      layoutChain(ch.nodes, ch.wires, top);
    }
    ch.nodes.forEach(n => delete n._p);
    net.nodes.push(...ch.nodes); net.wires.push(...ch.wires);
  });
  return g;
}
function bottomOf(net){ return net.nodes.reduce((m, n) => Math.max(m, n.y + size(n).h), 0); }

/* ---------- Auto-Layout ---------- */
const snap = v => Math.round(v / GRID) * GRID;
function layoutChain(nodes, wires, top){
  if(!nodes.length) return top;
  const by = {}; nodes.forEach(n => { by[n.id] = n; });
  const inW = {}; wires.forEach(w => { (inW[w.d] = inW[w.d] || {})[w.p] = by[w.s]; });
  const placed = new Set();
  // rechte Kante = 0, danach verschieben
  function place(n, right, ftop){
    placed.add(n);
    n.x = right - boxW(n);
    n.y = ftop + (hasTop(n) ? TOPH : 0);
    let cursor = ftop, py = n.y + HEAD + PIN / 2;
    const pdy = [];
    n.ins.forEach((pin, i) => {
      const c = inW[n.id] && inW[n.id][i];
      if(c && !placed.has(c)){
        const off = (hasTop(c) ? TOPH : 0) + HEAD + PIN / 2;   // Ausgang Q relativ zur Oberkante
        if(py - off < cursor) py = cursor + off;
        const b = place(c, n.x - GAP, py - off);
        cursor = Math.max(cursor, b + 8);
      } else if(!c){
        if(py - 18 < cursor) py = cursor + 18;
        cursor = Math.max(cursor, py + 18);
      } else { cursor = Math.max(cursor, py + PIN / 2); }
      pdy.push(py - n.y); py += PIN;
    });
    const def = n.ins.every((_, i) => pdy[i] === HEAD + i * PIN + PIN / 2);
    if(def) delete n.pdy; else n.pdy = pdy;
    return Math.max(cursor, n.y + size(n).h);
  }
  const sinks = nodes.filter(n => SINKS.has(n.t));
  const usedAsSrc = new Set(wires.map(w => w.s));
  const roots = sinks.concat(nodes.filter(n => !SINKS.has(n.t) && !usedAsSrc.has(n.id)));
  let cursor = top;
  const right = 0;
  roots.forEach(r => {
    const extra = (r.outs.length ? OPW : 0);
    const b = place(r, right - extra, cursor);
    cursor = b + 16;
  });
  nodes.filter(n => !placed.has(n)).forEach(n => { cursor = place(n, right, cursor) + 16; });
  // Operanden links brauchen Platz: ganz nach rechts schieben, bis die linke Kante frei ist
  const minX = Math.min(...nodes.map(n => n.x - (n.ins.some((p, i) => !(inW[n.id] && inW[n.id][i])) ? OPW : 12)));
  const dx = 24 - minX;
  nodes.forEach(n => { n.x = snap(n.x + dx); n.y = snap(n.y); });
  return cursor;
}
function layoutNet(net){
  // ganze Netzwerk neu anordnen (Knopf „Aufräumen“): Ketten untereinander
  const groups = chains(net);
  let top = 8;
  groups.forEach(gr => { top = layoutChain(gr.nodes, net.wires.filter(w => gr.ids.has(w.d)), top) + 24; });
}
// Ketten = zusammenhängende Teilgraphen (über Drähte)
function chains(net){
  const parent = {}; net.nodes.forEach(n => { parent[n.id] = n.id; });
  const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
  net.wires.forEach(w => { if(parent[w.s] !== undefined && parent[w.d] !== undefined) parent[find(w.s)] = find(w.d); });
  const map = new Map();
  net.nodes.forEach(n => { const r = find(n.id); if(!map.has(r)) map.set(r, { nodes: [], ids: new Set() }); const gr = map.get(r); gr.nodes.push(n); gr.ids.add(n.id); });
  return [...map.values()].sort((a, b) => Math.min(...a.nodes.map(n => n.y)) - Math.min(...b.nodes.map(n => n.y)));
}

/* ---------- Graph → Text ---------- */
const INV = { '==':'<>', '<>':'==', '>':'<=', '<=':'>', '<':'>=', '>=':'<' };
function netToKop(net, issues){
  issues = issues || [];
  const by = {}; net.nodes.forEach(n => { by[n.id] = n; });
  const inW = {}; net.wires.forEach(w => { if(by[w.s] && by[w.d]) (inW[w.d] = inW[w.d] || {})[w.p] = by[w.s]; });
  const outW = {}; net.wires.forEach(w => { if(by[w.s] && by[w.d]) (outW[w.s] = outW[w.s] || []).push(w); });
  const issue = (node, msg, level, pin) => { if(!issues.some(x => x.node === node && x.msg === msg)) issues.push({ node, pin, msg, level: level || 'error' }); };
  const stack = new Set();
  function readNode(n){
    if(stack.has(n.id)){ issue(n.id, 'Zyklus: Ein Ausgang führt auf sich selbst zurück.'); return { k:'op', v:'?', neg:false }; }
    stack.add(n.id);
    let r;
    switch(n.t){
      case 'and': case 'or': case 'xor': r = { k: n.t, items: n.ins.map((p, i) => pinPE(n, i)), nid: n.id }; break;
      case 'edgeP': case 'edgeN': r = { k:'edge', E: n.t === 'edgeP' ? 'P' : 'N', v: n.opnd || '?', nid: n.id }; break;
      case 'cmp': r = { k:'cmp', a: n.ins[0].op || '?', op: n.cmp || '==', b: n.ins[1].op || '?', nid: n.id }; break;
      case 'ton': case 'tof': case 'tp': case 'ctu': case 'ctd': {
        const p = {};
        if(TIMERS[n.t]) p.PT = n.ins[1].op || '?';
        else { const rp = n.ins[1].op; if(n.t === 'ctu'){ p.PV = n.ins[2].op || '?'; if(rp) p.R = rp; } else { p.PV = n.ins[2].op || '?'; if(rp) p.LD = rp; } }
        const inPin = n.ins[0];
        const IN = (!inW[n.id] || !inW[n.id][0]) && (inPin.op === 'TRUE' && !inPin.neg) ? null : pinPE(n, 0);
        r = { k:'box', K: (TIMERS[n.t] || COUNTERS[n.t]), inst: n.inst || '?', p, IN, nid: n.id };
        break;
      }
      case 'empty': issue(n.id, 'Leere Box: Boxtyp eintippen (z. B. &, >=1, SR, TON).'); r = { k:'op', v:'?', neg:false }; break;
      default: issue(n.id, NAME[n.t] + ' hat keinen Ausgang, der weiterverbunden werden kann.'); r = { k:'op', v:'?', neg:false };
    }
    stack.delete(n.id);
    return r;
  }
  function pinPE(n, i){
    const pin = n.ins[i], src = inW[n.id] && inW[n.id][i];
    if(src){ const pe = readNode(src); return pin.neg ? negate(pe, n.id) : pe; }
    const v = pin.op;
    if(v === 'TRUE') return pin.neg ? (issue(n.id, 'Ein negiertes TRUE ist im Textformat nicht möglich.'), { k:'op', v:'?', neg:false }) : { k:'true' };
    if(v === 'FALSE'){ issue(n.id, 'FALSE als Operand eines Bool-Eingangs ist im Textformat nicht möglich (Eingang negieren und TRUE verwenden geht auch nicht) – Box weglassen.'); return { k:'op', v:'?', neg:false }; }
    return { k:'op', v: v || '?', neg: !!pin.neg };
  }
  function negate(pe, nid){
    switch(pe.k){
      case 'op': return Object.assign({}, pe, { neg: !pe.neg });
      case 'and': return { k:'or', items: pe.items.map(x => negate(x, nid)), nid: pe.nid, dm: true };
      case 'or': return { k:'and', items: pe.items.map(x => negate(x, nid)), nid: pe.nid, dm: true };
      case 'xor': return { k:'xor', items: [negate(pe.items[0], nid)].concat(pe.items.slice(1)), nid: pe.nid, dm: true };
      case 'cmp': return Object.assign({}, pe, { op: INV[pe.op] || pe.op });
      case 'true': issue(nid, 'Ein negiertes TRUE ist im Textformat nicht möglich.'); return { k:'op', v:'?', neg:false };
    }
    issue(nid, 'Negation hinter einer ' + (pe.k === 'edge' ? 'Flanken' : 'Zeit-/Zähler') + 'box ist im Textformat nicht möglich. Verwende einen Merker in einem eigenen Netzwerk.');
    return pe;
  }
  // PE → KOP-Ausdruck (Kontaktplan-Semantik bei inF = TRUE)
  function lad(pe){
    switch(pe.k){
      case 'op': return { e: { t:'c', v: pe.v, neg: !!pe.neg, _nid: pe.nid }, sens: false };
      case 'true': return { e: { t:'s', items: [] }, sens: false };
      case 'edge': return { e: { t:'c', v: pe.v, edge: pe.E, _nid: pe.nid }, sens: false };
      case 'cmp': return { e: { t:'cmp', a: pe.a, op: pe.op, b: pe.b, _nid: pe.nid }, sens: false };
      case 'box': {
        const el = { t:'box', k: pe.K, inst: pe.inst, p: pe.p, _nid: pe.nid };
        if(!pe.IN) return { e: el, sens: true };
        const l = lad(pe.IN);
        return { e: { t:'s', items: flatS(l.e).concat([el]) }, sens: true };
      }
      case 'and': {
        const ls = pe.items.map(lad), sens = ls.filter(x => x.sens);
        if(sens.length > 1) issue(pe.nid, 'Zwei Zeit-/Zählerboxen an derselben &-Box sind im Textformat nicht möglich. Lege eine Box in ein eigenes Netzwerk (mit Merker).');
        const ord = sens.concat(ls.filter(x => !x.sens));
        const items = []; ord.forEach(x => items.push(...flatS(x.e)));
        return { e: items.length === 1 ? items[0] : { t:'s', items, _nid: pe.nid }, sens: sens.length > 0 };
      }
      case 'or': case 'xor': {
        const t = pe.k === 'or' ? 'p' : 'x', ls = pe.items.map(lad), items = [];
        ls.forEach(x => { if(x.e.t === t && t === 'p') items.push(...x.e.items); else items.push(x.e); });
        return { e: items.length === 1 ? items[0] : { t, items, _nid: pe.nid }, sens: ls.some(x => x.sens) };
      }
    }
    throw new Error('lad ' + pe.k);
  }
  const flatS = e => e.t === 's' ? e.items : [e];

  // Ausgangsboxen nach Quelle gruppieren (gleiche Verknüpfung = ein Strompfad mit mehreren Ausgängen)
  const sinks = net.nodes.filter(n => SINKS.has(n.t)).sort((a, b) => a.y - b.y || a.x - b.x);
  const groups = [];
  // je Ausgangsbox: Quelle (Draht/Operand/TRUE), Negation der Quelle (Kontakt) und Negation der Zuweisung (=> NOT A)
  const negs = n => {
    const i = fIndex(n), pin = n.ins[i], src = inW[n.id] && inW[n.id][i];
    if(n.t !== 'assign') return { c: !!pin.neg, q: false };
    if(src || pin.op === 'TRUE' || pin.op === null) return { c: false, q: !!pin.neg };
    return { c: !!pin.neg !== !!n.ncoil, q: !!n.ncoil };
  };
  const keyOf = n => { const i = fIndex(n), pin = n.ins[i], src = inW[n.id] && inW[n.id][i];
    return src ? 'w:' + src.id : pin.op === 'TRUE' ? 'T' : pin.op === null || pin.op === undefined ? (['move', 'calc', 'call'].includes(n.t) ? 'T' : 'op:?') : 'op:' + pin.op; };
  sinks.forEach(n => {
    const ng = negs(n), key = keyOf(n) + (ng.c ? '!' : '');
    let gr = groups.find(x => x.key === key);
    if(!gr){ gr = { key, neg: ng.c, sinks: [] }; groups.push(gr); }
    gr.sinks.push(n);
  });
  // Logik ohne Ziel (Ausgang offen) als eigene Kette
  const usedSrc = new Set(net.wires.map(w => w.s));
  net.nodes.filter(n => !SINKS.has(n.t) && !usedSrc.has(n.id)).forEach(n => { issue(n.id, 'Der Ausgang der Box ist nicht verbunden (Zuweisung fehlt).'); groups.push({ key: 'w:' + n.id, root: n, sinks: [], neg: false }); });
  // Abzweig in mehrere Logikboxen: Hinweis (wird verdoppelt)
  Object.keys(outW).forEach(s => { const ds = outW[s].map(w => by[w.d]).filter(n => !SINKS.has(n.t)); if(ds.length > 1 || (ds.length && outW[s].length > ds.length)) issue(s, 'Abzweig in weitere Logikboxen: Beim Speichern wird die Logik davor verdoppelt.', 'warn'); });
  const rungs = groups.map(gr => {
    const first = gr.sinks[0] || gr.root;
    let F;
    if(gr.root) F = readNode(gr.root);
    else { const n = first, i = fIndex(n), src = inW[n.id] && inW[n.id][i], pin = n.ins[i];
      if(src){ F = readNode(src); if(gr.neg) F = negate(F, n.id); }
      else if(/^T!?$/.test(gr.key)){ F = null; if(gr.neg) issue(n.id, 'Ein negiertes TRUE ist im Textformat nicht möglich.'); }
      else F = { k:'op', v: pin.op || '?', neg: gr.neg };
    }
    if(F && F.k === 'true') F = null;
    const expr = F ? lad(F).e : { t:'s', items: [] };
    const outs = gr.sinks.map(n => sinkOut(n, gr));
    return { title: '', expr, outs, sinks: gr.sinks, y: Math.min(...(gr.sinks.length ? gr.sinks : [gr.root]).map(n => n.y)) };
  });
  rungs.sort((a, b) => a.y - b.y);
  function sinkOut(n, gr){
    const a = p => (p && p.op) || '?';
    switch(n.t){
      case 'assign': return { t:'coil', mode: negs(n).q ? 'NOT' : '', v: n.opnd || '?', _nid: n.id };
      case 'set': return { t:'coil', mode:'S', v: n.opnd || '?', _nid: n.id };
      case 'reset': return { t:'coil', mode:'R', v: n.opnd || '?', _nid: n.id };
      case 'sr': return { t:'op', k:'SR', args: [n.opnd || '?', a(n.ins[1])], _nid: n.id };
      case 'rs': return { t:'op', k:'RS', args: [n.opnd || '?', a(n.ins[0])], _nid: n.id };
      case 'move': return { t:'op', k:'MOVE', args: [a(n.ins[1]), a(n.outs[0])], _nid: n.id };
      case 'calc': return { t:'op', k: n.calc, args: n.ins.slice(1).concat(n.outs).map(a), _nid: n.id };
      case 'call': return { t:'call', target: n.target || '?', args: n.ins.slice(1).map(p => ({ n: p.n, d: ':=', v: a(p) })).concat(n.outs.map(p => ({ n: p.n, d: '=>', v: a(p) }))), _nid: n.id };
    }
  }
  return { rungs, issues };
}
function rungText(r){
  const ex = r.expr && r.expr.t === 's' && !r.expr.items.length ? '' : K.exprText(r.expr, true) + ' ';
  return ex + '=> ' + (r.outs.length ? r.outs : [{ t:'coil', mode:'', v:'?' }]).map(K.outText).join(', ') + ';';
}
const sig = n => [n.t, n.opnd || '', n.inst || '', n.cmp || '', n.calc || '', n.target || '', n.ins.map(p => p.op || '').join(',')].join('|');
function toText(g, opts){
  opts = opts || {};
  const withMeta = opts.layout !== false;
  const out = [];
  (g.networks || []).forEach((net, ni) => {
    const title = net.title || ('Netzwerk ' + (ni + 1));
    const { rungs } = netToKop(net, []);
    if(!rungs.length){
      const meta = {}; if(net.comment) meta.cm = net.comment; if(net.collapsed) meta.z = 1;
      out.push('NETWORK ' + title + (withMeta && Object.keys(meta).length ? '\n// @fup ' + JSON.stringify(meta) : ''));
      return;
    }
    rungs.forEach((r, ri) => {
      const line = rungText(r);
      let meta = '';
      if(withMeta){
        const m = {};
        if(ri > 0) m.k = 1;
        if(ri === 0 && net.comment) m.cm = net.comment;
        if(ri === 0 && net.collapsed) m.z = 1;
        // Positionen: Knoten des neu eingelesenen Strompfads den Editor-Knoten zuordnen (Typ + Operanden)
        try{
          const kp = K.parse('NETWORK x\n' + line).networks[0];
          const ch = chainFromKop(kp, { seq: 0 });
          const pool = net.nodes.slice(), used = new Set();
          const pick = f => { const c = pool.find(n => !used.has(n) && f(n)); if(c) used.add(c); return c; };
          m.p = ch.nodes.map(n2 => { const s2 = sig(n2); const c = pick(n => sig(n) === s2) || pick(n => n.t === n2.t); return c ? (c.pdy ? [c.x, c.y, c.pdy] : [c.x, c.y]) : 0; });
        }catch(e){}
        if(Object.keys(m).length) meta = '// @fup ' + JSON.stringify(m) + '\n';
      }
      out.push('NETWORK ' + (ri === 0 ? title : title + ' (' + (ri + 1) + ')') + '\n' + meta + line);
    });
  });
  return out.length ? out.join('\n\n') + '\n' : '';
}

/* ---------- Prüfung (TIA-nahe Meldungen) ---------- */
const LIT = /^(TRUE|FALSE|-?\d[\d_]*(\.\d+)?([eE][-+]?\d+)?|T(IME)?#.*|16#[0-9A-F_]+|'.*')$/i;
function baseName(v){ return String(v).replace(/^#/, '').replace(/^"([^"]+)".*$/, '$1').replace(/[.[].*$/, ''); }
function check(g, opts){
  opts = opts || {};
  const tags = opts.tags || null, locals = opts.locals || null;
  const items = [];
  const tagOf = v => { if(!tags) return null; const b = baseName(v); const k = Object.keys(tags).find(x => x.toLowerCase() === b.toLowerCase()); return k ? Object.assign({ name: k }, tags[k]) : null; };
  (g.networks || []).forEach((net, ni) => {
    const add = (node, msg, level, pin) => items.push({ net: ni, node, pin, msg, level: level || 'error' });
    const inW = {}; net.wires.forEach(w => { (inW[w.d] = inW[w.d] || {})[w.p] = w; });
    const insts = new Set(net.nodes.filter(n => n.inst && n.inst !== '?').map(n => baseName(n.inst).toLowerCase()));
    (g.networks || []).forEach(nn => nn.nodes.forEach(n => { if(n.inst && n.inst !== '?') insts.add(baseName(n.inst).toLowerCase()); }));
    const known = v => {
      if(v === null || v === undefined || v === '?' || LIT.test(v)) return true;
      if(/^%/.test(v)) return false;
      const b = baseName(v).toLowerCase();
      if(insts.has(b)) return true;
      if(/^#/.test(v)) return !locals || locals.some(x => x.toLowerCase() === b);
      if(/^"/.test(v) && !tags) return true;
      return !tags || !!tagOf(v);
    };
    const typeOk = (v, want) => {
      if(!tags || v === '?' || v === null) return true;
      if(LIT.test(v)){ if(want === 'Bool') return /^(TRUE|FALSE)$/i.test(v); if(want === 'Time') return /^T(IME)?#/i.test(v); return !/^T(IME)?#/i.test(v) && !/^(TRUE|FALSE)$/i.test(v); }
      const t = tagOf(v); if(!t || /[.[]/.test(v.replace(/^"[^"]*"/, ''))) return true;
      const ty = String(t.type || '');
      if(want === 'Bool') return /^bool$/i.test(ty);
      if(want === 'Time') return /^time$/i.test(ty);
      if(want === 'num') return !/^(bool|time)$/i.test(ty);
      return true;
    };
    const chkOp = (n, v, what, want, pin) => {
      if(v === '?' ) { add(n.id, what + ': Operand fehlt (<??.?>).', 'error', pin); return; }
      if(v === null || v === undefined) return;
      if(/^%/.test(v)){ add(n.id, what + ': ' + v + ' – Adresse ohne Variable. Wähle die Variable aus der PLC-Variablentabelle.', 'error', pin); return; }
      if(!known(v)){ add(n.id, '"' + v + '" – Nicht in der PLC-Variablentabelle.', 'error', pin); return; }
      if(want && !typeOk(v, want)){ const t = tagOf(v); add(n.id, what + ': "' + v + '" ist ' + (t ? t.type : '?') + ', erwartet wird ' + (want === 'num' ? 'eine Zahl' : want) + '.', 'error', pin); }
    };
    net.nodes.forEach(n => {
      const nm = NAME[n.t] || n.t;
      if(n.t === 'empty') add(n.id, 'Leere Box: Boxtyp eintippen (z. B. &, >=1, SR, TON).');
      if(hasTop(n) && n.t !== 'call'){
        const v = TIMERS[n.t] || COUNTERS[n.t] ? n.inst : n.opnd;
        if(!v || v === '?') add(n.id, nm + ': ' + (TIMERS[n.t] || COUNTERS[n.t] ? 'Instanzname fehlt' : 'Operand fehlt (<??.?>)') + '.', 'error', -1);
        else if(!(TIMERS[n.t] || COUNTERS[n.t])) chkOp(n, v, nm, 'Bool', -1);
      }
      if(n.t === 'call' && (!n.target || n.target === '?')) add(n.id, 'Aufruf: Baustein fehlt.', 'error', -1);
      n.ins.forEach((p, i) => {
        const wired = inW[n.id] && inW[n.id][i];
        if(wired){ if(p.k === 'v') add(n.id, nm + ', Eingang ' + p.n + ': Hier geht nur ein Operand, keine Verbindung.', 'error', i); return; }
        if(p.k === 'b'){ if(p.op === null || p.op === undefined || p.op === '?') add(n.id, nm + ', Eingang ' + p.n + ': Operand fehlt (<??.?>).', 'error', i); else chkOp(n, p.op, nm + ' ' + p.n, 'Bool', i); return; }
        if(p.k === 'f'){ if(p.op === '?') add(n.id, nm + ', Eingang ' + p.n + ': Operand fehlt (<??.?>).', 'error', i); else if(p.op) chkOp(n, p.op, nm + ' ' + p.n, 'Bool', i); return; }
        const want = p.n === 'PT' ? 'Time' : p.n === 'R' || p.n === 'LD' || p.n === 'R1' ? 'Bool' : (p.n === 'PV' ? 'num' : null);
        if(p.op === null && (p.n === 'R' || p.n === 'LD')) return;
        chkOp(n, p.op === null ? '?' : p.op, nm + ' ' + p.n, want, i);
      });
      n.outs.forEach((p, i) => chkOp(n, p.op === null ? '?' : p.op, nm + ' ' + p.n, null, n.ins.length + i));
    });
    // Zyklen, offene Ausgänge, nicht darstellbare Verschaltungen
    const res = netToKop(net, []);
    res.issues.forEach(x => add(x.node, x.msg, x.level));
  });
  const seen = new Set();
  const uniq = items.filter(x => { const k = x.net + '|' + x.node + '|' + x.msg; if(seen.has(k)) return false; seen.add(k); return true; });
  return { ok: !uniq.some(x => x.level === 'error'), items: uniq };
}

/* ---------- Hilfen für den Editor ---------- */
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function emptyNet(title){ return { title: title || '', comment: '', collapsed: false, nodes: [], wires: [] }; }
// Wert eines Knotens für die Signalanzeige (rein funktional aus dem Variablenabbild)
function evalNet(net, env, edgeQ){
  const by = {}; net.nodes.forEach(n => { by[n.id] = n; });
  const inW = {}; net.wires.forEach(w => { (inW[w.d] = inW[w.d] || {})[w.p] = by[w.s]; });
  const memo = {}, busy = new Set();
  const read = v => {
    if(v === null || v === undefined || v === '?') return undefined;
    if(/^TRUE$/i.test(v)) return true; if(/^FALSE$/i.test(v)) return false;
    if(/^-?\d/.test(v)) return parseFloat(v);
    if(/^T(IME)?#/i.test(v)) return undefined;
    let cur = env; const parts = String(v).replace(/^#/, '').split('.');
    for(const p of parts){ if(cur == null) return undefined; const k = Object.keys(cur).find(x => x.toLowerCase() === p.replace(/"/g, '').toLowerCase()); cur = k === undefined ? undefined : cur[k]; }
    return cur;
  };
  function pinVal(n, i){
    const p = n.ins[i], s = inW[n.id] && inW[n.id][i];
    let v = s ? val(s) : read(p.op);
    if(typeof v === 'boolean' && p.neg) v = !v;
    return v;
  }
  function val(n){
    if(n.id in memo) return memo[n.id];
    if(busy.has(n.id)) return undefined; busy.add(n.id);
    let v;
    switch(n.t){
      case 'and': { const vs = n.ins.map((_, i) => pinVal(n, i)); v = vs.some(x => x === false) ? false : vs.every(x => x === true) ? true : undefined; break; }
      case 'or': { const vs = n.ins.map((_, i) => pinVal(n, i)); v = vs.some(x => x === true) ? true : vs.every(x => x === false) ? false : undefined; break; }
      case 'xor': { const vs = n.ins.map((_, i) => pinVal(n, i)); v = vs.every(x => typeof x === 'boolean') ? vs.filter(Boolean).length % 2 === 1 : undefined; break; }
      case 'cmp': { const a = pinVal(n, 0), b = pinVal(n, 1); if(typeof a === 'number' && typeof b === 'number'){ const o = n.cmp; v = o === '==' ? a === b : o === '<>' ? a !== b : o === '>' ? a > b : o === '>=' ? a >= b : o === '<' ? a < b : a <= b; } break; }
      case 'ton': case 'tof': case 'tp': case 'ctu': case 'ctd': { const i = read(n.inst); v = i && typeof i === 'object' ? !!i.Q : undefined; break; }
      case 'edgeP': case 'edgeN': v = edgeQ ? edgeQ(n) : undefined; break;
    }
    busy.delete(n.id); memo[n.id] = v; return v;
  }
  const res = { nodes: {}, pins: {} };
  net.nodes.forEach(n => { res.nodes[n.id] = val(n); n.ins.forEach((_, i) => { res.pins[n.id + ':' + i] = pinVal(n, i); }); });
  return res;
}
// Kanten-Instanzen (_eN_k) je Flankenbox über die Übersetzung von kop.js
function edgeMap(g){
  const map = {}; let N = 0;
  (g.networks || []).forEach(net => {
    const { rungs } = netToKop(net, []);
    (rungs.length ? rungs : [null]).forEach(r => {
      N++;
      if(!r) return;
      const prog = { networks: [{ title:'', line: 1, rungLine: 1, expr: r.expr, outs: r.outs }] };
      try{ K.toSCL(prog, { dry: true }); }catch(e){ return; }
      const walk = e => { if(!e) return; if(e.t === 'c' && e.edge && e._nid && e._f){ map[e._nid] = e._f.replace(/^_f\d+_/, '_e' + N + '_'); } (e.items || []).forEach(walk); };
      walk(r.expr);
    });
  });
  return map;
}
// Text-Zeile → (Netzwerk, Knoten) für Fehlermarken
function lineInfo(text){
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const info = []; let tn = -1, vn = -1;
  lines.forEach((l, i) => {
    const s = l.trim();
    if(/^NETWORK\b/i.test(s)){ tn++; const next = lines.slice(i + 1).find(x => x.trim()); const m = next && META_RE.exec(next.trim()); let k = false; if(m){ try{ k = !!JSON.parse(m[1]).k; }catch(e){} } if(!k || vn < 0) vn++; }
    info[i + 1] = { textNet: Math.max(0, tn), net: Math.max(0, vn) };
  });
  return info;
}

const FUPGraph = {
  GRID, PIN, HEAD, TOPH, OPW, GAP, LABEL, NAME, SINKS, TIMERS, COUNTERS, CMPS, CALC1, CALC2, CALC4,
  makeNode, typeFromWord, typeSuggest, fromText, toText, check, layoutChain, layoutNet, chains, netToKop, rungText,
  size, boxW, inPos, outPos, oPos, hasOut, hasTop, fIndex, clone, emptyNet, evalNet, edgeMap, lineInfo, readMeta, baseName, isSink: n => SINKS.has(n.t)
};
root.FUPGraph = FUPGraph;
if(typeof module !== 'undefined' && module.exports) module.exports = FUPGraph;
})(typeof window !== 'undefined' ? window : globalThis);
