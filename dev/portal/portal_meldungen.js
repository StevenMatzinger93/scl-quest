/* ===== SPS Quest Portal: Feedback und Fehlermeldungen (Knopf 💬) auswerten – #/meldungen =====
   Admin sieht alle Meldungen und kann sie abhaken/löschen, Dozenten die ihrer Lernenden und die eigenen. */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc;
const QN = { scl:'SCL', kop:'KOP', fup:'FUP', awl:'AWL', sensor:'Sensorwerkstatt' };
let F = { type:'', quest:'' };
function browser(ua){
  if(!ua) return '–';
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
  return b + (os ? ' · ' + os : '');
}
async function view(){
  const v = $('view');
  if(!P.user){ location.hash = '#/login'; return; }
  if(!P.canTeach(P.user)){ location.hash = '#/'; return; }
  const admin = P.user.role === 'admin';
  v.innerHTML = '<div class="console rp-list"><div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/leitstand">LEITSTAND</a> / MELDUNGEN</div><h1>Feedback und Fehlermeldungen</h1>' +
    '<p class="lead">Alles, was über den Knopf <b>💬</b> unten links in Portal und Quests gemeldet wurde – neueste zuerst. ' + (admin ? 'Als Admin siehst du alle Meldungen.' : 'Du siehst die Meldungen deiner Lernenden und deine eigenen.') + '</p>' +
    '<div class="kpis" id="rpKpis"></div>' +
    '<div class="panel"><div class="row rp-filter"><div class="qswitch" role="group" aria-label="Nach Typ filtern">' +
      [['', 'Alle'], ['fehler', 'Fehler'], ['feedback', 'Feedback']].map(([k, l]) => '<button class="btn sm' + (F.type === k ? ' pri' : '') + '" data-ft="' + k + '" aria-pressed="' + (F.type === k) + '">' + l + '</button>').join('') + '</div>' +
      '<span class="grow"></span><label class="small muted" for="rpQuest">Ort</label><select class="inp" id="rpQuest" style="width:auto">' +
      [['', 'überall'], ['portal', 'Portal'], ['scl', 'SCL Quest'], ['kop', 'KOP Quest'], ['fup', 'FUP Quest'], ['awl', 'AWL Quest'], ['sensor', 'Sensorwerkstatt']].map(([k, l]) => '<option value="' + k + '"' + (F.quest === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
    '<div id="rpItems"><div class="muted">Lade …</div></div></div></div>';
  v.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => { F.type = b.dataset.ft; view(); });
  $('rpQuest').onchange = e => { F.quest = e.target.value; view(); };
  let r;
  try{ r = await P.api('GET', 'reports?type=' + F.type + '&quest=' + F.quest); }
  catch(err){ $('rpItems').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; return; }
  $('rpKpis').innerHTML = [['Fehler', r.counts.fehler], ['Feedback', r.counts.feedback], ['offen', r.counts.open]].map(([l, n]) => '<div class="kpi"><div class="v">' + n + '</div><div class="l">' + l + '</div></div>').join('');
  $('rpItems').innerHTML = r.reports.length ? r.reports.map(x =>
    '<article class="rp-item' + (x.done ? ' done' : '') + '" data-id="' + x.id + '"><div class="rp-head">' +
      '<span class="pill ' + (x.type === 'fehler' ? 'warn' : 'ok') + '">' + (x.type === 'fehler' ? 'Fehler' : 'Feedback') + '</span>' +
      '<span class="small muted">' + P.fmtDate(x.at) + '</span>' +
      '<span class="small"><b>' + (x.quest ? QN[x.quest] + ' Quest' : 'Portal') + '</b>' + (x.context ? ' · ' + esc(x.context) : '') + '</span>' +
      '<span class="grow"></span><span class="small">' + (x.username ? '👤 ' + esc(x.username) + (x.className ? ' <span class="muted">(' + esc(x.className) + ')</span>' : '') : '<span class="muted">ohne Anmeldung</span>') + '</span></div>' +
      '<div class="rp-text">' + esc(x.message) + '</div>' +
      '<div class="rp-foot small muted"><span title="' + esc(x.userAgent || '') + '">' + esc(browser(x.userAgent)) + '</span><span class="grow"></span>' +
      (admin ? '<label class="row small"><input type="checkbox" data-done' + (x.done ? ' checked' : '') + '> erledigt</label><button class="btn sm dan" data-del>✕</button>' : (x.done ? '<span class="pill">erledigt</span>' : '')) + '</div></article>').join('')
    : '<div class="empty">Keine Meldungen' + (F.type || F.quest ? ' für diesen Filter' : '') + '.</div>';
  v.querySelectorAll('.rp-item').forEach(el => {
    const id = el.dataset.id, d = el.querySelector('[data-done]'), del = el.querySelector('[data-del]');
    if(d) d.onchange = async () => { try{ await P.api('PATCH', 'reports/' + id, { done: d.checked }); el.classList.toggle('done', d.checked); }catch(err){ P.toast(err.message, true); d.checked = !d.checked; } };
    if(del) del.onclick = async () => { if(!await P.confirmDlg('Meldung löschen?', 'Die Meldung wird endgültig gelöscht.', 'Löschen', true)) return; try{ await P.api('DELETE', 'reports/' + id); view(); }catch(err){ P.toast(err.message, true); } };
  });
}
P.routes.push({ re: /^#\/meldungen$/, view });
})();
