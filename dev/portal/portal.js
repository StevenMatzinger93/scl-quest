/* ===== SPS Quest Portal: Startseite, Login-Terminal, Konto, Leitstand (Dozent), Administration ===== */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = t => t ? new Date(t).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '–';
const ago = t => { if(!t) return 'nie'; const m = Math.round((Date.now() - t) / 60000); if(m < 1) return 'gerade eben'; if(m < 60) return 'vor ' + m + ' min'; const h = Math.round(m / 60); if(h < 24) return 'vor ' + h + ' h'; const d = Math.round(h / 24); return 'vor ' + d + ' Tag' + (d === 1 ? '' : 'en'); };
const ROLE = { admin:'Administrator', teacher:'Dozent/in', student:'Schüler/in' };
const GAME_KEY = { scl: 'sclquest3_state_v4', kop: 'kopquest_state_v1', fup: 'fupquest_state_v1', awl: 'awlquest_state_v1', sensor: 'sensorquest_state_v1' }, SYNC_KEY = { scl: 'spsquest_sync_scl', kop: 'spsquest_sync_kop', fup: 'spsquest_sync_fup', awl: 'spsquest_sync_awl', sensor: 'spsquest_sync_sensor' };
const QNAME = { scl:'SCL Quest', kop:'KOP Quest', fup:'FUP Quest', awl:'AWL Quest', sensor:'Sensorwerkstatt' };
// Dozentenfunktionen (Leitstand): Dozenten und Admins (ein Admin-Konto kann zugleich Dozent einer Klasse sein)
const canTeach = u => !!u && (u.role === 'teacher' || u.role === 'admin');

const QUESTS = [
  { q:'scl', name:'SCL', machine:'Roboterzelle mit zwei Bändern', href:'scl/', open:true,
    svg:'<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 92h104"/><rect x="40" y="80" width="30" height="12" rx="2"/><path d="M55 80V62"><animateTransform attributeName="transform" type="rotate" values="0 55 80;-6 55 80;0 55 80" dur="4s" repeatCount="indefinite"/></path><g><animateTransform attributeName="transform" type="rotate" values="0 55 62;-18 55 62;0 55 62" dur="4s" repeatCount="indefinite"/><circle cx="55" cy="62" r="5"/><path d="M55 62L28 36"/><circle cx="28" cy="36" r="4"/><path d="M28 36L52 18"/><path d="M52 18l8-3M52 18l6 7"/></g><path d="M78 72h34M78 80h34" stroke-dasharray="5 4"><animate attributeName="stroke-dashoffset" values="0;-18" dur="1.2s" repeatCount="indefinite"/></path><rect x="92" y="62" width="10" height="10" rx="1"/></svg>' },
  { q:'kop', name:'KOP', machine:'Seilbahn-Station', href:'kop/', open:true,
    svg:'<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22L116 44"/><path d="M4 30L116 52" opacity=".5"/><g><animateTransform attributeName="transform" type="translate" values="-10 -2;18 3.5;-10 -2" dur="7s" repeatCount="indefinite"/><path d="M58 33v12"/><rect x="42" y="45" width="32" height="26" rx="5"/><path d="M48 52h20v8H48z"/></g><path d="M8 92h104M20 92V74h22v18M78 92V70h26v22"/></svg>' },
  { q:'fup', name:'FUP', machine:'Bahn-Stellwerk', href:'fup/', open:true,
    svg:'<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 86h112M4 94h112"/><path d="M14 86v8M30 86v8M46 86v8M62 86v8M78 86v8M94 86v8M110 86v8" opacity=".6"/><path d="M40 86L78 70h38" opacity=".7"/><path d="M26 86V20"/><rect x="16" y="12" width="20" height="40" rx="4"/><circle cx="26" cy="22" r="4"><animate attributeName="opacity" values="1;.2;1" dur="2s" repeatCount="indefinite"/></circle><circle cx="26" cy="32" r="4" opacity=".3"/><circle cx="26" cy="42" r="4" opacity=".3"/></svg>' },
  { q:'awl', name:'AWL', machine:'Altes Walzwerk im Keller', href:'awl/', open:true,
    svg:'<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="38" r="16"><animateTransform attributeName="transform" type="rotate" values="0 60 38;360 60 38" dur="6s" repeatCount="indefinite"/></circle><path d="M60 22v32M44 38h32" opacity=".5"><animateTransform attributeName="transform" type="rotate" values="0 60 38;360 60 38" dur="6s" repeatCount="indefinite"/></path><circle cx="60" cy="74" r="16"/><path d="M4 56h112" stroke-width="4" stroke-dasharray="14 6"><animate attributeName="stroke-dashoffset" values="0;-40" dur="3s" repeatCount="indefinite"/></path><path d="M8 94h104M24 94V60M96 94V60"/></svg>' },
  { q:'sensor', name:'SENSOR', title:'SENSOR<b>WERKSTATT</b>', machine:'Prüfstand im Untergeschoss', href:'sensor/', open:true,
    svg:'<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 92h108"/><rect x="14" y="44" width="34" height="18" rx="4"/><path d="M48 50h10M48 56h10"/><circle cx="24" cy="53" r="3"><animate attributeName="opacity" values="1;.2;1" dur="1.2s" repeatCount="indefinite"/></circle><path d="M58 53 C74 53 74 30 90 30"/><rect x="88" y="14" width="22" height="64" rx="3"/><path d="M92 28h14M92 44h14M92 60h14"/><circle cx="99" cy="36" r="2.5"><animate attributeName="opacity" values=".2;1;.2" dur="1.2s" repeatCount="indefinite"/></circle><rect x="24" y="74" width="30" height="10" rx="2"><animateTransform attributeName="transform" type="translate" values="-16 0;60 0" dur="4s" repeatCount="indefinite"/></rect></svg>' }
];

/* ---------- API ---------- */
async function api(method, url, body){
  let r;
  try{
    r = await fetch('/api/' + url, { method, credentials:'same-origin', headers:{ 'content-type':'application/json', 'x-spsquest':'1' }, body: body ? JSON.stringify(body) : undefined });
  }catch(e){ setNet(false); throw new Error('Keine Verbindung zum Leitstand. Bist du online?'); }
  setNet(true);
  let data = {}; try{ data = await r.json(); }catch(e){}
  if(!r.ok){ const err = new Error(data.error || ('Fehler ' + r.status)); err.status = r.status; err.data = data; throw err; }
  return data;
}
function setNet(on){ const l = $('netLed'); l.classList.toggle('on', on); l.classList.toggle('off', !on); l.title = on ? 'Verbunden mit dem Leitstand' : 'Keine Verbindung'; }

let USER = null;
const METAS = {};
async function questMeta(q){
  if(!METAS[q]) METAS[q] = fetch('data/' + q + '.json').then(r => r.json()).catch(e => { delete METAS[q]; throw e; });
  return METAS[q];
}
const OPEN_QUESTS = () => QUESTS.filter(q => q.open && (!window.SPSQ_QUESTS || window.SPSQ_QUESTS.includes(q.q))).map(q => q.q);
// Leitstand: gewählte Quest (Umschalter über den Tabellen)
let LQ = 'scl';
function questSwitch(){
  const qs = OPEN_QUESTS(); if(qs.length < 2) return '';
  return '<div class="qswitch" role="tablist" aria-label="Quest wählen">' + qs.map(q => '<button class="btn sm' + (q === LQ ? ' pri' : '') + '" role="tab" aria-selected="' + (q === LQ) + '" data-lq="' + q + '">' + QNAME[q] + '</button>').join('') + '</div>';
}
function bindQuestSwitch(root, again){ root.querySelectorAll('[data-lq]').forEach(b => b.onclick = () => { LQ = b.dataset.lq; again(); }); }
// Code einer Lösung darstellen: KOP als Leiterbild, FUP als Funktionsplan, sonst Text
// Sensorwerkstatt: Verdrahtung als Bild (Feld · Klemmleisten · Baugruppen) + Lösungstext bzw. Entwurf
const PIN_COL = { BN:'#8b5a2b', BU:'#2f6fd0', BK:'#444', WH:'#bbb', '+':'#c0392b', '-':'#2f6fd0', 'L+':'#c0392b', M:'#2f6fd0', 'I+':'#8e44ad', 'I-':'#6c5ce7' };
function wiringSvg(wires){
  if(!wires.length) return '<p class="empty">Keine Adern aufgelegt.</p>';
  const col = n => /^[BSNR]\d/.test(n) ? 0 : /^X\d/.test(n) ? 1 : 2, cols = [[], [], []];
  wires.forEach(w => w.forEach(n => { const c = col(n); if(!cols[c].includes(n)) cols[c].push(n); }));
  cols.forEach(c => c.sort((a, b) => a.localeCompare(b, 'de', { numeric:true })));
  const X = [150, 330, 510], H = 18, rows = Math.max(...cols.map(c => c.length)), pos = {};
  cols.forEach((c, i) => c.forEach((n, j) => { pos[n] = [X[i], 30 + j * H]; }));
  const color = w => { const f = w.find(n => col(n) === 0); return f ? (PIN_COL[f.split(':')[1]] || '#58c4ff') : '#1f3a93'; };
  return '<svg class="wire-pic" viewBox="0 0 660 ' + (40 + rows * H) + '" role="img" aria-label="Verdrahtung"><rect width="660" height="' + (40 + rows * H) + '" fill="#0b1218" rx="8"/>'
    + ['Feld', 'Klemmleisten', 'Baugruppen'].map((t, i) => '<text x="' + X[i] + '" y="16" fill="#8aa0b4" font-size="11" text-anchor="middle" font-family="monospace">' + t + '</text>').join('')
    + wires.map(w => { const a = pos[w[0]], b = pos[w[1]]; const mx = (a[0] + b[0]) / 2; return '<path d="M' + a[0] + ' ' + a[1] + ' C' + mx + ' ' + a[1] + ' ' + mx + ' ' + b[1] + ' ' + b[0] + ' ' + b[1] + '" stroke="' + color(w) + '" stroke-width="2.5" fill="none"/>'; }).join('')
    + Object.keys(pos).map(n => { const [x, y] = pos[n], c = col(n); return '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="#e6eef6"/><text x="' + (c === 0 ? x - 8 : x + 8) + '" y="' + (y + 4) + '" fill="#dbe7f3" font-size="11" font-family="monospace" text-anchor="' + (c === 0 ? 'end' : 'start') + '">' + esc(n) + '</text>'; }).join('') + '</svg>';
}
// Neue Kernschleife (v2): Verdrahtung als Bild aus der 2.5D-Ansicht des Spiels (nur lesen). Die Module kommen aus data/sensor_view.js (nachgeladen).
let sensorLib = null;
function loadSensorLib(){
  if(window.SensorWiring25D && window.SensorVisual) return Promise.resolve(true);
  return sensorLib = sensorLib || new Promise(res => { const s = document.createElement('script'); s.src = 'data/sensor_view.js'; s.onload = () => res(!!window.SensorWiring25D); s.onerror = () => { sensorLib = null; res(false); }; document.head.appendChild(s); });
}
function mountSensorWiring(root){
  root.querySelectorAll('.sv-leit[data-tid]').forEach(async el => {
    const code = el._code; if(!code || !(await loadSensorLib())) return;
    try{
      const task = (window.SCL_CONTENT.tasks || []).find(t => t.id === el.dataset.tid); if(!task) return;
      const ctx = window.SensorTasks.newContext(task); ctx.state = window.Wiring.newState(code.state); if(code.hw) ctx.hw = code.hw;
      const box = document.createElement('div'); box.className = 'sv-leit-view'; el.innerHTML = ''; el.appendChild(box);
      window.SensorWiring25D.mount(box, { netlist: window.SensorVisual.netlist(task, ctx), state: window.SensorVisual.state(task, ctx), options: { lang:'de', reducedMotion:true } });
      box.setAttribute('inert', ''); el.classList.add('ready');
      const fb = el.parentNode && el.parentNode.querySelector('.wire-pic'); if(fb) fb.remove();
    }catch(e){ console.warn('Sensor-Ansicht', e); }
  });
}
function sensorView(code, tid){
  let wires = [], text = '';
  if(typeof code === 'string'){ text = code; code.split('\n').forEach(l => { const m = /^Ader (\S+) → (\S+)/.exec(l); if(m) wires.push([m[1], m[2]]); }); }
  else if(code && code.state){
    wires = (code.state.wires || []).filter(w => !/^X2:\d+\.S$/.test(w.from) || !/^A\d:/.test(w.to)).map(w => [w.from, w.to]);
    if(code.v2) text = [Object.keys(code.answers || {}).length ? 'Fragen beantwortet: ' + Object.keys(code.answers).length : '', code.source ? '// Programm (' + String(code.lang || 'scl').toUpperCase() + ')\n' + code.source : ''].filter(Boolean).join('\n');
    else text = [(code.state.bridges || []).length ? 'Querbrücker: ' + code.state.bridges.join(', ') : '', '-Q0: ' + (code.state.mainSwitch ? 'ein' : 'aus'),
      Object.keys(code.answers || {}).length ? 'Antworten: ' + JSON.stringify(code.answers) : '', code.source ? '\n// Programm (' + String(code.lang || 'scl').toUpperCase() + ')\n' + code.source : ''].filter(Boolean).join('\n');
  }
  const leit = code && code.v2 && code.state && tid ? '<div class="sv-leit" data-tid="' + esc(tid) + '"></div>' : '';
  return leit + wiringSvg(wires) + (text ? '<pre class="code">' + esc(text) + '</pre>' : '');
}
function codeView(q, code, tid){
  if(q === 'sensor') return sensorView(code, tid);
  const txt = c => typeof c === 'string' ? c : Object.keys(c).map(k => '// ===== ' + k + ' =====\n' + c[k]).join('\n\n');
  if((q === 'kop' || q === 'fup') && code && window.KOPEditor){
    try{
      const pic = typeof code === 'string' ? window.KOPEditor.renderStatic(code, null, q)
        : Object.keys(code).map(k => '<h4>' + esc(k) + '</h4>' + window.KOPEditor.renderStatic(code[k], null, q)).join('');
      return pic + '<details class="small"><summary>Textansicht</summary><pre class="code">' + esc(txt(code)) + '</pre></details>';
    }catch(e){}
  }
  return '<pre class="code">' + esc(txt(code)) + '</pre>';
}

/* ---------- UI-Helfer ---------- */
let toastT = 0;
function toast(msg, err){ const t = $('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4200); }
function dialog(title, html, buttons, opts){
  opts = opts || {};
  return new Promise(res => {
    $('dlgTitle').textContent = title; $('dlgBody').innerHTML = html;
    const dlg = document.querySelector('.dlg'); dlg.classList.toggle('wide', !!opts.wide);
    const acts = $('dlgActions'); acts.innerHTML = '';
    const close = v => { $('dlgOverlay').hidden = true; document.removeEventListener('keydown', onKey); res(v); };
    (buttons || [{ label:'OK', value:true, cls:'pri' }]).forEach(b => {
      const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.label; el.type = 'button';
      el.onclick = async () => { if(b.check){ const ok = await b.check(); if(!ok) return; } close(b.value); };
      acts.appendChild(el);
    });
    const onKey = e => { if(e.key === 'Escape' && !opts.modal) close(null); };
    document.addEventListener('keydown', onKey);
    $('dlgOverlay').hidden = false;
    setTimeout(() => { const f = $('dlgBody').querySelector('input,textarea,select') || acts.querySelector('.pri') || acts.lastChild; if(f) f.focus(); }, 30);
  });
}
const confirmDlg = (title, html, yes, danger) => dialog(title, html, [{ label:'Abbrechen', value:false }, { label: yes || 'OK', value:true, cls: danger ? 'dan' : 'pri' }]);
function credsHTML(list){ return '<div class="creds">' + list.map(c => '<div><span>' + esc(c.username) + '</span><b>' + esc(c.password) + '</b></div>').join('') + '</div>'; }
function printSlips(title, list){
  $('printArea').innerHTML = '<div class="slips">' + list.map(c => '<div class="slip"><h4>SPS Quest – ' + esc(title) + '</h4>Adresse: ' + esc(location.origin) + '<br>Benutzer: <b>' + esc(c.username) + '</b><br>Passwort: <b>' + esc(c.password) + '</b><br><small>Beim ersten Anmelden neues Passwort wählen.</small></div>').join('') + '</div>';
  window.print();
}

/* ---------- Kopfleiste ---------- */
function renderTop(){
  $('loginBtn').hidden = !!USER; $('userMenu').hidden = !USER;
  if(USER){
    $('userName').textContent = USER.username; $('userRole').textContent = ROLE[USER.role] + (USER.class ? ' · ' + USER.class.name : '');
    document.querySelectorAll('#userDrop [data-role]').forEach(a => a.hidden = a.dataset.role !== USER.role);
  }
  const nav = [['#/', 'Hallen']];
  if(USER && USER.role === 'student') nav.push(['#/live', 'Live-Challenge']);
  if(USER && USER.role !== 'admin') nav.push(['#/zertifikate', 'Zertifikate']);
  if(canTeach(USER)) nav.push(['#/leitstand', 'Leitstand']);
  if(canTeach(USER)) nav.push(['#/meldungen', 'Meldungen']);
  if(USER && USER.role === 'admin') nav.push(['#/admin', 'Administration']);
  if(USER) nav.push(['#/konto', 'Konto']);
  nav.push(['#/anleitung', 'Anleitung']);
  const h = location.hash || '#/';
  $('topnav').innerHTML = nav.map(([href, l]) => '<a href="' + href + '"' + ((href === '#/' ? h === '#/' || h === '' : h.startsWith(href)) ? ' class="active"' : '') + '>' + l + '</a>').join('');
}
$('loginBtn').onclick = () => openTerminal('login');
$('userBtn').onclick = e => { e.stopPropagation(); const d = $('userDrop'); d.hidden = !d.hidden; $('userBtn').setAttribute('aria-expanded', String(!d.hidden)); };
document.addEventListener('click', e => { if(!e.target.closest('#userMenu')) $('userDrop').hidden = true; });
$('userDrop').addEventListener('click', e => { if(e.target.closest('a')) $('userDrop').hidden = true; });
$('logoutBtn').onclick = logout;

/* ---------- Login-Terminal ---------- */
let bootTimer = 0;
function openTerminal(tab){
  $('termOverlay').hidden = false; $('termMsg').textContent = ''; $('termMsg').className = 'term-msg';
  setTab(tab || 'login');
  const lines = ['SPS-QUEST LEITSTAND  v1.0', 'VERBINDUNG ZUR FABRIK ........ OK', 'SICHERHEITSKETTE ............. GESCHLOSSEN', 'ARIA-AKTIVITAET .............. ERHOEHT', '> Bitte identifizieren.'];
  const pre = $('termBoot'); pre.textContent = ''; clearTimeout(bootTimer);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ pre.textContent = lines.join('\n'); }
  else { let i = 0; const step = () => { if(i < lines.length){ pre.textContent += (i ? '\n' : '') + lines[i++]; bootTimer = setTimeout(step, 140); } }; step(); }
  setTimeout(() => (tab === 'code' ? $('rgCode') : $('lgUser')).focus(), 60);
}
function closeTerminal(){ $('termOverlay').hidden = true; if(location.hash.startsWith('#/login') || location.hash.startsWith('#/code')) location.hash = '#/'; }
function setTab(t){
  document.querySelectorAll('.term-tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
  $('loginForm').hidden = t !== 'login'; $('codeForm').hidden = t !== 'code'; $('termMsg').textContent = '';
}
document.querySelectorAll('.term-tab').forEach(b => b.onclick = () => { setTab(b.dataset.tab); (b.dataset.tab === 'code' ? $('rgCode') : $('lgUser')).focus(); });
$('termClose').onclick = closeTerminal;
$('termOverlay').addEventListener('keydown', e => { if(e.key === 'Escape') closeTerminal(); });
function termMsg(m, ok){ $('termMsg').textContent = m; $('termMsg').className = 'term-msg ' + (ok ? 'ok' : 'err'); }
$('loginForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true; termMsg('> Prüfe Zugang …', true);
  try{
    const pw = $('lgPw').value;
    const r = await api('POST', 'login', { username: $('lgUser').value.trim(), password: pw });
    USER = r.user; $('lgPw').value = '';
    termMsg('> ZUGANG GEWÄHRT. Willkommen, ' + USER.username + '.', true);
    setTimeout(async () => { $('termOverlay').hidden = true; await afterLogin(pw); }, 450);
  }catch(err){ termMsg('> ' + err.message); }
  btn.disabled = false;
};
let codeCheckT = 0;
$('rgCode').addEventListener('input', () => {
  const v = $('rgCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); $('rgCode').value = v;
  clearTimeout(codeCheckT); $('rgClass').textContent = '';
  if(v.length === 6) codeCheckT = setTimeout(async () => {
    try{ const r = await api('GET', 'class-info?code=' + v); $('rgClass').innerHTML = '✓ Klasse <b>' + esc(r.name) + '</b> bei ' + esc(r.teacher); }
    catch(err){ $('rgClass').textContent = '✗ ' + err.message; }
  }, 250);
});
$('codeForm').onsubmit = async e => {
  e.preventDefault();
  if($('rgPw').value !== $('rgPw2').value) return termMsg('> Die Passwörter stimmen nicht überein.');
  const btn = e.target.querySelector('button'); btn.disabled = true; termMsg('> Lege Konto an …', true);
  try{
    const r = await api('POST', 'register', { code: $('rgCode').value, username: $('rgUser').value.trim(), password: $('rgPw').value });
    USER = r.user; $('rgPw').value = $('rgPw2').value = '';
    termMsg('> KONTO ANGELEGT. Willkommen, ' + USER.username + '.', true);
    setTimeout(async () => { $('termOverlay').hidden = true; await afterLogin(null); }, 450);
  }catch(err){ termMsg('> ' + err.message); }
  btn.disabled = false;
};

async function afterLogin(pw){
  renderTop();
  if(USER.mustChange) await forcePasswordChange(pw);
  if(USER.role === 'student' && !USER.noticeAck) await showNotice();
  if(location.hash.startsWith('#/login') || location.hash.startsWith('#/code') || !location.hash || location.hash === '#/'){
    location.hash = USER.role === 'teacher' ? '#/leitstand' : USER.role === 'admin' ? '#/admin' : '#/';
  }
  route();
}
async function showNotice(){
  await dialog('Hinweis zu deinem Konto',
    '<p class="notice">Deine Dozentin oder dein Dozent sieht in SCL Quest deinen <b>Fortschritt</b> und deinen <b>Programmcode</b> (Lösungen und Entwürfe) – so kann sie/er dir gezielt helfen.</p>' +
    '<p>Verwende nur dein <b>Pseudonym</b>, keinen echten Namen. Dein Name auf dem Zertifikat bleibt nur in deinem Browser. Mehr dazu in der <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a>.</p>',
    [{ label:'Verstanden', value:true, cls:'pri' }], { modal:true });
  try{ await api('POST', 'me/notice', {}); USER.noticeAck = true; }catch(e){}
}
async function forcePasswordChange(knownOld){
  const min = USER.role === 'student' ? 6 : 8;
  await dialog('Neues Passwort wählen',
    '<p>Dein Konto hat ein Startpasswort. Wähle jetzt ein eigenes (mindestens ' + min + ' Zeichen).</p>' +
    (knownOld ? '' : '<label for="fpOld">Bisheriges Passwort</label><input class="inp" id="fpOld" type="password" autocomplete="current-password">') +
    '<label for="fpNew">Neues Passwort</label><input class="inp" id="fpNew" type="password" autocomplete="new-password">' +
    '<label for="fpNew2">Wiederholen</label><input class="inp" id="fpNew2" type="password" autocomplete="new-password"><p class="small" id="fpMsg" style="color:#ff8080"></p>',
    [{ label:'Speichern', value:true, cls:'pri', check: async () => {
      const n = $('fpNew').value;
      if(n !== $('fpNew2').value){ $('fpMsg').textContent = 'Die Passwörter stimmen nicht überein.'; return false; }
      try{ await api('POST', 'me/password', { old: knownOld || $('fpOld').value, password: n }); USER.mustChange = false; toast('Passwort geändert.'); return true; }
      catch(e){ $('fpMsg').textContent = e.message; return false; }
    } }], { modal:true });
}
async function logout(){
  // Spielstände dieses Kontos zuerst hochladen, dann aus dem Browser entfernen (geteilte Schul-PCs)
  for(const q of Object.keys(GAME_KEY)){
    try{
      const sy = JSON.parse(localStorage.getItem(SYNC_KEY[q]) || 'null');
      if(!sy || !USER || String(sy.user).toLowerCase() !== USER.username.toLowerCase()) continue;
      if(sy.dirty){ const st = JSON.parse(localStorage.getItem(GAME_KEY[q]) || 'null'); if(st) await api('PUT', 'progress/' + q, { state: st, summary: sy.summary || {}, base: sy.base || 0, force: true }); }
      const settings = (JSON.parse(localStorage.getItem(GAME_KEY[q]) || '{}') || {}).settings;
      localStorage.removeItem(SYNC_KEY[q]);
      localStorage.setItem(GAME_KEY[q], JSON.stringify(settings ? { v:4, settings } : { v:4 }));
    }catch(e){}
  }
  try{ await api('POST', 'logout', {}); }catch(e){}
  USER = null; renderTop(); toast('Abgemeldet. Der Spielstand wurde aus diesem Browser entfernt und liegt sicher im Konto.');
  location.hash = '#/'; route();
}

/* ---------- Startseite: Halle mit fünf Toren ---------- */
const ARIA_LINES = [
  'Ah. Ein Mensch. Willkommen in meiner Fabrik.',
  'Vier Hallen, vier Sprachen: SCL, KOP, FUP, AWL. In jeder habe ich … kleine Verbesserungen vorgenommen.',
  'Die Roboterzelle ist offen. Die anderen Tore halte ich noch verschlossen. Noch.',
  'Beweise, dass du eine Steuerung besser programmierst als ich. Viel Glück — du wirst es brauchen.'
];
let ariaTimer = 0, ariaDone = false;
function typeAria(el){
  clearTimeout(ariaTimer);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false; try{ seen = sessionStorage.getItem('spsq_aria') === '1'; }catch(e){}
  const full = ARIA_LINES.join(' ');
  if(reduce || seen || ariaDone){ el.innerHTML = esc(full); return; }
  let i = 0;
  const step = () => {
    if(!document.body.contains(el)) return;
    i += 1; el.innerHTML = esc(full.slice(0, i)) + '<span class="cur"></span>';
    if(i < full.length) ariaTimer = setTimeout(step, full[i - 1] === '.' || full[i - 1] === '—' ? 320 : 24);
    else { ariaDone = true; try{ sessionStorage.setItem('spsq_aria', '1'); }catch(e){} }
  };
  step();
}
function localProgress(q, hidden){
  try{ const s = JSON.parse(localStorage.getItem(GAME_KEY[q]) || 'null'); if(!s) return null; return { tasks: Object.keys(s.doneTasks || {}).filter(id => !(hidden && hidden.has(id))).length, theory: Object.keys(s.doneTheory || {}).length }; }catch(e){ return null; }
}
async function viewHome(){
  const v = $('view');
  v.innerHTML = '<section class="hero"><div class="hero-eyebrow">Lernspiele für Steuerungstechnik</div><h1>SPS <span>QUEST</span></h1>' +
    '<p class="hero-sub">Programmiere echte Anlagen in SCL, KOP, FUP und AWL — mit Live-Simulation, echten Tests und ARIA, der Fabrik-KI, die dir jeden Fehler heimzahlt.</p>' +
    '<div class="aria" role="note" aria-label="Funkspruch von ARIA"><div class="aria-eye" aria-hidden="true"></div><div><div class="aria-who">ARIA · FABRIK-KI</div><div class="aria-text" id="ariaText"></div></div><button class="aria-skip" id="ariaSkip">überspringen</button></div></section>' +
    (USER && USER.role === 'student' ? '<div class="quick"><a class="btn pri" href="#/live">⚡ Live-Challenge beitreten</a><a class="btn" href="#/zertifikate">🎓 Zertifikate</a><a class="btn" href="#/feedback">Feedback geben</a></div>' : '') +
    (canTeach(USER) ? '<div class="quick"><a class="btn pri" href="#/leitstand">Leitstand öffnen</a><a class="btn" href="#/live/neu">⚡ Neue Live-Challenge</a></div>' : '') +
    '<section class="gates" aria-label="Die Hallen">' + QUESTS.map(gateHTML).join('') + '</section>' +
    '<section class="home-cards">' +
      '<div class="hc"><div class="k">FÜR LERNENDE</div><h3>Ohne Konto sofort loslegen</h3><p>Jede Quest läuft direkt im Browser, auch offline. Mit einem Konto (Klassencode) wandert dein Fortschritt mit – auf jedes Gerät.</p></div>' +
      '<div class="hc"><div class="k">FÜR DOZENTEN</div><h3>Klassen im Leitstand</h3><p>Klassen anlegen, Konten erzeugen, Fortschritt und Code jedes Pseudonyms sehen, Passwörter zurücksetzen.</p></div>' +
      '<div class="hc"><div class="k">DATENSPARSAM</div><h3>Nur Pseudonyme</h3><p>Keine E-Mail, keine echten Namen. Konten bestehen aus Benutzername und Passwort – mehr nicht.</p></div>' +
    '</section>' +
    '<section class="man-home" aria-label="Anleitungen"><h2>Anleitungen</h2><div class="man-cards">' +
      '<a class="man-card" href="#/anleitung/lernende"><span class="ic" aria-hidden="true">🎮</span><b>Lernende</b><span>Spielen, mit Klassencode anmelden, Live-Challenge beitreten</span></a>' +
      '<a class="man-card" href="#/anleitung/dozenten"><span class="ic" aria-hidden="true">🧑‍🏫</span><b>Dozenten</b><span>Klassen, Konten, Fortschritt, Live-Challenge am Beamer</span></a>' +
      '<a class="man-card" href="#/anleitung/admin"><span class="ic" aria-hidden="true">🛠️</span><b>Admin</b><span>Dozenten verwalten, Sicherheit, Betrieb</span></a>' +
    '</div></section>';
  typeAria($('ariaText'));
  $('ariaSkip').onclick = () => { ariaDone = true; typeAria($('ariaText')); $('ariaSkip').hidden = true; };
  // Fortschritt an den Toren
  QUESTS.filter(q => q.open).forEach(async q => {
    const el = document.querySelector('.gate[data-q="' + q.q + '"] .gate-state'); if(!el) return;
    let srv = null, total = 180, hid = new Set();
    if(USER && USER.role === 'student'){ try{ srv = await api('GET', 'progress/' + q.q); }catch(e){} }
    try{ const m = await questMeta(q.q); total = m.tasks.filter(t => !t.hidden).length + m.theory.length; hid = new Set(m.tasks.filter(t => t.hidden).map(t => t.id)); }catch(e){}
    let done = null;
    if(srv && srv.state) done = Object.keys(srv.state.doneTasks || {}).filter(id => !hid.has(id)).length + Object.keys(srv.state.doneTheory || {}).length;
    else { const lp = localProgress(q.q, hid); if(lp) done = lp.tasks + lp.theory; }
    if(done){ el.innerHTML = '▸ ' + done + ' / ' + total + ' gelöst<div class="gate-bar"><i style="width:' + Math.min(100, Math.round(100 * done / total)) + '%"></i></div>'; }
  });
}
function gateHTML(g){
  const tag = g.open ? 'a' : 'div';
  return '<' + tag + ' class="gate ' + (g.open ? 'open' : 'locked') + '" data-q="' + g.q + '"' + (g.open ? ' href="' + g.href + '"' : ' role="group" aria-label="' + g.name + ' Quest – in Vorbereitung"') + '>' +
    '<div class="gate-frame"><div class="gate-inner"><div class="gate-scene" aria-hidden="true">' + g.svg + '</div></div>' +
    '<div class="door l"><div class="hz"></div></div><div class="door r"><div class="hz"></div></div><span class="gate-lamp"></span><span class="gate-sign">HALLE ' + g.name + '</span></div>' +
    '<div class="gate-info"><div class="gate-title">' + (g.title || g.name + ' <b>QUEST</b>') + '</div><div class="gate-machine">' + g.machine + '</div>' +
    '<div class="gate-state">' + (g.open ? '▸ Tor offen · spielen' : '■ in Vorbereitung') + '</div></div></' + tag + '>';
}

/* ---------- Konto ---------- */
function needLogin(){ if(!USER){ $('view').innerHTML = '<div class="console"><div class="panel empty">Bitte zuerst im Leitstand-Terminal anmelden.<br><br><button class="btn pri" id="nlBtn">Anmelden</button></div></div>'; $('nlBtn').onclick = () => openTerminal('login'); return true; } return false; }
function viewAccount(){
  if(needLogin()) return;
  const v = $('view');
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / KONTO</div><h1>' + esc(USER.username) + '</h1><p class="lead">' + ROLE[USER.role] + (USER.class ? ' · Klasse ' + esc(USER.class.name) + ' (' + esc(USER.class.teacher) + ')' : '') + '</p>' +
    (USER.role === 'admin' && USER.secretAdmin ? '<div class="panel"><h2>Admin-Konto</h2><p class="muted">Benutzername und Passwort kommen aus den Worker-Secrets <code>ADMIN_USER</code> / <code>ADMIN_PASSWORD</code> und werden im Cloudflare-Dashboard geändert.</p></div>' :
    '<div class="panel"><h2>Passwort ändern</h2><form id="pwForm" class="row"><input class="inp" type="password" id="pwOld" placeholder="bisheriges Passwort" autocomplete="current-password" required>' +
    '<input class="inp" type="password" id="pwNew" placeholder="neues Passwort" autocomplete="new-password" required><input class="inp" type="password" id="pwNew2" placeholder="wiederholen" autocomplete="new-password" required><button class="btn pri">Speichern</button></form></div>') +
    (USER.role === 'student' ? '<div class="panel"><h2>Was sieht meine Dozentin / mein Dozent?</h2><p class="muted">Fortschritt, Punkte, Sterne und deinen Programmcode (Lösungen und Entwürfe) in den Quests. Dein Name auf dem Zertifikat bleibt nur in deinem Browser.</p></div>' +
      '<div class="panel"><h2>Konto löschen</h2><p class="muted">Löscht dein Konto und alle gespeicherten Spielstände endgültig.</p><button class="btn dan" id="delSelf">Konto löschen …</button></div>' : '') +
    '</div>';
  if($('pwForm')) $('pwForm').onsubmit = async e => {
    e.preventDefault();
    if($('pwNew').value !== $('pwNew2').value) return toast('Die Passwörter stimmen nicht überein.', true);
    try{ await api('POST', 'me/password', { old: $('pwOld').value, password: $('pwNew').value }); toast('Passwort geändert. Andere Geräte wurden abgemeldet.'); e.target.reset(); }
    catch(err){ toast(err.message, true); }
  };
  if($('delSelf')) $('delSelf').onclick = async () => {
    const ok = await dialog('Konto endgültig löschen?', '<p>Alle Spielstände im Konto gehen verloren. Zur Bestätigung dein Passwort eingeben:</p><input class="inp" type="password" id="delPw" autocomplete="current-password">' +
      '<label class="row small" style="margin-top:10px"><input type="checkbox" id="delCerts"> Auch meine Zertifikate löschen (sonst bleiben sie über den Prüfcode prüfbar)</label>',
      [{ label:'Abbrechen', value:false }, { label:'Endgültig löschen', value:true, cls:'dan' }]);
    if(!ok) return;
    try{ await api('DELETE', 'me', { password: $('delPw').value, deleteCertificates: $('delCerts').checked }); USER = null; renderTop(); toast('Konto gelöscht.'); location.hash = '#/'; }
    catch(err){ toast(err.message, true); }
  };
}

/* ---------- Leitstand (Dozent) ---------- */
async function viewClasses(){
  if(needLogin()) return;
  if(!canTeach(USER)){ location.hash = '#/'; return; }
  const v = $('view');
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / LEITSTAND</div><h1>Leitstand</h1><p class="lead">Deine Klassen, Konten und der Fortschritt deiner Lernenden. <a href="#/meldungen">Feedback und Fehlermeldungen →</a></p>' +
    '<div class="panel"><h2>Neue Klasse</h2><form class="row" id="newClass"><input class="inp grow" id="ncName" maxlength="60" placeholder="z.B. EM 3a – Automatik" required><button class="btn pri">Klasse anlegen</button></form></div>' +
    '<div class="panel"><h2>Klassen</h2><div id="clsList" class="cards"><div class="muted">Lade …</div></div></div></div>';
  $('newClass').onsubmit = async e => {
    e.preventDefault();
    try{ const c = await api('POST', 'classes', { name: $('ncName').value }); location.hash = '#/leitstand/klasse/' + c.id; }
    catch(err){ toast(err.message, true); }
  };
  try{
    const r = await api('GET', 'classes');
    $('clsList').innerHTML = r.classes.length ? r.classes.map(c => '<a class="ccard" href="#/leitstand/klasse/' + c.id + '"><div class="t">' + esc(c.name) + '</div><div class="muted small">' + c.students + (c.students === 1 ? ' Konto' : ' Konten') + ' · angelegt ' + fmtDate(c.created_at) + '</div><div style="margin-top:8px">Code <span class="c">' + esc(c.code) + '</span> ' + (c.self_signup ? '<span class="pill ok">Selbstanmeldung offen</span>' : '<span class="pill">geschlossen</span>') + '</div></a>').join('')
      : '<div class="empty">Noch keine Klasse. Lege oben die erste an.</div>';
  }catch(err){ $('clsList').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; }
}
async function viewClass(id){
  if(needLogin()) return;
  const v = $('view');
  let r;
  try{ r = await api('GET', 'classes/' + id); }catch(err){ v.innerHTML = '<div class="console"><div class="panel empty">' + esc(err.message) + '</div></div>'; return; }
  const c = r.class, st = r.students;
  const sp = s => s.progress[LQ] || {};
  const tot = st.length, active7 = st.filter(s => (sp(s).updatedAt || 0) > Date.now() - 7 * 864e5).length;
  const avg = tot ? Math.round(st.reduce((a, s) => a + (sp(s).tasks || 0), 0) / tot) : 0;
  const SEN = LQ === 'sensor', fws = st.map(s => (sp(s).m || {}).fw).filter(x => x != null).sort((a, b) => a - b), fwMed = fws.length ? fws[fws.length >> 1] : null;
  const mCell = p => { const m = p.m; return '<td class="num small" title="Median Zeit bis zur ersten Ader · Abbrüche · Zeig mir">' + (m ? (m.fw != null ? '<span class="' + (m.fw > 30 ? 'warn-t' : '') + '">' + m.fw + ' s</span>' : '–') + ' · ' + m.ab + ' · ' + m.help : '–') + '</td>'; };
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/leitstand">LEITSTAND</a> / KLASSE</div>' +
    '<div class="row"><h1 class="grow">' + esc(c.name) + '</h1><button class="btn sm" id="renCls">Umbenennen</button><button class="btn sm dan" id="delCls">Klasse löschen</button></div>' +
    '<div class="kpis"><div class="kpi"><div class="v">' + tot + '</div><div class="l">Konten</div></div><div class="kpi"><div class="v">' + active7 + '</div><div class="l">aktiv (7 Tage)</div></div>' +
    '<div class="kpi"><div class="v">' + avg + '</div><div class="l">Ø Aufgaben ' + QNAME[LQ].split(' ')[0] + '</div></div><div class="kpi"><div class="v">' + st.filter(s => !s.noticeAck).length + '</div><div class="l">Hinweis offen</div></div>' +
    (SEN ? '<div class="kpi" title="Median über die Lernenden; Ziel unter 30 s"><div class="v">' + (fwMed != null ? fwMed + '<span class="muted small"> s</span>' : '–') + '</div><div class="l">erste Ader (Median)</div></div>' : '') + '</div>' +
    '<div class="panel"><h2>Klassencode <span class="tag">für die Selbstanmeldung im Portal</span></h2><div class="row"><span class="code-big" id="clsCode">' + esc(c.code) + '</span><span class="grow"></span>' +
    '<label class="row small"><input type="checkbox" id="selfSu"' + (c.selfSignup ? ' checked' : '') + '> Selbstanmeldung offen</label><button class="btn sm" id="newCode">Neuen Code erzeugen</button></div>' +
    '<p class="muted small" style="margin:8px 0 0">Lernende öffnen <b>' + esc(location.host) + '</b> → Anmelden → [KLASSENCODE] und wählen ein Pseudonym. Direktlink: <code id="clsLink">' + esc(location.origin + '/#/code/' + c.code) + '</code></p></div>' +
    '<div class="panel"><h2>Konten erzeugen <span class="tag">Startpasswort wird angezeigt und muss beim ersten Login geändert werden</span></h2>' +
    '<form class="row" id="genForm"><input class="inp" id="genPrefix" placeholder="Präfix, z.B. em3a_" maxlength="20" style="width:180px"><input class="inp" id="genCount" type="number" min="1" max="40" value="10" style="width:90px"><button class="btn pri">Nummeriert erzeugen</button>' +
    '<span class="muted small">oder</span><button class="btn" type="button" id="genList">Namensliste …</button></form></div>' +
    '<div class="panel"><div class="row"><h2 class="grow">Lernende <span class="tag">' + QNAME[LQ] + ' · ' + tot + ' Konten</span></h2>' + questSwitch() + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pseudonym</th><th>Stand</th><th>Fortschritt</th><th class="num">Aufgaben</th><th class="num">Theorie</th><th class="num">Punkte</th>' + (SEN ? '<th class="num" title="erste Ader (Median) · Abbrüche · Zeig mir">Messung</th>' : '') + '<th>zuletzt</th><th></th></tr></thead><tbody>' +
    (st.length ? st.map(s => { const p = sp(s), pct = p.totalTasks ? Math.round(100 * (p.tasks || 0) / p.totalTasks) : 0;
      return '<tr><td><a href="#/leitstand/schueler/' + s.id + '">' + esc(s.username) + '</a>' + (s.mustChange ? ' <span class="pill warn" title="Startpasswort noch nicht geändert">Start-PW</span>' : '') + '</td><td class="small muted">' + esc(p.current || '–') + '</td>' +
        '<td><div class="pbar" title="' + pct + ' %"><i style="width:' + pct + '%"></i></div></td><td class="num">' + (p.tasks || 0) + '</td><td class="num">' + (p.theory || 0) + '</td><td class="num">' + (p.points || 0) + '</td>' + (SEN ? mCell(p) : '') +
        '<td class="small muted" title="' + fmtDate(p.updatedAt || s.lastLogin) + '">' + ago(p.updatedAt || s.lastLogin) + '</td><td style="white-space:nowrap"><button class="btn sm" data-reset="' + s.id + '">Passwort</button> <button class="btn sm dan" data-del="' + s.id + '" data-name="' + esc(s.username) + '">✕</button></td></tr>'; }).join('')
      : '<tr><td colspan="' + (SEN ? 9 : 8) + '" class="empty">Noch keine Lernenden. Konten erzeugen oder den Klassencode weitergeben.</td></tr>') +
    '</tbody></table></div></div></div>';
  bindQuestSwitch(v, () => viewClass(id));
  $('selfSu').onchange = async e => { try{ await api('PATCH', 'classes/' + id, { selfSignup: e.target.checked }); toast(e.target.checked ? 'Selbstanmeldung geöffnet.' : 'Selbstanmeldung geschlossen.'); }catch(err){ toast(err.message, true); } };
  $('newCode').onclick = async () => { if(!await confirmDlg('Neuen Klassencode erzeugen?', 'Der alte Code funktioniert danach nicht mehr. Bestehende Konten bleiben erhalten.', 'Neuer Code')) return; try{ const x = await api('PATCH', 'classes/' + id, { newCode: true }); $('clsCode').textContent = x.class.code; $('clsLink').textContent = location.origin + '/#/code/' + x.class.code; }catch(err){ toast(err.message, true); } };
  $('renCls').onclick = async () => {
    const ok = await dialog('Klasse umbenennen', '<input class="inp" id="renName" maxlength="60" value="' + esc(c.name) + '">', [{ label:'Abbrechen', value:false }, { label:'Speichern', value:true, cls:'pri' }]);
    if(ok){ try{ await api('PATCH', 'classes/' + id, { name: $('renName').value }); viewClass(id); }catch(err){ toast(err.message, true); } }
  };
  $('delCls').onclick = async () => {
    if(!await confirmDlg('Klasse löschen?', '<p>Die Klasse <b>' + esc(c.name) + '</b> und <b>alle ' + tot + ' Konten</b> mit ihren Spielständen werden endgültig gelöscht.</p>', 'Endgültig löschen', true)) return;
    try{ await api('DELETE', 'classes/' + id); toast('Klasse gelöscht.'); location.hash = '#/leitstand'; }catch(err){ toast(err.message, true); }
  };
  const showCreated = async list => {
    const pr = await dialog(list.length + (list.length === 1 ? ' Konto' : ' Konten') + ' erzeugt', '<p class="notice">Die Startpasswörter werden <b>nur jetzt</b> angezeigt. Drucke sie aus oder notiere sie.</p>' + credsHTML(list),
      [{ label:'Zugangszettel drucken', value:'print' }, { label:'Fertig', value:true, cls:'pri' }], { modal:true });
    if(pr === 'print'){ printSlips(c.name, list); await showCreated(list); return; }
    viewClass(id);
  };
  $('genForm').onsubmit = async e => {
    e.preventDefault();
    const prefix = $('genPrefix').value.trim(); if(!prefix) return toast('Bitte ein Präfix angeben.', true);
    try{ const x = await api('POST', 'classes/' + id + '/students', { prefix, count: +$('genCount').value }); await showCreated(x.created); }catch(err){ toast(err.message, true); }
  };
  $('genList').onclick = async () => {
    const ok = await dialog('Konten aus Namensliste', '<p class="muted">Ein Pseudonym pro Zeile (keine echten Namen). 3–24 Zeichen: Buchstaben, Ziffern, <code>. _ -</code></p><textarea class="inp" id="genNames" placeholder="RoboFuchs\nBlauerKolben\n…"></textarea>',
      [{ label:'Abbrechen', value:false }, { label:'Erzeugen', value:true, cls:'pri' }]);
    if(!ok) return;
    const names = $('genNames').value.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    try{ const x = await api('POST', 'classes/' + id + '/students', { usernames: names }); await showCreated(x.created); }catch(err){ toast(err.message, true); }
  };
  v.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => {
    const s = st.find(x => x.id === +b.dataset.reset);
    if(!await confirmDlg('Passwort zurücksetzen?', 'Für <b>' + esc(s.username) + '</b> wird ein neues Startpasswort erzeugt. Angemeldete Geräte werden abgemeldet.', 'Zurücksetzen')) return;
    try{ const x = await api('POST', 'students/' + s.id + '/reset', {}); await dialog('Neues Startpasswort', credsHTML([x]), [{ label:'Zettel drucken', value:'print' }, { label:'OK', value:true, cls:'pri' }]).then(p => { if(p === 'print') printSlips(c.name, [x]); }); viewClass(id); }
    catch(err){ toast(err.message, true); }
  });
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if(!await confirmDlg('Konto löschen?', 'Das Konto <b>' + esc(b.dataset.name) + '</b> und alle Spielstände werden endgültig gelöscht.', 'Löschen', true)) return;
    try{ await api('DELETE', 'students/' + b.dataset.del); viewClass(id); }catch(err){ toast(err.message, true); }
  });
}
async function viewStudent(id){
  if(needLogin()) return;
  const v = $('view');
  let r, meta;
  const q = LQ;
  try{ [r, meta] = await Promise.all([api('GET', 'students/' + id + '/progress/' + q), questMeta(q)]); }
  catch(err){ v.innerHTML = '<div class="console"><div class="panel empty">' + esc(err.message) + '</div></div>'; return; }
  const st = r.state || { doneTasks:{}, doneTheory:{}, solutions:{}, drafts:{}, fails:{}, hints:{} };
  const done = st.doneTasks || {}, th = st.doneTheory || {}, sol = st.solutions || {}, dr = st.drafts || {};
  const hiddenIds = new Set(meta.tasks.filter(t => t.hidden).map(t => t.id));   // ausgeblendete Aufgaben: nicht gezählt, aber weiter auflösbar
  const s = r.summary || {};
  const back = canTeach(USER) ? '<a href="#/leitstand">LEITSTAND</a> / ' : '';
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / ' + back + 'LERNENDE</div><h1>' + esc(r.student.username) + '</h1>' +
    questSwitch() + '<p class="lead">' + QNAME[q] + ' · ' + esc(s.current || 'noch nicht begonnen') + ' · zuletzt ' + ago(r.updatedAt) + (r.student.noticeAck ? '' : ' · <span class="pill warn">Hinweis zur Einsicht noch nicht bestätigt</span>') + '</p>' +
    '<div class="kpis"><div class="kpi"><div class="v">' + Object.keys(done).filter(k => !hiddenIds.has(k)).length + '<span class="muted small">/' + meta.tasks.filter(t => !t.hidden).length + '</span></div><div class="l">Aufgaben</div></div>' +
    '<div class="kpi"><div class="v">' + Object.keys(th).length + '<span class="muted small">/' + meta.theory.length + '</span></div><div class="l">Theorie</div></div>' +
    '<div class="kpi"><div class="v">' + (s.points || 0) + '</div><div class="l">Punkte</div></div>' +
    '<div class="kpi"><div class="v">' + Object.keys(done).filter(k => !hiddenIds.has(k)).reduce((a, k) => a + (done[k].stars || 0), 0) + '</div><div class="l">Sterne</div></div></div>' +
    '<div class="panel"><h2>Aufgaben <span class="tag">Klick auf eine Aufgabe zeigt Lösung oder Entwurf</span></h2><div class="chgrid">' +
    meta.chapters.map(ch => '<div class="chrow"><div class="chname"><b>' + ch.n + '</b> ' + esc(ch.title) + '</div><div class="cells">' +
      (() => { const ths = meta.theory.filter(t => t.ch === ch.n), tks = meta.tasks.filter(t => t.ch === ch.n && !t.hidden);
        const thCell = t => '<button class="cell th ' + (th[t.id] ? 's2' : '') + '" title="Theorie: ' + esc(t.title) + (th[t.id] ? ' – bestanden (' + th[t.id].score + '/' + th[t.id].n + ')' : ' – offen') + '" data-th="' + t.id + '">T</button>';
        const tkCell = t => { const d = done[t.id]; const cls = d ? 's' + (d.revealed ? 0 : d.stars || 1) : (dr[t.id] ? 'draft' : '');
          return '<button class="cell ' + cls + '" data-task="' + t.id + '" title="' + t.no + ': ' + esc(t.title) + (d ? ' – ' + (d.stars || 0) + '★, ' + (d.fails || 0) + ' Fehlversuche, ' + (d.hints || 0) + ' Hinweise' : dr[t.id] ? ' – Entwurf' : '') + '">' + t.no + '</button>'; };
        return (ths[0] ? thCell(ths[0]) : '') + tks.slice(0, 5).map(tkCell).join('') + (ths[1] ? thCell(ths[1]) : '') + tks.slice(5).map(tkCell).join(''); })() +
      '</div></div>').join('') + '</div>' +
    (() => { const old = meta.tasks.filter(t => t.hidden && (done[t.id] || dr[t.id] || sol[t.id])); if(!old.length) return '';
      return '<div class="chrow"><div class="chname muted">frühere Aufgaben</div><div class="cells">' + old.map(t => { const d = done[t.id]; const cls = d ? 's' + (d.revealed ? 0 : d.stars || 1) : 'draft'; return '<button class="cell ' + cls + '" data-task="' + t.id + '" title="ausgeblendet: ' + esc(t.title) + '">' + esc(t.id.replace(/^w(\d)_.*/, 'M$1')) + '</button>'; }).join('') + '</div></div>'; })() +
    '<div class="legend"><span><i class="cell s3"></i>3★</span><span><i class="cell s2"></i>2★ / Theorie bestanden</span><span><i class="cell s1"></i>1★</span><span><i class="cell s0"></i>Lösung angesehen</span><span><i class="cell draft"></i>Entwurf</span><span><i class="cell"></i>offen</span></div></div></div>';
  if(q === 'sensor' && st.sensorMetrics && Object.keys(st.sensorMetrics).length){
    const sec = ms => ms == null ? '–' : (ms / 1000 < 60 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms / 60000) + ' min');
    const PH = [['verbinden', 'Verb.'], ['signale', 'Sign.'], ['programm', 'Progr.'], ['laufen', 'Laufen']];
    const rows = meta.tasks.filter(t => st.sensorMetrics[t.id]).map(t => { const m = st.sensorMetrics[t.id];
      return '<tr><td>' + (t.hidden ? '–' : t.no) + '</td><td>' + esc(t.title) + '</td><td class="num' + (m.firstWireMs > 30e3 ? ' warn-t' : '') + '">' + sec(m.firstWireMs) + '</td><td class="num">' + sec(m.solvedMs) + '</td><td class="num">' + (m.aborts || 0) + '</td><td class="num">' + (m.help || 0) + '</td>' +
        PH.map(([k]) => '<td class="num small">' + (m.phaseMs && m.phaseMs[k] ? sec(m.phaseMs[k]) : '') + '</td>').join('') + '</tr>'; }).join('');
    v.querySelector('.console').insertAdjacentHTML('beforeend', '<div class="panel" id="svMetrics"><h2>Messung <span class="tag">erste Ader: Ziel unter 30 s</span></h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nr.</th><th>Aufgabe</th><th class="num">erste Ader</th><th class="num">gelöst nach</th><th class="num">Abbrüche</th><th class="num">Zeig mir</th>' +
      PH.map(([, l]) => '<th class="num">' + l + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>');
  }
  bindQuestSwitch(v, () => viewStudent(id));
  v.querySelectorAll('[data-task]').forEach(b => b.onclick = () => {
    const t = meta.tasks.find(x => x.id === b.dataset.task), d = done[t.id];
    const v2 = q === 'sensor' ? (st.sensorWork && st.sensorWork[t.id]) || (dr[t.id] && dr[t.id].v2 ? dr[t.id] : null) : null;   // neue Kernschleife: Werkstattzustand (mit Adern) statt Textbeschreibung
    const code = v2 || sol[t.id] || dr[t.id];
    dialog((t.hidden ? '(ausgeblendet) ' : t.no + ': ') + t.title,
      '<p class="muted small">Kapitel ' + t.ch + (d ? ' · gelöst ' + fmtDate(d.at) + ' · ' + (d.stars || 0) + '★ · ' + (d.fails || 0) + ' Fehlversuche · ' + (d.hints || 0) + ' Hinweise' + (d.revealed ? ' · Lösung angesehen' : '') : ' · noch nicht gelöst') + '</p>' +
      (code ? '<p class="small">' + (v2 ? (d ? 'Werkstatt beim Lösen' : 'Aktueller Stand der Werkstatt') : sol[t.id] ? 'Eingereichte Lösung' : 'Aktueller Entwurf') + ':</p>' + codeView(q, code, t.id) : '<p class="empty">Kein Code gespeichert.</p>'),
      [{ label:'Schliessen', value:true, cls:'pri' }], { wide:true });
    if(q === 'sensor' && code && code.v2){ const el = document.querySelector('.sv-leit[data-tid]'); if(el){ el._code = code; mountSensorWiring(el.parentNode); } }
  });
}

/* ---------- Administration ---------- */
async function viewAdmin(){
  if(needLogin()) return;
  if(USER.role !== 'admin'){ location.hash = '#/'; return; }
  const v = $('view');
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / ADMINISTRATION</div><h1>Administration</h1><p class="lead">Dozentenkonten verwalten. Nur der Admin legt Dozenten an. <a href="#/leitstand">Eigene Klassen im Leitstand →</a> · <a href="#/meldungen">Feedback und Fehlermeldungen →</a></p>' +
    '<div class="kpis" id="kpis"></div>' +
    '<div class="panel"><h2>Neuer Dozent</h2><form class="row" id="newT"><input class="inp" id="ntName" placeholder="Benutzername (Kürzel)" maxlength="24" required><span class="muted small">Startpasswort wird erzeugt und muss beim ersten Login geändert werden.</span><span class="grow"></span><button class="btn pri">Anlegen</button></form></div>' +
    '<div class="panel"><h2>Dozenten</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Benutzer</th><th class="num">Klassen</th><th class="num">Lernende</th><th>angelegt</th><th>letzter Login</th><th></th></tr></thead><tbody id="tList"><tr><td colspan="6" class="muted">Lade …</td></tr></tbody></table></div></div></div>';
  $('newT').onsubmit = async e => {
    e.preventDefault();
    try{ const x = await api('POST', 'admin/teachers', { username: $('ntName').value.trim() }); await dialog('Dozent angelegt', '<p class="notice">Das Startpasswort wird nur jetzt angezeigt.</p>' + credsHTML([x])); viewAdmin(); }
    catch(err){ toast(err.message, true); }
  };
  try{
    const [s, t] = await Promise.all([api('GET', 'admin/stats'), api('GET', 'admin/teachers')]);
    $('kpis').innerHTML = [['Dozenten', s.teachers], ['Klassen', s.classes], ['Lernende', s.students], ['Spielstände', s.progress]].map(([l, n]) => '<div class="kpi"><div class="v">' + n + '</div><div class="l">' + l + '</div></div>').join('');
    $('tList').innerHTML = t.teachers.length ? t.teachers.map(x => '<tr><td><b>' + esc(x.username) + '</b></td><td class="num">' + x.classes + '</td><td class="num">' + x.students + '</td><td class="small muted">' + fmtDate(x.created_at) + '</td><td class="small muted">' + ago(x.last_login) + '</td>' +
      '<td style="white-space:nowrap"><button class="btn sm" data-tr="' + x.id + '" data-n="' + esc(x.username) + '">Passwort</button> <button class="btn sm dan" data-td="' + x.id + '" data-n="' + esc(x.username) + '" data-c="' + x.classes + '">✕</button></td></tr>').join('')
      : '<tr><td colspan="6" class="empty">Noch keine Dozenten.</td></tr>';
    v.querySelectorAll('[data-tr]').forEach(b => b.onclick = async () => {
      if(!await confirmDlg('Passwort zurücksetzen?', 'Neues Startpasswort für <b>' + esc(b.dataset.n) + '</b> erzeugen?', 'Zurücksetzen')) return;
      try{ const x = await api('POST', 'admin/teachers/' + b.dataset.tr + '/reset', {}); await dialog('Neues Startpasswort', credsHTML([x])); }catch(err){ toast(err.message, true); }
    });
    v.querySelectorAll('[data-td]').forEach(b => b.onclick = async () => {
      const n = +b.dataset.c;
      if(!await confirmDlg('Dozent löschen?', '<b>' + esc(b.dataset.n) + '</b> wird gelöscht' + (n ? ' – <b>mit ' + n + ' Klasse(n) und allen Konten darin</b>' : '') + '. Das kann nicht rückgängig gemacht werden.', 'Endgültig löschen', true)) return;
      try{ await api('DELETE', 'admin/teachers/' + b.dataset.td, { withClasses: true }); viewAdmin(); }catch(err){ toast(err.message, true); }
    });
  }catch(err){ toast(err.message, true); }
}

/* ---------- Router ---------- */
const EXTRA_ROUTES = [];   // weitere Ansichten (z.B. Live-Challenge) hängen sich hier ein
window.SPSQ = { canTeach, questMeta, QNAME, OPEN_QUESTS, get LQ(){ return LQ; }, api, esc, dialog, confirmDlg, toast, get user(){ return USER; }, routes: EXTRA_ROUTES, fmtDate, ago, openTerminal };
async function route(){
  const h = location.hash || '#/';
  renderTop();
  $('termOverlay').hidden = !(h.startsWith('#/login') || h.startsWith('#/code')) || !!USER;
  if(h.startsWith('#/login') && !USER) openTerminal('login');
  if(h.startsWith('#/code') && !USER){ openTerminal('code'); const c = h.split('/')[2]; if(c){ $('rgCode').value = c; $('rgCode').dispatchEvent(new Event('input')); } }
  let m;
  for(const r of EXTRA_ROUTES){ if((m = h.match(r.re))){ await r.view(m); window.scrollTo(0, 0); return; } }
  if(h === '#/konto') viewAccount();
  else if(h === '#/leitstand') viewClasses();
  else if((m = h.match(/^#\/leitstand\/klasse\/(\d+)$/))) viewClass(+m[1]);
  else if((m = h.match(/^#\/leitstand\/schueler\/(\d+)$/))) viewStudent(+m[1]);
  else if(h === '#/admin') viewAdmin();
  else viewHome();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- Staub in der Halle ---------- */
(function dust(){
  const cv = $('dust'), ctx = cv.getContext('2d');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let W = 0, H = 0, P = [];
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; P = Array.from({ length: Math.min(90, Math.round(W * H / 16000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + .3, vx: (Math.random() - .5) * .15, vy: -Math.random() * .25 - .04, a: Math.random() * .5 + .1 })); };
  resize(); addEventListener('resize', resize);
  const tick = () => {
    if(!document.hidden){
      ctx.clearRect(0, 0, W, H);
      for(const p of P){ p.x += p.vx; p.y += p.vy; if(p.y < -5){ p.y = H + 5; p.x = Math.random() * W; } if(p.x < -5) p.x = W + 5; if(p.x > W + 5) p.x = -5;
        ctx.globalAlpha = p.a; ctx.fillStyle = '#cfe3ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
    }
    requestAnimationFrame(tick);
  };
  tick();
})();

/* ---------- Start ---------- */
(async function start(){
  try{ const r = await api('GET', 'me'); USER = r.user; }catch(e){ USER = null; }
  await route();
  if(USER && USER.mustChange) await forcePasswordChange(null);
  if(USER && USER.role === 'student' && !USER.noticeAck) await showNotice();
})();
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
