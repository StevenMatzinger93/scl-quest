/* ===== KOP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Seilbahn), nicht aus dem Spiel. Parameter pro Prüfung (exam_core.js). */
(function(){
const seq = steps => [{ steps }];
// n Impulse an einem Eingang: je ein Zyklus 1, ein Zyklus 0
const pulses = (inp, n, exp) => { const out = []; for(let i = 1; i <= n; i++){ out.push([0.1, { [inp]: true }, exp ? exp(i) : {}]); out.push([0.1, { [inp]: false }, {}]); } return out; };
const ms = s => 'T#' + Math.round(s * 1000) + 'MS';
const START = t => 'NETWORK ' + t + '\n? => ?;\n';

/* =====================================================================
   GRUNDSTUFE (Kapitel 1–10)
   ===================================================================== */

/* ---------- Kapitel 1: Schliesser, Spule, Reihe ---------- */
const FB_IN = n => ['Tuer_Zu', 'Schranke_Zu', 'S_Fahrt'].concat(n === 4 ? ['Seil_OK'] : []);
defExamTask({ id:'x_kop_g_fahrbereit', quest:'kop', level:'grund', ch:1, diff:1,
  params:{ N:[3, 4] },
  title:'Fahrfreigabe in Reihe',
  brief: p => 'Der Antrieb <code>Antrieb</code> und die Lampe <code>Ampel_Gruen</code> sollen nur dann 1 sein, wenn <b>alle</b> Bedingungen erfüllt sind: ' +
    FB_IN(p.N).map(v => '<code>' + v + '</code>').join(', ') + ' (jeweils 1).<br>Beide Spulen hängen am selben Strompfad.',
  vars: p => Object.assign(Object.fromEntries(FB_IN(p.N).map(v => [v, false])), { Antrieb:false, Ampel_Gruen:false }),
  start: () => START('Fahrfreigabe'),
  ref: p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).join(' AND ') + ' => Antrieb, Ampel_Gruen;',
  must:['SERIES'],
  visible: p => { const all = Object.fromEntries(FB_IN(p.N).map(v => [v, true])); return [[all, { Antrieb:true, Ampel_Gruen:true }], [Object.assign({}, all, { Tuer_Zu:false }), { Antrieb:false, Ampel_Gruen:false }]]; },
  hidden: p => truth(FB_IN(p.N), e => { const ok = FB_IN(p.N).every(v => e[v]); return { Antrieb: ok, Ampel_Gruen: ok }; }),
  wrong:[
    p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).join(' OR ') + ' => Antrieb, Ampel_Gruen;',
    p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).filter(v => v !== 'Schranke_Zu').join(' AND ') + ' => Antrieb, Ampel_Gruen;',
    p => 'NETWORK Fahrfreigabe\n' + FB_IN(p.N).join(' AND ') + ' => Antrieb;'
  ]
});

/* ---------- Kapitel 2: Öffner, Parallelzweige ---------- */
defExamTask({ id:'x_kop_g_rotlicht', quest:'kop', level:'grund', ch:2, diff:1,
  title:'Rotlicht an der Einstiegsstelle',
  brief: () => 'Die Lampe <code>Ampel_Rot</code> leuchtet, wenn die Tür <b>nicht</b> zu ist (<code>Tuer_Zu</code> = 0) <b>oder</b> die Schranke <b>nicht</b> zu ist (<code>Schranke_Zu</code> = 0) <b>oder</b> der Schalter <code>Revision</code> 1 ist.',
  vars: () => ({ Tuer_Zu:false, Schranke_Zu:false, Revision:false, Ampel_Rot:false }),
  start: () => START('Rotlicht'),
  ref: () => 'NETWORK Rotlicht\nNOT Tuer_Zu OR NOT Schranke_Zu OR Revision => Ampel_Rot;',
  must:['NC','PARALLEL'],
  visible: () => [[{ Tuer_Zu:true, Schranke_Zu:true }, { Ampel_Rot:false }], [{ Tuer_Zu:false, Schranke_Zu:true }, { Ampel_Rot:true }]],
  hidden: () => truth(['Tuer_Zu','Schranke_Zu','Revision'], e => ({ Ampel_Rot: !e.Tuer_Zu || !e.Schranke_Zu || e.Revision })),
  wrong:[
    () => 'NETWORK Rotlicht\nTuer_Zu OR Schranke_Zu OR Revision => Ampel_Rot;',
    () => 'NETWORK Rotlicht\nNOT Tuer_Zu AND NOT Schranke_Zu OR Revision => Ampel_Rot;',
    () => 'NETWORK Rotlicht\nNOT Tuer_Zu OR NOT Schranke_Zu => Ampel_Rot;'
  ]
});

/* ---------- Kapitel 3: Selbsthaltung, Vorrang, Verriegelung ---------- */
defExamTask({ id:'x_kop_g_foerderband', quest:'kop', level:'grund', ch:3, diff:1, timed:true,
  title:'Gepäckband mit Selbsthaltung',
  brief: () => 'Das Gepäckband <code>Band</code> startet mit dem Taster <code>S_Start</code> und läuft danach weiter (Selbsthaltung).<br>Es stoppt mit <code>S_Stopp</code> (Aus-Vorrang) oder sobald <code>Not_Halt_OK</code> 0 ist.',
  vars: () => ({ S_Start:false, S_Stopp:false, Not_Halt_OK:true, Band:false }),
  start: () => START('Gepaeckband'),
  ref: () => 'NETWORK Gepaeckband\n(S_Start OR Band) AND NOT S_Stopp AND Not_Halt_OK => Band;',
  visible: () => seq([[0.1,{S_Start:true},{Band:true}],[0.1,{S_Start:false},{Band:true}],[0.1,{S_Stopp:true},{Band:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Band:false}],[0.1,{S_Start:true},{Band:true}],[0.1,{S_Start:false},{Band:true}],[0.5,{},{Band:true}],[0.1,{S_Stopp:true},{Band:false}],[0.1,{S_Stopp:false},{Band:false}]] },
    { steps:[[0.1,{S_Start:true, S_Stopp:true},{Band:false}],[0.1,{S_Stopp:false},{Band:true}],[0.1,{S_Start:false},{Band:true}]] },
    { steps:[[0.1,{S_Start:true},{Band:true}],[0.1,{S_Start:false, Not_Halt_OK:false},{Band:false}],[0.1,{Not_Halt_OK:true},{Band:false}]] },
    { steps:[[0.1,{S_Start:true, Not_Halt_OK:false},{Band:false}],[0.1,{S_Start:false, Not_Halt_OK:true},{Band:false}]] }
  ],
  wrong:[
    () => 'NETWORK Gepaeckband\nS_Start AND NOT S_Stopp AND Not_Halt_OK => Band;',
    () => 'NETWORK Gepaeckband\n(S_Start OR Band AND NOT S_Stopp) AND Not_Halt_OK => Band;',
    () => 'NETWORK Gepaeckband\n(S_Start OR Band) AND NOT S_Stopp => Band;'
  ]
});

const RICHT = 'NETWORK Bergfahrt\n(S_Berg OR Fahrt_Berg) AND NOT S_Halt AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Talfahrt\n(S_Tal OR Fahrt_Tal) AND NOT S_Halt AND NOT Fahrt_Berg => Fahrt_Tal;';
defExamTask({ id:'x_kop_g_richtung', quest:'kop', level:'grund', ch:3, diff:2, timed:true,
  title:'Fahrtrichtung verriegeln',
  brief: () => '<b>NW 1:</b> <code>S_Berg</code> startet <code>Fahrt_Berg</code> mit Selbsthaltung.<br><b>NW 2:</b> <code>S_Tal</code> startet <code>Fahrt_Tal</code> mit Selbsthaltung.<br><code>S_Halt</code> (Schliesser) stoppt beide (Aus-Vorrang). Die beiden Richtungen sind <b>gegenseitig verriegelt</b>: Solange eine Richtung läuft, lässt sich die andere nicht starten. Werden beide Taster gleichzeitig gedrückt, gewinnt die Bergfahrt.',
  vars: () => ({ S_Berg:false, S_Tal:false, S_Halt:false, Fahrt_Berg:false, Fahrt_Tal:false }),
  start: () => START('Bergfahrt'),
  ref: () => RICHT,
  must:['PARALLEL','NC'],
  visible: () => seq([[0.1,{S_Berg:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true}],[0.1,{S_Halt:true},{Fahrt_Berg:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Fahrt_Berg:false, Fahrt_Tal:false}],[0.1,{S_Berg:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true}],[0.1,{S_Tal:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Tal:false},{Fahrt_Berg:true, Fahrt_Tal:false}],
      [0.1,{S_Halt:true},{Fahrt_Berg:false, Fahrt_Tal:false}],[0.1,{S_Halt:false, S_Tal:true},{Fahrt_Tal:true, Fahrt_Berg:false}],[0.1,{S_Tal:false, S_Berg:true},{Fahrt_Tal:true, Fahrt_Berg:false}]] },
    { steps:[[0.1,{S_Tal:true, S_Halt:true},{Fahrt_Tal:false}],[0.1,{S_Halt:false},{Fahrt_Tal:true}],[0.1,{S_Tal:false},{Fahrt_Tal:true}],[0.1,{S_Halt:true},{Fahrt_Tal:false}],[0.1,{S_Halt:false},{Fahrt_Tal:false}]] },
    { steps:[[0.1,{S_Berg:true, S_Tal:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Tal:false},{Fahrt_Berg:true, Fahrt_Tal:false}]] }
  ],
  wrong:[
    () => 'NETWORK Bergfahrt\n(S_Berg OR Fahrt_Berg) AND NOT S_Halt => Fahrt_Berg;\n\nNETWORK Talfahrt\n(S_Tal OR Fahrt_Tal) AND NOT S_Halt => Fahrt_Tal;',
    () => 'NETWORK Bergfahrt\nS_Berg AND NOT S_Halt AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Talfahrt\nS_Tal AND NOT S_Halt AND NOT Fahrt_Berg => Fahrt_Tal;',
    () => 'NETWORK Bergfahrt\n(S_Berg OR Fahrt_Berg) AND NOT S_Halt AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Talfahrt\n(S_Tal OR Fahrt_Tal) AND NOT Fahrt_Berg => Fahrt_Tal;'
  ]
});

/* ---------- Kapitel 4: Setzen / Rücksetzen ---------- */
const ZUG_S = 'NETWORK Setzen\nS_Auf AND Kabine_da => S Zugang_Auf;', ZUG_R = 'NETWORK Ruecksetzen\nS_Zu OR NOT Kabine_da => R Zugang_Auf;';
defExamTask({ id:'x_kop_g_zugang', quest:'kop', level:'grund', ch:4, diff:2, timed:true,
  params:{ VOR:['R', 'S'] },
  title:'Zugangssperre speichern',
  brief: p => '<code>Zugang_Auf</code> wird <b>gesetzt</b>, wenn <code>S_Auf</code> 1 ist und <code>Kabine_da</code> 1 ist.<br>Es wird <b>rückgesetzt</b>, wenn <code>S_Zu</code> 1 ist oder <code>Kabine_da</code> 0 ist.<br>Verwende S- und R-Spulen. Die Anlage verlangt <b>' + (p.VOR === 'R' ? 'Rücksetzvorrang' : 'Setzvorrang') + '</b>: Sind Setz- und Rücksetzbedingung gleichzeitig erfüllt, ist der Zugang ' + (p.VOR === 'R' ? 'zu' : 'offen') + '.',
  vars: () => ({ S_Auf:false, S_Zu:false, Kabine_da:false, Zugang_Auf:false }),
  start: () => START('Setzen'),
  ref: p => p.VOR === 'R' ? ZUG_S + '\n\n' + ZUG_R : ZUG_R + '\n\n' + ZUG_S,
  must:['SET','RESET'],
  visible: () => seq([[0.1,{Kabine_da:true, S_Auf:true},{Zugang_Auf:true}],[0.1,{S_Auf:false},{Zugang_Auf:true}],[0.1,{S_Zu:true},{Zugang_Auf:false}]]),
  hidden: p => [
    { steps:[[0.1,{},{Zugang_Auf:false}],[0.1,{S_Auf:true},{Zugang_Auf:false}],[0.1,{Kabine_da:true},{Zugang_Auf:true}],[0.1,{S_Auf:false},{Zugang_Auf:true}],[0.5,{},{Zugang_Auf:true}],[0.1,{S_Zu:true},{Zugang_Auf:false}],[0.1,{S_Zu:false},{Zugang_Auf:false}]] },
    { steps:[[0.1,{Kabine_da:true, S_Auf:true, S_Zu:true},{Zugang_Auf: p.VOR === 'S'}],[0.1,{S_Zu:false},{Zugang_Auf:true}],[0.1,{S_Auf:false, S_Zu:true},{Zugang_Auf:false}],[0.1,{S_Zu:false},{Zugang_Auf:false}]] },
    { steps:[[0.1,{Kabine_da:true, S_Auf:true},{Zugang_Auf:true}],[0.1,{S_Auf:false},{Zugang_Auf:true}],[0.1,{Kabine_da:false},{Zugang_Auf:false}],[0.1,{Kabine_da:true},{Zugang_Auf:false}]] }
  ],
  wrong:[
    p => p.VOR === 'R' ? ZUG_R + '\n\n' + ZUG_S : ZUG_S + '\n\n' + ZUG_R,
    p => { const r = 'NETWORK Ruecksetzen\nS_Zu => R Zugang_Auf;'; return p.VOR === 'R' ? ZUG_S + '\n\n' + r : r + '\n\n' + ZUG_S; },
    () => 'NETWORK Zugang\nS_Auf AND Kabine_da AND NOT S_Zu => Zugang_Auf;'
  ]
});

const BR_REF = 'NETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR NOT Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => NOT Lampe_Bremse_Zu;';
defExamTask({ id:'x_kop_g_bremse', quest:'kop', level:'grund', ch:4, diff:2, timed:true,
  title:'Betriebsbremse',
  brief: () => '<b>NW 1:</b> <code>S_Lueften</code> setzt <code>Bremse_Auf</code>.<br><b>NW 2:</b> <code>S_Einfallen</code> <b>oder</b> <code>Hydraulik_OK</code> = 0 <b>oder</b> <code>Not_Halt_OK</code> = 0 setzt <code>Bremse_Auf</code> zurück (Rücksetzvorrang).<br><b>NW 3:</b> <code>Lampe_Bremse_Zu</code> ist genau dann 1, wenn <code>Bremse_Auf</code> 0 ist — verwende dafür eine <b>negierte Spule</b>.',
  vars: () => ({ S_Lueften:false, S_Einfallen:false, Hydraulik_OK:true, Not_Halt_OK:true, Bremse_Auf:false, Lampe_Bremse_Zu:false }),
  start: () => START('Lueften'),
  ref: () => BR_REF,
  must:['SET','RESET','NCOIL'],
  visible: () => seq([[0.1,{},{Bremse_Auf:false, Lampe_Bremse_Zu:true}],[0.1,{S_Lueften:true},{Bremse_Auf:true, Lampe_Bremse_Zu:false}],[0.1,{S_Lueften:false, S_Einfallen:true},{Bremse_Auf:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Lampe_Bremse_Zu:true}],[0.1,{S_Lueften:true},{Bremse_Auf:true, Lampe_Bremse_Zu:false}],[0.1,{S_Lueften:false},{Bremse_Auf:true, Lampe_Bremse_Zu:false}],[0.1,{Hydraulik_OK:false},{Bremse_Auf:false, Lampe_Bremse_Zu:true}],[0.1,{Hydraulik_OK:true},{Bremse_Auf:false}]] },
    { steps:[[0.1,{S_Lueften:true, Not_Halt_OK:false},{Bremse_Auf:false, Lampe_Bremse_Zu:true}],[0.1,{Not_Halt_OK:true},{Bremse_Auf:true}],[0.1,{S_Einfallen:true},{Bremse_Auf:false}],[0.1,{S_Lueften:false, S_Einfallen:false},{Bremse_Auf:false}]] },
    { steps:[[0.1,{S_Lueften:true},{Bremse_Auf:true}],[0.1,{S_Lueften:false, Not_Halt_OK:false},{Bremse_Auf:false}],[0.1,{Not_Halt_OK:true},{Bremse_Auf:false, Lampe_Bremse_Zu:true}]] }
  ],
  wrong:[
    () => 'NETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR NOT Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => NOT Lampe_Bremse_Zu;',
    () => 'NETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => NOT Lampe_Bremse_Zu;',
    () => 'NETWORK Lueften\nS_Lueften => S Bremse_Auf;\n\nNETWORK Einfallen\nS_Einfallen OR NOT Hydraulik_OK OR NOT Not_Halt_OK => R Bremse_Auf;\n\nNETWORK Meldelampe\nBremse_Auf => Lampe_Bremse_Zu;'
  ]
});

/* ---------- Kapitel 5: Flanken, Stromstoss ---------- */
const FAHRT_REF = f => 'NETWORK Zaehlen\n' + f + '(Kabine_da) => INC(Fahrten);\n\nNETWORK Nullen\nS_Null => MOVE(0, Fahrten);';
defExamTask({ id:'x_kop_g_fahrten', quest:'kop', level:'grund', ch:5, diff:1, timed:true,
  params:{ F:['P', 'N'] },
  title:'Kabinen zählen',
  brief: p => '<b>NW 1:</b> Jedes Mal, wenn eine Kabine ' + (p.F === 'P' ? '<b>einfährt</b> (steigende Flanke' : 'die Station <b>verlässt</b> (fallende Flanke') + ' von <code>Kabine_da</code>), wird <code>Fahrten</code> um 1 erhöht (INC).<br><b>NW 2:</b> <code>S_Null</code> setzt <code>Fahrten</code> auf 0 (MOVE).',
  vars: () => ({ Kabine_da:false, S_Null:false, Fahrten:0 }),
  start: () => START('Zaehlen'),
  ref: p => FAHRT_REF(p.F),
  must:['INC','MOVE'],
  visible: p => seq([[0.1,{Kabine_da:true},{Fahrten: p.F === 'P' ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}]]),
  hidden: p => { const P = p.F === 'P'; return [
    { steps:[[0.1,{},{Fahrten:0}],[0.1,{Kabine_da:true},{Fahrten: P ? 1 : 0}],[0.5,{},{Fahrten: P ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}],[0.5,{},{Fahrten:1}],[0.1,{Kabine_da:true},{Fahrten: P ? 2 : 1}],[0.1,{Kabine_da:false},{Fahrten:2}]] },
    { steps:[[0.1,{Kabine_da:true},{Fahrten: P ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}],[0.1,{S_Null:true},{Fahrten:0}],[0.1,{S_Null:false},{Fahrten:0}],[0.1,{Kabine_da:true},{Fahrten: P ? 1 : 0}],[0.1,{Kabine_da:false},{Fahrten:1}]] },
    { steps:[[0.1,{Kabine_da:true},{}],[0.1,{Kabine_da:false},{}],[0.1,{Kabine_da:true},{}],[0.1,{Kabine_da:false},{}],[0.1,{Kabine_da:true},{Fahrten: P ? 3 : 2}],[0.1,{},{Fahrten: P ? 3 : 2}]] }
  ]; },
  wrong:[
    p => FAHRT_REF(p.F === 'P' ? 'N' : 'P'),
    () => 'NETWORK Zaehlen\nKabine_da => INC(Fahrten);\n\nNETWORK Nullen\nS_Null => MOVE(0, Fahrten);',
    p => 'NETWORK Zaehlen\n' + p.F + '(Kabine_da) => INC(Fahrten);'
  ]
});

const TOG = 'NETWORK Flanke\nP(S_Schranke) AND Freigabe => Tastimpuls;\n\nNETWORK Umschalten\n(Tastimpuls AND NOT Schranke_Zu) OR (NOT Tastimpuls AND Schranke_Zu) => Schranke_Zu;';
defExamTask({ id:'x_kop_g_stromstoss', quest:'kop', level:'grund', ch:5, diff:3, timed:true,
  title:'Schranke mit einem Taster',
  brief: () => 'Die Schranke wird mit <b>einem</b> Taster bedient (Stromstossschaltung): Jeder <b>Druck</b> auf <code>S_Schranke</code> schaltet <code>Schranke_Zu</code> um (0 → 1 → 0 …), aber nur, wenn <code>Freigabe</code> 1 ist. Langes Drücken schaltet nur einmal.<br>Die Hilfsvariable <code>Tastimpuls</code> steht zur Verfügung.',
  vars: () => ({ S_Schranke:false, Freigabe:true, Tastimpuls:false, Schranke_Zu:false }),
  start: () => START('Flanke'),
  ref: () => TOG,
  must:['EDGE_P'],
  visible: () => seq([[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{S_Schranke:false},{Schranke_Zu:true}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schranke_Zu:false}],[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{},{Schranke_Zu:true}],[0.5,{},{Schranke_Zu:true}],[0.1,{S_Schranke:false},{Schranke_Zu:true}],[0.1,{S_Schranke:true},{Schranke_Zu:false}],[0.1,{},{Schranke_Zu:false}],[0.1,{S_Schranke:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Freigabe:false, S_Schranke:true},{Schranke_Zu:false}],[0.1,{S_Schranke:false},{Schranke_Zu:false}],[0.1,{Freigabe:true},{Schranke_Zu:false}],[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{S_Schranke:false, Freigabe:false},{Schranke_Zu:true}],[0.1,{S_Schranke:true},{Schranke_Zu:true}]] },
    { steps:[[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.1,{S_Schranke:false},{}],[0.1,{S_Schranke:true},{Schranke_Zu:false}],[0.1,{S_Schranke:false},{}],[0.1,{S_Schranke:true},{Schranke_Zu:true}],[0.2,{},{Schranke_Zu:true}]] }
  ],
  wrong:[
    () => 'NETWORK Flanke\nS_Schranke AND Freigabe => Tastimpuls;\n\nNETWORK Umschalten\n(Tastimpuls AND NOT Schranke_Zu) OR (NOT Tastimpuls AND Schranke_Zu) => Schranke_Zu;',
    () => 'NETWORK Flanke\nP(S_Schranke) => Tastimpuls;\n\nNETWORK Umschalten\n(Tastimpuls AND NOT Schranke_Zu) OR (NOT Tastimpuls AND Schranke_Zu) => Schranke_Zu;',
    () => 'NETWORK Flanke\nP(S_Schranke) AND Freigabe => S Schranke_Zu;'
  ]
});

/* ---------- Kapitel 6: TON, TOF, TP ---------- */
defExamTask({ id:'x_kop_g_luefter', quest:'kop', level:'grund', ch:6, diff:1, timed:true,
  params:{ T:[3, 5, 8] },
  title:'Lüfter mit Nachlauf',
  brief: p => 'Der Kabinenlüfter <code>Luefter</code> läuft, solange <code>Heizung</code> 1 ist, und danach noch <b>' + p.T + ' Sekunden</b> nach. Verwende eine Ausschaltverzögerung mit der Instanz <code>T_Luefter</code>.',
  vars: () => ({ Heizung:false, Luefter:false }),
  start: () => START('Luefter'),
  ref: p => 'NETWORK Luefter\nHeizung AND TOF(T_Luefter, T#' + p.T + 'S) => Luefter;',
  must:['TOF'],
  visible: p => seq([[0.1,{Heizung:true},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T + 0.5,{},{Luefter:false}]]),
  hidden: p => [
    { steps:[[0.1,{Heizung:true},{Luefter:true}],[2,{},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T - 0.5,{},{Luefter:true}],[0.6,{},{Luefter:false}],[1,{},{Luefter:false}]] },
    { steps:[[0.1,{Heizung:true},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T - 1,{},{Luefter:true}],[0.1,{Heizung:true},{Luefter:true}],[0.1,{Heizung:false},{Luefter:true}],[p.T - 0.2,{},{Luefter:true}],[0.4,{},{Luefter:false}]] },
    { steps:[[0.1,{},{Luefter:false}],[p.T + 1,{},{Luefter:false}],[0.1,{Heizung:true},{Luefter:true}]] }
  ],
  wrong:[
    p => 'NETWORK Luefter\nHeizung AND TON(T_Luefter, T#' + p.T + 'S) => Luefter;',
    p => 'NETWORK Luefter\nHeizung AND TOF(T_Luefter, T#' + (p.T + 1) + 'S) => Luefter;',
    p => 'NETWORK Luefter\nHeizung AND TP(T_Luefter, T#' + p.T + 'S) => Luefter;'
  ]
});

defExamTask({ id:'x_kop_g_tuerzeit', quest:'kop', level:'grund', ch:6, diff:2, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Tür verzögert öffnen',
  brief: p => '<code>Tuer_Auf</code> wird 1, wenn <code>Kabine_da</code> <b>' + p.T + ' Sekunden</b> ununterbrochen 1 ist und <code>Sperre</code> 0 ist. Verwende einen TON mit der Instanz <code>T_Tuer</code>.',
  vars: () => ({ Kabine_da:false, Sperre:false, Tuer_Auf:false }),
  start: () => START('Tuer'),
  ref: p => 'NETWORK Tuer\nKabine_da AND NOT Sperre AND TON(T_Tuer, T#' + p.T + 'S) => Tuer_Auf;',
  must:['TON'],
  visible: p => seq([[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T,{},{Tuer_Auf:true}]]),
  hidden: p => [
    { steps:[[0,{},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T - 0.5,{},{Tuer_Auf:false}],[0.5,{},{Tuer_Auf:true}],[2,{},{Tuer_Auf:true}],[0.1,{Kabine_da:false},{Tuer_Auf:false}]] },
    { steps:[[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T - 1,{},{Tuer_Auf:false}],[0.1,{Kabine_da:false},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T - 0.5,{},{Tuer_Auf:false}],[0.6,{},{Tuer_Auf:true}]] },
    { steps:[[0.1,{Kabine_da:true, Sperre:true},{Tuer_Auf:false}],[p.T + 1,{},{Tuer_Auf:false}],[0.1,{Sperre:false},{Tuer_Auf:false}],[p.T,{},{Tuer_Auf:true}],[0.1,{Sperre:true},{Tuer_Auf:false}]] },
    { steps:[[0.1,{},{Tuer_Auf:false}],[p.T + 2,{},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[p.T + 0.2,{},{Tuer_Auf:true}]] }
  ],
  wrong:[
    p => 'NETWORK Tuer\nKabine_da AND NOT Sperre AND TON(T_Tuer, T#' + (p.T + 1) + 'S) => Tuer_Auf;',
    p => 'NETWORK Tuer\nKabine_da AND NOT Sperre AND TOF(T_Tuer, T#' + p.T + 'S) => Tuer_Auf;',
    p => 'NETWORK Tuer\nKabine_da AND TON(T_Tuer, T#' + p.T + 'S) => Tuer_Auf;'
  ]
});

/* ---------- Kapitel 7: Blinker, Überwachung, Vorwarnung ---------- */
const BRU = t => 'NETWORK Ueberwachung\nBremse_Befehl AND NOT Bremse_offen AND TON(T_Bremse, T#' + t + 'S) => S Bremsstoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT Bremse_Befehl => R Bremsstoerung;\n\nNETWORK Fahrfreigabe\nBremse_Befehl AND Bremse_offen AND NOT Bremsstoerung => Fahrt_frei;';
defExamTask({ id:'x_kop_g_bremsueberwachung', quest:'kop', level:'grund', ch:7, diff:2, timed:true,
  params:{ T:[2, 3, 5] },
  title:'Bremse überwachen',
  brief: p => '<b>NW 1:</b> Ist <code>Bremse_Befehl</code> 1, muss die Rückmeldung <code>Bremse_offen</code> innerhalb von <b>' + p.T + ' s</b> kommen. Fehlt sie so lange ununterbrochen, wird <code>Bremsstoerung</code> gesetzt (TON-Instanz <code>T_Bremse</code>).<br><b>NW 2:</b> <code>Quittieren</code> setzt <code>Bremsstoerung</code> zurück, aber nur wenn <code>Bremse_Befehl</code> 0 ist.<br><b>NW 3:</b> <code>Fahrt_frei</code> = <code>Bremse_Befehl</code> und <code>Bremse_offen</code> und keine <code>Bremsstoerung</code>.',
  vars: () => ({ Bremse_Befehl:false, Bremse_offen:false, Quittieren:false, Bremsstoerung:false, Fahrt_frei:false }),
  start: () => START('Ueberwachung'),
  ref: p => BRU(p.T),
  must:['TON','SET','RESET'],
  visible: p => seq([[0.1,{Bremse_Befehl:true},{Bremsstoerung:false}],[p.T + 0.5,{},{Bremsstoerung:true, Fahrt_frei:false}]]),
  hidden: p => [
    { steps:[[0.1,{Bremse_Befehl:true},{Bremsstoerung:false, Fahrt_frei:false}],[1,{Bremse_offen:true},{Bremsstoerung:false, Fahrt_frei:true}],[p.T + 2,{},{Bremsstoerung:false, Fahrt_frei:true}],[0.1,{Bremse_Befehl:false, Bremse_offen:false},{Fahrt_frei:false, Bremsstoerung:false}]] },
    { steps:[[0.1,{Bremse_Befehl:true},{Bremsstoerung:false}],[p.T - 0.5,{},{Bremsstoerung:false}],[0.6,{},{Bremsstoerung:true}],[0.1,{Bremse_offen:true},{Bremsstoerung:true, Fahrt_frei:false}],[0.1,{Quittieren:true},{Bremsstoerung:true}],[0.1,{Bremse_Befehl:false},{Bremsstoerung:false}],[0.1,{Quittieren:false},{Bremsstoerung:false}]] },
    { steps:[[0.1,{Bremse_Befehl:true},{}],[p.T - 1,{},{Bremsstoerung:false}],[0.1,{Bremse_offen:true},{Bremsstoerung:false}],[0.1,{Bremse_offen:false},{Bremsstoerung:false}],[p.T - 0.5,{},{Bremsstoerung:false}],[0.7,{},{Bremsstoerung:true}]] }
  ],
  wrong:[
    p => BRU(p.T).replace('TON(', 'TOF('),
    p => BRU(p.T).replace('Quittieren AND NOT Bremse_Befehl', 'Quittieren'),
    p => BRU(p.T + 1)
  ]
});

const BLINK = (e, a) => 'NETWORK Einzeit\nWarnung AND NOT Phase AND TON(T_Ein, ' + ms(e) + ') => S Phase;\n\nNETWORK Auszeit\nPhase AND TON(T_Aus, ' + ms(a) + ') => R Phase;\n\nNETWORK Warnung aus\nNOT Warnung => R Phase;\n\nNETWORK Lampe\nWarnung AND NOT Phase => Ampel_Gelb;';
// Abtastpunkte eines Blinkzyklus (Schritt 0,25 s): Erwartung nur an eindeutigen Zeitpunkten
const blinkRun = (E, A, n, marks) => { const st = []; for(let i = 1; i <= n; i++){ const t = i * 0.25; st.push([0.25, {}, marks[t] !== undefined ? { Ampel_Gelb: marks[t] } : {}]); } return st; };
defExamTask({ id:'x_kop_g_blinker', quest:'kop', level:'grund', ch:7, diff:3, timed:true,
  params:{ E:[0.5, 1], A:[1.5, 2] },
  title:'Warnblinker mit Ein- und Auszeit',
  brief: p => 'Solange <code>Warnung</code> 1 ist, blinkt <code>Ampel_Gelb</code>: zuerst <b>' + p.E + ' s an</b>, dann <b>' + p.A + ' s aus</b>, dann wieder an usw. Ist <code>Warnung</code> 0, ist die Lampe aus; beim nächsten Einschalten beginnt der Zyklus wieder mit der Ein-Phase.<br>Verwende die Hilfsvariable <code>Phase</code> (1 = Aus-Phase) sowie zwei TON-Instanzen <code>T_Ein</code> und <code>T_Aus</code>.',
  vars: () => ({ Warnung:false, Phase:false, Ampel_Gelb:false }),
  start: () => START('Einzeit'),
  ref: p => BLINK(p.E, p.A),
  must:['TON','SET','RESET'],
  visible: p => seq([[0,{Warnung:true},{Ampel_Gelb:true}],[p.E + 0.25,{},{Ampel_Gelb:false}]]),
  hidden: p => { const E = p.E, A = p.A, m = {}; m[E - 0.25] = true; m[E] = false; m[E + A - 0.25] = false; m[E + A] = true; m[E + A + E / 2] = true; m[2 * E + A + 0.25 + A / 2] = false;
    const n = Math.round((2 * E + 2 * A + 0.25) / 0.25) - 1;
    return [
      { steps:[[0,{Warnung:true},{Ampel_Gelb:true}]].concat(blinkRun(E, A, n, m)) },
      { steps:[[0,{},{Ampel_Gelb:false}],[1,{},{Ampel_Gelb:false}],[0.25,{Warnung:true},{Ampel_Gelb:true}],[E,{},{Ampel_Gelb:false}],[0.25,{Warnung:false},{Ampel_Gelb:false}],[0.25,{Warnung:true},{Ampel_Gelb:true}],[E - 0.25,{},{Ampel_Gelb:true}],[0.25,{},{Ampel_Gelb:false}]] },
      { steps:[[0,{Warnung:true},{Ampel_Gelb:true}],[0.25,{Warnung:false},{Ampel_Gelb:false}],[A + 1,{},{Ampel_Gelb:false}],[0.25,{Warnung:true},{Ampel_Gelb:true}]] }
    ]; },
  wrong:[
    p => BLINK(p.A, p.E),
    p => BLINK(p.E, p.A).replace('NETWORK Warnung aus\nNOT Warnung => R Phase;\n\n', ''),
    p => BLINK(p.E, p.A).replace('Warnung AND NOT Phase => Ampel_Gelb', 'NOT Phase => Ampel_Gelb')
  ]
});

/* ---------- Kapitel 8: CTU, CTD ---------- */
const SCHM = n => 'NETWORK Schmierzaehler\nAbfahrt AND CTU(Z_Schmier, PV:=' + n + ', R:=Geschmiert) => Schmieren;';
defExamTask({ id:'x_kop_g_schmierung', quest:'kop', level:'grund', ch:8, diff:1, timed:true,
  params:{ N:[4, 5, 6] },
  title:'Seilschmierung fällig',
  brief: p => 'Nach <b>' + p.N + ' Abfahrten</b> muss das Seil geschmiert werden. Zähle die Impulse von <code>Abfahrt</code> mit einem CTU (Instanz <code>Z_Schmier</code>). Sein Ausgang Q steuert <code>Schmieren</code>. Der Taster <code>Geschmiert</code> setzt den Zähler zurück.',
  vars: () => ({ Abfahrt:false, Geschmiert:false, Schmieren:false }),
  start: () => START('Schmierzaehler'),
  ref: p => SCHM(p.N),
  must:['CTU'],
  visible: p => seq(pulses('Abfahrt', p.N, i => ({ Schmieren: i >= p.N }))),
  hidden: p => [
    { steps:[[0,{},{Schmieren:false}]].concat(pulses('Abfahrt', p.N - 1, () => ({ Schmieren:false })), [[0.1,{Abfahrt:true},{Schmieren:true}],[0.5,{},{Schmieren:true}],[0.1,{Abfahrt:false},{Schmieren:true}]]) },
    { steps: pulses('Abfahrt', p.N + 1, i => ({ Schmieren: i >= p.N })).concat([[0.1,{Geschmiert:true},{Schmieren:false}],[0.1,{Geschmiert:false},{Schmieren:false}]], pulses('Abfahrt', 2, () => ({ Schmieren:false }))) },
    { steps: pulses('Abfahrt', 2, () => ({ Schmieren:false })).concat([[0.1,{Geschmiert:true},{}],[0.1,{Geschmiert:false},{}]], pulses('Abfahrt', p.N, i => ({ Schmieren: i >= p.N }))) }
  ],
  wrong:[
    p => SCHM(p.N + 1),
    p => SCHM(p.N - 1),
    p => 'NETWORK Schmierzaehler\nAbfahrt AND CTU(Z_Schmier, PV:=' + p.N + ') => Schmieren;'
  ]
});

const FREI = pv => 'NETWORK Plaetze\nEinstieg AND CTD(Z_Frei, PV:=' + pv + ', LD:=Neue_Kabine) => Kabine_voll;\n\nNETWORK Anzeige\n=> MOVE(Z_Frei.CV, Frei);';
defExamTask({ id:'x_kop_g_freie_plaetze', quest:'kop', level:'grund', ch:8, diff:2, timed:true,
  params:{ P:[4, 6, 8] },
  title:'Freie Plätze rückwärts zählen',
  brief: p => 'Eine Kabine hat <b>' + p.P + ' Plätze</b>.<br><b>NW 1:</b> Rückwärtszähler CTD (Instanz <code>Z_Frei</code>): <code>Neue_Kabine</code> lädt den Zähler auf ' + p.P + ', jeder Impuls von <code>Einstieg</code> zählt 1 ab. Der Ausgang Q steuert <code>Kabine_voll</code>.<br><b>NW 2:</b> ohne Bedingung → MOVE des Zählerstands nach <code>Frei</code>.',
  vars: () => ({ Einstieg:false, Neue_Kabine:false, Kabine_voll:false, Frei:0 }),
  start: () => START('Plaetze'),
  ref: p => FREI(p.P),
  must:['CTD','MOVE'],
  visible: p => seq([[0.1,{Neue_Kabine:true},{Frei:p.P, Kabine_voll:false}],[0.1,{Neue_Kabine:false},{}],[0.1,{Einstieg:true},{Frei:p.P - 1}]]),
  hidden: p => [
    { steps:[[0.1,{Neue_Kabine:true},{Frei:p.P, Kabine_voll:false}],[0.1,{Neue_Kabine:false},{Frei:p.P}]].concat(pulses('Einstieg', p.P, i => ({ Frei: p.P - i, Kabine_voll: i >= p.P })), [[0.5,{},{Frei:0, Kabine_voll:true}]]) },
    { steps:[[0.1,{Neue_Kabine:true},{}],[0.1,{Neue_Kabine:false},{}]].concat(pulses('Einstieg', 3, i => ({ Frei: p.P - i, Kabine_voll:false })), [[0.1,{Neue_Kabine:true},{Frei:p.P, Kabine_voll:false}],[0.1,{Neue_Kabine:false},{Frei:p.P}],[0.1,{Einstieg:true},{Frei:p.P - 1}]]) },
    { steps:[[0.1,{Neue_Kabine:true},{}],[0.1,{Neue_Kabine:false},{}]].concat(pulses('Einstieg', p.P - 1, () => ({ Kabine_voll:false })), [[0.1,{},{Frei:1, Kabine_voll:false}],[0.1,{Einstieg:true},{Frei:0, Kabine_voll:true}]]) }
  ],
  wrong:[
    p => FREI(p.P + 1),
    p => 'NETWORK Plaetze\nEinstieg AND CTU(Z_Frei, PV:=' + p.P + ', R:=Neue_Kabine) => Kabine_voll;\n\nNETWORK Anzeige\n=> MOVE(Z_Frei.CV, Frei);',
    p => 'NETWORK Plaetze\nEinstieg AND CTD(Z_Frei, PV:=' + p.P + ', LD:=Neue_Kabine) => Kabine_voll;'
  ]
});

/* ---------- Kapitel 9: Vergleicher, MOVE, Rechnen ---------- */
const OEL = (w, a) => 'NETWORK Warnung\n[Oel_Temp >= ' + w + '] AND [Oel_Temp <= ' + a + '] => Warnung;\n\nNETWORK Abschalten\n[Oel_Temp > ' + a + '] => Abschalten;';
defExamTask({ id:'x_kop_g_getriebe', quest:'kop', level:'grund', ch:9, diff:2,
  params:{ W:[70, 75, 80], A:[90, 95] },
  title:'Getriebeöl-Temperatur',
  brief: p => '<code>Oel_Temp</code> ist die Öltemperatur des Hauptgetriebes in °C (Int).<br><b>NW 1:</b> <code>Warnung</code> = 1 von <b>' + p.W + ' °C bis und mit ' + p.A + ' °C</b>.<br><b>NW 2:</b> <code>Abschalten</code> = 1 <b>über ' + p.A + ' °C</b>.',
  vars: () => ({ Oel_Temp:0, Warnung:false, Abschalten:false }),
  start: () => START('Warnung'),
  ref: p => OEL(p.W, p.A),
  must:['CMP'],
  visible: p => [[{ Oel_Temp:40 }, { Warnung:false, Abschalten:false }], [{ Oel_Temp:p.W + 5 }, { Warnung:true, Abschalten:false }]],
  hidden: p => [20, p.W - 1, p.W, p.W + 1, p.A - 1, p.A, p.A + 1, 130].map(t => [{ Oel_Temp:t }, { Warnung: t >= p.W && t <= p.A, Abschalten: t > p.A }]),
  wrong:[
    p => OEL(p.W, p.A).replace('>= ' + p.W, '> ' + p.W),
    p => OEL(p.W, p.A).replace('[Oel_Temp > ' + p.A + ']', '[Oel_Temp >= ' + p.A + ']'),
    p => 'NETWORK Warnung\n[Oel_Temp >= ' + p.W + '] => Warnung;\n\nNETWORK Abschalten\n[Oel_Temp > ' + p.A + '] => Abschalten;'
  ]
});

const LAST = (kg, max) => 'NETWORK Personen\n=> MUL(Gaeste, ' + kg + ', Last_kg);\n\nNETWORK Gepaeck\n=> ADD(Last_kg, Gepaeck_kg, Last_kg);\n\nNETWORK Ueberlast\n[Last_kg > ' + max + '] => Ueberlast;';
defExamTask({ id:'x_kop_g_last', quest:'kop', level:'grund', ch:9, diff:3,
  params:{ KG:[75, 80], MAX:[600, 700, 800] },
  title:'Kabinenlast berechnen',
  brief: p => 'Berechne die Last der Kabine in kg (alles Int):<br><b>NW 1:</b> <code>Last_kg</code> = <code>Gaeste</code> × ' + p.KG + ' (MUL)<br><b>NW 2:</b> <code>Last_kg</code> = <code>Last_kg</code> + <code>Gepaeck_kg</code> (ADD)<br><b>NW 3:</b> <code>Ueberlast</code> = 1, wenn <code>Last_kg</code> <b>grösser als ' + p.MAX + '</b> ist.<br>Alle Netzwerke ohne Bedingung bzw. mit Vergleicher; die Reihenfolge ist wichtig.',
  vars: () => ({ Gaeste:0, Gepaeck_kg:0, Last_kg:0, Ueberlast:false }),
  start: () => START('Personen'),
  ref: p => LAST(p.KG, p.MAX),
  must:['MUL','ADD','CMP'],
  visible: p => [[{ Gaeste:2, Gepaeck_kg:30 }, { Last_kg: 2 * p.KG + 30, Ueberlast:false }]],
  hidden: p => { const g = Math.floor(p.MAX / p.KG), b = p.MAX - g * p.KG, c = (G, B) => [{ Gaeste:G, Gepaeck_kg:B }, { Last_kg: G * p.KG + B, Ueberlast: G * p.KG + B > p.MAX }];
    return [c(0, 0), c(1, 0), c(3, 45), c(g, b), c(g, b + 1), c(g - 1, p.KG + b + 5), c(g + 1, 0), c(0, 120)]; },
  wrong:[
    p => 'NETWORK Ueberlast\n[Last_kg > ' + p.MAX + '] => Ueberlast;\n\nNETWORK Personen\n=> MUL(Gaeste, ' + p.KG + ', Last_kg);\n\nNETWORK Gepaeck\n=> ADD(Last_kg, Gepaeck_kg, Last_kg);',
    p => 'NETWORK Personen\n=> MUL(Gaeste, ' + p.KG + ', Last_kg);\n\nNETWORK Ueberlast\n[Last_kg > ' + p.MAX + '] => Ueberlast;',
    p => LAST(p.KG, p.MAX).replace('[Last_kg > ', '[Last_kg >= ')
  ]
});

/* ---------- Kapitel 10: Sicherheitskette, Schrittkette ---------- */
const KETTE = g => 'NETWORK Sicherheitskette\nSchranke_Zu AND Not_Halt_OK AND Seil_Lage_OK AND [Wind_kmh <= ' + g + '] => Kette_OK, NOT Ampel_Rot;\n\nNETWORK Antrieb\nS_Fahrt AND Kette_OK => Antrieb;';
const KIN = ['Schranke_Zu','Not_Halt_OK','Seil_Lage_OK','S_Fahrt'];
defExamTask({ id:'x_kop_g_kette', quest:'kop', level:'grund', ch:10, diff:2,
  params:{ G:[50, 60, 70] },
  title:'Sicherheitskette mit Windmesser',
  brief: p => '<b>NW 1:</b> Die Sicherheitskette <code>Kette_OK</code> ist geschlossen, wenn <code>Schranke_Zu</code>, <code>Not_Halt_OK</code> und <code>Seil_Lage_OK</code> 1 sind <b>und</b> <code>Wind_kmh</code> höchstens <b>' + p.G + '</b> ist. <code>Ampel_Rot</code> leuchtet genau dann, wenn die Kette offen ist.<br><b>NW 2:</b> <code>Antrieb</code> = <code>S_Fahrt</code> und <code>Kette_OK</code>.',
  vars: () => ({ Schranke_Zu:false, Not_Halt_OK:false, Seil_Lage_OK:false, Wind_kmh:0, S_Fahrt:false, Kette_OK:false, Ampel_Rot:false, Antrieb:false }),
  start: () => START('Sicherheitskette'),
  ref: p => KETTE(p.G),
  must:['SERIES','CMP'],
  visible: () => [[{ Schranke_Zu:true, Not_Halt_OK:true, Seil_Lage_OK:true, Wind_kmh:20, S_Fahrt:true }, { Kette_OK:true, Antrieb:true, Ampel_Rot:false }]],
  hidden: p => truth(KIN, e => { const k = e.Schranke_Zu && e.Not_Halt_OK && e.Seil_Lage_OK; return { Kette_OK:k, Ampel_Rot:!k, Antrieb: k && e.S_Fahrt }; }, { Wind_kmh:p.G })
    .concat([p.G + 1, p.G - 1, 0].map(w => [{ Schranke_Zu:true, Not_Halt_OK:true, Seil_Lage_OK:true, S_Fahrt:true, Wind_kmh:w }, { Kette_OK: w <= p.G, Ampel_Rot: w > p.G, Antrieb: w <= p.G }])),
  wrong:[
    p => KETTE(p.G).replace('<= ' + p.G, '< ' + p.G),
    p => KETTE(p.G).replace(' AND Seil_Lage_OK', ''),
    p => KETTE(p.G).replace('S_Fahrt AND Kette_OK', 'S_Fahrt')
  ]
});

const MAT = t => 'NETWORK Grundstellung\nNOT Schritt_Laden AND NOT Schritt_Fahrt AND NOT Schritt_Kippen => S Schritt_Laden;\n\nNETWORK Laden -> Fahrt\nSchritt_Laden AND Waage_voll => S Schritt_Fahrt, R Schritt_Laden;\n\nNETWORK Fahrt -> Kippen\nSchritt_Fahrt AND Oben => S Schritt_Kippen, R Schritt_Fahrt;\n\nNETWORK Kippen -> Laden\nSchritt_Kippen AND TON(T_Kippen, T#' + t + 'S) => S Schritt_Laden, R Schritt_Kippen;\n\nNETWORK Band\nSchritt_Laden => Band;\n\nNETWORK Winde\nSchritt_Fahrt => Winde;\n\nNETWORK Kippen\nSchritt_Kippen => Kippen;';
defExamTask({ id:'x_kop_g_materialbahn', quest:'kop', level:'grund', ch:10, diff:3, timed:true,
  params:{ T:[2, 3] },
  title:'Schrittkette der Materialbahn',
  brief: p => 'Die Materialbahn zur Bergstation arbeitet als Schrittkette mit den Schrittmerkern <code>Schritt_Laden</code>, <code>Schritt_Fahrt</code>, <code>Schritt_Kippen</code>:<br>' +
    '<b>Grundstellung:</b> Ist kein Schritt aktiv, wird <code>Schritt_Laden</code> gesetzt.<br>' +
    '<b>Laden → Fahrt:</b> wenn <code>Waage_voll</code> 1 ist.<br><b>Fahrt → Kippen:</b> wenn <code>Oben</code> 1 ist.<br><b>Kippen → Laden:</b> nach <b>' + p.T + ' s</b> im Schritt Kippen (TON-Instanz <code>T_Kippen</code>).<br>' +
    'Beim Weiterschalten wird der neue Schritt gesetzt und der alte rückgesetzt. Ausgänge: <code>Band</code> im Schritt Laden, <code>Winde</code> im Schritt Fahrt, <code>Kippen</code> im Schritt Kippen.',
  vars: () => ({ Waage_voll:false, Oben:false, Schritt_Laden:false, Schritt_Fahrt:false, Schritt_Kippen:false, Band:false, Winde:false, Kippen:false }),
  start: () => START('Grundstellung'),
  ref: p => MAT(p.T),
  must:['SET','RESET','TON'],
  visible: () => seq([[0,{},{Band:true, Winde:false}],[0.1,{Waage_voll:true},{Band:false, Winde:true}]]),
  hidden: p => [
    { steps:[[0,{},{Band:true, Winde:false, Kippen:false}],[0.1,{Waage_voll:true},{Band:false, Winde:true}],[0.1,{Waage_voll:false},{Winde:true}],[1,{},{Winde:true, Kippen:false}],[0.1,{Oben:true},{Winde:false, Kippen:true}],[p.T - 0.5,{Oben:false},{Kippen:true, Band:false}],[0.5,{},{Kippen:false, Band:true}],[0.1,{},{Band:true, Winde:false}]] },
    { steps:[[0,{Oben:true},{Band:true, Kippen:false, Winde:false}],[0.1,{Oben:false, Waage_voll:true},{Winde:true, Band:false}],[0.1,{Oben:true},{Kippen:true, Winde:false, Band:false}],[p.T + 0.1,{Oben:false},{Kippen:false, Band:true}],[0.1,{},{Winde:true, Band:false}]] },
    { steps:[[0,{},{Band:true}],[0.1,{Waage_voll:true},{Winde:true}],[0.1,{Waage_voll:false, Oben:true},{Kippen:true}],[0.1,{Oben:false, Waage_voll:true},{Kippen:true, Winde:false}],[0.1,{Waage_voll:false},{Kippen:true, Band:false}]] }
  ],
  wrong:[
    p => MAT(p.T).replace('Schritt_Fahrt AND Oben', 'Oben'),
    p => MAT(p.T).replace('S Schritt_Fahrt, R Schritt_Laden', 'S Schritt_Fahrt'),
    p => MAT(p.T).replace('TON(T_Kippen', 'TOF(T_Kippen')
  ]
});

/* =====================================================================
   PROFI-STUFE (Kapitel 11–15)
   ===================================================================== */
const MAIN = body => kOB('Main', body);

/* ---------- Kapitel 11: FC, Schnittstelle, Aufruf-Box ---------- */
const WIND_D = { in:'Wind:Int|Windgeschwindigkeit km/h; Grenze:Int|Abschaltgrenze; Sturm_Hand:Bool|Sturmwarnung von Hand', out:'Abschalten:Bool|Fahrt verboten' };
defExamTask({ id:'x_kop_p_wind', quest:'kop', level:'profi', ch:11, diff:1,
  params:{ G:[50, 60, 70] },
  title:'Windabschaltung als FC',
  brief: p => 'Programmiere die Funktion <code>FC_Wind</code>: <code>#Abschalten</code> ist 1, wenn <code>#Wind</code> <b>grösser als</b> <code>#Grenze</code> ist <b>oder</b> <code>#Sturm_Hand</code> 1 ist. Der OB <code>Main</code> (🔒) ruft die FC mit der Grenze ' + p.G + ' km/h auf.',
  blocks: p => [
    { name:'FC_Wind', kind:'FC', edit:true, start: kFC('FC_Wind', 'Void', WIND_D, ''), ref: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind > #Grenze] OR #Sturm_Hand => #Abschalten;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Windwaechter\n=> "FC_Wind"(Wind := "Wind_kmh", Grenze := ' + p.G + ', Sturm_Hand := "S_Sturm", Abschalten => "Wind_Stopp");') }
  ],
  globals: () => ({ Wind_kmh:0, S_Sturm:false, Wind_Stopp:false }),
  must:['CMP'],
  visible: p => ({ tests:[[{Wind_kmh:10},{Wind_Stopp:false}], [{Wind_kmh:p.G + 20},{Wind_Stopp:true}]] }),
  hidden: p => ({
    unit:[{ block:'FC_Wind', steps:[[{Wind:30, Grenze:40, Sturm_Hand:false},{Abschalten:false}],[{Wind:40, Grenze:40, Sturm_Hand:false},{Abschalten:false}],[{Wind:41, Grenze:40, Sturm_Hand:false},{Abschalten:true}],[{Wind:0, Grenze:40, Sturm_Hand:true},{Abschalten:true}],[{Wind:90, Grenze:40, Sturm_Hand:true},{Abschalten:true}]] }],
    tests:[[{Wind_kmh:p.G},{Wind_Stopp:false}],[{Wind_kmh:p.G + 1},{Wind_Stopp:true}],[{Wind_kmh:p.G - 1},{Wind_Stopp:false}],[{Wind_kmh:5, S_Sturm:true},{Wind_Stopp:true}]]
  }),
  wrong:[
    () => ({ FC_Wind: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind >= #Grenze] OR #Sturm_Hand => #Abschalten;') }),
    () => ({ FC_Wind: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind > #Grenze] AND NOT #Sturm_Hand => #Abschalten;') })
  ]
});

const PL_D = { in:'Gaeste:Int|Personen in der Kabine; Kapazitaet:Int|Plätze der Kabine', out:'Voll:Bool|Kabine voll' };
const PL_FC = body => kFC('FC_Plaetze', 'Int', PL_D, body);
const PL_NW = 'NETWORK Freie Plaetze\n=> SUB(#Kapazitaet, #Gaeste, #Ret_Val);\n\nNETWORK Voll\n[#Gaeste >= #Kapazitaet] => #Voll;';
defExamTask({ id:'x_kop_p_plaetze', quest:'kop', level:'profi', ch:11, diff:2,
  params:{ K:[6, 8, 10] },
  title:'Freie Plätze als Rückgabewert',
  brief: p => 'Die Funktion <code>FC_Plaetze</code> hat den Rückgabetyp <code>Int</code>.<br><b>NW 1:</b> ohne Bedingung → <b>SUB</b>: <code>#Kapazitaet</code> − <code>#Gaeste</code> nach <code>#Ret_Val</code><br><b>NW 2:</b> <code>#Voll</code> = 1, wenn <code>#Gaeste</code> mindestens <code>#Kapazitaet</code> ist.<br><code>Main</code> (🔒) ruft die FC mit der Kapazität ' + p.K + ' auf.',
  blocks: p => [
    { name:'FC_Plaetze', kind:'FC', edit:true, start: PL_FC(''), ref: PL_FC(PL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Kabine\n=> "FC_Plaetze"(Gaeste := "Gaeste", Kapazitaet := ' + p.K + ', Voll => "Kabine_voll", Ret_Val => "Frei");') }
  ],
  globals: () => ({ Gaeste:0, Kabine_voll:false, Frei:0 }),
  must:['RETVAL','SUB','CMP'],
  visible: p => ({ tests:[[{ Gaeste:2 }, { Frei:p.K - 2, Kabine_voll:false }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Plaetze', steps:[[{ Gaeste:0, Kapazitaet:4 }, { RET:4, Voll:false }], [{ Gaeste:3, Kapazitaet:4 }, { RET:1, Voll:false }], [{ Gaeste:4, Kapazitaet:4 }, { RET:0, Voll:true }], [{ Gaeste:5, Kapazitaet:4 }, { RET:-1, Voll:true }]] }],
    tests:[[{ Gaeste:0 }, { Frei:p.K, Kabine_voll:false }], [{ Gaeste:p.K - 1 }, { Frei:1, Kabine_voll:false }], [{ Gaeste:p.K }, { Frei:0, Kabine_voll:true }]]
  }),
  wrong:[
    () => ({ FC_Plaetze: PL_FC('NETWORK Freie Plaetze\n=> SUB(#Gaeste, #Kapazitaet, #Ret_Val);\n\nNETWORK Voll\n[#Gaeste >= #Kapazitaet] => #Voll;') }),
    () => ({ FC_Plaetze: PL_FC('NETWORK Freie Plaetze\n=> SUB(#Kapazitaet, #Gaeste, #Ret_Val);\n\nNETWORK Voll\n[#Gaeste > #Kapazitaet] => #Voll;') })
  ]
});

/* ---------- Kapitel 12: FB, Instanz, Multiinstanz ---------- */
const HUPE_D = { in:'Abfahrt:Bool|Abfahrsignal', out:'Hupe:Bool|Warnhupe', stat:'T_Hupe:TP|Hupdauer' };
const HUPE_FB = (k, t) => kFB('FB_Warnhupe', HUPE_D, 'NETWORK Hupe\n#Abfahrt AND ' + k + '(#T_Hupe, T#' + t + 'S) => #Hupe;');
defExamTask({ id:'x_kop_p_warnhupe', quest:'kop', level:'profi', ch:12, diff:1,
  params:{ T:[2, 3, 4] },
  title:'Warnhupe mit fester Dauer',
  brief: p => 'In <code>FB_Warnhupe</code> ist die Static-Variable <code>T_Hupe : TP</code> deklariert.<br>Jede steigende Flanke von <code>#Abfahrt</code> soll <code>#Hupe</code> für genau <b>' + p.T + ' s</b> einschalten — egal, wie lange <code>#Abfahrt</code> ansteht. Verwende den Impuls-Timer <code>#T_Hupe</code>.<br><code>Main</code> (🔒) ruft den FB mit <code>"FB_Warnhupe_DB"</code> auf.',
  blocks: p => [
    { name:'FB_Warnhupe', kind:'FB', edit:true, start: kFB('FB_Warnhupe', HUPE_D, ''), ref: HUPE_FB('TP', p.T) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Warnhupe\n=> "FB_Warnhupe_DB"(Abfahrt := "S_Abfahrt", Hupe => "Hupe");') }
  ],
  globals: () => ({ S_Abfahrt:false, Hupe:false }),
  must:['TP'],
  visible: p => ({ timed: seq([[0,{ S_Abfahrt:true },{ Hupe:true }],[0.1,{ S_Abfahrt:false },{ Hupe:true }],[p.T,{},{ Hupe:false }]]) }),
  hidden: p => ({
    unit:[{ block:'FB_Warnhupe', steps:[[0,{ Abfahrt:true },{ Hupe:true }],[p.T + 1,{},{ Hupe:false }],[0.1,{ Abfahrt:false },{ Hupe:false }],[0.1,{ Abfahrt:true },{ Hupe:true }],[0.1,{ Abfahrt:false },{ Hupe:true }]] }],
    timed:[
      { steps:[[0,{},{ Hupe:false }],[0.1,{ S_Abfahrt:true },{ Hupe:true }],[0.1,{ S_Abfahrt:false },{ Hupe:true }],[p.T - 0.5,{},{ Hupe:true }],[0.6,{},{ Hupe:false }],[1,{},{ Hupe:false }]] },
      { steps:[[0.1,{ S_Abfahrt:true },{ Hupe:true }],[p.T - 0.3,{},{ Hupe:true }],[0.5,{},{ Hupe:false }],[2,{},{ Hupe:false }],[0.1,{ S_Abfahrt:false },{ Hupe:false }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Warnhupe: kFB('FB_Warnhupe', { in:'Abfahrt:Bool', out:'Hupe:Bool', stat:'T_Hupe:TON' }, 'NETWORK Hupe\n#Abfahrt AND TON(#T_Hupe, T#' + p.T + 'S) => #Hupe;') }),
    p => ({ FB_Warnhupe: kFB('FB_Warnhupe', { in:'Abfahrt:Bool', out:'Hupe:Bool', stat:'T_Hupe:TOF' }, 'NETWORK Hupe\n#Abfahrt AND TOF(#T_Hupe, T#' + p.T + 'S) => #Hupe;') }),
    p => ({ FB_Warnhupe: HUPE_FB('TP', p.T + 1) })
  ]
});

const BEL_D = { in:'Einstieg:Bool|Lichtschranke Einstieg; Ausstieg:Bool|Lichtschranke Ausstieg; Max:Int|Plätze', out:'Anzahl:Int|Personen in der Kabine; Voll:Bool' };
const BEL_NW = 'NETWORK Einsteigen\nP(#Einstieg) => INC(#Anzahl);\n\nNETWORK Aussteigen\nP(#Ausstieg) AND [#Anzahl > 0] => DEC(#Anzahl);\n\nNETWORK Voll\n[#Anzahl >= #Max] => #Voll;';
defExamTask({ id:'x_kop_p_belegung', quest:'kop', level:'profi', ch:12, diff:2,
  params:{ M:[3, 4] },
  title:'Kabinenbelegung im FB',
  brief: p => 'Programmiere <code>FB_Belegung</code>:<br><b>NW 1:</b> steigende Flanke von <code>#Einstieg</code> → INC <code>#Anzahl</code><br><b>NW 2:</b> steigende Flanke von <code>#Ausstieg</code> <b>und</b> <code>#Anzahl</code> &gt; 0 → DEC <code>#Anzahl</code><br><b>NW 3:</b> <code>#Voll</code> = 1, wenn <code>#Anzahl</code> ≥ <code>#Max</code><br><code>Main</code> (🔒) ruft den FB mit <code>Max := ' + p.M + '</code> auf.',
  blocks: p => [
    { name:'FB_Belegung', kind:'FB', edit:true, start: kFB('FB_Belegung', BEL_D, ''), ref: kFB('FB_Belegung', BEL_D, BEL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Belegung\n=> "FB_Belegung_DB"(Einstieg := "LS_Ein", Ausstieg := "LS_Aus", Max := ' + p.M + ', Anzahl => "Anzahl", Voll => "Kabine_voll");') }
  ],
  globals: () => ({ LS_Ein:false, LS_Aus:false, Anzahl:0, Kabine_voll:false }),
  must:['EDGE_P','INC','DEC','CMP'],
  visible: () => ({ timed: seq([[0,{ LS_Ein:true },{ Anzahl:1 }],[0.1,{ LS_Ein:false },{ Anzahl:1 }],[0.1,{ LS_Aus:true },{ Anzahl:0 }]]) }),
  hidden: p => ({
    unit:[{ block:'FB_Belegung', steps:[[0,{ Max:5, Ausstieg:true },{ Anzahl:0 }],[0.1,{ Ausstieg:false },{ Anzahl:0 }],[0.1,{ Einstieg:true },{ Anzahl:1, Voll:false }],[0.5,{},{ Anzahl:1 }],[0.1,{ Einstieg:false, Ausstieg:true },{ Anzahl:0 }],[0.1,{ Ausstieg:false },{ Anzahl:0 }]] }],
    timed:[
      { steps: pulses('LS_Ein', p.M, i => ({ Anzahl:i, Kabine_voll: i >= p.M })).concat([[0.1,{ LS_Aus:true },{ Anzahl:p.M - 1, Kabine_voll:false }],[0.3,{},{ Anzahl:p.M - 1 }],[0.1,{ LS_Aus:false },{ Anzahl:p.M - 1 }]]) },
      { steps:[[0.1,{ LS_Aus:true },{ Anzahl:0 }],[0.1,{ LS_Aus:false },{ Anzahl:0 }],[0.1,{ LS_Ein:true },{ Anzahl:1 }],[0.1,{},{ Anzahl:1 }],[0.1,{ LS_Ein:false },{ Anzahl:1, Kabine_voll:false }]] }
    ]
  }),
  wrong:[
    () => ({ FB_Belegung: kFB('FB_Belegung', BEL_D, BEL_NW.replace('P(#Einstieg)', '#Einstieg')) }),
    () => ({ FB_Belegung: kFB('FB_Belegung', BEL_D, BEL_NW.replace(' AND [#Anzahl > 0]', '')) }),
    () => ({ FB_Belegung: kFB('FB_Belegung', BEL_D, BEL_NW.replace('[#Anzahl >= #Max]', '[#Anzahl > #Max]')) })
  ]
});

const UEB_D = { in:'Befehl:Bool; Rueckmeldung:Bool; Zeit:Time|Überwachungszeit; Quit:Bool', out:'Fehler:Bool', stat:'T_Ueber:TON' };
const UEB_FB = kFB('FB_Ueberw', UEB_D, 'NETWORK Ueberwachen\n#Befehl AND NOT #Rueckmeldung AND TON(#T_Ueber, #Zeit) => S #Fehler;\n\nNETWORK Quittieren\n#Quit AND NOT #Befehl => R #Fehler;');
const BRS_D = { in:'Lueften:Bool|Befehl Bremsen lüften; RM_Br1:Bool|Bremse 1 offen; RM_Br2:Bool|Bremse 2 offen; Quit:Bool', out:'Stoerung:Bool; Frei:Bool|Fahrfreigabe', stat:'Br1:"FB_Ueberw"; Br2:"FB_Ueberw"' };
const BRS_NW = t => 'NETWORK Bremse 1\n=> #Br1(Befehl := #Lueften, Rueckmeldung := #RM_Br1, Zeit := T#' + t + 'S, Quit := #Quit);\n\nNETWORK Bremse 2\n=> #Br2(Befehl := #Lueften, Rueckmeldung := #RM_Br2, Zeit := T#' + t + 'S, Quit := #Quit);\n\nNETWORK Sammelstoerung\n#Br1.Fehler OR #Br2.Fehler => #Stoerung;\n\nNETWORK Freigabe\n#Lueften AND #RM_Br1 AND #RM_Br2 AND NOT #Stoerung => #Frei;';
defExamTask({ id:'x_kop_p_bremsen', quest:'kop', level:'profi', ch:12, diff:3,
  params:{ T:[2, 3] },
  title:'Zwei Bremsen, zwei Multiinstanzen',
  brief: p => '<code>FB_Ueberw</code> (🔒) überwacht einen Befehl mit Rückmeldung (Ausgang <code>Fehler</code>). In <code>FB_Bremsen</code> sind die Multiinstanzen <code>Br1</code> und <code>Br2</code> vom Typ <code>"FB_Ueberw"</code> deklariert.<br>' +
    '<b>NW 1:</b> <code>#Br1</code> aufrufen: Befehl := <code>#Lueften</code>, Rueckmeldung := <code>#RM_Br1</code>, Zeit := <code>T#' + p.T + 'S</code>, Quit := <code>#Quit</code><br><b>NW 2:</b> <code>#Br2</code> ebenso mit <code>#RM_Br2</code><br>' +
    '<b>NW 3:</b> <code>#Br1.Fehler</code> oder <code>#Br2.Fehler</code> → <code>#Stoerung</code><br><b>NW 4:</b> <code>#Lueften</code> und beide Rückmeldungen und keine Störung → <code>#Frei</code>',
  blocks: p => [
    { name:'FB_Ueberw', kind:'FB', src: UEB_FB },
    { name:'FB_Bremsen', kind:'FB', edit:true, start: kFB('FB_Bremsen', BRS_D, ''), ref: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bremsen\n=> "FB_Bremsen_DB"(Lueften := "Bremse_Lueften", RM_Br1 := "RM_Bremse1", RM_Br2 := "RM_Bremse2", Quit := "Quittieren", Stoerung => "Bremsstoerung", Frei => "Fahrt_frei");') }
  ],
  globals: () => ({ Bremse_Lueften:false, RM_Bremse1:false, RM_Bremse2:false, Quittieren:false, Bremsstoerung:false, Fahrt_frei:false }),
  must:['MULTI','CALL'],
  visible: () => ({ timed: seq([[0,{ Bremse_Lueften:true },{ Fahrt_frei:false }],[0.5,{ RM_Bremse1:true, RM_Bremse2:true },{ Fahrt_frei:true, Bremsstoerung:false }]]) }),
  hidden: p => ({
    timed:[
      { steps:[[0,{ Bremse_Lueften:true },{ Bremsstoerung:false }],[0.5,{ RM_Bremse1:true },{ Fahrt_frei:false }],[p.T,{},{ Bremsstoerung:true, Fahrt_frei:false }],[0.1,{ RM_Bremse2:true },{ Bremsstoerung:true, Fahrt_frei:false }],[0.1,{ Bremse_Lueften:false, Quittieren:true },{ Bremsstoerung:false }],[0.1,{ Quittieren:false, Bremse_Lueften:true },{ Fahrt_frei:true }]] },
      { steps:[[0,{ Bremse_Lueften:true, RM_Bremse2:true },{}],[p.T - 0.5,{},{ Bremsstoerung:false }],[0.7,{},{ Bremsstoerung:true }],[0.1,{ Quittieren:true },{ Bremsstoerung:true }]] },
      { steps:[[0,{ Bremse_Lueften:true },{}],[0.3,{ RM_Bremse1:true, RM_Bremse2:true },{ Fahrt_frei:true }],[p.T + 1,{},{ Fahrt_frei:true, Bremsstoerung:false }],[0.1,{ RM_Bremse2:false },{ Fahrt_frei:false, Bremsstoerung:false }],[p.T + 0.2,{},{ Bremsstoerung:true }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Bremsen: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T).replace('#Br1.Fehler OR #Br2.Fehler', '#Br1.Fehler')) }),
    p => ({ FB_Bremsen: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T).replace(' AND NOT #Stoerung', '')) }),
    p => ({ FB_Bremsen: kFB('FB_Bremsen', BRS_D, BRS_NW(p.T + 2)) })
  ]
});

/* ---------- Kapitel 13: Datenbaustein, PLC-Datentyp, Array ---------- */
const SEIL_DB = (mn, mx) => kDB('DB_Seil', 'Spannung_kN:Int|Messwert Seilspannung; Min_kN:Int := ' + mn + '|untere Grenze; Max_kN:Int := ' + mx + '|obere Grenze');
const SEIL_NW = 'NETWORK Alarm\n["DB_Seil".Spannung_kN < "DB_Seil".Min_kN] OR ["DB_Seil".Spannung_kN > "DB_Seil".Max_kN] => "Seil_Alarm";\n\nNETWORK Anzeige\n=> MOVE("DB_Seil".Spannung_kN, "Anzeige");';
defExamTask({ id:'x_kop_p_seilspannung', quest:'kop', level:'profi', ch:13, diff:1,
  params:{ MIN:[40, 50], MAX:[80, 90] },
  title:'Seilspannung aus dem Datenbaustein',
  brief: p => '<code>DB_Seil</code> (🔒) enthält den Messwert <code>Spannung_kN</code> und die Grenzen <code>Min_kN</code> (Startwert ' + p.MIN + ') und <code>Max_kN</code> (Startwert ' + p.MAX + '). In <code>Main</code>:<br><b>NW 1:</b> <code>"Seil_Alarm"</code> = 1, wenn die Spannung <b>kleiner als</b> <code>Min_kN</code> <b>oder grösser als</b> <code>Max_kN</code> ist. Lies die Grenzen aus dem DB (keine festen Zahlen).<br><b>NW 2:</b> ohne Bedingung → MOVE der Spannung nach <code>"Anzeige"</code>.',
  blocks: p => [
    { name:'DB_Seil', kind:'DB', src: SEIL_DB(p.MIN, p.MAX) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(SEIL_NW) }
  ],
  globals: () => ({ Seil_Alarm:false, Anzeige:0 }),
  must:['DB_ACCESS','CMP','MOVE'],
  visible: p => ({ tests:[[{ 'DB_Seil.Spannung_kN':p.MIN + 10 }, { Seil_Alarm:false, Anzeige:p.MIN + 10 }], [{ 'DB_Seil.Spannung_kN':10 }, { Seil_Alarm:true }]] }),
  hidden: p => ({ tests: [p.MIN - 1, p.MIN, p.MAX, p.MAX + 1, 0].map(v => [{ 'DB_Seil.Spannung_kN':v }, { Seil_Alarm: v < p.MIN || v > p.MAX, Anzeige:v }])
    .concat([[{ 'DB_Seil.Spannung_kN':p.MAX - 5, 'DB_Seil.Max_kN':p.MAX - 10 }, { Seil_Alarm:true }], [{ 'DB_Seil.Spannung_kN':p.MIN + 2, 'DB_Seil.Min_kN':p.MIN + 5 }, { Seil_Alarm:true }]]) }),
  wrong:[
    p => ({ Main: MAIN('NETWORK Alarm\n["DB_Seil".Spannung_kN < ' + p.MIN + '] OR ["DB_Seil".Spannung_kN > ' + p.MAX + '] => "Seil_Alarm";\n\nNETWORK Anzeige\n=> MOVE("DB_Seil".Spannung_kN, "Anzeige");') }),
    () => ({ Main: MAIN(SEIL_NW.replace('< "DB_Seil".Min_kN', '<= "DB_Seil".Min_kN')) }),
    () => ({ Main: MAIN(SEIL_NW.replace('NETWORK Anzeige\n=> MOVE("DB_Seil".Spannung_kN, "Anzeige");', 'NETWORK Anzeige\n=> MOVE("DB_Seil".Max_kN, "Anzeige");')) })
  ]
});

const GONDEL_UDT = kUDT('UDT_Gondel', 'Tuer_Zu:Bool|Tür geschlossen; Last_kg:Int|Zuladung; Revision:Bool|in Revision');
const GONDEL_DB = kDB('DB_Gondeln', 'G1:"UDT_Gondel"|Gondel 1; G2:"UDT_Gondel"|Gondel 2');
const GONDEL_D = { in:'Gondel:"UDT_Gondel"|Daten der Gondel; Max_kg:Int|zulässige Zuladung', out:'Bereit:Bool|abfahrbereit; Ueberlast:Bool' };
const GONDEL_NW = 'NETWORK Ueberlast\n[#Gondel.Last_kg > #Max_kg] => #Ueberlast;\n\nNETWORK Bereit\n#Gondel.Tuer_Zu AND NOT #Gondel.Revision AND [#Gondel.Last_kg <= #Max_kg] => #Bereit;';
defExamTask({ id:'x_kop_p_gondel', quest:'kop', level:'profi', ch:13, diff:2,
  params:{ MAX:[480, 560, 640] },
  title:'Gondel als PLC-Datentyp',
  brief: p => 'Der PLC-Datentyp <code>UDT_Gondel</code> (🔒) enthält <code>Tuer_Zu</code>, <code>Last_kg</code> und <code>Revision</code>. <code>FC_Gondel</code> bekommt eine ganze Gondel als Input <code>#Gondel</code>:<br><b>NW 1:</b> <code>#Ueberlast</code> = 1, wenn <code>#Gondel.Last_kg</code> grösser als <code>#Max_kg</code> ist.<br><b>NW 2:</b> <code>#Bereit</code> = Tür zu <b>und</b> nicht in Revision <b>und</b> keine Überlast.<br><code>Main</code> (🔒) ruft die FC für beide Gondeln mit <code>Max_kg := ' + p.MAX + '</code> auf.',
  blocks: p => [
    { name:'UDT_Gondel', kind:'UDT', src: GONDEL_UDT },
    { name:'DB_Gondeln', kind:'DB', src: GONDEL_DB },
    { name:'FC_Gondel', kind:'FC', edit:true, start: kFC('FC_Gondel', 'Void', GONDEL_D, ''), ref: kFC('FC_Gondel', 'Void', GONDEL_D, GONDEL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gondel 1\n=> "FC_Gondel"(Gondel := "DB_Gondeln".G1, Max_kg := ' + p.MAX + ', Bereit => "G1_Bereit", Ueberlast => "G1_Ueberlast");\n\nNETWORK Gondel 2\n=> "FC_Gondel"(Gondel := "DB_Gondeln".G2, Max_kg := ' + p.MAX + ', Bereit => "G2_Bereit", Ueberlast => "G2_Ueberlast");') }
  ],
  globals: () => ({ G1_Bereit:false, G1_Ueberlast:false, G2_Bereit:false, G2_Ueberlast:false }),
  must:['UDT_REF','MEMBER','CMP'],
  visible: () => ({ tests:[[{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Last_kg':200 }, { G1_Bereit:true, G1_Ueberlast:false }]] }),
  hidden: p => ({ tests:[
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Last_kg':p.MAX }, { G1_Bereit:true, G1_Ueberlast:false }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Last_kg':p.MAX + 1 }, { G1_Bereit:false, G1_Ueberlast:true }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':false, 'DB_Gondeln.G1.Last_kg':100 }, { G1_Bereit:false, G1_Ueberlast:false }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G1.Revision':true, 'DB_Gondeln.G1.Last_kg':0 }, { G1_Bereit:false, G1_Ueberlast:false }],
    [{ 'DB_Gondeln.G2.Tuer_Zu':true, 'DB_Gondeln.G2.Last_kg':300 }, { G2_Bereit:true, G1_Bereit:false }],
    [{ 'DB_Gondeln.G1.Tuer_Zu':true, 'DB_Gondeln.G2.Tuer_Zu':true, 'DB_Gondeln.G2.Last_kg':p.MAX + 40 }, { G1_Bereit:true, G2_Bereit:false, G2_Ueberlast:true, G1_Ueberlast:false }]
  ] }),
  wrong:[
    () => ({ FC_Gondel: kFC('FC_Gondel', 'Void', GONDEL_D, GONDEL_NW.replace('[#Gondel.Last_kg > #Max_kg]', '[#Gondel.Last_kg >= #Max_kg]').replace('<= #Max_kg', '< #Max_kg')) }),
    () => ({ FC_Gondel: kFC('FC_Gondel', 'Void', GONDEL_D, GONDEL_NW.replace(' AND NOT #Gondel.Revision', '')) })
  ]
});

const STZ_NW = (n, g) => 'NETWORK Zaehler null\n=> MOVE(0, "Anzahl");\n\n' + Array.from({ length:n }, (_, i) => 'NETWORK Stuetze ' + (i + 1) + '\n["DB_Wind".Stuetze[' + (i + 1) + '] > ' + g + '] => INC("Anzahl");\n\n').join('') + 'NETWORK Sturm\n["Anzahl" > 0] => "Sturm";\n\nNETWORK Fahrt stoppen\n["Anzahl" >= 2] => "Fahrt_Stopp";';
const stzSet = (arr) => Object.fromEntries(arr.map((v, i) => ['DB_Wind.Stuetze[' + (i + 1) + ']', v]));
const stzExp = (arr, g) => { const n = arr.filter(v => v > g).length; return { Anzahl:n, Sturm: n > 0, Fahrt_Stopp: n >= 2 }; };
defExamTask({ id:'x_kop_p_stuetzen', quest:'kop', level:'profi', ch:13, diff:3,
  params:{ N:[3, 4], G:[60, 70] },
  title:'Windmesser an den Stützen',
  brief: p => '<code>DB_Wind</code> (🔒) enthält das Array <code>Stuetze : Array[1..' + p.N + '] of Int</code> mit der Windgeschwindigkeit an jeder Stütze. In <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung MOVE 0 nach <code>"Anzahl"</code><br><b>NW 2 …:</b> für jede Stütze 1 … ' + p.N + ': Wind <b>grösser als ' + p.G + '</b> → INC <code>"Anzahl"</code> (je ein Netzwerk)<br><b>danach:</b> <code>"Anzahl"</code> &gt; 0 → <code>"Sturm"</code>; <code>"Anzahl"</code> ≥ 2 → <code>"Fahrt_Stopp"</code>',
  blocks: p => [
    { name:'DB_Wind', kind:'DB', src: kDB('DB_Wind', 'Stuetze:Array[1..' + p.N + '] of Int|Wind km/h je Stütze') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(STZ_NW(p.N, p.G)) }
  ],
  globals: () => ({ Anzahl:0, Sturm:false, Fahrt_Stopp:false }),
  must:['ARRAY','CMP','INC','MOVE'],
  visible: p => ({ tests:[[stzSet(Array(p.N).fill(10)), { Anzahl:0, Sturm:false }], [stzSet([p.G + 5].concat(Array(p.N - 1).fill(0))), { Anzahl:1, Sturm:true, Fahrt_Stopp:false }]] }),
  hidden: p => { const g = p.G, n = p.N, last = Array(n).fill(0); last[n - 1] = g + 1; const two = Array(n).fill(g); two[1] = g + 20; two[n - 1] = g + 1;
    const cases = [Array(n).fill(g), last, two, Array(n).fill(g + 1)];
    return { tests: cases.map(a => [stzSet(a), stzExp(a, g)]),
      timed:[{ steps:[[0.1, stzSet(two), stzExp(two, g)], [0.1, {}, stzExp(two, g)], [0.1, stzSet(Array(n).fill(0)), { Anzahl:0, Sturm:false, Fahrt_Stopp:false }]] }] }; },
  wrong:[
    p => ({ Main: MAIN(STZ_NW(p.N, p.G).replace('NETWORK Zaehler null\n=> MOVE(0, "Anzahl");\n\n', '')) }),
    p => ({ Main: MAIN(STZ_NW(p.N - 1, p.G)) }),
    p => ({ Main: MAIN(STZ_NW(p.N, p.G).split('] > ' + p.G + ']').join('] >= ' + p.G + ']')) })
  ]
});

/* ---------- Kapitel 14: Standardbausteine ---------- */
const BAND_D = { in:'Start:Bool; Stopp:Bool|Taster Stopp (Schliesser); Freigabe:Bool; Drehzahl_RM:Bool|Drehwächter meldet Bewegung; Quit:Bool', out:'Laeuft:Bool; Stoerung:Bool', stat:'T_Lauf:TON|Laufüberwachung' };
const BAND_NW = t => 'NETWORK Antrieb\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe AND NOT #Stoerung => #Laeuft;\n\nNETWORK Laufueberwachung\n#Laeuft AND NOT #Drehzahl_RM AND TON(#T_Lauf, T#' + t + 'S) => S #Stoerung;\n\nNETWORK Quittieren\n#Quit => R #Stoerung;';
defExamTask({ id:'x_kop_p_gepaeckband', quest:'kop', level:'profi', ch:14, diff:3,
  params:{ T:[2, 3] },
  title:'Standardbaustein Gepäckband',
  brief: p => 'Programmiere den Standardbaustein <code>FB_Band</code> (Schnittstelle inkl. <code>T_Lauf : TON</code> ist deklariert):<br>' +
    '<b>Antrieb:</b> <code>#Start</code> startet <code>#Laeuft</code> mit Selbsthaltung; <code>#Stopp</code> (Schliesser), fehlende <code>#Freigabe</code> oder eine anstehende <code>#Stoerung</code> schalten ab.<br>' +
    '<b>Laufüberwachung:</b> Läuft das Band und meldet <code>#Drehzahl_RM</code> <b>' + p.T + ' s</b> lang keine Bewegung, wird <code>#Stoerung</code> gesetzt.<br><b>Quittieren:</b> <code>#Quit</code> setzt <code>#Stoerung</code> zurück.',
  blocks: p => [
    { name:'FB_Band', kind:'FB', edit:true, start: kFB('FB_Band', BAND_D, ''), ref: kFB('FB_Band', BAND_D, BAND_NW(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gepaeckband\n=> "FB_Band_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Drehzahl_RM := "Drehwaechter", Quit := "Quittieren", Laeuft => "Band", Stoerung => "Band_Stoerung");') }
  ],
  globals: () => ({ S_Start:false, S_Stopp:false, Kette_OK:true, Drehwaechter:false, Quittieren:false, Band:false, Band_Stoerung:false }),
  must:['TON','SET','RESET','PARALLEL'],
  visible: () => ({ timed: seq([[0,{ S_Start:true, Drehwaechter:true },{ Band:true }],[0.1,{ S_Start:false },{ Band:true }],[0.1,{ S_Stopp:true },{ Band:false }]]) }),
  hidden: p => ({
    unit:[{ block:'FB_Band', steps:[[0,{ Start:true, Freigabe:true, Drehzahl_RM:true },{ Laeuft:true }],[0.1,{ Start:false },{ Laeuft:true }],[p.T + 1,{},{ Laeuft:true, Stoerung:false }],[0.1,{ Freigabe:false },{ Laeuft:false }],[0.1,{ Freigabe:true },{ Laeuft:false }]] }],
    timed:[
      { steps:[[0,{ S_Start:true },{ Band:true }],[0.1,{ S_Start:false },{ Band_Stoerung:false }],[p.T - 0.6,{},{ Band:true, Band_Stoerung:false }],[1,{},{ Band_Stoerung:true }],[0.1,{},{ Band:false, Band_Stoerung:true }],[0.1,{ S_Start:true },{ Band:false }],[0.1,{ S_Start:false, Quittieren:true },{ Band_Stoerung:false, Band:false }],[0.1,{ Quittieren:false, S_Start:true, Drehwaechter:true },{ Band:true }]] },
      { steps:[[0,{ S_Start:true, Drehwaechter:true },{ Band:true }],[0.1,{ S_Start:false },{ Band:true }],[p.T + 2,{},{ Band:true, Band_Stoerung:false }],[0.1,{ Drehwaechter:false },{ Band_Stoerung:false }],[p.T - 0.6,{},{ Band_Stoerung:false }],[1,{},{ Band_Stoerung:true }],[0.1,{},{ Band:false }]] },
      { steps:[[0,{ S_Start:true, Drehwaechter:true, Kette_OK:false },{ Band:false }],[0.1,{ Kette_OK:true },{ Band:true }],[0.1,{ S_Start:false, S_Stopp:true },{ Band:false }],[0.1,{ S_Stopp:false },{ Band:false }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Band: kFB('FB_Band', BAND_D, BAND_NW(p.T).replace(' AND NOT #Stoerung => #Laeuft', ' => #Laeuft')) }),
    p => ({ FB_Band: kFB('FB_Band', BAND_D, BAND_NW(p.T).replace('#Laeuft AND NOT #Drehzahl_RM AND TON', '#Laeuft AND TON')) }),
    p => ({ FB_Band: kFB('FB_Band', BAND_D, BAND_NW(p.T + 1)) })
  ]
});

const LAMP_D = { in:'Stoerung:Bool|Störung steht an; Quittiert:Bool|Störung quittiert; Takt:Bool|Blinktakt 1 Hz', out:'Lampe:Bool|Meldeleuchte; Hupe:Bool' };
const LAMP_NW = 'NETWORK Leuchte\n#Stoerung AND ((#Takt AND NOT #Quittiert) OR #Quittiert) => #Lampe;\n\nNETWORK Hupe\n#Stoerung AND NOT #Quittiert => #Hupe;';
defExamTask({ id:'x_kop_p_meldeleuchte', quest:'kop', level:'profi', ch:14, diff:2,
  title:'Standard-Meldeleuchte',
  brief: () => 'Programmiere die Funktion <code>FC_Meldung</code> nach dem Werkstandard für Störmeldungen:<br>' +
    '• Störung steht an und ist <b>noch nicht quittiert</b>: <code>#Lampe</code> blinkt im <code>#Takt</code>, <code>#Hupe</code> ist 1.<br>• Störung steht an und <b>ist quittiert</b>: <code>#Lampe</code> leuchtet dauernd, <code>#Hupe</code> ist 0.<br>• Keine Störung: beide 0.<br><code>Main</code> (🔒) ruft die FC für die Seilstörung auf.',
  blocks: () => [
    { name:'FC_Meldung', kind:'FC', edit:true, start: kFC('FC_Meldung', 'Void', LAMP_D, ''), ref: kFC('FC_Meldung', 'Void', LAMP_D, LAMP_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Seilstoerung\n=> "FC_Meldung"(Stoerung := "Seil_Stoerung", Quittiert := "Seil_Quittiert", Takt := "Takt_1Hz", Lampe => "Lampe_Seil", Hupe => "Hupe");') }
  ],
  globals: () => ({ Seil_Stoerung:false, Seil_Quittiert:false, Takt_1Hz:false, Lampe_Seil:false, Hupe:false }),
  must:['PARALLEL','NC'],
  visible: () => ({ tests:[[{ Seil_Stoerung:true, Takt_1Hz:true }, { Lampe_Seil:true, Hupe:true }], [{ Seil_Stoerung:true, Takt_1Hz:false }, { Lampe_Seil:false, Hupe:true }]] }),
  hidden: () => ({
    unit:[{ block:'FC_Meldung', steps: truth(['Stoerung','Quittiert','Takt'], e => ({ Lampe: e.Stoerung && (e.Quittiert || e.Takt), Hupe: e.Stoerung && !e.Quittiert })) }],
    tests:[[{ Seil_Stoerung:true, Seil_Quittiert:true, Takt_1Hz:false }, { Lampe_Seil:true, Hupe:false }], [{ Seil_Stoerung:false, Takt_1Hz:true }, { Lampe_Seil:false, Hupe:false }]]
  }),
  wrong:[
    () => ({ FC_Meldung: kFC('FC_Meldung', 'Void', LAMP_D, 'NETWORK Leuchte\n#Stoerung => #Lampe;\n\nNETWORK Hupe\n#Stoerung AND NOT #Quittiert => #Hupe;') }),
    () => ({ FC_Meldung: kFC('FC_Meldung', 'Void', LAMP_D, 'NETWORK Leuchte\n#Stoerung AND ((#Takt AND #Quittiert) OR NOT #Quittiert) => #Lampe;\n\nNETWORK Hupe\n#Stoerung AND NOT #Quittiert => #Hupe;') }),
    () => ({ FC_Meldung: kFC('FC_Meldung', 'Void', LAMP_D, 'NETWORK Leuchte\n#Stoerung AND ((#Takt AND NOT #Quittiert) OR #Quittiert) => #Lampe;\n\nNETWORK Hupe\n#Stoerung => #Hupe;') })
  ]
});

/* ---------- Kapitel 15: OB1/OB100, Programmierstandard ---------- */
const STUP = body => kOB('Startup', body);
const PAR_DB = kDB('DB_Param', 'Wind_Grenze:Int|km/h; Betriebsart:Int|1 Sommer, 2 Winter; Fahrten_heute:Int := 123|Stand vor dem Ausschalten');
const STUP_NW = (g, b) => 'NETWORK Windgrenze\n=> MOVE(' + g + ', "DB_Param".Wind_Grenze);\n\nNETWORK Betriebsart\n=> MOVE(' + b + ', "DB_Param".Betriebsart);\n\nNETWORK Fahrten\n=> MOVE(0, "DB_Param".Fahrten_heute);\n\nNETWORK Antrieb aus\n=> R "Antrieb";';
defExamTask({ id:'x_kop_p_anlauf', quest:'kop', level:'profi', ch:15, diff:1,
  params:{ G:[50, 60, 70], B:[1, 2] },
  title:'Grundstellung im Anlauf',
  brief: p => 'Programmiere den Anlauf-OB <code>Startup</code> [OB100], alle Netzwerke <b>ohne Bedingung</b>:<br><b>NW 1:</b> MOVE ' + p.G + ' nach <code>"DB_Param".Wind_Grenze</code><br><b>NW 2:</b> MOVE ' + p.B + ' nach <code>"DB_Param".Betriebsart</code><br><b>NW 3:</b> MOVE 0 nach <code>"DB_Param".Fahrten_heute</code><br><b>NW 4:</b> R <code>"Antrieb"</code><br><code>Main</code> (🔒) verwendet diese Werte in jedem Zyklus.',
  blocks: p => [
    { name:'DB_Param', kind:'DB', src: PAR_DB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: STUP(''), ref: STUP(STUP_NW(p.G, p.B)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Wind\n["Wind_kmh" > "DB_Param".Wind_Grenze] => "Wind_Stopp";\n\nNETWORK Start\n"S_Start" AND NOT "Wind_Stopp" => S "Antrieb";\n\nNETWORK Stopp\n"Wind_Stopp" => R "Antrieb";\n\nNETWORK Anzeige\n=> MOVE("DB_Param".Fahrten_heute, "Anzeige");') }
  ],
  globals: () => ({ Wind_kmh:0, S_Start:false, Wind_Stopp:false, Antrieb:true, Anzeige:0 }),
  must:['STARTUP','MOVE'],
  visible: p => ({ timed: seq([[0.1,{},{ Antrieb:false, 'DB_Param.Betriebsart':p.B }]]) }),
  hidden: p => ({ timed:[
    { steps:[[0.1,{ Wind_kmh:p.G },{ Antrieb:false, Wind_Stopp:false, Anzeige:0, 'DB_Param.Wind_Grenze':p.G, 'DB_Param.Betriebsart':p.B }],[0.1,{ S_Start:true },{ Antrieb:true }],[0.1,{ S_Start:false, Wind_kmh:p.G + 1 },{ Wind_Stopp:true, Antrieb:false }]] },
    { steps:[[0.1,{ Wind_kmh:p.G - 5 },{ Wind_Stopp:false, 'DB_Param.Fahrten_heute':0 }],[0.1,{ 'DB_Param.Wind_Grenze':p.G - 10 },{ Wind_Stopp:true }],[0.1,{ 'DB_Param.Fahrten_heute':7 },{ Anzeige:7 }]] },
    { steps:[[0.1,{},{ Antrieb:false }],[0.1,{ Antrieb:true },{ Antrieb:true }],[0.1,{},{ Antrieb:true, 'DB_Param.Betriebsart':p.B }]] }
  ] }),
  wrong:[
    p => ({ Startup: STUP(STUP_NW(p.G, p.B).replace('NETWORK Fahrten\n=> MOVE(0, "DB_Param".Fahrten_heute);\n\n', '')) }),
    p => ({ Startup: STUP(STUP_NW(p.G, p.B).replace('\n\nNETWORK Antrieb aus\n=> R "Antrieb";', '')) }),
    p => ({ Startup: STUP(STUP_NW(p.G + 10, p.B)) })
  ]
});

const OBW_FC = kFC('FC_Wind', 'Void', { in:'Wind:Int; Grenze:Int', out:'OK:Bool|Wind zulässig' }, 'NETWORK Wind\n[#Wind <= #Grenze] => #OK;');
const OBA_FB = kFB('FB_Antrieb', { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool' }, 'NETWORK Selbsthaltung\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe => #Laeuft;');
const OBL_FC = kFC('FC_Ampel', 'Void', { in:'Laeuft:Bool; Freigabe:Bool', out:'Gruen:Bool; Rot:Bool' }, 'NETWORK Gruen\n#Laeuft => #Gruen;\n\nNETWORK Rot\nNOT #Freigabe => #Rot;');
const OB_CALLS = g => ['NETWORK Wind\n=> "FC_Wind"(Wind := "Wind_kmh", Grenze := ' + g + ', OK => "Wind_OK");',
  'NETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Wind_OK", Laeuft => "Antrieb");',
  'NETWORK Ampel\n=> "FC_Ampel"(Laeuft := "Antrieb", Freigabe := "Wind_OK", Gruen => "Ampel_Gruen", Rot => "Ampel_Rot");'];
defExamTask({ id:'x_kop_p_ob1', quest:'kop', level:'profi', ch:15, diff:2,
  params:{ G:[50, 60, 70] },
  title:'Der OB1 der Talstation',
  brief: p => 'Die Bausteine <code>FC_Wind</code>, <code>FB_Antrieb</code> und <code>FC_Ampel</code> (alle 🔒) sind fertig. Baue <code>Main</code> [OB1] aus drei Aufrufen in der Reihenfolge des Signalflusses, damit jede Änderung <b>im selben Zyklus</b> wirkt:<br>' +
    '<b>NW 1:</b> <code>"FC_Wind"</code>: Wind := <code>"Wind_kmh"</code>, Grenze := ' + p.G + ', OK => <code>"Wind_OK"</code><br>' +
    '<b>NW 2:</b> <code>"FB_Antrieb_DB"</code>: Start := <code>"S_Start"</code>, Stopp := <code>"S_Stopp"</code>, Freigabe := <code>"Wind_OK"</code>, Laeuft => <code>"Antrieb"</code><br>' +
    '<b>NW 3:</b> <code>"FC_Ampel"</code>: Laeuft := <code>"Antrieb"</code>, Freigabe := <code>"Wind_OK"</code>, Gruen => <code>"Ampel_Gruen"</code>, Rot => <code>"Ampel_Rot"</code>',
  blocks: p => [
    { name:'FC_Wind', kind:'FC', src: OBW_FC }, { name:'FB_Antrieb', kind:'FB', src: OBA_FB }, { name:'FC_Ampel', kind:'FC', src: OBL_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(OB_CALLS(p.G).join('\n\n')) }
  ],
  globals: () => ({ Wind_kmh:0, S_Start:false, S_Stopp:false, Wind_OK:false, Antrieb:false, Ampel_Gruen:false, Ampel_Rot:false }),
  must:['CALL','SINGLE','FC_CALL'],
  visible: () => ({ timed: seq([[0,{ Wind_kmh:10, S_Start:true },{ Antrieb:true, Ampel_Gruen:true, Ampel_Rot:false }]]) }),
  hidden: p => ({ timed:[
    { steps:[[0,{ Wind_kmh:p.G },{ Wind_OK:true, Ampel_Rot:false, Antrieb:false }],[0.1,{ S_Start:true },{ Antrieb:true, Ampel_Gruen:true }],[0.1,{ S_Start:false },{ Antrieb:true, Ampel_Gruen:true }],[0.1,{ Wind_kmh:p.G + 1 },{ Wind_OK:false, Antrieb:false, Ampel_Gruen:false, Ampel_Rot:true }],[0.1,{ Wind_kmh:10 },{ Antrieb:false, Ampel_Rot:false }]] },
    { steps:[[0,{ Wind_kmh:p.G + 5, S_Start:true },{ Antrieb:false, Ampel_Rot:true }],[0.1,{ Wind_kmh:p.G - 5 },{ Antrieb:true, Ampel_Gruen:true, Ampel_Rot:false }],[0.1,{ S_Start:false, S_Stopp:true },{ Antrieb:false, Ampel_Gruen:false }]] },
    { steps:[[0,{ Wind_kmh:20 },{ Ampel_Rot:false, Ampel_Gruen:false }],[0.1,{ S_Start:true },{ Ampel_Gruen:true }],[0.1,{ S_Start:false, S_Stopp:true },{ Ampel_Gruen:false }]] }
  ] }),
  wrong:[
    p => { const c = OB_CALLS(p.G); return { Main: MAIN([c[2], c[0], c[1]].join('\n\n')) }; },
    p => { const c = OB_CALLS(p.G); return { Main: MAIN([c[0], c[2], c[1]].join('\n\n')) }; },
    p => ({ Main: MAIN(OB_CALLS(p.G + 10).join('\n\n')) })
  ]
});

/* =====================================================================
   FRAGEN — Grundstufe
   ===================================================================== */
const Q = (id, level, ch, q, options, answer) => defExamQuestion({ id, quest:'kop', level, ch, q, options, answer });

// Kapitel 1
Q('xq_kop_g_reihe', 'grund', 1, 'Drei Schliesser liegen in <b>Reihe</b> vor einer Spule. Wann ist die Spule 1?', ['Wenn alle drei Kontaktvariablen 1 sind', 'Wenn mindestens eine Kontaktvariable 1 ist', 'Wenn genau eine Kontaktvariable 1 ist', 'Wenn alle drei Kontaktvariablen 0 sind'], 0);
Q('xq_kop_g_schliesser_sym', 'grund', 1, 'Welche Aussage beschreibt den <b>Schliesser</b> (Kontakt <code>-| |-</code>) im KOP richtig?', ['Er leitet den Strom weiter, wenn seine Variable 1 ist', 'Er leitet den Strom weiter, wenn seine Variable 0 ist', 'Er schreibt den Wert 1 in seine Variable', 'Er leitet nur im ersten Zyklus'], 0);
Q('xq_kop_g_spule_zyklus', 'grund', 1, 'Eine normale Spule <code>-( )-</code> steht am Ende eines Strompfads. Was macht sie in jedem Zyklus?', ['Sie schreibt das Verknüpfungsergebnis (0 oder 1) in ihre Variable', 'Sie schreibt nur eine 1, eine 0 wird ignoriert', 'Sie speichert den Wert, bis ein Reset kommt', 'Sie invertiert ihre Variable'], 0);
Q('xq_kop_g_zwei_spulen', 'grund', 1, 'Dieselbe Ausgangsvariable wird mit einer normalen Spule in <b>zwei verschiedenen Netzwerken</b> beschrieben. Was gilt am Ende des Zyklus?', ['Es gilt der Wert aus dem später bearbeiteten Netzwerk', 'Es gilt der Wert aus dem ersten Netzwerk', 'Beide Werte werden ODER-verknüpft', 'Die CPU geht in STOP'], 0);

// Kapitel 2
defExamQuestion({ id:'xq_kop_g_oeffner', quest:'kop', level:'grund', ch:2, q:'Ein Not-Halt-Taster ist als Öffner verdrahtet. Welcher Kontakt steht im KOP, damit der Antrieb nur bei <b>nicht</b> gedrücktem Not-Halt läuft?', options:['Schliesser mit der Variable des Not-Halt-Eingangs', 'Öffner mit der Variable des Not-Halt-Eingangs', 'Eine negierte Spule', 'Eine P-Flanke'], answer:0 });
Q('xq_kop_g_parallel', 'grund', 2, 'Zwei Kontakte liegen in einem <b>Parallelzweig</b>. Welcher logischen Verknüpfung entspricht das?', ['ODER', 'UND', 'Exklusiv-ODER', 'NICHT'], 0);
Q('xq_kop_g_oeffner_sym', 'grund', 2, 'Die Variable <code>Tuer_Zu</code> ist 0. Wie verhält sich ein <b>Öffner</b> <code>-|/|-</code> mit dieser Variable?', ['Er leitet den Strom weiter', 'Er sperrt den Strom', 'Er setzt Tuer_Zu auf 1', 'Er leitet nur bei einer Flanke'], 0);
Q('xq_kop_g_drahtbruch', 'grund', 2, 'Warum werden Stopp- und Not-Halt-Taster in der Anlage meist als <b>Öffner</b> verdrahtet?', ['Ein Drahtbruch wirkt dann wie ein Stopp-Befehl (drahtbruchsicher)', 'Öffner sind billiger als Schliesser', 'Die CPU kann Schliesser nicht einlesen', 'Damit man im KOP keinen Öffner-Kontakt braucht'], 0);

// Kapitel 3
Q('xq_kop_g_selbsthaltung', 'grund', 3, 'Wie wird eine <b>Selbsthaltung</b> im KOP gezeichnet?', ['Ein Schliesser mit der Ausgangsvariable liegt parallel zum Starttaster', 'Ein Öffner mit der Ausgangsvariable liegt in Reihe zum Starttaster', 'Die Spule wird zweimal hintereinander gezeichnet', 'Der Starttaster bekommt eine N-Flanke'], 0);
Q('xq_kop_g_ausvorrang', 'grund', 3, 'Rung: <code>(S_Start OR Motor) AND NOT S_Stopp => Motor</code>. Was passiert, wenn Start und Stopp <b>gleichzeitig</b> gedrückt sind?', ['Der Motor ist aus (Aus-Vorrang)', 'Der Motor läuft an (Ein-Vorrang)', 'Der Motor behält seinen bisherigen Zustand', 'Das Netzwerk meldet einen Fehler'], 0);
Q('xq_kop_g_verriegelung', 'grund', 3, 'Zwei Fahrtrichtungen dürfen nie gleichzeitig eingeschaltet sein. Wie verriegelt man sie im KOP?', ['Im Strompfad jeder Richtung liegt ein Öffner der jeweils anderen Richtung', 'Beide Richtungen bekommen denselben Starttaster', 'Man setzt beide Spulen in dasselbe Netzwerk', 'Man verwendet für jede Richtung eine negierte Spule'], 0);
Q('xq_kop_g_selbsthaltung_spannung', 'grund', 3, 'Eine Selbsthaltung mit normaler Spule läuft. Die CPU geht in STOP und wieder in RUN. Was gilt danach (ohne remanente Merker)?', ['Der Ausgang ist aus und muss neu gestartet werden', 'Der Ausgang läuft automatisch weiter', 'Der Ausgang blinkt, bis quittiert wird', 'Der Ausgang ist dauerhaft gesperrt'], 0);

// Kapitel 4
Q('xq_kop_g_set_bleibt', 'grund', 4, 'Eine Variable wurde mit einer <b>S-Spule</b> gesetzt. Die Setzbedingung wird wieder 0. Welchen Wert hat die Variable?', ['Sie bleibt 1, bis eine R-Spule sie zurücksetzt', 'Sie wird sofort wieder 0', 'Sie wird im nächsten Zyklus 0', 'Sie wechselt in jedem Zyklus'], 0);
Q('xq_kop_g_vorrang_reihenfolge', 'grund', 4, 'Setz- und Rücksetzbedingung für dieselbe Variable sind im selben Zyklus erfüllt. Die R-Spule steht im Netzwerk <b>nach</b> der S-Spule. Welcher Wert steht am Zyklusende in der Variable?', ['0 — das zuletzt bearbeitete Netzwerk gewinnt (Rücksetzvorrang)', '1 — Setzen hat immer Vorrang', 'Der Wert vom letzten Zyklus', 'Das hängt von der Zykluszeit ab'], 0);
Q('xq_kop_g_ncoil', 'grund', 4, 'Was schreibt eine <b>negierte Spule</b> <code>-(/)-</code> in ihre Variable?', ['Das invertierte Verknüpfungsergebnis', 'Immer 0', 'Eine 1 nur bei einer fallenden Flanke', 'Das Verknüpfungsergebnis des letzten Zyklus'], 0);
Q('xq_kop_g_set_ohne_reset', 'grund', 4, 'Ein Programm setzt <code>Stoerung</code> mit einer S-Spule, enthält aber <b>keine</b> R-Spule dafür. Was ist die Folge?', ['Die Störung lässt sich im laufenden Betrieb nie mehr löschen', 'Die Störung wird automatisch nach einem Zyklus gelöscht', 'Der Compiler ersetzt die S-Spule durch eine normale Spule', 'Die Störung wird bei jeder fallenden Flanke gelöscht'], 0);

// Kapitel 5
Q('xq_kop_g_pflanke', 'grund', 5, 'Ein Taster wird 3 Sekunden gedrückt gehalten. Wie viele Zyklen lang liefert ein <b>P-Flankenkontakt</b> auf diesen Taster eine 1?', ['Genau einen Zyklus', 'Alle Zyklen während der 3 Sekunden', 'Keinen, erst beim Loslassen', 'Zwei Zyklen: beim Drücken und beim Loslassen'], 0);
Q('xq_kop_g_nflanke', 'grund', 5, 'Wann liefert ein <b>N-Flankenkontakt</b> eine 1?', ['Im Zyklus, in dem seine Variable von 1 auf 0 wechselt', 'Im Zyklus, in dem seine Variable von 0 auf 1 wechselt', 'Solange seine Variable 0 ist', 'Solange seine Variable 1 ist'], 0);
Q('xq_kop_g_inc_ohne_flanke', 'grund', 5, 'Rung: <code>Drehkreuz => INC(Gaeste)</code> ohne Flanke. Eine Person steht 0,5 s im Drehkreuz, die Zykluszeit beträgt 10 ms. Was passiert?', ['Gaeste wird etwa 50-mal erhöht', 'Gaeste wird genau einmal erhöht', 'Gaeste bleibt unverändert', 'Gaeste wird auf 0 gesetzt'], 0);
Q('xq_kop_g_stromstoss', 'grund', 5, 'Was versteht man unter einer <b>Stromstossschaltung</b>?', ['Jeder Tastendruck schaltet einen Ausgang um: ein – aus – ein …', 'Ein Ausgang ist nur so lange 1, wie der Taster gedrückt ist', 'Ein Ausgang bleibt nach dem Loslassen eine feste Zeit an', 'Ein Ausgang wird bei Überstrom abgeschaltet'], 0);

// Kapitel 6
defExamQuestion({ id:'xq_kop_g_tof', quest:'kop', level:'grund', ch:6, q:'Welche Zeit hält den Ausgang nach dem Abschalten des Eingangs noch eine Weile auf 1?', options:['TOF (Ausschaltverzögerung)', 'TON (Einschaltverzögerung)', 'TP (Impuls)', 'CTU (Vorwärtszähler)'], answer:0 });
Q('xq_kop_g_ton_unterbrochen', 'grund', 6, 'Ein TON mit PT = T#5S. Der Eingang ist 3 s lang 1, dann kurz 0, dann wieder 1. Wann wird Q frühestens 1?', ['5 s nach dem erneuten Einschalten', '2 s nach dem erneuten Einschalten', 'Sofort beim erneuten Einschalten', 'Nie, der TON muss erst zurückgesetzt werden'], 0);
Q('xq_kop_g_tp', 'grund', 6, 'Ein <b>TP</b> mit PT = T#2S. Der Eingang ist nur 0,3 s lang 1. Wie lange ist Q = 1?', ['2 s', '0,3 s', '2,3 s', '0 s'], 0);
Q('xq_kop_g_et', 'grund', 6, 'Was zeigt der Ausgang <b>ET</b> eines IEC-Timers an?', ['Die bereits abgelaufene Zeit', 'Die eingestellte Vorgabezeit', 'Die Restzeit bis zum Ablauf', 'Die Anzahl der Starts'], 0);

// Kapitel 7
Q('xq_kop_g_ueberwachung', 'grund', 7, 'Eine Tür soll 4 s nach dem Befehl «schliessen» die Rückmeldung «zu» liefern, sonst ist sie gestört. Welcher Strompfad setzt die Störung richtig?', ['<code>Befehl AND NOT Tuer_Zu AND TON(T, T#4S) => S Stoerung</code>', '<code>Befehl AND Tuer_Zu AND TON(T, T#4S) => S Stoerung</code>', '<code>Befehl AND NOT Tuer_Zu AND TOF(T, T#4S) => S Stoerung</code>', '<code>NOT Befehl AND TP(T, T#4S) => S Stoerung</code>'], 0);
Q('xq_kop_g_stoerung_speichern', 'grund', 7, 'Warum wird eine erkannte Störung meist mit einer <b>S-Spule gespeichert</b> statt mit einer normalen Spule angezeigt?', ['Damit die Meldung bleibt, auch wenn die Ursache kurz wieder verschwindet, bis jemand quittiert', 'Weil normale Spulen keine Lampen ansteuern dürfen', 'Damit der Timer schneller abläuft', 'Weil S-Spulen weniger Speicher brauchen'], 0);
Q('xq_kop_g_blink_selbst', 'grund', 7, 'Rung: <code>NOT Impuls AND TON(T1, T#500MS) => Impuls</code>. Was liefert <code>Impuls</code>?', ['Alle 500 ms für einen Zyklus eine 1', 'Dauernd 1 nach 500 ms', 'Einen 500-ms-Impuls nur beim Start', 'Nie eine 1, weil sich der Timer selbst sperrt'], 0);
Q('xq_kop_g_vorwarnung', 'grund', 7, 'Vor dem Anfahren soll 3 s lang gehupt werden, danach startet der Antrieb. Welche Zeitfunktion bestimmt, <b>wann</b> der Antrieb startet?', ['Ein TON, der mit der Vorwarnung gestartet wird', 'Ein TOF, der mit dem Antrieb gestartet wird', 'Ein CTU mit PV = 3', 'Eine N-Flanke auf die Hupe ohne Zeitglied'], 0);

// Kapitel 8
Q('xq_kop_g_ctu_q', 'grund', 8, 'Wann ist der Ausgang Q eines <b>CTU</b> 1?', ['Wenn der Zählwert CV grösser oder gleich PV ist', 'Wenn CV genau 0 ist', 'Bei jeder Zählflanke für einen Zyklus', 'Wenn der Reset-Eingang R 1 ist'], 0);
Q('xq_kop_g_ctd_ld', 'grund', 8, 'Was bewirkt der Eingang <b>LD</b> eines CTD?', ['Er lädt den Zählwert CV mit dem Vorgabewert PV', 'Er setzt CV auf 0', 'Er zählt um 1 abwärts', 'Er sperrt den Zähler dauerhaft'], 0);
Q('xq_kop_g_ctd_q', 'grund', 8, 'Wann ist der Ausgang Q eines <b>CTD</b> 1?', ['Wenn der Zählwert CV kleiner oder gleich 0 ist', 'Wenn CV grösser oder gleich PV ist', 'Wenn LD gerade 1 ist', 'Bei jeder Zählflanke'], 0);
Q('xq_kop_g_ctu_r', 'grund', 8, 'Ein CTU hat CV = 7. Der Eingang R wird 1 und bleibt 1, während weitere Zählimpulse kommen. Was gilt?', ['CV bleibt 0, solange R = 1 ist', 'CV zählt normal weiter', 'CV wird bei jeder Flanke um 1 kleiner', 'CV bleibt auf 7 stehen'], 0);

// Kapitel 9
Q('xq_kop_g_cmp_kontakt', 'grund', 9, 'Wie verhält sich ein <b>Vergleicher</b> wie <code>[Wind_kmh > 60]</code> im Strompfad?', ['Wie ein Kontakt, der bei erfüllter Bedingung leitet', 'Wie eine Spule, die das Ergebnis schreibt', 'Wie ein Timer mit 60 s', 'Wie ein Zähler bis 60'], 0);
Q('xq_kop_g_move_en', 'grund', 9, 'Eine MOVE-Box hängt an einem Strompfad, der gerade <b>0</b> ist. Was passiert mit dem Ziel?', ['Es behält seinen bisherigen Wert', 'Es wird auf 0 gesetzt', 'Es bekommt den Quellwert trotzdem', 'Es wird ungültig'], 0);
Q('xq_kop_g_div_int', 'grund', 9, 'DIV mit IN1 = 7 und IN2 = 2, alle Operanden vom Typ <b>Int</b>. Welcher Wert steht im Ergebnis?', ['3', '3,5', '4', '1'], 0);
Q('xq_kop_g_add_flanke', 'grund', 9, 'Bei jeder Abfahrt sollen die Gäste der Kabine <b>einmal</b> zur Tagessumme addiert werden. Was gehört vor die ADD-Box?', ['Eine P-Flanke auf das Abfahrsignal', 'Ein Öffner auf das Abfahrsignal', 'Ein TOF mit 1 s', 'Nichts, ADD addiert nur einmal pro Signal'], 0);

// Kapitel 10
Q('xq_kop_g_kette_reihe', 'grund', 10, 'Wie werden die Glieder einer <b>Sicherheitskette</b> (Tür zu, Not-Halt OK, Seil OK …) im KOP verknüpft?', ['Alle in Reihe — jedes offene Glied unterbricht die Kette', 'Alle parallel — ein geschlossenes Glied genügt', 'Jedes Glied mit einer S-Spule', 'Mit einem Zähler, der die Glieder zählt'], 0);
Q('xq_kop_g_schritt_eins', 'grund', 10, 'In einer einfachen Schrittkette mit Schrittmerkern: Wie viele Schritte sind gleichzeitig aktiv?', ['Genau einer', 'Alle bis zum aktuellen Schritt', 'Immer zwei: der alte und der neue', 'Beliebig viele'], 0);
Q('xq_kop_g_schritt_weiter', 'grund', 10, 'Welche Bedingung braucht die <b>Weiterschaltung</b> von Schritt 1 nach Schritt 2?', ['Schritt 1 ist aktiv <b>und</b> die Übergangsbedingung ist erfüllt', 'Nur die Übergangsbedingung', 'Schritt 2 ist aktiv', 'Die Grundstellung ist aktiv'], 0);
Q('xq_kop_g_kette_quit', 'grund', 10, 'Nach einer Unterbrechung ist die Sicherheitskette wieder geschlossen. Warum darf die Anlage trotzdem nicht selbständig wieder anfahren?', ['Ein Wiederanlauf erfordert eine bewusste Quittierung bzw. einen neuen Startbefehl', 'Weil die Kette immer 10 s zum Schliessen braucht', 'Weil die CPU sonst in STOP geht', 'Weil der Antrieb sonst rückwärts läuft'], 0);

/* =====================================================================
   FRAGEN — Profi-Stufe
   ===================================================================== */
// Kapitel 11
Q('xq_kop_p_fc_gedaechtnis', 'profi', 11, 'Warum kann eine <b>FC</b> keine Selbsthaltung über einen eigenen Ausgang speichern?', ['Eine FC hat keinen Instanzspeicher; ihre Ausgänge gelten nur für den aktuellen Aufruf', 'Weil FCs keine Spulen enthalten dürfen', 'Weil FCs nur im OB100 aufgerufen werden', 'Weil FCs keine Bool-Ausgänge haben'], 0);
Q('xq_kop_p_fc_alle_param', 'profi', 11, 'Was gilt beim Aufruf einer FC in der Aufruf-Box für ihre Formalparameter?', ['Alle Parameter müssen beschaltet werden', 'Nur die Eingänge müssen beschaltet werden', 'Kein Parameter muss beschaltet werden', 'Nur der Rückgabewert muss beschaltet werden'], 0);
Q('xq_kop_p_retval', 'profi', 11, 'Wie heisst der Rückgabewert einer FC in der Schnittstelle von TIA Portal?', ['<code>Ret_Val</code>', '<code>ENO</code>', '<code>Return</code>', '<code>OUT0</code>'], 0);
Q('xq_kop_p_hash', 'profi', 11, 'Was bedeutet das Zeichen <b>#</b> vor einem Operanden, z.&nbsp;B. <code>#Wind</code>?', ['Es ist eine lokale Variable aus der Schnittstelle des Bausteins', 'Es ist eine globale PLC-Variable', 'Es ist eine Konstante', 'Es ist ein Zeiger auf einen Datenbaustein'], 0);
Q('xq_kop_p_temp', 'profi', 11, 'Was gilt für eine <b>Temp</b>-Variable in einer FC?', ['Ihr Wert gilt nur während des aktuellen Aufrufs; sie wird zuerst geschrieben und danach gelesen', 'Sie behält ihren Wert bis zum nächsten Aufruf', 'Sie ist für alle Bausteine sichtbar', 'Sie wird im OB100 automatisch auf 0 gesetzt und bleibt dann erhalten'], 0);
Q('xq_kop_p_inout', 'profi', 11, 'Wofür eignet sich ein <b>InOut</b>-Parameter?', ['Für einen Wert, den der Baustein lesen und verändert zurückschreiben soll', 'Für eine Konstante, die nie geändert wird', 'Für eine temporäre Zwischenvariable', 'Für den Aufruf eines Timers'], 0);

// Kapitel 12
defExamQuestion({ id:'xq_kop_p_fb', quest:'kop', level:'profi', ch:12, q:'Warum braucht ein Baustein mit Flanken- oder Zeitauswertung eine Instanz?', options:['Er muss Werte vom letzten Zyklus speichern – das geht nur mit Instanzdaten', 'Weil FCs keine Kontakte enthalten dürfen', 'Damit er schneller läuft', 'Weil der OB1 sonst nicht aufgerufen wird'], answer:0 });
Q('xq_kop_p_zwei_instanzen', 'profi', 12, 'Ein FB soll zwei gleiche Förderbänder steuern. Wie wird er richtig aufgerufen?', ['Zweimal, mit je einem eigenen Instanz-DB', 'Zweimal mit demselben Instanz-DB', 'Einmal, mit beiden Bändern parallel an den Eingängen', 'Einmal im OB1 und einmal im OB100'], 0);
Q('xq_kop_p_multi', 'profi', 12, 'Wo liegen die Daten einer <b>Multiinstanz</b> (z.&nbsp;B. ein TON als Static-Variable in einem FB)?', ['Im Instanz-DB des aufrufenden FB', 'In einem eigenen globalen DB', 'In den Temp-Daten des OB1', 'Im Merkerbereich'], 0);
Q('xq_kop_p_fb_eingang', 'profi', 12, 'Ein Eingang eines FB wird in einem Aufruf <b>nicht</b> beschaltet. Welchen Wert hat er im Baustein?', ['Den zuletzt in der Instanz gespeicherten Wert', 'Immer 0', 'Einen zufälligen Wert', 'Der Compiler verlangt zwingend eine Beschaltung'], 0);
Q('xq_kop_p_static', 'profi', 12, 'Welche Variable eines FB behält ihren Wert von einem Zyklus zum nächsten, ist aber <b>kein</b> Parameter der Aufruf-Box?', ['Eine Static-Variable', 'Eine Temp-Variable', 'Ein Input', 'Ein Output'], 0);
Q('xq_kop_p_instanz_twice', 'profi', 12, 'Dieselbe Instanz eines FB mit Timer wird in einem Zyklus <b>zweimal</b> mit unterschiedlichen Eingängen aufgerufen. Was ist die typische Folge?', ['Der zweite Aufruf überschreibt den Zustand des ersten, Timer und Flanken arbeiten falsch', 'Beide Aufrufe arbeiten unabhängig voneinander', 'Die CPU legt automatisch eine zweite Instanz an', 'Der zweite Aufruf wird ignoriert'], 0);

// Kapitel 13
Q('xq_kop_p_db_global', 'profi', 13, 'Wie spricht man die Variable <code>Wind_Max</code> im globalen Datenbaustein <code>DB_Station</code> im KOP an?', ['<code>"DB_Station".Wind_Max</code>', '<code>#DB_Station.Wind_Max</code>', '<code>DB_Station:Wind_Max</code>', '<code>"Wind_Max".DB_Station</code>'], 0);
Q('xq_kop_p_udt', 'profi', 13, 'Was ist ein <b>PLC-Datentyp</b> (UDT)?', ['Eine Vorlage für eine Struktur, die man mehrfach als Datentyp verwenden kann', 'Ein Baustein mit eigenem Programmcode', 'Ein Zeitglied für die Ablaufsteuerung', 'Ein spezieller Organisationsbaustein'], 0);
Q('xq_kop_p_udt_aendern', 'profi', 13, 'Im UDT <code>UDT_Kabine</code> wird ein neues Element ergänzt. Was passiert mit allen Variablen dieses Typs?', ['Sie erhalten das neue Element ebenfalls, nach dem Aktualisieren bzw. Übersetzen', 'Sie bleiben unverändert, nur neue Variablen bekommen es', 'Sie werden gelöscht', 'Sie müssen alle von Hand neu angelegt werden'], 0);
Q('xq_kop_p_array', 'profi', 13, 'Eine Variable ist als <code>Array[1..4] of Bool</code> deklariert. Welcher Zugriff ist <b>unzulässig</b>?', ['<code>Platz[0]</code>', '<code>Platz[1]</code>', '<code>Platz[3]</code>', '<code>Platz[4]</code>'], 0);
Q('xq_kop_p_db_vs_temp', 'profi', 13, 'Ein Zählwert soll über viele Zyklen erhalten bleiben und von mehreren Bausteinen gelesen werden. Wo wird er abgelegt?', ['In einem globalen Datenbaustein', 'In einer Temp-Variable einer FC', 'Als Konstante in der Schnittstelle', 'Im Rückgabewert einer FC'], 0);
Q('xq_kop_p_struct_param', 'profi', 13, 'Welcher Vorteil ergibt sich, wenn man einem Baustein einen Parameter vom Typ <code>"UDT_Kabine"</code> übergibt statt vieler Einzelparameter?', ['Die Schnittstelle bleibt klein und alle Kabinendaten kommen zusammen an', 'Der Baustein braucht dann keine Instanz mehr', 'Die Werte werden automatisch remanent', 'Man kann dann auf Vergleicher verzichten'], 0);

// Kapitel 14
Q('xq_kop_p_standard', 'profi', 14, 'Was zeichnet einen guten <b>Standardbaustein</b> (z.&nbsp;B. für eine Tür) aus?', ['Er arbeitet nur über seine Schnittstelle und greift nicht direkt auf globale Variablen zu', 'Er liest alle Signale direkt aus globalen Variablen', 'Er enthält die Logik für alle Türen der Anlage fest verdrahtet', 'Er wird nur einmal im ganzen Projekt aufgerufen'], 0);
Q('xq_kop_p_rueckmeldung', 'profi', 14, 'Wozu dient die <b>Rückmeldung</b> (z.&nbsp;B. Drehwächter, Endlage) in einem Antriebsbaustein?', ['Um zu prüfen, ob der Befehl tatsächlich ausgeführt wurde, und sonst eine Störung zu melden', 'Um den Befehl schneller auszugeben', 'Um den Instanz-DB zu sparen', 'Um den Baustein im OB100 zu starten'], 0);
Q('xq_kop_p_quit', 'profi', 14, 'Eine Störung ist gespeichert, ihre Ursache steht aber <b>noch an</b>. Wie sollte ein Standardbaustein auf «Quittieren» reagieren?', ['Die Störung bleibt bestehen bzw. wird sofort wieder gesetzt', 'Die Störung wird gelöscht und der Antrieb startet sofort', 'Der Baustein geht in STOP', 'Die Störung wird in eine Warnung umgewandelt'], 0);
Q('xq_kop_p_blink_meldung', 'profi', 14, 'Nach gängigem Meldekonzept: Was zeigt eine <b>blinkende</b> Störlampe an?', ['Eine neue, noch nicht quittierte Störung', 'Eine quittierte, noch anstehende Störung', 'Die Anlage läuft normal', 'Eine Störung, die bereits verschwunden ist'], 0);
Q('xq_kop_p_global_access', 'profi', 14, 'Ein FB liest intern direkt die globale Variable <code>"Tuer_Zu"</code>. Welches Problem entsteht?', ['Er ist nicht mehr für andere Türen wiederverwendbar', 'Er läuft langsamer', 'Er braucht dann zwei Instanz-DBs', 'Er darf dann keine Timer enthalten'], 0);
Q('xq_kop_p_freigabe', 'profi', 14, 'Wie gelangt die Freigabe der Sicherheitskette sinnvoll in einen Standard-Antriebsbaustein?', ['Über einen Eingang wie <code>Freigabe</code>, der beim Aufruf beschaltet wird', 'Der Antriebsbaustein liest alle Kettenglieder selbst global ein', 'Über eine Temp-Variable im OB1', 'Gar nicht, die Kette schaltet den Ausgang direkt'], 0);

// Kapitel 15
Q('xq_kop_p_ob100', 'profi', 15, 'Wann wird der <b>OB100</b> (Startup) bearbeitet?', ['Einmal beim Übergang von STOP nach RUN, vor dem ersten OB1-Zyklus', 'In jedem Zyklus vor dem OB1', 'Nur bei einem Fehler', 'Alle 100 ms'], 0);
Q('xq_kop_p_ob1', 'profi', 15, 'Was ist der <b>OB1</b> (Main)?', ['Der Organisationsbaustein, der zyklisch immer wieder bearbeitet wird', 'Der Baustein, der nur beim Anlauf läuft', 'Ein Datenbaustein für globale Variablen', 'Ein Weckalarm-OB mit fester Zeit'], 0);
Q('xq_kop_p_reihenfolge', 'profi', 15, 'Der OB1 ruft die Anzeige <b>vor</b> dem Antriebsbaustein auf, der den Wert «Antrieb» berechnet. Was sieht die Anzeige?', ['Den Wert aus dem vorherigen Zyklus – sie ist einen Zyklus zu spät', 'Immer den aktuellen Wert', 'Immer 0', 'Einen Übersetzungsfehler'], 0);
Q('xq_kop_p_unused', 'profi', 15, 'Was bedeutet eine Warnung wie «Variable deklariert, aber nicht verwendet»?', ['Eine Variable in der Schnittstelle wird nirgends benutzt und kann entfernt oder muss angeschlossen werden', 'Die CPU hat zu wenig Speicher', 'Die Variable ist remanent', 'Die Variable wird doppelt geschrieben'], 0);
Q('xq_kop_p_kommentar', 'profi', 15, 'Was verlangt ein typischer <b>Programmierstandard</b> für Netzwerke im KOP?', ['Einen aussagekräftigen Netzwerktitel bzw. Kommentar für jedes Netzwerk', 'Möglichst alle Logik in einem einzigen Netzwerk', 'Keine Kommentare, damit der Code kürzer ist', 'Nur Variablennamen mit einem Buchstaben'], 0);
Q('xq_kop_p_erster_zyklus', 'profi', 15, 'Wo stellt man nach Programmierstandard die <b>Grundstellung</b> nach dem Einschalten her?', ['Im Anlauf-OB (OB100)', 'Mit einem Merker «erster Zyklus» in jedem FB', 'In einer Temp-Variable des OB1', 'Im letzten Netzwerk des OB1'], 0);
})();
