/* ===== SPS Quest: Feedback / Fehler melden – Knopf unten links in Portal und allen Quests =====
   Kontext liefert window.SPSQ_REPORT_CONTEXT() → { quest, context } (Quest-Seiten: app.js, Portal: Hash).
   Benutzername und Browser ermittelt der Server selbst (Sitzung, User-Agent). */
(function(){
'use strict';
if(!/^https?:$/.test(location.protocol) || document.getElementById('spsqRpBtn')) return;
const css = `
.spsq-rp-btn{position:fixed;left:14px;bottom:14px;z-index:9000;width:42px;height:42px;border-radius:50%;border:1px solid rgba(120,200,255,.45);background:rgba(10,16,24,.88);color:#9fd8ff;font-size:19px;line-height:1;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:.72;transition:opacity .15s,transform .15s}
.spsq-rp-btn:hover,.spsq-rp-btn:focus-visible{opacity:1;transform:scale(1.06)}
.spsq-rp-btn:focus-visible{outline:2px solid #58c4ff;outline-offset:2px}
.spsq-rp{position:fixed;left:14px;bottom:66px;z-index:9001;width:min(360px,calc(100vw - 28px));background:#0d141d;color:#dbe7f3;border:1px solid rgba(120,200,255,.35);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.6);padding:14px 14px 12px;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left}
.spsq-rp[hidden],.spsq-rp-btn[hidden]{display:none}
.spsq-rp h2{margin:0 0 8px;font-size:15px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px}
.spsq-rp h2 button{margin-left:auto;background:none;border:0;color:#9ab;font-size:18px;cursor:pointer;padding:0 4px}
.spsq-rp .rp-types{display:flex;gap:6px;margin-bottom:8px}
.spsq-rp .rp-types label{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #2a3a4c;border-radius:8px;padding:7px 6px;cursor:pointer;background:#111b26}
.spsq-rp .rp-types input{accent-color:#58c4ff;margin:0}
.spsq-rp .rp-types label:has(input:checked){border-color:#58c4ff;background:#12263a;color:#fff}
.spsq-rp textarea{width:100%;box-sizing:border-box;min-height:96px;resize:vertical;background:#070b10;color:#e8f0f8;border:1px solid #2a3a4c;border-radius:8px;padding:8px;font:inherit}
.spsq-rp textarea:focus{outline:2px solid #58c4ff;outline-offset:0;border-color:transparent}
.spsq-rp .rp-ctx{font-size:12px;color:#8aa0b4;margin:6px 0 8px;word-break:break-word}
.spsq-rp .rp-row{display:flex;align-items:center;gap:8px}
.spsq-rp .rp-msg{flex:1;font-size:12.5px;color:#ff8f8f}
.spsq-rp .rp-msg.ok{color:#7fe3a0}
.spsq-rp .rp-send{background:#1f8ad6;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer}
.spsq-rp .rp-send:disabled{opacity:.6;cursor:default}
.spsq-rp .rp-done{text-align:center;padding:18px 4px;color:#7fe3a0;font-weight:600}
body.light .spsq-rp-btn{background:rgba(255,255,255,.95);color:#1769aa;border-color:#8cbde6}
@media (max-width:640px){body.has-live-bar .spsq-rp-btn{bottom:60px}body.has-live-bar .spsq-rp{bottom:112px}}
@media print{.spsq-rp,.spsq-rp-btn{display:none!important}}`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

const btn = document.createElement('button');
btn.id = 'spsqRpBtn'; btn.type = 'button'; btn.className = 'spsq-rp-btn';
btn.title = 'Feedback oder Fehler melden'; btn.setAttribute('aria-label', 'Feedback oder Fehler melden'); btn.setAttribute('aria-expanded', 'false');
btn.innerHTML = '<span aria-hidden="true">💬</span>';
const box = document.createElement('div');
box.className = 'spsq-rp'; box.id = 'spsqRp'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', 'spsqRpT');
box.innerHTML = '<h2 id="spsqRpT"><span aria-hidden="true">💬</span> Feedback oder Fehler melden<button type="button" data-rp-close aria-label="Schliessen">×</button></h2>' +
  '<form id="spsqRpForm" novalidate><div class="rp-types" role="radiogroup" aria-label="Art der Meldung">' +
  '<label><input type="radio" name="rpType" value="feedback" checked> Feedback</label><label><input type="radio" name="rpType" value="fehler"> Fehler</label></div>' +
  '<textarea id="spsqRpText" maxlength="2000" placeholder="Was ist dir aufgefallen? Bei Fehlern: Was hast du gemacht, was ist passiert?" aria-label="Deine Nachricht" required></textarea>' +
  '<div class="rp-ctx" id="spsqRpCtx"></div><div class="rp-row"><span class="rp-msg" id="spsqRpMsg" role="status"></span><button class="rp-send" type="submit">Senden</button></div></form>' +
  '<div class="rp-done" id="spsqRpDone" hidden>✓ Danke! Deine Meldung ist angekommen.</div>';
const mount = () => { document.body.appendChild(btn); document.body.appendChild(box); };
if(document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const QN = { scl:'SCL Quest', kop:'KOP Quest', fup:'FUP Quest', awl:'AWL Quest' };
function ctx(){
  let c = null;
  try{ if(typeof window.SPSQ_REPORT_CONTEXT === 'function') c = window.SPSQ_REPORT_CONTEXT(); }catch(e){}
  c = c || {};
  return { quest: c.quest || null, context: String(c.context || location.hash || location.pathname).slice(0, 200) };
}
let who = null, closeT = 0;
async function open(){
  clearTimeout(closeT);
  box.hidden = false; btn.setAttribute('aria-expanded', 'true');
  $('spsqRpForm').hidden = false; $('spsqRpDone').hidden = true; $('spsqRpMsg').textContent = ''; $('spsqRpMsg').className = 'rp-msg';
  const c = ctx();
  const show = () => { $('spsqRpCtx').innerHTML = 'Wird mitgeschickt: ' + (c.quest ? esc(QN[c.quest] || c.quest) + ' · ' : 'Portal · ') + esc(c.context) + ' · ' + (who ? 'Konto <b>' + esc(who) + '</b>' : 'ohne Anmeldung') + ' · Browser'; };
  show();
  setTimeout(() => $('spsqRpText').focus(), 20);
  try{ const r = await fetch('/api/me', { credentials:'same-origin' }); const d = await r.json(); who = d && d.user ? d.user.username : null; }catch(e){ who = null; }
  show();
}
function close(){ box.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
btn.addEventListener('click', () => box.hidden ? open() : close());
box.addEventListener('click', e => { if(e.target.closest('[data-rp-close]')) { close(); btn.focus(); } });
box.addEventListener('keydown', e => { if(e.key === 'Escape'){ e.stopPropagation(); close(); btn.focus(); } });
// Tastatur des Spiels (z. B. Strg+Enter) nicht auslösen, während man hier schreibt
['keydown', 'keyup', 'keypress'].forEach(t => box.addEventListener(t, e => { if(e.key !== 'Escape') e.stopPropagation(); }));
box.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('spsqRpMsg'), text = $('spsqRpText').value.trim();
  if(!text){ msg.className = 'rp-msg'; msg.textContent = 'Bitte einen Text eingeben.'; $('spsqRpText').focus(); return; }
  const type = (box.querySelector('input[name=rpType]:checked') || {}).value || 'feedback';
  const send = box.querySelector('.rp-send'); send.disabled = true; msg.className = 'rp-msg ok'; msg.textContent = 'Sende …';
  const c = ctx();
  try{
    const r = await fetch('/api/reports', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json', 'x-spsquest':'1' },
      body: JSON.stringify({ type, message: text, quest: c.quest, context: c.context }) });
    const d = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(d.error || ('Fehler ' + r.status));
    $('spsqRpText').value = ''; box.querySelector('input[value=feedback]').checked = true;
    $('spsqRpForm').hidden = true; $('spsqRpDone').hidden = false; msg.textContent = '';
    closeT = setTimeout(close, 1800);
  }catch(err){
    msg.className = 'rp-msg';
    msg.textContent = /fetch|network/i.test(err.message) ? 'Keine Verbindung. Bitte später nochmals senden.' : err.message;
  }
  send.disabled = false;
});
// Beamer-Ansicht (Vollbild im Unterricht): Knopf ausblenden
const vis = () => { btn.hidden = /^#\/beamer\//.test(location.hash); if(btn.hidden) close(); };
addEventListener('hashchange', vis); vis();
window.SPSQ_REPORT = { open, close };
})();
