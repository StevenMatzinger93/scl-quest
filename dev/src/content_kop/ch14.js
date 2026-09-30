/* ===== KOP QUEST · KAPITEL 14 — Standardbausteine: Tür, Sicherheitskette, Antrieb, Meldung (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const seq = steps => [{ steps }];

const TUER_D = { in:'Oeffnen:Bool|Befehl Tür öffnen; Endlage_Zu:Bool|Rückmeldung Tür zu; Freigabe:Bool|Kabine steht; Quittieren:Bool', out:'Tuer_Auf:Bool|Ausgang Türantrieb; Stoerung:Bool|Tür schliesst nicht', stat:'T_Ueber:TON|Überwachungszeit Schliessen' };
const TUER_NW = 'NETWORK Oeffnen\n#Oeffnen AND #Freigabe => #Tuer_Auf;\n\nNETWORK Schliessen ueberwachen\nNOT #Tuer_Auf AND NOT #Endlage_Zu AND TON(#T_Ueber, T#4S) => S #Stoerung;\n\nNETWORK Quittieren\n#Quittieren AND #Endlage_Zu => R #Stoerung;';
const TUER_FB = kFB('FB_Tuer', TUER_D, TUER_NW);
const KETTE_D = { in:'Tuer_Zu:Bool; Seil_OK:Bool; Not_Halt_OK:Bool; Wind_OK:Bool; Quittieren:Bool', out:'OK:Bool|Kette geschlossen und quittiert; Fehler:Bool|Kette war offen' };
const KETTE_NW = 'NETWORK Kette\n#Tuer_Zu AND #Seil_OK AND #Not_Halt_OK AND #Wind_OK AND NOT #Fehler => #OK;\n\nNETWORK Unterbrechung speichern\nNOT #Tuer_Zu OR NOT #Seil_OK OR NOT #Not_Halt_OK OR NOT #Wind_OK => S #Fehler;\n\nNETWORK Quittieren\n#Quittieren AND #Tuer_Zu AND #Seil_OK AND #Not_Halt_OK AND #Wind_OK => R #Fehler;';
const KETTE_FB = kFB('FB_Kette', KETTE_D, KETTE_NW);
const ANTR_D = { in:'Start:Bool; Stopp:Bool; Freigabe:Bool', out:'Laeuft:Bool; Bremse_Auf:Bool|Bremse gelüftet', stat:'T_Bremse:TOF|Bremse nachlaufen' };
const ANTR_NW = 'NETWORK Selbsthaltung\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe => #Laeuft;\n\nNETWORK Bremse\n#Laeuft AND TOF(#T_Bremse, T#1S) => #Bremse_Auf;';
const ANTR_FB = kFB('FB_Antrieb', ANTR_D, ANTR_NW);
const G_CHAIN = { Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_OK:true, Quittieren:false };

defKopPro({ id:'k14_tuer', ch:14, title:'Der Standard-Türbaustein',
  story:'Jede Station, jede Kabine: überall Türen. Der Werkmeister will <b>einen</b> Türbaustein für alle — mit Freigabe (nur bei stehender Kabine) und einer Überwachung: Meldet die Tür nach 4 Sekunden nicht „zu“, ist sie gestört.',
  brief:'<code>FB_Tuer</code> (Schnittstelle steht):<br><b>NW 1:</b> <code>#Oeffnen</code> und <code>#Freigabe</code> → <code>#Tuer_Auf</code><br><b>NW 2:</b> nicht <code>#Tuer_Auf</code> und nicht <code>#Endlage_Zu</code> → TON <code>#T_Ueber</code> 4 s → S <code>#Stoerung</code><br><b>NW 3:</b> <code>#Quittieren</code> und <code>#Endlage_Zu</code> → R <code>#Stoerung</code>',
  learn:'Einen wiederverwendbaren Standardbaustein mit Überwachung bauen.',
  take:'Ein <b>Standardbaustein</b> kapselt ein Gerät vollständig: Befehl, Freigabe, Rückmeldung, Überwachung, Störung. Er kennt nur seine Schnittstelle und passt deshalb an jede Tür.',
  man:'standard', must:['TON','SET','RESET'],
  hint:'Drei Netzwerke. NW 2 braucht zwei Öffner vor dem Timer.',
  blocks:[
    { name:'FB_Tuer', kind:'FB', edit:true, start: kFB('FB_Tuer', TUER_D, ''), ref: TUER_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Tuer Bergstation\n=> "FB_Tuer_DB"(Oeffnen := "S_Tuer", Endlage_Zu := "Tuer_Zu", Freigabe := "Kabine_da", Quittieren := "Quittieren", Tuer_Auf => "Tuer_Auf", Stoerung => "Stoerung");') }
  ],
  globals:{ S_Tuer:false, Tuer_Zu:true, Kabine_da:true, Quittieren:false, Tuer_Auf:false, Stoerung:false },
  unit:[{ block:'FB_Tuer', steps:[[0,{ Oeffnen:true, Freigabe:true, Endlage_Zu:false },{ Tuer_Auf:true, Stoerung:false }],[3,{ Oeffnen:false },{ Tuer_Auf:false, Stoerung:false }],[2,{},{ Stoerung:false }],[2.1,{},{ Stoerung:true }],
    [0.1,{ Quittieren:true },{ Stoerung:true }],[0.1,{ Endlage_Zu:true },{ Stoerung:false }],[0.1,{ Quittieren:false, Oeffnen:true, Freigabe:false },{ Tuer_Auf:false }]] }],
  timed: seq([[0,{ S_Tuer:true },{ Tuer_Auf:true }],[0.1,{ S_Tuer:false },{ Tuer_Auf:false, Stoerung:false }],[0.1,{ Kabine_da:false, S_Tuer:true },{ Tuer_Auf:false }]]),
  bind:['doorOpen=Tuer_Auf', 'cabinInStation=Kabine_da', 'faultActive=Stoerung'] });

defKopPro({ id:'k14_kette', ch:14, title:'Die Kette als Baustein',
  story:'Die Sicherheitskette gibt es in jeder Station. Als Standardbaustein prüft sie alle Glieder, <b>speichert</b> jede Unterbrechung und gibt erst nach dem Quittieren wieder frei.',
  brief:'<code>FB_Kette</code>:<br><b>NW 1:</b> alle vier Glieder und nicht <code>#Fehler</code> → <code>#OK</code><br><b>NW 2:</b> irgendein Glied offen (vier Öffner parallel) → S <code>#Fehler</code><br><b>NW 3:</b> <code>#Quittieren</code> und alle vier Glieder → R <code>#Fehler</code>',
  learn:'Sicherheitskette mit Störungsspeicher als Standardbaustein.',
  take:'Die Kette als Baustein: Ein Ausgang <code>OK</code> für die Freigabe, ein Ausgang <code>Fehler</code> für die Meldung. Wer die Kette verwenden will, muss nichts über ihr Innenleben wissen.',
  man:'standard', must:['SET','RESET','PARALLEL','NC'],
  hint:'NW 2: Öffner #Tuer_Zu, dann Parallelzweig für jedes weitere Glied.',
  blocks:[
    { name:'FB_Kette', kind:'FB', edit:true, start: kFB('FB_Kette', KETTE_D, ''), ref: KETTE_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Sicherheitskette\n=> "FB_Kette_DB"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Wind_OK := "Wind_OK", Quittieren := "Quittieren", OK => "Kette_OK", Fehler => "Stoerung");') }
  ],
  globals: Object.assign({ Kette_OK:false, Stoerung:false }, G_CHAIN),
  unit:[{ block:'FB_Kette', steps:[[0,{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_OK:true },{ OK:true, Fehler:false }],[0.1,{ Seil_OK:false },{ OK:false, Fehler:true }],[0.1,{ Seil_OK:true },{ OK:false, Fehler:true }],
    [0.1,{ Quittieren:true },{ Fehler:false }],[0.1,{ Quittieren:false },{ OK:true }],[0.1,{ Wind_OK:false, Quittieren:true },{ OK:false, Fehler:true }],[0.1,{ Wind_OK:true },{ Fehler:false }]] }],
  timed: seq([[0,{},{ Kette_OK:true }],[0.1,{ Not_Halt_OK:false },{ Kette_OK:false, Stoerung:true }],[0.1,{ Not_Halt_OK:true },{ Kette_OK:false }],[0.1,{ Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false },{ Kette_OK:true }]]),
  bind:['chainDoor=Tuer_Zu', 'chainRope=Seil_OK', 'chainStop=Not_Halt_OK', 'chainWind=Wind_OK', 'lightGreen=Kette_OK', 'faultActive=Stoerung'] });

defKopPro({ id:'k14_antrieb', ch:14, title:'Antrieb mit Bremse',
  story:'Der Standard-Antrieb bekommt die Bremse dazu: Sie lüftet mit dem Anlauf und fällt erst <b>1 Sekunde</b> nach dem Stopp ein, damit das Seil sanft ausläuft.',
  brief:'<code>FB_Antrieb</code> (Static <code>T_Bremse : TOF</code>):<br><b>NW 1:</b> (<code>#Start</code> oder <code>#Laeuft</code>) und nicht <code>#Stopp</code> und <code>#Freigabe</code> → <code>#Laeuft</code><br><b>NW 2:</b> <code>#Laeuft</code> → TOF <code>#T_Bremse</code> 1 s → <code>#Bremse_Auf</code>',
  learn:'Ausschaltverzögerung als Multiinstanz im Standardbaustein.',
  take:'Auch eine Ausschaltverzögerung (TOF) lebt als Multiinstanz im FB. Der Baustein liefert damit zwei abgestimmte Ausgänge: Motor und Bremse.',
  man:'standard', must:['TOF','PARALLEL'],
  hint:'NW 2: Kontakt #Laeuft, dahinter Timer, Typ auf TOF umstellen.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: kFB('FB_Antrieb', ANTR_D, ''), ref: ANTR_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Laeuft => "Antrieb", Bremse_Auf => "Bremse_Auf");') }
  ],
  globals:{ S_Start:false, S_Stopp:false, Kette_OK:true, Antrieb:false, Bremse_Auf:false },
  unit:[{ block:'FB_Antrieb', steps:[[0,{ Start:true, Freigabe:true },{ Laeuft:true, Bremse_Auf:true }],[0.1,{ Start:false },{ Laeuft:true }],[0.1,{ Stopp:true },{ Laeuft:false, Bremse_Auf:true }],[0.5,{ Stopp:false },{ Bremse_Auf:true }],[0.6,{},{ Bremse_Auf:false }]] }],
  timed: seq([[0,{ S_Start:true },{ Antrieb:true, Bremse_Auf:true }],[0.1,{ S_Start:false, S_Stopp:true },{ Antrieb:false, Bremse_Auf:true }],[1.2,{ S_Stopp:false },{ Bremse_Auf:false }]]),
  bind:['motorOn=Antrieb', 'brake=Bremse_Auf'] });

defKopPro({ id:'k14_global_dbg', ch:14, title:'Der heimliche Draht', debug:true, warnFree:['GLOBAL_ACCESS'],
  story:'In der Talstation läuft der Antrieb trotz offener Kette, denn <code>FB_Antrieb</code> liest heimlich die globale Variable <code>"Kette_OK"</code> der Bergstation statt seines Eingangs <code>#Freigabe</code>. Der Compiler warnt.',
  brief:'<code>FB_Antrieb</code> darf nur über seine Schnittstelle arbeiten: Ersetze den globalen Zugriff durch <code>#Freigabe</code>.',
  learn:'Standardbausteine ohne globale Zugriffe.',
  take:'Ein Baustein, der direkt globale Variablen liest, funktioniert nur in <b>einer</b> Anlage. Alles, was er braucht, gehört in seine Schnittstelle — die Warnung <b>GLOBAL_ACCESS</b> zeigt solche Stellen.',
  man:'standard', must:['PARALLEL'],
  hint:'Den Kontakt "Kette_OK" antippen und die Variable #Freigabe zuweisen.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: kFB('FB_Antrieb', ANTR_D, ANTR_NW.replace('AND #Freigabe =>', 'AND "Kette_OK" =>')), ref: ANTR_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Antrieb Talstation\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_Tal_OK", Laeuft => "Antrieb", Bremse_Auf => "Bremse_Auf");') }
  ],
  globals:{ S_Start:false, S_Stopp:false, Kette_OK:true, Kette_Tal_OK:true, Antrieb:false, Bremse_Auf:false },
  timed: seq([[0,{ S_Start:true },{ Antrieb:true }],[0.1,{ S_Start:false, Kette_Tal_OK:false },{ Antrieb:false }],[0.1,{ S_Start:true },{ Antrieb:false }]]),
  bind:['motorOn=Antrieb', 'brake=Bremse_Auf', 'lightGreen=Kette_Tal_OK'] });

const VS_MAIN = 'NETWORK Sicherheitskette\n=> "FB_Kette_DB"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Wind_OK := "Wind_OK", Quittieren := "Quittieren", OK => "Kette_OK", Fehler => "Stoerung");\n\nNETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "FB_Kette_DB".OK, Laeuft => "Antrieb", Bremse_Auf => "Bremse_Auf");';
const VS_G = Object.assign({ S_Start:false, S_Stopp:false, Kette_OK:false, Stoerung:false, Antrieb:false, Bremse_Auf:false }, G_CHAIN);
const VS_T = seq([[0,{ S_Start:true },{ Antrieb:true, Kette_OK:true }],[0.1,{ S_Start:false },{ Antrieb:true }],[0.1,{ Seil_OK:false },{ Antrieb:false, Stoerung:true }],[0.1,{ Seil_OK:true, S_Start:true },{ Antrieb:false }],
  [0.1,{ S_Start:false, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false },{ Kette_OK:true }],[0.1,{ S_Start:true },{ Antrieb:true }]]);
defKopPro({ id:'k14_verschaltung', ch:14, title:'Bausteine verschalten',
  story:'Im OB1 werden Kette und Antrieb verbunden: Der Ausgang <code>"FB_Kette_DB".OK</code> der Kette ist direkt die Freigabe des Antriebs.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> Aufruf <code>"FB_Kette_DB"</code> mit <code>"Tuer_Zu"</code>, <code>"Seil_OK"</code>, <code>"Not_Halt_OK"</code>, <code>"Wind_OK"</code>, <code>"Quittieren"</code> → OK => <code>"Kette_OK"</code>, Fehler => <code>"Stoerung"</code><br><b>NW 2:</b> Aufruf <code>"FB_Antrieb_DB"</code>: Start := <code>"S_Start"</code>, Stopp := <code>"S_Stopp"</code>, Freigabe := <code>"FB_Kette_DB".OK</code>, Laeuft => <code>"Antrieb"</code>, Bremse_Auf => <code>"Bremse_Auf"</code>',
  learn:'Standardbausteine im OB1 miteinander verbinden.',
  take:'Die Ausgänge eines FB stehen in seiner Instanz und können von überall gelesen werden: <code>"FB_Kette_DB".OK</code>. Die Reihenfolge der Aufrufe bestimmt, ob der Wert aus diesem oder dem letzten Zyklus stammt.',
  man:'standard', must:['CALL','SINGLE'],
  hint:'Erst die Kette aufrufen, dann den Antrieb — sonst reagiert er einen Zyklus zu spät.',
  blocks:[
    { name:'FB_Kette', kind:'FB', src: KETTE_FB },
    { name:'FB_Antrieb', kind:'FB', src: ANTR_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(VS_MAIN) }
  ],
  globals: VS_G, timed: VS_T,
  bind:['chainDoor=Tuer_Zu', 'chainRope=Seil_OK', 'chainStop=Not_Halt_OK', 'chainWind=Wind_OK', 'motorOn=Antrieb', 'brake=Bremse_Auf', 'faultActive=Stoerung'] });

const BA_D = { in:'Auto:Bool|1 = Automatik; Fahrt_Auto:Bool|Fahrbefehl Schrittkette; Tippen:Bool|Tipptaster Hand; Freigabe:Bool', out:'Antrieb_Ein:Bool; Lampe_Auto:Bool; Lampe_Hand:Bool' };
defKopPro({ id:'k14_betriebsart', ch:14, title:'Der Betriebsarten-Baustein',
  story:'Hand oder Automatik — die Umschaltung gibt es in jeder Station. Sie braucht kein Gedächtnis, also reicht eine <b>FC</b>.',
  brief:'<code>FC_Betriebsart</code>:<br><b>NW 1:</b> ((<code>#Auto</code> und <code>#Fahrt_Auto</code>) oder (nicht <code>#Auto</code> und <code>#Tippen</code>)) und <code>#Freigabe</code> → <code>#Antrieb_Ein</code><br><b>NW 2:</b> <code>#Auto</code> → <code>#Lampe_Auto</code><br><b>NW 3:</b> nicht <code>#Auto</code> → <code>#Lampe_Hand</code>',
  learn:'FC oder FB? Nur wer sich etwas merken muss, braucht einen FB.',
  take:'<b>FC</b> für reine Verknüpfungen und Berechnungen, <b>FB</b> für alles mit Gedächtnis (Speicher, Flanken, Zeiten, Zähler). Eine FC braucht keinen Instanz-DB.',
  man:'standard', must:['FC','PARALLEL','NC'],
  hint:'Wie k10_betriebsart aus Kapitel 10 — nur im Baustein mit #.',
  blocks:[
    { name:'FC_Betriebsart', kind:'FC', edit:true, start: kFC('FC_Betriebsart', 'Void', BA_D, ''), ref: kFC('FC_Betriebsart', 'Void', BA_D, 'NETWORK Antrieb\n((#Auto AND #Fahrt_Auto) OR (NOT #Auto AND #Tippen)) AND #Freigabe => #Antrieb_Ein;\n\nNETWORK Anzeige Automatik\n#Auto => #Lampe_Auto;\n\nNETWORK Anzeige Hand\nNOT #Auto => #Lampe_Hand;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Betriebsart\n=> "FC_Betriebsart"(Auto := "Auto", Fahrt_Auto := "Schritt_Fahrt", Tippen := "S_Tippen", Freigabe := "Kette_OK", Antrieb_Ein => "Antrieb", Lampe_Auto => "Ampel_Gruen", Lampe_Hand => "Ampel_Gelb");') }
  ],
  globals:{ Auto:false, Schritt_Fahrt:false, S_Tippen:false, Kette_OK:false, Antrieb:false, Ampel_Gruen:false, Ampel_Gelb:false },
  unit:[{ block:'FC_Betriebsart', steps: truth(['Auto','Fahrt_Auto','Tippen','Freigabe'], e => ({ Antrieb_Ein: ((e.Auto && e.Fahrt_Auto) || (!e.Auto && e.Tippen)) && e.Freigabe, Lampe_Auto: e.Auto, Lampe_Hand: !e.Auto })) }],
  tests:[[{ Auto:true, Schritt_Fahrt:true, Kette_OK:true }, { Antrieb:true, Ampel_Gruen:true }], [{ S_Tippen:true, Kette_OK:true }, { Antrieb:true, Ampel_Gelb:true }]],
  bind:['motorOn=Antrieb', 'lightGreen=Ampel_Gruen', 'lightYellow=Ampel_Gelb'] });

defKopPro({ id:'k14_inout', ch:14, title:'Zwei Drehkreuze, eine Summe',
  story:'Die Station hat zwei Drehkreuze, die Tagesstatistik aber nur eine Zahl, die beide Instanzen des Zählbausteins hochzählen sollen. Dafür gibt es den Parameterbereich <b>InOut</b>.',
  brief:'<code>FB_Drehkreuz</code> hat den InOut-Parameter <code>Gaeste_Tag : Int</code>. Zeichne: P-Flanke <code>#Drehkreuz</code> → <b>INC</b> <code>#Gaeste_Tag</code>. <code>Main</code> (🔒) übergibt beiden Instanzen <code>"DB_Statistik".Gaeste_Tag</code>.',
  learn:'InOut-Parameter: den Wert des Aufrufers lesen und ändern.',
  take:'Ein <b>InOut</b>-Parameter wird nicht kopiert, sondern verweist auf die Variable des Aufrufers. Der Baustein liest sie und schreibt sie zurück — ideal für gemeinsame Zähler.',
  man:'standard', must:['VAR_IN_OUT','EDGE_P','INC'],
  hint:'P-Flanke und INC-Box, wie in Kapitel 12.',
  blocks:[
    { name:'DB_Statistik', kind:'DB', src: kDB('DB_Statistik', 'Gaeste_Tag:Int|alle Drehkreuze') },
    { name:'FB_Drehkreuz', kind:'FB', edit:true, start: kFB('FB_Drehkreuz', { in:'Drehkreuz:Bool', inout:'Gaeste_Tag:Int' }, ''), ref: kFB('FB_Drehkreuz', { in:'Drehkreuz:Bool', inout:'Gaeste_Tag:Int' }, 'NETWORK Zaehlen\nP(#Drehkreuz) => INC(#Gaeste_Tag);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Drehkreuz 1\n=> "Drehkreuz_1_DB"(Drehkreuz := "Drehkreuz_1", Gaeste_Tag := "DB_Statistik".Gaeste_Tag);\n\nNETWORK Drehkreuz 2\n=> "Drehkreuz_2_DB"(Drehkreuz := "Drehkreuz_2", Gaeste_Tag := "DB_Statistik".Gaeste_Tag);') }
  ],
  globals:{ Drehkreuz_1:false, Drehkreuz_2:false }, instances:{ Drehkreuz_1_DB:'FB_Drehkreuz', Drehkreuz_2_DB:'FB_Drehkreuz' },
  timed: seq([[0,{ Drehkreuz_1:true },{ 'DB_Statistik.Gaeste_Tag':1 }],[0.1,{ Drehkreuz_1:false },{ 'DB_Statistik.Gaeste_Tag':1 }],[0.1,{ Drehkreuz_2:true },{ 'DB_Statistik.Gaeste_Tag':2 }],[0.1,{ Drehkreuz_2:false },{}],[0.1,{ Drehkreuz_1:true, Drehkreuz_2:true },{ 'DB_Statistik.Gaeste_Tag':4 }],[0.1,{},{ 'DB_Statistik.Gaeste_Tag':4 }]]),
  bind:['passengers=DB_Statistik.Gaeste_Tag', 'gateOpen=Drehkreuz_1'] });

const MEL_D = { in:'Signal:Bool|Störsignal; Quittieren:Bool; Takt:Bool|Blinktakt', out:'Lampe:Bool|Meldelampe', stat:'Neu:Bool|noch nicht quittiert; Gespeichert:Bool|Störung gespeichert' };
const MEL_NW = 'NETWORK Kommt\nP(#Signal) => S #Neu, S #Gespeichert;\n\nNETWORK Quittieren\n#Quittieren => R #Neu;\n\nNETWORK Geht\nNOT #Signal AND NOT #Neu => R #Gespeichert;\n\nNETWORK Lampe\n(#Neu AND #Takt) OR (#Gespeichert AND NOT #Neu) => #Lampe;';
defKopPro({ id:'k14_meldung', ch:14, title:'Der Meldebaustein',
  story:'In jedem Leitstand gilt dieselbe Regel: Eine <b>neue</b> Störung blinkt, eine <b>quittierte</b>, noch anstehende leuchtet dauernd, eine erledigte erlischt. Diese Logik baust du einmal — für alle Meldungen.',
  brief:'<code>FB_Meldung</code> (Static <code>Neu</code>, <code>Gespeichert</code>):<br><b>NW 1:</b> P-Flanke <code>#Signal</code> → S <code>#Neu</code>, S <code>#Gespeichert</code><br><b>NW 2:</b> <code>#Quittieren</code> → R <code>#Neu</code><br><b>NW 3:</b> nicht <code>#Signal</code> und nicht <code>#Neu</code> → R <code>#Gespeichert</code><br><b>NW 4:</b> (<code>#Neu</code> und <code>#Takt</code>) oder (<code>#Gespeichert</code> und nicht <code>#Neu</code>) → <code>#Lampe</code>',
  learn:'Das Meldeprinzip neu/quittiert/gegangen als Standardbaustein.',
  take:'Neu = blinkt, quittiert und ansteht = Dauerlicht, gegangen und quittiert = aus. Dieses Prinzip steckt in fast jeder Leitwarte — als Baustein gebaut, gilt es für jede Meldung gleich.',
  man:'standard', must:['EDGE_P','SET','RESET','PARALLEL'],
  hint:'NW 1 hat zwei S-Spulen („weitere Spule“).',
  blocks:[
    { name:'FB_Meldung', kind:'FB', edit:true, start: kFB('FB_Meldung', MEL_D, ''), ref: kFB('FB_Meldung', MEL_D, MEL_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Meldung Seil\n=> "Seil_Meldung_DB"(Signal := "Seil_Fehler", Quittieren := "Quittieren", Takt := "Takt_1Hz", Lampe => "Lampe_Seil");\n\nNETWORK Meldung Wind\n=> "Wind_Meldung_DB"(Signal := "Wind_Fehler", Quittieren := "Quittieren", Takt := "Takt_1Hz", Lampe => "Lampe_Wind");') }
  ],
  globals:{ Seil_Fehler:false, Wind_Fehler:false, Quittieren:false, Takt_1Hz:false, Lampe_Seil:false, Lampe_Wind:false }, instances:{ Seil_Meldung_DB:'FB_Meldung', Wind_Meldung_DB:'FB_Meldung' },
  unit:[{ block:'FB_Meldung', steps:[[0,{ Signal:true, Takt:true },{ Lampe:true }],[0.1,{ Takt:false },{ Lampe:false }],[0.1,{ Quittieren:true },{ Lampe:true }],[0.1,{ Quittieren:false, Takt:true },{ Lampe:true }],[0.1,{ Signal:false },{ Lampe:false }],
    [0.1,{ Signal:true, Takt:false },{ Lampe:false }],[0.1,{ Signal:false, Takt:true },{ Lampe:true }],[0.1,{ Quittieren:true },{ Lampe:false }]] }],
  timed: seq([[0,{ Seil_Fehler:true, Takt_1Hz:true },{ Lampe_Seil:true, Lampe_Wind:false }],[0.5,{ Takt_1Hz:false },{ Lampe_Seil:false }],[0.1,{ Quittieren:true },{ Lampe_Seil:true }],[0.1,{ Quittieren:false, Seil_Fehler:false },{ Lampe_Seil:false }]]),
  bind:['faultActive=Lampe_Seil', 'windWarn=Lampe_Wind'] });

defKopPro({ id:'k14_verschaltung_dbg', ch:14, title:'Der falsche Ausgang', debug:true,
  story:'Die Bahn fährt nur, wenn die Kette gestört ist — und steht, wenn alles in Ordnung ist. ARIA hat beim Verschalten den falschen Ausgang der Kette erwischt.',
  brief:'Der Antrieb soll über den Ausgang <b>OK</b> der Kette freigegeben werden.',
  learn:'Instanzausgänge beim Verschalten prüfen.',
  take:'Beim Verschalten zählt jeder Name: <code>"FB_Kette_DB".OK</code> und <code>"FB_Kette_DB".Fehler</code> sind beide Bool — nur einer ist die Freigabe.',
  man:'standard', must:['CALL'],
  hint:'Aufruf des Antriebs antippen und den Parameter Freigabe prüfen.',
  blocks:[
    { name:'FB_Kette', kind:'FB', src: KETTE_FB },
    { name:'FB_Antrieb', kind:'FB', src: ANTR_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(VS_MAIN.replace('"FB_Kette_DB".OK', '"FB_Kette_DB".Fehler')), ref: MAIN(VS_MAIN) }
  ],
  globals: VS_G, timed: VS_T,
  bind:['chainDoor=Tuer_Zu', 'chainRope=Seil_OK', 'chainStop=Not_Halt_OK', 'chainWind=Wind_OK', 'motorOn=Antrieb', 'brake=Bremse_Auf', 'faultActive=Stoerung'] });

const STN_D = { in:'Tuer_Zu:Bool; Seil_OK:Bool; Not_Halt_OK:Bool; Wind_OK:Bool; Quittieren:Bool; S_Start:Bool; S_Stopp:Bool; S_Tuer:Bool', out:'Antrieb:Bool; Bremse_Auf:Bool; Tuer_Auf:Bool; Stoerung:Bool',
  stat:'Kette:"FB_Kette"; Fahrt:"FB_Antrieb"; Tuer:"FB_Tuer"', temp:'Stillstand:Bool|Antrieb stand im letzten Zyklus; Tuer_OK:Bool|Kettenglied Tür; Fahrt_frei:Bool' };
const STN_NW = 'NETWORK Stillstand\nNOT #Antrieb => #Stillstand;\n\nNETWORK Tuerglied\n#Tuer_Zu OR #Stillstand => #Tuer_OK;\n\nNETWORK Sicherheitskette\n=> #Kette(Tuer_Zu := #Tuer_OK, Seil_OK := #Seil_OK, Not_Halt_OK := #Not_Halt_OK, Wind_OK := #Wind_OK, Quittieren := #Quittieren);\n\nNETWORK Fahrfreigabe\n#Kette.OK AND #Tuer_Zu => #Fahrt_frei;\n\nNETWORK Antrieb\n=> #Fahrt(Start := #S_Start, Stopp := #S_Stopp, Freigabe := #Fahrt_frei, Laeuft => #Antrieb, Bremse_Auf => #Bremse_Auf);\n\nNETWORK Tuer\n=> #Tuer(Oeffnen := #S_Tuer, Endlage_Zu := #Tuer_Zu, Freigabe := #Stillstand, Quittieren := #Quittieren, Tuer_Auf => #Tuer_Auf);\n\nNETWORK Sammelstoerung\n#Kette.Fehler OR #Tuer.Stoerung => #Stoerung;';
defKopPro({ id:'k14_boss', ch:14, title:'Boss: Die Station aus Standardbausteinen', boss:true,
  story:'ARIA hält die Bergstation als letzte Bastion. Der Werkmeister legt deine Standardbausteine auf den Tisch: „Kette, Antrieb, Tür, bau daraus <code>FB_Station</code> mit sauber verschalteten Multiinstanzen.“',
  brief:'<code>FB_Station</code> (Static <code>Kette</code>, <code>Fahrt</code>, <code>Tuer</code>; Temp <code>Stillstand</code>, <code>Tuer_OK</code>, <code>Fahrt_frei</code>):<br>' +
    '<b>NW 1:</b> nicht <code>#Antrieb</code> → <code>#Stillstand</code> · <b>NW 2:</b> <code>#Tuer_Zu</code> oder <code>#Stillstand</code> → <code>#Tuer_OK</code><br>' +
    '<b>NW 3:</b> <code>#Kette</code>(Tuer_Zu := <code>#Tuer_OK</code>, Seil_OK, Not_Halt_OK, Wind_OK, Quittieren := die gleichnamigen Inputs)<br>' +
    '<b>NW 4:</b> <code>#Kette.OK</code> und <code>#Tuer_Zu</code> → <code>#Fahrt_frei</code><br>' +
    '<b>NW 5:</b> <code>#Fahrt</code>(Start := <code>#S_Start</code>, Stopp := <code>#S_Stopp</code>, Freigabe := <code>#Fahrt_frei</code>, Laeuft => <code>#Antrieb</code>, Bremse_Auf => <code>#Bremse_Auf</code>)<br>' +
    '<b>NW 6:</b> <code>#Tuer</code>(Oeffnen := <code>#S_Tuer</code>, Endlage_Zu := <code>#Tuer_Zu</code>, Freigabe := <code>#Stillstand</code>, Quittieren := <code>#Quittieren</code>, Tuer_Auf => <code>#Tuer_Auf</code>)<br>' +
    '<b>NW 7:</b> <code>#Kette.Fehler</code> oder <code>#Tuer.Stoerung</code> → <code>#Stoerung</code>',
  learn:'Eine Anlage aus Standardbausteinen als Multiinstanzen zusammensetzen.',
  take:'So entstehen grosse Programme: Geprüfte Standardbausteine werden in einem Anlagen-FB als Multiinstanzen verschaltet. Jeder Baustein bleibt einfach, das Zusammenspiel steht in wenigen, gut lesbaren Netzwerken.',
  man:'standard', must:['MULTI','CALL','TEMP'],
  hint:'Die Instanzen stehen links unter „Aufruf“ (#Kette, #Fahrt, #Tuer). Ausgänge einer Multiinstanz liest du als #Kette.OK.',
  hint2:'Reihenfolge ist wichtig: Stillstand und Türglied zuerst, dann Kette, Freigabe, Antrieb, Tür, Sammelstörung.',
  blocks:[
    { name:'FB_Kette', kind:'FB', src: KETTE_FB },
    { name:'FB_Antrieb', kind:'FB', src: ANTR_FB },
    { name:'FB_Tuer', kind:'FB', src: TUER_FB },
    { name:'FB_Station', kind:'FB', edit:true, start: kFB('FB_Station', STN_D, ''), ref: kFB('FB_Station', STN_D, STN_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bergstation\n=> "FB_Station_DB"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Wind_OK := "Wind_OK", Quittieren := "Quittieren", S_Start := "S_Start", S_Stopp := "S_Stopp", S_Tuer := "S_Tuer", Antrieb => "Antrieb", Bremse_Auf => "Bremse_Auf", Tuer_Auf => "Tuer_Auf", Stoerung => "Stoerung");') }
  ],
  globals: Object.assign({ S_Start:false, S_Stopp:false, S_Tuer:false, Antrieb:false, Bremse_Auf:false, Tuer_Auf:false, Stoerung:false }, G_CHAIN),
  timed: seq([[0,{ S_Start:true },{ Antrieb:true, Stoerung:false }],[0.1,{ S_Start:false, S_Tuer:true },{ Antrieb:true, Tuer_Auf:false }],[0.1,{ S_Tuer:false, S_Stopp:true },{ Antrieb:false }],
    [0.1,{ S_Stopp:false, S_Tuer:true },{ Tuer_Auf:true }],[0.1,{ Tuer_Zu:false },{ Tuer_Auf:true, Stoerung:false }],[0.1,{ S_Start:true },{ Antrieb:false }],[0.1,{ S_Start:false, S_Tuer:false, Tuer_Zu:true },{ Tuer_Auf:false }],
    [0.1,{ S_Start:true },{ Antrieb:true }],[0.1,{ S_Start:false, Seil_OK:false },{ Antrieb:false, Stoerung:true }],[0.1,{ Seil_OK:true, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, S_Start:true },{ Antrieb:true }]]),
  bind:['chainDoor=Tuer_Zu', 'chainRope=Seil_OK', 'chainStop=Not_Halt_OK', 'chainWind=Wind_OK', 'motorOn=Antrieb', 'brake=Bremse_Auf', 'doorOpen=Tuer_Auf', 'faultActive=Stoerung'] });
})();
