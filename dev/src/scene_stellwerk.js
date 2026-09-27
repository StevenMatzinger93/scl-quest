(function(root){
"use strict";
/* ============================================================
   SZENE: Stellwerk „Brünigkreuz“ (FUP Quest), 2D-SVG
   Gleiche Schnittstelle wie Roboterzelle und Seilbahn (SceneEngine).
   Kanäle: switch1Right/switch2Right (Weichenlage: TRUE = abzweigend),
   switch1Moving/switch2Moving (Weiche läuft), signalEntry/signalExit
   (FALSE/0 = Halt, TRUE/1 = Fahrt, 2 = Fahrt mit Warnung),
   crossingClosed, crossingLights, crossingBell, trainRunning,
   trainApproach, trackA/trackB/trackC (Gleis besetzt), routeSet,
   routeLocked, lightRed/Yellow/Green (Stelltisch), hornActive,
   faultActive, displayValue, displayLabel, displayText, axleCount, trainSpeed
   ============================================================ */
const DEFAULTS = {
  switch1Right:false, switch1Moving:false, switch2Right:false, switch2Moving:false, signalEntry:false, signalExit:false,
  crossingClosed:false, crossingLights:false, crossingBell:false, trainRunning:false, trainApproach:false,
  trackA:null, trackB:null, trackC:null, routeSet:false, routeLocked:false, lightRed:false, lightYellow:false, lightGreen:false,
  hornActive:false, faultActive:false, displayValue:null, displayLabel:'', displayText:'', axleCount:null, trainSpeed:null
};
const MON_META = {
  switch1Right:{icon:'fa-code-branch', label:'Weiche 1'}, switch1Moving:{icon:'fa-arrows-left-right', label:'W1 läuft'}, switch2Right:{icon:'fa-code-branch', label:'Weiche 2'}, switch2Moving:{icon:'fa-arrows-left-right', label:'W2 läuft'},
  signalEntry:{icon:'fa-traffic-light', label:'Einfahrsignal'}, signalExit:{icon:'fa-traffic-light', label:'Ausfahrsignal'},
  crossingClosed:{icon:'fa-road-barrier', label:'Schranke'}, crossingLights:{icon:'fa-lightbulb', label:'Blinklicht'}, crossingBell:{icon:'fa-bell', label:'Glocke'},
  trainRunning:{icon:'fa-train', label:'Zug fährt'}, trainApproach:{icon:'fa-satellite-dish', label:'Zug meldet'},
  trackA:{icon:'fa-grip-lines', label:'Gleis Einfahrt'}, trackB:{icon:'fa-grip-lines', label:'Gleis 1'}, trackC:{icon:'fa-grip-lines', label:'Gleis 2'},
  routeSet:{icon:'fa-route', label:'Fahrstrasse'}, routeLocked:{icon:'fa-lock', label:'FS gesichert'},
  lightRed:{icon:'fa-lightbulb', label:'Melder Rot'}, lightYellow:{icon:'fa-lightbulb', label:'Melder Gelb'}, lightGreen:{icon:'fa-lightbulb', label:'Melder Grün'},
  hornActive:{icon:'fa-bullhorn', label:'Wecker'}, faultActive:{icon:'fa-triangle-exclamation', label:'Störung'},
  displayValue:{icon:'fa-display', label:'Anzeige'}, displayText:{icon:'fa-message', label:'Anzeigetext'}, axleCount:{icon:'fa-circle-dot', label:'Achszähler'}, trainSpeed:{icon:'fa-gauge', label:'Tempo km/h'}
};
const PULSE_TARGET = {
  switch1Right:'sw-w1', switch1Moving:'sw-w1', switch2Right:'sw-w2', switch2Moving:'sw-w2', signalEntry:'sw-sigA', signalExit:'sw-sigB',
  crossingClosed:'sw-bue', crossingLights:'sw-bue', crossingBell:'sw-bell', trainRunning:'sw-train', trainApproach:'sw-approach',
  trackA:'sw-trA', trackB:'sw-trB', trackC:'sw-trC', routeSet:'sw-route', routeLocked:'sw-route', lightRed:'sw-l-red', lightYellow:'sw-l-yellow', lightGreen:'sw-l-green',
  hornActive:'sw-horn', faultActive:'sw-fault', displayValue:'sw-disp', displayLabel:'sw-disp', displayText:'sw-disp', axleCount:'sw-axle', trainSpeed:'sw-speed'
};

/* ---------- Bühne ---------- */
// Gleisplan: Hauptgleis y=150 (Gleis 1), Überholgleis y=112 (Gleis 2) zwischen Weiche 1 (x=110) und Weiche 2 (x=300)
const MAIN = [[-30, 150], [430, 150]];
const VIA2 = [[-30, 150], [110, 150], [140, 112], [270, 112], [300, 150], [430, 150]];
const lamp = (id, cx, cy, cls) => '<circle id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="3.6" class="sw-lamp ' + cls + '"/>';
const signal = (id, x, y, label) => '<g id="' + id + '" transform="translate(' + x + ' ' + y + ')"><line x1="0" y1="0" x2="0" y2="-12" class="sw-mast"/><rect x="-6" y="-44" width="12" height="32" rx="3" class="sw-sigbox"/>' +
  lamp(id + '-r', 0, -37, 'sw-r') + lamp(id + '-y', 0, -28, 'sw-y') + lamp(id + '-g', 0, -19, 'sw-g') + '<text x="0" y="8" text-anchor="middle" class="sw-small">' + label + '</text></g>';
const STAGE_SVG = `
<svg id="stageSvg" class="sw-stage" viewBox="0 0 400 250" role="img" aria-label="Stellwerk Brünigkreuz">
 <defs><linearGradient id="swSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1622"/><stop offset="1" stop-color="#18262f"/></linearGradient></defs>
 <rect width="400" height="250" fill="url(#swSky)"/>
 <g class="sw-stars">${Array.from({ length: 18 }, (_, i) => '<circle cx="' + ((i * 97) % 400) + '" cy="' + ((i * 29) % 60) + '" r="' + (i % 3 ? .6 : 1) + '"/>').join('')}</g>
 <path d="M0 95 L50 70 L95 88 L150 52 L205 84 L262 48 L318 80 L360 60 L400 76 L400 100 L0 100Z" class="sw-hills"/>
 <rect x="0" y="100" width="400" height="90" class="sw-ground"/>
 <text x="200" y="20" text-anchor="middle" class="sw-title">STELLWERK BRÜNIGKREUZ</text>
 <!-- Strasse und Bahnübergang -->
 <rect x="232" y="100" width="26" height="90" class="sw-road"/><line x1="245" y1="102" x2="245" y2="188" class="sw-roadline"/>
 <!-- Gleise mit Belegungsanzeige -->
 <g class="sw-rails">
  <line id="sw-trA" x1="0" y1="150" x2="110" y2="150" class="sw-track"/>
  <line id="sw-trB" x1="110" y1="150" x2="400" y2="150" class="sw-track"/>
  <path id="sw-trC" d="M116 150 L140 112 L270 112 L294 150" class="sw-track sw-track2"/>
  <path id="sw-route" d="" class="sw-route"/>
 </g>
 <text x="190" y="106" text-anchor="middle" class="sw-small">Gleis 2</text><text x="190" y="164" text-anchor="middle" class="sw-small">Gleis 1</text>
 <!-- Weichen -->
 <g id="sw-w1" transform="translate(110 150)"><circle r="5" class="sw-swbase"/><line id="sw-w1-tongue" x1="0" y1="0" x2="18" y2="0" class="sw-tongue"/><text x="0" y="16" text-anchor="middle" class="sw-small">W1</text></g>
 <g id="sw-w2" transform="translate(300 150)"><circle r="5" class="sw-swbase"/><line id="sw-w2-tongue" x1="0" y1="0" x2="-18" y2="0" class="sw-tongue"/><text x="0" y="16" text-anchor="middle" class="sw-small">W2</text></g>
 <!-- Signale -->
 ${signal('sw-sigA', 88, 140, 'A')}${signal('sw-sigB', 330, 140, 'B')}
 <!-- Einschaltkontakt -->
 <rect id="sw-approach" x="30" y="152" width="14" height="4" rx="1" class="sw-contact"/>
 <!-- Bahnübergang: Schranken, Blinklicht, Glocke -->
 <g id="sw-bue">
  <g transform="translate(222 176)"><rect x="-2" y="-8" width="4" height="12" class="sw-mast2"/><rect id="sw-bar1" x="0" y="-8" width="36" height="3.5" rx="1.5" class="sw-bar"/></g>
  <g transform="translate(268 124)"><rect x="-2" y="-8" width="4" height="12" class="sw-mast2"/><rect id="sw-bar2" x="-36" y="-8" width="36" height="3.5" rx="1.5" class="sw-bar sw-bar2"/></g>
  <g transform="translate(214 166)"><path d="M-6 -6 L6 6 M6 -6 L-6 6" class="sw-cross"/><circle id="sw-bl1" cx="-5" cy="10" r="2.8" class="sw-lamp sw-r"/><circle id="sw-bl2" cx="5" cy="10" r="2.8" class="sw-lamp sw-r"/></g>
 </g>
 <g id="sw-bell" transform="translate(276 176)"><path d="M-5 4 Q-5 -6 0 -6 Q5 -6 5 4 Z" class="sw-bellbody"/><path class="sw-waves" d="M8 -4 Q11 0 8 4 M11 -7 Q15 0 11 7"/></g>
 <!-- Zug -->
 <g id="sw-train" transform="translate(-60 150)"><g transform="translate(0 -10)"><rect x="-26" y="0" width="22" height="9" rx="2" class="sw-car"/><rect x="-2" y="-2" width="24" height="11" rx="2.5" class="sw-loco"/><rect x="14" y="0" width="6" height="4" class="sw-win"/><circle cx="21" cy="5" r="1.6" class="sw-headlight"/></g></g>
 <!-- Stelltisch -->
 <g id="sw-desk" transform="translate(8 196)"><rect width="384" height="48" rx="5" class="sw-deskbox"/><text x="8" y="12" class="sw-small sw-left">STELLTISCH</text>
  <g transform="translate(14 28)">${lamp('sw-l-red', 0, 0, 'sw-r')}${lamp('sw-l-yellow', 12, 0, 'sw-y')}${lamp('sw-l-green', 24, 0, 'sw-g')}</g>
  <g id="sw-horn" transform="translate(56 26)"><path d="M0 0 L7 -4 L7 6 L0 2 Z" class="sw-hornbody"/><path class="sw-waves" d="M10 -3 Q13 1 10 5"/></g>
  <g id="sw-disp" transform="translate(84 6)"><rect width="140" height="36" rx="3" class="sw-dispbox"/><text id="sw-disp-label" x="6" y="11" class="sw-small sw-left">ANZEIGE</text><text id="sw-disp-val" x="134" y="24" text-anchor="end" class="sw-dispval">--</text><text id="sw-disp-text" x="6" y="31" class="sw-small sw-left sw-disptext"></text></g>
  <g id="sw-axle" transform="translate(232 6)"><rect width="70" height="16" rx="3" class="sw-box"/><text x="5" y="11" class="sw-small sw-left">ACHSEN</text><text id="sw-axle-val" x="65" y="11.5" text-anchor="end" class="sw-countval">--</text></g>
  <g id="sw-speed" transform="translate(232 26)"><rect width="70" height="16" rx="3" class="sw-box"/><text x="5" y="11" class="sw-small sw-left">km/h</text><text id="sw-speed-val" x="65" y="11.5" text-anchor="end" class="sw-countval">--</text></g>
  <g transform="translate(310 6)"><rect width="66" height="36" rx="3" class="sw-box"/><text x="33" y="12" text-anchor="middle" class="sw-small">FAHRSTRASSE</text><text id="sw-route-txt" x="33" y="28" text-anchor="middle" class="sw-routetxt">—</text></g>
 </g>
 <g id="sw-fault" class="sw-fault"><rect x="140" y="26" width="120" height="20" rx="4"/><text x="200" y="40" text-anchor="middle">⚠ STÖRUNG</text></g>
 <g id="ch-frame-wrap" class="frame-wrap" style="opacity:0"><rect x="8" y="176" width="186" height="16" rx="4" class="frame-bg"/><text id="ch-frame-label" x="14" y="187.5" class="frame-text"></text></g>
 <g id="ch-result-overlay" style="opacity:0;pointer-events:none"><rect id="ch-result-flash" width="400" height="250" class="result-flash-ok"/></g>
</svg>`;

const $ = id => document.getElementById(id);
let monitorRows = {}, monFlashTimers = {}, pulseTimers = {}, lastValues = {};
const listeners = [];
const st = { pos: 0, running:false, raf:0, last:0, via2:false, speed:null };

/* ---------- Zug entlang des Gleisplans ---------- */
function along(poly, t){
  const segs = []; let L = 0;
  for(let i = 1; i < poly.length; i++){ const d = Math.hypot(poly[i][0] - poly[i-1][0], poly[i][1] - poly[i-1][1]); segs.push(d); L += d; }
  let s = t * L;
  for(let i = 0; i < segs.length; i++){ if(s <= segs[i]){ const k = s / segs[i]; return [poly[i][0] + (poly[i+1][0] - poly[i][0]) * k, poly[i][1] + (poly[i+1][1] - poly[i][1]) * k, Math.atan2(poly[i+1][1] - poly[i][1], poly[i+1][0] - poly[i][0])]; } s -= segs[i]; }
  const e = poly[poly.length - 1]; return [e[0], e[1], 0];
}
function placeTrain(){
  const g = $('sw-train'); if(!g) return;
  const [x, y, a] = along(st.via2 ? VIA2 : MAIN, st.pos);
  g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a * 180 / Math.PI).toFixed(1) + ')');
}
function tick(ts){
  if(!st.running){ st.raf = 0; return; }
  const dt = st.last ? Math.min(.1, (ts - st.last) / 1000) : 0; st.last = ts;
  const v = st.speed == null ? 60 : Math.max(10, Number(st.speed) || 0);
  st.pos += dt * v / 900;
  if(st.pos > 1) st.pos -= 1;
  placeTrain();
  st.raf = requestAnimationFrame(tick);
}
function setRunning(on){
  st.running = !!on;
  if(st.running && !st.raf && typeof requestAnimationFrame === 'function'){ st.last = 0; st.raf = requestAnimationFrame(tick); }
}
function drawRoute(){
  const r = $('sw-route'), t = $('sw-route-txt'); if(!r) return;
  const set = lastValues.routeSet, lock = lastValues.routeLocked;
  const via2 = !!lastValues.switch1Right;
  r.setAttribute('d', (set || lock) ? (via2 ? 'M0 150 L110 150 L140 112 L270 112 L300 150 L400 150' : 'M0 150 L400 150') : '');
  r.classList.toggle('sw-route-lock', !!lock);
  if(t){ t.textContent = lock ? (via2 ? 'GL 2 🔒' : 'GL 1 🔒') : set ? (via2 ? 'GLEIS 2' : 'GLEIS 1') : '—'; t.classList.toggle('on', !!(set || lock)); }
}

/* ---------- Monitor unter der Bühne ---------- */
function sigText(v){ const n = v === true ? 1 : v === false ? 0 : Number(v); return n === 2 ? { text:'WARNUNG', cls:'on-yellow' } : n ? { text:'FAHRT', cls:'on' } : { text:'HALT', cls:'on-red' }; }
function formatMonValue(ch, v){
  const onoff = (a, b, cls) => v ? { text:a, cls: cls || 'on' } : { text:b, cls:'off' };
  switch(ch){
    case 'switch1Right': case 'switch2Right': return v ? { text:'ABZWEIG', cls:'on-yellow' } : { text:'GERADE', cls:'num' };
    case 'switch1Moving': case 'switch2Moving': return onoff('LÄUFT', '—', 'on-yellow');
    case 'signalEntry': case 'signalExit': return sigText(v);
    case 'crossingClosed': return v ? { text:'ZU', cls:'on-red' } : { text:'OFFEN', cls:'num' };
    case 'crossingLights': case 'crossingBell': case 'hornActive': case 'lightYellow': return onoff('AN', 'AUS', 'on-yellow');
    case 'trainRunning': return onoff('FÄHRT', 'STEHT');
    case 'trainApproach': return onoff('MELDET', '—', 'on-yellow');
    case 'trackA': case 'trackB': case 'trackC': return v === null || v === undefined ? { text:'—', cls:'off' } : v ? { text:'BESETZT', cls:'on-red' } : { text:'FREI', cls:'on' };
    case 'routeSet': return onoff('EINGESTELLT', '—', 'num');
    case 'routeLocked': return onoff('GESICHERT', '—');
    case 'lightRed': return onoff('AN', 'AUS', 'on-red');
    case 'lightGreen': return onoff('AN', 'AUS');
    case 'faultActive': return v ? { text:'AKTIV', cls:'err' } : { text:'OK', cls:'off' };
    case 'displayValue': case 'axleCount': case 'trainSpeed': return (v === null || v === undefined) ? { text:'--', cls:'off' } : { text: String(typeof v === 'number' ? Math.round(v * 10) / 10 : v), cls:'num' };
    case 'displayText': { const t = String(v == null ? '' : v); return t ? { text:'»' + (t.length > 18 ? t.slice(0, 17) + '…' : t) + '«', cls:'num' } : { text:'—', cls:'off' }; }
  }
  return { text:String(v), cls:'num' };
}
function buildMonitor(bindings){
  const wrap = $('sceneMonitor'); if(!wrap) return;
  monitorRows = {}; wrap.innerHTML = '';
  const list = (bindings || []).filter(b => b.channel !== 'displayLabel' && MON_META[b.channel]);
  if(!list.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const cap = document.createElement('div'); cap.className = 'mon-caption'; cap.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Diese Aufgabe steuert'; wrap.appendChild(cap);
  const seen = {};
  list.forEach(b => {
    if(seen[b.channel]) return; seen[b.channel] = 1;
    const m = MON_META[b.channel];
    const chip = document.createElement('div'); chip.className = 'mon-chip';
    chip.innerHTML = '<i class="fa-solid ' + m.icon + '" aria-hidden="true"></i><span class="mon-name">' + m.label + '</span>' + (b.variable ? '<span class="mon-var">' + b.variable + '</span>' : '<span class="mon-var mon-const">fest</span>') + '<span class="mon-val off">–</span>';
    wrap.appendChild(chip); monitorRows[b.channel] = chip;
  });
}
function updateMonitor(ch, v, flash){
  const chip = monitorRows[ch]; if(!chip) return;
  const f = formatMonValue(ch, v), el = chip.querySelector('.mon-val');
  if(el){ el.textContent = f.text; el.className = 'mon-val ' + f.cls; }
  if(flash){ chip.classList.remove('mon-flash'); void chip.offsetWidth; chip.classList.add('mon-flash'); clearTimeout(monFlashTimers[ch]); monFlashTimers[ch] = setTimeout(() => chip.classList.remove('mon-flash'), 800); }
}
function highlightActive(bindings){
  Object.values(PULSE_TARGET).forEach(id => { const e = $(id); if(e) e.classList.remove('ch-active'); });
  (bindings || []).forEach(b => { const e = $(PULSE_TARGET[b.channel]); if(e) e.classList.add('ch-active'); });
}
function pulse(ch){
  const e = $(PULSE_TARGET[ch]); if(!e) return;
  e.classList.remove('ch-pulse'); void e.getBoundingClientRect(); e.classList.add('ch-pulse');
  clearTimeout(pulseTimers[ch]); pulseTimers[ch] = setTimeout(() => e.classList.remove('ch-pulse'), 900);
}
function setFrameLabel(text){ const l = $('ch-frame-label'), w = $('ch-frame-wrap'); if(l) l.textContent = text || ''; if(w) w.style.opacity = text ? '1' : '0'; }

/* ---------- Kanal → Bühne ---------- */
function setSignal(id, v){
  const n = v === true ? 1 : v === false || v == null ? 0 : Number(v);
  const on = (k, x) => { const e = $(id + '-' + k); if(e) e.classList.toggle('lamp-on', !!x); };
  on('r', !n); on('g', n >= 1); on('y', n === 2);
}
function paint(ch, v){
  const tog = (id, cls, on) => { const e = $(id); if(e) e.classList.toggle(cls, !!on); };
  switch(ch){
    case 'switch1Right': { const e = $('sw-w1-tongue'); if(e){ e.setAttribute('x2', v ? '13' : '18'); e.setAttribute('y2', v ? '-13' : '0'); } st.via2 = !!v; tog('sw-trC', 'sw-track-sel', v); drawRoute(); placeTrain(); break; }
    case 'switch2Right': { const e = $('sw-w2-tongue'); if(e){ e.setAttribute('x2', v ? '-13' : '-18'); e.setAttribute('y2', v ? '-13' : '0'); } break; }
    case 'switch1Moving': tog('sw-w1', 'sw-moving', v); break;
    case 'switch2Moving': tog('sw-w2', 'sw-moving', v); break;
    case 'signalEntry': setSignal('sw-sigA', v); break;
    case 'signalExit': setSignal('sw-sigB', v); break;
    case 'crossingClosed': tog('sw-bue', 'sw-closed', v); break;
    case 'crossingLights': tog('sw-bue', 'sw-blink', v); break;
    case 'crossingBell': tog('sw-bell', 'bell-on', v); break;
    case 'trainRunning': setRunning(v); tog('sw-train', 'sw-running', v); break;
    case 'trainApproach': tog('sw-approach', 'sw-contact-on', v); break;
    case 'trackA': case 'trackB': case 'trackC': { const e = $('sw-tr' + ch.slice(5)); if(e){ e.classList.toggle('sw-occ', v === true); e.classList.toggle('sw-free', v === false); } break; }
    case 'routeSet': case 'routeLocked': drawRoute(); break;
    case 'lightRed': tog('sw-l-red', 'lamp-on', v); break;
    case 'lightYellow': tog('sw-l-yellow', 'lamp-on', v); break;
    case 'lightGreen': tog('sw-l-green', 'lamp-on', v); break;
    case 'hornActive': tog('sw-horn', 'horn-on', v); break;
    case 'faultActive': tog('sw-fault', 'fault-on', v); tog('stageSvg', 'stage-fault', v); break;
    case 'displayValue': { const e = $('sw-disp-val'); if(e){ const t = (v === null || v === undefined) ? '--' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v)); e.textContent = t.slice(0, 9); } break; }
    case 'displayLabel': { const e = $('sw-disp-label'); if(e) e.textContent = String(v || 'ANZEIGE').slice(0, 20); break; }
    case 'displayText': { const e = $('sw-disp-text'); if(e){ const t = String(v == null ? '' : v); e.textContent = t.slice(0, 26); } break; }
    case 'axleCount': { const e = $('sw-axle-val'); if(e) e.textContent = (v === null || v === undefined) ? '--' : String(v); break; }
    case 'trainSpeed': { st.speed = v; const e = $('sw-speed-val'); if(e) e.textContent = (v === null || v === undefined) ? '--' : String(Math.round(Number(v))); break; }
  }
}
function setChannel(ch, value, opts){
  opts = opts || {};
  const changed = JSON.stringify(lastValues[ch]) !== JSON.stringify(value);
  lastValues[ch] = value;
  paint(ch, value);
  updateMonitor(ch, value, changed && !opts.silent);
  if(changed && !opts.silent){ pulse(ch); listeners.forEach(fn => { try{ fn('channel', { ch, value }); }catch(e){} }); }
}
function envPath(env, path){
  if(Object.prototype.hasOwnProperty.call(env, path)) return env[path];
  const parts = String(path).replace(/"/g, '').split('.'); let v = env;
  for(const p of parts){
    const m = /^(.*)\[(\d+)\]$/.exec(p);
    const key = m ? m[1] : p;
    if(v === null || typeof v !== 'object') return undefined;
    const k = Object.prototype.hasOwnProperty.call(v, key) ? key : Object.keys(v).find(x => x.toLowerCase() === key.toLowerCase()); if(k === undefined) return undefined;
    v = v[k];
    if(m){ if(!Array.isArray(v) && (v === null || typeof v !== 'object')) return undefined; v = Array.isArray(v) ? v[+m[2] - (v.lo || 0)] : v[m[2]]; }
  }
  return v;
}
function resolveBindings(bindings, env){
  const out = {};
  (bindings || []).forEach(b => {
    let v;
    if(Object.prototype.hasOwnProperty.call(b, 'value')) v = b.value;
    else { const raw = env ? envPath(env, b.variable) : undefined; if(raw === undefined) return; v = b.map ? (Object.prototype.hasOwnProperty.call(b.map, String(raw)) ? b.map[String(raw)] : raw) : raw; }
    if(b.channel in out) return;
    out[b.channel] = v;
  });
  return out;
}
function applyFrame(bindings, env, label, opts){
  const vals = resolveBindings(bindings, env);
  Object.keys(vals).forEach(ch => setChannel(ch, vals[ch], { silent: opts && opts.silent }));
  if(label !== undefined) setFrameLabel(label);
}
function reset(bindings, initialVars){
  const bound = {}; (bindings || []).forEach(b => bound[b.channel] = true);
  Object.keys(DEFAULTS).forEach(ch => { if(!bound[ch]) setChannel(ch, DEFAULTS[ch], { silent:true }); });
  st.pos = 0.02; placeTrain();
  buildMonitor(bindings || []); highlightActive(bindings || []);
  applyFrame(bindings || [], initialVars || {}, '', { silent:true });
  setChannel('faultActive', !!(bound.faultActive && lastValues.faultActive), { silent:true });
  setChannel('hornActive', false, { silent:true }); setChannel('crossingBell', !!(bound.crossingBell && lastValues.crossingBell), { silent:true });
  const o = $('ch-result-overlay'); if(o) o.style.opacity = '0';
}
function hardReset(){
  Object.keys(DEFAULTS).forEach(ch => setChannel(ch, DEFAULTS[ch], { silent:true }));
  lastValues = {}; st.pos = 0.02; placeTrain();
  highlightActive([]); buildMonitor([]); setFrameLabel('');
}
function showFault(label){ setChannel('faultActive', true); setFrameLabel(label || 'Störung'); }
function flashResult(success){
  const o = $('ch-result-overlay'), f = $('ch-result-flash');
  if(o && f){ f.setAttribute('class', success ? 'result-flash-ok' : 'result-flash-err'); o.style.opacity = '1'; setTimeout(() => { o.style.opacity = '0'; }, 650); }
  const s = $('stageSvg'); if(s){ s.classList.remove('stage-ok', 'stage-err'); void s.getBoundingClientRect(); s.classList.add(success ? 'stage-ok' : 'stage-err'); setTimeout(() => s.classList.remove('stage-ok', 'stage-err'), 900); }
}
let timelineToken = 0;
function playTimeline(bindings, frames, stepMs, onDone, onFrame){
  const token = ++timelineToken;
  if(!frames || !frames.length){ if(onDone) onDone(); return; }
  let i = 0;
  (function step(){
    if(token !== timelineToken) return;
    if(i >= frames.length){ setTimeout(() => { if(token === timelineToken) setFrameLabel(''); }, 1600); if(onDone) onDone(); return; }
    applyFrame(bindings, frames[i].env, frames[i].label);
    if(onFrame) onFrame(i);
    i++;
    setTimeout(step, frames[i - 1].ms || stepMs);
  })();
}
function stopTimeline(){ timelineToken++; }
function onEvent(fn){ listeners.push(fn); }
if(typeof document !== 'undefined') setTimeout(() => { placeTrain(); setSignal('sw-sigA', false); setSignal('sw-sigB', false); }, 0);

root.SceneEngine = { STAGE_SVG, applyFrame, playTimeline, stopTimeline, reset, hardReset, showFault, flashResult, setFrameLabel,
  onEvent, MON_META, CHANNELS: Object.keys(DEFAULTS) };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SceneEngine;
})(typeof window !== 'undefined' ? window : globalThis);
