/* ===== SPS Quest Portal: Avatar & Coins (Feedback-Auftrag Paket 3) – #/avatar =====
   Tier und Farbe wählen, Kleidung/Accessoires anziehen oder mit Coins kaufen. Coins sind nur verdienbar (Aufgaben, Bosse,
   Theorie, Speedrun-Platzierung), nie mit Geld kaufbar und rein kosmetisch. Der Server prüft Besitz, Freischaltung und Stand. */
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
const owns = id => A.ITEMS[id].price === 0 || ST.owned.includes(id);
function render(){
  const v = $('view'), c = ST.coins, e = c.earned, R = ST.rules;
  v.innerHTML = '<div class="console av-page"><div class="crumbs"><a href="#/">HALLEN</a> / AVATAR</div><h1>Avatar &amp; Coins</h1>' +
    '<p class="lead">Dein Tier erscheint im Portal, in der Klassenliste und bei Live-Challenges am Beamer. Coins verdienst du nur durchs Spielen – sie sind nie mit Geld kaufbar und bringen keinen Spielvorteil.</p>' +
    '<div class="av-grid"><div class="panel av-preview"><div class="av-big" id="avBig">' + A.svg(draft) + '</div>' +
      '<div class="av-coins"><span class="coin">●</span> <b id="avBal">' + c.balance + '</b> Coins</div>' +
      '<button class="btn pri" id="avSave">Speichern</button><p class="muted small" id="avMsg" role="status"></p></div>' +
    '<div class="panel"><h2>Tier</h2><div class="av-animals">' + Object.keys(A.ANIMALS).map(k => '<button type="button" class="av-pick' + (draft.animal === k ? ' on' : '') + '" data-animal="' + k + '" aria-pressed="' + (draft.animal === k) + '">' + A.svg({ animal: k, color: draft.color, equip: {} }) + '<span>' + esc(A.ANIMALS[k].name) + '</span></button>').join('') + '</div>' +
      '<h2>Farbe</h2><div class="av-colors">' + A.COLORS.map(col => '<button type="button" class="av-col' + (draft.color === col ? ' on' : '') + '" data-color="' + col + '" style="background:' + col + '" aria-label="Farbe ' + col + '" aria-pressed="' + (draft.color === col) + '"></button>').join('') + '</div>' +
      Object.keys(A.SLOTS).map(slot => '<h2>' + esc(A.SLOTS[slot]) + '</h2><div class="av-items">' + (slot !== 'oberteil' ? '<button type="button" class="av-item' + (!draft.equip[slot] ? ' on' : '') + '" data-slot="' + slot + '" data-item=""><span class="av-thumb av-none">–</span><span>ohne</span></button>' : '') +
        Object.keys(A.ITEMS).filter(id => A.ITEMS[id].slot === slot).map(id => itemBtn(id)).join('') + '</div>').join('') +
    '</div></div>' +
    '<div class="panel"><h2>So verdienst du Coins</h2><table class="tbl"><tbody>' +
      '<tr><td>Gelöste Aufgaben (1★ / 2★ / 3★, Lösung angesehen)</td><td class="num">' + R.star.join(' / ') + ' / ' + R.revealed + '</td><td class="num"><b>' + e.tasks + '</b></td></tr>' +
      '<tr><td>Kapitel-Boss (Zusatz)</td><td class="num">' + R.boss + '</td><td class="num"><b>' + e.bosses + '</b></td></tr>' +
      '<tr><td>Final Boss (Zusatz)</td><td class="num">' + R.final + '</td><td class="num"><b>' + e.finals + '</b></td></tr>' +
      '<tr><td>Bestandene Theorie</td><td class="num">' + R.theory + '</td><td class="num"><b>' + e.theory + '</b></td></tr>' +
      '<tr><td>Speedrun (Platz 1 / 2 / 3, gelöst · Sudden-Death-Sieg) und Zertifikat (bestanden / mit Auszeichnung)</td><td class="num">' + R.speedrun[1] + ' / ' + R.speedrun[2] + ' / ' + R.speedrun[3] + ' / ' + R.speedrun.solved + ' · ' + R.speedrun.sudden + (R.cert ? ' · ' + R.cert.pass + ' / ' + R.cert.distinction : '') + '</td><td class="num"><b>' + c.speedrun + '</b></td></tr>' +
      '<tr><td>Ausgegeben</td><td></td><td class="num">−' + c.spent + '</td></tr>' +
      '<tr><td><b>Stand</b></td><td></td><td class="num"><b>' + c.balance + '</b></td></tr></tbody></table>' +
      '<p class="muted small">Gezählt wird der Fortschritt, der mit deinem Konto gespeichert ist (alle Quests).</p></div></div>';
  bind();
}
function itemBtn(id){
  const it = A.ITEMS[id], own = owns(id), on = draft.equip[it.slot] === id, open = A.isUnlocked(id, ST.unlock);
  const preview = A.svg(Object.assign({}, draft, { equip: Object.assign({}, draft.equip, { [it.slot]: id }) }));
  const state = own ? (on ? 'angezogen' : 'besitzt du') : !open ? '🔒 ' + A.unlockText(id) : it.price + ' Coins';
  return '<button type="button" class="av-item' + (on ? ' on' : '') + (own ? ' own' : '') + (!open && !own ? ' locked' : '') + '" data-slot="' + it.slot + '" data-item="' + id + '" title="' + esc(it.name + ' – ' + state) + '">' +
    '<span class="av-thumb">' + preview + '</span><span>' + esc(it.name) + '</span><small>' + esc(state) + '</small></button>';
}
function bind(){
  const v = $('view');
  v.querySelectorAll('[data-animal]').forEach(b => b.onclick = () => { draft.animal = b.dataset.animal; render(); });
  v.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { draft.color = b.dataset.color; render(); });
  v.querySelectorAll('[data-slot]').forEach(b => b.onclick = async () => {
    const slot = b.dataset.slot, id = b.dataset.item;
    if(!id){ delete draft.equip[slot]; render(); return; }
    if(!owns(id)){
      const it = A.ITEMS[id];
      if(!A.isUnlocked(id, ST.unlock)){ P.toast('Noch gesperrt: ' + A.unlockText(id) + '.', true); return; }
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
