// ERZEUGT von dev/build.js – nicht von Hand ändern. Engines + Prüfungspools für die Bewertung im Worker.
/* ==== engine.js ==== */
(function(root){
"use strict";
/* ============================================================
   SCL-ENGINE v4 — Tokenizer → Parser → Typprüfung → Interpreter
   ------------------------------------------------------------
   Unterstützt (Teilmenge von Siemens SCL / IEC 61131-3 ST):
   Anweisungen : :=  IF/ELSIF/ELSE  CASE (Listen, Bereiche a..b)
                 FOR..TO..BY..DO  WHILE  REPEAT..UNTIL  EXIT  CONTINUE
                 RETURN  FB-Aufrufe Inst(IN := x, Q => y);
   Ausdrücke   : SCL-Präzedenz (** / NOT,- / * / MOD / + - / Vergleich /
                 = <> / AND & / XOR / OR), Arrays a[i], FB-Ausgänge Inst.Q
   Literale    : TRUE/FALSE, 42, 16#FF, 2#1010, 1.5, 2.5E3,
                 T#2S, T#500MS, T#1m30s, TIME#3s
   Typen       : BOOL, INT, REAL, TIME, ARRAY OF ..., FB-Instanzen
   Bausteine   : TON TOF TP R_TRIG F_TRIG CTU CTD
   Funktionen  : ABS SQRT MIN MAX LIMIT ROUND TRUNC INT_TO_REAL
                 REAL_TO_INT BOOL_TO_INT
   TIA-Schreibweise #Var und "Var" wird akzeptiert. Bezeichner sind –
   wie in SCL – unabhängig von Gross-/Kleinschreibung.
   Zeitmodell  : Jeder Testschritt = ein SPS-Zyklus. dt = Zeit seit dem
                 vorherigen Zyklus. Timer messen ab dem Zyklus, in dem
                 ihr Eingang erstmals erkannt wurde.
   ============================================================ */

class SCLError extends Error{
  constructor(kind, message, line, col, extra){
    super(message);
    this.kind = kind;            // 'syntax' | 'semantic' | 'runtime'
    this.line = line || 0;
    this.col = col || 0;
    Object.assign(this, extra || {});
  }
}
// Rückwärtskompatible Namen
const ParseError = SCLError, RuntimeErr = SCLError;

/* ---------------- Tokenizer ---------------- */
const KEYWORDS = new Set([
  'IF','THEN','ELSIF','ELSE','END_IF','CASE','OF','END_CASE',
  'FOR','TO','BY','DO','END_FOR','WHILE','END_WHILE','REPEAT','UNTIL','END_REPEAT',
  'EXIT','CONTINUE','RETURN','AND','OR','XOR','NOT','MOD','TRUE','FALSE'
]);
const DECL_WORDS = new Set(['VAR','END_VAR','VAR_INPUT','VAR_OUTPUT','VAR_TEMP','VAR_IN_OUT',
  'FUNCTION_BLOCK','END_FUNCTION_BLOCK','FUNCTION','END_FUNCTION','BEGIN','PROGRAM','END_PROGRAM','ORGANIZATION_BLOCK']);

function tokenize(src){
  const toks = [];
  let i = 0, line = 1, lineStart = 0;
  const n = src.length;
  const push = (type, val, start, extra) => toks.push(Object.assign({type, val, line, col: start - lineStart + 1}, extra||{}));
  const err = (msg, at) => { throw new SCLError('syntax', msg, line, (at===undefined?i:at) - lineStart + 1); };
  while(i < n){
    const c = src[i];
    if(c === '\n'){ i++; line++; lineStart = i; continue; }
    if(/\s/.test(c)){ i++; continue; }
    // Kommentare
    if(c === '/' && src[i+1] === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
    if((c === '(' && src[i+1] === '*') || (c === '/' && src[i+1] === '*')){
      const close = c === '(' ? '*)' : '*/';
      const startLine = line;
      i += 2;
      while(i < n && src.slice(i, i+2) !== close){ if(src[i] === '\n'){ line++; lineStart = i+1; } i++; }
      if(i >= n) throw new SCLError('syntax', 'Kommentar ab Zeile '+startLine+' wird nie geschlossen (fehlt "'+close+'").', startLine, 1);
      i += 2; continue;
    }
    const start = i;
    // Zeit-Literale T#.. / TIME#..
    const tm = /^(T|TIME)#/i.exec(src.slice(i, i+5));
    if(tm && /[0-9]/.test(src[i+tm[0].length] || '')){
      let j = i + tm[0].length;
      let total = 0, any = false;
      const re = /^([0-9][0-9_]*(?:\.[0-9]+)?)(ms|d|h|m|s)/i;
      while(j < n){
        const m = re.exec(src.slice(j));
        if(!m) break;
        const v = parseFloat(m[1].replace(/_/g,''));
        const u = m[2].toLowerCase();
        total += u==='ms' ? v/1000 : u==='s' ? v : u==='m' ? v*60 : u==='h' ? v*3600 : v*86400;
        j += m[0].length; any = true;
        if(src[j] === '_') j++;
      }
      if(!any || /[A-Za-z0-9]/.test(src[j]||'')) err('Ungültiges Zeit-Literal. Beispiele: T#3S, T#500MS, T#1M30S.', start);
      push('NUMBER', total, start, {ntype:'TIME', raw: src.slice(start, j)});
      i = j; continue;
    }
    // Zahlen (inkl. 16#FF, 2#1010, 8#17, Real, Exponent, _-Trenner)
    if(/[0-9]/.test(c)){
      let j = i;
      while(j < n && /[0-9_]/.test(src[j])) j++;
      if(src[j] === '#' && /^(2|8|16)$/.test(src.slice(i,j))){
        const base = parseInt(src.slice(i,j),10);
        let k = j+1; const ds = k;
        while(k < n && /[0-9A-Fa-f_]/.test(src[k])) k++;
        const digits = src.slice(ds,k).replace(/_/g,'');
        const v = parseInt(digits, base);
        if(!digits || isNaN(v)) err('Ungültiges '+base+'#-Literal.', start);
        push('NUMBER', v, start, {ntype:'INT', raw: src.slice(start,k)});
        i = k; continue;
      }
      let isReal = false;
      if(src[j] === '.' && /[0-9]/.test(src[j+1]||'')){
        isReal = true; j++;
        while(j < n && /[0-9_]/.test(src[j])) j++;
      }
      if(/[eE]/.test(src[j]||'') && /[-+0-9]/.test(src[j+1]||'')){
        let k = j+1; if(src[k]==='+'||src[k]==='-') k++;
        if(/[0-9]/.test(src[k]||'')){ isReal = true; j = k; while(j<n && /[0-9]/.test(src[j])) j++; }
      }
      const raw = src.slice(i,j);
      if(/[A-Za-z_]/.test(src[j]||'')) err('Bezeichner dürfen nicht mit einer Ziffer beginnen ("'+raw+src[j]+'...").', start);
      push('NUMBER', parseFloat(raw.replace(/_/g,'')), start, {ntype: isReal ? 'REAL' : 'INT', raw});
      i = j; continue;
    }
    // Operatoren
    const two = src.slice(i, i+2);
    if([':=','=>','<=','>=','<>','**','..'].includes(two)){ push('OP', two, start); i += 2; continue; }
    if(two === '==') err('In SCL vergleicht man mit einem einfachen "=" (nicht "==").', start);
    if(two === '!=') err('"Ungleich" schreibt man in SCL als "<>" (nicht "!=").', start);
    if(two === '&&') err('Statt "&&" schreibt man in SCL AND.', start);
    if(two === '||') err('Statt "||" schreibt man in SCL OR.', start);
    if(c === '!') err('Statt "!" schreibt man in SCL NOT.', start);
    if('+-*/<>=()[],;:.&'.includes(c)){ push('OP', c, start); i++; continue; }
    // Adressen %I0.0 %Q0.1 %M3.2 %MW10
    if(c === '%'){
      let j = i+1;
      while(j < n && /[A-Za-z]/.test(src[j])) j++;
      const letters = src.slice(i+1, j);
      const ns = j;
      while(j < n && /[0-9.]/.test(src[j])) j++;
      if(!letters || j === ns) err('Ungültige Adresse. Beispiele: %I0.0, %Q0.1, %M3.2.', start);
      push('IDENT', (letters.toUpperCase() + src.slice(ns,j)).replace(/\./g,'_'), start, {raw: src.slice(start,j)});
      i = j; continue;
    }
    // "Globale Variable" (TIA-Schreibweise)
    if(c === '"'){
      let j = i+1;
      while(j < n && src[j] !== '"' && src[j] !== '\n') j++;
      if(src[j] !== '"') err('Anführungszeichen wird nicht geschlossen.', start);
      const name = src.slice(i+1, j);
      if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) err('Ungültiger Variablenname "'+name+'".', start);
      push('IDENT', name, start, {raw: src.slice(start, j+1)});
      i = j+1; continue;
    }
    // #LokaleVariable (TIA-Schreibweise)
    if(c === '#' && /[A-Za-z_]/.test(src[i+1]||'')){ i++; continue; }
    if(/[A-Za-z_]/.test(c)){
      let j = i;
      while(j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i,j), up = word.toUpperCase();
      if(KEYWORDS.has(up)) push('KW', up, start, {raw: word});
      else if(DECL_WORDS.has(up)) throw new SCLError('syntax', '"'+word+'": Deklarationen brauchst du hier nicht — alle Variablen der Aufgabe sind bereits angelegt. Schreibe nur die Anweisungen.', line, start-lineStart+1);
      else push('IDENT', word, start);
      i = j; continue;
    }
    if(c === "'") err("Texte (STRING) werden in dieser Anlage nicht verwendet.", start);
    err('Unerwartetes Zeichen "'+c+'".', start);
  }
  toks.push({type:'EOF', val:null, line, col: i - lineStart + 1});
  return toks;
}

/* ---------------- Parser ---------------- */
const STMT_END_KWS = ['ELSIF','ELSE','END_IF','END_CASE','END_FOR','END_WHILE','UNTIL','END_REPEAT'];

function parseProgram(src){
  const T = tokenize(src);
  let p = 0;
  const peek = (o) => T[p + (o||0)];
  const isKW = (v, o) => { const t = peek(o); return t.type==='KW' && t.val===v; };
  const isOP = (v, o) => { const t = peek(o); return t.type==='OP' && t.val===v; };
  const describe = t => t.type==='EOF' ? 'Programmende' : '"' + (t.raw || t.val) + '"';
  const fail = (msg, t) => { t = t || peek(); throw new SCLError('syntax', msg, t.line, t.col); };

  function expectOP(v, ctx){
    if(isOP(v)) return T[p++];
    const t = peek();
    if(v === ';'){
      const prev = T[p-1];
      if(prev && t.line > prev.line) fail('Am Ende von Zeile '+prev.line+' fehlt ein Semikolon ";".', {line:prev.line, col:prev.col + String(prev.raw||prev.val).length});
      fail('Erwartet ";" '+(ctx||'')+' — gefunden '+describe(t)+'.', t);
    }
    if(v === ':=' && isOP('=')) fail('Zuweisungen schreibt man in SCL mit ":=" (ein "=" ist ein Vergleich).', t);
    fail('Erwartet "'+v+'" '+(ctx||'')+' — gefunden '+describe(t)+'.', t);
  }
  function expectKW(v, ctx, openTok){
    if(isKW(v)) return T[p++];
    const t = peek();
    if(openTok && t.type==='EOF') fail(ctx + ' aus Zeile '+openTok.line+' wird nicht mit '+v+' abgeschlossen.', openTok);
    fail('Erwartet '+v+(ctx?' ('+ctx+')':'')+' — gefunden '+describe(t)+'.', t);
  }

  /* ---- Ausdrücke (Präzedenz nach Siemens SCL) ---- */
  const BIN_PREC = { 'OR':1, 'XOR':2, 'AND':3, '&':3, '=':4, '<>':4, '<':5, '>':5, '<=':5, '>=':5,
                     '+':6, '-':6, '*':7, '/':7, 'MOD':7, '**':9 };
  function binOpAt(){
    const t = peek();
    if(t.type==='KW' && ['OR','XOR','AND','MOD'].includes(t.val)) return t.val;
    if(t.type==='OP' && Object.prototype.hasOwnProperty.call(BIN_PREC, t.val)) return t.val;
    return null;
  }
  function parseExpr(minPrec){
    minPrec = minPrec || 1;
    let left = parseUnary();
    while(true){
      const op = binOpAt();
      if(!op) break;
      const prec = BIN_PREC[op];
      if(prec < minPrec) break;
      const opTok = T[p++];
      const right = op === '**' ? parseExpr(prec) : parseExpr(prec + 1);
      left = {k:'bin', op: op==='&' ? 'AND' : op, l:left, r:right, line:opTok.line, col:opTok.col};
    }
    return left;
  }
  function parseUnary(){
    const t = peek();
    if(t.type==='KW' && t.val==='NOT'){ p++; return {k:'un', op:'NOT', e: parseExpr(8), line:t.line, col:t.col}; }
    if(t.type==='OP' && (t.val==='-' || t.val==='+')){
      p++;
      const e = parseExpr(8);
      if(t.val==='+') return e;
      if(e.k==='num'){ e.v = -e.v; return e; }
      return {k:'un', op:'NEG', e, line:t.line, col:t.col};
    }
    return parsePostfix(parsePrimary());
  }
  function parsePrimary(){
    const t = peek();
    if(t.type==='NUMBER'){ p++; return {k:'num', v:t.val, nt:t.ntype, line:t.line, col:t.col}; }
    if(t.type==='KW' && (t.val==='TRUE' || t.val==='FALSE')){ p++; return {k:'bool', v: t.val==='TRUE', line:t.line, col:t.col}; }
    if(t.type==='OP' && t.val==='('){
      p++;
      const e = parseExpr(1);
      expectOP(')', 'zum Schliessen der Klammer');
      return e;
    }
    if(t.type==='IDENT'){
      p++;
      if(isOP('(')){
        p++;
        const args = [];
        if(!isOP(')')){
          while(true){
            // benannte Parameter (LIMIT(MN := 0, IN := x, MX := 9)) werden positionsweise übernommen
            if(peek().type==='IDENT' && isOP(':=',1)){ p += 2; }
            args.push(parseExpr(1));
            if(isOP(',')){ p++; continue; }
            break;
          }
        }
        expectOP(')', 'nach den Funktionsargumenten');
        return {k:'call', fn:t.val, args, line:t.line, col:t.col};
      }
      return {k:'var', name:t.val, line:t.line, col:t.col};
    }
    if(t.type==='EOF') fail('Der Ausdruck ist unvollständig — das Programm endet mitten in einer Anweisung.', t);
    if(t.type==='OP' && t.val===';') fail('Hier fehlt ein Wert oder Ausdruck vor ";".', t);
    if(t.type==='KW') fail('Hier wird ein Wert erwartet, gefunden wurde das Schlüsselwort '+t.val+'.', t);
    fail('Unerwartetes Zeichen '+describe(t)+' in einem Ausdruck.', t);
  }
  function parsePostfix(e){
    while(true){
      if(isOP('[')){
        const t = T[p++];
        const idx = parseExpr(1);
        expectOP(']', 'nach dem Array-Index');
        e = {k:'idx', base:e, index:idx, line:t.line, col:t.col};
        continue;
      }
      if(isOP('.')){
        const t = T[p++];
        const m = peek();
        if(m.type !== 'IDENT') fail('Nach "." wird der Name eines Bausteinausgangs erwartet (z.B. .Q).', m);
        p++;
        e = {k:'mem', base:e, member:m.val, line:t.line, col:t.col};
        continue;
      }
      return e;
    }
  }

  /* ---- Anweisungen ---- */
  function parseBlock(stopFn){
    const out = [];
    while(true){
      const t = peek();
      if(t.type==='EOF') break;
      if(stopFn(t)) break;
      out.push(parseStatement());
    }
    return out;
  }
  const stopAt = (...kws) => t => t.type==='KW' && kws.includes(t.val);

  function parseStatement(){
    const t = peek();
    if(t.type==='OP' && t.val===';'){ p++; return {k:'nop', line:t.line}; }
    if(t.type==='KW'){
      switch(t.val){
        case 'IF': return parseIf();
        case 'CASE': return parseCase();
        case 'FOR': return parseFor();
        case 'WHILE': return parseWhile();
        case 'REPEAT': return parseRepeat();
        case 'EXIT': p++; expectOP(';','nach EXIT'); return {k:'exit', line:t.line};
        case 'CONTINUE': p++; expectOP(';','nach CONTINUE'); return {k:'continue', line:t.line};
        case 'RETURN': p++; expectOP(';','nach RETURN'); return {k:'return', line:t.line};
        case 'ELSIF': case 'ELSE': fail(t.val+' ohne passendes IF (oder das IF davor wurde bereits mit END_IF geschlossen).', t);
        case 'END_IF': case 'END_CASE': case 'END_FOR': case 'END_WHILE': case 'END_REPEAT': case 'UNTIL':
          fail(t.val+' ohne zugehörigen Anfang — prüfe, ob du einen Block doppelt geschlossen hast.', t);
        case 'THEN': fail('THEN ohne vorangehendes IF.', t);
        case 'DO': fail('DO ohne vorangehendes FOR/WHILE.', t);
      }
      fail('Eine Anweisung darf nicht mit '+t.val+' beginnen.', t);
    }
    if(t.type==='IDENT'){
      const target = parsePostfix({k:'var', name:t.val, line:t.line, col:t.col, _tok:p++});
      if(target.k==='var' && isOP('(')) return parseFbCall(t);
      if(isOP(':=')){
        const opTok = T[p++];
        if(isOP(';')) fail('Nach ":=" fehlt der Wert, der zugewiesen werden soll.', peek());
        const expr = parseExpr(1);
        expectOP(';', 'am Ende der Zuweisung');
        return {k:'assign', target, expr, line:t.line, col:t.col, opLine: opTok.line};
      }
      if(isOP('=')) fail('Zuweisungen schreibt man in SCL mit ":=" — ein einfaches "=" ist ein Vergleich.', peek());
      if(isOP(':')) fail('Erwartet ":=" (Doppelpunkt UND Gleichheitszeichen, ohne Leerzeichen dazwischen).', peek());
      if(peek().type==='IDENT' && peek().line > t.line) fail('Am Ende von Zeile '+t.line+' fehlt vermutlich ":= ...;" oder ein ";".', t);
      fail('Nach "'+(t.raw||t.val)+'" wird ":=" (Zuweisung) oder "(" (Baustein-Aufruf) erwartet — gefunden '+describe(peek())+'.', peek());
    }
    if(t.type==='NUMBER') fail('Eine Anweisung kann nicht mit einer Zahl beginnen. (Steht hier vielleicht eine Zeile zu viel?)', t);
    fail('Unerwartetes Zeichen '+describe(t)+'.', t);
  }

  function parseFbCall(nameTok){
    expectOP('(');
    const inputs = [], outputs = [];
    if(!isOP(')')){
      while(true){
        const pt = peek();
        if(pt.type!=='IDENT') fail('Im Baustein-Aufruf wird ein Parametername erwartet, z.B. IN := ... oder Q => ...', pt);
        p++;
        if(isOP(':=')){ p++; inputs.push({name:pt.val, expr: parseExpr(1), line:pt.line, col:pt.col}); }
        else if(isOP('=>')){ p++;
          const vt = peek();
          if(vt.type!=='IDENT') fail('Nach "=>" wird eine Variable erwartet, in die der Ausgang geschrieben wird.', vt);
          const target = parsePostfix({k:'var', name:vt.val, line:vt.line, col:vt.col, _tok:p++});
          outputs.push({name:pt.val, target, line:pt.line, col:pt.col});
        }
        else if(isOP('=')) fail('Parameter werden mit ":=" (Eingang) bzw. "=>" (Ausgang) versorgt — nicht mit "=".', peek());
        else fail('Nach dem Parameternamen "'+pt.val+'" wird ":=" erwartet.', peek());
        if(isOP(',')){ p++; continue; }
        break;
      }
    }
    expectOP(')', 'zum Schliessen des Baustein-Aufrufs');
    expectOP(';', 'nach dem Baustein-Aufruf');
    return {k:'fbcall', inst:nameTok.val, inputs, outputs, line:nameTok.line, col:nameTok.col};
  }

  function parseIf(){
    const ifTok = T[p++];
    const branches = [];
    if(isKW('THEN')) fail('Nach IF fehlt die Bedingung.', peek());
    let cond = parseCondUntil('THEN', ifTok, 'IF');
    let body = parseBlock(stopAt('ELSIF','ELSE','END_IF'));
    branches.push({cond, body});
    let elseBody = null;
    while(true){
      if(isKW('ELSIF')){
        const et = T[p++];
        const c = parseCondUntil('THEN', et, 'ELSIF');
        branches.push({cond:c, body: parseBlock(stopAt('ELSIF','ELSE','END_IF'))});
        continue;
      }
      if(isKW('ELSE')){
        p++;
        if(isKW('IF')){
          // ELSE IF … (verschachteltes IF) ist gültiges SCL, braucht aber ein eigenes END_IF
        }
        elseBody = parseBlock(stopAt('END_IF','ELSIF','ELSE'));
        if(isKW('ELSIF') || isKW('ELSE')) fail('Nach dem ELSE-Zweig darf kein weiteres '+peek().val+' folgen — ELSE muss der letzte Zweig sein.', peek());
      }
      break;
    }
    if(!isKW('END_IF')){
      const t = peek();
      const elseIf = elseBody && elseBody.length && elseBody[0].k==='if';
      if(t.type==='EOF') fail('IF aus Zeile '+ifTok.line+' wird nie mit END_IF abgeschlossen.' + (elseIf ? ' Tipp: Schreibe ELSIF zusammen — "ELSE IF" öffnet ein neues IF, das ein eigenes END_IF braucht.' : ''), ifTok);
      fail('Erwartet END_IF (für das IF aus Zeile '+ifTok.line+') — gefunden '+describe(t)+'.', t);
    }
    p++;
    expectOP(';', 'nach END_IF');
    return {k:'if', branches, elseBody, line:ifTok.line};
  }
  function parseCondUntil(kw, openTok, what){
    const startTok = peek();
    const e = parseExpr(1);
    if(!isKW(kw)){
      const t = peek();
      if(t.type==='OP' && t.val===':=') fail('In der '+what+'-Bedingung steht ":=". Vergleiche schreibt man mit "=".', t);
      if(t.line > startTok.line || t.type==='EOF') fail('Nach der '+what+'-Bedingung fehlt '+kw+'.', openTok);
      fail('Erwartet '+kw+' nach der '+what+'-Bedingung — gefunden '+describe(t)+'.', t);
    }
    p++;
    return e;
  }

  function atCaseLabel(){
    const t = peek();
    if(t.type==='NUMBER') return true;
    if(t.type==='OP' && t.val==='-' && peek(1).type==='NUMBER') return true;
    return false;
  }
  function readLabelNum(){
    let neg = false;
    if(isOP('-')){ p++; neg = true; }
    const t = peek();
    if(t.type!=='NUMBER' || t.ntype!=='INT') fail('Fallwerte in CASE müssen ganze Zahlen sein.', t);
    p++;
    return neg ? -t.val : t.val;
  }
  function parseCase(){
    const caseTok = T[p++];
    const sel = parseExpr(1);
    expectKW('OF', 'nach dem CASE-Ausdruck');
    const branches = [];
    while(atCaseLabel()){
      const labels = [];
      const labTok = peek();
      while(true){
        const lo = readLabelNum();
        let hi = lo;
        if(isOP('..')){ p++; hi = readLabelNum(); if(hi < lo) fail('Bereich '+lo+'..'+hi+' ist leer — der kleinere Wert muss links stehen.', labTok); }
        labels.push({lo, hi});
        if(isOP(',')){ p++; continue; }
        break;
      }
      if(!isOP(':')){
        if(isOP(':=')) fail('Nach einem CASE-Fallwert steht ein einfacher Doppelpunkt ":" (z.B. 1: Lampe := TRUE;).', peek());
        fail('Nach dem Fallwert wird ":" erwartet.', peek());
      }
      p++;
      const body = parseBlock(t => (t.type==='KW' && (t.val==='ELSE' || t.val==='END_CASE')) || atCaseLabel());
      branches.push({labels, body, line: labTok.line});
    }
    let elseBody = null;
    if(isKW('ELSE')){ p++; elseBody = parseBlock(stopAt('END_CASE')); }
    if(!isKW('END_CASE')){
      const t = peek();
      if(t.type==='EOF') fail('CASE aus Zeile '+caseTok.line+' wird nie mit END_CASE abgeschlossen.', caseTok);
      fail('Erwartet END_CASE oder einen weiteren Fallwert (z.B. "3:") — gefunden '+describe(t)+'.', t);
    }
    p++;
    expectOP(';', 'nach END_CASE');
    return {k:'case', sel, branches, elseBody, line:caseTok.line};
  }
  function parseFor(){
    const forTok = T[p++];
    const vt = peek();
    if(vt.type!=='IDENT') fail('Nach FOR wird die Zählvariable erwartet (z.B. FOR i := 0 TO 9 DO).', vt);
    p++;
    if(!isOP(':=')) fail('Die Zählvariable wird mit ":=" initialisiert (FOR i := 0 TO 9 DO).', peek());
    p++;
    const from = parseExpr(1);
    expectKW('TO', 'FOR i := Start TO Ende DO');
    const to = parseExpr(1);
    let by = null;
    if(isKW('BY')){ p++; by = parseExpr(1); }
    expectKW('DO', 'FOR ... TO ... DO');
    const body = parseBlock(stopAt('END_FOR'));
    if(!isKW('END_FOR')) fail('FOR aus Zeile '+forTok.line+' wird nie mit END_FOR abgeschlossen.', peek().type==='EOF' ? forTok : peek());
    p++;
    expectOP(';', 'nach END_FOR');
    return {k:'for', v:{k:'var', name:vt.val, line:vt.line, col:vt.col}, from, to, by, body, line:forTok.line};
  }
  function parseWhile(){
    const wt = T[p++];
    const cond = parseCondUntil('DO', wt, 'WHILE');
    const body = parseBlock(stopAt('END_WHILE'));
    if(!isKW('END_WHILE')) fail('WHILE aus Zeile '+wt.line+' wird nie mit END_WHILE abgeschlossen.', peek().type==='EOF' ? wt : peek());
    p++;
    expectOP(';', 'nach END_WHILE');
    return {k:'while', cond, body, line:wt.line};
  }
  function parseRepeat(){
    const rt = T[p++];
    const body = parseBlock(stopAt('UNTIL','END_REPEAT'));
    if(!isKW('UNTIL')) fail('REPEAT aus Zeile '+rt.line+' braucht UNTIL <Bedingung> vor END_REPEAT.', peek().type==='EOF' ? rt : peek());
    p++;
    const cond = parseExpr(1);
    if(isOP(';')) p++;
    if(!isKW('END_REPEAT')) fail('Nach UNTIL <Bedingung> fehlt END_REPEAT.', peek());
    p++;
    expectOP(';', 'nach END_REPEAT');
    return {k:'repeat', body, cond, line:rt.line};
  }

  const body = parseBlock(() => false);
  return body;
}

/* ---------------- Typen & Deklarationen ---------------- */
const FB_DEFS = {
  TON:    { inputs:{IN:'BOOL', PT:'TIME'}, outputs:{Q:'BOOL', ET:'TIME'} },
  TOF:    { inputs:{IN:'BOOL', PT:'TIME'}, outputs:{Q:'BOOL', ET:'TIME'} },
  TP:     { inputs:{IN:'BOOL', PT:'TIME'}, outputs:{Q:'BOOL', ET:'TIME'} },
  R_TRIG: { inputs:{CLK:'BOOL'}, outputs:{Q:'BOOL'} },
  F_TRIG: { inputs:{CLK:'BOOL'}, outputs:{Q:'BOOL'} },
  CTU:    { inputs:{CU:'BOOL', R:'BOOL', PV:'INT'}, outputs:{Q:'BOOL', CV:'INT'} },
  CTD:    { inputs:{CD:'BOOL', LD:'BOOL', PV:'INT'}, outputs:{Q:'BOOL', CV:'INT'} }
};
const FUNCS = {
  ABS:         { args:1, sig: ts => { need(ts[0], 'num', 'ABS'); return ts[0]; } },
  SQRT:        { args:1, sig: ts => { need(ts[0], 'num', 'SQRT'); return 'REAL'; } },
  MIN:         { args:2, sig: ts => { ts.forEach(t=>need(t,'numtime','MIN')); return widen(ts[0], ts[1]); } },
  MAX:         { args:2, sig: ts => { ts.forEach(t=>need(t,'numtime','MAX')); return widen(ts[0], ts[1]); } },
  LIMIT:       { args:3, sig: ts => { ts.forEach(t=>need(t,'numtime','LIMIT')); return widen(widen(ts[0], ts[1]), ts[2]); } },
  ROUND:       { args:1, sig: ts => { need(ts[0], 'num', 'ROUND'); return 'INT'; } },
  TRUNC:       { args:1, sig: ts => { need(ts[0], 'num', 'TRUNC'); return 'INT'; } },
  INT_TO_REAL: { args:1, sig: ts => { need(ts[0], 'INT', 'INT_TO_REAL'); return 'REAL'; } },
  REAL_TO_INT: { args:1, sig: ts => { need(ts[0], 'num', 'REAL_TO_INT'); return 'INT'; } },
  BOOL_TO_INT: { args:1, sig: ts => { need(ts[0], 'BOOL', 'BOOL_TO_INT'); return 'INT'; } }
};
function roundHalfEven(x){
  const f = Math.floor(x), d = x - f;
  if(Math.abs(d - 0.5) < 1e-9) return (f % 2 === 0) ? f : f + 1;
  return Math.round(x);
}
const FUNC_IMPL = {
  ABS: a => Math.abs(a), SQRT: a => Math.sqrt(a), MIN: (a,b) => Math.min(a,b), MAX: (a,b) => Math.max(a,b),
  LIMIT: (mn, x, mx) => Math.max(mn, Math.min(mx, x)), ROUND: a => roundHalfEven(a), TRUNC: a => Math.trunc(a),
  INT_TO_REAL: a => a, REAL_TO_INT: a => roundHalfEven(a), BOOL_TO_INT: a => a ? 1 : 0
};
let _typeErrCtx = null;
function need(t, what, fn){
  const ok = what==='num' ? (t==='INT'||t==='REAL') : what==='numtime' ? (t==='INT'||t==='REAL'||t==='TIME') : t===what;
  if(!ok){
    const want = what==='num' ? 'eine Zahl (INT/REAL)' : what==='numtime' ? 'eine Zahl oder TIME' : what;
    throw new SCLError('semantic', fn+'() erwartet '+want+', bekommt aber '+tname(t)+'.', _typeErrCtx&&_typeErrCtx.line, _typeErrCtx&&_typeErrCtx.col);
  }
}
function widen(a,b){ if(a==='TIME'||b==='TIME') return 'TIME'; return (a==='REAL'||b==='REAL') ? 'REAL' : 'INT'; }
function tname(t){
  if(!t) return '?';
  if(typeof t === 'string') return t;
  if(t.kind==='ARRAY') return 'ARRAY['+'0..'+(t.len-1)+'] OF '+t.of;
  if(t.kind==='FB') return t.fb+'-Instanz';
  return '?';
}
function inferType(v){
  if(typeof v === 'boolean') return 'BOOL';
  if(typeof v === 'number') return Number.isInteger(v) ? 'INT' : 'REAL';
  if(Array.isArray(v)){
    let of = 'INT';
    if(v.some(x => typeof x === 'boolean')) of = 'BOOL';
    else if(v.some(x => typeof x === 'number' && !Number.isInteger(x))) of = 'REAL';
    return {kind:'ARRAY', of, len:v.length};
  }
  return 'INT';
}
function parseTypeSpec(spec, value){
  const s = String(spec).trim().toUpperCase();
  const m = /^ARRAY\s+OF\s+(\w+)$/.exec(s);
  if(m) return {kind:'ARRAY', of: normBase(m[1]), len: Array.isArray(value) ? value.length : 0};
  return normBase(s);
}
function normBase(s){
  if(['INT','DINT','SINT','UINT','UDINT','USINT','WORD','BYTE','DWORD'].includes(s)) return 'INT';
  if(['REAL','LREAL'].includes(s)) return 'REAL';
  if(['BOOL'].includes(s)) return 'BOOL';
  if(['TIME'].includes(s)) return 'TIME';
  return 'INT';
}
function buildSymbols(decl){
  decl = decl || {};
  const vars = decl.vars || {}, fbTypes = decl.fbTypes || {}, varTypes = decl.varTypes || {};
  const sym = {};           // lowerName -> {name, type}
  Object.keys(vars).forEach(n => {
    const type = varTypes[n] ? parseTypeSpec(varTypes[n], vars[n]) : inferType(vars[n]);
    sym[n.toLowerCase()] = {name:n, type};
  });
  Object.keys(fbTypes).forEach(n => {
    const fb = String(fbTypes[n]).toUpperCase();
    sym[n.toLowerCase()] = {name:n, type:{kind:'FB', fb}};
  });
  return sym;
}
function levenshtein(a, b){
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp = Array.from({length:a.length+1}, (_,i) => [i].concat(Array(b.length).fill(0)));
  for(let j=1;j<=b.length;j++) dp[0][j] = j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
  return dp[a.length][b.length];
}
function suggest(name, sym){
  let best = null, bd = 99;
  Object.values(sym).forEach(s => {
    const d = levenshtein(name, s.name);
    if(d < bd){ bd = d; best = s.name; }
  });
  const lim = Math.max(2, Math.floor(name.length/3));
  return bd <= lim ? best : null;
}

/* ---------------- Semantische Prüfung (statisch) ---------------- */
function check(prog, decl){
  const sym = buildSymbols(decl);
  const locals = {};          // FOR-Zählvariablen (implizit INT)
  const fail = (msg, node, extra) => { throw new SCLError('semantic', msg, node.line, node.col, extra); };
  const lookup = (node) => {
    const key = node.name.toLowerCase();
    if(sym[key]){ node.name = sym[key].name; return sym[key]; }
    if(locals[key]){ node.name = locals[key].name; return locals[key]; }
    const sug = suggest(node.name, sym);
    fail('Unbekannte Variable "'+node.name+'".' + (sug ? ' Meintest du "'+sug+'"?' : ' Prüfe die Schreibweise im Aufgabentext.'), node, {suggestion: sug});
  };
  const loopDepth = {n:0};

  function typeOf(e){
    _typeErrCtx = e;
    let t;
    switch(e.k){
      case 'num': t = e.nt; break;
      case 'bool': t = 'BOOL'; break;
      case 'var': {
        const s = lookup(e);
        if(s.type.kind==='FB') fail('"'+s.name+'" ist ein Baustein ('+s.type.fb+'). Lies seinen Ausgang, z.B. '+s.name+'.Q', e);
        if(s.type.kind==='ARRAY' && !e._allowArray) fail('"'+s.name+'" ist ein Array — greife über einen Index zu, z.B. '+s.name+'[0].', e);
        t = s.type; break;
      }
      case 'idx': {
        if(e.base.k!=='var') fail('Nur Array-Variablen können indiziert werden.', e);
        e.base._allowArray = true;
        const bt = typeOf(e.base);
        if(!bt || bt.kind!=='ARRAY') fail('"'+e.base.name+'" ist kein Array und kann nicht mit [ ] indiziert werden.', e);
        const it = typeOf(e.index);
        if(it!=='INT') fail('Der Array-Index muss eine ganze Zahl (INT) sein, nicht '+tname(it)+'.', e.index);
        e.len = bt.len;
        t = bt.of; break;
      }
      case 'mem': {
        if(e.base.k!=='var') fail('Nur Baustein-Instanzen haben Ausgänge mit ".".', e);
        const s = lookup(e.base);
        if(!s.type || s.type.kind!=='FB') fail('"'+s.name+'" ist kein Baustein und hat keinen Ausgang ".'+e.member+'".', e);
        const def = FB_DEFS[s.type.fb];
        const all = Object.assign({}, def.outputs, def.inputs);
        const key = Object.keys(all).find(k => k.toLowerCase() === e.member.toLowerCase());
        if(!key) fail(s.type.fb+' hat keinen Parameter "'+e.member+'". Verfügbar: '+Object.keys(def.outputs).join(', ')+'.', e);
        e.member = key;
        t = all[key]; break;
      }
      case 'un': {
        const it = typeOf(e.e);
        if(e.op==='NOT'){ if(it!=='BOOL') fail('NOT braucht einen BOOL-Wert, bekommt aber '+tname(it)+'.', e); t = 'BOOL'; }
        else { if(!['INT','REAL','TIME'].includes(it)) fail('Ein Minuszeichen passt nur vor Zahlen, nicht vor '+tname(it)+'.', e); t = it; }
        break;
      }
      case 'bin': t = typeBin(e); break;
      case 'call': {
        const fnKey = Object.keys(FUNCS).find(k => k === e.fn.toUpperCase());
        if(!fnKey){
          const s = sym[e.fn.toLowerCase()];
          if(s && s.type.kind==='FB') fail('Ein Baustein-Aufruf wie '+s.name+'(...) muss als eigene Anweisung mit ";" stehen, nicht innerhalb eines Ausdrucks. Lies danach '+s.name+'.Q.', e);
          if(['TON','TOF','TP','R_TRIG','F_TRIG','CTU','CTD'].includes(e.fn.toUpperCase())) fail(e.fn+' ist ein Bausteintyp. Rufe die in der Aufgabe angelegte Instanz auf, z.B. Mein_Timer(IN := ..., PT := T#2S);', e);
          fail('Unbekannte Funktion "'+e.fn+'". Verfügbar: '+Object.keys(FUNCS).join(', ')+'.', e);
        }
        e.fn = fnKey;
        const def = FUNCS[fnKey];
        if(e.args.length !== def.args) fail(fnKey+'() erwartet '+def.args+' Argument'+(def.args>1?'e':'')+', du übergibst '+e.args.length+'.', e);
        const ts = e.args.map(a => typeOf(a));
        _typeErrCtx = e;
        t = def.sig(ts); break;
      }
    }
    e.t = t;
    return t;
  }
  function typeBin(e){
    const lt = typeOf(e.l), rt = typeOf(e.r);
    const op = e.op;
    const isNum = x => x==='INT' || x==='REAL';
    if(op==='AND' || op==='OR' || op==='XOR'){
      if(lt!=='BOOL' || rt!=='BOOL'){
        const bad = lt!=='BOOL' ? e.l : e.r;
        fail(op+' verknüpft Wahrheitswerte (BOOL). '+(bad.k==='var'?'"'+bad.name+'" ist ':'Ein Operand ist ')+tname(bad.t)+'. Tipp: Vergleiche zuerst, z.B. (Wert > 5) '+op+' ...', e);
      }
      return 'BOOL';
    }
    if(op==='=' || op==='<>'){
      if(lt==='BOOL' && rt==='BOOL') return 'BOOL';
      if((isNum(lt) && isNum(rt)) || (lt==='TIME' && rt==='TIME')) return 'BOOL';
      fail('Vergleich "'+op+'" zwischen '+tname(lt)+' und '+tname(rt)+' ist nicht möglich.', e);
    }
    if(['<','>','<=','>='].includes(op)){
      if((isNum(lt) && isNum(rt)) || (lt==='TIME' && rt==='TIME')) return 'BOOL';
      if(lt==='TIME' || rt==='TIME') fail('Zeiten vergleicht man mit Zeit-Literalen, z.B. Timer.ET >= T#2S (nicht mit einer reinen Zahl).', e);
      fail('"'+op+'" vergleicht Zahlen, hier stehen aber '+tname(lt)+' und '+tname(rt)+'.', e);
    }
    if(op==='MOD'){
      if(lt!=='INT' || rt!=='INT') fail('MOD (Divisionsrest) funktioniert nur mit ganzen Zahlen (INT).', e);
      return 'INT';
    }
    if(op==='**'){
      if(!isNum(lt) || !isNum(rt)) fail('** (Potenz) braucht Zahlen.', e);
      return 'REAL';
    }
    // + - * /
    if(lt==='BOOL' || rt==='BOOL') fail('Mit BOOL-Werten kann man nicht rechnen ("'+op+'"). Für Logik nutze AND/OR/NOT, zum Zählen z.B. BOOL_TO_INT(...).', e);
    if(lt==='TIME' || rt==='TIME'){
      if((op==='+'||op==='-') && lt==='TIME' && rt==='TIME') return 'TIME';
      if(op==='*' && ((lt==='TIME' && rt==='INT') || (lt==='INT' && rt==='TIME'))) return 'TIME';
      if(op==='/' && lt==='TIME' && rt==='INT') return 'TIME';
      fail('Diese Rechnung mit TIME ist nicht erlaubt ('+tname(lt)+' '+op+' '+tname(rt)+').', e);
    }
    if(!isNum(lt) || !isNum(rt)) fail('"'+op+'" braucht Zahlen.', e);
    return (lt==='REAL' || rt==='REAL') ? 'REAL' : 'INT';
  }
  function assignable(target, vt, node, what){
    // target type tt, value type vt
    const tt = target;
    if(tt === vt) return;
    if(tt==='REAL' && vt==='INT') return; // implizite Erweiterung erlaubt
    let msg = 'Typkonflikt: '+what+' ist '+tname(tt)+', der Ausdruck liefert aber '+tname(vt)+'.';
    if(tt==='BOOL' && (vt==='INT'||vt==='REAL')) msg += ' Für BOOL-Variablen verwende TRUE oder FALSE (oder einen Vergleich).';
    else if(tt==='INT' && vt==='REAL') msg += ' Eine Kommazahl passt nicht automatisch in INT — wandle explizit um, z.B. mit REAL_TO_INT(...) oder TRUNC(...).';
    else if((tt==='INT'||tt==='REAL') && vt==='BOOL') msg += ' Ein Wahrheitswert ist keine Zahl. Zum Umwandeln gibt es BOOL_TO_INT(...).';
    else if(tt==='TIME') msg += ' Zeiten schreibt man als Zeit-Literal, z.B. T#3S oder T#500MS.';
    else if(vt==='TIME') msg += ' Eine Zeit (TIME) kann nicht direkt in '+tname(tt)+' gespeichert werden.';
    fail(msg, node);
  }
  function checkLvalue(target){
    if(target.k==='var'){
      const s = lookup(target);
      if(s.type.kind==='FB') fail('"'+s.name+'" ist ein Baustein. Baustein-Instanzen ruft man auf: '+s.name+'(...);', target);
      if(s.type.kind==='ARRAY') fail('"'+s.name+'" ist ein Array. Weise einzelnen Elementen zu, z.B. '+s.name+'[0] := ...;', target);
      if(s.isLoop && loopDepth.active && loopDepth.active[s.name]) fail('Die Zählvariable "'+s.name+'" darf innerhalb der FOR-Schleife nicht verändert werden — das übernimmt die Schleife selbst.', target);
      target.t = s.type;
      return s.type;
    }
    if(target.k==='idx') return typeOf(target);
    if(target.k==='mem') fail('Bausteinausgänge wie .'+target.member+' kann man nur lesen, nicht beschreiben. Setze stattdessen den Eingang beim Aufruf.', target);
    fail('Links von ":=" muss eine Variable stehen.', target);
  }
  function checkBlock(stmts){ stmts.forEach(checkStmt); }
  function checkCond(e, what){
    const t = typeOf(e);
    if(t !== 'BOOL'){
      let msg = 'Die '+what+'-Bedingung muss einen Wahrheitswert (BOOL) liefern, liefert aber '+tname(t)+'.';
      if(e.k==='var') msg += ' Meintest du z.B. "'+e.name+' = 1" oder "'+e.name+' > 0"?';
      fail(msg, e);
    }
  }
  function checkStmt(s){
    switch(s.k){
      case 'nop': case 'return': return;
      case 'exit': case 'continue':
        if(loopDepth.n === 0) fail((s.k==='exit'?'EXIT':'CONTINUE')+' ist nur innerhalb einer Schleife (FOR/WHILE/REPEAT) erlaubt.', s);
        return;
      case 'assign': {
        const tt = checkLvalue(s.target);
        const vt = typeOf(s.expr);
        assignable(tt, vt, s.expr.line ? s.expr : s, '"'+lvName(s.target)+'"');
        return;
      }
      case 'if':
        s.branches.forEach((b,i) => { checkCond(b.cond, i===0?'IF':'ELSIF'); checkBlock(b.body); });
        if(s.elseBody) checkBlock(s.elseBody);
        return;
      case 'case': {
        const st = typeOf(s.sel);
        if(st!=='INT') fail('Der CASE-Ausdruck muss eine ganze Zahl (INT) sein, ist aber '+tname(st)+'. Für BOOL nutze IF.', s.sel);
        const seen = [];
        s.branches.forEach(b => {
          b.labels.forEach(l => {
            seen.forEach(o => { if(l.lo <= o.hi && o.lo <= l.hi) fail('Der Fallwert '+(l.lo===l.hi?l.lo:l.lo+'..'+l.hi)+' überschneidet sich mit '+(o.lo===o.hi?o.lo:o.lo+'..'+o.hi)+' — jeder Wert darf nur in einem Zweig vorkommen.', {line:b.line, col:1}); });
            seen.push(l);
          });
          checkBlock(b.body);
        });
        if(s.elseBody) checkBlock(s.elseBody);
        return;
      }
      case 'for': {
        const key = s.v.name.toLowerCase();
        let vs = sym[key] || locals[key];
        if(!vs){ vs = locals[key] = {name:s.v.name, type:'INT', isLoop:true, local:true}; }
        else if(vs.type!=='INT') fail('Die FOR-Zählvariable muss vom Typ INT sein, "'+vs.name+'" ist '+tname(vs.type)+'.', s.v);
        vs.isLoop = true;
        s.v.name = vs.name;
        s.local = !!vs.local;
        const ft = typeOf(s.from), tt = typeOf(s.to);
        if(ft!=='INT' || tt!=='INT') fail('Start- und Endwert einer FOR-Schleife müssen ganze Zahlen (INT) sein.', s);
        if(s.by){ const bt = typeOf(s.by); if(bt!=='INT') fail('Die Schrittweite (BY) muss eine ganze Zahl sein.', s.by); if(s.by.k==='num' && s.by.v===0) fail('Schrittweite BY 0 würde nie enden.', s.by); }
        loopDepth.n++;
        loopDepth.active = loopDepth.active || {};
        const prev = loopDepth.active[vs.name];
        loopDepth.active[vs.name] = true;
        checkBlock(s.body);
        loopDepth.active[vs.name] = prev;
        loopDepth.n--;
        return;
      }
      case 'while': checkCond(s.cond, 'WHILE'); loopDepth.n++; checkBlock(s.body); loopDepth.n--; return;
      case 'repeat': loopDepth.n++; checkBlock(s.body); loopDepth.n--; checkCond(s.cond, 'UNTIL'); return;
      case 'fbcall': {
        const node = {k:'var', name:s.inst, line:s.line, col:s.col};
        const inst = lookup(node);
        s.inst = inst.name;
        if(!inst.type || inst.type.kind!=='FB'){
          fail('"'+inst.name+'" ist eine Variable, kein Baustein — sie kann nicht mit ( ) aufgerufen werden.', s);
        }
        const def = FB_DEFS[inst.type.fb];
        s.fb = inst.type.fb;
        s.inputs.forEach(pr => {
          const key = Object.keys(def.inputs).find(k => k.toLowerCase() === pr.name.toLowerCase());
          if(!key){
            const isOut = Object.keys(def.outputs).find(k => k.toLowerCase() === pr.name.toLowerCase());
            fail(isOut ? '"'+isOut+'" ist ein Ausgang von '+s.fb+'. Ausgänge liest man mit '+inst.name+'.'+isOut+' (oder im Aufruf mit '+isOut+' => Variable).'
                       : s.fb+' hat keinen Eingang "'+pr.name+'". Eingänge: '+Object.keys(def.inputs).join(', ')+'.', pr);
          }
          pr.name = key;
          const vt = typeOf(pr.expr);
          if(def.inputs[key]==='TIME' && vt!=='TIME') fail(key+' erwartet eine Zeit (TIME), z.B. '+key+' := T#3S.', pr);
          assignable(def.inputs[key], vt, pr, 'Eingang '+key);
        });
        s.outputs.forEach(pr => {
          const key = Object.keys(def.outputs).find(k => k.toLowerCase() === pr.name.toLowerCase());
          if(!key) fail(s.fb+' hat keinen Ausgang "'+pr.name+'". Ausgänge: '+Object.keys(def.outputs).join(', ')+'.', pr);
          pr.name = key;
          const tt = checkLvalue(pr.target);
          assignable(tt, def.outputs[key], pr, '"'+lvName(pr.target)+'"');
        });
        return;
      }
    }
  }
  function lvName(t){ return t.k==='var' ? t.name : t.k==='idx' ? lvName(t.base)+'[...]' : '?'; }
  checkBlock(prog);
  return { sym, locals };
}

/* ---------------- Interpreter ---------------- */
// Obergrenze Schleifendurchläufe; der Prüfungs-Server setzt root.SCL_MAX_ITER kleiner (CPU-Budget im Worker)
const MAX_ITER_DEFAULT = 100000;
const maxIter = () => (root.SCL_MAX_ITER > 0 ? root.SCL_MAX_ITER : MAX_ITER_DEFAULT);
const BREAK_EXIT = 1, BREAK_CONTINUE = 2, BREAK_RETURN = 3;

function evalE(e, env, ctx){
  switch(e.k){
    case 'num': case 'bool': return e.v;
    case 'var': return env[e.name];
    case 'idx': {
      const arr = env[e.base.name];
      const i = evalE(e.index, env, ctx);
      if(!Array.isArray(arr) || i < 0 || i >= arr.length || !Number.isInteger(i))
        throw new SCLError('runtime', 'Array-Index '+i+' liegt ausserhalb des gültigen Bereichs '+e.base.name+'[0..'+((arr&&arr.length||0)-1)+'].', e.line, e.col);
      return arr[i];
    }
    case 'mem': {
      const inst = env[e.base.name] || {};
      const v = inst[e.member];
      if(v === undefined) return (e.t==='BOOL') ? false : 0;
      return v;
    }
    case 'un': {
      const v = evalE(e.e, env, ctx);
      return e.op==='NOT' ? !v : -v;
    }
    case 'bin': {
      const op = e.op;
      if(op==='AND'){ const l = evalE(e.l, env, ctx); const r = evalE(e.r, env, ctx); return l && r; }
      if(op==='OR'){ const l = evalE(e.l, env, ctx); const r = evalE(e.r, env, ctx); return l || r; }
      const l = evalE(e.l, env, ctx), r = evalE(e.r, env, ctx);
      switch(op){
        case 'XOR': return l !== r;
        case '=': return (typeof l==='number') ? Math.abs(l-r) < 1e-9 : l === r;
        case '<>': return (typeof l==='number') ? Math.abs(l-r) >= 1e-9 : l !== r;
        case '<': return l < r;  case '>': return l > r;
        case '<=': return l <= r + 1e-12; case '>=': return l >= r - 1e-12;
        case '+': return l + r; case '-': return l - r;
        case '*': return e.t==='INT' ? Math.trunc(l*r) : l * r;
        case '/':
          if(r === 0) throw new SCLError('runtime', 'Division durch 0! Prüfe vor dem Teilen, ob der Divisor ungleich 0 ist.', e.line, e.col);
          if(e.t==='INT') return Math.trunc(l / r);
          return l / r;
        case 'MOD':
          if(r === 0) throw new SCLError('runtime', 'MOD 0 ist nicht definiert (Division durch 0).', e.line, e.col);
          return l % r;
        case '**': return Math.pow(l, r);
      }
      break;
    }
    case 'call': {
      const args = e.args.map(a => evalE(a, env, ctx));
      if(e.fn==='SQRT' && args[0] < 0) throw new SCLError('runtime', 'SQRT einer negativen Zahl ist nicht definiert.', e.line, e.col);
      return FUNC_IMPL[e.fn].apply(null, args);
    }
  }
  throw new SCLError('runtime', 'Interner Fehler: unbekannter Ausdruck.', e.line, e.col);
}
function toType(v, t){
  if(t==='INT' && typeof v==='number') return Math.trunc(v);
  return v;
}
function store(target, v, env, ctx){
  if(target.k==='var'){ env[target.name] = v; return; }
  if(target.k==='idx'){
    const arr = env[target.base.name];
    const i = evalE(target.index, env, ctx);
    if(!Array.isArray(arr) || i < 0 || i >= arr.length)
      throw new SCLError('runtime', 'Array-Index '+i+' liegt ausserhalb des gültigen Bereichs '+target.base.name+'[0..'+((arr&&arr.length||0)-1)+'].', target.line, target.col);
    arr[i] = v;
  }
}
function tick(ctx, line){
  if(++ctx.iter > maxIter()) throw new SCLError('runtime', 'Endlosschleife erkannt! Nach '+maxIter()+' Durchläufen wurde abgebrochen. Ändert sich die Schleifenbedingung wirklich?', line, 1);
}
function execBlock(stmts, env, ctx){
  for(const s of stmts){
    const r = execStmt(s, env, ctx);
    if(r) return r;
  }
  return 0;
}
function execStmt(s, env, ctx){
  switch(s.k){
    case 'nop': return 0;
    case 'assign': {
      let v = evalE(s.expr, env, ctx);
      store(s.target, toType(v, s.target.t || null), env, ctx);
      return 0;
    }
    case 'if':
      for(const b of s.branches){ if(evalE(b.cond, env, ctx)) return execBlock(b.body, env, ctx); }
      return s.elseBody ? execBlock(s.elseBody, env, ctx) : 0;
    case 'case': {
      const v = evalE(s.sel, env, ctx);
      for(const b of s.branches){ if(b.labels.some(l => v >= l.lo && v <= l.hi)) return execBlock(b.body, env, ctx); }
      return s.elseBody ? execBlock(s.elseBody, env, ctx) : 0;
    }
    case 'for': {
      const from = evalE(s.from, env, ctx), to = evalE(s.to, env, ctx);
      const by = s.by ? evalE(s.by, env, ctx) : 1;
      if(by === 0) throw new SCLError('runtime', 'Schrittweite 0 in FOR-Schleife.', s.line, 1);
      for(let i = from; by > 0 ? i <= to : i >= to; i += by){
        env[s.v.name] = i;
        tick(ctx, s.line);
        const r = execBlock(s.body, env, ctx);
        if(r === BREAK_EXIT) break;
        if(r === BREAK_RETURN) return r;
      }
      return 0;
    }
    case 'while':
      while(evalE(s.cond, env, ctx)){
        tick(ctx, s.line);
        const r = execBlock(s.body, env, ctx);
        if(r === BREAK_EXIT) break;
        if(r === BREAK_RETURN) return r;
      }
      return 0;
    case 'repeat':
      do{
        tick(ctx, s.line);
        const r = execBlock(s.body, env, ctx);
        if(r === BREAK_EXIT) break;
        if(r === BREAK_RETURN) return r;
      }while(!evalE(s.cond, env, ctx));
      return 0;
    case 'exit': return BREAK_EXIT;
    case 'continue': return BREAK_CONTINUE;
    case 'return': return BREAK_RETURN;
    case 'fbcall': {
      const inst = env[s.inst] = env[s.inst] || {};
      const ins = {};
      s.inputs.forEach(pr => { ins[pr.name] = evalE(pr.expr, env, ctx); });
      stepFB(s.fb, inst, ins, ctx.t);
      s.outputs.forEach(pr => store(pr.target, inst[pr.name], env, ctx));
      return 0;
    }
  }
  return 0;
}

/* ---- Bausteine: Zeitmodell mit absoluter Zykluszeit t ---- */
function stepFB(fb, st, ins, t){
  const def = FB_DEFS[fb];
  // nicht versorgte Eingänge behalten ihren letzten Wert (wie im Instanz-DB)
  st._in = st._in || {};
  Object.keys(def.inputs).forEach(k => {
    if(ins[k] !== undefined) st._in[k] = ins[k];
    if(st._in[k] === undefined) st._in[k] = def.inputs[k]==='BOOL' ? false : 0;
  });
  const I = st._in;
  switch(fb){
    case 'TON': {
      if(I.IN){
        if(!st._prev) st._start = t;
        const el = t - st._start;
        st.Q = el >= I.PT - 1e-9;
        st.ET = Math.min(el, I.PT);
      } else { st.Q = false; st.ET = 0; }
      st._prev = !!I.IN; break;
    }
    case 'TOF': {
      if(I.IN){ st.Q = true; st.ET = 0; st._run = false; }
      else {
        if(st._prev){ st._start = t; st._run = true; }
        if(st._run){
          const el = t - st._start;
          st.ET = Math.min(el, I.PT);
          st.Q = el < I.PT - 1e-9;
          if(!st.Q) st._run = false;
        } else { st.Q = false; if(st.ET === undefined) st.ET = 0; }
      }
      st._prev = !!I.IN; break;
    }
    case 'TP': {
      if(I.IN && !st._prev && !st._run){ st._run = true; st._start = t; }
      if(st._run){
        const el = t - st._start;
        if(el >= I.PT - 1e-9){ st._run = false; st.ET = I.PT; }
        else st.ET = el;
      }
      if(!st._run && !I.IN) st.ET = 0;
      st.Q = !!st._run;
      st._prev = !!I.IN; break;
    }
    case 'R_TRIG': st.Q = !!I.CLK && !st._prev; st._prev = !!I.CLK; break;
    case 'F_TRIG': {
      if(st._prev === undefined) st._prev = false;
      st.Q = !I.CLK && st._prev; st._prev = !!I.CLK; break;
    }
    case 'CTU': {
      if(st.CV === undefined) st.CV = 0;
      if(I.R) st.CV = 0;
      else if(I.CU && !st._prev) st.CV = st.CV + 1;
      st.Q = st.CV >= I.PV;
      st._prev = !!I.CU; break;
    }
    case 'CTD': {
      if(st.CV === undefined) st.CV = 0;
      if(I.LD) st.CV = I.PV;
      else if(I.CD && !st._prev) st.CV = st.CV - 1;
      st.Q = st.CV <= 0;
      st._prev = !!I.CD; break;
    }
  }
}

/* ---------------- Öffentliche API ---------------- */
function declOf(task){ return { vars: task.initialVars || {}, fbTypes: task.fbTypes || {}, varTypes: task.varTypes || {} }; }

// compileSCL(code, decl) -> Programm. decl = {vars, fbTypes, varTypes} oder ein Task-Objekt.
function compileSCL(src, decl){
  const stmts = parseProgram(src);
  if(decl && decl.initialVars) decl = declOf(decl);
  const info = check(stmts, decl || {vars:{}, fbTypes:{}});
  return { stmts, info, decl: decl || {} };
}
function clone(o){ return JSON.parse(JSON.stringify(o === undefined ? {} : o)); }
function freshEnv(prog, initialVars, setup){
  const env = Object.assign({}, clone(initialVars), clone(setup||{}));
  Object.values(prog.info.locals || {}).forEach(l => { if(env[l.name]===undefined) env[l.name] = 0; });
  Object.keys((prog.decl && prog.decl.fbTypes) || {}).forEach(n => { if(!env[n]) env[n] = {}; });
  return env;
}
function scan(prog, env, ctx){
  ctx.iter = 0;
  execBlock(prog.stmts, env, ctx);
}
function approxEqual(a, b){
  if(typeof a==='number' && typeof b==='number') return Math.abs(a-b) < 0.005;
  if(Array.isArray(a) && Array.isArray(b)) return a.length===b.length && a.every((x,i)=>approxEqual(x,b[i]));
  return a === b;
}
// Einzel-Zyklus-Tests. Liefert Bericht je Testfall.
function runSinglePassTests(prog, initialVars, testCases){
  const report = [];
  let ok = true;
  for(const tc of testCases){
    const env = freshEnv(prog, initialVars, tc.setup);
    const ctx = {t:0, iter:0};
    let error = null;
    try{ scan(prog, env, ctx); }catch(e){ if(e instanceof SCLError){ error = e; } else throw e; }
    const checks = Object.keys(tc.expect).map(k => ({ name:k, expected: tc.expect[k], actual: env[k], pass: !error && approxEqual(env[k], tc.expect[k]) }));
    const pass = !error && checks.every(c => c.pass);
    report.push({ setup: tc.setup||{}, checks, pass, error, env });
    if(!pass){ ok = false; }
  }
  const firstFail = report.find(r => !r.pass);
  return { ok, report, failedCase: firstFail, error: firstFail && firstFail.error };
}
// Zeitgesteuerte Tests: [{setup, steps:[{dt, inputs, expect}]}]
function runTimedTests(prog, initialVars, testCases){
  const report = [];
  let ok = true;
  for(const tc of testCases){
    const env = freshEnv(prog, initialVars, tc.setup);
    const ctx = {t:0, iter:0};
    const steps = [];
    let caseOk = true, error = null;
    for(const step of tc.steps){
      Object.assign(env, clone(step.inputs||{}));
      ctx.t += (step.dt || 0);
      try{ scan(prog, env, ctx); }catch(e){ if(e instanceof SCLError){ error = e; } else throw e; }
      const checks = Object.keys(step.expect||{}).map(k => ({ name:k, expected: step.expect[k], actual: env[k], pass: !error && approxEqual(env[k], step.expect[k]) }));
      const pass = !error && checks.every(c => c.pass);
      steps.push({ t: ctx.t, dt: step.dt||0, inputs: step.inputs||{}, checks, pass, env: snapshot(env) });
      if(!pass){ caseOk = false; ok = false; break; }
    }
    report.push({ setup: tc.setup||{}, steps, pass: caseOk, error });
    if(!caseOk) break;
  }
  const firstFail = report.find(r => !r.pass);
  return { ok, report, failedCase: firstFail, error: firstFail && firstFail.error };
}
function snapshot(env){
  const o = {};
  Object.keys(env).forEach(k => {
    const v = env[k];
    if(v && typeof v === 'object' && !Array.isArray(v)){
      const s = {}; Object.keys(v).forEach(m => { if(m[0] !== '_') s[m] = v[m]; }); o[k] = s;
    } else o[k] = Array.isArray(v) ? v.slice() : v;
  });
  return o;
}
function executeOnce(prog, initialVars, setup){
  const env = freshEnv(prog, initialVars, setup);
  scan(prog, env, {t:0, iter:0});
  return env;
}
function executeTimed(prog, initialVars, setup, steps){
  const env = freshEnv(prog, initialVars, setup);
  const ctx = {t:0, iter:0};
  const out = [];
  for(const step of steps){
    Object.assign(env, clone(step.inputs||{}));
    ctx.t += (step.dt||0);
    scan(prog, env, ctx);
    out.push(snapshot(env));
  }
  return out;
}
// Welche Sprachkonstrukte nutzt ein Programm? (für "mustUse"-Prüfungen)
function constructsUsed(prog){
  const set = new Set();
  function walkE(e){
    if(!e) return;
    if(e.k==='bin'){ set.add(e.op); walkE(e.l); walkE(e.r); }
    else if(e.k==='un'){ set.add(e.op); walkE(e.e); }
    else if(e.k==='idx'){ set.add('ARRAY'); walkE(e.base); walkE(e.index); }
    else if(e.k==='call'){ set.add(e.fn); e.args.forEach(walkE); }
    else if(e.k==='mem'){ walkE(e.base); }
  }
  function walk(list){
    list.forEach(s => {
      switch(s.k){
        case 'assign': if(s.target.k==='idx'){ set.add('ARRAY'); walkE(s.target.index); } walkE(s.expr); break;
        case 'if': set.add('IF'); if(s.branches.length>1) set.add('ELSIF'); if(s.elseBody) set.add('ELSE');
          s.branches.forEach(b => { walkE(b.cond); walk(b.body); }); if(s.elseBody) walk(s.elseBody); break;
        case 'case': set.add('CASE'); if(s.branches.some(b=>b.labels.some(l=>l.lo!==l.hi))) set.add('RANGE');
          walkE(s.sel); s.branches.forEach(b => walk(b.body)); if(s.elseBody){ set.add('ELSE'); walk(s.elseBody); } break;
        case 'for': set.add('FOR'); if(s.by) set.add('BY'); walkE(s.from); walkE(s.to); walk(s.body); break;
        case 'while': set.add('WHILE'); walkE(s.cond); walk(s.body); break;
        case 'repeat': set.add('REPEAT'); walk(s.body); walkE(s.cond); break;
        case 'exit': set.add('EXIT'); break;
        case 'continue': set.add('CONTINUE'); break;
        case 'fbcall': set.add(s.fb); s.inputs.forEach(p => walkE(p.expr)); if(s.outputs.length) set.add('=>'); break;
      }
    });
  }
  walk(prog.stmts);
  return set;
}

const SCLEngine = {
  compileSCL, runSinglePassTests, runTimedTests, executeOnce, executeTimed, constructsUsed,
  tokenize, parseProgram, SCLError, ParseError, RuntimeErr, FB_DEFS, FUNCS: Object.keys(FUNCS),
  KEYWORDS: Array.from(KEYWORDS), approxEqual, typeName: tname, buildSymbols, declOf
};
if(typeof module !== 'undefined' && module.exports){ module.exports = SCLEngine; }
root.SCLEngine = SCLEngine;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== engine_pro.js ==== */
(function(root){
"use strict";
/* ============================================================
   SCL-ENGINE PRO (v5) — Projekt-Modus für die Profi-Stufe
   ------------------------------------------------------------
   Ergänzt die v4-Engine (Kapitel 1–10) um vollständige Bausteine:
   FUNCTION / FUNCTION_BLOCK / ORGANIZATION_BLOCK / DATA_BLOCK / TYPE
   VAR_INPUT / VAR_OUTPUT / VAR_IN_OUT / VAR / VAR_TEMP / VAR CONSTANT
   Datentypen  : BOOL, SINT/USINT/INT/UINT/DINT/UDINT, REAL/LREAL, TIME,
                 BYTE/WORD/DWORD (Bitzugriff .%Xn), STRING[n], STRUCT,
                 UDTs, ARRAY[a..b(,c..d)] OF …, FB-Typen (eigene + TON…)
   Speicher    : STAT pro Instanz, TEMP bei jedem Aufruf neu (Vorbelegung
                 mit 0 wie in optimierten Bausteinen), IN als Kopie,
                 IN_OUT als Verweis, CONSTANT schreibgeschützt
   Aufrufe     : FC im Ausdruck/als Anweisung, FB über Einzelinstanz
                 "X_DB"(…) oder Multiinstanz #Inst(…), Ausgänge mit =>
   Programm    : OB100 (Anlauf) einmal, danach OB1 je Zyklus
   STRING      : LEN CONCAT LEFT RIGHT MID FIND DELETE INSERT REPLACE,
                 Umwandlungen X_TO_Y (vereinfacht, siehe Handbuch)
   Warnungen   : TEMP vor dem Schreiben gelesen, Ausgang nicht in jedem
                 Zweig, ungenutzte Variable, globale Daten im FB, Instanz
                 mehrfach aufgerufen, bedingter Instanzaufruf, String
                 abgeschnitten
   ============================================================ */

class SCLError extends Error{
  constructor(kind, message, line, col, extra){
    super(message);
    this.kind = kind; this.line = line || 0; this.col = col || 0;
    Object.assign(this, extra || {});
  }
}
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* ============================================================
   1. TYPEN
   ============================================================ */
const INT_TYPES = {
  SINT:  {bits:8,  signed:true},  USINT: {bits:8,  signed:false},
  INT:   {bits:16, signed:true},  UINT:  {bits:16, signed:false},
  DINT:  {bits:32, signed:true},  UDINT: {bits:32, signed:false}
};
const T = {};
Object.keys(INT_TYPES).forEach(n => {
  const d = INT_TYPES[n];
  T[n] = {k:'int', n, bits:d.bits, signed:d.signed,
    min: d.signed ? -Math.pow(2, d.bits-1) : 0,
    max: d.signed ? Math.pow(2, d.bits-1) - 1 : Math.pow(2, d.bits) - 1};
});
T.BOOL = {k:'bool', n:'BOOL'};
T.REAL = {k:'real', n:'REAL'}; T.LREAL = {k:'real', n:'LREAL'};
T.TIME = {k:'time', n:'TIME'};
T.BYTE = {k:'bits', n:'BYTE', bits:8, min:0, max:255};
T.WORD = {k:'bits', n:'WORD', bits:16, min:0, max:65535};
T.DWORD = {k:'bits', n:'DWORD', bits:32, min:0, max:4294967295};
T.STRING = {k:'string', n:'STRING', len:254};
T.CHAR = {k:'string', n:'CHAR', len:1, isChar:true};
T.VOID = {k:'void', n:'VOID'};
const ELEM_NAMES = Object.keys(T).filter(k => k !== 'VOID');
const TYPE_ALIAS = { TON_TIME:'TON', TOF_TIME:'TOF', TP_TIME:'TP', CTU_INT:'CTU', CTD_INT:'CTD' };

function mkString(len){ return {k:'string', n:'STRING', len}; }
function strLitType(v){ return {k:'string', n:'STRING', len: Math.max(1, v.length), lit:true, v}; }
function intLitType(v){
  const n = (v >= -32768 && v <= 32767) ? 'INT' : (v >= -2147483648 && v <= 2147483647) ? 'DINT' : 'UDINT';
  return Object.assign({}, T[n], {lit:true, v});
}

function typeStr(t){
  if(!t) return '?';
  switch(t.k){
    case 'bool': case 'int': case 'real': case 'time': case 'bits': return t.n;
    case 'string': return t.isChar ? 'CHAR' : 'STRING[' + t.len + ']';
    case 'array': return 'ARRAY[' + t.dims.map(d => d.lo + '..' + d.hi).join(', ') + '] OF ' + typeStr(t.of);
    case 'struct': return t.udt ? '"' + t.udt + '"' : 'STRUCT';
    case 'fb': return t.builtin ? t.name : '"' + t.name + '"';
    case 'void': return 'VOID';
  }
  return '?';
}
function typeNice(t){
  if(t && t.lit && t.k === 'int') return 'Ganzzahl ' + t.v;
  if(t && t.lit && t.k === 'string') return "Text '" + t.v + "'";
  return typeStr(t);
}
function typeEq(a, b){
  if(a === b) return true;
  if(!a || !b || a.k !== b.k) return false;
  switch(a.k){
    case 'bool': case 'time': case 'void': return true;
    case 'int': case 'bits': case 'real': return a.n === b.n;
    case 'string': return true;
    case 'array': return a.dims.length === b.dims.length && a.dims.every((d,i) => d.lo === b.dims[i].lo && d.hi === b.dims[i].hi) && typeEq(a.of, b.of);
    case 'struct':
      if(a.udt || b.udt) return a.udt === b.udt;
      return a.members.length === b.members.length && a.members.every((m,i) => m.name.toLowerCase() === b.members[i].name.toLowerCase() && typeEq(m.type, b.members[i].type));
    case 'fb': return a.name === b.name;
  }
  return false;
}
const isNum = t => t && (t.k === 'int' || t.k === 'real');
const isIntLike = t => t && (t.k === 'int' || t.k === 'bits');

// Kann ein Wert vom Typ src an ein Ziel vom Typ dst zugewiesen werden? → null oder Fehlermeldung
function assignMsg(dst, src){
  if(!dst || !src) return 'Typ unbekannt.';
  if(dst.k === 'fb') return 'Baustein-Instanzen kann man nicht zuweisen — man ruft sie auf.';
  if(src.k === 'void') return 'Der Aufruf liefert keinen Wert (Rückgabetyp VOID).';
  if(dst.k === 'int'){
    if(src.k === 'int'){
      if(src.lit) return (src.v >= dst.min && src.v <= dst.max) ? null : 'Der Wert ' + src.v + ' passt nicht in ' + dst.n + ' (' + dst.min + ' … ' + dst.max + ').';
      if(src.gen) return null;
      if(src.min >= dst.min && src.max <= dst.max) return null;
      return src.n + ' passt nicht sicher in ' + dst.n + ' (' + dst.min + ' … ' + dst.max + '). Wandle ausdrücklich um: ' + src.n + '_TO_' + dst.n + '(…).';
    }
    if(src.k === 'bits'){ return src.bits <= dst.bits ? null : src.n + ' ist breiter als ' + dst.n + '. Wandle um: ' + src.n + '_TO_' + dst.n + '(…).'; }
    if(src.k === 'real') return 'Eine Kommazahl (' + src.n + ') passt nicht automatisch in ' + dst.n + ' — wandle ausdrücklich um, z.B. mit ' + src.n + '_TO_' + dst.n + '(…), ROUND(…) oder TRUNC(…).';
    if(src.k === 'bool') return 'Ein Wahrheitswert ist keine Zahl. Zum Umwandeln gibt es BOOL_TO_' + dst.n + '(…).';
    if(src.k === 'time') return 'Eine Zeit (TIME) ist keine Ganzzahl. Zum Umwandeln gibt es TIME_TO_DINT(…) (liefert Millisekunden).';
    if(src.k === 'string') return 'Ein Text ist keine Zahl. Zum Umwandeln gibt es STRING_TO_' + dst.n + '(…).';
  }
  if(dst.k === 'real'){
    if(src.k === 'real' || src.k === 'int') return null;
    if(src.k === 'bool') return 'Ein Wahrheitswert ist keine Zahl.';
    if(src.k === 'string') return 'Ein Text ist keine Zahl. Zum Umwandeln gibt es STRING_TO_REAL(…).';
    return typeStr(src) + ' kann nicht in ' + dst.n + ' gespeichert werden.';
  }
  if(dst.k === 'bits'){
    if(src.k === 'bits') return src.bits <= dst.bits ? null : src.n + ' ist breiter als ' + dst.n + '.';
    if(src.k === 'int'){
      if(src.lit) return (src.v >= -Math.pow(2, dst.bits-1) && src.v <= dst.max) ? null : 'Der Wert ' + src.v + ' passt nicht in ' + dst.n + '.';
      return src.bits <= dst.bits ? null : src.n + ' ist breiter als ' + dst.n + '.';
    }
    return typeStr(src) + ' kann nicht in ' + dst.n + ' gespeichert werden.';
  }
  if(dst.k === 'bool'){
    if(src.k === 'bool') return null;
    return 'Für BOOL-Variablen verwende TRUE, FALSE oder einen Vergleich (hier steht ' + typeNice(src) + ').';
  }
  if(dst.k === 'time'){
    if(src.k === 'time') return null;
    return 'Zeiten schreibt man als Zeit-Literal, z.B. T#3S oder T#500MS (hier steht ' + typeNice(src) + ').';
  }
  if(dst.k === 'string'){
    if(src.k === 'string') return null;
    return 'Ein Text (STRING) braucht einen Text-Wert in einfachen Hochkommas, z.B. \'OK\'. Zahlen wandelt man mit ' + (src.n || 'INT') + '_TO_STRING(…) um.';
  }
  if(dst.k === 'array'){
    if(src.k === 'array' && typeEq(dst, src)) return null;
    return 'Arrays kann man nur als Ganzes zuweisen, wenn Grenzen und Elementtyp gleich sind (' + typeStr(dst) + ' ← ' + typeStr(src) + ').';
  }
  if(dst.k === 'struct'){
    if(src.k === 'struct' && typeEq(dst, src)) return null;
    return 'Strukturen kann man nur als Ganzes zuweisen, wenn sie vom gleichen Typ sind (' + typeStr(dst) + ' ← ' + typeStr(src) + ').';
  }
  return 'Typkonflikt: ' + typeStr(dst) + ' ← ' + typeStr(src) + '.';
}

/* ---------- Werte ---------- */
class ArrVal{
  constructor(dims, d){ this.dims = dims; this.d = d; }
  flat(idx, where){
    let off = 0, mul = 1;
    for(let i = this.dims.length - 1; i >= 0; i--){
      const dm = this.dims[i], v = idx[i];
      if(!Number.isInteger(v) || v < dm.lo || v > dm.hi)
        throw new SCLError('runtime', 'Array-Index ' + v + ' liegt ausserhalb der Grenzen ' + (where||'') + '[' + this.dims.map(x => x.lo + '..' + x.hi).join(', ') + '].', 0, 0);
      off += (v - dm.lo) * mul; mul *= (dm.hi - dm.lo + 1);
    }
    return off;
  }
}
function defaultVal(t){
  switch(t.k){
    case 'bool': return false;
    case 'int': case 'real': case 'time': case 'bits': return 0;
    case 'string': return '';
    case 'array': {
      let n = 1; t.dims.forEach(d => n *= (d.hi - d.lo + 1));
      const d = new Array(n); for(let i = 0; i < n; i++) d[i] = defaultVal(t.of);
      return new ArrVal(t.dims, d);
    }
    case 'struct': { const o = {}; t.members.forEach(m => { o[m.name] = m.init !== undefined ? cloneVal(m.init) : defaultVal(m.type); }); return o; }
    case 'fb': return newInstance(t);
  }
  return 0;
}
function newInstance(t){
  const o = {__fb: t.name};
  if(t.builtin){
    const def = BUILTIN_FB[t.name];
    Object.keys(def.outputs).forEach(k => o[k] = def.outputs[k] === 'BOOL' ? false : 0);
    Object.keys(def.inputs).forEach(k => o[k] = def.inputs[k] === 'BOOL' ? false : 0);
    return o;
  }
  const u = t.unit;
  ['Input','Output','Static'].forEach(sec => (u.iface[sec] || []).forEach(v => { o[v.name] = v.init !== undefined ? cloneVal(v.init) : defaultVal(v.type); }));
  return o;
}
function cloneVal(v){
  if(v instanceof ArrVal) return new ArrVal(v.dims, v.d.map(cloneVal));
  if(v && typeof v === 'object'){ const o = {}; Object.keys(v).forEach(k => o[k] = cloneVal(v[k])); return o; }
  return v;
}
function wrapInt(v, t){
  if(typeof v !== 'number' || !isFinite(v)) return 0;
  v = Math.trunc(v);
  const span = Math.pow(2, t.bits);
  let r = ((v - t.min) % span + span) % span + t.min;
  return r;
}
function coerce(v, t){
  if(!t) return v;
  switch(t.k){
    case 'int': return (t.lit || t.gen) ? Math.trunc(v) : wrapInt(v, t);
    case 'bits': return wrapInt(v, t);
    case 'string': { v = String(v); return v.length > t.len ? v.slice(0, t.len) : v; }
    case 'array': case 'struct': return cloneVal(v);
    case 'bool': return !!v;
  }
  return v;
}
function roundHalfEven(x){
  const f = Math.floor(x), d = x - f;
  if(Math.abs(d - 0.5) < 1e-9) return (f % 2 === 0) ? f : f + 1;
  return Math.round(x);
}
// JS-Wert → schlichte Darstellung (für Tests & Beobachten)
function plain(v){
  if(v instanceof ArrVal) return v.d.map(plain);
  if(v && typeof v === 'object'){ const o = {}; Object.keys(v).forEach(k => { if(k[0] !== '_') o[k] = plain(v[k]); }); return o; }
  return v;
}

/* ============================================================
   2. TOKENIZER
   ============================================================ */
const KW = new Set([
  'IF','THEN','ELSIF','ELSE','END_IF','CASE','OF','END_CASE','FOR','TO','BY','DO','END_FOR',
  'WHILE','END_WHILE','REPEAT','UNTIL','END_REPEAT','EXIT','CONTINUE','RETURN',
  'AND','OR','XOR','NOT','MOD','TRUE','FALSE',
  'VAR','VAR_INPUT','VAR_OUTPUT','VAR_IN_OUT','VAR_TEMP','END_VAR','CONSTANT','RETAIN','NON_RETAIN','DB_SPECIFIC',
  'FUNCTION','END_FUNCTION','FUNCTION_BLOCK','END_FUNCTION_BLOCK','ORGANIZATION_BLOCK','END_ORGANIZATION_BLOCK',
  'DATA_BLOCK','END_DATA_BLOCK','TYPE','END_TYPE','STRUCT','END_STRUCT','ARRAY','BEGIN','PROGRAM','END_PROGRAM'
]);
const TYPED_LIT = new Set(ELEM_NAMES.concat(['LINT','ULINT','LWORD']));

function tokenize(src){
  const toks = [], comments = [];
  let i = 0, line = 1, lineStart = 0;
  const n = src.length;
  const push = (type, val, start, extra) => { const t = Object.assign({type, val, line, col: start - lineStart + 1, pos: start, end: i}, extra || {}); toks.push(t); return t; };
  const err = (msg, at) => { throw new SCLError('syntax', msg, line, (at === undefined ? i : at) - lineStart + 1); };
  const lineHasOnlySpaceBefore = at => { let k = at - 1; while(k >= 0 && src[k] !== '\n'){ if(!/\s/.test(src[k])) return false; k--; } return true; };
  function readTime(j0, start){
    let j = j0, total = 0, any = false, neg = false;
    if(src[j] === '-'){ neg = true; j++; }
    const re = /^([0-9][0-9_]*(?:\.[0-9]+)?)(ms|d|h|m|s)/i;
    while(j < n){
      const m = re.exec(src.slice(j, j + 24));
      if(!m) break;
      const v = parseFloat(m[1].replace(/_/g, '')), u = m[2].toLowerCase();
      total += u === 'ms' ? v/1000 : u === 's' ? v : u === 'm' ? v*60 : u === 'h' ? v*3600 : v*86400;
      j += m[0].length; any = true;
      if(src[j] === '_') j++;
    }
    if(!any || /[A-Za-z0-9]/.test(src[j] || '')) err('Ungültiges Zeit-Literal. Beispiele: T#3S, T#500MS, T#1M30S.', start);
    return {v: neg ? -total : total, j};
  }
  function readNumber(j0, start){
    let j = j0;
    while(j < n && /[0-9_]/.test(src[j])) j++;
    if(src[j] === '#' && /^(2|8|16)$/.test(src.slice(j0, j))){
      const base = parseInt(src.slice(j0, j), 10);
      let k = j + 1; const ds = k;
      while(k < n && /[0-9A-Fa-f_]/.test(src[k])) k++;
      const digits = src.slice(ds, k).replace(/_/g, '');
      const v = parseInt(digits, base);
      if(!digits || isNaN(v)) err('Ungültiges ' + base + '#-Literal.', start);
      return {v, j:k, nt:'INT', based:true};
    }
    let isReal = false;
    if(src[j] === '.' && /[0-9]/.test(src[j+1] || '')){ isReal = true; j++; while(j < n && /[0-9_]/.test(src[j])) j++; }
    if(/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j+1] || '')){
      let k = j + 1; if(src[k] === '+' || src[k] === '-') k++;
      if(/[0-9]/.test(src[k] || '')){ isReal = true; j = k; while(j < n && /[0-9]/.test(src[j])) j++; }
    }
    const raw = src.slice(j0, j);
    if(/[A-Za-z_]/.test(src[j] || '')) err('Bezeichner dürfen nicht mit einer Ziffer beginnen ("' + raw + src[j] + '…").', start);
    return {v: parseFloat(raw.replace(/_/g, '')), j, nt: isReal ? 'REAL' : 'INT'};
  }
  while(i < n){
    const c = src[i];
    if(c === '\n'){ i++; line++; lineStart = i; continue; }
    if(/\s/.test(c)){ i++; continue; }
    if(c === '/' && src[i+1] === '/'){
      const s = i; while(i < n && src[i] !== '\n') i++;
      comments.push({line, text: src.slice(s + 2, i).trim(), pos: s}); continue;
    }
    if((c === '(' && src[i+1] === '*') || (c === '/' && src[i+1] === '*')){
      const close = c === '(' ? '*)' : '*/', startLine = line, s = i;
      i += 2;
      while(i < n && src.slice(i, i+2) !== close){ if(src[i] === '\n'){ line++; lineStart = i + 1; } i++; }
      if(i >= n) throw new SCLError('syntax', 'Kommentar ab Zeile ' + startLine + ' wird nie geschlossen (fehlt "' + close + '").', startLine, 1);
      i += 2; comments.push({line: startLine, text: src.slice(s + 2, i - 2).trim(), pos: s, block: true}); continue;
    }
    // Attribute { S7_Optimized_Access := 'TRUE' } — werden überlesen
    if(c === '{'){
      const startLine = line;
      while(i < n && src[i] !== '}'){ if(src[i] === '\n'){ line++; lineStart = i + 1; } i++; }
      if(i >= n) throw new SCLError('syntax', 'Attribut-Klammer "{" ab Zeile ' + startLine + ' wird nie geschlossen.', startLine, 1);
      i++; continue;
    }
    const start = i;
    // Zeit-Literale
    const tm = /^(T|TIME)#/i.exec(src.slice(i, i + 5));
    if(tm && /[-0-9]/.test(src[i + tm[0].length] || '') && !(i > 0 && /[A-Za-z0-9_]/.test(src[i-1]))){
      const r = readTime(i + tm[0].length, start);
      i = r.j; push('NUMBER', r.v, start, {ntype:'TIME', raw: src.slice(start, i)}); continue;
    }
    if(/[0-9]/.test(c)){
      const r = readNumber(i, start);
      i = r.j; push('NUMBER', r.v, start, {ntype: r.nt, raw: src.slice(start, i)}); continue;
    }
    // Strings 'Text' mit $-Escapes
    if(c === "'"){
      let j = i + 1, s = '';
      while(j < n && src[j] !== "'"){
        if(src[j] === '\n') err('Der Text wird in dieser Zeile nicht mit \' geschlossen.', start);
        if(src[j] === '$'){
          const e = (src[j+1] || '').toUpperCase();
          s += e === "'" ? "'" : e === '$' ? '$' : (e === 'N' || e === 'L') ? '\n' : e === 'T' ? '\t' : e === 'R' ? '\r' : e === 'P' ? '\f' : '';
          j += 2; continue;
        }
        s += src[j]; j++;
      }
      if(src[j] !== "'") err('Der Text wird nicht mit \' geschlossen.', start);
      i = j + 1; push('STRING', s, start, {raw: src.slice(start, i)}); continue;
    }
    if(c === '"'){
      let j = i + 1;
      while(j < n && src[j] !== '"' && src[j] !== '\n') j++;
      if(src[j] !== '"') err('Anführungszeichen wird nicht geschlossen.', start);
      const name = src.slice(i + 1, j);
      if(!name.trim()) err('Leerer Name in Anführungszeichen.', start);
      i = j + 1; push('IDENT', name, start, {quoted:true, raw: src.slice(start, i)}); continue;
    }
    if(c === '#' && /[A-Za-z_]/.test(src[i+1] || '')){
      let j = i + 1; while(j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i + 1, j);
      i = j; push('IDENT', word, start, {hash:true, raw: src.slice(start, i)}); continue;
    }
    // Bitzugriff .%X3 und Adressen %I0.0
    if(c === '%'){
      let j = i + 1; while(j < n && /[A-Za-z]/.test(src[j])) j++;
      const letters = src.slice(i + 1, j).toUpperCase(); const ns = j;
      while(j < n && /[0-9.]/.test(src[j])) j++;
      const prev = toks[toks.length - 1];
      if(prev && prev.type === 'OP' && prev.val === '.' && letters === 'X' && /^[0-9]+$/.test(src.slice(ns, j))){
        i = j; push('BITSEL', parseInt(src.slice(ns, j), 10), start, {raw: src.slice(start, i)}); continue;
      }
      if(!letters || j === ns) err('Ungültige Adresse. Beispiele: %I0.0, %Q0.1, Bitzugriff: Status.%X3.', start);
      i = j; push('IDENT', (letters + src.slice(ns, j)).replace(/\./g, '_'), start, {raw: src.slice(start, i), addr:true}); continue;
    }
    const two = src.slice(i, i + 2);
    if([':=','=>','<=','>=','<>','**','..'].includes(two)){ i += 2; push('OP', two, start); continue; }
    if(two === '==') err('In SCL vergleicht man mit einem einfachen "=" (nicht "==").', start);
    if(two === '!=') err('"Ungleich" schreibt man in SCL als "<>" (nicht "!=").', start);
    if(two === '&&') err('Statt "&&" schreibt man in SCL AND.', start);
    if(two === '||') err('Statt "||" schreibt man in SCL OR.', start);
    if(c === '!') err('Statt "!" schreibt man in SCL NOT.', start);
    if('+-*/<>=()[],;:.&'.includes(c)){ i++; push('OP', c, start); continue; }
    if(/[A-Za-z_]/.test(c)){
      let j = i; while(j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j), up = word.toUpperCase();
      // TITLE = … bis Zeilenende (Bausteinkopf)
      if(up === 'TITLE' && /^\s*=/.test(src.slice(j, j + 8)) && lineHasOnlySpaceBefore(i)){ while(i < n && src[i] !== '\n') i++; continue; }
      // REGION Name … / END_REGION (Gliederung, wird überlesen)
      if((up === 'REGION' || up === 'END_REGION') && lineHasOnlySpaceBefore(i)){ while(i < n && src[i] !== '\n') i++; continue; }
      // Typisierte Literale INT#5, DINT#-3, WORD#16#FF, REAL#1.5, BOOL#TRUE
      if(src[j] === '#' && TYPED_LIT.has(up)){
        let k = j + 1, neg = false;
        if(src[k] === '-'){ neg = true; k++; }
        if(up === 'BOOL'){
          const m = /^(TRUE|FALSE|0|1)/i.exec(src.slice(k, k + 5));
          if(!m) err('BOOL#… erwartet TRUE oder FALSE.', start);
          i = k + m[0].length; push('KW', /^(TRUE|1)$/i.test(m[0]) ? 'TRUE' : 'FALSE', start, {raw: src.slice(start, i)}); continue;
        }
        if(!/[0-9]/.test(src[k] || '')) err('Nach ' + up + '# wird eine Zahl erwartet.', start);
        const r = readNumber(k, start);
        i = r.j; push('NUMBER', neg ? -r.v : r.v, start, {ntype: up, raw: src.slice(start, i), typed:true}); continue;
      }
      i = j;
      if(KW.has(up)) push('KW', up, start, {raw: word});
      else push('IDENT', word, start);
      continue;
    }
    err('Unerwartetes Zeichen "' + c + '".', start);
  }
  toks.push({type:'EOF', val:null, line, col: i - lineStart + 1, pos: n, end: n});
  return {toks, comments};
}

/* ============================================================
   3. PARSER — Bausteine, Deklarationen, Anweisungen
   ============================================================ */
const UNIT_KW = {FUNCTION:'FC', FUNCTION_BLOCK:'FB', ORGANIZATION_BLOCK:'OB', DATA_BLOCK:'DB', TYPE:'UDT'};
const UNIT_END = {FC:'END_FUNCTION', FB:'END_FUNCTION_BLOCK', OB:'END_ORGANIZATION_BLOCK', DB:'END_DATA_BLOCK', UDT:'END_TYPE'};
const UNIT_WORD = {FC:'FUNCTION', FB:'FUNCTION_BLOCK', OB:'ORGANIZATION_BLOCK', DB:'DATA_BLOCK', UDT:'TYPE'};
const SEC_OF = {VAR_INPUT:'Input', VAR_OUTPUT:'Output', VAR_IN_OUT:'InOut', VAR_TEMP:'Temp', VAR:'Static'};
const SEC_KW = {Input:'VAR_INPUT', Output:'VAR_OUTPUT', InOut:'VAR_IN_OUT', Temp:'VAR_TEMP', Static:'VAR', Constant:'VAR CONSTANT'};
const SEC_NAMES = ['Input','Output','InOut','Static','Temp','Constant'];

function makeParser(src){
  const {toks: TK, comments} = tokenize(src);
  let p = 0;
  const peek = o => TK[Math.min(p + (o||0), TK.length - 1)];
  const isKW = (v, o) => { const t = peek(o); return t.type === 'KW' && t.val === v; };
  const isOP = (v, o) => { const t = peek(o); return t.type === 'OP' && t.val === v; };
  const describe = t => t.type === 'EOF' ? 'Quelltextende' : '"' + (t.raw || t.val) + '"';
  const fail = (msg, t) => { t = t || peek(); throw new SCLError('syntax', msg, t.line, t.col); };

  function expectOP(v, ctx){
    if(isOP(v)) return TK[p++];
    const t = peek();
    if(v === ';'){
      const prev = TK[p-1];
      if(prev && t.line > prev.line) fail('Am Ende von Zeile ' + prev.line + ' fehlt ein Semikolon ";".', {line: prev.line, col: prev.col + String(prev.raw || prev.val).length});
      fail('Erwartet ";" ' + (ctx || '') + ' — gefunden ' + describe(t) + '.', t);
    }
    if(v === ':=' && isOP('=')) fail('Zuweisungen schreibt man in SCL mit ":=" (ein "=" ist ein Vergleich).', t);
    fail('Erwartet "' + v + '" ' + (ctx || '') + ' — gefunden ' + describe(t) + '.', t);
  }
  function expectKW(v, ctx){
    if(isKW(v)) return TK[p++];
    fail('Erwartet ' + v + (ctx ? ' (' + ctx + ')' : '') + ' — gefunden ' + describe(peek()) + '.');
  }
  function identNode(t){ return {k:'var', name: t.val, hash: !!t.hash, quoted: !!t.quoted, tok: t, line: t.line, col: t.col}; }

  /* ---------- Ausdrücke ---------- */
  const BIN_PREC = {'OR':1, 'XOR':2, 'AND':3, '&':3, '=':4, '<>':4, '<':5, '>':5, '<=':5, '>=':5, '+':6, '-':6, '*':7, '/':7, 'MOD':7, '**':9};
  function binOpAt(){
    const t = peek();
    if(t.type === 'KW' && ['OR','XOR','AND','MOD'].includes(t.val)) return t.val;
    if(t.type === 'OP' && own(BIN_PREC, t.val)) return t.val;
    return null;
  }
  function parseExpr(minPrec){
    minPrec = minPrec || 1;
    let left = parseUnary();
    for(;;){
      const op = binOpAt();
      if(!op) break;
      const prec = BIN_PREC[op];
      if(prec < minPrec) break;
      const opTok = TK[p++];
      const right = op === '**' ? parseExpr(prec) : parseExpr(prec + 1);
      left = {k:'bin', op: op === '&' ? 'AND' : op, l: left, r: right, line: opTok.line, col: opTok.col};
    }
    return left;
  }
  function parseUnary(){
    const t = peek();
    if(t.type === 'KW' && t.val === 'NOT'){ p++; return {k:'un', op:'NOT', e: parseExpr(8), line: t.line, col: t.col}; }
    if(t.type === 'OP' && (t.val === '-' || t.val === '+')){
      p++;
      const e = parseExpr(8);
      if(t.val === '+') return e;
      if(e.k === 'num'){ e.v = -e.v; return e; }
      return {k:'un', op:'NEG', e, line: t.line, col: t.col};
    }
    return parsePostfix(parsePrimary());
  }
  function parseArgs(){
    // nach "(": benannte (a := x, q => y) oder positionsweise Parameter
    const args = [];
    if(isOP(')')){ p++; return args; }
    for(;;){
      const t = peek();
      if(t.type === 'IDENT' && !t.quoted && (isOP(':=', 1) || isOP('=>', 1))){
        p++;
        const dir = TK[p++].val === ':=' ? 'in' : 'out';
        if(dir === 'in') args.push({name: t.val, dir, expr: parseExpr(1), line: t.line, col: t.col, tok: t});
        else {
          const vt = peek();
          if(vt.type !== 'IDENT') fail('Nach "=>" wird eine Variable erwartet, in die der Ausgang geschrieben wird.', vt);
          p++;
          args.push({name: t.val, dir, target: parsePostfix(identNode(vt)), line: t.line, col: t.col, tok: t});
        }
      } else if(t.type === 'IDENT' && isOP('=', 1) && !t.quoted){
        fail('Parameter werden mit ":=" (Eingang) bzw. "=>" (Ausgang) versorgt — nicht mit "=".', peek(1));
      } else {
        args.push({name: null, dir:'in', expr: parseExpr(1), line: t.line, col: t.col});
      }
      if(isOP(',')){ p++; continue; }
      break;
    }
    expectOP(')', 'zum Schliessen des Aufrufs');
    return args;
  }
  function parsePrimary(){
    const t = peek();
    if(t.type === 'NUMBER'){ p++; return {k:'num', v: t.val, nt: t.ntype, typed: !!t.typed, line: t.line, col: t.col}; }
    if(t.type === 'STRING'){ p++; return {k:'str', v: t.val, line: t.line, col: t.col}; }
    if(t.type === 'KW' && (t.val === 'TRUE' || t.val === 'FALSE')){ p++; return {k:'bool', v: t.val === 'TRUE', line: t.line, col: t.col}; }
    if(t.type === 'OP' && t.val === '('){ p++; const e = parseExpr(1); expectOP(')', 'zum Schliessen der Klammer'); return e; }
    if(t.type === 'IDENT'){
      p++;
      if(isOP('(')){ p++; return {k:'call', callee: identNode(t), args: parseArgs(), line: t.line, col: t.col}; }
      return identNode(t);
    }
    if(t.type === 'EOF') fail('Der Ausdruck ist unvollständig — der Quelltext endet mitten in einer Anweisung.', t);
    if(t.type === 'OP' && t.val === ';') fail('Hier fehlt ein Wert oder Ausdruck vor ";".', t);
    if(t.type === 'KW') fail('Hier wird ein Wert erwartet, gefunden wurde das Schlüsselwort ' + t.val + '.', t);
    fail('Unerwartetes Zeichen ' + describe(t) + ' in einem Ausdruck.', t);
  }
  function parsePostfix(e){
    for(;;){
      if(isOP('[')){
        const t = TK[p++];
        const idx = [parseExpr(1)];
        while(isOP(',')){ p++; idx.push(parseExpr(1)); }
        expectOP(']', 'nach dem Array-Index');
        e = {k:'idx', base: e, index: idx, line: t.line, col: t.col};
        continue;
      }
      if(isOP('.')){
        const t = TK[p++];
        const m = peek();
        if(m.type === 'BITSEL'){ p++; e = {k:'bit', base: e, n: m.val, line: t.line, col: t.col}; continue; }
        if(m.type !== 'IDENT') fail('Nach "." wird der Name eines Elements erwartet (z.B. .Q oder .Gewicht).', m);
        p++;
        e = {k:'mem', base: e, member: m.val, line: m.line, col: m.col, tok: m};
        continue;
      }
      return e;
    }
  }

  /* ---------- Anweisungen ---------- */
  const stopAt = (...kws) => t => t.type === 'KW' && kws.includes(t.val);
  const UNIT_ENDS = ['END_FUNCTION','END_FUNCTION_BLOCK','END_ORGANIZATION_BLOCK','END_DATA_BLOCK','END_TYPE'];
  function parseBlock(stopFn){
    const out = [];
    for(;;){
      const t = peek();
      if(t.type === 'EOF' || stopFn(t) || (t.type === 'KW' && UNIT_ENDS.includes(t.val))) break;
      out.push(parseStatement());
    }
    return out;
  }
  function parseStatement(){
    const t = peek();
    if(t.type === 'OP' && t.val === ';'){ p++; return {k:'nop', line: t.line}; }
    if(t.type === 'KW'){
      switch(t.val){
        case 'IF': return parseIf();
        case 'CASE': return parseCase();
        case 'FOR': return parseFor();
        case 'WHILE': return parseWhile();
        case 'REPEAT': return parseRepeat();
        case 'EXIT': p++; expectOP(';', 'nach EXIT'); return {k:'exit', line: t.line, col: t.col};
        case 'CONTINUE': p++; expectOP(';', 'nach CONTINUE'); return {k:'continue', line: t.line, col: t.col};
        case 'RETURN': p++; expectOP(';', 'nach RETURN'); return {k:'return', line: t.line, col: t.col};
        case 'ELSIF': case 'ELSE': fail(t.val + ' ohne passendes IF (oder das IF davor wurde bereits mit END_IF geschlossen).', t);
        case 'END_IF': case 'END_CASE': case 'END_FOR': case 'END_WHILE': case 'END_REPEAT': case 'UNTIL':
          fail(t.val + ' ohne zugehörigen Anfang — prüfe, ob du einen Block doppelt geschlossen hast.', t);
        case 'VAR': case 'VAR_INPUT': case 'VAR_OUTPUT': case 'VAR_IN_OUT': case 'VAR_TEMP':
          fail('Deklarationen (' + t.val + ' … END_VAR) gehören vor BEGIN, nicht zwischen die Anweisungen.', t);
        case 'BEGIN': fail('BEGIN steht hier doppelt — ein Baustein hat genau ein BEGIN.', t);
      }
      if(/^END_/.test(t.val)) fail(t.val + ' passt hier nicht — ist ein Block (IF, FOR, …) noch offen?', t);
      fail('Eine Anweisung darf nicht mit ' + t.val + ' beginnen.', t);
    }
    if(t.type === 'IDENT'){
      p++;
      if(isOP('(')){
        p++;
        const call = {k:'call', callee: identNode(t), args: parseArgs(), line: t.line, col: t.col};
        expectOP(';', 'nach dem Aufruf');
        return {k:'callstmt', call, line: t.line, col: t.col};
      }
      const target = parsePostfix(identNode(t));
      if(isOP(':=')){
        const opTok = TK[p++];
        if(isOP(';')) fail('Nach ":=" fehlt der Wert, der zugewiesen werden soll.', peek());
        const expr = parseExpr(1);
        expectOP(';', 'am Ende der Zuweisung');
        return {k:'assign', target, expr, line: t.line, col: t.col, opLine: opTok.line};
      }
      if(isOP('(')) fail('Nur Bausteine und Instanzen können mit ( ) aufgerufen werden.', peek());
      if(isOP('=')) fail('Zuweisungen schreibt man in SCL mit ":=" — ein einfaches "=" ist ein Vergleich.', peek());
      if(isOP(':')) fail('Erwartet ":=" (Doppelpunkt UND Gleichheitszeichen). Deklarationen wie "x : INT;" gehören in einen VAR-Bereich vor BEGIN.', peek());
      if(peek().type === 'IDENT' && peek().line > t.line) fail('Am Ende von Zeile ' + t.line + ' fehlt vermutlich ":= …;" oder ein ";".', t);
      fail('Nach "' + (t.raw || t.val) + '" wird ":=" (Zuweisung) oder "(" (Aufruf) erwartet — gefunden ' + describe(peek()) + '.', peek());
    }
    if(t.type === 'NUMBER') fail('Eine Anweisung kann nicht mit einer Zahl beginnen.', t);
    if(t.type === 'STRING') fail('Eine Anweisung kann nicht mit einem Text beginnen.', t);
    fail('Unerwartetes Zeichen ' + describe(t) + '.', t);
  }
  function parseCondUntil(kw, openTok, what){
    const startTok = peek();
    const e = parseExpr(1);
    if(!isKW(kw)){
      const t = peek();
      if(t.type === 'OP' && t.val === ':=') fail('In der ' + what + '-Bedingung steht ":=". Vergleiche schreibt man mit "=".', t);
      if(t.line > startTok.line || t.type === 'EOF') fail('Nach der ' + what + '-Bedingung fehlt ' + kw + '.', openTok);
      fail('Erwartet ' + kw + ' nach der ' + what + '-Bedingung — gefunden ' + describe(t) + '.', t);
    }
    p++;
    return e;
  }
  function parseIf(){
    const ifTok = TK[p++];
    if(isKW('THEN')) fail('Nach IF fehlt die Bedingung.', peek());
    const branches = [{cond: parseCondUntil('THEN', ifTok, 'IF'), body: parseBlock(stopAt('ELSIF','ELSE','END_IF'))}];
    let elseBody = null;
    for(;;){
      if(isKW('ELSIF')){ const et = TK[p++]; branches.push({cond: parseCondUntil('THEN', et, 'ELSIF'), body: parseBlock(stopAt('ELSIF','ELSE','END_IF'))}); continue; }
      if(isKW('ELSE')){
        p++;
        elseBody = parseBlock(stopAt('END_IF','ELSIF','ELSE'));
        if(isKW('ELSIF') || isKW('ELSE')) fail('Nach dem ELSE-Zweig darf kein weiteres ' + peek().val + ' folgen — ELSE muss der letzte Zweig sein.', peek());
      }
      break;
    }
    if(!isKW('END_IF')){
      const t = peek();
      if(t.type === 'EOF' || (t.type === 'KW' && /^END_(FUNCTION|FUNCTION_BLOCK|ORGANIZATION_BLOCK)$/.test(t.val)))
        fail('IF aus Zeile ' + ifTok.line + ' wird nie mit END_IF abgeschlossen.' + (elseBody && elseBody.length && elseBody[0].k === 'if' ? ' Tipp: Schreibe ELSIF zusammen — "ELSE IF" öffnet ein neues IF, das ein eigenes END_IF braucht.' : ''), ifTok);
      fail('Erwartet END_IF (für das IF aus Zeile ' + ifTok.line + ') — gefunden ' + describe(t) + '.', t);
    }
    p++; expectOP(';', 'nach END_IF');
    return {k:'if', branches, elseBody, line: ifTok.line, col: ifTok.col};
  }
  function atCaseLabel(){
    const t = peek();
    return t.type === 'NUMBER' || (t.type === 'OP' && t.val === '-' && peek(1).type === 'NUMBER') || (t.type === 'IDENT' && (isOP(':', 1) || isOP(',', 1) || isOP('..', 1)) && !isOP(':=', 1));
  }
  function readLabel(){
    let neg = false;
    if(isOP('-')){ p++; neg = true; }
    const t = peek();
    if(t.type === 'IDENT'){ p++; return {c: identNode(t), neg}; }
    if(t.type !== 'NUMBER' || t.ntype === 'REAL' || t.ntype === 'TIME') fail('Fallwerte in CASE müssen ganze Zahlen (oder Konstanten) sein.', t);
    p++;
    return {v: neg ? -t.val : t.val};
  }
  function parseCase(){
    const caseTok = TK[p++];
    const sel = parseExpr(1);
    expectKW('OF', 'nach dem CASE-Ausdruck');
    const branches = [];
    while(atCaseLabel()){
      const labels = [], labTok = peek();
      for(;;){
        const lo = readLabel(); let hi = lo;
        if(isOP('..')){ p++; hi = readLabel(); }
        labels.push({lo, hi});
        if(isOP(',')){ p++; continue; }
        break;
      }
      if(!isOP(':')){
        if(isOP(':=')) fail('Nach einem CASE-Fallwert steht ein einfacher Doppelpunkt ":" (z.B. 1: Lampe := TRUE;).', peek());
        fail('Nach dem Fallwert wird ":" erwartet.', peek());
      }
      p++;
      const body = parseBlock(t => (t.type === 'KW' && (t.val === 'ELSE' || t.val === 'END_CASE')) || atCaseLabel());
      branches.push({labels, body, line: labTok.line, col: labTok.col});
    }
    let elseBody = null;
    if(isKW('ELSE')){ p++; elseBody = parseBlock(stopAt('END_CASE')); }
    if(!isKW('END_CASE')){
      const t = peek();
      if(t.type === 'EOF') fail('CASE aus Zeile ' + caseTok.line + ' wird nie mit END_CASE abgeschlossen.', caseTok);
      fail('Erwartet END_CASE oder einen weiteren Fallwert (z.B. "3:") — gefunden ' + describe(t) + '.', t);
    }
    p++; expectOP(';', 'nach END_CASE');
    return {k:'case', sel, branches, elseBody, line: caseTok.line, col: caseTok.col};
  }
  function parseFor(){
    const forTok = TK[p++];
    const vt = peek();
    if(vt.type !== 'IDENT') fail('Nach FOR wird die Zählvariable erwartet (z.B. FOR #i := 0 TO 9 DO).', vt);
    p++;
    if(!isOP(':=')) fail('Die Zählvariable wird mit ":=" initialisiert (FOR #i := 0 TO 9 DO).', peek());
    p++;
    const from = parseExpr(1);
    expectKW('TO', 'FOR i := Start TO Ende DO');
    const to = parseExpr(1);
    let by = null;
    if(isKW('BY')){ p++; by = parseExpr(1); }
    expectKW('DO', 'FOR … TO … DO');
    const body = parseBlock(stopAt('END_FOR'));
    if(!isKW('END_FOR')) fail('FOR aus Zeile ' + forTok.line + ' wird nie mit END_FOR abgeschlossen.', peek().type === 'EOF' ? forTok : peek());
    p++; expectOP(';', 'nach END_FOR');
    return {k:'for', v: identNode(vt), from, to, by, body, line: forTok.line, col: forTok.col};
  }
  function parseWhile(){
    const wt = TK[p++];
    const cond = parseCondUntil('DO', wt, 'WHILE');
    const body = parseBlock(stopAt('END_WHILE'));
    if(!isKW('END_WHILE')) fail('WHILE aus Zeile ' + wt.line + ' wird nie mit END_WHILE abgeschlossen.', peek().type === 'EOF' ? wt : peek());
    p++; expectOP(';', 'nach END_WHILE');
    return {k:'while', cond, body, line: wt.line, col: wt.col};
  }
  function parseRepeat(){
    const rt = TK[p++];
    const body = parseBlock(stopAt('UNTIL','END_REPEAT'));
    if(!isKW('UNTIL')) fail('REPEAT aus Zeile ' + rt.line + ' braucht UNTIL <Bedingung> vor END_REPEAT.', peek().type === 'EOF' ? rt : peek());
    p++;
    const cond = parseExpr(1);
    if(isOP(';')) p++;
    if(!isKW('END_REPEAT')) fail('Nach UNTIL <Bedingung> fehlt END_REPEAT.', peek());
    p++; expectOP(';', 'nach END_REPEAT');
    return {k:'repeat', body, cond, line: rt.line, col: rt.col};
  }

  /* ---------- Deklarationen ---------- */
  function commentFor(line, afterPos){
    const c = comments.find(c => c.line === line && c.pos >= afterPos && !c.block);
    return c ? c.text : '';
  }
  function parseType(){
    const t = peek();
    if(isKW('ARRAY')){
      p++;
      expectOP('[', 'nach ARRAY (z.B. ARRAY[1..10] OF INT)');
      const dims = [];
      for(;;){
        if(isOP('*')) fail('ARRAY[*] (variable Grenzen) wird hier nicht unterstützt — gib feste Grenzen an, z.B. ARRAY[1..10].', peek());
        const lo = parseExpr(1);
        if(!isOP('..')) fail('Array-Grenzen schreibt man als Untergrenze..Obergrenze, z.B. ARRAY[1..10] OF INT.', peek());
        p++;
        const hi = parseExpr(1);
        dims.push({lo, hi});
        if(isOP(',')){ p++; continue; }
        break;
      }
      expectOP(']', 'nach den Array-Grenzen');
      expectKW('OF', 'ARRAY[…] OF Typ');
      return {t:'array', dims, of: parseType(), line: t.line, col: t.col};
    }
    if(isKW('STRUCT')){
      p++;
      const members = parseDecls(stopAt('END_STRUCT'), 'Member');
      expectKW('END_STRUCT', 'Ende der Struktur');
      return {t:'struct', members, line: t.line, col: t.col};
    }
    if(t.type === 'IDENT'){
      p++;
      if(!t.quoted && t.val.toUpperCase() === 'STRING' && isOP('[')){
        p++; const len = parseExpr(1); expectOP(']', 'nach der STRING-Länge');
        return {t:'string', len, line: t.line, col: t.col};
      }
      return {t:'name', name: t.val, quoted: !!t.quoted, tok: t, line: t.line, col: t.col};
    }
    fail('Hier wird ein Datentyp erwartet (z.B. BOOL, INT, REAL, ARRAY[1..5] OF INT, STRUCT … END_STRUCT oder "UDT_Name") — gefunden ' + describe(t) + '.', t);
  }
  function parseInit(){
    if(isOP('[')){
      const t = TK[p++];
      const items = [];
      if(!isOP(']')) for(;;){
        if(peek().type === 'NUMBER' && peek().ntype === 'INT' && isOP('(', 1)){
          const cnt = TK[p].val; p += 2;
          const e = parseExpr(1); expectOP(')', 'nach dem Wiederholungswert');
          items.push({rep: cnt, e});
        } else items.push({rep: 1, e: parseExpr(1)});
        if(isOP(',')){ p++; continue; }
        break;
      }
      expectOP(']', 'am Ende der Startwert-Liste');
      return {k:'arrinit', items, line: t.line, col: t.col};
    }
    return parseExpr(1);
  }
  function parseDecls(stopFn, what){
    const decls = [];
    while(!stopFn(peek())){
      const t = peek();
      if(t.type === 'EOF') fail('Der Deklarationsbereich wird nie geschlossen (END_VAR bzw. END_STRUCT fehlt).', t);
      if(t.type !== 'IDENT'){
        if(t.type === 'KW' && /^VAR/.test(t.val)) fail('Vor ' + t.val + ' fehlt END_VAR für den vorherigen Bereich.', t);
        if(t.type === 'KW' && t.val === 'BEGIN') fail('Vor BEGIN fehlt END_VAR.', t);
        fail('Hier wird ein Variablenname erwartet (z.B. Start : BOOL;) — gefunden ' + describe(t) + '.', t);
      }
      const names = [];
      for(;;){
        const nt = peek();
        if(nt.type !== 'IDENT') fail('Hier wird ein Variablenname erwartet.', nt);
        if(nt.quoted) fail('In der Deklaration steht der Name ohne Anführungszeichen: ' + nt.val + ' : …;', nt);
        if(nt.hash) fail('In der Deklaration steht der Name ohne #: ' + nt.val + ' : …; (das # schreibt man nur im Code).', nt);
        names.push(TK[p++]);
        if(isOP(',')){ p++; continue; }
        break;
      }
      if(!isOP(':')){
        if(isOP(':=')) fail('Erst kommt der Datentyp, dann der Startwert: ' + names[0].val + ' : INT := 5;', peek());
        fail('Nach dem Namen "' + names[names.length-1].val + '" fehlt ":" und der Datentyp (z.B. ' + names[names.length-1].val + ' : BOOL;).', peek());
      }
      p++;
      const t0 = peek().pos;
      const type = parseType();
      const typeSrc = src.slice(t0, TK[p-1].end);
      let init, initSrc = '';
      if(isOP(':=')){ p++; const i0 = peek().pos; init = parseInit(); initSrc = src.slice(i0, TK[p-1].end); }
      const semi = peek();
      expectOP(';', 'am Ende der Deklaration');
      names.forEach(nt => decls.push({name: nt.val, type, init, typeSrc, initSrc, line: nt.line, col: nt.col, comment: commentFor(nt.line, semi.pos), tok: nt}));
    }
    return decls;
  }
  function skipHeader(){
    for(;;){
      const t = peek();
      if(t.type === 'IDENT' && !t.quoted && /^(VERSION|AUTHOR|FAMILY|NAME)$/i.test(t.val) && isOP(':', 1)){
        const ln = t.line; while(peek().type !== 'EOF' && peek().line === ln) p++; continue;
      }
      if(t.type === 'KW' && ['RETAIN','NON_RETAIN','DB_SPECIFIC'].includes(t.val)){ p++; continue; }
      break;
    }
  }
  function parseSections(kind){
    const sections = [];
    for(;;){
      const t = peek();
      if(!(t.type === 'KW' && own(SEC_OF, t.val))) break;
      p++;
      let sec = SEC_OF[t.val], retain = null;
      for(;;){
        if(isKW('CONSTANT')){ p++; if(sec !== 'Static') fail('CONSTANT gibt es nur als "VAR CONSTANT".', TK[p-1]); sec = 'Constant'; continue; }
        if(isKW('RETAIN')){ p++; retain = true; continue; }
        if(isKW('NON_RETAIN') || isKW('DB_SPECIFIC')){ p++; continue; }
        break;
      }
      const vars = parseDecls(stopAt('END_VAR'), 'Variable');
      expectKW('END_VAR', 'Ende des Bereichs ' + t.val);
      if(isOP(';')) p++;
      sections.push({sec, retain, vars, line: t.line, col: t.col, kw: t.val, pos: t.pos, end: TK[p-1].end});
    }
    return sections;
  }
  function parseUnit(){
    const t = TK[p++];
    const kind = UNIT_KW[t.val];
    const nt = peek();
    if(nt.type !== 'IDENT') fail('Nach ' + t.val + ' wird der Name des Bausteins erwartet, z.B. ' + t.val + ' "' + (kind === 'FC' ? 'FC_Max3' : kind === 'FB' ? 'FB_Motor' : kind === 'OB' ? 'Main' : kind === 'DB' ? 'DB_Zelle' : 'UDT_Teil') + '".', nt);
    p++;
    const u = {kind, name: nt.val, nameTok: nt, line: t.line, col: t.col, startTok: t, sections: [], body: [], headerEnd: nt.end};
    if(kind === 'FC'){
      if(!isOP(':')) fail('Eine FUNCTION braucht einen Rückgabetyp: FUNCTION "' + nt.val + '" : INT (oder : VOID ohne Rückgabewert).', peek());
      p++;
      u.ret = parseType();
      u.headerEnd = TK[p-1].end;
    }
    if(kind === 'UDT'){
      skipHeader();
      if(isOP(':')) p++;
      skipHeader();
      if(!isKW('STRUCT')) fail('Ein Datentyp (TYPE) enthält eine Struktur: TYPE "' + nt.val + '" STRUCT … END_STRUCT; END_TYPE', peek());
      u.struct = parseType();
      if(isOP(';')) p++;
      expectKW('END_TYPE', 'Ende des Datentyps');
      u.endTok = TK[p-1];
      return u;
    }
    skipHeader();
    if(kind === 'DB'){
      if(peek().type === 'IDENT'){ const it = TK[p++]; u.instOf = {name: it.val, tok: it, line: it.line, col: it.col}; }
      else if(isKW('STRUCT')){ const st = parseType(); u.sections.push({sec:'Static', vars: st.members, line: st.line}); if(isOP(';')) p++; }
      else u.sections = parseSections(kind);
      if(isKW('BEGIN')){ p++; u.body = parseBlock(stopAt('END_DATA_BLOCK')); }
      expectKW('END_DATA_BLOCK', 'Ende des Datenbausteins');
      u.endTok = TK[p-1];
      return u;
    }
    u.declPos = peek().pos;
    u.sections = parseSections(kind);
    const endKW = UNIT_END[kind];
    if(!isKW('BEGIN')){
      const t2 = peek();
      if(t2.type === 'KW' && t2.val === endKW){ /* leerer Baustein ohne BEGIN */ }
      else fail('Nach den Deklarationen fehlt BEGIN — danach folgen die Anweisungen des Bausteins.', t2);
    } else { u.beginTok = TK[p]; p++; }
    u.body = parseBlock(stopAt(endKW, 'END_FUNCTION', 'END_FUNCTION_BLOCK', 'END_ORGANIZATION_BLOCK', 'END_DATA_BLOCK', 'END_TYPE'));
    if(!isKW(endKW)){
      const e = peek();
      if(e.type === 'EOF') fail(t.val + ' "' + nt.val + '" wird nie mit ' + endKW + ' abgeschlossen.', t);
      fail('Erwartet ' + endKW + ' — gefunden ' + describe(e) + '.', e);
    }
    p++;
    u.endTok = TK[p-1];
    return u;
  }
  function parseUnits(){
    const units = [];
    while(peek().type !== 'EOF'){
      const t = peek();
      if(t.type === 'KW' && own(UNIT_KW, t.val)){ units.push(parseUnit()); if(isOP(';')) p++; continue; }
      if(t.type === 'KW' && t.val === 'PROGRAM') fail('PROGRAM gibt es in TIA nicht — das Hauptprogramm ist ORGANIZATION_BLOCK "Main".', t);
      if(units.length === 0) fail('Der Quelltext muss mit einem Baustein beginnen: FUNCTION_BLOCK, FUNCTION, ORGANIZATION_BLOCK, DATA_BLOCK oder TYPE.', t);
      fail('Nach dem Ende des Bausteins "' + units[units.length-1].name + '" folgt noch ' + describe(t) + '. Steht hier etwas nach ' + UNIT_END[units[units.length-1].kind] + '?', t);
    }
    return units;
  }
  function parseBodyOnly(){ return parseBlock(() => false); }
  return {parseUnits, parseBodyOnly, parseExpr: () => { const e = parseExpr(1); if(peek().type !== 'EOF') fail('Unerwartetes ' + describe(peek()) + '.'); return e; }, toks: TK, comments};
}
function parseSource(src){ const P = makeParser(src); return {units: P.parseUnits(), toks: P.toks, comments: P.comments}; }

/* ============================================================
   4. BAUSTEIN-BIBLIOTHEK: Standard-FBs und Funktionen
   ============================================================ */
const BUILTIN_FB = {
  TON:    { inputs:{IN:'BOOL', PT:'TIME'}, outputs:{Q:'BOOL', ET:'TIME'} },
  TOF:    { inputs:{IN:'BOOL', PT:'TIME'}, outputs:{Q:'BOOL', ET:'TIME'} },
  TP:     { inputs:{IN:'BOOL', PT:'TIME'}, outputs:{Q:'BOOL', ET:'TIME'} },
  R_TRIG: { inputs:{CLK:'BOOL'}, outputs:{Q:'BOOL'} },
  F_TRIG: { inputs:{CLK:'BOOL'}, outputs:{Q:'BOOL'} },
  CTU:    { inputs:{CU:'BOOL', R:'BOOL', PV:'INT'}, outputs:{Q:'BOOL', CV:'INT'} },
  CTD:    { inputs:{CD:'BOOL', LD:'BOOL', PV:'INT'}, outputs:{Q:'BOOL', CV:'INT'} },
  CTUD:   { inputs:{CU:'BOOL', CD:'BOOL', R:'BOOL', LD:'BOOL', PV:'INT'}, outputs:{QU:'BOOL', QD:'BOOL', CV:'INT'} }
};
function stepFB(fb, st, ins, t){
  const def = BUILTIN_FB[fb];
  st._in = st._in || {};
  Object.keys(def.inputs).forEach(k => {
    if(ins[k] !== undefined) st._in[k] = ins[k];
    if(st._in[k] === undefined) st._in[k] = def.inputs[k] === 'BOOL' ? false : 0;
    st[k] = st._in[k];
  });
  const I = st._in;
  switch(fb){
    case 'TON':
      if(I.IN){ if(!st._prev) st._start = t; const el = t - st._start; st.Q = el >= I.PT - 1e-9; st.ET = Math.min(el, I.PT); }
      else { st.Q = false; st.ET = 0; }
      st._prev = !!I.IN; break;
    case 'TOF':
      if(I.IN){ st.Q = true; st.ET = 0; st._run = false; }
      else {
        if(st._prev){ st._start = t; st._run = true; }
        if(st._run){ const el = t - st._start; st.ET = Math.min(el, I.PT); st.Q = el < I.PT - 1e-9; if(!st.Q) st._run = false; }
        else st.Q = false;
      }
      st._prev = !!I.IN; break;
    case 'TP':
      if(I.IN && !st._prev && !st._run){ st._run = true; st._start = t; }
      if(st._run){ const el = t - st._start; if(el >= I.PT - 1e-9){ st._run = false; st.ET = I.PT; } else st.ET = el; }
      if(!st._run && !I.IN) st.ET = 0;
      st.Q = !!st._run; st._prev = !!I.IN; break;
    case 'R_TRIG': st.Q = !!I.CLK && !st._prev; st._prev = !!I.CLK; break;
    case 'F_TRIG': st.Q = !I.CLK && !!st._prev; st._prev = !!I.CLK; break;
    case 'CTU':
      if(I.R) st.CV = 0; else if(I.CU && !st._prev && st.CV < 32767) st.CV++;
      st.Q = st.CV >= I.PV; st._prev = !!I.CU; break;
    case 'CTD':
      if(I.LD) st.CV = I.PV; else if(I.CD && !st._prev && st.CV > -32768) st.CV--;
      st.Q = st.CV <= 0; st._prev = !!I.CD; break;
    case 'CTUD':
      if(I.R) st.CV = 0; else if(I.LD) st.CV = I.PV;
      else { if(I.CU && !st._prevU) st.CV++; if(I.CD && !st._prevD) st.CV--; }
      st.QU = st.CV >= I.PV; st.QD = st.CV <= 0; st._prevU = !!I.CU; st._prevD = !!I.CD; break;
  }
}
function builtinFbType(name){ return {k:'fb', name, builtin:true}; }
function fbParamType(fb, k){ const def = BUILTIN_FB[fb]; const s = def.inputs[k] || def.outputs[k]; return T[s]; }

// Standardfunktionen: Parameterliste + Typprüfung + Ausführung
function commonType(ts, what, node, fail){
  if(ts.every(t => t.k === 'time')) return T.TIME;
  if(ts.every(t => t.k === 'string')) return mkString(Math.max(...ts.map(t => t.len)));
  if(!ts.every(isNum)) fail(what + '() braucht Zahlen (oder überall TIME), bekommt aber ' + ts.map(typeNice).join(', ') + '.', node);
  if(ts.some(t => t.k === 'real')) return ts.some(t => t.n === 'LREAL') ? T.LREAL : T.REAL;
  const nonLit = ts.filter(t => !t.lit && !t.gen);
  if(!nonLit.length) return Object.assign({}, T.DINT, {gen:true});
  return nonLit.reduce((a, b) => widerInt(a, b));
}
function widerInt(a, b){
  if(a.n === b.n) return a;
  if(a.min <= b.min && a.max >= b.max) return a;
  if(b.min <= a.min && b.max >= a.max) return b;
  return T.DINT;
}
const realOf = t => (t.n === 'LREAL') ? T.LREAL : T.REAL;
const FN = {
  ABS:   {p:['IN'], chk:(ts, f, n) => { if(!isNum(ts[0]) && ts[0].k !== 'time') f('ABS() braucht eine Zahl.', n); return ts[0].lit ? Object.assign({}, T.DINT, {gen:true}) : ts[0]; }, run: a => Math.abs(a[0])},
  SQRT:  {p:['IN'], num:true, run: a => { if(a[0] < 0) throw new SCLError('runtime', 'SQRT einer negativen Zahl ist nicht definiert.'); return Math.sqrt(a[0]); }},
  SQR:   {p:['IN'], chk:(ts, f, n) => { if(!isNum(ts[0])) f('SQR() braucht eine Zahl.', n); return ts[0].k === 'real' ? ts[0] : realOf(ts[0]); }, run: a => a[0]*a[0]},
  EXP:   {p:['IN'], num:true, run: a => Math.exp(a[0])},
  LN:    {p:['IN'], num:true, run: a => { if(a[0] <= 0) throw new SCLError('runtime', 'LN ist nur für Werte > 0 definiert.'); return Math.log(a[0]); }},
  SIN:   {p:['IN'], num:true, run: a => Math.sin(a[0])},
  COS:   {p:['IN'], num:true, run: a => Math.cos(a[0])},
  TAN:   {p:['IN'], num:true, run: a => Math.tan(a[0])},
  MIN:   {p:['IN'], vari:true, chk:(ts, f, n) => commonType(ts, 'MIN', n, f), run: a => a.reduce((x, y) => y < x ? y : x)},
  MAX:   {p:['IN'], vari:true, chk:(ts, f, n) => commonType(ts, 'MAX', n, f), run: a => a.reduce((x, y) => y > x ? y : x)},
  LIMIT: {p:['MN','IN','MX'], chk:(ts, f, n) => commonType(ts, 'LIMIT', n, f), run: a => Math.max(a[0], Math.min(a[2], a[1]))},
  SEL:   {p:['G','IN0','IN1'], chk:(ts, f, n) => { if(ts[0].k !== 'bool') f('SEL(): G muss BOOL sein.', n); if(assignMsg(ts[1], ts[2]) && assignMsg(ts[2], ts[1])) f('SEL(): IN0 und IN1 müssen den gleichen Typ haben.', n); return (ts[1].lit || ts[1].gen) ? ts[2] : ts[1]; }, run: a => a[0] ? a[2] : a[1]},
  ROUND: {p:['IN'], toInt:true, run: a => roundHalfEven(a[0])},
  TRUNC: {p:['IN'], toInt:true, run: a => Math.trunc(a[0])},
  CEIL:  {p:['IN'], toInt:true, run: a => Math.ceil(a[0] - 1e-12)},
  FLOOR: {p:['IN'], toInt:true, run: a => Math.floor(a[0] + 1e-12)},
  LEN:   {p:['IN'], chk:(ts, f, n) => { if(ts[0].k !== 'string') f('LEN() braucht einen Text (STRING).', n); return T.INT; }, run: a => a[0].length},
  CONCAT:{p:['IN'], vari:true, chk:(ts, f, n) => { ts.forEach(t => { if(t.k !== 'string') f('CONCAT() verbindet nur Texte. Zahlen wandelst du vorher um, z.B. INT_TO_STRING(…).', n); }); return mkString(Math.min(254, ts.reduce((s, t) => s + t.len, 0))); }, run: a => a.join('')},
  LEFT:  {p:['IN','L'], chk:(ts, f, n) => { strArg(ts[0], 'LEFT', f, n); intArg(ts[1], 'LEFT', 'L', f, n); return mkString(ts[0].len); }, run: a => a[1] <= 0 ? '' : a[0].slice(0, a[1])},
  RIGHT: {p:['IN','L'], chk:(ts, f, n) => { strArg(ts[0], 'RIGHT', f, n); intArg(ts[1], 'RIGHT', 'L', f, n); return mkString(ts[0].len); }, run: a => a[1] <= 0 ? '' : a[0].slice(Math.max(0, a[0].length - a[1]))},
  MID:   {p:['IN','L','P'], chk:(ts, f, n) => { strArg(ts[0], 'MID', f, n); intArg(ts[1], 'MID', 'L', f, n); intArg(ts[2], 'MID', 'P', f, n); return mkString(ts[0].len); }, run: a => (a[1] <= 0 || a[2] < 1 || a[2] > a[0].length) ? '' : a[0].substr(a[2] - 1, a[1])},
  FIND:  {p:['IN1','IN2'], chk:(ts, f, n) => { strArg(ts[0], 'FIND', f, n); strArg(ts[1], 'FIND', f, n); return T.INT; }, run: a => a[0].indexOf(a[1]) + 1},
  DELETE:{p:['IN','L','P'], chk:(ts, f, n) => { strArg(ts[0], 'DELETE', f, n); intArg(ts[1], 'DELETE', 'L', f, n); intArg(ts[2], 'DELETE', 'P', f, n); return mkString(ts[0].len); }, run: a => (a[2] < 1 || a[2] > a[0].length || a[1] <= 0) ? a[0] : a[0].slice(0, a[2] - 1) + a[0].slice(a[2] - 1 + a[1])},
  INSERT:{p:['IN1','IN2','P'], chk:(ts, f, n) => { strArg(ts[0], 'INSERT', f, n); strArg(ts[1], 'INSERT', f, n); intArg(ts[2], 'INSERT', 'P', f, n); return mkString(Math.min(254, ts[0].len + ts[1].len)); }, run: a => { const pp = Math.max(0, Math.min(a[0].length, a[2])); return a[0].slice(0, pp) + a[1] + a[0].slice(pp); }},
  REPLACE:{p:['IN1','IN2','L','P'], chk:(ts, f, n) => { strArg(ts[0], 'REPLACE', f, n); strArg(ts[1], 'REPLACE', f, n); intArg(ts[2], 'REPLACE', 'L', f, n); intArg(ts[3], 'REPLACE', 'P', f, n); return mkString(Math.min(254, ts[0].len + ts[1].len)); }, run: a => (a[3] < 1 || a[3] > a[0].length + 1) ? a[0] : a[0].slice(0, a[3] - 1) + a[1] + a[0].slice(a[3] - 1 + Math.max(0, a[2]))},
  SHL:   {p:['IN','N'], bit:true, run: (a, t) => wrapInt(a[0] * Math.pow(2, a[1]), t)},
  SHR:   {p:['IN','N'], bit:true, run: (a, t) => Math.floor(((a[0] < 0 ? a[0] + Math.pow(2, t.bits) : a[0])) / Math.pow(2, a[1]))},
  ROL:   {p:['IN','N'], bit:true, run: (a, t) => { const b = t.bits, n = a[1] % b, v = a[0] < 0 ? a[0] + Math.pow(2, b) : a[0]; return wrapInt(((v * Math.pow(2, n)) % Math.pow(2, b)) + Math.floor(v / Math.pow(2, b - n)), t); }},
  ROR:   {p:['IN','N'], bit:true, run: (a, t) => { const b = t.bits, n = a[1] % b, v = a[0] < 0 ? a[0] + Math.pow(2, b) : a[0]; return wrapInt(Math.floor(v / Math.pow(2, n)) + (v % Math.pow(2, n)) * Math.pow(2, b - n), t); }}
};
function strArg(t, fn, f, n){ if(t.k !== 'string') f(fn + '() erwartet einen Text (STRING), bekommt aber ' + typeNice(t) + '.', n); }
function intArg(t, fn, p, f, n){ if(t.k !== 'int') f(fn + '(): ' + p + ' muss eine Ganzzahl sein.', n); }

// Umwandlungen X_TO_Y
const CONV_NAMES = ELEM_NAMES.concat(['STRING']);
function convType(name){
  const m = /^([A-Z]+)_TO_([A-Z]+)$/.exec(name.toUpperCase());
  if(!m) return null;
  const a = m[1], b = m[2];
  if(!CONV_NAMES.includes(a) || !CONV_NAMES.includes(b) || a === b) return null;
  return {from: a === 'STRING' ? T.STRING : T[a], to: b === 'STRING' ? mkString(254) : T[b]};
}
function convertVal(v, from, to){
  if(to.k === 'string'){
    if(from.k === 'bool') return v ? 'TRUE' : 'FALSE';
    if(from.k === 'real'){ const r = Math.round(v * 1e6) / 1e6; return String(r); }
    if(from.k === 'time') return 'T#' + Math.round(v * 1000) + 'MS';
    return String(v);
  }
  if(from.k === 'string'){
    const s = String(v).trim();
    if(to.k === 'real'){ const x = parseFloat(s.replace(',', '.')); return isNaN(x) ? 0 : x; }
    if(to.k === 'bool') return /^(TRUE|1)$/i.test(s);
    const x = parseInt(s, 10); return isNaN(x) ? 0 : coerce(x, to);
  }
  if(to.k === 'bool') return v !== 0 && v !== false;
  if(from.k === 'bool') v = v ? 1 : 0;
  if(from.k === 'time' && to.k !== 'time') v = Math.round(v * 1000);
  if(to.k === 'time') return (from.k === 'time') ? v : v / 1000;
  if(to.k === 'real') return v;
  if(from.k === 'real') v = roundHalfEven(v);
  return wrapInt(v, to);
}

/* ============================================================
   5. COMPILER — Registrierung, Typauflösung, Prüfung, Warnungen
   ============================================================ */
function levenshtein(a, b){
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp = Array.from({length: a.length + 1}, (_, i) => [i].concat(Array(b.length).fill(0)));
  for(let j = 1; j <= b.length; j++) dp[0][j] = j;
  for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return dp[a.length][b.length];
}
function suggestName(name, cands){
  let best = null, bd = 99;
  cands.forEach(c => { const d = levenshtein(name, c); if(d < bd){ bd = d; best = c; } });
  return bd <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}
const WARN_TEXT = {
  TEMP_READ_BEFORE_WRITE: 'TEMP gelesen, bevor sie beschrieben wurde',
  OUT_NOT_ALL_PATHS: 'Ausgang nicht in jedem Zweig beschrieben',
  RET_NOT_SET: 'Rückgabewert nicht in jedem Zweig gesetzt',
  UNUSED_VAR: 'Variable deklariert, aber nie verwendet',
  GLOBAL_ACCESS: 'Baustein greift direkt auf globale Daten zu',
  INSTANCE_TWICE: 'Instanz an mehreren Stellen aufgerufen',
  CONDITIONAL_CALL: 'Instanz wird nur bedingt aufgerufen',
  STRING_TRUNC: 'Text wird abgeschnitten'
};

function inferTypeFromValue(v){
  if(typeof v === 'boolean') return T.BOOL;
  if(typeof v === 'number') return Number.isInteger(v) ? T.INT : T.REAL;
  if(typeof v === 'string') return mkString(254);
  if(Array.isArray(v)){
    const of = v.some(x => typeof x === 'boolean') ? T.BOOL : v.some(x => typeof x === 'number' && !Number.isInteger(x)) ? T.REAL : v.some(x => typeof x === 'string') ? mkString(254) : T.INT;
    return {k:'array', dims:[{lo:0, hi: Math.max(0, v.length - 1)}], of};
  }
  return T.INT;
}
function fromPlain(v, t){
  if(v instanceof ArrVal) return cloneVal(v);
  if(t.k === 'array'){
    const a = defaultVal(t);
    if(Array.isArray(v)) v.forEach((x, i) => { if(i < a.d.length) a.d[i] = fromPlain(x, t.of); });
    return a;
  }
  if(t.k === 'struct'){
    const o = defaultVal(t);
    if(v && typeof v === 'object') Object.keys(v).forEach(k => { const m = t.members.find(m => m.name.toLowerCase() === k.toLowerCase()); if(m) o[m.name] = fromPlain(v[k], m.type); });
    return o;
  }
  if(t.k === 'fb') return v;
  return coerce(v, t);
}

function Compiler(project){
  const warnings = [];
  const reg = {};              // lowerName -> entry
  const units = [];
  const callEdges = {};        // unitName -> Set(calleeUnitName)
  const instSites = {};        // instanceKey -> [{unit, line}]
  let curBlock = null;

  const fail = (msg, node, extra) => { throw new SCLError('semantic', msg, node && node.line, node && node.col, Object.assign({block: curBlock}, extra || {})); };
  const warn = (code, msg, node, unitName) => {
    if(warnings.some(w => w.code === code && w.msg === msg && w.unit === unitName)) return;
    warnings.push({code, title: WARN_TEXT[code] || code, msg, line: node && node.line || 0, col: node && node.col || 0, unit: unitName, block: curBlock});
  };

  /* ---- 1. Parsen & Registrieren ---- */
  (project.sources || []).forEach(s => {
    curBlock = s.block;
    let parsed;
    try{ parsed = parseSource(s.src || ''); }
    catch(e){ if(e instanceof SCLError){ e.block = s.block; } throw e; }
    parsed.units.forEach(u => {
      u.block = s.block; u.srcMeta = s;
      const key = u.name.toLowerCase();
      if(reg[key]) fail('Der Name "' + u.name + '" ist doppelt vergeben (' + reg[key].kind + ' und ' + u.kind + '). Jeder Baustein braucht einen eigenen Namen.', u);
      if(T[u.name.toUpperCase()] || BUILTIN_FB[u.name.toUpperCase()] || FN[u.name.toUpperCase()]) fail('"' + u.name + '" ist ein reservierter Name (Datentyp oder Standardbaustein). Wähle einen anderen Namen, z.B. mit Präfix: "FB_' + u.name + '".', u);
      reg[key] = {kind: u.kind, name: u.name, unit: u};
      units.push(u);
    });
  });

  /* ---- 2. Typauflösung ---- */
  const udtState = {};
  function constEval(e, scope){
    switch(e.k){
      case 'num': return e.v;
      case 'bool': return e.v;
      case 'str': return e.v;
      case 'un': { const v = constEval(e.e, scope); return e.op === 'NEG' ? -v : !v; }
      case 'bin': {
        const l = constEval(e.l, scope), r = constEval(e.r, scope);
        switch(e.op){ case '+': return l + r; case '-': return l - r; case '*': return l * r;
          case '/': if(r === 0) fail('Division durch 0 in einem konstanten Ausdruck.', e); return (Number.isInteger(l) && Number.isInteger(r)) ? Math.trunc(l / r) : l / r;
          case 'MOD': return l % r; }
        fail('Dieser Operator ist in einem konstanten Ausdruck nicht erlaubt.', e);
      }
      case 'var': {
        const c = scope && scope.consts && scope.consts[e.name.toLowerCase()];
        if(c) return c.init;
        fail('"' + e.name + '" ist keine Konstante. Hier sind nur feste Werte oder Konstanten (VAR CONSTANT) erlaubt.', e);
      }
    }
    fail('Hier ist nur ein fester Wert erlaubt (Zahl, TRUE/FALSE, Text, Zeit oder Konstante).', e);
  }
  function constType(e, scope){
    switch(e.k){
      case 'num': return e.nt === 'REAL' ? T.REAL : e.nt === 'TIME' ? T.TIME : e.nt === 'INT' ? intLitType(e.v) : Object.assign({}, T[e.nt] || T.DINT, {lit:true, v:e.v});
      case 'bool': return T.BOOL;
      case 'str': return strLitType(e.v);
      case 'var': { const c = scope && scope.consts && scope.consts[e.name.toLowerCase()]; if(c) return c.type.k === 'int' ? intLitType(c.init) : c.type; break; }
      case 'un': case 'bin': { const v = constEval(e, scope); return typeof v === 'number' ? (Number.isInteger(v) ? intLitType(v) : T.REAL) : typeof v === 'boolean' ? T.BOOL : strLitType(String(v)); }
    }
    constEval(e, scope);
    return T.INT;
  }
  function resolveType(ast, scope, ctxName){
    switch(ast.t){
      case 'name': {
        const up = ast.name.toUpperCase();
        if(!ast.quoted){
          if(T[up] && up !== 'VOID') return T[up];
          if(up === 'STRING') return mkString(254);
          if(BUILTIN_FB[TYPE_ALIAS[up] || up]) return builtinFbType(TYPE_ALIAS[up] || up);
          if(up === 'VOID') fail('VOID gibt es nur als Rückgabetyp einer FUNCTION.', ast);
          if(['LINT','ULINT','LWORD','LTIME','DATE','TOD','TIME_OF_DAY','DTL','DATE_AND_TIME','WCHAR','WSTRING','VARIANT','POINTER','ANY'].includes(up)) fail('Der Datentyp ' + up + ' wird in dieser Übungsanlage nicht unterstützt.', ast);
        }
        const e = reg[ast.name.toLowerCase()];
        if(e && e.kind === 'UDT')return udtType(e);
        if(e && e.kind === 'FB')return {k:'fb', name: e.name, unit: e.unit};
        if(e) fail('"' + e.name + '" ist ein ' + e.kind + ' und kein Datentyp.', ast);
        const cands = ELEM_NAMES.concat(['STRING'], Object.keys(BUILTIN_FB), Object.values(reg).filter(r => r.kind === 'UDT' || r.kind === 'FB').map(r => r.name));
        const sug = suggestName(ast.name, cands);
        fail('Unbekannter Datentyp "' + ast.name + '".' + (sug ? ' Meintest du ' + sug + '?' : ' Beispiele: BOOL, INT, DINT, REAL, TIME, STRING[20], ARRAY[1..5] OF INT oder ein eigener Typ "UDT_…".'), ast);
      }
      case 'string': {
        const n = constEval(ast.len, scope);
        if(!Number.isInteger(n) || n < 1 || n > 254) fail('Die Länge eines STRING muss zwischen 1 und 254 liegen.', ast);
        return mkString(n);
      }
      case 'array': {
        const dims = ast.dims.map(d => {
          const lo = constEval(d.lo, scope), hi = constEval(d.hi, scope);
          if(!Number.isInteger(lo) || !Number.isInteger(hi)) fail('Array-Grenzen müssen ganze Zahlen sein.', ast);
          if(hi < lo) fail('Die Array-Grenzen ' + lo + '..' + hi + ' sind vertauscht — die Untergrenze steht links.', ast);
          if(hi - lo > 9999) fail('Dieses Array ist für die Übungsanlage zu gross (max. 10000 Elemente je Dimension).', ast);
          return {lo, hi};
        });
        if(dims.length > 3) fail('Mehr als 3 Dimensionen werden hier nicht unterstützt.', ast);
        const of = resolveType(ast.of, scope, ctxName);
        if(of.k === 'fb' && !of.builtin) fail('Arrays von eigenen FB-Instanzen werden in dieser Anlage nicht unterstützt — lege die Instanzen einzeln an.', ast);
        return {k:'array', dims, of};
      }
      case 'struct': {
        const members = [], seen = {};
        ast.members.forEach(m => {
          const k = m.name.toLowerCase();
          if(seen[k]) fail('Das Element "' + m.name + '" kommt in der Struktur doppelt vor.', m);
          seen[k] = true;
          const mt = resolveType(m.type, scope, ctxName);
          if(mt.k === 'fb') fail('Instanzen gehören nicht in eine Struktur — lege sie im FB unter VAR an.', m);
          const mm = {name: m.name, type: mt, comment: m.comment, line: m.line};
          if(m.init) mm.init = initValue(m.init, mt, scope, m);
          members.push(mm);
        });
        return {k:'struct', members};
      }
    }
    fail('Unbekannter Datentyp.', ast);
  }
  function udtType(e){
    const st = udtState[e.name];
    if(st === 'busy') fail('Der Datentyp "' + e.name + '" enthält sich selbst — das ergibt eine endlose Struktur.', e.unit);
    if(st) return st;
    udtState[e.name] = 'busy';
    const saved = curBlock; curBlock = e.unit.block;
    const t = resolveType(e.unit.struct, null, e.name);
    curBlock = saved;
    t.udt = e.name;
    udtState[e.name] = t;
    e.type = t;
    return t;
  }
  function initValue(init, type, scope, node){
    if(init.k === 'arrinit'){
      if(type.k !== 'array') fail('Eine Startwert-Liste [ … ] passt nur zu einem ARRAY.', init);
      const a = defaultVal(type);
      let i = 0;
      init.items.forEach(it => {
        const t = constType(it.e, scope), m = assignMsg(type.of, t);
        if(m) fail('Startwert passt nicht: ' + m, it.e);
        const v = coerce(constEval(it.e, scope), type.of);
        for(let r = 0; r < it.rep; r++){ if(i >= a.d.length) fail('Zu viele Startwerte: das Array hat nur ' + a.d.length + ' Elemente.', init); a.d[i++] = v; }
      });
      return a;
    }
    if(type.k === 'array' || type.k === 'struct' || type.k === 'fb') fail('Für ' + typeStr(type) + ' ist dieser Startwert nicht möglich.', init);
    const t = constType(init, scope), m = assignMsg(type, t);
    if(m) fail('Startwert von "' + node.name + '" passt nicht: ' + m, init);
    if(type.k === 'string' && t.k === 'string' && t.v && t.v.length > type.len) warn('STRING_TRUNC', 'Der Startwert von "' + node.name + '" ist länger als STRING[' + type.len + '] und wird abgeschnitten.', init, curBlock);
    return coerce(constEval(init, scope), type);
  }

  // UDTs zuerst
  units.filter(u => u.kind === 'UDT').forEach(u => { curBlock = u.block; udtType(reg[u.name.toLowerCase()]); });

  /* ---- 3. Schnittstellen ---- */
  function buildIface(u){
    curBlock = u.block;
    const iface = {Input:[], Output:[], InOut:[], Static:[], Temp:[], Constant:[]};
    const map = {}, consts = {};
    const scope = {consts};
    const kindName = {FC:'eine FUNCTION (FC)', FB:'ein FUNCTION_BLOCK (FB)', OB:'ein Organisationsbaustein (OB)', DB:'ein Datenbaustein (DB)'}[u.kind];
    u.sections.forEach(s => {
      if(u.kind === 'FC' && s.sec === 'Static') fail('Eine FC hat kein Gedächtnis — statische Variablen (VAR) gibt es nur im FUNCTION_BLOCK. Nimm VAR_TEMP für Zwischenwerte oder baue einen FB, wenn sich der Baustein etwas merken muss.', s);
      if(u.kind === 'OB' && ['Input','Output','InOut'].includes(s.sec)) fail('Ein Organisationsbaustein hat keine Ein-/Ausgänge — er wird vom Betriebssystem aufgerufen. Erlaubt sind VAR_TEMP und VAR CONSTANT.', s);
      if(u.kind === 'OB' && s.sec === 'Static') fail('Im OB gibt es keine statischen Variablen (VAR). Werte, die erhalten bleiben sollen, gehören in einen globalen DB oder in einen FB.', s);
      if(u.kind === 'DB' && s.sec !== 'Static') fail('Ein globaler Datenbaustein kennt nur den Bereich VAR … END_VAR.', s);
      s.vars.forEach(d => {
        const k = d.name.toLowerCase();
        if(map[k]) fail('Die Variable "' + d.name + '" ist doppelt deklariert.', d);
        if(u.kind === 'FC' && k === u.name.toLowerCase()) fail('"' + d.name + '" ist schon der Name des Rückgabewerts dieser FC.', d);
        const type = resolveType(d.type, scope, u.name);
        if(type.k === 'fb'){
          if(s.sec === 'Temp' || u.kind === 'FC' || u.kind === 'OB') fail('Instanzen (' + typeStr(type) + ') brauchen Gedächtnis und gehören in den Bereich VAR eines FB (Multiinstanz) — nicht in ' + (s.sec === 'Temp' ? 'VAR_TEMP' : kindName) + '.', d);
          if(s.sec !== 'Static') fail('Eine Instanz kann kein ' + SEC_KW[s.sec] + '-Parameter sein. Lege sie unter VAR an.', d);
          if(!type.builtin && type.name === u.name) fail('Der FB "' + u.name + '" kann keine Instanz von sich selbst enthalten.', d);
        }
        const v = {name: d.name, type, sec: s.sec, comment: d.comment || '', line: d.line, col: d.col, used: false, retain: !!s.retain};
        if(d.init){
          if(s.sec === 'InOut') fail('IN_OUT-Parameter haben keinen Startwert — sie verweisen auf die Variable des Aufrufers.', d);
          v.init = initValue(d.init, type, scope, d);
          v.initSrc = d.init;
        } else if(s.sec === 'Constant') fail('Die Konstante "' + d.name + '" braucht einen Wert: ' + d.name + ' : INT := 10;', d);
        if(s.sec === 'Constant') consts[k] = v;
        map[k] = v;
        iface[s.sec].push(v);
      });
    });
    if(u.kind === 'FC'){
      const rt = u.ret.t === 'name' && !u.ret.quoted && u.ret.name.toUpperCase() === 'VOID' ? T.VOID : resolveType(u.ret, scope, u.name);
      if(rt.k === 'fb') fail('Eine FC kann keine Instanz zurückgeben.', u.ret);
      u.retType = rt;
      if(rt.k !== 'void'){
        const rv = {name: u.name, type: rt, sec: 'Return', used: true, line: u.line};
        map[u.name.toLowerCase()] = rv; map['ret_val'] = rv;
        u.retVar = rv;
      }
    }
    u.iface = iface; u.map = map; u.consts = consts;
    u.constVals = {}; iface.Constant.forEach(c => u.constVals[c.name] = c.init);
  }
  units.filter(u => u.kind === 'FC' || u.kind === 'FB' || u.kind === 'OB').forEach(buildIface);
  // FB-Enthaltensein ohne Zyklen (A enthält B enthält A)
  (function(){
    const state = {};
    function visit(u, chain){
      if(state[u.name] === 2) return; if(state[u.name] === 1){ curBlock = u.block; fail('Die Multiinstanzen bilden einen Kreis: ' + chain.concat(u.name).join(' → ') + '.', u); }
      state[u.name] = 1;
      u.iface.Static.forEach(v => { if(v.type.k === 'fb' && !v.type.builtin) visit(v.type.unit, chain.concat(u.name)); });
      state[u.name] = 2;
    }
    units.filter(u => u.kind === 'FB').forEach(u => visit(u, []));
  })();

  /* ---- 4. Globale Variablen, DBs, Instanz-DBs ---- */
  const tags = {};
  const typeFromSpec = spec => {
    const P = makeParser(String(spec));
    let ast; try{ ast = (function(){ const q = makeParser('TYPE "__x" STRUCT v : ' + spec + '; END_STRUCT; END_TYPE').parseUnits(); return q[0].struct.members[0].type; })(); }
    catch(e){ throw new SCLError('semantic', 'Ungültiger Typ in der Variablentabelle: ' + spec, 0, 0); }
    return resolveType(ast, null, 'Variablentabelle');
  };
  Object.keys(project.globals || {}).forEach(n => {
    curBlock = 'PLC-Variablen';
    const k = n.toLowerCase();
    if(reg[k]) fail('Der Name "' + n + '" ist doppelt vergeben (PLC-Variable und Baustein).', null);
    const spec = project.globalTypes && project.globalTypes[n];
    const type = spec ? typeFromSpec(spec) : inferTypeFromValue(project.globals[n]);
    const e = {kind:'TAG', name: n, type, init: fromPlain(project.globals[n], type), comment: (project.globalComments || {})[n] || ''};
    reg[k] = e; tags[n] = e;
  });
  const dbs = {};
  function addInstanceDB(name, fbName, node, auto){
    const fe = reg[fbName.toLowerCase()];
    const up = fbName.toUpperCase();
    let type;
    if(fe && fe.kind === 'FB') type = {k:'fb', name: fe.name, unit: fe.unit};
    else if(!fe && BUILTIN_FB[TYPE_ALIAS[up] || up]) type = builtinFbType(TYPE_ALIAS[up] || up);
    else if(fe && fe.kind === 'UDT') type = udtType(fe);
    else fail('Der Instanz-DB "' + name + '" verweist auf "' + fbName + '", das ist kein FB.', node);
    const e = {kind:'DB', name, type, instance: type.k === 'fb', auto: !!auto, of: type.k === 'fb' ? type.name : null};
    reg[name.toLowerCase()] = e; dbs[name] = e;
    return e;
  }
  units.filter(u => u.kind === 'DB').forEach(u => {
    curBlock = u.block;
    const e = reg[u.name.toLowerCase()];
    if(u.instOf){
      delete reg[u.name.toLowerCase()];
      const ne = addInstanceDB(u.name, u.instOf.name, u.instOf);
      ne.unit = u;
    } else {
      buildIface(u);
      const type = {k:'struct', members: u.iface.Static.map(v => ({name: v.name, type: v.type, init: v.init, comment: v.comment}))};
      e.type = type; e.unit = u; e.global = true;
      dbs[u.name] = e;
    }
  });
  Object.keys(project.instances || {}).forEach(n => { curBlock = 'Instanzen'; if(!reg[n.toLowerCase()]) addInstanceDB(n, project.instances[n], null); });
  units.filter(u => u.kind === 'OB').forEach(u => {
    const meta = u.srcMeta || {};
    u.obNumber = meta.ob || (/^(startup|anlauf|ob_?100)$/i.test(u.name) ? 100 : 1);
  });

  /* ---- 5. Rümpfe prüfen ---- */
  let C = null;   // aktueller Prüfkontext
  function lookupVar(node, forCall){
    const key = node.name.toLowerCase();
    if(!node.quoted && C.map){
      const v = C.map[key];
      if(v){
        node.name = v.name;
        v.used = true;
        return {cls:'loc', v};
      }
      if(node.hash){
        const sug = suggestName(node.name, Object.values(C.map).map(v => v.name));
        fail('Die lokale Variable "#' + node.name + '" ist in diesem Baustein nicht deklariert.' + (sug ? ' Meintest du "#' + sug + '"?' : ' Lege sie in einem VAR-Bereich an.'), node, {suggestion: sug});
      }
    }
    const e = reg[key];
    if(e && !node.hash){
      node.name = e.name;
      return {cls: e.kind, e};
    }
    // automatisch angelegter Instanz-DB "FB_X_DB"
    if(forCall && !node.hash){
      const m = /^(.+?)_?DB\d*$/i.exec(node.name);
      if(m){
        const fe = reg[m[1].toLowerCase()];
        if(fe && fe.kind === 'FB'){ const ne = addInstanceDB(node.name, fe.name, node, true); node.name = ne.name; return {cls:'DB', e: ne}; }
      }
    }
    const cands = Object.values(reg).filter(r => r.kind !== 'UDT').map(r => r.name).concat(C.map ? Object.values(C.map).map(v => v.name) : []);
    const sug = suggestName(node.name, cands);
    const shown = node.quoted ? '"' + node.name + '"' : node.name;
    fail('Unbekannter Name ' + shown + '.' + (sug ? ' Meintest du "' + sug + '"?' : (node.quoted ? ' Globale Variablen und Bausteine müssen existieren (siehe PLC-Variablen und Projektbaum).' : ' Lokale Variablen musst du im Baustein deklarieren.')), node, {suggestion: sug});
  }
  function markGlobal(name, node){
    if(!C.unit || C.isDbInit || !C.fix) return;
    if(C.unit.kind === 'FB' || C.unit.kind === 'FC'){
      (C.unit.globalsUsed = C.unit.globalsUsed || {})[name] = true;
      warn('GLOBAL_ACCESS', (C.unit.kind === 'FB' ? 'Der FB' : 'Die FC') + ' "' + C.unit.name + '" greift direkt auf die globale Variable "' + name + '" zu. Besser: über die Schnittstelle (VAR_INPUT/VAR_OUTPUT) übergeben — dann funktioniert jede Instanz unabhängig.', node, C.unit.name);
    }
  }
  function accOf(v){
    if(v.sec === 'Constant') return {w:'const', name: v.name, v: v.init};
    if(v.sec === 'InOut') return {w:'ref', name: v.name};
    if(C.unit && C.unit.kind === 'FB' && (v.sec === 'Input' || v.sec === 'Output' || v.sec === 'Static')) return {w:'inst', name: v.name};
    if(C.isDbInit) return {w:'self', name: v.name};
    return {w:'tmp', name: v.name};
  }
  function typeOf(e, opts){
    opts = opts || {};
    let t;
    switch(e.k){
      case 'num':
        t = e.nt === 'REAL' ? T.REAL : e.nt === 'TIME' ? T.TIME : e.nt === 'INT' ? intLitType(e.v) : (e.typed ? T[e.nt] : T.INT);
        if(e.typed && T[e.nt] && T[e.nt].k === 'int' && (e.v < T[e.nt].min || e.v > T[e.nt].max)) fail('Der Wert ' + e.v + ' passt nicht in ' + e.nt + '.', e);
        break;
      case 'bool': t = T.BOOL; break;
      case 'str': t = strLitType(e.v); break;
      case 'var': {
        const r = lookupVar(e);
        if(r.cls === 'loc'){
          e.acc = accOf(r.v); e.vref = r.v; t = r.v.type;
          if(r.v.sec === 'Constant' && r.v.type.k === 'int') t = Object.assign({}, r.v.type, {constv: r.v.init});
        } else if(r.cls === 'TAG'){ e.acc = {w:'glob', name: r.e.name}; t = r.e.type; markGlobal(r.e.name, e); }
        else if(r.cls === 'DB'){ e.acc = {w:'db', name: r.e.name}; t = r.e.type; if(!(r.e.instance && opts.callee)) markGlobal(r.e.name, e); }
        else if(r.cls === 'FC') fail('"' + r.e.name + '" ist eine Funktion (FC). Rufe sie mit Klammern auf: "' + r.e.name + '"(…).', e);
        else if(r.cls === 'FB') fail('"' + r.e.name + '" ist ein Funktionsbaustein-Typ. Du brauchst eine Instanz davon, z.B. "' + r.e.name + '_DB" oder eine Multiinstanz #…', e);
        else if(r.cls === 'OB') fail('Ein OB kann nicht angesprochen werden — er wird vom Betriebssystem aufgerufen.', e);
        else if(r.cls === 'UDT') fail('"' + r.e.name + '" ist ein Datentyp. Lege eine Variable dieses Typs an und greife auf sie zu.', e);
        if(t.k === 'fb' && !opts.allowInst) fail('"' + e.name + '" ist eine Instanz von ' + typeStr(t) + '. Lies einen Ausgang, z.B. ' + e.name + '.' + (t.builtin ? 'Q' : (firstOut(t) || 'Ausgang')) + ', oder rufe sie auf.', e);
        break;
      }
      case 'mem': {
        const bt = typeOf(e.base, {allowInst: true});
        if(bt.k === 'struct'){
          const m = bt.members.find(m => m.name.toLowerCase() === e.member.toLowerCase());
          if(!m){ const sug = suggestName(e.member, bt.members.map(m => m.name)); fail(typeStr(bt) + ' hat kein Element "' + e.member + '".' + (sug ? ' Meintest du "' + sug + '"?' : ' Elemente: ' + bt.members.map(m => m.name).join(', ') + '.'), e); }
          e.member = m.name; t = m.type; e.ro = !!e.base.ro;
        } else if(bt.k === 'fb'){
          if(bt.builtin){
            const def = BUILTIN_FB[bt.name];
            const all = Object.keys(def.outputs).concat(Object.keys(def.inputs));
            const key = all.find(k => k.toLowerCase() === e.member.toLowerCase());
            if(!key) fail(bt.name + ' hat keinen Parameter "' + e.member + '". Ausgänge: ' + Object.keys(def.outputs).join(', ') + '.', e);
            e.member = key; t = fbParamType(bt.name, key);
          } else {
            const u = bt.unit;
            const v = (u.iface.Input.concat(u.iface.Output, u.iface.Static)).find(v => v.name.toLowerCase() === e.member.toLowerCase());
            if(!v){
              const tv = u.iface.Temp.concat(u.iface.InOut).find(v => v.name.toLowerCase() === e.member.toLowerCase());
              if(tv) fail('"' + tv.name + '" ist ' + (tv.sec === 'Temp' ? 'eine TEMP-Variable' : 'ein IN_OUT-Parameter') + ' von "' + u.name + '" — sie existiert nur während des Aufrufs und kann von aussen nicht gelesen werden.', e);
              fail('"' + u.name + '" hat kein Element "' + e.member + '". Ausgänge: ' + (u.iface.Output.map(v => v.name).join(', ') || '—') + '.', e);
            }
            e.member = v.name; t = v.type;
            if(v.type.k === 'fb') t = v.type;
          }
          e.ro = true;
        } else fail('Nur Strukturen, Datenbausteine und Instanzen haben Elemente mit "." — "' + exprName(e.base) + '" ist ' + typeStr(bt) + '.', e);
        if(t.k === 'fb' && !opts.allowInst) fail('"' + exprName(e) + '" ist eine Instanz. Lies einen ihrer Ausgänge.', e);
        break;
      }
      case 'idx': {
        const bt = typeOf(e.base, {allowArrayBase: true});
        if(bt.k !== 'array') fail('"' + exprName(e.base) + '" ist kein Array und kann nicht mit [ ] indiziert werden.', e);
        if(e.index.length !== bt.dims.length) fail('"' + exprName(e.base) + '" hat ' + bt.dims.length + ' Dimension' + (bt.dims.length > 1 ? 'en' : '') + ' — gib ' + bt.dims.length + ' Index' + (bt.dims.length > 1 ? 'e' : '') + ' an, z.B. [' + bt.dims.map(d => d.lo).join(', ') + '].', e);
        e.index.forEach((ix, i) => {
          const it = typeOf(ix);
          if(it.k !== 'int') fail('Ein Array-Index muss eine Ganzzahl sein, nicht ' + typeNice(it) + '.', ix);
          const cv = it.lit ? it.v : it.constv;
          if(cv !== undefined && (cv < bt.dims[i].lo || cv > bt.dims[i].hi)) fail('Der Index ' + cv + ' liegt ausserhalb der Grenzen ' + bt.dims[i].lo + '..' + bt.dims[i].hi + ' von "' + exprName(e.base) + '".', ix);
        });
        e.ro = !!e.base.ro;
        t = bt.of; break;
      }
      case 'bit': {
        const bt = typeOf(e.base);
        if(!isIntLike(bt)) fail('Bitzugriff .%X geht nur bei BYTE, WORD, DWORD und Ganzzahlen, nicht bei ' + typeStr(bt) + '.', e);
        if(e.n >= bt.bits) fail(typeStr(bt) + ' hat nur die Bits 0 bis ' + (bt.bits - 1) + ' (.%X' + e.n + ' gibt es nicht).', e);
        e.bt = bt; e.ro = !!e.base.ro;
        t = T.BOOL; break;
      }
      case 'un': {
        const it = typeOf(e.e);
        if(e.op === 'NOT'){
          if(it.k === 'bool') t = T.BOOL;
          else if(it.k === 'bits') t = it;
          else fail('NOT braucht einen BOOL-Wert (oder BYTE/WORD/DWORD), bekommt aber ' + typeNice(it) + '.', e);
        } else {
          if(!isNum(it) && it.k !== 'time') fail('Ein Minuszeichen passt nur vor Zahlen, nicht vor ' + typeNice(it) + '.', e);
          t = it.lit ? intLitType(-it.v) : it;
        }
        break;
      }
      case 'bin': t = typeBin(e); break;
      case 'call': t = typeCall(e, false); break;
      default: fail('Unbekannter Ausdruck.', e);
    }
    e.t = t;
    return t;
  }
  function firstOut(t){ const u = t.unit; return u && u.iface.Output[0] && u.iface.Output[0].name; }
  function exprName(e){
    if(!e) return '?';
    if(e.k === 'var') return (e.quoted ? '"' + e.name + '"' : e.name);
    if(e.k === 'mem') return exprName(e.base) + '.' + e.member;
    if(e.k === 'idx') return exprName(e.base) + '[…]';
    if(e.k === 'bit') return exprName(e.base) + '.%X' + e.n;
    return 'Ausdruck';
  }
  function typeBin(e){
    const lt = typeOf(e.l), rt = typeOf(e.r), op = e.op;
    if(op === 'AND' || op === 'OR' || op === 'XOR'){
      if(lt.k === 'bool' && rt.k === 'bool') return T.BOOL;
      if((lt.k === 'bits' || (lt.k === 'int' && lt.lit)) && (rt.k === 'bits' || (rt.k === 'int' && rt.lit)) && (lt.k === 'bits' || rt.k === 'bits')){
        if(lt.k === 'bits' && rt.k === 'bits') return lt.bits >= rt.bits ? lt : rt;
        return lt.k === 'bits' ? lt : rt;
      }
      const bad = lt.k !== 'bool' ? e.l : e.r;
      fail(op + ' verknüpft Wahrheitswerte (BOOL) oder Bitmuster (BYTE/WORD/DWORD). ' + (bad.k === 'var' ? '"' + bad.name + '" ist ' : 'Ein Operand ist ') + typeNice(bad.t) + '. Tipp: Vergleiche zuerst, z.B. (Wert > 5) ' + op + ' …', e);
    }
    if(op === '=' || op === '<>'){
      if(lt.k === 'bool' && rt.k === 'bool') return T.BOOL;
      if((isNum(lt) && isNum(rt)) || (lt.k === 'time' && rt.k === 'time') || (lt.k === 'string' && rt.k === 'string')) return T.BOOL;
      if(isIntLike(lt) && isIntLike(rt)) return T.BOOL;
      fail('Vergleich "' + op + '" zwischen ' + typeNice(lt) + ' und ' + typeNice(rt) + ' ist nicht möglich.', e);
    }
    if(['<','>','<=','>='].includes(op)){
      if((isNum(lt) && isNum(rt)) || (lt.k === 'time' && rt.k === 'time') || (lt.k === 'string' && rt.k === 'string')) return T.BOOL;
      if(lt.k === 'time' || rt.k === 'time') fail('Zeiten vergleicht man mit Zeit-Literalen, z.B. #Timer.ET >= T#2S.', e);
      fail('"' + op + '" vergleicht Zahlen, hier stehen aber ' + typeNice(lt) + ' und ' + typeNice(rt) + '.', e);
    }
    if(lt.k === 'bool' || rt.k === 'bool') fail('Mit BOOL-Werten kann man nicht rechnen ("' + op + '"). Für Logik nutze AND/OR/NOT.', e);
    if(lt.k === 'string' || rt.k === 'string') fail('Texte verbindet man nicht mit "' + op + '", sondern mit CONCAT(IN1 := …, IN2 := …).', e);
    if(lt.k === 'bits' || rt.k === 'bits') fail('Mit ' + (lt.k === 'bits' ? lt.n : rt.n) + ' rechnet man nicht direkt ("' + op + '"). Für Bitmasken nutze AND/OR/XOR, zum Rechnen wandle um, z.B. WORD_TO_INT(…).', e);
    if(op === 'MOD'){
      if(lt.k !== 'int' || rt.k !== 'int') fail('MOD (Divisionsrest) funktioniert nur mit Ganzzahlen.', e);
      return arithInt(lt, rt, e);
    }
    if(op === '**'){ if(!isNum(lt) || !isNum(rt)) fail('** (Potenz) braucht Zahlen.', e); return (lt.n === 'LREAL' || rt.n === 'LREAL') ? T.LREAL : T.REAL; }
    if(lt.k === 'time' || rt.k === 'time'){
      if((op === '+' || op === '-') && lt.k === 'time' && rt.k === 'time') return T.TIME;
      if(op === '*' && ((lt.k === 'time' && rt.k === 'int') || (lt.k === 'int' && rt.k === 'time'))) return T.TIME;
      if(op === '/' && lt.k === 'time' && rt.k === 'int') return T.TIME;
      fail('Diese Rechnung mit TIME ist nicht erlaubt (' + typeNice(lt) + ' ' + op + ' ' + typeNice(rt) + ').', e);
    }
    if(!isNum(lt) || !isNum(rt)) fail('"' + op + '" braucht Zahlen.', e);
    if(lt.k === 'real' || rt.k === 'real') return (lt.n === 'LREAL' || rt.n === 'LREAL') ? T.LREAL : T.REAL;
    return arithInt(lt, rt, e);
  }
  function arithInt(lt, rt, e){
    if(lt.lit && rt.lit){
      const l = lt.v, r = rt.v;
      let v;
      switch(e.op){ case '+': v = l + r; break; case '-': v = l - r; break; case '*': v = l * r; break;
        case '/': if(r === 0) fail('Division durch 0.', e); v = Math.trunc(l / r); break; case 'MOD': if(r === 0) fail('MOD 0 ist nicht definiert.', e); v = l % r; break; }
      return intLitType(v);
    }
    if(lt.gen || rt.gen) return (lt.lit || lt.gen) ? ((rt.lit || rt.gen) ? Object.assign({}, T.DINT, {gen:true}) : rt) : lt;
    if(lt.lit) return (lt.v >= rt.min && lt.v <= rt.max) ? rt : widerInt(T.DINT, rt);
    if(rt.lit) return (rt.v >= lt.min && rt.v <= lt.max) ? lt : widerInt(T.DINT, lt);
    return widerInt(lt, rt);
  }
  function mapArgs(e, params, vari, fnName){
    const named = e.args.filter(a => a.name), pos = e.args.filter(a => !a.name);
    if(named.length && pos.length) fail(fnName + '(): Entweder alle Parameter mit Namen angeben oder keinen.', e);
    e.args.forEach(a => { if(a.dir === 'out') fail(fnName + '() hat keine Ausgänge für "=>".', a); });
    if(vari){
      if(pos.length) return pos.map(a => a.expr);
      const out = [];
      named.forEach(a => {
        const m = /^IN(\d+)$/i.exec(a.name);
        if(!m) fail(fnName + '(): Parameter heissen IN1, IN2, …', a);
        out[parseInt(m[1], 10) - 1] = a.expr;
      });
      for(let i = 0; i < out.length; i++) if(!out[i]) fail(fnName + '(): Parameter IN' + (i + 1) + ' fehlt.', e);
      return out;
    }
    if(pos.length) return pos.map(a => a.expr);
    const out = new Array(params.length);
    named.forEach(a => {
      const i = params.findIndex(p => p.toLowerCase() === a.name.toLowerCase());
      if(i < 0) fail(fnName + '() hat keinen Parameter "' + a.name + '". Parameter: ' + params.join(', ') + '.', a);
      out[i] = a.expr;
    });
    for(let i = 0; i < out.length; i++) if(!out[i]) fail(fnName + '(): Parameter ' + params[i] + ' fehlt.', e);
    return out;
  }
  function typeCall(e, asStmt){
    const cn = e.callee, up = cn.name.toUpperCase();
    if(!cn.quoted && !cn.hash && FN[up] && !(C.map && C.map[cn.name.toLowerCase()])){
      if(asStmt) fail('Das Ergebnis von ' + up + '(…) muss verwendet werden, z.B. #Ergebnis := ' + up + '(…);', e);
      const f = FN[up];
      const argExprs = mapArgs(e, f.p, f.vari, up);
      if(f.vari && argExprs.length < 2) fail(up + '() braucht mindestens zwei Werte.', e);
      if(!f.vari && argExprs.length !== f.p.length) fail(up + '() erwartet ' + f.p.length + ' Parameter (' + f.p.join(', ') + '), du übergibst ' + argExprs.length + '.', e);
      const ts = argExprs.map(a => typeOf(a));
      e.fn = up; e.argv = argExprs;
      if(f.num){ if(!isNum(ts[0])) fail(up + '() braucht eine Zahl, bekommt aber ' + typeNice(ts[0]) + '.', e); return realOf(ts[0]); }
      if(f.toInt){ if(!isNum(ts[0])) fail(up + '() braucht eine Zahl.', e); return Object.assign({}, T.DINT, {gen:true}); }
      if(f.bit){ if(!isIntLike(ts[0])) fail(up + '() verschiebt Bits von BYTE/WORD/DWORD oder Ganzzahlen.', e); if(ts[1].k !== 'int') fail(up + '(): N muss eine Ganzzahl sein.', e); return ts[0].lit ? T.DWORD : ts[0]; }
      return f.chk(ts, fail, e);
    }
    const cv = !cn.quoted && !cn.hash ? convType(up) : null;
    if(cv){
      if(asStmt) fail('Das Ergebnis von ' + up + '(…) muss zugewiesen werden.', e);
      const argExprs = mapArgs(e, ['IN'], false, up);
      if(argExprs.length !== 1) fail(up + '() erwartet genau einen Wert.', e);
      const at = typeOf(argExprs[0]);
      const m = assignMsg(cv.from, at);
      if(m && !(cv.from.k === 'string' && at.k === 'string')) fail(up + '() wandelt ' + typeStr(cv.from) + ' um, bekommt aber ' + typeNice(at) + '. ' + (at.n ? 'Passend wäre ' + (at.lit ? 'z.B. INT' : at.n) + '_TO_' + up.split('_TO_')[1] + '(…).' : ''), e);
      e.conv = cv; e.argv = argExprs;
      return cv.to;
    }
    if(['TON','TOF','TP','R_TRIG','F_TRIG','CTU','CTD','CTUD'].includes(up) && !cn.quoted && !(C.map && C.map[cn.name.toLowerCase()])) fail(up + ' ist ein Bausteintyp. Lege eine Instanz an (VAR Mein_Timer : ' + up + '; END_VAR) und rufe sie auf: #Mein_Timer(…);', e);
    const r = lookupVar(cn, true);
    if(r.cls === 'FC') return typeFcCall(e, r.e.unit, asStmt);
    if(r.cls === 'loc' || r.cls === 'DB' || r.cls === 'TAG'){
      const it = r.cls === 'loc' ? r.v.type : r.e.type;
      if(it.k === 'fb'){
        if(!asStmt) fail('Ein FB-Aufruf wie ' + exprName(cn) + '(…) steht als eigene Anweisung mit ";" — nicht in einem Ausdruck. Lies danach den Ausgang, z.B. ' + exprName(cn) + '.' + (it.builtin ? 'Q' : (firstOut(it) || 'Ausgang')) + '.', e);
        if(r.cls === 'loc'){ cn.acc = accOf(r.v); if(r.v.sec !== 'Static') fail('Instanzen ruft man aus dem Bereich VAR auf.', e); }
        else cn.acc = {w:'db', name: r.e.name};
        return typeFbCall(e, it, r.cls === 'loc' ? C.unit.name + '.' + r.v.name : 'DB:' + r.e.name);
      }
      fail('"' + exprName(cn) + '" ist eine Variable (' + typeStr(it) + ') und kein Baustein — sie kann nicht mit ( ) aufgerufen werden.', e);
    }
    if(r.cls === 'FB') fail('Ein FB braucht eine Instanz (sein Gedächtnis). Rufe ihn über einen Instanz-DB auf: "' + r.e.name + '_DB"(…); — oder lege im FB eine Multiinstanz an (VAR Motor1 : "' + r.e.name + '"; END_VAR) und rufe #Motor1(…); auf.', e);
    if(r.cls === 'OB') fail('Organisationsbausteine ruft das Betriebssystem auf, nicht dein Programm.', e);
    fail('"' + cn.name + '" kann nicht aufgerufen werden.', e);
  }
  function edge(to){ if(C.unit){ (callEdges[C.unit.name] = callEdges[C.unit.name] || new Set()).add(to); } }
  function checkParamArgs(e, u, params, isFC){
    const all = {};
    params.forEach(p => all[p.name.toLowerCase()] = p);
    const given = {};
    e.args.forEach(a => {
      if(!a.name) fail('Bei eigenen Bausteinen gibt man die Parameter mit Namen an, z.B. ' + (params[0] ? params[0].name : 'Wert') + ' := …', a);
      const p = all[a.name.toLowerCase()];
      if(!p){
        const sug = suggestName(a.name, params.map(p => p.name));
        fail('"' + u.name + '" hat keinen Parameter "' + a.name + '".' + (sug ? ' Meintest du "' + sug + '"?' : ' Parameter: ' + (params.map(p => p.name).join(', ') || '—') + '.'), a);
      }
      if(given[p.name]) fail('Der Parameter "' + p.name + '" wird doppelt versorgt.', a);
      given[p.name] = true;
      a.name = p.name; a.p = p;
      if(p.sec === 'Output'){
        if(a.dir !== 'out') fail('"' + p.name + '" ist ein Ausgang. Ausgänge verbindet man mit "=>": ' + p.name + ' => #Variable', a);
        const tt = checkLvalue(a.target);
        const m = assignMsg(tt, p.type);
        if(m) fail('Ausgang ' + p.name + ' → ' + exprName(a.target) + ': ' + m, a);
      } else {
        if(a.dir === 'out') fail('"' + p.name + '" ist ein ' + (p.sec === 'InOut' ? 'IN_OUT-Parameter' : 'Eingang') + ' und wird mit ":=" versorgt.', a);
        if(p.sec === 'InOut'){
          if(!['var','mem','idx'].includes(a.expr.k)) fail('Ein IN_OUT-Parameter braucht eine Variable (keinen festen Wert oder Ausdruck), weil der Baustein sie direkt verändert.', a);
          const tt = checkLvalue(a.expr, true);
          if(!(typeEq(tt, p.type) || (tt.k === 'string' && p.type.k === 'string'))) fail('IN_OUT "' + p.name + '" erwartet genau den Typ ' + typeStr(p.type) + ', übergeben wird ' + typeStr(tt) + '.', a);
          readsIn(a.expr);
        } else {
          const at = typeOf(a.expr);
          const m = assignMsg(p.type, at);
          if(m) fail('Eingang ' + p.name + ': ' + m, a);
          if(p.type.k === 'string' && at.lit && at.v.length > p.type.len) warn('STRING_TRUNC', 'Der Text \'' + at.v + '\' ist länger als ' + typeStr(p.type) + ' und wird abgeschnitten.', a, C.unit && C.unit.name);
        }
      }
    });
    params.forEach(p => {
      if(given[p.name]) return;
      if(isFC) fail('Beim Aufruf einer FC müssen alle Parameter versorgt werden — es fehlt "' + p.name + '" (' + (p.sec === 'Output' ? p.name + ' => …' : p.name + ' := …') + ').', e);
      if(p.sec === 'InOut') fail('Der IN_OUT-Parameter "' + p.name + '" muss bei jedem Aufruf versorgt werden.', e);
    });
  }
  function readsIn(){ /* Platzhalter: Lesezugriffe werden in der Flussanalyse erfasst */ }
  function typeFcCall(e, u, asStmt){
    edge(u.name);
    e.fc = u;
    if(!asStmt && u.retType.k === 'void') fail('"' + u.name + '" liefert keinen Wert (Rückgabetyp VOID). Rufe sie als eigene Anweisung auf: "' + u.name + '"(…);', e);
    checkParamArgs(e, u, u.iface.Input.concat(u.iface.InOut, u.iface.Output), true);
    return u.retType;
  }
  function typeFbCall(e, t, key){
    e.fbt = t;
    (instSites[key] = instSites[key] || []).push({unit: C.unit ? C.unit.name : '?', line: e.line, block: curBlock});
    if(C.condDepth > 0) warn('CONDITIONAL_CALL', 'Die Instanz ' + exprName(e.callee) + ' wird nur bedingt (in IF/CASE/Schleife) aufgerufen. Wird der Aufruf übersprungen, frieren ihre Ausgänge ein und Timer laufen nicht weiter. Besser: jeden Zyklus aufrufen und die Bedingung als Eingang übergeben.', e, C.unit && C.unit.name);
    if(t.builtin){
      const def = BUILTIN_FB[t.name];
      const params = Object.keys(def.inputs).map(k => ({name: k, type: T[def.inputs[k]], sec: 'Input'})).concat(Object.keys(def.outputs).map(k => ({name: k, type: T[def.outputs[k]], sec: 'Output'})));
      e.args.forEach(a => {
        if(a.dir === 'in' && !a.name) fail(t.name + ': Parameter mit Namen angeben, z.B. IN := …', a);
        const p = params.find(p => p.name.toLowerCase() === (a.name || '').toLowerCase());
        if(p && p.sec === 'Input' && p.type.k === 'time' && a.dir === 'in'){ const at = typeOf(a.expr); if(at.k !== 'time') fail(p.name + ' erwartet eine Zeit (TIME), z.B. ' + p.name + ' := T#3S.', a); }
      });
      checkParamArgs(e, {name: t.name}, params, false);
      return T.VOID;
    }
    edge(t.name);
    const u = t.unit;
    checkParamArgs(e, u, u.iface.Input.concat(u.iface.InOut, u.iface.Output), false);
    return T.VOID;
  }
  function checkLvalue(target, forInOut){
    if(target.k === 'var'){
      const r = lookupVar(target);
      if(r.cls === 'loc'){
        const v = r.v;
        if(v.sec === 'Constant') fail('"' + v.name + '" ist eine Konstante (VAR CONSTANT) und darf nicht beschrieben werden.', target);
        if(v.type.k === 'fb') fail('"' + v.name + '" ist eine Instanz. Instanzen ruft man auf: #' + v.name + '(…);', target);
        if(C.loopVars && C.loopVars[v.name]) fail('Die Zählvariable "' + v.name + '" darf innerhalb der FOR-Schleife nicht verändert werden — das übernimmt die Schleife selbst.', target);
        target.acc = accOf(v); target.vref = v; target.t = v.type;
        return v.type;
      }
      if(r.cls === 'TAG'){ target.acc = {w:'glob', name: r.e.name}; target.t = r.e.type; markGlobal(r.e.name, target); return r.e.type; }
      if(r.cls === 'DB'){
        if(r.e.instance) fail('Einen Instanz-DB kann man nicht als Ganzes beschreiben.', target);
        target.acc = {w:'db', name: r.e.name}; target.t = r.e.type; markGlobal(r.e.name, target); return r.e.type;
      }
      fail('Links von ":=" muss eine Variable stehen — "' + r.e.name + '" ist ein ' + r.e.kind + '.', target);
    }
    if(target.k === 'mem' || target.k === 'idx' || target.k === 'bit'){
      const t = typeOf(target);
      if(target.ro){
        fail('Die Werte einer Instanz (' + exprName(target) + ') kann man von aussen nur lesen. Versorge Eingänge beim Aufruf, z.B. ' + exprName(baseOf(target)) + '(' + (target.member || 'Eingang') + ' := …);', target);
      }
      if(forInOut && target.k === 'bit') fail('Ein einzelnes Bit kann nicht als IN_OUT übergeben werden.', target);
      const root = baseOf(target);
      if(root.vref && root.vref.sec === 'Constant') fail('"' + root.vref.name + '" ist eine Konstante und darf nicht verändert werden.', target);
      return t;
    }
    fail('Links von ":=" muss eine Variable stehen.', target);
  }
  function baseOf(e){ while(e.k === 'mem' || e.k === 'idx' || e.k === 'bit') e = e.base; return e; }
  function checkCond(e, what){
    const t = typeOf(e);
    if(t.k !== 'bool'){
      let msg = 'Die ' + what + '-Bedingung muss einen Wahrheitswert (BOOL) liefern, liefert aber ' + typeNice(t) + '.';
      if(e.k === 'var') msg += ' Meintest du z.B. "' + e.name + ' = 1" oder "' + e.name + ' > 0"?';
      fail(msg, e);
    }
  }
  function labelVal(l, node){
    if(l.v !== undefined) return l.v;
    const tt = typeOf(l.c);
    if(tt.constv === undefined) fail('Fallwerte in CASE müssen feste Zahlen oder Konstanten sein ("' + l.c.name + '" ist keine Konstante).', l.c);
    return l.neg ? -tt.constv : tt.constv;
  }
  function checkBlock(list){ list.forEach(checkStmt); }
  function checkStmt(s){
    switch(s.k){
      case 'nop': return;
      case 'return': if(C.isDbInit) fail('RETURN gibt es in einem Datenbaustein nicht.', s); return;
      case 'exit': case 'continue':
        if(!C.loopDepth) fail((s.k === 'exit' ? 'EXIT' : 'CONTINUE') + ' ist nur innerhalb einer Schleife (FOR/WHILE/REPEAT) erlaubt.', s);
        return;
      case 'assign': {
        const tt = checkLvalue(s.target);
        const vt = typeOf(s.expr);
        const m = assignMsg(tt, vt);
        if(m) fail('Typkonflikt bei "' + exprName(s.target) + '" (' + typeStr(tt) + '): ' + m, s.expr.line ? s.expr : s);
        if(tt.k === 'string' && vt.lit && vt.v.length > tt.len) warn('STRING_TRUNC', 'Der Text \'' + vt.v + '\' (' + vt.v.length + ' Zeichen) passt nicht in ' + exprName(s.target) + ' (' + typeStr(tt) + ') und wird abgeschnitten.', s, C.unit && C.unit.name);
        if(C.isDbInit && s.target.k !== 'var' && s.target.k !== 'idx' && s.target.k !== 'mem') fail('Im BEGIN-Teil eines DB stehen nur Startwert-Zuweisungen.', s);
        return;
      }
      case 'if':
        if(C.isDbInit) fail('Im BEGIN-Teil eines Datenbausteins stehen nur Startwerte, keine Anweisungen.', s);
        C.condDepth++;
        s.branches.forEach((b, i) => { checkCond(b.cond, i === 0 ? 'IF' : 'ELSIF'); checkBlock(b.body); });
        if(s.elseBody) checkBlock(s.elseBody);
        C.condDepth--;
        return;
      case 'case': {
        if(C.isDbInit) fail('Im BEGIN-Teil eines Datenbausteins stehen nur Startwerte.', s);
        const st = typeOf(s.sel);
        if(!isIntLike(st)) fail('Der CASE-Ausdruck muss eine Ganzzahl sein, ist aber ' + typeNice(st) + '. Für BOOL nutze IF.', s.sel);
        const seen = [];
        C.condDepth++;
        s.branches.forEach(b => {
          b.labels.forEach(l => {
            l.lo = labelVal(l.lo, b); l.hi = labelVal(l.hi, b);
            if(l.hi < l.lo) fail('Bereich ' + l.lo + '..' + l.hi + ' ist leer — der kleinere Wert muss links stehen.', b);
            seen.forEach(o => { if(l.lo <= o.hi && o.lo <= l.hi) fail('Der Fallwert ' + (l.lo === l.hi ? l.lo : l.lo + '..' + l.hi) + ' überschneidet sich mit ' + (o.lo === o.hi ? o.lo : o.lo + '..' + o.hi) + ' — jeder Wert darf nur in einem Zweig vorkommen.', b); });
            seen.push(l);
          });
          checkBlock(b.body);
        });
        if(s.elseBody) checkBlock(s.elseBody);
        C.condDepth--;
        return;
      }
      case 'for': {
        if(C.isDbInit) fail('Im BEGIN-Teil eines Datenbausteins stehen nur Startwerte.', s);
        if(!s.v.quoted && !(C.map && C.map[s.v.name.toLowerCase()]) && !reg[s.v.name.toLowerCase()]) fail('Die Zählvariable "' + s.v.name + '" muss im Baustein deklariert sein, z.B. VAR_TEMP ' + s.v.name + ' : INT; END_VAR.', s.v);
        const r = lookupVar(s.v);
        if(r.cls !== 'loc') fail('Die Zählvariable "' + s.v.name + '" muss im Baustein deklariert sein, z.B. VAR_TEMP i : INT; END_VAR.', s.v);
        const v = r.v;
        if(v.type.k !== 'int') fail('Die FOR-Zählvariable muss eine Ganzzahl (INT/DINT) sein, "' + v.name + '" ist ' + typeStr(v.type) + '.', s.v);
        if(v.sec === 'Constant' || v.sec === 'Input' && C.unit && C.unit.kind === 'FB') { if(v.sec === 'Constant') fail('Eine Konstante kann keine Zählvariable sein.', s.v); }
        s.v.acc = accOf(v); s.v.t = v.type; s.v.vref = v;
        [s.from, s.to].forEach(x => { const t = typeOf(x); if(t.k !== 'int') fail('Start- und Endwert einer FOR-Schleife müssen Ganzzahlen sein.', x); });
        if(s.by){ const bt = typeOf(s.by); if(bt.k !== 'int') fail('Die Schrittweite (BY) muss eine Ganzzahl sein.', s.by); if(bt.lit && bt.v === 0) fail('Schrittweite BY 0 würde nie enden.', s.by); }
        C.loopDepth++; C.condDepth++;
        const prev = C.loopVars[v.name]; C.loopVars[v.name] = true;
        checkBlock(s.body);
        C.loopVars[v.name] = prev; C.loopDepth--; C.condDepth--;
        return;
      }
      case 'while': if(C.isDbInit) fail('Im BEGIN-Teil eines Datenbausteins stehen nur Startwerte.', s); checkCond(s.cond, 'WHILE'); C.loopDepth++; C.condDepth++; checkBlock(s.body); C.loopDepth--; C.condDepth--; return;
      case 'repeat': if(C.isDbInit) fail('Im BEGIN-Teil eines Datenbausteins stehen nur Startwerte.', s); C.loopDepth++; C.condDepth++; checkBlock(s.body); C.loopDepth--; C.condDepth--; checkCond(s.cond, 'UNTIL'); return;
      case 'callstmt':
        if(C.isDbInit) fail('Im BEGIN-Teil eines Datenbausteins stehen nur Startwerte.', s);
        typeCall(s.call, true);
        return;
    }
  }

  /* ---- Flussanalyse: TEMP vor dem Schreiben gelesen, Ausgänge in jedem Zweig ---- */
  function flowCheck(u){
    const isFC = u.kind === 'FC';
    const tempKeys = {};
    u.iface.Temp.forEach(v => tempKeys[v.name] = true);
    const mustSet = isFC ? u.iface.Output.map(v => v.name).concat(u.retVar ? [u.retVar.name] : []) : [];
    const reported = {};
    const reportedOut = {};
    function reads(e, W){
      if(!e) return;
      switch(e.k){
        case 'var':
          if(e.acc && e.acc.w === 'tmp' && tempKeys[e.name] && !W.has(e.name) && !reported[e.name]){
            reported[e.name] = true;
            warn('TEMP_READ_BEFORE_WRITE', 'Die TEMP-Variable "#' + e.name + '" wird gelesen, bevor sie in diesem Aufruf beschrieben wurde. TEMP-Variablen vergessen ihren Wert nach jedem Aufruf' + (isFC ? ' — eine FC kann sich nichts merken. Brauchst du ein Gedächtnis, baue einen FB mit VAR (statisch).' : '. Soll der Wert erhalten bleiben, deklariere sie unter VAR (statisch).'), e, u.name);
          }
          return;
        case 'mem': case 'bit': reads(e.base, W); return;
        case 'idx': reads(e.base, W); e.index.forEach(x => reads(x, W)); return;
        case 'un': reads(e.e, W); return;
        case 'bin': reads(e.l, W); reads(e.r, W); return;
        case 'call': callReads(e, W); return;
      }
    }
    function lvIdx(t, W){ if(t.k === 'idx'){ t.index.forEach(x => reads(x, W)); lvIdx(t.base, W); } else if(t.k === 'mem' || t.k === 'bit') lvIdx(t.base, W); }
    function rootName(t){ const b = baseOf(t); return b.acc && (b.acc.w === 'tmp') ? b.name : null; }
    function partial(t){ return t.k !== 'var'; }
    function write(t, W){
      const n = rootName(t);
      if(n && partial(t) && tempKeys[n] && !W.has(n)){
        // Teil-Schreiben (Element/Bit) zählt als Schreiben — aber ein Bit in einem ungelesenen TEMP-Wort ist fragwürdig
        if(t.k === 'bit') reads(baseOf(t), W);
      }
      if(n) W.add(n);
    }
    function callReads(e, W){
      if(e.argv) e.argv.forEach(a => reads(a, W));
      e.args.forEach(a => { if(a.dir === 'in' && a.expr){ reads(a.expr, W); } });
    }
    function callWrites(e, W){
      e.args.forEach(a => {
        if(a.dir === 'out' && a.target){ lvIdx(a.target, W); write(a.target, W); }
        if(a.p && a.p.sec === 'InOut' && a.expr) write(a.expr, W);
      });
    }
    function checkOuts(W, node){
      mustSet.forEach(n => {
        if(!W.has(n) && !reportedOut[n]){
          reportedOut[n] = true;
          if(u.retVar && n === u.retVar.name) warn('RET_NOT_SET', 'Der Rückgabewert von "' + u.name + '" wird nicht in jedem Zweig gesetzt' + (node.k === 'return' ? ' (RETURN in Zeile ' + node.line + ')' : '') + '. Weise ihn in jedem Fall zu: #' + u.name + ' := …;', node, u.name);
          else warn('OUT_NOT_ALL_PATHS', 'Der Ausgang "#' + n + '" wird nicht in jedem Zweig beschrieben' + (node.k === 'return' ? ' (RETURN in Zeile ' + node.line + ')' : '') + '. In einer FC ist ein nicht beschriebener Ausgang undefiniert — setze ihn am besten gleich am Anfang auf einen Standardwert.', node, u.name);
        }
      });
    }
    const copy = W => new Set(W);
    const inter = sets => { const ok = sets.filter(Boolean); if(!ok.length) return null; const r = new Set(ok[0]); ok.slice(1).forEach(s => r.forEach(x => { if(!s.has(x)) r.delete(x); })); return r; };
    function blk(list, W){ for(const s of list){ W = st(s, W); if(W === null) return null; } return W; }
    function st(s, W){
      switch(s.k){
        case 'assign': reads(s.expr, W); lvIdx(s.target, W); write(s.target, W); return W;
        case 'if': {
          const res = [];
          let cur = W;
          s.branches.forEach(b => { reads(b.cond, cur); res.push(blk(b.body, copy(cur))); });
          res.push(s.elseBody ? blk(s.elseBody, copy(W)) : copy(W));
          return res.every(r => r === null) ? null : inter(res);
        }
        case 'case': {
          reads(s.sel, W);
          const res = s.branches.map(b => blk(b.body, copy(W)));
          res.push(s.elseBody ? blk(s.elseBody, copy(W)) : copy(W));
          return res.every(r => r === null) ? null : inter(res);
        }
        case 'for': reads(s.from, W); reads(s.to, W); reads(s.by, W); W.add(s.v.name); blk(s.body, copy(W)); return W;
        case 'while': reads(s.cond, W); blk(s.body, copy(W)); return W;
        case 'repeat': { const r = blk(s.body, copy(W)); if(r) reads(s.cond, r); return r || W; }
        case 'exit': case 'continue': return null;
        case 'return': checkOuts(W, s); return null;
        case 'callstmt': callReads(s.call, W); callWrites(s.call, W); return W;
      }
      return W;
    }
    const inputs = new Set();
    const end = blk(u.body, inputs);
    if(end) checkOuts(end, {k:'end', line: u.endTok ? u.endTok.line : u.line, col: 1});
  }

  function checkUnit(u){
    curBlock = u.block;
    C = {unit: u, map: u.map, loopDepth: 0, condDepth: 0, loopVars: {}, fix: true};
    checkBlock(u.body);
    flowCheck(u);
    ['Input','Output','InOut','Static','Temp','Constant'].forEach(sec => u.iface[sec].forEach(v => {
      if(!v.used) warn('UNUSED_VAR', 'Die Variable "' + v.name + '" (' + SEC_KW[sec] + ') ist deklariert, wird aber nie verwendet.', v, u.name);
    }));
    C = null;
  }
  units.filter(u => u.kind === 'FC' || u.kind === 'FB' || u.kind === 'OB').forEach(checkUnit);
  // DB-Startwerte im BEGIN-Teil
  units.filter(u => u.kind === 'DB' && !u.instOf).forEach(u => {
    curBlock = u.block;
    C = {unit: u, map: u.map, loopDepth: 0, condDepth: 0, loopVars: {}, isDbInit: true, fix: true};
    checkBlock(u.body);
    C = null;
  });

  /* ---- 6. Rekursion & mehrfach genutzte Instanzen ---- */
  (function(){
    const state = {};
    function dfs(n, path){
      if(state[n] === 2) return;
      if(state[n] === 1){ const u = reg[n.toLowerCase()].unit; curBlock = u.block; fail('Rekursion: ' + path.concat(n).join(' → ') + '. In einer SPS darf sich ein Baustein nicht (auch nicht indirekt) selbst aufrufen.', u); }
      state[n] = 1;
      (callEdges[n] || new Set()).forEach(m => dfs(m, path.concat(n)));
      state[n] = 2;
    }
    Object.keys(callEdges).forEach(n => dfs(n, []));
  })();
  Object.keys(instSites).forEach(k => {
    const sites = instSites[k];
    if(sites.length > 1){
      const name = k.startsWith('DB:') ? '"' + k.slice(3) + '"' : '#' + k.split('.')[1];
      curBlock = sites[1].block;
      warn('INSTANCE_TWICE', 'Die Instanz ' + name + ' wird an ' + sites.length + ' Stellen aufgerufen (Zeilen ' + sites.map(s => s.line).join(', ') + '). Jede Instanz gehört zu genau einem Gerät — sonst überschreiben sich die Aufrufe gegenseitig. Lege für jedes Gerät eine eigene Instanz an.', {line: sites[1].line, col: 1}, sites[1].unit);
    }
  });

  const obs = units.filter(u => u.kind === 'OB').sort((a, b) => a.obNumber - b.obNumber);
  return {
    reg, units, tags, dbs, warnings, callEdges,
    startupOBs: obs.filter(o => o.obNumber === 100),
    cyclicOBs: obs.filter(o => o.obNumber !== 100),
    unit: name => { const e = reg[String(name).toLowerCase()]; return e && e.unit && e.kind !== 'DB' ? e.unit : null; },
    // Hilfen für Pfade (Tests, Beobachten)
    checkPath(src, unit){
      const P = makeParser(src);
      const e = P.parseExpr();
      curBlock = 'Test';
      C = {unit: unit || null, map: unit ? pathMap(unit) : null, loopDepth: 0, condDepth: 0, loopVars: {}, fix: false};
      try{ typeOf(e, {allowInst: true}); } finally { C = null; }
      return e;
    }
  };
  function pathMap(u){
    const m = Object.assign({}, u.map);
    return m;
  }
}

/* ============================================================
   6. LAUFZEIT — Interpreter, Aufrufe, Session (OB100 → OB1)
   ============================================================ */
const MAX_ITER_DEFAULT = 200000, MAX_DEPTH = 24;
const maxIter = () => (root.SCL_MAX_ITER > 0 ? root.SCL_MAX_ITER : MAX_ITER_DEFAULT);   // Prüfungs-Server: kleiner
const BR_EXIT = 1, BR_CONT = 2, BR_RET = 3;
function exprLabel(e){
  if(!e) return '?';
  if(e.k === 'var') return e.quoted ? '"' + e.name + '"' : (e.acc && ['inst','tmp','ref','const'].includes(e.acc.w) ? '#' : '') + e.name;
  if(e.k === 'mem') return exprLabel(e.base) + '.' + e.member;
  if(e.k === 'idx') return exprLabel(e.base) + '[…]';
  if(e.k === 'bit') return exprLabel(e.base) + '.%X' + e.n;
  return '?';
}
function rtErr(msg, node, F){ return new SCLError('runtime', msg, node && node.line, node && node.col, {block: F && F.unit && F.unit.block, unit: F && F.unit && F.unit.name}); }

class Session{
  constructor(prog, opts){
    this.prog = prog; this.t = 0; this.iter = 0; this.depth = 0;
    this.trace = (opts && opts.trace) ? [] : null;
    this.tags = {}; this.dbs = {};
    Object.values(prog.tags).forEach(e => this.tags[e.name] = cloneVal(e.init));
    Object.values(prog.dbs).forEach(e => {
      this.dbs[e.name] = e.type.k === 'fb' ? newInstance(e.type) : defaultVal(e.type);
    });
    Object.values(prog.dbs).forEach(e => {
      if(e.global && e.unit && e.unit.body.length){
        const F = {unit: e.unit, self: this.dbs[e.name], tmp: {}, refs: {}, S: this};
        this.execBlock(e.unit.body, F);
      }
    });
    this.started = false;
  }
  /* ---- Plätze (lesbare/schreibbare Speicherstellen) ---- */
  place(n, F){
    switch(n.k){
      case 'var': {
        const a = n.acc;
        switch(a.w){
          case 'inst': return {o: F.inst, k: a.name};
          case 'tmp': return {o: F.tmp, k: a.name};
          case 'self': return {o: F.self, k: a.name};
          case 'ref': return F.refs[a.name];
          case 'const': return {o: {v: a.v}, k: 'v'};
          case 'glob': return {o: this.tags, k: a.name};
          case 'db': return {o: this.dbs, k: a.name};
        }
        throw rtErr('Interner Fehler: unbekannter Speicherort.', n, F);
      }
      case 'mem': { const b = this.read(this.place(n.base, F)); return {o: b, k: n.member}; }
      case 'idx': {
        const arr = this.read(this.place(n.base, F));
        const ix = n.index.map(x => this.eval(x, F));
        try{ return {o: arr.d, k: arr.flat(ix, exprLabel(n.base))}; }
        catch(err){ throw rtErr(err.message, n, F); }
      }
      case 'bit': return {bit: n.n, base: this.place(n.base, F), bt: n.bt};
    }
    throw rtErr('Hier kann nichts gespeichert werden.', n, F);
  }
  read(pl){
    if(pl.bit !== undefined){ const v = this.read(pl.base); return Math.floor((v < 0 ? v + Math.pow(2, pl.bt.bits) : v) / Math.pow(2, pl.bit)) % 2 === 1; }
    return pl.o[pl.k];
  }
  write(pl, v){
    if(pl.bit !== undefined){
      let w = this.read(pl.base); if(w < 0) w += Math.pow(2, pl.bt.bits);
      const m = Math.pow(2, pl.bit), cur = Math.floor(w / m) % 2 === 1;
      if(v && !cur) w += m; else if(!v && cur) w -= m;
      this.write(pl.base, wrapInt(w, pl.bt));
      return;
    }
    pl.o[pl.k] = v;
  }
  /* ---- Ausdrücke ---- */
  eval(e, F){
    switch(e.k){
      case 'num': case 'bool': case 'str': return e.v;
      case 'var': if(e.acc.w === 'const') return e.acc.v; return this.read(this.place(e, F));
      case 'mem': case 'idx': case 'bit': return this.read(this.place(e, F));
      case 'un': {
        const v = this.eval(e.e, F);
        if(e.op === 'NOT') return e.t.k === 'bits' ? wrapInt(~v, e.t) : !v;
        const r = -v; return (e.t.k === 'int' && !e.t.lit && !e.t.gen) ? wrapInt(r, e.t) : r;
      }
      case 'bin': return this.evalBin(e, F);
      case 'call': return this.evalCall(e, F);
    }
    throw rtErr('Interner Fehler: unbekannter Ausdruck.', e, F);
  }
  evalBin(e, F){
    const op = e.op, t = e.t;
    const l = this.eval(e.l, F), r = this.eval(e.r, F);
    if(op === 'AND' || op === 'OR' || op === 'XOR'){
      if(t.k === 'bool') return op === 'AND' ? (l && r) : op === 'OR' ? (l || r) : (l !== r);
      const a = l < 0 ? l + 4294967296 : l, b = r < 0 ? r + 4294967296 : r;
      const x = op === 'AND' ? (a & b) : op === 'OR' ? (a | b) : (a ^ b);
      return wrapInt(x >>> 0, t);
    }
    switch(op){
      case '=': return typeof l === 'number' ? Math.abs(l - r) < 1e-9 : l === r;
      case '<>': return typeof l === 'number' ? Math.abs(l - r) >= 1e-9 : l !== r;
      case '<': return l < r; case '>': return l > r;
      case '<=': return typeof l === 'number' ? l <= r + 1e-12 : l <= r;
      case '>=': return typeof l === 'number' ? l >= r - 1e-12 : l >= r;
    }
    let v;
    switch(op){
      case '+': v = l + r; break;
      case '-': v = l - r; break;
      case '*': v = l * r; break;
      case '/':
        if(r === 0) throw rtErr('Division durch 0! Prüfe vor dem Teilen, ob der Divisor ungleich 0 ist.', e, F);
        v = (t.k === 'int') ? Math.trunc(l / r) : l / r; break;
      case 'MOD':
        if(r === 0) throw rtErr('MOD 0 ist nicht definiert (Division durch 0).', e, F);
        v = l % r; break;
      case '**': v = Math.pow(l, r); break;
    }
    if(t.k === 'int' && !t.lit && !t.gen) return wrapInt(v, t);
    if(t.k === 'int') return Math.trunc(v);
    return v;
  }
  evalCall(e, F){
    if(e.fn){
      const args = e.argv.map(a => this.eval(a, F));
      try{ return FN[e.fn].run(args, e.t); }
      catch(err){ if(err instanceof SCLError) throw rtErr(err.message, e, F); throw err; }
    }
    if(e.conv) return convertVal(this.eval(e.argv[0], F), e.argv[0].t && e.argv[0].t.k !== 'int' ? e.argv[0].t : e.conv.from, e.conv.to);
    if(e.fc) return this.callFC(e.fc, e, F);
    throw rtErr('Interner Fehler: unbekannter Aufruf.', e, F);
  }
  /* ---- Bausteinaufrufe ---- */
  enter(e, F){
    if(++this.depth > MAX_DEPTH) throw rtErr('Die Aufruftiefe ist zu gross (> ' + MAX_DEPTH + ').', e, F);
  }
  traceStart(label, u, kind, depth){
    if(!this.trace) return null;
    const rec = {label, unit: u ? u.name : label, kind, depth, vars: []};
    this.trace.push(rec);
    return rec;
  }
  traceEnd(rec, u, F){
    if(!rec) return;
    const secs = ['Input','Output','InOut','Static','Temp'];
    secs.forEach(sec => (u.iface[sec] || []).forEach(v => {
      let val;
      if(sec === 'InOut'){ const pl = F.refs[v.name]; val = pl ? this.read(pl) : undefined; }
      else if(F.inst && sec !== 'Temp') val = F.inst[v.name];
      else val = F.tmp[v.name];
      rec.vars.push({name: v.name, sec, type: typeStr(v.type), value: v.type.k === 'fb' ? null : plain(val), fb: v.type.k === 'fb' ? typeStr(v.type) : null});
    }));
    if(u.retVar) rec.vars.push({name: u.retVar.name, sec: 'Return', type: typeStr(u.retVar.type), value: plain(F.tmp[u.retVar.name])});
  }
  callFC(u, e, F){
    this.enter(e, F);
    const tmp = {}, refs = {};
    u.iface.Input.concat(u.iface.Output, u.iface.Temp).forEach(v => tmp[v.name] = v.init !== undefined ? cloneVal(v.init) : defaultVal(v.type));
    if(u.retVar) tmp[u.retVar.name] = defaultVal(u.retVar.type);
    e.args.forEach(a => {
      if(!a.p) return;
      if(a.p.sec === 'Input') tmp[a.p.name] = coerce(this.eval(a.expr, F), a.p.type);
      else if(a.p.sec === 'InOut') refs[a.p.name] = this.place(a.expr, F);
    });
    const NF = {unit: u, inst: null, tmp, refs, S: this};
    const rec = this.traceStart('"' + u.name + '"', u, 'FC', this.depth);
    this.execBlock(u.body, NF);
    this.traceEnd(rec, u, NF);
    e.args.forEach(a => { if(a.p && a.p.sec === 'Output') this.write(this.place(a.target, F), coerce(tmp[a.p.name], a.target.t)); });
    this.depth--;
    return u.retVar ? tmp[u.retVar.name] : undefined;
  }
  callFB(e, F){
    this.enter(e, F);
    const inst = this.read(this.place(e.callee, F));
    const t = e.fbt;
    if(t.builtin){
      const ins = {};
      e.args.forEach(a => { if(a.dir === 'in') ins[a.name] = this.eval(a.expr, F); });
      stepFB(t.name, inst, ins, this.t);
      if(this.trace) this.trace.push({label: exprLabel(e.callee), unit: t.name, kind: 'FB', builtin: true, depth: this.depth, vars: Object.keys(BUILTIN_FB[t.name].inputs).map(k => ({name: k, sec: 'Input', type: BUILTIN_FB[t.name].inputs[k], value: inst[k]})).concat(Object.keys(BUILTIN_FB[t.name].outputs).map(k => ({name: k, sec: 'Output', type: BUILTIN_FB[t.name].outputs[k], value: inst[k]})))});
      e.args.forEach(a => { if(a.dir === 'out') this.write(this.place(a.target, F), coerce(inst[a.name], a.target.t)); });
      this.depth--;
      return;
    }
    const u = t.unit, tmp = {}, refs = {};
    u.iface.Temp.forEach(v => tmp[v.name] = defaultVal(v.type));
    e.args.forEach(a => {
      if(!a.p) return;
      if(a.p.sec === 'Input') inst[a.p.name] = coerce(this.eval(a.expr, F), a.p.type);
      else if(a.p.sec === 'InOut') refs[a.p.name] = this.place(a.expr, F);
    });
    const NF = {unit: u, inst, tmp, refs, S: this};
    const rec = this.traceStart(exprLabel(e.callee), u, 'FB', this.depth);
    this.execBlock(u.body, NF);
    this.traceEnd(rec, u, NF);
    e.args.forEach(a => { if(a.p && a.p.sec === 'Output') this.write(this.place(a.target, F), coerce(inst[a.p.name], a.target.t)); });
    this.depth--;
  }
  runOB(u){
    const tmp = {};
    u.iface.Temp.forEach(v => tmp[v.name] = defaultVal(v.type));
    const F = {unit: u, inst: null, tmp, refs: {}, S: this};
    const rec = this.traceStart(u.name + ' [OB' + u.obNumber + ']', u, 'OB', 0);
    this.execBlock(u.body, F);
    this.traceEnd(rec, u, F);
  }
  /* ---- Anweisungen ---- */
  tick(s, F){ if(++this.iter > maxIter()) throw rtErr('Endlosschleife erkannt! Nach ' + maxIter() + ' Durchläufen wurde abgebrochen. Ändert sich die Schleifenbedingung wirklich?', s, F); }
  execBlock(list, F){ for(const s of list){ const r = this.exec(s, F); if(r) return r; } return 0; }
  exec(s, F){
    switch(s.k){
      case 'nop': return 0;
      case 'assign': this.write(this.place(s.target, F), coerce(this.eval(s.expr, F), s.target.t)); return 0;
      case 'if':
        for(const b of s.branches) if(this.eval(b.cond, F)) return this.execBlock(b.body, F);
        return s.elseBody ? this.execBlock(s.elseBody, F) : 0;
      case 'case': {
        const v = this.eval(s.sel, F);
        for(const b of s.branches) if(b.labels.some(l => v >= l.lo && v <= l.hi)) return this.execBlock(b.body, F);
        return s.elseBody ? this.execBlock(s.elseBody, F) : 0;
      }
      case 'for': {
        const pl = this.place(s.v, F);
        const from = this.eval(s.from, F), to = this.eval(s.to, F), by = s.by ? this.eval(s.by, F) : 1;
        if(by === 0) throw rtErr('Schrittweite 0 in der FOR-Schleife.', s, F);
        for(let i = from; by > 0 ? i <= to : i >= to; i += by){
          this.write(pl, i);
          this.tick(s, F);
          const r = this.execBlock(s.body, F);
          if(r === BR_EXIT) break;
          if(r === BR_RET) return r;
        }
        return 0;
      }
      case 'while':
        while(this.eval(s.cond, F)){ this.tick(s, F); const r = this.execBlock(s.body, F); if(r === BR_EXIT) break; if(r === BR_RET) return r; }
        return 0;
      case 'repeat':
        do{ this.tick(s, F); const r = this.execBlock(s.body, F); if(r === BR_EXIT) break; if(r === BR_RET) return r; } while(!this.eval(s.cond, F));
        return 0;
      case 'exit': return BR_EXIT;
      case 'continue': return BR_CONT;
      case 'return': return BR_RET;
      case 'callstmt':
        if(s.call.fc) this.callFC(s.call.fc, s.call, F);
        else this.callFB(s.call, F);
        return 0;
    }
    return 0;
  }
  /* ---- Programmzyklus ---- */
  startup(){ this.iter = 0; this.prog.startupOBs.forEach(u => this.runOB(u)); this.started = true; }
  scan(dt){
    if(!this.started) this.startup();
    this.t += (dt || 0); this.iter = 0; this.depth = 0;
    if(this.trace) this.trace = [];
    this.prog.cyclicOBs.forEach(u => this.runOB(u));
  }
  /* ---- Pfadzugriff für Tests & Anzeige ---- */
  pathNode(path, unit){
    const key = (unit ? unit.name + '|' : '|') + path;
    this.prog._pathCache = this.prog._pathCache || {};
    if(!this.prog._pathCache[key]) this.prog._pathCache[key] = this.prog.checkPath(path, unit);
    return this.prog._pathCache[key];
  }
  get(path, F){ const n = this.pathNode(path, F && F.unit); return plain(n.acc && n.acc.w === 'const' ? n.acc.v : this.read(this.place(n, F || {}))); }
  set(path, v, F){ const n = this.pathNode(path, F && F.unit); this.write(this.place(n, F || {}), fromPlain(v, n.t)); }
  snapshot(){
    const o = {};
    Object.keys(this.tags).forEach(k => o[k] = plain(this.tags[k]));
    Object.keys(this.dbs).forEach(k => o[k] = plain(this.dbs[k]));
    return o;
  }
}

/* ============================================================
   7. TESTS
   ============================================================ */
function approxEqual(a, b){
  if(typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005;
  if(Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => approxEqual(x, b[i]));
  if(a && b && typeof a === 'object' && typeof b === 'object') return Object.keys(b).every(k => approxEqual(a[k], b[k]));
  return a === b;
}
function doChecks(expect, getter, error){
  return Object.keys(expect || {}).map(k => {
    let actual, perr = null;
    try{ actual = getter(k); }catch(e){ perr = e; actual = undefined; }
    return {name: k, expected: expect[k], actual, pass: !error && !perr && approxEqual(actual, expect[k]), pathError: perr && perr.message};
  });
}
function applyInputs(inputs, setter){ Object.keys(inputs || {}).forEach(k => setter(k, inputs[k])); }
function asSCL(e){ if(e instanceof SCLError) return e; throw e; }

function runProgramTests(prog, cases){
  const report = []; let ok = true;
  for(const tc of cases){
    const S = new Session(prog);
    let error = null;
    try{ S.startup(); applyInputs(tc.setup, (k, v) => S.set(k, v)); S.scan(0); }catch(e){ error = asSCL(e); }
    const checks = doChecks(tc.expect, k => S.get(k), error);
    const pass = !error && checks.every(c => c.pass);
    report.push({setup: tc.setup || {}, checks, pass, error, env: S.snapshot()});
    if(!pass) ok = false;
  }
  const f = report.find(r => !r.pass);
  return {ok, report, failedCase: f, error: f && f.error};
}
function runProgramTimed(prog, cases, opts){
  const report = []; let ok = true;
  for(const tc of cases){
    const S = new Session(prog, opts);
    const steps = []; let caseOk = true, error = null;
    try{ S.startup(); applyInputs(tc.setup, (k, v) => S.set(k, v)); }catch(e){ error = asSCL(e); }
    for(const step of tc.steps){
      if(!error){ try{ applyInputs(step.inputs, (k, v) => S.set(k, v)); S.scan(step.dt || 0); }catch(e){ error = asSCL(e); } }
      const checks = doChecks(step.expect, k => S.get(k), error);
      const pass = !error && checks.every(c => c.pass);
      steps.push({t: S.t, dt: step.dt || 0, inputs: step.inputs || {}, checks, pass, env: S.snapshot(), trace: S.trace ? S.trace.slice() : null});
      if(!pass){ caseOk = false; ok = false; break; }
    }
    report.push({setup: tc.setup || {}, steps, pass: caseOk, error});
    if(!caseOk && !(opts && opts.all)) break;
  }
  const f = report.find(r => !r.pass);
  return {ok, report, failedCase: f, error: f && f.error};
}
function runUnitTests(prog, cases, opts){
  const report = []; let ok = true;
  for(const tc of cases){
    const u = prog.unit(tc.block);
    if(!u || (u.kind !== 'FB' && u.kind !== 'FC')) throw new SCLError('semantic', 'Der Baustein "' + tc.block + '" fehlt im Projekt (oder ist kein FB/FC).', 0, 0, {block: tc.block});
    const S = new Session(prog, opts);
    const holder = {}, refs = {};
    u.iface.InOut.forEach(v => { holder[v.name] = defaultVal(v.type); refs[v.name] = {o: holder, k: v.name}; });
    const inst = u.kind === 'FB' ? newInstance({k:'fb', name: u.name, unit: u}) : null;
    let inVals = {};
    const F0 = {unit: u, inst, tmp: {}, refs, S};
    const steps = []; let caseOk = true, error = null;
    const setP = (k, v) => {
      const kv = u.map[k.toLowerCase()];
      if(u.kind === 'FC' && kv && kv.sec === 'Input'){ inVals[kv.name] = v; return; }
      S.set(k, v, F0);
    };
    try{ applyInputs(tc.setup, setP); }catch(e){ error = asSCL(e); }
    for(const step of tc.steps){
      let F = F0;
      if(!error){
        try{
          S.t += step.dt || 0; S.iter = 0; S.depth = 0;
          if(S.trace) S.trace = [];
          applyInputs(step.inputs, setP);
          const tmp = {};
          if(u.kind === 'FC'){
            u.iface.Input.concat(u.iface.Output, u.iface.Temp).forEach(v => tmp[v.name] = v.init !== undefined ? cloneVal(v.init) : defaultVal(v.type));
            if(u.retVar) tmp[u.retVar.name] = defaultVal(u.retVar.type);
            Object.keys(inVals).forEach(k => { const v = u.map[k.toLowerCase()]; tmp[v.name] = fromPlain(inVals[k], v.type); });
          } else u.iface.Temp.forEach(v => tmp[v.name] = defaultVal(v.type));
          F = {unit: u, inst, tmp, refs, S};
          const rec = S.traceStart(u.kind === 'FB' ? '#Prüfling : "' + u.name + '"' : '"' + u.name + '"', u, u.kind, 0);
          S.execBlock(u.body, F);
          S.traceEnd(rec, u, F);
        }catch(e){ error = asSCL(e); }
      }
      const checks = doChecks(step.expect, k => {
        const kk = k.toUpperCase() === 'RET' && u.retVar ? u.retVar.name : k;
        return S.get(kk, F);
      }, error);
      const pass = !error && checks.every(c => c.pass);
      const env = {};
      ['Input','Output','InOut','Static'].forEach(sec => u.iface[sec].forEach(v => { try{ env[v.name] = S.get(v.name, F); }catch(e){} }));
      if(u.retVar) env[u.retVar.name] = plain(F.tmp[u.retVar.name]);
      steps.push({t: S.t, dt: step.dt || 0, inputs: step.inputs || {}, checks, pass, env, trace: S.trace ? S.trace.slice() : null});
      if(!pass){ caseOk = false; ok = false; break; }
    }
    report.push({block: u.name, setup: tc.setup || {}, steps, pass: caseOk, error});
    if(!caseOk && !(opts && opts.all)) break;
  }
  const f = report.find(r => !r.pass);
  return {ok, report, failedCase: f, error: f && f.error};
}
// Alle Prüfungen einer Aufgabe: {unit, tests, timed}
function runAll(prog, spec, opts){
  const parts = [];
  if(spec.unit && spec.unit.length) parts.push(Object.assign({kind:'unit'}, runUnitTests(prog, spec.unit, opts)));
  if(spec.tests && spec.tests.length) parts.push(Object.assign({kind:'tests'}, runProgramTests(prog, spec.tests)));
  if(spec.timed && spec.timed.length) parts.push(Object.assign({kind:'timed'}, runProgramTimed(prog, spec.timed, opts)));
  const failed = parts.find(p => !p.ok);
  return {ok: !failed, parts, failed, warnings: prog.warnings};
}

/* ============================================================
   8. PROJEKTMODELL — Schnittstelle als Tabelle ⇄ Quelltext
   ============================================================ */
// Liest die Deklarationen eines Bausteins als Tabelle (ohne Typprüfung).
function readInterface(src){
  const units = parseSource(src).units;
  const u = units[0];
  if(!u) return null;
  const rows = [];
  (u.sections || []).forEach(s => s.vars.forEach(d => rows.push({sec: s.sec, name: d.name, type: d.typeSrc, init: d.initSrc || '', comment: d.comment || '', retain: !!s.retain})));
  return {kind: u.kind, name: u.name, ret: u.kind === 'FC' ? (u.ret.t === 'name' ? u.ret.name : '') : null, rows};
}
// Erzeugt den Deklarationsteil aus Tabellenzeilen.
function renderSections(rows, kind, indent){
  indent = indent === undefined ? '   ' : indent;
  const order = kind === 'OB' ? ['Temp','Constant'] : kind === 'FC' ? ['Input','Output','InOut','Temp','Constant'] : kind === 'DB' ? ['Static'] : ['Input','Output','InOut','Static','Temp','Constant'];
  let out = '';
  order.forEach(sec => {
    const rs = rows.filter(r => r.sec === sec && r.name);
    if(!rs.length) return;
    out += indent + SEC_KW[sec] + (sec === 'Static' && rs.some(r => r.retain) ? ' RETAIN' : '') + '\n';
    rs.forEach(r => {
      out += indent + indent + r.name + ' : ' + (r.type || 'Bool') + (r.init !== '' && r.init !== undefined && r.init !== null ? ' := ' + r.init : '') + ';' + (r.comment ? '   // ' + r.comment : '') + '\n';
    });
    out += indent + 'END_VAR\n';
  });
  return out;
}
// Ersetzt den Deklarationsteil eines Baustein-Quelltexts.
function writeInterface(src, rows){
  const u = parseSource(src).units[0];
  if(!u) throw new SCLError('syntax', 'Kein Baustein gefunden.', 1, 1);
  const secs = u.sections || [];
  const text = renderSections(rows, u.kind);
  if(secs.length){
    let a = secs[0].pos, b = secs[secs.length - 1].end;
    while(a > 0 && (src[a-1] === ' ' || src[a-1] === '\t')) a--;
    while(b < src.length && (src[b] === ' ' || src[b] === '\t')) b++;
    if(src[b] === '\n') b++;
    return src.slice(0, a) + text + src.slice(b);
  }
  let at = u.beginTok ? u.beginTok.pos : (u.endTok ? u.endTok.pos : src.length);
  while(at > 0 && (src[at-1] === ' ' || src[at-1] === '\t')) at--;
  return src.slice(0, at) + text + src.slice(at);
}
function checkTableRow(r){
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(r.name || '')) return 'Ungültiger Name "' + (r.name || '') + '" — erlaubt sind Buchstaben, Ziffern und _, am Anfang keine Ziffer.';
  try{ makeParser('TYPE "__x" STRUCT v : ' + (r.type || 'Bool') + (r.init ? ' := ' + r.init : '') + '; END_STRUCT; END_TYPE').parseUnits(); }
  catch(e){ return 'Zeile "' + r.name + '": ' + e.message; }
  return null;
}

/* ============================================================
   9. TYPNAMEN IN DEKLARATIONS-SCHREIBWEISE (Bool, Int, "UDT_x", …)
   ============================================================ */
const DECL_TYPE_CASE = {BOOL:'Bool', SINT:'SInt', USINT:'USInt', INT:'Int', UINT:'UInt', DINT:'DInt', UDINT:'UDInt', REAL:'Real', LREAL:'LReal', TIME:'Time', BYTE:'Byte', WORD:'Word', DWORD:'DWord', STRING:'String', CHAR:'Char', VOID:'Void'};
function typeStrDecl(t){
  if(!t) return '?';
  switch(t.k){
    case 'bool': case 'int': case 'real': case 'time': case 'bits': return DECL_TYPE_CASE[t.n] || t.n;
    case 'string': return t.len === 254 ? 'String' : 'String[' + t.len + ']';
    case 'array': return 'Array[' + t.dims.map(d => d.lo + '..' + d.hi).join(', ') + '] of ' + typeStrDecl(t.of);
    case 'struct': return t.udt ? '"' + t.udt + '"' : 'Struct';
    case 'fb': return t.builtin ? t.name : '"' + t.name + '"';
  }
  return '?';
}

/* ============================================================
   10. ANALYSE: verwendete Konstrukte (für "must"-Prüfungen)
   ============================================================ */
function constructsUsed(prog, blocks){
  const set = new Set();
  const want = blocks ? new Set(blocks.map(b => String(b).toLowerCase())) : null;
  const units = prog.units.filter(u => !want || want.has(String(u.block).toLowerCase()) || want.has(u.name.toLowerCase()));
  function typeWalk(t){
    if(!t) return;
    if(t.k === 'array'){ set.add('ARRAY'); if(t.dims.length > 1) set.add('ARRAY2D'); if(t.dims[0].lo !== 0) set.add('ARRAY_BOUNDS'); typeWalk(t.of); }
    else if(t.k === 'struct'){ if(t.udt) set.add('UDT_REF'); else set.add('STRUCT'); }
    else if(t.k === 'string') set.add('STRING');
    else if(t.k === 'fb'){ set.add(t.builtin ? t.name : 'FB_INSTANCE'); }
    else if(t.n) set.add(t.n);
  }
  function walkE(e){
    if(!e) return;
    switch(e.k){
      case 'bin': set.add(e.op); walkE(e.l); walkE(e.r); break;
      case 'un': set.add(e.op); walkE(e.e); break;
      case 'idx': set.add('ARRAY'); if(e.index.length > 1) set.add('ARRAY2D'); walkE(e.base); e.index.forEach(walkE); break;
      case 'mem': set.add('MEMBER'); walkE(e.base); break;
      case 'bit': set.add('BIT'); walkE(e.base); break;
      case 'str': set.add('STRING'); break;
      case 'var': if(e.acc && e.acc.w === 'db') set.add('DB_ACCESS'); if(e.acc && e.acc.w === 'glob') set.add('GLOBAL'); if(e.acc && e.acc.w === 'const') set.add('CONSTANT'); break;
      case 'call': walkCall(e); break;
    }
  }
  function walkCall(e){
    if(e.fn){ set.add(e.fn); e.argv.forEach(walkE); return; }
    if(e.conv){ set.add('CONVERT'); set.add(e.callee.name.toUpperCase()); e.argv.forEach(walkE); return; }
    if(e.fc){ set.add('FC_CALL'); if(e.args.some(a => a.p && a.p.sec === 'InOut')) set.add('IN_OUT'); }
    if(e.fbt){
      set.add('FB_CALL');
      if(e.fbt.builtin) set.add(e.fbt.name);
      else if(e.callee.acc && e.callee.acc.w === 'inst') set.add('MULTI');
      else set.add('SINGLE');
    }
    e.args.forEach(a => { if(a.dir === 'out') set.add('=>'); if(a.expr) walkE(a.expr); if(a.target) walkE(a.target); });
  }
  function walk(list){
    list.forEach(s => {
      switch(s.k){
        case 'assign': walkE(s.target); walkE(s.expr); break;
        case 'if': set.add('IF'); if(s.branches.length > 1) set.add('ELSIF'); if(s.elseBody) set.add('ELSE'); s.branches.forEach(b => { walkE(b.cond); walk(b.body); }); if(s.elseBody) walk(s.elseBody); break;
        case 'case': set.add('CASE'); if(s.branches.some(b => b.labels.some(l => l.lo !== l.hi))) set.add('RANGE'); walkE(s.sel); s.branches.forEach(b => walk(b.body)); if(s.elseBody){ set.add('ELSE'); walk(s.elseBody); } break;
        case 'for': set.add('FOR'); if(s.by) set.add('BY'); walkE(s.from); walkE(s.to); walk(s.body); break;
        case 'while': set.add('WHILE'); walkE(s.cond); walk(s.body); break;
        case 'repeat': set.add('REPEAT'); walk(s.body); walkE(s.cond); break;
        case 'exit': set.add('EXIT'); break;
        case 'continue': set.add('CONTINUE'); break;
        case 'return': set.add('RETURN'); break;
        case 'callstmt': walkCall(s.call); break;
      }
    });
  }
  units.forEach(u => {
    set.add(u.kind);
    if(u.kind === 'OB' && u.obNumber === 100) set.add('STARTUP');
    if(u.kind === 'UDT') typeWalk(prog.reg[u.name.toLowerCase()].type && {k:'struct', members: prog.reg[u.name.toLowerCase()].type.members});
    if(u.iface){
      Object.keys(u.iface).forEach(sec => { if(u.iface[sec].length){ set.add({Input:'VAR_INPUT', Output:'VAR_OUTPUT', InOut:'VAR_IN_OUT', Static:'STAT', Temp:'TEMP', Constant:'VAR_CONSTANT'}[sec]); u.iface[sec].forEach(v => { typeWalk(v.type); if(v.init !== undefined && sec !== 'Constant') set.add('INIT'); }); } });
      if(u.kind === 'FC') set.add(u.retType && u.retType.k === 'void' ? 'VOID' : 'RETVAL');
    }
    if(u.kind === 'DB' && u.instOf) set.add('INSTANCE_DB');
    walk(u.body || []);
  });
  return set;
}

/* ============================================================
   11. ÖFFENTLICHE API
   ============================================================ */
function compileProject(project){
  const prog = Compiler(project);
  prog.project = project;
  return prog;
}
function describeProgram(prog){
  return prog.units.map(u => ({
    kind: u.kind, name: u.name, block: u.block, ob: u.obNumber,
    ret: u.retType ? typeStrDecl(u.retType) : null,
    iface: u.iface ? Object.keys(u.iface).reduce((o, sec) => { o[sec] = u.iface[sec].map(v => ({name: v.name, type: typeStrDecl(v.type), init: v.init !== undefined ? plain(v.init) : undefined, comment: v.comment})); return o; }, {}) : null
  }));
}
const SCLPro = {
  VERSION: '5.0.0',
  compileProject, Session, runAll, runUnitTests, runProgramTests, runProgramTimed,
  constructsUsed, describeProgram, readInterface, writeInterface, renderSections, checkTableRow,
  tokenize, parseSource, SCLError, approxEqual,
  typeStr, typeStrDecl, plain, WARN_TEXT, BUILTIN_FB, FUNCTIONS: Object.keys(FN), TYPES: ELEM_NAMES
};
if(typeof module !== 'undefined' && module.exports){ module.exports = SCLPro; }
root.SCLPro = SCLPro;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== kop.js ==== */
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
const OUTBOX = { MOVE:2, ADD:3, SUB:3, MUL:3, DIV:3, INC:1, DEC:1, SR:2, RS:2 };   // SR/RS (FUP): (Q, R-Operand)
const CMP = ['==', '<>', '>=', '<=', '>', '<'];
const KW = new Set(['AND','OR','XOR','NOT','P','N','S','R','NETWORK','TRUE','FALSE']);

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
    else if((t.t === 'id' || (t.t === 'op' && t.v === '?')) && tk[p + 1] && tk[p + 1].v === '('){
      // Bausteinaufruf: "FB_X_DB"(In := a, Out => b) · #Multi(…) · FC_X(…, Ret_Val => r)
      p += 2; const args = [];
      if(!isOp(')')) do{
        if(args.length) p++;
        const n = next(); if(!n || (n.t !== 'id' && n.t !== 'kw')) fail('Parametername erwartet (z.B. Start := #Taster).');
        const d = peek(); if(!d || d.t !== 'op' || (d.v !== ':=' && d.v !== '=>')) fail('Nach dem Parameter ' + n.v + ' fehlt ":=" (Eingang) oder "=>" (Ausgang).');
        p++; args.push({ n: n.v, d: d.v, v: operand() });
      } while(isOp(','));
      expect(')');
      outs.push({ t:'call', target: t.v, args });
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
    case 'x': { const s = e.items.map(x => exprText(x, false)).join(' XOR '); return top ? s : '(' + s + ')'; }
  }
  return '?';
}
function outText(o){
  if(o.t === 'call') return o.target + '(' + o.args.map(a => a.n + ' ' + a.d + ' ' + a.v).join(', ') + ')';
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
  const pro = !!(opts && opts.pro);   // pro: Timer/Zähler-Instanzen deklariert der Baustein selbst
  const prog = typeof src === 'string' ? parse(src) : src;
  const out = [], fb = {}, vars = {}, lineMap = [];
  prog.networks.forEach((n, ni) => {
    const N = ni + 1; let id = 0;
    const emit = (s) => { out.push(s); lineMap.push(n.rungLine || n.line); };
    const newF = () => { const v = '_f' + N + '_' + (++id); vars[v] = false; return v; };
    const and = (a, b) => a === 'TRUE' ? b : a + ' AND ' + b;
    const when = (f, st) => f === 'TRUE' ? st : 'IF ' + f + ' THEN ' + st + ' END_IF;';
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
          const inst = need(e.inst, 'Eine ' + e.k + '-Box'); if(!pro) fb[inst] = e.k;
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
        case 'x': {   // (inF AND a) XOR (inF AND b) … = inF AND (a XOR b …)
          const fs = e.items.map(x => comp(x, inF));
          f = newF(); emit(f + ' := ' + fs.join(' XOR ') + ';'); e._f = f; return f;
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
        if(o.mode === 'S') emit(when(F, v + ' := TRUE;'));
        else if(o.mode === 'R') emit(when(F, v + ' := FALSE;'));
        else if(o.mode === 'NOT') emit(v + ' := NOT ' + F + ';');
        else emit(v + ' := ' + F + ';');
      } else if(o.t === 'call'){
        const tg = need(o.target, 'Ein Aufruf');
        const ins = o.args.filter(a => a.d === ':=').map(a => a.n + ' := ' + opnd(a.v));
        const outs2 = o.args.filter(a => a.d === '=>' && !/^ret_val$/i.test(a.n)).map(a => a.n + ' => ' + opnd(a.v));
        const ret = o.args.find(a => a.d === '=>' && /^ret_val$/i.test(a.n));
        const call = (ret ? opnd(ret.v) + ' := ' : '') + tg + '(' + ins.concat(outs2).join(', ') + ');';
        emit(when(F, call));
      } else {
        const a = o.args.map(opnd);
        if(o.k === 'SR'){ emit(when(F, a[0] + ' := TRUE;')); emit('IF ' + a[1] + ' THEN ' + a[0] + ' := FALSE; END_IF;'); return; }   // Rücksetzen dominant
        if(o.k === 'RS'){ emit('IF ' + a[1] + ' THEN ' + a[0] + ' := FALSE; END_IF;'); emit(when(F, a[0] + ' := TRUE;')); return; }   // Setzen dominant
        const body = o.k === 'MOVE' ? a[1] + ' := ' + a[0] : o.k === 'INC' ? a[0] + ' := ' + a[0] + ' + 1' : o.k === 'DEC' ? a[0] + ' := ' + a[0] + ' - 1'
          : a[2] + ' := ' + a[0] + ' ' + ({ ADD:'+', SUB:'-', MUL:'*', DIV:'/' })[o.k] + ' ' + a[1];
        emit(when(F, body + ';'));
      }
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
  const walk = e => {
    if(!e) return;
    if(e.t === 'c'){ s.add(e.edge ? 'EDGE_' + e.edge : e.neg ? 'NC' : 'NO'); }
    else if(e.t === 'cmp'){ s.add('CMP'); }
    else if(e.t === 'box'){ s.add(e.k); }
    else if(e.t === 'p'){ s.add('PARALLEL'); e.items.forEach(walk); }
    else if(e.t === 's'){ if(e.items.length > 1) s.add('SERIES'); e.items.forEach(walk); }
    else if(e.t === 'x'){ s.add('XOR'); e.items.forEach(walk); }
  };
  prog.networks.forEach(n => {
    walk(n.expr);
    n.outs.forEach(o => { if(o.t === 'coil') s.add(o.mode === 'S' ? 'SET' : o.mode === 'R' ? 'RESET' : o.mode === 'NOT' ? 'NCOIL' : 'COIL'); else if(o.t === 'call') s.add('CALL'); else s.add(o.k); });
    if(n.outs.length > 1) s.add('MULTI_OUT');
  });
  if(prog.networks.length > 1) s.add('NETWORKS');
  return s;
}
function elementCount(src){
  const prog = typeof src === 'string' ? parse(src) : src; let c = 0;
  const walk = e => { if(!e) return; if(e.t === 's' || e.t === 'p' || e.t === 'x') e.items.forEach(walk); else c++; };
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
    catch(e){ if(e instanceof KOPError){ const x = new E.SCLError('syntax', words(e.message), e.line, 1); x.net = e.net; throw x; } throw e; }
    const decl = { vars: Object.assign({}, t.initialVars || {}, tr.vars), fbTypes: Object.assign({}, t.fbTypes || {}, tr.fb), varTypes: t.varTypes || {} };
    let prog;
    try{ prog = E.compileSCL(tr.scl, decl); }
    catch(e){
      if(e && e.line){ const l = tr.lineMap[e.line - 1]; const nw = tr.prog.networks.findIndex(n => (n.rungLine || n.line) === l) + 1;
        const m = String(e.message).replace(/\b_f\d+_\d+\b/g, 'Stromfluss').replace(/Zeile \d+/g, '');
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
    const n = prog.networks.find(x => JSON.stringify(x.expr).includes('"edge"'));
    throw new KOPError('Netzwerk ' + (prog.networks.indexOf(n) + 1) + ': Flankenkontakte (P/N) brauchen einen Speicher für den alten Zustand. In ' + (sp.kind === 'FC' ? 'einer FC' : 'einem OB') + ' gibt es keinen — verwende einen FB (statische Variable) oder rufe die Flanke in einem FB auf.', n ? n.rungLine || n.line : sp.offset, 0);
  }
  const temps = Object.keys(tr.vars);
  const decl = (temps.length ? 'VAR_TEMP ' + temps.map(v => v + ' : Bool;').join(' ') + ' END_VAR ' : '') + (edges.length ? 'VAR ' + edges.map(v => v + ' : ' + tr.fb[v] + ';').join(' ') + ' END_VAR ' : '');
  const head = sp.head.replace(/^(\s*)BEGIN\b/im, (m, ws) => ws + decl + 'BEGIN');
  return { src: head + bodyLines.join('\n') + sp.foot, kop: prog, split: sp };
}
const INTERNAL = /\b_[fe]\d+_\d+\b/;
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
        r.kop.networks.forEach((n, ni) => {
          const walk = e => { if(!e) return; if(e.items) e.items.forEach(walk);
            if(e.t === 'box'){ const nm = String(e.inst).replace(/^#/, '').toLowerCase(), ty = types[nm];
              if(ty && BOXES[ty] && ty !== e.k){ const er = new P.SCLError('semantic', 'Netzwerk ' + (ni + 1) + ': ' + e.inst + ' ist als ' + ty + ' deklariert, die Box ist aber ein ' + e.k + '. Box-Typ und Instanz müssen zusammenpassen.', n.rungLine || n.line, 1); er.block = x.block; er.net = ni + 1; throw er; } } };
          walk(n.expr);
        });
      }
      return Object.assign({}, x, { src: r.src });
    });
    let prog;
    try{ prog = P.compileProject(Object.assign({}, project, { sources })); }
    catch(e){
      if(e && e.message && kopBlocks[e.block]){
        const nw = netOfLine(kopBlocks[e.block], e.line);
        e.message = words((nw ? 'Netzwerk ' + nw + ': ' : '') + String(e.message).replace(/\b_f\d+_\d+\b/g, 'Stromfluss').replace(/\b_e\d+_\d+\b/g, 'Flanke'));
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

root.KOP = { words, parse, serialize, toSCL, exprText, outText, constructs, elementCount, wrapEngine, wrapPro, splitBlock, proSource, isKopBody, KOPError, BOXES, OUTBOX, CMP };
if(typeof module !== 'undefined' && module.exports) module.exports = root.KOP;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== awl.js ==== */
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
  W.runSinglePassTests = (prog, iv, tc) => E.runSinglePassTests(prog, withVars(prog, iv), tc);
  W.runTimedTests = (prog, iv, tc) => E.runTimedTests(prog, withVars(prog, iv), tc);
  W.executeOnce = (prog, iv, s) => E.executeOnce(prog, withVars(prog, iv), s);
  W.executeTimed = (prog, iv, s, st) => E.executeTimed(prog, withVars(prog, iv), s, st);
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

/* ==== exam_core.js ==== */
(function(root){
"use strict";
/* ============================================================
   PRÜFUNGEN (Zertifikat) — gemeinsamer Kern für Browser, Validator und Worker
   ------------------------------------------------------------
   defExamTask({
     id, quest:'scl'|'kop'|'fup'|'awl', level:'grund'|'profi', ch (Kapitel), diff:1|2|3,
     params:{ MAX:[80, 90], … },                 // pro Prüfung per Seed gewählt
     title, brief: p => 'HTML', story?: p => 'HTML',
     // Grundstufe (Anweisungen gegen vorgegebene Variablen):
     vars: p => ({…}), types?: p => ({…}), fb?: p => ({Inst:'TON'}), timed?:true,
     start?: p => '', ref: p => '', must?:['IF'],
     visible: p => [[setup, expect], …] | [{setup, steps:[[dt, inputs, expect]]}],
     hidden:  p => (gleiches Format, ≥ 6 Fälle inkl. Grenzwerte),
     // Profi-Stufe (Bausteine):
     blocks: p => [{name, kind, edit:true, start, ref} | {name, kind, src}], globals?, types?, instances?, warnFree?,
     visible: p => ({unit:[…], tests:[…], timed:[…]}), hidden: p => ({…}),
     wrong: [ p => 'Code' | p => ({Block:'Quelltext'}) ]   // typische Fehler, müssen scheitern (Validator)
   })
   defExamQuestion({ id, quest, level, ch, q:'HTML', options:['…'], answer: Index })
   Der Browser bekommt nur publicItem(): nie ref, hidden oder wrong.
   ============================================================ */
const X = root.SPSQ_EXAM = root.SPSQ_EXAM || { tasks: [], questions: [] };
const QUESTS = ['scl', 'kop', 'fup', 'awl'], LEVELS = ['grund', 'profi'];
// Aufbau je Stufe (docs/PLAN_ZERTIFIKAT_PIKETT.md A.3)
const RULES = {
  grund: { tasks: 6, questions: 12, minutes: 60, mix: [2, 3, 1], chapters: [1, 10], minChapters: 5 },
  profi: { tasks: 4, questions: 10, minutes: 90, mix: [1, 2, 1], chapters: [11, 15], minChapters: 5 }
};
const WEIGHT = { tasks: 0.7, theory: 0.3 }, PASS = 0.7, DISTINCTION = 0.9, PARTIAL = 0.6;
const LIMITS = { codeBytes: 20 * 1024, maxIter: 20000 };

root.defExamTask = function(o){ o.kind = o.level === 'profi' ? 'profi' : 'grund'; o.diff = o.diff || 2; X.tasks.push(o); return o; };
root.defExamQuestion = function(o){ X.questions.push(o); return o; };

/* ---------- Zufall (deterministisch) ---------- */
function hashStr(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed)); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const langOf = q => q === 'fup' || q === 'kop' ? 'kop' : q === 'awl' ? 'awl' : 'scl';

/* ---------- Parameter ---------- */
function paramKeys(def){ return Object.keys(def.params || {}); }
function pickParams(def, r){ const p = {}; paramKeys(def).forEach(k => { const v = def.params[k]; p[k] = v[Math.floor(r() * v.length)]; }); return p; }
// alle Kombinationen (für den Validator); bei grossen Räumen n zufällige
function allParams(def, n){
  const keys = paramKeys(def); let out = [{}];
  keys.forEach(k => { const nx = []; out.forEach(o => def.params[k].forEach(v => nx.push(Object.assign({}, o, { [k]: v })))); out = nx; });
  if(n && out.length > n){ const r = rng('all:' + def.id); out = shuffle(out, r).slice(0, n); }
  return out;
}
const call = (f, p, dflt) => typeof f === 'function' ? f(p) : (f === undefined ? dflt : f);

/* ---------- Instanz einer Aufgabe ---------- */
function instantiate(def, p){
  const it = { id: def.id, quest: def.quest, level: def.level, lang: langOf(def.quest), kind: def.kind, ch: def.ch, diff: def.diff,
    title: call(def.title, p, ''), brief: call(def.brief, p, ''), story: call(def.story, p, ''), must: def.must || [], params: p };
  if(def.kind === 'grund'){
    Object.assign(it, { vars: call(def.vars, p, {}), types: call(def.types, p, {}), fb: call(def.fb, p, {}), timed: !!def.timed,
      start: call(def.start, p, ''), ref: call(def.ref, p, ''), visible: call(def.visible, p, []), hidden: call(def.hidden, p, []) });
  } else {
    const blocks = call(def.blocks, p, []).map(b => ({ name: b.name, kind: b.kind, edit: !!b.edit, start: b.start || '', src: b.src || '', ref: b.ref || '', ob: b.ob }));
    Object.assign(it, { blocks, globals: call(def.globals, p, {}), types: call(def.types, p, {}), comments: call(def.comments, p, {}), instances: call(def.instances, p, {}),
      warnFree: def.warnFree || [], visible: normPro(call(def.visible, p, {})), hidden: normPro(call(def.hidden, p, {})) });
  }
  return it;
}
function normStep(s){
  if(!Array.isArray(s)) return { dt: s.dt || 0, inputs: s.inputs || {}, expect: s.expect || {} };
  if(s.length === 3) return { dt: s[0] || 0, inputs: s[1] || {}, expect: s[2] || {} };
  return { dt: 0, inputs: s[0] || {}, expect: s[1] || {} };
}
function normPro(t){
  return { unit: (t.unit || []).map(u => ({ block: u.block, setup: u.setup || {}, steps: (u.steps || []).map(normStep) })),
    tests: (t.tests || []).map(x => Array.isArray(x) ? { setup: x[0] || {}, expect: x[1] || {} } : x),
    timed: (t.timed || []).map(tc => ({ setup: tc.setup || {}, steps: (tc.steps || []).map(normStep) })) };
}
function grundCases(it, list){
  return it.timed ? { timedTestCases: list.map(tc => ({ setup: tc.setup || {}, steps: tc.steps.map(s => Array.isArray(s) ? { dt: s[0], inputs: s[1] || {}, expect: s[2] || {} } : s) })) }
    : { testCases: list.map(x => Array.isArray(x) ? { setup: x[0] || {}, expect: x[1] || {} } : x) };
}
// Aufgabe im Format der Spiel-Aufgaben (defTask/defProTask), mit den sichtbaren oder den verdeckten Tests
function toTask(it, which){
  const base = { id: it.id, level: it.ch, title: it.title, story: it.story, briefing: it.brief, learn: '', takeaway: '', exam: true,
    lang: it.lang === 'scl' ? undefined : it.lang, mustUse: it.must || [], hint: '', hint2: '', sceneBindings: it.bind || [], refLines: 0 };
  if(it.kind === 'grund'){
    return Object.assign(base, { initialVars: it.vars, varTypes: it.types || {}, fbTypes: it.fb || {}, starterCode: it.start || '', refSolution: it.ref || '' },
      grundCases(it, (which === 'hidden' ? it.hidden : it.visible) || []));
  }
  const tests = (which === 'hidden' ? it.hidden : it.visible) || { unit: [], tests: [], timed: [] };
  return Object.assign(base, { pro: true, warnFree: it.warnFree || [], tableMode: true, starterCode: '',
    project: { blocks: it.blocks, globals: it.globals || {}, types: it.types || {}, comments: it.comments || {}, instances: it.instances || {} },
    unit: tests.unit, tests: tests.tests, timed: tests.timed, initialVars: it.globals || {}, varTypes: {}, fbTypes: {} });
}
// Was der Browser sehen darf
function publicItem(it){
  const o = { id: it.id, quest: it.quest, level: it.level, lang: it.lang, kind: it.kind, ch: it.ch, title: it.title, brief: it.brief, story: it.story, must: it.must, visible: it.visible };
  if(it.kind === 'grund') Object.assign(o, { vars: it.vars, types: it.types, fb: it.fb, timed: it.timed, start: it.start });
  else Object.assign(o, { blocks: it.blocks.map(b => b.edit ? { name: b.name, kind: b.kind, edit: true, start: b.start, ob: b.ob } : { name: b.name, kind: b.kind, src: b.src, ob: b.ob }),
    globals: it.globals, types: it.types, comments: it.comments, instances: it.instances, warnFree: it.warnFree });
  return o;
}

/* ---------- Fragen ---------- */
function questionItem(def, perm){
  const opts = call(def.options, {}, []);
  perm = perm || opts.map((_, i) => i);
  return { id: def.id, quest: def.quest, level: def.level, ch: def.ch, q: call(def.q, {}, ''), options: perm.map(i => opts[i]), perm, answer: perm.indexOf(def.answer) };
}
function publicQuestion(qi){ return { id: qi.id, ch: qi.ch, q: qi.q, options: qi.options }; }

/* ---------- Ziehung ---------- */
function pool(quest, level){ return { tasks: X.tasks.filter(t => t.quest === quest && t.level === level), questions: X.questions.filter(q => q.quest === quest && q.level === level) }; }
function draw(quest, level, seed){
  const R = RULES[level], r = rng('exam:' + seed), P = pool(quest, level);
  const chosen = [], chs = new Set();
  [1, 2, 3].forEach((d, di) => {
    let cand = shuffle(P.tasks.filter(t => t.diff === d), r);
    for(let n = 0; n < R.mix[di] && cand.length; n++){
      const fresh = cand.find(t => !chs.has(t.ch)) || cand[0];
      cand = cand.filter(t => t !== fresh); chosen.push(fresh); chs.add(fresh.ch);
    }
  });
  // zu wenig in einer Stufe → mit beliebigen auffüllen
  shuffle(P.tasks.filter(t => !chosen.includes(t)), r).slice(0, Math.max(0, R.tasks - chosen.length)).forEach(t => { chosen.push(t); chs.add(t.ch); });
  const qs = []; let qc = shuffle(P.questions, r);
  while(qs.length < R.questions && qc.length){
    const need = qc.find(q => !chs.has(q.ch)) || qc[0];
    qc = qc.filter(q => q !== need); qs.push(need); chs.add(need.ch);
  }
  chosen.sort((a, b) => a.ch - b.ch || a.diff - b.diff);
  return {
    tasks: chosen.map(t => ({ t: 'task', id: t.id, params: pickParams(t, r) })),
    questions: qs.sort((a, b) => a.ch - b.ch).map(q => { const n = call(q.options, {}, []).length; return { t: 'q', id: q.id, perm: shuffle(n ? [...Array(n).keys()] : [], r) }; })
  };
}
function taskDef(id){ return X.tasks.find(t => t.id === id); }
function questionDef(id){ return X.questions.find(q => q.id === id); }
function build(items){   // items aus draw() → vollständige Instanzen (nur Server/Validator)
  return { tasks: items.tasks.map(x => instantiate(taskDef(x.id), x.params)), questions: items.questions.map(x => questionItem(questionDef(x.id), x.perm)) };
}

/* ---------- Bewertung ---------- */
// eng = { E: (gewrappte) Grundstufen-Engine der Sprache, PRO: (gewrappte) Profi-Engine }
function errInfo(e){ return { line: e.line || 0, col: e.col || 0, message: String(e.message || e), block: e.block || null }; }
function gradeTask(it, answer, eng){
  const size = JSON.stringify(answer || '').length;
  if(size > LIMITS.codeBytes) return { points: 0, passed: 0, total: 0, ok: false, error: { line: 0, message: 'Code zu gross (max. 20 KB).' } };
  const prevIter = root.SCL_MAX_ITER; root.SCL_MAX_ITER = LIMITS.maxIter;
  try{ return it.kind === 'grund' ? gradeGrund(it, String(answer || ''), eng) : gradePro(it, answer && typeof answer === 'object' ? answer : {}, eng); }
  finally{ root.SCL_MAX_ITER = prevIter; }
}
function score(passed, total, mustOk){ if(!total) return 0; if(passed === total && mustOk) return 1; return Math.round(PARTIAL * passed / total * 1000) / 1000; }
function gradeGrund(it, code, eng){
  const t = toTask(it, 'hidden'), E = eng.E;
  if(!code.trim()) return { points: 0, passed: 0, total: 0, ok: false, error: { line: 0, message: 'Kein Code abgegeben.' } };
  let prog;
  try{ prog = E.compileSCL(code, t); }catch(e){ return { points: 0, passed: 0, total: casesOf(t).length, ok: false, error: errInfo(e) }; }
  const cases = casesOf(t); let passed = 0, rtErr = null;
  cases.forEach(c => {
    let r;
    try{ r = t.timedTestCases ? E.runTimedTests(prog, t.initialVars, [c]) : E.runSinglePassTests(prog, t.initialVars, [c]); }catch(e){ r = { ok: false, error: e }; }
    if(r.ok) passed++; else if(r.error && !rtErr) rtErr = errInfo(r.error);
  });
  let missing = [];
  if(it.must && it.must.length){ try{ const used = E.constructsUsed(prog); missing = it.must.filter(m => !used.has(m)); }catch(e){} }
  const points = score(passed, cases.length, !missing.length);
  return { points, passed, total: cases.length, ok: points === 1, missing, error: rtErr };
}
function casesOf(t){ return t.timedTestCases || t.testCases || []; }
function gradePro(it, codes, eng){
  const t = toTask(it, 'hidden'), PRO = eng.PRO;
  const editable = it.blocks.filter(b => b.edit).map(b => b.name);
  const project = { sources: it.blocks.map(b => ({ block: b.name, src: b.edit ? (codes[b.name] !== undefined ? String(codes[b.name]) : b.start) : b.src, ob: b.ob })),
    globals: it.globals, globalTypes: it.types, globalComments: it.comments, instances: it.instances };
  let prog;
  try{ prog = PRO.compileProject(project); }catch(e){ return { points: 0, passed: 0, total: 1, ok: false, error: errInfo(e) }; }
  const groups = [].concat(t.unit.map(u => ({ unit: [u], tests: [], timed: [] })), t.tests.map(x => ({ unit: [], tests: [x], timed: [] })), t.timed.map(x => ({ unit: [], tests: [], timed: [x] })));
  let passed = 0, rtErr = null;
  groups.forEach(g => {
    let r;
    try{ r = PRO.runAll(prog, g); }catch(e){ r = { ok: false, error: e }; }
    if(r.ok) passed++; else if(!rtErr){ const f = r.failed; if(f && f.error) rtErr = errInfo(f.error); else if(r.error) rtErr = errInfo(r.error); }
  });
  let missing = [], warn = [];
  try{ const used = PRO.constructsUsed(prog, editable); missing = (it.must || []).filter(m => !used.has(m)); }catch(e){}
  warn = (prog.warnings || []).filter(w => (it.warnFree || []).includes(w.code)).map(w => w.code);
  const points = score(passed, groups.length, !missing.length && !warn.length);
  return { points, passed, total: groups.length, ok: points === 1, missing, warn, error: rtErr };
}
function gradeQuestion(qi, answer){ const a = +answer; return { points: Number.isInteger(a) && a === qi.answer ? 1 : 0, ok: a === qi.answer }; }
// Gesamtpunkte aus gespeicherten Einzelpunkten
function total(built, pts){
  const tp = built.tasks.map(t => pts[t.id] || 0), qp = built.questions.map(q => pts[q.id] || 0);
  const tAvg = tp.length ? tp.reduce((a, b) => a + b, 0) / tp.length : 0, qAvg = qp.length ? qp.reduce((a, b) => a + b, 0) / qp.length : 0;
  const s = Math.round((WEIGHT.tasks * tAvg + WEIGHT.theory * qAvg) * 1000) / 1000;
  return { score: s, tasks: Math.round(tAvg * 1000) / 1000, theory: Math.round(qAvg * 1000) / 1000, passed: s >= PASS, distinction: s >= DISTINCTION };
}

// Engines je Quest (Worker/Validator: rohe Globals SCLEngine, SCLPro, KOP, AWL)
let ENG = null;
function engines(){
  if(ENG) return ENG;
  const SE = root.SCLEngine, PRO = root.SCLPro, K = root.KOP, A = root.AWL;
  const kop = K ? { E: K.wrapEngine(SE), PRO: K.wrapPro(PRO) } : null, awl = A ? { E: A.wrapEngine(SE), PRO: A.wrapPro(PRO) } : null;
  ENG = { scl: { E: SE, PRO }, kop, fup: kop, awl };
  return ENG;
}
function gradeFor(it, answer){ return gradeTask(it, answer, engines()[it.quest]); }

root.SPSQExam = { engines, gradeFor, RULES, WEIGHT, PASS, DISTINCTION, PARTIAL, LIMITS, QUESTS, LEVELS, X, rng, shuffle, hashStr, langOf,
  instantiate, allParams, pickParams, toTask, publicItem, questionItem, publicQuestion, pool, draw, build, taskDef, questionDef,
  gradeTask, gradeQuestion, total };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SPSQExam;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content/_helpers.js ==== */
(function(root){
"use strict";
/* ============================================================
   CONTENT-HELFER: kompakte Schreibweise für Aufgaben & Theorie
   ------------------------------------------------------------
   defTask({
     id, ch (Kapitel 1..10), title, story, brief, learn, take,
     vars:{...}, types:{Var:'REAL'|'TIME'|'ARRAY OF REAL'}, fb:{Inst:'TON'},
     tests:[[setup, expect], ...]              // Einzelzyklus
     timed:[{setup, steps:[[dt, inputs, expect], ...]}]   // Zeitverlauf
     ref, start (Startcode), debug, boss, man (Handbuch-ID), must:['FOR'],
     hint, hint2,
     bind:['gripperOpen=Greifer_Auf', 'displayLabel:"STUFE"', {channel, variable, map}]
   })
   ============================================================ */
const C = root.SCL_CONTENT = root.SCL_CONTENT || { tasks: [], theory: [], chapters: [], bugs: [] };
C.bugs = C.bugs || [];

function parseBind(b){
  if(typeof b === 'object') return b;
  const eq = b.indexOf('='), col = b.indexOf(':');
  if(col > -1 && (eq === -1 || col < eq)){
    return { channel: b.slice(0, col), value: JSON.parse(b.slice(col + 1)) };
  }
  return { channel: b.slice(0, eq), variable: b.slice(eq + 1) };
}
function lines(code){ return code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).length; }

root.defTask = function(o){
  const t = {
    id: o.id, level: o.ch, title: o.title, story: o.story, briefing: o.brief,
    learn: o.learn || '', takeaway: o.take || '',
    isDebug: !!o.debug, isBoss: !!o.boss,
    starterCode: o.start || '',
    initialVars: o.vars || {}, varTypes: o.types || {}, fbTypes: o.fb || {},
    refSolution: o.ref, refLines: lines(o.ref),
    manualId: o.man || null, mustUse: o.must || [],
    hint: o.hint || '', hint2: o.hint2 || '',
    sceneBindings: (o.bind || []).map(parseBind)
  };
  if(o.timed) t.timedTestCases = o.timed.map(tc => ({ setup: tc.setup || {}, steps: tc.steps.map(s => ({ dt: s[0], inputs: s[1] || {}, expect: s[2] || {} })) }));
  else t.testCases = (o.tests || []).map(x => ({ setup: x[0] || {}, expect: x[1] || {} }));
  if(o.final) t.isFinal = true;
  if(o.wrong) t._wrong = o.wrong;           // nur für den Validator
  C.tasks.push(t);
  return t;
};

/* ============================================================
   PROFI-STUFE (Kapitel 11–15): Projekt-Aufgaben
   defProTask({
     id, ch, title, story, brief, learn, take, man, hint, hint2, debug, boss, final,
     blocks:[{name, kind:'FB'|'FC'|'OB'|'UDT'|'DB', edit:true, start, ref} | {name, kind, src}],
     globals:{Name:Startwert}, types:{Name:'DINT'|'STRING[24]'|'ARRAY[1..8] OF REAL'},
     comments:{Name:'Kommentar'}, instances:{Band1_DB:'FB_Motor'},
     unit:[{block, setup, steps:[[dt, inputs, expect] | [inputs, expect]]}],   // Baustein isoliert
     tests:[[setup, expect]],  timed:[{setup, steps:[[dt, inputs, expect]]}], // ganzes Programm
     must:['FB','MULTI',…], warnFree:['TEMP_READ_BEFORE_WRITE',…], table:true|false,
     bind:[…], wrong:[{Baustein:'Quelltext'}]
   })
   ============================================================ */
function normStep(s){
  if(!Array.isArray(s)) return { dt: s.dt || 0, inputs: s.inputs || {}, expect: s.expect || {} };
  if(s.length === 3) return { dt: s[0] || 0, inputs: s[1] || {}, expect: s[2] || {} };
  return { dt: 0, inputs: s[0] || {}, expect: s[1] || {} };
}
root.defProTask = function(o){
  const blocks = o.blocks.map(b => ({ name: b.name, kind: b.kind, edit: !!b.edit, start: b.start || '', src: b.src || '', ref: b.ref || '', ob: b.ob, title: b.title || '', free: !!b.free }));
  const refLines = blocks.filter(b => b.edit).reduce((n, b) => n + lines((b.ref.split(/\bBEGIN\b/)[1] || b.ref)), 0);
  const t = {
    id: o.id, level: o.ch, pro: true, title: o.title, story: o.story, briefing: o.brief,
    learn: o.learn || '', takeaway: o.take || '',
    isDebug: !!o.debug, isBoss: !!o.boss, isFinal: !!o.final,
    manualId: o.man || null, mustUse: o.must || [], warnFree: o.warnFree || [],
    hint: o.hint || '', hint2: o.hint2 || '',
    tableMode: o.table !== undefined ? !!o.table : o.ch >= 12,
    project: { blocks, globals: o.globals || {}, types: o.types || {}, comments: o.comments || {}, instances: o.instances || {} },
    unit: (o.unit || []).map(u => ({ block: u.block, setup: u.setup || {}, steps: u.steps.map(normStep) })),
    tests: (o.tests || []).map(x => ({ setup: x[0] || {}, expect: x[1] || {} })),
    timed: (o.timed || []).map(tc => ({ setup: tc.setup || {}, steps: tc.steps.map(normStep) })),
    initialVars: o.globals || {}, varTypes: {}, fbTypes: {},
    refLines, sceneBindings: (o.bind || []).map(parseBind), starterCode: ''
  };
  if(o.wrong) t._wrong = o.wrong;
  C.tasks.push(t);
  return t;
};
// Gemeinsame Logik für App und Validator
root.ProTask = {
  editable(t){ return t.project.blocks.filter(b => b.edit).map(b => b.name); },
  startCodes(t){ const o = {}; t.project.blocks.forEach(b => { if(b.edit) o[b.name] = b.start; }); return o; },
  refCodes(t){ const o = {}; t.project.blocks.forEach(b => { if(b.edit) o[b.name] = b.ref; }); return o; },
  project(t, codes){
    return {
      sources: t.project.blocks.map(b => ({ block: b.name, src: b.edit ? ((codes && codes[b.name] !== undefined) ? codes[b.name] : b.start) : b.src, ob: b.ob })),
      globals: t.project.globals, globalTypes: t.project.types, globalComments: t.project.comments, instances: t.project.instances
    };
  },
  compile(t, codes){ return root.SCLPro.compileProject(this.project(t, codes)); },
  evaluate(t, codes, opts){
    const prog = this.compile(t, codes);
    const res = root.SCLPro.runAll(prog, { unit: t.unit, tests: t.tests, timed: t.timed }, opts);
    const used = root.SCLPro.constructsUsed(prog, this.editable(t));
    const missing = t.mustUse.filter(m => !used.has(m));
    const warnHits = prog.warnings.filter(w => t.warnFree.includes(w.code));
    return { prog, res, used, missing, warnHits, ok: res.ok && !missing.length && !warnHits.length };
  }
};

root.defChapter = function(o){ C.chapters.push(o); };
root.defTheory = function(o){ C.theory.push(o); };
/* Störungsjagd (Live-Challenge): eine laufende Anlage mit eingebautem Fehler.
   bug: [[aus der Referenz, Fehlerversion], …] — jeweils erste Fundstelle; bei Profi-Aufgaben { Baustein: [[…]] }. */
root.defBug = function(o){ C.bugs.push(o); };
root.bugCode = function(t, b){
  const apply = (src, pairs) => pairs.reduce((s, p) => { const i = s.indexOf(p[0]); if(i < 0) throw new Error('Störung ' + b.id + ': "' + p[0] + '" nicht in der Referenz'); return s.slice(0, i) + p[1] + s.slice(i + p[0].length); }, src);
  if(t.pro){ const codes = ProTask.refCodes(t); Object.keys(b.bug).forEach(k => { if(codes[k] === undefined) throw new Error('Störung ' + b.id + ': Baustein ' + k + ' fehlt'); codes[k] = apply(codes[k], b.bug[k]); }); return codes; }
  return apply(t.refSolution, b.bug);
};
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_kop/_kop.js ==== */
/* ===== KOP-QUEST: Aufgaben-Helfer =====
   defKop({ …wie defTask…, ref: KOP-Text, start: KOP-Text })
   Die Musterlösung und der Startcode sind Kontaktpläne im Textformat von kop.js.
   must-Kürzel (KOP): NO NC SERIES PARALLEL EDGE_P EDGE_N CMP COIL SET RESET NCOIL MULTI_OUT NETWORKS
                      TON TOF TP CTU CTD MOVE ADD SUB MUL DIV INC DEC */
(function(root){
// Alle Kombinationen der Eingänge als Einzelzyklus-Tests: truth(['A','B'], e => ({ Q: e.A && e.B }), {feste Werte})
root.truth = function(inputs, fn, fixed){
  const out = [];
  for(let m = 0; m < (1 << inputs.length); m++){
    const env = Object.assign({}, fixed || {});
    inputs.forEach((n, i) => { env[n] = !!(m & (1 << (inputs.length - 1 - i))); });
    out.push([env, fn(env)]);
  }
  return out;
};
// FUP Quest nutzt dasselbe Netzwerk-Modell (t.lang = 'kop' = Modell, die Darstellung wählt die Quest)
root.defFup = function(o){ return root.defKop(o); };
root.defFupPro = function(o){ return root.defKopPro(o); };
root.defKop = function(o){
  const t = root.defTask(o);
  t.lang = 'kop';
  try{ t.refLines = root.KOP.elementCount(o.ref); }catch(e){ t.refLines = 0; }
  if(!o.start) t.starterCode = 'NETWORK ' + (o.net || 'Netzwerk 1') + '\n? => ?;\n';
  return t;
};
/* ---------- Profi-Stufe (Kapitel 11–15): Bausteine mit KOP-Rumpf ----------
   kDecl({ in:'Start:Bool|Kommentar; Stopp:Bool', out:'…', inout:'…', stat:'T1:TON', temp:'…' })
   kFB(name, decl, netze) · kFC(name, rückgabe, decl, netze) · kOB(name, netze, decl) · kDB(name, 'A:Int; B:Bool') · kUDT(name, 'A:Int')
   defKopPro({ …wie defProTask… }) — Deklarationstabelle ab Kapitel 11 */
const SECS = [['in','VAR_INPUT'], ['out','VAR_OUTPUT'], ['inout','VAR_IN_OUT'], ['stat','VAR'], ['temp','VAR_TEMP'], ['const','VAR CONSTANT']];
const lines = (spec, ind) => String(spec || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const [def, com] = x.split('|'); const i = def.indexOf(':');
  return ind + def.slice(0, i).trim() + ' : ' + def.slice(i + 1).trim() + ';' + (com ? '   // ' + com.trim() : '');
}).join('\n');
root.kDecl = d => SECS.filter(([k]) => d && d[k]).map(([k, kw]) => kw + '\n' + lines(d[k], '   ') + '\nEND_VAR\n').join('');
root.kFB = (name, d, body) => 'FUNCTION_BLOCK "' + name + '"\n' + root.kDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION_BLOCK';
root.kFC = (name, ret, d, body) => 'FUNCTION "' + name + '" : ' + ret + '\n' + root.kDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION';
root.kOB = (name, body, d) => 'ORGANIZATION_BLOCK "' + name + '"\n' + root.kDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_ORGANIZATION_BLOCK';
root.kDB = (name, spec) => 'DATA_BLOCK "' + name + '"\nVAR\n' + lines(spec, '   ') + '\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
root.kUDT = (name, spec) => 'TYPE "' + name + '"\nSTRUCT\n' + lines(spec, '   ') + '\nEND_STRUCT;\nEND_TYPE';
root.defKopPro = function(o){
  const t = root.defProTask(Object.assign({ table:true }, o));
  t.lang = 'kop';
  t.refLines = t.project.blocks.filter(b => b.edit).reduce((n, b) => { const fr = root.KOP.splitBlock(b.ref); try{ return n + (fr && root.KOP.isKopBody(fr.body) ? root.KOP.elementCount(fr.body) : 0); }catch(e){ return n; } }, 0);
  return t;
};
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_awl/_awl.js ==== */
/* ===== AWL-QUEST: Aufgaben-Helfer =====
   defAwl({ …wie defTask…, ref: AWL-Text, start: AWL-Text })   — Grundstufe, Aufgaben mit lang:'awl'
   defAwlPro({ …wie defProTask… })                              — Profi, Bausteine mit AWL-Rumpf (Tabelle an)
   aFB/aFC/aOB/aDB/aUDT + aDecl({in,out,inout,stat,temp,const}) — Deklaration 'Name:Typ|Kommentar; …'
   must-Kürzel (AWL): U UN O ON X XN O_VOR KLAMMER NOT SET CLR ASSIGN S R FP FN SE SA SI SV TIMER TIMER_BIT S5T
                      ZV ZR ZS ZRESET COUNTER COUNTER_LOAD COUNTER_BIT L T TAK ARITH +I -I *I /I +R … MOD CMP CMP_I CMP_R
                      ITD DTR RND TRUNC CONVERT NEG INC DEC SPA SPB SPBN LOOP BEA BEB JUMP LABEL CALL NETWORK */
(function(root){
root.truth = root.truth || function(inputs, fn, fixed){
  const out = [];
  for(let m = 0; m < (1 << inputs.length); m++){
    const env = Object.assign({}, fixed || {});
    inputs.forEach((n, i) => { env[n] = !!(m & (1 << (inputs.length - 1 - i))); });
    out.push([env, fn(env)]);
  }
  return out;
};
root.defAwl = function(o){
  const t = root.defTask(o);
  t.lang = 'awl';
  t.refLines = root.AWL.instrCount(o.ref);
  if(!o.start) t.starterCode = '// ' + (o.net || 'Anweisungsliste') + '\n';
  return t;
};
const SECS = [['in','VAR_INPUT'], ['out','VAR_OUTPUT'], ['inout','VAR_IN_OUT'], ['stat','VAR'], ['temp','VAR_TEMP'], ['const','VAR CONSTANT']];
const lines = (spec, ind) => String(spec || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const [def, com] = x.split('|'); const i = def.indexOf(':');
  return ind + def.slice(0, i).trim() + ' : ' + def.slice(i + 1).trim() + ';' + (com ? '   // ' + com.trim() : '');
}).join('\n');
root.aDecl = d => SECS.filter(([k]) => d && d[k]).map(([k, kw]) => kw + '\n' + lines(d[k], '   ') + '\nEND_VAR\n').join('');
root.aFB = (name, d, body) => 'FUNCTION_BLOCK "' + name + '"\n' + root.aDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION_BLOCK';
root.aFC = (name, ret, d, body) => 'FUNCTION "' + name + '" : ' + ret + '\n' + root.aDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION';
root.aOB = (name, body, d) => 'ORGANIZATION_BLOCK "' + name + '"\n' + root.aDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_ORGANIZATION_BLOCK';
root.aDB = (name, spec) => 'DATA_BLOCK "' + name + '"\nVAR\n' + lines(spec, '   ') + '\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
root.aUDT = (name, spec) => 'TYPE "' + name + '"\nSTRUCT\n' + lines(spec, '   ') + '\nEND_STRUCT;\nEND_TYPE';
root.defAwlPro = function(o){
  const t = root.defProTask(Object.assign({ table:true }, o));
  t.lang = 'awl';
  t.refLines = t.project.blocks.filter(b => b.edit).reduce((n, b) => { const sp = root.AWL.splitBlock(b.ref); return n + (sp ? root.AWL.instrCount(sp.body) : 0); }, 0);
  return t;
};
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content/exam.js ==== */
/* ===== SCL QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben, nicht aus dem Spiel. Parameter werden pro Prüfung gezogen (exam_core.js).
   Grundstufe: Anweisungen gegen vorgegebene Variablen · Profi-Stufe: Bausteine. */
(function(){
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_scl_g_temperatur', quest:'scl', level:'grund', ch:4, diff:1,
  params:{ MAX:[80, 85, 90, 95] },
  title:'Temperaturwarnung',
  brief: p => 'Der Ofen meldet seine <code>Temperatur</code> (Int, °C).<br>• <code>Alarm</code> ist TRUE, wenn die Temperatur <b>über ' + p.MAX + ' °C</b> liegt.<br>• <code>Warnung</code> ist TRUE, wenn die Temperatur <b>mindestens ' + (p.MAX - 10) + ' °C</b> beträgt, aber noch kein Alarm ansteht.<br>In allen anderen Fällen sind beide FALSE.',
  vars: () => ({ Temperatur:0, Alarm:false, Warnung:false }),
  ref: p => 'IF Temperatur > ' + p.MAX + ' THEN\n  Alarm := TRUE;\n  Warnung := FALSE;\nELSIF Temperatur >= ' + (p.MAX - 10) + ' THEN\n  Alarm := FALSE;\n  Warnung := TRUE;\nELSE\n  Alarm := FALSE;\n  Warnung := FALSE;\nEND_IF;',
  visible: p => [[{Temperatur:20},{Alarm:false, Warnung:false}], [{Temperatur:p.MAX + 5},{Alarm:true, Warnung:false}]],
  hidden: p => [
    [{Temperatur:0},{Alarm:false, Warnung:false}],
    [{Temperatur:p.MAX - 11, Alarm:true, Warnung:true},{Alarm:false, Warnung:false}],
    [{Temperatur:p.MAX - 10},{Alarm:false, Warnung:true}],
    [{Temperatur:p.MAX - 1},{Alarm:false, Warnung:true}],
    [{Temperatur:p.MAX, Alarm:true},{Alarm:false, Warnung:true}],
    [{Temperatur:p.MAX + 1, Warnung:true},{Alarm:true, Warnung:false}],
    [{Temperatur:250},{Alarm:true, Warnung:false}],
    [{Temperatur:-20, Warnung:true},{Alarm:false, Warnung:false}]
  ],
  wrong:[
    p => 'Alarm := Temperatur >= ' + p.MAX + ';\nWarnung := Temperatur >= ' + (p.MAX - 10) + ' AND NOT Alarm;',
    p => 'IF Temperatur > ' + p.MAX + ' THEN\n  Alarm := TRUE;\nELSIF Temperatur >= ' + (p.MAX - 10) + ' THEN\n  Warnung := TRUE;\nEND_IF;',
    p => 'Alarm := Temperatur > ' + p.MAX + ';\nWarnung := Temperatur > ' + (p.MAX - 10) + ' AND NOT Alarm;'
  ]
});

defExamTask({ id:'x_scl_g_teilezaehler', quest:'scl', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[3, 4, 5] },
  title:'Teilezähler mit Flanke',
  brief: p => 'Jedes Teil, das in die Lichtschranke <code>Teil</code> fährt, wird <b>genau einmal</b> gezählt – auch wenn es mehrere Zyklen dort steht.<br>• Zähle mit der Instanz <code>Flanke</code> (R_TRIG) in <code>Anzahl</code> (Int) hoch.<br>• <code>Reset</code> setzt <code>Anzahl</code> auf 0.<br>• <code>Voll</code> ist TRUE, sobald <code>Anzahl</code> mindestens <b>' + p.N + '</b> ist.',
  vars: () => ({ Teil:false, Reset:false, Anzahl:0, Voll:false }), fb: () => ({ Flanke:'R_TRIG' }),
  ref: p => 'Flanke(CLK := Teil);\nIF Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Reset THEN\n  Anzahl := 0;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';',
  visible: () => [{ steps:[[0.1,{Teil:true},{Anzahl:1}],[0.1,{Teil:true},{Anzahl:1}],[0.1,{Teil:false},{Anzahl:1}],[0.1,{Teil:true},{Anzahl:2}]] }],
  hidden: p => {
    const pulses = [];
    for(let i = 1; i <= p.N + 1; i++){ pulses.push([0.1,{Teil:true},{Anzahl:i, Voll:i >= p.N}]); pulses.push([0.1,{Teil:true},{Anzahl:i}]); pulses.push([0.1,{Teil:false},{Anzahl:i, Voll:i >= p.N}]); }
    return [
      { steps:[[0.1,{},{Anzahl:0, Voll:false}]].concat(pulses) },
      { steps:[[0.1,{Teil:true},{Anzahl:1}],[0.1,{Teil:false, Reset:true},{Anzahl:0, Voll:false}],[0.1,{Reset:false},{Anzahl:0}],[0.1,{Teil:true},{Anzahl:1}]] },
      { setup:{ Anzahl:p.N - 1 }, steps:[[0.1,{},{Voll:false}],[0.1,{Teil:true},{Anzahl:p.N, Voll:true}],[0.1,{Teil:false, Reset:true},{Anzahl:0, Voll:false}]] },
      { steps:[[0.1,{Teil:true, Reset:true},{Anzahl:0}],[0.1,{Teil:true, Reset:false},{Anzahl:0}],[0.1,{Teil:false},{Anzahl:0}],[0.1,{Teil:true},{Anzahl:1}]] }
    ];
  },
  wrong:[
    p => 'IF Teil THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Reset THEN\n  Anzahl := 0;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';',
    p => 'Flanke(CLK := Teil);\nIF Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Reset THEN\n  Anzahl := 0;\nEND_IF;\nVoll := Anzahl > ' + p.N + ';',
    p => 'Flanke(CLK := Teil);\nIF Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';'
  ]
});

/* ---------- Profi-Stufe ---------- */
const BEGRENZ_HEAD = 'FUNCTION "FC_Begrenzen" : Int\nVAR_INPUT\n   Wert : Int;\n   Min : Int;\n   Max : Int;\nEND_VAR\nVAR_OUTPUT\n   Begrenzt : Bool;\nEND_VAR\n';
defExamTask({ id:'x_scl_p_begrenzen', quest:'scl', level:'profi', ch:12, diff:1,
  params:{ LO:[0, 10, 20], HI:[100, 150, 200] },
  title:'Sollwert begrenzen (FC)',
  brief: p => 'Schreibe den Rumpf der Funktion <code>FC_Begrenzen</code>: Sie liefert <code>Wert</code>, begrenzt auf den Bereich <code>Min</code> … <code>Max</code>. Der Ausgang <code>Begrenzt</code> ist TRUE, wenn der Wert abgeschnitten wurde. Der OB <code>Main</code> (🔒) begrenzt <code>"Soll"</code> auf ' + p.LO + ' … ' + p.HI + '.',
  blocks: p => [
    { name:'FC_Begrenzen', kind:'FC', edit:true, start: BEGRENZ_HEAD + 'BEGIN\n\nEND_FUNCTION',
      ref: BEGRENZ_HEAD + 'BEGIN\n   IF #Wert < #Min THEN\n      #FC_Begrenzen := #Min;\n      #Begrenzt := TRUE;\n   ELSIF #Wert > #Max THEN\n      #FC_Begrenzen := #Max;\n      #Begrenzt := TRUE;\n   ELSE\n      #FC_Begrenzen := #Wert;\n      #Begrenzt := FALSE;\n   END_IF;\nEND_FUNCTION' },
    { name:'Main', kind:'OB', src: MAIN('   "Soll_Begrenzt" := "FC_Begrenzen"(Wert := "Soll", Min := ' + p.LO + ', Max := ' + p.HI + ', Begrenzt => "Grenze_Aktiv");') }
  ],
  globals: () => ({ Soll:0, Soll_Begrenzt:0, Grenze_Aktiv:false }),
  must:['FC'], warnFree:['RET_NOT_SET', 'OUT_NOT_ALL_PATHS'],
  visible: p => ({ unit:[{ block:'FC_Begrenzen', steps:[[{Wert:50, Min:0, Max:100},{RET:50, Begrenzt:false}]] }], tests:[[{Soll:p.HI + 30},{Soll_Begrenzt:p.HI, Grenze_Aktiv:true}]] }),
  hidden: p => ({
    unit:[{ block:'FC_Begrenzen', steps:[[{Wert:-5, Min:0, Max:100},{RET:0, Begrenzt:true}],[{Wert:0, Min:0, Max:100},{RET:0, Begrenzt:false}],[{Wert:100, Min:0, Max:100},{RET:100, Begrenzt:false}],[{Wert:101, Min:0, Max:100},{RET:100, Begrenzt:true}],[{Wert:7, Min:-10, Max:10},{RET:7, Begrenzt:false}]] }],
    tests:[[{Soll:p.LO - 1},{Soll_Begrenzt:p.LO, Grenze_Aktiv:true}],[{Soll:p.LO},{Soll_Begrenzt:p.LO, Grenze_Aktiv:false}],[{Soll:p.HI},{Soll_Begrenzt:p.HI, Grenze_Aktiv:false}],[{Soll:p.HI + 1},{Soll_Begrenzt:p.HI, Grenze_Aktiv:true}],[{Soll:(p.LO + p.HI) >> 1},{Soll_Begrenzt:(p.LO + p.HI) >> 1, Grenze_Aktiv:false}]]
  }),
  wrong:[
    () => ({ FC_Begrenzen: BEGRENZ_HEAD + 'BEGIN\n   IF #Wert <= #Min THEN\n      #FC_Begrenzen := #Min;\n      #Begrenzt := TRUE;\n   ELSIF #Wert >= #Max THEN\n      #FC_Begrenzen := #Max;\n      #Begrenzt := TRUE;\n   ELSE\n      #FC_Begrenzen := #Wert;\n      #Begrenzt := FALSE;\n   END_IF;\nEND_FUNCTION' }),
    () => ({ FC_Begrenzen: BEGRENZ_HEAD + 'BEGIN\n   #FC_Begrenzen := #Wert;\n   #Begrenzt := FALSE;\n   IF #Wert > #Max THEN\n      #FC_Begrenzen := #Max;\n      #Begrenzt := TRUE;\n   END_IF;\nEND_FUNCTION' })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_scl_g_prio', quest:'scl', level:'grund', ch:2, q:'Welche Verknüpfung wird in <code>a OR b AND c</code> zuerst ausgewertet?', options:['<code>b AND c</code>', '<code>a OR b</code>', 'von links nach rechts, also <code>a OR b</code>', 'SCL meldet einen Fehler'], answer:0 });
defExamQuestion({ id:'xq_scl_g_case', quest:'scl', level:'grund', ch:5, q:'Was passiert in einer CASE-Anweisung, wenn kein Zweig zum Wert passt und kein ELSE vorhanden ist?', options:['Es wird keine Anweisung der CASE-Anweisung ausgeführt', 'Der erste Zweig wird ausgeführt', 'Die CPU geht in STOP', 'Der letzte Zweig wird ausgeführt'], answer:0 });
defExamQuestion({ id:'xq_scl_g_ton', quest:'scl', level:'grund', ch:9, q:'Ein TON mit <code>PT := T#5S</code>: <code>IN</code> ist 3 s TRUE, dann 1 Zyklus FALSE, dann wieder TRUE. Wann wird <code>Q</code> TRUE?', options:['5 s nach dem erneuten Einschalten', '2 s nach dem erneuten Einschalten', 'sofort, weil schon 3 s abgelaufen sind', 'nie'], answer:0 });
defExamQuestion({ id:'xq_scl_p_fcstat', quest:'scl', level:'profi', ch:12, q:'Warum darf eine FC keinen Bereich <code>VAR</code> (statisch) haben?', options:['Eine FC hat keinen Instanz-DB, also kein Gedächtnis zwischen Aufrufen', 'Weil statische Variablen nur in OBs erlaubt sind', 'Weil eine FC keine Eingänge haben darf', 'Das ist erlaubt'], answer:0 });
defExamQuestion({ id:'xq_scl_p_temp', quest:'scl', level:'profi', ch:11, q:'Wofür eignet sich eine <code>VAR_TEMP</code>-Variable in einem FB?', options:['Für Zwischenergebnisse, die nur während eines Aufrufs gebraucht werden', 'Für einen Zählerstand, der bis zum nächsten Zyklus erhalten bleiben muss', 'Für einen Wert, den andere Bausteine lesen sollen', 'Für die Flankenerkennung über mehrere Zyklen'], answer:0 });
})();

/* ==== content_kop/exam.js ==== */
/* ===== KOP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Seilbahn), nicht aus dem Spiel. Parameter pro Prüfung (exam_core.js). */
(function(){
const seq = steps => [{ steps }];

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_kop_g_foerderband', quest:'kop', level:'grund', ch:3, diff:1, timed:true,
  title:'Gepäckband mit Selbsthaltung',
  brief: () => 'Das Gepäckband <code>Band</code> startet mit dem Taster <code>S_Start</code> und läuft danach weiter (Selbsthaltung).<br>Es stoppt mit <code>S_Stopp</code> (Aus-Vorrang) oder sobald <code>Not_Halt_OK</code> 0 ist.',
  vars: () => ({ S_Start:false, S_Stopp:false, Not_Halt_OK:true, Band:false }),
  start: () => 'NETWORK Gepaeckband\n? => ?;\n',
  ref: () => 'NETWORK Gepaeckband\n(S_Start OR Band) AND NOT S_Stopp AND Not_Halt_OK => Band;',
  visible: () => seq([[0.1,{S_Start:true},{Band:true}],[0.1,{S_Start:false},{Band:true}],[0.1,{S_Stopp:true},{Band:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Band:false}],[0.1,{S_Start:true},{Band:true}],[0.1,{S_Start:false},{Band:true}],[0.5,{},{Band:true}],[0.1,{S_Stopp:true},{Band:false}],[0.1,{S_Stopp:false},{Band:false}]] },
    { steps:[[0.1,{S_Start:true, S_Stopp:true},{Band:false}],[0.1,{S_Stopp:false},{Band:true}],[0.1,{S_Start:false},{Band:true}]] },
    { steps:[[0.1,{S_Start:true},{Band:true}],[0.1,{S_Start:false, Not_Halt_OK:false},{Band:false}],[0.1,{Not_Halt_OK:true},{Band:false}]] },
    { steps:[[0.1,{S_Start:true, Not_Halt_OK:false},{Band:false}],[0.1,{S_Start:false, Not_Halt_OK:true},{Band:false}]] }
  ],
  wrong:[
    () => 'NETWORK Gepaeckband\nS_Start AND NOT S_Stopp AND Not_Halt_OK => Band;',
    () => 'NETWORK Gepaeckband\n(S_Start OR Band AND NOT S_Stopp) AND Not_Halt_OK => Band;',
    () => 'NETWORK Gepaeckband\n(S_Start OR Band) AND NOT S_Stopp => Band;'
  ]
});

defExamTask({ id:'x_kop_g_tuerzeit', quest:'kop', level:'grund', ch:6, diff:2, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Tür verzögert öffnen',
  brief: p => '<code>Tuer_Auf</code> wird 1, wenn <code>Kabine_da</code> <b>' + p.T + ' Sekunden</b> ununterbrochen 1 ist und <code>Sperre</code> 0 ist. Verwende einen TON mit der Instanz <code>T_Tuer</code>.',
  vars: () => ({ Kabine_da:false, Sperre:false, Tuer_Auf:false }),
  start: () => 'NETWORK Tuer\n? => ?;\n',
  ref: p => 'NETWORK Tuer\nKabine_da AND NOT Sperre AND TON(T_Tuer, T#' + p.T + 'S) => Tuer_Auf;',
  must:['TON'],
  visible: p => seq([[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T,{},{Tuer_Auf:true}]]),
  hidden: p => [
    { steps:[[0,{},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T - 0.5,{},{Tuer_Auf:false}],[0.5,{},{Tuer_Auf:true}],[2,{},{Tuer_Auf:true}],[0.1,{Kabine_da:false},{Tuer_Auf:false}]] },
    { steps:[[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T - 1,{},{Tuer_Auf:false}],[0.1,{Kabine_da:false},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T - 0.5,{},{Tuer_Auf:false}],[0.6,{},{Tuer_Auf:true}]] },
    { steps:[[0.1,{Kabine_da:true, Sperre:true},{Tuer_Auf:false}],[p.T + 1,{},{Tuer_Auf:false}],[0.1,{Sperre:false},{Tuer_Auf:false}],[p.T,{},{Tuer_Auf:true}],[0.1,{Sperre:true},{Tuer_Auf:false}]] },
    { steps:[[0.1,{},{Tuer_Auf:false}],[p.T + 2,{},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T + 0.2,{},{Tuer_Auf:true}]] }
  ],
  wrong:[
    p => 'NETWORK Tuer\nKabine_da AND NOT Sperre AND TON(T_Tuer, T#' + (p.T + 1) + 'S) => Tuer_Auf;',
    p => 'NETWORK Tuer\nKabine_da AND NOT Sperre AND TOF(T_Tuer, T#' + p.T + 'S) => Tuer_Auf;',
    p => 'NETWORK Tuer\nKabine_da AND TON(T_Tuer, T#' + p.T + 'S) => Tuer_Auf;'
  ]
});

/* ---------- Profi-Stufe ---------- */
const WIND_D = { in:'Wind:Int|Windgeschwindigkeit km/h; Grenze:Int|Abschaltgrenze; Sturm_Hand:Bool|Sturmwarnung von Hand', out:'Abschalten:Bool|Fahrt verboten' };
defExamTask({ id:'x_kop_p_wind', quest:'kop', level:'profi', ch:11, diff:1,
  params:{ G:[50, 60, 70] },
  title:'Windabschaltung als FC',
  brief: p => 'Programmiere die Funktion <code>FC_Wind</code>: <code>#Abschalten</code> ist 1, wenn <code>#Wind</code> <b>grösser als</b> <code>#Grenze</code> ist <b>oder</b> <code>#Sturm_Hand</code> 1 ist. Der OB <code>Main</code> (🔒) ruft die FC mit der Grenze ' + p.G + ' km/h auf.',
  blocks: p => [
    { name:'FC_Wind', kind:'FC', edit:true, start: kFC('FC_Wind', 'Void', WIND_D, ''), ref: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind > #Grenze] OR #Sturm_Hand => #Abschalten;') },
    { name:'Main', kind:'OB', src: kOB('Main', 'NETWORK Windwaechter\n=> "FC_Wind"(Wind := "Wind_kmh", Grenze := ' + p.G + ', Sturm_Hand := "S_Sturm", Abschalten => "Wind_Stopp");') }
  ],
  globals: () => ({ Wind_kmh:0, S_Sturm:false, Wind_Stopp:false }),
  must:['CMP'],
  visible: p => ({ tests:[[{Wind_kmh:10},{Wind_Stopp:false}], [{Wind_kmh:p.G + 20},{Wind_Stopp:true}]] }),
  hidden: p => ({
    unit:[{ block:'FC_Wind', steps:[[{Wind:30, Grenze:40, Sturm_Hand:false},{Abschalten:false}],[{Wind:40, Grenze:40, Sturm_Hand:false},{Abschalten:false}],[{Wind:41, Grenze:40, Sturm_Hand:false},{Abschalten:true}],[{Wind:0, Grenze:40, Sturm_Hand:true},{Abschalten:true}],[{Wind:90, Grenze:40, Sturm_Hand:true},{Abschalten:true}]] }],
    tests:[[{Wind_kmh:p.G},{Wind_Stopp:false}],[{Wind_kmh:p.G + 1},{Wind_Stopp:true}],[{Wind_kmh:p.G - 1},{Wind_Stopp:false}],[{Wind_kmh:5, S_Sturm:true},{Wind_Stopp:true}]]
  }),
  wrong:[
    () => ({ FC_Wind: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind >= #Grenze] OR #Sturm_Hand => #Abschalten;') }),
    () => ({ FC_Wind: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind > #Grenze] AND NOT #Sturm_Hand => #Abschalten;') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_kop_g_oeffner', quest:'kop', level:'grund', ch:2, q:'Ein Not-Halt-Taster ist als Öffner verdrahtet. Welcher Kontakt steht im KOP, damit der Antrieb nur bei <b>nicht</b> gedrücktem Not-Halt läuft?', options:['Schliesser mit der Variable des Not-Halt-Eingangs', 'Öffner mit der Variable des Not-Halt-Eingangs', 'Eine negierte Spule', 'Eine P-Flanke'], answer:0 });
defExamQuestion({ id:'xq_kop_g_tof', quest:'kop', level:'grund', ch:6, q:'Welche Zeit hält den Ausgang nach dem Abschalten des Eingangs noch eine Weile auf 1?', options:['TOF (Ausschaltverzögerung)', 'TON (Einschaltverzögerung)', 'TP (Impuls)', 'CTU (Vorwärtszähler)'], answer:0 });
defExamQuestion({ id:'xq_kop_p_fb', quest:'kop', level:'profi', ch:12, q:'Warum braucht ein Baustein mit Flanken- oder Zeitauswertung eine Instanz?', options:['Er muss Werte vom letzten Zyklus speichern – das geht nur mit Instanzdaten', 'Weil FCs keine Kontakte enthalten dürfen', 'Damit er schneller läuft', 'Weil der OB1 sonst nicht aufgerufen wird'], answer:0 });
})();

/* ==== content_fup/exam.js ==== */
/* ===== FUP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Stellwerk), nicht aus dem Spiel. Gleiches Netzwerkmodell wie KOP (kop.js). */
(function(){
const seq = steps => [{ steps }];

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_fup_g_schranke', quest:'fup', level:'grund', ch:4, diff:1, timed:true,
  title:'Schranke mit Speicherbox',
  brief: () => 'Die Anforderung <code>Zug_Meldung</code> <b>setzt</b> <code>Schranke_Zu</code>, der Taster <code>Freimeldung</code> <b>setzt zurück</b>. Kommen beide gleichzeitig, bleibt die Schranke <b>zu</b> (Setzen dominant). Verwende eine RS-Box.',
  vars: () => ({ Zug_Meldung:false, Freimeldung:false, Schranke_Zu:false }),
  start: () => 'NETWORK Schranke\n? => ?;\n',
  ref: () => 'NETWORK Schranke\nZug_Meldung => RS(Schranke_Zu, Freimeldung);',
  visible: () => seq([[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false},{Schranke_Zu:true}],[0.1,{Freimeldung:true},{Schranke_Zu:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schranke_Zu:false}],[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.5,{Zug_Meldung:false},{Schranke_Zu:true}],[0.1,{Freimeldung:true},{Schranke_Zu:false}],[0.1,{Freimeldung:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Zug_Meldung:true, Freimeldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Freimeldung:true},{Schranke_Zu:false}],[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false, Freimeldung:false},{Schranke_Zu:true}]] },
    { steps:[[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false, Freimeldung:true},{Schranke_Zu:false}],[0.1,{Freimeldung:false},{Schranke_Zu:false}]] }
  ],
  wrong:[
    () => 'NETWORK Schranke\nZug_Meldung => SR(Schranke_Zu, Freimeldung);',
    () => 'NETWORK Schranke\nZug_Meldung AND NOT Freimeldung => Schranke_Zu;',
    () => 'NETWORK Schranke\nZug_Meldung => S Schranke_Zu;'
  ]
});

defExamTask({ id:'x_fup_g_achszaehler', quest:'fup', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[4, 6, 8] },
  title:'Achsen zählen',
  brief: p => 'Der Achszähler <code>Achse</code> liefert pro Achse einen Impuls. Nach <b>' + p.N + '</b> Achsen meldet <code>Gleis_Frei_Pruefen</code> 1. <code>Grundstellung</code> setzt den Zähler zurück. Verwende eine CTU-Box mit der Instanz <code>Z_Achsen</code>.',
  vars: () => ({ Achse:false, Grundstellung:false, Gleis_Frei_Pruefen:false }),
  start: () => 'NETWORK Achsen\n? => ?;\n',
  ref: p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + p.N + ', R:=Grundstellung) => Gleis_Frei_Pruefen;',
  must:['CTU'],
  visible: () => seq([[0.1,{Achse:true},{Gleis_Frei_Pruefen:false}],[0.1,{Achse:false},{Gleis_Frei_Pruefen:false}]]),
  hidden: p => {
    const st = [];
    for(let i = 1; i <= p.N; i++){ st.push([0.1,{Achse:true},{Gleis_Frei_Pruefen:i >= p.N}]); st.push([0.1,{Achse:false},{}]); }
    return [
      { steps: st },
      { steps: st.slice(0, 2 * p.N - 2).concat([[0.1,{Grundstellung:true},{Gleis_Frei_Pruefen:false}],[0.1,{Grundstellung:false},{}],[0.1,{Achse:true},{Gleis_Frei_Pruefen:false}]]) },
      { steps: st.concat([[0.1,{Grundstellung:true},{Gleis_Frei_Pruefen:false}],[0.1,{Grundstellung:false, Achse:true},{Gleis_Frei_Pruefen:false}]]) },
      { steps:[[0.1,{Achse:true},{}],[0.1,{Achse:true},{}],[0.1,{Achse:true},{Gleis_Frei_Pruefen:p.N <= 1}],[0.1,{Achse:false},{}]] }
    ];
  },
  wrong:[
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + (p.N + 1) + ', R:=Grundstellung) => Gleis_Frei_Pruefen;',
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + p.N + ') => Gleis_Frei_Pruefen;',
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + (p.N - 1) + ', R:=Grundstellung) => Gleis_Frei_Pruefen;'
  ]
});

/* ---------- Profi-Stufe ---------- */
const SIG_D = { in:'Fahrstrasse:Bool|Fahrstrasse festgelegt; Gleis_Frei:Bool|Gleisfreimeldung; Stoerung:Bool|Signalstörung', out:'Fahrt:Bool|Signal zeigt Fahrt' };
defExamTask({ id:'x_fup_p_signal', quest:'fup', level:'profi', ch:11, diff:1,
  title:'Signal-FC',
  brief: () => 'Programmiere die Funktion <code>FC_Signal</code>: <code>#Fahrt</code> ist 1, wenn <code>#Fahrstrasse</code> <b>und</b> <code>#Gleis_Frei</code> 1 sind und <b>keine</b> <code>#Stoerung</code> ansteht. Der OB <code>Main</code> (🔒) ruft die FC für das Einfahrsignal auf.',
  blocks: () => [
    { name:'FC_Signal', kind:'FC', edit:true, start: kFC('FC_Signal', 'Void', SIG_D, ''), ref: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei AND NOT #Stoerung => #Fahrt;') },
    { name:'Main', kind:'OB', src: kOB('Main', 'NETWORK Einfahrsignal\n=> "FC_Signal"(Fahrstrasse := "FS_Fest", Gleis_Frei := "Gleis1_frei", Stoerung := "Sig_Stoer", Fahrt => "Signal_Fahrt");') }
  ],
  globals: () => ({ FS_Fest:false, Gleis1_frei:false, Sig_Stoer:false, Signal_Fahrt:false }),
  must:['SERIES'],
  visible: () => ({ tests:[[{FS_Fest:true, Gleis1_frei:true},{Signal_Fahrt:true}]] }),
  hidden: () => ({
    unit:[{ block:'FC_Signal', steps: truth(['Fahrstrasse','Gleis_Frei','Stoerung'], e => ({ Fahrt: e.Fahrstrasse && e.Gleis_Frei && !e.Stoerung })) }],
    tests:[[{FS_Fest:true, Gleis1_frei:true, Sig_Stoer:true},{Signal_Fahrt:false}],[{FS_Fest:false, Gleis1_frei:true},{Signal_Fahrt:false}]]
  }),
  wrong:[
    () => ({ FC_Signal: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei => #Fahrt;') }),
    () => ({ FC_Signal: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n(#Fahrstrasse OR #Gleis_Frei) AND NOT #Stoerung => #Fahrt;') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_fup_g_xor', quest:'fup', level:'grund', ch:2, q:'Wann liefert eine X-Box (XOR) mit zwei Eingängen eine 1?', options:['Wenn genau ein Eingang 1 ist', 'Wenn beide Eingänge 1 sind', 'Wenn mindestens ein Eingang 1 ist', 'Wenn beide Eingänge 0 sind'], answer:0 });
defExamQuestion({ id:'xq_fup_g_sr', quest:'fup', level:'grund', ch:4, q:'In einer SR-Box liegen S und R gleichzeitig an. Welchen Zustand hat Q?', options:['0 – Rücksetzen ist dominant', '1 – Setzen ist dominant', 'Q wechselt jeden Zyklus', 'Q behält den alten Wert'], answer:0 });
defExamQuestion({ id:'xq_fup_p_multi', quest:'fup', level:'profi', ch:12, q:'Was ist eine Multiinstanz?', options:['Eine FB-Instanz, die in den statischen Daten eines anderen FB liegt', 'Ein FB, der mehrere OBs aufruft', 'Eine FC mit mehreren Rückgabewerten', 'Ein Datenbaustein mit mehreren Arrays'], answer:0 });
})();

/* ==== content_awl/exam.js ==== */
/* ===== AWL QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Walzwerk), nicht aus dem Spiel. AWL wird zeilentreu nach SCL übersetzt (awl.js). */
(function(){
const seq = steps => [{ steps }];

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_awl_g_pumpe', quest:'awl', level:'grund', ch:3, diff:1, timed:true,
  title:'Kühlwasserpumpe speichern',
  brief: () => '<code>S_Ein</code> <b>setzt</b> die <code>Pumpe</code>, <code>S_Aus</code> oder ein fehlender Wasserdruck (<code>Druck_OK</code> = 0) <b>setzen sie zurück</b>. Rücksetzen hat Vorrang (steht zuletzt).',
  vars: () => ({ S_Ein:false, S_Aus:false, Druck_OK:true, Pumpe:false }),
  start: () => '// Kühlwasserpumpe\n',
  ref: () => 'U  S_Ein\nS  Pumpe\nO  S_Aus\nON Druck_OK\nR  Pumpe',
  visible: () => seq([[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false},{Pumpe:true}],[0.1,{S_Aus:true},{Pumpe:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Pumpe:false}],[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false},{Pumpe:true}],[0.1,{S_Aus:true},{Pumpe:false}],[0.1,{S_Aus:false},{Pumpe:false}]] },
    { steps:[[0.1,{S_Ein:true, S_Aus:true},{Pumpe:false}],[0.1,{S_Aus:false},{Pumpe:true}]] },
    { steps:[[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false, Druck_OK:false},{Pumpe:false}],[0.1,{Druck_OK:true},{Pumpe:false}]] },
    { steps:[[0.1,{S_Ein:true, Druck_OK:false},{Pumpe:false}],[0.1,{Druck_OK:true},{Pumpe:true}]] }
  ],
  wrong:[
    () => 'U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe',
    () => 'O  S_Aus\nON Druck_OK\nR  Pumpe\nU  S_Ein\nS  Pumpe',
    () => 'U  S_Ein\n=  Pumpe'
  ]
});

defExamTask({ id:'x_awl_g_temperatur', quest:'awl', level:'grund', ch:9, diff:2,
  params:{ LO:[1050, 1080, 1100], HI:[1200, 1250] },
  title:'Walztemperatur im Fenster',
  brief: p => '<code>Walzen_Frei</code> ist 1, wenn <code>Temp</code> (Int, °C) im Bereich <b>' + p.LO + ' … ' + p.HI + '</b> liegt (Grenzen eingeschlossen). Sonst 0.',
  vars: () => ({ Temp:0, Walzen_Frei:false }),
  start: () => '// Temperaturfenster\n',
  ref: p => 'L  Temp\nL  ' + p.LO + '\n>=I\nU(\nL  Temp\nL  ' + p.HI + '\n<=I\n)\n=  Walzen_Frei',
  must:['CMP_I'],
  visible: p => [[{Temp:(p.LO + p.HI) >> 1},{Walzen_Frei:true}], [{Temp:800},{Walzen_Frei:false}]],
  hidden: p => [[{Temp:p.LO - 1},{Walzen_Frei:false}],[{Temp:p.LO},{Walzen_Frei:true}],[{Temp:p.HI},{Walzen_Frei:true}],[{Temp:p.HI + 1},{Walzen_Frei:false}],[{Temp:0, Walzen_Frei:true},{Walzen_Frei:false}],[{Temp:1500},{Walzen_Frei:false}]],
  wrong:[
    p => 'L  Temp\nL  ' + p.LO + '\n>I\nU(\nL  Temp\nL  ' + p.HI + '\n<I\n)\n=  Walzen_Frei',
    p => 'L  Temp\nL  ' + p.LO + '\n>=I\nO(\nL  Temp\nL  ' + p.HI + '\n<=I\n)\n=  Walzen_Frei',
    p => 'L  Temp\nL  ' + p.LO + '\n>=I\n=  Walzen_Frei'
  ]
});

/* ---------- Profi-Stufe ---------- */
const MIN_D = { in:'A:Int|Wert 1; B:Int|Wert 2' };
defExamTask({ id:'x_awl_p_minimum', quest:'awl', level:'profi', ch:11, diff:1,
  title:'Kleinster Walzspalt (FC)',
  brief: () => 'Programmiere die Funktion <code>FC_Min</code> mit Rückgabewert (Int): Sie liefert den <b>kleineren</b> der beiden Eingänge <code>#A</code> und <code>#B</code>. Den Rückgabewert schreibst du mit <code>T #RET_VAL</code>. Der OB <code>Main</code> (🔒) bestimmt den kleineren Walzspalt der beiden Gerüste.',
  blocks: () => [
    { name:'FC_Min', kind:'FC', edit:true, start: aFC('FC_Min', 'Int', MIN_D, ''), ref: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n<I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') },
    { name:'Main', kind:'OB', src: aOB('Main', 'CALL "FC_Min"\n   A := "Spalt_1"\n   B := "Spalt_2"\n   RET_VAL := "Spalt_Min"') }
  ],
  globals: () => ({ Spalt_1:0, Spalt_2:0, Spalt_Min:0 }),
  must:['CMP_I'],
  visible: () => ({ tests:[[{Spalt_1:30, Spalt_2:40},{Spalt_Min:30}]] }),
  hidden: () => ({
    unit:[{ block:'FC_Min', steps:[[{A:5, B:9},{RET:5}],[{A:9, B:5},{RET:5}],[{A:7, B:7},{RET:7}],[{A:-3, B:2},{RET:-3}],[{A:0, B:-1},{RET:-1}]] }],
    tests:[[{Spalt_1:80, Spalt_2:12},{Spalt_Min:12}],[{Spalt_1:25, Spalt_2:25},{Spalt_Min:25}]]
  }),
  wrong:[
    () => ({ FC_Min: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n>I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') }),
    () => ({ FC_Min: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nT  #RET_VAL') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_awl_g_erstabfrage', quest:'awl', level:'grund', ch:1, q:'Was bewirkt die Erstabfrage nach einer Zuweisung <code>=</code>?', options:['Die nächste Abfrage beginnt ein neues VKE', 'Das VKE wird gelöscht und bleibt 0', 'AKKU1 wird auf 0 gesetzt', 'Der Baustein wird beendet'], answer:0 });
defExamQuestion({ id:'xq_awl_g_akku', quest:'awl', level:'grund', ch:7, q:'Nach <code>L 5</code> und <code>L 8</code>: Was steht in AKKU1 und AKKU2?', options:['AKKU1 = 8, AKKU2 = 5', 'AKKU1 = 5, AKKU2 = 8', 'AKKU1 = 13, AKKU2 = 0', 'AKKU1 = 8, AKKU2 = 0'], answer:0 });
defExamQuestion({ id:'xq_awl_p_1200', quest:'awl', level:'profi', ch:15, q:'Ein AWL-Programm einer S7-300 soll auf eine S7-1200 migriert werden. Was ist richtig?', options:['Die S7-1200 kann kein AWL – das Programm muss z. B. nach SCL oder KOP umgeschrieben werden', 'AWL läuft auf der S7-1200 unverändert', 'Man muss nur die Adressen anpassen', 'Die S7-1200 übersetzt AWL automatisch beim Laden'], answer:0 });
})();

export const Exam = globalThis.SPSQExam;
export const QUEST_TASKS = {"scl":[{"id":"r1t1","ch":1,"final":false},{"id":"c1_arm","ch":1,"final":false},{"id":"r1t3","ch":1,"final":false},{"id":"c1_band","ch":1,"final":false},{"id":"c1_copy","ch":1,"final":false},{"id":"c1_semi","ch":1,"final":false},{"id":"c1_real","ch":1,"final":false},{"id":"c1_calc","ch":1,"final":false},{"id":"c1_typ","ch":1,"final":false},{"id":"c1_boss","ch":1,"final":false},{"id":"r1t9","ch":2,"final":false},{"id":"r2t3","ch":2,"final":false},{"id":"c2_not","ch":2,"final":false},{"id":"r2t4","ch":2,"final":false},{"id":"c2_xor","ch":2,"final":false},{"id":"r2t6","ch":2,"final":false},{"id":"c2_klammer","ch":2,"final":false},{"id":"c2_klammer_dbg","ch":2,"final":false},{"id":"c2_latch","ch":2,"final":false},{"id":"r2t10","ch":2,"final":false},{"id":"c3_temp","ch":3,"final":false},{"id":"c3_fenster","ch":3,"final":false},{"id":"c3_summe","ch":3,"final":false},{"id":"c3_mod","ch":3,"final":false},{"id":"c3_mittel","ch":3,"final":false},{"id":"c3_skal","ch":3,"final":false},{"id":"c3_ungleich","ch":3,"final":false},{"id":"c3_limit","ch":3,"final":false},{"id":"c3_abs","ch":3,"final":false},{"id":"c3_boss","ch":3,"final":false},{"id":"r1t5","ch":4,"final":false},{"id":"c4_ohne_else","ch":4,"final":false},{"id":"r1t10","ch":4,"final":false},{"id":"c4_elsif","ch":4,"final":false},{"id":"c4_reihenfolge","ch":4,"final":false},{"id":"c4_verschachtelt","ch":4,"final":false},{"id":"c4_hysterese","ch":4,"final":false},{"id":"c4_endif","ch":4,"final":false},{"id":"c4_farbweiche","ch":4,"final":false},{"id":"c4_boss","ch":4,"final":false},{"id":"r3t2","ch":5,"final":false},{"id":"r3t4","ch":5,"final":false},{"id":"r3t5","ch":5,"final":false},{"id":"c5_liste","ch":5,"final":false},{"id":"r3t7","ch":5,"final":false},{"id":"c5_else_fehlt","ch":5,"final":false},{"id":"c5_positionen","ch":5,"final":false},{"id":"c5_betrieb","ch":5,"final":false},{"id":"c5_umbau","ch":5,"final":false},{"id":"r3t10","ch":5,"final":false},{"id":"r4t1","ch":6,"final":false},{"id":"c6_lesen","ch":6,"final":false},{"id":"r4t3","ch":6,"final":false},{"id":"c6_summe","ch":6,"final":false},{"id":"c6_grenze","ch":6,"final":false},{"id":"c6_zaehlen","ch":6,"final":false},{"id":"r4t5","ch":6,"final":false},{"id":"c6_mittel","ch":6,"final":false},{"id":"c6_schieben","ch":6,"final":false},{"id":"r4t10","ch":6,"final":false},{"id":"c7_kisten","ch":7,"final":false},{"id":"r4t9","ch":7,"final":false},{"id":"c7_suche","ch":7,"final":false},{"id":"c7_repeat","ch":7,"final":false},{"id":"c7_continue","ch":7,"final":false},{"id":"c7_lagerplatz","ch":7,"final":false},{"id":"c7_exit_dbg","ch":7,"final":false},{"id":"c7_doppelt","ch":7,"final":false},{"id":"c7_sortieren","ch":7,"final":false},{"id":"c7_boss","ch":7,"final":false},{"id":"r5t1","ch":8,"final":false},{"id":"c8_ftrig","ch":8,"final":false},{"id":"c8_zaehlen","ch":8,"final":false},{"id":"c8_zaehler_dbg","ch":8,"final":false},{"id":"c8_toggle","ch":8,"final":false},{"id":"c8_ctu","ch":8,"final":false},{"id":"c8_ctd","ch":8,"final":false},{"id":"c8_reset_dbg","ch":8,"final":false},{"id":"c8_startstopp","ch":8,"final":false},{"id":"c8_boss","ch":8,"final":false},{"id":"r5t3","ch":9,"final":false},{"id":"r5t5","ch":9,"final":false},{"id":"c9_tp","ch":9,"final":false},{"id":"r5t8","ch":9,"final":false},{"id":"c9_anlauf","ch":9,"final":false},{"id":"c9_blinker","ch":9,"final":false},{"id":"c9_ueberwachung","ch":9,"final":false},{"id":"c9_ms_dbg","ch":9,"final":false},{"id":"c9_restzeit","ch":9,"final":false},{"id":"r5t10","ch":9,"final":false},{"id":"c10_kette","ch":10,"final":false},{"id":"c10_ausgaenge","ch":10,"final":false},{"id":"c10_timer","ch":10,"final":false},{"id":"c10_haenger_dbg","ch":10,"final":false},{"id":"c10_pickplace","ch":10,"final":false},{"id":"c10_notaus","ch":10,"final":false},{"id":"c10_timer_dbg","ch":10,"final":false},{"id":"c10_zyklen","ch":10,"final":false},{"id":"c10_sortierlauf","ch":10,"final":false},{"id":"final_boss","ch":10,"final":true},{"id":"p11_deklaration","ch":11,"final":false},{"id":"p11_typen","ch":11,"final":false},{"id":"p11_startwert","ch":11,"final":false},{"id":"p11_konstante","ch":11,"final":false},{"id":"p11_typfehler_dbg","ch":11,"final":false},{"id":"p11_arraygrenzen","ch":11,"final":false},{"id":"p11_wortbreite","ch":11,"final":false},{"id":"p11_bits","ch":11,"final":false},{"id":"p11_temp_dbg","ch":11,"final":false},{"id":"p11_boss","ch":11,"final":false},{"id":"p12_erste_fc","ch":12,"final":false},{"id":"p12_aufruf","ch":12,"final":false},{"id":"p12_skalieren","ch":12,"final":false},{"id":"p12_ausgaenge","ch":12,"final":false},{"id":"p12_zweige_dbg","ch":12,"final":false},{"id":"p12_inout","ch":12,"final":false},{"id":"p12_void","ch":12,"final":false},{"id":"p12_fc_speicher_dbg","ch":12,"final":false},{"id":"p12_bibliothek","ch":12,"final":false},{"id":"p12_boss","ch":12,"final":false},{"id":"p13_erster_fb","ch":13,"final":false},{"id":"p13_instanz","ch":13,"final":false},{"id":"p13_motor","ch":13,"final":false},{"id":"p13_eine_instanz_dbg","ch":13,"final":false},{"id":"p13_multiinstanz","ch":13,"final":false},{"id":"p13_timer_im_fb","ch":13,"final":false},{"id":"p13_zaehler_fb","ch":13,"final":false},{"id":"p13_statik_lesen","ch":13,"final":false},{"id":"p13_bedingt_dbg","ch":13,"final":false},{"id":"p13_boss","ch":13,"final":false},{"id":"p14_struct","ch":14,"final":false},{"id":"p14_udt","ch":14,"final":false},{"id":"p14_array_udt","ch":14,"final":false},{"id":"p14_global_db","ch":14,"final":false},{"id":"p14_grenzen_dbg","ch":14,"final":false},{"id":"p14_string","ch":14,"final":false},{"id":"p14_concat","ch":14,"final":false},{"id":"p14_zerlegen","ch":14,"final":false},{"id":"p14_kurz_dbg","ch":14,"final":false},{"id":"p14_boss","ch":14,"final":false},{"id":"p15_zyklus","ch":15,"final":false},{"id":"p15_reihenfolge_dbg","ch":15,"final":false},{"id":"p15_anlauf","ch":15,"final":false},{"id":"p15_eingaenge","ch":15,"final":false},{"id":"p15_geraete","ch":15,"final":false},{"id":"p15_betriebsart","ch":15,"final":false},{"id":"p15_schrittkette","ch":15,"final":false},{"id":"p15_global_dbg","ch":15,"final":false},{"id":"p15_export","ch":15,"final":false},{"id":"p15_final","ch":15,"final":true}],"kop":[{"id":"k1_licht","ch":1,"final":false},{"id":"k1_sperre","ch":1,"final":false},{"id":"k1_ampel_dbg","ch":1,"final":false},{"id":"k1_netzwerke","ch":1,"final":false},{"id":"k1_antrieb","ch":1,"final":false},{"id":"k1_zwei_spulen","ch":1,"final":false},{"id":"k1_bergfahrt","ch":1,"final":false},{"id":"k1_notaus_dbg","ch":1,"final":false},{"id":"k1_einstieg","ch":1,"final":false},{"id":"k1_boss","ch":1,"final":false},{"id":"k2_oeffner","ch":2,"final":false},{"id":"k2_parallel","ch":2,"final":false},{"id":"k2_notaus","ch":2,"final":false},{"id":"k2_tuer","ch":2,"final":false},{"id":"k2_tuer_dbg","ch":2,"final":false},{"id":"k2_warnung","ch":2,"final":false},{"id":"k2_sensor","ch":2,"final":false},{"id":"k2_betrieb","ch":2,"final":false},{"id":"k2_stopp_dbg","ch":2,"final":false},{"id":"k2_boss","ch":2,"final":false},{"id":"k3_selbst","ch":3,"final":false},{"id":"k3_ausvorrang","ch":3,"final":false},{"id":"k3_einvorrang","ch":3,"final":false},{"id":"k3_notaus","ch":3,"final":false},{"id":"k3_selbst_dbg","ch":3,"final":false},{"id":"k3_verriegelung","ch":3,"final":false},{"id":"k3_richtung","ch":3,"final":false},{"id":"k3_verriegelung_dbg","ch":3,"final":false},{"id":"k3_tuer","ch":3,"final":false},{"id":"k3_boss","ch":3,"final":false},{"id":"k4_setzen","ch":4,"final":false},{"id":"k4_vorrang","ch":4,"final":false},{"id":"k4_stoerung","ch":4,"final":false},{"id":"k4_quit_dbg","ch":4,"final":false},{"id":"k4_negiert","ch":4,"final":false},{"id":"k4_antrieb_sr","ch":4,"final":false},{"id":"k4_sammel","ch":4,"final":false},{"id":"k4_hupe","ch":4,"final":false},{"id":"k4_vorrang_dbg","ch":4,"final":false},{"id":"k4_boss","ch":4,"final":false},{"id":"k5_pflanke","ch":5,"final":false},{"id":"k5_zaehlen","ch":5,"final":false},{"id":"k5_rasend_dbg","ch":5,"final":false},{"id":"k5_sperre","ch":5,"final":false},{"id":"k5_stromstoss","ch":5,"final":false},{"id":"k5_hupe","ch":5,"final":false},{"id":"k5_quit","ch":5,"final":false},{"id":"k5_nflanke_dbg","ch":5,"final":false},{"id":"k5_start","ch":5,"final":false},{"id":"k5_boss","ch":5,"final":false},{"id":"k6_ton","ch":6,"final":false},{"id":"k6_tof","ch":6,"final":false},{"id":"k6_tp","ch":6,"final":false},{"id":"k6_zeit_dbg","ch":6,"final":false},{"id":"k6_autozu","ch":6,"final":false},{"id":"k6_windfilter","ch":6,"final":false},{"id":"k6_tof_dbg","ch":6,"final":false},{"id":"k6_bremse","ch":6,"final":false},{"id":"k6_signal","ch":6,"final":false},{"id":"k6_boss","ch":6,"final":false},{"id":"k7_taktmerker","ch":7,"final":false},{"id":"k7_blinker","ch":7,"final":false},{"id":"k7_ueberwachung","ch":7,"final":false},{"id":"k7_anlauf","ch":7,"final":false},{"id":"k7_wind","ch":7,"final":false},{"id":"k7_blink_dbg","ch":7,"final":false},{"id":"k7_seil","ch":7,"final":false},{"id":"k7_ueber_dbg","ch":7,"final":false},{"id":"k7_tuerwarnung","ch":7,"final":false},{"id":"k7_boss","ch":7,"final":false},{"id":"k8_ctu","ch":8,"final":false},{"id":"k8_reset","ch":8,"final":false},{"id":"k8_anzeige","ch":8,"final":false},{"id":"k8_ctd","ch":8,"final":false},{"id":"k8_pv_dbg","ch":8,"final":false},{"id":"k8_sperre","ch":8,"final":false},{"id":"k8_richtungen","ch":8,"final":false},{"id":"k8_reset_dbg","ch":8,"final":false},{"id":"k8_takt","ch":8,"final":false},{"id":"k8_boss","ch":8,"final":false},{"id":"k9_wind","ch":9,"final":false},{"id":"k9_bereich","ch":9,"final":false},{"id":"k9_revision","ch":9,"final":false},{"id":"k9_hysterese","ch":9,"final":false},{"id":"k9_move","ch":9,"final":false},{"id":"k9_add","ch":9,"final":false},{"id":"k9_grenze_dbg","ch":9,"final":false},{"id":"k9_mul","ch":9,"final":false},{"id":"k9_hyst_dbg","ch":9,"final":false},{"id":"k9_boss","ch":9,"final":false},{"id":"k10_kette","ch":10,"final":false},{"id":"k10_freigabe","ch":10,"final":false},{"id":"k10_bruecke_dbg","ch":10,"final":false},{"id":"k10_speicher","ch":10,"final":false},{"id":"k10_zwei_schritte","ch":10,"final":false},{"id":"k10_ausgaben","ch":10,"final":false},{"id":"k10_zeitschritt","ch":10,"final":false},{"id":"k10_schritt_dbg","ch":10,"final":false},{"id":"k10_betriebsart","ch":10,"final":false},{"id":"k10_final","ch":10,"final":true},{"id":"k11_erste_fc","ch":11,"final":false},{"id":"k11_schnittstelle","ch":11,"final":false},{"id":"k11_aufruf","ch":11,"final":false},{"id":"k11_zwei_stationen","ch":11,"final":false},{"id":"k11_aufruf_dbg","ch":11,"final":false},{"id":"k11_retval","ch":11,"final":false},{"id":"k11_temp","ch":11,"final":false},{"id":"k11_temp_dbg","ch":11,"final":false},{"id":"k11_speicher_dbg","ch":11,"final":false},{"id":"k11_boss","ch":11,"final":false},{"id":"k12_selbsthaltung","ch":12,"final":false},{"id":"k12_stoerung","ch":12,"final":false},{"id":"k12_instanzen","ch":12,"final":false},{"id":"k12_flanke","ch":12,"final":false},{"id":"k12_instanz_dbg","ch":12,"final":false},{"id":"k12_timer","ch":12,"final":false},{"id":"k12_zaehler","ch":12,"final":false},{"id":"k12_multi","ch":12,"final":false},{"id":"k12_timer_dbg","ch":12,"final":false},{"id":"k12_boss","ch":12,"final":false},{"id":"k13_db_schreiben","ch":13,"final":false},{"id":"k13_parameter","ch":13,"final":false},{"id":"k13_udt","ch":13,"final":false},{"id":"k13_db_tabelle","ch":13,"final":false},{"id":"k13_db_dbg","ch":13,"final":false},{"id":"k13_array","ch":13,"final":false},{"id":"k13_struct_param","ch":13,"final":false},{"id":"k13_move_struct","ch":13,"final":false},{"id":"k13_array_dbg","ch":13,"final":false},{"id":"k13_boss","ch":13,"final":false},{"id":"k14_tuer","ch":14,"final":false},{"id":"k14_kette","ch":14,"final":false},{"id":"k14_antrieb","ch":14,"final":false},{"id":"k14_global_dbg","ch":14,"final":false},{"id":"k14_verschaltung","ch":14,"final":false},{"id":"k14_betriebsart","ch":14,"final":false},{"id":"k14_inout","ch":14,"final":false},{"id":"k14_meldung","ch":14,"final":false},{"id":"k14_verschaltung_dbg","ch":14,"final":false},{"id":"k14_boss","ch":14,"final":false},{"id":"k15_anlauf","ch":15,"final":false},{"id":"k15_struktur","ch":15,"final":false},{"id":"k15_reihenfolge_dbg","ch":15,"final":false},{"id":"k15_warnfrei","ch":15,"final":false},{"id":"k15_anlauf_dbg","ch":15,"final":false},{"id":"k15_status","ch":15,"final":false},{"id":"k15_diagnose","ch":15,"final":false},{"id":"k15_ablauf","ch":15,"final":false},{"id":"k15_quit_dbg","ch":15,"final":false},{"id":"k15_final","ch":15,"final":true}],"fup":[{"id":"f1_signal","ch":1,"final":false},{"id":"f1_und","ch":1,"final":false},{"id":"f1_bue_dbg","ch":1,"final":false},{"id":"f1_netzwerke","ch":1,"final":false},{"id":"f1_drei","ch":1,"final":false},{"id":"f1_zwei_ausgaenge","ch":1,"final":false},{"id":"f1_bue","ch":1,"final":false},{"id":"f1_ausfahrt_dbg","ch":1,"final":false},{"id":"f1_weiche","ch":1,"final":false},{"id":"f1_boss","ch":1,"final":false},{"id":"f2_oder","ch":2,"final":false},{"id":"f2_negiert","ch":2,"final":false},{"id":"f2_halt","ch":2,"final":false},{"id":"f2_xor","ch":2,"final":false},{"id":"f2_oder_dbg","ch":2,"final":false},{"id":"f2_zwei_tasten","ch":2,"final":false},{"id":"f2_bue","ch":2,"final":false},{"id":"f2_neg_dbg","ch":2,"final":false},{"id":"f2_lagemelder","ch":2,"final":false},{"id":"f2_boss","ch":2,"final":false},{"id":"f3_selbst","ch":3,"final":false},{"id":"f3_signal_halt","ch":3,"final":false},{"id":"f3_einvorrang","ch":3,"final":false},{"id":"f3_verriegelung","ch":3,"final":false},{"id":"f3_selbst_dbg","ch":3,"final":false},{"id":"f3_zugfahrt","ch":3,"final":false},{"id":"f3_verriegelung_dbg","ch":3,"final":false},{"id":"f3_ausvorrang","ch":3,"final":false},{"id":"f3_schranke","ch":3,"final":false},{"id":"f3_boss","ch":3,"final":false},{"id":"f4_s_r","ch":4,"final":false},{"id":"f4_sr","ch":4,"final":false},{"id":"f4_rs","ch":4,"final":false},{"id":"f4_negiert","ch":4,"final":false},{"id":"f4_rs_dbg","ch":4,"final":false},{"id":"f4_stoerung","ch":4,"final":false},{"id":"f4_vorrang","ch":4,"final":false},{"id":"f4_sammel","ch":4,"final":false},{"id":"f4_reihenfolge_dbg","ch":4,"final":false},{"id":"f4_boss","ch":4,"final":false},{"id":"f5_achse","ch":5,"final":false},{"id":"f5_rasend_dbg","ch":5,"final":false},{"id":"f5_n","ch":5,"final":false},{"id":"f5_stromstoss","ch":5,"final":false},{"id":"f5_zugzaehlung","ch":5,"final":false},{"id":"f5_quit","ch":5,"final":false},{"id":"f5_n_dbg","ch":5,"final":false},{"id":"f5_signalfall","ch":5,"final":false},{"id":"f5_toggle_dbg","ch":5,"final":false},{"id":"f5_boss","ch":5,"final":false},{"id":"f6_ton","ch":6,"final":false},{"id":"f6_tof","ch":6,"final":false},{"id":"f6_tp","ch":6,"final":false},{"id":"f6_zeit_dbg","ch":6,"final":false},{"id":"f6_sicherheit","ch":6,"final":false},{"id":"f6_haltezeit","ch":6,"final":false},{"id":"f6_tof_dbg","ch":6,"final":false},{"id":"f6_weichenmotor","ch":6,"final":false},{"id":"f6_wecker","ch":6,"final":false},{"id":"f6_boss","ch":6,"final":false},{"id":"f7_takt","ch":7,"final":false},{"id":"f7_blinker","ch":7,"final":false},{"id":"f7_laufzeit","ch":7,"final":false},{"id":"f7_wechsel","ch":7,"final":false},{"id":"f7_blink_dbg","ch":7,"final":false},{"id":"f7_raeumen","ch":7,"final":false},{"id":"f7_ueber_dbg","ch":7,"final":false},{"id":"f7_vorlaeuten","ch":7,"final":false},{"id":"f7_zeitaufloesung","ch":7,"final":false},{"id":"f7_boss","ch":7,"final":false},{"id":"f8_ctu","ch":8,"final":false},{"id":"f8_anzeige","ch":8,"final":false},{"id":"f8_ctd","ch":8,"final":false},{"id":"f8_pv_dbg","ch":8,"final":false},{"id":"f8_achszaehler","ch":8,"final":false},{"id":"f8_reset_dbg","ch":8,"final":false},{"id":"f8_zuege","ch":8,"final":false},{"id":"f8_signal","ch":8,"final":false},{"id":"f8_ctd_dbg","ch":8,"final":false},{"id":"f8_boss","ch":8,"final":false},{"id":"f9_tempo","ch":9,"final":false},{"id":"f9_bereich","ch":9,"final":false},{"id":"f9_zugnummer","ch":9,"final":false},{"id":"f9_begriff","ch":9,"final":false},{"id":"f9_grenze_dbg","ch":9,"final":false},{"id":"f9_zuglaenge","ch":9,"final":false},{"id":"f9_verspaetung","ch":9,"final":false},{"id":"f9_begriff_dbg","ch":9,"final":false},{"id":"f9_tempo_move","ch":9,"final":false},{"id":"f9_boss","ch":9,"final":false},{"id":"f10_einstellen","ch":10,"final":false},{"id":"f10_sichern","ch":10,"final":false},{"id":"f10_signal","ch":10,"final":false},{"id":"f10_aufloesen","ch":10,"final":false},{"id":"f10_signal_dbg","ch":10,"final":false},{"id":"f10_feind","ch":10,"final":false},{"id":"f10_feind_dbg","ch":10,"final":false},{"id":"f10_flankenschutz","ch":10,"final":false},{"id":"f10_automatik","ch":10,"final":false},{"id":"f10_final","ch":10,"final":true},{"id":"fp11_erste_fc","ch":11,"final":false},{"id":"fp11_schnittstelle","ch":11,"final":false},{"id":"fp11_aufruf","ch":11,"final":false},{"id":"fp11_zwei","ch":11,"final":false},{"id":"fp11_aufruf_dbg","ch":11,"final":false},{"id":"fp11_retval","ch":11,"final":false},{"id":"fp11_temp","ch":11,"final":false},{"id":"fp11_temp_dbg","ch":11,"final":false},{"id":"fp11_speicher_dbg","ch":11,"final":false},{"id":"fp11_boss","ch":11,"final":false},{"id":"fp12_weiche","ch":12,"final":false},{"id":"fp12_stoerung","ch":12,"final":false},{"id":"fp12_instanzen","ch":12,"final":false},{"id":"fp12_achsen","ch":12,"final":false},{"id":"fp12_instanz_dbg","ch":12,"final":false},{"id":"fp12_timer","ch":12,"final":false},{"id":"fp12_abschnitt","ch":12,"final":false},{"id":"fp12_multi","ch":12,"final":false},{"id":"fp12_timer_dbg","ch":12,"final":false},{"id":"fp12_boss","ch":12,"final":false},{"id":"fp13_db","ch":13,"final":false},{"id":"fp13_parameter","ch":13,"final":false},{"id":"fp13_udt","ch":13,"final":false},{"id":"fp13_db_tabelle","ch":13,"final":false},{"id":"fp13_db_dbg","ch":13,"final":false},{"id":"fp13_array","ch":13,"final":false},{"id":"fp13_struct_param","ch":13,"final":false},{"id":"fp13_move_struct","ch":13,"final":false},{"id":"fp13_array_dbg","ch":13,"final":false},{"id":"fp13_boss","ch":13,"final":false},{"id":"fp14_signal","ch":14,"final":false},{"id":"fp14_bue","ch":14,"final":false},{"id":"fp14_weiche","ch":14,"final":false},{"id":"fp14_global_dbg","ch":14,"final":false},{"id":"fp14_verschaltung","ch":14,"final":false},{"id":"fp14_betriebsart","ch":14,"final":false},{"id":"fp14_inout","ch":14,"final":false},{"id":"fp14_meldung","ch":14,"final":false},{"id":"fp14_verschaltung_dbg","ch":14,"final":false},{"id":"fp14_boss","ch":14,"final":false},{"id":"fp15_anlauf","ch":15,"final":false},{"id":"fp15_struktur","ch":15,"final":false},{"id":"fp15_reihenfolge_dbg","ch":15,"final":false},{"id":"fp15_warnfrei","ch":15,"final":false},{"id":"fp15_anlauf_dbg","ch":15,"final":false},{"id":"fp15_status","ch":15,"final":false},{"id":"fp15_diagnose","ch":15,"final":false},{"id":"fp15_fahrstrasse","ch":15,"final":false},{"id":"fp15_quit_dbg","ch":15,"final":false},{"id":"fp15_final","ch":15,"final":true}],"awl":[{"id":"a1_rollgang","ch":1,"final":false},{"id":"a1_und","ch":1,"final":false},{"id":"a1_pumpe","ch":1,"final":false},{"id":"a1_zwei","ch":1,"final":false},{"id":"a1_schere_dbg","ch":1,"final":false},{"id":"a1_ketten","ch":1,"final":false},{"id":"a1_netzwerke","ch":1,"final":false},{"id":"a1_zufrueh_dbg","ch":1,"final":false},{"id":"a1_kette","ch":1,"final":false},{"id":"a1_boss","ch":1,"final":false},{"id":"a2_un","ch":2,"final":false},{"id":"a2_oder","ch":2,"final":false},{"id":"a2_on","ch":2,"final":false},{"id":"a2_x","ch":2,"final":false},{"id":"a2_und_vor_oder","ch":2,"final":false},{"id":"a2_klammer","ch":2,"final":false},{"id":"a2_klammer_dbg","ch":2,"final":false},{"id":"a2_un_klammer","ch":2,"final":false},{"id":"a2_x_dbg","ch":2,"final":false},{"id":"a2_boss","ch":2,"final":false},{"id":"a3_selbsthaltung","ch":3,"final":false},{"id":"a3_sr","ch":3,"final":false},{"id":"a3_vorrang","ch":3,"final":false},{"id":"a3_not","ch":3,"final":false},{"id":"a3_notaus_dbg","ch":3,"final":false},{"id":"a3_set","ch":3,"final":false},{"id":"a3_ofen","ch":3,"final":false},{"id":"a3_stoerung","ch":3,"final":false},{"id":"a3_richtung","ch":3,"final":false},{"id":"a3_boss","ch":3,"final":false},{"id":"a4_fp","ch":4,"final":false},{"id":"a4_fn","ch":4,"final":false},{"id":"a4_stromstoss","ch":4,"final":false},{"id":"a4_melden","ch":4,"final":false},{"id":"a4_quit_dbg","ch":4,"final":false},{"id":"a4_nachlauf","ch":4,"final":false},{"id":"a4_merker_dbg","ch":4,"final":false},{"id":"a4_richtung","ch":4,"final":false},{"id":"a4_zweimal","ch":4,"final":false},{"id":"a4_boss","ch":4,"final":false},{"id":"a5_se","ch":5,"final":false},{"id":"a5_sa","ch":5,"final":false},{"id":"a5_si","ch":5,"final":false},{"id":"a5_sv","ch":5,"final":false},{"id":"a5_zeit_dbg","ch":5,"final":false},{"id":"a5_vorwarnung","ch":5,"final":false},{"id":"a5_blinker","ch":5,"final":false},{"id":"a5_art_dbg","ch":5,"final":false},{"id":"a5_ueberwachung","ch":5,"final":false},{"id":"a5_boss","ch":5,"final":false},{"id":"a6_zv","ch":6,"final":false},{"id":"a6_reset","ch":6,"final":false},{"id":"a6_zr","ch":6,"final":false},{"id":"a6_uz","ch":6,"final":false},{"id":"a6_reset_dbg","ch":6,"final":false},{"id":"a6_vorwahl","ch":6,"final":false},{"id":"a6_ofen","ch":6,"final":false},{"id":"a6_zaehler_dbg","ch":6,"final":false},{"id":"a6_voll","ch":6,"final":false},{"id":"a6_boss","ch":6,"final":false},{"id":"a7_lt","ch":7,"final":false},{"id":"a7_konst","ch":7,"final":false},{"id":"a7_richtung_dbg","ch":7,"final":false},{"id":"a7_mehrfach","ch":7,"final":false},{"id":"a7_akku","ch":7,"final":false},{"id":"a7_tak","ch":7,"final":false},{"id":"a7_zeitwert","ch":7,"final":false},{"id":"a7_zaehlwert","ch":7,"final":false},{"id":"a7_vke_dbg","ch":7,"final":false},{"id":"a7_boss","ch":7,"final":false},{"id":"a8_plus","ch":8,"final":false},{"id":"a8_minus","ch":8,"final":false},{"id":"a8_mal","ch":8,"final":false},{"id":"a8_div_mod","ch":8,"final":false},{"id":"a8_reihenfolge_dbg","ch":8,"final":false},{"id":"a8_mittel","ch":8,"final":false},{"id":"a8_runden","ch":8,"final":false},{"id":"a8_inc","ch":8,"final":false},{"id":"a8_ganzzahl_dbg","ch":8,"final":false},{"id":"a8_boss","ch":8,"final":false},{"id":"a9_groesser","ch":9,"final":false},{"id":"a9_kleiner","ch":9,"final":false},{"id":"a9_gleich","ch":9,"final":false},{"id":"a9_klammer","ch":9,"final":false},{"id":"a9_klammer_dbg","ch":9,"final":false},{"id":"a9_fenster","ch":9,"final":false},{"id":"a9_real","ch":9,"final":false},{"id":"a9_ungleich","ch":9,"final":false},{"id":"a9_grenze_dbg","ch":9,"final":false},{"id":"a9_boss","ch":9,"final":false},{"id":"a10_spbn","ch":10,"final":false},{"id":"a10_verzweigung","ch":10,"final":false},{"id":"a10_spa_dbg","ch":10,"final":false},{"id":"a10_zaehlen","ch":10,"final":false},{"id":"a10_bea","ch":10,"final":false},{"id":"a10_loop","ch":10,"final":false},{"id":"a10_betriebsart","ch":10,"final":false},{"id":"a10_spb_dbg","ch":10,"final":false},{"id":"a10_beb","ch":10,"final":false},{"id":"a10_final","ch":10,"final":true},{"id":"ap11_erste_fc","ch":11,"final":false},{"id":"ap11_schnittstelle","ch":11,"final":false},{"id":"ap11_aufruf","ch":11,"final":false},{"id":"ap11_zwei","ch":11,"final":false},{"id":"ap11_aufruf_dbg","ch":11,"final":false},{"id":"ap11_retval","ch":11,"final":false},{"id":"ap11_temp","ch":11,"final":false},{"id":"ap11_temp_dbg","ch":11,"final":false},{"id":"ap11_speicher_dbg","ch":11,"final":false},{"id":"ap11_boss","ch":11,"final":false},{"id":"ap12_selbsthaltung","ch":12,"final":false},{"id":"ap12_stoerung","ch":12,"final":false},{"id":"ap12_instanzen","ch":12,"final":false},{"id":"ap12_flanke","ch":12,"final":false},{"id":"ap12_instanz_dbg","ch":12,"final":false},{"id":"ap12_timer","ch":12,"final":false},{"id":"ap12_ueberwachung","ch":12,"final":false},{"id":"ap12_multi","ch":12,"final":false},{"id":"ap12_timer_dbg","ch":12,"final":false},{"id":"ap12_boss","ch":12,"final":false},{"id":"ap13_db","ch":13,"final":false},{"id":"ap13_parameter","ch":13,"final":false},{"id":"ap13_udt","ch":13,"final":false},{"id":"ap13_db_tabelle","ch":13,"final":false},{"id":"ap13_db_dbg","ch":13,"final":false},{"id":"ap13_array","ch":13,"final":false},{"id":"ap13_struct_param","ch":13,"final":false},{"id":"ap13_protokoll","ch":13,"final":false},{"id":"ap13_array_dbg","ch":13,"final":false},{"id":"ap13_boss","ch":13,"final":false},{"id":"ap14_antrieb","ch":14,"final":false},{"id":"ap14_rollgang","ch":14,"final":false},{"id":"ap14_ofen","ch":14,"final":false},{"id":"ap14_global_dbg","ch":14,"final":false},{"id":"ap14_verschaltung","ch":14,"final":false},{"id":"ap14_betriebsart","ch":14,"final":false},{"id":"ap14_inout","ch":14,"final":false},{"id":"ap14_meldung","ch":14,"final":false},{"id":"ap14_verschaltung_dbg","ch":14,"final":false},{"id":"ap14_boss","ch":14,"final":false},{"id":"ap15_anlauf","ch":15,"final":false},{"id":"ap15_struktur","ch":15,"final":false},{"id":"ap15_reihenfolge_dbg","ch":15,"final":false},{"id":"ap15_warnfrei","ch":15,"final":false},{"id":"ap15_anlauf_dbg","ch":15,"final":false},{"id":"ap15_status","ch":15,"final":false},{"id":"ap15_diagnose","ch":15,"final":false},{"id":"ap15_ablauf","ch":15,"final":false},{"id":"ap15_quit_dbg","ch":15,"final":false},{"id":"ap15_final","ch":15,"final":true}]};
