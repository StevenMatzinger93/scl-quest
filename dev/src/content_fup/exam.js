/* ===== FUP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Stellwerk Brünigkreuz), nicht aus dem Spiel. Gleiches Netzwerkmodell wie KOP (kop.js).
   Grundstufe: 18 Aufgaben, 40 Fragen (Kapitel 1–10) · Profi-Stufe: 12 Aufgaben, 30 Fragen (Kapitel 11–15) */
(function(){
const seq = steps => [{ steps }];
const START_G = t => () => 'NETWORK ' + t + '\n? => ?;\n';
const MAIN = body => kOB('Main', body);
const STARTUP = body => kOB('Startup', body);

/* =====================================================================
   GRUNDSTUFE
   ===================================================================== */

/* ---------- Kapitel 1: UND-Box, Zuweisung ---------- */
defExamTask({ id:'x_fup_g_ausfahrt', quest:'fup', level:'grund', ch:1, diff:1,
  params:{ G:[3, 4, 5] },
  title:'Ausfahrsignal C',
  brief: p => 'Das Ausfahrsignal <code>Signal_C</code> zeigt Fahrt, wenn die Taste <code>Taste_C</code> gedrückt ist, das Gleis <code>Gleis' + p.G + '_frei</code> meldet <b>und</b> die Weiche <code>W' + p.G + '_Endlage</code> in der Endlage liegt. Der Melder <code>Melder_C</code> am Stelltisch zeigt dasselbe Ergebnis.<br>Verwende <b>eine</b> &amp;-Box mit zwei Zuweisungen.',
  vars: p => ({ Taste_C:false, ['Gleis' + p.G + '_frei']:false, ['W' + p.G + '_Endlage']:false, Signal_C:false, Melder_C:false }),
  start: START_G('Signal C'),
  ref: p => 'NETWORK Signal C\nTaste_C AND Gleis' + p.G + '_frei AND W' + p.G + '_Endlage => Signal_C, Melder_C;',
  must:['SERIES','MULTI_OUT'],
  visible: p => [[{ Taste_C:true, ['Gleis' + p.G + '_frei']:true, ['W' + p.G + '_Endlage']:true }, { Signal_C:true, Melder_C:true }]],
  hidden: p => { const g = 'Gleis' + p.G + '_frei', w = 'W' + p.G + '_Endlage';
    return truth(['Taste_C', g, w], e => { const q = e.Taste_C && e[g] && e[w]; return { Signal_C:q, Melder_C:q }; }); },
  wrong:[
    p => 'NETWORK Signal C\nTaste_C OR Gleis' + p.G + '_frei OR W' + p.G + '_Endlage => Signal_C, Melder_C;',
    p => 'NETWORK Signal C\nTaste_C AND Gleis' + p.G + '_frei => Signal_C, Melder_C;',
    p => 'NETWORK Signal C\nTaste_C AND Gleis' + p.G + '_frei AND W' + p.G + '_Endlage => Signal_C;'
  ]
});

/* ---------- Kapitel 2: ODER, XOR, negierter Eingang ---------- */
defExamTask({ id:'x_fup_g_gleissperre', quest:'fup', level:'grund', ch:2, diff:2,
  params:{ H:['Wartung', 'Handbetrieb'] },
  title:'Lage der Gleissperre',
  brief: p => 'Die Gleissperre meldet zwei Endlagen: <code>Sperre_ab</code> und <code>Sperre_auf</code>. <code>Sperre_OK</code> ist 1, wenn <b>genau eine</b> Endlage gemeldet wird und <b>kein</b> <code>' + p.H + '</code> ansteht. Der Störmelder <code>Melder_Stoerung</code> zeigt das Gegenteil von <code>Sperre_OK</code>.<br>Verwende eine X-Box, einen negierten Eingang und eine negierte Zuweisung.',
  vars: p => ({ Sperre_ab:false, Sperre_auf:false, [p.H]:false, Sperre_OK:false, Melder_Stoerung:false }),
  start: START_G('Gleissperre'),
  ref: p => 'NETWORK Gleissperre\n(Sperre_ab XOR Sperre_auf) AND NOT ' + p.H + ' => Sperre_OK, NOT Melder_Stoerung;',
  must:['XOR','NC','NCOIL'],
  visible: () => [[{ Sperre_ab:true }, { Sperre_OK:true, Melder_Stoerung:false }], [{}, { Sperre_OK:false, Melder_Stoerung:true }]],
  hidden: p => truth(['Sperre_ab', 'Sperre_auf', p.H], e => { const ok = e.Sperre_ab !== e.Sperre_auf && !e[p.H]; return { Sperre_OK:ok, Melder_Stoerung:!ok }; }),
  wrong:[
    p => 'NETWORK Gleissperre\n(Sperre_ab OR Sperre_auf) AND NOT ' + p.H + ' => Sperre_OK, NOT Melder_Stoerung;',
    p => 'NETWORK Gleissperre\nSperre_ab XOR Sperre_auf AND NOT ' + p.H + ' => Sperre_OK, NOT Melder_Stoerung;',
    () => 'NETWORK Gleissperre\nSperre_ab XOR Sperre_auf => Sperre_OK, NOT Melder_Stoerung;',
    p => 'NETWORK Gleissperre\n(Sperre_ab XOR Sperre_auf) AND NOT ' + p.H + ' => Sperre_OK, Melder_Stoerung;'
  ]
});

/* ---------- Kapitel 3: Selbsthaltung, Aus-Vorrang, Verriegelung ---------- */
defExamTask({ id:'x_fup_g_rangier', quest:'fup', level:'grund', ch:3, diff:1, timed:true,
  title:'Rangierfahrt mit Aus-Vorrang',
  brief: () => '<code>Taste_Rangier</code> schaltet <code>Rangierfahrt</code> ein; die Rangierfahrt bleibt nach dem Loslassen eingeschaltet (Selbsthaltung). <code>Taste_Stop</code> oder ein besetztes Grenzzeichen <code>Grenzzeichen_besetzt</code> schalten sie aus. Die Ausschaltbedingungen haben <b>Vorrang</b> vor der Einschalttaste.',
  vars: () => ({ Taste_Rangier:false, Taste_Stop:false, Grenzzeichen_besetzt:false, Rangierfahrt:false }),
  start: START_G('Rangierfahrt'),
  ref: () => 'NETWORK Rangierfahrt\n(Taste_Rangier OR Rangierfahrt) AND NOT Taste_Stop AND NOT Grenzzeichen_besetzt => Rangierfahrt;',
  must:['PARALLEL','NC'],
  visible: () => seq([[0.1,{ Taste_Rangier:true },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false },{ Rangierfahrt:true }]]),
  hidden: () => [
    { steps:[[0.1,{ Taste_Rangier:true },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false },{ Rangierfahrt:true }],[0.1,{},{ Rangierfahrt:true }],[0.1,{ Taste_Stop:true },{ Rangierfahrt:false }],[0.1,{ Taste_Stop:false },{ Rangierfahrt:false }]] },
    { steps:[[0.1,{ Taste_Rangier:true, Taste_Stop:true },{ Rangierfahrt:false }],[0.1,{ Taste_Stop:false },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false, Grenzzeichen_besetzt:true },{ Rangierfahrt:false }],[0.1,{ Grenzzeichen_besetzt:false },{ Rangierfahrt:false }]] },
    { steps:[[0.1,{ Grenzzeichen_besetzt:true, Taste_Rangier:true },{ Rangierfahrt:false }],[0.1,{ Grenzzeichen_besetzt:false },{ Rangierfahrt:true }],[0.1,{ Taste_Rangier:false },{ Rangierfahrt:true }]] }
  ],
  wrong:[
    () => 'NETWORK Rangierfahrt\nTaste_Rangier AND NOT Taste_Stop AND NOT Grenzzeichen_besetzt => Rangierfahrt;',
    () => 'NETWORK Rangierfahrt\nTaste_Rangier OR (Rangierfahrt AND NOT Taste_Stop AND NOT Grenzzeichen_besetzt) => Rangierfahrt;',
    () => 'NETWORK Rangierfahrt\n(Taste_Rangier OR Rangierfahrt) AND NOT Taste_Stop => Rangierfahrt;'
  ]
});

const SB_REF = 'NETWORK Fahrt West\n(Taste_West OR Fahrt_West) AND NOT Taste_Halt AND NOT Endlage_West AND NOT Fahrt_Ost => Fahrt_West;\n\n' +
  'NETWORK Fahrt Ost\n(Taste_Ost OR Fahrt_Ost) AND NOT Taste_Halt AND NOT Endlage_Ost AND NOT Fahrt_West => Fahrt_Ost;\n\n' +
  'NETWORK Antrieb\nFahrt_West OR Fahrt_Ost => Antrieb_Ein;';
defExamTask({ id:'x_fup_g_schiebebuehne', quest:'fup', level:'grund', ch:3, diff:3, timed:true,
  title:'Schiebebühne im Depot',
  brief: () => 'Die Schiebebühne fährt nach Westen oder Osten.<br><b>NW 1:</b> <code>Taste_West</code> startet <code>Fahrt_West</code> mit Selbsthaltung. Sie endet bei <code>Taste_Halt</code> oder in der <code>Endlage_West</code> und ist gegen <code>Fahrt_Ost</code> verriegelt.<br><b>NW 2:</b> dasselbe für <code>Fahrt_Ost</code> (<code>Taste_Ost</code>, <code>Endlage_Ost</code>), verriegelt gegen <code>Fahrt_West</code>.<br><b>NW 3:</b> <code>Antrieb_Ein</code> ist 1, solange eine der beiden Fahrten läuft.',
  vars: () => ({ Taste_West:false, Taste_Ost:false, Taste_Halt:false, Endlage_West:false, Endlage_Ost:false, Fahrt_West:false, Fahrt_Ost:false, Antrieb_Ein:false }),
  start: START_G('Fahrt West'),
  ref: () => SB_REF,
  must:['PARALLEL','NC','NETWORKS'],
  visible: () => seq([[0.1,{ Taste_Ost:true },{ Fahrt_Ost:true, Antrieb_Ein:true }],[0.1,{ Taste_Ost:false },{ Fahrt_Ost:true }]]),
  hidden: () => [
    { steps:[[0.1,{ Taste_West:true },{ Fahrt_West:true, Fahrt_Ost:false, Antrieb_Ein:true }],[0.1,{ Taste_West:false },{ Fahrt_West:true }],[0.1,{ Taste_Ost:true },{ Fahrt_West:true, Fahrt_Ost:false }],[0.1,{ Taste_Ost:false, Endlage_West:true },{ Fahrt_West:false, Antrieb_Ein:false }],
      [0.1,{ Taste_Ost:true },{ Fahrt_Ost:true, Antrieb_Ein:true }],[0.1,{ Taste_Ost:false, Endlage_West:false },{ Fahrt_Ost:true }],[0.1,{ Endlage_Ost:true },{ Fahrt_Ost:false, Antrieb_Ein:false }]] },
    { steps:[[0.1,{ Taste_West:true, Taste_Ost:true },{ Fahrt_West:true, Fahrt_Ost:false }],[0.1,{ Taste_West:false, Taste_Ost:false },{ Fahrt_West:true }],[0.1,{ Taste_Halt:true },{ Fahrt_West:false, Antrieb_Ein:false }],[0.1,{ Taste_Halt:false },{ Fahrt_West:false }]] },
    { steps:[[0.1,{ Taste_Ost:true, Taste_Halt:true },{ Fahrt_Ost:false, Antrieb_Ein:false }],[0.1,{ Taste_Halt:false },{ Fahrt_Ost:true }],[0.1,{ Taste_Ost:false, Taste_Halt:true },{ Fahrt_Ost:false }],[0.1,{ Taste_Halt:false, Endlage_Ost:true, Taste_Ost:true },{ Fahrt_Ost:false, Antrieb_Ein:false }]] }
  ],
  wrong:[
    () => SB_REF.replace(' AND NOT Fahrt_Ost =>', ' =>').replace(' AND NOT Fahrt_West =>', ' =>'),
    () => SB_REF.replace('(Taste_Ost OR Fahrt_Ost) AND NOT Taste_Halt AND', '(Taste_Ost OR Fahrt_Ost) AND'),
    () => SB_REF.replace('Fahrt_West OR Fahrt_Ost => Antrieb_Ein', 'Fahrt_West AND Fahrt_Ost => Antrieb_Ein')
  ]
});

/* ---------- Kapitel 4: Speicherboxen ---------- */
defExamTask({ id:'x_fup_g_schranke', quest:'fup', level:'grund', ch:4, diff:1, timed:true,
  title:'Schranke mit Speicherbox',
  brief: () => 'Die Anforderung <code>Zug_Meldung</code> <b>setzt</b> <code>Schranke_Zu</code>, der Taster <code>Freimeldung</code> <b>setzt zurück</b>. Kommen beide gleichzeitig, bleibt die Schranke <b>zu</b> (Setzen dominant). Verwende eine RS-Box.',
  vars: () => ({ Zug_Meldung:false, Freimeldung:false, Schranke_Zu:false }),
  start: START_G('Schranke'),
  ref: () => 'NETWORK Schranke\nZug_Meldung => RS(Schranke_Zu, Freimeldung);',
  must:['RS'],
  visible: () => seq([[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false},{Schranke_Zu:true}],[0.1,{Freimeldung:true},{Schranke_Zu:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schranke_Zu:false}],[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.5,{Zug_Meldung:false},{Schranke_Zu:true}],[0.1,{Freimeldung:true},{Schranke_Zu:false}],[0.1,{Freimeldung:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Zug_Meldung:true, Freimeldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Freimeldung:true},{Schranke_Zu:false}],[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false, Freimeldung:false},{Schranke_Zu:true}]] },
    { steps:[[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false, Freimeldung:true},{Schranke_Zu:false}],[0.1,{Freimeldung:false},{Schranke_Zu:false}]] }
  ],
  wrong:[
    () => 'NETWORK Schranke\nZug_Meldung => SR(Schranke_Zu, Freimeldung);',
    () => 'NETWORK Schranke\nZug_Meldung AND NOT Freimeldung => Schranke_Zu;',
    () => 'NETWORK Schranke\nZug_Meldung => S Schranke_Zu;'
  ]
});

defExamTask({ id:'x_fup_g_fs_speicher', quest:'fup', level:'grund', ch:4, diff:2, timed:true,
  params:{ R:['Zugschluss', 'Taste_Aufloesen'] },
  title:'Fahrstrasse Gleis 2 speichern',
  brief: p => '<b>NW 1:</b> <code>Taste_FS</code> und <code>Gleis2_frei</code> <b>setzen</b> <code>FS_Gleis2</code>, <code>' + p.R + '</code> setzt zurück. Kommen Setzen und Rücksetzen gleichzeitig, gewinnt das <b>Rücksetzen</b>.<br><b>NW 2:</b> <code>Melder_FS</code> zeigt <code>FS_Gleis2</code>, <code>Melder_Frei</code> zeigt das Gegenteil (negierte Zuweisung).',
  vars: p => ({ Taste_FS:false, Gleis2_frei:false, [p.R]:false, FS_Gleis2:false, Melder_FS:false, Melder_Frei:false }),
  start: START_G('Fahrstrasse'),
  ref: p => 'NETWORK Fahrstrasse\nTaste_FS AND Gleis2_frei => SR(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, NOT Melder_Frei;',
  must:['SR','NCOIL'],
  visible: () => seq([[0.1,{ Taste_FS:true, Gleis2_frei:true },{ FS_Gleis2:true, Melder_FS:true, Melder_Frei:false }],[0.1,{ Taste_FS:false },{ FS_Gleis2:true }]]),
  hidden: p => [
    { steps:[[0.1,{},{ FS_Gleis2:false, Melder_Frei:true }],[0.1,{ Taste_FS:true, Gleis2_frei:true },{ FS_Gleis2:true, Melder_FS:true, Melder_Frei:false }],[0.1,{ Taste_FS:false },{ FS_Gleis2:true }],[0.1,{ Gleis2_frei:false },{ FS_Gleis2:true }],[0.1,{ [p.R]:true },{ FS_Gleis2:false, Melder_FS:false, Melder_Frei:true }]] },
    { steps:[[0.1,{ Taste_FS:true },{ FS_Gleis2:false }],[0.1,{ Gleis2_frei:true, [p.R]:true },{ FS_Gleis2:false }],[0.1,{ [p.R]:false },{ FS_Gleis2:true }]] },
    { steps:[[0.1,{ Taste_FS:true, Gleis2_frei:true },{ FS_Gleis2:true }],[0.1,{ Taste_FS:false, [p.R]:true },{ FS_Gleis2:false }],[0.1,{ [p.R]:false },{ FS_Gleis2:false, Melder_Frei:true }]] }
  ],
  wrong:[
    p => 'NETWORK Fahrstrasse\nTaste_FS AND Gleis2_frei => RS(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, NOT Melder_Frei;',
    p => 'NETWORK Fahrstrasse\nTaste_FS => SR(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, NOT Melder_Frei;',
    p => 'NETWORK Fahrstrasse\nTaste_FS AND Gleis2_frei => SR(FS_Gleis2, ' + p.R + ');\n\nNETWORK Melder\nFS_Gleis2 => Melder_FS, Melder_Frei;'
  ]
});

/* ---------- Kapitel 5: Flanken, Stromstoss ---------- */
defExamTask({ id:'x_fup_g_abfahrten', quest:'fup', level:'grund', ch:5, diff:1, timed:true,
  params:{ A:[0, 7, 15] },
  title:'Abfahrten zählen',
  brief: p => 'Jede <b>Abfahrt</b> eines Zuges erhöht <code>Abfahrten</code> um 1. Eine Abfahrt ist der Moment, in dem <code>Zug_am_Bahnsteig</code> von 1 auf 0 wechselt (negative Flanke). <code>Tagesreset</code> schreibt 0 in <code>Abfahrten</code>. Der Zähler steht zu Beginn auf ' + p.A + '.',
  vars: p => ({ Zug_am_Bahnsteig:false, Tagesreset:false, Abfahrten:p.A }),
  start: START_G('Abfahrt zaehlen'),
  ref: () => 'NETWORK Abfahrt zaehlen\nN(Zug_am_Bahnsteig) => INC(Abfahrten);\n\nNETWORK Tagesreset\nTagesreset => MOVE(0, Abfahrten);',
  must:['EDGE_N','INC','MOVE'],
  visible: p => seq([[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 1 }]]),
  hidden: p => [
    { steps:[[0.1,{},{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A }],[0.1,{},{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 1 }],[0.1,{},{ Abfahrten:p.A + 1 }],[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A + 1 }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 2 }]] },
    { steps:[[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:p.A }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:p.A + 1 }],[0.1,{ Tagesreset:true },{ Abfahrten:0 }],[0.1,{ Tagesreset:false },{ Abfahrten:0 }]] },
    { steps:[[0.1,{ Zug_am_Bahnsteig:true, Tagesreset:true },{ Abfahrten:0 }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:0 }],[0.1,{ Tagesreset:false },{ Abfahrten:0 }],[0.1,{ Zug_am_Bahnsteig:true },{ Abfahrten:0 }],[0.1,{ Zug_am_Bahnsteig:false },{ Abfahrten:1 }]] }
  ],
  wrong:[
    () => 'NETWORK Abfahrt zaehlen\nP(Zug_am_Bahnsteig) => INC(Abfahrten);\n\nNETWORK Tagesreset\nTagesreset => MOVE(0, Abfahrten);',
    () => 'NETWORK Abfahrt zaehlen\nNOT Zug_am_Bahnsteig => INC(Abfahrten);\n\nNETWORK Tagesreset\nTagesreset => MOVE(0, Abfahrten);',
    () => 'NETWORK Abfahrt zaehlen\nN(Zug_am_Bahnsteig) => INC(Abfahrten);'
  ]
});

defExamTask({ id:'x_fup_g_stromstoss', quest:'fup', level:'grund', ch:5, diff:2, timed:true,
  params:{ R:['Betriebsschluss', 'Nachtruhe'] },
  title:'Bahnsteiglicht per Stromstoss',
  brief: p => 'Jeder <b>Druck</b> auf <code>Taste_Licht</code> schaltet <code>Bahnsteiglicht</code> um (ein → aus → ein …), auch wenn die Taste länger gehalten wird.<br><b>NW 1:</b> Umschalten mit P-Flanke und X-Box (Rückführung von <code>Bahnsteiglicht</code>).<br><b>NW 2:</b> <code>' + p.R + '</code> setzt <code>Bahnsteiglicht</code> zurück.',
  vars: p => ({ Taste_Licht:false, [p.R]:false, Bahnsteiglicht:false }),
  start: START_G('Umschalten'),
  ref: p => 'NETWORK Umschalten\nP(Taste_Licht) XOR Bahnsteiglicht => Bahnsteiglicht;\n\nNETWORK Abschalten\n' + p.R + ' => R Bahnsteiglicht;',
  must:['EDGE_P','XOR','RESET'],
  visible: () => seq([[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }]]),
  hidden: p => [
    { steps:[[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{},{ Bahnsteiglicht:true }],[0.1,{},{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:false }],[0.1,{},{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:false }]] },
    { steps:[[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }],[0.1,{ [p.R]:true },{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:false, [p.R]:false },{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }]] },
    { steps:[[0.1,{},{ Bahnsteiglicht:false }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:false },{ Bahnsteiglicht:true }],[0.1,{ Taste_Licht:true },{ Bahnsteiglicht:false }]] }
  ],
  wrong:[
    p => 'NETWORK Umschalten\nTaste_Licht XOR Bahnsteiglicht => Bahnsteiglicht;\n\nNETWORK Abschalten\n' + p.R + ' => R Bahnsteiglicht;',
    p => 'NETWORK Umschalten\nN(Taste_Licht) XOR Bahnsteiglicht => Bahnsteiglicht;\n\nNETWORK Abschalten\n' + p.R + ' => R Bahnsteiglicht;',
    () => 'NETWORK Umschalten\nP(Taste_Licht) XOR Bahnsteiglicht => Bahnsteiglicht;'
  ]
});

/* ---------- Kapitel 6: TON, TOF, TP ---------- */
defExamTask({ id:'x_fup_g_unterfuehrung', quest:'fup', level:'grund', ch:6, diff:1, timed:true,
  params:{ T:[3, 4, 5] },
  title:'Licht in der Unterführung',
  brief: p => 'Der Bewegungsmelder <code>Bewegung</code> schaltet <code>Licht_Unterfuehrung</code> sofort ein. Nach der letzten Bewegung bleibt das Licht noch <b>' + p.T + ' s</b> an. Verwende eine Zeitbox mit der Instanz <code>T_Licht</code>.',
  vars: () => ({ Bewegung:false, Licht_Unterfuehrung:false }),
  start: START_G('Licht'),
  ref: p => 'NETWORK Licht\nBewegung AND TOF(T_Licht, T#' + p.T + 'S) => Licht_Unterfuehrung;',
  must:['TOF'],
  visible: () => seq([[0,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }]]),
  hidden: p => [
    { steps:[[0,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }],[p.T - 0.5,{},{ Licht_Unterfuehrung:true }],[0.6,{},{ Licht_Unterfuehrung:false }]] },
    { steps:[[0,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }],[p.T - 1,{},{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }],[p.T - 0.3,{},{ Licht_Unterfuehrung:true }],[0.5,{},{ Licht_Unterfuehrung:false }]] },
    { steps:[[0.1,{},{ Licht_Unterfuehrung:false }],[0.1,{ Bewegung:true },{ Licht_Unterfuehrung:true }],[2 * p.T,{},{ Licht_Unterfuehrung:true }],[0.1,{ Bewegung:false },{ Licht_Unterfuehrung:true }]] }
  ],
  wrong:[
    p => 'NETWORK Licht\nBewegung AND TON(T_Licht, T#' + p.T + 'S) => Licht_Unterfuehrung;',
    p => 'NETWORK Licht\nBewegung AND TP(T_Licht, T#' + p.T + 'S) => Licht_Unterfuehrung;',
    p => 'NETWORK Licht\nBewegung AND TOF(T_Licht, T#' + (p.T + 2) + 'S) => Licht_Unterfuehrung;'
  ]
});

defExamTask({ id:'x_fup_g_rottenwarnung', quest:'fup', level:'grund', ch:6, diff:2, timed:true,
  params:{ T:[2, 3] },
  title:'Rottenwarnung',
  brief: p => 'Das <code>Warnhorn</code> warnt die Gleisarbeiter. Es ertönt bei der steigenden Flanke von <code>Zug_naht</code> <b>oder</b> <code>Taste_Test</code> für genau <b>' + p.T + ' s</b> – unabhängig davon, wie lange das Signal ansteht. Verwende eine Zeitbox mit der Instanz <code>T_Warn</code>.',
  vars: () => ({ Zug_naht:false, Taste_Test:false, Warnhorn:false }),
  start: START_G('Rottenwarnung'),
  ref: p => 'NETWORK Rottenwarnung\n(Zug_naht OR Taste_Test) AND TP(T_Warn, T#' + p.T + 'S) => Warnhorn;',
  must:['TP','PARALLEL'],
  visible: () => seq([[0,{ Zug_naht:true },{ Warnhorn:true }],[1,{},{ Warnhorn:true }]]),
  hidden: p => [
    { steps:[[0,{ Zug_naht:true },{ Warnhorn:true }],[p.T - 0.5,{},{ Warnhorn:true }],[0.6,{},{ Warnhorn:false }],[1,{},{ Warnhorn:false }]] },
    { steps:[[0,{ Taste_Test:true },{ Warnhorn:true }],[0.2,{ Taste_Test:false },{ Warnhorn:true }],[p.T - 0.5,{},{ Warnhorn:true }],[0.5,{},{ Warnhorn:false }]] },
    { steps:[[0,{ Zug_naht:true },{ Warnhorn:true }],[0.5,{ Zug_naht:false },{ Warnhorn:true }],[0.2,{ Zug_naht:true },{ Warnhorn:true }],[p.T - 0.9,{},{ Warnhorn:true }],[0.4,{},{ Warnhorn:false }]] }
  ],
  wrong:[
    p => 'NETWORK Rottenwarnung\n(Zug_naht OR Taste_Test) AND TON(T_Warn, T#' + p.T + 'S) => Warnhorn;',
    p => 'NETWORK Rottenwarnung\n(Zug_naht OR Taste_Test) AND TOF(T_Warn, T#' + p.T + 'S) => Warnhorn;',
    p => 'NETWORK Rottenwarnung\nZug_naht AND TP(T_Warn, T#' + p.T + 'S) => Warnhorn;'
  ]
});

/* ---------- Kapitel 7: Blinker, Laufzeit, Vorläuten ---------- */
defExamTask({ id:'x_fup_g_schranke_laufzeit', quest:'fup', level:'grund', ch:7, diff:2, timed:true,
  params:{ T:[4, 5, 6] },
  title:'Laufzeit der Schranke',
  brief: p => 'Solange <code>Schranke_senken</code> ansteht und die Endlage <code>Schranke_unten</code> <b>nicht</b> erreicht ist, läuft die Überwachungszeit <code>T_Lauf</code> (' + p.T + ' s). Ist sie abgelaufen, wird <code>BUE_Stoerung</code> gespeichert. <code>Quittieren</code> setzt die Störung zurück; steht die Störbedingung noch an, bleibt die Störung gesetzt (Setzen dominant).',
  vars: () => ({ Schranke_senken:false, Schranke_unten:false, Quittieren:false, BUE_Stoerung:false }),
  start: START_G('Laufzeit'),
  ref: p => 'NETWORK Laufzeit\nSchranke_senken AND NOT Schranke_unten AND TON(T_Lauf, T#' + p.T + 'S) => RS(BUE_Stoerung, Quittieren);',
  must:['TON','RS','NC'],
  visible: p => seq([[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T + 0.5,{},{ BUE_Stoerung:true }]]),
  hidden: p => [
    { steps:[[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T - 1,{},{ BUE_Stoerung:false }],[0.1,{ Schranke_unten:true },{ BUE_Stoerung:false }],[p.T,{},{ BUE_Stoerung:false }]] },
    { steps:[[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T + 0.1,{},{ BUE_Stoerung:true }],[0.1,{ Schranke_senken:false },{ BUE_Stoerung:true }],[0.1,{ Quittieren:true },{ BUE_Stoerung:false }],[0.1,{ Quittieren:false },{ BUE_Stoerung:false }]] },
    { steps:[[0,{ Schranke_senken:true },{ BUE_Stoerung:false }],[p.T + 0.1,{ Quittieren:true },{ BUE_Stoerung:true }],[0.1,{ Schranke_unten:true },{ BUE_Stoerung:false }]] }
  ],
  wrong:[
    p => 'NETWORK Laufzeit\nSchranke_senken AND NOT Schranke_unten AND TON(T_Lauf, T#' + p.T + 'S) => SR(BUE_Stoerung, Quittieren);',
    p => 'NETWORK Laufzeit\nSchranke_senken AND TON(T_Lauf, T#' + p.T + 'S) => RS(BUE_Stoerung, Quittieren);',
    p => 'NETWORK Laufzeit\nSchranke_senken AND NOT Schranke_unten AND TOF(T_Lauf, T#' + p.T + 'S) => RS(BUE_Stoerung, Quittieren);'
  ]
});

// Modell der Referenz (Scan für Scan), liefert die Erwartungen für den asymmetrischen Blinker
function blinkSim(E, A, steps){
  let t = 0, L = false, Z = false, pz = false, eOn = false, eS = 0, aOn = false, aS = 0;
  return steps.map(([dt, inp]) => {
    t += dt; if('Zug_naht' in inp) Z = inp.Zug_naht;
    if(Z && !pz) L = true; pz = Z;
    const inE = L; if(inE && !eOn) eS = t; const qE = inE && t - eS >= E - 1e-9; eOn = inE; if(qE) L = false;
    const inA = Z && !L; if(inA && !aOn) aS = t; const qA = inA && t - aS >= A - 1e-9; aOn = inA; if(qA) L = true;
    if(!Z) L = false;
    return [dt, inp, { Lampe:L }];
  });
}
const rep = (n, s) => Array.from({ length:n }, () => s);
const BL_REF = p => 'NETWORK Einschalten\nP(Zug_naht) => S Lampe;\n\nNETWORK Hellzeit\nLampe AND TON(T_Hell, T#' + p.E + 'MS) => R Lampe;\n\n' +
  'NETWORK Dunkelzeit\nZug_naht AND NOT Lampe AND TON(T_Dunkel, T#' + p.A + 'MS) => S Lampe;\n\nNETWORK Ausschalten\nNOT Zug_naht => R Lampe;';
defExamTask({ id:'x_fup_g_blinker', quest:'fup', level:'grund', ch:7, diff:3, timed:true,
  params:{ E:[500, 750], A:[1000, 1250] },
  title:'Warnlicht mit Hell- und Dunkelzeit',
  brief: p => 'Das Warnlicht <code>Lampe</code> blinkt, solange <code>Zug_naht</code> ansteht: beim Einschalten sofort hell, dann jeweils <b>' + p.E + ' ms</b> hell und <b>' + p.A + ' ms</b> dunkel. Fällt <code>Zug_naht</code> weg, ist die Lampe sofort aus.<br><b>NW 1:</b> P-Flanke von <code>Zug_naht</code> → S <code>Lampe</code><br><b>NW 2:</b> <code>Lampe</code> → TON <code>T_Hell</code> → R <code>Lampe</code><br><b>NW 3:</b> <code>Zug_naht</code> und nicht <code>Lampe</code> → TON <code>T_Dunkel</code> → S <code>Lampe</code><br><b>NW 4:</b> nicht <code>Zug_naht</code> → R <code>Lampe</code>',
  vars: () => ({ Zug_naht:false, Lampe:false }),
  start: START_G('Einschalten'),
  ref: BL_REF,
  must:['TON','EDGE_P','SET','RESET'],
  visible: p => [{ steps: blinkSim(p.E / 1000, p.A / 1000, [[0,{ Zug_naht:true }],[0.25,{}]]) }],
  hidden: p => [
    { steps: blinkSim(p.E / 1000, p.A / 1000, [[0,{ Zug_naht:true }]].concat(rep(20, [0.25,{}]), [[0.25,{ Zug_naht:false }],[0.25,{}]])) },
    { steps: blinkSim(p.E / 1000, p.A / 1000, [[0,{ Zug_naht:true }]].concat(rep(6, [0.25,{}]), [[0.25,{ Zug_naht:false }],[0.25,{ Zug_naht:true }]], rep(8, [0.25,{}]))) },
    { steps: blinkSim(p.E / 1000, p.A / 1000, [[0.25,{}],[0.25,{ Zug_naht:true }],[0.25,{ Zug_naht:false }],[0.25,{}],[0.25,{ Zug_naht:true }]].concat(rep(10, [0.25,{}]))) }
  ],
  wrong:[
    p => BL_REF(p).replace('\n\nNETWORK Ausschalten\nNOT Zug_naht => R Lampe;', ''),
    p => BL_REF({ E:p.A, A:p.E }),
    p => BL_REF(p).replace('P(Zug_naht) => S Lampe', 'Zug_naht => S Lampe')
  ]
});

/* ---------- Kapitel 8: Zähler ---------- */
defExamTask({ id:'x_fup_g_achszaehler', quest:'fup', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[4, 6, 8] },
  title:'Achsen zählen',
  brief: p => 'Der Achszähler <code>Achse</code> liefert pro Achse einen Impuls. Nach <b>' + p.N + '</b> Achsen meldet <code>Gleis_Frei_Pruefen</code> 1. <code>Grundstellung</code> setzt den Zähler zurück. Verwende eine CTU-Box mit der Instanz <code>Z_Achsen</code>.',
  vars: () => ({ Achse:false, Grundstellung:false, Gleis_Frei_Pruefen:false }),
  start: START_G('Achsen'),
  ref: p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + p.N + ', R:=Grundstellung) => Gleis_Frei_Pruefen;',
  must:['CTU'],
  visible: () => seq([[0.1,{Achse:true},{Gleis_Frei_Pruefen:false}],[0.1,{Achse:false},{Gleis_Frei_Pruefen:false}]]),
  hidden: p => {
    const st = [];
    for(let i = 1; i <= p.N; i++){ st.push([0.1,{Achse:true},{Gleis_Frei_Pruefen:i >= p.N}]); st.push([0.1,{Achse:false},{}]); }
    return [
      { steps: st },
      { steps: st.slice(0, 2 * p.N - 2).concat([[0.1,{Grundstellung:true},{Gleis_Frei_Pruefen:false}],[0.1,{Grundstellung:false},{}],[0.1,{Achse:true},{Gleis_Frei_Pruefen:false}]]) },
      { steps: st.concat([[0.1,{Grundstellung:true},{Gleis_Frei_Pruefen:false}],[0.1,{Grundstellung:false, Achse:true},{Gleis_Frei_Pruefen:false}]]) },
      { steps:[[0.1,{Achse:true},{}],[0.1,{Achse:true},{}],[0.1,{Achse:true},{Gleis_Frei_Pruefen:p.N <= 1}],[0.1,{Achse:false},{}]] }
    ];
  },
  wrong:[
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + (p.N + 1) + ', R:=Grundstellung) => Gleis_Frei_Pruefen;',
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + p.N + ') => Gleis_Frei_Pruefen;',
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + (p.N - 1) + ', R:=Grundstellung) => Gleis_Frei_Pruefen;'
  ]
});

const SAND_REF = (n, box) => 'NETWORK Vorrat\nSanden AND ' + (box || 'CTD(Z_Sand, PV:=' + n + ', LD:=Nachfuellen)') + ' => Sand_leer;\n\nNETWORK Anzeige\n=> MOVE(Z_Sand.CV, Rest);';
defExamTask({ id:'x_fup_g_sandvorrat', quest:'fup', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[3, 4, 5] },
  title:'Sandvorrat der Rangierlok',
  brief: p => 'Der Sandbehälter der Rangierlok reicht für <b>' + p.N + '</b> Sandungen. <code>Nachfuellen</code> lädt den Zähler <code>Z_Sand</code> auf ' + p.N + ', jede steigende Flanke von <code>Sanden</code> zählt um 1 <b>abwärts</b>. <code>Sand_leer</code> meldet einen leeren Vorrat (Zählwert ≤ 0).<br><b>NW 2:</b> Der aktuelle Zählwert steht immer in <code>Rest</code>.',
  vars: () => ({ Sanden:false, Nachfuellen:false, Sand_leer:false, Rest:0 }),
  start: START_G('Vorrat'),
  ref: p => SAND_REF(p.N),
  must:['CTD','MOVE'],
  visible: p => seq([[0.1,{ Nachfuellen:true },{ Rest:p.N, Sand_leer:false }],[0.1,{ Nachfuellen:false, Sanden:true },{ Rest:p.N - 1 }]]),
  hidden: p => {
    const st = [[0.1,{ Nachfuellen:true },{ Rest:p.N, Sand_leer:false }],[0.1,{ Nachfuellen:false },{ Rest:p.N }]];
    for(let i = 1; i <= p.N; i++){ st.push([0.1,{ Sanden:true },{ Rest:p.N - i, Sand_leer:i >= p.N }]); st.push([0.1,{ Sanden:false },{}]); }
    return [
      { steps: st },
      { steps:[[0.1,{},{ Sand_leer:true, Rest:0 }],[0.1,{ Nachfuellen:true },{ Sand_leer:false, Rest:p.N }],[0.1,{ Nachfuellen:false, Sanden:true },{ Rest:p.N - 1 }],[0.1,{ Sanden:false },{}],[0.1,{ Nachfuellen:true },{ Rest:p.N, Sand_leer:false }]] },
      { steps:[[0.1,{ Nachfuellen:true },{}],[0.1,{ Nachfuellen:false, Sanden:true },{ Rest:p.N - 1 }],[0.1,{},{ Rest:p.N - 1 }],[0.1,{},{ Rest:p.N - 1, Sand_leer:false }],[0.1,{ Sanden:false },{ Rest:p.N - 1 }]] }
    ];
  },
  wrong:[
    p => SAND_REF(p.N, 'CTU(Z_Sand, PV:=' + p.N + ', R:=Nachfuellen)'),
    p => SAND_REF(p.N + 1),
    p => 'NETWORK Vorrat\nSanden AND CTD(Z_Sand, PV:=' + p.N + ', LD:=Nachfuellen) => Sand_leer;'
  ]
});

/* ---------- Kapitel 9: Vergleichen, MOVE, Rechnen ---------- */
defExamTask({ id:'x_fup_g_weichenheizung', quest:'fup', level:'grund', ch:9, diff:1,
  params:{ T:[2, 3, 4] },
  title:'Weichenheizung',
  brief: p => 'Die <code>Weichenheizung</code> läuft, wenn die Schienentemperatur <code>Schienentemp</code> (Int, °C) <b>höchstens ' + p.T + ' °C</b> beträgt <b>oder</b> der Schneemelder <code>Schneefall</code> 1 meldet.',
  vars: () => ({ Schienentemp:10, Schneefall:false, Weichenheizung:false }),
  start: START_G('Heizung'),
  ref: p => 'NETWORK Heizung\n[Schienentemp <= ' + p.T + '] OR Schneefall => Weichenheizung;',
  must:['CMP','PARALLEL'],
  visible: () => [[{ Schienentemp:-2 }, { Weichenheizung:true }], [{ Schienentemp:15 }, { Weichenheizung:false }]],
  hidden: p => [
    [{ Schienentemp:p.T + 1 }, { Weichenheizung:false }], [{ Schienentemp:p.T }, { Weichenheizung:true }], [{ Schienentemp:p.T - 1 }, { Weichenheizung:true }],
    [{ Schienentemp:-5 }, { Weichenheizung:true }], [{ Schienentemp:p.T + 1, Schneefall:true }, { Weichenheizung:true }],
    [{ Schienentemp:20 }, { Weichenheizung:false }], [{ Schienentemp:20, Schneefall:true }, { Weichenheizung:true }]
  ],
  wrong:[
    p => 'NETWORK Heizung\n[Schienentemp < ' + p.T + '] OR Schneefall => Weichenheizung;',
    p => 'NETWORK Heizung\n[Schienentemp <= ' + p.T + '] AND Schneefall => Weichenheizung;',
    p => 'NETWORK Heizung\n[Schienentemp >= ' + p.T + '] OR Schneefall => Weichenheizung;'
  ]
});

const GEW_REF = p => 'NETWORK Wagengewicht\n=> MUL(Wagen, ' + p.G + ', Wagen_t);\n\nNETWORK Zuggewicht\n=> ADD(Wagen_t, ' + p.L + ', Gesamt_t);\n\nNETWORK Vorspann\n[Gesamt_t > ' + p.M + '] => Vorspann;';
defExamTask({ id:'x_fup_g_zuggewicht', quest:'fup', level:'grund', ch:9, diff:3,
  params:{ G:[20, 25], L:[100, 200], M:[500, 600] },
  title:'Vorspannlok nötig?',
  brief: p => 'Ein Güterzug soll über die Brünig-Rampe.<br><b>NW 1:</b> <code>Wagen_t</code> = <code>Wagen</code> × ' + p.G + ' (t pro Wagen)<br><b>NW 2:</b> <code>Gesamt_t</code> = <code>Wagen_t</code> + ' + p.L + ' (Gewicht der Lok)<br><b>NW 3:</b> Ist <code>Gesamt_t</code> <b>grösser als ' + p.M + '</b>, meldet <code>Vorspann</code> 1.<br>Alle Werte sind Int. Die Ergebnisse müssen im selben Zyklus stimmen.',
  vars: () => ({ Wagen:0, Wagen_t:0, Gesamt_t:0, Vorspann:false }),
  start: START_G('Wagengewicht'),
  ref: GEW_REF,
  must:['MUL','ADD','CMP'],
  visible: p => [[{ Wagen:10 }, { Wagen_t:10 * p.G, Gesamt_t:10 * p.G + p.L, Vorspann:10 * p.G + p.L > p.M }]],
  hidden: p => { const k = (p.M - p.L) / p.G, c = w => [{ Wagen:w }, { Wagen_t:w * p.G, Gesamt_t:w * p.G + p.L, Vorspann:w * p.G + p.L > p.M }];
    return [c(k), c(k + 1), c(0), c(k - 1), c(k + 5), c(1)]; },
  wrong:[
    p => GEW_REF(p).replace('[Gesamt_t >', '[Gesamt_t >='),
    p => 'NETWORK Wagengewicht\n=> MUL(Wagen, ' + p.G + ', Wagen_t);\n\nNETWORK Vorspann\n[Wagen_t > ' + p.M + '] => Vorspann;',
    p => 'NETWORK Zuggewicht\n=> ADD(Wagen_t, ' + p.L + ', Gesamt_t);\n\nNETWORK Wagengewicht\n=> MUL(Wagen, ' + p.G + ', Wagen_t);\n\nNETWORK Vorspann\n[Gesamt_t > ' + p.M + '] => Vorspann;'
  ]
});

/* ---------- Kapitel 10: Fahrstrassen ---------- */
const FS_REF = (g, box, sig) => 'NETWORK Fahrstrasse\nTaste_FS' + g + ' AND Gleis' + g + '_frei AND NOT Stoerung => ' + (box || 'SR') + '(FS' + g + ', Zugschluss);\n\nNETWORK Signal D\nFS' + g + ' AND W' + g + '_Endlage' + (sig === undefined ? ' AND NOT Stoerung' : sig) + ' => Signal_D;';
defExamTask({ id:'x_fup_g_fs_gleis', quest:'fup', level:'grund', ch:10, diff:2, timed:true,
  params:{ G:[3, 4] },
  title: p => 'Fahrstrasse nach Gleis ' + p.G,
  brief: p => '<b>NW 1:</b> <code>Taste_FS' + p.G + '</code> stellt die Fahrstrasse <code>FS' + p.G + '</code> ein, wenn <code>Gleis' + p.G + '_frei</code> meldet und <b>keine</b> <code>Stoerung</code> ansteht. Die Fahrstrasse bleibt gespeichert, bis <code>Zugschluss</code> sie auflöst (Rücksetzen dominant).<br><b>NW 2:</b> <code>Signal_D</code> zeigt Fahrt, wenn <code>FS' + p.G + '</code> besteht, die Weiche <code>W' + p.G + '_Endlage</code> meldet und keine <code>Stoerung</code> ansteht.',
  vars: p => ({ ['Taste_FS' + p.G]:false, ['Gleis' + p.G + '_frei']:false, Stoerung:false, Zugschluss:false, ['FS' + p.G]:false, ['W' + p.G + '_Endlage']:false, Signal_D:false }),
  start: START_G('Fahrstrasse'),
  ref: p => FS_REF(p.G),
  must:['SR','NC','SERIES'],
  visible: p => seq([[0.1,{ ['Taste_FS' + p.G]:true, ['Gleis' + p.G + '_frei']:true, ['W' + p.G + '_Endlage']:true },{ ['FS' + p.G]:true, Signal_D:true }]]),
  hidden: p => { const T = 'Taste_FS' + p.G, F = 'Gleis' + p.G + '_frei', FS = 'FS' + p.G, W = 'W' + p.G + '_Endlage';
    return [
      { steps:[[0.1,{ [T]:true, [F]:true },{ [FS]:true, Signal_D:false }],[0.1,{ [T]:false },{ [FS]:true }],[0.1,{ [W]:true },{ Signal_D:true }],[0.1,{ Stoerung:true },{ [FS]:true, Signal_D:false }],[0.1,{ Stoerung:false },{ Signal_D:true }],[0.1,{ Zugschluss:true },{ [FS]:false, Signal_D:false }]] },
      { steps:[[0.1,{ [T]:true },{ [FS]:false }],[0.1,{ [F]:true, Stoerung:true },{ [FS]:false }],[0.1,{ Stoerung:false },{ [FS]:true }]] },
      { steps:[[0.1,{ [T]:true, [F]:true, Zugschluss:true, [W]:true },{ [FS]:false, Signal_D:false }],[0.1,{ Zugschluss:false },{ [FS]:true, Signal_D:true }]] }
    ]; },
  wrong:[
    p => FS_REF(p.G, 'RS'),
    p => FS_REF(p.G, null, ''),
    p => 'NETWORK Fahrstrasse\nTaste_FS' + p.G + ' AND Gleis' + p.G + '_frei AND NOT Stoerung => FS' + p.G + ';\n\nNETWORK Signal D\nFS' + p.G + ' AND W' + p.G + '_Endlage AND NOT Stoerung => Signal_D;'
  ]
});

const AUF_REF = (p, o) => { o = o || {};
  return (o.noTimer ? '' : 'NETWORK Notaufloesung\nTaste_Notaufl AND TON(T_Notaufl, T#' + p.T + 'S) => Notaufl;\n\n') +
    'NETWORK Aufloesen\n' + (o.noEdge ? 'Zielgleis_besetzt' : 'P(Zielgleis_besetzt)') + ' OR ' + (o.noTimer ? 'Taste_Notaufl' : 'Notaufl') + ' => Aufloesen;\n\n' +
    'NETWORK Fahrstrasse West\nTaste_FS' + (o.noGegen ? '' : ' AND NOT Gegen_FS') + ' => ' + (o.box || 'SR') + '(FS_West, Aufloesen);'; };
defExamTask({ id:'x_fup_g_fs_aufloesen', quest:'fup', level:'grund', ch:10, diff:3, timed:true,
  params:{ T:[2, 3] },
  title:'Fahrstrasse auflösen',
  brief: p => '<b>NW 1:</b> Die Notauflösetaste <code>Taste_Notaufl</code> muss <b>' + p.T + ' s</b> gedrückt bleiben, dann wird <code>Notaufl</code> 1 (Instanz <code>T_Notaufl</code>).<br><b>NW 2:</b> <code>Aufloesen</code> ist 1, wenn der Zug ins Zielgleis <b>einfährt</b> (steigende Flanke von <code>Zielgleis_besetzt</code>) oder <code>Notaufl</code> ansteht.<br><b>NW 3:</b> <code>Taste_FS</code> stellt <code>FS_West</code> ein, sofern die feindliche Fahrstrasse <code>Gegen_FS</code> nicht besteht. <code>Aufloesen</code> löst sie auf und hat Vorrang.',
  vars: () => ({ Taste_FS:false, Gegen_FS:false, Zielgleis_besetzt:false, Taste_Notaufl:false, Notaufl:false, Aufloesen:false, FS_West:false }),
  start: START_G('Notaufloesung'),
  ref: p => AUF_REF(p),
  must:['EDGE_P','TON','SR'],
  visible: () => seq([[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false, Zielgleis_besetzt:true },{ FS_West:false }]]),
  hidden: p => [
    { steps:[[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false },{ FS_West:true }],[0.1,{ Zielgleis_besetzt:true },{ FS_West:false }],[0.1,{},{ FS_West:false }],[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false },{ FS_West:true }]] },
    { steps:[[0.1,{ Taste_FS:true },{ FS_West:true }],[0.1,{ Taste_FS:false, Taste_Notaufl:true },{ FS_West:true }],[p.T - 1,{},{ FS_West:true }],[0.1,{ Taste_Notaufl:false },{ FS_West:true }],[0.1,{ Taste_Notaufl:true },{ FS_West:true }],[p.T + 0.1,{},{ FS_West:false }],[0.1,{ Taste_Notaufl:false },{ FS_West:false }]] },
    { steps:[[0.1,{ Gegen_FS:true, Taste_FS:true },{ FS_West:false }],[0.1,{ Gegen_FS:false },{ FS_West:true }],[0.1,{ Taste_FS:false },{ FS_West:true }],[0.1,{ Taste_Notaufl:true },{ FS_West:true }],[p.T + 0.1,{ Taste_FS:true },{ FS_West:false }]] }
  ],
  wrong:[
    p => AUF_REF(p, { noEdge:true }),
    p => AUF_REF(p, { noTimer:true }),
    p => AUF_REF(p, { box:'RS' }),
    p => AUF_REF(p, { noGegen:true })
  ]
});

/* =====================================================================
   PROFI-STUFE
   ===================================================================== */

/* ---------- Kapitel 11: FC, Schnittstelle, Aufruf-Box ---------- */
const SIG_D = { in:'Fahrstrasse:Bool|Fahrstrasse festgelegt; Gleis_Frei:Bool|Gleisfreimeldung; Stoerung:Bool|Signalstörung', out:'Fahrt:Bool|Signal zeigt Fahrt' };
defExamTask({ id:'x_fup_p_signal', quest:'fup', level:'profi', ch:11, diff:1,
  title:'Signal-FC',
  brief: () => 'Programmiere die Funktion <code>FC_Signal</code>: <code>#Fahrt</code> ist 1, wenn <code>#Fahrstrasse</code> <b>und</b> <code>#Gleis_Frei</code> 1 sind und <b>keine</b> <code>#Stoerung</code> ansteht. Der OB <code>Main</code> (🔒) ruft die FC für das Einfahrsignal auf.',
  blocks: () => [
    { name:'FC_Signal', kind:'FC', edit:true, start: kFC('FC_Signal', 'Void', SIG_D, ''), ref: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei AND NOT #Stoerung => #Fahrt;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Einfahrsignal\n=> "FC_Signal"(Fahrstrasse := "FS_Fest", Gleis_Frei := "Gleis1_frei", Stoerung := "Sig_Stoer", Fahrt => "Signal_Fahrt");') }
  ],
  globals: () => ({ FS_Fest:false, Gleis1_frei:false, Sig_Stoer:false, Signal_Fahrt:false }),
  must:['SERIES'],
  visible: () => ({ tests:[[{FS_Fest:true, Gleis1_frei:true},{Signal_Fahrt:true}]] }),
  hidden: () => ({
    unit:[{ block:'FC_Signal', steps: truth(['Fahrstrasse','Gleis_Frei','Stoerung'], e => ({ Fahrt: e.Fahrstrasse && e.Gleis_Frei && !e.Stoerung })) }],
    tests:[[{FS_Fest:true, Gleis1_frei:true, Sig_Stoer:true},{Signal_Fahrt:false}],[{FS_Fest:false, Gleis1_frei:true},{Signal_Fahrt:false}]]
  }),
  wrong:[
    () => ({ FC_Signal: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei => #Fahrt;') }),
    () => ({ FC_Signal: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n(#Fahrstrasse OR #Gleis_Frei) AND NOT #Stoerung => #Fahrt;') })
  ]
});

const WL_D = { in:'Links:Bool|Endlage links; Rechts:Bool|Endlage rechts', out:'Lage_OK:Bool|genau eine Endlage; Stoerung:Bool|keine oder beide Endlagen' };
const WL_FC = kFC('FC_Weichenlage', 'Void', WL_D, 'NETWORK Lage\n#Links XOR #Rechts => #Lage_OK, NOT #Stoerung;');
const wlCall = (n, src) => 'NETWORK Weiche ' + n + '\n=> "FC_Weichenlage"(Links := "W' + src + '_links", Rechts := "W' + src + '_rechts", Lage_OK => "W' + n + '_OK", Stoerung => "W' + n + '_Stoerung");';
defExamTask({ id:'x_fup_p_weichenlage', quest:'fup', level:'profi', ch:11, diff:1,
  params:{ N:[2, 3, 4] },
  title:'Weichenlage für zwei Weichen',
  brief: p => 'Die Funktion <code>FC_Weichenlage</code> (🔒) ist fertig. Rufe sie in <code>Main</code> zweimal auf, je in einem eigenen Netzwerk ohne Bedingung:<br><b>NW 1:</b> Links := <code>"W1_links"</code>, Rechts := <code>"W1_rechts"</code>, Lage_OK => <code>"W1_OK"</code>, Stoerung => <code>"W1_Stoerung"</code><br><b>NW 2:</b> dasselbe für Weiche ' + p.N + ' mit den Signalen <code>"W' + p.N + '_…"</code>.',
  blocks: p => [
    { name:'FC_Weichenlage', kind:'FC', src: WL_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(wlCall(1, 1) + '\n\n' + wlCall(p.N, p.N)) }
  ],
  globals: p => ({ W1_links:false, W1_rechts:false, W1_OK:false, W1_Stoerung:false, ['W' + p.N + '_links']:false, ['W' + p.N + '_rechts']:false, ['W' + p.N + '_OK']:false, ['W' + p.N + '_Stoerung']:false }),
  must:['CALL','FC_CALL'],
  visible: () => ({ tests:[[{ W1_links:true }, { W1_OK:true, W1_Stoerung:false }]] }),
  hidden: p => { const w = k => 'W' + p.N + '_' + k;
    return { tests:[
      [{ W1_rechts:true }, { W1_OK:true, W1_Stoerung:false, [w('OK')]:false, [w('Stoerung')]:true }],
      [{ W1_links:true, W1_rechts:true }, { W1_OK:false, W1_Stoerung:true }],
      [{}, { W1_OK:false, W1_Stoerung:true, [w('OK')]:false, [w('Stoerung')]:true }],
      [{ [w('links')]:true }, { [w('OK')]:true, [w('Stoerung')]:false, W1_OK:false }],
      [{ [w('rechts')]:true, W1_links:true }, { [w('OK')]:true, W1_OK:true }],
      [{ [w('links')]:true, [w('rechts')]:true, W1_links:true }, { [w('OK')]:false, [w('Stoerung')]:true, W1_OK:true }]
    ] }; },
  wrong:[
    () => ({ Main: MAIN(wlCall(1, 1)) }),
    p => ({ Main: MAIN(wlCall(1, 1) + '\n\n' + wlCall(p.N, 1)) }),
    p => ({ Main: MAIN(wlCall(1, 1) + '\n\n' + wlCall(p.N, p.N).replace('Lage_OK => "W' + p.N + '_OK", Stoerung => "W' + p.N + '_Stoerung"', 'Lage_OK => "W' + p.N + '_Stoerung", Stoerung => "W' + p.N + '_OK"')) })
  ]
});

const GW_D = { in:'Zuglaenge:Int|m; Nutzlaenge:Int|m; Gleis_frei:Bool', out:'Passt:Bool|Zug passt ins Gleis' };
const gwFC = body => kFC('FC_Gleiswahl', 'Void', GW_D, body);
defExamTask({ id:'x_fup_p_gleiswahl', quest:'fup', level:'profi', ch:11, diff:2,
  params:{ L1:[180, 220], L2:[300, 350] },
  title:'Passt der Zug ins Gleis?',
  brief: p => 'Programmiere <code>FC_Gleiswahl</code>: <code>#Passt</code> ist 1, wenn <code>#Zuglaenge</code> <b>kleiner oder gleich</b> <code>#Nutzlaenge</code> ist <b>und</b> <code>#Gleis_frei</code> meldet.<br><code>Main</code> (🔒) ruft die FC für Gleis 1 (Nutzlänge ' + p.L1 + ' m) und Gleis 2 (Nutzlänge ' + p.L2 + ' m) auf.',
  blocks: p => [
    { name:'FC_Gleiswahl', kind:'FC', edit:true, start: gwFC(''), ref: gwFC('NETWORK Passt\n[#Zuglaenge <= #Nutzlaenge] AND #Gleis_frei => #Passt;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gleis 1\n=> "FC_Gleiswahl"(Zuglaenge := "Zuglaenge", Nutzlaenge := ' + p.L1 + ', Gleis_frei := "Gleis1_frei", Passt => "Gleis1_passt");\n\nNETWORK Gleis 2\n=> "FC_Gleiswahl"(Zuglaenge := "Zuglaenge", Nutzlaenge := ' + p.L2 + ', Gleis_frei := "Gleis2_frei", Passt => "Gleis2_passt");') }
  ],
  globals: () => ({ Zuglaenge:0, Gleis1_frei:false, Gleis2_frei:false, Gleis1_passt:false, Gleis2_passt:false }),
  must:['CMP','SERIES'],
  visible: () => ({ tests:[[{ Zuglaenge:120, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:true, Gleis2_passt:true }]] }),
  hidden: p => ({
    unit:[{ block:'FC_Gleiswahl', steps:[[{ Zuglaenge:150, Nutzlaenge:150, Gleis_frei:true }, { Passt:true }], [{ Zuglaenge:151, Nutzlaenge:150, Gleis_frei:true }, { Passt:false }], [{ Zuglaenge:100, Nutzlaenge:150, Gleis_frei:false }, { Passt:false }], [{ Zuglaenge:0, Nutzlaenge:150, Gleis_frei:true }, { Passt:true }]] }],
    tests:[
      [{ Zuglaenge:p.L1, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:true, Gleis2_passt:true }],
      [{ Zuglaenge:p.L1 + 1, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:false, Gleis2_passt:true }],
      [{ Zuglaenge:p.L2 + 1, Gleis1_frei:true, Gleis2_frei:true }, { Gleis1_passt:false, Gleis2_passt:false }],
      [{ Zuglaenge:p.L1 - 10, Gleis2_frei:true }, { Gleis1_passt:false, Gleis2_passt:true }]
    ]
  }),
  wrong:[
    () => ({ FC_Gleiswahl: gwFC('NETWORK Passt\n[#Zuglaenge < #Nutzlaenge] AND #Gleis_frei => #Passt;') }),
    () => ({ FC_Gleiswahl: gwFC('NETWORK Passt\n[#Zuglaenge <= #Nutzlaenge] OR #Gleis_frei => #Passt;') }),
    () => ({ FC_Gleiswahl: gwFC('NETWORK Passt\n[#Zuglaenge <= #Nutzlaenge] => #Passt;') })
  ]
});

/* ---------- Kapitel 12: FB, Instanz, Multiinstanz ---------- */
const RA_D0 = { in:'Anfahrt:Bool|Zug nähert sich; Im_BUE:Bool|Zug im Übergang', out:'Schranke_zu:Bool; Strasse_frei:Bool|Lichtsignal Strasse' };
const raFB = (stat, body) => kFB('FB_Raeumung', Object.assign({}, RA_D0, stat ? { stat } : {}), body);
const RA_BODY = (box, t) => 'NETWORK Schranke\n(#Anfahrt OR #Im_BUE) AND ' + box + '(#T_Raeum, T#' + t + 'S) => #Schranke_zu;\n\nNETWORK Strasse\n#Schranke_zu => NOT #Strasse_frei;';
defExamTask({ id:'x_fup_p_raeumung', quest:'fup', level:'profi', ch:12, diff:2,
  params:{ T:[2, 3, 4] },
  title:'Nachlaufzeit am Bahnübergang',
  brief: p => 'Programmiere <code>FB_Raeumung</code>:<br><b>NW 1:</b> Solange <code>#Anfahrt</code> oder <code>#Im_BUE</code> ansteht, ist <code>#Schranke_zu</code> 1. Danach bleibt die Schranke noch <b>' + p.T + ' s</b> zu. Lege dafür in der Tabelle die Static-Variable <code>T_Raeum</code> (Zeitbox als Multiinstanz) an.<br><b>NW 2:</b> <code>#Strasse_frei</code> ist das Gegenteil von <code>#Schranke_zu</code>.<br><code>Main</code> (🔒) ruft den FB mit <code>"FB_Raeumung_DB"</code> auf.',
  blocks: p => [
    { name:'FB_Raeumung', kind:'FB', edit:true, start: raFB(null, ''), ref: raFB('T_Raeum:TOF|Nachlaufzeit', RA_BODY('TOF', p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang\n=> "FB_Raeumung_DB"(Anfahrt := "Zug_Anfahrt", Im_BUE := "Zug_im_BUE", Schranke_zu => "Schranke_zu", Strasse_frei => "Strasse_frei");') }
  ],
  globals: () => ({ Zug_Anfahrt:false, Zug_im_BUE:false, Schranke_zu:false, Strasse_frei:false }),
  must:['TOF','STAT'],
  visible: () => ({ timed:[{ steps:[[0.1,{ Zug_Anfahrt:true },{ Schranke_zu:true, Strasse_frei:false }]] }] }),
  hidden: p => ({
    unit:[{ block:'FB_Raeumung', steps:[[0,{ Anfahrt:true },{ Schranke_zu:true, Strasse_frei:false }],[1,{ Anfahrt:false, Im_BUE:true },{ Schranke_zu:true }],[0.5,{ Im_BUE:false },{ Schranke_zu:true }],[p.T - 0.5,{},{ Schranke_zu:true, Strasse_frei:false }],[0.7,{},{ Schranke_zu:false, Strasse_frei:true }]] }],
    timed:[
      { steps:[[0.1,{ Zug_im_BUE:true },{ Schranke_zu:true }],[0.1,{ Zug_im_BUE:false },{ Schranke_zu:true }],[p.T + 0.1,{},{ Schranke_zu:false, Strasse_frei:true }]] },
      { steps:[[0.1,{},{ Schranke_zu:false, Strasse_frei:true }],[0.1,{ Zug_Anfahrt:true },{ Schranke_zu:true, Strasse_frei:false }],[5,{},{ Schranke_zu:true }],[0.1,{ Zug_Anfahrt:false },{ Schranke_zu:true }],[p.T - 0.3,{},{ Schranke_zu:true }]] }
    ]
  }),
  wrong:[
    p => ({ FB_Raeumung: raFB('T_Raeum:TON|Nachlaufzeit', RA_BODY('TON', p.T)) }),
    p => ({ FB_Raeumung: raFB('T_Raeum:TOF|Nachlaufzeit', RA_BODY('TOF', p.T + 1)) }),
    p => ({ FB_Raeumung: raFB('T_Raeum:TOF|Nachlaufzeit', RA_BODY('TOF', p.T).replace('=> NOT #Strasse_frei', '=> #Strasse_frei')) })
  ]
});

const LI_D0 = { in:'Taste:Bool|Lichttaste; Aus:Bool|Betriebsschluss', out:'Licht:Bool' };
const liFB = (stat, body) => kFB('FB_Licht', Object.assign({}, LI_D0, stat ? { stat } : {}), body);
const LI_BODY = (t, o) => { o = o || {};
  return 'NETWORK Umschalten\n' + (o.noEdge ? '#Taste' : 'P(#Taste)') + ' XOR #Licht => #Licht;\n\n' +
    (o.noTimer ? '' : 'NETWORK Automatisch aus\n#Licht AND ' + (o.box || 'TON') + '(#T_Auto, T#' + t + 'S) => R #Licht;\n\n') +
    'NETWORK Betriebsschluss\n#Aus => R #Licht;'; };
defExamTask({ id:'x_fup_p_bahnsteiglicht', quest:'fup', level:'profi', ch:12, diff:3,
  params:{ T:[5, 10] },
  title:'Bahnsteiglicht als Baustein',
  brief: p => 'Programmiere <code>FB_Licht</code>:<br><b>NW 1:</b> Jede steigende Flanke von <code>#Taste</code> schaltet <code>#Licht</code> um (Stromstoss mit X-Box).<br><b>NW 2:</b> Ist <code>#Licht</code> seit <b>' + p.T + ' s</b> an, wird es automatisch zurückgesetzt. Lege die Zeitbox als Static-Variable <code>T_Auto</code> an.<br><b>NW 3:</b> <code>#Aus</code> setzt <code>#Licht</code> zurück.<br><code>Main</code> (🔒) ruft den FB für zwei Bahnsteige mit den Instanzen <code>"Licht1_DB"</code> und <code>"Licht2_DB"</code> auf.',
  blocks: p => [
    { name:'FB_Licht', kind:'FB', edit:true, start: liFB(null, ''), ref: liFB('T_Auto:TON|automatisch aus', LI_BODY(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnsteig 1\n=> "Licht1_DB"(Taste := "Taste_B1", Aus := "Betriebsschluss", Licht => "Licht_B1");\n\nNETWORK Bahnsteig 2\n=> "Licht2_DB"(Taste := "Taste_B2", Aus := "Betriebsschluss", Licht => "Licht_B2");') }
  ],
  instances: () => ({ Licht1_DB:'FB_Licht', Licht2_DB:'FB_Licht' }),
  globals: () => ({ Taste_B1:false, Taste_B2:false, Betriebsschluss:false, Licht_B1:false, Licht_B2:false }),
  must:['EDGE_P','XOR','TON','STAT'],
  visible: () => ({ timed:[{ steps:[[0.1,{ Taste_B1:true },{ Licht_B1:true, Licht_B2:false }],[0.1,{ Taste_B1:false },{ Licht_B1:true }]] }] }),
  hidden: p => ({
    unit:[
      { block:'FB_Licht', steps:[[0,{ Taste:true },{ Licht:true }],[0.5,{},{ Licht:true }],[0.1,{ Taste:false },{ Licht:true }],[0.1,{ Taste:true },{ Licht:false }],[0.1,{ Taste:false },{ Licht:false }],[0.1,{ Taste:true },{ Licht:true }],[p.T,{},{ Licht:false }],[0.1,{},{ Licht:false }]] },
      { block:'FB_Licht', steps:[[0,{ Taste:true },{ Licht:true }],[0.1,{ Taste:false },{ Licht:true }],[p.T - 0.5,{},{ Licht:true }],[0.1,{ Aus:true },{ Licht:false }],[0.1,{ Aus:false, Taste:true },{ Licht:true }]] }
    ],
    timed:[{ steps:[[0.1,{ Taste_B1:true },{ Licht_B1:true, Licht_B2:false }],[0.1,{ Taste_B1:false, Taste_B2:true },{ Licht_B1:true, Licht_B2:true }],[0.1,{ Taste_B2:false, Betriebsschluss:true },{ Licht_B1:false, Licht_B2:false }]] }]
  }),
  wrong:[
    p => ({ FB_Licht: liFB('T_Auto:TON|automatisch aus', LI_BODY(p.T, { noEdge:true })) }),
    p => ({ FB_Licht: liFB(null, LI_BODY(p.T, { noTimer:true })) }),
    p => ({ FB_Licht: liFB('T_Auto:TOF|automatisch aus', LI_BODY(p.T, { box:'TOF' })) })
  ]
});

/* ---------- Kapitel 13: Datenbaustein, PLC-Datentyp, Array ---------- */
const TMP_MAIN = (cmp, lim, move) => MAIN((move === false ? '' : 'NETWORK Messwert\n=> MOVE("Tempo", "DB_Strecke".V_letzt);\n\n') + 'NETWORK Ueberschreitung\n["Tempo" ' + (cmp || '>') + ' ' + (lim || '"DB_Strecke".V_max') + '] => "Warnung";');
defExamTask({ id:'x_fup_p_db_tempo', quest:'fup', level:'profi', ch:13, diff:1,
  params:{ V:[60, 80, 100] },
  title:'Streckengeschwindigkeit aus dem DB',
  brief: p => 'Im globalen DB <code>DB_Strecke</code> (🔒) steht die zulässige Geschwindigkeit <code>V_max</code> (Startwert ' + p.V + ' km/h). Programmiere in <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung MOVE <code>"Tempo"</code> nach <code>"DB_Strecke".V_letzt</code><br><b>NW 2:</b> <code>"Warnung"</code> ist 1, wenn <code>"Tempo"</code> <b>grösser</b> als <code>"DB_Strecke".V_max</code> ist. Lies den Grenzwert aus dem DB – keine feste Zahl.',
  blocks: p => [
    { name:'DB_Strecke', kind:'DB', src: kDB('DB_Strecke', 'V_max:Int := ' + p.V + '|km/h zulässig; V_letzt:Int|letzter Messwert') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: TMP_MAIN() }
  ],
  globals: () => ({ Tempo:0, Warnung:false }),
  must:['DB_ACCESS','CMP','MOVE'],
  visible: p => ({ tests:[[{ Tempo:p.V + 5 }, { Warnung:true, 'DB_Strecke.V_letzt':p.V + 5 }]] }),
  hidden: p => ({ tests:[
    [{ Tempo:p.V }, { Warnung:false, 'DB_Strecke.V_letzt':p.V }],
    [{ Tempo:p.V + 1 }, { Warnung:true }],
    [{ Tempo:0 }, { Warnung:false, 'DB_Strecke.V_letzt':0 }],
    [{ Tempo:p.V - 20, 'DB_Strecke.V_max':p.V - 30 }, { Warnung:true }],
    [{ Tempo:p.V + 10, 'DB_Strecke.V_max':p.V + 20 }, { Warnung:false }],
    [{ Tempo:37 }, { 'DB_Strecke.V_letzt':37 }]
  ] }),
  wrong:[
    p => ({ Main: TMP_MAIN('>', String(p.V)) }),
    () => ({ Main: TMP_MAIN('>=') }),
    () => ({ Main: TMP_MAIN('>', null, false) })
  ]
});

const UDT_SIG = kUDT('UDT_Signal', 'Fahrt:Bool|Fahrtbefehl; Lampe_defekt:Bool|Lampenüberwachung; Gestoert:Bool|Störung Stellwerk');
const SB_D = { in:'Sig:"UDT_Signal"', out:'Gruen:Bool|Fahrtbegriff; Meldung:Bool|Störmeldung' };
const sbFC = body => kFC('FC_Signalbild', 'Void', SB_D, body);
const SB_BODY = 'NETWORK Fahrtbegriff\n#Sig.Fahrt AND NOT #Sig.Lampe_defekt AND NOT #Sig.Gestoert => #Gruen;\n\nNETWORK Stoermeldung\n#Sig.Lampe_defekt OR #Sig.Gestoert => #Meldung;';
defExamTask({ id:'x_fup_p_udt_signal', quest:'fup', level:'profi', ch:13, diff:2,
  title:'Signalbild aus dem PLC-Datentyp',
  brief: () => 'Der PLC-Datentyp <code>UDT_Signal</code> (🔒) enthält <code>Fahrt</code>, <code>Lampe_defekt</code> und <code>Gestoert</code>. Programmiere <code>FC_Signalbild</code> mit dem Input <code>#Sig</code> vom Typ <code>"UDT_Signal"</code>:<br><b>NW 1:</b> <code>#Gruen</code> ist 1, wenn <code>#Sig.Fahrt</code> 1 ist und weder <code>#Sig.Lampe_defekt</code> noch <code>#Sig.Gestoert</code> ansteht.<br><b>NW 2:</b> <code>#Meldung</code> ist 1, wenn <code>#Sig.Lampe_defekt</code> oder <code>#Sig.Gestoert</code> ansteht.<br><code>Main</code> (🔒) ruft die FC für die Signale im DB <code>DB_Signale</code> auf.',
  blocks: () => [
    { name:'UDT_Signal', kind:'UDT', src: UDT_SIG },
    { name:'DB_Signale', kind:'DB', src: kDB('DB_Signale', 'Einfahrt:"UDT_Signal"; Ausfahrt:"UDT_Signal"') },
    { name:'FC_Signalbild', kind:'FC', edit:true, start: sbFC(''), ref: sbFC(SB_BODY) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Einfahrsignal\n=> "FC_Signalbild"(Sig := "DB_Signale".Einfahrt, Gruen => "Einfahrt_Gruen", Meldung => "Einfahrt_Meldung");\n\nNETWORK Ausfahrsignal\n=> "FC_Signalbild"(Sig := "DB_Signale".Ausfahrt, Gruen => "Ausfahrt_Gruen", Meldung => "Ausfahrt_Meldung");') }
  ],
  globals: () => ({ Einfahrt_Gruen:false, Einfahrt_Meldung:false, Ausfahrt_Gruen:false, Ausfahrt_Meldung:false }),
  must:['MEMBER'],
  visible: () => ({ tests:[[{ 'DB_Signale.Einfahrt.Fahrt':true }, { Einfahrt_Gruen:true, Einfahrt_Meldung:false }]] }),
  hidden: () => ({ tests: truth(['DB_Signale.Einfahrt.Fahrt', 'DB_Signale.Einfahrt.Lampe_defekt', 'DB_Signale.Einfahrt.Gestoert'], e => {
      const f = e['DB_Signale.Einfahrt.Fahrt'], l = e['DB_Signale.Einfahrt.Lampe_defekt'], g = e['DB_Signale.Einfahrt.Gestoert'];
      return { Einfahrt_Gruen: f && !l && !g, Einfahrt_Meldung: l || g, Ausfahrt_Gruen:false }; })
    .concat([[{ 'DB_Signale.Ausfahrt.Fahrt':true, 'DB_Signale.Einfahrt.Gestoert':true }, { Ausfahrt_Gruen:true, Ausfahrt_Meldung:false, Einfahrt_Gruen:false, Einfahrt_Meldung:true }]]) }),
  wrong:[
    () => ({ FC_Signalbild: sbFC(SB_BODY.replace(' AND NOT #Sig.Gestoert =>', ' =>')) }),
    () => ({ FC_Signalbild: sbFC(SB_BODY.replace('#Sig.Lampe_defekt OR #Sig.Gestoert', '#Sig.Lampe_defekt AND #Sig.Gestoert')) }),
    () => ({ FC_Signalbild: sbFC('NETWORK Fahrtbegriff\n#Sig.Fahrt => #Gruen;\n\nNETWORK Stoermeldung\n#Sig.Lampe_defekt OR #Sig.Gestoert => #Meldung;') })
  ]
});

const ZL_NW = (m, o) => { o = o || {};
  return 'NETWORK Wagen 1 und 2\n=> ADD("DB_Zug".Laenge[1], "DB_Zug".Laenge[2], "Zuglaenge");\n\nNETWORK Wagen 3\n=> ADD("Zuglaenge", "DB_Zug".Laenge[3], "Zuglaenge");\n\n' +
    (o.skip4 ? '' : 'NETWORK Wagen 4\n=> ADD("Zuglaenge", "DB_Zug".Laenge[4], "Zuglaenge");\n\n') + 'NETWORK Zu lang\n["Zuglaenge" ' + (o.cmp || '>') + ' ' + m + '] => "Zu_lang";'; };
defExamTask({ id:'x_fup_p_zuglaenge', quest:'fup', level:'profi', ch:13, diff:3,
  params:{ M:[80, 100] },
  title:'Zuglänge aus dem Array',
  brief: p => 'Im DB <code>DB_Zug</code> (🔒) stehen die Längen der vier Wagen im Array <code>Laenge : Array[1..4] of Int</code> (Meter). Programmiere in <code>Main</code>:<br><b>NW 1–3:</b> <code>"Zuglaenge"</code> = Summe aller <b>vier</b> Elemente (ADD-Boxen, ohne Bedingung). Das Ergebnis muss im selben Zyklus stimmen.<br><b>NW 4:</b> <code>"Zu_lang"</code> ist 1, wenn <code>"Zuglaenge"</code> <b>grösser als ' + p.M + '</b> ist.',
  blocks: p => [
    { name:'DB_Zug', kind:'DB', src: kDB('DB_Zug', 'Laenge:Array[1..4] of Int|Wagenlängen in m') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(ZL_NW(p.M)) }
  ],
  globals: () => ({ Zuglaenge:0, Zu_lang:false }),
  must:['ARRAY','ADD','CMP'],
  visible: () => ({ tests:[[{ 'DB_Zug.Laenge[1]':20, 'DB_Zug.Laenge[2]':15 }, { Zuglaenge:35, Zu_lang:false }]] }),
  hidden: p => { const L = (a, b, c, d) => ({ 'DB_Zug.Laenge[1]':a, 'DB_Zug.Laenge[2]':b, 'DB_Zug.Laenge[3]':c, 'DB_Zug.Laenge[4]':d });
    return { tests:[
      [L(20, 20, 20, p.M - 60), { Zuglaenge:p.M, Zu_lang:false }],
      [L(20, 20, 20, p.M - 59), { Zuglaenge:p.M + 1, Zu_lang:true }],
      [L(0, 0, 0, p.M + 5), { Zuglaenge:p.M + 5, Zu_lang:true }],
      [L(15, 0, 0, 0), { Zuglaenge:15, Zu_lang:false }],
      [L(0, 30, 25, 0), { Zuglaenge:55, Zu_lang:false }],
      [L(0, 0, 0, 0), { Zuglaenge:0, Zu_lang:false }]
    ] }; },
  wrong:[
    p => ({ Main: MAIN(ZL_NW(p.M, { skip4:true })) }),
    p => ({ Main: MAIN(ZL_NW(p.M, { cmp:'>=' })) })
  ]
});

/* ---------- Kapitel 14: Standardbausteine ---------- */
const ZS_D = { in:'Anf:Bool|Fahrtanforderung; Halt:Bool|Halttaste; Weg_frei:Bool|Fahrweg frei; Lampe_ok:Bool|Lampenüberwachung; Quitt:Bool|Quittiertaste', out:'Fahrt:Bool|Signal zeigt Fahrt; Stoerung:Bool|Lampenstörung gespeichert' };
const ZS_ST = 'NETWORK Lampenstoerung\nNOT #Lampe_ok => RS(#Stoerung, #Quitt);';
const ZS_FA = 'NETWORK Fahrt\n(#Anf OR #Fahrt) AND NOT #Halt AND #Weg_frei AND NOT #Stoerung => #Fahrt;';
const zsFB = body => kFB('FB_Zwergsignal', ZS_D, body);
defExamTask({ id:'x_fup_p_zwergsignal', quest:'fup', level:'profi', ch:14, diff:2,
  title:'Standardbaustein Zwergsignal',
  brief: () => 'Programmiere den Standardbaustein <code>FB_Zwergsignal</code> (Rangiersignal):<br><b>NW 1:</b> Fällt <code>#Lampe_ok</code> auf 0, wird <code>#Stoerung</code> gespeichert. <code>#Quitt</code> setzt zurück; steht die Lampenstörung noch an, bleibt <code>#Stoerung</code> gesetzt (Setzen dominant).<br><b>NW 2:</b> <code>#Anf</code> schaltet <code>#Fahrt</code> ein (Selbsthaltung). <code>#Fahrt</code> fällt ab bei <code>#Halt</code>, wenn <code>#Weg_frei</code> 0 wird oder wenn <code>#Stoerung</code> ansteht.<br><code>Main</code> (🔒) ruft den FB für das Zwergsignal Z12 auf.',
  blocks: () => [
    { name:'FB_Zwergsignal', kind:'FB', edit:true, start: zsFB(''), ref: zsFB(ZS_ST + '\n\n' + ZS_FA) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Zwergsignal Z12\n=> "FB_Zwergsignal_DB"(Anf := "Taste_Z12", Halt := "Halt_Z12", Weg_frei := "Weg_Z12_frei", Lampe_ok := "Lampe_Z12_ok", Quitt := "Quittieren", Fahrt => "Z12_Fahrt", Stoerung => "Z12_Stoerung");') }
  ],
  globals: () => ({ Taste_Z12:false, Halt_Z12:false, Weg_Z12_frei:false, Lampe_Z12_ok:false, Quittieren:false, Z12_Fahrt:false, Z12_Stoerung:false }),
  must:['RS','PARALLEL','NC'],
  visible: () => ({ unit:[{ block:'FB_Zwergsignal', steps:[[0,{ Lampe_ok:true, Weg_frei:true, Anf:true },{ Fahrt:true, Stoerung:false }],[0.1,{ Anf:false },{ Fahrt:true }]] }] }),
  hidden: () => ({
    unit:[{ block:'FB_Zwergsignal', steps:[[0,{ Lampe_ok:true, Weg_frei:true, Anf:true },{ Fahrt:true, Stoerung:false }],[0.1,{ Anf:false },{ Fahrt:true }],[0.1,{ Halt:true },{ Fahrt:false }],[0.1,{ Halt:false },{ Fahrt:false }],[0.1,{ Anf:true },{ Fahrt:true }],
      [0.1,{ Anf:false, Lampe_ok:false },{ Stoerung:true, Fahrt:false }],[0.1,{ Quitt:true },{ Stoerung:true }],[0.1,{ Lampe_ok:true },{ Stoerung:false }],[0.1,{ Quitt:false, Anf:true },{ Fahrt:true }],[0.1,{ Weg_frei:false },{ Fahrt:false }]] }],
    timed:[{ steps:[[0.1,{ Lampe_Z12_ok:true, Weg_Z12_frei:true, Taste_Z12:true },{ Z12_Fahrt:true }],[0.1,{ Taste_Z12:false },{ Z12_Fahrt:true }],[0.1,{ Lampe_Z12_ok:false },{ Z12_Fahrt:false, Z12_Stoerung:true }]] }]
  }),
  wrong:[
    () => ({ FB_Zwergsignal: zsFB(ZS_ST.replace('RS(', 'SR(') + '\n\n' + ZS_FA) }),
    () => ({ FB_Zwergsignal: zsFB(ZS_ST + '\n\n' + ZS_FA.replace('(#Anf OR #Fahrt)', '#Anf')) }),
    () => ({ FB_Zwergsignal: zsFB(ZS_FA + '\n\n' + ZS_ST) })
  ]
});

const BK_D0 = { in:'Einschalt:Bool|Zug meldet sich an; Ausschalt:Bool|Zug hat den Übergang verlassen', out:'Blinklicht:Bool; Glocke:Bool; Schranke_zu:Bool' };
const bkFB = (stat, body) => kFB('FB_BUE_Ost', Object.assign({}, BK_D0, stat ? { stat } : {}), body);
const BK_BODY = (v, o) => { o = o || {};
  return 'NETWORK Anlage ein\n#Einschalt => ' + (o.ff || 'SR') + '(#Blinklicht, #Ausschalt);\n\nNETWORK Glocke\n#Blinklicht AND ' + (o.bell || 'TP') + '(#T_Glocke, T#2S) => #Glocke;\n\nNETWORK Schranke\n#Blinklicht AND ' + (o.bar || 'TON') + '(#T_Vorlauf, T#' + v + 'S) => #Schranke_zu;'; };
const BK_STAT = o => { o = o || {}; return 'T_Glocke:' + (o.bell || 'TP') + '|Läutezeit; T_Vorlauf:' + (o.bar || 'TON') + '|Vorlaufzeit'; };
defExamTask({ id:'x_fup_p_bue_ost', quest:'fup', level:'profi', ch:14, diff:3,
  params:{ V:[3, 4, 5] },
  title:'Standardbaustein Bahnübergang',
  brief: p => 'Programmiere <code>FB_BUE_Ost</code>. Lege die Zeitboxen als Static-Variablen <code>T_Glocke</code> und <code>T_Vorlauf</code> an.<br><b>NW 1:</b> <code>#Einschalt</code> setzt <code>#Blinklicht</code>, <code>#Ausschalt</code> setzt zurück (Rücksetzen dominant).<br><b>NW 2:</b> Mit dem Einschalten des Blinklichts läutet <code>#Glocke</code> genau <b>2 s</b>.<br><b>NW 3:</b> <code>#Schranke_zu</code> wird <b>' + p.V + ' s</b> nach dem Einschalten des Blinklichts 1 und fällt mit dem Blinklicht ab.<br><code>Main</code> (🔒) ruft den FB mit <code>"FB_BUE_Ost_DB"</code> auf.',
  blocks: p => [
    { name:'FB_BUE_Ost', kind:'FB', edit:true, start: bkFB(null, ''), ref: bkFB(BK_STAT(), BK_BODY(p.V)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang Ost\n=> "FB_BUE_Ost_DB"(Einschalt := "ES_Ost", Ausschalt := "AS_Ost", Blinklicht => "BUE_Blink", Glocke => "BUE_Glocke", Schranke_zu => "BUE_Schranke");') }
  ],
  globals: () => ({ ES_Ost:false, AS_Ost:false, BUE_Blink:false, BUE_Glocke:false, BUE_Schranke:false }),
  must:['SR','TP','TON','STAT'],
  visible: () => ({ timed:[{ steps:[[0.1,{ ES_Ost:true },{ BUE_Blink:true, BUE_Glocke:true, BUE_Schranke:false }]] }] }),
  hidden: p => ({
    unit:[
      { block:'FB_BUE_Ost', steps:[[0,{ Einschalt:true },{ Blinklicht:true, Glocke:true, Schranke_zu:false }],[0.5,{ Einschalt:false },{ Blinklicht:true, Glocke:true, Schranke_zu:false }],[1.6,{},{ Glocke:false }],[p.V - 2,{},{ Schranke_zu:true }],[1,{ Ausschalt:true },{ Blinklicht:false, Schranke_zu:false, Glocke:false }],[0.1,{ Ausschalt:false },{ Blinklicht:false }]] },
      { block:'FB_BUE_Ost', steps:[[0,{ Einschalt:true, Ausschalt:true },{ Blinklicht:false }],[0.1,{ Ausschalt:false },{ Blinklicht:true, Glocke:true }],[p.V - 0.5,{},{ Schranke_zu:false }],[0.6,{},{ Schranke_zu:true }]] }
    ],
    timed:[{ steps:[[0.1,{ ES_Ost:true },{ BUE_Blink:true, BUE_Schranke:false }],[p.V + 0.1,{ ES_Ost:false },{ BUE_Schranke:true, BUE_Glocke:false }],[0.1,{ AS_Ost:true },{ BUE_Blink:false, BUE_Schranke:false }]] }]
  }),
  wrong:[
    p => ({ FB_BUE_Ost: bkFB(BK_STAT(), BK_BODY(p.V, { ff:'RS' })) }),
    p => ({ FB_BUE_Ost: bkFB(BK_STAT({ bar:'TOF' }), BK_BODY(p.V, { bar:'TOF' })) }),
    p => ({ FB_BUE_Ost: bkFB(BK_STAT({ bell:'TON' }), BK_BODY(p.V, { bell:'TON' })) })
  ]
});

/* ---------- Kapitel 15: OB1/OB100, Programmierstandard ---------- */
const AN_MAIN = MAIN('NETWORK Anlauf quittieren\n"Quittieren" => R "Anlaufmeldung";\n\nNETWORK Tempo\n["Tempo" > "DB_Betrieb".V_zul] => "Warnung";');
defExamTask({ id:'x_fup_p_anlauf', quest:'fup', level:'profi', ch:15, diff:1, timed:true,
  params:{ V:[40, 60, 80] },
  title:'Anlauf des Stellwerks',
  brief: p => 'Programmiere den Anlauf-OB <code>Startup</code> [OB100], alle Netzwerke <b>ohne Bedingung</b>:<br><b>NW 1:</b> MOVE ' + p.V + ' nach <code>"DB_Betrieb".V_zul</code><br><b>NW 2:</b> S <code>"Anlaufmeldung"</code><br><code>Main</code> (🔒) quittiert die Anlaufmeldung und überwacht das Tempo.',
  blocks: p => [
    { name:'DB_Betrieb', kind:'DB', src: kDB('DB_Betrieb', 'V_zul:Int|km/h zulässig') },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: STARTUP(''), ref: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + p.V + ', "DB_Betrieb".V_zul);\n\nNETWORK Anlaufmeldung\n=> S "Anlaufmeldung";') },
    { name:'Main', kind:'OB', src: AN_MAIN }
  ],
  globals: () => ({ Tempo:0, Quittieren:false, Anlaufmeldung:false, Warnung:false }),
  must:['STARTUP','MOVE'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{ Anlaufmeldung:true, 'DB_Betrieb.V_zul':p.V }]] }] }),
  hidden: p => ({ timed:[
    { steps:[[0.1,{},{ Anlaufmeldung:true, Warnung:false, 'DB_Betrieb.V_zul':p.V }],[0.1,{ Quittieren:true },{ Anlaufmeldung:false }],[0.1,{ Quittieren:false },{ Anlaufmeldung:false }]] },
    { steps:[[0.1,{ Tempo:p.V },{ Warnung:false }],[0.1,{ Tempo:p.V + 1 },{ Warnung:true }],[0.1,{ Tempo:p.V - 5 },{ Warnung:false }]] },
    { steps:[[0.1,{ Tempo:p.V + 1, Quittieren:true },{ Anlaufmeldung:false, Warnung:true }]] }
  ] }),
  wrong:[
    p => ({ Startup: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + p.V + ', "DB_Betrieb".V_zul);') }),
    p => ({ Startup: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + (p.V + 10) + ', "DB_Betrieb".V_zul);\n\nNETWORK Anlaufmeldung\n=> S "Anlaufmeldung";') }),
    p => ({ Startup: STARTUP('NETWORK Geschwindigkeit\n=> MOVE(' + p.V + ', "DB_Betrieb".V_zul);\n\nNETWORK Anlaufmeldung\n=> R "Anlaufmeldung";') })
  ]
});

const LZ_D = { in:'Laeuft:Bool|Weiche läuft; Quitt:Bool|Quittiertaste', out:'Stoerung:Bool|Laufzeit überschritten' };
const lzFB = (stat, body) => kFB('FB_Laufzeit', Object.assign({}, LZ_D, { stat }), body);
const LZ_STAT = 'T_Lauf:TON|Laufzeitüberwachung';
const LZ_BODY = (t, o) => { o = o || {}; return 'NETWORK Laufzeit\n' + (o.inp || '#Laeuft') + ' AND TON(#T_Lauf, T#' + t + 'S) => ' + (o.ff || 'RS') + '(#Stoerung, ' + (o.q || '#Quitt') + ');'; };
defExamTask({ id:'x_fup_p_standard', quest:'fup', level:'profi', ch:15, diff:2, warnFree:['GLOBAL_ACCESS','UNUSED_VAR'],
  params:{ T:[5, 8] },
  title:'Laufzeitbaustein nach Standard',
  brief: p => '<code>FB_Laufzeit</code> überwacht die Laufzeit von Weiche 2, liest aber globale Variablen direkt – in einer anderen Anlage oder mit einem zweiten Aufruf funktioniert er so nicht. Er soll <b>nur über seine Schnittstelle</b> arbeiten (<code>#Laeuft</code>, <code>#Quitt</code>); geprüft wird er auch einzeln mit eigenen Werten. Ziel des Standards: keine Warnung mehr (z. B. die unbenutzte Variable <code>Reserve</code> löschen).<br>Funktion: Läuft die Weiche länger als <b>' + p.T + ' s</b>, wird <code>#Stoerung</code> gespeichert. <code>#Quitt</code> setzt zurück, die anstehende Störung hat Vorrang (Setzen dominant).',
  blocks: p => [
    { name:'FB_Laufzeit', kind:'FB', edit:true, start: lzFB(LZ_STAT + '; Reserve:Int', LZ_BODY(p.T, { inp:'"W2_laeuft"', q:'"Quittieren"' })), ref: lzFB(LZ_STAT, LZ_BODY(p.T)) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 2\n=> "FB_Laufzeit_DB"(Laeuft := "W2_laeuft", Quitt := "Quittieren", Stoerung => "W2_Stoerung");') }
  ],
  globals: () => ({ W2_laeuft:false, Quittieren:false, W2_Stoerung:false }),
  must:['TON','RS'],
  visible: p => ({ timed:[{ steps:[[0.1,{ W2_laeuft:true },{ W2_Stoerung:false }],[p.T + 0.1,{},{ W2_Stoerung:true }]] }] }),
  hidden: p => ({
    unit:[{ block:'FB_Laufzeit', steps:[[0,{ Laeuft:true },{ Stoerung:false }],[p.T - 0.5,{},{ Stoerung:false }],[0.6,{},{ Stoerung:true }],[0.1,{ Laeuft:false },{ Stoerung:true }],[0.1,{ Quitt:true },{ Stoerung:false }],[0.1,{ Quitt:false, Laeuft:true },{ Stoerung:false }],[p.T + 0.1,{ Quitt:true },{ Stoerung:true }]] }],
    timed:[{ steps:[[0.1,{ W2_laeuft:true },{ W2_Stoerung:false }],[p.T + 0.1,{},{ W2_Stoerung:true }],[0.1,{ W2_laeuft:false, Quittieren:true },{ W2_Stoerung:false }]] }]
  }),
  wrong:[
    p => ({ FB_Laufzeit: lzFB(LZ_STAT, LZ_BODY(p.T, { q:'"Quittieren"' })) }),
    p => ({ FB_Laufzeit: lzFB(LZ_STAT, LZ_BODY(p.T, { ff:'SR' })) })
  ]
});

/* =====================================================================
   FRAGEN — GRUNDSTUFE
   ===================================================================== */
const Q = (id, level, ch, q, options, answer) => defExamQuestion({ id, quest:'fup', level, ch, q, options, answer: answer || 0 });

// Kapitel 1
Q('xq_fup_g_und4', 'grund', 1, 'Eine &amp;-Box hat die Eingänge <code>1</code>, <code>1</code>, <code>1</code> und <code>0</code>. Was liefert ihr Ausgang?', ['0', '1', 'Den Wert des letzten Zyklus', 'Einen Fehler, weil eine &amp;-Box nur zwei Eingänge hat']);
Q('xq_fup_g_zyklus', 'grund', 1, 'In welcher Reihenfolge bearbeitet die CPU die Netzwerke eines Bausteins im zyklischen Betrieb?', ['Von oben nach unten, Netzwerk für Netzwerk, in jedem Zyklus', 'Nur die Netzwerke, deren Eingänge sich geändert haben', 'Von unten nach oben', 'Alle Netzwerke gleichzeitig und unabhängig voneinander']);
Q('xq_fup_g_zuweisung', 'grund', 1, 'Wie wird im FUP eine Zuweisung dargestellt?', ['Als Box „=“ am Ende der Verknüpfung, der Operand steht darüber', 'Als Kontakt am Anfang des Netzwerks', 'Als Kommentar im Netzwerktitel', 'Als Zeile in der Variablentabelle']);
Q('xq_fup_g_doppelt', 'grund', 1, 'Zwei Netzwerke schreiben mit je einer Zuweisung auf denselben Operanden <code>Signal_A</code>. Welcher Wert steht am Zyklusende darin?', ['Das Ergebnis des unteren, zuletzt bearbeiteten Netzwerks', 'Die ODER-Verknüpfung beider Ergebnisse', 'Das Ergebnis des oberen Netzwerks', 'Die CPU geht in STOP']);
// Kapitel 2
Q('xq_fup_g_xor', 'grund', 2, 'Wann liefert eine X-Box (XOR) mit zwei Eingängen eine 1?', ['Wenn genau ein Eingang 1 ist', 'Wenn beide Eingänge 1 sind', 'Wenn mindestens ein Eingang 1 ist', 'Wenn beide Eingänge 0 sind']);
Q('xq_fup_g_oder_symbol', 'grund', 2, 'Mit welchem Symbol ist die ODER-Box im FUP beschriftet?', ['&gt;=1', '&amp;', 'X', 'OR']);
Q('xq_fup_g_negation', 'grund', 2, 'Wie wird im FUP ein negierter Eingang einer Box dargestellt?', ['Durch einen kleinen Kreis am Eingang der Box', 'Durch einen Schrägstrich im Operanden', 'Durch eine eigene Box nach jeder Verknüpfung', 'Durch ein Minuszeichen vor dem Operanden']);
Q('xq_fup_g_vorrang_xor', 'grund', 2, 'Wie wird <code>A XOR B AND C</code> ausgewertet (Vorrang wie in TIA/SCL)?', ['A XOR (B AND C)', '(A XOR B) AND C', '(A AND C) XOR B', 'Strikt von links nach rechts ohne Vorrang']);
// Kapitel 3
Q('xq_fup_g_ein_vorrang', 'grund', 3, 'Wie ist eine Selbsthaltung mit <b>Ein-Vorrang</b> aufgebaut?', ['Die Ein-Taste liegt parallel (ODER) zur Kombination aus Rückführung und Aus-Bedingung', 'Die Ein-Taste liegt in Reihe (UND) hinter der Aus-Bedingung', 'Die Ein-Taste liegt an einem negierten Eingang', 'Ohne Rückführung, nur mit der Ein-Taste']);
Q('xq_fup_g_drahtbruch', 'grund', 3, 'Warum wird eine Halt-Taste meist als Öffner angeschlossen und im Programm auf 1 (nicht betätigt) abgefragt?', ['Damit ein Drahtbruch wie ein Halt-Befehl wirkt (drahtbruchsicher)', 'Weil Öffner billiger sind', 'Weil die SPS keine Schliesser lesen kann', 'Damit die Taste schneller reagiert']);
Q('xq_fup_g_verriegelung', 'grund', 3, 'Was verhindert die gegenseitige Verriegelung zweier Antriebsrichtungen (z.B. Weiche links/rechts)?', ['Dass beide Richtungen gleichzeitig angesteuert werden', 'Dass der Antrieb überhaupt anläuft', 'Dass die Selbsthaltung wirkt', 'Dass die Endlage gemeldet wird']);
Q('xq_fup_g_rueckfuehrung', 'grund', 3, 'Die Selbsthaltung <code>(Taste OR Q) AND NOT Stopp => Q</code> ist eingeschaltet. Die Taste wird losgelassen, <code>Stopp</code> bleibt 0. Was geschieht?', ['Q bleibt 1 über die Rückführung', 'Q fällt auf 0', 'Q wechselt in jedem Zyklus', 'Q wird erst nach einem Neustart 0']);
// Kapitel 4
Q('xq_fup_g_sr', 'grund', 4, 'In einer SR-Box liegen S und R gleichzeitig an. Welchen Zustand hat Q?', ['0 – Rücksetzen ist dominant', '1 – Setzen ist dominant', 'Q wechselt jeden Zyklus', 'Q behält den alten Wert']);
Q('xq_fup_g_rs_nur_r', 'grund', 4, 'An einer RS-Box ist nur der Rücksetzeingang R = 1, der Setzeingang S1 ist 0. Welchen Zustand hat Q?', ['0', '1', 'Q behält den alten Wert', 'Q wechselt jeden Zyklus']);
Q('xq_fup_g_s_vs_zuw', 'grund', 4, 'Was unterscheidet eine Setzen-Box (S) von einer Zuweisung (=)?', ['S schreibt nur bei 1 am Eingang und lässt den Operanden bei 0 unverändert; = schreibt in jedem Zyklus', '= speichert den Wert, S nicht', 'Es gibt keinen Unterschied', 'S schreibt nur bei 0 am Eingang']);
Q('xq_fup_g_s_r_netze', 'grund', 4, 'Ein Operand wird in Netzwerk 1 gesetzt (S) und in Netzwerk 2 rückgesetzt (R). Beide Bedingungen sind 1. Welcher Wert steht am Zyklusende im Operanden?', ['0 – das später bearbeitete Netzwerk gewinnt', '1 – Setzen hat immer Vorrang', 'Der Wert des letzten Zyklus', 'Der Compiler meldet einen Fehler']);
// Kapitel 5
Q('xq_fup_g_nbox', 'grund', 5, 'Was liefert die Auswertung einer negativen Flanke (N)?', ['Für genau einen Zyklus 1, wenn das Signal von 1 auf 0 wechselt', 'Dauernd 1, solange das Signal 0 ist', 'Für einen Zyklus 1 beim Wechsel von 0 auf 1', 'Das invertierte Signal']);
Q('xq_fup_g_flankenmerker', 'grund', 5, 'Wozu braucht eine P-Box in TIA einen eigenen Operanden als Flankenmerker?', ['Er speichert den Signalzustand des vorherigen Zyklus', 'Er misst die Zykluszeit', 'Er ist der Ausgang für die Anzeige', 'Er negiert die Flanke']);
Q('xq_fup_g_merker_doppelt', 'grund', 5, 'Warum darf ein Flankenmerker nicht für zwei verschiedene Flankenauswertungen benutzt werden?', ['Die Auswertungen überschreiben sich gegenseitig den gespeicherten Zustand, Flanken gehen verloren', 'Weil nur ein Merker pro Baustein erlaubt ist', 'Weil die Flanken dann doppelt so lang sind', 'Das ist erlaubt und üblich']);
Q('xq_fup_g_toggle_halten', 'grund', 5, 'Ein Stromstossschalter <code>P(Taste) XOR Licht => Licht</code>: Die Taste bleibt 5 Zyklen gedrückt. Wie oft schaltet <code>Licht</code> um?', ['Einmal, im ersten Zyklus', 'Fünfmal', 'Keinmal', 'Zweimal, beim Drücken und beim Loslassen']);
// Kapitel 6
Q('xq_fup_g_tp_nachtrigger', 'grund', 6, 'Eine TP-Box (PT = 2 s) erhält während des laufenden Impulses eine neue steigende Flanke. Was passiert?', ['Nichts, der laufende Impuls wird nicht nachgetriggert', 'Der Impuls beginnt von vorn', 'Der Ausgang fällt sofort ab', 'Die Impulszeit verdoppelt sich']);
Q('xq_fup_g_et', 'grund', 6, 'Welcher Ausgang einer Zeitbox zeigt die bereits abgelaufene Zeit?', ['ET', 'Q', 'PT', 'IN']);
Q('xq_fup_g_tof_dauer', 'grund', 6, 'Eine TOF-Box (PT = 5 s): IN ist seit 10 s ununterbrochen 1. Was liefert Q?', ['1', '0', '1 nur während der ersten 5 s, dann 0', 'Q blinkt im Takt von 5 s']);
Q('xq_fup_g_zeitformat', 'grund', 6, 'Welche Dauer beschreibt die Zeitkonstante <code>T#1M30S</code>?', ['90 Sekunden', '1,3 Sekunden', '130 Sekunden', '1 Millisekunde und 30 Sekunden']);
// Kapitel 7
Q('xq_fup_g_laufzeit_zweck', 'grund', 7, 'Welchen Zweck hat eine Laufzeitüberwachung an einem Weichen- oder Schrankenantrieb?', ['Sie meldet eine Störung, wenn die Endlage nicht innerhalb der erwarteten Zeit erreicht wird', 'Sie begrenzt die Zykluszeit der CPU', 'Sie verzögert das Umstellen des Antriebs', 'Sie zählt die Umstellungen']);
Q('xq_fup_g_vorlaeuten_box', 'grund', 7, 'Beim Vorläuten läutet die Glocke ab der Einschaltung, die Schranke senkt sich erst 4 s später. Welche Box verzögert den Beginn des Senkens?', ['TON', 'TOF', 'TP', 'CTU']);
Q('xq_fup_g_wechsel_lampen', 'grund', 7, 'Wechselblinker: Lampe 1 hängt an <code>Blink</code>, Lampe 2 an <code>NOT Blink</code> (beide nur bei Zugmeldung). Was gilt, solange der Blinker läuft?', ['Immer genau eine der beiden Lampen leuchtet', 'Beide Lampen leuchten gleichzeitig', 'Beide Lampen sind dunkel', 'Lampe 2 leuchtet nur beim Einschalten']);
Q('xq_fup_g_blink_frequenz', 'grund', 7, 'Ein Taktgeber besteht aus einer TON-Box mit negierter Rückführung ihres Ausgangs. Die Blinkfrequenz soll halbiert werden. Was änderst du?', ['Die Zeit PT verdoppeln', 'Die TON-Box durch eine TOF-Box ersetzen', 'Die Negation der Rückführung entfernen', 'Eine zweite Zuweisung anschliessen']);
// Kapitel 8
Q('xq_fup_g_ctu_ueber', 'grund', 8, 'Ein CTU mit PV = 5 steht bei CV = 5. Es kommt ein weiterer Zählimpuls. Was gilt danach?', ['CV = 6, Q bleibt 1', 'CV bleibt 5, Q = 1', 'CV = 0, Q = 0', 'CV = 6, Q = 0']);
Q('xq_fup_g_ctu_r', 'grund', 8, 'Was bewirkt der Eingang R einer CTU-Box?', ['Er setzt den Zählwert CV auf 0', 'Er lädt PV in den Zählwert', 'Er zählt rückwärts', 'Er hält den Zähler an, CV bleibt stehen']);
Q('xq_fup_g_ctd_q', 'grund', 8, 'Wann ist der Ausgang Q einer CTD-Box 1?', ['Wenn CV kleiner oder gleich 0 ist', 'Wenn CV grösser oder gleich PV ist', 'Bei jedem Zählimpuls', 'Solange LD = 1 ist']);
Q('xq_fup_g_achse_einmal', 'grund', 8, 'Ein Rad steht mehrere Zyklen auf dem Radsensor. Warum wird die Achse trotzdem nur einmal gezählt?', ['Die Zählbox zählt nur die steigende Flanke an ihrem Zähleingang', 'Weil der Sensor nur einen Zyklus lang 1 liefert', 'Weil die CPU den Zähler nach jedem Zyklus sperrt', 'Weil PV die Zählung begrenzt']);
// Kapitel 9
Q('xq_fup_g_cmp_le', 'grund', 9, 'Welcher Vergleich liefert 1 für <code>Tempo = 80</code>, aber 0 für <code>Tempo = 81</code>?', ['Tempo &lt;= 80', 'Tempo &lt; 80', 'Tempo &gt;= 80', 'Tempo &lt;&gt; 80']);
Q('xq_fup_g_move_en', 'grund', 9, 'Was macht eine MOVE-Box, wenn ihr Freigabeeingang EN 1 ist?', ['Sie kopiert den Wert von IN nach OUT1', 'Sie addiert IN zu OUT1', 'Sie schreibt 0 nach OUT1', 'Sie vertauscht IN und OUT1']);
Q('xq_fup_g_div_int', 'grund', 9, 'Eine DIV-Box rechnet mit Int: IN1 = 7, IN2 = 2. Was steht in OUT?', ['3', '3,5', '4', '1']);
Q('xq_fup_g_ueberlauf', 'grund', 9, 'Eine Int-Variable steht bei 32767. Eine ADD-Box addiert 1 und schreibt zurück. Was steht danach in der Variable?', ['-32768', '32768', '32767', '0']);
// Kapitel 10
Q('xq_fup_g_fs_ablauf', 'grund', 10, 'In welcher Reihenfolge wird eine Zugfahrstrasse bearbeitet?', ['Einstellen, sichern (festlegen), Signal auf Fahrt, auflösen', 'Signal auf Fahrt, einstellen, sichern, auflösen', 'Auflösen, einstellen, Signal auf Fahrt, sichern', 'Sichern, Signal auf Fahrt, einstellen, auflösen']);
Q('xq_fup_g_zugschluss', 'grund', 10, 'Was bedeutet Zugschlussauflösung einer Fahrstrasse?', ['Sie wird erst aufgelöst, wenn der ganze Zug den Fahrweg verlassen hat', 'Das Signal fällt schon beim Einstellen auf Halt', 'Sie wird nach einer festen Zeit aufgelöst', 'Der Fahrdienstleiter muss sie immer von Hand auflösen']);
Q('xq_fup_g_feindlich', 'grund', 10, 'Wie wird im Programm verhindert, dass zwei feindliche Fahrstrassen gleichzeitig eingestellt werden?', ['Jede Fahrstrasse erhält die negierte Meldung der anderen als Einstellbedingung', 'Beide Fahrstrassen benutzen dieselbe Speicherbox', 'Mit einer TOF-Box an beiden Tasten', 'Mit einer P-Flanke an beiden Tasten']);
Q('xq_fup_g_notaufl', 'grund', 10, 'Die Notauflösetaste einer Fahrstrasse muss einige Sekunden gedrückt bleiben, bevor sie wirkt. Womit wird das umgesetzt?', ['Mit einer TON-Box hinter der Taste', 'Mit einer TP-Box hinter der Taste', 'Mit einer N-Flanke an der Taste', 'Mit einer CTD-Box']);

/* =====================================================================
   FRAGEN — PROFI-STUFE
   ===================================================================== */
// Kapitel 11
Q('xq_fup_p_void', 'profi', 11, 'Welchen Rückgabetyp hat eine FC, die keinen Rückgabewert liefert?', ['Void', 'Bool', 'Int', 'None']);
Q('xq_fup_p_fc_out', 'profi', 11, 'Ein Output einer FC wird nur in manchen Fällen beschrieben. Was ist das Risiko?', ['Der Output kann einen undefinierten Wert liefern, weil eine FC kein Gedächtnis hat', 'Die CPU geht sofort in STOP', 'Der Output behält sicher den Wert des letzten Aufrufs', 'Kein Risiko, Outputs sind automatisch 0']);
Q('xq_fup_p_fc_versorgen', 'profi', 11, 'Welche Parameter müssen an der Aufruf-Box einer FC versorgt werden?', ['Alle Formalparameter (Input, Output, InOut)', 'Nur die Inputs', 'Nur die Outputs', 'Keine, nicht versorgte Parameter werden 0']);
Q('xq_fup_p_formal', 'profi', 11, 'Was unterscheidet einen Formalparameter von einem Aktualparameter?', ['Der Formalparameter steht in der Schnittstelle, der Aktualparameter ist das beim Aufruf angeschlossene Signal', 'Formalparameter sind global, Aktualparameter lokal', 'Aktualparameter gibt es nur bei FBs', 'Beide Begriffe bedeuten dasselbe']);
Q('xq_fup_p_temp_zweck', 'profi', 11, 'In welchem Bereich der Schnittstelle deklarierst du ein Zwischenergebnis, das nur während eines Aufrufs gebraucht wird?', ['Temp', 'Static', 'InOut', 'Constant']);
Q('xq_fup_p_fc_nutzen', 'profi', 11, 'Warum lohnt es sich, gleiche Logik (z.B. für mehrere Signale) in eine FC zu packen und mehrfach aufzurufen?', ['Die Logik existiert nur einmal, eine Änderung wirkt an allen Aufrufstellen', 'Weil der OB1 sonst zu wenige Netzwerke hat', 'Weil eine FC schneller rechnet als ein Netzwerk im OB1', 'Weil globale Variablen im OB1 verboten sind']);
// Kapitel 12
Q('xq_fup_p_multi', 'profi', 12, 'Was ist eine Multiinstanz?', ['Eine FB-Instanz, die in den statischen Daten eines anderen FB liegt', 'Ein FB, der mehrere OBs aufruft', 'Eine FC mit mehreren Rückgabewerten', 'Ein Datenbaustein mit mehreren Arrays']);
Q('xq_fup_p_stat_ort', 'profi', 12, 'Wo speichert ein FB bei einem Einzelaufruf seine statischen Variablen?', ['Im zugehörigen Instanz-DB', 'Im Temp-Bereich', 'Im OB1', 'In einem globalen Merker']);
Q('xq_fup_p_input_offen', 'profi', 12, 'Ein Input eines FB wird beim Aufruf nicht versorgt. Welchen Wert verwendet der FB?', ['Den im Instanz-DB gespeicherten Wert (zuletzt übergeben oder Startwert)', 'Immer 0', 'Einen Zufallswert', 'Der Aufruf wird übersprungen']);
Q('xq_fup_p_multi_vorteil', 'profi', 12, 'Welchen Vorteil hat es, wenn die Timer eines FB als Multiinstanzen in seinem Static-Bereich liegen?', ['Jede Instanz des FB bringt automatisch ihre eigenen Timer mit', 'Die Timer laufen genauer', 'Der FB braucht dann keinen Instanz-DB mehr', 'Alle Instanzen teilen sich dieselben Timer']);
Q('xq_fup_p_fb_out_alt', 'profi', 12, 'Ein Output eines FB wird in einem Aufruf nicht beschrieben. Welchen Wert liefert er?', ['Den Wert aus dem vorherigen Aufruf, er ist im Instanz-DB gespeichert', 'Immer 0', 'Einen undefinierten Wert', 'Den Wert des ersten Inputs']);
Q('xq_fup_p_bedingt', 'profi', 12, 'Warum soll ein FB mit Timern nicht nur unter einer Bedingung aufgerufen werden?', ['Ohne Aufruf werden die Timer nicht bearbeitet und die Ausgänge bleiben auf dem alten Stand', 'Weil bedingte Aufrufe in FUP verboten sind', 'Weil sonst der Instanz-DB gelöscht wird', 'Weil Timer nur im OB100 laufen']);
// Kapitel 13
Q('xq_fup_p_db_arten', 'profi', 13, 'Was unterscheidet einen globalen DB von einem Instanz-DB?', ['Der globale DB wird frei angelegt und ist für alle Bausteine; der Instanz-DB gehört zu einem FB und hat dessen Schnittstelle', 'Ein globaler DB verliert seine Werte nach jedem Zyklus', 'Ein Instanz-DB kann nur Bool speichern', 'Es gibt keinen Unterschied']);
Q('xq_fup_p_array_zugriff', 'profi', 13, 'Wie greifst du im FUP auf das dritte Element des Arrays <code>Laenge</code> im DB <code>DB_Zug</code> zu?', ['<code>"DB_Zug".Laenge[3]</code>', '<code>DB_Zug.Laenge(3)</code>', '<code>"Laenge"[3].DB_Zug</code>', '<code>#Laenge.3</code>']);
Q('xq_fup_p_array_anzahl', 'profi', 13, 'Wie viele Elemente hat <code>Array[0..7] of Bool</code>?', ['8', '7', '9', '6']);
Q('xq_fup_p_udt_aendern', 'profi', 13, 'In einem PLC-Datentyp wird ein Element ergänzt. Was ist die Folge?', ['Alle Variablen dieses Typs erhalten das Element; die verwendenden Bausteine werden neu übersetzt', 'Nur neu angelegte Variablen erhalten das Element', 'Alle bestehenden Variablen dieses Typs werden gelöscht', 'Nichts, bestehende Variablen behalten ihre alte Struktur für immer']);
Q('xq_fup_p_struct_udt', 'profi', 13, 'Was unterscheidet ein STRUCT von einem PLC-Datentyp (UDT)?', ['Ein UDT ist ein benannter, wiederverwendbarer Typ; ein STRUCT wird direkt an einer Stelle definiert', 'Ein STRUCT darf nur Bool enthalten', 'Ein UDT darf keine Arrays enthalten', 'Es gibt keinen Unterschied']);
Q('xq_fup_p_startwert', 'profi', 13, 'Welche Bedeutung hat der Startwert einer Variable in einem globalen DB?', ['Diesen Wert erhält die Variable beim Laden bzw. Initialisieren des DB', 'Auf diesen Wert wird die Variable nach jedem Zyklus zurückgesetzt', 'Er ist der grösste erlaubte Wert', 'Er gilt nur in der Simulation']);
// Kapitel 14
Q('xq_fup_p_std_merkmal', 'profi', 14, 'Was zeichnet einen guten Standardbaustein (z.B. für eine Weiche) aus?', ['Er arbeitet nur über seine Schnittstelle, ohne direkte Zugriffe auf globale Variablen', 'Er liest möglichst viele globale Signale selbst', 'Er enthält die Logik aller Weichen in einem Netzwerk', 'Er hat keine Outputs']);
Q('xq_fup_p_fuenf_bue', 'profi', 14, 'Ein Bahnübergangs-FB soll für fünf Bahnübergänge eingesetzt werden. Was braucht es?', ['Fünf Instanzen des FB (Instanz-DBs oder Multiinstanzen)', 'Fünf Kopien des FB mit anderen Namen', 'Eine Instanz, die fünfmal pro Zyklus aufgerufen wird', 'Fünf FCs']);
Q('xq_fup_p_laufzeit_fb', 'profi', 14, 'Warum gehört die Laufzeitüberwachung einer Weiche in den Weichen-FB und nicht in den OB1?', ['Sie gehört zu jeder Weiche; jede Instanz überwacht so automatisch ihre eigene Laufzeit', 'Weil Timer im OB1 verboten sind', 'Weil der OB1 keine Netzwerke enthalten darf', 'Weil der OB1 nur einmal läuft']);
Q('xq_fup_p_output_weiter', 'profi', 14, 'Der Output <code>Fahrt</code> eines Signal-FB wird in einem anderen Baustein gebraucht. Welche Lösung ist sauber?', ['Den Output beim Aufruf auf eine Variable schalten und diese dem anderen Baustein als Input übergeben', 'Im anderen Baustein auf eine Temp-Variable des Signal-FB zugreifen', 'Den Signal-FB im anderen Baustein mit derselben Instanz ein zweites Mal aufrufen', 'Den Output im Signal-FB zusätzlich direkt auf eine globale Variable schreiben']);
Q('xq_fup_p_bue_typ', 'profi', 14, 'Welcher Bausteintyp eignet sich für eine Bahnübergangssteuerung mit Vorläutzeit und gespeicherter Einschaltung?', ['FB, weil Timer und Zustände zwischen den Zyklen erhalten bleiben müssen', 'FC, weil sie kein Gedächtnis braucht', 'OB100', 'Globaler DB']);
Q('xq_fup_p_stoer_antrieb', 'profi', 14, 'Ein Weichen-FB speichert eine Laufzeitstörung. Warum schaltet er bei Störung auch die Antriebsausgänge ab?', ['Damit der Motor nicht dauernd gegen eine blockierte Weiche läuft', 'Damit die Störung schneller quittiert werden kann', 'Weil sonst die CPU in STOP geht', 'Damit der Instanz-DB kleiner wird']);
// Kapitel 15
Q('xq_fup_p_ob1_wann', 'profi', 15, 'Wann wird der OB1 (Program cycle) bearbeitet?', ['Nach dem Anlauf immer wieder, Zyklus für Zyklus', 'Nur einmal beim Anlauf', 'Nur bei einem Fehler', 'Nur wenn sich ein Eingang ändert']);
Q('xq_fup_p_ob100_inhalt', 'profi', 15, 'Was gehört typischerweise in den Anlauf-OB (OB100, Startup)?', ['Initialisierungen wie Grundstellungen und Startwerte', 'Die zyklische Signalsteuerung', 'Die Laufzeitüberwachung der Weichen', 'Das Zählen der Achsen']);
Q('xq_fup_p_signalfluss', 'profi', 15, 'Warum sollen die Bausteine im OB1 in der Reihenfolge des Signalflusses aufgerufen werden?', ['Damit Ergebnisse im selben Zyklus weiterverarbeitet werden und nicht einen Zyklus zu spät ankommen', 'Weil der Compiler sonst einen Fehler meldet', 'Damit der OB100 schneller läuft', 'Die Reihenfolge spielt keine Rolle']);
Q('xq_fup_p_standard_team', 'profi', 15, 'Welchen Sinn hat ein Programmierstandard in einem Team?', ['Einheitliche Namen, Struktur und Kommentare, damit andere das Programm schnell verstehen und warten können', 'Möglichst kurze Variablennamen', 'Jeder pflegt seinen eigenen Stil', 'Möglichst alles in einem einzigen Netzwerk']);
Q('xq_fup_p_kennzeichen', 'profi', 15, 'Wie werden im Editor lokale und globale Variablen gekennzeichnet?', ['Lokale mit #, globale in Anführungszeichen', 'Lokale in Anführungszeichen, globale mit #', 'Beide mit %', 'Lokale mit $, globale mit #']);
Q('xq_fup_p_titel', 'profi', 15, 'Warum ist ein aussagekräftiger Netzwerktitel wichtig?', ['Er dokumentiert die Funktion des Netzwerks und erleichtert Fehlersuche und Wartung', 'Er legt die Ausführungsreihenfolge fest', 'Ohne Titel wird das Netzwerk nicht bearbeitet', 'Er bestimmt die Zykluszeit']);
})();
