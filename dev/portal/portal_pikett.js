/* ===== SPS Quest Portal: Pikett-Tafel im Leitstand (docs/PLAN_ZERTIFIKAT_PIKETT.md B.6) =====
   Klassenansicht: Rang, Punkte, Nachtschichten je Lernende/r und die letzten Schichten mit Übergabetext, je Quest umschaltbar. */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc;
const QN = { scl:'SCL', kop:'KOP', fup:'FUP', awl:'AWL' }, SHIFT = { tag:'Tag', spaet:'Spät', nacht:'Nacht' };
const RANK_ICON = ['', '🔧', '🛠️', '⚙️', '⛑️'];
const fmtS = s => s == null ? '–' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

async function board(classId, quest){
  const host = $('view').querySelector('.console'); if(!host) return;
  let el = $('pkPanel');
  if(!el){ el = document.createElement('div'); el.className = 'panel'; el.id = 'pkPanel'; host.appendChild(el); }
  quest = quest || el.dataset.quest || 'scl'; el.dataset.quest = quest;
  el.innerHTML = '<h2>Pikett-Tafel <span class="tag">Pikettdienst</span></h2><div class="row small" role="group" aria-label="Quest">' + Object.keys(QN).map(q => '<button class="btn sm' + (q === quest ? ' pri' : '') + '" data-pq="' + q + '" aria-pressed="' + (q === quest) + '">' + QN[q] + '</button>').join('') + '</div><div class="muted small">Lade …</div>';
  el.querySelectorAll('[data-pq]').forEach(b => b.onclick = () => board(classId, b.dataset.pq));
  let r; try{ r = await P.api('GET', 'classes/' + classId + '/pikett?quest=' + quest); }catch(err){ el.querySelector('div.muted').textContent = err.message; return; }
  const act = r.students.filter(s => s.shifts);
  el.querySelector('div.muted').outerHTML = '<p class="muted small">Schichten, die im Portal gefahren werden: Plan und Behebungen prüft der Server nach. Pikettchef = 40 000 Punkte und 3 Nachtschichten mit ≥ 90 % Verfügbarkeit (erscheint auf dem Zertifikat).</p>'
    + (act.length ? '<div class="tbl-wrap"><table class="tbl" id="pkTbl"><thead><tr><th>Pseudonym</th><th>Rang</th><th class="num">Punkte</th><th class="num">Schichten</th><th class="num">Nächte (gut)</th><th class="num">beste Verfügb.</th><th class="num">Ø MTTR</th><th>letzte Schicht</th></tr></thead><tbody>'
      + act.map(s => '<tr><td>' + esc(s.username) + '</td><td>' + RANK_ICON[s.rank] + ' ' + esc(s.rankName) + (s.rank === 4 && s.reachedAt ? ' <span class="small muted">seit ' + P.fmtDate(s.reachedAt).slice(0, 10) + '</span>' : '') + '</td><td class="num">' + s.points + '</td><td class="num">' + s.shifts + '</td><td class="num">' + s.nights + ' (' + s.goodNights + ')</td><td class="num">' + (s.bestAvailability == null ? '–' : Math.round(s.bestAvailability * 100) + ' %') + '</td><td class="num">' + fmtS(s.mttr) + '</td><td class="muted small">' + (s.lastAt ? P.fmtDate(s.lastAt) : '–') + '</td></tr>').join('')
      + '</tbody></table></div>' : '<p class="muted small">Noch niemand aus dieser Klasse hat in der ' + QN[quest] + ' Quest Pikett gefahren.</p>')
    + (r.shifts.length ? '<details class="small" style="margin-top:10px"' + (r.shifts.some(s => s.handover) ? ' open' : '') + '><summary>Letzte Schichten und Übergaben (' + r.shifts.length + ')</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pseudonym</th><th>Schicht</th><th class="num">behoben</th><th class="num">Verfügb.</th><th class="num">MTTR</th><th class="num">Punkte</th><th>Übergabe</th><th>Datum</th></tr></thead><tbody>'
      + r.shifts.map(s => '<tr><td>' + esc(s.username) + '</td><td>' + SHIFT[s.shift] + (s.state === 'running' ? ' <span class="pill warn">läuft</span>' : s.early ? ' <span class="pill">vorzeitig</span>' : '') + '</td><td class="num">' + (s.state === 'done' ? s.fixed + '/' + s.incidents : '–') + '</td><td class="num">' + (s.availability == null ? '–' : Math.round(s.availability * 100) + ' %') + '</td><td class="num">' + fmtS(s.mttr) + '</td><td class="num">' + (s.points == null ? '–' : s.points) + '</td><td>' + esc(s.handover || '') + '</td><td class="muted">' + P.fmtDate(s.startedAt) + '</td></tr>').join('')
      + '</tbody></table></div></details>' : '');
}

const mo = new MutationObserver(() => {
  const m = location.hash.match(/^#\/leitstand\/klasse\/(\d+)$/);
  if(m && $('clsCode') && !$('pkPanel') && P.canTeach(P.user)) setTimeout(() => { if(!$('pkPanel')) board(+m[1]); }, 80);
});
mo.observe($('view'), { childList:true });
})();
