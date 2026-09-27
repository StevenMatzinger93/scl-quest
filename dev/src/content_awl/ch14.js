/* ===== AWL QUEST · KAPITEL 14 — Standardbausteine: Antrieb, Rollgang, Ofen, Meldung (Profi-Stufe) ===== */
(function(){
const MAIN = body => aOB('Main', body);
const seq = steps => [{ steps }];

const ANT_D = { in:'Ein:Bool|Befehl; Freigabe:Bool; Rueckmeldung:Bool|Schütz-RM; Quittieren:Bool', out:'Motor:Bool; Stoerung:Bool', stat:'T_RM:TON', temp:'RM_fehlt:Bool' };
const ANT_BODY = 'NETWORK Motor\nU  #Ein\nU  #Freigabe\nUN #Stoerung\n=  #Motor\n\nNETWORK Rueckmeldung ueberwachen\nU  #Motor\nUN #Rueckmeldung\n=  #RM_fehlt\nCALL #T_RM\n   IN := #RM_fehlt\n   PT := T#2S\n\nNETWORK Stoerung\nU  #Quittieren\nR  #Stoerung\nU  #T_RM.Q\nS  #Stoerung';
const ANT_FB = aFB('FB_Antrieb', ANT_D, ANT_BODY);
defAwlPro({ id:'ap14_antrieb', ch:14, title:'Der Standard-Antrieb',
  story:'Rollgang, Walzen, Pumpe — alle Antriebe funktionieren gleich: Befehl, Freigabe, Rückmeldung vom Schütz, Störung. Herr Brunner will <b>einen</b> Baustein für alle.',
  brief:'<code>FB_Antrieb</code> (Static <code>T_RM : TON</code>, Temp <code>RM_fehlt</code>):<br><b>NW 1:</b> <code>#Motor</code> = <code>#Ein</code> UND <code>#Freigabe</code> UND NICHT <code>#Stoerung</code><br><b>NW 2:</b> <code>#RM_fehlt</code> = <code>#Motor</code> UND NICHT <code>#Rueckmeldung</code>; <code>CALL #T_RM</code> (IN := <code>#RM_fehlt</code>, PT := <code>T#2S</code>)<br><b>NW 3:</b> <code>U #Quittieren</code> → <code>R #Stoerung</code>; <code>U #T_RM.Q</code> → <code>S #Stoerung</code>',
  learn:'Einen Standardbaustein mit Überwachung bauen.',
  take:'Ein <b>Standardbaustein</b> kapselt ein Gerät vollständig: Befehl, Freigabe, Rückmeldung, Überwachung, Störung. Wer ihn einsetzt, kennt nur die Schnittstelle.',
  man:'standard', must:['TON', 'S', 'R', 'TEMP'],
  hint:'Drei Netzwerke; die Zeitabfrage heisst U #T_RM.Q.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: aFB('FB_Antrieb', ANT_D, ''), ref: ANT_FB },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Antrieb", "Rollgang_DB"\n   Ein := "S_Rollgang"\n   Freigabe := "Not_Aus_OK"\n   Rueckmeldung := "Rollgang_RM"\n   Quittieren := "Quittieren"\n   Motor => "Rollgang"\n   Stoerung => "Stoerung"') }
  ],
  globals:{ S_Rollgang:false, Not_Aus_OK:true, Rollgang_RM:false, Quittieren:false, Rollgang:false, Stoerung:false }, instances:{ Rollgang_DB:'FB_Antrieb' },
  timed: seq([[0, { S_Rollgang:true }, { Rollgang:true }], [0.5, { Rollgang_RM:true }, { Rollgang:true, Stoerung:false }], [3, {}, { Stoerung:false }], [0.1, { Rollgang_RM:false }, {}], [2.1, {}, { Stoerung:true }], [0.1, {}, { Rollgang:false }], [0.1, { Quittieren:true, Rollgang_RM:true }, { Stoerung:false }], [0.1, { Quittieren:false, Not_Aus_OK:false }, { Rollgang:false }]]),
  bind:['conveyorRunning=Rollgang', 'faultActive=Stoerung'] });

const RG_D = { in:'Vor:Bool; Rueck:Bool; Halt:Bool', out:'Mot_Vor:Bool; Mot_Rueck:Bool' };
const RG_BODY = 'NETWORK Vorwaerts\nU(\nO  #Vor\nO  #Mot_Vor\n)\nUN #Halt\nUN #Mot_Rueck\n=  #Mot_Vor\n\nNETWORK Rueckwaerts\nU(\nO  #Rueck\nO  #Mot_Rueck\n)\nUN #Halt\nUN #Mot_Vor\n=  #Mot_Rueck';
const RG_FB = aFB('FB_Rollgang', RG_D, RG_BODY);
defAwlPro({ id:'ap14_rollgang', ch:14, title:'Der Standard-Rollgang',
  story:'Jeder Rollgang des Reversiergerüsts fährt vor und zurück, mit Verriegelung und Halt. Als Standardbaustein gibt es die Logik nur einmal.',
  brief:'<code>FB_Rollgang</code>: zwei Selbsthaltungen mit gegenseitiger Verriegelung (wie in Kapitel 3), jeweils mit <code>UN #Halt</code>.',
  learn:'Verriegelung im Standardbaustein.',
  take:'Die Verriegelung gehört <b>in</b> den Baustein — dann kann sie niemand beim Einsetzen vergessen.',
  man:'standard', must:['KLAMMER', 'UN'],
  hint:'NW Vorwärts: U( O #Vor O #Mot_Vor ) UN #Halt UN #Mot_Rueck = #Mot_Vor',
  blocks:[
    { name:'FB_Rollgang', kind:'FB', edit:true, start: aFB('FB_Rollgang', RG_D, ''), ref: RG_FB },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Rollgang", "FB_Rollgang_DB"\n   Vor := "S_Vor"\n   Rueck := "S_Rueck"\n   Halt := "S_Halt"\n   Mot_Vor => "Rollgang"\n   Mot_Rueck => "Rueckwaerts"') }
  ],
  globals:{ S_Vor:false, S_Rueck:false, S_Halt:false, Rollgang:false, Rueckwaerts:false },
  unit:[{ block:'FB_Rollgang', steps:[[0.1, { Vor:true, Rueck:false, Halt:false }, { Mot_Vor:true, Mot_Rueck:false }], [0.1, { Vor:false, Rueck:true }, { Mot_Vor:true, Mot_Rueck:false }], [0.1, { Rueck:false, Halt:true }, { Mot_Vor:false }], [0.1, { Halt:false, Rueck:true }, { Mot_Rueck:true, Mot_Vor:false }]] }],
  timed: seq([[0.1, { S_Vor:true }, { Rollgang:true }], [0.1, { S_Vor:false, S_Halt:true }, { Rollgang:false }], [0.1, { S_Halt:false, S_Rueck:true }, { Rueckwaerts:true }]]),
  bind:['conveyorRunning=Rollgang', 'conveyorReverse=Rueckwaerts'] });

const OF_D = { in:'Temp:Int; Soll:Int|°C; Hysterese:Int|°C', out:'Heizung:Bool; Temp_OK:Bool', temp:'Unten:Int' };
const OF_BODY = 'NETWORK Untere Grenze\nL  #Soll\nL  #Hysterese\n-I\nT  #Unten\n\nNETWORK Heizen\nU(\nL  #Temp\nL  #Unten\n<I\n)\nS  #Heizung\nU(\nL  #Temp\nL  #Soll\n>I\n)\nR  #Heizung\n\nNETWORK Temperatur OK\nL  #Temp\nL  #Unten\n>=I\n=  #Temp_OK';
const OF_FB = aFB('FB_Ofen', OF_D, OF_BODY);
defAwlPro({ id:'ap14_ofen', ch:14, title:'Der Standard-Ofenregler',
  story:'Der Zweipunktregler aus Kapitel 9 wird Standard: Sollwert und Hysterese kommen jetzt über die Schnittstelle — so passt er für jeden Ofen.',
  brief:'<code>FB_Ofen</code> (Temp <code>Unten : Int</code>):<br><b>NW 1:</b> <code>#Unten</code> = <code>#Soll</code> − <code>#Hysterese</code><br><b>NW 2:</b> <code>#Temp</code> &lt; <code>#Unten</code> → <code>S #Heizung</code>; <code>#Temp</code> &gt; <code>#Soll</code> → <code>R #Heizung</code><br><b>NW 3:</b> <code>#Temp_OK</code> = <code>#Temp</code> ≥ <code>#Unten</code>',
  learn:'Parameter statt fester Grenzen.',
  take:'Ein Standardbaustein hat keine festen Zahlen im Code. Grenzen und Zeiten kommen über die Schnittstelle — oft aus einem Parameter-DB.',
  man:'standard', must:['TEMP', '-I', 'CMP_I', 'S', 'R'],
  hint:'Die untere Grenze einmal in Temp berechnen, dann zweimal benutzen.',
  blocks:[
    { name:'FB_Ofen', kind:'FB', edit:true, start: aFB('FB_Ofen', OF_D, ''), ref: OF_FB },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Ofen", "FB_Ofen_DB"\n   Temp := "Temp"\n   Soll := 1200\n   Hysterese := 50\n   Heizung => "Heizung"\n   Temp_OK => "Lampe_Gruen"') }
  ],
  globals:{ Temp:1000, Heizung:false, Lampe_Gruen:false },
  timed: seq([[0.1, {}, { Heizung:true, Lampe_Gruen:false }], [0.1, { Temp:1170 }, { Heizung:true, Lampe_Gruen:true }], [0.1, { Temp:1201 }, { Heizung:false }], [0.1, { Temp:1160 }, { Heizung:false, Lampe_Gruen:true }], [0.1, { Temp:1149 }, { Heizung:true, Lampe_Gruen:false }]]),
  bind:['furnaceTemp=Temp', 'furnaceOn=Heizung', 'lightGreen=Lampe_Gruen'] });

defAwlPro({ id:'ap14_global_dbg', ch:14, title:'Der heimliche Draht', debug:true, warnFree:['GLOBAL_ACCESS'],
  story:'Der Rollgang-Antrieb fährt nicht mehr an, sobald irgendwo im Werk ein Not-Aus gedrückt ist — auch in der anderen Halle. <code>FB_Antrieb</code> liest heimlich die globale Variable <code>"Not_Aus_Halle_2"</code>. Der Compiler warnt.',
  brief:'<code>FB_Antrieb</code> darf nur über seine Schnittstelle arbeiten: Ersetze <code>"Not_Aus_Halle_2"</code> durch <code>#Freigabe</code>.',
  learn:'Standardbausteine ohne globale Zugriffe.',
  take:'Ein Baustein, der globale Variablen liest, funktioniert nur in <b>einer</b> Anlage. Alles gehört in die Schnittstelle — die Warnung <b>GLOBAL_ACCESS</b> zeigt solche Stellen.',
  man:'standard', must:['TON'],
  hint:'In NW 1: U "Not_Aus_Halle_2" → U #Freigabe.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: ANT_FB.replace('U  #Freigabe', 'U  "Not_Aus_Halle_2"'), ref: ANT_FB },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Antrieb", "Rollgang_DB"\n   Ein := "S_Rollgang"\n   Freigabe := "Not_Aus_OK"\n   Rueckmeldung := "Rollgang_RM"\n   Quittieren := "Quittieren"\n   Motor => "Rollgang"\n   Stoerung => "Stoerung"') }
  ],
  globals:{ S_Rollgang:false, Not_Aus_OK:true, Not_Aus_Halle_2:false, Rollgang_RM:true, Quittieren:false, Rollgang:false, Stoerung:false }, instances:{ Rollgang_DB:'FB_Antrieb' },
  timed: seq([[0.1, { S_Rollgang:true }, { Rollgang:true }], [0.1, { Not_Aus_OK:false }, { Rollgang:false }]]),
  bind:['conveyorRunning=Rollgang'] });

const VS_MAIN = 'NETWORK Ofen\nCALL "FB_Ofen", "FB_Ofen_DB"\n   Temp := "Temp"\n   Soll := 1200\n   Hysterese := 50\n   Heizung => "Heizung"\n\nNETWORK Walzen\nCALL "FB_Antrieb", "Walzen_DB"\n   Ein := "S_Walzen"\n   Freigabe := "FB_Ofen_DB".Temp_OK\n   Rueckmeldung := "Walzen_RM"\n   Quittieren := "Quittieren"\n   Motor => "Walzen"\n   Stoerung => "Stoerung"';
const VS_G = { Temp:1000, Heizung:false, S_Walzen:false, Walzen_RM:true, Quittieren:false, Walzen:false, Stoerung:false };
const VS_T = seq([[0.1, { S_Walzen:true }, { Walzen:false, Heizung:true }], [0.1, { Temp:1170 }, { Walzen:true }], [0.1, { Temp:1100 }, { Walzen:false }]]);
defAwlPro({ id:'ap14_verschaltung', ch:14, title:'Bausteine verschalten',
  story:'Das Gerüst darf nur walzen, wenn der Ofen die Temperatur hält. Der Ofenbaustein liefert das — man liest es direkt aus seiner Instanz: <code>"FB_Ofen_DB".Temp_OK</code>.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> <code>CALL "FB_Ofen", "FB_Ofen_DB"</code> (Temp := <code>"Temp"</code>, Soll := <code>1200</code>, Hysterese := <code>50</code>, Heizung => <code>"Heizung"</code>)<br><b>NW 2:</b> <code>CALL "FB_Antrieb", "Walzen_DB"</code> (Ein := <code>"S_Walzen"</code>, Freigabe := <code>"FB_Ofen_DB".Temp_OK</code>, Rueckmeldung := <code>"Walzen_RM"</code>, Quittieren := <code>"Quittieren"</code>, Motor => <code>"Walzen"</code>, Stoerung => <code>"Stoerung"</code>)',
  learn:'Standardbausteine im OB1 verbinden.',
  take:'Ausgänge eines FB stehen in seiner Instanz: <code>"FB_Ofen_DB".Temp_OK</code>. Die Aufrufreihenfolge bestimmt, ob der Wert aus diesem oder dem letzten Zyklus stammt.',
  man:'standard', must:['CALL', 'SINGLE', 'DB_ACCESS'],
  hint:'Erst der Ofen, dann das Gerüst.',
  blocks:[ { name:'FB_Ofen', kind:'FB', src: OF_FB }, { name:'FB_Antrieb', kind:'FB', src: ANT_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(VS_MAIN) } ],
  globals: VS_G, instances:{ Walzen_DB:'FB_Antrieb' }, timed: VS_T,
  bind:['furnaceTemp=Temp', 'furnaceOn=Heizung', 'rollsRunning=Walzen'] });

const BA_D = { in:'Automatik:Bool; Hand_Befehl:Bool|Tipptaster; Auto_Befehl:Bool|vom Ablauf', out:'Befehl:Bool; Lampe_Auto:Bool' };
defAwlPro({ id:'ap14_betriebsart', ch:14, title:'Hand oder Automatik',
  story:'Im Automatikbetrieb steuert der Ablauf den Rollgang, im Handbetrieb der Tipptaster. Die Umschaltung merkt sich nichts — also eine <b>FC</b>.',
  brief:'<code>FC_Betriebsart</code>:<br><code>#Befehl</code> = (<code>#Automatik</code> UND <code>#Auto_Befehl</code>) ODER (NICHT <code>#Automatik</code> UND <code>#Hand_Befehl</code>)<br><code>#Lampe_Auto</code> = <code>#Automatik</code>',
  learn:'FC oder FB: Nur wer sich etwas merkt, braucht einen FB.',
  take:'<b>FC</b> für reine Verknüpfungen, <b>FB</b> für alles mit Gedächtnis.',
  man:'standard', must:['O_VOR', 'UN'],
  hint:'U #Automatik · U #Auto_Befehl · O · UN #Automatik · U #Hand_Befehl · = #Befehl',
  blocks:[
    { name:'FC_Betriebsart', kind:'FC', edit:true, start: aFC('FC_Betriebsart', 'Void', BA_D, ''), ref: aFC('FC_Betriebsart', 'Void', BA_D, 'U  #Automatik\nU  #Auto_Befehl\nO\nUN #Automatik\nU  #Hand_Befehl\n=  #Befehl\nU  #Automatik\n=  #Lampe_Auto') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Betriebsart"\n   Automatik := "Automatik"\n   Hand_Befehl := "S_Tippen"\n   Auto_Befehl := "Ablauf_Rollgang"\n   Befehl => "Rollgang"\n   Lampe_Auto => "Lampe_Gelb"') }
  ],
  globals:{ Automatik:false, S_Tippen:false, Ablauf_Rollgang:false, Rollgang:false, Lampe_Gelb:false },
  unit:[{ block:'FC_Betriebsart', steps: truth(['Automatik', 'Hand_Befehl', 'Auto_Befehl'], e => ({ Befehl: (e.Automatik && e.Auto_Befehl) || (!e.Automatik && e.Hand_Befehl), Lampe_Auto: e.Automatik })) }],
  tests:[[{ Automatik:true, Ablauf_Rollgang:true }, { Rollgang:true, Lampe_Gelb:true }], [{ S_Tippen:true }, { Rollgang:true, Lampe_Gelb:false }], [{ Automatik:true, S_Tippen:true }, { Rollgang:false }]],
  bind:['conveyorRunning=Rollgang', 'lightYellow=Lampe_Gelb'] });

const ZZ_D = { in:'Block:Bool', inout:'Summe:Int', stat:'M_Flanke:Bool' };
const ZZ_BODY = 'U  #Block\nFP #M_Flanke\nSPBN ENDE\nL  #Summe\nINC 1\nT  #Summe\nENDE: NOP 0';
defAwlPro({ id:'ap14_inout', ch:14, title:'Zwei Linien, eine Summe',
  story:'Beide Walzlinien zählen ihre Blöcke. Die Tagesstatistik hat aber nur eine Zahl. Beide Instanzen des Zählbausteins sollen dieselbe Variable erhöhen — über einen <b>InOut</b>-Parameter.',
  brief:'<code>FB_Zaehler</code> (InOut <code>Summe : Int</code>, Static <code>M_Flanke</code>):<br><code>U #Block</code> · <code>FP #M_Flanke</code> · <code>SPBN ENDE</code> · <code>L #Summe</code> · <code>INC 1</code> · <code>T #Summe</code> · <code>ENDE: NOP 0</code><br><code>Main</code> (🔒) übergibt beiden Instanzen <code>"DB_Statistik".Bloecke</code>.',
  learn:'InOut-Parameter: die Variable des Aufrufers lesen und ändern.',
  take:'Ein <b>InOut</b>-Parameter verweist auf die Variable des Aufrufers — ideal für gemeinsame Zähler.',
  man:'standard', must:['VAR_IN_OUT', 'FP', 'INC'],
  hint:'Wie der Zählbaustein aus Kapitel 12 — die Summe ist jetzt InOut.',
  blocks:[
    { name:'DB_Statistik', kind:'DB', src: aDB('DB_Statistik', 'Bloecke:Int|beide Linien') },
    { name:'FB_Zaehler', kind:'FB', edit:true, start: aFB('FB_Zaehler', ZZ_D, ''), ref: aFB('FB_Zaehler', ZZ_D, ZZ_BODY) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Linie 1\nCALL "FB_Zaehler", "Linie1_DB"\n   Block := "Block_1"\n   Summe := "DB_Statistik".Bloecke\n\nNETWORK Linie 2\nCALL "FB_Zaehler", "Linie2_DB"\n   Block := "Block_2"\n   Summe := "DB_Statistik".Bloecke') }
  ],
  globals:{ Block_1:false, Block_2:false }, instances:{ Linie1_DB:'FB_Zaehler', Linie2_DB:'FB_Zaehler' },
  timed: seq([[0.1, { Block_1:true }, { 'DB_Statistik.Bloecke':1 }], [0.1, { Block_1:false }, {}], [0.1, { Block_2:true }, { 'DB_Statistik.Bloecke':2 }], [0.1, { Block_2:false }, {}], [0.1, { Block_1:true, Block_2:true }, { 'DB_Statistik.Bloecke':4 }]]),
  bind:['pieceCount=DB_Statistik.Bloecke'] });

const MEL_D = { in:'Signal:Bool; Quittieren:Bool; Takt:Bool', out:'Lampe:Bool', stat:'Neu:Bool; Gespeichert:Bool; M_Signal:Bool' };
const MEL_BODY = 'NETWORK Kommt\nU  #Signal\nFP #M_Signal\nS  #Neu\nS  #Gespeichert\n\nNETWORK Quittieren\nU  #Quittieren\nR  #Neu\n\nNETWORK Geht\nUN #Signal\nUN #Neu\nR  #Gespeichert\n\nNETWORK Lampe\nU  #Neu\nU  #Takt\nO\nU  #Gespeichert\nUN #Neu\n=  #Lampe';
defAwlPro({ id:'ap14_meldung', ch:14, title:'Der Meldebaustein',
  story:'Neue Störung = blinkt, quittiert und anstehend = Dauerlicht, gegangen und quittiert = aus. Diese Regel gilt für jede Meldung am Leitstand.',
  brief:'<code>FB_Meldung</code> (Static <code>Neu</code>, <code>Gespeichert</code>, <code>M_Signal</code>):<br><b>NW 1:</b> FP <code>#Signal</code> → <code>S #Neu</code>, <code>S #Gespeichert</code><br><b>NW 2:</b> <code>#Quittieren</code> → <code>R #Neu</code><br><b>NW 3:</b> NICHT <code>#Signal</code> UND NICHT <code>#Neu</code> → <code>R #Gespeichert</code><br><b>NW 4:</b> <code>#Lampe</code> = (<code>#Neu</code> UND <code>#Takt</code>) ODER (<code>#Gespeichert</code> UND NICHT <code>#Neu</code>)',
  learn:'Das Meldeprinzip als Standardbaustein.',
  take:'Blinkt = neu, Dauerlicht = quittiert und anstehend, aus = erledigt. Als Baustein gilt die Regel für jede Meldung gleich.',
  man:'standard', must:['FP', 'S', 'R', 'O_VOR'],
  hint:'NW 1 hat zwei S-Zeilen hintereinander — das VKE bleibt stehen.',
  blocks:[
    { name:'FB_Meldung', kind:'FB', edit:true, start: aFB('FB_Meldung', MEL_D, ''), ref: aFB('FB_Meldung', MEL_D, MEL_BODY) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Oeldruck\nCALL "FB_Meldung", "Oel_Meldung_DB"\n   Signal := "Oeldruck_tief"\n   Quittieren := "Quittieren"\n   Takt := "Takt_1Hz"\n   Lampe => "Lampe_Oel"\n\nNETWORK Wasser\nCALL "FB_Meldung", "Wasser_Meldung_DB"\n   Signal := "Wasser_fehlt"\n   Quittieren := "Quittieren"\n   Takt := "Takt_1Hz"\n   Lampe => "Lampe_Wasser"') }
  ],
  globals:{ Oeldruck_tief:false, Wasser_fehlt:false, Quittieren:false, Takt_1Hz:false, Lampe_Oel:false, Lampe_Wasser:false }, instances:{ Oel_Meldung_DB:'FB_Meldung', Wasser_Meldung_DB:'FB_Meldung' },
  unit:[{ block:'FB_Meldung', steps:[[0.1, { Signal:true, Takt:true, Quittieren:false }, { Lampe:true }], [0.1, { Takt:false }, { Lampe:false }], [0.1, { Quittieren:true }, { Lampe:true }], [0.1, { Quittieren:false, Signal:false }, { Lampe:false }], [0.1, { Signal:true, Takt:true }, { Lampe:true }], [0.1, { Signal:false, Takt:false }, { Lampe:false }], [0.1, { Takt:true }, { Lampe:true }], [0.1, { Quittieren:true }, { Lampe:false }]] }],
  timed: seq([[0.1, { Oeldruck_tief:true, Takt_1Hz:true }, { Lampe_Oel:true, Lampe_Wasser:false }], [0.5, { Takt_1Hz:false }, { Lampe_Oel:false }], [0.1, { Quittieren:true }, { Lampe_Oel:true }]]),
  bind:['lightRed=Lampe_Oel', 'lightYellow=Lampe_Wasser'] });

defAwlPro({ id:'ap14_verschaltung_dbg', ch:14, title:'Der falsche Ausgang', debug:true,
  story:'Das Gerüst läuft los, sobald der Ofen heizt — auch wenn der Block noch kalt ist. ARIA hat beim Verschalten den falschen Ausgang des Ofenbausteins erwischt.',
  brief:'Die Freigabe des Gerüsts ist <code>Temp_OK</code>, nicht <code>Heizung</code>.',
  learn:'Instanzausgänge beim Verschalten prüfen.',
  take:'Heizung und Temp_OK sind beide Bool — nur einer ist die Freigabe. Beim Verschalten zählt die Bedeutung, nicht der Typ.',
  man:'standard', must:['CALL'],
  hint:'Freigabe := "FB_Ofen_DB".Temp_OK',
  blocks:[ { name:'FB_Ofen', kind:'FB', src: OF_FB }, { name:'FB_Antrieb', kind:'FB', src: ANT_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(VS_MAIN.replace('"FB_Ofen_DB".Temp_OK', '"FB_Ofen_DB".Heizung')), ref: MAIN(VS_MAIN) } ],
  globals: VS_G, instances:{ Walzen_DB:'FB_Antrieb' }, timed: VS_T,
  bind:['furnaceTemp=Temp', 'furnaceOn=Heizung', 'rollsRunning=Walzen'] });

const WS_D = { in:'Temp:Int; S_Walzen:Bool; Walzen_RM:Bool; Quittieren:Bool', out:'Heizung:Bool; Walzen:Bool; Stoerung:Bool', stat:'Ofen:"FB_Ofen"; Geruest:"FB_Antrieb"' };
const WS_BODY = 'NETWORK Ofen\nCALL #Ofen\n   Temp := #Temp\n   Soll := 1200\n   Hysterese := 50\n   Heizung => #Heizung\n\nNETWORK Geruest\nCALL #Geruest\n   Ein := #S_Walzen\n   Freigabe := #Ofen.Temp_OK\n   Rueckmeldung := #Walzen_RM\n   Quittieren := #Quittieren\n   Motor => #Walzen\n   Stoerung => #Stoerung';
defAwlPro({ id:'ap14_boss', ch:14, title:'Boss: Die Walzlinie aus Standardbausteinen', boss:true,
  story:'ARIA hat sich in der Walzlinie verschanzt. Herr Brunner legt deine Standardbausteine auf den Tisch: „Ofen und Gerüst — als Multiinstanzen in <code>FB_Walzlinie</code>, sauber verschaltet.“',
  brief:'<code>FB_Walzlinie</code> (Static <code>Ofen : "FB_Ofen"</code>, <code>Geruest : "FB_Antrieb"</code>):<br><b>NW 1:</b> <code>CALL #Ofen</code> (Temp := <code>#Temp</code>, Soll := <code>1200</code>, Hysterese := <code>50</code>, Heizung => <code>#Heizung</code>)<br><b>NW 2:</b> <code>CALL #Geruest</code> (Ein := <code>#S_Walzen</code>, Freigabe := <code>#Ofen.Temp_OK</code>, Rueckmeldung := <code>#Walzen_RM</code>, Quittieren := <code>#Quittieren</code>, Motor => <code>#Walzen</code>, Stoerung => <code>#Stoerung</code>)',
  learn:'Eine Anlage aus Standardbausteinen als Multiinstanzen.',
  take:'Geprüfte Standardbausteine werden in einem Anlagen-FB verschaltet. Jeder bleibt einfach, das Zusammenspiel steht in wenigen Zeilen.',
  man:'standard', must:['MULTI', 'CALL'],
  hint:'Ausgänge einer Multiinstanz: #Ofen.Temp_OK.',
  blocks:[ { name:'FB_Ofen', kind:'FB', src: OF_FB }, { name:'FB_Antrieb', kind:'FB', src: ANT_FB },
    { name:'FB_Walzlinie', kind:'FB', edit:true, start: aFB('FB_Walzlinie', WS_D, ''), ref: aFB('FB_Walzlinie', WS_D, WS_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Walzlinie", "FB_Walzlinie_DB"\n   Temp := "Temp"\n   S_Walzen := "S_Walzen"\n   Walzen_RM := "Walzen_RM"\n   Quittieren := "Quittieren"\n   Heizung => "Heizung"\n   Walzen => "Walzen"\n   Stoerung => "Stoerung"') } ],
  globals:{ Temp:1000, S_Walzen:false, Walzen_RM:false, Quittieren:false, Heizung:false, Walzen:false, Stoerung:false },
  timed: seq([[0, { S_Walzen:true }, { Heizung:true, Walzen:false }], [0.1, { Temp:1170 }, { Walzen:true }], [0.5, { Walzen_RM:true }, { Walzen:true, Stoerung:false }], [0.1, { Walzen_RM:false }, {}], [2.1, {}, { Stoerung:true }], [0.1, {}, { Walzen:false }], [0.1, { Quittieren:true, Walzen_RM:true }, { Stoerung:false }], [0.1, { Quittieren:false, Temp:1100 }, { Walzen:false, Heizung:true }]]),
  bind:['furnaceTemp=Temp', 'furnaceOn=Heizung', 'rollsRunning=Walzen', 'faultActive=Stoerung'] });
})();
