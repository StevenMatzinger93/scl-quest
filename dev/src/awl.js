/* ===== AWL QUEST: Anweisungsliste (STL) für die S7-300 =====
   Ein AWL-Programm wird zeilentreu nach SCL übersetzt und läuft dann in denselben Engines wie SCL/KOP/FUP
   (engine.js für die Grundstufe, engine_pro.js für Bausteine).
   - Bitverknüpfung mit VKE (Verknüpfungsergebnis), Erstabfrage und ODER-Zweig: U UN O ON X XN, O (ohne Operand),
     Klammern U( UN( O( ON( X( XN( ), NOT SET CLR, = S R, FP FN (mit Flankenmerker).
   - Akkus: L T TAK, +I -I *I /I MOD, +D -D *D /D, +R -R *R /R, NEGI NEGR ABS SQRT, ITD DTR RND TRUNC ITR, INC DEC.
   - Vergleiche ==I <>I >I <I >=I <=I (auch D und R): setzen das VKE neu (AKKU2 op AKKU1).
   - Zeiten (nur Grundstufe) SE SA SI SV mit L S5T#…, Abfrage U T1; Zähler ZV ZR S R Z1, U Z1, L Z1.
   - Sprünge SPA SPB SPBN LOOP, BEA BEB, Sprungmarken „M1:“. Mit Sprüngen wird der Code als WHILE/CASE-Verteiler übersetzt.
   - Profi: Bausteine mit AWL-Rumpf, CALL "FC" / CALL "FB", "FB_DB" / CALL #Multi mit Parameterzeilen.
   Hilfsvariablen beginnen mit _q (werden in Anzeigen und Warnungen ausgeblendet).
   Status je Zeile (VKE, AKKU1, AKKU2) steht nach jedem Zyklus in _q<Zeile>v/_q<Zeile>a/_q<Zeile>b. */
(function(root){
'use strict';

class AWLError extends Error { constructor(msg, line){ super(msg); this.line = line || 0; this.name = 'AWLError'; } }
const fail = (msg, line) => { throw new AWLError(msg, line); };

const BITOPS = ['U', 'UN', 'O', 'ON', 'X', 'XN'];
const CMPOPS = ['==', '<>', '>', '<', '>=', '<='];
const ARITH = { '+':'+', '-':'-', '*':'*', '/':'/' };
const TIMERS = { SE:'TON', SA:'TOF', SV:'TP', SI:'TON' };
const INTERNAL = /\b_q\w*/;
const isTimer = o => /^T\d+$/i.test(o), isCounter = o => /^Z\d+$/i.test(o);

/* ---------- Zerlegen ---------- */
// Liefert je Zeile {line, label, op, arg, params?} oder null (leer/Kommentar/NETWORK)
function parse(src, opts){
  opts = opts || {};
  const off = opts.lineOffset || 0;
  const raw = String(src || '').replace(/\r/g, '').split('\n');
  const out = raw.map(() => null), labels = {};
  let lastCall = null;
  raw.forEach((l0, i) => {
    const line = i + 1 + off;
    let l = l0.replace(/\/\/.*$/, '').trim();
    if(!l){ return; }
    if(/^NETWORK\b/i.test(l)){ out[i] = { line, net:true, title: l.replace(/^NETWORK\s*/i, '') }; lastCall = null; return; }
    // Parameterzeile eines CALL:  Name := Wert   /   Name => Ziel
    const pm = /^([A-Za-z_]\w*)\s*(:=|=>)\s*(.+?)\s*[,;]?\s*$/.exec(l);
    if(pm && lastCall){ lastCall.params.push({ n: pm[1], d: pm[2], v: pm[3].trim(), line }); out[i] = { line, param:true }; return; }
    if(pm) fail('Zeile ' + line + ': „' + pm[1] + ' ' + pm[2] + ' …“ ist eine Parameterzeile — sie gehört direkt unter ein CALL.', line);
    lastCall = null;
    let label = null;
    const lm = /^([A-Za-z_]\w*)\s*:(?!=)\s*(.*)$/.exec(l);
    if(lm){ label = lm[1]; l = lm[2].trim();
      if(labels[label.toUpperCase()]) fail('Die Sprungmarke ' + label + ' gibt es zweimal.', line);
      labels[label.toUpperCase()] = line; }
    if(!l){ out[i] = { line, label, op:'' }; return; }
    let m = /^(UN|U|ON|O|XN|X)\s*\(\s*$/i.exec(l);
    if(m){ out[i] = { line, label, op: m[1].toUpperCase() + '(' }; return; }
    if(l === ')'){ out[i] = { line, label, op:')' }; return; }
    m = /^(==|<>|>=|<=|>|<)\s*([IDR])$/i.exec(l);
    if(m){ out[i] = { line, label, op:'CMP', cmp: m[1], ty: m[2].toUpperCase() }; return; }
    m = /^([+\-*/])\s*([IDR])$/i.exec(l);
    if(m){ out[i] = { line, label, op:'ARITH', ar: m[1], ty: m[2].toUpperCase() }; return; }
    m = /^CALL\s+(.+)$/i.exec(l);
    if(m){
      const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
      const x = { line, label, op:'CALL', target: parts[0], db: parts[1] || null, params: [] };
      if(!/^("[A-Za-z_]\w*"|#[A-Za-z_]\w*)$/.test(x.target)) fail('Zeile ' + line + ': CALL erwartet einen Baustein in Anführungszeichen ("FC_x") oder eine Multiinstanz (#Inst).', line);
      out[i] = x; lastCall = x; return;
    }
    m = /^(=|[A-Za-z]+)(?:\s+(.+))?$/.exec(l);
    if(!m) fail('Zeile ' + line + ': Diese Anweisung kenne ich nicht: „' + l + '“.', line);
    out[i] = { line, label, op: m[1].toUpperCase(), arg: m[2] ? m[2].trim() : '' };
  });
  return { rows: out, labels };
}

/* ---------- Übersetzen ---------- */
// ctx: { pro, intType ('INT'|'DINT'), typeOf(operand) → 'BOOL'|'INT'|'DINT'|'REAL'|'TIME'|… |null, operand(o) → SCL-Text,
//        callInfo(target) → {kind:'FC'|'FB', ret, params:{name:{sec,type}}}, retName, blockKind }
function translate(src, ctx){
  ctx = Object.assign({ pro:false, intType:'INT' }, ctx || {});
  const P = parse(src, { lineOffset: ctx.lineOffset });
  const rows = P.rows, N = rows.length, off = ctx.lineOffset || 0;
  const code = rows.map(() => []), pre = rows.map(() => []);
  const vars = {};                // Hilfsvariable → Typ
  const fb = {};                  // Zeiten-Instanzen (Grundstufe)
  const cons = new Set();
  const status = {};              // Zeile → {v, a, b, ta, tb}
  const need = (n, t) => { vars[n] = t; return n; };
  const I = ctx.intType;
  const slot = (t, k) => need('_qa' + ({ BOOL:'x', REAL:'r', TIME:'t' }[t] || 'i') + k, t === 'REAL' ? 'REAL' : t === 'TIME' ? 'TIME' : I);
  const isIntT = t => ['INT', 'DINT', 'SINT', 'USINT', 'UINT', 'UDINT', 'BYTE', 'WORD', 'DWORD'].includes(t);
  const hasJumps = rows.some(r => r && (r.label || ['SPA', 'SPB', 'SPBN', 'BEA', 'BEB', 'LOOP'].includes(r.op)));
  // Zeiten und Zähler vorab einsammeln (Art je Zeit)
  const tKind = {};
  rows.forEach(r => { if(r && TIMERS[r.op] && r.arg){ const tn = r.arg.toUpperCase();
    if(!isTimer(tn)) fail('Zeile ' + r.line + ': ' + r.op + ' startet eine Zeit — Operand T1, T2, …', r.line);
    if(ctx.pro) fail('Zeile ' + r.line + ': S5-Zeiten (' + r.op + ' ' + tn + ') gibt es nur in der Grundstufe. In Bausteinen nimmst du IEC-Zeiten als Multiinstanz: CALL #T_Name mit IN, PT, Q.', r.line);
    if(tKind[tn] && tKind[tn] !== r.op) fail('Zeile ' + r.line + ': ' + tn + ' wird schon als ' + tKind[tn] + ' benutzt — eine Zeit hat genau eine Art.', r.line);
    tKind[tn] = r.op; } });
  // Segmente (nur mit Sprüngen): Beginn bei Zeile 1, bei Marken und nach Sprüngen
  const seg = rows.map(() => -1); let nSeg = 0;
  if(hasJumps){
    let startNext = true;
    rows.forEach((r, i) => {
      if(!r || r.net || r.param){ return; }
      if(i === 0 || startNext || r.label){ seg[i] = nSeg++; }
      startNext = ['SPA', 'SPB', 'SPBN', 'BEA', 'BEB', 'LOOP'].includes(r.op);
    });
    if(seg.every(s => s < 0)) nSeg = 0;
  }
  const segOfLabel = name => { const L = P.labels[String(name).toUpperCase()]; if(!L) return null; return seg[L - 1 - off]; };
  const nextSeg = i => { for(let j = i + 1; j < N; j++) if(seg[j] >= 0) return seg[j]; return -1; };
  // Zustand (statisch): Tiefe, Erstabfrage, ODER offen, AKKU-Typen
  let d = 1; const er = [false, false], orp = [false, false], stack = [];
  let t1 = null, t2 = null, hasVke = false;
  const V = k => need('_qv' + (k || d), 'BOOL'), O = k => need('_qo' + (k || d), 'BOOL');
  const E = (i, s) => code[i].push(s);
  const vke = () => '(' + O() + ' OR ' + V() + ')';
  // Operand einer Bitabfrage
  function bitOperand(r, i){
    const a = r.arg;
    if(!a) fail('Zeile ' + r.line + ': ' + r.op + ' braucht einen Operanden (z. B. ' + r.op + ' Taste).', r.line);
    if(isTimer(a)){ const tn = a.toUpperCase(); if(!tKind[tn]) fail('Zeile ' + r.line + ': Die Zeit ' + tn + ' wird nirgends gestartet (SE, SA, SI oder SV).', r.line);
      cons.add('TIMER_BIT'); return tKind[tn] === 'SI' ? '(' + need('_q' + tn + 'in', 'BOOL') + ' AND NOT ' + tn + '.Q)' : tn + '.Q'; }
    if(isCounter(a)){ cons.add('COUNTER_BIT'); return '(' + need('_q' + a.toUpperCase(), I) + ' > 0)'; }
    const ty = ctx.typeOf(a);
    if(ty && ty !== 'BOOL') fail('Zeile ' + r.line + ': ' + a + ' ist ' + ty + ' — ' + r.op + ' fragt nur Bits (BOOL) ab. Zahlen lädst du mit L.', r.line);
    return ctx.operand(a, r.line);
  }
  function bitOp(op, x, i){
    const neg = op.endsWith('N'), b = neg ? 'NOT ' + x : x, base = op[0];
    if(!er[d]){ E(i, V() + ' := ' + b + ';'); if(!orp[d]) E(i, O() + ' := FALSE;'); er[d] = true; orp[d] = false; return; }
    if(base === 'U') E(i, V() + ' := ' + V() + ' AND ' + b + ';');
    else if(base === 'O') E(i, O() + ' := ' + O() + ' OR ' + V() + '; ' + V() + ' := ' + b + ';');
    else E(i, V() + ' := ' + vke() + ' XOR ' + b + '; ' + O() + ' := FALSE;');
  }
  const settle = i => { if(er[d] || orp[d]) E(i, V() + ' := ' + vke() + '; ' + O() + ' := FALSE;'); };
  const endChain = () => { er[d] = false; orp[d] = false; };
  const needT = (r, want) => { if(!t1) fail('Zeile ' + r.line + ': Im AKKU1 steht noch nichts — lade zuerst einen Wert mit L.', r.line); if(want && want !== t1) fail('Zeile ' + r.line + ': ' + r.op + ' erwartet ' + want + ' im AKKU1, dort steht aber ' + t1 + '.', r.line); };
  const numT = (r, k) => {
    const ty = r.ty === 'R' ? 'REAL' : r.ty === 'D' ? 'DINT' : 'INT';
    const ok = t => ty === 'REAL' ? t === 'REAL' : isIntT(t);
    if(!t1 || !t2) fail('Zeile ' + r.line + ': ' + k + ' braucht zwei Werte: zuerst L a, dann L b (AKKU2 und AKKU1).', r.line);
    if(!ok(t1) || !ok(t2)) fail('Zeile ' + r.line + ': ' + k + ' rechnet mit ' + (ty === 'REAL' ? 'REAL-Zahlen' : 'Ganzzahlen') + ', in den Akkus stehen aber ' + t2 + ' und ' + t1 + '.' + (ty === 'REAL' ? ' Wandle mit ITD und DTR um.' : ' Für Kommazahlen gibt es +R, -R, *R, /R.'), r.line);
    if(!ctx.pro && r.ty === 'D') fail('Zeile ' + r.line + ': In der Grundstufe rechnest du mit INT (…I) oder REAL (…R).', r.line);
    return ty === 'REAL' ? 'REAL' : 'INT';
  };
  function load(r, i){
    const a = r.arg; let ty, val;
    if(!a) fail('Zeile ' + r.line + ': L braucht einen Wert oder Operanden.', r.line);
    if(/^S5T#/i.test(a)){ ty = 'TIME'; val = 'T#' + a.slice(4); cons.add('S5T'); }
    else if(/^T#/i.test(a)){ ty = 'TIME'; val = a; }
    else if(/^[+-]?\d+\.\d*([eE][+-]?\d+)?$|^[+-]?\d+[eE][+-]?\d+$/.test(a)){ ty = 'REAL'; val = a.includes('.') ? a : a.replace(/[eE]/, '.0E'); }
    else if(/^[+-]?\d+$/.test(a)){ ty = I; val = a; }
    else if(/^L#[+-]?\d+$/i.test(a)){ ty = 'DINT'; val = a.slice(2); }
    else if(isTimer(a)) fail('Zeile ' + r.line + ': L ' + a + ' (Restzeit) wird hier nicht unterstützt. Frage die Zeit mit U ' + a + ' ab.', r.line);
    else if(isCounter(a)){ ty = I; val = need('_q' + a.toUpperCase(), I); cons.add('COUNTER_LOAD'); }
    else { ty = ctx.typeOf(a); val = ctx.operand(a, r.line);
      if(ty === 'BOOL') fail('Zeile ' + r.line + ': ' + a + ' ist ein Bit (BOOL). L lädt Zahlen — Bits fragst du mit U ab.', r.line);
      if(!ty){ if(ctx.loose) ty = I; else fail('Zeile ' + r.line + ': Den Typ von ' + a + ' kenne ich nicht.', r.line); } }
    const k = ty === 'REAL' ? 'REAL' : ty === 'TIME' ? 'TIME' : isIntT(ty) ? I : null;
    if(!k) fail('Zeile ' + r.line + ': ' + a + ' hat den Typ ' + ty + ' — in den Akku kommen hier nur Zahlen und Zeiten.', r.line);
    if(t1) E(i, slot(t1, 2) + ' := ' + slot(t1, 1) + ';');
    E(i, slot(k, 1) + ' := ' + val + ';');
    t2 = t1; t1 = k;
  }
  function store(r, i){
    const a = r.arg;
    if(!a) fail('Zeile ' + r.line + ': T braucht ein Ziel.', r.line);
    needT(r);
    if(isTimer(a) || isCounter(a)) fail('Zeile ' + r.line + ': In Zeiten und Zähler transferiert man nicht mit T. Zähler setzt du mit S ' + a + '.', r.line);
    const ty = ctx.typeOf(a), dst = ctx.operand(a, r.line);
    if(/^#ret_val$/i.test(a)) cons.add('RETVAL');
    if(ty === 'BOOL') fail('Zeile ' + r.line + ': ' + a + ' ist ein Bit (BOOL). T schreibt Zahlen — Bits schreibst du mit =, S oder R.', r.line);
    const src = slot(t1, 1);
    if(ty === 'REAL' && t1 !== 'REAL') fail('Zeile ' + r.line + ': ' + a + ' ist REAL, im AKKU1 steht aber eine Ganzzahl. Wandle zuerst um: ITD, DTR.', r.line);
    if(isIntT(ty) && t1 === 'REAL') fail('Zeile ' + r.line + ': ' + a + ' ist ' + ty + ', im AKKU1 steht aber eine REAL-Zahl. Runde zuerst: RND oder TRUNC.', r.line);
    if(ty === 'TIME' && t1 !== 'TIME') fail('Zeile ' + r.line + ': ' + a + ' ist TIME, im AKKU1 steht keine Zeit.', r.line);
    if(t1 === 'TIME' && ty && ty !== 'TIME') fail('Zeile ' + r.line + ': Im AKKU1 steht eine Zeit, ' + a + ' ist aber ' + ty + '.', r.line);
    E(i, dst + ' := ' + (ctx.pro && isIntT(ty) && ty !== 'DINT' ? 'DINT_TO_' + ty + '(' + src + ')' : src) + ';');
  }
  const jumpTo = (r, name) => { const k = segOfLabel(name); if(k === null || k === undefined || k < 0) fail('Zeile ' + r.line + ': Die Sprungmarke „' + name + '“ gibt es nicht.', r.line); return k; };
  const pcv = () => need('_qpc', I);

  rows.forEach((r, i) => {
    if(!r) return;
    if(r.net){ if(er[d] || stack.length) {} er[d] = false; orp[d] = false; cons.add('NETWORK'); return; }
    if(r.param) return;
    if(r.label) cons.add('LABEL');
    const op = r.op;
    if(!op) return;
    if(op === 'O' && !r.arg){ cons.add('O_VOR'); if(!er[d]) fail('Zeile ' + r.line + ': „O“ ohne Operand verbindet zwei UND-Gruppen — davor muss eine stehen.', r.line); E(i, O() + ' := ' + O() + ' OR ' + V() + ';'); er[d] = false; orp[d] = true; }
    else if(BITOPS.includes(op)){ cons.add(op); bitOp(op, bitOperand(r, i), i); hasVke = true; }
    else if(/^(UN|U|ON|O|XN|X)\($/.test(op)){ cons.add('KLAMMER'); cons.add(op.slice(0, -1)); stack.push({ op: op.slice(0, -1), line: r.line }); d++; er[d] = false; orp[d] = false; }
    else if(op === ')'){
      if(!stack.length) fail('Zeile ' + r.line + ': Zu dieser Klammer „)“ fehlt die öffnende (z. B. U( ).', r.line);
      if(!er[d]) fail('Zeile ' + r.line + ': Die Klammer ist leer.', r.line);
      const x = vke(); const s = stack.pop(); d--; bitOp(s.op, x, i); hasVke = true;
    }
    else if(op === '' || op === 'NOP'){ }
    else if(op === 'NOT'){ cons.add('NOT'); if(!er[d]) fail('Zeile ' + r.line + ': NOT dreht das VKE um — davor braucht es eine Abfrage.', r.line); E(i, V() + ' := NOT ' + vke() + '; ' + O() + ' := FALSE;'); orp[d] = false; }
    else if(op === 'SET' || op === 'CLR'){ cons.add(op); hasVke = true; E(i, V() + ' := ' + (op === 'SET' ? 'TRUE' : 'FALSE') + '; ' + O() + ' := FALSE;'); endChain(); }
    else if(op === '=' || ((op === 'S' || op === 'R') && !isTimer(r.arg) && !isCounter(r.arg))){
      if(!r.arg) fail('Zeile ' + r.line + ': ' + op + ' braucht ein Ziel.', r.line);
      if(!hasVke) fail('Zeile ' + r.line + ': Vor ' + op + ' ' + r.arg + ' steht keine Abfrage — woher soll das VKE kommen?', r.line);
      const ty = ctx.typeOf(r.arg);
      if(ty && ty !== 'BOOL') fail('Zeile ' + r.line + ': ' + r.arg + ' ist ' + ty + ' — ' + op + ' schreibt Bits. Zahlen transferierst du mit T.', r.line);
      if(stack.length) fail('Zeile ' + r.line + ': Die Klammer aus Zeile ' + stack[stack.length - 1].line + ' ist noch offen.', r.line);
      settle(i); const dst = ctx.operand(r.arg, r.line);
      cons.add(op === '=' ? 'ASSIGN' : op);
      E(i, op === '=' ? dst + ' := ' + V() + ';' : 'IF ' + V() + ' THEN ' + dst + ' := ' + (op === 'S' ? 'TRUE' : 'FALSE') + '; END_IF;');
      endChain();
    }
    else if(op === 'FP' || op === 'FN'){
      if(!er[d]) fail('Zeile ' + r.line + ': ' + op + ' wertet die Flanke des VKE aus — davor braucht es eine Abfrage.', r.line);
      if(!r.arg) fail('Zeile ' + r.line + ': ' + op + ' braucht einen Flankenmerker, z. B. ' + op + ' M_Flanke.', r.line);
      const ty = ctx.typeOf(r.arg); if(ty && ty !== 'BOOL') fail('Zeile ' + r.line + ': Der Flankenmerker ' + r.arg + ' muss ein Bit (BOOL) sein.', r.line);
      const m = ctx.operand(r.arg, r.line), t = need('_qfp', 'BOOL');
      cons.add(op);
      settle(i);
      E(i, t + ' := ' + (op === 'FP' ? V() + ' AND NOT ' + m : 'NOT ' + V() + ' AND ' + m) + '; ' + m + ' := ' + V() + '; ' + V() + ' := ' + t + ';');
      er[d] = true;
    }
    else if(TIMERS[op]){
      const tn = r.arg.toUpperCase();
      if(t1 !== 'TIME') fail('Zeile ' + r.line + ': ' + op + ' ' + tn + ' holt die Zeit aus dem AKKU1 — lade sie davor, z. B. L S5T#3S.', r.line);
      if(!er[d]) fail('Zeile ' + r.line + ': ' + op + ' startet die Zeit mit dem VKE — davor braucht es eine Abfrage.', r.line);
      cons.add(op); cons.add('TIMER');
      settle(i); fb[tn] = TIMERS[op];
      if(op === 'SI') E(i, need('_q' + tn + 'in', 'BOOL') + ' := ' + V() + ';');
      E(i, tn + '(IN := ' + V() + ', PT := ' + slot('TIME', 1) + ');');
      endChain();
    }
    else if((op === 'S' || op === 'R') && isTimer(r.arg)){
      const tn = r.arg.toUpperCase(); if(op === 'S') fail('Zeile ' + r.line + ': Zeiten startest du mit SE, SA, SI oder SV.', r.line);
      if(!tKind[tn]) fail('Zeile ' + r.line + ': Die Zeit ' + tn + ' wird nirgends gestartet.', r.line);
      cons.add('TIMER_RESET'); settle(i);
      E(i, 'IF ' + V() + ' THEN ' + tn + '(IN := FALSE, PT := T#0S); END_IF;'); endChain();
    }
    else if(['ZV', 'ZR'].includes(op) || ((op === 'S' || op === 'R') && isCounter(r.arg))){
      const zn = String(r.arg).toUpperCase(); if(!isCounter(zn)) fail('Zeile ' + r.line + ': ' + op + ' braucht einen Zähler Z1, Z2, …', r.line);
      if(ctx.pro) fail('Zeile ' + r.line + ': S5-Zähler (' + zn + ') gibt es nur in der Grundstufe. In Bausteinen nimmst du IEC-Zähler als Multiinstanz (CALL #Z_Name mit CU, PV, R).', r.line);
      if(!er[d]) fail('Zeile ' + r.line + ': ' + op + ' ' + zn + ' arbeitet mit dem VKE — davor braucht es eine Abfrage.', r.line);
      const z = need('_q' + zn, I); settle(i); cons.add('COUNTER');
      if(op === 'ZV'){ cons.add('ZV'); const f = need('_q' + zn + 'u', 'BOOL'); E(i, 'IF ' + V() + ' AND NOT ' + f + ' AND ' + z + ' < 999 THEN ' + z + ' := ' + z + ' + 1; END_IF; ' + f + ' := ' + V() + ';'); }
      else if(op === 'ZR'){ cons.add('ZR'); const f = need('_q' + zn + 'd', 'BOOL'); E(i, 'IF ' + V() + ' AND NOT ' + f + ' AND ' + z + ' > 0 THEN ' + z + ' := ' + z + ' - 1; END_IF; ' + f + ' := ' + V() + ';'); }
      else if(op === 'S'){ cons.add('ZS'); if(!t1 || !isIntT(t1) && t1 !== I) fail('Zeile ' + r.line + ': S ' + zn + ' übernimmt den Startwert aus dem AKKU1 — lade ihn davor, z. B. L 10.', r.line);
        const f = need('_q' + zn + 's', 'BOOL'); E(i, 'IF ' + V() + ' AND NOT ' + f + ' THEN ' + z + ' := ' + slot(t1, 1) + '; END_IF; ' + f + ' := ' + V() + ';'); }
      else { cons.add('ZRESET'); E(i, 'IF ' + V() + ' THEN ' + z + ' := 0; END_IF;'); }
      endChain();
    }
    else if(op === 'L'){ cons.add('L'); load(r, i); }
    else if(op === 'T'){ cons.add('T'); store(r, i); }
    else if(op === 'TAK'){ cons.add('TAK'); if(!t1 || !t2) fail('Zeile ' + r.line + ': TAK tauscht AKKU1 und AKKU2 — lade zuerst zwei Werte.', r.line);
      const h = need('_qh' + (t1 === 'REAL' ? 'r' : t1 === 'TIME' ? 't' : 'i'), t1 === 'REAL' ? 'REAL' : t1 === 'TIME' ? 'TIME' : I);
      if(t1 !== t2) fail('Zeile ' + r.line + ': TAK geht hier nur, wenn beide Akkus denselben Typ haben.', r.line);
      E(i, h + ' := ' + slot(t1, 1) + '; ' + slot(t1, 1) + ' := ' + slot(t1, 2) + '; ' + slot(t1, 2) + ' := ' + h + ';'); }
    else if(op === 'ARITH'){
      const k = r.ar + r.ty, ty = numT(r, k); cons.add(k); cons.add('ARITH');
      E(i, slot(t1, 1) + ' := ' + slot(t2, 2) + ' ' + ARITH[r.ar] + ' ' + slot(t1, 1) + ';');
    }
    else if(op === 'MOD'){ const ty = numT(Object.assign({}, r, { ty: ctx.pro ? 'D' : 'I' }), 'MOD'); cons.add('MOD'); cons.add('ARITH'); E(i, slot(t1, 1) + ' := ' + slot(t2, 2) + ' MOD ' + slot(t1, 1) + ';'); }
    else if(op === 'CMP'){
      const k = r.cmp + r.ty; numT(r, k); cons.add('CMP'); cons.add('CMP_' + r.ty); hasVke = true;
      if(stack.length === 0 && er[d]) {}
      E(i, V() + ' := ' + slot(t2, 2) + ' ' + (r.cmp === '==' ? '=' : r.cmp) + ' ' + slot(t1, 1) + '; ' + O() + ' := FALSE;');
      er[d] = true; orp[d] = false;
    }
    else if(['NEGI', 'NEGD'].includes(op)){ needT(r); if(!isIntT(t1)) fail('Zeile ' + r.line + ': ' + op + ' braucht eine Ganzzahl im AKKU1.', r.line); cons.add('NEG'); E(i, slot(t1, 1) + ' := -' + slot(t1, 1) + ';'); }
    else if(op === 'NEGR'){ needT(r, 'REAL'); cons.add('NEG'); E(i, slot(t1, 1) + ' := -' + slot(t1, 1) + ';'); }
    else if(op === 'ABS'){ needT(r, 'REAL'); cons.add('ABS'); E(i, slot(t1, 1) + ' := ABS(' + slot(t1, 1) + ');'); }
    else if(op === 'SQRT'){ needT(r, 'REAL'); cons.add('SQRT'); E(i, slot(t1, 1) + ' := SQRT(' + slot(t1, 1) + ');'); }
    else if(op === 'ITD'){ needT(r); if(!isIntT(t1)) fail('Zeile ' + r.line + ': ITD wandelt eine INT-Zahl um — im AKKU1 steht ' + t1 + '.', r.line); cons.add('ITD'); cons.add('CONVERT'); }
    else if(op === 'DTR' || op === 'ITR'){ needT(r); if(!isIntT(t1)) fail('Zeile ' + r.line + ': ' + op + ' wandelt eine Ganzzahl in REAL — im AKKU1 steht ' + t1 + '.', r.line);
      cons.add(op); cons.add('CONVERT'); const s = slot(t1, 1); t1 = 'REAL'; E(i, slot('REAL', 1) + ' := ' + (ctx.pro ? 'DINT_TO_REAL' : 'INT_TO_REAL') + '(' + s + ');'); }
    else if(op === 'RND' || op === 'TRUNC'){ needT(r, 'REAL'); cons.add(op); cons.add('CONVERT'); const s = slot('REAL', 1); t1 = I;
      E(i, slot(I, 1) + ' := ' + (ctx.pro ? (op === 'RND' ? 'ROUND' : 'TRUNC') + '(' + s + ')' : (op === 'RND' ? 'REAL_TO_INT(' + s + ')' : 'TRUNC(' + s + ')')) + ';'); }
    else if(op === 'INC' || op === 'DEC'){ needT(r); if(!isIntT(t1)) fail('Zeile ' + r.line + ': ' + op + ' zählt eine Ganzzahl im AKKU1 hoch/runter.', r.line);
      const n = /^\d+$/.test(r.arg) ? r.arg : fail('Zeile ' + r.line + ': ' + op + ' braucht eine Zahl, z. B. ' + op + ' 1.', r.line); cons.add(op); E(i, slot(t1, 1) + ' := ' + slot(t1, 1) + (op === 'INC' ? ' + ' : ' - ') + n + ';'); }
    else if(['SPA', 'SPB', 'SPBN', 'LOOP'].includes(op)){
      if(!r.arg) fail('Zeile ' + r.line + ': ' + op + ' braucht eine Sprungmarke, z. B. ' + op + ' M1.', r.line);
      const k = jumpTo(r, r.arg), nx = nextSeg(i), pc = pcv(); cons.add(op); cons.add('JUMP');
      if(stack.length) fail('Zeile ' + r.line + ': Ein Sprung mitten in einer offenen Klammer (Zeile ' + stack[stack.length - 1].line + ') geht nicht.', r.line);
      if(op === 'SPA'){ E(i, pc + ' := ' + k + ';'); }
      else if(op === 'LOOP'){ needT(r); if(!isIntT(t1)) fail('Zeile ' + r.line + ': LOOP zählt den AKKU1 herunter — dort muss eine Ganzzahl stehen.', r.line);
        E(i, slot(t1, 1) + ' := ' + slot(t1, 1) + ' - 1; IF ' + slot(t1, 1) + ' <> 0 THEN ' + pc + ' := ' + k + '; ELSE ' + pc + ' := ' + nx + '; END_IF;'); }
      else { if(!er[d]) fail('Zeile ' + r.line + ': ' + op + ' springt abhängig vom VKE — davor braucht es eine Abfrage.', r.line);
        const j = need('_qj', 'BOOL'); settle(i);
        E(i, j + ' := ' + (op === 'SPB' ? '' : 'NOT ') + V() + '; ' + V() + ' := TRUE; IF ' + j + ' THEN ' + pc + ' := ' + k + '; ELSE ' + pc + ' := ' + nx + '; END_IF;'); endChain(); }
    }
    else if(op === 'BEA'){ cons.add('BEA'); E(i, pcv() + ' := -1;'); }
    else if(op === 'BEB'){ cons.add('BEB'); if(!er[d]) fail('Zeile ' + r.line + ': BEB beendet abhängig vom VKE — davor braucht es eine Abfrage.', r.line);
      const j = need('_qj', 'BOOL'); settle(i); E(i, j + ' := ' + V() + '; ' + V() + ' := TRUE; IF ' + j + ' THEN ' + pcv() + ' := -1; ELSE ' + pcv() + ' := ' + nextSeg(i) + '; END_IF;'); endChain(); }
    else if(op === 'CALL'){
      if(!ctx.pro) fail('Zeile ' + r.line + ': CALL gibt es erst in der Profi-Stufe mit Bausteinen.', r.line);
      if(stack.length) fail('Zeile ' + r.line + ': CALL in einer offenen Klammer geht nicht.', r.line);
      cons.add('CALL'); E(i, ctx.call(r) + ';'); endChain();
    }
    else fail('Zeile ' + r.line + ': „' + op + '“ ist keine AWL-Anweisung, die ich kenne.' + (op === 'A' || op === 'AN' ? ' Auf Deutsch heisst UND „U“, UND NICHT „UN“.' : op === 'ST' ? ' Zuweisen heisst in AWL „=“.' : ''), r.line);
    // Status dieser Zeile merken
    const st = {};
    if(BITOPS.includes(op) || /\($/.test(op) || op === ')' || ['NOT', 'SET', 'CLR', '=', 'S', 'R', 'FP', 'FN', 'CMP', 'SPB', 'SPBN', 'BEB', 'ZV', 'ZR', 'SE', 'SA', 'SI', 'SV'].includes(op)){
      const sv = need('_q' + r.line + 'v', 'BOOL'); const cur = op.endsWith('(') ? (d - 1) : d;
      E(i, sv + ' := ' + (op.endsWith('(') ? '(' + O(cur) + ' OR ' + V(cur) + ')' : vke()) + ';'); st.v = sv;
    }
    if(t1 && ['L', 'T', 'TAK', 'ARITH', 'MOD', 'CMP', 'NEGI', 'NEGD', 'NEGR', 'ABS', 'SQRT', 'ITD', 'DTR', 'ITR', 'RND', 'TRUNC', 'INC', 'DEC', 'LOOP'].includes(op)){
      const sa = need('_q' + r.line + 'a', t1 === 'REAL' ? 'REAL' : t1 === 'TIME' ? 'TIME' : I); E(i, sa + ' := ' + slot(t1, 1) + ';'); st.a = sa; st.ta = t1;
      if(t2){ const sb = need('_q' + r.line + 'b', t2 === 'REAL' ? 'REAL' : t2 === 'TIME' ? 'TIME' : I); E(i, sb + ' := ' + slot(t2, 2) + ';'); st.b = sb; st.tb = t2; }
    }
    if(Object.keys(st).length){ if(hasJumps){ const x = need('_q' + r.line + 'x', 'BOOL'); E(i, x + ' := TRUE;'); st.x = x; } status[r.line] = st; }
  });
  if(stack.length) fail('Zeile ' + stack[stack.length - 1].line + ': Diese Klammer wird nie mit „)“ geschlossen.', stack[stack.length - 1].line);
  // Sprung-Verteiler
  if(hasJumps && nSeg){
    const pc = pcv();
    const resets = Object.values(status).filter(s => s.x).map(s => s.x + ' := FALSE;').join(' ');
    let first = rows.findIndex(r => r && !r.net && !r.param); if(first < 0) first = 0;
    pre[0].push((resets ? resets + ' ' : '') + pc + ' := 0; WHILE ' + pc + ' >= 0 DO CASE ' + pc + ' OF');
    rows.forEach((r, i) => {
      if(seg[i] < 0) return;
      const prev = (() => { for(let j = i - 1; j >= 0; j--) if(rows[j] && !rows[j].net && !rows[j].param && rows[j].op) return rows[j]; return null; })();
      const jumped = prev && ['SPA', 'SPB', 'SPBN', 'BEA', 'BEB', 'LOOP'].includes(prev.op);
      pre[i].push((seg[i] > 0 && !jumped ? pc + ' := ' + seg[i] + '; ' : '') + seg[i] + ':');
    });
    const last = N - 1;
    const lastRow = (() => { for(let j = N - 1; j >= 0; j--) if(rows[j] && !rows[j].net && !rows[j].param && rows[j].op) return rows[j]; return null; })();
    const endJ = lastRow && ['SPA', 'SPB', 'SPBN', 'BEA', 'BEB', 'LOOP'].includes(lastRow.op);
    code[last].push((endJ ? '' : pc + ' := -1; ') + 'ELSE ' + pc + ' := -1; END_CASE; END_WHILE;');
    cons.add('JUMPTABLE');
  }
  const lines = rows.map((_, i) => pre[i].concat(code[i]).join(' '));
  return { lines, scl: lines.join('\n'), vars, fb, status, constructs: cons, rows, labels: P.labels, hasJumps };
}

/* ---------- Grundstufe: Engine-Hülle ---------- */
function typeName(t){ return typeof t === 'string' ? t : t && t.kind === 'FB' ? 'FB' : null; }
function wrapEngine(E){
  const W = Object.assign({}, E);
  W.compileSCL = function(code, t){
    if(!t || t.lang !== 'awl') return E.compileSCL(code, t);
    const decl0 = { vars: t.initialVars || {}, fbTypes: t.fbTypes || {}, varTypes: t.varTypes || {} };
    const sym = E.buildSymbols(decl0);
    const norm = o => String(o).replace(/^"(.*)"$/, '$1');
    let tr;
    try{
      tr = translate(code, { pro:false, intType:'INT',
        typeOf: o => { const s = sym[norm(o).toLowerCase()]; return s ? typeName(s.type) : null; },
        operand: (o, line) => { const n = norm(o); if(!/^[A-Za-z_]\w*$/.test(n)) fail('Zeile ' + line + ': „' + o + '“ ist kein gültiger Operand.', line);
          const s = sym[n.toLowerCase()]; if(!s){ const sug = suggest(n, sym); fail('Zeile ' + line + ': Unbekannter Operand „' + n + '“.' + (sug ? ' Meintest du „' + sug + '“?' : ''), line); } return s.name; } });
    }catch(e){ if(e instanceof AWLError){ const x = new E.SCLError('syntax', e.message.replace(/^Zeile \d+: /, ''), e.line, 1); throw x; } throw e; }
    const vars = Object.assign({}, t.initialVars || {}), varTypes = Object.assign({}, t.varTypes || {});
    Object.keys(tr.vars).forEach(n => { const ty = tr.vars[n]; vars[n] = ty === 'BOOL' ? false : 0; varTypes[n] = ty; });
    const decl = { vars, fbTypes: Object.assign({}, t.fbTypes || {}, tr.fb), varTypes };
    let prog;
    try{ prog = E.compileSCL(tr.scl, decl); }
    catch(e){ if(e && e.line){ const x = new E.SCLError(e.kind || 'semantic', String(e.message).replace(/\b_q\w+/g, 'Akku').replace(/Zeile \d+:?\s*/g, ''), e.line, 1); throw x; } throw e; }
    prog.awl = tr; prog.awlSCL = tr.scl;
    // interne Variablen für freshEnv bereitstellen
    const extra = {}; Object.keys(tr.vars).forEach(n => { extra[n] = tr.vars[n] === 'BOOL' ? false : 0; }); prog.awlVars = extra;
    return prog;
  };
  const withVars = (prog, iv) => prog && prog.awlVars ? Object.assign({}, prog.awlVars, iv || {}) : iv;
  W.runSinglePassTests = (prog, iv, tc, opts) => E.runSinglePassTests(prog, withVars(prog, iv), tc, opts);
  W.runTimedTests = (prog, iv, tc, opts) => E.runTimedTests(prog, withVars(prog, iv), tc, opts);
  W.executeOnce = (prog, iv, s) => E.executeOnce(prog, withVars(prog, iv), s);
  W.executeTimed = (prog, iv, s, st, opts) => E.executeTimed(prog, withVars(prog, iv), s, st, opts);
  W.constructsUsed = function(prog){ return prog && prog.awl ? new Set(prog.awl.constructs) : E.constructsUsed(prog); };
  W.SCLError = E.SCLError;
  return W;
}
function lev(a, b){ a = a.toLowerCase(); b = b.toLowerCase(); const dp = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
  for(let j = 1; j <= b.length; j++) dp[0][j] = j;
  for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length]; }
function suggest(n, sym){ let best = null, bd = 99; Object.values(sym).forEach(s => { const x = lev(n, s.name); if(x < bd){ bd = x; best = s.name; } }); return bd <= Math.max(2, Math.floor(n.length / 3)) ? best : null; }


/* ---------- Profi-Stufe: Bausteine mit AWL-Rumpf ----------
   FUNCTION_BLOCK "FB_x" … Deklaration (SCL) … BEGIN  <AWL-Zeilen>  END_FUNCTION_BLOCK
   Übersetzt zeilentreu; Hilfsvariablen (_q…) werden als VAR_TEMP vor BEGIN ergänzt. */
function splitBlock(src){
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  if(/^\s*(TYPE|DATA_BLOCK)\b/im.test(src)) return null;
  const b = lines.findIndex(l => /^\s*BEGIN\b/i.test(l));
  if(b < 0) return null;
  let e = -1;
  for(let i = lines.length - 1; i > b; i--) if(/^\s*END_(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/i.test(lines[i])){ e = i; break; }
  if(e < 0) e = lines.length;
  const kindM = /\b(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK)\b/i.exec(lines.slice(0, b).join('\n'));
  return { head: lines.slice(0, b + 1).join('\n') + '\n', body: lines.slice(b + 1, e).join('\n'), foot: e < lines.length ? '\n' + lines.slice(e).join('\n') : '',
    offset: b + 1, kind: kindM ? ({ FUNCTION_BLOCK:'FB', FUNCTION:'FC', ORGANIZATION_BLOCK:'OB' })[kindM[1].toUpperCase()] : '' };
}
const ELEM = { BOOL:'BOOL', INT:'INT', DINT:'DINT', SINT:'SINT', USINT:'USINT', UINT:'UINT', UDINT:'UDINT', REAL:'REAL', LREAL:'REAL', TIME:'TIME', BYTE:'BYTE', WORD:'WORD', DWORD:'DWORD' };
const IEC = { TON:{ IN:'BOOL', PT:'TIME', Q:'BOOL', ET:'TIME' }, TOF:{ IN:'BOOL', PT:'TIME', Q:'BOOL', ET:'TIME' }, TP:{ IN:'BOOL', PT:'TIME', Q:'BOOL', ET:'TIME' },
  R_TRIG:{ CLK:'BOOL', Q:'BOOL' }, F_TRIG:{ CLK:'BOOL', Q:'BOOL' }, CTU:{ CU:'BOOL', R:'BOOL', PV:'INT', Q:'BOOL', CV:'INT' }, CTD:{ CD:'BOOL', LD:'BOOL', PV:'INT', Q:'BOOL', CV:'INT' },
  CTUD:{ CU:'BOOL', CD:'BOOL', R:'BOOL', LD:'BOOL', PV:'INT', QU:'BOOL', QD:'BOOL', CV:'INT' } };
// Typ-Umgebung eines Projekts: Bausteine, UDTs, DBs, PLC-Variablen
function projectTypes(P, project){
  const blocks = {}, udts = {};
  project.sources.forEach(x => {
    const src = String(x.src || '');
    if(/^\s*TYPE\b/im.test(src)){
      const nm = (/TYPE\s+"([^"]+)"/i.exec(src) || [])[1]; if(!nm) return;
      const mem = {}; src.replace(/^\s*([A-Za-z_]\w*)\s*:\s*([^;:=]+?)\s*(?::=[^;]*)?;/gm, (m, n, t) => { mem[n.toLowerCase()] = t.trim(); return m; });
      udts[nm.toLowerCase()] = mem; return;
    }
    let ifc = null; try{ const sp = splitBlock(src); ifc = P.readInterface(sp ? sp.head + sp.body.replace(/[^\n]/g, ' ') + sp.foot : src); }catch(e){}
    if(ifc) blocks[String(ifc.name || x.block).toLowerCase()] = ifc;
  });
  const tags = {}; Object.keys(project.globals || {}).forEach(n => { const spec = project.globalTypes && project.globalTypes[n]; const v = project.globals[n];
    tags[n.toLowerCase()] = spec || (typeof v === 'boolean' ? 'Bool' : typeof v === 'number' ? (Number.isInteger(v) ? 'Int' : 'Real') : typeof v === 'string' ? 'String' : 'Struct'); });
  const inst = {}; Object.keys(project.instances || {}).forEach(n => { inst[n.toLowerCase()] = project.instances[n]; });
  return { blocks, udts, tags, inst };
}
// Typ als Text → Beschreibung {el} | {arr, of} | {mem:{…}}
function typeDesc(env, t){
  t = String(t || '').trim();
  const up = t.toUpperCase().replace(/\[.*$/, '');
  if(ELEM[up]) return { el: ELEM[up] };
  if(/^STRING/i.test(t)) return { el:'STRING' };
  const am = /^Array\s*\[[^\]]*\]\s*of\s+(.+)$/i.exec(t); if(am) return { arr:true, of: am[1] };
  const nm = t.replace(/^"|"$/g, ''), k = nm.toLowerCase();
  if(IEC[nm.toUpperCase()]) return { mem: IEC[nm.toUpperCase()] };
  if(env.udts[k]) return { mem: env.udts[k] };
  if(env.blocks[k] && env.blocks[k].kind === 'FB'){ const m = {}; env.blocks[k].rows.forEach(r => { if(['Input', 'Output', 'InOut', 'Static'].includes(r.sec)) m[r.name.toLowerCase()] = r.type; }); return { mem: m }; }
  return { el: null };
}
function resolveOperand(env, block, o){
  const m = /^(#[A-Za-z_]\w*|"[^"]+"|[A-Za-z_]\w*)((?:\.[A-Za-z_]\w*|\[\s*-?\d+\s*(?:,\s*-?\d+\s*)?\])*)$/.exec(String(o).trim());
  if(!m) return { bad:true };
  const base = m[1], rest = m[2].match(/\.[A-Za-z_]\w*|\[[^\]]*\]/g) || [];
  let t = null;
  const me = env.blocks[String(block).toLowerCase()];
  if(base[0] === '#'){
    const n = base.slice(1).toLowerCase();
    if(me && me.kind === 'FC' && (n === 'ret_val' || n === String(me.name).toLowerCase())) t = me.ret || 'Void';
    else { const r = me && me.rows.find(x => x.name.toLowerCase() === n); if(!r) return { unknown: base }; t = r.type; }
  } else {
    const n = base.replace(/"/g, '').toLowerCase();
    if(env.tags[n]) t = env.tags[n];
    else if(env.blocks[n] && env.blocks[n].kind === 'DB'){ if(!rest.length) return { el:'DB' }; const f = rest.shift().slice(1).toLowerCase(); const r = env.blocks[n].rows.find(x => x.name.toLowerCase() === f); if(!r) return { unknown: base + '.' + f }; t = r.type; }
    else if(env.inst[n]) t = env.inst[n];
    else if(/_db$/.test(n) && env.blocks[n.slice(0, -3)]) t = '"' + n.slice(0, -3) + '"';
    else return { unknown: base };
  }
  let d = typeDesc(env, t);
  for(const part of rest){
    if(part[0] === '['){ if(!d.arr) return { el:null }; d = typeDesc(env, d.of); }
    else { const f = part.slice(1).toLowerCase(); if(!d.mem || !d.mem[f]) return { el:null }; d = typeDesc(env, d.mem[f]); }
  }
  return d;
}
function wrapPro(P){
  if(P.__awl) return P;
  const W = Object.assign({}, P, { __awl:true });
  W.compileProject = function(project){
    const env = projectTypes(P, project);
    const awlBlocks = {}, jumpy = {};
    const sources = project.sources.map(x => {
      const sp = splitBlock(x.src);
      if(!sp) return x;
      const me = env.blocks[String(x.block).toLowerCase()] || { rows:[], kind: sp.kind };
      let tr;
      try{
        tr = translate(sp.body, { pro:true, intType:'DINT', lineOffset: sp.offset, blockKind: sp.kind,
          typeOf: o => { const d = resolveOperand(env, x.block, o); return d.el || (d.arr ? 'ARRAY' : d.mem ? 'STRUCT' : null); },
          operand: (o, line) => { const d = resolveOperand(env, x.block, o);
            if(d.bad) fail('Zeile ' + line + ': „' + o + '“ ist kein gültiger Operand. Lokale Variablen schreibst du mit #, globale in Anführungszeichen.', line);
            if(d.unknown) fail('Zeile ' + line + ': ' + (d.unknown[0] === '#' ? 'Die lokale Variable „' + d.unknown + '“ ist in diesem Baustein nicht deklariert.' : 'Unbekannter Operand „' + d.unknown + '“.') + (/^[A-Za-z]/.test(o) ? ' Lokal: #' + o + ', global: "' + o + '".' : ''), line);
            return o; },
          call: r => {
            const tgt = r.target, nm = tgt.replace(/^[#"]|"$/g, ''), k = nm.toLowerCase();
            let kind = tgt[0] === '#' ? 'MULTI' : env.blocks[k] ? env.blocks[k].kind : null;
            if(!kind) fail('Zeile ' + r.line + ': Den Baustein ' + tgt + ' gibt es nicht.', r.line);
            if(kind === 'FB' && !r.db) fail('Zeile ' + r.line + ': Ein FB braucht beim Aufruf seinen Instanz-DB: CALL ' + tgt + ', "' + nm + '_DB"', r.line);
            if(kind === 'FC' && r.db) fail('Zeile ' + r.line + ': Eine FC hat keinen Instanz-DB — nur CALL ' + tgt + '.', r.line);
            if(kind === 'OB' || kind === 'DB' || kind === 'UDT') fail('Zeile ' + r.line + ': ' + tgt + ' kann man nicht aufrufen.', r.line);
            let ret = null; const ps = [];
            r.params.forEach(p => { if(/^ret_val$/i.test(p.n)) ret = p.v; else ps.push(p.n + ' ' + p.d + ' ' + p.v); });
            const who = kind === 'FB' ? r.db : tgt;
            const callTxt = who + '(' + ps.join(', ') + ')';
            if(kind === 'FC' && env.blocks[k].ret && !/^void$/i.test(env.blocks[k].ret) && !ret) fail('Zeile ' + r.line + ': ' + tgt + ' liefert einen Rückgabewert — gib ihn mit RET_VAL := … an.', r.line);
            return ret ? ret + ' := ' + callTxt : callTxt;
          } });
      }catch(e){ if(e instanceof AWLError){ const er = new P.SCLError('syntax', e.message.replace(/^Zeile \d+: /, ''), e.line, 1); er.block = x.block; throw er; } throw e; }
      awlBlocks[x.block] = tr; if(tr.hasJumps) jumpy[x.block] = true;
      const temps = Object.keys(tr.vars);
      const tyName = t => ({ BOOL:'Bool', DINT:'DInt', REAL:'Real', TIME:'Time', INT:'Int' })[t] || t;
      const decl = temps.length ? 'VAR_TEMP ' + temps.map(v => v + ' : ' + tyName(tr.vars[v]) + ';').join(' ') + ' END_VAR ' : '';
      const head = sp.head.replace(/^(\s*)BEGIN\b/im, (m, ws) => ws + decl + 'BEGIN');
      return Object.assign({}, x, { src: head + tr.lines.join('\n') + sp.foot });
    });
    let prog;
    try{ prog = P.compileProject(Object.assign({}, project, { sources })); }
    catch(e){ if(e && e.message && awlBlocks[e.block]){ e.message = String(e.message).replace(/\b_q\w+/g, 'Akku'); e.col = 1; } throw e; }
    prog.warnings = (prog.warnings || []).filter(w => !INTERNAL.test(w.msg || w.message || '') && !INTERNAL.test(w.name || '') && !(jumpy[w.block] && ['OUT_NOT_ALL_PATHS', 'RET_NOT_SET', 'CONDITIONAL_CALL'].includes(w.code)));
    prog.awlBlocks = awlBlocks; prog.awlSources = {}; project.sources.forEach(x => { prog.awlSources[x.block] = x.src; });
    return prog;
  };
  const GEN = ['IF', 'ELSIF', 'ELSE', 'CASE', 'RANGE', 'WHILE', 'EXIT', 'CONTINUE', 'TEMP', 'STAT', 'BOOL', 'INT', 'DINT', 'REAL', 'TIME', 'AND', 'OR', 'XOR', 'NOT', 'MOD', '+', '-', '*', '/', '=', '<>', '<', '>', '<=', '>=', 'ROUND', 'TRUNC', 'ABS', 'SQRT', 'DINT_TO_INT', 'DINT_TO_REAL', 'CONDITIONAL_CALL'];
  W.constructsUsed = function(prog, blocks){
    const s = P.constructsUsed(prog, blocks);
    const mine = Object.keys(prog.awlBlocks || {}).filter(b => !blocks || blocks.includes(b));
    if(mine.length){
      GEN.forEach(k => s.delete(k));
      mine.forEach(b => {
        let rows = []; try{ const sp = splitBlock(prog.awlSources[b]); const ifc = P.readInterface(sp.head + sp.body.replace(/[^\n]/g, ' ') + sp.foot); rows = ifc ? ifc.rows : []; }catch(e){}
        rows.forEach(r => { if(r.sec === 'Temp') s.add('TEMP'); if(r.sec === 'Static') s.add('STAT'); const ty = String(r.type).toUpperCase(); if(['BOOL', 'INT', 'DINT', 'REAL', 'TIME'].includes(ty)) s.add(ty); });
        prog.awlBlocks[b].constructs.forEach(k => s.add(k));
      });
    }
    return s;
  };
  const blank = src => { const sp = splitBlock(src); return sp ? { sp, src: sp.head + sp.body.replace(/[^\n]/g, ' ') + sp.foot } : { sp:null, src }; };
  W.readInterface = src => P.readInterface(blank(src).src);
  W.writeInterface = (src, rows) => {
    const b = blank(src); const out = P.writeInterface(b.src, rows);
    if(!b.sp) return out;
    const sp2 = splitBlock(out); return sp2.head + b.sp.body + sp2.foot;
  };
  return W;
}

// Status einer Zeile aus einem Variablenabbild: {v, a, b} (undefined = Zeile nicht ausgeführt)
function statusOf(tr, env){
  const out = {};
  if(!tr || !env) return out;
  Object.keys(tr.status).forEach(l => { const s = tr.status[l]; if(s.x && !env[s.x]) return;
    out[l] = { v: s.v ? env[s.v] : undefined, a: s.a ? env[s.a] : undefined, b: s.b ? env[s.b] : undefined, ta: s.ta, tb: s.tb }; });
  return out;
}
// Anzahl Anweisungen (für Sterne)
function instrCount(src){ try{ return parse(src).rows.filter(r => r && !r.net && !r.param && r.op).length; }catch(e){ return 999; } }

root.AWL = { parse, translate, wrapEngine, wrapPro, splitBlock, statusOf, instrCount, AWLError, INTERNAL, resolveOperand, projectTypes };
if(typeof module !== 'undefined' && module.exports) module.exports = root.AWL;
})(typeof window !== 'undefined' ? window : globalThis);
