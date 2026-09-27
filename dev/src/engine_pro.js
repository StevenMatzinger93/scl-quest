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
