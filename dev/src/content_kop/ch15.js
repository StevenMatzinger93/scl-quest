/* ===== KOP QUEST · KAPITEL 15 — Das Stationsprogramm: OB1, OB100, Standard, Final Boss 2 (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const START = body => kOB('Startup', body);
const seq = steps => [{ steps }];

const KETTE_D = { in:'Tuer_Zu:Bool; Seil_OK:Bool; Not_Halt_OK:Bool; Wind_OK:Bool; Quittieren:Bool', out:'OK:Bool; Fehler:Bool' };
const KETTE_FB = kFB('FB_Kette', KETTE_D, 'NETWORK Kette\n#Tuer_Zu AND #Seil_OK AND #Not_Halt_OK AND #Wind_OK AND NOT #Fehler => #OK;\n\nNETWORK Unterbrechung speichern\nNOT #Tuer_Zu OR NOT #Seil_OK OR NOT #Not_Halt_OK OR NOT #Wind_OK => S #Fehler;\n\nNETWORK Quittieren\n#Quittieren AND #Tuer_Zu AND #Seil_OK AND #Not_Halt_OK AND #Wind_OK => R #Fehler;');
const ANTR_FB = kFB('FB_Antrieb', { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool; Bremse_Auf:Bool', stat:'T_Bremse:TOF' }, 'NETWORK Selbsthaltung\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe => #Laeuft;\n\nNETWORK Bremse\n#Laeuft AND TOF(#T_Bremse, T#1S) => #Bremse_Auf;');
const HMI_FC = kFC('FC_HMI', 'Void', { in:'Antrieb:Bool; Stoerung:Bool', out:'Gruen:Bool; Gelb:Bool; Rot:Bool' }, 'NETWORK Gruen\n#Antrieb AND NOT #Stoerung => #Gruen;\n\nNETWORK Gelb\nNOT #Antrieb AND NOT #Stoerung => #Gelb;\n\nNETWORK Rot\n#Stoerung => #Rot;');
const G_CHAIN = { Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_OK:true, Quittieren:false };
const CALL_KETTE = 'NETWORK Sicherheitskette\n=> "FB_Kette_DB"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Wind_OK := "Wind_OK", Quittieren := "Quittieren", OK => "Kette_OK", Fehler => "Stoerung");';
const CALL_ANTR = 'NETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Laeuft => "Antrieb", Bremse_Auf => "Bremse_Auf");';
const CALL_HMI = 'NETWORK Signalampel\n=> "FC_HMI"(Antrieb := "Antrieb", Stoerung := "Stoerung", Gruen => "Ampel_Gruen", Gelb => "Ampel_Gelb", Rot => "Ampel_Rot");';
const DB_ST = kDB('DB_Station', 'Fahrten:Int := 57|Stand vom letzten Abschalten; Betriebsart:Int; Status:Int := 9|0 Stillstand, 1 Fahrt, 2 Störung');

defKopPro({ id:'k15_anlauf', ch:15, title:'Der Anlauf (OB100)',
  story:'Nach jedem Stromausfall zeigt die Station den Fahrtenzähler von gestern, die Bremse ist gelüftet und die Tür steht offen. Der Werkmeister: „Dafür gibt es den <b>OB100</b>. Er läuft genau einmal, bevor der erste Zyklus beginnt.“',
  brief:'Zeichne den Anlauf-OB <code>Startup</code> [OB100], alle Netzwerke <b>ohne Bedingung</b>:<br><b>NW 1:</b> MOVE 0 nach <code>"DB_Station".Fahrten</code><br><b>NW 2:</b> MOVE 1 nach <code>"DB_Station".Betriebsart</code><br><b>NW 3:</b> S <code>"Bremse"</code> (einfallen lassen)<br><b>NW 4:</b> R <code>"Tuer_Auf"</code>',
  learn:'Grundstellung im Anlauf-OB herstellen.',
  take:'Der <b>OB100</b> läuft einmal beim Anlauf (STOP → RUN), danach nur noch der <b>OB1</b> in jedem Zyklus. Grundstellungen gehören in den Anlauf — nicht mit einem Merker „erster Zyklus“ in den OB1.',
  man:'programmstruktur', must:['STARTUP','MOVE','SET','RESET'],
  hint:'Jedes Netzwerk: Element antippen → „ohne Bedingung“, dann MOVE bzw. Setzen/Rücksetzen.',
  blocks:[
    { name:'DB_Station', kind:'DB', src: DB_ST },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START('NETWORK Fahrten ruecksetzen\n=> MOVE(0, "DB_Station".Fahrten);\n\nNETWORK Betriebsart\n=> MOVE(1, "DB_Station".Betriebsart);\n\nNETWORK Bremse einfallen\n=> S "Bremse";\n\nNETWORK Tuer zu\n=> R "Tuer_Auf";') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Anzeige\n=> MOVE("DB_Station".Fahrten, "Anzeige");\n\nNETWORK Bremsleuchte\n"Bremse" => "Ampel_Rot";') }
  ],
  globals:{ Bremse:false, Tuer_Auf:true, Anzeige:0, Ampel_Rot:false },
  timed: seq([[0.1,{},{ Anzeige:0, Bremse:true, Tuer_Auf:false, Ampel_Rot:true, 'DB_Station.Betriebsart':1 }],[0.1,{ Bremse:false, Tuer_Auf:true },{ Ampel_Rot:false, Tuer_Auf:true }]]),
  wrong:[{ Startup: START('NETWORK Betriebsart\n=> MOVE(1, "DB_Station".Betriebsart);\n\nNETWORK Bremse einfallen\n=> S "Bremse";\n\nNETWORK Tuer zu\n=> R "Tuer_Auf";') }],
  bind:['brake=Bremse', 'doorOpen=Tuer_Auf', 'displayValue=Anzeige', 'displayLabel:"FAHRTEN"', 'lightRed=Ampel_Rot'] });

const G_PRG = Object.assign({ S_Start:false, S_Stopp:false, Kette_OK:false, Stoerung:false, Antrieb:false, Bremse_Auf:false, Ampel_Gruen:false, Ampel_Gelb:false, Ampel_Rot:false }, G_CHAIN);
const T_PRG = seq([[0,{},{ Ampel_Gelb:true, Ampel_Gruen:false }],[0.1,{ S_Start:true },{ Antrieb:true, Ampel_Gruen:true, Ampel_Gelb:false }],[0.1,{ S_Start:false, Wind_OK:false },{ Antrieb:false, Stoerung:true, Ampel_Rot:true, Ampel_Gruen:false }],
  [0.1,{ Wind_OK:true, Quittieren:true },{ Stoerung:false, Ampel_Rot:false, Ampel_Gelb:true }],[0.1,{ Quittieren:false, S_Start:true },{ Antrieb:true, Ampel_Gruen:true }]]);
defKopPro({ id:'k15_struktur', ch:15, title:'OB1 ruft nur auf',
  story:'Im alten Programm stand die ganze Logik im OB1 — tausend Netzwerke. Im neuen Standard ruft der OB1 nur noch Bausteine auf, in der Reihenfolge des Signalflusses: erst Sicherheit, dann Antrieb, dann Anzeige.',
  brief:'Baue <code>Main</code> aus drei Aufrufen:<br><b>NW 1:</b> <code>"FB_Kette_DB"</code> (Glieder, Quittieren → <code>"Kette_OK"</code>, <code>"Stoerung"</code>)<br><b>NW 2:</b> <code>"FB_Antrieb_DB"</code> (Start := <code>"S_Start"</code>, Stopp := <code>"S_Stopp"</code>, Freigabe := <code>"Kette_OK"</code> → <code>"Antrieb"</code>, <code>"Bremse_Auf"</code>)<br><b>NW 3:</b> <code>"FC_HMI"</code> (Antrieb := <code>"Antrieb"</code>, Stoerung := <code>"Stoerung"</code> → <code>"Ampel_Gruen"</code>, <code>"Ampel_Gelb"</code>, <code>"Ampel_Rot"</code>)',
  learn:'Programmstruktur: OB1 ruft Bausteine in der Reihenfolge des Signalflusses auf.',
  take:'Ein guter <b>OB1</b> ist ein Inhaltsverzeichnis: nur Aufrufe, in der Reihenfolge Eingänge → Sicherheit → Ablauf → Antriebe → Anzeige. So reagiert jedes Signal noch im selben Zyklus.',
  man:'programmstruktur', must:['CALL','SINGLE','FC_CALL'],
  hint:'Drei Netzwerke ohne Bedingung, jedes mit einer Aufruf-Box.',
  blocks:[
    { name:'FB_Kette', kind:'FB', src: KETTE_FB }, { name:'FB_Antrieb', kind:'FB', src: ANTR_FB }, { name:'FC_HMI', kind:'FC', src: HMI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_KETTE + '\n\n' + CALL_ANTR + '\n\n' + CALL_HMI) }
  ],
  globals: G_PRG, timed: T_PRG,
  bind:['chainWind=Wind_OK', 'motorOn=Antrieb', 'brake=Bremse_Auf', 'lightGreen=Ampel_Gruen', 'lightYellow=Ampel_Gelb', 'lightRed=Ampel_Rot', 'faultActive=Stoerung'] });

defKopPro({ id:'k15_reihenfolge_dbg', ch:15, title:'Einen Zyklus zu spät', debug:true,
  story:'Die Ampel zeigt immer den Zustand von <b>vorhin</b>: Grün kommt einen Zyklus nach dem Anlauf, Rot einen Zyklus nach der Störung. ARIA hat im OB1 nur die Reihenfolge verändert.',
  brief:'Bringe die Aufrufe in <code>Main</code> in die Reihenfolge des Signalflusses: Kette → Antrieb → Anzeige.',
  learn:'Aufrufreihenfolge und Zykluslatenz.',
  take:'Wer einen Wert liest, bevor er in diesem Zyklus berechnet wurde, bekommt den Wert des letzten Zyklus. Bei schnellen Signalen und Sicherheitsfunktionen ist das zu spät.',
  man:'programmstruktur', must:['CALL'],
  hint:'Welches Netzwerk liest Werte, die erst später geschrieben werden?',
  blocks:[
    { name:'FB_Kette', kind:'FB', src: KETTE_FB }, { name:'FB_Antrieb', kind:'FB', src: ANTR_FB }, { name:'FC_HMI', kind:'FC', src: HMI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_HMI + '\n\n' + CALL_KETTE + '\n\n' + CALL_ANTR), ref: MAIN(CALL_KETTE + '\n\n' + CALL_ANTR + '\n\n' + CALL_HMI) }
  ],
  globals: G_PRG, timed: T_PRG,
  bind:['chainWind=Wind_OK', 'motorOn=Antrieb', 'lightGreen=Ampel_Gruen', 'lightYellow=Ampel_Gelb', 'lightRed=Ampel_Rot', 'faultActive=Stoerung'] });

const LAMP_D = { in:'Kette_OK:Bool; Stoerung:Bool', out:'Gruen:Bool; Rot:Bool', temp:'Alles_OK:Bool' };
defKopPro({ id:'k15_warnfrei', ch:15, title:'Ohne Warnungen', debug:true, warnFree:['UNUSED_VAR','TEMP_READ_BEFORE_WRITE'],
  story:'Der Programmierstandard der Gratbahn ist streng: Ein Baustein wird nur abgenommen, wenn der Compiler <b>keine Warnung</b> meldet. <code>FB_Lampen</code> hat zwei: eine unbenutzte Variable und eine Temp-Variable, die gelesen wird, bevor sie geschrieben ist.',
  brief:'Mach <code>FB_Lampen</code> warnungsfrei: Lösche die unbenutzte Variable <code>Reserve</code> in der Tabelle und bringe die Netzwerke in die richtige Reihenfolge.',
  learn:'Warnungen des Compilers ernst nehmen und beheben.',
  take:'Warnungen sind Hinweise auf echte Fehler oder Unordnung. Ein sauberer Baustein übersetzt <b>ohne Warnungen</b> — dann fallen neue Warnungen sofort auf.',
  man:'programmstruktur', must:['TEMP'],
  hint:'Tabelle: Zeile Reserve löschen (Papierkorb). Dann das Netzwerk, das #Alles_OK schreibt, nach oben.',
  blocks:[
    { name:'FB_Lampen', kind:'FB', edit:true,
      start: kFB('FB_Lampen', Object.assign({ stat:'Reserve:Int' }, LAMP_D), 'NETWORK Gruen\n#Alles_OK => #Gruen;\n\nNETWORK Alles OK\n#Kette_OK AND NOT #Stoerung => #Alles_OK;\n\nNETWORK Rot\nNOT #Alles_OK => #Rot;'),
      ref: kFB('FB_Lampen', LAMP_D, 'NETWORK Alles OK\n#Kette_OK AND NOT #Stoerung => #Alles_OK;\n\nNETWORK Gruen\n#Alles_OK => #Gruen;\n\nNETWORK Rot\nNOT #Alles_OK => #Rot;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Lampen\n=> "FB_Lampen_DB"(Kette_OK := "Kette_OK", Stoerung := "Stoerung", Gruen => "Ampel_Gruen", Rot => "Ampel_Rot");') }
  ],
  globals:{ Kette_OK:false, Stoerung:false, Ampel_Gruen:false, Ampel_Rot:false },
  tests:[[{ Kette_OK:true }, { Ampel_Gruen:true, Ampel_Rot:false }], [{ Kette_OK:true, Stoerung:true }, { Ampel_Gruen:false, Ampel_Rot:true }], [{}, { Ampel_Gruen:false, Ampel_Rot:true }]],
  bind:['lightGreen=Ampel_Gruen', 'lightRed=Ampel_Rot'] });

const ZAEHL_FB = kFB('FB_Zaehler', { in:'Signal:Bool', inout:'Wert:Int' }, 'NETWORK Zaehlen\nP(#Signal) => INC(#Wert);');
const CALL_Z = 'NETWORK Fahrten zaehlen\n=> "FB_Zaehler_DB"(Signal := "Abfahrt", Wert := "DB_Station".Fahrten);';
defKopPro({ id:'k15_anlauf_dbg', ch:15, title:'Der ewige Nullpunkt', debug:true,
  story:'Der Fahrtenzähler steht immer auf 0. ARIA hat das Rücksetzen aus dem Anlauf in den OB1 verschoben — dort läuft es jetzt in <b>jedem</b> Zyklus.',
  brief:'Das Rücksetzen von <code>"DB_Station".Fahrten</code> gehört in den Anlauf-OB <code>Startup</code>. Entferne es aus <code>Main</code> und zeichne es in <code>Startup</code>.',
  learn:'Einmalige Initialisierung gehört in den OB100.',
  take:'Was im OB1 steht, passiert in jedem Zyklus. Ein Rücksetzen im OB1 löscht jeden Zählerstand sofort wieder — Initialisierungen gehören in den Anlauf.',
  man:'programmstruktur', must:['STARTUP','MOVE'],
  hint:'Netzwerk im Main löschen (Kopfzeile antippen → Netzwerk löschen), im Startup neu anlegen.',
  blocks:[
    { name:'DB_Station', kind:'DB', src: DB_ST },
    { name:'FB_Zaehler', kind:'FB', src: ZAEHL_FB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START('NETWORK Fahrten ruecksetzen\n=> MOVE(0, "DB_Station".Fahrten);') },
    { name:'Main', kind:'OB', edit:true, start: MAIN('NETWORK Fahrten ruecksetzen\n=> MOVE(0, "DB_Station".Fahrten);\n\n' + CALL_Z), ref: MAIN(CALL_Z) }
  ],
  globals:{ Abfahrt:false },
  timed: seq([[0.1,{},{ 'DB_Station.Fahrten':0 }],[0.1,{ Abfahrt:true },{ 'DB_Station.Fahrten':1 }],[0.1,{ Abfahrt:false },{ 'DB_Station.Fahrten':1 }],[0.1,{ Abfahrt:true },{ 'DB_Station.Fahrten':2 }],[0.1,{ Abfahrt:false },{ 'DB_Station.Fahrten':2 }]]),
  bind:['motorOn=Abfahrt', 'displayValue=DB_Station.Fahrten', 'displayLabel:"FAHRTEN"'] });

const STATUS_FC = kFC('FC_Status', 'Int', { in:'Antrieb:Bool; Stoerung:Bool' }, 'NETWORK Stillstand\n=> MOVE(0, #Ret_Val);\n\nNETWORK Fahrt\n#Antrieb => MOVE(1, #Ret_Val);\n\nNETWORK Stoerung\n#Stoerung => MOVE(2, #Ret_Val);');
defKopPro({ id:'k15_status', ch:15, title:'Der Statuscode fürs HMI',
  story:'Das Bedienpanel zeigt den Stationszustand als Zahl: 0 = Stillstand, 1 = Fahrt, 2 = Störung. Die Störung hat Vorrang vor allem anderen.',
  brief:'<code>FC_Status</code> gibt einen <code>Int</code> zurück:<br><b>NW 1:</b> ohne Bedingung MOVE 0 nach <code>#Ret_Val</code><br><b>NW 2:</b> <code>#Antrieb</code> → MOVE 1 nach <code>#Ret_Val</code><br><b>NW 3:</b> <code>#Stoerung</code> → MOVE 2 nach <code>#Ret_Val</code>',
  learn:'Vorrang über die Reihenfolge von MOVE-Netzwerken.',
  take:'Mehrere MOVEs auf dasselbe Ziel: Das letzte, das Strom bekommt, gewinnt. Mit einem Grundwert oben und den wichtigsten Fällen unten entsteht eine saubere Rangfolge.',
  man:'programmstruktur', must:['RETVAL','MOVE'],
  hint:'Die Störung muss als letztes Netzwerk kommen.',
  blocks:[
    { name:'DB_Station', kind:'DB', src: DB_ST },
    { name:'FC_Status', kind:'FC', edit:true, start: kFC('FC_Status', 'Int', { in:'Antrieb:Bool; Stoerung:Bool' }, ''), ref: STATUS_FC },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Status\n=> "FC_Status"(Antrieb := "Antrieb", Stoerung := "Stoerung", Ret_Val => "DB_Station".Status);') }
  ],
  globals:{ Antrieb:false, Stoerung:false },
  unit:[{ block:'FC_Status', steps:[[{ Antrieb:false, Stoerung:false }, { RET:0 }], [{ Antrieb:true, Stoerung:false }, { RET:1 }], [{ Antrieb:true, Stoerung:true }, { RET:2 }], [{ Antrieb:false, Stoerung:true }, { RET:2 }]] }],
  tests:[[{ Antrieb:true }, { 'DB_Station.Status':1 }], [{ Antrieb:true, Stoerung:true }, { 'DB_Station.Status':2 }], [{}, { 'DB_Station.Status':0 }]],
  wrong:[{ FC_Status: kFC('FC_Status', 'Int', { in:'Antrieb:Bool; Stoerung:Bool' }, 'NETWORK Stillstand\n=> MOVE(0, #Ret_Val);\n\nNETWORK Stoerung\n#Stoerung => MOVE(2, #Ret_Val);\n\nNETWORK Fahrt\n#Antrieb => MOVE(1, #Ret_Val);') }],
  bind:['motorOn=Antrieb', 'faultActive=Stoerung', 'displayValue=DB_Station.Status', 'displayLabel:"STATUS"'] });

const MELD_DB = kDB('DB_Meldungen', 'Aktiv:Array[1..4] of Bool|1 Seil, 2 Wind, 3 Tür, 4 Not-Halt');
const DIAG_NW = 'NETWORK Zaehler auf null\n=> MOVE(0, "Anzahl");\n\nNETWORK Meldung 1\n"DB_Meldungen".Aktiv[1] => INC("Anzahl");\n\nNETWORK Meldung 2\n"DB_Meldungen".Aktiv[2] => INC("Anzahl");\n\nNETWORK Meldung 3\n"DB_Meldungen".Aktiv[3] => INC("Anzahl");\n\nNETWORK Meldung 4\n"DB_Meldungen".Aktiv[4] => INC("Anzahl");\n\nNETWORK Sammelstoerung\n["Anzahl" > 0] => "Sammelstoerung";';
defKopPro({ id:'k15_diagnose', ch:15, title:'Die Diagnoseseite',
  story:'Die Diagnoseseite des HMI zeigt, <b>wie viele</b> Meldungen gerade anstehen. Dafür wird in jedem Zyklus neu gezählt: zuerst auf 0, dann für jede aktive Meldung +1.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung MOVE 0 nach <code>"Anzahl"</code><br><b>NW 2–5:</b> <code>"DB_Meldungen".Aktiv[1]</code> … <code>[4]</code> → INC <code>"Anzahl"</code> (je ein Netzwerk)<br><b>NW 6:</b> <code>"Anzahl"</code> &gt; 0 → <code>"Sammelstoerung"</code>',
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

const ABL_D = { in:'S_Abfahrt:Bool; Ankunft:Bool; Kette_OK:Bool', out:'Tuer_Auf:Bool; Hupe:Bool; Fahrt:Bool; Halt:Bool', inout:'Fahrten:Int|Fahrtenzähler',
  stat:'Schritt_Einsteigen:Bool; Schritt_Warnen:Bool; Schritt_Fahrt:Bool; T_Warnen:TON' };
const ABL_NW = 'NETWORK Grundstellung\nNOT #Schritt_Einsteigen AND NOT #Schritt_Warnen AND NOT #Schritt_Fahrt => S #Schritt_Einsteigen;\n\n' +
  'NETWORK Einsteigen -> Warnen\n#Schritt_Einsteigen AND #S_Abfahrt AND #Kette_OK => S #Schritt_Warnen, R #Schritt_Einsteigen;\n\n' +
  'NETWORK Warnen -> Fahrt\n#Schritt_Warnen AND TON(#T_Warnen, T#2S) => S #Schritt_Fahrt, R #Schritt_Warnen, INC(#Fahrten);\n\n' +
  'NETWORK Fahrt -> Einsteigen\n#Schritt_Fahrt AND #Ankunft => S #Schritt_Einsteigen, R #Schritt_Fahrt;\n\n' +
  'NETWORK Kette offen\nNOT #Kette_OK AND (#Schritt_Warnen OR #Schritt_Fahrt) => S #Schritt_Einsteigen, R #Schritt_Warnen, R #Schritt_Fahrt;\n\n' +
  'NETWORK Einsteigen\n#Schritt_Einsteigen => #Tuer_Auf, #Halt;\n\nNETWORK Vorwarnung\n#Schritt_Warnen => #Hupe;\n\nNETWORK Fahrt\n#Schritt_Fahrt => #Fahrt;';
const ABL_FB = kFB('FB_Ablauf', ABL_D, ABL_NW);
defKopPro({ id:'k15_ablauf', ch:15, title:'Die Schrittkette als Baustein',
  story:'Die Schrittkette aus Kapitel 10 wird Standard: ein FB mit den Schritten als statische Variablen, der Vorwarnzeit als Multiinstanz und einem Fahrtenzähler über InOut.',
  brief:'<code>FB_Ablauf</code> (Schnittstelle steht):<br><b>NW 1</b> Grundstellung · <b>NW 2</b> Einsteigen → Warnen (mit <code>#S_Abfahrt</code> und <code>#Kette_OK</code>) · <b>NW 3</b> Warnen → Fahrt nach TON <code>#T_Warnen</code> 2 s, dabei zusätzlich <b>INC</b> <code>#Fahrten</code> · <b>NW 4</b> Fahrt → Einsteigen mit <code>#Ankunft</code> · <b>NW 5</b> Kette offen in Warnen/Fahrt → zurück ins Einsteigen<br><b>NW 6</b> <code>#Schritt_Einsteigen</code> → <code>#Tuer_Auf</code>, <code>#Halt</code> · <b>NW 7</b> <code>#Schritt_Warnen</code> → <code>#Hupe</code> · <b>NW 8</b> <code>#Schritt_Fahrt</code> → <code>#Fahrt</code>',
  learn:'Eine Schrittkette als Standard-FB mit Multiinstanz-Timer und InOut-Zähler.',
  take:'Als FB ist die Schrittkette gekapselt: Ihre Schritte liegen in der Instanz, der Timer als Multiinstanz, der Zähler kommt über InOut von aussen. Der OB1 sieht nur Befehle und Meldungen.',
  man:'programmstruktur', must:['SET','RESET','TON','INC','MULTI_OUT'],
  hint:'Die Netzwerke sind die aus Kapitel 10 — mit # vor den Namen. In NW 3 hängen drei Ausgänge am Strompfad.',
  blocks:[
    { name:'DB_Station', kind:'DB', src: DB_ST },
    { name:'FB_Ablauf', kind:'FB', edit:true, start: kFB('FB_Ablauf', ABL_D, ''), ref: ABL_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Ablauf\n=> "FB_Ablauf_DB"(S_Abfahrt := "S_Abfahrt", Ankunft := "Ankunft", Kette_OK := "Kette_OK", Fahrten := "DB_Station".Fahrten, Tuer_Auf => "Tuer_Auf", Hupe => "Hupe", Fahrt => "Antrieb", Halt => "Halt");') }
  ],
  globals:{ S_Abfahrt:false, Ankunft:false, Kette_OK:true, Tuer_Auf:false, Hupe:false, Antrieb:false, Halt:false },
  timed: seq([[0.1,{},{ Tuer_Auf:true, Halt:true, 'DB_Station.Fahrten':57 }],[0.1,{ S_Abfahrt:true },{ Hupe:true, Tuer_Auf:false }],[0.1,{ S_Abfahrt:false },{ Hupe:true }],[2.1,{},{ Antrieb:true, Hupe:false, 'DB_Station.Fahrten':58 }],
    [0.1,{},{ 'DB_Station.Fahrten':58 }],[0.1,{ Ankunft:true },{ Antrieb:false, Tuer_Auf:true }],[0.1,{ Ankunft:false, S_Abfahrt:true },{ Hupe:true }],[0.1,{ S_Abfahrt:false, Kette_OK:false },{ Hupe:false, Tuer_Auf:true }]]),
  bind:['doorOpen=Tuer_Auf', 'hornActive=Hupe', 'motorOn=Antrieb', 'lightGreen=Kette_OK', 'displayValue=DB_Station.Fahrten', 'displayLabel:"FAHRTEN"'] });

defKopPro({ id:'k15_quit_dbg', ch:15, title:'Quittieren unmöglich', debug:true,
  story:'Nach dem ersten Windstoss steht die Bahn für immer. Die Quittiertaste ist verdrahtet, die Kette ist wieder zu — aber im OB1 bekommt der Kettenbaustein beim Quittieren eine Konstante.',
  brief:'Verbinde den Parameter <code>Quittieren</code> des Kettenbausteins mit der PLC-Variable <code>"Quittieren"</code>.',
  learn:'Konstanten an Bausteinparametern erkennen.',
  take:'Eine Konstante an einem Eingang (<code>FALSE</code>, <code>0</code>) ist manchmal gewollt — oft aber ein vergessener Draht. Beim Abnehmen jeden konstanten Parameter hinterfragen.',
  man:'programmstruktur', must:['CALL'],
  hint:'Aufruf der Kette antippen, Parameter Quittieren.',
  blocks:[
    { name:'FB_Kette', kind:'FB', src: KETTE_FB }, { name:'FB_Antrieb', kind:'FB', src: ANTR_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_KETTE.replace('Quittieren := "Quittieren"', 'Quittieren := FALSE') + '\n\n' + CALL_ANTR), ref: MAIN(CALL_KETTE + '\n\n' + CALL_ANTR) }
  ],
  globals: G_PRG,
  timed: seq([[0,{ S_Start:true },{ Antrieb:true }],[0.1,{ S_Start:false, Wind_OK:false },{ Antrieb:false, Stoerung:true }],[0.1,{ Wind_OK:true, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, S_Start:true },{ Antrieb:true, Kette_OK:true }]]),
  bind:['chainWind=Wind_OK', 'motorOn=Antrieb', 'faultActive=Stoerung', 'lightGreen=Kette_OK'] });

const FIN_START = START('NETWORK Fahrten ruecksetzen\n=> MOVE(0, "DB_Station".Fahrten);\n\nNETWORK Status\n=> MOVE(0, "DB_Station".Status);');
const FIN_MAIN = MAIN(CALL_KETTE + '\n\n' +
  'NETWORK Ablauf\n=> "FB_Ablauf_DB"(S_Abfahrt := "S_Abfahrt", Ankunft := "Ankunft", Kette_OK := "Kette_OK", Fahrten := "DB_Station".Fahrten, Tuer_Auf => "Tuer_Auf", Hupe => "Hupe", Fahrt => "Fahrt", Halt => "Halt");\n\n' +
  'NETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "Fahrt", Stopp := "Halt", Freigabe := "Kette_OK", Laeuft => "Antrieb", Bremse_Auf => "Bremse_Auf");\n\n' +
  'NETWORK Status\n=> "FC_Status"(Antrieb := "Antrieb", Stoerung := "Stoerung", Ret_Val => "DB_Station".Status);');
defKopPro({ id:'k15_final', ch:15, title:'Final Boss 2: Die letzte Station', boss:true, final:true,
  story:'ARIA hat sich in die Bergstation der Gratbahn zurückgezogen — ihr letztes Versteck. Der Werkmeister legt alle deine Standardbausteine auf den Tisch: „Anlauf, Kette, Ablauf, Antrieb, Status. Ein sauberes Stationsprogramm, ohne Warnungen. Dann hat sie keinen Platz mehr.“',
  brief:'<b>Startup</b> [OB100]: MOVE 0 nach <code>"DB_Station".Fahrten</code> und nach <code>"DB_Station".Status</code><br>' +
    '<b>Main</b> [OB1], in dieser Reihenfolge:<br><b>NW 1:</b> <code>"FB_Kette_DB"</code> (Glieder, <code>"Quittieren"</code> → <code>"Kette_OK"</code>, <code>"Stoerung"</code>)<br>' +
    '<b>NW 2:</b> <code>"FB_Ablauf_DB"</code> (S_Abfahrt := <code>"S_Abfahrt"</code>, Ankunft := <code>"Ankunft"</code>, Kette_OK := <code>"Kette_OK"</code>, Fahrten := <code>"DB_Station".Fahrten</code> → <code>"Tuer_Auf"</code>, <code>"Hupe"</code>, Fahrt => <code>"Fahrt"</code>, Halt => <code>"Halt"</code>)<br>' +
    '<b>NW 3:</b> <code>"FB_Antrieb_DB"</code> (Start := <code>"Fahrt"</code>, Stopp := <code>"Halt"</code>, Freigabe := <code>"Kette_OK"</code> → <code>"Antrieb"</code>, <code>"Bremse_Auf"</code>)<br>' +
    '<b>NW 4:</b> <code>"FC_Status"</code> (Antrieb := <code>"Antrieb"</code>, Stoerung := <code>"Stoerung"</code>, Ret_Val => <code>"DB_Station".Status</code>)',
  learn:'Ein vollständiges Stationsprogramm aus Anlauf-OB, OB1 und Standardbausteinen.',
  take:'Du hast ein Stationsprogramm gebaut, wie es in echten Anlagen aussieht: Anlauf im OB100, ein OB1 als Inhaltsverzeichnis, geprüfte Standardbausteine für Sicherheit, Ablauf und Antrieb, Daten im DB — warnungsfrei. ARIA hat keinen Ort mehr, an dem sie sich verstecken kann.',
  man:'programmstruktur', must:['STARTUP','CALL','SINGLE','FC_CALL','MOVE'],
  hint:'Zuerst Startup (zwei MOVE-Netzwerke ohne Bedingung), dann Main mit vier Aufrufen.',
  hint2:'Die Reihenfolge im Main folgt dem Signal: Kette → Ablauf → Antrieb → Status. Die Parameter stehen im Auftrag.',
  blocks:[
    { name:'DB_Station', kind:'DB', src: DB_ST },
    { name:'FB_Kette', kind:'FB', src: KETTE_FB }, { name:'FB_Ablauf', kind:'FB', src: ABL_FB }, { name:'FB_Antrieb', kind:'FB', src: ANTR_FB }, { name:'FC_Status', kind:'FC', src: STATUS_FC },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: FIN_START },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: FIN_MAIN }
  ],
  globals: Object.assign({ S_Abfahrt:false, Ankunft:false, Kette_OK:false, Stoerung:false, Tuer_Auf:false, Hupe:false, Fahrt:false, Halt:false, Antrieb:false, Bremse_Auf:false }, G_CHAIN),
  timed: seq([[0.1,{},{ Tuer_Auf:true, Halt:true, Antrieb:false, 'DB_Station.Fahrten':0, 'DB_Station.Status':0 }],[0.1,{ S_Abfahrt:true },{ Hupe:true, Tuer_Auf:false }],[0.1,{ S_Abfahrt:false },{ Hupe:true }],
    [2.1,{},{ Fahrt:true, Antrieb:true, 'DB_Station.Fahrten':1, 'DB_Station.Status':1 }],[0.1,{ Seil_OK:false },{ Antrieb:false, Stoerung:true, Tuer_Auf:true, 'DB_Station.Status':2 }],
    [0.1,{ Seil_OK:true, S_Abfahrt:true },{ Hupe:false }],[0.1,{ S_Abfahrt:false, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, S_Abfahrt:true },{ Hupe:true }],
    [2.1,{ S_Abfahrt:false },{ Antrieb:true, 'DB_Station.Fahrten':2, 'DB_Station.Status':1 }],[0.1,{ Ankunft:true },{ Tuer_Auf:true, Antrieb:false, 'DB_Station.Status':0 }]]),
  wrong:[{ Startup: START('NETWORK Status\n=> MOVE(0, "DB_Station".Status);') }, { Main: MAIN(CALL_KETTE + '\n\nNETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "Fahrt", Stopp := "Halt", Freigabe := "Kette_OK", Laeuft => "Antrieb", Bremse_Auf => "Bremse_Auf");\n\nNETWORK Ablauf\n=> "FB_Ablauf_DB"(S_Abfahrt := "S_Abfahrt", Ankunft := "Ankunft", Kette_OK := "Kette_OK", Fahrten := "DB_Station".Fahrten, Tuer_Auf => "Tuer_Auf", Hupe => "Hupe", Fahrt => "Fahrt", Halt => "Halt");\n\nNETWORK Status\n=> "FC_Status"(Antrieb := "Antrieb", Stoerung := "Stoerung", Ret_Val => "DB_Station".Status);') }],
  bind:['chainRope=Seil_OK', 'chainDoor=Tuer_Zu', 'doorOpen=Tuer_Auf', 'hornActive=Hupe', 'motorOn=Antrieb', 'brake=Bremse_Auf', 'faultActive=Stoerung', 'displayValue=DB_Station.Fahrten', 'displayLabel:"FAHRTEN"'] });
})();
