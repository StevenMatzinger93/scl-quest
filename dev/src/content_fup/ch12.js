/* ===== FUP QUEST · KAPITEL 12 — Funktionsbausteine: Instanz, Gedächtnis, Multiinstanz (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const seq = steps => [{ steps }];
const W_D = { in:'Taste_L:Bool|Taste links; Taste_R:Bool|Taste rechts; End_L:Bool|Endlage links; End_R:Bool|Endlage rechts', out:'nach_L:Bool|Antrieb links; nach_R:Bool|Antrieb rechts' };
const W_NW = 'NETWORK Nach links\n(#Taste_L OR #nach_L) AND NOT #End_L AND NOT #nach_R => #nach_L;\n\nNETWORK Nach rechts\n(#Taste_R OR #nach_R) AND NOT #End_R AND NOT #nach_L => #nach_R;';
const W_FB = kFB('FB_Weiche', W_D, W_NW);
const W_T = seq([[0,{ Taste_R:true },{ nach_R:true, nach_L:false }],[0.1,{ Taste_R:false, Taste_L:true },{ nach_R:true, nach_L:false }],[0.1,{ Taste_L:false, End_R:true },{ nach_R:false }],[0.1,{ Taste_L:true, End_R:false },{ nach_L:true }],[0.1,{ Taste_L:false, End_L:true },{ nach_L:false }]]);

defFupPro({ id:'fp12_weiche', ch:12, title:'Die Weiche als Baustein',
  story:'Eine Weiche muss sich per Selbsthaltung merken, wohin sie läuft, doch eine FC vergisst alles nach jedem Aufruf. Der <b>Funktionsbaustein</b> (FB) hat ein Gedächtnis: seine <b>Instanz</b>.',
  brief:'<code>FB_Weiche</code>:<br><b>NW 1:</b> (<code>#Taste_L</code> oder <code>#nach_L</code>) und nicht <code>#End_L</code> und nicht <code>#nach_R</code> → <code>#nach_L</code><br><b>NW 2:</b> dasselbe für rechts<br><code>Main</code> (🔒) ruft den FB mit dem Instanz-DB <code>"FB_Weiche_DB"</code> auf.',
  learn:'Selbsthaltung und Verriegelung in einem FB.',
  take:'Ein <b>FB</b> merkt sich Ausgänge und statische Variablen in seiner <b>Instanz</b>. Darum funktionieren Selbsthaltung, Speicher, Flanken und Timer nur im FB.',
  man:'fb', must:['FB','PARALLEL','NC'],
  hint:'Wie in Kapitel 3 — mit # vor den Namen.',
  blocks:[
    { name:'FB_Weiche', kind:'FB', edit:true, start: kFB('FB_Weiche', W_D, ''), ref: W_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 1\n=> "FB_Weiche_DB"(Taste_L := "W1_Taste_L", Taste_R := "W1_Taste_R", End_L := "W1_End_L", End_R := "W1_End_R", nach_L => "W1_nach_L", nach_R => "W1_nach_R");') }
  ],
  globals:{ W1_Taste_L:false, W1_Taste_R:false, W1_End_L:false, W1_End_R:false, W1_nach_L:false, W1_nach_R:false },
  unit:[{ block:'FB_Weiche', steps: W_T[0].steps }],
  timed: seq([[0,{ W1_Taste_R:true },{ W1_nach_R:true }],[0.1,{ W1_Taste_R:false },{ W1_nach_R:true }],[0.1,{ W1_End_R:true },{ W1_nach_R:false }]]),
  bind:['switch1Moving=W1_nach_R', 'switch1Right=W1_End_R'] });

defFupPro({ id:'fp12_stoerung', ch:12, title:'Störungsspeicher als Baustein',
  story:'Weichenstörung, Signalstörung, Schrankenstörung: jede wird gleich behandelt. Ein kleiner FB mit einem RS-Flipflop genügt für alle.',
  brief:'<code>FB_Stoerung</code>: <code>#Fehler</code> setzt <code>#Meldung</code>, der Quittier-Eingang setzt zurück — RS-Box (Rücksetzen dominant).',
  learn:'Flipflops im FB.',
  take:'Im FB bleibt der Zustand des Flipflops in der Instanz. So hat jede Störquelle ihren eigenen Speicher.',
  man:'fb', must:['RS'],
  hint:'Rechtsklick auf die Box → Boxtyp ändern … → RS.',
  blocks:[
    { name:'FB_Stoerung', kind:'FB', edit:true, start: kFB('FB_Stoerung', { in:'Fehler:Bool; Quittieren:Bool', out:'Meldung:Bool' }, ''), ref: kFB('FB_Stoerung', { in:'Fehler:Bool; Quittieren:Bool', out:'Meldung:Bool' }, 'NETWORK Speichern\n#Fehler => RS(#Meldung, #Quittieren);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weichenstoerung\n=> "FB_Stoerung_DB"(Fehler := "W1_Fehler", Quittieren := "Quittieren", Meldung => "Stoerung");') }
  ],
  globals:{ W1_Fehler:false, Quittieren:false, Stoerung:false },
  unit:[{ block:'FB_Stoerung', steps:[[0,{ Fehler:true },{ Meldung:true }],[0.1,{ Fehler:false },{ Meldung:true }],[0.1,{ Quittieren:true, Fehler:true },{ Meldung:true }],[0.1,{ Fehler:false },{ Meldung:false }]] }],
  timed: seq([[0,{ W1_Fehler:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false },{ Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:false }]]),
  bind:['faultActive=Stoerung'] });

const INST = { W1_DB:'FB_Weiche', W2_DB:'FB_Weiche' };
const INST_MAIN = 'NETWORK Weiche 1\n=> "W1_DB"(Taste_L := "W1_Taste_L", Taste_R := "W1_Taste_R", End_L := "W1_End_L", End_R := "W1_End_R", nach_L => "W1_nach_L", nach_R => "W1_nach_R");\n\nNETWORK Weiche 2\n=> "W2_DB"(Taste_L := "W2_Taste_L", Taste_R := "W2_Taste_R", End_L := "W2_End_L", End_R := "W2_End_R", nach_L => "W2_nach_L", nach_R => "W2_nach_R");';
const INST_G = { W1_Taste_L:false, W1_Taste_R:false, W1_End_L:false, W1_End_R:false, W1_nach_L:false, W1_nach_R:false, W2_Taste_L:false, W2_Taste_R:false, W2_End_L:false, W2_End_R:false, W2_nach_L:false, W2_nach_R:false };
const INST_T = seq([[0,{ W1_Taste_R:true },{ W1_nach_R:true, W2_nach_R:false }],[0.1,{ W1_Taste_R:false, W2_Taste_L:true },{ W1_nach_R:true, W2_nach_L:true }],[0.1,{ W2_Taste_L:false, W1_End_R:true },{ W1_nach_R:false, W2_nach_L:true }],[0.1,{ W2_End_L:true },{ W2_nach_L:false }]]);
defFupPro({ id:'fp12_instanzen', ch:12, title:'Zwei Weichen, zwei Instanzen',
  story:'Das Stellwerk hat zwei Weichen. Derselbe FB passt für beide — aber jede Weiche braucht ihr <b>eigenes</b> Gedächtnis, also ihre eigene Instanz.',
  brief:'<code>FB_Weiche</code> (🔒) ist fertig. Rufe ihn in <code>Main</code> zweimal auf: Instanz <code>"W1_DB"</code> mit den PLC-Variablen von Weiche 1, Instanz <code>"W2_DB"</code> mit denen von Weiche 2.',
  learn:'Pro Gerät eine eigene Instanz.',
  take:'Ein FB ist ein Bauplan, die Instanz das gebaute Gerät. Zwei Weichen — zwei Instanz-DBs.',
  man:'fb', must:['CALL','SINGLE'],
  hint:'Aufruf-Box, als Baustein "W1_DB" bzw. "W2_DB".',
  blocks:[ { name:'FB_Weiche', kind:'FB', src: W_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(INST_MAIN) } ],
  globals: INST_G, instances: INST, timed: INST_T,
  bind:['switch1Moving=W1_nach_R', 'switch2Moving=W2_nach_L'] });

const ACH_D = { in:'Achse:Bool; Reset:Bool', out:'Anzahl:Int' };
defFupPro({ id:'fp12_achsen', ch:12, title:'Flanken im Baustein',
  story:'Der Zählpunkt soll Achsen zählen — einmal pro Achse. Eine Flanke muss sich den letzten Zustand merken: Das geht nur im FB.',
  brief:'<code>FB_Achsen</code>:<br><b>NW 1:</b> steigende Flanke (P-Box) am Achs-Eingang → INC <code>#Anzahl</code><br><b>NW 2:</b> <code>#Reset</code> → MOVE 0 nach <code>#Anzahl</code>',
  learn:'Flanken brauchen einen FB.',
  take:'Die P-Box speichert den alten Signalzustand in der Instanz. In einer FC gäbe es dafür keinen Platz.',
  man:'fb', must:['EDGE_P','INC','MOVE'],
  hint:'Die P-Box aus ☰ Anweisungen → Bitverknüpfungen auf den Eingang ziehen.',
  blocks:[
    { name:'FB_Achsen', kind:'FB', edit:true, start: kFB('FB_Achsen', ACH_D, ''), ref: kFB('FB_Achsen', ACH_D, 'NETWORK Zaehlen\nP(#Achse) => INC(#Anzahl);\n\nNETWORK Ruecksetzen\n#Reset => MOVE(0, #Anzahl);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Zaehlpunkt\n=> "FB_Achsen_DB"(Achse := "Achse", Reset := "Grundstellung", Anzahl => "Achsen");') }
  ],
  globals:{ Achse:false, Grundstellung:false, Achsen:0 },
  timed: seq([[0,{ Achse:true },{ Achsen:1 }],[0.1,{},{ Achsen:1 }],[0.1,{ Achse:false },{}],[0.1,{ Achse:true },{ Achsen:2 }],[0.1,{ Achse:false, Grundstellung:true },{ Achsen:0 }]]),
  bind:['axleCount=Achsen'] });

defFupPro({ id:'fp12_instanz_dbg', ch:12, title:'Eine Instanz für zwei Weichen', debug:true, warnFree:['INSTANCE_TWICE'],
  story:'Weiche 2 läuft, wenn man Weiche 1 stellt, und umgekehrt, denn ARIA hat beide Aufrufe auf dieselbe Instanz gelegt. Der Compiler warnt schon.',
  brief:'Weiche 2 bekommt ihre eigene Instanz <code>"W2_DB"</code>.',
  learn:'Jede Instanz nur einmal pro Zyklus aufrufen.',
  take:'Zwei Aufrufe derselben Instanz überschreiben sich gegenseitig den gespeicherten Zustand. Die Warnung <b>INSTANCE_TWICE</b> zeigt das.',
  man:'fb', must:['SINGLE'],
  hint:'Beim Aufruf im zweiten Netzwerk den Baustein-Operanden oben anklicken und die Instanz tauschen.',
  blocks:[ { name:'FB_Weiche', kind:'FB', src: W_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(INST_MAIN.replace('=> "W2_DB"', '=> "W1_DB"')), ref: MAIN(INST_MAIN) } ],
  globals: INST_G, instances: INST, timed: INST_T,
  bind:['switch1Moving=W1_nach_R', 'switch2Moving=W2_nach_L'] });

const SCH_D = { in:'Zug_meldet:Bool', out:'Schranke_zu:Bool', stat:'T_Vorlauf:TON|Vorwarnzeit' };
const SCH_FB = kFB('FB_Schranke', SCH_D, 'NETWORK Schranke\n#Zug_meldet AND TON(#T_Vorlauf, T#3S) => #Schranke_zu;');
defFupPro({ id:'fp12_timer', ch:12, title:'Der Timer wohnt im Baustein',
  story:'Die Schranke senkt sich 3 Sekunden nach der Zugmeldung. Der Timer braucht ein Gedächtnis für die abgelaufene Zeit — im FB als <b>statische Variable</b> vom Typ TON: eine <b>Multiinstanz</b>.',
  brief:'Lege in der Tabelle die <b>Static</b>-Variable <code>T_Vorlauf</code> : <code>TON</code> an. Dann: 3 s nach der Zugmeldung schliesst die Schranke; ohne Zugmeldung ist sie offen.',
  learn:'Timer als Multiinstanz im FB.',
  take:'Timer und Zähler sind selbst kleine FBs. Im FB deklariert man sie als <b>Static</b> — sie leben in der Instanz mit.',
  man:'multiinstanz', must:['TON','STAT'],
  hint:'Tabelle → Bereich Static, Typ TON.',
  blocks:[
    { name:'FB_Schranke', kind:'FB', edit:true, start: kFB('FB_Schranke', { in:'Zug_meldet:Bool', out:'Schranke_zu:Bool' }, ''), ref: SCH_FB },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang\n=> "FB_Schranke_DB"(Zug_meldet := "Zug_meldet", Schranke_zu => "Schranke_zu");') }
  ],
  globals:{ Zug_meldet:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_meldet:true },{ Schranke_zu:false }],[2,{},{ Schranke_zu:false }],[1.1,{},{ Schranke_zu:true }],[0.1,{ Zug_meldet:false },{ Schranke_zu:false }]]),
  bind:['trainApproach=Zug_meldet', 'crossingClosed=Schranke_zu'] });

const ABS_D = { in:'Achse_ein:Bool; Achse_aus:Bool; Grundstellung:Bool', out:'Besetzt:Bool; Ueberlauf:Bool|Zählerende erreicht', stat:'Z_Ein:CTU; Z_Aus:CTU' };
defFupPro({ id:'fp12_abschnitt', ch:12, title:'Der Achszähler-Baustein',
  story:'Jeder Gleisabschnitt bekommt einen Achszähler. Als FB mit zwei Zählern als Multiinstanzen lässt er sich beliebig oft einsetzen.',
  brief:'<code>FB_Abschnitt</code> (Static <code>Z_Ein</code>, <code>Z_Aus</code> : CTU, PV 1000, R = Grundstellung):<br><b>NW 1–2:</b> einfahrende bzw. ausfahrende Achsen zählen; Zählerende → Überlauf (NW 2 mit S)<br><b>NW 3:</b> Zählerstände ungleich → <code>#Besetzt</code>',
  learn:'Zähler als Multiinstanzen.',
  take:'Zwei Zähler als Multiinstanzen, ein Vergleich — der Achszähler wird zum Standardbaustein. Der Ausgang <code>#Ueberlauf</code> meldet, wenn ein Zähler an seine Grenze kommt; jeder Ausgang wird nur von einer Zuweisung geschrieben.',
  man:'multiinstanz', must:['CTU','CMP'],
  hint:'Die Zähler-Instanzen heissen #Z_Ein und #Z_Aus.',
  blocks:[
    { name:'FB_Abschnitt', kind:'FB', edit:true, start: kFB('FB_Abschnitt', ABS_D, ''), ref: kFB('FB_Abschnitt', ABS_D, 'NETWORK Achsen ein\n#Achse_ein AND CTU(#Z_Ein, PV:=1000, R:=#Grundstellung) => #Ueberlauf;\n\nNETWORK Achsen aus\n#Achse_aus AND CTU(#Z_Aus, PV:=1000, R:=#Grundstellung) => S #Ueberlauf;\n\nNETWORK Vergleich\n[#Z_Ein.CV <> #Z_Aus.CV] => #Besetzt;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Gleis 1\n=> "FB_Abschnitt_DB"(Achse_ein := "Achse_ein", Achse_aus := "Achse_aus", Grundstellung := "Grundstellung", Besetzt => "Gleis1_besetzt", Ueberlauf => "Ueberlauf");') }
  ],
  globals:{ Achse_ein:false, Achse_aus:false, Grundstellung:false, Gleis1_besetzt:false, Ueberlauf:false },
  timed: seq([[0,{},{ Gleis1_besetzt:false }],[0.1,{ Achse_ein:true },{ Gleis1_besetzt:true }],[0.1,{ Achse_ein:false },{ Gleis1_besetzt:true }],[0.1,{ Achse_ein:true },{}],[0.1,{ Achse_ein:false },{}],[0.1,{ Achse_aus:true },{ Gleis1_besetzt:true }],[0.1,{ Achse_aus:false },{}],[0.1,{ Achse_aus:true },{ Gleis1_besetzt:false }]]),
  bind:['trackB=Gleis1_besetzt'] });

const STR_D = { in:'Zug_1:Bool; Zug_2:Bool', out:'Schranke_1:Bool; Schranke_2:Bool', stat:'BUE_1:"FB_Schranke"; BUE_2:"FB_Schranke"' };
defFupPro({ id:'fp12_multi', ch:12, title:'Bausteine im Baustein',
  story:'Auf der Strecke liegen zwei Bahnübergänge. <code>FB_Strecke</code> enthält zwei <code>FB_Schranke</code> als Multiinstanzen — die ganze Strecke braucht nur einen Instanz-DB.',
  brief:'In <code>FB_Strecke</code> sind <code>BUE_1</code> und <code>BUE_2</code> (Typ <code>"FB_Schranke"</code>) als Static deklariert. Rufe beide als Multiinstanz auf: Bahnübergang 1 mit Zug 1 und Schranke 1, Bahnübergang 2 mit Zug 2 und Schranke 2.',
  learn:'Eigene FBs als Multiinstanz aufrufen.',
  take:'Eine <b>Multiinstanz</b> liegt in der Instanz des aufrufenden FB (<code>#BUE_1</code>). Grosse Anlagen entstehen so wie aus Bausteinen im Baukasten.',
  man:'multiinstanz', must:['MULTI','CALL'],
  hint:'CALL-Box (☰ Anweisungen → Bausteine), oben den Baustein-Operanden anklicken → #BUE_1 wird vorgeschlagen.',
  blocks:[
    { name:'FB_Schranke', kind:'FB', src: SCH_FB },
    { name:'FB_Strecke', kind:'FB', edit:true, start: kFB('FB_Strecke', STR_D, ''), ref: kFB('FB_Strecke', STR_D, 'NETWORK Bahnuebergang 1\n=> #BUE_1(Zug_meldet := #Zug_1, Schranke_zu => #Schranke_1);\n\nNETWORK Bahnuebergang 2\n=> #BUE_2(Zug_meldet := #Zug_2, Schranke_zu => #Schranke_2);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Strecke\n=> "FB_Strecke_DB"(Zug_1 := "Zug_1", Zug_2 := "Zug_2", Schranke_1 => "Schranke_1", Schranke_2 => "Schranke_2");') }
  ],
  globals:{ Zug_1:false, Zug_2:false, Schranke_1:false, Schranke_2:false },
  timed: seq([[0,{ Zug_1:true },{ Schranke_1:false }],[3.1,{},{ Schranke_1:true, Schranke_2:false }],[0.1,{ Zug_2:true },{ Schranke_2:false }],[3.1,{},{ Schranke_2:true }],[0.1,{ Zug_1:false },{ Schranke_1:false, Schranke_2:true }]]),
  bind:['crossingClosed=Schranke_1', 'trainApproach=Zug_1'] });

const BUE_D = { in:'Zug_meldet:Bool', out:'Schranke_zu:Bool; Fahrt_frei:Bool', stat:'T_Vorlauf:TON; T_Sicher:TON' };
defFupPro({ id:'fp12_timer_dbg', ch:12, title:'Ein Timer für alles', debug:true,
  story:'Die Schranke schliesst nie, das Signal bleibt rot. ARIA hat beide Zeiten mit <b>demselben</b> Timer gebaut.',
  brief:'Jede Zeit braucht ihren eigenen Timer: NW 1 benutzt <code>#T_Vorlauf</code> (3 s), NW 2 einen zweiten (1 s).',
  learn:'Jede Timer-Instanz nur einmal verwenden.',
  take:'Ein Timer misst genau eine Zeit. Wird er zweimal pro Zyklus mit verschiedenen Eingängen aufgerufen, läuft keine der beiden Zeiten sauber ab.',
  man:'multiinstanz', must:['TON'],
  hint:'Zweite TON-Variable in der Tabelle anlegen und in NW 2 verwenden.',
  blocks:[
    { name:'FB_BUE', kind:'FB', edit:true,
      start: kFB('FB_BUE', { in:'Zug_meldet:Bool', out:'Schranke_zu:Bool; Fahrt_frei:Bool', stat:'T_Vorlauf:TON' }, 'NETWORK Schranke\n#Zug_meldet AND TON(#T_Vorlauf, T#3S) => #Schranke_zu;\n\nNETWORK Sicherheitszeit\n#Schranke_zu AND TON(#T_Vorlauf, T#1S) => #Fahrt_frei;'),
      ref: kFB('FB_BUE', BUE_D, 'NETWORK Schranke\n#Zug_meldet AND TON(#T_Vorlauf, T#3S) => #Schranke_zu;\n\nNETWORK Sicherheitszeit\n#Schranke_zu AND TON(#T_Sicher, T#1S) => #Fahrt_frei;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Bahnuebergang\n=> "FB_BUE_DB"(Zug_meldet := "Zug_meldet", Schranke_zu => "Schranke_zu", Fahrt_frei => "Signal_B");') }
  ],
  globals:{ Zug_meldet:false, Schranke_zu:false, Signal_B:false },
  timed: seq([[0,{ Zug_meldet:true },{ Schranke_zu:false }],[3.1,{},{ Schranke_zu:true, Signal_B:false }],[0.5,{},{ Signal_B:false }],[0.6,{},{ Signal_B:true }]]),
  bind:['crossingClosed=Schranke_zu', 'signalExit=Signal_B'] });

const WB_D = { in:'Taste_L:Bool; Taste_R:Bool; End_L:Bool; End_R:Bool; Quittieren:Bool', out:'nach_L:Bool; nach_R:Bool; Stoerung:Bool', stat:'T_Lauf:TON|Laufzeitüberwachung', temp:'Laeuft:Bool' };
const WB_NW = W_NW + '\n\nNETWORK Laeuft\n#nach_L OR #nach_R => #Laeuft;\n\nNETWORK Laufzeit\n#Laeuft AND TON(#T_Lauf, T#6S) => RS(#Stoerung, #Quittieren);';
defFupPro({ id:'fp12_boss', ch:12, title:'Boss: Der Weichenbaustein', boss:true,
  story:'ARIA lässt eine Weiche im Schnee klemmen und meldet nichts. Frau Gasser: „Ein richtiger Weichenbaustein, der umläuft, verriegelt und überwacht, und dann setzen wir ihn überall ein.“',
  brief:'<code>FB_Weiche</code>:<br><b>NW 1–2:</b> links/rechts wie gehabt<br><b>NW 3:</b> Antrieb links oder rechts → <code>#Laeuft</code><br><b>NW 4:</b> läuft 6 s (<code>#T_Lauf</code>) → RS <code>#Stoerung</code>, R Quittier-Eingang<br><b>Main:</b> <code>"FB_Weiche_DB"</code> mit den PLC-Variablen von Weiche 1',
  learn:'Ein vollständiger Weichen-FB mit Laufzeitüberwachung.',
  take:'Ein guter Weichenbaustein kapselt alles: Umlauf, Verriegelung, Überwachung, Störung. Von aussen sieht man nur die Schnittstelle.',
  man:'fb', must:['TON','RS','CALL','TEMP'],
  hint:'Vier Netzwerke im FB, dann der Aufruf in Main.',
  blocks:[
    { name:'FB_Weiche', kind:'FB', edit:true, start: kFB('FB_Weiche', WB_D, ''), ref: kFB('FB_Weiche', WB_D, WB_NW) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Weiche 1\n=> "FB_Weiche_DB"(Taste_L := "W1_Taste_L", Taste_R := "W1_Taste_R", End_L := "W1_End_L", End_R := "W1_End_R", Quittieren := "Quittieren", nach_L => "W1_nach_L", nach_R => "W1_nach_R", Stoerung => "W1_Stoerung");') }
  ],
  globals:{ W1_Taste_L:false, W1_Taste_R:false, W1_End_L:false, W1_End_R:false, Quittieren:false, W1_nach_L:false, W1_nach_R:false, W1_Stoerung:false },
  unit:[{ block:'FB_Weiche', steps:[[0,{ Taste_R:true },{ nach_R:true, Stoerung:false }],[0.1,{ Taste_R:false },{ nach_R:true }],[4,{ End_R:true },{ nach_R:false, Stoerung:false }],[0.1,{ Taste_L:true, End_R:false },{ nach_L:true }],[0.1,{ Taste_L:false },{}],[6.1,{},{ Stoerung:true, nach_L:true }],[0.1,{ End_L:true },{ nach_L:false, Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:false }]] }],
  timed: seq([[0,{ W1_Taste_L:true },{ W1_nach_L:true }],[0.1,{ W1_Taste_L:false },{}],[6.1,{},{ W1_Stoerung:true }],[0.1,{ W1_End_L:true, Quittieren:true },{ W1_nach_L:false }],[0.1,{},{ W1_Stoerung:false }]]),
  wrong:[{ FB_Weiche: kFB('FB_Weiche', WB_D, WB_NW.replace('RS(#Stoerung, #Quittieren)', 'SR(#Stoerung, #Quittieren)').replace('T#6S', 'T#60S')) }],
  bind:['switch1Moving=W1_nach_L', 'faultActive=W1_Stoerung'] });
})();
