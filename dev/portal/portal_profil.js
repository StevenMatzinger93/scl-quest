/* ===== SPS Quest Portal: Profil – Avatar gestalten, Coins, Shop (Paket 3) ===== */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc, A = window.SPSQAvatar;
if(!A) return;
const SLOT_LABEL = { a: 'Tier', c: 'Farbe', hat: 'Kopfbedeckung', gl: 'Brille', ch: 'Kette', sh: 'Oberteil' };
const TABS = ['a', 'c', 'hat', 'gl', 'ch', 'sh'];
const KIND_LABEL = { task: 'Aufgaben', boss: 'Kapitel-Boss', final: 'Final Boss', theory: 'Theorie', speedrun: 'Speedrun' };
const BADGE_LABEL = { befreier: 'Abzeichen „Befreier“ (Final Boss Grundstufe)', architekt: 'Abzeichen „Architekt“ (Final Boss Profi-Stufe)' };

async function viewProfil(){
  const v = $('view');
  if(!P.user){ location.hash = '#/login'; return; }
  if(P.user.role === 'admin'){ v.innerHTML = '<div class="console"><div class="panel empty">Das Admin-Konto hat keinen Avatar.</div></div>'; return; }
  v.innerHTML = '<div class="console"><div class="crumbs"><a href="#/">HALLEN</a> / PROFIL</div><h1>Profil &amp; Avatar</h1><p class="lead">Gestalte deinen Avatar. Coins verdienst du mit Aufgaben, Theorie und Speedruns – sie sind nur Dekoration und geben keinen Vorteil. Man kann sie nicht mit Geld kaufen.</p><div class="panel muted">Lade …</div></div>';
  let D;
  try{ D = await P.api('GET', 'avatar'); }catch(err){ v.querySelector('.panel').textContent = err.message; return; }
  let spec = A.normalize(D.spec), owned = new Set(D.owned), coins = D.coins, tab = 'a', dirty = false;
  const has = (slot, id) => !id || owned.has(slot + ':' + id);
  const draw = () => {
    const earned = (D.earned || []).map(e => '<li><span>' + esc(KIND_LABEL[e.kind] || e.kind) + '</span><b>' + e.n + '</b></li>').join('') || '<li class="muted">Noch nichts verdient – löse eine Aufgabe!</li>';
    v.querySelector('.console').innerHTML = '<div class="crumbs"><a href="#/">HALLEN</a> / PROFIL</div><h1>Profil &amp; Avatar</h1><p class="lead">Gestalte deinen Avatar. Coins verdienst du mit Aufgaben, Theorie und Speedruns – sie sind nur Dekoration und geben keinen Vorteil. Man kann sie nicht mit Geld kaufen.</p>' +
      '<div class="pf-grid"><div class="panel pf-side"><div class="pf-big" id="pfBig">' + A.svg(spec, { size: 200, anim: true, label: 'Dein Avatar' }) + '</div><div class="pf-name">' + esc(P.user.username) + '</div>' +
      '<div class="pf-coins" title="Dein Guthaben">🪙 <b id="pfCoins">' + coins + '</b> Coins</div><ul class="pf-earned">' + earned + '</ul>' +
      '<div class="row" style="justify-content:center"><button class="btn pri" id="pfSave"' + (dirty ? '' : ' disabled') + '>Speichern</button></div><p class="small muted" id="pfMsg" role="status"></p></div>' +
      '<div class="panel"><div class="pf-tabs" role="tablist" aria-label="Bereich">' + TABS.map(t => '<button role="tab" class="btn sm' + (t === tab ? ' pri' : '') + '" data-tab="' + t + '" aria-selected="' + (t === tab) + '">' + SLOT_LABEL[t] + '</button>').join('') + '</div><div class="pf-items" id="pfItems">' + items() + '</div></div></div>';
    bind();
  };
  const optionCard = (label, cur, spec2, extra, attrs) => '<button class="pf-it' + (cur ? ' on' : '') + '" ' + attrs + ' aria-pressed="' + cur + '"><span class="pf-pv">' + A.svg(spec2, { size: 84 }) + '</span><b>' + esc(label) + '</b>' + (extra || '') + '</button>';
  function items(){
    if(tab === 'a') return Object.keys(A.ANIMALS).map(k => optionCard(A.ANIMALS[k].name, spec.a === k, Object.assign({}, spec, { a: k }), '', 'data-pick="a:' + k + '"')).join('');
    if(tab === 'c') return A.COLORS.map(c => optionCard(c.name, spec.c === c.id, Object.assign({}, spec, { c: c.id }), '', 'data-pick="c:' + c.id + '"')).join('');
    const none = optionCard('ohne', !spec[tab], Object.assign({}, spec, { [tab]: '' }), '', 'data-pick="' + tab + ':"');
    return none + A.ITEMS[tab].map(it => {
      const mine = has(tab, it.id);
      const extra = mine ? '' : it.badge ? '<small class="pf-lock">🔒 ' + esc(BADGE_LABEL[it.badge] || it.badge) + '</small>' : '<small class="pf-price' + (coins >= it.cost ? ' can' : '') + '">🪙 ' + it.cost + '</small>';
      return optionCard(it.name, spec[tab] === it.id, Object.assign({}, spec, { [tab]: it.id }), extra, 'data-pick="' + tab + ':' + it.id + '"' + (mine ? '' : ' data-locked="1"'));
    }).join('');
  }
  async function pick(slot, id, locked){
    if(locked){
      const it = A.item(slot, id); if(!it) return;
      if(it.badge){ P.toast('Dieses Stück schaltest du mit einem Abzeichen frei.', true); return; }
      if(coins < it.cost){ P.toast('Dir fehlen noch ' + (it.cost - coins) + ' Coins.', true); return; }
      if(!(await P.confirmDlg(it.name + ' kaufen?', 'Das kostet ' + it.cost + ' Coins. Du hast ' + coins + '.', 'Kaufen'))) return;
      try{ const r = await P.api('POST', 'avatar/buy', { slot, id }); coins = r.coins; owned.add(slot + ':' + id); P.toast('Gekauft: ' + it.name); }catch(err){ P.toast(err.message, true); return; }
    }
    spec = A.normalize(Object.assign({}, spec, { [slot]: slot === 'c' ? +id : id })); dirty = true; draw();
  }
  function bind(){
    v.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    v.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const i = b.dataset.pick.indexOf(':'); pick(b.dataset.pick.slice(0, i), b.dataset.pick.slice(i + 1), !!b.dataset.locked); });
    $('pfSave').onclick = async () => {
      try{ const r = await P.api('PUT', 'avatar', { spec }); spec = A.normalize(r.spec); dirty = false; P.user.avatar = spec; P.renderTop(); draw(); $('pfMsg').textContent = 'Gespeichert.'; }
      catch(err){ $('pfMsg').textContent = err.message; }
    };
  }
  draw();
}
P.routes.push({ re: /^#\/profil$/, view: viewProfil });
})();
