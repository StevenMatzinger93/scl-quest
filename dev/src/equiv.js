(function(root){
"use strict";
/* ============================================================
   Funktionsvergleich (Auftrag „Funktion zählt“, V0) – SPSQEquiv
   ------------------------------------------------------------
   Erzeugt aus einer Aufgabe und ihrer Musterlösung zusätzliche Testfälle
   („Orakel“): Die Musterlösung legt fest, wie sich die Ausgänge verhalten
   sollen; geprüft wird später nur, ob eine Lösung dieselben Ausgänge liefert –
   egal mit welchen Bausteinen (eine &-Box mit 3 Eingängen oder zwei &-Boxen).

   Grundstufe (defTask/defKop/defAwl):
     autoTests(t, E) → { testCases } | { timedTestCases } | null
       E = Engine passend zur Sprache (SCLEngine, KOP.wrapEngine(…), AWL.wrapEngine(…))
   – ohne Zeitverhalten (testCases): alle Kombinationen der Bool-Eingänge,
     Zahlen-Eingänge aus Testwerten, Nachbarn und Grenzwerten der Musterlösung
   – mit Zeitverhalten (timedTestCases): feste Zufallsabläufe; verglichen wird nur
     an stabilen Prüfpunkten (ein Zyklus ohne Eingangswechsel nach jeder Änderung,
     dazu „lange warten“), damit „ein Zyklus später“ (Netzwerk-Reihenfolge) nicht zählt
   Verglichen werden nur die Ausgänge, die die Hand-Tests prüfen. Eigene Merker sind frei.
   Läuft zur Build-Zeit (build.js) und im Validator – nie im Spiel/Worker.
   ============================================================ */
const MAX_COMBOS = 512, NUM_CANDS = 8;

function hashStr(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ let a = hashStr(String(seed)); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clone = x => JSON.parse(JSON.stringify(x));
const isNum = v => typeof v === 'number' && isFinite(v);

/* ---------- Ein- und Ausgänge aus den Hand-Tests ---------- */
function ioOf(t){
  const ins = new Set(), outs = new Set();
  const seeIn = o => Object.keys(o || {}).forEach(k => ins.add(k)), seeOut = o => Object.keys(o || {}).forEach(k => outs.add(k));
  (t.testCases || []).forEach(c => { seeIn(c.setup); seeOut(c.expect); });
  (t.timedTestCases || []).forEach(c => { seeIn(c.setup); (c.steps || []).forEach(s => { seeIn(s.inputs); seeOut(s.expect); }); });
  return { ins: [...ins], outs: [...outs] };
}
const isReal = (t, k) => /^L?REAL$/i.test(String((t.varTypes || {})[k] || '')) || (isNum(t.initialVars && t.initialVars[k]) && !Number.isInteger(t.initialVars[k]));
// Zahlen aus der Musterlösung (Grenzwerte von Vergleichen, Konstanten) – ohne Zeit-Literale
function refNumbers(src){
  const s = String(src || '').replace(/T(IME)?#[0-9_.a-z]+/gi, ' ').replace(/\/\/.*$/gm, '').replace(/\(\*[\s\S]*?\*\)/g, ' ');
  const out = new Set();
  (s.match(/(^|[^A-Za-z_0-9.#])-?\d+(\.\d+)?(?![\w.#])/g) || []).forEach(m => { const v = parseFloat(m.replace(/^[^-\d]/, '')); if(isFinite(v) && Math.abs(v) < 1e6) out.add(v); });
  return [...out];
}
function timeConsts(src){
  const out = [];
  (String(src || '').match(/T(IME)?#[0-9_.a-z]+/gi) || []).forEach(m => {
    let tot = 0; const re = /([0-9][0-9_]*(?:\.[0-9]+)?)(ms|d|h|m|s)/gi; let x;
    while((x = re.exec(m.replace(/^T(IME)?#/i, '')))){ const v = parseFloat(x[1].replace(/_/g, '')), u = x[2].toLowerCase(); tot += u === 'ms' ? v / 1000 : u === 's' ? v : u === 'm' ? v * 60 : u === 'h' ? v * 3600 : v * 86400; }
    if(tot > 0) out.push(tot);
  });
  return out;
}
// Kandidatenwerte je Eingang
function candidates(t, io){
  const nums = refNumbers(t.refSolution), C = {};
  io.ins.forEach(k => {
    const iv = t.initialVars ? t.initialVars[k] : undefined;
    if(typeof iv === 'boolean' || (iv === undefined && [...(t.testCases || []), ...(t.timedTestCases || [])].some(c => typeof (c.setup || {})[k] === 'boolean'))){ C[k] = [false, true]; return; }
    if(!isNum(iv) && iv !== undefined) return;   // Felder/Strukturen: nur Hand-Testwerte
    const real = isReal(t, k), seen = new Set();
    const add = v => { if(!isNum(v)) return; v = real ? Math.round(v * 1000) / 1000 : Math.round(v); seen.add(v); };
    const vals = [];
    (t.testCases || []).forEach(c => { if(isNum((c.setup || {})[k])) vals.push(c.setup[k]); });
    (t.timedTestCases || []).forEach(c => { if(isNum((c.setup || {})[k])) vals.push(c.setup[k]); c.steps.forEach(s => { if(isNum((s.inputs || {})[k])) vals.push(s.inputs[k]); }); });
    vals.forEach(add);
    const d = real ? 0.5 : 1;
    // Grenzwerte der Musterlösung zuerst (dort entscheidet sich die Funktion), dann Nachbarn der Testwerte
    const hasNeg = vals.some(v => v < 0) || nums.some(v => v < 0);
    nums.forEach(v => { if(seen.size < NUM_CANDS + vals.length){ add(v); add(v + d); add(v - d); } });
    vals.forEach(v => { add(v + d); add(v - d); });
    add(0);
    let list = [...seen].filter(v => hasNeg || v >= 0);
    // Testwerte haben Vorrang, danach Grenzwerte; Anzahl begrenzen
    const pri = v => vals.includes(v) ? 0 : nums.some(n => Math.abs(n - v) <= d + 1e-9) ? 1 : 2;
    list.sort((a, b) => pri(a) - pri(b) || a - b);
    C[k] = list.slice(0, Math.max(NUM_CANDS, new Set(vals).size));
  });
  return C;
}
function product(keys, C, max, r){
  const sizes = keys.map(k => C[k].length), total = sizes.reduce((a, b) => a * b, 1);
  const out = [];
  if(total <= max){
    for(let i = 0; i < total; i++){ let x = i; const o = {}; keys.forEach((k, j) => { o[k] = C[k][x % sizes[j]]; x = Math.floor(x / sizes[j]); }); out.push(o); }
    return out;
  }
  const seen = new Set();
  for(let n = 0; n < max * 4 && out.length < max; n++){
    const o = {}; keys.forEach(k => { o[k] = C[k][Math.floor(r() * C[k].length)]; });
    const key = JSON.stringify(o); if(!seen.has(key)){ seen.add(key); out.push(o); }
  }
  return out;
}
const pickOuts = (env, outs) => { const o = {}; outs.forEach(k => { const v = env[k]; o[k] = v && typeof v === 'object' ? clone(v) : v; }); return o; };

/* ---------- Grundstufe ---------- */
function autoTests(t, E, opts){
  opts = opts || {};
  if(t.pro || t.workshop || !t.refSolution) return null;
  const io = ioOf(t);
  if(!io.outs.length || !io.ins.length) return null;
  const prog = E.compileSCL(t.refSolution, t);
  const r = rng('equiv:' + t.id);
  const C = candidates(t, io);
  const keys = io.ins.filter(k => C[k]);
  if(!keys.length) return null;
  if(!t.timedTestCases){
    // ohne Zeitverhalten: jeder Testfall startet frisch (wie runSinglePassTests); Grundlage = erster Hand-Test (Felder/Strukturen)
    const base = clone(((t.testCases || [])[0] || {}).setup || {});
    const combos = product(keys, C, opts.maxCombos || MAX_COMBOS, r);
    const cases = [], seen = new Set((t.testCases || []).map(c => JSON.stringify(Object.assign({}, base, c.setup))));
    combos.forEach(o => {
      const setup = Object.assign({}, base, o), key = JSON.stringify(setup);
      if(seen.has(key)) return; seen.add(key);
      let env; try{ env = E.executeOnce(prog, t.initialVars, setup); }catch(e){ return; }   // Laufzeitfehler der Musterlösung = ausserhalb der Aufgabe
      cases.push({ setup, expect: pickOuts(env, io.outs), auto: true });
    });
    return cases.length ? { testCases: cases } : null;
  }
  // mit Zeitverhalten: Zufallsabläufe, Prüfpunkt nach jedem Wechsel (ein Zyklus Ruhe) und nach langem Warten
  const base = clone(t.timedTestCases[0].setup || {});
  // nur Eingänge, die sich in den Hand-Abläufen ändern (reine Startwerte bleiben fest)
  const stepKeys = new Set([].concat(...t.timedTestCases.map(c => [].concat(...c.steps.map(s => Object.keys(s.inputs || {}))))));
  const KS = keys.filter(k => stepKeys.has(k)); if(!KS.length) return null;
  const init = {}; KS.forEach(k => { init[k] = base[k] !== undefined ? base[k] : (t.initialVars || {})[k]; });
  const plans = sequences(KS, C, init, dtsFor(t.refSolution, t.timedTestCases), r, opts);
  const seqs = [];
  plans.forEach(steps => {
    let snaps; try{ snaps = E.executeTimed(prog, t.initialVars, base, steps.map(x => ({ dt: x.dt, inputs: x.inputs }))); }catch(e){ return; }
    seqs.push({ setup: base, steps: steps.map((x, i) => ({ dt: x.dt, inputs: x.inputs, expect: x.check ? pickOuts(snaps[i], io.outs) : {} })), auto: true });
  });
  return seqs.length ? { timedTestCases: seqs } : null;
}
// Zeitschritte: kurze Zyklen, Zeiten der Hand-Tests, knapp vor/nach jeder Zeitkonstante der Musterlösung
function dtsFor(src, cases){
  const T = timeConsts(src);
  const handDt = [].concat(...(cases || []).map(c => (c.steps || []).map(s => s.dt || 0))).filter(x => x > 0);
  const dts = [...new Set([0.1, 0.3].concat(handDt, T.map(x => x + 0.2), T.map(x => Math.max(0.1, x - 0.2))).map(x => Math.round(x * 1000) / 1000))].filter(x => x > 0).sort((a, b) => a - b);
  return { dts, maxT: T.length ? Math.max(...T) : 1 };
}
// Abläufe: je Wechsel ein Eingang, danach ein Ruhe-Zyklus mit Prüfpunkt; jeder dritte Wechsel zusätzlich „lange warten“
function sequences(keys, C, init, D, r, opts){
  const nSeq = opts.sequences || 6, nChg = opts.changes || 14, out = [];
  for(let s = 0; s < nSeq; s++){
    const steps = [], state = Object.assign({}, init);
    for(let c = 0; c < nChg; c++){
      const k = keys[Math.floor(r() * keys.length)], cand = C[k];
      let v = typeof state[k] === 'boolean' ? !state[k] : cand[Math.floor(r() * cand.length)];
      if(v === state[k] && cand.length > 1) v = cand[(cand.indexOf(v) + 1) % cand.length];
      state[k] = v;
      steps.push({ dt: D.dts[Math.floor(r() * D.dts.length)], inputs: { [k]: v } });
      steps.push({ dt: 0.1, inputs: {}, check: true });
      // Warten ohne Wechsel mit Prüfpunkten mitten in den Zeitkonstanten (z. B. 2,8 s bei TON 3 s)
      if(r() < 0.6) steps.push({ dt: D.dts[Math.floor(r() * D.dts.length)], inputs: {}, check: true });
      if(c % 3 === 2) steps.push({ dt: Math.round((D.maxT + 0.5) * 1000) / 1000, inputs: {}, check: true });
    }
    out.push(steps);
  }
  return out;
}

/* ---------- Profi-Stufe (defProTask) ----------
   autoTestsPro(t, PRO, compile) → { unit, tests, timed } (nur die erzeugten Fälle) | null
   PRO = SCLPro passend zur Sprache, compile(codes) = ProTask.compile(t, codes).
   unit: je getestetem Baustein (FC ohne Gedächtnis: Kombinationen, FB: Abläufe), tests/timed: über die globalen Ein-/Ausgänge.
   Die Werte der Musterlösung liefert der Messmodus der Testläufer (opts.probe). */
function valsOf(list, k){ const v = []; list.forEach(o => { if(o && Object.prototype.hasOwnProperty.call(o, k)) v.push(o[k]); }); return v; }
function candPro(keys, seen, nums){
  const C = {};
  keys.forEach(k => {
    const vals = seen(k);
    if(!vals.length) return;
    if(vals.every(v => typeof v === 'boolean')){ C[k] = [false, true]; return; }
    if(!vals.every(isNum)) return;   // Texte, Felder, Strukturen: nur Hand-Tests
    const real = vals.some(v => !Number.isInteger(v)), d = real ? 0.5 : 1, set = new Set();
    const add = v => set.add(real ? Math.round(v * 1000) / 1000 : Math.round(v));
    vals.forEach(add);
    const hasNeg = vals.some(v => v < 0) || nums.some(v => v < 0);
    nums.forEach(v => { add(v); add(v + d); add(v - d); });
    vals.forEach(v => { add(v + d); add(v - d); }); add(0);
    const pri = v => vals.includes(v) ? 0 : nums.some(n => Math.abs(n - v) <= d + 1e-9) ? 1 : 2;
    C[k] = [...set].filter(v => hasNeg || v >= 0).sort((a, b) => pri(a) - pri(b) || a - b).slice(0, Math.max(NUM_CANDS, new Set(vals).size));
  });
  return C;
}
function autoTestsPro(t, PRO, compile, opts){
  opts = opts || {};
  if(!t.pro) return null;
  const codes = {}; t.project.blocks.forEach(b => { if(b.edit) codes[b.name] = b.ref; });
  const src = t.project.blocks.map(b => b.edit ? b.ref : b.src).join('\n');
  const nums = refNumbers(src), r = rng('equiv:' + t.id);
  const prog = compile(codes);
  const out = { unit: [], tests: [], timed: [] };
  const fill = (cases, kind) => {
    // Werte der Musterlösung messen: expect = { Ausgang: null } → Istwerte
    let res; try{ res = kind === 'unit' ? PRO.runUnitTests(prog, cases, { probe: true }) : kind === 'tests' ? PRO.runProgramTests(prog, cases, { probe: true }) : PRO.runProgramTimed(prog, cases, { probe: true }); }catch(e){ return []; }
    const done = [];
    res.report.forEach((rep, i) => {
      if(rep.error) return;
      const c = clone(cases[i]);
      if(kind === 'tests'){ if(rep.checks.some(x => x.pathError)) return; c.expect = {}; rep.checks.forEach(x => { c.expect[x.name] = clone(x.actual); }); }
      else { if(rep.steps.length !== c.steps.length || rep.steps.some(s => s.checks.some(x => x.pathError))) return; c.steps.forEach((s, j) => { const e = {}; if(s.check) rep.steps[j].checks.forEach(x => { e[x.name] = clone(x.actual); }); s.expect = e; delete s.check; }); }
      c.auto = true; done.push(c);
    });
    return done;
  };
  const nul = outs => { const o = {}; outs.forEach(k => { o[k] = null; }); return o; };
  // Unit-Tests je Baustein
  const blocks = [...new Set((t.unit || []).map(u => u.block))];
  blocks.forEach(bn => {
    const cs = t.unit.filter(u => u.block === bn), u = prog.unit && prog.unit(bn);
    if(!u) return;
    const inObjs = [].concat(...cs.map(c => [c.setup].concat(c.steps.map(s => s.inputs))));
    const outs = [...new Set([].concat(...cs.map(c => [].concat(...c.steps.map(s => Object.keys(s.expect || {}))))))];
    const keys = [...new Set([].concat(...inObjs.map(o => Object.keys(o || {}))))].filter(k => !outs.includes(k));
    const C = candPro(keys, k => valsOf(inObjs, k), nums), K = keys.filter(k => C[k]);
    if(!K.length || !outs.length) return;
    const base = clone(cs[0].setup || {});
    const stepKeys = new Set([].concat(...cs.map(c => [].concat(...c.steps.map(s => Object.keys(s.inputs || {}))))));
    if(u.kind === 'FC'){
      const combos = product(K, C, opts.maxCombos || MAX_COMBOS, r);
      out.unit.push(...fill(combos.map(o => ({ block: bn, setup: base, steps: [{ dt: 0, inputs: o, expect: nul(outs), check: true }] })), 'unit'));
    } else {
      const KS = K.filter(k => stepKeys.has(k)); if(!KS.length) return;
      const init = {}; KS.forEach(k => { const v = valsOf(inObjs, k); init[k] = v.length ? v[0] : C[k][0]; });
      const plans = sequences(KS, C, init, dtsFor(src, cs), r, opts);
      out.unit.push(...fill(plans.map(steps => ({ block: bn, setup: base, steps: steps.map(s => ({ dt: s.dt, inputs: s.inputs, expect: s.check ? nul(outs) : {}, check: !!s.check })) })), 'unit'));
    }
  });
  // Programmtests ohne Zeit
  if((t.tests || []).length){
    const inObjs = t.tests.map(c => c.setup), outs = [...new Set([].concat(...t.tests.map(c => Object.keys(c.expect || {}))))];
    const keys = [...new Set([].concat(...inObjs.map(o => Object.keys(o || {}))))].filter(k => !outs.includes(k));
    const C = candPro(keys, k => valsOf(inObjs, k), nums), K = keys.filter(k => C[k]);
    if(K.length && outs.length){
      const base = clone(t.tests[0].setup || {});
      out.tests.push(...fill(product(K, C, opts.maxCombos || MAX_COMBOS, r).map(o => ({ setup: Object.assign({}, base, o), expect: nul(outs) })), 'tests'));
    }
  }
  // Programmtests mit Zeit
  if((t.timed || []).length){
    const inObjs = [].concat(...t.timed.map(c => [c.setup].concat(c.steps.map(s => s.inputs))));
    const outs = [...new Set([].concat(...t.timed.map(c => [].concat(...c.steps.map(s => Object.keys(s.expect || {}))))))];
    const keys = [...new Set([].concat(...inObjs.map(o => Object.keys(o || {}))))].filter(k => !outs.includes(k));
    const C = candPro(keys, k => valsOf(inObjs, k), nums), K = keys.filter(k => C[k]);
    if(K.length && outs.length){
      const base = clone(t.timed[0].setup || {});
      const stepKeys = new Set([].concat(...t.timed.map(c => [].concat(...c.steps.map(s => Object.keys(s.inputs || {}))))));
      const KS = K.filter(k => stepKeys.has(k));
      const init = {}; KS.forEach(k => { const v = valsOf(inObjs, k); init[k] = v.length ? v[0] : C[k][0]; });
      const plans = KS.length ? sequences(KS, C, init, dtsFor(src, t.timed), r, opts) : [];
      out.timed.push(...fill(plans.map(steps => ({ setup: base, steps: steps.map(s => ({ dt: s.dt, inputs: s.inputs, expect: s.check ? nul(outs) : {}, check: !!s.check })) })), 'timed'));
    }
  }
  return out.unit.length || out.tests.length || out.timed.length ? out : null;
}

/* ---------- Gegenbeispiel als Text ---------- */
const fmtV = v => v === true ? '1' : v === false ? '0' : Array.isArray(v) ? '[' + v.join(', ') + ']' : String(v);
function counterexample(res, t){
  const f = res && res.failedCase; if(!f) return '';
  if(f.steps){
    const st = f.steps[f.steps.length - 1], bad = (st.checks || []).filter(c => !c.pass);
    const seen = {}; f.steps.forEach(s => Object.assign(seen, s.inputs || {}));
    const inp = Object.keys(seen).map(k => k + ' = ' + fmtV(seen[k])).join(', ');
    return 'Nach ' + (Math.round(st.t * 10) / 10) + ' s' + (inp ? ' (zuletzt ' + inp + ')' : '') + ': ' + bad.map(c => c.name + ' sollte ' + fmtV(c.expected) + ' sein, ist aber ' + fmtV(c.actual)).join('; ') + '.';
  }
  const ins = Object.keys(f.setup || {}).map(k => k + ' = ' + fmtV(f.setup[k])).join(', ');
  return 'Bei ' + ins + ': ' + f.checks.filter(c => !c.pass).map(c => c.name + ' sollte ' + fmtV(c.expected) + ' sein, ist aber ' + fmtV(c.actual)).join('; ') + '.';
}
// Hand-Tests + automatisch erzeugte Tests (Reihenfolge: Hand-Tests zuerst, ihre Meldungen sind am verständlichsten)
function allCases(t){
  const a = t.autoTests || {};
  if(t.pro) return { unit: (t.unit || []).concat(a.unit || []), tests: (t.tests || []).concat(a.tests || []), timed: (t.timed || []).concat(a.timed || []) };
  return t.timedTestCases ? { timedTestCases: t.timedTestCases.concat(a.timedTestCases || []) } : { testCases: (t.testCases || []).concat(a.testCases || []) };
}

const SPSQEquiv = { autoTests, autoTestsPro, allCases, counterexample, ioOf, candidates, refNumbers, timeConsts, rng };
root.SPSQEquiv = SPSQEquiv;
if(typeof module !== 'undefined' && module.exports) module.exports = SPSQEquiv;
})(typeof window !== 'undefined' ? window : globalThis);
