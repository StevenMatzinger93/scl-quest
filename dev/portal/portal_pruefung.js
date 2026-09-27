/* ===== SPS Quest Portal: Prüfungen im Leitstand (Dozent) und Zertifikate (Admin) =====
   Leitstand: Karte „Prüfungen unter Aufsicht“ · #/pruefung/:id Beamer-Übersicht · Klassenansicht: Zertifikate
   Administration: Zertifikate widerrufen · Konto: Anzeigename für Zertifikate „unter Aufsicht“ */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc;
const QN = { scl:'SCL', kop:'KOP', fup:'FUP', awl:'AWL' }, LEVEL = { grund:'Grundstufe', profi:'Profi-Stufe' };
const STATE = { running:'<span class="pill warn">läuft</span>', submitted:'<span class="pill">abgegeben</span>', expired:'<span class="pill">Zeit abgelaufen</span>', voided:'<span class="pill bad">annulliert</span>' };
const localDT = t => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

/* ---------- Leitstand: Karte Prüfungen ---------- */
async function examPanel(){
  const host = $('view').querySelector('.console'); if(!host || $('examPanel')) return;
  const el = document.createElement('div'); el.className = 'panel'; el.id = 'examPanel';
  const qs = P.OPEN_QUESTS();
  el.innerHTML = '<h2>Prüfungen unter Aufsicht <span class="tag">Zertifikat mit Vermerk „unter Aufsicht“</span></h2>'
    + '<form class="row xp-form" id="xpNew"><select class="inp" id="xpQuest">' + qs.map(q => '<option value="' + q + '">' + QN[q] + ' Quest</option>').join('') + '</select>'
    + '<select class="inp" id="xpLevel"><option value="grund">Grundstufe (60 min)</option><option value="profi">Profi-Stufe (90 min)</option></select>'
    + '<select class="inp" id="xpClass"><option value="">alle meine Lernenden</option></select>'
    + '<label class="small muted">ab <input class="inp" type="datetime-local" id="xpOpen"></label><label class="small muted">Fenster <input class="inp" type="number" id="xpMin" min="15" max="480" value="120" style="width:80px"> min</label>'
    + '<button class="btn pri">Prüfung anlegen</button></form>'
    + '<p class="muted small" style="margin:6px 0 0">Lernende treten im Portal unter <b>Zertifikate</b> mit dem 6-stelligen Code bei. Die Voraussetzungen aus dem Spiel entfallen, die Wartefristen bleiben. Tab-Wechsel werden gezählt, nicht bestraft.</p>'
    + '<div id="xpList" class="small" style="margin-top:12px"></div>';
  host.insertBefore(el, host.querySelectorAll('.panel')[1] || null);
  $('xpOpen').value = localDT(Date.now());
  try{ const r = await P.api('GET', 'classes'); $('xpClass').innerHTML += r.classes.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join(''); }catch(e){}
  $('xpNew').onsubmit = async e => {
    e.preventDefault();
    const opens = new Date($('xpOpen').value).getTime() || Date.now();
    try{ const r = await P.api('POST', 'exam-sessions', { quest: $('xpQuest').value, level: $('xpLevel').value, classId: +$('xpClass').value || null, opensAt: opens, minutes: +$('xpMin').value });
      location.hash = '#/pruefung/' + r.id; }
    catch(err){ P.toast(err.message, true); }
  };
  try{
    const r = await P.api('GET', 'exam-sessions');
    $('xpList').innerHTML = r.sessions.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Prüfung</th><th>Klasse</th><th>Fenster</th><th class="num">bestanden</th><th></th></tr></thead><tbody>'
      + r.sessions.slice(0, 8).map(s => '<tr><td class="num" style="text-align:left">' + esc(s.code) + '</td><td>' + QN[s.quest] + ' ' + LEVEL[s.level] + '</td><td>' + esc(s.className || 'alle') + '</td><td class="muted">' + P.fmtDate(s.opensAt) + ' – ' + P.fmtDate(s.closesAt).slice(-5) + (s.closesAt < Date.now() ? ' <span class="pill">geschlossen</span>' : '') + '</td><td class="num">' + s.passed + '/' + s.participants + '</td><td><a class="btn sm" href="#/pruefung/' + s.id + '">Übersicht</a></td></tr>').join('')
      + '</tbody></table></div>' : '';
  }catch(e){}
}

/* ---------- Beamer-taugliche Übersicht einer Prüfungssitzung ---------- */
let pollT = 0;
async function sessionView(m){
  clearInterval(pollT);
  const id = +m[1], v = $('view');
  if(!P.user || !P.canTeach(P.user)){ location.hash = P.user ? '#/' : '#/login'; return; }
  v.innerHTML = '<div class="console xp-sess"><div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/leitstand">LEITSTAND</a> / PRÜFUNG</div><div id="xpBody" class="panel muted">Lade …</div></div>';
  const draw = async () => {
    if(!$('xpBody')){ clearInterval(pollT); return; }
    let r; try{ r = await P.api('GET', 'exam-sessions/' + id); }catch(err){ $('xpBody').textContent = err.message; clearInterval(pollT); return; }
    const s = r.session, open = s.now < s.closesAt, ex = r.exams;
    $('xpBody').className = 'panel';
    $('xpBody').innerHTML = '<div class="row"><div class="grow"><div class="muted small">PRÜFUNG UNTER AUFSICHT · ' + QN[s.quest] + ' ' + LEVEL[s.level].toUpperCase() + (s.className ? ' · ' + esc(s.className) : '') + '</div>'
      + '<div class="xp-code">' + esc(s.code) + '</div><div class="muted small">Portal → Zertifikate → Code eingeben · Fenster ' + P.fmtDate(s.opensAt) + ' – ' + P.fmtDate(s.closesAt) + '</div></div>'
      + '<div class="kpis" style="margin:0"><div class="kpi"><div class="v">' + ex.length + '</div><div class="l">Teilnehmende</div></div><div class="kpi"><div class="v">' + ex.filter(e => e.state === 'running').length + '</div><div class="l">schreiben</div></div><div class="kpi"><div class="v">' + ex.filter(e => e.passed).length + '</div><div class="l">bestanden</div></div></div></div>'
      + (open ? '<div class="row" style="margin-top:10px"><span class="grow"></span><button class="btn sm dan" id="xpClose">Fenster jetzt schliessen</button></div>' : '<p class="muted small">Das Prüfungsfenster ist geschlossen.</p>')
      + '<div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Pseudonym</th><th>Stand</th><th>Aufgaben</th><th>Theorie</th><th class="num">Fokus&shy;verluste</th><th class="num">Ergebnis</th><th></th></tr></thead><tbody>'
      + (ex.length ? ex.map(e => '<tr><td><b>' + esc(e.username) + '</b></td><td>' + (STATE[e.state] || esc(e.state)) + (e.voidReason ? ' <span class="small muted">' + esc(e.voidReason) + '</span>' : '') + '</td>'
        + '<td><div class="pbar" title="' + e.tasksDone + ' von ' + e.tasks + ' bestanden"><i style="width:' + Math.round(100 * e.tasksDone / (e.tasks || 1)) + '%"></i></div><span class="small muted">' + e.tasksDone + '/' + e.tasks + ' bestanden · ' + e.tasksTried + ' abgegeben</span></td>'
        + '<td class="small">' + e.questionsAnswered + '/' + e.questions + '</td><td class="num' + (e.focusLost >= 3 ? ' xp-warn' : '') + '">' + e.focusLost + '</td>'
        + '<td class="num">' + (e.score != null && e.state !== 'running' ? Math.round(e.score * 100) + ' %' + (e.passed ? ' ✓' : '') : '–') + '</td>'
        + '<td>' + (e.state !== 'voided' ? '<button class="btn sm dan" data-void="' + e.id + '" data-n="' + esc(e.username) + '">Annullieren</button>' : '') + '</td></tr>').join('')
        : '<tr><td colspan="7" class="empty">Noch niemand beigetreten.</td></tr>') + '</tbody></table></div>';
    if($('xpClose')) $('xpClose').onclick = async () => { if(!await P.confirmDlg('Prüfungsfenster schliessen?', 'Danach kann niemand mehr beitreten. Laufende Prüfungen enden spätestens mit ihrer eigenen Zeit.', 'Schliessen')) return; try{ await P.api('DELETE', 'exam-sessions/' + id); draw(); }catch(err){ P.toast(err.message, true); } };
    $('xpBody').querySelectorAll('[data-void]').forEach(b => b.onclick = async () => {
      const ok = await P.dialog('Prüfung annullieren', '<p>Die Prüfung von <b>' + esc(b.dataset.n) + '</b> wird ungültig; ein ausgestelltes Zertifikat wird widerrufen.</p><label for="xpReason">Begründung (Pflicht, sieht die/der Lernende)</label><input class="inp" id="xpReason" maxlength="300">',
        [{ label:'Abbrechen', value:false }, { label:'Annullieren', value:true, cls:'dan', check: () => !!$('xpReason').value.trim() }]);
      if(!ok) return;
      try{ await P.api('POST', 'exams/' + b.dataset.void + '/void', { reason: $('xpReason').value.trim() }); draw(); }catch(err){ P.toast(err.message, true); }
    });
  };
  await draw();
  pollT = setInterval(draw, 4000);
}
addEventListener('hashchange', () => { if(!/^#\/pruefung\//.test(location.hash)) clearInterval(pollT); });

/* ---------- Klassenansicht: Zertifikate und Prüfungen ---------- */
async function classPanel(classId){
  const host = $('view').querySelector('.console'); if(!host || $('xcPanel')) return;
  const el = document.createElement('div'); el.className = 'panel'; el.id = 'xcPanel';
  el.innerHTML = '<h2>Zertifikate und Prüfungen</h2><div class="muted small">Lade …</div>';
  host.appendChild(el);
  let r; try{ r = await P.api('GET', 'classes/' + classId + '/certificates'); }catch(err){ el.querySelector('div').textContent = err.message; return; }
  // Spalte „Zertifikate“ in der Klassenliste: Abzeichen neben dem Pseudonym
  const by = {}; r.certificates.filter(c => c.status === 'valid').forEach(c => { (by[c.userId] = by[c.userId] || []).push(c); });
  document.querySelectorAll('.tbl a[href^="#/leitstand/schueler/"]').forEach(a => {
    const uid = +a.getAttribute('href').split('/').pop(); if(!by[uid] || a.parentNode.querySelector('.xc-badges')) return;
    const s = document.createElement('span'); s.className = 'xc-badges';
    s.innerHTML = by[uid].map(c => ' <span class="pill ok" title="' + QN[c.quest] + ' ' + LEVEL[c.level] + ' · ' + c.code + '">🎓 ' + QN[c.quest] + (c.level === 'profi' ? ' P' : ' G') + '</span>').join('');
    a.parentNode.appendChild(s);
  });
  const names = {}; document.querySelectorAll('.tbl a[href^="#/leitstand/schueler/"]').forEach(a => { names[+a.getAttribute('href').split('/').pop()] = a.textContent; });
  el.querySelector('div').outerHTML = (r.certificates.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pseudonym</th><th>Zertifikat</th><th class="num">Ergebnis</th><th>Art</th><th>Datum</th><th>Status</th></tr></thead><tbody>'
    + r.certificates.map(c => '<tr><td>' + esc(c.username) + '</td><td>' + QN[c.quest] + ' ' + LEVEL[c.level] + (c.distinction ? ' <span class="pill ok">Auszeichnung</span>' : '') + '</td><td class="num">' + c.score + ' %</td><td class="small">' + (c.proctored ? 'unter Aufsicht' : 'online') + '</td><td class="small muted">' + P.fmtDate(c.issuedAt) + '</td><td>' + (c.status === 'valid' ? '<span class="pill ok">gültig</span>' : '<span class="pill">' + (c.status === 'withdrawn' ? 'zurückgezogen' : 'widerrufen') + '</span>') + '</td></tr>').join('')
    + '</tbody></table></div>' : '<p class="muted small">Noch keine Zertifikate in dieser Klasse.</p>')
    + (r.exams.length ? '<details class="small" style="margin-top:10px"><summary>Alle Prüfungsversuche (' + r.exams.length + ')</summary><div class="tbl-wrap"><table class="tbl"><tbody>'
      + r.exams.map(e => '<tr><td>' + esc(names[e.userId] || '#' + e.userId) + '</td><td>' + QN[e.quest] + ' ' + LEVEL[e.level] + (e.proctored ? ' · Aufsicht' : '') + '</td><td>' + (STATE[e.state] || e.state) + '</td><td class="num">' + (e.score != null && e.state !== 'running' ? Math.round(e.score * 100) + ' %' : '–') + '</td><td class="num">' + e.focusLost + ' Fokus</td><td class="muted">' + P.fmtDate(e.startedAt) + '</td>'
        + '<td>' + (e.state !== 'voided' ? '<button class="btn sm dan" data-xv="' + e.id + '">Annullieren</button>' : esc(e.voidReason || '')) + '</td></tr>').join('') + '</tbody></table></div></details>' : '');
  el.querySelectorAll('[data-xv]').forEach(b => b.onclick = async () => {
    const ok = await P.dialog('Prüfung annullieren', '<label for="xvReason">Begründung (Pflicht)</label><input class="inp" id="xvReason" maxlength="300">', [{ label:'Abbrechen', value:false }, { label:'Annullieren', value:true, cls:'dan', check: () => !!$('xvReason').value.trim() }]);
    if(!ok) return;
    try{ await P.api('POST', 'exams/' + b.dataset.xv + '/void', { reason: $('xvReason').value.trim() }); el.remove(); classPanel(classId); }catch(err){ P.toast(err.message, true); }
  });
}

/* ---------- Administration: Zertifikate widerrufen ---------- */
async function adminPanel(){
  const host = $('view').querySelector('.console'); if(!host || $('xaPanel')) return;
  const el = document.createElement('div'); el.className = 'panel'; el.id = 'xaPanel';
  el.innerHTML = '<h2>Zertifikate <span class="tag">Prüfseite /z/Code</span></h2><div class="muted small">Lade …</div>';
  host.appendChild(el);
  let r; try{ r = await P.api('GET', 'admin/certificates'); }catch(err){ el.querySelector('div').textContent = err.message; return; }
  el.querySelector('div').outerHTML = '<div class="kpis"><div class="kpi"><div class="v">' + r.stats.exams + '</div><div class="l">Prüfungen</div></div><div class="kpi"><div class="v">' + r.stats.passed + '</div><div class="l">bestanden</div></div><div class="kpi"><div class="v">' + r.certificates.filter(c => c.status === 'valid').length + '</div><div class="l">gültige Zertifikate</div></div><div class="kpi"><div class="v">' + r.stats.running + '</div><div class="l">laufen</div></div></div>'
    + (r.certificates.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Prüfcode</th><th>Konto</th><th>Zertifikat</th><th class="num">Ergebnis</th><th>Datum</th><th>Status</th><th></th></tr></thead><tbody>'
    + r.certificates.map(c => '<tr><td><a href="/z/' + esc(c.code) + '" target="_blank" rel="noopener">' + esc(c.code) + '</a></td><td>' + esc(c.username || '(gelöscht)') + '</td><td>' + QN[c.quest] + ' ' + LEVEL[c.level] + '</td><td class="num">' + c.score + ' %</td><td class="small muted">' + P.fmtDate(c.issuedAt) + '</td><td>'
      + (c.status === 'valid' ? '<span class="pill ok">gültig</span>' : '<span class="pill">' + (c.status === 'withdrawn' ? 'zurückgezogen' : 'widerrufen') + '</span>' + (c.revokeReason ? ' <span class="small muted">' + esc(c.revokeReason) + '</span>' : '')) + '</td>'
      + '<td>' + (c.status === 'valid' ? '<button class="btn sm dan" data-rv="' + esc(c.code) + '">Widerrufen</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted small">Noch keine Zertifikate.</p>');
  el.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => {
    const ok = await P.dialog('Zertifikat widerrufen', '<p>Die Prüfseite von <b>' + esc(b.dataset.rv) + '</b> zeigt danach „widerrufen“.</p><label for="rvReason">Begründung (Pflicht)</label><input class="inp" id="rvReason" maxlength="300">', [{ label:'Abbrechen', value:false }, { label:'Widerrufen', value:true, cls:'dan', check: () => !!$('rvReason').value.trim() }]);
    if(!ok) return;
    try{ await P.api('POST', 'certificates/' + b.dataset.rv + '/revoke', { reason: $('rvReason').value.trim() }); el.remove(); adminPanel(); }catch(err){ P.toast(err.message, true); }
  });
}

/* ---------- Konto: Anzeigename (Dozent/Admin) ---------- */
function accountPanel(){
  const host = $('view').querySelector('.console'); if(!host || $('dnPanel') || !P.canTeach(P.user)) return;
  const el = document.createElement('div'); el.className = 'panel'; el.id = 'dnPanel';
  el.innerHTML = '<h2>Anzeigename für Zertifikate</h2><p class="muted small">Erscheint auf Zertifikaten von Prüfungen unter Aufsicht, z. B. „S. Muster, Berufsfachschule“.</p><form class="row" id="dnForm"><input class="inp grow" id="dnName" maxlength="80" value="' + esc(P.user.displayName || '') + '" placeholder="Name, Schule"><button class="btn pri">Speichern</button></form>';
  host.appendChild(el);
  $('dnForm').onsubmit = async e => { e.preventDefault(); try{ const r = await P.api('POST', 'me/display-name', { displayName: $('dnName').value }); P.user.displayName = r.displayName; P.toast('Anzeigename gespeichert.'); }catch(err){ P.toast(err.message, true); } };
}

const mo = new MutationObserver(() => {
  const h = location.hash;
  if(h === '#/leitstand' && P.canTeach(P.user) && $('clsList') && !$('examPanel')) examPanel();
  const m = h.match(/^#\/leitstand\/klasse\/(\d+)$/); if(m && $('clsCode') && !$('xcPanel')) setTimeout(() => classPanel(+m[1]), 50);
  if(h === '#/admin' && P.user && P.user.role === 'admin' && $('tList') && !$('xaPanel')) adminPanel();
  if(h === '#/konto' && P.user && $('view').querySelector('.console') && !$('dnPanel')) accountPanel();
});
mo.observe($('view'), { childList:true });
P.routes.push({ re: /^#\/pruefung\/(\d+)$/, view: sessionView });
})();
