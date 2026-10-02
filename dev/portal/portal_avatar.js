/* ===== SPS Quest Portal: Avatar & Coins (Feedback-Auftrag Paket 3, Garderobe 2.0 A5) – #/avatar =====
   Tier und Farbe wählen, Kleidung/Accessoires anziehen oder mit Coins kaufen. Coins sind nur verdienbar (Aufgaben, Bosse,
   Theorie, Live-Challenges, Zertifikate), nie mit Geld kaufbar und rein kosmetisch. Der Server prüft Besitz, Freischaltung und Stand. */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc, A = window.SPSQAvatar;
let ST = null, draft = null;

async function view(){
  const v = $('view');
  if(!P.user){ v.innerHTML = '<div class="console"><div class="panel empty">Bitte zuerst anmelden.<br><br><button class="btn pri" id="avLogin">Anmelden</button></div></div>'; $('avLogin').onclick = () => P.openTerminal('login'); return; }
  v.innerHTML = '<div class="console"><div class="panel muted">Lade …</div></div>';
  try{ ST = await P.api('GET', 'avatar'); }catch(err){ v.innerHTML = '<div class="console"><div class="panel empty">' + esc(err.message) + '</div></div>'; return; }
  draft = A.normalize(ST.avatar || A.DEFAULT);
  render();
}
let POSE = 'wave';
// Garderobe 2.0 (A5): Filter nach Kollektion, Seltenheit und „bald freischaltbar“; Seltenheitsrahmen; Fortschrittsbalken je Bedingung; Farbvarianten; Monats-Schaufenster
const F = { set: 'alle', rar: 'alle', soon: false };
const owns = id => A.owns(id, ST.owned, ST.unlock);
const CHAL = ['challenges', 'podium', 'wins', 'sdWins', 'bugFixed', 'flawless'];
const isChal = it => it.unlock && Object.keys(it.unlock).some(k => CHAL.includes(k));
const soonOf = id => { const p = A.unlockProgress(id, ST.unlock); return p.length && !p.every(x => x.ok) && p.every(x => x.ok || x.have / x.need >= 0.5); };
function visible(id){
  const it = A.item(id);
  if(it.shop === 'monat' && it.shopSet !== ST.shopSet && !owns(id)) return false;
  if(it.variant && !owns(id) && !A.isUnlocked(it.base, ST.unlock)) return false;   // Farbvarianten erst, wenn das Teil freigeschaltet ist
  if(F.set === 'challenge' ? !isChal(it) : F.set === 'monat' ? it.shop !== 'monat' : F.set !== 'alle' && it.set !== F.set) return false;
  if(F.rar !== 'alle' && it.rarity !== F.rar) return false;
  if(F.soon && !soonOf(id)) return false;
  return true;
}
const opt = (v, cur, label) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
function render(){
  const v = $('view'), c = ST.coins, e = c.earned, R = ST.rules;
  A.ensureCSS();
  const tt = A.title(draft), best = A.best(draft), setK = A.setDone(draft);
  const shop = Object.keys(A.ITEMS).filter(id => A.ITEMS[id].shop === 'monat' && A.ITEMS[id].shopSet === ST.shopSet);
  const ids = [].concat(...Object.keys(A.ITEMS).map(id => [id].concat(A.variants(id))));
  v.innerHTML = '<div class="console av-page"><div class="crumbs"><a href="#/">HALLEN</a> / AVATAR</div><h1>Avatar &amp; Coins</h1>' +
    '<p class="lead">Dein Tier erscheint im Portal, in der Klassenliste und bei Live-Challenges am Beamer. Coins verdienst du nur durchs Spielen – sie sind nie mit Geld kaufbar und bringen keinen Spielvorteil. Seltene Teile brauchen eine Leistung, die der Server bestätigt.</p>' +
    '<div class="av-grid"><div class="panel av-preview"><div class="av-big" id="avBig">' + A.svg(draft, { size: 'stage', pose: POSE, anim: true }) + '</div>' +
      (tt ? '<div class="av-title' + (tt.glanz ? ' glanz' : '') + '" style="color:' + A.RARITY[tt.rarity].color + '">' + esc(tt.text) + '</div>' : '') +
      (best ? '<div class="small av-wears">trägt: <b style="color:' + best.color + '">' + esc(best.rarityName + ' ' + best.name) + '</b></div>' : '') +
      (setK ? '<div class="small av-set">✨ Set „' + esc(A.SETS[setK].name) + '“ komplett: ' + esc(A.SETS[setK].bonus) + '</div>' : '') +
      '<div class="av-poses" role="group" aria-label="Pose ansehen">' + [['idle', 'Stehen'], ['wave', 'Winken'], ['jubel', 'Jubeln'], ['dance', 'Siegestanz'], ['sad', 'Traurig']].map(([k, n]) => '<button type="button" class="btn small' + (POSE === k ? ' pri' : '') + '" data-pose="' + k + '" aria-pressed="' + (POSE === k) + '">' + n + '</button>').join('') + '</div>' +
      '<div class="av-coins"><span class="coin">●</span> <b id="avBal">' + c.balance + '</b> Coins</div>' +
      '<button class="btn pri" id="avSave">Speichern</button><p class="muted small" id="avMsg" role="status"></p></div>' +
    '<div class="panel"><h2>Tier</h2><div class="av-animals">' + Object.keys(A.ANIMALS).map(k => '<button type="button" class="av-pick' + (draft.animal === k ? ' on' : '') + '" data-animal="' + k + '" aria-pressed="' + (draft.animal === k) + '">' + A.svg({ animal: k, color: draft.color, equip: {} }, { size: 'card' }) + '<span>' + esc(A.ANIMALS[k].name) + '</span></button>').join('') + '</div>' +
      '<h2>Farbe</h2><div class="av-colors">' + A.COLORS.map(col => '<button type="button" class="av-col' + (draft.color === col ? ' on' : '') + '" data-color="' + col + '" style="background:' + col + '" aria-label="Farbe ' + col + '" aria-pressed="' + (draft.color === col) + '"></button>').join('') + '</div>' +
      (shop.length ? '<h2>Monats-Schaufenster <span class="tag">nur diesen Monat</span></h2><p class="muted small">Jeden Monat drei Sonderteile – sie kommen später wieder.</p><div class="av-items">' + shop.map(itemBtn).join('') + '</div>' : '') +
      '<div class="av-filter row"><label class="small">Kollektion <select class="inp" id="avfSet">' + opt('alle', F.set, 'alle') + Object.keys(A.SETS).map(k => opt(k, F.set, A.SETS[k].name)).join('') + opt('challenge', F.set, 'Challenge-Trophäen') + opt('monat', F.set, 'Monats-Schaufenster') + '</select></label>' +
        '<label class="small">Seltenheit <select class="inp" id="avfRar">' + opt('alle', F.rar, 'alle') + Object.keys(A.RARITY).map(k => opt(k, F.rar, A.RARITY[k].name)).join('') + '</select></label>' +
        '<label class="small row"><input type="checkbox" id="avfSoon"' + (F.soon ? ' checked' : '') + '> bald freischaltbar</label></div>' +
      Object.keys(A.SLOTS).map(slot => { const list = ids.filter(id => A.item(id).slot === slot && visible(id)); if(!list.length) return '';
        return '<h2>' + esc(A.SLOTS[slot]) + '</h2><div class="av-items">' + (slot !== 'oberteil' && F.set === 'alle' && F.rar === 'alle' && !F.soon ? '<button type="button" class="av-item' + (!draft.equip[slot] ? ' on' : '') + '" data-slot="' + slot + '" data-item=""><span class="av-thumb av-none">–</span><span>ohne</span></button>' : '') +
          list.map(itemBtn).join('') + '</div>'; }).join('') +
    '</div></div>' +
    '<div class="panel"><h2>So verdienst du Coins</h2><table class="tbl"><tbody>' +
      '<tr><td>Gelöste Aufgaben (1★ / 2★ / 3★, Lösung angesehen)</td><td class="num">' + R.star.join(' / ') + ' / ' + R.revealed + '</td><td class="num"><b>' + e.tasks + '</b></td></tr>' +
      '<tr><td>Kapitel-Boss (Zusatz)</td><td class="num">' + R.boss + '</td><td class="num"><b>' + e.bosses + '</b></td></tr>' +
      '<tr><td>Final Boss (Zusatz)</td><td class="num">' + R.final + '</td><td class="num"><b>' + e.finals + '</b></td></tr>' +
      '<tr><td>Bestandene Theorie</td><td class="num">' + R.theory + '</td><td class="num"><b>' + e.theory + '</b></td></tr>' +
      '<tr><td>Live-Challenge (Platz 1 / 2 / 3, gelöst · Sudden-Death-Sieg · Teilnahme) und Zertifikat (bestanden / mit Auszeichnung)</td><td class="num">' + R.speedrun[1] + ' / ' + R.speedrun[2] + ' / ' + R.speedrun[3] + ' / ' + R.speedrun.solved + ' · ' + R.speedrun.sudden + ' · ' + (R.speedrun.teilnahme || 5) + (R.cert ? ' · ' + R.cert.pass + ' / ' + R.cert.distinction : '') + '</td><td class="num"><b>' + c.speedrun + '</b></td></tr>' +
      '<tr><td>Ausgegeben</td><td></td><td class="num">−' + c.spent + '</td></tr>' +
      '<tr><td><b>Stand</b></td><td></td><td class="num"><b>' + c.balance + '</b></td></tr></tbody></table>' +
      '<p class="muted small">Gezählt wird der Fortschritt, der mit deinem Konto gespeichert ist (alle Quests). Challenges zählen ab ' + ((ST.chRules || {}).minPlayers || 3) + ' Teilnehmenden und ' + Math.round(((ST.chRules || {}).minMs || 120000) / 60000) + ' Minuten Laufzeit.</p></div></div>';
  bind();
}
function itemBtn(id){
  const it = A.item(id), own = owns(id), on = draft.equip[it.slot] === id, open = A.isUnlocked(id, ST.unlock), rc = A.RARITY[it.rarity].color;
  const preview = it.slot === 'titel' ? '<span class="av-title' + (it.glanz ? ' glanz' : '') + '" style="color:' + rc + '">' + esc(it.name) + '</span>'
    : A.svg(Object.assign({}, draft, { equip: Object.assign({}, draft.equip, { [it.slot]: id }) }), { size: 'card', pose: it.slot === 'siegerpose' ? 'dance' : 'idle' });
  const prog = !own && !open ? A.unlockProgress(id, ST.unlock) : [];
  const state = own ? (on ? 'angezogen' : 'besitzt du') : it.earnOnly ? (open ? 'verdient' : '🔒 nur verdienbar') : !open ? '🔒 gesperrt' : it.price + ' Coins';
  return '<button type="button" class="av-item r-' + it.rarity + (on ? ' on' : '') + (own ? ' own' : '') + (!open && !own ? ' locked' : '') + '" style="--rc:' + rc + '" data-slot="' + it.slot + '" data-item="' + id + '" title="' + esc(it.name + ' – ' + A.RARITY[it.rarity].name + ' – ' + (prog.length ? A.unlockText(id, ST.unlock) : state)) + '">' +
    '<span class="av-rar">' + esc(A.RARITY[it.rarity].name) + (it.anim ? ' · bewegt' : '') + '</span>' +
    '<span class="av-thumb' + (it.slot === 'titel' ? ' av-tthumb' : '') + '">' + preview + '</span><span>' + esc(it.name) + '</span><small>' + esc(state) + (!own && !open && !it.earnOnly ? ' · ' + it.price + ' Coins' : '') + '</small>' +
    prog.map(p => '<span class="av-prog" title="' + esc(p.text) + '"><span class="av-prog-t">' + esc(p.text) + '</span><span class="av-bar"><i style="width:' + Math.round(100 * p.have / p.need) + '%"></i></span><span class="av-prog-n">' + (p.need > 1 ? p.have + '/' + p.need : (p.ok ? '✓' : '–')) + '</span></span>').join('') + '</button>';
}
function bind(){
  const v = $('view');
  v.querySelectorAll('[data-animal]').forEach(b => b.onclick = () => { draft.animal = b.dataset.animal; render(); });
  v.querySelectorAll('[data-pose]').forEach(b => b.onclick = () => { POSE = b.dataset.pose; render(); });
  v.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { draft.color = b.dataset.color; render(); });
  $('avfSet').onchange = e => { F.set = e.target.value; render(); }; $('avfRar').onchange = e => { F.rar = e.target.value; render(); }; $('avfSoon').onchange = e => { F.soon = e.target.checked; render(); };
  v.querySelectorAll('[data-slot]').forEach(b => b.onclick = async () => {
    const slot = b.dataset.slot, id = b.dataset.item;
    if(!id){ delete draft.equip[slot]; render(); return; }
    if(!owns(id)){
      const it = A.item(id);
      if(it.earnOnly || !A.isUnlocked(id, ST.unlock)){ P.toast('Noch gesperrt – ' + it.name + ': ' + A.unlockText(id, ST.unlock) + '.', true); return; }
      if(ST.coins.balance < it.price){ P.toast('Dafür reichen deine Coins noch nicht (' + ST.coins.balance + ' von ' + it.price + ').', true); return; }
      if(!await P.confirmDlg('Kaufen?', '<p>„' + esc(it.name) + '“ für <b>' + it.price + ' Coins</b> kaufen? Coins sind nur verdient, nicht gekauft – und du behältst den Gegenstand.</p>', 'Kaufen')) return;
      try{ const r = await P.api('POST', 'avatar/buy', { item: id }); ST.owned.push(id); ST.coins.balance = r.balance; ST.coins.spent += it.price; }
      catch(err){ P.toast(err.message, true); return; }
    }
    draft.equip[slot] = id; render();
  });
  $('avSave').onclick = async () => {
    try{ const r = await P.api('PUT', 'avatar', draft); ST.avatar = r.avatar; P.setUserAvatar(r.avatar); $('avMsg').textContent = 'Gespeichert.'; P.toast('Avatar gespeichert.'); }
    catch(err){ $('avMsg').textContent = err.message; P.toast(err.message, true); }
  };
}
P.routes.push({ re: /^#\/avatar$/, view });
})();
