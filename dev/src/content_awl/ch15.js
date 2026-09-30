/* ===== AWL QUEST · KAPITEL 15 — Das Walzwerksprogramm: OB1, OB100, Standard, Final Boss 2 (Profi-Stufe) ===== */
(function(){
const MAIN = body => aOB('Main', body);
const START = body => aOB('Startup', body);
const seq = steps => [{ steps }];

const SICH_D = { in:'Not_Aus_OK:Bool; Gitter_zu:Bool; Oel_OK:Bool; Wasser_OK:Bool; Quittieren:Bool', out:'OK:Bool; Fehler:Bool' };
const SICH_FB = aFB('FB_Sicherung', SICH_D, 'NETWORK Sicherung\nU  #Not_Aus_OK\nU  #Gitter_zu\nU  #Oel_OK\nU  #Wasser_OK\nUN #Fehler\n=  #OK\n\nNETWORK Fehler speichern\nON #Not_Aus_OK\nON #Gitter_zu\nON #Oel_OK\nON #Wasser_OK\nS  #Fehler\n\nNETWORK Quittieren\nU  #Quittieren\nU  #Not_Aus_OK\nU  #Gitter_zu\nU  #Oel_OK\nU  #Wasser_OK\nR  #Fehler');
const MOT_FB = aFB('FB_Motor', { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool; Luefter:Bool', stat:'T_Luefter:TOF' }, 'NETWORK Selbsthaltung\nU(\nO  #Start\nO  #Laeuft\n)\nUN #Stopp\nU  #Freigabe\n=  #Laeuft\n\nNETWORK Luefter\nCALL #T_Luefter\n   IN := #Laeuft\n   PT := T#1S\n   Q => #Luefter');
const HMI_FC = aFC('FC_Leitstand', 'Void', { in:'Laeuft:Bool; Stoerung:Bool', out:'Gruen:Bool; Gelb:Bool; Rot:Bool' }, 'U  #Laeuft\nUN #Stoerung\n=  #Gruen\nUN #Laeuft\nUN #Stoerung\n=  #Gelb\nU  #Stoerung\n=  #Rot');
const G_SICH = { Not_Aus_OK:true, Gitter_zu:true, Oel_OK:true, Wasser_OK:true, Quittieren:false };
const CALL_SICH = 'NETWORK Sicherung\nCALL "FB_Sicherung", "FB_Sicherung_DB"\n   Not_Aus_OK := "Not_Aus_OK"\n   Gitter_zu := "Gitter_zu"\n   Oel_OK := "Oel_OK"\n   Wasser_OK := "Wasser_OK"\n   Quittieren := "Quittieren"\n   OK => "Sicher_OK"\n   Fehler => "Stoerung"';
const CALL_MOT = 'NETWORK Walzmotor\nCALL "FB_Motor", "FB_Motor_DB"\n   Start := "S_Start"\n   Stopp := "S_Stopp"\n   Freigabe := "Sicher_OK"\n   Laeuft => "Walzen"\n   Luefter => "Luefter"';
const CALL_HMI = 'NETWORK Leitstand\nCALL "FC_Leitstand"\n   Laeuft := "Walzen"\n   Stoerung := "Stoerung"\n   Gruen => "Lampe_Gruen"\n   Gelb => "Lampe_Gelb"\n   Rot => "Lampe_Rot"';
const DB_W = aDB('DB_Walzwerk', 'Bloecke:Int := 57|Stand vom letzten Abschalten; Betriebsart:Int; Status:Int := 9|0 Ruhe, 1 Walzen, 2 Störung');

defAwlPro({ id:'ap15_anlauf', ch:15, title:'Der Anlauf (OB100)',
  story:'Nach jedem Stromausfall zeigt der Blockzähler die Zahl von gestern, und die Hydraulikpumpe läuft sofort wieder an. Herr Brunner: „Dafür gibt es den <b>OB100</b>, er läuft genau einmal, bevor der erste Zyklus beginnt.“',
  brief:'Schreibe den Anlauf-OB <code>Startup</code> [OB100]:<br><code>L 0</code> · <code>T "DB_Walzwerk".Bloecke</code> · <code>L 1</code> · <code>T "DB_Walzwerk".Betriebsart</code><br><code>SET</code> · <code>R "Pumpe"</code> · <code>S "Tuer_zu"</code>',
  learn:'Grundstellung im Anlauf-OB herstellen.',
  take:'Der <b>OB100</b> läuft einmal beim Anlauf (STOP → RUN), danach nur noch der <b>OB1</b> in jedem Zyklus. Grundstellungen gehören in den Anlauf — nicht mit einem Merker „erster Zyklus“ in den OB1.',
  man:'programmstruktur', must:['STARTUP', 'L', 'T', 'SET'],
  hint:'SET macht das VKE 1 — danach wirken R und S ohne Bedingung.',
  blocks:[
    { name:'DB_Walzwerk', kind:'DB', src: DB_W },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START('L  0\nT  "DB_Walzwerk".Bloecke\nL  1\nT  "DB_Walzwerk".Betriebsart\nSET\nR  "Pumpe"\nS  "Tuer_zu"') },
    { name:'Main', kind:'OB', src: MAIN('L  "DB_Walzwerk".Bloecke\nT  "Anzeige"\nUN "Tuer_zu"\n=  "Lampe_Rot"') }
  ],
  globals:{ Pumpe:true, Tuer_zu:false, Anzeige:0, Lampe_Rot:false },
  timed: seq([[0.1, {}, { Anzeige:0, Pumpe:false, Tuer_zu:true, Lampe_Rot:false, 'DB_Walzwerk.Betriebsart':1 }], [0.1, { Pumpe:true, Tuer_zu:false }, { Pumpe:true, Lampe_Rot:true }]]),
  wrong:[{ Startup: START('L  1\nT  "DB_Walzwerk".Betriebsart\nSET\nR  "Pumpe"\nS  "Tuer_zu"') }],
  bind:['pumpRunning=Pumpe', { channel:'furnaceDoor', variable:'Tuer_zu', map:{ 'true':false, 'false':true } }, 'displayValue=Anzeige', 'displayLabel:"BLÖCKE"', 'lightRed=Lampe_Rot'] });

const G_PRG = Object.assign({ S_Start:false, S_Stopp:false, Sicher_OK:false, Stoerung:false, Walzen:false, Luefter:false, Lampe_Gruen:false, Lampe_Gelb:false, Lampe_Rot:false }, G_SICH);
const T_PRG = seq([[0, {}, { Lampe_Gelb:true, Lampe_Gruen:false }], [0.1, { S_Start:true }, { Walzen:true, Lampe_Gruen:true, Lampe_Gelb:false }], [0.1, { S_Start:false, Wasser_OK:false }, { Walzen:false, Stoerung:true, Lampe_Rot:true, Lampe_Gruen:false }],
  [0.1, { Wasser_OK:true, Quittieren:true }, { Stoerung:false, Lampe_Rot:false, Lampe_Gelb:true }], [0.1, { Quittieren:false, S_Start:true }, { Walzen:true, Lampe_Gruen:true }]]);
defAwlPro({ id:'ap15_struktur', ch:15, title:'OB1 ruft nur auf',
  story:'Im alten Programm stand alles im OB1 — dreitausend Zeilen. Im neuen Standard ruft der OB1 nur Bausteine auf, in der Reihenfolge des Signalflusses: erst Sicherung, dann Motor, dann Leitstand.',
  brief:'Schreibe <code>Main</code> aus drei Aufrufen:<br><b>1:</b> <code>CALL "FB_Sicherung", "FB_Sicherung_DB"</code> (Eingänge gleichnamig, Quittieren → OK => <code>"Sicher_OK"</code>, Fehler => <code>"Stoerung"</code>)<br><b>2:</b> <code>CALL "FB_Motor", "FB_Motor_DB"</code> (Start := <code>"S_Start"</code>, Stopp := <code>"S_Stopp"</code>, Freigabe := <code>"Sicher_OK"</code> → Laeuft => <code>"Walzen"</code>, Luefter => <code>"Luefter"</code>)<br><b>3:</b> <code>CALL "FC_Leitstand"</code> (Laeuft := <code>"Walzen"</code>, Stoerung := <code>"Stoerung"</code> → <code>"Lampe_Gruen"</code>, <code>"Lampe_Gelb"</code>, <code>"Lampe_Rot"</code>)',
  learn:'Programmstruktur: OB1 ruft Bausteine in der Reihenfolge des Signalflusses auf.',
  take:'Ein guter <b>OB1</b> ist ein Inhaltsverzeichnis: nur Aufrufe, in der Reihenfolge Eingänge → Sicherheit → Ablauf → Antriebe → Anzeige. So reagiert jedes Signal noch im selben Zyklus.',
  man:'programmstruktur', must:['CALL', 'SINGLE', 'FC_CALL'],
  hint:'Drei Netzwerke mit je einem CALL und seinen Parameterzeilen.',
  blocks:[
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Motor', kind:'FB', src: MOT_FB }, { name:'FC_Leitstand', kind:'FC', src: HMI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_SICH + '\n\n' + CALL_MOT + '\n\n' + CALL_HMI) }
  ],
  globals: G_PRG, timed: T_PRG,
  bind:['coolingOn=Wasser_OK', 'rollsRunning=Walzen', 'lightGreen=Lampe_Gruen', 'lightYellow=Lampe_Gelb', 'lightRed=Lampe_Rot', 'faultActive=Stoerung'] });

defAwlPro({ id:'ap15_reihenfolge_dbg', ch:15, title:'Einen Zyklus zu spät', debug:true,
  story:'Die Lampen am Leitstand zeigen immer den Zustand von <b>vorhin</b>: Grün kommt einen Zyklus nach dem Start, Rot einen Zyklus nach der Störung. ARIA hat im OB1 nur die Reihenfolge verändert.',
  brief:'Bringe die Aufrufe in <code>Main</code> in die Reihenfolge des Signalflusses: Sicherung → Motor → Leitstand.',
  learn:'Aufrufreihenfolge und Zykluslatenz.',
  take:'Wer einen Wert liest, bevor er in diesem Zyklus berechnet wurde, bekommt den Wert des letzten Zyklus. Bei Sicherheitsfunktionen ist das zu spät.',
  man:'programmstruktur', must:['CALL'],
  hint:'Welcher Aufruf liest Werte, die erst weiter unten geschrieben werden?',
  blocks:[
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Motor', kind:'FB', src: MOT_FB }, { name:'FC_Leitstand', kind:'FC', src: HMI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_HMI + '\n\n' + CALL_SICH + '\n\n' + CALL_MOT), ref: MAIN(CALL_SICH + '\n\n' + CALL_MOT + '\n\n' + CALL_HMI) }
  ],
  globals: G_PRG, timed: T_PRG,
  bind:['coolingOn=Wasser_OK', 'rollsRunning=Walzen', 'lightGreen=Lampe_Gruen', 'lightYellow=Lampe_Gelb', 'lightRed=Lampe_Rot', 'faultActive=Stoerung'] });

const LAMP_D = { in:'Sicher_OK:Bool; Stoerung:Bool', out:'Gruen:Bool; Rot:Bool', temp:'Alles_OK:Bool' };
defAwlPro({ id:'ap15_warnfrei', ch:15, title:'Ohne Warnungen', debug:true, warnFree:['UNUSED_VAR', 'TEMP_READ_BEFORE_WRITE'],
  story:'Der Programmierstandard des Walzwerks ist streng: Ein Baustein wird nur abgenommen, wenn der Compiler <b>keine Warnung</b> meldet. <code>FB_Lampen</code> hat zwei: eine unbenutzte Variable und eine Temp-Variable, die gelesen wird, bevor sie geschrieben ist.',
  brief:'Mach <code>FB_Lampen</code> warnungsfrei: Lösche die unbenutzte Variable <code>Reserve</code> in der Tabelle und bringe die Anweisungen in die richtige Reihenfolge.',
  learn:'Warnungen des Compilers ernst nehmen und beheben.',
  take:'Warnungen sind Hinweise auf echte Fehler oder Unordnung. Ein sauberer Baustein übersetzt <b>ohne Warnungen</b> — dann fallen neue Warnungen sofort auf.',
  man:'programmstruktur', must:['TEMP'],
  hint:'Tabelle: Zeile Reserve löschen. Dann die Kette, die #Alles_OK schreibt, nach oben.',
  blocks:[
    { name:'FB_Lampen', kind:'FB', edit:true,
      start: aFB('FB_Lampen', Object.assign({ stat:'Reserve:Int' }, LAMP_D), 'U  #Alles_OK\n=  #Gruen\nU  #Sicher_OK\nUN #Stoerung\n=  #Alles_OK\nUN #Alles_OK\n=  #Rot'),
      ref: aFB('FB_Lampen', LAMP_D, 'U  #Sicher_OK\nUN #Stoerung\n=  #Alles_OK\nU  #Alles_OK\n=  #Gruen\nUN #Alles_OK\n=  #Rot') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Lampen", "FB_Lampen_DB"\n   Sicher_OK := "Sicher_OK"\n   Stoerung := "Stoerung"\n   Gruen => "Lampe_Gruen"\n   Rot => "Lampe_Rot"') }
  ],
  globals:{ Sicher_OK:false, Stoerung:false, Lampe_Gruen:false, Lampe_Rot:false },
  tests:[[{ Sicher_OK:true }, { Lampe_Gruen:true, Lampe_Rot:false }], [{ Sicher_OK:true, Stoerung:true }, { Lampe_Gruen:false, Lampe_Rot:true }], [{}, { Lampe_Gruen:false, Lampe_Rot:true }]],
  bind:['lightGreen=Lampe_Gruen', 'lightRed=Lampe_Rot'] });

const ZAEHL_FB = aFB('FB_Blockzaehler', { in:'Block:Bool', inout:'Wert:Int', stat:'M_Flanke:Bool' }, 'U  #Block\nFP #M_Flanke\nSPBN ENDE\nL  #Wert\nINC 1\nT  #Wert\nENDE: NOP 0');
const CALL_Z = 'CALL "FB_Blockzaehler", "FB_Blockzaehler_DB"\n   Block := "Block_raus"\n   Wert := "DB_Walzwerk".Bloecke';
defAwlPro({ id:'ap15_anlauf_dbg', ch:15, title:'Der ewige Nullpunkt', debug:true,
  story:'Der Blockzähler steht immer auf 0. ARIA hat das Rücksetzen aus dem Anlauf in den OB1 verschoben — dort läuft es jetzt in <b>jedem</b> Zyklus.',
  brief:'Das Rücksetzen von <code>"DB_Walzwerk".Bloecke</code> gehört in den Anlauf-OB <code>Startup</code>. Entferne es aus <code>Main</code> und schreibe es in <code>Startup</code>.',
  learn:'Einmalige Initialisierung gehört in den OB100.',
  take:'Was im OB1 steht, passiert in jedem Zyklus. Ein Rücksetzen im OB1 löscht jeden Zählerstand sofort wieder — Initialisierungen gehören in den Anlauf.',
  man:'programmstruktur', must:['STARTUP', 'T'],
  hint:'Die zwei Zeilen L 0 / T … wandern von Main nach Startup.',
  blocks:[
    { name:'DB_Walzwerk', kind:'DB', src: DB_W },
    { name:'FB_Blockzaehler', kind:'FB', src: ZAEHL_FB },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: START('L  0\nT  "DB_Walzwerk".Bloecke') },
    { name:'Main', kind:'OB', edit:true, start: MAIN('L  0\nT  "DB_Walzwerk".Bloecke\n' + CALL_Z), ref: MAIN(CALL_Z) }
  ],
  globals:{ Block_raus:false },
  timed: seq([[0.1, {}, { 'DB_Walzwerk.Bloecke':0 }], [0.1, { Block_raus:true }, { 'DB_Walzwerk.Bloecke':1 }], [0.1, { Block_raus:false }, { 'DB_Walzwerk.Bloecke':1 }], [0.1, { Block_raus:true }, { 'DB_Walzwerk.Bloecke':2 }], [0.1, { Block_raus:false }, { 'DB_Walzwerk.Bloecke':2 }]]),
  bind:['billetVisible=Block_raus', 'pieceCount=DB_Walzwerk.Bloecke'] });

const STATUS_FC = aFC('FC_Status', 'Int', { in:'Laeuft:Bool; Stoerung:Bool' }, 'L  0\nT  #Ret_Val\nU  #Laeuft\nSPBN M1\nL  1\nT  #Ret_Val\nM1: U  #Stoerung\nSPBN ENDE\nL  2\nT  #Ret_Val\nENDE: NOP 0');
defAwlPro({ id:'ap15_status', ch:15, title:'Der Statuscode für die Leitwarte',
  story:'Die Leitwarte bekommt den Zustand des Walzwerks als Zahl: 0 = Ruhe, 1 = Walzen, 2 = Störung. Die Störung hat Vorrang vor allem anderen.',
  brief:'<code>FC_Status</code> gibt eine <code>Int</code> zurück:<br><code>L 0</code> · <code>T #Ret_Val</code><br><code>U #Laeuft</code> · <code>SPBN M1</code> · <code>L 1</code> · <code>T #Ret_Val</code><br><code>M1: U #Stoerung</code> · <code>SPBN ENDE</code> · <code>L 2</code> · <code>T #Ret_Val</code><br><code>ENDE: NOP 0</code>',
  learn:'Vorrang über die Reihenfolge der Transfers.',
  take:'Mehrere Transfers auf dasselbe Ziel: Der letzte, der ausgeführt wird, gewinnt. Mit einem Grundwert oben und den wichtigsten Fällen unten entsteht eine saubere Rangfolge.',
  man:'programmstruktur', must:['RETVAL', 'SPBN'],
  hint:'Die Störung muss als letztes geprüft werden.',
  blocks:[
    { name:'DB_Walzwerk', kind:'DB', src: DB_W },
    { name:'FC_Status', kind:'FC', edit:true, start: aFC('FC_Status', 'Int', { in:'Laeuft:Bool; Stoerung:Bool' }, ''), ref: STATUS_FC },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Status"\n   Laeuft := "Walzen"\n   Stoerung := "Stoerung"\n   RET_VAL := "DB_Walzwerk".Status') }
  ],
  globals:{ Walzen:false, Stoerung:false },
  unit:[{ block:'FC_Status', steps:[[{ Laeuft:false, Stoerung:false }, { RET:0 }], [{ Laeuft:true, Stoerung:false }, { RET:1 }], [{ Laeuft:true, Stoerung:true }, { RET:2 }], [{ Laeuft:false, Stoerung:true }, { RET:2 }]] }],
  tests:[[{ Walzen:true }, { 'DB_Walzwerk.Status':1 }], [{ Walzen:true, Stoerung:true }, { 'DB_Walzwerk.Status':2 }], [{}, { 'DB_Walzwerk.Status':0 }]],
  wrong:[{ FC_Status: aFC('FC_Status', 'Int', { in:'Laeuft:Bool; Stoerung:Bool' }, 'L  0\nT  #Ret_Val\nU  #Stoerung\nSPBN M1\nL  2\nT  #Ret_Val\nM1: U  #Laeuft\nSPBN ENDE\nL  1\nT  #Ret_Val\nENDE: NOP 0') }],
  bind:['rollsRunning=Walzen', 'faultActive=Stoerung', 'displayValue=DB_Walzwerk.Status', 'displayLabel:"STATUS"'] });

const MELD_DB = aDB('DB_Meldungen', 'Aktiv:Array[1..4] of Bool|1 Öl, 2 Wasser, 3 Gitter, 4 Not-Aus');
const DIAG = 'NETWORK Zaehler auf null\nL  0\nT  "Anzahl"\n\nNETWORK Meldungen zaehlen\nU  "DB_Meldungen".Aktiv[1]\nSPBN M2\nL  "Anzahl"\nINC 1\nT  "Anzahl"\nM2: U  "DB_Meldungen".Aktiv[2]\nSPBN M3\nL  "Anzahl"\nINC 1\nT  "Anzahl"\nM3: U  "DB_Meldungen".Aktiv[3]\nSPBN M4\nL  "Anzahl"\nINC 1\nT  "Anzahl"\nM4: U  "DB_Meldungen".Aktiv[4]\nSPBN M5\nL  "Anzahl"\nINC 1\nT  "Anzahl"\n\nNETWORK Sammelstoerung\nM5: L  "Anzahl"\nL  0\n>I\n=  "Sammelstoerung"';
defAwlPro({ id:'ap15_diagnose', ch:15, title:'Die Diagnoseseite',
  story:'Die Diagnoseseite der Leitwarte zeigt, <b>wie viele</b> Meldungen gerade anstehen. Dafür wird in jedem Zyklus neu gezählt: zuerst auf 0, dann für jede aktive Meldung +1.',
  brief:'In <code>Main</code>:<br><code>L 0</code> · <code>T "Anzahl"</code><br>Für jede Meldung <code>"DB_Meldungen".Aktiv[1]</code> … <code>[4]</code>: abfragen, mit <code>SPBN</code> überspringen, sonst <code>L "Anzahl"</code> · <code>INC 1</code> · <code>T "Anzahl"</code><br>Zum Schluss <code>"Sammelstoerung"</code> = <code>"Anzahl"</code> &gt; 0',
  learn:'In jedem Zyklus neu zählen: erst null setzen, dann aufaddieren.',
  take:'Weil vorher auf 0 gesetzt wird, steht am Ende des Zyklus genau die Anzahl der aktiven Meldungen — ohne Flanken, ohne Gedächtnis.',
  man:'programmstruktur', must:['INC', 'SPBN', 'CMP_I', 'ARRAY'],
  hint:'Vier gleiche Abschnitte mit den Marken M2 bis M5.',
  blocks:[ { name:'DB_Meldungen', kind:'DB', src: MELD_DB }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(DIAG) } ],
  globals:{ Anzahl:0, Sammelstoerung:false },
  tests:[[{}, { Anzahl:0, Sammelstoerung:false }], [{ 'DB_Meldungen.Aktiv[2]':true }, { Anzahl:1, Sammelstoerung:true }], [{ 'DB_Meldungen.Aktiv[1]':true, 'DB_Meldungen.Aktiv[3]':true, 'DB_Meldungen.Aktiv[4]':true }, { Anzahl:3, Sammelstoerung:true }]],
  timed: seq([[0.1, { 'DB_Meldungen.Aktiv[1]':true }, { Anzahl:1 }], [0.1, {}, { Anzahl:1 }], [0.1, { 'DB_Meldungen.Aktiv[1]':false }, { Anzahl:0, Sammelstoerung:false }]]),
  bind:['faultActive=Sammelstoerung', 'displayValue=Anzahl', 'displayLabel:"MELDUNGEN"'] });

const ABL_D = { in:'Start:Bool; Block_durch:Bool|Block hat das Gerüst verlassen; Sicher_OK:Bool', out:'Ruhe:Bool; Hupe:Bool; Walzen:Bool', inout:'Bloecke:Int|Blockzähler',
  stat:'Schritt_Ruhe:Bool; Schritt_Warnen:Bool; Schritt_Walzen:Bool; T_Warnen:TON' };
const ABL_BODY = 'NETWORK Grundstellung\nUN #Schritt_Ruhe\nUN #Schritt_Warnen\nUN #Schritt_Walzen\nS  #Schritt_Ruhe\n\n' +
  'NETWORK Ruhe -> Warnen\nU  #Schritt_Ruhe\nU  #Start\nU  #Sicher_OK\nS  #Schritt_Warnen\nR  #Schritt_Ruhe\n\n' +
  'NETWORK Warnen -> Walzen\nCALL #T_Warnen\n   IN := #Schritt_Warnen\n   PT := T#2S\nU  #T_Warnen.Q\nSPBN N4\nSET\nS  #Schritt_Walzen\nR  #Schritt_Warnen\nL  #Bloecke\nINC 1\nT  #Bloecke\n\n' +
  'NETWORK Walzen -> Ruhe\nN4: U  #Schritt_Walzen\nU  #Block_durch\nS  #Schritt_Ruhe\nR  #Schritt_Walzen\n\n' +
  'NETWORK Sicherung weg\nUN #Sicher_OK\nU(\nO  #Schritt_Warnen\nO  #Schritt_Walzen\n)\nS  #Schritt_Ruhe\nR  #Schritt_Warnen\nR  #Schritt_Walzen\n\n' +
  'NETWORK Ausgaenge\nU  #Schritt_Ruhe\n=  #Ruhe\nU  #Schritt_Warnen\n=  #Hupe\nU  #Schritt_Walzen\n=  #Walzen';
const ABL_FB = aFB('FB_Ablauf', ABL_D, ABL_BODY);
const CALL_ABL = 'NETWORK Ablauf\nCALL "FB_Ablauf", "FB_Ablauf_DB"\n   Start := "S_Start"\n   Block_durch := "Block_durch"\n   Sicher_OK := "Sicher_OK"\n   Bloecke := "DB_Walzwerk".Bloecke\n   Ruhe => "Lampe_Ruhe"\n   Hupe => "Hupe"\n   Walzen => "Walzen_Befehl"';
defAwlPro({ id:'ap15_ablauf', ch:15, title:'Die Schrittkette als Baustein',
  story:'Der Walzablauf wird Standard: ein FB mit den Schritten als Static-Variablen, der Vorwarnzeit als IEC-Multiinstanz und einem Blockzähler über InOut.',
  brief:'<code>FB_Ablauf</code> (Schnittstelle steht):<br><b>Grundstellung:</b> kein Schritt aktiv → <code>S #Schritt_Ruhe</code><br><b>Ruhe → Warnen:</b> mit <code>#Start</code> und <code>#Sicher_OK</code><br><b>Warnen → Walzen:</b> <code>CALL #T_Warnen</code> (IN := <code>#Schritt_Warnen</code>, PT := <code>T#2S</code>); ist <code>#T_Warnen.Q</code> 1: Schritt wechseln und <code>#Bloecke</code> um 1 erhöhen (Sprung <code>SPBN N4</code> darüber)<br><b>Walzen → Ruhe:</b> mit <code>#Block_durch</code> (Marke <code>N4</code>)<br><b>Sicherung weg:</b> in Warnen/Walzen zurück nach Ruhe<br><b>Ausgänge:</b> <code>#Ruhe</code>, <code>#Hupe</code>, <code>#Walzen</code> aus den Schritten',
  learn:'Eine Schrittkette als Standard-FB mit IEC-Zeit und InOut-Zähler.',
  take:'Als FB ist die Schrittkette gekapselt: Ihre Schritte liegen in der Instanz, die Zeit als Multiinstanz, der Zähler kommt über InOut von aussen. Der OB1 sieht nur Befehle und Meldungen.',
  man:'programmstruktur', must:['S', 'R', 'TON', 'INC', 'SPBN'],
  hint:'Nach SPBN N4 ist das VKE 1 — ein SET davor macht das Setzen und Rücksetzen deutlich.',
  blocks:[
    { name:'DB_Walzwerk', kind:'DB', src: DB_W },
    { name:'FB_Ablauf', kind:'FB', edit:true, start: aFB('FB_Ablauf', ABL_D, ''), ref: ABL_FB },
    { name:'Main', kind:'OB', src: MAIN(CALL_ABL) }
  ],
  globals:{ S_Start:false, Block_durch:false, Sicher_OK:true, Lampe_Ruhe:false, Hupe:false, Walzen_Befehl:false },
  timed: seq([[0.1, {}, { Lampe_Ruhe:true, 'DB_Walzwerk.Bloecke':57 }], [0.1, { S_Start:true }, { Hupe:true, Lampe_Ruhe:false }], [0.1, { S_Start:false }, { Hupe:true }], [2.1, {}, { Walzen_Befehl:true, Hupe:false, 'DB_Walzwerk.Bloecke':58 }],
    [0.1, {}, { 'DB_Walzwerk.Bloecke':58 }], [0.1, { Block_durch:true }, { Walzen_Befehl:false, Lampe_Ruhe:true }], [0.1, { Block_durch:false, S_Start:true }, { Hupe:true }], [0.1, { S_Start:false, Sicher_OK:false }, { Hupe:false, Lampe_Ruhe:true }]]),
  bind:['hornActive=Hupe', 'rollsRunning=Walzen_Befehl', 'lightGreen=Sicher_OK', 'pieceCount=DB_Walzwerk.Bloecke'] });

defAwlPro({ id:'ap15_quit_dbg', ch:15, title:'Quittieren unmöglich', debug:true,
  story:'Nach dem ersten Wassermangel steht das Walzwerk für immer. Die Quittiertaste ist verdrahtet, das Wasser läuft wieder — aber im OB1 bekommt der Sicherungsbaustein beim Quittieren eine Konstante.',
  brief:'Verbinde den Parameter <code>Quittieren</code> des Sicherungsbausteins mit der PLC-Variable <code>"Quittieren"</code>.',
  learn:'Konstanten an Bausteinparametern erkennen.',
  take:'Eine Konstante an einem Eingang (<code>FALSE</code>, <code>0</code>) ist manchmal gewollt — oft aber ein vergessener Draht. Beim Abnehmen jeden konstanten Parameter hinterfragen.',
  man:'programmstruktur', must:['CALL'],
  hint:'Quittieren := FALSE → Quittieren := "Quittieren".',
  blocks:[
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Motor', kind:'FB', src: MOT_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_SICH.replace('Quittieren := "Quittieren"', 'Quittieren := FALSE') + '\n\n' + CALL_MOT), ref: MAIN(CALL_SICH + '\n\n' + CALL_MOT) }
  ],
  globals: G_PRG,
  timed: seq([[0, { S_Start:true }, { Walzen:true }], [0.1, { S_Start:false, Wasser_OK:false }, { Walzen:false, Stoerung:true }], [0.1, { Wasser_OK:true, Quittieren:true }, { Stoerung:false }], [0.1, { Quittieren:false, S_Start:true }, { Walzen:true, Sicher_OK:true }]]),
  bind:['coolingOn=Wasser_OK', 'rollsRunning=Walzen', 'faultActive=Stoerung', 'lightGreen=Sicher_OK'] });

const FIN_START = START('L  0\nT  "DB_Walzwerk".Bloecke\nT  "DB_Walzwerk".Status');
const CALL_MOT_FIN = 'NETWORK Walzmotor\nCALL "FB_Motor", "FB_Motor_DB"\n   Start := "Walzen_Befehl"\n   Stopp := "Lampe_Ruhe"\n   Freigabe := "Sicher_OK"\n   Laeuft => "Walzen"\n   Luefter => "Luefter"';
const CALL_STATUS = 'NETWORK Status\nCALL "FC_Status"\n   Laeuft := "Walzen"\n   Stoerung := "Stoerung"\n   RET_VAL := "DB_Walzwerk".Status';
const FIN_MAIN = MAIN(CALL_SICH + '\n\n' + CALL_ABL + '\n\n' + CALL_MOT_FIN + '\n\n' + CALL_STATUS);
defAwlPro({ id:'ap15_final', ch:15, title:'Final Boss 2: Das letzte Walzwerk', boss:true, final:true,
  story:'ARIA hat sich in den letzten Winkel der S7-300 zurückgezogen, und Herr Brunner legt alle deine Standardbausteine auf den Tisch: „Anlauf, Sicherung, Ablauf, Motor, Status, sauber und ohne Warnungen.“ Dann hat sie keinen Platz mehr, und beim nächsten Umbau können die Jungen es nach SCL übertragen.',
  brief:'<b>Startup</b> [OB100]: <code>L 0</code>, <code>T "DB_Walzwerk".Bloecke</code>, <code>T "DB_Walzwerk".Status</code><br>' +
    '<b>Main</b> [OB1], in dieser Reihenfolge:<br><b>1:</b> <code>CALL "FB_Sicherung", "FB_Sicherung_DB"</code> (Eingänge gleichnamig, <code>"Quittieren"</code> → OK => <code>"Sicher_OK"</code>, Fehler => <code>"Stoerung"</code>)<br>' +
    '<b>2:</b> <code>CALL "FB_Ablauf", "FB_Ablauf_DB"</code> (Start := <code>"S_Start"</code>, Block_durch := <code>"Block_durch"</code>, Sicher_OK := <code>"Sicher_OK"</code>, Bloecke := <code>"DB_Walzwerk".Bloecke</code> → Ruhe => <code>"Lampe_Ruhe"</code>, Hupe => <code>"Hupe"</code>, Walzen => <code>"Walzen_Befehl"</code>)<br>' +
    '<b>3:</b> <code>CALL "FB_Motor", "FB_Motor_DB"</code> (Start := <code>"Walzen_Befehl"</code>, Stopp := <code>"Lampe_Ruhe"</code>, Freigabe := <code>"Sicher_OK"</code> → Laeuft => <code>"Walzen"</code>, Luefter => <code>"Luefter"</code>)<br>' +
    '<b>4:</b> <code>CALL "FC_Status"</code> (Laeuft := <code>"Walzen"</code>, Stoerung := <code>"Stoerung"</code>, RET_VAL := <code>"DB_Walzwerk".Status</code>)',
  learn:'Ein vollständiges Walzwerksprogramm aus Anlauf-OB, OB1 und Standardbausteinen.',
  take:'Du hast ein Walzwerksprogramm gebaut, wie es in echten S7-300-Anlagen läuft: Anlauf im OB100, ein OB1 als Inhaltsverzeichnis, geprüfte Standardbausteine für Sicherung, Ablauf und Motor, Daten im DB — warnungsfrei. Und du kannst es lesen, wenn es auf eine S7-1500 umziehen muss. ARIA hat keinen Ort mehr, an dem sie sich verstecken kann.',
  man:'programmstruktur', must:['STARTUP', 'CALL', 'SINGLE', 'FC_CALL', 'T'],
  hint:'Zuerst Startup (ein L, zwei T), dann Main mit vier Aufrufen.',
  hint2:'Die Reihenfolge im Main folgt dem Signal: Sicherung → Ablauf → Motor → Status. Die Parameter stehen im Auftrag.',
  blocks:[
    { name:'DB_Walzwerk', kind:'DB', src: DB_W },
    { name:'FB_Sicherung', kind:'FB', src: SICH_FB }, { name:'FB_Ablauf', kind:'FB', src: ABL_FB }, { name:'FB_Motor', kind:'FB', src: MOT_FB }, { name:'FC_Status', kind:'FC', src: STATUS_FC },
    { name:'Startup', kind:'OB', ob:100, edit:true, start: START(''), ref: FIN_START },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: FIN_MAIN }
  ],
  globals: Object.assign({ S_Start:false, Block_durch:false, Sicher_OK:false, Stoerung:false, Lampe_Ruhe:false, Hupe:false, Walzen_Befehl:false, Walzen:false, Luefter:false }, G_SICH),
  timed: seq([[0.1, {}, { Lampe_Ruhe:true, Walzen:false, 'DB_Walzwerk.Bloecke':0, 'DB_Walzwerk.Status':0 }], [0.1, { S_Start:true }, { Hupe:true, Lampe_Ruhe:false }], [0.1, { S_Start:false }, { Hupe:true }],
    [2.1, {}, { Walzen_Befehl:true, Walzen:true, 'DB_Walzwerk.Bloecke':1, 'DB_Walzwerk.Status':1 }], [0.1, { Oel_OK:false }, { Walzen:false, Stoerung:true, Lampe_Ruhe:true, 'DB_Walzwerk.Status':2 }],
    [0.1, { Oel_OK:true, S_Start:true }, { Hupe:false }], [0.1, { S_Start:false, Quittieren:true }, { Stoerung:false }], [0.1, { Quittieren:false, S_Start:true }, { Hupe:true }],
    [2.1, { S_Start:false }, { Walzen:true, 'DB_Walzwerk.Bloecke':2, 'DB_Walzwerk.Status':1 }], [0.1, { Block_durch:true }, { Lampe_Ruhe:true, Walzen:false, 'DB_Walzwerk.Status':0 }]]),
  wrong:[{ Startup: START('L  0\nT  "DB_Walzwerk".Status') }, { Main: MAIN(CALL_SICH + '\n\n' + CALL_MOT_FIN + '\n\n' + CALL_ABL + '\n\n' + CALL_STATUS) }],
  bind:['hornActive=Hupe', 'rollsRunning=Walzen', 'pumpRunning=Luefter', 'faultActive=Stoerung', 'pieceCount=DB_Walzwerk.Bloecke', 'displayValue=DB_Walzwerk.Status', 'displayLabel:"STATUS"'] });
})();
