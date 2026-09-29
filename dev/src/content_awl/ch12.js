/* ===== AWL QUEST · KAPITEL 12 — Funktionsbausteine: Instanz, Multiinstanz, IEC-Zeiten (Profi-Stufe) ===== */
(function(){
const MAIN = body => aOB('Main', body);
const seq = steps => [{ steps }];
const ANT_D = { in:'Start:Bool; Stopp:Bool', out:'Laeuft:Bool' };
const ANT_BODY = 'U(\nO  #Start\nO  #Laeuft\n)\nUN #Stopp\n=  #Laeuft';
const ANT_FB = aFB('FB_Antrieb', ANT_D, ANT_BODY);
const CALL_ANT = (db, s, st, out) => 'CALL "FB_Antrieb", "' + db + '"\n   Start := "' + s + '"\n   Stopp := "' + st + '"\n   Laeuft => "' + out + '"';

defAwlPro({ id:'ap12_selbsthaltung', ch:12, title:'Der Antrieb mit Gedächtnis',
  story:'Eine Selbsthaltung muss sich ihren Zustand merken — das kann eine FC nicht. Herr Brunner: „Dafür gibt es den <b>Funktionsbaustein</b>. Seine Ausgänge liegen im Instanz-DB und bleiben erhalten.“',
  brief:'<code>FB_Antrieb</code>: <code>#Laeuft</code> = (<code>#Start</code> ODER <code>#Laeuft</code>) UND NICHT <code>#Stopp</code>. <code>Main</code> (🔒) ruft ihn mit <code>"FB_Antrieb_DB"</code> für den Rollgang auf.',
  learn:'Ein FB speichert seine Ausgänge in der Instanz.',
  take:'Ein <b>FB</b> hat eine <b>Instanz</b> (Instanz-DB). Ausgänge und Static-Variablen bleiben darin von Zyklus zu Zyklus erhalten — darum funktioniert die Selbsthaltung.',
  man:'fb', must:['KLAMMER', 'UN'],
  hint:'Die Selbsthaltung aus Kapitel 3 — mit # vor den Namen.',
  blocks:[
    { name:'FB_Antrieb', kind:'FB', edit:true, start: aFB('FB_Antrieb', ANT_D, ''), ref: ANT_FB },
    { name:'Main', kind:'OB', src: MAIN(CALL_ANT('FB_Antrieb_DB', 'S_Start', 'S_Stopp', 'Rollgang')) }
  ],
  globals:{ S_Start:false, S_Stopp:false, Rollgang:false },
  unit:[{ block:'FB_Antrieb', steps:[[0.1, { Start:true, Stopp:false }, { Laeuft:true }], [0.1, { Start:false }, { Laeuft:true }], [0.1, { Stopp:true }, { Laeuft:false }], [0.1, { Stopp:false }, { Laeuft:false }]] }],
  timed: seq([[0.1, { S_Start:true }, { Rollgang:true }], [0.1, { S_Start:false }, { Rollgang:true }], [0.1, { S_Stopp:true }, { Rollgang:false }]]),
  bind:['conveyorRunning=Rollgang'] });

const ST_D = { in:'Fehler:Bool; Quittieren:Bool', out:'Meldung:Bool' };
defAwlPro({ id:'ap12_stoerung', ch:12, title:'Der Störspeicher als FB',
  story:'Jedes Gerüst bekommt einen Störspeicher: Ein Fehler wird gespeichert und bleibt, bis quittiert wird — aber nur, wenn der Fehler weg ist.',
  brief:'<code>FB_Stoerung</code>: <code>U #Quittieren</code> → <code>R #Meldung</code>, danach <code>U #Fehler</code> → <code>S #Meldung</code> (Setzen dominant).',
  learn:'S und R im FB.',
  take:'Im FB darf ein Ausgang mit S und R geschrieben werden: Die Instanz merkt sich den Wert. Die Reihenfolge bestimmt wie immer den Vorrang.',
  man:'fb', must:['S', 'R'],
  hint:'Erst Rücksetzen, dann Setzen.',
  blocks:[
    { name:'FB_Stoerung', kind:'FB', edit:true, start: aFB('FB_Stoerung', ST_D, ''), ref: aFB('FB_Stoerung', ST_D, 'U  #Quittieren\nR  #Meldung\nU  #Fehler\nS  #Meldung') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Stoerung", "FB_Stoerung_DB"\n   Fehler := "Druck_tief"\n   Quittieren := "Quittieren"\n   Meldung => "Lampe_Rot"') }
  ],
  globals:{ Druck_tief:false, Quittieren:false, Lampe_Rot:false },
  unit:[{ block:'FB_Stoerung', steps:[[0.1, { Fehler:true, Quittieren:false }, { Meldung:true }], [0.1, { Fehler:false }, { Meldung:true }], [0.1, { Fehler:true, Quittieren:true }, { Meldung:true }], [0.1, { Fehler:false }, { Meldung:false }]] }],
  timed: seq([[0.1, { Druck_tief:true }, { Lampe_Rot:true }], [0.1, { Druck_tief:false }, { Lampe_Rot:true }], [0.1, { Quittieren:true }, { Lampe_Rot:false }]]),
  bind:['lightRed=Lampe_Rot'] });

const INST_MAIN = 'NETWORK Rollgang\n' + CALL_ANT('Rollgang_DB', 'S_Rollgang_Ein', 'S_Rollgang_Aus', 'Rollgang') + '\n\nNETWORK Pumpe\n' + CALL_ANT('Pumpe_DB', 'S_Pumpe_Ein', 'S_Pumpe_Aus', 'Pumpe');
const INST_G = { S_Rollgang_Ein:false, S_Rollgang_Aus:false, S_Pumpe_Ein:false, S_Pumpe_Aus:false, Rollgang:false, Pumpe:false };
const INST_T = seq([[0.1, { S_Rollgang_Ein:true }, { Rollgang:true, Pumpe:false }], [0.1, { S_Rollgang_Ein:false, S_Pumpe_Ein:true }, { Rollgang:true, Pumpe:true }], [0.1, { S_Pumpe_Ein:false, S_Rollgang_Aus:true }, { Rollgang:false, Pumpe:true }], [0.1, { S_Rollgang_Aus:false }, { Rollgang:false, Pumpe:true }]]);
defAwlPro({ id:'ap12_instanzen', ch:12, title:'Zwei Antriebe, zwei Instanzen',
  story:'Rollgang und Hydraulikpumpe haben dieselbe Ein/Aus-Logik. Beide nutzen <code>FB_Antrieb</code> — jeder mit seinem eigenen Gedächtnis.',
  brief:'Rufe <code>"FB_Antrieb"</code> zweimal auf:<br><b>Rollgang:</b> Instanz <code>"Rollgang_DB"</code>, Taster Ein und Taster Aus des Rollgangs → Ausgang Rollgang<br><b>Pumpe:</b> Instanz <code>"Pumpe_DB"</code>, Taster Ein und Taster Aus der Pumpe → Ausgang Pumpe',
  learn:'Pro Gerät eine eigene Instanz.',
  take:'Jeder Aufruf eines FB braucht seine <b>eigene Instanz</b>: <code>CALL "FB_Antrieb", "Rollgang_DB"</code>. Sonst teilen sich zwei Geräte ein Gedächtnis.',
  man:'fb', must:['CALL', 'SINGLE'],
  hint:'CALL "FB_Antrieb", "Rollgang_DB" und CALL "FB_Antrieb", "Pumpe_DB".',
  blocks:[ { name:'FB_Antrieb', kind:'FB', src: ANT_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(INST_MAIN) } ],
  globals: INST_G, instances:{ Rollgang_DB:'FB_Antrieb', Pumpe_DB:'FB_Antrieb' }, timed: INST_T,
  bind:['conveyorRunning=Rollgang', 'pumpRunning=Pumpe'] });

const ZL_D = { in:'Block:Bool; Reset:Bool', out:'Anzahl:Int', stat:'M_Flanke:Bool|Flankenmerker' };
const ZL_BODY = 'U  #Reset\nSPBN ZAEH\nL  0\nT  #Anzahl\nZAEH: U  #Block\nFP #M_Flanke\nSPBN ENDE\nL  #Anzahl\nINC 1\nT  #Anzahl\nENDE: NOP 0';
defAwlPro({ id:'ap12_flanke', ch:12, title:'Der Zählbaustein',
  story:'Ein eigener Zähler als FB: Er zählt jeden Block und kann zurückgesetzt werden. Den Flankenmerker legst du als <b>Static</b> an — so hat jede Instanz ihren eigenen.',
  brief:'<code>FB_Zaehler</code> (Static <code>M_Flanke</code>):<br><code>U #Reset</code> · <code>SPBN ZAEH</code> · <code>L 0</code> · <code>T #Anzahl</code><br><code>ZAEH: U #Block</code> · <code>FP #M_Flanke</code> · <code>SPBN ENDE</code> · <code>L #Anzahl</code> · <code>INC 1</code> · <code>T #Anzahl</code><br><code>ENDE: NOP 0</code>',
  learn:'Flankenmerker als Static im FB.',
  take:'Der Flankenmerker muss den alten Zustand <b>über den Aufruf hinaus</b> behalten — also Static. Als Temp würde er jeden Zyklus vergessen.',
  man:'fb', must:['FP', 'STAT', 'INC'],
  hint:'Zwei Abschnitte: Rücksetzen mit Sprung, Zählen mit Flanke und Sprung.',
  blocks:[
    { name:'FB_Zaehler', kind:'FB', edit:true, start: aFB('FB_Zaehler', ZL_D, ''), ref: aFB('FB_Zaehler', ZL_D, ZL_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Zaehler", "FB_Zaehler_DB"\n   Block := "Block_raus"\n   Reset := "S_Reset"\n   Anzahl => "Stueck"') }
  ],
  globals:{ Block_raus:false, S_Reset:false, Stueck:0 },
  unit:[{ block:'FB_Zaehler', steps:[[0.1, { Block:true, Reset:false }, { Anzahl:1 }], [0.1, {}, { Anzahl:1 }], [0.1, { Block:false }, { Anzahl:1 }], [0.1, { Block:true }, { Anzahl:2 }], [0.1, { Block:false, Reset:true }, { Anzahl:0 }]] }],
  timed: seq([[0.1, { Block_raus:true }, { Stueck:1 }], [0.1, { Block_raus:false }, { Stueck:1 }], [0.1, { Block_raus:true }, { Stueck:2 }]]),
  bind:['billetVisible=Block_raus', 'pieceCount=Stueck'] });

defAwlPro({ id:'ap12_instanz_dbg', ch:12, title:'Eine Instanz für zwei', debug:true, warnFree:['INSTANCE_TWICE'],
  story:'Schaltet man den Rollgang aus, geht auch die Pumpe aus — und umgekehrt. ARIA hat beiden Aufrufen <b>dieselbe</b> Instanz gegeben. Der Compiler warnt.',
  brief:'Die Pumpe braucht ihre eigene Instanz <code>"Pumpe_DB"</code>.',
  learn:'Instanzen nicht doppelt verwenden.',
  take:'Zwei Aufrufe mit derselben Instanz teilen sich das Gedächtnis: Die Selbsthaltung des einen wird vom anderen überschrieben (Warnung <b>INSTANCE_TWICE</b>).',
  man:'fb', must:['CALL'],
  hint:'Im zweiten CALL: "Rollgang_DB" → "Pumpe_DB".',
  blocks:[ { name:'FB_Antrieb', kind:'FB', src: ANT_FB }, { name:'Main', kind:'OB', edit:true, start: MAIN(INST_MAIN.replace('"FB_Antrieb", "Pumpe_DB"', '"FB_Antrieb", "Rollgang_DB"')), ref: MAIN(INST_MAIN) } ],
  globals: INST_G, instances:{ Rollgang_DB:'FB_Antrieb', Pumpe_DB:'FB_Antrieb' }, timed: INST_T,
  bind:['conveyorRunning=Rollgang', 'pumpRunning=Pumpe'] });

const KU_D = { in:'Walzen:Bool', out:'Wasser:Bool', stat:'T_Nachlauf:TOF' };
const KU_BODY = 'CALL #T_Nachlauf\n   IN := #Walzen\n   PT := T#5S\n   Q => #Wasser';
defAwlPro({ id:'ap12_timer', ch:12, title:'Die IEC-Zeit im Baustein',
  story:'Im Baustein gibt es keine S5-Zeiten T1, T2 … mehr. Herr Brunner zeigt dir die modernere Art: eine <b>IEC-Zeit</b> als Static-Variable — eine Multiinstanz.',
  brief:'<code>FB_Kuehlung</code> (Static <code>T_Nachlauf : TOF</code>):<br><code>CALL #T_Nachlauf</code> mit <code>IN := #Walzen</code>, <code>PT := T#5S</code>, <code>Q => #Wasser</code>',
  learn:'IEC-Zeiten als Multiinstanz aufrufen.',
  take:'Eine IEC-Zeit (TON, TOF, TP) ist selbst ein kleiner FB. Als Static im eigenen FB liegt ihr Gedächtnis in dessen Instanz — eine <b>Multiinstanz</b>, aufgerufen mit <code>CALL #Name</code>.',
  man:'multiinstanz', must:['CALL', 'TOF'],
  hint:'CALL #T_Nachlauf und drei Parameterzeilen.',
  blocks:[
    { name:'FB_Kuehlung', kind:'FB', edit:true, start: aFB('FB_Kuehlung', KU_D, ''), ref: aFB('FB_Kuehlung', KU_D, KU_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Kuehlung", "FB_Kuehlung_DB"\n   Walzen := "Walzen"\n   Wasser => "Kuehlung"') }
  ],
  globals:{ Walzen:false, Kuehlung:false },
  timed: seq([[0, { Walzen:true }, { Kuehlung:true }], [1, { Walzen:false }, { Kuehlung:true }], [4, {}, { Kuehlung:true }], [1.1, {}, { Kuehlung:false }]]),
  bind:['rollsRunning=Walzen', 'coolingOn=Kuehlung'] });

const UE_D = { in:'Laeuft:Bool; Rueckmeldung:Bool; Quittieren:Bool', out:'Stoerung:Bool', stat:'T_Ueberw:TON', temp:'Fehlt:Bool' };
const UE_BODY = 'NETWORK Rueckmeldung fehlt\nU  #Laeuft\nUN #Rueckmeldung\n=  #Fehlt\nCALL #T_Ueberw\n   IN := #Fehlt\n   PT := T#3S\n\nNETWORK Stoerung\nU  #Quittieren\nR  #Stoerung\nU  #T_Ueberw.Q\nS  #Stoerung';
defAwlPro({ id:'ap12_ueberwachung', ch:12, title:'Die Rückmeldung fehlt',
  story:'Das Schütz des Rollgangs meldet sich über einen Hilfskontakt zurück. Kommt 3 Sekunden nach dem Einschalten keine Rückmeldung, ist der Motor defekt — dann wird eine Störung gespeichert.',
  brief:'<code>FB_Ueberwachung</code> (Static <code>T_Ueberw : TON</code>, Temp <code>Fehlt</code>):<br><b>NW 1:</b> <code>#Fehlt</code> = <code>#Laeuft</code> UND NICHT <code>#Rueckmeldung</code>; <code>CALL #T_Ueberw</code> mit <code>IN := #Fehlt</code>, <code>PT := T#3S</code><br><b>NW 2:</b> <code>U #Quittieren</code> → <code>R #Stoerung</code>, <code>U #T_Ueberw.Q</code> → <code>S #Stoerung</code>',
  learn:'Ausgang einer Multiinstanz abfragen.',
  take:'Den Ausgang einer IEC-Zeit fragst du direkt aus der Multiinstanz ab: <code>U #T_Ueberw.Q</code>. Den Parameter <code>Q =></code> brauchst du dann beim Aufruf nicht.',
  man:'multiinstanz', must:['TON', 'S', 'R', 'TEMP'],
  hint:'Die Zeitabfrage heisst U #T_Ueberw.Q.',
  blocks:[
    { name:'FB_Ueberwachung', kind:'FB', edit:true, start: aFB('FB_Ueberwachung', UE_D, ''), ref: aFB('FB_Ueberwachung', UE_D, UE_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Ueberwachung", "FB_Ueberwachung_DB"\n   Laeuft := "Rollgang"\n   Rueckmeldung := "Schuetz_RM"\n   Quittieren := "Quittieren"\n   Stoerung => "Stoerung"') }
  ],
  globals:{ Rollgang:false, Schuetz_RM:false, Quittieren:false, Stoerung:false },
  timed: seq([[0, { Rollgang:true }, { Stoerung:false }], [0.5, { Schuetz_RM:true }, { Stoerung:false }], [5, {}, { Stoerung:false }], [0.1, { Schuetz_RM:false }, { Stoerung:false }], [3.1, {}, { Stoerung:true }], [0.1, { Rollgang:false, Quittieren:true }, { Stoerung:false }]]),
  bind:['conveyorRunning=Rollgang', 'faultActive=Stoerung'] });

const STR_D = { in:'S_Rollgang_Ein:Bool; S_Rollgang_Aus:Bool; S_Walzen_Ein:Bool; S_Walzen_Aus:Bool', out:'Rollgang:Bool; Walzen:Bool', stat:'Ant_Rollgang:"FB_Antrieb"; Ant_Walzen:"FB_Antrieb"' };
const STR_BODY = 'NETWORK Rollgang\nCALL #Ant_Rollgang\n   Start := #S_Rollgang_Ein\n   Stopp := #S_Rollgang_Aus\n   Laeuft => #Rollgang\n\nNETWORK Walzen\nCALL #Ant_Walzen\n   Start := #S_Walzen_Ein\n   Stopp := #S_Walzen_Aus\n   Laeuft => #Walzen';
defAwlPro({ id:'ap12_multi', ch:12, title:'Bausteine im Baustein',
  story:'Die Walzstrasse bekommt einen eigenen FB, in dem Rollgang und Walzen als <b>Multiinstanzen</b> von <code>FB_Antrieb</code> stecken. So braucht die ganze Strasse nur einen Instanz-DB.',
  brief:'<code>FB_Strasse</code> (Static <code>Ant_Rollgang</code>, <code>Ant_Walzen</code> : <code>"FB_Antrieb"</code>):<br><code>CALL #Ant_Rollgang</code> (Start := <code>#S_Rollgang_Ein</code>, Stopp := <code>#S_Rollgang_Aus</code>, Laeuft => <code>#Rollgang</code>)<br><code>CALL #Ant_Walzen</code> (Start := <code>#S_Walzen_Ein</code>, Stopp := <code>#S_Walzen_Aus</code>, Laeuft => <code>#Walzen</code>)',
  learn:'Eigene FBs als Multiinstanz.',
  take:'Ein FB kann andere FBs als Static enthalten. Aufgerufen werden sie mit <code>CALL #Name</code> — ohne eigenen Instanz-DB. Alle Daten liegen im DB des äusseren FB.',
  man:'multiinstanz', must:['MULTI', 'CALL'],
  hint:'Zwei CALL #… mit je drei Parametern.',
  blocks:[ { name:'FB_Antrieb', kind:'FB', src: ANT_FB },
    { name:'FB_Strasse', kind:'FB', edit:true, start: aFB('FB_Strasse', STR_D, ''), ref: aFB('FB_Strasse', STR_D, STR_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Strasse", "FB_Strasse_DB"\n   S_Rollgang_Ein := "S1"\n   S_Rollgang_Aus := "S2"\n   S_Walzen_Ein := "S3"\n   S_Walzen_Aus := "S4"\n   Rollgang => "Rollgang"\n   Walzen => "Walzen"') } ],
  globals:{ S1:false, S2:false, S3:false, S4:false, Rollgang:false, Walzen:false },
  timed: seq([[0.1, { S1:true }, { Rollgang:true, Walzen:false }], [0.1, { S1:false, S3:true }, { Rollgang:true, Walzen:true }], [0.1, { S3:false, S2:true }, { Rollgang:false, Walzen:true }], [0.1, { S2:false, S4:true }, { Walzen:false }]]),
  bind:['conveyorRunning=Rollgang', 'rollsRunning=Walzen'] });

const T2_D = { in:'Pumpe:Bool; Walzen:Bool', out:'Druck_da:Bool; Wasser:Bool', stat:'T_Druck:TON; T_Kuehl:TOF' };
defAwlPro({ id:'ap12_timer_dbg', ch:12, title:'Eine Zeit für alles', debug:true,
  story:'Der Hydraulikdruck meldet sich nie, und das Kühlwasser verhält sich seltsam. ARIA hat beide Aufrufe auf <b>dieselbe</b> Zeit-Instanz gelegt — dabei sind zwei deklariert.',
  brief:'Der zweite Aufruf gehört zu <code>#T_Kuehl</code>.',
  learn:'Jede Zeit braucht ihre eigene Instanz.',
  take:'Eine IEC-Zeit misst genau eine Zeit. Zweimal pro Zyklus aufgerufen (mit verschiedenen Eingängen) läuft sie nie sauber ab.',
  man:'multiinstanz', must:['TON', 'TOF'],
  hint:'CALL #T_Druck → CALL #T_Kuehl beim zweiten Aufruf.',
  blocks:[
    { name:'FB_Hydraulik', kind:'FB', edit:true,
      start: aFB('FB_Hydraulik', T2_D, 'CALL #T_Druck\n   IN := #Pumpe\n   PT := T#2S\n   Q => #Druck_da\nCALL #T_Druck\n   IN := #Walzen\n   PT := T#4S\n   Q => #Wasser'),
      ref: aFB('FB_Hydraulik', T2_D, 'CALL #T_Druck\n   IN := #Pumpe\n   PT := T#2S\n   Q => #Druck_da\nCALL #T_Kuehl\n   IN := #Walzen\n   PT := T#4S\n   Q => #Wasser') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FB_Hydraulik", "FB_Hydraulik_DB"\n   Pumpe := "Pumpe"\n   Walzen := "Walzen"\n   Druck_da => "Druck_da"\n   Wasser => "Kuehlung"') }
  ],
  globals:{ Pumpe:false, Walzen:false, Druck_da:false, Kuehlung:false },
  timed: seq([[0, { Pumpe:true }, { Druck_da:false }], [2.1, {}, { Druck_da:true, Kuehlung:false }], [0.1, { Walzen:true }, { Kuehlung:true }], [0.1, { Walzen:false }, { Kuehlung:true, Druck_da:true }], [4.1, {}, { Kuehlung:false }]]),
  bind:['pumpRunning=Pumpe', 'coolingOn=Kuehlung'] });

const GB_D = { in:'Start:Bool; Stopp:Bool; Oeldruck_OK:Bool; Quittieren:Bool', out:'Pumpe:Bool; Walzen:Bool; Stoerung:Bool', stat:'T_Anlauf:TON' };
const GB_BODY = 'NETWORK Pumpe\nU(\nO  #Start\nO  #Pumpe\n)\nUN #Stopp\nUN #Stoerung\n=  #Pumpe\n\nNETWORK Anlaufzeit\nCALL #T_Anlauf\n   IN := #Pumpe\n   PT := T#2S\n\nNETWORK Stoerung\nU  #Quittieren\nR  #Stoerung\nU  #T_Anlauf.Q\nUN #Oeldruck_OK\nS  #Stoerung\n\nNETWORK Walzen\nU  #T_Anlauf.Q\nU  #Oeldruck_OK\nUN #Stoerung\n=  #Walzen';
defAwlPro({ id:'ap12_boss', ch:12, title:'Boss: Der Gerüstbaustein', boss:true,
  story:'ARIA sabotiert den Anlauf des Gerüsts. Herr Brunner fasst den alten FB zusammen: „Pumpe mit Selbsthaltung. Nach 2 Sekunden Anlaufzeit muss Öldruck da sein — sonst Störung. Walzen erst nach der Anlaufzeit, mit Druck und ohne Störung. Eine Störung stoppt auch die Pumpe.“',
  brief:'<code>FB_Geruest</code> (Static <code>T_Anlauf : TON</code>):<br><b>NW 1:</b> <code>#Pumpe</code> = (<code>#Start</code> ODER <code>#Pumpe</code>) UND NICHT <code>#Stopp</code> UND NICHT <code>#Stoerung</code><br><b>NW 2:</b> <code>CALL #T_Anlauf</code> (IN := <code>#Pumpe</code>, PT := <code>T#2S</code>)<br><b>NW 3:</b> <code>U #Quittieren</code> → <code>R #Stoerung</code>; <code>U #T_Anlauf.Q</code>, <code>UN #Oeldruck_OK</code> → <code>S #Stoerung</code><br><b>NW 4:</b> <code>#Walzen</code> = <code>#T_Anlauf.Q</code> UND <code>#Oeldruck_OK</code> UND NICHT <code>#Stoerung</code><br><b>Main:</b> <code>CALL "FB_Geruest", "FB_Geruest_DB"</code>: Start und Stopp mit den beiden Tastern, Oeldruck_OK mit der Öldruck-Meldung, Quittieren mit der Quittiertaste; die Ausgänge Pumpe, Walzen und Stoerung auf die passenden Anlagenausgänge und die Störmeldung.',
  learn:'Ein FB mit Selbsthaltung, IEC-Zeit, Störspeicher und Freigabe.',
  take:'Ein guter FB kapselt ein ganzes Gerät: Befehle, Anlaufzeit, Überwachung, Störung. Der Aufrufer sieht nur die Schnittstelle.',
  man:'fb', must:['TON', 'CALL', 'SINGLE', 'S', 'R'],
  hint:'Vier Netzwerke im FB; die Anlaufzeit fragst du mit U #T_Anlauf.Q ab.',
  hint2:'Die Pumpe fragt #Stoerung schon im ersten Netzwerk ab — gespeichert ist sie aus dem letzten Zyklus.',
  blocks:[
    { name:'FB_Geruest', kind:'FB', edit:true, start: aFB('FB_Geruest', GB_D, ''), ref: aFB('FB_Geruest', GB_D, GB_BODY) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('CALL "FB_Geruest", "FB_Geruest_DB"\n   Start := "S_Start"\n   Stopp := "S_Stopp"\n   Oeldruck_OK := "Druck_OK"\n   Quittieren := "Quittieren"\n   Pumpe => "Pumpe"\n   Walzen => "Walzen"\n   Stoerung => "Stoerung"') }
  ],
  globals:{ S_Start:false, S_Stopp:false, Druck_OK:false, Quittieren:false, Pumpe:false, Walzen:false, Stoerung:false },
  timed: seq([[0, { S_Start:true }, { Pumpe:true, Walzen:false }], [0.1, { S_Start:false, Druck_OK:true }, { Pumpe:true, Walzen:false }], [2, {}, { Walzen:true, Stoerung:false }], [0.1, { Druck_OK:false }, { Walzen:false, Stoerung:true }], [0.1, {}, { Pumpe:false }], [0.1, { Quittieren:true, Druck_OK:true }, { Stoerung:false }], [0.1, { Quittieren:false, S_Start:true }, { Pumpe:true }], [0.1, { S_Start:false, S_Stopp:true }, { Pumpe:false, Walzen:false }]]),
  bind:['pumpRunning=Pumpe', 'rollsRunning=Walzen', 'faultActive=Stoerung'] });
})();
