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
const MODE = { sprint:'Sprint', bug:'Störungsjagd', pikett:'Modus entfernt' };   // frühere Pikett-Challenges in D1 bleiben lesbar
function taskLabel(m, id){ const t = m && m.info.tasks.find(x => x.id === id); return t ? (t.hidden ? '' : t.no + ': ') + t.title : id; }   // ausgeblendete Aufgaben bleiben auflösbar
const qTag = q => P.OPEN_QUESTS().length > 1 ? '<span class="pill">' + esc((P.QNAME[q] || q).split(' ')[0]) + '</span> ' : '';

/* ---------- Dozent: Übersicht (im Leitstand eingeblendet) ---------- */
async function livePanel(){
  const host = $('view').querySelector('.console'); if(!host || $('livePanel')) return;
  const el = document.createElement('div'); el.className = 'panel live-panel'; el.id = 'livePanel';
  el.innerHTML = '<h2>Live-Challenge <span class="tag">am Beamer · Sprint oder Störungsjagd</span></h2><div class="row"><p class="muted small grow" style="margin:0">Alle lösen dieselbe Aufgabe – oder jagen einen eingebauten Fehler. Beitritt mit 4-stelligem Code, Rangliste live am Beamer.</p><a class="btn pri" href="#/live/neu">Neue Live-Challenge</a></div><div id="liveList" class="small" style="margin-top:12px"></div>';
  host.insertBefore(el, host.querySelector('.panel'));
  try{
    const r = await P.api('GET', 'challenges');
    const ms = {}; await Promise.all([...new Set(r.challenges.slice(0, 6).map(c => c.quest || 'scl'))].map(async q => { try{ ms[q] = await meta(q); }catch(e){} }));
    $('liveList').innerHTML = r.challenges.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Modus</th><th>Aufgabe</th><th>Stand</th><th class="num">gelöst</th><th>angelegt</th><th></th></tr></thead><tbody>' +
      r.challenges.slice(0, 6).map(c => '<tr><td class="num" style="text-align:left">' + esc(c.code) + '</td><td>' + MODE[c.mode] + '</td><td>' + qTag(c.quest || 'scl') + esc(taskLabel(ms[c.quest || 'scl'], c.taskId)) + '</td><td>' + ({ lobby:'<span class="pill warn">wartet</span>', running:'<span class="pill ok">läuft</span>', ended:'<span class="pill">beendet</span>' })[c.state] + '</td><td class="num">' + c.solved + '/' + c.players + '</td><td class="muted">' + P.fmtDate(c.createdAt) + '</td><td><a class="btn sm" href="#/beamer/' + c.id + '">Beamer</a></td></tr>').join('') + '</tbody></table></div>' : '';
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
      '<label class="mode-card"><input type="radio" name="mode" value="sprint" checked><b>⚡ Sprint</b><span>Alle lösen dieselbe Aufgabe. Punkte nach Zeit, Fehlversuchen und Hinweisen.</span></label>' +
      '<label class="mode-card"><input type="radio" name="mode" value="bug"><b>🐞 Störungsjagd</b><span>Die Anlage läuft mit einem eingebauten Fehler. Wer findet und behebt ihn zuerst?</span></label>' +
    '</div></div>' +
    '<div class="panel"><h2>2 · Aufgabe</h2><div class="row">' + (qs.length > 1 ? '<select class="inp" id="lcQuest" aria-label="Quest">' + qs.map(x => '<option value="' + x + '"' + (x === q ? ' selected' : '') + '>' + esc(P.QNAME[x]) + '</option>').join('') + '</select>' : '') + '<select class="inp" id="lcCh">' + chOpts() + '</select><select class="inp grow" id="lcTask"></select></div><p class="muted small" id="lcInfo" style="margin:8px 0 0"></p></div>' +
    '<div class="panel"><h2>3 · Zeit und Teilnehmende</h2><div class="row"><select class="inp" id="lcDur">' + [3, 5, 8, 10, 15, 20, 30].map(n => '<option value="' + n * 60 + '"' + (n === 10 ? ' selected' : '') + '>' + n + ' Minuten</option>').join('') + '</select>' +
      '<select class="inp" id="lcCls"><option value="">alle mit dem Code</option>' + cls.classes.map(c => '<option value="' + c.id + '">nur Klasse ' + esc(c.name) + '</option>').join('') + '</select><span class="grow"></span><button class="btn pri">Challenge anlegen ▸</button></div></div></form>';
  const fill = () => {
    const mode = v.querySelector('input[name=mode]:checked').value, ch = +$('lcCh').value;
    const opts = mode === 'bug' ? m.live.bugs.filter(b => b.ch === ch && !b.hidden).map(b => '<option value="' + b.id + '">' + esc(b.title) + ' (Aufgabe ' + esc(taskLabel(m, b.task)) + ')</option>')
      : m.info.tasks.filter(t => t.ch === ch && !t.hidden).map(t => '<option value="' + t.id + '">' + esc(t.no + ': ' + t.title) + '</option>');
    $('lcTask').innerHTML = opts.join('');
    info();
  };
  const info = () => {
    const mode = v.querySelector('input[name=mode]:checked').value;
    if(mode === 'bug'){ const b = m.live.bugs.find(x => x.id === $('lcTask').value); $('lcInfo').innerHTML = b ? '<b>Störungsmeldung am Beamer:</b> ' + esc(b.symptom) : ''; }
    else $('lcInfo').textContent = 'Tipp: Aufgaben, die die Klasse schon kennt, eignen sich gut für einen Sprint.';
  };
  v.querySelectorAll('input[name=mode]').forEach(r => r.onchange = fill);
  $('lcCh').onchange = fill; $('lcTask').onchange = info;
  if($('lcQuest')) $('lcQuest').onchange = async () => { q = $('lcQuest').value; try{ m = await meta(q); }catch(err){ P.toast(err.message, true); return; } $('lcCh').innerHTML = chOpts(); fill(); };
  fill();
  $('lcForm').onsubmit = async e => {
    e.preventDefault();
    const mode = v.querySelector('input[name=mode]:checked').value;
    const sel = $('lcTask').value;
    const body = { mode, quest:q, duration: +$('lcDur').value, classId: $('lcCls').value || null };
    if(mode === 'bug'){ const b = m.live.bugs.find(x => x.id === sel); body.bugId = b.id; body.taskId = b.task; body.title = b.title; }
    else { body.taskId = sel; body.title = (m.info.tasks.find(t => t.id === sel) || {}).title; }
    try{ const r = await P.api('POST', 'challenges', body); location.hash = '#/beamer/' + r.id; }
    catch(err){ P.toast(err.message, true); }
  };
}

/* ---------- Dozent: Beamer-Ansicht ---------- */
let BT = 0, BTick = 0, BSTATE = null, OFFSET = 0, lastPodium = '';
function stopBeamer(){ clearInterval(BT); clearInterval(BTick); BT = BTick = 0; document.body.classList.remove('beamer-mode'); }
window.addEventListener('hashchange', () => { if(!location.hash.startsWith('#/beamer/')) stopBeamer(); });
async function viewBeamer(id){
  if(!P.user || (P.user.role !== 'teacher' && P.user.role !== 'admin')){ location.hash = P.user ? '#/' : '#/login'; return; }
  stopBeamer();
  document.body.classList.add('beamer-mode');
  const v = $('view');
  v.innerHTML = '<div class="beamer" id="beamer"><div class="bm-top"><span class="bm-live"><i></i> LIVE-CHALLENGE</span><span class="bm-title" id="bmTitle"></span><span class="grow"></span>' +
    '<button class="btn sm" id="bmFull" title="Vollbild">⛶ Vollbild</button><a class="btn sm" href="#/leitstand">✕ Schliessen</a></div><div id="bmBody" class="bm-body"><div class="muted">Lade …</div></div></div>';
  $('bmFull').onclick = () => { const el = document.documentElement; if(document.fullscreenElement) document.exitFullscreen(); else if(el.requestFullscreen) el.requestFullscreen().catch(() => {}); };
  lastPodium = ''; CUR = null;
  const refresh = async () => {
    try{ BSTATE = await P.api('GET', 'challenges/' + id); OFFSET = BSTATE.challenge.serverTime - Date.now(); if(!CUR || CUR.quest !== (BSTATE.challenge.quest || 'scl')) CUR = await meta(BSTATE.challenge.quest); render(id); }
    catch(err){ if(err.status === 404 || err.status === 401){ stopBeamer(); $('bmBody').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; } }
  };
  await refresh();
  BT = setInterval(refresh, 2000);
  BTick = setInterval(() => { if(BSTATE && BSTATE.challenge.state === 'running'){ const el = $('bmTime'); if(el){ const l = (BSTATE.challenge.endsAt - Date.now() - OFFSET) / 1000; el.textContent = fmt(l); el.classList.toggle('low', l < 60); if(l <= 0) refresh(); } } }, 250);
}
function render(id){
  const c = BSTATE.challenge, pl = BSTATE.players, m = CUR.live;
  const bug = c.mode === 'bug' ? m.bugs.find(b => b.id === c.bugId) : null;
  const what = c.mode === 'pikett' ? 'Modus entfernt (frühere Pikett-Challenge)' : bug ? bug.title : taskLabel(CUR, c.taskId);
  $('bmTitle').textContent = (P.OPEN_QUESTS().length > 1 ? (P.QNAME[c.quest || 'scl'] || '').split(' ')[0] + ' · ' : '') + MODE[c.mode] + ' · ' + what;
  const body = $('bmBody');
  if(c.state === 'lobby'){
    body.innerHTML = '<div class="bm-lobby"><div class="bm-join"><div class="bm-k">Beitreten auf</div><div class="bm-url">' + esc(location.host) + '</div><div class="bm-k">mit dem Code</div><div class="bm-code">' + esc(c.code) + '</div>' +
      '<div class="bm-k">Anmelden → Live → Code eingeben</div></div><div class="bm-side"><div class="bm-task"><div class="bm-k">' + MODE[c.mode] + ' · ' + fmt(c.duration) + ' min</div><h2>' + esc(what) + '</h2>' +
      (bug ? '<p class="bm-alarm">⚠ ' + esc(bug.symptom) + '</p>' : '') + '</div><div class="bm-k">' + pl.length + ' Teilnehmende</div><div class="bm-chips">' + pl.map(p => '<span class="bm-chip">' + esc(p.username) + '</span>').join('') + '</div>' +
      '<button class="btn pri bm-start" id="bmStart"' + (pl.length ? '' : ' disabled') + '>▶ Challenge starten</button></div></div>';
    $('bmStart').onclick = async () => { try{ await P.api('POST', 'challenges/' + id + '/start', {}); }catch(err){ P.toast(err.message, true); } };
    return;
  }
  const solved = pl.filter(p => p.solved).length;
  if(c.state === 'running'){
    const l = (c.endsAt - Date.now() - OFFSET) / 1000;
    body.innerHTML = '<div class="bm-run"><div class="bm-clock"><div class="bm-k">Restzeit</div><div class="bm-time' + (l < 60 ? ' low' : '') + '" id="bmTime">' + fmt(l) + '</div>' +
      '<div class="bm-stat"><b>' + solved + '</b> / ' + pl.length + ' gelöst' + '</div><div class="bm-bar"><i style="width:' + (pl.length ? Math.round(100 * solved / pl.length) : 0) + '%"></i></div>' +
      (bug ? '<p class="bm-alarm">⚠ ' + esc(bug.symptom) + '</p>' : '') + '<div class="bm-k" style="margin-top:14px">Code ' + esc(c.code) + ' · späterer Beitritt möglich</div>' +
      '<button class="btn dan" id="bmStop">■ Challenge beenden</button></div><div class="bm-rank">' + rankTable(pl, false) + '</div></div>';
    $('bmStop').onclick = async () => { if(await P.confirmDlg('Challenge beenden?', 'Die Zeit wird angehalten und die Siegerehrung beginnt.', 'Beenden')) try{ await P.api('POST', 'challenges/' + id + '/stop', {}); }catch(err){ P.toast(err.message, true); } };
    return;
  }
  // beendet: Siegerehrung
  const top = pl.filter(p => p.solved).slice(0, 3);
  const key = JSON.stringify(pl.map(p => [p.userId, p.points, p.rank]));
  const showKey = BSTATE.shown ? JSON.stringify(BSTATE.shown.code).length + ':' + BSTATE.shown.points : '';
  if(key === lastPodium && $('bmShow')){   // Podest nicht neu zeichnen (Animation), nur die Lösungsansicht
    if($('bmShow').dataset.k !== showKey){ $('bmShow').innerHTML = showHTML(); $('bmShow').dataset.k = showKey; bindShow(id); }
    return;
  }
  lastPodium = key;
  body.innerHTML = '<div class="bm-end"><div class="bm-k">Siegerehrung · ' + solved + ' von ' + pl.length + ' haben gelöst</div>' +
    (top.length ? '<div class="bm-podium">' + [1, 0, 2].filter(i => top[i]).map(i => '<div class="bp bp' + (i + 1) + '" style="animation-delay:' + [0.9, 0.5, 0.1][i] + 's"><div class="bp-name">' + esc(top[i].username) + '</div><div class="bp-pts">' + top[i].points + ' P · ' + fmt(top[i].solvedAfter) + '</div><div class="bp-step">' + (i + 1) + '</div></div>').join('') + '</div>'
      : '<p class="empty">Diesmal hat niemand gelöst. Zeit für eine Besprechung!</p>') +
    '<div class="bm-endgrid"><div class="bm-rank">' + rankTable(pl, true) + '</div><div class="bm-show" id="bmShow">' + showHTML() + '</div></div>' +
    '<div class="row" style="justify-content:center;margin-top:16px"><a class="btn" href="#/live/neu">Neue Challenge</a><a class="btn" href="#/leitstand">Zum Leitstand</a></div></div>';
  $('bmShow').dataset.k = showKey;
  body.querySelectorAll('[data-show]').forEach(b => b.onclick = async () => { try{ await P.api('POST', 'challenges/' + id + '/show', { userId: +b.dataset.show }); BSTATE = await P.api('GET', 'challenges/' + id); render(id); }catch(err){ P.toast(err.message, true); } });
  bindShow(id);
}
function bindShow(id){
  const hide = $('bmHide'); if(hide) hide.onclick = async () => { try{ await P.api('POST', 'challenges/' + id + '/show', { userId: null }); BSTATE.shown = null; render(id); }catch(err){ P.toast(err.message, true); } };
}
function rankTable(pl, withShow){
  return '<table class="tbl bm-tbl"><thead><tr><th>#</th><th>Pseudonym</th><th class="num">Zeit</th><th class="num">Versuche</th><th class="num">Tipps</th><th class="num">Punkte</th>' + (withShow ? '<th></th>' : '') + '</tr></thead><tbody>' +
    (pl.length ? pl.map(p => '<tr class="' + (p.solved ? 'ok' : '') + '"><td>' + (p.rank || '–') + '</td><td>' + esc(p.username) + (p.solved ? ' ✓' : '') + '</td><td class="num">' + (p.solved ? fmt(p.solvedAfter) : '–') + '</td><td class="num">' + p.attempts + '</td><td class="num">' + p.hints + '</td><td class="num"><b>' + (p.solved ? p.points : '') + '</b></td>' +
      (withShow ? '<td>' + (p.hasCode ? '<button class="btn sm" data-show="' + p.userId + '" title="Lösung anonym am Beamer zeigen">Lösung zeigen</button>' : '') + '</td>' : '') + '</tr>').join('')
      : '<tr><td colspan="7" class="empty">Noch niemand beigetreten.</td></tr>') + '</tbody></table>';
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
  const ref = asText(CUR.live.refs[BSTATE.challenge.taskId]);
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
