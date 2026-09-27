(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Aufgabenformat, Presets, Anlagensimulation, Schrittprüfung (docs/SENSORWERKSTATT_PLAN.md Teil 6, 8.2; Paket S7)
   defWorkshopTask({ id, module, no, title, story, brief, learn, take, man, theory, hint, hint2, level:'schnell'|'werkstatt'|'profi',
     boss, final, debug, parts:['B1',…], modules:['A1',…], x2:[…], x3:n, start:'preset:m1_base' | {…Zustand}, hw:{…Patch}, tags:'werkstatt'|'leer'|[…],
     steps:[ { kind, text, …, ref } ] })
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
    initialVars: {}, varTypes: {}, fbTypes: {}, testCases: [], sceneBindings: [], starterCode: '', refLines: 0
  };
  t.program = t.steps.find(s => s.kind === 'program') || null;
  let refText = null;   // Musterlösung als Text (Karte, Vergleich) – erst bei Bedarf berechnen
  Object.defineProperty(t, 'refSolution', { enumerable: false, get(){ if(refText == null){ try { refText = describe(t, applyRef(t, newContext(t))); } catch(e){ refText = ''; } } return refText; } });
  C.tasks.push(t);
  return t;
};

/* ---------- Arbeitskontext einer Aufgabe ---------- */
function setPath(o, path, v){ const ks = path.split('.'); for(let i = 0; i < ks.length - 1; i++){ o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
function getPath(o, path){ return path.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function startTags(t){
  if(Array.isArray(t.tagsStart)) return clone(t.tagsStart);
  if(t.tagsStart === 'leer') return [];
  return clone(PLC.TAGS_WERKSTATT);
}
function newContext(t){
  const hw = PLC.newHw(); if(t.hwPatch) Object.keys(t.hwPatch).forEach(k => setPath(hw, k, clone(t.hwPatch[k])));
  const p = t.program;
  const lang = p ? (p.langs || ['scl'])[0] : 'scl';
  const tags = startTags(t).concat(p && p.tagsExtra ? clone(p.tagsExtra).filter(x => !startTags(t).some(y => y.name === x.name)) : []);
  return { state: buildState(t.start, t.reality), hw, tags, lang, source: p && p.start ? (p.start[lang] || '') : '', answers: {}, cpu: PLC.Cpu(), fb: p && p.fb ? p.fb : {} };
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
  (ops.add || []).forEach(([a, b]) => { const was = st.mainSwitch; st.mainSwitch = false; W.addWire(st, a, b, { ferrule: true }); st.mainSwitch = was; });
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

root.SensorTasks = { PRESETS, defPreset, buildState, worldFrom, newContext, runProgram, inputsFor, checkStep, checkTask, applyRef, applyStepRef, applyWireOps, programFailText, expectedMeasure, setPath, getPath, startTags, PART_H, describe };
root.defPreset = defPreset;
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorTasks;
})(typeof window !== 'undefined' ? window : globalThis);
