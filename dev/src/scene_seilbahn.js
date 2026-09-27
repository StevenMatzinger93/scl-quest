(function(root){
"use strict";
/* ============================================================
   SZENE: Seilbahn-Bergstation „Gratbahn“ (KOP Quest), 2D-SVG
   Gleiche Schnittstelle wie die Roboterzelle (SceneEngine):
   STAGE_SVG, applyFrame, playTimeline, stopTimeline, reset,
   hardReset, showFault, flashResult, setFrameLabel, onEvent.
   Kanäle: motorOn, motorDir (TRUE = bergwärts), brake, doorOpen,
   gateOpen, personWaiting, lightRed/Yellow/Green, hornActive,
   faultActive, emergencyLamp, windWarn, windSpeed, cabinInStation,
   chainDoor, chainRope, chainStop, chainWind, lightsOn,
   displayValue, displayLabel, displayText, passengers
   ============================================================ */
const DEFAULTS = {
  motorOn:false, motorDir:true, brake:false, doorOpen:false, gateOpen:false, personWaiting:false,
  lightRed:false, lightYellow:false, lightGreen:false, hornActive:false, faultActive:false, emergencyLamp:false,
  windWarn:false, windSpeed:null, cabinInStation:false, chainDoor:null, chainRope:null, chainStop:null, chainWind:null,
  lightsOn:false, displayValue:null, displayLabel:'', displayText:'', passengers:null
};
const MON_META = {
  motorOn:{icon:'fa-gear', label:'Antrieb'}, motorDir:{icon:'fa-arrows-up-down', label:'Richtung'}, brake:{icon:'fa-circle-stop', label:'Bremse'},
  doorOpen:{icon:'fa-door-open', label:'Kabinentür'}, gateOpen:{icon:'fa-person-walking', label:'Zugangssperre'}, personWaiting:{icon:'fa-user', label:'Fahrgast'},
  lightRed:{icon:'fa-lightbulb', label:'Ampel Rot'}, lightYellow:{icon:'fa-lightbulb', label:'Ampel Gelb'}, lightGreen:{icon:'fa-lightbulb', label:'Ampel Grün'},
  hornActive:{icon:'fa-bullhorn', label:'Hupe'}, faultActive:{icon:'fa-triangle-exclamation', label:'Störung'}, emergencyLamp:{icon:'fa-hand', label:'Not-Halt'},
  windWarn:{icon:'fa-wind', label:'Windwarnung'}, windSpeed:{icon:'fa-gauge', label:'Wind km/h'}, cabinInStation:{icon:'fa-cable-car', label:'Kabine in Station'},
  chainDoor:{icon:'fa-link', label:'Kette Türen'}, chainRope:{icon:'fa-link', label:'Kette Seil'}, chainStop:{icon:'fa-link', label:'Kette Not-Halt'}, chainWind:{icon:'fa-link', label:'Kette Wind'},
  lightsOn:{icon:'fa-sun', label:'Beleuchtung'}, displayValue:{icon:'fa-display', label:'Anzeige'}, displayText:{icon:'fa-message', label:'HMI-Text'}, passengers:{icon:'fa-users', label:'Fahrgäste'}
};
const PULSE_TARGET = {
  motorOn:'sb-wheel', motorDir:'sb-dir', brake:'sb-brake', doorOpen:'sb-cabin0', gateOpen:'sb-gate', personWaiting:'sb-person',
  lightRed:'sb-lamp-red', lightYellow:'sb-lamp-yellow', lightGreen:'sb-lamp-green', hornActive:'sb-horn', faultActive:'sb-fault',
  emergencyLamp:'sb-estop', windWarn:'sb-windlamp', windSpeed:'sb-anemo', cabinInStation:'sb-sensor', chainDoor:'sb-chain', chainRope:'sb-chain', chainStop:'sb-chain', chainWind:'sb-chain',
  lightsOn:'sb-lights', displayValue:'sb-hmi', displayLabel:'sb-hmi', displayText:'sb-hmi', passengers:'sb-count'
};

/* ---------- Bühne ---------- */
const P0 = { x:96, y:150 }, P1 = { x:392, y:22 };            // Seil: Station → Gipfel
const lerp = (a, b, t) => a + (b - a) * t;
function cabinSVG(id, extra){
  return '<g id="' + id + '" class="sb-cabin"' + (extra || '') + '><line x1="0" y1="-26" x2="0" y2="-12" class="sb-hanger"/><circle cx="0" cy="-27" r="3" class="sb-grip"/>' +
    '<rect x="-15" y="-12" width="30" height="26" rx="6" class="sb-cabbody"/><rect x="-11" y="-8" width="22" height="9" rx="2" class="sb-cabwin"/>' +
    '<rect class="sb-door sb-door-l" x="-7" y="2" width="7" height="11"/><rect class="sb-door sb-door-r" x="0" y="2" width="7" height="11"/></g>';
}
const STAGE_SVG = `
<svg id="stageSvg" class="sb-stage" viewBox="0 0 400 250" role="img" aria-label="Seilbahn-Bergstation">
 <defs>
  <linearGradient id="sbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1a2b"/><stop offset="1" stop-color="#1d3346"/></linearGradient>
  <linearGradient id="sbMtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3f52"/><stop offset="1" stop-color="#16222e"/></linearGradient>
 </defs>
 <rect width="400" height="250" fill="url(#sbSky)"/>
 <g class="sb-stars">${Array.from({ length: 22 }, (_, i) => '<circle cx="' + ((i * 83) % 400) + '" cy="' + ((i * 37) % 90) + '" r="' + (i % 3 ? .7 : 1.1) + '"/>').join('')}</g>
 <path d="M0 170 L60 120 L110 150 L170 70 L230 130 L290 40 L340 95 L400 20 L400 250 L0 250Z" fill="url(#sbMtn)"/>
 <path d="M162 80 L170 70 L178 80 L172 78 Z M284 50 L290 40 L297 52 L290 49Z M394 28 L400 20 L400 30Z" fill="#dfe8f0" opacity=".75"/>
 <!-- Stütze mit Windmesser -->
 <g id="sb-tower"><path d="M268 205 L278 76 L288 205 Z" class="sb-steel"/><line x1="262" y1="80" x2="296" y2="80" class="sb-steelbar"/>
  <g id="sb-anemo" transform="translate(278 64)"><line x1="0" y1="12" x2="0" y2="0" class="sb-steelbar"/><g id="sb-anemo-rot"><circle cx="0" cy="0" r="2.4" class="sb-hub"/>
   <path d="M0 0 L9 -3 M0 0 L-6 -7 M0 0 L-3 8" class="sb-cups"/><circle cx="9" cy="-3" r="2.2" class="sb-cup"/><circle cx="-6" cy="-7" r="2.2" class="sb-cup"/><circle cx="-3" cy="8" r="2.2" class="sb-cup"/></g>
   <text id="sb-wind-txt" x="0" y="-12" text-anchor="middle" class="sb-small">-- km/h</text></g>
  <circle id="sb-windlamp" cx="298" cy="92" r="4" class="sb-lamp sb-lamp-y"/></g>
 <!-- Seil -->
 <line x1="${P0.x}" y1="${P0.y - 38}" x2="${P1.x}" y2="${P1.y}" class="sb-rope"/>
 <line x1="${P0.x}" y1="${P0.y - 30}" x2="${P1.x}" y2="${P1.y + 12}" class="sb-rope sb-rope2"/>
 ${cabinSVG('sb-cab1', ' style="opacity:1"')}${cabinSVG('sb-cab2', ' style="opacity:1"')}
 <!-- Station -->
 <g id="sb-station">
  <rect x="6" y="104" width="128" height="104" rx="4" class="sb-house"/>
  <path d="M0 108 L70 78 L140 108 Z" class="sb-roof"/>
  <text x="70" y="98" text-anchor="middle" class="sb-sign">GRATBAHN</text>
  <g id="sb-lights"><circle cx="30" cy="112" r="3" class="sb-bulb"/><circle cx="70" cy="112" r="3" class="sb-bulb"/><circle cx="110" cy="112" r="3" class="sb-bulb"/></g>
  <!-- Antriebsrad -->
  <g id="sb-wheel" transform="translate(96 124)"><g id="sb-wheel-rot"><circle r="15" class="sb-wheelrim"/><path d="M-15 0 H15 M0 -15 V15 M-10.6 -10.6 L10.6 10.6 M10.6 -10.6 L-10.6 10.6" class="sb-spokes"/><circle r="3" class="sb-hub"/></g>
   <text id="sb-dir" x="0" y="-19" text-anchor="middle" class="sb-small">▲ Berg</text></g>
  <rect id="sb-brake" x="110" y="118" width="7" height="13" rx="1.5" class="sb-brake"/>
  <!-- Bahnsteig, Kabine in der Station -->
  <rect x="14" y="186" width="112" height="6" class="sb-platform"/>
  <g id="sb-cabin0" transform="translate(70 170)">${cabinSVG('sb-cab0in', '')}</g>
  <circle id="sb-sensor" cx="44" cy="180" r="3.5" class="sb-sensor"/>
  <!-- Zugangssperre + Fahrgast -->
  <g id="sb-gate"><rect x="16" y="192" width="6" height="16" class="sb-post"/><rect id="sb-gatebar" x="22" y="196" width="26" height="4" rx="2" class="sb-gatebar"/></g>
  <g id="sb-person" transform="translate(12 196)"><circle cx="0" cy="-8" r="3.5" class="sb-pers"/><path d="M0 -4 V6 M-4 0 H4 M0 6 L-3 12 M0 6 L3 12" class="sb-persl"/></g>
 </g>
 <!-- Ampel, Hupe, Not-Halt -->
 <g id="sb-signal" transform="translate(150 150)"><rect x="-8" y="-4" width="16" height="44" rx="4" class="sb-box"/>
  <circle id="sb-lamp-red" cx="0" cy="6" r="4.5" class="sb-lamp sb-lamp-r"/><circle id="sb-lamp-yellow" cx="0" cy="18" r="4.5" class="sb-lamp sb-lamp-y"/><circle id="sb-lamp-green" cx="0" cy="30" r="4.5" class="sb-lamp sb-lamp-g"/>
  <line x1="0" y1="40" x2="0" y2="56" class="sb-steelbar"/></g>
 <g id="sb-horn" transform="translate(170 150)"><path d="M0 0 L8 -5 L8 7 L0 2 Z" class="sb-hornbody"/><path class="sb-waves" d="M11 -4 Q15 1 11 6 M14 -7 Q20 1 14 9" /></g>
 <g id="sb-estop" transform="translate(174 186)"><rect x="-9" y="-2" width="18" height="16" rx="2" class="sb-box"/><circle cx="0" cy="-3" r="7" class="sb-estopbtn"/><text x="0" y="24" text-anchor="middle" class="sb-small">NOT-HALT</text></g>
 <!-- Sicherheitskette -->
 <g id="sb-chain" transform="translate(206 152)"><rect x="0" y="0" width="58" height="56" rx="4" class="sb-box"/><text x="29" y="10" text-anchor="middle" class="sb-small">SICHERHEIT</text>
  ${['Door','Rope','Stop','Wind'].map((k, i) => '<circle id="sb-ch-' + k + '" cx="10" cy="' + (19 + i * 10) + '" r="3.3" class="sb-chl"/><text x="17" y="' + (22 + i * 10) + '" class="sb-small sb-left">' + ['Türen','Seil','Not-Halt','Wind'][i] + '</text>').join('')}</g>
 <!-- HMI + Zähler -->
 <g id="sb-hmi" transform="translate(300 150)"><rect x="0" y="0" width="94" height="40" rx="4" class="sb-hmibox"/>
  <text id="sb-hmi-label" x="6" y="11" class="sb-small sb-left">ANZEIGE</text><text id="sb-hmi-val" x="88" y="25" text-anchor="end" class="sb-hmival">--</text>
  <text id="sb-hmi-text" x="6" y="35" class="sb-small sb-left sb-hmitext"></text></g>
 <g id="sb-count" transform="translate(300 196)"><rect x="0" y="0" width="94" height="18" rx="3" class="sb-box"/><text x="6" y="12" class="sb-small sb-left">FAHRGÄSTE</text><text id="sb-count-val" x="88" y="12.5" text-anchor="end" class="sb-countval">--</text></g>
 <g id="sb-fault" class="sb-fault"><rect x="140" y="10" width="120" height="22" rx="4"/><text x="200" y="25" text-anchor="middle">⚠ STÖRUNG</text></g>
 <g id="ch-frame-wrap" class="frame-wrap" style="opacity:0"><rect x="8" y="228" width="186" height="16" rx="4" class="frame-bg"/><text id="ch-frame-label" x="14" y="239.5" class="frame-text"></text></g>
 <g id="ch-result-overlay" style="opacity:0;pointer-events:none"><rect id="ch-result-flash" width="400" height="250" class="result-flash-ok"/></g>
</svg>`;

const $ = id => document.getElementById(id);
let monitorRows = {}, monFlashTimers = {}, pulseTimers = {}, lastValues = {};
const listeners = [];
const st = { phase: 0, motor:false, dir:true, raf:0, last:0, docked:true };

/* ---------- Kabinen am Seil (Animation, solange der Antrieb läuft) ---------- */
function placeCabins(){
  [['sb-cab1', 0.18], ['sb-cab2', 0.62]].forEach(([id, off]) => {
    const g = $(id); if(!g) return;
    let u = (st.phase + off) % 1; if(u < 0) u += 1;
    const up = u < 0.5, t = up ? u * 2 : (1 - u) * 2;
    const x = lerp(P0.x + 10, P1.x - 6, t), y = lerp(P0.y - 38, P1.y, t) + (up ? 0 : 8) + 26;
    g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(.8)');
    g.style.opacity = t < 0.04 ? '0' : '1';
  });
}
function tick(ts){
  if(!st.motor){ st.raf = 0; return; }
  const dt = st.last ? Math.min(.1, (ts - st.last) / 1000) : 0; st.last = ts;
  st.phase += (st.dir ? 1 : -1) * dt * 0.06;
  placeCabins();
  const w = $('sb-wheel-rot'); if(w) w.setAttribute('transform', 'rotate(' + ((st.phase * 3600) % 360).toFixed(1) + ')');
  st.raf = requestAnimationFrame(tick);
}
function setMotor(on){
  st.motor = !!on;
  const c0 = $('sb-cabin0'); if(c0) c0.classList.toggle('sb-departed', st.motor);
  if(st.motor && !st.raf && typeof requestAnimationFrame === 'function'){ st.last = 0; st.raf = requestAnimationFrame(tick); }
}

/* ---------- Monitor unter der Bühne ---------- */
function formatMonValue(ch, v){
  const onoff = (a, b, cls) => v ? { text:a, cls: cls || 'on' } : { text:b, cls:'off' };
  switch(ch){
    case 'motorOn': return onoff('LÄUFT', 'STEHT');
    case 'motorDir': return { text: v ? 'BERG ▲' : 'TAL ▼', cls:'num' };
    case 'brake': return v ? { text:'ZU', cls:'on-yellow' } : { text:'OFFEN', cls:'off' };
    case 'doorOpen': return v ? { text:'OFFEN', cls:'on-yellow' } : { text:'ZU', cls:'num' };
    case 'gateOpen': return v ? { text:'OFFEN', cls:'on' } : { text:'ZU', cls:'num' };
    case 'personWaiting': return onoff('WARTET', '—', 'num');
    case 'lightRed': return onoff('AN', 'AUS', 'on-red');
    case 'lightYellow': case 'windWarn': case 'hornActive': return onoff('AN', 'AUS', 'on-yellow');
    case 'lightGreen': case 'lightsOn': return onoff('AN', 'AUS');
    case 'faultActive': return v ? { text:'AKTIV', cls:'err' } : { text:'OK', cls:'off' };
    case 'emergencyLamp': return v ? { text:'GEDRÜCKT', cls:'err' } : { text:'OK', cls:'off' };
    case 'cabinInStation': return onoff('JA', 'NEIN', 'num');
    case 'chainDoor': case 'chainRope': case 'chainStop': case 'chainWind': return v === null || v === undefined ? { text:'—', cls:'off' } : v ? { text:'OK', cls:'on' } : { text:'OFFEN', cls:'err' };
    case 'windSpeed': case 'displayValue': case 'passengers': return (v === null || v === undefined) ? { text:'--', cls:'off' } : { text: String(typeof v === 'number' ? Math.round(v * 10) / 10 : v), cls:'num' };
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
function paint(ch, v){
  const tog = (id, cls, on) => { const e = $(id); if(e) e.classList.toggle(cls, !!on); };
  switch(ch){
    case 'motorOn': setMotor(v); tog('sb-wheel', 'sb-running', v); break;
    case 'motorDir': st.dir = v !== false; { const e = $('sb-dir'); if(e) e.textContent = st.dir ? '▲ Berg' : '▼ Tal'; } break;
    case 'brake': tog('sb-brake', 'sb-brake-on', v); break;
    case 'doorOpen': tog('sb-cabin0', 'sb-open', v); break;
    case 'gateOpen': tog('sb-gate', 'sb-gate-open', v); break;
    case 'personWaiting': tog('sb-person', 'sb-show', v); break;
    case 'lightRed': tog('sb-lamp-red', 'lamp-on', v); break;
    case 'lightYellow': tog('sb-lamp-yellow', 'lamp-on', v); break;
    case 'lightGreen': tog('sb-lamp-green', 'lamp-on', v); break;
    case 'hornActive': tog('sb-horn', 'horn-on', v); break;
    case 'faultActive': tog('sb-fault', 'fault-on', v); tog('stageSvg', 'stage-fault', v); break;
    case 'emergencyLamp': tog('sb-estop', 'sb-estop-on', v); break;
    case 'windWarn': tog('sb-windlamp', 'lamp-on', v); break;
    case 'windSpeed': { const t = $('sb-wind-txt'); if(t) t.textContent = (v === null || v === undefined) ? '-- km/h' : Math.round(Number(v)) + ' km/h';
      const r = $('sb-anemo-rot'); if(r){ const n = Number(v) || 0; r.style.animationDuration = n > 0 ? Math.max(.15, 3 - n / 30) + 's' : '0s'; r.classList.toggle('sb-spin', n > 0); } break; }
    case 'cabinInStation': tog('sb-sensor', 'sb-sensor-on', v); break;
    case 'chainDoor': case 'chainRope': case 'chainStop': case 'chainWind': {
      const e = $('sb-ch-' + ch.slice(5)); if(e){ e.classList.toggle('sb-ok', v === true); e.classList.toggle('sb-bad', v === false); } break; }
    case 'lightsOn': tog('sb-lights', 'sb-lit', v); break;
    case 'displayValue': { const e = $('sb-hmi-val'); if(e){ const t = (v === null || v === undefined) ? '--' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v)); e.textContent = t.slice(0, 8); } break; }
    case 'displayLabel': { const e = $('sb-hmi-label'); if(e) e.textContent = String(v || 'ANZEIGE').slice(0, 14); break; }
    case 'displayText': { const e = $('sb-hmi-text'); if(e){ const t = String(v == null ? '' : v); e.textContent = t.slice(0, 20); } break; }
    case 'passengers': { const e = $('sb-count-val'); if(e) e.textContent = (v === null || v === undefined) ? '--' : String(v); break; }
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
    if(v === null || typeof v !== 'object') return undefined;
    if(Object.prototype.hasOwnProperty.call(v, p)){ v = v[p]; continue; }
    const k = Object.keys(v).find(x => x.toLowerCase() === p.toLowerCase()); if(k === undefined) return undefined; v = v[k];
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
  st.phase = 0; placeCabins();
  buildMonitor(bindings || []); highlightActive(bindings || []);
  applyFrame(bindings || [], initialVars || {}, '', { silent:true });
  setChannel('faultActive', !!(bound.faultActive && lastValues.faultActive), { silent:true });
  setChannel('hornActive', false, { silent:true });
  const o = $('ch-result-overlay'); if(o) o.style.opacity = '0';
}
function hardReset(){
  Object.keys(DEFAULTS).forEach(ch => setChannel(ch, DEFAULTS[ch], { silent:true }));
  lastValues = {}; st.phase = 0; placeCabins();
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
if(typeof document !== 'undefined') setTimeout(placeCabins, 0);

root.SceneEngine = { STAGE_SVG, applyFrame, playTimeline, stopTimeline, reset, hardReset, showFault, flashResult, setFrameLabel,
  onEvent, MON_META, CHANNELS: Object.keys(DEFAULTS) };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SceneEngine;
})(typeof window !== 'undefined' ? window : globalThis);
