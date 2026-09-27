(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — 3D-Werkstatt im Untergeschoss (three.js r128, alles prozedural)
   docs/SENSORWERKSTATT_PLAN.md Teil 2. Einheiten: Meter. Raum 9 × 6 m (x −4.5…4.5, z −3…3), Boden y = 0.
   Prüfstand Mitte (Tisch 2,0 × 0,8 m, Höhe 0,90), Sortierstrecke links, Bedienpult vorne, Tankstation rechts,
   Schaltschrank hinten Mitte, Werkbank + Werkzeugwand links, Laptop auf der Werkbank, ARIA-Röhrenmonitor in der Ecke.
   Leistung: statische Teile je Material zu einer Geometrie zusammengefasst (Picking über Dreiecksbereiche),
   LEDs als InstancedMesh, Beschriftungen in einem Textur-Atlas. Budget ≤ 120 000 Dreiecke, ≤ 150 Draw-Calls.
   API: SensorScene.mount(holder, { onPick(id), onHover(id), quality, reduceMotion }) →
        { setView(1…7), setState(s), setXray(b), setQuality('hoch'|'mittel'|'niedrig'|'auto'), stats(), components(), screenPos(id), pickAt(x, y), destroy() }
   ============================================================ */
const T = () => root.THREE;
// Bauteile mit BMK, Namen und Ansicht (für Hover-Schild, Detailkarte, Picking)
const COMPONENTS = {
  MB1: 'Vereinzeler am Fallmagazin', M1: 'Bandmotor 24 V DC', B1: 'Induktiver Sensor M18, bündig, PNP NO', B2: 'Kapazitiver Sensor M18, PNP NO (Poti)',
  B3: 'Lichttaster mit Hintergrundausblendung', 'B4.1': 'Einweg-Lichtschranke Sender', 'B4.2': 'Einweg-Lichtschranke Empfänger', B5: 'Reflexions-Lichtschranke', R5: 'Reflektor',
  MB2: 'Auswerfer (Pneumatikzylinder)', B6: 'Zylinderschalter hinten', B7: 'Zylinderschalter vorne', S5: 'Sicherheits-Positionsschalter Haube (Öffner)', HAUBE: 'Schutzhaube (Plexiglas)',
  S1: 'Taster Start (grün)', S2: 'Taster Stopp (rot)', S3: 'Not-Halt (Pilzkopf)', S4: 'Wahlschalter Hand/Auto', R1: 'Sollwertsteller 0–10 V', P1: 'Leuchtmelder grün', P2: 'Leuchtmelder rot', P3: 'Hupe',
  TANK: 'Messtank Ø 300 mm', VORRAT: 'Vorratsbehälter 40 l', M2: 'Kreiselpumpe', T2: 'Frequenzumrichter', MB4: 'Zulauf-Magnetventil', MB5: 'Proportional-Stellventil 4–20 mA', MB3: 'Ablauf-Magnetventil', E1: 'Heizstab (über -K3)',
  B10: 'Ultraschallsensor M30, 0–10 V', B11: 'Drucktransmitter 0–100 mbar, 4–20 mA', B12: 'PT100 mit Kopftransmitter', B13: 'Magnetisch-induktiver Durchflussmesser', B8: 'Kapazitiver Grenzschalter „Tank voll“', B9: 'Schwimmerschalter Trockenlauf',
  SCHRANK: 'Schaltschrank 800 × 600 × 250 mm', Q0: 'Hauptschalter', F1: 'Leitungsschutzschalter', G1: 'Netzteil 24 V DC 5 A', F2: 'Sicherung Sensoren', F3: 'Sicherung Aktoren', K0: 'Sicherheitsrelais (verplombt)',
  A1: 'CPU 1214C DC/DC/DC', A2: 'SM 1231 AI 4', A3: 'SM 1232 AQ 2', A4: 'SM 1221 DI 8', K1: 'Koppelrelais Band', K2: 'Koppelrelais Pumpe frei', K3: 'Halbleiterrelais Heizung',
  X1: 'Klemmleiste -X1 Versorgung', X2: 'Klemmleiste -X2 digitale Sensoren', X3: 'Klemmleiste -X3 Analogsignale', X4: 'Klemmleiste -X4 Aktoren',
  LAPTOP: 'Engineering-Laptop', HMI: 'HMI-Panel 7"', ARIA: 'ARIA (Röhrenmonitor)', WERKBANK: 'Werkbank mit Ersatzteilregal', KISTEN: 'Ersatzteilkisten',
  T_SCHRAUBER: 'Schraubendreher', T_ABISOL: 'Abisolierzange', T_CRIMP: 'Crimpzange (Aderendhülsen)', T_MULTI: 'Multimeter', T_KALIB: 'Stromkalibrator', T_GABEL: 'Gabelschlüssel', T_KABEL: 'Kabelrollen'
};
const VIEWS = {
  1: { name: 'Übersicht', pos: [4.2, 3.2, 4.6], target: [-0.2, 1.0, -0.6], orbit: 0.9 },
  2: { name: 'Sortierstrecke', pos: [-0.4, 1.55, 1.25], target: [-0.4, 0.95, -0.15], orbit: 0.5 },
  3: { name: 'Bedienpult', pos: [0.45, 1.35, 1.05], target: [0.45, 0.95, 0.3], orbit: 0.4 },
  4: { name: 'Tankstation', pos: [2.2, 1.5, 1.7], target: [2.2, 0.85, -0.35], orbit: 0.5 },
  5: { name: 'Schaltschrank', pos: [0.0, 1.45, -1.15], target: [0.0, 1.35, -2.8], orbit: 0.35, door: true },
  6: { name: 'Klemmleiste nah', ortho: true, pos: [0.0, 1.02, -1.9], target: [0.0, 1.02, -2.9], half: 0.34, door: true },
  7: { name: 'Engineering-Laptop', pos: [-3.05, 1.3, -0.75], target: [-3.35, 0.92, -1.55], orbit: 0.25 }
};
const MAT_COLORS = {
  stahl: 0x8f959c, edelstahl: 0xd9dde2, aluminium: 0xb8bcc0, messing: 0xc9a13b, kunststoff_w: 0xf2f2ee, kunststoff_s: 0x1d1d1f, glas: 0xbfe6ff
};

function mount(holder, opt){
  const THREE = T(); if(!THREE) throw new Error('three.js fehlt');
  opt = opt || {};
  const reduce = opt.reduceMotion != null ? opt.reduceMotion : (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.preserve });
  renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x14171b); scene.fog = new THREE.Fog(0x14171b, 10, 22);
  const persp = new THREE.PerspectiveCamera(45, 1.6, 0.03, 40);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  let camera = persp;

  /* ---------- Materialien ---------- */
  const M = {};
  const std = (k, color, o) => { M[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, metalness: .1 }, o || {})); return M[k]; };
  std('concrete', 0x7d7f80, { roughness: .95 }); std('epoxy', 0x5c6167, { roughness: .45 }); std('yellow', 0xe8c220, { roughness: .6 });
  std('alu', 0xb9c0c8, { metalness: .8, roughness: .35 }); std('darkalu', 0x6e757d, { metalness: .7, roughness: .4 }); std('steel', 0x8a9097, { metalness: .85, roughness: .35 });
  std('rubber', 0x1c1f22, { roughness: .9 }); std('black', 0x151719, { roughness: .6 }); std('grey', 0x9aa0a6, { roughness: .6 }); std('white', 0xe9ebee, { roughness: .5 });
  std('wood', 0x8b6b45, { roughness: .8 }); std('pegboard', 0x9b8a6a, { roughness: .9 }); std('cabinet', 0xc8cbce, { metalness: .3, roughness: .5 });
  std('plate', 0xb5b9bc, { metalness: .7, roughness: .45 }); std('siemens', 0x3b4750, { roughness: .5 }); std('duct', 0x8d9296, { roughness: .7 });
  std('red', 0xc0392b); std('green', 0x1f9d55); std('blue', 0x2f6fd0); std('orange', 0xe67e22); std('brown', 0x7b4a24); std('grey2', 0x4a5057, { roughness: .7 });
  std('brass', 0xc9a13b, { metalness: .8, roughness: .35 }); std('crt', 0x2b2a24, { roughness: .7 });
  M.plexi = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, transparent: true, opacity: .18, roughness: .1, depthWrite: false, side: THREE.DoubleSide });
  M.acryl = new THREE.MeshStandardMaterial({ color: 0xdff2ff, transparent: true, opacity: .22, roughness: .05, depthWrite: false, side: THREE.DoubleSide });
  M.waterSide = new THREE.MeshStandardMaterial({ color: 0x3a8fd8, transparent: true, opacity: .55, roughness: .1, depthWrite: false });
  M.beltMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: .9 });
  M.emissLamp = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0, roughness: .3 });

  /* ---------- Zusammenfassen statischer Geometrie ---------- */
  const merge = {};    // matKey → { pos:[], nrm:[], uv:[], idx:[], ranges:[{start, count, id}] }
  const tmpM = new THREE.Matrix4(), tmpN = new THREE.Matrix3();
  const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16), cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), sph: new THREE.SphereGeometry(0.5, 12, 8) };
  function add(matKey, geo, pos, rot, scale, id){
    const g = merge[matKey] || (merge[matKey] = { pos: [], nrm: [], uv: [], idx: [], ranges: [] });
    tmpM.compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(...(scale || [1, 1, 1])));
    tmpN.getNormalMatrix(tmpM);
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, base = g.pos.length / 3, v = new THREE.Vector3();
    for(let i = 0; i < P.count; i++){
      v.fromBufferAttribute(P, i).applyMatrix4(tmpM); g.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(tmpN).normalize(); g.nrm.push(v.x, v.y, v.z);
      if(U) g.uv.push(U.getX(i), U.getY(i)); else g.uv.push(0, 0);
    }
    const start = g.idx.length;
    if(geo.index) for(let i = 0; i < geo.index.count; i++) g.idx.push(base + geo.index.getX(i));
    else for(let i = 0; i < P.count; i++) g.idx.push(base + i);
    if(id) g.ranges.push({ start: start / 3, count: (g.idx.length - start) / 3, id });
  }
  const B = (m, x, y, z, w, h, d, id, rot) => add(m, GEO.box, [x, y, z], rot, [w, h, d], id);
  const C = (m, x, y, z, r, h, id, rot, seg8) => add(m, seg8 ? GEO.cyl8 : GEO.cyl, [x, y, z], rot, [2 * r, h, 2 * r], id);
  const S = (m, x, y, z, r, id, sy) => add(m, GEO.sph, [x, y, z], null, [2 * r, 2 * r * (sy || 1), 2 * r], id);
  const pickMeshes = [];
  function flush(){
    Object.keys(merge).forEach(k => {
      const g = merge[k]; if(!g.idx.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setIndex(g.idx); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, M[k]); mesh.castShadow = !['epoxy', 'concrete', 'plexi', 'acryl'].includes(k); mesh.receiveShadow = true;
      mesh.userData.ranges = g.ranges; scene.add(mesh); pickMeshes.push(mesh);
    });
  }

  /* ---------- Beschriftungen im Atlas ---------- */
  const atlas = { list: [], canvas: null };
  function text(str, x, y, z, w, h, opt2){ atlas.list.push({ str, pos: [x, y, z], w, h, rotY: (opt2 && opt2.rotY) || 0, rotX: (opt2 && opt2.rotX) || 0, color: (opt2 && opt2.color) || '#111', bg: (opt2 && opt2.bg) || null, bold: !(opt2 && opt2.thin) }); }
  function buildAtlas(){
    const n = atlas.list.length; if(!n) return;
    const cols = 8, cw = 256, ch = 64, rows = Math.ceil(n / cols);
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = Math.max(64, Math.pow(2, Math.ceil(Math.log2(rows * ch)))); const x = cv.getContext('2d');
    const pos = [], uv = [], idx = [];
    atlas.list.forEach((L, i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      if(L.bg){ x.fillStyle = L.bg; x.fillRect(cx + 1, cy + 1, cw - 2, ch - 2); }
      let fs = 38; x.font = (L.bold ? '700 ' : '500 ') + fs + 'px monospace';
      while(x.measureText(L.str).width > cw - 12 && fs > 12){ fs -= 2; x.font = (L.bold ? '700 ' : '500 ') + fs + 'px monospace'; }
      x.fillStyle = L.color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(L.str, cx + cw / 2, cy + ch / 2 + 2);
      const u0 = cx / cv.width, u1 = (cx + cw) / cv.width, v1 = 1 - cy / cv.height, v0 = 1 - (cy + ch) / cv.height;
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(...L.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(L.rotX, L.rotY, 0)), new THREE.Vector3(L.w, L.h, 1));
      const b = pos.length / 3;
      [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].forEach(([a, c]) => { const v = new THREE.Vector3(a, c, 0).applyMatrix4(m4); pos.push(v.x, v.y, v.z); });
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.renderOrder = 2; scene.add(m);
  }

  /* ---------- LEDs (InstancedMesh mit Farbe pro Instanz) ---------- */
  const leds = [];   // { id, pos, on:color, off:color, state }
  function led(id, x, y, z, on, r){ leds.push({ id, pos: [x, y, z], on: new THREE.Color(on), off: new THREE.Color(on).multiplyScalar(0.18), r: r || 0.004, lit: false, blink: false }); }
  let ledMesh = null;
  function buildLeds(){
    ledMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), leds.length);
    const m = new THREE.Matrix4();
    leds.forEach((l, i) => { m.compose(new THREE.Vector3(...l.pos), new THREE.Quaternion(), new THREE.Vector3(l.r, l.r, l.r * 0.6)); ledMesh.setMatrixAt(i, m); ledMesh.setColorAt(i, l.off); });
    ledMesh.instanceColor.needsUpdate = true; scene.add(ledMesh);
  }
  const ledIndex = {}; const setLed = (id, lit, blink) => { const i = ledIndex[id]; if(i == null) return; leds[i].lit = !!lit; leds[i].blink = !!blink; };

  /* ---------- Licht ---------- */
  scene.add(new THREE.HemisphereLight(0xc8d4e0, 0x2a2622, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(2.5, 5, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, near: 0.5, far: 14 }); sun.shadow.bias = -0.0006; scene.add(sun);
  const hall1 = new THREE.PointLight(0xe9f0ff, 0.45, 9); hall1.position.set(-1.8, 2.9, 0); scene.add(hall1);
  const hall2 = new THREE.PointLight(0xe9f0ff, 0.45, 9); hall2.position.set(2.0, 2.9, 0); scene.add(hall2);
  const work = new THREE.SpotLight(0xffc98a, 0.9, 5, 0.6, 0.6, 1.2); work.position.set(-3.3, 2.2, -1.0); work.target.position.set(-3.3, 0.9, -1.3); scene.add(work, work.target);

  /* ---------- Raum ---------- */
  B('epoxy', 0, -0.025, 0, 9, 0.05, 6);
  // gelbe Sicherheitsmarkierung um den Prüfstand
  [[-1.25, 0.001, -0.1, 0.06, 1.4], [1.25, 0.001, -0.1, 0.06, 1.4], [0, 0.001, 0.62, 2.56, 0.06], [0, 0.001, -0.82, 2.56, 0.06]].forEach(([x, y, z, w, d]) => B('yellow', x, y, z, w, 0.004, d));
  B('concrete', 0, 1.6, -3.05, 9, 3.2, 0.1); B('concrete', -4.55, 1.6, 0, 0.1, 3.2, 6); B('concrete', 4.55, 1.6, -1.5, 0.1, 3.2, 3);
  B('concrete', 0, 3.2, -1.5, 9, 0.05, 3.2);
  B('yellow', 0, 0.06, -2.99, 9, 0.12, 0.02);   // Lichtband unten (Sockel)
  // Hallenleuchten
  [-1.8, 2.0].forEach(x => { B('grey2', x, 2.95, 0, 1.2, 0.06, 0.18); B('white', x, 2.915, 0, 1.15, 0.01, 0.14); });
  text('WERKSTATT · UG', -1.8, 2.5, -2.99, 1.4, 0.3, { color: 'rgba(255,255,255,.35)' });

  /* ---------- Werkzeugwand + Werkbank links ---------- */
  B('pegboard', -3.25, 1.55, -2.97, 2.0, 1.1, 0.03, 'WERKBANK');
  const tool = (id, x, y, draw) => { draw(x, y); };
  tool('T_SCHRAUBER', -4.0, 1.7, (x, y) => { C('red', x, y, -2.93, 0.018, 0.12, 'T_SCHRAUBER'); C('steel', x, y - 0.13, -2.93, 0.004, 0.14, 'T_SCHRAUBER'); });
  tool('T_ABISOL', -3.7, 1.7, (x, y) => { B('blue', x - 0.02, y, -2.93, 0.02, 0.16, 0.02, 'T_ABISOL', [0, 0, 0.15]); B('blue', x + 0.02, y, -2.93, 0.02, 0.16, 0.02, 'T_ABISOL', [0, 0, -0.15]); B('steel', x, y + 0.1, -2.93, 0.03, 0.05, 0.015, 'T_ABISOL'); });
  tool('T_CRIMP', -3.4, 1.7, (x, y) => { B('orange', x - 0.025, y, -2.93, 0.022, 0.18, 0.02, 'T_CRIMP', [0, 0, 0.12]); B('orange', x + 0.025, y, -2.93, 0.022, 0.18, 0.02, 'T_CRIMP', [0, 0, -0.12]); B('steel', x, y + 0.11, -2.93, 0.05, 0.06, 0.02, 'T_CRIMP'); });
  tool('T_MULTI', -3.05, 1.68, (x, y) => { B('yellow', x, y, -2.92, 0.11, 0.2, 0.04, 'T_MULTI'); B('black', x, y + 0.05, -2.899, 0.08, 0.05, 0.004, 'T_MULTI'); C('black', x, y - 0.03, -2.897, 0.022, 0.01, 'T_MULTI', [Math.PI / 2, 0, 0]); });
  tool('T_KALIB', -2.75, 1.68, (x, y) => { B('grey2', x, y, -2.92, 0.12, 0.18, 0.045, 'T_KALIB'); B('green', x, y + 0.05, -2.896, 0.08, 0.04, 0.004, 'T_KALIB'); });
  tool('T_GABEL', -2.45, 1.72, (x, y) => { B('steel', x, y, -2.93, 0.02, 0.2, 0.006, 'T_GABEL'); B('steel', x, y + 0.11, -2.93, 0.05, 0.03, 0.006, 'T_GABEL'); });
  [-4.0, -3.6].forEach((x, i) => C(i ? 'blue' : 'brown', x, 1.28, -2.9, 0.08, 0.06, 'T_KABEL', [Math.PI / 2, 0, 0]));
  text('Werkzeug', -3.25, 2.15, -2.955, 0.6, 0.12, { color: '#222' });
  // Werkbank
  B('wood', -3.3, 0.88, -1.35, 1.9, 0.05, 0.75, 'WERKBANK');
  [[-4.18, -1.66], [-4.18, -1.04], [-2.42, -1.66], [-2.42, -1.04]].forEach(([x, z]) => B('darkalu', x, 0.43, z, 0.05, 0.86, 0.05));
  // Ersatzteilregal mit Kisten
  B('darkalu', -4.35, 0.55, 0.5, 0.35, 1.1, 1.3, 'KISTEN');
  ['SENSOREN', 'KABEL', 'KLEMMEN', 'HÜLSEN'].forEach((t, i) => { B(i % 2 ? 'blue' : 'red', -4.2, 0.2 + i * 0.27, 0.5, 0.06, 0.2, 1.1, 'KISTEN'); text(t, -4.165, 0.2 + i * 0.27, 0.5, 0.9, 0.12, { rotY: Math.PI / 2, color: '#fff' }); });
  // Laptop
  B('grey2', -3.35, 0.915, -1.4, 0.36, 0.018, 0.25, 'LAPTOP');
  B('grey2', -3.35, 1.03, -1.53, 0.36, 0.23, 0.012, 'LAPTOP', [-0.25, 0, 0]);
  const laptopScr = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.2), new THREE.MeshBasicMaterial({ color: 0x1c4f7a })); laptopScr.position.set(-3.35, 1.03, -1.522); laptopScr.rotation.x = -0.25; scene.add(laptopScr);

  /* ---------- Prüfstand (Aluminium-Profilgestell 2,0 × 0,8, Tisch 0,90) ---------- */
  const tz = -0.1;
  [[-1, tz - 0.4], [1, tz - 0.4], [-1, tz + 0.4], [1, tz + 0.4], [0, tz - 0.4], [0, tz + 0.4]].forEach(([x, z]) => B('alu', x, 0.43, z, 0.04, 0.86, 0.04));
  [tz - 0.4, tz + 0.4].forEach(z => { B('alu', 0, 0.86, z, 2.04, 0.04, 0.04); B('alu', 0, 0.12, z, 2.04, 0.04, 0.04); });
  [-1, 0, 1].forEach(x => B('alu', x, 0.86, tz, 0.04, 0.04, 0.8));
  B('darkalu', 0, 0.885, tz, 2.0, 0.012, 0.8);   // Nutenplatte
  for(let i = -9; i <= 9; i++) B('grey2', i * 0.1, 0.892, tz, 0.006, 0.002, 0.78);   // Nuten

  // Sortierstrecke (links, x −0.98 … 0.2), Band y ≈ 0.95
  const by = 0.95, bz = tz;
  B('darkalu', -0.39, by - 0.03, bz, 1.2, 0.05, 0.1, 'M1');
  B('darkalu', -0.39, by - 0.01, bz + 0.055, 1.2, 0.04, 0.012); B('darkalu', -0.39, by - 0.01, bz - 0.055, 1.2, 0.04, 0.012);
  C('darkalu', -0.99, by, bz, 0.025, 0.1, 'M1', [Math.PI / 2, 0, 0]); C('darkalu', 0.21, by, bz, 0.025, 0.1, 'M1', [Math.PI / 2, 0, 0]);
  B('grey2', 0.3, by - 0.02, bz - 0.09, 0.12, 0.08, 0.08, 'M1');   // Getriebemotor
  const beltCv = document.createElement('canvas'); beltCv.width = 128; beltCv.height = 16; const bcx = beltCv.getContext('2d');
  bcx.fillStyle = '#26292d'; bcx.fillRect(0, 0, 128, 16); bcx.fillStyle = '#3c4046'; for(let i = 0; i < 128; i += 16) bcx.fillRect(i, 0, 6, 16);
  const beltTex = new THREE.CanvasTexture(beltCv); beltTex.wrapS = THREE.RepeatWrapping; beltTex.repeat.set(12, 1);
  M.beltMat.map = beltTex;
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.06), M.beltMat); belt.rotation.x = -Math.PI / 2; belt.position.set(-0.39, by + 0.001, bz); belt.receiveShadow = true; scene.add(belt);
  // Fallmagazin + Vereinzeler MB1
  B('plexi', -0.93, by + 0.18, bz, 0.06, 0.32, 0.06, 'MB1'); B('darkalu', -0.93, by + 0.36, bz, 0.08, 0.02, 0.08, 'MB1');
  C('steel', -0.93, by + 0.02, bz - 0.09, 0.012, 0.1, 'MB1', [Math.PI / 2, 0, 0]);
  const pusher = new THREE.Mesh(GEO.box, M.alu); pusher.scale.set(0.03, 0.02, 0.05); pusher.position.set(-0.93, by + 0.02, bz - 0.06); scene.add(pusher);
  // Sensorhalter an der Nut: Sensoren quer zur Bandlaufrichtung auf der Hinterseite (z = bz − 0.09)
  const sensorsAt = { B1: -0.7, B2: -0.55, B3: -0.4, 'B4': -0.25, B5: 0.12 };
  const holder3 = (id, x, zSide) => { B('alu', x, by + 0.06, bz + zSide * 0.11, 0.02, 0.14, 0.02); };
  holder3('B1', sensorsAt.B1, -1); C('steel', sensorsAt.B1, by + 0.03, bz - 0.075, 0.009, 0.06, 'B1', [Math.PI / 2, 0, 0]); B('grey2', sensorsAt.B1, by + 0.03, bz - 0.11, 0.016, 0.016, 0.02, 'B1');
  led('B1_Y', sensorsAt.B1 + 0.006, by + 0.04, bz - 0.12, 0xffc400); led('B1_G', sensorsAt.B1 - 0.006, by + 0.04, bz - 0.12, 0x2ecc71);
  holder3('B2', sensorsAt.B2, -1); C('grey2', sensorsAt.B2, by + 0.03, bz - 0.075, 0.009, 0.06, 'B2', [Math.PI / 2, 0, 0]); C('brass', sensorsAt.B2, by + 0.03, bz - 0.108, 0.003, 0.006, 'B2', [Math.PI / 2, 0, 0]);
  led('B2_Y', sensorsAt.B2 + 0.006, by + 0.042, bz - 0.11, 0xffc400);
  holder3('B3', sensorsAt.B3, -1); B('black', sensorsAt.B3, by + 0.04, bz - 0.09, 0.02, 0.04, 0.03, 'B3'); led('B3_Y', sensorsAt.B3, by + 0.063, bz - 0.1, 0xffc400);
  holder3('B4.1', sensorsAt.B4, -1); B('grey2', sensorsAt.B4, by + 0.03, bz - 0.09, 0.02, 0.03, 0.025, 'B4.1');
  holder3('B4.2', sensorsAt.B4, 1); B('grey2', sensorsAt.B4, by + 0.03, bz + 0.09, 0.02, 0.03, 0.025, 'B4.2'); led('B4_Y', sensorsAt.B4, by + 0.05, bz + 0.1, 0xffc400); led('B4_G', sensorsAt.B4 + 0.006, by + 0.05, bz + 0.1, 0x2ecc71);
  // Auswerfer MB2 mit Zylinderschaltern
  const cylX = -0.05;
  C('alu', cylX, by + 0.03, bz - 0.22, 0.018, 0.16, 'MB2', [Math.PI / 2, 0, 0]);
  B('grey2', cylX, by + 0.055, bz - 0.26, 0.012, 0.01, 0.02, 'B6'); B('grey2', cylX, by + 0.055, bz - 0.17, 0.012, 0.01, 0.02, 'B7');
  led('B6', cylX + 0.008, by + 0.06, bz - 0.26, 0xffc400, 0.003); led('B7', cylX + 0.008, by + 0.06, bz - 0.17, 0xffc400, 0.003);
  const rod = new THREE.Mesh(GEO.cyl, M.steel); rod.rotation.x = Math.PI / 2; rod.scale.set(0.012, 0.1, 0.012); rod.position.set(cylX, by + 0.03, bz - 0.12); scene.add(rod);
  const plate = new THREE.Mesh(GEO.box, M.alu); plate.scale.set(0.05, 0.03, 0.01); scene.add(plate);
  // Rutsche A (vorne) und Behälter B (Bandende)
  B('alu', cylX, by - 0.08, bz + 0.2, 0.08, 0.01, 0.2, null, [0.5, 0, 0]); B('grey2', cylX, 0.62, bz + 0.33, 0.12, 0.1, 0.12);
  text('A', cylX, 0.66, bz + 0.391, 0.05, 0.04, { color: '#fff' });
  B('grey2', 0.3, 0.8, bz + 0.05, 0.14, 0.14, 0.14); text('B', 0.3, 0.8, bz + 0.121, 0.05, 0.04, { color: '#fff' });
  // Reflexions-Lichtschranke B5 am Behälter, Reflektor gegenüber
  B('grey2', 0.3, 0.9, bz - 0.04, 0.02, 0.025, 0.02, 'B5'); B('red', 0.3, 0.9, bz + 0.14, 0.02, 0.025, 0.005, 'R5'); led('B5_Y', 0.31, 0.915, bz - 0.04, 0xffc400);
  // Schutzhaube mit Positionsschalter S5
  B('plexi', -0.39, by + 0.13, bz, 1.22, 0.004, 0.3, 'HAUBE'); B('plexi', -0.39, by + 0.07, bz + 0.15, 1.22, 0.12, 0.004, 'HAUBE');
  B('red', -0.99, by + 0.12, bz + 0.16, 0.02, 0.03, 0.02, 'S5');

  // Bedienpult vorne Mitte (schräg)
  const px = 0.5, pz = tz + 0.33, tilt = -0.5;
  B('grey2', px, 0.97, pz, 0.42, 0.14, 0.14, null);
  B('siemens', px, 1.05, pz + 0.02, 0.42, 0.01, 0.16, null, [tilt, 0, 0]);
  const pyTop = 1.06, pzTop = pz + 0.02;
  const btn = (id, x, color, r) => { C(color, x, pyTop + 0.01, pzTop, r, 0.02, id, [tilt, 0, 0]); };
  btn('S1', px - 0.16, 'green', 0.016); btn('S2', px - 0.1, 'red', 0.016); C('red', px - 0.02, pyTop + 0.02, pzTop, 0.026, 0.02, 'S3', [tilt, 0, 0]); C('yellow', px - 0.02, pyTop + 0.005, pzTop, 0.034, 0.004, 'S3', [tilt, 0, 0]);
  C('black', px + 0.06, pyTop + 0.012, pzTop, 0.014, 0.02, 'S4', [tilt, 0, 0]); C('grey', px + 0.12, pyTop + 0.012, pzTop, 0.016, 0.02, 'R1', [tilt, 0, 0]);
  C('black', px + 0.165, pyTop + 0.008, pzTop - 0.01, 0.016, 0.014, 'P1', [tilt, 0, 0]); C('black', px + 0.19, pyTop + 0.008, pzTop - 0.01, 0.016, 0.014, 'P2', [tilt, 0, 0]);
  led('P1', px + 0.165, pyTop + 0.018, pzTop - 0.01, 0x2ecc71, 0.012); led('P2', px + 0.19, pyTop + 0.018, pzTop - 0.01, 0xff3b30, 0.012);
  C('black', px + 0.19, 0.97, pz + 0.075, 0.018, 0.02, 'P3', [Math.PI / 2, 0, 0]);
  [['START', -0.16], ['STOPP', -0.1], ['NOT-HALT', -0.02], ['HAND/AUTO', 0.06], ['SOLL', 0.12]].forEach(([t, dx]) => text(t, px + dx, pyTop + 0.012, pzTop + 0.045, 0.06, 0.012, { rotX: -Math.PI / 2 + 0.5 + Math.PI, color: '#ddd', rotY: 0 }));
  // HMI-Panel 7" am Prüfstand
  B('black', 0.72, 1.18, tz - 0.35, 0.2, 0.14, 0.02, 'HMI'); B('alu', 0.72, 1.02, tz - 0.36, 0.02, 0.2, 0.02);
  const hmiCv = document.createElement('canvas'); hmiCv.width = 256; hmiCv.height = 160; const hmiCtx = hmiCv.getContext('2d'); const hmiTex = new THREE.CanvasTexture(hmiCv);
  const hmi = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshBasicMaterial({ map: hmiTex })); hmi.position.set(0.72, 1.18, tz - 0.339); scene.add(hmi);

  /* ---------- Tankstation rechts ---------- */
  const tx = 2.2, tzk = -0.35, tr = 0.15, th = 0.6, tBase = 0.55;
  B('darkalu', tx, 0.25, tzk, 0.8, 0.5, 0.55, 'VORRAT'); B('blue', tx, 0.3, tzk + 0.28, 0.6, 0.3, 0.004, 'VORRAT');
  B('alu', tx, tBase - 0.02, tzk, 0.42, 0.04, 0.42);
  add('acryl', new THREE.CylinderGeometry(tr, tr, th, 32, 1, true), [tx, tBase + th / 2, tzk], null, null, 'TANK');
  C('darkalu', tx, tBase + th + 0.01, tzk, tr + 0.01, 0.02, 'TANK');
  for(let i = 1; i <= 5; i++) B('black', tx - tr - 0.002, tBase + i * 0.1, tzk, 0.002, 0.002, 0.03);   // Skala
  const water = new THREE.Mesh(new THREE.CylinderGeometry(tr - 0.004, tr - 0.004, 1, 32, 1), M.waterSide); water.position.set(tx, tBase, tzk); scene.add(water);
  const surfMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { t: { value: 0 }, amp: { value: 0.002 } },
    vertexShader: 'uniform float t; uniform float amp; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; float r = length(p.xy); p.z += amp * sin(r * 90.0 - t * 6.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float d = length(vUv - 0.5); gl_FragColor = vec4(mix(vec3(0.35,0.66,0.92), vec3(0.2,0.45,0.8), d * 1.6), 0.8); }' });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(tr - 0.004, 32, 0, Math.PI * 2), surfMat); surface.rotation.x = -Math.PI / 2; scene.add(surface);
  // Pumpe M2 + FU T2, Ventile, Rohre
  C('blue', tx - 0.3, 0.6, tzk + 0.05, 0.05, 0.1, 'M2', [0, 0, Math.PI / 2]); const impeller = new THREE.Mesh(GEO.box, M.steel); impeller.scale.set(0.004, 0.06, 0.012); impeller.position.set(tx - 0.24, 0.6, tzk + 0.05); scene.add(impeller);
  B('grey2', tx - 0.33, 0.8, tzk - 0.2, 0.1, 0.16, 0.08, 'T2'); led('T2', tx - 0.33, 0.85, tzk - 0.157, 0x2ecc71, 0.004);
  C('steel', tx - 0.15, 1.2, tzk, 0.012, 0.6, null, [0, 0, Math.PI / 2]); C('steel', tx - 0.3, 0.9, tzk, 0.012, 0.62);
  B('black', tx - 0.22, 1.2, tzk, 0.05, 0.05, 0.05, 'MB4'); C('orange', tx - 0.08, 1.2, tzk, 0.03, 0.05, 'MB5'); B('grey2', tx - 0.08, 1.25, tzk, 0.03, 0.03, 0.03, 'MB5');
  B('black', tx + 0.22, tBase + 0.03, tzk, 0.05, 0.05, 0.05, 'MB3'); C('steel', tx + 0.16, tBase + 0.03, tzk, 0.01, 0.12, null, [0, 0, Math.PI / 2]);
  C('steel', tx, tBase + 0.25, tzk + 0.08, 0.006, 0.45, 'E1'); B('grey2', tx, tBase + th + 0.04, tzk + 0.08, 0.04, 0.04, 0.04, 'E1');
  const heatGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0 })); heatGlow.position.set(tx, tBase + 0.22, tzk + 0.08); scene.add(heatGlow);
  // Messtechnik
  C('grey2', tx, tBase + th + 0.06, tzk - 0.05, 0.02, 0.08, 'B10'); led('B10', tx + 0.02, tBase + th + 0.08, tzk - 0.05, 0x2ecc71, 0.003);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x58c4ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(tx, tBase + th - 0.28, tzk - 0.05); cone.visible = false; scene.add(cone);
  C('grey', tx + 0.1, tBase + 0.02, tzk + 0.13, 0.02, 0.05, 'B11'); C('grey', tx - 0.07, tBase + 0.2, tzk - 0.15, 0.025, 0.04, 'B12'); C('darkalu', tx - 0.07, tBase + 0.24, tzk - 0.15, 0.03, 0.03, 'B12');
  C('blue', tx - 0.3, 1.02, tzk, 0.025, 0.08, 'B13'); B('grey2', tx - 0.33, 1.02, tzk, 0.04, 0.05, 0.05, 'B13');
  B('grey2', tx + tr + 0.015, tBase + th - 0.08, tzk, 0.02, 0.03, 0.02, 'B8'); led('B8', tx + tr + 0.026, tBase + th - 0.07, tzk, 0xffc400, 0.003);
  const floatB9 = new THREE.Mesh(GEO.sph, M.orange); floatB9.scale.set(0.04, 0.04, 0.04); floatB9.position.set(tx + 0.25, 0.4, tzk + 0.1); scene.add(floatB9);
  B('grey2', tx + 0.25, 0.5, tzk + 0.1, 0.01, 0.2, 0.01, 'B9');
  text('TANK', tx, tBase + th + 0.12, tzk + tr + 0.02, 0.15, 0.04, { color: '#ddd' });

  /* ---------- Schaltschrank hinten Mitte (800 × 600 × 250) ---------- */
  const cx0 = 0, cyc = 1.35, czb = -2.99, cw = 0.6, chh = 0.8, cdd = 0.25, czf = czb + cdd;
  B('cabinet', cx0, cyc, czb + 0.01, cw, chh, 0.02, 'SCHRANK');
  B('cabinet', cx0 - cw / 2, cyc, czb + cdd / 2, 0.02, chh, cdd, 'SCHRANK'); B('cabinet', cx0 + cw / 2, cyc, czb + cdd / 2, 0.02, chh, cdd, 'SCHRANK');
  B('cabinet', cx0, cyc + chh / 2, czb + cdd / 2, cw, 0.02, cdd, 'SCHRANK'); B('cabinet', cx0, cyc - chh / 2, czb + cdd / 2, cw, 0.02, cdd, 'SCHRANK');
  for(let i = 0; i < 6; i++) C('black', cx0 - 0.2 + i * 0.08, cyc + chh / 2 + 0.015, czb + 0.12, 0.012, 0.02, 'SCHRANK');   // M12-Durchführungen
  B('plate', cx0, cyc, czb + 0.03, cw - 0.06, chh - 0.06, 0.004);
  // Hutschienen + Kabelkanäle
  const rails = [cyc + 0.26, cyc + 0.05, cyc - 0.2];
  rails.forEach(y => { B('steel', cx0, y, czb + 0.04, cw - 0.1, 0.035, 0.008); B('duct', cx0, y + 0.1, czb + 0.06, cw - 0.1, 0.05, 0.06); });
  B('duct', cx0 - 0.25, cyc, czb + 0.06, 0.05, chh - 0.12, 0.06); B('duct', cx0 + 0.25, cyc, czb + 0.06, 0.05, chh - 0.12, 0.06);
  // oben: Q0, F1, G1, F2, F3, K0
  const top = rails[0], dz = czb + 0.07;
  B('grey2', cx0 - 0.18, top, dz, 0.05, 0.09, 0.06, 'Q0'); B('red', cx0 - 0.18, top + 0.005, dz + 0.035, 0.02, 0.04, 0.02, 'Q0');
  B('white', cx0 - 0.125, top, dz, 0.018, 0.09, 0.06, 'F1');
  B('grey2', cx0 - 0.05, top, dz, 0.1, 0.1, 0.07, 'G1'); led('G1_DCOK', cx0 - 0.03, top + 0.03, dz + 0.036, 0x2ecc71, 0.004); C('grey', cx0 - 0.07, top + 0.03, dz + 0.036, 0.004, 0.004, 'G1', [Math.PI / 2, 0, 0]);
  B('white', cx0 + 0.02, top, dz, 0.012, 0.08, 0.055, 'F2'); led('F2', cx0 + 0.02, top + 0.03, dz + 0.029, 0xff3b30, 0.003);
  B('white', cx0 + 0.04, top, dz, 0.012, 0.08, 0.055, 'F3'); led('F3', cx0 + 0.04, top + 0.03, dz + 0.029, 0xff3b30, 0.003);
  B('yellow', cx0 + 0.1, top, dz, 0.045, 0.1, 0.07, 'K0'); B('red', cx0 + 0.1, top - 0.03, dz + 0.037, 0.02, 0.01, 0.004, 'K0');
  // Mitte: A1 CPU, A2, A3, A4, K1, K2, K3
  const mid = rails[1];
  B('siemens', cx0 - 0.13, mid, dz, 0.11, 0.1, 0.075, 'A1');
  B('siemens', cx0 - 0.045, mid, dz, 0.045, 0.1, 0.075, 'A2'); B('siemens', cx0 + 0.005, mid, dz, 0.045, 0.1, 0.075, 'A3'); B('siemens', cx0 + 0.055, mid, dz, 0.045, 0.1, 0.075, 'A4');
  ['K1', 'K2', 'K3'].forEach((k, i) => B('grey2', cx0 + 0.11 + i * 0.018, mid, dz, 0.014, 0.075, 0.06, k));
  text('SIMATIC S7-1200', cx0 - 0.13, mid + 0.035, dz + 0.0385, 0.1, 0.012, { color: '#e8eef4' });
  text('1214C', cx0 - 0.13, mid - 0.04, dz + 0.0385, 0.05, 0.012, { color: '#9fd8ff' });
  ['AI 4', 'AQ 2', 'DI 8'].forEach((t, i) => text(t, cx0 - 0.045 + i * 0.05, mid - 0.04, dz + 0.0385, 0.04, 0.011, { color: '#9fd8ff' }));
  // CPU-LEDs: RUN/STOP, ERROR, MAINT + DI a.0–.7 / b.0–.5 + DQ a.0–.7 / b.0–.1
  led('A1_RUN', cx0 - 0.175, mid + 0.02, dz + 0.039, 0x2ecc71, 0.003); led('A1_ERR', cx0 - 0.175, mid + 0.01, dz + 0.039, 0xff3b30, 0.003); led('A1_MAINT', cx0 - 0.175, mid, dz + 0.039, 0xffc400, 0.003);
  for(let b = 0; b < 14; b++) led('DI' + (b < 8 ? '0.' + b : '1.' + (b - 8)), cx0 - 0.155 + b * 0.0055, mid + 0.047, dz + 0.039, 0x2ecc71, 0.0018);
  for(let b = 0; b < 10; b++) led('DQ' + (b < 8 ? '0.' + b : '1.' + (b - 8)), cx0 - 0.155 + b * 0.0055, mid - 0.047, dz + 0.039, 0x2ecc71, 0.0018);
  for(let c = 0; c < 4; c++) led('A2_CH' + c, cx0 - 0.058 + c * 0.008, mid + 0.047, dz + 0.039, 0x2ecc71, 0.0018);
  led('A2_DIAG', cx0 - 0.045, mid + 0.03, dz + 0.039, 0xff3b30, 0.0025);
  for(let b = 0; b < 8; b++) led('DI16.' + b, cx0 + 0.04 + (b % 4) * 0.008, mid + 0.047 - Math.floor(b / 4) * 0.007, dz + 0.039, 0x2ecc71, 0.0018);
  // unten: Klemmleisten X1 (rot/blau), X2 (Initiatorenklemmen mit LED), X3 (Trennklemmen), X4
  const bot = rails[2];
  for(let i = 0; i < 8; i++){ B('red', cx0 - 0.25 + i * 0.008, bot, dz - 0.005, 0.0065, 0.05, 0.05, 'X1'); B('blue', cx0 - 0.184 + i * 0.008, bot, dz - 0.005, 0.0065, 0.05, 0.05, 'X1'); }
  const X2N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 22, 23, 24, 25, 26, 27, 28];
  X2N.forEach((n, i) => { B('grey', cx0 - 0.1 + i * 0.0085, bot, dz, 0.0075, 0.07, 0.06, 'X2'); led('X2_' + n, cx0 - 0.1 + i * 0.0085, bot + 0.028, dz + 0.031, 0xffc400, 0.0022); });
  for(let i = 0; i < 8; i++){ B('orange', cx0 + 0.105 + i * 0.009, bot, dz, 0.008, 0.065, 0.055, 'X3'); B('black', cx0 + 0.105 + i * 0.009, bot - 0.01, dz + 0.029, 0.004, 0.012, 0.004, 'X3'); }
  B('steel', cx0 + 0.14, bot - 0.045, dz + 0.02, 0.08, 0.008, 0.008, 'X3');   // Schirmschiene
  for(let i = 0; i < 10; i++) B('grey2', cx0 + 0.19 + i * 0.0075, bot, dz, 0.0065, 0.05, 0.05, 'X4');
  text('-X1', cx0 - 0.22, bot - 0.045, dz + 0.03, 0.03, 0.01, { color: '#222' }); text('-X2', cx0 - 0.01, bot - 0.045, dz + 0.035, 0.03, 0.01, { color: '#222' });
  text('-X3', cx0 + 0.135, bot - 0.06, dz + 0.03, 0.03, 0.01, { color: '#222' }); text('-X4', cx0 + 0.225, bot - 0.045, dz + 0.03, 0.03, 0.01, { color: '#222' });
  // Tür (öffnet mit Animation)
  const doorPivot = new THREE.Group(); doorPivot.position.set(cx0 - cw / 2, cyc, czf); scene.add(doorPivot);
  const door = new THREE.Mesh(GEO.box, M.cabinet); door.scale.set(cw, chh, 0.015); door.position.set(cw / 2, 0, 0.008); door.castShadow = true; door.userData.pick = 'SCHRANK'; doorPivot.add(door);
  const handle = new THREE.Mesh(GEO.box, M.black); handle.scale.set(0.02, 0.1, 0.02); handle.position.set(cw - 0.05, 0, 0.025); doorPivot.add(handle);
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.2), new THREE.MeshBasicMaterial({ color: 0xf4f1e6 })); plan.position.set(cw / 2, 0.15, 0.017); doorPivot.add(plan);

  /* ---------- ARIA-Röhrenmonitor in der Ecke ---------- */
  B('crt', 4.2, 1.95, -2.75, 0.4, 0.34, 0.36, 'ARIA'); B('grey2', 4.2, 1.72, -2.75, 0.5, 0.06, 0.4);
  const ariaCv = document.createElement('canvas'); ariaCv.width = 128; ariaCv.height = 96; const ariaCtx = ariaCv.getContext('2d'); const ariaTex = new THREE.CanvasTexture(ariaCv);
  const ariaScr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), new THREE.MeshBasicMaterial({ map: ariaTex })); ariaScr.position.set(4.2, 1.96, -2.568); ariaScr.rotation.y = -0.35; scene.add(ariaScr);

  /* ---------- Werkstücke auf dem Band ---------- */
  const partMats = {}; Object.keys(MAT_COLORS).forEach(k => { partMats[k] = new THREE.MeshStandardMaterial({ color: MAT_COLORS[k], metalness: /stahl|alu|messing/.test(k) ? .8 : .05, roughness: k === 'aluminium' ? .6 : .3, transparent: k === 'glas', opacity: k === 'glas' ? .45 : 1 }); });
  const partGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 24);
  const partPool = []; for(let i = 0; i < 8; i++){ const m = new THREE.Mesh(partGeo, partMats.stahl); m.castShadow = true; m.visible = false; scene.add(m); partPool.push(m); }
  // Röntgen: Erfassungsbereiche + Lichtstrahlen
  const xray = new THREE.Group(); xray.visible = false; scene.add(xray);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: .35, depthWrite: false });
  const beam4 = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.18, 6), beamMat); beam4.rotation.x = Math.PI / 2; beam4.position.set(sensorsAt.B4, by + 0.03, bz); xray.add(beam4);
  const beam5 = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.18, 6), beamMat); beam5.rotation.x = Math.PI / 2; beam5.position.set(0.3, 0.9, bz + 0.05); xray.add(beam5);
  const rangeMat = new THREE.MeshBasicMaterial({ color: 0x58c4ff, transparent: true, opacity: .25, depthWrite: false });
  const range1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 16), rangeMat); range1.rotation.x = Math.PI / 2; xray.add(range1);
  const range2 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.013, 1, 16), rangeMat); range2.rotation.x = Math.PI / 2; xray.add(range2);

  flush(); buildAtlas(); buildLeds();
  leds.forEach((l, i) => { ledIndex[l.id] = i; });

  /* ---------- Zustand aus der Simulation ---------- */
  const sim = { beltRunning: false, parts: [], cylinder: 0, level: 0.3, heater: false, pump: 0, doorOpen: false, hoodOpen: false, leds: {}, hmi: null, aria: '', dist: { B1: 4, B2: 4 } };
  function setState(s){ Object.assign(sim, s || {}); Object.keys(sim.leds || {}).forEach(k => { const v = sim.leds[k]; setLed(k, v === true || v === 'blink', v === 'blink'); }); drawHmi(); drawAria(); }
  function drawHmi(){
    const x = hmiCtx; x.fillStyle = '#0b1a26'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#58c4ff'; x.font = '700 18px monospace'; x.fillText('TANKSTATION', 10, 24);
    const h = sim.hmi || {}; let y = 52;
    [['Füllstand', h.level, 'mm'], ['Druck', h.pressure, 'mbar'], ['Temperatur', h.temp, '°C'], ['Durchfluss', h.flow, 'l/min']].forEach(([n, v, u]) => { x.fillStyle = '#9fb0c0'; x.font = '14px monospace'; x.fillText(n, 10, y); x.fillStyle = '#e8f0f8'; x.font = '700 18px monospace'; x.fillText(v == null ? '---' : (Math.round(v * 10) / 10) + ' ' + u, 120, y); y += 28; });
    hmiTex.needsUpdate = true;
  }
  function drawAria(){ const x = ariaCtx; x.fillStyle = '#0a0f07'; x.fillRect(0, 0, 128, 96); x.fillStyle = '#39ff14'; x.font = '700 12px monospace'; x.fillText('ARIA', 8, 16); x.font = '10px monospace'; String(sim.aria || '...').match(/.{1,18}/g).slice(0, 5).forEach((l, i) => x.fillText(l, 8, 34 + i * 12)); ariaTex.needsUpdate = true; }
  drawHmi(); drawAria();

  /* ---------- Kamera, Ansichten, Steuerung ---------- */
  const cam = { pos: new THREE.Vector3(...VIEWS[1].pos), target: new THREE.Vector3(...VIEWS[1].target), view: 1, from: null, to: null, t0: 0, yaw: 0, pitch: 0, zoom: 1 };
  persp.position.copy(cam.pos); persp.lookAt(cam.target);
  function setView(n){
    const V = VIEWS[n]; if(!V) return;
    cam.view = n; cam.yaw = 0; cam.pitch = 0; cam.zoom = 1;
    doorTarget = V.door ? 1 : (sim.doorOpen ? 1 : 0);
    if(V.ortho){ camera = ortho; ortho.position.set(...V.pos); ortho.lookAt(new THREE.Vector3(...V.target)); sizeCam(); return; }
    camera = persp;
    const to = { pos: new THREE.Vector3(...V.pos), target: new THREE.Vector3(...V.target) };
    if(reduce){ cam.pos.copy(to.pos); cam.target.copy(to.target); cam.from = null; }
    else { cam.from = { pos: cam.pos.clone(), target: cam.target.clone() }; cam.to = to; cam.t0 = performance.now(); }
    if(opt.onView) opt.onView(n, V.name);
  }
  function focusOn(id){
    const b = boundsOf(id); if(!b) return;
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).length();
    camera = persp;
    const dir = persp.position.clone().sub(c).normalize(), dist = Math.max(0.25, sz * 2.2);
    const to = { pos: c.clone().add(dir.multiplyScalar(dist)), target: c };
    if(reduce){ cam.pos.copy(to.pos); cam.target.copy(to.target); } else { cam.from = { pos: cam.pos.clone(), target: cam.target.clone() }; cam.to = to; cam.t0 = performance.now(); }
  }
  let doorTarget = 0, doorPos = 0;
  const dom = renderer.domElement; dom.tabIndex = 0; dom.style.touchAction = 'none';
  dom.setAttribute('aria-label', '3D-Werkstatt. Tasten 1 bis 7 wählen die Ansicht, Pfeiltasten drehen begrenzt, Plus/Minus zoomen.');
  const ptr = {};
  dom.addEventListener('pointerdown', e => { ptr[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; });
  dom.addEventListener('pointermove', e => {
    const p = ptr[e.pointerId];
    if(!p){ hover(e); return; }
    const lim = (VIEWS[cam.view] || {}).orbit || 0.3;
    cam.yaw = Math.max(-lim, Math.min(lim, cam.yaw - (e.clientX - p.x) * 0.004));
    cam.pitch = Math.max(-lim * 0.6, Math.min(lim * 0.6, cam.pitch - (e.clientY - p.y) * 0.003));
    p.x = e.clientX; p.y = e.clientY;
  });
  dom.addEventListener('pointerup', e => { const p = ptr[e.pointerId]; delete ptr[e.pointerId]; if(p && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6){ const id = pickAt(e.clientX, e.clientY); if(id && opt.onPick) opt.onPick(id); } });
  dom.addEventListener('dblclick', e => { const id = pickAt(e.clientX, e.clientY); if(id) focusOn(id); });
  dom.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = Math.max(0.5, Math.min(1.6, cam.zoom + e.deltaY * 0.001)); }, { passive: false });
  dom.addEventListener('keydown', e => {
    if(/^[1-7]$/.test(e.key)){ setView(+e.key); e.preventDefault(); return; }
    const lim = (VIEWS[cam.view] || {}).orbit || 0.3;
    if(e.key === 'ArrowLeft') cam.yaw = Math.min(lim, cam.yaw + 0.08); else if(e.key === 'ArrowRight') cam.yaw = Math.max(-lim, cam.yaw - 0.08);
    else if(e.key === 'ArrowUp') cam.pitch = Math.max(-lim * .6, cam.pitch - 0.06); else if(e.key === 'ArrowDown') cam.pitch = Math.min(lim * .6, cam.pitch + 0.06);
    else if(e.key === '+' || e.key === '=') cam.zoom = Math.max(0.5, cam.zoom - 0.1); else if(e.key === '-') cam.zoom = Math.min(1.6, cam.zoom + 0.1); else return;
    e.preventDefault();
  });
  let hoverId = null;
  function hover(e){ const id = pickAt(e.clientX, e.clientY); if(id !== hoverId){ hoverId = id; dom.style.cursor = id ? 'pointer' : 'grab'; if(opt.onHover) opt.onHover(id, e.clientX, e.clientY); } }

  /* ---------- Picking ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(clientX, clientY){
    const r = dom.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickMeshes.concat([door]), false);
    let glass = null;   // Plexi/Acryl: dahinterliegende Bauteile haben Vorrang, sonst das Glasteil selbst
    for(const h of hits){
      if(h.object === door && doorPos > 0.5) continue;
      if(h.object.userData.pick) return h.object.userData.pick;
      const clear = ['acryl', 'plexi'].some(k => h.object.material === M[k]);
      const rs = h.object.userData.ranges || [];
      const f = h.faceIndex; const hit = rs.find(x => f >= x.start && f < x.start + x.count);
      if(clear){ if(!glass && hit) glass = hit.id; continue; }
      if(hit) return hit.id;
      return glass;
    }
    return glass;
  }
  const boxes = {};
  function boundsOf(id){
    if(boxes[id]) return boxes[id];
    const b = new THREE.Box3(); let any = false;
    pickMeshes.forEach(m => { const p = m.geometry.attributes.position, idx = m.geometry.index; (m.userData.ranges || []).filter(x => x.id === id).forEach(x => { for(let f = x.start; f < x.start + x.count; f++) for(let k = 0; k < 3; k++){ const vi = idx.getX(f * 3 + k); b.expandByPoint(new THREE.Vector3(p.getX(vi), p.getY(vi), p.getZ(vi))); any = true; } }); });
    return (boxes[id] = any ? b : null);
  }
  // Bildschirmpunkt eines Bauteils: zuerst die Mitte, sonst sichtbare Flächenmitten (für Schilder, Tests, Tastaturauswahl)
  function project(v){ const c = v.clone().project(camera), r = dom.getBoundingClientRect(); return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height, visible: c.z < 1 && Math.abs(c.x) <= 1 && Math.abs(c.y) <= 1 }; }
  function screenPos(id){
    const b = boundsOf(id); if(!b) return null;
    camera.updateMatrixWorld();
    const mid = project(b.getCenter(new THREE.Vector3()));
    if(mid.visible && pickAt(mid.x, mid.y) === id) return mid;
    let first = null;
    for(const m of pickMeshes){
      const p = m.geometry.attributes.position, idx = m.geometry.index; m.updateMatrixWorld();
      for(const x of (m.userData.ranges || []).filter(x => x.id === id)){
        const step = Math.max(1, Math.floor(x.count / 24));
        for(let f = x.start; f < x.start + x.count; f += step){
          const v = new THREE.Vector3();
          for(let k = 0; k < 3; k++){ const vi = idx.getX(f * 3 + k); v.add(new THREE.Vector3(p.getX(vi), p.getY(vi), p.getZ(vi))); }
          const s = project(v.divideScalar(3).applyMatrix4(m.matrixWorld));
          if(!s.visible) continue; first = first || s;
          if(pickAt(s.x, s.y) === id) return s;
        }
      }
    }
    return Object.assign(first || mid, { visible: false });
  }

  /* ---------- Qualität ---------- */
  let quality = opt.quality || 'auto', applied = null, fpsAvg = 60;
  function applyQuality(q){
    if(q === applied) return; applied = q;
    renderer.shadowMap.enabled = q === 'hoch'; sun.castShadow = q === 'hoch';
    renderer.setPixelRatio(q === 'niedrig' ? 1 : Math.min(root.devicePixelRatio || 1, q === 'hoch' ? 2 : 1.5));
    surface.material = q === 'niedrig' ? new THREE.MeshBasicMaterial({ color: 0x4a90d9, transparent: true, opacity: .8 }) : surfMat;
    scene.traverse(o => { if(o.material) o.material.needsUpdate = true; });
    sizeCam();
  }
  applyQuality(quality === 'auto' ? 'hoch' : quality);
  function setQuality(q){ quality = q; if(q !== 'auto') applyQuality(q); }

  /* ---------- Schleife ---------- */
  const clock = new THREE.Clock(); let raf = 0, alive = true, frames = 0, fpsT = performance.now();
  function sizeCam(){
    const w = holder.clientWidth || 800, h = holder.clientHeight || Math.round(w / 1.6);
    renderer.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
    const V = VIEWS[6], a = w / h; ortho.left = -V.half * a; ortho.right = V.half * a; ortho.top = V.half; ortho.bottom = -V.half; ortho.updateProjectionMatrix();
  }
  const ro = root.ResizeObserver ? new ResizeObserver(sizeCam) : null; if(ro) ro.observe(holder); sizeCam();
  let beltOffset = 0;
  function frame(){
    if(!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime, now = performance.now();
    // Kamera: Flug 0,6 s, danach begrenztes Drehen/Zoomen um die Ansicht
    if(cam.from){ const k = Math.min(1, (now - cam.t0) / 600), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; cam.pos.lerpVectors(cam.from.pos, cam.to.pos, e); cam.target.lerpVectors(cam.from.target, cam.to.target, e); if(k >= 1) cam.from = null; }
    if(camera === persp){
      const off = cam.pos.clone().sub(cam.target); const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += cam.yaw; sph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, sph.phi + cam.pitch)); sph.radius *= cam.zoom;
      persp.position.copy(cam.target).add(new THREE.Vector3().setFromSpherical(sph)); persp.lookAt(cam.target);
    }
    // Tür
    doorPos += (doorTarget - doorPos) * Math.min(1, dt * (reduce ? 60 : 5)); doorPivot.rotation.y = -doorPos * 1.9;
    // Band, Teile, Zylinder, Pumpe, Wasser, Heizung, LEDs
    if(sim.beltRunning){ beltOffset -= dt * 1.2; beltTex.offset.x = beltOffset; }
    partPool.forEach((m, i) => { const p = (sim.parts || [])[i]; m.visible = !!p; if(p){ m.material = partMats[p.material] || partMats.stahl; m.position.set(-0.99 + clamp(p.x, 0, 1.3), by + 0.011, bz + (p.z || 0)); } });
    const ext = clamp(sim.cylinder || 0, 0, 1); rod.position.z = bz - 0.12 + ext * 0.08; plate.position.set(cylX, by + 0.03, bz - 0.04 + ext * 0.08);
    pusher.position.z = bz - 0.06 + (sim.feeder ? 0.05 : 0);
    impeller.rotation.x += dt * 40 * (sim.pump || 0);
    const lvl = clamp(sim.level, 0.001, th); water.scale.y = lvl; water.position.y = tBase + lvl / 2; surface.position.set(tx, tBase + lvl + 0.001, tzk);
    surfMat.uniforms.t.value = t; surfMat.uniforms.amp.value = (sim.inflow ? 0.004 : 0.0008);
    heatGlow.material.opacity = sim.heater ? .55 + Math.sin(t * 3) * .15 : 0;
    floatB9.position.y = 0.3 + clamp(sim.reserveLevel == null ? 0.2 : sim.reserveLevel, 0, 0.4) * 0.5;
    cone.visible = xray.visible;
    const d1 = (sim.dist && sim.dist.B1) || 4, d2 = (sim.dist && sim.dist.B2) || 4;
    range1.scale.set(1, 0.008 * 1, 1); range1.position.set(sensorsAt.B1, by + 0.03, bz - 0.045 + 0.004); range1.scale.y = 0.008;
    range2.scale.y = 0.008; range2.position.set(sensorsAt.B2, by + 0.03, bz - 0.041);
    if(ledMesh){
      leds.forEach((l, i) => { const on = l.lit && (!l.blink || Math.sin(t * 12) > 0); ledMesh.setColorAt(i, on ? l.on : l.off); });
      ledMesh.instanceColor.needsUpdate = true;
    }
    renderer.render(scene, camera);
    // Bildrate → Qualität automatisch
    frames++; if(now - fpsT > 1000){ const fps = frames * 1000 / (now - fpsT); fpsAvg = fpsAvg * 0.6 + fps * 0.4; frames = 0; fpsT = now;
      if(quality === 'auto'){ if(fpsAvg < 28 && applied === 'hoch') applyQuality('mittel'); else if(fpsAvg < 22 && applied === 'mittel') applyQuality('niedrig'); } }
  }
  frame();
  function stats(){ renderer.render(scene, camera); const i = renderer.info.render; return { triangles: i.triangles, drawCalls: i.calls, fps: Math.round(fpsAvg), quality: applied, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; }
  function destroy(){ alive = false; cancelAnimationFrame(raf); if(ro) ro.disconnect(); renderer.dispose(); holder.removeChild(dom); }
  return { setView, setState, setXray: b => { xray.visible = !!b; }, setQuality, stats, components: () => Object.keys(COMPONENTS).filter(id => boundsOf(id) || id === 'SCHRANK'), screenPos, pickAt, focusOn, get view(){ return cam.view; }, get camera(){ return camera; }, renderer, destroy };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
root.SensorScene = { mount, COMPONENTS, VIEWS, isAvailable: () => !!T() };
})(typeof window !== 'undefined' ? window : globalThis);
