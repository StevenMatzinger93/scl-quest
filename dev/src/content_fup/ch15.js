/* ===== FUP QUEST · KAPITEL 15 — Das Stellwerksprogramm: OB1, OB100, Standard, Final Boss 2 (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const START = body => kOB('Startup', body);
const seq = steps => [{ steps }];

const SICH_D = { in:'Gleis_frei:Bool; Weiche_Endlage:Bool; Schranke_zu:Bool; Not_Aus_OK:Bool; Quittieren:Bool', out:'OK:Bool; Fehler:Bool' };
const SICH_FB = kFB('FB_Sicherung', SICH_D, 'NETWORK Sicherung\n#Gleis_frei AND #Weiche_Endlage AND #Schranke_zu AND #Not_Aus_OK AND NOT #Fehler => #OK;\n\nNETWORK Fehler speichern\nNOT #Gleis_frei OR NOT #Weiche_Endlage OR NOT #Schranke_zu OR NOT #Not_Aus_OK => S #Fehler;\n\nNETWORK Quittieren\n#Quittieren AND #Gleis_frei AND #Weiche_Endlage AND #Schranke_zu AND #Not_Aus_OK => R #Fehler;');
const SIG_FB = kFB('FB_Signal', { in:'Fahrt_Anf:Bool; Halt_Anf:Bool; Freigabe:Bool', out:'Fahrt:Bool; FS_fest:Bool|Fahrstrasse festgelegt', stat:'T_Aufloesen:TOF' }, 'NETWORK Selbsthaltung\n(#Fahrt_Anf OR #Fahrt) AND NOT #Halt_Anf AND #Freigabe => #Fahrt;\n\nNETWORK Festlegung\n#Fahrt AND TOF(#T_Aufloesen, T#1S) => #FS_fest;');
const MELD_FC = kFC('FC_Melder', 'Void', { in:'Fahrt:Bool; Stoerung:Bool', out:'Gruen:Bool; Gelb:Bool; Rot:Bool' }, 'NETWORK Gruen\n#Fahrt AND NOT #Stoerung => #Gruen;\n\nNETWORK Gelb\nNOT #Fahrt AND NOT #Stoerung => #Gelb;\n\nNETWORK Rot\n#Stoerung => #Rot;');
const G_SICH = { Gleis_frei:true, Weiche_Endlage:true, Schranke_zu:true, Not_Aus_OK:true, Quittieren:false };
const CALL_SICH = 'NETWORK Sicherung\n=> "FB_Sicherung_DB"(Gleis_frei := "Gleis_frei", Weiche_Endlage := "Weiche_Endlage", Schranke_zu := "Schranke_zu", Not_Aus_OK := "Not_Aus_OK", Quittieren := "Quittieren", OK => "Sicher_OK", Fehler => "Stoerung");';
const CALL_SIG = 'NETWORK Signal\n=> "FB_Signal_DB"(Fahrt_Anf := "Taste_Fahrt", Halt_Anf := "Taste_Halt", Freigabe := "Sicher_OK", Fahrt => "Signal_Fahrt", FS_fest => "FS_fest");';
const CALL_MELD = 'NETWORK Stelltisch\n=> "FC_Melder"(Fahrt := "Signal_Fahrt", Stoerung := "Stoerung", Gruen => "Melder_Gruen", Gelb => "Melder_Gelb", Rot => "Melder_Rot");';
const DB_ST = kDB('DB_Stellwerk', 'Zuege:Int := 57|Stand vom letzten Abschalten; Betriebsart:Int; Status:Int := 9|0 Ruhe, 1 Fahrt, 2 Störung');

defFupPro({ id:'fp15_anlauf', ch:15, title:'Der Anlauf (OB100)',
  story:'Nach jedem Stromausfall zeigt der Zugzähler die Zahl von gestern, das Signal steht auf Fahrt und die Schranke ist oben. Frau Gasser: „Der <b>OB100</b> läuft genau einmal vor dem ersten Zyklus und stellt alles in die sichere Lage.“',
  brief:'Baue den Anlauf-OB <code>Startup</code> [OB100], alle Netzwerke <b>ohne Bedingung</b>:<br><b>NW 1:</b> MOVE 0 nach <code>"DB_Stellwerk".Zuege</code><br><b>NW 2:</b> MOVE 1 nach <code>"DB_Stellwerk".Betriebsart</code><br><b>NW 3:</b> S <code>"Schranke_zu"</code><br><b>NW 4:</b> R <code>"Signal_Fahrt"</code>',
  learn:'Grundstellung im Anlauf-OB herstellen.',
  take:'Der <b>OB100</b> läuft einmal beim Anlauf (STOP → RUN), danach nur noch der <b>OB1</b> in jedem Zyklus. Die sichere Grundstellung gehört in den Anlauf — Signal auf Halt, Schranke zu.',
  man:'programmstruktur', must:['STARTUP','MOVE','SET','RESET'],
  hint:'Jedes Netzwerk: Ausgang antippen → „ohne Bedingung“, dann MOVE bzw. S/R.',
  blocks:[
    { name:'DB_Stellwerk', kind:'DB', src: DB_ST },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START('NETWORK Zuege ruecksetzen\n=> MOVE(0, "DB_Stellwerk".Zuege);\n\nNETWORK Betriebsart\n=> MOVE(1, "DB_Stellwerk".Betriebsart);\n\nNETWORK Schranke schliessen\n=> S "Schranke_zu";\n\nNETWORK Signal auf Halt\n=> R "Signal_Fahrt";') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Anzeige\n=> MOVE("DB_Stellwerk".Zuege, "Anzeige");\n\nNETWORK Haltmelder\nNOT "Signal_Fahrt" => "Melder_Rot";') }
  ],
  globals:{ Schranke_zu:false, Signal_Fahrt:true, Anzeige:0, Melder_Rot:false },
  timed: seq([[0.1,{},{ Anzeige:0, Schranke_zu:true, Signal_Fahrt:false, Melder_Rot:true, 'DB_Stellwerk.Betriebsart':1 }],[0.1,{ Schranke_zu:false, Signal_Fahrt:true },{ Melder_Rot:false, Signal_Fahrt:true }]]),
  wrong:[{ Startup: START('NETWORK Betriebsart\n=> MOVE(1, "DB_Stellwerk".Betriebsart);\n\nNETWORK Schranke schliessen\n=> S "Schranke_zu";\n\nNETWORK Signal auf Halt\n=> R "Signal_Fahrt";') }],
  bind:['crossingClosed=Schranke_zu', 'signalEntry=Signal_Fahrt', 'displayValue=Anzeige', 'displayLabel:"ZÜGE"', 'lightRed=Melder_Rot'] });

const G_PRG = Object.assign({ Taste_Fahrt:false, Taste_Halt:false, Sicher_OK:false, Stoerung:false, Signal_Fahrt:false, FS_fest:false, Melder_Gruen:false, Melder_Gelb:false, Melder_Rot:false }, G_SICH);
const T_PRG = seq([[0,{},{ Melder_Gelb:true, Melder_Gruen:false }],[0.1,{ Taste_Fahrt:true },{ Signal_Fahrt:true, Melder_Gruen:true, Melder_Gelb:false }],[0.1,{ Taste_Fahrt:false, Gleis_frei:false },{ Signal_Fahrt:false, Stoerung:true, Melder_Rot:true, Melder_Gruen:false }],
  [0.1,{ Gleis_frei:true, Quittieren:true },{ Stoerung:false, Melder_Rot:false, Melder_Gelb:true }],[0.1,{ Quittieren:false, Taste_Fahrt:true },{ Signal_Fahrt:true, Melder_Gruen:true }]]);
defFupPro({ id:'fp15_struktur', ch:15, title:'OB1 ruft nur auf',
  story:'Im alten Stellwerksprogramm stand alles im OB1 — hunderte Netzwerke, niemand fand sich zurecht. Im neuen Standard ruft der OB1 nur Bausteine auf, in der Reihenfolge des Signalflusses: erst Sicherung, dann Signal, dann Stelltisch.',
  brief:'Baue <code>Main</code> aus drei Aufrufen:<br><b>NW 1:</b> <code>"FB_Sicherung_DB"</code> (Eingänge gleichnamig, Quittieren → OK => <code>"Sicher_OK"</code>, Fehler => <code>"Stoerung"</code>)<br><b>NW 2:</b> <code>"FB_Signal_DB"</code> (Fahrt_Anf := <code>"Taste_Fahrt"</code>, Halt_Anf := <code>"Taste_Halt"</code>, Freigabe := <code>"Sicher_OK"</code> → <code>"Signal_Fahrt"</code>, <code>"FS_fest"</code>)<br><b>NW 3:</b> <code>"FC_Melder"</code> (Fahrt := <code>"Signal_Fahrt"</code>, Stoerung := <code>"Stoerung"</code> → <code>"Melder_Gruen"</code>, <code>"Melder_Gelb"</code>, <code>"Melder_Rot"</code>)',
  learn:'Programmstruktur: OB1 ruft Bausteine in der Reihenfolge des Signalflusses auf.',
  take:'Ein guter <b>OB1</b> ist ein Inhaltsverzeichnis: nur Aufrufe, in der Reihenfolge Eingänge → Sicherung → Ablauf → Stellglieder → Anzeige. So wirkt jedes Signal noch im selben Zyklus.',
  man:'programmstruktur', must:['CALL','SINGLE','FC_CALL'],
  hint:'Drei Netzwerke ohne Bedingung, jedes mit einer Aufruf-Box (Palette „Aufruf“ oder Baustein aus der Liste ziehen).',
  blocks:[
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB }, { name:'FC_Melder', kind:'FC', src: MELD_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_SICH + '\n\n' + CALL_SIG + '\n\n' + CALL_MELD) }
  ],
  globals: G_PRG, timed: T_PRG,
  bind:['trackB=Gleis_frei', 'signalEntry=Signal_Fahrt', 'routeLocked=FS_fest', 'lightGreen=Melder_Gruen', 'lightYellow=Melder_Gelb', 'lightRed=Melder_Rot', 'faultActive=Stoerung'] });

defFupPro({ id:'fp15_reihenfolge_dbg', ch:15, title:'Einen Zyklus zu spät', debug:true,
  story:'Die Melder am Stelltisch zeigen immer den Zustand von <b>vorhin</b>: Grün kommt einen Zyklus nach dem Signal, Rot einen Zyklus nach der Störung. ARIA hat im OB1 nur die Reihenfolge verändert.',
  brief:'Bringe die Aufrufe in <code>Main</code> in die Reihenfolge des Signalflusses: Sicherung → Signal → Stelltisch.',
  learn:'Aufrufreihenfolge und Zykluslatenz.',
  take:'Wer einen Wert liest, bevor er in diesem Zyklus berechnet wurde, bekommt den Wert des letzten Zyklus. Im Stellwerk ist das zu spät.',
  man:'programmstruktur', must:['CALL'],
  hint:'Welches Netzwerk liest Werte, die erst weiter unten geschrieben werden? Netzwerk-Kopf antippen → nach unten.',
  blocks:[
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB }, { name:'FC_Melder', kind:'FC', src: MELD_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_MELD + '\n\n' + CALL_SICH + '\n\n' + CALL_SIG), ref: MAIN(CALL_SICH + '\n\n' + CALL_SIG + '\n\n' + CALL_MELD) }
  ],
  globals: G_PRG, timed: T_PRG,
  bind:['trackB=Gleis_frei', 'signalEntry=Signal_Fahrt', 'lightGreen=Melder_Gruen', 'lightYellow=Melder_Gelb', 'lightRed=Melder_Rot', 'faultActive=Stoerung'] });

const LAMP_D = { in:'Sicher_OK:Bool; Stoerung:Bool', out:'Gruen:Bool; Rot:Bool', temp:'Alles_OK:Bool' };
defFupPro({ id:'fp15_warnfrei', ch:15, title:'Ohne Warnungen', debug:true, warnFree:['UNUSED_VAR','TEMP_READ_BEFORE_WRITE'],
  story:'Der Programmierstandard der Bahn ist streng: Ein Baustein wird nur abgenommen, wenn der Compiler <b>keine Warnung</b> meldet. <code>FB_Lampen</code> hat zwei: eine unbenutzte Variable und eine Temp-Variable, die gelesen wird, bevor sie geschrieben ist.',
  brief:'Mach <code>FB_Lampen</code> warnungsfrei: Lösche die unbenutzte Variable <code>Reserve</code> in der Tabelle und bringe die Netzwerke in die richtige Reihenfolge.',
  learn:'Warnungen des Compilers ernst nehmen und beheben.',
  take:'Warnungen sind Hinweise auf echte Fehler oder Unordnung. Ein sauberer Baustein übersetzt <b>ohne Warnungen</b> — dann fallen neue Warnungen sofort auf.',
  man:'programmstruktur', must:['TEMP'],
  hint:'Tabelle: Zeile Reserve löschen. Dann das Netzwerk, das #Alles_OK schreibt, nach oben.',
  blocks:[
    { name:'FB_Lampen', kind:'FB', edit:true,
      start: kFB('FB_Lampen', Object.assign({ stat:'Reserve:Int' }, LAMP_D), 'NETWORK Gruen\n#Alles_OK => #Gruen;\n\nNETWORK Alles OK\n#Sicher_OK AND NOT #Stoerung => #Alles_OK;\n\nNETWORK Rot\nNOT #Alles_OK => #Rot;'),
      ref: kFB('FB_Lampen', LAMP_D, 'NETWORK Alles OK\n#Sicher_OK AND NOT #Stoerung => #Alles_OK;\n\nNETWORK Gruen\n#Alles_OK => #Gruen;\n\nNETWORK Rot\nNOT #Alles_OK => #Rot;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Lampen\n=> "FB_Lampen_DB"(Sicher_OK := "Sicher_OK", Stoerung := "Stoerung", Gruen => "Melder_Gruen", Rot => "Melder_Rot");') }
  ],
  globals:{ Sicher_OK:false, Stoerung:false, Melder_Gruen:false, Melder_Rot:false },
  tests:[[{ Sicher_OK:true }, { Melder_Gruen:true, Melder_Rot:false }], [{ Sicher_OK:true, Stoerung:true }, { Melder_Gruen:false, Melder_Rot:true }], [{}, { Melder_Gruen:false, Melder_Rot:true }]],
  bind:['lightGreen=Melder_Gruen', 'lightRed=Melder_Rot'] });

const ZAEHL_FB = kFB('FB_Zugzaehler', { in:'Zug:Bool', inout:'Wert:Int' }, 'NETWORK Zaehlen\nP(#Zug) => INC(#Wert);');
const CALL_Z = 'NETWORK Zuege zaehlen\n=> "FB_Zugzaehler_DB"(Zug := "Zug_durch", Wert := "DB_Stellwerk".Zuege);';
defFupPro({ id:'fp15_anlauf_dbg', ch:15, title:'Der ewige Nullpunkt', debug:true,
  story:'Der Zugzähler steht immer auf 0. ARIA hat das Rücksetzen aus dem Anlauf in den OB1 verschoben — dort läuft es jetzt in <b>jedem</b> Zyklus.',
  brief:'Das Rücksetzen von <code>"DB_Stellwerk".Zuege</code> gehört in den Anlauf-OB <code>Startup</code>. Entferne es aus <code>Main</code> und baue es in <code>Startup</code>.',
  learn:'Einmalige Initialisierung gehört in den OB100.',
  take:'Was im OB1 steht, passiert in jedem Zyklus. Ein Rücksetzen im OB1 löscht jeden Zählerstand sofort wieder — Initialisierungen gehören in den Anlauf.',
  man:'programmstruktur', must:['STARTUP','MOVE'],
  hint:'Netzwerk im Main löschen (Kopf antippen → Netzwerk löschen), im Startup neu anlegen.',
  blocks:[
    { name:'DB_Stellwerk', kind:'DB', src: DB_ST },
    { name:'FB_Zugzaehler', kind:'FB', src: ZAEHL_FB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START('NETWORK Zuege ruecksetzen\n=> MOVE(0, "DB_Stellwerk".Zuege);') },
    { name:'Main', kind:'OB', edit:true, start: MAIN('NETWORK Zuege ruecksetzen\n=> MOVE(0, "DB_Stellwerk".Zuege);\n\n' + CALL_Z), ref: MAIN(CALL_Z) }
  ],
  globals:{ Zug_durch:false },
  timed: seq([[0.1,{},{ 'DB_Stellwerk.Zuege':0 }],[0.1,{ Zug_durch:true },{ 'DB_Stellwerk.Zuege':1 }],[0.1,{ Zug_durch:false },{ 'DB_Stellwerk.Zuege':1 }],[0.1,{ Zug_durch:true },{ 'DB_Stellwerk.Zuege':2 }],[0.1,{ Zug_durch:false },{ 'DB_Stellwerk.Zuege':2 }]]),
  bind:['trainRunning=Zug_durch', 'displayValue=DB_Stellwerk.Zuege', 'displayLabel:"ZÜGE"'] });

const STATUS_FC = kFC('FC_Status', 'Int', { in:'Fahrt:Bool; Stoerung:Bool' }, 'NETWORK Ruhe\n=> MOVE(0, #Ret_Val);\n\nNETWORK Fahrt\n#Fahrt => MOVE(1, #Ret_Val);\n\nNETWORK Stoerung\n#Stoerung => MOVE(2, #Ret_Val);');
defFupPro({ id:'fp15_status', ch:15, title:'Der Statuscode für die Leitstelle',
  story:'Die Betriebsleitstelle bekommt den Zustand des Stellwerks als Zahl: 0 = Ruhe, 1 = Fahrt, 2 = Störung. Die Störung hat Vorrang vor allem anderen.',
  brief:'<code>FC_Status</code> gibt einen <code>Int</code> zurück:<br><b>NW 1:</b> ohne Bedingung MOVE 0 nach <code>#Ret_Val</code><br><b>NW 2:</b> <code>#Fahrt</code> → MOVE 1 nach <code>#Ret_Val</code><br><b>NW 3:</b> <code>#Stoerung</code> → MOVE 2 nach <code>#Ret_Val</code>',
  learn:'Vorrang über die Reihenfolge von MOVE-Netzwerken.',
  take:'Mehrere MOVEs auf dasselbe Ziel: Das letzte, dessen EN-Eingang 1 ist, gewinnt. Mit einem Grundwert oben und den wichtigsten Fällen unten entsteht eine saubere Rangfolge.',
  man:'programmstruktur', must:['RETVAL','MOVE'],
  hint:'Die Störung muss als letztes Netzwerk kommen.',
  blocks:[
    { name:'DB_Stellwerk', kind:'DB', src: DB_ST },
    { name:'FC_Status', kind:'FC', edit:true, start: kFC('FC_Status', 'Int', { in:'Fahrt:Bool; Stoerung:Bool' }, ''), ref: STATUS_FC },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Status\n=> "FC_Status"(Fahrt := "Signal_Fahrt", Stoerung := "Stoerung", Ret_Val => "DB_Stellwerk".Status);') }
  ],
  globals:{ Signal_Fahrt:false, Stoerung:false },
  unit:[{ block:'FC_Status', steps:[[{ Fahrt:false, Stoerung:false }, { RET:0 }], [{ Fahrt:true, Stoerung:false }, { RET:1 }], [{ Fahrt:true, Stoerung:true }, { RET:2 }], [{ Fahrt:false, Stoerung:true }, { RET:2 }]] }],
  tests:[[{ Signal_Fahrt:true }, { 'DB_Stellwerk.Status':1 }], [{ Signal_Fahrt:true, Stoerung:true }, { 'DB_Stellwerk.Status':2 }], [{}, { 'DB_Stellwerk.Status':0 }]],
  wrong:[{ FC_Status: kFC('FC_Status', 'Int', { in:'Fahrt:Bool; Stoerung:Bool' }, 'NETWORK Ruhe\n=> MOVE(0, #Ret_Val);\n\nNETWORK Stoerung\n#Stoerung => MOVE(2, #Ret_Val);\n\nNETWORK Fahrt\n#Fahrt => MOVE(1, #Ret_Val);') }],
  bind:['signalEntry=Signal_Fahrt', 'faultActive=Stoerung', 'displayValue=DB_Stellwerk.Status', 'displayLabel:"STATUS"'] });

const MELD_DB = kDB('DB_Meldungen', 'Aktiv:Array[1..4] of Bool|1 Weiche, 2 Schranke, 3 Signal, 4 Achszähler');
const DIAG_NW = 'NETWORK Zaehler auf null\n=> MOVE(0, "Anzahl");\n\nNETWORK Meldung 1\n"DB_Meldungen".Aktiv[1] => INC("Anzahl");\n\nNETWORK Meldung 2\n"DB_Meldungen".Aktiv[2] => INC("Anzahl");\n\nNETWORK Meldung 3\n"DB_Meldungen".Aktiv[3] => INC("Anzahl");\n\nNETWORK Meldung 4\n"DB_Meldungen".Aktiv[4] => INC("Anzahl");\n\nNETWORK Sammelstoerung\n["Anzahl" > 0] => "Sammelstoerung";';
defFupPro({ id:'fp15_diagnose', ch:15, title:'Die Diagnoseseite',
  story:'Der Diagnosebildschirm des Stellwerks zeigt, <b>wie viele</b> Meldungen gerade anstehen. Dafür wird in jedem Zyklus neu gezählt: zuerst auf 0, dann für jede aktive Meldung +1.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung MOVE 0 nach <code>"Anzahl"</code><br><b>NW 2–5:</b> <code>"DB_Meldungen".Aktiv[1]</code> … <code>[4]</code> → INC <code>"Anzahl"</code> (je ein Netzwerk)<br><b>NW 6:</b> CMP <code>"Anzahl"</code> &gt; 0 → <code>"Sammelstoerung"</code>',
  learn:'In jedem Zyklus neu zählen: erst null setzen, dann aufaddieren.',
  take:'Ohne Flanke zählt INC in jedem Zyklus. Das ist hier gewollt: Weil vorher auf 0 gesetzt wird, steht am Ende des Zyklus genau die Anzahl der aktiven Meldungen.',
  man:'programmstruktur', must:['INC','MOVE','CMP','ARRAY'],
  hint:'Sechs Netzwerke. Das Nullsetzen kommt zuerst.',
  blocks:[
    { name:'DB_Meldungen', kind:'DB', src: MELD_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(DIAG_NW) }
  ],
  globals:{ Anzahl:0, Sammelstoerung:false },
  tests:[[{}, { Anzahl:0, Sammelstoerung:false }], [{ 'DB_Meldungen.Aktiv[2]':true }, { Anzahl:1, Sammelstoerung:true }], [{ 'DB_Meldungen.Aktiv[1]':true, 'DB_Meldungen.Aktiv[3]':true, 'DB_Meldungen.Aktiv[4]':true }, { Anzahl:3, Sammelstoerung:true }]],
  timed: seq([[0.1,{ 'DB_Meldungen.Aktiv[1]':true },{ Anzahl:1 }],[0.1,{},{ Anzahl:1 }],[0.1,{ 'DB_Meldungen.Aktiv[1]':false },{ Anzahl:0, Sammelstoerung:false }]]),
  bind:['faultActive=Sammelstoerung', 'displayValue=Anzahl', 'displayLabel:"MELDUNGEN"'] });

const FS_D = { in:'Anforderung:Bool; Zug_durch:Bool|Zug hat Fahrstrasse verlassen; Sicher_OK:Bool', out:'Ruhe:Bool; Weiche_laeuft:Bool; Fahrt:Bool; Halt:Bool', inout:'Zuege:Int|Zugzähler',
  stat:'Schritt_Ruhe:Bool; Schritt_Stellen:Bool; Schritt_Fahrt:Bool; T_Stellen:TON' };
const FS_NW = 'NETWORK Grundstellung\nNOT #Schritt_Ruhe AND NOT #Schritt_Stellen AND NOT #Schritt_Fahrt => S #Schritt_Ruhe;\n\n' +
  'NETWORK Ruhe -> Stellen\n#Schritt_Ruhe AND #Anforderung AND #Sicher_OK => S #Schritt_Stellen, R #Schritt_Ruhe;\n\n' +
  'NETWORK Stellen -> Fahrt\n#Schritt_Stellen AND TON(#T_Stellen, T#2S) => S #Schritt_Fahrt, R #Schritt_Stellen, INC(#Zuege);\n\n' +
  'NETWORK Fahrt -> Ruhe\n#Schritt_Fahrt AND #Zug_durch => S #Schritt_Ruhe, R #Schritt_Fahrt;\n\n' +
  'NETWORK Sicherung weg\nNOT #Sicher_OK AND (#Schritt_Stellen OR #Schritt_Fahrt) => S #Schritt_Ruhe, R #Schritt_Stellen, R #Schritt_Fahrt;\n\n' +
  'NETWORK Ruhe\n#Schritt_Ruhe => #Ruhe, #Halt;\n\nNETWORK Weiche stellen\n#Schritt_Stellen => #Weiche_laeuft;\n\nNETWORK Fahrt\n#Schritt_Fahrt => #Fahrt;';
const FS_FB = kFB('FB_Fahrstrasse', FS_D, FS_NW);
const CALL_FS = 'NETWORK Fahrstrasse\n=> "FB_Fahrstrasse_DB"(Anforderung := "Taste_FS", Zug_durch := "Zug_durch", Sicher_OK := "Sicher_OK", Zuege := "DB_Stellwerk".Zuege, Ruhe => "Melder_Ruhe", Weiche_laeuft => "Weiche_laeuft", Fahrt => "Fahrt", Halt => "Halt");';
defFupPro({ id:'fp15_fahrstrasse', ch:15, title:'Die Fahrstrasse als Baustein',
  story:'Die Schrittkette aus Kapitel 10 wird Standard: ein FB mit den Schritten als statische Variablen, der Stellzeit als Multiinstanz und dem Zugzähler über InOut.',
  brief:'<code>FB_Fahrstrasse</code> (Schnittstelle steht):<br><b>NW 1</b> Grundstellung · <b>NW 2</b> Ruhe → Stellen (mit <code>#Anforderung</code> und <code>#Sicher_OK</code>) · <b>NW 3</b> Stellen → Fahrt nach TON <code>#T_Stellen</code> 2 s, dabei zusätzlich <b>INC</b> <code>#Zuege</code> · <b>NW 4</b> Fahrt → Ruhe mit <code>#Zug_durch</code> · <b>NW 5</b> Sicherung weg in Stellen/Fahrt → zurück in Ruhe<br><b>NW 6</b> <code>#Schritt_Ruhe</code> → <code>#Ruhe</code>, <code>#Halt</code> · <b>NW 7</b> <code>#Schritt_Stellen</code> → <code>#Weiche_laeuft</code> · <b>NW 8</b> <code>#Schritt_Fahrt</code> → <code>#Fahrt</code>',
  learn:'Eine Schrittkette als Standard-FB mit Multiinstanz-Timer und InOut-Zähler.',
  take:'Als FB ist die Schrittkette gekapselt: Ihre Schritte liegen in der Instanz, der Timer als Multiinstanz, der Zähler kommt über InOut von aussen. Der OB1 sieht nur Befehle und Meldungen.',
  man:'programmstruktur', must:['SET','RESET','TON','INC','MULTI_OUT'],
  hint:'Die Netzwerke sind die aus Kapitel 10 — mit # vor den Namen. In NW 3 hängen drei Ausgänge an der Box.',
  blocks:[
    { name:'DB_Stellwerk', kind:'DB', src: DB_ST },
    { name:'FB_Fahrstrasse', kind:'FB', edit:true, start: kFB('FB_Fahrstrasse', FS_D, ''), ref: FS_FB },
    { name:'Main', kind:'OB', src: MAIN(CALL_FS) }
  ],
  globals:{ Taste_FS:false, Zug_durch:false, Sicher_OK:true, Melder_Ruhe:false, Weiche_laeuft:false, Fahrt:false, Halt:false },
  timed: seq([[0.1,{},{ Melder_Ruhe:true, Halt:true, 'DB_Stellwerk.Zuege':57 }],[0.1,{ Taste_FS:true },{ Weiche_laeuft:true, Melder_Ruhe:false }],[0.1,{ Taste_FS:false },{ Weiche_laeuft:true }],[2.1,{},{ Fahrt:true, Weiche_laeuft:false, 'DB_Stellwerk.Zuege':58 }],
    [0.1,{},{ 'DB_Stellwerk.Zuege':58 }],[0.1,{ Zug_durch:true },{ Fahrt:false, Melder_Ruhe:true }],[0.1,{ Zug_durch:false, Taste_FS:true },{ Weiche_laeuft:true }],[0.1,{ Taste_FS:false, Sicher_OK:false },{ Weiche_laeuft:false, Melder_Ruhe:true }]]),
  bind:['routeSet=Melder_Ruhe', 'switch1Moving=Weiche_laeuft', 'signalEntry=Fahrt', 'trainRunning=Fahrt', 'lightGreen=Sicher_OK', 'displayValue=DB_Stellwerk.Zuege', 'displayLabel:"ZÜGE"'] });

defFupPro({ id:'fp15_quit_dbg', ch:15, title:'Quittieren unmöglich', debug:true,
  story:'Nach der ersten Störung bleibt das Signal für immer auf Halt. Die Quittiertaste ist verdrahtet, das Gleis ist wieder frei — aber im OB1 bekommt der Sicherungsbaustein beim Quittieren eine Konstante.',
  brief:'Verbinde den Parameter <code>Quittieren</code> des Sicherungsbausteins mit der PLC-Variable <code>"Quittieren"</code>.',
  learn:'Konstanten an Bausteinparametern erkennen.',
  take:'Eine Konstante an einem Eingang (<code>FALSE</code>, <code>0</code>) ist manchmal gewollt — oft aber ein vergessener Draht. Beim Abnehmen jeden konstanten Parameter hinterfragen.',
  man:'programmstruktur', must:['CALL'],
  hint:'Aufruf der Sicherung antippen, Parameter Quittieren.',
  blocks:[
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_SICH.replace('Quittieren := "Quittieren"', 'Quittieren := FALSE') + '\n\n' + CALL_SIG), ref: MAIN(CALL_SICH + '\n\n' + CALL_SIG) }
  ],
  globals: G_PRG,
  timed: seq([[0,{ Taste_Fahrt:true },{ Signal_Fahrt:true }],[0.1,{ Taste_Fahrt:false, Gleis_frei:false },{ Signal_Fahrt:false, Stoerung:true }],[0.1,{ Gleis_frei:true, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, Taste_Fahrt:true },{ Signal_Fahrt:true, Sicher_OK:true }]]),
  bind:['trackB=Gleis_frei', 'signalEntry=Signal_Fahrt', 'faultActive=Stoerung', 'lightGreen=Sicher_OK'] });

const FIN_START = START('NETWORK Zuege ruecksetzen\n=> MOVE(0, "DB_Stellwerk".Zuege);\n\nNETWORK Status\n=> MOVE(0, "DB_Stellwerk".Status);');
const CALL_SIG_FIN = 'NETWORK Signal\n=> "FB_Signal_DB"(Fahrt_Anf := "Fahrt", Halt_Anf := "Halt", Freigabe := "Sicher_OK", Fahrt => "Signal_Fahrt", FS_fest => "FS_fest");';
const CALL_STATUS = 'NETWORK Status\n=> "FC_Status"(Fahrt := "Signal_Fahrt", Stoerung := "Stoerung", Ret_Val => "DB_Stellwerk".Status);';
const FIN_MAIN = MAIN(CALL_SICH + '\n\n' + CALL_FS + '\n\n' + CALL_SIG_FIN + '\n\n' + CALL_STATUS);
defFupPro({ id:'fp15_final', ch:15, title:'Final Boss 2: Das letzte Stellwerk', boss:true, final:true,
  story:'ARIA hat sich in den Stellwerksrechner von Brünigkreuz zurückgezogen, ihr letztes Versteck. Frau Gasser legt alle deine Standardbausteine auf den Tisch: „Anlauf, Sicherung, Fahrstrasse, Signal, Status, sauber und ohne Warnungen, dann hat sie keinen Platz mehr.“',
  brief:'<b>Startup</b> [OB100]: MOVE 0 nach <code>"DB_Stellwerk".Zuege</code> und nach <code>"DB_Stellwerk".Status</code><br>' +
    '<b>Main</b> [OB1], in dieser Reihenfolge:<br><b>NW 1:</b> <code>"FB_Sicherung_DB"</code> (Eingänge gleichnamig, <code>"Quittieren"</code> → OK => <code>"Sicher_OK"</code>, Fehler => <code>"Stoerung"</code>)<br>' +
    '<b>NW 2:</b> <code>"FB_Fahrstrasse_DB"</code> (Anforderung := <code>"Taste_FS"</code>, Zug_durch := <code>"Zug_durch"</code>, Sicher_OK := <code>"Sicher_OK"</code>, Zuege := <code>"DB_Stellwerk".Zuege</code> → <code>"Melder_Ruhe"</code>, <code>"Weiche_laeuft"</code>, <code>"Fahrt"</code>, <code>"Halt"</code>)<br>' +
    '<b>NW 3:</b> <code>"FB_Signal_DB"</code> (Fahrt_Anf := <code>"Fahrt"</code>, Halt_Anf := <code>"Halt"</code>, Freigabe := <code>"Sicher_OK"</code> → <code>"Signal_Fahrt"</code>, <code>"FS_fest"</code>)<br>' +
    '<b>NW 4:</b> <code>"FC_Status"</code> (Fahrt := <code>"Signal_Fahrt"</code>, Stoerung := <code>"Stoerung"</code>, Ret_Val => <code>"DB_Stellwerk".Status</code>)',
  learn:'Ein vollständiges Stellwerksprogramm aus Anlauf-OB, OB1 und Standardbausteinen.',
  take:'Du hast ein Stellwerksprogramm gebaut, wie es in echten Anlagen aussieht: Anlauf im OB100, ein OB1 als Inhaltsverzeichnis, geprüfte Standardbausteine für Sicherung, Fahrstrasse und Signal, Daten im DB — warnungsfrei. ARIA hat keinen Ort mehr, an dem sie sich verstecken kann.',
  man:'programmstruktur', must:['STARTUP','CALL','SINGLE','FC_CALL','MOVE'],
  hint:'Zuerst Startup (zwei MOVE-Netzwerke ohne Bedingung), dann Main mit vier Aufrufen.',
  hint2:'Die Reihenfolge im Main folgt dem Signal: Sicherung → Fahrstrasse → Signal → Status. Die Parameter stehen im Auftrag.',
  blocks:[
    { name:'DB_Stellwerk', kind:'DB', src: DB_ST },
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Fahrstrasse', kind:'FB', src: FS_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB }, { name:'FC_Status', kind:'FC', src: STATUS_FC },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: FIN_START },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: FIN_MAIN }
  ],
  globals: Object.assign({ Taste_FS:false, Zug_durch:false, Sicher_OK:false, Stoerung:false, Melder_Ruhe:false, Weiche_laeuft:false, Fahrt:false, Halt:false, Signal_Fahrt:false, FS_fest:false }, G_SICH),
  timed: seq([[0.1,{},{ Melder_Ruhe:true, Halt:true, Signal_Fahrt:false, 'DB_Stellwerk.Zuege':0, 'DB_Stellwerk.Status':0 }],[0.1,{ Taste_FS:true },{ Weiche_laeuft:true, Melder_Ruhe:false }],[0.1,{ Taste_FS:false },{ Weiche_laeuft:true }],
    [2.1,{},{ Fahrt:true, Signal_Fahrt:true, 'DB_Stellwerk.Zuege':1, 'DB_Stellwerk.Status':1 }],[0.1,{ Weiche_Endlage:false },{ Signal_Fahrt:false, Stoerung:true, Melder_Ruhe:true, 'DB_Stellwerk.Status':2 }],
    [0.1,{ Weiche_Endlage:true, Taste_FS:true },{ Weiche_laeuft:false }],[0.1,{ Taste_FS:false, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, Taste_FS:true },{ Weiche_laeuft:true }],
    [2.1,{ Taste_FS:false },{ Signal_Fahrt:true, 'DB_Stellwerk.Zuege':2, 'DB_Stellwerk.Status':1 }],[0.1,{ Zug_durch:true },{ Melder_Ruhe:true, Signal_Fahrt:false, 'DB_Stellwerk.Status':0 }]]),
  wrong:[{ Startup: START('NETWORK Status\n=> MOVE(0, "DB_Stellwerk".Status);') }, { Main: MAIN(CALL_SICH + '\n\n' + CALL_SIG_FIN + '\n\n' + CALL_FS + '\n\n' + CALL_STATUS) }],
  bind:['switch1Moving=Weiche_laeuft', 'crossingClosed=Schranke_zu', 'signalEntry=Signal_Fahrt', 'routeLocked=FS_fest', 'trainRunning=Signal_Fahrt', 'faultActive=Stoerung', 'displayValue=DB_Stellwerk.Zuege', 'displayLabel:"ZÜGE"'] });
})();
