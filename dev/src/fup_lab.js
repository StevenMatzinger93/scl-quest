/* ===== FUP-Labor: Test-Schleuse für die FUP-Werkbank (nicht das Spiel) =====
   Neuer Editor + PLC-Variablen des Stellwerks + „Übersetzen“ + Textansicht + Simulation + 10 echte Aufgaben mit „Prüfen“.
   Daten: window.FUP_LAB = { stage, tasks:[…], tags } (vom Build eingebettet). */
(function(){
'use strict';
const LAB = window.FUP_LAB, SE = window.SCLEngine, K = window.KOP, E = K.wrapEngine(SE);
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const tags = LAB.tags || {};
window.SPSQ_REPORT_CONTEXT = () => ({ quest:'fup', context:'FUP-Labor ' + LAB.stage + (cur ? ' · ' + cur.id : '') });

// freies Netzwerk: alle PLC-Variablen
const FREE = { id:'frei', title:'Freies Netzwerk', briefing:'Zeichne, was du willst – alle PLC-Variablen des Stellwerks stehen zur Verfügung. „Übersetzen“ zeigt das Textformat, die Simulation läuft mit allen Eingängen.',
  initialVars: Object.fromEntries(Object.keys(tags).map(k => [k, /^bool$/i.test(tags[k].type) ? false : 0])), starterCode:'NETWORK Netzwerk 1\n', free:true };
const TASKS = [FREE].concat(LAB.tasks);
let cur = null, sim = null;

const ed = window.FUPWorkbench.create($('labEditor'), { tags, onChange: txt => { showText(txt); stopSim(); if(cur && cur.free) renderSim(); } });
window.labEditor = ed;

function showText(txt){ $('labText').textContent = txt == null ? ed.getValue() : txt; }
function ioOf(t){
  if(t.free){
    // freies Netzwerk: nur die Variablen, die im Plan vorkommen (geschrieben = Ausgang, sonst Eingang)
    const g = ed.graph(), used = new Set(), written = new Set();
    const nm = v => { const k = Object.keys(tags).find(x => x.toLowerCase() === String(v || '').toLowerCase()); return k; };
    g.networks.forEach(n => n.nodes.forEach(x => {
      x.ins.forEach(p => { const k = nm(p.op); if(k) used.add(k); });
      x.outs.forEach(p => { const k = nm(p.op); if(k) written.add(k); });
      const k = nm(x.opnd); if(k){ if(/^edge/.test(x.t)) used.add(k); else written.add(k); }
    }));
    written.forEach(k => used.delete(k));
    return { ins: [...used], outs: [...written] };
  }
  const ins = new Set(), outs = new Set();
  if(t.timedTestCases) t.timedTestCases.forEach(c => { Object.keys(c.setup || {}).forEach(k => ins.add(k)); c.steps.forEach(s => { Object.keys(s.inputs || {}).forEach(k => ins.add(k)); Object.keys(s.expect || {}).forEach(k => outs.add(k)); }); });
  else (t.testCases || []).forEach(c => { Object.keys(c.setup || {}).forEach(k => ins.add(k)); Object.keys(c.expect || {}).forEach(k => outs.add(k)); });
  outs.forEach(k => ins.delete(k));
  return { ins: [...ins], outs: [...outs] };
}
function pick(id){
  stopSim();
  cur = TASKS.find(t => t.id === id) || FREE;
  $('labTitle').textContent = cur.title + (cur.id === 'frei' ? '' : ' (' + cur.id + ')');
  $('labBrief').innerHTML = cur.briefing || '';
  $('labResult').innerHTML = '';
  ed.setValue(cur.starterCode || 'NETWORK Netzwerk 1\n');
  showText();
  renderTags();
  renderSim();
  $('labRef').hidden = !!cur.free;
}
function renderTags(){
  const q = ($('labTagFilter').value || '').trim().toLowerCase();
  const used = new Set(Object.keys(cur.initialVars || {}).map(k => k.toLowerCase()));
  const rows = Object.keys(tags).map(k => Object.assign({ name: k }, tags[k]))
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.addr.toLowerCase().includes(q) || r.comment.toLowerCase().includes(q))
    .sort((a, b) => (used.has(b.name.toLowerCase()) - used.has(a.name.toLowerCase())) || a.name.localeCompare(b.name));
  $('labTags').innerHTML = rows.map(r => '<tr data-var="' + esc(r.name) + '" class="' + (used.has(r.name.toLowerCase()) ? 'lab-used' : '') + '" tabindex="0" title="Klick: in den gewählten Eingang einsetzen · Ziehen: auf einen Eingang"><td>' + esc(r.name) + '</td><td class="lab-addr">' + esc(r.addr) + '</td><td>' + esc(r.type) + '</td><td class="lab-com">' + esc(r.comment) + '</td></tr>').join('');
}
$('labTagFilter').addEventListener('input', renderTags);
$('labTags').addEventListener('click', e => { const tr = e.target.closest('[data-var]'); if(tr) ed.insertAtCursor(tr.dataset.var); });
$('labTags').addEventListener('keydown', e => { const tr = e.target.closest('[data-var]'); if(tr && e.key === 'Enter'){ e.preventDefault(); ed.insertAtCursor(tr.dataset.var); } });
if(ed.bindVarDrag) ed.bindVarDrag($('labTags'));

function compile(){
  const code = ed.getValue();
  const t = cur.free ? { lang:'kop', initialVars: cur.initialVars } : cur;
  return { code, prog: E.compileSCL(code, t), t };
}
function errBox(e){
  if(e && e.line) ed.setErrorMark(e.line, 1, e.message);
  return '<div class="lab-err">✗ ' + esc(e.message || String(e)) + '</div>';
}
function translate(){
  showText();
  const ch = ed.check();
  let h = ch.items.length ? '<ul class="lab-list">' + ch.items.map(x => '<li class="' + (x.level === 'error' ? 'lab-e' : 'lab-w') + '">Netzwerk ' + (x.net + 1) + ': ' + esc(x.msg) + '</li>').join('') + '</ul>' : '';
  try{ compile(); h = '<div class="lab-ok">✓ Übersetzt – das Textformat ist gültig.</div>' + h; }
  catch(e){ h = errBox(e) + h; }
  $('labResult').innerHTML = h;
}
function check(){
  stopSim();
  if(cur.free){ translate(); return; }
  let r;
  try{
    const c = compile();
    const res = cur.timedTestCases ? SE.runTimedTests(c.prog, cur.initialVars, cur.timedTestCases) : SE.runSinglePassTests(c.prog, cur.initialVars, cur.testCases);
    const used = E.constructsUsed(c.prog), miss = (cur.mustUse || []).filter(m => !used.has(m));
    r = { res, miss };
  }catch(e){ $('labResult').innerHTML = errBox(e); return; }
  const n = r.res.report.length;
  if(r.res.ok && !r.miss.length){ $('labResult').innerHTML = '<div class="lab-ok" id="labPass">✓ Geprüft: alle ' + n + ' Tests bestanden.</div>'; return; }
  let h = '';
  if(!r.res.ok){
    const f = r.res.failedCase, idx = r.res.report.indexOf(f) + 1;
    const checks = f.steps ? f.steps[f.steps.length - 1].checks : f.checks;
    h += '<div class="lab-err">✗ Test ' + idx + ' von ' + n + ' nicht bestanden.</div><ul class="lab-list">' + checks.filter(c => !c.pass).map(c => '<li class="lab-e">' + esc(c.name) + ': erwartet ' + esc(String(c.expected)) + ', ist ' + esc(String(c.actual)) + '</li>').join('') + '</ul>';
  }
  if(r.miss.length) h += '<div class="lab-err">✗ Es fehlt noch: ' + esc(r.miss.join(', ')) + '</div>';
  $('labResult').innerHTML = h;
}
/* ---------- Simulation ---------- */
let simIn = {};
function renderSim(){
  const io = ioOf(cur);
  simIn = {};
  io.ins.forEach(k => { simIn[k] = typeof cur.initialVars[k] === 'number' ? cur.initialVars[k] : false; });
  $('labSimIn').innerHTML = io.ins.map(k => typeof simIn[k] === 'number'
    ? '<label class="lab-num">' + esc(k) + ' <input type="number" data-in="' + esc(k) + '" value="' + simIn[k] + '"></label>'
    : '<button type="button" class="lab-tog" data-in="' + esc(k) + '" aria-pressed="false">' + esc(k) + '</button>').join('') || '<i>keine Eingänge</i>';
  $('labSimOut').innerHTML = io.outs.map(k => '<span class="lab-lamp" data-out="' + esc(k) + '">' + esc(k) + ' <b>–</b></span>').join('') || '<i>keine Ausgänge</i>';
}
$('labSimIn').addEventListener('click', e => { const b = e.target.closest('.lab-tog'); if(!b) return; const k = b.dataset.in; simIn[k] = !simIn[k]; b.classList.toggle('on', simIn[k]); b.setAttribute('aria-pressed', String(simIn[k])); });
$('labSimIn').addEventListener('input', e => { const i = e.target.closest('[data-in]'); if(i){ const v = parseFloat(i.value); if(!isNaN(v)) simIn[i.dataset.in] = v; } });
function startSim(){
  stopSim();
  let c; try{ c = compile(); }catch(e){ $('labResult').innerHTML = errBox(e); return; }
  const rt = SE.createRuntime(c.prog, c.t.initialVars, {});
  let t = 0;
  sim = setInterval(() => {
    let env; try{ env = rt.scan(0.1, simIn); }catch(e){ stopSim(); $('labResult').innerHTML = errBox(e); return; }
    t += 0.1;
    ed.showFlow(env);
    document.querySelectorAll('#labSimOut [data-out]').forEach(s => { const v = env[s.dataset.out]; s.querySelector('b').textContent = v === true ? '1' : v === false ? '0' : String(v); s.classList.toggle('on', v === true); });
    $('labSimT').textContent = 't = ' + t.toFixed(1) + ' s';
  }, 100);
  $('labSim').textContent = '■ Stopp'; $('labSim').classList.add('on');
}
function stopSim(){ if(sim){ clearInterval(sim); sim = null; ed.clearFlow(); } $('labSim').textContent = '▶ Simulation'; $('labSim').classList.remove('on'); }
$('labSim').addEventListener('click', () => sim ? stopSim() : startSim());
$('labTranslate').addEventListener('click', translate);
$('labCheck').addEventListener('click', check);
$('labRef').addEventListener('click', () => { ed.setValue(cur.refSolution); showText(); $('labResult').innerHTML = '<div class="lab-w">Musterlösung geladen (zum Vergleich).</div>'; });
$('labReset').addEventListener('click', () => pick(cur.id));
$('labTask').innerHTML = TASKS.map(t => '<option value="' + esc(t.id) + '">' + esc(t.free ? t.title : 'Kapitel ' + t.level + ': ' + t.title) + '</option>').join('');
$('labTask').addEventListener('change', e => pick(e.target.value));
$('labStage').textContent = LAB.stage;
pick((new URLSearchParams(location.search).get('task')) || 'frei');
if(location.search.includes('task=')) $('labTask').value = cur.id;
})();
