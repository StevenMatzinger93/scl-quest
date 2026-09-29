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
        const args = [], names = [];
        if(!isOP(')')){
          while(true){
            // benannte Parameter (LIMIT(MN := 0, IN := x, MX := 9)) werden positionsweise übernommen
            // (NORM_X/SCALE_X ordnen sie nach dem Namen, siehe NAMED)
            if(peek().type==='IDENT' && isOP(':=',1)){ names[args.length] = peek().val.toUpperCase(); p += 2; }
            args.push(parseExpr(1));
            if(isOP(',')){ p++; continue; }
            break;
          }
        }
        expectOP(')', 'nach den Funktionsargumenten');
        return {k:'call', fn:t.val, args, names, line:t.line, col:t.col};
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
  BOOL_TO_INT: { args:1, sig: ts => { need(ts[0], 'BOOL', 'BOOL_TO_INT'); return 'INT'; } },
  // Analogwerte (Sensorwerkstatt): NORM_X → 0.0…1.0, SCALE_X → Messbereich (Ziel INT: gerundet)
  NORM_X:      { args:3, sig: ts => { ts.forEach(t=>need(t,'num','NORM_X')); return 'REAL'; } },
  SCALE_X:     { args:3, sig: ts => { ts.forEach(t=>need(t,'num','SCALE_X')); return 'REAL'; } }
};
// Funktionen, deren benannte Parameter nach dem Namen zugeordnet werden (TIA-Reihenfolge MIN, VALUE, MAX)
const NAMED = { NORM_X:['MIN','VALUE','MAX'], SCALE_X:['MIN','VALUE','MAX'] };
function roundHalfEven(x){
  const f = Math.floor(x), d = x - f;
  if(Math.abs(d - 0.5) < 1e-9) return (f % 2 === 0) ? f : f + 1;
  return Math.round(x);
}
const FUNC_IMPL = {
  ABS: a => Math.abs(a), SQRT: a => Math.sqrt(a), MIN: (a,b) => Math.min(a,b), MAX: (a,b) => Math.max(a,b),
  LIMIT: (mn, x, mx) => Math.max(mn, Math.min(mx, x)), ROUND: a => roundHalfEven(a), TRUNC: a => Math.trunc(a),
  INT_TO_REAL: a => a, REAL_TO_INT: a => roundHalfEven(a), BOOL_TO_INT: a => a ? 1 : 0,
  NORM_X: (mn, v, mx) => mx === mn ? 0 : (v - mn) / (mx - mn), SCALE_X: (mn, v, mx) => v * (mx - mn) + mn
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
        if(NAMED[fnKey] && e.names && e.names.some(Boolean)){
          const order = NAMED[fnKey], byName = {};
          e.args.forEach((a, i) => { const nm = e.names[i]; if(nm){ if(!order.includes(nm)) fail(fnKey+'() kennt den Parameter '+nm+' nicht. Parameter: '+order.join(', ')+'.', e); byName[nm] = a; } });
          if(Object.keys(byName).length === e.args.length && order.every(n => byName[n])){ e.args = order.map(n => byName[n]); e.names = order.slice(); }
          else if(Object.keys(byName).length) fail(fnKey+'() braucht die Parameter '+order.map(n => n+' := …').join(', ')+'.', e);
        }
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
        // SCALE_X passt sich dem Ziel an: INT-Ziel → gerundet (wie in TIA)
        if(s.expr.k==='call' && s.expr.fn==='SCALE_X' && tt==='INT'){ s.expr.t = 'INT'; s.expr.roundInt = true; return; }
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
      const r = FUNC_IMPL[e.fn].apply(null, args);
      return e.roundInt ? roundHalfEven(r) : r;
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
// force (Störungssimulation): Eingänge hängen fest – { Variable: Wert } überschreibt Testeingaben vor jedem Zyklus
function applyForce(env, opts){ if(opts && opts.force) Object.assign(env, clone(opts.force)); }
function runSinglePassTests(prog, initialVars, testCases, opts){
  const report = [];
  let ok = true;
  for(const tc of testCases){
    const env = freshEnv(prog, initialVars, tc.setup);
    const ctx = {t:0, iter:0};
    let error = null;
    applyForce(env, opts);
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
function runTimedTests(prog, initialVars, testCases, opts){
  const report = [];
  let ok = true;
  for(const tc of testCases){
    const env = freshEnv(prog, initialVars, tc.setup);
    const ctx = {t:0, iter:0};
    const steps = [];
    let caseOk = true, error = null;
    for(const step of tc.steps){
      Object.assign(env, clone(step.inputs||{}));
      applyForce(env, opts);
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
function executeTimed(prog, initialVars, setup, steps, opts){
  const env = freshEnv(prog, initialVars, setup);
  const ctx = {t:0, iter:0};
  const out = [];
  for(const step of steps){
    Object.assign(env, clone(step.inputs||{}));
    applyForce(env, opts);
    ctx.t += (step.dt||0);
    scan(prog, env, ctx);
    out.push(snapshot(env));
  }
  return out;
}
// Dauerbetrieb (z. B. Sensorwerkstatt: CPU in RUN): Variablen bleiben zwischen den Zyklen erhalten.
function createRuntime(prog, initialVars, setup, opts){
  const env = freshEnv(prog, initialVars, setup), ctx = {t:0, iter:0};
  return { env, get t(){ return ctx.t; }, scan(dt, inputs){ Object.assign(env, clone(inputs||{})); applyForce(env, opts); ctx.t += (dt||0); scan(prog, env, ctx); return env; } };
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
  compileSCL, runSinglePassTests, runTimedTests, executeOnce, executeTimed, createRuntime, constructsUsed,
  tokenize, parseProgram, SCLError, ParseError, RuntimeErr, FB_DEFS, FUNCS: Object.keys(FUNCS),
  KEYWORDS: Array.from(KEYWORDS), approxEqual, typeName: tname, buildSymbols, declOf
};
if(typeof module !== 'undefined' && module.exports){ module.exports = SCLEngine; }
root.SCLEngine = SCLEngine;
})(typeof window !== 'undefined' ? window : globalThis);
