/* ===== KOP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Seilbahn), nicht aus dem Spiel. Parameter pro Prüfung (exam_core.js). */
(function(){
const seq = steps => [{ steps }];

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_kop_g_foerderband', quest:'kop', level:'grund', ch:3, diff:1, timed:true,
  title:'Gepäckband mit Selbsthaltung',
  brief: () => 'Das Gepäckband <code>Band</code> startet mit dem Taster <code>S_Start</code> und läuft danach weiter (Selbsthaltung).<br>Es stoppt mit <code>S_Stopp</code> (Aus-Vorrang) oder sobald <code>Not_Halt_OK</code> 0 ist.',
  vars: () => ({ S_Start:false, S_Stopp:false, Not_Halt_OK:true, Band:false }),
  start: () => 'NETWORK Gepaeckband\n? => ?;\n',
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

defExamTask({ id:'x_kop_g_tuerzeit', quest:'kop', level:'grund', ch:6, diff:2, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Tür verzögert öffnen',
  brief: p => '<code>Tuer_Auf</code> wird 1, wenn <code>Kabine_da</code> <b>' + p.T + ' Sekunden</b> ununterbrochen 1 ist und <code>Sperre</code> 0 ist. Verwende einen TON mit der Instanz <code>T_Tuer</code>.',
  vars: () => ({ Kabine_da:false, Sperre:false, Tuer_Auf:false }),
  start: () => 'NETWORK Tuer\n? => ?;\n',
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

/* ---------- Profi-Stufe ---------- */
const WIND_D = { in:'Wind:Int|Windgeschwindigkeit km/h; Grenze:Int|Abschaltgrenze; Sturm_Hand:Bool|Sturmwarnung von Hand', out:'Abschalten:Bool|Fahrt verboten' };
defExamTask({ id:'x_kop_p_wind', quest:'kop', level:'profi', ch:11, diff:1,
  params:{ G:[50, 60, 70] },
  title:'Windabschaltung als FC',
  brief: p => 'Programmiere die Funktion <code>FC_Wind</code>: <code>#Abschalten</code> ist 1, wenn <code>#Wind</code> <b>grösser als</b> <code>#Grenze</code> ist <b>oder</b> <code>#Sturm_Hand</code> 1 ist. Der OB <code>Main</code> (🔒) ruft die FC mit der Grenze ' + p.G + ' km/h auf.',
  blocks: p => [
    { name:'FC_Wind', kind:'FC', edit:true, start: kFC('FC_Wind', 'Void', WIND_D, ''), ref: kFC('FC_Wind', 'Void', WIND_D, 'NETWORK Wind\n[#Wind > #Grenze] OR #Sturm_Hand => #Abschalten;') },
    { name:'Main', kind:'OB', src: kOB('Main', 'NETWORK Windwaechter\n=> "FC_Wind"(Wind := "Wind_kmh", Grenze := ' + p.G + ', Sturm_Hand := "S_Sturm", Abschalten => "Wind_Stopp");') }
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

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_kop_g_oeffner', quest:'kop', level:'grund', ch:2, q:'Ein Not-Halt-Taster ist als Öffner verdrahtet. Welcher Kontakt steht im KOP, damit der Antrieb nur bei <b>nicht</b> gedrücktem Not-Halt läuft?', options:['Schliesser mit der Variable des Not-Halt-Eingangs', 'Öffner mit der Variable des Not-Halt-Eingangs', 'Eine negierte Spule', 'Eine P-Flanke'], answer:0 });
defExamQuestion({ id:'xq_kop_g_tof', quest:'kop', level:'grund', ch:6, q:'Welche Zeit hält den Ausgang nach dem Abschalten des Eingangs noch eine Weile auf 1?', options:['TOF (Ausschaltverzögerung)', 'TON (Einschaltverzögerung)', 'TP (Impuls)', 'CTU (Vorwärtszähler)'], answer:0 });
defExamQuestion({ id:'xq_kop_p_fb', quest:'kop', level:'profi', ch:12, q:'Warum braucht ein Baustein mit Flanken- oder Zeitauswertung eine Instanz?', options:['Er muss Werte vom letzten Zyklus speichern – das geht nur mit Instanzdaten', 'Weil FCs keine Kontakte enthalten dürfen', 'Damit er schneller läuft', 'Weil der OB1 sonst nicht aufgerufen wird'], answer:0 });
})();
