/* ===== AWL QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Walzwerk), nicht aus dem Spiel. AWL wird zeilentreu nach SCL übersetzt (awl.js). */
(function(){
const seq = steps => [{ steps }];
// alle Kombinationen boolescher Eingänge → [[setup, expect], …]
const combos = (names, fn, fixed) => {
  const out = [];
  for(let m = 0; m < (1 << names.length); m++){
    const e = Object.assign({}, fixed || {});
    names.forEach((n, i) => { e[n] = !!(m & (1 << (names.length - 1 - i))); });
    out.push([e, fn(e)]);
  }
  return out;
};
// Flankenfolge simulieren: Eingangswerte → Schritte [dt, inputs, expect]
const edgeSteps = (inp, out, vals, rising) => { let prev = false; return vals.map(v => { const q = rising ? (v && !prev) : (!v && prev); prev = v; return [0.1, { [inp]: v }, { [out]: q }]; }); };

/* =====================================================================
   Grundstufe (Kapitel 1–10)
   ===================================================================== */

// ---- Kapitel 1 ----
defExamTask({ id:'x_awl_g_hydraulik', quest:'awl', level:'grund', ch:1, diff:1,
  params:{ N:[1, 2, 3] },
  title:'Hydraulikaggregat bereit',
  brief: p => 'Das Hydraulikaggregat ' + p.N + ' ist <b>bereit</b>, wenn <code>Pumpe_' + p.N + '</code> UND <code>Oel_OK_' + p.N + '</code> UND <code>Filter_OK_' + p.N + '</code> 1 sind. Weise das Ergebnis <code>Bereit_' + p.N + '</code> zu und zeige es zusätzlich an der Lampe <code>Lampe_' + p.N + '</code> an.',
  vars: p => ({ ['Pumpe_' + p.N]:false, ['Oel_OK_' + p.N]:false, ['Filter_OK_' + p.N]:false, ['Bereit_' + p.N]:false, ['Lampe_' + p.N]:false }),
  start: () => '// Hydraulik bereit\n',
  ref: p => 'U  Pumpe_' + p.N + '\nU  Oel_OK_' + p.N + '\nU  Filter_OK_' + p.N + '\n=  Bereit_' + p.N + '\n=  Lampe_' + p.N,
  must:['U', 'ASSIGN'],
  visible: p => [[{ ['Pumpe_' + p.N]:true, ['Oel_OK_' + p.N]:true, ['Filter_OK_' + p.N]:true }, { ['Bereit_' + p.N]:true, ['Lampe_' + p.N]:true }], [{ ['Pumpe_' + p.N]:true }, { ['Bereit_' + p.N]:false }]],
  hidden: p => combos(['Pumpe_' + p.N, 'Oel_OK_' + p.N, 'Filter_OK_' + p.N], e => { const q = e['Pumpe_' + p.N] && e['Oel_OK_' + p.N] && e['Filter_OK_' + p.N]; return { ['Bereit_' + p.N]:q, ['Lampe_' + p.N]:q }; }, { ['Bereit_' + p.N]:true, ['Lampe_' + p.N]:true }),
  wrong:[
    p => 'U  Pumpe_' + p.N + '\nU  Oel_OK_' + p.N + '\nO  Filter_OK_' + p.N + '\n=  Bereit_' + p.N + '\n=  Lampe_' + p.N,
    p => 'U  Pumpe_' + p.N + '\nU  Filter_OK_' + p.N + '\n=  Bereit_' + p.N + '\n=  Lampe_' + p.N,
    p => 'U  Pumpe_' + p.N + '\nU  Oel_OK_' + p.N + '\nU  Filter_OK_' + p.N + '\n=  Bereit_' + p.N
  ]
});

// ---- Kapitel 2 ----
defExamTask({ id:'x_awl_g_hand_auto', quest:'awl', level:'grund', ch:2, diff:2,
  params:{ N:[1, 2] },
  title:'Rollgang: Hand oder Automatik',
  brief: p => '<code>Rollgang_' + p.N + '</code> läuft, wenn<br>• im <b>Handbetrieb</b> (<code>Automatik</code> = 0) der Taster <code>S_Hand</code> gedrückt ist, <b>oder</b><br>• im <b>Automatikbetrieb</b> (<code>Automatik</code> = 1) der Befehl <code>Auto_Befehl</code> ansteht.<br>Verknüpfe die beiden UND-Gruppen mit <code>O</code> (ohne Operand) oder mit Klammern.',
  vars: p => ({ S_Hand:false, Auto_Befehl:false, Automatik:false, ['Rollgang_' + p.N]:false }),
  start: () => '// Hand oder Automatik\n',
  ref: p => 'U  S_Hand\nUN Automatik\nO\nU  Auto_Befehl\nU  Automatik\n=  Rollgang_' + p.N,
  visible: p => [[{ S_Hand:true }, { ['Rollgang_' + p.N]:true }], [{ Automatik:true, Auto_Befehl:true }, { ['Rollgang_' + p.N]:true }]],
  hidden: p => combos(['S_Hand', 'Auto_Befehl', 'Automatik'], e => ({ ['Rollgang_' + p.N]: (e.S_Hand && !e.Automatik) || (e.Auto_Befehl && e.Automatik) })),
  wrong:[
    p => 'U  S_Hand\nUN Automatik\nU  Auto_Befehl\nU  Automatik\n=  Rollgang_' + p.N,
    p => 'U  S_Hand\nU  Automatik\nO\nU  Auto_Befehl\nUN Automatik\n=  Rollgang_' + p.N,
    p => 'O  S_Hand\nO  Auto_Befehl\n=  Rollgang_' + p.N
  ]
});

// ---- Kapitel 3 ----
defExamTask({ id:'x_awl_g_pumpe', quest:'awl', level:'grund', ch:3, diff:1, timed:true,
  title:'Kühlwasserpumpe speichern',
  brief: () => '<code>S_Ein</code> <b>setzt</b> die <code>Pumpe</code>, <code>S_Aus</code> oder ein fehlender Wasserdruck (<code>Druck_OK</code> = 0) <b>setzen sie zurück</b>. Rücksetzen hat Vorrang (steht zuletzt).',
  vars: () => ({ S_Ein:false, S_Aus:false, Druck_OK:true, Pumpe:false }),
  start: () => '// Kühlwasserpumpe\n',
  ref: () => 'U  S_Ein\nS  Pumpe\nO  S_Aus\nON Druck_OK\nR  Pumpe',
  must:['S', 'R'],
  visible: () => seq([[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false},{Pumpe:true}],[0.1,{S_Aus:true},{Pumpe:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Pumpe:false}],[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false},{Pumpe:true}],[0.1,{S_Aus:true},{Pumpe:false}],[0.1,{S_Aus:false},{Pumpe:false}]] },
    { steps:[[0.1,{S_Ein:true, S_Aus:true},{Pumpe:false}],[0.1,{S_Aus:false},{Pumpe:true}]] },
    { steps:[[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false, Druck_OK:false},{Pumpe:false}],[0.1,{Druck_OK:true},{Pumpe:false}]] },
    { steps:[[0.1,{S_Ein:true, Druck_OK:false},{Pumpe:false}],[0.1,{Druck_OK:true},{Pumpe:true}]] }
  ],
  wrong:[
    () => 'U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe',
    () => 'O  S_Aus\nON Druck_OK\nR  Pumpe\nU  S_Ein\nS  Pumpe',
    () => 'U  S_Ein\n=  Pumpe'
  ]
});

defExamTask({ id:'x_awl_g_luefter', quest:'awl', level:'grund', ch:3, diff:2, timed:true,
  title:'Motorlüfter mit Selbsthaltung',
  brief: () => 'Der <code>Luefter</code> des Walzmotors startet mit <code>S_Ein</code> und hält sich selbst. Er geht aus, wenn <code>S_Aus</code> gedrückt ist oder der Motorschutz auslöst (<code>Motorschutz_OK</code> = 0). <b>Aus hat Vorrang.</b><br>Die Lampe <code>Luefter_steht</code> zeigt das Gegenteil von <code>Luefter</code> an (verwende <code>NOT</code>).',
  vars: () => ({ S_Ein:false, S_Aus:false, Motorschutz_OK:true, Luefter:false, Luefter_steht:false }),
  start: () => '// Motorlüfter\n',
  ref: () => 'U(\nO  S_Ein\nO  Luefter\n)\nUN S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\nNOT\n=  Luefter_steht',
  must:['KLAMMER', 'NOT'],
  visible: () => seq([[0.1,{S_Ein:true},{Luefter:true, Luefter_steht:false}],[0.1,{S_Ein:false},{Luefter:true}],[0.1,{S_Aus:true},{Luefter:false, Luefter_steht:true}]]),
  hidden: () => [
    { steps:[[0.1,{},{Luefter:false, Luefter_steht:true}],[0.1,{S_Ein:true},{Luefter:true, Luefter_steht:false}],[0.1,{S_Ein:false},{Luefter:true}],[0.1,{S_Aus:true},{Luefter:false, Luefter_steht:true}],[0.1,{S_Aus:false},{Luefter:false}]] },
    { steps:[[0.1,{S_Ein:true, S_Aus:true},{Luefter:false, Luefter_steht:true}],[0.1,{S_Aus:false},{Luefter:true}],[0.1,{S_Ein:false},{Luefter:true, Luefter_steht:false}]] },
    { steps:[[0.1,{S_Ein:true},{Luefter:true}],[0.1,{S_Ein:false, Motorschutz_OK:false},{Luefter:false, Luefter_steht:true}],[0.1,{Motorschutz_OK:true},{Luefter:false}]] }
  ],
  wrong:[
    () => 'O  S_Ein\nO  Luefter\nUN S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\nNOT\n=  Luefter_steht',
    () => 'U(\nO  S_Ein\nO  Luefter\n)\nU  S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\nNOT\n=  Luefter_steht',
    () => 'U(\nO  S_Ein\nO  Luefter\n)\nUN S_Aus\nU  Motorschutz_OK\n=  Luefter\nU  Luefter\n=  Luefter_steht'
  ]
});

// ---- Kapitel 4 ----
defExamTask({ id:'x_awl_g_schnittimpuls', quest:'awl', level:'grund', ch:4, diff:1, timed:true,
  params:{ EDGE:['steigende', 'fallende'] },
  title:'Schnittimpuls an der Schere',
  brief: p => 'Die Lichtschranke <code>Block_an_Schere</code> meldet einen Block. <code>Schnitt_Impuls</code> soll bei der <b>' + p.EDGE + 'n Flanke</b> dieses Signals für genau einen Zyklus 1 sein. Flankenmerker: <code>M_Schere</code>.',
  vars: () => ({ Block_an_Schere:false, M_Schere:false, Schnitt_Impuls:false }),
  start: () => '// Schnittimpuls\n',
  ref: p => 'U  Block_an_Schere\n' + (p.EDGE === 'steigende' ? 'FP' : 'FN') + ' M_Schere\n=  Schnitt_Impuls',
  must: [],
  visible: p => seq(edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [true, true, false], p.EDGE === 'steigende')),
  hidden: p => [
    { steps: edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [true, true, false, false, true, false], p.EDGE === 'steigende') },
    { steps: edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [false, true, false, true, true], p.EDGE === 'steigende') },
    { steps: edgeSteps('Block_an_Schere', 'Schnitt_Impuls', [true, false, true, false], p.EDGE === 'steigende') }
  ],
  wrong:[
    () => 'U  Block_an_Schere\n=  Schnitt_Impuls',
    p => 'U  Block_an_Schere\n' + (p.EDGE === 'steigende' ? 'FN' : 'FP') + ' M_Schere\n=  Schnitt_Impuls'
  ]
});

defExamTask({ id:'x_awl_g_wasseralarm', quest:'awl', level:'grund', ch:4, diff:2, timed:true,
  title:'Alarm bei Wasserverlust',
  brief: () => 'Fällt das Signal <code>Wasser_OK</code> von 1 auf 0, wird die <code>Hupe</code> <b>gesetzt</b> (Flanke, Merker <code>M_Wasser</code>). <code>Quittieren</code> setzt die Hupe zurück (Rücksetzen zuletzt). Die Hupe darf erst beim <b>nächsten</b> Wasserverlust wieder angehen.<br><code>Lampe_Rot</code> leuchtet, solange <code>Wasser_OK</code> = 0 ist.',
  vars: () => ({ Wasser_OK:true, Quittieren:false, M_Wasser:false, Hupe:false, Lampe_Rot:false }),
  start: () => '// Wasseralarm\n',
  ref: () => 'U  Wasser_OK\nFN M_Wasser\nS  Hupe\nU  Quittieren\nR  Hupe\nUN Wasser_OK\n=  Lampe_Rot',
  must:['FN', 'S', 'R'],
  visible: () => seq([[0.1,{Wasser_OK:true},{Hupe:false}],[0.1,{Wasser_OK:false},{Hupe:true, Lampe_Rot:true}],[0.1,{Quittieren:true},{Hupe:false}]]),
  hidden: () => [
    { steps:[[0.1,{Wasser_OK:true},{Hupe:false, Lampe_Rot:false}],[0.1,{Wasser_OK:false},{Hupe:true, Lampe_Rot:true}],[0.1,{},{Hupe:true}],[0.1,{Quittieren:true},{Hupe:false, Lampe_Rot:true}],[0.1,{Quittieren:false},{Hupe:false, Lampe_Rot:true}],[0.1,{Wasser_OK:true},{Hupe:false, Lampe_Rot:false}],[0.1,{Wasser_OK:false},{Hupe:true}]] },
    { steps:[[0.1,{Wasser_OK:true, Quittieren:true},{Hupe:false}],[0.1,{Wasser_OK:false},{Hupe:false, Lampe_Rot:true}],[0.1,{Quittieren:false},{Hupe:false}]] },
    { steps:[[0.1,{Wasser_OK:true},{}],[0.1,{Wasser_OK:false},{Hupe:true}],[0.1,{Wasser_OK:true},{Hupe:true, Lampe_Rot:false}],[0.1,{Quittieren:true},{Hupe:false}]] }
  ],
  wrong:[
    () => 'UN Wasser_OK\nS  Hupe\nU  Quittieren\nR  Hupe\nUN Wasser_OK\n=  Lampe_Rot',
    () => 'U  Wasser_OK\nFP M_Wasser\nS  Hupe\nU  Quittieren\nR  Hupe\nUN Wasser_OK\n=  Lampe_Rot',
    () => 'U  Quittieren\nR  Hupe\nU  Wasser_OK\nFN M_Wasser\nS  Hupe\nUN Wasser_OK\n=  Lampe_Rot'
  ]
});

// ---- Kapitel 5 ----
defExamTask({ id:'x_awl_g_druck_stabil', quest:'awl', level:'grund', ch:5, diff:1, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Hydraulikdruck stabil',
  brief: p => '<code>Druck_stabil</code> wird 1, wenn <code>Druck_OK</code> seit <b>' + p.T + ' s</b> ununterbrochen ansteht (Einschaltverzögerung mit Zeit <code>T1</code>). Fällt <code>Druck_OK</code> ab, wird <code>Druck_stabil</code> sofort 0.<br>Während der Wartezeit (<code>Druck_OK</code> = 1, Zeit noch nicht abgelaufen) leuchtet <code>Lampe_Gelb</code>.',
  vars: () => ({ Druck_OK:false, Druck_stabil:false, Lampe_Gelb:false }),
  start: () => '// Druck stabil\n',
  ref: p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSE T1\nU  T1\n=  Druck_stabil\nU  Druck_OK\nUN T1\n=  Lampe_Gelb',
  must:['SE', 'S5T'],
  visible: p => seq([[0,{Druck_OK:true},{Druck_stabil:false, Lampe_Gelb:true}],[p.T + 0.1,{},{Druck_stabil:true, Lampe_Gelb:false}]]),
  hidden: p => [
    { steps:[[0,{Druck_OK:true},{Druck_stabil:false, Lampe_Gelb:true}],[p.T - 0.2,{},{Druck_stabil:false, Lampe_Gelb:true}],[0.3,{},{Druck_stabil:true, Lampe_Gelb:false}],[0.1,{Druck_OK:false},{Druck_stabil:false, Lampe_Gelb:false}]] },
    { steps:[[0,{Druck_OK:true},{Druck_stabil:false}],[p.T - 0.5,{Druck_OK:false},{Druck_stabil:false, Lampe_Gelb:false}],[0.1,{Druck_OK:true},{Druck_stabil:false, Lampe_Gelb:true}],[p.T - 0.3,{},{Druck_stabil:false}],[0.4,{},{Druck_stabil:true}]] },
    { steps:[[0,{},{Druck_stabil:false, Lampe_Gelb:false}],[p.T + 1,{},{Druck_stabil:false, Lampe_Gelb:false}]] }
  ],
  wrong:[
    p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSA T1\nU  T1\n=  Druck_stabil\nU  Druck_OK\nUN T1\n=  Lampe_Gelb',
    p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSV T1\nU  T1\n=  Druck_stabil\nU  Druck_OK\nUN T1\n=  Lampe_Gelb',
    p => 'U  Druck_OK\nL  S5T#' + p.T + 'S\nSE T1\nU  T1\n=  Druck_stabil\nUN T1\n=  Lampe_Gelb'
  ]
});

defExamTask({ id:'x_awl_g_absaugung', quest:'awl', level:'grund', ch:5, diff:2, timed:true,
  params:{ T:[3, 5, 6] },
  title:'Absaugung mit Nachlauf',
  brief: p => 'Die <code>Absaugung</code> über der Schere läuft, solange <code>Schere_aktiv</code> = 1 ist, und danach noch <b>' + p.T + ' s</b> weiter (Ausschaltverzögerung mit Zeit <code>T2</code>).<br>Zusätzlich kann sie mit dem Taster <code>S_Hand</code> direkt eingeschaltet werden (solange er gedrückt ist).',
  vars: () => ({ Schere_aktiv:false, S_Hand:false, Absaugung:false }),
  start: () => '// Absaugung\n',
  ref: p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSA T2\nU  T2\nO  S_Hand\n=  Absaugung',
  must:['SA'],
  visible: p => seq([[0,{Schere_aktiv:true},{Absaugung:true}],[0.1,{Schere_aktiv:false},{Absaugung:true}],[p.T + 0.2,{},{Absaugung:false}]]),
  hidden: p => [
    { steps:[[0,{Schere_aktiv:true},{Absaugung:true}],[1,{Schere_aktiv:false},{Absaugung:true}],[p.T - 0.3,{},{Absaugung:true}],[0.5,{},{Absaugung:false}]] },
    { steps:[[0,{Schere_aktiv:true},{Absaugung:true}],[0.1,{Schere_aktiv:false},{Absaugung:true}],[p.T - 1,{Schere_aktiv:true},{Absaugung:true}],[0.1,{Schere_aktiv:false},{Absaugung:true}],[p.T - 0.5,{},{Absaugung:true}],[0.7,{},{Absaugung:false}]] },
    { steps:[[0,{S_Hand:true},{Absaugung:true}],[0.1,{S_Hand:false},{Absaugung:false}],[0.1,{},{Absaugung:false}]] }
  ],
  wrong:[
    p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\nO  S_Hand\n=  Absaugung',
    p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSV T2\nU  T2\nO  S_Hand\n=  Absaugung',
    p => 'U  Schere_aktiv\nL  S5T#' + p.T + 'S\nSA T2\nU  T2\n=  Absaugung'
  ]
});

defExamTask({ id:'x_awl_g_ofentuer', quest:'awl', level:'grund', ch:5, diff:3, timed:true,
  params:{ T:[4, 5], H:[1, 2] },
  title:'Ofentür überwachen',
  brief: p => 'Zwei Zeiten für die Ofentür (<code>Tuer_offen</code> = 1: Tür offen):<br>• Beim Öffnen tönt die <code>Hupe</code> <b>' + p.H + ' s</b> lang – auch wenn die Tür vorher wieder zugeht (verlängerter Impuls, Zeit <code>T1</code>).<br>• Ist die Tür länger als <b>' + p.T + ' s</b> ununterbrochen offen, wird <code>Stoerung</code> <b>gesetzt</b> (Zeit <code>T2</code>). <code>Quittieren</code> setzt <code>Stoerung</code> zurück (zuletzt).',
  vars: () => ({ Tuer_offen:false, Quittieren:false, Hupe:false, Stoerung:false }),
  start: () => '// Ofentür\n',
  ref: p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSV T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\nS  Stoerung\nU  Quittieren\nR  Stoerung',
  must:['SV', 'SE', 'S', 'R'],
  visible: p => seq([[0,{Tuer_offen:true},{Hupe:true, Stoerung:false}],[p.H + 0.1,{},{Hupe:false, Stoerung:false}],[p.T - p.H,{},{Stoerung:true}]]),
  hidden: p => [
    { steps:[[0,{Tuer_offen:true},{Hupe:true, Stoerung:false}],[p.H - 0.2,{},{Hupe:true}],[0.3,{},{Hupe:false, Stoerung:false}],[p.T - p.H - 0.2,{},{Stoerung:false}],[0.3,{},{Stoerung:true}],[0.1,{Tuer_offen:false},{Stoerung:true, Hupe:false}],[0.1,{Quittieren:true},{Stoerung:false}],[0.1,{Quittieren:false},{Stoerung:false}]] },
    { steps:[[0,{Tuer_offen:true},{Hupe:true}],[0.3,{Tuer_offen:false},{Hupe:true}],[p.H - 0.5,{},{Hupe:true}],[0.4,{},{Hupe:false, Stoerung:false}]] },
    { steps:[[0,{Tuer_offen:true},{}],[p.T - 0.5,{Tuer_offen:false},{Stoerung:false}],[0.1,{Tuer_offen:true},{Stoerung:false}],[p.T - 0.3,{},{Stoerung:false}],[0.5,{},{Stoerung:true}]] }
  ],
  wrong:[
    p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSI T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\nS  Stoerung\nU  Quittieren\nR  Stoerung',
    p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSV T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSA T2\nU  T2\nS  Stoerung\nU  Quittieren\nR  Stoerung',
    p => 'U  Tuer_offen\nL  S5T#' + p.H + 'S\nSV T1\nU  T1\n=  Hupe\nU  Tuer_offen\nL  S5T#' + p.T + 'S\nSE T2\nU  T2\n=  Stoerung'
  ]
});

// ---- Kapitel 6 ----
defExamTask({ id:'x_awl_g_schnitte', quest:'awl', level:'grund', ch:6, diff:1, timed:true,
  title:'Schnitte bis zum Messerwechsel',
  brief: () => 'Zähle mit Zähler <code>Z1</code> jeden Schnitt (steigende Flanke von <code>Schere_unten</code>) vorwärts. <code>S_Messer_neu</code> setzt den Zähler auf 0 zurück. Schreibe den Zählwert nach <code>Schnitte</code>.<br><code>Messer_benutzt</code> ist 1, solange der Zählwert nicht 0 ist.',
  vars: () => ({ Schere_unten:false, S_Messer_neu:false, Schnitte:0, Messer_benutzt:false }),
  start: () => '// Schnittzähler\n',
  ref: () => 'U  Schere_unten\nZV Z1\nU  S_Messer_neu\nR  Z1\nL  Z1\nT  Schnitte\nU  Z1\n=  Messer_benutzt',
  must:['ZV', 'ZRESET'],
  visible: () => seq([[0.1,{Schere_unten:true},{Schnitte:1, Messer_benutzt:true}],[0.1,{Schere_unten:false},{Schnitte:1}],[0.1,{Schere_unten:true},{Schnitte:2}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schnitte:0, Messer_benutzt:false}],[0.1,{Schere_unten:true},{Schnitte:1, Messer_benutzt:true}],[0.1,{},{Schnitte:1}],[0.1,{Schere_unten:false},{Schnitte:1}],[0.1,{Schere_unten:true},{Schnitte:2}],[0.1,{Schere_unten:false, S_Messer_neu:true},{Schnitte:0, Messer_benutzt:false}],[0.1,{S_Messer_neu:false},{Schnitte:0}]] },
    { steps:[[0.1,{Schere_unten:true},{Schnitte:1}],[0.1,{Schere_unten:false},{}],[0.1,{Schere_unten:true},{Schnitte:2}],[0.1,{Schere_unten:false},{}],[0.1,{Schere_unten:true},{Schnitte:3, Messer_benutzt:true}]] },
    { steps:[[0.1,{Schere_unten:true, S_Messer_neu:true},{Schnitte:0}],[0.1,{S_Messer_neu:false},{Schnitte:0, Messer_benutzt:false}],[0.1,{Schere_unten:false},{Schnitte:0}],[0.1,{Schere_unten:true},{Schnitte:1}]] }
  ],
  wrong:[
    () => 'U  Schere_unten\nZR Z1\nU  S_Messer_neu\nR  Z1\nL  Z1\nT  Schnitte\nU  Z1\n=  Messer_benutzt',
    () => 'U  Schere_unten\nZV Z1\nL  Z1\nT  Schnitte\nU  Z1\n=  Messer_benutzt',
    () => 'U  Schere_unten\nZV Z1\nU  S_Messer_neu\nR  Z1\nL  Z1\nT  Schnitte\nUN Z1\n=  Messer_benutzt'
  ]
});

defExamTask({ id:'x_awl_g_kuehlbett', quest:'awl', level:'grund', ch:6, diff:2, timed:true,
  params:{ N:[4, 6, 8] },
  title:'Freie Plätze auf dem Kühlbett',
  brief: p => 'Das Kühlbett hat <b>' + p.N + '</b> Plätze. Zähler <code>Z3</code> zählt die freien Plätze:<br>• <code>S_Leer</code> setzt den Zähler auf <b>' + p.N + '</b>.<br>• Jeder Block, der aufgelegt wird (<code>Block_auf</code>), zählt <b>rückwärts</b>.<br>• Jeder Block, der abgenommen wird (<code>Block_ab</code>), zählt <b>vorwärts</b>.<br>Schreibe den Zählwert nach <code>Frei</code>. <code>Voll</code> ist 1, wenn der Zählwert 0 ist.',
  vars: () => ({ S_Leer:false, Block_auf:false, Block_ab:false, Frei:0, Voll:false }),
  start: () => '// Kühlbett\n',
  ref: p => 'U  S_Leer\nL  ' + p.N + '\nS  Z3\nU  Block_auf\nZR Z3\nU  Block_ab\nZV Z3\nL  Z3\nT  Frei\nUN Z3\n=  Voll',
  must:['ZS', 'ZR', 'ZV'],
  visible: p => seq([[0.1,{S_Leer:true},{Frei:p.N, Voll:false}],[0.1,{S_Leer:false, Block_auf:true},{Frei:p.N - 1}]]),
  hidden: p => {
    const fill = [[0.1,{S_Leer:true},{Frei:p.N}],[0.1,{S_Leer:false},{}]];
    for(let i = p.N - 1; i >= 0; i--){ fill.push([0.1,{Block_auf:true},{Frei:i, Voll:i === 0}]); fill.push([0.1,{Block_auf:false},{}]); }
    fill.push([0.1,{Block_auf:true},{Frei:0, Voll:true}]);
    return [
      { steps:[[0.1,{S_Leer:true},{Frei:p.N, Voll:false}],[0.1,{S_Leer:false},{Frei:p.N}],[0.1,{Block_auf:true},{Frei:p.N - 1}],[0.1,{Block_auf:false},{Frei:p.N - 1}],[0.1,{Block_auf:true},{Frei:p.N - 2}],[0.1,{Block_auf:false, Block_ab:true},{Frei:p.N - 1}],[0.1,{Block_ab:false},{Frei:p.N - 1, Voll:false}]] },
      { steps: fill },
      { steps:[[0.1,{},{Frei:0, Voll:true}],[0.1,{Block_ab:true},{Frei:1, Voll:false}]] }
    ];
  },
  wrong:[
    p => 'U  S_Leer\nL  ' + p.N + '\nS  Z3\nU  Block_auf\nZV Z3\nU  Block_ab\nZR Z3\nL  Z3\nT  Frei\nUN Z3\n=  Voll',
    p => 'U  S_Leer\nL  ' + p.N + '\nS  Z3\nU  Block_auf\nZR Z3\nU  Block_ab\nZV Z3\nL  Z3\nT  Frei\nU  Z3\n=  Voll',
    () => 'U  Block_auf\nZR Z3\nU  Block_ab\nZV Z3\nL  Z3\nT  Frei\nUN Z3\n=  Voll'
  ]
});

// ---- Kapitel 7 ----
defExamTask({ id:'x_awl_g_spaltdiff', quest:'awl', level:'grund', ch:7, diff:1,
  params:{ SOLL:[10, 12, 15] },
  title:'Spaltdifferenz mit TAK',
  brief: p => 'Lade zuerst <code>Spalt_oben</code>, dann <code>Spalt_unten</code>. Tausche die Akkus mit <code>TAK</code> und berechne so <code>Differenz</code> = <code>Spalt_unten</code> − <code>Spalt_oben</code> (<code>-I</code> rechnet AKKU2 − AKKU1).<br>Schreibe danach den Sollwert <b>' + p.SOLL + '</b> nach <code>Spalt_Soll</code>.',
  vars: () => ({ Spalt_oben:0, Spalt_unten:0, Differenz:0, Spalt_Soll:0 }),
  start: () => '// Spaltdifferenz\n',
  ref: p => 'L  Spalt_oben\nL  Spalt_unten\nTAK\n-I\nT  Differenz\nL  ' + p.SOLL + '\nT  Spalt_Soll',
  must:['TAK', 'L', 'T'],
  visible: p => [[{ Spalt_oben:12, Spalt_unten:15 }, { Differenz:3, Spalt_Soll:p.SOLL }]],
  hidden: p => [[{ Spalt_oben:20, Spalt_unten:26 }, { Differenz:6, Spalt_Soll:p.SOLL }], [{ Spalt_oben:30, Spalt_unten:21 }, { Differenz:-9 }], [{ Spalt_oben:8, Spalt_unten:8 }, { Differenz:0, Spalt_Soll:p.SOLL }], [{ Spalt_oben:0, Spalt_unten:45 }, { Differenz:45 }], [{ Spalt_oben:100, Spalt_unten:1, Differenz:7 }, { Differenz:-99 }], [{ Spalt_oben:14, Spalt_unten:17, Spalt_Soll:99 }, { Differenz:3, Spalt_Soll:p.SOLL }]],
  wrong:[
    p => 'L  Spalt_oben\nL  Spalt_unten\n-I\nT  Differenz\nL  ' + p.SOLL + '\nT  Spalt_Soll',
    () => 'L  Spalt_oben\nL  Spalt_unten\nTAK\n-I\nT  Differenz'
  ]
});

// ---- Kapitel 8 ----
defExamTask({ id:'x_awl_g_walzlaenge', quest:'awl', level:'grund', ch:8, diff:2,
  params:{ V:[1, 2, 3] },
  title:'Länge nach dem Stich',
  brief: p => 'Beim Walzen bleibt das Volumen gleich. Berechne (alles Int):<br><code>Laenge_aus</code> = <code>Laenge_ein</code> · <code>Dicke_ein</code> / <code>Dicke_aus</code> − <b>' + p.V + '</b> (Schopfverlust in m).<br>Achtung: <code>/I</code> schneidet Nachkommastellen ab – multipliziere <b>vor</b> dem Dividieren.',
  vars: () => ({ Laenge_ein:0, Dicke_ein:0, Dicke_aus:0, Laenge_aus:0 }),
  start: () => '// Walzlänge\n',
  ref: p => 'L  Laenge_ein\nL  Dicke_ein\n*I\nL  Dicke_aus\n/I\nL  ' + p.V + '\n-I\nT  Laenge_aus',
  must:['*I', '/I', '-I'],
  visible: p => [[{ Laenge_ein:12, Dicke_ein:150, Dicke_aus:100 }, { Laenge_aus:18 - p.V }]],
  hidden: p => [[{ Laenge_ein:10, Dicke_ein:125, Dicke_aus:40 }, { Laenge_aus:31 - p.V }], [{ Laenge_ein:7, Dicke_ein:90, Dicke_aus:60 }, { Laenge_aus:10 - p.V }], [{ Laenge_ein:20, Dicke_ein:200, Dicke_aus:200 }, { Laenge_aus:20 - p.V }], [{ Laenge_ein:15, Dicke_ein:110, Dicke_aus:70 }, { Laenge_aus:23 - p.V }], [{ Laenge_ein:5, Dicke_ein:300, Dicke_aus:120 }, { Laenge_aus:12 - p.V }], [{ Laenge_ein:8, Dicke_ein:180, Dicke_aus:45 }, { Laenge_aus:32 - p.V }]],
  wrong:[
    p => 'L  Dicke_ein\nL  Dicke_aus\n/I\nL  Laenge_ein\n*I\nL  ' + p.V + '\n-I\nT  Laenge_aus',
    p => 'L  Laenge_ein\nL  Dicke_ein\n*I\nL  Dicke_aus\n/I\nL  ' + p.V + '\n+I\nT  Laenge_aus',
    () => 'L  Laenge_ein\nL  Dicke_ein\n*I\nL  Dicke_aus\n/I\nT  Laenge_aus'
  ]
});

defExamTask({ id:'x_awl_g_fahrenheit', quest:'awl', level:'grund', ch:8, diff:3,
  title:'Ofentemperatur in Fahrenheit',
  brief: () => 'Ein Kunde möchte die Ofentemperatur in °F. Berechne aus <code>Temp_C</code> (Int):<br><code>Temp_F</code> = <code>Temp_C</code> · 1,8 + 32, <b>kaufmännisch gerundet</b> auf eine ganze Zahl (Int).<br>Rechne mit REAL (<code>ITD</code>, <code>DTR</code>, <code>*R</code>, <code>+R</code>) und runde mit <code>RND</code>.',
  vars: () => ({ Temp_C:0, Temp_F:0 }),
  start: () => '// Fahrenheit\n',
  ref: () => 'L  Temp_C\nITD\nDTR\nL  1.8\n*R\nL  32.0\n+R\nRND\nT  Temp_F',
  must:['DTR', '*R', 'RND'],
  visible: () => [[{ Temp_C:1000 }, { Temp_F:1832 }], [{ Temp_C:25 }, { Temp_F:77 }]],
  hidden: () => [[{ Temp_C:1182 }, { Temp_F:2160 }], [{ Temp_C:1203 }, { Temp_F:2197 }], [{ Temp_C:1187 }, { Temp_F:2169 }], [{ Temp_C:0 }, { Temp_F:32 }], [{ Temp_C:-40 }, { Temp_F:-40 }], [{ Temp_C:1111 }, { Temp_F:2032 }], [{ Temp_C:13 }, { Temp_F:55 }]],
  wrong:[
    () => 'L  Temp_C\nITD\nDTR\nL  1.8\n*R\nL  32.0\n+R\nTRUNC\nT  Temp_F',
    () => 'L  Temp_C\nL  18\n*I\nL  10\n/I\nL  32\n+I\nT  Temp_F',
    () => 'L  Temp_C\nITD\nDTR\nL  32.0\n+R\nL  1.8\n*R\nRND\nT  Temp_F'
  ]
});

// ---- Kapitel 9 ----
defExamTask({ id:'x_awl_g_temperatur', quest:'awl', level:'grund', ch:9, diff:2,
  params:{ LO:[1050, 1080, 1100], HI:[1200, 1250] },
  title:'Walztemperatur im Fenster',
  brief: p => '<code>Walzen_Frei</code> ist 1, wenn <code>Temp</code> (Int, °C) im Bereich <b>' + p.LO + ' … ' + p.HI + '</b> liegt (Grenzen eingeschlossen). Sonst 0.',
  vars: () => ({ Temp:0, Walzen_Frei:false }),
  start: () => '// Temperaturfenster\n',
  ref: p => 'L  Temp\nL  ' + p.LO + '\n>=I\nU(\nL  Temp\nL  ' + p.HI + '\n<=I\n)\n=  Walzen_Frei',
  must:['CMP_I'],
  visible: p => [[{Temp:(p.LO + p.HI) >> 1},{Walzen_Frei:true}], [{Temp:800},{Walzen_Frei:false}]],
  hidden: p => [[{Temp:p.LO - 1},{Walzen_Frei:false}],[{Temp:p.LO},{Walzen_Frei:true}],[{Temp:p.HI},{Walzen_Frei:true}],[{Temp:p.HI + 1},{Walzen_Frei:false}],[{Temp:0, Walzen_Frei:true},{Walzen_Frei:false}],[{Temp:1500},{Walzen_Frei:false}]],
  wrong:[
    p => 'L  Temp\nL  ' + p.LO + '\n>I\nU(\nL  Temp\nL  ' + p.HI + '\n<I\n)\n=  Walzen_Frei',
    p => 'L  Temp\nL  ' + p.LO + '\n>=I\nO(\nL  Temp\nL  ' + p.HI + '\n<=I\n)\n=  Walzen_Frei',
    p => 'L  Temp\nL  ' + p.LO + '\n>=I\n=  Walzen_Frei'
  ]
});

defExamTask({ id:'x_awl_g_kuehlpumpe', quest:'awl', level:'grund', ch:9, diff:3, timed:true,
  params:{ LO:[30, 35], HI:[45, 50] },
  title:'Kühlpumpe mit zwei Grenzen',
  brief: p => 'Zweipunktregelung für das Kühlwasser (<code>Wasser_Temp</code> in °C, Int):<br>• Ab <b>' + p.HI + ' °C</b> (≥) wird die <code>Pumpe</code> <b>gesetzt</b>.<br>• Ab <b>' + p.LO + ' °C</b> abwärts (≤) wird sie <b>zurückgesetzt</b>.<br>• Dazwischen bleibt sie, wie sie ist.<br>• <code>Stoerung</code> = 1 setzt die Pumpe immer zurück (hat Vorrang).',
  vars: () => ({ Wasser_Temp:20, Stoerung:false, Pumpe:false }),
  start: () => '// Kühlpumpe\n',
  ref: p => 'L  Wasser_Temp\nL  ' + p.HI + '\n>=I\nS  Pumpe\nL  Wasser_Temp\nL  ' + p.LO + '\n<=I\nR  Pumpe\nU  Stoerung\nR  Pumpe',
  must:['CMP_I', 'S', 'R'],
  visible: p => seq([[0.1,{Wasser_Temp:p.HI + 3},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO + 2},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO - 3},{Pumpe:false}]]),
  hidden: p => [
    { steps:[[0.1,{Wasser_Temp:p.LO + 5},{Pumpe:false}],[0.1,{Wasser_Temp:p.HI - 1},{Pumpe:false}],[0.1,{Wasser_Temp:p.HI},{Pumpe:true}],[0.1,{Wasser_Temp:p.HI - 1},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO + 1},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO},{Pumpe:false}],[0.1,{Wasser_Temp:p.LO + 1},{Pumpe:false}]] },
    { steps:[[0.1,{Wasser_Temp:p.HI + 5},{Pumpe:true}],[0.1,{Stoerung:true},{Pumpe:false}],[0.1,{Stoerung:false},{Pumpe:true}]] },
    { steps:[[0.1,{Wasser_Temp:p.LO - 5},{Pumpe:false}],[0.1,{Wasser_Temp:p.HI + 1},{Pumpe:true}],[0.1,{Wasser_Temp:p.LO - 1},{Pumpe:false}]] }
  ],
  wrong:[
    p => 'L  Wasser_Temp\nL  ' + p.HI + '\n>I\nS  Pumpe\nL  Wasser_Temp\nL  ' + p.LO + '\n<I\nR  Pumpe\nU  Stoerung\nR  Pumpe',
    p => 'L  Wasser_Temp\nL  ' + p.HI + '\n>=I\n=  Pumpe\nU  Stoerung\nR  Pumpe',
    p => 'U  Stoerung\nR  Pumpe\nL  Wasser_Temp\nL  ' + p.HI + '\n>=I\nS  Pumpe\nL  Wasser_Temp\nL  ' + p.LO + '\n<=I\nR  Pumpe'
  ]
});

// ---- Kapitel 10 ----
defExamTask({ id:'x_awl_g_spaltwahl', quest:'awl', level:'grund', ch:10, diff:2,
  params:{ K:[1, 2, 3] },
  title:'Sollspalt von Hand oder aus dem Stichplan',
  brief: p => 'Verzweige mit Sprüngen:<br>• <code>Hand</code> = 1: <code>Spalt_Soll</code> := <code>Spalt_Hand</code>.<br>• <code>Hand</code> = 0: <code>Spalt_Soll</code> := <code>Spalt_Auto</code> + <b>' + p.K + '</b> (Korrektur).<br>Verwende <code>SPB</code> oder <code>SPBN</code> und <code>SPA</code> mit Sprungmarken.',
  vars: () => ({ Hand:false, Spalt_Hand:0, Spalt_Auto:0, Spalt_Soll:0 }),
  start: () => '// Sollspalt\n',
  ref: p => 'U  Hand\nSPB HAND\nL  Spalt_Auto\nL  ' + p.K + '\n+I\nT  Spalt_Soll\nSPA ENDE\nHAND: L  Spalt_Hand\nT  Spalt_Soll\nENDE: NOP 0',
  must:['JUMP', 'LABEL'],
  visible: p => [[{ Hand:true, Spalt_Hand:20, Spalt_Auto:30 }, { Spalt_Soll:20 }], [{ Spalt_Hand:20, Spalt_Auto:30 }, { Spalt_Soll:30 + p.K }]],
  hidden: p => [[{ Hand:true, Spalt_Hand:14, Spalt_Auto:50 }, { Spalt_Soll:14 }], [{ Hand:false, Spalt_Hand:14, Spalt_Auto:50 }, { Spalt_Soll:50 + p.K }], [{ Hand:true, Spalt_Hand:0, Spalt_Auto:9, Spalt_Soll:77 }, { Spalt_Soll:0 }], [{ Spalt_Hand:8, Spalt_Auto:0, Spalt_Soll:77 }, { Spalt_Soll:p.K }], [{ Hand:true, Spalt_Hand:95, Spalt_Auto:95 }, { Spalt_Soll:95 }], [{ Spalt_Hand:40, Spalt_Auto:12 }, { Spalt_Soll:12 + p.K }]],
  wrong:[
    p => 'U  Hand\nSPBN HAND\nL  Spalt_Auto\nL  ' + p.K + '\n+I\nT  Spalt_Soll\nSPA ENDE\nHAND: L  Spalt_Hand\nT  Spalt_Soll\nENDE: NOP 0',
    p => 'U  Hand\nSPB HAND\nL  Spalt_Auto\nL  ' + p.K + '\n+I\nT  Spalt_Soll\nHAND: L  Spalt_Hand\nT  Spalt_Soll',
    () => 'U  Hand\nSPB HAND\nL  Spalt_Auto\nT  Spalt_Soll\nSPA ENDE\nHAND: L  Spalt_Hand\nT  Spalt_Soll\nENDE: NOP 0'
  ]
});

const stiche = (s, n) => { for(let i = 0; i < n; i++) s = Math.trunc(s * 9 / 10); return s; };
defExamTask({ id:'x_awl_g_stiche', quest:'awl', level:'grund', ch:10, diff:3,
  params:{ N:[3, 4, 5] },
  title:'Spalt nach mehreren Stichen',
  brief: p => 'Jeder Stich verringert den Walzspalt auf 90 %: <code>Spalt</code> := <code>Spalt</code> · 9 / 10 (Int, <code>/I</code> schneidet ab).<br>Berechne mit einer <code>LOOP</code>-Schleife den Spalt nach <b>' + p.N + '</b> Stichen: Starte mit <code>Spalt_Start</code>, Ergebnis nach <code>Spalt_End</code>. Den Schleifenzähler sicherst du in <code>Zaehler</code>.',
  vars: () => ({ Spalt_Start:0, Spalt_End:0, Zaehler:0 }),
  start: () => '// Stiche\n',
  ref: p => 'L  Spalt_Start\nT  Spalt_End\nL  ' + p.N + '\nNEXT: T  Zaehler\nL  Spalt_End\nL  9\n*I\nL  10\n/I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT',
  must:['LOOP', 'LABEL'],
  visible: p => [[{ Spalt_Start:100 }, { Spalt_End:stiche(100, p.N) }]],
  hidden: p => [250, 37, 10, 0, 3000, 1234].map(s => [{ Spalt_Start:s, Spalt_End:5 }, { Spalt_End:stiche(s, p.N) }]),
  wrong:[
    p => 'L  Spalt_Start\nT  Spalt_End\nL  ' + (p.N + 1) + '\nNEXT: T  Zaehler\nL  Spalt_End\nL  9\n*I\nL  10\n/I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT',
    p => 'L  ' + p.N + '\nNEXT: T  Zaehler\nL  Spalt_Start\nL  9\n*I\nL  10\n/I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT',
    p => 'L  Spalt_Start\nT  Spalt_End\nL  ' + p.N + '\nNEXT: T  Zaehler\nL  Spalt_End\nL  10\n/I\nL  9\n*I\nT  Spalt_End\nL  Zaehler\nLOOP NEXT'
  ]
});

/* =====================================================================
   Profi-Stufe (Kapitel 11–15)
   ===================================================================== */
const MAIN = body => aOB('Main', body);

// ---- Kapitel 11 ----
const MIN_D = { in:'A:Int|Wert 1; B:Int|Wert 2' };
defExamTask({ id:'x_awl_p_minimum', quest:'awl', level:'profi', ch:11, diff:1,
  title:'Kleinster Walzspalt (FC)',
  brief: () => 'Programmiere die Funktion <code>FC_Min</code> mit Rückgabewert (Int): Sie liefert den <b>kleineren</b> der beiden Eingänge <code>#A</code> und <code>#B</code>. Den Rückgabewert schreibst du mit <code>T #RET_VAL</code>. Der OB <code>Main</code> (🔒) bestimmt den kleineren Walzspalt der beiden Gerüste.',
  blocks: () => [
    { name:'FC_Min', kind:'FC', edit:true, start: aFC('FC_Min', 'Int', MIN_D, ''), ref: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n<I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Min"\n   A := "Spalt_1"\n   B := "Spalt_2"\n   RET_VAL := "Spalt_Min"') }
  ],
  globals: () => ({ Spalt_1:0, Spalt_2:0, Spalt_Min:0 }),
  must:['CMP_I'],
  visible: () => ({ tests:[[{Spalt_1:30, Spalt_2:40},{Spalt_Min:30}]] }),
  hidden: () => ({
    unit:[{ block:'FC_Min', steps:[[{A:5, B:9},{RET:5}],[{A:9, B:5},{RET:5}],[{A:7, B:7},{RET:7}],[{A:-3, B:2},{RET:-3}],[{A:0, B:-1},{RET:-1}]] }],
    tests:[[{Spalt_1:80, Spalt_2:12},{Spalt_Min:12}],[{Spalt_1:25, Spalt_2:25},{Spalt_Min:25}]]
  }),
  wrong:[
    () => ({ FC_Min: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n>I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') }),
    () => ({ FC_Min: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nT  #RET_VAL') })
  ]
});

const ABW_D = { in:'Soll:Int|mm; Ist:Int|mm', out:'Diff:Int|Ist − Soll; Ausser_Tol:Bool|Abweichung zu gross' };
const ABW_BODY = (tol, cmpHi, cmpLo, sub) => (sub || 'L  #Ist\nL  #Soll\n-I') + '\nT  #Diff\nO(\nL  #Diff\nL  ' + tol + '\n' + (cmpHi || '>I') + '\n)\nO(\nL  #Diff\nL  -' + tol + '\n' + (cmpLo || '<I') + '\n)\n=  #Ausser_Tol';
defExamTask({ id:'x_awl_p_abweichung', quest:'awl', level:'profi', ch:11, diff:2,
  params:{ TOL:[2, 3, 5] },
  title:'Spaltabweichung (FC)',
  brief: p => 'Programmiere <code>FC_Abweichung</code> (ohne Rückgabewert):<br>• <code>#Diff</code> = <code>#Ist</code> − <code>#Soll</code><br>• <code>#Ausser_Tol</code> = 1, wenn <code>#Diff</code> grösser als <b>' + p.TOL + '</b> oder kleiner als <b>−' + p.TOL + '</b> ist (genau ±' + p.TOL + ' ist noch in Ordnung).<br><code>Main</code> (🔒) ruft die Funktion für den Walzspalt auf.',
  blocks: p => [
    { name:'FC_Abweichung', kind:'FC', edit:true, start: aFC('FC_Abweichung', 'Void', ABW_D, ''), ref: aFC('FC_Abweichung', 'Void', ABW_D, ABW_BODY(p.TOL)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Abweichung"\n   Soll := "Spalt_Soll"\n   Ist := "Spalt_Ist"\n   Diff => "Spalt_Diff"\n   Ausser_Tol => "Lampe_Gelb"') }
  ],
  globals: () => ({ Spalt_Soll:0, Spalt_Ist:0, Spalt_Diff:0, Lampe_Gelb:false }),
  must:['CMP_I', '-I'],
  visible: p => ({ tests:[[{ Spalt_Soll:20, Spalt_Ist:21 }, { Spalt_Diff:1, Lampe_Gelb:false }], [{ Spalt_Soll:20, Spalt_Ist:30 }, { Spalt_Diff:10, Lampe_Gelb:true }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Abweichung', steps:[[{ Soll:10, Ist:10 }, { Diff:0, Ausser_Tol:false }], [{ Soll:10, Ist:10 + p.TOL }, { Diff:p.TOL, Ausser_Tol:false }], [{ Soll:10, Ist:11 + p.TOL }, { Diff:p.TOL + 1, Ausser_Tol:true }], [{ Soll:40, Ist:40 - p.TOL }, { Diff:-p.TOL, Ausser_Tol:false }], [{ Soll:40, Ist:39 - p.TOL }, { Diff:-p.TOL - 1, Ausser_Tol:true }], [{ Soll:0, Ist:-20 }, { Diff:-20, Ausser_Tol:true }]] }],
    tests:[[{ Spalt_Soll:15, Spalt_Ist:14 }, { Spalt_Diff:-1, Lampe_Gelb:false }], [{ Spalt_Soll:15, Spalt_Ist:2 }, { Spalt_Diff:-13, Lampe_Gelb:true }]]
  }),
  wrong:[
    p => ({ FC_Abweichung: aFC('FC_Abweichung', 'Void', ABW_D, ABW_BODY(p.TOL, '>=I', '<=I')) }),
    p => ({ FC_Abweichung: aFC('FC_Abweichung', 'Void', ABW_D, 'L  #Ist\nL  #Soll\n-I\nT  #Diff\nL  #Diff\nL  ' + p.TOL + '\n>I\n=  #Ausser_Tol') }),
    p => ({ FC_Abweichung: aFC('FC_Abweichung', 'Void', ABW_D, ABW_BODY(p.TOL, null, null, 'L  #Soll\nL  #Ist\n-I')) })
  ]
});

const KL_D = { in:'Dicke:Int|mm' };
const KL_BODY = (g1, g2, c1, zero) => 'L  0\nT  #RET_VAL\n' + (zero === false ? '' : 'L  #Dicke\nL  0\n<=I\nBEB\n') + 'L  1\nT  #RET_VAL\nL  #Dicke\nL  ' + g1 + '\n' + (c1 || '<I') + '\nBEB\nL  2\nT  #RET_VAL\nL  #Dicke\nL  ' + g2 + '\n' + (c1 || '<I') + '\nBEB\nL  3\nT  #RET_VAL';
defExamTask({ id:'x_awl_p_dickenklasse', quest:'awl', level:'profi', ch:11, diff:3,
  params:{ G1:[20, 25], G2:[40, 50] },
  title:'Dickenklasse (FC mit RET_VAL)',
  brief: p => 'Programmiere <code>FC_Klasse</code> (Rückgabewert Int). Sie ordnet die Blechdicke <code>#Dicke</code> einer Klasse zu:<br>• <code>#Dicke</code> ≤ 0 → <b>0</b> (Messfehler)<br>• 1 … ' + (p.G1 - 1) + ' → <b>1</b><br>• ' + p.G1 + ' … ' + (p.G2 - 1) + ' → <b>2</b><br>• ab ' + p.G2 + ' → <b>3</b><br>Tipp: Rückgabewert vorbelegen und mit <code>BEB</code> vorzeitig beenden – oder mit Sprüngen arbeiten.',
  blocks: p => [
    { name:'FC_Klasse', kind:'FC', edit:true, start: aFC('FC_Klasse', 'Int', KL_D, ''), ref: aFC('FC_Klasse', 'Int', KL_D, KL_BODY(p.G1, p.G2)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Klasse"\n   Dicke := "Dicke"\n   RET_VAL := "Klasse"') }
  ],
  globals: () => ({ Dicke:0, Klasse:0 }),
  must:['CMP_I', 'RETVAL'],
  visible: p => ({ tests:[[{ Dicke:p.G1 + 5 }, { Klasse:2 }], [{ Dicke:5 }, { Klasse:1 }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Klasse', steps:[[{ Dicke:-5 }, { RET:0 }], [{ Dicke:0 }, { RET:0 }], [{ Dicke:1 }, { RET:1 }], [{ Dicke:p.G1 - 1 }, { RET:1 }], [{ Dicke:p.G1 }, { RET:2 }], [{ Dicke:p.G2 - 1 }, { RET:2 }], [{ Dicke:p.G2 }, { RET:3 }], [{ Dicke:300 }, { RET:3 }]] }],
    tests:[[{ Dicke:p.G2 + 10 }, { Klasse:3 }], [{ Dicke:0, Klasse:9 }, { Klasse:0 }]]
  }),
  wrong:[
    p => ({ FC_Klasse: aFC('FC_Klasse', 'Int', KL_D, KL_BODY(p.G1, p.G2, '<=I')) }),
    p => ({ FC_Klasse: aFC('FC_Klasse', 'Int', KL_D, KL_BODY(p.G1, p.G2, null, false)) }),
    p => ({ FC_Klasse: aFC('FC_Klasse', 'Int', KL_D, 'L  1\nT  #RET_VAL\nL  #Dicke\nL  ' + p.G1 + '\n<I\nBEB\nL  2\nT  #RET_VAL\nL  #Dicke\nL  ' + p.G2 + '\n<I\nBEB\nL  3\nT  #RET_VAL') })
  ]
});

// ---- Kapitel 12 ----
const LI_D = { in:'Taster:Bool', out:'Licht:Bool', stat:'M_Flanke:Bool|Flankenmerker' };
defExamTask({ id:'x_awl_p_licht', quest:'awl', level:'profi', ch:12, diff:1,
  title:'Stromstoss-Licht als FB',
  brief: () => 'Programmiere <code>FB_Licht</code>: Jeder Druck auf <code>#Taster</code> (steigende Flanke) schaltet <code>#Licht</code> um – ein, aus, ein … Den Flankenmerker <code>#M_Flanke</code> gibt es schon als statische Variable.<br><code>Main</code> (🔒) ruft den FB für die Halle und den Keller mit je einer eigenen Instanz auf.',
  blocks: () => [
    { name:'FB_Licht', kind:'FB', edit:true, start: aFB('FB_Licht', LI_D, ''), ref: aFB('FB_Licht', LI_D, 'U  #Taster\nFP #M_Flanke\nX  #Licht\n=  #Licht') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Halle\nCALL "FB_Licht", "Halle_DB"\n   Taster := "S_Halle"\n   Licht => "Licht_Halle"\n\nNETWORK Keller\nCALL "FB_Licht", "Keller_DB"\n   Taster := "S_Keller"\n   Licht => "Licht_Keller"') }
  ],
  globals: () => ({ S_Halle:false, S_Keller:false, Licht_Halle:false, Licht_Keller:false }),
  instances: () => ({ Halle_DB:'FB_Licht', Keller_DB:'FB_Licht' }),
  must:['FP'],
  visible: () => ({ timed:[{ steps:[[0.1,{ S_Halle:true },{ Licht_Halle:true }],[0.1,{ S_Halle:false },{ Licht_Halle:true }]] }] }),
  hidden: () => ({
    unit:[{ block:'FB_Licht', steps:[[0.1,{ Taster:true },{ Licht:true }],[0.1,{},{ Licht:true }],[0.1,{ Taster:false },{ Licht:true }],[0.1,{ Taster:true },{ Licht:false }],[0.1,{},{ Licht:false }],[0.1,{ Taster:false },{ Licht:false }]] }],
    timed:[{ steps:[[0.1,{ S_Halle:true },{ Licht_Halle:true, Licht_Keller:false }],[0.1,{ S_Halle:false, S_Keller:true },{ Licht_Halle:true, Licht_Keller:true }],[0.1,{ S_Keller:false, S_Halle:true },{ Licht_Halle:false, Licht_Keller:true }]] }]
  }),
  wrong:[
    () => ({ FB_Licht: aFB('FB_Licht', LI_D, 'U  #Taster\nX  #Licht\n=  #Licht') }),
    () => ({ FB_Licht: aFB('FB_Licht', LI_D, 'U  #Taster\nFP #M_Flanke\n=  #Licht') })
  ]
});

const AN_D = t => ({ in:'Start:Bool|Befehl', out:'Hupe:Bool|Anlaufwarnung; Motor:Bool', stat:'T_Warn:' + (t || 'TON') });
const AN_BODY = (T, hupe) => 'CALL #T_Warn\n   IN := #Start\n   PT := T#' + T + 'S\n' + (hupe || 'U  #Start\nUN #T_Warn.Q\n=  #Hupe') + '\nU  #T_Warn.Q\n=  #Motor';
defExamTask({ id:'x_awl_p_anlauf', quest:'awl', level:'profi', ch:12, diff:2,
  params:{ T:[2, 3] },
  title:'Anlaufwarnung mit IEC-Zeit',
  brief: p => 'Programmiere <code>FB_Anlauf</code> mit der Multiinstanz <code>#T_Warn</code> (TON, schon deklariert):<br>• Solange <code>#Start</code> = 1 ist, läuft die Zeit (<b>' + p.T + ' s</b>).<br>• Während der Wartezeit ertönt <code>#Hupe</code>.<br>• Nach Ablauf läuft <code>#Motor</code>, die Hupe ist aus.<br>• <code>#Start</code> = 0 schaltet alles sofort ab.<br>Aufruf: <code>CALL #T_Warn</code> mit <code>IN :=</code> und <code>PT := T#' + p.T + 'S</code>, Abfrage mit <code>#T_Warn.Q</code>.',
  blocks: p => [
    { name:'FB_Anlauf', kind:'FB', edit:true, start: aFB('FB_Anlauf', AN_D(), ''), ref: aFB('FB_Anlauf', AN_D(), AN_BODY(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Anlauf", "FB_Anlauf_DB"\n   Start := "Befehl_Rollgang"\n   Hupe => "Hupe"\n   Motor => "Rollgang"') }
  ],
  globals: () => ({ Befehl_Rollgang:false, Hupe:false, Rollgang:false }),
  must:['CALL', 'TON'],
  visible: p => ({ timed:[{ steps:[[0,{ Befehl_Rollgang:true },{ Hupe:true, Rollgang:false }],[p.T + 0.1,{},{ Hupe:false, Rollgang:true }]] }] }),
  hidden: p => ({
    timed:[
      { steps:[[0,{ Befehl_Rollgang:true },{ Hupe:true, Rollgang:false }],[p.T - 0.2,{},{ Hupe:true, Rollgang:false }],[0.3,{},{ Hupe:false, Rollgang:true }],[0.1,{ Befehl_Rollgang:false },{ Hupe:false, Rollgang:false }]] },
      { steps:[[0,{ Befehl_Rollgang:true },{ Hupe:true }],[p.T - 0.5,{ Befehl_Rollgang:false },{ Hupe:false, Rollgang:false }],[0.1,{ Befehl_Rollgang:true },{ Hupe:true }],[p.T - 0.3,{},{ Rollgang:false }],[0.5,{},{ Rollgang:true, Hupe:false }]] },
      { steps:[[0,{},{ Hupe:false, Rollgang:false }],[p.T + 1,{},{ Hupe:false, Rollgang:false }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Anlauf: aFB('FB_Anlauf', AN_D('TP'), AN_BODY(p.T)) }),
    p => ({ FB_Anlauf: aFB('FB_Anlauf', AN_D(), AN_BODY(p.T, 'U  #Start\n=  #Hupe')) })
  ]
});

// ---- Kapitel 13 ----
const PU_UDT = aUDT('UDT_Pumpe', 'Laeuft:Bool; Stoerung:Bool; Druck:Int|bar');
const HY_DB = aDB('DB_Hydraulik', 'P1:"UDT_Pumpe"|Pumpe 1; P2:"UDT_Pumpe"|Pumpe 2');
defExamTask({ id:'x_awl_p_hydraulik_udt', quest:'awl', level:'profi', ch:13, diff:1,
  params:{ N:[1, 2] },
  title:'Pumpendaten im Datenbaustein',
  brief: p => 'Der Global-DB <code>DB_Hydraulik</code> enthält zwei Pumpen <code>P1</code> und <code>P2</code> vom PLC-Datentyp <code>UDT_Pumpe</code>. Programmiere <code>Main</code>:<br>• <code>"Anzeige"</code> := Druck der Pumpe <b>' + p.N + '</b><br>• <code>"Lampe_Rot"</code> = Störung von <code>P1</code> ODER Störung von <code>P2</code><br>Zugriff z. B. mit <code>"DB_Hydraulik".P1.Druck</code>.',
  blocks: p => [
    { name:'UDT_Pumpe', kind:'UDT', src: PU_UDT },
    { name:'DB_Hydraulik', kind:'DB', src: HY_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Anzeige\nL  "DB_Hydraulik".P' + p.N + '.Druck\nT  "Anzeige"\n\nNETWORK Sammelstoerung\nO  "DB_Hydraulik".P1.Stoerung\nO  "DB_Hydraulik".P2.Stoerung\n=  "Lampe_Rot"') }
  ],
  globals: () => ({ Anzeige:0, Lampe_Rot:false }),
  must:['MEMBER'],
  visible: p => ({ tests:[[{ ['DB_Hydraulik.P' + p.N + '.Druck']:180 }, { Anzeige:180, Lampe_Rot:false }]] }),
  hidden: p => ({
    tests:[
      [{ 'DB_Hydraulik.P1.Druck':150, 'DB_Hydraulik.P2.Druck':210 }, { Anzeige: p.N === 1 ? 150 : 210, Lampe_Rot:false }],
      [{ 'DB_Hydraulik.P1.Druck':95, 'DB_Hydraulik.P2.Druck':0, Anzeige:7 }, { Anzeige: p.N === 1 ? 95 : 0 }],
      [{ 'DB_Hydraulik.P1.Stoerung':true }, { Lampe_Rot:true }],
      [{ 'DB_Hydraulik.P2.Stoerung':true }, { Lampe_Rot:true }],
      [{ 'DB_Hydraulik.P1.Stoerung':true, 'DB_Hydraulik.P2.Stoerung':true }, { Lampe_Rot:true }],
      [{ 'DB_Hydraulik.P1.Laeuft':true, 'DB_Hydraulik.P2.Laeuft':true, Lampe_Rot:true }, { Lampe_Rot:false }]
    ]
  }),
  wrong:[
    p => ({ Main: MAIN('L  "DB_Hydraulik".P' + (3 - p.N) + '.Druck\nT  "Anzeige"\nO  "DB_Hydraulik".P1.Stoerung\nO  "DB_Hydraulik".P2.Stoerung\n=  "Lampe_Rot"') }),
    p => ({ Main: MAIN('L  "DB_Hydraulik".P' + p.N + '.Druck\nT  "Anzeige"\nU  "DB_Hydraulik".P1.Stoerung\nU  "DB_Hydraulik".P2.Stoerung\n=  "Lampe_Rot"') })
  ]
});

const OFEN_DB = aDB('DB_Ofen', 'Zone:Array[1..3] of Int|Temperatur je Ofenzone in °C');
const MITTEL = (gr, cmp, div) => 'NETWORK Mittelwert\nL  "DB_Ofen".Zone[1]\nL  "DB_Ofen".Zone[2]\n+I\nL  "DB_Ofen".Zone[3]\n+I\nL  ' + (div || 3) + '\n/I\nT  "Temp_Mittel"\n\nNETWORK Grenzwert\nL  "Temp_Mittel"\nL  ' + gr + '\n' + (cmp || '>I') + '\n=  "Zu_heiss"';
defExamTask({ id:'x_awl_p_ofenzonen', quest:'awl', level:'profi', ch:13, diff:2,
  params:{ GR:[1200, 1250] },
  title:'Mittlere Ofentemperatur (Array)',
  brief: p => 'Der Global-DB <code>DB_Ofen</code> enthält <code>Zone : Array[1..3] of Int</code>. Programmiere <code>Main</code>:<br>• <code>"Temp_Mittel"</code> := (Zone[1] + Zone[2] + Zone[3]) / 3 (Ganzzahldivision)<br>• <code>"Zu_heiss"</code> = 1, wenn <code>"Temp_Mittel"</code> grösser als <b>' + p.GR + '</b> ist.',
  blocks: p => [
    { name:'DB_Ofen', kind:'DB', src: OFEN_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(MITTEL(p.GR)) }
  ],
  globals: () => ({ Temp_Mittel:0, Zu_heiss:false }),
  must:['ARRAY', '/I', 'CMP_I'],
  visible: p => ({ tests:[[{ 'DB_Ofen.Zone[1]':1100, 'DB_Ofen.Zone[2]':1150, 'DB_Ofen.Zone[3]':1200 }, { Temp_Mittel:1150, Zu_heiss:false }]] }),
  hidden: p => ({
    tests:[
      [{ 'DB_Ofen.Zone[1]':1180, 'DB_Ofen.Zone[2]':1190, 'DB_Ofen.Zone[3]':1210 }, { Temp_Mittel:1193 }],
      [{ 'DB_Ofen.Zone[1]':p.GR, 'DB_Ofen.Zone[2]':p.GR, 'DB_Ofen.Zone[3]':p.GR }, { Temp_Mittel:p.GR, Zu_heiss:false }],
      [{ 'DB_Ofen.Zone[1]':p.GR, 'DB_Ofen.Zone[2]':p.GR, 'DB_Ofen.Zone[3]':p.GR + 3 }, { Temp_Mittel:p.GR + 1, Zu_heiss:true }],
      [{ 'DB_Ofen.Zone[1]':900, 'DB_Ofen.Zone[2]':0, 'DB_Ofen.Zone[3]':0 }, { Temp_Mittel:300, Zu_heiss:false }],
      [{ 'DB_Ofen.Zone[1]':0, 'DB_Ofen.Zone[2]':0, 'DB_Ofen.Zone[3]':1300 }, { Temp_Mittel:433 }],
      [{ 'DB_Ofen.Zone[1]':1400, 'DB_Ofen.Zone[2]':1350, 'DB_Ofen.Zone[3]':1300 }, { Temp_Mittel:1350, Zu_heiss:true }]
    ]
  }),
  wrong:[
    p => ({ Main: MAIN(MITTEL(p.GR, '>=I')) }),
    p => ({ Main: MAIN('L  "DB_Ofen".Zone[1]\nL  "DB_Ofen".Zone[2]\n+I\nL  2\n/I\nT  "Temp_Mittel"\nL  "Temp_Mittel"\nL  ' + p.GR + '\n>I\n=  "Zu_heiss"') }),
    p => ({ Main: MAIN(MITTEL(p.GR, null, 2)) })
  ]
});

// ---- Kapitel 14 ----
const ME_D = { in:'Signal:Bool|Störsignal; Quit:Bool|Quittieren', out:'Hupe:Bool; Lampe:Bool', stat:'M_Signal:Bool|Flankenmerker' };
const ME_BODY = 'NETWORK Neue Meldung\nU  #Signal\nFP #M_Signal\nS  #Hupe\nU  #Quit\nR  #Hupe\n\nNETWORK Lampe\nU  #Signal\nO  #Hupe\n=  #Lampe';
const ME_MAIN = 'NETWORK Oeldruck\nCALL "FB_Meldung", "Oel_DB"\n   Signal := "Oeldruck_tief"\n   Quit := "Quittieren"\n   Hupe => "Hupe_Oel"\n   Lampe => "Lampe_Oel"\n\nNETWORK Wasser\nCALL "FB_Meldung", "Wasser_DB"\n   Signal := "Wasser_fehlt"\n   Quit := "Quittieren"\n   Hupe => "Hupe_Wasser"\n   Lampe => "Lampe_Wasser"';
defExamTask({ id:'x_awl_p_meldung', quest:'awl', level:'profi', ch:14, diff:2,
  title:'Standard-Meldebaustein',
  brief: () => 'Programmiere den Standardbaustein <code>FB_Meldung</code>:<br>• Eine <b>neue</b> Meldung (steigende Flanke von <code>#Signal</code>, Merker <code>#M_Signal</code>) setzt <code>#Hupe</code>.<br>• <code>#Quit</code> setzt <code>#Hupe</code> zurück (Rücksetzen zuletzt). Die Hupe kommt erst bei der nächsten neuen Meldung wieder.<br>• <code>#Lampe</code> leuchtet, solange <code>#Signal</code> ansteht <b>oder</b> die Hupe noch nicht quittiert ist.<br><code>Main</code> (🔒) nutzt den FB für Öldruck und Kühlwasser.',
  blocks: () => [
    { name:'FB_Meldung', kind:'FB', edit:true, start: aFB('FB_Meldung', ME_D, ''), ref: aFB('FB_Meldung', ME_D, ME_BODY) },
    { name:'Main', kind:'OB', src: MAIN(ME_MAIN) }
  ],
  globals: () => ({ Oeldruck_tief:false, Wasser_fehlt:false, Quittieren:false, Hupe_Oel:false, Lampe_Oel:false, Hupe_Wasser:false, Lampe_Wasser:false }),
  instances: () => ({ Oel_DB:'FB_Meldung', Wasser_DB:'FB_Meldung' }),
  must:['FP', 'S', 'R'],
  visible: () => ({ timed:[{ steps:[[0.1,{ Oeldruck_tief:true },{ Hupe_Oel:true, Lampe_Oel:true, Hupe_Wasser:false }],[0.1,{ Quittieren:true },{ Hupe_Oel:false, Lampe_Oel:true }]] }] }),
  hidden: () => ({
    unit:[{ block:'FB_Meldung', steps:[[0.1,{ Signal:true, Quit:false },{ Hupe:true, Lampe:true }],[0.1,{ Signal:false },{ Hupe:true, Lampe:true }],[0.1,{ Quit:true },{ Hupe:false, Lampe:false }],[0.1,{ Quit:false, Signal:true },{ Hupe:true }],[0.1,{ Quit:true },{ Hupe:false, Lampe:true }],[0.1,{ Quit:false },{ Hupe:false, Lampe:true }],[0.1,{ Signal:false },{ Hupe:false, Lampe:false }]] }],
    timed:[{ steps:[[0.1,{ Wasser_fehlt:true },{ Hupe_Wasser:true, Hupe_Oel:false, Lampe_Oel:false }],[0.1,{ Quittieren:true, Oeldruck_tief:true },{ Hupe_Wasser:false, Hupe_Oel:false, Lampe_Oel:true }],[0.1,{ Quittieren:false },{ Hupe_Oel:false, Lampe_Wasser:true }]] }]
  }),
  wrong:[
    () => ({ FB_Meldung: aFB('FB_Meldung', ME_D, 'U  #Signal\nS  #Hupe\nU  #Quit\nR  #Hupe\nU  #Signal\nO  #Hupe\n=  #Lampe') }),
    () => ({ FB_Meldung: aFB('FB_Meldung', ME_D, 'U  #Signal\nFP #M_Signal\nS  #Hupe\nU  #Quit\nR  #Hupe\nU  #Signal\n=  #Lampe') })
  ]
});

const WS_D = { in:'Soll:Int|mm; Ist:Int|mm; Freigabe:Bool', out:'Auf:Bool|Spalt öffnen; Zu:Bool|Spalt schliessen; In_Pos:Bool', temp:'Unten:Int; Oben:Int' };
const WS_BODY = (tb, o) => { o = o || {};
  return 'NETWORK Grenzen\nL  #Soll\nL  ' + tb + '\n-I\nT  #Unten\nL  #Soll\nL  ' + tb + '\n+I\nT  #Oben\n\n' +
    'NETWORK Auf\nU  #Freigabe\n' + (o.noKl ? 'L  #Ist\nL  #Unten\n<I\n' : 'U(\nL  #Ist\nL  #Unten\n' + (o.cmpLo || '<I') + '\n)\n') + '=  #' + (o.swap ? 'Zu' : 'Auf') + '\n\n' +
    'NETWORK Zu\nU  #Freigabe\nU(\nL  #Ist\nL  #Oben\n>I\n)\n=  #' + (o.swap ? 'Auf' : 'Zu') + '\n\n' +
    'NETWORK In Position\nL  #Ist\nL  #Unten\n>=I\nU(\nL  #Ist\nL  #Oben\n<=I\n)\n=  #In_Pos'; };
defExamTask({ id:'x_awl_p_walzspalt', quest:'awl', level:'profi', ch:14, diff:3,
  params:{ TB:[1, 2] },
  title:'Walzspalt nachstellen (Standard-FB)',
  brief: p => 'Programmiere <code>FB_Walzspalt</code> mit einem Totband von <b>±' + p.TB + ' mm</b>:<br>• <code>#Auf</code> = 1, wenn <code>#Freigabe</code> = 1 und <code>#Ist</code> kleiner als <code>#Soll</code> − ' + p.TB + ' ist.<br>• <code>#Zu</code> = 1, wenn <code>#Freigabe</code> = 1 und <code>#Ist</code> grösser als <code>#Soll</code> + ' + p.TB + ' ist.<br>• <code>#In_Pos</code> = 1, wenn <code>#Ist</code> im Band <code>#Soll</code> ± ' + p.TB + ' liegt (Grenzen eingeschlossen, unabhängig von der Freigabe).<br>Die Grenzen kannst du in den TEMP-Variablen <code>#Unten</code> und <code>#Oben</code> vorberechnen.',
  blocks: p => [
    { name:'FB_Walzspalt', kind:'FB', edit:true, start: aFB('FB_Walzspalt', WS_D, ''), ref: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB)) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Walzspalt", "Geruest1_DB"\n   Soll := "Spalt_Soll"\n   Ist := "Spalt_Ist"\n   Freigabe := "Walzen"\n   Auf => "Spalt_auf"\n   Zu => "Spalt_zu"\n   In_Pos => "Lampe_Gruen"') }
  ],
  globals: () => ({ Spalt_Soll:0, Spalt_Ist:0, Walzen:false, Spalt_auf:false, Spalt_zu:false, Lampe_Gruen:false }),
  instances: () => ({ Geruest1_DB:'FB_Walzspalt' }),
  must:['CMP_I', 'KLAMMER'],
  visible: p => ({ tests:[[{ Spalt_Soll:20, Spalt_Ist:10, Walzen:true }, { Spalt_auf:true, Spalt_zu:false, Lampe_Gruen:false }], [{ Spalt_Soll:20, Spalt_Ist:20, Walzen:true }, { Spalt_auf:false, Spalt_zu:false, Lampe_Gruen:true }]] }),
  hidden: p => ({
    unit:[{ block:'FB_Walzspalt', steps:[
      [0.1,{ Soll:30, Ist:30 - p.TB, Freigabe:true },{ Auf:false, Zu:false, In_Pos:true }],
      [0.1,{ Soll:30, Ist:29 - p.TB, Freigabe:true },{ Auf:true, Zu:false, In_Pos:false }],
      [0.1,{ Soll:30, Ist:30 + p.TB, Freigabe:true },{ Auf:false, Zu:false, In_Pos:true }],
      [0.1,{ Soll:30, Ist:31 + p.TB, Freigabe:true },{ Auf:false, Zu:true, In_Pos:false }],
      [0.1,{ Soll:30, Ist:5, Freigabe:false },{ Auf:false, Zu:false, In_Pos:false }],
      [0.1,{ Soll:30, Ist:60, Freigabe:false },{ Auf:false, Zu:false, In_Pos:false }],
      [0.1,{ Soll:30, Ist:30, Freigabe:false },{ Auf:false, Zu:false, In_Pos:true }]
    ] }]
  }),
  wrong:[
    p => ({ FB_Walzspalt: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB, { noKl:true })) }),
    p => ({ FB_Walzspalt: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB, { cmpLo:'<=I' })) }),
    p => ({ FB_Walzspalt: aFB('FB_Walzspalt', WS_D, WS_BODY(p.TB, { swap:true })) })
  ]
});

const RG_D = { in:'Vor:Bool; Rueck:Bool; Freigabe:Bool', out:'Mot_Vor:Bool; Mot_Rueck:Bool' };
defExamTask({ id:'x_awl_p_rollgang_fc', quest:'awl', level:'profi', ch:14, diff:1,
  title:'Tipp-Rollgang mit Verriegelung (FC)',
  brief: () => 'Programmiere den Standardbaustein <code>FC_Rollgang</code> (Tippbetrieb, ohne Selbsthaltung):<br>• <code>#Mot_Vor</code> = <code>#Freigabe</code> UND <code>#Vor</code> UND NICHT <code>#Rueck</code><br>• <code>#Mot_Rueck</code> = <code>#Freigabe</code> UND <code>#Rueck</code> UND NICHT <code>#Vor</code><br>Sind beide Taster gedrückt, läuft nichts (gegenseitige Verriegelung).',
  blocks: () => [
    { name:'FC_Rollgang', kind:'FC', edit:true, start: aFC('FC_Rollgang', 'Void', RG_D, ''), ref: aFC('FC_Rollgang', 'Void', RG_D, 'U  #Freigabe\nU  #Vor\nUN #Rueck\n=  #Mot_Vor\nU  #Freigabe\nU  #Rueck\nUN #Vor\n=  #Mot_Rueck') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Rollgang"\n   Vor := "S_Vor"\n   Rueck := "S_Rueck"\n   Freigabe := "Not_Aus_OK"\n   Mot_Vor => "Rollgang_Vor"\n   Mot_Rueck => "Rollgang_Rueck"') }
  ],
  globals: () => ({ S_Vor:false, S_Rueck:false, Not_Aus_OK:true, Rollgang_Vor:false, Rollgang_Rueck:false }),
  must:['UN'],
  visible: () => ({ tests:[[{ S_Vor:true }, { Rollgang_Vor:true, Rollgang_Rueck:false }]] }),
  hidden: () => ({
    unit:[{ block:'FC_Rollgang', steps: combos(['Vor', 'Rueck', 'Freigabe'], e => ({ Mot_Vor: e.Freigabe && e.Vor && !e.Rueck, Mot_Rueck: e.Freigabe && e.Rueck && !e.Vor })) }],
    tests:[[{ S_Rueck:true }, { Rollgang_Vor:false, Rollgang_Rueck:true }], [{ S_Vor:true, Not_Aus_OK:false }, { Rollgang_Vor:false }]]
  }),
  wrong:[
    () => ({ FC_Rollgang: aFC('FC_Rollgang', 'Void', RG_D, 'U  #Freigabe\nU  #Vor\n=  #Mot_Vor\nU  #Freigabe\nU  #Rueck\n=  #Mot_Rueck') }),
    () => ({ FC_Rollgang: aFC('FC_Rollgang', 'Void', RG_D, 'U  #Vor\nUN #Rueck\n=  #Mot_Vor\nU  #Rueck\nUN #Vor\n=  #Mot_Rueck') })
  ]
});

// ---- Kapitel 15 ----
const START = body => aOB('Startup', body);
const WW_DB = aDB('DB_Walzwerk', 'Temp_Soll:Int := 1000|°C; Betriebsart:Int := 0; Stueck:Int := 45|Stand vor dem Abschalten');
const WW_MAIN = 'NETWORK Stueck zaehlen\nU  "Block_raus"\nFP "M_Block"\nSPBN ANZ\nL  "DB_Walzwerk".Stueck\nINC 1\nT  "DB_Walzwerk".Stueck\n\nNETWORK Anzeige\nANZ: L  "DB_Walzwerk".Stueck\nT  "Anzeige"';
const WW_START = (soll, ba, o) => { o = o || {};
  return 'NETWORK Parameter\nL  ' + soll + '\nT  "DB_Walzwerk".' + (o.swap ? 'Betriebsart' : 'Temp_Soll') + '\nL  ' + ba + '\nT  "DB_Walzwerk".' + (o.swap ? 'Temp_Soll' : 'Betriebsart') + '\n' +
    (o.noZero ? '' : 'L  0\nT  "DB_Walzwerk".Stueck\n') + '\nNETWORK Ausgaenge\nSET\nR  "Rollgang"\n=  "Lampe_Gelb"'; };
defExamTask({ id:'x_awl_p_anlauf_ob100', quest:'awl', level:'profi', ch:15, diff:2,
  params:{ SOLL:[1150, 1200], BA:[1, 2] },
  title:'Definierter Anlauf (OB100)',
  brief: p => 'Programmiere den Anlauf-OB <code>Startup</code> (OB100). Er läuft <b>einmal</b> vor dem ersten Zyklus und soll:<br>• <code>"DB_Walzwerk".Temp_Soll</code> := <b>' + p.SOLL + '</b><br>• <code>"DB_Walzwerk".Betriebsart</code> := <b>' + p.BA + '</b><br>• <code>"DB_Walzwerk".Stueck</code> := 0<br>• <code>"Rollgang"</code> zurücksetzen und <code>"Lampe_Gelb"</code> einschalten (z. B. mit <code>SET</code>).<br><code>Main</code> (🔒) zählt danach die Blöcke im DB.',
  blocks: p => [
    { name:'DB_Walzwerk', kind:'DB', src: WW_DB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START(WW_START(p.SOLL, p.BA)) },
    { name:'Main', kind:'OB', src: MAIN(WW_MAIN) }
  ],
  globals: () => ({ Block_raus:false, M_Block:false, Anzeige:0, Rollgang:true, Lampe_Gelb:false }),
  must:['STARTUP', 'T'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{ 'DB_Walzwerk.Temp_Soll':p.SOLL, 'DB_Walzwerk.Stueck':0, Anzeige:0 }]] }] }),
  hidden: p => ({
    timed:[
      { steps:[[0.1,{},{ 'DB_Walzwerk.Temp_Soll':p.SOLL, 'DB_Walzwerk.Betriebsart':p.BA, 'DB_Walzwerk.Stueck':0, Anzeige:0, Rollgang:false, Lampe_Gelb:true }],[0.1,{ Block_raus:true },{ 'DB_Walzwerk.Stueck':1, Anzeige:1 }],[0.1,{ Block_raus:false, Rollgang:true },{ Rollgang:true, 'DB_Walzwerk.Stueck':1 }],[0.1,{ Block_raus:true },{ 'DB_Walzwerk.Stueck':2, Anzeige:2 }]] },
      { steps:[[0.1,{ Block_raus:true },{ 'DB_Walzwerk.Stueck':1, Anzeige:1, Lampe_Gelb:true }],[0.1,{ Lampe_Gelb:false },{ Lampe_Gelb:false, 'DB_Walzwerk.Betriebsart':p.BA }]] }
    ]
  }),
  wrong:[
    p => ({ Startup: START(WW_START(p.SOLL, p.BA, { noZero:true })) }),
    p => ({ Startup: START(WW_START(p.SOLL, p.BA, { swap:true })) }),
    p => ({ Startup: START('L  ' + p.SOLL + '\nT  "DB_Walzwerk".Temp_Soll\nL  ' + p.BA + '\nT  "DB_Walzwerk".Betriebsart\nL  0\nT  "DB_Walzwerk".Stueck') })
  ]
});

const FR_FC = aFC('FC_Freigabe', 'Void', { in:'Not_Aus_OK:Bool; Oel_OK:Bool', out:'Frei:Bool' }, 'U  #Not_Aus_OK\nU  #Oel_OK\n=  #Frei');
const MO_FB = aFB('FB_Motor', { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool' }, 'U(\nO  #Start\nO  #Laeuft\n)\nUN #Stopp\nU  #Freigabe\n=  #Laeuft');
const ST_CALLS = n => ({
  fr: 'NETWORK Freigabe\nCALL "FC_Freigabe"\n   Not_Aus_OK := "Not_Aus_OK"\n   Oel_OK := "Oel_OK"\n   Frei => "Frei"',
  wa: 'NETWORK Walzen\nCALL "FB_Motor", "Walzen' + n + '_DB"\n   Start := "S_Walzen_Ein"\n   Stopp := "S_Walzen_Aus"\n   Freigabe := "Frei"\n   Laeuft => "Walzen_' + n + '"',
  ro: 'NETWORK Rollgang\nCALL "FB_Motor", "Rollgang' + n + '_DB"\n   Start := "S_Roll_Ein"\n   Stopp := "S_Roll_Aus"\n   Freigabe := "Walzen_' + n + '"\n   Laeuft => "Rollgang_' + n + '"'
});
defExamTask({ id:'x_awl_p_ob1_struktur', quest:'awl', level:'profi', ch:15, diff:3,
  params:{ N:[1, 2] },
  title:'OB1 nach Programmierstandard',
  brief: p => 'Gerüst ' + p.N + ' bekommt einen aufgeräumten <code>Main</code> (OB1), der nur Bausteine aufruft – in der <b>richtigen Reihenfolge</b>, damit kein Signal einen Zyklus zu spät kommt:<br>1. <code>"FC_Freigabe"</code>: <code>Not_Aus_OK := "Not_Aus_OK"</code>, <code>Oel_OK := "Oel_OK"</code>, <code>Frei => "Frei"</code><br>2. <code>"FB_Motor"</code> mit Instanz <code>"Walzen' + p.N + '_DB"</code>: <code>Start := "S_Walzen_Ein"</code>, <code>Stopp := "S_Walzen_Aus"</code>, <code>Freigabe := "Frei"</code>, <code>Laeuft => "Walzen_' + p.N + '"</code><br>3. <code>"FB_Motor"</code> mit Instanz <code>"Rollgang' + p.N + '_DB"</code>: <code>Start := "S_Roll_Ein"</code>, <code>Stopp := "S_Roll_Aus"</code>, <code>Freigabe := "Walzen_' + p.N + '"</code>, <code>Laeuft => "Rollgang_' + p.N + '"</code>',
  blocks: p => { const c = ST_CALLS(p.N); return [
    { name:'FC_Freigabe', kind:'FC', src: FR_FC },
    { name:'FB_Motor', kind:'FB', src: MO_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(c.fr + '\n\n' + c.wa + '\n\n' + c.ro) }
  ]; },
  globals: p => ({ Not_Aus_OK:true, Oel_OK:true, Frei:false, S_Walzen_Ein:false, S_Walzen_Aus:false, S_Roll_Ein:false, S_Roll_Aus:false, ['Walzen_' + p.N]:false, ['Rollgang_' + p.N]:false }),
  instances: p => ({ ['Walzen' + p.N + '_DB']:'FB_Motor', ['Rollgang' + p.N + '_DB']:'FB_Motor' }),
  must:['CALL', 'FC_CALL', 'SINGLE'],
  visible: p => ({ timed:[{ steps:[[0.1,{ S_Walzen_Ein:true },{ ['Walzen_' + p.N]:true }],[0.1,{ S_Walzen_Ein:false, S_Roll_Ein:true },{ ['Walzen_' + p.N]:true, ['Rollgang_' + p.N]:true }]] }] }),
  hidden: p => { const W = 'Walzen_' + p.N, R = 'Rollgang_' + p.N; return {
    timed:[
      { steps:[[0.1,{ S_Walzen_Ein:true },{ [W]:true, [R]:false }],[0.1,{ S_Walzen_Ein:false, S_Roll_Ein:true },{ [W]:true, [R]:true }],[0.1,{ S_Roll_Ein:false, Not_Aus_OK:false },{ [W]:false, [R]:false, Frei:false }],[0.1,{ Not_Aus_OK:true },{ [W]:false, [R]:false }]] },
      { steps:[[0.1,{ S_Roll_Ein:true },{ [R]:false }],[0.1,{ S_Walzen_Ein:true },{ [W]:true, [R]:true }],[0.1,{ S_Walzen_Ein:false, S_Roll_Ein:false, S_Walzen_Aus:true },{ [W]:false, [R]:false }]] },
      { steps:[[0.1,{ Oel_OK:false, S_Walzen_Ein:true },{ [W]:false }],[0.1,{ Oel_OK:true },{ [W]:true, Frei:true }]] }
    ] }; },
  wrong:[
    p => { const c = ST_CALLS(p.N); return { Main: MAIN(c.wa + '\n\n' + c.ro + '\n\n' + c.fr) }; },
    p => { const c = ST_CALLS(p.N); return { Main: MAIN(c.fr + '\n\n' + c.ro + '\n\n' + c.wa) }; },
    p => { const c = ST_CALLS(p.N); return { Main: MAIN(c.fr + '\n\n' + c.wa) }; }
  ]
});

/* =====================================================================
   Fragen Grundstufe
   ===================================================================== */
const Q = (id, level, ch, q, options, answer) => defExamQuestion({ id, quest:'awl', level, ch, q, options, answer });
const G = (id, ch, q, o, a) => Q(id, 'grund', ch, q, o, a || 0);
const P = (id, ch, q, o, a) => Q(id, 'profi', ch, q, o, a || 0);

// Kapitel 1
G('xq_awl_g_erstabfrage', 1, 'Was bewirkt die Erstabfrage nach einer Zuweisung <code>=</code>?', ['Die nächste Abfrage beginnt ein neues VKE', 'Das VKE wird gelöscht und bleibt 0', 'AKKU1 wird auf 0 gesetzt', 'Der Baustein wird beendet']);
G('xq_awl_g_abk', 1, 'Wofür steht die Abkürzung <b>AWL</b>?', ['Anweisungsliste', 'Ablaufwerkliste', 'Automatische Wertliste', 'Ausgangs-Wort-Logik']);
G('xq_awl_g_undkette', 1, '<code>Pumpe_Ein</code> = 1, <code>Oel_OK</code> = 1, <code>Gitter_zu</code> = 0. Welchen Wert hat das VKE nach <code>U Pumpe_Ein / U Oel_OK / U Gitter_zu</code>?', ['0', '1', 'Es ist unbestimmt', 'Es entspricht dem Wert von Pumpe_Ein']);
G('xq_awl_g_zuweisung', 1, 'Welche Anweisung weist das VKE einem Operanden so zu, dass dieser dem VKE in jedem Zyklus folgt?', ['<code>=</code>', '<code>S</code>', '<code>T</code>', '<code>L</code>']);
// Kapitel 2
G('xq_awl_g_un_null', 2, '<code>Gitter_offen</code> = 0. Welche Anweisung liefert als Erstabfrage ein VKE von 1?', ['<code>UN Gitter_offen</code>', '<code>U Gitter_offen</code>', '<code>O Gitter_offen</code>', '<code>X Gitter_offen</code>']);
G('xq_awl_g_xor3', 2, 'a = 1, b = 1, c = 0. Welches Ergebnis liefert <code>X a / X b / X c / = q</code>?', ['q = 0', 'q = 1', 'Fehler: X erlaubt nur zwei Operanden', 'Es hängt vom VKE vor der Kette ab']);
G('xq_awl_g_oklammer', 2, 'Welche Verknüpfung beschreibt <code>U a / O( / U b / U c / ) / = q</code>?', ['q = a ODER (b UND c)', 'q = (a ODER b) UND c', 'q = a UND b UND c', 'q = a ODER b ODER c']);
G('xq_awl_g_undvor', 2, 'Wie schreibt man „(a ODER b) UND c“ korrekt in AWL?', ['<code>U( / O a / O b / ) / U c</code>', '<code>O a / O b / U c</code>', '<code>U a / O b / U c</code>', '<code>U c / O a / O b</code>']);
// Kapitel 3
G('xq_awl_g_r_wirkung', 3, 'Was bewirkt <code>R Pumpe</code>, wenn das VKE 1 ist?', ['Pumpe wird 0 und bleibt 0, bis sie wieder gesetzt wird', 'Pumpe wird nur für einen Zyklus 0', 'Pumpe wird umgeschaltet', 'Nichts – R wirkt nur bei VKE 0']);
G('xq_awl_g_clr', 3, 'Was macht die Anweisung <code>CLR</code>?', ['Sie setzt das VKE auf 0', 'Sie löscht AKKU1', 'Sie setzt alle Merker zurück', 'Sie beendet den Baustein']);
G('xq_awl_g_gleich_s', 3, 'Worin unterscheiden sich <code>= Pumpe</code> und <code>S Pumpe</code>?', ['<code>=</code> schreibt das VKE in jedem Zyklus, <code>S</code> schreibt nur bei VKE 1 eine 1 und hält sie', 'Es gibt keinen Unterschied', '<code>S</code> schreibt das VKE in jedem Zyklus, <code>=</code> speichert', '<code>=</code> funktioniert nur mit Ausgängen, <code>S</code> nur mit Merkern']);
G('xq_awl_g_rdominant', 3, 'In welcher Reihenfolge stehen die Anweisungen bei einem <b>rücksetzdominanten</b> Speicher?', ['Zuerst die S-Kette, danach die R-Kette', 'Zuerst die R-Kette, danach die S-Kette', 'Die Reihenfolge spielt keine Rolle', 'S und R dürfen nicht auf denselben Operanden wirken']);
// Kapitel 4
G('xq_awl_g_fm_wert', 4, '<code>U Block / FP M_Block</code>: <code>Block</code> ist seit mehreren Zyklen 1. Welchen Wert hat <code>M_Block</code>?', ['1 – der Merker speichert das VKE vor FP', '0 – er ist nur bei der Flanke 1', 'Er wechselt in jedem Zyklus', 'Er enthält die Anzahl der Flanken']);
G('xq_awl_g_fn_dauer0', 4, '<code>U Taster / FN M_T / = Q</code>: <code>Taster</code> ist seit dem Anlauf dauernd 0. Was gilt für <code>Q</code>?', ['Q bleibt 0', 'Q ist dauernd 1', 'Q ist in jedem zweiten Zyklus 1', 'Q ist im ersten Zyklus 1']);
G('xq_awl_g_fm_ueberschrieben', 4, 'Ein Flankenmerker wird in einem anderen Netzwerk zusätzlich mit <code>=</code> beschrieben. Folge?', ['Die Flankenerkennung wird verfälscht', 'Nichts – der Merker wird nur von FP benutzt', 'Die CPU geht in STOP', 'Die Flanke wird doppelt so lang']);
G('xq_awl_g_ls_frei', 4, 'Welche Anweisungsfolge liefert einen Impuls, wenn die Lichtschranke <code>LS</code> <b>frei wird</b> (1 → 0)?', ['<code>U LS / FN M_LS</code>', '<code>UN LS / FN M_LS</code>', '<code>U LS / FP M_LS</code>', '<code>FN LS</code>']);
// Kapitel 5
G('xq_awl_g_sa_art', 5, 'Welche S5-Zeit ist eine <b>Ausschaltverzögerung</b>?', ['SA', 'SE', 'SI', 'SV']);
G('xq_awl_g_sv_si', 5, 'Worin unterscheidet sich <code>SV</code> von <code>SI</code>?', ['SV läuft die volle Zeit, auch wenn das VKE vorher 0 wird', 'SV verzögert das Einschalten, SI das Ausschalten', 'SI läuft immer die volle Zeit, SV nicht', 'Es gibt keinen Unterschied']);
G('xq_awl_g_s5t_min', 5, 'Mit welcher Anweisung lädst du einen Zeitwert von 1 Minute 30 Sekunden?', ['<code>L S5T#1M30S</code>', '<code>L S5T#1,5M</code>', '<code>L 90</code>', '<code>L T1#90</code>']);
G('xq_awl_g_s5t_max', 5, 'Welcher Zeitwert ist bei einer S5-Zeit (S5TIME) höchstens möglich?', ['2H46M30S', '24H', '999S', '65 535 ms']);
// Kapitel 6
G('xq_awl_g_z_bereich', 6, 'Welchen Wertebereich hat ein S5-Zähler (Z1 …)?', ['0 … 999', '0 … 255', '−32 768 … 32 767', '0 … 65 535']);
G('xq_awl_g_zv_flanke', 6, 'Wann zählt <code>ZV Z1</code> um 1 vorwärts?', ['Bei einer steigenden Flanke des VKE', 'In jedem Zyklus, in dem das VKE 1 ist', 'Bei einer fallenden Flanke des VKE', 'Nur nach einem Setzen mit S Z1']);
G('xq_awl_g_z_999', 6, 'Z1 steht auf 999. Was passiert bei einer weiteren Flanke an <code>ZV Z1</code>?', ['Der Zählwert bleibt 999', 'Der Zählwert springt auf 0', 'Der Zählwert wird 1000', 'Die CPU geht in STOP']);
G('xq_awl_g_l_z', 6, 'Was steht nach <code>L Z1</code> in AKKU1?', ['Der aktuelle Zählwert als Ganzzahl', 'Nur das Zählerbit (0 oder 1)', 'Der Startwert des Zählers', 'Die Anzahl Zyklen seit dem Anlauf']);
// Kapitel 7
G('xq_awl_g_akku', 7, 'Nach <code>L 5</code> und <code>L 8</code>: Was steht in AKKU1 und AKKU2?', ['AKKU1 = 8, AKKU2 = 5', 'AKKU1 = 5, AKKU2 = 8', 'AKKU1 = 13, AKKU2 = 0', 'AKKU1 = 8, AKKU2 = 0']);
G('xq_awl_g_t_befehl', 7, 'Welche Anweisung speichert den Inhalt von AKKU1 in einer Variable?', ['<code>T</code>', '<code>L</code>', '<code>=</code>', '<code>S</code>']);
G('xq_awl_g_l_schiebt', 7, 'Was passiert beim Laden (<code>L</code>) mit dem bisherigen Inhalt von AKKU1?', ['Er wird nach AKKU2 geschoben', 'Er wird dazuaddiert', 'Er geht verloren, AKKU2 bleibt unverändert', 'Er wird in das VKE geschrieben']);
G('xq_awl_g_tak_x', 7, '<code>L 3 / L 4 / TAK / T x</code>. Welchen Wert hat x?', ['3', '4', '7', '0']);
// Kapitel 8
G('xq_awl_g_minus', 8, '<code>L 4 / L 10 / -I / T x</code>. Welchen Wert hat x?', ['−6', '6', '14', '0']);
G('xq_awl_g_itd', 8, 'Was bewirkt <code>ITD</code>?', ['Es wandelt eine INT (16 Bit) in eine DINT (32 Bit)', 'Es wandelt eine INT in eine REAL', 'Es dividiert zwei Ganzzahlen', 'Es rundet eine REAL']);
G('xq_awl_g_ueberlauf', 8, 'Was passiert bei <code>+I</code>, wenn das Ergebnis 32 767 überschreitet?', ['Es entsteht ein Überlauf (OV/OS), das Ergebnis ist nicht mehr korrekt', 'Die CPU rechnet automatisch mit DINT weiter', 'Das Ergebnis bleibt bei 32 767 stehen', 'Der Wert wird als REAL gespeichert']);
G('xq_awl_g_trunc', 8, 'Welchen Wert liefert <code>TRUNC</code> für die REAL-Zahl −2,7?', ['−2', '−3', '3', '−2,7']);
// Kapitel 9
G('xq_awl_g_kleiner', 9, '<code>L Druck / L 200 / &lt;I</code>. Wann ist das VKE danach 1?', ['Wenn Druck kleiner als 200 ist', 'Wenn 200 kleiner als Druck ist', 'Wenn Druck gleich 200 ist', 'Immer, wenn Druck ungleich 0 ist']);
G('xq_awl_g_klammer_vgl', 9, 'Ein Vergleichsergebnis soll mit einer vorher abgefragten Bedingung per UND verknüpft werden. Wie geht das sicher?', ['Den Vergleich in <code>U(</code> … <code>)</code> einklammern', 'Den Vergleich direkt nach der Abfrage schreiben', 'Nach dem Vergleich <code>NOT</code> schreiben', 'Das geht in AWL nicht']);
G('xq_awl_g_real_gleich', 9, 'Mit welchem Vergleich prüft man zwei REAL-Werte auf Gleichheit?', ['<code>==R</code>', '<code>==I</code>', '<code>==D</code>', '<code>=R</code>']);
G('xq_awl_g_vgl_null', 9, '<code>Temp</code> = 1250. Welcher Vergleich nach <code>L Temp / L 1250</code> ergibt VKE = 0?', ['<code>&lt;&gt;I</code>', '<code>==I</code>', '<code>&gt;=I</code>', '<code>&lt;=I</code>']);
// Kapitel 10
G('xq_awl_g_bea', 10, 'Was bewirkt <code>BEA</code>?', ['Die Bearbeitung des Bausteins wird unbedingt beendet', 'Der Baustein wird nur bei VKE 1 beendet', 'Es wird an den Anfang des Bausteins gesprungen', 'Die CPU geht in STOP']);
G('xq_awl_g_loop', 10, 'Was macht <code>LOOP M1</code>?', ['Es vermindert AKKU1 um 1 und springt nach M1, solange AKKU1 nicht 0 ist', 'Es springt immer nach M1', 'Es erhöht AKKU1 um 1 und springt, bis 100 erreicht ist', 'Es wiederholt den ganzen Baustein']);
G('xq_awl_g_marke_len', 10, 'Wie viele Zeichen darf eine Sprungmarke in AWL (S7-300/400) höchstens haben?', ['4', '8', '16', 'Beliebig viele']);
G('xq_awl_g_beb', 10, 'Unter welcher Bedingung beendet die Anweisung <code>BEB</code> die Bearbeitung des Bausteins?', ['Wenn das VKE 1 ist', 'Wenn das VKE 0 ist', 'Immer', 'Wenn AKKU1 0 ist']);

/* =====================================================================
   Fragen Profi-Stufe
   ===================================================================== */
// Kapitel 11
P('xq_awl_p_retval', 11, 'Wie schreibt man in AWL den Rückgabewert einer FC mit Rückgabetyp Int?', ['<code>L Wert / T #RET_VAL</code>', '<code>= #RET_VAL</code>', '<code>S #RET_VAL</code>', '<code>RETURN Wert</code>']);
P('xq_awl_p_temp_fc', 11, 'Was gilt für die temporären Variablen (Temp) einer FC?', ['Sie gelten nur während eines Aufrufs – beim nächsten Aufruf ist ihr Wert nicht gesichert', 'Sie behalten ihren Wert bis zum nächsten Aufruf', 'Sie werden im Instanz-DB gespeichert', 'Sie sind für alle Bausteine sichtbar']);
P('xq_awl_p_fc_param', 11, 'Beim Aufruf einer FC wird ein Eingangsparameter nicht versorgt. Was passiert?', ['Der Aufruf ist fehlerhaft – bei einer FC müssen alle Parameter versorgt werden', 'Der Parameter behält seinen letzten Wert', 'Der Parameter wird automatisch 0', 'Die FC wird übersprungen']);
P('xq_awl_p_raute', 11, 'Wofür steht das Zeichen <code>#</code> vor einem Operanden, z. B. <code>U #Start</code>?', ['Für eine lokale Variable aus der Bausteinschnittstelle', 'Für einen globalen Merker', 'Für eine Konstante', 'Für einen Eingang der Peripherie']);
P('xq_awl_p_inout', 11, 'Welcher Schnittstellenbereich wird im Baustein gelesen <b>und</b> beschrieben und wirkt auf den Aktualparameter zurück?', ['InOut (VAR_IN_OUT)', 'Input (VAR_INPUT)', 'Temp (VAR_TEMP)', 'Constant']);
P('xq_awl_p_fc_global', 11, 'Warum sollte eine FC Signale über Parameter erhalten statt globale Operanden direkt abzufragen?', ['Damit sie mehrfach mit verschiedenen Signalen verwendet werden kann', 'Weil globale Operanden in einer FC verboten sind', 'Weil Parameter schneller sind als Merker', 'Damit die FC einen Instanz-DB bekommt']);
// Kapitel 12
P('xq_awl_p_fb_fc', 12, 'Worin unterscheidet sich ein FB grundsätzlich von einer FC?', ['Ein FB hat ein Gedächtnis (Instanzdaten), eine FC nicht', 'Ein FB darf keine Ausgänge haben', 'Eine FC kann nur einmal aufgerufen werden', 'Ein FB kann nicht in AWL programmiert werden']);
P('xq_awl_p_idb', 12, 'Was enthält ein Instanz-DB?', ['Die Parameter und statischen Variablen genau einer FB-Instanz', 'Alle globalen Merker der CPU', 'Den Programmcode des FB', 'Die temporären Variablen aller FCs']);
P('xq_awl_p_ton_stat', 12, 'Wie legt man eine IEC-Zeit TON als Multiinstanz in einem FB an?', ['Als statische Variable (Static) vom Typ TON', 'Als temporäre Variable vom Typ TON', 'Als Eingang vom Typ Time', 'Mit <code>SE T1</code> im FB']);
P('xq_awl_p_call_multi', 12, 'Wie ruft man die Multiinstanz <code>T_Warn</code> in AWL auf?', ['<code>CALL #T_Warn</code> mit Parameterzeilen', '<code>CALL "TON", "T_Warn"</code>', '<code>SE #T_Warn</code>', '<code>U #T_Warn</code>']);
P('xq_awl_p_idb_doppelt', 12, 'Zwei Rollgänge werden mit demselben Instanz-DB desselben FB aufgerufen. Folge?', ['Beide Aufrufe teilen sich die Daten und beeinflussen sich gegenseitig', 'Die CPU legt automatisch einen zweiten DB an', 'Nur der erste Aufruf wird ausgeführt', 'Kein Problem – jeder Aufruf hat eigene Daten']);
P('xq_awl_p_q_abfrage', 12, 'Wie fragt man im FB den Ausgang Q der Multiinstanz <code>T_Warn</code> ab?', ['<code>U #T_Warn.Q</code>', '<code>U T_Warn</code>', '<code>U "T_Warn".Q</code>', '<code>L #T_Warn</code>']);
// Kapitel 13
P('xq_awl_p_db_zugriff', 13, 'Wie greift man symbolisch auf <code>Temp_Soll</code> im Global-DB <code>DB_Ofen</code> zu?', ['<code>L "DB_Ofen".Temp_Soll</code>', '<code>L #DB_Ofen.Temp_Soll</code>', '<code>L DB_Ofen:Temp_Soll</code>', '<code>L "Temp_Soll".DB_Ofen</code>']);
P('xq_awl_p_udt', 13, 'Was ist ein PLC-Datentyp (UDT)?', ['Eine selbst definierte Struktur, die als Vorlage für Variablen dient', 'Ein Datenbaustein mit festen Werten', 'Ein Baustein mit Programmcode', 'Eine Konstante für alle Bausteine']);
P('xq_awl_p_array_n', 13, 'Wie viele Elemente hat ein <code>Array[1..5] of Int</code>?', ['5', '4', '6', '10']);
P('xq_awl_p_global_idb', 13, 'Worin unterscheidet sich ein Global-DB von einem Instanz-DB?', ['Auf einen Global-DB greifen beliebige Bausteine zu; ein Instanz-DB gehört zu einem FB-Aufruf', 'Ein Global-DB kann keine Arrays enthalten', 'Ein Instanz-DB ist remanent, ein Global-DB nie', 'Es gibt keinen Unterschied']);
P('xq_awl_p_array_idx', 13, 'Welches Element spricht <code>"DB_Stich".Spalt[2]</code> bei <code>Spalt : Array[1..3] of Int</code> an?', ['Das zweite Element', 'Das dritte Element', 'Das erste Element', 'Alle Elemente bis 2']);
P('xq_awl_p_udt_vorteil', 13, 'Welchen Vorteil hat ein gemeinsamer PLC-Datentyp für alle Walzgerüste?', ['Alle Gerüste haben dieselbe Datenstruktur; eine Änderung erfolgt an einer Stelle', 'Das Programm braucht keine Datenbausteine mehr', 'Die Gerüste teilen sich automatisch dieselben Werte', 'Die CPU arbeitet damit doppelt so schnell']);
// Kapitel 14
P('xq_awl_p_std_schnitt', 14, 'Was zeichnet einen guten Standardbaustein (z. B. <code>FB_Antrieb</code>) aus?', ['Er arbeitet nur über seine Schnittstelle und greift nicht direkt auf globale Operanden zu', 'Er enthält die Adressen aller Antriebe der Anlage', 'Er wird nur einmal im Programm aufgerufen', 'Er kommt ohne Parameter aus']);
P('xq_awl_p_rm_zeit', 14, 'Warum überwacht ein Standard-Antrieb die Schütz-Rückmeldung mit einer Zeit?', ['Damit eine fehlende Rückmeldung nach einer Wartezeit als Störung erkannt wird', 'Damit der Motor langsamer anläuft', 'Damit die Rückmeldung entprellt gezählt wird', 'Damit der Antrieb nach einer Zeit automatisch ausschaltet']);
P('xq_awl_p_zwei_geruest', 14, 'Derselbe Walzgerüst-Baustein soll für zwei Gerüste verwendet werden. Was ist richtig?', ['Ein FB, zwei Instanzen (zwei Instanz-DBs oder zwei Multiinstanzen)', 'Den FB kopieren und umbenennen', 'Einen Instanz-DB für beide Aufrufe', 'Den FB nur einmal aufrufen und die Ausgänge verdoppeln']);
P('xq_awl_p_verriegelung', 14, 'Warum verriegelt ein Rollgangbaustein Vorwärts und Rückwärts gegenseitig?', ['Damit nie beide Wendeschütze gleichzeitig anziehen', 'Damit der Rollgang schneller umschaltet', 'Weil ein FB nur einen Ausgang setzen darf', 'Damit keine Flanke verloren geht']);
P('xq_awl_p_totband', 14, 'Wozu dient ein Totband bei der Walzspaltverstellung?', ['Innerhalb des Bandes wird nicht nachgestellt – der Antrieb pendelt nicht dauernd hin und her', 'Es sperrt die Verstellung während des Walzens', 'Es begrenzt den Spalt auf einen Maximalwert', 'Es verzögert das Einschalten des Gerüsts']);
P('xq_awl_p_parameter', 14, 'Ein Ofenbaustein erhält Solltemperatur und Hysterese als Eingänge statt als Zahlen im Code. Vorteil?', ['Derselbe Baustein passt ohne Codeänderung für verschiedene Öfen', 'Der Baustein braucht keinen Instanz-DB mehr', 'Die Temperatur wird genauer gemessen', 'Die Eingänge sind schneller als Konstanten']);
// Kapitel 15
P('xq_awl_p_1200', 15, 'Ein AWL-Programm einer S7-300 soll auf eine S7-1200 migriert werden. Was ist richtig?', ['Die S7-1200 kann kein AWL – das Programm muss z. B. nach SCL oder KOP umgeschrieben werden', 'AWL läuft auf der S7-1200 unverändert', 'Man muss nur die Adressen anpassen', 'Die S7-1200 übersetzt AWL automatisch beim Laden']);
P('xq_awl_p_ob100', 15, 'Wann wird der OB100 bearbeitet?', ['Einmal beim Anlauf (Neustart) der CPU, vor dem ersten OB1-Zyklus', 'In jedem Zyklus vor dem OB1', 'Nur bei einem Fehler', 'Alle 100 ms']);
P('xq_awl_p_ob1_inhalt', 15, 'Was gehört nach gängigem Programmierstandard in den OB1?', ['Vor allem Bausteinaufrufe in sinnvoller Reihenfolge', 'Die gesamte Logik der Anlage in einem Netzwerk', 'Nur Anlaufwerte', 'Die Deklaration aller Variablen']);
P('xq_awl_p_reihenfolge', 15, 'Der Baustein, der eine Freigabe berechnet, wird im OB1 <b>nach</b> dem Antrieb aufgerufen, der sie verwendet. Folge?', ['Der Antrieb reagiert erst einen Zyklus später auf die Freigabe', 'Der Antrieb reagiert nie', 'Die CPU meldet einen Übersetzungsfehler', 'Kein Unterschied – alle Bausteine laufen gleichzeitig']);
P('xq_awl_p_1500', 15, 'Ein AWL-Programm soll auf eine S7-1500 übernommen werden. Was ist richtig?', ['Die S7-1500 kann AWL ausführen; für neue Programme werden aber meist SCL, KOP oder FUP empfohlen', 'Die S7-1500 kann kein AWL', 'AWL muss auf der S7-1500 in GRAPH umgewandelt werden', 'Auf der S7-1500 laufen nur S5-Zeiten']);
P('xq_awl_p_warnfrei', 15, 'Warum verlangt ein Programmierstandard, dass Bausteine ohne Warnungen übersetzt werden?', ['Warnungen weisen auf mögliche Fehler hin, z. B. ungenutzte oder vor dem Schreiben gelesene Variablen', 'Weil Bausteine mit Warnungen nicht geladen werden können', 'Weil Warnungen die Zykluszeit verdoppeln', 'Warnungen sind nur für KOP wichtig']);
})();
