// FUP-Werkbank F0: Rundreise Text → Graph → Text für alle FUP-Musterlösungen, Startcodes, falschen Lösungen und Störungsszenarien.
// node test_fup_graph.js [--verbose]   → gleiche Testresultate über die Engine (gleiche Auswertung wie validate_kop.js fup)
const fs = require('fs'), path = require('path');
global.window = global;
const SE = require('./src/engine.js');
require('./src/engine_pro.js');
const KOP = require('./src/kop.js');
require('./src/content/_helpers.js');
global.QUEST = { id:'fup', lang:'fup' };
const G = require('./src/fup_graph.js');
const dir = path.join(__dirname, 'src/content_fup');
require(path.join(__dirname, 'src/content_kop/_kop.js'));
['manual.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
['theory.js', 'theory_pro.js', 'bugs.js'].forEach(f => { if(fs.existsSync(path.join(dir, f))) require(path.join(dir, f)); });
const TAGS = (require(path.join(dir, 'tags.js')), global.PLC_TAGS);
const C = global.SCL_CONTENT, E = KOP.wrapEngine(SE), PT = global.ProTask;
global.SCLPro = KOP.wrapPro(global.SCLPro);
const VERBOSE = process.argv.includes('--verbose');

let fails = 0, total = 0, sameText = 0, unitTests = 0;
const stat = {}, exceptions = [];
const bump = (k, ok) => { stat[k] = stat[k] || { n: 0, ok: 0 }; stat[k].n++; if(ok) stat[k].ok++; };
const fail = (id, m) => { fails++; console.log('✗ [' + id + '] ' + m); };
const ok = (c, id, m) => { unitTests++; if(!c) fail(id, m); };

function roundTrip(txt){
  const g = G.fromText(txt);
  const t1 = G.toText(g);
  // stabil: erneutes Einlesen mit Layoutzeile ergibt denselben Text
  const t2 = G.toText(G.fromText(t1));
  return { g, text: t1, stable: t1 === t2, t2 };
}
const norm = s => KOP.serialize(KOP.parse(s)).replace(/NETWORK [^\n]*/g, 'NETWORK');
function summary(t, code){
  let prog;
  try{ prog = E.compileSCL(code, t); }catch(e){ return { err: true, msg: e.message }; }
  const res = t.timedTestCases ? SE.runTimedTests(prog, t.initialVars, t.timedTestCases) : SE.runSinglePassTests(prog, t.initialVars, t.testCases);
  const strip = r => r.steps ? r.steps.map(s => s.checks.map(c => [c.name, c.actual, c.pass])) : (r.checks || []).map(c => [c.name, c.actual, c.pass]);
  const used = E.constructsUsed(prog);
  return { ok: res.ok, must: (t.mustUse || []).every(m => used.has(m)), report: JSON.stringify(res.report.map(strip)) };
}
function checkPlain(t, label, code){
  total++;
  let rt;
  try{ rt = roundTrip(code); }catch(e){ fail(t.id + ' ' + label, 'Rundreise wirft: ' + e.message); bump(label, false); return; }
  const a = summary(t, code), b = summary(t, rt.text);
  let good = true;
  if(!!a.err !== !!b.err){ good = false; fail(t.id + ' ' + label, 'Übersetzbarkeit unterschiedlich: vorher ' + (a.err ? 'Fehler ' + a.msg : 'ok') + ', nachher ' + (b.err ? 'Fehler ' + b.msg : 'ok') + '\n' + rt.text); }
  else if(!a.err && (a.ok !== b.ok || a.report !== b.report || a.must !== b.must)){ good = false; fail(t.id + ' ' + label, 'Testresultate unterschiedlich (ok ' + a.ok + '→' + b.ok + ', must ' + a.must + '→' + b.must + ')\n--- vorher\n' + code + '\n--- nachher\n' + rt.text); }
  if(!rt.stable){ good = false; fail(t.id + ' ' + label, 'Text nicht stabil:\n' + rt.text + '\n---\n' + rt.t2); }
  try{ if(norm(code) === norm(G.toText(rt.g, { layout:false }))) sameText++; else if(VERBOSE) console.log('≈ [' + t.id + ' ' + label + '] Text weicht ab (Semantik gleich):\n' + norm(code) + '→\n' + norm(G.toText(rt.g, { layout:false }))); }catch(e){}
  bump(label, good);
}
function proCodes(codes){
  const out = {};
  Object.keys(codes).forEach(b => {
    const src = codes[b], sp = KOP.splitBlock(src);
    if(sp && KOP.isKopBody(sp.body) && sp.body.trim()){
      const rt = roundTrip(sp.body);
      if(!rt.stable) throw new Error('Text nicht stabil in ' + b);
      out[b] = sp.head + rt.text.replace(/\n$/, '') + sp.foot;
    } else out[b] = src;
  });
  return out;
}
function proSummary(t, codes){
  try{ const ev = PT.evaluate(t, codes); const f = ev.res && ev.res.failed; return { ok: ev.ok, missing: ev.missing.join(','), warn: ev.warnHits.map(w => w.code).join(','), failed: f ? (f.kind + ' ' + (f.failedCase ? JSON.stringify((f.failedCase.steps || [f.failedCase]).slice(-1)[0].checks.map(c => [c.name, c.actual])) : '')) : '' }; }
  catch(e){ return { err: true, msg: e.message }; }
}
function checkPro(t, label, codes){
  total++;
  let codes2;
  try{ codes2 = proCodes(codes); }catch(e){ fail(t.id + ' ' + label, 'Rundreise wirft: ' + e.message); bump('profi ' + label.replace(/ fs\d+_\w+$/, ''), false); return; }
  const a = proSummary(t, codes), b = proSummary(t, codes2);
  let good = true;
  if(!!a.err !== !!b.err){ good = false; fail(t.id + ' ' + label, 'Übersetzbarkeit unterschiedlich: ' + (a.msg || 'ok') + ' / ' + (b.msg || 'ok')); }
  else if(!a.err && JSON.stringify(a) !== JSON.stringify(b)){ good = false; fail(t.id + ' ' + label, 'Resultate unterschiedlich ' + JSON.stringify(a) + ' / ' + JSON.stringify(b)); }
  bump('profi ' + label.replace(/ fs\d+_\w+$/, ''), good);
}

/* ---------- Rundreise über alle Inhalte ---------- */
for(const t of C.tasks){
  if(t.pro){
    checkPro(t, 'Musterlösung', PT.refCodes(t));
    checkPro(t, 'Startcode', PT.startCodes(t));
    (t._wrong || []).forEach(w => checkPro(t, 'falsche Lösung', Object.assign(PT.refCodes(t), w)));
  } else {
    checkPlain(t, 'Musterlösung', t.refSolution);
    checkPlain(t, 'Startcode', t.starterCode);
    (t._wrong || []).forEach(w => checkPlain(t, 'falsche Lösung', w));
  }
}
for(const b of C.bugs || []){
  const t = C.tasks.find(x => x.id === b.task); const code = global.bugCode(t, b);
  if(t.pro) checkPro(t, 'Störung ' + b.id, code); else checkPlain(t, 'Störung', code);
}
// Theorie: verifyKop-Beispiele
for(const th of C.theory) (th.questions || []).forEach((q, i) => {
  if(!q.verifyKop) return;
  const v = q.verifyKop, t = { id: th.id + ' F' + (i + 1), lang:'kop', initialVars: v.vars || {}, fbTypes: v.fb || {}, varTypes: v.types || {} };
  if(v.steps) t.timedTestCases = [{ setup:{}, steps: v.steps.map(s => ({ dt:s[0], inputs:s[1] || {}, expect:s[2] || {} })) }]; else t.testCases = v.tests.map(x => ({ setup:x[0] || {}, expect:x[1] || {} }));
  checkPlain(t, 'Theorie', v.src);
});

/* ---------- Einzeltests: Modell, Editor-Graphen, check() ---------- */
{
  const T = { lang:'kop', initialVars:{ A:false, B:false, C:false, D:false, Q:false, Q2:false, M:false, Rst:false } };
  const run = (txt, env) => { const p = E.compileSCL(txt, T); const rt = SE.createRuntime(p, T.initialVars, {}); return rt.scan(0.1, env); };
  // Video-Netzwerk: & (3 Eingänge, erster negiert) → >=1 → =, plus SR daneben (zweite Kette)
  const g = { seq: 0, networks: [G.emptyNet('Video')] }, net = g.networks[0];
  const mk = (t, o) => { const n = G.makeNode(t, o); n.id = 'n' + (++g.seq); net.nodes.push(n); return n; };
  const a = mk('and', { inputs: 3 }); a.ins[0].op = 'A'; a.ins[0].neg = true; a.ins[1].op = 'B'; a.ins[2].op = 'C';
  const o = mk('or'); o.ins[1].op = 'D'; net.wires.push({ s: a.id, d: o.id, p: 0 });
  const q = mk('assign'); q.opnd = 'Q'; q.ins[0].op = null; net.wires.push({ s: o.id, d: q.id, p: 0 }); q.y = 0;
  const sr = mk('sr'); sr.opnd = 'M'; sr.ins[0].op = 'A'; sr.ins[1].op = 'Rst'; sr.y = 200;
  let txt = G.toText(g);
  ok(/NOT A AND B AND C OR D => Q;/.test(txt), 'video', 'Video-Netzwerk: ' + txt);
  ok(!/k":1/.test(txt) && /\nA => SR\(M, Rst\);/.test(txt) && (txt.match(/NETWORK/g) || []).length === 1, 'video', 'SR als zweite Kette im selben NETWORK (V4): ' + txt);
  const g2 = G.fromText(txt);
  ok(g2.networks.length === 1 && g2.networks[0].nodes.length === 4, 'video', 'Kette wird wieder ein Netzwerk: ' + g2.networks.length + '/' + (g2.networks[0] || { nodes: [] }).nodes.length);
  ok(g2.networks[0].nodes.find(n => n.t === 'and').x === a.x, 'video', 'Position bleibt erhalten');
  let env = run(txt, { A:false, B:true, C:true }); ok(env.Q === true && env.M === false, 'video', 'Semantik 1');
  env = run(txt, { A:true, B:true, C:true, Rst:false }); ok(env.Q === false && env.M === true, 'video', 'Semantik 2');
  ok(G.check(g, {}).ok, 'video', 'check ok: ' + JSON.stringify(G.check(g, {}).items));
  // Abzweig: ein Ausgang → zwei Zuweisungen
  q.ins[0].neg = false; const q2 = mk('assign'); q2.opnd = 'Q2'; q2.ins[0].op = null; q2.y = 100; net.wires.push({ s: o.id, d: q2.id, p: 0 });
  txt = G.toText(g); ok(/=> Q, Q2;/.test(txt), 'abzweig', txt);
  // negierte Zuweisung am Abzweig → => NOT Q2
  q2.ins[0].neg = true; txt = G.toText(g); ok(/=> Q, NOT Q2;/.test(txt), 'abzweig neg', txt);
  // Negation einer Box (De Morgan)
  q.ins[0].neg = true; q2.ins[0].neg = true; txt = G.toText(g); env = run(txt, { A:true, B:false, C:false, D:false }); ok(env.Q === true && env.Q2 === true, 'demorgan', txt);
  // Platzhalter, unbekannte Variable, Typkonflikt, Zyklus
  const g3 = G.fromText('NETWORK x\nTaste_A AND ? => Unbekannt;\n\nNETWORK y\nTaste_A AND TON(T1, Achsen) => Signal_A;');
  const ch = G.check(g3, { tags: TAGS });
  ok(!ch.ok && ch.items.some(x => /<\?\?\.\?>/.test(x.msg)), 'check', 'Platzhalter: ' + JSON.stringify(ch.items));
  ok(ch.items.some(x => /Nicht in der PLC-Variablentabelle/.test(x.msg)), 'check', 'unbekannt');
  ok(ch.items.some(x => /erwartet wird Time/.test(x.msg)), 'check', 'Typkonflikt PT');
  const g4 = { seq: 0, networks: [G.emptyNet('z')] }, n4 = g4.networks[0];
  const x1 = G.makeNode('and'); x1.id = 'a'; const x2 = G.makeNode('or'); x2.id = 'b'; const x3 = G.makeNode('assign'); x3.id = 'c'; x3.opnd = 'Q';
  n4.nodes.push(x1, x2, x3); n4.wires.push({ s:'a', d:'b', p:0 }, { s:'b', d:'a', p:0 }, { s:'b', d:'c', p:0 });
  ok(G.check(g4).items.some(x => /Zyklus/.test(x.msg)), 'check', 'Zyklus erkannt');
  const g5 = G.fromText('NETWORK x\nA AND B => Q;'); g5.networks[0].wires = g5.networks[0].wires.filter(w => !G.SINKS.has(g5.networks[0].nodes.find(n => n.id === w.d).t));
  ok(G.check(g5).items.some(x => /nicht verbunden/.test(x.msg)), 'check', 'Ausgang ohne Ziel');
  // leere Box → Typ eintippen
  ok(G.typeFromWord('sr').t === 'sr' && G.typeFromWord('>=1').t === 'or' && G.typeFromWord('CMP==').o.cmp === '==' && G.typeFromWord('add').o.calc === 'ADD', 'typ', 'typeFromWord');
  ok(G.typeSuggest('S').some(x => x.word === 'SR'), 'typ', 'Vorschläge');
  // Zwei Timer an einer &-Box: nicht darstellbar → Meldung
  const g6 = G.fromText('NETWORK x\nA AND TON(T1, T#1S) => Q;\n\nNETWORK y\nB AND TON(T2, T#1S) => Q2;');
  const nn = g6.networks; const tA = nn[1].nodes.find(n => n.t === 'ton'); const and2 = G.makeNode('and'); and2.id = 'zz';
  nn[0].nodes.push(...nn[1].nodes); nn[0].wires.push(...nn[1].wires); nn.pop();
  const sinkQ = nn[0].nodes.find(n => n.opnd === 'Q'), t1 = nn[0].nodes.find(n => n.t === 'ton' && n !== tA);
  nn[0].wires = nn[0].wires.filter(w => w.d !== sinkQ.id); nn[0].nodes.push(and2);
  nn[0].wires.push({ s: t1.id, d:'zz', p:0 }, { s: tA.id, d:'zz', p:1 }, { s:'zz', d: sinkQ.id, p:0 });
  ok(!G.check(g6).items.some(x => /Zwei Zeit/.test(x.msg)) && G.check(g6).ok, 'check', 'zwei Timer an einer &-Box sind erlaubt (V4): ' + JSON.stringify(G.check(g6).items));
  const t6 = G.toText(g6, { layout:false });
  ok(/B AND TON\(T2, T#1S\) => \$w1;\nA AND TON\(T1, T#1S\) AND \$w1 => Q;\n\$w1 => Q2;/.test(t6), 'zwei Timer', 'zweite Box über Draht (sie speist auch Q2): ' + t6);
  { const TT = { lang:'kop', initialVars:{ A:false, B:false, Q:false, Q2:false } };
    const r = SE.runTimedTests(E.compileSCL(t6, TT), TT.initialVars, [{ setup:{}, steps: [[0.1, { A:true, B:true }, { Q:false }], [1.0, {}, { Q:true }], [0.1, { B:false }, { Q:false }], [0.1, { B:true }, { Q:false }], [1.0, { A:true }, { Q:true }]].map(x => ({ dt:x[0], inputs:x[1], expect:x[2] })) }]);
    ok(r.ok, 'zwei Timer', 'Ablauf zwei Timer: ' + t6); }
}

/* ---------- Zufallsgraphen: Graph-Semantik (rein funktional) = Engine-Semantik des erzeugten Texts ---------- */
{
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const V = ['A', 'B', 'C', 'D'], T = { lang:'kop', initialVars:{ A:false, B:false, C:false, D:false, Q:false } };
  let bad = 0;
  for(let k = 0; k < 300; k++){
    const g = { seq: 0, networks: [G.emptyNet('r')] }, net = g.networks[0];
    const mk = t => { const n = G.makeNode(t, { inputs: 2 + Math.floor(rnd() * 2) }); n.id = 'n' + (++g.seq); net.nodes.push(n); return n; };
    const build = d => {
      const n = mk(['and', 'or', 'xor'][Math.floor(rnd() * 3)]);
      n.ins.forEach((p, i) => { p.neg = rnd() < 0.35; if(d < 3 && rnd() < 0.4){ const c = build(d + 1); p.op = null; net.wires.push({ s: c.id, d: n.id, p: i }); } else p.op = V[Math.floor(rnd() * 4)]; });
      return n;
    };
    const root = build(0), q = mk('assign'); q.opnd = 'Q'; q.ins[0].op = null; q.ins[0].neg = rnd() < 0.3; net.wires.push({ s: root.id, d: q.id, p: 0 });
    const txt = G.toText(g, { layout:false });
    let prog; try{ prog = E.compileSCL(txt, T); }catch(e){ bad++; if(bad < 4) fail('zufall', 'übersetzt nicht: ' + e.message + '\n' + txt); continue; }
    for(let m = 0; m < 16; m++){
      const env = {}; V.forEach((v, i) => { env[v] = !!(m & (1 << i)); });
      const want = G.evalNet(net, env).pins[q.id + ':0'];
      const got = SE.createRuntime(prog, T.initialVars, {}).scan(0.1, env).Q;
      if(want !== got){ bad++; if(bad < 4) fail('zufall', 'Semantik ' + JSON.stringify(env) + ' erwartet ' + want + ', Engine ' + got + '\n' + txt); break; }
    }
  }
  ok(bad === 0, 'zufall', bad + ' von 300 Zufallsgraphen weichen ab');
  // Zeitbox an zweitem Eingang einer &-Box: Box kommt nach vorne (Kontaktplan-Semantik)
  const g = G.fromText('NETWORK x\nB AND TON(T1, T#1S) AND A => Q;'), net = g.networks[0];
  const and = net.nodes.find(n => n.t === 'and'); const w = net.wires.find(x => x.d === and.id); w.p = 1; and.ins[1].op = null; and.ins[0].op = 'A';
  ok(/^B AND TON\(T1, T#1S\) AND A => Q;$/m.test(G.toText(g, { layout:false })), 'zeitbox', G.toText(g, { layout:false }));
  // negierter Timer-Ausgang → Meldung
  const q = net.nodes.find(n => n.t === 'assign'); net.wires = net.wires.filter(x => x.d !== q.id); net.nodes = net.nodes.filter(n => n !== and);
  net.wires = net.wires.filter(x => x.d !== and.id || true).filter(x => x.s !== and.id && x.d !== and.id);
  const ton = net.nodes.find(n => n.t === 'ton'); net.wires.push({ s: ton.id, d: q.id, p: 0 }); q.ins[0].op = null; q.ins[0].neg = true; q.ncoil = false;
  ok(/NOT/.test(G.toText(g, { layout:false })), 'zeitbox neg', 'negierte Zuweisung hinter TON: ' + G.toText(g, { layout:false }));
  const set = G.makeNode('set'); set.id = 'sx'; set.opnd = 'Q'; set.ins[0].op = null; set.ins[0].neg = true; set.y = 300; net.nodes.push(set); net.wires.push({ s: ton.id, d:'sx', p:0 });
  ok(!G.check(g).items.some(x => /Negation hinter/.test(x.msg)), 'zeitbox neg', 'Negation hinter TON am S-Eingang ist erlaubt (V4)');
  const tz = G.toText(g, { layout:false });
  ok(/\$w1/.test(tz) && (tz.match(/TON\(T1/g) || []).length === 1 && /NOT \$w1 => S Q;|NOT \$w1 => NOT Q|=> S Q/.test(tz), 'zeitbox neg', 'TON einmal, Abzweig über Draht: ' + tz);
}

/* ---------- V4: neue Textformen (mehrere Ketten, Drähte, Werteingänge, Negation hinter Boxen) ---------- */
{
  const T = { lang:'kop', initialVars:{ A:false, B:false, C:false, D:false, Q:false, Q2:false, Q3:false, M:false, Rst:false, Z:0 } };
  const steps = (txt, st) => { let p; try{ p = E.compileSCL(txt, T); }catch(e){ return 'übersetzt nicht: ' + e.message; }
    const r = SE.runTimedTests(p, T.initialVars, [{ setup:{}, steps: st.map(x => ({ dt:x[0], inputs:x[1], expect:x[2] })) }]);
    if(r.ok) return ''; const s = r.report[0].steps; return 'Schritt ' + s.length + ': ' + JSON.stringify(s[s.length - 1].checks.filter(c => !c.pass)); };
  const stable = (txt, name) => { const t2 = G.toText(G.fromText(txt)); ok(t2 === txt, name, 'nicht stabil:\n' + txt + '\n---\n' + t2); const t3 = G.toText(G.fromText(txt, { layout:'auto' }), { layout:false }); ok(t3 === txt.replace(/\/\/ @fup[^\n]*\n/g, ''), name, 'Auto-Layout ändert den Text:\n' + t3); };
  const mk = (g, net, t, o) => { const n = G.makeNode(t, o); n.id = 'n' + (++g.seq); net.nodes.push(n); return n; };
  const wire = (net, s, d, p) => { d.ins[p].op = null; net.wires.push({ s: s.id, d: d.id, p }); };
  // a) Abzweig: &-Box speist eine >=1-Box und eine X-Box → einmal berechnen (Draht), nicht verdoppeln
  { const g = { seq: 0, networks: [G.emptyNet('Abzweig')] }, net = g.networks[0];
    const a = mk(g, net, 'and'); a.ins[0].op = 'A'; a.ins[1].op = 'B';
    const o = mk(g, net, 'or'); wire(net, a, o, 0); o.ins[1].op = 'C';
    const x = mk(g, net, 'xor'); wire(net, a, x, 0); x.ins[1].op = 'D'; x.y = 120;
    const q = mk(g, net, 'assign'); q.opnd = 'Q'; wire(net, o, q, 0);
    const q2 = mk(g, net, 'assign'); q2.opnd = 'Q2'; wire(net, x, q2, 0); q2.y = 120;
    const ch = G.check(g, {}); ok(ch.ok && !ch.items.some(i => /verdoppelt/.test(i.msg)), 'v4 abzweig', 'keine Meldung: ' + JSON.stringify(ch.items));
    const t = G.toText(g, { layout:false });
    ok(t === 'NETWORK Abzweig\nA AND B => $w1;\n$w1 OR C => Q;\n$w1 XOR D => Q2;\n', 'v4 abzweig', t);
    ok(!steps(t, [[0.1, { A:true, B:true }, { Q:true, Q2:true }], [0.1, { D:true }, { Q:true, Q2:false }], [0.1, { B:false }, { Q:false, Q2:true }]]), 'v4 abzweig', steps(t, []));
    stable(G.toText(g), 'v4 abzweig stabil');
    const g2 = G.fromText(G.toText(g)); ok(g2.networks[0].nodes.length === 5 && g2.networks[0].wires.length === 4, 'v4 abzweig', 'Graph nach dem Neuladen: ' + g2.networks[0].nodes.length + ' Boxen, ' + g2.networks[0].wires.length + ' Drähte'); }
  // b) Verbindung an R1 (SR), R (CTU) negiert, PT
  { const g = { seq: 0, networks: [G.emptyNet('Werte')] }, net = g.networks[0];
    const o = mk(g, net, 'or'); o.ins[0].op = 'A'; o.ins[1].op = 'B';
    const sr = mk(g, net, 'sr'); sr.opnd = 'M'; sr.ins[0].op = 'C'; wire(net, o, sr, 1);
    const ct = mk(g, net, 'ctu'); ct.inst = 'Z1'; ct.ins[0].op = 'D'; ct.ins[2].op = '2'; ct.y = 150;
    const an = mk(g, net, 'and'); an.ins[0].op = 'Rst'; an.ins[1].op = 'A'; an.ins[1].neg = true; an.y = 150; wire(net, an, ct, 1);
    const q = mk(g, net, 'assign'); q.opnd = 'Q'; q.y = 150; wire(net, ct, q, 0);
    ok(G.check(g, {}).ok, 'v4 werte', 'check: ' + JSON.stringify(G.check(g, {}).items));
    const t = G.toText(g, { layout:false });
    ok(/C => SR\(M, \(A OR B\)\);/.test(t) && /CTU\(Z1, PV:=2, R:=\(Rst AND NOT A\)\)/.test(t), 'v4 werte', t);
    ok(!steps(t, [[0.1, { C:true }, { M:true }], [0.1, { C:false }, { M:true }], [0.1, { B:true }, { M:false }], [0.1, { B:false, D:true }, { Q:false }], [0.1, { D:false }, {}], [0.1, { D:true }, { Q:true }], [0.1, { Rst:true, A:true }, { Q:true }], [0.1, { A:false }, { Q:false }]]), 'v4 werte', steps(t, []) + '\n' + t);
    stable(G.toText(g), 'v4 werte stabil');
    sr.ins[1].neg = true; const tn = G.toText(g, { layout:false }); ok(/SR\(M, \(NOT A AND NOT B\)\)/.test(tn), 'v4 werte', 'negierter R1: ' + tn);
    // Vergleicher-Eingang bleibt Operand
    const cm = mk(g, net, 'cmp'); cm.ins[1].op = '5'; wire(net, o, cm, 0); const q3 = mk(g, net, 'assign'); q3.opnd = 'Q3'; wire(net, cm, q3, 0);
    ok(G.check(g, {}).items.some(x => /nur ein Operand \(Zahl\)/.test(x.msg)), 'v4 werte', 'Vergleicher mit Draht gemeldet'); }
  // c) Negation hinter Zeit-/Flankenbox, zwei Timer an einer &-Box ohne weitere Verwendung
  { const g = { seq: 0, networks: [G.emptyNet('Neg')] }, net = g.networks[0];
    const t1 = mk(g, net, 'ton'); t1.inst = 'T1'; t1.ins[0].op = 'A'; t1.ins[1].op = 'T#1S';
    const t2 = mk(g, net, 'ton'); t2.inst = 'T2'; t2.ins[0].op = 'B'; t2.ins[1].op = 'T#2S';
    const a = mk(g, net, 'and'); wire(net, t1, a, 0); wire(net, t2, a, 1); a.ins[1].neg = true;
    const q = mk(g, net, 'assign'); q.opnd = 'Q'; wire(net, a, q, 0);
    const e = mk(g, net, 'edgeP'); e.opnd = 'C'; const q2 = mk(g, net, 'assign'); q2.opnd = 'Q2'; q2.y = 200; wire(net, e, q2, 0); q2.ins[0].neg = true; q2.ncoil = false;
    const ch = G.check(g, {}); ok(ch.ok, 'v4 neg', JSON.stringify(ch.items));
    const t = G.toText(g, { layout:false });
    ok(/A AND TON\(T1, T#1S\) AND NOT TON\(T2, T#2S, IN:=B\) => Q;/.test(t), 'v4 neg', t);
    ok(!steps(t, [[0.1, { A:true }, { Q:false, Q2:true }], [1.0, {}, { Q:true }], [0.1, { B:true }, { Q:true }], [2.0, {}, { Q:false }], [0.1, { C:true }, { Q2:false }], [0.1, {}, { Q2:true }]]), 'v4 neg', steps(t, []) + '\n' + t);
    stable(G.toText(g), 'v4 neg stabil'); }
  // d) mehrere Ketten in einem Netzwerk, alte Texte mit "// @fup {"k":1}" laden weiter
  { const old = 'NETWORK Video\n// @fup {"p":[[24,8],[136,8],[264,8]]}\nNOT A AND B AND C OR D => Q;\n\nNETWORK Video (2)\n// @fup {"k":1,"p":[[184,120]]}\nA => SR(M, Rst);\n';
    const g = G.fromText(old); ok(g.networks.length === 1 && g.networks[0].nodes.length === 4, 'v4 ketten', 'alter Text mit k:1 → ein Netzwerk');
    const t = G.toText(g); ok(!/k":1/.test(t) && (t.match(/NETWORK/g) || []).length === 1 && /\nA => SR\(M, Rst\);\n$/.test(t), 'v4 ketten', t);
    const g2 = G.fromText(t); ok(JSON.stringify(g2.networks[0].nodes.map(n => [n.x, n.y])) === JSON.stringify(g.networks[0].nodes.map(n => [n.x, n.y])), 'v4 ketten', 'Positionen bleiben');
    stable(t, 'v4 ketten stabil');
    const auto = G.fromText('NETWORK x\nA AND B => Q;\nC => SR(M, Rst);\n=> MOVE(5, Z);');
    const ys = auto.networks[0].nodes.filter(n => G.SINKS.has(n.t)).map(n => n.y); ok(ys[0] < ys[1] && ys[1] < ys[2], 'v4 ketten', 'Auto-Layout: Ketten untereinander ' + ys); }
  // e) Text mit Drähten von Hand → Graph mit Abzweig
  { const g = G.fromText('NETWORK x\nA AND B => $UND;\n$UND AND C => Q;\nNOT $UND => Q2;\nTON(T1, T#1S, IN:=$UND) => Q3;'), net = g.networks[0];
    const and = net.nodes.find(n => n.t === 'and' && n.ins[0].op === 'A');
    ok(net.wires.filter(w => w.s === and.id).length === 3, 'v4 draht', 'Abzweig mit drei Zielen');
    ok(net.nodes.find(n => n.opnd === 'Q2').ins[0].neg, 'v4 draht', 'NOT $UND = negierter Eingang');
    const t = G.toText(g, { layout:false }); ok(/A AND B => \$w1;/.test(t) && !steps(t, [[0.1, { A:true, B:true }, { Q:false, Q2:false, Q3:false }], [1.0, {}, { Q3:true }], [0.1, { C:true }, { Q:true }]]), 'v4 draht', t + steps(t, []));
    let threw = ''; try{ G.fromText('NETWORK x\nP(A AND B) => Q;'); }catch(e){ threw = e.message; } ok(/Textansicht/.test(threw), 'v4 draht', 'P(Verknüpfung) → Textansicht: ' + threw);
    threw = ''; try{ G.fromText('NETWORK x\n$x => Q;'); }catch(e){ threw = e.message; } ok(/bevor er belegt/.test(threw), 'v4 draht', 'Draht vor dem Belegen: ' + threw); }
  // f) Zufallsgraphen mit Abzweigen und zwei Zuweisungen: Graph-Semantik = Engine-Semantik, Logik nie verdoppelt
  { let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const V = ['A', 'B', 'C', 'D']; let bad = 0, dup = 0;
    for(let k = 0; k < 300; k++){
      const g = { seq: 0, networks: [G.emptyNet('r')] }, net = g.networks[0], made = [];
      const build = d => {
        if(made.length && rnd() < 0.25) return made[Math.floor(rnd() * made.length)];   // Abzweig: vorhandene Box nochmals verwenden
        const n = mk(g, net, ['and', 'or', 'xor'][Math.floor(rnd() * 3)], { inputs: 2 + Math.floor(rnd() * 2) });
        n.ins.forEach((p, i) => { p.neg = rnd() < 0.35; if(d < 3 && rnd() < 0.45){ const c = build(d + 1); if(c === n){ p.op = V[0]; return; } wire(net, c, n, i); } else p.op = V[Math.floor(rnd() * 4)]; });
        made.push(n); return n;
      };
      const r1 = build(0), r2 = build(0);
      const q = mk(g, net, 'assign'); q.opnd = 'Q'; wire(net, r1, q, 0); q.ins[0].neg = rnd() < 0.3;
      const q2 = mk(g, net, 'assign'); q2.opnd = 'Q2'; q2.y = 300; wire(net, r2, q2, 0);
      const txt = G.toText(g, { layout:false });
      // stabil nach einer Rundreise (verschachtelte X-Boxen werden beim Einlesen zu einer X-Box zusammengefasst)
      const t1 = G.toText(G.fromText(txt), { layout:false });
      if(G.toText(G.fromText(t1), { layout:false }) !== t1){ bad++; if(bad < 4) fail('v4 zufall', 'nicht stabil:\n' + t1); continue; }
      const nOps = (txt.match(/\b[ABCD]\b/g) || []).length, nIns = net.nodes.reduce((a, n) => a + n.ins.filter((p, i) => !net.wires.some(w => w.d === n.id && w.p === i) && /^[ABCD]$/.test(p.op || '')).length, 0);
      if(nOps !== nIns){ dup++; if(dup < 3) fail('v4 zufall', 'Operanden ' + nOps + ' statt ' + nIns + ' (verdoppelt?):\n' + txt); }
      let prog; try{ prog = E.compileSCL(txt, T); }catch(e){ bad++; if(bad < 4) fail('v4 zufall', 'übersetzt nicht: ' + e.message + '\n' + txt); continue; }
      for(let m = 0; m < 16; m++){
        const env = {}; V.forEach((v, i) => { env[v] = !!(m & (1 << i)); });
        const ev = G.evalNet(net, env), got = SE.createRuntime(prog, T.initialVars, {}).scan(0.1, env);
        if(ev.pins[q.id + ':0'] !== got.Q || ev.pins[q2.id + ':0'] !== got.Q2){ bad++; if(bad < 4) fail('v4 zufall', 'Semantik ' + JSON.stringify(env) + '\n' + txt); break; }
      }
    }
    ok(bad === 0 && dup === 0, 'v4 zufall', bad + ' von 300 Zufallsgraphen mit Abzweig weichen ab, ' + dup + ' verdoppelt'); }
  // g) Flankenanzeige: Instanzname passt zur Übersetzung (eine NETWORK-Zeile je Netzwerk, Ketten zählen mit)
  { const g = G.fromText('NETWORK a\nA => Q;\nP(B) => Q2;\n\nNETWORK b\nN(C) => Q3;'), em = G.edgeMap(g);
    const tr = KOP.toSCL(G.toText(g)).scl, names = Object.values(em);
    ok(names.length === 2 && names.every(nm => tr.includes(nm + '(CLK')), 'v4 flanke', JSON.stringify(em) + '\n' + tr); }
}

/* ---------- Bericht ---------- */
console.log('\nFUP-Werkbank F0 – Rundreise Text → Graph → Text');
Object.keys(stat).forEach(k => console.log('  ' + k.padEnd(24) + stat[k].ok + '/' + stat[k].n));
const okN = Object.values(stat).reduce((a, s) => a + s.ok, 0);
console.log('  gesamt'.padEnd(26) + okN + '/' + total + ' (' + (100 * okN / total).toFixed(1) + ' %) semantisch gleich');
console.log('  Text unverändert (ohne Layout)  ' + sameText + '/' + (total - Object.keys(stat).filter(k => /^profi/.test(k)).reduce((a, k) => a + stat[k].n, 0)) + ' (Grundstufe)');
console.log('  Einzeltests                     ' + unitTests);
console.log(fails ? '\n' + fails + ' FEHLER' : '\nOK — Rundreise vollständig');
process.exit(fails ? 1 : 0);
