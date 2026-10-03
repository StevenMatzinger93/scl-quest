(function(root){
"use strict";
/* ============================================================
   KOP (Kontaktplan) — Datenmodell, Textformat, Übersetzung nach SCL
   ------------------------------------------------------------
   Ein Programm besteht aus Netzwerken. Jedes Netzwerk hat einen oder
   mehrere Strompfade (Ketten, je eine Zeile, Reihenfolge = Ausführung),
   jeder Strompfad einen Ausdruck und einen oder mehrere Ausgänge.

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
               => MOVE(5, Ziel)  => ADD(A, B, Ziel)  SUB MUL DIV  => NORM_X(0, Roh, 27648, Anteil)  => SCALE_X(0.0, Anteil, 100.0, Wert)
               => INC(Z) / DEC(Z)  (Zähler um 1 ändern)

   Erweiterungen (V4 „Editor ohne Grenzen“, alle alten Texte bleiben gleichbedeutend):
     mehrere Strompfade je NETWORK   jede Zeile „… => …;“ ist ein eigener Strompfad
     NOT ( … )  NOT P(x)  NOT [a > b]   Negation eines ganzen Teilausdrucks (für sich ausgewertet)
     P(A AND B)  N(…)                   Flanke einer Verknüpfung
     TON(T1, T#3S, IN:=(A AND B))       Box mit eigenem Eingang (IN, bei Zählern CU/CD oder IN):
                                        wirkt wie ein Kontakt auf Q, nimmt den Strom links NICHT als Eingang
     CTU(Z, PV:=5, R:=(Quit OR Neu))    Verknüpfungen an Wert-/Rücksetz-Eingängen (auch PT, PV, LD)
     SR(Q, A OR B)  SR(Q, R1:=…)        Verknüpfungen an Eingängen der Ausgangsboxen und Aufrufe (In := …)
     … => $Name;   $Name AND C => Y;    Draht: Zwischenergebnis einmal berechnen, im selben Netzwerk
                                        mehrfach verwenden (Hilfsvariable _w<Netzwerk>_<Name>, unsichtbar)
   Eine Kontaktplan-Box ohne IN in NOT(…), P(…) oder einem Parameter bekommt den Strom
   innerhalb dieses Teilausdrucks (am Anfang: 1). „NOT TON(T1, T#3S)“ in einer Reihe negiert Q
   der Box, deren IN wie gewohnt der Strom davor ist.

   Übersetzung: Jedes Element bekommt eine Stromfluss-Variable
   _f<Netzwerk>_<Element> (BOOL). Damit ist der Stromfluss in jedem
   Zyklus sichtbar (Online-Ansicht). Flanken: R_TRIG/F_TRIG-Instanzen
   _e<Netzwerk>_<Element>. Drähte: _w<Netzwerk>_<Name>. Ausführung über die SCL-Engine.
   ============================================================ */

class KOPError extends Error{
  constructor(message, line, net){ super(message); this.kind = 'syntax'; this.line = line || 0; this.col = 1; this.net = net || 0; }
}
const BOXES = { TON:'timer', TOF:'timer', TP:'timer', CTU:'counter', CTD:'counter' };
const BOX_IN = { TON:'IN', TOF:'IN', TP:'IN', CTU:'CU', CTD:'CD' };   // eigener Eingang einer funktionalen Box
const OUTBOX = { MOVE:2, ADD:3, SUB:3, MUL:3, DIV:3, INC:1, DEC:1, SR:2, RS:2, NORM_X:4, SCALE_X:4 };   // SR/RS (FUP): (Q, R-Operand) · NORM_X/SCALE_X: (MIN, VALUE, MAX, OUT)
// Anschlussnamen der Ausgangsboxen (optional „NAME:=“ vor einer Angabe) und Ziel-Stellen (nur Variable)
const OUTPINS = { MOVE:['IN','OUT'], ADD:['IN1','IN2','OUT'], SUB:['IN1','IN2','OUT'], MUL:['IN1','IN2','OUT'], DIV:['IN1','IN2','OUT'], INC:['IN'], DEC:['IN'],
  SR:['Q','R1'], RS:['Q','R'], NORM_X:['MIN','VALUE','MAX','OUT'], SCALE_X:['MIN','VALUE','MAX','OUT'] };
const OUTDEST = { MOVE:[1], ADD:[2], SUB:[2], MUL:[2], DIV:[2], INC:[0], DEC:[0], SR:[0], RS:[0], NORM_X:[3], SCALE_X:[3] };
const CMP = ['==', '<>', '>=', '<=', '>', '<'];
const KW = new Set(['AND','OR','XOR','NOT','P','N','S','R','NETWORK','TRUE','FALSE']);
const isWire = v => typeof v === 'string' && v.charAt(0) === '$';

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
    if((m = /^\$[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)))){ out.push({ t:'id', v:m[0] }); i += m[0].length; continue; }   // Draht
    if((m = /^(#?"[^"\n]+"|#?[A-Za-z_][A-Za-z0-9_]*)((\.("[^"\n]+"|[A-Za-z_][A-Za-z0-9_]*|%X\d+))|\[[^\]\s]+\])*/.exec(s.slice(i)))){
      const up = m[0].toUpperCase();
      out.push(KW.has(up) ? { t:'kw', v:up } : { t:'id', v:m[0] });
      i += m[0].length; continue;
    }
    throw new KOPError('Unbekanntes Zeichen "' + c + '".', line);
  }
  return out;
}

/* ---------- Parser ---------- */
function parse(src, opts){
  const off = (opts && opts.lineOffset) || 0;
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const nets = [];
  let cur = null;
  lines.forEach((raw, idx) => {
    const ln = idx + 1 + off, s = raw.trim();
    if(!s || s.startsWith('//')) return;
    const mNet = /^NETWORK\b\s*(.*)$/i.exec(s);
    if(mNet){ cur = { title: mNet[1].trim(), line: ln, expr: null, outs: [], rungLine: 0 }; nets.push(cur); return; }
    if(!cur){ cur = { title: '', line: ln, expr: null, outs: [], rungLine: 0 }; nets.push(cur); }
    const r = parseRung(tokens(s, ln), ln, nets.length);
    if(!cur.expr){ cur.expr = r.expr; cur.outs = r.outs; cur.rungLine = ln; }
    else (cur.rungs = cur.rungs || []).push(r);   // weitere Strompfade (Ketten) im selben Netzwerk
  });
  return { networks: nets };
}
// Alle Strompfade eines Netzwerks; der erste ist immer n.expr / n.outs (so bearbeitet ihn der Editor)
function rungsOf(n){
  if(!n || !n.expr) return [];
  return [{ expr: n.expr, outs: n.outs, line: n.rungLine || n.line }].concat(n.rungs || []);
}
function mkNot(x){
  if(x.t === 'c' && !x.edge) return Object.assign({}, x, { neg: !x.neg });
  if(x.t === 'not') return x.e;
  return { t:'not', e:x };
}
function parseRung(tk, ln, nNo){
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
  const isOperandTok = t => t && ((t.t === 'op' && t.v === '?') || t.t === 'id' || t.t === 'lit' || (t.t === 'kw' && (t.v === 'TRUE' || t.v === 'FALSE')));
  const operand = () => {
    if(isOp('?')){ p++; return '?'; }
    const t = next(); if(!isOperandTok(t)) fail('Wert oder Variable erwartet.');
    return t.v;
  };
  // Wert an einem Eingang: einzelner Operand (wie bisher) oder eine Verknüpfung (z.B. R:=(A OR B), R:=NOT Lauf)
  const param = () => {
    const t = peek(), n = tk[p + 1];
    if(isOperandTok(t) && (!n || (n.t === 'op' && (n.v === ',' || n.v === ')')))) return operand();
    if(!t || (t.t === 'op' && (t.v === ',' || t.v === ')'))) fail('Wert oder Variable erwartet.');
    const e = expr();
    return e.t === 'c' && !e.neg && !e.edge ? e.v : e;
  };
  const isBoxStart = () => peek() && peek().t === 'id' && BOXES[peek().v.toUpperCase()] && tk[p + 1] && tk[p + 1].t === 'op' && tk[p + 1].v === '(';
  function expr(){
    const items = [xterm()];
    while(isKw('OR')){ p++; items.push(xterm()); }
    return items.length === 1 ? items[0] : { t:'p', items: items.flatMap(x => x.t === 'p' ? x.items : [x]) };
  }
  function xterm(){   // XOR bindet stärker als OR, schwächer als AND (wie SCL)
    const items = [term()];
    while(isKw('XOR')){ p++; items.push(term()); }
    return items.length === 1 ? items[0] : { t:'x', items: items.flatMap(x => x.t === 'x' ? x.items : [x]) };
  }
  function term(){
    const items = [factor()];
    while(isKw('AND')){ p++; items.push(factor()); }
    return items.length === 1 ? items[0] : { t:'s', items: items.flatMap(x => x.t === 's' ? x.items : [x]) };
  }
  function factor(){
    const t = peek(); if(!t) fail('Der Strompfad ist unvollständig.');
    if(t.t === 'kw' && t.v === 'NOT'){
      p++;
      if(!peek()) fail('Nach NOT fehlt ein Kontakt oder eine Klammer.');
      if(isOp('?') || (peek().t === 'id' && !isBoxStart())) return { t:'c', v: ident('Variable nach NOT'), neg:true };
      return mkNot(factor());
    }
    if(t.t === 'kw' && (t.v === 'P' || t.v === 'N')){
      p++; expect('(');
      if((isOp('?') || (peek() && peek().t === 'id')) && tk[p + 1] && tk[p + 1].t === 'op' && tk[p + 1].v === ')'){ const v = ident(); expect(')'); return { t:'c', v, edge: t.v }; }
      if(isOp(')')) fail('Die Flanke ' + t.v + '( ) braucht einen Operanden.');
      const x = expr(); expect(')');
      return x.t === 'c' && !x.neg && !x.edge ? { t:'c', v: x.v, edge: t.v } : { t:'edge', edge: t.v, e: x };
    }
    if(t.t === 'kw' && t.v === 'TRUE'){ p++; return { t:'s', items: [] }; }
    if(isOp('(')){ p++; const e = expr(); expect(')'); return e; }
    if(isOp('[')){ p++; const a = operand(); const o = next(); if(!o || o.t !== 'op' || !CMP.includes(o.v)) fail('Vergleichsoperator (==, <>, >, >=, <, <=) erwartet.'); const b = operand(); expect(']'); return { t:'cmp', a, op:o.v, b }; }
    if(isBoxStart()){
      p += 2; const k = t.v.toUpperCase(); const inst = ident('Instanzname');
      const prm = {};
      while(isOp(',')){
        p++;
        if(peek() && (peek().t === 'id' || peek().t === 'kw') && tk[p + 1] && tk[p + 1].v === ':='){
          let n = next().v.toUpperCase(); p++;
          if(n === 'IN' && BOX_IN[k] !== 'IN') n = BOX_IN[k];   // CTU(Z, PV:=5, IN:=x) = CU:=x
          if(prm[n] !== undefined) fail(k + ': der Eingang ' + n + ' ist doppelt angegeben.');
          prm[n] = param();
        }
        else prm[BOXES[k] === 'timer' ? 'PT' : 'PV'] = param();
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
      p += 2; const k = t.v.toUpperCase(); const args = [];
      do{
        if(args.length) p++;
        const i = args.length;
        if(peek() && (peek().t === 'id' || peek().t === 'kw') && tk[p + 1] && tk[p + 1].v === ':='){   // optionaler Anschlussname, z.B. SR(Q, R1:=…)
          const nm = next().v.toUpperCase(); p++;
          if(OUTPINS[k][i] !== nm) fail(k + ': an Stelle ' + (i + 1) + ' steht ' + (OUTPINS[k][i] ? 'der Anschluss ' + OUTPINS[k][i] : 'kein Anschluss mehr') + ', nicht ' + nm + '.');
        }
        args.push(OUTDEST[k].includes(i) ? operand() : param());
      } while(isOp(','));
      expect(')');
      if(args.length !== OUTBOX[k]) fail(k + ' braucht ' + OUTBOX[k] + ' Angabe' + (OUTBOX[k] > 1 ? 'n' : '') + '.');
      outs.push({ t:'op', k, args });
    }
    else if((t.t === 'id' || (t.t === 'op' && t.v === '?')) && tk[p + 1] && tk[p + 1].v === '('){
      // Bausteinaufruf: "FB_X_DB"(In := a, Out => b) · #Multi(…) · FC_X(…, Ret_Val => r)
      p += 2; const args = [];
      if(!isOp(')')) do{
        if(args.length) p++;
        const n = next(); if(!n || (n.t !== 'id' && n.t !== 'kw')) fail('Parametername erwartet (z.B. Start := #Taster).');
        const d = peek(); if(!d || d.t !== 'op' || (d.v !== ':=' && d.v !== '=>')) fail('Nach dem Parameter ' + n.v + ' fehlt ":=" (Eingang) oder "=>" (Ausgang).');
        p++; args.push({ n: n.v, d: d.v, v: d.v === ':=' ? param() : operand() });
      } while(isOp(','));
      expect(')');
      outs.push({ t:'call', target: t.v, args });
    }
    else outs.push({ t:'coil', mode:'', v: ident('Spule') });
  } while(isOp(','));
  if(isOp(';')) p++;
  if(p < tk.length) fail('Unerwartet nach den Spulen: "' + tk[p].v + '".');
  return { expr: e, outs, line: ln };
}

/* ---------- Baum durchlaufen ---------- */
// Teilausdrücke eines Elements (Reihe/Parallel/XOR, Negation, Flanke, Verknüpfungen an Box-Eingängen)
function kidsOf(e){
  if(!e || typeof e !== 'object') return [];
  if(e.items) return e.items;
  if(e.t === 'not' || e.t === 'edge') return [e.e];
  if(e.t === 'box') return Object.keys(e.p).map(k => e.p[k]).filter(v => v && typeof v === 'object');
  return [];
}
const outExprs = o => (o.t === 'op' ? o.args : o.t === 'call' ? o.args.map(a => a.v) : []).filter(v => v && typeof v === 'object');
// fn(element, netIndex, rung) für jedes Element aller Strompfade (inkl. Ausdrücke an Ausgangsbox-/Aufruf-Eingängen)
function walk(prog, fn){
  const rec = (e, ni, r) => { if(!e) return; fn(e, ni, r); kidsOf(e).forEach(x => rec(x, ni, r)); };
  prog.networks.forEach((n, ni) => rungsOf(n).forEach(r => { rec(r.expr, ni, r); r.outs.forEach(o => outExprs(o).forEach(x => rec(x, ni, r))); }));
}
// Nutzt das Programm Formen, die der alte Netzwerk-Editor (kop_editor.js) nicht zeichnen kann?
function isExtended(prog){
  let ext = false;
  prog.networks.forEach(n => { if(n.rungs && n.rungs.length) ext = true; rungsOf(n).forEach(r => r.outs.forEach(o => { if(outExprs(o).length || (o.t === 'coil' && isWire(o.v)) || (o.t === 'op' && o.args.some(isWire)) || (o.t === 'call' && o.args.some(a => isWire(a.v)))) ext = true; })); });
  walk(prog, e => {
    if(e.t === 'not' || e.t === 'edge') ext = true;
    else if(e.t === 'c' && isWire(e.v)) ext = true;
    else if(e.t === 'cmp' && (isWire(e.a) || isWire(e.b))) ext = true;
    else if(e.t === 'box' && (e.p[BOX_IN[e.k]] !== undefined || Object.keys(e.p).some(k => typeof e.p[k] === 'object' || isWire(e.p[k])))) ext = true;
  });
  return ext;
}

/* ---------- Text erzeugen ---------- */
// Wert an einem Eingang: Operand wie er ist, Verknüpfungen in Klammern
function paramText(v){
  if(!v || typeof v !== 'object') return String(v);
  return v.t === 's' && v.items.length > 1 || v.t === 'p' || v.t === 'x' ? '(' + exprText(v, true) + ')' : exprText(v, false);
}
function exprText(e, top){
  switch(e.t){
    case 'c': return e.edge ? e.edge + '(' + e.v + ')' : (e.neg ? 'NOT ' : '') + e.v;
    case 'cmp': return '[' + e.a + ' ' + e.op + ' ' + e.b + ']';
    case 'box': {
      const inK = BOX_IN[e.k], keys = Object.keys(e.p).filter(k => k !== inK).concat(e.p[inK] !== undefined ? [inK] : []);
      const ps = keys.map(k => (BOXES[e.k] === 'timer' && k === 'PT') ? paramText(e.p[k]) : k + ':=' + paramText(e.p[k]));
      return e.k + '(' + [e.inst].concat(ps).join(', ') + ')';
    }
    case 'not': return 'NOT ' + paramText(e.e);
    case 'edge': return e.edge + '(' + exprText(e.e, true) + ')';
    case 's': return e.items.length ? e.items.map(x => exprText(x, false)).join(' AND ') : 'TRUE';
    case 'p': { const s = e.items.map(x => exprText(x, true)).join(' OR '); return top ? s : '(' + s + ')'; }
    case 'x': { const s = e.items.map(x => exprText(x, false)).join(' XOR '); return top ? s : '(' + s + ')'; }
  }
  return '?';
}
function outText(o){
  if(o.t === 'call') return o.target + '(' + o.args.map(a => a.n + ' ' + a.d + ' ' + paramText(a.v)).join(', ') + ')';
  if(o.t === 'op') return o.k + '(' + o.args.map(paramText).join(', ') + ')';
  return (o.mode ? o.mode + ' ' : '') + o.v;
}
function rungText(expr, outs){
  return (expr && expr.t === 's' && !expr.items.length ? '' : exprText(expr || { t:'c', v:'?' }, true) + ' ') + '=> ' + (outs.length ? outs : [{ t:'coil', mode:'', v:'?' }]).map(outText).join(', ') + ';';
}
function serialize(prog){
  return prog.networks.map((n, i) => 'NETWORK ' + (n.title || ('Netzwerk ' + (i + 1))) + '\n' +
    [rungText(n.expr, n.outs)].concat((n.expr && n.rungs || []).map(r => rungText(r.expr, r.outs))).join('\n')).join('\n\n') + '\n';
}

/* ---------- Übersetzung nach SCL ---------- */
function toSCL(src, opts){
  const dry = !!(opts && opts.dry);   // dry: nur nummerieren (Anzeige), offene Stellen erlaubt
  const pro = !!(opts && opts.pro);   // pro: Timer/Zähler-Instanzen deklariert der Baustein selbst
  const prog = typeof src === 'string' ? parse(src) : src;
  const out = [], fb = {}, vars = {}, lineMap = [];
  prog.networks.forEach((n, ni) => {
    const N = ni + 1; let id = 0, curLine = n.rungLine || n.line;
    const wires = {};   // Drähte dieses Netzwerks: kleingeschrieben → { name, def }
    const emit = (s) => { out.push(s); lineMap.push(curLine); };
    const newF = () => { const v = '_f' + N + '_' + (++id); vars[v] = false; return v; };
    const and = (a, b) => a === 'TRUE' ? b : a + ' AND ' + b;
    const when = (f, st) => f === 'TRUE' ? st : 'IF ' + f + ' THEN ' + st + ' END_IF;';
    const err = m => new KOPError('Netzwerk ' + N + ': ' + m, curLine, N);
    const need = (v, what) => { if(v === '?' && !dry) throw err(what + ' hat noch keine Variable.'); return v; };
    const wireRead = v => {
      const w = wires[v.toLowerCase()];
      if(w && w.def) return w.name;
      if(dry) return '_w' + N + '_' + v.slice(1);
      throw err('Der Draht ' + v + ' ist hier noch nicht belegt. Belege ihn in einem Strompfad davor mit „… => ' + v + ';“ (Drähte gelten nur im selben Netzwerk).');
    };
    const opnd = v => { need(v, 'Ein Operand'); return isWire(v) ? wireRead(v) : v; };
    const dest = (v, what) => { need(v, what || 'Ein Ziel'); if(isWire(v)) throw err('Der Draht ' + v + ' kann nur mit einer einfachen Zuweisung „=> ' + v + '“ belegt werden.'); return v; };
    const val = x => x && typeof x === 'object' ? comp(x, 'TRUE') : opnd(x);   // Eingangswert: Operand oder eigene Verknüpfung
    function comp(e, inF){
      let f;
      switch(e.t){
        case 'c': {
          const v0 = need(e.v, 'Ein Kontakt'), v = isWire(v0) ? wireRead(v0) : v0;
          if(e.edge){
            const inst = '_e' + N + '_' + (id + 1); fb[inst] = e.edge === 'P' ? 'R_TRIG' : 'F_TRIG';
            emit(inst + '(CLK := ' + v + ');');
            f = newF(); emit(f + ' := ' + and(inF, inst + '.Q') + ';');
          } else { f = newF(); emit(f + ' := ' + and(inF, (e.neg ? 'NOT ' : '') + v) + ';'); }
          e._f = f; return f;
        }
        case 'edge': {   // Flanke einer Verknüpfung: P(A AND B)
          const g = comp(e.e, 'TRUE');
          const inst = '_e' + N + '_' + (id + 1); fb[inst] = e.edge === 'P' ? 'R_TRIG' : 'F_TRIG';
          emit(inst + '(CLK := ' + g + ');');
          f = newF(); emit(f + ' := ' + and(inF, inst + '.Q') + ';');
          e._f = f; return f;
        }
        case 'not': {
          if(e.e.t === 'box' && e.e.p[BOX_IN[e.e.k]] === undefined){   // Kontaktplan-Box: Strom davor ist IN, negiert wird Q
            const g = comp(e.e, inF); f = newF(); emit(f + ' := NOT ' + g + ';');
          } else { const g = comp(e.e, 'TRUE'); f = newF(); emit(f + ' := ' + and(inF, 'NOT ' + g) + ';'); }
          e._f = f; return f;
        }
        case 'cmp': {
          f = newF(); emit(f + ' := ' + and(inF, '(' + opnd(e.a) + ' ' + (e.op === '==' ? '=' : e.op) + ' ' + opnd(e.b) + ')') + ';');
          e._f = f; return f;
        }
        case 'box': {
          const inst = need(e.inst, 'Eine ' + e.k + '-Box');
          if(isWire(inst)) throw err('Ein Draht (' + inst + ') kann keine ' + e.k + '-Instanz sein.');
          if(!pro) fb[inst] = e.k;
          const own = e.p[BOX_IN[e.k]] !== undefined;   // funktionale Box: eigener Eingang, wirkt wie ein Kontakt auf Q
          const inB = own ? val(e.p[BOX_IN[e.k]]) : inF === 'TRUE' ? 'TRUE' : inF;
          let call;
          if(e.k === 'CTU'){ const r = val(e.p.R || 'FALSE'); call = inst + '(CU := ' + inB + ', R := ' + r + ', PV := ' + val(e.p.PV) + ');'; }
          else if(e.k === 'CTD'){ const ld = val(e.p.LD || 'FALSE'); call = inst + '(CD := ' + inB + ', LD := ' + ld + ', PV := ' + val(e.p.PV) + ');'; }
          else call = inst + '(IN := ' + inB + ', PT := ' + val(e.p.PT) + ');';
          emit(call);
          f = newF(); emit(f + ' := ' + (own ? and(inF, inst + '.Q') : inst + '.Q') + ';');
          e._f = f; return f;
        }
        case 's': { f = inF; e.items.forEach(x => { f = comp(x, f); }); e._f = f; return f; }
        case 'p': {
          const fs = e.items.map(x => comp(x, inF));
          f = newF(); emit(f + ' := ' + fs.join(' OR ') + ';'); e._f = f; return f;
        }
        case 'x': {   // (inF AND a) XOR (inF AND b) … = inF AND (a XOR b …)
          const fs = e.items.map(x => comp(x, inF));
          f = newF(); emit(f + ' := ' + fs.join(' XOR ') + ';'); e._f = f; return f;
        }
      }
      throw err('unbekanntes Element.');
    }
    emit('// Netzwerk ' + N + (n.title ? ': ' + n.title : ''));
    if(!n.expr){ if(dry) return; throw new KOPError('Netzwerk ' + N + ' ist leer.', n.line, N); }
    rungsOf(n).forEach((r, ri) => {
      curLine = r.line || n.line;
      const F = comp(r.expr, 'TRUE');
      if(ri === 0) n._f = F; else r._f = F;
      if(!r.outs.length && !dry) throw new KOPError('Netzwerk ' + N + ' hat keine Spule.', curLine, N);
      r.outs.forEach(o => {
        if(o.t === 'coil'){
          const v = need(o.v, 'Eine Spule');
          if(isWire(v)){
            if(o.mode) throw err('Der Draht ' + v + ' kann nur mit einer einfachen Zuweisung „=> ' + v + '“ belegt werden (nicht ' + (o.mode === 'NOT' ? 'negiert' : o.mode) + ').');
            const k = v.toLowerCase();
            if(wires[k] && wires[k].def) throw err('Der Draht ' + v + ' ist schon belegt. Jeder Draht bekommt genau einmal einen Wert.');
            const name = '_w' + N + '_' + v.slice(1); wires[k] = { name, def:true }; vars[name] = false;
            emit(name + ' := ' + F + ';');
          }
          else if(o.mode === 'S') emit(when(F, v + ' := TRUE;'));
          else if(o.mode === 'R') emit(when(F, v + ' := FALSE;'));
          else if(o.mode === 'NOT') emit(v + ' := NOT ' + F + ';');
          else emit(v + ' := ' + F + ';');
        } else if(o.t === 'call'){
          const tg = need(o.target, 'Ein Aufruf');
          const ins = o.args.filter(a => a.d === ':=').map(a => a.n + ' := ' + val(a.v));
          const outs2 = o.args.filter(a => a.d === '=>' && !/^ret_val$/i.test(a.n)).map(a => a.n + ' => ' + dest(a.v, 'Ein Operand'));
          const ret = o.args.find(a => a.d === '=>' && /^ret_val$/i.test(a.n));
          const call = (ret ? dest(ret.v, 'Ein Operand') + ' := ' : '') + tg + '(' + ins.concat(outs2).join(', ') + ');';
          emit(when(F, call));
        } else {
          const a = o.args.map((x, i) => OUTDEST[o.k].includes(i) ? dest(x, 'Ein Operand') : val(x));
          if(o.k === 'SR'){ emit(when(F, a[0] + ' := TRUE;')); emit('IF ' + a[1] + ' THEN ' + a[0] + ' := FALSE; END_IF;'); return; }   // Rücksetzen dominant
          if(o.k === 'RS'){ emit('IF ' + a[1] + ' THEN ' + a[0] + ' := FALSE; END_IF;'); emit(when(F, a[0] + ' := TRUE;')); return; }   // Setzen dominant
          const body = o.k === 'NORM_X' || o.k === 'SCALE_X' ? a[3] + ' := ' + o.k + '(MIN := ' + a[0] + ', VALUE := ' + a[1] + ', MAX := ' + a[2] + ')'
            : o.k === 'MOVE' ? a[1] + ' := ' + a[0] : o.k === 'INC' ? a[0] + ' := ' + a[0] + ' + 1' : o.k === 'DEC' ? a[0] + ' := ' + a[0] + ' - 1'
            : a[2] + ' := ' + a[0] + ' ' + ({ ADD:'+', SUB:'-', MUL:'*', DIV:'/' })[o.k] + ' ' + a[1];
          emit(when(F, body + ';'));
        }
      });
    });
  });
  return { scl: out.join('\n'), fb, vars, lineMap, prog };
}

/* ---------- Fachbegriffe je Darstellung ---------- */
// Fehlermeldungen sind im Kontaktplan formuliert; im Funktionsplan heissen die Elemente anders.
const FUP_WORDS = [[/Ein Kontakt/g, 'Ein Eingang'], [/Eine Spule/g, 'Eine Zuweisung'], [/Kontakten/g, 'Eingängen'], [/Kontakt/g, 'Eingang'], [/Spulen/g, 'Zuweisungen'], [/Spule/g, 'Zuweisung'], [/Strompfad/g, 'Verknüpfung'], [/Stromfluss/g, 'Signal']];
function words(msg){ const q = root.QUEST; return q && q.lang === 'fup' ? FUP_WORDS.reduce((m, [a, b]) => m.replace(a, b), String(msg)) : String(msg); }

/* ---------- verwendete Konstrukte (für must-Prüfungen) ---------- */
function constructs(prog){
  const s = new Set();
  let rungs = 0;
  walk(prog, e => {
    if(e.t === 'c'){ s.add(e.edge ? 'EDGE_' + e.edge : e.neg ? 'NC' : 'NO'); if(isWire(e.v)) s.add('WIRE'); }
    else if(e.t === 'edge'){ s.add('EDGE_' + e.edge); }
    else if(e.t === 'not'){ s.add('NC'); s.add('NOT'); }   // negierter Teilausdruck (FUP: negierter Eingang)
    else if(e.t === 'cmp'){ s.add('CMP'); }
    else if(e.t === 'box'){ s.add(e.k); }
    else if(e.t === 'p'){ s.add('PARALLEL'); }
    else if(e.t === 's'){ if(e.items.length > 1) s.add('SERIES'); }
    else if(e.t === 'x'){ s.add('XOR'); }
  });
  prog.networks.forEach(n => {
    rungsOf(n).forEach(r => {
      rungs++;
      r.outs.forEach(o => { if(o.t === 'coil'){ if(isWire(o.v)) s.add('WIRE'); else s.add(o.mode === 'S' ? 'SET' : o.mode === 'R' ? 'RESET' : o.mode === 'NOT' ? 'NCOIL' : 'COIL'); } else if(o.t === 'call') s.add('CALL'); else s.add(o.k); });
      if(r.outs.length > 1) s.add('MULTI_OUT');
    });
    if(n.rungs && n.rungs.length) s.add('RUNGS');
  });
  if(prog.networks.length > 1 || rungs > 1) s.add('NETWORKS');   // mehrere Strompfade in einem Netzwerk zählen wie mehrere Netzwerke
  return s;
}
function elementCount(src){
  const prog = typeof src === 'string' ? parse(src) : src; let c = 0;
  walk(prog, e => { if(e.t !== 's' && e.t !== 'p' && e.t !== 'x' && e.t !== 'not') c++; });
  prog.networks.forEach(n => rungsOf(n).forEach(r => { c += r.outs.length; }));
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
    catch(e){ if(e instanceof KOPError){ const x = new E.SCLError('syntax', words(e.message), e.line, 1); x.net = e.net; throw x; } throw e; }
    const decl = { vars: Object.assign({}, t.initialVars || {}, tr.vars), fbTypes: Object.assign({}, t.fbTypes || {}, tr.fb), varTypes: t.varTypes || {} };
    let prog;
    try{ prog = E.compileSCL(tr.scl, decl); }
    catch(e){
      if(e && e.line){ const l = tr.lineMap[e.line - 1]; const nw = netOfLine(tr.prog, l);
        const m = internalNames(String(e.message)).replace(/Zeile \d+/g, '');
        const ke = new E.SCLError(e.kind || 'semantic', words((nw ? 'Netzwerk ' + nw + ': ' : '') + m), l || 0, 1); ke.net = nw; throw ke; }
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

/* ---------- Profi-Stufe: ganze Bausteine mit KOP-Rumpf ----------
   Ein Baustein ist SCL-Kopf (Deklarationen) + BEGIN + Netzwerke + END_…:
     FUNCTION_BLOCK "FB_Tuer"
     VAR_INPUT Kabine_da : Bool; END_VAR …
     BEGIN
     NETWORK Tuer oeffnen
     #Kabine_da AND TON(#T_Tuer, T#2S) => #Tuer_Auf;
     END_FUNCTION_BLOCK
   Die Übersetzung behält die Zeilennummern: alle SCL-Anweisungen eines Strompfads
   stehen auf dessen Zeile. Stromfluss-Variablen werden als VAR_TEMP, Flanken-
   Instanzen (nur im FB) als statische Variablen vor BEGIN ergänzt. */
function splitBlock(src){
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  if(/^\s*(TYPE|DATA_BLOCK)\b/im.test(src)) return null;   // Datentyp / Datenbaustein: kein Rumpf mit Netzwerken
  const b = lines.findIndex(l => /^\s*BEGIN\b/i.test(l));
  if(b < 0) return null;
  let e = -1;
  for(let i = lines.length - 1; i > b; i--) if(/^\s*END_(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/i.test(lines[i])){ e = i; break; }
  if(e < 0) e = lines.length;
  const kindM = /\b(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/i.exec(lines.slice(0, b).join('\n'));
  return { head: lines.slice(0, b + 1).join('\n') + '\n', body: lines.slice(b + 1, e).join('\n'), foot: e < lines.length ? '\n' + lines.slice(e).join('\n') : '',
    offset: b + 1, kind: kindM ? ({ FUNCTION_BLOCK:'FB', FUNCTION:'FC', ORGANIZATION_BLOCK:'OB' })[kindM[1].toUpperCase()] : '' };
}
const isKopBody = body => /^\s*NETWORK\b/im.test(body) || !body.trim();
// Baustein-Quelle → SCL-Quelle mit gleichen Zeilen
function proSource(src, block){
  const sp = splitBlock(src);
  if(!sp || !isKopBody(sp.body)) return { src, kop: null };
  const prog = parse(sp.body, { lineOffset: sp.offset });
  const tr = toSCL(prog, { pro:true });
  const per = {};
  tr.scl.split('\n').forEach((l, i) => { if(/^\s*\/\//.test(l)) return; const ln = tr.lineMap[i]; (per[ln] = per[ln] || []).push(l); });
  const bodyLines = sp.body.split('\n').map((_, i) => (per[i + 1 + sp.offset] || []).join(' '));
  const edges = Object.keys(tr.fb);
  if(edges.length && sp.kind !== 'FB'){
    let n = null, line = 0; walk(prog, (e, ni, r) => { if(!n && (e.t === 'edge' || (e.t === 'c' && e.edge))){ n = prog.networks[ni]; line = r.line; } });
    throw new KOPError('Netzwerk ' + (prog.networks.indexOf(n) + 1) + ': Flankenkontakte (P/N) brauchen einen Speicher für den alten Zustand. In ' + (sp.kind === 'FC' ? 'einer FC' : 'einem OB') + ' gibt es keinen — verwende einen FB (statische Variable) oder rufe die Flanke in einem FB auf.', n ? line || n.line : sp.offset, 0);
  }
  const temps = Object.keys(tr.vars);
  const decl = (temps.length ? 'VAR_TEMP ' + temps.map(v => v + ' : Bool;').join(' ') + ' END_VAR ' : '') + (edges.length ? 'VAR ' + edges.map(v => v + ' : ' + tr.fb[v] + ';').join(' ') + ' END_VAR ' : '');
  const head = sp.head.replace(/^(\s*)BEGIN\b/im, (m, ws) => ws + decl + 'BEGIN');
  return { src: head + bodyLines.join('\n') + sp.foot, kop: prog, split: sp };
}
const INTERNAL = /\b_[fe]\d+_\d+\b|\b_w\d+_[A-Za-z0-9_]+/;
// Hilfsnamen der Übersetzung in Fehlermeldungen lesbar machen
const internalNames = m => m.replace(/\b_f\d+_\d+\b/g, 'Stromfluss').replace(/\b_e\d+_\d+\b/g, 'Flanke').replace(/\b_w\d+_([A-Za-z0-9_]+)/g, 'Draht $$$1');
function netOfLine(prog, line){ let k = 0; prog.networks.forEach((n, i) => { if(n.line <= line) k = i + 1; }); return k; }
// Profi-Engine mit KOP-Bausteinen (gleiche Schnittstelle wie SCLPro)
function wrapPro(P){
  if(P.__kop) return P;
  const W = Object.assign({}, P, { __kop:true });
  W.compileProject = function(project){
    const kopBlocks = {};
    const sources = project.sources.map(x => {
      let r;
      try{ r = proSource(x.src, x.block); }
      catch(e){ if(e instanceof KOPError){ const er = new P.SCLError('syntax', words(e.message), e.line, 1); er.block = x.block; er.net = e.net; throw er; } throw e; }
      if(r.kop){
        kopBlocks[x.block] = r.kop;
        // Box-Typ (TON/TOF/TP/CTU/CTD) muss zum deklarierten Typ der Instanz passen
        let rows = []; try{ const ifc = W.readInterface(x.src); rows = ifc ? ifc.rows : []; }catch(e){}
        const types = {}; rows.forEach(rw => { types[rw.name.toLowerCase()] = String(rw.type).toUpperCase(); });
        walk(r.kop, (e, ni, rung) => {
          if(e.t !== 'box') return;
          const nm = String(e.inst).replace(/^#/, '').toLowerCase(), ty = types[nm];
          if(ty && BOXES[ty] && ty !== e.k){ const er = new P.SCLError('semantic', 'Netzwerk ' + (ni + 1) + ': ' + e.inst + ' ist als ' + ty + ' deklariert, die Box ist aber ein ' + e.k + '. Box-Typ und Instanz müssen zusammenpassen.', rung.line, 1); er.block = x.block; er.net = ni + 1; throw er; }
        });
      }
      return Object.assign({}, x, { src: r.src });
    });
    let prog;
    try{ prog = P.compileProject(Object.assign({}, project, { sources })); }
    catch(e){
      if(e && e.message && kopBlocks[e.block]){
        const nw = netOfLine(kopBlocks[e.block], e.line);
        e.message = words((nw ? 'Netzwerk ' + nw + ': ' : '') + internalNames(String(e.message)));
        e.col = 1; e.net = nw;
      }
      throw e;
    }
    prog.warnings = (prog.warnings || []).filter(w => !INTERNAL.test(w.message || '') && !INTERNAL.test(w.name || ''));
    prog.kopBlocks = kopBlocks; prog.kopSources = {}; project.sources.forEach(x => { prog.kopSources[x.block] = x.src; });
    return prog;
  };
  W.constructsUsed = function(prog, blocks){
    const s = P.constructsUsed(prog, blocks);
    const mine = Object.keys(prog.kopBlocks || {}).filter(b => !blocks || blocks.includes(b));
    if(mine.length){
      // Hilfsvariablen der Übersetzung zählen nicht: TEMP/STAT/BOOL/R_TRIG/F_TRIG nur, wenn der Baustein sie selbst deklariert
      ['IF', 'TEMP', 'STAT', 'BOOL', 'R_TRIG', 'F_TRIG'].forEach(k => s.delete(k));
      mine.forEach(b => {
        let rows = []; try{ const ifc = W.readInterface(prog.kopSources[b]); rows = ifc ? ifc.rows : []; }catch(e){}
        rows.forEach(r => { if(r.sec === 'Temp') s.add('TEMP'); if(r.sec === 'Static') s.add('STAT'); const ty = String(r.type).toUpperCase(); if(ty === 'BOOL') s.add('BOOL'); if(ty === 'R_TRIG' || ty === 'F_TRIG') s.add(ty); });
        constructs(prog.kopBlocks[b]).forEach(k => s.add(k));
      });
    }
    return s;
  };
  const blank = src => { const sp = splitBlock(src); return sp && isKopBody(sp.body) ? { sp, src: sp.head + sp.body.replace(/[^\n]/g, ' ') + sp.foot } : { sp:null, src }; };
  W.readInterface = src => P.readInterface(blank(src).src);
  W.writeInterface = (src, rows) => {
    const b = blank(src); const out = P.writeInterface(b.src, rows);
    if(!b.sp) return out;
    const sp2 = splitBlock(out); return sp2.head + b.sp.body + sp2.foot;
  };
  return W;
}

root.KOP = { words, parse, serialize, toSCL, exprText, outText, paramText, rungText, rungsOf, walk, isExtended, isWire, constructs, elementCount, wrapEngine, wrapPro, splitBlock, proSource, isKopBody, KOPError, BOXES, BOX_IN, OUTBOX, OUTPINS, OUTDEST, CMP };
if(typeof module !== 'undefined' && module.exports) module.exports = root.KOP;
})(typeof window !== 'undefined' ? window : globalThis);
