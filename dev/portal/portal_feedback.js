/* ===== SPS Quest Portal: Feedback-Formular (Praxistest) und Auswertung im Leitstand ===== */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc;
const SCALE = [
  ['verstaendlich', 'Die Aufgaben und Erklärungen waren verständlich.'],
  ['anlage', 'Die Live-Anlage (2D/3D) hat mir geholfen, mein Programm zu verstehen.'],
  ['hinweise', 'Hinweise und Fehlermeldungen haben mir weitergeholfen.'],
  ['gelernt', 'Ich habe etwas über SCL gelernt.'],
  ['spass', 'Das Spiel hat Spass gemacht.'],
  ['challenge', 'Die Live-Challenge im Unterricht hat mich motiviert. (leer lassen, wenn du nicht dabei warst)'],
  ['empfehlen', 'Ich würde SCL Quest anderen Lernenden empfehlen.']
];
const CHOICE = [
  ['sofort', 'Wusstest du sofort, was zu tun ist?', ['ja', 'eher', 'nein']],
  ['niveau', 'Der Schwierigkeitsgrad war …', ['zu leicht', 'passend', 'zu schwer']],
  ['geraet', 'Ich habe hauptsächlich gespielt auf …', ['PC/Laptop', 'Tablet', 'Handy']],
  ['kapitel', 'Ich bin gekommen bis Kapitel …', ['1–2', '3–5', '6–10', '11–15']]
];
const TEXT = [
  ['gut', 'Was war gut?'],
  ['stoerend', 'Was war unklar, schwierig oder hat gestört?'],
  ['fehler', 'Hast du einen Fehler gefunden? Wo (Kapitel/Aufgabe) und was ist passiert?']
];
const LABELS = ['trifft nicht zu', '', '', '', 'trifft voll zu'];

function viewForm(){
  const v = $('view');
  if(!P.user){ v.innerHTML = '<div class="console"><div class="panel empty">Bitte zuerst anmelden, damit dein Feedback deiner Klasse zugeordnet wird.<br><br><button class="btn pri" id="fbLogin">Anmelden</button></div></div>'; $('fbLogin').onclick = () => P.openTerminal('login'); return; }
  v.innerHTML = '<div class="console fb"><div class="crumbs"><a href="#/">HALLEN</a> / FEEDBACK</div><h1>Dein Feedback zu SCL Quest</h1>' +
    '<p class="lead">Dauert etwa 3 Minuten. Deine Lehrperson sieht nur die Auswertung der ganzen Klasse – <b>ohne</b> deinen Namen.</p><form id="fbForm">' +
    '<div class="panel"><h2>Wie sehr stimmst du zu?</h2>' + SCALE.map(([k, q]) => '<fieldset class="fb-q"><legend>' + esc(q) + '</legend><div class="fb-scale">' +
      [1, 2, 3, 4, 5].map(n => '<label title="' + (LABELS[n - 1] || n) + '"><input type="radio" name="' + k + '" value="' + n + '"><span>' + n + '</span></label>').join('') + '<span class="fb-ends"><i>trifft nicht zu</i><i>trifft voll zu</i></span></div></fieldset>').join('') + '</div>' +
    '<div class="panel">' + CHOICE.map(([k, q, opts]) => '<fieldset class="fb-q"><legend>' + esc(q) + '</legend><div class="fb-choice">' + opts.map(o => '<label><input type="radio" name="' + k + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>').join('') + '</div></fieldset>').join('') + '</div>' +
    '<div class="panel">' + TEXT.map(([k, q]) => '<label class="fb-t" for="fb_' + k + '">' + esc(q) + '</label><textarea class="inp" id="fb_' + k + '" name="' + k + '" maxlength="1000" rows="3"></textarea>').join('') +
    '<p class="muted small">Bitte keine Namen oder persönlichen Daten in die Textfelder schreiben.</p><div class="row"><span class="grow"></span><button class="btn pri">Feedback senden</button></div></div></form></div>';
  $('fbForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), answers = {};
    for(const [k, val] of f.entries()) if(String(val).trim()) answers[k] = SCALE.some(s => s[0] === k) ? +val : String(val).trim();
    try{
      await P.api('POST', 'feedback', { answers });
      v.innerHTML = '<div class="console"><div class="panel empty fb-thanks"><div class="aria-eye" style="margin:0 auto 14px"></div><h2>Danke!</h2><p>ARIA hat dein Feedback … widerwillig … an den Werkmeister weitergeleitet.</p><a class="btn pri" href="#/">Zurück zu den Hallen</a></div></div>';
    }catch(err){ P.toast(err.message, true); }
  };
}

// Auswertung in der Klassenansicht des Leitstands
async function feedbackPanel(classId){
  const host = $('view').querySelector('.console'); if(!host || $('fbPanel')) return;
  const el = document.createElement('div'); el.className = 'panel'; el.id = 'fbPanel';
  el.innerHTML = '<h2>Feedback der Klasse <span class="tag">anonym · Formular: ' + esc(location.origin) + '/#/feedback</span></h2><div class="muted small">Lade …</div>';
  host.appendChild(el);
  let r;
  try{ r = await P.api('GET', 'feedback?classId=' + classId); }catch(err){ el.querySelector('div').textContent = err.message; return; }
  if(!r.n){ el.querySelector('div').innerHTML = 'Noch kein Feedback. Lernende öffnen nach der Stunde <b>#/feedback</b> im Portal (Menü unter ihrem Namen).'; return; }
  const bar = v => v == null ? '<span class="muted">–</span>' : '<span class="fb-avg"><i style="width:' + Math.round((v - 1) / 4 * 100) + '%"></i></span> <b>' + v.toFixed(1) + '</b>';
  el.querySelector('div').outerHTML = '<p class="muted small">' + r.n + ' Rückmeldung' + (r.n === 1 ? '' : 'en') + ' · Skala 1 (trifft nicht zu) bis 5 (trifft voll zu)</p>' +
    '<table class="tbl"><tbody>' + SCALE.map(([k, q]) => '<tr><td>' + esc(q.replace(/ \(leer.*\)$/, '')) + '</td><td style="white-space:nowrap">' + bar(r.avg[k]) + ' <span class="muted small">(' + r.counts[k] + ')</span></td></tr>').join('') + '</tbody></table>' +
    '<div class="fb-choices">' + CHOICE.map(([k, q, opts]) => '<div><div class="muted small">' + esc(q) + '</div>' + opts.map(o => '<span class="pill">' + esc(o) + ': ' + (r.choices[k][o] || 0) + '</span> ').join('') + '</div>').join('') + '</div>' +
    TEXT.map(([k, q]) => r.texts[k].length ? '<h3 class="fb-h">' + esc(q) + '</h3><ul class="fb-texts">' + r.texts[k].map(t => '<li>' + esc(t.text) + ' <span class="muted small">' + P.fmtDate(t.at) + '</span></li>').join('') + '</ul>' : '').join('');
}
const mo = new MutationObserver(() => {
  const m = location.hash.match(/^#\/leitstand\/klasse\/(\d+)$/);
  if(m && $('clsCode') && !$('fbPanel')) feedbackPanel(+m[1]);
});
mo.observe($('view'), { childList:true });
P.routes.push({ re: /^#\/feedback$/, view: viewForm });
})();
