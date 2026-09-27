(function(){
"use strict";
/* ============================================================
   APP — Spiel-Controller SCL Quest 3 (v4)
   Ablauf: 15 Kapitel × (Theorie A → 5 Aufgaben → Theorie B → 5 Aufgaben)
   = 150 Aufgaben + 30 Theorie-Aufträge. Grundstufe: Kapitel 1–10 (Final Boss
   = Aufgabe 100), Profi-Stufe: Kapitel 11–15 mit Projekt-Editor (Final Boss 2).
   Alles läuft über die echte Engine (SCLEngine) und die Live-Anlage.
   ============================================================ */
const VERSION = '5.0.0';
/* Quest-Konfiguration: dieselbe Spielhülle für SCL Quest und KOP Quest (window.QUEST aus dem Build) */
const Q = Object.assign({ id:'scl', lang:'scl', name:'SCL Quest', key:'sclquest3_state_v4', oldKey:'sclquest3_state_v1', viewKey:'sclquest3_view', ext:'.scl',
  langLong:'Siemens SCL', langShort:'SCL', certPrefix:'SQ3', obf:'SCL-QUEST3-ARIA-2026', titleFoot:'Echter SCL-Code · echte Tests · offline spielbar',
  basicText:'die Schrittkette „Aufstand der Maschinen“ gemeistert und ARIAs Sabotage beendet hat.',
  proText:'inklusive eigener Funktionen und Funktionsbausteine, Datentypen, Datenbausteine und eines Anlagenprogramms nach Standard.' }, window.QUEST || {});
const KOPMODE = Q.lang === 'kop' || Q.lang === 'fup';   // grafische Netzwerk-Sprachen (Kontaktplan, Funktionsplan) mit gemeinsamem Modell
const FUPMODE = Q.lang === 'fup';
const AWLMODE = Q.lang === 'awl';   // Anweisungsliste: Text mit Statusspalte (VKE/AKKU), Übersetzung nach SCL
const SENSORMODE = Q.lang === 'sensor';   // Sensorwerkstatt: Werkstatt-Aufgaben (Montieren, Verdrahten, Konfigurieren, Programmieren) statt Code-Editor
const C = window.SCL_CONTENT, ENGINE = KOPMODE ? window.KOP.wrapEngine(window.SCLEngine) : AWLMODE ? window.AWL.wrapEngine(window.SCLEngine) : window.SCLEngine, SCENE = window.SceneEngine || { STAGE:null, reset(){}, stopTimeline(){}, showFault(){}, flashResult(){}, hardReset(){}, onEvent(){}, playTimeline(b, f, ms, done){ if(done) done(); } };
if(KOPMODE && window.SCLPro) window.SCLPro = window.KOP.wrapPro(window.SCLPro);   // Profi-Bausteine mit KOP-Rumpf
if(AWLMODE && window.SCLPro) window.SCLPro = window.AWL.wrapPro(window.SCLPro);   // Profi-Bausteine mit AWL-Rumpf
const MANUAL = window.MANUAL_CONTENT || [];
const CHAPTERS = C.chapters.slice().sort((a,b) => a.n - b.n);
const TASKS = C.tasks;
const THEORY = C.theory;
const TASK_BY_ID = {}; TASKS.forEach(t => { TASK_BY_ID[t.id] = t; });
const THEORY_BY_ID = {}; THEORY.forEach(t => { THEORY_BY_ID[t.id] = t; });

/* ---------- Ablauf-Sequenz ---------- */
const SEQ = [];
const TASK_NO = {};
let taskCounter = 0;
CHAPTERS.forEach(ch => {
  const tasks = TASKS.filter(t => t.level === ch.n);
  const thA = THEORY.find(t => t.ch === ch.n && t.pos === 'start');
  const thB = THEORY.find(t => t.ch === ch.n && t.pos === 'mid');
  if(thA) SEQ.push({ type:'theory', id:thA.id, ch:ch.n });
  tasks.forEach((t, i) => {
    if(i === 5 && thB) SEQ.push({ type:'theory', id:thB.id, ch:ch.n });
    TASK_NO[t.id] = ++taskCounter;
    SEQ.push({ type:'task', id:t.id, ch:ch.n });
  });
});
const TOTAL_TASKS = taskCounter, TOTAL_THEORY = SEQ.filter(s => s.type === 'theory').length;

const BADGES = {
  first_try:   { icon:'🏆', title:'Volltreffer',   desc:'Eine Aufgabe im allerersten Versuch gelöst.' },
  sherlock:    { icon:'🕵️', title:'Sherlock',      desc:'Einen Debugging-Fehler in unter 60 Sekunden gefunden.' },
  clean_coder: { icon:'♻️', title:'Clean Coder',   desc:'Eine Lösung, so knapp wie die Referenz.' },
  buecherwurm: { icon:'📖', title:'Bücherwurm',    desc:'Vor dem ersten Versuch im Handbuch nachgeschlagen und gelöst.' },
  theorie_ass: { icon:'🎓', title:'Theorie-Ass',   desc:'Fünf Theorie-Checks fehlerfrei im ersten Anlauf.' },
  serie:       { icon:'⚡', title:'Serie',          desc:'Zehn Aufgaben in Folge im ersten Versuch.' },
  perfekt:     { icon:'💎', title:'Perfektes Kapitel', desc:'Alle Aufgaben eines Kapitels mit drei Sternen.' },
  befreier:    { icon:'🤖', title:(window.QUEST && window.QUEST.finalBadge) || 'Befreier der Zelle', desc:'ARIA im Final Boss besiegt.' },
  architekt:   { icon:'🏭', title:'Anlagen-Architekt', desc:'Final Boss 2: die ganze Anlage nach Standard aufgebaut.' }
};
const KOP_NAMES = Q.lang === 'fup' ? { NO:'einen Eingang', NC:'einen negierten Eingang', SERIES:'eine UND-Box (&)', PARALLEL:'eine ODER-Box (>=1)', XOR:'eine XOR-Box (X)', EDGE_P:'eine P-Flanke', EDGE_N:'eine N-Flanke', CMP:'einen Vergleicher',
  COIL:'eine Zuweisung (=)', SET:'eine Setzbox (S)', RESET:'eine Rücksetzbox (R)', NCOIL:'eine negierte Zuweisung', SR:'ein SR-Flipflop', RS:'ein RS-Flipflop', MULTI_OUT:'mehrere Zuweisungen', NETWORKS:'mehrere Netzwerke', CALL:'eine Aufruf-Box',
  TON:'TON', TOF:'TOF', TP:'TP', CTU:'Zähler CTU', CTD:'Zähler CTD', MOVE:'MOVE', ADD:'ADD', SUB:'SUB', MUL:'MUL', DIV:'DIV', INC:'INC', DEC:'DEC' }
 : { NO:'Schliesser', NC:'Öffner', SERIES:'Reihenschaltung', PARALLEL:'Parallelzweig', XOR:'XOR', EDGE_P:'P-Flanke', EDGE_N:'N-Flanke', CMP:'Vergleicher',
  COIL:'Spule', SET:'Setzspule (S)', RESET:'Rücksetzspule (R)', NCOIL:'negierte Spule', SR:'SR', RS:'RS', MULTI_OUT:'mehrere Spulen', NETWORKS:'mehrere Netzwerke', CALL:'eine Aufruf-Box',
  TON:'TON', TOF:'TOF', TP:'TP', CTU:'Zähler CTU', CTD:'Zähler CTD', MOVE:'MOVE', ADD:'ADD', SUB:'SUB', MUL:'MUL', DIV:'DIV', INC:'INC', DEC:'DEC' };
const CONSTRUCT_NAMES = { FOR:'eine FOR-Schleife', WHILE:'eine WHILE-Schleife', REPEAT:'eine REPEAT-Schleife', CASE:'CASE', IF:'IF', ELSIF:'ELSIF',
  EXIT:'EXIT', CONTINUE:'CONTINUE', BY:'FOR … BY (Schrittweite)', RANGE:'einen CASE-Bereich (a..b)', ARRAY:'einen Array-Zugriff',
  LIMIT:'die Funktion LIMIT', TON:'einen TON-Timer', TOF:'einen TOF-Timer', TP:'einen TP-Timer', R_TRIG:'R_TRIG', F_TRIG:'F_TRIG', CTU:'den Zähler CTU', CTD:'den Zähler CTD' };
const AWL_NAMES = { U:'U (UND)', UN:'UN (UND NICHT)', O:'O (ODER)', ON:'ON (ODER NICHT)', X:'X (Exklusiv-ODER)', XN:'XN', O_VOR:'O ohne Operand (UND vor ODER)', KLAMMER:'eine Klammer U( … )',
  NOT:'NOT', SET:'SET', CLR:'CLR', ASSIGN:'eine Zuweisung (=)', S:'S (Setzen)', R:'R (Rücksetzen)', FP:'FP (positive Flanke)', FN:'FN (negative Flanke)',
  SE:'SE (Einschaltverzögerung)', SA:'SA (Ausschaltverzögerung)', SI:'SI (Impuls)', SV:'SV (verlängerter Impuls)', TIMER:'eine Zeit', TIMER_BIT:'eine Zeitabfrage (U T…)', S5T:'eine S5-Zeit (S5T#…)',
  ZV:'ZV (vorwärts zählen)', ZR:'ZR (rückwärts zählen)', ZS:'S Z (Zähler setzen)', ZRESET:'R Z (Zähler rücksetzen)', COUNTER:'einen Zähler', COUNTER_LOAD:'L Z (Zählwert laden)', COUNTER_BIT:'eine Zählerabfrage (U Z…)',
  L:'L (Laden)', T:'T (Transferieren)', TAK:'TAK', ARITH:'eine Rechenoperation', '+I':'+I', '-I':'-I', '*I':'*I', '/I':'/I', '+R':'+R', '-R':'-R', '*R':'*R', '/R':'/R', '+D':'+D', '-D':'-D', '*D':'*D', '/D':'/D', MOD:'MOD',
  CMP:'einen Vergleich', CMP_I:'einen INT-Vergleich (…I)', CMP_R:'einen REAL-Vergleich (…R)', CMP_D:'einen DINT-Vergleich (…D)', ITD:'ITD', DTR:'DTR', ITR:'ITR', RND:'RND', TRUNC:'TRUNC', CONVERT:'eine Umwandlung', NEG:'NEGI/NEGR', INC:'INC', DEC:'DEC',
  SPA:'SPA (absoluter Sprung)', SPB:'SPB (Sprung bei VKE 1)', SPBN:'SPBN (Sprung bei VKE 0)', LOOP:'LOOP', BEA:'BEA', BEB:'BEB', JUMP:'einen Sprung', LABEL:'eine Sprungmarke', CALL:'CALL (Bausteinaufruf)', NETWORK:'Netzwerke' };
if(AWLMODE) Object.assign(CONSTRUCT_NAMES, AWL_NAMES);
const ARIA_QUIPS = ['„Knapp daneben ist auch vorbei, Lehrling.“','„Oh, wie menschlich.“','„Ich könnte dir helfen. Aber wo bliebe da der Spass?“','„Meine Zelle, meine Regeln.“',
  '„Fehler sind das Einzige, worauf man sich bei Menschen verlassen kann.“','„Nochmal? Ich habe Zeit. Unendlich viel Zeit.“','„Die Testfälle lügen nicht. Du vielleicht schon.“'];
const MEISTER_QUIPS = ['Sauber programmiert!','Genau so. Die Zelle gehorcht wieder.','Stark! ARIA wird nervös.','Das hätte ich nicht besser gekonnt.','Läuft wie geschmiert.','Perfekt. Weiter so, Lehrling.'];

/* ---------- Zustand ---------- */
const KEY = Q.key, OLD_KEY = Q.oldKey, VIEW_KEY = Q.viewKey;
function defaultSettings(){ return { sound:true, motion:false, speed:1, font:14, theme:'dark', scale:1, cb:false }; }
function defaultState(){
  return { v:4, pos:0, name:'', doneTasks:{}, doneTheory:{}, fails:{}, hints:{}, solutions:{}, drafts:{}, badges:[], seenIntro:[],
    streak:0, finished:false, settings:defaultSettings(), startedAt:Date.now(), finishedAt:null, theoryPerfect:0 };
}
function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ const s = Object.assign(defaultState(), JSON.parse(raw)); s.settings = Object.assign(defaultSettings(), s.settings||{}); return s; }
    const old = localStorage.getItem(OLD_KEY);
    if(old) return migrate(JSON.parse(old));
  }catch(e){}
  return defaultState();
}
function migrate(o){
  const s = defaultState();
  s.name = o.certName || '';
  (o.completedTaskIds||[]).forEach(id => {
    const t = TASK_BY_ID[id]; if(!t) return;
    const f = (o.failedAttempts||{})[id] || 0;
    s.doneTasks[id] = { stars: f === 0 ? 3 : f <= 2 ? 2 : 1, points: taskPoints(t, f, 0, false), fails:f, hints:0, migrated:true };
    if(o.solutions && o.solutions[id]) s.solutions[id] = o.solutions[id];
  });
  s.fails = Object.assign({}, o.failedAttempts||{});
  s.badges = (o.badges||[]).filter(b => BADGES[b]);
  s.pos = firstOpenPos(s);
  s.migratedFrom = 'v1';
  return s;
}
function firstOpenPos(s){
  for(let i = 0; i < SEQ.length; i++){
    const it = SEQ[i];
    if(it.type === 'task' && !s.doneTasks[it.id]) return i;
    if(it.type === 'theory' && !s.doneTheory[it.id]) return i;
  }
  return SEQ.length;
}
let S = loadState();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); showSaved(true); }catch(e){ showSaved(false); } if(ACCT) ACCT.changed(); }

let session = { task:null, practice:false, startedAt:0, manualClean:false, revealed:false, solved:false, lastRun:null };

/* ---------- Hilfen ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pick = a => a[Math.floor(Math.random()*a.length)];
function fmtTime(){ return new Date().toLocaleTimeString('de-CH', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
function nonBlank(code){ return code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).length; }
function chapterOf(n){ return CHAPTERS.find(c => c.n === n) || { n, title:'Kapitel '+n, subtitle:'' }; }
function fmtVal(v){
  if(v === true) return 'TRUE'; if(v === false) return 'FALSE';
  if(Array.isArray(v)) return '[' + v.map(fmtVal).join(', ') + ']';
  if(typeof v === 'number') return String(Math.round(v*1000)/1000);
  if(v === undefined || v === null) return '—';
  return String(v);
}
function taskPoints(t, fails, hints, revealed){
  if(revealed) return 0;
  const base = Math.max(20, 100 - 10*Math.min(fails,5) - 10*hints);
  return base * (t.isFinal ? 3 : t.isBoss ? 2 : 1);
}
function taskStars(fails, hints, revealed){
  if(revealed) return 0;
  if(fails === 0 && hints === 0) return 3;
  if(fails <= 2 && hints <= 1) return 2;
  return 1;
}
function totalScore(){
  let s = 0;
  Object.values(S.doneTasks).forEach(d => s += d.points||0);
  Object.values(S.doneTheory).forEach(d => s += d.points||0);
  return s + S.badges.length * 50;
}
function starsHTML(n, max){ max = max || 3; let h = ''; for(let i = 0; i < max; i++) h += i < n ? '★' : '<span class="off">★</span>'; return h; }

/* ---------- Sound (WebAudio, dezent) ---------- */
let actx = null;
function tone(freq, dur, type, vol, delay){
  if(!S.settings.sound) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime + (delay||0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }catch(e){}
}
const SFX = {
  ok(){ tone(523,.16,'triangle',.07); tone(659,.16,'triangle',.07,.1); tone(784,.28,'triangle',.07,.2); },
  fail(){ tone(196,.22,'sawtooth',.035); tone(147,.3,'sawtooth',.035,.12); },
  click(){ tone(880,.05,'square',.02); },
  right(){ tone(740,.12,'triangle',.06); tone(988,.18,'triangle',.06,.08); },
  wrong(){ tone(220,.2,'square',.03); },
  badge(){ [659,784,988,1319].forEach((f,i) => tone(f,.18,'triangle',.06,i*.08)); },
  horn(){ tone(415,.35,'square',.025); },
  compile(){ tone(1200,.04,'square',.015); tone(1500,.04,'square',.015,.05); }
};

/* ---------- Toasts & Funk ---------- */
function toast(icon, title, text){
  const w = $('toastWrap'), d = document.createElement('div');
  d.className = 'toast'; d.innerHTML = '<span class="ti">' + icon + '</span><div><b>' + esc(title) + '</b>' + esc(text) + '</div>';
  w.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 3800);
}
function radio(html, type, who){
  const log = $('radioLog'), d = document.createElement('div');
  d.className = 'msg msg-' + (type||'info');
  d.innerHTML = '<span class="ts">' + fmtTime() + '</span>' + (who ? '<span class="who">' + who + ':</span>' : '') + html;
  log.appendChild(d);
  while(log.children.length > 40) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}
const aria = html => radio(html, 'aria', 'ARIA');
const meister = (html, type) => radio(html, type || 'info', 'Werkmeister');
// Sensorwerkstatt: Werkstatt, Engineering-Laptop und Arbeitsschritte statt Editor und Live-Anlage (sensor_game.js)
const SENSOR = SENSORMODE && window.SensorGame ? window.SensorGame.create({ S: () => S, session: () => session, saveSoon: () => saveSoon(), meister, esc }) : null;

/* ---------- Modals ---------- */
let lastFocus = null;
function openModal(id){
  lastFocus = document.activeElement;
  const m = $(id); m.classList.add('active');
  const f = m.querySelector('.modal-close, button, input, select'); if(f) setTimeout(() => f.focus(), 30);
}
function closeModal(id){ $(id).classList.remove('active'); if(lastFocus && lastFocus.focus) lastFocus.focus(); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
['manualModal','mapModal','settingsModal'].forEach(id => $(id).addEventListener('click', e => { if(e.target.id === id) closeModal(id); }));
function confirmBox(text, opts){
  opts = opts || {};
  return new Promise(res => {
    $('confirmText').innerHTML = text;
    const inp = $('confirmInput'); inp.style.display = opts.input ? '' : 'none'; inp.value = opts.value || ''; inp.placeholder = opts.placeholder || '';
    $('confirmYes').textContent = opts.yes || 'OK'; $('confirmNo').textContent = opts.no || 'Abbrechen';
    $('confirmNo').style.display = opts.noCancel ? 'none' : '';
    openModal('confirmModal');
    if(opts.input) setTimeout(() => inp.focus(), 40);
    const done = v => { closeModal('confirmModal'); $('confirmYes').onclick = $('confirmNo').onclick = null; inp.onkeydown = null; res(v); };
    $('confirmYes').onclick = () => done(opts.input ? (inp.value.trim() || null) : true);
    $('confirmNo').onclick = () => done(opts.input ? null : false);
    inp.onkeydown = e => { if(e.key === 'Enter') $('confirmYes').click(); };
  });
}

/* ---------- Einstellungen ---------- */
function applySettings(){
  document.documentElement.style.setProperty('--editor-font', S.settings.font + 'px');
  document.body.classList.toggle('reduce-motion', !!S.settings.motion);
  $('setSound').checked = !!S.settings.sound; $('setMotion').checked = !!S.settings.motion;
  $('setSpeed').value = String(S.settings.speed); $('setFont').value = S.settings.font;
  document.body.classList.toggle('theme-light', S.settings.theme === 'light');
  document.body.classList.toggle('cb-mode', !!S.settings.cb);
  document.body.style.zoom = S.settings.scale && S.settings.scale !== 1 ? String(S.settings.scale) : '';
  $('setTheme').value = S.settings.theme || 'dark'; $('setScale').value = String(S.settings.scale || 1); $('setCb').checked = !!S.settings.cb;
  if(editor) editor.relayout();
}
$('setSound').addEventListener('change', e => { S.settings.sound = e.target.checked; save(); SFX.click(); });
$('setMotion').addEventListener('change', e => { S.settings.motion = e.target.checked; save(); applySettings(); });
$('setSpeed').addEventListener('change', e => { S.settings.speed = parseFloat(e.target.value) || 1; save(); });
$('setFont').addEventListener('input', e => { S.settings.font = parseInt(e.target.value, 10); save(); applySettings(); });
$('setTheme').addEventListener('change', e => { S.settings.theme = e.target.value; save(); applySettings(); });
$('setScale').addEventListener('change', e => { S.settings.scale = parseFloat(e.target.value) || 1; save(); applySettings(); });
$('setCb').addEventListener('change', e => { S.settings.cb = e.target.checked; save(); applySettings(); });
$('fontUpBtn').addEventListener('click', () => { S.settings.font = Math.min(20, S.settings.font + 1); save(); applySettings(); });
$('fontDownBtn').addEventListener('click', () => { S.settings.font = Math.max(12, S.settings.font - 1); save(); applySettings(); });
$('openSettingsBtn').addEventListener('click', () => openModal('settingsModal'));
$('versionLabel').textContent = VERSION;

/* ---------- Editor ---------- */
let syntaxTimer = 0;
const textEditor = window.SCLEditor.attach($('codeEditor'), $('editorHighlight'), $('lineNumbers'), $('editorErrLine'), { onChange: onCodeChange, onHover: info => editorHover(info) });
const editor = AWLMODE ? window.AWLEditor.attach(textEditor) : KOPMODE ? window.KOPEditor.attach(textEditor, { flavor: Q.lang, onChange: onCodeChange, onNoSelection: () => meister(FUPMODE ? 'Tippe zuerst im Funktionsplan einen Eingang, eine Box oder einen Ausgang an — oder ziehe die Box bzw. Variable direkt auf einen passenden Eingang.' : 'Tippe zuerst im Kontaktplan ein Element an (Kontakt oder Spule), dann die Variable.', 'warning') }) : textEditor;
// Code/Lösung als HTML: SCL hervorgehoben, KOP als Kontaktplan
function codeHTML(code){ return KOPMODE ? window.KOPEditor.renderStatic(code || '') : '<pre class="code-review-block">' + window.SCLEditor.highlight(code || '') + '</pre>'; }
function onCodeChange(code){
  clearTimeout(syntaxTimer);
  if(session.exam) setTimeout(() => EXAM.changed(), 0);
  syntaxTimer = setTimeout(() => liveCheck(code), 450);
  if(session.task && session.task.pro){ if(PS){ const b = proBlock(PS.active); if(b && b.edit && PS.view === 'code'){ PS.codes[b.name] = code; saveProDraft(); } } return; }
  if(session.task && !session.solved && !session.practice){ S.drafts[session.task.id] = code; saveSoon(); }
}
let saveTimer = 0; function saveSoon(){ clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); }
function liveCheck(code){
  const st = $('editorStatus'); const t = session.task; if(!t || code !== editor.getValue()) return;
  if(t.pro){ liveCheckPro(); return; }
  if(!code.trim()){ st.className = 'editor-status'; st.innerHTML = '<i class="fa-solid fa-circle-info"></i> Bereit — schreibe deinen Code.'; return; }
  try{ ENGINE.compileSCL(code, t); st.className = 'editor-status ok'; st.innerHTML = '<i class="fa-solid fa-circle-check"></i> Syntax &amp; Typen OK — mit Strg+Enter testen.'; editor.setErrorMark(0); }
  catch(e){ st.className = 'editor-status warn'; st.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + (KOPMODE ? '' : 'Zeile ' + (e.line||'?') + ': ') + esc(e.message); if(e.line) editor.setErrorMark(e.line, e.col, e.message, true); }
}

/* ---------- Szene ---------- */
$('sceneStageWrap').innerHTML = SCENE.STAGE_SVG;
function setView(mode, silent){
  if(mode === '3d' && (!window.Scene3D || !window.Scene3D.isAvailable())){
    if(!silent) radio('<i class="fa-solid fa-cube"></i> Die 3D-Ansicht braucht WebGL und three.js (Internetverbindung beim ersten Laden). Die 2D-Ansicht bleibt aktiv.', 'warning');
    mode = '2d';
  }
  const is3d = mode === '3d';
  if(is3d){
    $('scene3dWrap').style.display = ''; $('sceneStageWrap').style.display = 'none';
    if(!window.Scene3D.activate()){ $('scene3dWrap').style.display = 'none'; $('sceneStageWrap').style.display = ''; mode = '2d'; }
  } else { if(window.Scene3D) window.Scene3D.deactivate(); $('scene3dWrap').style.display = 'none'; $('sceneStageWrap').style.display = ''; }
  const on3 = mode === '3d';
  $('viewBtn2d').classList.toggle('active', !on3); $('viewBtn3d').classList.toggle('active', on3);
  $('viewBtn2d').setAttribute('aria-pressed', String(!on3)); $('viewBtn3d').setAttribute('aria-pressed', String(on3));
  try{ localStorage.setItem(VIEW_KEY, mode); }catch(e){}
}
$('viewBtn2d').addEventListener('click', () => setView('2d'));
$('viewBtn3d').addEventListener('click', () => setView('3d'));
document.querySelectorAll('.scene3d-views [data-view]').forEach(b => b.addEventListener('click', () => window.Scene3D && window.Scene3D.setView(b.dataset.view)));
SCENE.onEvent((ev, d) => { if(ev === 'channel' && d.ch === 'hornActive' && d.value) SFX.horn(); });

/* ---------- Kopfzeile ---------- */
function renderHeader(){
  const nT = Object.keys(S.doneTasks).length, nTh = Object.keys(S.doneTheory).length;
  const pct = Math.round((nT + nTh) / (TOTAL_TASKS + TOTAL_THEORY) * 100);
  $('progressFill').style.width = pct + '%';
  $('progressTrack').setAttribute('aria-valuenow', pct);
  const it = SEQ[Math.min(S.pos, SEQ.length-1)];
  $('progressLabel').textContent = 'KAP ' + (it ? it.ch : 10) + ' · ' + nT + '/' + TOTAL_TASKS;
  $('scoreValue').textContent = totalScore();
  const bs = $('badgeStrip'); bs.innerHTML = '';
  S.badges.forEach(id => { const b = BADGES[id]; if(!b) return; const p = document.createElement('div'); p.className = 'badge-pill'; p.dataset.title = b.title; p.textContent = b.icon; p.setAttribute('role','img'); p.setAttribute('aria-label', 'Abzeichen ' + b.title); bs.appendChild(p); });
}
function award(id){
  if(S.badges.includes(id) || !BADGES[id]) return;
  S.badges.push(id); save();
  const b = BADGES[id];
  toast(b.icon, 'Abzeichen: ' + b.title, b.desc); SFX.badge();
  radio('<i class="fa-solid fa-trophy"></i> Abzeichen freigeschaltet: <b>' + b.title + ' ' + b.icon + '</b> — ' + b.desc, 'success');
  renderHeader();
}

/* ---------- Ablauf ---------- */
function isDone(it){ return it.type === 'task' ? !!S.doneTasks[it.id] : !!S.doneTheory[it.id]; }
function goToPos(){
  closeAllOverlays();
  while(S.pos < SEQ.length && isDone(SEQ[S.pos])) S.pos++;
  if(S.pos >= SEQ.length){ S.finished = true; save(); showCertificate(); return; }
  const it = SEQ[S.pos];
  if(it.ch >= 11 && !S.basicCert){ showCertificate('basic'); return; }
  if(!S.seenIntro.includes(it.ch)){ showIntro(it.ch); return; }
  if(it.type === 'theory') openTheory(THEORY_BY_ID[it.id], false);
  else renderTask(TASK_BY_ID[it.id], false);
}
function advance(){ if(S.pos < SEQ.length) S.pos++; save(); goToPos(); }
function closeAllOverlays(){
  ['levelIntroOverlay','theoryOverlay'].forEach(id => $(id).style.display = 'none');
  $('certificate').style.display = 'none'; $('titleScreen').style.display = 'none';
  $('app').style.display = '';
}

/* ---------- Kapitel-Intro ---------- */
function showIntro(n){
  const ch = chapterOf(n), o = $('levelIntroOverlay');
  const next = SEQ[S.pos];
  $('app').style.display = 'none'; o.style.display = 'flex';
  const done = TASKS.filter(t => t.level === n && S.doneTasks[t.id]).length;
  o.innerHTML = '<div class="intro-card' + (n === 10 || n === 15 ? ' boss-intro' : '') + (ch.pro ? ' pro-intro' : '') + '">'
    + '<div class="intro-eyebrow">' + (ch.pro ? 'Profi-Stufe · ' : '') + 'Kapitel ' + n + ' / ' + CHAPTERS.length + '</div>'
    + '<h1 class="intro-title" id="introTitle"><i class="fa-solid ' + (ch.icon||'fa-robot') + '"></i> ' + esc(ch.title) + '</h1>'
    + '<div class="chapter-meta">' + esc(ch.subtitle||'') + ' · 2 Theorie-Aufträge · 10 Aufgaben' + (done ? ' · ' + done + ' bereits gelöst' : '') + '</div>'
    + '<div class="intro-anim" aria-hidden="true">' + (ch.anim||'') + '</div>'
    + '<p class="intro-theory">' + (ch.intro||'') + '</p>'
    + '<button class="compile-btn" id="introStartBtn"><i class="fa-solid ' + (next && next.type === 'theory' ? 'fa-graduation-cap' : 'fa-play') + '"></i> '
    + (next && next.type === 'theory' ? 'Theorie-Auftrag starten' : 'Mission starten') + '</button></div>';
  o.setAttribute('aria-labelledby', 'introTitle');
  const b = $('introStartBtn'); b.focus();
  b.addEventListener('click', () => { SFX.click(); if(!S.seenIntro.includes(n)) S.seenIntro.push(n); save(); goToPos(); });
}

/* ---------- Aufgabe anzeigen ---------- */
function varTypeLabel(s){
  const t = s.type;
  if(t && t.kind === 'FB') return t.fb;
  return ENGINE.typeName(t);
}
function renderTask(t, practice){
  if(!t) return;
  SCENE.stopTimeline(); clearTimeout(syntaxTimer);
  session = { task:t, practice:!!practice, startedAt:Date.now(), manualClean:false, revealed:false, solved:false, lastRun:null };
  const ch = chapterOf(t.level), no = TASK_NO[t.id];
  $('chapterLabel').textContent = 'Kapitel ' + t.level + ' · ' + ch.title;
  $('taskTitle').textContent = t.title;
  let tags = '';
  if(practice) tags += '<span class="tag tag-practice"><i class="fa-solid fa-dumbbell"></i> Training</span>';
  if(t.pro) tags += '<span class="tag tag-pro"><i class="fa-solid fa-industry"></i> Profi</span>';
  if(t.isDebug) tags += '<span class="tag tag-debug"><i class="fa-solid fa-bug"></i> Debug</span>';
  if(t.isFinal) tags += '<span class="tag tag-final"><i class="fa-solid fa-skull"></i> Final Boss</span>';
  else if(t.isBoss) tags += '<span class="tag tag-boss"><i class="fa-solid fa-crown"></i> Kapitel-Boss</span>';
  $('taskTags').innerHTML = tags;
  $('storyText').innerHTML = t.story;
  $('learnGoal').innerHTML = '<b>Lernziel</b>' + t.learn;
  $('taskDescription').innerHTML = t.briefing + (t.isDebug ? '<p class="report-note"><i class="fa-solid fa-bug"></i> Debugging-Aufgabe: Repariere den Fehler, ohne die Logik unnötig umzubauen.</p>' : '')
    + (t.pro ? '<p class="report-note"><i class="fa-solid fa-folder-tree"></i> Projekt: ' + t.project.blocks.map(b => (b.edit ? '<b>' : '') + esc(b.name) + (b.edit ? '</b>' : ' 🔒')).join(' · ') + ' — Bausteine über die Reiter über dem Editor wechseln.</p>' : '');
  if(t.pro){ setupPro(t, practice); }
  else if(t.workshop){ SENSOR.setup(t, practice); }
  else {
    if(PS) teardownPro();
    // Variablenliste
    const sym = ENGINE.buildSymbols(ENGINE.declOf(t));
    $('varList').innerHTML = Object.values(sym).map(s => '<button class="var-chip' + (s.type && s.type.kind === 'FB' ? ' fb' : '') + '" data-name="' + esc(s.name) + '" title="Einfügen">'
      + esc(s.name) + '<span class="vt">' + esc(varTypeLabel(s)) + '</span></button>').join('');
    editor.setFbNames(Object.keys(t.fbTypes||{}));
    $('editorFilename').textContent = t.id + Q.ext;
    if(editor.setSymbols) editor.setSymbols(Object.values(sym).map(s => s.name));
    const code = practice ? (t.starterCode || '') : (S.drafts[t.id] && typeof S.drafts[t.id] === 'string' ? S.drafts[t.id] : (t.starterCode || ''));
    editor.setValue(code); liveCheck(code);
  }
  $('taskIdLabel').textContent = 'AUFGABE ' + no + '/' + TOTAL_TASKS;
  renderAttempts(); renderHintBtn(); renderHints(); renderHeader();
  $('reportCard').style.display = 'none'; $('successCard').style.display = 'none';
  $('compileBtn').disabled = false;
  SCENE.reset(t.sceneBindings, t.initialVars);
  if(practice) meister('Trainingsmodus: <b>' + esc(t.title) + '</b>. Dein Ergebnis zählt nicht für den Fortschritt.');
  else if(t.isFinal && t.pro) aria('„Du hast meinen Kern gelöscht. Aber ohne mich läuft hier nichts. Beweis mir das Gegenteil.“');
  else if(t.isFinal) aria('„Du willst MEINE Zelle zurück? Dann zeig, was du gelernt hast.“');
  else meister('Neue Aufgabe <b>' + no + '</b>: ' + esc(t.title) + '. Lies das Briefing und die Variablenliste.');
  document.querySelector('.panel-left').scrollTop = 0;
  const glSeen = new Set(); markGlossary($('storyText'), glSeen); markGlossary($('learnGoal'), glSeen); markGlossary($('taskDescription'), glSeen);
  hideTip();
  maybeTour(t, practice);
}
$('varList').addEventListener('click', e => { const b = e.target.closest('.var-chip'); if(b){ editor.insertAtCursor(b.dataset.name); } });
function renderAttempts(){ const t = session.task; if(!t) return; $('attemptsLabel').textContent = 'Fehlversuche: ' + (S.fails[t.id]||0); }
function hintLevel(){ return session.task ? (S.hints[session.task.id]||0) : 0; }
function renderHintBtn(){
  const lv = session.practice ? (session.practiceHints||0) : hintLevel(), fails = session.task ? (S.fails[session.task.id]||0) : 0;
  $('hintBtnText').textContent = lv >= 3 ? (fails >= 3 ? 'Lösung' : 'Hinweis 3/3') : 'Hinweis ' + (lv ? lv + '/3' : '');
}

/* ---------- Hinweise ---------- */
function structuralHint(t){
  if(t.workshop) return SENSOR.structHint(t);
  if(t.pro){
    let used = [];
    try{ used = [...PRO.constructsUsed(PT.compile(t, PT.refCodes(t)), PT.editable(t))].filter(k => CONSTRUCT_NAMES[k] && !['OB','BOOL','INT','REAL'].includes(k)); }catch(e){}
    return 'Die Referenzlösung hat <b>' + t.refLines + ' Code-Zeile' + (t.refLines === 1 ? '' : 'n') + '</b> nach BEGIN' + (used.length ? ' und nutzt: ' + used.slice(0, 8).map(k => esc(CONSTRUCT_NAMES[k])).join(', ') : '') + '.';
  }
  if(KOPMODE){
    let used = [], nets = 0;
    try{ const pr = window.KOP.parse(t.refSolution); nets = pr.networks.length; used = [...window.KOP.constructs(pr)].filter(k => KOP_NAMES[k]); }catch(e){}
    return 'Die Musterlösung hat <b>' + nets + ' Netzwerk' + (nets === 1 ? '' : 'e') + '</b> mit ' + t.refLines + ' Elementen' + (used.length ? ' und nutzt: ' + used.map(k => esc(KOP_NAMES[k])).join(', ') : '') + '.';
  }
  const used = [...ENGINE.constructsUsed(ENGINE.compileSCL(t.refSolution, t))].filter(k => CONSTRUCT_NAMES[k] || ['AND','OR','NOT','XOR','MOD','=>'].includes(k));
  if(AWLMODE) return 'Die Referenzlösung hat <b>' + t.refLines + ' Anweisung' + (t.refLines === 1 ? '' : 'en') + '</b>' + (used.length ? ' und nutzt: ' + used.filter(k => !['ARITH','CONVERT','JUMP','TIMER','COUNTER','CMP'].includes(k) || used.length < 4).map(k => esc(CONSTRUCT_NAMES[k] || k)).join(', ') : '') + '.';
  return 'Die Referenzlösung hat <b>' + t.refLines + ' Zeile' + (t.refLines === 1 ? '' : 'n') + '</b>' + (used.length ? ' und nutzt: <code>' + used.map(esc).join('</code>, <code>') + '</code>' : '') + '.';
}
function hintTexts(t){
  const man = t.manualId ? ' Siehe Handbuch: <a href="#" class="hint-link" data-man="' + t.manualId + '">' + esc((MANUAL.find(m => m.id === t.manualId)||{}).title||'') + '</a>.' : '';
  return [t.hint, t.hint2 || structuralHint(t), structuralHint(t) + man];
}
function renderHints(){
  const t = session.task, box = $('hintBox'); if(!t) return;
  const lv = session.practice ? (session.practiceHints||0) : hintLevel();
  if(!lv){ box.style.display = 'none'; box.innerHTML = ''; return; }
  const tx = hintTexts(t);
  box.style.display = '';
  box.innerHTML = tx.slice(0, lv).map((h, i) => '<div class="hint-item"><span class="hint-no"><i class="fa-solid fa-lightbulb"></i> Hinweis ' + (i+1) + '</span>' + h + '</div>').join('');
}
async function requestHint(){
  const t = session.task; if(!t || session.solved) return;
  if(session.exam){ meister('In der Prüfung gibt es keine Hinweise und keine Musterlösung. Das Handbuch ist erlaubt.', 'warning'); return; }
  const lv = session.practice ? (session.practiceHints||0) : hintLevel(), fails = S.fails[t.id]||0;
  if(lv >= 3){
    if(session.live){ meister('In der Live-Challenge gibt es keine Musterlösung — du schaffst das!', 'warning'); return; }
    if(fails < 3 && !session.practice){ meister('Alle Hinweise sind ausgeschöpft. Die Lösung kann nach 3 Fehlversuchen angezeigt werden — versuch es noch einmal!', 'warning'); return; }
    const ok = await confirmBox('Referenzlösung in den Editor laden?<br><small>Die Aufgabe zählt dann als gelöst, bringt aber <b>keine Punkte und keine Sterne</b>. Lies die Lösung genau — du musst sie trotzdem selbst laden.</small>', { yes:'Lösung zeigen' });
    if(!ok) return;
    session.revealed = true;
    if(t.pro){ PS.codes = PT.refCodes(t); PS.view = 'code'; showProBlock(PS.active); }
    else if(t.workshop) SENSOR.reveal(t);
    else { editor.setValue(t.refSolution); liveCheck(t.refSolution); }
    meister('Referenzlösung geladen. Versuche jede Zeile zu verstehen, bevor du sie lädst.', 'warning');
    return;
  }
  if(session.practice) session.practiceHints = lv + 1; else { S.hints[t.id] = lv + 1; save(); }
  if(session.live) LIVE.hint();
  SFX.click();
  meister('<i class="fa-solid fa-lightbulb"></i> Hinweis ' + (lv+1) + '/3 steht jetzt unter der Aufgabe.' + (session.practice ? '' : ' <span class="hint-cost">(−10 Punkte)</span>'), 'warning');
  renderHints(); renderHintBtn();
  $('hintBox').scrollIntoView({ behavior: S.settings.motion ? 'auto' : 'smooth', block:'nearest' });
}
$('hintBtn').addEventListener('click', requestHint);
$('resetCodeBtn').addEventListener('click', async () => {
  const t = session.task; if(!t) return;
  if(t.workshop){ if(await confirmBox('Aufgabe auf den Ausgangszustand zurücksetzen? Verdrahtung, Einstellungen und Programm gehen verloren.', { yes:'Zurücksetzen' })) SENSOR.reset(t); return; }
  if(t.pro){
    const b = proBlock(PS.active); if(!b || !b.edit) return;
    if(await confirmBox('Baustein <b>' + esc(b.name) + '</b> auf den Startcode zurücksetzen? Deine Änderungen daran gehen verloren.', { yes:'Zurücksetzen' })){ PS.codes[b.name] = b.start; saveProDraft(); showProBlock(b.name); }
    return;
  }
  if(await confirmBox('Editor auf den Startcode zurücksetzen? Deine Änderungen gehen verloren.', { yes:'Zurücksetzen' })){ editor.setValue(t.starterCode||''); liveCheck(t.starterCode||''); }
});

/* ---------- Kompilieren & Testen ---------- */
function flashEditor(ok){ const b = $('editorBody'); b.classList.remove('flash-error','flash-success'); void b.offsetWidth; b.classList.add(ok ? 'flash-success' : 'flash-error'); }
function registerFail(t){ if(session.live) LIVE.attempt(false); if(session.practice) return; S.fails[t.id] = (S.fails[t.id]||0) + 1; S.streak = 0; save(); renderAttempts(); renderHintBtn(); }
function compile(){
  const t = session.task;
  if(!t || $('compileBtn').disabled || session.solved) return;
  if(t.pro){ compilePro(t); return; }
  if(t.workshop){ compileWorkshop(t); return; }
  const code = editor.getValue();
  if(!code.trim()){ meister('Der Editor ist leer. Schreib zuerst etwas Code!', 'warning'); flashEditor(false); return; }
  SCENE.stopTimeline(); SFX.compile();
  editor.setErrorLine(0);
  let prog;
  try{ prog = ENGINE.compileSCL(code, t); if(editor.setProgram) editor.setProgram(prog); }
  catch(e){
    if(!(e instanceof ENGINE.SCLError)) throw e;
    registerFail(t); flashEditor(false); SFX.fail();
    editor.setErrorMark(e.line, e.col, e.message);
    SCENE.showFault('Compiler-Fehler Z' + e.line);
    renderError(e, 'Compiler-Fehler');
    if((S.fails[t.id]||0) % 2 === 1) aria(pick(ARIA_QUIPS));
    return;
  }
  const res = t.timedTestCases ? ENGINE.runTimedTests(prog, t.initialVars, t.timedTestCases) : ENGINE.runSinglePassTests(prog, t.initialVars, t.testCases);
  let missing = [];
  if(t.mustUse && t.mustUse.length){ const used = ENGINE.constructsUsed(prog); missing = t.mustUse.filter(m => !used.has(m)); }
  session.lastRun = res;
  if(res.ok && !missing.length){ onSuccess(t, code, res); return; }
  registerFail(t); flashEditor(false); SFX.fail();
  if(res.error){ editor.setErrorLine(res.error.line); SCENE.showFault('Laufzeitfehler'); }
  renderReport(t, res, missing);
  playRun(t, res, false);
  if((S.fails[t.id]||0) % 2 === 1) aria(pick(ARIA_QUIPS));
}
function compileWorkshop(t){
  SFX.compile();
  const res = SENSOR.check(t);
  session.lastRun = res;
  if(res.ok){ onSuccess(t, SENSOR.solution(t), res); return; }
  registerFail(t); SFX.fail();
  SENSOR.report(t, res);
  meister('Abnahme: <b>' + res.steps.filter(s => !s.ok).length + '</b> Arbeitsschritt(e) noch offen. Die Liste links zeigt, was fehlt.', 'warning');
  if((S.fails[t.id]||0) % 2 === 1) aria(pick(ARIA_QUIPS));
}
$('compileBtn').addEventListener('click', compile);
$('codeEditor').addEventListener('keydown', e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); compile(); } });

function onSuccess(t, code, res){
  if(session.exam){ EXAM.localOk(t, code, res); return; }
  session.solved = true;
  if(session.live) LIVE.attempt(true, code);
  $('compileBtn').disabled = true;
  flashEditor(true); SFX.ok();
  const fails = S.fails[t.id]||0, hints = S.hints[t.id]||0;
  const stars = taskStars(fails, hints, session.revealed), pts = taskPoints(t, fails, hints, session.revealed);
  if(t.pro) renderProReport(t, res); else if(t.workshop) SENSOR.report(t, res); else renderReport(t, res, []);
  if(!session.practice){
    const prev = S.doneTasks[t.id];
    if(!prev || (prev.points||0) <= pts) S.doneTasks[t.id] = { stars, points:pts, fails, hints, revealed:session.revealed, at:Date.now() };
    S.solutions[t.id] = code; delete S.drafts[t.id];
    if(fails === 0 && !session.revealed){ S.streak = (S.streak||0) + 1; } else S.streak = 0;
    save();
    // Abzeichen
    if(fails === 0 && !session.revealed) award('first_try');
    if(t.isDebug && Date.now() - session.startedAt < 60000 && !session.revealed) award('sherlock');
    if(!t.workshop && codeLines(t, code) <= t.refLines && !session.revealed) award('clean_coder');
    if(session.manualClean && fails === 0) award('buecherwurm');
    if(S.streak >= 10) award('serie');
    const chTasks = TASKS.filter(x => x.level === t.level);
    if(chTasks.every(x => S.doneTasks[x.id] && S.doneTasks[x.id].stars === 3)) award('perfekt');
    if(t.isFinal) award(t.pro ? 'architekt' : 'befreier');
  }
  renderHeader();
  $('successTitle').textContent = session.practice ? 'Training bestanden!' : (t.isFinal ? 'ARIA ist besiegt!' : 'Aufgabe gelöst!');
  $('successStars').innerHTML = session.practice ? '' : starsHTML(stars);
  $('successPoints').textContent = session.practice ? 'Trainingsmodus — keine Punkte.' : ('+' + pts + ' Punkte · ' + fails + ' Fehlversuch' + (fails === 1 ? '' : 'e') + ' · ' + hints + ' Hinweis' + (hints === 1 ? '' : 'e') + (session.revealed ? ' · Lösung angesehen' : ''));
  $('successTakeaway').innerHTML = '<b>Merke:</b> ' + (t.takeaway || '');
  $('nextBtn').innerHTML = session.practice ? '<i class="fa-solid fa-arrow-left"></i> Zurück zur Mission' : (t.isFinal ? '<i class="fa-solid fa-award"></i> Zum Zertifikat' : '<i class="fa-solid fa-forward"></i> Weiter <kbd>Enter</kbd>');
  const sa = document.querySelector('.success-actions');
  const oldCmp = $('successCmpBtn'); if(oldCmp) oldCmp.remove();
  if(!session.revealed && !t.workshop){ const cb = document.createElement('button'); cb.className = 'btn'; cb.id = 'successCmpBtn'; cb.innerHTML = '<i class="fa-solid fa-code-compare"></i> Mit Musterlösung vergleichen'; cb.addEventListener('click', () => openDiff(t, code)); sa.insertBefore(cb, $('nextBtn')); }
  if(session.practice && S.doneTasks[t.id]){ S.doneTasks[t.id].reviewedAt = Date.now(); save(); }
  else maybeRemindExport();
  if(session.live){ $('successTitle').textContent = 'Gelöst!'; $('successPoints').textContent = 'Live-Challenge — Punkte werden übertragen …'; $('nextBtn').innerHTML = '<i class="fa-solid fa-ranking-star"></i> Zur Rangliste'; }
  meister(pick(MEISTER_QUIPS), 'success');
  (t.pro ? playRunPro : t.workshop ? (a, b, c, done) => done() : playRun)(t, res, true, () => {
    $('successCard').style.display = '';
    $('successCard').scrollIntoView({ behavior: S.settings.motion ? 'auto' : 'smooth', block:'nearest' });
    $('nextBtn').focus();
  });
}
$('nextBtn').addEventListener('click', () => { SFX.click(); if(session.live){ LIVE.board(); return; } if(session.practice){ goToPos(); } else advance(); });

/* ---------- Animation aus echten Ausführungsdaten ---------- */
function playRun(t, res, ok, done){
  const frames = [];
  const speed = S.settings.speed || 1;
  if(t.timedTestCases){
    const rc = res.failedCase || res.report[0];
    if(rc && rc.steps){
      const ms = Math.round((rc.steps.length > 12 ? 420 : 620) * speed);
      rc.steps.forEach((s, i) => frames.push({ env:s.env, label:'t = ' + fmtVal(s.t) + ' s · Zyklus ' + (i+1) + '/' + rc.steps.length, ms }));
    }
  } else {
    const upto = res.failedCase ? res.report.indexOf(res.failedCase) + 1 : res.report.length;
    res.report.slice(0, upto).forEach((r, i) => { if(r.env) frames.push({ env:r.env, label:'Testfall ' + (i+1) + '/' + res.report.length + (r.pass ? ' ✓' : ' ✗'), ms: Math.round(850*speed) }); });
  }
  SCENE.playTimeline(t.sceneBindings, frames, 600, () => { SCENE.flashResult(ok); if(done) setTimeout(done, 350); }, i => {
    if(editor.showFlow) editor.showFlow(frames[i].env);
    document.querySelectorAll('#reportBody .trace .cur').forEach(c => c.classList.remove('cur'));
    document.querySelectorAll('#reportBody .trace [data-col="' + i + '"]').forEach(c => c.classList.add('cur'));
    document.querySelectorAll('#reportBody .tc-table tr').forEach(r => r.classList.toggle('playing', r.dataset.row === String(i)));
  });
}

/* ---------- Testbericht ---------- */
function renderError(e, title){
  $('reportCard').style.display = ''; $('successCard').style.display = 'none';
  $('reportTitle').textContent = title;
  const fx = quickFix(e);
  $('reportBody').innerHTML = '<div class="err-box"><span class="err-line">' + (e.line ? 'ZEILE ' + e.line + (e.col ? ', SPALTE ' + e.col : '') : 'FEHLER') + '</span>' + esc(e.message) + '</div>' + fixButtonHTML(fx) + reportHint();
  bindFixButton(fx);
  $('reportCard').scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function reportHint(){
  const t = session.task, fails = S.fails[t.id]||0;
  if(session.practice || fails < 2) return '';
  const lv = hintLevel();
  return '<div class="report-hint"><b><i class="fa-solid fa-lightbulb"></i> Festgefahren?</b> ' + (lv < 3 ? 'Hol dir über den Knopf <b>Hinweis</b> einen gestuften Tipp.' : (fails >= 3 ? 'Du kannst dir jetzt über <b>Lösung</b> die Referenz ansehen.' : 'Schau ins Handbuch.'))
    + (t.manualId ? ' <a href="#" class="hint-link" data-man="' + t.manualId + '"><i class="fa-solid fa-book-open"></i> Handbuch: ' + esc((MANUAL.find(m => m.id === t.manualId)||{}).title||'') + '</a>' : '') + '</div>';
}
function kv(k, v, cls){ return '<span class="kv ' + (cls||'') + '"><span class="k">' + esc(k) + '</span>=<span class="v">' + esc(fmtVal(v)) + '</span></span>'; }
function renderReport(t, res, missing){
  $('reportCard').style.display = ''; $('successCard').style.display = 'none';
  let h = '';
  const nCases = res.report.length;
  if(t.timedTestCases){
    const totalCases = t.timedTestCases.length;
    const failed = res.failedCase;
    h += '<div class="report-summary">' + (res.ok ? '<span class="pill pill-ok"><i class="fa-solid fa-check"></i> Zeitverlauf korrekt</span>' : '<span class="pill pill-err"><i class="fa-solid fa-xmark"></i> Abweichung im Zeitverlauf</span>')
      + '<span class="pill">' + totalCases + ' Ablauf' + (totalCases > 1 ? 'e' : '') + '</span></div>';
    const rc = failed || res.report[0];
    const idx = res.report.indexOf(rc);
    if(totalCases > 1) h += '<div class="report-note">Ablauf ' + (idx+1) + ' von ' + totalCases + (failed ? '' : ' (alle bestanden)') + ':</div>';
    h += traceTable(t, rc, idx);
    if(rc.error) h += '<div class="err-box" style="margin-top:10px"><span class="err-line">LAUFZEITFEHLER · ZEILE ' + rc.error.line + '</span>' + esc(rc.error.message) + '</div>';
    else if(failed){
      const st = failed.steps[failed.steps.length - 1], bad = st.checks.filter(c => !c.pass);
      h += '<div class="report-note"><i class="fa-solid fa-circle-exclamation" style="color:var(--accent-red)"></i> Bei <b>t = ' + fmtVal(st.t) + ' s</b> (Zyklus ' + failed.steps.length + '): ' + bad.map(c => '<code>' + esc(c.name) + '</code> ist <b>' + fmtVal(c.actual) + '</b>, erwartet <b>' + fmtVal(c.expected) + '</b>').join(', ') + '. Die Anlage oben spielt den Ablauf bis zu dieser Stelle ab.</div>';
    }
  } else {
    const passed = res.report.filter(r => r.pass).length;
    h += '<div class="report-summary">' + (passed === nCases ? '<span class="pill pill-ok"><i class="fa-solid fa-check"></i> ' + passed + '/' + nCases + ' Testfälle bestanden</span>' : '<span class="pill pill-err"><i class="fa-solid fa-xmark"></i> ' + passed + '/' + nCases + ' Testfälle bestanden</span>') + '</div>';
    h += '<table class="tc-table"><thead><tr><th>#</th><th>Eingaben / Startwerte</th><th>Ergebnis</th><th class="st"></th></tr></thead><tbody>';
    res.report.forEach((r, i) => {
      const inputs = Object.keys(r.setup||{}).map(k => kv(k, r.setup[k])).join('') || '<span class="kv"><span class="k">Startwerte der Aufgabe</span></span>';
      let out = '';
      if(r.error) out = '<span style="color:#ff8a8a">Zeile ' + r.error.line + ': ' + esc(r.error.message) + '</span>';
      else out = r.checks.map(c => c.pass ? kv(c.name, c.actual, 'good') : '<span class="kv bad"><span class="k">' + esc(c.name) + '</span>=<span class="v">' + esc(fmtVal(c.actual)) + '</span><span class="exp">→ soll ' + esc(fmtVal(c.expected)) + '</span></span>').join('');
      h += '<tr data-row="' + i + '" class="' + (r.pass ? '' : 'fail') + '"><td>' + (i+1) + '</td><td>' + inputs + '</td><td>' + out + '</td><td class="st"><i class="fa-solid ' + (r.pass ? 'fa-check' : 'fa-xmark') + '"></i></td></tr>';
    });
    h += '</tbody></table>';
  }
  if(missing && missing.length){
    h += '<div class="err-box" style="margin-top:12px"><span class="err-line">ANFORDERUNG NICHT ERFÜLLT</span>Das Ergebnis stimmt' + (res.ok ? '' : ' noch nicht ganz') + ' — aber die Aufgabe verlangt ausdrücklich ' + missing.map(m => '<b>' + esc((KOPMODE && KOP_NAMES[m]) || CONSTRUCT_NAMES[m] || m) + '</b>').join(', ') + '.</div>';
  }
  if(!res.ok) h += diagnoseHTML(t, res, editor.getValue());
  if(!res.ok || (missing && missing.length)) h += reportHint();
  $('reportTitle').textContent = res.ok && !(missing && missing.length) ? 'Testbericht — bestanden' : 'Testbericht';
  $('reportBody').innerHTML = h;
  $('reportCard').scrollIntoView({ behavior: S.settings.motion ? 'auto' : 'smooth', block:'nearest' });
}
function traceTable(t, rc, caseIdx){ return traceTableFor(t.timedTestCases[caseIdx], rc); }
function traceTableV4(t, rc, caseIdx){
  const tc = t.timedTestCases[caseIdx];
  const inputs = [], outputs = [];
  Object.keys(tc.setup||{}).forEach(k => { if(!inputs.includes(k)) inputs.push(k); });
  tc.steps.forEach(s => { Object.keys(s.inputs||{}).forEach(k => { if(!inputs.includes(k)) inputs.push(k); }); Object.keys(s.expect||{}).forEach(k => { if(!outputs.includes(k)) outputs.push(k); }); });
  const steps = rc.steps, nAll = tc.steps.length;
  const cell = (v, extra, cls) => {
    const b = typeof v === 'boolean';
    return '<td data-col="' + extra + '" class="' + (b ? (v ? 'b1' : 'b0') : (v === undefined ? '' : 'num')) + (cls ? ' ' + cls : '') + '">' + (v === undefined ? '' : (b ? (v ? '1' : '0') : esc(fmtVal(v)))) + '</td>';
  };
  let h = '<div class="trace-wrap"><table class="trace"><thead><tr><th class="sig">Signal</th>';
  for(let i = 0; i < nAll; i++){
    const s = steps[i];
    h += '<th data-col="' + i + '" class="' + (i === steps.length - 1 && !rc.pass ? 'failcol' : '') + '">' + (s ? 't=' + fmtVal(s.t) : '…') + '</th>';
  }
  h += '</tr></thead><tbody>';
  if(inputs.length){
    h += '<tr class="grp"><td colspan="' + (nAll+1) + '">Eingänge</td></tr>';
    inputs.forEach(k => { h += '<tr><td class="sig" title="' + esc(k) + '">' + esc(k) + '</td>'; for(let i = 0; i < nAll; i++){ const s = steps[i]; h += s ? cell(Array.isArray(s.env[k]) ? '[…]' : s.env[k], i) : '<td></td>'; } h += '</tr>'; });
  }
  h += '<tr class="grp"><td colspan="' + (nAll+1) + '">Ausgänge — Ist / Soll</td></tr>';
  outputs.forEach(k => {
    h += '<tr><td class="sig">' + esc(k) + ' <span style="color:var(--text-faint)">ist</span></td>';
    for(let i = 0; i < nAll; i++){
      const s = steps[i]; if(!s){ h += '<td></td>'; continue; }
      const chk = s.checks.find(c => c.name === k);
      h += cell(s.env[k], i, chk && !chk.pass ? 'bad' : '');
    }
    h += '</tr><tr><td class="sig" style="color:var(--text-faint)">' + esc(k) + ' soll</td>';
    for(let i = 0; i < nAll; i++){
      const e = tc.steps[i].expect || {};
      if(!(k in e)){ h += '<td></td>'; continue; }
      const v = e[k], b = typeof v === 'boolean';
      h += '<td data-col="' + i + '" class="' + (b ? (v ? 'exp1' : 'exp0') : 'num') + '">' + (b ? (v ? '1' : '0') : esc(fmtVal(v))) + '</td>';
    }
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}

/* ============================================================
   PROFI-STUFE — Projekt-Editor, Deklarationstabelle, Beobachten, Export
   ============================================================ */
const PRO = window.SCLPro, PT = window.ProTask;
let PS = null;   // { t, codes:{Baustein:Quelltext}, active, view:'code'|'table'|'globals', lastErrBlock }
const KIND_ICON = { FB:'fa-cube', FC:'fa-gear', OB:'fa-play', UDT:'fa-shapes', DB:'fa-database' };
const KIND_EXT = { FB:'.scl', FC:'.scl', OB:'.scl', UDT:'.udt', DB:'.db' };
const SEC_LABEL = { Input:'Input', Output:'Output', InOut:'InOut', Static:'Static', Temp:'Temp', Constant:'Constant', Return:'Return' };
const SEC_BY_KIND = { FB:['Input','Output','InOut','Static','Temp','Constant'], FC:['Input','Output','InOut','Temp','Constant'], OB:['Temp','Constant'], DB:['Static'] };
Object.assign(CONSTRUCT_NAMES, { MULTI:'eine Multiinstanz (#Instanz(…))', FC_CALL:'einen FC-Aufruf', STAT:'statische Variablen (VAR)', TEMP:'temporäre Variablen (VAR_TEMP)',
  CONSTANT:'eine Konstante im Code', VAR_CONSTANT:'VAR CONSTANT', STRUCT:'eine Struktur (STRUCT)', UDT:'einen PLC-Datentyp (TYPE … END_TYPE)', UDT_REF:'einen PLC-Datentyp',
  DB_ACCESS:'den Zugriff auf einen globalen Datenbaustein', STRING:'Texte (STRING)', CONCAT:'CONCAT', BIT:'einen Bitzugriff (.%X)', VAR_IN_OUT:'einen IN_OUT-Parameter',
  VAR_INPUT:'VAR_INPUT', VAR_OUTPUT:'VAR_OUTPUT', SINGLE:'einen Aufruf über einen Instanz-DB', MEMBER:'einen Zugriff mit Punkt (.Element)', STARTUP:'einen Anlauf-OB (OB100)',
  VOID:'eine FC ohne Rückgabewert (Void)', RETVAL:'einen Rückgabewert', INIT:'einen Startwert (:= in der Deklaration)', ARRAY_BOUNDS:'eigene Array-Grenzen', FB:'einen FUNCTION_BLOCK',
  FC:'eine FUNCTION', OB:'einen Organisationsbaustein', DINT:'den Datentyp DInt', INT:'den Datentyp Int', REAL:'den Datentyp Real', BOOL:'den Datentyp Bool', TIME:'den Datentyp Time',
  FB_INSTANCE:'eine FB-Instanz', LEN:'LEN', MID:'MID', FIND:'FIND', STRING_TO_INT:'STRING_TO_INT', INT_TO_REAL:'INT_TO_REAL', TIME_TO_DINT:'TIME_TO_DINT', MAX:'MAX', NOT:'NOT', AND:'AND' });

function proBlock(name){ return PS && PS.t.project.blocks.find(b => b.name === name); }
function proCode(b){ return b.edit ? PS.codes[b.name] : b.src; }
function canTable(b){ return PS.t.tableMode && b && b.edit && ['FB','FC','OB','DB'].includes(b.kind); }
function codeLines(t, code){
  if(KOPMODE && !t.pro){ try{ return window.KOP.elementCount(code); }catch(e){ return 999; } }
  if(!t.pro) return nonBlank(code);
  if(KOPMODE) return Object.keys(code).reduce((n, k) => { const fr = window.KOP.splitBlock(String(code[k])); try{ return n + (fr && window.KOP.isKopBody(fr.body) ? window.KOP.elementCount(fr.body) : 0); }catch(e){ return n; } }, 0);
  return Object.keys(code).reduce((n, k) => n + nonBlank((String(code[k]).split(/\bBEGIN\b/)[1]) || ''), 0);
}
function saveProDraft(){ if(PS && !session.solved && !session.practice){ S.drafts[PS.t.id] = Object.assign({}, PS.codes); saveSoon(); } }
function globalType(t, n){
  const spec = t.project.types[n];
  if(spec) return spec.replace(/\bOF\b/g, 'of');
  const v = t.project.globals[n];
  if(typeof v === 'boolean') return 'Bool';
  if(typeof v === 'string') return 'String';
  if(Array.isArray(v)) return 'Array';
  return Number.isInteger(v) ? 'Int' : 'Real';
}
function setupPro(t, practice){
  const draft = !practice && S.drafts[t.id] && typeof S.drafts[t.id] === 'object' ? S.drafts[t.id] : null;
  const codes = PT.startCodes(t);
  if(draft) Object.keys(draft).forEach(k => { if(k in codes && draft[k]) codes[k] = draft[k]; });
  const first = t.project.blocks.find(b => b.edit) || t.project.blocks[0];
  PS = { t, codes, active: first.name, view: 'code', lastErrBlock: null };
  $('projectBar').style.display = '';
  // Variablenliste = PLC-Variablentabelle + Instanz-DBs
  const g = Object.keys(t.project.globals).map(n => '<button class="var-chip" data-name="&quot;' + esc(n) + '&quot;" title="Einfügen">"' + esc(n) + '"<span class="vt">' + esc(globalType(t, n)) + '</span></button>');
  const inst = Object.keys(t.project.instances || {}).map(n => '<button class="var-chip fb" data-name="&quot;' + esc(n) + '&quot;" title="Instanz-DB einfügen">"' + esc(n) + '"<span class="vt">' + esc(t.project.instances[n]) + '</span></button>');
  $('varList').innerHTML = (g.concat(inst).join('') || '<span class="var-hint">Keine globalen Variablen.</span>');
  $('varPanel').querySelector('summary').innerHTML = '<i class="fa-solid fa-table-list"></i> PLC-Variablen <span class="var-hint">(Klick fügt den Namen ein)</span>';
  editor.setFbNames(t.project.blocks.filter(b => b.kind === 'FB').map(b => b.name).concat(Object.keys(t.project.instances || {})));
  renderProTabs();
  showProBlock(PS.active, true);
}
// KOP (Profi): Variablenliste = Schnittstelle des aktiven Bausteins (#Name) + PLC-Variablen; Aufrufziele mit Parametern
function kopProSymbols(){
  if(!KOPMODE || !PS) return;
  const t = PS.t, b = proBlock(PS.active);
  let rows = [];
  try{ const ifc = b && PRO.readInterface(proCode(b)); rows = ifc ? ifc.rows : []; }catch(e){}
  const iface = (name) => { const bl = proBlock(name); if(!bl) return null; try{ return PRO.readInterface(proCode(bl)); }catch(e){ return null; } };
  const params = ifc => ifc ? ifc.rows.filter(r => ['Input','Output','InOut'].includes(r.sec)).map(r => ({ n: r.name, d: r.sec === 'Output' ? '=>' : ':=' })).concat(ifc.kind === 'FC' && ifc.ret && !/^void$/i.test(ifc.ret) ? [{ n:'Ret_Val', d:'=>' }] : []) : [];
  const calls = {};
  t.project.blocks.filter(x => x.kind === 'FC' && x.name !== PS.active).forEach(x => { calls['"' + x.name + '"'] = params(iface(x.name)); });
  const inst = Object.assign({}, t.project.instances || {});
  t.project.blocks.filter(x => x.kind === 'FB' && x.name !== PS.active && !Object.values(inst).includes(x.name)).forEach(x => { inst[x.name + '_DB'] = x.name; });
  Object.keys(inst).forEach(n => { calls['"' + n + '"'] = params(iface(inst[n])); });
  rows.filter(r => r.sec === 'Static' && proBlock(String(r.type).replace(/"/g, '')) && proBlock(String(r.type).replace(/"/g, '')).kind === 'FB').forEach(r => { calls['#' + r.name] = params(iface(String(r.type).replace(/"/g, ''))); });
  const loc = rows.map(r => '<button class="var-chip loc" data-name="#' + esc(r.name) + '" title="' + esc(SEC_LABEL[r.sec] || r.sec) + ' · einfügen">#' + esc(r.name) + '<span class="vt">' + esc(r.type) + '</span></button>');
  const g = Object.keys(t.project.globals).map(n => '<button class="var-chip" data-name="&quot;' + esc(n) + '&quot;" title="PLC-Variable · einfügen">"' + esc(n) + '"<span class="vt">' + esc(globalType(t, n)) + '</span></button>');
  const c = Object.keys(calls).map(n => '<button class="var-chip fb" data-name="' + esc(n) + '" title="' + (FUPMODE ? 'Aufruf-Box: Ausgang antippen → Aufruf' : 'Aufruf-Box: Element Spule antippen → Aufruf') + '">' + esc(n) + '<span class="vt">Aufruf</span></button>');
  $('varList').innerHTML = loc.concat(g, c).join('') || '<span class="var-hint">Keine Variablen.</span>';
  if(editor.setSymbols) editor.setSymbols(rows.map(r => '#' + r.name).concat(Object.keys(t.project.globals).map(n => '"' + n + '"')));
  if(editor.setCallables) editor.setCallables(calls);
}
// Code-Bereich zeigen/verstecken (KOP: Netzwerk-Editor oder Textansicht, je nach Umschalter)
function showCodeArea(){ if(KOPMODE && editor.setMode) editor.setMode(editor.mode); else $('editorBody').style.display = ''; }
function hideCodeArea(){ $('editorBody').style.display = 'none'; const w = $('kopWrap'); if(w) w.style.display = 'none'; }
function teardownPro(){
  PS = null; if(editor.setCallables) editor.setCallables({}); if(editor.setReadOnly) editor.setReadOnly(false);
  $('projectBar').style.display = 'none'; $('declPanel').style.display = 'none'; showCodeArea();
  $('codeEditor').readOnly = false; document.querySelector('.editor-card').classList.remove('locked');
  $('varPanel').querySelector('summary').innerHTML = '<i class="fa-solid fa-table-list"></i> Variablen dieser Aufgabe <span class="var-hint">(Klick fügt den Namen ein)</span>';
}
function renderProTabs(){
  const t = PS.t;
  const tabs = t.project.blocks.map(b => '<button class="ptab' + (b.name === PS.active && PS.view !== 'globals' ? ' active' : '') + (b.edit ? '' : ' locked') + (PS.lastErrBlock === b.name ? ' err' : '') + '" role="tab" data-block="' + esc(b.name) + '" aria-selected="' + (b.name === PS.active && PS.view !== 'globals') + '" title="' + (b.edit ? 'bearbeitbar' : 'vorgegeben, schreibgeschützt') + '">'
    + '<i class="fa-solid ' + (KIND_ICON[b.kind] || 'fa-file') + '"></i> ' + esc(b.name) + (b.kind === 'OB' ? ' <small>[OB' + (b.ob || (/startup|anlauf/i.test(b.name) ? 100 : 1)) + ']</small>' : ' <small>[' + b.kind + ']</small>') + (b.edit ? '' : ' <i class="fa-solid fa-lock lk"></i>') + '</button>');
  if(Object.keys(t.project.globals).length) tabs.push('<button class="ptab globals' + (PS.view === 'globals' ? ' active' : '') + '" role="tab" data-block="__globals"><i class="fa-solid fa-list"></i> PLC-Variablen</button>');
  $('projectTabs').innerHTML = tabs.join('');
}
$('projectTabs').addEventListener('click', e => { const b = e.target.closest('.ptab'); if(b && PS){ SFX.click(); showProBlock(b.dataset.block); } });
function showProBlock(name, silent){
  if(!PS) return;
  editor.setErrorLine(0);
  if(name === '__globals'){ PS.view = 'globals'; renderGlobalsPanel(); renderProTabs(); updateTableBtn(); return; }
  const b = proBlock(name); if(!b) return;
  PS.active = name;
  if(PS.view === 'globals') PS.view = 'code';
  if(PS.view === 'table' && !canTable(b)) PS.view = 'code';
  $('editorFilename').textContent = b.name + ((KOPMODE || AWLMODE) && ['FB','FC','OB'].includes(b.kind) ? Q.ext : (KIND_EXT[b.kind] || '.scl'));
  document.querySelector('.editor-card').classList.toggle('locked', !b.edit);
  $('codeEditor').readOnly = !b.edit;
  if(PS.view === 'table') renderDeclTable();
  else { $('declPanel').style.display = 'none'; showCodeArea(); editor.setValue(proCode(b)); if(editor.setReadOnly) editor.setReadOnly(!b.edit); }
  renderProTabs(); updateTableBtn(); kopProSymbols();
  if(!silent || true) liveCheckPro();
}
function updateTableBtn(){
  const btn = $('tableToggleBtn'), b = proBlock(PS.active);
  const ok = PS.view !== 'globals' && canTable(b);
  btn.disabled = !ok;
  btn.classList.toggle('active', PS.view === 'table');
  btn.querySelector('span').textContent = PS.view === 'table' ? 'Quelltext' : 'Tabelle';
  btn.title = !PS.t.tableMode ? 'In Kapitel 11 schreibst du die Deklarationen noch als Text — die Tabelle gibt es ab Kapitel 12.' : (b && !b.edit ? 'Vorgegebene Bausteine sind schreibgeschützt.' : 'Schnittstelle als Tabelle ⇄ Quelltext');
}
$('tableToggleBtn').addEventListener('click', () => {
  if(!PS) return;
  const b = proBlock(PS.active); if(!canTable(b)) return;
  SFX.click();
  PS.view = PS.view === 'table' ? 'code' : 'table';
  showProBlock(PS.active);
});
function renderGlobalsPanel(){
  const t = PS.t;
  hideCodeArea(); $('declPanel').style.display = '';
  $('editorFilename').textContent = 'PLC-Variablen';
  let h = '<div class="decl-head"><i class="fa-solid fa-list"></i> PLC-Variablentabelle <span class="decl-sub">(globale Variablen — im Code in Anführungszeichen, schreibgeschützt)</span></div>';
  h += '<table class="decl-table"><thead><tr><th>Name</th><th>Datentyp</th><th>Startwert</th><th>Kommentar</th></tr></thead><tbody>';
  Object.keys(t.project.globals).forEach(n => {
    const v = t.project.globals[n];
    h += '<tr><td><code>"' + esc(n) + '"</code></td><td>' + esc(globalType(t, n)) + '</td><td>' + esc(Array.isArray(v) ? '[…]' : fmtVal(v)) + '</td><td>' + esc((t.project.comments || {})[n] || '') + '</td></tr>';
  });
  h += '</tbody></table>';
  const inst = Object.keys(t.project.instances || {});
  if(inst.length) h += '<div class="decl-head" style="margin-top:12px"><i class="fa-solid fa-database"></i> Instanz-Datenbausteine</div><table class="decl-table"><tbody>' + inst.map(n => '<tr><td><code>"' + esc(n) + '"</code></td><td>Instanz von "' + esc(t.project.instances[n]) + '"</td></tr>').join('') + '</tbody></table>';
  $('declPanel').innerHTML = h;
}
const TYPE_SUGGEST = ['Bool','Int','DInt','SInt','USInt','UInt','UDInt','Real','LReal','Time','Byte','Word','DWord','String','String[20]','Array[1..10] of Int','Array[1..10] of Real','TON','TOF','TP','R_TRIG','F_TRIG','CTU','CTD'];
function renderDeclTable(msg){
  const b = proBlock(PS.active);
  hideCodeArea(); $('declPanel').style.display = '';
  let ifc;
  try{ ifc = PRO.readInterface(PS.codes[b.name]); }
  catch(e){
    $('declPanel').innerHTML = '<div class="err-box"><span class="err-line">TABELLE NICHT VERFÜGBAR</span>Der Quelltext enthält einen Syntaxfehler (Zeile ' + (e.line||'?') + ': ' + esc(e.message) + '). Wechsle zum Quelltext und behebe ihn zuerst.</div>';
    return;
  }
  if(!ifc){ $('declPanel').innerHTML = '<div class="err-box">Kein Baustein gefunden.</div>'; return; }
  PS.rows = ifc.rows.map(r => Object.assign({}, r));
  const secs = SEC_BY_KIND[ifc.kind] || SEC_BY_KIND.FB;
  const udts = PS.t.project.blocks.filter(x => x.kind === 'UDT' || x.kind === 'FB').map(x => '"' + x.name + '"');
  let h = '<div class="decl-head"><i class="fa-solid ' + (KIND_ICON[ifc.kind] || 'fa-file') + '"></i> Schnittstelle von <code>"' + esc(ifc.name) + '"</code>' + (ifc.kind === 'FC' ? ' <span class="decl-sub">Rückgabewert: ' + esc(ifc.ret || '?') + '</span>' : '') + '</div>';
  h += '<datalist id="declTypes">' + TYPE_SUGGEST.concat(udts).map(x => '<option value="' + esc(x) + '">').join('') + '</datalist>';
  h += '<table class="decl-table edit"><thead><tr><th>Bereich</th><th>Name</th><th>Datentyp</th><th>Startwert</th><th>Kommentar</th><th></th></tr></thead><tbody>';
  PS.rows.forEach((r, i) => {
    h += '<tr data-i="' + i + '" class="sec-' + r.sec + '"><td><select data-f="sec" aria-label="Bereich">' + secs.map(s => '<option' + (s === r.sec ? ' selected' : '') + ' value="' + s + '">' + SEC_LABEL[s] + '</option>').join('') + '</select></td>'
      + '<td><input data-f="name" value="' + esc(r.name) + '" aria-label="Name" placeholder="Name" spellcheck="false"></td>'
      + '<td><input data-f="type" value="' + esc(r.type) + '" list="declTypes" aria-label="Datentyp" placeholder="Datentyp" spellcheck="false"></td>'
      + '<td><input data-f="init" value="' + esc(r.init) + '" aria-label="Startwert" placeholder="Startwert" spellcheck="false"></td>'
      + '<td><input data-f="comment" value="' + esc(r.comment) + '" aria-label="Kommentar" placeholder="Kommentar"></td>'
      + '<td><button class="tool-btn del" data-del="' + i + '" title="Zeile löschen" aria-label="Zeile löschen"><i class="fa-solid fa-trash"></i></button></td></tr>';
  });
  h += '</tbody></table><div class="decl-actions"><button class="tool-btn" id="declAddBtn"><i class="fa-solid fa-plus"></i> Zeile hinzufügen</button><span class="decl-msg" id="declMsg">' + (msg || 'Änderungen werden sofort in den Quelltext übernommen.') + '</span></div>';
  $('declPanel').innerHTML = h;
}
function applyDeclTable(){
  const b = proBlock(PS.active);
  const rows = [...$('declPanel').querySelectorAll('tbody tr[data-i]')].map(tr => {
    const o = {}; tr.querySelectorAll('[data-f]').forEach(inp => o[inp.dataset.f] = inp.value.trim()); return o;
  }).filter(r => r.name || r.type);
  for(const r of rows){
    const m = PRO.checkTableRow(r);
    if(m){ $('declMsg').innerHTML = '<span class="bad"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(m) + '</span>'; return false; }
  }
  try{ PS.codes[b.name] = PRO.writeInterface(PS.codes[b.name], rows); }
  catch(e){ $('declMsg').innerHTML = '<span class="bad">' + esc(e.message) + '</span>'; return false; }
  saveProDraft(); kopProSymbols();
  $('declMsg').innerHTML = '<span class="good"><i class="fa-solid fa-check"></i> In den Quelltext übernommen.</span>';
  liveCheckPro();
  return true;
}
$('declPanel').addEventListener('change', e => { if(PS && PS.view === 'table' && e.target.closest('[data-f]')) applyDeclTable(); });
$('declPanel').addEventListener('click', e => {
  if(!PS || PS.view !== 'table') return;
  const del = e.target.closest('[data-del]');
  if(del){ del.closest('tr').remove(); if(applyDeclTable()) renderDeclTable(); return; }
  if(e.target.closest('#declAddBtn')){
    const b = proBlock(PS.active), secs = SEC_BY_KIND[b.kind] || SEC_BY_KIND.FB;
    const tb = $('declPanel').querySelector('tbody');
    const tr = document.createElement('tr'); tr.dataset.i = 'n';
    tr.innerHTML = '<td><select data-f="sec">' + secs.map(s => '<option value="' + s + '">' + SEC_LABEL[s] + '</option>').join('') + '</select></td><td><input data-f="name" placeholder="Name" spellcheck="false"></td><td><input data-f="type" value="Bool" list="declTypes" spellcheck="false"></td><td><input data-f="init" placeholder="Startwert"></td><td><input data-f="comment" placeholder="Kommentar"></td><td><button class="tool-btn del" data-del="n" aria-label="Zeile löschen"><i class="fa-solid fa-trash"></i></button></td>';
    tb.appendChild(tr); tr.querySelector('[data-f="name"]').focus();
    $('declMsg').textContent = 'Name eingeben — die Zeile wird übernommen, sobald sie gültig ist.';
  }
});
function proErrText(e){ return (e.block ? '[' + e.block + '] ' : '') + 'Zeile ' + (e.line || '?') + ': ' + e.message; }
function liveCheckPro(){
  const st = $('editorStatus'); if(!PS) return;
  let prog;
  try{ prog = PT.compile(PS.t, PS.codes); }
  catch(e){
    if(!(e instanceof PRO.SCLError)){ st.className = 'editor-status warn'; st.textContent = e.message; return; }
    st.className = 'editor-status warn'; st.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + esc(proErrText(e));
    PS.lastErrBlock = e.block || null; renderProTabs();
    if(PS.view === 'code' && e.block === PS.active && e.line) editor.setErrorMark(e.line, e.col, e.message, true); else editor.setErrorMark(0);
    return;
  }
  editor.setErrorMark(0);
  if(PS.lastErrBlock){ PS.lastErrBlock = null; renderProTabs(); }
  const w = prog.warnings;
  if(w.length){ st.className = 'editor-status wmsg'; st.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Übersetzt mit ' + w.length + ' Warnung' + (w.length > 1 ? 'en' : '') + ' — ' + esc('[' + (w[0].unit || w[0].block) + ' Z' + w[0].line + '] ' + w[0].title); }
  else { st.className = 'editor-status ok'; st.innerHTML = '<i class="fa-solid fa-circle-check"></i> Projekt übersetzt ohne Fehler und Warnungen — mit Strg+Enter testen.'; }
}
function compilePro(t){
  SCENE.stopTimeline(); SFX.compile();
  editor.setErrorLine(0);
  if(PS.view === 'table' && !applyDeclTable()){ flashEditor(false); return; }
  let ev;
  try{ ev = PT.evaluate(t, PS.codes); }
  catch(e){
    if(!(e instanceof PRO.SCLError)) throw e;
    registerFail(t); flashEditor(false); SFX.fail();
    PS.lastErrBlock = e.block || null;
    if(e.block && proBlock(e.block)){ PS.view = 'code'; showProBlock(e.block); }
    editor.setErrorMark(e.line, e.col, e.message);
    SCENE.showFault('Compiler-Fehler');
    renderError(Object.assign(Object.create(Object.getPrototypeOf(e)), e, { message: e.message }), 'Compiler-Fehler' + (e.block ? ' in "' + e.block + '"' : ''));
    if((S.fails[t.id]||0) % 2 === 1) aria(pick(ARIA_QUIPS));
    return;
  }
  session.lastRun = ev;
  if(ev.ok){ onSuccess(t, Object.assign({}, PS.codes), ev); return; }
  registerFail(t); flashEditor(false); SFX.fail();
  const f = ev.res.failed;
  if(f && f.error){ if(f.error.block && f.error.block === PS.active) editor.setErrorLine(f.error.line); SCENE.showFault('Laufzeitfehler'); }
  renderProReport(t, ev);
  playRunPro(t, ev, false);
  if((S.fails[t.id]||0) % 2 === 1) aria(pick(ARIA_QUIPS));
}
function envGet(env, k){
  if(!env) return undefined;
  if(k in env) return env[k];
  const parts = String(k).replace(/"/g, '').split('.');
  let v = env;
  for(const p of parts){
    const m = /^(\w+)\[(\d+)\]$/.exec(p);
    if(m){ v = v && v[m[1]]; if(!Array.isArray(v)) return undefined; return '[…]'; }
    if(!v || typeof v !== 'object') return undefined;
    const key = Object.keys(v).find(x => x.toLowerCase() === p.toLowerCase());
    if(key === undefined) return undefined;
    v = v[key];
  }
  return v;
}
function traceTableFor(tc, rc){
  const inputs = [], outputs = [];
  Object.keys(tc.setup||{}).forEach(k => { if(!inputs.includes(k)) inputs.push(k); });
  tc.steps.forEach(s => { Object.keys(s.inputs||{}).forEach(k => { if(!inputs.includes(k)) inputs.push(k); }); Object.keys(s.expect||{}).forEach(k => { if(!outputs.includes(k)) outputs.push(k); }); });
  const steps = rc.steps, nAll = tc.steps.length;
  const cell = (v, extra, cls) => {
    if(v !== null && typeof v === 'object') v = Array.isArray(v) ? '[…]' : '{…}';
    const b = typeof v === 'boolean';
    return '<td data-col="' + extra + '" class="' + (b ? (v ? 'b1' : 'b0') : (v === undefined ? '' : 'num')) + (cls ? ' ' + cls : '') + '">' + (v === undefined ? '' : (b ? (v ? '1' : '0') : esc(fmtVal(v)))) + '</td>';
  };
  let h = '<div class="trace-wrap"><table class="trace"><thead><tr><th class="sig">Signal</th>';
  for(let i = 0; i < nAll; i++){ const s = steps[i]; h += '<th data-col="' + i + '" class="' + (i === steps.length - 1 && !rc.pass ? 'failcol' : '') + '">' + (s ? 't=' + fmtVal(s.t) : '…') + '</th>'; }
  h += '</tr></thead><tbody>';
  if(inputs.length){
    h += '<tr class="grp"><td colspan="' + (nAll+1) + '">Eingänge</td></tr>';
    inputs.forEach(k => { h += '<tr><td class="sig" title="' + esc(k) + '">' + esc(k) + '</td>'; for(let i = 0; i < nAll; i++){ const s = steps[i]; h += s ? cell(envGet(s.env, k), i) : '<td></td>'; } h += '</tr>'; });
  }
  h += '<tr class="grp"><td colspan="' + (nAll+1) + '">Ausgänge — Ist / Soll</td></tr>';
  outputs.forEach(k => {
    h += '<tr><td class="sig" title="' + esc(k) + '">' + esc(k) + ' <span style="color:var(--text-faint)">ist</span></td>';
    for(let i = 0; i < nAll; i++){
      const s = steps[i]; if(!s){ h += '<td></td>'; continue; }
      const chk = s.checks.find(c => c.name === k);
      h += cell(chk ? chk.actual : envGet(s.env, k), i, chk && !chk.pass ? 'bad' : '');
    }
    h += '</tr><tr><td class="sig" style="color:var(--text-faint)">' + esc(k) + ' soll</td>';
    for(let i = 0; i < nAll; i++){
      const e = tc.steps[i].expect || {};
      if(!(k in e)){ h += '<td></td>'; continue; }
      let v = e[k]; if(v !== null && typeof v === 'object') v = Array.isArray(v) ? '[…]' : '{…}';
      const b = typeof v === 'boolean';
      h += '<td data-col="' + i + '" class="' + (b ? (v ? 'exp1' : 'exp0') : 'num') + '">' + (b ? (v ? '1' : '0') : esc(fmtVal(v))) + '</td>';
    }
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}
function checkText(c){ return '<code>' + esc(c.name) + '</code> ist <b>' + esc(fmtVal(c.actual)) + '</b>, erwartet <b>' + esc(fmtVal(c.expected)) + '</b>'; }
function renderProReport(t, ev){
  $('reportCard').style.display = ''; $('successCard').style.display = 'none';
  const res = ev.res;
  let h = '<div class="report-summary">';
  const PART = { unit:'Baustein-Test', tests:'Programmtest', timed:'Zeitverlauf' };
  res.parts.forEach(p => { h += '<span class="pill ' + (p.ok ? 'pill-ok' : 'pill-err') + '"><i class="fa-solid ' + (p.ok ? 'fa-check' : 'fa-xmark') + '"></i> ' + PART[p.kind] + '</span>'; });
  if(ev.prog.warnings.length) h += '<span class="pill pill-warn"><i class="fa-solid fa-circle-exclamation"></i> ' + ev.prog.warnings.length + ' Warnung' + (ev.prog.warnings.length > 1 ? 'en' : '') + '</span>';
  h += '<button class="tool-btn observe-btn" id="observeBtn"><i class="fa-solid fa-eye"></i> Beobachten</button></div>';
  res.parts.forEach(p => {
    if(p.ok && !(p === res.parts[0] && res.ok)) return;   // bestandene Teile nur im Erfolgsfall zeigen
    const rc = p.failedCase || p.report[0]; if(!rc) return;
    const idx = p.report.indexOf(rc);
    if(p.kind === 'tests'){
      const passed = p.report.filter(r => r.pass).length;
      h += '<div class="report-note"><b>' + PART.tests + '</b> — ' + passed + '/' + p.report.length + ' Testfälle bestanden</div><table class="tc-table"><thead><tr><th>#</th><th>Startwerte</th><th>Ergebnis</th><th class="st"></th></tr></thead><tbody>';
      p.report.forEach((r, i) => {
        const inputs = Object.keys(r.setup||{}).map(k => kv(k, Array.isArray(r.setup[k]) ? '[…]' : r.setup[k])).join('') || '<span class="kv"><span class="k">Startwerte der Aufgabe</span></span>';
        const out = r.error ? '<span style="color:#ff8a8a">' + esc(proErrText(r.error)) + '</span>' : r.checks.map(c => { const a = (c.actual !== null && typeof c.actual === 'object') ? (Array.isArray(c.actual) ? '[' + c.actual.map(fmtVal).join(', ') + ']' : JSON.stringify(c.actual)) : c.actual; const x = (c.expected !== null && typeof c.expected === 'object') ? (Array.isArray(c.expected) ? '[' + c.expected.map(fmtVal).join(', ') + ']' : JSON.stringify(c.expected)) : c.expected; return c.pass ? kv(c.name, a, 'good') : '<span class="kv bad"><span class="k">' + esc(c.name) + '</span>=<span class="v">' + esc(fmtVal(a)) + '</span><span class="exp">→ soll ' + esc(fmtVal(x)) + '</span></span>'; }).join('');
        h += '<tr data-row="' + i + '" class="' + (r.pass ? '' : 'fail') + '"><td>' + (i+1) + '</td><td>' + inputs + '</td><td>' + out + '</td><td class="st"><i class="fa-solid ' + (r.pass ? 'fa-check' : 'fa-xmark') + '"></i></td></tr>';
      });
      h += '</tbody></table>';
      return;
    }
    const tc = (p.kind === 'unit' ? t.unit : t.timed)[idx];
    h += '<div class="report-note"><b>' + PART[p.kind] + '</b>' + (p.kind === 'unit' ? ' — Baustein <code>"' + esc(rc.block) + '"</code> isoliert über seine Schnittstelle' : ' — ganzes Programm (OB100 → OB1 je Zyklus)') + (p.report.length > 1 || (tc && (p.kind === 'unit' ? t.unit : t.timed).length > 1) ? ' · Ablauf ' + (idx+1) : '') + '</div>';
    h += traceTableFor(tc, rc);
    if(rc.error) h += '<div class="err-box" style="margin-top:10px"><span class="err-line">LAUFZEITFEHLER' + (rc.error.block ? ' · ' + esc(rc.error.block) : '') + ' · ZEILE ' + rc.error.line + '</span>' + esc(rc.error.message) + '</div>';
    else if(!rc.pass){
      const st = rc.steps[rc.steps.length - 1], bad = st.checks.filter(c => !c.pass);
      h += '<div class="report-note"><i class="fa-solid fa-circle-exclamation" style="color:var(--accent-red)"></i> Bei <b>t = ' + fmtVal(st.t) + ' s</b> (Zyklus ' + rc.steps.length + '): ' + bad.map(c => c.pathError ? '<code>' + esc(c.name) + '</code>: ' + esc(c.pathError) : checkText(c)).join(', ') + '.</div>';
    }
  });
  if(ev.missing.length) h += '<div class="err-box" style="margin-top:12px"><span class="err-line">ANFORDERUNG NICHT ERFÜLLT</span>Die Aufgabe verlangt ausdrücklich ' + ev.missing.map(m => '<b>' + esc(CONSTRUCT_NAMES[m]||m) + '</b>').join(', ') + '.</div>';
  if(ev.warnHits.length) h += '<div class="err-box warnbox" style="margin-top:12px"><span class="err-line">DIESE WARNUNG MUSS VERSCHWINDEN</span>' + ev.warnHits.map(w => '<div>[' + esc(w.unit || w.block) + ' · Zeile ' + w.line + '] ' + esc(w.msg) + '</div>').join('') + '</div>';
  const other = ev.prog.warnings.filter(w => !ev.warnHits.includes(w));
  if(other.length) h += '<details class="warn-list"' + (res.ok ? '' : ' open') + '><summary><i class="fa-solid fa-circle-exclamation"></i> Compiler-Warnungen (' + other.length + ')</summary>' + other.map(w => '<div class="warn-item"><b>' + esc(w.title) + '</b> <span class="wloc">[' + esc(w.unit || w.block) + ' · Z' + w.line + ']</span><br>' + esc(w.msg) + '</div>').join('') + '</details>';
  if(!ev.res.ok) h += diagnoseHTML(t, ev, Object.values(PS.codes).join('\n'));
  if(!ev.ok) h += reportHint();
  $('reportTitle').textContent = ev.ok ? 'Testbericht — bestanden' : 'Testbericht';
  $('reportBody').innerHTML = h;
  $('observeBtn').addEventListener('click', openObserve);
  $('reportCard').scrollIntoView({ behavior: S.settings.motion ? 'auto' : 'smooth', block:'nearest' });
}
function playRunPro(t, ev, ok, done){
  const res = ev.res, speed = S.settings.speed || 1, frames = [];
  const part = (res.failed && res.failed.kind !== 'unit' ? res.failed : null) || res.parts.find(p => p.kind === 'timed') || res.parts.find(p => p.kind === 'tests');
  if(part && part.kind === 'timed'){
    const rc = part.failedCase || part.report[0];
    if(rc && rc.steps){ const ms = Math.round((rc.steps.length > 12 ? 420 : 620) * speed); rc.steps.forEach((s, i) => frames.push({ env:s.env, label:'t = ' + fmtVal(s.t) + ' s · Zyklus ' + (i+1) + '/' + rc.steps.length, ms })); }
  } else if(part){
    const upto = part.failedCase ? part.report.indexOf(part.failedCase) + 1 : part.report.length;
    part.report.slice(0, upto).forEach((r, i) => { if(r.env) frames.push({ env:r.env, label:'Testfall ' + (i+1) + '/' + part.report.length + (r.pass ? ' ✓' : ' ✗'), ms: Math.round(850*speed) }); });
  }
  SCENE.playTimeline(t.sceneBindings, frames, 600, () => { SCENE.flashResult(ok); if(done) setTimeout(done, 350); }, i => {
    document.querySelectorAll('#reportBody .trace .cur').forEach(c => c.classList.remove('cur'));
    document.querySelectorAll('#reportBody .trace [data-col="' + i + '"]').forEach(c => c.classList.add('cur'));
  });
}
/* ---- Beobachten ---- */
let OBS = null;
function openObserve(){
  const t = session.task, ev = session.lastRun; if(!t || !t.pro || !ev || !ev.prog) return;
  const cases = [];
  t.unit.forEach((u, i) => cases.push({ kind:'unit', i, label:'Baustein-Test "' + u.block + '"' + (t.unit.length > 1 ? ' #' + (i+1) : ''), tc:u }));
  t.timed.forEach((u, i) => cases.push({ kind:'timed', i, label:'Zeitverlauf' + (t.timed.length > 1 ? ' #' + (i+1) : ''), tc:u }));
  t.tests.forEach((u, i) => cases.push({ kind:'tests', i, label:'Programmtest #' + (i+1), tc:{ setup:u.setup, steps:[{ dt:0, inputs:{}, expect:u.expect }] } }));
  if(!cases.length) return;
  let sel = 0;
  const f = ev.res.failed;
  if(f){ const fc = f.failedCase, idx = f.report.indexOf(fc); const c = cases.findIndex(c => c.kind === f.kind && c.i === idx); if(c >= 0) sel = c; }
  OBS = { cases, sel, step:0, runs:{} };
  runObserveCase();
  openModal('observeModal');
}
function runObserveCase(){
  const t = session.task, ev = session.lastRun, c = OBS.cases[OBS.sel];
  if(!OBS.runs[OBS.sel]){
    let r;
    try{
      if(c.kind === 'unit') r = PRO.runUnitTests(ev.prog, [c.tc], { trace:true, all:true });
      else r = PRO.runProgramTimed(ev.prog, [c.tc], { trace:true, all:true });
    }catch(e){ r = { report:[{ steps:[], error:e }] }; }
    OBS.runs[OBS.sel] = r.report[0];
  }
  const rc = OBS.runs[OBS.sel];
  OBS.step = Math.max(0, Math.min(OBS.step, rc.steps.length - 1));
  renderObserve();
}
// KOP: Netzwerke des aufgerufenen Bausteins mit dem Stromfluss am Ende dieses Aufrufs
function obsLadder(rec){
  if(rec.builtin || !PS) return '';
  const b = PS.t.project.blocks.find(x => x.name === rec.unit); if(!b) return '';
  const fr = window.KOP.splitBlock(proCode(b)); if(!fr || !window.KOP.isKopBody(fr.body) || !fr.body.trim()) return '';
  const env = {}; rec.vars.forEach(v => { if(/^_f\d+_\d+$/.test(v.name)) env[v.name] = v.value; else if(!v.fb) env['#' + v.name] = v.value; });
  return '<details class="obs-kop"' + (rec.depth === 0 || rec.kind !== 'OB' ? ' open' : '') + '><summary>Netzwerke mit ' + (FUPMODE ? 'Signalzuständen' : 'Stromfluss') + '</summary>' + window.KOPEditor.renderStatic(fr.body, env) + '</details>';
}
// AWL: Anweisungen des aufgerufenen Bausteins mit VKE/AKKU-Status am Ende dieses Aufrufs
function obsAWL(rec){
  if(rec.builtin || !PS) return '';
  const b = PS.t.project.blocks.find(x => x.name === rec.unit); if(!b) return '';
  const sp = window.AWL.splitBlock(proCode(b)); if(!sp || !sp.body.trim()) return '';
  let tr = null; try{ const prog = PT.compile(PS.t, PS.codes); tr = prog.awlBlocks && prog.awlBlocks[b.name]; }catch(e){}
  if(!tr) return '';
  const env = {}; rec.vars.forEach(v => { if(/^_q/.test(v.name)) env[v.name] = v.value; });
  return '<details class="obs-kop"' + (rec.depth === 0 || rec.kind !== 'OB' ? ' open' : '') + '><summary>Anweisungen mit Status (VKE, AKKU1, AKKU2)</summary>' + window.AWLEditor.renderStatic(sp.body, window.AWL.statusOf(tr, env), sp.offset) + '</details>';
}
function renderObserve(){
  const rc = OBS.runs[OBS.sel], n = rc.steps.length;
  let ctl = '<label class="obs-sel">Ablauf <select id="obsCase">' + OBS.cases.map((c, i) => '<option value="' + i + '"' + (i === OBS.sel ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') + '</select></label>';
  if(n) ctl += '<label class="obs-slider">Zyklus <input type="range" id="obsStep" min="0" max="' + (n-1) + '" value="' + OBS.step + '"> <span id="obsStepLabel">' + (OBS.step+1) + '/' + n + ' · t = ' + fmtVal(rc.steps[OBS.step].t) + ' s</span></label>'
    + '<button class="tool-btn" id="obsPrev" aria-label="Vorheriger Zyklus"><i class="fa-solid fa-backward-step"></i></button><button class="tool-btn" id="obsNext" aria-label="Nächster Zyklus"><i class="fa-solid fa-forward-step"></i></button>';
  $('observeControls').innerHTML = ctl;
  $('obsCase').addEventListener('change', e => { OBS.sel = parseInt(e.target.value, 10); OBS.step = 0; runObserveCase(); });
  if(n){
    $('obsStep').addEventListener('input', e => { OBS.step = parseInt(e.target.value, 10); renderObserve(); });
    $('obsPrev').addEventListener('click', () => { if(OBS.step > 0){ OBS.step--; renderObserve(); } });
    $('obsNext').addEventListener('click', () => { if(OBS.step < n - 1){ OBS.step++; renderObserve(); } });
  }
  let h = '';
  if(rc.error && !n) h += '<div class="err-box">' + esc(rc.error.message) + '</div>';
  if(n){
    const st = rc.steps[OBS.step], prev = OBS.step > 0 ? rc.steps[OBS.step - 1] : null;
    const ins = Object.keys(st.inputs || {});
    if(ins.length) h += '<div class="obs-inputs"><b>Eingänge in diesem Zyklus:</b> ' + ins.map(k => kv(k, st.inputs[k])).join('') + '</div>';
    const bad = (st.checks || []).filter(c => !c.pass);
    if(bad.length) h += '<div class="report-note" style="color:#ffb3b3"><i class="fa-solid fa-circle-exclamation"></i> ' + bad.map(checkText).join(', ') + '</div>';
    (st.trace || []).forEach((rec, ri) => {
      const pr = prev && prev.trace ? prev.trace.find(x => x.label === rec.label && x.depth === rec.depth) : null;
      h += '<div class="obs-block" style="margin-left:' + (rec.depth * 18) + 'px"><div class="obs-title"><i class="fa-solid ' + (KIND_ICON[rec.kind] || 'fa-cube') + '"></i> <b>' + esc(rec.label) + '</b>' + (rec.kind !== 'OB' && rec.label.replace(/"/g, '') !== rec.unit ? ' : <span class="obs-type">' + esc(rec.builtin ? rec.unit : '"' + rec.unit + '"') + '</span>' : '') + ' <span class="obs-kind">' + rec.kind + '</span></div><div class="obs-vars">';
      rec.vars.forEach(v => {
        if(KOPMODE && /^_[fe]\d+_\d+$/.test(v.name)) return;   // Hilfsvariablen der KOP-Übersetzung
        if(AWLMODE && /^_q/.test(v.name)) return;               // Hilfsvariablen der AWL-Übersetzung
        if(v.fb) { h += '<span class="obs-var inst"><span class="n">' + esc(v.name) + '</span><span class="v">' + esc(v.fb) + '</span></span>'; return; }
        const old = pr ? (pr.vars.find(x => x.name === v.name) || {}).value : undefined;
        const changed = pr && JSON.stringify(old) !== JSON.stringify(v.value);
        const cls = v.sec === 'Static' ? 'stat' : v.sec === 'Temp' ? 'temp' : 'io';
        let val = v.value; if(val !== null && typeof val === 'object') val = Array.isArray(val) ? '[' + val.map(x => typeof x === 'object' ? '{…}' : fmtVal(x)).join(', ') + ']' : '{' + Object.keys(val).map(k => k + ':' + fmtVal(val[k])).join(', ') + '}';
        h += '<span class="obs-var ' + cls + (changed ? ' changed' : '') + '" title="' + esc(v.sec + ' · ' + v.type) + '"><span class="n">' + esc(v.name) + '</span><span class="sec">' + (v.sec === 'Static' ? 'STAT' : v.sec.toUpperCase()) + '</span><span class="v">' + esc(fmtVal(val)) + '</span></span>';
      });
      h += '</div>' + (KOPMODE ? obsLadder(rec) : AWLMODE ? obsAWL(rec) : '') + '</div>';
    });
    if(!(st.trace || []).length) h += '<div class="report-note">Keine Bausteinaufrufe in diesem Zyklus.</div>';
  }
  $('observeBody').innerHTML = h;
}

/* ---------- Theorie ---------- */
let TH = null;
function shuffle(a){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function openTheory(th, review){
  $('app').style.display = 'none';
  $('theoryOverlay').style.display = 'flex';
  const done = S.doneTheory[th.id];
  TH = { th, review:!!review, mode:'lesson', attempt:(done ? done.attempts : 0) };
  $('theoryEyebrow').textContent = 'Theorie-Auftrag · Kapitel ' + th.ch + (th.pos === 'start' ? ' · Teil A' : ' · Teil B') + (review ? ' · Wiederholung' : '');
  $('theoryTitle').textContent = th.title;
  renderLesson();
  $('theoryOverlay').scrollTop = 0;
}
function renderLesson(){
  TH.mode = 'lesson';
  $('theoryLessonBtn').style.display = 'none';
  $('theoryProgress').innerHTML = '';
  $('theoryBody').innerHTML = '<div class="q-type"><i class="fa-regular fa-clock"></i> ca. ' + (TH.th.minutes||4) + ' Minuten Lesezeit</div>' + TH.th.lesson;
  highlightBlocks($('theoryBody'));
  $('theoryBody').scrollTop = 0;
  $('theoryFoot').innerHTML = '<span class="grow">Danach: ' + TH.th.questions.length + ' Fragen · bestanden ab ' + Math.ceil(TH.th.questions.length*0.8) + ' richtigen</span>'
    + (TH.review ? '<button class="btn" id="thCloseBtn"><i class="fa-solid fa-xmark"></i> Schliessen</button>' : '')
    + '<button class="compile-btn" id="thStartQuiz"><i class="fa-solid fa-list-check"></i> Zum Verständnis-Check</button>';
  $('thStartQuiz').addEventListener('click', startQuiz);
  if($('thCloseBtn')) $('thCloseBtn').addEventListener('click', closeReview);
  $('thStartQuiz').focus();
}
function highlightBlocks(root){ root.querySelectorAll('pre.code').forEach(p => { if(!/[‾\/]{3}/.test(p.textContent)) p.innerHTML = window.SCLEditor.highlight(p.textContent); });
  if(SENSORMODE && window.SensorLessons) window.SensorLessons.mount(root);
  if(window.KOPEditor) root.querySelectorAll('pre.kop').forEach(p => { const d = document.createElement('div'); d.innerHTML = window.KOPEditor.renderStatic(p.textContent); p.replaceWith(d.firstChild); }); }
function closeReview(){ $('theoryOverlay').style.display = 'none'; $('app').style.display = ''; if(!session.task) goToPos(); }
function startQuiz(){
  SFX.click();
  TH.mode = 'quiz'; TH.attempt++;
  TH.order = shuffle(TH.th.questions.map((_, i) => i));
  TH.perms = TH.order.map(qi => { const q = TH.th.questions[qi]; return q.options ? shuffle(q.options.map((_, i) => i)) : null; });
  TH.results = []; TH.i = 0;
  $('theoryLessonBtn').style.display = '';
  renderQuestion();
}
$('theoryLessonBtn').addEventListener('click', () => {
  if(TH.mode !== 'quiz') return;
  const cur = { ...TH };
  $('theoryBody').innerHTML = TH.th.lesson; highlightBlocks($('theoryBody')); $('theoryBody').scrollTop = 0;
  $('theoryFoot').innerHTML = '<button class="compile-btn" id="thBackQ"><i class="fa-solid fa-arrow-right"></i> Zurück zur Frage</button>';
  $('thBackQ').addEventListener('click', () => { Object.assign(TH, cur); renderQuestion(true); });
});
$('theoryManualBtn').addEventListener('click', () => openManual());
function renderProgressDots(){
  $('theoryProgress').innerHTML = TH.order.map((_, i) => '<span class="qdot ' + (i < TH.results.length ? (TH.results[i] ? 'ok' : 'bad') : (i === TH.i ? 'cur' : '')) + '"></span>').join('');
}
function renderQuestion(keepAnswer){
  renderProgressDots();
  const qi = TH.order[TH.i], q = TH.th.questions[qi], perm = TH.perms[TH.i];
  const typeLabel = q.type === 'multi' ? 'Mehrfachauswahl — alle richtigen ankreuzen' : q.type === 'input' ? 'Antwort eintippen' : 'Eine Antwort ist richtig';
  let h = '<div class="q-type">Frage ' + (TH.i+1) + ' von ' + TH.order.length + ' · ' + typeLabel + '</div><div class="q-text">' + q.q + '</div>';
  if(q.code) h += '<pre class="code">' + window.SCLEditor.highlight(q.code) + '</pre>';
  if(q.kop) h += window.KOPEditor.renderStatic(q.kop);
  if(q.type === 'input'){
    h += '<div class="q-input-row"><input class="text-input" id="qInput" autocomplete="off" placeholder="Deine Antwort" aria-label="Antwort"></div>';
  } else {
    h += '<div class="q-options" role="' + (q.type === 'multi' ? 'group' : 'radiogroup') + '">' + perm.map(oi => '<button class="q-opt' + (q.type === 'multi' ? ' multi' : '') + '" data-oi="' + oi + '" role="' + (q.type === 'multi' ? 'checkbox' : 'radio') + '" aria-checked="false"><span class="mark"></span><span>' + q.options[oi].replace(/^([^<]*)$/, s => /[;:=]/.test(s) && s.length < 90 ? '<code>' + esc(s) + '</code>' : esc(s)) + '</span></button>').join('') + '</div>';
  }
  h += '<div id="qFeedback"></div>';
  $('theoryBody').innerHTML = h; $('theoryBody').scrollTop = 0;
  $('theoryFoot').innerHTML = '<span class="grow" id="qHintLine"></span><button class="compile-btn" id="qCheck" disabled><i class="fa-solid fa-check"></i> Prüfen</button>';
  const check = $('qCheck');
  if(q.type === 'input'){
    const inp = $('qInput'); inp.focus();
    inp.addEventListener('input', () => { check.disabled = !inp.value.trim(); });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter' && !check.disabled) check.click(); });
  } else {
    document.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => {
      if(b.disabled) return;
      if(q.type === 'single') document.querySelectorAll('.q-opt').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-checked','false'); });
      b.classList.toggle('sel'); b.setAttribute('aria-checked', String(b.classList.contains('sel')));
      check.disabled = !document.querySelector('.q-opt.sel');
      SFX.click();
    }));
    const first = document.querySelector('.q-opt'); if(first) first.focus();
  }
  check.addEventListener('click', () => evaluateQuestion(q));
}
function normAns(s){ return String(s).trim().toLowerCase().replace(/\s+/g, '').replace(/^\[|\]$/g, '').replace(/%$/, ''); }
function evaluateQuestion(q){
  let ok = false;
  if(q.type === 'input'){
    const a = normAns($('qInput').value);
    ok = q.answer.some(x => { const n = normAns(x); if(n === a) return true; const num = /^-?\d+([.,]\d+)?$/; return num.test(n) && num.test(a) && Math.abs(parseFloat(n.replace(',','.')) - parseFloat(a.replace(',','.'))) < 1e-9; });
    $('qInput').disabled = true;
  } else {
    const sel = [...document.querySelectorAll('.q-opt.sel')].map(b => parseInt(b.dataset.oi, 10));
    const correct = q.type === 'multi' ? q.correct.slice().sort() : [q.correct];
    ok = sel.length === correct.length && sel.slice().sort().every((v, i) => v === correct[i]);
    document.querySelectorAll('.q-opt').forEach(b => { const oi = parseInt(b.dataset.oi, 10); b.disabled = true;
      if(correct.includes(oi)) b.classList.add('right'); else if(b.classList.contains('sel')) b.classList.add('wrong'); });
  }
  TH.results.push(ok);
  ok ? SFX.right() : SFX.wrong();
  renderProgressDots();
  const right = q.type === 'input' ? '<br>Richtige Antwort: <code>' + esc(q.answer[0]) + '</code>' : '';
  $('qFeedback').innerHTML = '<div class="q-feedback ' + (ok ? 'ok' : 'bad') + '"><b>' + (ok ? '✓ Richtig!' : '✗ Leider falsch.') + '</b>' + (q.explain || '') + (ok ? '' : right) + '</div>';
  const last = TH.i >= TH.order.length - 1;
  $('theoryFoot').innerHTML = '<span class="grow">' + TH.results.filter(Boolean).length + ' von ' + TH.results.length + ' richtig</span><button class="compile-btn" id="qNext"><i class="fa-solid fa-arrow-right"></i> ' + (last ? 'Auswertung' : 'Nächste Frage') + '</button>';
  $('qNext').focus();
  $('qNext').addEventListener('click', () => { if(last) renderResult(); else { TH.i++; renderQuestion(); } });
}
function renderResult(){
  TH.mode = 'result';
  const n = TH.results.length, k = TH.results.filter(Boolean).length, need = Math.ceil(n*0.8), pass = k >= need;
  $('theoryLessonBtn').style.display = 'none';
  let h = '<div class="result-big ' + (pass ? 'pass' : 'fail') + '"><div class="ring">' + k + ' / ' + n + '</div><p>' + (pass ? (k === n ? 'Perfekt! Alles richtig.' : 'Bestanden! Du bist bereit für die Praxis.') : 'Noch nicht ganz — ' + need + ' richtige Antworten sind nötig. Lies die Lektion nochmal und versuche es erneut.') + '</p></div>';
  h += '<div class="result-list">' + TH.order.map((qi, i) => '<div><i class="fa-solid ' + (TH.results[i] ? 'fa-check' : 'fa-xmark') + '"></i><span>' + TH.th.questions[qi].q.replace(/<[^>]+>/g, '') + '</span></div>').join('') + '</div>';
  $('theoryBody').innerHTML = h;
  let foot = '';
  if(pass){
    if(!TH.review){
      const prev = S.doneTheory[TH.th.id];
      const pts = TH.attempt === 1 ? (k === n ? 50 : 40) : 25;
      if(!prev) S.doneTheory[TH.th.id] = { score:k, n, attempts:TH.attempt, points:pts, at:Date.now() };
      if(TH.attempt === 1 && k === n){ S.theoryPerfect = (S.theoryPerfect||0) + 1; if(S.theoryPerfect >= 5) award('theorie_ass'); }
      save(); renderHeader();
      foot = '<span class="grow">+' + pts + ' Punkte</span><button class="compile-btn" id="thContinue"><i class="fa-solid fa-play"></i> Weiter zur Praxis</button>';
    } else foot = '<button class="compile-btn" id="thContinue"><i class="fa-solid fa-xmark"></i> Schliessen</button>';
    SFX.ok();
  } else {
    foot = '<button class="btn" id="thReread"><i class="fa-solid fa-book-open"></i> Lektion nochmal lesen</button><button class="compile-btn" id="thRetry"><i class="fa-solid fa-rotate-right"></i> Neuer Versuch</button>';
    SFX.fail();
  }
  $('theoryFoot').innerHTML = foot;
  if($('thContinue')) { $('thContinue').focus(); $('thContinue').addEventListener('click', () => { if(TH.review) closeReview(); else advance(); }); }
  if($('thRetry')){ $('thRetry').focus(); $('thRetry').addEventListener('click', startQuiz); $('thReread').addEventListener('click', renderLesson); }
}

/* ---------- Handbuch ---------- */
function buildManual(){
  $('manualNav').innerHTML = MANUAL.map(s => '<button class="manual-nav-item" data-id="' + s.id + '"><span class="manual-page-no">S.' + s.page + '</span>' + esc(s.title) + '</button>').join('');
  $('manualNav').querySelectorAll('.manual-nav-item').forEach(b => b.addEventListener('click', () => showManual(b.dataset.id)));
}
function showManual(id){
  const s = MANUAL.find(m => m.id === id) || MANUAL[0];
  $('manualContent').innerHTML = '<div class="manual-page-tag">Seite ' + s.page + '</div><h2>' + esc(s.title) + '</h2>' + s.html;
  highlightBlocks($('manualContent'));
  markManualQuery();
  $('manualNav').querySelectorAll('.manual-nav-item').forEach(b => b.classList.toggle('active', b.dataset.id === s.id));
  $('manualContent').scrollTop = 0;
}
function openManual(id){
  if(session.task && !session.solved && (S.fails[session.task.id]||0) === 0) session.manualClean = true;
  showManual(id || (session.task && session.task.manualId) || MANUAL[0].id);
  openModal('manualModal');
}
$('openManualBtn').addEventListener('click', () => openManual());
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('.hint-link');
  if(a){ e.preventDefault(); openManual(a.dataset.man); }
});

/* ---------- Karte ---------- */
function renderMap(){
  const nT = Object.keys(S.doneTasks).length, nTh = Object.keys(S.doneTheory).length;
  const stars = Object.values(S.doneTasks).reduce((a, d) => a + (d.stars||0), 0);
  $('mapSummary').innerHTML = '<div class="stat"><b>' + nT + '/' + TOTAL_TASKS + '</b>Aufgaben</div><div class="stat"><b>' + nTh + '/' + TOTAL_THEORY + '</b>Theorie</div><div class="stat"><b>' + stars + '/' + (TOTAL_TASKS*3) + '</b>Sterne</div><div class="stat"><b>' + totalScore() + '</b>Punkte</div><div class="stat"><b>' + S.badges.length + '/' + Object.keys(BADGES).length + '</b>Abzeichen</div>';
  const cur = SEQ[S.pos];
  let h = '';
  CHAPTERS.forEach(ch => {
    const items = SEQ.map((it, i) => ({ ...it, i })).filter(it => it.ch === ch.n);
    const reachable = items[0].i <= S.pos;
    const chStars = TASKS.filter(t => t.level === ch.n).reduce((a, t) => a + ((S.doneTasks[t.id]||{}).stars||0), 0);
    if(ch.n === 11) h += '<div class="map-stage"><i class="fa-solid fa-industry"></i> Profi-Stufe — Bausteine, Daten, Programmstruktur</div>';
    h += '<div class="map-level-row' + (reachable ? '' : ' locked') + (ch.pro ? ' pro' : '') + '"><div class="map-level-title"><span>Kapitel ' + ch.n + ' — ' + esc(ch.title) + ' <span class="sub">· ' + esc(ch.subtitle) + '</span></span><span class="chs">★ ' + chStars + '/30</span></div><div class="map-tasks">';
    items.forEach(it => {
      const isCur = cur && it.i === S.pos;
      if(it.type === 'theory'){
        const d = S.doneTheory[it.id], th = THEORY_BY_ID[it.id];
        h += '<button class="map-chip theory ' + (d ? 'done' : isCur ? 'current' : 'locked') + '" data-kind="theory" data-id="' + it.id + '" title="Theorie: ' + esc(th.title) + '" ' + (d || isCur ? '' : 'disabled') + '><i class="fa-solid fa-graduation-cap"></i></button>';
      } else {
        const t = TASK_BY_ID[it.id], d = S.doneTasks[it.id];
        h += '<button class="map-chip ' + (d ? 'done' : isCur ? 'current' : 'locked') + (t.isBoss ? ' bosschip' : '') + (t.isDebug ? ' debugchip' : '') + '" data-kind="task" data-id="' + it.id + '" title="' + TASK_NO[it.id] + ': ' + esc(t.title) + '" ' + (d || isCur ? '' : 'disabled') + '>'
          + (t.isFinal ? '<i class="fa-solid fa-skull"></i>' : TASK_NO[it.id]) + (d ? '<span class="mstars">' + '★'.repeat(d.stars||0) + '</span>' : '') + '</button>';
      }
    });
    h += '</div></div>';
  });
  $('mapGrid').innerHTML = reviewHTML() + h;
  $('mapGrid').querySelectorAll('.map-chip:not([disabled])').forEach(b => b.addEventListener('click', () => mapDetail(b.dataset.kind, b.dataset.id)));
}
function openMap(){ $('mapDetail').style.display = 'none'; $('mapGrid').style.display = 'flex'; $('mapSummary').style.display = ''; renderMap(); openModal('mapModal'); }
$('openMapBtn').addEventListener('click', openMap);
function solText(v){ if(!v) return ''; if(typeof v === 'string') return v; return Object.keys(v).map(k => v[k]).join('\n\n'); }
function mapDetail(kind, id){
  const cur = SEQ[S.pos], isCur = cur && cur.id === id;
  let h = '<button class="btn" id="mapBackBtn"><i class="fa-solid fa-arrow-left"></i> Zurück zur Karte</button>';
  if(kind === 'theory'){
    const th = THEORY_BY_ID[id], d = S.doneTheory[id];
    h += '<h2 style="margin:14px 0 4px">' + esc(th.title) + '</h2><div class="report-note">Theorie-Auftrag · Kapitel ' + th.ch + (d ? ' · ' + d.score + '/' + d.n + ' richtig · ' + d.attempts + ' Versuch(e)' : '') + '</div>'
      + '<div class="map-detail-actions">' + (isCur && !d ? '<button class="compile-btn" id="mdGo" style="width:auto;padding:10px 18px"><i class="fa-solid fa-play"></i> Jetzt bearbeiten</button>' : '<button class="btn" id="mdReview"><i class="fa-solid fa-book-open"></i> Lektion &amp; Quiz wiederholen</button>') + '</div>';
  } else {
    const t = TASK_BY_ID[id], d = S.doneTasks[id];
    h += '<h2 style="margin:14px 0 4px">' + TASK_NO[id] + '. ' + esc(t.title) + '</h2><div class="report-note">Kapitel ' + t.level + (d ? ' · <span class="stars" style="margin:0">' + starsHTML(d.stars) + '</span> · ' + d.points + ' Punkte · ' + d.fails + ' Fehlversuche · ' + d.hints + ' Hinweise' : ' · aktuelle Aufgabe') + '</div>'
      + '<div class="map-detail-actions">' + (isCur && !d ? '<button class="compile-btn" id="mdGo" style="width:auto;padding:10px 18px"><i class="fa-solid fa-play"></i> Zur Aufgabe</button>' : '<button class="btn" id="mdPractice"><i class="fa-solid fa-dumbbell"></i> Nochmal spielen (Training)</button>') + '</div>'
      + (d ? '<div class="report-note">Deine Lösung:</div>' + codeHTML(solText(S.solutions[id]) || '(nicht gespeichert)')
           + '<details style="margin-top:10px"><summary class="report-note" style="cursor:pointer">Referenzlösung vergleichen</summary>' + codeHTML(t.pro ? solText(PT.refCodes(t)) : t.refSolution) + '</details>'
           + '<button class="btn" id="mdDiff" style="margin-top:10px"><i class="fa-solid fa-code-compare"></i> Zeilenweise vergleichen</button>'
           + '<div class="takeaway" style="margin-top:12px"><b>Merke:</b> ' + t.takeaway + '</div>' : '');
  }
  $('mapDetail').innerHTML = h; $('mapGrid').style.display = 'none'; $('mapSummary').style.display = 'none'; $('mapDetail').style.display = 'block';
  $('mapBackBtn').addEventListener('click', () => { $('mapDetail').style.display = 'none'; $('mapGrid').style.display = 'flex'; $('mapSummary').style.display = ''; });
  if($('mdGo')) $('mdGo').addEventListener('click', () => { closeModal('mapModal'); goToPos(); });
  if($('mdPractice')) $('mdPractice').addEventListener('click', () => { closeModal('mapModal'); closeAllOverlays(); renderTask(TASK_BY_ID[id], true); });
  if($('mdDiff')) $('mdDiff').addEventListener('click', () => { closeModal('mapModal'); openDiff(TASK_BY_ID[id], S.solutions[id]); });
  if($('mdReview')) $('mdReview').addEventListener('click', () => { closeModal('mapModal'); openTheory(THEORY_BY_ID[id], true); });
}

/* ---------- Zertifikat ---------- */
function hashStr(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).toUpperCase(); }
async function showCertificate(mode){
  const basic = mode === 'basic';
  if(!S.name){ const n = await confirmBox('Glückwunsch! Wie soll dein Name auf dem Zertifikat stehen?', { input:true, placeholder:'Vor- und Nachname', yes:'Übernehmen', noCancel:true }); S.name = n || 'Unbekannter Automatiker'; }
  if(basic){ if(!S.basicAt) S.basicAt = Date.now(); }
  else if(!S.finishedAt) S.finishedAt = Date.now();
  save();
  $('certProBtn').style.display = basic ? '' : 'none';
  $('certText').innerHTML = basic
    ? 'die <b>Grundstufe</b> mit 10 Kapiteln, 100 Programmieraufgaben und 20 Theorie-Aufträgen in ' + Q.langLong + ' erfolgreich absolviert,<br>' + Q.basicText
    : 'die <b>Grund- und Profi-Stufe</b> mit 15 Kapiteln, 150 Programmieraufgaben und 30 Theorie-Aufträgen in ' + Q.langLong + ' erfolgreich absolviert hat —<br>' + Q.proText;
  $('app').style.display = 'none'; $('levelIntroOverlay').style.display = 'none'; $('theoryOverlay').style.display = 'none';
  $('certificate').style.display = 'block';
  const score = totalScore(), date = new Date(basic ? S.basicAt : S.finishedAt);
  $('certName').textContent = S.name;
  $('certDate').textContent = date.toLocaleDateString('de-CH', { year:'numeric', month:'long', day:'numeric' });
  const chs = CHAPTERS.filter(c => !basic || !c.pro), nT = TASKS.filter(x => !basic || !x.pro).length;
  $('certScore').textContent = score + ' Punkte · ★ ' + Object.keys(S.doneTasks).filter(k => !basic || !TASK_BY_ID[k] || !TASK_BY_ID[k].pro).reduce((a, k) => a + (S.doneTasks[k].stars||0), 0) + '/' + (nT*3);
  $('certId').textContent = (basic ? Q.certPrefix + 'G-' : Q.certPrefix + 'P-') + hashStr(S.name + '|' + score + '|' + (basic ? S.basicAt : S.finishedAt)).padStart(7, '0').slice(0,7);
  $('certSkills').innerHTML = chs.map(c => '<span>' + esc(c.subtitle) + '</span>').join('');
  $('certBadges').innerHTML = S.badges.length ? S.badges.map(id => '<div class="cert-badge-item"><span class="icon">' + BADGES[id].icon + '</span><span>' + BADGES[id].title + '</span></div>').join('') : '<span style="color:var(--text-faint);font-size:11px">Keine Sonderabzeichen</span>';
}
$('printCertBtn').addEventListener('click', () => window.print());
$('certProBtn').addEventListener('click', () => { S.basicCert = true; save(); $('certificate').style.display = 'none'; $('app').style.display = ''; SFX.click(); goToPos(); });
$('certBackBtn').addEventListener('click', () => { S.basicCert = true; save(); $('certificate').style.display = 'none'; $('app').style.display = ''; openMap(); });

/* ---------- Spielstand ---------- */
const OBF = Q.obf;
function xor(str){ let o = ''; for(let i = 0; i < str.length; i++) o += String.fromCharCode(str.charCodeAt(i) ^ OBF.charCodeAt(i % OBF.length)); return o; }
function exportSave(){
  const blob = new Blob([btoa(unescape(encodeURIComponent(xor(JSON.stringify(S)))))], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sclquest3_spielstand.json';
  document.body.appendChild(a); a.click(); a.remove();
  S.lastExportAt = Date.now(); S.doneSinceExport = 0; save();
  toast('💾', 'Spielstand exportiert', 'Die Datei kann auf einem anderen Gerät importiert werden.');
}
function importSave(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const obj = JSON.parse(xor(decodeURIComponent(escape(atob(String(r.result).trim())))));
      S = obj.v === 4 ? Object.assign(defaultState(), obj) : migrate(obj);
      S.settings = Object.assign(defaultSettings(), S.settings||{});
      save(); location.reload();
    }catch(e){ toast('⚠️', 'Import fehlgeschlagen', 'Die Datei ist kein gültiger ' + Q.name + '-Spielstand.'); }
  };
  r.readAsText(file);
}
$('exportSaveBtn').addEventListener('click', exportSave);
$('importSaveBtn').addEventListener('click', () => $('importSaveInput').click());
$('importSaveInput').addEventListener('change', e => { if(e.target.files[0]) importSave(e.target.files[0]); });
$('resetBtn').addEventListener('click', async () => {
  if(!await confirmBox('<b>Gesamten Fortschritt löschen?</b><br>Alle Aufgaben, Punkte und Abzeichen gehen verloren. Das kann nicht rückgängig gemacht werden.', { yes:'Alles löschen' })) return;
  const settings = S.settings; S = defaultState(); S.settings = settings;
  try{ localStorage.removeItem(OLD_KEY); }catch(e){}
  save(); closeModal('settingsModal'); $('radioLog').innerHTML = ''; SCENE.hardReset(); showTitle();
});

/* ---------- Tastatur ---------- */
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    ['confirmModal','diffModal','observeModal','manualModal','mapModal','settingsModal'].some(id => { if($(id).classList.contains('active')){ if(id === 'confirmModal') $('confirmNo').click(); else closeModal(id); return true; } return false; });
  }
});

/* ---------- Titelbildschirm ---------- */
function showTitle(){
  $('app').style.display = 'none'; $('certificate').style.display = 'none'; $('theoryOverlay').style.display = 'none'; $('levelIntroOverlay').style.display = 'none';
  $('titleScreen').style.display = 'flex';
  $('playerName').value = S.name || '';
  const has = Object.keys(S.doneTasks).length + Object.keys(S.doneTheory).length > 0 || S.seenIntro.length > 0;
  $('continueBtn').style.display = has ? '' : 'none';
  if(has){
    const it = SEQ[Math.min(S.pos, SEQ.length - 1)];
    $('continueText').textContent = S.pos >= SEQ.length ? 'Zertifikat ansehen' : 'Fortsetzen — Kapitel ' + it.ch + (it.type === 'task' ? ', Aufgabe ' + TASK_NO[it.id] : ', Theorie');
    $('newGameBtn').innerHTML = '<i class="fa-solid fa-plus"></i> Neues Spiel';
    $('continueBtn').focus();
  } else { $('newGameBtn').innerHTML = '<i class="fa-solid fa-play"></i> Spiel starten'; $('playerName').focus(); }
  $('newGameBtn').className = has ? 'btn big-btn' : 'compile-btn';
  if(S.migratedFrom === 'v1' && !S.migrationNoted){ S.migrationNoted = true; save(); toast('🔄', 'Spielstand übernommen', 'Deine gelösten Aufgaben aus der Vorversion wurden übernommen.'); }
}
$('continueBtn').addEventListener('click', () => { SFX.click(); S.name = $('playerName').value.trim() || S.name; save(); startGame(); });
$('newGameBtn').addEventListener('click', async () => {
  const has = Object.keys(S.doneTasks).length + Object.keys(S.doneTheory).length > 0;
  if(has && !await confirmBox('Neues Spiel beginnen? Dein bisheriger Fortschritt wird gelöscht.', { yes:'Neu beginnen' })) return;
  const settings = S.settings; S = defaultState(); S.settings = settings; S.name = $('playerName').value.trim();
  save(); SCENE.hardReset(); $('radioLog').innerHTML = ''; SFX.click(); startGame();
});
$('playerName').addEventListener('keydown', e => { if(e.key === 'Enter') ($('continueBtn').style.display !== 'none' ? $('continueBtn') : $('newGameBtn')).click(); });
function startGame(){
  $('titleScreen').style.display = 'none'; $('app').style.display = '';
  renderHeader();
  checkStorage();
  const rv = reviewCandidates().length;
  if(rv && !$('radioLog').children.length) setTimeout(() => meister('<i class="fa-solid fa-rotate"></i> ' + rv + ' gelöste Aufgabe' + (rv > 1 ? 'n' : '') + ' ' + (rv > 1 ? 'warten' : 'wartet') + ' auf eine Wiederholung — du findest sie oben in der <b>Karte</b>.'), 1200);
  if(!$('radioLog').children.length) meister('Verbindung zur Leitwarte steht. Willkommen' + (S.name ? ', ' + esc(S.name) : '') + '! Die Zelle RZ-03 wartet auf dich.');
  goToPos();
}

/* ============================================================
   BEDIENKOMFORT — Glossar, Tooltips, Schnellkorrektur, Diagnose,
   Lösungsvergleich, Wiederholen, Rundgang, Speichern, Darstellung
   ============================================================ */
const GLOSSARY = {
  'SPS': 'Speicherprogrammierbare Steuerung. Liest Eingänge, führt das Programm aus, schreibt Ausgänge — immer wieder, in jedem Zyklus.',
  'Zyklus': 'Ein Durchlauf der SPS: Eingänge lesen → Programm von oben nach unten ausführen → Ausgänge schreiben. Dauert meist nur wenige Millisekunden.',
  'BOOL': 'Wahrheitswert: TRUE oder FALSE. Für Taster, Sensoren, Lampen, Ventile.',
  'INT': 'Ganze Zahl von −32768 bis 32767 (16 Bit).',
  'DINT': 'Doppelt breite Ganzzahl (32 Bit) bis rund ±2,1 Milliarden — für grosse Zählerstände.',
  'REAL': 'Kommazahl, z.B. 21.5. Dezimaltrennzeichen ist der Punkt.',
  'TIME': 'Zeitdauer, geschrieben als Zeit-Literal: T#3S, T#500MS, T#1M30S.',
  'WORD': '16 Bit als Bitmuster (z.B. ein Statuswort). Einzelne Bits: Wort.%X3.',
  'STRING': 'Text in einfachen Hochkommas, z.B. \'Bereit\'. STRING[20] fasst höchstens 20 Zeichen.',
  'ARRAY': 'Feld mit vielen Werten gleichen Typs unter einem Namen, z.B. ARRAY[1..10] OF REAL. Zugriff: Werte[3].',
  'STRUCT': 'Struktur: bündelt zusammengehörige Daten verschiedener Typen unter einem Namen. Zugriff mit Punkt: Teil.Gewicht.',
  'UDT': 'PLC-Datentyp (TYPE … END_TYPE): ein wiederverwendbarer Bauplan für eine Struktur.',
  'FC': 'Funktion: Werkzeug ohne Gedächtnis. Werte rein, Ergebnis raus.',
  'FB': 'Funktionsbaustein: Baustein mit Gedächtnis (Instanz-DB). Für Zähler, Flanken, Timer, Selbsthaltung.',
  'OB': 'Organisationsbaustein: wird vom Betriebssystem aufgerufen. OB1 in jedem Zyklus, OB100 einmal beim Anlauf.',
  'OB1': 'Der zyklische Organisationsbaustein „Main“ — das Inhaltsverzeichnis des Programms.',
  'OB100': 'Anlauf-OB „Startup“: läuft genau einmal beim Übergang von STOP nach RUN.',
  'DB': 'Datenbaustein: Speicher für Daten. Globaler DB = gemeinsame Daten, Instanz-DB = Gedächtnis eines FB.',
  'Instanz': 'Eine „Ausfertigung“ eines FB mit eigenem Gedächtnis. Ein Gerät = eine Instanz.',
  'Instanz-DB': 'Der Datenbaustein, in dem ein FB-Aufruf seine Eingänge, Ausgänge und statischen Werte speichert.',
  'Multiinstanz': 'FB-Instanz als statische Variable in einem anderen FB (VAR Band1 : "FB_Motor";). Aufruf mit #Band1(…).',
  'Flanke': 'Der Moment, in dem ein Signal wechselt (FALSE → TRUE = steigende Flanke). Zählt Ereignisse statt Zustände.',
  'Selbsthaltung': 'Ein Ausgang hält sich über sich selbst: Lauf := (Start OR Lauf) AND NOT Stopp.',
  'TON': 'Einschaltverzögerung: Q wird TRUE, wenn IN länger als PT ansteht.',
  'TOF': 'Ausschaltverzögerung: Q bleibt nach dem Abschalten von IN noch PT lang TRUE.',
  'TP': 'Impuls: Q ist nach einer steigenden Flanke von IN genau PT lang TRUE.',
  'R_TRIG': 'Erkennt die steigende Flanke: Q ist für genau einen Zyklus TRUE.',
  'F_TRIG': 'Erkennt die fallende Flanke (TRUE → FALSE).',
  'CTU': 'Vorwärtszähler: CV zählt bei jeder steigenden Flanke von CU hoch, Q = CV ≥ PV.',
  'CTD': 'Rückwärtszähler: CV zählt bei jeder Flanke von CD herunter.',
  'VAR_INPUT': 'Eingänge eines Bausteins — kommen von aussen (Kopie beim Aufruf).',
  'VAR_OUTPUT': 'Ausgänge eines Bausteins — gehen nach aussen, beim Aufruf mit => verbunden.',
  'VAR_IN_OUT': 'Durchgangsparameter: Verweis auf die Variable des Aufrufers, der Baustein verändert das Original.',
  'VAR_TEMP': 'Temporäre Variablen: existieren nur während eines Aufrufs, beginnen jedes Mal neu.',
  'STAT': 'Statische Variablen (VAR) eines FB: bleiben von Zyklus zu Zyklus im Instanz-DB erhalten.',
  'TEMP': 'Temporär: nach dem Aufruf verloren. Für Zwischenergebnisse.',
  'CONSTANT': 'VAR CONSTANT: fester Wert mit Namen, kann nicht überschrieben werden.',
  'Schrittkette': 'Ablaufsteuerung: eine Schrittnummer merkt sich, wo die Anlage steht; CASE führt nur den aktiven Schritt aus.',
  'Hysterese': 'Unterschiedliche Ein- und Ausschaltschwelle (z.B. ein über 40 °C, aus unter 35 °C) — verhindert Flattern.',
  'Skalierung': 'Umrechnung eines Rohwerts (0…27648) in die Messgrösse, z.B. 0…100 %.',
  'Öffner': 'Kontakt, der im Ruhezustand geschlossen ist (Signal TRUE, solange nicht betätigt). Sicherheitstaster sind Öffner.',
  'Schliesser': 'Kontakt, der bei Betätigung schliesst (Signal TRUE, solange betätigt).',
  'Rückmeldung': 'Signal, das bestätigt, dass eine Bewegung oder ein Schütz wirklich ausgeführt wurde.',
  'Not-Halt': 'Sicherheitsabschaltung mit höchster Priorität — hat immer Vorrang vor jeder anderen Logik.',
  'Überlauf': 'Ein Wert wird grösser als sein Datentyp fassen kann und springt auf die andere Seite des Wertebereichs.',
  'HMI': 'Bedienpanel (Human Machine Interface): zeigt Werte und Meldungen an.',
  'TIA Portal': 'Siemens-Engineering-Software, in der SCL-Programme für S7-Steuerungen entwickelt werden.',
  'PLCSIM': 'Simulations-SPS von Siemens zum Testen ohne echte Hardware.',
  'externe Quelle': 'Textdatei (.scl, .udt, .db), aus der TIA Portal Bausteine generieren kann.'
};
if(SENSORMODE && window.SENSOR_GLOSSARY) Object.assign(GLOSSARY, window.SENSOR_GLOSSARY);
if(AWLMODE) Object.assign(GLOSSARY, {
  'VKE': 'Verknüpfungsergebnis: das Bit, das die Abfragen (U, O, …) Zeile für Zeile bilden. =, S und R schreiben es in den Operanden.',
  'Erstabfrage': 'Die erste Abfrage einer Verknüpfungskette: Sie übernimmt den Operanden direkt ins VKE, statt ihn zu verknüpfen.',
  'AKKU1': 'Akkumulator 1: Hier landet jeder geladene Wert (L), hier steht das Rechenergebnis.', 'AKKU2': 'Akkumulator 2: der vorherige Inhalt von AKKU1 — zweiter Operand beim Rechnen und Vergleichen.',
  'Flankenmerker': 'Bit, in dem FP/FN den VKE-Zustand des letzten Zyklus speichern.', 'Sprungmarke': 'Name mit Doppelpunkt vor einer Anweisung (M1: …), Ziel von SPA/SPB/SPBN.',
  'S7-300': 'Ältere Siemens-Steuerung (bis ca. 2023 verbreitet). Programmiert in AWL, KOP, FUP oder SCL.', 'AWL': 'Anweisungsliste: textuelle SPS-Sprache, eine Anweisung pro Zeile. Läuft auf S7-300/400, nicht auf der S7-1200.'
});
const KW_HELP = {
  'IF':'IF Bedingung THEN … ELSIF … ELSE … END_IF; — Verzweigung.', 'ELSIF':'Weitere Bedingung innerhalb eines IF.', 'ELSE':'Zweig, wenn keine Bedingung zutrifft.',
  'CASE':'CASE Wert OF 1: … 2..5: … ELSE … END_CASE; — Auswahl nach einer Ganzzahl.', 'FOR':'FOR i := 1 TO 10 DO … END_FOR; — Zählschleife.', 'WHILE':'WHILE Bedingung DO … END_WHILE; — Schleife, solange die Bedingung gilt.',
  'REPEAT':'REPEAT … UNTIL Bedingung END_REPEAT; — läuft mindestens einmal.', 'EXIT':'Verlässt die aktuelle Schleife sofort.', 'CONTINUE':'Springt zum nächsten Schleifendurchlauf.',
  'MOD':'Divisionsrest: 17 MOD 5 = 2.', 'AND':'Beide Bedingungen müssen TRUE sein.', 'OR':'Mindestens eine Bedingung muss TRUE sein.', 'XOR':'Genau eine der beiden Bedingungen ist TRUE.', 'NOT':'Kehrt einen Wahrheitswert um.',
  'LIMIT':'LIMIT(MN := min, IN := wert, MX := max) begrenzt einen Wert.', 'MIN':'Kleinster Wert.', 'MAX':'Grösster Wert.', 'ABS':'Betrag (ohne Vorzeichen).', 'SQRT':'Quadratwurzel.',
  'ROUND':'Rundet eine Kommazahl zur Ganzzahl.', 'TRUNC':'Schneidet die Nachkommastellen ab.', 'CONCAT':'Verbindet Texte: CONCAT(IN1 := \'a\', IN2 := \'b\').', 'LEN':'Länge eines Texts.',
  'LEFT':'Zeichen vom Anfang: LEFT(IN := text, L := anzahl).', 'RIGHT':'Zeichen vom Ende.', 'MID':'MID(IN := text, L := länge, P := position) — Positionen ab 1.', 'FIND':'Position eines Suchtexts (0 = nicht gefunden).',
  'BEGIN':'Trennt die Deklaration vom Code eines Bausteins.', 'END_VAR':'Schliesst einen Deklarationsbereich.', 'RETURN':'Beendet den Baustein vorzeitig.'
};
const AWL_HELP = { U:'UND: fragt einen Operanden ab und verknüpft ihn mit dem VKE (bei Erstabfrage: übernimmt ihn).', UN:'UND NICHT: fragt den Operanden negiert ab.', O:'ODER-Verknüpfung. Ohne Operand: „UND vor ODER“ — beginnt eine neue UND-Gruppe.', ON:'ODER NICHT.',
  X:'Exklusiv-ODER.', XN:'Exklusiv-ODER NICHT.', NOT:'Negiert das VKE.', SET:'Setzt das VKE auf 1.', CLR:'Setzt das VKE auf 0.', S:'Setzen: bei VKE 1 wird der Operand 1 (bleibt gespeichert).', R:'Rücksetzen: bei VKE 1 wird der Operand 0.',
  FP:'Positive Flanke: VKE ist nur im Zyklus 1, in dem das VKE von 0 auf 1 wechselt. Braucht einen Flankenmerker.', FN:'Negative Flanke (1 → 0).', L:'Laden: Wert kommt in AKKU1, der alte Inhalt von AKKU1 wandert nach AKKU2.', T:'Transferieren: AKKU1 in den Operanden schreiben.',
  TAK:'Tauscht AKKU1 und AKKU2.', SE:'Einschaltverzögerung (Zeit aus AKKU1, Start mit VKE 1).', SA:'Ausschaltverzögerung.', SI:'Impuls: Ausgang 1 für die Zeit, solange das VKE 1 bleibt.', SV:'Verlängerter Impuls.',
  ZV:'Zähler vorwärts bei steigender Flanke des VKE.', ZR:'Zähler rückwärts.', SPA:'Springt immer zur Marke.', SPB:'Springt zur Marke, wenn das VKE 1 ist.', SPBN:'Springt zur Marke, wenn das VKE 0 ist.', BEA:'Baustein-Ende absolut.', BEB:'Baustein-Ende, wenn VKE 1.',
  LOOP:'Zählt AKKU1 herunter und springt, solange er nicht 0 ist.', CALL:'Ruft einen Baustein auf (FC, FB mit Instanz-DB, Multiinstanz).', ITD:'INT → DINT.', DTR:'DINT → REAL.', RND:'REAL → Ganzzahl, gerundet.', TRUNC:'REAL → Ganzzahl, abgeschnitten.', MOD:'Divisionsrest AKKU2 MOD AKKU1.' };
if(AWLMODE) Object.assign(KW_HELP, AWL_HELP);
function glossaryText(word){
  if(!word) return null;
  const up = word.toUpperCase();
  const k = Object.keys(GLOSSARY).find(g => g.toUpperCase() === up);
  if(k) return { title:k, text:GLOSSARY[k] };
  if(KW_HELP[up]) return { title:up, text:KW_HELP[up] };
  if(/^[A-Z]+_TO_[A-Z]+$/.test(up)) return { title:up, text:'Typumwandlung von ' + up.split('_TO_')[0] + ' nach ' + up.split('_TO_')[1] + '.' };
  return null;
}
// Glossarbegriffe im Aufgabentext markieren (erstes Vorkommen, nicht in Code)
const GL_TERMS = Object.keys(GLOSSARY).filter(k => k.length > 2 && !/^[A-Z_0-9]+$/.test(k)).concat(['Instanz-DB','Multiinstanz','Flanke','Selbsthaltung','Schrittkette','Hysterese','Überlauf','Skalierung']).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b.length - a.length);
function markGlossary(root, seen){
  if(!root) return;
  seen = seen || new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode.closest('code, pre, .gl, a, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let text = node.nodeValue;
    for(const term of GL_TERMS){
      if(seen.has(term)) continue;
      const re = new RegExp('(^|[^A-Za-zÄÖÜäöü])(' + term.replace(/[-]/g, '\\-') + ')(?![A-Za-zÄÖÜäöü])', 'i');
      const m = re.exec(text);
      if(!m) continue;
      seen.add(term);
      const idx = m.index + m[1].length;
      const before = document.createTextNode(text.slice(0, idx));
      const span = document.createElement('span'); span.className = 'gl'; span.tabIndex = 0; span.dataset.gl = term; span.textContent = m[2];
      const after = document.createTextNode(text.slice(idx + m[2].length));
      node.parentNode.insertBefore(before, node); node.parentNode.insertBefore(span, node); node.parentNode.insertBefore(after, node); node.parentNode.removeChild(node);
      node = after; text = after.nodeValue;
    }
  });
}
/* ---- Tooltip ---- */
const tip = $('hoverTip');
function showTip(html, x, y){
  tip.innerHTML = html; tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = Math.min(window.innerWidth - w - 10, Math.max(10, x + 12)), top = y + 18;
  if(top + h > window.innerHeight - 10) top = Math.max(10, y - h - 12);
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function hideTip(){ tip.style.display = 'none'; }
function glTipFor(el){
  const g = GLOSSARY[el.dataset.gl]; if(!g) return;
  const r = el.getBoundingClientRect();
  showTip('<b>' + esc(el.dataset.gl) + '</b><br>' + esc(g), r.left, r.bottom - 12);
}
document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('.gl'); if(el) glTipFor(el); });
document.addEventListener('mouseout', e => { if(e.target.closest && e.target.closest('.gl')) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.gl'); if(el) glTipFor(el); });
document.addEventListener('focusout', e => { if(e.target.closest && e.target.closest('.gl')) hideTip(); });
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('.gl'); if(el){ glTipFor(el); } else if(!e.target.closest || !e.target.closest('#hoverTip')) { if(tip.style.display !== 'none' && !e.target.closest('#codeEditor')) hideTip(); } });
window.addEventListener('scroll', hideTip, true);

/* ---- Hover im Editor: Variable, Typ, Bereich, letzter Wert ---- */
function lastEnvs(){
  const t = session.task, out = { glob:{}, local:{}, localBlock:null };
  const r = session.lastRun; if(!r) return out;
  if(t && t.pro && r.res){
    const tp = r.res.parts.find(p => p.kind === 'timed') || r.res.parts.find(p => p.kind === 'tests');
    if(tp){ const rc = tp.failedCase || tp.report[tp.report.length - 1]; const env = rc && (rc.steps ? (rc.steps[rc.steps.length - 1] || {}).env : rc.env); if(env) out.glob = env; }
    const up = r.res.parts.find(p => p.kind === 'unit');
    if(up){ const rc = up.failedCase || up.report[up.report.length - 1]; const st = rc && rc.steps[rc.steps.length - 1]; if(st){ out.local = st.env; out.localBlock = rc.block; } }
  } else if(r.report){
    const rc = r.failedCase || r.report[r.report.length - 1];
    out.glob = (rc ? (rc.steps ? (rc.steps[rc.steps.length - 1] || {}).env : rc.env) : null) || {};
  }
  return out;
}
function fmtTipVal(v){
  if(v === undefined) return '';
  if(v !== null && typeof v === 'object') v = Array.isArray(v) ? '[' + v.slice(0, 8).map(x => typeof x === 'object' ? '{…}' : fmtVal(x)).join(', ') + (v.length > 8 ? ', …' : '') + ']' : '{' + Object.keys(v).slice(0, 5).map(k => k + ': ' + (typeof v[k] === 'object' ? '…' : fmtVal(v[k]))).join(', ') + '}';
  else v = fmtVal(v);
  return '<div class="tip-val">zuletzt im Test: <b>' + esc(v) + '</b></div>';
}
const SEC_TXT = { Input:'Eingang (VAR_INPUT)', Output:'Ausgang (VAR_OUTPUT)', InOut:'Durchgang (VAR_IN_OUT)', Static:'statisch (VAR) — bleibt erhalten', Temp:'temporär (VAR_TEMP) — nach dem Aufruf verloren', Constant:'Konstante (VAR CONSTANT)' };
function editorHover(info){
  if(!info){ hideTip(); return; }
  const t = session.task; if(!t) return;
  let h = '';
  if(info.error) h += '<div class="tip-err"><i class="fa-solid fa-circle-xmark"></i> ' + esc(info.error) + '</div>';
  const tok = info.token;
  if(tok && tok.word){
    const w = tok.word, envs = lastEnvs();
    let found = false;
    if(t.pro && PS){
      const b = proBlock(PS.active);
      if(!tok.quoted && b){
        try{ const ifc = PRO.readInterface(proCode(b)); const row = ifc && ifc.rows.find(r => r.name.toLowerCase() === w.toLowerCase());
          if(row){ found = true; h += '<b>#' + esc(row.name) + '</b> : <code>' + esc(row.type) + '</code><br><span class="tip-sec">' + esc(SEC_TXT[row.sec] || row.sec) + '</span>' + (row.init ? ' · Startwert ' + esc(row.init) : '') + (row.comment ? '<br><i>' + esc(row.comment) + '</i>' : '');
            if(envs.localBlock === b.name) h += fmtTipVal(envs.local[row.name]); }
          else if(ifc && ifc.kind === 'FC' && w.toLowerCase() === ifc.name.toLowerCase()){ found = true; h += '<b>#' + esc(ifc.name) + '</b> : <code>' + esc(ifc.ret) + '</code><br><span class="tip-sec">Rückgabewert der Funktion</span>'; }
        }catch(e){}
      }
      if(!found){
        const gk = Object.keys(t.project.globals).find(k => k.toLowerCase() === w.toLowerCase());
        if(gk){ found = true; h += '<b>"' + esc(gk) + '"</b> : <code>' + esc(globalType(t, gk)) + '</code><br><span class="tip-sec">globale PLC-Variable</span>' + ((t.project.comments || {})[gk] ? '<br><i>' + esc(t.project.comments[gk]) + '</i>' : '') + fmtTipVal(envs.glob[gk]); }
        const blk = t.project.blocks.find(x => x.name.toLowerCase() === w.toLowerCase());
        if(!found && blk){ found = true; h += '<b>"' + esc(blk.name) + '"</b><br><span class="tip-sec">' + ({FB:'Funktionsbaustein', FC:'Funktion', OB:'Organisationsbaustein', UDT:'PLC-Datentyp', DB:'Datenbaustein'}[blk.kind] || blk.kind) + (blk.edit ? '' : ' (vorgegeben 🔒)') + '</span>'; }
        const inst = Object.keys(t.project.instances || {}).find(k => k.toLowerCase() === w.toLowerCase());
        if(!found && inst){ found = true; h += '<b>"' + esc(inst) + '"</b><br><span class="tip-sec">Instanz-DB von "' + esc(t.project.instances[inst]) + '"</span>'; }
      }
    } else if(!t.pro){
      const sym = ENGINE.buildSymbols(ENGINE.declOf(t))[w.toLowerCase()];
      if(sym){ found = true; h += '<b>' + esc(sym.name) + '</b> : <code>' + esc(varTypeLabel(sym)) + '</code>' + fmtTipVal(envs.glob[sym.name]); }
    }
    if(!found){ const g = glossaryText(w); if(g){ found = true; h += '<b>' + esc(g.title) + '</b><br>' + esc(g.text); } }
  }
  if(!h){ hideTip(); return; }
  showTip(h, info.x, info.y);
}

/* ---- Schnellkorrektur für Compilerfehler ---- */
function quickFix(e){
  if(!e || !e.line || session.solved || KOPMODE || AWLMODE) return null;
  const code = editor.getValue(), lines = code.split('\n'), L = lines[e.line - 1];
  if(L === undefined) return null;
  const m = e.message;
  const lineEnd = n => { const l = lines[n - 1]; const c = l.indexOf('//'); const body = c >= 0 ? l.slice(0, c) : l; return editor.offsetOf(n, 1) + body.replace(/\s+$/, '').length; };
  if(e.suggestion){
    const tk = editor.tokenAt(e.line, e.col);
    if(tk && tk.word && tk.word.toLowerCase() !== String(e.suggestion).toLowerCase()){
      const rep = tk.quoted ? '"' + e.suggestion + '"' : (tk.hash ? '#' : '') + String(e.suggestion).replace(/^#/, '');
      return { label: 'Ersetzen durch <code>' + esc(rep) + '</code>', apply: () => editor.replaceRange(tk.start, tk.end, rep) };
    }
  }
  if(/fehlt ein Semikolon/.test(m)){ const at = lineEnd(e.line); return { label: '<code>;</code> am Ende von Zeile ' + e.line + ' einfügen', apply: () => editor.replaceRange(at, at, ';') }; }
  const at = editor.offsetOf(e.line, e.col);
  const swap = (from, to, label) => code.slice(at, at + from.length) === from ? { label, apply: () => editor.replaceRange(at, at + from.length, to) } : null;
  if(/einfachen "=" \(nicht "=="\)/.test(m)) return swap('==', '=', '<code>==</code> durch <code>=</code> ersetzen');
  if(/"<>" \(nicht "!="\)/.test(m)) return swap('!=', '<>', '<code>!=</code> durch <code>&lt;&gt;</code> ersetzen');
  if(/Statt "&&"/.test(m)) return swap('&&', 'AND', '<code>&&</code> durch <code>AND</code> ersetzen');
  if(/Statt "\|\|"/.test(m)) return swap('||', 'OR', '<code>||</code> durch <code>OR</code> ersetzen');
  if(/Statt "!" schreibt/.test(m)) return swap('!', 'NOT ', '<code>!</code> durch <code>NOT</code> ersetzen');
  if(/einfacher Doppelpunkt ":"/.test(m)) return swap(':=', ':', '<code>:=</code> durch <code>:</code> ersetzen');
  if(/mit ":=" (\(ein|—)/.test(m) && code[at] === '=') return swap('=', ':=', '<code>=</code> durch <code>:=</code> ersetzen');
  if(/In der (IF|ELSIF|WHILE)-Bedingung steht ":="/.test(m)) return swap(':=', '=', '<code>:=</code> durch <code>=</code> ersetzen (Vergleich)');
  const kw = /Nach der (IF|ELSIF|WHILE)-Bedingung fehlt (THEN|DO)\./.exec(m);
  if(kw){ const le = lineEnd(e.line); return { label: '<code>' + kw[2] + '</code> am Ende von Zeile ' + e.line + ' ergänzen', apply: () => editor.replaceRange(le, le, ' ' + kw[2]) }; }
  if(/ELSIF zusammen/.test(m)){ const mm = /ELSE\s+IF\b/i.exec(code); if(mm) return { label: '<code>ELSE IF</code> durch <code>ELSIF</code> ersetzen', apply: () => editor.replaceRange(mm.index, mm.index + mm[0].length, 'ELSIF') }; }
  return null;
}
function fixButtonHTML(fx){ return fx ? '<button class="tool-btn quickfix" id="quickFixBtn"><i class="fa-solid fa-wand-magic-sparkles"></i> Schnellkorrektur: ' + fx.label + '</button>' : ''; }
function bindFixButton(fx){
  const b = $('quickFixBtn'); if(!b || !fx) return;
  b.addEventListener('click', () => { fx.apply(); SFX.click(); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-check"></i> Korrigiert — jetzt erneut testen'; editor.setErrorLine(0); });
}

/* ---- Diagnose: „Mögliche Ursache“ aus dem Testverlauf ---- */
function failInfo(t, res){
  const part = t.pro ? (res.res && res.res.failed) : res;
  if(!part || !part.failedCase) return null;
  const rc = part.failedCase;
  if(rc.error) return { error: rc.error };
  if(rc.steps){ const st = rc.steps[rc.steps.length - 1]; return { checks: st.checks, steps: rc.steps, st, prev: rc.steps.length > 1 ? rc.steps[rc.steps.length - 2] : null, kind: part.kind || 'timed' }; }
  return { checks: rc.checks, kind: 'tests' };
}
function diagnose(t, res, code){
  const f = failInfo(t, res); if(!f) return [];
  const out = [], add = s => { if(!out.includes(s)) out.push(s); };
  if(f.error){
    if(/Endlosschleife/.test(f.error.message)) add('Eine Schleife endet nie: Ändert sich die Bedingung in der Schleife wirklich? Bei WHILE muss z.B. der Zähler im Rumpf erhöht werden.');
    if(/Array-Index/.test(f.error.message)) add('Ein Index läuft aus dem Array heraus — prüfe die Schleifengrenzen (0..9 oder 1..10?) und Ausdrücke wie i + 1.');
    if(/Division durch 0/.test(f.error.message)) add('Vor dem Teilen prüfen, ob der Divisor ungleich 0 ist.');
    return out;
  }
  const bad = (f.checks || []).filter(c => !c.pass && !c.pathError);
  const src = String(code || '').toUpperCase();
  bad.forEach(c => {
    const a = c.actual, x = c.expected;
    if(typeof x === 'number' && typeof a === 'number'){
      let counted = false;
      if(f.steps && f.prev){
        const pc = f.prev.checks.find(y => y.name === c.name), prevA = pc ? pc.actual : undefined, prevX = pc ? pc.expected : undefined;
        if(a < x && typeof prevA === 'number' && typeof prevX === 'number' && ((x > prevX && a <= prevA) || (x >= prevX && a < prevA))){ counted = true; add('<b>' + esc(c.name) + ' wächst nicht weiter:</b> Der Wert geht zwischen den Zyklen verloren. Liegt die Variable in <code>VAR_TEMP</code> statt <code>VAR</code>, wird sie im Code jedes Mal neu gesetzt, oder steckt die Logik in einer FC ohne Gedächtnis?'); }
        const held = Object.values(f.prev.inputs || {}).some(v => v === true) && !Object.values(f.st.inputs || {}).some(v => v === false);
        if(a > x && (held || (typeof prevA === 'number' && a > prevA && x === prevX))){ counted = true; add('<b>Zählt zu viel:</b> <code>' + esc(c.name) + '</code> steigt in <i>jedem Zyklus</i>, solange das Signal ansteht. Zähle nur die <b>Flanke</b> (R_TRIG oder Merker aus dem letzten Zyklus).'); }
      }
      if(counted){ /* spezifische Diagnose gefunden */ }
      else if(x > 32767 && a < 0) add('<b>Überlauf:</b> ' + esc(c.name) + ' ist negativ geworden — ein INT reicht nur bis 32767. Nimm DINT.');
      else if(!Number.isInteger(x) && Math.abs(a - Math.trunc(x)) < 1e-9) add('<b>Nachkommastellen fehlen:</b> Eine INT/INT-Division schneidet ab. Rechne mit REAL (z.B. <code>INT_TO_REAL(…) / 2.0</code>).');
      else if(Math.abs(a - x) === 1) add('<b>Genau um 1 daneben</b> bei <code>' + esc(c.name) + '</code>: Typische Ursachen sind Schleifengrenzen (0..9 statt 1..10), <code>&lt;</code> statt <code>&lt;=</code> oder ein falscher Startwert.');
      else if(a === 0 && x !== 0 && t.pro && /FUNCTION /.test(src)) add('<b>' + esc(c.name) + ' ist 0:</b> Wird der Ausgang bzw. Rückgabewert in diesem Fall überhaupt gesetzt? Eine FC liefert sonst einen undefinierten Wert.');
    }
    if(typeof x === 'string' && typeof a === 'string'){
      if(x.startsWith(a) && a.length < x.length) add('<b>Text abgeschnitten:</b> „' + esc(a) + '“ statt „' + esc(x) + '“ — ist der STRING lang genug?');
      else if(a.replace(/\s+/g, '').toLowerCase() === x.replace(/\s+/g, '').toLowerCase()) add('<b>Fast richtig:</b> Achte auf Leerzeichen und Gross-/Kleinschreibung im Text.');
    }
    if(typeof x === 'boolean' && f.steps){
      const i = f.steps.length - 1;
      const exps = f.steps.map(s => (s.checks.find(y => y.name === c.name) || {}).expected);
      const acts = f.steps.map(s => (s.checks.find(y => y.name === c.name) || {}).actual);
      if(i > 0 && acts[i] === exps[i-1] && exps[i] !== exps[i-1]) add('<b>Einen Zyklus zu spät?</b> <code>' + esc(c.name) + '</code> zeigt noch den Wert aus dem vorigen Zyklus. Prüfe die <b>Reihenfolge</b>: Wird ein Wert benutzt, bevor er in diesem Zyklus berechnet wurde?');
      else if(x === false && a === true) add('<b>' + esc(c.name) + ' bleibt TRUE:</b> Wird der Ausgang auch wieder zurückgesetzt? Fehlt ein ELSE-Zweig oder eine Abschaltbedingung (Stopp, Störung, Freigabe)?');
      else if(x === true && a === false) add('<b>' + esc(c.name) + ' wird nicht TRUE:</b> Prüfe die Bedingung — AND/OR vertauscht, fehlende Klammern, falscher Vergleich (&gt; statt &gt;=)?');
      if(/T#/.test(src) && (f.st.t || 0) > 0){
        if(x === true && a === false) add('<b>Zeitverhalten:</b> Läuft der Timer wirklich? Er muss in <i>jedem</i> Zyklus aufgerufen werden, und <code>PT</code> braucht die richtige Einheit (T#3S ≠ T#3MS).');
        if(x === false && a === true) add('<b>Zu früh?</b> Prüfe <code>PT</code> und ob der Timer beim Verlassen der Bedingung zurückgesetzt wird.');
      }
    }
    if(Array.isArray(x) && Array.isArray(a)){
      const d = x.findIndex((v, k) => JSON.stringify(v) !== JSON.stringify(a[k]));
      if(d >= 0) add('<b>Array ab Position ' + (d + 1) + ' falsch</b> (von vorn gezählt): erwartet ' + esc(fmtVal(x[d])) + ', erhalten ' + esc(fmtVal(a[d])) + '. Prüfe Grenzen und Tauschlogik.');
    }
  });
  return out.slice(0, 3);
}
function diagnoseHTML(t, res, code){
  const d = diagnose(t, res, code);
  return d.length ? '<div class="diag-box"><div class="diag-title"><i class="fa-solid fa-stethoscope"></i> Mögliche Ursache</div>' + d.map(x => '<div class="diag-item">' + x + '</div>').join('') + '</div>' : '';
}

/* ---- Lösungsvergleich (Zeilen-Diff) ---- */
function normLine(l){ return l.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
function lineDiff(a, b){
  const A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length;
  const na = A.map(normLine), nb = B.map(normLine);
  const dp = Array.from({length: n + 1}, () => new Array(m + 1).fill(0));
  for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--) dp[i][j] = na[i] === nb[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const out = []; let i = 0, j = 0;
  while(i < n || j < m){
    if(i < n && j < m && na[i] === nb[j]){ out.push({ t:'=', a:A[i], b:B[j] }); i++; j++; }
    else if(j < m && (i >= n || dp[i][j+1] >= dp[i+1][j])){ out.push({ t:'+', b:B[j] }); j++; }
    else { out.push({ t:'-', a:A[i] }); i++; }
  }
  return out;
}
function diffHTML(mine, ref, title){
  const d = lineDiff(mine || '', ref || '');
  const same = d.every(x => x.t === '=' || !normLine(x.a || x.b || ''));
  let h = '<div class="diff-block"><div class="diff-head">' + esc(title) + (same ? ' <span class="diff-same"><i class="fa-solid fa-check"></i> gleichwertig</span>' : '') + '</div><div class="diff-cols"><div class="diff-col"><div class="diff-col-h">Deine Lösung</div>';
  const colA = d.map(x => x.t === '+' ? '<div class="dl dl-gap">&nbsp;</div>' : '<div class="dl ' + (x.t === '-' && normLine(x.a) ? 'dl-del' : '') + '">' + (window.SCLEditor.highlight(x.a).replace(/\n$/, '') || '&nbsp;') + '</div>').join('');
  const colB = d.map(x => x.t === '-' ? '<div class="dl dl-gap">&nbsp;</div>' : '<div class="dl ' + (x.t === '+' && normLine(x.b) ? 'dl-add' : '') + '">' + (window.SCLEditor.highlight(x.b).replace(/\n$/, '') || '&nbsp;') + '</div>').join('');
  h += '<pre class="diff-code">' + colA + '</pre></div><div class="diff-col"><div class="diff-col-h">Musterlösung</div><pre class="diff-code">' + colB + '</pre></div></div></div>';
  return h;
}
function openDiff(t, mine){
  let h = '<p class="report-note">Rot: nur in deiner Lösung · Grün: nur in der Musterlösung. Unterschiede sind kein Fehler — deine Lösung hat alle Tests bestanden. Vergleiche, welche Variante leichter zu lesen ist.</p>';
  if(t.pro){ const ref = PT.refCodes(t); Object.keys(ref).forEach(k => { h += diffHTML((mine || {})[k] || '', ref[k], k); }); }
  else if(KOPMODE) h += '<div class="kop-diff"><div><div class="diff-col-h">Deine Lösung</div>' + codeHTML(typeof mine === 'string' ? mine : '') + '</div><div><div class="diff-col-h">Musterlösung</div>' + codeHTML(t.refSolution) + '</div></div>';
  else h += diffHTML(typeof mine === 'string' ? mine : '', t.refSolution, t.title);
  $('diffBody').innerHTML = h;
  openModal('diffModal');
}

/* ---- Wiederholen: Aufgaben, bei denen es gehakt hat ---- */
function reviewCandidates(){
  const now = Date.now(), DAY = 86400000;
  return Object.keys(S.doneTasks).map(id => ({ id, d: S.doneTasks[id], t: TASK_BY_ID[id] })).filter(x => x.t && !x.d.migrated && ((x.d.stars || 0) < 3 || x.d.hints > 0 || x.d.revealed))
    .filter(x => !(x.d.reviewedAt && x.d.reviewedAt > (x.d.at || 0)) && now - (x.d.at || 0) >= DAY)
    .map(x => Object.assign(x, { score: (3 - (x.d.stars || 0)) * 2 + (x.d.revealed ? 3 : 0) + Math.min(10, (now - (x.d.at || 0)) / DAY / 3) }))
    .sort((a, b) => b.score - a.score).slice(0, 6);
}
function reviewHTML(){
  const c = reviewCandidates(); if(!c.length) return '';
  return '<div class="review-box"><div class="review-title"><i class="fa-solid fa-rotate"></i> Zum Wiederholen empfohlen <span class="var-hint">— hier hat es gehakt; nach ein paar Tagen erneut zu lösen verankert das Wissen</span></div><div class="map-tasks">'
    + c.map(x => '<button class="map-chip done review-chip" data-kind="task" data-id="' + x.id + '" title="' + TASK_NO[x.id] + ': ' + esc(x.t.title) + '">' + TASK_NO[x.id] + '<span class="mstars">' + '★'.repeat(x.d.stars || 0) + '</span></button>').join('') + '</div></div>';
}

/* ---- Speichern: Anzeige, Speicherschutz, Export-Erinnerung ---- */
var saveIndTimer = 0, storageOk = true;
function showSaved(ok){
  const el = $('saveIndicator'); if(!el) return;
  el.classList.toggle('bad', !ok);
  el.querySelector('span').textContent = ok ? 'gespeichert' : 'nicht gespeichert!';
  el.classList.add('show'); clearTimeout(saveIndTimer);
  if(ok) saveIndTimer = setTimeout(() => el.classList.remove('show'), 1600);
}
function storageBanner(){
  const b = $('storageBanner');
  b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Dein Browser erlaubt hier kein Speichern (z.B. privates Fenster). Der Fortschritt geht beim Schliessen verloren — sichere ihn über <b>Einstellungen → Spielstand exportieren</b>. <button class="btn" id="storageBannerClose">OK</button>';
  b.style.display = 'flex';
  $('storageBannerClose').addEventListener('click', () => b.style.display = 'none');
}
function checkStorage(){
  try{ localStorage.setItem('sclquest3_probe', '1'); localStorage.removeItem('sclquest3_probe'); }
  catch(e){ storageOk = false; storageBanner(); }
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => { if(!p) navigator.storage.persist().catch(() => {}); }).catch(() => {}); }catch(e){}
}
function maybeRemindExport(){
  if(session.practice) return;
  S.doneSinceExport = (S.doneSinceExport || 0) + 1;
  const days = S.lastExportAt ? (Date.now() - S.lastExportAt) / 86400000 : 99;
  if(S.doneSinceExport >= 15 && days >= 5){
    S.doneSinceExport = 0; save();
    toast('💾', 'Spielstand sichern?', 'Dein Fortschritt liegt nur in diesem Browser. Einstellungen → Exportieren legt eine Sicherungsdatei an.');
  }
}

/* ---- Geführter Rundgang ---- */
const TOURS = {
  basic: [
    { sel:'.mission-card', title:'Deine Mission', text:'Hier steht die Geschichte zur Aufgabe. ARIA sabotiert die Zelle — du bringst sie mit echtem ' + Q.langShort + '-Code zurück unter Kontrolle.' },
    { sel:'.task-card', title:'Aufgabe & Lernziel', text:'Das Briefing sagt genau, was dein Programm tun soll. Unterstrichene Begriffe erklären sich, wenn du darauf zeigst oder tippst.' },
    { sel:'#varPanel', title:'Variablen', text:'Diese Variablen sind schon angelegt. Ein Klick fügt den Namen in den Editor ein — so vermeidest du Tippfehler.' },
    { sel:'.editor-card', title:'Der Editor', text:'Hier schreibst du SCL. Rote Wellenlinien zeigen Fehler, beim Darüberfahren siehst du die Erklärung und Typen der Variablen.' },
    { sel:'#compileBtn', title:'Testen', text:'Strg+Enter (oder dieser Knopf) lädt dein Programm in die SPS. Echte Testfälle prüfen es, der Testbericht zeigt Ist- und Soll-Werte.' },
    { sel:'.scene-card', title:'Die Live-Anlage', text:'Die Anlage wird von deinem Programm gesteuert — nicht von vorgefertigten Animationen. Oben rechts wechselst du zwischen 2D und 3D.' },
    { sel:'#hintBtn', title:'Festgefahren?', text:'Hinweise helfen in drei Stufen. Das Handbuch (oben) erklärt jedes Thema zum Nachschlagen, die Karte zeigt deinen Fortschritt.' }
  ],
  pro: [
    { sel:'#projectTabs', title:'Willkommen in der Profi-Stufe', text:'Jetzt arbeitest du mit einem Projekt aus mehreren Bausteinen — wie im TIA-Projektbaum. Mit 🔒 markierte Bausteine sind vorgegeben.' },
    { sel:'#varPanel', title:'PLC-Variablen', text:'Globale Variablen schreibst du in Anführungszeichen ("S_Start"), lokale mit # (#Lauf).' },
    { sel:'#tableToggleBtn', title:'Tabelle ⇄ Quelltext', text:'Ab Kapitel 12 kannst du die Schnittstelle auch als Tabelle bearbeiten — wie in TIA Portal. Beide Ansichten bleiben synchron.' },
    { sel:'#editorStatus', title:'Warnungen', text:'Gelbe Warnungen blockieren nicht, zeigen aber typische Profi-Fehler: TEMP statt STAT, Ausgang nicht in jedem Zweig, globale Daten im Baustein.' },
    { sel:'#compileBtn', title:'Beobachten', text:'Nach einem Test öffnet „Beobachten“ im Testbericht den Aufrufbaum: STAT-Werte (bleiben) und TEMP-Werte (verloren) Zyklus für Zyklus.' }
  ]
};
let TOUR = null;
function startTour(name){
  const steps = TOURS[name].filter(s => { const el = document.querySelector(s.sel); return el && el.offsetParent !== null; });
  if(!steps.length) return;
  TOUR = { name, steps, i: 0 };
  $('tourOverlay').style.display = 'block';
  showTourStep();
}
function showTourStep(){
  const s = TOUR.steps[TOUR.i], el = document.querySelector(s.sel);
  el.scrollIntoView({ block:'center', behavior:'auto' });
  setTimeout(() => {
    const r = el.getBoundingClientRect(), pad = 6, spot = $('tourSpot'), card = $('tourCard');
    Object.assign(spot.style, { left:(r.left - pad) + 'px', top:(r.top - pad) + 'px', width:(r.width + pad*2) + 'px', height:(Math.min(r.height, window.innerHeight - 40) + pad*2) + 'px' });
    $('tourStep').textContent = (TOUR.i + 1) + ' / ' + TOUR.steps.length;
    $('tourTitle').textContent = s.title; $('tourText').textContent = s.text;
    $('tourPrev').style.visibility = TOUR.i ? 'visible' : 'hidden';
    $('tourNext').textContent = TOUR.i === TOUR.steps.length - 1 ? 'Los geht’s' : 'Weiter';
    const cw = Math.min(340, window.innerWidth - 24);
    let left = r.left + r.width / 2 - cw / 2; left = Math.max(12, Math.min(window.innerWidth - cw - 12, left));
    let top = r.bottom + 14; if(top + 190 > window.innerHeight) top = Math.max(12, r.top - 200);
    Object.assign(card.style, { left: left + 'px', top: top + 'px', width: cw + 'px' });
    $('tourNext').focus();
  }, 60);
}
function endTour(){
  if(!TOUR) return;
  S.tours = S.tours || {}; S.tours[TOUR.name] = true; save();
  $('tourOverlay').style.display = 'none'; TOUR = null;
}
$('tourNext').addEventListener('click', () => { if(TOUR.i >= TOUR.steps.length - 1) endTour(); else { TOUR.i++; showTourStep(); } });
$('tourPrev').addEventListener('click', () => { if(TOUR.i > 0){ TOUR.i--; showTourStep(); } });
$('tourSkip').addEventListener('click', endTour);
window.addEventListener('resize', () => { if(TOUR) showTourStep(); });
$('tourAgainBtn').addEventListener('click', () => { closeModal('settingsModal'); if(!session.task) return; setTimeout(() => startTour(session.task.pro ? 'pro' : 'basic'), 250); });
function maybeTour(t, practice){
  if(practice || SENSORMODE) return;
  S.tours = S.tours || {};
  const name = t.pro ? 'pro' : 'basic';
  if(!S.tours[name]) setTimeout(() => { if(session.task === t && !TOUR) startTour(name); }, 500);
}

/* ---- Handbuch-Suche + Glossar-Seite ---- */
if(!MANUAL.find(m => m.id === 'glossar')){
  MANUAL.push({ id:'glossar', title:'Glossar A–Z', page: MANUAL.length + 1,
    html: '<p>Alle Fachbegriffe des Spiels auf einen Blick. Im Aufgabentext sind sie unterstrichen — zeige darauf oder tippe sie an.</p><dl class="glossary">' + Object.keys(GLOSSARY).sort((a, b) => a.localeCompare(b, 'de')).map(k => '<dt>' + esc(k) + '</dt><dd>' + esc(GLOSSARY[k]) + '</dd>').join('') + '</dl>' });
}
function stripHtml(h){ const d = document.createElement('div'); d.innerHTML = h; return d.textContent || ''; }
const MAN_TEXT = {}; MANUAL.forEach(m => MAN_TEXT[m.id] = (m.title + ' ' + stripHtml(m.html)).toLowerCase());
let manQuery = '';
$('manualSearch').addEventListener('input', e => {
  manQuery = e.target.value.trim().toLowerCase();
  let hits = 0;
  $('manualNav').querySelectorAll('.manual-nav-item').forEach(b => {
    const txt = MAN_TEXT[b.dataset.id] || '';
    const n = manQuery ? txt.split(manQuery).length - 1 : 0;
    const show = !manQuery || n > 0;
    b.style.display = show ? '' : 'none';
    let badge = b.querySelector('.man-hits'); if(badge) badge.remove();
    if(manQuery && n){ hits++; badge = document.createElement('span'); badge.className = 'man-hits'; badge.textContent = n; b.appendChild(badge); }
  });
  $('manualHits').textContent = manQuery ? (hits ? hits + ' Seite' + (hits > 1 ? 'n' : '') : 'keine Treffer') : '';
  const first = [...$('manualNav').querySelectorAll('.manual-nav-item')].find(b => b.style.display !== 'none');
  if(manQuery && first) showManual(first.dataset.id);
});
function markManualQuery(){
  if(!manQuery || manQuery.length < 2) return;
  const root = $('manualContent');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
  let first = null;
  nodes.forEach(node => {
    const txt = node.nodeValue, low = txt.toLowerCase(); let i = low.indexOf(manQuery); if(i < 0) return;
    const frag = document.createDocumentFragment(); let last = 0;
    while(i >= 0){ frag.appendChild(document.createTextNode(txt.slice(last, i))); const mk = document.createElement('mark'); mk.textContent = txt.slice(i, i + manQuery.length); frag.appendChild(mk); if(!first) first = mk; last = i + manQuery.length; i = low.indexOf(manQuery, last); }
    frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
  if(first) first.scrollIntoView({ block:'center' });
}

/* ---- Symbolleiste (Handy) ---- */
if(AWLMODE) $('symBar').innerHTML = ['U ','UN ','O ','ON ','= ','S ','R ','L ','T ','U(', ')', 'FP ', 'SPB ', '#', '"', 'S5T#'].map(x => '<button data-ins="' + esc(x.replace(/\($/, '(\n')) + '">' + esc(x.trim()) + '</button>').join('') + '<button data-ins="  ">⇥</button>';
$('symBar').addEventListener('mousedown', e => { if(e.target.closest('button')) e.preventDefault(); });
$('symBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if($('codeEditor').readOnly) return;
  editor.insertAtCursor(b.dataset.ins);
  if(b.dataset.back){ const ta = $('codeEditor'); ta.selectionStart = ta.selectionEnd = ta.selectionStart - 1; }
});

/* ---- Als App installieren ---- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').style.display = ''; });
$('installBtn').addEventListener('click', async () => { if(!installEvt) return; installEvt.prompt(); try{ await installEvt.userChoice; }catch(e){} installEvt = null; $('installBtn').style.display = 'none'; });
const PORTAL = !!window.SPSQ_PORTAL && /^https?:$/.test(location.protocol);   // Version im SPS-Quest-Portal (web/scl/)
if(/^https?:$/.test(location.protocol)){
  const ml = document.createElement('link'); ml.rel = 'manifest'; ml.href = 'manifest.webmanifest'; document.head.appendChild(ml);
  const ai = document.createElement('link'); ai.rel = 'apple-touch-icon'; ai.href = 'icon-192.png'; document.head.appendChild(ai);
}
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load', () => { navigator.serviceWorker.register(PORTAL ? '../sw.js' : 'sw.js').catch(() => {}); });
}

/* ---------- KONTO: Spielstand mit dem Portal-Konto abgleichen ----------
   Nur in der Portal-Version. Ohne Anmeldung oder offline läuft alles wie bisher lokal.
   SYNC_KEY merkt sich, zu welchem Konto der lokale Spielstand gehört (wichtig an geteilten Schul-PCs). */
const SYNC_KEY = 'spsquest_sync_' + Q.id;
var ACCT = (() => {
  let user = null, timer = 0, busy = false, again = false;
  const api = (method, url, body) => fetch('/api/' + url, { method, credentials:'same-origin', keepalive: method === 'PUT' && JSON.stringify(body || '').length < 60000,
    headers: { 'content-type':'application/json', 'x-spsquest':'1' }, body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(d => ({ status: r.status, data: d })));
  const getSync = () => { try{ return JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {}; }catch(e){ return {}; } };
  const setSync = o => { try{ localStorage.setItem(SYNC_KEY, JSON.stringify(o)); }catch(e){} };
  const count = st => st ? Object.keys(st.doneTasks || {}).length + Object.keys(st.doneTheory || {}).length : 0;
  function summary(){
    const it = SEQ[Math.min(S.pos, SEQ.length - 1)];
    return { tasks: Object.keys(S.doneTasks).length, theory: Object.keys(S.doneTheory).length, points: totalScore(),
      stars: Object.values(S.doneTasks).reduce((a, d) => a + (d.stars || 0), 0), ch: it ? it.ch : 15,
      totalTasks: TOTAL_TASKS, totalTheory: TOTAL_THEORY, lastAt: Date.now(),
      current: S.pos >= SEQ.length ? 'fertig' : 'Kapitel ' + it.ch + (it.type === 'task' ? ' · Aufgabe ' + TASK_NO[it.id] : ' · Theorie') };
  }
  function adopt(state, updatedAt){
    const keep = { settings: S.settings, name: S.name };
    S = Object.assign(defaultState(), state || {}); S.settings = Object.assign(defaultSettings(), keep.settings); S.name = keep.name || '';
    try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
    setSync({ user: user.username, base: updatedAt || 0, dirty: false });
    applySettings(); renderHeader();
    if($('titleScreen').style.display !== 'none') showTitle();
  }
  async function push(force){
    if(!user || user.role === 'admin') return;
    if(busy){ again = true; return; }
    busy = true;
    try{
      const sy = getSync();
      const sum = summary();
      const r = await api('PUT', 'progress/' + Q.id, { state: S, summary: sum, base: sy.base || 0, force: !!force });
      if(r.status === 200) setSync({ user: user.username, base: r.data.updatedAt, dirty: false, summary: sum });
      else if(r.status === 409){
        const g = await api('GET', 'progress/' + Q.id);
        if(g.status === 200 && g.data.state && count(g.data.state) > count(S)){
          adopt(g.data.state, g.data.updatedAt);
          toast('🔄', 'Spielstand abgeglichen', 'Auf einem anderen Gerät warst du schon weiter — dieser Stand wird jetzt verwendet.');
        } else { busy = false; return push(true); }
      } else if(r.status === 401){ user = null; renderAcct(); }
    }catch(e){ /* offline: bleibt "dirty" und wird später übertragen */ }
    busy = false;
    if(again){ again = false; schedule(); }
  }
  function schedule(){ clearTimeout(timer); timer = setTimeout(push, 3000); }
  function changed(){
    if(!user) return;
    const sy = getSync(); sy.user = user.username; sy.dirty = true; sy.summary = summary(); setSync(sy);
    schedule();
  }
  async function start(){
    let r;
    try{ r = await api('GET', 'me'); }catch(e){ renderAcct(true); return; }
    if(r.status !== 200 || !r.data.user){ renderAcct(r.status !== 200); return; }
    user = r.data.user;
    renderAcct();
    if(user.role === 'admin') return;
    const g = await api('GET', 'progress/' + Q.id).catch(() => null);
    if(!g || g.status !== 200) return;
    const srv = g.data.state, srvAt = g.data.updatedAt || 0, sy = getSync();
    const localHas = count(S) > 0 || (S.seenIntro || []).length > 0;
    if(sy.user && sy.user.toLowerCase() === user.username.toLowerCase()){
      if(srv && srvAt > (sy.base || 0)){
        if(sy.dirty && count(S) > count(srv)) return push(true);
        adopt(srv, srvAt);
      } else if(sy.dirty || !srv) push();
      return;
    }
    // Lokaler Stand gehört niemandem (oder einem anderen Konto)
    if(sy.user){                       // anderes Konto: nie mischen
      try{ localStorage.setItem(KEY + '_' + sy.user.toLowerCase(), JSON.stringify(S)); }catch(e){}
      if(srv) adopt(srv, srvAt); else { adopt(defaultState(), 0); push(true); }
      return;
    }
    if(!localHas){ if(srv) adopt(srv, srvAt); else { setSync({ user: user.username, base: 0, dirty: true }); push(true); } return; }
    if(!srv){
      const yes = await confirmBox('<b>Spielstand ins Konto übernehmen?</b><br>In diesem Browser gibt es schon einen ' + Q.name + '-Spielstand (' + count(S) + ' gelöste Aufgaben/Theorien). Soll er in dein Konto <b>' + esc(user.username) + '</b> übernommen werden?', { yes:'Übernehmen', no:'Neu beginnen' });
      if(!yes){ try{ localStorage.setItem(KEY + '_lokal', JSON.stringify(S)); }catch(e){} adopt(defaultState(), 0); }
      setSync({ user: user.username, base: 0, dirty: true }); push(true);
      return;
    }
    const useLocal = await confirmBox('<b>Welcher Spielstand soll gelten?</b><br>Konto <b>' + esc(user.username) + '</b>: ' + count(srv) + ' gelöst · dieser Browser: ' + count(S) + ' gelöst.<br><small>Der andere Stand wird überschrieben.</small>', { yes:'Browser-Spielstand', no:'Konto-Spielstand' });
    if(useLocal){ setSync({ user: user.username, base: srvAt, dirty: true }); push(true); }
    else { try{ localStorage.setItem(KEY + '_lokal', JSON.stringify(S)); }catch(e){} adopt(srv, srvAt); }
  }
  function renderAcct(offline){
    const el = $('acctChip'); if(!el) return;
    el.style.display = '';
    if(user){ el.innerHTML = '<i class="fa-solid fa-user-astronaut"></i> <span class="btn-text">' + esc(user.username) + '</span>'; el.title = 'Angemeldet als ' + user.username + ' — Fortschritt wird im Konto gespeichert. Klick: Portal'; el.classList.add('on'); }
    else { el.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span class="btn-text">' + (offline ? 'offline' : 'Anmelden') + '</span>'; el.title = offline ? 'Keine Verbindung — der Fortschritt bleibt in diesem Browser.' : 'Im SPS-Quest-Portal anmelden, um den Fortschritt im Konto zu speichern'; el.classList.remove('on'); }
    const tf = $('titleAcct');
    if(tf) tf.innerHTML = user ? 'Angemeldet als <b>' + esc(user.username) + '</b> · Fortschritt wird im Konto gespeichert · <a href="../">Portal</a>'
      : 'Ohne Konto bleibt der Fortschritt in diesem Browser · <a href="../#/login">Anmelden im Portal</a>';
  }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && user && getSync().dirty){ clearTimeout(timer); push(); } });
  window.addEventListener('online', () => { if(user && getSync().dirty) push(); });
  let ready = null;
  return { start(){ return ready = start(); }, get ready(){ return ready; }, changed, push, get user(){ return user; }, summary };
})();
/* ---------- LIVE-CHALLENGE (Portal-Version, scl/?live=ID) ----------
   Aufgabe erst nach dem Start zeigen, Versuche/Hinweise/Lösung an den Worker melden, alle 2,5 s den Stand abfragen. */
var LIVE = (() => {
  const id = PORTAL ? +(new URLSearchParams(location.search).get('live') || 0) : 0;
  let ch = null, me = null, top = [], info = {}, timer = 0, tick = 0, offset = 0, started = false, done = false, sending = Promise.resolve();
  const api = (method, url, body) => fetch('/api/' + url, { method, credentials:'same-origin', headers:{ 'content-type':'application/json', 'x-spsquest':'1' }, body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(d => ({ status: r.status, data: d })));
  const fmt = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  const left = () => ch && ch.state === 'running' ? (ch.endsAt - (Date.now() + offset)) / 1000 : 0;
  function overlay(html){
    let o = $('liveOverlay');
    if(!o){ o = document.createElement('div'); o.id = 'liveOverlay'; o.className = 'fullscreen-overlay live-overlay'; o.setAttribute('role', 'dialog'); document.body.appendChild(o); }
    o.innerHTML = '<div class="live-card">' + html + '</div>'; o.style.display = 'flex';
  }
  const hideOverlay = () => { const o = $('liveOverlay'); if(o) o.style.display = 'none'; };
  const modeName = () => ch.mode === 'bug' ? 'Störungsjagd' : 'Sprint';
  function bar(){
    let b = $('liveBar');
    if(!b){ b = document.createElement('div'); b.id = 'liveBar'; b.className = 'live-bar'; b.setAttribute('role', 'status'); document.body.appendChild(b); document.body.classList.add('has-live-bar'); }
    const l = left();
    b.innerHTML = '<span class="lb-live"><i></i>LIVE</span><span class="lb-mode">' + modeName() + '</span><span class="lb-time' + (l < 60 ? ' low' : '') + '"><i class="fa-regular fa-clock"></i> ' + fmt(l) + '</span>'
      + '<span>' + (me && me.solved ? '<b class="lb-ok"><i class="fa-solid fa-check"></i> gelöst · ' + me.points + ' P' + (me.rank ? ' · Rang ' + me.rank : '') + '</b>' : 'Versuche ' + (me ? me.attempts : 0) + ' · Hinweise ' + (me ? me.hints : 0)) + '</span>'
      + '<span class="lb-count">' + (info.solved || 0) + '/' + (info.players || 0) + ' gelöst</span>';
    if(me) $('attemptsLabel').textContent = 'Versuche: ' + me.attempts;
  }
  function board(){
    const pod = top.slice(0, 3);
    overlay('<div class="live-eyebrow">LIVE-CHALLENGE · ' + modeName().toUpperCase() + '</div><h2>' + (ch.state === 'ended' ? 'Challenge beendet' : 'Rangliste') + '</h2>'
      + (me && me.solved ? '<p class="live-big">Rang <b>' + (me.rank || '–') + '</b> · ' + me.points + ' Punkte</p>' : '<p class="live-big">' + (ch.state === 'ended' ? 'Diesmal nicht gelöst — beim nächsten Mal!' : 'Noch nicht gelöst') + '</p>')
      + (pod.length ? '<div class="podium">' + [1, 0, 2].filter(i => pod[i]).map(i => '<div class="pod p' + (i + 1) + '"><div class="pod-name">' + esc(pod[i].username) + '</div><div class="pod-pts">' + pod[i].points + ' P</div><div class="pod-step">' + (i + 1) + '</div></div>').join('') + '</div>' : '')
      + (top.length > 3 ? '<ol class="live-list" start="4">' + top.slice(3).map(p => '<li>' + esc(p.username) + ' <span>' + p.points + ' P</span></li>').join('') + '</ol>' : '')
      + '<div class="live-actions">' + (ch.state === 'running' ? '<button class="btn" id="liveBack">Zurück zur Aufgabe</button>' : '') + '<a class="compile-btn" href="../#/live">Zum Portal</a></div>');
    const bk = $('liveBack'); if(bk) bk.onclick = hideOverlay;
  }
  function begin(){
    if(started) return; started = true;
    const t = TASK_BY_ID[ch.taskId];
    if(!t){ overlay('<h2>Aufgabe nicht gefunden</h2><p>Diese Challenge nutzt eine Aufgabe, die es in dieser Version nicht gibt. Bitte die Seite neu laden.</p>'); return; }
    $('titleScreen').style.display = 'none'; $('app').style.display = '';
    renderTask(t, true);
    session.live = { id };
    if(ch.mode === 'bug'){
      const b = (C.bugs || []).find(x => x.id === ch.bugId);
      if(b){
        const code = t.workshop ? null : window.bugCode(t, b);   // Werkstatt: der Fehler steckt schon im Ausgangszustand der Aufgabe
        if(t.workshop){ }
        else if(t.pro){ PS.codes = code; PS.view = 'code'; showProBlock(PS.active); } else { editor.setValue(code); liveCheck(code); }
        $('storyText').innerHTML = '<b class="live-alarm"><i class="fa-solid fa-triangle-exclamation"></i> STÖRUNGSMELDUNG: ' + esc(b.title) + '</b><br>' + esc(b.symptom) + '<br><small>' + (t.workshop ? 'Der Prüfstand zeigt die Störung. Finde die Ursache, behebe sie und lass die Arbeit prüfen.' : 'Die Anlage läuft mit dem Programm im Editor. Finde den Fehler und behebe ihn — die Testfälle zeigen, ob die Anlage wieder richtig arbeitet.') + '</small>';
        $('taskTags').innerHTML += '<span class="tag tag-debug"><i class="fa-solid fa-bug"></i> Störungsjagd</span>';
      }
    } else $('taskTags').innerHTML += '<span class="tag tag-boss"><i class="fa-solid fa-bolt"></i> Sprint</span>';
    $('radioLog').innerHTML = '';
    meister('<b>Live-Challenge gestartet!</b> ' + (ch.mode === 'bug' ? 'Die Anlage hat eine Störung — finde sie.' : 'Löse die Aufgabe so schnell und sauber wie möglich.') + ' Fehlversuche und Hinweise kosten Punkte.');
    hideOverlay(); bar();
  }
  async function refresh(){
    let r;
    try{ r = await api('GET', 'live/' + id); }catch(e){ return; }
    if(r.status === 401){ overlay('<h2>Nicht angemeldet</h2><p>Für die Live-Challenge brauchst du dein Konto.</p><div class="live-actions"><a class="compile-btn" href="../#/login">Anmelden</a></div>'); stop(); return; }
    if(r.status !== 200){ overlay('<h2>Live-Challenge</h2><p>' + esc(r.data.error || 'Fehler') + '</p><div class="live-actions"><a class="compile-btn" href="../#/live">Code eingeben</a></div>'); stop(); return; }
    ch = r.data.challenge; me = r.data.me; top = r.data.top || []; info = { players: r.data.players, solved: r.data.solved };
    if(ch.quest && ch.quest !== Q.id){ stop(); location.replace('../' + ch.quest + '/?live=' + id); return; }   // Challenge gehört zu einer anderen Quest
    offset = ch.serverTime - Date.now();
    if(ch.state === 'lobby') overlay('<div class="live-eyebrow">LIVE-CHALLENGE · ' + modeName().toUpperCase() + '</div><h2>Gleich geht es los</h2><p class="live-big"><span class="live-pulse"></span> Warte auf den Start …</p><p>' + info.players + ' Teilnehmende · ' + fmt(ch.duration) + ' min Zeit</p><p class="live-small">Angemeldet als <b>' + esc(ACCT.user ? ACCT.user.username : '') + '</b></p>');
    else if(ch.state === 'running'){ begin(); bar(); }
    else if(ch.state === 'ended' && !done){ done = true; if(started) bar(); board(); stop(); }
  }
  function stop(){ clearInterval(timer); clearInterval(tick); }
  async function start(){
    if(!id) return;
    document.body.classList.add('live-mode');
    overlay('<h2>Live-Challenge</h2><p class="live-big"><span class="live-pulse"></span> Verbinde …</p>');
    await refresh();
    timer = setInterval(refresh, 2500);
    tick = setInterval(() => { if(ch && ch.state === 'running' && started){ bar(); if(left() <= 0) refresh(); } }, 1000);
  }
  function attempt(ok, code){
    if(!id || !ch || ch.state !== 'running') return;
    if(me){ me.attempts++; }
    sending = sending.then(() => api('POST', 'live/' + id + '/attempt', { ok, code: ok ? code : undefined })).then(r => {
      if(r && r.data && r.data.solved){ me.solved = true; me.points = r.data.points; bar(); if(ok) $('successPoints').textContent = '+' + r.data.points + ' Punkte in der Live-Challenge'; refresh(); }
    }).catch(() => {});
    bar();
  }
  function hint(){ if(!id || !ch || ch.state !== 'running') return; if(me) me.hints++; bar(); sending = sending.then(() => api('POST', 'live/' + id + '/hint', {})).catch(() => {}); }
  return { id, start, attempt, hint, board: () => ch && board() };
})();
/* ---------- PRÜFUNG (Zertifikat): <quest>/?exam=ID ----------
   Der Server zieht die Aufgaben, führt die Zeit und bewertet jede Abgabe mit verdeckten Tests.
   Lokal läuft nur „Testen“ mit den sichtbaren Beispiel-Tests. Gesperrt: Hinweise, Musterlösung, Vergleich, Karte, Live-Challenge, Tour. */
var EXAM = (() => {
  const id = PORTAL ? +(new URLSearchParams(location.search).get('exam') || 0) : 0;
  const X = window.SPSQExam;
  let ex = null, tasks = [], questions = [], answers = {}, codes = {}, sent = {}, results = {}, cur = -1, offset = 0, tick = 0, finishing = false, lastFocus = 0;
  const LEVEL = { grund: 'Grundstufe', profi: 'Profi-Stufe' };
  const store = () => { try{ localStorage.setItem('spsq_exam_' + id, JSON.stringify(codes)); }catch(e){} };
  const api = (method, url, body) => fetch('/api/' + url, { method, credentials:'same-origin', headers:{ 'content-type':'application/json', 'x-spsquest':'1' }, body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(d => ({ status: r.status, data: d })));
  const left = () => ex ? (ex.deadline - (Date.now() + offset)) / 1000 : 0;
  const fmt = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  function overlay(html){
    let o = $('examOverlay');
    if(!o){ o = document.createElement('div'); o.id = 'examOverlay'; o.className = 'fullscreen-overlay live-overlay exam-overlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); document.body.appendChild(o); }
    o.innerHTML = '<div class="live-card">' + html + '</div>'; o.style.display = 'flex';
    const f = o.querySelector('button, a'); if(f) setTimeout(() => f.focus(), 30);
    return o;
  }
  const hideOverlay = () => { const o = $('examOverlay'); if(o) o.style.display = 'none'; };
  const status = t => { const r = results[t.id]; if(!r) return sent[t.id] !== undefined ? 'sent' : 'open'; return r.ok ? 'ok' : (r.passed ? 'part' : 'fail'); };
  const dirty = t => t && codes[t.id] !== undefined && JSON.stringify(codes[t.id]) !== JSON.stringify(sent[t.id]);
  function bar(){
    let b = $('examBar');
    if(!b){ b = document.createElement('div'); b.id = 'examBar'; b.className = 'exam-bar'; b.setAttribute('role', 'navigation'); b.setAttribute('aria-label', 'Prüfung'); document.body.appendChild(b); document.body.classList.add('has-exam-bar'); }
    const l = left(), answered = questions.filter(q => answers[q.id] !== undefined).length;
    const ICON = { open: '', sent: '<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>', ok: '<i class="fa-solid fa-check" aria-hidden="true"></i>', part: '<i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i>', fail: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' };
    const TXT = { open: 'offen', sent: 'abgegeben', ok: 'bestanden', part: 'teilweise', fail: 'nicht bestanden' };
    b.innerHTML = '<span class="eb-tag"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> PRÜFUNG</span><span class="eb-mode">' + esc(Q.name.replace(/ Quest$/, '')) + ' ' + LEVEL[ex.level] + (ex.proctored ? ' · unter Aufsicht' : '') + '</span>'
      + '<span class="eb-time' + (l < 300 ? ' low' : '') + '" title="Restzeit"><i class="fa-regular fa-clock" aria-hidden="true"></i> ' + fmt(l) + '</span>'
      + '<span class="eb-nav">' + tasks.map((t, i) => { const st = status(t) + (dirty(t) ? ' dirty' : ''); return '<button class="eb-item st-' + st + (i === cur ? ' cur' : '') + '" data-i="' + i + '" title="Aufgabe ' + (i + 1) + ': ' + esc(t.title) + ' – ' + TXT[status(t)] + (dirty(t) ? ', Änderungen nicht abgegeben' : '') + '" aria-label="Aufgabe ' + (i + 1) + ', ' + TXT[status(t)] + '"' + (i === cur ? ' aria-current="true"' : '') + '>' + (i + 1) + ICON[status(t)] + '</button>'; }).join('')
      + '<button class="eb-item eb-th' + (cur === -2 ? ' cur' : '') + '" data-i="th" title="Theoriefragen">Theorie ' + answered + '/' + questions.length + '</button></span>'
      + (cur >= 0 ? '<button class="btn eb-send" id="examSend"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Abgeben</button>' : '')
      + '<button class="btn eb-finish" id="examFinish"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Abschliessen</button>';
    b.querySelectorAll('.eb-item').forEach(x => x.onclick = () => x.dataset.i === 'th' ? showTheory() : show(+x.dataset.i));
    if($('examSend')) $('examSend').onclick = () => send();
    $('examFinish').onclick = () => finish(false);
  }
  function capture(){
    const t = tasks[cur]; if(!t) return;
    if(t.kind === 'profi'){ if(PS && PS.view === 'table') applyDeclTable(); if(PS) codes[t.id] = Object.assign({}, PS.codes); }
    else codes[t.id] = editor.getValue();
    store();
  }
  function taskOf(pub){ return X.toTask(Object.assign({}, pub, { hidden: pub.kind === 'grund' ? [] : { unit: [], tests: [], timed: [] } }), 'visible'); }
  function show(i){
    if(cur >= 0) capture();
    hideTheory();
    cur = i; const pub = tasks[i], t = taskOf(pub);
    $('titleScreen').style.display = 'none'; $('app').style.display = '';
    renderTask(t, true);
    session.exam = { id, item: pub.id };
    if(codes[pub.id] !== undefined){
      if(pub.kind === 'profi'){ Object.assign(PS.codes, codes[pub.id]); showProBlock(PS.active); }
      else { editor.setValue(codes[pub.id]); liveCheck(codes[pub.id]); }
    }
    $('taskIdLabel').textContent = 'PRÜFUNGSAUFGABE ' + (i + 1) + '/' + tasks.length;
    $('taskTags').innerHTML = '<span class="tag tag-boss"><i class="fa-solid fa-graduation-cap"></i> Prüfung</span>' + (t.pro ? '<span class="tag tag-pro"><i class="fa-solid fa-industry"></i> Profi</span>' : '');
    $('storyText').innerHTML = pub.story || 'Prüfungsaufgabe zu Kapitel ' + pub.ch + '. <b>Testen</b> prüft deinen Code mit den sichtbaren Beispiel-Tests, <b>Abgeben</b> lässt ihn vom Prüfserver mit verdeckten Tests bewerten.';
    $('learnGoal').innerHTML = '<b>Prüfung</b>Handbuch und Glossar sind erlaubt. Mehrfach abgeben ist möglich – es zählt die letzte Abgabe vor Ablauf der Zeit.';
    renderResult();
    $('radioLog').innerHTML = '';
    meister('Aufgabe <b>' + (i + 1) + '</b>: ' + esc(pub.title) + '. Viel Erfolg!');
    bar();
    document.querySelector('.panel-left').scrollTop = 0;
  }
  function renderResult(){
    const t = tasks[cur]; if(!t) return;
    let box = $('examResult');
    if(!box){ box = document.createElement('div'); box.id = 'examResult'; box.setAttribute('aria-live', 'polite'); }
    $('taskDescription').appendChild(box);
    const r = results[t.id];
    if(!r){ box.className = 'exam-result'; box.innerHTML = sent[t.id] !== undefined ? '<i class="fa-solid fa-hourglass-half"></i> Abgegeben – Bewertung ausstehend.' : '<i class="fa-regular fa-circle"></i> Noch nicht abgegeben.'; return; }
    box.className = 'exam-result ' + (r.ok ? 'ok' : 'bad');
    box.innerHTML = r.error && !r.passed ? '<i class="fa-solid fa-triangle-exclamation"></i> <b>Letzte Abgabe:</b> ' + (r.error.line ? 'Zeile ' + r.error.line + (r.error.block ? ' (' + esc(r.error.block) + ')' : '') + ': ' : '') + esc(r.error.message)
      : (r.ok ? '<i class="fa-solid fa-check"></i> <b>Letzte Abgabe:</b> alle ' + r.total + ' Prüf-Tests bestanden.' : '<i class="fa-solid fa-xmark"></i> <b>Letzte Abgabe:</b> ' + r.passed + ' von ' + r.total + ' Prüf-Tests bestanden.'
        + (r.missing && r.missing.length ? ' Gefordert, aber nicht verwendet: ' + r.missing.map(esc).join(', ') + '.' : '') + (r.warn && r.warn.length ? ' Warnungen: ' + r.warn.map(esc).join(', ') + '.' : ''));
  }
  async function sendItem(itemId, answer){
    for(let n = 0; n < 3; n++){
      let r;
      try{ r = await api('POST', 'exams/' + id + '/answer', { item: itemId, answer }); }catch(e){ r = null; }
      if(r && r.status === 200) return r.data;
      if(r && (r.status === 409 || r.status === 404 || r.status === 400 || r.status === 413)) throw new Error(r.data.error || 'Fehler');
      await new Promise(res => setTimeout(res, 800 * (n + 1)));   // Netz / CPU-Grenze: später erneut
    }
    throw new Error('Keine Verbindung zum Prüfserver. Die Abgabe bleibt im Browser gespeichert.');
  }
  async function send(){
    const t = tasks[cur]; if(!t) return;
    capture();
    const btn = $('examSend'); if(btn) btn.disabled = true;
    meister('Abgabe wird geprüft …');
    try{
      const d = await sendItem(t.id, codes[t.id]);
      sent[t.id] = codes[t.id]; results[t.id] = d.result;
      meister(d.result.ok ? '<b>Abgabe bestanden.</b> Alle verdeckten Prüf-Tests sind grün.' : 'Abgabe bewertet: ' + d.result.passed + ' von ' + d.result.total + ' Prüf-Tests bestanden.', d.result.ok ? 'success' : 'warning');
      if(d.result.error && d.result.error.line && !t.pro && editor.setErrorMark) editor.setErrorMark(d.result.error.line, d.result.error.col || 1, d.result.error.message);
    }catch(e){ meister(esc(e.message), 'warning'); }
    renderResult(); bar();
  }
  function localOk(t, code, res){
    flashEditor(true); SFX.ok();
    if(t.pro) renderProReport(t, res); else renderReport(t, res, []);
    (t.pro ? playRunPro : playRun)(t, res, true, () => {});
    meister('Die <b>Beispiel-Tests</b> sind grün. Jetzt <b>Abgeben</b> – der Prüfserver bewertet mit weiteren, verdeckten Tests.', 'success');
  }
  function changed(){ if(cur >= 0){ const t = tasks[cur]; if(t){ capture(); bar(); } } }
  /* ---- Theorie ---- */
  function showTheory(){
    if(cur >= 0) capture();
    cur = -2; bar();
    let o = $('examTheory');
    if(!o){ o = document.createElement('div'); o.id = 'examTheory'; o.className = 'fullscreen-overlay exam-theory'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Theoriefragen'); document.body.appendChild(o); }
    o.innerHTML = '<div class="theory-card"><div class="theory-head"><div><div class="intro-eyebrow">PRÜFUNG · THEORIE</div><h2>Theoriefragen</h2></div></div><div class="theory-body">'
      + '<p class="exam-note">Wähle je Frage eine Antwort. Die Antworten werden sofort gespeichert und erst beim Abschluss bewertet.</p>'
      + questions.map((q, qi) => '<fieldset class="exam-q"><legend><span class="q-no">' + (qi + 1) + '</span> ' + q.q + '</legend>' + q.options.map((op, oi) => '<label class="exam-opt"><input type="radio" name="xq_' + qi + '" value="' + oi + '" data-q="' + esc(q.id) + '"' + (answers[q.id] === oi ? ' checked' : '') + '> <span>' + op + '</span></label>').join('') + '</fieldset>').join('')
      + '<div class="live-actions"><button class="compile-btn" id="examTheoryBack"><i class="fa-solid fa-arrow-left"></i> Zurück zu den Aufgaben</button></div></div></div>';
    o.style.display = 'flex'; o.scrollTop = 0;
    o.querySelectorAll('input[type=radio]').forEach(r => r.onchange = async () => {
      const qid = r.dataset.q, v = +r.value; answers[qid] = v; bar();
      try{ await sendItem(qid, v); }catch(e){ meister(esc(e.message), 'warning'); }
    });
    $('examTheoryBack').onclick = () => show(Math.max(0, tasks.findIndex(t => status(t) !== 'ok')));
  }
  function hideTheory(){ const o = $('examTheory'); if(o) o.style.display = 'none'; }
  /* ---- Abschluss ---- */
  async function finish(auto){
    if(finishing) return;
    if(!auto){
      const open = tasks.filter(t => status(t) === 'open').length, unanswered = questions.filter(q => answers[q.id] === undefined).length;
      const ok = await confirmBox('<b>Prüfung abschliessen?</b><br>' + (open ? open + ' Aufgabe(n) noch nicht abgegeben. ' : '') + (unanswered ? unanswered + ' Theoriefrage(n) unbeantwortet. ' : '') + 'Nicht abgegebene Änderungen werden jetzt automatisch abgegeben. Danach ist keine Änderung mehr möglich.', { yes:'Abschliessen' });
      if(!ok) return;
    }
    finishing = true;
    if(cur >= 0) capture();
    overlay('<div class="live-eyebrow">PRÜFUNG</div><h2>Abschluss …</h2><p class="live-big"><span class="live-pulse"></span> Letzte Abgaben werden bewertet</p>');
    if(left() > -25) for(const t of tasks){ if(dirty(t)){ try{ const d = await sendItem(t.id, codes[t.id]); sent[t.id] = codes[t.id]; results[t.id] = d.result; }catch(e){} } }
    let r;
    for(let n = 0; n < 5; n++){
      r = await api('POST', 'exams/' + id + '/submit', {}).catch(() => null);
      if(r && r.status === 409 && r.data.pending){ for(const pid of r.data.pending){ try{ await sendItem(pid, sent[pid] !== undefined ? sent[pid] : codes[pid]); }catch(e){} } continue; }
      break;
    }
    finishing = false;
    if(!r || r.status !== 200){ overlay('<h2>Abschluss nicht möglich</h2><p>' + esc((r && r.data && r.data.error) || 'Keine Verbindung zum Prüfserver.') + '</p><div class="live-actions"><button class="compile-btn" id="examRetry">Erneut versuchen</button></div>'); $('examRetry').onclick = () => finish(true); return; }
    try{ localStorage.removeItem('spsq_exam_' + id); }catch(e){}
    load(r.data);
  }
  function resultScreen(){
    clearInterval(tick);
    const b = $('examBar'); if(b) b.remove(); document.body.classList.remove('has-exam-bar');
    hideTheory();
    if(ex.state === 'voided'){
      overlay('<div class="live-eyebrow">PRÜFUNG</div><h2>Prüfung annulliert</h2><p>Die Lehrperson hat diese Prüfung annulliert.</p><p class="live-small">Begründung: ' + esc(ex.voidReason || '–') + '</p><div class="live-actions"><a class="compile-btn" href="../#/zertifikate">Zum Portal</a></div>');
      return;
    }
    const res = ex.result || {}, pct = v => Math.round((v || 0) * 100);
    const chs = (res.weakChapters || []).map(n => chapterOf(n)).map(c => '<li><b>Kapitel ' + c.n + '</b> · ' + esc(c.title) + '</li>').join('');
    overlay('<div class="live-eyebrow">PRÜFUNG · ' + esc(Q.name.replace(/ Quest$/, '').toUpperCase()) + ' ' + LEVEL[ex.level].toUpperCase() + '</div>'
      + '<h2>' + (res.passed ? (res.distinction ? 'Bestanden – mit Auszeichnung!' : 'Bestanden!') : 'Nicht bestanden') + '</h2>'
      + '<p class="live-big"><b>' + pct(res.score) + ' %</b> <span class="live-small">(bestanden ab 70 %)</span></p>'
      + '<table class="exam-sum"><tr><td>Programmieraufgaben (70 %)</td><td>' + pct(res.tasks) + ' %</td></tr><tr><td>Theorie (30 %)</td><td>' + (res.theoryRight || 0) + ' / ' + (res.theoryTotal || 0) + '</td></tr>'
      + (res.perTask || []).map((t, i) => '<tr class="sub"><td>' + (i + 1) + '. ' + esc(t.title) + '</td><td>' + pct(t.points) + ' %</td></tr>').join('') + '</table>'
      + (ex.state === 'expired' ? '<p class="live-small">Die Zeit war abgelaufen – gewertet wurden die Abgaben bis dahin.</p>' : '')
      + (!res.passed && chs ? '<div class="exam-weak"><b>Das solltest du wiederholen:</b><ul>' + chs + '</ul><p class="live-small">Im Handbuch und in den Theorie-Aufträgen dieser Kapitel findest du alles Nötige. Ein neuer Versuch ist frühestens in 24 Stunden möglich (höchstens 3 in 30 Tagen).</p></div>' : '')
      + '<div class="live-actions">' + (res.passed ? '<a class="compile-btn" href="../#/zertifikate/ausstellen/' + id + '"><i class="fa-solid fa-award"></i> Zertifikat ausstellen</a>' : '')
      + '<button class="btn" id="examManual"><i class="fa-solid fa-book"></i> Handbuch</button><a class="btn" href="../#/zertifikate">Zum Portal</a></div>');
    $('examManual').onclick = () => { hideOverlay(); $('openManualBtn').click(); };
  }
  function load(d){
    ex = Object.assign({}, d.exam, { result: d.result });
    if(ex.quest !== Q.id){ location.replace('../' + ex.quest + '/?exam=' + id); return false; }
    offset = ex.now - Date.now();
    tasks = d.tasks; questions = d.questions;
    Object.keys(d.answers || {}).forEach(k => {
      const a = d.answers[k];
      if(tasks.some(t => t.id === k)){ sent[k] = a.answer; codes[k] = a.answer; if(a.result) results[k] = a.result; }
      else answers[k] = a.answer;
    });
    if(ex.state !== 'running'){ resultScreen(); return false; }
    try{ const loc = JSON.parse(localStorage.getItem('spsq_exam_' + id) || '{}'); Object.keys(loc).forEach(k => { if(tasks.some(t => t.id === k)) codes[k] = loc[k]; }); }catch(e){}
    return true;
  }
  async function start(){
    if(!id) return;
    document.body.classList.add('exam-mode');
    overlay('<div class="live-eyebrow">PRÜFUNG</div><h2>Prüfung wird geladen …</h2><p class="live-big"><span class="live-pulse"></span></p>');
    let r; try{ r = await api('GET', 'exams/' + id); }catch(e){ r = null; }
    if(!r || r.status === 401){ overlay('<h2>Nicht angemeldet</h2><p>Für die Prüfung brauchst du dein Konto.</p><div class="live-actions"><a class="compile-btn" href="../#/login">Anmelden</a></div>'); return; }
    if(r.status !== 200){ overlay('<h2>Prüfung</h2><p>' + esc(r.data.error || 'Fehler') + '</p><div class="live-actions"><a class="compile-btn" href="../#/zertifikate">Zum Portal</a></div>'); return; }
    if(!load(r.data)) return;
    hideOverlay();
    show(Math.max(0, tasks.findIndex(t => status(t) !== 'ok')));
    tick = setInterval(() => {
      if(!ex || ex.state !== 'running') return;
      const b = $('examBar'); const tm = b && b.querySelector('.eb-time');
      const l = left();
      if(tm){ tm.innerHTML = '<i class="fa-regular fa-clock" aria-hidden="true"></i> ' + fmt(l); tm.classList.toggle('low', l < 300); }
      if(l <= 0 && !finishing){ clearInterval(tick); finish(true); }
    }, 1000);
    const lost = () => { if(!ex || ex.state !== 'running' || Date.now() - lastFocus < 5000) return; lastFocus = Date.now(); api('POST', 'exams/' + id + '/focus', {}).catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if(document.hidden) lost(); });
    window.addEventListener('blur', lost);
    window.addEventListener('beforeunload', e => { if(ex && ex.state === 'running' && tasks.some(dirty)){ e.preventDefault(); e.returnValue = ''; } });
  }
  return { id, start, localOk, changed, get active(){ return !!(id && ex && ex.state === 'running'); } };
})();
if(PORTAL){
  const chip = document.createElement('a'); chip.className = 'btn acct-chip'; chip.id = 'acctChip'; chip.href = '../'; chip.style.display = 'none';
  document.querySelector('.header-actions').insertBefore(chip, $('openSettingsBtn'));
  const tf = document.createElement('p'); tf.className = 'title-foot title-acct'; tf.id = 'titleAcct';
  document.querySelector('.title-card').appendChild(tf);
  document.querySelector('.title-card .title-foot').textContent = Q.titleFoot;
  ACCT.start();
  if(LIVE.id) ACCT.ready.then(() => LIVE.start());
  if(EXAM.id) ACCT.ready.then(() => EXAM.start());
}
// Zertifikat & Prüfung: im Portal über die Zertifikatsseite, offline nicht verfügbar
{
  const cb = document.createElement(PORTAL ? 'a' : 'button'); cb.className = 'btn title-cert'; cb.id = 'titleCertBtn';
  cb.innerHTML = '<i class="fa-solid fa-award"></i> Zertifikat &amp; Prüfung';
  if(PORTAL) cb.href = '../#/zertifikate';
  else cb.onclick = () => confirmBox('<b>Zertifikat &amp; Prüfung</b><br>Nur online im Portal <b>SPS Quest</b> verfügbar (mit Konto). Dort legst du pro Quest und Stufe eine Prüfung ab und erhältst ein Zertifikat mit Prüflink.', { yes:'OK', no:'Schliessen' });
  document.querySelector('.title-actions').appendChild(cb);
}

/* Handbuch: Hinweis auf Zertifikat und Prüfung (alle Quests) */
if(!MANUAL.some(m => m.id === 'zertifikat')) MANUAL.push({ id:'zertifikat', page: MANUAL.length ? (MANUAL[MANUAL.length - 1].page || MANUAL.length) + 1 : 1, title:'Zertifikat & Prüfung', html:
  '<h3>Das Spiel-Zertifikat</h3><p>Nach Kapitel 10 und nach Kapitel 15 zeigt ' + esc(Q.name) + ' ein Zertifikat mit deinem Namen. Es bestätigt den Spielfortschritt in diesem Browser – es ist nicht online prüfbar.</p>'
  + '<h3>Zertifikat mit Prüfung (online, Portal SPS Quest)</h3><ul><li>Pro Quest gibt es eine Prüfung für die <b>Grundstufe</b> (60 min, 6 Programmieraufgaben und 12 Theoriefragen) und für die <b>Profi-Stufe</b> (90 min, 4 Aufgaben und 10 Fragen).</li>'
  + '<li>Voraussetzung: im Spiel mindestens 80 % der Aufgaben der Stufe inklusive Final Boss gelöst; für die Profi-Stufe zuerst das Zertifikat der Grundstufe. Unter Aufsicht der Lehrperson entfällt die Spiel-Voraussetzung.</li>'
  + '<li>Die Prüfungsaufgaben sind eigene Aufgaben mit wechselnden Zahlen – die Musterlösungen aus dem Spiel helfen nicht. <b>Testen</b> prüft mit sichtbaren Beispiel-Tests, <b>Abgeben</b> bewertet der Server mit verdeckten Tests (mehrfach möglich, die letzte Abgabe zählt).</li>'
  + '<li>Erlaubt sind Handbuch und Glossar. Hinweise, Musterlösung, Lösungsvergleich und Karte sind gesperrt.</li>'
  + '<li>Bestanden ab 70 % (Aufgaben 70 %, Theorie 30 %), mit Auszeichnung ab 90 %. Ein Versuch pro 24 Stunden, höchstens drei in 30 Tagen.</li>'
  + '<li>Das Zertifikat hat einen Prüfcode und einen QR-Code: Arbeitgeber und Lehrbetriebe prüfen die Echtheit unter <code>/z/Prüfcode</code>.</li></ul>'
  + (PORTAL ? '<p><a href="../#/zertifikate">Zu den Zertifikaten im Portal</a></p>' : '<p><i>Diese Datei läuft offline – Prüfungen gibt es nur online im Portal SPS Quest (mit Konto).</i></p>') });

/* ---------- Start ---------- */
buildManual();
applySettings();
renderHeader();
window.addEventListener('load', () => { let v = '2d'; try{ v = localStorage.getItem(VIEW_KEY) || '2d'; }catch(e){} if(v === '3d') setView('3d', true); });
showTitle();

// Kontext für den Knopf „Feedback / Fehler melden“ (Portal-Version, dev/portal/report.js)
window.SPSQ_REPORT_CONTEXT = () => {
  const vis = id => { const e = $(id); return e && e.style.display !== 'none' && e.offsetParent !== null; };
  let c;
  if(vis('titleScreen')) c = 'Titelbildschirm';
  else if(vis('certificate')) c = 'Zertifikat';
  else if(TH && vis('theoryOverlay')) c = 'Theorie ' + TH.th.id + ' (Kapitel ' + TH.th.ch + ')';
  else if(session.task) c = 'Aufgabe ' + TASK_NO[session.task.id] + ' (' + session.task.id + ', Kapitel ' + session.task.level + ')' + (PS && PS.active ? ' · Baustein ' + PS.active : '');
  else c = 'Spiel';
  if(LIVE && LIVE.id) c += ' · Live-Challenge';
  return { quest: Q.id, context: c };
};

// Test-/Debug-Schnittstelle (für automatisierte Tests)
window.SCLQuest = { ACCT, LIVE, get state(){ return S; }, SEQ, TASKS, THEORY, TASK_NO, compile, goToPos, advance, renderTask, openTheory, editor, get session(){ return session; }, VERSION,
  get pro(){ return PS; }, get sensor(){ return SENSOR; }, showProBlock, setProCodes(codes){ Object.assign(PS.codes, codes); if(PS.view === 'code') editor.setValue(proCode(proBlock(PS.active))); liveCheckPro(); }, openObserve, showCertificate };
})();
