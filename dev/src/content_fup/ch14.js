/* ===== FUP QUEST · KAPITEL 14 — Standardbausteine: Weiche, Signal, Bahnübergang, Meldung (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const seq = steps => [{ steps }];

const SIG_D = { in:'Fahrt_Anf:Bool|Fahrtanforderung; FS_gesichert:Bool; Gleis_frei:Bool; Stoerung:Bool', out:'Fahrt:Bool|Signal auf Fahrt; Halt_Melder:Bool' };
const SIG_NW = 'NETWORK Fahrt\n(#Fahrt_Anf OR #Fahrt) AND #FS_gesichert AND #Gleis_frei AND NOT #Stoerung => #Fahrt;\n\nNETWORK Haltmelder\n#Fahrt => NOT #Halt_Melder;';
const SIG_FB = kFB('FB_Signal', SIG_D, SIG_NW);
const BUE_D = { in:'Anforderung:Bool|Zug nähert sich', out:'Blinklicht:Bool; Glocke:Bool; Schranke_zu:Bool', stat:'T_Glocke:TP; T_Vorlauf:TON' };
const BUE_NW = 'NETWORK Blinklicht\n#Anforderung => #Blinklicht;\n\nNETWORK Glocke\n#Anforderung AND TP(#T_Glocke, T#2S) => #Glocke;\n\nNETWORK Schranke\n#Anforderung AND TON(#T_Vorlauf, T#3S) => #Schranke_zu;';
const BUE_FB = kFB('FB_BUE', BUE_D, BUE_NW);

defFupPro({ id:'fp14_signal', ch:14, title:'Der Standard-Signalbaustein',
  story:'Das Stellwerk hat viele Signale, alle mit derselben Logik: Fahrtanforderung hält sich selbst, solange die Fahrstrasse gesichert und das Gleis frei ist; eine Störung wirft sofort auf Halt. Frau Gasser will <b>einen</b> Baustein für alle.',
  brief:'<code>FB_Signal</code>:<br><b>NW 1:</b> (<code>#Fahrt_Anf</code> oder <code>#Fahrt</code>) und Fahrstrasse gesichert und <code>#Gleis_frei</code> und keine Störung → <code>#Fahrt</code><br><b>NW 2:</b> <code>#Fahrt</code> → negiert <code>#Halt_Melder</code>',
  learn:'Einen wiederverwendbaren Signalbaustein bauen.',
  take:'Ein <b>Standardbaustein</b> kapselt ein Gerät vollständig und kennt nur seine Schnittstelle. So passt er an jedes Signal.',
  man:'standard', must:['PARALLEL','NCOIL'],
  hint:'NW 1: Selbsthaltung mit vier Bedingungen.',
  blocks:[
    { name:'FB_Signal', kind:'FB', edit:true, start: kFB('FB_Signal', SIG_D, ''), ref: SIG_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Signal A\n=> "FB_Signal_DB"(Fahrt_Anf := "Taste_A", FS_gesichert := "FS_gesichert", Gleis_frei := "Gleis1_frei", Stoerung := "Stoerung", Fahrt => "Signal_A", Halt_Melder => "Melder_Rot");') }
  ],
  globals:{ Taste_A:false, FS_gesichert:true, Gleis1_frei:true, Stoerung:false, Signal_A:false, Melder_Rot:false },
  unit:[{ block:'FB_Signal', steps:[[0,{ Fahrt_Anf:true, FS_gesichert:true, Gleis_frei:true },{ Fahrt:true, Halt_Melder:false }],[0.1,{ Fahrt_Anf:false },{ Fahrt:true }],[0.1,{ Gleis_frei:false },{ Fahrt:false, Halt_Melder:true }],[0.1,{ Gleis_frei:true },{ Fahrt:false }],[0.1,{ Fahrt_Anf:true, Stoerung:true },{ Fahrt:false }]] }],
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true, Melder_Rot:false }],[0.1,{ Taste_A:false },{ Signal_A:true }],[0.1,{ Stoerung:true },{ Signal_A:false, Melder_Rot:true }]]),
  bind:['signalEntry=Signal_A', 'lightRed=Melder_Rot'] });

defFupPro({ id:'fp14_bue', ch:14, title:'Der Standard-Bahnübergang',
  story:'Jeder Bahnübergang braucht dasselbe: Blinklicht sofort, Glocke 2 Sekunden, Schranke nach 3 Sekunden. Als Standardbaustein wird daraus ein Aufruf pro Übergang.',
  brief:'<code>FB_BUE</code> (Static <code>T_Glocke : TP</code>, <code>T_Vorlauf : TON</code>), alles bei <code>#Anforderung</code>:<br><b>NW 1:</b> Blinklicht sofort<br><b>NW 2:</b> Glocke 2 s (TP)<br><b>NW 3:</b> Schranke zu nach 3 s (TON)',
  learn:'Mehrere Timer als Multiinstanzen in einem Standardbaustein.',
  take:'Jede Zeit hat ihre eigene Multiinstanz. Von aussen gibt es nur einen Eingang und drei Ausgänge.',
  man:'standard', must:['TP','TON'],
  hint:'Drei Netzwerke, zwei Timer-Typen.',
  blocks:[
    { name:'FB_BUE', kind:'FB', edit:true, start: kFB('FB_BUE', BUE_D, ''), ref: BUE_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang\n=> "FB_BUE_DB"(Anforderung := "Zug_meldet", Blinklicht => "Blinklicht", Glocke => "Glocke", Schranke_zu => "Schranke_zu");') }
  ],
  globals:{ Zug_meldet:false, Blinklicht:false, Glocke:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_meldet:true },{ Blinklicht:true, Glocke:true, Schranke_zu:false }],[2.1,{},{ Glocke:false, Schranke_zu:false }],[1,{},{ Schranke_zu:true }],[0.1,{ Zug_meldet:false },{ Blinklicht:false, Schranke_zu:false }]]),
  bind:['trainApproach=Zug_meldet', 'crossingLights=Blinklicht', 'crossingBell=Glocke', 'crossingClosed=Schranke_zu'] });

const WS_D = { in:'Stellen_L:Bool; Stellen_R:Bool; End_L:Bool; End_R:Bool; Quittieren:Bool', out:'nach_L:Bool; nach_R:Bool; Stoerung:Bool', stat:'T_Lauf:TON', temp:'Laeuft:Bool' };
const WS_NW = 'NETWORK Nach links\n(#Stellen_L OR #nach_L) AND NOT #End_L AND NOT #nach_R AND NOT #Stoerung => #nach_L;\n\nNETWORK Nach rechts\n(#Stellen_R OR #nach_R) AND NOT #End_R AND NOT #nach_L AND NOT #Stoerung => #nach_R;\n\nNETWORK Laeuft\n#nach_L OR #nach_R => #Laeuft;\n\nNETWORK Laufzeit\n#Laeuft AND TON(#T_Lauf, T#6S) => RS(#Stoerung, #Quittieren);';
defFupPro({ id:'fp14_weiche', ch:14, title:'Der Standard-Weichenbaustein',
  story:'Der Weichenbaustein wird Standard: Eine gestörte Weiche darf erst nach dem Quittieren wieder laufen.',
  brief:'<code>FB_Weiche</code>: wie im Boss von Kapitel 12, aber beide Richtungen zusätzlich mit negiertem <code>#Stoerung</code>.',
  learn:'Störung als Sperre im Standardbaustein.',
  take:'Ein Standardbaustein sperrt sich bei einer Störung selbst. Wer ihn einsetzt, muss daran nicht denken.',
  man:'standard', must:['TON','RS','NC'],
  hint:'Vier Netzwerke; die ersten beiden bekommen je einen weiteren negierten Eingang.',
  blocks:[
    { name:'FB_Weiche', kind:'FB', edit:true, start: kFB('FB_Weiche', WS_D, ''), ref: kFB('FB_Weiche', WS_D, WS_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 1\n=> "FB_Weiche_DB"(Stellen_L := "W1_links", Stellen_R := "W1_rechts", End_L := "W1_End_L", End_R := "W1_End_R", Quittieren := "Quittieren", nach_L => "W1_nach_L", nach_R => "W1_nach_R", Stoerung => "W1_Stoerung");') }
  ],
  globals:{ W1_links:false, W1_rechts:false, W1_End_L:false, W1_End_R:false, Quittieren:false, W1_nach_L:false, W1_nach_R:false, W1_Stoerung:false },
  unit:[{ block:'FB_Weiche', steps:[[0,{ Stellen_R:true },{ nach_R:true }],[0.1,{ Stellen_R:false },{}],[6.1,{},{ Stoerung:true }],[0.1,{},{ nach_R:false }],[0.1,{ Stellen_L:true },{ nach_L:false }],[0.1,{ Stellen_L:false, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, Stellen_L:true },{ nach_L:true }]] }],
  timed: seq([[0,{ W1_rechts:true },{ W1_nach_R:true }],[0.1,{ W1_rechts:false, W1_End_R:true },{ W1_nach_R:false, W1_Stoerung:false }]]),
  bind:['switch1Moving=W1_nach_R', 'faultActive=W1_Stoerung'] });

defFupPro({ id:'fp14_global_dbg', ch:14, title:'Der heimliche Draht', debug:true, warnFree:['GLOBAL_ACCESS'],
  story:'Signal B fällt bei einer Störung nicht auf Halt, weil <code>FB_Signal</code> heimlich die globale Variable <code>"Stoerung"</code> statt seines Eingangs liest, und für Signal B heisst die Störung anders. Der Compiler warnt.',
  brief:'<code>FB_Signal</code> darf nur über seine Schnittstelle arbeiten: Die Störung muss vom Eingang des Bausteins kommen, nicht von der globalen PLC-Variable.',
  learn:'Standardbausteine ohne globale Zugriffe.',
  take:'Ein Baustein, der globale Variablen liest, funktioniert nur in <b>einer</b> Anlage. Alles gehört in die Schnittstelle — die Warnung <b>GLOBAL_ACCESS</b> zeigt solche Stellen.',
  man:'standard', must:['NCOIL'],
  hint:'Den Eingang "Stoerung" antippen und #Stoerung zuweisen.',
  blocks:[
    { name:'FB_Signal', kind:'FB', edit:true, start: kFB('FB_Signal', SIG_D, SIG_NW.replace('AND NOT #Stoerung', 'AND NOT "Stoerung"')), ref: SIG_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Signal B\n=> "FB_Signal_DB"(Fahrt_Anf := "Taste_B", FS_gesichert := "FS_B", Gleis_frei := "Ausfahrt_frei", Stoerung := "Stoerung_B", Fahrt => "Signal_B", Halt_Melder => "Melder_Rot");') }
  ],
  globals:{ Taste_B:false, FS_B:true, Ausfahrt_frei:true, Stoerung:false, Stoerung_B:false, Signal_B:false, Melder_Rot:false },
  timed: seq([[0,{ Taste_B:true },{ Signal_B:true }],[0.1,{ Taste_B:false, Stoerung_B:true },{ Signal_B:false }]]),
  bind:['signalExit=Signal_B', 'faultActive=Stoerung_B'] });

const VS_MAIN = 'NETWORK Bahnuebergang\n=> "FB_BUE_DB"(Anforderung := "Zug_meldet", Blinklicht => "Blinklicht", Glocke => "Glocke", Schranke_zu => "Schranke_zu");\n\nNETWORK Signal B\n=> "FB_Signal_DB"(Fahrt_Anf := "Taste_B", FS_gesichert := "FB_BUE_DB".Schranke_zu, Gleis_frei := "Ausfahrt_frei", Stoerung := "Stoerung", Fahrt => "Signal_B", Halt_Melder => "Melder_Rot");';
const VS_G = { Zug_meldet:false, Blinklicht:false, Glocke:false, Schranke_zu:false, Taste_B:false, Ausfahrt_frei:true, Stoerung:false, Signal_B:false, Melder_Rot:false };
const VS_T = seq([[0,{ Zug_meldet:true, Taste_B:true },{ Signal_B:false }],[3.1,{},{ Schranke_zu:true, Signal_B:true }],[0.1,{ Taste_B:false },{ Signal_B:true }],[0.1,{ Zug_meldet:false },{ Signal_B:false, Schranke_zu:false }]]);
defFupPro({ id:'fp14_verschaltung', ch:14, title:'Bausteine verschalten',
  story:'Das Ausfahrsignal B darf erst Fahrt zeigen, wenn die Schranke des Bahnübergangs unten ist, und das liest man direkt aus der Instanz seines Bausteins: <code>"FB_BUE_DB".Schranke_zu</code>.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> <code>"FB_BUE_DB"</code>: Zugmeldung → Blinklicht, Glocke, Schranke zu<br><b>NW 2:</b> <code>"FB_Signal_DB"</code>: Taste B, gesichert = Schranken-Ausgang der Instanz <code>"FB_BUE_DB"</code>, Ausfahrt frei, Störung → Signal B, roter Melder',
  learn:'Standardbausteine im OB1 verbinden.',
  take:'Ausgänge eines FB stehen in seiner Instanz: <code>"FB_BUE_DB".Schranke_zu</code>. Die Aufrufreihenfolge bestimmt, ob der Wert aus diesem oder dem letzten Zyklus stammt.',
  man:'standard', must:['CALL','SINGLE'],
  hint:'Erst der Bahnübergang, dann das Signal.',
  blocks:[ { name:'FB_BUE', kind:'FB', src: BUE_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(VS_MAIN) } ],
  globals: VS_G, timed: VS_T,
  bind:['trainApproach=Zug_meldet', 'crossingClosed=Schranke_zu', 'crossingLights=Blinklicht', 'signalExit=Signal_B'] });

const BA_D = { in:'Automatik:Bool; Anf_Hand:Bool|Taste Stelltisch; Anf_Auto:Bool|Zugmeldung', out:'Anforderung:Bool; Melder_Auto:Bool' };
defFupPro({ id:'fp14_betriebsart', ch:14, title:'Hand oder Automatik',
  story:'Tagsüber stellt Frau Gasser die Fahrstrassen von Hand, nachts arbeitet das Stellwerk automatisch. Die Umschaltung merkt sich nichts — also eine <b>FC</b>.',
  brief:'<code>FC_Betriebsart</code>:<br><b>NW 1:</b> im Automatikbetrieb gilt <code>#Anf_Auto</code>, sonst <code>#Anf_Hand</code> → <code>#Anforderung</code><br><b>NW 2:</b> Automatikbetrieb → <code>#Melder_Auto</code>',
  learn:'FC oder FB: Nur wer sich etwas merkt, braucht einen FB.',
  take:'<b>FC</b> für reine Verknüpfungen, <b>FB</b> für alles mit Gedächtnis.',
  man:'standard', must:['FC','PARALLEL','NC'],
  hint:'>=1-Box mit zwei &-Boxen.',
  blocks:[
    { name:'FC_Betriebsart', kind:'FC', edit:true, start: kFC('FC_Betriebsart', 'Void', BA_D, ''), ref: kFC('FC_Betriebsart', 'Void', BA_D, 'NETWORK Anforderung\n(#Automatik AND #Anf_Auto) OR (NOT #Automatik AND #Anf_Hand) => #Anforderung;\n\nNETWORK Melder\n#Automatik => #Melder_Auto;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Betriebsart\n=> "FC_Betriebsart"(Automatik := "Automatik", Anf_Hand := "Taste_FS", Anf_Auto := "Zug_meldet", Anforderung => "FS_Anforderung", Melder_Auto => "Melder_Gelb");') }
  ],
  globals:{ Automatik:false, Taste_FS:false, Zug_meldet:false, FS_Anforderung:false, Melder_Gelb:false },
  unit:[{ block:'FC_Betriebsart', steps: truth(['Automatik','Anf_Hand','Anf_Auto'], e => ({ Anforderung: (e.Automatik && e.Anf_Auto) || (!e.Automatik && e.Anf_Hand), Melder_Auto: e.Automatik })) }],
  tests:[[{ Automatik:true, Zug_meldet:true }, { FS_Anforderung:true, Melder_Gelb:true }], [{ Taste_FS:true }, { FS_Anforderung:true, Melder_Gelb:false }]],
  bind:['lightYellow=Melder_Gelb', 'routeSet=FS_Anforderung'] });

defFupPro({ id:'fp14_inout', ch:14, title:'Zwei Zählpunkte, eine Summe',
  story:'Beide Einfahrten zählen ihre Züge, doch die Tagesstatistik hat nur eine Zahl. Beide Instanzen des Zählbausteins sollen dieselbe Variable über einen <b>InOut</b>-Parameter erhöhen.',
  brief:'<code>FB_Zugzaehler</code> (InOut <code>Summe : Int</code>): P-Box <code>#Zug</code> → INC <code>#Summe</code>. <code>Main</code> (🔒) übergibt beiden Instanzen <code>"DB_Statistik".Zuege</code>.',
  learn:'InOut-Parameter: die Variable des Aufrufers lesen und ändern.',
  take:'Ein <b>InOut</b>-Parameter verweist auf die Variable des Aufrufers — ideal für gemeinsame Zähler.',
  man:'standard', must:['VAR_IN_OUT','EDGE_P','INC'],
  hint:'P-Box und INC-Box.',
  blocks:[
    { name:'DB_Statistik', kind:'DB', src: kDB('DB_Statistik', 'Zuege:Int|beide Einfahrten') },
    { name:'FB_Zugzaehler', kind:'FB', edit:true, start: kFB('FB_Zugzaehler', { in:'Zug:Bool', inout:'Summe:Int' }, ''), ref: kFB('FB_Zugzaehler', { in:'Zug:Bool', inout:'Summe:Int' }, 'NETWORK Zaehlen\nP(#Zug) => INC(#Summe);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Einfahrt West\n=> "West_DB"(Zug := "Zug_West", Summe := "DB_Statistik".Zuege);\n\nNETWORK Einfahrt Ost\n=> "Ost_DB"(Zug := "Zug_Ost", Summe := "DB_Statistik".Zuege);') }
  ],
  globals:{ Zug_West:false, Zug_Ost:false }, instances:{ West_DB:'FB_Zugzaehler', Ost_DB:'FB_Zugzaehler' },
  timed: seq([[0,{ Zug_West:true },{ 'DB_Statistik.Zuege':1 }],[0.1,{ Zug_West:false },{}],[0.1,{ Zug_Ost:true },{ 'DB_Statistik.Zuege':2 }],[0.1,{ Zug_Ost:false },{}],[0.1,{ Zug_West:true, Zug_Ost:true },{ 'DB_Statistik.Zuege':4 }]]),
  bind:['displayValue=DB_Statistik.Zuege', 'displayLabel:"ZÜGE HEUTE"'] });

const MEL_D = { in:'Signal:Bool; Quittieren:Bool; Takt:Bool', out:'Lampe:Bool', stat:'Neu:Bool; Gespeichert:Bool' };
defFupPro({ id:'fp14_meldung', ch:14, title:'Der Meldebaustein',
  story:'Neue Störung = blinkt, quittiert und anstehend = Dauerlicht, gegangen und quittiert = aus. Diese Regel gilt für jede Meldung am Stelltisch.',
  brief:'<code>FB_Meldung</code>:<br><b>NW 1:</b> P-Box <code>#Signal</code> → S <code>#Neu</code>, S <code>#Gespeichert</code><br><b>NW 2:</b> Quittieren → R <code>#Neu</code><br><b>NW 3:</b> nicht <code>#Signal</code> und nicht <code>#Neu</code> → R <code>#Gespeichert</code><br><b>NW 4:</b> (<code>#Neu</code> und <code>#Takt</code>) oder (<code>#Gespeichert</code> und nicht <code>#Neu</code>) → <code>#Lampe</code>',
  learn:'Das Meldeprinzip als Standardbaustein.',
  take:'Blinkt = neu, Dauerlicht = quittiert und anstehend, aus = erledigt. Als Baustein gilt die Regel für jede Meldung gleich.',
  man:'standard', must:['EDGE_P','SET','RESET','PARALLEL'],
  hint:'NW 1 hat zwei S-Ausgänge.',
  blocks:[
    { name:'FB_Meldung', kind:'FB', edit:true, start: kFB('FB_Meldung', MEL_D, ''), ref: kFB('FB_Meldung', MEL_D, 'NETWORK Kommt\nP(#Signal) => S #Neu, S #Gespeichert;\n\nNETWORK Quittieren\n#Quittieren => R #Neu;\n\nNETWORK Geht\nNOT #Signal AND NOT #Neu => R #Gespeichert;\n\nNETWORK Lampe\n(#Neu AND #Takt) OR (#Gespeichert AND NOT #Neu) => #Lampe;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weichenmeldung\n=> "W_Meldung_DB"(Signal := "W1_Stoerung", Quittieren := "Quittieren", Takt := "Takt_1Hz", Lampe => "Lampe_Weiche");\n\nNETWORK Schrankenmeldung\n=> "S_Meldung_DB"(Signal := "BUE_Stoerung", Quittieren := "Quittieren", Takt := "Takt_1Hz", Lampe => "Lampe_BUE");') }
  ],
  globals:{ W1_Stoerung:false, BUE_Stoerung:false, Quittieren:false, Takt_1Hz:false, Lampe_Weiche:false, Lampe_BUE:false }, instances:{ W_Meldung_DB:'FB_Meldung', S_Meldung_DB:'FB_Meldung' },
  unit:[{ block:'FB_Meldung', steps:[[0,{ Signal:true, Takt:true },{ Lampe:true }],[0.1,{ Takt:false },{ Lampe:false }],[0.1,{ Quittieren:true },{ Lampe:true }],[0.1,{ Quittieren:false, Signal:false },{ Lampe:false }],[0.1,{ Signal:true, Takt:true },{ Lampe:true }],[0.1,{ Signal:false, Takt:false },{ Lampe:false }],[0.1,{ Takt:true },{ Lampe:true }],[0.1,{ Quittieren:true },{ Lampe:false }]] }],
  timed: seq([[0,{ W1_Stoerung:true, Takt_1Hz:true },{ Lampe_Weiche:true, Lampe_BUE:false }],[0.5,{ Takt_1Hz:false },{ Lampe_Weiche:false }],[0.1,{ Quittieren:true },{ Lampe_Weiche:true }]]),
  bind:['faultActive=Lampe_Weiche', 'lightRed=Lampe_BUE'] });

defFupPro({ id:'fp14_verschaltung_dbg', ch:14, title:'Der falsche Ausgang', debug:true,
  story:'Signal B zeigt Fahrt, sobald das Blinklicht angeht — die Schranke ist noch oben! ARIA hat beim Verschalten den falschen Ausgang des Bahnübergangs erwischt.',
  brief:'Signal B darf erst Fahrt zeigen, wenn die <b>Schranke</b> unten ist.',
  learn:'Instanzausgänge beim Verschalten prüfen.',
  take:'Blinklicht und Schranke sind beide Bool — nur einer ist die Freigabe.',
  man:'standard', must:['CALL'],
  hint:'Aufruf des Signals antippen, Parameter FS_gesichert prüfen.',
  blocks:[ { name:'FB_BUE', kind:'FB', src: BUE_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(VS_MAIN.replace('"FB_BUE_DB".Schranke_zu', '"FB_BUE_DB".Blinklicht')), ref: MAIN(VS_MAIN) } ],
  globals: VS_G, timed: VS_T,
  bind:['trainApproach=Zug_meldet', 'crossingClosed=Schranke_zu', 'signalExit=Signal_B'] });

const EIN_D = { in:'Zug_meldet:Bool; Taste_A:Bool; Gleis_frei:Bool; Stoerung:Bool', out:'Blinklicht:Bool; Schranke_zu:Bool; Signal_A:Bool', stat:'BUE:"FB_BUE"; Sig:"FB_Signal"' };
const EIN_NW = 'NETWORK Bahnuebergang\n=> #BUE(Anforderung := #Zug_meldet, Blinklicht => #Blinklicht, Schranke_zu => #Schranke_zu);\n\nNETWORK Signal A\n=> #Sig(Fahrt_Anf := #Taste_A, FS_gesichert := #BUE.Schranke_zu, Gleis_frei := #Gleis_frei, Stoerung := #Stoerung, Fahrt => #Signal_A);';
defFupPro({ id:'fp14_boss', ch:14, title:'Boss: Die Einfahrt aus Standardbausteinen', boss:true,
  story:'ARIA hat sich in die Einfahrt zurückgezogen. Frau Gasser legt deine Standardbausteine auf den Tisch: „Bahnübergang und Signal — als Multiinstanzen in <code>FB_Einfahrt</code>, sauber verschaltet.“',
  brief:'<code>FB_Einfahrt</code> (Static <code>#BUE</code>, <code>#Sig</code>):<br><b>NW 1:</b> <code>#BUE</code> mit der Zugmeldung; Blinklicht und Schranke auf die Ausgänge<br><b>NW 2:</b> <code>#Sig</code>: Taste A, gesichert = Schranken-Ausgang von <code>#BUE</code>, Gleis frei, Störung → Signal A',
  learn:'Eine Anlage aus Standardbausteinen als Multiinstanzen.',
  take:'Geprüfte Standardbausteine werden in einem Anlagen-FB verschaltet. Jeder bleibt einfach, das Zusammenspiel steht in wenigen Netzwerken.',
  man:'standard', must:['MULTI','CALL'],
  hint:'Die Instanzen stehen links unter „Aufruf“ (#BUE, #Sig). Ausgänge einer Multiinstanz: #BUE.Schranke_zu.',
  blocks:[ { name:'FB_BUE', kind:'FB', src: BUE_FB }, { name:'FB_Signal', kind:'FB', src: SIG_FB },
    { name:'FB_Einfahrt', kind:'FB', edit:true, start: kFB('FB_Einfahrt', EIN_D, ''), ref: kFB('FB_Einfahrt', EIN_D, EIN_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Einfahrt\n=> "FB_Einfahrt_DB"(Zug_meldet := "Zug_meldet", Taste_A := "Taste_A", Gleis_frei := "Gleis1_frei", Stoerung := "Stoerung", Blinklicht => "Blinklicht", Schranke_zu => "Schranke_zu", Signal_A => "Signal_A");') } ],
  globals:{ Zug_meldet:false, Taste_A:false, Gleis1_frei:true, Stoerung:false, Blinklicht:false, Schranke_zu:false, Signal_A:false },
  timed: seq([[0,{ Zug_meldet:true, Taste_A:true },{ Blinklicht:true, Signal_A:false }],[3.1,{},{ Schranke_zu:true, Signal_A:true }],[0.1,{ Taste_A:false },{ Signal_A:true }],[0.1,{ Stoerung:true },{ Signal_A:false }],[0.1,{ Stoerung:false, Zug_meldet:false },{ Schranke_zu:false, Signal_A:false }]]),
  bind:['trainApproach=Zug_meldet', 'crossingLights=Blinklicht', 'crossingClosed=Schranke_zu', 'signalEntry=Signal_A'] });
})();
