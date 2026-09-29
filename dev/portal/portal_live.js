/* ===== SPS Quest Portal: Live-Challenge (Dozent: anlegen + Beamer, Lernende: beitreten) ===== */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc;
// Aufgaben- und Störungsdaten je Quest (data/<quest>.json + data/<quest>_live.json)
const METAS = {};
let CUR = null;   // Daten der Quest der gerade gezeigten Challenge (Beamer)
function meta(q){
  q = q || 'scl';
  if(!METAS[q]) METAS[q] = Promise.all([P.questMeta(q), fetch('data/' + q + '_live.json').then(r => r.json())]).then(([a, b]) => ({ quest:q, info:a, live:b })).catch(e => { delete METAS[q]; throw e; });
  return METAS[q];
}
const fmt = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
const MODE = { sprint:'Speedrun', bug:'Störungsjagd' };
const modeName = m => MODE[m] || 'Modus entfernt';   // alte Challenges (z. B. Pikett) crashen keine Ansicht
function taskLabel(m, id){ const t = m && m.info.tasks.find(x => x.id === id); return t ? t.no + ': ' + t.title : id; }
const qTag = q => P.OPEN_QUESTS().length > 1 ? '<span class="pill">' + esc((P.QNAME[q] || q).split(' ')[0]) + '</span> ' : '';

/* ---------- Dozent: Übersicht (im Leitstand eingeblendet) ---------- */
async function livePanel(){
  const host = $('view').querySelector('.console'); if(!host || $('livePanel')) return;
  const el = document.createElement('div'); el.className = 'panel live-panel'; el.id = 'livePanel';
  el.innerHTML = '<h2>Live-Challenge <span class="tag">am Beamer · Speedrun oder Störungsjagd</span></h2><div class="row"><p class="muted small grow" style="margin:0">Alle lösen dieselbe Aufgabe – oder jagen einen eingebauten Fehler. Beitritt mit 4-stelligem Code, Rangliste live am Beamer.</p><a class="btn pri" href="#/live/neu">Neue Live-Challenge</a></div><div id="liveList" class="small" style="margin-top:12px"></div>';
  host.insertBefore(el, host.querySelector('.panel'));
  try{
    const r = await P.api('GET', 'challenges');
    const ms = {}; await Promise.all([...new Set(r.challenges.slice(0, 6).map(c => c.quest || 'scl'))].map(async q => { try{ ms[q] = await meta(q); }catch(e){} }));
    $('liveList').innerHTML = r.challenges.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Modus</th><th>Aufgabe</th><th>Stand</th><th class="num">gelöst</th><th>angelegt</th><th></th></tr></thead><tbody>' +
      r.challenges.slice(0, 6).map(c => '<tr><td class="num" style="text-align:left">' + esc(c.code) + '</td><td>' + modeName(c.mode) + '</td><td>' + qTag(c.quest || 'scl') + esc(taskLabel(ms[c.quest || 'scl'], c.taskId)) + '</td><td>' + ({ lobby:'<span class="pill warn">wartet</span>', running:'<span class="pill ok">läuft</span>', ended:'<span class="pill">beendet</span>' })[c.state] + '</td><td class="num">' + c.solved + '/' + c.players + '</td><td class="muted">' + P.fmtDate(c.createdAt) + '</td><td><a class="btn sm" href="#/beamer/' + c.id + '">Beamer</a></td></tr>').join('') + '</tbody></table></div>' : '';
  }catch(e){}
}
const mo = new MutationObserver(() => { if(location.hash === '#/leitstand' && P.canTeach(P.user) && $('clsList') && !$('livePanel')) livePanel(); });
mo.observe($('view'), { childList:true });

/* ---------- Dozent: neue Challenge ---------- */
async function viewNew(){
  if(!P.canTeach(P.user)){ location.hash = P.user ? '#/' : '#/login'; return; }
  const v = $('view');
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/leitstand">LEITSTAND</a> / LIVE-CHALLENGE</div><h1>Neue Live-Challenge</h1><p class="lead">Wähle Modus, Aufgabe und Zeit. Danach öffnet sich die Beamer-Ansicht mit dem Beitrittscode.</p><div class="panel muted">Lade …</div></div>';
  const qs = P.OPEN_QUESTS();
  let q = qs.includes(P.LQ) ? P.LQ : qs[0];
  let [m, cls] = await Promise.all([meta(q), P.api('GET', 'classes')]);
  const chOpts = () => m.info.chapters.map(c => '<option value="' + c.n + '">Kapitel ' + c.n + ' – ' + esc(c.title) + '</option>').join('');
  v.querySelector('.console').innerHTML = '<div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/leitstand">LEITSTAND</a> / LIVE-CHALLENGE</div><h1>Neue Live-Challenge</h1><p class="lead">Wähle Modus, Aufgabe und Zeit. Danach öffnet sich die Beamer-Ansicht mit dem Beitrittscode.</p>' +
    '<form id="lcForm"><div class="panel"><h2>1 · Modus</h2><div class="mode-pick">' +
      '<label class="mode-card"><input type="radio" name="mode" value="sprint" checked><b>⚡ Speedrun</b><span>Alle lösen dieselbe Aufgabe. Punkte nach Zeit, Fehlversuchen und Hinweisen.</span></label>' +
      '<label class="mode-card"><input type="radio" name="mode" value="bug"><b>🐞 Störungsjagd</b><span>Die Anlage läuft mit einem eingebauten Fehler. Wer findet und behebt ihn zuerst?</span></label></div></div>' +
    '<div class="panel"><h2>2 · Aufgabe</h2><div class="row">' + (qs.length > 1 ? '<select class="inp" id="lcQuest" aria-label="Quest">' + qs.map(x => '<option value="' + x + '"' + (x === q ? ' selected' : '') + '>' + esc(P.QNAME[x]) + '</option>').join('') + '</select>' : '') + '<select class="inp" id="lcCh">' + chOpts() + '</select><select class="inp grow" id="lcTask"></select><button type="button" class="btn sm" id="lcAdd" title="Aufgabe zur Liste hinzufügen (Speedrun mit mehreren Aufgaben)">＋ hinzufügen</button></div>' +
      '<div id="lcStack" class="lc-stack" hidden><div class="row small"><span class="muted">Speedrun-Reihenfolge (2–10 Aufgaben):</span><span class="grow"></span><label class="muted">Kapitel-Zufall: <select class="inp sm" id="lcRandK" aria-label="Anzahl"></select> Aufgaben aus dem gewählten Kapitel</label><button type="button" class="btn sm" id="lcRand">🎲 würfeln</button><button type="button" class="btn sm" id="lcClear">leeren</button></div><ol id="lcChosen" class="lc-chosen"></ol></div>' +
      '<p class="muted small" id="lcInfo" style="margin:8px 0 0"></p></div>' +
    '<div class="panel"><h2>3 · Zeit und Teilnehmende</h2><div class="row"><select class="inp" id="lcDur">' + [3, 5, 8, 10, 15, 20, 30].map(n => '<option value="' + n * 60 + '"' + (n === 10 ? ' selected' : '') + '>' + n + ' Minuten</option>').join('') + '</select>' +
      '<select class="inp" id="lcCls"><option value="">alle mit dem Code</option>' + cls.classes.map(c => '<option value="' + c.id + '">nur Klasse ' + esc(c.name) + '</option>').join('') + '</select><span class="grow"></span><button class="btn pri">Challenge anlegen ▸</button></div></div></form>';
  // Speedrun stapeln: Liste gewählter Aufgaben (einzeln hinzufügen oder „Kapitel N, k zufällige“ aus den Kernaufgaben)
  let chosen = [];
  const taskById = id => m.info.tasks.find(x => x.id === id);
  const drawStack = () => {
    const mode = v.querySelector('input[name=mode]:checked').value;
    $('lcStack').hidden = mode !== 'sprint';
    $('lcAdd').hidden = mode !== 'sprint';
    $('lcChosen').innerHTML = chosen.map((id, i) => { const t = taskById(id); return '<li><span>' + esc(t ? t.no + ': ' + t.title : id) + '</span><button type="button" class="lc-x" data-i="' + i + '" aria-label="entfernen">✕</button></li>'; }).join('') || '<li class="muted">Noch leer – ohne Auswahl gilt die Aufgabe oben (ein Speedrun mit einer Aufgabe).</li>';
    $('lcChosen').querySelectorAll('.lc-x').forEach(b => b.onclick = () => { chosen.splice(+b.dataset.i, 1); drawStack(); });
  };
  const fill = () => {
    const mode = v.querySelector('input[name=mode]:checked').value, ch = +$('lcCh').value;
    const opts = mode === 'bug' ? m.live.bugs.filter(b => b.ch === ch).map(b => '<option value="' + b.id + '">' + esc(b.title) + ' (Aufgabe ' + esc(taskLabel(m, b.task)) + ')</option>')
      : m.info.tasks.filter(t => t.ch === ch).map(t => '<option value="' + t.id + '">' + esc(t.no + ': ' + t.title) + '</option>');
    $('lcTask').innerHTML = opts.join('');
    drawStack(); info();
  };
  const info = () => {
    const mode = v.querySelector('input[name=mode]:checked').value;
    if(mode === 'bug'){ const b = m.live.bugs.find(x => x.id === $('lcTask').value); $('lcInfo').innerHTML = b ? '<b>Störungsmeldung am Beamer:</b> ' + esc(b.symptom) : ''; }
    else $('lcInfo').textContent = 'Tipp: Aufgaben, die die Klasse schon kennt, eignen sich gut für einen Speedrun.';
  };
  v.querySelectorAll('input[name=mode]').forEach(r => r.onchange = fill);
  $('lcCh').onchange = fill; $('lcTask').onchange = info;
  $('lcRandK').innerHTML = [2, 3, 4, 5, 6, 8, 10].map(n => '<option' + (n === 3 ? ' selected' : '') + '>' + n + '</option>').join('');
  $('lcAdd').onclick = () => { const id = $('lcTask').value; if(!id) return; if(chosen.includes(id)) return P.toast('Diese Aufgabe steht schon in der Liste.', true); if(chosen.length >= 10) return P.toast('Höchstens 10 Aufgaben.', true); chosen.push(id); drawStack(); };
  $('lcClear').onclick = () => { chosen = []; drawStack(); };
  $('lcRand').onclick = () => {
    const ch = +$('lcCh').value, k = +$('lcRandK').value, pool = m.info.tasks.filter(t => t.ch === ch && t.core !== false).map(t => t.id);
    if(pool.length < 2){ P.toast('In diesem Kapitel gibt es zu wenige Kernaufgaben.', true); return; }
    for(let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    chosen = pool.slice(0, Math.min(k, pool.length)).sort((a, b) => m.info.tasks.findIndex(t => t.id === a) - m.info.tasks.findIndex(t => t.id === b)); drawStack();
  };
  if($('lcQuest')) $('lcQuest').onchange = async () => { q = $('lcQuest').value; try{ m = await meta(q); }catch(err){ P.toast(err.message, true); return; } $('lcCh').innerHTML = chOpts(); chosen = []; fill(); };
  fill();
  $('lcForm').onsubmit = async e => {
    e.preventDefault();
    const mode = v.querySelector('input[name=mode]:checked').value;
    const sel = $('lcTask').value;
    const body = { mode, quest:q, duration: +$('lcDur').value, classId: $('lcCls').value || null };
    if(mode === 'bug'){ const b = m.live.bugs.find(x => x.id === sel); body.bugId = b.id; body.taskId = b.task; body.title = b.title; }
    else if(chosen.length > 1){ body.tasks = chosen.slice(); body.taskId = chosen[0]; body.title = 'Speedrun · ' + chosen.length + ' Aufgaben'; }
    else { body.taskId = chosen.length === 1 ? chosen[0] : sel; body.title = (m.info.tasks.find(t => t.id === body.taskId) || {}).title; }
    try{ const r = await P.api('POST', 'challenges', body); location.hash = '#/beamer/' + r.id; }
    catch(err){ P.toast(err.message, true); }
  };
}

/* ---------- Dozent: Beamer-Ansicht ---------- */
let BREFRESH = null, BT = 0, BTick = 0, BSTATE = null, OFFSET = 0, lastPodium = '', SEEN = null, EVENTS = [], WIN = {}, VIEWKEY = '', LASTSTATE = '', ENDFX = false, COUNTING = false, URGENT = false;
function stopBeamer(){
  clearInterval(BT); clearInterval(BTick); BT = BTick = 0; document.body.classList.remove('beamer-mode');
  if(P.sound) P.sound.stop();
}
window.addEventListener('hashchange', () => { if(!location.hash.startsWith('#/beamer/')) stopBeamer(); });
const initial = n => esc(String(n || '?').trim().charAt(0).toUpperCase());
// Avatar (Paket 3) – bis dahin bzw. ohne Angabe ein Platzhalter mit Anfangsbuchstabe
const avatarOf = (p, size, state) => P.avatarHTML ? P.avatarHTML(p && p.avatar, { size, anim: true, state, label: p && p.username }) : '<span class="av-ph" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .5) + 'px">' + initial(p && p.username) + '</span>';
const sceneSrc = q => 'data/scene_' + (q || 'scl') + '.png';
const dots = (arr, n) => '<span class="bm-dots" aria-label="' + arr.filter(Boolean).length + ' von ' + arr.length + ' gelöst">' + arr.map(x => '<i class="' + (x ? 'on' : '') + '"></i>').join('') + '</span>';
function fx(name){ try{ if(P.sound && !P.sound.muted) P.sound.sfx(name); }catch(e){} }
async function viewBeamer(id){
  if(!P.user || (P.user.role !== 'teacher' && P.user.role !== 'admin')){ location.hash = P.user ? '#/' : '#/login'; return; }
  stopBeamer();
  document.body.classList.add('beamer-mode');
  const v = $('view');
  const snd = P.sound;
  v.innerHTML = '<div class="beamer" id="beamer"><div class="bm-top"><span class="bm-live"><i></i> LIVE-CHALLENGE</span><span class="bm-title" id="bmTitle"></span><span class="grow"></span>' +
    (snd && snd.available ? '<span class="bm-vol"><button class="btn sm" id="bmMute" aria-pressed="false" title="Musik an/aus"></button><input type="range" id="bmVol" min="0" max="100" aria-label="Lautstärke"></span>' : '') +
    '<button class="btn sm" id="bmFull" title="Vollbild">⛶ Vollbild</button><a class="btn sm" href="#/leitstand">✕ Schliessen</a></div><div id="bmBody" class="bm-body"><div class="muted">Lade …</div></div></div>';
  $('bmFull').onclick = () => { const el = document.documentElement; if(document.fullscreenElement) document.exitFullscreen(); else if(el.requestFullscreen) el.requestFullscreen().catch(() => {}); };
  if(snd && snd.available){
    const paint = () => { $('bmMute').textContent = snd.muted ? '🔇 Ton aus' : '🔊 Ton an'; $('bmMute').setAttribute('aria-pressed', String(snd.muted)); $('bmVol').value = Math.round(snd.volume * 100); };
    $('bmMute').onclick = () => { snd.unlock(); snd.muted = !snd.muted; paint(); if(!snd.muted && !snd.playing) musicFor(LASTSTATE); };
    $('bmVol').oninput = e => { snd.unlock(); snd.volume = e.target.value / 100; };
    paint();
    // Autoplay-Regel: erste Berührung schaltet den Ton frei und startet die Musik des aktuellen Zustands
    const once = () => { snd.unlock(); if(!snd.muted) musicFor(LASTSTATE); };
    document.addEventListener('pointerdown', once, { once: true });
  }
  lastPodium = ''; CUR = null; SEEN = null; EVENTS = []; WIN = {}; VIEWKEY = ''; LASTSTATE = ''; ENDFX = false; COUNTING = false; URGENT = false;
  const refresh = async () => {
    try{ BSTATE = await P.api('GET', 'challenges/' + id); OFFSET = BSTATE.challenge.serverTime - Date.now(); if(!CUR || CUR.quest !== (BSTATE.challenge.quest || 'scl')) CUR = await meta(BSTATE.challenge.quest); render(id); }
    catch(err){ if(err.status === 404 || err.status === 401){ stopBeamer(); $('bmBody').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; } }
  };
  BREFRESH = refresh;
  await refresh();
  BT = setInterval(refresh, 2000);
  BTick = setInterval(() => { if(BSTATE && BSTATE.challenge.state === 'running'){ tickClock(); tickTicker(); } }, 500);
}
function musicFor(state){
  const snd = P.sound; if(!snd || !snd.available || snd.muted) return;
  if(state === 'lobby') snd.lobby();
  else if(state === 'running'){ snd.challenge(); snd.urgent(URGENT); }
}
function tickClock(){
  const c = BSTATE.challenge, l = (c.endsAt - Date.now() - OFFSET) / 1000;
  const el = $('bmTime'); if(el){ el.textContent = fmt(l); el.classList.toggle('low', l < 60); }
  const bar = $('bmTimeBar'); if(bar){ const f = Math.max(0, Math.min(1, 1 - l / c.duration)); bar.style.width = (f * 100) + '%'; bar.parentNode.classList.toggle('low', l < 60); }
  if(l < 60 && !URGENT){ URGENT = true; if(P.sound && !P.sound.muted) P.sound.urgent(true); }
  if(l <= 0 && BREFRESH) BREFRESH();
}
// Ereignisse aus dem Vergleich zweier Abfragen (nur Pseudonyme)
function diffEvents(pl, tasks){
  const now = {}; pl.forEach(p => { now[p.userId] = p; });
  if(SEEN){
    pl.forEach(p => {
      const o = SEEN[p.userId];
      if(!o){ EVENTS.push({ t: Date.now(), text: p.username + ' ist beigetreten', k: 'join' }); fx('join'); return; }
      if(p.solvedN > o.solvedN){
        const total = tasks.length;
        EVENTS.push({ t: Date.now(), k: 'solved', text: total > 1 ? (p.solvedN >= total ? p.username + ' hat alle ' + total + ' Aufgaben gelöst! 🎉' : p.username + ' hat Aufgabe ' + p.solvedN + ' gelöst') : p.username + ' hat die Aufgabe gelöst! 🎉' });
        WIN[p.userId] = Date.now() + 4200; fx('solved');
      }
    });
    EVENTS = EVENTS.filter(e => Date.now() - e.t < 30000).slice(-6);
  }
  SEEN = {}; pl.forEach(p => { SEEN[p.userId] = { solvedN: p.solvedN || 0 }; });
}
const taskInfo = (c, m) => {
  const ids = c.tasks && c.tasks.length ? c.tasks : [c.taskId];
  return ids.map(id => { const t = CUR.info.tasks.find(x => x.id === id); return { id, no: t ? t.no : '', title: t ? t.title : id, brief: t ? t.brief : '' }; });
};
function taskPanel(c, bug, list, compact){
  if(bug) return '<div class="bm-task"><div class="bm-k">Störungsmeldung</div><h2>' + esc(bug.title) + '</h2><p class="bm-alarm">⚠ ' + esc(bug.symptom) + '</p></div>';
  if(list.length > 1) return '<div class="bm-task"><div class="bm-k">' + list.length + ' Aufgaben nacheinander</div><ol class="bm-tasklist">' + list.map(t => '<li>' + esc(t.title) + '</li>').join('') + '</ol></div>';
  const t = list[0];
  return '<div class="bm-task"><div class="bm-k">Auftrag</div><h2>' + esc(t.title) + '</h2>' + (t.brief ? '<p class="bm-brief' + (compact ? ' sm' : '') + '">' + esc(t.brief) + '</p>' : '') + '</div>';
}
function sceneBox(c, cls){
  return '<div class="bm-scene ' + (cls || '') + '"><img src="' + sceneSrc(c.quest) + '" alt="Bild der Anlage" onerror="this.parentNode.classList.add(\'none\')"></div>';
}
function render(id){
  const c = BSTATE.challenge, pl = BSTATE.players, m = CUR.live;
  const tasks = taskInfo(c, CUR), bug = c.mode === 'bug' ? m.bugs.find(b => b.id === c.bugId) : null;
  const what = bug ? bug.title : tasks.length > 1 ? tasks.length + ' Aufgaben' : tasks[0].title;
  $('bmTitle').textContent = (P.OPEN_QUESTS().length > 1 ? (P.QNAME[c.quest || 'scl'] || '').split(' ')[0] + ' · ' : '') + modeName(c.mode) + ' · ' + what;
  const body = $('bmBody');
  const wasState = LASTSTATE;
  diffEvents(pl, tasks);
  if(c.state !== LASTSTATE){
    LASTSTATE = c.state; VIEWKEY = '';
    if(c.state === 'running' && wasState && !COUNTING) musicFor('running');
    if(c.state === 'lobby') musicFor('lobby');
    if(c.state === 'ended' && wasState === 'running' && !ENDFX){
      ENDFX = true; const snd = P.sound;
      if(snd && snd.available && !snd.muted){ const ms = snd.timeup() || 2000; setTimeout(() => { if(location.hash.startsWith('#/beamer/')) snd.victory(); }, ms - 300); }
    }
  }
  if(c.state === 'lobby'){
    const key = 'L' + pl.map(p => p.userId + ':' + JSON.stringify(p.avatar || null)).join(',');
    if(key === VIEWKEY && $('bmStart')) return;
    VIEWKEY = key;
    body.innerHTML = '<div class="bm-lobby"><div class="bm-left">' + sceneBox(c) + '<div class="bm-join"><div class="bm-k">Beitreten auf</div><div class="bm-url">' + esc(location.host) + '</div><div class="bm-k">mit dem Code</div><div class="bm-code">' + esc(c.code) + '</div>' +
      '<div class="bm-k">Anmelden → Live → Code eingeben</div></div></div><div class="bm-side">' + '<div class="bm-k">' + modeName(c.mode) + ' · ' + fmt(c.duration) + ' min</div>' + taskPanel(c, bug, tasks) +
      '<div class="bm-k">' + pl.length + ' Teilnehmende</div><div class="bm-avatars">' + pl.map(p => '<span class="bm-av">' + avatarOf(p, 64) + '<b>' + esc(p.username) + '</b></span>').join('') + '</div>' +
      '<button class="btn pri bm-start" id="bmStart"' + (pl.length ? '' : ' disabled') + '>▶ Challenge starten</button></div></div>';
    $('bmStart').onclick = () => startWithCountdown(id);
    return;
  }
  const solved = pl.filter(p => p.solved).length;
  if(c.state === 'running'){
    const l = (c.endsAt - Date.now() - OFFSET) / 1000;
    const key = 'R' + pl.map(p => [p.userId, p.solvedN, p.points, p.rank, !!(WIN[p.userId] > Date.now()), JSON.stringify(p.avatar || null)].join(':')).join(',') + '|' + EVENTS.length + '|' + solved;
    if(key === VIEWKEY && $('bmTime')){ tickTicker(); return; }
    VIEWKEY = key;
    const rows = pl.slice().sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9) || a.username.localeCompare(b.username));
    body.innerHTML = '<div class="bm-run"><div class="bm-left">' + sceneBox(c, 'sm') + taskPanel(c, bug, tasks, true) +
      '<div class="bm-clock"><div class="bm-k">Restzeit</div><div class="bm-time' + (l < 60 ? ' low' : '') + '" id="bmTime">' + fmt(l) + '</div><div class="bm-tbar' + (l < 60 ? ' low' : '') + '"><i id="bmTimeBar"></i></div>' +
      '<div class="bm-stat"><b>' + solved + '</b> / ' + pl.length + (tasks.length > 1 ? ' fertig' : ' gelöst') + '</div><div class="bm-k" style="margin-top:6px">Code ' + esc(c.code) + ' · späterer Beitritt möglich</div>' +
      '<button class="btn dan" id="bmStop">■ Challenge beenden</button></div></div>' +
      '<div class="bm-right"><div class="bm-rank2">' + (rows.length ? rows.map(p => '<div class="bm-row' + (p.solved ? ' done' : '') + '"><span class="bm-pos">' + (p.rank || '–') + '</span><span class="bm-avw">' + avatarOf(p, 58, WIN[p.userId] > Date.now() ? 'win' : '') + '</span><span class="bm-nm">' + esc(p.username) + '</span>' + dots(p.progress || [], p) +
        '<span class="bm-pt">' + p.points + ' P</span></div>').join('') : '<div class="empty">Noch niemand beigetreten.</div>') + '</div><ul class="bm-ticker" id="bmTicker" aria-live="polite"></ul></div></div>';
    tickTicker(); tickClock();
    $('bmStop').onclick = async () => { if(await P.confirmDlg('Challenge beenden?', 'Die Zeit wird angehalten und die Siegerehrung beginnt.', 'Beenden')) try{ await P.api('POST', 'challenges/' + id + '/stop', {}); }catch(err){ P.toast(err.message, true); } };
    return;
  }
  // beendet: Siegerehrung
  const top = pl.filter(p => p.solvedN > 0).slice(0, 3);
  const key = JSON.stringify(pl.map(p => [p.userId, p.points, p.rank, p.avatar || null]));
  const showKey = BSTATE.shown ? JSON.stringify(BSTATE.shown.code).length + ':' + BSTATE.shown.points : '';
  if(key === lastPodium && $('bmShow')){   // Podest nicht neu zeichnen (Animation), nur die Lösungsansicht
    if($('bmShow').dataset.k !== showKey){ $('bmShow').innerHTML = showHTML(); $('bmShow').dataset.k = showKey; bindShow(id); }
    return;
  }
  lastPodium = key;
  body.innerHTML = '<div class="bm-end"><div class="bm-k">Siegerehrung · ' + solved + ' von ' + pl.length + ' ' + (tasks.length > 1 ? 'sind fertig' : 'haben gelöst') + '</div>' +
    (top.length ? '<div class="bm-podium">' + [1, 0, 2].filter(i => top[i]).map(i => '<div class="bp bp' + (i + 1) + '" style="animation-delay:' + [0.9, 0.5, 0.1][i] + 's"><div class="bp-av">' + avatarOf(top[i], i === 0 ? 132 : 104, 'win') + '</div><div class="bp-name">' + esc(top[i].username) + '</div><div class="bp-pts">' + top[i].points + ' P' + (top[i].solvedAfter != null ? ' · ' + fmt(top[i].solvedAfter) : '') + '</div><div class="bp-step">' + (i + 1) + '</div></div>').join('') + '</div>'
      : '<p class="empty">Diesmal hat niemand gelöst. Zeit für eine Besprechung!</p>') +
    '<div class="bm-endgrid"><div class="bm-rank">' + rankTable(pl, true, tasks.length) + '</div><div class="bm-show" id="bmShow">' + showHTML() + '</div></div>' +
    '<div class="row" style="justify-content:center;margin-top:16px"><a class="btn" href="#/live/neu">Neue Challenge</a><a class="btn" href="#/leitstand">Zum Leitstand</a></div></div>';
  $('bmShow').dataset.k = showKey;
  body.querySelectorAll('[data-show]').forEach(b => b.onclick = async () => { try{ await P.api('POST', 'challenges/' + id + '/show', { userId: +b.dataset.show }); BSTATE = await P.api('GET', 'challenges/' + id); render(id); }catch(err){ P.toast(err.message, true); } });
  bindShow(id);
}
function tickTicker(){
  const ul = $('bmTicker'); if(!ul) return;
  const ev = EVENTS.filter(e => Date.now() - e.t < 20000).slice(-4);
  ul.innerHTML = ev.map(e => '<li class="' + e.k + '">' + esc(e.text) + '</li>').join('');
}
// 3 · 2 · 1 · Los! mit Ton, danach startet die Challenge
async function startWithCountdown(id){
  if(COUNTING) return; COUNTING = true;
  const snd = P.sound, withSound = snd && snd.available && !snd.muted;
  if(snd && snd.available) snd.unlock();
  const ov = document.createElement('div'); ov.className = 'bm-count'; ov.setAttribute('role', 'status'); document.body.appendChild(ov);
  if(withSound) snd.countdown();
  for(const n of ['3', '2', '1']){ ov.innerHTML = '<b>' + n + '</b>'; await new Promise(r => setTimeout(r, 1000)); }
  ov.innerHTML = '<b class="go">LOS!</b>';
  try{ await P.api('POST', 'challenges/' + id + '/start', {}); }catch(err){ P.toast(err.message, true); }
  URGENT = false;
  setTimeout(() => { ov.remove(); COUNTING = false; if(withSound) snd.challenge(); }, 800);
}
function bindShow(id){
  const hide = $('bmHide'); if(hide) hide.onclick = async () => { try{ await P.api('POST', 'challenges/' + id + '/show', { userId: null }); BSTATE.shown = null; render(id); }catch(err){ P.toast(err.message, true); } };
}
function rankTable(pl, withShow, nTasks){
  const stacked = nTasks > 1;
  return '<table class="tbl bm-tbl"><thead><tr><th>#</th><th>Pseudonym</th>' + (stacked ? '<th class="num">Aufgaben</th>' : '') + '<th class="num">Zeit</th><th class="num">Versuche</th><th class="num">Tipps</th><th class="num">Punkte</th>' + (withShow ? '<th></th>' : '') + '</tr></thead><tbody>' +
    (pl.length ? pl.map(p => '<tr class="' + (p.solvedN ? 'ok' : '') + '"><td>' + (p.rank || '–') + '</td><td>' + esc(p.username) + (p.solved ? ' ✓' : '') + '</td>' + (stacked ? '<td class="num">' + p.solvedN + '/' + nTasks + '</td>' : '') + '<td class="num">' + (p.solvedN ? fmt(p.solvedAfter) : '–') + '</td><td class="num">' + p.attempts + '</td><td class="num">' + p.hints + '</td><td class="num"><b>' + p.points + '</b></td>' +
      (withShow ? '<td>' + (p.hasCode ? '<button class="btn sm" data-show="' + p.userId + '" title="Lösung anonym am Beamer zeigen">Lösung zeigen</button>' : '') + '</td>' : '') + '</tr>').join('')
      : '<tr><td colspan="8" class="empty">Noch niemand beigetreten.</td></tr>') + '</tbody></table>';
}
// Lösungsvergleich (wie im Spiel): Zeilen der eingereichten Lösung gegen die Musterlösung
const normLine = l => l.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim().toUpperCase();
function lineDiff(a, b){
  const A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length, na = A.map(normLine), nb = B.map(normLine);
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--) L[i][j] = na[i] === nb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while(i < n && j < m){ if(na[i] === nb[j]){ out.push([' ', A[i]]); i++; j++; } else if(L[i + 1][j] >= L[i][j + 1]) out.push(['-', A[i++]]); else out.push(['+', B[j++]]); }
  while(i < n) out.push(['-', A[i++]]); while(j < m) out.push(['+', B[j++]]);
  return out;
}
const asText = c => typeof c === 'string' ? c : Object.keys(c || {}).map(k => '// ===== ' + k + ' =====\n' + c[k]).join('\n\n');
function showHTML(){
  const s = BSTATE && BSTATE.shown;
  if(!s) return '<div class="bm-k">Lösung besprechen</div><p class="muted">Wähle links eine Lösung – sie erscheint hier <b>ohne Namen</b>, zusammen mit dem Vergleich zur Musterlösung.</p>';
  const ref = asText(CUR.live.refs[s.taskId || BSTATE.challenge.taskId]);
  const d = lineDiff(asText(s.code), ref);
  return '<div class="row"><div class="bm-k grow">Eingereichte Lösung (anonym) · ' + s.points + ' P</div><button class="btn sm" id="bmHide">ausblenden</button></div>' +
    '<pre class="code bm-diff">' + d.map(([k, l]) => '<span class="d' + (k === '-' ? 'm' : k === '+' ? 'p' : 'n') + '">' + (k === ' ' ? '  ' : k + ' ') + esc(l) + '</span>').join('\n') + '</pre>' +
    '<div class="legend"><span><i class="dm">- </i>nur in der eingereichten Lösung</span><span><i class="dp">+ </i>nur in der Musterlösung</span></div>';
}

/* ---------- Lernende: beitreten ---------- */
function viewJoin(m){
  const v = $('view');
  if(!P.user){ v.innerHTML = '<div class="console"><div class="panel empty">Für die Live-Challenge meldest du dich mit deinem Konto an.<br><br><button class="btn pri" id="ljLogin">Anmelden</button></div></div>'; $('ljLogin').onclick = () => P.openTerminal('login'); return; }
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / LIVE</div><div class="join-card panel"><div class="bm-live"><i></i> LIVE-CHALLENGE</div><h1>Beitreten</h1><p class="muted">Gib den 4-stelligen Code vom Beamer ein.</p>' +
    '<form id="ljForm"><input class="inp join-code" id="ljCode" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="Beitrittscode" placeholder="• • • •" value="' + esc(m && m[1] || '') + '"><button class="btn pri join-go">Los ▸</button></form><p class="small muted">Angemeldet als <b>' + esc(P.user.username) + '</b></p></div></div>';
  $('ljCode').focus();
  $('ljForm').onsubmit = async e => {
    e.preventDefault();
    try{ const r = await P.api('POST', 'live/join', { code: $('ljCode').value }); location.href = (r.challenge.quest || 'scl') + '/?live=' + r.challenge.id; }
    catch(err){ P.toast(err.message, true); $('ljCode').select(); }
  };
}

P.routes.push({ re: /^#\/live\/neu$/, view: viewNew });
P.routes.push({ re: /^#\/beamer\/(\d+)$/, view: m => viewBeamer(+m[1]) });
P.routes.push({ re: /^#\/live(?:\/(\d{4}))?$/, view: viewJoin });
})();
