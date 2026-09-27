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
// Dauerbetrieb (z. B. Sensorwerkstatt: CPU in RUN): Variablen bleiben zwischen den Zyklen erhalten.
function createRuntime(prog, initialVars, setup){
  const env = freshEnv(prog, initialVars, setup), ctx = {t:0, iter:0};
  return { env, get t(){ return ctx.t; }, scan(dt, inputs){ Object.assign(env, clone(inputs||{})); ctx.t += (dt||0); scan(prog, env, ctx); return env; } };
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
  if(src.scalex && (dst.k === 'int' || dst.k === 'real')) return null;   // SCALE_X passt sich dem Ziel an
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
  // Analogwerte (Sensorwerkstatt): NORM_X → 0.0…1.0 (REAL/LREAL), SCALE_X → Messbereich, Typ = Ziel (Ganzzahl: gerundet)
  NORM_X:{p:['MIN','VALUE','MAX'], chk:(ts, f, n) => { ts.forEach(t => { if(!isNum(t)) f('NORM_X(): MIN, VALUE und MAX müssen Zahlen sein, bekommt ' + typeNice(t) + '.', n); }); return ts.some(t => t.n === 'LREAL') ? T.LREAL : T.REAL; }, run: a => a[2] === a[0] ? 0 : (a[1] - a[0]) / (a[2] - a[0])},
  SCALE_X:{p:['MIN','VALUE','MAX'], chk:(ts, f, n) => { ts.forEach(t => { if(!isNum(t)) f('SCALE_X(): MIN, VALUE und MAX müssen Zahlen sein, bekommt ' + typeNice(t) + '.', n); }); if(ts[1].k !== 'real' && !ts[1].lit) f('SCALE_X(): VALUE muss REAL sein (meist das Ergebnis von NORM_X).', n); return Object.assign({}, ts.some(t => t.n === 'LREAL') ? T.LREAL : T.REAL, {scalex:true}); }, run: (a, t, e) => { const v = a[1] * (a[2] - a[0]) + a[0]; return e && e.roundInt ? roundHalfEven(v) : v; }},
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
        if(vt.scalex && tt.k === 'int') s.expr.roundInt = true;
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
      try{ return FN[e.fn].run(args, e.t, e); }
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
               => MOVE(5, Ziel)  => ADD(A, B, Ziel)  SUB MUL DIV  => NORM_X(0, Roh, 27648, Anteil)  => SCALE_X(0.0, Anteil, 100.0, Wert)
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
const OUTBOX = { MOVE:2, ADD:3, SUB:3, MUL:3, DIV:3, INC:1, DEC:1, SR:2, RS:2, NORM_X:4, SCALE_X:4 };   // SR/RS (FUP): (Q, R-Operand) · NORM_X/SCALE_X: (MIN, VALUE, MAX, OUT)
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
        const body = o.k === 'NORM_X' || o.k === 'SCALE_X' ? a[3] + ' := ' + o.k + '(MIN := ' + a[0] + ', VALUE := ' + a[1] + ', MAX := ' + a[2] + ')'
          : o.k === 'MOVE' ? a[1] + ' := ' + a[0] : o.k === 'INC' ? a[0] + ' := ' + a[0] + ' + 1' : o.k === 'DEC' ? a[0] + ' := ' + a[0] + ' - 1'
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

/* ---------- Grundstufe: weitere Aufgaben ---------- */
// Hilfen zum Berechnen erwarteter Werte (nur für die Testfälle)
const sum = a => a.reduce((s, x) => s + x, 0);
function beladen(arr, K){ let last = 0, n = 0; for(const x of arr){ if(last + x > K) break; last += x; n++; } return { Anzahl:n, Last:last, Rest_Pakete:arr.length - n }; }
function mittel(arr, MAX){ const ok = arr.filter(x => x >= 0 && x <= MAX); const s = sum(ok);
  return ok.length >= 3 ? { Summe:s, Gueltig:ok.length, Mittel:s / ok.length, Sensorfehler:false } : { Summe:s, Gueltig:ok.length, Mittel:0, Sensorfehler:true }; }
function ausschuss(arr, LO, HI){ const bad = arr.filter(x => x < LO || x > HI).length; return { Anzahl_Schlecht:bad, Gut_Summe:sum(arr.filter(x => x >= LO && x <= HI)), Alle_OK:bad === 0 }; }
function schieben(pl, neu, takt){ const out = takt ? [neu].concat(pl.slice(0, 5)) : pl.slice(); return { Platz:out, Ausgeworfen: takt ? pl[5] : 0, Belegt: out.filter(x => x !== 0).length }; }

defExamTask({ id:'x_scl_g_grundstellung', quest:'scl', level:'grund', ch:1, diff:1,
  params:{ W:[30, 45, 60, -45], V:[0.5, 1.5, 2.5] },
  title:'Grundstellung des Roboterarms',
  brief: p => 'Bringe den Roboterarm in Grundstellung. Halte die Reihenfolge ein:<br>1. <code>Letzte_Pos</code> (Int) übernimmt den <b>aktuellen</b> Wert von <code>Arm_Winkel</code>.<br>2. <code>Arm_Winkel</code> (Int) wird auf <b>' + p.W + '</b> gesetzt.<br>3. <code>Greifer_Auf</code> (Bool) wird TRUE.<br>4. <code>Vorschub</code> (Real) wird auf <b>' + p.V + '</b> gesetzt.',
  vars: () => ({ Arm_Winkel:0, Letzte_Pos:0, Greifer_Auf:false, Vorschub:0 }), types: () => ({ Vorschub:'REAL' }),
  ref: p => 'Letzte_Pos := Arm_Winkel;\nArm_Winkel := ' + p.W + ';\nGreifer_Auf := TRUE;\nVorschub := ' + p.V + ';',
  visible: p => [[{Arm_Winkel:90},{Letzte_Pos:90, Arm_Winkel:p.W, Greifer_Auf:true, Vorschub:p.V}]],
  hidden: p => [
    [{Arm_Winkel:0},{Letzte_Pos:0, Arm_Winkel:p.W, Greifer_Auf:true, Vorschub:p.V}],
    [{Arm_Winkel:-90, Letzte_Pos:77},{Letzte_Pos:-90, Arm_Winkel:p.W}],
    [{Arm_Winkel:135, Greifer_Auf:true, Vorschub:9.5},{Letzte_Pos:135, Greifer_Auf:true, Vorschub:p.V}],
    [{Arm_Winkel:p.W},{Letzte_Pos:p.W, Arm_Winkel:p.W}],
    [{Arm_Winkel:12, Vorschub:-1},{Letzte_Pos:12, Vorschub:p.V, Greifer_Auf:true}],
    [{Arm_Winkel:-30, Letzte_Pos:-30, Greifer_Auf:false},{Letzte_Pos:-30, Arm_Winkel:p.W, Greifer_Auf:true}]
  ],
  wrong:[
    p => 'Arm_Winkel := ' + p.W + ';\nLetzte_Pos := Arm_Winkel;\nGreifer_Auf := TRUE;\nVorschub := ' + p.V + ';',
    p => 'Letzte_Pos := ' + p.W + ';\nArm_Winkel := ' + p.W + ';\nGreifer_Auf := TRUE;\nVorschub := ' + p.V + ';',
    p => 'Letzte_Pos := Arm_Winkel;\nArm_Winkel := ' + p.W + ';\nVorschub := ' + p.V + ';'
  ]
});

defExamTask({ id:'x_scl_g_greiffreigabe', quest:'scl', level:'grund', ch:2, diff:1,
  title:'Greiffreigabe',
  brief: () => 'Der Roboter darf nur greifen (<code>Freigabe</code>), wenn<br>• <code>Automatik</code> aktiv ist <b>und</b><br>• die Schutztür geschlossen ist (<code>Tuer_Zu</code>) <b>und</b><br>• kein Not-Halt betätigt ist (<code>Not_Halt</code> = TRUE bedeutet betätigt) <b>und</b><br>• <b>genau eine</b> der beiden Ablagen ein Teil meldet (<code>Teil_Links</code>, <code>Teil_Rechts</code>).<br><code>Warnung</code> ist TRUE, wenn der Not-Halt betätigt <b>oder</b> die Schutztür offen ist.',
  vars: () => ({ Automatik:false, Tuer_Zu:false, Not_Halt:false, Teil_Links:false, Teil_Rechts:false, Freigabe:false, Warnung:false }),
  ref: () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND (Teil_Links XOR Teil_Rechts);\nWarnung := Not_Halt OR NOT Tuer_Zu;',
  visible: () => [[{Automatik:true, Tuer_Zu:true, Teil_Links:true},{Freigabe:true, Warnung:false}], [{Automatik:true, Tuer_Zu:false, Teil_Links:true},{Freigabe:false, Warnung:true}]],
  hidden: () => [
    [{Automatik:true, Tuer_Zu:true, Teil_Rechts:true, Warnung:true},{Freigabe:true, Warnung:false}],
    [{Automatik:true, Tuer_Zu:true, Teil_Links:true, Teil_Rechts:true, Freigabe:true},{Freigabe:false, Warnung:false}],
    [{Automatik:true, Tuer_Zu:true, Freigabe:true},{Freigabe:false, Warnung:false}],
    [{Automatik:true, Tuer_Zu:true, Teil_Links:true, Not_Halt:true},{Freigabe:false, Warnung:true}],
    [{Tuer_Zu:true, Teil_Links:true, Warnung:true},{Freigabe:false, Warnung:false}],
    [{Automatik:false, Tuer_Zu:false, Teil_Rechts:true},{Freigabe:false, Warnung:true}],
    [{Automatik:true, Teil_Links:true, Teil_Rechts:true},{Freigabe:false, Warnung:true}],
    [{},{Freigabe:false, Warnung:true}]
  ],
  wrong:[
    () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND (Teil_Links OR Teil_Rechts);\nWarnung := Not_Halt OR NOT Tuer_Zu;',
    () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND Teil_Links XOR Teil_Rechts;\nWarnung := Not_Halt OR NOT Tuer_Zu;',
    () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND (Teil_Links XOR Teil_Rechts);\nWarnung := Not_Halt AND NOT Tuer_Zu;'
  ]
});

defExamTask({ id:'x_scl_g_kisten', quest:'scl', level:'grund', ch:3, diff:1,
  params:{ N:[6, 8, 12] },
  title:'Teile verpacken',
  brief: p => 'Am Bandende werden Teile in Kisten zu je <b>' + p.N + ' Stück</b> verpackt. Berechne aus <code>Teile</code> (Int):<br>• <code>Kisten_Voll</code>: Anzahl vollständig gefüllter Kisten<br>• <code>Rest</code>: Teile, die danach übrig bleiben<br>Beide Ergebnisse sind ganze Zahlen (Int).',
  vars: () => ({ Teile:0, Kisten_Voll:0, Rest:0 }),
  ref: p => 'Kisten_Voll := Teile / ' + p.N + ';\nRest := Teile MOD ' + p.N + ';',
  visible: p => [[{Teile:2 * p.N + 1},{Kisten_Voll:2, Rest:1}]],
  hidden: p => [
    [{Teile:0, Kisten_Voll:4, Rest:3},{Kisten_Voll:0, Rest:0}],
    [{Teile:p.N - 1},{Kisten_Voll:0, Rest:p.N - 1}],
    [{Teile:p.N},{Kisten_Voll:1, Rest:0}],
    [{Teile:p.N + 1},{Kisten_Voll:1, Rest:1}],
    [{Teile:8 * p.N - 1},{Kisten_Voll:7, Rest:p.N - 1}],
    [{Teile:100, Rest:50},{Kisten_Voll:Math.floor(100 / p.N), Rest:100 % p.N}],
    [{Teile:1000},{Kisten_Voll:Math.floor(1000 / p.N), Rest:1000 % p.N}]
  ],
  wrong:[
    p => 'Kisten_Voll := Teile MOD ' + p.N + ';\nRest := Teile / ' + p.N + ';',
    p => 'Kisten_Voll := Teile / ' + p.N + ';\nRest := Teile - ' + p.N + ';',
    p => 'Kisten_Voll := Teile / ' + p.N + ' + 1;\nRest := Teile MOD ' + p.N + ';'
  ]
});

defExamTask({ id:'x_scl_g_achsabweichung', quest:'scl', level:'grund', ch:3, diff:2,
  params:{ TOL:[2, 3, 5], MK:[10, 15, 20] },
  title:'Achsabweichung',
  brief: p => 'Eine Achse fährt auf eine Sollposition (Werte in mm, Int). Berechne:<br>• <code>Abweichung</code>: Betrag der Differenz von <code>Soll_Pos</code> und <code>Ist_Pos</code> (immer ≥ 0)<br>• <code>In_Toleranz</code>: TRUE, wenn die Abweichung <b>höchstens ' + p.TOL + ' mm</b> beträgt<br>• <code>Korrektur</code> = <code>Soll_Pos − Ist_Pos</code>, aber begrenzt auf den Bereich <b>−' + p.MK + ' … +' + p.MK + '</b><br>Verwende die Funktionen <code>ABS</code> und <code>LIMIT</code>.',
  vars: () => ({ Soll_Pos:0, Ist_Pos:0, Abweichung:0, In_Toleranz:false, Korrektur:0 }),
  must:['ABS', 'LIMIT'],
  ref: p => 'Abweichung := ABS(Soll_Pos - Ist_Pos);\nIn_Toleranz := Abweichung <= ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Soll_Pos - Ist_Pos, MX := ' + p.MK + ');',
  visible: p => [[{Soll_Pos:50, Ist_Pos:48},{Abweichung:2, In_Toleranz:true, Korrektur:2}], [{Soll_Pos:0, Ist_Pos:100},{Abweichung:100, In_Toleranz:false, Korrektur:-p.MK}]],
  hidden: p => [
    [{Soll_Pos:100, Ist_Pos:100, In_Toleranz:false, Korrektur:7},{Abweichung:0, In_Toleranz:true, Korrektur:0}],
    [{Soll_Pos:100, Ist_Pos:100 - p.TOL},{Abweichung:p.TOL, In_Toleranz:true, Korrektur:p.TOL}],
    [{Soll_Pos:100, Ist_Pos:101 + p.TOL, In_Toleranz:true},{Abweichung:p.TOL + 1, In_Toleranz:false, Korrektur:-(p.TOL + 1)}],
    [{Soll_Pos:p.MK, Ist_Pos:0},{Abweichung:p.MK, Korrektur:p.MK}],
    [{Soll_Pos:p.MK + 1, Ist_Pos:0},{Abweichung:p.MK + 1, In_Toleranz:false, Korrektur:p.MK}],
    [{Soll_Pos:-40, Ist_Pos:-40 + p.MK + 1},{Abweichung:p.MK + 1, Korrektur:-p.MK}],
    [{Soll_Pos:0, Ist_Pos:250, Abweichung:3},{Abweichung:250, In_Toleranz:false, Korrektur:-p.MK}]
  ],
  wrong:[
    p => 'Abweichung := ABS(Soll_Pos - Ist_Pos);\nIn_Toleranz := Abweichung < ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Soll_Pos - Ist_Pos, MX := ' + p.MK + ');',
    p => 'Abweichung := ABS(Soll_Pos - Ist_Pos);\nIn_Toleranz := Abweichung <= ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Ist_Pos - Soll_Pos, MX := ' + p.MK + ');',
    p => 'Abweichung := Soll_Pos - Ist_Pos;\nIn_Toleranz := ABS(Abweichung) <= ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Soll_Pos - Ist_Pos, MX := ' + p.MK + ');'
  ]
});

defExamTask({ id:'x_scl_g_kompressor', quest:'scl', level:'grund', ch:4, diff:2,
  params:{ EIN:[5, 6], AUS:[8, 9] },
  title:'Kompressor mit Hysterese',
  brief: p => 'Ein Druckluftkompressor arbeitet mit Hysterese (<code>Druck</code> in bar, Int):<br>• <code>Kompressor</code> schaltet <b>ein</b>, wenn der Druck <b>unter ' + p.EIN + ' bar</b> fällt.<br>• Er schaltet <b>aus</b>, wenn der Druck <b>über ' + p.AUS + ' bar</b> steigt.<br>• Dazwischen (' + p.EIN + ' … ' + p.AUS + ' bar) behält er seinen bisherigen Zustand.<br>• <code>Ueberdruck</code> ist TRUE ab <b>12 bar</b>, sonst FALSE.',
  vars: () => ({ Druck:0, Kompressor:false, Ueberdruck:false }),
  must:['IF'],
  ref: p => 'IF Druck < ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSIF Druck > ' + p.AUS + ' THEN\n  Kompressor := FALSE;\nEND_IF;\nUeberdruck := Druck >= 12;',
  visible: () => [[{Druck:2},{Kompressor:true, Ueberdruck:false}], [{Druck:10, Kompressor:true},{Kompressor:false, Ueberdruck:false}]],
  hidden: p => [
    [{Druck:p.EIN - 1},{Kompressor:true}],
    [{Druck:p.EIN, Kompressor:false},{Kompressor:false}],
    [{Druck:p.EIN, Kompressor:true},{Kompressor:true}],
    [{Druck:7, Kompressor:true},{Kompressor:true, Ueberdruck:false}],
    [{Druck:7, Kompressor:false},{Kompressor:false}],
    [{Druck:p.AUS, Kompressor:true},{Kompressor:true}],
    [{Druck:p.AUS + 1, Kompressor:true},{Kompressor:false, Ueberdruck:false}],
    [{Druck:12, Kompressor:true},{Kompressor:false, Ueberdruck:true}],
    [{Druck:11, Ueberdruck:true},{Ueberdruck:false}],
    [{Druck:0, Ueberdruck:true},{Kompressor:true, Ueberdruck:false}]
  ],
  wrong:[
    p => 'IF Druck <= ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSIF Druck > ' + p.AUS + ' THEN\n  Kompressor := FALSE;\nEND_IF;\nUeberdruck := Druck >= 12;',
    p => 'IF Druck < ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSE\n  Kompressor := FALSE;\nEND_IF;\nUeberdruck := Druck >= 12;',
    p => 'IF Druck < ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSIF Druck > ' + p.AUS + ' THEN\n  Kompressor := FALSE;\nEND_IF;\nIF Druck >= 12 THEN\n  Ueberdruck := TRUE;\nEND_IF;'
  ]
});

defExamTask({ id:'x_scl_g_betriebsart', quest:'scl', level:'grund', ch:5, diff:1,
  params:{ VH:[10, 20], VA:[60, 80, 100] },
  title:'Betriebsartenanzeige',
  brief: p => 'Signalsäule und Band zeigen die gewählte <code>Betriebsart</code> (Int):<br>• 0 = Aus: alle Lampen aus, <code>Band_Speed</code> = 0<br>• 1 = Hand: nur <code>Lampe_Gelb</code>, <code>Band_Speed</code> = ' + p.VH + '<br>• 2 = Automatik: nur <code>Lampe_Gruen</code>, <code>Band_Speed</code> = ' + p.VA + '<br>• jeder andere Wert: nur <code>Lampe_Rot</code>, <code>Band_Speed</code> = 0<br>Verwende eine <code>CASE</code>-Anweisung. Es leuchtet immer nur die genannte Lampe.',
  vars: () => ({ Betriebsart:0, Lampe_Gelb:false, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:0 }),
  must:['CASE'],
  ref: p => 'Lampe_Gelb := FALSE;\nLampe_Gruen := FALSE;\nLampe_Rot := FALSE;\nBand_Speed := 0;\nCASE Betriebsart OF\n  0:\n    Band_Speed := 0;\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VH + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VA + ';\nELSE\n  Lampe_Rot := TRUE;\nEND_CASE;',
  visible: p => [[{Betriebsart:1},{Lampe_Gelb:true, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:p.VH}], [{Betriebsart:2},{Lampe_Gelb:false, Lampe_Gruen:true, Band_Speed:p.VA}]],
  hidden: p => [
    [{Betriebsart:0, Lampe_Gelb:true, Lampe_Gruen:true, Lampe_Rot:true, Band_Speed:50},{Lampe_Gelb:false, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:0}],
    [{Betriebsart:1, Lampe_Gruen:true, Band_Speed:p.VA},{Lampe_Gelb:true, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:p.VH}],
    [{Betriebsart:2, Lampe_Gelb:true, Lampe_Rot:true},{Lampe_Gelb:false, Lampe_Gruen:true, Lampe_Rot:false, Band_Speed:p.VA}],
    [{Betriebsart:3, Lampe_Gruen:true, Band_Speed:p.VA},{Lampe_Gelb:false, Lampe_Gruen:false, Lampe_Rot:true, Band_Speed:0}],
    [{Betriebsart:-1},{Lampe_Rot:true, Band_Speed:0}],
    [{Betriebsart:99, Lampe_Gelb:true},{Lampe_Gelb:false, Lampe_Rot:true}]
  ],
  wrong:[
    p => 'CASE Betriebsart OF\n  0:\n    Band_Speed := 0;\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VH + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VA + ';\nELSE\n  Lampe_Rot := TRUE;\n  Band_Speed := 0;\nEND_CASE;',
    p => 'Lampe_Gelb := FALSE;\nLampe_Gruen := FALSE;\nLampe_Rot := FALSE;\nBand_Speed := 0;\nCASE Betriebsart OF\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VH + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VA + ';\nEND_CASE;',
    p => 'Lampe_Gelb := FALSE;\nLampe_Gruen := FALSE;\nLampe_Rot := FALSE;\nBand_Speed := 0;\nCASE Betriebsart OF\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VA + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VH + ';\nELSE\n  Lampe_Rot := TRUE;\nEND_CASE;'
  ]
});

defExamTask({ id:'x_scl_g_sortiercode', quest:'scl', level:'grund', ch:5, diff:2,
  params:{ G:[29, 49, 59] },
  title:'Sortieren nach Code',
  brief: p => 'Der Roboter sortiert Teile nach dem gelesenen <code>Code</code> (Int):<br>• 0 = kein Teil: <code>Arm_Ziel</code> = 0<br>• 1 … ' + p.G + ' = Gutteil: <code>Arm_Ziel</code> = 90 (LAGER)<br>• ' + (p.G + 1) + ' … 99 = Nacharbeit: <code>Arm_Ziel</code> = −90 (NACHARBEIT)<br>• jeder andere Code: <code>Arm_Ziel</code> = 0 und <code>Stoerung</code> = TRUE<br><code>Stoerung</code> ist in allen anderen Fällen FALSE. Verwende <code>CASE</code> mit Bereichen (<code>a..b</code>).',
  vars: () => ({ Code:0, Arm_Ziel:0, Stoerung:false }),
  must:['CASE', 'RANGE'],
  ref: p => 'Stoerung := FALSE;\nCASE Code OF\n  0:\n    Arm_Ziel := 0;\n  1..' + p.G + ':\n    Arm_Ziel := 90;\n  ' + (p.G + 1) + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;',
  visible: () => [[{Code:10},{Arm_Ziel:90, Stoerung:false}], [{Code:150},{Arm_Ziel:0, Stoerung:true}]],
  hidden: p => [
    [{Code:0, Arm_Ziel:90, Stoerung:true},{Arm_Ziel:0, Stoerung:false}],
    [{Code:1, Stoerung:true},{Arm_Ziel:90, Stoerung:false}],
    [{Code:p.G},{Arm_Ziel:90, Stoerung:false}],
    [{Code:p.G + 1, Arm_Ziel:90},{Arm_Ziel:-90, Stoerung:false}],
    [{Code:99, Stoerung:true},{Arm_Ziel:-90, Stoerung:false}],
    [{Code:100, Arm_Ziel:-90},{Arm_Ziel:0, Stoerung:true}],
    [{Code:-5, Arm_Ziel:90},{Arm_Ziel:0, Stoerung:true}]
  ],
  wrong:[
    p => 'Stoerung := FALSE;\nCASE Code OF\n  0:\n    Arm_Ziel := 0;\n  1..' + (p.G - 1) + ':\n    Arm_Ziel := 90;\n  ' + p.G + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;',
    p => 'CASE Code OF\n  0:\n    Arm_Ziel := 0;\n  1..' + p.G + ':\n    Arm_Ziel := 90;\n  ' + (p.G + 1) + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;',
    p => 'Stoerung := FALSE;\nCASE Code OF\n  1..' + p.G + ':\n    Arm_Ziel := 90;\n  ' + (p.G + 1) + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;'
  ]
});

defExamTask({ id:'x_scl_g_ausschuss', quest:'scl', level:'grund', ch:6, diff:2,
  params:{ LO:[95, 98], HI:[102, 105] },
  title:'Ausschuss in der Charge',
  brief: p => 'Im Array <code>Masse</code> (Index 0 … 7, Int) stehen die Gewichte der letzten acht Teile in Gramm. Ein Teil ist gut, wenn es <b>mindestens ' + p.LO + ' g und höchstens ' + p.HI + ' g</b> wiegt. Berechne mit einer <code>FOR</code>-Schleife:<br>• <code>Anzahl_Schlecht</code>: Anzahl der Teile ausserhalb der Toleranz<br>• <code>Gut_Summe</code>: Summe der Gewichte aller guten Teile<br>• <code>Alle_OK</code>: TRUE, wenn kein Teil schlecht ist',
  vars: () => ({ Masse:[100,100,100,100,100,100,100,100], Anzahl_Schlecht:0, Gut_Summe:0, Alle_OK:false }),
  must:['FOR', 'ARRAY'],
  ref: p => 'Anzahl_Schlecht := 0;\nGut_Summe := 0;\nFOR i := 0 TO 7 DO\n  IF Masse[i] < ' + p.LO + ' OR Masse[i] > ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;',
  visible: p => { const m = [100, 101, p.LO - 5, 99, 100, p.HI + 5, 100, 100]; return [[{Masse:m}, ausschuss(m, p.LO, p.HI)]]; },
  hidden: p => [
    [100,100,100,100,100,100,100,100],
    [p.LO, p.HI, p.LO - 1, p.HI + 1, 100, 100, 100, 100],
    [p.LO - 1, 100, 100, 100, 100, 100, 100, p.HI + 1],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [p.HI, p.HI, p.HI, p.HI, p.LO, p.LO, p.LO, p.LO],
    [100, 100, 100, 100, 100, 100, 100, p.HI + 1]
  ].map((m, i) => [Object.assign({Masse:m}, i % 2 ? {} : {Anzahl_Schlecht:3, Gut_Summe:50, Alle_OK:i !== 0}), ausschuss(m, p.LO, p.HI)]),
  wrong:[
    p => 'FOR i := 0 TO 7 DO\n  IF Masse[i] < ' + p.LO + ' OR Masse[i] > ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;',
    p => 'Anzahl_Schlecht := 0;\nGut_Summe := 0;\nFOR i := 0 TO 6 DO\n  IF Masse[i] < ' + p.LO + ' OR Masse[i] > ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;',
    p => 'Anzahl_Schlecht := 0;\nGut_Summe := 0;\nFOR i := 0 TO 7 DO\n  IF Masse[i] <= ' + p.LO + ' OR Masse[i] >= ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;'
  ]
});

defExamTask({ id:'x_scl_g_taktband', quest:'scl', level:'grund', ch:6, diff:3,
  title:'Taktband (Schieberegister)',
  brief: () => 'Auf einem Taktband liegen sechs Plätze (<code>Platz</code>, Index 0 … 5, Int; 0 = leer, sonst Teilenummer). Bei jedem <code>Takt</code> rückt jedes Teil einen Platz weiter:<br>• Das Teil auf Platz 5 verlässt das Band: <code>Ausgeworfen</code> übernimmt seine Nummer.<br>• Platz i bekommt den bisherigen Inhalt von Platz i−1 (i = 5 … 1).<br>• Platz 0 bekommt <code>Neu_Teil</code>.<br>Ohne Takt bleibt das Band unverändert und <code>Ausgeworfen</code> ist 0.<br><code>Belegt</code>: Anzahl der Plätze ≠ 0 <b>nach</b> dem Takt — in jedem Zyklus berechnen.<br>Tipp: Überlege, in welcher Richtung die Schleife laufen muss.',
  vars: () => ({ Takt:false, Neu_Teil:0, Platz:[0,0,0,0,0,0], Ausgeworfen:0, Belegt:0 }),
  must:['FOR', 'ARRAY'],
  ref: () => 'IF Takt THEN\n  Ausgeworfen := Platz[5];\n  FOR i := 5 TO 1 BY -1 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Platz[0] := Neu_Teil;\nELSE\n  Ausgeworfen := 0;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;',
  visible: () => [[{Takt:true, Neu_Teil:4, Platz:[3,2,1,0,0,0]}, schieben([3,2,1,0,0,0], 4, true)]],
  hidden: () => [
    [{Takt:true, Neu_Teil:7, Platz:[1,2,3,4,5,6]}, schieben([1,2,3,4,5,6], 7, true)],
    [{Takt:false, Neu_Teil:5, Platz:[1,0,3,0,0,9], Ausgeworfen:4}, schieben([1,0,3,0,0,9], 5, false)],
    [{Takt:true, Neu_Teil:0, Platz:[0,0,0,0,0,0], Belegt:5}, schieben([0,0,0,0,0,0], 0, true)],
    [{Takt:true, Neu_Teil:3, Platz:[0,0,0,0,0,8]}, schieben([0,0,0,0,0,8], 3, true)],
    [{Takt:true, Neu_Teil:0, Platz:[5,0,6,0,7,0], Ausgeworfen:9}, schieben([5,0,6,0,7,0], 0, true)],
    [{Takt:true, Neu_Teil:21, Platz:[11,12,13,14,15,16]}, schieben([11,12,13,14,15,16], 21, true)]
  ],
  wrong:[
    () => 'IF Takt THEN\n  Ausgeworfen := Platz[5];\n  FOR i := 1 TO 5 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Platz[0] := Neu_Teil;\nELSE\n  Ausgeworfen := 0;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;',
    () => 'IF Takt THEN\n  FOR i := 5 TO 1 BY -1 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Ausgeworfen := Platz[5];\n  Platz[0] := Neu_Teil;\nELSE\n  Ausgeworfen := 0;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;',
    () => 'IF Takt THEN\n  Ausgeworfen := Platz[5];\n  FOR i := 5 TO 1 BY -1 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Platz[0] := Neu_Teil;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;'
  ]
});

defExamTask({ id:'x_scl_g_beladung', quest:'scl', level:'grund', ch:7, diff:2,
  params:{ KAP:[1000, 1200, 1500] },
  title:'Transportwagen beladen',
  brief: p => 'Ein Transportwagen trägt höchstens <b>' + p.KAP + ' kg</b>. Die Pakete in <code>Pakete</code> (Index 0 … 7, Int, kg) werden <b>der Reihe nach</b> geladen. Sobald ein Paket nicht mehr passt, endet das Laden — auch wenn spätere, leichtere Pakete noch passen würden.<br>• <code>Last</code>: geladenes Gesamtgewicht<br>• <code>Anzahl</code>: Anzahl geladener Pakete<br>• <code>Rest_Pakete</code>: Pakete, die stehen bleiben<br>Genau ' + p.KAP + ' kg sind erlaubt. Beende die Schleife mit <code>EXIT</code>.',
  vars: () => ({ Pakete:[0,0,0,0,0,0,0,0], Anzahl:0, Last:0, Rest_Pakete:0 }),
  must:['EXIT'],
  ref: p => 'Anzahl := 0;\nLast := 0;\nFOR i := 0 TO 7 DO\n  IF Last + Pakete[i] > ' + p.KAP + ' THEN\n    EXIT;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;',
  visible: p => { const a = [300, 400, 200, 500, 100, 100, 100, 100]; return [[{Pakete:a}, beladen(a, p.KAP)]]; },
  hidden: p => { const K = p.KAP; return [
    [K / 2, K / 2, 1, 1, 1, 1, 1, 1],
    [K + 1, 1, 1, 1, 1, 1, 1, 1],
    [100, 100, 100, 100, 100, 100, 100, 100],
    [K - 100, 200, 50, 50, 10, 10, 10, 10],
    [K - 1, 1, 1, 5, 5, 5, 5, 5],
    [10, 20, 30, 40, 50, 60, 70, K - 280]
  ].map((a, i) => [Object.assign({Pakete:a}, i % 2 ? {Anzahl:5, Last:300, Rest_Pakete:1} : {}), beladen(a, K)]); },
  wrong:[
    p => 'Anzahl := 0;\nLast := 0;\nFOR i := 0 TO 7 DO\n  IF Last + Pakete[i] > ' + p.KAP + ' THEN\n    CONTINUE;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;',
    p => 'Anzahl := 0;\nLast := 0;\nFOR i := 0 TO 7 DO\n  IF Last + Pakete[i] >= ' + p.KAP + ' THEN\n    EXIT;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;',
    p => 'FOR i := 0 TO 7 DO\n  IF Last + Pakete[i] > ' + p.KAP + ' THEN\n    EXIT;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;'
  ]
});

defExamTask({ id:'x_scl_g_messreihe', quest:'scl', level:'grund', ch:7, diff:3,
  params:{ MAX:[150, 200, 250] },
  title:'Messreihe ohne Störimpulse',
  brief: p => 'Ein Temperaturfühler liefert acht Messungen (<code>Messung</code>, Index 0 … 7, Int). Werte <b>unter 0</b> oder <b>über ' + p.MAX + '</b> sind Störimpulse und werden mit <code>CONTINUE</code> übersprungen.<br>• <code>Summe</code> und <code>Gueltig</code>: Summe und Anzahl der gültigen Werte<br>• Bei <b>mindestens 3</b> gültigen Werten: <code>Mittel</code> (Real) = Summe / Gueltig <b>mit Nachkommastellen</b>, <code>Sensorfehler</code> = FALSE<br>• sonst: <code>Mittel</code> = 0.0 und <code>Sensorfehler</code> = TRUE',
  vars: () => ({ Messung:[0,0,0,0,0,0,0,0], Summe:0, Gueltig:0, Mittel:0, Sensorfehler:false }), types: () => ({ Mittel:'REAL' }),
  must:['FOR', 'CONTINUE'],
  ref: p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] > ' + p.MAX + ' THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig >= 3 THEN\n  Mittel := INT_TO_REAL(Summe) / INT_TO_REAL(Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;',
  visible: p => { const a = [20, 22, -1, 24, 26, 999, 21, 23]; return [[{Messung:a}, mittel(a, p.MAX)]]; },
  hidden: p => [
    [10, 11, 11, 10, 10, 10, 10, 10],
    [-5, 40, 41, p.MAX + 1, 42, -1, 60, 0],
    [p.MAX, p.MAX, 0, -1, -1, -1, -1, -1],
    [p.MAX, 5, 0, -1, -1, -1, -1, 7],
    [-1, -1, -1, -1, -1, -1, 50, 51],
    [-3, 1, 2, 2, 999, 1000, 2000, -7]
  ].map((a, i) => [Object.assign({Messung:a}, i % 2 ? {Summe:77, Gueltig:4, Mittel:3.5, Sensorfehler:i === 1} : {}), mittel(a, p.MAX)]),
  wrong:[
    p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] > ' + p.MAX + ' THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig >= 3 THEN\n  Mittel := INT_TO_REAL(Summe / Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;',
    p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] > ' + p.MAX + ' THEN\n    EXIT;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig >= 3 THEN\n  Mittel := INT_TO_REAL(Summe) / INT_TO_REAL(Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;',
    p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] >= ' + p.MAX + ' THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig > 3 THEN\n  Mittel := INT_TO_REAL(Summe) / INT_TO_REAL(Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;'
  ]
});

defExamTask({ id:'x_scl_g_durchlaufofen', quest:'scl', level:'grund', ch:8, diff:3, timed:true,
  params:{ N:[3, 4, 5] },
  title:'Teile im Durchlaufofen',
  brief: p => 'Im Durchlaufofen dürfen höchstens <b>' + p.N + '</b> Teile gleichzeitig sein.<br>• Jede <b>steigende</b> Flanke der Lichtschranke <code>Einlauf</code> (Instanz <code>Ein_Flanke</code>, R_TRIG) erhöht <code>Anzahl</code> um 1.<br>• Ein Teil hat den Ofen verlassen, wenn es die Lichtschranke <code>Auslauf</code> <b>wieder freigibt</b> (fallende Flanke, Instanz <code>Aus_Flanke</code>, F_TRIG): <code>Anzahl</code> um 1 verringern, aber nie unter 0.<br>• <code>Voll</code> ist TRUE, sobald <code>Anzahl</code> mindestens ' + p.N + ' ist; <code>Zufuhr_Frei</code> ist das Gegenteil von <code>Voll</code>.',
  vars: () => ({ Einlauf:false, Auslauf:false, Anzahl:0, Voll:false, Zufuhr_Frei:false }), fb: () => ({ Ein_Flanke:'R_TRIG', Aus_Flanke:'F_TRIG' }),
  must:['R_TRIG', 'F_TRIG'],
  ref: p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
  visible: () => [{ steps:[[0.1,{Einlauf:true},{Anzahl:1}],[0.1,{Einlauf:false},{Anzahl:1}],[0.1,{Auslauf:true},{Anzahl:1}],[0.1,{Auslauf:false},{Anzahl:0}]] }],
  hidden: p => {
    const fill = [];
    for(let i = 1; i <= p.N; i++) fill.push([0.1,{Einlauf:true},{Anzahl:i, Voll:i >= p.N, Zufuhr_Frei:i < p.N}], [0.1,{Einlauf:true},{Anzahl:i}], [0.1,{Einlauf:false},{Anzahl:i}]);
    return [
      { steps: fill },
      { setup:{Anzahl:2}, steps:[[0.1,{},{Anzahl:2}],[0.1,{Auslauf:true},{Anzahl:2}],[0.1,{Auslauf:true},{Anzahl:2}],[0.1,{Auslauf:false},{Anzahl:1}],[0.1,{},{Anzahl:1}],[0.1,{Auslauf:true},{Anzahl:1}],[0.1,{Auslauf:false},{Anzahl:0, Voll:false, Zufuhr_Frei:true}],[0.1,{Auslauf:true},{Anzahl:0}],[0.1,{Auslauf:false},{Anzahl:0}]] },
      { setup:{Anzahl:p.N - 1}, steps:[[0.1,{Einlauf:true, Auslauf:true},{Anzahl:p.N, Voll:true, Zufuhr_Frei:false}],[0.1,{Einlauf:false, Auslauf:false},{Anzahl:p.N - 1, Voll:false, Zufuhr_Frei:true}],[0.1,{Einlauf:true},{Anzahl:p.N, Voll:true}]] },
      { setup:{Anzahl:0, Voll:true, Zufuhr_Frei:false}, steps:[[0.1,{},{Anzahl:0, Voll:false, Zufuhr_Frei:true}]] }
    ];
  },
  wrong:[
    p => 'Ein_Flanke(CLK := Einlauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Auslauf AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
    p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := NOT Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
    p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
    p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl > ' + p.N + ';\nZufuhr_Frei := NOT Voll;'
  ]
});

defExamTask({ id:'x_scl_g_zellenlicht', quest:'scl', level:'grund', ch:9, diff:1, timed:true,
  params:{ T:[5, 10, 20] },
  title:'Zellenbeleuchtung mit Nachlauf',
  brief: p => 'Die Innenbeleuchtung der Zelle geht <b>sofort</b> an, wenn die Schutztür geöffnet wird (<code>Tuer_Offen</code>). Nach dem Schliessen bleibt <code>Licht</code> noch <b>' + p.T + ' s</b> an. Wird die Tür vorher wieder geöffnet, beginnt die Nachlaufzeit beim nächsten Schliessen von vorn.<br>Verwende die Instanz <code>Licht_Timer</code> (Typ TOF).',
  vars: () => ({ Tuer_Offen:false, Licht:false }), fb: () => ({ Licht_Timer:'TOF' }),
  must:['TOF'],
  ref: p => 'Licht_Timer(IN := Tuer_Offen, PT := T#' + p.T + 'S);\nLicht := Licht_Timer.Q;',
  visible: p => [{ steps:[[0,{Tuer_Offen:true},{Licht:true}],[1,{Tuer_Offen:false},{Licht:true}],[p.T,{},{Licht:false}]] }],
  hidden: p => [
    { steps:[[0,{},{Licht:false}],[0.1,{Tuer_Offen:true},{Licht:true}],[2,{Tuer_Offen:false},{Licht:true}],[p.T - 0.5,{},{Licht:true}],[0.5,{},{Licht:false}],[5,{},{Licht:false}]] },
    { steps:[[0,{Tuer_Offen:true},{Licht:true}],[0.1,{Tuer_Offen:false},{Licht:true}],[p.T - 1,{Tuer_Offen:true},{Licht:true}],[0.5,{Tuer_Offen:false},{Licht:true}],[p.T - 0.1,{},{Licht:true}],[0.1,{},{Licht:false}]] },
    { setup:{Licht:true}, steps:[[0.1,{},{Licht:false}],[3,{},{Licht:false}]] },
    { steps:[[0,{Tuer_Offen:true},{Licht:true}],[30,{},{Licht:true}],[0.1,{Tuer_Offen:false},{Licht:true}]] }
  ],
  wrong:[
    () => 'Licht := Tuer_Offen;',
    p => 'Licht_Timer(IN := Tuer_Offen, PT := T#' + p.T + 'MS);\nLicht := Licht_Timer.Q;',
    p => 'Licht_Timer(IN := Tuer_Offen, PT := T#' + (p.T / 2) + 'S);\nLicht := Licht_Timer.Q;'
  ]
});

defExamTask({ id:'x_scl_g_anlaufwarnung', quest:'scl', level:'grund', ch:9, diff:2, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Anlaufwarnung vor dem Bandstart',
  brief: p => 'Bevor das Band anläuft, warnt eine Hupe:<br>• <code>Betrieb</code> wird mit <code>Start</code> gesetzt und hält sich selbst; <code>Stopp</code> schaltet ab und hat Vorrang.<br>• Solange <code>Betrieb</code> aktiv ist, läuft <code>Warn_Timer</code> (TON, <b>' + p.T + ' s</b>).<br>• Während dieser Wartezeit ertönt <code>Hupe</code>; danach ist die Hupe aus und <code>Band</code> läuft.<br>• Ohne Betrieb sind Hupe und Band aus.',
  vars: () => ({ Start:false, Stopp:false, Betrieb:false, Hupe:false, Band:false }), fb: () => ({ Warn_Timer:'TON' }),
  must:['TON'],
  ref: p => 'Betrieb := (Start OR Betrieb) AND NOT Stopp;\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb AND NOT Warn_Timer.Q;\nBand := Warn_Timer.Q;',
  visible: p => [{ steps:[[0,{Start:true},{Hupe:true, Band:false}],[0.1,{Start:false},{Hupe:true}],[p.T,{},{Hupe:false, Band:true}]] }],
  hidden: p => [
    { steps:[[0,{Start:true},{Betrieb:true, Hupe:true, Band:false}],[0.1,{Start:false},{Hupe:true}],[p.T - 0.2,{},{Hupe:true, Band:false}],[0.1,{},{Hupe:false, Band:true}],[1,{},{Band:true, Hupe:false}],[0.1,{Stopp:true},{Betrieb:false, Hupe:false, Band:false}],[0.1,{Stopp:false},{Betrieb:false, Hupe:false, Band:false}]] },
    { steps:[[0,{Start:true},{Hupe:true}],[1,{Start:false, Stopp:true},{Hupe:false, Band:false}],[0.1,{Stopp:false, Start:true},{Hupe:true}],[p.T - 0.1,{Start:false},{Hupe:true, Band:false}],[0.1,{},{Band:true, Hupe:false}]] },
    { steps:[[0,{Start:true, Stopp:true},{Betrieb:false, Hupe:false}],[0.1,{Start:false, Stopp:false},{Betrieb:false}],[p.T + 1,{},{Band:false, Hupe:false}]] },
    { setup:{Band:true, Hupe:true}, steps:[[0.1,{},{Band:false, Hupe:false}]] }
  ],
  wrong:[
    p => 'Betrieb := Start AND NOT Stopp;\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb AND NOT Warn_Timer.Q;\nBand := Warn_Timer.Q;',
    p => 'Betrieb := (Start OR Betrieb) AND NOT Stopp;\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb;\nBand := Warn_Timer.Q;',
    p => 'Betrieb := Start OR (Betrieb AND NOT Stopp);\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb AND NOT Warn_Timer.Q;\nBand := Warn_Timer.Q;'
  ]
});

const HUB_REF = 'CASE Schritt OF\n  0:\n    IF Teil_Da AND Unten THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Oben THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF NOT Teil_Da THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    IF Unten THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nHub_Auf := Schritt = 1;\nHub_Ab := Schritt = 3;\nLampe_Bereit := Schritt = 0;';
defExamTask({ id:'x_scl_g_hubtisch', quest:'scl', level:'grund', ch:10, diff:2, timed:true,
  title:'Schrittkette Hubtisch',
  brief: () => 'Programmiere die Schrittkette des Hubtischs mit <code>CASE Schritt OF</code>:<br>• <b>0 Warten</b>: liegt ein Teil auf (<code>Teil_Da</code>) <b>und</b> ist der Tisch unten (<code>Unten</code>) → Schritt 1<br>• <b>1 Heben</b>: sobald <code>Oben</code> → Schritt 2<br>• <b>2 Übergabe</b>: sobald das Teil entnommen ist (<code>Teil_Da</code> = FALSE) → Schritt 3<br>• <b>3 Senken</b>: sobald <code>Unten</code> → Schritt 0<br>Leite die Ausgänge <b>nach</b> dem CASE aus dem Schritt ab: <code>Hub_Auf</code> nur in Schritt 1, <code>Hub_Ab</code> nur in Schritt 3, <code>Lampe_Bereit</code> nur in Schritt 0.',
  vars: () => ({ Schritt:0, Teil_Da:false, Unten:false, Oben:false, Hub_Auf:false, Hub_Ab:false, Lampe_Bereit:false }),
  must:['CASE'],
  ref: () => HUB_REF,
  visible: () => [{ steps:[[0.1,{Unten:true, Teil_Da:true},{Schritt:1, Hub_Auf:true}],[0.1,{Unten:false, Oben:true},{Schritt:2, Hub_Auf:false}]] }],
  hidden: () => [
    { steps:[[0.1,{Unten:true},{Schritt:0, Lampe_Bereit:true, Hub_Auf:false}],[0.1,{Teil_Da:true},{Schritt:1, Hub_Auf:true, Lampe_Bereit:false}],[0.1,{Unten:false},{Schritt:1, Hub_Auf:true}],[0.1,{Oben:true},{Schritt:2, Hub_Auf:false, Hub_Ab:false}],[0.1,{},{Schritt:2}],[0.1,{Teil_Da:false},{Schritt:3, Hub_Ab:true}],[0.1,{Oben:false},{Schritt:3, Hub_Ab:true}],[0.1,{Unten:true},{Schritt:0, Hub_Ab:false, Lampe_Bereit:true}]] },
    { steps:[[0.1,{Teil_Da:true},{Schritt:0}],[0.1,{},{Schritt:0, Hub_Auf:false}],[0.1,{Unten:true},{Schritt:1, Hub_Auf:true}]] },
    { setup:{Schritt:2, Hub_Auf:true, Teil_Da:true, Oben:true}, steps:[[0.1,{},{Schritt:2, Hub_Auf:false, Lampe_Bereit:false}],[0.1,{Teil_Da:false},{Schritt:3, Hub_Ab:true}]] },
    { setup:{Schritt:3, Unten:true, Hub_Ab:true}, steps:[[0.1,{},{Schritt:0, Lampe_Bereit:true, Hub_Ab:false}],[0.1,{},{Schritt:0}]] }
  ],
  wrong:[
    () => HUB_REF.replace('  1:\n    IF Oben', '  1:\n    Hub_Auf := TRUE;\n    IF Oben').replace('Hub_Auf := Schritt = 1;\n', ''),
    () => HUB_REF.replace('IF Teil_Da AND Unten THEN', 'IF Teil_Da THEN'),
    () => HUB_REF.replace('IF NOT Teil_Da THEN', 'IF Teil_Da THEN')
  ]
});

const BOHR = p => 'Bohr_Timer(IN := Schritt = 2, PT := T#' + p.T + 'S);\nCASE Schritt OF\n  0:\n    IF Start AND Teil_Da THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Gespannt THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF Bohr_Timer.Q THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    IF NOT Gespannt THEN\n      Stueck := Stueck + 1;\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nSpanner := Schritt = 1 OR Schritt = 2;\nBohrer := Schritt = 2;';
defExamTask({ id:'x_scl_g_bohrstation', quest:'scl', level:'grund', ch:10, diff:3, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Schrittkette Bohrstation',
  brief: p => 'Programmiere die Bohrstation als Schrittkette (<code>CASE Schritt OF</code>):<br>• <b>0 Grundstellung</b>: <code>Start</code> <b>und</b> <code>Teil_Da</code> → 1<br>• <b>1 Spannen</b>: sobald <code>Gespannt</code> → 2<br>• <b>2 Bohren</b>: nach <b>' + p.T + ' s</b> Bohrzeit → 3 (Instanz <code>Bohr_Timer</code>, TON)<br>• <b>3 Lösen</b>: sobald <code>Gespannt</code> = FALSE → <code>Stueck</code> um 1 erhöhen und → 0<br>Ausgänge nach dem CASE: <code>Spanner</code> in Schritt 1 und 2, <code>Bohrer</code> nur in Schritt 2.<br>Rufe den Timer in jedem Zyklus <b>vor</b> dem CASE auf: <code>IN := Schritt = 2</code>.',
  vars: () => ({ Schritt:0, Start:false, Teil_Da:false, Gespannt:false, Spanner:false, Bohrer:false, Stueck:0 }), fb: () => ({ Bohr_Timer:'TON' }),
  must:['CASE', 'TON'],
  ref: BOHR,
  visible: p => [{ setup:{Teil_Da:true}, steps:[[0.1,{Start:true},{Schritt:1, Spanner:true}],[0.1,{Start:false, Gespannt:true},{Schritt:2, Bohrer:true}],[0.1,{},{Schritt:2}],[p.T,{},{Schritt:3, Bohrer:false}]] }],
  hidden: p => [
    { steps:[[0.1,{Teil_Da:true},{Schritt:0}],[0.1,{Start:true},{Schritt:1, Spanner:true, Bohrer:false}],[0.1,{Start:false, Gespannt:true},{Schritt:2, Spanner:true, Bohrer:true}],[0.1,{},{Schritt:2}],[p.T - 0.2,{},{Schritt:2, Bohrer:true}],[0.1,{},{Schritt:2}],[0.1,{},{Schritt:3, Bohrer:false, Spanner:false}],[0.1,{},{Schritt:3, Stueck:0}],[0.1,{Gespannt:false},{Schritt:0, Stueck:1}],[0.1,{},{Schritt:0, Stueck:1}],
      [0.1,{Start:true},{Schritt:1}],[0.1,{Start:false, Gespannt:true},{Schritt:2}],[0.1,{},{Schritt:2}],[0.1,{},{Schritt:2, Bohrer:true}],[p.T - 0.1,{},{Schritt:3}],[0.1,{Gespannt:false},{Schritt:0, Stueck:2}]] },
    { steps:[[0.1,{Start:true},{Schritt:0, Spanner:false}],[0.1,{Teil_Da:true},{Schritt:1}]] },
    { setup:{Schritt:3, Gespannt:true, Stueck:5}, steps:[[0.1,{},{Schritt:3, Stueck:5, Spanner:false}],[0.1,{},{Stueck:5}],[0.1,{Gespannt:false},{Stueck:6, Schritt:0}]] },
    { setup:{Schritt:2, Gespannt:true}, steps:[[0.1,{},{Schritt:2, Spanner:true, Bohrer:true}],[p.T - 0.1,{},{Schritt:2}],[0.1,{},{Schritt:3}]] }
  ],
  wrong:[
    p => BOHR(p).replace('Bohr_Timer(IN := Schritt = 2, PT := T#' + p.T + 'S);\n', '').replace('  2:\n    IF Bohr_Timer.Q', '  2:\n    Bohr_Timer(IN := TRUE, PT := T#' + p.T + 'S);\n    IF Bohr_Timer.Q'),
    p => BOHR(p).replace('  3:\n    IF NOT Gespannt THEN\n      Stueck := Stueck + 1;\n', '  3:\n    Stueck := Stueck + 1;\n    IF NOT Gespannt THEN\n'),
    p => BOHR(p).replace('Spanner := Schritt = 1 OR Schritt = 2;', 'Spanner := Schritt >= 1;')
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

/* ---------- Profi-Stufe: weitere Aufgaben ---------- */
function puls(sig, n, expFn){ const o = []; for(let i = 1; i <= n; i++){ o.push([0.1, {[sig]: true}, expFn ? expFn(i) : {}]); o.push([0.1, {[sig]: false}, {}]); } return o; }

// ----- Kapitel 11: Deklaration nach vorgegebenem Code -----
const TANK_BODY = 'BEGIN\n   #Fuellstand := INT_TO_REAL(#Rohwert) / 27648.0 * 100.0;\n   #Voll := #Fuellstand >= #GRENZE_VOLL;\n   #Pumpe := #Freigabe AND NOT #Voll;\nEND_FUNCTION_BLOCK';
const TANK_DECL = (g, o) => { o = o || {};
  return 'FUNCTION_BLOCK "FB_Tank"\nVAR_INPUT\n   Rohwert : ' + (o.roh || 'Int') + ';      // Analogwert 0…27648\n   Freigabe : Bool;\nEND_VAR\nVAR_OUTPUT\n   Fuellstand : ' + (o.fs || 'Real') + ';   // Prozent\n' + (o.vollStat ? '' : '   Voll : Bool;\n') + '   Pumpe : Bool;\nEND_VAR\n' + (o.vollStat ? 'VAR\n   Voll : Bool;\nEND_VAR\n' : '') + 'VAR CONSTANT\n   GRENZE_VOLL : Real := ' + g + '.0;\nEND_VAR\n'; };
const pct = r => r / 27648 * 100;
defExamTask({ id:'x_scl_p_tank', quest:'scl', level:'profi', ch:11, diff:1,
  params:{ G:[80, 85, 90] },
  title:'Schnittstelle des Tankbausteins',
  brief: p => 'Der Code von <code>FB_Tank</code> ist fertig. Schreibe die <b>Deklaration</b> vor <code>BEGIN</code>:<br>• Eingänge: <code>Rohwert</code> (ganzzahliger Analogwert 0 … 27648), <code>Freigabe</code> (ja/nein)<br>• Ausgänge: <code>Fuellstand</code> (Kommazahl in %), <code>Voll</code> und <code>Pumpe</code> (ja/nein)<br>• Konstante: <code>GRENZE_VOLL</code> = <b>' + p.G + '.0</b> % (Kommazahl)<br><code>Main</code> (🔒) ruft den FB mit <code>"Tank_Roh"</code> und <code>"Pumpe_Frei"</code> auf.',
  blocks: p => [
    { name:'FB_Tank', kind:'FB', edit:true, start:'FUNCTION_BLOCK "FB_Tank"\n// Eingänge:  Rohwert, Freigabe\n// Ausgänge:  Fuellstand, Voll, Pumpe\n// Konstante: GRENZE_VOLL\n\n' + TANK_BODY, ref: TANK_DECL(p.G) + TANK_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Tank_DB"(Rohwert := "Tank_Roh", Freigabe := "Pumpe_Frei", Fuellstand => "Tank_Prozent", Voll => "Tank_Voll", Pumpe => "Pumpe_Ein");') }
  ],
  globals: () => ({ Tank_Roh:0, Pumpe_Frei:false, Tank_Prozent:0, Tank_Voll:false, Pumpe_Ein:false }), types: () => ({ Tank_Roh:'INT', Tank_Prozent:'REAL' }),
  must:['VAR_INPUT', 'VAR_OUTPUT', 'VAR_CONSTANT', 'REAL'],
  visible: () => ({ tests:[[{Tank_Roh:13824, Pumpe_Frei:true},{Tank_Prozent:50, Tank_Voll:false, Pumpe_Ein:true}]] }),
  hidden: p => { const hi = Math.ceil(p.G * 276.48); return {
    unit:[{ block:'FB_Tank', steps:[[{Rohwert:0, Freigabe:true},{Fuellstand:0, Voll:false, Pumpe:true}],[{Rohwert:hi - 1},{Fuellstand:pct(hi - 1), Voll:false, Pumpe:true}],[{Rohwert:hi},{Fuellstand:pct(hi), Voll:true, Pumpe:false}],[{Rohwert:27648},{Fuellstand:100, Voll:true, Pumpe:false}],[{Rohwert:6912, Freigabe:false},{Fuellstand:25, Voll:false, Pumpe:false}]] }],
    tests:[[{Tank_Roh:hi, Pumpe_Frei:true},{Tank_Prozent:pct(hi), Tank_Voll:true, Pumpe_Ein:false}],[{Tank_Roh:hi - 1, Pumpe_Frei:true},{Tank_Voll:false, Pumpe_Ein:true}],[{Tank_Roh:20736, Pumpe_Frei:false},{Tank_Prozent:75, Pumpe_Ein:false}]]
  }; },
  wrong:[
    p => ({ FB_Tank: TANK_DECL(p.G, {roh:'Real'}) + TANK_BODY }),
    p => ({ FB_Tank: TANK_DECL(p.G, {fs:'Int'}) + TANK_BODY }),
    p => ({ FB_Tank: TANK_DECL(p.G, {vollStat:true}) + TANK_BODY })
  ]
});

// ----- Kapitel 11: statische Variable, DInt -----
const HUB_HEAD = p => 'FUNCTION_BLOCK "FB_Hubzaehler"\nVAR_INPUT\n   Hub : Bool;       // Endschalter: Presse unten\n   Reset : Bool;     // nach der Wartung\nEND_VAR\nVAR_OUTPUT\n   Hubzahl : DInt;\n   Wartung : Bool;\nEND_VAR\nVAR CONSTANT\n   INTERVALL : DInt := ' + p.P + ';\nEND_VAR\n';
const HUB_BODY = 'BEGIN\n   IF #Hub AND NOT #Hub_alt THEN\n      #Zaehler := #Zaehler + 1;\n   END_IF;\n   #Hub_alt := #Hub;\n   IF #Reset THEN\n      #Zaehler := 0;\n   END_IF;\n   #Hubzahl := #Zaehler;\n   #Wartung := #Zaehler >= #INTERVALL;\nEND_FUNCTION_BLOCK';
defExamTask({ id:'x_scl_p_hubzaehler', quest:'scl', level:'profi', ch:11, diff:2,
  params:{ P:[40000, 50000, 60000] },
  title:'Hubzähler der Presse',
  brief: p => 'Die Presse braucht nach <b>' + p.P + '</b> Hüben eine Wartung. Ergänze <code>FB_Hubzaehler</code>:<br>• Lege die <b>statischen</b> Variablen <code>Zaehler</code> und <code>Hub_alt</code> an — wähle einen Typ, der bis ' + p.P + ' und weiter zählen kann.<br>• Jede <b>steigende Flanke</b> von <code>Hub</code> erhöht <code>Zaehler</code> um 1 (<code>Hub_alt</code> merkt sich <code>Hub</code> aus dem letzten Zyklus).<br>• <code>Reset</code> setzt <code>Zaehler</code> auf 0.<br>• <code>Hubzahl</code> = <code>Zaehler</code>; <code>Wartung</code> ist TRUE, sobald <code>Zaehler</code> ≥ <code>INTERVALL</code>.<br><code>Main</code> (🔒) ruft die Instanz <code>"Presse_Hub"</code> auf.',
  blocks: p => [
    { name:'FB_Hubzaehler', kind:'FB', edit:true, start: HUB_HEAD(p) + 'VAR\n   // TODO: Zaehler, Hub_alt\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK',
      ref: HUB_HEAD(p) + 'VAR\n   Zaehler : DInt;   // Hübe seit der letzten Wartung\n   Hub_alt : Bool;   // Hub im letzten Zyklus\nEND_VAR\n' + HUB_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Presse_Hub"(Hub := "S_Hub", Reset := "S_Reset", Hubzahl => "Hubzahl", Wartung => "H_Wartung");') }
  ],
  instances: () => ({ Presse_Hub:'FB_Hubzaehler' }),
  globals: () => ({ S_Hub:false, S_Reset:false, Hubzahl:0, H_Wartung:false }), types: () => ({ Hubzahl:'DINT' }),
  must:['STAT', 'DINT'], warnFree:['TEMP_READ_BEFORE_WRITE'],
  visible: () => ({ timed:[{ steps:[[0.1,{S_Hub:true},{Hubzahl:1}],[0.1,{S_Hub:true},{Hubzahl:1}],[0.1,{S_Hub:false},{Hubzahl:1}],[0.1,{S_Hub:true},{Hubzahl:2, H_Wartung:false}]] }] }),
  hidden: p => ({
    unit:[
      { block:'FB_Hubzaehler', setup:{Zaehler:32766}, steps: puls('Hub', 3, i => ({Hubzahl:32766 + i, Wartung:false})) },
      { block:'FB_Hubzaehler', setup:{Zaehler:p.P - 2}, steps:[[0.1,{Hub:true},{Hubzahl:p.P - 1, Wartung:false}],[0.1,{Hub:false},{Wartung:false}],[0.1,{Hub:true},{Hubzahl:p.P, Wartung:true}],[0.1,{Hub:true},{Hubzahl:p.P}],[0.1,{Hub:false, Reset:true},{Hubzahl:0, Wartung:false}],[0.1,{Reset:false, Hub:true},{Hubzahl:1}]] }
    ],
    timed:[{ steps:[[0.1,{},{Hubzahl:0, H_Wartung:false}]].concat(puls('S_Hub', 4, i => ({Hubzahl:i}))).concat([[0.1,{S_Reset:true},{Hubzahl:0}],[0.1,{S_Reset:false, S_Hub:true},{Hubzahl:1}]]) }]
  }),
  wrong:[
    p => ({ FB_Hubzaehler: HUB_HEAD(p) + 'VAR\n   Zaehler : Int;\n   Hub_alt : Bool;\nEND_VAR\n' + HUB_BODY }),
    p => ({ FB_Hubzaehler: HUB_HEAD(p) + 'VAR\n   Hub_alt : Bool;\nEND_VAR\nVAR_TEMP\n   Zaehler : DInt;\nEND_VAR\n' + HUB_BODY }),
    p => ({ FB_Hubzaehler: HUB_HEAD(p) + 'VAR\n   Zaehler : DInt;\n   Hub_alt : Bool;\nEND_VAR\n' + HUB_BODY.replace('IF #Hub AND NOT #Hub_alt THEN', 'IF #Hub THEN') })
  ]
});

// ----- Kapitel 12: IN_OUT -----
const RAMPE_HEAD = io => 'FUNCTION "FC_Rampe" : Void\nVAR_INPUT\n   Soll : Int;       // Zieldrehzahl\n   Schritt : Int;    // grösste Änderung pro Aufruf\n' + (io === 'in' ? '   Ist : Int;\n' : '') + 'END_VAR\nVAR_OUTPUT\n   Erreicht : Bool;\nEND_VAR\n' + (io === 'in' ? '' : 'VAR_IN_OUT\n   Ist : Int;        // aktuelle Drehzahl, wird verändert\nEND_VAR\n');
const RAMPE_BODY = 'BEGIN\n   IF #Ist < #Soll THEN\n      #Ist := MIN(IN1 := #Ist + #Schritt, IN2 := #Soll);\n   ELSIF #Ist > #Soll THEN\n      #Ist := MAX(IN1 := #Ist - #Schritt, IN2 := #Soll);\n   END_IF;\n   #Erreicht := #Ist = #Soll;\nEND_FUNCTION';
defExamTask({ id:'x_scl_p_rampe', quest:'scl', level:'profi', ch:12, diff:2,
  params:{ S:[5, 10, 25] },
  title:'Drehzahlrampe (IN_OUT)',
  brief: p => '<code>FC_Rampe</code> führt die Drehzahl <code>Ist</code> schrittweise an <code>Soll</code> heran — pro Aufruf um höchstens <code>Schritt</code>, ohne über das Ziel hinauszuschiessen.<br>• Ergänze den Parameter <code>Ist</code> (Int). Die FC muss den Wert des Aufrufers <b>lesen und verändern</b> — wähle den passenden Bereich.<br>• Ist &lt; Soll: um <code>Schritt</code> erhöhen, höchstens bis <code>Soll</code>; Ist &gt; Soll: entsprechend verringern.<br>• <code>Erreicht</code> ist TRUE, wenn nach der Änderung <code>Ist</code> = <code>Soll</code> ist.<br><code>Main</code> (🔒) ruft die FC in jedem Zyklus mit <code>"Drehzahl"</code> und <code>Schritt := ' + p.S + '</code> auf.',
  blocks: p => [
    { name:'FC_Rampe', kind:'FC', edit:true, start: RAMPE_HEAD('none') .replace('VAR_IN_OUT\n   Ist : Int;        // aktuelle Drehzahl, wird verändert\nEND_VAR\n', '// TODO: Parameter Ist\n') + 'BEGIN\n   \nEND_FUNCTION', ref: RAMPE_HEAD('io') + RAMPE_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Rampe"(Soll := "Drehzahl_Soll", Schritt := ' + p.S + ', Erreicht => "Drehzahl_OK", Ist := "Drehzahl");') }
  ],
  globals: () => ({ Drehzahl:0, Drehzahl_Soll:0, Drehzahl_OK:false }),
  must:['FC', 'VAR_IN_OUT'], warnFree:['OUT_NOT_ALL_PATHS'],
  visible: p => ({ unit:[{ block:'FC_Rampe', steps:[[{Ist:0, Soll:100, Schritt:10},{Ist:10, Erreicht:false}],[{},{Ist:20}]] }] }),
  hidden: p => { const S = p.S; return {
    unit:[{ block:'FC_Rampe', steps:[[{Ist:95, Soll:100, Schritt:10},{Ist:100, Erreicht:true}],[{},{Ist:100, Erreicht:true}],[{Soll:70},{Ist:90, Erreicht:false}],[{},{Ist:80}],[{},{Ist:70, Erreicht:true}],[{Soll:-5, Schritt:100},{Ist:-5, Erreicht:true}]] }],
    timed:[
      { setup:{Drehzahl_Soll:3 * S + 2}, steps:[[0.1,{},{Drehzahl:S, Drehzahl_OK:false}],[0.1,{},{Drehzahl:2 * S}],[0.1,{},{Drehzahl:3 * S, Drehzahl_OK:false}],[0.1,{},{Drehzahl:3 * S + 2, Drehzahl_OK:true}],[0.1,{},{Drehzahl:3 * S + 2, Drehzahl_OK:true}]] },
      { setup:{Drehzahl:2 * S, Drehzahl_Soll:0}, steps:[[0.1,{},{Drehzahl:S}],[0.1,{},{Drehzahl:0, Drehzahl_OK:true}],[0.1,{Drehzahl_Soll:S},{Drehzahl:S, Drehzahl_OK:true}]] }
    ]
  }; },
  wrong:[
    () => ({ FC_Rampe: RAMPE_HEAD('in') + RAMPE_BODY }),
    () => ({ FC_Rampe: RAMPE_HEAD('io') + 'BEGIN\n   IF #Ist < #Soll THEN\n      #Ist := #Ist + #Schritt;\n   ELSIF #Ist > #Soll THEN\n      #Ist := #Ist - #Schritt;\n   END_IF;\n   #Erreicht := #Ist = #Soll;\nEND_FUNCTION' }),
    () => ({ FC_Rampe: RAMPE_HEAD('io') + 'BEGIN\n   #Erreicht := #Ist = #Soll;\n   IF #Ist < #Soll THEN\n      #Ist := MIN(IN1 := #Ist + #Schritt, IN2 := #Soll);\n   ELSIF #Ist > #Soll THEN\n      #Ist := MAX(IN1 := #Ist - #Schritt, IN2 := #Soll);\n   END_IF;\nEND_FUNCTION' })
  ]
});

// ----- Kapitel 12: FC mit Array, Rückgabewert und Ausgängen -----
const STAT_HEAD = 'FUNCTION "FC_Statistik" : Bool\nVAR_INPUT\n   Toleranz : Real;   // erlaubte Spanne\nEND_VAR\nVAR_OUTPUT\n   Min : Real;\n   Max : Real;\n   Mittel : Real;\nEND_VAR\nVAR_IN_OUT\n   Werte : Array[1..6] of Real;\nEND_VAR\nVAR_TEMP\n   i : Int;\n   Summe : Real;\nEND_VAR\n';
const STAT_REF = STAT_HEAD + 'BEGIN\n   #Min := #Werte[1];\n   #Max := #Werte[1];\n   #Summe := 0.0;\n   FOR #i := 1 TO 6 DO\n      IF #Werte[#i] < #Min THEN\n         #Min := #Werte[#i];\n      END_IF;\n      IF #Werte[#i] > #Max THEN\n         #Max := #Werte[#i];\n      END_IF;\n      #Summe := #Summe + #Werte[#i];\n   END_FOR;\n   #Mittel := #Summe / 6.0;\n   #FC_Statistik := #Max - #Min <= #Toleranz;\nEND_FUNCTION';
const stat = (w, tol) => { const mn = Math.min(...w), mx = Math.max(...w); return { Min:mn, Max:mx, Mittel:w.reduce((a, b) => a + b, 0) / 6, RET:mx - mn <= tol }; };
defExamTask({ id:'x_scl_p_statistik', quest:'scl', level:'profi', ch:12, diff:3,
  params:{ TOL:[0.5, 1.0, 2.0] },
  title:'Messreihe auswerten (FC)',
  brief: p => 'Die Schnittstelle von <code>FC_Statistik</code> steht. Schreibe den Code für die sechs Werte <code>Werte[1]</code> … <code>Werte[6]</code>:<br>• <code>Min</code>, <code>Max</code>: kleinster und grösster Wert (Startwert: <code>Werte[1]</code>)<br>• <code>Mittel</code>: Durchschnitt aller sechs Werte<br>• Rückgabewert: TRUE (Messung stabil), wenn <code>Max − Min</code> höchstens <code>Toleranz</code> beträgt<br>Alle Ausgänge und der Rückgabewert müssen in jedem Aufruf gesetzt werden. <code>Main</code> (🔒) übergibt <code>"Messreihe"</code> mit <code>Toleranz := ' + p.TOL.toFixed(1) + '</code>.',
  blocks: p => [
    { name:'FC_Statistik', kind:'FC', edit:true, start: STAT_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: STAT_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Stabil" := "FC_Statistik"(Toleranz := ' + p.TOL.toFixed(1) + ', Min => "Min_Wert", Max => "Max_Wert", Mittel => "Mittelwert", Werte := "Messreihe");') }
  ],
  globals: () => ({ Messreihe:[0,0,0,0,0,0], Stabil:false, Min_Wert:0, Max_Wert:0, Mittelwert:0 }),
  types: () => ({ Messreihe:'ARRAY[1..6] OF REAL', Min_Wert:'REAL', Max_Wert:'REAL', Mittelwert:'REAL' }),
  must:['FOR', 'RETVAL'], warnFree:['RET_NOT_SET', 'OUT_NOT_ALL_PATHS', 'TEMP_READ_BEFORE_WRITE'],
  visible: p => { const w = [20.0, 20.5, 21.0, 20.0, 20.5, 21.0]; return { unit:[{ block:'FC_Statistik', steps:[[{Werte:w, Toleranz:2.0}, stat(w, 2.0)]] }] }; },
  hidden: p => { const T = p.TOL;
    const sets = [[50.0, 50.0 + T, 50.25, 50.5, 50.0, 50.0], [50.0, 50.0 + T + 0.25, 50.0, 50.0, 50.0, 50.0], [80.0, 81.0, 82.0, 83.0, 84.0, 85.0], [-3.0, -1.5, -2.0, -2.5, -1.0, -2.0], [7.0, 7.0, 7.0, 7.0, 7.0, 7.0], [10.0, 10.0, 10.0, 10.0, 10.0, 4.0]];
    return { unit: [sets.slice(0, 3), sets.slice(3)].map(g => ({ block:'FC_Statistik', steps: g.map(w => [{Werte:w, Toleranz:T}, stat(w, T)]) })),
      tests:[[{Messreihe:sets[0]},{Stabil:true, Min_Wert:50, Max_Wert:50 + T}],[{Messreihe:sets[2], Stabil:true},{Stabil:false, Mittelwert:82.5}]] }; },
  wrong:[
    () => ({ FC_Statistik: STAT_REF.replace('#Min := #Werte[1];', '#Min := 0.0;') }),
    () => ({ FC_Statistik: STAT_REF.replace('FOR #i := 1 TO 6 DO', 'FOR #i := 1 TO 5 DO') }),
    () => ({ FC_Statistik: STAT_REF.replace('#Max - #Min <= #Toleranz', '#Max - #Min < #Toleranz') })
  ]
});

// ----- Kapitel 13: Einzelinstanzen -----
const FBZ = 'FUNCTION_BLOCK "FB_Zaehler"\nVAR_INPUT\n   Teil : Bool;\n   Max : Int;\n   Reset : Bool;\nEND_VAR\nVAR_OUTPUT\n   Anzahl : Int;\n   Voll : Bool;\nEND_VAR\nVAR\n   Merker : Bool;\nEND_VAR\nBEGIN\n   IF #Teil AND NOT #Merker AND #Anzahl < #Max THEN\n      #Anzahl := #Anzahl + 1;\n   END_IF;\n   #Merker := #Teil;\n   IF #Reset THEN\n      #Anzahl := 0;\n   END_IF;\n   #Voll := #Anzahl >= #Max;\nEND_FUNCTION_BLOCK';
const ZI_REF = m => MAIN('   "Zaehler_Gut"(Teil := "S_Gut", Max := ' + m + ', Reset := "S_Reset");\n   "Zaehler_Schlecht"(Teil := "S_Schlecht", Max := ' + m + ', Reset := "S_Reset");\n   "Gesamt" := "Zaehler_Gut".Anzahl + "Zaehler_Schlecht".Anzahl;\n   "Charge_Fertig" := "Zaehler_Gut".Voll;');
defExamTask({ id:'x_scl_p_zwei_instanzen', quest:'scl', level:'profi', ch:13, diff:1,
  params:{ M:[4, 5, 6] },
  title:'Gut- und Schlechtteile zählen',
  brief: p => '<code>FB_Zaehler</code> (🔒) zählt Teile per Flanke bis <code>Max</code>. Im Projekt gibt es die Instanz-DBs <code>"Zaehler_Gut"</code> und <code>"Zaehler_Schlecht"</code>. Schreibe <code>Main</code>:<br>• <code>"Zaehler_Gut"</code> zählt <code>"S_Gut"</code>, <code>"Zaehler_Schlecht"</code> zählt <code>"S_Schlecht"</code> — beide mit <code>Max := ' + p.M + '</code> und <code>Reset := "S_Reset"</code><br>• <code>"Gesamt"</code> = Summe der beiden Zählerstände (Ausgang <code>Anzahl</code>, gelesen über den Instanz-DB)<br>• <code>"Charge_Fertig"</code> = <code>Voll</code> des Gutteilzählers',
  blocks: p => [
    { name:'FB_Zaehler', kind:'FB', src: FBZ },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // zwei Zähler, Summe, Charge fertig\n'), ref: ZI_REF(p.M) }
  ],
  instances: () => ({ Zaehler_Gut:'FB_Zaehler', Zaehler_Schlecht:'FB_Zaehler' }),
  globals: () => ({ S_Gut:false, S_Schlecht:false, S_Reset:false, Gesamt:0, Charge_Fertig:false }),
  must:['SINGLE', 'MEMBER'], warnFree:['INSTANCE_TWICE'],
  visible: () => ({ timed:[{ steps:[[0.1,{S_Gut:true},{Gesamt:1}],[0.1,{S_Gut:false, S_Schlecht:true},{Gesamt:2}],[0.1,{S_Schlecht:false},{Gesamt:2, Charge_Fertig:false}]] }] }),
  hidden: p => ({
    timed:[
      { steps: puls('S_Gut', p.M - 1, i => ({Gesamt:i, Charge_Fertig:false})).concat(puls('S_Gut', 2, () => ({Gesamt:p.M, Charge_Fertig:true, 'Zaehler_Gut.Anzahl':p.M}))) },
      { steps: puls('S_Schlecht', p.M, i => ({Gesamt:i, Charge_Fertig:false, 'Zaehler_Schlecht.Anzahl':i, 'Zaehler_Gut.Anzahl':0})).concat([[0.1,{S_Gut:true},{Gesamt:p.M + 1, Charge_Fertig:false}]]) },
      { steps:[[0.1,{S_Gut:true, S_Schlecht:true},{Gesamt:2}],[0.1,{S_Gut:false, S_Schlecht:false},{Gesamt:2}],[0.1,{S_Reset:true},{Gesamt:0, Charge_Fertig:false}],[0.1,{S_Reset:false, S_Gut:true},{Gesamt:1}]] }
    ]
  }),
  wrong:[
    p => ({ Main: MAIN('   "Zaehler_Gut"(Teil := "S_Gut", Max := ' + p.M + ', Reset := "S_Reset");\n   "Zaehler_Gut"(Teil := "S_Schlecht", Max := ' + p.M + ', Reset := "S_Reset");\n   "Gesamt" := "Zaehler_Gut".Anzahl + "Zaehler_Schlecht".Anzahl;\n   "Charge_Fertig" := "Zaehler_Gut".Voll;') }),
    p => ({ Main: ZI_REF(p.M).replace('"Charge_Fertig" := "Zaehler_Gut".Voll;', '"Charge_Fertig" := "Zaehler_Gut".Voll OR "Zaehler_Schlecht".Voll;') }),
    p => ({ Main: ZI_REF(p.M).replace('"Zaehler_Schlecht"(Teil := "S_Schlecht", Max := ' + p.M + ', Reset := "S_Reset");', '"Zaehler_Schlecht"(Teil := "S_Schlecht", Max := ' + p.M + ', Reset := FALSE);') })
  ]
});

// ----- Kapitel 13: Timer als Multiinstanz -----
const ZYL_HEAD = 'FUNCTION_BLOCK "FB_Zylinder"\nVAR_INPUT\n   Ausfahren : Bool;     // Befehl\n   Endlage_Aus : Bool;   // Sensor ausgefahren\n   Endlage_Ein : Bool;   // Sensor eingefahren\n   Max_Zeit : Time;      // Überwachungszeit\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Ventil : Bool;\n   In_Position : Bool;\n   Stoerung : Bool;\nEND_VAR\nVAR\n   Ueberwachung : TON;\nEND_VAR\n';
const ZYL_BODY = 'BEGIN\n   #Ueberwachung(IN := (#Ausfahren AND NOT #Endlage_Aus) OR (NOT #Ausfahren AND NOT #Endlage_Ein), PT := #Max_Zeit);\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n   END_IF;\n   IF #Quittieren AND NOT #Ueberwachung.Q THEN\n      #Stoerung := FALSE;\n   END_IF;\n   #Ventil := #Ausfahren AND NOT #Stoerung;\n   #In_Position := (#Ausfahren AND #Endlage_Aus) OR (NOT #Ausfahren AND #Endlage_Ein);\nEND_FUNCTION_BLOCK';
defExamTask({ id:'x_scl_p_zylinder', quest:'scl', level:'profi', ch:13, diff:3,
  params:{ T:[1, 2, 3] },
  title:'Zylinder mit Endlagenüberwachung',
  brief: p => 'Die Schnittstelle von <code>FB_Zylinder</code> steht, inklusive Multiinstanz <code>Ueberwachung : TON</code>. Schreibe den Code:<br>• <code>#Ueberwachung</code> läuft in <b>jedem</b> Zyklus: <code>IN</code> ist TRUE, solange die befohlene Endlage fehlt (Ausfahren ohne <code>Endlage_Aus</code> <b>oder</b> Einfahren ohne <code>Endlage_Ein</code>), <code>PT := #Max_Zeit</code>.<br>• Läuft die Zeit ab: <code>Stoerung</code> := TRUE (bleibt gespeichert).<br>• <code>Quittieren</code> setzt <code>Stoerung</code> zurück, aber nur wenn <code>#Ueberwachung.Q</code> FALSE ist.<br>• Erst danach: <code>Ventil</code> := Ausfahren und keine Störung.<br>• <code>In_Position</code>: die befohlene Endlage ist erreicht.<br><code>Main</code> (🔒) ruft die Instanz <code>"Zyl_Greifer"</code> mit <code>Max_Zeit := T#' + p.T + 'S</code> auf.',
  blocks: p => [
    { name:'FB_Zylinder', kind:'FB', edit:true, start: ZYL_HEAD + 'BEGIN\n   \nEND_FUNCTION_BLOCK', ref: ZYL_HEAD + ZYL_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Zyl_Greifer"(Ausfahren := "Greifer_Befehl", Endlage_Aus := "B_Aus", Endlage_Ein := "B_Ein", Max_Zeit := T#' + p.T + 'S,\n                 Quittieren := "S_Quit", Ventil => "Y_Greifer", In_Position => "Greifer_OK", Stoerung => "H_Stoerung");') }
  ],
  instances: () => ({ Zyl_Greifer:'FB_Zylinder' }),
  globals: () => ({ Greifer_Befehl:false, B_Aus:false, B_Ein:true, S_Quit:false, Y_Greifer:false, Greifer_OK:false, H_Stoerung:false }),
  must:['TON'], warnFree:['CONDITIONAL_CALL'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{Y_Greifer:false, Greifer_OK:true}],[0.1,{Greifer_Befehl:true},{Y_Greifer:true, Greifer_OK:false}],[0.5,{B_Ein:false, B_Aus:true},{Greifer_OK:true, H_Stoerung:false}]] }] }),
  hidden: p => { const T = p.T; return {
    unit:[
      { block:'FB_Zylinder', steps:[[0.1,{Endlage_Ein:true, Max_Zeit:T},{Ventil:false, In_Position:true, Stoerung:false}],[0.1,{Ausfahren:true},{Ventil:true, In_Position:false}],[0.1,{Endlage_Ein:false},{Stoerung:false}],[T - 0.3,{},{Stoerung:false, Ventil:true}],[0.1,{},{Stoerung:false}],[0.1,{},{Stoerung:true, Ventil:false}],[0.1,{Quittieren:true},{Stoerung:true}],[0.1,{Quittieren:false, Endlage_Aus:true},{Stoerung:true, Ventil:false}],[0.1,{Quittieren:true},{Stoerung:false, Ventil:true, In_Position:true}],[0.1,{Quittieren:false},{Stoerung:false}]] },
      { block:'FB_Zylinder', steps:[[0.1,{Endlage_Ein:true, Max_Zeit:T},{}],[0.1,{Ausfahren:true},{Ventil:true}],[0.2,{Endlage_Ein:false},{}],[0.3,{Endlage_Aus:true},{In_Position:true}],[T + 1,{},{Stoerung:false, Ventil:true}],[0.1,{Ausfahren:false},{Ventil:false, In_Position:false}],[0.3,{Endlage_Aus:false},{}],[T - 0.5,{Endlage_Ein:true},{In_Position:true, Stoerung:false}],[T + 1,{},{Stoerung:false}]] }
    ],
    timed:[{ steps:[[0.1,{},{Greifer_OK:true}],[0.1,{B_Ein:false},{H_Stoerung:false, Greifer_OK:false}],[T,{},{H_Stoerung:true, Y_Greifer:false}],[0.1,{B_Ein:true},{H_Stoerung:true}],[0.1,{S_Quit:true},{H_Stoerung:false, Greifer_OK:true}]] }]
  }; },
  wrong:[
    () => ({ FB_Zylinder: ZYL_HEAD + ZYL_BODY.replace('   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n   END_IF;\n   IF #Quittieren AND NOT #Ueberwachung.Q THEN\n      #Stoerung := FALSE;\n   END_IF;\n', '   #Stoerung := #Ueberwachung.Q;\n') }),
    () => ({ FB_Zylinder: ZYL_HEAD + ZYL_BODY.replace('#Ventil := #Ausfahren AND NOT #Stoerung;', '#Ventil := #Ausfahren;') }),
    () => ({ FB_Zylinder: ZYL_HEAD + ZYL_BODY.replace('   #Ueberwachung(IN := (#Ausfahren AND NOT #Endlage_Aus) OR (NOT #Ausfahren AND NOT #Endlage_Ein), PT := #Max_Zeit);\n', '   IF #Ausfahren THEN\n      #Ueberwachung(IN := NOT #Endlage_Aus, PT := #Max_Zeit);\n   END_IF;\n') })
  ]
});

// ----- Kapitel 14: UDT über IN_OUT -----
const UDT_AUF = 'TYPE "UDT_Auftrag"\nVERSION : 0.1\n   STRUCT\n      Nummer : DInt;\n      Soll : Int;         // Gutteile laut Auftrag\n      Gut : Int;\n      Ausschuss : Int;\n      Fertig : Bool;\n   END_STRUCT;\nEND_TYPE';
const DB_AUF = 'DATA_BLOCK "DB_Auftrag"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Auftrag : "UDT_Auftrag";\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const BUCH_HEAD = 'FUNCTION "FC_Buchen" : Void\nVAR_INPUT\n   Gut_Teil : Bool;       // Impuls: Gutteil fertig\n   Schlecht_Teil : Bool;  // Impuls: Ausschuss\nEND_VAR\nVAR_OUTPUT\n   Rest : Int;            // fehlende Gutteile (nie negativ)\nEND_VAR\nVAR_IN_OUT\n   Auftrag : "UDT_Auftrag";\nEND_VAR\n';
const BUCH_REF = BUCH_HEAD + 'BEGIN\n   IF NOT #Auftrag.Fertig THEN\n      IF #Gut_Teil THEN\n         #Auftrag.Gut := #Auftrag.Gut + 1;\n      END_IF;\n      IF #Schlecht_Teil THEN\n         #Auftrag.Ausschuss := #Auftrag.Ausschuss + 1;\n      END_IF;\n   END_IF;\n   #Auftrag.Fertig := #Auftrag.Gut >= #Auftrag.Soll;\n   #Rest := MAX(IN1 := #Auftrag.Soll - #Auftrag.Gut, IN2 := 0);\nEND_FUNCTION';
const auf = (soll, gut, aus, fertig) => ({ 'DB_Auftrag.Auftrag.Soll':soll, 'DB_Auftrag.Auftrag.Gut':gut, 'DB_Auftrag.Auftrag.Ausschuss':aus, 'DB_Auftrag.Auftrag.Fertig':fertig });
defExamTask({ id:'x_scl_p_auftrag', quest:'scl', level:'profi', ch:14, diff:2,
  params:{ S:[10, 20, 50] },
  title:'Auftrag buchen (UDT)',
  brief: p => 'Ein Fertigungsauftrag ist im Datentyp <code>"UDT_Auftrag"</code> (🔒) beschrieben und liegt in <code>"DB_Auftrag".Auftrag</code>. Schreibe den Code von <code>FC_Buchen</code>:<br>• Solange der Auftrag <b>nicht</b> <code>Fertig</code> ist: <code>Gut_Teil</code> erhöht <code>Gut</code>, <code>Schlecht_Teil</code> erhöht <code>Ausschuss</code> (je um 1).<br>• Danach: <code>Fertig</code> := <code>Gut</code> ≥ <code>Soll</code>.<br>• <code>Rest</code> = <code>Soll − Gut</code>, aber nie kleiner als 0.<br>Zugriff auf Elemente: <code>#Auftrag.Gut</code>. Im Test hat der Auftrag z.B. <code>Soll</code> = ' + p.S + '.',
  blocks: () => [
    { name:'UDT_Auftrag', kind:'UDT', src: UDT_AUF },
    { name:'DB_Auftrag', kind:'DB', src: DB_AUF },
    { name:'FC_Buchen', kind:'FC', edit:true, start: BUCH_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: BUCH_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Buchen"(Gut_Teil := "Imp_Gut", Schlecht_Teil := "Imp_Schlecht", Rest => "Rest", Auftrag := "DB_Auftrag".Auftrag);') }
  ],
  globals: () => ({ Imp_Gut:false, Imp_Schlecht:false, Rest:0 }),
  must:['MEMBER', 'UDT_REF'], warnFree:['OUT_NOT_ALL_PATHS'],
  visible: p => ({ tests:[[Object.assign(auf(p.S, 3, 1, false), {Imp_Gut:true}), Object.assign(auf(p.S, 4, 1, false), {Rest:p.S - 4})]] }),
  hidden: p => { const S = p.S; return {
    tests:[
      [Object.assign(auf(S, 0, 0, false), {Imp_Schlecht:true}), Object.assign(auf(S, 0, 1, false), {Rest:S})],
      [Object.assign(auf(S, S - 1, 2, false), {Imp_Gut:true}), Object.assign(auf(S, S, 2, true), {Rest:0})],
      [Object.assign(auf(S, S - 2, 0, false), {Imp_Gut:true, Rest:5}), Object.assign(auf(S, S - 1, 0, false), {Rest:1})],
      [Object.assign(auf(S, S, 3, true), {Imp_Gut:true, Imp_Schlecht:true}), Object.assign(auf(S, S, 3, true), {Rest:0})],
      [Object.assign(auf(S, S + 2, 0, false), {}), Object.assign(auf(S, S + 2, 0, true), {Rest:0})],
      [Object.assign(auf(S, 5, 5, false), {Imp_Gut:true, Imp_Schlecht:true}), Object.assign(auf(S, 6, 6, false), {Rest:S - 6})]
    ],
    timed:[{ setup:auf(S, S - 2, 0, false), steps:[[0.1,{Imp_Gut:true},{Rest:1}],[0.1,{Imp_Gut:false},{Rest:1}],[0.1,{Imp_Gut:true},{Rest:0, 'DB_Auftrag.Auftrag.Fertig':true}],[0.1,{Imp_Gut:true, Imp_Schlecht:true},{'DB_Auftrag.Auftrag.Gut':S, 'DB_Auftrag.Auftrag.Ausschuss':0}]] }]
  }; },
  wrong:[
    () => ({ FC_Buchen: BUCH_REF.replace('   IF NOT #Auftrag.Fertig THEN\n', '   IF TRUE THEN\n') }),
    () => ({ FC_Buchen: BUCH_REF.replace('#Rest := MAX(IN1 := #Auftrag.Soll - #Auftrag.Gut, IN2 := 0);', '#Rest := #Auftrag.Soll - #Auftrag.Gut;') }),
    () => ({ FC_Buchen: BUCH_REF.replace('#Auftrag.Fertig := #Auftrag.Gut >= #Auftrag.Soll;', '#Auftrag.Fertig := #Auftrag.Gut > #Auftrag.Soll;') })
  ]
});

// ----- Kapitel 14: STRING -----
const TXT_HEAD = 'FUNCTION "FC_Statustext" : String[40]\nVAR_INPUT\n   Station : String[12];\n   Anzahl : Int;\n   Stoerung : Bool;\nEND_VAR\n';
const TXT_REF = TXT_HEAD + 'BEGIN\n   IF #Stoerung THEN\n      #FC_Statustext := CONCAT(IN1 := #Station, IN2 := \': STOERUNG\');\n   ELSE\n      #FC_Statustext := CONCAT(IN1 := #Station, IN2 := \': \', IN3 := INT_TO_STRING(#Anzahl), IN4 := \' Teile\');\n   END_IF;\nEND_FUNCTION';
defExamTask({ id:'x_scl_p_statustext', quest:'scl', level:'profi', ch:14, diff:2,
  params:{ NAME:['Presse', 'Ofen', 'Band 2'] },
  title:'Statuszeile für das HMI',
  brief: p => '<code>FC_Statustext</code> liefert einen Text vom Typ <code>String[40]</code>. Schreibe den Code:<br>• bei <code>Stoerung</code>: <code>&lt;Station&gt;: STOERUNG</code><br>• sonst: <code>&lt;Station&gt;: &lt;Anzahl&gt; Teile</code> — die Zahl vorher mit <code>INT_TO_STRING</code> umwandeln<br>Verbinde die Teile mit <code>CONCAT</code>. Beispiel: Station <code>\'' + p.NAME + '\'</code>, Anzahl 17 → <code>' + p.NAME + ': 17 Teile</code>.<br><code>Main</code> (🔒) schreibt den Text der Station <code>\'' + p.NAME + '\'</code> nach <code>"HMI_Zeile"</code>.',
  blocks: p => [
    { name:'FC_Statustext', kind:'FC', edit:true, start: TXT_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: TXT_REF },
    { name:'Main', kind:'OB', src: MAIN('   "HMI_Zeile" := "FC_Statustext"(Station := \'' + p.NAME + '\', Anzahl := "Stueckzahl", Stoerung := "Stoerung");') }
  ],
  globals: () => ({ Stueckzahl:0, Stoerung:false, HMI_Zeile:'' }), types: () => ({ HMI_Zeile:'STRING[40]' }),
  must:['STRING', 'CONCAT', 'CONVERT'], warnFree:['RET_NOT_SET', 'STRING_TRUNC'],
  visible: p => ({ tests:[[{Stueckzahl:17},{HMI_Zeile:p.NAME + ': 17 Teile'}]] }),
  hidden: p => ({
    unit:[{ block:'FC_Statustext', steps:[[{Station:'Waage', Anzahl:0, Stoerung:false},{RET:'Waage: 0 Teile'}],[{Station:'Waage', Anzahl:250, Stoerung:true},{RET:'Waage: STOERUNG'}],[{Station:'Roboter RZ3', Anzahl:32000, Stoerung:false},{RET:'Roboter RZ3: 32000 Teile'}]] }],
    tests:[[{Stueckzahl:5},{HMI_Zeile:p.NAME + ': 5 Teile'}],[{Stueckzahl:1234, Stoerung:true},{HMI_Zeile:p.NAME + ': STOERUNG'}],[{Stueckzahl:999, Stoerung:false, HMI_Zeile:'alt'},{HMI_Zeile:p.NAME + ': 999 Teile'}]]
  }),
  wrong:[
    () => ({ FC_Statustext: TXT_REF.replace("IN4 := ' Teile'", "IN4 := 'Teile'") }),
    () => ({ FC_Statustext: TXT_HEAD + 'BEGIN\n   IF NOT #Stoerung THEN\n      #FC_Statustext := CONCAT(IN1 := #Station, IN2 := \': \', IN3 := INT_TO_STRING(#Anzahl), IN4 := \' Teile\');\n   END_IF;\nEND_FUNCTION' }),
    () => ({ FC_Statustext: TXT_REF.replace("IN2 := ': STOERUNG'", "IN2 := ' STOERUNG'") })
  ]
});

// ----- Kapitel 14: Array von UDT im DB, Strukturen kopieren -----
const UDT_REZ = 'TYPE "UDT_Rezept"\nVERSION : 0.1\n   STRUCT\n      Temperatur : Real;   // °C\n      Zeit : Time;         // Haltezeit\n      Drehzahl : Int;      // 1/min\n   END_STRUCT;\nEND_TYPE';
const DB_REZ = 'DATA_BLOCK "DB_Rezepte"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Liste : Array[1..4] of "UDT_Rezept";\n      Aktiv : "UDT_Rezept";\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const REZ_HEAD = m => 'FUNCTION "FC_Rezept_Laden" : Bool\nVAR_INPUT\n   Nr : Int;   // gewähltes Rezept 1…4\nEND_VAR\nVAR_IN_OUT\n   Liste : Array[1..4] of "UDT_Rezept";\n   Aktiv : "UDT_Rezept";\nEND_VAR\nVAR CONSTANT\n   MAX_DREHZAHL : Int := ' + m + ';\nEND_VAR\n';
const REZ_REF = m => REZ_HEAD(m) + 'BEGIN\n   IF #Nr >= 1 AND #Nr <= 4 THEN\n      #Aktiv := #Liste[#Nr];\n      #Aktiv.Drehzahl := MIN(IN1 := #Liste[#Nr].Drehzahl, IN2 := #MAX_DREHZAHL);\n      #FC_Rezept_Laden := TRUE;\n   ELSE\n      #FC_Rezept_Laden := FALSE;\n   END_IF;\nEND_FUNCTION';
const REZ_LISTE = [{Temperatur:180, Zeit:30, Drehzahl:900}, {Temperatur:220.5, Zeit:45, Drehzahl:1400}, {Temperatur:160, Zeit:90, Drehzahl:1800}, {Temperatur:200, Zeit:60, Drehzahl:1200}];
const AKT0 = {Temperatur:20, Zeit:5, Drehzahl:100};
defExamTask({ id:'x_scl_p_rezept', quest:'scl', level:'profi', ch:14, diff:3,
  params:{ MAXD:[1200, 1500] },
  title:'Rezept laden',
  brief: p => 'Im globalen DB <code>"DB_Rezepte"</code> (🔒) liegen vier Rezepte (<code>Liste : Array[1..4] of "UDT_Rezept"</code>) und das aktive Rezept <code>Aktiv</code>. Schreibe den Code von <code>FC_Rezept_Laden</code>:<br>• Ist <code>Nr</code> gültig (1 … 4): das <b>ganze</b> Rezept <code>Liste[Nr]</code> nach <code>Aktiv</code> kopieren, dabei die <code>Drehzahl</code> auf höchstens <code>MAX_DREHZAHL</code> (= ' + p.MAXD + ') begrenzen, Rückgabewert TRUE.<br>• Sonst: <code>Aktiv</code> bleibt unverändert, Rückgabewert FALSE.<br>Eine Struktur kopiert man mit einer einzigen Zuweisung: <code>#Aktiv := #Liste[#Nr];</code>',
  blocks: p => [
    { name:'UDT_Rezept', kind:'UDT', src: UDT_REZ },
    { name:'DB_Rezepte', kind:'DB', src: DB_REZ },
    { name:'FC_Rezept_Laden', kind:'FC', edit:true, start: REZ_HEAD(p.MAXD) + 'BEGIN\n   \nEND_FUNCTION', ref: REZ_REF(p.MAXD) },
    { name:'Main', kind:'OB', src: MAIN('   "Laden_OK" := "FC_Rezept_Laden"(Nr := "Rezept_Nr", Liste := "DB_Rezepte".Liste, Aktiv := "DB_Rezepte".Aktiv);') }
  ],
  globals: () => ({ Rezept_Nr:0, Laden_OK:false }),
  must:['ARRAY', 'MEMBER', 'UDT_REF'], warnFree:['RET_NOT_SET'],
  visible: () => ({ tests:[[{'DB_Rezepte.Liste':REZ_LISTE, Rezept_Nr:1},{Laden_OK:true, 'DB_Rezepte.Aktiv':REZ_LISTE[0]}]] }),
  hidden: p => { const lim = r => Object.assign({}, r, {Drehzahl:Math.min(r.Drehzahl, p.MAXD)});
    const base = n => ({'DB_Rezepte.Liste':REZ_LISTE, 'DB_Rezepte.Aktiv':AKT0, Rezept_Nr:n});
    return { tests:[
      [base(2),{Laden_OK:true, 'DB_Rezepte.Aktiv':lim(REZ_LISTE[1])}],
      [base(3),{Laden_OK:true, 'DB_Rezepte.Aktiv':lim(REZ_LISTE[2])}],
      [base(4),{Laden_OK:true, 'DB_Rezepte.Aktiv':lim(REZ_LISTE[3])}],
      [Object.assign(base(1), {Laden_OK:false}),{Laden_OK:true, 'DB_Rezepte.Aktiv':REZ_LISTE[0]}],
      [Object.assign(base(0), {Laden_OK:true}),{Laden_OK:false, 'DB_Rezepte.Aktiv':AKT0}],
      [base(5),{Laden_OK:false, 'DB_Rezepte.Aktiv':AKT0}],
      [base(-1),{Laden_OK:false, 'DB_Rezepte.Aktiv':AKT0}]
    ] }; },
  wrong:[
    p => ({ FC_Rezept_Laden: REZ_REF(p.MAXD).replace('IF #Nr >= 1 AND #Nr <= 4 THEN', 'IF #Nr <= 4 THEN') }),
    p => ({ FC_Rezept_Laden: REZ_REF(p.MAXD).replace('      #Aktiv.Drehzahl := MIN(IN1 := #Liste[#Nr].Drehzahl, IN2 := #MAX_DREHZAHL);\n', '') }),
    p => ({ FC_Rezept_Laden: REZ_REF(p.MAXD).replace('   ELSE\n      #FC_Rezept_Laden := FALSE;', '   ELSE\n      #Aktiv.Drehzahl := 0;\n      #FC_Rezept_Laden := FALSE;') })
  ]
});

// ----- Kapitel 15: Anlauf-OB -----
const DB_OFEN = 'DATA_BLOCK "DB_Ofen"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\n   VAR RETAIN\n      Chargen : DInt := 1520;   // Zähler über die gesamte Lebensdauer\n   END_VAR\n   VAR\n      Soll_Temp : Real;\n      Aufheizen : Bool;\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const OFEN_MAIN = MAIN('   IF "DB_Ofen".Aufheizen AND "Ist_Temp" >= "DB_Ofen".Soll_Temp THEN\n      "DB_Ofen".Aufheizen := FALSE;\n      "DB_Ofen".Chargen := "DB_Ofen".Chargen + 1;\n   END_IF;\n   "Heizung" := "DB_Ofen".Aufheizen;');
const OFEN_START = sw => 'ORGANIZATION_BLOCK "Startup"\nTITLE = "Complete Restart"\nBEGIN\n   "DB_Ofen".Soll_Temp := ' + sw + '.0;\n   "DB_Ofen".Aufheizen := TRUE;\n   "Tuer_Verriegelt" := TRUE;\n   "Meldung" := \'Anlauf\';\nEND_ORGANIZATION_BLOCK';
defExamTask({ id:'x_scl_p_ofenanlauf', quest:'scl', level:'profi', ch:15, diff:1,
  params:{ SW:[160, 180, 200, 220] },
  title:'Anlauf des Härteofens (OB100)',
  brief: p => 'Schreibe den Anlauf-OB <code>"Startup"</code> [OB100]. Er läuft einmal beim Übergang STOP → RUN und setzt:<br>• <code>"DB_Ofen".Soll_Temp</code> := <b>' + p.SW + '.0</b> und <code>"DB_Ofen".Aufheizen</code> := TRUE<br>• <code>"Tuer_Verriegelt"</code> := TRUE<br>• <code>"Meldung"</code> := <code>\'Anlauf\'</code><br>Der remanente Zähler <code>"DB_Ofen".Chargen</code> zählt über die gesamte Lebensdauer und darf im Anlauf <b>nicht</b> verändert werden. Der zyklische <code>Main</code> (🔒) heizt bis zur Solltemperatur.',
  blocks: p => [
    { name:'DB_Ofen', kind:'DB', src: DB_OFEN },
    { name:'Startup', kind:'OB', ob:100, edit:true, start:'ORGANIZATION_BLOCK "Startup"\nTITLE = "Complete Restart"\nBEGIN\n   // Anlaufwerte setzen\n\nEND_ORGANIZATION_BLOCK', ref: OFEN_START(p.SW) },
    { name:'Main', kind:'OB', src: OFEN_MAIN }
  ],
  globals: () => ({ Ist_Temp:20, Heizung:false, Tuer_Verriegelt:false, Meldung:'' }), types: () => ({ Ist_Temp:'REAL', Meldung:'STRING[20]' }),
  must:['STARTUP', 'DB_ACCESS'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{Heizung:true, Tuer_Verriegelt:true, Meldung:'Anlauf'}],[0.1,{Ist_Temp:p.SW},{Heizung:false}]] }] }),
  hidden: p => ({
    timed:[
      { steps:[[0.1,{},{Heizung:true, 'DB_Ofen.Soll_Temp':p.SW, 'DB_Ofen.Chargen':1520, Tuer_Verriegelt:true}],[0.1,{Ist_Temp:p.SW - 1},{Heizung:true}],[0.1,{Ist_Temp:p.SW},{Heizung:false, 'DB_Ofen.Chargen':1521}],[0.1,{},{Heizung:false, 'DB_Ofen.Chargen':1521, Meldung:'Anlauf'}]] },
      { setup:{'DB_Ofen.Chargen':77}, steps:[[0.1,{},{'DB_Ofen.Chargen':77, Tuer_Verriegelt:true, Meldung:'Anlauf', 'DB_Ofen.Aufheizen':true}],[0.1,{Ist_Temp:p.SW + 30},{'DB_Ofen.Chargen':78}]] },
      { steps:[[0.1,{Ist_Temp:p.SW + 5},{Heizung:false, 'DB_Ofen.Aufheizen':false, 'DB_Ofen.Chargen':1521, 'DB_Ofen.Soll_Temp':p.SW}]] }
    ]
  }),
  wrong:[
    p => ({ Startup: OFEN_START(p.SW).replace('   "Meldung"', '   "DB_Ofen".Chargen := 0;\n   "Meldung"') }),
    p => ({ Startup: OFEN_START(p.SW).replace('   "DB_Ofen".Aufheizen := TRUE;\n', '') }),
    p => ({ Startup: OFEN_START(p.SW - 20) })
  ]
});

// ----- Kapitel 15: Programmierstandard (Schnittstelle statt globaler Zugriffe) -----
const LU_HEAD = (e, a) => 'FUNCTION_BLOCK "FB_Luefter"\nVAR_INPUT\n   Temperatur : Real;   // Motortemperatur in °C\n   Freigabe : Bool;\nEND_VAR\nVAR_OUTPUT\n   Luefter : Bool;\nEND_VAR\nVAR CONSTANT\n   TEMP_EIN : Real := ' + e + '.0;\n   TEMP_AUS : Real := ' + a + '.0;\nEND_VAR\n';
const LU_BODY = 'BEGIN\n   IF NOT #Freigabe THEN\n      #Luefter := FALSE;\n   ELSIF #Temperatur >= #TEMP_EIN THEN\n      #Luefter := TRUE;\n   ELSIF #Temperatur <= #TEMP_AUS THEN\n      #Luefter := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
const LU_START = (e, a) => 'FUNCTION_BLOCK "FB_Luefter"\n// ACHTUNG: greift direkt auf globale Variablen zu und enthält Zauberzahlen\nBEGIN\n   IF NOT "Freigabe_Kuehlung" THEN\n      "Luefter_M1" := FALSE;\n   ELSIF "Temp_M1" >= ' + e + '.0 THEN\n      "Luefter_M1" := TRUE;\n   ELSIF "Temp_M1" <= ' + a + '.0 THEN\n      "Luefter_M1" := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
defExamTask({ id:'x_scl_p_luefter_standard', quest:'scl', level:'profi', ch:15, diff:2,
  params:{ E:[60, 70], A:[45, 50] },
  title:'Lüfterbaustein nach Standard',
  brief: p => '<code>FB_Luefter</code> funktioniert, verstösst aber gegen den Programmierstandard: Er liest und schreibt globale Variablen direkt und enthält Zauberzahlen. Schreibe ihn neu:<br>• Schnittstelle: Eingänge <code>Temperatur</code> (Real), <code>Freigabe</code> (Bool); Ausgang <code>Luefter</code> (Bool)<br>• Konstanten <code>TEMP_EIN</code> = ' + p.E + '.0 und <code>TEMP_AUS</code> = ' + p.A + '.0 (Real)<br>• Logik wie bisher: ohne Freigabe aus; ab <code>TEMP_EIN</code> ein; bis <code>TEMP_AUS</code> aus; dazwischen Zustand halten<br>• <b>Keine</b> globalen Variablen im FB (Warnung <code>GLOBAL_ACCESS</code> muss verschwinden)<br><code>Main</code> (🔒) ruft bereits zwei Instanzen für die Motoren M1 und M2 auf.',
  blocks: p => [
    { name:'FB_Luefter', kind:'FB', edit:true, start: LU_START(p.E, p.A), ref: LU_HEAD(p.E, p.A) + LU_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Luefter_M1_DB"(Temperatur := "Temp_M1", Freigabe := "Freigabe_Kuehlung", Luefter => "Luefter_M1");\n   "Luefter_M2_DB"(Temperatur := "Temp_M2", Freigabe := "Freigabe_Kuehlung", Luefter => "Luefter_M2");') }
  ],
  instances: () => ({ Luefter_M1_DB:'FB_Luefter', Luefter_M2_DB:'FB_Luefter' }),
  globals: () => ({ Temp_M1:20, Temp_M2:20, Freigabe_Kuehlung:true, Luefter_M1:false, Luefter_M2:false }), types: () => ({ Temp_M1:'REAL', Temp_M2:'REAL' }),
  must:['VAR_INPUT', 'VAR_OUTPUT', 'VAR_CONSTANT'], warnFree:['GLOBAL_ACCESS'],
  visible: p => ({ timed:[{ steps:[[0.1,{Temp_M1:p.E + 5},{Luefter_M1:true, Luefter_M2:false}],[0.1,{Temp_M1:20},{Luefter_M1:false}]] }] }),
  hidden: p => ({
    unit:[{ block:'FB_Luefter', steps:[[{Temperatur:p.E - 0.5, Freigabe:true},{Luefter:false}],[{Temperatur:p.E},{Luefter:true}],[{Temperatur:p.A + 0.5},{Luefter:true}],[{Temperatur:p.A},{Luefter:false}],[{Temperatur:p.A + 5},{Luefter:false}],[{Temperatur:p.E + 20, Freigabe:false},{Luefter:false}]] }],
    timed:[{ steps:[[0.1,{Temp_M1:p.E, Temp_M2:p.A + 1},{Luefter_M1:true, Luefter_M2:false}],[0.1,{Temp_M1:p.A + 1, Temp_M2:p.E + 1},{Luefter_M1:true, Luefter_M2:true}],[0.1,{Temp_M1:p.A - 1},{Luefter_M1:false, Luefter_M2:true}],[0.1,{Freigabe_Kuehlung:false},{Luefter_M1:false, Luefter_M2:false}],[0.1,{Freigabe_Kuehlung:true},{Luefter_M1:false, Luefter_M2:true}]] }]
  }),
  wrong:[
    p => ({ FB_Luefter: LU_HEAD(p.E, p.A) + LU_BODY.replace('#Temperatur >= #TEMP_EIN', '"Temp_M1" >= #TEMP_EIN') }),
    p => ({ FB_Luefter: LU_HEAD(p.E, p.A) + 'BEGIN\n   IF NOT #Freigabe THEN\n      #Luefter := FALSE;\n   ELSIF #Temperatur >= #TEMP_EIN THEN\n      #Luefter := TRUE;\n   ELSE\n      #Luefter := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK' }),
    p => ({ FB_Luefter: LU_HEAD(p.E, p.A) + LU_BODY.replace('#Temperatur <= #TEMP_AUS', '#Temperatur < #TEMP_AUS') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_scl_g_prio', quest:'scl', level:'grund', ch:2, q:'Welche Verknüpfung wird in <code>a OR b AND c</code> zuerst ausgewertet?', options:['<code>b AND c</code>', '<code>a OR b</code>', 'von links nach rechts, also <code>a OR b</code>', 'SCL meldet einen Fehler'], answer:0 });
defExamQuestion({ id:'xq_scl_g_case', quest:'scl', level:'grund', ch:5, q:'Was passiert in einer CASE-Anweisung, wenn kein Zweig zum Wert passt und kein ELSE vorhanden ist?', options:['Es wird keine Anweisung der CASE-Anweisung ausgeführt', 'Der erste Zweig wird ausgeführt', 'Die CPU geht in STOP', 'Der letzte Zweig wird ausgeführt'], answer:0 });
defExamQuestion({ id:'xq_scl_g_ton', quest:'scl', level:'grund', ch:9, q:'Ein TON mit <code>PT := T#5S</code>: <code>IN</code> ist 3 s TRUE, dann 1 Zyklus FALSE, dann wieder TRUE. Wann wird <code>Q</code> TRUE?', options:['5 s nach dem erneuten Einschalten', '2 s nach dem erneuten Einschalten', 'sofort, weil schon 3 s abgelaufen sind', 'nie'], answer:0 });
defExamQuestion({ id:'xq_scl_p_fcstat', quest:'scl', level:'profi', ch:12, q:'Warum darf eine FC keinen Bereich <code>VAR</code> (statisch) haben?', options:['Eine FC hat keinen Instanz-DB, also kein Gedächtnis zwischen Aufrufen', 'Weil statische Variablen nur in OBs erlaubt sind', 'Weil eine FC keine Eingänge haben darf', 'Das ist erlaubt'], answer:0 });
defExamQuestion({ id:'xq_scl_p_temp', quest:'scl', level:'profi', ch:11, q:'Wofür eignet sich eine <code>VAR_TEMP</code>-Variable in einem FB?', options:['Für Zwischenergebnisse, die nur während eines Aufrufs gebraucht werden', 'Für einen Zählerstand, der bis zum nächsten Zyklus erhalten bleiben muss', 'Für einen Wert, den andere Bausteine lesen sollen', 'Für die Flankenerkennung über mehrere Zyklen'], answer:0 });
// Weitere Fragen: richtige Antwort + drei Ablenker; die Position der richtigen Antwort wechselt (in der Prüfung wird ohnehin gemischt)
let qn = 0;
function mq(level, ch, id, q, right, wrongs){
  const pos = (qn++) % 4, options = wrongs.slice();
  options.splice(pos, 0, right);
  defExamQuestion({ id:'xq_scl_' + (level === 'grund' ? 'g_' : 'p_') + id, quest:'scl', level, ch, q, options, answer:pos });
}
const G = (ch, id, q, r, w) => mq('grund', ch, id, q, r, w), P = (ch, id, q, r, w) => mq('profi', ch, id, q, r, w);

/* Grundstufe */
G(1, 'zaehlertyp', 'Ein Zählerstand kann Werte von 0 bis 20 000 annehmen, nur ganze Zahlen. Welcher Datentyp passt?', 'INT', ['BOOL', 'REAL', 'TIME']);
G(1, 'kopie', 'Nach <code>a := 5; b := a; a := 8;</code> — welchen Wert hat <code>b</code>?', '5', ['8', '13', '0']);
G(1, 'realliteral', 'Welches Literal ist ein gültiger REAL-Wert in SCL?', '<code>12.5</code>', ['<code>12,5</code>', '<code>T#12.5</code>', '<code>\'12.5\'</code>']);
G(1, 'zyklisch', 'Die SPS bearbeitet das Programm zyklisch. Was bedeutet das für die Anweisung <code>Lampe := TRUE;</code>?', 'Sie wird in jedem Zyklus erneut ausgeführt', ['Sie wird nur einmal nach dem Einschalten ausgeführt', 'Sie wird nur ausgeführt, wenn sich <code>Lampe</code> ändert', 'Sie wird genau einmal pro Sekunde ausgeführt']);

G(2, 'nand', 'Was ergibt <code>NOT (A AND B)</code> für <code>A = TRUE</code> und <code>B = FALSE</code>?', 'TRUE', ['FALSE', 'Der Compiler meldet einen Fehler', 'Das hängt vom letzten Zyklus ab']);
G(2, 'genaueiner', 'Eine Warnleuchte soll leuchten, wenn <b>genau einer</b> von zwei Sensoren ein Signal meldet. Welcher Operator passt?', '<code>XOR</code>', ['<code>AND</code>', '<code>OR</code>', '<code>NOT</code>']);
G(2, 'demorgan', 'Welcher Ausdruck ist gleichwertig zu <code>NOT A OR NOT B</code>?', '<code>NOT (A AND B)</code>', ['<code>NOT (A OR B)</code>', '<code>A XOR B</code>', '<code>NOT A AND NOT B</code>']);

G(3, 'maxfkt', 'Welche Funktion liefert den grösseren von zwei Werten?', '<code>MAX</code>', ['<code>LIMIT</code>', '<code>ABS</code>', '<code>MOD</code>']);
G(3, 'minwert', 'Was ergibt <code>MIN(IN1 := 12, IN2 := 7)</code>?', '7', ['12', '19', '5']);
G(3, 'ausserhalb', 'Welcher Ausdruck ist TRUE, wenn <code>x</code> <b>ausserhalb</b> des Bereichs 10 … 20 liegt? Die Grenzen gehören zum Bereich.', '<code>x &lt; 10 OR x &gt; 20</code>', ['<code>x &lt; 10 AND x &gt; 20</code>', '<code>x &lt;= 10 OR x &gt;= 20</code>', '<code>NOT (x &gt; 10 AND x &lt; 20)</code>']);
G(3, 'intreal', '<code>Summe</code> ist vom Typ INT. Warum schreibt man <code>INT_TO_REAL(Summe) / 4.0</code> statt <code>Summe / 4</code>?', 'Damit die Nachkommastellen nicht abgeschnitten werden', ['Weil INT-Werte nicht geteilt werden dürfen', 'Damit das Ergebnis immer ganzzahlig ist', 'Weil 4 sonst als Zeitwert gilt']);

G(4, 'elsif', 'Welche Schreibweise für „sonst wenn“ ist in SCL korrekt?', '<code>ELSIF</code>', ['<code>ELSEIF</code>', '<code>ELIF</code>', '<code>ELSE_IF</code>']);
G(4, 'zweige', 'Wie viele Zweige einer <code>IF … ELSIF … ELSE</code>-Anweisung werden bei einem Durchlauf höchstens ausgeführt?', 'Höchstens einer — der erste, dessen Bedingung TRUE ist (sonst ELSE)', ['Alle Zweige, deren Bedingung TRUE ist', 'Immer alle Zweige nacheinander', 'Genau zwei: der passende Zweig und ELSE']);
G(4, 'direkt', 'Welcher Code setzt <code>Lampe</code> in jedem Zyklus auf den richtigen Wert, ohne dass ein alter Zustand stehen bleibt?', '<code>Lampe := Druck &gt; 5;</code>', ['<code>IF Druck &gt; 5 THEN Lampe := TRUE; END_IF;</code>', '<code>IF Druck &lt;= 5 THEN Lampe := FALSE; END_IF;</code>', '<code>IF Lampe THEN Lampe := Druck &gt; 5; END_IF;</code>']);
G(4, 'grenztest', 'Ein Alarm soll bei <code>Wert &gt;= 100</code> auslösen. Welche Testwerte prüfen die Grenze am besten?', '99 und 100', ['nur 50', 'nur 200', '0 und 1000']);

G(5, 'bereich', 'Welche CASE-Marke deckt die Werte 5, 6, 7 und 8 ab?', '<code>5..8:</code>', ['<code>5-8:</code>', '<code>5 TO 8:</code>', '<code>[5, 8]:</code>']);
G(5, 'marken', 'Was darf in SCL als Marke (Fallwert) einer CASE-Anweisung stehen?', 'Ganzzahlige Konstanten, Listen (<code>1, 3</code>) und Bereiche (<code>1..5</code>)', ['Beliebige Vergleiche wie <code>x &gt; 5</code>', 'Nur Variablennamen', 'Nur Texte in Hochkommas']);
G(5, 'liste', '<code>CASE Nr OF 1, 3: A := TRUE; 2: B := TRUE; END_CASE;</code> — was passiert bei <code>Nr = 3</code>?', '<code>A</code> wird TRUE', ['<code>B</code> wird TRUE', '<code>A</code> und <code>B</code> werden TRUE', 'Nichts, weil 3 keine eigene Marke hat']);

G(6, 'elemente', 'Wie viele Elemente hat <code>ARRAY[0..15] OF BOOL</code>?', '16', ['15', '14', '17']);
G(6, 'forby', 'Wie oft wird der Rumpf von <code>FOR i := 0 TO 10 BY 2 DO … END_FOR;</code> ausgeführt?', '6-mal', ['5-mal', '10-mal', '11-mal']);
G(6, 'maxsuche', '<code>w = [3, 8, 2, 5]</code> (Index 0 … 3). Was steht nach <code>m := w[0]; FOR i := 1 TO 3 DO IF w[i] &gt; m THEN m := w[i]; END_IF; END_FOR;</code> in <code>m</code>?', '8', ['3', '5', '18']);
G(6, 'nullsetzen', 'Welche Schleife setzt alle Elemente von <code>a : ARRAY[1..5] OF INT</code> auf 0, ohne die Grenzen zu verletzen?', '<code>FOR i := 1 TO 5 DO a[i] := 0; END_FOR;</code>', ['<code>FOR i := 0 TO 5 DO a[i] := 0; END_FOR;</code>', '<code>FOR i := 0 TO 4 DO a[i] := 0; END_FOR;</code>', '<code>FOR i := 1 TO 4 DO a[i] := 0; END_FOR;</code>']);

G(7, 'whilepruef', 'Wann prüft eine WHILE-Schleife ihre Bedingung?', 'Vor jedem Durchlauf', ['Nach jedem Durchlauf', 'Nur einmal pro SPS-Zyklus', 'Nur, wenn EXIT aufgerufen wird']);
G(7, 'exitinnen', 'Was bewirkt <code>EXIT</code> in der inneren von zwei verschachtelten FOR-Schleifen?', 'Nur die innere Schleife wird verlassen, die äussere läuft weiter', ['Beide Schleifen werden verlassen', 'Der ganze Baustein wird beendet', 'Es geht mit dem nächsten Durchlauf der inneren Schleife weiter']);
G(7, 'repeat', '<code>n := 0; REPEAT n := n + 3; UNTIL n &gt;= 10 END_REPEAT;</code> — welchen Wert hat <code>n</code> danach?', '12', ['9', '10', '3']);
G(7, 'warten', 'Warum darf man in einer SPS nicht mit <code>WHILE NOT Endlage DO … END_WHILE;</code> auf einen Sensor warten?', 'Während die Schleife läuft, werden die Eingänge nicht neu eingelesen — der Zyklus hängt, bis die Zykluszeitüberwachung anspricht', ['WHILE darf keine BOOL-Bedingung haben', 'Die Schleife läuft immer nur einmal', 'Das ist erlaubt und die übliche Art zu warten']);

G(8, 'flankeselbst', '<code>Alt</code> enthält den Wert von <code>Taster</code> aus dem letzten Zyklus. Welcher Ausdruck liefert die steigende Flanke?', '<code>Taster AND NOT Alt</code>', ['<code>NOT Taster AND Alt</code>', '<code>Taster OR Alt</code>', '<code>Taster XOR TRUE</code>']);
G(8, 'ctuueber', 'Ein CTU hat <code>PV := 3</code> und erhält 5 Zählimpulse (ohne Reset). Welche Werte haben <code>CV</code> und <code>Q</code>?', '<code>CV</code> = 5, <code>Q</code> = TRUE', ['<code>CV</code> = 3, <code>Q</code> = TRUE', '<code>CV</code> = 5, <code>Q</code> = FALSE', '<code>CV</code> = 0, <code>Q</code> = TRUE']);
G(8, 'ctdladen', 'Über welchen Eingang wird ein CTD mit dem Vorgabewert <code>PV</code> geladen?', '<code>LD</code>', ['<code>R</code>', '<code>CU</code>', '<code>CD</code>']);
G(8, 'eigeneinstanz', 'Warum braucht jede Flankenauswertung eine eigene R_TRIG-Instanz?', 'Jede Instanz speichert den Zustand ihres Signals aus dem letzten Zyklus', ['Weil R_TRIG pro Programm nur einmal aufgerufen werden darf', 'Weil die Instanz die Zykluszeit misst', 'Weil R_TRIG sonst eine fallende Flanke meldet']);

G(9, 'et', 'Was zeigt der Ausgang <code>ET</code> eines laufenden TON an?', 'Die bereits abgelaufene Zeit', ['Die Restzeit bis <code>Q</code> TRUE wird', 'Die eingestellte Zeit <code>PT</code>', 'Die Anzahl der Starts']);
G(9, 'tofkurz', 'Ein TOF mit <code>PT := T#4S</code>: <code>IN</code> fällt ab und wird nach 2 s wieder TRUE. Wie verhält sich <code>Q</code>?', '<code>Q</code> bleibt durchgehend TRUE', ['<code>Q</code> wird nach 2 s FALSE', '<code>Q</code> wird kurz FALSE und dann wieder TRUE', '<code>Q</code> wird erst 4 s nach dem erneuten Einschalten TRUE']);
G(9, 'zeitliteral', 'Welche Angabe stellt einen Timer korrekt auf 1,5 Sekunden ein?', '<code>PT := T#1S500MS</code>', ['<code>PT := 1.5</code>', '<code>PT := T#1,5S</code>', '<code>PT := T#1500</code>']);

G(10, 'schrittvar', 'Womit merkt sich eine mit CASE programmierte Schrittkette, welcher Schritt gerade aktiv ist?', 'Mit einer INT-Variable (z.B. <code>Schritt</code>), die ihren Wert von Zyklus zu Zyklus behält', ['Mit einem Timer, der die Schritte weiterschaltet', 'Mit einer eigenen BOOL-Variable pro Zyklus', 'Mit dem Programmzähler der CPU']);
G(10, 'einwechsel', 'In jedem CASE-Zweig steht <code>IF Bedingung THEN Schritt := Schritt + 1; END_IF;</code>. Wie viele Schrittwechsel sind pro Zyklus höchstens möglich?', 'Einer', ['Beliebig viele, bis keine Bedingung mehr erfüllt ist', 'Zwei', 'Keiner, Schrittwechsel brauchen immer einen Timer']);
G(10, 'weiterschalten', 'In Schritt 2 fährt ein Zylinder aus. Was ist die richtige Weiterschaltbedingung?', 'Die Rückmeldung der Endlage (z.B. <code>Endlage_Aus</code>)', ['Der eigene Befehl <code>Ventil</code>', 'Ein fester Zählerstand', 'Die Bedingung <code>Schritt = 2</code>']);
G(10, 'unbekannt', 'Eine Schrittkette erhält versehentlich <code>Schritt := 7</code>. Es gibt weder einen Zweig <code>7:</code> noch ELSE. Was passiert?', 'Die Kette bleibt stehen: kein Zweig wird ausgeführt, nichts schaltet weiter', ['Die Kette springt automatisch auf Schritt 0', 'Die CPU geht sofort in STOP', 'Der nächsthöhere Zweig wird ausgeführt']);

/* Profi-Stufe */
P(11, 'dint', 'Welcher Datentyp deckt den Wertebereich −2 147 483 648 … 2 147 483 647 ab?', '<code>DInt</code>', ['<code>Int</code>', '<code>SInt</code>', '<code>UInt</code>']);
P(11, 'bitzugriff', 'Wie liest man in SCL Bit 4 der Word-Variable <code>#Status</code>?', '<code>#Status.%X4</code>', ['<code>#Status[4]</code>', '<code>#Status.4</code>', '<code>BIT(#Status, 4)</code>']);
P(11, 'konstante', 'Was gilt für eine Variable im Bereich <code>VAR CONSTANT</code>?', 'Ihr Wert steht in der Deklaration fest und kann im Code nicht verändert werden', ['Sie behält ihren Wert zwischen Zyklen und kann beschrieben werden', 'Sie wird bei jedem Aufruf auf 0 gesetzt', 'Sie ist automatisch in allen Bausteinen sichtbar']);
P(11, 'analogtyp', 'Ein Analogeingang liefert Rohwerte von 0 bis 27648. Welcher Datentyp ist dafür üblich?', '<code>Int</code>', ['<code>Real</code>', '<code>Bool</code>', '<code>Time</code>']);
P(11, 'arraygrenzen', 'Welche Aussage über <code>Array[1..10] of Real</code> stimmt?', 'Der erste Index ist 1, der letzte 10', ['Der erste Index ist 0, der letzte 9', 'Das Array hat 9 Elemente', 'Als Index sind nur Konstanten erlaubt']);

P(12, 'fcausgang', 'Eine FC beschreibt ihren Ausgang <code>Fehler</code> nur in einem IF-Zweig. Was gilt für die anderen Fälle?', 'Der Ausgang hat dann einen undefinierten Wert — Ausgänge einer FC müssen in jedem Aufruf beschrieben werden', ['Der Ausgang behält sicher den Wert des letzten Aufrufs', 'Der Ausgang ist automatisch FALSE', 'Der Compiler ergänzt einen ELSE-Zweig']);
P(12, 'fctemp', 'Wo liegen die TEMP-Variablen einer FC?', 'Im Lokaldatenstack — nach dem Aufruf sind sie verloren', ['Im Instanz-DB der FC', 'In einem globalen DB', 'Im Merkerbereich']);
P(12, 'rueckgabe', 'Welche Rückgabetypen sind für eine FC möglich?', '<code>Void</code> (kein Rückgabewert) oder ein Datentyp wie Int, Real oder Bool', ['Nur Bool', 'Nur Void', 'Nur Datentypen mit mindestens 32 Bit']);
P(12, 'wiederverwendbar', 'Warum ist eine FC, die nur über ihre Schnittstelle arbeitet, gut wiederverwendbar?', 'Sie kann für beliebige Daten aufgerufen werden, ohne dass man ihren Code ändern muss', ['Sie läuft schneller, weil sie keinen Speicher braucht', 'Sie darf dann statische Variablen haben', 'Sie wird automatisch in jedem Zyklus aufgerufen']);
P(12, 'nurlesen', 'In welchem Bereich deklariert man einen Parameter, den die FC nur liest?', '<code>VAR_INPUT</code>', ['<code>VAR_OUTPUT</code>', '<code>VAR_IN_OUT</code>', '<code>VAR_TEMP</code>']);

P(13, 'statisch', 'Was passiert mit den statischen Variablen eines FB zwischen zwei Aufrufen derselben Instanz?', 'Sie behalten ihren Wert', ['Sie werden auf den Startwert zurückgesetzt', 'Sie werden auf 0 gesetzt', 'Ihr Wert ist undefiniert']);
P(13, 'multispeicher', 'Wo werden die Daten einer Multiinstanz gespeichert?', 'Im Instanz-DB des aufrufenden FB, als Teil seiner statischen Daten', ['In einem eigenen, automatisch erzeugten Instanz-DB', 'Im Lokaldatenstack', 'In einem globalen DB namens MULTI']);
P(13, 'eingangoffen', 'Beim Aufruf einer FB-Instanz wird ein Eingang nicht versorgt. Welchen Wert hat er im FB?', 'Den Wert, der im Instanz-DB steht (zuletzt übergeben bzw. Startwert)', ['Immer 0 bzw. FALSE', 'Der Compiler lässt den Aufruf nicht zu', 'Den Wert eines gleichnamigen globalen Tags']);
P(13, 'dreipumpen', 'Ein FB <code>FB_Pumpe</code> steuert eine Pumpe mit Laufzeitzähler. Wie viele Instanzen braucht man für drei Pumpen?', 'Drei — eine pro Pumpe', ['Eine, die dreimal pro Zyklus aufgerufen wird', 'Keine, ein FB braucht keine Instanz', 'Drei FBs mit unterschiedlichen Namen']);
P(13, 'timermulti', 'Warum deklariert man einen TON innerhalb eines FB unter <code>VAR</code> als Multiinstanz (<code>Verzoegerung : TON;</code>)?', 'Jede Instanz des FB bekommt so ihren eigenen Timer', ['Weil TON nur in OBs aufgerufen werden darf', 'Damit der Timer schneller zählt', 'Damit alle Instanzen des FB denselben Timer benutzen']);
P(13, 'instanzdb', 'Was ist ein Instanz-DB?', 'Ein Datenbaustein, der die Schnittstellen- und statischen Daten eines FB-Aufrufs speichert', ['Ein globaler DB, auf den alle FBs gemeinsam zugreifen', 'Ein DB für die TEMP-Variablen einer FC', 'Eine Kopie des Programmcodes eines FB']);

P(14, 'stringlaenge', 'Wie viele Zeichen kann eine Variable vom Typ <code>String[20]</code> höchstens aufnehmen?', '20', ['21', '22', '254']);
P(14, 'len', 'Was liefert <code>LEN(\'Band 1\')</code>?', '6', ['5', '7', '1']);
P(14, 'left', 'Was liefert <code>LEFT(IN := \'RZ-03\', L := 2)</code>?', '<code>\'RZ\'</code>', ['<code>\'03\'</code>', '<code>\'RZ-\'</code>', '<code>\'Z-\'</code>']);
P(14, 'udtdekl', 'Wie deklariert man in einem FB die Variable <code>Teil</code> vom PLC-Datentyp <code>"UDT_Teil"</code>?', '<code>Teil : "UDT_Teil";</code>', ['<code>Teil : UDT(UDT_Teil);</code>', '<code>Teil : STRUCT "UDT_Teil";</code>', '<code>"Teil" : #UDT_Teil;</code>']);
P(14, 'dbzugriff', 'Wie greift man im OB1 auf das Element <code>Anzahl</code> im globalen DB <code>DB_Zelle</code> zu?', '<code>"DB_Zelle".Anzahl</code>', ['<code>#DB_Zelle.Anzahl</code>', '<code>DB_Zelle[Anzahl]</code>', '<code>"DB_Zelle.Anzahl"</code>']);
P(14, 'structkopie', 'Was bewirkt <code>#Ziel := #Quelle;</code>, wenn beide Variablen vom selben PLC-Datentyp sind?', 'Alle Elemente der Struktur werden kopiert', ['Nur das erste Element wird kopiert', 'Der Compiler meldet einen Fehler — Strukturen muss man elementweise kopieren', '<code>#Ziel</code> verweist danach auf dieselben Daten wie <code>#Quelle</code>']);

P(15, 'ob1', 'Welcher OB wird zyklisch bearbeitet und enthält typischerweise die Aufrufe der Anlagenbausteine?', 'OB1 (Program cycle)', ['OB100 (Startup)', 'OB30 (Cyclic interrupt)', 'OB82 (Diagnostic error interrupt)']);
P(15, 'retain', 'Was bedeutet <code>RETAIN</code> bei einer Variable in einem DB?', 'Ihr Wert bleibt bei Netz-Aus/Netz-Ein erhalten', ['Sie ist schreibgeschützt', 'Sie wird bei jedem Anlauf auf den Startwert gesetzt', 'Sie ist nur im OB100 sichtbar']);
P(15, 'reihenfolge', 'In welcher Reihenfolge arbeitet ein OB1 nach Programmierstandard?', 'Eingänge aufbereiten → Anlagenbausteine/Logik → Ausgänge zuweisen', ['Ausgänge zuweisen → Logik → Eingänge aufbereiten', 'Logik → Eingänge aufbereiten → Ausgänge zuweisen', 'Die Reihenfolge spielt keine Rolle']);
P(15, 'anlaufob', 'Warum setzt man Grundstellungen im OB100 statt mit einer Erstzyklus-Abfrage im OB1?', 'OB100 läuft nur einmal beim Anlauf — OB1 bleibt übersichtlich und braucht keinen Erstzyklus-Merker', ['Weil OB1 keine globalen Variablen beschreiben darf', 'Weil OB100 schneller bearbeitet wird', 'Weil Werte aus OB1 nach jedem Zyklus gelöscht werden']);
P(15, 'zauberzahl', 'Welcher Wert sollte nach Programmierstandard als benannte Konstante statt direkt im Code stehen?', 'Eine Grenztemperatur von 85 °C, die an mehreren Stellen verwendet wird', ['Die 1 in <code>#i := #i + 1;</code>', 'Die 0 beim Rücksetzen eines Zählers', 'TRUE in einer Zuweisung']);
P(15, 'zykluszeit', 'Was macht die Zykluszeitüberwachung der CPU?', 'Sie meldet einen Zeitfehler (bzw. führt zu STOP), wenn ein Zyklus die eingestellte maximale Zykluszeit überschreitet', ['Sie startet den OB1 genau einmal pro Sekunde', 'Sie bricht Endlosschleifen ohne Fehlermeldung ab', 'Sie zeigt die mittlere Zykluszeit am HMI an']);
})();

/* ==== content_kop/exam.js ==== */
/* ===== KOP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Seilbahn), nicht aus dem Spiel. Parameter pro Prüfung (exam_core.js). */
(function(){
const seq = steps => [{ steps }];
// n Impulse an einem Eingang: je ein Zyklus 1, ein Zyklus 0
const pulses = (inp, n, exp) => { const out = []; for(let i = 1; i <= n; i++){ out.push([0.1, { [inp]: true }, exp ? exp(i) : {}]); out.push([0.1, { [inp]: false }, {}]); } return out; };
const ms = s => 'T#' + Math.round(s * 1000) + 'MS';
const START = t => 'NETWORK ' + t + '\n? => ?;\n';

/* =====================================================================
   GRUNDSTUFE (Kapitel 1–10)
   ===================================================================== */

/* ---------- Kapitel 1: Schliesser, Spule, Reihe ---------- */
const FB_IN = n => ['Tuer_Zu', 'Schranke_Zu', 'S_Fahrt'].concat(n === 4 ? ['Seil_OK'] : []);
defExamTask({ id:'x_kop_g_fahrbereit', quest:'kop', level:'grund', ch:1, diff:1,
  params:{ N:[3, 4] },
  title:'Fahrfreigabe in Reihe',
  brief: p => 'Der Antrieb <code>Antrieb</code> und die Lampe <code>Ampel_Gruen</code> sollen nur dann 1 sein, wenn <b>alle</b> Bedingungen erfüllt sind: ' +
    FB_IN(p.N).map(v => '<code>' + v + '</code>').join(', ') + ' (jeweils 1).<br>Beide Spulen hängen am selben Strompfad.',
  vars: p => Object.assign(Object.fromEntries(FB_IN(p.N).map(v => [v, false])), { Antrieb:false, Ampel_Gruen:false }),
  start: () => START('Fahrfreigabe'),
  ref: p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).join(' AND ') + ' => Antrieb, Ampel_Gruen;',
  must:['SERIES'],
  visible: p => { const all = Object.fromEntries(FB_IN(p.N).map(v => [v, true])); return [[all, { Antrieb:true, Ampel_Gruen:true }], [Object.assign({}, all, { Tuer_Zu:false }), { Antrieb:false, Ampel_Gruen:false }]]; },
  hidden: p => truth(FB_IN(p.N), e => { const ok = FB_IN(p.N).every(v => e[v]); return { Antrieb: ok, Ampel_Gruen: ok }; }),
  wrong:[
    p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).join(' OR ') + ' => Antrieb, Ampel_Gruen;',
    p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).filter(v => v !== 'Schranke_Zu').join(' AND ') + ' => Antrieb, Ampel_Gruen;',
    p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).join(' AND ') + ' => Antrieb;'
  ]
});

/* ---------- Kapitel 2: Öffner, Parallelzweige ---------- */
defExamTask({ id:'x_kop_g_rotlicht', quest:'kop', level:'grund', ch:2, diff:1,
  title:'Rotlicht an der Einstiegsstelle',
  brief: () => 'Die Lampe <code>Ampel_Rot</code> leuchtet, wenn die Tür <b>nicht</b> zu ist (<code>Tuer_Zu</code> = 0) <b>oder</b> die Schranke <b>nicht</b> zu ist (<code>Schranke_Zu</code> = 0) <b>oder</b> der Schalter <code>Revision</code> 1 ist.',
  vars: () => ({ Tuer_Zu:false, Schranke_Zu:false, Revision:false, Ampel_Rot:false }),
  start: () => START('Rotlicht'),
  ref: () => 'NETWORK Rotlicht\nNOT Tuer_Zu OR NOT Schranke_Zu OR Revision => Ampel_Rot;',
  must:['NC','PARALLEL'],
  visible: () => [[{ Tuer_Zu:true, Schranke_Zu:true }, { Ampel_Rot:false }], [{ Tuer_Zu:false, Schranke_Zu:true }, { Ampel_Rot:true }]],
  hidden: () => truth(['Tuer_Zu','Schranke_Zu','Revision'], e => ({ Ampel_Rot: !e.Tuer_Zu || !e.Schranke_Zu || e.Revision })),
  wrong:[
    () => 'NETWORK Rotlicht\nTuer_Zu OR Schranke_Zu OR Revision => Ampel_Rot;',
    () => 'NETWORK Rotlicht\nNOT Tuer_Zu AND NOT Schranke_Zu OR Revision => Ampel_Rot;',
    () => 'NETWORK Rotlicht\nNOT Tuer_Zu OR NOT Schranke_Zu => Ampel_Rot;'
  ]
});

/* ---------- Kapitel 3: Selbsthaltung, Vorrang, Verriegelung ---------- */
defExamTask({ id:'x_kop_g_foerderband', quest:'kop', level:'grund', ch:3, diff:1, timed:true,
  title:'Gepäckband mit Selbsthaltung',
  brief: () => 'Das Gepäckband <code>Band</code> startet mit dem Taster <code>S_Start</code> und läuft danach weiter (Selbsthaltung).<br>Es stoppt mit <code>S_Stopp</code> (Aus-Vorrang) oder sobald <code>Not_Halt_OK</code> 0 ist.',
  vars: () => ({ S_Start:false, S_Stopp:false, Not_Halt_OK:true, Band:false }),
  start: () => START('Gepaeckband'),
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

const RICHT = 'NETWORK Bergfahrt\n(S_Berg OR Fahrt_Berg) AND NOT S_Halt AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Talfahrt\n(S_Tal OR Fahrt_Tal) AND NOT S_Halt AND NOT Fahrt_Berg => Fahrt_Tal;';
defExamTask({ id:'x_kop_g_richtung', quest:'kop', level:'grund', ch:3, diff:2, timed:true,
  title:'Fahrtrichtung verriegeln',
  brief: () => '<b>NW 1:</b> <code>S_Berg</code> startet <code>Fahrt_Berg</code> mit Selbsthaltung.<br><b>NW 2:</b> <code>S_Tal</code> startet <code>Fahrt_Tal</code> mit Selbsthaltung.<br><code>S_Halt</code> (Schliesser) stoppt beide (Aus-Vorrang). Die beiden Richtungen sind <b>gegenseitig verriegelt</b>: Solange eine Richtung läuft, lässt sich die andere nicht starten. Werden beide Taster gleichzeitig gedrückt, gewinnt die Bergfahrt.',
  vars: () => ({ S_Berg:false, S_Tal:false, S_Halt:false, Fahrt_Berg:false, Fahrt_Tal:false }),
  start: () => START('Bergfahrt'),
  ref: () => RICHT,
  must:['PARALLEL','NC'],
  visible: () => seq([[0.1,{S_Berg:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true}],[0.1,{S_Halt:true},{Fahrt_Berg:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Fahrt_Berg:false, Fahrt_Tal:false}],[0.1,{S_Berg:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true}],[0.1,{S_Tal:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Tal:false},{Fahrt_Berg:true, Fahrt_Tal:false}],
      [0.1,{S_Halt:true},{Fahrt_Berg:false, Fahrt_Tal:false}],[0.1,{S_Halt:false, S_Tal:true},{Fahrt_Tal:true, Fahrt_Berg:false}],[0.1,{S_Tal:false, S_Berg:true},{Fahrt_Tal:true, Fahrt_Berg:false}]] },
    { steps:[[0.1,{S_Tal:true, S_Halt:true},{Fahrt_Tal:false}],[0.1,{S_Halt:false},{Fahrt_Tal:true}],[0.1,{S_Tal:false},{Fahrt_Tal:true}],[0.1,{S_Halt:true},{Fahrt_Tal:false}],[0.1,{S_Halt:false},{Fahrt_Tal:false}]] },
    { steps:[[0.1,{S_Berg:true, S_Tal:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Tal:false},{Fahrt_Berg:true, Fahrt_Tal:false}]] }
  ],
  wrong:[
    () => 'NETWORK Bergfahrt\n(S_Berg OR Fahrt_Berg) AND NOT S_Halt => Fahrt_Berg;\n\nNETWORK Talfahrt\n(S_Tal OR Fahrt_Tal) AND NOT S_Halt => Fahrt_Tal;',
    () => 'NETWORK Bergfahrt\nS_Berg AND NOT S_Halt AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Talfahrt\nS_Tal AND NOT S_Halt AND NOT Fahrt_Berg => Fahrt_Tal;',
    () => 'NETWORK Bergfahrt\n(S_Berg OR Fahrt_Berg) AND NOT S_Halt AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Talfahrt\n(S_Tal OR Fahrt_Tal) AND NOT Fahrt_Berg => Fahrt_Tal;'
  ]
});

/* ---------- Kapitel 4: Setzen / Rücksetzen ---------- */
const ZUG_S = 'NETWORK Setzen\nS_Auf AND Kabine_da => S Zugang_Auf;', ZUG_R = 'NETWORK Ruecksetzen\nS_Zu OR NOT Kabine_da => R Zugang_Auf;';
defExamTask({ id:'x_kop_g_zugang', quest:'kop', level:'grund', ch:4, diff:2, timed:true,
  params:{ VOR:['R', 'S'] },
  title:'Zugangssperre speichern',
  brief: p => '<code>Zugang_Auf</code> wird <b>gesetzt</b>, wenn <code>S_Auf</code> 1 ist und <code>Kabine_da</code> 1 ist.<br>Es wird <b>rückgesetzt</b>, wenn <code>S_Zu</code> 1 ist oder <code>Kabine_da</code> 0 ist.<br>Verwende S- und R-Spulen. Die Anlage verlangt <b>' + (p.VOR === 'R' ? 'Rücksetzvorrang' : 'Setzvorrang') + '</b>: Sind Setz- und Rücksetzbedingung gleichzeitig erfüllt, ist der Zugang ' + (p.VOR === 'R' ? 'zu' : 'offen') + '.',
  vars: () => ({ S_Auf:false, S_Zu:false, Kabine_da:false, Zugang_Auf:false }),
  start: () => START('Setzen'),
  ref: p => p.VOR === 'R' ? ZUG_S + '\n\n' + ZUG_R : ZUG_R + '\n\n' + ZUG_S,
  must:['SET','RESET'],
  visible: () => seq([[0.1,{Kabine_da:true, S_Auf:true},{Zugang_Auf:true}],[0.1,{S_Auf:false},{Zugang_Auf:true}],[0.1,{S_Zu:true},{Zugang_Auf:false}]]),
  hidden: p => [
    { steps:[[0.1,{},{Zugang_Auf:false}],[0.1,{S_Auf:true},{Zugang_Auf:false}],[0.1,{Kabine_da:true},{Zugang_Auf:true}],[0.1,{S_Auf:false},{Zugang_Auf:true}],[0.5,{},{Zugang_Auf:true}],[0.1,{S_Zu:true},{Zugang_Auf:false}],[0.1,{S_Zu:false},{Zugang_Auf:false}]] },
    { steps:[[0.1,{Kabine_da:true, S_Auf:true, S_Zu:true},{Zugang_Auf: p.VOR === 'S'}],[0.1,{S_Zu:false},{Zugang_Auf:true}],[0.1,{S_Auf:false, S_Zu:true},{Zugang_Auf:false}],[0.1,{S_Zu:false},{Zugang_Auf:false}]] },
    { steps:[[0.1,{Kabine_da:true, S_Auf:true},{Zugang_Auf:true}],[0.1,{S_Auf:false},{Zugang_Auf:true}],[0.1,{Kabine_da:false},{Zugang_Auf:false}],[0.1,{Kabine_da:true},{Zugang_Auf:false}]] }
  ],
  wrong:[
    p => p.VOR === 'R' ? ZUG_R + '\n\n' + ZUG_S : ZUG_S + '\n\n' + ZUG_R,
    p => { const r = 'NETWORK Ruecksetzen\nS_Zu => R Zugang_Auf;'; return p.VOR === 'R' ? ZUG_S + '\n\n' + r : r + '\n\n' + ZUG_S; },
    () => 'NETWORK Zugang\nS_Auf AND Kabine_da AND NOT S_Zu => Zugang_Auf;'
  ]
});

const BR_REF = 'NETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR NOT Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => NOT Lampe_Bremse_Zu;';
defExamTask({ id:'x_kop_g_bremse', quest:'kop', level:'grund', ch:4, diff:2, timed:true,
  title:'Betriebsbremse',
  brief: () => '<b>NW 1:</b> <code>S_Lueften</code> setzt <code>Bremse_Auf</code>.<br><b>NW 2:</b> <code>S_Einfallen</code> <b>oder</b> <code>Hydraulik_OK</code> = 0 <b>oder</b> <code>Not_Halt_OK</code> = 0 setzt <code>Bremse_Auf</code> zurück (Rücksetzvorrang).<br><b>NW 3:</b> <code>Lampe_Bremse_Zu</code> ist genau dann 1, wenn <code>Bremse_Auf</code> 0 ist — verwende dafür eine <b>negierte Spule</b>.',
  vars: () => ({ S_Lueften:false, S_Einfallen:false, Hydraulik_OK:true, Not_Halt_OK:true, Bremse_Auf:false, Lampe_Bremse_Zu:false }),
  start: () => START('Lueften'),
  ref: () => BR_REF,
  must:['SET','RESET','NCOIL'],
  visible: () => seq([[0.1,{},{Bremse_Auf:false, Lampe_Bremse_Zu:true}],[0.1,{S_Lueften:true},{Bremse_Auf:true, Lampe_Bremse_Zu:false}],[0.1,{S_Lueften:false, S_Einfallen:true},{Bremse_Auf:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Lampe_Bremse_Zu:true}],[0.1,{S_Lueften:true},{Bremse_Auf:true, Lampe_Bremse_Zu:false}],[0.1,{S_Lueften:false},{Bremse_Auf:true, Lampe_Bremse_Zu:false}],[0.1,{Hydraulik_OK:false},{Bremse_Auf:false, Lampe_Bremse_Zu:true}],[0.1,{Hydraulik_OK:true},{Bremse_Auf:false}]] },
    { steps:[[0.1,{S_Lueften:true, Not_Halt_OK:false},{Bremse_Auf:false, Lampe_Bremse_Zu:true}],[0.1,{Not_Halt_OK:true},{Bremse_Auf:true}],[0.1,{S_Einfallen:true},{Bremse_Auf:false}],[0.1,{S_Lueften:false, S_Einfallen:false},{Bremse_Auf:false}]] },
    { steps:[[0.1,{S_Lueften:true},{Bremse_Auf:true}],[0.1,{S_Lueften:false, Not_Halt_OK:false},{Bremse_Auf:false}],[0.1,{Not_Halt_OK:true},{Bremse_Auf:false, Lampe_Bremse_Zu:true}]] }
  ],
  wrong:[
    () => 'NETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR NOT Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => NOT Lampe_Bremse_Zu;',
    () => 'NETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => NOT Lampe_Bremse_Zu;',
    () => 'NETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR NOT Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => Lampe_Bremse_Zu;'
  ]
});

/* ---------- Kapitel 5: Flanken, Stromstoss ---------- */
const FAHRT_REF = f => 'NETWORK Zaehlen\n' + f + '(Kabine_da) => INC(Fahrten);\n\nNETWORK Nullen\nS_Null => MOVE(0, Fahrten);';
defExamTask({ id:'x_kop_g_fahrten', quest:'kop', level:'grund', ch:5, diff:1, timed:true,
  params:{ F:['P', 'N'] },
  title:'Kabinen zählen',
  brief: p => '<b>NW 1:</b> Jedes Mal, wenn eine Kabine ' + (p.F === 'P' ? '<b>einfährt</b> (steigende Flanke' : 'die Station <b>verlässt</b> (fallende Flanke') + ' von <code>Kabine_da</code>), wird <code>Fahrten</code> um 1 erhöht (INC).<br><b>NW 2:</b> <code>S_Null</code> setzt <code>Fahrten</code> auf 0 (MOVE).',
  vars: () => ({ Kabine_da:false, S_Null:false, Fahrten:0 }),
  start: () => START('Zaehlen'),
  ref: p => FAHRT_REF(p.F),
  must:['INC','MOVE'],
  visible: p => seq([[0.1,{Kabine_da:true},{Fahrten: p.F === 'P' ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}]]),
  hidden: p => { const P = p.F === 'P'; return [
    { steps:[[0.1,{},{Fahrten:0}],[0.1,{Kabine_da:true},{Fahrten: P ? 1 : 0}],[0.5,{},{Fahrten: P ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}],[0.5,{},{Fahrten:1}],[0.1,{Kabine_da:true},{Fahrten: P ? 2 : 1}],[0.1,{Kabine_da:false},{Fahrten:2}]] },
    { steps:[[0.1,{Kabine_da:true},{Fahrten: P ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}],[0.1,{S_Null:true},{Fahrten:0}],[0.1,{S_Null:false},{Fahrten:0}],[0.1,{Kabine_da:true},{Fahrten: P ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}]] },
    { steps:[[0.1,{Kabine_da:true},{}],[0.1,{Kabine_da:false},{}],[0.1,{Kabine_da:true},{}],[0.1,{Kabine_da:false},{}],[0.1,{Kabine_da:true},{Fahrten: P ? 3 : 2}],[0.1,{},{Fahrten: P ? 3 : 2}]] }
  ]; },
  wrong:[
    p => FAHRT_REF(p.F === 'P' ? 'N' : 'P'),
    () => 'NETWORK Zaehlen\nKabine_da => INC(Fahrten);\n\nNETWORK Nullen\nS_Null => MOVE(0, Fahrten);',
    p => 'NETWORK Zaehlen\n' + p.F + '(Kabine_da) => INC(Fahrten);'
  ]
});

const TOG = 'NETWORK Flanke\nP(S_Schranke) AND Freigabe => Tastimpuls;\n\nNETWORK Umschalten\n(Tastimpuls AND NOT Schranke_Zu) OR (NOT Tastimpuls AND Schranke_Zu) => Schranke_Zu;';
defExamTask({ id:'x_kop_g_stromstoss', quest:'kop', level:'grund', ch:5, diff:3, timed:true,
  title:'Schranke mit einem Taster',
  brief: () => 'Die Schranke wird mit <b>einem</b> Taster bedient (Stromstossschaltung): Jeder <b>Druck</b> auf <code>S_Schranke</code> schaltet <code>Schranke_Zu</code> um (0 → 1 → 0 …), aber nur, wenn <code>Freigabe</code> 1 ist. Langes Drücken schaltet nur einmal.<br>Die Hilfsvariable <code>Tastimpuls</code> steht zur Verfügung.',
  vars: () => ({ S_Schranke:false, Freigabe:true, Tastimpuls:false, Schranke_Zu:false }),
  start: () => START('Flanke'),
  ref: () => TOG,
  must:['EDGE_P'],
  visible: () => seq([[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{S_Schranke:false},{Schranke_Zu:true}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schranke_Zu:false}],[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{},{Schranke_Zu:true}],[0.5,{},{Schranke_Zu:true}],[0.1,{S_Schranke:false},{Schranke_Zu:true}],[0.1,{S_Schranke:true},{Schranke_Zu:false}],[0.1,{},{Schranke_Zu:false}],[0.1,{S_Schranke:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Freigabe:false, S_Schranke:true},{Schranke_Zu:false}],[0.1,{S_Schranke:false},{Schranke_Zu:false}],[0.1,{Freigabe:true},{Schranke_Zu:false}],[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{S_Schranke:false, Freigabe:false},{Schranke_Zu:true}],[0.1,{S_Schranke:true},{Schranke_Zu:true}]] },
    { steps:[[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{S_Schranke:false},{}],[0.1,{S_Schranke:true},{Schranke_Zu:false}],[0.1,{S_Schranke:false},{}],[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.2,{},{Schranke_Zu:true}]] }
  ],
  wrong:[
    () => 'NETWORK Flanke\nS_Schranke AND Freigabe => Tastimpuls;\n\nNETWORK Umschalten\n(Tastimpuls AND NOT Schranke_Zu) OR (NOT Tastimpuls AND Schranke_Zu) => Schranke_Zu;',
    () => 'NETWORK Flanke\nP(S_Schranke) => Tastimpuls;\n\nNETWORK Umschalten\n(Tastimpuls AND NOT Schranke_Zu) OR (NOT Tastimpuls AND Schranke_Zu) => Schranke_Zu;',
    () => 'NETWORK Flanke\nP(S_Schranke) AND Freigabe => S Schranke_Zu;'
  ]
});

/* ---------- Kapitel 6: TON, TOF, TP ---------- */
defExamTask({ id:'x_kop_g_luefter', quest:'kop', level:'grund', ch:6, diff:1, timed:true,
  params:{ T:[3, 5, 8] },
  title:'Lüfter mit Nachlauf',
  brief: p => 'Der Kabinenlüfter <code>Luefter</code> läuft, solange <code>Heizung</code> 1 ist, und danach noch <b>' + p.T + ' Sekunden</b> nach. Verwende eine Ausschaltverzögerung mit der Instanz <code>T_Luefter</code>.',
  vars: () => ({ Heizung:false, Luefter:false }),
  start: () => START('Luefter'),
  ref: p => 'NETWORK Luefter\nHeizung AND TOF(T_Luefter, T#' + p.T + 'S) => Luefter;',
  must:['TOF'],
  visible: p => seq([[0.1,{Heizung:true},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T + 0.5,{},{Luefter:false}]]),
  hidden: p => [
    { steps:[[0.1,{Heizung:true},{Luefter:true}],[2,{},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T - 0.5,{},{Luefter:true}],[0.6,{},{Luefter:false}],[1,{},{Luefter:false}]] },
    { steps:[[0.1,{Heizung:true},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T - 1,{},{Luefter:true}],[0.1,{Heizung:true},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T - 0.2,{},{Luefter:true}],[0.4,{},{Luefter:false}]] },
    { steps:[[0.1,{},{Luefter:false}],[p.T + 1,{},{Luefter:false}],[0.1,{Heizung:true},{Luefter:true}]] }
  ],
  wrong:[
    p => 'NETWORK Luefter\nHeizung AND TON(T_Luefter, T#' + p.T + 'S) => Luefter;',
    p => 'NETWORK Luefter\nHeizung AND TOF(T_Luefter, T#' + (p.T + 1) + 'S) => Luefter;',
    p => 'NETWORK Luefter\nHeizung AND TP(T_Luefter, T#' + p.T + 'S) => Luefter;'
  ]
});

defExamTask({ id:'x_kop_g_tuerzeit', quest:'kop', level:'grund', ch:6, diff:2, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Tür verzögert öffnen',
  brief: p => '<code>Tuer_Auf</code> wird 1, wenn <code>Kabine_da</code> <b>' + p.T + ' Sekunden</b> ununterbrochen 1 ist und <code>Sperre</code> 0 ist. Verwende einen TON mit der Instanz <code>T_Tuer</code>.',
  vars: () => ({ Kabine_da:false, Sperre:false, Tuer_Auf:false }),
  start: () => START('Tuer'),
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

/* ---------- Kapitel 7: Blinker, Überwachung, Vorwarnung ---------- */
const BRU = t => 'NETWORK Ueberwachung\nBremse_Befehl AND NOT Bremse_offen AND TON(T_Bremse, T#' + t + 'S) => S Bremsstoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT Bremse_Befehl => R Bremsstoerung;\n\nNETWORK Fahrfreigabe\nBremse_Befehl AND Bremse_offen AND NOT Bremsstoerung => Fahrt_frei;';
defExamTask({ id:'x_kop_g_bremsueberwachung', quest:'kop', level:'grund', ch:7, diff:2, timed:true,
  params:{ T:[2, 3, 5] },
  title:'Bremse überwachen',
  brief: p => '<b>NW 1:</b> Ist <code>Bremse_Befehl</code> 1, muss die Rückmeldung <code>Bremse_offen</code> innerhalb von <b>' + p.T + ' s</b> kommen. Fehlt sie so lange ununterbrochen, wird <code>Bremsstoerung</code> gesetzt (TON-Instanz <code>T_Bremse</code>).<br><b>NW 2:</b> <code>Quittieren</code> setzt <code>Bremsstoerung</code> zurück, aber nur wenn <code>Bremse_Befehl</code> 0 ist.<br><b>NW 3:</b> <code>Fahrt_frei</code> = <code>Bremse_Befehl</code> und <code>Bremse_offen</code> und keine <code>Bremsstoerung</code>.',
  vars: () => ({ Bremse_Befehl:false, Bremse_offen:false, Quittieren:false, Bremsstoerung:false, Fahrt_frei:false }),
  start: () => START('Ueberwachung'),
  ref: p => BRU(p.T),
  must:['TON','SET','RESET'],
  visible: p => seq([[0.1,{Bremse_Befehl:true},{Bremsstoerung:false}],[p.T + 0.5,{},{Bremsstoerung:true, Fahrt_frei:false}]]),
  hidden: p => [
    { steps:[[0.1,{Bremse_Befehl:true},{Bremsstoerung:false, Fahrt_frei:false}],[1,{Bremse_offen:true},{Bremsstoerung:false, Fahrt_frei:true}],[p.T + 2,{},{Bremsstoerung:false, Fahrt_frei:true}],[0.1,{Bremse_Befehl:false, Bremse_offen:false},{Fahrt_frei:false, Bremsstoerung:false}]] },
    { steps:[[0.1,{Bremse_Befehl:true},{Bremsstoerung:false}],[p.T - 0.5,{},{Bremsstoerung:false}],[0.6,{},{Bremsstoerung:true}],[0.1,{Bremse_offen:true},{Bremsstoerung:true, Fahrt_frei:false}],[0.1,{Quittieren:true},{Bremsstoerung:true}],[0.1,{Bremse_Befehl:false},{Bremsstoerung:false}],[0.1,{Quittieren:false},{Bremsstoerung:false}]] },
    { steps:[[0.1,{Bremse_Befehl:true},{}],[p.T - 1,{},{Bremsstoerung:false}],[0.1,{Bremse_offen:true},{Bremsstoerung:false}],[0.1,{Bremse_offen:false},{Bremsstoerung:false}],[p.T - 0.5,{},{Bremsstoerung:false}],[0.7,{},{Bremsstoerung:true}]] }
  ],
  wrong:[
    p => BRU(p.T).replace('TON(', 'TOF('),
    p => BRU(p.T).replace('Quittieren AND NOT Bremse_Befehl', 'Quittieren'),
    p => BRU(p.T + 1)
  ]
});

const BLINK = (e, a) => 'NETWORK Einzeit\nWarnung AND NOT Phase AND TON(T_Ein, ' + ms(e) + ') => S Phase;\n\nNETWORK Auszeit\nPhase AND TON(T_Aus, ' + ms(a) + ') => R Phase;\n\nNETWORK Warnung aus\nNOT Warnung => R Phase;\n\nNETWORK Lampe\nWarnung AND NOT Phase => Ampel_Gelb;';
// Abtastpunkte eines Blinkzyklus (Schritt 0,25 s): Erwartung nur an eindeutigen Zeitpunkten
const blinkRun = (E, A, n, marks) => { const st = []; for(let i = 1; i <= n; i++){ const t = i * 0.25; st.push([0.25, {}, marks[t] !== undefined ? { Ampel_Gelb: marks[t] } : {}]); } return st; };
defExamTask({ id:'x_kop_g_blinker', quest:'kop', level:'grund', ch:7, diff:3, timed:true,
  params:{ E:[0.5, 1], A:[1.5, 2] },
  title:'Warnblinker mit Ein- und Auszeit',
  brief: p => 'Solange <code>Warnung</code> 1 ist, blinkt <code>Ampel_Gelb</code>: zuerst <b>' + p.E + ' s an</b>, dann <b>' + p.A + ' s aus</b>, dann wieder an usw. Ist <code>Warnung</code> 0, ist die Lampe aus; beim nächsten Einschalten beginnt der Zyklus wieder mit der Ein-Phase.<br>Verwende die Hilfsvariable <code>Phase</code> (1 = Aus-Phase) sowie zwei TON-Instanzen <code>T_Ein</code> und <code>T_Aus</code>.',
  vars: () => ({ Warnung:false, Phase:false, Ampel_Gelb:false }),
  start: () => START('Einzeit'),
  ref: p => BLINK(p.E, p.A),
  must:['TON','SET','RESET'],
  visible: p => seq([[0,{Warnung:true},{Ampel_Gelb:true}],[p.E + 0.25,{},{Ampel_Gelb:false}]]),
  hidden: p => { const E = p.E, A = p.A, m = {}; m[E - 0.25] = true; m[E] = false; m[E + A - 0.25] = false; m[E + A] = true; m[E + A + E / 2] = true; m[2 * E + A + 0.25 + A / 2] = false;
    const n = Math.round((2 * E + 2 * A + 0.25) / 0.25) - 1;
    return [
      { steps:[[0,{Warnung:true},{Ampel_Gelb:true}]].concat(blinkRun(E, A, n, m)) },
      { steps:[[0,{},{Ampel_Gelb:false}],[1,{},{Ampel_Gelb:false}],[0.25,{Warnung:true},{Ampel_Gelb:true}],[E,{},{Ampel_Gelb:false}],[0.25,{Warnung:false},{Ampel_Gelb:false}],[0.25,{Warnung:true},{Ampel_Gelb:true}],[E - 0.25,{},{Ampel_Gelb:true}],[0.25,{},{Ampel_Gelb:false}]] },
      { steps:[[0,{Warnung:true},{Ampel_Gelb:true}],[0.25,{Warnung:false},{Ampel_Gelb:false}],[A + 1,{},{Ampel_Gelb:false}],[0.25,{Warnung:true},{Ampel_Gelb:true}]] }
    ]; },
  wrong:[
    p => BLINK(p.A, p.E),
    p => BLINK(p.E, p.A).replace('NETWORK Warnung aus\nNOT Warnung => R Phase;\n\n', ''),
    p => BLINK(p.E, p.A).replace('Warnung AND NOT Phase => Ampel_Gelb', 'NOT Phase => Ampel_Gelb')
  ]
});

/* ---------- Kapitel 8: CTU, CTD ---------- */
const SCHM = n => 'NETWORK Schmierzaehler\nAbfahrt AND CTU(Z_Schmier, PV:=' + n + ', R:=Geschmiert) => Schmieren;';
defExamTask({ id:'x_kop_g_schmierung', quest:'kop', level:'grund', ch:8, diff:1, timed:true,
  params:{ N:[4, 5, 6] },
  title:'Seilschmierung fällig',
  brief: p => 'Nach <b>' + p.N + ' Abfahrten</b> muss das Seil geschmiert werden. Zähle die Impulse von <code>Abfahrt</code> mit einem CTU (Instanz <code>Z_Schmier</code>). Sein Ausgang Q steuert <code>Schmieren</code>. Der Taster <code>Geschmiert</code> setzt den Zähler zurück.',
  vars: () => ({ Abfahrt:false, Geschmiert:false, Schmieren:false }),
  start: () => START('Schmierzaehler'),
  ref: p => SCHM(p.N),
  must:['CTU'],
  visible: p => seq(pulses('Abfahrt', p.N, i => ({ Schmieren: i >= p.N }))),
  hidden: p => [
    { steps:[[0,{},{Schmieren:false}]].concat(pulses('Abfahrt', p.N - 1, () => ({ Schmieren:false })), [[0.1,{Abfahrt:true},{Schmieren:true}],[0.5,{},{Schmieren:true}],[0.1,{Abfahrt:false},{Schmieren:true}]]) },
    { steps: pulses('Abfahrt', p.N + 1, i => ({ Schmieren: i >= p.N })).concat([[0.1,{Geschmiert:true},{Schmieren:false}],[0.1,{Geschmiert:false},{Schmieren:false}]], pulses('Abfahrt', 2, () => ({ Schmieren:false }))) },
    { steps: pulses('Abfahrt', 2, () => ({ Schmieren:false })).concat([[0.1,{Geschmiert:true},{}],[0.1,{Geschmiert:false},{}]], pulses('Abfahrt', p.N, i => ({ Schmieren: i >= p.N }))) }
  ],
  wrong:[
    p => SCHM(p.N + 1),
    p => SCHM(p.N - 1),
    p => 'NETWORK Schmierzaehler\nAbfahrt AND CTU(Z_Schmier, PV:=' + p.N + ') => Schmieren;'
  ]
});

const FREI = pv => 'NETWORK Plaetze\nEinstieg AND CTD(Z_Frei, PV:=' + pv + ', LD:=Neue_Kabine) => Kabine_voll;\n\nNETWORK Anzeige\n=> MOVE(Z_Frei.CV, Frei);';
defExamTask({ id:'x_kop_g_freie_plaetze', quest:'kop', level:'grund', ch:8, diff:2, timed:true,
  params:{ P:[4, 6, 8] },
  title:'Freie Plätze rückwärts zählen',
  brief: p => 'Eine Kabine hat <b>' + p.P + ' Plätze</b>.<br><b>NW 1:</b> Rückwärtszähler CTD (Instanz <code>Z_Frei</code>): <code>Neue_Kabine</code> lädt den Zähler auf ' + p.P + ', jeder Impuls von <code>Einstieg</code> zählt 1 ab. Der Ausgang Q steuert <code>Kabine_voll</code>.<br><b>NW 2:</b> ohne Bedingung → MOVE des Zählerstands nach <code>Frei</code>.',
  vars: () => ({ Einstieg:false, Neue_Kabine:false, Kabine_voll:false, Frei:0 }),
  start: () => START('Plaetze'),
  ref: p => FREI(p.P),
  must:['CTD','MOVE'],
  visible: p => seq([[0.1,{Neue_Kabine:true},{Frei:p.P, Kabine_voll:false}],[0.1,{Neue_Kabine:false},{}],[0.1,{Einstieg:true},{Frei:p.P - 1}]]),
  hidden: p => [
    { steps:[[0.1,{Neue_Kabine:true},{Frei:p.P, Kabine_voll:false}],[0.1,{Neue_Kabine:false},{Frei:p.P}]].concat(pulses('Einstieg', p.P, i => ({ Frei: p.P - i, Kabine_voll: i >= p.P })), [[0.5,{},{Frei:0, Kabine_voll:true}]]) },
    { steps:[[0.1,{Neue_Kabine:true},{}],[0.1,{Neue_Kabine:false},{}]].concat(pulses('Einstieg', 3, i => ({ Frei: p.P - i, Kabine_voll:false })), [[0.1,{Neue_Kabine:true},{Frei:p.P, Kabine_voll:false}],[0.1,{Neue_Kabine:false},{Frei:p.P}],[0.1,{Einstieg:true},{Frei:p.P - 1}]]) },
    { steps:[[0.1,{Neue_Kabine:true},{}],[0.1,{Neue_Kabine:false},{}]].concat(pulses('Einstieg', p.P - 1, () => ({ Kabine_voll:false })), [[0.1,{},{Frei:1, Kabine_voll:false}],[0.1,{Einstieg:true},{Frei:0, Kabine_voll:true}]]) }
  ],
  wrong:[
    p => FREI(p.P + 1),
    p => 'NETWORK Plaetze\nEinstieg AND CTU(Z_Frei, PV:=' + p.P + ', R:=Neue_Kabine) => Kabine_voll;\n\nNETWORK Anzeige\n=> MOVE(Z_Frei.CV, Frei);',
    p => 'NETWORK Plaetze\nEinstieg AND CTD(Z_Frei, PV:=' + p.P + ', LD:=Neue_Kabine) => Kabine_voll;'
  ]
});

/* ---------- Kapitel 9: Vergleicher, MOVE, Rechnen ---------- */
const OEL = (w, a) => 'NETWORK Warnung\n[Oel_Temp >= ' + w + '] AND [Oel_Temp <= ' + a + '] => Warnung;\n\nNETWORK Abschalten\n[Oel_Temp > ' + a + '] => Abschalten;';
defExamTask({ id:'x_kop_g_getriebe', quest:'kop', level:'grund', ch:9, diff:2,
  params:{ W:[70, 75, 80], A:[90, 95] },
  title:'Getriebeöl-Temperatur',
  brief: p => '<code>Oel_Temp</code> ist die Öltemperatur des Hauptgetriebes in °C (Int).<br><b>NW 1:</b> <code>Warnung</code> = 1 von <b>' + p.W + ' °C bis und mit ' + p.A + ' °C</b>.<br><b>NW 2:</b> <code>Abschalten</code> = 1 <b>über ' + p.A + ' °C</b>.',
  vars: () => ({ Oel_Temp:0, Warnung:false, Abschalten:false }),
  start: () => START('Warnung'),
  ref: p => OEL(p.W, p.A),
  must:['CMP'],
  visible: p => [[{ Oel_Temp:40 }, { Warnung:false, Abschalten:false }], [{ Oel_Temp:p.W + 5 }, { Warnung:true, Abschalten:false }]],
  hidden: p => [20, p.W - 1, p.W, p.W + 1, p.A - 1, p.A, p.A + 1, 130].map(t => [{ Oel_Temp:t }, { Warnung: t >= p.W && t <= p.A, Abschalten: t > p.A }]),
  wrong:[
    p => OEL(p.W, p.A).replace('>= ' + p.W, '> ' + p.W),
    p => OEL(p.W, p.A).replace('[Oel_Temp > ' + p.A + ']', '[Oel_Temp >= ' + p.A + ']'),
    p => 'NETWORK Warnung\n[Oel_Temp >= ' + p.W + '] => Warnung;\n\nNETWORK Abschalten\n[Oel_Temp > ' + p.A + '] => Abschalten;'
  ]
});

const LAST = (kg, max) => 'NETWORK Personen\n=> MUL(Gaeste, ' + kg + ', Last_kg);\n\nNETWORK Gepaeck\n=> ADD(Last_kg, Gepaeck_kg, Last_kg);\n\nNETWORK Ueberlast\n[Last_kg > ' + max + '] => Ueberlast;';
defExamTask({ id:'x_kop_g_last', quest:'kop', level:'grund', ch:9, diff:3,
  params:{ KG:[75, 80], MAX:[600, 700, 800] },
  title:'Kabinenlast berechnen',
  brief: p => 'Berechne die Last der Kabine in kg (alles Int):<br><b>NW 1:</b> <code>Last_kg</code> = <code>Gaeste</code> × ' + p.KG + ' (MUL)<br><b>NW 2:</b> <code>Last_kg</code> = <code>Last_kg</code> + <code>Gepaeck_kg</code> (ADD)<br><b>NW 3:</b> <code>Ueberlast</code> = 1, wenn <code>Last_kg</code> <b>grösser als ' + p.MAX + '</b> ist.<br>Alle Netzwerke ohne Bedingung bzw. mit Vergleicher; die Reihenfolge ist wichtig.',
  vars: () => ({ Gaeste:0, Gepaeck_kg:0, Last_kg:0, Ueberlast:false }),
  start: () => START('Personen'),
  ref: p => LAST(p.KG, p.MAX),
  must:['MUL','ADD','CMP'],
  visible: p => [[{ Gaeste:2, Gepaeck_kg:30 }, { Last_kg: 2 * p.KG + 30, Ueberlast:false }]],
  hidden: p => { const g = Math.floor(p.MAX / p.KG), b = p.MAX - g * p.KG, c = (G, B) => [{ Gaeste:G, Gepaeck_kg:B }, { Last_kg: G * p.KG + B, Ueberlast: G * p.KG + B > p.MAX }];
    return [c(0, 0), c(1, 0), c(3, 45), c(g, b), c(g, b + 1), c(g - 1, p.KG + b + 5), c(g + 1, 0), c(0, 120)]; },
  wrong:[
    p => 'NETWORK Ueberlast\n[Last_kg > ' + p.MAX + '] => Ueberlast;\n\nNETWORK Personen\n=> MUL(Gaeste, ' + p.KG + ', Last_kg);\n\nNETWORK Gepaeck\n=> ADD(Last_kg, Gepaeck_kg, Last_kg);',
    p => 'NETWORK Personen\n=> MUL(Gaeste, ' + p.KG + ', Last_kg);\n\nNETWORK Ueberlast\n[Last_kg > ' + p.MAX + '] => Ueberlast;',
    p => LAST(p.KG, p.MAX).replace('[Last_kg > ', '[Last_kg >= ')
  ]
});

/* ---------- Kapitel 10: Sicherheitskette, Schrittkette ---------- */
const KETTE = g => 'NETWORK Sicherheitskette\nSchranke_Zu AND Not_Halt_OK AND Seil_Lage_OK AND [Wind_kmh <= ' + g + '] => Kette_OK, NOT Ampel_Rot;\n\nNETWORK Antrieb\nS_Fahrt AND Kette_OK => Antrieb;';
const KIN = ['Schranke_Zu','Not_Halt_OK','Seil_Lage_OK','S_Fahrt'];
defExamTask({ id:'x_kop_g_kette', quest:'kop', level:'grund', ch:10, diff:2,
  params:{ G:[50, 60, 70] },
  title:'Sicherheitskette mit Windmesser',
  brief: p => '<b>NW 1:</b> Die Sicherheitskette <code>Kette_OK</code> ist geschlossen, wenn <code>Schranke_Zu</code>, <code>Not_Halt_OK</code> und <code>Seil_Lage_OK</code> 1 sind <b>und</b> <code>Wind_kmh</code> höchstens <b>' + p.G + '</b> ist. <code>Ampel_Rot</code> leuchtet genau dann, wenn die Kette offen ist.<br><b>NW 2:</b> <code>Antrieb</code> = <code>S_Fahrt</code> und <code>Kette_OK</code>.',
  vars: () => ({ Schranke_Zu:false, Not_Halt_OK:false, Seil_Lage_OK:false, Wind_kmh:0, S_Fahrt:false, Kette_OK:false, Ampel_Rot:false, Antrieb:false }),
  start: () => START('Sicherheitskette'),
  ref: p => KETTE(p.G),
  must:['SERIES','CMP'],
  visible: () => [[{ Schranke_Zu:true, Not_Halt_OK:true, Seil_Lage_OK:true, Wind_kmh:20, S_Fahrt:true }, { Kette_OK:true, Antrieb:true, Ampel_Rot:false }]],
  hidden: p => truth(KIN, e => { const k = e.Schranke_Zu && e.Not_Halt_OK && e.Seil_Lage_OK; return { Kette_OK:k, Ampel_Rot:!k, Antrieb: k && e.S_Fahrt }; }, { Wind_kmh:p.G })
    .concat([p.G + 1, p.G - 1, 0].map(w => [{ Schranke_Zu:true, Not_Halt_OK:true, Seil_Lage_OK:true, S_Fahrt:true, Wind_kmh:w }, { Kette_OK: w <= p.G, Ampel_Rot: w > p.G, Antrieb: w <= p.G }])),
  wrong:[
    p => KETTE(p.G).replace('<= ' + p.G, '< ' + p.G),
    p => KETTE(p.G).replace(' AND Seil_Lage_OK', ''),
    p => KETTE(p.G).replace('S_Fahrt AND Kette_OK', 'S_Fahrt')
  ]
});

const MAT = t => 'NETWORK Grundstellung\nNOT Schritt_Laden AND NOT Schritt_Fahrt AND NOT Schritt_Kippen => S Schritt_Laden;\n\nNETWORK Laden -> Fahrt\nSchritt_Laden AND Waage_voll => S Schritt_Fahrt, R Schritt_Laden;\n\nNETWORK Fahrt -> Kippen\nSchritt_Fahrt AND Oben => S Schritt_Kippen, R Schritt_Fahrt;\n\nNETWORK Kippen -> Laden\nSchritt_Kippen AND TON(T_Kippen, T#' + t + 'S) => S Schritt_Laden, R Schritt_Kippen;\n\nNETWORK Band\nSchritt_Laden => Band;\n\nNETWORK Winde\nSchritt_Fahrt => Winde;\n\nNETWORK Kippen\nSchritt_Kippen => Kippen;';
defExamTask({ id:'x_kop_g_materialbahn', quest:'kop', level:'grund', ch:10, diff:3, timed:true,
  params:{ T:[2, 3] },
  title:'Schrittkette der Materialbahn',
  brief: p => 'Die Materialbahn zur Bergstation arbeitet als Schrittkette mit den Schrittmerkern <code>Schritt_Laden</code>, <code>Schritt_Fahrt</code>, <code>Schritt_Kippen</code>:<br>' +
    '<b>Grundstellung:</b> Ist kein Schritt aktiv, wird <code>Schritt_Laden</code> gesetzt.<br>' +
    '<b>Laden → Fahrt:</b> wenn <code>Waage_voll</code> 1 ist.<br><b>Fahrt → Kippen:</b> wenn <code>Oben</code> 1 ist.<br><b>Kippen → Laden:</b> nach <b>' + p.T + ' s</b> im Schritt Kippen (TON-Instanz <code>T_Kippen</code>).<br>' +
    'Beim Weiterschalten wird der neue Schritt gesetzt und der alte rückgesetzt. Ausgänge: <code>Band</code> im Schritt Laden, <code>Winde</code> im Schritt Fahrt, <code>Kippen</code> im Schritt Kippen.',
  vars: () => ({ Waage_voll:false, Oben:false, Schritt_Laden:false, Schritt_Fahrt:false, Schritt_Kippen:false, Band:false, Winde:false, Kippen:false }),
  start: () => START('Grundstellung'),
  ref: p => MAT(p.T),
  must:['SET','RESET','TON'],
  visible: () => seq([[0,{},{Band:true, Winde:false}],[0.1,{Waage_voll:true},{Band:false, Winde:true}]]),
  hidden: p => [
    { steps:[[0,{},{Band:true, Winde:false, Kippen:false}],[0.1,{Waage_voll:true},{Band:false, Winde:true}],[0.1,{Waage_voll:false},{Winde:true}],[1,{},{Winde:true, Kippen:false}],[0.1,{Oben:true},{Winde:false, Kippen:true}],[p.T - 0.5,{Oben:false},{Kippen:true, Band:false}],[0.5,{},{Kippen:false, Band:true}],[0.1,{},{Band:true, Winde:false}]] },
    { steps:[[0,{Oben:true},{Band:true, Kippen:false, Winde:false}],[0.1,{Oben:false, Waage_voll:true},{Winde:true, Band:false}],[0.1,{Oben:true},{Kippen:true, Winde:false, Band:false}],[p.T + 0.1,{Oben:false},{Kippen:false, Band:true}],[0.1,{},{Winde:true, Band:false}]] },
    { steps:[[0,{},{Band:true}],[0.1,{Waage_voll:true},{Winde:true}],[0.1,{Waage_voll:false, Oben:true},{Kippen:true}],[0.1,{Oben:false, Waage_voll:true},{Kippen:true, Winde:false}],[0.1,{Waage_voll:false},{Kippen:true, Band:false}]] }
  ],
  wrong:[
    p => MAT(p.T).replace('Schritt_Fahrt AND Oben', 'Oben'),
    p => MAT(p.T).replace('S Schritt_Fahrt, R Schritt_Laden', 'S Schritt_Fahrt'),
    p => MAT(p.T).replace('TON(T_Kippen', 'TOF(T_Kippen')
  ]
});

/* =====================================================================
   PROFI-STUFE (Kapitel 11–15)
   ===================================================================== */
const MAIN = body => kOB('Main', body);

/* ---------- Kapitel 11: FC, Schnittstelle, Aufruf-Box ---------- */
const WIND_D = { in:'Wind:Int|Windgeschwindigkeit km/h; Grenze:Int|Abschaltgrenze; Sturm_Hand:Bool|Sturmwarnung von Hand', out:'Abschalten:Bool|Fahrt verboten' };
defExamTask({ id:'x_kop_p_wind', quest:'kop', level:'profi', ch:11, diff:1,
  params:{ G:[50, 60, 70] },
  title:'Windabschaltung als FC',
  brief: p => 'Programmiere die Funktion <code>FC_Wind</code>: <code>#Abschalten</code> ist 1, wenn <code>#Wind</code> <b>grösser als</b> <code>#Grenze</code> ist <b>oder</b> <code>#Sturm_Hand</code> 1 ist. Der OB <code>Main</code> (🔒) ruft die FC mit der Grenze ' + p.G + ' km/h auf.',
  blocks: p => [
    { name:'FC_Wind', kind:'FC', edit:true, start: kFC('FC_Wind', 'Void', WIND_D, ''), ref: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind > #Grenze] OR #Sturm_Hand => #Abschalten;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Windwaechter\n=> "FC_Wind"(Wind := "Wind_kmh", Grenze := ' + p.G + ', Sturm_Hand := "S_Sturm", Abschalten => "Wind_Stopp");') }
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

const PL_D = { in:'Gaeste:Int|Personen in der Kabine; Kapazitaet:Int|Plätze der Kabine', out:'Voll:Bool|Kabine voll' };
const PL_FC = body => kFC('FC_Plaetze', 'Int', PL_D, body);
const PL_NW = 'NETWORK Freie Plaetze\n=> SUB(#Kapazitaet, #Gaeste, #Ret_Val);\n\nNETWORK Voll\n[#Gaeste >= #Kapazitaet] => #Voll;';
defExamTask({ id:'x_kop_p_plaetze', quest:'kop', level:'profi', ch:11, diff:2,
  params:{ K:[6, 8, 10] },
  title:'Freie Plätze als Rückgabewert',
  brief: p => 'Die Funktion <code>FC_Plaetze</code> hat den Rückgabetyp <code>Int</code>.<br><b>NW 1:</b> ohne Bedingung → <b>SUB</b>: <code>#Kapazitaet</code> − <code>#Gaeste</code> nach <code>#Ret_Val</code><br><b>NW 2:</b> <code>#Voll</code> = 1, wenn <code>#Gaeste</code> mindestens <code>#Kapazitaet</code> ist.<br><code>Main</code> (🔒) ruft die FC mit der Kapazität ' + p.K + ' auf.',
  blocks: p => [
    { name:'FC_Plaetze', kind:'FC', edit:true, start: PL_FC(''), ref: PL_FC(PL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Kabine\n=> "FC_Plaetze"(Gaeste := "Gaeste", Kapazitaet := ' + p.K + ', Voll => "Kabine_voll", Ret_Val => "Frei");') }
  ],
  globals: () => ({ Gaeste:0, Kabine_voll:false, Frei:0 }),
  must:['RETVAL','SUB','CMP'],
  visible: p => ({ tests:[[{ Gaeste:2 }, { Frei:p.K - 2, Kabine_voll:false }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Plaetze', steps:[[{ Gaeste:0, Kapazitaet:4 }, { RET:4, Voll:false }], [{ Gaeste:3, Kapazitaet:4 }, { RET:1, Voll:false }], [{ Gaeste:4, Kapazitaet:4 }, { RET:0, Voll:true }], [{ Gaeste:5, Kapazitaet:4 }, { RET:-1, Voll:true }]] }],
    tests:[[{ Gaeste:0 }, { Frei:p.K, Kabine_voll:false }], [{ Gaeste:p.K - 1 }, { Frei:1, Kabine_voll:false }], [{ Gaeste:p.K }, { Frei:0, Kabine_voll:true }]]
  }),
  wrong:[
    () => ({ FC_Plaetze: PL_FC('NETWORK Freie Plaetze\n=> SUB(#Gaeste, #Kapazitaet, #Ret_Val);\n\nNETWORK Voll\n[#Gaeste >= #Kapazitaet] => #Voll;') }),
    () => ({ FC_Plaetze: PL_FC('NETWORK Freie Plaetze\n=> SUB(#Kapazitaet, #Gaeste, #Ret_Val);\n\nNETWORK Voll\n[#Gaeste > #Kapazitaet] => #Voll;') })
  ]
});

/* ---------- Kapitel 12: FB, Instanz, Multiinstanz ---------- */
const HUPE_D = { in:'Abfahrt:Bool|Abfahrsignal', out:'Hupe:Bool|Warnhupe', stat:'T_Hupe:TP|Hupdauer' };
const HUPE_FB = (k, t) => kFB('FB_Warnhupe', HUPE_D, 'NETWORK Hupe\n#Abfahrt AND ' + k + '(#T_Hupe, T#' + t + 'S) => #Hupe;');
defExamTask({ id:'x_kop_p_warnhupe', quest:'kop', level:'profi', ch:12, diff:1,
  params:{ T:[2, 3, 4] },
  title:'Warnhupe mit fester Dauer',
  brief: p => 'In <code>FB_Warnhupe</code> ist die Static-Variable <code>T_Hupe : TP</code> deklariert.<br>Jede steigende Flanke von <code>#Abfahrt</code> soll <code>#Hupe</code> für genau <b>' + p.T + ' s</b> einschalten — egal, wie lange <code>#Abfahrt</code> ansteht. Verwende den Impuls-Timer <code>#T_Hupe</code>.<br><code>Main</code> (🔒) ruft den FB mit <code>"FB_Warnhupe_DB"</code> auf.',
  blocks: p => [
    { name:'FB_Warnhupe', kind:'FB', edit:true, start: kFB('FB_Warnhupe', HUPE_D, ''), ref: HUPE_FB('TP', p.T) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Warnhupe\n=> "FB_Warnhupe_DB"(Abfahrt := "S_Abfahrt", Hupe => "Hupe");') }
  ],
  globals: () => ({ S_Abfahrt:false, Hupe:false }),
  must:['TP'],
  visible: p => ({ timed: seq([[0,{ S_Abfahrt:true },{ Hupe:true }],[0.1,{ S_Abfahrt:false },{ Hupe:true }],[p.T,{},{ Hupe:false }]]) }),
  hidden: p => ({
    unit:[{ block:'FB_Warnhupe', steps:[[0,{ Abfahrt:true },{ Hupe:true }],[p.T + 1,{},{ Hupe:false }],[0.1,{ Abfahrt:false },{ Hupe:false }],[0.1,{ Abfahrt:true },{ Hupe:true }],[0.1,{ Abfahrt:false },{ Hupe:true }]] }],
    timed:[
      { steps:[[0,{},{ Hupe:false }],[0.1,{ S_Abfahrt:true },{ Hupe:true }],[0.1,{ S_Abfahrt:false },{ Hupe:true }],[p.T - 0.5,{},{ Hupe:true }],[0.6,{},{ Hupe:false }],[1,{},{ Hupe:false }]] },
      { steps:[[0.1,{ S_Abfahrt:true },{ Hupe:true }],[p.T - 0.3,{},{ Hupe:true }],[0.5,{},{ Hupe:false }],[2,{},{ Hupe:false }],[0.1,{ S_Abfahrt:false },{ Hupe:false }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Warnhupe: kFB('FB_Warnhupe', { in:'Abfahrt:Bool', out:'Hupe:Bool', stat:'T_Hupe:TON' }, 'NETWORK Hupe\n#Abfahrt AND TON(#T_Hupe, T#' + p.T + 'S) => #Hupe;') }),
    p => ({ FB_Warnhupe: kFB('FB_Warnhupe', { in:'Abfahrt:Bool', out:'Hupe:Bool', stat:'T_Hupe:TOF' }, 'NETWORK Hupe\n#Abfahrt AND TOF(#T_Hupe, T#' + p.T + 'S) => #Hupe;') }),
    p => ({ FB_Warnhupe: HUPE_FB('TP', p.T + 1) })
  ]
});

const BEL_D = { in:'Einstieg:Bool|Lichtschranke Einstieg; Ausstieg:Bool|Lichtschranke Ausstieg; Max:Int|Plätze', out:'Anzahl:Int|Personen in der Kabine; Voll:Bool' };
const BEL_NW = 'NETWORK Einsteigen\nP(#Einstieg) => INC(#Anzahl);\n\nNETWORK Aussteigen\nP(#Ausstieg) AND [#Anzahl > 0] => DEC(#Anzahl);\n\nNETWORK Voll\n[#Anzahl >= #Max] => #Voll;';
defExamTask({ id:'x_kop_p_belegung', quest:'kop', level:'profi', ch:12, diff:2,
  params:{ M:[3, 4] },
  title:'Kabinenbelegung im FB',
  brief: p => 'Programmiere <code>FB_Belegung</code>:<br><b>NW 1:</b> steigende Flanke von <code>#Einstieg</code> → INC <code>#Anzahl</code><br><b>NW 2:</b> steigende Flanke von <code>#Ausstieg</code> <b>und</b> <code>#Anzahl</code> &gt; 0 → DEC <code>#Anzahl</code><br><b>NW 3:</b> <code>#Voll</code> = 1, wenn <code>#Anzahl</code> ≥ <code>#Max</code><br><code>Main</code> (🔒) ruft den FB mit <code>Max := ' + p.M + '</code> auf.',
  blocks: p => [
    { name:'FB_Belegung', kind:'FB', edit:true, start: kFB('FB_Belegung', BEL_D, ''), ref: kFB('FB_Belegung', BEL_D, BEL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Belegung\n=> "FB_Belegung_DB"(Einstieg := "LS_Ein", Ausstieg := "LS_Aus", Max := ' + p.M + ', Anzahl => "Anzahl", Voll => "Kabine_voll");') }
  ],
  globals: () => ({ LS_Ein:false, LS_Aus:false, Anzahl:0, Kabine_voll:false }),
  must:['EDGE_P','INC','DEC','CMP'],
  visible: () => ({ timed: seq([[0,{ LS_Ein:true },{ Anzahl:1 }],[0.1,{ LS_Ein:false },{ Anzahl:1 }],[0.1,{ LS_Aus:true },{ Anzahl:0 }]]) }),
  hidden: p => ({
    unit:[{ block:'FB_Belegung', steps:[[0,{ Max:5, Ausstieg:true },{ Anzahl:0 }],[0.1,{ Ausstieg:false },{ Anzahl:0 }],[0.1,{ Einstieg:true },{ Anzahl:1, Voll:false }],[0.5,{},{ Anzahl:1 }],[0.1,{ Einstieg:false, Ausstieg:true },{ Anzahl:0 }],[0.1,{ Ausstieg:false },{ Anzahl:0 }]] }],
    timed:[
      { steps: pulses('LS_Ein', p.M, i => ({ Anzahl:i, Kabine_voll: i >= p.M })).concat([[0.1,{ LS_Aus:true },{ Anzahl:p.M - 1, Kabine_voll:false }],[0.3,{},{ Anzahl:p.M - 1 }],[0.1,{ LS_Aus:false },{ Anzahl:p.M - 1 }]]) },
      { steps:[[0.1,{ LS_Aus:true },{ Anzahl:0 }],[0.1,{ LS_Aus:false },{ Anzahl:0 }],[0.1,{ LS_Ein:true },{ Anzahl:1 }],[0.1,{},{ Anzahl:1 }],[0.1,{ LS_Ein:false },{ Anzahl:1, Kabine_voll:false }]] }
    ]
  }),
  wrong:[
    () => ({ FB_Belegung: kFB('FB_Belegung', BEL_D, BEL_NW.replace('P(#Einstieg)', '#Einstieg')) }),
    () => ({ FB_Belegung: kFB('FB_Belegung', BEL_D, BEL_NW.replace(' AND [#Anzahl > 0]', '')) }),
    () => ({ FB_Belegung: kFB('FB_Belegung', BEL_D, BEL_NW.replace('[#Anzahl >= #Max]', '[#Anzahl > #Max]')) })
  ]
});

const UEB_D = { in:'Befehl:Bool; Rueckmeldung:Bool; Zeit:Time|Überwachungszeit; Quit:Bool', out:'Fehler:Bool', stat:'T_Ueber:TON' };
const UEB_FB = kFB('FB_Ueberw', UEB_D, 'NETWORK Ueberwachen\n#Befehl AND NOT #Rueckmeldung AND TON(#T_Ueber, #Zeit) => S #Fehler;\n\nNETWORK Quittieren\n#Quit AND NOT #Befehl => R #Fehler;');
const BRS_D = { in:'Lueften:Bool|Befehl Bremsen lüften; RM_Br1:Bool|Bremse 1 offen; RM_Br2:Bool|Bremse 2 offen; Quit:Bool', out:'Stoerung:Bool; Frei:Bool|Fahrfreigabe', stat:'Br1:"FB_Ueberw"; Br2:"FB_Ueberw"' };
const BRS_NW = t => 'NETWORK Bremse 1\n=> #Br1(Befehl := #Lueften, Rueckmeldung := #RM_Br1, Zeit := T#' + t + 'S, Quit := #Quit);\n\nNETWORK Bremse 2\n=> #Br2(Befehl := #Lueften, Rueckmeldung := #RM_Br2, Zeit := T#' + t + 'S, Quit := #Quit);\n\nNETWORK Sammelstoerung\n#Br1.Fehler OR #Br2.Fehler => #Stoerung;\n\nNETWORK Freigabe\n#Lueften AND #RM_Br1 AND #RM_Br2 AND NOT #Stoerung => #Frei;';
defExamTask({ id:'x_kop_p_bremsen', quest:'kop', level:'profi', ch:12, diff:3,
  params:{ T:[2, 3] },
  title:'Zwei Bremsen, zwei Multiinstanzen',
  brief: p => '<code>FB_Ueberw</code> (🔒) überwacht einen Befehl mit Rückmeldung (Ausgang <code>Fehler</code>). In <code>FB_Bremsen</code> sind die Multiinstanzen <code>Br1</code> und <code>Br2</code> vom Typ <code>"FB_Ueberw"</code> deklariert.<br>' +
    '<b>NW 1:</b> <code>#Br1</code> aufrufen: Befehl := <code>#Lueften</code>, Rueckmeldung := <code>#RM_Br1</code>, Zeit := <code>T#' + p.T + 'S</code>, Quit := <code>#Quit</code><br><b>NW 2:</b> <code>#Br2</code> ebenso mit <code>#RM_Br2</code><br>' +
    '<b>NW 3:</b> <code>#Br1.Fehler</code> oder <code>#Br2.Fehler</code> → <code>#Stoerung</code><br><b>NW 4:</b> <code>#Lueften</code> und beide Rückmeldungen und keine Störung → <code>#Frei</code>',
  blocks: p => [
    { name:'FB_Ueberw', kind:'FB', src: UEB_FB },
    { name:'FB_Bremsen', kind:'FB', edit:true, start: kFB('FB_Bremsen', BRS_D, ''), ref: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bremsen\n=> "FB_Bremsen_DB"(Lueften := "Bremse_Lueften", RM_Br1 := "RM_Bremse1", RM_Br2 := "RM_Bremse2", Quit := "Quittieren", Stoerung => "Bremsstoerung", Frei => "Fahrt_frei");') }
  ],
  globals: () => ({ Bremse_Lueften:false, RM_Bremse1:false, RM_Bremse2:false, Quittieren:false, Bremsstoerung:false, Fahrt_frei:false }),
  must:['MULTI','CALL'],
  visible: () => ({ timed: seq([[0,{ Bremse_Lueften:true },{ Fahrt_frei:false }],[0.5,{ RM_Bremse1:true, RM_Bremse2:true },{ Fahrt_frei:true, Bremsstoerung:false }]]) }),
  hidden: p => ({
    timed:[
      { steps:[[0,{ Bremse_Lueften:true },{ Bremsstoerung:false }],[0.5,{ RM_Bremse1:true },{ Fahrt_frei:false }],[p.T,{},{ Bremsstoerung:true, Fahrt_frei:false }],[0.1,{ RM_Bremse2:true },{ Bremsstoerung:true, Fahrt_frei:false }],[0.1,{ Bremse_Lueften:false, Quittieren:true },{ Bremsstoerung:false }],[0.1,{ Quittieren:false, Bremse_Lueften:true },{ Fahrt_frei:true }]] },
      { steps:[[0,{ Bremse_Lueften:true, RM_Bremse2:true },{}],[p.T - 0.5,{},{ Bremsstoerung:false }],[0.7,{},{ Bremsstoerung:true }],[0.1,{ Quittieren:true },{ Bremsstoerung:true }]] },
      { steps:[[0,{ Bremse_Lueften:true },{}],[0.3,{ RM_Bremse1:true, RM_Bremse2:true },{ Fahrt_frei:true }],[p.T + 1,{},{ Fahrt_frei:true, Bremsstoerung:false }],[0.1,{ RM_Bremse2:false },{ Fahrt_frei:false, Bremsstoerung:false }],[p.T + 0.2,{},{ Bremsstoerung:true }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Bremsen: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T).replace('#Br1.Fehler OR #Br2.Fehler', '#Br1.Fehler')) }),
    p => ({ FB_Bremsen: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T).replace(' AND NOT #Stoerung', '')) }),
    p => ({ FB_Bremsen: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T + 2)) })
  ]
});

/* ---------- Kapitel 13: Datenbaustein, PLC-Datentyp, Array ---------- */
const SEIL_DB = (mn, mx) => kDB('DB_Seil', 'Spannung_kN:Int|Messwert Seilspannung; Min_kN:Int := ' + mn + '|untere Grenze; Max_kN:Int := ' + mx + '|obere Grenze');
const SEIL_NW = 'NETWORK Alarm\n["DB_Seil".Spannung_kN < "DB_Seil".Min_kN] OR ["DB_Seil".Spannung_kN > "DB_Seil".Max_kN] => "Seil_Alarm";\n\nNETWORK Anzeige\n=> MOVE("DB_Seil".Spannung_kN, "Anzeige");';
defExamTask({ id:'x_kop_p_seilspannung', quest:'kop', level:'profi', ch:13, diff:1,
  params:{ MIN:[40, 50], MAX:[80, 90] },
  title:'Seilspannung aus dem Datenbaustein',
  brief: p => '<code>DB_Seil</code> (🔒) enthält den Messwert <code>Spannung_kN</code> und die Grenzen <code>Min_kN</code> (Startwert ' + p.MIN + ') und <code>Max_kN</code> (Startwert ' + p.MAX + '). In <code>Main</code>:<br><b>NW 1:</b> <code>"Seil_Alarm"</code> = 1, wenn die Spannung <b>kleiner als</b> <code>Min_kN</code> <b>oder grösser als</b> <code>Max_kN</code> ist. Lies die Grenzen aus dem DB (keine festen Zahlen).<br><b>NW 2:</b> ohne Bedingung → MOVE der Spannung nach <code>"Anzeige"</code>.',
  blocks: p => [
    { name:'DB_Seil', kind:'DB', src: SEIL_DB(p.MIN, p.MAX) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(SEIL_NW) }
  ],
  globals: () => ({ Seil_Alarm:false, Anzeige:0 }),
  must:['DB_ACCESS','CMP','MOVE'],
  visible: p => ({ tests:[[{ 'DB_Seil.Spannung_kN':p.MIN + 10 }, { Seil_Alarm:false, Anzeige:p.MIN + 10 }], [{ 'DB_Seil.Spannung_kN':10 }, { Seil_Alarm:true }]] }),
  hidden: p => ({ tests: [p.MIN - 1, p.MIN, p.MAX, p.MAX + 1, 0].map(v => [{ 'DB_Seil.Spannung_kN':v }, { Seil_Alarm: v < p.MIN || v > p.MAX, Anzeige:v }])
    .concat([[{ 'DB_Seil.Spannung_kN':p.MAX - 5, 'DB_Seil.Max_kN':p.MAX - 10 }, { Seil_Alarm:true }], [{ 'DB_Seil.Spannung_kN':p.MIN + 2, 'DB_Seil.Min_kN':p.MIN + 5 }, { Seil_Alarm:true }]]) }),
  wrong:[
    p => ({ Main: MAIN('NETWORK Alarm\n["DB_Seil".Spannung_kN < ' + p.MIN + '] OR ["DB_Seil".Spannung_kN > ' + p.MAX + '] => "Seil_Alarm";\n\nNETWORK Anzeige\n=> MOVE("DB_Seil".Spannung_kN, "Anzeige");') }),
    () => ({ Main: MAIN(SEIL_NW.replace('< "DB_Seil".Min_kN', '<= "DB_Seil".Min_kN')) }),
    () => ({ Main: MAIN(SEIL_NW.replace('NETWORK Anzeige\n=> MOVE("DB_Seil".Spannung_kN, "Anzeige");', 'NETWORK Anzeige\n=> MOVE("DB_Seil".Max_kN, "Anzeige");')) })
  ]
});

const GONDEL_UDT = kUDT('UDT_Gondel', 'Tuer_Zu:Bool|Tür geschlossen; Last_kg:Int|Zuladung; Revision:Bool|in Revision');
const GONDEL_DB = kDB('DB_Gondeln', 'G1:"UDT_Gondel"|Gondel 1; G2:"UDT_Gondel"|Gondel 2');
const GONDEL_D = { in:'Gondel:"UDT_Gondel"|Daten der Gondel; Max_kg:Int|zulässige Zuladung', out:'Bereit:Bool|abfahrbereit; Ueberlast:Bool' };
const GONDEL_NW = 'NETWORK Ueberlast\n[#Gondel.Last_kg > #Max_kg] => #Ueberlast;\n\nNETWORK Bereit\n#Gondel.Tuer_Zu AND NOT #Gondel.Revision AND [#Gondel.Last_kg <= #Max_kg] => #Bereit;';
defExamTask({ id:'x_kop_p_gondel', quest:'kop', level:'profi', ch:13, diff:2,
  params:{ MAX:[480, 560, 640] },
  title:'Gondel als PLC-Datentyp',
  brief: p => 'Der PLC-Datentyp <code>UDT_Gondel</code> (🔒) enthält <code>Tuer_Zu</code>, <code>Last_kg</code> und <code>Revision</code>. <code>FC_Gondel</code> bekommt eine ganze Gondel als Input <code>#Gondel</code>:<br><b>NW 1:</b> <code>#Ueberlast</code> = 1, wenn <code>#Gondel.Last_kg</code> grösser als <code>#Max_kg</code> ist.<br><b>NW 2:</b> <code>#Bereit</code> = Tür zu <b>und</b> nicht in Revision <b>und</b> keine Überlast.<br><code>Main</code> (🔒) ruft die FC für beide Gondeln mit <code>Max_kg := ' + p.MAX + '</code> auf.',
  blocks: p => [
    { name:'UDT_Gondel', kind:'UDT', src: GONDEL_UDT },
    { name:'DB_Gondeln', kind:'DB', src: GONDEL_DB },
    { name:'FC_Gondel', kind:'FC', edit:true, start: kFC('FC_Gondel', 'Void', GONDEL_D, ''), ref: kFC('FC_Gondel', 'Void', GONDEL_D, GONDEL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gondel 1\n=> "FC_Gondel"(Gondel := "DB_Gondeln".G1, Max_kg := ' + p.MAX + ', Bereit => "G1_Bereit", Ueberlast => "G1_Ueberlast");\n\nNETWORK Gondel 2\n=> "FC_Gondel"(Gondel := "DB_Gondeln".G2, Max_kg := ' + p.MAX + ', Bereit => "G2_Bereit", Ueberlast => "G2_Ueberlast");') }
  ],
  globals: () => ({ G1_Bereit:false, G1_Ueberlast:false, G2_Bereit:false, G2_Ueberlast:false }),
  must:['UDT_REF','MEMBER','CMP'],
  visible: () => ({ tests:[[{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Last_kg':200 }, { G1_Bereit:true, G1_Ueberlast:false }]] }),
  hidden: p => ({ tests:[
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Last_kg':p.MAX }, { G1_Bereit:true, G1_Ueberlast:false }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Last_kg':p.MAX + 1 }, { G1_Bereit:false, G1_Ueberlast:true }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':false, 'DB_Gondeln.G1.Last_kg':100 }, { G1_Bereit:false, G1_Ueberlast:false }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Revision':true, 'DB_Gondeln.G1.Last_kg':0 }, { G1_Bereit:false, G1_Ueberlast:false }],
    [{ 'DB_Gondeln.G2.Tuer_Zu':true, 'DB_Gondeln.G2.Last_kg':300 }, { G2_Bereit:true, G1_Bereit:false }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G2.Tuer_Zu':true, 'DB_Gondeln.G2.Last_kg':p.MAX + 40 }, { G1_Bereit:true, G2_Bereit:false, G2_Ueberlast:true, G1_Ueberlast:false }]
  ] }),
  wrong:[
    () => ({ FC_Gondel: kFC('FC_Gondel', 'Void', GONDEL_D, GONDEL_NW.replace('[#Gondel.Last_kg > #Max_kg]', '[#Gondel.Last_kg >= #Max_kg]').replace('<= #Max_kg', '< #Max_kg')) }),
    () => ({ FC_Gondel: kFC('FC_Gondel', 'Void', GONDEL_D, GONDEL_NW.replace(' AND NOT #Gondel.Revision', '')) })
  ]
});

const STZ_NW = (n, g) => 'NETWORK Zaehler null\n=> MOVE(0, "Anzahl");\n\n' + Array.from({ length:n }, (_, i) => 'NETWORK Stuetze ' + (i + 1) + '\n["DB_Wind".Stuetze[' + (i + 1) + '] > ' + g + '] => INC("Anzahl");\n\n').join('') + 'NETWORK Sturm\n["Anzahl" > 0] => "Sturm";\n\nNETWORK Fahrt stoppen\n["Anzahl" >= 2] => "Fahrt_Stopp";';
const stzSet = (arr) => Object.fromEntries(arr.map((v, i) => ['DB_Wind.Stuetze[' + (i + 1) + ']', v]));
const stzExp = (arr, g) => { const n = arr.filter(v => v > g).length; return { Anzahl:n, Sturm: n > 0, Fahrt_Stopp: n >= 2 }; };
defExamTask({ id:'x_kop_p_stuetzen', quest:'kop', level:'profi', ch:13, diff:3,
  params:{ N:[3, 4], G:[60, 70] },
  title:'Windmesser an den Stützen',
  brief: p => '<code>DB_Wind</code> (🔒) enthält das Array <code>Stuetze : Array[1..' + p.N + '] of Int</code> mit der Windgeschwindigkeit an jeder Stütze. In <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung MOVE 0 nach <code>"Anzahl"</code><br><b>NW 2 …:</b> für jede Stütze 1 … ' + p.N + ': Wind <b>grösser als ' + p.G + '</b> → INC <code>"Anzahl"</code> (je ein Netzwerk)<br><b>danach:</b> <code>"Anzahl"</code> &gt; 0 → <code>"Sturm"</code>; <code>"Anzahl"</code> ≥ 2 → <code>"Fahrt_Stopp"</code>',
  blocks: p => [
    { name:'DB_Wind', kind:'DB', src: kDB('DB_Wind', 'Stuetze:Array[1..' + p.N + '] of Int|Wind km/h je Stütze') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(STZ_NW(p.N, p.G)) }
  ],
  globals: () => ({ Anzahl:0, Sturm:false, Fahrt_Stopp:false }),
  must:['ARRAY','CMP','INC','MOVE'],
  visible: p => ({ tests:[[stzSet(Array(p.N).fill(10)), { Anzahl:0, Sturm:false }], [stzSet([p.G + 5].concat(Array(p.N - 1).fill(0))), { Anzahl:1, Sturm:true, Fahrt_Stopp:false }]] }),
  hidden: p => { const g = p.G, n = p.N, last = Array(n).fill(0); last[n - 1] = g + 1; const two = Array(n).fill(g); two[1] = g + 20; two[n - 1] = g + 1;
    const cases = [Array(n).fill(g), last, two, Array(n).fill(g + 1)];
    return { tests: cases.map(a => [stzSet(a), stzExp(a, g)]),
      timed:[{ steps:[[0.1, stzSet(two), stzExp(two, g)], [0.1, {}, stzExp(two, g)], [0.1, stzSet(Array(n).fill(0)), { Anzahl:0, Sturm:false, Fahrt_Stopp:false }]] }] }; },
  wrong:[
    p => ({ Main: MAIN(STZ_NW(p.N, p.G).replace('NETWORK Zaehler null\n=> MOVE(0, "Anzahl");\n\n', '')) }),
    p => ({ Main: MAIN(STZ_NW(p.N - 1, p.G)) }),
    p => ({ Main: MAIN(STZ_NW(p.N, p.G).split('] > ' + p.G + ']').join('] >= ' + p.G + ']')) })
  ]
});

/* ---------- Kapitel 14: Standardbausteine ---------- */
const BAND_D = { in:'Start:Bool; Stopp:Bool|Taster Stopp (Schliesser); Freigabe:Bool; Drehzahl_RM:Bool|Drehwächter meldet Bewegung; Quit:Bool', out:'Laeuft:Bool; Stoerung:Bool', stat:'T_Lauf:TON|Laufüberwachung' };
const BAND_NW = t => 'NETWORK Antrieb\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe AND NOT #Stoerung => #Laeuft;\n\nNETWORK Laufueberwachung\n#Laeuft AND NOT #Drehzahl_RM AND TON(#T_Lauf, T#' + t + 'S) => S #Stoerung;\n\nNETWORK Quittieren\n#Quit => R #Stoerung;';
defExamTask({ id:'x_kop_p_gepaeckband', quest:'kop', level:'profi', ch:14, diff:3,
  params:{ T:[2, 3] },
  title:'Standardbaustein Gepäckband',
  brief: p => 'Programmiere den Standardbaustein <code>FB_Band</code> (Schnittstelle inkl. <code>T_Lauf : TON</code> ist deklariert):<br>' +
    '<b>Antrieb:</b> <code>#Start</code> startet <code>#Laeuft</code> mit Selbsthaltung; <code>#Stopp</code> (Schliesser), fehlende <code>#Freigabe</code> oder eine anstehende <code>#Stoerung</code> schalten ab.<br>' +
    '<b>Laufüberwachung:</b> Läuft das Band und meldet <code>#Drehzahl_RM</code> <b>' + p.T + ' s</b> lang keine Bewegung, wird <code>#Stoerung</code> gesetzt.<br><b>Quittieren:</b> <code>#Quit</code> setzt <code>#Stoerung</code> zurück.',
  blocks: p => [
    { name:'FB_Band', kind:'FB', edit:true, start: kFB('FB_Band', BAND_D, ''), ref: kFB('FB_Band', BAND_D, BAND_NW(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gepaeckband\n=> "FB_Band_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Drehzahl_RM := "Drehwaechter", Quit := "Quittieren", Laeuft => "Band", Stoerung => "Band_Stoerung");') }
  ],
  globals: () => ({ S_Start:false, S_Stopp:false, Kette_OK:true, Drehwaechter:false, Quittieren:false, Band:false, Band_Stoerung:false }),
  must:['TON','SET','RESET','PARALLEL'],
  visible: () => ({ timed: seq([[0,{ S_Start:true, Drehwaechter:true },{ Band:true }],[0.1,{ S_Start:false },{ Band:true }],[0.1,{ S_Stopp:true },{ Band:false }]]) }),
  hidden: p => ({
    unit:[{ block:'FB_Band', steps:[[0,{ Start:true, Freigabe:true, Drehzahl_RM:true },{ Laeuft:true }],[0.1,{ Start:false },{ Laeuft:true }],[p.T + 1,{},{ Laeuft:true, Stoerung:false }],[0.1,{ Freigabe:false },{ Laeuft:false }],[0.1,{ Freigabe:true },{ Laeuft:false }]] }],
    timed:[
      { steps:[[0,{ S_Start:true },{ Band:true }],[0.1,{ S_Start:false },{ Band_Stoerung:false }],[p.T - 0.6,{},{ Band:true, Band_Stoerung:false }],[1,{},{ Band_Stoerung:true }],[0.1,{},{ Band:false, Band_Stoerung:true }],[0.1,{ S_Start:true },{ Band:false }],[0.1,{ S_Start:false, Quittieren:true },{ Band_Stoerung:false, Band:false }],[0.1,{ Quittieren:false, S_Start:true, Drehwaechter:true },{ Band:true }]] },
      { steps:[[0,{ S_Start:true, Drehwaechter:true },{ Band:true }],[0.1,{ S_Start:false },{ Band:true }],[p.T + 2,{},{ Band:true, Band_Stoerung:false }],[0.1,{ Drehwaechter:false },{ Band_Stoerung:false }],[p.T - 0.6,{},{ Band_Stoerung:false }],[1,{},{ Band_Stoerung:true }],[0.1,{},{ Band:false }]] },
      { steps:[[0,{ S_Start:true, Drehwaechter:true, Kette_OK:false },{ Band:false }],[0.1,{ Kette_OK:true },{ Band:true }],[0.1,{ S_Start:false, S_Stopp:true },{ Band:false }],[0.1,{ S_Stopp:false },{ Band:false }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Band: kFB('FB_Band', BAND_D, BAND_NW(p.T).replace(' AND NOT #Stoerung => #Laeuft', ' => #Laeuft')) }),
    p => ({ FB_Band: kFB('FB_Band', BAND_D, BAND_NW(p.T).replace('#Laeuft AND NOT #Drehzahl_RM AND TON', '#Laeuft AND TON')) }),
    p => ({ FB_Band: kFB('FB_Band', BAND_D, BAND_NW(p.T + 1)) })
  ]
});

const LAMP_D = { in:'Stoerung:Bool|Störung steht an; Quittiert:Bool|Störung quittiert; Takt:Bool|Blinktakt 1 Hz', out:'Lampe:Bool|Meldeleuchte; Hupe:Bool' };
const LAMP_NW = 'NETWORK Leuchte\n#Stoerung AND ((#Takt AND NOT #Quittiert) OR #Quittiert) => #Lampe;\n\nNETWORK Hupe\n#Stoerung AND NOT #Quittiert => #Hupe;';
defExamTask({ id:'x_kop_p_meldeleuchte', quest:'kop', level:'profi', ch:14, diff:2,
  title:'Standard-Meldeleuchte',
  brief: () => 'Programmiere die Funktion <code>FC_Meldung</code> nach dem Werkstandard für Störmeldungen:<br>' +
    '• Störung steht an und ist <b>noch nicht quittiert</b>: <code>#Lampe</code> blinkt im <code>#Takt</code>, <code>#Hupe</code> ist 1.<br>• Störung steht an und <b>ist quittiert</b>: <code>#Lampe</code> leuchtet dauernd, <code>#Hupe</code> ist 0.<br>• Keine Störung: beide 0.<br><code>Main</code> (🔒) ruft die FC für die Seilstörung auf.',
  blocks: () => [
    { name:'FC_Meldung', kind:'FC', edit:true, start: kFC('FC_Meldung', 'Void', LAMP_D, ''), ref: kFC('FC_Meldung', 'Void', LAMP_D, LAMP_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Seilstoerung\n=> "FC_Meldung"(Stoerung := "Seil_Stoerung", Quittiert := "Seil_Quittiert", Takt := "Takt_1Hz", Lampe => "Lampe_Seil", Hupe => "Hupe");') }
  ],
  globals: () => ({ Seil_Stoerung:false, Seil_Quittiert:false, Takt_1Hz:false, Lampe_Seil:false, Hupe:false }),
  must:['PARALLEL','NC'],
  visible: () => ({ tests:[[{ Seil_Stoerung:true, Takt_1Hz:true }, { Lampe_Seil:true, Hupe:true }], [{ Seil_Stoerung:true, Takt_1Hz:false }, { Lampe_Seil:false, Hupe:true }]] }),
  hidden: () => ({
    unit:[{ block:'FC_Meldung', steps: truth(['Stoerung','Quittiert','Takt'], e => ({ Lampe: e.Stoerung && (e.Quittiert || e.Takt), Hupe: e.Stoerung && !e.Quittiert })) }],
    tests:[[{ Seil_Stoerung:true, Seil_Quittiert:true, Takt_1Hz:false }, { Lampe_Seil:true, Hupe:false }], [{ Seil_Stoerung:false, Takt_1Hz:true }, { Lampe_Seil:false, Hupe:false }]]
  }),
  wrong:[
    () => ({ FC_Meldung: kFC('FC_Meldung', 'Void', LAMP_D, 'NETWORK Leuchte\n#Stoerung => #Lampe;\n\nNETWORK Hupe\n#Stoerung AND NOT #Quittiert => #Hupe;') }),
    () => ({ FC_Meldung: kFC('FC_Meldung', 'Void', LAMP_D, 'NETWORK Leuchte\n#Stoerung AND ((#Takt AND #Quittiert) OR NOT #Quittiert) => #Lampe;\n\nNETWORK Hupe\n#Stoerung AND NOT #Quittiert => #Hupe;') }),
    () => ({ FC_Meldung: kFC('FC_Meldung', 'Void', LAMP_D, 'NETWORK Leuchte\n#Stoerung AND ((#Takt AND NOT #Quittiert) OR #Quittiert) => #Lampe;\n\nNETWORK Hupe\n#Stoerung => #Hupe;') })
  ]
});

/* ---------- Kapitel 15: OB1/OB100, Programmierstandard ---------- */
const STUP = body => kOB('Startup', body);
const PAR_DB = kDB('DB_Param', 'Wind_Grenze:Int|km/h; Betriebsart:Int|1 Sommer, 2 Winter; Fahrten_heute:Int := 123|Stand vor dem Ausschalten');
const STUP_NW = (g, b) => 'NETWORK Windgrenze\n=> MOVE(' + g + ', "DB_Param".Wind_Grenze);\n\nNETWORK Betriebsart\n=> MOVE(' + b + ', "DB_Param".Betriebsart);\n\nNETWORK Fahrten\n=> MOVE(0, "DB_Param".Fahrten_heute);\n\nNETWORK Antrieb aus\n=> R "Antrieb";';
defExamTask({ id:'x_kop_p_anlauf', quest:'kop', level:'profi', ch:15, diff:1,
  params:{ G:[50, 60, 70], B:[1, 2] },
  title:'Grundstellung im Anlauf',
  brief: p => 'Programmiere den Anlauf-OB <code>Startup</code> [OB100], alle Netzwerke <b>ohne Bedingung</b>:<br><b>NW 1:</b> MOVE ' + p.G + ' nach <code>"DB_Param".Wind_Grenze</code><br><b>NW 2:</b> MOVE ' + p.B + ' nach <code>"DB_Param".Betriebsart</code><br><b>NW 3:</b> MOVE 0 nach <code>"DB_Param".Fahrten_heute</code><br><b>NW 4:</b> R <code>"Antrieb"</code><br><code>Main</code> (🔒) verwendet diese Werte in jedem Zyklus.',
  blocks: p => [
    { name:'DB_Param', kind:'DB', src: PAR_DB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: STUP(''), ref: STUP(STUP_NW(p.G, p.B)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Wind\n["Wind_kmh" > "DB_Param".Wind_Grenze] => "Wind_Stopp";\n\nNETWORK Start\n"S_Start" AND NOT "Wind_Stopp" => S "Antrieb";\n\nNETWORK Stopp\n"Wind_Stopp" => R "Antrieb";\n\nNETWORK Anzeige\n=> MOVE("DB_Param".Fahrten_heute, "Anzeige");') }
  ],
  globals: () => ({ Wind_kmh:0, S_Start:false, Wind_Stopp:false, Antrieb:true, Anzeige:0 }),
  must:['STARTUP','MOVE'],
  visible: p => ({ timed: seq([[0.1,{},{ Antrieb:false, 'DB_Param.Betriebsart':p.B }]]) }),
  hidden: p => ({ timed:[
    { steps:[[0.1,{ Wind_kmh:p.G },{ Antrieb:false, Wind_Stopp:false, Anzeige:0, 'DB_Param.Wind_Grenze':p.G, 'DB_Param.Betriebsart':p.B }],[0.1,{ S_Start:true },{ Antrieb:true }],[0.1,{ S_Start:false, Wind_kmh:p.G + 1 },{ Wind_Stopp:true, Antrieb:false }]] },
    { steps:[[0.1,{ Wind_kmh:p.G - 5 },{ Wind_Stopp:false, 'DB_Param.Fahrten_heute':0 }],[0.1,{ 'DB_Param.Wind_Grenze':p.G - 10 },{ Wind_Stopp:true }],[0.1,{ 'DB_Param.Fahrten_heute':7 },{ Anzeige:7 }]] },
    { steps:[[0.1,{},{ Antrieb:false }],[0.1,{ Antrieb:true },{ Antrieb:true }],[0.1,{},{ Antrieb:true, 'DB_Param.Betriebsart':p.B }]] }
  ] }),
  wrong:[
    p => ({ Startup: STUP(STUP_NW(p.G, p.B).replace('NETWORK Fahrten\n=> MOVE(0, "DB_Param".Fahrten_heute);\n\n', '')) }),
    p => ({ Startup: STUP(STUP_NW(p.G, p.B).replace('\n\nNETWORK Antrieb aus\n=> R "Antrieb";', '')) }),
    p => ({ Startup: STUP(STUP_NW(p.G + 10, p.B)) })
  ]
});

const OBW_FC = kFC('FC_Wind', 'Void', { in:'Wind:Int; Grenze:Int', out:'OK:Bool|Wind zulässig' }, 'NETWORK Wind\n[#Wind <= #Grenze] => #OK;');
const OBA_FB = kFB('FB_Antrieb', { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool' }, 'NETWORK Selbsthaltung\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe => #Laeuft;');
const OBL_FC = kFC('FC_Ampel', 'Void', { in:'Laeuft:Bool; Freigabe:Bool', out:'Gruen:Bool; Rot:Bool' }, 'NETWORK Gruen\n#Laeuft => #Gruen;\n\nNETWORK Rot\nNOT #Freigabe => #Rot;');
const OB_CALLS = g => ['NETWORK Wind\n=> "FC_Wind"(Wind := "Wind_kmh", Grenze := ' + g + ', OK => "Wind_OK");',
  'NETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Wind_OK", Laeuft => "Antrieb");',
  'NETWORK Ampel\n=> "FC_Ampel"(Laeuft := "Antrieb", Freigabe := "Wind_OK", Gruen => "Ampel_Gruen", Rot => "Ampel_Rot");'];
defExamTask({ id:'x_kop_p_ob1', quest:'kop', level:'profi', ch:15, diff:2,
  params:{ G:[50, 60, 70] },
  title:'Der OB1 der Talstation',
  brief: p => 'Die Bausteine <code>FC_Wind</code>, <code>FB_Antrieb</code> und <code>FC_Ampel</code> (alle 🔒) sind fertig. Baue <code>Main</code> [OB1] aus drei Aufrufen in der Reihenfolge des Signalflusses, damit jede Änderung <b>im selben Zyklus</b> wirkt:<br>' +
    '<b>NW 1:</b> <code>"FC_Wind"</code>: Wind := <code>"Wind_kmh"</code>, Grenze := ' + p.G + ', OK => <code>"Wind_OK"</code><br>' +
    '<b>NW 2:</b> <code>"FB_Antrieb_DB"</code>: Start := <code>"S_Start"</code>, Stopp := <code>"S_Stopp"</code>, Freigabe := <code>"Wind_OK"</code>, Laeuft => <code>"Antrieb"</code><br>' +
    '<b>NW 3:</b> <code>"FC_Ampel"</code>: Laeuft := <code>"Antrieb"</code>, Freigabe := <code>"Wind_OK"</code>, Gruen => <code>"Ampel_Gruen"</code>, Rot => <code>"Ampel_Rot"</code>',
  blocks: p => [
    { name:'FC_Wind', kind:'FC', src: OBW_FC }, { name:'FB_Antrieb', kind:'FB', src: OBA_FB }, { name:'FC_Ampel', kind:'FC', src: OBL_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(OB_CALLS(p.G).join('\n\n')) }
  ],
  globals: () => ({ Wind_kmh:0, S_Start:false, S_Stopp:false, Wind_OK:false, Antrieb:false, Ampel_Gruen:false, Ampel_Rot:false }),
  must:['CALL','SINGLE','FC_CALL'],
  visible: () => ({ timed: seq([[0,{ Wind_kmh:10, S_Start:true },{ Antrieb:true, Ampel_Gruen:true, Ampel_Rot:false }]]) }),
  hidden: p => ({ timed:[
    { steps:[[0,{ Wind_kmh:p.G },{ Wind_OK:true, Ampel_Rot:false, Antrieb:false }],[0.1,{ S_Start:true },{ Antrieb:true, Ampel_Gruen:true }],[0.1,{ S_Start:false },{ Antrieb:true, Ampel_Gruen:true }],[0.1,{ Wind_kmh:p.G + 1 },{ Wind_OK:false, Antrieb:false, Ampel_Gruen:false, Ampel_Rot:true }],[0.1,{ Wind_kmh:10 },{ Antrieb:false, Ampel_Rot:false }]] },
    { steps:[[0,{ Wind_kmh:p.G + 5, S_Start:true },{ Antrieb:false, Ampel_Rot:true }],[0.1,{ Wind_kmh:p.G - 5 },{ Antrieb:true, Ampel_Gruen:true, Ampel_Rot:false }],[0.1,{ S_Start:false, S_Stopp:true },{ Antrieb:false, Ampel_Gruen:false }]] },
    { steps:[[0,{ Wind_kmh:20 },{ Ampel_Rot:false, Ampel_Gruen:false }],[0.1,{ S_Start:true },{ Ampel_Gruen:true }],[0.1,{ S_Start:false, S_Stopp:true },{ Ampel_Gruen:false }]] }
  ] }),
  wrong:[
    p => { const c = OB_CALLS(p.G); return { Main: MAIN([c[2], c[0], c[1]].join('\n\n')) }; },
    p => { const c = OB_CALLS(p.G); return { Main: MAIN([c[0], c[2], c[1]].join('\n\n')) }; },
    p => ({ Main: MAIN(OB_CALLS(p.G + 10).join('\n\n')) })
  ]
});

/* =====================================================================
   FRAGEN — Grundstufe
   ===================================================================== */
const Q = (id, level, ch, q, options, answer) => defExamQuestion({ id, quest:'kop', level, ch, q, options, answer });

// Kapitel 1
Q('xq_kop_g_reihe', 'grund', 1, 'Drei Schliesser liegen in <b>Reihe</b> vor einer Spule. Wann ist die Spule 1?', ['Wenn alle drei Kontaktvariablen 1 sind', 'Wenn mindestens eine Kontaktvariable 1 ist', 'Wenn genau eine Kontaktvariable 1 ist', 'Wenn alle drei Kontaktvariablen 0 sind'], 0);
Q('xq_kop_g_schliesser_sym', 'grund', 1, 'Welche Aussage beschreibt den <b>Schliesser</b> (Kontakt <code>-| |-</code>) im KOP richtig?', ['Er leitet den Strom weiter, wenn seine Variable 1 ist', 'Er leitet den Strom weiter, wenn seine Variable 0 ist', 'Er schreibt den Wert 1 in seine Variable', 'Er leitet nur im ersten Zyklus'], 0);
Q('xq_kop_g_spule_zyklus', 'grund', 1, 'Eine normale Spule <code>-( )-</code> steht am Ende eines Strompfads. Was macht sie in jedem Zyklus?', ['Sie schreibt das Verknüpfungsergebnis (0 oder 1) in ihre Variable', 'Sie schreibt nur eine 1, eine 0 wird ignoriert', 'Sie speichert den Wert, bis ein Reset kommt', 'Sie invertiert ihre Variable'], 0);
Q('xq_kop_g_zwei_spulen', 'grund', 1, 'Dieselbe Ausgangsvariable wird mit einer normalen Spule in <b>zwei verschiedenen Netzwerken</b> beschrieben. Was gilt am Ende des Zyklus?', ['Es gilt der Wert aus dem später bearbeiteten Netzwerk', 'Es gilt der Wert aus dem ersten Netzwerk', 'Beide Werte werden ODER-verknüpft', 'Die CPU geht in STOP'], 0);

// Kapitel 2
defExamQuestion({ id:'xq_kop_g_oeffner', quest:'kop', level:'grund', ch:2, q:'Ein Not-Halt-Taster ist als Öffner verdrahtet. Welcher Kontakt steht im KOP, damit der Antrieb nur bei <b>nicht</b> gedrücktem Not-Halt läuft?', options:['Schliesser mit der Variable des Not-Halt-Eingangs', 'Öffner mit der Variable des Not-Halt-Eingangs', 'Eine negierte Spule', 'Eine P-Flanke'], answer:0 });
Q('xq_kop_g_parallel', 'grund', 2, 'Zwei Kontakte liegen in einem <b>Parallelzweig</b>. Welcher logischen Verknüpfung entspricht das?', ['ODER', 'UND', 'Exklusiv-ODER', 'NICHT'], 0);
Q('xq_kop_g_oeffner_sym', 'grund', 2, 'Die Variable <code>Tuer_Zu</code> ist 0. Wie verhält sich ein <b>Öffner</b> <code>-|/|-</code> mit dieser Variable?', ['Er leitet den Strom weiter', 'Er sperrt den Strom', 'Er setzt Tuer_Zu auf 1', 'Er leitet nur bei einer Flanke'], 0);
Q('xq_kop_g_drahtbruch', 'grund', 2, 'Warum werden Stopp- und Not-Halt-Taster in der Anlage meist als <b>Öffner</b> verdrahtet?', ['Ein Drahtbruch wirkt dann wie ein Stopp-Befehl (drahtbruchsicher)', 'Öffner sind billiger als Schliesser', 'Die CPU kann Schliesser nicht einlesen', 'Damit man im KOP keinen Öffner-Kontakt braucht'], 0);

// Kapitel 3
Q('xq_kop_g_selbsthaltung', 'grund', 3, 'Wie wird eine <b>Selbsthaltung</b> im KOP gezeichnet?', ['Ein Schliesser mit der Ausgangsvariable liegt parallel zum Starttaster', 'Ein Öffner mit der Ausgangsvariable liegt in Reihe zum Starttaster', 'Die Spule wird zweimal hintereinander gezeichnet', 'Der Starttaster bekommt eine N-Flanke'], 0);
Q('xq_kop_g_ausvorrang', 'grund', 3, 'Rung: <code>(S_Start OR Motor) AND NOT S_Stopp => Motor</code>. Was passiert, wenn Start und Stopp <b>gleichzeitig</b> gedrückt sind?', ['Der Motor ist aus (Aus-Vorrang)', 'Der Motor läuft an (Ein-Vorrang)', 'Der Motor behält seinen bisherigen Zustand', 'Das Netzwerk meldet einen Fehler'], 0);
Q('xq_kop_g_verriegelung', 'grund', 3, 'Zwei Fahrtrichtungen dürfen nie gleichzeitig eingeschaltet sein. Wie verriegelt man sie im KOP?', ['Im Strompfad jeder Richtung liegt ein Öffner der jeweils anderen Richtung', 'Beide Richtungen bekommen denselben Starttaster', 'Man setzt beide Spulen in dasselbe Netzwerk', 'Man verwendet für jede Richtung eine negierte Spule'], 0);
Q('xq_kop_g_selbsthaltung_spannung', 'grund', 3, 'Eine Selbsthaltung mit normaler Spule läuft. Die CPU geht in STOP und wieder in RUN. Was gilt danach (ohne remanente Merker)?', ['Der Ausgang ist aus und muss neu gestartet werden', 'Der Ausgang läuft automatisch weiter', 'Der Ausgang blinkt, bis quittiert wird', 'Der Ausgang ist dauerhaft gesperrt'], 0);

// Kapitel 4
Q('xq_kop_g_set_bleibt', 'grund', 4, 'Eine Variable wurde mit einer <b>S-Spule</b> gesetzt. Die Setzbedingung wird wieder 0. Welchen Wert hat die Variable?', ['Sie bleibt 1, bis eine R-Spule sie zurücksetzt', 'Sie wird sofort wieder 0', 'Sie wird im nächsten Zyklus 0', 'Sie wechselt in jedem Zyklus'], 0);
Q('xq_kop_g_vorrang_reihenfolge', 'grund', 4, 'Setz- und Rücksetzbedingung für dieselbe Variable sind im selben Zyklus erfüllt. Die R-Spule steht im Netzwerk <b>nach</b> der S-Spule. Welcher Wert steht am Zyklusende in der Variable?', ['0 — das zuletzt bearbeitete Netzwerk gewinnt (Rücksetzvorrang)', '1 — Setzen hat immer Vorrang', 'Der Wert vom letzten Zyklus', 'Das hängt von der Zykluszeit ab'], 0);
Q('xq_kop_g_ncoil', 'grund', 4, 'Was schreibt eine <b>negierte Spule</b> <code>-(/)-</code> in ihre Variable?', ['Das invertierte Verknüpfungsergebnis', 'Immer 0', 'Eine 1 nur bei einer fallenden Flanke', 'Das Verknüpfungsergebnis des letzten Zyklus'], 0);
Q('xq_kop_g_set_ohne_reset', 'grund', 4, 'Ein Programm setzt <code>Stoerung</code> mit einer S-Spule, enthält aber <b>keine</b> R-Spule dafür. Was ist die Folge?', ['Die Störung lässt sich im laufenden Betrieb nie mehr löschen', 'Die Störung wird automatisch nach einem Zyklus gelöscht', 'Der Compiler ersetzt die S-Spule durch eine normale Spule', 'Die Störung wird bei jeder fallenden Flanke gelöscht'], 0);

// Kapitel 5
Q('xq_kop_g_pflanke', 'grund', 5, 'Ein Taster wird 3 Sekunden gedrückt gehalten. Wie viele Zyklen lang liefert ein <b>P-Flankenkontakt</b> auf diesen Taster eine 1?', ['Genau einen Zyklus', 'Alle Zyklen während der 3 Sekunden', 'Keinen, erst beim Loslassen', 'Zwei Zyklen: beim Drücken und beim Loslassen'], 0);
Q('xq_kop_g_nflanke', 'grund', 5, 'Wann liefert ein <b>N-Flankenkontakt</b> eine 1?', ['Im Zyklus, in dem seine Variable von 1 auf 0 wechselt', 'Im Zyklus, in dem seine Variable von 0 auf 1 wechselt', 'Solange seine Variable 0 ist', 'Solange seine Variable 1 ist'], 0);
Q('xq_kop_g_inc_ohne_flanke', 'grund', 5, 'Rung: <code>Drehkreuz => INC(Gaeste)</code> ohne Flanke. Eine Person steht 0,5 s im Drehkreuz, die Zykluszeit beträgt 10 ms. Was passiert?', ['Gaeste wird etwa 50-mal erhöht', 'Gaeste wird genau einmal erhöht', 'Gaeste bleibt unverändert', 'Gaeste wird auf 0 gesetzt'], 0);
Q('xq_kop_g_stromstoss', 'grund', 5, 'Was versteht man unter einer <b>Stromstossschaltung</b>?', ['Jeder Tastendruck schaltet einen Ausgang um: ein – aus – ein …', 'Ein Ausgang ist nur so lange 1, wie der Taster gedrückt ist', 'Ein Ausgang bleibt nach dem Loslassen eine feste Zeit an', 'Ein Ausgang wird bei Überstrom abgeschaltet'], 0);

// Kapitel 6
defExamQuestion({ id:'xq_kop_g_tof', quest:'kop', level:'grund', ch:6, q:'Welche Zeit hält den Ausgang nach dem Abschalten des Eingangs noch eine Weile auf 1?', options:['TOF (Ausschaltverzögerung)', 'TON (Einschaltverzögerung)', 'TP (Impuls)', 'CTU (Vorwärtszähler)'], answer:0 });
Q('xq_kop_g_ton_unterbrochen', 'grund', 6, 'Ein TON mit PT = T#5S. Der Eingang ist 3 s lang 1, dann kurz 0, dann wieder 1. Wann wird Q frühestens 1?', ['5 s nach dem erneuten Einschalten', '2 s nach dem erneuten Einschalten', 'Sofort beim erneuten Einschalten', 'Nie, der TON muss erst zurückgesetzt werden'], 0);
Q('xq_kop_g_tp', 'grund', 6, 'Ein <b>TP</b> mit PT = T#2S. Der Eingang ist nur 0,3 s lang 1. Wie lange ist Q = 1?', ['2 s', '0,3 s', '2,3 s', '0 s'], 0);
Q('xq_kop_g_et', 'grund', 6, 'Was zeigt der Ausgang <b>ET</b> eines IEC-Timers an?', ['Die bereits abgelaufene Zeit', 'Die eingestellte Vorgabezeit', 'Die Restzeit bis zum Ablauf', 'Die Anzahl der Starts'], 0);

// Kapitel 7
Q('xq_kop_g_ueberwachung', 'grund', 7, 'Eine Tür soll 4 s nach dem Befehl «schliessen» die Rückmeldung «zu» liefern, sonst ist sie gestört. Welcher Strompfad setzt die Störung richtig?', ['<code>Befehl AND NOT Tuer_Zu AND TON(T, T#4S) => S Stoerung</code>', '<code>Befehl AND Tuer_Zu AND TON(T, T#4S) => S Stoerung</code>', '<code>Befehl AND NOT Tuer_Zu AND TOF(T, T#4S) => S Stoerung</code>', '<code>NOT Befehl AND TP(T, T#4S) => S Stoerung</code>'], 0);
Q('xq_kop_g_stoerung_speichern', 'grund', 7, 'Warum wird eine erkannte Störung meist mit einer <b>S-Spule gespeichert</b> statt mit einer normalen Spule angezeigt?', ['Damit die Meldung bleibt, auch wenn die Ursache kurz wieder verschwindet, bis jemand quittiert', 'Weil normale Spulen keine Lampen ansteuern dürfen', 'Damit der Timer schneller abläuft', 'Weil S-Spulen weniger Speicher brauchen'], 0);
Q('xq_kop_g_blink_selbst', 'grund', 7, 'Rung: <code>NOT Impuls AND TON(T1, T#500MS) => Impuls</code>. Was liefert <code>Impuls</code>?', ['Alle 500 ms für einen Zyklus eine 1', 'Dauernd 1 nach 500 ms', 'Einen 500-ms-Impuls nur beim Start', 'Nie eine 1, weil sich der Timer selbst sperrt'], 0);
Q('xq_kop_g_vorwarnung', 'grund', 7, 'Vor dem Anfahren soll 3 s lang gehupt werden, danach startet der Antrieb. Welche Zeitfunktion bestimmt, <b>wann</b> der Antrieb startet?', ['Ein TON, der mit der Vorwarnung gestartet wird', 'Ein TOF, der mit dem Antrieb gestartet wird', 'Ein CTU mit PV = 3', 'Eine N-Flanke auf die Hupe ohne Zeitglied'], 0);

// Kapitel 8
Q('xq_kop_g_ctu_q', 'grund', 8, 'Wann ist der Ausgang Q eines <b>CTU</b> 1?', ['Wenn der Zählwert CV grösser oder gleich PV ist', 'Wenn CV genau 0 ist', 'Bei jeder Zählflanke für einen Zyklus', 'Wenn der Reset-Eingang R 1 ist'], 0);
Q('xq_kop_g_ctd_ld', 'grund', 8, 'Was bewirkt der Eingang <b>LD</b> eines CTD?', ['Er lädt den Zählwert CV mit dem Vorgabewert PV', 'Er setzt CV auf 0', 'Er zählt um 1 abwärts', 'Er sperrt den Zähler dauerhaft'], 0);
Q('xq_kop_g_ctd_q', 'grund', 8, 'Wann ist der Ausgang Q eines <b>CTD</b> 1?', ['Wenn der Zählwert CV kleiner oder gleich 0 ist', 'Wenn CV grösser oder gleich PV ist', 'Wenn LD gerade 1 ist', 'Bei jeder Zählflanke'], 0);
Q('xq_kop_g_ctu_r', 'grund', 8, 'Ein CTU hat CV = 7. Der Eingang R wird 1 und bleibt 1, während weitere Zählimpulse kommen. Was gilt?', ['CV bleibt 0, solange R = 1 ist', 'CV zählt normal weiter', 'CV wird bei jeder Flanke um 1 kleiner', 'CV bleibt auf 7 stehen'], 0);

// Kapitel 9
Q('xq_kop_g_cmp_kontakt', 'grund', 9, 'Wie verhält sich ein <b>Vergleicher</b> wie <code>[Wind_kmh > 60]</code> im Strompfad?', ['Wie ein Kontakt, der bei erfüllter Bedingung leitet', 'Wie eine Spule, die das Ergebnis schreibt', 'Wie ein Timer mit 60 s', 'Wie ein Zähler bis 60'], 0);
Q('xq_kop_g_move_en', 'grund', 9, 'Eine MOVE-Box hängt an einem Strompfad, der gerade <b>0</b> ist. Was passiert mit dem Ziel?', ['Es behält seinen bisherigen Wert', 'Es wird auf 0 gesetzt', 'Es bekommt den Quellwert trotzdem', 'Es wird ungültig'], 0);
Q('xq_kop_g_div_int', 'grund', 9, 'DIV mit IN1 = 7 und IN2 = 2, alle Operanden vom Typ <b>Int</b>. Welcher Wert steht im Ergebnis?', ['3', '3,5', '4', '1'], 0);
Q('xq_kop_g_add_flanke', 'grund', 9, 'Bei jeder Abfahrt sollen die Gäste der Kabine <b>einmal</b> zur Tagessumme addiert werden. Was gehört vor die ADD-Box?', ['Eine P-Flanke auf das Abfahrsignal', 'Ein Öffner auf das Abfahrsignal', 'Ein TOF mit 1 s', 'Nichts, ADD addiert nur einmal pro Signal'], 0);

// Kapitel 10
Q('xq_kop_g_kette_reihe', 'grund', 10, 'Wie werden die Glieder einer <b>Sicherheitskette</b> (Tür zu, Not-Halt OK, Seil OK …) im KOP verknüpft?', ['Alle in Reihe — jedes offene Glied unterbricht die Kette', 'Alle parallel — ein geschlossenes Glied genügt', 'Jedes Glied mit einer S-Spule', 'Mit einem Zähler, der die Glieder zählt'], 0);
Q('xq_kop_g_schritt_eins', 'grund', 10, 'In einer einfachen Schrittkette mit Schrittmerkern: Wie viele Schritte sind gleichzeitig aktiv?', ['Genau einer', 'Alle bis zum aktuellen Schritt', 'Immer zwei: der alte und der neue', 'Beliebig viele'], 0);
Q('xq_kop_g_schritt_weiter', 'grund', 10, 'Welche Bedingung braucht die <b>Weiterschaltung</b> von Schritt 1 nach Schritt 2?', ['Schritt 1 ist aktiv <b>und</b> die Übergangsbedingung ist erfüllt', 'Nur die Übergangsbedingung', 'Schritt 2 ist aktiv', 'Die Grundstellung ist aktiv'], 0);
Q('xq_kop_g_kette_quit', 'grund', 10, 'Nach einer Unterbrechung ist die Sicherheitskette wieder geschlossen. Warum darf die Anlage trotzdem nicht selbständig wieder anfahren?', ['Ein Wiederanlauf erfordert eine bewusste Quittierung bzw. einen neuen Startbefehl', 'Weil die Kette immer 10 s zum Schliessen braucht', 'Weil die CPU sonst in STOP geht', 'Weil der Antrieb sonst rückwärts läuft'], 0);

/* =====================================================================
   FRAGEN — Profi-Stufe
   ===================================================================== */
// Kapitel 11
Q('xq_kop_p_fc_gedaechtnis', 'profi', 11, 'Warum kann eine <b>FC</b> keine Selbsthaltung über einen eigenen Ausgang speichern?', ['Eine FC hat keinen Instanzspeicher; ihre Ausgänge gelten nur für den aktuellen Aufruf', 'Weil FCs keine Spulen enthalten dürfen', 'Weil FCs nur im OB100 aufgerufen werden', 'Weil FCs keine Bool-Ausgänge haben'], 0);
Q('xq_kop_p_fc_alle_param', 'profi', 11, 'Was gilt beim Aufruf einer FC in der Aufruf-Box für ihre Formalparameter?', ['Alle Parameter müssen beschaltet werden', 'Nur die Eingänge müssen beschaltet werden', 'Kein Parameter muss beschaltet werden', 'Nur der Rückgabewert muss beschaltet werden'], 0);
Q('xq_kop_p_retval', 'profi', 11, 'Wie heisst der Rückgabewert einer FC in der Schnittstelle von TIA Portal?', ['<code>Ret_Val</code>', '<code>ENO</code>', '<code>Return</code>', '<code>OUT0</code>'], 0);
Q('xq_kop_p_hash', 'profi', 11, 'Was bedeutet das Zeichen <b>#</b> vor einem Operanden, z.&nbsp;B. <code>#Wind</code>?', ['Es ist eine lokale Variable aus der Schnittstelle des Bausteins', 'Es ist eine globale PLC-Variable', 'Es ist eine Konstante', 'Es ist ein Zeiger auf einen Datenbaustein'], 0);
Q('xq_kop_p_temp', 'profi', 11, 'Was gilt für eine <b>Temp</b>-Variable in einer FC?', ['Ihr Wert gilt nur während des aktuellen Aufrufs; sie wird zuerst geschrieben und danach gelesen', 'Sie behält ihren Wert bis zum nächsten Aufruf', 'Sie ist für alle Bausteine sichtbar', 'Sie wird im OB100 automatisch auf 0 gesetzt und bleibt dann erhalten'], 0);
Q('xq_kop_p_inout', 'profi', 11, 'Wofür eignet sich ein <b>InOut</b>-Parameter?', ['Für einen Wert, den der Baustein lesen und verändert zurückschreiben soll', 'Für eine Konstante, die nie geändert wird', 'Für eine temporäre Zwischenvariable', 'Für den Aufruf eines Timers'], 0);

// Kapitel 12
defExamQuestion({ id:'xq_kop_p_fb', quest:'kop', level:'profi', ch:12, q:'Warum braucht ein Baustein mit Flanken- oder Zeitauswertung eine Instanz?', options:['Er muss Werte vom letzten Zyklus speichern – das geht nur mit Instanzdaten', 'Weil FCs keine Kontakte enthalten dürfen', 'Damit er schneller läuft', 'Weil der OB1 sonst nicht aufgerufen wird'], answer:0 });
Q('xq_kop_p_zwei_instanzen', 'profi', 12, 'Ein FB soll zwei gleiche Förderbänder steuern. Wie wird er richtig aufgerufen?', ['Zweimal, mit je einem eigenen Instanz-DB', 'Zweimal mit demselben Instanz-DB', 'Einmal, mit beiden Bändern parallel an den Eingängen', 'Einmal im OB1 und einmal im OB100'], 0);
Q('xq_kop_p_multi', 'profi', 12, 'Wo liegen die Daten einer <b>Multiinstanz</b> (z.&nbsp;B. ein TON als Static-Variable in einem FB)?', ['Im Instanz-DB des aufrufenden FB', 'In einem eigenen globalen DB', 'In den Temp-Daten des OB1', 'Im Merkerbereich'], 0);
Q('xq_kop_p_fb_eingang', 'profi', 12, 'Ein Eingang eines FB wird in einem Aufruf <b>nicht</b> beschaltet. Welchen Wert hat er im Baustein?', ['Den zuletzt in der Instanz gespeicherten Wert', 'Immer 0', 'Einen zufälligen Wert', 'Der Compiler verlangt zwingend eine Beschaltung'], 0);
Q('xq_kop_p_static', 'profi', 12, 'Welche Variable eines FB behält ihren Wert von einem Zyklus zum nächsten, ist aber <b>kein</b> Parameter der Aufruf-Box?', ['Eine Static-Variable', 'Eine Temp-Variable', 'Ein Input', 'Ein Output'], 0);
Q('xq_kop_p_instanz_twice', 'profi', 12, 'Dieselbe Instanz eines FB mit Timer wird in einem Zyklus <b>zweimal</b> mit unterschiedlichen Eingängen aufgerufen. Was ist die typische Folge?', ['Der zweite Aufruf überschreibt den Zustand des ersten, Timer und Flanken arbeiten falsch', 'Beide Aufrufe arbeiten unabhängig voneinander', 'Die CPU legt automatisch eine zweite Instanz an', 'Der zweite Aufruf wird ignoriert'], 0);

// Kapitel 13
Q('xq_kop_p_db_global', 'profi', 13, 'Wie spricht man die Variable <code>Wind_Max</code> im globalen Datenbaustein <code>DB_Station</code> im KOP an?', ['<code>"DB_Station".Wind_Max</code>', '<code>#DB_Station.Wind_Max</code>', '<code>DB_Station:Wind_Max</code>', '<code>"Wind_Max".DB_Station</code>'], 0);
Q('xq_kop_p_udt', 'profi', 13, 'Was ist ein <b>PLC-Datentyp</b> (UDT)?', ['Eine Vorlage für eine Struktur, die man mehrfach als Datentyp verwenden kann', 'Ein Baustein mit eigenem Programmcode', 'Ein Zeitglied für die Ablaufsteuerung', 'Ein spezieller Organisationsbaustein'], 0);
Q('xq_kop_p_udt_aendern', 'profi', 13, 'Im UDT <code>UDT_Kabine</code> wird ein neues Element ergänzt. Was passiert mit allen Variablen dieses Typs?', ['Sie erhalten das neue Element ebenfalls, nach dem Aktualisieren bzw. Übersetzen', 'Sie bleiben unverändert, nur neue Variablen bekommen es', 'Sie werden gelöscht', 'Sie müssen alle von Hand neu angelegt werden'], 0);
Q('xq_kop_p_array', 'profi', 13, 'Eine Variable ist als <code>Array[1..4] of Bool</code> deklariert. Welcher Zugriff ist <b>unzulässig</b>?', ['<code>Platz[0]</code>', '<code>Platz[1]</code>', '<code>Platz[3]</code>', '<code>Platz[4]</code>'], 0);
Q('xq_kop_p_db_vs_temp', 'profi', 13, 'Ein Zählwert soll über viele Zyklen erhalten bleiben und von mehreren Bausteinen gelesen werden. Wo wird er abgelegt?', ['In einem globalen Datenbaustein', 'In einer Temp-Variable einer FC', 'Als Konstante in der Schnittstelle', 'Im Rückgabewert einer FC'], 0);
Q('xq_kop_p_struct_param', 'profi', 13, 'Welcher Vorteil ergibt sich, wenn man einem Baustein einen Parameter vom Typ <code>"UDT_Kabine"</code> übergibt statt vieler Einzelparameter?', ['Die Schnittstelle bleibt klein und alle Kabinendaten kommen zusammen an', 'Der Baustein braucht dann keine Instanz mehr', 'Die Werte werden automatisch remanent', 'Man kann dann auf Vergleicher verzichten'], 0);

// Kapitel 14
Q('xq_kop_p_standard', 'profi', 14, 'Was zeichnet einen guten <b>Standardbaustein</b> (z.&nbsp;B. für eine Tür) aus?', ['Er arbeitet nur über seine Schnittstelle und greift nicht direkt auf globale Variablen zu', 'Er liest alle Signale direkt aus globalen Variablen', 'Er enthält die Logik für alle Türen der Anlage fest verdrahtet', 'Er wird nur einmal im ganzen Projekt aufgerufen'], 0);
Q('xq_kop_p_rueckmeldung', 'profi', 14, 'Wozu dient die <b>Rückmeldung</b> (z.&nbsp;B. Drehwächter, Endlage) in einem Antriebsbaustein?', ['Um zu prüfen, ob der Befehl tatsächlich ausgeführt wurde, und sonst eine Störung zu melden', 'Um den Befehl schneller auszugeben', 'Um den Instanz-DB zu sparen', 'Um den Baustein im OB100 zu starten'], 0);
Q('xq_kop_p_quit', 'profi', 14, 'Eine Störung ist gespeichert, ihre Ursache steht aber <b>noch an</b>. Wie sollte ein Standardbaustein auf «Quittieren» reagieren?', ['Die Störung bleibt bestehen bzw. wird sofort wieder gesetzt', 'Die Störung wird gelöscht und der Antrieb startet sofort', 'Der Baustein geht in STOP', 'Die Störung wird in eine Warnung umgewandelt'], 0);
Q('xq_kop_p_blink_meldung', 'profi', 14, 'Nach gängigem Meldekonzept: Was zeigt eine <b>blinkende</b> Störlampe an?', ['Eine neue, noch nicht quittierte Störung', 'Eine quittierte, noch anstehende Störung', 'Die Anlage läuft normal', 'Eine Störung, die bereits verschwunden ist'], 0);
Q('xq_kop_p_global_access', 'profi', 14, 'Ein FB liest intern direkt die globale Variable <code>"Tuer_Zu"</code>. Welches Problem entsteht?', ['Er ist nicht mehr für andere Türen wiederverwendbar', 'Er läuft langsamer', 'Er braucht dann zwei Instanz-DBs', 'Er darf dann keine Timer enthalten'], 0);
Q('xq_kop_p_freigabe', 'profi', 14, 'Wie gelangt die Freigabe der Sicherheitskette sinnvoll in einen Standard-Antriebsbaustein?', ['Über einen Eingang wie <code>Freigabe</code>, der beim Aufruf beschaltet wird', 'Der Antriebsbaustein liest alle Kettenglieder selbst global ein', 'Über eine Temp-Variable im OB1', 'Gar nicht, die Kette schaltet den Ausgang direkt'], 0);

// Kapitel 15
Q('xq_kop_p_ob100', 'profi', 15, 'Wann wird der <b>OB100</b> (Startup) bearbeitet?', ['Einmal beim Übergang von STOP nach RUN, vor dem ersten OB1-Zyklus', 'In jedem Zyklus vor dem OB1', 'Nur bei einem Fehler', 'Alle 100 ms'], 0);
Q('xq_kop_p_ob1', 'profi', 15, 'Was ist der <b>OB1</b> (Main)?', ['Der Organisationsbaustein, der zyklisch immer wieder bearbeitet wird', 'Der Baustein, der nur beim Anlauf läuft', 'Ein Datenbaustein für globale Variablen', 'Ein Weckalarm-OB mit fester Zeit'], 0);
Q('xq_kop_p_reihenfolge', 'profi', 15, 'Der OB1 ruft die Anzeige <b>vor</b> dem Antriebsbaustein auf, der den Wert «Antrieb» berechnet. Was sieht die Anzeige?', ['Den Wert aus dem vorherigen Zyklus – sie ist einen Zyklus zu spät', 'Immer den aktuellen Wert', 'Immer 0', 'Einen Übersetzungsfehler'], 0);
Q('xq_kop_p_unused', 'profi', 15, 'Was bedeutet eine Warnung wie «Variable deklariert, aber nicht verwendet»?', ['Eine Variable in der Schnittstelle wird nirgends benutzt und kann entfernt oder muss angeschlossen werden', 'Die CPU hat zu wenig Speicher', 'Die Variable ist remanent', 'Die Variable wird doppelt geschrieben'], 0);
Q('xq_kop_p_kommentar', 'profi', 15, 'Was verlangt ein typischer <b>Programmierstandard</b> für Netzwerke im KOP?', ['Einen aussagekräftigen Netzwerktitel bzw. Kommentar für jedes Netzwerk', 'Möglichst alle Logik in einem einzigen Netzwerk', 'Keine Kommentare, damit der Code kürzer ist', 'Nur Variablennamen mit einem Buchstaben'], 0);
Q('xq_kop_p_erster_zyklus', 'profi', 15, 'Wo stellt man nach Programmierstandard die <b>Grundstellung</b> nach dem Einschalten her?', ['Im Anlauf-OB (OB100)', 'Mit einem Merker «erster Zyklus» in jedem FB', 'In einer Temp-Variable des OB1', 'Im letzten Netzwerk des OB1'], 0);
})();

/* ==== content_fup/exam.js ==== */
/* ===== FUP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Stellwerk Brünigkreuz), nicht aus dem Spiel. Gleiches Netzwerkmodell wie KOP (kop.js).
   Grundstufe: 18 Aufgaben, 40 Fragen (Kapitel 1–10) · Profi-Stufe: 12 Aufgaben, 30 Fragen (Kapitel 11–15) */
(function(){
const seq = steps => [{ steps }];
const START_G = t => () => 'NETWORK ' + t + '\n? => ?;\n';
const MAIN = body => kOB('Main', body);
const STARTUP = body => kOB('Startup', body);

/* =====================================================================
   GRUNDSTUFE
   ===================================================================== */

/* ---------- Kapitel 1: UND-Box, Zuweisung ---------- */
defExamTask({ id:'x_fup_g_ausfahrt', quest:'fup', level:'grund', ch:1, diff:1,
  params:{ G:[3, 4, 5] },
  title:'Ausfahrsignal C',
  brief: p => 'Das Ausfahrsignal <code>Signal_C</code> zeigt Fahrt, wenn die Taste <code>Taste_C</code> gedrückt ist, das Gleis <code>Gleis' + p.G + '_frei</code> meldet <b>und</b> die Weiche <code>W' + p.G + '_Endlage</code> in der Endlage liegt. Der Melder <code>Melder_C</code> am Stelltisch zeigt dasselbe Ergebnis.<br>Verwende <b>eine</b> &amp;-Box mit zwei Zuweisungen.',
  vars: p => ({ Taste_C:false, ['Gleis' + p.G + '_frei']:false, ['W' + p.G + '_Endlage']:false, Signal_C:false, Melder_C:false }),
  start: START_G('Signal C'),
  ref: p => 'NETWORK Signal C\nTaste_C AND Gleis' + p.G + '_frei AND W' + p.G + '_Endlage => Signal_C, Melder_C;',
  must:['SERIES','MULTI_OUT'],
  visible: p => [[{ Taste_C:true, ['Gleis' + p.G + '_frei']:true, ['W' + p.G + '_Endlage']:true }, { Signal_C:true, Melder_C:true }]],
  hidden: p => { const g = 'Gleis' + p.G + '_frei', w = 'W' + p.G + '_Endlage';
    return truth(['Taste_C', g, w], e => { const q = e.Taste_C && e[g] && e[w]; return { Signal_C:q, Melder_C:q }; }); },
  wrong:[
    p => 'NETWORK Signal C\nTaste_C OR Gleis' + p.G + '_frei OR W' + p.G + '_Endlage => Signal_C, Melder_C;',
    p => 'NETWORK Signal C\nTaste_C AND Gleis' + p.G + '_frei => Signal_C, Melder_C;',
    p => 'NETWORK Signal C\nTaste_C AND Gleis' + p.G + '_frei AND W' + p.G + '_Endlage => Signal_C;'
  ]
});

/* ---------- Kapitel 2: ODER, XOR, negierter Eingang ---------- */
defExamTask({ id:'x_fup_g_gleissperre', quest:'fup', level:'grund', ch:2, diff:2,
  params:{ H:['Wartung', 'Handbetrieb'] },
  title:'Lage der Gleissperre',
  brief: p => 'Die Gleissperre meldet zwei Endlagen: <code>Sperre_ab</code> und <code>Sperre_auf</code>. <code>Sperre_OK</code> ist 1, wenn <b>genau eine</b> Endlage gemeldet wird und <b>kein</b> <code>' + p.H + '</code> ansteht. Der Störmelder <code>Melder_Stoerung</code> zeigt das Gegenteil von <code>Sperre_OK</code>.<br>Verwende eine X-Box, einen negierten Eingang und eine negierte Zuweisung.',
  vars: p => ({ Sperre_ab:false, Sperre_auf:false, [p.H]:false, Sperre_OK:false, Melder_Stoerung:false }),
  start: START_G('Gleissperre'),
  ref: p => 'NETWORK Gleissperre\n(Sperre_ab XOR Sperre_auf) AND NOT ' + p.H + ' => Sperre_OK, NOT Melder_Stoerung;',
  must:['XOR','NC','NCOIL'],
  visible: () => [[{ Sperre_ab:true }, { Sperre_OK:true, Melder_Stoerung:false }], [{}, { Sperre_OK:false, Melder_Stoerung:true }]],
  hidden: p => truth(['Sperre_ab', 'Sperre_auf', p.H], e => { const ok = e.Sperre_ab !== e.Sperre_auf && !e[p.H]; return { Sperre_OK:ok, Melder_Stoerung:!ok }; }),
  wrong:[
    p => 'NETWORK Gleissperre\n(Sperre_ab OR Sperre_auf) AND NOT ' + p.H + ' => Sperre_OK, NOT Melder_Stoerung;',
    p => 'NETWORK Gleissperre\nSperre_ab XOR Sperre_auf AND NOT ' + p.H + ' => Sperre_OK, NOT Melder_Stoerung;',
    () => 'NETWORK Gleissperre\nSperre_ab XOR Sperre_auf => Sperre_OK, NOT Melder_Stoerung;',
    p => 'NETWORK Gleissperre\n(Sperre_ab XOR Sperre_auf) AND NOT ' + p.H + ' => Sperre_OK, Melder_Stoerung;'
  ]
});

/* ---------- Kapitel 3: Selbsthaltung, Aus-Vorrang, Verriegelung ---------- */
defExamTask({ id:'x_fup_g_rangier', quest:'fup', level:'grund', ch:3, diff:1, timed:true,
  title:'Rangierfahrt mit Aus-Vorrang',
  brief: () => '<code>Taste_Rangier</code> schaltet <code>Rangierfahrt</code> ein; die Rangierfahrt bleibt nach dem Loslassen eingeschaltet (Selbsthaltung). <code>Taste_Stop</code> oder ein besetztes Grenzzeichen <code>Grenzzeichen_besetzt</code> schalten sie aus. Die Ausschaltbedingungen haben <b>Vorrang</b> vor der Einschalttaste.',
  vars: () => ({ Taste_Rangier:false, Taste_Stop:false, Grenzzeichen_besetzt:false, Rangierfahrt:false }),
  start: START_G('Rangierfahrt'),
  ref: () => 'NETWORK Rangierfahrt\n(Taste_Rangier OR Rangierfahrt) AND NOT Taste_Stop AND NOT Grenzzeichen_besetzt => Rangierfahrt;',
  must:['PARALLEL','NC'],
  visible: () => seq([[0.1,{ Taste_Rangier:true },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false },{ Rangierfahrt:true }]]),
  hidden: () => [
    { steps:[[0.1,{ Taste_Rangier:true },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false },{ Rangierfahrt:true }],[0.1,{},{ Rangierfahrt:true }],[0.1,{ Taste_Stop:true },{ Rangierfahrt:false }],[0.1,{ Taste_Stop:false },{ Rangierfahrt:false }]] },
    { steps:[[0.1,{ Taste_Rangier:true, Taste_Stop:true },{ Rangierfahrt:false }],[0.1,{ Taste_Stop:false },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false, Grenzzeichen_besetzt:true },{ Rangierfahrt:false }],[0.1,{ Grenzzeichen_besetzt:false },{ Rangierfahrt:false }]] },
    { steps:[[0.1,{ Grenzzeichen_besetzt:true, Taste_Rangier:true },{ Rangierfahrt:false }],[0.1,{ Grenzzeichen_besetzt:false },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false },{ Rangierfahrt:true }]] }
  ],
  wrong:[
    () => 'NETWORK Rangierfahrt\nTaste_Rangier AND NOT Taste_Stop AND NOT Grenzzeichen_besetzt => Rangierfahrt;',
    () => 'NETWORK Rangierfahrt\nTaste_Rangier OR (Rangierfahrt AND NOT Taste_Stop AND NOT Grenzzeichen_besetzt) => Rangierfahrt;',
    () => 'NETWORK Rangierfahrt\n(Taste_Rangier OR Rangierfahrt) AND NOT Taste_Stop => Rangierfahrt;'
  ]
});

const SB_REF = 'NETWORK Fahrt West\n(Taste_West OR Fahrt_West) AND NOT Taste_Halt AND NOT Endlage_West AND NOT Fahrt_Ost => Fahrt_West;\n\n' +
  'NETWORK Fahrt Ost\n(Taste_Ost OR Fahrt_Ost) AND NOT Taste_Halt AND NOT Endlage_Ost AND NOT Fahrt_West => Fahrt_Ost;\n\n' +
  'NETWORK Antrieb\nFahrt_West OR Fahrt_Ost => Antrieb_Ein;';
defExamTask({ id:'x_fup_g_schiebebuehne', quest:'fup', level:'grund', ch:3, diff:3, timed:true,
  title:'Schiebebühne im Depot',
  brief: () => 'Die Schiebebühne fährt nach Westen oder Osten.<br><b>NW 1:</b> <code>Taste_West</code> startet <code>Fahrt_West</code> mit Selbsthaltung. Sie endet bei <code>Taste_Halt</code> oder in der <code>Endlage_West</code> und ist gegen <code>Fahrt_Ost</code> verriegelt.<br><b>NW 2:</b> dasselbe für <code>Fahrt_Ost</code> (<code>Taste_Ost</code>, <code>Endlage_Ost</code>), verriegelt gegen <code>Fahrt_West</code>.<br><b>NW 3:</b> <code>Antrieb_Ein</code> ist 1, solange eine der beiden Fahrten läuft.',
  vars: () => ({ Taste_West:false, Taste_Ost:false, Taste_Halt:false, Endlage_West:false, Endlage_Ost:false, Fahrt_West:false, Fahrt_Ost:false, Antrieb_Ein:false }),
  start: START_G('Fahrt West'),
  ref: () => SB_REF,
  must:['PARALLEL','NC','NETWORKS'],
  visible: () => seq([[0.1,{ Taste_Ost:true },{ Fahrt_Ost:true, Antrieb_Ein:true }],[0.1,{ Taste_Ost:false },{ Fahrt_Ost:true }]]),
  hidden: () => [
    { steps:[[0.1,{ Taste_West:true },{ Fahrt_West:true, Fahrt_Ost:false, Antrieb_Ein:true }],[0.1,{ Taste_West:false },{ Fahrt_West:true }],[0.1,{ Taste_Ost:true },{ Fahrt_West:true, Fahrt_Ost:false }],[0.1,{ Taste_Ost:false, Endlage_West:true },{ Fahrt_West:false, Antrieb_Ein:false }],
      [0.1,{ Taste_Ost:true },{ Fahrt_Ost:true, Antrieb_Ein:true }],[0.1,{ Taste_Ost:false, Endlage_West:false },{ Fahrt_Ost:true }],[0.1,{ Endlage_Ost:true },{ Fahrt_Ost:false, Antrieb_Ein:false }]] },
    { steps:[[0.1,{ Taste_West:true, Taste_Ost:true },{ Fahrt_West:true, Fahrt_Ost:false }],[0.1,{ Taste_West:false, Taste_Ost:false },{ Fahrt_West:true }],[0.1,{ Taste_Halt:true },{ Fahrt_West:false, Antrieb_Ein:false }],[0.1,{ Taste_Halt:false },{ Fahrt_West:false }]] },
    { steps:[[0.1,{ Taste_Ost:true, Taste_Halt:true },{ Fahrt_Ost:false, Antrieb_Ein:false }],[0.1,{ Taste_Halt:false },{ Fahrt_Ost:true }],[0.1,{ Taste_Ost:false, Taste_Halt:true },{ Fahrt_Ost:false }],[0.1,{ Taste_Halt:false, Endlage_Ost:true, Taste_Ost:true },{ Fahrt_Ost:false, Antrieb_Ein:false }]] }
  ],
  wrong:[
    () => SB_REF.replace(' AND NOT Fahrt_Ost =>', ' =>').replace(' AND NOT Fahrt_West =>', ' =>'),
    () => SB_REF.replace('(Taste_Ost OR Fahrt_Ost) AND NOT Taste_Halt AND', '(Taste_Ost OR Fahrt_Ost) AND'),
    () => SB_REF.replace('Fahrt_West OR Fahrt_Ost => Antrieb_Ein', 'Fahrt_West AND Fahrt_Ost => Antrieb_Ein')
  ]
});

/* ---------- Kapitel 4: Speicherboxen ---------- */
defExamTask({ id:'x_fup_g_schranke', quest:'fup', level:'grund', ch:4, diff:1, timed:true,
  title:'Schranke mit Speicherbox',
  brief: () => 'Die Anforderung <code>Zug_Meldung</code> <b>setzt</b> <code>Schranke_Zu</code>, der Taster <code>Freimeldung</code> <b>setzt zurück</b>. Kommen beide gleichzeitig, bleibt die Schranke <b>zu</b> (Setzen dominant). Verwende eine RS-Box.',
  vars: () => ({ Zug_Meldung:false, Freimeldung:false, Schranke_Zu:false }),
  start: START_G('Schranke'),
  ref: () => 'NETWORK Schranke\nZug_Meldung => RS(Schranke_Zu, Freimeldung);',
  must:['RS'],
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

defExamTask({ id:'x_fup_g_fs_speicher', quest:'fup', level:'grund', ch:4, diff:2, timed:true,
  params:{ R:['Zugschluss', 'Taste_Aufloesen'] },
  title:'Fahrstrasse Gleis 2 speichern',
  brief: p => '<b>NW 1:</b> <code>Taste_FS</code> und <code>Gleis2_frei</code> <b>setzen</b> <code>FS_Gleis2</code>, <code>' + p.R + '</code> setzt zurück. Kommen Setzen und Rücksetzen gleichzeitig, gewinnt das <b>Rücksetzen</b>.<br><b>NW 2:</b> <code>Melder_FS</code> zeigt <code>FS_Gleis2</code>, <code>Melder_Frei</code> zeigt das Gegenteil (negierte Zuweisung).',
  vars: p => ({ Taste_FS:false, Gleis2_frei:false, [p.R]:false, FS_Gleis2:false, Melder_FS:false, Melder_Frei:false }),
  start: START_G('Fahrstrasse'),
  ref: p => 'NETWORK Fahrstrasse\nTaste_FS AND Gleis2_frei => SR(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, NOT Melder_Frei;',
  must:['SR','NCOIL'],
  visible: () => seq([[0.1,{ Taste_FS:true, Gleis2_frei:true },{ FS_Gleis2:true, Melder_FS:true, Melder_Frei:false }],[0.1,{ Taste_FS:false },{ FS_Gleis2:true }]]),
  hidden: p => [
    { steps:[[0.1,{},{ FS_Gleis2:false, Melder_Frei:true }],[0.1,{ Taste_FS:true, Gleis2_frei:true },{ FS_Gleis2:true, Melder_FS:true, Melder_Frei:false }],[0.1,{ Taste_FS:false },{ FS_Gleis2:true }],[0.1,{ Gleis2_frei:false },{ FS_Gleis2:true }],[0.1,{ [p.R]:true },{ FS_Gleis2:false, Melder_FS:false, Melder_Frei:true }]] },
    { steps:[[0.1,{ Taste_FS:true },{ FS_Gleis2:false }],[0.1,{ Gleis2_frei:true, [p.R]:true },{ FS_Gleis2:false }],[0.1,{ [p.R]:false },{ FS_Gleis2:true }]] },
    { steps:[[0.1,{ Taste_FS:true, Gleis2_frei:true },{ FS_Gleis2:true }],[0.1,{ Taste_FS:false, [p.R]:true },{ FS_Gleis2:false }],[0.1,{ [p.R]:false },{ FS_Gleis2:false, Melder_Frei:true }]] }
  ],
  wrong:[
    p => 'NETWORK Fahrstrasse\nTaste_FS AND Gleis2_frei => RS(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, NOT Melder_Frei;',
    p => 'NETWORK Fahrstrasse\nTaste_FS => SR(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, NOT Melder_Frei;',
    p => 'NETWORK Fahrstrasse\nTaste_FS AND Gleis2_frei => SR(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, Melder_Frei;'
  ]
});

/* ---------- Kapitel 5: Flanken, Stromstoss ---------- */
defExamTask({ id:'x_fup_g_abfahrten', quest:'fup', level:'grund', ch:5, diff:1, timed:true,
  params:{ A:[0, 7, 15] },
  title:'Abfahrten zählen',
  brief: p => 'Jede <b>Abfahrt</b> eines Zuges erhöht <code>Abfahrten</code> um 1. Eine Abfahrt ist der Moment, in dem <code>Zug_am_Bahnsteig</code> von 1 auf 0 wechselt (negative Flanke). <code>Tagesreset</code> schreibt 0 in <code>Abfahrten</code>. Der Zähler steht zu Beginn auf ' + p.A + '.',
  vars: p => ({ Zug_am_Bahnsteig:false, Tagesreset:false, Abfahrten:p.A }),
  start: START_G('Abfahrt zaehlen'),
  ref: () => 'NETWORK Abfahrt zaehlen\nN(Zug_am_Bahnsteig) => INC(Abfahrten);\n\nNETWORK Tagesreset\nTagesreset => MOVE(0, Abfahrten);',
  must:['EDGE_N','INC','MOVE'],
  visible: p => seq([[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 1 }]]),
  hidden: p => [
    { steps:[[0.1,{},{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A }],[0.1,{},{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 1 }],[0.1,{},{ Abfahrten:p.A + 1 }],[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A + 1 }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 2 }]] },
    { steps:[[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 1 }],[0.1,{ Tagesreset:true },{ Abfahrten:0 }],[0.1,{ Tagesreset:false },{ Abfahrten:0 }]] },
    { steps:[[0.1,{ Zug_am_Bahnsteig:true, Tagesreset:true },{ Abfahrten:0 }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:0 }],[0.1,{ Tagesreset:false },{ Abfahrten:0 }],[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:0 }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:1 }]] }
  ],
  wrong:[
    () => 'NETWORK Abfahrt zaehlen\nP(Zug_am_Bahnsteig) => INC(Abfahrten);\n\nNETWORK Tagesreset\nTagesreset => MOVE(0, Abfahrten);',
    () => 'NETWORK Abfahrt zaehlen\nNOT Zug_am_Bahnsteig => INC(Abfahrten);\n\nNETWORK Tagesreset\nTagesreset => MOVE(0, Abfahrten);',
    () => 'NETWORK Abfahrt zaehlen\nN(Zug_am_Bahnsteig) => INC(Abfahrten);'
  ]
});

defExamTask({ id:'x_fup_g_stromstoss', quest:'fup', level:'grund', ch:5, diff:2, timed:true,
  params:{ R:['Betriebsschluss', 'Nachtruhe'] },
  title:'Bahnsteiglicht per Stromstoss',
  brief: p => 'Jeder <b>Druck</b> auf <code>Taste_Licht</code> schaltet <code>Bahnsteiglicht</code> um (ein → aus → ein …), auch wenn die Taste länger gehalten wird.<br><b>NW 1:</b> Umschalten mit P-Flanke und X-Box (Rückführung von <code>Bahnsteiglicht</code>).<br><b>NW 2:</b> <code>' + p.R + '</code> setzt <code>Bahnsteiglicht</code> zurück.',
  vars: p => ({ Taste_Licht:false, [p.R]:false, Bahnsteiglicht:false }),
  start: START_G('Umschalten'),
  ref: p => 'NETWORK Umschalten\nP(Taste_Licht) XOR Bahnsteiglicht => Bahnsteiglicht;\n\nNETWORK Abschalten\n' + p.R + ' => R Bahnsteiglicht;',
  must:['EDGE_P','XOR','RESET'],
  visible: () => seq([[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }]]),
  hidden: p => [
    { steps:[[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{},{ Bahnsteiglicht:true }],[0.1,{},{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:false }],[0.1,{},{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:false }]] },
    { steps:[[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }],[0.1,{ [p.R]:true },{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:false, [p.R]:false },{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }]] },
    { steps:[[0.1,{},{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:false }]] }
  ],
  wrong:[
    p => 'NETWORK Umschalten\nTaste_Licht XOR Bahnsteiglicht => Bahnsteiglicht;\n\nNETWORK Abschalten\n' + p.R + ' => R Bahnsteiglicht;',
    p => 'NETWORK Umschalten\nN(Taste_Licht) XOR Bahnsteiglicht => Bahnsteiglicht;\n\nNETWORK Abschalten\n' + p.R + ' => R Bahnsteiglicht;',
    () => 'NETWORK Umschalten\nP(Taste_Licht) XOR Bahnsteiglicht => Bahnsteiglicht;'
  ]
});

/* ---------- Kapitel 6: TON, TOF, TP ---------- */
defExamTask({ id:'x_fup_g_unterfuehrung', quest:'fup', level:'grund', ch:6, diff:1, timed:true,
  params:{ T:[3, 4, 5] },
  title:'Licht in der Unterführung',
  brief: p => 'Der Bewegungsmelder <code>Bewegung</code> schaltet <code>Licht_Unterfuehrung</code> sofort ein. Nach der letzten Bewegung bleibt das Licht noch <b>' + p.T + ' s</b> an. Verwende eine Zeitbox mit der Instanz <code>T_Licht</code>.',
  vars: () => ({ Bewegung:false, Licht_Unterfuehrung:false }),
  start: START_G('Licht'),
  ref: p => 'NETWORK Licht\nBewegung AND TOF(T_Licht, T#' + p.T + 'S) => Licht_Unterfuehrung;',
  must:['TOF'],
  visible: () => seq([[0,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }]]),
  hidden: p => [
    { steps:[[0,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }],[p.T - 0.5,{},{ Licht_Unterfuehrung:true }],[0.6,{},{ Licht_Unterfuehrung:false }]] },
    { steps:[[0,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }],[p.T - 1,{},{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }],[p.T - 0.3,{},{ Licht_Unterfuehrung:true }],[0.5,{},{ Licht_Unterfuehrung:false }]] },
    { steps:[[0.1,{},{ Licht_Unterfuehrung:false }],[0.1,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[2 * p.T,{},{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }]] }
  ],
  wrong:[
    p => 'NETWORK Licht\nBewegung AND TON(T_Licht, T#' + p.T + 'S) => Licht_Unterfuehrung;',
    p => 'NETWORK Licht\nBewegung AND TP(T_Licht, T#' + p.T + 'S) => Licht_Unterfuehrung;',
    p => 'NETWORK Licht\nBewegung AND TOF(T_Licht, T#' + (p.T + 2) + 'S) => Licht_Unterfuehrung;'
  ]
});

defExamTask({ id:'x_fup_g_rottenwarnung', quest:'fup', level:'grund', ch:6, diff:2, timed:true,
  params:{ T:[2, 3] },
  title:'Rottenwarnung',
  brief: p => 'Das <code>Warnhorn</code> warnt die Gleisarbeiter. Es ertönt bei der steigenden Flanke von <code>Zug_naht</code> <b>oder</b> <code>Taste_Test</code> für genau <b>' + p.T + ' s</b> – unabhängig davon, wie lange das Signal ansteht. Verwende eine Zeitbox mit der Instanz <code>T_Warn</code>.',
  vars: () => ({ Zug_naht:false, Taste_Test:false, Warnhorn:false }),
  start: START_G('Rottenwarnung'),
  ref: p => 'NETWORK Rottenwarnung\n(Zug_naht OR Taste_Test) AND TP(T_Warn, T#' + p.T + 'S) => Warnhorn;',
  must:['TP','PARALLEL'],
  visible: () => seq([[0,{ Zug_naht:true },{ Warnhorn:true }],[1,{},{ Warnhorn:true }]]),
  hidden: p => [
    { steps:[[0,{ Zug_naht:true },{ Warnhorn:true }],[p.T - 0.5,{},{ Warnhorn:true }],[0.6,{},{ Warnhorn:false }],[1,{},{ Warnhorn:false }]] },
    { steps:[[0,{ Taste_Test:true },{ Warnhorn:true }],[0.2,{ Taste_Test:false },{ Warnhorn:true }],[p.T - 0.5,{},{ Warnhorn:true }],[0.5,{},{ Warnhorn:false }]] },
    { steps:[[0,{ Zug_naht:true },{ Warnhorn:true }],[0.5,{ Zug_naht:false },{ Warnhorn:true }],[0.2,{ Zug_naht:true },{ Warnhorn:true }],[p.T - 0.9,{},{ Warnhorn:true }],[0.4,{},{ Warnhorn:false }]] }
  ],
  wrong:[
    p => 'NETWORK Rottenwarnung\n(Zug_naht OR Taste_Test) AND TON(T_Warn, T#' + p.T + 'S) => Warnhorn;',
    p => 'NETWORK Rottenwarnung\n(Zug_naht OR Taste_Test) AND TOF(T_Warn, T#' + p.T + 'S) => Warnhorn;',
    p => 'NETWORK Rottenwarnung\nZug_naht AND TP(T_Warn, T#' + p.T + 'S) => Warnhorn;'
  ]
});

/* ---------- Kapitel 7: Blinker, Laufzeit, Vorläuten ---------- */
defExamTask({ id:'x_fup_g_schranke_laufzeit', quest:'fup', level:'grund', ch:7, diff:2, timed:true,
  params:{ T:[4, 5, 6] },
  title:'Laufzeit der Schranke',
  brief: p => 'Solange <code>Schranke_senken</code> ansteht und die Endlage <code>Schranke_unten</code> <b>nicht</b> erreicht ist, läuft die Überwachungszeit <code>T_Lauf</code> (' + p.T + ' s). Ist sie abgelaufen, wird <code>BUE_Stoerung</code> gespeichert. <code>Quittieren</code> setzt die Störung zurück; steht die Störbedingung noch an, bleibt die Störung gesetzt (Setzen dominant).',
  vars: () => ({ Schranke_senken:false, Schranke_unten:false, Quittieren:false, BUE_Stoerung:false }),
  start: START_G('Laufzeit'),
  ref: p => 'NETWORK Laufzeit\nSchranke_senken AND NOT Schranke_unten AND TON(T_Lauf, T#' + p.T + 'S) => RS(BUE_Stoerung, Quittieren);',
  must:['TON','RS','NC'],
  visible: p => seq([[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T + 0.5,{},{ BUE_Stoerung:true }]]),
  hidden: p => [
    { steps:[[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T - 1,{},{ BUE_Stoerung:false }],[0.1,{ Schranke_unten:true },{ BUE_Stoerung:false }],[p.T,{},{ BUE_Stoerung:false }]] },
    { steps:[[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T + 0.1,{},{ BUE_Stoerung:true }],[0.1,{ Schranke_senken:false },{ BUE_Stoerung:true }],[0.1,{ Quittieren:true },{ BUE_Stoerung:false }],[0.1,{ Quittieren:false },{ BUE_Stoerung:false }]] },
    { steps:[[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T + 0.1,{ Quittieren:true },{ BUE_Stoerung:true }],[0.1,{ Schranke_unten:true },{ BUE_Stoerung:false }]] }
  ],
  wrong:[
    p => 'NETWORK Laufzeit\nSchranke_senken AND NOT Schranke_unten AND TON(T_Lauf, T#' + p.T + 'S) => SR(BUE_Stoerung, Quittieren);',
    p => 'NETWORK Laufzeit\nSchranke_senken AND TON(T_Lauf, T#' + p.T + 'S) => RS(BUE_Stoerung, Quittieren);',
    p => 'NETWORK Laufzeit\nSchranke_senken AND NOT Schranke_unten AND TOF(T_Lauf, T#' + p.T + 'S) => RS(BUE_Stoerung, Quittieren);'
  ]
});

// Modell der Referenz (Scan für Scan), liefert die Erwartungen für den asymmetrischen Blinker
function blinkSim(E, A, steps){
  let t = 0, L = false, Z = false, pz = false, eOn = false, eS = 0, aOn = false, aS = 0;
  return steps.map(([dt, inp]) => {
    t += dt; if('Zug_naht' in inp) Z = inp.Zug_naht;
    if(Z && !pz) L = true; pz = Z;
    const inE = L; if(inE && !eOn) eS = t; const qE = inE && t - eS >= E - 1e-9; eOn = inE; if(qE) L = false;
    const inA = Z && !L; if(inA && !aOn) aS = t; const qA = inA && t - aS >= A - 1e-9; aOn = inA; if(qA) L = true;
    if(!Z) L = false;
    return [dt, inp, { Lampe:L }];
  });
}
const rep = (n, s) => Array.from({ length:n }, () => s);
const BL_REF = p => 'NETWORK Einschalten\nP(Zug_naht) => S Lampe;\n\nNETWORK Hellzeit\nLampe AND TON(T_Hell, T#' + p.E + 'MS) => R Lampe;\n\n' +
  'NETWORK Dunkelzeit\nZug_naht AND NOT Lampe AND TON(T_Dunkel, T#' + p.A + 'MS) => S Lampe;\n\nNETWORK Ausschalten\nNOT Zug_naht => R Lampe;';
defExamTask({ id:'x_fup_g_blinker', quest:'fup', level:'grund', ch:7, diff:3, timed:true,
  params:{ E:[500, 750], A:[1000, 1250] },
  title:'Warnlicht mit Hell- und Dunkelzeit',
  brief: p => 'Das Warnlicht <code>Lampe</code> blinkt, solange <code>Zug_naht</code> ansteht: beim Einschalten sofort hell, dann jeweils <b>' + p.E + ' ms</b> hell und <b>' + p.A + ' ms</b> dunkel. Fällt <code>Zug_naht</code> weg, ist die Lampe sofort aus.<br><b>NW 1:</b> P-Flanke von <code>Zug_naht</code> → S <code>Lampe</code><br><b>NW 2:</b> <code>Lampe</code> → TON <code>T_Hell</code> → R <code>Lampe</code><br><b>NW 3:</b> <code>Zug_naht</code> und nicht <code>Lampe</code> → TON <code>T_Dunkel</code> → S <code>Lampe</code><br><b>NW 4:</b> nicht <code>Zug_naht</code> → R <code>Lampe</code>',
  vars: () => ({ Zug_naht:false, Lampe:false }),
  start: START_G('Einschalten'),
  ref: BL_REF,
  must:['TON','EDGE_P','SET','RESET'],
  visible: p => [{ steps: blinkSim(p.E / 1000, p.A / 1000, [[0,{ Zug_naht:true }],[0.25,{}]]) }],
  hidden: p => [
    { steps: blinkSim(p.E / 1000, p.A / 1000, [[0,{ Zug_naht:true }]].concat(rep(20, [0.25,{}]), [[0.25,{ Zug_naht:false }],[0.25,{}]])) },
    { steps: blinkSim(p.E / 1000, p.A / 1000, [[0,{ Zug_naht:true }]].concat(rep(6, [0.25,{}]), [[0.25,{ Zug_naht:false }],[0.25,{ Zug_naht:true }]], rep(8, [0.25,{}]))) },
    { steps: blinkSim(p.E / 1000, p.A / 1000, [[0.25,{}],[0.25,{ Zug_naht:true }],[0.25,{ Zug_naht:false }],[0.25,{}],[0.25,{ Zug_naht:true }]].concat(rep(10, [0.25,{}]))) }
  ],
  wrong:[
    p => BL_REF(p).replace('\n\nNETWORK Ausschalten\nNOT Zug_naht => R Lampe;', ''),
    p => BL_REF({ E:p.A, A:p.E }),
    p => BL_REF(p).replace('P(Zug_naht) => S Lampe', 'Zug_naht => S Lampe')
  ]
});

/* ---------- Kapitel 8: Zähler ---------- */
defExamTask({ id:'x_fup_g_achszaehler', quest:'fup', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[4, 6, 8] },
  title:'Achsen zählen',
  brief: p => 'Der Achszähler <code>Achse</code> liefert pro Achse einen Impuls. Nach <b>' + p.N + '</b> Achsen meldet <code>Gleis_Frei_Pruefen</code> 1. <code>Grundstellung</code> setzt den Zähler zurück. Verwende eine CTU-Box mit der Instanz <code>Z_Achsen</code>.',
  vars: () => ({ Achse:false, Grundstellung:false, Gleis_Frei_Pruefen:false }),
  start: START_G('Achsen'),
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

const SAND_REF = (n, box) => 'NETWORK Vorrat\nSanden AND ' + (box || 'CTD(Z_Sand, PV:=' + n + ', LD:=Nachfuellen)') + ' => Sand_leer;\n\nNETWORK Anzeige\n=> MOVE(Z_Sand.CV, Rest);';
defExamTask({ id:'x_fup_g_sandvorrat', quest:'fup', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[3, 4, 5] },
  title:'Sandvorrat der Rangierlok',
  brief: p => 'Der Sandbehälter der Rangierlok reicht für <b>' + p.N + '</b> Sandungen. <code>Nachfuellen</code> lädt den Zähler <code>Z_Sand</code> auf ' + p.N + ', jede steigende Flanke von <code>Sanden</code> zählt um 1 <b>abwärts</b>. <code>Sand_leer</code> meldet einen leeren Vorrat (Zählwert ≤ 0).<br><b>NW 2:</b> Der aktuelle Zählwert steht immer in <code>Rest</code>.',
  vars: () => ({ Sanden:false, Nachfuellen:false, Sand_leer:false, Rest:0 }),
  start: START_G('Vorrat'),
  ref: p => SAND_REF(p.N),
  must:['CTD','MOVE'],
  visible: p => seq([[0.1,{ Nachfuellen:true },{ Rest:p.N, Sand_leer:false }],[0.1,{ Nachfuellen:false, Sanden:true },{ Rest:p.N - 1 }]]),
  hidden: p => {
    const st = [[0.1,{ Nachfuellen:true },{ Rest:p.N, Sand_leer:false }],[0.1,{ Nachfuellen:false },{ Rest:p.N }]];
    for(let i = 1; i <= p.N; i++){ st.push([0.1,{ Sanden:true },{ Rest:p.N - i, Sand_leer:i >= p.N }]); st.push([0.1,{ Sanden:false },{}]); }
    return [
      { steps: st },
      { steps:[[0.1,{},{ Sand_leer:true, Rest:0 }],[0.1,{ Nachfuellen:true },{ Sand_leer:false, Rest:p.N }],[0.1,{ Nachfuellen:false, Sanden:true },{ Rest:p.N - 1 }],[0.1,{ Sanden:false },{}],[0.1,{ Nachfuellen:true },{ Rest:p.N, Sand_leer:false }]] },
      { steps:[[0.1,{ Nachfuellen:true },{}],[0.1,{ Nachfuellen:false, Sanden:true },{ Rest:p.N - 1 }],[0.1,{},{ Rest:p.N - 1 }],[0.1,{},{ Rest:p.N - 1, Sand_leer:false }],[0.1,{ Sanden:false },{ Rest:p.N - 1 }]] }
    ];
  },
  wrong:[
    p => SAND_REF(p.N, 'CTU(Z_Sand, PV:=' + p.N + ', R:=Nachfuellen)'),
    p => SAND_REF(p.N + 1),
    p => 'NETWORK Vorrat\nSanden AND CTD(Z_Sand, PV:=' + p.N + ', LD:=Nachfuellen) => Sand_leer;'
  ]
});

/* ---------- Kapitel 9: Vergleichen, MOVE, Rechnen ---------- */
defExamTask({ id:'x_fup_g_weichenheizung', quest:'fup', level:'grund', ch:9, diff:1,
  params:{ T:[2, 3, 4] },
  title:'Weichenheizung',
  brief: p => 'Die <code>Weichenheizung</code> läuft, wenn die Schienentemperatur <code>Schienentemp</code> (Int, °C) <b>höchstens ' + p.T + ' °C</b> beträgt <b>oder</b> der Schneemelder <code>Schneefall</code> 1 meldet.',
  vars: () => ({ Schienentemp:10, Schneefall:false, Weichenheizung:false }),
  start: START_G('Heizung'),
  ref: p => 'NETWORK Heizung\n[Schienentemp <= ' + p.T + '] OR Schneefall => Weichenheizung;',
  must:['CMP','PARALLEL'],
  visible: () => [[{ Schienentemp:-2 }, { Weichenheizung:true }], [{ Schienentemp:15 }, { Weichenheizung:false }]],
  hidden: p => [
    [{ Schienentemp:p.T + 1 }, { Weichenheizung:false }], [{ Schienentemp:p.T }, { Weichenheizung:true }], [{ Schienentemp:p.T - 1 }, { Weichenheizung:true }],
    [{ Schienentemp:-5 }, { Weichenheizung:true }], [{ Schienentemp:p.T + 1, Schneefall:true }, { Weichenheizung:true }],
    [{ Schienentemp:20 }, { Weichenheizung:false }], [{ Schienentemp:20, Schneefall:true }, { Weichenheizung:true }]
  ],
  wrong:[
    p => 'NETWORK Heizung\n[Schienentemp < ' + p.T + '] OR Schneefall => Weichenheizung;',
    p => 'NETWORK Heizung\n[Schienentemp <= ' + p.T + '] AND Schneefall => Weichenheizung;',
    p => 'NETWORK Heizung\n[Schienentemp >= ' + p.T + '] OR Schneefall => Weichenheizung;'
  ]
});

const GEW_REF = p => 'NETWORK Wagengewicht\n=> MUL(Wagen, ' + p.G + ', Wagen_t);\n\nNETWORK Zuggewicht\n=> ADD(Wagen_t, ' + p.L + ', Gesamt_t);\n\nNETWORK Vorspann\n[Gesamt_t > ' + p.M + '] => Vorspann;';
defExamTask({ id:'x_fup_g_zuggewicht', quest:'fup', level:'grund', ch:9, diff:3,
  params:{ G:[20, 25], L:[100, 200], M:[500, 600] },
  title:'Vorspannlok nötig?',
  brief: p => 'Ein Güterzug soll über die Brünig-Rampe.<br><b>NW 1:</b> <code>Wagen_t</code> = <code>Wagen</code> × ' + p.G + ' (t pro Wagen)<br><b>NW 2:</b> <code>Gesamt_t</code> = <code>Wagen_t</code> + ' + p.L + ' (Gewicht der Lok)<br><b>NW 3:</b> Ist <code>Gesamt_t</code> <b>grösser als ' + p.M + '</b>, meldet <code>Vorspann</code> 1.<br>Alle Werte sind Int. Die Ergebnisse müssen im selben Zyklus stimmen.',
  vars: () => ({ Wagen:0, Wagen_t:0, Gesamt_t:0, Vorspann:false }),
  start: START_G('Wagengewicht'),
  ref: GEW_REF,
  must:['MUL','ADD','CMP'],
  visible: p => [[{ Wagen:10 }, { Wagen_t:10 * p.G, Gesamt_t:10 * p.G + p.L, Vorspann:10 * p.G + p.L > p.M }]],
  hidden: p => { const k = (p.M - p.L) / p.G, c = w => [{ Wagen:w }, { Wagen_t:w * p.G, Gesamt_t:w * p.G + p.L, Vorspann:w * p.G + p.L > p.M }];
    return [c(k), c(k + 1), c(0), c(k - 1), c(k + 5), c(1)]; },
  wrong:[
    p => GEW_REF(p).replace('[Gesamt_t >', '[Gesamt_t >='),
    p => 'NETWORK Wagengewicht\n=> MUL(Wagen, ' + p.G + ', Wagen_t);\n\nNETWORK Vorspann\n[Wagen_t > ' + p.M + '] => Vorspann;',
    p => 'NETWORK Zuggewicht\n=> ADD(Wagen_t, ' + p.L + ', Gesamt_t);\n\nNETWORK Wagengewicht\n=> MUL(Wagen, ' + p.G + ', Wagen_t);\n\nNETWORK Vorspann\n[Gesamt_t > ' + p.M + '] => Vorspann;'
  ]
});

/* ---------- Kapitel 10: Fahrstrassen ---------- */
const FS_REF = (g, box, sig) => 'NETWORK Fahrstrasse\nTaste_FS' + g + ' AND Gleis' + g + '_frei AND NOT Stoerung => ' + (box || 'SR') + '(FS' + g + ', Zugschluss);\n\nNETWORK Signal D\nFS' + g + ' AND W' + g + '_Endlage' + (sig === undefined ? ' AND NOT Stoerung' : sig) + ' => Signal_D;';
defExamTask({ id:'x_fup_g_fs_gleis', quest:'fup', level:'grund', ch:10, diff:2, timed:true,
  params:{ G:[3, 4] },
  title: p => 'Fahrstrasse nach Gleis ' + p.G,
  brief: p => '<b>NW 1:</b> <code>Taste_FS' + p.G + '</code> stellt die Fahrstrasse <code>FS' + p.G + '</code> ein, wenn <code>Gleis' + p.G + '_frei</code> meldet und <b>keine</b> <code>Stoerung</code> ansteht. Die Fahrstrasse bleibt gespeichert, bis <code>Zugschluss</code> sie auflöst (Rücksetzen dominant).<br><b>NW 2:</b> <code>Signal_D</code> zeigt Fahrt, wenn <code>FS' + p.G + '</code> besteht, die Weiche <code>W' + p.G + '_Endlage</code> meldet und keine <code>Stoerung</code> ansteht.',
  vars: p => ({ ['Taste_FS' + p.G]:false, ['Gleis' + p.G + '_frei']:false, Stoerung:false, Zugschluss:false, ['FS' + p.G]:false, ['W' + p.G + '_Endlage']:false, Signal_D:false }),
  start: START_G('Fahrstrasse'),
  ref: p => FS_REF(p.G),
  must:['SR','NC','SERIES'],
  visible: p => seq([[0.1,{ ['Taste_FS' + p.G]:true, ['Gleis' + p.G + '_frei']:true, ['W' + p.G + '_Endlage']:true },{ ['FS' + p.G]:true, Signal_D:true }]]),
  hidden: p => { const T = 'Taste_FS' + p.G, F = 'Gleis' + p.G + '_frei', FS = 'FS' + p.G, W = 'W' + p.G + '_Endlage';
    return [
      { steps:[[0.1,{ [T]:true, [F]:true },{ [FS]:true, Signal_D:false }],[0.1,{ [T]:false },{ [FS]:true }],[0.1,{ [W]:true },{ Signal_D:true }],[0.1,{ Stoerung:true },{ [FS]:true, Signal_D:false }],[0.1,{ Stoerung:false },{ Signal_D:true }],[0.1,{ Zugschluss:true },{ [FS]:false, Signal_D:false }]] },
      { steps:[[0.1,{ [T]:true },{ [FS]:false }],[0.1,{ [F]:true, Stoerung:true },{ [FS]:false }],[0.1,{ Stoerung:false },{ [FS]:true }]] },
      { steps:[[0.1,{ [T]:true, [F]:true, Zugschluss:true, [W]:true },{ [FS]:false, Signal_D:false }],[0.1,{ Zugschluss:false },{ [FS]:true, Signal_D:true }]] }
    ]; },
  wrong:[
    p => FS_REF(p.G, 'RS'),
    p => FS_REF(p.G, null, ''),
    p => 'NETWORK Fahrstrasse\nTaste_FS' + p.G + ' AND Gleis' + p.G + '_frei AND NOT Stoerung => FS' + p.G + ';\n\nNETWORK Signal D\nFS' + p.G + ' AND W' + p.G + '_Endlage AND NOT Stoerung => Signal_D;'
  ]
});

const AUF_REF = (p, o) => { o = o || {};
  return (o.noTimer ? '' : 'NETWORK Notaufloesung\nTaste_Notaufl AND TON(T_Notaufl, T#' + p.T + 'S) => Notaufl;\n\n') +
    'NETWORK Aufloesen\n' + (o.noEdge ? 'Zielgleis_besetzt' : 'P(Zielgleis_besetzt)') + ' OR ' + (o.noTimer ? 'Taste_Notaufl' : 'Notaufl') + ' => Aufloesen;\n\n' +
    'NETWORK Fahrstrasse West\nTaste_FS' + (o.noGegen ? '' : ' AND NOT Gegen_FS') + ' => ' + (o.box || 'SR') + '(FS_West, Aufloesen);'; };
defExamTask({ id:'x_fup_g_fs_aufloesen', quest:'fup', level:'grund', ch:10, diff:3, timed:true,
  params:{ T:[2, 3] },
  title:'Fahrstrasse auflösen',
  brief: p => '<b>NW 1:</b> Die Notauflösetaste <code>Taste_Notaufl</code> muss <b>' + p.T + ' s</b> gedrückt bleiben, dann wird <code>Notaufl</code> 1 (Instanz <code>T_Notaufl</code>).<br><b>NW 2:</b> <code>Aufloesen</code> ist 1, wenn der Zug ins Zielgleis <b>einfährt</b> (steigende Flanke von <code>Zielgleis_besetzt</code>) oder <code>Notaufl</code> ansteht.<br><b>NW 3:</b> <code>Taste_FS</code> stellt <code>FS_West</code> ein, sofern die feindliche Fahrstrasse <code>Gegen_FS</code> nicht besteht. <code>Aufloesen</code> löst sie auf und hat Vorrang.',
  vars: () => ({ Taste_FS:false, Gegen_FS:false, Zielgleis_besetzt:false, Taste_Notaufl:false, Notaufl:false, Aufloesen:false, FS_West:false }),
  start: START_G('Notaufloesung'),
  ref: p => AUF_REF(p),
  must:['EDGE_P','TON','SR'],
  visible: () => seq([[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false, Zielgleis_besetzt:true },{ FS_West:false }]]),
  hidden: p => [
    { steps:[[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false },{ FS_West:true }],[0.1,{ Zielgleis_besetzt:true },{ FS_West:false }],[0.1,{},{ FS_West:false }],[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false },{ FS_West:true }]] },
    { steps:[[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false, Taste_Notaufl:true },{ FS_West:true }],[p.T - 1,{},{ FS_West:true }],[0.1,{ Taste_Notaufl:false },{ FS_West:true }],[0.1,{ Taste_Notaufl:true },{ FS_West:true }],[p.T + 0.1,{},{ FS_West:false }],[0.1,{ Taste_Notaufl:false },{ FS_West:false }]] },
    { steps:[[0.1,{ Gegen_FS:true, Taste_FS:true },{ FS_West:false }],[0.1,{ Gegen_FS:false },{ FS_West:true }],[0.1,{ Taste_FS:false },{ FS_West:true }],[0.1,{ Taste_Notaufl:true },{ FS_West:true }],[p.T + 0.1,{ Taste_FS:true },{ FS_West:false }]] }
  ],
  wrong:[
    p => AUF_REF(p, { noEdge:true }),
    p => AUF_REF(p, { noTimer:true }),
    p => AUF_REF(p, { box:'RS' }),
    p => AUF_REF(p, { noGegen:true })
  ]
});

/* =====================================================================
   PROFI-STUFE
   ===================================================================== */

/* ---------- Kapitel 11: FC, Schnittstelle, Aufruf-Box ---------- */
const SIG_D = { in:'Fahrstrasse:Bool|Fahrstrasse festgelegt; Gleis_Frei:Bool|Gleisfreimeldung; Stoerung:Bool|Signalstörung', out:'Fahrt:Bool|Signal zeigt Fahrt' };
defExamTask({ id:'x_fup_p_signal', quest:'fup', level:'profi', ch:11, diff:1,
  title:'Signal-FC',
  brief: () => 'Programmiere die Funktion <code>FC_Signal</code>: <code>#Fahrt</code> ist 1, wenn <code>#Fahrstrasse</code> <b>und</b> <code>#Gleis_Frei</code> 1 sind und <b>keine</b> <code>#Stoerung</code> ansteht. Der OB <code>Main</code> (🔒) ruft die FC für das Einfahrsignal auf.',
  blocks: () => [
    { name:'FC_Signal', kind:'FC', edit:true, start: kFC('FC_Signal', 'Void', SIG_D, ''), ref: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei AND NOT #Stoerung => #Fahrt;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Einfahrsignal\n=> "FC_Signal"(Fahrstrasse := "FS_Fest", Gleis_Frei := "Gleis1_frei", Stoerung := "Sig_Stoer", Fahrt => "Signal_Fahrt");') }
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

const WL_D = { in:'Links:Bool|Endlage links; Rechts:Bool|Endlage rechts', out:'Lage_OK:Bool|genau eine Endlage; Stoerung:Bool|keine oder beide Endlagen' };
const WL_FC = kFC('FC_Weichenlage', 'Void', WL_D, 'NETWORK Lage\n#Links XOR #Rechts => #Lage_OK, NOT #Stoerung;');
const wlCall = (n, src) => 'NETWORK Weiche ' + n + '\n=> "FC_Weichenlage"(Links := "W' + src + '_links", Rechts := "W' + src + '_rechts", Lage_OK => "W' + n + '_OK", Stoerung => "W' + n + '_Stoerung");';
defExamTask({ id:'x_fup_p_weichenlage', quest:'fup', level:'profi', ch:11, diff:1,
  params:{ N:[2, 3, 4] },
  title:'Weichenlage für zwei Weichen',
  brief: p => 'Die Funktion <code>FC_Weichenlage</code> (🔒) ist fertig. Rufe sie in <code>Main</code> zweimal auf, je in einem eigenen Netzwerk ohne Bedingung:<br><b>NW 1:</b> Links := <code>"W1_links"</code>, Rechts := <code>"W1_rechts"</code>, Lage_OK => <code>"W1_OK"</code>, Stoerung => <code>"W1_Stoerung"</code><br><b>NW 2:</b> dasselbe für Weiche ' + p.N + ' mit den Signalen <code>"W' + p.N + '_…"</code>.',
  blocks: p => [
    { name:'FC_Weichenlage', kind:'FC', src: WL_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(wlCall(1, 1) + '\n\n' + wlCall(p.N, p.N)) }
  ],
  globals: p => ({ W1_links:false, W1_rechts:false, W1_OK:false, W1_Stoerung:false, ['W' + p.N + '_links']:false, ['W' + p.N + '_rechts']:false, ['W' + p.N + '_OK']:false, ['W' + p.N + '_Stoerung']:false }),
  must:['CALL','FC_CALL'],
  visible: () => ({ tests:[[{ W1_links:true }, { W1_OK:true, W1_Stoerung:false }]] }),
  hidden: p => { const w = k => 'W' + p.N + '_' + k;
    return { tests:[
      [{ W1_rechts:true }, { W1_OK:true, W1_Stoerung:false, [w('OK')]:false, [w('Stoerung')]:true }],
      [{ W1_links:true, W1_rechts:true }, { W1_OK:false, W1_Stoerung:true }],
      [{}, { W1_OK:false, W1_Stoerung:true, [w('OK')]:false, [w('Stoerung')]:true }],
      [{ [w('links')]:true }, { [w('OK')]:true, [w('Stoerung')]:false, W1_OK:false }],
      [{ [w('rechts')]:true, W1_links:true }, { [w('OK')]:true, W1_OK:true }],
      [{ [w('links')]:true, [w('rechts')]:true, W1_links:true }, { [w('OK')]:false, [w('Stoerung')]:true, W1_OK:true }]
    ] }; },
  wrong:[
    () => ({ Main: MAIN(wlCall(1, 1)) }),
    p => ({ Main: MAIN(wlCall(1, 1) + '\n\n' + wlCall(p.N, 1)) }),
    p => ({ Main: MAIN(wlCall(1, 1) + '\n\n' + wlCall(p.N, p.N).replace('Lage_OK => "W' + p.N + '_OK", Stoerung => "W' + p.N + '_Stoerung"', 'Lage_OK => "W' + p.N + '_Stoerung", Stoerung => "W' + p.N + '_OK"')) })
  ]
});

const GW_D = { in:'Zuglaenge:Int|m; Nutzlaenge:Int|m; Gleis_frei:Bool', out:'Passt:Bool|Zug passt ins Gleis' };
const gwFC = body => kFC('FC_Gleiswahl', 'Void', GW_D, body);
defExamTask({ id:'x_fup_p_gleiswahl', quest:'fup', level:'profi', ch:11, diff:2,
  params:{ L1:[180, 220], L2:[300, 350] },
  title:'Passt der Zug ins Gleis?',
  brief: p => 'Programmiere <code>FC_Gleiswahl</code>: <code>#Passt</code> ist 1, wenn <code>#Zuglaenge</code> <b>kleiner oder gleich</b> <code>#Nutzlaenge</code> ist <b>und</b> <code>#Gleis_frei</code> meldet.<br><code>Main</code> (🔒) ruft die FC für Gleis 1 (Nutzlänge ' + p.L1 + ' m) und Gleis 2 (Nutzlänge ' + p.L2 + ' m) auf.',
  blocks: p => [
    { name:'FC_Gleiswahl', kind:'FC', edit:true, start: gwFC(''), ref: gwFC('NETWORK Passt\n[#Zuglaenge <= #Nutzlaenge] AND #Gleis_frei => #Passt;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gleis 1\n=> "FC_Gleiswahl"(Zuglaenge := "Zuglaenge", Nutzlaenge := ' + p.L1 + ', Gleis_frei := "Gleis1_frei", Passt => "Gleis1_passt");\n\nNETWORK Gleis 2\n=> "FC_Gleiswahl"(Zuglaenge := "Zuglaenge", Nutzlaenge := ' + p.L2 + ', Gleis_frei := "Gleis2_frei", Passt => "Gleis2_passt");') }
  ],
  globals: () => ({ Zuglaenge:0, Gleis1_frei:false, Gleis2_frei:false, Gleis1_passt:false, Gleis2_passt:false }),
  must:['CMP','SERIES'],
  visible: () => ({ tests:[[{ Zuglaenge:120, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:true, Gleis2_passt:true }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Gleiswahl', steps:[[{ Zuglaenge:150, Nutzlaenge:150, Gleis_frei:true }, { Passt:true }], [{ Zuglaenge:151, Nutzlaenge:150, Gleis_frei:true }, { Passt:false }], [{ Zuglaenge:100, Nutzlaenge:150, Gleis_frei:false }, { Passt:false }], [{ Zuglaenge:0, Nutzlaenge:150, Gleis_frei:true }, { Passt:true }]] }],
    tests:[
      [{ Zuglaenge:p.L1, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:true, Gleis2_passt:true }],
      [{ Zuglaenge:p.L1 + 1, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:false, Gleis2_passt:true }],
      [{ Zuglaenge:p.L2 + 1, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:false, Gleis2_passt:false }],
      [{ Zuglaenge:p.L1 - 10, Gleis2_frei:true }, { Gleis1_passt:false, Gleis2_passt:true }]
    ]
  }),
  wrong:[
    () => ({ FC_Gleiswahl: gwFC('NETWORK Passt\n[#Zuglaenge < #Nutzlaenge] AND #Gleis_frei => #Passt;') }),
    () => ({ FC_Gleiswahl: gwFC('NETWORK Passt\n[#Zuglaenge <= #Nutzlaenge] OR #Gleis_frei => #Passt;') }),
    () => ({ FC_Gleiswahl: gwFC('NETWORK Passt\n[#Zuglaenge <= #Nutzlaenge] => #Passt;') })
  ]
});

/* ---------- Kapitel 12: FB, Instanz, Multiinstanz ---------- */
const RA_D0 = { in:'Anfahrt:Bool|Zug nähert sich; Im_BUE:Bool|Zug im Übergang', out:'Schranke_zu:Bool; Strasse_frei:Bool|Lichtsignal Strasse' };
const raFB = (stat, body) => kFB('FB_Raeumung', Object.assign({}, RA_D0, stat ? { stat } : {}), body);
const RA_BODY = (box, t) => 'NETWORK Schranke\n(#Anfahrt OR #Im_BUE) AND ' + box + '(#T_Raeum, T#' + t + 'S) => #Schranke_zu;\n\nNETWORK Strasse\n#Schranke_zu => NOT #Strasse_frei;';
defExamTask({ id:'x_fup_p_raeumung', quest:'fup', level:'profi', ch:12, diff:2,
  params:{ T:[2, 3, 4] },
  title:'Nachlaufzeit am Bahnübergang',
  brief: p => 'Programmiere <code>FB_Raeumung</code>:<br><b>NW 1:</b> Solange <code>#Anfahrt</code> oder <code>#Im_BUE</code> ansteht, ist <code>#Schranke_zu</code> 1. Danach bleibt die Schranke noch <b>' + p.T + ' s</b> zu. Lege dafür in der Tabelle die Static-Variable <code>T_Raeum</code> (Zeitbox als Multiinstanz) an.<br><b>NW 2:</b> <code>#Strasse_frei</code> ist das Gegenteil von <code>#Schranke_zu</code>.<br><code>Main</code> (🔒) ruft den FB mit <code>"FB_Raeumung_DB"</code> auf.',
  blocks: p => [
    { name:'FB_Raeumung', kind:'FB', edit:true, start: raFB(null, ''), ref: raFB('T_Raeum:TOF|Nachlaufzeit', RA_BODY('TOF', p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang\n=> "FB_Raeumung_DB"(Anfahrt := "Zug_Anfahrt", Im_BUE := "Zug_im_BUE", Schranke_zu => "Schranke_zu", Strasse_frei => "Strasse_frei");') }
  ],
  globals: () => ({ Zug_Anfahrt:false, Zug_im_BUE:false, Schranke_zu:false, Strasse_frei:false }),
  must:['TOF','STAT'],
  visible: () => ({ timed:[{ steps:[[0.1,{ Zug_Anfahrt:true },{ Schranke_zu:true, Strasse_frei:false }]] }] }),
  hidden: p => ({
    unit:[{ block:'FB_Raeumung', steps:[[0,{ Anfahrt:true },{ Schranke_zu:true, Strasse_frei:false }],[1,{ Anfahrt:false, Im_BUE:true },{ Schranke_zu:true }],[0.5,{ Im_BUE:false },{ Schranke_zu:true }],[p.T - 0.5,{},{ Schranke_zu:true, Strasse_frei:false }],[0.7,{},{ Schranke_zu:false, Strasse_frei:true }]] }],
    timed:[
      { steps:[[0.1,{ Zug_im_BUE:true },{ Schranke_zu:true }],[0.1,{ Zug_im_BUE:false },{ Schranke_zu:true }],[p.T + 0.1,{},{ Schranke_zu:false, Strasse_frei:true }]] },
      { steps:[[0.1,{},{ Schranke_zu:false, Strasse_frei:true }],[0.1,{ Zug_Anfahrt:true },{ Schranke_zu:true, Strasse_frei:false }],[5,{},{ Schranke_zu:true }],[0.1,{ Zug_Anfahrt:false },{ Schranke_zu:true }],[p.T - 0.3,{},{ Schranke_zu:true }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Raeumung: raFB('T_Raeum:TON|Nachlaufzeit', RA_BODY('TON', p.T)) }),
    p => ({ FB_Raeumung: raFB('T_Raeum:TOF|Nachlaufzeit', RA_BODY('TOF', p.T + 1)) }),
    p => ({ FB_Raeumung: raFB('T_Raeum:TOF|Nachlaufzeit', RA_BODY('TOF', p.T).replace('=> NOT #Strasse_frei', '=> #Strasse_frei')) })
  ]
});

const LI_D0 = { in:'Taste:Bool|Lichttaste; Aus:Bool|Betriebsschluss', out:'Licht:Bool' };
const liFB = (stat, body) => kFB('FB_Licht', Object.assign({}, LI_D0, stat ? { stat } : {}), body);
const LI_BODY = (t, o) => { o = o || {};
  return 'NETWORK Umschalten\n' + (o.noEdge ? '#Taste' : 'P(#Taste)') + ' XOR #Licht => #Licht;\n\n' +
    (o.noTimer ? '' : 'NETWORK Automatisch aus\n#Licht AND ' + (o.box || 'TON') + '(#T_Auto, T#' + t + 'S) => R #Licht;\n\n') +
    'NETWORK Betriebsschluss\n#Aus => R #Licht;'; };
defExamTask({ id:'x_fup_p_bahnsteiglicht', quest:'fup', level:'profi', ch:12, diff:3,
  params:{ T:[5, 10] },
  title:'Bahnsteiglicht als Baustein',
  brief: p => 'Programmiere <code>FB_Licht</code>:<br><b>NW 1:</b> Jede steigende Flanke von <code>#Taste</code> schaltet <code>#Licht</code> um (Stromstoss mit X-Box).<br><b>NW 2:</b> Ist <code>#Licht</code> seit <b>' + p.T + ' s</b> an, wird es automatisch zurückgesetzt. Lege die Zeitbox als Static-Variable <code>T_Auto</code> an.<br><b>NW 3:</b> <code>#Aus</code> setzt <code>#Licht</code> zurück.<br><code>Main</code> (🔒) ruft den FB für zwei Bahnsteige mit den Instanzen <code>"Licht1_DB"</code> und <code>"Licht2_DB"</code> auf.',
  blocks: p => [
    { name:'FB_Licht', kind:'FB', edit:true, start: liFB(null, ''), ref: liFB('T_Auto:TON|automatisch aus', LI_BODY(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnsteig 1\n=> "Licht1_DB"(Taste := "Taste_B1", Aus := "Betriebsschluss", Licht => "Licht_B1");\n\nNETWORK Bahnsteig 2\n=> "Licht2_DB"(Taste := "Taste_B2", Aus := "Betriebsschluss", Licht => "Licht_B2");') }
  ],
  instances: () => ({ Licht1_DB:'FB_Licht', Licht2_DB:'FB_Licht' }),
  globals: () => ({ Taste_B1:false, Taste_B2:false, Betriebsschluss:false, Licht_B1:false, Licht_B2:false }),
  must:['EDGE_P','XOR','TON','STAT'],
  visible: () => ({ timed:[{ steps:[[0.1,{ Taste_B1:true },{ Licht_B1:true, Licht_B2:false }],[0.1,{ Taste_B1:false },{ Licht_B1:true }]] }] }),
  hidden: p => ({
    unit:[
      { block:'FB_Licht', steps:[[0,{ Taste:true },{ Licht:true }],[0.5,{},{ Licht:true }],[0.1,{ Taste:false },{ Licht:true }],[0.1,{ Taste:true },{ Licht:false }],[0.1,{ Taste:false },{ Licht:false }],[0.1,{ Taste:true },{ Licht:true }],[p.T,{},{ Licht:false }],[0.1,{},{ Licht:false }]] },
      { block:'FB_Licht', steps:[[0,{ Taste:true },{ Licht:true }],[0.1,{ Taste:false },{ Licht:true }],[p.T - 0.5,{},{ Licht:true }],[0.1,{ Aus:true },{ Licht:false }],[0.1,{ Aus:false, Taste:true },{ Licht:true }]] }
    ],
    timed:[{ steps:[[0.1,{ Taste_B1:true },{ Licht_B1:true, Licht_B2:false }],[0.1,{ Taste_B1:false, Taste_B2:true },{ Licht_B1:true, Licht_B2:true }],[0.1,{ Taste_B2:false, Betriebsschluss:true },{ Licht_B1:false, Licht_B2:false }]] }]
  }),
  wrong:[
    p => ({ FB_Licht: liFB('T_Auto:TON|automatisch aus', LI_BODY(p.T, { noEdge:true })) }),
    p => ({ FB_Licht: liFB(null, LI_BODY(p.T, { noTimer:true })) }),
    p => ({ FB_Licht: liFB('T_Auto:TOF|automatisch aus', LI_BODY(p.T, { box:'TOF' })) })
  ]
});

/* ---------- Kapitel 13: Datenbaustein, PLC-Datentyp, Array ---------- */
const TMP_MAIN = (cmp, lim, move) => MAIN((move === false ? '' : 'NETWORK Messwert\n=> MOVE("Tempo", "DB_Strecke".V_letzt);\n\n') + 'NETWORK Ueberschreitung\n["Tempo" ' + (cmp || '>') + ' ' + (lim || '"DB_Strecke".V_max') + '] => "Warnung";');
defExamTask({ id:'x_fup_p_db_tempo', quest:'fup', level:'profi', ch:13, diff:1,
  params:{ V:[60, 80, 100] },
  title:'Streckengeschwindigkeit aus dem DB',
  brief: p => 'Im globalen DB <code>DB_Strecke</code> (🔒) steht die zulässige Geschwindigkeit <code>V_max</code> (Startwert ' + p.V + ' km/h). Programmiere in <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung MOVE <code>"Tempo"</code> nach <code>"DB_Strecke".V_letzt</code><br><b>NW 2:</b> <code>"Warnung"</code> ist 1, wenn <code>"Tempo"</code> <b>grösser</b> als <code>"DB_Strecke".V_max</code> ist. Lies den Grenzwert aus dem DB – keine feste Zahl.',
  blocks: p => [
    { name:'DB_Strecke', kind:'DB', src: kDB('DB_Strecke', 'V_max:Int := ' + p.V + '|km/h zulässig; V_letzt:Int|letzter Messwert') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: TMP_MAIN() }
  ],
  globals: () => ({ Tempo:0, Warnung:false }),
  must:['DB_ACCESS','CMP','MOVE'],
  visible: p => ({ tests:[[{ Tempo:p.V + 5 }, { Warnung:true, 'DB_Strecke.V_letzt':p.V + 5 }]] }),
  hidden: p => ({ tests:[
    [{ Tempo:p.V }, { Warnung:false, 'DB_Strecke.V_letzt':p.V }],
    [{ Tempo:p.V + 1 }, { Warnung:true }],
    [{ Tempo:0 }, { Warnung:false, 'DB_Strecke.V_letzt':0 }],
    [{ Tempo:p.V - 20, 'DB_Strecke.V_max':p.V - 30 }, { Warnung:true }],
    [{ Tempo:p.V + 10, 'DB_Strecke.V_max':p.V + 20 }, { Warnung:false }],
    [{ Tempo:37 }, { 'DB_Strecke.V_letzt':37 }]
  ] }),
  wrong:[
    p => ({ Main: TMP_MAIN('>', String(p.V)) }),
    () => ({ Main: TMP_MAIN('>=') }),
    () => ({ Main: TMP_MAIN('>', null, false) })
  ]
});

const UDT_SIG = kUDT('UDT_Signal', 'Fahrt:Bool|Fahrtbefehl; Lampe_defekt:Bool|Lampenüberwachung; Gestoert:Bool|Störung Stellwerk');
const SB_D = { in:'Sig:"UDT_Signal"', out:'Gruen:Bool|Fahrtbegriff; Meldung:Bool|Störmeldung' };
const sbFC = body => kFC('FC_Signalbild', 'Void', SB_D, body);
const SB_BODY = 'NETWORK Fahrtbegriff\n#Sig.Fahrt AND NOT #Sig.Lampe_defekt AND NOT #Sig.Gestoert => #Gruen;\n\nNETWORK Stoermeldung\n#Sig.Lampe_defekt OR #Sig.Gestoert => #Meldung;';
defExamTask({ id:'x_fup_p_udt_signal', quest:'fup', level:'profi', ch:13, diff:2,
  title:'Signalbild aus dem PLC-Datentyp',
  brief: () => 'Der PLC-Datentyp <code>UDT_Signal</code> (🔒) enthält <code>Fahrt</code>, <code>Lampe_defekt</code> und <code>Gestoert</code>. Programmiere <code>FC_Signalbild</code> mit dem Input <code>#Sig</code> vom Typ <code>"UDT_Signal"</code>:<br><b>NW 1:</b> <code>#Gruen</code> ist 1, wenn <code>#Sig.Fahrt</code> 1 ist und weder <code>#Sig.Lampe_defekt</code> noch <code>#Sig.Gestoert</code> ansteht.<br><b>NW 2:</b> <code>#Meldung</code> ist 1, wenn <code>#Sig.Lampe_defekt</code> oder <code>#Sig.Gestoert</code> ansteht.<br><code>Main</code> (🔒) ruft die FC für die Signale im DB <code>DB_Signale</code> auf.',
  blocks: () => [
    { name:'UDT_Signal', kind:'UDT', src: UDT_SIG },
    { name:'DB_Signale', kind:'DB', src: kDB('DB_Signale', 'Einfahrt:"UDT_Signal"; Ausfahrt:"UDT_Signal"') },
    { name:'FC_Signalbild', kind:'FC', edit:true, start: sbFC(''), ref: sbFC(SB_BODY) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Einfahrsignal\n=> "FC_Signalbild"(Sig := "DB_Signale".Einfahrt, Gruen => "Einfahrt_Gruen", Meldung => "Einfahrt_Meldung");\n\nNETWORK Ausfahrsignal\n=> "FC_Signalbild"(Sig := "DB_Signale".Ausfahrt, Gruen => "Ausfahrt_Gruen", Meldung => "Ausfahrt_Meldung");') }
  ],
  globals: () => ({ Einfahrt_Gruen:false, Einfahrt_Meldung:false, Ausfahrt_Gruen:false, Ausfahrt_Meldung:false }),
  must:['MEMBER'],
  visible: () => ({ tests:[[{ 'DB_Signale.Einfahrt.Fahrt':true }, { Einfahrt_Gruen:true, Einfahrt_Meldung:false }]] }),
  hidden: () => ({ tests: truth(['DB_Signale.Einfahrt.Fahrt', 'DB_Signale.Einfahrt.Lampe_defekt', 'DB_Signale.Einfahrt.Gestoert'], e => {
      const f = e['DB_Signale.Einfahrt.Fahrt'], l = e['DB_Signale.Einfahrt.Lampe_defekt'], g = e['DB_Signale.Einfahrt.Gestoert'];
      return { Einfahrt_Gruen: f && !l && !g, Einfahrt_Meldung: l || g, Ausfahrt_Gruen:false }; })
    .concat([[{ 'DB_Signale.Ausfahrt.Fahrt':true, 'DB_Signale.Einfahrt.Gestoert':true }, { Ausfahrt_Gruen:true, Ausfahrt_Meldung:false, Einfahrt_Gruen:false, Einfahrt_Meldung:true }]]) }),
  wrong:[
    () => ({ FC_Signalbild: sbFC(SB_BODY.replace(' AND NOT #Sig.Gestoert =>', ' =>')) }),
    () => ({ FC_Signalbild: sbFC(SB_BODY.replace('#Sig.Lampe_defekt OR #Sig.Gestoert', '#Sig.Lampe_defekt AND #Sig.Gestoert')) }),
    () => ({ FC_Signalbild: sbFC('NETWORK Fahrtbegriff\n#Sig.Fahrt => #Gruen;\n\nNETWORK Stoermeldung\n#Sig.Lampe_defekt OR #Sig.Gestoert => #Meldung;') })
  ]
});

const ZL_NW = (m, o) => { o = o || {};
  return 'NETWORK Wagen 1 und 2\n=> ADD("DB_Zug".Laenge[1], "DB_Zug".Laenge[2], "Zuglaenge");\n\nNETWORK Wagen 3\n=> ADD("Zuglaenge", "DB_Zug".Laenge[3], "Zuglaenge");\n\n' +
    (o.skip4 ? '' : 'NETWORK Wagen 4\n=> ADD("Zuglaenge", "DB_Zug".Laenge[4], "Zuglaenge");\n\n') + 'NETWORK Zu lang\n["Zuglaenge" ' + (o.cmp || '>') + ' ' + m + '] => "Zu_lang";'; };
defExamTask({ id:'x_fup_p_zuglaenge', quest:'fup', level:'profi', ch:13, diff:3,
  params:{ M:[80, 100] },
  title:'Zuglänge aus dem Array',
  brief: p => 'Im DB <code>DB_Zug</code> (🔒) stehen die Längen der vier Wagen im Array <code>Laenge : Array[1..4] of Int</code> (Meter). Programmiere in <code>Main</code>:<br><b>NW 1–3:</b> <code>"Zuglaenge"</code> = Summe aller <b>vier</b> Elemente (ADD-Boxen, ohne Bedingung). Das Ergebnis muss im selben Zyklus stimmen.<br><b>NW 4:</b> <code>"Zu_lang"</code> ist 1, wenn <code>"Zuglaenge"</code> <b>grösser als ' + p.M + '</b> ist.',
  blocks: p => [
    { name:'DB_Zug', kind:'DB', src: kDB('DB_Zug', 'Laenge:Array[1..4] of Int|Wagenlängen in m') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(ZL_NW(p.M)) }
  ],
  globals: () => ({ Zuglaenge:0, Zu_lang:false }),
  must:['ARRAY','ADD','CMP'],
  visible: () => ({ tests:[[{ 'DB_Zug.Laenge[1]':20, 'DB_Zug.Laenge[2]':15 }, { Zuglaenge:35, Zu_lang:false }]] }),
  hidden: p => { const L = (a, b, c, d) => ({ 'DB_Zug.Laenge[1]':a, 'DB_Zug.Laenge[2]':b, 'DB_Zug.Laenge[3]':c, 'DB_Zug.Laenge[4]':d });
    return { tests:[
      [L(20, 20, 20, p.M - 60), { Zuglaenge:p.M, Zu_lang:false }],
      [L(20, 20, 20, p.M - 59), { Zuglaenge:p.M + 1, Zu_lang:true }],
      [L(0, 0, 0, p.M + 5), { Zuglaenge:p.M + 5, Zu_lang:true }],
      [L(15, 0, 0, 0), { Zuglaenge:15, Zu_lang:false }],
      [L(0, 30, 25, 0), { Zuglaenge:55, Zu_lang:false }],
      [L(0, 0, 0, 0), { Zuglaenge:0, Zu_lang:false }]
    ] }; },
  wrong:[
    p => ({ Main: MAIN(ZL_NW(p.M, { skip4:true })) }),
    p => ({ Main: MAIN(ZL_NW(p.M, { cmp:'>=' })) })
  ]
});

/* ---------- Kapitel 14: Standardbausteine ---------- */
const ZS_D = { in:'Anf:Bool|Fahrtanforderung; Halt:Bool|Halttaste; Weg_frei:Bool|Fahrweg frei; Lampe_ok:Bool|Lampenüberwachung; Quitt:Bool|Quittiertaste', out:'Fahrt:Bool|Signal zeigt Fahrt; Stoerung:Bool|Lampenstörung gespeichert' };
const ZS_ST = 'NETWORK Lampenstoerung\nNOT #Lampe_ok => RS(#Stoerung, #Quitt);';
const ZS_FA = 'NETWORK Fahrt\n(#Anf OR #Fahrt) AND NOT #Halt AND #Weg_frei AND NOT #Stoerung => #Fahrt;';
const zsFB = body => kFB('FB_Zwergsignal', ZS_D, body);
defExamTask({ id:'x_fup_p_zwergsignal', quest:'fup', level:'profi', ch:14, diff:2,
  title:'Standardbaustein Zwergsignal',
  brief: () => 'Programmiere den Standardbaustein <code>FB_Zwergsignal</code> (Rangiersignal):<br><b>NW 1:</b> Fällt <code>#Lampe_ok</code> auf 0, wird <code>#Stoerung</code> gespeichert. <code>#Quitt</code> setzt zurück; steht die Lampenstörung noch an, bleibt <code>#Stoerung</code> gesetzt (Setzen dominant).<br><b>NW 2:</b> <code>#Anf</code> schaltet <code>#Fahrt</code> ein (Selbsthaltung). <code>#Fahrt</code> fällt ab bei <code>#Halt</code>, wenn <code>#Weg_frei</code> 0 wird oder wenn <code>#Stoerung</code> ansteht.<br><code>Main</code> (🔒) ruft den FB für das Zwergsignal Z12 auf.',
  blocks: () => [
    { name:'FB_Zwergsignal', kind:'FB', edit:true, start: zsFB(''), ref: zsFB(ZS_ST + '\n\n' + ZS_FA) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Zwergsignal Z12\n=> "FB_Zwergsignal_DB"(Anf := "Taste_Z12", Halt := "Halt_Z12", Weg_frei := "Weg_Z12_frei", Lampe_ok := "Lampe_Z12_ok", Quitt := "Quittieren", Fahrt => "Z12_Fahrt", Stoerung => "Z12_Stoerung");') }
  ],
  globals: () => ({ Taste_Z12:false, Halt_Z12:false, Weg_Z12_frei:false, Lampe_Z12_ok:false, Quittieren:false, Z12_Fahrt:false, Z12_Stoerung:false }),
  must:['RS','PARALLEL','NC'],
  visible: () => ({ unit:[{ block:'FB_Zwergsignal', steps:[[0,{ Lampe_ok:true, Weg_frei:true, Anf:true },{ Fahrt:true, Stoerung:false }],[0.1,{ Anf:false },{ Fahrt:true }]] }] }),
  hidden: () => ({
    unit:[{ block:'FB_Zwergsignal', steps:[[0,{ Lampe_ok:true, Weg_frei:true, Anf:true },{ Fahrt:true, Stoerung:false }],[0.1,{ Anf:false },{ Fahrt:true }],[0.1,{ Halt:true },{ Fahrt:false }],[0.1,{ Halt:false },{ Fahrt:false }],[0.1,{ Anf:true },{ Fahrt:true }],
      [0.1,{ Anf:false, Lampe_ok:false },{ Stoerung:true, Fahrt:false }],[0.1,{ Quitt:true },{ Stoerung:true }],[0.1,{ Lampe_ok:true },{ Stoerung:false }],[0.1,{ Quitt:false, Anf:true },{ Fahrt:true }],[0.1,{ Weg_frei:false },{ Fahrt:false }]] }],
    timed:[{ steps:[[0.1,{ Lampe_Z12_ok:true, Weg_Z12_frei:true, Taste_Z12:true },{ Z12_Fahrt:true }],[0.1,{ Taste_Z12:false },{ Z12_Fahrt:true }],[0.1,{ Lampe_Z12_ok:false },{ Z12_Fahrt:false, Z12_Stoerung:true }]] }]
  }),
  wrong:[
    () => ({ FB_Zwergsignal: zsFB(ZS_ST.replace('RS(', 'SR(') + '\n\n' + ZS_FA) }),
    () => ({ FB_Zwergsignal: zsFB(ZS_ST + '\n\n' + ZS_FA.replace('(#Anf OR #Fahrt)', '#Anf')) }),
    () => ({ FB_Zwergsignal: zsFB(ZS_FA + '\n\n' + ZS_ST) })
  ]
});

const BK_D0 = { in:'Einschalt:Bool|Zug meldet sich an; Ausschalt:Bool|Zug hat den Übergang verlassen', out:'Blinklicht:Bool; Glocke:Bool; Schranke_zu:Bool' };
const bkFB = (stat, body) => kFB('FB_BUE_Ost', Object.assign({}, BK_D0, stat ? { stat } : {}), body);
const BK_BODY = (v, o) => { o = o || {};
  return 'NETWORK Anlage ein\n#Einschalt => ' + (o.ff || 'SR') + '(#Blinklicht, #Ausschalt);\n\nNETWORK Glocke\n#Blinklicht AND ' + (o.bell || 'TP') + '(#T_Glocke, T#2S) => #Glocke;\n\nNETWORK Schranke\n#Blinklicht AND ' + (o.bar || 'TON') + '(#T_Vorlauf, T#' + v + 'S) => #Schranke_zu;'; };
const BK_STAT = o => { o = o || {}; return 'T_Glocke:' + (o.bell || 'TP') + '|Läutezeit; T_Vorlauf:' + (o.bar || 'TON') + '|Vorlaufzeit'; };
defExamTask({ id:'x_fup_p_bue_ost', quest:'fup', level:'profi', ch:14, diff:3,
  params:{ V:[3, 4, 5] },
  title:'Standardbaustein Bahnübergang',
  brief: p => 'Programmiere <code>FB_BUE_Ost</code>. Lege die Zeitboxen als Static-Variablen <code>T_Glocke</code> und <code>T_Vorlauf</code> an.<br><b>NW 1:</b> <code>#Einschalt</code> setzt <code>#Blinklicht</code>, <code>#Ausschalt</code> setzt zurück (Rücksetzen dominant).<br><b>NW 2:</b> Mit dem Einschalten des Blinklichts läutet <code>#Glocke</code> genau <b>2 s</b>.<br><b>NW 3:</b> <code>#Schranke_zu</code> wird <b>' + p.V + ' s</b> nach dem Einschalten des Blinklichts 1 und fällt mit dem Blinklicht ab.<br><code>Main</code> (🔒) ruft den FB mit <code>"FB_BUE_Ost_DB"</code> auf.',
  blocks: p => [
    { name:'FB_BUE_Ost', kind:'FB', edit:true, start: bkFB(null, ''), ref: bkFB(BK_STAT(), BK_BODY(p.V)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang Ost\n=> "FB_BUE_Ost_DB"(Einschalt := "ES_Ost", Ausschalt := "AS_Ost", Blinklicht => "BUE_Blink", Glocke => "BUE_Glocke", Schranke_zu => "BUE_Schranke");') }
  ],
  globals: () => ({ ES_Ost:false, AS_Ost:false, BUE_Blink:false, BUE_Glocke:false, BUE_Schranke:false }),
  must:['SR','TP','TON','STAT'],
  visible: () => ({ timed:[{ steps:[[0.1,{ ES_Ost:true },{ BUE_Blink:true, BUE_Glocke:true, BUE_Schranke:false }]] }] }),
  hidden: p => ({
    unit:[
      { block:'FB_BUE_Ost', steps:[[0,{ Einschalt:true },{ Blinklicht:true, Glocke:true, Schranke_zu:false }],[0.5,{ Einschalt:false },{ Blinklicht:true, Glocke:true, Schranke_zu:false }],[1.6,{},{ Glocke:false }],[p.V - 2,{},{ Schranke_zu:true }],[1,{ Ausschalt:true },{ Blinklicht:false, Schranke_zu:false, Glocke:false }],[0.1,{ Ausschalt:false },{ Blinklicht:false }]] },
      { block:'FB_BUE_Ost', steps:[[0,{ Einschalt:true, Ausschalt:true },{ Blinklicht:false }],[0.1,{ Ausschalt:false },{ Blinklicht:true, Glocke:true }],[p.V - 0.5,{},{ Schranke_zu:false }],[0.6,{},{ Schranke_zu:true }]] }
    ],
    timed:[{ steps:[[0.1,{ ES_Ost:true },{ BUE_Blink:true, BUE_Schranke:false }],[p.V + 0.1,{ ES_Ost:false },{ BUE_Schranke:true, BUE_Glocke:false }],[0.1,{ AS_Ost:true },{ BUE_Blink:false, BUE_Schranke:false }]] }]
  }),
  wrong:[
    p => ({ FB_BUE_Ost: bkFB(BK_STAT(), BK_BODY(p.V, { ff:'RS' })) }),
    p => ({ FB_BUE_Ost: bkFB(BK_STAT({ bar:'TOF' }), BK_BODY(p.V, { bar:'TOF' })) }),
    p => ({ FB_BUE_Ost: bkFB(BK_STAT({ bell:'TON' }), BK_BODY(p.V, { bell:'TON' })) })
  ]
});

/* ---------- Kapitel 15: OB1/OB100, Programmierstandard ---------- */
const AN_MAIN = MAIN('NETWORK Anlauf quittieren\n"Quittieren" => R "Anlaufmeldung";\n\nNETWORK Tempo\n["Tempo" > "DB_Betrieb".V_zul] => "Warnung";');
defExamTask({ id:'x_fup_p_anlauf', quest:'fup', level:'profi', ch:15, diff:1, timed:true,
  params:{ V:[40, 60, 80] },
  title:'Anlauf des Stellwerks',
  brief: p => 'Programmiere den Anlauf-OB <code>Startup</code> [OB100], alle Netzwerke <b>ohne Bedingung</b>:<br><b>NW 1:</b> MOVE ' + p.V + ' nach <code>"DB_Betrieb".V_zul</code><br><b>NW 2:</b> S <code>"Anlaufmeldung"</code><br><code>Main</code> (🔒) quittiert die Anlaufmeldung und überwacht das Tempo.',
  blocks: p => [
    { name:'DB_Betrieb', kind:'DB', src: kDB('DB_Betrieb', 'V_zul:Int|km/h zulässig') },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: STARTUP(''), ref: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + p.V + ', "DB_Betrieb".V_zul);\n\nNETWORK Anlaufmeldung\n=> S "Anlaufmeldung";') },
    { name:'Main', kind:'OB', src: AN_MAIN }
  ],
  globals: () => ({ Tempo:0, Quittieren:false, Anlaufmeldung:false, Warnung:false }),
  must:['STARTUP','MOVE'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{ Anlaufmeldung:true, 'DB_Betrieb.V_zul':p.V }]] }] }),
  hidden: p => ({ timed:[
    { steps:[[0.1,{},{ Anlaufmeldung:true, Warnung:false, 'DB_Betrieb.V_zul':p.V }],[0.1,{ Quittieren:true },{ Anlaufmeldung:false }],[0.1,{ Quittieren:false },{ Anlaufmeldung:false }]] },
    { steps:[[0.1,{ Tempo:p.V },{ Warnung:false }],[0.1,{ Tempo:p.V + 1 },{ Warnung:true }],[0.1,{ Tempo:p.V - 5 },{ Warnung:false }]] },
    { steps:[[0.1,{ Tempo:p.V + 1, Quittieren:true },{ Anlaufmeldung:false, Warnung:true }]] }
  ] }),
  wrong:[
    p => ({ Startup: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + p.V + ', "DB_Betrieb".V_zul);') }),
    p => ({ Startup: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + (p.V + 10) + ', "DB_Betrieb".V_zul);\n\nNETWORK Anlaufmeldung\n=> S "Anlaufmeldung";') }),
    p => ({ Startup: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + p.V + ', "DB_Betrieb".V_zul);\n\nNETWORK Anlaufmeldung\n=> R "Anlaufmeldung";') })
  ]
});

const LZ_D = { in:'Laeuft:Bool|Weiche läuft; Quitt:Bool|Quittiertaste', out:'Stoerung:Bool|Laufzeit überschritten' };
const lzFB = (stat, body) => kFB('FB_Laufzeit', Object.assign({}, LZ_D, { stat }), body);
const LZ_STAT = 'T_Lauf:TON|Laufzeitüberwachung';
const LZ_BODY = (t, o) => { o = o || {}; return 'NETWORK Laufzeit\n' + (o.inp || '#Laeuft') + ' AND TON(#T_Lauf, T#' + t + 'S) => ' + (o.ff || 'RS') + '(#Stoerung, ' + (o.q || '#Quitt') + ');'; };
defExamTask({ id:'x_fup_p_standard', quest:'fup', level:'profi', ch:15, diff:2, warnFree:['GLOBAL_ACCESS','UNUSED_VAR'],
  params:{ T:[5, 8] },
  title:'Laufzeitbaustein nach Standard',
  brief: p => '<code>FB_Laufzeit</code> überwacht die Laufzeit von Weiche 2, verletzt aber den Programmierstandard: Er liest globale Variablen direkt und enthält eine unbenutzte Variable. Mach ihn <b>warnungsfrei</b>:<br>• Nur die Schnittstelle benutzen (<code>#Laeuft</code>, <code>#Quitt</code>), keine globalen Zugriffe.<br>• Unbenutzte Variable <code>Reserve</code> löschen.<br>Funktion: Läuft die Weiche länger als <b>' + p.T + ' s</b>, wird <code>#Stoerung</code> gespeichert. <code>#Quitt</code> setzt zurück, die anstehende Störung hat Vorrang (Setzen dominant).',
  blocks: p => [
    { name:'FB_Laufzeit', kind:'FB', edit:true, start: lzFB(LZ_STAT + '; Reserve:Int', LZ_BODY(p.T, { inp:'"W2_laeuft"', q:'"Quittieren"' })), ref: lzFB(LZ_STAT, LZ_BODY(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 2\n=> "FB_Laufzeit_DB"(Laeuft := "W2_laeuft", Quitt := "Quittieren", Stoerung => "W2_Stoerung");') }
  ],
  globals: () => ({ W2_laeuft:false, Quittieren:false, W2_Stoerung:false }),
  must:['TON','RS'],
  visible: p => ({ timed:[{ steps:[[0.1,{ W2_laeuft:true },{ W2_Stoerung:false }],[p.T + 0.1,{},{ W2_Stoerung:true }]] }] }),
  hidden: p => ({
    unit:[{ block:'FB_Laufzeit', steps:[[0,{ Laeuft:true },{ Stoerung:false }],[p.T - 0.5,{},{ Stoerung:false }],[0.6,{},{ Stoerung:true }],[0.1,{ Laeuft:false },{ Stoerung:true }],[0.1,{ Quitt:true },{ Stoerung:false }],[0.1,{ Quitt:false, Laeuft:true },{ Stoerung:false }],[p.T + 0.1,{ Quitt:true },{ Stoerung:true }]] }],
    timed:[{ steps:[[0.1,{ W2_laeuft:true },{ W2_Stoerung:false }],[p.T + 0.1,{},{ W2_Stoerung:true }],[0.1,{ W2_laeuft:false, Quittieren:true },{ W2_Stoerung:false }]] }]
  }),
  wrong:[
    p => ({ FB_Laufzeit: lzFB(LZ_STAT, LZ_BODY(p.T, { q:'"Quittieren"' })) }),
    p => ({ FB_Laufzeit: lzFB(LZ_STAT, LZ_BODY(p.T, { ff:'SR' })) }),
    p => ({ FB_Laufzeit: lzFB(LZ_STAT + '; Reserve:Int', LZ_BODY(p.T)) })
  ]
});

/* =====================================================================
   FRAGEN — GRUNDSTUFE
   ===================================================================== */
const Q = (id, level, ch, q, options, answer) => defExamQuestion({ id, quest:'fup', level, ch, q, options, answer: answer || 0 });

// Kapitel 1
Q('xq_fup_g_und4', 'grund', 1, 'Eine &amp;-Box hat die Eingänge <code>1</code>, <code>1</code>, <code>1</code> und <code>0</code>. Was liefert ihr Ausgang?', ['0', '1', 'Den Wert des letzten Zyklus', 'Einen Fehler, weil eine &amp;-Box nur zwei Eingänge hat']);
Q('xq_fup_g_zyklus', 'grund', 1, 'In welcher Reihenfolge bearbeitet die CPU die Netzwerke eines Bausteins im zyklischen Betrieb?', ['Von oben nach unten, Netzwerk für Netzwerk, in jedem Zyklus', 'Nur die Netzwerke, deren Eingänge sich geändert haben', 'Von unten nach oben', 'Alle Netzwerke gleichzeitig und unabhängig voneinander']);
Q('xq_fup_g_zuweisung', 'grund', 1, 'Wie wird im FUP eine Zuweisung dargestellt?', ['Als Box „=“ am Ende der Verknüpfung, der Operand steht darüber', 'Als Kontakt am Anfang des Netzwerks', 'Als Kommentar im Netzwerktitel', 'Als Zeile in der Variablentabelle']);
Q('xq_fup_g_doppelt', 'grund', 1, 'Zwei Netzwerke schreiben mit je einer Zuweisung auf denselben Operanden <code>Signal_A</code>. Welcher Wert steht am Zyklusende darin?', ['Das Ergebnis des unteren, zuletzt bearbeiteten Netzwerks', 'Die ODER-Verknüpfung beider Ergebnisse', 'Das Ergebnis des oberen Netzwerks', 'Die CPU geht in STOP']);
// Kapitel 2
Q('xq_fup_g_xor', 'grund', 2, 'Wann liefert eine X-Box (XOR) mit zwei Eingängen eine 1?', ['Wenn genau ein Eingang 1 ist', 'Wenn beide Eingänge 1 sind', 'Wenn mindestens ein Eingang 1 ist', 'Wenn beide Eingänge 0 sind']);
Q('xq_fup_g_oder_symbol', 'grund', 2, 'Mit welchem Symbol ist die ODER-Box im FUP beschriftet?', ['&gt;=1', '&amp;', 'X', 'OR']);
Q('xq_fup_g_negation', 'grund', 2, 'Wie wird im FUP ein negierter Eingang einer Box dargestellt?', ['Durch einen kleinen Kreis am Eingang der Box', 'Durch einen Schrägstrich im Operanden', 'Durch eine eigene Box nach jeder Verknüpfung', 'Durch ein Minuszeichen vor dem Operanden']);
Q('xq_fup_g_vorrang_xor', 'grund', 2, 'Wie wird <code>A XOR B AND C</code> ausgewertet (Vorrang wie in TIA/SCL)?', ['A XOR (B AND C)', '(A XOR B) AND C', '(A AND C) XOR B', 'Strikt von links nach rechts ohne Vorrang']);
// Kapitel 3
Q('xq_fup_g_ein_vorrang', 'grund', 3, 'Wie ist eine Selbsthaltung mit <b>Ein-Vorrang</b> aufgebaut?', ['Die Ein-Taste liegt parallel (ODER) zur Kombination aus Rückführung und Aus-Bedingung', 'Die Ein-Taste liegt in Reihe (UND) hinter der Aus-Bedingung', 'Die Ein-Taste liegt an einem negierten Eingang', 'Ohne Rückführung, nur mit der Ein-Taste']);
Q('xq_fup_g_drahtbruch', 'grund', 3, 'Warum wird eine Halt-Taste meist als Öffner angeschlossen und im Programm auf 1 (nicht betätigt) abgefragt?', ['Damit ein Drahtbruch wie ein Halt-Befehl wirkt (drahtbruchsicher)', 'Weil Öffner billiger sind', 'Weil die SPS keine Schliesser lesen kann', 'Damit die Taste schneller reagiert']);
Q('xq_fup_g_verriegelung', 'grund', 3, 'Was verhindert die gegenseitige Verriegelung zweier Antriebsrichtungen (z.B. Weiche links/rechts)?', ['Dass beide Richtungen gleichzeitig angesteuert werden', 'Dass der Antrieb überhaupt anläuft', 'Dass die Selbsthaltung wirkt', 'Dass die Endlage gemeldet wird']);
Q('xq_fup_g_rueckfuehrung', 'grund', 3, 'Die Selbsthaltung <code>(Taste OR Q) AND NOT Stopp => Q</code> ist eingeschaltet. Die Taste wird losgelassen, <code>Stopp</code> bleibt 0. Was geschieht?', ['Q bleibt 1 über die Rückführung', 'Q fällt auf 0', 'Q wechselt in jedem Zyklus', 'Q wird erst nach einem Neustart 0']);
// Kapitel 4
Q('xq_fup_g_sr', 'grund', 4, 'In einer SR-Box liegen S und R gleichzeitig an. Welchen Zustand hat Q?', ['0 – Rücksetzen ist dominant', '1 – Setzen ist dominant', 'Q wechselt jeden Zyklus', 'Q behält den alten Wert']);
Q('xq_fup_g_rs_nur_r', 'grund', 4, 'An einer RS-Box ist nur der Rücksetzeingang R = 1, der Setzeingang S1 ist 0. Welchen Zustand hat Q?', ['0', '1', 'Q behält den alten Wert', 'Q wechselt jeden Zyklus']);
Q('xq_fup_g_s_vs_zuw', 'grund', 4, 'Was unterscheidet eine Setzen-Box (S) von einer Zuweisung (=)?', ['S schreibt nur bei 1 am Eingang und lässt den Operanden bei 0 unverändert; = schreibt in jedem Zyklus', '= speichert den Wert, S nicht', 'Es gibt keinen Unterschied', 'S schreibt nur bei 0 am Eingang']);
Q('xq_fup_g_s_r_netze', 'grund', 4, 'Ein Operand wird in Netzwerk 1 gesetzt (S) und in Netzwerk 2 rückgesetzt (R). Beide Bedingungen sind 1. Welcher Wert steht am Zyklusende im Operanden?', ['0 – das später bearbeitete Netzwerk gewinnt', '1 – Setzen hat immer Vorrang', 'Der Wert des letzten Zyklus', 'Der Compiler meldet einen Fehler']);
// Kapitel 5
Q('xq_fup_g_nbox', 'grund', 5, 'Was liefert die Auswertung einer negativen Flanke (N)?', ['Für genau einen Zyklus 1, wenn das Signal von 1 auf 0 wechselt', 'Dauernd 1, solange das Signal 0 ist', 'Für einen Zyklus 1 beim Wechsel von 0 auf 1', 'Das invertierte Signal']);
Q('xq_fup_g_flankenmerker', 'grund', 5, 'Wozu braucht eine P-Box in TIA einen eigenen Operanden als Flankenmerker?', ['Er speichert den Signalzustand des vorherigen Zyklus', 'Er misst die Zykluszeit', 'Er ist der Ausgang für die Anzeige', 'Er negiert die Flanke']);
Q('xq_fup_g_merker_doppelt', 'grund', 5, 'Warum darf ein Flankenmerker nicht für zwei verschiedene Flankenauswertungen benutzt werden?', ['Die Auswertungen überschreiben sich gegenseitig den gespeicherten Zustand, Flanken gehen verloren', 'Weil nur ein Merker pro Baustein erlaubt ist', 'Weil die Flanken dann doppelt so lang sind', 'Das ist erlaubt und üblich']);
Q('xq_fup_g_toggle_halten', 'grund', 5, 'Ein Stromstossschalter <code>P(Taste) XOR Licht => Licht</code>: Die Taste bleibt 5 Zyklen gedrückt. Wie oft schaltet <code>Licht</code> um?', ['Einmal, im ersten Zyklus', 'Fünfmal', 'Keinmal', 'Zweimal, beim Drücken und beim Loslassen']);
// Kapitel 6
Q('xq_fup_g_tp_nachtrigger', 'grund', 6, 'Eine TP-Box (PT = 2 s) erhält während des laufenden Impulses eine neue steigende Flanke. Was passiert?', ['Nichts, der laufende Impuls wird nicht nachgetriggert', 'Der Impuls beginnt von vorn', 'Der Ausgang fällt sofort ab', 'Die Impulszeit verdoppelt sich']);
Q('xq_fup_g_et', 'grund', 6, 'Welcher Ausgang einer Zeitbox zeigt die bereits abgelaufene Zeit?', ['ET', 'Q', 'PT', 'IN']);
Q('xq_fup_g_tof_dauer', 'grund', 6, 'Eine TOF-Box (PT = 5 s): IN ist seit 10 s ununterbrochen 1. Was liefert Q?', ['1', '0', '1 nur während der ersten 5 s, dann 0', 'Q blinkt im Takt von 5 s']);
Q('xq_fup_g_zeitformat', 'grund', 6, 'Welche Dauer beschreibt die Zeitkonstante <code>T#1M30S</code>?', ['90 Sekunden', '1,3 Sekunden', '130 Sekunden', '1 Millisekunde und 30 Sekunden']);
// Kapitel 7
Q('xq_fup_g_laufzeit_zweck', 'grund', 7, 'Welchen Zweck hat eine Laufzeitüberwachung an einem Weichen- oder Schrankenantrieb?', ['Sie meldet eine Störung, wenn die Endlage nicht innerhalb der erwarteten Zeit erreicht wird', 'Sie begrenzt die Zykluszeit der CPU', 'Sie verzögert das Umstellen des Antriebs', 'Sie zählt die Umstellungen']);
Q('xq_fup_g_vorlaeuten_box', 'grund', 7, 'Beim Vorläuten läutet die Glocke ab der Einschaltung, die Schranke senkt sich erst 4 s später. Welche Box verzögert den Beginn des Senkens?', ['TON', 'TOF', 'TP', 'CTU']);
Q('xq_fup_g_wechsel_lampen', 'grund', 7, 'Wechselblinker: Lampe 1 hängt an <code>Blink</code>, Lampe 2 an <code>NOT Blink</code> (beide nur bei Zugmeldung). Was gilt, solange der Blinker läuft?', ['Immer genau eine der beiden Lampen leuchtet', 'Beide Lampen leuchten gleichzeitig', 'Beide Lampen sind dunkel', 'Lampe 2 leuchtet nur beim Einschalten']);
Q('xq_fup_g_blink_frequenz', 'grund', 7, 'Ein Taktgeber besteht aus einer TON-Box mit negierter Rückführung ihres Ausgangs. Die Blinkfrequenz soll halbiert werden. Was änderst du?', ['Die Zeit PT verdoppeln', 'Die TON-Box durch eine TOF-Box ersetzen', 'Die Negation der Rückführung entfernen', 'Eine zweite Zuweisung anschliessen']);
// Kapitel 8
Q('xq_fup_g_ctu_ueber', 'grund', 8, 'Ein CTU mit PV = 5 steht bei CV = 5. Es kommt ein weiterer Zählimpuls. Was gilt danach?', ['CV = 6, Q bleibt 1', 'CV bleibt 5, Q = 1', 'CV = 0, Q = 0', 'CV = 6, Q = 0']);
Q('xq_fup_g_ctu_r', 'grund', 8, 'Was bewirkt der Eingang R einer CTU-Box?', ['Er setzt den Zählwert CV auf 0', 'Er lädt PV in den Zählwert', 'Er zählt rückwärts', 'Er hält den Zähler an, CV bleibt stehen']);
Q('xq_fup_g_ctd_q', 'grund', 8, 'Wann ist der Ausgang Q einer CTD-Box 1?', ['Wenn CV kleiner oder gleich 0 ist', 'Wenn CV grösser oder gleich PV ist', 'Bei jedem Zählimpuls', 'Solange LD = 1 ist']);
Q('xq_fup_g_achse_einmal', 'grund', 8, 'Ein Rad steht mehrere Zyklen auf dem Radsensor. Warum wird die Achse trotzdem nur einmal gezählt?', ['Die Zählbox zählt nur die steigende Flanke an ihrem Zähleingang', 'Weil der Sensor nur einen Zyklus lang 1 liefert', 'Weil die CPU den Zähler nach jedem Zyklus sperrt', 'Weil PV die Zählung begrenzt']);
// Kapitel 9
Q('xq_fup_g_cmp_le', 'grund', 9, 'Welcher Vergleich liefert 1 für <code>Tempo = 80</code>, aber 0 für <code>Tempo = 81</code>?', ['Tempo &lt;= 80', 'Tempo &lt; 80', 'Tempo &gt;= 80', 'Tempo &lt;&gt; 80']);
Q('xq_fup_g_move_en', 'grund', 9, 'Was macht eine MOVE-Box, wenn ihr Freigabeeingang EN 1 ist?', ['Sie kopiert den Wert von IN nach OUT1', 'Sie addiert IN zu OUT1', 'Sie schreibt 0 nach OUT1', 'Sie vertauscht IN und OUT1']);
Q('xq_fup_g_div_int', 'grund', 9, 'Eine DIV-Box rechnet mit Int: IN1 = 7, IN2 = 2. Was steht in OUT?', ['3', '3,5', '4', '1']);
Q('xq_fup_g_ueberlauf', 'grund', 9, 'Eine Int-Variable steht bei 32767. Eine ADD-Box addiert 1 und schreibt zurück. Was steht danach in der Variable?', ['-32768', '32768', '32767', '0']);
// Kapitel 10
Q('xq_fup_g_fs_ablauf', 'grund', 10, 'In welcher Reihenfolge wird eine Zugfahrstrasse bearbeitet?', ['Einstellen, sichern (festlegen), Signal auf Fahrt, auflösen', 'Signal auf Fahrt, einstellen, sichern, auflösen', 'Auflösen, einstellen, Signal auf Fahrt, sichern', 'Sichern, Signal auf Fahrt, einstellen, auflösen']);
Q('xq_fup_g_zugschluss', 'grund', 10, 'Was bedeutet Zugschlussauflösung einer Fahrstrasse?', ['Sie wird erst aufgelöst, wenn der ganze Zug den Fahrweg verlassen hat', 'Das Signal fällt schon beim Einstellen auf Halt', 'Sie wird nach einer festen Zeit aufgelöst', 'Der Fahrdienstleiter muss sie immer von Hand auflösen']);
Q('xq_fup_g_feindlich', 'grund', 10, 'Wie wird im Programm verhindert, dass zwei feindliche Fahrstrassen gleichzeitig eingestellt werden?', ['Jede Fahrstrasse erhält die negierte Meldung der anderen als Einstellbedingung', 'Beide Fahrstrassen benutzen dieselbe Speicherbox', 'Mit einer TOF-Box an beiden Tasten', 'Mit einer P-Flanke an beiden Tasten']);
Q('xq_fup_g_notaufl', 'grund', 10, 'Die Notauflösetaste einer Fahrstrasse muss einige Sekunden gedrückt bleiben, bevor sie wirkt. Womit wird das umgesetzt?', ['Mit einer TON-Box hinter der Taste', 'Mit einer TP-Box hinter der Taste', 'Mit einer N-Flanke an der Taste', 'Mit einer CTD-Box']);

/* =====================================================================
   FRAGEN — PROFI-STUFE
   ===================================================================== */
// Kapitel 11
Q('xq_fup_p_void', 'profi', 11, 'Welchen Rückgabetyp hat eine FC, die keinen Rückgabewert liefert?', ['Void', 'Bool', 'Int', 'None']);
Q('xq_fup_p_fc_out', 'profi', 11, 'Ein Output einer FC wird nur in manchen Fällen beschrieben. Was ist das Risiko?', ['Der Output kann einen undefinierten Wert liefern, weil eine FC kein Gedächtnis hat', 'Die CPU geht sofort in STOP', 'Der Output behält sicher den Wert des letzten Aufrufs', 'Kein Risiko, Outputs sind automatisch 0']);
Q('xq_fup_p_fc_versorgen', 'profi', 11, 'Welche Parameter müssen an der Aufruf-Box einer FC versorgt werden?', ['Alle Formalparameter (Input, Output, InOut)', 'Nur die Inputs', 'Nur die Outputs', 'Keine, nicht versorgte Parameter werden 0']);
Q('xq_fup_p_formal', 'profi', 11, 'Was unterscheidet einen Formalparameter von einem Aktualparameter?', ['Der Formalparameter steht in der Schnittstelle, der Aktualparameter ist das beim Aufruf angeschlossene Signal', 'Formalparameter sind global, Aktualparameter lokal', 'Aktualparameter gibt es nur bei FBs', 'Beide Begriffe bedeuten dasselbe']);
Q('xq_fup_p_temp_zweck', 'profi', 11, 'In welchem Bereich der Schnittstelle deklarierst du ein Zwischenergebnis, das nur während eines Aufrufs gebraucht wird?', ['Temp', 'Static', 'InOut', 'Constant']);
Q('xq_fup_p_fc_nutzen', 'profi', 11, 'Warum lohnt es sich, gleiche Logik (z.B. für mehrere Signale) in eine FC zu packen und mehrfach aufzurufen?', ['Die Logik existiert nur einmal, eine Änderung wirkt an allen Aufrufstellen', 'Weil der OB1 sonst zu wenige Netzwerke hat', 'Weil eine FC schneller rechnet als ein Netzwerk im OB1', 'Weil globale Variablen im OB1 verboten sind']);
// Kapitel 12
Q('xq_fup_p_multi', 'profi', 12, 'Was ist eine Multiinstanz?', ['Eine FB-Instanz, die in den statischen Daten eines anderen FB liegt', 'Ein FB, der mehrere OBs aufruft', 'Eine FC mit mehreren Rückgabewerten', 'Ein Datenbaustein mit mehreren Arrays']);
Q('xq_fup_p_stat_ort', 'profi', 12, 'Wo speichert ein FB bei einem Einzelaufruf seine statischen Variablen?', ['Im zugehörigen Instanz-DB', 'Im Temp-Bereich', 'Im OB1', 'In einem globalen Merker']);
Q('xq_fup_p_input_offen', 'profi', 12, 'Ein Input eines FB wird beim Aufruf nicht versorgt. Welchen Wert verwendet der FB?', ['Den im Instanz-DB gespeicherten Wert (zuletzt übergeben oder Startwert)', 'Immer 0', 'Einen Zufallswert', 'Der Aufruf wird übersprungen']);
Q('xq_fup_p_multi_vorteil', 'profi', 12, 'Welchen Vorteil hat es, wenn die Timer eines FB als Multiinstanzen in seinem Static-Bereich liegen?', ['Jede Instanz des FB bringt automatisch ihre eigenen Timer mit', 'Die Timer laufen genauer', 'Der FB braucht dann keinen Instanz-DB mehr', 'Alle Instanzen teilen sich dieselben Timer']);
Q('xq_fup_p_fb_out_alt', 'profi', 12, 'Ein Output eines FB wird in einem Aufruf nicht beschrieben. Welchen Wert liefert er?', ['Den Wert aus dem vorherigen Aufruf, er ist im Instanz-DB gespeichert', 'Immer 0', 'Einen undefinierten Wert', 'Den Wert des ersten Inputs']);
Q('xq_fup_p_bedingt', 'profi', 12, 'Warum soll ein FB mit Timern nicht nur unter einer Bedingung aufgerufen werden?', ['Ohne Aufruf werden die Timer nicht bearbeitet und die Ausgänge bleiben auf dem alten Stand', 'Weil bedingte Aufrufe in FUP verboten sind', 'Weil sonst der Instanz-DB gelöscht wird', 'Weil Timer nur im OB100 laufen']);
// Kapitel 13
Q('xq_fup_p_db_arten', 'profi', 13, 'Was unterscheidet einen globalen DB von einem Instanz-DB?', ['Der globale DB wird frei angelegt und ist für alle Bausteine; der Instanz-DB gehört zu einem FB und hat dessen Schnittstelle', 'Ein globaler DB verliert seine Werte nach jedem Zyklus', 'Ein Instanz-DB kann nur Bool speichern', 'Es gibt keinen Unterschied']);
Q('xq_fup_p_array_zugriff', 'profi', 13, 'Wie greifst du im FUP auf das dritte Element des Arrays <code>Laenge</code> im DB <code>DB_Zug</code> zu?', ['<code>"DB_Zug".Laenge[3]</code>', '<code>DB_Zug.Laenge(3)</code>', '<code>"Laenge"[3].DB_Zug</code>', '<code>#Laenge.3</code>']);
Q('xq_fup_p_array_anzahl', 'profi', 13, 'Wie viele Elemente hat <code>Array[0..7] of Bool</code>?', ['8', '7', '9', '6']);
Q('xq_fup_p_udt_aendern', 'profi', 13, 'In einem PLC-Datentyp wird ein Element ergänzt. Was ist die Folge?', ['Alle Variablen dieses Typs erhalten das Element; die verwendenden Bausteine werden neu übersetzt', 'Nur neu angelegte Variablen erhalten das Element', 'Alle bestehenden Variablen dieses Typs werden gelöscht', 'Nichts, bestehende Variablen behalten ihre alte Struktur für immer']);
Q('xq_fup_p_struct_udt', 'profi', 13, 'Was unterscheidet ein STRUCT von einem PLC-Datentyp (UDT)?', ['Ein UDT ist ein benannter, wiederverwendbarer Typ; ein STRUCT wird direkt an einer Stelle definiert', 'Ein STRUCT darf nur Bool enthalten', 'Ein UDT darf keine Arrays enthalten', 'Es gibt keinen Unterschied']);
Q('xq_fup_p_startwert', 'profi', 13, 'Welche Bedeutung hat der Startwert einer Variable in einem globalen DB?', ['Diesen Wert erhält die Variable beim Laden bzw. Initialisieren des DB', 'Auf diesen Wert wird die Variable nach jedem Zyklus zurückgesetzt', 'Er ist der grösste erlaubte Wert', 'Er gilt nur in der Simulation']);
// Kapitel 14
Q('xq_fup_p_std_merkmal', 'profi', 14, 'Was zeichnet einen guten Standardbaustein (z.B. für eine Weiche) aus?', ['Er arbeitet nur über seine Schnittstelle, ohne direkte Zugriffe auf globale Variablen', 'Er liest möglichst viele globale Signale selbst', 'Er enthält die Logik aller Weichen in einem Netzwerk', 'Er hat keine Outputs']);
Q('xq_fup_p_fuenf_bue', 'profi', 14, 'Ein Bahnübergangs-FB soll für fünf Bahnübergänge eingesetzt werden. Was braucht es?', ['Fünf Instanzen des FB (Instanz-DBs oder Multiinstanzen)', 'Fünf Kopien des FB mit anderen Namen', 'Eine Instanz, die fünfmal pro Zyklus aufgerufen wird', 'Fünf FCs']);
Q('xq_fup_p_laufzeit_fb', 'profi', 14, 'Warum gehört die Laufzeitüberwachung einer Weiche in den Weichen-FB und nicht in den OB1?', ['Sie gehört zu jeder Weiche; jede Instanz überwacht so automatisch ihre eigene Laufzeit', 'Weil Timer im OB1 verboten sind', 'Weil der OB1 keine Netzwerke enthalten darf', 'Weil der OB1 nur einmal läuft']);
Q('xq_fup_p_output_weiter', 'profi', 14, 'Der Output <code>Fahrt</code> eines Signal-FB wird in einem anderen Baustein gebraucht. Welche Lösung ist sauber?', ['Den Output beim Aufruf auf eine Variable schalten und diese dem anderen Baustein als Input übergeben', 'Im anderen Baustein auf eine Temp-Variable des Signal-FB zugreifen', 'Den Signal-FB im anderen Baustein mit derselben Instanz ein zweites Mal aufrufen', 'Den Output im Signal-FB zusätzlich direkt auf eine globale Variable schreiben']);
Q('xq_fup_p_bue_typ', 'profi', 14, 'Welcher Bausteintyp eignet sich für eine Bahnübergangssteuerung mit Vorläutzeit und gespeicherter Einschaltung?', ['FB, weil Timer und Zustände zwischen den Zyklen erhalten bleiben müssen', 'FC, weil sie kein Gedächtnis braucht', 'OB100', 'Globaler DB']);
Q('xq_fup_p_stoer_antrieb', 'profi', 14, 'Ein Weichen-FB speichert eine Laufzeitstörung. Warum schaltet er bei Störung auch die Antriebsausgänge ab?', ['Damit der Motor nicht dauernd gegen eine blockierte Weiche läuft', 'Damit die Störung schneller quittiert werden kann', 'Weil sonst die CPU in STOP geht', 'Damit der Instanz-DB kleiner wird']);
// Kapitel 15
Q('xq_fup_p_ob1_wann', 'profi', 15, 'Wann wird der OB1 (Program cycle) bearbeitet?', ['Nach dem Anlauf immer wieder, Zyklus für Zyklus', 'Nur einmal beim Anlauf', 'Nur bei einem Fehler', 'Nur wenn sich ein Eingang ändert']);
Q('xq_fup_p_ob100_inhalt', 'profi', 15, 'Was gehört typischerweise in den Anlauf-OB (OB100, Startup)?', ['Initialisierungen wie Grundstellungen und Startwerte', 'Die zyklische Signalsteuerung', 'Die Laufzeitüberwachung der Weichen', 'Das Zählen der Achsen']);
Q('xq_fup_p_signalfluss', 'profi', 15, 'Warum sollen die Bausteine im OB1 in der Reihenfolge des Signalflusses aufgerufen werden?', ['Damit Ergebnisse im selben Zyklus weiterverarbeitet werden und nicht einen Zyklus zu spät ankommen', 'Weil der Compiler sonst einen Fehler meldet', 'Damit der OB100 schneller läuft', 'Die Reihenfolge spielt keine Rolle']);
Q('xq_fup_p_standard_team', 'profi', 15, 'Welchen Sinn hat ein Programmierstandard in einem Team?', ['Einheitliche Namen, Struktur und Kommentare, damit andere das Programm schnell verstehen und warten können', 'Möglichst kurze Variablennamen', 'Jeder pflegt seinen eigenen Stil', 'Möglichst alles in einem einzigen Netzwerk']);
Q('xq_fup_p_kennzeichen', 'profi', 15, 'Wie werden im Editor lokale und globale Variablen gekennzeichnet?', ['Lokale mit #, globale in Anführungszeichen', 'Lokale in Anführungszeichen, globale mit #', 'Beide mit %', 'Lokale mit $, globale mit #']);
Q('xq_fup_p_titel', 'profi', 15, 'Warum ist ein aussagekräftiger Netzwerktitel wichtig?', ['Er dokumentiert die Funktion des Netzwerks und erleichtert Fehlersuche und Wartung', 'Er legt die Ausführungsreihenfolge fest', 'Ohne Titel wird das Netzwerk nicht bearbeitet', 'Er bestimmt die Zykluszeit']);
})();

/* ==== content_awl/exam.js ==== */
/* ===== AWL QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Walzwerk), nicht aus dem Spiel. AWL wird zeilentreu nach SCL übersetzt (awl.js). */
(function(){
const seq = steps => [{ steps }];
// alle Kombinationen boolescher Eingänge → [[setup, expect], …]
const combos = (names, fn, fixed) => {
  const out = [];
  for(let m = 0; m < (1 << names.length); m++){
    const e = Object.assign({}, fixed || {});
    names.forEach((n, i) => { e[n] = !!(m & (1 << (names.length - 1 - i))); });
    out.push([e, fn(e)]);
  }
  return out;
};
// Flankenfolge simulieren: Eingangswerte → Schritte [dt, inputs, expect]
const edgeSteps = (inp, out, vals, rising) => { let prev = false; return vals.map(v => { const q = rising ? (v && !prev) : (!v && prev); prev = v; return [0.1, { [inp]: v }, { [out]: q }]; }); };

/* =====================================================================
   Grundstufe (Kapitel 1–10)
   ===================================================================== */

// ---- Kapitel 1 ----
defExamTask({ id:'x_awl_g_hydraulik', quest:'awl', level:'grund', ch:1, diff:1,
  params:{ N:[1, 2, 3] },
  title:'Hydraulikaggregat bereit',
  brief: p => 'Das Hydraulikaggregat ' + p.N + ' ist <b>bereit</b>, wenn <code>Pumpe_' + p.N + '</code> UND <code>Oel_OK_' + p.N + '</code> UND <code>Filter_OK_' + p.N + '</code> 1 sind. Weise das Ergebnis <code>Bereit_' + p.N + '</code> zu und zeige es zusätzlich an der Lampe <code>Lampe_' + p.N + '</code> an.',
  vars: p => ({ ['Pumpe_' + p.N]:false, ['Oel_OK_' + p.N]:false, ['Filter_OK_' + p.N]:false, ['Bereit_' + p.N]:false, ['Lampe_' + p.N]:false }),
  start: () => '// Hydraulik bereit\n',
  ref: p => 'U  Pumpe_' + p.N + '\nU  Oel_OK_' + p.N + '\nU  Filter_OK_' + p.N + '\n=  Bereit_' + p.N + '\n=  Lampe_' + p.N,
  must:['U', 'ASSIGN'],
  visible: p => [[{ ['Pumpe_' + p.N]:true, ['Oel_OK_' + p.N]:true, ['Filter_OK_' + p.N]:true }, { ['Bereit_' + p.N]:true, ['Lampe_' + p.N]:true }], [{ ['Pumpe_' + p.N]:true }, { ['Bereit_' + p.N]:false }]],
  hidden: p => combos(['Pumpe_' + p.N, 'Oel_OK_' + p.N, 'Filter_OK_' + p.N], e => { const q = e['Pumpe_' + p.N] && e['Oel_OK_' + p.N] && e['Filter_OK_' + p.N]; return { ['Bereit_' + p.N]:q, ['Lampe_' + p.N]:q }; }, { ['Bereit_' + p.N]:true, ['Lampe_' + p.N]:true }),
  wrong:[
    p => 'U  Pumpe_' + p.N + '\nU  Oel_OK_' + p.N + '\nO  Filter_OK_' + p.N + '\n=  Bereit_' + p.N + '\n=  Lampe_' + p.N,
    p => 'U  Pumpe_' + p.N + '\nU  Filter_OK_' + p.N + '\n=  Bereit_' + p.N + '\n=  Lampe_' + p.N,
    p => 'U  Pumpe_' + p.N + '\nU  Oel_OK_' + p.N + '\nU  Filter_OK_' + p.N + '\n=  Bereit_' + p.N
  ]
});

// ---- Kapitel 2 ----
defExamTask({ id:'x_awl_g_hand_auto', quest:'awl', level:'grund', ch:2, diff:2,
  params:{ N:[1, 2] },
  title:'Rollgang: Hand oder Automatik',
  brief: p => '<code>Rollgang_' + p.N + '</code> läuft, wenn<br>• im <b>Handbetrieb</b> (<code>Automatik</code> = 0) der Taster <code>S_Hand</code> gedrückt ist, <b>oder</b><br>• im <b>Automatikbetrieb</b> (<code>Automatik</code> = 1) der Befehl <code>Auto_Befehl</code> ansteht.<br>Verknüpfe die beiden UND-Gruppen mit <code>O</code> (ohne Operand) oder mit Klammern.',
  vars: p => ({ S_Hand:false, Auto_Befehl:false, Automatik:false, ['Rollgang_' + p.N]:false }),
  start: () => '// Hand oder Automatik\n',
  ref: p => 'U  S_Hand\nUN Automatik\nO\nU  Auto_Befehl\nU  Automatik\n=  Rollgang_' + p.N,
  visible: p => [[{ S_Hand:true }, { ['Rollgang_' + p.N]:true }], [{ Automatik:true, Auto_Befehl:true }, { ['Rollgang_' + p.N]:true }]],
  hidden: p => combos(['S_Hand', 'Auto_Befehl', 'Automatik'], e => ({ ['Rollgang_' + p.N]: (e.S_Hand && !e.Automatik) || (e.Auto_Befehl && e.Automatik) })),
  wrong:[
    p => 'U  S_Hand\nUN Automatik\nU  Auto_Befehl\nU  Automatik\n=  Rollgang_' + p.N,
    p => 'U  S_Hand\nU  Automatik\nO\nU  Auto_Befehl\nUN Automatik\n=  Rollgang_' + p.N,
    p => 'O  S_Hand\nO  Auto_Befehl\n=  Rollgang_' + p.N
  ]
});

// ---- Kapitel 3 ----
defExamTask({ id:'x_awl_g_pumpe', quest:'awl', level:'grund', ch:3, diff:1, timed:true,
  title:'Kühlwasserpumpe speichern',
  brief: () => '<code>S_Ein</code> <b>setzt</b> die <code>Pumpe</code>, <code>S_Aus</code> oder ein fehlender Wasserdruck (<code>Druck_OK</code> = 0) <b>setzen sie zurück</b>. Rücksetzen hat Vorrang (steht zuletzt).',
  vars: () => ({ S_Ein:false, S_Aus:false, Druck_OK:true, Pumpe:false }),
  start: () => '// Kühlwasserpumpe\n',
  ref: () => 'U  S_Ein\nS  Pumpe\nO  S_Aus\nON Druck_OK\nR  Pumpe',
  must:['S', 'R'],
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

defExamTask({ id:'x_awl_g_luefter', quest:'awl', level:'grund', ch:3, diff:2, timed:true,
  title:'Motorlüfter mit Selbsthaltung',
  brief: () => 'Der <code>Luefter</code> des Walzmotors startet mit <code>S_Ein</code> und hält sich selbst. Er geht aus, wenn <code>S_Aus</code> gedrückt ist oder der Motorschutz auslöst (<code>Motorschutz_OK</code> = 0). <b>Aus hat Vorrang.</b><br>Die Lampe <code>Luefter_steht</code> zeigt das Gegenteil von <code>Luefter</code> an (verwende <code>NOT</code>).',
  vars: () => ({ S_Ein:false, S_Aus:false, Motorschutz_OK:true, Luefter:false, Luefter_steht:false }),
  start: () => '// Motorlüfter\n',
  ref: () => 'U(\nO  S_Ein\nO  Luefter\n)\nUN S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\nNOT\n=  Luefter_steht',
  must:['KLAMMER', 'NOT'],
  visible: () => seq([[0.1,{S_Ein:true},{Luefter:true, Luefter_steht:false}],[0.1,{S_Ein:false},{Luefter:true}],[0.1,{S_Aus:true},{Luefter:false, Luefter_steht:true}]]),
  hidden: () => [
    { steps:[[0.1,{},{Luefter:false, Luefter_steht:true}],[0.1,{S_Ein:true},{Luefter:true, Luefter_steht:false}],[0.1,{S_Ein:false},{Luefter:true}],[0.1,{S_Aus:true},{Luefter:false, Luefter_steht:true}],[0.1,{S_Aus:false},{Luefter:false}]] },
    { steps:[[0.1,{S_Ein:true, S_Aus:true},{Luefter:false, Luefter_steht:true}],[0.1,{S_Aus:false},{Luefter:true}],[0.1,{S_Ein:false},{Luefter:true, Luefter_steht:false}]] },
    { steps:[[0.1,{S_Ein:true},{Luefter:true}],[0.1,{S_Ein:false, Motorschutz_OK:false},{Luefter:false, Luefter_steht:true}],[0.1,{Motorschutz_OK:true},{Luefter:false}]] }
  ],
  wrong:[
    () => 'O  S_Ein\nO  Luefter\nUN S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\nNOT\n=  Luefter_steht',
    () => 'U(\nO  S_Ein\nO  Luefter\n)\nU  S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\nNOT\n=  Luefter_steht',
    () => 'U(\nO  S_Ein\nO  Luefter\n)\nUN S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\n=  Luefter_steht'
  ]
});

// ---- Kapitel 4 ----
defExamTask({ id:'x_awl_g_schnittimpuls', quest:'awl', level:'grund', ch:4, diff:1, timed:true,
  params:{ EDGE:['steigende', 'fallende'] },
  title:'Schnittimpuls an der Schere',
  brief: p => 'Die Lichtschranke <code>Block_an_Schere</code> meldet einen Block. <code>Schnitt_Impuls</code> soll bei der <b>' + p.EDGE + 'n Flanke</b> dieses Signals für genau einen Zyklus 1 sein. Flankenmerker: <code>M_Schere</code>.',
  vars: () => ({ Block_an_Schere:false, M_Schere:false, Schnitt_Impuls:false }),
  start: () => '// Schnittimpuls\n',
  ref: p => 'U  Block_an_Schere\n' + (p.EDGE === 'steigende' ? 'FP' : 'FN') + ' M_Schere\n=  Schnitt_Impuls',
  must: [],
  visible: p => seq(edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [true, true, false], p.EDGE === 'steigende')),
  hidden: p => [
    { steps: edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [true, true, false, false, true, false], p.EDGE === 'steigende') },
    { steps: edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [false, true, false, true, true], p.EDGE === 'steigende') },
    { steps: edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [true, false, true, false], p.EDGE === 'steigende') }
  ],
  wrong:[
    () => 'U  Block_an_Schere\n=  Schnitt_Impuls',
    p => 'U  Block_an_Schere\n' + (p.EDGE === 'steigende' ? 'FN' : 'FP') + ' M_Schere\n=  Schnitt_Impuls'
  ]
});

defExamTask({ id:'x_awl_g_wasseralarm', quest:'awl', level:'grund', ch:4, diff:2, timed:true,
  title:'Alarm bei Wasserverlust',
  brief: () => 'Fällt das Signal <code>Wasser_OK</code> von 1 auf 0, wird die <code>Hupe</code> <b>gesetzt</b> (Flanke, Merker <code>M_Wasser</code>). <code>Quittieren</code> setzt die Hupe zurück (Rücksetzen zuletzt). Die Hupe darf erst beim <b>nächsten</b> Wasserverlust wieder angehen.<br><code>Lampe_Rot</code> leuchtet, solange <code>Wasser_OK</code> = 0 ist.',
  vars: () => ({ Wasser_OK:true, Quittieren:false, M_Wasser:false, Hupe:false, Lampe_Rot:false }),
  start: () => '// Wasseralarm\n',
  ref: () => 'U  Wasser_OK\nFN M_Wasser\nS  Hupe\nU  Quittieren\nR  Hupe\nUN Wasser_OK\n=  Lampe_Rot',
  must:['FN', 'S', 'R'],
  visible: () => seq([[0.1,{Wasser_OK:true},{Hupe:false}],[0.1,{Wasser_OK:false},{Hupe:true, Lampe_Rot:true}],[0.1,{Quittieren:true},{Hupe:false}]]),
  hidden: () => [
    { steps:[[0.1,{Wasser_OK:true},{Hupe:false, Lampe_Rot:false}],[0.1,{Wasser_OK:false},{Hupe:true, Lampe_Rot:true}],[0.1,{},{Hupe:true}],[0.1,{Quittieren:true},{Hupe:false, Lampe_Rot:true}],[0.1,{Quittieren:false},{Hupe:false, Lampe_Rot:true}],[0.1,{Wasser_OK:true},{Hupe:false, Lampe_Rot:false}],[0.1,{Wasser_OK:false},{Hupe:true}]] },
    { steps:[[0.1,{Wasser_OK:true, Quittieren:true},{Hupe:false}],[0.1,{Wasser_OK:false},{Hupe:false, Lampe_Rot:true}],[0.1,{Quittieren:false},{Hupe:false}]] },
    { steps:[[0.1,{Wasser_OK:true},{}],[0.1,{Wasser_OK:false},{Hupe:true}],[0.1,{Wasser_OK:true},{Hupe:true, Lampe_Rot:false}],[0.1,{Quittieren:true},{Hupe:false}]] }
  ],
  wrong:[
    () => 'UN Wasser_OK\nS  Hupe\nU  Quittieren\nR  Hupe\nUN Wasser_OK\n=  Lampe_Rot',
    () => 'U  Wasser_OK\nFP M_Wasser\nS  Hupe\nU  Quittieren\nR  Hupe\nUN Wasser_OK\n=  Lampe_Rot',
    () => 'U  Quittieren\nR  Hupe\nU  Wasser_OK\nFN M_Wasser\nS  Hupe\nUN Wasser_OK\n=  Lampe_Rot'
  ]
});

// ---- Kapitel 5 ----
defExamTask({ id:'x_awl_g_druck_stabil', quest:'awl', level:'grund', ch:5, diff:1, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Hydraulikdruck stabil',
  brief: p => '<code>Druck_stabil</code> wird 1, wenn <code>Druck_OK</code> seit <b>' + p.T + ' s</b> ununterbrochen ansteht (Einschaltverzögerung mit Zeit <code>T1</code>). Fällt <code>Druck_OK</code> ab, wird <code>Druck_stabil</code> sofort 0.<br>Während der Wartezeit (<code>Druck_OK</code> = 1, Zeit noch nicht abgelaufen) leuchtet <code>Lampe_Gelb</code>.',
  vars: () => ({ Druck_OK:false, Druck_stabil:false, Lampe_Gelb:false }),
  start: () => '// Druck stabil\n',
  ref: p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSE T1\nU  T1\n=  Druck_stabil\nU  Druck_OK\nUN T1\n=  Lampe_Gelb',
  must:['SE', 'S5T'],
  visible: p => seq([[0,{Druck_OK:true},{Druck_stabil:false, Lampe_Gelb:true}],[p.T + 0.1,{},{Druck_stabil:true, Lampe_Gelb:false}]]),
  hidden: p => [
    { steps:[[0,{Druck_OK:true},{Druck_stabil:false, Lampe_Gelb:true}],[p.T - 0.2,{},{Druck_stabil:false, Lampe_Gelb:true}],[0.3,{},{Druck_stabil:true, Lampe_Gelb:false}],[0.1,{Druck_OK:false},{Druck_stabil:false, Lampe_Gelb:false}]] },
    { steps:[[0,{Druck_OK:true},{Druck_stabil:false}],[p.T - 0.5,{Druck_OK:false},{Druck_stabil:false, Lampe_Gelb:false}],[0.1,{Druck_OK:true},{Druck_stabil:false, Lampe_Gelb:true}],[p.T - 0.3,{},{Druck_stabil:false}],[0.4,{},{Druck_stabil:true}]] },
    { steps:[[0,{},{Druck_stabil:false, Lampe_Gelb:false}],[p.T + 1,{},{Druck_stabil:false, Lampe_Gelb:false}]] }
  ],
  wrong:[
    p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSA T1\nU  T1\n=  Druck_stabil\nU  Druck_OK\nUN T1\n=  Lampe_Gelb',
    p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSV T1\nU  T1\n=  Druck_stabil\nU  Druck_OK\nUN T1\n=  Lampe_Gelb',
    p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSE T1\nU  T1\n=  Druck_stabil\nUN T1\n=  Lampe_Gelb'
  ]
});

defExamTask({ id:'x_awl_g_absaugung', quest:'awl', level:'grund', ch:5, diff:2, timed:true,
  params:{ T:[3, 5, 6] },
  title:'Absaugung mit Nachlauf',
  brief: p => 'Die <code>Absaugung</code> über der Schere läuft, solange <code>Schere_aktiv</code> = 1 ist, und danach noch <b>' + p.T + ' s</b> weiter (Ausschaltverzögerung mit Zeit <code>T2</code>).<br>Zusätzlich kann sie mit dem Taster <code>S_Hand</code> direkt eingeschaltet werden (solange er gedrückt ist).',
  vars: () => ({ Schere_aktiv:false, S_Hand:false, Absaugung:false }),
  start: () => '// Absaugung\n',
  ref: p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSA T2\nU  T2\nO  S_Hand\n=  Absaugung',
  must:['SA'],
  visible: p => seq([[0,{Schere_aktiv:true},{Absaugung:true}],[0.1,{Schere_aktiv:false},{Absaugung:true}],[p.T + 0.2,{},{Absaugung:false}]]),
  hidden: p => [
    { steps:[[0,{Schere_aktiv:true},{Absaugung:true}],[1,{Schere_aktiv:false},{Absaugung:true}],[p.T - 0.3,{},{Absaugung:true}],[0.5,{},{Absaugung:false}]] },
    { steps:[[0,{Schere_aktiv:true},{Absaugung:true}],[0.1,{Schere_aktiv:false},{Absaugung:true}],[p.T - 1,{Schere_aktiv:true},{Absaugung:true}],[0.1,{Schere_aktiv:false},{Absaugung:true}],[p.T - 0.5,{},{Absaugung:true}],[0.7,{},{Absaugung:false}]] },
    { steps:[[0,{S_Hand:true},{Absaugung:true}],[0.1,{S_Hand:false},{Absaugung:false}],[0.1,{},{Absaugung:false}]] }
  ],
  wrong:[
    p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\nO  S_Hand\n=  Absaugung',
    p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSV T2\nU  T2\nO  S_Hand\n=  Absaugung',
    p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSA T2\nU  T2\n=  Absaugung'
  ]
});

defExamTask({ id:'x_awl_g_ofentuer', quest:'awl', level:'grund', ch:5, diff:3, timed:true,
  params:{ T:[4, 5], H:[1, 2] },
  title:'Ofentür überwachen',
  brief: p => 'Zwei Zeiten für die Ofentür (<code>Tuer_offen</code> = 1: Tür offen):<br>• Beim Öffnen tönt die <code>Hupe</code> <b>' + p.H + ' s</b> lang – auch wenn die Tür vorher wieder zugeht (verlängerter Impuls, Zeit <code>T1</code>).<br>• Ist die Tür länger als <b>' + p.T + ' s</b> ununterbrochen offen, wird <code>Stoerung</code> <b>gesetzt</b> (Zeit <code>T2</code>). <code>Quittieren</code> setzt <code>Stoerung</code> zurück (zuletzt).',
  vars: () => ({ Tuer_offen:false, Quittieren:false, Hupe:false, Stoerung:false }),
  start: () => '// Ofentür\n',
  ref: p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSV T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\nS  Stoerung\nU  Quittieren\nR  Stoerung',
  must:['SV', 'SE', 'S', 'R'],
  visible: p => seq([[0,{Tuer_offen:true},{Hupe:true, Stoerung:false}],[p.H + 0.1,{},{Hupe:false, Stoerung:false}],[p.T - p.H,{},{Stoerung:true}]]),
  hidden: p => [
    { steps:[[0,{Tuer_offen:true},{Hupe:true, Stoerung:false}],[p.H - 0.2,{},{Hupe:true}],[0.3,{},{Hupe:false, Stoerung:false}],[p.T - p.H - 0.2,{},{Stoerung:false}],[0.3,{},{Stoerung:true}],[0.1,{Tuer_offen:false},{Stoerung:true, Hupe:false}],[0.1,{Quittieren:true},{Stoerung:false}],[0.1,{Quittieren:false},{Stoerung:false}]] },
    { steps:[[0,{Tuer_offen:true},{Hupe:true}],[0.3,{Tuer_offen:false},{Hupe:true}],[p.H - 0.5,{},{Hupe:true}],[0.4,{},{Hupe:false, Stoerung:false}]] },
    { steps:[[0,{Tuer_offen:true},{}],[p.T - 0.5,{Tuer_offen:false},{Stoerung:false}],[0.1,{Tuer_offen:true},{Stoerung:false}],[p.T - 0.3,{},{Stoerung:false}],[0.5,{},{Stoerung:true}]] }
  ],
  wrong:[
    p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSI T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\nS  Stoerung\nU  Quittieren\nR  Stoerung',
    p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSV T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSA T2\nU  T2\nS  Stoerung\nU  Quittieren\nR  Stoerung',
    p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSV T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\n=  Stoerung'
  ]
});

// ---- Kapitel 6 ----
defExamTask({ id:'x_awl_g_schnitte', quest:'awl', level:'grund', ch:6, diff:1, timed:true,
  title:'Schnitte bis zum Messerwechsel',
  brief: () => 'Zähle mit Zähler <code>Z1</code> jeden Schnitt (steigende Flanke von <code>Schere_unten</code>) vorwärts. <code>S_Messer_neu</code> setzt den Zähler auf 0 zurück. Schreibe den Zählwert nach <code>Schnitte</code>.<br><code>Messer_benutzt</code> ist 1, solange der Zählwert nicht 0 ist.',
  vars: () => ({ Schere_unten:false, S_Messer_neu:false, Schnitte:0, Messer_benutzt:false }),
  start: () => '// Schnittzähler\n',
  ref: () => 'U  Schere_unten\nZV Z1\nU  S_Messer_neu\nR  Z1\nL  Z1\nT  Schnitte\nU  Z1\n=  Messer_benutzt',
  must:['ZV', 'ZRESET'],
  visible: () => seq([[0.1,{Schere_unten:true},{Schnitte:1, Messer_benutzt:true}],[0.1,{Schere_unten:false},{Schnitte:1}],[0.1,{Schere_unten:true},{Schnitte:2}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schnitte:0, Messer_benutzt:false}],[0.1,{Schere_unten:true},{Schnitte:1, Messer_benutzt:true}],[0.1,{},{Schnitte:1}],[0.1,{Schere_unten:false},{Schnitte:1}],[0.1,{Schere_unten:true},{Schnitte:2}],[0.1,{Schere_unten:false, S_Messer_neu:true},{Schnitte:0, Messer_benutzt:false}],[0.1,{S_Messer_neu:false},{Schnitte:0}]] },
    { steps:[[0.1,{Schere_unten:true},{Schnitte:1}],[0.1,{Schere_unten:false},{}],[0.1,{Schere_unten:true},{Schnitte:2}],[0.1,{Schere_unten:false},{}],[0.1,{Schere_unten:true},{Schnitte:3, Messer_benutzt:true}]] },
    { steps:[[0.1,{Schere_unten:true, S_Messer_neu:true},{Schnitte:0}],[0.1,{S_Messer_neu:false},{Schnitte:0, Messer_benutzt:false}],[0.1,{Schere_unten:false},{Schnitte:0}],[0.1,{Schere_unten:true},{Schnitte:1}]] }
  ],
  wrong:[
    () => 'U  Schere_unten\nZR Z1\nU  S_Messer_neu\nR  Z1\nL  Z1\nT  Schnitte\nU  Z1\n=  Messer_benutzt',
    () => 'U  Schere_unten\nZV Z1\nL  Z1\nT  Schnitte\nU  Z1\n=  Messer_benutzt',
    () => 'U  Schere_unten\nZV Z1\nU  S_Messer_neu\nR  Z1\nL  Z1\nT  Schnitte\nUN Z1\n=  Messer_benutzt'
  ]
});

defExamTask({ id:'x_awl_g_kuehlbett', quest:'awl', level:'grund', ch:6, diff:2, timed:true,
  params:{ N:[4, 6, 8] },
  title:'Freie Plätze auf dem Kühlbett',
  brief: p => 'Das Kühlbett hat <b>' + p.N + '</b> Plätze. Zähler <code>Z3</code> zählt die freien Plätze:<br>• <code>S_Leer</code> setzt den Zähler auf <b>' + p.N + '</b>.<br>• Jeder Block, der aufgelegt wird (<code>Block_auf</code>), zählt <b>rückwärts</b>.<br>• Jeder Block, der abgenommen wird (<code>Block_ab</code>), zählt <b>vorwärts</b>.<br>Schreibe den Zählwert nach <code>Frei</code>. <code>Voll</code> ist 1, wenn der Zählwert 0 ist.',
  vars: () => ({ S_Leer:false, Block_auf:false, Block_ab:false, Frei:0, Voll:false }),
  start: () => '// Kühlbett\n',
  ref: p => 'U  S_Leer\nL  ' + p.N + '\nS  Z3\nU  Block_auf\nZR Z3\nU  Block_ab\nZV Z3\nL  Z3\nT  Frei\nUN Z3\n=  Voll',
  must:['ZS', 'ZR', 'ZV'],
  visible: p => seq([[0.1,{S_Leer:true},{Frei:p.N, Voll:false}],[0.1,{S_Leer:false, Block_auf:true},{Frei:p.N - 1}]]),
  hidden: p => {
    const fill = [[0.1,{S_Leer:true},{Frei:p.N}],[0.1,{S_Leer:false},{}]];
    for(let i = p.N - 1; i >= 0; i--){ fill.push([0.1,{Block_auf:true},{Frei:i, Voll:i === 0}]); fill.push([0.1,{Block_auf:false},{}]); }
    fill.push([0.1,{Block_auf:true},{Frei:0, Voll:true}]);
    return [
      { steps:[[0.1,{S_Leer:true},{Frei:p.N, Voll:false}],[0.1,{S_Leer:false},{Frei:p.N}],[0.1,{Block_auf:true},{Frei:p.N - 1}],[0.1,{Block_auf:false},{Frei:p.N - 1}],[0.1,{Block_auf:true},{Frei:p.N - 2}],[0.1,{Block_auf:false, Block_ab:true},{Frei:p.N - 1}],[0.1,{Block_ab:false},{Frei:p.N - 1, Voll:false}]] },
      { steps: fill },
      { steps:[[0.1,{},{Frei:0, Voll:true}],[0.1,{Block_ab:true},{Frei:1, Voll:false}]] }
    ];
  },
  wrong:[
    p => 'U  S_Leer\nL  ' + p.N + '\nS  Z3\nU  Block_auf\nZV Z3\nU  Block_ab\nZR Z3\nL  Z3\nT  Frei\nUN Z3\n=  Voll',
    p => 'U  S_Leer\nL  ' + p.N + '\nS  Z3\nU  Block_auf\nZR Z3\nU  Block_ab\nZV Z3\nL  Z3\nT  Frei\nU  Z3\n=  Voll',
    () => 'U  Block_auf\nZR Z3\nU  Block_ab\nZV Z3\nL  Z3\nT  Frei\nUN Z3\n=  Voll'
  ]
});

// ---- Kapitel 7 ----
defExamTask({ id:'x_awl_g_spaltdiff', quest:'awl', level:'grund', ch:7, diff:1,
  params:{ SOLL:[10, 12, 15] },
  title:'Spaltdifferenz mit TAK',
  brief: p => 'Lade zuerst <code>Spalt_oben</code>, dann <code>Spalt_unten</code>. Tausche die Akkus mit <code>TAK</code> und berechne so <code>Differenz</code> = <code>Spalt_unten</code> − <code>Spalt_oben</code> (<code>-I</code> rechnet AKKU2 − AKKU1).<br>Schreibe danach den Sollwert <b>' + p.SOLL + '</b> nach <code>Spalt_Soll</code>.',
  vars: () => ({ Spalt_oben:0, Spalt_unten:0, Differenz:0, Spalt_Soll:0 }),
  start: () => '// Spaltdifferenz\n',
  ref: p => 'L  Spalt_oben\nL  Spalt_unten\nTAK\n-I\nT  Differenz\nL  ' + p.SOLL + '\nT  Spalt_Soll',
  must:['TAK', 'L', 'T'],
  visible: p => [[{ Spalt_oben:12, Spalt_unten:15 }, { Differenz:3, Spalt_Soll:p.SOLL }]],
  hidden: p => [[{ Spalt_oben:20, Spalt_unten:26 }, { Differenz:6, Spalt_Soll:p.SOLL }], [{ Spalt_oben:30, Spalt_unten:21 }, { Differenz:-9 }], [{ Spalt_oben:8, Spalt_unten:8 }, { Differenz:0, Spalt_Soll:p.SOLL }], [{ Spalt_oben:0, Spalt_unten:45 }, { Differenz:45 }], [{ Spalt_oben:100, Spalt_unten:1, Differenz:7 }, { Differenz:-99 }], [{ Spalt_oben:14, Spalt_unten:17, Spalt_Soll:99 }, { Differenz:3, Spalt_Soll:p.SOLL }]],
  wrong:[
    p => 'L  Spalt_oben\nL  Spalt_unten\n-I\nT  Differenz\nL  ' + p.SOLL + '\nT  Spalt_Soll',
    () => 'L  Spalt_oben\nL  Spalt_unten\nTAK\n-I\nT  Differenz'
  ]
});

// ---- Kapitel 8 ----
defExamTask({ id:'x_awl_g_walzlaenge', quest:'awl', level:'grund', ch:8, diff:2,
  params:{ V:[1, 2, 3] },
  title:'Länge nach dem Stich',
  brief: p => 'Beim Walzen bleibt das Volumen gleich. Berechne (alles Int):<br><code>Laenge_aus</code> = <code>Laenge_ein</code> · <code>Dicke_ein</code> / <code>Dicke_aus</code> − <b>' + p.V + '</b> (Schopfverlust in m).<br>Achtung: <code>/I</code> schneidet Nachkommastellen ab – multipliziere <b>vor</b> dem Dividieren.',
  vars: () => ({ Laenge_ein:0, Dicke_ein:0, Dicke_aus:0, Laenge_aus:0 }),
  start: () => '// Walzlänge\n',
  ref: p => 'L  Laenge_ein\nL  Dicke_ein\n*I\nL  Dicke_aus\n/I\nL  ' + p.V + '\n-I\nT  Laenge_aus',
  must:['*I', '/I', '-I'],
  visible: p => [[{ Laenge_ein:12, Dicke_ein:150, Dicke_aus:100 }, { Laenge_aus:18 - p.V }]],
  hidden: p => [[{ Laenge_ein:10, Dicke_ein:125, Dicke_aus:40 }, { Laenge_aus:31 - p.V }], [{ Laenge_ein:7, Dicke_ein:90, Dicke_aus:60 }, { Laenge_aus:10 - p.V }], [{ Laenge_ein:20, Dicke_ein:200, Dicke_aus:200 }, { Laenge_aus:20 - p.V }], [{ Laenge_ein:15, Dicke_ein:110, Dicke_aus:70 }, { Laenge_aus:23 - p.V }], [{ Laenge_ein:5, Dicke_ein:300, Dicke_aus:120 }, { Laenge_aus:12 - p.V }], [{ Laenge_ein:8, Dicke_ein:180, Dicke_aus:45 }, { Laenge_aus:32 - p.V }]],
  wrong:[
    p => 'L  Dicke_ein\nL  Dicke_aus\n/I\nL  Laenge_ein\n*I\nL  ' + p.V + '\n-I\nT  Laenge_aus',
    p => 'L  Laenge_ein\nL  Dicke_ein\n*I\nL  Dicke_aus\n/I\nL  ' + p.V + '\n+I\nT  Laenge_aus',
    () => 'L  Laenge_ein\nL  Dicke_ein\n*I\nL  Dicke_aus\n/I\nT  Laenge_aus'
  ]
});

defExamTask({ id:'x_awl_g_fahrenheit', quest:'awl', level:'grund', ch:8, diff:3,
  title:'Ofentemperatur in Fahrenheit',
  brief: () => 'Ein Kunde möchte die Ofentemperatur in °F. Berechne aus <code>Temp_C</code> (Int):<br><code>Temp_F</code> = <code>Temp_C</code> · 1,8 + 32, <b>kaufmännisch gerundet</b> auf eine ganze Zahl (Int).<br>Rechne mit REAL (<code>ITD</code>, <code>DTR</code>, <code>*R</code>, <code>+R</code>) und runde mit <code>RND</code>.',
  vars: () => ({ Temp_C:0, Temp_F:0 }),
  start: () => '// Fahrenheit\n',
  ref: () => 'L  Temp_C\nITD\nDTR\nL  1.8\n*R\nL  32.0\n+R\nRND\nT  Temp_F',
  must:['DTR', '*R', 'RND'],
  visible: () => [[{ Temp_C:1000 }, { Temp_F:1832 }], [{ Temp_C:25 }, { Temp_F:77 }]],
  hidden: () => [[{ Temp_C:1182 }, { Temp_F:2160 }], [{ Temp_C:1203 }, { Temp_F:2197 }], [{ Temp_C:1187 }, { Temp_F:2169 }], [{ Temp_C:0 }, { Temp_F:32 }], [{ Temp_C:-40 }, { Temp_F:-40 }], [{ Temp_C:1111 }, { Temp_F:2032 }], [{ Temp_C:13 }, { Temp_F:55 }]],
  wrong:[
    () => 'L  Temp_C\nITD\nDTR\nL  1.8\n*R\nL  32.0\n+R\nTRUNC\nT  Temp_F',
    () => 'L  Temp_C\nL  18\n*I\nL  10\n/I\nL  32\n+I\nT  Temp_F',
    () => 'L  Temp_C\nITD\nDTR\nL  32.0\n+R\nL  1.8\n*R\nRND\nT  Temp_F'
  ]
});

// ---- Kapitel 9 ----
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

defExamTask({ id:'x_awl_g_kuehlpumpe', quest:'awl', level:'grund', ch:9, diff:3, timed:true,
  params:{ LO:[30, 35], HI:[45, 50] },
  title:'Kühlpumpe mit zwei Grenzen',
  brief: p => 'Zweipunktregelung für das Kühlwasser (<code>Wasser_Temp</code> in °C, Int):<br>• Ab <b>' + p.HI + ' °C</b> (≥) wird die <code>Pumpe</code> <b>gesetzt</b>.<br>• Ab <b>' + p.LO + ' °C</b> abwärts (≤) wird sie <b>zurückgesetzt</b>.<br>• Dazwischen bleibt sie, wie sie ist.<br>• <code>Stoerung</code> = 1 setzt die Pumpe immer zurück (hat Vorrang).',
  vars: () => ({ Wasser_Temp:20, Stoerung:false, Pumpe:false }),
  start: () => '// Kühlpumpe\n',
  ref: p => 'L  Wasser_Temp\nL  ' + p.HI + '\n>=I\nS  Pumpe\nL  Wasser_Temp\nL  ' + p.LO + '\n<=I\nR  Pumpe\nU  Stoerung\nR  Pumpe',
  must:['CMP_I', 'S', 'R'],
  visible: p => seq([[0.1,{Wasser_Temp:p.HI + 3},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO + 2},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO - 3},{Pumpe:false}]]),
  hidden: p => [
    { steps:[[0.1,{Wasser_Temp:p.LO + 5},{Pumpe:false}],[0.1,{Wasser_Temp:p.HI - 1},{Pumpe:false}],[0.1,{Wasser_Temp:p.HI},{Pumpe:true}],[0.1,{Wasser_Temp:p.HI - 1},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO + 1},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO},{Pumpe:false}],[0.1,{Wasser_Temp:p.LO + 1},{Pumpe:false}]] },
    { steps:[[0.1,{Wasser_Temp:p.HI + 5},{Pumpe:true}],[0.1,{Stoerung:true},{Pumpe:false}],[0.1,{Stoerung:false},{Pumpe:true}]] },
    { steps:[[0.1,{Wasser_Temp:p.LO - 5},{Pumpe:false}],[0.1,{Wasser_Temp:p.HI + 1},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO - 1},{Pumpe:false}]] }
  ],
  wrong:[
    p => 'L  Wasser_Temp\nL  ' + p.HI + '\n>I\nS  Pumpe\nL  Wasser_Temp\nL  ' + p.LO + '\n<I\nR  Pumpe\nU  Stoerung\nR  Pumpe',
    p => 'L  Wasser_Temp\nL  ' + p.HI + '\n>=I\n=  Pumpe\nU  Stoerung\nR  Pumpe',
    p => 'U  Stoerung\nR  Pumpe\nL  Wasser_Temp\nL  ' + p.HI + '\n>=I\nS  Pumpe\nL  Wasser_Temp\nL  ' + p.LO + '\n<=I\nR  Pumpe'
  ]
});

// ---- Kapitel 10 ----
defExamTask({ id:'x_awl_g_spaltwahl', quest:'awl', level:'grund', ch:10, diff:2,
  params:{ K:[1, 2, 3] },
  title:'Sollspalt von Hand oder aus dem Stichplan',
  brief: p => 'Verzweige mit Sprüngen:<br>• <code>Hand</code> = 1: <code>Spalt_Soll</code> := <code>Spalt_Hand</code>.<br>• <code>Hand</code> = 0: <code>Spalt_Soll</code> := <code>Spalt_Auto</code> + <b>' + p.K + '</b> (Korrektur).<br>Verwende <code>SPB</code> oder <code>SPBN</code> und <code>SPA</code> mit Sprungmarken.',
  vars: () => ({ Hand:false, Spalt_Hand:0, Spalt_Auto:0, Spalt_Soll:0 }),
  start: () => '// Sollspalt\n',
  ref: p => 'U  Hand\nSPB HAND\nL  Spalt_Auto\nL  ' + p.K + '\n+I\nT  Spalt_Soll\nSPA ENDE\nHAND: L  Spalt_Hand\nT  Spalt_Soll\nENDE: NOP 0',
  must:['JUMP', 'LABEL'],
  visible: p => [[{ Hand:true, Spalt_Hand:20, Spalt_Auto:30 }, { Spalt_Soll:20 }], [{ Spalt_Hand:20, Spalt_Auto:30 }, { Spalt_Soll:30 + p.K }]],
  hidden: p => [[{ Hand:true, Spalt_Hand:14, Spalt_Auto:50 }, { Spalt_Soll:14 }], [{ Hand:false, Spalt_Hand:14, Spalt_Auto:50 }, { Spalt_Soll:50 + p.K }], [{ Hand:true, Spalt_Hand:0, Spalt_Auto:9, Spalt_Soll:77 }, { Spalt_Soll:0 }], [{ Spalt_Hand:8, Spalt_Auto:0, Spalt_Soll:77 }, { Spalt_Soll:p.K }], [{ Hand:true, Spalt_Hand:95, Spalt_Auto:95 }, { Spalt_Soll:95 }], [{ Spalt_Hand:40, Spalt_Auto:12 }, { Spalt_Soll:12 + p.K }]],
  wrong:[
    p => 'U  Hand\nSPBN HAND\nL  Spalt_Auto\nL  ' + p.K + '\n+I\nT  Spalt_Soll\nSPA ENDE\nHAND: L  Spalt_Hand\nT  Spalt_Soll\nENDE: NOP 0',
    p => 'U  Hand\nSPB HAND\nL  Spalt_Auto\nL  ' + p.K + '\n+I\nT  Spalt_Soll\nHAND: L  Spalt_Hand\nT  Spalt_Soll',
    () => 'U  Hand\nSPB HAND\nL  Spalt_Auto\nT  Spalt_Soll\nSPA ENDE\nHAND: L  Spalt_Hand\nT  Spalt_Soll\nENDE: NOP 0'
  ]
});

const stiche = (s, n) => { for(let i = 0; i < n; i++) s = Math.trunc(s * 9 / 10); return s; };
defExamTask({ id:'x_awl_g_stiche', quest:'awl', level:'grund', ch:10, diff:3,
  params:{ N:[3, 4, 5] },
  title:'Spalt nach mehreren Stichen',
  brief: p => 'Jeder Stich verringert den Walzspalt auf 90 %: <code>Spalt</code> := <code>Spalt</code> · 9 / 10 (Int, <code>/I</code> schneidet ab).<br>Berechne mit einer <code>LOOP</code>-Schleife den Spalt nach <b>' + p.N + '</b> Stichen: Starte mit <code>Spalt_Start</code>, Ergebnis nach <code>Spalt_End</code>. Den Schleifenzähler sicherst du in <code>Zaehler</code>.',
  vars: () => ({ Spalt_Start:0, Spalt_End:0, Zaehler:0 }),
  start: () => '// Stiche\n',
  ref: p => 'L  Spalt_Start\nT  Spalt_End\nL  ' + p.N + '\nNEXT: T  Zaehler\nL  Spalt_End\nL  9\n*I\nL  10\n/I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT',
  must:['LOOP', 'LABEL'],
  visible: p => [[{ Spalt_Start:100 }, { Spalt_End:stiche(100, p.N) }]],
  hidden: p => [250, 37, 10, 0, 3000, 1234].map(s => [{ Spalt_Start:s, Spalt_End:5 }, { Spalt_End:stiche(s, p.N) }]),
  wrong:[
    p => 'L  Spalt_Start\nT  Spalt_End\nL  ' + (p.N + 1) + '\nNEXT: T  Zaehler\nL  Spalt_End\nL  9\n*I\nL  10\n/I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT',
    p => 'L  ' + p.N + '\nNEXT: T  Zaehler\nL  Spalt_Start\nL  9\n*I\nL  10\n/I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT',
    p => 'L  Spalt_Start\nT  Spalt_End\nL  ' + p.N + '\nNEXT: T  Zaehler\nL  Spalt_End\nL  10\n/I\nL  9\n*I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT'
  ]
});

/* =====================================================================
   Profi-Stufe (Kapitel 11–15)
   ===================================================================== */
const MAIN = body => aOB('Main', body);

// ---- Kapitel 11 ----
const MIN_D = { in:'A:Int|Wert 1; B:Int|Wert 2' };
defExamTask({ id:'x_awl_p_minimum', quest:'awl', level:'profi', ch:11, diff:1,
  title:'Kleinster Walzspalt (FC)',
  brief: () => 'Programmiere die Funktion <code>FC_Min</code> mit Rückgabewert (Int): Sie liefert den <b>kleineren</b> der beiden Eingänge <code>#A</code> und <code>#B</code>. Den Rückgabewert schreibst du mit <code>T #RET_VAL</code>. Der OB <code>Main</code> (🔒) bestimmt den kleineren Walzspalt der beiden Gerüste.',
  blocks: () => [
    { name:'FC_Min', kind:'FC', edit:true, start: aFC('FC_Min', 'Int', MIN_D, ''), ref: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n<I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Min"\n   A := "Spalt_1"\n   B := "Spalt_2"\n   RET_VAL := "Spalt_Min"') }
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

const ABW_D = { in:'Soll:Int|mm; Ist:Int|mm', out:'Diff:Int|Ist − Soll; Ausser_Tol:Bool|Abweichung zu gross' };
const ABW_BODY = (tol, cmpHi, cmpLo, sub) => (sub || 'L  #Ist\nL  #Soll\n-I') + '\nT  #Diff\nO(\nL  #Diff\nL  ' + tol + '\n' + (cmpHi || '>I') + '\n)\nO(\nL  #Diff\nL  -' + tol + '\n' + (cmpLo || '<I') + '\n)\n=  #Ausser_Tol';
defExamTask({ id:'x_awl_p_abweichung', quest:'awl', level:'profi', ch:11, diff:2,
  params:{ TOL:[2, 3, 5] },
  title:'Spaltabweichung (FC)',
  brief: p => 'Programmiere <code>FC_Abweichung</code> (ohne Rückgabewert):<br>• <code>#Diff</code> = <code>#Ist</code> − <code>#Soll</code><br>• <code>#Ausser_Tol</code> = 1, wenn <code>#Diff</code> grösser als <b>' + p.TOL + '</b> oder kleiner als <b>−' + p.TOL + '</b> ist (genau ±' + p.TOL + ' ist noch in Ordnung).<br><code>Main</code> (🔒) ruft die Funktion für den Walzspalt auf.',
  blocks: p => [
    { name:'FC_Abweichung', kind:'FC', edit:true, start: aFC('FC_Abweichung', 'Void', ABW_D, ''), ref: aFC('FC_Abweichung', 'Void', ABW_D, ABW_BODY(p.TOL)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Abweichung"\n   Soll := "Spalt_Soll"\n   Ist := "Spalt_Ist"\n   Diff => "Spalt_Diff"\n   Ausser_Tol => "Lampe_Gelb"') }
  ],
  globals: () => ({ Spalt_Soll:0, Spalt_Ist:0, Spalt_Diff:0, Lampe_Gelb:false }),
  must:['CMP_I', '-I'],
  visible: p => ({ tests:[[{ Spalt_Soll:20, Spalt_Ist:21 }, { Spalt_Diff:1, Lampe_Gelb:false }], [{ Spalt_Soll:20, Spalt_Ist:30 }, { Spalt_Diff:10, Lampe_Gelb:true }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Abweichung', steps:[[{ Soll:10, Ist:10 }, { Diff:0, Ausser_Tol:false }], [{ Soll:10, Ist:10 + p.TOL }, { Diff:p.TOL, Ausser_Tol:false }], [{ Soll:10, Ist:11 + p.TOL }, { Diff:p.TOL + 1, Ausser_Tol:true }], [{ Soll:40, Ist:40 - p.TOL }, { Diff:-p.TOL, Ausser_Tol:false }], [{ Soll:40, Ist:39 - p.TOL }, { Diff:-p.TOL - 1, Ausser_Tol:true }], [{ Soll:0, Ist:-20 }, { Diff:-20, Ausser_Tol:true }]] }],
    tests:[[{ Spalt_Soll:15, Spalt_Ist:14 }, { Spalt_Diff:-1, Lampe_Gelb:false }], [{ Spalt_Soll:15, Spalt_Ist:2 }, { Spalt_Diff:-13, Lampe_Gelb:true }]]
  }),
  wrong:[
    p => ({ FC_Abweichung: aFC('FC_Abweichung', 'Void', ABW_D, ABW_BODY(p.TOL, '>=I', '<=I')) }),
    p => ({ FC_Abweichung: aFC('FC_Abweichung', 'Void', ABW_D, 'L  #Ist\nL  #Soll\n-I\nT  #Diff\nL  #Diff\nL  ' + p.TOL + '\n>I\n=  #Ausser_Tol') }),
    p => ({ FC_Abweichung: aFC('FC_Abweichung', 'Void', ABW_D, ABW_BODY(p.TOL, null, null, 'L  #Soll\nL  #Ist\n-I')) })
  ]
});

const KL_D = { in:'Dicke:Int|mm' };
const KL_BODY = (g1, g2, c1, zero) => 'L  0\nT  #RET_VAL\n' + (zero === false ? '' : 'L  #Dicke\nL  0\n<=I\nBEB\n') + 'L  1\nT  #RET_VAL\nL  #Dicke\nL  ' + g1 + '\n' + (c1 || '<I') + '\nBEB\nL  2\nT  #RET_VAL\nL  #Dicke\nL  ' + g2 + '\n' + (c1 || '<I') + '\nBEB\nL  3\nT  #RET_VAL';
defExamTask({ id:'x_awl_p_dickenklasse', quest:'awl', level:'profi', ch:11, diff:3,
  params:{ G1:[20, 25], G2:[40, 50] },
  title:'Dickenklasse (FC mit RET_VAL)',
  brief: p => 'Programmiere <code>FC_Klasse</code> (Rückgabewert Int). Sie ordnet die Blechdicke <code>#Dicke</code> einer Klasse zu:<br>• <code>#Dicke</code> ≤ 0 → <b>0</b> (Messfehler)<br>• 1 … ' + (p.G1 - 1) + ' → <b>1</b><br>• ' + p.G1 + ' … ' + (p.G2 - 1) + ' → <b>2</b><br>• ab ' + p.G2 + ' → <b>3</b><br>Tipp: Rückgabewert vorbelegen und mit <code>BEB</code> vorzeitig beenden – oder mit Sprüngen arbeiten.',
  blocks: p => [
    { name:'FC_Klasse', kind:'FC', edit:true, start: aFC('FC_Klasse', 'Int', KL_D, ''), ref: aFC('FC_Klasse', 'Int', KL_D, KL_BODY(p.G1, p.G2)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Klasse"\n   Dicke := "Dicke"\n   RET_VAL := "Klasse"') }
  ],
  globals: () => ({ Dicke:0, Klasse:0 }),
  must:['CMP_I', 'RETVAL'],
  visible: p => ({ tests:[[{ Dicke:p.G1 + 5 }, { Klasse:2 }], [{ Dicke:5 }, { Klasse:1 }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Klasse', steps:[[{ Dicke:-5 }, { RET:0 }], [{ Dicke:0 }, { RET:0 }], [{ Dicke:1 }, { RET:1 }], [{ Dicke:p.G1 - 1 }, { RET:1 }], [{ Dicke:p.G1 }, { RET:2 }], [{ Dicke:p.G2 - 1 }, { RET:2 }], [{ Dicke:p.G2 }, { RET:3 }], [{ Dicke:300 }, { RET:3 }]] }],
    tests:[[{ Dicke:p.G2 + 10 }, { Klasse:3 }], [{ Dicke:0, Klasse:9 }, { Klasse:0 }]]
  }),
  wrong:[
    p => ({ FC_Klasse: aFC('FC_Klasse', 'Int', KL_D, KL_BODY(p.G1, p.G2, '<=I')) }),
    p => ({ FC_Klasse: aFC('FC_Klasse', 'Int', KL_D, KL_BODY(p.G1, p.G2, null, false)) }),
    p => ({ FC_Klasse: aFC('FC_Klasse', 'Int', KL_D, 'L  1\nT  #RET_VAL\nL  #Dicke\nL  ' + p.G1 + '\n<I\nBEB\nL  2\nT  #RET_VAL\nL  #Dicke\nL  ' + p.G2 + '\n<I\nBEB\nL  3\nT  #RET_VAL') })
  ]
});

// ---- Kapitel 12 ----
const LI_D = { in:'Taster:Bool', out:'Licht:Bool', stat:'M_Flanke:Bool|Flankenmerker' };
defExamTask({ id:'x_awl_p_licht', quest:'awl', level:'profi', ch:12, diff:1,
  title:'Stromstoss-Licht als FB',
  brief: () => 'Programmiere <code>FB_Licht</code>: Jeder Druck auf <code>#Taster</code> (steigende Flanke) schaltet <code>#Licht</code> um – ein, aus, ein … Den Flankenmerker <code>#M_Flanke</code> gibt es schon als statische Variable.<br><code>Main</code> (🔒) ruft den FB für die Halle und den Keller mit je einer eigenen Instanz auf.',
  blocks: () => [
    { name:'FB_Licht', kind:'FB', edit:true, start: aFB('FB_Licht', LI_D, ''), ref: aFB('FB_Licht', LI_D, 'U  #Taster\nFP #M_Flanke\nX  #Licht\n=  #Licht') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Halle\nCALL "FB_Licht", "Halle_DB"\n   Taster := "S_Halle"\n   Licht => "Licht_Halle"\n\nNETWORK Keller\nCALL "FB_Licht", "Keller_DB"\n   Taster := "S_Keller"\n   Licht => "Licht_Keller"') }
  ],
  globals: () => ({ S_Halle:false, S_Keller:false, Licht_Halle:false, Licht_Keller:false }),
  instances: () => ({ Halle_DB:'FB_Licht', Keller_DB:'FB_Licht' }),
  must:['FP'],
  visible: () => ({ timed:[{ steps:[[0.1,{ S_Halle:true },{ Licht_Halle:true }],[0.1,{ S_Halle:false },{ Licht_Halle:true }]] }] }),
  hidden: () => ({
    unit:[{ block:'FB_Licht', steps:[[0.1,{ Taster:true },{ Licht:true }],[0.1,{},{ Licht:true }],[0.1,{ Taster:false },{ Licht:true }],[0.1,{ Taster:true },{ Licht:false }],[0.1,{},{ Licht:false }],[0.1,{ Taster:false },{ Licht:false }]] }],
    timed:[{ steps:[[0.1,{ S_Halle:true },{ Licht_Halle:true, Licht_Keller:false }],[0.1,{ S_Halle:false, S_Keller:true },{ Licht_Halle:true, Licht_Keller:true }],[0.1,{ S_Keller:false, S_Halle:true },{ Licht_Halle:false, Licht_Keller:true }]] }]
  }),
  wrong:[
    () => ({ FB_Licht: aFB('FB_Licht', LI_D, 'U  #Taster\nX  #Licht\n=  #Licht') }),
    () => ({ FB_Licht: aFB('FB_Licht', LI_D, 'U  #Taster\nFP #M_Flanke\n=  #Licht') })
  ]
});

const AN_D = t => ({ in:'Start:Bool|Befehl', out:'Hupe:Bool|Anlaufwarnung; Motor:Bool', stat:'T_Warn:' + (t || 'TON') });
const AN_BODY = (T, hupe) => 'CALL #T_Warn\n   IN := #Start\n   PT := T#' + T + 'S\n' + (hupe || 'U  #Start\nUN #T_Warn.Q\n=  #Hupe') + '\nU  #T_Warn.Q\n=  #Motor';
defExamTask({ id:'x_awl_p_anlauf', quest:'awl', level:'profi', ch:12, diff:2,
  params:{ T:[2, 3] },
  title:'Anlaufwarnung mit IEC-Zeit',
  brief: p => 'Programmiere <code>FB_Anlauf</code> mit der Multiinstanz <code>#T_Warn</code> (TON, schon deklariert):<br>• Solange <code>#Start</code> = 1 ist, läuft die Zeit (<b>' + p.T + ' s</b>).<br>• Während der Wartezeit ertönt <code>#Hupe</code>.<br>• Nach Ablauf läuft <code>#Motor</code>, die Hupe ist aus.<br>• <code>#Start</code> = 0 schaltet alles sofort ab.<br>Aufruf: <code>CALL #T_Warn</code> mit <code>IN :=</code> und <code>PT := T#' + p.T + 'S</code>, Abfrage mit <code>#T_Warn.Q</code>.',
  blocks: p => [
    { name:'FB_Anlauf', kind:'FB', edit:true, start: aFB('FB_Anlauf', AN_D(), ''), ref: aFB('FB_Anlauf', AN_D(), AN_BODY(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Anlauf", "FB_Anlauf_DB"\n   Start := "Befehl_Rollgang"\n   Hupe => "Hupe"\n   Motor => "Rollgang"') }
  ],
  globals: () => ({ Befehl_Rollgang:false, Hupe:false, Rollgang:false }),
  must:['CALL', 'TON'],
  visible: p => ({ timed:[{ steps:[[0,{ Befehl_Rollgang:true },{ Hupe:true, Rollgang:false }],[p.T + 0.1,{},{ Hupe:false, Rollgang:true }]] }] }),
  hidden: p => ({
    timed:[
      { steps:[[0,{ Befehl_Rollgang:true },{ Hupe:true, Rollgang:false }],[p.T - 0.2,{},{ Hupe:true, Rollgang:false }],[0.3,{},{ Hupe:false, Rollgang:true }],[0.1,{ Befehl_Rollgang:false },{ Hupe:false, Rollgang:false }]] },
      { steps:[[0,{ Befehl_Rollgang:true },{ Hupe:true }],[p.T - 0.5,{ Befehl_Rollgang:false },{ Hupe:false, Rollgang:false }],[0.1,{ Befehl_Rollgang:true },{ Hupe:true }],[p.T - 0.3,{},{ Rollgang:false }],[0.5,{},{ Rollgang:true, Hupe:false }]] },
      { steps:[[0,{},{ Hupe:false, Rollgang:false }],[p.T + 1,{},{ Hupe:false, Rollgang:false }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Anlauf: aFB('FB_Anlauf', AN_D('TP'), AN_BODY(p.T)) }),
    p => ({ FB_Anlauf: aFB('FB_Anlauf', AN_D(), AN_BODY(p.T, 'U  #Start\n=  #Hupe')) })
  ]
});

// ---- Kapitel 13 ----
const PU_UDT = aUDT('UDT_Pumpe', 'Laeuft:Bool; Stoerung:Bool; Druck:Int|bar');
const HY_DB = aDB('DB_Hydraulik', 'P1:"UDT_Pumpe"|Pumpe 1; P2:"UDT_Pumpe"|Pumpe 2');
defExamTask({ id:'x_awl_p_hydraulik_udt', quest:'awl', level:'profi', ch:13, diff:1,
  params:{ N:[1, 2] },
  title:'Pumpendaten im Datenbaustein',
  brief: p => 'Der Global-DB <code>DB_Hydraulik</code> enthält zwei Pumpen <code>P1</code> und <code>P2</code> vom PLC-Datentyp <code>UDT_Pumpe</code>. Programmiere <code>Main</code>:<br>• <code>"Anzeige"</code> := Druck der Pumpe <b>' + p.N + '</b><br>• <code>"Lampe_Rot"</code> = Störung von <code>P1</code> ODER Störung von <code>P2</code><br>Zugriff z. B. mit <code>"DB_Hydraulik".P1.Druck</code>.',
  blocks: p => [
    { name:'UDT_Pumpe', kind:'UDT', src: PU_UDT },
    { name:'DB_Hydraulik', kind:'DB', src: HY_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Anzeige\nL  "DB_Hydraulik".P' + p.N + '.Druck\nT  "Anzeige"\n\nNETWORK Sammelstoerung\nO  "DB_Hydraulik".P1.Stoerung\nO  "DB_Hydraulik".P2.Stoerung\n=  "Lampe_Rot"') }
  ],
  globals: () => ({ Anzeige:0, Lampe_Rot:false }),
  must:['MEMBER'],
  visible: p => ({ tests:[[{ ['DB_Hydraulik.P' + p.N + '.Druck']:180 }, { Anzeige:180, Lampe_Rot:false }]] }),
  hidden: p => ({
    tests:[
      [{ 'DB_Hydraulik.P1.Druck':150, 'DB_Hydraulik.P2.Druck':210 }, { Anzeige: p.N === 1 ? 150 : 210, Lampe_Rot:false }],
      [{ 'DB_Hydraulik.P1.Druck':95, 'DB_Hydraulik.P2.Druck':0, Anzeige:7 }, { Anzeige: p.N === 1 ? 95 : 0 }],
      [{ 'DB_Hydraulik.P1.Stoerung':true }, { Lampe_Rot:true }],
      [{ 'DB_Hydraulik.P2.Stoerung':true }, { Lampe_Rot:true }],
      [{ 'DB_Hydraulik.P1.Stoerung':true, 'DB_Hydraulik.P2.Stoerung':true }, { Lampe_Rot:true }],
      [{ 'DB_Hydraulik.P1.Laeuft':true, 'DB_Hydraulik.P2.Laeuft':true, Lampe_Rot:true }, { Lampe_Rot:false }]
    ]
  }),
  wrong:[
    p => ({ Main: MAIN('L  "DB_Hydraulik".P' + (3 - p.N) + '.Druck\nT  "Anzeige"\nO  "DB_Hydraulik".P1.Stoerung\nO  "DB_Hydraulik".P2.Stoerung\n=  "Lampe_Rot"') }),
    p => ({ Main: MAIN('L  "DB_Hydraulik".P' + p.N + '.Druck\nT  "Anzeige"\nU  "DB_Hydraulik".P1.Stoerung\nU  "DB_Hydraulik".P2.Stoerung\n=  "Lampe_Rot"') })
  ]
});

const OFEN_DB = aDB('DB_Ofen', 'Zone:Array[1..3] of Int|Temperatur je Ofenzone in °C');
const MITTEL = (gr, cmp, div) => 'NETWORK Mittelwert\nL  "DB_Ofen".Zone[1]\nL  "DB_Ofen".Zone[2]\n+I\nL  "DB_Ofen".Zone[3]\n+I\nL  ' + (div || 3) + '\n/I\nT  "Temp_Mittel"\n\nNETWORK Grenzwert\nL  "Temp_Mittel"\nL  ' + gr + '\n' + (cmp || '>I') + '\n=  "Zu_heiss"';
defExamTask({ id:'x_awl_p_ofenzonen', quest:'awl', level:'profi', ch:13, diff:2,
  params:{ GR:[1200, 1250] },
  title:'Mittlere Ofentemperatur (Array)',
  brief: p => 'Der Global-DB <code>DB_Ofen</code> enthält <code>Zone : Array[1..3] of Int</code>. Programmiere <code>Main</code>:<br>• <code>"Temp_Mittel"</code> := (Zone[1] + Zone[2] + Zone[3]) / 3 (Ganzzahldivision)<br>• <code>"Zu_heiss"</code> = 1, wenn <code>"Temp_Mittel"</code> grösser als <b>' + p.GR + '</b> ist.',
  blocks: p => [
    { name:'DB_Ofen', kind:'DB', src: OFEN_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(MITTEL(p.GR)) }
  ],
  globals: () => ({ Temp_Mittel:0, Zu_heiss:false }),
  must:['ARRAY', '/I', 'CMP_I'],
  visible: p => ({ tests:[[{ 'DB_Ofen.Zone[1]':1100, 'DB_Ofen.Zone[2]':1150, 'DB_Ofen.Zone[3]':1200 }, { Temp_Mittel:1150, Zu_heiss:false }]] }),
  hidden: p => ({
    tests:[
      [{ 'DB_Ofen.Zone[1]':1180, 'DB_Ofen.Zone[2]':1190, 'DB_Ofen.Zone[3]':1210 }, { Temp_Mittel:1193 }],
      [{ 'DB_Ofen.Zone[1]':p.GR, 'DB_Ofen.Zone[2]':p.GR, 'DB_Ofen.Zone[3]':p.GR }, { Temp_Mittel:p.GR, Zu_heiss:false }],
      [{ 'DB_Ofen.Zone[1]':p.GR, 'DB_Ofen.Zone[2]':p.GR, 'DB_Ofen.Zone[3]':p.GR + 3 }, { Temp_Mittel:p.GR + 1, Zu_heiss:true }],
      [{ 'DB_Ofen.Zone[1]':900, 'DB_Ofen.Zone[2]':0, 'DB_Ofen.Zone[3]':0 }, { Temp_Mittel:300, Zu_heiss:false }],
      [{ 'DB_Ofen.Zone[1]':0, 'DB_Ofen.Zone[2]':0, 'DB_Ofen.Zone[3]':1300 }, { Temp_Mittel:433 }],
      [{ 'DB_Ofen.Zone[1]':1400, 'DB_Ofen.Zone[2]':1350, 'DB_Ofen.Zone[3]':1300 }, { Temp_Mittel:1350, Zu_heiss:true }]
    ]
  }),
  wrong:[
    p => ({ Main: MAIN(MITTEL(p.GR, '>=I')) }),
    p => ({ Main: MAIN('L  "DB_Ofen".Zone[1]\nL  "DB_Ofen".Zone[2]\n+I\nL  2\n/I\nT  "Temp_Mittel"\nL  "Temp_Mittel"\nL  ' + p.GR + '\n>I\n=  "Zu_heiss"') }),
    p => ({ Main: MAIN(MITTEL(p.GR, null, 2)) })
  ]
});

// ---- Kapitel 14 ----
const ME_D = { in:'Signal:Bool|Störsignal; Quit:Bool|Quittieren', out:'Hupe:Bool; Lampe:Bool', stat:'M_Signal:Bool|Flankenmerker' };
const ME_BODY = 'NETWORK Neue Meldung\nU  #Signal\nFP #M_Signal\nS  #Hupe\nU  #Quit\nR  #Hupe\n\nNETWORK Lampe\nU  #Signal\nO  #Hupe\n=  #Lampe';
const ME_MAIN = 'NETWORK Oeldruck\nCALL "FB_Meldung", "Oel_DB"\n   Signal := "Oeldruck_tief"\n   Quit := "Quittieren"\n   Hupe => "Hupe_Oel"\n   Lampe => "Lampe_Oel"\n\nNETWORK Wasser\nCALL "FB_Meldung", "Wasser_DB"\n   Signal := "Wasser_fehlt"\n   Quit := "Quittieren"\n   Hupe => "Hupe_Wasser"\n   Lampe => "Lampe_Wasser"';
defExamTask({ id:'x_awl_p_meldung', quest:'awl', level:'profi', ch:14, diff:2,
  title:'Standard-Meldebaustein',
  brief: () => 'Programmiere den Standardbaustein <code>FB_Meldung</code>:<br>• Eine <b>neue</b> Meldung (steigende Flanke von <code>#Signal</code>, Merker <code>#M_Signal</code>) setzt <code>#Hupe</code>.<br>• <code>#Quit</code> setzt <code>#Hupe</code> zurück (Rücksetzen zuletzt). Die Hupe kommt erst bei der nächsten neuen Meldung wieder.<br>• <code>#Lampe</code> leuchtet, solange <code>#Signal</code> ansteht <b>oder</b> die Hupe noch nicht quittiert ist.<br><code>Main</code> (🔒) nutzt den FB für Öldruck und Kühlwasser.',
  blocks: () => [
    { name:'FB_Meldung', kind:'FB', edit:true, start: aFB('FB_Meldung', ME_D, ''), ref: aFB('FB_Meldung', ME_D, ME_BODY) },
    { name:'Main', kind:'OB', src: MAIN(ME_MAIN) }
  ],
  globals: () => ({ Oeldruck_tief:false, Wasser_fehlt:false, Quittieren:false, Hupe_Oel:false, Lampe_Oel:false, Hupe_Wasser:false, Lampe_Wasser:false }),
  instances: () => ({ Oel_DB:'FB_Meldung', Wasser_DB:'FB_Meldung' }),
  must:['FP', 'S', 'R'],
  visible: () => ({ timed:[{ steps:[[0.1,{ Oeldruck_tief:true },{ Hupe_Oel:true, Lampe_Oel:true, Hupe_Wasser:false }],[0.1,{ Quittieren:true },{ Hupe_Oel:false, Lampe_Oel:true }]] }] }),
  hidden: () => ({
    unit:[{ block:'FB_Meldung', steps:[[0.1,{ Signal:true, Quit:false },{ Hupe:true, Lampe:true }],[0.1,{ Signal:false },{ Hupe:true, Lampe:true }],[0.1,{ Quit:true },{ Hupe:false, Lampe:false }],[0.1,{ Quit:false, Signal:true },{ Hupe:true }],[0.1,{ Quit:true },{ Hupe:false, Lampe:true }],[0.1,{ Quit:false },{ Hupe:false, Lampe:true }],[0.1,{ Signal:false },{ Hupe:false, Lampe:false }]] }],
    timed:[{ steps:[[0.1,{ Wasser_fehlt:true },{ Hupe_Wasser:true, Hupe_Oel:false, Lampe_Oel:false }],[0.1,{ Quittieren:true, Oeldruck_tief:true },{ Hupe_Wasser:false, Hupe_Oel:false, Lampe_Oel:true }],[0.1,{ Quittieren:false },{ Hupe_Oel:false, Lampe_Wasser:true }]] }]
  }),
  wrong:[
    () => ({ FB_Meldung: aFB('FB_Meldung', ME_D, 'U  #Signal\nS  #Hupe\nU  #Quit\nR  #Hupe\nU  #Signal\nO  #Hupe\n=  #Lampe') }),
    () => ({ FB_Meldung: aFB('FB_Meldung', ME_D, 'U  #Signal\nFP #M_Signal\nS  #Hupe\nU  #Quit\nR  #Hupe\nU  #Signal\n=  #Lampe') })
  ]
});

const WS_D = { in:'Soll:Int|mm; Ist:Int|mm; Freigabe:Bool', out:'Auf:Bool|Spalt öffnen; Zu:Bool|Spalt schliessen; In_Pos:Bool', temp:'Unten:Int; Oben:Int' };
const WS_BODY = (tb, o) => { o = o || {};
  return 'NETWORK Grenzen\nL  #Soll\nL  ' + tb + '\n-I\nT  #Unten\nL  #Soll\nL  ' + tb + '\n+I\nT  #Oben\n\n' +
    'NETWORK Auf\nU  #Freigabe\n' + (o.noKl ? 'L  #Ist\nL  #Unten\n<I\n' : 'U(\nL  #Ist\nL  #Unten\n' + (o.cmpLo || '<I') + '\n)\n') + '=  #' + (o.swap ? 'Zu' : 'Auf') + '\n\n' +
    'NETWORK Zu\nU  #Freigabe\nU(\nL  #Ist\nL  #Oben\n>I\n)\n=  #' + (o.swap ? 'Auf' : 'Zu') + '\n\n' +
    'NETWORK In Position\nL  #Ist\nL  #Unten\n>=I\nU(\nL  #Ist\nL  #Oben\n<=I\n)\n=  #In_Pos'; };
defExamTask({ id:'x_awl_p_walzspalt', quest:'awl', level:'profi', ch:14, diff:3,
  params:{ TB:[1, 2] },
  title:'Walzspalt nachstellen (Standard-FB)',
  brief: p => 'Programmiere <code>FB_Walzspalt</code> mit einem Totband von <b>±' + p.TB + ' mm</b>:<br>• <code>#Auf</code> = 1, wenn <code>#Freigabe</code> = 1 und <code>#Ist</code> kleiner als <code>#Soll</code> − ' + p.TB + ' ist.<br>• <code>#Zu</code> = 1, wenn <code>#Freigabe</code> = 1 und <code>#Ist</code> grösser als <code>#Soll</code> + ' + p.TB + ' ist.<br>• <code>#In_Pos</code> = 1, wenn <code>#Ist</code> im Band <code>#Soll</code> ± ' + p.TB + ' liegt (Grenzen eingeschlossen, unabhängig von der Freigabe).<br>Die Grenzen kannst du in den TEMP-Variablen <code>#Unten</code> und <code>#Oben</code> vorberechnen.',
  blocks: p => [
    { name:'FB_Walzspalt', kind:'FB', edit:true, start: aFB('FB_Walzspalt', WS_D, ''), ref: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Walzspalt", "Geruest1_DB"\n   Soll := "Spalt_Soll"\n   Ist := "Spalt_Ist"\n   Freigabe := "Walzen"\n   Auf => "Spalt_auf"\n   Zu => "Spalt_zu"\n   In_Pos => "Lampe_Gruen"') }
  ],
  globals: () => ({ Spalt_Soll:0, Spalt_Ist:0, Walzen:false, Spalt_auf:false, Spalt_zu:false, Lampe_Gruen:false }),
  instances: () => ({ Geruest1_DB:'FB_Walzspalt' }),
  must:['CMP_I', 'KLAMMER'],
  visible: p => ({ tests:[[{ Spalt_Soll:20, Spalt_Ist:10, Walzen:true }, { Spalt_auf:true, Spalt_zu:false, Lampe_Gruen:false }], [{ Spalt_Soll:20, Spalt_Ist:20, Walzen:true }, { Spalt_auf:false, Spalt_zu:false, Lampe_Gruen:true }]] }),
  hidden: p => ({
    unit:[{ block:'FB_Walzspalt', steps:[
      [0.1,{ Soll:30, Ist:30 - p.TB, Freigabe:true },{ Auf:false, Zu:false, In_Pos:true }],
      [0.1,{ Soll:30, Ist:29 - p.TB, Freigabe:true },{ Auf:true, Zu:false, In_Pos:false }],
      [0.1,{ Soll:30, Ist:30 + p.TB, Freigabe:true },{ Auf:false, Zu:false, In_Pos:true }],
      [0.1,{ Soll:30, Ist:31 + p.TB, Freigabe:true },{ Auf:false, Zu:true, In_Pos:false }],
      [0.1,{ Soll:30, Ist:5, Freigabe:false },{ Auf:false, Zu:false, In_Pos:false }],
      [0.1,{ Soll:30, Ist:60, Freigabe:false },{ Auf:false, Zu:false, In_Pos:false }],
      [0.1,{ Soll:30, Ist:30, Freigabe:false },{ Auf:false, Zu:false, In_Pos:true }]
    ] }]
  }),
  wrong:[
    p => ({ FB_Walzspalt: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB, { noKl:true })) }),
    p => ({ FB_Walzspalt: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB, { cmpLo:'<=I' })) }),
    p => ({ FB_Walzspalt: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB, { swap:true })) })
  ]
});

const RG_D = { in:'Vor:Bool; Rueck:Bool; Freigabe:Bool', out:'Mot_Vor:Bool; Mot_Rueck:Bool' };
defExamTask({ id:'x_awl_p_rollgang_fc', quest:'awl', level:'profi', ch:14, diff:1,
  title:'Tipp-Rollgang mit Verriegelung (FC)',
  brief: () => 'Programmiere den Standardbaustein <code>FC_Rollgang</code> (Tippbetrieb, ohne Selbsthaltung):<br>• <code>#Mot_Vor</code> = <code>#Freigabe</code> UND <code>#Vor</code> UND NICHT <code>#Rueck</code><br>• <code>#Mot_Rueck</code> = <code>#Freigabe</code> UND <code>#Rueck</code> UND NICHT <code>#Vor</code><br>Sind beide Taster gedrückt, läuft nichts (gegenseitige Verriegelung).',
  blocks: () => [
    { name:'FC_Rollgang', kind:'FC', edit:true, start: aFC('FC_Rollgang', 'Void', RG_D, ''), ref: aFC('FC_Rollgang', 'Void', RG_D, 'U  #Freigabe\nU  #Vor\nUN #Rueck\n=  #Mot_Vor\nU  #Freigabe\nU  #Rueck\nUN #Vor\n=  #Mot_Rueck') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Rollgang"\n   Vor := "S_Vor"\n   Rueck := "S_Rueck"\n   Freigabe := "Not_Aus_OK"\n   Mot_Vor => "Rollgang_Vor"\n   Mot_Rueck => "Rollgang_Rueck"') }
  ],
  globals: () => ({ S_Vor:false, S_Rueck:false, Not_Aus_OK:true, Rollgang_Vor:false, Rollgang_Rueck:false }),
  must:['UN'],
  visible: () => ({ tests:[[{ S_Vor:true }, { Rollgang_Vor:true, Rollgang_Rueck:false }]] }),
  hidden: () => ({
    unit:[{ block:'FC_Rollgang', steps: combos(['Vor', 'Rueck', 'Freigabe'], e => ({ Mot_Vor: e.Freigabe && e.Vor && !e.Rueck, Mot_Rueck: e.Freigabe && e.Rueck && !e.Vor })) }],
    tests:[[{ S_Rueck:true }, { Rollgang_Vor:false, Rollgang_Rueck:true }], [{ S_Vor:true, Not_Aus_OK:false }, { Rollgang_Vor:false }]]
  }),
  wrong:[
    () => ({ FC_Rollgang: aFC('FC_Rollgang', 'Void', RG_D, 'U  #Freigabe\nU  #Vor\n=  #Mot_Vor\nU  #Freigabe\nU  #Rueck\n=  #Mot_Rueck') }),
    () => ({ FC_Rollgang: aFC('FC_Rollgang', 'Void', RG_D, 'U  #Vor\nUN #Rueck\n=  #Mot_Vor\nU  #Rueck\nUN #Vor\n=  #Mot_Rueck') })
  ]
});

// ---- Kapitel 15 ----
const START = body => aOB('Startup', body);
const WW_DB = aDB('DB_Walzwerk', 'Temp_Soll:Int := 1000|°C; Betriebsart:Int := 0; Stueck:Int := 45|Stand vor dem Abschalten');
const WW_MAIN = 'NETWORK Stueck zaehlen\nU  "Block_raus"\nFP "M_Block"\nSPBN ANZ\nL  "DB_Walzwerk".Stueck\nINC 1\nT  "DB_Walzwerk".Stueck\n\nNETWORK Anzeige\nANZ: L  "DB_Walzwerk".Stueck\nT  "Anzeige"';
const WW_START = (soll, ba, o) => { o = o || {};
  return 'NETWORK Parameter\nL  ' + soll + '\nT  "DB_Walzwerk".' + (o.swap ? 'Betriebsart' : 'Temp_Soll') + '\nL  ' + ba + '\nT  "DB_Walzwerk".' + (o.swap ? 'Temp_Soll' : 'Betriebsart') + '\n' +
    (o.noZero ? '' : 'L  0\nT  "DB_Walzwerk".Stueck\n') + '\nNETWORK Ausgaenge\nSET\nR  "Rollgang"\n=  "Lampe_Gelb"'; };
defExamTask({ id:'x_awl_p_anlauf_ob100', quest:'awl', level:'profi', ch:15, diff:2,
  params:{ SOLL:[1150, 1200], BA:[1, 2] },
  title:'Definierter Anlauf (OB100)',
  brief: p => 'Programmiere den Anlauf-OB <code>Startup</code> (OB100). Er läuft <b>einmal</b> vor dem ersten Zyklus und soll:<br>• <code>"DB_Walzwerk".Temp_Soll</code> := <b>' + p.SOLL + '</b><br>• <code>"DB_Walzwerk".Betriebsart</code> := <b>' + p.BA + '</b><br>• <code>"DB_Walzwerk".Stueck</code> := 0<br>• <code>"Rollgang"</code> zurücksetzen und <code>"Lampe_Gelb"</code> einschalten (z. B. mit <code>SET</code>).<br><code>Main</code> (🔒) zählt danach die Blöcke im DB.',
  blocks: p => [
    { name:'DB_Walzwerk', kind:'DB', src: WW_DB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START(WW_START(p.SOLL, p.BA)) },
    { name:'Main', kind:'OB', src: MAIN(WW_MAIN) }
  ],
  globals: () => ({ Block_raus:false, M_Block:false, Anzeige:0, Rollgang:true, Lampe_Gelb:false }),
  must:['STARTUP', 'T'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{ 'DB_Walzwerk.Temp_Soll':p.SOLL, 'DB_Walzwerk.Stueck':0, Anzeige:0 }]] }] }),
  hidden: p => ({
    timed:[
      { steps:[[0.1,{},{ 'DB_Walzwerk.Temp_Soll':p.SOLL, 'DB_Walzwerk.Betriebsart':p.BA, 'DB_Walzwerk.Stueck':0, Anzeige:0, Rollgang:false, Lampe_Gelb:true }],[0.1,{ Block_raus:true },{ 'DB_Walzwerk.Stueck':1, Anzeige:1 }],[0.1,{ Block_raus:false, Rollgang:true },{ Rollgang:true, 'DB_Walzwerk.Stueck':1 }],[0.1,{ Block_raus:true },{ 'DB_Walzwerk.Stueck':2, Anzeige:2 }]] },
      { steps:[[0.1,{ Block_raus:true },{ 'DB_Walzwerk.Stueck':1, Anzeige:1, Lampe_Gelb:true }],[0.1,{ Lampe_Gelb:false },{ Lampe_Gelb:false, 'DB_Walzwerk.Betriebsart':p.BA }]] }
    ]
  }),
  wrong:[
    p => ({ Startup: START(WW_START(p.SOLL, p.BA, { noZero:true })) }),
    p => ({ Startup: START(WW_START(p.SOLL, p.BA, { swap:true })) }),
    p => ({ Startup: START('L  ' + p.SOLL + '\nT  "DB_Walzwerk".Temp_Soll\nL  ' + p.BA + '\nT  "DB_Walzwerk".Betriebsart\nL  0\nT  "DB_Walzwerk".Stueck') })
  ]
});

const FR_FC = aFC('FC_Freigabe', 'Void', { in:'Not_Aus_OK:Bool; Oel_OK:Bool', out:'Frei:Bool' }, 'U  #Not_Aus_OK\nU  #Oel_OK\n=  #Frei');
const MO_FB = aFB('FB_Motor', { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool' }, 'U(\nO  #Start\nO  #Laeuft\n)\nUN #Stopp\nU  #Freigabe\n=  #Laeuft');
const ST_CALLS = n => ({
  fr: 'NETWORK Freigabe\nCALL "FC_Freigabe"\n   Not_Aus_OK := "Not_Aus_OK"\n   Oel_OK := "Oel_OK"\n   Frei => "Frei"',
  wa: 'NETWORK Walzen\nCALL "FB_Motor", "Walzen' + n + '_DB"\n   Start := "S_Walzen_Ein"\n   Stopp := "S_Walzen_Aus"\n   Freigabe := "Frei"\n   Laeuft => "Walzen_' + n + '"',
  ro: 'NETWORK Rollgang\nCALL "FB_Motor", "Rollgang' + n + '_DB"\n   Start := "S_Roll_Ein"\n   Stopp := "S_Roll_Aus"\n   Freigabe := "Walzen_' + n + '"\n   Laeuft => "Rollgang_' + n + '"'
});
defExamTask({ id:'x_awl_p_ob1_struktur', quest:'awl', level:'profi', ch:15, diff:3,
  params:{ N:[1, 2] },
  title:'OB1 nach Programmierstandard',
  brief: p => 'Gerüst ' + p.N + ' bekommt einen aufgeräumten <code>Main</code> (OB1), der nur Bausteine aufruft – in der <b>richtigen Reihenfolge</b>, damit kein Signal einen Zyklus zu spät kommt:<br>1. <code>"FC_Freigabe"</code>: <code>Not_Aus_OK := "Not_Aus_OK"</code>, <code>Oel_OK := "Oel_OK"</code>, <code>Frei => "Frei"</code><br>2. <code>"FB_Motor"</code> mit Instanz <code>"Walzen' + p.N + '_DB"</code>: <code>Start := "S_Walzen_Ein"</code>, <code>Stopp := "S_Walzen_Aus"</code>, <code>Freigabe := "Frei"</code>, <code>Laeuft => "Walzen_' + p.N + '"</code><br>3. <code>"FB_Motor"</code> mit Instanz <code>"Rollgang' + p.N + '_DB"</code>: <code>Start := "S_Roll_Ein"</code>, <code>Stopp := "S_Roll_Aus"</code>, <code>Freigabe := "Walzen_' + p.N + '"</code>, <code>Laeuft => "Rollgang_' + p.N + '"</code>',
  blocks: p => { const c = ST_CALLS(p.N); return [
    { name:'FC_Freigabe', kind:'FC', src: FR_FC },
    { name:'FB_Motor', kind:'FB', src: MO_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(c.fr + '\n\n' + c.wa + '\n\n' + c.ro) }
  ]; },
  globals: p => ({ Not_Aus_OK:true, Oel_OK:true, Frei:false, S_Walzen_Ein:false, S_Walzen_Aus:false, S_Roll_Ein:false, S_Roll_Aus:false, ['Walzen_' + p.N]:false, ['Rollgang_' + p.N]:false }),
  instances: p => ({ ['Walzen' + p.N + '_DB']:'FB_Motor', ['Rollgang' + p.N + '_DB']:'FB_Motor' }),
  must:['CALL', 'FC_CALL', 'SINGLE'],
  visible: p => ({ timed:[{ steps:[[0.1,{ S_Walzen_Ein:true },{ ['Walzen_' + p.N]:true }],[0.1,{ S_Walzen_Ein:false, S_Roll_Ein:true },{ ['Walzen_' + p.N]:true, ['Rollgang_' + p.N]:true }]] }] }),
  hidden: p => { const W = 'Walzen_' + p.N, R = 'Rollgang_' + p.N; return {
    timed:[
      { steps:[[0.1,{ S_Walzen_Ein:true },{ [W]:true, [R]:false }],[0.1,{ S_Walzen_Ein:false, S_Roll_Ein:true },{ [W]:true, [R]:true }],[0.1,{ S_Roll_Ein:false, Not_Aus_OK:false },{ [W]:false, [R]:false, Frei:false }],[0.1,{ Not_Aus_OK:true },{ [W]:false, [R]:false }]] },
      { steps:[[0.1,{ S_Roll_Ein:true },{ [R]:false }],[0.1,{ S_Walzen_Ein:true },{ [W]:true, [R]:true }],[0.1,{ S_Walzen_Ein:false, S_Roll_Ein:false, S_Walzen_Aus:true },{ [W]:false, [R]:false }]] },
      { steps:[[0.1,{ Oel_OK:false, S_Walzen_Ein:true },{ [W]:false }],[0.1,{ Oel_OK:true },{ [W]:true, Frei:true }]] }
    ] }; },
  wrong:[
    p => { const c = ST_CALLS(p.N); return { Main: MAIN(c.wa + '\n\n' + c.ro + '\n\n' + c.fr) }; },
    p => { const c = ST_CALLS(p.N); return { Main: MAIN(c.fr + '\n\n' + c.ro + '\n\n' + c.wa) }; },
    p => { const c = ST_CALLS(p.N); return { Main: MAIN(c.fr + '\n\n' + c.wa) }; }
  ]
});

/* =====================================================================
   Fragen Grundstufe
   ===================================================================== */
const Q = (id, level, ch, q, options, answer) => defExamQuestion({ id, quest:'awl', level, ch, q, options, answer });
const G = (id, ch, q, o, a) => Q(id, 'grund', ch, q, o, a || 0);
const P = (id, ch, q, o, a) => Q(id, 'profi', ch, q, o, a || 0);

// Kapitel 1
G('xq_awl_g_erstabfrage', 1, 'Was bewirkt die Erstabfrage nach einer Zuweisung <code>=</code>?', ['Die nächste Abfrage beginnt ein neues VKE', 'Das VKE wird gelöscht und bleibt 0', 'AKKU1 wird auf 0 gesetzt', 'Der Baustein wird beendet']);
G('xq_awl_g_abk', 1, 'Wofür steht die Abkürzung <b>AWL</b>?', ['Anweisungsliste', 'Ablaufwerkliste', 'Automatische Wertliste', 'Ausgangs-Wort-Logik']);
G('xq_awl_g_undkette', 1, '<code>Pumpe_Ein</code> = 1, <code>Oel_OK</code> = 1, <code>Gitter_zu</code> = 0. Welchen Wert hat das VKE nach <code>U Pumpe_Ein / U Oel_OK / U Gitter_zu</code>?', ['0', '1', 'Es ist unbestimmt', 'Es entspricht dem Wert von Pumpe_Ein']);
G('xq_awl_g_zuweisung', 1, 'Welche Anweisung weist das VKE einem Operanden so zu, dass dieser dem VKE in jedem Zyklus folgt?', ['<code>=</code>', '<code>S</code>', '<code>T</code>', '<code>L</code>']);
// Kapitel 2
G('xq_awl_g_un_null', 2, '<code>Gitter_offen</code> = 0. Welche Anweisung liefert als Erstabfrage ein VKE von 1?', ['<code>UN Gitter_offen</code>', '<code>U Gitter_offen</code>', '<code>O Gitter_offen</code>', '<code>X Gitter_offen</code>']);
G('xq_awl_g_xor3', 2, 'a = 1, b = 1, c = 0. Welches Ergebnis liefert <code>X a / X b / X c / = q</code>?', ['q = 0', 'q = 1', 'Fehler: X erlaubt nur zwei Operanden', 'Es hängt vom VKE vor der Kette ab']);
G('xq_awl_g_oklammer', 2, 'Welche Verknüpfung beschreibt <code>U a / O( / U b / U c / ) / = q</code>?', ['q = a ODER (b UND c)', 'q = (a ODER b) UND c', 'q = a UND b UND c', 'q = a ODER b ODER c']);
G('xq_awl_g_undvor', 2, 'Wie schreibt man „(a ODER b) UND c“ korrekt in AWL?', ['<code>U( / O a / O b / ) / U c</code>', '<code>O a / O b / U c</code>', '<code>U a / O b / U c</code>', '<code>U c / O a / O b</code>']);
// Kapitel 3
G('xq_awl_g_r_wirkung', 3, 'Was bewirkt <code>R Pumpe</code>, wenn das VKE 1 ist?', ['Pumpe wird 0 und bleibt 0, bis sie wieder gesetzt wird', 'Pumpe wird nur für einen Zyklus 0', 'Pumpe wird umgeschaltet', 'Nichts – R wirkt nur bei VKE 0']);
G('xq_awl_g_clr', 3, 'Was macht die Anweisung <code>CLR</code>?', ['Sie setzt das VKE auf 0', 'Sie löscht AKKU1', 'Sie setzt alle Merker zurück', 'Sie beendet den Baustein']);
G('xq_awl_g_gleich_s', 3, 'Worin unterscheiden sich <code>= Pumpe</code> und <code>S Pumpe</code>?', ['<code>=</code> schreibt das VKE in jedem Zyklus, <code>S</code> schreibt nur bei VKE 1 eine 1 und hält sie', 'Es gibt keinen Unterschied', '<code>S</code> schreibt das VKE in jedem Zyklus, <code>=</code> speichert', '<code>=</code> funktioniert nur mit Ausgängen, <code>S</code> nur mit Merkern']);
G('xq_awl_g_rdominant', 3, 'In welcher Reihenfolge stehen die Anweisungen bei einem <b>rücksetzdominanten</b> Speicher?', ['Zuerst die S-Kette, danach die R-Kette', 'Zuerst die R-Kette, danach die S-Kette', 'Die Reihenfolge spielt keine Rolle', 'S und R dürfen nicht auf denselben Operanden wirken']);
// Kapitel 4
G('xq_awl_g_fm_wert', 4, '<code>U Block / FP M_Block</code>: <code>Block</code> ist seit mehreren Zyklen 1. Welchen Wert hat <code>M_Block</code>?', ['1 – der Merker speichert das VKE vor FP', '0 – er ist nur bei der Flanke 1', 'Er wechselt in jedem Zyklus', 'Er enthält die Anzahl der Flanken']);
G('xq_awl_g_fn_dauer0', 4, '<code>U Taster / FN M_T / = Q</code>: <code>Taster</code> ist seit dem Anlauf dauernd 0. Was gilt für <code>Q</code>?', ['Q bleibt 0', 'Q ist dauernd 1', 'Q ist in jedem zweiten Zyklus 1', 'Q ist im ersten Zyklus 1']);
G('xq_awl_g_fm_ueberschrieben', 4, 'Ein Flankenmerker wird in einem anderen Netzwerk zusätzlich mit <code>=</code> beschrieben. Folge?', ['Die Flankenerkennung wird verfälscht', 'Nichts – der Merker wird nur von FP benutzt', 'Die CPU geht in STOP', 'Die Flanke wird doppelt so lang']);
G('xq_awl_g_ls_frei', 4, 'Welche Anweisungsfolge liefert einen Impuls, wenn die Lichtschranke <code>LS</code> <b>frei wird</b> (1 → 0)?', ['<code>U LS / FN M_LS</code>', '<code>UN LS / FN M_LS</code>', '<code>U LS / FP M_LS</code>', '<code>FN LS</code>']);
// Kapitel 5
G('xq_awl_g_sa_art', 5, 'Welche S5-Zeit ist eine <b>Ausschaltverzögerung</b>?', ['SA', 'SE', 'SI', 'SV']);
G('xq_awl_g_sv_si', 5, 'Worin unterscheidet sich <code>SV</code> von <code>SI</code>?', ['SV läuft die volle Zeit, auch wenn das VKE vorher 0 wird', 'SV verzögert das Einschalten, SI das Ausschalten', 'SI läuft immer die volle Zeit, SV nicht', 'Es gibt keinen Unterschied']);
G('xq_awl_g_s5t_min', 5, 'Mit welcher Anweisung lädst du einen Zeitwert von 1 Minute 30 Sekunden?', ['<code>L S5T#1M30S</code>', '<code>L S5T#1,5M</code>', '<code>L 90</code>', '<code>L T1#90</code>']);
G('xq_awl_g_s5t_max', 5, 'Welcher Zeitwert ist bei einer S5-Zeit (S5TIME) höchstens möglich?', ['2H46M30S', '24H', '999S', '65 535 ms']);
// Kapitel 6
G('xq_awl_g_z_bereich', 6, 'Welchen Wertebereich hat ein S5-Zähler (Z1 …)?', ['0 … 999', '0 … 255', '−32 768 … 32 767', '0 … 65 535']);
G('xq_awl_g_zv_flanke', 6, 'Wann zählt <code>ZV Z1</code> um 1 vorwärts?', ['Bei einer steigenden Flanke des VKE', 'In jedem Zyklus, in dem das VKE 1 ist', 'Bei einer fallenden Flanke des VKE', 'Nur nach einem Setzen mit S Z1']);
G('xq_awl_g_z_999', 6, 'Z1 steht auf 999. Was passiert bei einer weiteren Flanke an <code>ZV Z1</code>?', ['Der Zählwert bleibt 999', 'Der Zählwert springt auf 0', 'Der Zählwert wird 1000', 'Die CPU geht in STOP']);
G('xq_awl_g_l_z', 6, 'Was steht nach <code>L Z1</code> in AKKU1?', ['Der aktuelle Zählwert als Ganzzahl', 'Nur das Zählerbit (0 oder 1)', 'Der Startwert des Zählers', 'Die Anzahl Zyklen seit dem Anlauf']);
// Kapitel 7
G('xq_awl_g_akku', 7, 'Nach <code>L 5</code> und <code>L 8</code>: Was steht in AKKU1 und AKKU2?', ['AKKU1 = 8, AKKU2 = 5', 'AKKU1 = 5, AKKU2 = 8', 'AKKU1 = 13, AKKU2 = 0', 'AKKU1 = 8, AKKU2 = 0']);
G('xq_awl_g_t_befehl', 7, 'Welche Anweisung speichert den Inhalt von AKKU1 in einer Variable?', ['<code>T</code>', '<code>L</code>', '<code>=</code>', '<code>S</code>']);
G('xq_awl_g_l_schiebt', 7, 'Was passiert beim Laden (<code>L</code>) mit dem bisherigen Inhalt von AKKU1?', ['Er wird nach AKKU2 geschoben', 'Er wird dazuaddiert', 'Er geht verloren, AKKU2 bleibt unverändert', 'Er wird in das VKE geschrieben']);
G('xq_awl_g_tak_x', 7, '<code>L 3 / L 4 / TAK / T x</code>. Welchen Wert hat x?', ['3', '4', '7', '0']);
// Kapitel 8
G('xq_awl_g_minus', 8, '<code>L 4 / L 10 / -I / T x</code>. Welchen Wert hat x?', ['−6', '6', '14', '0']);
G('xq_awl_g_itd', 8, 'Was bewirkt <code>ITD</code>?', ['Es wandelt eine INT (16 Bit) in eine DINT (32 Bit)', 'Es wandelt eine INT in eine REAL', 'Es dividiert zwei Ganzzahlen', 'Es rundet eine REAL']);
G('xq_awl_g_ueberlauf', 8, 'Was passiert bei <code>+I</code>, wenn das Ergebnis 32 767 überschreitet?', ['Es entsteht ein Überlauf (OV/OS), das Ergebnis ist nicht mehr korrekt', 'Die CPU rechnet automatisch mit DINT weiter', 'Das Ergebnis bleibt bei 32 767 stehen', 'Der Wert wird als REAL gespeichert']);
G('xq_awl_g_trunc', 8, 'Welchen Wert liefert <code>TRUNC</code> für die REAL-Zahl −2,7?', ['−2', '−3', '3', '−2,7']);
// Kapitel 9
G('xq_awl_g_kleiner', 9, '<code>L Druck / L 200 / &lt;I</code>. Wann ist das VKE danach 1?', ['Wenn Druck kleiner als 200 ist', 'Wenn 200 kleiner als Druck ist', 'Wenn Druck gleich 200 ist', 'Immer, wenn Druck ungleich 0 ist']);
G('xq_awl_g_klammer_vgl', 9, 'Ein Vergleichsergebnis soll mit einer vorher abgefragten Bedingung per UND verknüpft werden. Wie geht das sicher?', ['Den Vergleich in <code>U(</code> … <code>)</code> einklammern', 'Den Vergleich direkt nach der Abfrage schreiben', 'Nach dem Vergleich <code>NOT</code> schreiben', 'Das geht in AWL nicht']);
G('xq_awl_g_real_gleich', 9, 'Mit welchem Vergleich prüft man zwei REAL-Werte auf Gleichheit?', ['<code>==R</code>', '<code>==I</code>', '<code>==D</code>', '<code>=R</code>']);
G('xq_awl_g_vgl_null', 9, '<code>Temp</code> = 1250. Welcher Vergleich nach <code>L Temp / L 1250</code> ergibt VKE = 0?', ['<code>&lt;&gt;I</code>', '<code>==I</code>', '<code>&gt;=I</code>', '<code>&lt;=I</code>']);
// Kapitel 10
G('xq_awl_g_bea', 10, 'Was bewirkt <code>BEA</code>?', ['Die Bearbeitung des Bausteins wird unbedingt beendet', 'Der Baustein wird nur bei VKE 1 beendet', 'Es wird an den Anfang des Bausteins gesprungen', 'Die CPU geht in STOP']);
G('xq_awl_g_loop', 10, 'Was macht <code>LOOP M1</code>?', ['Es vermindert AKKU1 um 1 und springt nach M1, solange AKKU1 nicht 0 ist', 'Es springt immer nach M1', 'Es erhöht AKKU1 um 1 und springt, bis 100 erreicht ist', 'Es wiederholt den ganzen Baustein']);
G('xq_awl_g_marke_len', 10, 'Wie viele Zeichen darf eine Sprungmarke in AWL (S7-300/400) höchstens haben?', ['4', '8', '16', 'Beliebig viele']);
G('xq_awl_g_beb', 10, 'Unter welcher Bedingung beendet die Anweisung <code>BEB</code> die Bearbeitung des Bausteins?', ['Wenn das VKE 1 ist', 'Wenn das VKE 0 ist', 'Immer', 'Wenn AKKU1 0 ist']);

/* =====================================================================
   Fragen Profi-Stufe
   ===================================================================== */
// Kapitel 11
P('xq_awl_p_retval', 11, 'Wie schreibt man in AWL den Rückgabewert einer FC mit Rückgabetyp Int?', ['<code>L Wert / T #RET_VAL</code>', '<code>= #RET_VAL</code>', '<code>S #RET_VAL</code>', '<code>RETURN Wert</code>']);
P('xq_awl_p_temp_fc', 11, 'Was gilt für die temporären Variablen (Temp) einer FC?', ['Sie gelten nur während eines Aufrufs – beim nächsten Aufruf ist ihr Wert nicht gesichert', 'Sie behalten ihren Wert bis zum nächsten Aufruf', 'Sie werden im Instanz-DB gespeichert', 'Sie sind für alle Bausteine sichtbar']);
P('xq_awl_p_fc_param', 11, 'Beim Aufruf einer FC wird ein Eingangsparameter nicht versorgt. Was passiert?', ['Der Aufruf ist fehlerhaft – bei einer FC müssen alle Parameter versorgt werden', 'Der Parameter behält seinen letzten Wert', 'Der Parameter wird automatisch 0', 'Die FC wird übersprungen']);
P('xq_awl_p_raute', 11, 'Wofür steht das Zeichen <code>#</code> vor einem Operanden, z. B. <code>U #Start</code>?', ['Für eine lokale Variable aus der Bausteinschnittstelle', 'Für einen globalen Merker', 'Für eine Konstante', 'Für einen Eingang der Peripherie']);
P('xq_awl_p_inout', 11, 'Welcher Schnittstellenbereich wird im Baustein gelesen <b>und</b> beschrieben und wirkt auf den Aktualparameter zurück?', ['InOut (VAR_IN_OUT)', 'Input (VAR_INPUT)', 'Temp (VAR_TEMP)', 'Constant']);
P('xq_awl_p_fc_global', 11, 'Warum sollte eine FC Signale über Parameter erhalten statt globale Operanden direkt abzufragen?', ['Damit sie mehrfach mit verschiedenen Signalen verwendet werden kann', 'Weil globale Operanden in einer FC verboten sind', 'Weil Parameter schneller sind als Merker', 'Damit die FC einen Instanz-DB bekommt']);
// Kapitel 12
P('xq_awl_p_fb_fc', 12, 'Worin unterscheidet sich ein FB grundsätzlich von einer FC?', ['Ein FB hat ein Gedächtnis (Instanzdaten), eine FC nicht', 'Ein FB darf keine Ausgänge haben', 'Eine FC kann nur einmal aufgerufen werden', 'Ein FB kann nicht in AWL programmiert werden']);
P('xq_awl_p_idb', 12, 'Was enthält ein Instanz-DB?', ['Die Parameter und statischen Variablen genau einer FB-Instanz', 'Alle globalen Merker der CPU', 'Den Programmcode des FB', 'Die temporären Variablen aller FCs']);
P('xq_awl_p_ton_stat', 12, 'Wie legt man eine IEC-Zeit TON als Multiinstanz in einem FB an?', ['Als statische Variable (Static) vom Typ TON', 'Als temporäre Variable vom Typ TON', 'Als Eingang vom Typ Time', 'Mit <code>SE T1</code> im FB']);
P('xq_awl_p_call_multi', 12, 'Wie ruft man die Multiinstanz <code>T_Warn</code> in AWL auf?', ['<code>CALL #T_Warn</code> mit Parameterzeilen', '<code>CALL "TON", "T_Warn"</code>', '<code>SE #T_Warn</code>', '<code>U #T_Warn</code>']);
P('xq_awl_p_idb_doppelt', 12, 'Zwei Rollgänge werden mit demselben Instanz-DB desselben FB aufgerufen. Folge?', ['Beide Aufrufe teilen sich die Daten und beeinflussen sich gegenseitig', 'Die CPU legt automatisch einen zweiten DB an', 'Nur der erste Aufruf wird ausgeführt', 'Kein Problem – jeder Aufruf hat eigene Daten']);
P('xq_awl_p_q_abfrage', 12, 'Wie fragt man im FB den Ausgang Q der Multiinstanz <code>T_Warn</code> ab?', ['<code>U #T_Warn.Q</code>', '<code>U T_Warn</code>', '<code>U "T_Warn".Q</code>', '<code>L #T_Warn</code>']);
// Kapitel 13
P('xq_awl_p_db_zugriff', 13, 'Wie greift man symbolisch auf <code>Temp_Soll</code> im Global-DB <code>DB_Ofen</code> zu?', ['<code>L "DB_Ofen".Temp_Soll</code>', '<code>L #DB_Ofen.Temp_Soll</code>', '<code>L DB_Ofen:Temp_Soll</code>', '<code>L "Temp_Soll".DB_Ofen</code>']);
P('xq_awl_p_udt', 13, 'Was ist ein PLC-Datentyp (UDT)?', ['Eine selbst definierte Struktur, die als Vorlage für Variablen dient', 'Ein Datenbaustein mit festen Werten', 'Ein Baustein mit Programmcode', 'Eine Konstante für alle Bausteine']);
P('xq_awl_p_array_n', 13, 'Wie viele Elemente hat ein <code>Array[1..5] of Int</code>?', ['5', '4', '6', '10']);
P('xq_awl_p_global_idb', 13, 'Worin unterscheidet sich ein Global-DB von einem Instanz-DB?', ['Auf einen Global-DB greifen beliebige Bausteine zu; ein Instanz-DB gehört zu einem FB-Aufruf', 'Ein Global-DB kann keine Arrays enthalten', 'Ein Instanz-DB ist remanent, ein Global-DB nie', 'Es gibt keinen Unterschied']);
P('xq_awl_p_array_idx', 13, 'Welches Element spricht <code>"DB_Stich".Spalt[2]</code> bei <code>Spalt : Array[1..3] of Int</code> an?', ['Das zweite Element', 'Das dritte Element', 'Das erste Element', 'Alle Elemente bis 2']);
P('xq_awl_p_udt_vorteil', 13, 'Welchen Vorteil hat ein gemeinsamer PLC-Datentyp für alle Walzgerüste?', ['Alle Gerüste haben dieselbe Datenstruktur; eine Änderung erfolgt an einer Stelle', 'Das Programm braucht keine Datenbausteine mehr', 'Die Gerüste teilen sich automatisch dieselben Werte', 'Die CPU arbeitet damit doppelt so schnell']);
// Kapitel 14
P('xq_awl_p_std_schnitt', 14, 'Was zeichnet einen guten Standardbaustein (z. B. <code>FB_Antrieb</code>) aus?', ['Er arbeitet nur über seine Schnittstelle und greift nicht direkt auf globale Operanden zu', 'Er enthält die Adressen aller Antriebe der Anlage', 'Er wird nur einmal im Programm aufgerufen', 'Er kommt ohne Parameter aus']);
P('xq_awl_p_rm_zeit', 14, 'Warum überwacht ein Standard-Antrieb die Schütz-Rückmeldung mit einer Zeit?', ['Damit eine fehlende Rückmeldung nach einer Wartezeit als Störung erkannt wird', 'Damit der Motor langsamer anläuft', 'Damit die Rückmeldung entprellt gezählt wird', 'Damit der Antrieb nach einer Zeit automatisch ausschaltet']);
P('xq_awl_p_zwei_geruest', 14, 'Derselbe Walzgerüst-Baustein soll für zwei Gerüste verwendet werden. Was ist richtig?', ['Ein FB, zwei Instanzen (zwei Instanz-DBs oder zwei Multiinstanzen)', 'Den FB kopieren und umbenennen', 'Einen Instanz-DB für beide Aufrufe', 'Den FB nur einmal aufrufen und die Ausgänge verdoppeln']);
P('xq_awl_p_verriegelung', 14, 'Warum verriegelt ein Rollgangbaustein Vorwärts und Rückwärts gegenseitig?', ['Damit nie beide Wendeschütze gleichzeitig anziehen', 'Damit der Rollgang schneller umschaltet', 'Weil ein FB nur einen Ausgang setzen darf', 'Damit keine Flanke verloren geht']);
P('xq_awl_p_totband', 14, 'Wozu dient ein Totband bei der Walzspaltverstellung?', ['Innerhalb des Bandes wird nicht nachgestellt – der Antrieb pendelt nicht dauernd hin und her', 'Es sperrt die Verstellung während des Walzens', 'Es begrenzt den Spalt auf einen Maximalwert', 'Es verzögert das Einschalten des Gerüsts']);
P('xq_awl_p_parameter', 14, 'Ein Ofenbaustein erhält Solltemperatur und Hysterese als Eingänge statt als Zahlen im Code. Vorteil?', ['Derselbe Baustein passt ohne Codeänderung für verschiedene Öfen', 'Der Baustein braucht keinen Instanz-DB mehr', 'Die Temperatur wird genauer gemessen', 'Die Eingänge sind schneller als Konstanten']);
// Kapitel 15
P('xq_awl_p_1200', 15, 'Ein AWL-Programm einer S7-300 soll auf eine S7-1200 migriert werden. Was ist richtig?', ['Die S7-1200 kann kein AWL – das Programm muss z. B. nach SCL oder KOP umgeschrieben werden', 'AWL läuft auf der S7-1200 unverändert', 'Man muss nur die Adressen anpassen', 'Die S7-1200 übersetzt AWL automatisch beim Laden']);
P('xq_awl_p_ob100', 15, 'Wann wird der OB100 bearbeitet?', ['Einmal beim Anlauf (Neustart) der CPU, vor dem ersten OB1-Zyklus', 'In jedem Zyklus vor dem OB1', 'Nur bei einem Fehler', 'Alle 100 ms']);
P('xq_awl_p_ob1_inhalt', 15, 'Was gehört nach gängigem Programmierstandard in den OB1?', ['Vor allem Bausteinaufrufe in sinnvoller Reihenfolge', 'Die gesamte Logik der Anlage in einem Netzwerk', 'Nur Anlaufwerte', 'Die Deklaration aller Variablen']);
P('xq_awl_p_reihenfolge', 15, 'Der Baustein, der eine Freigabe berechnet, wird im OB1 <b>nach</b> dem Antrieb aufgerufen, der sie verwendet. Folge?', ['Der Antrieb reagiert erst einen Zyklus später auf die Freigabe', 'Der Antrieb reagiert nie', 'Die CPU meldet einen Übersetzungsfehler', 'Kein Unterschied – alle Bausteine laufen gleichzeitig']);
P('xq_awl_p_1500', 15, 'Ein AWL-Programm soll auf eine S7-1500 übernommen werden. Was ist richtig?', ['Die S7-1500 kann AWL ausführen; für neue Programme werden aber meist SCL, KOP oder FUP empfohlen', 'Die S7-1500 kann kein AWL', 'AWL muss auf der S7-1500 in GRAPH umgewandelt werden', 'Auf der S7-1500 laufen nur S5-Zeiten']);
P('xq_awl_p_warnfrei', 15, 'Warum verlangt ein Programmierstandard, dass Bausteine ohne Warnungen übersetzt werden?', ['Warnungen weisen auf mögliche Fehler hin, z. B. ungenutzte oder vor dem Schreiben gelesene Variablen', 'Weil Bausteine mit Warnungen nicht geladen werden können', 'Weil Warnungen die Zykluszeit verdoppeln', 'Warnungen sind nur für KOP wichtig']);
})();

export const Exam = globalThis.SPSQExam;
export const QUEST_TASKS = {"scl":[{"id":"r1t1","ch":1,"final":false},{"id":"c1_arm","ch":1,"final":false},{"id":"r1t3","ch":1,"final":false},{"id":"c1_band","ch":1,"final":false},{"id":"c1_copy","ch":1,"final":false},{"id":"c1_semi","ch":1,"final":false},{"id":"c1_real","ch":1,"final":false},{"id":"c1_calc","ch":1,"final":false},{"id":"c1_typ","ch":1,"final":false},{"id":"c1_boss","ch":1,"final":false},{"id":"r1t9","ch":2,"final":false},{"id":"r2t3","ch":2,"final":false},{"id":"c2_not","ch":2,"final":false},{"id":"r2t4","ch":2,"final":false},{"id":"c2_xor","ch":2,"final":false},{"id":"r2t6","ch":2,"final":false},{"id":"c2_klammer","ch":2,"final":false},{"id":"c2_klammer_dbg","ch":2,"final":false},{"id":"c2_latch","ch":2,"final":false},{"id":"r2t10","ch":2,"final":false},{"id":"c3_temp","ch":3,"final":false},{"id":"c3_fenster","ch":3,"final":false},{"id":"c3_summe","ch":3,"final":false},{"id":"c3_mod","ch":3,"final":false},{"id":"c3_mittel","ch":3,"final":false},{"id":"c3_skal","ch":3,"final":false},{"id":"c3_ungleich","ch":3,"final":false},{"id":"c3_limit","ch":3,"final":false},{"id":"c3_abs","ch":3,"final":false},{"id":"c3_boss","ch":3,"final":false},{"id":"r1t5","ch":4,"final":false},{"id":"c4_ohne_else","ch":4,"final":false},{"id":"r1t10","ch":4,"final":false},{"id":"c4_elsif","ch":4,"final":false},{"id":"c4_reihenfolge","ch":4,"final":false},{"id":"c4_verschachtelt","ch":4,"final":false},{"id":"c4_hysterese","ch":4,"final":false},{"id":"c4_endif","ch":4,"final":false},{"id":"c4_farbweiche","ch":4,"final":false},{"id":"c4_boss","ch":4,"final":false},{"id":"r3t2","ch":5,"final":false},{"id":"r3t4","ch":5,"final":false},{"id":"r3t5","ch":5,"final":false},{"id":"c5_liste","ch":5,"final":false},{"id":"r3t7","ch":5,"final":false},{"id":"c5_else_fehlt","ch":5,"final":false},{"id":"c5_positionen","ch":5,"final":false},{"id":"c5_betrieb","ch":5,"final":false},{"id":"c5_umbau","ch":5,"final":false},{"id":"r3t10","ch":5,"final":false},{"id":"r4t1","ch":6,"final":false},{"id":"c6_lesen","ch":6,"final":false},{"id":"r4t3","ch":6,"final":false},{"id":"c6_summe","ch":6,"final":false},{"id":"c6_grenze","ch":6,"final":false},{"id":"c6_zaehlen","ch":6,"final":false},{"id":"r4t5","ch":6,"final":false},{"id":"c6_mittel","ch":6,"final":false},{"id":"c6_schieben","ch":6,"final":false},{"id":"r4t10","ch":6,"final":false},{"id":"c7_kisten","ch":7,"final":false},{"id":"r4t9","ch":7,"final":false},{"id":"c7_suche","ch":7,"final":false},{"id":"c7_repeat","ch":7,"final":false},{"id":"c7_continue","ch":7,"final":false},{"id":"c7_lagerplatz","ch":7,"final":false},{"id":"c7_exit_dbg","ch":7,"final":false},{"id":"c7_doppelt","ch":7,"final":false},{"id":"c7_sortieren","ch":7,"final":false},{"id":"c7_boss","ch":7,"final":false},{"id":"r5t1","ch":8,"final":false},{"id":"c8_ftrig","ch":8,"final":false},{"id":"c8_zaehlen","ch":8,"final":false},{"id":"c8_zaehler_dbg","ch":8,"final":false},{"id":"c8_toggle","ch":8,"final":false},{"id":"c8_ctu","ch":8,"final":false},{"id":"c8_ctd","ch":8,"final":false},{"id":"c8_reset_dbg","ch":8,"final":false},{"id":"c8_startstopp","ch":8,"final":false},{"id":"c8_boss","ch":8,"final":false},{"id":"r5t3","ch":9,"final":false},{"id":"r5t5","ch":9,"final":false},{"id":"c9_tp","ch":9,"final":false},{"id":"r5t8","ch":9,"final":false},{"id":"c9_anlauf","ch":9,"final":false},{"id":"c9_blinker","ch":9,"final":false},{"id":"c9_ueberwachung","ch":9,"final":false},{"id":"c9_ms_dbg","ch":9,"final":false},{"id":"c9_restzeit","ch":9,"final":false},{"id":"r5t10","ch":9,"final":false},{"id":"c10_kette","ch":10,"final":false},{"id":"c10_ausgaenge","ch":10,"final":false},{"id":"c10_timer","ch":10,"final":false},{"id":"c10_haenger_dbg","ch":10,"final":false},{"id":"c10_pickplace","ch":10,"final":false},{"id":"c10_notaus","ch":10,"final":false},{"id":"c10_timer_dbg","ch":10,"final":false},{"id":"c10_zyklen","ch":10,"final":false},{"id":"c10_sortierlauf","ch":10,"final":false},{"id":"final_boss","ch":10,"final":true},{"id":"p11_deklaration","ch":11,"final":false},{"id":"p11_typen","ch":11,"final":false},{"id":"p11_startwert","ch":11,"final":false},{"id":"p11_konstante","ch":11,"final":false},{"id":"p11_typfehler_dbg","ch":11,"final":false},{"id":"p11_arraygrenzen","ch":11,"final":false},{"id":"p11_wortbreite","ch":11,"final":false},{"id":"p11_bits","ch":11,"final":false},{"id":"p11_temp_dbg","ch":11,"final":false},{"id":"p11_boss","ch":11,"final":false},{"id":"p12_erste_fc","ch":12,"final":false},{"id":"p12_aufruf","ch":12,"final":false},{"id":"p12_skalieren","ch":12,"final":false},{"id":"p12_ausgaenge","ch":12,"final":false},{"id":"p12_zweige_dbg","ch":12,"final":false},{"id":"p12_inout","ch":12,"final":false},{"id":"p12_void","ch":12,"final":false},{"id":"p12_fc_speicher_dbg","ch":12,"final":false},{"id":"p12_bibliothek","ch":12,"final":false},{"id":"p12_boss","ch":12,"final":false},{"id":"p13_erster_fb","ch":13,"final":false},{"id":"p13_instanz","ch":13,"final":false},{"id":"p13_motor","ch":13,"final":false},{"id":"p13_eine_instanz_dbg","ch":13,"final":false},{"id":"p13_multiinstanz","ch":13,"final":false},{"id":"p13_timer_im_fb","ch":13,"final":false},{"id":"p13_zaehler_fb","ch":13,"final":false},{"id":"p13_statik_lesen","ch":13,"final":false},{"id":"p13_bedingt_dbg","ch":13,"final":false},{"id":"p13_boss","ch":13,"final":false},{"id":"p14_struct","ch":14,"final":false},{"id":"p14_udt","ch":14,"final":false},{"id":"p14_array_udt","ch":14,"final":false},{"id":"p14_global_db","ch":14,"final":false},{"id":"p14_grenzen_dbg","ch":14,"final":false},{"id":"p14_string","ch":14,"final":false},{"id":"p14_concat","ch":14,"final":false},{"id":"p14_zerlegen","ch":14,"final":false},{"id":"p14_kurz_dbg","ch":14,"final":false},{"id":"p14_boss","ch":14,"final":false},{"id":"p15_zyklus","ch":15,"final":false},{"id":"p15_reihenfolge_dbg","ch":15,"final":false},{"id":"p15_anlauf","ch":15,"final":false},{"id":"p15_eingaenge","ch":15,"final":false},{"id":"p15_geraete","ch":15,"final":false},{"id":"p15_betriebsart","ch":15,"final":false},{"id":"p15_schrittkette","ch":15,"final":false},{"id":"p15_global_dbg","ch":15,"final":false},{"id":"p15_export","ch":15,"final":false},{"id":"p15_final","ch":15,"final":true}],"kop":[{"id":"k1_licht","ch":1,"final":false},{"id":"k1_sperre","ch":1,"final":false},{"id":"k1_ampel_dbg","ch":1,"final":false},{"id":"k1_netzwerke","ch":1,"final":false},{"id":"k1_antrieb","ch":1,"final":false},{"id":"k1_zwei_spulen","ch":1,"final":false},{"id":"k1_bergfahrt","ch":1,"final":false},{"id":"k1_notaus_dbg","ch":1,"final":false},{"id":"k1_einstieg","ch":1,"final":false},{"id":"k1_boss","ch":1,"final":false},{"id":"k2_oeffner","ch":2,"final":false},{"id":"k2_parallel","ch":2,"final":false},{"id":"k2_notaus","ch":2,"final":false},{"id":"k2_tuer","ch":2,"final":false},{"id":"k2_tuer_dbg","ch":2,"final":false},{"id":"k2_warnung","ch":2,"final":false},{"id":"k2_sensor","ch":2,"final":false},{"id":"k2_betrieb","ch":2,"final":false},{"id":"k2_stopp_dbg","ch":2,"final":false},{"id":"k2_boss","ch":2,"final":false},{"id":"k3_selbst","ch":3,"final":false},{"id":"k3_ausvorrang","ch":3,"final":false},{"id":"k3_einvorrang","ch":3,"final":false},{"id":"k3_notaus","ch":3,"final":false},{"id":"k3_selbst_dbg","ch":3,"final":false},{"id":"k3_verriegelung","ch":3,"final":false},{"id":"k3_richtung","ch":3,"final":false},{"id":"k3_verriegelung_dbg","ch":3,"final":false},{"id":"k3_tuer","ch":3,"final":false},{"id":"k3_boss","ch":3,"final":false},{"id":"k4_setzen","ch":4,"final":false},{"id":"k4_vorrang","ch":4,"final":false},{"id":"k4_stoerung","ch":4,"final":false},{"id":"k4_quit_dbg","ch":4,"final":false},{"id":"k4_negiert","ch":4,"final":false},{"id":"k4_antrieb_sr","ch":4,"final":false},{"id":"k4_sammel","ch":4,"final":false},{"id":"k4_hupe","ch":4,"final":false},{"id":"k4_vorrang_dbg","ch":4,"final":false},{"id":"k4_boss","ch":4,"final":false},{"id":"k5_pflanke","ch":5,"final":false},{"id":"k5_zaehlen","ch":5,"final":false},{"id":"k5_rasend_dbg","ch":5,"final":false},{"id":"k5_sperre","ch":5,"final":false},{"id":"k5_stromstoss","ch":5,"final":false},{"id":"k5_hupe","ch":5,"final":false},{"id":"k5_quit","ch":5,"final":false},{"id":"k5_nflanke_dbg","ch":5,"final":false},{"id":"k5_start","ch":5,"final":false},{"id":"k5_boss","ch":5,"final":false},{"id":"k6_ton","ch":6,"final":false},{"id":"k6_tof","ch":6,"final":false},{"id":"k6_tp","ch":6,"final":false},{"id":"k6_zeit_dbg","ch":6,"final":false},{"id":"k6_autozu","ch":6,"final":false},{"id":"k6_windfilter","ch":6,"final":false},{"id":"k6_tof_dbg","ch":6,"final":false},{"id":"k6_bremse","ch":6,"final":false},{"id":"k6_signal","ch":6,"final":false},{"id":"k6_boss","ch":6,"final":false},{"id":"k7_taktmerker","ch":7,"final":false},{"id":"k7_blinker","ch":7,"final":false},{"id":"k7_ueberwachung","ch":7,"final":false},{"id":"k7_anlauf","ch":7,"final":false},{"id":"k7_wind","ch":7,"final":false},{"id":"k7_blink_dbg","ch":7,"final":false},{"id":"k7_seil","ch":7,"final":false},{"id":"k7_ueber_dbg","ch":7,"final":false},{"id":"k7_tuerwarnung","ch":7,"final":false},{"id":"k7_boss","ch":7,"final":false},{"id":"k8_ctu","ch":8,"final":false},{"id":"k8_reset","ch":8,"final":false},{"id":"k8_anzeige","ch":8,"final":false},{"id":"k8_ctd","ch":8,"final":false},{"id":"k8_pv_dbg","ch":8,"final":false},{"id":"k8_sperre","ch":8,"final":false},{"id":"k8_richtungen","ch":8,"final":false},{"id":"k8_reset_dbg","ch":8,"final":false},{"id":"k8_takt","ch":8,"final":false},{"id":"k8_boss","ch":8,"final":false},{"id":"k9_wind","ch":9,"final":false},{"id":"k9_bereich","ch":9,"final":false},{"id":"k9_revision","ch":9,"final":false},{"id":"k9_hysterese","ch":9,"final":false},{"id":"k9_move","ch":9,"final":false},{"id":"k9_add","ch":9,"final":false},{"id":"k9_grenze_dbg","ch":9,"final":false},{"id":"k9_mul","ch":9,"final":false},{"id":"k9_hyst_dbg","ch":9,"final":false},{"id":"k9_boss","ch":9,"final":false},{"id":"k10_kette","ch":10,"final":false},{"id":"k10_freigabe","ch":10,"final":false},{"id":"k10_bruecke_dbg","ch":10,"final":false},{"id":"k10_speicher","ch":10,"final":false},{"id":"k10_zwei_schritte","ch":10,"final":false},{"id":"k10_ausgaben","ch":10,"final":false},{"id":"k10_zeitschritt","ch":10,"final":false},{"id":"k10_schritt_dbg","ch":10,"final":false},{"id":"k10_betriebsart","ch":10,"final":false},{"id":"k10_final","ch":10,"final":true},{"id":"k11_erste_fc","ch":11,"final":false},{"id":"k11_schnittstelle","ch":11,"final":false},{"id":"k11_aufruf","ch":11,"final":false},{"id":"k11_zwei_stationen","ch":11,"final":false},{"id":"k11_aufruf_dbg","ch":11,"final":false},{"id":"k11_retval","ch":11,"final":false},{"id":"k11_temp","ch":11,"final":false},{"id":"k11_temp_dbg","ch":11,"final":false},{"id":"k11_speicher_dbg","ch":11,"final":false},{"id":"k11_boss","ch":11,"final":false},{"id":"k12_selbsthaltung","ch":12,"final":false},{"id":"k12_stoerung","ch":12,"final":false},{"id":"k12_instanzen","ch":12,"final":false},{"id":"k12_flanke","ch":12,"final":false},{"id":"k12_instanz_dbg","ch":12,"final":false},{"id":"k12_timer","ch":12,"final":false},{"id":"k12_zaehler","ch":12,"final":false},{"id":"k12_multi","ch":12,"final":false},{"id":"k12_timer_dbg","ch":12,"final":false},{"id":"k12_boss","ch":12,"final":false},{"id":"k13_db_schreiben","ch":13,"final":false},{"id":"k13_parameter","ch":13,"final":false},{"id":"k13_udt","ch":13,"final":false},{"id":"k13_db_tabelle","ch":13,"final":false},{"id":"k13_db_dbg","ch":13,"final":false},{"id":"k13_array","ch":13,"final":false},{"id":"k13_struct_param","ch":13,"final":false},{"id":"k13_move_struct","ch":13,"final":false},{"id":"k13_array_dbg","ch":13,"final":false},{"id":"k13_boss","ch":13,"final":false},{"id":"k14_tuer","ch":14,"final":false},{"id":"k14_kette","ch":14,"final":false},{"id":"k14_antrieb","ch":14,"final":false},{"id":"k14_global_dbg","ch":14,"final":false},{"id":"k14_verschaltung","ch":14,"final":false},{"id":"k14_betriebsart","ch":14,"final":false},{"id":"k14_inout","ch":14,"final":false},{"id":"k14_meldung","ch":14,"final":false},{"id":"k14_verschaltung_dbg","ch":14,"final":false},{"id":"k14_boss","ch":14,"final":false},{"id":"k15_anlauf","ch":15,"final":false},{"id":"k15_struktur","ch":15,"final":false},{"id":"k15_reihenfolge_dbg","ch":15,"final":false},{"id":"k15_warnfrei","ch":15,"final":false},{"id":"k15_anlauf_dbg","ch":15,"final":false},{"id":"k15_status","ch":15,"final":false},{"id":"k15_diagnose","ch":15,"final":false},{"id":"k15_ablauf","ch":15,"final":false},{"id":"k15_quit_dbg","ch":15,"final":false},{"id":"k15_final","ch":15,"final":true}],"fup":[{"id":"f1_signal","ch":1,"final":false},{"id":"f1_und","ch":1,"final":false},{"id":"f1_bue_dbg","ch":1,"final":false},{"id":"f1_netzwerke","ch":1,"final":false},{"id":"f1_drei","ch":1,"final":false},{"id":"f1_zwei_ausgaenge","ch":1,"final":false},{"id":"f1_bue","ch":1,"final":false},{"id":"f1_ausfahrt_dbg","ch":1,"final":false},{"id":"f1_weiche","ch":1,"final":false},{"id":"f1_boss","ch":1,"final":false},{"id":"f2_oder","ch":2,"final":false},{"id":"f2_negiert","ch":2,"final":false},{"id":"f2_halt","ch":2,"final":false},{"id":"f2_xor","ch":2,"final":false},{"id":"f2_oder_dbg","ch":2,"final":false},{"id":"f2_zwei_tasten","ch":2,"final":false},{"id":"f2_bue","ch":2,"final":false},{"id":"f2_neg_dbg","ch":2,"final":false},{"id":"f2_lagemelder","ch":2,"final":false},{"id":"f2_boss","ch":2,"final":false},{"id":"f3_selbst","ch":3,"final":false},{"id":"f3_signal_halt","ch":3,"final":false},{"id":"f3_einvorrang","ch":3,"final":false},{"id":"f3_verriegelung","ch":3,"final":false},{"id":"f3_selbst_dbg","ch":3,"final":false},{"id":"f3_zugfahrt","ch":3,"final":false},{"id":"f3_verriegelung_dbg","ch":3,"final":false},{"id":"f3_ausvorrang","ch":3,"final":false},{"id":"f3_schranke","ch":3,"final":false},{"id":"f3_boss","ch":3,"final":false},{"id":"f4_s_r","ch":4,"final":false},{"id":"f4_sr","ch":4,"final":false},{"id":"f4_rs","ch":4,"final":false},{"id":"f4_negiert","ch":4,"final":false},{"id":"f4_rs_dbg","ch":4,"final":false},{"id":"f4_stoerung","ch":4,"final":false},{"id":"f4_vorrang","ch":4,"final":false},{"id":"f4_sammel","ch":4,"final":false},{"id":"f4_reihenfolge_dbg","ch":4,"final":false},{"id":"f4_boss","ch":4,"final":false},{"id":"f5_achse","ch":5,"final":false},{"id":"f5_rasend_dbg","ch":5,"final":false},{"id":"f5_n","ch":5,"final":false},{"id":"f5_stromstoss","ch":5,"final":false},{"id":"f5_zugzaehlung","ch":5,"final":false},{"id":"f5_quit","ch":5,"final":false},{"id":"f5_n_dbg","ch":5,"final":false},{"id":"f5_signalfall","ch":5,"final":false},{"id":"f5_toggle_dbg","ch":5,"final":false},{"id":"f5_boss","ch":5,"final":false},{"id":"f6_ton","ch":6,"final":false},{"id":"f6_tof","ch":6,"final":false},{"id":"f6_tp","ch":6,"final":false},{"id":"f6_zeit_dbg","ch":6,"final":false},{"id":"f6_sicherheit","ch":6,"final":false},{"id":"f6_haltezeit","ch":6,"final":false},{"id":"f6_tof_dbg","ch":6,"final":false},{"id":"f6_weichenmotor","ch":6,"final":false},{"id":"f6_wecker","ch":6,"final":false},{"id":"f6_boss","ch":6,"final":false},{"id":"f7_takt","ch":7,"final":false},{"id":"f7_blinker","ch":7,"final":false},{"id":"f7_laufzeit","ch":7,"final":false},{"id":"f7_wechsel","ch":7,"final":false},{"id":"f7_blink_dbg","ch":7,"final":false},{"id":"f7_raeumen","ch":7,"final":false},{"id":"f7_ueber_dbg","ch":7,"final":false},{"id":"f7_vorlaeuten","ch":7,"final":false},{"id":"f7_zeitaufloesung","ch":7,"final":false},{"id":"f7_boss","ch":7,"final":false},{"id":"f8_ctu","ch":8,"final":false},{"id":"f8_anzeige","ch":8,"final":false},{"id":"f8_ctd","ch":8,"final":false},{"id":"f8_pv_dbg","ch":8,"final":false},{"id":"f8_achszaehler","ch":8,"final":false},{"id":"f8_reset_dbg","ch":8,"final":false},{"id":"f8_zuege","ch":8,"final":false},{"id":"f8_signal","ch":8,"final":false},{"id":"f8_ctd_dbg","ch":8,"final":false},{"id":"f8_boss","ch":8,"final":false},{"id":"f9_tempo","ch":9,"final":false},{"id":"f9_bereich","ch":9,"final":false},{"id":"f9_zugnummer","ch":9,"final":false},{"id":"f9_begriff","ch":9,"final":false},{"id":"f9_grenze_dbg","ch":9,"final":false},{"id":"f9_zuglaenge","ch":9,"final":false},{"id":"f9_verspaetung","ch":9,"final":false},{"id":"f9_begriff_dbg","ch":9,"final":false},{"id":"f9_tempo_move","ch":9,"final":false},{"id":"f9_boss","ch":9,"final":false},{"id":"f10_einstellen","ch":10,"final":false},{"id":"f10_sichern","ch":10,"final":false},{"id":"f10_signal","ch":10,"final":false},{"id":"f10_aufloesen","ch":10,"final":false},{"id":"f10_signal_dbg","ch":10,"final":false},{"id":"f10_feind","ch":10,"final":false},{"id":"f10_feind_dbg","ch":10,"final":false},{"id":"f10_flankenschutz","ch":10,"final":false},{"id":"f10_automatik","ch":10,"final":false},{"id":"f10_final","ch":10,"final":true},{"id":"fp11_erste_fc","ch":11,"final":false},{"id":"fp11_schnittstelle","ch":11,"final":false},{"id":"fp11_aufruf","ch":11,"final":false},{"id":"fp11_zwei","ch":11,"final":false},{"id":"fp11_aufruf_dbg","ch":11,"final":false},{"id":"fp11_retval","ch":11,"final":false},{"id":"fp11_temp","ch":11,"final":false},{"id":"fp11_temp_dbg","ch":11,"final":false},{"id":"fp11_speicher_dbg","ch":11,"final":false},{"id":"fp11_boss","ch":11,"final":false},{"id":"fp12_weiche","ch":12,"final":false},{"id":"fp12_stoerung","ch":12,"final":false},{"id":"fp12_instanzen","ch":12,"final":false},{"id":"fp12_achsen","ch":12,"final":false},{"id":"fp12_instanz_dbg","ch":12,"final":false},{"id":"fp12_timer","ch":12,"final":false},{"id":"fp12_abschnitt","ch":12,"final":false},{"id":"fp12_multi","ch":12,"final":false},{"id":"fp12_timer_dbg","ch":12,"final":false},{"id":"fp12_boss","ch":12,"final":false},{"id":"fp13_db","ch":13,"final":false},{"id":"fp13_parameter","ch":13,"final":false},{"id":"fp13_udt","ch":13,"final":false},{"id":"fp13_db_tabelle","ch":13,"final":false},{"id":"fp13_db_dbg","ch":13,"final":false},{"id":"fp13_array","ch":13,"final":false},{"id":"fp13_struct_param","ch":13,"final":false},{"id":"fp13_move_struct","ch":13,"final":false},{"id":"fp13_array_dbg","ch":13,"final":false},{"id":"fp13_boss","ch":13,"final":false},{"id":"fp14_signal","ch":14,"final":false},{"id":"fp14_bue","ch":14,"final":false},{"id":"fp14_weiche","ch":14,"final":false},{"id":"fp14_global_dbg","ch":14,"final":false},{"id":"fp14_verschaltung","ch":14,"final":false},{"id":"fp14_betriebsart","ch":14,"final":false},{"id":"fp14_inout","ch":14,"final":false},{"id":"fp14_meldung","ch":14,"final":false},{"id":"fp14_verschaltung_dbg","ch":14,"final":false},{"id":"fp14_boss","ch":14,"final":false},{"id":"fp15_anlauf","ch":15,"final":false},{"id":"fp15_struktur","ch":15,"final":false},{"id":"fp15_reihenfolge_dbg","ch":15,"final":false},{"id":"fp15_warnfrei","ch":15,"final":false},{"id":"fp15_anlauf_dbg","ch":15,"final":false},{"id":"fp15_status","ch":15,"final":false},{"id":"fp15_diagnose","ch":15,"final":false},{"id":"fp15_fahrstrasse","ch":15,"final":false},{"id":"fp15_quit_dbg","ch":15,"final":false},{"id":"fp15_final","ch":15,"final":true}],"awl":[{"id":"a1_rollgang","ch":1,"final":false},{"id":"a1_und","ch":1,"final":false},{"id":"a1_pumpe","ch":1,"final":false},{"id":"a1_zwei","ch":1,"final":false},{"id":"a1_schere_dbg","ch":1,"final":false},{"id":"a1_ketten","ch":1,"final":false},{"id":"a1_netzwerke","ch":1,"final":false},{"id":"a1_zufrueh_dbg","ch":1,"final":false},{"id":"a1_kette","ch":1,"final":false},{"id":"a1_boss","ch":1,"final":false},{"id":"a2_un","ch":2,"final":false},{"id":"a2_oder","ch":2,"final":false},{"id":"a2_on","ch":2,"final":false},{"id":"a2_x","ch":2,"final":false},{"id":"a2_und_vor_oder","ch":2,"final":false},{"id":"a2_klammer","ch":2,"final":false},{"id":"a2_klammer_dbg","ch":2,"final":false},{"id":"a2_un_klammer","ch":2,"final":false},{"id":"a2_x_dbg","ch":2,"final":false},{"id":"a2_boss","ch":2,"final":false},{"id":"a3_selbsthaltung","ch":3,"final":false},{"id":"a3_sr","ch":3,"final":false},{"id":"a3_vorrang","ch":3,"final":false},{"id":"a3_not","ch":3,"final":false},{"id":"a3_notaus_dbg","ch":3,"final":false},{"id":"a3_set","ch":3,"final":false},{"id":"a3_ofen","ch":3,"final":false},{"id":"a3_stoerung","ch":3,"final":false},{"id":"a3_richtung","ch":3,"final":false},{"id":"a3_boss","ch":3,"final":false},{"id":"a4_fp","ch":4,"final":false},{"id":"a4_fn","ch":4,"final":false},{"id":"a4_stromstoss","ch":4,"final":false},{"id":"a4_melden","ch":4,"final":false},{"id":"a4_quit_dbg","ch":4,"final":false},{"id":"a4_nachlauf","ch":4,"final":false},{"id":"a4_merker_dbg","ch":4,"final":false},{"id":"a4_richtung","ch":4,"final":false},{"id":"a4_zweimal","ch":4,"final":false},{"id":"a4_boss","ch":4,"final":false},{"id":"a5_se","ch":5,"final":false},{"id":"a5_sa","ch":5,"final":false},{"id":"a5_si","ch":5,"final":false},{"id":"a5_sv","ch":5,"final":false},{"id":"a5_zeit_dbg","ch":5,"final":false},{"id":"a5_vorwarnung","ch":5,"final":false},{"id":"a5_blinker","ch":5,"final":false},{"id":"a5_art_dbg","ch":5,"final":false},{"id":"a5_ueberwachung","ch":5,"final":false},{"id":"a5_boss","ch":5,"final":false},{"id":"a6_zv","ch":6,"final":false},{"id":"a6_reset","ch":6,"final":false},{"id":"a6_zr","ch":6,"final":false},{"id":"a6_uz","ch":6,"final":false},{"id":"a6_reset_dbg","ch":6,"final":false},{"id":"a6_vorwahl","ch":6,"final":false},{"id":"a6_ofen","ch":6,"final":false},{"id":"a6_zaehler_dbg","ch":6,"final":false},{"id":"a6_voll","ch":6,"final":false},{"id":"a6_boss","ch":6,"final":false},{"id":"a7_lt","ch":7,"final":false},{"id":"a7_konst","ch":7,"final":false},{"id":"a7_richtung_dbg","ch":7,"final":false},{"id":"a7_mehrfach","ch":7,"final":false},{"id":"a7_akku","ch":7,"final":false},{"id":"a7_tak","ch":7,"final":false},{"id":"a7_zeitwert","ch":7,"final":false},{"id":"a7_zaehlwert","ch":7,"final":false},{"id":"a7_vke_dbg","ch":7,"final":false},{"id":"a7_boss","ch":7,"final":false},{"id":"a8_plus","ch":8,"final":false},{"id":"a8_minus","ch":8,"final":false},{"id":"a8_mal","ch":8,"final":false},{"id":"a8_div_mod","ch":8,"final":false},{"id":"a8_reihenfolge_dbg","ch":8,"final":false},{"id":"a8_mittel","ch":8,"final":false},{"id":"a8_runden","ch":8,"final":false},{"id":"a8_inc","ch":8,"final":false},{"id":"a8_ganzzahl_dbg","ch":8,"final":false},{"id":"a8_boss","ch":8,"final":false},{"id":"a9_groesser","ch":9,"final":false},{"id":"a9_kleiner","ch":9,"final":false},{"id":"a9_gleich","ch":9,"final":false},{"id":"a9_klammer","ch":9,"final":false},{"id":"a9_klammer_dbg","ch":9,"final":false},{"id":"a9_fenster","ch":9,"final":false},{"id":"a9_real","ch":9,"final":false},{"id":"a9_ungleich","ch":9,"final":false},{"id":"a9_grenze_dbg","ch":9,"final":false},{"id":"a9_boss","ch":9,"final":false},{"id":"a10_spbn","ch":10,"final":false},{"id":"a10_verzweigung","ch":10,"final":false},{"id":"a10_spa_dbg","ch":10,"final":false},{"id":"a10_zaehlen","ch":10,"final":false},{"id":"a10_bea","ch":10,"final":false},{"id":"a10_loop","ch":10,"final":false},{"id":"a10_betriebsart","ch":10,"final":false},{"id":"a10_spb_dbg","ch":10,"final":false},{"id":"a10_beb","ch":10,"final":false},{"id":"a10_final","ch":10,"final":true},{"id":"ap11_erste_fc","ch":11,"final":false},{"id":"ap11_schnittstelle","ch":11,"final":false},{"id":"ap11_aufruf","ch":11,"final":false},{"id":"ap11_zwei","ch":11,"final":false},{"id":"ap11_aufruf_dbg","ch":11,"final":false},{"id":"ap11_retval","ch":11,"final":false},{"id":"ap11_temp","ch":11,"final":false},{"id":"ap11_temp_dbg","ch":11,"final":false},{"id":"ap11_speicher_dbg","ch":11,"final":false},{"id":"ap11_boss","ch":11,"final":false},{"id":"ap12_selbsthaltung","ch":12,"final":false},{"id":"ap12_stoerung","ch":12,"final":false},{"id":"ap12_instanzen","ch":12,"final":false},{"id":"ap12_flanke","ch":12,"final":false},{"id":"ap12_instanz_dbg","ch":12,"final":false},{"id":"ap12_timer","ch":12,"final":false},{"id":"ap12_ueberwachung","ch":12,"final":false},{"id":"ap12_multi","ch":12,"final":false},{"id":"ap12_timer_dbg","ch":12,"final":false},{"id":"ap12_boss","ch":12,"final":false},{"id":"ap13_db","ch":13,"final":false},{"id":"ap13_parameter","ch":13,"final":false},{"id":"ap13_udt","ch":13,"final":false},{"id":"ap13_db_tabelle","ch":13,"final":false},{"id":"ap13_db_dbg","ch":13,"final":false},{"id":"ap13_array","ch":13,"final":false},{"id":"ap13_struct_param","ch":13,"final":false},{"id":"ap13_protokoll","ch":13,"final":false},{"id":"ap13_array_dbg","ch":13,"final":false},{"id":"ap13_boss","ch":13,"final":false},{"id":"ap14_antrieb","ch":14,"final":false},{"id":"ap14_rollgang","ch":14,"final":false},{"id":"ap14_ofen","ch":14,"final":false},{"id":"ap14_global_dbg","ch":14,"final":false},{"id":"ap14_verschaltung","ch":14,"final":false},{"id":"ap14_betriebsart","ch":14,"final":false},{"id":"ap14_inout","ch":14,"final":false},{"id":"ap14_meldung","ch":14,"final":false},{"id":"ap14_verschaltung_dbg","ch":14,"final":false},{"id":"ap14_boss","ch":14,"final":false},{"id":"ap15_anlauf","ch":15,"final":false},{"id":"ap15_struktur","ch":15,"final":false},{"id":"ap15_reihenfolge_dbg","ch":15,"final":false},{"id":"ap15_warnfrei","ch":15,"final":false},{"id":"ap15_anlauf_dbg","ch":15,"final":false},{"id":"ap15_status","ch":15,"final":false},{"id":"ap15_diagnose","ch":15,"final":false},{"id":"ap15_ablauf","ch":15,"final":false},{"id":"ap15_quit_dbg","ch":15,"final":false},{"id":"ap15_final","ch":15,"final":true}],"sensor":[{"id":"w1_datenblatt","ch":1,"final":false},{"id":"w1_b1_anschliessen","ch":1,"final":false},{"id":"w1_start_stopp","ch":1,"final":false},{"id":"w1_variablentabelle","ch":1,"final":false},{"id":"w1_band_selbsthaltung","ch":1,"final":false},{"id":"w1_antivalent","ch":1,"final":false},{"id":"w1_drahtbruch_s5","ch":1,"final":false},{"id":"w1_antivalenz_prog","ch":1,"final":false},{"id":"w1_fehler_bk_ebene","ch":1,"final":false},{"id":"w1_boss_sortierstrecke","ch":1,"final":false},{"id":"w2_pnp_messen","ch":2,"final":false},{"id":"w2_npn_messen","ch":2,"final":false},{"id":"w2_1m_cpu","ch":2,"final":false},{"id":"w2_sm1221_npn","ch":2,"final":false},{"id":"w2_teilezaehler","ch":2,"final":false},{"id":"w2_tabelle","ch":2,"final":false},{"id":"w2_ersatz_npn","ch":2,"final":false},{"id":"w2_fehler_npn_pnp","ch":2,"final":false},{"id":"w2_fehler_bk_m","ch":2,"final":false},{"id":"w2_boss_umbau","ch":2,"final":false},{"id":"w3_schaltabstand","ch":3,"final":false},{"id":"w3_einbauabstand","ch":3,"final":false},{"id":"w3_b2_poti","ch":3,"final":false},{"id":"w3_b3_teach","ch":3,"final":false},{"id":"w3_materialsortierung","ch":3,"final":false},{"id":"w3_einweg","ch":3,"final":false},{"id":"w3_zylinderschalter","ch":3,"final":false},{"id":"w3_endlagen_ueberwachung","ch":3,"final":false},{"id":"w3_fehler_alu","ch":3,"final":false},{"id":"w3_boss_sieben","ch":3,"final":false},{"id":"w4_b10_anschliessen","ch":4,"final":false},{"id":"w4_rohwerte_spannung","ch":4,"final":false},{"id":"w4_b11_2leiter","ch":4,"final":false},{"id":"w4_rohwerte_strom","ch":4,"final":false},{"id":"w4_loopcheck","ch":4,"final":false},{"id":"w4_b12_schirm","ch":4,"final":false},{"id":"w4_trennmesser","ch":4,"final":false},{"id":"w4_b13_4leiter","ch":4,"final":false},{"id":"w4_rohwert_status","ch":4,"final":false},{"id":"w4_boss_tank","ch":4,"final":false},{"id":"w5_von_hand","ch":5,"final":false},{"id":"w5_druck","ch":5,"final":false},{"id":"w5_pegel","ch":5,"final":false},{"id":"w5_temp","ch":5,"final":false},{"id":"w5_ultraschall","ch":5,"final":false},{"id":"w5_pumpe_aq","ch":5,"final":false},{"id":"w5_ventil","ch":5,"final":false},{"id":"w5_fehler_0_20","ch":5,"final":false},{"id":"w5_fehler_32767","ch":5,"final":false},{"id":"w5_boss_hmi","ch":5,"final":false},{"id":"w6_heizung_hysterese","ch":6,"final":false},{"id":"w6_fuellstand_grenzen","ch":6,"final":false},{"id":"w6_offset","ch":6,"final":false},{"id":"w6_zweipunkt","ch":6,"final":false},{"id":"w6_mittelwert","ch":6,"final":false},{"id":"w6_plausi","ch":6,"final":false},{"id":"w6_trockenlauf","ch":6,"final":false},{"id":"w6_fehler_takt","ch":6,"final":false},{"id":"w6_fehler_b8","ch":6,"final":false},{"id":"w6_finale","ch":6,"final":true}]};
