(function(root){
"use strict";
/* ============================================================
   SCENE 2D — Live-Anlage als SVG-Schema (Portal-Schwenkarm)
   ------------------------------------------------------------
   Geometrie (viewBox 480×265):
     Drehpunkt des Arms P = (200, 56), Abstand Drehpunkt→Teilmitte R = 108
     0°  → Greifstation auf dem Band (Teil bei 200/164)
     +90° → Ablage LAGER (links, 92/56)   −90° → NACHARBEIT (rechts, 308/56)
   Kanäle werden von ECHTER Programmausführung gesetzt (applyFrame).
   Kanäle, die eine Aufgabe nicht bindet, behalten ihren Zustand.
   Teile-Logik (gemeinsam für 2D und 3D):
     Greifer schliesst über der Station (|Winkel| ≤ 10°) → Teil gegriffen
     Greifer öffnet über der Station → Teil bleibt liegen
     Greifer öffnet anderswo → Teil abgelegt (Ablage ±90° oder fällt)
     → ein neues Teil rückt an der Station nach.
   ============================================================ */
const PIV = { x:200, y:56 }, R = 108, STATION_TOL = 10, SHELF_TOL = 15;

const STAGE_SVG = `
<svg viewBox="0 0 480 265" id="stageSvg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schema der Roboterzelle">
  <defs>
    <linearGradient id="sgWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13140c"/><stop offset=".75" stop-color="#0d0e08"/><stop offset="1" stop-color="#090a05"/></linearGradient>
    <linearGradient id="sgFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1e13"/><stop offset="1" stop-color="#0e0f08"/></linearGradient>
    <linearGradient id="sgSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3c30"/><stop offset=".5" stop-color="#2a2b21"/><stop offset="1" stop-color="#1b1c14"/></linearGradient>
    <linearGradient id="sgBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43453a"/><stop offset=".5" stop-color="#2c2d23"/><stop offset="1" stop-color="#1c1d15"/></linearGradient>
    <linearGradient id="sgArm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset=".45" stop-color="#e07f00"/><stop offset="1" stop-color="#8f4f00"/></linearGradient>
    <linearGradient id="sgBeltFrame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#303126"/><stop offset="1" stop-color="#15160e"/></linearGradient>
    <linearGradient id="sgScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1108"/><stop offset="1" stop-color="#050703"/></linearGradient>
    <linearGradient id="sgShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.35)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></linearGradient>
    <pattern id="sgHazard" width="16" height="7" patternUnits="userSpaceOnUse" patternTransform="skewX(-32)"><rect width="8" height="7" fill="#4a4214"/><rect x="8" width="8" height="7" fill="#171204"/></pattern>
    <radialGradient id="sgLampGlass" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="rgba(255,255,255,.4)"/><stop offset=".35" stop-color="rgba(255,255,255,.05)"/><stop offset="1" stop-color="rgba(0,0,0,.25)"/></radialGradient>
    <clipPath id="beltClip"><rect x="114" y="176" width="266" height="12"/></clipPath>
    <clipPath id="belt2Clip"><rect x="180" y="224" width="142" height="8"/></clipPath>
  </defs>

  <!-- Halle -->
  <rect x="0" y="0" width="480" height="216" fill="url(#sgWall)"/>
  <g class="wall-deco">
    ${[80,160,240,320,400].map(x=>'<line x1="'+x+'" y1="0" x2="'+x+'" y2="208" class="wall-seam"/>').join('')}
    <rect x="0" y="112" width="480" height="3" class="wall-rail"/>
    <text x="232" y="110" text-anchor="middle" class="wall-text">SEKTOR&#160;7</text>
  </g>
  <rect x="0" y="209" width="480" height="7" fill="url(#sgHazard)" class="floor-hazard"/>
  <rect x="0" y="216" width="480" height="49" fill="url(#sgFloor)"/>
  <line x1="0" y1="232" x2="480" y2="232" class="floor-line"/><line x1="0" y1="248" x2="480" y2="248" class="floor-line"/>

  <!-- ARIA-Kamera -->
  <g id="sg-aria" transform="translate(410,24)">
    <rect x="-2" y="-14" width="4" height="8" class="cam-mount"/>
    <rect x="-15" y="-7" width="30" height="15" rx="4" class="cam-body"/>
    <circle cx="0" cy="0.5" r="5.2" class="cam-lens"/><circle cx="0" cy="0.5" r="2.1" class="cam-eye"/>
    <text x="0" y="19" text-anchor="middle" class="stage-label-sm cam-label">ARIA-01</text>
  </g>

  <!-- Ablagen (Wandregale hinter der Schwenkebene) -->
  <g id="ch-shelf-lager" transform="translate(92,56)">
    <rect x="-24" y="-8" width="48" height="26" rx="3" class="shelf-back"/>
    <path d="M -22 4 L -22 16 L 22 16 L 22 4" class="shelf-tray"/>
    <text x="0" y="31" text-anchor="middle" class="shelf-label">LAGER +90°</text>
    <text id="ch-shelf-lager-n" x="31" y="10" text-anchor="middle" class="shelf-count">0</text>
  </g>
  <g id="ch-shelf-nach" transform="translate(308,56)">
    <rect x="-24" y="-8" width="48" height="26" rx="3" class="shelf-back"/>
    <path d="M -22 4 L -22 16 L 22 16 L 22 4" class="shelf-tray"/>
    <text x="0" y="31" text-anchor="middle" class="shelf-label">NACHARB. −90°</text>
    <text id="ch-shelf-nach-n" x="-31" y="10" text-anchor="middle" class="shelf-count">0</text>
  </g>

  <!-- Portal -->
  <rect x="38" y="30" width="10" height="182" fill="url(#sgSteel)" class="portal-col"/>
  <rect x="352" y="30" width="10" height="182" fill="url(#sgSteel)" class="portal-col"/>
  <rect x="32" y="206" width="22" height="6" rx="1" class="portal-foot"/><rect x="346" y="206" width="22" height="6" rx="1" class="portal-foot"/>
  <rect x="30" y="20" width="340" height="14" rx="2" fill="url(#sgBeam)" class="portal-beam"/>
  <text x="120" y="30.5" text-anchor="middle" class="beam-text">PORTAL RZ-03</text>
  <text x="290" y="30.5" text-anchor="middle" class="beam-text">SWL 25 kg</text>

  <!-- Schaltschrank mit Lüfter (links) -->
  <g id="ch-fan-group" transform="translate(4,136)">
    <rect x="0" y="0" width="30" height="70" rx="2" class="cab-body"/>
    <rect x="3" y="3" width="24" height="64" rx="1.5" class="cab-door"/>
    <circle cx="15" cy="20" r="9.5" class="fan-ring"/>
    <g id="ch-fan-rotor" class="fan-rotor"><path d="M15 20 L15 12 A8 8 0 0 1 21 15 Z"/><path d="M15 20 L22 24 A8 8 0 0 1 16 28 Z"/><path d="M15 20 L8 24 A8 8 0 0 1 8 15 Z"/></g>
    <circle cx="15" cy="20" r="1.8" class="fan-hub"/>
    <line x1="7" y1="40" x2="23" y2="40" class="cab-slot"/><line x1="7" y1="45" x2="23" y2="45" class="cab-slot"/><line x1="7" y1="50" x2="23" y2="50" class="cab-slot"/>
    <text x="15" y="64" text-anchor="middle" class="stage-label-sm cab-label">SCHRANK</text>
  </g>

  <!-- Hupe am linken Portalpfosten -->
  <g id="ch-horn-group" transform="translate(48,120)">
    <rect x="0" y="-5" width="6" height="10" class="horn-mount"/>
    <path d="M 6 -4 L 16 -9 L 16 9 L 6 4 Z" class="horn-body"/>
    <g class="horn-waves"><path d="M 20 -7 Q 25 0 20 7"/><path d="M 25 -11 Q 32 0 25 11"/><path d="M 30 -15 Q 39 0 30 15"/></g>
  </g>

  <!-- Störungs-Rundumleuchte auf dem linken Pfosten -->
  <g id="ch-fault-group" transform="translate(43,12)">
    <rect x="-7" y="4" width="14" height="4" rx="1" class="fault-base"/>
    <path d="M -6 4 A 6.5 6.5 0 0 1 6 4 Z" class="fault-dome"/>
    <g class="fault-rays"><line x1="-13" y1="-3" x2="-9" y2="0"/><line x1="13" y1="-3" x2="9" y2="0"/><line x1="0" y1="-10" x2="0" y2="-5"/></g>
  </g>

  <!-- Signalsäule -->
  <g id="ch-tower-group" transform="translate(430,60)">
    <ellipse cx="16" cy="155" rx="18" ry="3.5" class="floor-shadow"/>
    <rect x="13" y="70" width="6" height="82" class="tower-pole"/>
    <rect x="4" y="148" width="24" height="6" rx="2" class="tower-foot"/>
    <rect x="5" y="-6" width="22" height="7" rx="2.5" class="tower-cap"/>
    <rect x="-2" y="0" width="36" height="71" rx="7" class="tower-housing"/>
    <circle id="ch-lamp-red" cx="16" cy="15" r="8.5" class="tower-lamp lamp-red"/><circle cx="16" cy="15" r="8.5" fill="url(#sgLampGlass)" class="lamp-glass"/>
    <circle id="ch-lamp-yellow" cx="16" cy="37" r="8.5" class="tower-lamp lamp-yellow"/><circle cx="16" cy="37" r="8.5" fill="url(#sgLampGlass)" class="lamp-glass"/>
    <circle id="ch-lamp-green" cx="16" cy="59" r="8.5" class="tower-lamp lamp-green"/><circle cx="16" cy="59" r="8.5" fill="url(#sgLampGlass)" class="lamp-glass"/>
    <g class="cb-sym"><text x="16" y="18.5" text-anchor="middle">✕</text><text x="16" y="40.5" text-anchor="middle">!</text><text x="16" y="62.5" text-anchor="middle">✓</text></g>
  </g>

  <!-- HMI-Panel (wandmontiert) -->
  <g id="ch-display-group" transform="translate(395,82)">
    <rect x="-4" y="-26" width="8" height="8" class="cam-mount"/>
    <rect x="-28" y="-19" width="56" height="38" rx="5" class="display-box"/>
    <rect x="-23" y="-14" width="46" height="21" rx="2" fill="url(#sgScreen)" class="display-screen"/>
    <text id="ch-display-text" x="0" y="1" text-anchor="middle" class="display-text">--</text>
    <text id="ch-display-label" x="0" y="14.5" text-anchor="middle" class="display-label">-</text>
    <circle cx="-21" cy="14" r="1.6" class="display-led"/>
  </g>

  <!-- Förderband -->
  <g id="ch-belt-group">
    <ellipse cx="246" cy="216" rx="140" ry="4.5" class="floor-shadow"/>
    <rect x="148" y="196" width="7" height="18" class="belt-leg"/><rect x="342" y="196" width="7" height="18" class="belt-leg"/>
    <rect x="144" y="211" width="15" height="3" class="belt-leg"/><rect x="338" y="211" width="15" height="3" class="belt-leg"/>
    <rect x="110" y="173" width="274" height="23" rx="5" fill="url(#sgBeltFrame)" class="belt-frame"/>
    <rect x="114" y="176" width="266" height="12" class="belt-bed"/>
    <g clip-path="url(#beltClip)"><g id="ch-belt-marks">${Array.from({length:12}).map((_,i)=>'<rect x="'+(96+i*26)+'" y="179" width="11" height="6" rx="2" class="belt-mark"/>').join('')}</g></g>
    <g id="ch-belt-rollers">
      <g class="roller" transform="translate(122,184.5)"><circle r="6.5" class="roller-wheel"/><line x1="-4.5" y1="0" x2="4.5" y2="0" class="roller-spoke"/><line x1="0" y1="-4.5" x2="0" y2="4.5" class="roller-spoke"/></g>
      <g class="roller" transform="translate(372,184.5)"><circle r="6.5" class="roller-wheel"/><line x1="-4.5" y1="0" x2="4.5" y2="0" class="roller-spoke"/><line x1="0" y1="-4.5" x2="0" y2="4.5" class="roller-spoke"/></g>
    </g>
    <!-- Stopper hält das Teil an der Greifstation -->
    <rect x="214" y="165" width="4" height="9" rx="1" class="stopper"/>
    <text x="200" y="206" text-anchor="middle" class="stage-label-sm">GREIFSTATION</text>
  </g>

  <!-- Störungs-LED Band 1 -->
  <circle id="ch-mf1" cx="118" cy="191" r="3" class="mfault-led"/>

  <!-- Zuführband 2 (vorne) -->
  <g id="ch-belt2-group">
    <rect x="176" y="221" width="150" height="14" rx="4" fill="url(#sgBeltFrame)" class="belt-frame"/>
    <rect x="180" y="224" width="142" height="8" class="belt-bed"/>
    <g clip-path="url(#belt2Clip)"><g id="ch-belt2-marks">${Array.from({length:8}).map((_,i)=>'<rect x="'+(170+i*22)+'" y="225.5" width="9" height="5" rx="2" class="belt-mark"/>').join('')}</g></g>
    <circle id="ch-mf2" cx="184" cy="239" r="2.6" class="mfault-led"/>
    <text x="192" y="241.5" class="stage-label-sm">BAND 2</text>
  </g>

  <!-- HMI-Meldezeile -->
  <g id="ch-textline-group">
    <rect x="336" y="219" width="140" height="17" rx="3" class="textline-box"/>
    <text id="ch-textline" x="406" y="230.8" text-anchor="middle" class="textline-text"></text>
  </g>

  <!-- Lichtschranke an der Greifstation (Sender links, Reflektor rechts) -->
  <g id="ch-sensor-group">
    <rect x="160" y="160" width="3" height="14" class="sensor-mast"/>
    <rect x="152" y="152" width="14" height="14" rx="3" class="sensor-box"/>
    <circle cx="165" cy="159" r="2.2" class="sensor-lens"/>
    <line x1="167" y1="159" x2="236" y2="159" class="sensor-beam"/>
    <rect x="236" y="152" width="4" height="22" rx="1" class="sensor-reflector"/>
    <circle cx="159" cy="147" r="2" class="sensor-dot"/>
  </g>

  <!-- Werkstück an der Station -->
  <g id="ch-part-group" style="opacity:0">
    <ellipse cx="200" cy="174" rx="13" ry="2" class="part-shadow"/>
    <rect id="ch-part-rect" x="188" y="155" width="24" height="18" rx="3.5" class="part-rect part-neutral"/>
    <rect x="191" y="157.5" width="18" height="4" rx="1.6" fill="url(#sgShine)"/>
    <text id="ch-part-label" x="200" y="168.5" text-anchor="middle" class="part-label"></text>
  </g>
  <!-- abgelegtes/fallendes Teil (Animation) -->
  <g id="ch-part-drop" style="opacity:0"><rect id="ch-part-drop-rect" x="-12" y="-9" width="24" height="18" rx="3.5" class="part-rect part-neutral"/></g>

  <!-- Sortier-Weiche am Bandende -->
  <g id="ch-gate-group" transform="translate(382,184)">
    <rect x="-4" y="-5" width="40" height="10" rx="2.5" class="gate-base"/>
    <g id="ch-gate-flap" style="transform-origin:0px 0px"><rect x="0" y="-2.5" width="32" height="5" rx="2.5" class="gate-flap"/><circle cx="0" cy="0" r="3.2" class="gate-pivot"/></g>
    <text id="ch-gate-dirB" x="20" y="-12" class="gate-dir">&#9652; B</text>
    <text id="ch-gate-dirA" x="20" y="22" class="gate-dir">&#9662; A</text>
  </g>

  <!-- Portal-Schwenkarm -->
  <g id="ch-robot-base">
    <rect x="186" y="32" width="28" height="34" rx="3" class="trolley"/>
    <g id="ch-arm-rotor" style="transform-origin:200px 56px">
      <rect x="194.5" y="56" width="11" height="85" rx="4.5" fill="url(#sgArm)" class="robot-arm-seg"/>
      <rect x="197" y="64" width="2.2" height="70" rx="1" class="robot-arm-stripe"/>
      <path d="M 207 64 Q 213 100 207 136" class="robot-cable"/>
      <g id="ch-gripper">
        <rect x="186" y="139" width="28" height="9" rx="2.5" class="gripper-wrist"/>
        <rect x="193" y="136" width="14" height="5" rx="1.5" class="gripper-flange"/>
        <g id="ch-part-held" style="display:none">
          <rect id="ch-part-held-rect" x="188" y="155" width="24" height="18" rx="3.5" class="part-rect part-neutral"/>
          <rect x="191" y="157.5" width="18" height="4" rx="1.6" fill="url(#sgShine)"/>
          <text id="ch-part-held-label" x="200" y="168.5" text-anchor="middle" class="part-label"></text>
        </g>
        <rect id="ch-gripper-left"  x="181" y="146" width="7" height="22" rx="2" class="gripper-finger"/>
        <rect id="ch-gripper-right" x="212" y="146" width="7" height="22" rx="2" class="gripper-finger"/>
      </g>
    </g>
    <circle cx="200" cy="56" r="8" class="robot-joint"/><circle cx="200" cy="56" r="3.4" class="robot-joint-core"/>
    <rect x="178" y="4" width="44" height="14" rx="3" class="hud-box"/>
    <text id="ch-arm-angle" x="200" y="14.3" text-anchor="middle" class="hud-text">0°</text>
  </g>

  <!-- Ergebnis-Overlay -->
  <g id="ch-result-overlay" style="opacity:0"><rect x="0" y="0" width="480" height="265" id="ch-result-flash"/></g>
  <!-- Status-Label -->
  <g id="ch-frame-wrap" style="opacity:0">
    <rect x="8" y="244" width="150" height="16" rx="4" class="frame-label-bg"/>
    <circle cx="17" cy="252" r="2.6" class="frame-label-dot"/>
    <text id="ch-frame-label" x="25" y="255.5" class="stage-label-sm stage-frame-label"></text>
  </g>
</svg>`;

const DEFAULTS = {
  armAngle:0, gripperOpen:true, beltRunning:false, lightRed:false, lightYellow:false, lightGreen:false,
  sensorActive:false, partVisible:false, partColor:'neutral', gateAngle:0, displayValue:null, displayLabel:'',
  faultActive:false, hornActive:false, belt2Running:false, fanRunning:false, displayText:'', partLabel:'', motorFault1:false, motorFault2:false
};
const PULSE_TARGET = {
  armAngle:'ch-arm-rotor', gripperOpen:'ch-gripper', beltRunning:'ch-belt-group', lightRed:'ch-lamp-red',
  lightYellow:'ch-lamp-yellow', lightGreen:'ch-lamp-green', sensorActive:'ch-sensor-group', partVisible:'ch-part-group',
  partColor:'ch-part-rect', gateAngle:'ch-gate-group', displayValue:'ch-display-group', displayLabel:'ch-display-group',
  faultActive:'ch-fault-group', hornActive:'ch-horn-group', belt2Running:'ch-belt2-group', fanRunning:'ch-fan-group', displayText:'ch-textline-group',
  partLabel:'ch-part-group', motorFault1:'ch-mf1', motorFault2:'ch-mf2'
};
const MON_META = {
  armAngle:{icon:'fa-arrows-rotate', label:'Arm-Winkel'}, gripperOpen:{icon:'fa-hand', label:'Greifer'},
  beltRunning:{icon:'fa-forward', label:'Förderband'}, lightRed:{icon:'fa-lightbulb', label:'Lampe Rot'},
  lightYellow:{icon:'fa-lightbulb', label:'Lampe Gelb'}, lightGreen:{icon:'fa-lightbulb', label:'Lampe Grün'},
  sensorActive:{icon:'fa-wifi', label:'Lichtschranke'}, partVisible:{icon:'fa-cube', label:'Werkstück'},
  partColor:{icon:'fa-palette', label:'Teil-Farbe'}, gateAngle:{icon:'fa-code-branch', label:'Weiche'},
  displayValue:{icon:'fa-display', label:'Anzeige'}, faultActive:{icon:'fa-triangle-exclamation', label:'Störung'},
  hornActive:{icon:'fa-bullhorn', label:'Hupe'}, belt2Running:{icon:'fa-forward', label:'Band 2'}, fanRunning:{icon:'fa-fan', label:'Lüfter'},
  displayText:{icon:'fa-message', label:'HMI-Text'}, partLabel:{icon:'fa-tag', label:'Teile-Etikett'}, motorFault1:{icon:'fa-circle-exclamation', label:'Störung Band 1'},
  motorFault2:{icon:'fa-circle-exclamation', label:'Störung Band 2'}
};
const COLOR_NAMES = {neutral:'GRAU', red:'ROT', green:'GRÜN', blue:'BLAU'};

function fmtNum(v){ return String(Math.round(Number(v)*100)/100); }
function formatMonValue(ch, v){
  switch(ch){
    case 'armAngle': { const n = Math.round(Number(v)*10)/10; return {text:(isNaN(n)?'--':n)+'°', cls:'num'}; }
    case 'gripperOpen': return v ? {text:'OFFEN', cls:'on'} : {text:'ZU', cls:'num'};
    case 'beltRunning': return v ? {text:'LÄUFT', cls:'on'} : {text:'STOPP', cls:'off'};
    case 'lightRed': return v ? {text:'AN', cls:'on-red'} : {text:'AUS', cls:'off'};
    case 'lightYellow': return v ? {text:'AN', cls:'on-yellow'} : {text:'AUS', cls:'off'};
    case 'lightGreen': return v ? {text:'AN', cls:'on'} : {text:'AUS', cls:'off'};
    case 'sensorActive': return v ? {text:'BELEGT', cls:'num'} : {text:'FREI', cls:'off'};
    case 'partVisible': return v ? {text:'DA', cls:'on'} : {text:'—', cls:'off'};
    case 'partColor': return {text: COLOR_NAMES[v] || String(v||'neutral').toUpperCase(), cls:'num'};
    case 'gateAngle': { const d = Number(v)||0; if(d > 2) return {text:'→ A ('+Math.round(d)+'°)', cls:'num'}; if(d < -2) return {text:'→ B ('+Math.round(d)+'°)', cls:'num'}; return {text:'MITTE', cls:'off'}; }
    case 'displayValue': return (v===null||v===undefined) ? {text:'--', cls:'off'} : {text: typeof v==='number' ? fmtNum(v) : String(v), cls:'num'};
    case 'faultActive': return v ? {text:'AKTIV', cls:'err'} : {text:'OK', cls:'off'};
    case 'hornActive': return v ? {text:'TÖNT', cls:'on-yellow'} : {text:'AUS', cls:'off'};
    case 'belt2Running': return v ? {text:'LÄUFT', cls:'on'} : {text:'STOPP', cls:'off'};
    case 'fanRunning': return v ? {text:'DREHT', cls:'on'} : {text:'AUS', cls:'off'};
    case 'displayText': { const t = String(v === undefined || v === null ? '' : v); return t ? {text:'»' + (t.length > 18 ? t.slice(0,17) + '…' : t) + '«', cls:'num'} : {text:'—', cls:'off'}; }
    case 'partLabel': return (v === '' || v === null || v === undefined) ? {text:'—', cls:'off'} : {text:String(v), cls:'num'};
    case 'motorFault1': case 'motorFault2': return v ? {text:'STÖRUNG', cls:'err'} : {text:'OK', cls:'off'};
  }
  return {text:String(v), cls:'num'};
}

const $ = id => document.getElementById(id);
let monitorRows = {}, monFlashTimers = {}, pulseTimers = {}, lastValues = {};
const listeners = [];

/* ---------- Teile-Logik (gemeinsamer Zustand) ---------- */
const logic = { arm:0, open:true, visible:false, held:false, color:'neutral', counts:{lager:0, nach:0}, busy:0 };
function atStation(a){ return Math.abs(Number(a)||0) <= STATION_TOL; }
function emit(ev, data){ listeners.forEach(fn => { try{ fn(ev, data); }catch(e){} }); if(root.Scene3D && root.Scene3D.partEvent) root.Scene3D.partEvent(ev, data); }

function renderPart(){
  const st = $('ch-part-group'), held = $('ch-part-held');
  if(st) st.style.opacity = (logic.visible && !logic.held && !logic.busy) ? '1' : '0';
  if(held) held.style.display = (logic.visible && logic.held) ? '' : 'none';
}
function worldOfHeld(angle){
  const a = (Number(angle)||0) * Math.PI / 180;
  // SVG rotate(+a) ist im Uhrzeigersinn: der nach unten zeigende Arm schwenkt nach links
  return { x: PIV.x - R * Math.sin(a), y: PIV.y + R * Math.cos(a) };
}
function deliver(angle){
  const p = worldOfHeld(angle);
  let target, where = null;
  if(Math.abs(angle - 90) <= SHELF_TOL){ where = 'lager'; target = {x:92, y:68}; }
  else if(Math.abs(angle + 90) <= SHELF_TOL){ where = 'nach'; target = {x:308, y:68}; }
  else { target = {x:p.x, y: (p.x > 112 && p.x < 382) ? 164 : 205}; }
  const g = $('ch-part-drop'), rect = $('ch-part-drop-rect');
  logic.busy++;
  if(g && rect){
    rect.setAttribute('class', 'part-rect part-' + logic.color);
    g.style.transition = 'none';
    g.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + angle + 'deg)';
    g.style.opacity = '1';
    void g.getBoundingClientRect();
    g.style.transition = 'transform .5s cubic-bezier(.5,0,.8,.6), opacity .35s ease .55s';
    g.style.transform = 'translate(' + target.x + 'px,' + target.y + 'px) rotate(' + (where ? 0 : angle) + 'deg) scale(' + (where ? .8 : 1) + ')';
    g.style.opacity = '0';
  }
  if(where){ logic.counts[where]++; const c = $('ch-shelf-' + where + '-n'); if(c) c.textContent = logic.counts[where]; const s = $('ch-shelf-' + where); if(s){ s.classList.remove('shelf-hit'); void s.getBoundingClientRect(); s.classList.add('shelf-hit'); } }
  emit('deliver', { angle, where });
  setTimeout(() => { logic.busy = Math.max(0, logic.busy - 1); renderPart(); emit('respawn', {}); }, 900);
  renderPart();
}

/* ---------- Monitor unter der Bühne ---------- */
function buildMonitor(bindings){
  const wrap = $('sceneMonitor'); if(!wrap) return;
  monitorRows = {}; wrap.innerHTML = '';
  const list = (bindings||[]).filter(b => b.channel !== 'displayLabel' && MON_META[b.channel] && !(b.channel==='partVisible' && b.value===true));
  if(!list.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const cap = document.createElement('div'); cap.className = 'mon-caption';
  cap.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Diese Aufgabe steuert'; wrap.appendChild(cap);
  const seen = {};
  list.forEach(b => {
    if(seen[b.channel]) return; seen[b.channel] = 1;
    const m = MON_META[b.channel];
    const chip = document.createElement('div'); chip.className = 'mon-chip';
    chip.innerHTML = '<i class="fa-solid ' + m.icon + '" aria-hidden="true"></i><span class="mon-name">' + m.label + '</span>'
      + (b.variable ? '<span class="mon-var">' + b.variable + '</span>' : '<span class="mon-var mon-const">fest</span>') + '<span class="mon-val off">–</span>';
    wrap.appendChild(chip); monitorRows[b.channel] = chip;
  });
}
function updateMonitor(ch, v, flash){
  const chip = monitorRows[ch]; if(!chip) return;
  const f = formatMonValue(ch, v), el = chip.querySelector('.mon-val');
  if(el){ el.textContent = f.text; el.className = 'mon-val ' + f.cls; }
  if(flash){ chip.classList.remove('mon-flash'); void chip.offsetWidth; chip.classList.add('mon-flash');
    clearTimeout(monFlashTimers[ch]); monFlashTimers[ch] = setTimeout(() => chip.classList.remove('mon-flash'), 800); }
}
function highlightActive(bindings){
  Object.values(PULSE_TARGET).forEach(id => { const e = $(id); if(e) e.classList.remove('ch-active'); });
  (bindings||[]).forEach(b => { const e = $(PULSE_TARGET[b.channel]); if(e && !(b.channel==='partVisible' && b.value===true)) e.classList.add('ch-active'); });
  if(root.Scene3D) root.Scene3D.setActiveChannels(bindings||[]);
}
function pulse(ch){
  const e = $(PULSE_TARGET[ch]); if(!e) return;
  e.classList.remove('ch-pulse'); void e.getBoundingClientRect(); e.classList.add('ch-pulse');
  clearTimeout(pulseTimers[ch]); pulseTimers[ch] = setTimeout(() => e.classList.remove('ch-pulse'), 900);
}
function setFrameLabel(text){
  const l = $('ch-frame-label'), w = $('ch-frame-wrap'), l3 = $('scene3dLabelText'), w3 = $('scene3dLabelWrap');
  if(l) l.textContent = text || ''; if(w) w.style.opacity = text ? '1' : '0';
  if(l3) l3.textContent = text || ''; if(w3) w3.style.opacity = text ? '1' : '0';
}
function clampNum(v, lo, hi){ v = Number(v); if(isNaN(v)) v = 0; return Math.max(lo, Math.min(hi, v)); }

/* ---------- ein Kanal → DOM ---------- */
function paint(ch, v, opts){
  switch(ch){
    case 'armAngle': {
      const d = clampNum(v, -90, 90), g = $('ch-arm-rotor');
      if(g){ g.style.transitionDelay = (opts && opts.delay) ? opts.delay + 'ms' : '0ms'; g.style.transform = 'rotate(' + d + 'deg)'; }
      const h = $('ch-arm-angle'); if(h) h.textContent = (Math.round(d*10)/10) + '°';
      break;
    }
    case 'gripperOpen': {
      const o = !!v, l = $('ch-gripper-left'), r = $('ch-gripper-right');
      if(l) l.style.transform = o ? 'translateX(-6px)' : 'translateX(0px)';
      if(r) r.style.transform = o ? 'translateX(6px)' : 'translateX(0px)';
      break;
    }
    case 'beltRunning': { const m = $('ch-belt-marks'), r = $('ch-belt-rollers'); if(m) m.classList.toggle('belt-anim', !!v); if(r) r.classList.toggle('belt-anim', !!v); break; }
    case 'lightRed': case 'lightYellow': case 'lightGreen': { const e = $('ch-lamp-' + ch.replace('light','').toLowerCase()); if(e) e.classList.toggle('lamp-on', !!v); break; }
    case 'sensorActive': { const e = $('ch-sensor-group'); if(e) e.classList.toggle('sensor-on', !!v); break; }
    case 'partColor': {
      ['ch-part-rect','ch-part-held-rect'].forEach(id => { const r = $(id); if(r){ r.classList.remove('part-neutral','part-red','part-green','part-blue'); r.classList.add('part-' + (v||'neutral')); } });
      break;
    }
    case 'gateAngle': {
      const d = clampNum(v, -25, 25), g = $('ch-gate-flap'); if(g) g.style.transform = 'rotate(' + d + 'deg)';
      const a = $('ch-gate-dirA'), b = $('ch-gate-dirB'); if(a) a.classList.toggle('lit', d > 2); if(b) b.classList.toggle('lit', d < -2);
      break;
    }
    case 'displayValue': { const e = $('ch-display-text'); if(e){ const t = (v===null||v===undefined) ? '--' : (typeof v==='number' ? fmtNum(v) : String(v)); e.textContent = t.length > 7 ? t.slice(0,7) : t; } break; }
    case 'displayLabel': { const e = $('ch-display-label'); if(e) e.textContent = (v || '-').toString().slice(0, 12); break; }
    case 'faultActive': {
      const e = $('ch-fault-group'); if(e) e.classList.toggle('fault-on', !!v);
      const s = $('stageSvg'); if(s) s.classList.toggle('stage-fault', !!v);
      const h = $('scene3dHolder'); if(h) h.classList.toggle('stage-fault', !!v);
      break;
    }
    case 'hornActive': { const e = $('ch-horn-group'); if(e) e.classList.toggle('horn-on', !!v); break; }
    case 'belt2Running': { const m = $('ch-belt2-marks'); if(m) m.classList.toggle('belt-anim', !!v); break; }
    case 'fanRunning': { const e = $('ch-fan-group'); if(e) e.classList.toggle('fan-on', !!v); break; }
    case 'displayText': { const e = $('ch-textline'); if(e){ const t = String(v === undefined || v === null ? '' : v); e.textContent = t.length > 24 ? t.slice(0, 24) : t; } const g = $('ch-textline-group'); if(g) g.classList.toggle('has-text', !!v); break; }
    case 'partLabel': { ['ch-part-label','ch-part-held-label'].forEach(id => { const e = $(id); if(e){ const t = (v === null || v === undefined) ? '' : String(v); e.textContent = t.length > 6 ? t.slice(-6) : t; } }); break; }
    case 'motorFault1': case 'motorFault2': { const e = $(ch === 'motorFault1' ? 'ch-mf1' : 'ch-mf2'); if(e) e.classList.toggle('mfault-on', !!v); break; }
  }
}

function setChannel(ch, value, opts){
  opts = opts || {};
  const changed = JSON.stringify(lastValues[ch]) !== JSON.stringify(value);
  lastValues[ch] = value;
  paint(ch, value, opts);
  updateMonitor(ch, value, changed && !opts.silent);
  if(root.Scene3D) root.Scene3D.setChannel(ch, value, changed && !opts.silent, opts);
  if(changed && !opts.silent){ pulse(ch); listeners.forEach(fn => { try{ fn('channel', {ch, value}); }catch(e){} }); }
}

/* ---------- Frame: alle Bindungen eines Zyklus atomar anwenden ---------- */
// Variablen dürfen Pfade sein: "DB_Zelle".Anzahl / DB_E.Teil_da
function envPath(env, path){
  if(Object.prototype.hasOwnProperty.call(env, path)) return env[path];
  const parts = String(path).replace(/"/g, '').split('.');
  let v = env;
  for(const p of parts){
    if(v === null || typeof v !== 'object') return undefined;
    if(Object.prototype.hasOwnProperty.call(v, p)){ v = v[p]; continue; }
    const k = Object.keys(v).find(x => x.toLowerCase() === p.toLowerCase());
    if(k === undefined) return undefined;
    v = v[k];
  }
  return v;
}
function resolveBindings(bindings, env){
  const out = {};
  (bindings||[]).forEach(b => {
    let v;
    if(Object.prototype.hasOwnProperty.call(b, 'value')) v = b.value;
    else {
      const raw = env ? envPath(env, b.variable) : undefined;
      if(raw === undefined) return;
      v = raw;
      if(b.map){ v = Object.prototype.hasOwnProperty.call(b.map, String(raw)) ? b.map[String(raw)] : (b.channel==='partColor' ? 'blue' : raw); }
    }
    if(b.channel === 'partColor' && typeof v !== 'string') v = 'neutral';
    if(b.channel in out && b.channel !== 'partVisible') return; // erste Bindung gewinnt
    if(b.channel === 'partVisible'){ out.partVisible = (out.partVisible === undefined) ? !!v : (out.partVisible || !!v); return; }
    out[b.channel] = v;
  });
  return out;
}
function applyFrame(bindings, env, label, opts){
  const vals = resolveBindings(bindings, env);
  const prevArm = logic.arm;
  const gripChanges = ('gripperOpen' in vals) && (!!vals.gripperOpen !== logic.open);
  const armChanges = ('armAngle' in vals) && (clampNum(vals.armAngle,-90,90) !== logic.arm);

  if('partColor' in vals){ logic.color = vals.partColor; }
  if('partVisible' in vals){
    logic.visible = !!vals.partVisible;
    if(!logic.visible) logic.held = false;
  }
  if('gripperOpen' in vals){
    const open = !!vals.gripperOpen;
    if(open !== logic.open){
      if(!open && atStation(prevArm) && logic.visible) logic.held = true;
      if(open && logic.held){
        logic.held = false;
        if(!atStation(prevArm)) deliver(prevArm);
      }
    }
    logic.open = open;
  }
  if('armAngle' in vals){
    logic.arm = clampNum(vals.armAngle, -90, 90);
    if(atStation(logic.arm) && !logic.open && logic.visible && !logic.busy) logic.held = true;
  }
  // DOM
  Object.keys(vals).forEach(ch => {
    if(ch === 'partVisible') return;
    setChannel(ch, vals[ch], { delay: (ch==='armAngle' && gripChanges && armChanges) ? 320 : 0, silent: opts && opts.silent });
  });
  if('partVisible' in vals){ updateMonitor('partVisible', logic.visible, JSON.stringify(lastValues.partVisible)!==JSON.stringify(logic.visible)); lastValues.partVisible = logic.visible; }
  renderPart();
  if(root.Scene3D) root.Scene3D.setPartState({ visible: logic.visible, held: logic.held, color: logic.color });
  if(label !== undefined) setFrameLabel(label);
}

function reset(bindings, initialVars){
  // Kanäle, die die neue Aufgabe nicht steuert, in Grundstellung bringen
  const bound = {}; (bindings||[]).forEach(b => bound[b.channel] = true);
  Object.keys(DEFAULTS).forEach(ch => { if(!bound[ch] && ch !== 'partVisible') setChannel(ch, DEFAULTS[ch], { silent:true }); });
  if(!bound.partVisible){ logic.visible = false; logic.held = false; }
  if(!bound.partColor) logic.color = 'neutral';
  if(!bound.armAngle) logic.arm = 0;
  if(!bound.gripperOpen) logic.open = true;
  renderPart();
  if(root.Scene3D) root.Scene3D.setPartState({ visible: logic.visible, held: logic.held, color: logic.color });
  buildMonitor(bindings||[]);
  highlightActive(bindings||[]);
  applyFrame(bindings||[], initialVars||{}, '', { silent:true });
  setChannel('faultActive', false, { silent:true });
  setChannel('hornActive', false, { silent:true });
  const o = $('ch-result-overlay'); if(o) o.style.opacity = '0';
}
function hardReset(){
  Object.assign(logic, { arm:0, open:true, visible:false, held:false, color:'neutral', counts:{lager:0, nach:0}, busy:0 });
  ['lager','nach'].forEach(k => { const c = $('ch-shelf-' + k + '-n'); if(c) c.textContent = '0'; });
  Object.keys(DEFAULTS).forEach(ch => { if(ch !== 'partVisible') setChannel(ch, DEFAULTS[ch], { silent:true }); });
  lastValues = {};
  renderPart();
  if(root.Scene3D){ root.Scene3D.setPartState({ visible:false, held:false, color:'neutral' }); root.Scene3D.resetCounts && root.Scene3D.resetCounts(); }
  highlightActive([]); buildMonitor([]); setFrameLabel('');
}
function showFault(label){ setChannel('faultActive', true); setFrameLabel(label || 'Maschinen-Fehler'); }
function flashResult(success){
  const o = $('ch-result-overlay'), f = $('ch-result-flash');
  if(o && f){ f.setAttribute('class', success ? 'result-flash-ok' : 'result-flash-err'); o.style.opacity = '1'; setTimeout(() => { o.style.opacity = '0'; }, 650); }
  [$('stageSvg'), $('scene3dHolder')].forEach(s => {
    if(!s) return; s.classList.remove('stage-ok','stage-err'); void s.getBoundingClientRect();
    s.classList.add(success ? 'stage-ok' : 'stage-err'); setTimeout(() => s.classList.remove('stage-ok','stage-err'), 900);
  });
}
let timelineToken = 0;
function playTimeline(bindings, frames, stepMs, onDone, onFrame){
  const token = ++timelineToken;
  if(!frames || !frames.length){ if(onDone) onDone(); return; }
  let i = 0;
  (function step(){
    if(token !== timelineToken) return;          // abgebrochen durch neuen Lauf
    if(i >= frames.length){ setTimeout(() => { if(token === timelineToken) setFrameLabel(''); }, 1600); if(onDone) onDone(); return; }
    applyFrame(bindings, frames[i].env, frames[i].label);
    if(onFrame) onFrame(i);
    i++;
    setTimeout(step, frames[i-1].ms || stepMs);
  })();
}
function stopTimeline(){ timelineToken++; }
function onEvent(fn){ listeners.push(fn); }

root.SceneEngine = { STAGE_SVG, applyFrame, playTimeline, stopTimeline, reset, hardReset, showFault, flashResult, setFrameLabel,
  onEvent, MON_META, CHANNELS: Object.keys(DEFAULTS), _logic: logic };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SceneEngine;
})(typeof window !== 'undefined' ? window : globalThis);
