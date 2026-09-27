(function(root){
"use strict";
/* ============================================================
   KOP (Kontaktplan) — Datenmodell, Textformat, Übersetzung nach SCL
   ------------------------------------------------------------
   Ein Programm besteht aus Netzwerken. Jedes Netzwerk hat genau einen
   Strompfad (Ausdruck) und eine oder mehrere Ausgänge (Spulen/Boxen).

   Textformat (so wird gespeichert, Lehrperson sieht es als Text):
     NETWORK Titel
     (Start OR Motor) AND NOT Stopp => Motor;

   Strompfad:  a AND b   Reihe          a OR b    Parallelzweig
               NOT a     Öffner         P(a) N(a) Flankenkontakte
               [Wind > 60]  Vergleicher (==, <>, >, >=, <, <=)
               TON(T1, T#3S)  TOF(…)  TP(…)   Zeitglied als Box
               CTU(Z1, PV:=5, R:=Quit)  CTD(Z2, PV:=5, LD:=Laden)
               ?          Kontakt ohne Variable (noch offen)
   Ausgänge:   => A   Spule      => S A / => R A   Setzen/Rücksetzen
               => NOT A  negierte Spule
               => MOVE(5, Ziel)  => ADD(A, B, Ziel)  SUB MUL DIV
               => INC(Z) / DEC(Z)  (Zähler um 1 ändern)

   Übersetzung: Jedes Element bekommt eine Stromfluss-Variable
   _f<Netzwerk>_<Element> (BOOL). Damit ist der Stromfluss in jedem
   Zyklus sichtbar (Online-Ansicht). Flanken: R_TRIG/F_TRIG-Instanzen
   _e<Netzwerk>_<Element>. Ausführung über die SCL-Engine.
   ============================================================ */

class KOPError extends Error{
  constructor(message, line, net){ super(message); this.kind = 'syntax'; this.line = line || 0; this.col = 1; this.net = net || 0; }
}
const BOXES = { TON:'timer', TOF:'timer', TP:'timer', CTU:'counter', CTD:'counter' };
const OUTBOX = { MOVE:2, ADD:3, SUB:3, MUL:3, DIV:3, INC:1, DEC:1 };
const CMP = ['==', '<>', '>=', '<=', '>', '<'];
const KW = new Set(['AND','OR','NOT','P','N','S','R','NETWORK','TRUE','FALSE']);

/* ---------- Tokenizer (eine Zeile) ---------- */
function tokens(s, line){
  const out = []; let i = 0;
  while(i < s.length){
    const c = s[i];
    if(/\s/.test(c)){ i++; continue; }
    if(s.startsWith('//', i)) break;
    const two = s.substr(i, 2);
    if(['=>', ':=', '==', '<>', '>=', '<='].includes(two)){ out.push({ t:'op', v:two }); i += 2; continue; }
    if('()[],;<>=?'.includes(c)){ out.push({ t:'op', v: c === '=' ? '==' : c }); i++; continue; }
    let m;
    if((m = /^(T|TIME)#[0-9A-Za-z_.]+/i.exec(s.slice(i)))){ out.push({ t:'lit', v:m[0].toUpperCase() }); i += m[0].length; continue; }
    if((m = /^-?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(s.slice(i)))){ out.push({ t:'lit', v:m[0] }); i += m[0].length; continue; }
    if((m = /^"?#?([A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*)"?/.exec(s.slice(i)))){
      const up = m[1].toUpperCase();
      out.push(KW.has(up) && !m[1].includes('.') ? { t:'kw', v:up } : { t:'id', v:m[1] });
      i += m[0].length; continue;
    }
    throw new KOPError('Unbekanntes Zeichen "' + c + '".', line);
  }
  return out;
}

/* ---------- Parser ---------- */
function parse(src){
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const nets = [];
  let cur = null;
  lines.forEach((raw, idx) => {
    const ln = idx + 1, s = raw.trim();
    if(!s || s.startsWith('//')) return;
    const mNet = /^NETWORK\b\s*(.*)$/i.exec(s);
    if(mNet){ cur = { title: mNet[1].trim(), line: ln, expr: null, outs: [], rungLine: 0 }; nets.push(cur); return; }
    if(!cur){ cur = { title: '', line: ln, expr: null, outs: [], rungLine: 0 }; nets.push(cur); }
    if(cur.expr) throw new KOPError('Netzwerk ' + nets.length + ' hat schon einen Strompfad. Für einen weiteren Strompfad ein neues Netzwerk anlegen.', ln, nets.length);
    parseRung(cur, tokens(s, ln), ln, nets.length);
  });
  return { networks: nets };
}
function parseRung(net, tk, ln, nNo){
  let p = 0;
  const peek = () => tk[p], next = () => tk[p++];
  const isOp = v => peek() && peek().t === 'op' && peek().v === v;
  const isKw = v => peek() && peek().t === 'kw' && peek().v === v;
  const fail = m => { throw new KOPError('Netzwerk ' + nNo + ': ' + m, ln, nNo); };
  const expect = v => { if(!isOp(v)) fail('"' + v + '" erwartet' + (peek() ? ', gefunden "' + peek().v + '"' : '') + '.'); p++; };
  const ident = what => {
    if(isOp('?')){ p++; return '?'; }
    const t = next(); if(!t || t.t !== 'id') fail((what || 'Variable') + ' erwartet' + (t ? ', gefunden "' + t.v + '"' : '') + '.');
    return t.v;
  };
  const operand = () => {
    if(isOp('?')){ p++; return '?'; }
    const t = next(); if(!t || (t.t !== 'id' && t.t !== 'lit' && !(t.t === 'kw' && (t.v === 'TRUE' || t.v === 'FALSE')))) fail('Wert oder Variable erwartet.');
    return t.v;
  };
  function expr(){
    const items = [term()];
    while(isKw('OR')){ p++; items.push(term()); }
    return items.length === 1 ? items[0] : { t:'p', items: items.flatMap(x => x.t === 'p' ? x.items : [x]) };
  }
  function term(){
    const items = [factor()];
    while(isKw('AND')){ p++; items.push(factor()); }
    return items.length === 1 ? items[0] : { t:'s', items: items.flatMap(x => x.t === 's' ? x.items : [x]) };
  }
  function factor(){
    const t = peek(); if(!t) fail('Der Strompfad ist unvollständig.');
    if(t.t === 'kw' && t.v === 'NOT'){ p++; if(isOp('(')) fail('NOT gilt nur für einen einzelnen Kontakt (Öffner).'); return { t:'c', v: ident('Variable nach NOT'), neg:true }; }
    if(t.t === 'kw' && (t.v === 'P' || t.v === 'N')){ p++; expect('('); const v = ident(); expect(')'); return { t:'c', v, edge: t.v }; }
    if(t.t === 'kw' && t.v === 'TRUE'){ p++; return { t:'s', items: [] }; }
    if(isOp('(')){ p++; const e = expr(); expect(')'); return e; }
    if(isOp('[')){ p++; const a = operand(); const o = next(); if(!o || o.t !== 'op' || !CMP.includes(o.v)) fail('Vergleichsoperator (==, <>, >, >=, <, <=) erwartet.'); const b = operand(); expect(']'); return { t:'cmp', a, op:o.v, b }; }
    if(t.t === 'id' && BOXES[t.v.toUpperCase()] && tk[p + 1] && tk[p + 1].t === 'op' && tk[p + 1].v === '('){
      p += 2; const k = t.v.toUpperCase(); const inst = ident('Instanzname');
      const prm = {};
      while(isOp(',')){
        p++;
        if(peek() && (peek().t === 'id' || peek().t === 'kw') && tk[p + 1] && tk[p + 1].v === ':='){ const n = next().v.toUpperCase(); p++; prm[n] = operand(); }
        else prm[BOXES[k] === 'timer' ? 'PT' : 'PV'] = operand();
      }
      expect(')');
      if(BOXES[k] === 'timer' && !prm.PT) fail(k + ' braucht eine Zeit (PT), z.B. ' + k + '(T1, T#3S).');
      if(BOXES[k] === 'counter' && !prm.PV) fail(k + ' braucht einen Vorgabewert (PV), z.B. ' + k + '(Z1, PV:=5).');
      return { t:'box', k, inst, p: prm };
    }
    if(isOp('?') || t.t === 'id'){ return { t:'c', v: ident() }; }
    fail('Unerwartet: "' + t.v + '".');
  }
  const e = (isOp('=>')) ? { t:'s', items: [] } : expr();
  if(!isOp('=>')) fail('"=>" vor den Spulen erwartet.');
  p++;
  const outs = [];
  do{
    if(outs.length) p++;
    const t = peek(); if(!t) fail('Spule erwartet.');
    if(t.t === 'kw' && (t.v === 'S' || t.v === 'R' || t.v === 'NOT')){ p++; outs.push({ t:'coil', mode: t.v, v: ident() }); }
    else if(t.t === 'id' && OUTBOX[t.v.toUpperCase()] && tk[p + 1] && tk[p + 1].v === '('){
      p += 2; const k = t.v.toUpperCase(); const args = [operand()];
      while(isOp(',')){ p++; args.push(operand()); }
      expect(')');
      if(args.length !== OUTBOX[k]) fail(k + ' braucht ' + OUTBOX[k] + ' Angabe' + (OUTBOX[k] > 1 ? 'n' : '') + '.');
      outs.push({ t:'op', k, args });
    }
    else outs.push({ t:'coil', mode:'', v: ident('Spule') });
  } while(isOp(','));
  if(isOp(';')) p++;
  if(p < tk.length) fail('Unerwartet nach den Spulen: "' + tk[p].v + '".');
  net.expr = e; net.outs = outs; net.rungLine = ln;
}

/* ---------- Text erzeugen ---------- */
function exprText(e, top){
  switch(e.t){
    case 'c': return e.edge ? e.edge + '(' + e.v + ')' : (e.neg ? 'NOT ' : '') + e.v;
    case 'cmp': return '[' + e.a + ' ' + e.op + ' ' + e.b + ']';
    case 'box': {
      const ps = Object.keys(e.p).map(k => (BOXES[e.k] === 'timer' && k === 'PT') ? e.p[k] : k + ':=' + e.p[k]);
      return e.k + '(' + [e.inst].concat(ps).join(', ') + ')';
    }
    case 's': return e.items.length ? e.items.map(x => exprText(x, false)).join(' AND ') : 'TRUE';
    case 'p': { const s = e.items.map(x => exprText(x, true)).join(' OR '); return top ? s : '(' + s + ')'; }
  }
  return '?';
}
function outText(o){
  if(o.t === 'op') return o.k + '(' + o.args.join(', ') + ')';
  return (o.mode ? o.mode + ' ' : '') + o.v;
}
function serialize(prog){
  return prog.networks.map((n, i) => 'NETWORK ' + (n.title || ('Netzwerk ' + (i + 1))) + '\n' +
    (n.expr && n.expr.t === 's' && !n.expr.items.length ? '' : exprText(n.expr || { t:'c', v:'?' }, true) + ' ') + '=> ' + (n.outs.length ? n.outs : [{ t:'coil', mode:'', v:'?' }]).map(outText).join(', ') + ';').join('\n\n') + '\n';
}

/* ---------- Übersetzung nach SCL ---------- */
function toSCL(src, opts){
  const dry = !!(opts && opts.dry);   // dry: nur nummerieren (Anzeige), offene Stellen erlaubt
  const prog = typeof src === 'string' ? parse(src) : src;
  const out = [], fb = {}, vars = {}, lineMap = [];
  prog.networks.forEach((n, ni) => {
    const N = ni + 1; let id = 0;
    const emit = (s) => { out.push(s); lineMap.push(n.rungLine || n.line); };
    const newF = () => { const v = '_f' + N + '_' + (++id); vars[v] = false; return v; };
    const and = (a, b) => a === 'TRUE' ? b : a + ' AND ' + b;
    const need = (v, what) => { if(v === '?' && !dry) throw new KOPError('Netzwerk ' + N + ': ' + what + ' hat noch keine Variable.', n.rungLine || n.line, N); return v; };
    const opnd = v => { need(v, 'Ein Operand'); return /^-?\d/.test(v) || /^T(IME)?#/i.test(v) || /^(TRUE|FALSE)$/i.test(v) ? v : v; };
    function comp(e, inF){
      let f;
      switch(e.t){
        case 'c': {
          const v = need(e.v, 'Ein Kontakt');
          if(e.edge){
            const inst = '_e' + N + '_' + (id + 1); fb[inst] = e.edge === 'P' ? 'R_TRIG' : 'F_TRIG';
            emit(inst + '(CLK := ' + v + ');');
            f = newF(); emit(f + ' := ' + and(inF, inst + '.Q') + ';');
          } else { f = newF(); emit(f + ' := ' + and(inF, (e.neg ? 'NOT ' : '') + v) + ';'); }
          e._f = f; return f;
        }
        case 'cmp': {
          f = newF(); emit(f + ' := ' + and(inF, '(' + opnd(e.a) + ' ' + (e.op === '==' ? '=' : e.op) + ' ' + opnd(e.b) + ')') + ';');
          e._f = f; return f;
        }
        case 'box': {
          const inst = need(e.inst, 'Eine ' + e.k + '-Box'); fb[inst] = e.k;
          const inB = inF === 'TRUE' ? 'TRUE' : inF;
          let call;
          if(e.k === 'CTU') call = inst + '(CU := ' + inB + ', R := ' + opnd(e.p.R || 'FALSE') + ', PV := ' + opnd(e.p.PV) + ');';
          else if(e.k === 'CTD') call = inst + '(CD := ' + inB + ', LD := ' + opnd(e.p.LD || 'FALSE') + ', PV := ' + opnd(e.p.PV) + ');';
          else call = inst + '(IN := ' + inB + ', PT := ' + opnd(e.p.PT) + ');';
          emit(call);
          f = newF(); emit(f + ' := ' + inst + '.Q;');
          e._f = f; return f;
        }
        case 's': { f = inF; e.items.forEach(x => { f = comp(x, f); }); e._f = f; return f; }
        case 'p': {
          const fs = e.items.map(x => comp(x, inF));
          f = newF(); emit(f + ' := ' + fs.join(' OR ') + ';'); e._f = f; return f;
        }
      }
      throw new KOPError('Netzwerk ' + N + ': unbekanntes Element.', n.line, N);
    }
    emit('// Netzwerk ' + N + (n.title ? ': ' + n.title : ''));
    if(!n.expr){ if(dry) return; throw new KOPError('Netzwerk ' + N + ' ist leer.', n.line, N); }
    const F = comp(n.expr, 'TRUE');
    n._f = F;
    if(!n.outs.length && !dry) throw new KOPError('Netzwerk ' + N + ' hat keine Spule.', n.rungLine || n.line, N);
    n.outs.forEach(o => {
      if(o.t === 'coil'){
        const v = need(o.v, 'Eine Spule');
        if(o.mode === 'S') emit('IF ' + F + ' THEN ' + v + ' := TRUE; END_IF;');
        else if(o.mode === 'R') emit('IF ' + F + ' THEN ' + v + ' := FALSE; END_IF;');
        else if(o.mode === 'NOT') emit(v + ' := NOT ' + F + ';');
        else emit(v + ' := ' + F + ';');
      } else {
        const a = o.args.map(opnd);
        const body = o.k === 'MOVE' ? a[1] + ' := ' + a[0] : o.k === 'INC' ? a[0] + ' := ' + a[0] + ' + 1' : o.k === 'DEC' ? a[0] + ' := ' + a[0] + ' - 1'
          : a[2] + ' := ' + a[0] + ' ' + ({ ADD:'+', SUB:'-', MUL:'*', DIV:'/' })[o.k] + ' ' + a[1];
        emit('IF ' + F + ' THEN ' + body + '; END_IF;');
      }
    });
  });
  return { scl: out.join('\n'), fb, vars, lineMap, prog };
}

/* ---------- verwendete Konstrukte (für must-Prüfungen) ---------- */
function constructs(prog){
  const s = new Set();
  const walk = e => {
    if(!e) return;
    if(e.t === 'c'){ s.add(e.edge ? 'EDGE_' + e.edge : e.neg ? 'NC' : 'NO'); }
    else if(e.t === 'cmp'){ s.add('CMP'); }
    else if(e.t === 'box'){ s.add(e.k); }
    else if(e.t === 'p'){ s.add('PARALLEL'); e.items.forEach(walk); }
    else if(e.t === 's'){ if(e.items.length > 1) s.add('SERIES'); e.items.forEach(walk); }
  };
  prog.networks.forEach(n => {
    walk(n.expr);
    n.outs.forEach(o => { if(o.t === 'coil') s.add(o.mode === 'S' ? 'SET' : o.mode === 'R' ? 'RESET' : o.mode === 'NOT' ? 'NCOIL' : 'COIL'); else s.add(o.k); });
    if(n.outs.length > 1) s.add('MULTI_OUT');
  });
  if(prog.networks.length > 1) s.add('NETWORKS');
  return s;
}
function elementCount(src){
  const prog = typeof src === 'string' ? parse(src) : src; let c = 0;
  const walk = e => { if(!e) return; if(e.t === 's' || e.t === 'p') e.items.forEach(walk); else c++; };
  prog.networks.forEach(n => { walk(n.expr); c += n.outs.length; });
  return c;
}

/* ---------- Anbindung an die SCL-Engine ---------- */
// Liefert eine Engine mit gleicher Schnittstelle, die KOP-Aufgaben (t.lang === 'kop') übersetzt.
function wrapEngine(E){
  const W = Object.assign({}, E);
  W.compileSCL = function(code, t){
    if(!t || t.lang !== 'kop') return E.compileSCL(code, t);
    let tr;
    try{ tr = toSCL(code); }
    catch(e){ if(e instanceof KOPError){ const x = new E.SCLError('syntax', e.message, e.line, 1); x.net = e.net; throw x; } throw e; }
    const decl = { vars: Object.assign({}, t.initialVars || {}, tr.vars), fbTypes: Object.assign({}, t.fbTypes || {}, tr.fb), varTypes: t.varTypes || {} };
    let prog;
    try{ prog = E.compileSCL(tr.scl, decl); }
    catch(e){
      if(e && e.line){ const l = tr.lineMap[e.line - 1]; const nw = tr.prog.networks.findIndex(n => (n.rungLine || n.line) === l) + 1;
        const m = String(e.message).replace(/\b_f\d+_\d+\b/g, 'Stromfluss').replace(/Zeile \d+/g, '');
        const ke = new E.SCLError(e.kind || 'semantic', (nw ? 'Netzwerk ' + nw + ': ' : '') + m, l || 0, 1); ke.net = nw; throw ke; }
      throw e;
    }
    prog.kop = tr.prog; prog.kopSCL = tr.scl;
    return prog;
  };
  W.constructsUsed = function(prog){
    const s = E.constructsUsed(prog);
    if(prog && prog.kop) constructs(prog.kop).forEach(k => s.add(k));
    return s;
  };
  W.SCLError = E.SCLError;
  return W;
}

root.KOP = { parse, serialize, toSCL, exprText, outText, constructs, elementCount, wrapEngine, KOPError, BOXES, OUTBOX, CMP };
if(typeof module !== 'undefined' && module.exports) module.exports = root.KOP;
})(typeof window !== 'undefined' ? window : globalThis);
