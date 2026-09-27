(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — interaktive Lektionsbausteine (docs/SENSORWERKSTATT_PLAN.md Teil 7; Paket S8)
   In Lektion oder Handbuch: <div class="lb" data-lb="stromfluss|kennlinie|schaltabstand|m12" [data-range="4..20mA" data-min="0" data-max="100" data-unit="mbar"]></div>
   Alle Werte kommen aus SensorModel (dasselbe Modell wie Werkstatt, Tests und Validator).
   ============================================================ */
const SM = () => root.SensorModel;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;

/* ---------- Stromfluss PNP/NPN × 1M ---------- */
function stromfluss(el){
  const st = { out: 'PNP', m1: 'M', teil: true };
  el.innerHTML = '<div class="lb-bar" role="group" aria-label="Stromfluss einstellen">'
    + '<button type="button" class="lb-btn" data-k="out">Sensor: PNP</button><button type="button" class="lb-btn" data-k="m1">1M an M</button><button type="button" class="lb-btn" data-k="teil">Teil erkannt</button></div>'
    + '<svg class="lb-svg" viewBox="0 0 360 170" role="img" aria-label="Stromlaufplan Sensor und Eingang"></svg><p class="lb-out" aria-live="polite"></p>';
  const svg = el.querySelector('svg'), out = el.querySelector('.lb-out');
  function draw(){
    const r = SM().digitalInput({ out: st.out, group1M: st.m1, active: st.teil, supply: true });
    const flow = r.value, pnp = st.out === 'PNP';
    const wire = (d, on, c) => '<path d="' + d + '" stroke="' + (on ? '#39ff14' : c || '#6f8396') + '" stroke-width="3" fill="none"' + (on ? ' stroke-dasharray="8 6"><animate attributeName="stroke-dashoffset" values="' + (pnp ? '28;0' : '0;28') + '" dur="0.8s" repeatCount="indefinite"/></path>' : '/>');
    svg.innerHTML = '<rect width="360" height="170" fill="#0b1218" rx="8"/>'
      + '<text x="10" y="22" fill="#ff8a6a" font-size="12" font-family="monospace">L+ 24 V</text><line x1="10" y1="30" x2="350" y2="30" stroke="#c0392b" stroke-width="3"/>'
      + '<text x="10" y="162" fill="#8ab4ff" font-size="12" font-family="monospace">M 0 V</text><line x1="10" y1="145" x2="350" y2="145" stroke="#2f6fd0" stroke-width="3"/>'
      + '<rect x="40" y="55" width="90" height="65" rx="8" fill="#1d2b38" stroke="#8aa0b4"/><text x="85" y="78" text-anchor="middle" fill="#e6eef6" font-size="12" font-family="monospace">Sensor ' + st.out + '</text>'
      + '<circle cx="118" cy="66" r="5" fill="' + (r.sensorLed ? '#ffd21e' : '#3a3320') + '"/>'
      + (pnp ? '<text x="85" y="100" text-anchor="middle" fill="#9fb0c0" font-size="10" font-family="monospace">schaltet L+ auf BK</text>' : '<text x="85" y="100" text-anchor="middle" fill="#9fb0c0" font-size="10" font-family="monospace">schaltet M auf BK</text>')
      + wire('M60 55 L60 30', false, '#8b5a2b') + wire('M60 120 L60 145', false, '#2f6fd0')
      + '<rect x="230" y="55" width="90" height="65" rx="8" fill="#1d2b38" stroke="#8aa0b4"/><text x="275" y="78" text-anchor="middle" fill="#e6eef6" font-size="12" font-family="monospace">Eingang %I0.4</text>'
      + '<circle cx="308" cy="66" r="5" fill="' + (r.inputLed ? '#39ff14' : '#1f3a24') + '"/><text x="275" y="100" text-anchor="middle" fill="#9fb0c0" font-size="10" font-family="monospace">1M an ' + st.m1 + '</text>'
      + wire('M130 88 L230 88', flow) + wire(st.m1 === 'M' ? 'M275 120 L275 145' : 'M275 55 L275 30', flow, st.m1 === 'M' ? '#2f6fd0' : '#c0392b')
      + '<text x="180" y="82" text-anchor="middle" fill="#9fb0c0" font-size="10" font-family="monospace">BK</text>';
    out.innerHTML = (flow ? '✓ Strom fliesst: <b>%I0.4 = 1</b>' : '✗ Kein Strom: <b>%I0.4 = 0</b>') + (st.teil && !flow ? ' – Sensor-LED an, Eingang aus: ' + (pnp ? 'PNP braucht 1M an M.' : 'NPN braucht 1M an L+.') : '') + (!st.teil ? ' (kein Teil erkannt)' : '');
    const b = k => el.querySelector('[data-k="' + k + '"]');
    b('out').textContent = 'Sensor: ' + st.out; b('m1').textContent = '1M an ' + st.m1; b('teil').textContent = st.teil ? 'Teil erkannt' : 'kein Teil';
    b('teil').setAttribute('aria-pressed', String(st.teil));
  }
  el.addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.k; if(!k) return; if(k === 'out') st.out = st.out === 'PNP' ? 'NPN' : 'PNP'; if(k === 'm1') st.m1 = st.m1 === 'M' ? 'L+' : 'M'; if(k === 'teil') st.teil = !st.teil; draw(); });
  draw();
}

/* ---------- Kennlinien-Rechner: physikalisch → Signal → Rohwert → NORM_X → SCALE_X ---------- */
function kennlinie(el){
  const range = el.dataset.range || '4..20mA', lo = +(el.dataset.min || 0), hi = +(el.dataset.max || 100), unit = el.dataset.unit || '%';
  const kind = SM().RANGE_OF[range] || 'I4_20';
  el.innerHTML = '<div class="lb-bar"><label>Signal <select class="lb-sel">' + Object.keys(SM().RANGE_OF).filter(k => k !== '+-10V').map(k => '<option' + (k === range ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label>'
    + '<label class="lb-grow">Messwert <input type="range" class="lb-rng" min="' + (lo - (hi - lo) * 0.25) + '" max="' + (hi + (hi - lo) * 0.25) + '" step="' + ((hi - lo) / 200) + '" value="' + ((lo + hi) / 2) + '"></label></div>'
    + '<table class="lb-tbl"><tr><th>Messwert</th><th>Signal</th><th>Rohwert</th><th>NORM_X</th><th>SCALE_X</th></tr><tr class="lb-row"></tr></table><p class="lb-out" aria-live="polite"></p>';
  const sel = el.querySelector('.lb-sel'), rng = el.querySelector('.lb-rng'), row = el.querySelector('.lb-row'), out = el.querySelector('.lb-out');
  function draw(){
    const rg = sel.value, k = SM().RANGE_OF[rg], x = +rng.value;
    const sig = SM().signal(k, x, lo, hi), cfg = { type: /mA/.test(rg) ? (rg === '4..20mA' ? 'I_2W' : 'I_4W') : 'U', range: rg, diag: { wireBreak: true } };
    const raw = SM().rawValue({ kind: /mA/.test(rg) ? 'I' : 'U', value: sig }, cfg);
    const special = raw >= 32767 || raw <= -32768, norm = raw / 27648, scaled = lo + norm * (hi - lo);
    row.innerHTML = '<td>' + r1(x) + ' ' + esc(unit) + '</td><td>' + r3(sig) + (/mA/.test(rg) ? ' mA' : ' V') + '</td><td><b>' + raw + '</b></td><td>' + (special ? '—' : r3(norm)) + '</td><td>' + (special ? '—' : r1(scaled) + ' ' + esc(unit)) + '</td>';
    const d = SM().rawDiag(raw, cfg);
    out.textContent = d ? 'Hinweis: ' + d + (special ? ' – Sonderwert, nicht skalieren!' : ' – ausserhalb des Nennbereichs 0…27648.') : 'Nennbereich: 0…27648 entspricht ' + lo + '…' + hi + ' ' + unit + '.';
  }
  sel.addEventListener('change', draw); rng.addEventListener('input', draw); draw();
  if(!kind) sel.value = '4..20mA';
}

/* ---------- Schaltabstand × Material ---------- */
function schaltabstand(el){
  const sn = +(el.dataset.sn || 8), kind = el.dataset.kind || 'ind';
  const mats = ['stahl', 'edelstahl', 'aluminium', 'messing', 'kunststoff_w', 'glas'];
  el.innerHTML = '<div class="lb-bar"><label class="lb-grow">Abstand <input type="range" class="lb-rng" min="0" max="' + (sn * 1.2) + '" step="0.5" value="4"> <output>4</output> mm</label>'
    + (kind === 'kap' ? '<label>Poti <input type="range" class="lb-poti" min="0" max="1" step="0.05" value="0.5"> <output class="lb-po">50 %</output></label>' : '') + '</div><div class="lb-bars"></div>';
  const rng = el.querySelector('.lb-rng'), bars = el.querySelector('.lb-bars'), poti = el.querySelector('.lb-poti');
  function draw(){
    const d = +rng.value; el.querySelector('output').textContent = d;
    const p = poti ? +poti.value : 0.5; if(poti) el.querySelector('.lb-po').textContent = Math.round(p * 100) + ' %';
    bars.innerHTML = mats.map(m => {
      const M = SM().MATERIALS[m], reach = kind === 'ind' ? sn * M.ind : (M.kap >= 1 - p - 1e-9 ? sn * Math.max(0.1, p) : 0);
      const on = SM().detects({ kind, sn, poti: p }, { material: m, dist: d });
      return '<div class="lb-mat"><span class="lb-mn">' + esc(M.name) + '</span><span class="lb-track"><span class="lb-reach" style="width:' + Math.min(100, reach / (sn * 1.2) * 100) + '%"></span><span class="lb-mark" style="left:' + (d / (sn * 1.2) * 100) + '%"></span></span><span class="lb-res ' + (on ? 'on' : '') + '">' + (on ? '✓ erkannt' : '✗') + ' <small>' + r1(reach) + ' mm</small></span></div>';
    }).join('');
  }
  rng.addEventListener('input', draw); if(poti) poti.addEventListener('input', draw); draw();
}

/* ---------- M12-Belegung zum Antippen ---------- */
function m12(el){
  const P = [[1, 'BN', 'braun', 'L+ (24 V)', '#8b5a2b', 30, 30], [2, 'WH', 'weiss', 'Ausgang 2 / Öffner (4-Leiter)', '#e8e8e8', 90, 30], [3, 'BU', 'blau', 'M (0 V)', '#2f6fd0', 90, 90], [4, 'BK', 'schwarz', 'Schaltausgang', '#222', 30, 90]];
  el.innerHTML = '<svg class="lb-svg lb-m12" viewBox="0 0 120 120" role="group" aria-label="M12-Stecker, Pins antippen"><circle cx="60" cy="60" r="56" fill="#2b3138" stroke="#8aa0b4" stroke-width="3"/><rect x="54" y="4" width="12" height="10" fill="#0b1218"/>'
    + P.map(p => '<g class="lb-pin" tabindex="0" role="button" data-pin="' + p[0] + '" aria-label="Pin ' + p[0] + '"><circle cx="' + p[5] + '" cy="' + p[6] + '" r="13" fill="' + p[4] + '" stroke="#e6eef6" stroke-width="2"/><text x="' + p[5] + '" y="' + (p[6] + 5) + '" text-anchor="middle" font-size="13" font-family="monospace" fill="' + (p[1] === 'WH' ? '#111' : '#fff') + '">' + p[0] + '</text></g>').join('')
    + '</svg><p class="lb-out" aria-live="polite">Pin antippen (Sicht auf den Stecker am Sensor, Kodierung oben).</p>';
  const out = el.querySelector('.lb-out');
  const show = n => { const p = P.find(x => x[0] === n); out.innerHTML = '<b>Pin ' + p[0] + ' · ' + p[1] + ' (' + p[2] + ')</b>: ' + p[3]; };
  el.addEventListener('click', e => { const g = e.target.closest('[data-pin]'); if(g) show(+g.dataset.pin); });
  el.addEventListener('keydown', e => { const g = e.target.closest('[data-pin]'); if(g && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); show(+g.dataset.pin); } });
}

const W = { stromfluss, kennlinie, schaltabstand, m12 };
function mount(rootEl){
  if(!rootEl || !SM()) return;
  injectCss();
  rootEl.querySelectorAll('.lb[data-lb]').forEach(el => { if(el.dataset.lbDone) return; const f = W[el.dataset.lb]; if(f){ el.dataset.lbDone = '1'; f(el); } });
}
const CSS = `
.lb{ margin:12px 0; padding:10px; border:1px solid var(--border-col, #2a3a4c); border-radius:10px; background:rgba(88,196,255,.04); }
.lb-bar{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px; } .lb-grow{ flex:1; display:flex; gap:6px; align-items:center; min-width:180px; } .lb-grow input{ flex:1; }
.lb-btn{ min-height:36px; padding:4px 10px; border-radius:8px; border:1px solid #2a3a4c; background:#16202b; color:inherit; cursor:pointer; font:inherit; }
.lb-svg{ width:100%; max-width:420px; display:block; } .lb-m12{ max-width:180px; } .lb-pin{ cursor:pointer; } .lb-pin:focus{ outline:none; } .lb-pin:focus circle{ stroke:#58c4ff; stroke-width:4; }
.lb-out{ font-size:13px; margin:6px 0 0; } .lb-tbl{ border-collapse:collapse; font-size:13px; } .lb-tbl th, .lb-tbl td{ padding:3px 8px; border-bottom:1px solid #1d2a37; text-align:right; }
.lb-bars{ display:flex; flex-direction:column; gap:4px; } .lb-mat{ display:grid; grid-template-columns:130px 1fr 100px; gap:6px; align-items:center; font-size:12px; }
.lb-track{ position:relative; height:12px; background:#10161d; border-radius:6px; } .lb-reach{ position:absolute; left:0; top:0; bottom:0; background:#2f6fd0; border-radius:6px; }
.lb-mark{ position:absolute; top:-3px; bottom:-3px; width:2px; background:#ffd166; } .lb-res{ color:#ff9a8a; } .lb-res.on{ color:#7fe3a0; }
@media (max-width:520px){ .lb-mat{ grid-template-columns:90px 1fr 80px; } }
`;
function injectCss(){ if(document.getElementById('lbCss')) return; const s = document.createElement('style'); s.id = 'lbCss'; s.textContent = CSS; document.head.appendChild(s); }
root.SensorLessons = { mount, widgets: W };
})(typeof window !== 'undefined' ? window : globalThis);
