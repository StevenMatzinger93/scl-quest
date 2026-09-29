/* ===== SPS Quest Portal: Zertifikate mit Prüfung (Lernende) =====
   #/zertifikate(/quest) · #/zertifikate/ausstellen/:examId · #/zertifikat/:code
   Prüfung läuft in der Quest (<quest>/?exam=ID), Bewertung auf dem Server. QR-Code: qrcode-generator (MIT), eingebettet. */
(function(){
'use strict';
const P = window.SPSQ, $ = id => document.getElementById(id), esc = P.esc;
const QN = { scl:'SCL', kop:'KOP', fup:'FUP', awl:'AWL' }, LEVEL = { grund:'Grundstufe', profi:'Profi-Stufe' };
const COLOR = { scl:'#39ff14', kop:'#ffb000', fup:'#1ec8e0', awl:'#ff5a36' };
const INK = { scl:'#1d7a0a', kop:'#9a6a00', fup:'#0b7f8f', awl:'#b8391c' };   // Druckfarben (heller Hintergrund)
const fmtDay = t => new Date(t).toLocaleDateString('de-CH', { day:'2-digit', month:'long', year:'numeric' });
const certUrl = code => location.origin + '/z/' + code;

function needStudent(v){
  if(!P.user){ v.innerHTML = '<div class="console"><div class="panel empty">Für Prüfungen und Zertifikate brauchst du ein Konto.<br><br><button class="btn pri" id="xzLogin">Anmelden</button></div></div>'; $('xzLogin').onclick = () => P.openTerminal('login'); return true; }
  return false;
}

/* ---------- Übersicht ---------- */
async function overview(m){
  const v = $('view'); if(needStudent(v)) return;
  const qs = P.OPEN_QUESTS(), sel = qs.includes(m && m[1]) ? m[1] : null;
  v.innerHTML = '<div class="console xz"><div class="crumbs"><a href="#/">HALLEN</a> / ZERTIFIKATE</div><h1>Zertifikate</h1>'
    + '<p class="lead">Lege pro Quest eine echte Prüfung ab – Grundstufe und Profi-Stufe. Bestanden gibt es ein Zertifikat mit Prüfcode und QR-Code, dessen Echtheit jeder online prüfen kann.</p>'
    + '<p class="small muted xz-free">Zertifikate sind in der Testphase kostenlos.</p>'
    + (P.user.role === 'student' || P.user.role === 'teacher' ? '<div class="panel"><h2>Prüfung unter Aufsicht beitreten</h2><form class="row" id="xzJoin"><input class="inp" id="xzCode" maxlength="6" placeholder="Code, z.B. K7QX2M" autocomplete="off" style="width:190px;text-transform:uppercase"><button class="btn pri">Beitreten</button><span class="muted small">Den 6-stelligen Code nennt deine Lehrperson.</span></form></div>' : '')
    + '<div id="xzQuests"><div class="panel muted">Lade …</div></div>'
    + '<div class="panel"><h2>Meine Zertifikate</h2><div id="xzMine" class="cert-list"><div class="muted">Lade …</div></div></div></div>';
  if($('xzJoin')) $('xzJoin').onsubmit = async e => {
    e.preventDefault();
    const code = $('xzCode').value.trim().toUpperCase(); if(!code) return;
    if(!await confirmStart(null, null, true)) return;
    try{ const r = await P.api('POST', 'exams', { sessionCode: code }); location.href = r.exam.quest + '/?exam=' + r.exam.id; }
    catch(err){ P.toast(err.message, true); }
  };
  const list = sel ? [sel].concat(qs.filter(q => q !== sel)) : qs;
  const data = await Promise.all(list.map(q => P.api('GET', 'exams/eligibility?quest=' + q).catch(e => ({ error: e.message, quest: q }))));
  $('xzQuests').innerHTML = data.map(d => d.error ? '<div class="panel">' + esc(d.error) + '</div>' : questCard(d)).join('');
  v.querySelectorAll('[data-start]').forEach(b => b.onclick = async () => {
    const [q, level] = b.dataset.start.split(':');
    if(!await confirmStart(q, level)) return;
    try{ const r = await P.api('POST', 'exams', { quest: q, level }); location.href = q + '/?exam=' + r.exam.id; }
    catch(err){ P.toast(err.message, true); }
  });
  mine();
}
function questCard(d){
  const q = d.quest, run = d.running;
  return '<div class="panel xz-quest" style="--qc:' + COLOR[q] + '"><h2><span class="xz-dot"></span>' + QN[q] + ' Quest</h2><div class="xz-levels">'
    + ['grund', 'profi'].map(level => {
      const L = d.levels[level], R = d.rules[level];
      let st, act = '';
      if(run && run.level === level){ st = '<span class="pill warn">läuft</span>'; act = '<a class="btn pri" href="' + q + '/?exam=' + run.id + '">Prüfung fortsetzen</a>'; }
      else if(L.certificate){ st = '<span class="pill ok">bestanden</span>'; act = '<a class="btn" href="#/zertifikat/' + esc(L.certificate) + '">Zertifikat ansehen</a>'; }
      else if(L.nextAt){ st = '<span class="pill">Wartefrist</span>'; act = '<span class="small muted">Nächster Versuch ab ' + P.fmtDate(L.nextAt) + '</span>'; }
      else if(L.ok){ st = '<span class="pill ok">bereit</span>'; act = '<button class="btn pri" data-start="' + q + ':' + level + '">Prüfung starten</button>'; }
      else { st = '<span class="pill">gesperrt</span>'; act = '<ul class="xz-miss">' + L.missing.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'; }
      return '<div class="xz-level"><div class="row"><b class="grow">' + LEVEL[level] + '</b>' + st + '</div>'
        + '<p class="small muted">' + R.tasks + ' Programmieraufgaben + ' + R.questions + ' Theoriefragen · ' + R.minutes + ' min · bestanden ab 70 %, ab 90 % mit Auszeichnung'
        + (L.total ? '<br>Im Spiel gelöst: ' + L.solved + '/' + L.total + (L.finalOk ? ' · Final Boss ✓' : '') : '') + (L.attempts30 ? ' · Versuche (30 Tage): ' + L.attempts30 + '/3' : '') + '</p>' + act + '</div>';
    }).join('') + '</div></div>';
}
function confirmStart(q, level, proctored){
  return P.dialog(proctored ? 'Prüfung unter Aufsicht' : 'Prüfung starten: ' + QN[q] + ' ' + LEVEL[level],
    '<ul class="xz-rules"><li><b>Zeit:</b> ' + (level === 'profi' ? '90' : proctored ? 'wie von der Lehrperson festgelegt, höchstens 60 bzw. 90' : '60') + ' Minuten, die Uhr läuft auf dem Server weiter – auch wenn du die Seite schliesst.</li>'
    + '<li><b>Erlaubt:</b> Handbuch und Glossar, Testen mit den sichtbaren Beispiel-Tests.</li><li><b>Gesperrt:</b> Hinweise, Musterlösung, Lösungsvergleich, Karte, Live-Challenge.</li>'
    + '<li><b>Bewertung:</b> Jede Abgabe prüft der Server mit verdeckten Tests. Mehrfach abgeben ist erlaubt – es zählt die letzte Abgabe. Aufgaben 70 %, Theorie 30 %.</li>'
    + '<li><b>Versuche:</b> einer pro 24 Stunden, höchstens drei in 30 Tagen.</li>'
    + '<li>Wechsel in andere Fenster oder Tabs werden gezählt (nur protokolliert).</li></ul>'
    + '<label class="row small"><input type="checkbox" id="xsConfirm"> Ich lege die Prüfung ' + (proctored ? 'unter Aufsicht ehrlich und ' : '') + 'selbständig ab.</label><p class="small" id="xsMsg" style="color:#ff8080"></p>',
    [{ label:'Abbrechen', value:false }, { label:'Prüfung starten', value:true, cls:'pri', check: () => { if($('xsConfirm').checked) return true; $('xsMsg').textContent = 'Bitte bestätigen.'; return false; } }]);
}
async function mine(){
  let r; try{ r = await P.api('GET', 'certificates/mine'); }catch(err){ $('xzMine').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; return; }
  $('xzMine').innerHTML = r.certificates.length ? r.certificates.map(c => '<a class="cert-row' + (c.status !== 'valid' ? ' off' : '') + '" href="#/zertifikat/' + esc(c.code) + '" style="--qc:' + COLOR[c.quest] + '"><span class="xz-dot"></span><b>' + esc(c.title) + '</b>'
    + (c.distinction ? ' <span class="pill ok">mit Auszeichnung</span>' : '') + '<span class="grow"></span><span class="small muted">' + fmtDay(c.issuedAt) + ' · ' + esc(c.code) + (c.status !== 'valid' ? ' · ' + (c.status === 'withdrawn' ? 'zurückgezogen' : 'widerrufen') : '') + '</span></a>').join('')
    : '<div class="empty">Noch keine Zertifikate.</div>';
}

/* ---------- Ausstellen ---------- */
async function issueView(m){
  const v = $('view'); if(needStudent(v)) return;
  const id = +m[1];
  let r; try{ r = await P.api('GET', 'exams/' + id); }catch(err){ v.innerHTML = '<div class="console"><div class="panel empty">' + esc(err.message) + '</div></div>'; return; }
  const e = r.exam, res = r.result || {};
  if(!res.passed){ v.innerHTML = '<div class="console"><div class="panel empty">Diese Prüfung ist ' + (e.state === 'running' ? 'noch nicht abgeschlossen' : 'nicht bestanden') + '.<br><br><a class="btn" href="#/zertifikate">Zu den Zertifikaten</a></div></div>'; return; }
  const title = QN[e.quest] + ' Quest – ' + LEVEL[e.level];
  v.innerHTML = '<div class="console xz"><div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/zertifikate">ZERTIFIKATE</a> / AUSSTELLEN</div><h1>Zertifikat ausstellen</h1>'
    + '<p class="lead">Bestanden mit ' + Math.round(res.score * 100) + ' %' + (res.distinction ? ' – mit Auszeichnung' : '') + '. Gib den Namen ein, der auf dem Zertifikat stehen soll.</p>'
    + '<div class="panel"><label for="xcName">Name auf dem Zertifikat</label><input class="inp" id="xcName" maxlength="80" autocomplete="name" placeholder="Vorname Nachname">'
    + '<div class="cert-preview" style="--qc:' + COLOR[e.quest] + '"><div class="cp-k">ZERTIFIKAT · ' + esc(title.toUpperCase()) + '</div><div class="cp-name" id="xcPrev">Vorname Nachname</div><div class="cp-s">' + (e.proctored ? 'unter Aufsicht abgelegt' : 'online abgelegt') + ' · ' + Math.round(res.score * 100) + ' %</div></div>'
    + '<label class="row small xc-consent"><input type="checkbox" id="xcConsent"> Ich bin einverstanden, dass dieser Name zusammen mit Quest, Stufe, Datum und Ergebnis auf der öffentlichen Prüfseite des Zertifikats sichtbar ist. Ich kann das Zertifikat jederzeit zurückziehen; dann wird der Name gelöscht.</label>'
    + '<p class="small" id="xcMsg" style="color:#ff8080"></p><div class="row"><span class="grow"></span><button class="btn pri" id="xcIssue"><i aria-hidden="true">🎓</i> Zertifikat ausstellen</button></div></div></div>';
  $('xcName').oninput = () => { $('xcPrev').textContent = $('xcName').value.trim() || 'Vorname Nachname'; };
  $('xcIssue').onclick = async () => {
    if(!$('xcConsent').checked){ $('xcMsg').textContent = 'Bitte die Einwilligung bestätigen.'; return; }
    try{ const x = await P.api('POST', 'certificates', { examId: id, holderName: $('xcName').value, consent: true }); location.hash = '#/zertifikat/' + x.certificate.code; }
    catch(err){ $('xcMsg').textContent = err.message; }
  };
}

/* ---------- Zertifikat ansehen, drucken, teilen ---------- */
function qrSvg(text, size){
  if(!window.qrcode) return '';
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 2, s = size / (n + 2 * q);
  let d = '';
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(qr.isDark(r, c)) d += 'M' + ((c + q) * s).toFixed(2) + ' ' + ((r + q) * s).toFixed(2) + 'h' + s.toFixed(2) + 'v' + s.toFixed(2) + 'h-' + s.toFixed(2) + 'z';
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="QR-Code zur Prüfseite"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
function sheetHTML(c){
  return '<div class="cert-sheet" style="--qc:' + INK[c.quest] + ';--qg:' + COLOR[c.quest] + '"><div class="cs-frame">'
    + '<div class="cs-top"><div class="cs-brand">SPS QUEST</div><div class="cs-badge">' + QN[c.quest] + '</div></div>'
    + '<div class="cs-k">ZERTIFIKAT</div><div class="cs-title">' + esc(c.title) + '</div>'
    + '<div class="cs-lead">Hiermit wird bestätigt, dass</div><div class="cs-name">' + esc(c.holder || '—') + '</div>'
    + '<div class="cs-lead">die Prüfung <b>' + esc(c.title) + '</b> ' + (c.distinction ? '<b>mit Auszeichnung</b> ' : '') + 'bestanden hat (' + c.score + ' %).</div>'
    + '<div class="cs-meta"><div><span>Datum</span><b>' + fmtDay(c.issuedAt) + '</b></div><div><span>Prüfungsart</span><b>' + (c.proctored ? 'unter Aufsicht' + (c.proctor ? ' bei ' + esc(c.proctor) : '') : 'online abgelegt') + '</b></div>'
    + '<div><span>Prüfcode</span><b class="cert-code">' + esc(c.code) + '</b></div></div>'
    + '<div class="cs-bottom"><div class="cs-verify">Echtheit prüfen:<br><b>' + esc(certUrl(c.code)) + '</b></div><div class="cert-qr">' + qrSvg(certUrl(c.code), 120) + '</div></div>'
    + '<div class="cs-foot">Ausgestellt von SPS Quest. Kein Zertifikat der Siemens AG. SIMATIC, S7 und TIA Portal sind Marken der Siemens AG.</div></div></div>';
}
function linkedIn(c){
  const d = new Date(c.issuedAt);
  return 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=' + encodeURIComponent('SPS Quest – ' + c.title) + '&organizationName=' + encodeURIComponent('SPS Quest')
    + '&issueYear=' + d.getFullYear() + '&issueMonth=' + (d.getMonth() + 1) + '&certUrl=' + encodeURIComponent(certUrl(c.code)) + '&certId=' + encodeURIComponent(c.code);
}
async function certView(m){
  const v = $('view'), code = m[1].toUpperCase();
  let c = null;
  if(P.user){ try{ c = (await P.api('GET', 'certificates/mine')).certificates.find(x => x.code === code) || null; }catch(e){} }
  if(!c){ location.href = '/z/' + encodeURIComponent(code); return; }   // fremdes Zertifikat → öffentliche Prüfseite
  v.innerHTML = '<div class="console xz"><div class="crumbs"><a href="#/">HALLEN</a> / <a href="#/zertifikate">ZERTIFIKATE</a> / ' + esc(code) + '</div>'
    + (c.status !== 'valid' ? '<div class="panel notice">Dieses Zertifikat ist ' + (c.status === 'withdrawn' ? 'von dir zurückgezogen' : 'widerrufen' + (c.revokeReason ? ' (' + esc(c.revokeReason) + ')' : '')) + ' und auf der Prüfseite nicht mehr gültig.</div>' : '')
    + '<div class="cert-wrap">' + sheetHTML(c) + '</div>'
    + (c.status === 'valid' ? '<div class="panel xc-actions"><button class="btn pri" id="xcPrint">🖨️ Drucken / als PDF</button><button class="btn" id="xcPng">🖼️ Bild (PNG)</button><button class="btn" id="xcCopy">🔗 Link kopieren</button>'
    + '<a class="btn" id="xcLinkedIn" target="_blank" rel="noopener" href="' + esc(linkedIn(c)) + '">in Zu LinkedIn hinzufügen</a><a class="btn" href="/z/' + esc(code) + '" target="_blank" rel="noopener">Prüfseite</a><span class="grow"></span><button class="btn dan" id="xcWithdraw">Zurückziehen …</button></div>' : '') + '</div>';
  if(c.status !== 'valid') return;
  $('xcPrint').onclick = () => printSheet(c);
  $('xcPng').onclick = () => pngSheet(c);
  $('xcCopy').onclick = async () => { try{ await navigator.clipboard.writeText(certUrl(code)); P.toast('Link kopiert.'); }catch(e){ P.dialog('Link zum Zertifikat', '<input class="inp" readonly value="' + esc(certUrl(code)) + '" onfocus="this.select()">'); } };
  $('xcWithdraw').onclick = async () => {
    if(!await P.confirmDlg('Zertifikat zurückziehen?', 'Der Name wird gelöscht und die Prüfseite zeigt danach nur noch „zurückgezogen“. Das kann nicht rückgängig gemacht werden.', 'Zurückziehen', true)) return;
    try{ await P.api('DELETE', 'certificates/' + code); P.toast('Zertifikat zurückgezogen.'); certView(m); }catch(err){ P.toast(err.message, true); }
  };
}
function printSheet(c){
  $('printArea').innerHTML = sheetHTML(c);
  const st = document.createElement('style'); st.id = 'certPage'; st.textContent = '@page{ size:A4 landscape; margin:0; }';
  document.head.appendChild(st); document.body.classList.add('print-cert');
  const done = () => { st.remove(); document.body.classList.remove('print-cert'); $('printArea').innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if(document.getElementById('certPage')) done(); }, 60000);
}
function pngSheet(c){
  const W = 1600, H = 1131, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), ink = INK[c.quest], glow = COLOR[c.quest];
  g.fillStyle = '#0b1016'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fbfaf6'; g.fillRect(40, 40, W - 80, H - 80);
  g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(70, 70, W - 140, H - 140);
  g.strokeStyle = glow; g.lineWidth = 2; g.strokeRect(84, 84, W - 168, H - 168);
  const txt = (s, x, y, font, color, align) => { g.font = font; g.fillStyle = color; g.textAlign = align || 'center'; g.fillText(s, x, y); };
  const fit = (s, max, size, weight) => { let f = size; do { g.font = weight + ' ' + f + 'px system-ui, sans-serif'; f -= 2; } while(g.measureText(s).width > max && f > 20); return f + 2; };
  txt('SPS QUEST', 140, 170, '700 30px ui-monospace, monospace', '#1b2a38', 'left');
  g.fillStyle = ink; g.fillRect(W - 250, 124, 110, 64); txt(QN[c.quest], W - 195, 168, '800 32px ui-monospace, monospace', '#fff');
  txt('ZERTIFIKAT', W / 2, 300, '800 88px system-ui, sans-serif', '#1b2a38');
  txt(c.title, W / 2, 360, '600 38px system-ui, sans-serif', ink);
  txt('Hiermit wird bestätigt, dass', W / 2, 450, '400 30px system-ui, sans-serif', '#3a4a5a');
  const nf = fit(c.holder, 1200, 76, '700'); txt(c.holder, W / 2, 545, '700 ' + nf + 'px system-ui, sans-serif', '#111');
  g.strokeStyle = '#c9c3b3'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 420, 575); g.lineTo(W / 2 + 420, 575); g.stroke();
  txt('die Prüfung ' + c.title + ' ' + (c.distinction ? 'mit Auszeichnung ' : '') + 'bestanden hat (' + c.score + ' %).', W / 2, 640, '400 30px system-ui, sans-serif', '#3a4a5a');
  const meta = [['Datum', fmtDay(c.issuedAt)], ['Prüfungsart', c.proctored ? 'unter Aufsicht' + (c.proctor ? ' bei ' + c.proctor : '') : 'online abgelegt'], ['Prüfcode', c.code]];
  meta.forEach((mm, i) => { txt(mm[0].toUpperCase(), 160, 740 + i * 62, '600 20px ui-monospace, monospace', '#7a8794', 'left'); txt(mm[1], 400, 740 + i * 62, '600 28px system-ui, sans-serif', '#1b2a38', 'left'); });
  // QR
  if(window.qrcode){ const qr = window.qrcode(0, 'M'); qr.addData(certUrl(c.code)); qr.make(); const n = qr.getModuleCount(), size = 230, s = Math.floor(size / (n + 4)), x0 = W - 170 - s * (n + 4), y0 = 700;
    g.fillStyle = '#fff'; g.fillRect(x0, y0, s * (n + 4), s * (n + 4)); g.fillStyle = '#000';
    for(let r = 0; r < n; r++) for(let cc = 0; cc < n; cc++) if(qr.isDark(r, cc)) g.fillRect(x0 + (cc + 2) * s, y0 + (r + 2) * s, s, s);
  }
  txt('Echtheit prüfen: ' + certUrl(c.code), 160, 960, '400 20px ui-monospace, monospace', '#3a4a5a', 'left');
  txt('Ausgestellt von SPS Quest. Kein Zertifikat der Siemens AG. SIMATIC, S7 und TIA Portal sind Marken der Siemens AG.', W / 2, H - 110, '400 18px system-ui, sans-serif', '#7a8794');
  const a = document.createElement('a'); a.download = 'SPS-Quest-Zertifikat-' + c.code + '.png'; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
}

P.routes.push({ re: /^#\/zertifikate(?:\/(scl|kop|fup|awl))?$/, view: overview });
P.routes.push({ re: /^#\/zertifikate\/ausstellen\/(\d+)$/, view: issueView });
P.routes.push({ re: /^#\/zertifikat\/(SPSQ-[A-Za-z0-9-]+)$/, view: certView });
window.SPSQ_CERT = { sheetHTML, qrSvg, linkedIn, pngSheet };
})();
