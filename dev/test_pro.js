// Engine-Tests für den Profi-Modus (SCLPro). Aufruf: node test_pro.js
const P = require('./src/engine_pro.js');
let pass = 0, failN = 0;
const fails = [];
function t(name, fn){
  try{ const r = fn(); if(r === false) throw new Error('lieferte false'); pass++; }
  catch(e){ failN++; fails.push(name + ': ' + e.message); }
}
function eq(a, b, msg){ if(!P.approxEqual(a, b) || (Array.isArray(b) && !Array.isArray(a))) throw new Error((msg || '') + ' erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a)); }
function compile(src, globals, types, instances){ return P.compileProject({sources: [{block: 'Test', src}], globals: globals || {}, globalTypes: types || {}, instances: instances || {}}); }
function compileMulti(srcs, globals, types){ return P.compileProject({sources: srcs.map((s, i) => ({block: 'B' + i, src: s})), globals: globals || {}, globalTypes: types || {}}); }
function err(src, re, globals, types){
  try{ compile(src, globals, types); }
  catch(e){ if(!(e instanceof P.SCLError)) throw e; if(re && !re.test(e.message)) throw new Error('falsche Meldung: ' + e.message); return e; }
  throw new Error('kein Fehler gemeldet');
}
function warns(src, code, globals, yes){
  const p = compile(src, globals);
  const has = p.warnings.some(w => w.code === code);
  if(has !== (yes !== false)) throw new Error((yes !== false ? 'Warnung fehlt: ' : 'Unerwartete Warnung: ') + code + ' ' + JSON.stringify(p.warnings.map(w => w.code + ':' + w.msg)));
  return p;
}
// Wert eines Ausdrucks über eine FC berechnen
function val(expr, type, decls, extra){
  const src = 'FUNCTION "F" : ' + type + '\nVAR_TEMP\n' + (decls || '') + '\nEND_VAR\nVAR CONSTANT\n  K10 : INT := 10;\nEND_VAR\nBEGIN\n' + (extra || '') + '\n#F := ' + expr + ';\nEND_FUNCTION';
  const p = compile(src);
  const r = P.runUnitTests(p, [{block: 'F', steps: [{inputs: {}, expect: {}}]}]);
  if(!r.ok) throw r.error || new Error('Lauf fehlgeschlagen');
  return r.report[0].steps[0].env.F;
}
function unit(src, block, steps, globals, setup){
  const p = compile(src, globals);
  const r = P.runUnitTests(p, [{block, setup: setup || {}, steps: steps.map(s => Array.isArray(s) ? (s.length === 3 ? {dt: s[0], inputs: s[1], expect: s[2]} : {inputs: s[0], expect: s[1]}) : s)}]);
  if(!r.ok){
    const f = r.report[0];
    const st = f.steps[f.steps.length - 1];
    throw new Error(f.error ? f.error.message : 'Check: ' + JSON.stringify(st.checks.filter(c => !c.pass)));
  }
  return r;
}
function prog(src, globals, spec, types){
  const p = compile(src, globals, types);
  const r = P.runAll(p, spec);
  if(!r.ok){
    const f = r.failed;
    const c = f.failedCase;
    const st = c && (c.steps ? c.steps[c.steps.length - 1] : c);
    throw new Error(f.error ? f.error.message : 'Check: ' + JSON.stringify(st && st.checks.filter(x => !x.pass)));
  }
  return r;
}
const FB = (decl, body, name) => 'FUNCTION_BLOCK "' + (name || 'FB_T') + '"\n' + decl + '\nBEGIN\n' + body + '\nEND_FUNCTION_BLOCK\n';
const FC = (ret, decl, body, name) => 'FUNCTION "' + (name || 'FC_T') + '" : ' + ret + '\n' + decl + '\nBEGIN\n' + body + '\nEND_FUNCTION\n';
const OB = (body, decl) => 'ORGANIZATION_BLOCK "Main"\n' + (decl || '') + '\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK\n';

/* ---------------- 1. Tokenizer & Literale ---------------- */
t('int literal', () => eq(val('42', 'INT'), 42));
t('hex literal', () => eq(val('16#FF', 'INT'), 255));
t('bin literal', () => eq(val('2#1010', 'INT'), 10));
t('underscore', () => eq(val('1_000', 'INT'), 1000));
t('real literal', () => eq(val('2.5E2', 'REAL'), 250));
t('typed INT#', () => eq(val('INT#7', 'INT'), 7));
t('typed DINT#', () => eq(val('DINT#100000', 'DINT'), 100000));
t('typed WORD#16#', () => eq(val('WORD#16#0F0F', 'WORD'), 0x0F0F));
t('BOOL#TRUE', () => eq(val('BOOL#TRUE', 'BOOL'), true));
t('time T#1m30s', () => eq(val('T#1M30S', 'TIME'), 90));
t('time T#500ms', () => eq(val('T#500MS', 'TIME'), 0.5));
t('string literal', () => eq(val("'Teil OK'", 'STRING'), 'Teil OK'));
t('string escape $\'', () => eq(val("'It$'s'", 'STRING'), "It's"));
t('string escape $$', () => eq(val("'5$$'", 'STRING'), '5$'));
t('unterminated string', () => err(FC('INT', '', "#FC_T := LEN('abc);"), /nicht mit ' geschlossen/));
t('== error', () => err(FB('VAR a : INT; END_VAR', 'IF #a == 1 THEN ; END_IF;'), /einfachen "="/));
t('!= error', () => err(FB('VAR a : INT; END_VAR', 'IF #a != 1 THEN ; END_IF;'), /<>/));
t('comment block', () => eq(val('(* x *) 5 /* y */', 'INT', '', '// Zeilenkommentar'), 5));
t('unclosed comment', () => err('(* offen\nFUNCTION_BLOCK "X" BEGIN END_FUNCTION_BLOCK', /nie geschlossen/));
t('attributes skipped', () => compile('FUNCTION_BLOCK "X"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nBEGIN\nEND_FUNCTION_BLOCK'));
t('TITLE skipped', () => compile('ORGANIZATION_BLOCK "Main"\nTITLE = "Main Program Sweep (Cycle)"\nBEGIN\nEND_ORGANIZATION_BLOCK'));
t('REGION skipped', () => eq(val('3', 'INT', '', 'REGION Rechnen\n;\nEND_REGION'), 3));

/* ---------------- 2. Bausteinstruktur & Parser ---------------- */
t('missing BEGIN', () => err('FUNCTION_BLOCK "X"\nVAR a : INT; END_VAR\n#a := 1;\nEND_FUNCTION_BLOCK', /fehlt BEGIN/));
t('missing END_FB', () => err('FUNCTION_BLOCK "X"\nBEGIN\n', /nie mit END_FUNCTION_BLOCK/));
t('FC needs return type', () => err('FUNCTION "X"\nBEGIN\nEND_FUNCTION', /Rückgabetyp/));
t('decl in body', () => err(FB('', 'VAR x : INT; END_VAR'), /gehören vor BEGIN/));
t('missing END_VAR', () => err('FUNCTION_BLOCK "X"\nVAR a : INT;\nBEGIN\nEND_FUNCTION_BLOCK', /END_VAR/));
t('decl without type', () => err(FB('VAR a; END_VAR', ''), /fehlt ":"/));
t('decl init before type', () => err(FB('VAR a := 5; END_VAR', ''), /Erst kommt der Datentyp/));
t('hash in decl', () => err(FB('VAR #a : INT; END_VAR', ''), /ohne #/));
t('comma decl', () => unit(FB('VAR a, b : INT; END_VAR', '#a := 1; #b := #a + 1;'), 'FB_T', [[{}, {a: 1, b: 2}]]));
t('decl comment captured', () => eq(P.readInterface(FB('VAR_INPUT\n Start : Bool; // Taster\nEND_VAR', '')).rows[0].comment, 'Taster'));
t('text after unit', () => err(FB('', '') + 'x := 1;', /folgt noch/));
t('PROGRAM not TIA', () => err('PROGRAM X END_PROGRAM', /PROGRAM gibt es in TIA nicht/));
t('duplicate names', () => err(FB('', '', 'A') + FB('', '', 'A'), /doppelt vergeben/));
t('reserved name', () => err(FB('', '', 'TON'), /reservierter Name/));
t('unquoted block name ok', () => compile('FUNCTION_BLOCK FB_X\nBEGIN\nEND_FUNCTION_BLOCK'));
t('ELSE IF hint', () => err(FB('VAR a : INT; END_VAR', 'IF #a = 1 THEN #a := 2; ELSE IF #a = 2 THEN #a := 3; END_IF;'), /END_IF/));
t('assignment with =', () => err(FB('VAR a : INT; END_VAR', '#a = 1;'), /":="/));

/* ---------------- 3. Deklarationen & Typen ---------------- */
t('unknown type', () => err(FB('VAR a : Intt; END_VAR', ''), /Meintest du INT/));
t('duplicate var', () => err(FB('VAR a : INT; a : BOOL; END_VAR', ''), /doppelt deklariert/));
t('init value', () => unit(FB('VAR z : INT := 10; END_VAR', '#z := #z + 1;'), 'FB_T', [[{}, {z: 11}], [{}, {z: 12}]]));
t('init type mismatch', () => err(FB('VAR z : INT := 1.5; END_VAR', ''), /Startwert/));
t('init out of range', () => err(FB('VAR z : SINT := 200; END_VAR', ''), /passt nicht in SINT/));
t('constant needs value', () => err(FB('VAR CONSTANT K : INT; END_VAR', ''), /braucht einen Wert/));
t('constant read', () => eq(val('K10 * 2', 'INT'), 20));
t('constant write err', () => err(FC('INT', 'VAR CONSTANT K : INT := 1; END_VAR', '#K := 2; #FC_T := 0;'), /Konstante/));
t('constant as array bound', () => unit(FB('VAR CONSTANT N : INT := 5; END_VAR\nVAR a : ARRAY[1..N] OF INT; s : INT; END_VAR\nVAR_TEMP i : INT; END_VAR', 'FOR #i := 1 TO #N DO #a[#i] := #i; END_FOR; #s := #a[5];'), 'FB_T', [[{}, {s: 5}]]));
t('array bounds swapped', () => err(FB('VAR a : ARRAY[5..1] OF INT; END_VAR', ''), /vertauscht/));
t('array init list', () => unit(FB('VAR a : ARRAY[1..3] OF INT := [4, 5, 6]; s : INT; END_VAR', '#s := #a[1] + #a[3];'), 'FB_T', [[{}, {s: 10}]]));
t('array init repeat', () => unit(FB('VAR a : ARRAY[0..4] OF INT := [5(7)]; s : INT; END_VAR', '#s := #a[4];'), 'FB_T', [[{}, {s: 7}]]));
t('array init too many', () => err(FB('VAR a : ARRAY[1..2] OF INT := [1, 2, 3]; END_VAR', ''), /Zu viele Startwerte/));
t('string length', () => err(FB('VAR s : STRING[300]; END_VAR', ''), /zwischen 1 und 254/));
t('FC no static', () => err(FC('INT', 'VAR x : INT; END_VAR', '#FC_T := 1;'), /kein Gedächtnis/));
t('OB no inputs', () => err('ORGANIZATION_BLOCK "Main"\nVAR_INPUT a : BOOL; END_VAR\nBEGIN\nEND_ORGANIZATION_BLOCK', /keine Ein-\/Ausgänge/));
t('OB no static', () => err('ORGANIZATION_BLOCK "Main"\nVAR a : BOOL; END_VAR\nBEGIN\nEND_ORGANIZATION_BLOCK', /keine statischen/));
t('instance in TEMP', () => err(FB('VAR_TEMP t : TON; END_VAR', ''), /gehören in den Bereich VAR/));
t('instance in FC', () => err(FC('INT', 'VAR_TEMP t : TON; END_VAR', '#FC_T := 1;'), /VAR eines FB/));
t('FB contains itself', () => err(FB('VAR x : "FB_T"; END_VAR', ''), /Instanz von sich selbst/));
t('multiinstance cycle', () => err(FB('VAR b : "FB_B"; END_VAR', '', 'FB_A') + FB('VAR a : "FB_A"; END_VAR', '', 'FB_B'), /Kreis/));
t('unsupported type', () => err(FB('VAR d : DTL; END_VAR', ''), /nicht unterstützt/));
t('var name quoted', () => err(FB('VAR "a" : INT; END_VAR', ''), /ohne Anführungszeichen/));

/* ---------------- 4. Ganzzahltypen & Überlauf ---------------- */
t('INT overflow wraps', () => unit(FB('VAR z : INT := 32767; END_VAR', '#z := #z + 1;'), 'FB_T', [[{}, {z: -32768}]]));
t('DINT no overflow', () => unit(FB('VAR z : DINT := 32767; END_VAR', '#z := #z + 1;'), 'FB_T', [[{}, {z: 32768}]]));
t('USINT wraps', () => unit(FB('VAR z : USINT := 255; END_VAR', '#z := #z + 1;'), 'FB_T', [[{}, {z: 0}]]));
t('SINT wraps', () => unit(FB('VAR z : SINT := -128; END_VAR', '#z := #z - 1;'), 'FB_T', [[{}, {z: 127}]]));
t('INT*INT wraps', () => unit(FB('VAR a : INT := 300; b : INT := 200; c : DINT; END_VAR', '#c := #a * #b;'), 'FB_T', [[{}, {c: -5536}]]));
t('INT to DINT implicit', () => unit(FB('VAR a : INT := 300; c : DINT; END_VAR', '#c := #a;'), 'FB_T', [[{}, {c: 300}]]));
t('DINT to INT error', () => err(FB('VAR a : DINT; c : INT; END_VAR', '#c := #a;'), /DINT_TO_INT/));
t('DINT_TO_INT', () => unit(FB('VAR a : DINT := 70000; c : INT; END_VAR', '#c := DINT_TO_INT(#a);'), 'FB_T', [[{}, {c: 4464}]]));
t('INT + DINT = DINT', () => unit(FB('VAR a : INT := 32000; b : DINT := 1000; c : DINT; END_VAR', '#c := #a + #b;'), 'FB_T', [[{}, {c: 33000}]]));
t('literal widens', () => unit(FB('VAR a : INT := 5; c : DINT; END_VAR', '#c := #a + 100000;'), 'FB_T', [[{}, {c: 100005}]]));
t('literal to INT out of range', () => err(FB('VAR c : INT; END_VAR', '#c := 40000;'), /passt nicht in INT/));
t('INT div trunc', () => eq(val('7 / 2', 'INT'), 3));
t('neg div trunc', () => eq(val('-7 / 2', 'INT'), -3));
t('MOD', () => eq(val('17 MOD 5', 'INT'), 2));
t('REAL to INT error', () => err(FB('VAR r : REAL; i : INT; END_VAR', '#i := #r;'), /REAL_TO_INT/));
t('INT to REAL implicit', () => unit(FB('VAR i : INT := 3; r : REAL; END_VAR', '#r := #i / 2;'), 'FB_T', [[{}, {r: 1}]]));
t('REAL_TO_INT rounds', () => eq(val('REAL_TO_INT(2.5)', 'INT'), 2));
t('REAL_TO_INT rounds 3.5', () => eq(val('REAL_TO_INT(3.5)', 'INT'), 4));
t('ROUND generic', () => eq(val('ROUND(7.6)', 'INT'), 8));
t('TRUNC generic', () => eq(val('TRUNC(-7.6)', 'DINT'), -7));
t('CEIL', () => eq(val('CEIL(1.2)', 'INT'), 2));
t('FLOOR', () => eq(val('FLOOR(1.8)', 'INT'), 1));
t('INT_TO_REAL', () => eq(val('INT_TO_REAL(3) / 2.0', 'REAL'), 1.5));
t('BOOL_TO_INT', () => eq(val('BOOL_TO_INT(TRUE) + BOOL_TO_INT(FALSE)', 'INT'), 1));
t('power', () => eq(val('2 ** 10', 'REAL'), 1024));

/* ---------------- 5. Bits & Wörter ---------------- */
t('bit read', () => unit(FB('VAR w : WORD := 16#0008; b : BOOL; END_VAR', '#b := #w.%X3;'), 'FB_T', [[{}, {b: true}]]));
t('bit write', () => unit(FB('VAR w : WORD; END_VAR', '#w.%X15 := TRUE; #w.%X0 := TRUE;'), 'FB_T', [[{}, {w: 32769}]]));
t('bit clear', () => unit(FB('VAR w : WORD := 16#FFFF; END_VAR', '#w.%X0 := FALSE;'), 'FB_T', [[{}, {w: 65534}]]));
t('bit out of range', () => err(FB('VAR w : BYTE; b : BOOL; END_VAR', '#b := #w.%X8;'), /Bits 0 bis 7/));
t('bit on real err', () => err(FB('VAR r : REAL; b : BOOL; END_VAR', '#b := #r.%X1;'), /Bitzugriff/));
t('word AND mask', () => unit(FB('VAR w : WORD := 16#F0F0; m : WORD; END_VAR', '#m := #w AND 16#00FF;'), 'FB_T', [[{}, {m: 0xF0}]]));
t('word OR', () => unit(FB('VAR w : WORD := 16#0F00; m : WORD; END_VAR', '#m := #w OR 16#000F;'), 'FB_T', [[{}, {m: 0x0F0F}]]));
t('word XOR', () => unit(FB('VAR w : WORD := 16#FFFF; m : WORD; END_VAR', '#m := #w XOR 16#00FF;'), 'FB_T', [[{}, {m: 0xFF00}]]));
t('word NOT', () => unit(FB('VAR w : WORD := 16#00FF; m : WORD; END_VAR', '#m := NOT #w;'), 'FB_T', [[{}, {m: 0xFF00}]]));
t('word arithmetic error', () => err(FB('VAR w : WORD; END_VAR', '#w := #w + 1;'), /rechnet man nicht direkt/));
t('SHL', () => unit(FB('VAR w : WORD := 1; END_VAR', '#w := SHL(IN := #w, N := 4);'), 'FB_T', [[{}, {w: 16}]]));
t('SHR', () => unit(FB('VAR w : WORD := 16#0100; END_VAR', '#w := SHR(IN := #w, N := 8);'), 'FB_T', [[{}, {w: 1}]]));
t('ROL', () => unit(FB('VAR b : BYTE := 16#81; END_VAR', '#b := ROL(IN := #b, N := 1);'), 'FB_T', [[{}, {b: 3}]]));
t('WORD_TO_INT', () => unit(FB('VAR w : WORD := 16#FFFF; i : INT; END_VAR', '#i := WORD_TO_INT(#w);'), 'FB_T', [[{}, {i: -1}]]));
t('bit on INT', () => unit(FB('VAR i : INT := -1; b : BOOL; END_VAR', '#b := #i.%X15;'), 'FB_T', [[{}, {b: true}]]));
t('word compare', () => unit(FB('VAR w : WORD := 16#10; b : BOOL; END_VAR', '#b := #w = 16#10;'), 'FB_T', [[{}, {b: true}]]));

/* ---------------- 6. Arrays ---------------- */
t('array bounds 1..10', () => unit(FB('VAR a : ARRAY[1..10] OF REAL; s : REAL; END_VAR\nVAR_TEMP i : INT; END_VAR', 'FOR #i := 1 TO 10 DO #a[#i] := #i; END_FOR; #s := #a[1] + #a[10];'), 'FB_T', [[{}, {s: 11}]]));
t('array index out of range runtime', () => { try{ unit(FB('VAR a : ARRAY[1..3] OF INT; i : INT; END_VAR', '#a[#i] := 1;'), 'FB_T', [[{}, {}]]); }catch(e){ if(/ausserhalb/.test(e.message)) return; throw e; } throw new Error('kein Fehler'); });
t('array const index static check', () => err(FB('VAR a : ARRAY[1..3] OF INT; END_VAR', '#a[0] := 1;'), /ausserhalb der Grenzen 1..3/));
t('array 2D', () => unit(FB('VAR m : ARRAY[1..3, 1..4] OF INT; s : INT; END_VAR\nVAR_TEMP i : INT; j : INT; END_VAR', 'FOR #i := 1 TO 3 DO FOR #j := 1 TO 4 DO #m[#i, #j] := #i * 10 + #j; END_FOR; END_FOR; #s := #m[2, 3] + #m[3, 4];'), 'FB_T', [[{}, {s: 57}]]));
t('array 2D wrong dims', () => err(FB('VAR m : ARRAY[1..3, 1..4] OF INT; END_VAR', '#m[1] := 1;'), /2 Dimensionen/));
t('array whole assign', () => unit(FB('VAR a : ARRAY[1..3] OF INT := [1,2,3]; b : ARRAY[1..3] OF INT; END_VAR', '#b := #a; #a[1] := 9;'), 'FB_T', [[{}, {b: [1, 2, 3], a: [9, 2, 3]}]]));
t('array size mismatch', () => err(FB('VAR a : ARRAY[1..3] OF INT; b : ARRAY[1..4] OF INT; END_VAR', '#b := #a;'), /Grenzen/));
t('index must be int', () => err(FB('VAR a : ARRAY[1..3] OF INT; r : REAL; END_VAR', '#a[#r] := 1;'), /Ganzzahl/));
t('array used without index', () => err(FB('VAR a : ARRAY[1..3] OF INT; i : INT; END_VAR', '#i := #a;'), /Typkonflikt/));
t('array of bool', () => unit(FB('VAR a : ARRAY[0..7] OF BOOL; n : INT; END_VAR\nVAR_TEMP i : INT; END_VAR', '#a[2] := TRUE; #a[5] := TRUE; #n := 0; FOR #i := 0 TO 7 DO IF #a[#i] THEN #n := #n + 1; END_IF; END_FOR;'), 'FB_T', [[{}, {n: 2}]]));

/* ---------------- 7. STRUCT, UDT, DB ---------------- */
const UDT = 'TYPE "UDT_Teil"\nVERSION : 0.1\n STRUCT\n  Nr : DINT;\n  Gewicht : REAL;\n  OK : BOOL;\n END_STRUCT;\nEND_TYPE\n';
t('struct member', () => unit(FB('VAR Teil : STRUCT Nr : DINT; Gewicht : REAL; END_STRUCT; g : REAL; END_VAR', '#Teil.Gewicht := 4.5; #g := #Teil.Gewicht * 2;'), 'FB_T', [[{}, {g: 9, Teil: {Gewicht: 4.5}}]]));
t('struct unknown member', () => err(FB('VAR Teil : STRUCT Nr : DINT; END_STRUCT; END_VAR', '#Teil.Gewich := 1;'), /kein Element/));
t('struct member suggestion', () => err(FB('VAR Teil : STRUCT Gewicht : REAL; END_STRUCT; END_VAR', '#Teil.Gewicht1 := 1;'), /Meintest du "Gewicht"/));
t('udt usage', () => unit(UDT + FB('VAR t : "UDT_Teil"; END_VAR', '#t.Nr := 17; #t.OK := #t.Gewicht > 0.0;'), 'FB_T', [[{}, {t: {Nr: 17, OK: false}}]]));
t('udt unquoted ok', () => unit(UDT + FB('VAR t : UDT_Teil; END_VAR', '#t.Nr := 1;'), 'FB_T', [[{}, {t: {Nr: 1}}]]));
t('udt with init', () => unit('TYPE "U"\nSTRUCT\n a : INT := 5;\nEND_STRUCT;\nEND_TYPE\n' + FB('VAR x : "U"; END_VAR', '#x.a := #x.a + 1;'), 'FB_T', [[{}, {x: {a: 6}}]]));
t('array of udt', () => unit(UDT + FB('VAR Charge : ARRAY[1..8] OF "UDT_Teil"; Summe : REAL; END_VAR\nVAR_TEMP i : INT; END_VAR', 'FOR #i := 1 TO 8 DO #Charge[#i].Gewicht := #i; END_FOR; #Summe := 0.0; FOR #i := 1 TO 8 DO #Summe := #Summe + #Charge[#i].Gewicht; END_FOR;'), 'FB_T', [[{}, {Summe: 36}]]));
t('udt whole copy', () => unit(UDT + FB('VAR a : "UDT_Teil"; b : "UDT_Teil"; END_VAR', '#a.Nr := 3; #b := #a;'), 'FB_T', [[{}, {b: {Nr: 3}}]]));
t('udt vs struct mismatch', () => err(UDT + FB('VAR a : "UDT_Teil"; b : STRUCT Nr : DINT; END_STRUCT; END_VAR', '#b := #a;'), /gleichen Typ/));
t('udt self reference', () => err('TYPE "U"\nSTRUCT\n x : "U";\nEND_STRUCT;\nEND_TYPE', /enthält sich selbst/));
t('udt nested', () => unit('TYPE "P"\nSTRUCT\n x : INT;\nEND_STRUCT;\nEND_TYPE\nTYPE "Q"\nSTRUCT\n p : "P";\n n : INT;\nEND_STRUCT;\nEND_TYPE\n' + FB('VAR q : "Q"; END_VAR', '#q.p.x := 4; #q.n := #q.p.x * 2;'), 'FB_T', [[{}, {q: {p: {x: 4}, n: 8}}]]));
const DB = 'DATA_BLOCK "DB_Zelle"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n VAR\n  Anzahl : INT;\n  Werte : ARRAY[1..3] OF INT := [1, 2, 3];\n  Text : STRING[20] := \'Start\';\n END_VAR\nBEGIN\n Anzahl := 5;\nEND_DATA_BLOCK\n';
t('global db read/write', () => prog(DB + OB('"DB_Zelle".Anzahl := "DB_Zelle".Anzahl + "DB_Zelle".Werte[3];'), {}, {tests: [{setup: {}, expect: {'"DB_Zelle".Anzahl': 8, 'DB_Zelle.Werte': [1, 2, 3]}}]}));
t('db begin init', () => prog(DB + OB(';'), {}, {tests: [{setup: {}, expect: {'DB_Zelle.Anzahl': 5, 'DB_Zelle.Text': 'Start'}}]}));
t('db unknown member', () => err(DB + OB('"DB_Zelle".Anzal := 1;'), /Meintest du "Anzahl"/));
t('db keeps value between scans', () => prog(DB + OB('"DB_Zelle".Anzahl := "DB_Zelle".Anzahl + 1;'), {}, {timed: [{steps: [{dt: 0.1, expect: {'DB_Zelle.Anzahl': 6}}, {dt: 0.1, expect: {'DB_Zelle.Anzahl': 7}}]}]}));
t('db only VAR', () => err('DATA_BLOCK "D"\nVAR_TEMP x : INT; END_VAR\nBEGIN\nEND_DATA_BLOCK', /nur den Bereich VAR/));
t('db of udt', () => prog(UDT + 'DATA_BLOCK "DB_T"\n"UDT_Teil"\nBEGIN\nEND_DATA_BLOCK\n' + OB('"DB_T".Nr := 9;'), {}, {tests: [{expect: {'DB_T.Nr': 9}}]}));
t('db as local var misuse', () => err(DB + OB('"DB_Zelle" := 1;'), /Typkonflikt|beschreiben/));

/* ---------------- 8. STRING ---------------- */
t('LEN', () => eq(val("LEN('Hallo')", 'INT'), 5));
t('CONCAT', () => eq(val("CONCAT(IN1 := 'Teil ', IN2 := '17')", 'STRING'), 'Teil 17'));
t('CONCAT 3', () => eq(val("CONCAT(IN1 := 'a', IN2 := 'b', IN3 := 'c')", 'STRING'), 'abc'));
t('CONCAT positional', () => eq(val("CONCAT('a', 'b')", 'STRING'), 'ab'));
t('LEFT', () => eq(val("LEFT(IN := 'A-0042-B', L := 1)", 'STRING'), 'A'));
t('RIGHT', () => eq(val("RIGHT(IN := 'A-0042-B', L := 1)", 'STRING'), 'B'));
t('MID', () => eq(val("MID(IN := 'A-0042-B', L := 4, P := 3)", 'STRING'), '0042'));
t('FIND', () => eq(val("FIND(IN1 := 'A-0042-B', IN2 := '-')", 'INT'), 2));
t('FIND none', () => eq(val("FIND(IN1 := 'ABC', IN2 := 'X')", 'INT'), 0));
t('DELETE', () => eq(val("DELETE(IN := 'ABCDE', L := 2, P := 2)", 'STRING'), 'ADE'));
t('INSERT', () => eq(val("INSERT(IN1 := 'ABE', IN2 := 'CD', P := 2)", 'STRING'), 'ABCDE'));
t('REPLACE', () => eq(val("REPLACE(IN1 := 'ABCDE', IN2 := 'xy', L := 2, P := 2)", 'STRING'), 'AxyDE'));
t('INT_TO_STRING', () => eq(val('INT_TO_STRING(498)', 'STRING'), '498'));
t('STRING_TO_INT', () => eq(val("STRING_TO_INT('0042')", 'INT'), 42));
t('string compare', () => eq(val("'abc' = 'abc'", 'BOOL'), true));
t('string order', () => eq(val("'abc' < 'abd'", 'BOOL'), true));
t('string truncation runtime', () => unit(FB('VAR s : STRING[5]; END_VAR', "#s := CONCAT(IN1 := 'Teil ', IN2 := 'OK');"), 'FB_T', [[{}, {s: 'Teil '}]]));
t('string trunc warning literal', () => warns(FB('VAR s : STRING[5]; END_VAR', "#s := 'Teil fertig';"), 'STRING_TRUNC'));
t('string no trunc warning for computed', () => warns(FB('VAR s : STRING[5]; a : STRING[10]; END_VAR', "#s := CONCAT(IN1 := #a, IN2 := 'x');"), 'STRING_TRUNC', null, false));
t('string plus error', () => err(FB('VAR s : STRING; END_VAR', "#s := 'a' + 'b';"), /CONCAT/));
t('int to string error', () => err(FB('VAR s : STRING; END_VAR', '#s := 5;'), /INT_TO_STRING|Text-Wert/));
t('CONCAT with number err', () => err(FB('VAR s : STRING; END_VAR', "#s := CONCAT(IN1 := 'a', IN2 := 5);"), /verbindet nur Texte/));
t('LEN wrong type', () => err(FB('VAR i : INT; END_VAR', '#i := LEN(5);'), /Text/));
t('MID missing param', () => err(FB('VAR s : STRING; END_VAR', "#s := MID(IN := 'abc', L := 1);"), /P fehlt/));
t('unknown param name', () => err(FB('VAR s : STRING; END_VAR', "#s := LEFT(IN := 'abc', N := 1);"), /keinen Parameter "N"/));
t('function result unused', () => err(FB('', "LEN('x');"), /muss verwendet werden/));

/* ---------------- 9. FC ---------------- */
const MAX3 = FC('INT', 'VAR_INPUT a : INT; b : INT; c : INT; END_VAR', '#FC_Max3 := #a;\nIF #b > #FC_Max3 THEN #FC_Max3 := #b; END_IF;\nIF #c > #FC_Max3 THEN #FC_Max3 := #c; END_IF;', 'FC_Max3');
t('FC return', () => unit(MAX3, 'FC_Max3', [[{a: 3, b: 9, c: 4}, {FC_Max3: 9}], [{c: 12}, {RET: 12}]]));
t('FC call in expression', () => prog(MAX3 + OB('"Ergebnis" := "FC_Max3"(a := 1, b := "Wert", c := 2) + 1;'), {Wert: 7, Ergebnis: 0}, {tests: [{setup: {Wert: 7}, expect: {Ergebnis: 8}}]}));
t('FC missing param', () => err(MAX3 + OB('"Ergebnis" := "FC_Max3"(a := 1, b := 2);'), /es fehlt "c"/, {Ergebnis: 0}));
t('FC positional params', () => err(MAX3 + OB('"Ergebnis" := "FC_Max3"(1, 2, 3);'), /mit Namen/, {Ergebnis: 0}));
t('FC unknown param', () => err(MAX3 + OB('"Ergebnis" := "FC_Max3"(a := 1, b := 2, d := 3);'), /Meintest du "c"|keinen Parameter/, {Ergebnis: 0}));
t('FC as variable', () => err(MAX3 + OB('"Ergebnis" := "FC_Max3";'), /Klammern/, {Ergebnis: 0}));
t('FC Ret_Val alias', () => unit(FC('INT', 'VAR_INPUT a : INT; END_VAR', '#Ret_Val := #a * 2;', 'FC_D'), 'FC_D', [[{a: 4}, {FC_D: 8}]]));
const SKAL = FC('REAL', 'VAR_INPUT Roh : INT; END_VAR', '#FC_Skalieren := INT_TO_REAL(#Roh) * 100.0 / 27648.0;', 'FC_Skalieren');
t('FC scaling', () => unit(SKAL, 'FC_Skalieren', [[{Roh: 27648}, {RET: 100}], [{Roh: 13824}, {RET: 50}]]));
const WITHOUT = FC('REAL', 'VAR_INPUT Roh : INT; END_VAR\nVAR_OUTPUT Fehler : BOOL; END_VAR', 'IF #Roh < 0 OR #Roh > 27648 THEN #Fehler := TRUE; #FC_S := 0.0; ELSE #Fehler := FALSE; #FC_S := INT_TO_REAL(#Roh) / 276.48; END_IF;', 'FC_S');
t('FC output', () => prog(WITHOUT + OB('"P" := "FC_S"(Roh := "R", Fehler => "F");'), {R: 0, P: 0.0, F: false}, {tests: [{setup: {R: 30000}, expect: {F: true, P: 0}}, {setup: {R: 27648}, expect: {F: false, P: 100}}]}, {P: 'REAL'}));
t('FC output with := err', () => err(WITHOUT + OB('"P" := "FC_S"(Roh := "R", Fehler := "F");'), /mit "=>"/, {R: 0, P: 0.0, F: false}));
t('FC output missing', () => err(WITHOUT + OB('"P" := "FC_S"(Roh := "R");'), /Fehler/, {R: 0, P: 0.0, F: false}));
t('FC output not all paths warn', () => warns(FC('INT', 'VAR_INPUT a : INT; END_VAR\nVAR_OUTPUT q : BOOL; END_VAR', 'IF #a > 5 THEN #q := TRUE; END_IF; #FC_T := 0;'), 'OUT_NOT_ALL_PATHS'));
t('FC output all paths ok', () => warns(FC('INT', 'VAR_INPUT a : INT; END_VAR\nVAR_OUTPUT q : BOOL; END_VAR', 'IF #a > 5 THEN #q := TRUE; ELSE #q := FALSE; END_IF; #FC_T := 0;'), 'OUT_NOT_ALL_PATHS', null, false));
t('FC output default first ok', () => warns(FC('INT', 'VAR_INPUT a : INT; END_VAR\nVAR_OUTPUT q : BOOL; END_VAR', '#q := FALSE; IF #a > 5 THEN #q := TRUE; END_IF; #FC_T := 0;'), 'OUT_NOT_ALL_PATHS', null, false));
t('FC ret not set warn', () => warns(FC('INT', 'VAR_INPUT a : INT; END_VAR', 'IF #a > 5 THEN #FC_T := 1; END_IF;'), 'RET_NOT_SET'));
t('FC ret return path', () => warns(FC('INT', 'VAR_INPUT a : INT; END_VAR', 'IF #a > 5 THEN RETURN; END_IF; #FC_T := 1;'), 'RET_NOT_SET'));
t('FC case all branches', () => warns(FC('INT', 'VAR_INPUT a : INT; END_VAR', 'CASE #a OF 1: #FC_T := 1; ELSE #FC_T := 2; END_CASE;'), 'RET_NOT_SET', null, false));
t('FC output uninit runtime is default', () => prog(FC('INT', 'VAR_INPUT a : INT; END_VAR\nVAR_OUTPUT q : INT; END_VAR', 'IF #a > 5 THEN #q := 7; END_IF; #FC_T := 0;') + OB('"Dummy" := "FC_T"(a := "A", q => "Q");'), {A: 0, Q: 5, Dummy: 0}, {tests: [{setup: {A: 1, Q: 5}, expect: {Q: 0}}]}));
t('FC void', () => prog(FC('VOID', 'VAR_INPUT n : INT; END_VAR\nVAR_OUTPUT r : BOOL; g : BOOL; END_VAR', '#r := #n = 1; #g := #n = 2;', 'FC_Ampel') + OB('"FC_Ampel"(n := "N", r => "R", g => "G");'), {N: 0, R: false, G: false}, {tests: [{setup: {N: 2}, expect: {R: false, G: true}}]}));
t('FC void in expression err', () => err(FC('VOID', 'VAR_INPUT n : INT; END_VAR', ';', 'FC_V') + OB('"X" := "FC_V"(n := 1);'), /keinen Wert/, {X: 0}));
t('FC temp read before write', () => warns(FC('INT', 'VAR_TEMP z : INT; END_VAR', '#z := #z + 1; #FC_T := #z;'), 'TEMP_READ_BEFORE_WRITE'));
t('FC temp counter does not count', () => prog(FC('INT', 'VAR_TEMP z : INT; END_VAR', '#z := #z + 1; #FC_T := #z;') + OB('"X" := "FC_T"();'), {X: 0}, {timed: [{steps: [{dt: 0.1, expect: {X: 1}}, {dt: 0.1, expect: {X: 1}}]}]}));
t('FC temp written ok', () => warns(FC('INT', 'VAR_TEMP z : INT; END_VAR', '#z := 5; #FC_T := #z;'), 'TEMP_READ_BEFORE_WRITE', null, false));
t('FC temp in one branch only', () => warns(FC('INT', 'VAR_INPUT a : BOOL; END_VAR\nVAR_TEMP z : INT; END_VAR', 'IF #a THEN #z := 1; END_IF; #FC_T := #z;'), 'TEMP_READ_BEFORE_WRITE'));
t('FC in_out sort', () => prog(FC('VOID', 'VAR_IN_OUT w : ARRAY[1..5] OF INT; END_VAR\nVAR_TEMP i : INT; j : INT; h : INT; END_VAR', 'FOR #i := 1 TO 4 DO FOR #j := 1 TO 5 - #i DO IF #w[#j] > #w[#j + 1] THEN #h := #w[#j]; #w[#j] := #w[#j + 1]; #w[#j + 1] := #h; END_IF; END_FOR; END_FOR;', 'FC_Sort') + OB('"FC_Sort"(w := "Werte");'), {Werte: [5, 3, 9, 1, 4]}, {tests: [{setup: {Werte: [5, 3, 9, 1, 4]}, expect: {Werte: [1, 3, 4, 5, 9]}}]}, {Werte: 'ARRAY[1..5] OF INT'}));
t('in_out scalar', () => prog(FC('VOID', 'VAR_IN_OUT z : INT; END_VAR', '#z := #z + 1;', 'FC_Inc') + OB('"FC_Inc"(z := "Zaehler");'), {Zaehler: 0}, {timed: [{steps: [{dt: 0.1, expect: {Zaehler: 1}}, {dt: 0.1, expect: {Zaehler: 2}}]}]}));
t('in_out needs variable', () => err(FC('VOID', 'VAR_IN_OUT z : INT; END_VAR', '#z := #z + 1;', 'FC_Inc') + OB('"FC_Inc"(z := 5);'), /braucht eine Variable/));
t('in_out type strict', () => err(FC('VOID', 'VAR_IN_OUT z : DINT; END_VAR', '#z := #z + 1;', 'FC_Inc') + OB('"FC_Inc"(z := "Zaehler");'), /genau den Typ/, {Zaehler: 0}));
t('in_out struct member', () => prog(UDT + FC('VOID', 'VAR_IN_OUT t : "UDT_Teil"; END_VAR', '#t.OK := #t.Gewicht > 10.0;', 'FC_Pruef') + 'DATA_BLOCK "D"\nVAR\n T : "UDT_Teil";\nEND_VAR\nBEGIN\nEND_DATA_BLOCK\n' + OB('"FC_Pruef"(t := "D".T);'), {}, {tests: [{setup: {'D.T.Gewicht': 12}, expect: {'D.T.OK': true}}]}));
t('input copy semantics', () => prog(FC('INT', 'VAR_INPUT a : INT; END_VAR', '#a := #a + 1; #FC_T := #a;') + OB('"Y" := "FC_T"(a := "X");'), {X: 5, Y: 0}, {tests: [{setup: {X: 5}, expect: {X: 5, Y: 6}}]}));
t('recursion forbidden', () => err(FC('INT', 'VAR_INPUT n : INT; END_VAR', '#F := "F"(n := #n - 1);', 'F'), /Rekursion/));
t('indirect recursion', () => err(FC('INT', '', '#A := "B"();', 'A') + FC('INT', '', '#B := "A"();', 'B'), /Rekursion/));
t('two FCs library', () => prog(SKAL + FC('BOOL', 'VAR_INPUT w : REAL; g : REAL; END_VAR', '#FC_Grenze := #w > #g;', 'FC_Grenze') + OB('"Alarm" := "FC_Grenze"(w := "FC_Skalieren"(Roh := "Roh"), g := 80.0);'), {Roh: 0, Alarm: false}, {tests: [{setup: {Roh: 27000}, expect: {Alarm: true}}, {setup: {Roh: 1000}, expect: {Alarm: false}}]}));
t('FC global access warn', () => warns(FC('INT', '', '#FC_T := "Wert";'), 'GLOBAL_ACCESS', {Wert: 1}));

/* ---------------- 10. FB & Instanzen ---------------- */
const FLANKE = FB('VAR_INPUT Signal : BOOL; END_VAR\nVAR_OUTPUT Flanke : BOOL; END_VAR\nVAR Merker : BOOL; END_VAR', '#Flanke := #Signal AND NOT #Merker;\n#Merker := #Signal;', 'FB_Flanke');
t('FB edge', () => unit(FLANKE, 'FB_Flanke', [[{Signal: true}, {Flanke: true}], [{Signal: true}, {Flanke: false}], [{Signal: false}, {Flanke: false}], [{Signal: true}, {Flanke: true}]]));
t('FB single instance auto DB', () => prog(FLANKE + OB('"FB_Flanke_DB"(Signal := "Taster", Flanke => "Impuls");'), {Taster: false, Impuls: false}, {timed: [{steps: [{dt: 0.1, inputs: {Taster: true}, expect: {Impuls: true}}, {dt: 0.1, expect: {Impuls: false}}]}]}));
t('FB declared instance', () => { const p = P.compileProject({sources: [{block: 'x', src: FLANKE + OB('"Flanke1"(Signal := "Taster");\n"Impuls" := "Flanke1".Flanke;')}], globals: {Taster: false, Impuls: false}, instances: {Flanke1: 'FB_Flanke'}}); const r = P.runAll(p, {timed: [{steps: [{dt: 0.1, inputs: {Taster: true}, expect: {Impuls: true}}]}]}); if(!r.ok) throw new Error('fail'); });
t('FB instance DB source', () => prog(FLANKE + 'DATA_BLOCK "IDB"\n"FB_Flanke"\nBEGIN\nEND_DATA_BLOCK\n' + OB('"IDB"(Signal := "T");'), {T: false}, {timed: [{steps: [{dt: 0.1, inputs: {T: true}, expect: {'IDB.Flanke': true}}]}]}));
t('FB call type name err', () => err(FLANKE + OB('"FB_Flanke"(Signal := TRUE);'), /braucht eine Instanz/));
t('FB call in expression err', () => err(FLANKE + OB('"X" := "FB_Flanke_DB"(Signal := TRUE);'), /eigene Anweisung/, {X: false}));
t('FB output read', () => prog(FLANKE + OB('"FB_Flanke_DB"(Signal := "T");\n"Q" := "FB_Flanke_DB".Flanke;'), {T: false, Q: false}, {tests: [{setup: {T: true}, expect: {Q: true}}]}));
t('FB output write from outside err', () => err(FLANKE + OB('"FB_Flanke_DB"(Signal := TRUE);\n"FB_Flanke_DB".Flanke := TRUE;'), /nur lesen/));
t('FB temp not visible outside', () => err(FB('VAR_TEMP h : INT; END_VAR', '#h := 1;', 'FB_H') + OB('"FB_H_DB"();\n"X" := "FB_H_DB".h;'), /TEMP-Variable/, {X: 0}));
t('FB inputs keep last value', () => unit(FB('VAR_INPUT e : INT; END_VAR\nVAR_OUTPUT a : INT; END_VAR', '#a := #e;', 'FB_K') + FB('VAR k : "FB_K"; r1 : INT; r2 : INT; END_VAR', '#k(e := 5); #r1 := #k.a; #k(); #r2 := #k.a;', 'FB_Top'), 'FB_Top', [[{}, {r1: 5, r2: 5}]]));
const MOTOR = FB('VAR_INPUT Start : BOOL; Stopp : BOOL; END_VAR\nVAR_OUTPUT Lauf : BOOL; END_VAR', '#Lauf := (#Start OR #Lauf) AND NOT #Stopp;', 'FB_Motor');
t('multi instance', () => prog(MOTOR + FB('VAR_INPUT S1 : BOOL; S2 : BOOL; Halt : BOOL; END_VAR\nVAR_OUTPUT L1 : BOOL; L2 : BOOL; END_VAR\nVAR Band1 : "FB_Motor"; Band2 : "FB_Motor"; END_VAR', '#Band1(Start := #S1, Stopp := #Halt, Lauf => #L1);\n#Band2(Start := #S2, Stopp := #Halt, Lauf => #L2);', 'FB_Anlage') + OB('"FB_Anlage_DB"(S1 := "T1", S2 := "T2", Halt := "H", L1 => "M1", L2 => "M2");'), {T1: false, T2: false, H: false, M1: false, M2: false}, {timed: [{steps: [{dt: 0.1, inputs: {T1: true}, expect: {M1: true, M2: false}}, {dt: 0.1, inputs: {T1: false, T2: true}, expect: {M1: true, M2: true}}, {dt: 0.1, inputs: {T2: false, H: true}, expect: {M1: false, M2: false}}]}]}));
t('shared instance warn', () => warns(MOTOR + OB('"FB_Motor_DB"(Start := "T1", Stopp := "H", Lauf => "M1");\n"FB_Motor_DB"(Start := "T2", Stopp := "H", Lauf => "M2");'), 'INSTANCE_TWICE', {T1: false, T2: false, H: false, M1: false, M2: false}));
t('shared instance behaviour wrong', () => { const p = compile(MOTOR + OB('"FB_Motor_DB"(Start := "T1", Stopp := "H", Lauf => "M1");\n"FB_Motor_DB"(Start := "T2", Stopp := "H", Lauf => "M2");'), {T1: false, T2: false, H: false, M1: false, M2: false}); const r = P.runAll(p, {timed: [{steps: [{dt: 0.1, inputs: {T1: true}, expect: {M1: true, M2: false}}]}]}); return !r.ok; });
t('multi instance hash call', () => unit(MOTOR + FB('VAR m : "FB_Motor"; l : BOOL; END_VAR', 'm(Start := TRUE, Lauf => l);', 'FB_X'), 'FB_X', [[{}, {l: true}]]));
t('multi instance member read', () => unit(MOTOR + FB('VAR m : "FB_Motor"; l : BOOL; END_VAR', '#m(Start := TRUE); #l := #m.Lauf;', 'FB_X'), 'FB_X', [[{}, {l: true}]]));
t('instance unknown member', () => err(MOTOR + FB('VAR m : "FB_Motor"; l : BOOL; END_VAR', '#m(); #l := #m.Lauff;', 'FB_X'), /kein Element/));
t('instance as value err', () => err(MOTOR + FB('VAR m : "FB_Motor"; l : BOOL; END_VAR', '#l := #m;', 'FB_X'), /Instanz/));
t('timer multi instance', () => unit(FB('VAR_INPUT Ein : BOOL; END_VAR\nVAR_OUTPUT Stoerung : BOOL; END_VAR\nVAR Ueberw : TON; END_VAR', '#Ueberw(IN := #Ein, PT := T#2S);\n#Stoerung := #Ueberw.Q;', 'FB_M'), 'FB_M', [[0.1, {Ein: true}, {Stoerung: false}], [1.5, {}, {Stoerung: false}], [0.5, {}, {Stoerung: true}], [0.1, {Ein: false}, {Stoerung: false}]]));
t('timer PT needs time', () => err(FB('VAR t : TON; END_VAR', '#t(IN := TRUE, PT := 5);'), /Zeit/));
t('timer type called directly', () => err(FB('', 'TON(IN := TRUE, PT := T#1S);'), /Bausteintyp/));
t('CTU in FB', () => unit(FB('VAR_INPUT Imp : BOOL; Res : BOOL; END_VAR\nVAR_OUTPUT Voll : BOOL; Ist : INT; END_VAR\nVAR Z : CTU; END_VAR', '#Z(CU := #Imp, R := #Res, PV := 3, Q => #Voll, CV => #Ist);', 'FB_Z'), 'FB_Z', [[{Imp: true}, {Ist: 1}], [{Imp: false}, {Ist: 1}], [{Imp: true}, {Ist: 2}], [{Imp: false}, {}], [{Imp: true}, {Ist: 3, Voll: true}], [{Res: true}, {Ist: 0, Voll: false}]]));
t('R_TRIG instance', () => unit(FB('VAR_INPUT s : BOOL; END_VAR\nVAR_OUTPUT n : INT; END_VAR\nVAR f : R_TRIG; END_VAR', '#f(CLK := #s); IF #f.Q THEN #n := #n + 1; END_IF;', 'FB_R'), 'FB_R', [[{s: true}, {n: 1}], [{s: true}, {n: 1}], [{s: false}, {n: 1}], [{s: true}, {n: 2}]]));
t('conditional call warn', () => warns(FB('VAR_INPUT e : BOOL; END_VAR\nVAR t : TON; END_VAR', 'IF #e THEN #t(IN := TRUE, PT := T#1S); END_IF;'), 'CONDITIONAL_CALL'));
t('conditional call freezes', () => unit(FB('VAR_INPUT e : BOOL; END_VAR\nVAR_OUTPUT q : BOOL; END_VAR\nVAR t : TON; END_VAR', 'IF #e THEN #t(IN := #e, PT := T#1S); END_IF; #q := #t.Q;', 'FB_C'), 'FB_C', [[0.1, {e: true}, {q: false}], [1.0, {}, {q: true}], [0.1, {e: false}, {q: true}]]));
t('FB global access warn', () => warns(FB('VAR_OUTPUT q : BOOL; END_VAR', '#q := "Taster";'), 'GLOBAL_ACCESS', {Taster: false}));
t('FB global access second instance breaks', () => { const src = FB('VAR_OUTPUT q : BOOL; END_VAR', '#q := "Taster";', 'FB_G'); warns(src, 'GLOBAL_ACCESS', {Taster: false}); });
t('FB stat vs temp counter', () => unit(FB('VAR_OUTPUT a : INT; b : INT; END_VAR\nVAR s : INT; END_VAR\nVAR_TEMP tt : INT; END_VAR', '#s := #s + 1; #tt := #tt + 1; #a := #s; #b := #tt;', 'FB_ST'), 'FB_ST', [[{}, {a: 1, b: 1}], [{}, {a: 2, b: 1}], [{}, {a: 3, b: 1}]]));
t('FB temp warn', () => warns(FB('VAR_OUTPUT a : INT; END_VAR\nVAR_TEMP z : INT; END_VAR', '#z := #z + 1; #a := #z;'), 'TEMP_READ_BEFORE_WRITE'));
t('FB static read outside', () => prog(FB('VAR_INPUT l : BOOL; END_VAR\nVAR Laufzeit : TIME; END_VAR', 'IF #l THEN #Laufzeit := #Laufzeit + T#100MS; END_IF;', 'FB_BS') + OB('"FB_BS_DB"(l := "L");\n"Anz" := TIME_TO_DINT("FB_BS_DB".Laufzeit);'), {L: true, Anz: 0}, {timed: [{steps: [{dt: 0.1, expect: {Anz: 100}}, {dt: 0.1, expect: {Anz: 200}}]}]}, {Anz: 'DINT'}));
t('in_out required for FB', () => err(FB('VAR_IN_OUT x : INT; END_VAR', '#x := 1;', 'FB_IO') + OB('"FB_IO_DB"();'), /muss bei jedem Aufruf/));
t('unused var warn', () => warns(FB('VAR x : INT; END_VAR', ';'), 'UNUSED_VAR'));
t('no unused when used', () => warns(FB('VAR x : INT; END_VAR', '#x := 1;'), 'UNUSED_VAR', null, false));
t('local name wrong hash', () => err(FB('VAR Zahl : INT; END_VAR', '#Zahll := 1;'), /Meintest du "#Zahl"/));
t('global unknown', () => err(OB('"Lampe" := TRUE;'), /Unbekannter Name/));
t('local shadows global', () => unit(FB('VAR x : INT; END_VAR', 'x := 3;'), 'FB_T', [[{}, {x: 3}]], {x: 7}));
t('quoted forces global', () => prog(FB('VAR x : INT; END_VAR', '#x := "x" + 1;', 'FB_Q') + OB('"FB_Q_DB"();'), {x: 7}, {tests: [{setup: {x: 7}, expect: {'FB_Q_DB.x': 8}}]}));
t('FOR var must be declared', () => err(FB('VAR a : INT; END_VAR', 'FOR i := 1 TO 3 DO #a := #a + 1; END_FOR;'), /muss im Baustein deklariert/));
t('FOR var modified err', () => err(FB('VAR_TEMP i : INT; END_VAR', 'FOR #i := 1 TO 3 DO #i := 5; END_FOR;'), /nicht verändert/));
t('EXIT outside loop', () => err(FB('', 'EXIT;'), /nur innerhalb einer Schleife/));
t('infinite loop detect', () => { try{ unit(FB('VAR a : INT; END_VAR', 'WHILE TRUE DO #a := 1; END_WHILE;'), 'FB_T', [[{}, {}]]); }catch(e){ if(/Endlosschleife/.test(e.message)) return; throw e; } throw new Error('nicht erkannt'); });
t('CASE with constants', () => unit(FB('VAR CONSTANT S_WARTEN : INT := 0; S_LAUF : INT := 10; END_VAR\nVAR Schritt : INT; o : INT; END_VAR', 'CASE #Schritt OF #S_WARTEN: #o := 1; #Schritt := #S_LAUF; S_LAUF: #o := 2; END_CASE;'), 'FB_T', [[{}, {o: 1, Schritt: 10}], [{}, {o: 2}]]));
t('CASE overlap', () => err(FB('VAR s : INT; END_VAR', 'CASE #s OF 1..5: ; 3: ; END_CASE;'), /überschneidet/));
t('CASE non-const label', () => err(FB('VAR s : INT; x : INT; END_VAR', 'CASE #s OF x: ; END_CASE;'), /Konstanten/));
t('call depth OK nested FCs', () => prog(FC('INT', 'VAR_INPUT a : INT; END_VAR', '#F1 := #a + 1;', 'F1') + FC('INT', 'VAR_INPUT a : INT; END_VAR', '#F2 := "F1"(a := #a) * 2;', 'F2') + OB('"X" := "F2"(a := 3);'), {X: 0}, {tests: [{expect: {X: 8}}]}));

/* ---------------- 11. Programmzyklus ---------------- */
t('OB100 runs once', () => prog('ORGANIZATION_BLOCK "Startup"\nBEGIN\n"Z" := 100;\nEND_ORGANIZATION_BLOCK\n' + OB('"Z" := "Z" + 1;'), {Z: 0}, {timed: [{steps: [{dt: 0.1, expect: {Z: 101}}, {dt: 0.1, expect: {Z: 102}}]}]}));
t('OB order via meta', () => { const p = P.compileProject({sources: [{block: 'a', src: 'ORGANIZATION_BLOCK "Anlauf"\nBEGIN\n"Z" := 5;\nEND_ORGANIZATION_BLOCK'}, {block: 'b', src: OB('"Z" := "Z" * 2;')}], globals: {Z: 0}}); const r = P.runAll(p, {tests: [{expect: {Z: 10}}]}); if(!r.ok) throw new Error('fail'); });
t('call order matters', () => { const src = FB('VAR_INPUT e : INT; END_VAR\nVAR_OUTPUT a : INT; END_VAR', '#a := #e + 1;', 'FB_A') + OB('"FB_A_DB"(e := "Mitte", a => "Ende");\n"Mitte" := "Anfang" * 10;'); const p = compile(src, {Anfang: 0, Mitte: 0, Ende: 0}); const r = P.runAll(p, {timed: [{steps: [{dt: 0.1, inputs: {Anfang: 2}, expect: {Ende: 21}}]}]}); return !r.ok; });
t('temp in OB', () => prog(OB('#h := "A" * 2;\n"B" := #h + 1;', 'VAR_TEMP h : INT; END_VAR'), {A: 3, B: 0}, {tests: [{setup: {A: 3}, expect: {B: 7}}]}));
t('global types spec', () => prog(OB('"Summe" := "Summe" + 40000;'), {Summe: 0}, {tests: [{expect: {Summe: 40000}}]}, {Summe: 'DINT'}));
t('global array spec', () => prog(OB('"W"[1] := 5;'), {W: [0, 0, 0]}, {tests: [{expect: {W: [5, 0, 0]}}]}, {W: 'ARRAY[1..3] OF INT'}));
t('global string', () => prog(OB('"Text" := CONCAT(IN1 := \'Teil \', IN2 := INT_TO_STRING("Nr"));'), {Text: '', Nr: 17}, {tests: [{setup: {Nr: 17}, expect: {Text: 'Teil 17'}}]}, {Text: 'STRING[24]'}));
t('global string default type', () => prog(OB('"Text" := \'Hallo\';'), {Text: ''}, {tests: [{expect: {Text: 'Hallo'}}]}));
t('time arithmetic', () => prog(OB('"T2" := "T1" + T#2S;'), {T1: 0, T2: 0}, {tests: [{setup: {T1: 1}, expect: {T2: 3}}]}, {T1: 'TIME', T2: 'TIME'}));
t('TIME_TO_DINT', () => eq(val('TIME_TO_DINT(T#1S500MS)', 'DINT'), 1500));
t('DINT_TO_TIME', () => eq(val('DINT_TO_TIME(2500) = T#2.5S', 'BOOL'), true));
t('runtime error has block', () => { const p = compile(FB('VAR a : INT; b : INT; END_VAR', '#a := 10 / #b;', 'FB_Div')); const r = P.runUnitTests(p, [{block: 'FB_Div', steps: [{inputs: {}, expect: {}}]}]); return !r.ok && r.error.block === 'Test' && /Division durch 0/.test(r.error.message); });
t('path to multi instance', () => prog(MOTOR + FB('VAR B1 : "FB_Motor"; END_VAR', '#B1(Start := TRUE);', 'FB_A') + OB('"FB_A_DB"();'), {}, {tests: [{expect: {'FB_A_DB.B1.Lauf': true}}]}));
t('trace call tree', () => { const p = compile(MOTOR + FB('VAR B1 : "FB_Motor"; B2 : "FB_Motor"; END_VAR', '#B1(Start := TRUE);\n#B2(Start := FALSE);', 'FB_A') + OB('"FB_A_DB"();')); const r = P.runProgramTimed(p, [{steps: [{dt: 0.1, expect: {}}]}], {trace: true}); const tr = r.report[0].steps[0].trace; eq(tr.map(x => x.label + '@' + x.depth), ['Main [OB1]@0', '"FB_A_DB"@1', '#B1@2', '#B2@2']); eq(tr[2].vars.find(v => v.name === 'Lauf').value, true); });
t('trace temp vs stat', () => { const p = compile(FB('VAR s : INT; END_VAR\nVAR_TEMP z : INT; END_VAR', '#z := 5; #s := #s + #z;', 'FB_S') + OB('"FB_S_DB"();')); const r = P.runProgramTimed(p, [{steps: [{dt: 0.1}, {dt: 0.1}].map(s => Object.assign({expect: {}}, s))}], {trace: true}); const v = r.report[0].steps[1].trace[1].vars; eq(v.find(x => x.name === 's').value, 10); eq(v.find(x => x.name === 'z').sec, 'Temp'); });

/* ---------------- 12. Projektmodell & Export ---------------- */
t('readInterface rows', () => { const r = P.readInterface(MOTOR); eq(r.rows.map(x => x.sec + ':' + x.name + ':' + x.type), ['Input:Start:BOOL', 'Input:Stopp:BOOL', 'Output:Lauf:BOOL']); });
t('readInterface init + comment', () => { const r = P.readInterface(FB('VAR\n z : INT := 10; // Zähler\nEND_VAR', '')); eq([r.rows[0].init, r.rows[0].comment], ['10', 'Zähler']); });
t('writeInterface replace', () => { const s = P.writeInterface(MOTOR, [{sec: 'Input', name: 'Ein', type: 'Bool', init: '', comment: 'Taster'}, {sec: 'Output', name: 'Lauf', type: 'Bool'}]); const r = P.readInterface(s); eq(r.rows.map(x => x.name), ['Ein', 'Lauf']); if(!/#Lauf := \(#Start/.test(s)) throw new Error('Rumpf verändert'); });
t('writeInterface insert', () => { const s = P.writeInterface('FUNCTION_BLOCK "X"\nBEGIN\n;\nEND_FUNCTION_BLOCK', [{sec: 'Static', name: 'a', type: 'Int', init: '5'}]); const r = P.readInterface(s); eq(r.rows[0].init, '5'); compile(s); });
t('writeInterface roundtrip same', () => { const r = P.readInterface(MOTOR); const s = P.writeInterface(MOTOR, r.rows); eq(P.readInterface(s).rows.length, 3); compile(s); });
t('table row check', () => eq(P.checkTableRow({name: 'a b', type: 'Int'}) !== null, true));
t('table row type check', () => eq(P.checkTableRow({name: 'ab', type: 'Array[1..'}) !== null, true));
t('table row ok', () => eq(P.checkTableRow({name: 'ab', type: 'Array[1..5] of Int', init: '[5(0)]'}), null));
t('no TIA export in engine', () => eq([typeof P.exportProject, typeof P.exportZip], ['undefined', 'undefined']));

/* ---------------- 13. Konstrukte ---------------- */
t('array bounds must match', () => err(FB('VAR a : ARRAY[0..2] OF INT; b : ARRAY[1..3] OF INT; END_VAR', '#b := #a;'), /Grenzen/));
t('constant usage construct', () => { const c = P.constructsUsed(compile(FB('VAR CONSTANT K : INT := 3; END_VAR\nVAR x : INT; END_VAR', '#x := #K;'))); return c.has('CONSTANT') && c.has('VAR_CONSTANT'); });
t('constant declared unused construct', () => { const c = P.constructsUsed(compile(FB('VAR CONSTANT K : INT := 3; END_VAR\nVAR x : INT; END_VAR', '#x := 3;'))); return !c.has('CONSTANT'); });
t('constructs FC', () => { const c = P.constructsUsed(compile(MAX3 + OB('"X" := "FC_Max3"(a := 1, b := 2, c := 3);'), {X: 0})); ['FC', 'OB', 'FC_CALL', 'VAR_INPUT', 'RETVAL', 'IF'].forEach(k => { if(!c.has(k)) throw new Error(k); }); });
t('constructs multi', () => { const c = P.constructsUsed(compile(MOTOR + FB('VAR m : "FB_Motor"; END_VAR', '#m();', 'FB_X'))); ['FB', 'MULTI', 'FB_CALL', 'STAT', 'FB_INSTANCE'].forEach(k => { if(!c.has(k)) throw new Error(k); }); });
t('constructs filter blocks', () => { const p = P.compileProject({sources: [{block: 'a', src: MOTOR}, {block: 'b', src: FB('VAR x : ARRAY[1..2] OF INT; END_VAR', '#x[1] := 1;', 'FB_Y')}]}); const c = P.constructsUsed(p, ['a']); return !c.has('ARRAY') && c.has('FB'); });
t('constructs string/udt/db', () => { const c = P.constructsUsed(compile(UDT + DB + OB('"DB_Zelle".Text := CONCAT(IN1 := \'a\', IN2 := \'b\');'))); ['UDT', 'DB', 'DB_ACCESS', 'CONCAT', 'STRING', 'MEMBER'].forEach(k => { if(!c.has(k)) throw new Error(k); }); });
t('constructs bit & temp', () => { const c = P.constructsUsed(compile(FB('VAR w : WORD; END_VAR\nVAR_TEMP b : BOOL; END_VAR', '#b := #w.%X1; #w.%X2 := #b;'))); ['BIT', 'TEMP', 'WORD'].forEach(k => { if(!c.has(k)) throw new Error(k); }); });
t('describeProgram', () => { const d = P.describeProgram(compile(MOTOR)); eq(d[0].iface.Input.map(v => v.type), ['Bool', 'Bool']); });

// NORM_X / SCALE_X (Sensorwerkstatt)
const NX = (ret, body, decl) => 'FUNCTION "FC_Skal" : ' + ret + '\nVAR_INPUT\n   Roh : Int;\nEND_VAR\n' + (decl || '') + 'BEGIN\n' + body + '\nEND_FUNCTION';
t('NORM_X/SCALE_X Real', () => unit(NX('Real', '   #FC_Skal := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := #Roh, MAX := 27648), MAX := 100.0);'), 'FC_Skal', [[{Roh:0},{RET:0}],[{Roh:13824},{RET:50}],[{Roh:27648},{RET:100}],[{Roh:32511},{RET:117.59}]]));
t('SCALE_X Int-Ziel rundet', () => unit(NX('Int', '   #FC_Skal := SCALE_X(MIN := 0, VALUE := INT_TO_REAL(#Roh) / 1000.0, MAX := 27648);'), 'FC_Skal', [[{Roh:500},{RET:13824}],[{Roh:123},{RET:3401}],[{Roh:1000},{RET:27648}]]));
t('NORM_X ausserhalb linear', () => unit(NX('Real', '   #FC_Skal := NORM_X(MIN := 0, VALUE := #Roh, MAX := 27648);'), 'FC_Skal', [[{Roh:-4864},{RET:-0.17593}]]));
t('NORM_X Bool → Fehler', () => err(NX('Real', '   #FC_Skal := NORM_X(MIN := 0, VALUE := TRUE, MAX := 27648);'), /NORM_X/));
t('SCALE_X VALUE Int → Fehler', () => err(NX('Real', '   #FC_Skal := SCALE_X(MIN := 0.0, VALUE := #Roh, MAX := 100.0);'), /VALUE muss REAL/));
t('NORM_X Int-Ziel → Fehler', () => err(NX('Int', '   #FC_Skal := NORM_X(MIN := 0, VALUE := #Roh, MAX := 27648);'), /Kommazahl|REAL/));

// force (generisch): Programm- und Bausteintests
t('force Programmtest', () => { const p = compile(OB('"Lampe" := "Sensor";'), {Sensor:false, Lampe:false});
  const spec = {tests:[{setup:{Sensor:true}, expect:{Lampe:true}}], timed:[{steps:[{dt:0.1, inputs:{Sensor:true}, expect:{Lampe:true}}]}]};
  return P.runAll(p, spec).ok && !P.runAll(p, {tests: spec.tests}, {force:{Sensor:false}}).ok && !P.runAll(p, {timed: spec.timed}, {force:{Sensor:false}}).ok; });
t('force Bausteintest', () => { const p = compile('FUNCTION_BLOCK "FB_L"\nVAR_INPUT\n   s : Bool;\nEND_VAR\nVAR_OUTPUT\n   q : Bool;\nEND_VAR\nBEGIN\n   #q := #s;\nEND_FUNCTION_BLOCK');
  const u = [{block:'FB_L', steps:[{inputs:{s:true}, expect:{q:true}}]}];
  return P.runUnitTests(p, u).ok && !P.runUnitTests(p, u, {force:{s:false}}).ok; });

console.log('SCLPro-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen');
if(failN){ fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
