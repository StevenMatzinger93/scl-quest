(function(root){
"use strict";
/* ============================================================
   SCENE 3D — dieselbe Zelle als drehbare WebGL-Szene (three.js r128)
   Spiegelt exakt die Kanäle und die Teile-Logik der 2D-Szene.
   Aufbau (Einheiten ≈ Meter):
     Greifstation bei x = 0, Bandoberkante y = 1.07, Teilmitte y = 1.25
     Drehpunkt Schwenkarm (0, 3.85, 0), Abstand zur Teilmitte 2.6
     +90° → LAGER (x = −2.6), −90° → NACHARBEIT (x = +2.6)
   Lazy-Aufbau beim ersten Umschalten; rendert nur, solange sichtbar.
   ============================================================ */
const state = { armAngle:0, gripperOpen:true, beltRunning:false, lightRed:false, lightYellow:false, lightGreen:false,
  sensorActive:false, partVisible:false, partColor:'neutral', gateAngle:0, displayValue:null, displayLabel:'', faultActive:false, hornActive:false,
  belt2Running:false, fanRunning:false, displayText:'', partLabel:'', motorFault1:false, motorFault2:false };
const part = { visible:false, held:false, color:'neutral' };
const PIVOT_Y = 3.85, ARM_R = 2.6, PART_Y = 1.25;
const PART_COLORS = { neutral:0x9a9a9a, red:0xe02f2f, green:0x2fd414, blue:0x1ec8e0 };

let built = false, active = false, failed = false;
let renderer = null, scene = null, camera = null, holder = null, clock = null, rafId = 0, ro = null;
const R = {}, pulseUntil = {}, anims = [];
let activeChannels = {}, armDelayUntil = 0, pendingArm = 0;
const HOME = { theta:0.62, phi:1.12, radius:11.5 };
const orbit = { theta:HOME.theta, phi:HOME.phi, radius:HOME.radius, target:null, pointers:{}, pinch:0 };

function isAvailable(){ return typeof root.THREE !== 'undefined' && !failed; }
function mat(color, o){
  o = Object.assign({ color, roughness:.55, metalness:.35 }, o||{});
  const m = new THREE.MeshStandardMaterial(o);
  m.userData.baseEmissive = o.emissive !== undefined ? o.emissive : 0; m.userData.baseIntensity = o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1;
  return m;
}
function mesh(geo, m, cast, receive){ const x = new THREE.Mesh(geo, m); x.castShadow = cast !== false; x.receiveShadow = !!receive; return x; }
function box(w,h,d,m,c,r){ return mesh(new THREE.BoxGeometry(w,h,d), m, c, r); }
function cyl(rt,rb,h,m,seg){ return mesh(new THREE.CylinderGeometry(rt,rb,h,seg||24), m); }
function canvas(w,h){ try{ const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); return x ? {c, x} : null; }catch(e){ return null; } }
function label(text, color, w, h){
  // Canvas-Breite passend zum Seitenverhältnis der Fläche, Schrift auf die Breite eingepasst
  const cw = Math.max(128, Math.round(64 * w / h)), cv = canvas(cw, 64); if(!cv) return null;
  let fs = 40; cv.x.font = '700 ' + fs + 'px monospace';
  while(cv.x.measureText(text).width > cw * 0.94 && fs > 10){ fs -= 2; cv.x.font = '700 ' + fs + 'px monospace'; }
  cv.x.textAlign = 'center'; cv.x.textBaseline = 'middle';
  cv.x.fillStyle = color; cv.x.fillText(text, cw/2, 34);
  const tex = new THREE.CanvasTexture(cv.c); tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false }));
  return m;
}

/* ---------- HMI-Display ---------- */
let disp = null, dispTex = null;
function redrawDisplay(){
  if(!disp || !dispTex) return;
  const x = disp.x; x.fillStyle = '#060804'; x.fillRect(0,0,256,148);
  x.strokeStyle = '#2a2b1f'; x.lineWidth = 6; x.strokeRect(3,3,250,142);
  const v = state.displayValue, txt = String(state.displayText || '');
  let t = (v===null||v===undefined) ? '--' : (typeof v==='number' ? String(Math.round(v*100)/100) : String(v));
  if(t.length > 7) t = t.slice(0,7);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if(txt){
    x.font = '700 40px monospace'; x.fillStyle = '#39ff14'; x.shadowColor = '#39ff14'; x.shadowBlur = 10; x.fillText(t, 128, 34); x.shadowBlur = 0;
    let fs = 26; x.font = '600 ' + fs + 'px monospace';
    const line = txt.slice(0, 24);
    while(x.measureText(line).width > 236 && fs > 12){ fs -= 1; x.font = '600 ' + fs + 'px monospace'; }
    x.fillStyle = '#d8ffcf'; x.fillText(line, 128, 82);
    x.font = '400 18px monospace'; x.fillStyle = '#7a8a6a'; x.fillText(String(state.displayLabel||'').toUpperCase().slice(0,12), 128, 124);
  } else {
    x.font = '700 64px monospace';
    x.fillStyle = '#39ff14'; x.shadowColor = '#39ff14'; x.shadowBlur = 14; x.fillText(t, 128, 62); x.shadowBlur = 0;
    x.font = '400 22px monospace'; x.fillStyle = '#7a8a6a'; x.fillText(String(state.displayLabel||'').toUpperCase().slice(0,12), 128, 116);
  }
  dispTex.needsUpdate = true;
}

/* ---------- Aufbau ---------- */
function build(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b07);
  scene.fog = new THREE.Fog(0x0a0b07, 16, 34);
  orbit.target = new THREE.Vector3(0.4, 1.7, 0);

  scene.add(new THREE.HemisphereLight(0x8a94a0, 0x1a1b12, 0.5));
  scene.add(new THREE.AmbientLight(0x3a3d34, 0.75));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.0); key.position.set(4, 10, 7);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left:-8, right:8, top:8, bottom:-8, near:1, far:30 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x1ec8e0, 0.25); rim.position.set(-7, 5, -6); scene.add(rim);
  const spot = new THREE.SpotLight(0xffe0b0, 0.7, 14, 0.5, 0.6, 1.5); spot.position.set(0, 7, 2); spot.target.position.set(0, 1, 0);
  scene.add(spot); scene.add(spot.target);

  // Boden, Wand, Sicherheitszaun
  const floor = box(22, 0.1, 14, mat(0x121309, { roughness:.95, metalness:.05 }), false, true); floor.position.y = -0.05; scene.add(floor);
  const grid = new THREE.GridHelper(22, 44, 0x2c2d21, 0x1c1d14); grid.position.y = 0.005; grid.material.transparent = true; grid.material.opacity = .45; scene.add(grid);
  const hazard = canvas(128, 16);
  if(hazard){ for(let i=0;i<16;i++){ hazard.x.fillStyle = i%2 ? '#171204' : '#6a5a14'; hazard.x.beginPath(); hazard.x.moveTo(i*16,0); hazard.x.lineTo(i*16+8,0); hazard.x.lineTo(i*16,16); hazard.x.lineTo(i*16-8,16); hazard.x.fill(); } }
  const hazMat = hazard ? new THREE.MeshStandardMaterial({ map:(()=>{ const t = new THREE.CanvasTexture(hazard.c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6,1); return t; })(), roughness:.9 }) : mat(0x3a3413);
  [[0, 2.35, 12.4, 0.3],[0, -2.35, 12.4, 0.3]].forEach(p => { const s = box(p[2], 0.012, p[3], hazMat, false, true); s.position.set(p[0], 0.008, p[1]); scene.add(s); });
  const wall = box(22, 6, 0.2, mat(0x0f100a, { roughness:1, metalness:0 }), false, true); wall.position.set(0, 3, -4.6); scene.add(wall);
  const side = box(0.2, 6, 11.6, mat(0x0d0e09, { roughness:1, metalness:0 }), false, true); side.position.set(-9, 3, 1.2); scene.add(side);
  const sek = label('SEKTOR 7 · RZ-03', 'rgba(255,255,255,0.18)', 5.2, 0.8); if(sek){ sek.position.set(-5.2, 5.0, -4.48); scene.add(sek); }
  const fenceMat = mat(0x3a3c30, { metalness:.6, roughness:.4 });
  const meshMat = new THREE.MeshStandardMaterial({ color:0x2a2c22, transparent:true, opacity:.22, side:THREE.DoubleSide, roughness:.8 });
  [-4.5, -1.5, 1.5, 4.5].forEach(x => {
    const p = box(0.08, 2, 0.08, fenceMat); p.position.set(x, 1, -3.4); scene.add(p);
    if(x < 4.5){ const m = mesh(new THREE.PlaneGeometry(3, 1.8), meshMat, false); m.position.set(x + 1.5, 1.05, -3.4); scene.add(m);
      const t = box(3, 0.05, 0.05, fenceMat); t.position.set(x + 1.5, 1.98, -3.4); scene.add(t); }
  });

  // Förderband (x −2.2 … 3.6)
  const belt = new THREE.Group(); scene.add(belt); R.belt = belt;
  const frameMat = mat(0x2a2b20, { metalness:.55, roughness:.45 }); R.beltFrameMat = frameMat;
  [0.47, -0.47].forEach(z => { const s = box(5.8, 0.24, 0.08, frameMat); s.position.set(0.7, 0.93, z); belt.add(s); });
  const bc = canvas(128, 32);
  let beltMat;
  if(bc){ bc.x.fillStyle = '#121309'; bc.x.fillRect(0,0,128,32); bc.x.fillStyle = '#34362a'; for(let i=0;i<4;i++) bc.x.fillRect(4+i*32, 4, 14, 24);
    R.beltTex = new THREE.CanvasTexture(bc.c); R.beltTex.wrapS = R.beltTex.wrapT = THREE.RepeatWrapping; R.beltTex.repeat.set(8, 1);
    beltMat = new THREE.MeshStandardMaterial({ map:R.beltTex, roughness:.85, metalness:.05 }); }
  else beltMat = mat(0x121309, { roughness:.85 });
  const top = box(5.66, 0.06, 0.86, beltMat, false, true); top.position.set(0.7, 1.04, 0); belt.add(top);
  R.rollers = [];
  [-2.1, 3.5].forEach(x => { const r = cyl(0.14, 0.14, 0.9, mat(0x1b1c12, { metalness:.7, roughness:.3 })); r.rotation.x = Math.PI/2; r.position.set(x, 0.93, 0); belt.add(r); R.rollers.push(r); });
  [[-1.6,.36],[3.0,.36],[-1.6,-.36],[3.0,-.36]].forEach(p => { const l = box(0.1, 0.84, 0.1, frameMat); l.position.set(p[0], 0.42, p[1]); belt.add(l); });
  const stopper = box(0.06, 0.2, 0.5, mat(0xd8a400, { metalness:.4, roughness:.4, emissive:0x2a2000, emissiveIntensity:.5 })); stopper.position.set(0.32, 1.13, 0); belt.add(stopper);

  // Lichtschranke quer über die Greifstation (Sender vorne, Reflektor hinten)
  const sensor = new THREE.Group(); scene.add(sensor);
  const sMat = mat(0x1b1c12, { metalness:.5 }); R.sensorHeadMat = sMat;
  [0.62, -0.62].forEach((z,i) => {
    const post = box(0.05, 0.4, 0.05, frameMat); post.position.set(0, 1.08, z); sensor.add(post);
    const head = box(0.14, 0.14, 0.1, i === 0 ? sMat : mat(0x6a6a6a, { metalness:.8, roughness:.2 })); head.position.set(0, PART_Y, z); sensor.add(head);
  });
  R.beamMat = new THREE.MeshBasicMaterial({ color:0x1ec8e0, transparent:true, opacity:.07, depthWrite:false });
  const beam = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.14, 10), R.beamMat, false); beam.rotation.x = Math.PI/2; beam.position.set(0, PART_Y, 0); sensor.add(beam);

  // Werkstück
  R.partMat = mat(PART_COLORS.neutral, { roughness:.4, metalness:.25 });
  R.part = box(0.46, 0.36, 0.46, R.partMat); R.part.position.set(0, PART_Y, 0); R.part.visible = false; scene.add(R.part);
  R.partLabelCv = canvas(128, 64);
  if(R.partLabelCv){ R.partLabelTex = new THREE.CanvasTexture(R.partLabelCv.c);
    const pl2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map:R.partLabelTex, transparent:true, depthWrite:false }));
    pl2.position.set(0, 0, 0.232); R.part.add(pl2); R.partLabelMesh = pl2; pl2.visible = false; }

  // Zuführband 2 (vorne) mit Störungs-LED
  const belt2 = new THREE.Group(); belt2.position.set(-0.9, 0, 1.8); scene.add(belt2);
  const b2Frame = mat(0x2a2b20, { metalness:.55, roughness:.45 }); R.belt2FrameMat = b2Frame;
  [0.3, -0.3].forEach(z => { const s2 = box(4.2, 0.18, 0.06, b2Frame); s2.position.set(0, 0.62, z); belt2.add(s2); });
  let b2Mat;
  if(R.beltTex){ R.belt2Tex = R.beltTex.clone(); R.belt2Tex.needsUpdate = true; R.belt2Tex.repeat.set(6, 1); b2Mat = new THREE.MeshStandardMaterial({ map:R.belt2Tex, roughness:.85, metalness:.05 }); }
  else b2Mat = mat(0x121309, { roughness:.85 });
  const b2top = box(4.1, 0.05, 0.56, b2Mat, false, true); b2top.position.set(0, 0.7, 0); belt2.add(b2top);
  [[-1.8,.22],[1.8,.22],[-1.8,-.22],[1.8,-.22]].forEach(p => { const l = box(0.08, 0.6, 0.08, b2Frame); l.position.set(p[0], 0.3, p[1]); belt2.add(l); });
  const b2l = label('BAND 2', '#9a9a8a', 0.9, 0.2); if(b2l){ b2l.position.set(-1.4, 0.62, 0.335); belt2.add(b2l); }
  function faultLed(parent, x, y, z){ const m = new THREE.MeshStandardMaterial({ color:0x3a1010, emissive:0xff2020, emissiveIntensity:0, roughness:.3 }); const l = mesh(new THREE.SphereGeometry(0.06, 12, 8), m, false); l.position.set(x, y, z); parent.add(l); return m; }
  R.mf2Mat = faultLed(belt2, -2.05, 0.72, 0.32);
  R.mf1Mat = faultLed(scene, -2.25, 1.02, 0.5);

  // Schaltschrank mit Lüfter an der Rückwand
  const cab = new THREE.Group(); cab.position.set(-6.3, 0, -4.15); scene.add(cab);
  const cabBody = box(1.3, 2.1, 0.7, mat(0x2a2c22, { metalness:.5, roughness:.5 })); cabBody.position.y = 1.05; cab.add(cabBody); R.cabMat = cabBody.material;
  const ring = mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 28), mat(0x4a4c3a, { metalness:.6 })); ring.position.set(0, 1.55, 0.36); cab.add(ring);
  R.fan = new THREE.Group(); R.fan.position.set(0, 1.55, 0.37); cab.add(R.fan);
  R.fanMat = mat(0x5a5d48, { emissive:0x1ec8e0, emissiveIntensity:0 });
  for(let i = 0; i < 4; i++){ const bl = box(0.1, 0.26, 0.02, R.fanMat); bl.position.y = 0.13; const piv = new THREE.Group(); piv.rotation.z = i * Math.PI/2; piv.add(bl); R.fan.add(piv); }
  const cl = label('SCHRANK', '#9a9a8a', 1.0, 0.2); if(cl){ cl.position.set(0, 0.6, 0.36); cab.add(cl); }

  // Portal mit Kragarm
  const steel = mat(0x3a3c30, { metalness:.7, roughness:.35 });
  [-3.1, 3.1].forEach(x => { const c = box(0.22, 4.4, 0.22, steel); c.position.set(x, 2.2, -1.25); scene.add(c);
    const f = box(0.5, 0.06, 0.5, steel); f.position.set(x, 0.03, -1.25); scene.add(f); });
  const beamX = box(6.5, 0.26, 0.26, steel); beamX.position.set(0, 4.35, -1.25); scene.add(beamX);
  const cant = box(0.26, 0.26, 1.35, steel); cant.position.set(0, 4.35, -0.6); scene.add(cant);
  const trolley = box(0.5, 0.45, 0.5, mat(0x2c2d23, { metalness:.6, roughness:.35 })); trolley.position.set(0, 4.1, 0); scene.add(trolley);
  const pl = label('PORTAL RZ-03', '#c9b98a', 2.0, 0.24); if(pl){ pl.position.set(-1.8, 4.35, -1.11); scene.add(pl); }

  // Schwenkarm (dreht um z am Drehpunkt)
  const arm = new THREE.Group(); arm.position.set(0, PIVOT_Y, 0); scene.add(arm); R.arm = arm;
  const armMat = mat(0xe07f00, { metalness:.45, roughness:.38, emissive:0x3a1e00, emissiveIntensity:.35 }); R.armMat = armMat;
  const joint = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 28), mat(0x33352a, { metalness:.7, roughness:.3 })); joint.rotation.x = Math.PI/2; arm.add(joint); R.jointMat = joint.material;
  const link = box(0.24, 2.05, 0.22, armMat); link.position.y = -1.08; arm.add(link);
  const cable = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), mat(0x1a1a14)); cable.position.set(0.16, -1.1, 0.06); arm.add(cable);
  const grip = new THREE.Group(); grip.position.y = -2.2; arm.add(grip); R.grip = grip;
  const wrist = box(0.64, 0.14, 0.3, mat(0x8a8a8a, { metalness:.8, roughness:.25 })); grip.add(wrist);
  const fMat = mat(0xd5d5d5, { metalness:.8, roughness:.25 });
  R.fingerL = box(0.08, 0.46, 0.24, fMat); R.fingerR = box(0.08, 0.46, 0.24, fMat.clone());
  R.fingerL.position.set(-0.4, -0.3, 0); R.fingerR.position.set(0.4, -0.3, 0); grip.add(R.fingerL); grip.add(R.fingerR);
  R.gripMats = [wrist.material, R.fingerL.material, R.fingerR.material];
  R.heldAnchor = new THREE.Object3D(); R.heldAnchor.position.set(0, -(ARM_R - 2.2), 0); grip.add(R.heldAnchor);

  // Ablagen hinter der Schwenkebene
  R.shelves = {};
  [['lager', -2.6, 'LAGER +90°'], ['nach', 2.6, 'NACHARB. −90°']].forEach(([k, x, txt]) => {
    const g = new THREE.Group(); g.position.set(x, PIVOT_Y - 0.55, -0.72); scene.add(g);
    const tray = box(0.9, 0.08, 0.7, mat(0x2a2b20, { metalness:.5 })); g.add(tray);
    [[-0.43,0],[0.43,0]].forEach(p => { const w = box(0.04, 0.22, 0.7, mat(0x3a3c30, { metalness:.6 })); w.position.set(p[0], 0.1, 0); g.add(w); });
    const back = box(0.9, 0.3, 0.04, mat(0x3a3c30, { metalness:.6 })); back.position.set(0, 0.12, -0.33); g.add(back);
    const br = box(0.08, 0.08, 0.6, steel); br.position.set(x < 0 ? -0.5 : 0.5, 0, -0.2); g.add(br);
    const lb = label(txt, '#9a9a8a', 1.4, 0.22); if(lb){ lb.position.set(0, -0.25, 0.36); g.add(lb); }
    R.shelves[k] = { group:g, stack:[], x, trayMat: tray.material };
  });

  // Weiche am Bandende + Bahnen A/B
  const gate = new THREE.Group(); gate.position.set(3.72, 1.06, 0); scene.add(gate);
  const gb = box(0.4, 0.1, 0.95, mat(0x22231a)); gate.add(gb); R.gateBaseMat = gb.material;
  R.flap = new THREE.Group(); R.flap.position.set(0.1, 0.09, 0); gate.add(R.flap);
  R.flapMat = mat(0x1ec8e0, { emissive:0x0a4a55, emissiveIntensity:.7, metalness:.3, roughness:.3 });
  const flap = box(0.95, 0.06, 0.14, R.flapMat); flap.position.x = 0.48; R.flap.add(flap);
  function lane(z, letter){
    const m = mat(0x1b1c12, { emissive:0x0a4a55, emissiveIntensity:.15 });
    const s = box(1.7, 0.02, 0.42, m, false, true); s.position.set(5.2, 0.02, z); scene.add(s);
    const l = label(letter, '#1ec8e0', 0.7, 0.7); if(l){ l.rotation.x = -Math.PI/2; l.position.set(5.2, 0.04, z); scene.add(l); }
    return { m, l };
  }
  R.laneA = lane(1.3, 'A'); R.laneB = lane(-1.3, 'B');

  // Signalsäule
  const tower = new THREE.Group(); tower.position.set(4.9, 0, -2.1); scene.add(tower);
  const pole = cyl(0.05, 0.07, 1.5, mat(0x26271c)); pole.position.y = 0.75; tower.add(pole);
  function lamp(y, on){
    const m = new THREE.MeshStandardMaterial({ color:0x2a2415, roughness:.25, metalness:.1, emissive:0, emissiveIntensity:1, transparent:true, opacity:.95 });
    const s = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 28), m); s.position.y = y; tower.add(s);
    const pl = new THREE.PointLight(on, 0, 3.5); pl.position.y = y; tower.add(pl);
    return { m, light:pl, on };
  }
  R.lampGreen = lamp(1.72, 0x39ff14); R.lampYellow = lamp(2.12, 0xffa000); R.lampRed = lamp(2.52, 0xff3333);
  const cap = cyl(0.18, 0.21, 0.1, mat(0x2c2d20)); cap.position.y = 2.76; tower.add(cap);

  // HMI
  const hmi = new THREE.Group(); hmi.position.set(5.8, 0, 0.2); hmi.rotation.y = -0.25; scene.add(hmi);
  const hp = cyl(0.05, 0.07, 1.35, mat(0x26271c)); hp.position.y = 0.68; hmi.add(hp);
  const panel = box(1.25, 0.78, 0.1, mat(0x14150c, { metalness:.4 })); panel.position.y = 1.68; hmi.add(panel); R.hmiPanelMat = panel.material;
  disp = canvas(256, 148);
  const sm = disp ? new THREE.MeshBasicMaterial({ map:(dispTex = new THREE.CanvasTexture(disp.c)) }) : new THREE.MeshBasicMaterial({ color:0x0a2005 });
  const screen = mesh(new THREE.PlaneGeometry(1.06, 0.6), sm, false); screen.position.set(0, 1.68, 0.056); hmi.add(screen);
  redrawDisplay();

  // Störungs-Rundumleuchte auf dem linken Portalpfosten
  const beacon = new THREE.Group(); beacon.position.set(-3.1, 4.48, -1.25); scene.add(beacon);
  R.beaconMat = new THREE.MeshStandardMaterial({ color:0x5a0f0f, emissive:0xff3333, emissiveIntensity:0, roughness:.3, transparent:true, opacity:.9 });
  const dome = mesh(new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI*2, 0, Math.PI/2), R.beaconMat); beacon.add(dome);
  R.beaconLight = new THREE.PointLight(0xff3333, 0, 7); R.beaconLight.position.y = 0.1; beacon.add(R.beaconLight);
  R.beaconRot = new THREE.Group(); R.beaconRot.position.y = 0.06; beacon.add(R.beaconRot);
  R.beaconConeMat = new THREE.MeshBasicMaterial({ color:0xff3333, transparent:true, opacity:0, depthWrite:false });
  [1,-1].forEach(d => { const c = mesh(new THREE.ConeGeometry(0.3, 1.6, 14, 1, true), R.beaconConeMat, false); c.rotation.z = d*Math.PI/2; c.position.x = d*0.8; R.beaconRot.add(c); });

  // Hupe am linken Pfosten
  const horn = new THREE.Group(); horn.position.set(-2.95, 2.4, -1.1); scene.add(horn);
  R.hornMat = mat(0x5a4a20, { metalness:.5, emissive:0xffa000, emissiveIntensity:0 });
  const hb = mesh(new THREE.ConeGeometry(0.16, 0.3, 20, 1, true), R.hornMat); hb.rotation.z = -Math.PI/2; hb.position.x = 0.15; horn.add(hb);
  R.hornWaves = [];
  for(let i=0;i<3;i++){ const w = mesh(new THREE.TorusGeometry(0.2 + i*0.12, 0.012, 6, 24, Math.PI*0.8), new THREE.MeshBasicMaterial({ color:0xffa000, transparent:true, opacity:0 }), false);
    w.rotation.y = Math.PI/2; w.rotation.z = -Math.PI*0.4; w.position.x = 0.35 + i*0.08; horn.add(w); R.hornWaves.push(w); }

  // ARIA-Kamera
  const cam = new THREE.Group(); cam.position.set(2.2, 4.1, -4.4); scene.add(cam); R.ariaCam = cam;
  cam.add(box(0.55, 0.3, 0.4, mat(0x1b1c12)));
  const lens = mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color:0xff3333 }), false); lens.position.z = 0.22; cam.add(lens); R.ariaEyeMat = lens.material;

  R.CH_MATS = {
    armAngle:[R.armMat, R.jointMat], gripperOpen:R.gripMats, beltRunning:[R.beltFrameMat], lightRed:[], lightYellow:[], lightGreen:[],
    sensorActive:[R.sensorHeadMat], partVisible:[R.partMat], partColor:[R.partMat], gateAngle:[R.gateBaseMat],
    displayValue:[R.hmiPanelMat], displayLabel:[R.hmiPanelMat], faultActive:[], hornActive:[R.hornMat],
    belt2Running:[R.belt2FrameMat], fanRunning:[R.cabMat], displayText:[R.hmiPanelMat], partLabel:[R.partMat], motorFault1:[], motorFault2:[]
  };
  Object.keys(state).forEach(ch => applyChannel(ch, state[ch]));
  syncPart(true);
  built = true;
}

/* ---------- Kanäle ---------- */
function setLamp(l, on){
  if(!l) return;
  l.m.color.setHex(on ? l.on : 0x2a2415); l.m.emissive.setHex(on ? l.on : 0); l.m.emissiveIntensity = on ? 1.1 : 0; l.light.intensity = on ? 0.9 : 0;
}
function applyChannel(ch, v){
  if(!scene) return;
  switch(ch){
    case 'lightRed': setLamp(R.lampRed, !!v); break;
    case 'lightYellow': setLamp(R.lampYellow, !!v); break;
    case 'lightGreen': setLamp(R.lampGreen, !!v); break;
    case 'sensorActive': R.beamMat.opacity = v ? .85 : .07; break;
    case 'partColor': R.partMat.color.setHex(PART_COLORS[v] !== undefined ? PART_COLORS[v] : PART_COLORS.neutral); break;
    case 'gateAngle': { const d = Number(v)||0; R.laneA.m.emissiveIntensity = d > 2 ? .9 : .15; R.laneB.m.emissiveIntensity = d < -2 ? .9 : .15;
      if(R.laneA.l) R.laneA.l.material.opacity = d > 2 ? 1 : .3; if(R.laneB.l) R.laneB.l.material.opacity = d < -2 ? 1 : .3; break; }
    case 'displayValue': case 'displayLabel': redrawDisplay(); break;
    case 'faultActive': if(!v){ R.beaconLight.intensity = 0; R.beaconConeMat.opacity = 0; R.beaconMat.emissiveIntensity = 0; } break;
    case 'hornActive': if(!v){ R.hornMat.emissiveIntensity = 0; R.hornWaves.forEach(w => w.material.opacity = 0); } break;
    case 'displayText': redrawDisplay(); break;
    case 'fanRunning': R.fanMat.emissiveIntensity = v ? .6 : 0; break;
    case 'motorFault1': case 'motorFault2': (ch === 'motorFault1' ? R.mf1Mat : R.mf2Mat).emissiveIntensity = v ? 1.6 : 0; break;
    case 'partLabel': if(R.partLabelCv){ const cx = R.partLabelCv.x, txt = (v === null || v === undefined) ? '' : String(v).slice(-6);
      cx.clearRect(0, 0, 128, 64); if(txt){ cx.fillStyle = '#f2f2e6'; cx.fillRect(4, 8, 120, 48); cx.fillStyle = '#111'; cx.font = '700 34px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, 64, 33); }
      R.partLabelTex.needsUpdate = true; R.partLabelMesh.visible = !!txt; } break;
  }
}
function setChannel(ch, v, flash, opts){
  if(!(ch in state)) return;
  if(ch === 'armAngle' && opts && opts.delay){ armDelayUntil = performance.now() + opts.delay; pendingArm = v; }
  else if(ch === 'armAngle'){ armDelayUntil = 0; }
  state[ch] = v;
  if(flash) pulseUntil[ch] = performance.now() + 900;
  if(built) applyChannel(ch, v);
}
function setActiveChannels(bindings){ activeChannels = {}; (bindings||[]).forEach(b => { if(!(b.channel==='partVisible' && b.value===true)) activeChannels[b.channel] = true; }); }

/* ---------- Teile-Logik (Spiegel der 2D-Logik) ---------- */
function syncPart(instant){
  if(!R.part) return;
  R.partMat.color.setHex(PART_COLORS[part.color] !== undefined ? PART_COLORS[part.color] : PART_COLORS.neutral);
  if(part.held && R.part.parent !== R.heldAnchor){
    R.heldAnchor.attach(R.part);
    R.part.position.set(0, 0, 0); R.part.rotation.set(0, 0, 0);
  } else if(!part.held && R.part.parent === R.heldAnchor){
    scene.attach(R.part);
    R.part.position.set(0, PART_Y, 0); R.part.rotation.set(0, 0, 0);
  }
  if(!R.part.userData.busy) R.part.visible = part.visible;
}
function setPartState(s){ Object.assign(part, s); if(built) syncPart(); }
function partEvent(ev, data){
  if(!built) return;
  if(ev === 'deliver'){
    // Kopie des gegriffenen Teils an Weltposition erzeugen und ablegen lassen
    const a = (Number(data.angle)||0) * Math.PI / 180;
    const from = new THREE.Vector3(-ARM_R*Math.sin(a), PIVOT_Y - ARM_R*Math.cos(a), 0);
    const ghost = box(0.46, 0.36, 0.46, R.partMat.clone()); ghost.position.copy(from); ghost.rotation.z = -a; scene.add(ghost);
    let to, rotTo = 0, stack = null;
    if(data.where){ stack = R.shelves[data.where]; const n = stack.stack.length;
      to = new THREE.Vector3(stack.x + (n % 2 ? .2 : -.2), PIVOT_Y - 0.55 + 0.23 + Math.floor(n/2)*0.001, -0.72); }
    else { const onBelt = from.x > -2.1 && from.x < 3.5; to = new THREE.Vector3(from.x, onBelt ? PART_Y : 0.18, 0); rotTo = -a; }
    anims.push({ t0: performance.now(), dur: 520, obj: ghost, from, to, r0: -a, r1: rotTo, done(){
      if(stack){ ghost.scale.set(.8,.8,.8); stack.stack.push(ghost); if(stack.stack.length > 4){ const old = stack.stack.shift(); scene.remove(old); } }
      else setTimeout(() => scene.remove(ghost), 700);
    }});
    R.part.visible = false; R.part.userData.busy = true;
  }
  if(ev === 'respawn'){
    R.part.userData.busy = false; syncPart();
    if(part.visible && !part.held){ R.part.position.set(-0.9, PART_Y, 0); anims.push({ t0: performance.now(), dur: 450, obj: R.part, from: new THREE.Vector3(-0.9, PART_Y, 0), to: new THREE.Vector3(0, PART_Y, 0), r0:0, r1:0 }); }
  }
}
function resetCounts(){ if(!R.shelves) return; Object.values(R.shelves).forEach(s => { s.stack.forEach(g => scene.remove(g)); s.stack = []; }); }

/* ---------- Render-Loop ---------- */
function ease(t){ return t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }
function loop(){
  if(!active) return;
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime, now = performance.now();

  // Arm (mit Verzögerung, wenn Greifer im selben Zyklus schaltet)
  if(now >= armDelayUntil){
    const target = -(Math.max(-90, Math.min(90, Number(state.armAngle)||0))) * Math.PI/180;
    R.arm.rotation.z += (target - R.arm.rotation.z) * Math.min(1, dt*5.5);
  }
  const off = state.gripperOpen ? 0.42 : 0.28;
  R.fingerL.position.x += (-off - R.fingerL.position.x) * Math.min(1, dt*9);
  R.fingerR.position.x += ( off - R.fingerR.position.x) * Math.min(1, dt*9);
  const gt = -(Math.max(-25, Math.min(25, Number(state.gateAngle)||0))) * Math.PI/180 * 2.2;
  R.flap.rotation.y += (gt - R.flap.rotation.y) * Math.min(1, dt*6);
  if(state.beltRunning){ if(R.beltTex) R.beltTex.offset.x -= dt*0.9; R.rollers.forEach(r => r.rotation.y -= dt*6); }
  if(state.belt2Running && R.belt2Tex) R.belt2Tex.offset.x -= dt*0.9;
  if(state.fanRunning) R.fan.rotation.z -= dt*14;
  if(state.motorFault1) R.mf1Mat.emissiveIntensity = 1 + Math.sin(t*10)*.6;
  if(state.motorFault2) R.mf2Mat.emissiveIntensity = 1 + Math.sin(t*10)*.6;
  if(state.sensorActive) R.beamMat.opacity = .72 + Math.sin(t*14)*.18;
  if(state.faultActive){ R.beaconRot.rotation.y += dt*5; const b = Math.sin(t*9)*.5+.5; R.beaconMat.emissiveIntensity = .5 + b*1.3; R.beaconLight.intensity = .5 + b*1.4; R.beaconConeMat.opacity = .22; }
  if(state.hornActive){ R.hornMat.emissiveIntensity = .4 + Math.sin(t*20)*.3; R.hornWaves.forEach((w,i) => { w.material.opacity = Math.max(0, Math.sin(t*8 - i*0.9))*.8; }); }
  R.ariaCam.rotation.y = Math.sin(t*.5)*.4;
  const f = state.faultActive ? (Math.sin(t*12)*.5+.5) : (Math.sin(t*1.8)*.25+.55); R.ariaEyeMat.color.setRGB(.55+.45*f, .06, .06);

  // Ablage-Animationen
  for(let i = anims.length - 1; i >= 0; i--){
    const a = anims[i], k = Math.min(1, (now - a.t0)/a.dur), e = ease(k);
    a.obj.position.lerpVectors(a.from, a.to, e); a.obj.rotation.z = a.r0 + (a.r1 - a.r0)*e;
    if(k >= 1){ anims.splice(i,1); if(a.done) a.done(); }
  }

  // aktive Baugruppen (cyan) + Wertwechsel-Puls (grün)
  const glow = (Math.sin(t*2.4)*.5+.5)*.5;
  Object.keys(R.CH_MATS).forEach(ch => {
    const pu = pulseUntil[ch] && now < pulseUntil[ch], ac = !!activeChannels[ch];
    R.CH_MATS[ch].forEach(m => {
      if(pu){ const k = 1 - (pulseUntil[ch]-now)/900; m.emissive.setHex(0x39ff14); m.emissiveIntensity = .15 + Math.sin(Math.min(1,k)*Math.PI)*.9; }
      else if(ac){ m.emissive.setHex(0x1ec8e0); m.emissiveIntensity = .06 + glow*.4; }
      else { m.emissive.setHex(m.userData.baseEmissive||0); m.emissiveIntensity = m.userData.baseIntensity !== undefined ? m.userData.baseIntensity : 1; }
    });
  });

  const st = Math.sin(orbit.theta), ct = Math.cos(orbit.theta), sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
  camera.position.set(orbit.target.x + orbit.radius*sp*st, orbit.target.y + orbit.radius*cp, orbit.target.z + orbit.radius*sp*ct);
  camera.lookAt(orbit.target);
  renderer.render(scene, camera);
}

/* ---------- Steuerung: Ziehen, Mausrad, Pinch, Doppelklick, Tastatur ---------- */
function bindControls(dom){
  dom.style.touchAction = 'none';
  dom.tabIndex = 0;
  dom.setAttribute('aria-label', '3D-Ansicht der Roboterzelle. Pfeiltasten drehen, Plus/Minus zoomen, 0 setzt die Ansicht zurück.');
  dom.addEventListener('pointerdown', e => { orbit.pointers[e.pointerId] = { x:e.clientX, y:e.clientY }; dom.setPointerCapture && dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', e => {
    const p = orbit.pointers[e.pointerId]; if(!p) return;
    const ids = Object.keys(orbit.pointers);
    if(ids.length === 2){
      const [a, b] = ids.map(id => orbit.pointers[id]);
      p.x = e.clientX; p.y = e.clientY;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if(orbit.pinch) orbit.radius = Math.max(5.5, Math.min(20, orbit.radius * orbit.pinch / d));
      orbit.pinch = d; return;
    }
    orbit.theta -= (e.clientX - p.x) * 0.0065;
    orbit.phi = Math.max(0.25, Math.min(1.45, orbit.phi - (e.clientY - p.y) * 0.005));
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => { delete orbit.pointers[e.pointerId]; orbit.pinch = 0; };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up); dom.addEventListener('pointerleave', up);
  dom.addEventListener('wheel', e => { e.preventDefault(); orbit.radius = Math.max(5.5, Math.min(20, orbit.radius + e.deltaY*0.01)); }, { passive:false });
  dom.addEventListener('dblclick', resetView);
  dom.addEventListener('keydown', e => {
    const k = e.key;
    if(k === 'ArrowLeft') orbit.theta += .12; else if(k === 'ArrowRight') orbit.theta -= .12;
    else if(k === 'ArrowUp') orbit.phi = Math.max(.25, orbit.phi - .08); else if(k === 'ArrowDown') orbit.phi = Math.min(1.45, orbit.phi + .08);
    else if(k === '+' || k === '=') orbit.radius = Math.max(5.5, orbit.radius - .8); else if(k === '-') orbit.radius = Math.min(20, orbit.radius + .8);
    else if(k === '0') resetView(); else return;
    e.preventDefault();
  });
}
function resetView(){ Object.assign(orbit, { theta:HOME.theta, phi:HOME.phi, radius:HOME.radius }); }
function setView(name){
  const V = { front:{theta:0, phi:1.3, radius:10.5}, iso:HOME, top:{theta:0, phi:0.28, radius:12}, side:{theta:1.45, phi:1.2, radius:10.5} };
  Object.assign(orbit, V[name] || HOME);
}
function size(){
  if(!renderer || !holder) return;
  const w = holder.clientWidth || 600; let h = Math.round(w / 1.6);
  // Ein-Bildschirm-Layout: die Anlage füllt den Platz, den die Spalte übrig lässt (Seitenverhältnis frei)
  const wrap = holder.parentNode;
  if(wrap && window.matchMedia && matchMedia('(min-width:981px) and (min-height:560px)').matches && wrap.clientHeight > 120) h = Math.max(140, Math.min(h, wrap.clientHeight - 20));
  holder.style.height = h + 'px'; renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
function activate(){
  if(!isAvailable()) return false;
  holder = document.getElementById('scene3dHolder'); if(!holder) return false;
  if(built && active){ size(); return true; }
  try{
    if(!built){
      camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 80);
      renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      holder.appendChild(renderer.domElement);
      bindControls(renderer.domElement);
      clock = new THREE.Clock();
      build();
      if(window.ResizeObserver){ ro = new ResizeObserver(() => { if(active) size(); }); ro.observe(holder); if(holder.parentNode) ro.observe(holder.parentNode); }
      else window.addEventListener('resize', () => { if(active) size(); });
    }
  }catch(e){
    failed = true;
    holder.innerHTML = '<div class="scene3d-fallback"><i class="fa-solid fa-cube"></i>3D-Ansicht konnte nicht gestartet werden (WebGL nicht verfügbar).<br>Die 2D-Ansicht funktioniert weiterhin vollständig.</div>';
    return false;
  }
  active = true; clock.getDelta(); size(); loop();
  return true;
}
function deactivate(){ active = false; if(rafId) cancelAnimationFrame(rafId); }

root.Scene3D = { setChannel, setActiveChannels, setPartState, partEvent, resetCounts, activate, deactivate, isAvailable, resetView, setView };
})(typeof window !== 'undefined' ? window : globalThis);
