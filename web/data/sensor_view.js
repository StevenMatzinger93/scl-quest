// ERZEUGT von dev/build.js – nicht von Hand ändern. Verdrahtungsansicht der Sensorwerkstatt für den Leitstand.
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
  // Lokaldaten-Rest (wie in der CPU): Ein FC-Ausgang, der in einem Aufruf nicht geschrieben wird, ist nicht 0, sondern
  // enthält, was vom letzten Aufruf derselben FC auf dem Stapel liegt – S/R-Spulen in einer FC „merken“ sich dadurch zufällig etwas.
  fcResidue(u, tmp){ const r = (this.lstack = this.lstack || {})[u.name]; if(r) u.iface.Output.forEach(v => { if(r[v.name] !== undefined) tmp[v.name] = cloneVal(r[v.name]); }); }
  fcKeep(u, tmp){ const o = {}; u.iface.Output.forEach(v => { o[v.name] = cloneVal(tmp[v.name]); }); (this.lstack = this.lstack || {})[u.name] = o; }
  callFC(u, e, F){
    this.enter(e, F);
    const tmp = {}, refs = {};
    u.iface.Input.concat(u.iface.Output, u.iface.Temp).forEach(v => tmp[v.name] = v.init !== undefined ? cloneVal(v.init) : defaultVal(v.type));
    this.fcResidue(u, tmp);
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
    this.fcKeep(u, tmp);
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
// force (Störungssimulation): Eingänge hängen fest – { Pfad: Wert } nach den Testeingaben vor jedem Zyklus
function applyForce(opts, setter){ if(opts && opts.force) applyInputs(opts.force, setter); }
function asSCL(e){ if(e instanceof SCLError) return e; throw e; }
// Messmodus (Funktionsvergleich, equiv.js): nie abbrechen, nur Istwerte sammeln
const probe = opts => !!(opts && opts.probe);

function runProgramTests(prog, cases, opts){
  const report = []; let ok = true;
  for(const tc of cases){
    const S = new Session(prog);
    let error = null;
    try{ S.startup(); applyInputs(tc.setup, (k, v) => S.set(k, v)); applyForce(opts, (k, v) => S.set(k, v)); S.scan(0); }catch(e){ error = asSCL(e); }
    const checks = doChecks(tc.expect, k => S.get(k), error);
    const pass = !error && (probe(opts) || checks.every(c => c.pass));
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
      if(!error){ try{ applyInputs(step.inputs, (k, v) => S.set(k, v)); applyForce(opts, (k, v) => S.set(k, v)); S.scan(step.dt || 0); }catch(e){ error = asSCL(e); } }
      const checks = doChecks(step.expect, k => S.get(k), error);
      const pass = !error && (probe(opts) || checks.every(c => c.pass));
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
          applyForce(opts, setP);
          const tmp = {};
          if(u.kind === 'FC'){
            u.iface.Input.concat(u.iface.Output, u.iface.Temp).forEach(v => tmp[v.name] = v.init !== undefined ? cloneVal(v.init) : defaultVal(v.type));
            if(u.retVar) tmp[u.retVar.name] = defaultVal(u.retVar.type);
            Object.keys(inVals).forEach(k => { const v = u.map[k.toLowerCase()]; tmp[v.name] = fromPlain(inVals[k], v.type); });
            S.fcResidue(u, tmp);
          } else u.iface.Temp.forEach(v => tmp[v.name] = defaultVal(v.type));
          F = {unit: u, inst, tmp, refs, S};
          const rec = S.traceStart(u.kind === 'FB' ? '#Prüfling : "' + u.name + '"' : '"' + u.name + '"', u, u.kind, 0);
          S.execBlock(u.body, F);
          S.traceEnd(rec, u, F);
          if(u.kind === 'FC') S.fcKeep(u, tmp);
        }catch(e){ error = asSCL(e); }
      }
      const checks = doChecks(step.expect, k => {
        const kk = k.toUpperCase() === 'RET' && u.retVar ? u.retVar.name : k;
        return S.get(kk, F);
      }, error);
      const pass = !error && (probe(opts) || checks.every(c => c.pass));
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
  if(spec.tests && spec.tests.length) parts.push(Object.assign({kind:'tests'}, runProgramTests(prog, spec.tests, opts)));
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

/* ==== sensor_model.js ==== */
(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Simulationsmodell (docs/SENSORWERKSTATT_PLAN.md Teil 5, Fehlerliste Teil 3.4)
   Physik → Sensor/Messumformer → Montage/Stecker → Leitung/Klemmen → Versorgung → DI-Gruppe (1M) / AI-Kanal → Rohwert
   Rein rechnend, ohne DOM. Szene, Tests, Validator und Störungsjagd nutzen dasselbe Modell.
   Werte mit [prüfen] stammen aus docs/SENSORWERKSTATT_FAKTEN.md und sind gegen die Siemens-Handbücher zu kontrollieren.
   ============================================================ */
const DT = 0.05;                                   // Zeitschritt Physik + SPS-Zyklus: 50 ms
const RAW = { NOM: 27648, OVER: 32511, UNDER: -4864, OVERFLOW: 32767, UNDERFLOW: -32768 };
// Analogwertdarstellung S7-1200/1500 (Faktenblatt 5)
const LIMITS = {
  U0_10:  { lo: 0, hi: 10, over: 11.759, overflow: 11.852, unit: 'V' },
  I4_20:  { lo: 4, hi: 20, over: 22.81, overflow: 22.96, under: 1.185, unit: 'mA' },
  I0_20:  { lo: 0, hi: 20, over: 23.52, overflow: 23.70, unit: 'mA' },
  U_PM10: { lo: -10, hi: 10, over: 11.759, overflow: 11.852, unit: 'V' }
};
const RANGE_OF = { '0..10V': 'U0_10', '4..20mA': 'I4_20', '0..20mA': 'I0_20', '±10V': 'U_PM10', '+-10V': 'U_PM10' };

/* ---------- Zufall (deterministisch) ---------- */
function rng(seed){ let a = (typeof seed === 'number' ? seed : hashStr(String(seed))) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Analoge Kennlinien ---------- */
// physikalischer Wert x im Messbereich xmin…xmax → Signal (V oder mA) des Messumformers
function signal(kind, x, xmin, xmax){
  const f = (x - xmin) / (xmax - xmin);
  if(kind === 'U0_10') return 10 * f;
  if(kind === 'I4_20') return 4 + 16 * f;
  if(kind === 'I0_20') return 20 * f;
  if(kind === 'U_PM10') return -10 + 20 * f;
  throw new Error('Unbekannte Signalart ' + kind);
}
// Signal → physikalischer Wert (Umkehrung)
function physical(kind, s, xmin, xmax){
  const f = kind === 'U0_10' ? s / 10 : kind === 'I4_20' ? (s - 4) / 16 : kind === 'I0_20' ? s / 20 : (s + 10) / 20;
  return xmin + f * (xmax - xmin);
}
// Signal am Kanal → Rohwert, abhängig von der Kanal-Konfiguration { type:'U'|'I_2W'|'I_4W'|'off', range, diag:{wireBreak, overflow, underflow} }
// sig: { kind:'U'|'I', value } — elektrische Grösse, die tatsächlich an den Klemmen ansteht (null = nichts angeschlossen / Schleife offen)
function rawValue(sig, cfg){
  cfg = cfg || {};
  if(!cfg.type || cfg.type === 'off') return 0;
  const rk = RANGE_OF[cfg.range] || (cfg.type === 'U' ? 'U0_10' : 'I4_20'), L = LIMITS[rk];
  const diag = cfg.diag || {};
  const isCurrentCh = cfg.type !== 'U';
  let v;
  if(!sig || sig.value == null){ v = isCurrentCh ? 0 : 0; }
  else if(sig.kind === 'I' && !isCurrentCh){ v = sig.value * 0.0005; }          // Strom in Spannungskanal: ≈ 0 V (hochohmiger Eingang, Vereinfachung)
  else if(sig.kind === 'U' && isCurrentCh){ v = clamp(sig.value * 4, 0, 30); }  // Spannung an Stromkanal: Unsinn / Übersteuerung (Vereinfachung)
  else v = sig.value;
  // Drahtbruch / Unterlauf bei 4–20 mA
  if(rk === 'I4_20' && v < L.under){ return diag.wireBreak ? RAW.OVERFLOW : RAW.UNDERFLOW; }   // [prüfen] Sonderwerte je Diagnose-Einstellung
  if(v >= L.overflow) return RAW.OVERFLOW;
  if(rk === 'U_PM10' && v <= -L.overflow) return RAW.UNDERFLOW;
  let raw;
  if(rk === 'U_PM10') raw = Math.round(v / 10 * RAW.NOM);
  else raw = Math.round((v - L.lo) / (L.hi - L.lo) * RAW.NOM);
  if(raw > RAW.OVER) return RAW.OVERFLOW;
  if(rk === 'I4_20' && raw < RAW.UNDER) return RAW.UNDERFLOW;
  if(rk === 'U0_10' || rk === 'I0_20') raw = Math.max(0, raw);
  return raw;
}
// Rohwert → Diagnose (für Diagnosepuffer, LED am Modul)
function rawDiag(raw, cfg){
  const diag = (cfg && cfg.diag) || {};
  if(raw === RAW.OVERFLOW) return diag.wireBreak && (RANGE_OF[cfg.range] === 'I4_20') ? 'Drahtbruch oder Überlauf' : 'Überlauf';
  if(raw === RAW.UNDERFLOW) return 'Unterlauf';
  if(raw > RAW.NOM) return 'Übersteuerung';
  if(raw < 0) return 'Untersteuerung';
  return null;
}
// Analogausgabe: Rohwert (%QW) → Signal
function aqSignal(raw, cfg){
  const rk = RANGE_OF[(cfg && cfg.range) || '0..10V'] || 'U0_10', L = LIMITS[rk];
  raw = clamp(raw, rk === 'U_PM10' ? -RAW.OVER : 0, RAW.OVER);
  return rk === 'U_PM10' ? raw / RAW.NOM * 10 : L.lo + raw / RAW.NOM * (L.hi - L.lo);
}

/* ---------- Digitale Sensoren ---------- */
// Reduktionsfaktoren induktiv (Richtwerte, Faktenblatt 7 [prüfen])
const MATERIALS = {
  stahl:        { name: 'Stahl', ind: 1.0, kap: 1.0, opt: 1.0, glass: false, metal: true },
  edelstahl:    { name: 'Edelstahl', ind: 0.7, kap: 1.0, opt: 1.0, glass: false, metal: true },
  aluminium:    { name: 'Aluminium', ind: 0.4, kap: 1.0, opt: 0.9, glass: false, metal: true },
  messing:      { name: 'Messing', ind: 0.5, kap: 1.0, opt: 1.0, glass: false, metal: true },
  kunststoff_w: { name: 'Kunststoff weiss', ind: 0, kap: 0.5, opt: 1.0, glass: false, metal: false },
  kunststoff_s: { name: 'Kunststoff schwarz', ind: 0, kap: 0.5, opt: 0.35, glass: false, metal: false },
  glas:         { name: 'Glas', ind: 0, kap: 0.25, opt: 0.15, glass: true, metal: false },
  wasser:       { name: 'Wasser', ind: 0, kap: 0.9, opt: 0.2, glass: false, metal: false },
  band:         { name: 'Transportband (Gummi)', ind: 0, kap: 0.3, opt: 0.6, glass: false, metal: false },
  acryl:        { name: 'Acrylwand (leerer Tank)', ind: 0, kap: 0.35, opt: 0.1, glass: true, metal: false }
};
/* Kapazitiv: Poti p (0…1) = Empfindlichkeit. Erkannt wird ein Material mit kap ≥ 1 − p.
   Metall (1,0) immer · Wasser (0,9) ab p ≥ 0,1 · Kunststoff (0,5) ab „mittel“ p ≥ 0,5 · Band (0,3) erst ab p ≥ 0,7 · Glas (0,25) nur „hoch“ p ≥ 0,75 */
const HYST = 0.10;   // Schalthysterese 10 % (Vereinfachung, im Spiel markiert)
/* Sensor-Definition: { kind:'ind'|'kap'|'opt_taster'|'opt_bgs'|'opt_einweg'|'opt_reflex'|'reed'|'zylinder'|'taster'|'schwimmer',
   sn (mm, Nennschaltabstand), out:'PNP'|'NPN', contact:'NO'|'NC'|'antivalent', light:'hell'|'dunkel', poti (0…1, kapazitiv), teach (mm, Hintergrundausblendung) }
   Objekt: { material, dist (mm) } oder null (kein Objekt)
   state: { on } – für die Hysterese; wird aktualisiert */
function detects(s, obj, state){
  state = state || {};
  if(!obj) return false;
  const m = MATERIALS[obj.material] || MATERIALS.stahl;
  let reach;
  if(s.kind === 'ind') reach = (s.sn || 8) * m.ind;
  else if(s.kind === 'kap'){ const p = clamp(s.poti == null ? 0.5 : s.poti, 0, 1); reach = m.kap >= 1 - p - 1e-9 ? (s.sn || 8) * Math.max(0.1, p) : 0; }
  else if(s.kind === 'opt_taster') reach = (s.sn || 100) * m.opt;
  else if(s.kind === 'opt_bgs'){ reach = s.teach == null ? (s.sn || 100) : s.teach - 3; if(m.glass) reach *= 0.5; }   // Hintergrundausblendung: alles vor der Teach-Distanz
  else if(s.kind === 'opt_einweg') return !!obj && (obj.dist == null || obj.dist >= 0);                                 // unterbricht den Strahl (auch Glas)
  else if(s.kind === 'opt_reflex') return !m.glass || !!state.glassFlip;                                                // Glas nur unsicher (Polarisationsfilter)
  else if(s.kind === 'zylinder' || s.kind === 'reed' || s.kind === 'schwimmer') reach = s.sn || 3;
  else reach = s.sn || 0;
  const d = obj.dist == null ? 0 : obj.dist;
  const on = state.on ? d <= reach * (1 + HYST) : d <= reach;
  return reach > 0 && on;
}
// Schaltzustand am Ausgang (logisch, vor Verdrahtung): NO/NC/hell-dunkel
function outputs(s, detected){
  // Lichtschranken (Einweg, Reflex): „detected“ = Strahl unterbrochen. Hellschaltend = Ausgang an, wenn Licht am Empfänger ankommt.
  // Taster: „detected“ = Licht vom Objekt zurück. Ohne Angabe: Ausgang an, wenn ein Objekt erkannt wird.
  const beam = s.kind === 'opt_einweg' || s.kind === 'opt_reflex', light = beam ? !detected : detected;
  const act = s.light === 'hell' ? light : s.light === 'dunkel' ? !light : detected;
  if(s.contact === 'NC') return { BK: !act, WH: null };
  if(s.contact === 'antivalent') return { BK: act, WH: !act };
  return { BK: act, WH: null };
}

/* ---------- Digitaleingang mit Eingangsbeschaltung (1M) ---------- */
/* PNP (plusschaltend): Ausgang aktiv = L+ auf BK. Eingang „stromziehend“ (1M an M) sieht Strom → 1.
   NPN (minusschaltend): Ausgang aktiv = M auf BK. Eingang „stromliefernd“ (1M an L+) sieht Strom → 1.
   Rückgabe: { sensorLed, inputLed, value } */
function digitalInput(o){
  // 1M offen (null) → kein Stromkreis, Eingang bleibt 0
  const out = o.out || 'PNP', m1 = o.group1M === undefined ? 'M' : o.group1M, powered = o.supply !== false && !o.psuOverload && !o.fuseTripped;
  const res = { sensorPower: powered, sensorLed: false, inputLed: false, value: false, shortCircuit: false };
  if(!powered) return res;
  if(o.fault === 'swap_bn_bu'){ return res; }                      // verpolt: Sensor ohne Funktion (verpolungsgeschützt)
  const active = !!o.active;
  res.sensorLed = active;
  if(o.fault === 'bk_on_m' && out === 'PNP' && active){ res.shortCircuit = true; res.sensorLed = 'blink'; return res; }   // Kurzschlussschutz
  if(o.fault === 'wire_open') return res;
  let current;
  if(out === 'PNP') current = active && m1 === 'M';
  else current = active && m1 === 'L+';
  if(o.dropout) current = false;                                    // Wackelkontakt in diesem Zyklus
  res.inputLed = current; res.value = current;
  return res;
}

/* ---------- Versorgung, Sicherungen ---------- */
function supply(net){
  // net: { lplusToM:true (Kurzschluss L+/M), sensorShort:true (Kurzschluss hinter -F2), load_mA }
  const r = { dcOk: true, psuOverload: false, f2Tripped: false, f3Tripped: false };
  if(net && net.lplusToM){ r.dcOk = false; r.psuOverload = true; return r; }
  if(net && net.sensorShort) r.f2Tripped = true;
  if(net && net.actorShort) r.f3Tripped = true;
  if(net && net.load_mA > 5000){ r.dcOk = false; r.psuOverload = true; }
  return r;
}

/* ---------- Wackelkontakt, Rauschen, Drift ---------- */
// Wackelkontakt (Stecker nicht festgezogen / Ader ohne Hülse): sporadische Aussetzer, deterministisch per Seed
function looseContact(seed, t, rate){
  const r = rng(hashStr(String(seed)) ^ Math.floor(t / DT));
  return r() < (rate == null ? 0.08 : rate);
}
// Rauschen auf dem Rohwert: Schirm nicht aufgelegt → ±1–2 % vom Nennbereich; mit Schirm sehr klein
function noise(seed, t, shielded, amp){
  const r = rng(hashStr(String(seed)) ^ Math.floor(t / DT) * 2654435761);
  const a = amp != null ? amp : shielded ? 0.0005 : 0.015;
  return Math.round((r() * 2 - 1) * a * RAW.NOM);
}
// Sensor nicht festgezogen: Schaltabstand driftet durch Vibration (mm pro Sekunde Bandlauf)
function mountDrift(dist, tight, running, dt){ return tight || !running ? dist : dist + 0.02 * dt; }
// Glättung des Moduls: gleitender Mittelwert über n Zyklen
function smooth(prev, raw, level){ const n = { keine: 1, schwach: 4, mittel: 16, stark: 32 }[level || 'keine'] || 1; return prev == null ? raw : Math.round(prev + (raw - prev) / n); }

/* ---------- Tankstation ---------- */
const TANK = { d: 0.30, h: 0.60, area: Math.PI * 0.15 * 0.15, rho: 1000, g: 9.81, c: 4186, qMax: 20 / 60000, kOut: 0.00010, heater: 2000, ua: 6, tAmb: 20, tIn: 15, reserveL: 40 };
function tankNew(o){ return Object.assign({ level: 0, temp: TANK.tAmb, reserve: TANK.reserveL / 1000, t: 0 }, o || {}); }
/* Ein Schritt (dt s). u: { pumpFree, pumpPct (0…100), valvePct (Stellventil 0…100, null = offen), inlet (Zulauf-Magnetventil), drain (Ablauf), heater } */
function tankStep(st, u, dt){
  dt = dt || DT;
  const s = Object.assign({}, st);
  const pump = u.pumpFree && u.inlet !== false ? clamp(u.pumpPct == null ? 100 : u.pumpPct, 0, 100) / 100 : 0;
  const valve = u.valvePct == null ? 1 : clamp(u.valvePct, 0, 100) / 100;
  let qIn = TANK.qMax * pump * valve;                                                // m³/s
  if(s.reserve <= 0) qIn = 0;                                                      // Trockenlauf
  let qOut = u.drain ? TANK.kOut * Math.sqrt(Math.max(0, s.level)) : 0;
  let vol = s.level * TANK.area;
  const vMax = TANK.h * TANK.area;
  qIn = Math.min(qIn, s.reserve / dt);
  const mBefore = vol * TANK.rho;
  vol = vol + (qIn - qOut) * dt;
  let overflow = 0; if(vol > vMax){ overflow = vol - vMax; vol = vMax; }
  qOut = Math.min(qOut, (vol + qOut * dt) / dt);
  vol = Math.max(0, vol);
  s.reserve = Math.max(0, s.reserve - qIn * dt + qOut * dt + overflow);            // Kreislauf: Ablauf und Überlauf zurück in den Vorrat
  // Temperatur: Mischung mit Zulauf, Heizleistung, Verlust an die Umgebung
  const m = vol * TANK.rho;
  if(m > 0.05){
    const mixIn = qIn * dt * TANK.rho;
    let T = (s.temp * mBefore + TANK.tIn * mixIn) / Math.max(0.05, mBefore + mixIn);
    T += ((u.heater && s.level > 0.05 ? TANK.heater : 0) - TANK.ua * (T - TANK.tAmb)) * dt / (m * TANK.c);
    s.temp = T;
  }
  s.level = vol / TANK.area; s.t = (st.t || 0) + dt;
  s.flow = qIn * 60000;                                                             // l/min
  s.pressure = TANK.rho * TANK.g * s.level / 100;                                   // mbar (1 mbar = 100 Pa)
  s.overflow = overflow > 0;
  return s;
}
// Messgrössen der Tankstation (vor Signalumwandlung)
function tankMeasure(s, mountHeight){
  const H = mountHeight == null ? 0.80 : mountHeight;                              // Einbauhöhe Ultraschall über Boden [m]
  const dist = Math.max(0, (H - s.level) * 1000);                                  // mm
  return { level_mm: s.level * 1000, distance_mm: dist, distance_valid: dist >= 60 && dist <= 800, pressure_mbar: s.pressure || 0, temp_c: s.temp, flow_lmin: s.flow || 0 };
}
// Transmitter der Tankstation (Grundbelegung, Plan 2.2/2.4)
const TRANSMITTERS = {
  B10: { kind: 'U0_10', min: 60, max: 800, quantity: 'distance_mm', wires: 3, name: 'Ultraschall 60–800 mm, 0–10 V' },
  B11: { kind: 'I4_20', min: 0, max: 100, quantity: 'pressure_mbar', wires: 2, name: 'Drucktransmitter 0–100 mbar, 4–20 mA, 2-Leiter' },
  B12: { kind: 'I4_20', min: 0, max: 100, quantity: 'temp_c', wires: 2, name: 'PT100 mit Kopftransmitter 0–100 °C, 4–20 mA, 2-Leiter' },
  B13: { kind: 'I4_20', min: 0, max: 20, quantity: 'flow_lmin', wires: 4, name: 'MID 0–20 l/min, 4–20 mA, 4-Leiter' },
  R1:  { kind: 'U0_10', min: 0, max: 100, quantity: 'setpoint_pct', wires: 3, name: 'Sollwertsteller 0–10 V' }
};
/* Signal eines Messumformers an den Klemmen, inkl. Verdrahtungs-/Montagefehler
   w: { powered, loop:'ok'|'open'|'no_supply'|'as_2wire' (4-Leiter wie 2-Leiter angeschlossen), trennOpen, blindZone } */
function transmitterSignal(id, x, w){
  const T = TRANSMITTERS[id]; if(!T) throw new Error('Unbekannter Messumformer ' + id);
  w = w || {};
  if(w.powered === false || w.trennOpen || w.loop === 'open' || w.loop === 'no_supply' || (T.wires === 4 && w.loop === 'as_2wire')) return { kind: T.kind[0], value: 0 };
  if(T.quantity === 'distance_mm' && x < 60) x = 60;                               // Blindzone: näher als 60 mm wird nicht gemessen (Vereinfachung)
  const s = signal(T.kind, clamp(x, T.min - (T.max - T.min) * 0.15, T.max + (T.max - T.min) * 0.2), T.min, T.max);
  return { kind: T.kind[0], value: s };
}

root.SensorModel = { DT, RAW, LIMITS, RANGE_OF, MATERIALS, HYST, TANK, TRANSMITTERS, rng, hashStr,
  signal, physical, rawValue, rawDiag, aqSignal, detects, outputs, digitalInput, supply, looseContact, noise, mountDrift, smooth,
  tankNew, tankStep, tankMeasure, transmitterSignal };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorModel;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== wiring.js ==== */
(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Verdrahtung als Netzliste (docs/SENSORWERKSTATT_PLAN.md Teil 3.1–3.5)
   Knoten = Klemmstellen („B1:BN“, „X2:5.L+“, „A1:DIa.4“), Kanten = Adern, Querbrücker, interne Verbindungen.
   Bewertet wird die elektrische Funktion (welche Klemmstellen liegen auf demselben Potential), nicht die exakte Klemme.
   Speicherformat: { wires:[{from, to, ferrule, label}], bridges:['QB_X2_LP', …], mounts:{B1:{dist, tight}}, plugs:{B1:true}, config:{…}, knives:{'X3:1':true}, shields:{B11:true} }
   Klemmenbezeichnungen der S7-Module: docs/SENSORWERKSTATT_FAKTEN.md ([prüfen]).
   ============================================================ */
const SM = root.SensorModel;

/* ---------- Katalog: Bauteile und ihre Anschlüsse ---------- */
// pins: Name → Bedeutung; wires: Adern der Anschlussleitung (M12 oder Litze)
const PARTS = {
  B1:  { name: 'Induktiver Sensor M18, bündig, PNP NO, Sn 8 mm', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.4', sensor: { kind: 'ind', sn: 8, out: 'PNP', contact: 'NO' } },
  B2:  { name: 'Kapazitiver Sensor M18, PNP NO, Sn 1–8 mm', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.5', sensor: { kind: 'kap', sn: 8, out: 'PNP', contact: 'NO', poti: 0.5 } },
  B3:  { name: 'Lichttaster mit Hintergrundausblendung, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.6', sensor: { kind: 'opt_bgs', sn: 120, out: 'PNP', contact: 'NO' } },
  'B4.1': { name: 'Einweg-Lichtschranke Sender', type: 'sender', pins: ['BN', 'BU'] },
  'B4.2': { name: 'Einweg-Lichtschranke Empfänger, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I0.7', sensor: { kind: 'opt_einweg', out: 'PNP', contact: 'NO' } },
  B5:  { name: 'Reflexions-Lichtschranke, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I1.0', sensor: { kind: 'opt_reflex', out: 'PNP', contact: 'NO' } },
  B6:  { name: 'Zylinderschalter hinten, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I1.1', sensor: { kind: 'zylinder', sn: 3, out: 'PNP', contact: 'NO' } },
  B7:  { name: 'Zylinderschalter vorne, PNP', type: 'sensor3', out: 'PNP', pins: ['BN', 'BU', 'BK'], di: 'I1.2', sensor: { kind: 'zylinder', sn: 3, out: 'PNP', contact: 'NO' } },
  B8:  { name: 'Kapazitiver Grenzschalter „Tank voll“, PNP, als Öffner', type: 'sensor4', out: 'PNP', pins: ['BN', 'BU', 'BK', 'WH'], di: 'I1.4', sensor: { kind: 'kap', sn: 8, out: 'PNP', contact: 'antivalent', poti: 0.5 } },
  B9:  { name: 'Schwimmerschalter Trockenlauf (Reed)', type: 'contact2', pins: ['1', '2'], di: 'I1.5' },
  S1:  { name: 'Taster Start (Schliesser)', type: 'contact2', contact: 'NO', pins: ['13', '14'], di: 'I0.0' },
  S2:  { name: 'Taster Stopp (Öffner)', type: 'contact2', contact: 'NC', pins: ['11', '12'], di: 'I0.1' },
  S3:  { name: 'Not-Halt Kanal 2 (Öffner)', type: 'contact2', contact: 'NC', pins: ['21', '22'], di: 'I0.2' },
  S4:  { name: 'Wahlschalter Auto (Schliesser)', type: 'contact2', contact: 'NO', pins: ['13', '14'], di: 'I0.3' },
  S5:  { name: 'Sicherheits-Positionsschalter Haube (Öffner)', type: 'contact2', contact: 'NC', pins: ['11', '12'], di: 'I1.3' },
  N1:  { name: 'NPN-Sensor (Übung, minusschaltend NO)', type: 'sensor3', out: 'NPN', pins: ['BN', 'BU', 'BK'], di: 'I16.0', sensor: { kind: 'ind', sn: 8, out: 'NPN', contact: 'NO' } },
  B10: { name: 'Ultraschall M30, 0–10 V', type: 'analogU', pins: ['BN', 'BU', 'BK'], ai: 'AI0' },
  B11: { name: 'Drucktransmitter 0–100 mbar, 4–20 mA, 2-Leiter', type: 'analog2w', pins: ['+', '-'], ai: 'CH0' },
  B12: { name: 'PT100 mit Kopftransmitter 0–100 °C, 4–20 mA, 2-Leiter', type: 'analog2w', pins: ['+', '-'], ai: 'CH1' },
  B13: { name: 'MID 0–20 l/min, 4–20 mA, 4-Leiter (aktiv)', type: 'analog4w', pins: ['L+', 'M', 'I+', 'I-'], ai: 'CH2' },
  R1:  { name: 'Sollwertsteller 0–10 V (Potentiometer)', type: 'poti', pins: ['1', '2', '3'], ai: 'AI1' }
};
// Klemmen im Schrank. Knoten-IDs: „X1:L+3“, „X2:5.L+“, „X2:5.S“, „X2:5.M“, „X3:1.a“ (Feld), „X3:1.b“ (SPS), „A1:DIa.4“ …
const X2N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 22, 23, 24, 25, 26, 27, 28];
const DI_OF_X2 = { 1: 'I0.0', 2: 'I0.1', 3: 'I0.2', 4: 'I0.3', 5: 'I0.4', 6: 'I0.5', 7: 'I0.6', 8: 'I0.7', 9: 'I1.0', 10: 'I1.1', 11: 'I1.2', 12: 'I1.3', 13: 'I1.4', 14: 'I1.5', 21: 'I16.0', 22: 'I16.1', 23: 'I16.2', 24: 'I16.3', 25: 'I16.4', 26: 'I16.5', 27: 'I16.6', 28: 'I16.7' };
// Eingänge der CPU (1214C: DIa .0–.7 = I0.0–I0.7, DIb .0–.5 = I1.0–I1.5) und der SM 1221 (A4 .0–.7 = I16.0–I16.7)
function diTerminal(addr){
  const m = /^I(\d+)\.(\d)$/.exec(addr); if(!m) return null;
  const by = +m[1], bit = +m[2];
  if(by === 0) return 'A1:DIa.' + bit;
  if(by === 1 && bit <= 5) return 'A1:DIb.' + bit;
  if(by === 16) return 'A4:.' + bit;
  return null;
}
function terminals(){
  const t = ['G1:L+', 'G1:M', 'F2:1', 'F2:2', 'F3:1', 'F3:2'];
  for(let i = 1; i <= 8; i++){ t.push('X1:L+' + i, 'X1:M' + i); }
  X2N.forEach(n => ['L+', 'S', 'M'].forEach(l => t.push('X2:' + n + '.' + l)));
  for(let i = 1; i <= 8; i++) t.push('X3:' + i + '.a', 'X3:' + i + '.b');
  t.push('A1:L+', 'A1:M', 'A1:1M', 'A1:2M', 'A1:AI0', 'A1:AI1', 'A1:3L+', 'A1:3M', 'A1:SL+', 'A1:SM');
  for(let b = 0; b < 8; b++) t.push('A1:DIa.' + b);
  for(let b = 0; b < 6; b++) t.push('A1:DIb.' + b);
  t.push('A2:L+', 'A2:M'); for(let c = 0; c < 4; c++) t.push('A2:' + c + '+', 'A2:' + c + '-');
  t.push('A3:L+', 'A3:M'); for(let c = 0; c < 2; c++) t.push('A3:' + c, 'A3:' + c + 'M');
  t.push('A4:1M', 'A4:2M'); for(let b = 0; b < 8; b++) t.push('A4:.' + b);
  Object.keys(PARTS).forEach(p => PARTS[p].pins.forEach(pin => t.push(p + ':' + pin)));
  return t;
}
const TERMINALS = terminals(), TSET = new Set(TERMINALS);
// Querbrücker: verbinden die L+- bzw. M-Ebenen aller Klemmen einer Leiste mit dem Verteiler X1
const BRIDGES = {
  QB_X2_LP: { name: 'Querbrücker X2 Ebene L+', nodes: ['X1:L+1'].concat(X2N.map(n => 'X2:' + n + '.L+')) },
  QB_X2_M:  { name: 'Querbrücker X2 Ebene M', nodes: ['X1:M1'].concat(X2N.map(n => 'X2:' + n + '.M')) }
};
// feste interne Verbindungen (Verteiler, Netzteil über Sicherungen, Trennmesser geschlossen)
function internal(state){
  const e = [];
  for(let i = 2; i <= 8; i++){ e.push(['X1:L+1', 'X1:L+' + i]); e.push(['X1:M1', 'X1:M' + i]); }
  e.push(['G1:L+', 'F2:1'], ['G1:L+', 'F3:1'], ['F2:2', 'X1:L+1'], ['G1:M', 'X1:M1']);
  if(!state.f2Tripped) e.push(['F2:1', 'F2:2']);          // Sicherung Sensoren (ausgelöst = offen)
  if(!state.f3Tripped) e.push(['F3:1', 'F3:2']);          // Sicherung Aktoren
  e.push(['A1:SL+', 'G1:L+'], ['A1:SM', 'G1:M']);   // Geberversorgung der CPU (Vereinfachung: gleiches 24-V-Netz)
  for(let i = 1; i <= 8; i++) if(!(state.knives && state.knives['X3:' + i])) e.push(['X3:' + i + '.a', 'X3:' + i + '.b']);   // Trennmesser zu
  return e;
}

/* ---------- Netzliste (Union-Find) ---------- */
function nets(state){
  const parent = {};
  const find = x => { while(parent[x] !== undefined && parent[x] !== x){ parent[x] = parent[parent[x]] !== undefined ? parent[parent[x]] : parent[x]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if(ra !== rb) parent[ra] = rb; };
  TERMINALS.forEach(t => { parent[t] = t; });
  internal(state).forEach(([a, b]) => union(a, b));
  (state.bridges || []).forEach(id => { const b = BRIDGES[id]; if(b) b.nodes.forEach(n => union(b.nodes[0], n)); });
  (state.wires || []).forEach(w => { if(TSET.has(w.from) && TSET.has(w.to)) union(w.from, w.to); });
  const same = (a, b) => find(a) === find(b);
  return { find, same, isLP: n => same(n, 'G1:L+'), isM: n => same(n, 'G1:M') };
}
// Potential eines Knotens: 'L+', 'M', 'L+M' (Kurzschluss) oder null (offen)
function potential(N, node){ const lp = N.isLP(node), m = N.isM(node); return lp && m ? 'L+M' : lp ? 'L+' : m ? 'M' : null; }

/* ---------- Auflegen (Handlungen) mit Arbeitsregeln ---------- */
const LEVELS = ['schnell', 'werkstatt', 'profi'];
function newState(preset){ return Object.assign({ wires: [], bridges: [], mounts: {}, plugs: {}, config: {}, knives: {}, shields: {}, level: 'werkstatt', mainSwitch: false, penalties: [] }, preset ? JSON.parse(JSON.stringify(preset)) : {}); }
// Querbrücker sitzen im Brückenschacht der Klemme und belegen keine Klemmstelle.
// Signalebene der Initiatorenklemme (X2:n.S) = Durchgangsklemme mit zwei Klemmstellen (Feld- und SPS-Seite).
function occupants(state, node){ return state.wires.filter(w => w.from === node || w.to === node).length; }
const capacity = node => /^X2:\d+\.S$/.test(node) ? 2 : 1;
function isBridgeLevel(state, node){ return (state.bridges || []).some(id => BRIDGES[id].nodes.slice(1).includes(node)); }
// Ader auflegen. Rückgabe { ok, warnings:[…], error } — bei Fehlern (Profi-Regeln) wird nichts geändert
function addWire(state, from, to, opt){
  opt = opt || {};
  const out = { ok: true, warnings: [] };
  if(!TSET.has(from) || !TSET.has(to)) return { ok: false, error: 'Unbekannte Klemmstelle.' };
  if(from === to) return { ok: false, error: 'Anfang und Ende sind dieselbe Klemmstelle.' };
  const lvl = state.level || 'werkstatt';
  if(state.mainSwitch){
    if(lvl === 'profi') return { ok: false, error: 'Nur im spannungsfreien Zustand verdrahten: zuerst -Q0 ausschalten.' };
    if(lvl === 'werkstatt'){ out.warnings.push('Unter Spannung verdrahtet! (Sicherheits-Minuspunkt)'); state.penalties.push('spannung'); }
    else out.warnings.push('Achtung: Die Anlage steht unter Spannung.');
  }
  [from, to].forEach(n => { if(!isPartPin(n) && occupants(state, n) >= capacity(n)) out.warnings.push(n + ': schon belegt – für zwei Leiter Querbrücker oder Doppelstock-Klemme verwenden.'); });
  const ferrule = opt.ferrule !== undefined ? !!opt.ferrule : lvl === 'schnell';
  if(!ferrule && lvl !== 'schnell') out.warnings.push('Feindrähtige Ader ohne Aderendhülse – Wackelkontakt möglich.');
  state.wires.push({ from, to, ferrule, label: opt.label || '' });
  return out;
}
function removeWire(state, from, to){ const i = state.wires.findIndex(w => (w.from === from && w.to === to) || (w.from === to && w.to === from)); if(i >= 0) state.wires.splice(i, 1); return i >= 0; }
function removePart(state, part){ const n = state.wires.length; state.wires = state.wires.filter(w => !w.from.startsWith(part + ':') && !w.to.startsWith(part + ':')); return n - state.wires.length; }
const isPartPin = n => !!PARTS[n.split(':')[0]];

/* ---------- Elektrische Auswertung ---------- */
// Digitale Eingänge: Wert je Adresse aus Sensor-/Kontaktzustand, Verdrahtung, Bezugspotential und Versorgung
// world: { B1:{active:true} | S1:{pressed:true}, … }  opts: { t, seed }
function evaluate(state, world, opts){
  world = world || {}; opts = opts || {};
  const N = nets(state), res = { di: {}, leds: {}, sensorLed: {}, faults: [], supply: null, ai: {}, hot: [], sink: [] };   // sink: aktive NPN-Ausgänge (ziehen auf M)   // hot: Knoten, an denen ein aktives 24-V-Signal anliegt (LEDs der Klemmen)
  // Kurzschluss L+/M?
  const short = N.same('G1:L+', 'G1:M');
  const sup = SM.supply({ lplusToM: short });
  res.supply = sup;
  if(short) res.faults.push({ code: 'psu_overload', text: '-G1: Überlast – L+ und M kurzgeschlossen, „DC OK“ aus.' });
  const on = !!state.mainSwitch && sup.dcOk;
  const potOf = n => on ? potential(N, n) : null;
  // welche Signal-Knoten liegen an welchem DI?
  const diAddr = {}; Object.keys(DI_OF_X2).forEach(k => { const a = DI_OF_X2[k], t = diTerminal(a); if(t) diAddr[a] = t; });
  const groupRef = { A1: potOf('A1:1M'), A4lo: potOf('A4:1M'), A4hi: potOf('A4:2M') };
  const refOf = term => term.startsWith('A4:') ? (+term.slice(-1) <= 3 ? groupRef.A4lo : groupRef.A4hi) : groupRef.A1;
  Object.keys(diAddr).forEach(a => { res.di[a] = false; });
  Object.keys(PARTS).forEach(id => {
    const P = PARTS[id], w = world[id] || {};
    if(P.type === 'sensor3' || P.type === 'sensor4'){
      const bn = potOf(id + ':BN'), bu = potOf(id + ':BU');
      if(!state.plugs || state.plugs[id] === false) return;
      const powered = bn === 'L+' && bu === 'M', reversed = bn === 'M' && bu === 'L+';
      const out = SM.outputs(P.sensor, !!w.active);
      ['BK', 'WH'].forEach(pin => {
        if(!P.pins.includes(pin) || out[pin] == null) return;
        const node = id + ':' + pin, p = potential(N, node);
        const loose = (state.plugs && state.plugs[id] === 'loose') || wireLoose(state, node);
        const dropout = loose && SM.looseContact(id + pin, opts.t || 0);
        if(on && powered && P.out === 'PNP' && out[pin] && p !== 'M' && !dropout) res.hot.push(node);
        if(on && powered && P.out === 'NPN' && out[pin] && !dropout) res.sink.push(node);
        if(on && p === 'M' && P.out === 'PNP' && out[pin]) res.faults.push({ code: 'short_output', part: id, text: id + ': Schaltausgang auf M – Kurzschlussschutz, LED blinkt.' });
        const dis = Object.keys(diAddr).filter(a => N.same(node, diAddr[a]));
        dis.forEach(a => {
          const r = SM.digitalInput({ out: P.out, group1M: refOf(diAddr[a]), active: !!out[pin], supply: on && powered, fault: reversed ? 'swap_bn_bu' : (p === 'M' && P.out === 'PNP') ? 'bk_on_m' : null, dropout });
          res.di[a] = res.di[a] || r.value;
          res.sensorLed[id] = r.sensorLed;
        });
        if(!dis.length) res.sensorLed[id] = on && powered ? !!out[pin] : false;
      });
      if(on && reversed) res.faults.push({ code: 'reversed', part: id, text: id + ': BN und BU vertauscht – Sensor ohne Funktion.' });
    }
    if(P.type === 'contact2'){
      const closed = P.contact === 'NC' ? !w.pressed && !w.open : !!w.pressed;
      const a = id + ':' + P.pins[0], b = id + ':' + P.pins[1];
      if(!closed) return;
      // Kontakt schaltet L+ weiter: ein Anschluss an L+, der andere an einen Eingang
      [[a, b], [b, a]].forEach(([src, dst]) => {
        if(potOf(src) !== 'L+') return;
        res.hot.push(dst);
        Object.keys(diAddr).forEach(addr => { if(N.same(dst, diAddr[addr]) && refOf(diAddr[addr]) === 'M' && !wireLoose(state, dst)) res.di[addr] = true; });
      });
    }
  });
  Object.keys(res.di).forEach(a => { res.leds[a] = res.di[a]; });
  return res;
}
function wireLoose(state, node){ return state.wires.some(w => (w.from === node || w.to === node) && !w.ferrule && (state.level || 'werkstatt') !== 'schnell'); }

/* ---------- Analog: Signal an einem AI-Kanal aus der Verdrahtung ---------- */
// Liefert die elektrische Grösse an den Klemmen des Kanals (für SensorModel.rawValue)
function analogAt(state, channel, phys){
  const N = nets(state), on = !!state.mainSwitch && !N.same('G1:L+', 'G1:M');
  const pos = channel.startsWith('AI') ? 'A1:' + channel : 'A2:' + channel.slice(2) + '+';
  const neg = channel.startsWith('AI') ? 'A1:2M' : 'A2:' + channel.slice(2) + '-';
  // Stromkalibrator am Kanal (Loop-Check): speist anstelle des Transmitters (Vereinfachung: Quelle und Senke speisen direkt)
  const K = state.calib; if(K && K.on && K.channel === channel) return { part: 'KALIB', sig: { kind: 'I', value: Math.max(0, Math.min(24, +K.mA || 0)) }, loop: 'ok' };
  for(const id of Object.keys(PARTS)){
    const P = PARTS[id]; if(!P.ai) continue;
    const x = phys && phys[id] != null ? phys[id] : 0;
    if(P.type === 'analog2w'){
      // 2-Leiter: L+ → Transmitter + ; Transmitter − → AI x+ ; AI x− → M
      const plus = id + ':+', minus = id + ':-';
      if(!N.same(minus, pos)) continue;
      const loop = on && N.isLP(plus) && N.isM(neg) ? 'ok' : N.isLP(plus) ? 'no_return' : 'no_supply';
      return { part: id, sig: loop === 'ok' ? SM.transmitterSignal(id, x) : { kind: 'I', value: 0 }, loop };
    }
    if(P.type === 'analog4w'){
      const sup = on && N.isLP(id + ':L+') && N.isM(id + ':M');
      if(N.same(id + ':I+', pos) && N.same(id + ':I-', neg)) return { part: id, sig: SM.transmitterSignal(id, x, { powered: sup }), loop: sup ? 'ok' : 'no_supply' };
      if(N.same(id + ':I-', pos) || N.same(id + ':L+', pos)) return { part: id, sig: { kind: 'I', value: 0 }, loop: 'as_2wire' };   // wie 2-Leiter angeschlossen
      continue;
    }
    if(P.type === 'analogU' || P.type === 'poti'){
      const sigPin = P.type === 'poti' ? id + ':2' : id + ':BK', gnd = P.type === 'poti' ? id + ':3' : id + ':BU', sup = P.type === 'poti' ? id + ':1' : id + ':BN';
      if(!N.same(sigPin, pos)) continue;
      const okSup = on && N.isLP(sup) && N.isM(gnd) && N.same(gnd, neg);
      return { part: id, sig: okSup ? (P.type === 'poti' ? { kind: 'U', value: SM.signal('U0_10', x, 0, 100) } : SM.transmitterSignal(id, x)) : { kind: 'U', value: 0 }, loop: okSup ? 'ok' : 'no_supply' };
    }
  }
  return { part: null, sig: null, loop: 'open' };
}

/* ---------- Prüfung gegen Funktionsanforderungen (Plan 3.5) ---------- */
/* target: [{ net:['B11:+', 'POT:L+'] } | { net:['B1:BK', 'DI:I0.4'] } | { notNet:[…] } | { bridge:'QB_X2_LP' } | { ferrules:true } | { shield:'B11' } | { knife:'X3:1', closed:true }]
   Pseudoknoten: POT:L+, POT:M, DI:<Adresse>, AI:<Kanal>+/- */
function resolve(n){
  if(n === 'POT:L+') return 'G1:L+';
  if(n === 'POT:M') return 'G1:M';
  if(n.startsWith('DI:')) return diTerminal(n.slice(3));
  if(n.startsWith('AI:')){ const c = n.slice(3); return c.startsWith('AI') ? 'A1:' + c.replace(/[+-]$/, '') : 'A2:' + c.replace(/^CH/, ''); }
  return n;
}
function check(state, target){
  const N = nets(state), issues = [];
  (target || []).forEach(r => {
    if(r.net){ const ns = r.net.map(resolve); for(let i = 1; i < ns.length; i++) if(!ns[0] || !ns[i] || !N.same(ns[0], ns[i])){ issues.push({ rule: r, text: r.msg || describeNet(r.net) }); break; } }
    if(r.notNet){ const ns = r.notNet.map(resolve); if(ns[0] && ns[1] && N.same(ns[0], ns[1])) issues.push({ rule: r, text: r.msg || (r.notNet.join(' und ') + ' dürfen nicht verbunden sein.') }); }
    if(r.bridge && !(state.bridges || []).includes(r.bridge)) issues.push({ rule: r, text: r.msg || BRIDGES[r.bridge].name + ' fehlt.' });
    if(r.shield && (state.level === 'profi' || r.always) && !(state.shields || {})[r.shield]) issues.push({ rule: r, text: r.msg || '-' + r.shield + ': Schirm nicht aufgelegt.' });
    if(r.knife && !!(state.knives || {})[r.knife] === !!r.closed) issues.push({ rule: r, text: r.msg || r.knife + ': Trennmesser ' + (r.closed ? 'offen' : 'geschlossen') + '.' });
  });
  // allgemeine Regeln
  if(N.same('G1:L+', 'G1:M')) issues.push({ text: 'Kurzschluss zwischen L+ und M.' });
  const lvl = state.level || 'werkstatt';
  if(lvl !== 'schnell'){
    const count = {};
    state.wires.forEach(w => [w.from, w.to].forEach(n => { if(!isPartPin(n)) count[n] = (count[n] || 0) + 1; }));
    Object.keys(count).forEach(n => { if(count[n] > capacity(n)) issues.push({ text: n + ': zwei Leiter an einer Klemmstelle.' }); });
    const noHuelse = state.wires.filter(w => !w.ferrule).length;
    if(noHuelse && lvl === 'profi') issues.push({ text: noHuelse + ' Ader(n) ohne Aderendhülse.' });
  }
  return { ok: !issues.length, issues };
}
function describeNet(ns){
  const [a, b] = ns;
  const nice = n => n === 'POT:L+' ? 'L+' : n === 'POT:M' ? 'M' : n.startsWith('DI:') ? 'Eingang %' + n.slice(3) : n.startsWith('AI:') ? 'Analogkanal ' + n.slice(3) : '-' + n;
  if(/:\+$|:-$/.test(a) && (b === 'POT:L+' || b.startsWith('AI:'))) return nice(a).split(':')[0] + ': Stromschleife nicht geschlossen.';
  return nice(a) + ' ist nicht mit ' + nice(b) + ' verbunden.';
}
// Sichtprüfung: offene Adern (nur ein Ende an einer Klemme ist hier nicht möglich) → Bauteilpins ohne Ader
function visualCheck(state, parts){
  const used = new Set(); state.wires.forEach(w => { used.add(w.from); used.add(w.to); });
  const open = [];
  (parts || Object.keys(PARTS)).forEach(id => PARTS[id].pins.forEach(p => { if(!used.has(id + ':' + p)) open.push(id + ':' + p); }));
  return open;
}
// Durchgangsprüfung (Multimeter, spannungsfrei)
function continuity(state, a, b){ if(state.mainSwitch) return { error: 'Durchgang nur spannungsfrei messen (-Q0 aus).' }; const N = nets(state); return { beep: N.same(a, b) }; }
// Spannungsmessung (Multimeter V DC) zwischen zwei Knoten. Mit world: aktive PNP-Ausgänge führen 24 V, aktive NPN-Ausgänge ziehen auf 0 V.
function voltage(state, a, b, world){
  const N = nets(state), on = !!state.mainSwitch && !N.same('G1:L+', 'G1:M');
  if(!on) return 0;
  const ev = world ? evaluate(state, world) : { hot: [], sink: [] };
  const v = n => N.isLP(n) || ev.hot.some(h => N.same(h, n)) ? 24 : N.isM(n) || ev.sink.some(h => N.same(h, n)) ? 0 : null;
  const va = v(a), vb = v(b);
  return va == null || vb == null ? 0 : va - vb;
}
/* ---------- Feldebene: Montieren, Anstecken, Schirm (Plan 3.1 Ebene A) ---------- */
const MOUNTABLE = { B1: { dist: 4, max: 12, tool: 'gabel' }, B2: { dist: 4, max: 12, tool: 'gabel' }, B3: { dist: 60, max: 200, tool: 'gabel' }, B6: { dist: 0, max: 40, tool: 'schrauber', slot: true }, B7: { dist: 0, max: 40, tool: 'schrauber', slot: true }, B10: { dist: 150, max: 400, tool: 'gabel' } };
const ALIGNABLE = ['B4.1', 'B4.2', 'B5'];
const HAS_M12 = id => { const P = PARTS[id]; return !!P && ['sensor3', 'sensor4', 'sender', 'analogU'].includes(P.type); };
function mountOf(state, id){ const d = MOUNTABLE[id]; const m = (state.mounts || {})[id] || {}; return { dist: m.dist != null ? m.dist : d ? d.dist : 0, tight: m.tight !== false, align: m.align || { h: 0, v: 0 }, poti: m.poti != null ? m.poti : 0.5, teach: m.teach != null ? m.teach : null }; }
// action: 'loosen' | 'tighten' | 'move' (value = neuer Abstand in mm, Schritt 0,5) | 'align' (value = {h, v}); tool = gewähltes Werkzeug
function mountAction(state, id, action, value, tool){
  const d = MOUNTABLE[id]; state.mounts = state.mounts || {};
  const m = state.mounts[id] = Object.assign(mountOf(state, id), state.mounts[id] || {});
  if(action === 'poti'){   // Empfindlichkeit kapazitiv (0…1), Einstellschraube mit dem Schraubendreher
    if(id !== 'B2' && id !== 'B8') return { ok: false, error: '-' + id + ' hat kein Poti.' };
    if(tool !== 'schrauber') return { ok: false, error: 'Poti: zuerst den Schraubendreher wählen.' };
    m.poti = Math.max(0, Math.min(1, Math.round(+value * 20) / 20)); return { ok: true, poti: m.poti };
  }
  if(action === 'teach'){   // Hintergrundausblendung: Teach-Taste bei freiem Band → Hintergrund = aktueller Abstand zum Band
    if(id !== 'B3') return { ok: false, error: '-' + id + ' hat keine Teach-Taste.' };
    m.teach = value != null ? +value : m.dist; return { ok: true, teach: m.teach };
  }
  if(action === 'align'){
    if(!ALIGNABLE.includes(id)) return { ok: false, error: '-' + id + ' wird nicht ausgerichtet.' };
    if(tool !== 'schrauber') return { ok: false, error: 'Rändelschrauben: zuerst den Schraubendreher wählen.' };
    m.align = { h: Math.max(-10, Math.min(10, Math.round(+value.h || 0))), v: Math.max(-10, Math.min(10, Math.round(+value.v || 0))) };
    return { ok: true, stable: alignQuality(m.align) };
  }
  if(!d) return { ok: false, error: '-' + id + ' hat keinen verstellbaren Halter.' };
  const need = d.tool, toolName = need === 'gabel' ? 'Gabelschlüssel' : 'Schraubendreher';
  if(action === 'loosen' || action === 'tighten'){
    if(tool !== need) return { ok: false, error: (d.slot ? 'Klemmschraube' : 'Kontermuttern') + ': zuerst den ' + toolName + ' wählen.' };
    m.tight = action === 'tighten'; return { ok: true };
  }
  if(action === 'move'){
    if(m.tight) return { ok: false, error: (d.slot ? 'Klemmschraube' : 'Kontermuttern') + ' zuerst lösen.' };
    m.dist = Math.max(0, Math.min(d.max, Math.round(+value * 2) / 2)); return { ok: true, dist: m.dist };
  }
  return { ok: false, error: 'Unbekannte Handlung.' };
}
// Ausrichtung: 0 = genau; Stabilitäts-LED ruhig bis ±1, blinkt bis ±3, sonst aus (kein Lichtempfang)
function alignQuality(a){ const e = Math.max(Math.abs(a.h || 0), Math.abs(a.v || 0)); return e <= 1 ? 'stabil' : e <= 3 ? 'knapp' : 'aus'; }
// M12-Leitung: 'plug' → gesteckt, Rändelmutter lose; 'tighten' → fest; 'unplug' → abgezogen
function plugAction(state, id, action){
  if(!HAS_M12(id)) return { ok: false, error: '-' + id + ' hat keinen M12-Stecker.' };
  state.plugs = state.plugs || {};
  if(action === 'plug'){ state.plugs[id] = 'loose'; return { ok: true, warn: 'Rändelmutter noch festziehen – sonst Wackelkontakt.' }; }
  if(action === 'tighten'){ if(state.plugs[id] === false) return { ok: false, error: 'Zuerst die Leitung anstecken.' }; state.plugs[id] = true; return { ok: true }; }
  if(action === 'unplug'){ state.plugs[id] = false; return { ok: true }; }
  return { ok: false, error: 'Unbekannte Handlung.' };
}
const plugState = (state, id) => { const p = (state.plugs || {})[id]; return p === false ? 'ab' : p === 'loose' ? 'lose' : 'fest'; };
function shieldAction(state, id, on){ const P = PARTS[id]; if(!P || !P.ai) return { ok: false, error: '-' + id + ' hat keine geschirmte Analogleitung.' }; state.shields = state.shields || {}; state.shields[id] = !!on; return { ok: true }; }

/* ---------- Multimeter (Plan 4.1) ---------- */
// mode: 'off' | 'V' | 'mA' | 'ohm' | 'beep'; a = rote, b = schwarze Messspitze; ctx: { phys }
const CH_POS = ch => ch.startsWith('AI') ? 'A1:' + ch : 'A2:' + ch.slice(2) + '+';
const CHANNELS = ['CH0', 'CH1', 'CH2', 'CH3', 'AI0', 'AI1'];
function meter(state, mode, a, b, ctx){
  ctx = ctx || {};
  if(!mode || mode === 'off') return { text: '' };
  if(!a || !b) return { text: '– – –', hint: 'Beide Messspitzen auf Klemmstellen setzen.' };
  if(mode === 'V'){ const v = voltage(state, a, b, ctx.world); return { value: v, unit: 'V', text: (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)) + ' V' }; }
  if(mode === 'ohm' || mode === 'beep'){
    const c = continuity(state, a, b); if(c.error) return { text: 'Err', error: c.error };
    return mode === 'beep' ? { beep: c.beep, text: c.beep ? '0.2 Ω ♪' : 'OL' } : { value: c.beep ? 0.2 : null, unit: 'Ω', text: c.beep ? '0.2 Ω' : 'OL' };
  }
  if(mode === 'mA'){
    if(state.meterFuse === false) return { text: 'FUSE', error: 'Sicherung im Multimeter defekt – ersetzen.' };
    // in Reihe: über einem offenen Trennmesser -X3:n (Messbuchsen a/b)
    const ka = /^X3:(\d+)\.[ab]$/.exec(a), kb = /^X3:(\d+)\.[ab]$/.exec(b);
    if(ka && kb && ka[1] === kb[1] && a !== b && (state.knives || {})['X3:' + ka[1]]){
      const s2 = JSON.parse(JSON.stringify(state)); s2.knives['X3:' + ka[1]] = false;
      const N2 = nets(s2);
      for(const ch of CHANNELS){
        if(!N2.same('X3:' + ka[1] + '.a', CH_POS(ch))) continue;
        const r = analogAt(s2, ch, ctx.phys || {});
        if(r.sig && r.sig.kind === 'I'){ const mA = r.sig.value; return { value: mA, unit: 'mA', text: mA.toFixed(2) + ' mA', channel: ch }; }
      }
      return { value: 0, unit: 'mA', text: '0.00 mA' };
    }
    // parallel zu einer Spannung → Sicherung löst aus
    if(Math.abs(voltage(state, a, b)) > 0.5){ state.meterFuse = false; (state.penalties = state.penalties || []).push('multimeter'); return { text: 'FUSE', fuse: true, error: 'Strom parallel zu einer Spannung gemessen – die Sicherung im Multimeter hat ausgelöst. Strom misst man in Reihe.' }; }
    return { value: 0, unit: 'mA', text: '0.00 mA' };
  }
  return { text: '?' };
}
function serialize(state){ const s = Object.assign({}, state); delete s.penalties; return JSON.stringify(s); }
function deserialize(text){ return newState(JSON.parse(text)); }

root.Wiring = { PARTS, TERMINALS, BRIDGES, X2N, DI_OF_X2, LEVELS, diTerminal, nets, potential, newState, addWire, removeWire, removePart,
  evaluate, analogAt, check, resolve, visualCheck, continuity, voltage, serialize, deserialize,
  MOUNTABLE, ALIGNABLE, HAS_M12, mountOf, mountAction, alignQuality, plugAction, plugState, shieldAction, meter, CHANNELS };
if(typeof module !== 'undefined' && module.exports) module.exports = root.Wiring;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== sensor_plc.js ==== */
(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — SPS der Werkstatt (docs/SENSORWERKSTATT_PLAN.md Teil 4.3, 8.3; Paket S6), rein rechnend, ohne DOM
   - PLC-Variablentabelle (Name, Datentyp, Adresse, Kommentar) mit Prüfung (doppelte Namen/Adressen, Typ ↔ Adressbreite)
   - Vorverarbeitung: "Name" und %I0.4 / %IW96 / %Q0.0 / %MD20 → Bezeichner der Engine (symbolisch und absolut auf dieselbe Variable)
   - Gerätekonfiguration (CPU 1214C, SM 1231 AI 4, SM 1232 AQ 2, SM 1221 DI 8) mit Messart, Messbereich, Glättung, Diagnose
   - CPU: Übersetzen, Laden (STOP), Starten (RUN), Zyklus mit Prozessabbild, Diagnosepuffer, Laden nötig nach Konfigurationsänderung
   - Prozessabbild aus der Verdrahtung (Wiring.evaluate / analogAt) und dem Modell (SensorModel.rawValue, Rauschen ohne Schirm)
   Engine: Grundstufe (SCLEngine) für SCL, KOP.wrapEngine(SCLEngine) für KOP/FUP (Netzwerktext).
   ============================================================ */
const SM = root.SensorModel, Wi = root.Wiring;

/* ---------- Variablentabelle ---------- */
const T = (name, type, addr, comment) => ({ name, type, addr, comment });
const TAGS_WERKSTATT = [
  T('Start', 'Bool', '%I0.0', '-S1 Taster Start (NO)'), T('Stopp', 'Bool', '%I0.1', '-S2 Taster Stopp (NC)'), T('NotHalt_Meldung', 'Bool', '%I0.2', '-S3 Kanal 2 (NC)'), T('Auto', 'Bool', '%I0.3', '-S4 Wahlschalter'),
  T('Ind_Metall', 'Bool', '%I0.4', '-B1 induktiv'), T('Kap_Teil', 'Bool', '%I0.5', '-B2 kapazitiv'), T('Taster_Hell', 'Bool', '%I0.6', '-B3 Lichttaster'), T('LS_Band', 'Bool', '%I0.7', '-B4.2 Einweg-Lichtschranke'),
  T('Rutsche_Voll', 'Bool', '%I1.0', '-B5 Reflexions-Lichtschranke'), T('Zyl_Hinten', 'Bool', '%I1.1', '-B6'), T('Zyl_Vorne', 'Bool', '%I1.2', '-B7'), T('Haube_Zu', 'Bool', '%I1.3', '-S5 (NC)'),
  T('Tank_Nicht_Voll', 'Bool', '%I1.4', '-B8 als NC'), T('Vorrat_Ok', 'Bool', '%I1.5', '-B9 Reed'),
  T('Abstand_Roh', 'Int', '%IW64', '-B10 0–10 V, CPU AI0'), T('Sollwert_Roh', 'Int', '%IW66', '-R1 0–10 V, CPU AI1'),
  T('Druck_Roh', 'Int', '%IW96', '-B11 4–20 mA, SM 1231 Kanal 0'), T('Temp_Roh', 'Int', '%IW98', '-B12 4–20 mA, Kanal 1'), T('Durchfluss_Roh', 'Int', '%IW100', '-B13 4–20 mA, Kanal 2'), T('Reserve_Roh', 'Int', '%IW102', 'Kanal 3 / Kalibrator'),
  T('Pumpe_Soll_Roh', 'Int', '%QW112', '-T2 0–10 V, SM 1232 Kanal 0'), T('Ventil_Soll_Roh', 'Int', '%QW114', '-MB5 4–20 mA, Kanal 1'),
  T('Band', 'Bool', '%Q0.0', '-K1'), T('Vereinzeler', 'Bool', '%Q0.1', '-MB1'), T('Auswerfer', 'Bool', '%Q0.2', '-MB2'), T('Pumpe_Frei', 'Bool', '%Q0.3', '-K2'), T('Ablauf', 'Bool', '%Q0.4', '-MB3'),
  T('Heizung', 'Bool', '%Q0.5', '-K3'), T('Lampe_Gruen', 'Bool', '%Q0.6', '-P1'), T('Lampe_Rot', 'Bool', '%Q0.7', '-P2'), T('Hupe', 'Bool', '%Q1.0', '-P3'), T('Zulauf', 'Bool', '%Q1.1', '-MB4')
];
const TYPES = { Bool: 'bit', Int: 'W', UInt: 'W', Word: 'W', DInt: 'D', UDInt: 'D', DWord: 'D', Real: 'D', Byte: 'B', SInt: 'B', USInt: 'B' };
function parseAddr(a){
  const s = String(a || '').trim().toUpperCase(); let m;
  if((m = /^%([IQM])(\d+)\.([0-7])$/.exec(s))) return { area: m[1], width: 'bit', byte: +m[2], bit: +m[3], key: m[1] + m[2] + '.' + m[3] };
  if((m = /^%([IQM])([BWD])(\d+)$/.exec(s))) return { area: m[1], width: m[2], byte: +m[3], key: m[1] + m[2] + m[3] };
  return null;
}
const bytesOf = p => p.width === 'bit' || p.width === 'B' ? 1 : p.width === 'W' ? 2 : 4;
// Prüfung wie im TIA Portal (vereinfacht): Name, Datentyp, Adresse, Doppelbelegung, Überlappung (Warnung)
function checkTags(tags){
  const errors = [], warnings = [], names = {}, addrs = {};
  (tags || []).forEach((t, i) => {
    const row = 'Zeile ' + (i + 1) + ' („' + (t.name || '') + '“)';
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.name || '')) errors.push({ row: i, text: row + ': Name nur aus Buchstaben, Ziffern und _ (Vereinfachung: keine Leerzeichen).' });
    const lk = String(t.name || '').toLowerCase(); if(names[lk] != null) errors.push({ row: i, text: row + ': Name „' + t.name + '“ ist doppelt (auch Zeile ' + (names[lk] + 1) + ').' }); else names[lk] = i;
    const w = TYPES[t.type]; if(!w) errors.push({ row: i, text: row + ': unbekannter Datentyp „' + t.type + '“.' });
    const p = parseAddr(t.addr);
    if(!p){ errors.push({ row: i, text: row + ': Adresse „' + t.addr + '“ ungültig (z. B. %I0.4, %IW96, %MD20).' }); return; }
    if(w && w !== p.width) errors.push({ row: i, text: row + ': Datentyp ' + t.type + ' passt nicht zur Adresse ' + t.addr + (w === 'bit' ? ' (Bool braucht eine Bitadresse wie %I0.4).' : ' (braucht %' + p.area + w + '…).') });
    if(p.width === 'W' && p.byte % 2) warnings.push({ row: i, text: row + ': Wortadresse ' + t.addr + ' ist ungerade – bei Analogwerten unüblich.' });
    if(addrs[p.key] != null) errors.push({ row: i, text: row + ': Adresse ' + t.addr + ' ist doppelt belegt (auch „' + tags[addrs[p.key]].name + '“).' }); else addrs[p.key] = i;
  });
  // Überlappung (z. B. %MW10 und %MD10) – Warnung
  const ps = (tags || []).map((t, i) => ({ i, p: parseAddr(t.addr) })).filter(x => x.p && x.p.width !== 'bit');
  ps.forEach((a, k) => ps.slice(k + 1).forEach(b => { if(a.p.area === b.p.area && a.p.key !== b.p.key && a.p.byte < b.p.byte + bytesOf(b.p) && b.p.byte < a.p.byte + bytesOf(a.p)) warnings.push({ row: b.i, text: '„' + tags[b.i].name + '“ überlappt mit „' + tags[a.i].name + '“.' }); }));
  return { ok: !errors.length, errors, warnings };
}
const initOf = type => type === 'Bool' ? false : type === 'Real' ? 0.0 : 0;
const engineType = type => type === 'Real' ? 'REAL' : type === 'Bool' ? 'BOOL' : 'INT';

/* ---------- Vorverarbeitung ---------- */
// Ersetzt "Name" → Name und %Adresse → Variablenname (Tag mit dieser Adresse, sonst _a_<Adresse>). Kommentare/Strings bleiben unberührt, Zeilen bleiben erhalten.
function preprocess(src, tags, fb){
  const byName = {}, byAddr = {}; (tags || []).forEach(t => { byName[t.name.toLowerCase()] = t; const p = parseAddr(t.addr); if(p) byAddr[p.key] = t; });
  Object.keys(fb || {}).forEach(n => { byName[n.toLowerCase()] = { name: n }; });   // Instanzen (IEC-Zeiten, Flanken) als globale Instanz-DBs
  const extra = {}, errors = []; let out = '', i = 0, line = 1; src = String(src || '');
  const idOf = p => byAddr[p.key] ? byAddr[p.key].name : '_a_' + p.key.replace('.', '_');
  while(i < src.length){
    const c = src[i], two = src.substr(i, 2);
    if(two === '//'){ const e = src.indexOf('\n', i); const j = e < 0 ? src.length : e; out += src.slice(i, j); i = j; continue; }
    if(two === '(*'){ const e = src.indexOf('*)', i + 2); const j = e < 0 ? src.length : e + 2; const part = src.slice(i, j); line += (part.match(/\n/g) || []).length; out += part; i = j; continue; }
    if(c === "'"){ const e = src.indexOf("'", i + 1); const j = e < 0 ? src.length : e + 1; out += src.slice(i, j); i = j; continue; }
    if(c === '\n'){ line++; out += c; i++; continue; }
    if(c === '"'){
      const m = /^"([^"\n]*)"/.exec(src.slice(i));
      if(m){ const t = byName[m[1].toLowerCase()]; if(!t) errors.push({ line, text: 'Zeile ' + line + ': Variable "' + m[1] + '" steht nicht in der PLC-Variablentabelle.' }); out += t ? t.name : m[1].replace(/\W/g, '_'); i += m[0].length; continue; }
    }
    if(c === '%'){
      const m = /^%[IQMiqm][BWDbwd]?\d+(\.\d)?/.exec(src.slice(i)); const p = m && parseAddr(m[0]);
      if(p){ const id = idOf(p); if(!byAddr[p.key]) extra[id] = { name: id, type: p.width === 'bit' ? 'Bool' : p.width === 'D' ? 'DInt' : 'Int', addr: '%' + p.key }; out += id; i += m[0].length; continue; }
      if(m) errors.push({ line, text: 'Zeile ' + line + ': Adresse ' + m[0] + ' ungültig.' });
    }
    out += c; i++;
  }
  return { src: out, extra: Object.values(extra), errors };
}

/* ---------- Gerätekonfiguration ---------- */
const HW_DEFAULT = {
  cpu: { diDelay: '6.4', AI0: { type: 'U', range: '0..10V', smooth: 'keine' }, AI1: { type: 'U', range: '0..10V', smooth: 'keine' } },
  ai: { CH0: { type: 'I_2W', range: '4..20mA', smooth: 'keine', diag: { wireBreak: true, over: true, under: true } },
        CH1: { type: 'I_2W', range: '4..20mA', smooth: 'keine', diag: { wireBreak: true, over: true, under: true } },
        CH2: { type: 'I_4W', range: '4..20mA', smooth: 'keine', diag: { wireBreak: true, over: true, under: true } },
        CH3: { type: 'off', range: '4..20mA', smooth: 'keine', diag: { wireBreak: false, over: false, under: false } } },
  aq: { CH0: { type: 'U', range: '0..10V', stopValue: 0 }, CH1: { type: 'I', range: '4..20mA', stopValue: 0 } }
};
// Steckplätze, Adressen (TIA-Standard, Plan 2.4) und Angebote je Modul ([prüfen] gegen die Gerätehandbücher, docs/SENSORWERKSTATT_FAKTEN.md)
const SLOTS = [
  { slot: 1, id: 'A1', name: 'CPU 1214C DC/DC/DC', order: '6ES7 214-1AG40-0XB0', addr: 'I0.0–I1.5, Q0.0–Q1.1, IW64/IW66' },
  { slot: 2, id: 'A2', name: 'SM 1231 AI 4', order: '6ES7 231-4HD32-0XB0', addr: 'IW96–IW102' },
  { slot: 3, id: 'A3', name: 'SM 1232 AQ 2', order: '6ES7 232-4HB32-0XB0', addr: 'QW112–QW114' },
  { slot: 4, id: 'A4', name: 'SM 1221 DI 8', order: '6ES7 221-1BF32-0XB0', addr: 'I16.0–I16.7' }
];
const AI_ADDR = { AI0: 'IW64', AI1: 'IW66', CH0: 'IW96', CH1: 'IW98', CH2: 'IW100', CH3: 'IW102' };
const AQ_ADDR = { CH0: 'QW112', CH1: 'QW114' };
const AI_TYPES = [['off', 'deaktiviert'], ['U', 'Spannung'], ['I_4W', 'Strom 4-Draht'], ['I_2W', 'Strom 2-Draht']];
const AI_RANGES = { U: ['±10V', '0..10V'], I_4W: ['0..20mA', '4..20mA'], I_2W: ['4..20mA'], off: [] };
const SMOOTH = ['keine', 'schwach', 'mittel', 'stark'];
const DI_DELAYS = ['0.2', '0.4', '0.8', '1.6', '3.2', '6.4', '12.8'];
function newHw(){ return JSON.parse(JSON.stringify(HW_DEFAULT)); }
function hwEqual(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
// Kanalkonfiguration für SensorModel.rawValue
function aiCfg(hw, ch){ const c = ch.startsWith('AI') ? hw.cpu[ch] : hw.ai[ch]; return c; }

/* ---------- Prozessabbild der Eingänge aus Verdrahtung und Modell ---------- */
// ctx: { state (Wiring), world, phys, hw (geladene Konfiguration), t, prev (vorheriges Abbild für Glättung) }
function ioImage(ctx){
  const io = {}, diag = [];
  const ev = Wi.evaluate(ctx.state, ctx.world || {}, { t: ctx.t || 0 });
  Object.keys(ev.di).forEach(a => { io[a] = ev.di[a]; });
  Object.keys(AI_ADDR).forEach(ch => {
    const cfg = aiCfg(ctx.hw, ch), key = AI_ADDR[ch];
    if(!cfg || cfg.type === 'off'){ io[key] = 0; return; }
    const a = Wi.analogAt(ctx.state, ch, ctx.phys || {});
    let raw = a.sig ? SM.rawValue(a.sig, cfg) : SM.rawValue({ kind: cfg.type === 'U' ? 'U' : 'I', value: 0 }, cfg);
    if(a.part && a.part !== 'KALIB' && raw > SM.RAW.UNDER && raw < SM.RAW.OVER) raw = Math.max(SM.RAW.UNDER, Math.min(SM.RAW.OVER, raw + SM.noise(a.part, ctx.t || 0, !!(ctx.state.shields || {})[a.part])));
    if(ctx.prev && ctx.prev[key] != null && raw < SM.RAW.OVER && raw > SM.RAW.UNDER) raw = SM.smooth(ctx.prev[key], raw, cfg.smooth);
    io[key] = raw;
    const d = SM.rawDiag(raw, cfg);
    if(d && cfg.diag && ((/Drahtbruch/.test(d) && cfg.diag.wireBreak) || (/Überlauf/.test(d) && cfg.diag.over) || (/Unterlauf/.test(d) && cfg.diag.under))) diag.push({ ch, text: (ch.startsWith('AI') ? 'CPU 1214C Steckplatz 1, ' + ch : 'SM 1231 AI 4 Steckplatz 2, Kanal ' + ch.slice(2)) + ': ' + d });
  });
  return { io, diag, eval: ev };
}

/* ---------- CPU ---------- */
function Cpu(o){
  o = o || {};
  const E = o.engine || root.SCLEngine, K = o.kop || (root.KOP && root.KOP.wrapEngine ? root.KOP.wrapEngine(E) : null);
  const cpu = { mode: 'STOP', loaded: null, rt: null, diag: [], t: 0, lastIo: null, alarms: {} };
  const log = text => { cpu.diag.unshift({ t: Math.round(cpu.t * 10) / 10, text }); if(cpu.diag.length > 50) cpu.diag.pop(); };
  // Übersetzen: { ok, prog, errors:[{line, text}], warnings, vars }
  cpu.compile = function(source, lang, tags, fb){
    const tc = checkTags(tags);
    if(!tc.ok) return { ok: false, errors: tc.errors.map(e => ({ line: 0, text: 'Variablentabelle: ' + e.text })) };
    fb = fb || {};
    const pre = preprocess(source, tags, fb);
    if(pre.errors.length) return { ok: false, errors: pre.errors };
    const all = tags.concat(pre.extra), vars = {}, varTypes = {};
    all.forEach(t => { vars[t.name] = initOf(t.type); varTypes[t.name] = engineType(t.type); });
    const task = { lang: lang === 'scl' ? undefined : 'kop', initialVars: vars, varTypes, fbTypes: fb };
    try {
      const EE = lang === 'scl' ? E : K;
      const prog = EE.compileSCL(pre.src, lang === 'scl' ? { vars, varTypes, fbTypes: fb } : task);
      return { ok: true, prog, vars, varTypes, all, warnings: tc.warnings, used: EE.constructsUsed(prog) };
    } catch(e){ return { ok: false, errors: [{ line: e.line || 0, text: e.message || String(e) }] }; }
  };
  // Laden: CPU geht in STOP, Programm + Konfiguration + Variablentabelle werden übernommen
  cpu.download = function(p){
    const c = cpu.compile(p.source, p.lang || 'scl', p.tags || TAGS_WERKSTATT, p.fb);
    if(!c.ok) return c;
    if(cpu.mode === 'RUN') log('Betriebszustand RUN → STOP (Laden)');
    cpu.mode = 'STOP'; cpu.rt = null;
    const hwChanged = cpu.loaded && !hwEqual(cpu.loaded.hw, p.hw);
    cpu.loaded = { prog: c.prog, vars: c.vars, all: c.all, hw: JSON.parse(JSON.stringify(p.hw || HW_DEFAULT)), lang: p.lang || 'scl', source: p.source, tags: JSON.parse(JSON.stringify(p.tags || TAGS_WERKSTATT)) };
    log('Laden in Gerät: Programm' + (hwChanged ? ' und Hardwarekonfiguration' : '') + ' übernommen');
    return { ok: true, warnings: c.warnings };
  };
  cpu.start = function(){
    if(!cpu.loaded) return { ok: false, error: 'Kein Programm geladen.' };
    if(cpu.mode === 'RUN') return { ok: true };
    cpu.rt = E.createRuntime(cpu.loaded.prog, cpu.loaded.vars); cpu.mode = 'RUN'; log('Betriebszustand STOP → RUN');
    return { ok: true };
  };
  cpu.stop = function(reason){ if(cpu.mode === 'RUN') log('Betriebszustand RUN → STOP' + (reason ? ' (' + reason + ')' : '')); cpu.mode = 'STOP'; };
  cpu.needsLoad = hw => !!cpu.loaded && !hwEqual(cpu.loaded.hw, hw);
  // Ein Zyklus: Eingänge aus dem Prozessabbild, OB1, Ausgänge. io: { 'I0.4': true, 'IW96': 13824, … }
  cpu.cycle = function(dt, io, diag){
    cpu.t += dt || 0; cpu.lastIo = io;
    // Diagnosealarme kommend/gehend
    const now = {}; (diag || []).forEach(d => { now[d.text] = true; if(!cpu.alarms[d.text]) log(d.text + ' (kommend)'); });
    Object.keys(cpu.alarms).forEach(k => { if(!now[k]) log(k + ' (gehend)'); }); cpu.alarms = now;
    const out = {};
    if(cpu.mode !== 'RUN' || !cpu.rt){ outputsStop(out); return { mode: cpu.mode, out }; }
    const inputs = {};
    cpu.loaded.all.forEach(t => { const p = parseAddr(t.addr); if(p && p.area === 'I' && io[p.key] !== undefined) inputs[t.name] = io[p.key]; });
    try { cpu.rt.scan(dt, inputs); }
    catch(e){ cpu.stop('Fehler: ' + (e.message || e)); outputsStop(out); return { mode: cpu.mode, out, error: e.message }; }
    cpu.loaded.all.forEach(t => { const p = parseAddr(t.addr); if(p && p.area === 'Q') out[p.key] = cpu.rt.env[t.name]; });
    return { mode: cpu.mode, out };
  };
  function outputsStop(out){
    (cpu.loaded ? cpu.loaded.all : TAGS_WERKSTATT).forEach(t => { const p = parseAddr(t.addr); if(p && p.area === 'Q') out[p.key] = p.width === 'bit' ? false : 0; });
    if(cpu.loaded) Object.keys(AQ_ADDR).forEach(ch => { out[AQ_ADDR[ch]] = cpu.loaded.hw.aq[ch].stopValue || 0; });   // Ersatzwert bei STOP
  }
  // Wert einer Variablen oder Adresse (Beobachtung): in RUN aus dem Programm, sonst aus dem Prozessabbild
  cpu.read = function(ref){
    const p = parseAddr(ref.startsWith('%') ? ref : '%' + ref);
    if(p){
      const t = cpu.loaded && cpu.loaded.all.find(x => { const q = parseAddr(x.addr); return q && q.key === p.key; });
      if(t && cpu.rt) return cpu.rt.env[t.name];
      return cpu.lastIo ? cpu.lastIo[p.key] : undefined;
    }
    const name = String(ref).replace(/"/g, '');
    if(cpu.rt && cpu.rt.env[name] !== undefined) return cpu.rt.env[name];
    const t = cpu.loaded && cpu.loaded.all.find(x => x.name.toLowerCase() === name.toLowerCase());
    if(t){ const q = parseAddr(t.addr); if(q && cpu.lastIo && cpu.lastIo[q.key] !== undefined) return cpu.lastIo[q.key]; return initOf(t.type); }
    return undefined;
  };
  return cpu;
}

/* ---------- Werkstatt-Sitzung: Verdrahtung + CPU + Zeit ---------- */
function session(o){
  const cpu = o.cpu || Cpu(o), s = { cpu, t: 0, io: null, out: {}, diag: [] };
  s.step = function(dt){
    dt = dt == null ? SM.DT : dt; s.t += dt;
    const hw = cpu.loaded ? cpu.loaded.hw : (o.hw ? o.hw() : HW_DEFAULT);
    const img = ioImage({ state: o.state(), world: o.world ? o.world() : {}, phys: o.phys ? o.phys() : {}, hw, t: s.t, prev: s.io });
    const on = !!o.state().mainSwitch && img.eval.supply.dcOk;
    if(!on && cpu.mode === 'RUN') cpu.stop('Spannungsausfall');
    s.io = img.io; s.diag = img.diag;
    const r = cpu.cycle(dt, img.io, on ? img.diag : []);
    s.out = r.out;
    return r;
  };
  return s;
}
const fmt = (v, f) => v === undefined || v === null ? '—' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : f === 'hex' ? '16#' + ((v & 0xFFFF) >>> 0).toString(16).toUpperCase().padStart(4, '0') : Number.isInteger(v) ? String(v) : (Math.round(v * 1000) / 1000).toString();

root.SensorPLC = { TAGS_WERKSTATT, TYPES, parseAddr, checkTags, preprocess, HW_DEFAULT, SLOTS, AI_ADDR, AQ_ADDR, AI_TYPES, AI_RANGES, SMOOTH, DI_DELAYS, newHw, hwEqual, aiCfg, ioImage, Cpu, session, fmt };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorPLC;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== sensor_tasks.js ==== */
(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Aufgabenformat, Presets, Anlagensimulation, Schrittprüfung (docs/SENSORWERKSTATT_PLAN.md Teil 6, 8.2; Paket S7)
   defWorkshopTask({ id, module, no, title, story, brief, learn, take, man, theory, hint, hint2, level:'schnell'|'werkstatt'|'profi',
     boss, final, debug, parts:['B1',…], modules:['A1',…], x2:[…], x3:n, start:'preset:m1_base' | {…Zustand}, hw:{…Patch}, tags:'werkstatt'|'leer'|[…],
     steps:[ { kind, text, …, ref } ] })
   Format v2 (Umbau 29.09.2026, docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md 5.1), meist gesetzt über content_sensor/plan.js (SensorPlan):
     core:true (Kernaufgabe) · hidden:true (nicht angezeigt, per ID weiter auflösbar, nie löschen) · phase:'verbinden'|'signale'|'programm'|'laufen'|'alle'|[Phasen] (Schwerpunkt)
     prefill:[Phasen] (vorbefüllt: Referenz dieser Phasen ist im Startzustand angewendet; Standard = alle Nicht-Schwerpunkt-Phasen mit Schritten)
     lang:['scl','fup'] · tools:[] (nur 'multimeter', 'kalibrator') · scene:'sortierstrecke'|'tank'
   Schrittarten:
     quiz     { q, options, correct | answer, tol, unit }             Lesen/Rechnen (R)
     mount    { part, dist:[soll, tol], tight, align, poti:[min,max], teach }   Montieren/Einstellen (Mo)
     plug     { parts:[…] }                                              M12 anstecken und festziehen
     wire     { target:[…Wiring.check-Regeln], ref:{ add:[[a,b]], remove:[[a,b]], bridges:[…], knives:{}, shields:{} }, wrong:[{add, remove, bridges}] }
     power    { }                                                        -Q0 ein, Netzteil ohne Überlast
     observe  { cases:[{ world:{…Szenario}, di:{'I0.4':true} }] }       Funktion der Verdrahtung (V/L)
     tags     { require:[{ name, type, addr }] }                         PLC-Variablentabelle (K)
     config   { target:{ 'ai.CH0.type':'I_2W', … } }                     Gerätekonfiguration (K)
     load     { run:true }                                               In Gerät laden, RUN (L)
     measure  { ask:[{ q, unit, answer | calc(ctx), tol }] }             Messen/Protokoll (M)
     program  { langs, fb:{Inst:'TON'}, tagsExtra:[…], start:{scl,kop,fup}, ref:{scl,kop,fup},
                tests:[{ in:{Tag:v}, phys:{B11:50}, expect:{Tag:v|[v,tol]} }], timed:[{ steps:[[dt, in, expect]] }], must:[…], wrong:[{scl:'…'}] }
   ============================================================ */
const W = root.Wiring, SM = root.SensorModel, PLC = root.SensorPLC;
const C = root.SCL_CONTENT = root.SCL_CONTENT || { tasks: [], theory: [], chapters: [], bugs: [] };
const PRESETS = {};
const clone = o => JSON.parse(JSON.stringify(o === undefined ? null : o));

/* ---------- Presets: benannte Ausgangszustände (Verdrahtung, Montage, Stecker) ---------- */
function defPreset(name, spec){ PRESETS[name] = spec; }
// spec: { base:'andererPreset', wires:[[a,b], …], bridges:[…], mounts:{…}, plugs:{…}, knives:{…}, shields:{…}, mainSwitch, level }
function buildState(spec, level){
  if(typeof spec === 'string') spec = spec.startsWith('preset:') ? PRESETS[spec.slice(7)] : PRESETS[spec];
  spec = spec || {};
  const st = spec.base ? buildState(spec.base, level) : W.newState({ level: level || 'werkstatt' });
  if(level) st.level = level;
  (spec.wires || []).forEach(w => st.wires.push({ from: w[0], to: w[1], ferrule: w[2] !== false, label: '' }));
  (spec.bridges || []).forEach(b => { if(!st.bridges.includes(b)) st.bridges.push(b); });
  ['mounts', 'plugs', 'knives', 'shields', 'heads'].forEach(k => { if(spec[k]) st[k] = Object.assign(st[k] || {}, clone(spec[k])); });
  if(spec.mainSwitch != null) st.mainSwitch = !!spec.mainSwitch;
  if(spec.f2Tripped) st.f2Tripped = true;
  return st;
}

/* ---------- Anlagensimulation: Szenario → Welt (Sensor aktiv / Taster gedrückt) ---------- */
// sc: { parts:{ B1:'stahl'|null, B2:…, B3:…, B4:…, B5:…, N1:… }, press:['S1'], hood:'offen'|'zu', cyl:'hinten'|'vorne'|null, t }
const PART_H = 20;   // Werkstückhöhe mm (Taster -B3 schaut von oben auf das Band)
function worldFrom(state, sc){
  sc = sc || {}; const parts = sc.parts || {}, w = {}, mo = id => W.mountOf(state, id), t = sc.t || 0;
  const obj = (mat, dist) => mat ? { material: mat, dist } : null;
  w.B1 = { active: SM.detects({ kind: 'ind', sn: 8 }, obj(parts.B1, mo('B1').dist)) };
  const m2 = mo('B2'); w.B2 = { active: SM.detects({ kind: 'kap', sn: 8, poti: m2.poti }, parts.B2 ? obj(parts.B2, m2.dist) : { material: 'band', dist: m2.dist }) };
  const m3 = mo('B3'); w.B3 = { active: SM.detects({ kind: 'opt_bgs', sn: 120, teach: m3.teach == null ? undefined : m3.teach }, parts.B3 ? obj(parts.B3, m3.dist - PART_H) : { material: 'band', dist: m3.dist }) };
  const a41 = mo('B4.1').align, a42 = mo('B4.2').align, al = W.alignQuality({ h: Math.max(Math.abs(a41.h), Math.abs(a42.h)), v: Math.max(Math.abs(a41.v), Math.abs(a42.v)) });
  w['B4.2'] = { active: al === 'aus' ? true : al === 'knapp' ? (!!parts.B4 || SM.looseContact('B4', t)) : !!parts.B4, stable: al };
  const a5 = W.alignQuality(mo('B5').align);
  w.B5 = { active: a5 === 'aus' ? true : SM.detects({ kind: 'opt_reflex' }, obj(parts.B5, 50)), stable: a5 };
  const cylPos = sc.cyl === 'vorne' ? 35 : sc.cyl === 'hinten' ? 5 : null;
  ['B6', 'B7'].forEach(id => { w[id] = { active: cylPos != null && Math.abs(mo(id).dist - cylPos) <= 3 }; });
  if(parts.N1 !== undefined) w.N1 = { active: SM.detects({ kind: 'ind', sn: 8 }, obj(parts.N1, 4)) };
  (sc.press || []).forEach(id => { w[id] = { pressed: true }; });
  w.S5 = { open: sc.hood === 'offen' };
  if(sc.b8 != null) w.B8 = { active: !!sc.b8 };
  if(sc.b9 != null) w.B9 = { pressed: !!sc.b9 };
  return w;
}

/* ---------- Aufgaben definieren ---------- */
root.defWorkshopTask = function(o){
  const t = {
    id: o.id, level: o.module, no: o.no, workshop: true, title: o.title, story: o.story || '', briefing: o.brief || '',
    learn: o.learn || '', takeaway: o.take || '', isDebug: !!o.debug, isBoss: !!o.boss, isFinal: !!o.final,
    manualId: o.man || null, theoryId: o.theory || null, hint: o.hint || '', hint2: o.hint2 || '', mustUse: [],
    level_: o.level || 'werkstatt', reality: o.level || 'werkstatt',
    parts: o.parts || ['B1'], modules: o.modules || ['A1'], x2: o.x2 || [1, 2, 3, 4, 5, 6, 7, 8], x3: o.x3 || 0,
    start: o.start || null, hwPatch: o.hw || null, tagsStart: o.tags || 'werkstatt', practice: o.practice || null,
    steps: (o.steps || []).map(s => Object.assign({}, s)),
    initialVars: {}, varTypes: {}, fbTypes: {}, testCases: [], sceneBindings: [], starterCode: '', refLines: 0,
    core: !!o.core, hidden: !!o.hidden, phase: o.phase || null, prefill: o.prefill || null, tools: o.tools || [], scene: o.scene || null, lang: o.lang || null
  };
  t.program = t.steps.find(s => s.kind === 'program') || null;
  let refText = null;   // Musterlösung als Text (Karte, Vergleich) – erst bei Bedarf berechnen
  Object.defineProperty(t, 'refSolution', { enumerable: false, get(){ if(refText == null){ try { refText = describe(t, applyRef(t, newContext(t))); } catch(e){ refText = ''; } } return refText; } });
  C.tasks.push(t);
  // Fehlersuche-Aufgaben sind zugleich Störungsjagd-Szenarien der Live-Challenge: der Fehler steckt im Ausgangszustand
  if(o.debug){
    // Störungsjagd (W9): nur die Fehlerarten der neuen Kernschleife – Verdrahtung, Konfiguration, Programm. Andere (z. B. Montage) bleiben auflösbar, aber ausgeblendet.
    const kinds = (o.steps || []).map(s => s.kind), art = kinds.includes('wire') ? 'verdrahtung' : kinds.includes('config') ? 'konfiguration' : kinds.includes('program') ? 'programm' : null;
    C.bugs = C.bugs || []; C.bugs.push({ id: 'sb_' + o.id, task: o.id, title: o.title, symptom: String(o.story || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), workshop: true, art, ...(art ? {} : { hidden: true }) });
  }
  return t;
};

/* ---------- Phasen (Kernschleife): ① Verbinden → ② Signale → ③ Programm → ④ Laufen lassen ---------- */
const PHASES = ['verbinden', 'signale', 'programm', 'laufen'];
const TOOLS_ALLOWED = ['multimeter', 'kalibrator'];
// Schwerpunkt(e) der Aufgabe als Liste; 'alle' = jede Phase mit Schritten ist Arbeit
function focusOf(t){
  if(!t.phase) return null;
  if(t.phase === 'alle') return PHASES.slice();
  return (Array.isArray(t.phase) ? t.phase : [t.phase]).filter(p => PHASES.includes(p));
}
// Zu welcher Phase gehört ein Schritt? Montage/Anstecken/Adern = Verbinden; Variablen/Konfiguration = Signale; Programm = Programm;
// Einschalten, Laden+RUN, Beobachten, Messen = Laufen lassen (geschieht in der Anlage); Fragen gehören zum Schwerpunkt.
// Mechanik automatisch (Umbau 3/W6): Anstecken, Ausrichten, Montage auf Standardabstand und Einschalten macht das Spiel.
// Einstellen bleibt Arbeit (Annahme A1): Abstand ≠ Standard, Poti, Teach-in – als Regler in „Laufen lassen“.
function isAdjust(s){ if(s.kind !== 'mount') return false; const d = W.MOUNTABLE[s.part]; return !!(s.poti || s.teach || (s.dist && (!d || Math.abs(s.dist[0] - d.dist) > 1e-9))); }
function isAutoStep(t, s){ if(!t.core) return false; return s.kind === 'plug' || s.kind === 'power' || (s.kind === 'mount' && !isAdjust(s)); }
function phaseOfStep(t, s){
  const k = s.kind, foc = focusOf(t) || [], main = foc.length === 1 ? foc[0] : 'laufen';
  if(k === 'wire' || k === 'plug') return 'verbinden';
  if(k === 'mount') return isAdjust(s) || (foc.length === 1 && foc[0] === 'laufen') ? 'laufen' : 'verbinden';
  if(k === 'tags' || k === 'config') return 'signale';
  if(k === 'program') return 'programm';
  if(k === 'power' || k === 'load' || k === 'observe' || k === 'measure') return 'laufen';
  if(k === 'quiz') return main;
  return 'laufen';
}
function stepsOfPhase(t, phase){ return t.steps.map((s, i) => ({ s, i })).filter(x => phaseOfStep(t, x.s) === phase).map(x => x.i); }
// Vorbefüllte Phasen: ausdrücklich gesetzt oder alle Phasen mit Schritten, die kein Schwerpunkt sind ('laufen' wird nie vorbefüllt, das ist der Probelauf)
function prefillOf(t){
  const foc = focusOf(t); if(!foc) return [];
  if(t.prefill) return t.prefill.slice();
  return PHASES.filter(p => p !== 'laufen' && !foc.includes(p) && stepsOfPhase(t, p).length);
}

/* ---------- Arbeitskontext einer Aufgabe ---------- */
function setPath(o, path, v){ const ks = path.split('.'); for(let i = 0; i < ks.length - 1; i++){ o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
function getPath(o, path){ return path.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function startTags(t){
  if(Array.isArray(t.tagsStart)) return clone(t.tagsStart);
  if(t.tagsStart === 'leer') return [];
  return clone(PLC.TAGS_WERKSTATT);
}
function newContext(t, opt){
  const hw = PLC.newHw(); if(t.hwPatch) Object.keys(t.hwPatch).forEach(k => setPath(hw, k, clone(t.hwPatch[k])));
  const p = t.program;
  const lang = p ? (p.langs || ['scl'])[0] : 'scl';
  const tags = startTags(t).concat(p && p.tagsExtra ? clone(p.tagsExtra).filter(x => !startTags(t).some(y => y.name === x.name)) : []);
  const ctx = { state: buildState(t.start, t.reality), hw, tags, lang, source: p && p.start ? (p.start[lang] || '') : '', answers: {}, cpu: PLC.Cpu(), fb: p && p.fb ? p.fb : {} };
  // Format v2: vorbefüllte Phasen sind im Startzustand schon gelöst (Referenz angewendet); der Lernende bestätigt sie mit „Übernehmen“
  if(!(opt && opt.noPrefill)){
    prefillOf(t).forEach(ph => stepsOfPhase(t, ph).forEach(i => applyStepRef(t, t.steps[i], i, ctx)));
    t.steps.forEach((s, i) => { if(isAutoStep(t, s)) applyStepRef(t, s, i, ctx); });   // Mechanik automatisch
    if(t.core) ctx.state.mainSwitch = true;   // Einschalten automatisch: LEDs reagieren schon beim Verdrahten (A5)
  }
  return ctx;
}

/* ---------- Programm testen (physikalische Szenarien → Rohwerte über das Modell) ---------- */
function channelTag(tags, ch){ const a = PLC.AI_ADDR[ch]; return tags.find(x => { const p = PLC.parseAddr(x.addr); return p && p.key === a; }); }
function inputsFor(step, tc, tags, hw){
  const inp = Object.assign({}, tc.in || {});
  Object.keys(tc.phys || {}).forEach(part => {
    const P = W.PARTS[part]; if(!P || !P.ai) return;
    const cfg = PLC.aiCfg(hw, P.ai), sig = SM.transmitterSignal(part, tc.phys[part]);
    const tag = channelTag(tags, P.ai); if(tag) inp[tag.name] = SM.rawValue(sig, cfg);
  });
  Object.keys(tc.raw || {}).forEach(k => { inp[k] = tc.raw[k]; });
  return inp;
}
const near = (a, e) => Array.isArray(e) ? typeof a === 'number' && Math.abs(a - e[0]) <= e[1] : typeof e === 'number' && typeof a === 'number' ? Math.abs(a - e) < 0.005 : a === e;
function runProgram(step, lang, source, tags, hw){
  const cpu = PLC.Cpu(), c = cpu.compile(source, lang, tags, step.fb || {});
  if(!c.ok) return { ok: false, compile: c.errors };
  const E = root.SCLEngine, cases = [];
  let ok = true;
  const run = (seq, name) => {
    const rt = E.createRuntime(c.prog, c.vars);
    for(let i = 0; i < seq.length; i++){
      const [dt, tc] = seq[i];
      const inp = inputsFor(step, tc, tags, hw);
      try { rt.scan(dt, inp); } catch(e){ cases.push({ name, i, error: e.message, pass: false }); ok = false; return; }
      const checks = Object.keys(tc.expect || {}).map(k => ({ name: k, expected: tc.expect[k], actual: rt.env[k], pass: near(rt.env[k], tc.expect[k]) }));
      const pass = checks.every(x => x.pass);
      cases.push({ name, i, t: rt.t, inputs: inp, checks, pass });
      if(!pass){ ok = false; return; }
    }
  };
  (step.tests || []).forEach((tc, i) => { if(ok) run([[0, tc]], 'Test ' + (i + 1)); });
  (step.timed || []).forEach((sq, i) => { if(ok) run(sq.steps.map(s => [s[0], { in: s[1] && (s[1].in || s[1].phys || s[1].raw) ? s[1].in : s[1], phys: s[1] && s[1].phys, raw: s[1] && s[1].raw, expect: s[2] }]), 'Ablauf ' + (i + 1)); });
  const missing = (step.must || []).filter(m => !c.used.has(m));
  return { ok: ok && !missing.length, cases, missing, failed: cases.find(x => !x.pass) || null };
}

/* ---------- Schritte prüfen ---------- */
const PLUG_TEXT = { ab: 'nicht angesteckt', lose: 'Rändelmutter lose' };
function checkStep(step, ctx, idx){
  const st = ctx.state, issues = [];
  const k = step.kind;
  if(k === 'quiz'){
    const a = (ctx.answers[idx] || {})[0];
    if(step.options){ if(+a !== step.correct) issues.push(a == null ? 'Noch keine Antwort gewählt.' : 'Die Antwort stimmt noch nicht.'); }
    else { const v = parseFloat(String(a == null ? '' : a).replace(',', '.')); if(!isFinite(v) || Math.abs(v - step.answer) > (step.tol || 0)) issues.push(a == null || a === '' ? 'Noch kein Wert eingetragen.' : 'Der Wert stimmt noch nicht' + (step.unit ? ' (Einheit ' + step.unit + ')' : '') + '.'); }
  }
  else if(k === 'mount'){
    const m = W.mountOf(st, step.part);
    if(step.dist && Math.abs(m.dist - step.dist[0]) > step.dist[1]) issues.push('-' + step.part + ': Abstand ' + m.dist.toFixed(1) + ' mm passt nicht.');
    if(step.tight !== false && W.MOUNTABLE[step.part] && !m.tight) issues.push('-' + step.part + ': ' + (W.MOUNTABLE[step.part].slot ? 'Klemmschraube' : 'Kontermuttern') + ' nicht festgezogen.');
    if(step.align && W.alignQuality(m.align) !== 'stabil') issues.push('-' + step.part + ': Stabilitäts-LED leuchtet nicht ruhig.');
    if(step.poti && (m.poti < step.poti[0] - 1e-9 || m.poti > step.poti[1] + 1e-9)) issues.push('-' + step.part + ': Empfindlichkeit (Poti) passt nicht.');
    if(step.teach && (m.teach == null || Math.abs(m.teach - m.dist) > 2)) issues.push('-' + step.part + ': Hintergrund nicht eingelernt.');
  }
  else if(k === 'plug'){ (step.parts || []).forEach(p => { const s = W.plugState(st, p); if(s !== 'fest') issues.push('-' + p + ': M12-Leitung ' + PLUG_TEXT[s] + '.'); }); }
  else if(k === 'wire'){ W.check(st, step.target).issues.forEach(i => issues.push(i.text)); }
  else if(k === 'power'){ if(!st.mainSwitch) issues.push('-Q0 ist ausgeschaltet.'); else { const ev = W.evaluate(st, {}); if(!ev.supply.dcOk) issues.push('-G1 in Überlast (Kurzschluss L+/M).'); } }
  else if(k === 'observe'){
    if(!st.mainSwitch) issues.push('-Q0 ist ausgeschaltet – ohne Spannung kein Signal.');
    else (step.cases || []).forEach(c => {
      const ev = W.evaluate(st, worldFrom(st, c.world), { t: 0 });
      Object.keys(c.di || {}).forEach(a => { if(!!ev.di[a] !== !!c.di[a]) issues.push((c.text || 'Eingang %' + a) + ': ist ' + (ev.di[a] ? 1 : 0) + ', erwartet ' + (c.di[a] ? 1 : 0) + '.'); });
    });
  }
  else if(k === 'tags'){
    const chk = PLC.checkTags(ctx.tags); chk.errors.forEach(e => issues.push(e.text));
    (step.require || []).forEach(r => {
      const t = ctx.tags.find(x => x.name.toLowerCase() === r.name.toLowerCase());
      if(!t) issues.push('Variable „' + r.name + '“ fehlt.');
      else { if(r.addr && (PLC.parseAddr(t.addr) || {}).key !== PLC.parseAddr(r.addr).key) issues.push('„' + r.name + '“: Adresse passt nicht zum Klemmenplan.'); if(r.type && t.type !== r.type) issues.push('„' + r.name + '“: Datentyp ' + t.type + ' passt nicht.'); }
    });
  }
  else if(k === 'config'){ Object.keys(step.target || {}).forEach(p => { if(JSON.stringify(getPath(ctx.hw, p)) !== JSON.stringify(step.target[p])) issues.push(configName(p) + ' ist nicht richtig eingestellt.'); }); }
  else if(k === 'load'){
    const cpu = ctx.cpu;
    if(!ctx.state.mainSwitch) issues.push('-Q0 ist aus – die CPU hat keine Spannung.');
    if(!cpu.loaded) issues.push('Noch nichts in die CPU geladen.');
    else {
      if(!PLC.hwEqual(cpu.loaded.hw, ctx.hw)) issues.push('Die Konfiguration im Gerät ist nicht aktuell – neu laden.');
      if(ctx.program && (cpu.loaded.source !== ctx.source || cpu.loaded.lang !== ctx.lang)) issues.push('Das Programm im Gerät ist nicht aktuell – neu laden.');
      if(JSON.stringify(cpu.loaded.tags) !== JSON.stringify(ctx.tags)) issues.push('Die Variablentabelle im Gerät ist nicht aktuell – neu laden.');
      if(step.run !== false && cpu.mode !== 'RUN') issues.push('Die CPU ist nicht in RUN.');
    }
  }
  else if(k === 'measure'){
    (step.ask || []).forEach((a, i) => { const v = parseFloat(String(((ctx.answers[idx] || {})[i]) == null ? '' : ctx.answers[idx][i]).replace(',', '.')); const want = expectedMeasure(a, ctx); if(!isFinite(v)) issues.push((a.q || 'Messwert ' + (i + 1)) + ': noch kein Wert.'); else if(Math.abs(v - want) > (a.tol || 0)) issues.push((a.q || 'Messwert ' + (i + 1)) + ': Wert passt nicht zur Messung.'); });
  }
  else if(k === 'program'){
    const r = runProgram(step, ctx.lang, ctx.source, ctx.tags, ctx.hw);
    ctx.lastProgram = r;
    if(r.compile) r.compile.forEach(e => issues.push('Übersetzen: ' + e.text));
    else { if(r.failed) issues.push(programFailText(r.failed)); r.missing.forEach(m => issues.push('Verwende ' + m + '.')); }
  }
  return { ok: !issues.length, issues };
}
function expectedMeasure(a, ctx){ return typeof a.calc === 'function' ? a.calc(ctx, SM, W) : a.answer; }
function configName(p){ const m = /^ai\.CH(\d)\.(\w+)/.exec(p); if(m) return 'SM 1231 Kanal ' + m[1] + ': ' + ({ type: 'Messart', range: 'Messbereich', smooth: 'Glättung', diag: 'Diagnose' })[m[2]]; const q = /^aq\.CH(\d)\.(\w+)/.exec(p); if(q) return 'SM 1232 Kanal ' + q[1] + ': ' + ({ type: 'Ausgabeart', range: 'Bereich', stopValue: 'Ersatzwert' })[q[2]]; return p; }
function programFailText(f){
  if(f.error) return f.name + ': Laufzeitfehler – ' + f.error;
  const c = f.checks.find(x => !x.pass), show = v => Array.isArray(v) ? v[0] + ' ± ' + v[1] : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
  const inp = Object.keys(f.inputs || {}).map(k => k + ' = ' + show(f.inputs[k])).join(', ');
  return f.name + (f.i ? ', Zyklus ' + (f.i + 1) : '') + (inp ? ' (' + inp + ')' : '') + ': "' + c.name + '" ist ' + show(c.actual) + ', erwartet ' + show(c.expected) + '.';
}
function checkTask(t, ctx){
  const steps = t.steps.map((s, i) => Object.assign({ i, kind: s.kind, text: s.text }, checkStep(s, ctx, i)));
  return { ok: steps.every(s => s.ok), steps, first: steps.find(s => !s.ok) || null };
}

/* ---------- Referenzlösung anwenden (Validator, Durchlauf-Test) ---------- */
function applyWireOps(st, ops){
  if(!ops) return;
  (ops.remove || []).forEach(([a, b]) => W.removeWire(st, a, b));
  (ops.removePart || []).forEach(p => W.removePart(st, p));
  (ops.add || []).forEach(([a, b]) => { if(st.wires.some(w => (w.from === a && w.to === b) || (w.from === b && w.to === a))) return; const was = st.mainSwitch; st.mainSwitch = false; W.addWire(st, a, b, { ferrule: true }); st.mainSwitch = was; });
  (ops.bridges || []).forEach(b => { if(!st.bridges.includes(b)) st.bridges.push(b); });
  (ops.unbridge || []).forEach(b => { st.bridges = st.bridges.filter(x => x !== b); });
  if(ops.knives) st.knives = Object.assign(st.knives || {}, ops.knives);
  if(ops.shields) st.shields = Object.assign(st.shields || {}, ops.shields);
  if(ops.plugs) st.plugs = Object.assign(st.plugs || {}, ops.plugs);
  if(ops.ferrules) st.wires.forEach(w => { w.ferrule = true; });
}
function applyStepRef(t, s, i, ctx, lang){
  const st = ctx.state;
  if(s.kind === 'quiz') ctx.answers[i] = { 0: s.options ? s.correct : s.answer };
  else if(s.kind === 'mount'){ st.mounts = st.mounts || {}; const m = st.mounts[s.part] = Object.assign(W.mountOf(st, s.part), st.mounts[s.part] || {}); if(s.dist) m.dist = s.dist[0]; m.tight = true; if(s.align) m.align = { h: 0, v: 0 }; if(s.poti) m.poti = s.ref && s.ref.poti != null ? s.ref.poti : (s.poti[0] + s.poti[1]) / 2; if(s.teach) m.teach = m.dist; if(s.alsoAlign) (s.alsoAlign || []).forEach(p => { st.mounts[p] = Object.assign(W.mountOf(st, p), st.mounts[p] || {}, { align: { h: 0, v: 0 } }); }); }
  else if(s.kind === 'plug') (s.parts || []).forEach(p => { W.plugAction(st, p, 'plug'); W.plugAction(st, p, 'tighten'); });
  else if(s.kind === 'wire') applyWireOps(st, s.ref);
  else if(s.kind === 'power') st.mainSwitch = true;
  else if(s.kind === 'observe'){ st.mainSwitch = true; }
  else if(s.kind === 'tags'){ (s.ref || s.require || []).forEach(r => { const x = ctx.tags.find(y => y.name.toLowerCase() === r.name.toLowerCase()); if(x) Object.assign(x, r); else ctx.tags.push(Object.assign({ comment: '' }, r)); }); ctx.tags = ctx.tags.filter(x => !(s.removeRef || []).includes(x.name)); }
  else if(s.kind === 'config') Object.keys(s.target || {}).forEach(p => setPath(ctx.hw, p, clone(s.target[p])));
  else if(s.kind === 'load'){ ctx.cpu.download({ source: ctx.source, lang: ctx.lang, tags: ctx.tags, hw: ctx.hw, fb: ctx.fb }); if(s.run !== false) ctx.cpu.start(); }
  else if(s.kind === 'measure') ctx.answers[i] = Object.fromEntries((s.ask || []).map((a, j) => [j, expectedMeasure(a, ctx)]));
  else if(s.kind === 'program'){ ctx.lang = lang || (s.langs || ['scl'])[0]; ctx.source = (s.ref || {})[ctx.lang] || ''; }
}
function applyRef(t, ctx, lang){ t.steps.forEach((s, i) => applyStepRef(t, s, i, ctx, lang)); return ctx; }

/* ---------- Lösung als Text (Karte, Vergleich mit der Musterlösung) ---------- */
function describe(t, ctx){
  const out = [], st = ctx.state, kinds = new Set(t.steps.map(s => s.kind));
  const parts = new Set(t.parts || []);
  if(kinds.has('mount')) t.steps.filter(s => s.kind === 'mount').forEach(s => { const m = W.mountOf(st, s.part); out.push('Montage -' + s.part + ': ' + [s.dist ? m.dist.toFixed(1) + ' mm' : '', W.MOUNTABLE[s.part] ? (m.tight ? 'fest' : 'lose') : '', s.align ? 'Ausrichtung ' + W.alignQuality(m.align) : '', s.poti ? 'Poti ' + Math.round(m.poti * 100) + ' %' : '', s.teach ? 'Hintergrund ' + (m.teach == null ? '–' : m.teach + ' mm') : ''].filter(Boolean).join(', ')); });
  if(kinds.has('plug')) t.steps.filter(s => s.kind === 'plug').forEach(s => s.parts.forEach(p => out.push('M12 -' + p + ': ' + W.plugState(st, p))));
  if(kinds.has('wire') || kinds.has('observe')){
    if(st.bridges.length) out.push('Querbrücker: ' + st.bridges.slice().sort().join(', '));
    st.wires.filter(w => parts.has(w.from.split(':')[0]) || parts.has(w.to.split(':')[0]) || /^A\d:[12]M$/.test(w.from) || /^A\d:[12]M$/.test(w.to)).map(w => w.from + ' → ' + w.to + (w.ferrule ? '' : ' (ohne Hülse)')).sort().forEach(l => out.push('Ader ' + l));
    Object.keys(st.knives || {}).filter(k => st.knives[k]).forEach(k => out.push('Trennmesser ' + k + ' offen'));
    Object.keys(st.shields || {}).filter(k => st.shields[k]).forEach(k => out.push('Schirm -' + k + ' aufgelegt'));
  }
  if(kinds.has('tags')) t.steps.filter(s => s.kind === 'tags').forEach(s => (s.require || []).forEach(r => { const x = ctx.tags.find(y => y.name.toLowerCase() === r.name.toLowerCase()); out.push('Variable ' + r.name + ': ' + (x ? x.type + ' ' + x.addr : 'fehlt')); }));
  if(kinds.has('config')) t.steps.filter(s => s.kind === 'config').forEach(s => Object.keys(s.target).forEach(p => out.push('Konfiguration ' + p + ' = ' + JSON.stringify(getPath(ctx.hw, p)))));
  t.steps.forEach((s, i) => {
    if(s.kind === 'quiz'){ const a = (ctx.answers[i] || {})[0]; out.push('Frage ' + (i + 1) + ': ' + (a == null ? '–' : s.options ? s.options[a] : a + (s.unit ? ' ' + s.unit : ''))); }
    if(s.kind === 'measure') (s.ask || []).forEach((a, j) => { const v = (ctx.answers[i] || {})[j]; out.push('Messung: ' + (a.q || '') + ' = ' + (v == null ? '–' : (typeof v === 'number' ? Math.round(v * 100) / 100 : v) + (a.unit ? ' ' + a.unit : ''))); });
  });
  if(t.program) out.push('', '// Programm (' + (ctx.lang || 'scl').toUpperCase() + ')', String(ctx.source || '').trim());
  return out.join('\n');
}

root.SensorTasks = { PHASES, TOOLS_ALLOWED, isAdjust, isAutoStep, focusOf, phaseOfStep, stepsOfPhase, prefillOf, PRESETS, defPreset, buildState, worldFrom, newContext, runProgram, inputsFor, checkStep, checkTask, applyRef, applyStepRef, applyWireOps, programFailText, expectedMeasure, setPath, getPath, startTags, PART_H, describe };
root.defPreset = defPreset;
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorTasks;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== sensor_visual.js ==== */
(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Schnittstellenvertrag für die Visualisierung (Paket W3, docs/SENSOR_VISUAL_VERTRAG.md)
   Rein rechnend (kein DOM, Node-testbar). Macht aus dem echten Spielzustand (Wiring + Aufgabe) die Daten, die
   SensorWiring25D (2.5D-Verdrahtung) und SensorPlant3D (Anlage) zeichnen, und setzt deren Ereignisse in Spielaktionen um.
   Regeln, Punkte und Bewertung bleiben in wiring.js / sensor_tasks.js; die Zeichenmodule dürfen nur darstellen und Ereignisse melden.

   SensorVisual.netlist(task, ctx)          → statische Beschreibung (Bauteile, Kabel, Adern, Klemmen, Baugruppen, zulässige Ziele)
   SensorVisual.state(task, ctx, opt)       → dynamischer Zustand (Adern/Verbindungen, Prüfergebnis je Ader, LEDs, Fehler, Hilfsziel)
   SensorVisual.help(task, ctx)             → nächstes Ziel für „Zeig mir“: { core, terminal, from, to, text }
   SensorVisual.apply(task, ctx, event)     → Ereignis wireDrop/wireRemove/… in den echten Spielzustand einarbeiten
   SensorVisual.plant(task, ctx, opt)       → Anlagenzustand (Format von SensorScene.setState) aus der aktuellen Auswertung
   SensorVisual.EVENTS / PLANT_FIELDS       → Dokumentation der Ereignisse und der setState-Felder
   ============================================================ */
const W = () => root.Wiring, T = () => root.SensorTasks, SM = () => root.SensorModel, PLC = () => root.SensorPLC;
const VERSION = 1;

// Ader-Farben (IEC 60757) und M12-Pin (A-codiert): 1 braun, 2 weiss, 3 blau, 4 schwarz
const CORE_COLOR = {
  BN: { name: 'braun', hex: '#8b5a2b', m12: 1 }, WH: { name: 'weiss', hex: '#e8e8e8', m12: 2 }, BU: { name: 'blau', hex: '#2f6fd0', m12: 3 }, BK: { name: 'schwarz', hex: '#222222', m12: 4 },
  '+': { name: 'rot', hex: '#c0392b' }, '-': { name: 'blau', hex: '#2f6fd0' }, 'L+': { name: 'rot', hex: '#c0392b' }, M: { name: 'blau', hex: '#2f6fd0' }, 'I+': { name: 'violett', hex: '#8e44ad' }, 'I-': { name: 'violett-weiss', hex: '#6c5ce7' }
};
// Bedeutung der Adern je Bauteiltyp
const ROLES = {
  sensor3: { BN: 'L+', BU: 'M', BK: 'Signal' }, sensor4: { BN: 'L+', BU: 'M', BK: 'Signal (Schliesser)', WH: 'Signal 2 (Öffner)' }, sender: { BN: 'L+', BU: 'M' },
  analogU: { BN: 'L+', BU: 'M', BK: 'Signal 0–10 V' }, analog2w: { '+': 'Schleife +', '-': 'Schleife −' }, analog4w: { 'L+': 'L+', M: 'M', 'I+': 'Signal +', 'I-': 'Signal −' },
  poti: { 1: 'Anschluss 1', 2: 'Schleifer', 3: 'Anschluss 3' }, contact2: {}
};
// Zeichenform je Bauteil (Schlüssel für die Darstellung, herstellerneutral)
const SHAPE = {
  B1: 'induktiv_m18', B2: 'kapazitiv_m18', B3: 'lichttaster', 'B4.1': 'lichtschranke_sender', 'B4.2': 'lichtschranke_empfaenger', B5: 'reflexlichtschranke', B6: 'zylinderschalter', B7: 'zylinderschalter',
  B8: 'kapazitiv_grenzschalter', B9: 'schwimmerschalter', S1: 'taster_gruen', S2: 'taster_rot', S3: 'not_halt', S4: 'wahlschalter', S5: 'positionsschalter', N1: 'induktiv_m18_npn',
  B10: 'ultraschall_m30', B11: 'drucktransmitter', B12: 'pt100_kopftransmitter', B13: 'durchflussmesser', R1: 'potentiometer'
};
const CONNECTOR = t => (t === 'analog2w' || t === 'poti' || t === 'contact2') ? 'litze' : 'm12';   // Leitungsende: M12-Stecker oder freie Litzen

const term = id => { const m = /^([A-Z]\d?):(.*)$/.exec(id); return m ? { block: m[1], rest: m[2] } : { block: id, rest: '' }; };
const isCore = id => !!W().PARTS[id.split(':')[0]];

/* ---------- Klemmenbeschreibung ---------- */
function terminalSpec(id){
  const Wi = W(), P = PLC(), { block, rest } = term(id);
  let m;
  if(block === 'X2' && (m = /^(\d+)\.(L\+|S|M)$/.exec(rest))){
    const row = +m[1], lvl = m[2], di = Wi.DI_OF_X2[row];
    return { id, block: 'X2', kind: 'initiatorklemme', group: 'X2:' + row, row, level: lvl, label: lvl, potential: lvl === 'S' ? 'signal' : lvl, address: lvl === 'S' && di ? '%' + di : null, led: lvl === 'S', capacity: lvl === 'S' ? 2 : 1 };
  }
  if(block === 'X1' && (m = /^(L\+|M)(\d+)$/.exec(rest))) return { id, block: 'X1', kind: 'verteiler', group: 'X1:' + m[2], row: +m[2], level: m[1], label: m[1], potential: m[1], capacity: 1 };
  if(block === 'X3' && (m = /^(\d+)\.(a|b)$/.exec(rest))) return { id, block: 'X3', kind: 'trennklemme', group: 'X3:' + m[1], row: +m[1], level: m[2], side: m[2] === 'a' ? 'feld' : 'sps', label: m[2] === 'a' ? 'Feld' : 'SPS', measureJack: true, capacity: 1 };
  if(block === 'A1'){
    if((m = /^DI([ab])\.(\d)$/.exec(rest))){ const addr = m[1] === 'a' ? 'I0.' + m[2] : 'I1.' + m[2]; return { id, block: 'A1', kind: 'cpu', group: 'A1:DI', label: '.' + m[2], address: '%' + addr, led: true, capacity: 1 }; }
    if(rest === 'AI0' || rest === 'AI1') return { id, block: 'A1', kind: 'cpu', group: 'A1:AI', label: rest === 'AI0' ? 'AI 0' : 'AI 1', address: '%' + P.AI_ADDR[rest], capacity: 1 };
    return { id, block: 'A1', kind: 'cpu', group: 'A1:' + (rest.replace(/\..*/, '')), label: rest, potential: /M/.test(rest) ? 'M' : /L\+/.test(rest) ? 'L+' : null, capacity: 1 };
  }
  if(block === 'A2'){ if((m = /^(\d)([+-])$/.exec(rest))) return { id, block: 'A2', kind: 'analogmodul', group: 'A2:' + m[1], label: 'AI ' + m[1] + m[2], channel: +m[1], polarity: m[2], address: m[2] === '+' ? '%' + P.AI_ADDR['CH' + m[1]] : null, capacity: 1 }; return { id, block: 'A2', kind: 'analogmodul', group: 'A2:V', label: rest, potential: rest === 'M' ? 'M' : 'L+', capacity: 1 }; }
  if(block === 'A3') return { id, block: 'A3', kind: 'analogausgang', group: 'A3', label: 'AQ ' + rest, capacity: 1 };
  if(block === 'A4'){ if((m = /^\.(\d)$/.exec(rest))) return { id, block: 'A4', kind: 'digitalmodul', group: 'A4:DI', label: '.' + m[1], address: '%I16.' + m[1], led: true, capacity: 1 }; return { id, block: 'A4', kind: 'digitalmodul', group: 'A4:1M', label: rest, potential: null, capacity: 1 }; }
  if(block === 'G1' || block === 'F2' || block === 'F3') return { id, block, kind: 'versorgung', group: block, label: rest, capacity: 1 };
  return { id, block, kind: 'sonst', group: block, label: rest || id, capacity: 1 };
}

/* ---------- Ausschnitt: nur, was die Aufgabe braucht ---------- */
function viewOf(task){
  const T_ = T(), x2 = (task.x2 || []).slice(), mods = (task.modules || ['A1']).slice(), x3 = task.x3 || 0;
  const Wi = W(), ids = [];
  const push = id => { if(!ids.includes(id)) ids.push(id); };
  // Klemmen der Aufgabe: Adern-Ziele der Wire-Schritte + Zeilen x2/x3 + Verteiler + Baugruppen
  x2.forEach(n => ['L+', 'S', 'M'].forEach(l => push('X2:' + n + '.' + l)));
  for(let i = 1; i <= x3; i++){ push('X3:' + i + '.a'); push('X3:' + i + '.b'); }
  [1, 2, 3, 4, 5, 6, 7, 8].forEach(i => { push('X1:L+' + i); push('X1:M' + i); });
  Wi.TERMINALS.filter(id => mods.includes(term(id).block)).forEach(push);
  // Ziele aus den Referenzen ergänzen (z. B. Klemmen ausserhalb der angegebenen Zeilen)
  task.steps.filter(s => s.kind === 'wire').forEach(s => ((s.ref || {}).add || []).forEach(([a, b]) => { [a, b].forEach(n => { if(!isCore(n)) push(n); }); }));
  return ids.filter(id => Wi.TERMINALS.includes(id));
}
function targetPairs(task){ return task.steps.flatMap((s, i) => s.kind === 'wire' ? ((s.ref || {}).add || []).map(p => ({ a: p[0], b: p[1], step: i })) : []); }
// Adern, die die Referenz löst (Fehlersuche: falsch gelegte Ader entfernen) und Bauteile, deren Adern alle wegmüssen
function removePairs(task){ return task.steps.flatMap((s, i) => s.kind === 'wire' ? ((s.ref || {}).remove || []).map(p => ({ a: p[0], b: p[1], step: i })).concat(((s.ref || {}).removePart || []).map(part => ({ part, step: i }))) : []); }

/* ---------- Netzliste (statisch) ---------- */
function netlist(task, ctx){
  const Wi = W(), P = Wi.PARTS;
  const pids = (task.parts || []).filter(p => P[p]);
  const view = viewOf(task), pairs = targetPairs(task);
  const targetT = new Set(pairs.flatMap(p => [p.a, p.b]).filter(n => !isCore(n)));
  const groupsTarget = new Set([...targetT].map(id => terminalSpec(id).group));
  const terminals = view.map(id => { const s = terminalSpec(id); s.relevance = targetT.has(id) ? 'ziel' : groupsTarget.has(s.group) ? 'nah' : 'ruhe'; return s; });
  const parts = pids.map(id => {
    const p = P[id], roles = ROLES[p.type] || {};
    return { id, label: '-' + id, name: p.name, type: p.type, shape: SHAPE[id] || 'sensor', output: p.out || null, contact: p.contact || (p.sensor && p.sensor.contact) || null, address: p.di ? '%' + p.di : p.ai ? '%' + PLC().AI_ADDR[p.ai] : null,
      cable: { connector: CONNECTOR(p.type), cores: p.pins.map(pin => ({ id: id + ':' + pin, part: id, pin, label: pin, color: (CORE_COLOR[pin] || { name: '', hex: '#888' }).name, hex: (CORE_COLOR[pin] || { hex: '#888' }).hex, m12Pin: (CORE_COLOR[pin] || {}).m12 || null, role: roles[pin] || null })) } };
  });
  const cores = parts.flatMap(p => p.cable.cores);
  // zulässige Ziele einer Ader: jede Klemmstelle des Ausschnitts (Ader → Ader gibt es nicht); Belegung und Bewertung übernimmt wiring.js
  const allowed = {}; cores.forEach(c => { allowed[c.id] = terminals.map(t => t.id); });
  const modules = [...new Set(terminals.filter(t => /^A\d$/.test(t.block)).map(t => t.block))].map(b => ({ id: b, name: ({ A1: 'CPU 1214C DC/DC/DC', A2: 'SM 1231 AI 4', A3: 'SM 1232 AQ 2', A4: 'SM 1221 DI 8' })[b] }));
  const strips = [...new Set(terminals.filter(t => /^X\d$/.test(t.block)).map(t => t.block))].map(b => ({ id: b, name: ({ X1: 'Verteiler L+/M', X2: 'Initiatorenklemmen', X3: 'Trennklemmen 4–20 mA' })[b], rows: [...new Set(terminals.filter(t => t.block === b).map(t => t.row))] }));
  return { version: VERSION, task: { id: task.id, title: task.title, module: task.level, scene: task.scene || null, phase: task.phase || null, tools: (task.tools || []).slice() },
    parts, strips, modules, terminals, allowed,
    targets: pairs.map(p => ({ a: p.a, b: p.b })),   // Referenzverbindungen (nur für „Zeig mir“, Demo und Tests; im Spiel nicht an die Anzeige geben, sonst verrät die Darstellung die Lösung)
    bridges: Object.keys(Wi.BRIDGES).map(id => ({ id, name: Wi.BRIDGES[id].name })) };
}

/* ---------- Prüfergebnis je Ader ---------- */
// Regeln, die eine Ader nennen: net:[…] (muss verbunden sein) oder notNet. Ader ohne Draht = 'fehlt', Draht und alle Regeln erfüllt = 'ok', sonst 'falsch', ohne Regel = 'gesetzt'
function coreResults(task, st){
  const Wi = W(), out = {};
  const rules = task.steps.filter(s => s.kind === 'wire').flatMap(s => s.target || []);
  const wired = new Set(); st.wires.forEach(w => { wired.add(w.from); wired.add(w.to); });
  (task.parts || []).forEach(id => (Wi.PARTS[id] || { pins: [] }).pins.forEach(pin => {
    const core = id + ':' + pin;
    if(!wired.has(core)){ out[core] = 'fehlt'; return; }
    const mine = rules.filter(r => (r.net || r.notNet || []).includes(core));
    if(!mine.length){ out[core] = 'gesetzt'; return; }
    out[core] = mine.every(r => Wi.check(st, [r]).issues.filter(i => i.rule === r).length === 0) ? 'ok' : 'falsch';
  }));
  return out;
}

/* ---------- Zustand (dynamisch) ---------- */
function state(task, ctx, opt){
  const Wi = W(), st = ctx.state, base = (opt && opt.base) || T().newContext(task, { noPrefill: true }).state;
  const fixedKeys = new Set(base.wires.map(w => w.from + '>' + w.to));
  const world = (opt && opt.world) || {};
  const ev = Wi.evaluate(st, T().worldFrom(st, world), { t: (opt && opt.t) || 0 });
  const results = coreResults(task, st);
  const wires = st.wires.filter(w => isCore(w.from) || isCore(w.to) || (opt && opt.jumpers)).map((w, i) => {
    const a = isCore(w.from) ? w.from : w.to, b = a === w.from ? w.to : w.from;
    return { id: 'w' + i, core: isCore(a) ? a : null, a, b, ferrule: !!w.ferrule, prefilled: fixedKeys.has(w.from + '>' + w.to), result: isCore(a) ? results[a] : 'gesetzt' };
  });
  // vorgegebene Klemmenbrücken (Leiter zwischen zwei Klemmstellen, z. B. -X2:5.S → -A1:DIa.4): nur Anzeige, nicht die Adern des Sensors
  const links = st.wires.filter(w => !isCore(w.from) && !isCore(w.to)).map((w, i) => ({ id: 'l' + i, a: w.from, b: w.to, prefilled: fixedKeys.has(w.from + '>' + w.to) }));
  const ledsT = {}; Object.keys(Wi.DI_OF_X2).forEach(n => { ledsT['X2:' + n + '.S'] = !!ev.di[Wi.DI_OF_X2[n]]; });
  Object.keys(ev.di).forEach(a => { const tt = Wi.diTerminal(a); if(tt) ledsT[tt] = !!ev.di[a]; });
  return { version: VERSION, taskId: task.id, powered: !!st.mainSwitch && !!(ev.supply && ev.supply.dcOk), wires, links, bridges: (st.bridges || []).slice(), results,
    complete: task.steps.every((x, i) => x.kind !== 'wire' || T().checkStep(x, Object.assign({ answers: {}, tags: ctx.tags, hw: ctx.hw }, ctx), i).ok),   // Verdrahtungsschritte der Aufgabe erfüllt (ohne die Lösung zu zeigen)
    leds: ledsT,                         // Signal-LED je Klemme/Eingang (true = leuchtet)
    sensorLeds: Object.assign({}, ev.sensorLed || {}),   // LED am Sensor
    faults: (ev.faults || []).map(f => ({ code: f.code, part: f.part || null, text: f.text })),
    help: help(task, ctx) };
}

/* ---------- „Zeig mir“ ---------- */
function help(task, ctx){
  const Wi = W(), N = Wi.nets(ctx.state), st = ctx.state;
  const labelOf = id => { if(isCore(id)){ const [pt, pin] = id.split(':'); return 'Ader ' + pin + ' von -' + pt; } const sp = terminalSpec(id); return sp.block === 'X2' ? '-X2:' + sp.row + ' Ebene ' + sp.level : sp.block === 'X1' ? '-X1 ' + sp.level + sp.row : sp.block === 'X3' ? '-X3:' + sp.row + ' ' + sp.label : '-' + sp.block + ' ' + sp.label; };
  // 1. falsch gelegte Adern lösen (Fehlersuche), 2. fehlende Adern legen
  for(const r of removePairs(task)){
    const w = r.part ? st.wires.find(x => x.from.split(':')[0] === r.part || x.to.split(':')[0] === r.part) : st.wires.find(x => (x.from === r.a && x.to === r.b) || (x.from === r.b && x.to === r.a));
    if(!w) continue;
    const core = isCore(w.from) ? w.from : isCore(w.to) ? w.to : null, terminal = core ? (core === w.from ? w.to : w.from) : null;
    return { action: 'wireRemove', core, terminal, from: w.from, to: w.to, step: r.step, text: core ? labelOf(core) + ' von ' + labelOf(terminal) + ' lösen.' : 'Leitung ' + labelOf(w.from) + ' – ' + labelOf(w.to) + ' lösen.' };
  }
  for(const p of targetPairs(task)){
    if(N.same(p.a, p.b) && st.wires.some(w => (w.from === p.a && w.to === p.b) || (w.from === p.b && w.to === p.a))) continue;
    const core = isCore(p.a) ? p.a : isCore(p.b) ? p.b : null, terminal = core ? (core === p.a ? p.b : p.a) : null;
    return { action: 'wireDrop', core, terminal, from: p.a, to: p.b, step: p.step, text: core ? labelOf(core) + ' auf ' + labelOf(terminal) + ' legen.' : 'Leitung ' + labelOf(p.a) + ' nach ' + labelOf(p.b) + ' legen.' };
  }
  return null;
}

/* ---------- Ereignisse → Spielaktionen ---------- */
const EVENTS = {
  wireStart:   '(coreId)             Ader wird gegriffen; das Modul zeigt zulässige Ziele (netlist.allowed).',
  wireDrop:    '(coreId, terminalId)  Ader auf Klemmstelle gelegt → SensorVisual.apply legt die Ader (Aderendhülse automatisch).',
  wireRemove:  '(coreId)             Ader wird gelöst (Papierkorb / aus der Klemme ziehen). apply akzeptiert auch { from, to } für Leitungen zwischen Klemmen.',
  helpShow:    '(coreId, terminalId) „Zeig mir“ wurde ausgelöst; die Zielklemme pulsiert (Daten: state.help).',
  meterProbe:  '(terminalId, probeNr) Messspitze 1 oder 2 auf eine Klemmstelle gelegt (nur mit tools).',
  focus:       '(partId)             Anlage: Kamera fährt zum Bauteil (SensorPlant3D.focus).',
  highlight:   '(ids[])              Anlage: Bauteile hervorheben (SensorPlant3D.highlight).',
  scenePreset: '(name)               Anlage: "sortierstrecke" | "tank" (SensorPlant3D.scenePreset).'
};
function apply(task, ctx, ev){
  const Wi = W(), st = ctx.state;
  if(!ev || !ev.type) return { ok: false, error: 'Ereignis ohne Typ.' };
  if(ev.type === 'wireDrop'){
    const core = ev.core, tid = ev.terminal;
    if(!core || !isCore(core)) return { ok: false, error: 'Unbekannte Ader.' };
    if(!Wi.TERMINALS.includes(tid)) return { ok: false, error: 'Unbekannte Klemmstelle.' };
    st.wires.filter(w => w.from === core || w.to === core).forEach(w => Wi.removeWire(st, w.from, w.to));   // eine Ader hat nur ein freies Ende
    const was = st.mainSwitch; st.mainSwitch = false;
    const r = Wi.addWire(st, core, tid, { ferrule: true }); st.mainSwitch = was;
    // Mechanik automatisch (Umbau: keine Werkzeuge): Querbrücker, die die Aufgabe verlangt, sind gesetzt, sobald die erste Ader liegt
    task.steps.filter(x => x.kind === 'wire').forEach(x => (x.target || []).forEach(rule => { if(rule.bridge && !(st.bridges || []).includes(rule.bridge)) (st.bridges = st.bridges || []).push(rule.bridge); }));
    return r;
  }
  if(ev.type === 'wireRemove'){
    const n = ev.core ? st.wires.filter(w => w.from === ev.core || w.to === ev.core) : st.wires.filter(w => (w.from === ev.from && w.to === ev.to) || (w.from === ev.to && w.to === ev.from));
    n.forEach(w => Wi.removeWire(st, w.from, w.to));
    return { ok: n.length > 0, removed: n.length };
  }
  return { ok: true };
}

/* ---------- Anlage ---------- */
// Felder von SensorScene.setState (scene_sensor.js); alles optional, ausgelassene Felder behalten ihren letzten Wert
const PLANT_FIELDS = {
  beltRunning: 'bool – Förderband läuft', cylinder: 'Zahl 0…1 – Auswerferzylinder ausgefahren', feeder: 'bool – Vereinzeler schiebt',
  parts: 'Liste [{ x: 0…1.3 (Lage auf dem Band, m ab Bandanfang), material: "stahl"|"edelstahl"|"aluminium"|"messing"|"kunststoff_w"|"kunststoff_s"|"glas" }]',
  pump: 'Zahl 0…1 – Pumpendrehzahl', heater: 'bool – Heizstab', level: 'Zahl 0.001…0.6 – Wasserstand im Messtank in m', inflow: 'bool – Zulauf offen', reserveLevel: 'Zahl 0…0.4 – Vorrat (Schwimmer -B9) in m',
  doorOpen: 'bool – Schranktür (wird von der Ansicht gesteuert)', hoodOpen: 'bool – Schutzhaube',
  leds: '{ P1: bool|"blink", P2: … } – Leuchtmelder/LEDs nach BMK', hmi: '{ level: mm, pressure: mbar, temp: °C, flow: l/min } – Anzeigewerte am HMI oder null', aria: 'Text – Meldung am ARIA-Monitor', dist: '{ B1: mm, B2: mm } – Schaltabstände (Sichtbarmachung)'
};
const MATERIALS = ['stahl', 'edelstahl', 'aluminium', 'messing', 'kunststoff_w', 'kunststoff_s', 'glas'];
// Anlagenzustand aus der Auswertung: Bandlage der Werkstücke wie sensor_game.js (SENSOR_AT)
const SENSOR_AT = { B1: 0.29, B2: 0.44, B3: 0.59, 'B4.2': 0.74, B5: 1.11, N1: 0.2 };
function plant(task, ctx, opt){
  opt = opt || {};
  const live = opt.parts || {}, out = opt.outputs || {}, on = !!ctx.state.mainSwitch;
  return {
    beltRunning: on && !!out['Q0.0'], cylinder: on && out['Q0.2'] ? 1 : 0, feeder: on && !!out['Q0.1'],
    parts: Object.keys(live).filter(k => live[k]).map(k => ({ x: SENSOR_AT[k] || 0.5, material: live[k] })),
    pump: on && out['Q0.3'] ? 1 : 0, heater: on && !!out['Q0.5'], leds: { P1: on && !!out['Q0.6'], P2: on && !!out['Q0.7'] },
    aria: opt.aria || 'Ich sehe alles, was du verdrahtest …'
  };
}
const SCENES = { sortierstrecke: { view: 2, show: ['Sortierstrecke', 'Bedienpult'] }, tank: { view: 4, show: ['Tankstation'] } };   // Preset → Kameraansicht (SensorScene.setView) und sichtbare Anlagenteile

root.SensorVisual = { VERSION, netlist, state, help, apply, plant, terminalSpec, coreResults, EVENTS, PLANT_FIELDS, MATERIALS, SCENES, CORE_COLOR, ROLES, SHAPE };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorVisual;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== sensor_wiring_25d.js ==== */
(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — 2.5D-Verdrahtungsansicht (Paket W4, Vertrag docs/SENSOR_VISUAL_VERTRAG.md Abschnitt 2.4)
   Drei Zonen von links nach rechts: Sensor mit Kabel und freien Adern · Klemmleisten (-X1 Verteiler, -X2 Initiatorenklemmen mit
   drei Ebenen und Signal-LED, -X3 Trennklemmen) · CPU / Baugruppen (Frontansicht, herstellerneutral). Adern und Klemmstellen sind
   echte Schaltflächen (Ziehen, Antippen–Antippen, Tastatur, Touch ≥ 44 px); Kabel, Sensor-Illustrationen und Schatten liegen als
   SVG-Ebenen darunter/darüber. Zustände immer als Farbe UND Zeichen/Text (✓ ✗ ○ •). Kein eigener Wahrheitszustand: das Spiel ruft
   update(SensorVisual.state(…)) nach jedem Ereignis.

   const view = SensorWiring25D.mount(container, { netlist, state, options:{ lang:'de', reducedMotion:false, touch:false, colorAid:false } });
   view.update(state) · view.help(coreId?) · view.on/off(ev, fn) · view.select(coreId) · view.destroy()
   Ereignisse: wireStart(coreId) · wireDrop(coreId, terminalId) · wireRemove(coreId) · helpShow(coreId, terminalId) · meterProbe(terminalId, probeNr)
   ============================================================ */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SYM = { ok: '✓', falsch: '✗', fehlt: '○', gesetzt: '•' };
const TXT = { ok: 'richtig', falsch: 'falsch', fehlt: 'fehlt', gesetzt: 'gelegt' };
const DASH = { BN: '', BU: '10 6', BK: '3 5', WH: '14 5 3 5', '+': '', '-': '10 6', 'L+': '', M: '10 6', 'I+': '3 5', 'I-': '14 5 3 5' };   // Farbsehhilfe: Strichmuster je Ader
const MODULE_NAME = { A1: 'CPU 1214C DC/DC/DC', A2: 'SM 1231 AI 4', A3: 'SM 1232 AQ 2', A4: 'SM 1221 DI 8' };
const STRIP_NAME = { X1: '-X1 Verteiler L+ / M', X2: '-X2 Initiatorenklemmen', X3: '-X3 Trennklemmen 4–20 mA' };
const LEVEL_TITLE = { 'L+': 'Ebene L+ (24 V)', S: 'Ebene Signal', M: 'Ebene M (0 V)' };

/* ---------- Sensor-Illustrationen (SVG, herstellerneutral) ---------- */
function shapeSvg(p, led){
  const S = p.shape, lit = led ? '#ffd21e' : '#4a4a30', glow = led ? '<circle cx="66" cy="22" r="7" fill="#ffd21e" opacity=".35"/>' : '';
  const ring = '<rect x="4" y="30" width="20" height="60" rx="3" fill="#6b727a"/><rect x="4" y="34" width="20" height="4" fill="#3f454c"/><rect x="4" y="80" width="20" height="4" fill="#3f454c"/>';
  if(/induktiv|kapazitiv|zylinderschalter|ultraschall/.test(S)){
    const col = /kapazitiv/.test(S) ? '#d9b04a' : /ultraschall/.test(S) ? '#5aa9e6' : '#8f959c', face = /kapazitiv/.test(S) ? '#e7c766' : /ultraschall/.test(S) ? '#9fd0ff' : '#c9ced4';
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><defs><linearGradient id="g' + esc(p.id) + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs>'
      + '<ellipse cx="60" cy="108" rx="44" ry="6" fill="#000" opacity=".35"/><rect x="20" y="36" width="80" height="48" rx="6" fill="' + col + '"/><rect x="20" y="36" width="80" height="48" rx="6" fill="url(#g' + esc(p.id) + ')"/>'
      + [28, 40, 52, 64, 76, 88].map(x => '<rect x="' + x + '" y="38" width="3" height="44" fill="#000" opacity=".18"/>').join('')
      + '<rect x="8" y="46" width="14" height="28" rx="3" fill="' + face + '"/><rect x="100" y="42" width="14" height="36" rx="3" fill="#3a3f45"/>'
      + glow + '<circle cx="66" cy="22" r="4" fill="' + lit + '"/><text x="60" y="100" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  if(/lichttaster|lichtschranke|reflexlichtschranke/.test(S)){
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><ellipse cx="60" cy="108" rx="40" ry="6" fill="#000" opacity=".35"/><rect x="28" y="30" width="64" height="60" rx="8" fill="#2f5ba8"/><rect x="28" y="30" width="64" height="18" rx="8" fill="#3d6fc4"/>'
      + '<circle cx="46" cy="66" r="9" fill="#dfe9ff"/><circle cx="74" cy="66" r="9" fill="#ffb3b3"/><circle cx="46" cy="66" r="4" fill="#20304a"/><circle cx="74" cy="66" r="4" fill="#802020"/>'
      + glow + '<circle cx="66" cy="22" r="4" fill="' + lit + '"/><text x="60" y="104" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  if(/drucktransmitter|pt100|durchflussmesser/.test(S)){
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><ellipse cx="60" cy="110" rx="40" ry="6" fill="#000" opacity=".35"/><rect x="36" y="70" width="48" height="26" rx="4" fill="#8f959c"/><rect x="42" y="94" width="36" height="12" fill="#6b727a"/>'
      + '<rect x="24" y="24" width="72" height="48" rx="10" fill="#4a6b8a"/><rect x="24" y="24" width="72" height="14" rx="10" fill="#5e84a8"/><rect x="34" y="42" width="52" height="22" rx="3" fill="#0b1a26"/><text x="60" y="58" text-anchor="middle" font-size="12" fill="#9fdcff" font-family="ui-monospace,monospace">4–20 mA</text>'
      + '<text x="60" y="118" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  if(/taster|not_halt|wahlschalter|positionsschalter|schwimmer|potentiometer/.test(S)){
    const col = /rot|not_halt/.test(S) ? '#d63a3a' : /gruen/.test(S) ? '#39b54a' : '#c9ced4';
    return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><ellipse cx="60" cy="108" rx="40" ry="6" fill="#000" opacity=".35"/><rect x="24" y="44" width="72" height="50" rx="6" fill="#3a3f45"/><rect x="30" y="50" width="60" height="38" rx="4" fill="#20242a"/>'
      + '<circle cx="60" cy="44" r="26" fill="#2a2e33"/><circle cx="60" cy="42" r="20" fill="' + col + '"/><circle cx="60" cy="38" r="14" fill="#fff" opacity=".18"/>'
      + '<text x="60" y="106" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
  }
  return '<svg viewBox="0 0 120 120" class="sw25-shape" aria-hidden="true"><rect x="20" y="30" width="80" height="60" rx="8" fill="#6b727a"/>' + ring + '<text x="60" y="106" text-anchor="middle" font-size="11" fill="#9fb0c0" font-family="ui-monospace,monospace">' + esc(p.label) + '</text></svg>';
}

function mount(container, opt){
  opt = opt || {};
  const o = Object.assign({ lang: 'de', reducedMotion: false, touch: false, colorAid: false }, opt.options || {});
  if(o.reducedMotion == null && root.matchMedia) o.reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  injectCss();
  let nl = opt.netlist, st = opt.state || null, sel = null, helpPair = null, drag = null, raf = 0;
  const handlers = {};
  const emit = (ev, ...a) => (handlers[ev] || []).slice().forEach(f => { try { f(...a); } catch(e){ if(root.console) console.error(e); } });
  container.classList.add('sw25'); container.classList.toggle('sw25-coloraid', !!o.colorAid); container.classList.toggle('sw25-reduced', !!o.reducedMotion); container.classList.toggle('sw25-touch', !!o.touch);
  container.innerHTML = '<div class="sw25-msg" role="status" aria-live="polite"></div><div class="sw25-stage"><svg class="sw25-wires sw25-under" aria-hidden="true"></svg><div class="sw25-body"></div><svg class="sw25-wires sw25-over" aria-hidden="true"></svg></div>';
  const body = container.querySelector('.sw25-body'), msg = container.querySelector('.sw25-msg'), stage = container.querySelector('.sw25-stage');
  const under = container.querySelector('.sw25-under'), over = container.querySelector('.sw25-over');
  const say = t => { msg.textContent = t || ''; };
  const resultOf = core => (st && st.results && st.results[core]) || 'fehlt';
  const wireOf = core => st && st.wires ? st.wires.find(w => w.core === core) : null;
  const termSpec = id => nl.terminals.find(t => t.id === id);
  const partOf = core => nl.parts.find(p => p.id === core.split(':')[0]);
  const busyOf = id => st && st.wires ? st.wires.filter(w => w.b === id || w.a === id).length + (st.links || []).filter(l => l.a === id || l.b === id).length : 0;
  // wirksame Bedeutung: Klemmen mit liegender Ader/Leitung sind nie „ruhe“ (vorbefüllte Aufgaben ohne eigenen Verdrahtungsschritt)
  const relOfT = t => t.relevance !== 'ruhe' ? t.relevance : busyOf(t.id) ? 'nah' : 'ruhe';

  /* ---------- Aufbau ---------- */
  function partHtml(p){
    const led = st && st.sensorLeds && st.sensorLeds[p.id];
    const cores = p.cable.cores.map(c => {
      const r = resultOf(c.id), w = wireOf(c.id), pin = c.m12Pin ? ' · Pin ' + c.m12Pin : '';
      return '<button type="button" class="sw25-core r-' + r + (sel === c.id ? ' sel' : '') + '" draggable="true" data-core="' + esc(c.id) + '" data-pin="' + esc(c.pin) + '" data-result="' + r + '" aria-pressed="' + (sel === c.id) + '"'
        + ' aria-label="Ader ' + esc(c.pin) + ' (' + esc(c.color) + pin + ') von ' + esc(p.label) + (c.role ? ', ' + esc(c.role) : '') + ', ' + TXT[r] + (w ? ', liegt auf ' + esc(w.b) : '') + '" title="' + esc(c.color) + (c.role ? ' · ' + esc(c.role) : '') + ' – ziehen oder antippen">'
        + '<i class="sw25-chip" style="background:' + esc(c.hex) + '" aria-hidden="true"></i><span class="sw25-pin">' + esc(c.pin) + '</span><small>' + esc(c.color) + (c.role ? ' · ' + esc(c.role) : '') + '</small><b class="sw25-sym" aria-hidden="true">' + SYM[r] + '</b></button>';
    }).join('');
    return '<section class="sw25-part" data-part="' + esc(p.id) + '"><div class="sw25-sensor">' + shapeSvg(p, led) + '<div class="sw25-sensorled" data-lit="' + (led ? 1 : 0) + '" aria-hidden="true"></div></div>'
      + '<div class="sw25-cable"><div class="sw25-cabletrunk" data-conn="' + esc(p.cable.connector) + '"><span class="sw25-conn">' + (p.cable.connector === 'm12' ? 'M12' : 'Litze') + '</span></div><div class="sw25-cores">' + cores + '</div></div>'
      + '<h3><b>' + esc(p.label) + '</b> <span>' + esc(p.name) + '</span>' + (p.address ? ' <code>' + esc(p.address) + '</code>' : '') + '</h3></section>';
  }
  function termBtn(t){
    const lit = st && st.leds && st.leds[t.id], target = helpPair && (helpPair.terminal === t.id || helpPair.to === t.id || helpPair.from === t.id);
    const busy = st && st.wires ? st.wires.filter(w => w.b === t.id || w.a === t.id).length : 0;
    return '<button type="button" class="sw25-term rel-' + relOfT(t) + ' lv-' + esc((t.level || t.polarity || '').replace('+', 'P')) + (target ? ' pulse' : '') + '" data-terminal="' + esc(t.id) + '" data-lit="' + (lit ? 1 : 0) + '" data-busy="' + busy + '"'
      + ' aria-label="Klemme ' + esc(t.id) + (t.address ? ', Adresse ' + esc(t.address) : '') + (t.potential ? ', Potential ' + esc(t.potential) : '') + (lit ? ', Signal aktiv' : '') + '" title="' + esc(t.id) + (t.address ? ' · ' + esc(t.address) : '') + '">'
      + '<i class="sw25-hole" aria-hidden="true"></i><span class="sw25-tl">' + esc(t.label) + '</span>' + (t.address ? '<small class="sw25-addr">' + esc(t.address) + '</small>' : '') + (t.led ? '<b class="sw25-led" aria-hidden="true">' + (lit ? '●' : '○') + '</b>' : '') + '</button>';
  }
  function stripsHtml(){
    const byBlock = {};
    nl.terminals.filter(t => /^X\d$/.test(t.block)).forEach(t => { (byBlock[t.block] = byBlock[t.block] || {})[t.group] = (byBlock[t.block][t.group] || []).concat(t); });
    return ['X2', 'X3', 'X1'].filter(b => byBlock[b]).map(b => {
      const groups = byBlock[b], keys = Object.keys(groups).sort((x, y) => groups[x][0].row - groups[y][0].row);
      const order = b === 'X2' ? ['L+', 'S', 'M'] : b === 'X3' ? ['a', 'b'] : ['L+', 'M'];
      const relOf = ts => ts.some(t => relOfT(t) === 'ziel') ? 'ziel' : ts.some(t => relOfT(t) === 'nah') ? 'nah' : 'ruhe';
      const row = g => { const ts = groups[g]; return '<div class="sw25-tgroup rel-' + relOf(ts) + '" data-group="' + esc(g) + '"><span class="sw25-rowno">' + esc(String(ts[0].row)) + '</span>' + order.map(l => { const t = ts.find(x => x.level === l); return t ? termBtn(t) : ''; }).join('') + '</div>'; };
      const shown = keys.filter(g => relOf(groups[g]) !== 'ruhe'), rest = keys.filter(g => relOf(groups[g]) === 'ruhe');
      // Nie 60 gleiche Klemmen: unbeteiligte Zeilen eingeklappt („weitere Klemmen“), beim Ziehen aufgeklappt
      const more = rest.length ? '<details class="sw25-more"><summary>' + rest.length + ' weitere Klemmen' + (shown.length ? '' : ' (alle frei)') + '</summary><div class="sw25-rows">' + rest.map(row).join('') + '</div></details>' : '';
      return '<section class="sw25-strip sw25-strip-' + b + '" data-block="' + b + '"><h4>' + esc(STRIP_NAME[b] || b) + '</h4>' + (b === 'X2' ? '<div class="sw25-levels" aria-hidden="true"><span></span><span>L+</span><span>Signal</span><span>M</span></div>' : '') + '<div class="sw25-rows">' + shown.map(row).join('') + '</div>' + more + '</section>';
    }).join('');
  }
  function modulesHtml(){
    const mods = nl.modules.map(m => m.id);
    return mods.map(mid => {
      const ts = nl.terminals.filter(t => t.block === mid), groups = {};
      ts.forEach(t => { (groups[t.group] = groups[t.group] || []).push(t); });
      const gk = Object.keys(groups).sort((a, b) => (/DI/.test(b) ? 1 : 0) - (/DI/.test(a) ? 1 : 0) || a.localeCompare(b));
      const rel = ts.some(t => relOfT(t) === 'ziel') ? 'ziel' : ts.some(t => relOfT(t) === 'nah') ? 'nah' : 'ruhe';
      return '<section class="sw25-module rel-' + rel + '" data-module="' + mid + '"><div class="sw25-modhead"><b>-' + mid + '</b> ' + esc(MODULE_NAME[mid] || mid) + '<span class="sw25-modleds" aria-hidden="true"><i class="on"></i><i></i><i></i></span></div>'
        + (() => { const grp = g => '<div class="sw25-mgroup" data-group="' + esc(g) + '"><span class="sw25-gname">' + esc(g.split(':')[1] || g) + '</span><div class="sw25-mrow">' + groups[g].sort((a, b) => (a.address || a.label).localeCompare(b.address || b.label, 'de', { numeric: true })).map(termBtn).join('') + '</div></div>';
          const relG = g => groups[g].some(t => relOfT(t) === 'ziel') ? 'ziel' : groups[g].some(t => relOfT(t) === 'nah') ? 'nah' : 'ruhe';
          const shown = gk.filter(g => relG(g) !== 'ruhe'), rest = gk.filter(g => relG(g) === 'ruhe');
          return shown.map(grp).join('') + (rest.length ? '<details class="sw25-more"><summary>' + rest.reduce((n, g) => n + groups[g].length, 0) + ' weitere Klemmen</summary>' + rest.map(grp).join('') + '</details>' : ''); })() + '</section>';
    }).join('');
  }
  function render(){
    body.innerHTML = '<div class="sw25-zone sw25-zone-parts">' + nl.parts.map(partHtml).join('') + '</div>'
      + '<div class="sw25-zone sw25-zone-strips">' + stripsHtml() + '</div>'
      + '<div class="sw25-zone sw25-zone-modules">' + modulesHtml() + '</div>';
    body.querySelectorAll('.sw25-core').forEach(b => { if(helpPair && helpPair.core === b.dataset.core) b.classList.add('pulse'); });
    schedule();
  }

  /* ---------- Kabel zeichnen (SVG-Ebenen) ---------- */
  function rect(el){ const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top, cx: r.left + r.width / 2 - s.left, cy: r.top + r.height / 2 - s.top }; }
  // Anschlusspunkte und Kurve: liegt die Klemme rechts, geht die Ader waagrecht (S-Kurve); liegt sie darunter (Handy: eine Spalte), senkrecht
  function route(A, B){
    const a = rect(A), b = rect(B);
    if(b.l - a.r > 40){ const p = { x: a.r, y: a.cy }, q = { x: b.l + 10, y: b.cy }, dx = Math.max(40, (q.x - p.x) * 0.45); return { a: p, b: q, d: 'M' + p.x + ' ' + p.y + ' C' + (p.x + dx) + ' ' + p.y + ' ' + (q.x - dx) + ' ' + q.y + ' ' + q.x + ' ' + q.y }; }
    const p = { x: a.cx, y: a.b }, q = { x: b.l + 10, y: b.t }, dy = Math.max(30, (q.y - p.y) * 0.5);
    return { a: p, b: q, d: 'M' + p.x + ' ' + p.y + ' C' + p.x + ' ' + (p.y + dy) + ' ' + q.x + ' ' + (q.y - dy) + ' ' + q.x + ' ' + q.y };
  }
  function pos(el, side){ const r = rect(el); return { x: side === 'right' ? r.r : side === 'left' ? r.l : r.cx, y: r.cy }; }
  function path(a, b){ const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45); return 'M' + a.x + ' ' + a.y + ' C' + (a.x + dx) + ' ' + a.y + ' ' + (b.x - dx) + ' ' + b.y + ' ' + b.x + ' ' + b.y; }
  function draw(){
    const s = stage.getBoundingClientRect(); [under, over].forEach(svg => { svg.setAttribute('width', s.width); svg.setAttribute('height', s.height); svg.setAttribute('viewBox', '0 0 ' + s.width + ' ' + s.height); });
    let u = '', v = '';
    const coreEl = id => body.querySelector('[data-core="' + CSS.escape(id) + '"]'), termEl = id => body.querySelector('[data-terminal="' + CSS.escape(id) + '"]');
    // Leitungen zwischen Klemmen (vorgegeben) – unter den Schaltflächen, dunkelblau wie im Schrank
    (st && st.links || []).forEach(l => { const A = termEl(l.a), B = termEl(l.b); if(!A || !B || A.closest('details:not([open])') || B.closest('details:not([open])')) return; u += '<path d="' + route(A, B).d + '" class="sw25-link"/>'; });
    // Adern der Bauteile
    (st && st.wires || []).forEach(w => {
      if(!w.core) return; const A = coreEl(w.core), B = termEl(w.b); if(!A || !B) return;
      if(B.closest('details:not([open])')) B.closest('details').open = true;
      const c = (partOf(w.core) || { cable: { cores: [] } }).cable.cores.find(x => x.id === w.core) || {}, rt = route(A, B), a = rt.a, b = rt.b, d = rt.d, r = resultOf(w.core);
      u += '<path d="' + d + '" class="sw25-shadow"/>';
      v += '<path d="' + d + '" class="sw25-wire r-' + r + '" stroke="' + esc(c.hex || '#888') + '"' + (o.colorAid && DASH[c.pin] ? ' stroke-dasharray="' + DASH[c.pin] + '"' : '') + '/>'
        + (r === 'ok' || r === 'falsch' ? '<g class="sw25-mark r-' + r + '" transform="translate(' + (b.x - 14) + ' ' + (b.y - 14) + ')"><circle cx="0" cy="0" r="9"/><text x="0" y="4" text-anchor="middle">' + SYM[r] + '</text></g>' : '')
        + '<text class="sw25-wlabel" x="' + ((a.x + b.x) / 2) + '" y="' + ((a.y + b.y) / 2 - 6) + '" text-anchor="middle">' + esc(c.pin || '') + '</text>';
    });
    if(drag && drag.x != null){ const A = coreEl(drag.core); if(A){ const a = pos(A, 'right'); v += '<path d="' + path(a, { x: drag.x, y: drag.y }) + '" class="sw25-wire sw25-preview" stroke="' + esc(drag.hex) + '"/>'; } }
    under.innerHTML = u; over.innerHTML = v;
  }
  function schedule(){ if(raf) return; raf = (root.requestAnimationFrame || setTimeout)(() => { raf = 0; draw(); }); }
  const ro = root.ResizeObserver ? new ResizeObserver(schedule) : null; if(ro) ro.observe(stage);
  root.addEventListener('resize', schedule);

  /* ---------- Bedienung ---------- */
  function select(core){ sel = core || null; if(sel) emit('wireStart', sel); say(sel ? 'Ader ' + sel.split(':')[1] + ' gewählt – jetzt eine Klemmstelle antippen (Esc bricht ab).' : ''); render(); }
  function drop(core, term){ if(!core || !term) return; helpPair = null; emit('wireDrop', core, term); sel = null; say('Ader ' + core.split(':')[1] + ' auf ' + term + ' gelegt.'); render(); }
  function markAllowed(core){ body.querySelectorAll('details.sw25-more').forEach(d => { d.open = true; }); schedule(); const ok = new Set((nl.allowed[core] || [])); body.querySelectorAll('[data-terminal]').forEach(b => { b.classList.toggle('allowed', ok.has(b.dataset.terminal)); b.classList.toggle('dim', !ok.has(b.dataset.terminal)); }); container.classList.add('sw25-dragging'); }
  function clearAllowed(){ body.querySelectorAll('.allowed,.dim').forEach(b => b.classList.remove('allowed', 'dim')); container.classList.remove('sw25-dragging'); }
  body.addEventListener('click', e => {
    const c = e.target.closest('[data-core]'), t = e.target.closest('[data-terminal]');
    if(c){ select(sel === c.dataset.core ? null : c.dataset.core); return; }
    if(t){ if(sel) drop(sel, t.dataset.terminal); else emit('meterProbe', t.dataset.terminal, 1); }
  });
  body.addEventListener('keydown', e => {
    const c = e.target.closest && e.target.closest('[data-core]'), t = e.target.closest && e.target.closest('[data-terminal]');
    if((e.key === 'Delete' || e.key === 'Backspace') && c){ e.preventDefault(); emit('wireRemove', c.dataset.core); say('Ader ' + c.dataset.core.split(':')[1] + ' gelöst.'); return; }
    if(e.key === 'Escape'){ sel = null; clearAllowed(); render(); return; }
    if(/^Arrow/.test(e.key) && (c || t)){
      const list = [...body.querySelectorAll(c ? '[data-core]' : '[data-terminal]')], i = list.indexOf(e.target), d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const n = list[(i + d + list.length) % list.length]; if(n){ e.preventDefault(); n.focus(); }
    }
  });
  // HTML5 Drag & Drop (Maus)
  body.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-core]'); if(!c) return; sel = c.dataset.core; e.dataTransfer.setData('text/plain', 'core:' + sel); e.dataTransfer.effectAllowed = 'move'; emit('wireStart', sel); markAllowed(sel); });
  body.addEventListener('dragend', () => { clearAllowed(); drag = null; schedule(); });
  body.addEventListener('dragover', e => { const t = e.target.closest && e.target.closest('[data-terminal]'); if(t){ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; body.querySelectorAll('.over').forEach(x => x.classList.remove('over')); t.classList.add('over'); } });
  body.addEventListener('drop', e => { const t = e.target.closest && e.target.closest('[data-terminal]'); if(!t) return; e.preventDefault(); const d = (e.dataTransfer.getData('text/plain') || '').replace(/^core:/, ''); clearAllowed(); drop(d || sel, t.dataset.terminal); });
  // Zeiger-Ziehen (Touch/Stift): Vorschau-Ader folgt dem Finger, Loslassen über einer Klemmstelle legt auf
  body.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse') return; const c = e.target.closest && e.target.closest('[data-core]'); if(!c) return;
    const core = c.dataset.core, cc = (partOf(core) || { cable: { cores: [] } }).cable.cores.find(x => x.id === core) || {};
    drag = { core, hex: cc.hex || '#888', x: null, y: null, id: e.pointerId, moved: false }; c.setPointerCapture && c.setPointerCapture(e.pointerId);
  });
  body.addEventListener('pointermove', e => { if(!drag || e.pointerId !== drag.id) return; const s = stage.getBoundingClientRect(); drag.x = e.clientX - s.left; drag.y = e.clientY - s.top; if(!drag.moved){ drag.moved = true; sel = drag.core; emit('wireStart', sel); markAllowed(sel); } e.preventDefault(); schedule(); });
  body.addEventListener('pointerup', e => { if(!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; clearAllowed(); if(!d.moved){ schedule(); return; } const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest('[data-terminal]'); if(t) drop(d.core, t.dataset.terminal); else { sel = null; render(); } });
  body.addEventListener('pointercancel', () => { drag = null; clearAllowed(); schedule(); });

  render();
  const api = {
    update(s){ st = s; render(); },
    help(coreId){
      const h = st && st.help;
      helpPair = coreId ? { core: coreId, terminal: (nl.targets.find(p => p.a === coreId || p.b === coreId) || {}).b } : h;
      if(helpPair){ emit('helpShow', helpPair.core, helpPair.terminal); say(h && h.text ? h.text : 'Zielklemme markiert.'); }
      render();
      const t = helpPair && body.querySelector('[data-terminal="' + CSS.escape(helpPair.terminal || helpPair.to || '') + '"]'); if(t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: o.reducedMotion ? 'auto' : 'smooth' });
    },
    on(ev, fn){ (handlers[ev] = handlers[ev] || []).push(fn); return api; },
    off(ev, fn){ handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); return api; },
    select(core){ sel = core || null; render(); },
    get selected(){ return sel; },
    destroy(){ if(ro) ro.disconnect(); root.removeEventListener('resize', schedule); container.innerHTML = ''; container.classList.remove('sw25', 'sw25-coloraid', 'sw25-reduced', 'sw25-touch', 'sw25-dragging'); Object.keys(handlers).forEach(k => delete handlers[k]); }
  };
  return api;
}

const STYLE = `
.sw25{ --sw-bg:#0f151c; --sw-panel:#151d26; --sw-line:#2a3a4c; --sw-txt:#e6eef6; --sw-dim:#9fb0c0; --sw-lp:#d64545; --sw-m:#3b7fd6; --sw-sig:#ffd21e; --sw-ok:#39ff7a; --sw-bad:#ff4d7d; --sw-acc:#39ff14; color:var(--sw-txt); font:14px/1.35 Inter,system-ui,sans-serif; min-width:0; }
.sw25 *{ box-sizing:border-box; }
.sw25-msg{ min-height:20px; margin:0 0 6px; font-size:13px; color:var(--sw-dim); }
.sw25-stage{ position:relative; }
.sw25-wires{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; } .sw25-over{ z-index:3; } .sw25-under{ z-index:0; }
.sw25-body{ position:relative; z-index:1; display:grid; grid-template-columns:minmax(240px,1.15fr) minmax(220px,1.35fr) minmax(170px,.9fr); gap:18px; align-items:start; }
.sw25-zone{ display:flex; flex-direction:column; gap:12px; min-width:0; }
/* Sensor mit Kabel */
.sw25-part{ background:var(--sw-panel); border:1px solid var(--sw-line); border-radius:12px; padding:10px; display:grid; grid-template-columns:84px 1fr; grid-template-areas:"sensor cable" "title title"; gap:6px 10px; box-shadow:0 6px 18px rgba(0,0,0,.35); }
.sw25-sensor{ grid-area:sensor; position:relative; } .sw25-shape{ width:84px; height:84px; display:block; }
.sw25-sensorled{ position:absolute; right:8px; top:6px; width:12px; height:12px; border-radius:50%; background:#4a4a30; border:1px solid #000; } .sw25-sensorled[data-lit="1"]{ background:var(--sw-sig); box-shadow:0 0 10px var(--sw-sig); }
.sw25-cable{ grid-area:cable; display:flex; align-items:stretch; gap:6px; min-width:0; }
.sw25-cabletrunk{ width:20px; border-radius:8px; background:linear-gradient(90deg,#1a1d22,#3a3f45 45%,#1a1d22); position:relative; flex:none; }
.sw25-cabletrunk .sw25-conn{ position:absolute; left:50%; top:4px; transform:translateX(-50%); font:700 9px ui-monospace,monospace; color:#9fb0c0; background:#0b0e12; padding:1px 3px; border-radius:3px; }
.sw25-cores{ display:flex; flex-direction:column; gap:6px; flex:1; min-width:0; }
.sw25-core{ display:flex; align-items:center; gap:6px; min-height:44px; padding:4px 8px; min-width:0; border-radius:22px; border:2px solid var(--sw-line); background:#0d1218; color:var(--sw-txt); font:inherit; cursor:grab; text-align:left; transition:transform .12s ease, box-shadow .12s ease; }
.sw25-core:active{ cursor:grabbing; } .sw25-core:hover{ box-shadow:0 0 0 2px rgba(255,255,255,.08); } .sw25-core:focus-visible, .sw25-term:focus-visible{ outline:3px solid #58c4ff; outline-offset:2px; }
.sw25-core.sel{ border-color:var(--sw-acc); box-shadow:0 0 14px rgba(57,255,20,.35); }
.sw25-core.r-ok{ border-color:var(--sw-ok); } .sw25-core.r-falsch{ border-color:var(--sw-bad); } .sw25-core.r-fehlt{ border-style:dashed; }
.sw25-chip{ width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,.5); flex:none; }
.sw25-pin{ font:700 14px ui-monospace,monospace; letter-spacing:.04em; } .sw25-core small{ color:var(--sw-dim); font-size:11px; line-height:1.15; flex:1; min-width:0; }
.sw25-sym{ font-size:16px; width:20px; text-align:center; flex:none; } .r-ok .sw25-sym{ color:var(--sw-ok); } .r-falsch .sw25-sym{ color:var(--sw-bad); } .r-fehlt .sw25-sym{ color:var(--sw-dim); }
.sw25-part h3{ grid-area:title; margin:2px 0 0; font-size:13px; font-weight:400; color:var(--sw-dim); } .sw25-part h3 b{ color:var(--sw-txt); font-size:14px; } .sw25-part h3 code{ color:#9fdcff; }
/* Klemmleisten */
.sw25-strip{ background:linear-gradient(180deg,#242a31,#1a1f26); border:1px solid var(--sw-line); border-radius:10px; padding:8px 10px 10px; box-shadow:0 6px 18px rgba(0,0,0,.35); }
.sw25-strip h4, .sw25-modhead{ margin:0 0 6px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--sw-dim); }
.sw25-levels{ display:grid; grid-template-columns:22px repeat(3,1fr); gap:4px; font-size:11px; color:var(--sw-dim); margin-bottom:2px; padding:0 3px; } .sw25-levels span{ text-align:center; }
.sw25-rows{ display:flex; flex-direction:column; gap:4px; }
.sw25-tgroup{ display:grid; grid-template-columns:22px repeat(3,1fr); gap:4px; align-items:stretch; padding:3px; border-radius:8px; background:#8f959c; }
.sw25-strip-X1 .sw25-tgroup, .sw25-strip-X3 .sw25-tgroup{ grid-template-columns:22px repeat(2,1fr); }
.sw25-tgroup.rel-ruhe{ opacity:.45; } .sw25-dragging .sw25-tgroup.rel-ruhe{ opacity:.7; }
.sw25-rowno{ align-self:center; text-align:center; font:700 12px ui-monospace,monospace; color:#111; }
.sw25-term{ position:relative; display:flex; align-items:center; gap:6px; min-height:44px; min-width:44px; padding:4px 6px 4px 22px; border-radius:6px; border:1px solid #5b6168; background:#c9ced4; color:#111; font:700 12px ui-monospace,monospace; cursor:pointer; transition:box-shadow .12s ease, transform .12s ease; }
.sw25-term .sw25-hole{ position:absolute; left:6px; top:50%; width:10px; height:12px; margin-top:-6px; border-radius:2px; background:#2b2f34; box-shadow:inset 0 0 0 2px #7d8790, inset 0 -3px 0 #d8b24a; }
.sw25-term[data-busy="1"] .sw25-hole, .sw25-term[data-busy="2"] .sw25-hole{ box-shadow:inset 0 0 0 2px #7d8790, inset 0 -3px 0 #d8b24a, 0 0 0 2px #444; background:#1a1d22; }
.sw25-term.lv-LP{ border-top:4px solid var(--sw-lp); } .sw25-term.lv-M{ border-top:4px solid var(--sw-m); } .sw25-term.lv-S{ border-top:4px solid #e8e2c6; background:#e2e5e9; }
.sw25-term.lv-a, .sw25-term.lv-b{ border-top:4px solid #8e44ad; }
.sw25-tl{ flex:1; } .sw25-addr{ font-weight:400; font-size:11px; color:#334; } .sw25-led{ font-size:14px; color:#7a6a20; } .sw25-term[data-lit="1"] .sw25-led{ color:#e0a800; text-shadow:0 0 8px var(--sw-sig); }
.sw25-term.allowed{ box-shadow:0 0 0 3px var(--sw-acc), 0 0 14px rgba(57,255,20,.5); } .sw25-term.dim{ opacity:.35; } .sw25-term.over{ transform:scale(1.06); }
.sw25-term.rel-ziel{ } .sw25-term:hover{ box-shadow:0 0 0 2px #58c4ff; }
/* Baugruppen */
.sw25-module{ background:linear-gradient(180deg,#e9ecef,#cfd4d9); color:#111; border:1px solid #9aa3ab; border-radius:8px; padding:8px 10px 10px; box-shadow:0 6px 18px rgba(0,0,0,.35); }
.sw25-modhead{ color:#223; display:flex; align-items:center; gap:6px; text-transform:none; letter-spacing:0; font-size:12px; } .sw25-modhead b{ font-size:13px; }
.sw25-modleds{ margin-left:auto; display:flex; gap:4px; } .sw25-modleds i{ width:8px; height:8px; border-radius:50%; background:#8a9098; display:inline-block; } .sw25-modleds i.on{ background:#39b54a; box-shadow:0 0 6px #39b54a; }
.sw25-mgroup{ margin-top:6px; } .sw25-gname{ font:700 11px ui-monospace,monospace; color:#334; display:block; margin-bottom:2px; }
.sw25-mrow{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; padding:4px; border-radius:6px; background:#8f959c; }
.sw25-module.rel-ruhe{ opacity:.55; } .sw25-dragging .sw25-module.rel-ruhe{ opacity:.85; }
.sw25-module .sw25-term{ min-width:0; padding-right:4px; }
.sw25-more{ margin-top:6px; } .sw25-more summary{ cursor:pointer; font-size:12px; color:var(--sw-dim); padding:6px 4px; min-height:32px; } .sw25-more[open] summary{ margin-bottom:4px; }
/* Kabel */
.sw25-shadow{ fill:none; stroke:#000; stroke-width:9; stroke-opacity:.45; stroke-linecap:round; transform:translate(2px,4px); }
.sw25-wire{ fill:none; stroke-width:5; stroke-linecap:round; } .sw25-wire.r-falsch{ filter:drop-shadow(0 0 4px var(--sw-bad)); } .sw25-wire.r-ok{ filter:drop-shadow(0 0 3px rgba(57,255,122,.5)); }
.sw25-preview{ stroke-dasharray:8 6; opacity:.85; }
.sw25-link{ fill:none; stroke:#1f3a93; stroke-width:4; stroke-linecap:round; opacity:.75; }
.sw25-wlabel{ font:700 11px ui-monospace,monospace; fill:#fff; paint-order:stroke; stroke:#000; stroke-width:3px; }
.sw25-mark circle{ fill:#0d1218; stroke-width:2; } .sw25-mark text{ font:700 12px ui-monospace,monospace; } .sw25-mark.r-ok circle{ stroke:var(--sw-ok); } .sw25-mark.r-ok text{ fill:var(--sw-ok); } .sw25-mark.r-falsch circle{ stroke:var(--sw-bad); } .sw25-mark.r-falsch text{ fill:var(--sw-bad); }
/* Zeig mir */
.sw25 .pulse{ animation:sw25pulse 1.1s ease-in-out infinite; box-shadow:0 0 0 3px var(--sw-sig), 0 0 18px var(--sw-sig); z-index:2; }
@keyframes sw25pulse{ 0%,100%{ box-shadow:0 0 0 3px var(--sw-sig), 0 0 10px var(--sw-sig); } 50%{ box-shadow:0 0 0 6px var(--sw-sig), 0 0 26px var(--sw-sig); } }
.sw25-reduced .pulse, .sw25-reduced .sw25-core, .sw25-reduced .sw25-term{ animation:none !important; transition:none !important; }
@media (prefers-reduced-motion: reduce){ .sw25 .pulse{ animation:none; } }
/* Farbsehhilfe: Ebenen zusätzlich beschriftet, Chips mit Muster */
.sw25-coloraid .sw25-term.lv-LP::after{ content:"+"; position:absolute; right:4px; top:0; font-size:11px; color:var(--sw-lp); } .sw25-coloraid .sw25-term.lv-M::after{ content:"−"; position:absolute; right:4px; top:0; font-size:11px; color:var(--sw-m); }
.sw25-coloraid .sw25-core[data-pin="BU"] .sw25-chip{ background-image:repeating-linear-gradient(45deg,transparent 0 3px,rgba(255,255,255,.7) 3px 5px); } .sw25-coloraid .sw25-core[data-pin="BK"] .sw25-chip{ background-image:radial-gradient(circle,rgba(255,255,255,.8) 2px,transparent 2.5px); }
/* Handy */
@media (max-width:760px){ .sw25-body{ grid-template-columns:1fr; gap:12px; } .sw25-part{ grid-template-columns:72px 1fr; } .sw25-shape{ width:72px; height:72px; } .sw25-term{ min-height:44px; } }
`;
function injectCss(){ if(typeof document === 'undefined' || document.getElementById('sw25Css')) return; const s = document.createElement('style'); s.id = 'sw25Css'; s.textContent = STYLE; document.head.appendChild(s); }
root.SensorWiring25D = { mount, CSS: STYLE, version: 1 };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorWiring25D;
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

// Freie Hilfsmerker (Auftrag „Funktion zählt“): jeder Weg ist erlaubt – auch einer mit eigenem Zwischenergebnis.
// Sie stehen in jeder Grundstufen-Aufgabe in der PLC-Variablentabelle (%M99.x, %MW196/198) und werden nie geprüft.
const HELPERS = { Hilf_1:false, Hilf_2:false, Hilf_3:false, Hilf_4:false, Hilfswert_1:0, Hilfswert_2:0 };
root.HELPER_VARS = Object.keys(HELPERS);
root.defTask = function(o){
  const vars = Object.assign({}, o.vars || {});
  Object.keys(HELPERS).forEach(k => { if(!(k in vars) && o.helpers !== false) vars[k] = HELPERS[k]; });
  const t = {
    id: o.id, level: o.ch, title: o.title, story: o.story, briefing: o.brief,
    learn: o.learn || '', takeaway: o.take || '',
    isDebug: !!o.debug, isBoss: !!o.boss,
    starterCode: o.start || '',
    initialVars: vars, varTypes: o.types || {}, fbTypes: o.fb || {},
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
  // Auftrag „Funktion zählt“: bewertet wird nur die Funktion (Hand-Tests + aus der Musterlösung erzeugte Tests, equiv.js).
  // missing (Bausteine der Musterlösung) und warnHits (Programmierstandard) sind nur noch Lernhinweise.
  autoTests(t){
    if(t.autoTests === undefined){ try{ t.autoTests = root.SPSQEquiv ? root.SPSQEquiv.autoTestsPro(t, root.SCLPro, c => this.compile(t, c)) : null; }catch(e){ t.autoTests = null; } }
    return t.autoTests;
  },
  evaluate(t, codes, opts){
    const prog = this.compile(t, codes);
    const res = root.SCLPro.runAll(prog, { unit: t.unit, tests: t.tests, timed: t.timed }, opts);
    let auto = null;
    if(res.ok && !(opts && opts.noAuto)){ const a = this.autoTests(t); if(a) auto = root.SCLPro.runAll(prog, a, opts); }
    const used = root.SCLPro.constructsUsed(prog, this.editable(t));
    const missing = t.mustUse.filter(m => !used.has(m));
    const warnHits = prog.warnings.filter(w => t.warnFree.includes(w.code));
    return { prog, res, auto, used, missing, warnHits, ok: res.ok && (!auto || auto.ok) };
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

/* ==== content_sensor/_sensor.js ==== */
/* ===== SENSORWERKSTATT: Presets (Ausgangszustände) und Klemmenplan-Helfer =====
   Klemmenplan (docs/SENSORWERKSTATT_PLAN.md 2.4): -X2:1 S1 · 2 S2 · 3 S3 · 4 S4 · 5 B1 · 6 B2 · 7 B3 · 8 B4.2 · 9 B5 · 10 B6 · 11 B7 · 12 S5 · 13 B8 · 14 B9 · 21…28 SM 1221
   Signalebene -X2:n.S ist zur CPU vorverdrahtet (Plan 3.1 Ebene C, Punkt 6), 1M liegt auf M (PNP). */
(function(root){
const W = root.Wiring;
const X2_OF = { S1: 1, S2: 2, S3: 3, S4: 4, B1: 5, B2: 6, B3: 7, 'B4.2': 8, B5: 9, B6: 10, B7: 11, S5: 12, B8: 13, B9: 14 };
// 3-Leiter-Sensor auf Initiatorenklemme n: BN → L+, BU → M, BK → Signal
const w3 = (p, n) => [[p + ':BN', 'X2:' + n + '.L+'], [p + ':BU', 'X2:' + n + '.M'], [p + ':BK', 'X2:' + n + '.S']];
// Kontakt (Taster, Positionsschalter, Reed) auf Klemme n: erster Pin → L+, zweiter Pin → Signal
const c2 = (p, n) => { const P = W.PARTS[p]; return [[p + ':' + P.pins[0], 'X2:' + n + '.L+'], [p + ':' + P.pins[1], 'X2:' + n + '.S']]; };
const field = p => { const P = W.PARTS[p]; return P.type === 'contact2' ? c2(p, X2_OF[p]) : p === 'B4.1' ? [['B4.1:BN', 'X1:L+3'], ['B4.1:BU', 'X1:M3']] : w3(p, X2_OF[p]); };
// Funktionsanforderungen für Wiring.check (Plan 3.5): Sensor versorgt und Signal am richtigen Eingang
const need3 = p => [{ net: [p + ':BN', 'POT:L+'] }, { net: [p + ':BU', 'POT:M'] }, { net: [p + ':BK', 'DI:' + W.PARTS[p].di] }];
const needC = p => { const P = W.PARTS[p]; return [{ net: [p + ':' + P.pins[0], 'POT:L+'] }, { net: [p + ':' + P.pins[1], 'DI:' + P.di] }]; };
const need = p => W.PARTS[p].type === 'contact2' ? needC(p) : p === 'B4.1' ? [{ net: ['B4.1:BN', 'POT:L+'] }, { net: ['B4.1:BU', 'POT:M'] }] : need3(p);
// Vorverdrahtung im Schrank: Signalebene -X2:1…14 → CPU, -X2:21…28 → SM 1221
const PRE_CPU = Object.keys(W.DI_OF_X2).map(Number).filter(n => n <= 14).map(n => ['X2:' + n + '.S', W.diTerminal(W.DI_OF_X2[n])]);
const PRE_SM = [21, 22, 23, 24, 25, 26, 27, 28].map(n => ['X2:' + n + '.S', W.diTerminal(W.DI_OF_X2[n])]);
root.SW = { X2_OF, w3, c2, field, need3, needC, need, PRE_CPU, PRE_SM };

// Schrank vorverdrahtet, Feld leer: Querbrücker gesteckt, 1M auf M, Signalebenen zur CPU
defPreset('schrank', { wires: PRE_CPU.concat([['A1:1M', 'X1:M2']]), bridges: ['QB_X2_LP', 'QB_X2_M'] });
// wie oben, aber ohne Querbrücker (Modul 1 Boss, Modul 2)
defPreset('schrank_ohne_qb', { wires: PRE_CPU.concat([['A1:1M', 'X1:M2']]) });
// Sortierstrecke fertig verdrahtet und montiert (Programmieraufgaben)
const SORT = ['S1', 'S2', 'S3', 'S4', 'B1', 'B2', 'B3', 'B4.1', 'B4.2', 'B5', 'B6', 'B7', 'S5'];
defPreset('sortier_fertig', { base: 'schrank', mainSwitch: true, wires: [].concat(...SORT.map(field)),
  mounts: { B1: { dist: 4, tight: true }, B2: { dist: 4, tight: true, poti: 0.6 }, B3: { dist: 60, tight: true, teach: 60 }, B6: { dist: 5, tight: true }, B7: { dist: 35, tight: true } } });
// SM 1221 vorbereitet: Signalebenen 21…28 zur SM 1221, 1M/2M auf M
defPreset('sm1221', { base: 'schrank', wires: PRE_SM.concat([['A4:1M', 'X1:M4'], ['A4:2M', 'X1:M5']]) });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/chapters.js ==== */
/* ===== SENSORWERKSTATT: Module (Kapitel) ===== */
(function(){
const A = inner => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
// kleines Klemmenbild: Sensor, M12-Leitung, Initiatorenklemme mit gelber LED
const term = (label, led) => '<rect x="20" y="60" width="60" height="40" rx="6" fill="#2b3138" stroke="#8aa0b4"/><circle cx="72" cy="70" r="4" fill="#ffc400"/>'
  + '<path d="M80 80 C130 80 130 40 180 40" stroke="#8b5a2b" stroke-width="4" fill="none"/><path d="M80 84 C130 84 130 80 180 80" stroke="#222" stroke-width="4" fill="none"/><path d="M80 88 C130 88 130 120 180 120" stroke="#2f6fd0" stroke-width="4" fill="none"/>'
  + '<rect x="180" y="24" width="40" height="112" rx="4" fill="#8f959c"/>' + ['L+', 'S', 'M'].map((t, i) => '<text x="200" y="' + (44 + i * 40) + '" text-anchor="middle" font-size="12" fill="#111">' + t + '</text>').join('')
  + '<circle cx="240" cy="80" r="7" fill="' + (led ? '#ffd21e' : '#3a3320') + '"><animate attributeName="opacity" values="1;.4;1" dur="1.4s" repeatCount="indefinite"/></circle>'
  + '<text x="150" y="152" text-anchor="middle" font-size="10" fill="#ffb000">' + label + '</text>';
defChapter({ n:1, title:'Signale und digitale Sensoren', subtitle:'24 V · M12 · Schliesser/Öffner', icon:'fa-plug',
  intro:'Im Untergeschoss steht der <b>Prüfstand</b> der Werkstatt: eine Sortierstrecke, eine Tankstation und ein Schaltschrank mit einer S7-1200. ARIA hat alle Sensoren abgeklemmt. Der Werkmeister zeigt auf die Klemmleiste: <i>„Anschliessen lernt man mit den Händen. Zuerst: Was liefert ein Sensor überhaupt?“</i>',
  anim: A(term('SENSOR → KLEMME → EINGANG', true)) });
defChapter({ n:2, title:'PNP und NPN', subtitle:'Plus- und minusschaltend · 1M', icon:'fa-right-left',
  intro:'Ein Ersatzsensor aus dem Lager — und der Eingang bleibt dunkel, obwohl die Sensor-LED leuchtet. <i>„Plus- oder minusschaltend, das ist hier die Frage“</i>, brummt der Werkmeister. Zeit, den Stromfluss zu verstehen.',
  anim: A(term('PNP: SIGNAL = +24 V', true)) });
defChapter({ n:3, title:'Sensortypen im Einsatz', subtitle:'Induktiv · kapazitiv · optisch · magnetisch', icon:'fa-eye',
  intro:'Stahl, Aluminium, Kunststoff, Glas — die Sortierstrecke soll alles auseinanderhalten. ARIA hat die Sensoren verstellt. Jetzt zählt, wie weit ein Sensor wirklich schaut und worauf er reagiert.',
  anim: A(term('SCHALTABSTAND × MATERIAL', false)) });
})();

/* ==== content_sensor/m1.js ==== */
/* ===== SENSORWERKSTATT Modul 1: Signale und digitale Sensoren anschliessen ===== */
(function(root){
const { w3, c2, field, need, PRE_SM } = root.SW;
const SORT_TAGS = [{ name: 'Start', type: 'Bool', addr: '%I0.0' }, { name: 'Stopp', type: 'Bool', addr: '%I0.1' }, { name: 'Ind_Metall', type: 'Bool', addr: '%I0.4' },
  { name: 'Rutsche_Voll', type: 'Bool', addr: '%I1.0' }, { name: 'Haube_Zu', type: 'Bool', addr: '%I1.3' }, { name: 'Band', type: 'Bool', addr: '%Q0.0' }];

defWorkshopTask({ id: 'w1_datenblatt', module: 1, no: 1, level: 'schnell', title: 'Typenschild lesen',
  story: 'Der Werkmeister legt dir einen Sensor in die Hand: <i>„Bevor du etwas anschliesst, liest du das Typenschild. Immer.“</i>',
  brief: '<p>Auf dem Typenschild von <b>-B1</b> steht: <code>IND M18 · 10–30 V DC · PNP NO · Sn 8 mm · bündig · IP67 · M12</code>.</p><p>Beantworte die Fragen in den Arbeitsschritten. Die Detailkarte (Klick auf -B1) zeigt zusätzlich die M12-Belegung.</p>',
  learn: 'Die wichtigsten Angaben eines Sensor-Typenschilds deuten.', take: 'Versorgung, Schaltausgang (PNP/NPN, NO/NC), Schaltabstand und Einbauart stehen auf dem Typenschild — das ist die erste Station jeder Inbetriebnahme.',
  man: 'sensoren', theory: 'st1a', hint: 'PNP heisst plusschaltend: Der Ausgang schaltet +24 V auf die schwarze Ader.', hint2: '„bündig“ bedeutet: Der Sensor darf bündig in Metall eingebaut werden.',
  parts: ['B1'], modules: ['A1'], x2: [5],
  steps: [
    { kind: 'quiz', text: 'Mit welcher Spannung wird -B1 versorgt?', options: ['10–30 V DC', '230 V AC', '5 V DC', '0–10 V'], correct: 0 },
    { kind: 'quiz', text: 'Was liefert der Ausgang im geschalteten Zustand (PNP NO, Teil erkannt)?', options: ['+24 V auf der schwarzen Ader (BK)', '0 V auf der schwarzen Ader', 'Einen Strom von 4–20 mA', 'Nichts – NO heisst „kein Ausgang“'], correct: 0 },
    { kind: 'quiz', text: 'Nennschaltabstand Sn laut Typenschild (mm)?', answer: 8, tol: 0, unit: 'mm' },
    { kind: 'quiz', text: 'Was bedeutet „bündig“?', options: ['Der Sensor darf bündig in Metall eingebaut werden', 'Der Sensor erkennt nur bündig anliegende Teile', 'Der Sensor hat keinen Stecker', 'Der Sensor ist wasserdicht'], correct: 0 },
    { kind: 'quiz', text: 'Welche Ader führt bei einem 3-Leiter-Sensor das Schaltsignal?', options: ['BK (schwarz, Pin 4)', 'BN (braun, Pin 1)', 'BU (blau, Pin 3)', 'WH (weiss, Pin 2)'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_b1_anschliessen', module: 1, no: 2, level: 'schnell', title: 'Der erste Sensor',
  story: 'ARIA hat -B1 abgeschraubt und die Leitung abgezogen. Die Sortierstrecke erkennt kein Metall mehr.',
  brief: '<p>Bringe den induktiven Sensor <b>-B1</b> wieder in Betrieb:</p><ol><li>Mit dem <b>Gabelschlüssel</b> die Kontermuttern lösen, Abstand <b>4 mm</b> einstellen, festziehen.</li><li>M12-Leitung anstecken und die Rändelmutter festziehen.</li><li>Adern auf die Initiatorenklemme <b>-X2:5</b> legen: BN → L+, BU → M, BK → Signal.</li><li>-Q0 einschalten und ein Stahlteil vorbeiführen (Anlage bedienen): Die LEDs am Sensor, an -X2:5 und am Eingang %I0.4 leuchten.</li></ol>',
  learn: 'Einen 3-Leiter-Sensor richtig auf eine Initiatorenklemme auflegen.', take: 'BN = L+, BU = M, BK = Signal. Drei LEDs zeigen den Weg: Sensor → Klemme → Eingang.',
  man: 'm12', theory: 'st1a', hint: 'Die Ader-Enden liegen links am Sensor. Zieh sie auf die passenden Klemmen von -X2:5.', hint2: 'Auf der Klemmleiste: Ader BN antippen, dann -X2:5 L+ antippen. Genauso BU → M und BK → Signal.',
  parts: ['B1'], modules: ['A1'], x2: [4, 5, 6], start: { base: 'schrank', plugs: { B1: false }, mounts: { B1: { dist: 9, tight: false } } },
  steps: [
    { kind: 'mount', text: '-B1 auf 4 mm einstellen und festziehen', part: 'B1', dist: [4, 0.5] },
    { kind: 'plug', text: 'M12-Leitung von -B1 anstecken und festziehen', parts: ['B1'] },
    { kind: 'wire', text: 'Adern von -B1 auf -X2:5 auflegen', target: need('B1'), ref: { add: w3('B1', 5) },
      wrong: [{ add: [['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:6.S']] }, { add: [['B1:BN', 'X2:5.M'], ['B1:BU', 'X2:5.L+'], ['B1:BK', 'X2:5.S']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Stahlteil vor -B1: %I0.4 = 1, ohne Teil: 0', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] }
  ] });

defWorkshopTask({ id: 'w1_start_stopp', module: 1, no: 3, level: 'schnell', title: 'Schliesser und Öffner',
  story: 'Am Bedienpult fehlen die Adern von Start und Stopp. Der Werkmeister: <i>„Stopp ist ein Öffner. Überleg dir, was der Eingang in Ruhe zeigt.“</i>',
  brief: '<p>Schliesse <b>-S1 Start</b> (Schliesser, Kontakte 13/14) an <b>-X2:1</b> und <b>-S2 Stopp</b> (Öffner, Kontakte 11/12) an <b>-X2:2</b> an: erster Kontakt auf L+, zweiter auf Signal.</p><p>Beobachte die Eingänge %I0.0 und %I0.1 in Ruhe und beim Drücken.</p>',
  learn: 'Schliesser und Öffner anschliessen und ihren Ruhezustand am Eingang erkennen.', take: 'Ein Öffner liefert in Ruhe 1. Drahtbruch sieht aus wie „Taster gedrückt“ — deshalb sind Stopp und Not-Halt Öffner.',
  man: 'nonc', theory: 'st1a', hint: 'Kontakt 13 (bzw. 11) kommt auf die L+-Ebene, 14 (bzw. 12) auf die Signalebene.', hint2: 'Stopp in Ruhe: Kontakt geschlossen → 24 V am Eingang → %I0.1 = 1.',
  parts: ['S1', 'S2'], modules: ['A1'], x2: [1, 2, 3], start: 'preset:schrank',
  steps: [
    { kind: 'wire', text: '-S1 auf -X2:1 und -S2 auf -X2:2 auflegen', target: need('S1').concat(need('S2')), ref: { add: c2('S1', 1).concat(c2('S2', 2)) },
      wrong: [{ add: c2('S1', 2).concat(c2('S2', 1)) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Ruhe: %I0.0 = 0, %I0.1 = 1 · Start gedrückt: %I0.0 = 1 · Stopp gedrückt: %I0.1 = 0', cases: [{ world: {}, di: { 'I0.0': false, 'I0.1': true } }, { world: { press: ['S1'] }, di: { 'I0.0': true } }, { world: { press: ['S2'] }, di: { 'I0.1': false } }] },
    { kind: 'quiz', text: 'Welchen Wert zeigt %I0.1 (Stopp), wenn niemand drückt? (0 oder 1)', answer: 1, tol: 0 },
    { kind: 'quiz', text: 'Die Ader von -S2 bricht. Was sieht die SPS?', options: ['%I0.1 = 0 – wie „Stopp gedrückt“, die Anlage hält an', '%I0.1 = 1 – nichts passiert', 'Einen Drahtbruch-Alarm im Diagnosepuffer', 'Die CPU geht in STOP'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_variablentabelle', module: 1, no: 4, level: 'schnell', title: 'Variablen nach Klemmenplan',
  story: 'ARIA hat die PLC-Variablentabelle gelöscht. Ohne Namen weiss niemand, was %I0.4 bedeutet.',
  brief: '<p>Öffne den <b>Engineering-Laptop</b> (Ansicht 7) und lege im Reiter <b>PLC-Variablen</b> nach dem Klemmenplan an:</p><table><tr><th>Name</th><th>Datentyp</th><th>Adresse</th></tr><tr><td>Start</td><td>Bool</td><td>%I0.0</td></tr><tr><td>Stopp</td><td>Bool</td><td>%I0.1</td></tr><tr><td>Ind_Metall</td><td>Bool</td><td>%I0.4</td></tr><tr><td>Rutsche_Voll</td><td>Bool</td><td>%I1.0</td></tr><tr><td>Haube_Zu</td><td>Bool</td><td>%I1.3</td></tr><tr><td>Band</td><td>Bool</td><td>%Q0.0</td></tr></table>',
  learn: 'Symbolische Namen, Datentypen und Adressen in der PLC-Variablentabelle anlegen.', take: 'Die Variablentabelle verbindet Klemmenplan und Programm: Name ↔ Adresse. Doppelte Adressen meldet das Engineering sofort.',
  man: 'klemmenplan', theory: 'st1a', hint: '„+ Variable“ fügt eine Zeile an. Name, Datentyp und Adresse eintragen.', hint2: 'Eingänge beginnen mit %I, Ausgänge mit %Q. Bool braucht eine Bitadresse wie %I0.4.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:schrank', tags: 'leer',
  steps: [{ kind: 'tags', text: 'Sechs Variablen nach Klemmenplan anlegen', require: SORT_TAGS }] });

defWorkshopTask({ id: 'w1_band_selbsthaltung', module: 1, no: 5, level: 'schnell', title: 'Bandfreigabe mit Selbsthaltung',
  story: 'Die Sortierstrecke ist verdrahtet. Jetzt braucht das Band ein Programm — und ARIA wettet, dass du den Öffner falsch auswertest.',
  brief: '<p>Programmiere im Engineering (Reiter <b>Programm</b>, SCL oder FUP):</p><ul><li><b>"Band"</b> startet mit <b>"Start"</b> und hält sich selbst.</li><li><b>"Stopp"</b> (Öffner!) oder offene Haube (<b>"Haube_Zu"</b> = 0) schalten das Band aus.</li></ul><p>Danach <b>in das Gerät laden</b> und die CPU in RUN bringen.</p>',
  learn: 'Selbsthaltung mit Öffner-Auswertung programmieren und laden.', take: 'Ein Öffner wird im Programm <b>ohne</b> NOT abgefragt: In Ruhe ist er 1 und gibt frei.',
  man: 'nonc', theory: 'st1b', hint: 'Selbsthaltung: "Band" := ("Start" OR "Band") AND …', hint2: '"Stopp" ist in Ruhe 1 — also einfach mit AND verknüpfen, ohne NOT.',
  parts: ['S1', 'S2', 'S5', 'B1'], modules: ['A1'], x2: [1, 2, 5, 12], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Programm schreiben: Selbsthaltung, Stopp und Haube', langs: ['scl', 'fup'],
      start: { scl: '"Band" := "Start";\n', fup: 'NETWORK Band\n"Start" => "Band";' },
      ref: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";\n', fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" => "Band";' },
      timed: [{ steps: [[0, { Start: false, Stopp: true, Haube_Zu: true }, { Band: false }], [0.05, { Start: true }, { Band: true }], [0.05, { Start: false }, { Band: true }], [0.05, { Stopp: false }, { Band: false }], [0.05, { Stopp: true }, { Band: false }],
        [0.05, { Start: true }, { Band: true }], [0.05, { Start: false, Haube_Zu: false }, { Band: false }], [0.05, { Haube_Zu: true }, { Band: false }]] }],
      wrong: [{ scl: '"Band" := ("Start" OR "Band") AND NOT "Stopp" AND "Haube_Zu";' }, { scl: '"Band" := "Start" AND "Stopp" AND "Haube_Zu";' }, { scl: '"Band" := ("Start" OR "Band") AND "Stopp";' }] },
    { kind: 'load', text: 'In das Gerät laden und CPU starten' }
  ] });

defWorkshopTask({ id: 'w1_antivalent', module: 1, no: 6, level: 'werkstatt', title: 'Antivalenter Sensor',
  story: 'Für den Tank ist ein kapazitiver Sensor mit <b>zwei</b> Ausgängen gekommen: Schliesser und Öffner zugleich. Der Werkmeister will ihn vorher am Prüfstand testen.',
  brief: '<p>Schliesse <b>-B8</b> (4-Leiter, PNP, antivalent) an die SM 1221 an:</p><ul><li>BN → <b>-X2:21</b> L+, BU → -X2:21 M</li><li>BK (Schliesser) → -X2:21 Signal (→ %I16.0)</li><li>WH (Öffner) → -X2:22 Signal (→ %I16.1)</li></ul><p>Prüfe: Ohne Medium ist %I16.0 = 0 und %I16.1 = 1, mit Medium umgekehrt.</p>',
  learn: 'Einen 4-Leiter-Sensor mit antivalenten Ausgängen anschliessen.', take: 'Antivalent heisst: Die beiden Ausgänge sind immer entgegengesetzt. Sind beide gleich, stimmt etwas nicht — ideal zur Überwachung.',
  man: 'nonc', theory: 'st1b', hint: 'Werkstatt-Stufe: Aderendhülsen sind Pflicht — lass sie eingeschaltet.', hint2: 'Die Signalebenen -X2:21/22 sind bereits zur SM 1221 vorverdrahtet.',
  parts: ['B8'], modules: ['A1', 'A4'], x2: [21, 22, 23], start: 'preset:sm1221',
  steps: [
    { kind: 'wire', text: '-B8 an -X2:21/22 auflegen', target: [{ net: ['B8:BN', 'POT:L+'] }, { net: ['B8:BU', 'POT:M'] }, { net: ['B8:BK', 'DI:I16.0'] }, { net: ['B8:WH', 'DI:I16.1'] }],
      ref: { add: [['B8:BN', 'X2:21.L+'], ['B8:BU', 'X2:21.M'], ['B8:BK', 'X2:21.S'], ['B8:WH', 'X2:22.S']] },
      wrong: [{ add: [['B8:BN', 'X2:21.L+'], ['B8:BU', 'X2:21.M'], ['B8:WH', 'X2:21.S'], ['B8:BK', 'X2:22.S']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Ohne Medium: %I16.0 = 0, %I16.1 = 1 · mit Medium: 1 / 0', cases: [{ world: { b8: false }, di: { 'I16.0': false, 'I16.1': true } }, { world: { b8: true }, di: { 'I16.0': true, 'I16.1': false } }] }
  ] });

defWorkshopTask({ id: 'w1_drahtbruch_s5', module: 1, no: 7, level: 'werkstatt', title: 'Drahtbruch an der Haube', debug: true,
  story: 'Der Werkmeister zieht eine Ader: <i>„Stell dir vor, die Leitung zum Haubenschalter bricht. Was passiert mit dem Band?“</i>',
  brief: '<p>Simuliere einen Drahtbruch an <b>-S5</b> (Haubenschalter, Öffner): Löse die Signalader <b>-S5:12</b> von -X2:12. Schalte ein und beobachte %I1.3 bei geschlossener Haube.</p><p>Beantworte danach die Fragen.</p>',
  learn: 'Drahtbruchsicherheit von Öffnern verstehen.', take: 'Bei einem Öffner führt ein Drahtbruch in den sicheren Zustand: Die Anlage sieht „Haube offen“ und stoppt. Ein Schliesser würde den Bruch verschweigen.',
  man: 'nonc', theory: 'st1b', hint: 'Ader lösen: dieselbe Verbindung erneut antippen (oder „lösen“).', hint2: 'Die Haube ist zu — trotzdem 0 am Eingang. Genau das ist der sichere Zustand.',
  parts: ['S5'], modules: ['A1'], x2: [12], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'wire', text: 'Signalader -S5:12 lösen (Drahtbruch simulieren)', target: [{ notNet: ['S5:12', 'DI:I1.3'] }, { net: ['S5:11', 'POT:L+'] }], ref: { remove: [['S5:12', 'X2:12.S']] }, wrong: [{ remove: [] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Haube geschlossen, trotzdem %I1.3 = 0', cases: [{ world: { hood: 'zu' }, di: { 'I1.3': false } }] },
    { kind: 'quiz', text: 'Was macht das Bandprogramm aus Aufgabe 5 jetzt?', options: ['Das Band stoppt bzw. startet nicht – sicherer Zustand', 'Das Band läuft weiter, der Bruch bleibt unbemerkt', 'Die CPU geht in STOP', 'Das Band läuft rückwärts'], correct: 0 },
    { kind: 'quiz', text: 'Wäre -S5 ein Schliesser (1 = Haube offen), was würde ein Drahtbruch bewirken?', options: ['Nichts sichtbar – offene Haube würde nicht mehr erkannt', 'Das Band stoppt sofort', 'Die Sicherung -F2 löst aus', 'Die Haube öffnet sich'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_antivalenz_prog', module: 1, no: 8, level: 'werkstatt', title: 'Antivalenz überwachen',
  story: '-B8 ist angeschlossen. Wenn Schliesser und Öffner gleichzeitig dasselbe melden, ist der Sensor defekt oder eine Ader gebrochen — ARIA soll das nicht verstecken können.',
  brief: '<p>Programmiere eine <b>Antivalenzüberwachung</b>: Sind <b>"B8_NO"</b> und <b>"B8_NC"</b> <b>länger als 100 ms</b> gleich, leuchtet <b>"Lampe_Rot"</b> (Sensorfehler). Kurze Überschneidungen beim Umschalten sind erlaubt.</p><p>Nutze dafür die Zeitinstanz <b>"T_Antivalenz"</b> (TON). Die Variablen B8_NO (%I16.0) und B8_NC (%I16.1) sind angelegt.</p>',
  learn: 'Antivalente Signale mit Zeitüberwachung auswerten.', take: 'NOT (NO XOR NC) ist 1, wenn beide gleich sind. Die Zeitverzögerung filtert das kurze Umschalten heraus.',
  man: 'nonc', theory: 'st1b', hint: 'Gleich sind die beiden, wenn NOT ("B8_NO" XOR "B8_NC").', hint2: '"T_Antivalenz"(IN := …, PT := T#100MS); "Lampe_Rot" := "T_Antivalenz".Q;',
  parts: ['B8'], modules: ['A1', 'A4'], x2: [21, 22], start: { base: 'sm1221', mainSwitch: true, wires: [['B8:BN', 'X2:21.L+'], ['B8:BU', 'X2:21.M'], ['B8:BK', 'X2:21.S'], ['B8:WH', 'X2:22.S']] },
  steps: [
    { kind: 'program', text: 'Antivalenzüberwachung programmieren', langs: ['scl', 'fup'], fb: { T_Antivalenz: 'TON' },
      tagsExtra: [{ name: 'B8_NO', type: 'Bool', addr: '%I16.0', comment: '-B8 Schliesser' }, { name: 'B8_NC', type: 'Bool', addr: '%I16.1', comment: '-B8 Öffner' }],
      start: { scl: '"Lampe_Rot" := FALSE;\n', fup: 'NETWORK Sensorfehler\n=> R "Lampe_Rot";' },
      ref: { scl: '"T_Antivalenz"(IN := NOT ("B8_NO" XOR "B8_NC"), PT := T#100MS);\n"Lampe_Rot" := "T_Antivalenz".Q;\n',
        fup: 'NETWORK Sensorfehler\n(("B8_NO" AND "B8_NC") OR (NOT "B8_NO" AND NOT "B8_NC")) AND TON(T_Antivalenz, T#100MS) => "Lampe_Rot";' },
      timed: [{ steps: [[0, { B8_NO: true, B8_NC: false }, { Lampe_Rot: false }], [0.05, { B8_NC: true }, { Lampe_Rot: false }], [0.05, {}, { Lampe_Rot: false }], [0.05, {}, { Lampe_Rot: true }],
        [0.05, { B8_NC: false }, { Lampe_Rot: false }], [0.05, { B8_NO: false }, { Lampe_Rot: false }], [0.08, {}, { Lampe_Rot: false }], [0.05, {}, { Lampe_Rot: true }], [0.05, { B8_NC: true }, { Lampe_Rot: false }]] }],
      wrong: [{ scl: '"Lampe_Rot" := NOT ("B8_NO" XOR "B8_NC");' }, { scl: '"T_Antivalenz"(IN := "B8_NO" XOR "B8_NC", PT := T#100MS);\n"Lampe_Rot" := "T_Antivalenz".Q;' }] },
    { kind: 'load', text: 'Laden und starten' }
  ] });

defWorkshopTask({ id: 'w1_fehler_bk_ebene', module: 1, no: 9, level: 'werkstatt', title: 'LED an, Eingang aus', debug: true,
  story: 'Nach ARIAs „Wartung“ leuchtet die gelbe LED an -B1, wenn Stahl vorbeikommt — aber %I0.4 bleibt dunkel.',
  brief: '<p>Finde den Fehler an -B1 und behebe ihn. Tipp: Die Sensor-LED zeigt, dass der Sensor schaltet. Wohin geht sein Signal?</p>',
  learn: 'Systematisch vom Sensor über die Klemme zum Eingang suchen.', take: 'Sensor-LED an, Klemmen-LED aus: Das Signal kommt nicht auf der Signalebene an. Eine Ader auf der falschen Klemmenebene ist ein Klassiker.',
  man: 'schrank', theory: 'st1b', hint: 'Schau dir -X2:5 genau an: Welche Ebene hat zwei Adern?', hint2: 'BK gehört auf die Signalebene (Mitte), nicht auf L+.',
  parts: ['B1'], modules: ['A1'], x2: [4, 5, 6], start: { base: 'schrank', wires: [['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:5.L+']], mainSwitch: true, mounts: { B1: { dist: 4, tight: true } } },
  symptom: { cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': false } }] },
  steps: [
    { kind: 'wire', text: 'Fehler an -X2:5 beheben', target: need('B1').concat([{ notNet: ['B1:BK', 'POT:L+'] }]), ref: { remove: [['B1:BK', 'X2:5.L+']], add: [['B1:BK', 'X2:5.S']] }, wrong: [{ remove: [], add: [] }] },
    { kind: 'observe', text: 'Stahlteil: %I0.4 = 1', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Wo lag der Fehler?', options: ['BK lag auf der L+-Ebene statt auf der Signalebene', 'Der Sensor war defekt', '1M war nicht angeschlossen', 'Die Sicherung -F2 war ausgelöst'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_boss_sortierstrecke', module: 1, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Die Sortierstrecke lebt',
  story: 'ARIA hat die Sortierstrecke zerlegt: Sensoren abgeschraubt, Querbrücker gezogen, Programm gelöscht. Der Werkmeister stellt dir einen Kaffee hin: <i>„Bis Schichtende läuft das Band wieder.“</i>',
  brief: '<ol><li><b>-B1</b> auf 4 mm montieren, <b>-B5</b> (Reflexions-Lichtschranke) ausrichten.</li><li>M12-Leitungen von -B1 und -B5 anstecken und festziehen.</li><li>Querbrücker L+ und M an -X2 stecken.</li><li>-S1 → -X2:1, -S2 → -X2:2, -B1 → -X2:5, -B5 → -X2:9, -S5 → -X2:12 auflegen.</li><li>Variablen Start, Stopp, Ind_Metall, Rutsche_Voll, Haube_Zu, Band anlegen.</li><li>Programm: Band mit Selbsthaltung, aus bei Stopp, offener Haube oder <b>voller Rutsche</b> ("Rutsche_Voll" = 1).</li><li>Laden, RUN.</li></ol>',
  learn: 'Eine Sensorstrecke vollständig in Betrieb nehmen.', take: 'Montieren → anstecken → auflegen → Variablen → Programm → laden. In genau dieser Reihenfolge — und nach jedem Schritt prüfen.',
  man: 'schrank', theory: 'st1b', hint: 'Arbeite die Schritte der Reihe nach ab — die Liste zeigt, was schon passt.', hint2: 'Rutsche_Voll ist ein normaler Schliesser-Sensor: Band nur, wenn NOT "Rutsche_Voll".',
  parts: ['S1', 'S2', 'S5', 'B1', 'B5'], modules: ['A1'], x2: [1, 2, 5, 9, 12], start: { base: 'schrank_ohne_qb', plugs: { B1: false, B5: false }, mounts: { B1: { dist: 10, tight: false }, B5: { align: { h: 5, v: -4 } } } },
  tags: SORT_TAGS.filter(t => t.name === 'Band'),
  steps: [
    { kind: 'mount', text: '-B1 auf 4 mm', part: 'B1', dist: [4, 0.5] },
    { kind: 'mount', text: '-B5 ausrichten (Stabilitäts-LED ruhig)', part: 'B5', align: true, tight: false },
    { kind: 'plug', text: 'M12 von -B1 und -B5 fest', parts: ['B1', 'B5'] },
    { kind: 'wire', text: 'Fünf Geräte auflegen', target: [{ bridge: 'QB_X2_LP' }, { bridge: 'QB_X2_M' }].concat(need('S1'), need('S2'), need('B1'), need('B5'), need('S5')),
      ref: { bridges: ['QB_X2_LP', 'QB_X2_M'], add: [].concat(field('S1'), field('S2'), field('B1'), field('B5'), field('S5')) }, wrong: [{ bridges: ['QB_X2_LP'], add: [].concat(field('S1'), field('S2'), field('B1'), field('B5'), field('S5')) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe', cases: [{ world: { parts: { B1: 'stahl', B5: 'stahl' } }, di: { 'I0.4': true, 'I1.0': true, 'I0.1': true, 'I1.3': true } }, { world: { press: ['S1'], hood: 'offen' }, di: { 'I0.0': true, 'I1.3': false, 'I0.4': false } }] },
    { kind: 'tags', text: 'Variablen anlegen', require: SORT_TAGS },
    { kind: 'program', text: 'Bandfreigabe programmieren', langs: ['scl', 'fup'],
      start: { scl: '', fup: 'NETWORK Band\n"Start" => "Band";' },
      ref: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND NOT "Rutsche_Voll";\n',
        fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND NOT "Rutsche_Voll" => "Band";' },
      timed: [{ steps: [[0, { Start: true, Stopp: true, Haube_Zu: true, Rutsche_Voll: false }, { Band: true }], [0.05, { Start: false }, { Band: true }], [0.05, { Rutsche_Voll: true }, { Band: false }], [0.05, { Rutsche_Voll: false }, { Band: false }],
        [0.05, { Start: true }, { Band: true }], [0.05, { Start: false, Stopp: false }, { Band: false }], [0.05, { Stopp: true, Start: true, Haube_Zu: false }, { Band: false }]] }],
      wrong: [{ scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";' }, { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND "Rutsche_Voll";' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/m2.js ==== */
/* ===== SENSORWERKSTATT Modul 2: PNP und NPN ===== */
(function(root){
const { w3, c2, field, need, PRE_CPU, PRE_SM } = root.SW;
const T = () => root.SensorTasks;
// Spannung zwischen zwei Klemmstellen im Szenario sc (Multimeter V DC, rote Spitze a, schwarze Spitze b)
const U = (a, b, sc) => (ctx, SM, W) => W.voltage(ctx.state, a, b, T().worldFrom(ctx.state, sc));

// Prüfstand NPN: SM 1221 Gruppe .0–.3 stromliefernd (1M auf L+), -N1 auf -X2:21
defPreset('m2_npn_bank', { base: 'schrank', wires: PRE_SM.concat([['A4:1M', 'X1:L+4'], ['A4:2M', 'X1:M5']], w3('N1', 21)) });
// CPU-Gruppe: 1M falsch auf L+ (Elektriker hat NPN erwartet), -B1, -B5, -S1 aufgelegt
defPreset('m2_1m_falsch', { wires: PRE_CPU.concat([['A1:1M', 'X1:L+2']], field('S1'), field('B1'), field('B5')), bridges: ['QB_X2_LP', 'QB_X2_M'] });
// SM 1221 mit NPN-Übungssensor auf -X2:21 und -B8 (PNP) auf -X2:25, beide Gruppen auf M
defPreset('m2_npn_an_pnp', { base: 'sm1221', wires: w3('N1', 21).concat([['B8:BN', 'X2:25.L+'], ['B8:BU', 'X2:25.M'], ['B8:BK', 'X2:25.S']]) });

defWorkshopTask({ id: 'w2_pnp_messen', module: 2, no: 1, level: 'schnell', title: 'PNP gemessen',
  story: 'Der Werkmeister drückt dir das Multimeter in die Hand: <i>„Glauben ist gut, messen ist besser. Zeig mir, was ein plusschaltender Sensor wirklich an die Klemme liefert.“</i>',
  brief: '<p>-B1 (induktiv, <b>PNP</b> NO) ist auf <b>-X2:5</b> aufgelegt. Schalte -Q0 ein und miss mit dem Multimeter (V DC):</p><ul><li>rote Spitze auf <b>-X2:5 Signal</b>, schwarze Spitze auf <b>-X2:5 M</b></li><li>einmal mit Stahlteil vor -B1, einmal ohne Teil</li></ul><p>Trage die Messwerte ins Protokoll ein.</p>',
  learn: 'Das Signal eines PNP-Sensors gegen M messen und deuten.', take: 'PNP = plusschaltend: Hat der Sensor geschaltet, liegen am Signal <b>+24 V gegen M</b>. Sonst 0 V.',
  man: 'pnpnpn', theory: 'st2a', hint: 'Multimeter auf V DC stellen, dann die beiden Messspitzen auf die Klemmstellen setzen.', hint2: 'PNP schaltet L+ auf die schwarze Ader: Mit Teil misst du die volle Versorgungsspannung.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Signal gegen M messen', ask: [
      { q: 'Stahlteil vor -B1: -X2:5 Signal gegen M', unit: 'V', calc: U('X2:5.S', 'X2:5.M', { parts: { B1: 'stahl' } }), tol: 0.5 },
      { q: 'Kein Teil: -X2:5 Signal gegen M', unit: 'V', calc: U('X2:5.S', 'X2:5.M', {}), tol: 0.5 }] },
    { kind: 'quiz', text: 'Was schaltet ein PNP-Sensor auf seinen Ausgang, wenn er ein Teil erkennt?', options: ['+24 V (L+)', '0 V (M)', 'Einen Strom von 20 mA', 'Die Versorgung wird unterbrochen'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_npn_messen', module: 2, no: 2, level: 'schnell', title: 'NPN gemessen',
  story: 'Aus dem Lager kommt ein Übungssensor <b>-N1</b> mit der Aufschrift „NPN NO“. Er hängt schon an der SM 1221. ARIA flüstert: <i>„Miss ihn gegen M. Du wirst staunen.“</i>',
  brief: '<p>-N1 (induktiv, <b>NPN</b> NO) ist auf <b>-X2:21</b> aufgelegt (→ %I16.0). Die Eingangsgruppe der SM 1221 ist für NPN vorbereitet. Schalte -Q0 ein und miss (V DC):</p><ol><li>Teil vor -N1: rot auf <b>-X2:21 Signal</b>, schwarz auf <b>-X2:21 M</b></li><li>Teil vor -N1: rot auf <b>-X2:21 L+</b>, schwarz auf <b>-X2:21 Signal</b></li><li>Kein Teil: rot auf L+, schwarz auf Signal</li></ol>',
  learn: 'Das Signal eines NPN-Sensors gegen M und gegen L+ messen.', take: 'NPN = minusschaltend: Der aktive Ausgang zieht das Signal auf <b>0 V</b>. Die 24 V siehst du nur <b>gegen L+</b>.',
  man: 'pnpnpn', theory: 'st2a', hint: 'Bei NPN ist das Signal im geschalteten Zustand mit M verbunden.', hint2: 'Zwischen L+ und einem Signal, das auf M liegt, misst du die ganze Versorgungsspannung.',
  parts: ['N1'], modules: ['A1', 'A4'], x2: [21, 22], start: 'preset:m2_npn_bank',
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Teil vor -N1: %I16.0 = 1, ohne Teil: 0', cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I16.0': false } }] },
    { kind: 'measure', text: 'NPN-Signal messen', ask: [
      { q: 'Teil da: Signal gegen M', unit: 'V', calc: U('X2:21.S', 'X2:21.M', { parts: { N1: 'stahl' } }), tol: 0.5 },
      { q: 'Teil da: L+ gegen Signal', unit: 'V', calc: U('X2:21.L+', 'X2:21.S', { parts: { N1: 'stahl' } }), tol: 0.5 },
      { q: 'Kein Teil: L+ gegen Signal', unit: 'V', calc: U('X2:21.L+', 'X2:21.S', { parts: { N1: null } }), tol: 0.5 }] },
    { kind: 'quiz', text: 'Was fällt beim NPN-Sensor auf?', options: ['Geschaltet liegt das Signal auf 0 V – messbar ist die Spannung nur gegen L+', 'Geschaltet liegen +24 V gegen M, genau wie bei PNP', 'Das Signal ist immer 12 V', 'Ein NPN-Sensor braucht keine Versorgung'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_1m_cpu', module: 2, no: 3, level: 'werkstatt', title: '1M der CPU',
  story: 'Ein Aushilfselektriker hat den Schrank „fertig“ gemacht. Die Sensor-LEDs leuchten, doch die Eingangs-LEDs der CPU bleiben dunkel. Er zuckt mit den Schultern: <i>„Ich dachte, da kommen NPN-Sensoren hin.“</i>',
  brief: '<p>An der CPU 1214C hängen nur <b>PNP-Sensoren</b> und Taster, die +24 V schalten. Das Bezugspotential <b>1M</b> der Eingangsgruppe liegt aber auf L+.</p><ol><li>Ader von <b>-A1:1M</b> an -X1:L+2 lösen.</li><li><b>-A1:1M</b> auf die M-Schiene (<b>-X1:M2</b>) legen.</li><li>Einschalten und prüfen: Stahlteil vor -B1 → %I0.4, Teil vor -B5 → %I1.0, Start → %I0.0.</li></ol>',
  learn: 'Das Bezugspotential 1M der CPU-Eingänge passend zu PNP-Gebern auflegen.', take: 'PNP-Geber brauchen einen <b>stromziehenden</b> Eingang: 1M auf <b>M</b>. Der Strom fliesst vom Sensor durch den Eingang nach M.',
  man: 'eingang', theory: 'st2a', hint: 'Lösen: dieselbe Verbindung erneut antippen. Dann 1M neu auflegen.', hint2: 'Der Eingangsstrom muss vom +24-V-Signal durch den Eingang zu 1M fliessen können – also muss 1M auf M liegen.',
  parts: ['S1', 'B1', 'B5'], modules: ['A1'], x2: [1, 5, 9], start: 'preset:m2_1m_falsch',
  steps: [
    { kind: 'wire', text: '-A1:1M von L+ auf M umklemmen', target: [{ net: ['A1:1M', 'POT:M'] }, { notNet: ['A1:1M', 'POT:L+'] }].concat(need('B1'), need('B5'), need('S1')),
      ref: { remove: [['A1:1M', 'X1:L+2']], add: [['A1:1M', 'X1:M2']] },
      wrong: [{ add: [['A1:1M', 'X1:M2']] }, { remove: [['A1:1M', 'X1:L+2']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Stahl vor -B1 und Teil vor -B5: %I0.4 = 1, %I1.0 = 1 · Start gedrückt: %I0.0 = 1', cases: [{ world: { parts: { B1: 'stahl', B5: 'stahl' } }, di: { 'I0.4': true, 'I1.0': true } }, { world: { press: ['S1'] }, di: { 'I0.0': true, 'I0.4': false } }] },
    { kind: 'quiz', text: 'Warum waren die Eingänge mit 1M auf L+ dunkel?', options: ['Signal und 1M lagen beide auf +24 V – ohne Spannungsdifferenz fliesst kein Eingangsstrom', 'Die Sensoren waren nicht versorgt', 'Die CPU war in STOP', 'Die Sicherung -F2 war ausgelöst'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_sm1221_npn', module: 2, no: 4, level: 'werkstatt', title: 'SM 1221 für NPN',
  story: 'Die Sortierstrecke bekommt eine Zusatzmaschine mit NPN-Sensoren. Der Werkmeister: <i>„Die kommen alle auf die SM 1221. Die CPU-Gruppe bleibt PNP.“</i>',
  brief: '<p>Auf der SM 1221 liegen <b>1M</b> (Eingänge .0–.3) und <b>2M</b> (Eingänge .4–.7) im Moment auf M.</p><ol><li><b>-A4:1M</b> von -X1:M4 lösen und auf <b>L+</b> (-X1:L+4) legen. 2M bleibt auf M.</li><li>NPN-Sensor <b>-N1</b> auf <b>-X2:21</b> auflegen: BN → L+, BU → M, BK → Signal (→ %I16.0).</li><li>Einschalten, Teil vor -N1: %I16.0 = 1.</li></ol><p>Die Gruppierung der SM 1221 steht im Gerätehandbuch – im Zweifel dort nachsehen.</p>',
  learn: 'Eine Eingangsgruppe der SM 1221 stromliefernd beschalten und einen NPN-Sensor anschliessen.', take: 'NPN-Geber brauchen einen <b>stromliefernden</b> Eingang: 1M auf <b>L+</b>. Das gilt für die ganze Gruppe – PNP und NPN nie in derselben Gruppe mischen.',
  man: 'eingang', theory: 'st2a', hint: 'Zuerst die alte Ader von 1M lösen. Sonst verbindest du L+ und M – Kurzschluss!', hint2: 'Nur 1M umklemmen: Eingang %I16.0 gehört zur Gruppe .0–.3.',
  parts: ['N1'], modules: ['A1', 'A4'], x2: [21, 22, 25], start: 'preset:sm1221',
  steps: [
    { kind: 'wire', text: '1M auf L+ umklemmen und -N1 auf -X2:21 auflegen', target: need('N1').concat([{ net: ['A4:1M', 'POT:L+'] }, { net: ['A4:2M', 'POT:M'] }]),
      ref: { remove: [['A4:1M', 'X1:M4']], add: [['A4:1M', 'X1:L+4']].concat(w3('N1', 21)) },
      wrong: [{ add: w3('N1', 21) }, { remove: [['A4:2M', 'X1:M5']], add: [['A4:2M', 'X1:L+5']].concat(w3('N1', 21)) }, { add: [['A4:1M', 'X1:L+4']].concat(w3('N1', 21)) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Teil vor -N1: %I16.0 = 1, ohne Teil: 0', cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I16.0': false } }] },
    { kind: 'quiz', text: 'Warum darf die alte Ader von 1M nicht auf M bleiben, wenn du 1M zusätzlich auf L+ legst?', options: ['Dann sind L+ und M über 1M verbunden – Kurzschluss, das Netzteil geht in Überlast', 'Dann zählt der Eingang doppelt', 'Das ist erlaubt und sogar besser', 'Dann wird der Sensor PNP'], correct: 0 }
  ] });

const ZAEHL_TAGS = [{ name: 'Teile_Anzahl', type: 'Int', addr: '%MW20', comment: 'HMI Anzeige Teilezähler' }, { name: 'HMI_Reset', type: 'Bool', addr: '%M10.0', comment: 'HMI Taste Zähler zurücksetzen' }];
defWorkshopTask({ id: 'w2_teilezaehler', module: 2, no: 5, level: 'schnell', title: 'Teilezähler',
  story: 'Die Produktion will wissen, wie viele Metallteile heute über das Band gelaufen sind. ARIA hat schon „gezählt“: 4 872 Teile in zehn Sekunden.',
  brief: '<p>Zähle die Metallteile an <b>-B1</b> ("Ind_Metall"): Jedes Teil zählt <b>genau einmal</b> – egal wie viele Zyklen es vor dem Sensor liegt.</p><ul><li>Zählerstand in <b>"Teile_Anzahl"</b> (Int, %MW20, Anzeige am HMI).</li><li><b>"HMI_Reset"</b> (%M10.0) setzt den Zähler auf 0.</li><li>Für die Flanke in SCL die Instanz <b>"Flanke_B1"</b> (R_TRIG) verwenden, in FUP <code>P(…)</code>.</li></ul><p>Danach laden und starten.</p>',
  learn: 'Ein Sensorsignal über eine steigende Flanke zählen.', take: 'Ein Sensor ist so lange 1, wie das Teil vor ihm liegt – viele Zyklen lang. Zählen darf man nur die <b>steigende Flanke</b>.',
  man: 'pnpnpn', theory: 'st2a', hint: '"Flanke_B1"(CLK := "Ind_Metall"); liefert in "Flanke_B1".Q genau einen Zyklus lang 1.', hint2: 'IF "Flanke_B1".Q THEN "Teile_Anzahl" := "Teile_Anzahl" + 1; END_IF; — und danach der Reset.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Teilezähler mit Flanke programmieren', langs: ['scl', 'fup'], fb: { Flanke_B1: 'R_TRIG' }, tagsExtra: ZAEHL_TAGS,
      start: { scl: 'IF "Ind_Metall" THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;\n', fup: 'NETWORK Zaehlen\n"Ind_Metall" => INC("Teile_Anzahl");' },
      ref: { scl: '"Flanke_B1"(CLK := "Ind_Metall");\nIF "Flanke_B1".Q THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;\nIF "HMI_Reset" THEN\n  "Teile_Anzahl" := 0;\nEND_IF;\n',
        fup: 'NETWORK Zaehlen\nP("Ind_Metall") => INC("Teile_Anzahl");\n\nNETWORK Zuruecksetzen\n"HMI_Reset" => MOVE(0, "Teile_Anzahl");' },
      timed: [{ steps: [[0, { Ind_Metall: false, HMI_Reset: false }, { Teile_Anzahl: 0 }], [0.05, { Ind_Metall: true }, { Teile_Anzahl: 1 }], [0.05, {}, { Teile_Anzahl: 1 }], [0.05, {}, { Teile_Anzahl: 1 }],
        [0.05, { Ind_Metall: false }, { Teile_Anzahl: 1 }], [0.05, { Ind_Metall: true }, { Teile_Anzahl: 2 }], [0.05, { Ind_Metall: false }, { Teile_Anzahl: 2 }], [0.05, { HMI_Reset: true }, { Teile_Anzahl: 0 }], [0.05, { HMI_Reset: false, Ind_Metall: true }, { Teile_Anzahl: 1 }]] }],
      wrong: [{ scl: 'IF "Ind_Metall" THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;\nIF "HMI_Reset" THEN\n  "Teile_Anzahl" := 0;\nEND_IF;' },
        { scl: '"Flanke_B1"(CLK := "Ind_Metall");\nIF "Flanke_B1".Q THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;' }] },
    { kind: 'load', text: 'In das Gerät laden und CPU starten' }
  ] });

defWorkshopTask({ id: 'w2_tabelle', module: 2, no: 6, level: 'schnell', title: 'Vier Kombinationen',
  story: 'Am Whiteboard hat der Werkmeister eine Tabelle gezeichnet: zwei Sensorarten, zwei Beschaltungen. <i>„Wer die im Schlaf kann, sucht nie wieder stundenlang.“</i>',
  brief: '<p>Fülle die Tabelle aus: Funktioniert der Eingang?</p><table><tr><th></th><th>1M auf M (stromziehend)</th><th>1M auf L+ (stromliefernd)</th></tr><tr><td>PNP-Sensor</td><td>A</td><td>B</td></tr><tr><td>NPN-Sensor</td><td>C</td><td>D</td></tr></table><p>Beantworte die Arbeitsschritte. Probier es am Prüfstand aus, wenn du unsicher bist (-B1 = PNP an der CPU, -N1 = NPN an der SM 1221).</p>',
  learn: 'Sensor-Schaltart und Eingangsbeschaltung einander zuordnen.', take: 'PNP ↔ 1M auf M, NPN ↔ 1M auf L+. Passt es nicht, leuchtet die Sensor-LED, aber der Eingang bleibt 0.',
  man: 'eingang', theory: 'st2b', hint: 'Der Eingangsstrom braucht einen Weg: vom Signal durch den Eingang zu 1M – oder umgekehrt.', hint2: 'PNP liefert +24 V, also muss 1M auf 0 V liegen. NPN liefert 0 V, also muss 1M auf +24 V liegen.',
  parts: ['B1', 'N1'], modules: ['A1', 'A4'], x2: [5, 21], start: 'preset:sm1221',
  steps: [
    { kind: 'quiz', text: 'Feld A: PNP-Sensor, 1M auf M', options: ['funktioniert', 'funktioniert nicht'], correct: 0 },
    { kind: 'quiz', text: 'Feld B: PNP-Sensor, 1M auf L+', options: ['funktioniert', 'funktioniert nicht'], correct: 1 },
    { kind: 'quiz', text: 'Feld C: NPN-Sensor, 1M auf M', options: ['funktioniert', 'funktioniert nicht'], correct: 1 },
    { kind: 'quiz', text: 'Feld D: NPN-Sensor, 1M auf L+', options: ['funktioniert', 'funktioniert nicht'], correct: 0 },
    { kind: 'quiz', text: 'Woran erkennst du im Feld eine falsche Kombination?', options: ['Sensor-LED leuchtet, Eingangs-LED bleibt dunkel', 'Beide LEDs sind aus', 'Die Eingangs-LED leuchtet dauernd', 'Das Netzteil meldet Überlast'], correct: 0 },
    { kind: 'quiz', text: 'Wie heisst ein Eingang mit 1M auf M, der den Strom eines PNP-Sensors aufnimmt?', options: ['stromziehend (sink)', 'stromliefernd (source)', 'antivalent', 'potentialfrei'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_ersatz_npn', module: 2, no: 7, level: 'werkstatt', title: 'Falsches Ersatzteil',
  story: 'Nachtschicht. -B2 ist defekt, im Lager liegt nur ein baugleicher Sensor – aber in <b>NPN</b>. Die Anlage ist komplett PNP. ARIA: <i>„Leg doch einfach 1M auf L+. Was soll schon passieren?“</i>',
  brief: '<p>Bewerte die Möglichkeiten, den NPN-Ersatzsensor an der PNP-Anlage zu betreiben. Denk daran: An der CPU 1214C teilen sich alle 14 Eingänge <b>ein</b> Bezugspotential 1M.</p><ul><li>1M der CPU auf L+ legen</li><li>Koppelrelais zwischen Sensor und Eingang</li><li>Signalwandler NPN → PNP (z. B. als M12-Zwischenstecker)</li><li>Richtigen PNP-Sensor bestellen und einbauen</li></ul>',
  learn: 'Ersatzlösungen für einen falschen Sensortyp fachlich bewerten.', take: 'Die saubere Lösung ist der richtige Sensortyp. Ein Wandler oder Koppelrelais kann überbrücken. 1M umklemmen legt alle anderen Sensoren der Gruppe lahm.',
  man: 'pnpnpn', theory: 'st2b', hint: 'Was passiert mit -B1, -B5 und den Tastern, wenn 1M auf L+ liegt?', hint2: 'Ein Koppelrelais hat eine Spule (NPN schaltet sie gegen M) und einen Kontakt, der +24 V auf den Eingang schaltet.',
  parts: ['B2', 'N1'], modules: ['A1'], x2: [5, 6], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'quiz', text: 'ARIAs Vorschlag: 1M der CPU auf L+ legen. Was passiert?', options: ['Der NPN-Sensor geht, aber alle PNP-Sensoren und Taster an der CPU fallen aus', 'Alles funktioniert', 'Nur der NPN-Sensor fällt aus', 'Die CPU schaltet automatisch auf NPN um'], correct: 0 },
    { kind: 'quiz', text: 'Wie viele Digitaleingänge der CPU 1214C hängen an 1M?', answer: 14, tol: 0 },
    { kind: 'quiz', text: 'Koppelrelais: Wie wird es angeschlossen?', options: ['Spule zwischen L+ und NPN-Ausgang, Kontakt schaltet +24 V auf den Eingang', 'Spule zwischen Eingang und M, Kontakt zum Sensor', 'Kontakt zwischen L+ und M', 'Spule direkt an 1M'], correct: 0 },
    { kind: 'quiz', text: 'Welcher Nachteil hat das Koppelrelais?', options: ['Zusätzliches Bauteil mit Verschleiss und Schaltverzögerung – für schnelle Signale ungeeignet', 'Es invertiert das Signal immer', 'Es braucht 230 V', 'Es funktioniert nur mit Öffnern'], correct: 0 },
    { kind: 'quiz', text: 'Welche Lösung ist auf Dauer die beste?', options: ['Den richtigen PNP-Sensor einbauen (Ersatzteil nachbestellen)', 'Signalwandler für immer drin lassen', '1M auf L+ legen', 'Den Sensor ganz weglassen'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_fehler_npn_pnp', module: 2, no: 8, level: 'werkstatt', title: 'Neuer Sensor, Eingang tot', debug: true,
  story: 'Ein Kollege hat -N1 an die SM 1221 angeschlossen und ist in die Pause. Die gelbe LED am Sensor leuchtet schön, wenn ein Teil davor liegt. %I16.0 bleibt trotzdem 0. Auf -X2:25 hängt -B8 – der funktioniert.',
  brief: '<p>Finde heraus, warum %I16.0 nicht kommt, und behebe den Fehler. -B8 (PNP) an %I16.4 muss danach weiter funktionieren.</p>',
  learn: 'Einen NPN-Sensor an einer PNP-Eingangsgruppe erkennen und die Gruppe richtig beschalten.', take: 'Sensor-LED an, Eingang aus, Verdrahtung „stimmt“: Schaltart des Sensors und Beschaltung von 1M vergleichen. Die Gruppen der SM 1221 sind getrennt beschaltbar.',
  man: 'eingang', theory: 'st2b', hint: 'Lies das Typenschild von -N1. Und schau, wo 1M und 2M der SM 1221 liegen.', hint2: 'Nur die Gruppe mit %I16.0 (1M) gehört auf L+. 2M bleibt für -B8 auf M.',
  parts: ['N1', 'B8'], modules: ['A1', 'A4'], x2: [21, 25], start: { base: 'm2_npn_an_pnp', mainSwitch: true },
  symptom: { cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': false } }] },
  steps: [
    { kind: 'wire', text: 'Beschaltung der Gruppe von %I16.0 korrigieren', target: need('N1').concat([{ net: ['A4:1M', 'POT:L+'] }, { net: ['A4:2M', 'POT:M'] }, { net: ['B8:BK', 'DI:I16.4'] }]),
      ref: { remove: [['A4:1M', 'X1:M4']], add: [['A4:1M', 'X1:L+4']] },
      wrong: [{ remove: [['A4:1M', 'X1:M4'], ['A4:2M', 'X1:M5']], add: [['A4:1M', 'X1:L+4'], ['A4:2M', 'X1:L+5']] }, { remove: [], add: [] }] },
    { kind: 'observe', text: 'Teil vor -N1: %I16.0 = 1 · -B8 meldet: %I16.4 = 1', cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I16.0': false } }, { world: { b8: true }, di: { 'I16.4': true } }] },
    { kind: 'quiz', text: 'Was war die Ursache?', options: ['NPN-Sensor an einer Gruppe mit 1M auf M (stromziehend, für PNP)', 'Sensor defekt', 'BK auf der falschen Klemmenebene', 'BN und BU vertauscht'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_fehler_bk_m', module: 2, no: 9, level: 'werkstatt', title: 'Die LED blinkt', debug: true,
  story: 'Nach ARIAs Nachtschicht blinkt die LED an -B1, sobald ein Stahlteil vorbeikommt – und %I0.4 bleibt aus. Der Werkmeister riecht am Sensor: <i>„Riecht nicht verbrannt. Der hat sich selbst geschützt.“</i>',
  brief: '<p>-B1 ist auf -X2:5 aufgelegt, aber etwas stimmt nicht. Finde den Fehler und behebe ihn.</p><p>Tipp: Ein PNP-Ausgang schaltet +24 V. Was passiert, wenn er dabei direkt auf M arbeitet?</p>',
  learn: 'Einen Kurzschluss am Schaltausgang erkennen (Kurzschlussschutz des Sensors).', take: 'Blinkende Sensor-LED und kein Signal: Der Ausgang ist kurzgeschlossen. Gute Sensoren schalten dann ab und blinken – BK gehört auf die Signalebene.',
  man: 'sensoren', theory: 'st2b', hint: 'Welche Ebene an -X2:5 hat zwei Adern?', hint2: 'BK liegt auf der M-Ebene. Umklemmen auf die Signalebene (Mitte).',
  parts: ['B1'], modules: ['A1'], x2: [4, 5, 6], start: { base: 'schrank', wires: [['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:5.M']], mainSwitch: true, mounts: { B1: { dist: 4, tight: true } } },
  symptom: { cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': false } }] },
  steps: [
    { kind: 'wire', text: 'BK von -B1 richtig auflegen', target: need('B1').concat([{ notNet: ['B1:BK', 'POT:M'] }]), ref: { remove: [['B1:BK', 'X2:5.M']], add: [['B1:BK', 'X2:5.S']] },
      wrong: [{ remove: [], add: [] }, { remove: [['B1:BK', 'X2:5.M']], add: [['B1:BK', 'X2:5.L+']] }] },
    { kind: 'observe', text: 'Stahlteil: %I0.4 = 1, ohne Teil: 0', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Warum blinkte die LED?', options: ['BK lag auf M: Der PNP-Ausgang schaltete +24 V direkt auf M, der Kurzschlussschutz hat abgeschaltet', 'Der Sensor war falsch eingestellt', '1M lag auf L+', 'Die M12-Rändelmutter war lose'], correct: 0 },
    { kind: 'quiz', text: 'Was wäre bei BK auf L+ passiert (Fehler aus Modul 1)?', options: ['Kein Kurzschluss, aber das Signal kommt nie am Eingang an', 'Das Netzteil geht in Überlast', 'Der Eingang ist dauernd 1', 'Die LED blinkt ebenfalls'], correct: 0 }
  ] });

const BOSS_SORT = [].concat(field('B1'), field('B2'), field('B5'));
defWorkshopTask({ id: 'w2_boss_umbau', module: 2, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Gemischter Umbau',
  story: 'Die Sortierstrecke wird umgebaut: Am Auswerfer sitzt künftig ein zusätzlicher induktiver Sensor – geliefert wurde er als <b>NPN</b>. ARIA hat ausserdem alle Sensoradern gezogen. Der Werkmeister: <i>„PNP an die CPU, NPN an die SM 1221. Und keine Gruppe wird gemischt.“</i>',
  brief: '<ol><li><b>PNP an der CPU:</b> -B1 → -X2:5, -B2 → -X2:6, -B5 → -X2:9 (1M der CPU bleibt auf M).</li><li><b>NPN an der SM 1221:</b> -N1 → -X2:21 (%I16.0), 1M der SM 1221 auf <b>L+</b>. 2M bleibt auf M.</li><li>Einschalten, Funktionsprobe.</li><li>Variable <b>Ind_Auswerfer</b> (Bool, %I16.0) anlegen.</li><li>Programm anpassen: Der Auswerfer reagiert nicht mehr auf -B1, sondern auf <b>"Ind_Auswerfer"</b> – und nur, wenn das <b>Band läuft</b>. Volle Rutsche ("Rutsche_Voll") stoppt das Band und schaltet <b>"Lampe_Rot"</b> ein.</li><li>Laden, RUN.</li></ol>',
  learn: 'PNP- und NPN-Sensoren gemischt in einer Anlage anschliessen und das Programm anpassen.', take: 'Pro Eingangsgruppe eine Schaltart: PNP-Gruppe 1M auf M, NPN-Gruppe 1M auf L+. Variablentabelle und Programm folgen dem Klemmenplan.',
  man: 'klemmenplan', theory: 'st2b', hint: 'Zuerst die Verdrahtung, dann die Funktionsprobe – erst dann programmieren.', hint2: '"Auswerfer" := "Ind_Auswerfer" AND "Band"; "Lampe_Rot" := "Rutsche_Voll";',
  parts: ['S1', 'S2', 'B1', 'B2', 'B5', 'N1'], modules: ['A1', 'A4'], x2: [1, 2, 5, 6, 9, 21, 22], start: { base: 'sm1221', wires: [].concat(field('S1'), field('S2')) },
  steps: [
    { kind: 'wire', text: 'Drei PNP-Sensoren an die CPU, -N1 an die SM 1221, 1M der SM 1221 auf L+', target: [].concat(need('B1'), need('B2'), need('B5'), need('N1'), [{ net: ['A1:1M', 'POT:M'] }, { net: ['A4:1M', 'POT:L+'] }, { net: ['A4:2M', 'POT:M'] }]),
      ref: { remove: [['A4:1M', 'X1:M4']], add: [['A4:1M', 'X1:L+4']].concat(BOSS_SORT, w3('N1', 21)) },
      wrong: [{ add: BOSS_SORT.concat(w3('N1', 21)) }, { remove: [['A4:1M', 'X1:M4'], ['A1:1M', 'X1:M2']], add: [['A4:1M', 'X1:L+4'], ['A1:1M', 'X1:L+2']].concat(BOSS_SORT, w3('N1', 21)) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe: alle vier Sensoren schalten', cases: [{ world: { parts: { B1: 'stahl', B2: 'stahl', B5: 'stahl', N1: 'stahl' } }, di: { 'I0.4': true, 'I0.5': true, 'I1.0': true, 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I0.4': false, 'I0.5': false, 'I1.0': false, 'I16.0': false } }] },
    { kind: 'tags', text: 'Variable Ind_Auswerfer anlegen', require: [{ name: 'Ind_Auswerfer', type: 'Bool', addr: '%I16.0' }] },
    { kind: 'program', text: 'Sortierlogik anpassen', langs: ['scl', 'fup'],
      start: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Metall";\n',
        fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll" => "Band";\n\nNETWORK Auswerfer\n"Ind_Metall" => "Auswerfer";' },
      ref: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Auswerfer" AND "Band";\n"Lampe_Rot" := "Rutsche_Voll";\n',
        fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll" => "Band";\n\nNETWORK Auswerfer\n"Ind_Auswerfer" AND "Band" => "Auswerfer";\n\nNETWORK Rutsche voll\n"Rutsche_Voll" => "Lampe_Rot";' },
      timed: [{ steps: [[0, { Start: false, Stopp: true, Rutsche_Voll: false, Ind_Metall: false, Ind_Auswerfer: false }, { Band: false, Auswerfer: false, Lampe_Rot: false }], [0.05, { Start: true }, { Band: true }],
        [0.05, { Start: false, Ind_Metall: true }, { Band: true, Auswerfer: false }], [0.05, { Ind_Metall: false, Ind_Auswerfer: true }, { Auswerfer: true }], [0.05, { Ind_Auswerfer: false }, { Auswerfer: false }],
        [0.05, { Rutsche_Voll: true }, { Band: false, Lampe_Rot: true }], [0.05, { Rutsche_Voll: false, Ind_Auswerfer: true }, { Band: false, Auswerfer: false, Lampe_Rot: false }]] }],
      wrong: [{ scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Auswerfer";\n"Lampe_Rot" := "Rutsche_Voll";' },
        { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Metall" AND "Band";\n"Lampe_Rot" := "Rutsche_Voll";' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/m3.js ==== */
/* ===== SENSORWERKSTATT Modul 3: Sensortypen im Einsatz ===== */
(function(root){
const MAT = ['stahl', 'edelstahl', 'aluminium', 'messing', 'kunststoff_w', 'kunststoff_s', 'glas'];
const MAT_NAME = { stahl: 'Stahl', edelstahl: 'Edelstahl', aluminium: 'Aluminium', messing: 'Messing', kunststoff_w: 'Kunststoff weiss', kunststoff_s: 'Kunststoff schwarz', glas: 'Glas' };
const METALL = m => ['stahl', 'edelstahl', 'aluminium', 'messing'].includes(m);

// Sortierstrecke fertig, aber von ARIA verstellt (Boss Modul 3): -B1 zu weit, -B2 zu unempfindlich, -B4 verdreht
defPreset('m3_verstellt', { base: 'sortier_fertig', mounts: { B1: { dist: 4, tight: true }, B2: { dist: 4, tight: true, poti: 0.3 }, 'B4.1': { align: { h: 4, v: 1 } }, 'B4.2': { align: { h: -2, v: 5 } } } });

defWorkshopTask({ id: 'w3_schaltabstand', module: 3, no: 1, level: 'schnell', title: 'Wie weit schaut -B1?',
  story: 'Der Werkmeister legt ein Stahl- und ein Aluminiumteil auf das Band. <i>„Das Typenschild sagt Sn 8 mm. Für welches Material gilt das? Find es heraus – mit der Skala am Halter.“</i>',
  brief: '<p>Ermittle den Schaltabstand von <b>-B1</b> (induktiv, Sn 8 mm):</p><ol><li>-Q0 einschalten.</li><li>Kontermuttern lösen, ein Teil vor den Sensor legen und den Abstand in 0,5-mm-Schritten vergrössern, bis die gelbe LED ausgeht. Der letzte Abstand mit LED an ist der Schaltabstand.</li><li>Für <b>Stahl</b> und <b>Aluminium</b> ins Protokoll eintragen.</li><li>Zum Schluss wieder <b>4 mm</b> einstellen und festziehen.</li></ol>',
  learn: 'Den Schaltabstand eines induktiven Sensors für verschiedene Metalle ermitteln.', take: 'Sn gilt für Stahl (Normmessplatte). Andere Metalle verkürzen den Schaltabstand um den <b>Reduktionsfaktor</b> – bei Aluminium auf etwa 40 %.',
  man: 'indkap', theory: 'st3a', hint: 'Den Abstand am Regler schrittweise ändern und die Sensor-LED beobachten.', hint2: 'Aluminium schaltet deutlich früher ab als Stahl – rechne mit weniger als der Hälfte.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: { base: 'sortier_fertig', mounts: { B1: { dist: 6, tight: false } } },
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Schaltabstände ermitteln', ask: [
      { q: 'Schaltabstand Stahl', unit: 'mm', calc: (ctx, SM) => 8 * SM.MATERIALS.stahl.ind, tol: 0.5 },
      { q: 'Schaltabstand Aluminium', unit: 'mm', calc: (ctx, SM) => 8 * SM.MATERIALS.aluminium.ind, tol: 0.5 }] },
    { kind: 'mount', text: '-B1 wieder auf 4 mm einstellen und festziehen', part: 'B1', dist: [4, 0.25] },
    { kind: 'observe', text: 'Bei 4 mm: Stahl → %I0.4 = 1, Aluminium → %I0.4 = 0', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': false } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Für welches Material gilt der Nennschaltabstand Sn?', options: ['Stahl (Normmessplatte)', 'Aluminium', 'Jedes Metall gleich', 'Kunststoff'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w3_einbauabstand', module: 3, no: 2, level: 'schnell', title: 'Sicherer Einbauabstand',
  story: 'Ab morgen laufen auch Aluminiumteile über die Strecke. Der Werkmeister: <i>„Nicht auf Kante einstellen. Ein Sensor, der gerade so schaltet, fällt beim ersten warmen Tag aus.“</i>',
  brief: '<p>-B1: Sn = 8 mm. Reduktionsfaktoren (Richtwerte): Stahl 1,0 · Edelstahl 0,7 · Messing 0,5 · Aluminium 0,4.</p><p>Als Sicherheitsreserve nutzt du höchstens <b>80 %</b> des realen Schaltabstands (die Norm garantiert den <i>gesicherten Schaltabstand</i> Sa ≤ 0,81 · Sn).</p><ol><li>Rechne die Werte in den Arbeitsschritten.</li><li>Stelle -B1 auf den nächsten Skalenwert <b>unter</b> dem Ergebnis für Aluminium ein (Skala in 0,5-mm-Schritten).</li><li>Prüfe mit Aluminium und Stahl.</li></ol>',
  learn: 'Den Einbauabstand aus Sn, Reduktionsfaktor und Sicherheitsreserve berechnen.', take: 'Einbauabstand = Sn × Reduktionsfaktor × Sicherheitsfaktor. Bei mehreren Materialien bestimmt das <b>ungünstigste</b> den Abstand.',
  man: 'indkap', theory: 'st3a', hint: '8 mm × 0,4 = realer Schaltabstand für Aluminium. Davon 80 %.', hint2: '8 × 0,4 × 0,8 = 2,56 mm → auf der Skala 2,5 mm.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'quiz', text: 'Realer Schaltabstand für Aluminium (mm)?', answer: 3.2, tol: 0.05, unit: 'mm' },
    { kind: 'quiz', text: 'Mit 80 % Sicherheit: Einbauabstand für Aluminium (mm)?', answer: 2.56, tol: 0.05, unit: 'mm' },
    { kind: 'quiz', text: 'Mit 80 % Sicherheit: Einbauabstand für Edelstahl (mm)?', answer: 4.48, tol: 0.05, unit: 'mm' },
    { kind: 'quiz', text: 'Auf der Strecke laufen Stahl und Aluminium. Welcher Abstand gilt?', options: ['Der kleinere (Aluminium) – er deckt beide Materialien ab', 'Der grössere (Stahl)', 'Der Mittelwert', 'Sn = 8 mm'], correct: 0 },
    { kind: 'mount', text: '-B1 auf 2,5 mm einstellen und festziehen', part: 'B1', dist: [2.5, 0.01] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Aluminium und Stahl: %I0.4 = 1 · kein Teil: 0', cases: [{ world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] }
  ] });

defWorkshopTask({ id: 'w3_b2_poti', module: 3, no: 3, level: 'werkstatt', title: 'Kunststoff ja, Band nein',
  story: 'ARIA hat am Poti von <b>-B2</b> gedreht. Jetzt meldet der kapazitive Sensor dauernd „Teil da“ – auch bei leerem Band.',
  brief: '<p>Ein kapazitiver Sensor reagiert auf alles, was die Dielektrizitätszahl in seinem Feld ändert – auch auf das Gummiband. Mit dem <b>Poti</b> (Schraubendreher) stellst du die Empfindlichkeit ein.</p><ol><li>-Q0 einschalten, leeres Band: LED an -B2 muss aus sein.</li><li>Empfindlichkeit so einstellen, dass <b>Kunststoff weiss und schwarz</b> erkannt werden, das <b>Band nicht</b>.</li></ol>',
  learn: 'Die Empfindlichkeit eines kapazitiven Sensors mit dem Poti einstellen.', take: 'Kapazitiv erkennt auch Nichtmetalle. Zu empfindlich → Band oder Behälterwand schalten mit. Einstellen: leer → aus, mit Teil → an, dann eine kleine Reserve.',
  man: 'indkap', theory: 'st3a', hint: 'Zu empfindlich: Poti zurückdrehen, bis die LED bei leerem Band ausgeht.', hint2: 'Kunststoff braucht etwa „mittel“ (0,5), das Band schaltet erst ab 0,7. Dazwischen liegt dein Fenster.',
  parts: ['B2'], modules: ['A1'], x2: [6], start: { base: 'sortier_fertig', mounts: { B2: { dist: 4, tight: true, poti: 0.8 } } },
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'mount', text: 'Empfindlichkeit von -B2 einstellen', part: 'B2', poti: [0.5, 0.65], ref: { poti: 0.55 } },
    { kind: 'observe', text: 'Kunststoff weiss/schwarz → %I0.5 = 1 · leeres Band → 0', cases: [{ world: { parts: { B2: 'kunststoff_w' } }, di: { 'I0.5': true } }, { world: { parts: { B2: 'kunststoff_s' } }, di: { 'I0.5': true } }, { world: {}, di: { 'I0.5': false } }] },
    { kind: 'quiz', text: 'Warum erkennt -B2 auch Stahl?', options: ['Metall ändert das elektrische Feld sehr stark – kapazitive Sensoren erkennen fast alles', 'Weil -B2 eigentlich ein induktiver Sensor ist', 'Weil Stahl magnetisch ist', 'Er erkennt Stahl nicht'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w3_b3_teach', module: 3, no: 4, level: 'werkstatt', title: 'Hintergrund ausblenden',
  story: 'Der Lichttaster <b>-B3</b> schaut von oben auf das Band. Seit ARIA ihn verschoben hat, sieht er das Band selbst als „Teil“.',
  brief: '<p>-B3 ist ein Lichttaster mit <b>Hintergrundausblendung</b>: Alles, was weiter weg ist als die eingelernte Distanz, wird ignoriert.</p><ol><li>Kontermuttern lösen, -B3 auf <b>60 mm</b> über dem Band einstellen, festziehen.</li><li>Bei <b>leerem Band</b> die Teach-Taste drücken (Hintergrund = Band).</li><li>-Q0 einschalten und prüfen: Teil (auch schwarz) → %I0.6 = 1, leeres Band → 0.</li><li>Schaltfunktion wählen (Frage).</li></ol>',
  learn: 'Einen Lichttaster mit Hintergrundausblendung per Teach-in einstellen.', take: 'Hintergrundausblendung misst die Entfernung, nicht die Helligkeit. Darum erkennt -B3 auch schwarze Teile sicher, solange der Hintergrund richtig eingelernt ist.',
  man: 'optisch', theory: 'st3a', hint: 'Erst den Abstand einstellen und festziehen, dann teachen. Wer danach verschiebt, muss neu teachen.', hint2: 'Hellschaltend: Ausgang 1, wenn Licht vom Objekt zurückkommt – also wenn ein Teil da ist.',
  parts: ['B3'], modules: ['A1'], x2: [7], start: { base: 'sortier_fertig', mounts: { B3: { dist: 90, tight: false } } },
  steps: [
    { kind: 'mount', text: '-B3 auf 60 mm, festziehen, Hintergrund einlernen', part: 'B3', dist: [60, 5], teach: true },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Kunststoff schwarz und Stahl → %I0.6 = 1 · leeres Band → 0', cases: [{ world: { parts: { B3: 'kunststoff_s' } }, di: { 'I0.6': true } }, { world: { parts: { B3: 'stahl' } }, di: { 'I0.6': true } }, { world: {}, di: { 'I0.6': false } }] },
    { kind: 'quiz', text: '"Taster_Hell" soll 1 sein, wenn ein Teil da ist. Welche Schaltfunktion stellst du ein?', options: ['Hellschaltend (Licht vom Objekt → Ausgang 1)', 'Dunkelschaltend', 'Antivalent', 'Egal, das Programm dreht es um'], correct: 0 },
    { kind: 'quiz', text: 'Warum teacht man bei leerem Band?', options: ['Der Sensor lernt die Distanz zum Hintergrund und blendet alles ab dort aus', 'Damit der Sensor die Farbe des Teils lernt', 'Damit die LED heller wird', 'Weil Teach mit Teil nicht möglich ist'], correct: 0 }
  ] });

const SORT_TAG = [{ name: 'Ist_Metall', type: 'Bool', addr: '%M10.0', comment: 'Merker: Teil ist Metall' }];
defWorkshopTask({ id: 'w3_materialsortierung', module: 3, no: 5, level: 'schnell', title: 'Materialsortierung',
  story: 'Metall in Rutsche A, Kunststoff in Behälter B. ARIA findet: <i>„Einfach auswerfen, sobald -B1 etwas sieht.“</i> Blöd nur, dass -B1 weit vor dem Auswerfer sitzt.',
  brief: '<p>-B1 erkennt Metall am Anfang des Bandes. Der Auswerfer sitzt weiter hinten, dort meldet die Einweg-Lichtschranke <b>"LS_Band"</b> ein Teil.</p><ul><li>Sieht "Ind_Metall" ein Teil, merkst du dir das in <b>"Ist_Metall"</b> (%M10.0).</li><li>Kommt das Teil bei "LS_Band" an und "Ist_Metall" ist gesetzt → <b>"Auswerfer"</b> = 1 (Rutsche A).</li><li>Meldet <b>"Zyl_Vorne"</b> die vordere Endlage, wird "Ist_Metall" gelöscht – der Auswerfer fährt zurück.</li><li>Kunststoffteile laufen ohne Auswerfen durch in Behälter B.</li></ul>',
  learn: 'Eine Sensorinformation speichern und an einer späteren Position auswerten.', take: 'Sensor und Aktor sitzen selten an derselben Stelle. Die Information „Metall“ muss gespeichert und nach dem Auswerfen gelöscht werden.',
  man: 'indkap', theory: 'st3a', hint: 'SCL: IF "Ind_Metall" THEN "Ist_Metall" := TRUE; END_IF; — FUP: S "Ist_Metall".', hint2: '"Auswerfer" := "LS_Band" AND "Ist_Metall"; und danach bei "Zyl_Vorne" den Merker zurücksetzen.',
  parts: ['B1', 'B2', 'B4.1', 'B4.2', 'B7'], modules: ['A1'], x2: [5, 6, 8, 11], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Materialsortierung programmieren', langs: ['scl', 'fup'], tagsExtra: SORT_TAG,
      start: { scl: '"Auswerfer" := "Ind_Metall";\n', fup: 'NETWORK Auswerfen\n"Ind_Metall" => "Auswerfer";' },
      ref: { scl: 'IF "Ind_Metall" THEN\n  "Ist_Metall" := TRUE;\nEND_IF;\n"Auswerfer" := "LS_Band" AND "Ist_Metall";\nIF "Zyl_Vorne" THEN\n  "Ist_Metall" := FALSE;\nEND_IF;\n',
        fup: 'NETWORK Metall merken\n"Ind_Metall" => S "Ist_Metall";\n\nNETWORK Auswerfen\n"LS_Band" AND "Ist_Metall" => "Auswerfer";\n\nNETWORK Merker loeschen\n"Zyl_Vorne" => R "Ist_Metall";' },
      timed: [{ steps: [[0, { Ind_Metall: false, LS_Band: false, Zyl_Vorne: false }, { Auswerfer: false, Ist_Metall: false }], [0.05, { Ind_Metall: true }, { Auswerfer: false, Ist_Metall: true }], [0.05, { Ind_Metall: false }, { Auswerfer: false, Ist_Metall: true }],
        [0.05, { LS_Band: true }, { Auswerfer: true }], [0.05, { Zyl_Vorne: true }, { Ist_Metall: false }], [0.05, {}, { Auswerfer: false }], [0.05, { LS_Band: false, Zyl_Vorne: false }, { Auswerfer: false }],
        [0.05, { LS_Band: true }, { Auswerfer: false }], [0.05, { LS_Band: false }, { Auswerfer: false, Ist_Metall: false }]] }],
      wrong: [{ scl: '"Auswerfer" := "LS_Band" AND "Ind_Metall";' }, { scl: 'IF "Ind_Metall" THEN\n  "Ist_Metall" := TRUE;\nEND_IF;\n"Auswerfer" := "LS_Band" AND "Ist_Metall";' }] },
    { kind: 'load', text: 'In das Gerät laden und CPU starten' }
  ] });

defWorkshopTask({ id: 'w3_einweg', module: 3, no: 6, level: 'werkstatt', title: 'Einweg-Lichtschranke ausrichten',
  story: 'Jemand hat sich an Sender und Empfänger von <b>-B4</b> abgestützt. Jetzt meldet die Lichtschranke dauernd „unterbrochen“ – und für nächste Woche sind Glasteile angekündigt.',
  brief: '<p>Richte Sender <b>-B4.1</b> und Empfänger <b>-B4.2</b> mit den Rändelschrauben (Schraubendreher) aus, bis die <b>Stabilitäts-LED ruhig</b> leuchtet. Blinkt sie, ist die Funktionsreserve knapp.</p><p>Prüfe danach mit Stahl und Glas und beantworte die Fragen.</p>',
  learn: 'Eine Einweg-Lichtschranke ausrichten und die Funktionsreserve beurteilen.', take: 'Stabilitäts-LED ruhig = genug Funktionsreserve. Die Einweg-Lichtschranke wertet nur aus, ob der Strahl ankommt – das macht sie robust, auch bei Glas.',
  man: 'optisch', theory: 'st3b', hint: 'Zuerst einen der beiden ausrichten, bis die LED blinkt, dann den zweiten nachstellen, bis sie ruhig ist.', hint2: 'Beide Geräte müssen genau aufeinander zeigen (Abweichung höchstens 1 Rastung).',
  parts: ['B4.1', 'B4.2'], modules: ['A1'], x2: [8], start: { base: 'sortier_fertig', mounts: { 'B4.1': { align: { h: 3, v: 0 } }, 'B4.2': { align: { h: -5, v: 2 } } } },
  steps: [
    { kind: 'mount', text: 'Sender -B4.1 ausrichten', part: 'B4.1', align: true, tight: false },
    { kind: 'mount', text: 'Empfänger -B4.2 ausrichten', part: 'B4.2', align: true, tight: false },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Freier Strahl → %I0.7 = 0 · Stahl und Glas → %I0.7 = 1', cases: [{ world: {}, di: { 'I0.7': false } }, { world: { parts: { B4: 'stahl' } }, di: { 'I0.7': true } }, { world: { parts: { B4: 'glas' } }, di: { 'I0.7': true } }] },
    { kind: 'quiz', text: 'Die Stabilitäts-LED blinkt. Was bedeutet das?', options: ['Knappe Funktionsreserve – bei Staub oder Vibration fällt das Signal aus', 'Die Lichtschranke ist defekt', 'Ein Teil liegt im Strahl', 'Alles optimal'], correct: 0 },
    { kind: 'quiz', text: 'Warum ist die Einweg-Lichtschranke bei Glas im Vorteil gegenüber der Reflexions-Lichtschranke?', options: ['Sie wertet nur aus, ob der Strahl beim Empfänger ankommt – Spiegelungen an der Glasoberfläche können keinen Reflektor vortäuschen', 'Sie ist heller', 'Glas ist für Einweg-Licht undurchsichtig', 'Sie braucht keine Ausrichtung'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w3_zylinderschalter', module: 3, no: 7, level: 'werkstatt', title: 'Endlagen setzen',
  story: 'Die Zylinderschalter <b>-B6</b> und <b>-B7</b> am Auswerfer sind locker und in der Nut verrutscht. Der Auswerfer fährt, aber die SPS weiss nicht, wo er ist.',
  brief: '<p>Zylinderschalter reagieren auf den Magneten im Kolben. Die Endlagen liegen bei <b>5 mm</b> (hinten) und <b>35 mm</b> (vorne) auf der Nutskala.</p><ol><li>Mit dem Schraubendreher die Klemmschraube lösen, <b>-B6</b> auf 5 mm schieben, festklemmen.</li><li><b>-B7</b> auf 35 mm, festklemmen.</li><li>Einschalten und prüfen: Zylinder hinten → %I1.1, vorne → %I1.2.</li></ol>',
  learn: 'Magnetische Zylinderschalter auf die Endlagen einstellen.', take: 'Zylinderschalter sitzen in der T-Nut und schalten, wenn der Kolbenmagnet darunter ist. Genau auf die Endlage setzen – und festklemmen, sonst wandern sie.',
  man: 'zylinder', theory: 'st3b', hint: 'Werkzeug: Schraubendreher. Erst lösen, dann schieben, dann festziehen.', hint2: 'Hinten = eingefahren = 5 mm. Vorne = ausgefahren = 35 mm.',
  parts: ['B6', 'B7'], modules: ['A1'], x2: [10, 11], start: { base: 'sortier_fertig', mounts: { B6: { dist: 15, tight: false }, B7: { dist: 22, tight: false } } },
  steps: [
    { kind: 'mount', text: '-B6 auf 5 mm festklemmen', part: 'B6', dist: [5, 1] },
    { kind: 'mount', text: '-B7 auf 35 mm festklemmen', part: 'B7', dist: [35, 1] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Hinten: %I1.1 = 1, %I1.2 = 0 · vorne: %I1.1 = 0, %I1.2 = 1 · unterwegs: beide 0', cases: [{ world: { cyl: 'hinten' }, di: { 'I1.1': true, 'I1.2': false } }, { world: { cyl: 'vorne' }, di: { 'I1.1': false, 'I1.2': true } }, { world: {}, di: { 'I1.1': false, 'I1.2': false } }] },
    { kind: 'quiz', text: 'Worauf reagiert ein Zylinderschalter?', options: ['Auf den Magnetring im Kolben', 'Auf das Metall des Zylinderrohrs', 'Auf den Luftdruck', 'Auf Licht'], correct: 0 }
  ] });

const UEB_TAGS = [{ name: 'Befehl_Auswerfen', type: 'Bool', addr: '%M10.0', comment: 'Auswerfen angefordert (Sortierlogik)' }, { name: 'Quittieren', type: 'Bool', addr: '%M10.1', comment: 'HMI Taste Quittieren' }];
const UEB_KOP = 'NETWORK Auswerfer\n"Befehl_Auswerfen" AND NOT "Lampe_Rot" => "Auswerfer";\n\nNETWORK Ueberwachung vorne\n"Auswerfer" AND NOT "Zyl_Vorne" AND TON(T_Vorne, T#2S) => S "Lampe_Rot";\n\nNETWORK Ueberwachung hinten\nNOT "Auswerfer" AND NOT "Zyl_Hinten" AND TON(T_Hinten, T#2S) => S "Lampe_Rot";\n\nNETWORK Quittieren\n"Quittieren" => R "Lampe_Rot";';
const UEB_START_KOP = 'NETWORK Auswerfer\n"Befehl_Auswerfen" => "Auswerfer";';
defWorkshopTask({ id: 'w3_endlagen_ueberwachung', module: 3, no: 8, level: 'werkstatt', title: 'Endlagen überwachen',
  story: 'Ein Teil hat sich verklemmt, der Auswerfer kam nicht nach vorne – und die Anlage hat einfach weitergemacht. ARIA kichert. Der Werkmeister: <i>„Wofür haben wir Zylinderschalter?“</i>',
  brief: '<p>Programmiere den Auswerfer mit <b>Endlagen-Zeitüberwachung</b>:</p><ul><li><b>"Auswerfer"</b> = <b>"Befehl_Auswerfen"</b> (%M10.0), aber nicht bei Störung.</li><li>Auswerfer ein, aber <b>"Zyl_Vorne"</b> kommt nicht innerhalb von <b>2 s</b> → Störung.</li><li>Auswerfer aus, aber <b>"Zyl_Hinten"</b> kommt nicht innerhalb von <b>2 s</b> → Störung.</li><li>Störung = <b>"Lampe_Rot"</b> bleibt an (gespeichert), bis <b>"Quittieren"</b> (%M10.1) kommt.</li></ul><p>Zeitinstanzen: <b>"T_Vorne"</b> und <b>"T_Hinten"</b> (TON).</p>',
  learn: 'Endlagen eines Zylinders mit Zeitüberwachung auswerten und eine Störung speichern.', take: 'Eine Endlagenüberwachung vergleicht Befehl und Rückmeldung. Kommt die Rückmeldung nicht in der erwarteten Zeit, klemmt etwas, ist defekt oder verstellt.',
  man: 'zylinder', theory: 'st3b', hint: '"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);', hint2: 'Die Störung setzt du mit IF … THEN "Lampe_Rot" := TRUE; und löschst sie nur mit "Quittieren".',
  parts: ['B6', 'B7'], modules: ['A1'], x2: [10, 11], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Auswerfer mit Endlagenüberwachung', langs: ['scl', 'fup'], fb: { T_Vorne: 'TON', T_Hinten: 'TON' }, tagsExtra: UEB_TAGS,
      start: { scl: '"Auswerfer" := "Befehl_Auswerfen";\n', fup: UEB_START_KOP },
      ref: { scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);\n"T_Hinten"(IN := NOT "Auswerfer" AND NOT "Zyl_Hinten", PT := T#2S);\nIF "T_Vorne".Q OR "T_Hinten".Q THEN\n  "Lampe_Rot" := TRUE;\nEND_IF;\nIF "Quittieren" THEN\n  "Lampe_Rot" := FALSE;\nEND_IF;\n',
        fup: UEB_KOP },
      timed: [
        { steps: [[0, { Befehl_Auswerfen: false, Zyl_Hinten: true, Zyl_Vorne: false, Quittieren: false }, { Auswerfer: false, Lampe_Rot: false }], [0.5, { Befehl_Auswerfen: true }, { Auswerfer: true, Lampe_Rot: false }],
          [0.5, { Zyl_Hinten: false }, { Auswerfer: true, Lampe_Rot: false }], [0.5, { Zyl_Vorne: true }, { Lampe_Rot: false }], [0.5, { Befehl_Auswerfen: false }, { Auswerfer: false }], [0.5, { Zyl_Vorne: false }, { Lampe_Rot: false }],
          [0.5, { Zyl_Hinten: true }, { Lampe_Rot: false }],
          [0.5, { Befehl_Auswerfen: true }, { Auswerfer: true, Lampe_Rot: false }], [1.0, {}, { Lampe_Rot: false }], [0.9, {}, { Lampe_Rot: false }], [0.2, {}, { Lampe_Rot: true }],
          [0.05, {}, { Auswerfer: false, Lampe_Rot: true }], [0.05, { Quittieren: true }, { Lampe_Rot: false }], [0.05, { Quittieren: false, Befehl_Auswerfen: false }, { Auswerfer: false, Lampe_Rot: false }]] },
        { steps: [[0, { Befehl_Auswerfen: true, Zyl_Hinten: false, Zyl_Vorne: true, Quittieren: false }, { Auswerfer: true, Lampe_Rot: false }], [0.5, { Befehl_Auswerfen: false }, { Auswerfer: false, Lampe_Rot: false }],
          [1.0, {}, { Lampe_Rot: false }], [1.1, {}, { Lampe_Rot: true }]] }],
      wrong: [{ scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);\n"T_Hinten"(IN := NOT "Auswerfer" AND NOT "Zyl_Hinten", PT := T#2S);\n"Lampe_Rot" := "T_Vorne".Q OR "T_Hinten".Q;' },
        { scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);\nIF "T_Vorne".Q THEN\n  "Lampe_Rot" := TRUE;\nEND_IF;\nIF "Quittieren" THEN\n  "Lampe_Rot" := FALSE;\nEND_IF;' },
        { scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#5S);\n"T_Hinten"(IN := NOT "Auswerfer" AND NOT "Zyl_Hinten", PT := T#5S);\nIF "T_Vorne".Q OR "T_Hinten".Q THEN\n  "Lampe_Rot" := TRUE;\nEND_IF;\nIF "Quittieren" THEN\n  "Lampe_Rot" := FALSE;\nEND_IF;' }] },
    { kind: 'load', text: 'Laden und starten' }
  ] });

defWorkshopTask({ id: 'w3_fehler_alu', module: 3, no: 9, level: 'werkstatt', title: 'Alu wird nicht erkannt', debug: true,
  story: 'Die Qualitätskontrolle meldet: Aluminiumteile landen im Kunststoffbehälter. Stahl wird sauber aussortiert. ARIA: <i>„Metall ist Metall, oder?“</i>',
  brief: '<p>Finde heraus, warum -B1 Aluminium nicht erkennt, Stahl aber schon – und behebe es. Sicherer Einbauabstand für Aluminium: siehe Aufgabe 2.</p>',
  learn: 'Einen Montagefehler am induktiven Sensor über den Reduktionsfaktor erkennen.', take: 'Stahl ja, Aluminium nein: Der Abstand liegt zwischen den beiden Schaltabständen. Lose Kontermuttern lassen den Sensor wandern – immer festziehen.',
  man: 'indkap', theory: 'st3b', hint: 'Schau dir -B1 an: Wie gross ist der Abstand zum Teil?', hint2: 'Aluminium: 8 mm × 0,4 = 3,2 mm, mit Reserve 2,5 mm. Und die Muttern festziehen!',
  parts: ['B1'], modules: ['A1'], x2: [5], start: { base: 'sortier_fertig', mainSwitch: true, mounts: { B1: { dist: 6, tight: false } } },
  symptom: { cases: [{ world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': false } }, { world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }] },
  steps: [
    { kind: 'mount', text: '-B1 auf sicheren Abstand für Aluminium einstellen und festziehen', part: 'B1', dist: [2.5, 0.5] },
    { kind: 'observe', text: 'Aluminium, Messing und Stahl → %I0.4 = 1 · kein Teil → 0', cases: [{ world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'messing' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Was war die Ursache?', options: ['Abstand 6 mm: grösser als der Schaltabstand für Aluminium (3,2 mm), aber kleiner als für Stahl (8 mm) – dazu lose Kontermuttern', 'Der Sensor war defekt', '1M lag auf L+', 'Aluminium ist nicht leitfähig'], correct: 0 }
  ] });

// Logiktabelle: Ind (B1), Kap (B2), LS (B4) je Werkstück nach der Einstellung
const SIG = m => ({ 'I0.4': METALL(m), 'I0.5': m !== 'glas', 'I0.7': true });
const ART_REF_KOP = 'NETWORK Kein Teil\n=> MOVE(0, "Teil_Art");\n\nNETWORK Glas\n"LS_Band" => MOVE(3, "Teil_Art");\n\nNETWORK Kunststoff\n"Kap_Teil" => MOVE(2, "Teil_Art");\n\nNETWORK Metall\n"Ind_Metall" => MOVE(1, "Teil_Art");\n\nNETWORK Auswerfer\n"Ind_Metall" => "Auswerfer";\n\nNETWORK Glas melden\n"LS_Band" AND NOT "Kap_Teil" AND NOT "Ind_Metall" => "Lampe_Rot";';
const ART_START_KOP = 'NETWORK Auswerfer\n"Ind_Metall" => "Auswerfer";';
const tc = (ind, kap, ls, art) => [0.05, { Ind_Metall: ind, Kap_Teil: kap, LS_Band: ls }, { Teil_Art: art, Auswerfer: art === 1, Lampe_Rot: art === 3 }];
defWorkshopTask({ id: 'w3_boss_sieben', module: 3, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Sieben Werkstoffe',
  story: 'Grossauftrag: Stahl, Edelstahl, Aluminium, Messing, Kunststoff weiss und schwarz – und Glas. ARIA hat vorher noch schnell alle Sensoren verstellt. Der Werkmeister: <i>„Jedes Teil an seinen Platz. Glas gehört gar nicht auf diese Strecke – das will ich gemeldet haben.“</i>',
  brief: '<p>Am Prüfplatz schauen drei Sensoren auf dasselbe Teil: <b>-B1</b> induktiv ("Ind_Metall"), <b>-B2</b> kapazitiv ("Kap_Teil"), <b>-B4</b> Einweg-Lichtschranke ("LS_Band").</p><ol><li><b>-B1</b> so einstellen, dass <b>alle vier Metalle</b> sicher erkannt werden (Einbauabstand für das ungünstigste Metall).</li><li><b>-B2</b>: Kunststoff ja, Band nein.</li><li><b>-B4.1/-B4.2</b> ausrichten.</li><li>Funktionsprobe mit allen sieben Werkstoffen, dann die Logiktabelle in den Arbeitsschritten ausfüllen.</li><li>Programm: <b>"Teil_Art"</b> (Int, %MW20, HMI): 0 = kein Teil, 1 = Metall, 2 = Kunststoff, 3 = Glas. Metall → <b>"Auswerfer"</b> (Rutsche A), Kunststoff läuft in Behälter B, Glas → <b>"Lampe_Rot"</b>.</li><li>Laden, RUN.</li></ol>',
  learn: 'Sensoren nach Werkstoff auswählen und einstellen, eine Logiktabelle aufstellen und programmieren.', take: 'Kein Sensor kann alles. Erst die Kombination (induktiv, kapazitiv, optisch) unterscheidet die Werkstoffe – die Logiktabelle ist der Bauplan für das Programm.',
  man: 'indkap', theory: 'st3b', hint: 'Das ungünstigste Metall ist Aluminium (Faktor 0,4). Die Tabelle: Wer schaltet bei Glas?', hint2: 'Prioritäten im Programm: Metall vor Kunststoff vor Glas. Ein Metallteil schaltet auch den kapazitiven Sensor und die Lichtschranke.',
  parts: ['B1', 'B2', 'B4.1', 'B4.2'], modules: ['A1'], x2: [5, 6, 8], start: 'preset:m3_verstellt',
  steps: [
    { kind: 'mount', text: '-B1: sicherer Abstand für alle Metalle', part: 'B1', dist: [2.5, 0.5] },
    { kind: 'mount', text: '-B2: Kunststoff ja, Band nein', part: 'B2', poti: [0.5, 0.65], ref: { poti: 0.55 } },
    { kind: 'mount', text: '-B4.1 ausrichten', part: 'B4.1', align: true, tight: false },
    { kind: 'mount', text: '-B4.2 ausrichten', part: 'B4.2', align: true, tight: false },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe: sieben Werkstoffe und leeres Band', cases: MAT.map(m => ({ text: MAT_NAME[m], world: { parts: { B1: m, B2: m, B4: m } }, di: SIG(m) })).concat([{ text: 'Leeres Band', world: {}, di: { 'I0.4': false, 'I0.5': false, 'I0.7': false } }]) },
    { kind: 'quiz', text: 'Logiktabelle: Welche Sensoren schalten bei Aluminium? (Ind / Kap / LS)', options: ['1 / 1 / 1', '1 / 0 / 1', '0 / 1 / 1', '0 / 0 / 1'], correct: 0 },
    { kind: 'quiz', text: 'Logiktabelle: … bei Kunststoff schwarz?', options: ['0 / 1 / 1', '1 / 1 / 1', '0 / 0 / 1', '0 / 0 / 0'], correct: 0 },
    { kind: 'quiz', text: 'Logiktabelle: … bei Glas?', options: ['0 / 0 / 1', '0 / 1 / 1', '0 / 0 / 0', '1 / 0 / 1'], correct: 0 },
    { kind: 'quiz', text: 'Kann die Strecke mit diesen drei Sensoren Stahl von Aluminium unterscheiden?', options: ['Nein – beide schalten alle drei Sensoren', 'Ja, über den kapazitiven Sensor', 'Ja, über die Lichtschranke', 'Ja, Aluminium schaltet -B1 nicht'], correct: 0 },
    { kind: 'program', text: 'Werkstoff erkennen und sortieren', langs: ['scl', 'fup'], tagsExtra: [{ name: 'Teil_Art', type: 'Int', addr: '%MW20', comment: 'HMI: 0 kein Teil, 1 Metall, 2 Kunststoff, 3 Glas' }],
      start: { scl: '"Auswerfer" := "Ind_Metall";\n', fup: ART_START_KOP },
      ref: { scl: 'IF "Ind_Metall" THEN\n  "Teil_Art" := 1;\nELSIF "Kap_Teil" THEN\n  "Teil_Art" := 2;\nELSIF "LS_Band" THEN\n  "Teil_Art" := 3;\nELSE\n  "Teil_Art" := 0;\nEND_IF;\n"Auswerfer" := "Teil_Art" = 1;\n"Lampe_Rot" := "Teil_Art" = 3;\n',
        fup: ART_REF_KOP },
      timed: [{ steps: [tc(false, false, false, 0), tc(true, true, true, 1), tc(false, false, false, 0), tc(false, true, true, 2), tc(false, false, true, 3), tc(false, false, false, 0)] }],
      wrong: [{ scl: 'IF "LS_Band" THEN\n  "Teil_Art" := 3;\nELSIF "Kap_Teil" THEN\n  "Teil_Art" := 2;\nELSIF "Ind_Metall" THEN\n  "Teil_Art" := 1;\nELSE\n  "Teil_Art" := 0;\nEND_IF;\n"Auswerfer" := "Teil_Art" = 1;\n"Lampe_Rot" := "Teil_Art" = 3;' },
        { scl: 'IF "Ind_Metall" THEN\n  "Teil_Art" := 1;\nELSIF "Kap_Teil" THEN\n  "Teil_Art" := 2;\nELSIF "LS_Band" THEN\n  "Teil_Art" := 3;\nEND_IF;\n"Auswerfer" := "Teil_Art" = 1;\n"Lampe_Rot" := "Teil_Art" = 3;' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/m4.js ==== */
/* ===== SENSORWERKSTATT Modul 4: Analogsignale verstehen ===== */
(function(root){
/* Analogverdrahtung der Tankstation (Klemmenplan): 4–20 mA über Trennklemmen -X3:1…3, 0–10 V über -X3:4.
   2-Leiter: L+ → T+ ; T− → -X3:n.a ; -X3:n.b → AI x+ ; AI x− → M.  4-Leiter -B13: eigene Versorgung, I+ → -X3:3 → AI 2+, I− → AI 2−.
   -B10: BN → L+, BU → M, BK → -X3:4 → CPU AI0, 2M → M.  -R1: 1 → L+, 2 (Schleifer) → AI1, 3 → M. */
const AW = {
  B10: [['B10:BN', 'X1:L+6'], ['B10:BU', 'X1:M5'], ['B10:BK', 'X3:4.a'], ['X3:4.b', 'A1:AI0'], ['A1:2M', 'X1:M6']],
  B11: [['B11:+', 'X1:L+2'], ['B11:-', 'X3:1.a'], ['X3:1.b', 'A2:0+'], ['A2:0-', 'X1:M7']],
  B12: [['B12:+', 'X1:L+4'], ['B12:-', 'X3:2.a'], ['X3:2.b', 'A2:1+'], ['A2:1-', 'X1:M8']],
  B13: [['B13:L+', 'X1:L+5'], ['B13:M', 'X1:M1'], ['B13:I+', 'X3:3.a'], ['X3:3.b', 'A2:2+'], ['B13:I-', 'A2:2-']],
  R1:  [['R1:1', 'X1:L+7'], ['R1:2', 'A1:AI1'], ['R1:3', 'X1:M4']]
};
// Funktionsanforderungen (Plan 3.5): Schleife geschlossen, über die Trennklemme geführt
const NEED = {
  B10: [{ net: ['B10:BN', 'POT:L+'] }, { net: ['B10:BU', 'POT:M'] }, { net: ['B10:BK', 'AI:AI0'] }, { net: ['A1:2M', 'POT:M'], msg: 'Bezugspotential 2M der CPU-Analogeingänge liegt nicht auf M.' }],
  B11: [{ net: ['B11:+', 'POT:L+'] }, { net: ['B11:-', 'X3:1.a'] }, { net: ['B11:-', 'AI:CH0+'] }, { net: ['AI:CH0-', 'POT:M'], msg: '-B11: Stromschleife nicht geschlossen (Rückleiter AI 0− → M).' }],
  B12: [{ net: ['B12:+', 'POT:L+'] }, { net: ['B12:-', 'X3:2.a'] }, { net: ['B12:-', 'AI:CH1+'] }, { net: ['AI:CH1-', 'POT:M'], msg: '-B12: Stromschleife nicht geschlossen (Rückleiter AI 1− → M).' }],
  B13: [{ net: ['B13:L+', 'POT:L+'] }, { net: ['B13:M', 'POT:M'] }, { net: ['B13:I+', 'X3:3.a'] }, { net: ['B13:I+', 'AI:CH2+'] }, { net: ['B13:I-', 'AI:CH2-'] }, { notNet: ['B13:I-', 'POT:L+'] }],
  R1:  [{ net: ['R1:1', 'POT:L+'] }, { net: ['R1:3', 'POT:M'] }, { net: ['R1:2', 'AI:AI1'] }]
};
const all = ids => [].concat(...ids.map(id => AW[id]));
// Kapitel (falls chapters.js die Module 4–6 noch nicht definiert)
const A = inner => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
const ramp = label => '<path d="M30 130 L270 30" stroke="#ffb000" stroke-width="3" fill="none"/><path d="M30 130 H270 M30 130 V20" stroke="#8aa0b4" stroke-width="2"/>'
  + '<circle cx="150" cy="80" r="5" fill="#ffd21e"><animate attributeName="cx" values="30;270;30" dur="4s" repeatCount="indefinite"/><animate attributeName="cy" values="130;30;130" dur="4s" repeatCount="indefinite"/></circle>'
  + '<text x="150" y="152" text-anchor="middle" font-size="10" fill="#ffb000">' + label + '</text>';
const chap = o => { const C = root.SCL_CONTENT; if(!C || !C.chapters.some(c => c.n === o.n)) defChapter(o); };
root.SW_CHAPTER = chap; root.SW_CHAPTER_ANIM = l => A(ramp(l));
chap({ n:4, title:'Analogsignale verstehen', subtitle:'0–10 V · 4–20 mA · Rohwert', icon:'fa-wave-square',
  intro:'Die Tankstation erwacht: Ultraschall, Druck, Temperatur, Durchfluss. Hier gibt es kein 0 und 1 mehr, sondern alles dazwischen. ARIA hat die Analogleitungen gezogen. <i>„Strom ist das Signal“</i>, sagt der Werkmeister, <i>„und 27648 ist die wichtigste Zahl der Woche.“</i>',
  anim: A(ramp('4 mA → 0 · 20 mA → 27648')) });

root.SW_ANALOG = { AW, NEED, all };
const HW_OFF = ch => ({ ['ai.' + ch]: { type: 'off', range: '4..20mA', smooth: 'keine', diag: { wireBreak: false, over: false, under: false } } });
root.SW_ANALOG.HW_OFF = HW_OFF;
// HMI-/Hilfsvariablen der Tankstation (Real %MD…) und Skalierungsbausteine für SCL/FUP
const REAL = (name, addr, comment) => ({ name, type: 'Real', addr, comment });
const TG = { Fuellstand_mm: REAL('Fuellstand_mm', '%MD20', 'HMI Füllstand (Ultraschall)'), Druck_mbar: REAL('Druck_mbar', '%MD24', 'HMI Druck'), Temp_C: REAL('Temp_C', '%MD28', 'HMI Temperatur'),
  Durchfluss_lmin: REAL('Durchfluss_lmin', '%MD32', 'HMI Durchfluss'), Hilf_Norm: REAL('Hilf_Norm', '%MD36', 'Zwischenwert NORM_X (0…1)'), Abstand_mm: REAL('Abstand_mm', '%MD40', 'Abstand -B10 zur Oberfläche'),
  Pegel_mm: REAL('Pegel_mm', '%MD44', 'Pegel aus Druck'), Pumpe_Prozent: REAL('Pumpe_Prozent', '%MD48', 'HMI Pumpendrehzahl %'), Ventil_Prozent: REAL('Ventil_Prozent', '%MD52', 'HMI Stellventil %'),
  Ventil_Begrenzt: REAL('Ventil_Begrenzt', '%MD56', 'Stellventil begrenzt 0…100 %'), Diff_mm: REAL('Diff_mm', '%MD60', 'Differenz Ultraschall − Druck'), Sollwert_Prozent: REAL('Sollwert_Prozent', '%MD64', 'Sollwertsteller -R1 %') };
const tg = (...n) => n.map(k => Object.assign({}, TG[k]));
const bool = (name, addr, comment) => ({ name, type: 'Bool', addr, comment });
const sclS = (raw, lo, hi, out) => '"' + out + '" := SCALE_X(MIN := ' + lo + ', VALUE := NORM_X(MIN := 0, VALUE := "' + raw + '", MAX := 27648), MAX := ' + hi + ');';
const kopS = (raw, lo, hi, out, cond) => 'NETWORK Normieren ' + out + '\n' + (cond || '') + '=> NORM_X(0, "' + raw + '", 27648, "Hilf_Norm");\n\nNETWORK Skalieren ' + out + '\n' + (cond || '') + '=> SCALE_X(' + lo + ', "Hilf_Norm", ' + hi + ', "' + out + '");';
const nets = (...p) => p.join('\n\n');
const both = src => ({ fup: src });   // KOP entfällt in der Sensorwerkstatt (nur SCL und FUP)
Object.assign(root.SW_ANALOG, { TG, tg, bool, sclS, kopS, nets, both });

// Tankstation fertig verdrahtet (4 Transmitter + Sollwertsteller), Schirme aufgelegt, eingeschaltet
defPreset('tank_fertig', { base: 'schrank', mainSwitch: true, wires: all(['B10', 'B11', 'B12', 'B13', 'R1']), shields: { B10: true, B11: true, B12: true, B13: true } });
defPreset('m4_b10', { base: 'schrank', mainSwitch: true, wires: AW.B10 });
defPreset('m4_ohne_b12', { base: 'schrank', wires: all(['B10', 'B11', 'B13', 'R1']), shields: { B10: true, B11: true, B13: true } });
defPreset('m4_ohne_b13', { base: 'schrank', wires: all(['B10', 'B11', 'B12', 'R1']), shields: { B10: true, B11: true, B12: true } });

// Hilfen für Messaufgaben (Werte aus dem Modell)
const sigAt = (ch, phys) => (ctx, SM, W) => { const s = W.analogAt(ctx.state, ch, phys).sig; return s ? s.value : 0; };
const rawAt = (ch, phys) => (ctx, SM, W) => { const a = W.analogAt(ctx.state, ch, phys); return SM.rawValue(a.sig, root.SensorPLC.aiCfg(ctx.hw, ch)); };
const mAAt = (knife, phys) => (ctx, SM, W) => { const st = JSON.parse(JSON.stringify(ctx.state)); st.knives = Object.assign({}, st.knives, { [knife]: true }); return W.meter(st, 'mA', knife + '.a', knife + '.b', { phys }).value; };
const calRaw = (ch, mA) => (ctx, SM, W) => { const st = Object.assign({}, ctx.state, { calib: { on: true, channel: ch, mA } }); return SM.rawValue(W.analogAt(st, ch, {}).sig, root.SensorPLC.aiCfg(ctx.hw, ch)); };
Object.assign(root.SW_ANALOG, { sigAt, rawAt, mAAt, calRaw });

defWorkshopTask({ id: 'w4_b10_anschliessen', module: 4, no: 1, level: 'schnell', title: 'Ultraschall an AI0',
  story: 'An der Tankstation hängt der Ultraschallsensor <b>-B10</b> über dem Wasser – ohne Anschluss. Der Werkmeister: <i>„Ab jetzt sind Signale nicht mehr nur 0 oder 1. Miss nach, was dazwischen liegt.“</i>',
  brief: '<p>-B10 misst den Abstand zur Wasseroberfläche (60–800 mm) und gibt <b>0–10 V</b> aus. Er ist 800 mm über dem Tankboden montiert: Füllstand = 800 mm − Abstand.</p><ol><li>BN → <b>-X1:L+6</b>, BU → <b>-X1:M5</b>, BK → <b>-X3:4</b> (Feldseite a), -X3:4 SPS-Seite b → <b>-A1:AI0</b>.</li><li>Bezugspotential der CPU-Analogeingänge <b>-A1:2M</b> → <b>-X1:M6</b>.</li><li>-Q0 ein. Am Schieberegler „Anlage bedienen“ den Füllstand einstellen und die Spannung an AI0 gegen 2M messen.</li></ol>',
  learn: 'Einen 0–10-V-Sensor an den Analogeingang der CPU anschliessen und die Signalspannung messen.', take: 'Ein Spannungssignal braucht einen gemeinsamen Bezug: Sensor-M und 2M der CPU müssen verbunden sein. 0–10 V bildet den Messbereich linear ab.',
  man: 'analog', theory: 'st4a', hint: 'Ohne 2M auf M hat die Spannung an AI0 keinen Bezugspunkt.', hint2: 'Messbereich 60–800 mm ≙ 0–10 V: 430 mm liegt genau in der Mitte.',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:schrank',
  steps: [
    { kind: 'wire', text: '-B10 an AI0 anschliessen, 2M auf M', target: NEED.B10, ref: { add: AW.B10 },
      wrong: [{ add: AW.B10.slice(0, 4) }, { add: [['B10:BN', 'X1:L+6'], ['B10:BU', 'X1:M5'], ['B10:BK', 'X3:4.a'], ['X3:4.b', 'A1:AI1'], ['A1:2M', 'X1:M6']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Spannung an AI0 bei drei Füllständen', ask: [
      { q: 'Füllstand 555 mm (Abstand 245 mm)', unit: 'V', calc: sigAt('AI0', { B10: 245 }), tol: 0.1 },
      { q: 'Füllstand 370 mm (Abstand 430 mm)', unit: 'V', calc: sigAt('AI0', { B10: 430 }), tol: 0.1 },
      { q: 'Füllstand 185 mm (Abstand 615 mm)', unit: 'V', calc: sigAt('AI0', { B10: 615 }), tol: 0.1 }] },
    { kind: 'quiz', text: 'Der Tank wird voller. Was macht die Spannung von -B10?', options: ['Sie sinkt – der Abstand zur Oberfläche wird kleiner', 'Sie steigt', 'Sie bleibt gleich', 'Sie springt auf 24 V'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_rohwerte_spannung', module: 4, no: 2, level: 'schnell', title: 'Volt in Digits',
  story: 'Die SPS kennt keine Volt. Sie sieht nur eine Zahl. ARIA behauptet: <i>„10 V sind 32767, das weiss doch jeder.“</i>',
  brief: '<p>Der Analogeingang wandelt 0–10 V in den <b>Rohwert</b> 0–27648 (Nennbereich) um. Berechne die Rohwerte, lade die Konfiguration in die CPU und prüfe einen Wert in der Beobachtungstabelle (Variable <b>"Abstand_Roh"</b>, %IW64).</p>',
  learn: 'Spannungen in Rohwerte des Nennbereichs umrechnen und am Gerät prüfen.', take: 'Nennbereich 0–10 V ≙ 0–27648. Rohwert = U / 10 V × 27648. Werte über 27648 sind Übersteuerung, 32767 ist ein Sonderwert.',
  man: 'rohwerte', theory: 'st4a', hint: '27648 / 10 V = 2764,8 Digits pro Volt.', hint2: '2,5 V ist ein Viertel des Bereichs → 27648 / 4.',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:m4_b10',
  steps: [
    { kind: 'quiz', text: 'Rohwert bei 2,5 V?', answer: 6912, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 5 V?', answer: 13824, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 7,5 V?', answer: 20736, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 10 V?', answer: 27648, tol: 0 },
    { kind: 'load', text: 'Konfiguration laden, CPU in RUN' },
    { kind: 'measure', text: 'Beobachtungstabelle: "Abstand_Roh"', ask: [{ q: 'Abstand 430 mm: "Abstand_Roh"', calc: rawAt('AI0', { B10: 430 }), tol: 30 }] }
  ] });

defWorkshopTask({ id: 'w4_b11_2leiter', module: 4, no: 3, level: 'werkstatt', title: 'Die 2-Leiter-Schleife',
  story: 'Der Drucktransmitter <b>-B11</b> am Tankboden hat nur zwei Adern. <i>„Zwei Adern für Versorgung und Signal?“</i>, fragst du. Der Werkmeister grinst: <i>„Genau. Der Strom ist das Signal.“</i>',
  brief: '<p>-B11: 0–100 mbar → <b>4–20 mA, 2-Leiter</b>. Die SM 1231 speist die Schleife nicht – die 24 V kommen von L+.</p><ol><li>Schleife verdrahten: <b>-X1:L+2</b> → B11:+ · B11:− → <b>-X3:1</b> (a) · -X3:1 (b) → <b>-A2:0+</b> · <b>-A2:0−</b> → <b>-X1:M7</b>.</li><li>Gerätesicht, SM 1231 Kanal 0: Messart <b>Strom 2-Draht</b>, Bereich <b>4–20 mA</b>, Diagnose <b>Drahtbruch</b> ein.</li><li>-Q0 ein, laden, RUN. Rohwert bei 50 mbar prüfen.</li></ol>',
  learn: 'Einen 2-Leiter-Messumformer anschliessen und den Analogkanal konfigurieren.', take: 'Beim 2-Leiter fliesst der Schleifenstrom von L+ durch den Transmitter und den Analogeingang nach M. Der Transmitter regelt den Strom zwischen 4 und 20 mA.',
  man: 'transmitter', theory: 'st4a', hint: 'Die Schleife ist ein einziger Stromkreis: L+ → Transmitter → Eingang → M.', hint2: 'Konfiguration im Engineering: Gerätesicht → SM 1231 → Kanal 0.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:schrank', hw: HW_OFF('CH0'),
  steps: [
    { kind: 'wire', text: '2-Leiter-Schleife -B11 über -X3:1 an Kanal 0', target: NEED.B11, ref: { add: AW.B11 },
      wrong: [{ add: AW.B11.slice(0, 3) }, { add: [['B11:-', 'X1:L+2'], ['B11:+', 'X3:1.a'], ['X3:1.b', 'A2:0+'], ['A2:0-', 'X1:M7']] }] },
    { kind: 'config', text: 'Kanal 0: Strom 2-Draht, 4–20 mA, Drahtbruch ein', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA', 'ai.CH0.diag.wireBreak': true } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'load', text: 'Laden, CPU in RUN' },
    { kind: 'measure', text: 'Beobachtungstabelle: "Druck_Roh"', ask: [{ q: 'Druck 50 mbar: "Druck_Roh"', calc: rawAt('CH0', { B11: 50 }), tol: 30 }] }
  ] });

defWorkshopTask({ id: 'w4_rohwerte_strom', module: 4, no: 4, level: 'schnell', title: 'Live Zero',
  story: 'ARIA: <i>„4 mA ist doch schon Strom. Also ist 4 mA auch schon ein bisschen Druck, oder?“</i> Zeit für ein paar Zahlen.',
  brief: '<p>Bei 4–20 mA entspricht <b>4 mA</b> dem Anfang des Messbereichs (Rohwert 0) und <b>20 mA</b> dem Ende (27648). Der Nullpunkt „lebt“ – deshalb <b>Live Zero</b>.</p><p>Rohwert = (I − 4 mA) / 16 mA × 27648. Berechne die Werte.</p>',
  learn: 'Ströme im Bereich 4–20 mA in Rohwerte umrechnen und Live Zero verstehen.', take: 'Live Zero: 0 mA ist kein Messwert, sondern ein Fehler (Drahtbruch). Darum kann die Baugruppe einen Drahtbruch von „Messbereichsanfang“ unterscheiden.',
  man: 'rohwerte', theory: 'st4a', hint: '16 mA Spanne ≙ 27648 Digits → 1728 Digits pro mA.', hint2: '12 mA liegt genau in der Mitte zwischen 4 und 20 mA.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'quiz', text: 'Rohwert bei 4 mA?', answer: 0, tol: 0 },
    { kind: 'quiz', text: 'Rohwert bei 8 mA?', answer: 6912, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 12 mA?', answer: 13824, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 16 mA?', answer: 20736, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 20 mA?', answer: 27648, tol: 0 },
    { kind: 'quiz', text: 'Die Schleife ist unterbrochen (0 mA). Was sieht die SPS mit eingeschalteter Drahtbruchdiagnose?', options: ['Den Sonderwert 32767 und einen Diagnosealarm', 'Rohwert 0 – wie leerer Tank', 'Rohwert −6912', 'Nichts, der letzte Wert bleibt stehen'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_loopcheck', module: 4, no: 5, level: 'werkstatt', title: 'Loop-Check',
  story: 'Vor der Inbetriebnahme will der Werkmeister jeden Kanal „abnehmen“: <i>„Ich will sehen, dass 12 mA am Klemmenkasten auch 12 mA in der SPS sind.“</i>',
  brief: '<p>Prüfe <b>Kanal 1</b> der SM 1231 (Temperatur -B12) mit dem <b>Stromkalibrator</b>:</p><ol><li>Trennmesser <b>-X3:2</b> öffnen – der Transmitter ist damit von der Eingangsseite getrennt.</li><li>Konfiguration laden, CPU in RUN.</li><li>Kalibrator an Kanal 1, nacheinander <b>4 / 12 / 20 mA</b> einspeisen und <b>"Temp_Roh"</b> (%IW98) protokollieren.</li></ol>',
  learn: 'Einen Analogkanal mit dem Stromkalibrator abnehmen (Loop-Check).', take: 'Beim Loop-Check speist man bekannte Ströme ein und vergleicht mit dem Rohwert. So trennt man Fehler im Transmitter von Fehlern in Leitung und SPS.',
  man: 'messen', theory: 'st4a', hint: 'Trennmesser an -X3:2 öffnen, dann den Kalibrator anschliessen.', hint2: '4 mA → 0, 12 mA → 13824, 20 mA → 27648.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'wire', text: 'Trennmesser -X3:2 öffnen', target: [{ knife: 'X3:2', closed: false }], ref: { knives: { 'X3:2': true } }, wrong: [{ knives: { 'X3:1': true } }] },
    { kind: 'load', text: 'Konfiguration laden, CPU in RUN' },
    { kind: 'measure', text: 'Loop-Check Kanal 1', ask: [
      { q: 'Kalibrator 4 mA: "Temp_Roh"', calc: calRaw('CH1', 4), tol: 2 },
      { q: 'Kalibrator 12 mA: "Temp_Roh"', calc: calRaw('CH1', 12), tol: 2 },
      { q: 'Kalibrator 20 mA: "Temp_Roh"', calc: calRaw('CH1', 20), tol: 2 }] },
    { kind: 'quiz', text: 'Alle drei Werte stimmen, trotzdem zeigt die Anlage später falsche Temperaturen. Wo suchst du?', options: ['Am Transmitter -B12 bzw. an seinem Messbereich – Leitung und Kanal sind geprüft', 'In der SM 1231', 'Im Kalibrator', 'An der CPU-Versorgung'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_b12_schirm', module: 4, no: 6, level: 'profi', title: 'Anschlusskopf und Schirm',
  story: 'Der Temperaturfühler <b>-B12</b> steckt in der Tauchhülse, der Kopftransmitter wartet auf seine Adern. Neben dem Tank läuft der Pumpen-Umrichter. <i>„Den Schirm vergisst man genau einmal“</i>, sagt der Werkmeister.',
  brief: '<p>Profi-Stufe: spannungsfrei arbeiten, Aderendhülsen, Schirm auflegen.</p><ol><li>Deckel des Anschlusskopfs öffnen: -X1:L+4 → <b>+</b>, <b>−</b> → -X3:2 (a); -X3:2 (b) → -A2:1+; -A2:1− → -X1:M8.</li><li>Schirm der Leitung mit der Schirmklemme auf die Schirmschiene legen.</li><li>-Q0 ein, Rohwert bei 50 °C prüfen. Vergleiche die Trendkurve mit und ohne Schirm.</li></ol>',
  learn: 'Einen 2-Leiter-Temperaturtransmitter im Anschlusskopf anschliessen und die Leitung schirmen.', take: 'Analogleitungen sind geschirmt, der Schirm wird grossflächig auf die Schirmschiene gelegt. Ohne Schirm schwankt der Messwert um einige Prozent.',
  man: 'transmitter', theory: 'st4b', hint: 'Werkzeug Schirmklemme: auf die Leitung von -B12 an -X3 klicken.', hint2: 'Rauschen ohne Schirm: ±1,5 % von 27648 ≈ ±400 Digits.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:m4_ohne_b12',
  steps: [
    { kind: 'wire', text: '-B12 anschliessen und Schirm auflegen', target: NEED.B12.concat([{ shield: 'B12' }]), ref: { add: AW.B12, shields: { B12: true } },
      wrong: [{ add: AW.B12 }, { add: AW.B12.slice(0, 3), shields: { B12: true } }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Rohwert "Temp_Roh" bei 50 °C (Mittelwert aus der Trendkurve)', ask: [{ q: 'Temperatur 50 °C: "Temp_Roh"', calc: rawAt('CH1', { B12: 50 }), tol: 40 }] },
    { kind: 'quiz', text: 'Wie stark schwankt "Temp_Roh" ohne Schirm ungefähr?', options: ['Etwa ±400 Digits (±1,5 %)', 'Etwa ±5 Digits', 'Gar nicht', 'Zwischen 0 und 32767'], correct: 0 },
    { kind: 'quiz', text: 'Welche Temperaturschwankung sind ±400 Digits bei 0–100 °C?', answer: 1.45, tol: 0.1, unit: '°C' }
  ] });

defWorkshopTask({ id: 'w4_trennmesser', module: 4, no: 7, level: 'werkstatt', title: 'Strom in Reihe messen',
  story: 'Der Druckwert sieht komisch aus. Der Werkmeister: <i>„Strom misst man in Reihe. Wer das Multimeter parallel an 24 V hängt, kauft dem Laden eine neue Sicherung.“</i>',
  brief: '<ol><li>Konfiguration laden, CPU in RUN.</li><li>Trennmesser <b>-X3:1</b> (Schleife -B11) öffnen.</li><li>Multimeter auf <b>mA</b>, Messspitzen in die Messbuchsen <b>-X3:1.a</b> und <b>-X3:1.b</b> – jetzt liegt es in Reihe in der Schleife.</li><li>Ströme bei 0 und 50 mbar messen.</li><li>Ohne Multimeter: Rohwert und Diagnosepuffer bei offenem Trennmesser lesen.</li></ol>',
  learn: 'Den Schleifenstrom über die Trennklemme in Reihe messen und die Drahtbruchdiagnose lesen.', take: 'Trennmesser auf = Schleife offen: Ohne Messgerät sieht die SPS einen Drahtbruch (32767, Diagnosealarm). Mit Multimeter in den Messbuchsen misst man den echten Schleifenstrom.',
  man: 'messen', theory: 'st4b', hint: 'Das Multimeter misst nur Strom, wenn es den Stromkreis schliesst – also über dem offenen Trennmesser.', hint2: '0 mbar → 4 mA, 50 mbar → 12 mA.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'load', text: 'Konfiguration laden, CPU in RUN' },
    { kind: 'wire', text: 'Trennmesser -X3:1 öffnen', target: [{ knife: 'X3:1', closed: false }], ref: { knives: { 'X3:1': true } }, wrong: [{ knives: { 'X3:2': true } }] },
    { kind: 'measure', text: 'Strom in Reihe, Rohwert bei offener Schleife', ask: [
      { q: 'Druck 0 mbar: Schleifenstrom', unit: 'mA', calc: mAAt('X3:1', { B11: 0 }), tol: 0.1 },
      { q: 'Druck 50 mbar: Schleifenstrom', unit: 'mA', calc: mAAt('X3:1', { B11: 50 }), tol: 0.1 },
      { q: 'Trennmesser offen, ohne Multimeter: "Druck_Roh"', calc: rawAt('CH0', { B11: 50 }), tol: 0 }] },
    { kind: 'quiz', text: 'Was steht im Diagnosepuffer?', options: ['SM 1231 Kanal 0: Drahtbruch oder Überlauf (kommend)', 'CPU in STOP', 'Kurzschluss L+/M', 'Nichts – der Kanal hat keine Diagnose'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_b13_4leiter', module: 4, no: 8, level: 'werkstatt', title: 'Der 4-Leiter',
  story: 'Der Durchflussmesser <b>-B13</b> hat vier Adern und einen eigenen Stromausgang. ARIA hat Kanal 2 schon mal als 2-Draht konfiguriert – „sicher ist sicher“.',
  brief: '<p>-B13: 0–20 l/min → <b>4–20 mA, 4-Leiter</b>. Er wird separat versorgt und <b>treibt</b> den Strom selbst (aktiver Ausgang).</p><ol><li>Versorgung: B13:L+ → -X1:L+5, B13:M → -X1:M1.</li><li>Signal: I+ → -X3:3 (a), -X3:3 (b) → -A2:2+, I− → -A2:2−.</li><li>Kanal 2: Messart <b>Strom 4-Draht</b>, 4–20 mA.</li><li>-Q0 ein, laden, Rohwert bei 10 l/min prüfen.</li></ol>',
  learn: 'Einen 4-Leiter-Messumformer anschliessen und den Kanal passend konfigurieren.', take: '2-Leiter: Versorgung und Signal auf denselben zwei Adern, die Schleife holt sich L+. 4-Leiter: eigene Versorgung, der Stromausgang treibt direkt in x+ / x− – kein L+ in der Signalschleife.',
  man: 'transmitter', theory: 'st4b', hint: 'Beim 4-Leiter kommt kein L+ an I+ oder I−.', hint2: 'Gerätesicht → SM 1231 → Kanal 2 → Messart „Strom 4-Draht“.',
  parts: ['B13'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:m4_ohne_b13', hw: { 'ai.CH2.type': 'I_2W' },
  steps: [
    { kind: 'wire', text: '-B13 versorgen und Stromausgang an Kanal 2', target: NEED.B13, ref: { add: AW.B13 },
      wrong: [{ add: [['B13:L+', 'X1:L+5'], ['B13:M', 'X1:M1'], ['B13:I-', 'X3:3.a'], ['X3:3.b', 'A2:2+'], ['B13:I+', 'X1:L+8']] }, { add: AW.B13.slice(2) }] },
    { kind: 'config', text: 'Kanal 2: Strom 4-Draht, 4–20 mA', target: { 'ai.CH2.type': 'I_4W', 'ai.CH2.range': '4..20mA' } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'load', text: 'Laden, CPU in RUN' },
    { kind: 'measure', text: 'Beobachtungstabelle: "Durchfluss_Roh"', ask: [{ q: 'Durchfluss 10 l/min: "Durchfluss_Roh"', calc: rawAt('CH2', { B13: 10 }), tol: 30 }] },
    { kind: 'quiz', text: 'Was passiert, wenn man -B13 wie einen 2-Leiter (L+ → I+) anschliesst?', options: ['Kein oder ein falscher Messwert – der aktive Ausgang braucht seine eigene Versorgung', 'Er funktioniert genauso', 'Der Messwert verdoppelt sich', 'Die SM 1231 schaltet auf 4-Draht um'], correct: 0 }
  ] });

const ST_TAGS = [{ name: 'Druck_Status', type: 'Int', addr: '%MW80', comment: 'HMI: 0 OK, 1 Übersteuerung, 2 Untersteuerung, 3 Überlauf/Drahtbruch, 4 Unterlauf' }];
const ST_KOP = 'NETWORK In Ordnung\n=> MOVE(0, "Druck_Status");\n\nNETWORK Uebersteuerung\n["Druck_Roh" > 27648] => MOVE(1, "Druck_Status");\n\nNETWORK Untersteuerung\n["Druck_Roh" < 0] => MOVE(2, "Druck_Status");\n\nNETWORK Ueberlauf oder Drahtbruch\n["Druck_Roh" == 32767] => MOVE(3, "Druck_Status");\n\nNETWORK Unterlauf\n["Druck_Roh" == -32768] => MOVE(4, "Druck_Status");\n\nNETWORK Meldung\n["Druck_Status" >= 3] => "Lampe_Rot";';
const ST_KOP0 = 'NETWORK Meldung\n["Druck_Roh" > 27648] => "Lampe_Rot";';
defWorkshopTask({ id: 'w4_rohwert_status', module: 4, no: 9, level: 'werkstatt', title: 'Rohwert prüfen',
  story: 'ARIA hat eine Idee: <i>„Wenn der Draht bricht, zeigen wir einfach 118 mbar an. Merkt keiner.“</i> Der Werkmeister will das Gegenteil: Jeder ungültige Rohwert wird gemeldet.',
  brief: '<p>Werte <b>"Druck_Roh"</b> (%IW96) aus und schreibe den Status in <b>"Druck_Status"</b> (Int, %MW80, HMI):</p><table><tr><th>Rohwert</th><th>Status</th></tr><tr><td>0 … 27648</td><td>0 = in Ordnung</td></tr><tr><td>27649 … 32511</td><td>1 = Übersteuerung</td></tr><tr><td>−4864 … −1</td><td>2 = Untersteuerung</td></tr><tr><td>32767</td><td>3 = Überlauf / Drahtbruch</td></tr><tr><td>−32768</td><td>4 = Unterlauf</td></tr></table><p>Bei Status 3 oder 4 leuchtet <b>"Lampe_Rot"</b>.</p>',
  learn: 'Rohwerte auf Nennbereich, Über-/Untersteuerung und Sonderwerte prüfen.', take: '32767 und −32768 sind keine Messwerte, sondern Meldungen der Baugruppe. Erst prüfen, dann skalieren.',
  man: 'rohwerte', theory: 'st4b', hint: 'Die Sonderwerte zuerst prüfen: 32767 ist auch „grösser als 27648“.', hint2: 'IF "Druck_Roh" = 32767 THEN … ELSIF "Druck_Roh" = -32768 THEN … ELSIF "Druck_Roh" > 27648 THEN …',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Statusauswertung programmieren', langs: ['scl', 'fup'], tagsExtra: ST_TAGS,
      start: { scl: '"Lampe_Rot" := "Druck_Roh" > 27648;\n', fup: ST_KOP0 },
      ref: { scl: 'IF "Druck_Roh" = 32767 THEN\n  "Druck_Status" := 3;\nELSIF "Druck_Roh" = -32768 THEN\n  "Druck_Status" := 4;\nELSIF "Druck_Roh" > 27648 THEN\n  "Druck_Status" := 1;\nELSIF "Druck_Roh" < 0 THEN\n  "Druck_Status" := 2;\nELSE\n  "Druck_Status" := 0;\nEND_IF;\n"Lampe_Rot" := "Druck_Status" >= 3;\n', fup: ST_KOP },
      tests: [{ phys: { B11: 50 }, expect: { Druck_Status: 0, Lampe_Rot: false } }, { phys: { B11: 110 }, expect: { Druck_Status: 1, Lampe_Rot: false } }, { raw: { Druck_Roh: -2000 }, expect: { Druck_Status: 2, Lampe_Rot: false } },
        { raw: { Druck_Roh: 32767 }, expect: { Druck_Status: 3, Lampe_Rot: true } }, { raw: { Druck_Roh: -32768 }, expect: { Druck_Status: 4, Lampe_Rot: true } }, { phys: { B11: 0 }, expect: { Druck_Status: 0, Lampe_Rot: false } }],
      timed: [{ steps: [[0.05, { raw: { Druck_Roh: 32767 } }, { Druck_Status: 3 }], [0.05, { phys: { B11: 20 } }, { Druck_Status: 0, Lampe_Rot: false }]] }],
      wrong: [{ scl: 'IF "Druck_Roh" > 27648 THEN\n  "Druck_Status" := 1;\nELSIF "Druck_Roh" = 32767 THEN\n  "Druck_Status" := 3;\nELSIF "Druck_Roh" < 0 THEN\n  "Druck_Status" := 2;\nELSIF "Druck_Roh" = -32768 THEN\n  "Druck_Status" := 4;\nELSE\n  "Druck_Status" := 0;\nEND_IF;\n"Lampe_Rot" := "Druck_Status" >= 3;' },
        { scl: 'IF "Druck_Roh" = 32767 THEN\n  "Druck_Status" := 3;\nELSIF "Druck_Roh" = -32768 THEN\n  "Druck_Status" := 4;\nELSIF "Druck_Roh" > 27648 THEN\n  "Druck_Status" := 1;\nELSIF "Druck_Roh" < 0 THEN\n  "Druck_Status" := 2;\nEND_IF;\n"Lampe_Rot" := "Druck_Status" >= 3;' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });

defWorkshopTask({ id: 'w4_boss_tank', module: 4, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Die Tankstation misst',
  story: 'ARIA hat an der Tankstation alle Analogleitungen gezogen und die Kanäle der SM 1231 abgeschaltet. Der Werkmeister legt das Abnahmeprotokoll auf den Tisch: <i>„Vier Messstellen. Jede wird angeschlossen, konfiguriert und abgenommen.“</i>',
  brief: '<ol><li><b>-B10</b> (0–10 V) an CPU-AI0 über -X3:4, 2M auf M.</li><li><b>-B11</b> (2-Leiter) über -X3:1 an Kanal 0, <b>-B12</b> (2-Leiter) über -X3:2 an Kanal 1.</li><li><b>-B13</b> (4-Leiter) versorgen, Signal über -X3:3 an Kanal 2.</li><li>SM 1231 konfigurieren: Kanal 0 und 1 Strom 2-Draht, Kanal 2 Strom 4-Draht, alle 4–20 mA mit Drahtbruchdiagnose.</li><li>-Q0 ein, laden, RUN.</li><li>Abnahme: Rohwerte bei den angegebenen Prozesswerten ins Protokoll.</li></ol><p>Klemmen wie im Klemmenplan (Handbuch „Analogsignale“).</p>',
  learn: 'Alle Analogsignale einer Anlage anschliessen, konfigurieren und abnehmen.', take: 'Anschliessen → konfigurieren → laden → abnehmen. Das Abnahmeprotokoll beweist, dass jede Messstelle vom Sensor bis zum Rohwert stimmt.',
  man: 'klemmenplan', theory: 'st4b', hint: 'Arbeite Messstelle für Messstelle: verdrahten, dann gleich den Kanal konfigurieren.', hint2: 'Mitte des Messbereichs ergibt immer 13824.',
  parts: ['B10', 'B11', 'B12', 'B13'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:schrank', hw: Object.assign(HW_OFF('CH0'), HW_OFF('CH1'), HW_OFF('CH2')),
  steps: [
    { kind: 'wire', text: 'Vier Messstellen anschliessen', target: [].concat(NEED.B10, NEED.B11, NEED.B12, NEED.B13), ref: { add: all(['B10', 'B11', 'B12', 'B13']) },
      wrong: [{ add: all(['B10', 'B11', 'B12']).concat([['B13:L+', 'X1:L+5'], ['B13:M', 'X1:M1'], ['B13:I-', 'X3:3.a'], ['X3:3.b', 'A2:2+'], ['B13:I+', 'X1:L+8']]) }, { add: all(['B10', 'B12', 'B13']).concat(AW.B11.slice(0, 3)) }] },
    { kind: 'config', text: 'SM 1231: Kanäle 0–2 konfigurieren', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA', 'ai.CH0.diag.wireBreak': true, 'ai.CH1.type': 'I_2W', 'ai.CH1.range': '4..20mA', 'ai.CH1.diag.wireBreak': true, 'ai.CH2.type': 'I_4W', 'ai.CH2.range': '4..20mA', 'ai.CH2.diag.wireBreak': true } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'load', text: 'Laden, CPU in RUN' },
    { kind: 'measure', text: 'Abnahmeprotokoll', ask: [
      { q: 'Abstand 430 mm: "Abstand_Roh"', calc: rawAt('AI0', { B10: 430 }), tol: 30 },
      { q: 'Druck 25 mbar: "Druck_Roh"', calc: rawAt('CH0', { B11: 25 }), tol: 30 },
      { q: 'Temperatur 75 °C: "Temp_Roh"', calc: rawAt('CH1', { B12: 75 }), tol: 30 },
      { q: 'Durchfluss 10 l/min: "Durchfluss_Roh"', calc: rawAt('CH2', { B13: 10 }), tol: 30 }] }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/m5.js ==== */
/* ===== SENSORWERKSTATT Modul 5: NORM_X und SCALE_X ===== */
(function(root){
const A = root.SW_ANALOG, { tg, bool, sclS, kopS, nets, both } = A;
root.SW_CHAPTER({ n:5, title:'NORM_X und SCALE_X', subtitle:'Rohwert → Messwert · Geradengleichung', icon:'fa-ruler-combined',
  intro:'Die Tankstation liefert Rohwerte – aber niemand will „13824“ auf dem HMI lesen. ARIA hat die Skalierung „optimiert“: Jetzt zeigt der leere Tank 20 % und das Wasser kocht bei 118 °C. Zeit für die Geradengleichung.',
  anim: root.SW_CHAPTER_ANIM('0…27648 → 0.0…1.0 → 0…100 mbar') });
const P = v => [v, 0.05];
const LOAD = { kind: 'load', text: 'In das Gerät laden und CPU starten' };

defWorkshopTask({ id: 'w5_von_hand', module: 5, no: 1, level: 'schnell', title: 'Skalieren von Hand',
  story: 'Der Werkmeister dreht am Sollwertsteller <b>-R1</b> und zeigt auf die Beobachtungstabelle: „Sollwert_Roh = 13824“. <i>„Wie viel Prozent sind das? Ohne Taschenrechner-App, bitte mit Kopf.“</i>',
  brief: '<p>-R1 liefert 0–10 V ≙ 0–100 % an CPU-AI1 (%IW66, "Sollwert_Roh"). Skalieren ist eine <b>Geradengleichung</b> durch zwei Punkte: (0 | 0 %) und (27648 | 100 %).</p><p>Rechenweg in zwei Schritten: <b>normieren</b> auf 0…1 (Rohwert / 27648), dann <b>skalieren</b> auf den Messbereich (× 100 %).</p>',
  learn: 'Einen Rohwert von Hand normieren und in den Messbereich skalieren.', take: 'Wert = MIN + (Roh − Roh_min) / (Roh_max − Roh_min) × (MAX − MIN). NORM_X macht den ersten, SCALE_X den zweiten Teil.',
  man: 'normx', theory: 'st5a', hint: '13824 ist genau die Hälfte von 27648.', hint2: '20000 / 27648 = 0,7234 → × 100 %.',
  parts: ['R1'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'quiz', text: 'Rohwert 13824: normierter Wert (0…1)?', answer: 0.5, tol: 0.001 },
    { kind: 'quiz', text: 'Rohwert 13824: Sollwert in %?', answer: 50, tol: 0.05, unit: '%' },
    { kind: 'quiz', text: 'Rohwert 20000: Sollwert in %?', answer: 72.34, tol: 0.05, unit: '%' },
    { kind: 'quiz', text: 'Rohwert 6912: Spannung am Eingang in V?', answer: 2.5, tol: 0.01, unit: 'V' },
    { kind: 'quiz', text: 'Warum rechnet man das Ergebnis in REAL statt in INT?', options: ['Sonst gehen Nachkommastellen verloren (72,34 % würde 72 %)', 'INT kann keine 100 speichern', 'NORM_X funktioniert nur mit REAL-Eingang', 'REAL ist schneller'], correct: 0 }
  ] });

const DRUCK_REF = sclS('Druck_Roh', '0.0', '100.0', 'Druck_mbar');
defWorkshopTask({ id: 'w5_druck', module: 5, no: 2, level: 'schnell', title: 'Druck in mbar',
  story: 'Am HMI steht beim Druck nur „0.0 mbar“. ARIA: <i>„Rohwerte sind ehrlicher.“</i> Der Bediener sieht das anders.',
  brief: '<p>Skaliere <b>"Druck_Roh"</b> (%IW96, -B11, 0–100 mbar) mit <b>NORM_X</b> und <b>SCALE_X</b> auf <b>"Druck_mbar"</b> (Real, %MD24, HMI).</p><ul><li>NORM_X: MIN 0, VALUE "Druck_Roh", MAX 27648 → 0.0…1.0</li><li>SCALE_X: MIN 0.0, VALUE (Ergebnis), MAX 100.0 → mbar</li><li>FUP: Zwischenwert in <b>"Hilf_Norm"</b> (%MD36).</li></ul><p>Laden und am HMI prüfen.</p>',
  learn: 'Einen Analogwert mit NORM_X und SCALE_X in die physikalische Einheit umrechnen.', take: 'NORM_X(Rohbereich) → 0…1 → SCALE_X(Messbereich). Die Grenzen stammen aus dem Datenblatt des Transmitters (0–100 mbar) und dem Nennbereich (0–27648).',
  man: 'normx', theory: 'st5a', hint: 'SCL: SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648), MAX := 100.0)', hint2: 'FUP: zwei Netzwerke – NORM_X nach "Hilf_Norm", dann SCALE_X von "Hilf_Norm" nach "Druck_mbar".',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Druck skalieren', langs: ['scl', 'fup'], tagsExtra: tg('Druck_mbar', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Druck_mbar" := 0.0;\n' }, both('NETWORK Druck\n=> MOVE(0.0, "Druck_mbar");')),
      ref: Object.assign({ scl: DRUCK_REF + '\n' }, both(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'))),
      tests: [{ phys: { B11: 0 }, expect: { Druck_mbar: P(0) } }, { phys: { B11: 25 }, expect: { Druck_mbar: P(25) } }, { phys: { B11: 50 }, expect: { Druck_mbar: P(50) } }, { phys: { B11: 100 }, expect: { Druck_mbar: P(100) } }],
      wrong: [{ scl: '"Druck_mbar" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 32767), MAX := 100.0);' }, { scl: '"Druck_mbar" := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648);' }] },
    LOAD
  ] });

defWorkshopTask({ id: 'w5_pegel', module: 5, no: 3, level: 'werkstatt', title: 'Pegel aus Druck',
  story: 'Der Drucktransmitter sitzt am Tankboden. Der Werkmeister: <i>„Der misst eigentlich den Füllstand. Wasser drückt – je höher, desto mehr.“</i>',
  brief: '<p>Hydrostatik: <b>p = ρ · g · h</b>, also <b>h = p / (ρ · g)</b> mit ρ = 1000 kg/m³, g = 9,81 m/s².</p><p>Einheiten: 1 mbar = 100 Pa, 1 m = 1000 mm. Berechne aus <b>"Druck_mbar"</b> den Pegel <b>"Pegel_mm"</b> (Real, %MD44). Die Druckskalierung aus Aufgabe 2 ist vorgegeben.</p>',
  learn: 'Aus dem hydrostatischen Druck den Pegel berechnen und Einheiten umrechnen.', take: '1 mm Wassersäule ≈ 0,0981 mbar. Wer Pa und mbar verwechselt, liegt um den Faktor 100 daneben.',
  man: 'normx', theory: 'st5a', hint: 'h [m] = p [Pa] / (1000 · 9,81). p [Pa] = p [mbar] · 100.', hint2: 'SCL: "Pegel_mm" := "Druck_mbar" * 100.0 / (1000.0 * 9.81) * 1000.0; — FUP: DIV("Druck_mbar", 0.0981, "Pegel_mm")',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Pegel aus Druck berechnen', langs: ['scl', 'fup'], tagsExtra: tg('Druck_mbar', 'Hilf_Norm', 'Pegel_mm'),
      start: Object.assign({ scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar";\n' }, both(nets(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), 'NETWORK Pegel\n=> MOVE("Druck_mbar", "Pegel_mm");'))),
      ref: Object.assign({ scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar" * 100.0 / (1000.0 * 9.81) * 1000.0;\n' }, both(nets(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), 'NETWORK Pegel\n=> DIV("Druck_mbar", 0.0981, "Pegel_mm");'))),
      tests: [{ phys: { B11: 0 }, expect: { Pegel_mm: [0, 0.5] } }, { phys: { B11: 29.43 }, expect: { Pegel_mm: [300, 0.5] } }, { phys: { B11: 58.86 }, expect: { Pegel_mm: [600, 0.5] } }],
      wrong: [{ scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar" / (1000.0 * 9.81) * 1000.0;' }, { scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar" * 9.81;' }] },
    LOAD
  ] });

defWorkshopTask({ id: 'w5_temp', module: 5, no: 4, level: 'schnell', title: 'Temperatur in °C',
  story: 'Der Kopftransmitter von -B12 liefert 4–20 mA für 0–100 °C. Das HMI zeigt „Temp_C = 0.0“. Der Werkmeister hält die Hand ans Wasser: <i>„Kalt ist anders.“</i>',
  brief: '<p>Skaliere <b>"Temp_Roh"</b> (%IW98) auf <b>"Temp_C"</b> (Real, %MD28): 0–27648 → 0,0–100,0 °C. FUP: Zwischenwert in "Hilf_Norm".</p>',
  learn: 'Die Skalierung auf einen zweiten Messwert übertragen.', take: 'Dasselbe Muster für jede Messstelle: NORM_X mit dem Nennbereich, SCALE_X mit dem Messbereich des Transmitters.',
  man: 'normx', theory: 'st5a', hint: 'Wie beim Druck – nur Rohwert und Ziel ändern sich.', hint2: 'Messbereich laut Typenschild -B12: 0–100 °C.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Temperatur skalieren', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Temp_C" := 0.0;\n' }, both('NETWORK Temperatur\n=> MOVE(0.0, "Temp_C");')),
      ref: Object.assign({ scl: sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\n' }, both(kopS('Temp_Roh', '0.0', '100.0', 'Temp_C'))),
      tests: [{ phys: { B12: 0 }, expect: { Temp_C: P(0) } }, { phys: { B12: 20 }, expect: { Temp_C: P(20) } }, { phys: { B12: 60.5 }, expect: { Temp_C: P(60.5) } }, { phys: { B12: 100 }, expect: { Temp_C: P(100) } }],
      wrong: [{ scl: sclS('Druck_Roh', '0.0', '100.0', 'Temp_C') }, { scl: sclS('Temp_Roh', '4.0', '20.0', 'Temp_C') }] },
    LOAD
  ] });

const US_REF = sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := 800.0 - "Abstand_mm";\n';
const US_KOP = nets(kopS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), 'NETWORK Fuellstand\n=> SUB(800.0, "Abstand_mm", "Fuellstand_mm");');
defWorkshopTask({ id: 'w5_ultraschall', module: 5, no: 5, level: 'werkstatt', title: 'Füllstand per Ultraschall',
  story: '-B10 misst von oben den Abstand zur Wasseroberfläche. Das HMI will aber den <b>Füllstand</b>. ARIA: <i>„Einfach Abstand anzeigen. Weniger ist mehr, oder?“</i>',
  brief: '<ol><li><b>"Abstand_Roh"</b> (%IW64, 0–10 V) auf <b>"Abstand_mm"</b> (%MD40) skalieren: Messbereich <b>60–800 mm</b> (nicht 0!).</li><li><b>"Fuellstand_mm"</b> (%MD20) = Einbauhöhe <b>800 mm</b> − Abstand.</li></ol><p>Unter 60 mm (Blindzone) kann -B10 nicht messen – der Tank darf also nie ganz voll werden.</p>',
  learn: 'Einen Messbereich mit Anfangswert ≠ 0 skalieren und aus dem Abstand den Füllstand berechnen.', take: 'SCALE_X braucht den echten Messbereich: 0 V ≙ 60 mm, nicht 0 mm. Füllstand = Einbauhöhe − Abstand.',
  man: 'normx', theory: 'st5a', hint: 'SCALE_X(MIN := 60.0, …, MAX := 800.0)', hint2: 'FUP: SUB(800.0, "Abstand_mm", "Fuellstand_mm").',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Abstand und Füllstand berechnen', langs: ['scl', 'fup'], tagsExtra: tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Fuellstand_mm" := 0.0;\n' }, both('NETWORK Fuellstand\n=> MOVE(0.0, "Fuellstand_mm");')),
      ref: Object.assign({ scl: US_REF }, both(US_KOP)),
      tests: [{ phys: { B10: 800 }, expect: { Fuellstand_mm: [0, 0.2] } }, { phys: { B10: 430 }, expect: { Abstand_mm: [430, 0.2], Fuellstand_mm: [370, 0.2] } }, { phys: { B10: 200 }, expect: { Fuellstand_mm: [600, 0.2] } }, { phys: { B10: 30 }, expect: { Abstand_mm: [60, 0.2], Fuellstand_mm: [740, 0.2] } }],
      wrong: [{ scl: sclS('Abstand_Roh', '0.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := 800.0 - "Abstand_mm";' }, { scl: sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := "Abstand_mm";' }] },
    LOAD
  ] });

const AQ_SCL = v => '"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := NORM_X(MIN := 0.0, VALUE := "Pumpe_Prozent", MAX := 100.0), MAX := ' + v + ');\n';
const AQ_KOP = 'NETWORK Normieren\n=> NORM_X(0.0, "Pumpe_Prozent", 100.0, "Hilf_Norm");\n\nNETWORK Ausgabe an SM 1232\n=> SCALE_X(0, "Hilf_Norm", 27648, "Pumpe_Soll_Roh");';
defWorkshopTask({ id: 'w5_pumpe_aq', module: 5, no: 6, level: 'schnell', title: 'Pumpendrehzahl ausgeben',
  story: 'Der Umrichter -T2 der Pumpe erwartet 0–10 V als Drehzahlsollwert. Diesmal läuft die Skalierung rückwärts – vom Prozentwert zum Rohwert.',
  brief: '<p>Das HMI gibt <b>"Pumpe_Prozent"</b> (Real, %MD48, 0–100 %) vor. Gib den Sollwert über die SM 1232 Kanal 0 (0–10 V) aus: <b>"Pumpe_Soll_Roh"</b> (Int, %QW112).</p><ul><li>NORM_X: 0.0…100.0 % → 0…1</li><li>SCALE_X: 0…27648 in eine <b>Int</b>-Variable (wird gerundet)</li></ul><p>Laden und am Ausgang die Spannung bei 50 % messen.</p>',
  learn: 'Einen Prozentwert mit NORM_X und SCALE_X in einen Analogausgabewert umrechnen.', take: 'Analogausgabe = Skalierung rückwärts: physikalischer Wert → 0…1 → 0…27648. Das Ziel ist ein Int, SCALE_X rundet.',
  man: 'aq', theory: 'st5b', hint: 'Jetzt ist der Prozentwert der VALUE von NORM_X.', hint2: 'SCALE_X(MIN := 0, VALUE := …, MAX := 27648) in "Pumpe_Soll_Roh".',
  parts: [], modules: ['A1', 'A3'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Drehzahlsollwert ausgeben', langs: ['scl', 'fup'], tagsExtra: tg('Pumpe_Prozent', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Pumpe_Soll_Roh" := 0;\n' }, both('NETWORK Ausgabe\n=> MOVE(0, "Pumpe_Soll_Roh");')),
      ref: Object.assign({ scl: AQ_SCL(27648) }, both(AQ_KOP)),
      tests: [{ in: { Pumpe_Prozent: 0.0 }, expect: { Pumpe_Soll_Roh: 0 } }, { in: { Pumpe_Prozent: 50.0 }, expect: { Pumpe_Soll_Roh: 13824 } }, { in: { Pumpe_Prozent: 100.0 }, expect: { Pumpe_Soll_Roh: 27648 } }, { in: { Pumpe_Prozent: 33.3 }, expect: { Pumpe_Soll_Roh: 9207 } }],
      wrong: [{ scl: AQ_SCL(32767) }, { scl: '"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := "Pumpe_Prozent", MAX := 27648);' }] },
    LOAD,
    { kind: 'measure', text: 'Spannung am Ausgang SM 1232 Kanal 0', ask: [{ q: 'Pumpe_Prozent = 50 %: Spannung an AQ 0', unit: 'V', calc: (ctx, SM) => SM.aqSignal(13824, ctx.hw.aq.CH0), tol: 0.05 }] }
  ] });

const V_SCL = '"Ventil_Soll_Roh" := SCALE_X(MIN := 0, VALUE := NORM_X(MIN := 0.0, VALUE := "Ventil_Begrenzt", MAX := 100.0), MAX := 27648);\n';
const V_KOP = nets('NETWORK Uebernehmen\n=> MOVE("Ventil_Prozent", "Ventil_Begrenzt");', 'NETWORK Untergrenze\n["Ventil_Prozent" < 0.0] => MOVE(0.0, "Ventil_Begrenzt");', 'NETWORK Obergrenze\n["Ventil_Prozent" > 100.0] => MOVE(100.0, "Ventil_Begrenzt");',
  'NETWORK Normieren\n=> NORM_X(0.0, "Ventil_Begrenzt", 100.0, "Hilf_Norm");', 'NETWORK Ausgabe an SM 1232\n=> SCALE_X(0, "Hilf_Norm", 27648, "Ventil_Soll_Roh");');
const V_KOP0 = nets('NETWORK Uebernehmen\n=> MOVE("Ventil_Prozent", "Ventil_Begrenzt");', 'NETWORK Normieren\n=> NORM_X(0.0, "Ventil_Begrenzt", 100.0, "Hilf_Norm");', 'NETWORK Ausgabe an SM 1232\n=> SCALE_X(0, "Hilf_Norm", 27648, "Ventil_Soll_Roh");');
defWorkshopTask({ id: 'w5_ventil', module: 5, no: 7, level: 'werkstatt', title: 'Stellventil mit LIMIT',
  story: 'Am HMI hat jemand „120 %“ für das Stellventil -MB5 eingetippt. ARIA jubelt: <i>„Mehr als ganz offen!“</i> Der Ausgang der SM 1232 fährt in die Übersteuerung.',
  brief: '<p>Das HMI gibt <b>"Ventil_Prozent"</b> (%MD52) vor. Begrenze den Wert auf <b>0…100 %</b> in <b>"Ventil_Begrenzt"</b> (%MD56) und gib ihn über SM 1232 Kanal 1 (<b>4–20 mA</b>) als <b>"Ventil_Soll_Roh"</b> (%QW114) aus.</p><ul><li>SCL: <code>LIMIT(MN := 0.0, IN := …, MX := 100.0)</code></li><li>FUP: mit Vergleichern und MOVE begrenzen</li></ul>',
  learn: 'Einen Sollwert begrenzen und als 4–20-mA-Signal ausgeben.', take: 'Sollwerte vom Bediener immer begrenzen. Auch bei 4–20 mA ist der Rohwert 0…27648 – die Baugruppe macht daraus 4…20 mA.',
  man: 'aq', theory: 'st5b', hint: 'LIMIT(MN, IN, MX) liefert MN, wenn IN kleiner ist, und MX, wenn IN grösser ist.', hint2: 'Ausgabe wie bei der Pumpe, aber mit "Ventil_Begrenzt" als VALUE.',
  parts: [], modules: ['A1', 'A3'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Ventilsollwert begrenzen und ausgeben', langs: ['scl', 'fup'], tagsExtra: tg('Ventil_Prozent', 'Ventil_Begrenzt', 'Hilf_Norm'),
      start: Object.assign({ scl: '"Ventil_Begrenzt" := "Ventil_Prozent";\n' + V_SCL }, both(V_KOP0)),
      ref: Object.assign({ scl: '"Ventil_Begrenzt" := LIMIT(MN := 0.0, IN := "Ventil_Prozent", MX := 100.0);\n' + V_SCL }, both(V_KOP)),
      tests: [{ in: { Ventil_Prozent: 50.0 }, expect: { Ventil_Soll_Roh: 13824 } }, { in: { Ventil_Prozent: 120.0 }, expect: { Ventil_Soll_Roh: 27648, Ventil_Begrenzt: P(100) } }, { in: { Ventil_Prozent: -10.0 }, expect: { Ventil_Soll_Roh: 0 } }, { in: { Ventil_Prozent: 25.0 }, expect: { Ventil_Soll_Roh: 6912 } }],
      wrong: [{ scl: '"Ventil_Begrenzt" := LIMIT(MN := 0.0, IN := "Ventil_Prozent", MX := 120.0);\n' + V_SCL }, { scl: '"Ventil_Begrenzt" := LIMIT(MN := 4.0, IN := "Ventil_Prozent", MX := 20.0);\n' + V_SCL }] },
    LOAD,
    { kind: 'measure', text: 'Strom am Ausgang SM 1232 Kanal 1', ask: [{ q: 'Ventil_Prozent = 50 %: Strom an AQ 1', unit: 'mA', calc: (ctx, SM) => SM.aqSignal(13824, ctx.hw.aq.CH1), tol: 0.05 }, { q: 'Ventil_Prozent = 120 %: Strom an AQ 1', unit: 'mA', calc: (ctx, SM) => SM.aqSignal(27648, ctx.hw.aq.CH1), tol: 0.05 }] }
  ] });

defWorkshopTask({ id: 'w5_fehler_0_20', module: 5, no: 8, level: 'werkstatt', title: '20 % im leeren Tank', debug: true,
  story: 'Der Tank ist leer – ganz sicher, du siehst den Boden. Das HMI zeigt trotzdem <b>20 mbar</b>. ARIA pfeift unschuldig. Das Programm ist dasselbe wie gestern.',
  brief: '<p>Finde heraus, warum der leere Tank 20 % des Messbereichs anzeigt, und behebe den Fehler. Tipp: Das Programm ist in Ordnung – schau dir die Gerätekonfiguration von SM 1231 Kanal 0 an.</p>',
  learn: 'Einen Konfigurationsfehler (0–20 mA statt 4–20 mA) am Rohwert erkennen.', take: 'Ist der Kanal auf 0–20 mA konfiguriert, ergeben die 4 mA des leeren Tanks den Rohwert 5530 = 20 %. Messbereich des Transmitters und Konfiguration müssen zusammenpassen.',
  man: 'rohwerte', theory: 'st5b', hint: 'Welcher Rohwert steht bei leerem Tank in "Druck_Roh"?', hint2: '4 mA / 20 mA = 0,2 → 0,2 × 27648 = 5530.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig', hw: { 'ai.CH0.type': 'I_4W', 'ai.CH0.range': '0..20mA' },
  steps: [
    { kind: 'quiz', text: 'Welcher Rohwert stand bei leerem Tank (4 mA) mit der falschen Konfiguration in "Druck_Roh"?', answer: 5530, tol: 1 },
    { kind: 'config', text: 'Kanal 0 richtig konfigurieren: Strom 2-Draht, 4–20 mA', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA' } },
    LOAD,
    { kind: 'measure', text: 'Kontrolle', ask: [{ q: 'Leerer Tank (0 mbar): "Druck_Roh"', calc: A.rawAt('CH0', { B11: 0 }), tol: 5 }] },
    { kind: 'quiz', text: 'Warum ist 4–20 mA hier richtig und nicht 0–20 mA?', options: ['Der Transmitter liefert Live Zero: 4 mA ≙ 0 mbar', 'Weil 0–20 mA verboten ist', 'Weil die SM 1231 nur 4–20 mA kann', 'Weil der Tank 20 mbar Grunddruck hat'], correct: 0 }
  ] });

const T_REF = 'IF "Temp_Roh" > 32511 OR "Temp_Roh" < -4864 THEN\n  "Temp_Fehler" := TRUE;\nELSE\n  "Temp_Fehler" := FALSE;\n  ' + sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\nEND_IF;\n"Lampe_Rot" := "Temp_Fehler";\n';
const T_KOP = nets('NETWORK Sonderwert erkennen\n["Temp_Roh" > 32511] OR ["Temp_Roh" < -4864] => "Temp_Fehler", "Lampe_Rot";', kopS('Temp_Roh', '0.0', '100.0', 'Temp_C', 'NOT "Temp_Fehler" '));
defWorkshopTask({ id: 'w5_fehler_32767', module: 5, no: 9, level: 'werkstatt', title: '118,5 °C', debug: true,
  story: 'Alarm! Das HMI zeigt <b>118,5 °C</b> – im offenen Tank. Der Werkmeister prüft: Die Leitung zu -B12 ist unterbrochen. <i>„Das Wasser kocht nicht. Das Programm glaubt einfach jedem Rohwert.“</i>',
  brief: '<p>Bei Drahtbruch liefert die SM 1231 den Sonderwert <b>32767</b>, bei Unterlauf <b>−32768</b>. Die Skalierung macht daraus Unsinn.</p><p>Fange das ab:</p><ul><li>Rohwert &gt; 32511 oder &lt; −4864 → <b>"Temp_Fehler"</b> (%M10.0) = 1, <b>"Lampe_Rot"</b> an, <b>"Temp_C"</b> behält den letzten gültigen Wert.</li><li>Sonst normal skalieren, "Temp_Fehler" = 0.</li></ul>',
  learn: 'Sonderwerte vor dem Skalieren abfangen und als Fehler melden.', take: 'Nie ungeprüft skalieren: 32767 / 27648 × 100 = 118,5 °C sieht aus wie ein Messwert, ist aber eine Fehlermeldung.',
  man: 'rohwerte', theory: 'st5b', hint: 'Erst prüfen, dann skalieren – die Skalierung gehört in den ELSE-Zweig.', hint2: 'FUP: Die Skalierungsnetzwerke nur bei NOT "Temp_Fehler" ausführen.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: { base: 'tank_fertig', knives: { 'X3:2': true } },
  steps: [
    { kind: 'quiz', text: 'Wie entstehen die 118,5 °C? (Rohwert, der skaliert wurde)', answer: 32767, tol: 0 },
    { kind: 'program', text: 'Sonderwerte abfangen', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm').concat([bool('Temp_Fehler', '%M10.0', 'Messwert Temperatur ungültig')]),
      start: Object.assign({ scl: sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\n' }, both(kopS('Temp_Roh', '0.0', '100.0', 'Temp_C'))),
      ref: Object.assign({ scl: T_REF }, both(T_KOP)),
      timed: [{ steps: [[0.05, { phys: { B12: 50 } }, { Temp_C: P(50), Temp_Fehler: false, Lampe_Rot: false }], [0.05, { raw: { Temp_Roh: 32767 } }, { Temp_C: P(50), Temp_Fehler: true, Lampe_Rot: true }],
        [0.05, { raw: { Temp_Roh: -32768 } }, { Temp_C: P(50), Temp_Fehler: true }], [0.05, { phys: { B12: 60 } }, { Temp_C: P(60), Temp_Fehler: false, Lampe_Rot: false }]] }],
      wrong: [{ scl: 'IF "Temp_Roh" = 32767 THEN\n  "Temp_Fehler" := TRUE;\nELSE\n  "Temp_Fehler" := FALSE;\n  ' + sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\nEND_IF;\n"Lampe_Rot" := "Temp_Fehler";' },
        { scl: sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\n"Temp_Fehler" := "Temp_Roh" > 32511 OR "Temp_Roh" < -4864;\n"Lampe_Rot" := "Temp_Fehler";' }] },
    { kind: 'wire', text: 'Schleife wieder schliessen (Trennmesser -X3:2 zu)', target: [{ knife: 'X3:2', closed: true }], ref: { knives: { 'X3:2': false } }, wrong: [{ knives: { 'X3:1': false } }] },
    LOAD
  ] });

const B_REF = [sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), '"Fuellstand_mm" := 800.0 - "Abstand_mm";', sclS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), '"Pegel_mm" := "Druck_mbar" / 0.0981;',
  sclS('Temp_Roh', '0.0', '100.0', 'Temp_C'), sclS('Durchfluss_Roh', '0.0', '20.0', 'Durchfluss_lmin'), sclS('Sollwert_Roh', '0.0', '100.0', 'Sollwert_Prozent'),
  '"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := NORM_X(MIN := 0.0, VALUE := "Sollwert_Prozent", MAX := 100.0), MAX := 27648);',
  '"Plausi_Fehler" := ABS("Fuellstand_mm" - "Pegel_mm") > 30.0;', '"Lampe_Rot" := "Plausi_Fehler";'].join('\n') + '\n';
const B_KOP = nets(kopS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), 'NETWORK Fuellstand\n=> SUB(800.0, "Abstand_mm", "Fuellstand_mm");', kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), 'NETWORK Pegel\n=> DIV("Druck_mbar", 0.0981, "Pegel_mm");',
  kopS('Temp_Roh', '0.0', '100.0', 'Temp_C'), kopS('Durchfluss_Roh', '0.0', '20.0', 'Durchfluss_lmin'), kopS('Sollwert_Roh', '0.0', '100.0', 'Sollwert_Prozent'),
  'NETWORK Pumpe normieren\n=> NORM_X(0.0, "Sollwert_Prozent", 100.0, "Hilf_Norm");', 'NETWORK Pumpe ausgeben\n=> SCALE_X(0, "Hilf_Norm", 27648, "Pumpe_Soll_Roh");',
  'NETWORK Differenz\n=> SUB("Fuellstand_mm", "Pegel_mm", "Diff_mm");', 'NETWORK Plausibilitaet\n["Diff_mm" > 30.0] OR ["Diff_mm" < -30.0] => "Plausi_Fehler", "Lampe_Rot";');
const B_TAGS = tg('Fuellstand_mm', 'Abstand_mm', 'Druck_mbar', 'Pegel_mm', 'Temp_C', 'Durchfluss_lmin', 'Sollwert_Prozent', 'Hilf_Norm', 'Diff_mm').concat([bool('Plausi_Fehler', '%M10.0', 'Ultraschall und Druck passen nicht zusammen')]);
const lv = (L, extra) => Object.assign({ B10: 800 - L, B11: L * 0.0981 }, extra || {});
defWorkshopTask({ id: 'w5_boss_hmi', module: 5, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Tank-HMI komplett',
  story: 'Morgen kommt der Kunde zur Abnahme der Tankstation. ARIA hat das Programm bis auf die Druckanzeige gelöscht. Der Werkmeister: <i>„Alle Werte in echten Einheiten, die Pumpe folgt dem Sollwertsteller – und wenn Ultraschall und Druck sich widersprechen, will ich das sehen.“</i>',
  brief: '<ol><li><b>"Fuellstand_mm"</b> aus -B10 (60–800 mm, Einbauhöhe 800 mm), <b>"Pegel_mm"</b> aus "Druck_mbar" (1 mm ≈ 0,0981 mbar).</li><li><b>"Druck_mbar"</b> 0–100, <b>"Temp_C"</b> 0–100, <b>"Durchfluss_lmin"</b> 0–20 (%IW100).</li><li><b>"Sollwert_Prozent"</b> aus -R1 ("Sollwert_Roh", %IW66, 0–100 %) → <b>"Pumpe_Soll_Roh"</b> (%QW112).</li><li><b>Plausibilität:</b> Weichen "Fuellstand_mm" und "Pegel_mm" um mehr als <b>30 mm</b> (5 % von 600 mm) ab → <b>"Plausi_Fehler"</b> (%M10.0) und <b>"Lampe_Rot"</b>. FUP: Differenz in "Diff_mm".</li><li>Laden, RUN.</li></ol>',
  learn: 'Alle Messwerte einer Anlage skalieren, einen Sollwert ausgeben und zwei Messprinzipien vergleichen.', take: 'Zwei unabhängige Messprinzipien (Schall und Druck) kontrollieren sich gegenseitig. Passen sie nicht zusammen, ist einer der beiden falsch – und das Programm meldet es.',
  man: 'normx', theory: 'st5b', hint: 'Baue Messstelle für Messstelle – das Muster ist immer dasselbe.', hint2: 'ABS("Fuellstand_mm" - "Pegel_mm") > 30.0 — in FUP: Differenz mit SUB, dann zwei Vergleicher parallel.',
  parts: ['B10', 'B11', 'B12', 'B13', 'R1'], modules: ['A1', 'A2', 'A3'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Tank-HMI programmieren', langs: ['scl', 'fup'], tagsExtra: B_TAGS, must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: DRUCK_REF + '\n' }, both(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'))),
      ref: Object.assign({ scl: B_REF }, both(B_KOP)),
      tests: [{ phys: lv(300, { B12: 40, B13: 12, R1: 50 }), expect: { Fuellstand_mm: [300, 0.5], Pegel_mm: [300, 0.5], Druck_mbar: [29.43, 0.05], Temp_C: P(40), Durchfluss_lmin: [12, 0.02], Sollwert_Prozent: P(50), Pumpe_Soll_Roh: [13824, 2], Plausi_Fehler: false, Lampe_Rot: false } },
        { phys: lv(300, { B10: 200, R1: 0 }), expect: { Fuellstand_mm: [600, 0.5], Plausi_Fehler: true, Lampe_Rot: true, Pumpe_Soll_Roh: 0 } },
        { phys: lv(500, { B10: 800, R1: 100 }), expect: { Fuellstand_mm: [0, 0.5], Plausi_Fehler: true, Pumpe_Soll_Roh: [27648, 2] } },
        { phys: lv(500, { R1: 25 }), expect: { Plausi_Fehler: false, Pumpe_Soll_Roh: [6912, 2] } }],
      wrong: [{ scl: B_REF.replace('ABS("Fuellstand_mm" - "Pegel_mm") > 30.0', '"Fuellstand_mm" - "Pegel_mm" > 30.0') }, { scl: B_REF.replace('"Fuellstand_mm" := 800.0 - "Abstand_mm";', '"Fuellstand_mm" := "Abstand_mm";') },
        { scl: B_REF.replace("MIN := 60.0", "MIN := 0.0") }] },
    LOAD
  ] });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/m6.js ==== */
/* ===== SENSORWERKSTATT Modul 6: Messwerte sicher verarbeiten ===== */
(function(root){
const A = root.SW_ANALOG, { AW, NEED, tg, bool, sclS, kopS, nets, both } = A;
const { need } = root.SW;
root.SW_CHAPTER({ n:6, title:'Messwerte sicher verarbeiten', subtitle:'Hysterese · Kalibrieren · Plausibilität', icon:'fa-shield-halved',
  intro:'Die Werte stimmen – jetzt muss die Anlage richtig darauf reagieren. Heizung, Alarme, Trockenlauf: ARIA hofft auf flatternde Relais und überlaufende Tanks. Zum Schluss wartet das <b>Werkstatt-Finale</b>.',
  anim: root.SW_CHAPTER_ANIM('EIN < 58 °C · AUS > 62 °C') });
const P = v => [v, 0.05];
const LOAD = { kind: 'load', text: 'In das Gerät laden und CPU starten' };
const TEMP = sclS('Temp_Roh', '0.0', '100.0', 'Temp_C'), TEMP_K = kopS('Temp_Roh', '0.0', '100.0', 'Temp_C');
const US = sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := 800.0 - "Abstand_mm";';
const US_K = nets(kopS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), 'NETWORK Fuellstand\n=> SUB(800.0, "Abstand_mm", "Fuellstand_mm");');
const DRUCK = sclS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), DRUCK_K = kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar');
const T = c => ({ phys: { B12: c } }), L = mm => ({ phys: { B10: 800 - mm } });
const hystS = (v, x, on, off, rel) => 'IF "' + x + '" ' + (rel || '<') + ' ' + on + ' THEN\n  "' + v + '" := TRUE;\nELSIF "' + x + '" ' + (rel === '>' ? '<' : '>') + ' ' + off + ' THEN\n  "' + v + '" := FALSE;\nEND_IF;';
const hystK = (v, x, on, off, rel) => 'NETWORK ' + v + ' ein\n["' + x + '" ' + (rel || '<') + ' ' + on + '] => S "' + v + '";\n\nNETWORK ' + v + ' aus\n["' + x + '" ' + (rel === '>' ? '<' : '>') + ' ' + off + '] => R "' + v + '";';

/* ---------- 1 Heizung mit Hysterese ---------- */
defWorkshopTask({ id: 'w6_heizung_hysterese', module: 6, no: 1, level: 'schnell', title: 'Heizung mit Hysterese',
  story: 'Das Wasser soll auf etwa 60 °C gehalten werden. ARIAs Programm schaltet bei 60,0 °C – das Halbleiterrelais -K3 klickt im Takt der Messwertschwankung.',
  brief: '<p>Die Temperaturskalierung ist vorgegeben. Steuere <b>"Heizung"</b> (%Q0.5) mit <b>Hysterese</b>:</p><ul><li>Temperatur <b>&lt; 58 °C</b> → Heizung EIN</li><li>Temperatur <b>&gt; 62 °C</b> → Heizung AUS</li><li>dazwischen: Zustand beibehalten</li></ul>',
  learn: 'Einen Zweipunktregler mit Hysterese programmieren.', take: 'Hysterese = zwei Schaltschwellen. Zwischen den Schwellen merkt sich der Ausgang seinen Zustand – so flattert nichts.',
  man: 'hysterese', theory: 'st6a', hint: 'IF … < 58.0 THEN "Heizung" := TRUE; ELSIF … > 62.0 THEN "Heizung" := FALSE; END_IF;', hint2: 'FUP: Vergleicher < 58 setzt (S), Vergleicher > 62 setzt zurück (R).',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Heizung mit Hysterese', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm'),
      start: Object.assign({ scl: TEMP + '\n"Heizung" := "Temp_C" < 60.0;\n' }, both(nets(TEMP_K, 'NETWORK Heizung\n["Temp_C" < 60.0] => "Heizung";'))),
      ref: Object.assign({ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '58.0', '62.0') + '\n' }, both(nets(TEMP_K, hystK('Heizung', 'Temp_C', '58.0', '62.0')))),
      timed: [{ steps: [[0.05, T(55), { Heizung: true }], [0.05, T(59), { Heizung: true }], [0.05, T(61), { Heizung: true }], [0.05, T(63), { Heizung: false }], [0.05, T(61), { Heizung: false }], [0.05, T(59), { Heizung: false }], [0.05, T(57), { Heizung: true }]] }],
      wrong: [{ scl: TEMP + '\nIF "Temp_C" < 58.0 THEN\n  "Heizung" := TRUE;\nEND_IF;' }, { scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '62.0', '58.0') }] },
    LOAD
  ] });

/* ---------- 2 Füllstand Warnung/Alarm ---------- */
const F_TAGS = tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm').concat([bool('Warn_Hoch', '%M10.0', 'Warnung Füllstand hoch'), bool('Alarm_Hoch', '%M10.1', 'Alarm Füllstand hoch'), bool('Warn_Tief', '%M10.2', 'Warnung Füllstand tief')]);
const F_REF = [US, hystS('Warn_Hoch', 'Fuellstand_mm', '500.0', '480.0', '>'), hystS('Alarm_Hoch', 'Fuellstand_mm', '550.0', '530.0', '>'), hystS('Warn_Tief', 'Fuellstand_mm', '100.0', '120.0'),
  '"Lampe_Rot" := "Warn_Hoch" OR "Warn_Tief";', '"Hupe" := "Alarm_Hoch";'].join('\n') + '\n';
const F_KOP = nets(US_K, hystK('Warn_Hoch', 'Fuellstand_mm', '500.0', '480.0', '>'), hystK('Alarm_Hoch', 'Fuellstand_mm', '550.0', '530.0', '>'), hystK('Warn_Tief', 'Fuellstand_mm', '100.0', '120.0'),
  'NETWORK Lampe\n"Warn_Hoch" OR "Warn_Tief" => "Lampe_Rot";', 'NETWORK Hupe\n"Alarm_Hoch" => "Hupe";');
const F_START = US + '\n"Lampe_Rot" := "Fuellstand_mm" > 500.0 OR "Fuellstand_mm" < 100.0;\n"Hupe" := "Fuellstand_mm" > 550.0;\n';
const F_START_K = nets(US_K, 'NETWORK Lampe\n["Fuellstand_mm" > 500.0] OR ["Fuellstand_mm" < 100.0] => "Lampe_Rot";', 'NETWORK Hupe\n["Fuellstand_mm" > 550.0] => "Hupe";');
defWorkshopTask({ id: 'w6_fuellstand_grenzen', module: 6, no: 2, level: 'schnell', title: 'Warnung und Alarm',
  story: 'Beim Befüllen tanzt die Wasseroberfläche. Die rote Lampe blinkt nervös um 500 mm herum, die Hupe quäkt im Sekundentakt. Der Bediener hält sich die Ohren zu.',
  brief: '<p>Füllstandsgrenzen mit Hysterese (Füllstand aus -B10 ist vorgegeben):</p><table><tr><th>Meldung</th><th>kommt</th><th>geht</th><th>Ausgang</th></tr><tr><td>"Warn_Hoch" (%M10.0)</td><td>&gt; 500 mm</td><td>&lt; 480 mm</td><td>"Lampe_Rot"</td></tr><tr><td>"Alarm_Hoch" (%M10.1)</td><td>&gt; 550 mm</td><td>&lt; 530 mm</td><td>"Hupe"</td></tr><tr><td>"Warn_Tief" (%M10.2)</td><td>&lt; 100 mm</td><td>&gt; 120 mm</td><td>"Lampe_Rot"</td></tr></table>',
  learn: 'Warn- und Alarmgrenzen mit Hysterese programmieren.', take: 'Jede Grenze hat einen Kommt- und einen Geht-Wert. Warnung vor Alarm: Der Bediener kann reagieren, bevor es kritisch wird.',
  man: 'hysterese', theory: 'st6a', hint: 'Für jede Meldung ein IF … ELSIF … END_IF mit zwei Schwellen.', hint2: '"Lampe_Rot" := "Warn_Hoch" OR "Warn_Tief"; "Hupe" := "Alarm_Hoch";',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Füllstandsmeldungen mit Hysterese', langs: ['scl', 'fup'], tagsExtra: F_TAGS,
      start: Object.assign({ scl: F_START }, both(F_START_K)), ref: Object.assign({ scl: F_REF }, both(F_KOP)),
      timed: [{ steps: [[0.05, L(300), { Lampe_Rot: false, Hupe: false }], [0.05, L(490), { Lampe_Rot: false }], [0.05, L(510), { Warn_Hoch: true, Lampe_Rot: true, Hupe: false }], [0.05, L(490), { Lampe_Rot: true }],
        [0.05, L(470), { Lampe_Rot: false }], [0.05, L(560), { Lampe_Rot: true, Hupe: true }], [0.05, L(540), { Hupe: true }], [0.05, L(520), { Hupe: false, Lampe_Rot: true }],
        [0.05, L(90), { Warn_Hoch: false, Warn_Tief: true, Lampe_Rot: true }], [0.05, L(110), { Lampe_Rot: true }], [0.05, L(130), { Lampe_Rot: false, Hupe: false }]] }],
      wrong: [{ scl: F_REF.replace("530.0", "550.0") }, { scl: F_REF.replace('"Lampe_Rot" := "Warn_Hoch" OR "Warn_Tief";', '"Lampe_Rot" := "Warn_Hoch";') }] },
    LOAD
  ] });

/* ---------- 3 Offset-Kalibrierung ---------- */
const scaledDist = (SM, d) => { const raw = SM.rawValue(SM.transmitterSignal('B10', d), { type: 'U', range: '0..10V' }); return 60 + raw / 27648 * 740; };
defWorkshopTask({ id: 'w6_offset', module: 6, no: 3, level: 'werkstatt', title: 'Offset: 12 mm im leeren Tank',
  story: 'Der Tank ist leer, das HMI zeigt <b>12 mm</b>. Der Werkmeister misst nach: Der Halter von -B10 wurde beim Umbau 12 mm tiefer gesetzt. <i>„Nicht den Halter verbiegen – kalibrieren.“</i>',
  brief: '<ol><li>Tank leer: Lies "Fuellstand_mm" im alten Programm ab (Abstand -B10 zur Oberfläche jetzt <b>788 mm</b>).</li><li>Bestimme den Offset und korrigiere die Berechnung: Füllstand = Einbauhöhe − Abstand, mit der <b>tatsächlichen</b> Einbauhöhe.</li><li>Laden und prüfen.</li></ol>',
  learn: 'Einen Nullpunktfehler (Offset) messen und im Programm korrigieren.', take: 'Offset = Anzeige bei bekanntem Nullpunkt. Korrigieren durch Abziehen – oder gleich die richtige Einbauhöhe verwenden. Kalibrierwerte dokumentieren!',
  man: 'messen', theory: 'st6a', hint: 'Der Sensor sitzt jetzt auf 788 mm statt 800 mm.', hint2: '"Fuellstand_mm" := 788.0 - "Abstand_mm";',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'measure', text: 'Tank leer, altes Programm', ask: [{ q: 'Leerer Tank: Anzeige "Fuellstand_mm"', unit: 'mm', calc: (ctx, SM) => 800 - scaledDist(SM, 788), tol: 0.5 }] },
    { kind: 'program', text: 'Offset korrigieren', langs: ['scl', 'fup'], tagsExtra: tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm'),
      start: Object.assign({ scl: US + '\n' }, both(US_K)),
      ref: Object.assign({ scl: US.replace('800.0 -', '788.0 -') + '\n' }, both(US_K.replace('SUB(800.0', 'SUB(788.0'))),
      tests: [{ phys: { B10: 788 }, expect: { Fuellstand_mm: [0, 0.3] } }, { phys: { B10: 488 }, expect: { Fuellstand_mm: [300, 0.3] } }, { phys: { B10: 188 }, expect: { Fuellstand_mm: [600, 0.3] } }],
      wrong: [{ scl: US.replace('800.0 -', '812.0 -') }, { scl: US.replace('800.0 - "Abstand_mm"', '800.0 - "Abstand_mm" - 1.2') }] },
    LOAD
  ] });

/* ---------- 4 2-Punkt-Kalibrierung ---------- */
const ZP = '"Pegel_mm" := SCALE_X(MIN := 100.0, VALUE := NORM_X(MIN := 2712, VALUE := "Druck_Roh", MAX := 13561), MAX := 500.0);\n';
const ZP_K = 'NETWORK Normieren\n=> NORM_X(2712, "Druck_Roh", 13561, "Hilf_Norm");\n\nNETWORK Skalieren\n=> SCALE_X(100.0, "Hilf_Norm", 500.0, "Pegel_mm");';
defWorkshopTask({ id: 'w6_zweipunkt', module: 6, no: 4, level: 'werkstatt', title: '2-Punkt-Kalibrierung',
  story: 'Der Werkmeister traut keiner Formel, die er nicht selbst geprüft hat. <i>„Wir füllen auf zwei bekannte Pegel, lesen den Massstab ab und schreiben die Rohwerte auf. Das ist die ehrlichste Kalibrierung.“</i>',
  brief: '<ol><li>Tank auf <b>100 mm</b> (Massstab) füllen, "Druck_Roh" ablesen. Dann auf <b>500 mm</b>, wieder ablesen.</li><li>Die beiden Punkte in NORM_X (MIN/MAX = Rohwerte) und SCALE_X (MIN/MAX = 100 / 500 mm) eintragen → <b>"Pegel_mm"</b>.</li><li>Laden und prüfen. Werte ausserhalb der beiden Punkte rechnet die Gerade weiter (extrapoliert).</li></ol>',
  learn: 'Eine Messkette mit zwei Referenzpunkten kalibrieren.', take: 'Mit zwei gemessenen Punkten ist die Gerade festgelegt – Nullpunkt und Steigung der ganzen Messkette (Transmitter, Leitung, Baugruppe) werden auf einmal korrigiert.',
  man: 'messen', theory: 'st6b', hint: 'NORM_X(MIN := Rohwert bei 100 mm, VALUE := "Druck_Roh", MAX := Rohwert bei 500 mm)', hint2: 'SCALE_X(MIN := 100.0, …, MAX := 500.0)',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'measure', text: 'Kalibrierpunkte aufnehmen', ask: [{ q: 'Pegel 100 mm (Massstab): "Druck_Roh"', calc: A.rawAt('CH0', { B11: 9.81 }), tol: 2 }, { q: 'Pegel 500 mm (Massstab): "Druck_Roh"', calc: A.rawAt('CH0', { B11: 49.05 }), tol: 2 }] },
    { kind: 'quiz', text: 'Steigung: Wie viele mm entspricht ein Digit? (400 mm / Rohwertdifferenz)', answer: 0.0369, tol: 0.0005, unit: 'mm' },
    { kind: 'program', text: '2-Punkt-Kalibrierung eintragen', langs: ['scl', 'fup'], tagsExtra: tg('Pegel_mm', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Pegel_mm" := 0.0;\n' }, both('NETWORK Pegel\n=> MOVE(0.0, "Pegel_mm");')), ref: Object.assign({ scl: ZP }, both(ZP_K)),
      tests: [{ phys: { B11: 9.81 }, expect: { Pegel_mm: [100, 1] } }, { phys: { B11: 29.43 }, expect: { Pegel_mm: [300, 1] } }, { phys: { B11: 49.05 }, expect: { Pegel_mm: [500, 1] } }, { phys: { B11: 0 }, expect: { Pegel_mm: [0, 1.5] } }, { phys: { B11: 58.86 }, expect: { Pegel_mm: [600, 1.5] } }],
      wrong: [{ scl: '"Pegel_mm" := SCALE_X(MIN := 100.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648), MAX := 500.0);' }, { scl: '"Pegel_mm" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 2712, VALUE := "Druck_Roh", MAX := 13561), MAX := 500.0);' }] },
    LOAD
  ] });

/* ---------- 5 Gleitender Mittelwert ---------- */
const MW = [1, 2, 3, 4, 5, 6, 7, 8];
const MW_TAGS = tg('Druck_mbar', 'Hilf_Norm').concat(MW.map(i => ({ name: 'MW_' + i, type: 'Real', addr: '%MD' + (96 + 4 * i), comment: 'Mittelwert-Speicher ' + i })),
  [{ name: 'MW_Summe', type: 'Real', addr: '%MD136', comment: 'Summe' }, { name: 'Druck_Mittel', type: 'Real', addr: '%MD140', comment: 'HMI Druck gemittelt' }]);
const MW_REF = DRUCK + '\n' + [8, 7, 6, 5, 4, 3, 2].map(i => '"MW_' + i + '" := "MW_' + (i - 1) + '";').join('\n') + '\n"MW_1" := "Druck_mbar";\n"Druck_Mittel" := ("MW_1" + "MW_2" + "MW_3" + "MW_4" + "MW_5" + "MW_6" + "MW_7" + "MW_8") / 8.0;\n';
const MW_KOP = nets(DRUCK_K, 'NETWORK Schieben\n=> ' + [8, 7, 6, 5, 4, 3, 2].map(i => 'MOVE("MW_' + (i - 1) + '", "MW_' + i + '")').join(', ') + ', MOVE("Druck_mbar", "MW_1");',
  'NETWORK Summe\n=> ADD("MW_1", "MW_2", "MW_Summe"), ' + [3, 4, 5, 6, 7, 8].map(i => 'ADD("MW_Summe", "MW_' + i + '", "MW_Summe")').join(', ') + ';', 'NETWORK Mittelwert\n=> DIV("MW_Summe", 8.0, "Druck_Mittel");');
const D = v => ({ phys: { B11: v } });
defWorkshopTask({ id: 'w6_mittelwert', module: 6, no: 5, level: 'werkstatt', title: 'Gleitender Mittelwert',
  story: 'Wenn die Pumpe läuft, schwappt das Wasser – der Druckwert zittert. Der Werkmeister: <i>„Die Baugruppe kann glätten. Aber du sollst verstehen, was sie da tut.“</i>',
  brief: '<p>Bilde einen <b>gleitenden Mittelwert über die letzten 8 Werte</b> von "Druck_mbar" in <b>"Druck_Mittel"</b> (%MD140):</p><ol><li>Jeden Zyklus alle Speicher um eins weiterschieben: MW_8 := MW_7, …, MW_2 := MW_1 (von hinten beginnen!).</li><li>MW_1 := neuer Messwert.</li><li>Mittelwert = Summe der 8 Speicher / 8. FUP: Summe in "MW_Summe".</li></ol><p>Die Druckskalierung ist vorgegeben.</p>',
  learn: 'Einen gleitenden Mittelwert als Schieberegister programmieren und mit der Glättung der Baugruppe vergleichen.', take: 'Der gleitende Mittelwert glättet Rauschen, reagiert aber verzögert: Ein Sprung ist erst nach 8 Zyklen ganz angekommen. Die Modulglättung wirkt ähnlich, ohne Programmcode.',
  man: 'messen', theory: 'st6b', hint: 'Von hinten schieben – sonst überschreibst du MW_2, bevor MW_3 ihn übernommen hat.', hint2: '"Druck_Mittel" := ("MW_1" + … + "MW_8") / 8.0;',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Gleitenden Mittelwert programmieren', langs: ['scl', 'fup'], tagsExtra: MW_TAGS,
      start: Object.assign({ scl: DRUCK + '\n"Druck_Mittel" := "Druck_mbar";\n' }, both(nets(DRUCK_K, 'NETWORK Mittelwert\n=> MOVE("Druck_mbar", "Druck_Mittel");'))),
      ref: Object.assign({ scl: MW_REF }, both(MW_KOP)),
      timed: [{ steps: [[0.05, D(40), { Druck_Mittel: P(5) }], [0.05, {}, { Druck_Mittel: P(10) }], [0.05, {}, {}], [0.05, {}, {}], [0.05, {}, {}], [0.05, {}, {}], [0.05, {}, { Druck_Mittel: P(35) }], [0.05, {}, { Druck_Mittel: P(40) }],
        [0.05, D(48), { Druck_Mittel: P(41) }], [0.05, D(40), { Druck_Mittel: P(41) }], [0.05, {}, { Druck_Mittel: P(41) }], [0.05, D(32), { Druck_Mittel: P(40) }]] }],
      wrong: [{ scl: DRUCK + '\n' + [2, 3, 4, 5, 6, 7, 8].map(i => '"MW_' + i + '" := "MW_' + (i - 1) + '";').join('\n') + '\n"MW_1" := "Druck_mbar";\n"Druck_Mittel" := ("MW_1" + "MW_2" + "MW_3" + "MW_4" + "MW_5" + "MW_6" + "MW_7" + "MW_8") / 8.0;' },
        { scl: MW_REF.replace('/ 8.0', '/ 7.0') }] },
    { kind: 'quiz', text: 'Die SM 1231 hat die Glättung „mittel“ (16 Zyklen). Was ist der Unterschied zu deinem Programm?', options: ['Gleiche Idee (mitteln gegen Rauschen), aber in der Baugruppe und ohne Programmcode – der Messwert reagiert noch träger', 'Die Modulglättung entfernt nur Drahtbrüche', 'Die Modulglättung macht den Wert genauer, aber nicht ruhiger', 'Es gibt keinen Unterschied, beide rechnen über 8 Werte'], correct: 0 },
    { kind: 'quiz', text: 'Nach einem Sprung von 40 auf 48 mbar: Nach wie vielen Zyklen zeigt "Druck_Mittel" den neuen Wert ganz?', answer: 8, tol: 0 },
    LOAD
  ] });

/* ---------- 6 Plausibilität mit Zeitverzögerung ---------- */
const PL_TAGS = tg('Abstand_mm', 'Fuellstand_mm', 'Druck_mbar', 'Pegel_mm', 'Diff_mm', 'Hilf_Norm').concat([bool('Plausi_Fehler', '%M10.0', 'Ultraschall ≠ Druck')]);
const PL_BASE = US + '\n' + DRUCK + '\n"Pegel_mm" := "Druck_mbar" / 0.0981;\n';
const PL_BASE_K = nets(US_K, DRUCK_K, 'NETWORK Pegel\n=> DIV("Druck_mbar", 0.0981, "Pegel_mm");');
const PL_REF = PL_BASE + '"T_Plausi"(IN := ABS("Fuellstand_mm" - "Pegel_mm") > 30.0, PT := T#2S);\n"Plausi_Fehler" := "T_Plausi".Q;\n"Lampe_Rot" := "Plausi_Fehler";\n';
const PL_KOP = nets(PL_BASE_K, 'NETWORK Differenz\n=> SUB("Fuellstand_mm", "Pegel_mm", "Diff_mm");', 'NETWORK Plausibilitaet\n(["Diff_mm" > 30.0] OR ["Diff_mm" < -30.0]) AND TON(T_Plausi, T#2S) => "Plausi_Fehler", "Lampe_Rot";');
const PH = (us, dr) => ({ phys: { B10: 800 - us, B11: dr * 0.0981 } });
defWorkshopTask({ id: 'w6_plausi', module: 6, no: 6, level: 'werkstatt', title: 'Zwei Messprinzipien',
  story: 'Ultraschall und Druck messen beide den Füllstand – auf völlig verschiedene Art. Wenn jemand ein Tuch über -B10 hängt, merkt es nur der Vergleich. ARIA hält schon ein Tuch in der Hand.',
  brief: '<p>Vergleiche <b>"Fuellstand_mm"</b> (Ultraschall) und <b>"Pegel_mm"</b> (Druck, beide vorgegeben):</p><ul><li>Abweichung <b>mehr als 30 mm</b> (5 % von 600 mm) – in beide Richtungen –</li><li>länger als <b>2 s</b> (Wellen beim Befüllen sind kein Fehler) →</li><li><b>"Plausi_Fehler"</b> (%M10.0) und <b>"Lampe_Rot"</b>.</li></ul><p>Zeitinstanz <b>"T_Plausi"</b> (TON). FUP: Differenz in "Diff_mm".</p>',
  learn: 'Zwei Messprinzipien mit Toleranz und Zeitverzögerung vergleichen.', take: 'Plausibilitätsprüfung: Toleranzband gegen Messunsicherheit, Zeitverzögerung gegen kurze Störungen, Betrag gegen beide Richtungen.',
  man: 'messen', theory: 'st6b', hint: 'ABS("Fuellstand_mm" - "Pegel_mm") > 30.0 als IN des Timers.', hint2: 'FUP: SUB in "Diff_mm", dann [Diff > 30] parallel zu [Diff < -30] vor TON.',
  parts: ['B10', 'B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Plausibilität programmieren', langs: ['scl', 'fup'], fb: { T_Plausi: 'TON' }, tagsExtra: PL_TAGS,
      start: Object.assign({ scl: PL_BASE }, both(PL_BASE_K)), ref: Object.assign({ scl: PL_REF }, both(PL_KOP)),
      timed: [{ steps: [[0, PH(300, 300), { Plausi_Fehler: false }], [0.5, PH(600, 300), { Plausi_Fehler: false }], [1.0, {}, { Plausi_Fehler: false }], [0.9, {}, { Plausi_Fehler: false }], [0.2, {}, { Plausi_Fehler: true, Lampe_Rot: true }],
        [0.5, PH(310, 300), { Plausi_Fehler: false, Lampe_Rot: false }], [0.5, PH(0, 300), { Plausi_Fehler: false }], [1.0, {}, { Plausi_Fehler: false }], [1.1, {}, { Plausi_Fehler: true }], [0.5, PH(300, 320), { Plausi_Fehler: false }]] }],
      wrong: [{ scl: PL_BASE + '"Plausi_Fehler" := ABS("Fuellstand_mm" - "Pegel_mm") > 30.0;\n"Lampe_Rot" := "Plausi_Fehler";' },
        { scl: PL_BASE + '"T_Plausi"(IN := "Fuellstand_mm" - "Pegel_mm" > 30.0, PT := T#2S);\n"Plausi_Fehler" := "T_Plausi".Q;\n"Lampe_Rot" := "Plausi_Fehler";' }] },
    LOAD
  ] });

/* ---------- 7 Trockenlauf und Tank voll ---------- */
const TL_TAGS = tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm').concat([bool('Pumpe_Anf', '%M10.0', 'HMI Pumpe ein'), bool('Heizung_Anf', '%M10.1', 'HMI Heizung ein'), bool('Trockenlauf', '%M10.2', 'Trockenlaufschutz aktiv')]);
const TL_REF = US + '\n"Trockenlauf" := NOT "Vorrat_Ok" OR "Fuellstand_mm" < 60.0;\n"Pumpe_Frei" := "Pumpe_Anf" AND "Vorrat_Ok" AND "Tank_Nicht_Voll";\n"Heizung" := "Heizung_Anf" AND NOT "Trockenlauf";\n"Lampe_Rot" := "Trockenlauf";\n';
const TL_KOP = nets(US_K, 'NETWORK Trockenlauf\nNOT "Vorrat_Ok" OR ["Fuellstand_mm" < 60.0] => "Trockenlauf", "Lampe_Rot";', 'NETWORK Pumpe\n"Pumpe_Anf" AND "Vorrat_Ok" AND "Tank_Nicht_Voll" => "Pumpe_Frei";', 'NETWORK Heizung\n"Heizung_Anf" AND NOT "Trockenlauf" => "Heizung";');
const TL_START = US + '\n"Pumpe_Frei" := "Pumpe_Anf";\n"Heizung" := "Heizung_Anf";\n';
const TL_START_K = nets(US_K, 'NETWORK Pumpe\n"Pumpe_Anf" => "Pumpe_Frei";', 'NETWORK Heizung\n"Heizung_Anf" => "Heizung";');
const tl = (mm, vo, nv, exp) => ({ in: { Pumpe_Anf: true, Heizung_Anf: true, Vorrat_Ok: vo, Tank_Nicht_Voll: nv }, phys: { B10: 800 - mm }, expect: exp });
defWorkshopTask({ id: 'w6_trockenlauf', module: 6, no: 7, level: 'werkstatt', title: 'Trockenlauf und Tank voll',
  story: 'Eine Kreiselpumpe ohne Wasser läuft sich heiss, ein Heizstab ohne Wasser brennt durch, ein voller Tank läuft über. ARIA möchte alle drei Varianten ausprobieren.',
  brief: '<ul><li><b>"Trockenlauf"</b> (%M10.2) = Schwimmer -B9 meldet Vorrat leer (<b>"Vorrat_Ok"</b> = 0) <b>ODER</b> Füllstand im Tank &lt; <b>10 %</b> (60 mm). → <b>"Lampe_Rot"</b>.</li><li><b>"Pumpe_Frei"</b> = "Pumpe_Anf" (%M10.0) UND Vorrat da UND Tank <b>nicht</b> voll. -B8 ist als <b>Öffner</b> verdrahtet: <b>"Tank_Nicht_Voll"</b> = 1 heisst „nicht voll“.</li><li><b>"Heizung"</b> = "Heizung_Anf" (%M10.1) UND kein Trockenlauf (der Heizstab muss unter Wasser sein).</li></ul>',
  learn: 'Schutzfunktionen aus Grenzwertschaltern und Analogwerten programmieren – mit Öffner-Auswertung.', take: 'Schutzfunktionen verknüpfen mehrere Quellen. Ein als Öffner verdrahteter Grenzschalter wird ohne NOT abgefragt – bei Drahtbruch stoppt die Pumpe von selbst.',
  man: 'nonc', theory: 'st6b', hint: '"Tank_Nicht_Voll" ist in Ruhe (Tank nicht voll) 1 – einfach mit AND verknüpfen.', hint2: '"Trockenlauf" := NOT "Vorrat_Ok" OR "Fuellstand_mm" < 60.0;',
  parts: ['B8', 'B9', 'B10'], modules: ['A1'], x2: [13, 14], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Trockenlaufschutz und Tank-voll-Abschaltung', langs: ['scl', 'fup'], tagsExtra: TL_TAGS,
      start: Object.assign({ scl: TL_START }, both(TL_START_K)), ref: Object.assign({ scl: TL_REF }, both(TL_KOP)),
      tests: [tl(300, true, true, { Pumpe_Frei: true, Heizung: true, Trockenlauf: false, Lampe_Rot: false }), tl(300, false, true, { Pumpe_Frei: false, Heizung: false, Trockenlauf: true, Lampe_Rot: true }),
        tl(300, true, false, { Pumpe_Frei: false, Heizung: true }), tl(40, true, true, { Pumpe_Frei: true, Heizung: false, Trockenlauf: true }), tl(70, true, true, { Heizung: true, Trockenlauf: false })],
      wrong: [{ scl: TL_REF.replace('AND "Tank_Nicht_Voll"', 'AND NOT "Tank_Nicht_Voll"') }, { scl: TL_REF.replace('"Heizung_Anf" AND NOT "Trockenlauf"', '"Heizung_Anf" AND "Vorrat_Ok"') }, { scl: TL_REF.replace('NOT "Vorrat_Ok" OR', 'NOT "Vorrat_Ok" AND') }] },
    LOAD
  ] });

/* ---------- 8 Fehlersuche: Heizung taktet ---------- */
defWorkshopTask({ id: 'w6_fehler_takt', module: 6, no: 8, level: 'schnell', title: 'Klick – klack – klick', debug: true,
  story: 'Im Nachtbetrieb soll das Wasser auf 40 °C bleiben. Das Halbleiterrelais -K3 schaltet im Sekundentakt. ARIA: <i>„Ich habe doch zwei Schwellen programmiert!“</i>',
  brief: '<p>Das Programm hat zwei Vergleicher – trotzdem taktet die Heizung. Finde den Fehler und korrigiere: Heizung <b>EIN unter 38 °C</b>, <b>AUS über 42 °C</b>.</p>',
  learn: 'Eine fehlende Hysterese im Programm erkennen und beheben.', take: 'Zwei Vergleicher mit derselben Schwelle sind keine Hysterese. Erst ein Abstand zwischen Ein- und Ausschaltschwelle beruhigt den Ausgang.',
  man: 'hysterese', theory: 'st6b', hint: 'Schau dir die beiden Schwellen an. Wie gross ist der Abstand?', hint2: '< 38.0 setzt, > 42.0 setzt zurück.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Hysterese korrigieren', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm'),
      start: Object.assign({ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '40.0', '40.0') + '\n' }, both(nets(TEMP_K, hystK('Heizung', 'Temp_C', '40.0', '40.0')))),
      ref: Object.assign({ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '38.0', '42.0') + '\n' }, both(nets(TEMP_K, hystK('Heizung', 'Temp_C', '38.0', '42.0')))),
      timed: [{ steps: [[0.05, T(35), { Heizung: true }], [0.05, T(39.5), { Heizung: true }], [0.05, T(40.5), { Heizung: true }], [0.05, T(41.5), { Heizung: true }], [0.05, T(42.5), { Heizung: false }], [0.05, T(39.5), { Heizung: false }], [0.05, T(37.5), { Heizung: true }]] }],
      wrong: [{ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '39.5', '40.5') }, { scl: TEMP + '\n"Heizung" := "Temp_C" < 40.0;' }] },
    { kind: 'quiz', text: 'Warum hat das alte Programm getaktet?', options: ['Ein- und Ausschaltschwelle waren gleich (40 °C) – jedes Rauschen um 40 °C schaltet um', 'Die Temperatur war falsch skaliert', 'Das Halbleiterrelais war defekt', 'Die CPU war zu langsam'], correct: 0 },
    LOAD
  ] });

/* ---------- 9 Fehlersuche: -B8 ---------- */
const B8_OK = [['B8:BN', 'X2:13.L+'], ['B8:BU', 'X2:13.M'], ['B8:WH', 'X2:13.S']];
defWorkshopTask({ id: 'w6_fehler_b8', module: 6, no: 9, level: 'werkstatt', title: 'Der Tank läuft über', debug: true,
  story: 'Nasse Füsse im Labor: Der Messtank ist übergelaufen. Die Pumpe lief weiter, obwohl -B8 „Tank voll“ angezeigt hat – die gelbe LED am Sensor leuchtete. Das Programm fragt "Tank_Nicht_Voll" korrekt als Öffner ab.',
  brief: '<p>-B8 ist ein kapazitiver Grenzschalter mit <b>antivalenten</b> Ausgängen: BK = Schliesser (1 bei vollem Tank), WH = Öffner (1 bei nicht vollem Tank). Laut Klemmenplan soll <b>der Öffner</b> auf -X2:13 (%I1.4, "Tank_Nicht_Voll") liegen.</p><p>Finde den Fehler an -X2:13 und behebe ihn. Prüfe danach mit vollem und leerem Tank.</p>',
  learn: 'Einen als Schliesser statt Öffner angeschlossenen Grenzschalter finden.', take: 'Wird der Schliesser statt des Öffners verdrahtet, dreht sich die Logik um: „voll“ sieht aus wie „nicht voll“. Der Öffner ist drahtbruchsicher – Ader weg heisst Pumpe aus.',
  man: 'nonc', theory: 'st6b', hint: 'Welche Ader von -B8 liegt auf der Signalebene von -X2:13?', hint2: 'WH (Öffner) gehört auf -X2:13 Signal, BK bleibt frei.',
  parts: ['B8'], modules: ['A1'], x2: [13], x3: 4, start: { base: 'tank_fertig', wires: [['B8:BN', 'X2:13.L+'], ['B8:BU', 'X2:13.M'], ['B8:BK', 'X2:13.S']] },
  symptom: { cases: [{ world: { b8: true }, di: { 'I1.4': true } }] },
  steps: [
    { kind: 'wire', text: 'Öffner von -B8 auf -X2:13 legen', target: [{ net: ['B8:BN', 'POT:L+'] }, { net: ['B8:BU', 'POT:M'] }, { net: ['B8:WH', 'DI:I1.4'] }, { notNet: ['B8:BK', 'DI:I1.4'] }],
      ref: { remove: [['B8:BK', 'X2:13.S']], add: [['B8:WH', 'X2:13.S']] }, wrong: [{ remove: [], add: [] }, { add: [['B8:WH', 'X2:13.S']] }] },
    { kind: 'observe', text: 'Tank voll: %I1.4 = 0 · nicht voll: %I1.4 = 1', cases: [{ world: { b8: true }, di: { 'I1.4': false } }, { world: { b8: false }, di: { 'I1.4': true } }] },
    { kind: 'quiz', text: 'Was hätte ein Drahtbruch an -X2:13 mit der falschen Verdrahtung bewirkt?', options: ['Nichts Sichtbares bei leerem Tank – beim Vollwerden wäre der Tank ebenso übergelaufen', 'Die Pumpe wäre sofort stehen geblieben', 'Die Sicherung -F2 hätte ausgelöst', 'Der Eingang wäre dauerhaft 1'], correct: 0 },
    { kind: 'quiz', text: 'Und mit richtiger Verdrahtung (Öffner)?', options: ['%I1.4 = 0 → Pumpe aus: der sichere Zustand', 'Die Pumpe läuft weiter', 'Die Heizung schaltet ein', 'Nichts'], correct: 0 }
  ] });

/* ---------- 10 Werkstatt-Finale ---------- */
const SORT_WIRES = ['S1', 'S2', 'S3', 'S4', 'B1', 'B2', 'B3', 'B4.1', 'B4.2', 'B5', 'B6', 'B7', 'S5'].reduce((a, p) => a.concat(root.SW.field(p)), []);
defPreset('finale_sabotage', { base: 'schrank', level: 'profi', mainSwitch: true,
  wires: SORT_WIRES.concat(AW.B10, AW.B11.filter(w => w[0] !== 'A2:0-'), AW.B12, AW.B13, AW.R1, B8_OK, root.SW.c2('B9', 14)),
  shields: { B10: true, B11: true, B12: true, B13: true },
  mounts: { B1: { dist: 9, tight: false }, B2: { dist: 4, tight: true, poti: 0.6 }, B3: { dist: 60, tight: true, teach: 60 }, B6: { dist: 5, tight: true }, B7: { dist: 35, tight: true } } });
const FIN_TAGS = tg('Druck_mbar', 'Temp_C', 'Hilf_Norm');
const FIN_BAND = '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";';
const FIN_REF = [FIN_BAND, DRUCK, TEMP, hystS('Heizung', 'Temp_C', '58.0', '62.0'), '"Pumpe_Frei" := "Tank_Nicht_Voll" AND "Vorrat_Ok";'].join('\n') + '\n';
const FIN_BUG = FIN_REF.replace('VALUE := "Druck_Roh", MAX := 27648', 'VALUE := "Druck_Roh", MAX := 32767');
const FIN_KOP = nets('NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" => "Band";', DRUCK_K, TEMP_K, hystK('Heizung', 'Temp_C', '58.0', '62.0'), 'NETWORK Pumpe\n"Tank_Nicht_Voll" AND "Vorrat_Ok" => "Pumpe_Frei";');
const FIN_KOP_BUG = FIN_KOP.replace('NORM_X(0, "Druck_Roh", 27648', 'NORM_X(0, "Druck_Roh", 32767');
defWorkshopTask({ id: 'w6_finale', module: 6, no: 10, level: 'profi', final: true, title: 'Werkstatt-Finale: ARIAs Sabotage',
  story: 'Letzte Schicht. ARIA hat die ganze Werkstatt sabotiert – <b>vier Fehler</b>, verteilt auf Montage, Verdrahtung, Konfiguration und Programm. Die Sortierstrecke erkennt kein Metall, der Druck zeigt Unsinn, die Temperatur steht auf null. Der Werkmeister legt dir die Hand auf die Schulter: <i>„Du hast alles gelernt, was du brauchst. Finde sie alle.“</i>',
  brief: '<p>Profi-Stufe: spannungsfrei verdrahten, Aderendhülsen, Schirme. Bringe <b>Sortierstrecke und Tankstation gleichzeitig</b> in Betrieb:</p><ol><li><b>Montage:</b> -B1 muss Stahl sicher erkennen (Einbauabstand 4 mm, fest).</li><li><b>Verdrahtung:</b> Alle Analogschleifen müssen geschlossen sein.</li><li><b>Konfiguration:</b> Die SM 1231 muss zu den Transmittern passen (Kanal 0/1: Strom 2-Draht 4–20 mA).</li><li><b>Programm:</b> Band mit Selbsthaltung, "Druck_mbar" 0–100, "Temp_C" 0–100, Heizung mit Hysterese 58/62 °C, "Pumpe_Frei" nur bei Vorrat und Tank nicht voll.</li><li>Einschalten, Funktionsprobe, laden, RUN, Abnahme.</li></ol>',
  learn: 'Eine komplette Anlage systematisch auf Montage-, Verdrahtungs-, Konfigurations- und Programmfehler prüfen und in Betrieb nehmen.', take: 'Systematisch vorgehen: Feld (Montage) → Leitung/Klemme → Konfiguration → Programm. Jede Ebene zuerst prüfen, dann die nächste. So findet man auch vier Fehler auf einmal.',
  man: 'schrank', theory: 'st6b', hint: 'Starte am Feld: Welcher Sensor sitzt nicht, wo er sitzen soll? Dann die Analogschleifen mit dem Klemmenplan vergleichen.', hint2: 'Die vier Fehler: -B1 zu weit weg und lose · Rückleiter -A2:0− fehlt · Kanal 1 steht auf Spannung · NORM_X des Drucks rechnet mit 32767.',
  parts: ['S1', 'S2', 'S5', 'B1', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13'], modules: ['A1', 'A2', 'A3'], x2: [1, 2, 5, 12, 13, 14], x3: 4,
  start: 'preset:finale_sabotage', hw: { 'ai.CH1.type': 'U', 'ai.CH1.range': '0..10V' },
  symptom: { cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': false } }] },
  steps: [
    { kind: 'mount', text: 'Montagefehler beheben: -B1', part: 'B1', dist: [4, 0.5] },
    { kind: 'wire', text: 'Verdrahtungsfehler beheben: Analogschleifen', target: [].concat(NEED.B10, NEED.B11, NEED.B12, NEED.B13, [{ shield: 'B11' }, { shield: 'B12' }], need('B1'), need('S1'), need('S2'), need('S5')),
      ref: { add: [['A2:0-', 'X1:M7']] }, wrong: [{ add: [] }, { add: [['A2:0-', 'X1:L+8']] }] },
    { kind: 'config', text: 'Konfigurationsfehler beheben: SM 1231', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA', 'ai.CH1.type': 'I_2W', 'ai.CH1.range': '4..20mA' } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe Sortierstrecke', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true, 'I0.1': true, 'I1.3': true } }, { world: { press: ['S1'], b8: false, b9: true }, di: { 'I0.0': true, 'I0.4': false, 'I1.4': true, 'I1.5': true } }] },
    { kind: 'program', text: 'Programmfehler beheben', langs: ['scl', 'fup'], tagsExtra: FIN_TAGS,
      start: Object.assign({ scl: FIN_BUG }, both(FIN_KOP_BUG)), ref: Object.assign({ scl: FIN_REF }, both(FIN_KOP)),
      timed: [{ steps: [[0.05, { in: { Start: false, Stopp: true, Haube_Zu: true, Tank_Nicht_Voll: true, Vorrat_Ok: true }, phys: { B11: 50, B12: 55 } }, { Band: false, Druck_mbar: P(50), Temp_C: P(55), Heizung: true, Pumpe_Frei: true }],
        [0.05, { in: { Start: true } }, { Band: true }], [0.05, { in: { Start: false }, phys: { B11: 25, B12: 61 } }, { Band: true, Druck_mbar: P(25), Heizung: true }], [0.05, { phys: { B11: 25, B12: 63 } }, { Heizung: false }],
        [0.05, { in: { Stopp: false, Tank_Nicht_Voll: false } }, { Band: false, Pumpe_Frei: false }], [0.05, { phys: { B11: 25, B12: 59 } }, { Heizung: false }]] }],
      wrong: [{ scl: FIN_REF.replace('AND "Stopp"', 'AND NOT "Stopp"') }, { scl: FIN_REF.replace('"Tank_Nicht_Voll" AND', 'NOT "Tank_Nicht_Voll" AND') }] },
    LOAD,
    { kind: 'measure', text: 'Abnahme Tankstation', ask: [{ q: 'Druck 50 mbar: "Druck_Roh"', calc: A.rawAt('CH0', { B11: 50 }), tol: 30 }, { q: 'Temperatur 50 °C: "Temp_Roh"', calc: A.rawAt('CH1', { B12: 50 }), tol: 30 }] }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/plan.js ==== */
/* Sensorwerkstatt: Auswahl und Format v2 der 30 angezeigten Aufgaben (docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md 5.2).
   Alle anderen Aufgaben bekommen hidden:true: nicht sichtbar, aber per ID weiter auflösbar (Spielstände, Leitstand, Live-Challenge,
   Störungsjagd sb_<Aufgabe>). NIE löschen. Aufgaben tauschen: Eintrag hier ändern, danach `node validate_sensor.js`.
   Felder: phase = Schwerpunkt ('verbinden'|'signale'|'programm'|'laufen'|'alle'|[Phasen]); tools = nur 'multimeter'/'kalibrator'
   (erscheinen nur in dieser Aufgabe); scene = sichtbare Anlage; prefill wird aus dem Schwerpunkt abgeleitet, wenn nicht gesetzt. */
(function(root){
const C = root.SCL_CONTENT;
const S = 'sortierstrecke', T = 'tank', M = 'multimeter', K = 'kalibrator';
const PLAN = [
  // Modul 1 – Signale und digitale Sensoren (Start: sofort verbinden)
  ['w1_b1_anschliessen',   { phase: 'verbinden', scene: S }],
  ['w1_start_stopp',       { phase: 'verbinden', scene: S }],
  ['w1_variablentabelle',  { phase: 'signale',   scene: S }],
  ['w1_band_selbsthaltung',{ phase: 'programm',  scene: S }],
  ['w1_boss_sortierstrecke',{ phase: 'alle',     scene: S }],
  // Modul 2 – PNP und NPN
  ['w2_pnp_messen',        { phase: 'laufen',    scene: S, tools: [M] }],
  ['w2_1m_cpu',            { phase: 'verbinden', scene: S }],
  ['w2_teilezaehler',      { phase: 'programm',  scene: S }],
  ['w2_fehler_npn_pnp',    { phase: 'verbinden', scene: S }],
  ['w2_boss_umbau',        { phase: 'alle',      scene: S }],
  // Modul 3 – Sensortypen im Einsatz (Abstand, Poti und Teach-in als Regler, Annahme A1)
  ['w3_schaltabstand',     { phase: 'laufen',    scene: S }],
  ['w3_b3_teach',          { phase: 'laufen',    scene: S }],
  ['w3_materialsortierung',{ phase: 'programm',  scene: S }],
  ['w3_fehler_alu',        { phase: 'laufen',    scene: S }],
  ['w3_boss_sieben',       { phase: 'alle',      scene: S }],
  // Modul 4 – Analogsignale
  ['w4_b10_anschliessen',  { phase: 'verbinden', scene: T, tools: [M] }],
  ['w4_b11_2leiter',       { phase: ['verbinden', 'signale'], scene: T, tools: [M] }],
  ['w4_loopcheck',         { phase: 'laufen',    scene: T, tools: [K] }],
  ['w4_rohwert_status',    { phase: 'programm',  scene: T }],
  ['w4_boss_tank',         { phase: 'alle',      scene: T, tools: [M, K] }],
  // Modul 5 – NORM_X und SCALE_X
  ['w5_von_hand',          { phase: 'signale',   scene: T }],
  ['w5_druck',             { phase: 'programm',  scene: T }],
  ['w5_pumpe_aq',          { phase: 'programm',  scene: T, tools: [M] }],
  ['w5_fehler_0_20',       { phase: 'signale',   scene: T }],
  ['w5_boss_hmi',          { phase: 'alle',      scene: T }],
  // Modul 6 – Messwerte sicher verarbeiten
  ['w6_heizung_hysterese', { phase: 'programm',  scene: T }],
  ['w6_zweipunkt',         { phase: 'programm',  scene: T }],
  ['w6_plausi',            { phase: 'programm',  scene: T }],
  ['w6_fehler_b8',         { phase: 'verbinden', scene: T }],
  ['w6_finale',            { phase: 'alle',      scene: T, tools: [M, K] }]
];
const byId = {}; PLAN.forEach(([id, o]) => { byId[id] = o; });
const seen = {};
C.tasks.filter(t => t.workshop).sort((a, b) => a.level - b.level || a.no - b.no).forEach(t => {
  const o = byId[t.id];
  if(!o){ t.hidden = true; t.core = false; return; }
  Object.assign(t, { core: true, hidden: false, lang: ['scl', 'fup'], tools: [], prefill: null, reality: 'schnell', level_: 'schnell' }, o);   // nur Realitätsstufe „Schnell“ (Annahme A4)
  seen[t.level] = (seen[t.level] || 0) + 1; t.dispNo = seen[t.level];   // angezeigte Nummer im Modul (1–5), t.no bleibt die alte Nummer
});
root.SW_PLAN = PLAN;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==== content_sensor/texte.js ==== */
/* Sensorwerkstatt: Texte der 30 angezeigten Aufgaben nach der Textdiät (Umbau 29.09.2026, Paket W7).
   story ≤ 2 Sätze, brief (Auftrag) ≤ 25 Wörter und zuoberst, info = Infokarte (max. 3 Sätze, Tabellen/Listen erlaubt) direkt in der Aufgabe.
   Mechanik (Montage, Stecker, Hülsen, Einschalten, Laden) macht das Spiel; Texte nennen keine Werkzeughandlungen mehr.
   Die bisherigen Texte in m1.js … m6.js bleiben für die versteckten Aufgaben und als Verlauf. */
(function(root){
const C = root.SCL_CONTENT;
const T = {
  // Modul 1
  w1_b1_anschliessen: { story: 'ARIA hat die Adern von -B1 abgeklemmt. Die Sortierstrecke erkennt kein Metall mehr.',
    brief: 'Lege die drei Adern von <b>-B1</b> auf die Initiatorenklemme <b>-X2:5</b>. Dann Laufen lassen und ein Stahlteil vorbeiführen.',
    info: '<b>Farbe = Aufgabe:</b> BN (braun) = +24 V → L+, BU (blau) = 0 V → M, BK (schwarz) = Signal → S. Die Signalebene von -X2:5 führt zum Eingang %I0.4.' },
  w1_start_stopp: { story: 'Am Bedienpult fehlen die Adern von Start und Stopp. Stopp ist ein Öffner.',
    brief: 'Schliesse <b>-S1</b> Start an <b>-X2:1</b> und <b>-S2</b> Stopp an <b>-X2:2</b> an. Beantworte danach die zwei Fragen.',
    info: 'Taster haben zwei Kontakte: der erste kommt auf L+, der zweite auf die Signalebene. Ein <b>Schliesser</b> (13/14) meldet 1 beim Drücken, ein <b>Öffner</b> (11/12) meldet 1 in Ruhe.' },
  w1_variablentabelle: { story: 'ARIA hat die PLC-Variablentabelle gelöscht. Ohne Namen weiss niemand, was %I0.4 bedeutet.',
    brief: 'Lege im Fenster <b>PLC-Variablen</b> die sechs Variablen aus der Infokarte an: Name, Datentyp Bool, Adresse.',
    info: '<table class="sv-info-t"><tr><th>Name</th><th>Adresse</th></tr><tr><td>Start</td><td>%I0.0</td></tr><tr><td>Stopp</td><td>%I0.1</td></tr><tr><td>Ind_Metall</td><td>%I0.4</td></tr><tr><td>Rutsche_Voll</td><td>%I1.0</td></tr><tr><td>Haube_Zu</td><td>%I1.3</td></tr><tr><td>Band</td><td>%Q0.0</td></tr></table>' },
  w1_band_selbsthaltung: { story: 'Die Sortierstrecke ist verdrahtet, jetzt braucht das Band ein Programm. ARIA wettet, dass du den Öffner falsch auswertest.',
    brief: '<b>"Band"</b> startet mit <b>"Start"</b> und hält sich selbst. <b>"Stopp"</b> (Öffner) oder offene Haube schalten es aus.',
    info: 'Selbsthaltung: Band := (Start ODER Band) UND Stopp UND Haube_Zu. Weil Stopp ein Öffner ist, ist <b>"Stopp" = 1</b>, solange niemand drückt.' },
  w1_boss_sortierstrecke: { story: 'ARIA hat die Sortierstrecke zerlegt: Adern gezogen, Querbrücker weg, Programm gelöscht. Bis Schichtende soll das Band wieder laufen.',
    brief: 'Verdrahte fünf Geräte, lege die Variablen an und programmiere das Band mit Selbsthaltung. Volle Rutsche stoppt es.',
    info: '-S1 → -X2:1, -S2 → -X2:2, -B1 → -X2:5, -B5 → -X2:9, -S5 → -X2:12. Variablen: Start, Stopp, Ind_Metall, Rutsche_Voll, Haube_Zu, Band. Aus bei Stopp, offener Haube oder "Rutsche_Voll" = 1.' },
  // Modul 2
  w2_pnp_messen: { story: 'Der Werkmeister drückt dir das Multimeter in die Hand. „Glauben ist gut, messen ist besser.“',
    brief: 'Miss mit dem Multimeter die Spannung zwischen <b>-X2:5 Signal</b> und <b>-X2:5 M</b>, mit und ohne Stahlteil vor -B1.',
    info: 'Rote Spitze auf das Signal, schwarze Spitze (COM) auf M. Ein <b>PNP</b>-Sensor schaltet beim Erkennen +24 V auf seinen Ausgang.' },
  w2_1m_cpu: { story: 'Die Sensor-LEDs leuchten, doch die Eingänge der CPU bleiben dunkel. Ein Aushilfselektriker hat 1M auf L+ gelegt.',
    brief: 'Klemme <b>-A1:1M</b> von L+ auf M um. Danach müssen %I0.4, %I1.0 und %I0.0 wieder kommen.',
    info: '1M ist das Bezugspotential der Eingangsgruppe. Bei PNP-Sensoren muss 1M auf <b>M</b> liegen, damit Strom vom Signal durch den Eingang nach M fliesst.' },
  w2_teilezaehler: { story: 'Die Produktion will wissen, wie viele Metallteile heute gelaufen sind. ARIA zählt 4 872 Teile in zehn Sekunden.',
    brief: 'Zähle jedes Metallteil an <b>"Ind_Metall"</b> genau einmal in <b>"Teile_Anzahl"</b>. <b>"HMI_Reset"</b> setzt auf 0.',
    info: 'Ein Teil liegt mehrere Zyklen vor dem Sensor – ohne <b>Flanke</b> zählt es in jedem Zyklus. SCL: Instanz "Flanke_B1" (R_TRIG), FUP: P(…).' },
  w2_fehler_npn_pnp: { story: 'Ein Kollege hat den NPN-Sensor -N1 an die SM 1221 angeschlossen. Die LED am Sensor leuchtet, %I16.0 bleibt 0.',
    brief: 'Finde heraus, warum %I16.0 nicht kommt, und behebe es. -B8 an %I16.4 muss weiter funktionieren.',
    info: 'Ein <b>NPN</b>-Sensor schaltet den Ausgang nach M. Die Eingangsgruppe braucht dann ihr Bezugspotential (1M bzw. 2M) auf <b>L+</b> – und PNP und NPN gehören nie in dieselbe Gruppe.' },
  w2_boss_umbau: { story: 'Am Auswerfer sitzt künftig ein NPN-Sensor, und ARIA hat alle Sensoradern gezogen. „PNP an die CPU, NPN an die SM 1221“, sagt der Werkmeister.',
    brief: 'Verdrahte drei PNP-Sensoren an die CPU und -N1 an die SM 1221. Der Auswerfer reagiert dann auf "Ind_Auswerfer".',
    info: '-B1 → -X2:5, -B2 → -X2:6, -B5 → -X2:9, -N1 → -X2:21 (%I16.0), 1M der SM 1221 auf L+. Variable Ind_Auswerfer (Bool, %I16.0). Auswerfen nur bei laufendem Band; volle Rutsche stoppt das Band und schaltet "Lampe_Rot".' },
  // Modul 3
  w3_schaltabstand: { story: 'Das Typenschild von -B1 sagt Sn 8 mm. Für welches Material gilt das?',
    brief: 'Schiebe den Abstandsregler von -B1, bis die LED ausgeht, und notiere den Schaltabstand für Stahl und Aluminium. Zum Schluss 4 mm.',
    info: 'Der letzte Abstand, bei dem die gelbe LED noch leuchtet, ist der Schaltabstand. Nichteisenmetalle haben einen <b>Reduktionsfaktor</b>: Aluminium wird nur auf kürzere Distanz erkannt.' },
  w3_b3_teach: { story: 'Der Lichttaster -B3 sieht seit ARIAs Besuch das Band selbst als Teil. Er muss den Hintergrund neu lernen.',
    brief: 'Stelle -B3 auf <b>60 mm</b> über dem Band, drücke bei leerem Band <b>Teach-in</b> und prüfe mit einem schwarzen Teil.',
    info: 'Ein Lichttaster mit <b>Hintergrundausblendung</b> ignoriert alles, was weiter weg ist als die eingelernte Distanz. Deshalb lernt man bei leerem Band: der Hintergrund ist das Band.' },
  w3_materialsortierung: { story: 'Metall soll in Rutsche A, Kunststoff in Behälter B. -B1 sitzt aber weit vor dem Auswerfer.',
    brief: 'Merke dir ein Metallteil in <b>"Ist_Metall"</b> und wirf es bei <b>"LS_Band"</b> aus. <b>"Zyl_Vorne"</b> löscht die Merkung.',
    info: '"Ind_Metall" → Setzen "Ist_Metall"; "LS_Band" UND "Ist_Metall" → "Auswerfer"; "Zyl_Vorne" → Rücksetzen "Ist_Metall". Kunststoff läuft durch in Behälter B.' },
  w3_fehler_alu: { story: 'Aluminiumteile landen im Kunststoffbehälter, Stahl wird sauber aussortiert. ARIA: „Metall ist Metall, oder?“',
    brief: 'Finde heraus, warum -B1 Aluminium nicht erkennt, und stelle den Abstand so ein, dass alle Metalle sicher schalten.',
    info: 'Aluminium hat beim induktiven Sensor einen Reduktionsfaktor von etwa 0,4. Der sichere Einbauabstand richtet sich nach dem <b>ungünstigsten</b> Material.' },
  w3_boss_sieben: { story: 'Grossauftrag mit sieben Werkstoffen, und ARIA hat alle Sensoren verstellt. Glas gehört nicht auf diese Strecke und soll gemeldet werden.',
    brief: 'Stelle -B1 und -B2 richtig ein, fülle die Logiktabelle und programmiere <b>"Teil_Art"</b>: Metall auswerfen, Glas melden.',
    info: '-B1 induktiv ("Ind_Metall"), -B2 kapazitiv ("Kap_Teil", Kunststoff ja, Band nein), -B4 Lichtschranke ("LS_Band"). "Teil_Art": 0 kein Teil, 1 Metall, 2 Kunststoff, 3 Glas → "Lampe_Rot".' },
  // Modul 4
  w4_b10_anschliessen: { story: 'Über dem Tank hängt der Ultraschallsensor -B10, ohne Anschluss. Ab jetzt sind Signale nicht mehr nur 0 oder 1.',
    brief: 'Schliesse <b>-B10</b> (0–10 V) an den Analogeingang AI0 der CPU an und miss die Spannung bei drei Füllständen.',
    info: 'BN → -X1:L+6, BU → -X1:M5, BK → -X3:4 (a), -X3:4 (b) → -A1:AI0, -A1:2M → -X1:M6. Füllstand = 800 mm − Abstand; den Füllstand stellst du mit dem Regler in ④ ein.' },
  w4_b11_2leiter: { story: 'Der Drucktransmitter -B11 hat nur zwei Adern. „Der Strom ist das Signal“, grinst der Werkmeister.',
    brief: 'Verdrahte die <b>2-Leiter-Schleife</b> von -B11 an Kanal 0 der SM 1231 und stelle den Kanal auf 4–20 mA ein.',
    info: '-X1:L+2 → B11:+, B11:− → -X3:1 (a), -X3:1 (b) → -A2:0+, -A2:0− → -X1:M7. Gerätesicht Kanal 0: Strom 2-Draht, 4–20 mA, Drahtbruch ein.' },
  w4_loopcheck: { story: 'Vor der Inbetriebnahme wird jeder Kanal abgenommen. „12 mA am Klemmenkasten müssen 12 mA in der SPS sein.“',
    brief: 'Speise mit dem <b>Kalibrator</b> 4, 12 und 20 mA in Kanal 1 ein und notiere jeweils "Temp_Roh".',
    info: 'Das Trennmesser -X3:2 ist offen, der Transmitter also abgetrennt. Kalibrator an Kanal 1 anklemmen, Wert wählen, Rohwert in der Beobachtung ablesen.' },
  w4_rohwert_status: { story: 'ARIA will bei Drahtbruch einfach 118 mbar anzeigen. Der Werkmeister will jeden ungültigen Rohwert gemeldet haben.',
    brief: 'Schreibe den Status von <b>"Druck_Roh"</b> in <b>"Druck_Status"</b> (0–4). Bei Status 3 oder 4 leuchtet "Lampe_Rot".',
    info: '<table class="sv-info-t"><tr><th>Rohwert</th><th>Status</th></tr><tr><td>0 … 27648</td><td>0 in Ordnung</td></tr><tr><td>27649 … 32511</td><td>1 Übersteuerung</td></tr><tr><td>−4864 … −1</td><td>2 Untersteuerung</td></tr><tr><td>32767</td><td>3 Überlauf / Drahtbruch</td></tr><tr><td>−32768</td><td>4 Unterlauf</td></tr></table>' },
  w4_boss_tank: { story: 'ARIA hat an der Tankstation alle Analogleitungen gezogen. Vier Messstellen werden angeschlossen, konfiguriert und abgenommen.',
    brief: 'Schliesse -B10 bis -B13 an, konfiguriere die SM 1231 und trage die Rohwerte der Abnahme ins Protokoll ein.',
    info: '-B10 → AI0 über -X3:4, -B11 → Kanal 0 über -X3:1, -B12 → Kanal 1 über -X3:2, -B13 (4-Leiter) → Kanal 2 über -X3:3. Kanal 0/1 Strom 2-Draht, Kanal 2 Strom 4-Draht, alle 4–20 mA mit Drahtbruch.' },
  // Modul 5
  w5_von_hand: { story: 'Der Sollwertsteller -R1 liefert den Rohwert 13824. Wie viel Prozent sind das?',
    brief: 'Rechne die fünf Fragen von Hand: normieren (Rohwert / 27648), dann skalieren auf 0–100 %.',
    info: 'Skalieren ist eine Gerade durch zwei Punkte: (0 | 0 %) und (27648 | 100 %). 0–10 V entsprechen den Rohwerten 0–27648.' },
  w5_druck: { story: 'Am HMI steht beim Druck nur „0.0 mbar“. Der Bediener will echte Einheiten sehen.',
    brief: 'Skaliere <b>"Druck_Roh"</b> mit <b>NORM_X</b> und <b>SCALE_X</b> auf <b>"Druck_mbar"</b> (0–100 mbar).',
    info: 'NORM_X: MIN 0, VALUE "Druck_Roh", MAX 27648 → 0.0…1.0. SCALE_X: MIN 0.0, VALUE Ergebnis, MAX 100.0 → mbar. In FUP liegt der Zwischenwert in "Hilf_Norm".' },
  w5_pumpe_aq: { story: 'Der Umrichter der Pumpe erwartet 0–10 V als Sollwert. Diesmal läuft die Skalierung rückwärts.',
    brief: 'Gib <b>"Pumpe_Prozent"</b> (0–100 %) als <b>"Pumpe_Soll_Roh"</b> aus und miss die Spannung am Ausgang bei 50 %.',
    info: 'NORM_X: 0.0…100.0 % → 0…1, SCALE_X: 0…27648 in eine Int-Variable. Messen mit dem Multimeter an der SM 1232 (AQ 0 gegen 0M).' },
  w5_fehler_0_20: { story: 'Der Tank ist leer, das HMI zeigt trotzdem 20 mbar. Das Programm ist dasselbe wie gestern.',
    brief: 'Finde heraus, warum der leere Tank 20 % anzeigt, und korrigiere die Konfiguration von Kanal 0.',
    info: 'Ein 4–20-mA-Transmitter liefert bei 0 mbar <b>4 mA</b> (Live Zero). Ist der Kanal auf 0–20 mA eingestellt, sind 4 mA schon 20 % des Bereichs.' },
  w5_boss_hmi: { story: 'Morgen kommt der Kunde zur Abnahme der Tankstation. ARIA hat das Programm bis auf die Druckanzeige gelöscht.',
    brief: 'Skaliere alle Messwerte in echte Einheiten, lass die Pumpe dem Sollwert folgen und melde Widersprüche zwischen Ultraschall und Druck.',
    info: '"Fuellstand_mm" = 800 − Abstand (60–800 mm), "Pegel_mm" aus "Druck_mbar" (1 mm ≈ 0,0981 mbar), "Temp_C", "Durchfluss_lmin", "Sollwert_Prozent" → "Pumpe_Soll_Roh". Abweichung > 30 mm → "Plausi_Fehler" und "Lampe_Rot".' },
  // Modul 6
  w6_heizung_hysterese: { story: 'Das Wasser soll etwa 60 °C haben. ARIAs Heizung schaltet bei 60,0 °C und klickt im Takt des Rauschens.',
    brief: 'Steuere <b>"Heizung"</b> mit Hysterese: unter 58 °C ein, über 62 °C aus, dazwischen Zustand halten.',
    info: 'Eine <b>Hysterese</b> verhindert ständiges Ein- und Ausschalten: zwei Schwellen statt einer. Zwischen den Schwellen merkt sich die Heizung ihren letzten Zustand.' },
  w6_zweipunkt: { story: 'Der Werkmeister traut keiner Formel, die er nicht selbst geprüft hat. Kalibriert wird mit zwei bekannten Pegeln.',
    brief: 'Lies "Druck_Roh" bei <b>100 mm</b> und <b>500 mm</b> ab und trage beide Punkte in NORM_X/SCALE_X für <b>"Pegel_mm"</b> ein.',
    info: 'NORM_X: MIN und MAX sind die beiden Rohwerte, SCALE_X: MIN 100.0, MAX 500.0 mm. Werte ausserhalb der Punkte rechnet die Gerade weiter.' },
  w6_plausi: { story: 'Ultraschall und Druck messen beide den Füllstand, auf völlig verschiedene Art. ARIA hält schon ein Tuch über -B10.',
    brief: 'Weichen <b>"Fuellstand_mm"</b> und <b>"Pegel_mm"</b> länger als 2 s um mehr als 30 mm ab, melde <b>"Plausi_Fehler"</b>.',
    info: 'Abweichung in beide Richtungen prüfen (ABS). Zeitinstanz "T_Plausi" (TON, 2 s) – Wellen beim Befüllen sind kein Fehler. Meldung auch auf "Lampe_Rot".' },
  w6_fehler_b8: { story: 'Der Messtank ist übergelaufen, obwohl -B8 „Tank voll“ angezeigt hat. Das Programm fragt den Öffner korrekt ab.',
    brief: 'Finde den Verdrahtungsfehler an <b>-X2:13</b> und lege den <b>Öffner</b> von -B8 richtig auf.',
    info: '-B8 hat zwei Ausgänge: BK = Schliesser (1 bei vollem Tank), WH = Öffner (1 bei nicht vollem Tank). Auf -X2:13 ("Tank_Nicht_Voll") gehört der Öffner – drahtbruchsicher.' },
  w6_finale: { story: 'ARIA hat die ganze Werkstatt sabotiert: Verdrahtung, Konfiguration und Programm. Finde alle Fehler.',
    brief: 'Bringe Sortierstrecke und Tankstation wieder in Betrieb: Analogschleifen schliessen, SM 1231 korrigieren, Programm reparieren.',
    info: 'Kanal 0/1: Strom 2-Draht, 4–20 mA. Programm: Band mit Selbsthaltung, "Druck_mbar" 0–100, "Temp_C" 0–100, Heizung 58/62 °C, "Pumpe_Frei" nur bei Vorrat und Tank nicht voll.' }
};
C.tasks.forEach(t => { const x = T[t.id]; if(!x || t.hidden) return; t.story = x.story; t.briefing = x.brief; t.info = x.info || ''; });
root.SW_TEXTE = T;
})(typeof window !== 'undefined' ? window : globalThis);

