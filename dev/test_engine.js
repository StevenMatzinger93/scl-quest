const E=require('./src/engine.js');
let fails=0;
function run(code, vars, setup, extra){ const d={vars, fbTypes:(extra&&extra.fb)||{}, varTypes:(extra&&extra.types)||{}}; const p=E.compileSCL(code,d); return E.executeOnce(p, vars, setup); }
function eq(name, a, b){ const ok=JSON.stringify(a)===JSON.stringify(b); if(!ok){fails++; console.log('FAIL',name,'got',JSON.stringify(a),'want',JSON.stringify(b));} }
function err(name, code, vars, re, extra){ try{ const d={vars, fbTypes:(extra&&extra.fb)||{}, varTypes:(extra&&extra.types)||{}}; const p=E.compileSCL(code,d); E.executeOnce(p,vars,{}); fails++; console.log('FAIL no error',name);}catch(e){ if(!(e instanceof E.SCLError)){fails++;console.log('FAIL js error',name,e);return;} if(re && !re.test(e.message)){fails++; console.log('FAIL msg',name,e.message);} else console.log('  ok',name,'→ Z'+e.line+':',e.message);} }
// precedence
eq('prec1', run('x := 2 + 3 * 4;',{x:0}).x, 14);
eq('prec2', run('b := TRUE AND FALSE XOR TRUE;',{b:false}).b, true);   // (T AND F) XOR T = T
eq('prec3', run('b := FALSE OR TRUE AND FALSE;',{b:true}).b, false);
eq('prec4', run('b := NOT a = FALSE;',{a:true,b:false}).b, true);
eq('intdiv', run('x := 7 / 2;',{x:0}).x, 3);
eq('realdiv', run('r := 7.0 / 2;',{r:0.5}).r, 3.5);
eq('realdiv2', run('r := INT_TO_REAL(7) / 2;',{r:0}, {}, {types:{r:'REAL'}}).r, 3.5);
eq('mod', run('x := 17 MOD 5;',{x:0}).x, 2);
eq('case range', [10,50,90].map(g=>run('CASE g OF 0..30: s := 1; 31..70: s := 2; ELSE s := 3; END_CASE;',{g:0,s:0},{g}).s), [1,2,3]);
eq('case list', [1,2,3,4].map(g=>run('CASE g OF 1,3: s := 1; 2: s:=2; END_CASE;',{g:0,s:0},{g}).s), [1,2,1,0]);
eq('case neg', run('CASE g OF -5..-1: s := 1; ELSE s:=2; END_CASE;',{g:-3,s:0}).s, 1);
eq('for by', run('s := 0; FOR i := 10 TO 0 BY -2 DO s := s + i; END_FOR;',{s:0}).s, 30);
eq('repeat', run('n := 0; REPEAT n := n + 3; UNTIL n > 10 END_REPEAT;',{n:0}).n, 12);
eq('continue', run('s := 0; FOR i := 1 TO 5 DO IF i = 3 THEN CONTINUE; END_IF; s := s + i; END_FOR;',{s:0}).s, 12);
eq('exit', run('s := 0; FOR i := 1 TO 5 DO IF i = 3 THEN EXIT; END_IF; s := s + i; END_FOR;',{s:0}).s, 3);
eq('case-insens', run('greifer_auf := true;',{Greifer_Auf:false}).Greifer_Auf, true);
eq('tia', run('#Motor := "Start" AND NOT #Stop;',{Motor:false,Start:true,Stop:false}).Motor, true);
eq('hex', run('x := 16#FF + 2#101;',{x:0}).x, 260);
eq('limit', run('x := LIMIT(MN := 0, IN := y, MX := 100);',{x:0,y:150}).x, 100);
eq('round', run('x := REAL_TO_INT(2.6); y := TRUNC(2.6);',{x:0,y:0}), {x:3,y:2});
eq('arr', run('a[2] := a[1] + 1;',{a:[0,5,0]}).a, [0,5,6]);
eq('addr', run('%Q0.0 := %I0.0;',{Q0_0:false, I0_0:true}).Q0_0, true);
eq('comments', run('(* block\n x := 5; *) x := 1; // x:=2\n /* y */',{x:0}).x, 1);
eq('time', run('t := T#1m30s;',{t:0},{}, {types:{t:'TIME'}}).t, 90);
// errors
err('eq assign','x = 5;',{x:0},/:=/);
err('missing semi','x := 5\ny := 3;',{x:0,y:0},/Semikolon/);
err('unknown var','Greifr_Auf := TRUE;',{Greifer_Auf:false},/Meintest du "Greifer_Auf"/);
err('bool:=int','b := 1;',{b:false},/TRUE oder FALSE/);
err('int:=real','x := 2.5;',{x:0},/REAL_TO_INT/);
err('if int','IF m THEN x := 1; END_IF;',{m:0,x:0},/BOOL/);
err('and int','b := m AND TRUE;',{m:0,b:false},/AND verknüpft/);
err('missing end_if','IF b THEN x := 1;',{b:true,x:0},/END_IF/);
err('else if','IF b THEN x := 1; ELSE IF c THEN x := 2; END_IF;',{b:true,c:true,x:0},/ELSIF/);
err('then missing','IF b\n x := 1; END_IF;',{b:true,x:0},/THEN/);
err('==','IF b == TRUE THEN x:=1; END_IF;',{b:true,x:0},/einfachen/);
err('div0','x := 5 / y;',{x:0,y:0},/Division durch 0/);
err('bounds','a[3] := 1;',{a:[0,0,0]},/ausserhalb/);
err('endless','WHILE TRUE DO x := x + 1; END_WHILE;',{x:0},/Endlosschleife/);
err('case overlap','CASE g OF 1..5: x:=1; 3: x:=2; END_CASE;',{g:0,x:0},/überschneidet/);
err('var block','VAR x : INT; END_VAR',{x:0},/Deklarationen/);
err('fb as var','x := T1;',{x:false},/Baustein/, {fb:{T1:'TON'}});
err('pt int','T1(IN := TRUE, PT := 5);',{},/TIME/, {fb:{T1:'TON'}});
err('write output','T1.Q := TRUE;',{},/nur lesen/, {fb:{T1:'TON'}});
err('loop var mod','FOR i := 0 TO 3 DO i := 5; END_FOR;',{},/Zählvariable/);
err('exit outside','EXIT;',{},/Schleife/);
err('arr no index','a := 0;',{a:[1,2]},/Array/);
err('case colon','CASE g OF 1 := x := 1; END_CASE;',{g:0,x:0},/Doppelpunkt/);
// timers
function timed(code, vars, fb, steps, vt){ const p=E.compileSCL(code,{vars, fbTypes:fb, varTypes:vt||{}}); return E.executeTimed(p, vars, {}, steps); }
let s=timed('T1(IN := x, PT := T#3S); q := T1.Q;',{x:false,q:false},{T1:'TON'},[{dt:0,inputs:{x:true}},{dt:1},{dt:1},{dt:1},{dt:1,inputs:{x:false}}]);
eq('TON', s.map(e=>e.q), [false,false,false,true,false]);
s=timed('T1(IN := x, PT := T#5S); q := T1.Q;',{x:false,q:false},{T1:'TOF'},[{dt:0,inputs:{x:true}},{dt:1,inputs:{x:false}},{dt:4},{dt:1},{dt:1}]);
eq('TOF', s.map(e=>e.q), [true,true,true,false,false]);
s=timed('T1(IN := x, PT := T#2S); q := T1.Q;',{x:false,q:false},{T1:'TP'},[{dt:0,inputs:{x:true}},{dt:1,inputs:{x:false}},{dt:1},{dt:0,inputs:{x:true}}]);
eq('TP', s.map(e=>e.q), [true,true,false,true]);
s=timed('C(CU := x, R := r, PV := 3); q := C.Q; n := C.CV;',{x:false,r:false,q:false,n:0},{C:'CTU'},[{inputs:{x:true}},{inputs:{x:false}},{inputs:{x:true}},{inputs:{x:true}},{inputs:{x:false}},{inputs:{x:true}},{inputs:{r:true}}]);
eq('CTU', s.map(e=>e.n+':'+e.q), ['1:false','1:false','2:false','2:false','2:false','3:true','0:false']);
s=timed('T1(IN := x, PT := T#3S, Q => q, ET => e);',{x:false,q:false,e:0},{T1:'TON'},[{dt:0,inputs:{x:true}},{dt:2}],{e:'TIME'});
eq('outparams', [s[1].q, s[1].e], [false, 2]);
console.log(fails? fails+' FAILURES':'ALL ENGINE TESTS PASSED');
