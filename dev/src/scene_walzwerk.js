(function(root){
"use strict";
/* ============================================================
   SZENE: Altes Walzwerk im Keller (AWL Quest), 2D-SVG
   Gleiche Schnittstelle wie die anderen Szenen (SceneEngine).
   Kanäle: furnaceOn, furnaceDoor, furnaceTemp, conveyorRunning, conveyorReverse,
   billetVisible, billetPos (0…100), rollsRunning, rollGap (mm), shearDown, coolingOn,
   pumpRunning, pressure (bar), lightRed/Yellow/Green, hornActive, faultActive,
   displayValue, displayLabel, displayText, pieceCount, plcRun, plcFault
   ============================================================ */
const DEFAULTS = {
  furnaceOn:false, furnaceDoor:false, furnaceTemp:null, conveyorRunning:false, conveyorReverse:false, billetVisible:true, billetPos:null,
  rollsRunning:false, rollGap:null, shearDown:false, coolingOn:false, pumpRunning:false, pressure:null,
  lightRed:false, lightYellow:false, lightGreen:false, hornActive:false, faultActive:false,
  displayValue:null, displayLabel:'', displayText:'', pieceCount:null, plcRun:true, plcFault:false
};
const MON_META = {
  furnaceOn:{icon:'fa-fire', label:'Ofen heizt'}, furnaceDoor:{icon:'fa-door-open', label:'Ofentür'}, furnaceTemp:{icon:'fa-temperature-high', label:'Ofen °C'},
  conveyorRunning:{icon:'fa-arrows-left-right', label:'Rollgang'}, conveyorReverse:{icon:'fa-arrow-left', label:'Rückwärts'},
  billetVisible:{icon:'fa-cube', label:'Walzblock'}, billetPos:{icon:'fa-ruler-horizontal', label:'Blockposition'},
  rollsRunning:{icon:'fa-gear', label:'Walzgerüst'}, rollGap:{icon:'fa-arrows-up-down', label:'Walzspalt mm'}, shearDown:{icon:'fa-scissors', label:'Schere'},
  coolingOn:{icon:'fa-droplet', label:'Kühlwasser'}, pumpRunning:{icon:'fa-oil-can', label:'Hydraulikpumpe'}, pressure:{icon:'fa-gauge-high', label:'Druck bar'},
  lightRed:{icon:'fa-lightbulb', label:'Lampe Rot'}, lightYellow:{icon:'fa-lightbulb', label:'Lampe Gelb'}, lightGreen:{icon:'fa-lightbulb', label:'Lampe Grün'},
  hornActive:{icon:'fa-bullhorn', label:'Hupe'}, faultActive:{icon:'fa-triangle-exclamation', label:'Störung'},
  displayValue:{icon:'fa-display', label:'Anzeige'}, displayText:{icon:'fa-message', label:'Anzeigetext'}, pieceCount:{icon:'fa-layer-group', label:'Stückzahl'},
  plcRun:{icon:'fa-microchip', label:'S7 RUN'}, plcFault:{icon:'fa-microchip', label:'S7 SF'}
};
const PULSE_TARGET = {
  furnaceOn:'ww-furnace', furnaceDoor:'ww-furnace', furnaceTemp:'ww-furnace', conveyorRunning:'ww-conv', conveyorReverse:'ww-conv', billetVisible:'ww-billet', billetPos:'ww-billet',
  rollsRunning:'ww-stand', rollGap:'ww-stand', shearDown:'ww-shear', coolingOn:'ww-water', pumpRunning:'ww-pump', pressure:'ww-pump',
  lightRed:'ww-l-red', lightYellow:'ww-l-yellow', lightGreen:'ww-l-green', hornActive:'ww-horn', faultActive:'ww-fault',
  displayValue:'ww-disp', displayLabel:'ww-disp', displayText:'ww-disp', pieceCount:'ww-count', plcRun:'ww-plc', plcFault:'ww-plc'
};
const X0 = 96, X1 = 384;   // Rollgang
const lamp = (id, cx, cy, cls) => '<circle id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="3.6" class="ww-lamp ' + cls + '"/>';
const rollers = Array.from({ length: 19 }, (_, i) => '<circle cx="' + (X0 + 8 + i * 15.5) + '" cy="152" r="4" class="ww-roller"/><line x1="' + (X0 + 8 + i * 15.5) + '" y1="148.5" x2="' + (X0 + 8 + i * 15.5) + '" y2="155.5" class="ww-spoke"/>').join('');
const STAGE_SVG = `
<svg id="stageSvg" class="ww-stage" viewBox="0 0 400 250" role="img" aria-label="Walzwerk im Keller">
 <defs>
  <linearGradient id="wwBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16110d"/><stop offset="1" stop-color="#231a13"/></linearGradient>
  <linearGradient id="wwHot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a2e"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient>
 </defs>
 <rect width="400" height="250" fill="url(#wwBg)"/>
 <g class="ww-bricks">${Array.from({ length: 8 }, (_, r) => Array.from({ length: 11 }, (_, c) => '<rect x="' + (c * 38 - (r % 2) * 19) + '" y="' + (r * 12) + '" width="36" height="10" rx="1"/>').join('')).join('')}</g>
 <text x="200" y="20" text-anchor="middle" class="ww-title">WALZWERK · KELLER 2</text>
 <!-- S7-300 Rack -->
 <g id="ww-plc" transform="translate(300 28)"><rect width="92" height="46" rx="3" class="ww-rack"/>
  <rect x="4" y="5" width="20" height="36" rx="1.5" class="ww-psu"/><text x="14" y="38" text-anchor="middle" class="ww-tiny">PS</text>
  <rect x="26" y="5" width="22" height="36" rx="1.5" class="ww-cpu"/><text x="37" y="38" text-anchor="middle" class="ww-tiny">CPU</text>
  <circle id="ww-led-sf" cx="31" cy="11" r="1.8" class="ww-led ww-led-r"/><circle id="ww-led-run" cx="31" cy="17" r="1.8" class="ww-led ww-led-g"/><circle id="ww-led-stop" cx="31" cy="23" r="1.8" class="ww-led ww-led-y"/>
  <text x="41" y="12.5" class="ww-tiny2">SF</text><text x="41" y="18.5" class="ww-tiny2">RUN</text><text x="41" y="24.5" class="ww-tiny2">STOP</text>
  <rect x="50" y="5" width="12" height="36" rx="1.5" class="ww-sm"/><rect x="64" y="5" width="12" height="36" rx="1.5" class="ww-sm"/><rect x="78" y="5" width="10" height="36" rx="1.5" class="ww-sm"/>
  <text x="46" y="-3" text-anchor="middle" class="ww-small">S7-300</text></g>
 <!-- Stossofen -->
 <g id="ww-furnace" transform="translate(10 96)"><rect width="84" height="72" rx="4" class="ww-oven"/><rect x="6" y="6" width="72" height="8" class="ww-ovenband"/>
  <g id="ww-flames" class="ww-flames"><path d="M16 60 Q20 44 24 60 Q28 40 34 60 Q38 46 42 60 Q48 38 54 60 Q58 46 62 60 Q66 44 70 60Z"/></g>
  <rect id="ww-door" x="70" y="30" width="14" height="36" rx="1" class="ww-door"/>
  <text x="42" y="26" text-anchor="middle" class="ww-small">STOSSOFEN</text><text id="ww-temp" x="42" y="40" text-anchor="middle" class="ww-temp">--°C</text></g>
 <!-- Rollgang -->
 <g id="ww-conv"><rect x="${X0}" y="156" width="${X1 - X0}" height="6" class="ww-bed"/>${rollers}<path id="ww-arrow" d="" class="ww-arrow"/></g>
 <!-- Wasser (Kühlung) -->
 <g id="ww-water" class="ww-water" transform="translate(262 108)"><rect x="-8" y="-6" width="16" height="6" rx="1.5" class="ww-pipe"/><path d="M-6 2 L-9 30 M0 2 L0 32 M6 2 L9 30" class="ww-spray"/><text x="0" y="-9" text-anchor="middle" class="ww-small">WASSER</text></g>
 <!-- Walzgerüst -->
 <g id="ww-stand" transform="translate(212 150)"><rect x="-20" y="-62" width="6" height="74" class="ww-post"/><rect x="14" y="-62" width="6" height="74" class="ww-post"/><rect x="-20" y="-66" width="40" height="6" class="ww-post"/>
  <g id="ww-roll-top" transform="translate(0 -18)"><circle r="11" class="ww-roll"/><path d="M-8 0 L8 0 M0 -8 L0 8" class="ww-rollmark"/></g>
  <g transform="translate(0 13)"><circle r="11" class="ww-roll"/><g id="ww-roll-bot-mark"><path d="M-8 0 L8 0 M0 -8 L0 8" class="ww-rollmark"/></g></g>
  <text x="0" y="-72" text-anchor="middle" class="ww-small">GERÜST</text><text id="ww-gap" x="0" y="36" text-anchor="middle" class="ww-gap">-- mm</text></g>
 <!-- Schere -->
 <g id="ww-shear" transform="translate(318 150)"><rect x="-12" y="-54" width="24" height="10" rx="2" class="ww-post"/><g id="ww-blade" transform="translate(0 -44)"><path d="M-6 0 L6 0 L6 16 L0 22 L-6 16Z" class="ww-bladeb"/></g><text x="0" y="-58" text-anchor="middle" class="ww-small">SCHERE</text></g>
 <!-- Walzblock -->
 <g id="ww-billet" transform="translate(120 142)"><rect x="-14" y="-7" width="28" height="9" rx="2" class="ww-billetb"/></g>
 <!-- Hydraulik -->
 <g id="ww-pump" transform="translate(116 40)"><rect width="66" height="34" rx="3" class="ww-box"/><circle cx="14" cy="17" r="9" class="ww-pumpc"/><path id="ww-pump-rot" d="M14 10 L14 24 M7 17 L21 17" class="ww-rollmark"/>
  <text x="44" y="12" text-anchor="middle" class="ww-small">HYDRAULIK</text><text id="ww-press" x="44" y="27" text-anchor="middle" class="ww-countval">-- bar</text></g>
 <!-- Leitstand -->
 <g id="ww-desk" transform="translate(8 196)"><rect width="384" height="48" rx="5" class="ww-deskbox"/><text x="8" y="12" class="ww-small ww-left">LEITSTAND</text>
  <g transform="translate(14 28)">${lamp('ww-l-red', 0, 0, 'ww-r')}${lamp('ww-l-yellow', 12, 0, 'ww-y')}${lamp('ww-l-green', 24, 0, 'ww-g')}</g>
  <g id="ww-horn" transform="translate(56 26)"><path d="M0 0 L7 -4 L7 6 L0 2 Z" class="ww-hornbody"/><path class="ww-waves" d="M10 -3 Q13 1 10 5"/></g>
  <g id="ww-disp" transform="translate(84 6)"><rect width="160" height="36" rx="3" class="ww-dispbox"/><text id="ww-disp-label" x="6" y="11" class="ww-small ww-left">ANZEIGE</text><text id="ww-disp-val" x="154" y="24" text-anchor="end" class="ww-dispval">--</text><text id="ww-disp-text" x="6" y="31" class="ww-small ww-left ww-disptext"></text></g>
  <g id="ww-count" transform="translate(252 6)"><rect width="124" height="36" rx="3" class="ww-box"/><text x="6" y="12" class="ww-small ww-left">STÜCK</text><text id="ww-count-val" x="118" y="28" text-anchor="end" class="ww-dispval">--</text></g>
 </g>
 <g id="ww-fault" class="ww-fault"><rect x="140" y="26" width="120" height="20" rx="4"/><text x="200" y="40" text-anchor="middle">⚠ STÖRUNG</text></g>
 <g id="ch-frame-wrap" class="frame-wrap" style="opacity:0"><rect x="8" y="176" width="186" height="16" rx="4" class="frame-bg"/><text id="ch-frame-label" x="14" y="187.5" class="frame-text"></text></g>
 <g id="ch-result-overlay" style="opacity:0;pointer-events:none"><rect id="ch-result-flash" width="400" height="250" class="result-flash-ok"/></g>
</svg>`;

const $ = id => document.getElementById(id);
let monitorRows = {}, monFlashTimers = {}, pulseTimers = {}, lastValues = {};
const listeners = [];
const st = { pos:0.1, raf:0, last:0, rot:0, dir:1 };

/* ---------- Animation: Block auf dem Rollgang, Walzen ---------- */
function placeBillet(){
  const g = $('ww-billet'); if(!g) return;
  const bound = lastValues.billetPos !== null && lastValues.billetPos !== undefined;
  const p = bound ? Math.max(0, Math.min(100, Number(lastValues.billetPos) || 0)) / 100 : st.pos;
  const x = X0 + 16 + p * (X1 - X0 - 32), thin = x > 212 ? .65 : 1;
  g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' 142) scale(1 ' + thin + ')');
}
function animating(){ return lastValues.conveyorRunning || lastValues.rollsRunning || lastValues.pumpRunning; }
function tick(ts){
  if(!animating()){ st.raf = 0; st.last = 0; return; }
  const dt = st.last ? Math.min(.1, (ts - st.last) / 1000) : 0; st.last = ts;
  const bound = lastValues.billetPos !== null && lastValues.billetPos !== undefined;
  if(lastValues.conveyorRunning && !bound){ st.pos += dt * .12 * (lastValues.conveyorReverse ? -1 : 1); if(st.pos > 1) st.pos = 0; if(st.pos < 0) st.pos = 1; placeBillet(); }
  if(lastValues.rollsRunning){ st.rot = (st.rot + dt * 360) % 360; const a = $('ww-roll-top'), b = $('ww-roll-bot-mark'); if(a) a.querySelector('path').setAttribute('transform', 'rotate(' + st.rot.toFixed(0) + ')'); if(b) b.setAttribute('transform', 'rotate(' + (-st.rot).toFixed(0) + ')'); }
  if(lastValues.pumpRunning){ const p = $('ww-pump-rot'); if(p) p.setAttribute('transform', 'rotate(' + ((ts / 4) % 360).toFixed(0) + ' 14 17)'); }
  st.raf = requestAnimationFrame(tick);
}
function kick(){ if(animating() && !st.raf && typeof requestAnimationFrame === 'function'){ st.last = 0; st.raf = requestAnimationFrame(tick); } }
function drawArrow(){
  const a = $('ww-arrow'); if(!a) return;
  if(!lastValues.conveyorRunning){ a.setAttribute('d', ''); return; }
  a.setAttribute('d', lastValues.conveyorReverse ? 'M170 172 L130 172 M138 167 L130 172 L138 177' : 'M130 172 L170 172 M162 167 L170 172 L162 177');
}

/* ---------- Monitor ---------- */
function formatMonValue(ch, v){
  const onoff = (a, b, cls) => v ? { text:a, cls: cls || 'on' } : { text:b, cls:'off' };
  const num = (u) => (v === null || v === undefined) ? { text:'--', cls:'off' } : { text: String(typeof v === 'number' ? Math.round(v * 10) / 10 : v) + (u || ''), cls:'num' };
  switch(ch){
    case 'furnaceOn': return onoff('HEIZT', 'AUS', 'on-yellow');
    case 'furnaceDoor': return v ? { text:'OFFEN', cls:'on-yellow' } : { text:'ZU', cls:'num' };
    case 'conveyorRunning': case 'rollsRunning': case 'pumpRunning': return onoff('LÄUFT', 'STEHT');
    case 'conveyorReverse': return onoff('RÜCKWÄRTS', 'VORWÄRTS', 'on-yellow');
    case 'billetVisible': return onoff('DA', '—', 'num');
    case 'shearDown': return onoff('SCHNEIDET', 'OBEN', 'on-yellow');
    case 'coolingOn': case 'hornActive': case 'lightYellow': return onoff('AN', 'AUS', 'on-yellow');
    case 'lightRed': return onoff('AN', 'AUS', 'on-red');
    case 'lightGreen': return onoff('AN', 'AUS');
    case 'faultActive': return v ? { text:'AKTIV', cls:'err' } : { text:'OK', cls:'off' };
    case 'plcRun': return v ? { text:'RUN', cls:'on' } : { text:'STOP', cls:'on-yellow' };
    case 'plcFault': return v ? { text:'SF', cls:'err' } : { text:'OK', cls:'off' };
    case 'furnaceTemp': return num('°C');
    case 'rollGap': return num(' mm');
    case 'pressure': return num(' bar');
    case 'billetPos': return num(' %');
    case 'displayValue': case 'pieceCount': return num('');
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
  const txt = (id, t) => { const e = $(id); if(e) e.textContent = t; };
  const n = (x, d) => (x === null || x === undefined) ? '--' : String(Math.round(Number(x) * (d || 1)) / (d || 1));
  switch(ch){
    case 'furnaceOn': tog('ww-furnace', 'ww-hot', v); break;
    case 'furnaceDoor': tog('ww-furnace', 'ww-dooropen', v); break;
    case 'furnaceTemp': txt('ww-temp', n(v) + '°C'); tog('ww-furnace', 'ww-glow', Number(v) > 900); break;
    case 'conveyorRunning': case 'conveyorReverse': tog('ww-conv', 'ww-moving', lastValues.conveyorRunning); drawArrow(); kick(); break;
    case 'billetVisible': tog('ww-billet', 'ww-hidden', !v); break;
    case 'billetPos': placeBillet(); break;
    case 'rollsRunning': tog('ww-stand', 'ww-moving', v); kick(); break;
    case 'rollGap': { txt('ww-gap', n(v, 10) + ' mm'); const g = (v === null || v === undefined) ? 4 : Math.max(0, Math.min(20, Number(v))); const e = $('ww-roll-top'); if(e) e.setAttribute('transform', 'translate(0 ' + (-14 - g * .5).toFixed(1) + ')'); break; }
    case 'shearDown': { const e = $('ww-blade'); if(e) e.setAttribute('transform', 'translate(0 ' + (v ? -24 : -44) + ')'); tog('ww-shear', 'ww-cut', v); break; }
    case 'coolingOn': tog('ww-water', 'ww-on', v); break;
    case 'pumpRunning': tog('ww-pump', 'ww-moving', v); kick(); break;
    case 'pressure': txt('ww-press', n(v, 10) + ' bar'); break;
    case 'lightRed': tog('ww-l-red', 'lamp-on', v); break;
    case 'lightYellow': tog('ww-l-yellow', 'lamp-on', v); break;
    case 'lightGreen': tog('ww-l-green', 'lamp-on', v); break;
    case 'hornActive': tog('ww-horn', 'horn-on', v); break;
    case 'faultActive': tog('ww-fault', 'fault-on', v); tog('stageSvg', 'stage-fault', v); break;
    case 'displayValue': { const t = (v === null || v === undefined) ? '--' : (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v)); txt('ww-disp-val', t.slice(0, 10)); break; }
    case 'displayLabel': txt('ww-disp-label', String(v || 'ANZEIGE').slice(0, 22)); break;
    case 'displayText': txt('ww-disp-text', String(v == null ? '' : v).slice(0, 28)); break;
    case 'pieceCount': txt('ww-count-val', n(v)); break;
    case 'plcRun': tog('ww-led-run', 'lamp-on', v); tog('ww-led-stop', 'lamp-on', !v); break;
    case 'plcFault': tog('ww-led-sf', 'lamp-on', v); break;
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
  st.pos = 0.08; placeBillet();
  buildMonitor(bindings || []); highlightActive(bindings || []);
  applyFrame(bindings || [], initialVars || {}, '', { silent:true });
  setChannel('faultActive', !!(bound.faultActive && lastValues.faultActive), { silent:true });
  setChannel('hornActive', false, { silent:true });
  const o = $('ch-result-overlay'); if(o) o.style.opacity = '0';
}
function hardReset(){
  Object.keys(DEFAULTS).forEach(ch => setChannel(ch, DEFAULTS[ch], { silent:true }));
  lastValues = {}; st.pos = 0.08; placeBillet();
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
if(typeof document !== 'undefined') setTimeout(() => { placeBillet(); paint('plcRun', true); }, 0);

root.SceneEngine = { STAGE_SVG, applyFrame, playTimeline, stopTimeline, reset, hardReset, showFault, flashResult, setFrameLabel,
  onEvent, MON_META, CHANNELS: Object.keys(DEFAULTS) };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SceneEngine;
})(typeof window !== 'undefined' ? window : globalThis);
