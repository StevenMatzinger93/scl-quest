/* ===== KOP QUEST · KAPITEL 12 — Funktionsbausteine: Instanz, Gedächtnis, Multiinstanz (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const seq = steps => [{ steps }];
const ANTRIEB_D = { in:'Start:Bool|Taster Start; Stopp:Bool|Taster Stopp (Schliesser); Freigabe:Bool|Sicherheitskette OK', out:'Laeuft:Bool|Antrieb läuft' };
const ANTRIEB_NW = 'NETWORK Selbsthaltung\n(#Start OR #Laeuft) AND NOT #Stopp AND #Freigabe => #Laeuft;';
const ANTRIEB_FB = kFB('FB_Antrieb', ANTRIEB_D, ANTRIEB_NW);

defKopPro({ id:'k12_selbsthaltung', ch:12, title:'Ein Baustein mit Gedächtnis',
  story:'Eine Selbsthaltung in einer FC? Unmöglich — die FC vergisst nach jedem Aufruf alles. Der <b>Funktionsbaustein</b> (FB) dagegen hat eine <b>Instanz</b>: einen eigenen Datenbaustein, in dem seine Werte von Zyklus zu Zyklus erhalten bleiben.',
  brief:'Zeichne in <code>FB_Antrieb</code> die Selbsthaltung:<br>(<code>#Start</code> oder <code>#Laeuft</code>) und nicht <code>#Stopp</code> und <code>#Freigabe</code> → <code>#Laeuft</code><br><code>Main</code> (🔒) ruft den FB mit seinem Instanz-DB <code>"FB_Antrieb_DB"</code> auf.',
  learn:'Selbsthaltung im FB: Ausgänge bleiben in der Instanz gespeichert.',
  take:'Ein <b>FB</b> merkt sich alle Ausgänge und statischen Variablen in seiner <b>Instanz</b> (Instanz-DB). Darum funktionieren Selbsthaltung, S/R, Flanken und Timer nur im FB.',
  man:'fb', must:['FB','PARALLEL'],
  hint:'Wie in Kapitel 3 — nur mit # vor den Namen.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: kFB('FB_Antrieb', ANTRIEB_D, ''), ref: ANTRIEB_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Hauptantrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Laeuft => "Antrieb");') }
  ],
  globals:{ S_Start:false, S_Stopp:false, Kette_OK:true, Antrieb:false },
  unit:[{ block:'FB_Antrieb', steps:[[0,{ Start:true, Freigabe:true },{ Laeuft:true }],[0.1,{ Start:false },{ Laeuft:true }],[0.1,{ Stopp:true },{ Laeuft:false }],[0.1,{ Stopp:false },{ Laeuft:false }],[0.1,{ Start:true },{ Laeuft:true }],[0.1,{ Start:false, Freigabe:false },{ Laeuft:false }]] }],
  timed: seq([[0,{ S_Start:true },{ Antrieb:true }],[0.1,{ S_Start:false },{ Antrieb:true }],[0.1,{ S_Stopp:true },{ Antrieb:false }]]),
  bind:['motorOn=Antrieb', 'lightGreen=Kette_OK'] });

const ST_D = { in:'Fehler:Bool|Störsignal; Quittieren:Bool', out:'Meldung:Bool|Störung gespeichert' };
const ST_FB = kFB('FB_Stoerung', ST_D, 'NETWORK Speichern\n#Fehler => S #Meldung;\n\nNETWORK Quittieren\n#Quittieren AND NOT #Fehler => R #Meldung;');
defKopPro({ id:'k12_stoerung', ch:12, title:'Störungsspeicher als Baustein',
  story:'Seilfehler, Türfehler, Windfehler — jede Störung wird gleich behandelt: speichern, bis jemand quittiert. Statt das fünfmal zu zeichnen, baust du einen <b>Störungsbaustein</b>.',
  brief:'<code>FB_Stoerung</code>:<br><b>NW 1:</b> <code>#Fehler</code> setzt <code>#Meldung</code><br><b>NW 2:</b> <code>#Quittieren</code> und nicht <code>#Fehler</code> setzt <code>#Meldung</code> zurück',
  learn:'Setzen/Rücksetzen im FB — der Zustand bleibt in der Instanz.',
  take:'Im FB sind S- und R-Spulen erlaubt und sinnvoll: Der gespeicherte Zustand steht in der Instanz und überlebt jeden Zyklus.',
  man:'fb', must:['SET','RESET'],
  hint:'Zwei Netzwerke wie in Kapitel 4.',
  blocks:[
    { name:'FB_Stoerung', kind:'FB', edit:true, start: kFB('FB_Stoerung', ST_D, ''), ref: ST_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Seilstoerung\n=> "FB_Stoerung_DB"(Fehler := "Seil_Fehler", Quittieren := "Quittieren", Meldung => "Stoerung");') }
  ],
  globals:{ Seil_Fehler:false, Quittieren:false, Stoerung:false },
  unit:[{ block:'FB_Stoerung', steps:[[0,{ Fehler:true },{ Meldung:true }],[0.1,{ Fehler:false },{ Meldung:true }],[0.1,{ Quittieren:true, Fehler:true },{ Meldung:true }],[0.1,{ Fehler:false },{ Meldung:false }],[0.1,{ Quittieren:false },{ Meldung:false }]] }],
  timed: seq([[0,{ Seil_Fehler:true },{ Stoerung:true }],[0.1,{ Seil_Fehler:false },{ Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:false }]]),
  bind:['faultActive=Stoerung', 'lightRed=Stoerung'] });

const INST = { Antrieb_DB:'FB_Antrieb', Licht_DB:'FB_Antrieb' };
const INST_MAIN = 'NETWORK Hauptantrieb\n=> "Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Laeuft => "Antrieb");\n\nNETWORK Beleuchtung\n=> "Licht_DB"(Start := "S_Licht_Ein", Stopp := "S_Licht_Aus", Freigabe := TRUE, Laeuft => "Beleuchtung");';
const INST_G = { S_Start:false, S_Stopp:false, Kette_OK:true, Antrieb:false, S_Licht_Ein:false, S_Licht_Aus:false, Beleuchtung:false };
const INST_T = seq([[0,{ S_Start:true },{ Antrieb:true, Beleuchtung:false }],[0.1,{ S_Start:false, S_Licht_Ein:true },{ Antrieb:true, Beleuchtung:true }],[0.1,{ S_Licht_Ein:false, S_Stopp:true },{ Antrieb:false, Beleuchtung:true }],[0.1,{ S_Stopp:false, S_Licht_Aus:true },{ Beleuchtung:false }],[0.1,{ S_Licht_Aus:false },{ Antrieb:false, Beleuchtung:false }]]);

defKopPro({ id:'k12_instanzen', ch:12, title:'Zwei Instanzen',
  story:'Der Werkmeister grinst: „Dein Antriebsbaustein taugt auch für die Beleuchtung — Ein, Aus, Selbsthaltung.“ Aber jede Anlage braucht ihr <b>eigenes</b> Gedächtnis, also ihre eigene Instanz.',
  brief:'<code>FB_Antrieb</code> (🔒) ist fertig. Rufe ihn in <code>Main</code> zweimal auf:<br><b>NW 1:</b> Instanz <code>"Antrieb_DB"</code>: <code>Start</code> := Starttaster, <code>Stopp</code> := Stopptaster, <code>Freigabe</code> := Meldung „Sicherheitskette OK“, <code>Laeuft</code> => Antriebsausgang<br><b>NW 2:</b> Instanz <code>"Licht_DB"</code>: <code>Start</code> := Einschalttaster Licht, <code>Stopp</code> := Ausschalttaster Licht, <code>Freigabe</code> := <code>TRUE</code>, <code>Laeuft</code> => Ausgang der Beleuchtung',
  learn:'Pro Gerät eine eigene Instanz desselben FB.',
  take:'Ein FB ist ein Bauplan, die Instanz das gebaute Gerät. Zwei Geräte = zwei Instanz-DBs. So stören sich die gespeicherten Zustände nie.',
  man:'fb', must:['CALL','SINGLE'],
  hint:'Aufruf-Box, als Baustein die Instanz "Antrieb_DB" bzw. "Licht_DB" wählen.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', src: ANTRIEB_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(INST_MAIN) }
  ],
  globals: INST_G, instances: INST, timed: INST_T,
  bind:['motorOn=Antrieb', 'lightsOn=Beleuchtung'] });

const Z_D = { in:'Drehkreuz:Bool; Reset:Bool', out:'Gaeste:Int|Fahrgäste seit dem letzten Reset' };
defKopPro({ id:'k12_flanke', ch:12, title:'Flanken im Baustein',
  story:'Das Drehkreuz soll Gäste zählen — einmal pro Person. Eine Flanke muss sich den Zustand des letzten Zyklus merken. In einer FC ginge das nicht, im FB schon.',
  brief:'<code>FB_Zaehler</code>:<br><b>NW 1:</b> P-Flanke <code>#Drehkreuz</code> → <b>INC</b> <code>#Gaeste</code><br><b>NW 2:</b> <code>#Reset</code> → MOVE 0 nach <code>#Gaeste</code>',
  learn:'Flankenkontakte brauchen einen FB.',
  take:'Die P-Flanke speichert den alten Signalzustand in der Instanz. Deshalb gibt es Flanken nur im FB (oder mit einem eigenen Merker) — eine FC hätte kein Gedächtnis dafür.',
  man:'fb', must:['EDGE_P','INC','MOVE'],
  hint:'Kontakt antippen → Flanke P. Spule antippen → Rechnen → Box INC.',
  blocks:[
    { name:'FB_Zaehler', kind:'FB', edit:true, start: kFB('FB_Zaehler', Z_D, ''), ref: kFB('FB_Zaehler', Z_D, 'NETWORK Zaehlen\nP(#Drehkreuz) => INC(#Gaeste);\n\nNETWORK Ruecksetzen\n#Reset => MOVE(0, #Gaeste);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Fahrgaeste\n=> "FB_Zaehler_DB"(Drehkreuz := "Drehkreuz", Reset := "Abfahrt", Gaeste => "Fahrgaeste");') }
  ],
  globals:{ Drehkreuz:false, Abfahrt:false, Fahrgaeste:0 },
  timed: seq([[0,{ Drehkreuz:true },{ Fahrgaeste:1 }],[0.1,{},{ Fahrgaeste:1 }],[0.1,{ Drehkreuz:false },{ Fahrgaeste:1 }],[0.1,{ Drehkreuz:true },{ Fahrgaeste:2 }],[0.1,{ Drehkreuz:false, Abfahrt:true },{ Fahrgaeste:0 }],[0.1,{ Abfahrt:false, Drehkreuz:true },{ Fahrgaeste:1 }]]),
  bind:['passengers=Fahrgaeste', 'gateOpen=Drehkreuz'] });

defKopPro({ id:'k12_instanz_dbg', ch:12, title:'Eine Instanz für zwei', debug:true, warnFree:['INSTANCE_TWICE'],
  story:'Das Licht geht aus, wenn der Antrieb stoppt, und der Antrieb läuft, wenn jemand Licht macht. ARIA hat beide Aufrufe auf <b>dieselbe</b> Instanz gelegt. Der Compiler warnt schon.',
  brief:'Die Beleuchtung soll ihre eigene Instanz <code>"Licht_DB"</code> bekommen.',
  learn:'Jede Instanz nur einmal pro Zyklus aufrufen.',
  take:'Ruft man dieselbe Instanz zweimal auf, überschreibt der zweite Aufruf den gespeicherten Zustand des ersten. Die Warnung <b>INSTANCE_TWICE</b> zeigt das an.',
  man:'fb', must:['SINGLE'],
  hint:'Im zweiten Netzwerk die Aufruf-Box antippen und die Instanz tauschen.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', src: ANTRIEB_FB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(INST_MAIN.replace('=> "Licht_DB"', '=> "Antrieb_DB"')), ref: MAIN(INST_MAIN) }
  ],
  globals: INST_G, instances: INST, timed: INST_T,
  bind:['motorOn=Antrieb', 'lightsOn=Beleuchtung'] });

const TUER_D = { in:'Kabine_da:Bool', out:'Tuer_Auf:Bool', stat:'T_Tuer:TON|Verzögerung Tür öffnen' };
const TUER_FB = kFB('FB_Tuer', TUER_D, 'NETWORK Tuer oeffnen\n#Kabine_da AND TON(#T_Tuer, T#2S) => #Tuer_Auf;');
defKopPro({ id:'k12_timer', ch:12, title:'Der Timer wohnt im Baustein',
  story:'Die Tür soll 2 Sekunden nach der Einfahrt öffnen. Ein Timer braucht ein Gedächtnis für die abgelaufene Zeit — im FB bekommt er es als <b>statische Variable</b> vom Typ TON: eine <b>Multiinstanz</b>.',
  brief:'Lege in der Tabelle eine <b>Static</b>-Variable <code>T_Tuer</code> vom Typ <code>TON</code> an. Dann: der Bool-Input der Schnittstelle (Kabine im Bahnsteig) → TON <code>#T_Tuer</code> (2 s) → der Bool-Output (Türbefehl)',
  learn:'Timer als Multiinstanz (statische Variable) im FB.',
  take:'Timer und Zähler sind selbst kleine FBs. Im FB deklariert man sie als <b>Static</b> (<code>T_Tuer : TON</code>) — sie leben dann in der Instanz des FB mit. Jeder Timer braucht seine eigene Variable.',
  man:'multiinstanz', must:['TON','STAT'],
  hint:'Tabelle → Zeile: Bereich Static, Name T_Tuer, Typ TON. Im Netzwerk heisst die Instanz #T_Tuer.',
  blocks:[
    { name:'FB_Tuer', kind:'FB', edit:true, start: kFB('FB_Tuer', { in:'Kabine_da:Bool', out:'Tuer_Auf:Bool' }, ''), ref: TUER_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Tuer\n=> "FB_Tuer_DB"(Kabine_da := "Kabine_da", Tuer_Auf => "Tuer_Auf");') }
  ],
  globals:{ Kabine_da:false, Tuer_Auf:false },
  timed: seq([[0,{ Kabine_da:true },{ Tuer_Auf:false }],[1,{},{ Tuer_Auf:false }],[1.1,{},{ Tuer_Auf:true }],[0.1,{ Kabine_da:false },{ Tuer_Auf:false }]]),
  bind:['cabinInStation=Kabine_da', 'doorOpen=Tuer_Auf'] });

const KAB_D = { in:'Drehkreuz:Bool; Abfahrt:Bool', out:'Voll:Bool; Anzahl:Int', stat:'Z_Gaeste:CTU' };
defKopPro({ id:'k12_zaehler', ch:12, title:'Der Zähler im Baustein',
  story:'Jede Kabine fasst 8 Personen. Der Zähler dafür gehört in einen FB — als Multiinstanz, genau wie der Timer.',
  brief:'<code>FB_Kabine</code> (Static <code>Z_Gaeste : CTU</code> ist deklariert):<br><b>NW 1:</b> <code>#Drehkreuz</code> → CTU <code>#Z_Gaeste</code> (PV 8, R <code>#Abfahrt</code>) → <code>#Voll</code><br><b>NW 2:</b> ohne Bedingung → MOVE <code>#Z_Gaeste.CV</code> nach <code>#Anzahl</code>',
  learn:'Zähler als Multiinstanz, Zählwert über .CV lesen.',
  take:'Auch Zähler sind Multiinstanzen. Ihren Zählwert liest man als <code>#Z_Gaeste.CV</code> — die Instanz ist eine Struktur mit Ein- und Ausgängen.',
  man:'multiinstanz', must:['CTU','MOVE'],
  hint:'Kontakt dahinter → Zähler. Instanz #Z_Gaeste, PV 8, Reset #Abfahrt.',
  blocks:[
    { name:'FB_Kabine', kind:'FB', edit:true, start: kFB('FB_Kabine', KAB_D, ''), ref: kFB('FB_Kabine', KAB_D, 'NETWORK Gaeste zaehlen\n#Drehkreuz AND CTU(#Z_Gaeste, PV:=8, R:=#Abfahrt) => #Voll;\n\nNETWORK Anzeige\n=> MOVE(#Z_Gaeste.CV, #Anzahl);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Kabine\n=> "FB_Kabine_DB"(Drehkreuz := "Drehkreuz", Abfahrt := "Abfahrt", Voll => "Kabine_voll", Anzahl => "Anzeige");') }
  ],
  globals:{ Drehkreuz:false, Abfahrt:false, Kabine_voll:false, Anzeige:0 },
  timed: seq([].concat(...Array.from({ length:8 }, (_, i) => [[0.1,{ Drehkreuz:true },{ Anzeige:i + 1, Kabine_voll: i === 7 }],[0.1,{ Drehkreuz:false },{}]]), [[0.1,{ Abfahrt:true },{ Anzeige:0, Kabine_voll:false }],[0.1,{ Abfahrt:false, Drehkreuz:true },{ Anzeige:1 }]])),
  bind:['passengers=Anzeige', 'lightRed=Kabine_voll'] });

const STN_D = { in:'Kabine_Berg:Bool; Kabine_Tal:Bool', out:'Tuer_Berg_Auf:Bool; Tuer_Tal_Auf:Bool', stat:'Tuer_Berg:"FB_Tuer"; Tuer_Tal:"FB_Tuer"' };
const STN_NW = 'NETWORK Tuer Berg\n=> #Tuer_Berg(Kabine_da := #Kabine_Berg, Tuer_Auf => #Tuer_Berg_Auf);\n\nNETWORK Tuer Tal\n=> #Tuer_Tal(Kabine_da := #Kabine_Tal, Tuer_Auf => #Tuer_Tal_Auf);';
defKopPro({ id:'k12_multi', ch:12, title:'Bausteine im Baustein',
  story:'Eine Station hat zwei Bahnsteige, also zwei Türen. <code>FB_Station</code> enthält zwei <code>FB_Tuer</code> — als Multiinstanzen, genau wie Timer. So braucht die ganze Station nur einen Instanz-DB.',
  brief:'In <code>FB_Station</code> sind zwei Static-Variablen vom Typ <code>"FB_Tuer"</code> deklariert (eine für die Bergtür, eine für die Taltür — du findest sie in der Variablenliste unter „Aufruf“). Rufe sie auf:<br><b>NW 1:</b> Bergtür: <code>Kabine_da</code> := Kabinenmelder Berg (Input der Station), <code>Tuer_Auf</code> => Türbefehl Berg (Output der Station)<br><b>NW 2:</b> Taltür: dasselbe mit Kabinenmelder Tal und Türbefehl Tal',
  learn:'Eigene FBs als Multiinstanz aufrufen.',
  take:'Eine <b>Multiinstanz</b> ist ein FB-Aufruf, dessen Daten in der Instanz des aufrufenden FB liegen (<code>#Tuer_Berg</code>). Grosse Anlagen werden so wie Baukästen zusammengesetzt.',
  man:'multiinstanz', must:['MULTI','CALL'],
  hint:'Aufruf-Box → Baustein #Tuer_Berg (steht in der Variablenliste unter „Aufruf“).',
  blocks:[
    { name:'FB_Tuer', kind:'FB', src: TUER_FB },
    { name:'FB_Station', kind:'FB', edit:true, start: kFB('FB_Station', STN_D, ''), ref: kFB('FB_Station', STN_D, STN_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Station\n=> "FB_Station_DB"(Kabine_Berg := "Kabine_Berg", Kabine_Tal := "Kabine_Tal", Tuer_Berg_Auf => "Tuer_Berg", Tuer_Tal_Auf => "Tuer_Tal");') }
  ],
  globals:{ Kabine_Berg:false, Kabine_Tal:false, Tuer_Berg:false, Tuer_Tal:false },
  timed: seq([[0,{ Kabine_Berg:true },{ Tuer_Berg:false }],[2.1,{},{ Tuer_Berg:true, Tuer_Tal:false }],[0.1,{ Kabine_Tal:true },{ Tuer_Tal:false }],[2.1,{},{ Tuer_Tal:true }],[0.1,{ Kabine_Berg:false },{ Tuer_Berg:false, Tuer_Tal:true }]]),
  bind:['cabinInStation=Kabine_Berg', 'doorOpen=Tuer_Berg'] });

const SIG_D = { in:'Kabine_da:Bool', out:'Tuer_Auf:Bool; Hupe:Bool', stat:'T_Tuer:TON; T_Warn:TON' };
defKopPro({ id:'k12_timer_dbg', ch:12, title:'Ein Timer für alles', debug:true,
  story:'Die Tür öffnet nie, die Schliesswarnung hupt nie. ARIA hat beide Zeiten mit <b>demselben</b> Timer gebaut — der wird in jedem Zyklus zweimal mit verschiedenen Eingängen aufgerufen.',
  brief:'Jede Zeit braucht einen eigenen Timer. Lege (falls nötig) eine zweite TON-Variable an und benutze sie im Netzwerk <b>Schliesswarnung</b>:<br><b>NW 1:</b> Kabine im Bahnsteig (Input) → TON 2 s → Türbefehl (Output)<br><b>NW 2:</b> Türbefehl → TON 5 s → <code>#Hupe</code>',
  learn:'Jede Timer-Instanz nur einmal verwenden.',
  take:'Ein Timer misst genau <b>eine</b> Zeit. Wird dieselbe Instanz zweimal aufgerufen, setzt der zweite Aufruf den ersten zurück — beide Zeiten laufen nie ab.',
  man:'multiinstanz', must:['TON'],
  hint:'Box im zweiten Netzwerk antippen → Instanz ändern. Der zweite Timer muss in der Tabelle als Static TON stehen.',
  blocks:[
    { name:'FB_Signal', kind:'FB', edit:true,
      start: kFB('FB_Signal', { in:'Kabine_da:Bool', out:'Tuer_Auf:Bool; Hupe:Bool', stat:'T_Tuer:TON' }, 'NETWORK Tuer oeffnen\n#Kabine_da AND TON(#T_Tuer, T#2S) => #Tuer_Auf;\n\nNETWORK Schliesswarnung\n#Tuer_Auf AND TON(#T_Tuer, T#5S) => #Hupe;'),
      ref: kFB('FB_Signal', SIG_D, 'NETWORK Tuer oeffnen\n#Kabine_da AND TON(#T_Tuer, T#2S) => #Tuer_Auf;\n\nNETWORK Schliesswarnung\n#Tuer_Auf AND TON(#T_Warn, T#5S) => #Hupe;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Signal\n=> "FB_Signal_DB"(Kabine_da := "Kabine_da", Tuer_Auf => "Tuer_Auf", Hupe => "Hupe");') }
  ],
  globals:{ Kabine_da:false, Tuer_Auf:false, Hupe:false },
  timed: seq([[0,{ Kabine_da:true },{ Tuer_Auf:false }],[2.1,{},{ Tuer_Auf:true, Hupe:false }],[3,{},{ Hupe:false }],[2.1,{},{ Hupe:true, Tuer_Auf:true }],[0.1,{ Kabine_da:false },{ Tuer_Auf:false, Hupe:false }]]),
  bind:['cabinInStation=Kabine_da', 'doorOpen=Tuer_Auf', 'hornActive=Hupe'] });

const AB_D = { in:'Start:Bool; Stopp:Bool; Freigabe:Bool; Seil_Fehler:Bool; Quittieren:Bool', out:'Laeuft:Bool; Hupe:Bool; Stoerung:Bool', stat:'Anlauf:Bool|Anlaufwarnung aktiv; T_Anlauf:TON' };
const AB_NW = 'NETWORK Start\nP(#Start) AND #Freigabe AND NOT #Stoerung => S #Anlauf;\n\nNETWORK Warnung\n#Anlauf => #Hupe;\n\nNETWORK Anlaufzeit\n#Anlauf AND TON(#T_Anlauf, T#2S) => S #Laeuft, R #Anlauf;\n\nNETWORK Seilstoerung\n#Seil_Fehler => S #Stoerung;\n\nNETWORK Quittieren\n#Quittieren AND NOT #Seil_Fehler => R #Stoerung;\n\nNETWORK Abschalten\n#Stopp OR NOT #Freigabe OR #Stoerung => R #Laeuft, R #Anlauf;';
const AB_CALL = 'NETWORK Hauptantrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Kette_OK", Seil_Fehler := "Seil_Fehler", Quittieren := "Quittieren", Laeuft => "Antrieb", Hupe => "Hupe", Stoerung => "Stoerung");';
defKopPro({ id:'k12_boss', ch:12, title:'Boss: Der Antriebsbaustein', boss:true,
  story:'ARIA lässt den Hauptantrieb ohne Warnung anlaufen und ignoriert Seilfehler. Der Werkmeister: „Ein Antrieb, ein Baustein. Mit Anlaufwarnung, Störungsspeicher und allem. Dann setzen wir ihn überall ein.“',
  brief:'<code>FB_Antrieb</code> (Schnittstelle steht, Static <code>Anlauf</code> und <code>T_Anlauf : TON</code>):<br><b>NW 1:</b> P-Flanke <code>#Start</code>, <code>#Freigabe</code>, nicht <code>#Stoerung</code> → S <code>#Anlauf</code><br><b>NW 2:</b> <code>#Anlauf</code> → <code>#Hupe</code><br><b>NW 3:</b> <code>#Anlauf</code> → TON <code>#T_Anlauf</code> 2 s → S <code>#Laeuft</code>, R <code>#Anlauf</code><br><b>NW 4:</b> Seilfehler-Input → S <code>#Stoerung</code><br><b>NW 5:</b> <code>#Quittieren</code> und nicht Seilfehler-Input → R <code>#Stoerung</code><br><b>NW 6:</b> <code>#Stopp</code> oder nicht <code>#Freigabe</code> oder <code>#Stoerung</code> → R <code>#Laeuft</code>, R <code>#Anlauf</code><br><b>Main:</b> Aufruf mit Instanz <code>"FB_Antrieb_DB"</code>: Die Eingänge bekommen Starttaster, Stopptaster, „Sicherheitskette OK“, Seilfehler und Quittiertaster; die Ausgänge gehen auf Antrieb, Hupe und Störmeldung (jeweils die PLC-Variable mit dem passenden Kommentar).',
  learn:'Ein vollständiger Antriebs-FB mit Flanke, Timer und Störungsspeicher.',
  take:'Ein guter Antriebsbaustein kapselt alles, was zum Antrieb gehört: Start mit Vorwarnung, Abschaltbedingungen, Störungsspeicher. Von aussen sieht man nur die Schnittstelle.',
  man:'fb', must:['EDGE_P','TON','SET','RESET','CALL'],
  hint:'Sechs Netzwerke, dann der Aufruf in Main. Teste zwischendurch — die Testtabelle zeigt, welcher Schritt fehlt.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: kFB('FB_Antrieb', AB_D, ''), ref: kFB('FB_Antrieb', AB_D, AB_NW) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(AB_CALL) }
  ],
  globals:{ S_Start:false, S_Stopp:false, Kette_OK:true, Seil_Fehler:false, Quittieren:false, Antrieb:false, Hupe:false, Stoerung:false },
  unit:[{ block:'FB_Antrieb', steps:[[0,{ Start:true, Freigabe:true },{ Hupe:true, Laeuft:false }],[1,{ Start:false },{ Hupe:true, Laeuft:false }],[1.1,{},{ Laeuft:true }],[0.1,{},{ Hupe:false, Laeuft:true }],
    [0.1,{ Seil_Fehler:true },{ Stoerung:true, Laeuft:false }],[0.1,{ Seil_Fehler:false, Start:true },{ Hupe:false, Laeuft:false }],[0.1,{ Start:false, Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false, Start:true },{ Hupe:true }],[0.1,{ Start:false, Stopp:true },{ Laeuft:false }],[0.1,{},{ Hupe:false, Laeuft:false }]] }],
  timed: seq([[0,{ S_Start:true },{ Hupe:true, Antrieb:false }],[2.1,{ S_Start:false },{ Antrieb:true }],[0.1,{ Kette_OK:false },{ Antrieb:false }]]),
  wrong:[{ FB_Antrieb: kFB('FB_Antrieb', AB_D, AB_NW.replace('P(#Start)', '#Start')) }],
  bind:['motorOn=Antrieb', 'hornActive=Hupe', 'faultActive=Stoerung', 'lightGreen=Kette_OK'] });
})();
