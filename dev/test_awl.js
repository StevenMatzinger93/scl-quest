// Tests für die AWL-Übersetzung (awl.js) mit der Grundstufen-Engine
const SE = require('./src/engine.js');
const AWL = require('./src/awl.js');
const E = AWL.wrapEngine(SE);
let pass = 0, failN = 0;
const ok = (c, m) => { if(c) pass++; else { failN++; console.log('✗ ' + m); } };
const task = (vars, types) => ({ lang:'awl', initialVars: vars, varTypes: types || {} });
function once(src, vars, setup, types){ const t = task(vars, types); const p = E.compileSCL(src, t); return E.executeOnce(p, t.initialVars, setup); }
function timed(src, vars, steps, types){ const t = task(vars, types); const p = E.compileSCL(src, t); return E.executeTimed(p, t.initialVars, {}, steps.map(s => ({ dt:s[0], inputs:s[1] }))); }
function err(src, vars, re, types){ try{ E.compileSCL(src, task(vars, types)); ok(false, 'Fehler erwartet: ' + re); } catch(e){ ok(re.test(e.message), 'Fehlertext ' + re + ' ≠ ' + e.message); } }
const B = { a:false, b:false, c:false, d:false, q:false, q2:false };
// UND / ODER / Erstabfrage / UND vor ODER
const tt = (src, f) => { for(let m = 0; m < 16; m++){ const s = { a:!!(m&1), b:!!(m&2), c:!!(m&4), d:!!(m&8) }; const env = once(src, B, s); ok(env.q === f(s), src.replace(/\n/g, ' | ') + ' @' + JSON.stringify(s) + ' → ' + env.q); } };
tt('U a\nU b\n= q', s => s.a && s.b);
tt('U a\nUN b\n= q', s => s.a && !s.b);
tt('O a\nO b\n= q', s => s.a || s.b);
tt('U a\nO b\n= q', s => s.a || s.b);
tt('U a\nU b\nO c\nU d\n= q', s => (s.a && s.b) || (s.c && s.d));
tt('U a\nU b\nO\nU c\nU d\n= q', s => (s.a && s.b) || (s.c && s.d));
tt('U a\nU(\nO b\nO c\n)\n= q', s => s.a && (s.b || s.c));
tt('U(\nU a\nO b\n)\nU(\nU c\nO d\n)\n= q', s => (s.a || s.b) && (s.c || s.d));
tt('UN(\nU a\nU b\n)\n= q', s => !(s.a && s.b));
tt('X a\nX b\n= q', s => s.a !== s.b);
tt('U a\nXN b\n= q', s => s.a === s.b);
tt('U a\nNOT\n= q', s => !s.a);
tt('U a\nO b\nNOT\n= q', s => !(s.a || s.b));
tt('ON a\nU b\n= q', s => !s.a && s.b);
tt('U a\nO b\nU c\n= q', s => s.a || (s.b && s.c));
// zweimal zuweisen, SET/CLR
{ const e = once('U a\n= q\n= q2', B, { a:true }); ok(e.q && e.q2, '= zweimal'); }
{ const e = once('SET\n= q\nCLR\n= q2', B, {}); ok(e.q && !e.q2, 'SET/CLR'); }
// Speichern
{ const r = timed('U a\nS q\nU b\nR q', B, [[0.1, { a:true }], [0.1, { a:false }], [0.1, { b:true }], [0.1, { a:true, b:true }]]); ok(r[0].q && r[1].q && !r[2].q && !r[3].q, 'S/R Rücksetzen dominant ' + r.map(x => x.q)); }
{ const r = timed('U a\nO q\nUN b\n= q', B, [[0.1, { a:true }], [0.1, { a:false }], [0.1, { b:true }]]); ok(r[0].q && r[1].q && !r[2].q, 'Selbsthaltung'); }
// Flanke
{ const r = timed('U a\nFP m\n= q', Object.assign({ m:false }, B), [[0.1, { a:true }], [0.1, {}], [0.1, { a:false }], [0.1, { a:true }]]); ok(r.map(x => x.q).join() === 'true,false,false,true', 'FP ' + r.map(x => x.q)); }
{ const r = timed('U a\nFN m\n= q', Object.assign({ m:false }, B), [[0.1, { a:true }], [0.1, { a:false }], [0.1, {}]]); ok(r.map(x => x.q).join() === 'false,true,false', 'FN'); }
// Laden, Rechnen, Transferieren
const N = { x:0, y:0, z:0, r:0, q:false };
{ const e = once('L x\nL y\n+I\nT z', N, { x:7, y:5 }); ok(e.z === 12, '+I ' + e.z); }
{ const e = once('L x\nL y\n-I\nT z', N, { x:7, y:5 }); ok(e.z === 2, '-I (AKKU2-AKKU1) ' + e.z); }
{ const e = once('L x\nL 3\n*I\nL 2\n/I\nT z', N, { x:7 }); ok(e.z === 10, '*I /I ' + e.z); }
{ const e = once('L x\nL 4\nMOD\nT z', N, { x:11 }); ok(e.z === 3, 'MOD'); }
{ const e = once('L x\nL y\nTAK\n-I\nT z', N, { x:7, y:5 }); ok(e.z === -2, 'TAK ' + e.z); }
{ const e = once('L x\nITD\nDTR\nL 2.5\n*R\nT r', N, { x:4 }, { r:'REAL' }); ok(Math.abs(e.r - 10) < 1e-6, 'DTR *R ' + e.r); }
{ const e = once('L r\nRND\nT z', N, { r:2.6 }, { r:'REAL' }); ok(e.z === 3, 'RND'); }
{ const e = once('L x\nINC 2\nT z', N, { x:4 }); ok(e.z === 6, 'INC'); }
{ const e = once('L x\nNEGI\nT z', N, { x:4 }); ok(e.z === -4, 'NEGI'); }
// Vergleich
{ const e = once('L x\nL 10\n>I\n= q', N, { x:11 }); ok(e.q === true, '>I'); const e2 = once('L x\nL 10\n>I\n= q', N, { x:10 }); ok(e2.q === false, '>I nein'); }
{ const e = once('L x\nL y\n==I\n= q', N, { x:3, y:3 }); ok(e.q, '==I'); }
{ const e = once('U q\nU(\nL x\nL 5\n>=I\n)\n= q', N, { q:true, x:5 }); ok(e.q, 'Vergleich in Klammer'); }
// Zeiten
const TV = { a:false, q:false };
{ const r = timed('U a\nL S5T#2S\nSE T1\nU T1\n= q', TV, [[0, { a:true }], [1, {}], [1.1, {}], [0.1, { a:false }]]); ok(r.map(x => x.q).join() === 'false,false,true,false', 'SE ' + r.map(x => x.q)); }
{ const r = timed('U a\nL S5T#2S\nSA T1\nU T1\n= q', TV, [[0, { a:true }], [0.1, { a:false }], [1, {}], [1.1, {}]]); ok(r.map(x => x.q).join() === 'true,true,true,false', 'SA ' + r.map(x => x.q)); }
{ const r = timed('U a\nL S5T#2S\nSI T1\nU T1\n= q', TV, [[0, { a:true }], [1, {}], [1.1, {}], [0.1, { a:false }], [0.1, { a:true }], [0.1, { a:false }]]); ok(r.map(x => x.q).join() === 'true,true,false,false,true,false', 'SI ' + r.map(x => x.q)); }
{ const r = timed('U a\nL S5T#2S\nSV T1\nU T1\n= q', TV, [[0, { a:true }], [0.1, { a:false }], [1, {}], [1.1, {}]]); ok(r.map(x => x.q).join() === 'true,true,true,false', 'SV ' + r.map(x => x.q)); }
// Zähler
const ZV = { a:false, b:false, c:false, q:false, n:0 };
{ const r = timed('U a\nZV Z1\nU b\nZR Z1\nU c\nL 5\nS Z1\nL Z1\nT n\nU Z1\n= q', ZV, [[0.1, { a:true }], [0.1, { a:false }], [0.1, { a:true }], [0.1, { b:true }], [0.1, { b:false, c:true }], [0.1, { c:false }]]);
  ok(r.map(x => x.n).join() === '1,1,2,1,5,5' && r[0].q, 'Zähler ' + r.map(x => x.n)); }
// Sprünge
{ const src = 'U a\nSPB M1\nL 1\nT n\nSPA ENDE\nM1: L 2\nT n\nENDE: BEA';
  ok(once(src, ZV, { a:true }).n === 2 && once(src, ZV, { a:false }).n === 1, 'SPB/SPA'); }
{ const src = 'U a\nSPBN M1\nL 5\nT n\nM1: U b\n= q';
  const e1 = once(src, ZV, { a:false, b:true }); ok(e1.n === 0 && e1.q, 'SPBN springt'); const e2 = once(src, ZV, { a:true }); ok(e2.n === 5 && !e2.q, 'SPBN fällt durch'); }
{ const e = once('L 0\nT n\nL 5\nM1: T x\nL n\nL 2\n+I\nT n\nL x\nLOOP M1', Object.assign({ x:0 }, ZV), {}); ok(e.n === 10, 'LOOP ' + e.n); }
{ const e = once('U a\nBEB\nL 7\nT n', ZV, { a:true }); ok(e.n === 0, 'BEB'); const e2 = once('U a\nBEB\nL 7\nT n', ZV, { a:false }); ok(e2.n === 7, 'BEB fällt durch'); }
// Status
{ const t = task(B); const p = E.compileSCL('U a\nU b\n= q', t); const env = E.executeOnce(p, t.initialVars, { a:true, b:false }); const st = AWL.statusOf(p.awl, env); ok(st[1].v === true && st[2].v === false && st[3].v === false, 'Status VKE ' + JSON.stringify(st)); }
{ const t = task(N); const p = E.compileSCL('L x\nL y\n+I\nT z', t); const env = E.executeOnce(p, t.initialVars, { x:2, y:3 }); const st = AWL.statusOf(p.awl, env); ok(st[1].a === 2 && st[2].a === 3 && st[2].b === 2 && st[3].a === 5, 'Status AKKU ' + JSON.stringify(st)); }
{ const t = task(ZV); const p = E.compileSCL('U a\nSPB M1\nL 1\nT n\nM1: L 2\nT n', t); const env = E.executeOnce(p, t.initialVars, { a:true }); const st = AWL.statusOf(p.awl, env); ok(!st[3] && st[5] && st[5].a === 2, 'Status übersprungene Zeilen ' + JSON.stringify(st)); }
// Fehler
err('U a\n= x', B, /Unbekannter Operand „x“/);
err('U aa\n= q', B, /Meintest du „a“/);
err('L a\nT q', B, /Bit/);
err('U x\n= q', N, /INT/);
err('L r\nT z', N, /Runde|RND/, { r:'REAL' });
err('L x\nL r\n+I\nT z', N, /Ganzzahlen/, { r:'REAL' });
err('SPA M9', B, /Sprungmarke „M9“/);
err('U(\nU a\n= q', B, /Klammer/);
err('A a\n= q', B, /UND „U“/);
err('= q', B, /keine Abfrage/);
err('U a\nSE T1\nU T1\n= q', TV, /lade sie davor/);
err('M1: U a\nM1: = q', B, /zweimal/);
// Konstrukte
{ const p = E.compileSCL('U a\nUN b\n= q', task(B)); const s = E.constructsUsed(p); ok(s.has('U') && s.has('UN') && s.has('ASSIGN') && !s.has('IF'), 'Konstrukte ' + [...s]); }

// ---------- Profi: Bausteine mit AWL-Rumpf ----------
global.window = global;
const PRO0 = require('./src/engine_pro.js');
const PRO = global.SCLPro = AWL.wrapPro(PRO0);
global.SCL_CONTENT = global.SCL_CONTENT || { tasks:[], chapters:[], theory:[], bugs:[] };
require('./src/content/_helpers.js');
const FC = 'FUNCTION "FC_Frei" : Void\nVAR_INPUT\n   a : Bool;\n   b : Bool;\nEND_VAR\nVAR_OUTPUT\n   q : Bool;\nEND_VAR\nBEGIN\nU #a\nU #b\n= #q\nEND_FUNCTION';
const MAIN = b => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + b + '\nEND_ORGANIZATION_BLOCK';
function pro(o){ const t = defProTask(Object.assign({ id:'x' + Math.random(), ch:11, title:'x', story:'', brief:'' }, o)); global.SCL_CONTENT.tasks.pop(); return ProTask.evaluate(t, ProTask.refCodes(t)); }
function proErr(o, re){ try{ const ev = pro(o); ok(false, 'Profi-Fehler erwartet ' + re + ' ok=' + ev.ok); }catch(e){ ok(re.test(e.message), 'Profi-Fehlertext ' + re + ' ≠ ' + e.message); } }
{ const ev = pro({ blocks:[{ name:'FC_Frei', kind:'FC', src: FC }, { name:'Main', kind:'OB', edit:true, ref: MAIN('CALL "FC_Frei"\n   a := "E1"\n   b := "E2"\n   q => "A1"') }],
    globals:{ E1:false, E2:false, A1:false }, tests:[[{ E1:true, E2:true }, { A1:true }], [{ E1:true }, { A1:false }]], must:['CALL'] });
  ok(ev.ok, 'Profi FC-Aufruf ' + JSON.stringify(ev.res.failed || ev.missing)); ok(!ev.prog.warnings.length, 'keine Warnungen ' + JSON.stringify(ev.prog.warnings.map(w => w.code + ' ' + w.message))); }
const FB = 'FUNCTION_BLOCK "FB_Walze"\nVAR_INPUT\n   Ein : Bool;\n   Aus : Bool;\nEND_VAR\nVAR_OUTPUT\n   Laeuft : Bool;\n   Zeit_um : Bool;\nEND_VAR\nVAR\n   T_Lauf : TON;\n   Stueck : Int;\n   M_Fl : Bool;\nEND_VAR\nBEGIN\n';
{ const body = 'U #Ein\nO #Laeuft\nUN #Aus\n= #Laeuft\nCALL #T_Lauf\n   IN := #Laeuft\n   PT := T#2S\n   Q => #Zeit_um\nU #Laeuft\nFP #M_Fl\nSPBN M1\nL #Stueck\nL 1\n+I\nT #Stueck\nM1: NOP 0';
  const ev = pro({ blocks:[{ name:'FB_Walze', kind:'FB', edit:true, ref: FB + body.replace('M1: NOP 0', 'M1: L #Stueck\nT #Stueck') + '\nEND_FUNCTION_BLOCK' }, { name:'Main', kind:'OB', src: MAIN('CALL "FB_Walze", "FB_Walze_DB"\n   Ein := "S_Ein"\n   Aus := "S_Aus"\n   Laeuft => "Motor"\n   Zeit_um => "Fertig"\nL "FB_Walze_DB".Stueck\nT "Anzahl"') }],
    globals:{ S_Ein:false, S_Aus:false, Motor:false, Fertig:false, Anzahl:0 },
    timed:[{ steps:[[0.1, { S_Ein:true }, { Motor:true, Anzahl:1, Fertig:false }], [0.1, { S_Ein:false }, { Motor:true, Anzahl:1 }], [2.1, {}, { Fertig:true }], [0.1, { S_Aus:true }, { Motor:false, Fertig:false }], [0.1, { S_Aus:false, S_Ein:true }, { Anzahl:2 }]] }], must:['CALL', 'FP', 'SPBN'] });
  ok(ev.ok, 'Profi FB mit Multiinstanz, Sprung, DB-Zugriff ' + JSON.stringify(ev.res.failed || ev.missing || ev.warnHits)); ok(!ev.prog.warnings.length, 'FB ohne Warnungen ' + JSON.stringify(ev.prog.warnings.map(w => w.code + ' ' + w.message))); }
{ const R = 'FUNCTION "FC_Mittel" : Real\nVAR_INPUT\n   a : Int;\n   b : Int;\nEND_VAR\nBEGIN\nL #a\nL #b\n+I\nDTR\nL 2.0\n/R\nT #Ret_Val\nEND_FUNCTION';
  const ev = pro({ blocks:[{ name:'FC_Mittel', kind:'FC', edit:true, ref: R }, { name:'Main', kind:'OB', src: MAIN('CALL "FC_Mittel"\n   a := "x"\n   b := "y"\n   RET_VAL := "m"') }],
    globals:{ x:0, y:0, m:0.0 }, types:{ m:'Real' }, unit:[{ block:'FC_Mittel', steps:[[{ a:3, b:4 }, { RET:3.5 }]] }], tests:[[{ x:10, y:5 }, { m:7.5 }]] });
  ok(ev.ok, 'Profi FC mit Rückgabewert REAL ' + JSON.stringify(ev.res.failed)); }
{ const U = 'TYPE "UDT_Walze"\nSTRUCT\n   Spalt : Int;\n   Ein : Bool;\nEND_STRUCT;\nEND_TYPE', D = 'DATA_BLOCK "DB_W"\nVAR\n   W : Array[1..2] of "UDT_Walze";\n   Summe : Int;\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
  const ev = pro({ blocks:[{ name:'UDT_Walze', kind:'UDT', src: U }, { name:'DB_W', kind:'DB', src: D }, { name:'Main', kind:'OB', edit:true, ref: MAIN('L "DB_W".W[1].Spalt\nL "DB_W".W[2].Spalt\n+I\nT "DB_W".Summe\nU "DB_W".W[1].Ein\n= "Lampe"') }],
    globals:{ Lampe:false }, tests:[[{ 'DB_W.W[1].Spalt':3, 'DB_W.W[2].Spalt':4, 'DB_W.W[1].Ein':true }, { 'DB_W.Summe':7, Lampe:true }]] });
  ok(ev.ok, 'Profi UDT/Array/DB ' + JSON.stringify(ev.res.failed)); }
proErr({ blocks:[{ name:'FC_Frei', kind:'FC', src: FC }, { name:'Main', kind:'OB', edit:true, ref: MAIN('CALL "FC_Frei"\n   a := "E1"\n   b := "E2"\n   q => "A1"\nU "E1"\n= "A9"') }], globals:{ E1:false, E2:false, A1:false } }, /Unbekannter Operand „"A9"“/);
proErr({ blocks:[{ name:'FB_W', kind:'FB', edit:true, ref: 'FUNCTION_BLOCK "FB_W"\nVAR_INPUT\n   a : Bool;\nEND_VAR\nBEGIN\nU #b\n= #a\nEND_FUNCTION_BLOCK' }, { name:'Main', kind:'OB', src: MAIN('CALL "FB_W", "FB_W_DB"\n   a := TRUE') }] }, /„#b“ ist in diesem Baustein nicht deklariert/);
proErr({ blocks:[{ name:'FB_W', kind:'FB', src: 'FUNCTION_BLOCK "FB_W"\nVAR_INPUT\n   a : Bool;\nEND_VAR\nBEGIN\nEND_FUNCTION_BLOCK' }, { name:'Main', kind:'OB', edit:true, ref: MAIN('CALL "FB_W"\n   a := TRUE') }] }, /Instanz-DB/);
proErr({ blocks:[{ name:'Main', kind:'OB', edit:true, ref: MAIN('U "a"\nL S5T#2S\nSE T1') }], globals:{ a:false } }, /S5-Zeiten/);

// force (generisch): über die Übersetzung nach SCL
{ const tk = task({ Sensor:false, Lampe:false }), p = E.compileSCL('U  Sensor\n=  Lampe', tk), tc = [{ setup:{ Sensor:true }, expect:{ Lampe:true } }];
  ok(E.runSinglePassTests(p, tk.initialVars, tc).ok, 'AWL ohne force');
  ok(!E.runSinglePassTests(p, tk.initialVars, tc, { force:{ Sensor:false } }).ok, 'AWL mit force scheitert');
  ok(!E.runTimedTests(p, tk.initialVars, [{ setup:{}, steps:[{ dt:0.1, inputs:{ Sensor:true }, expect:{ Lampe:true } }] }], { force:{ Sensor:false } }).ok, 'AWL Zeitverlauf mit force'); }

console.log('AWL-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen');
process.exit(failN ? 1 : 0);
