/* ===== KAPITEL 13 — Bausteine mit Gedächtnis: FB, Instanzen, Multiinstanzen — Profi-Stufe ===== */
(function(){
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';

const FLANKE_REF = 'FUNCTION_BLOCK "FB_Flanke"\nVAR_INPUT\n   Signal : Bool;\nEND_VAR\nVAR_OUTPUT\n   Flanke : Bool;   // TRUE für genau einen Zyklus\nEND_VAR\nVAR\n   Merker : Bool;   // Signal aus dem letzten Zyklus\nEND_VAR\nBEGIN\n   #Flanke := #Signal AND NOT #Merker;\n   #Merker := #Signal;\nEND_FUNCTION_BLOCK';
const MOTOR_REF = 'FUNCTION_BLOCK "FB_Motor"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Freigabe : Bool;   // z.B. Schutztür zu\nEND_VAR\nVAR_OUTPUT\n   Lauf : Bool;\nEND_VAR\nBEGIN\n   #Lauf := (#Start OR #Lauf) AND NOT #Stopp AND #Freigabe;\nEND_FUNCTION_BLOCK';

/* ---------- 121 ---------- */
defProTask({ id:'p13_erster_fb', ch:13, title:'Der erste Funktionsbaustein',
  story:'ARIA hat alle Motoren der Halle an eine einzige Instanz gehängt. Bevor du das entwirrst, baust du dir das wichtigste Werkzeug mit Gedächtnis: eine Flankenerkennung — so wie R_TRIG, nur selbst geschrieben.',
  brief:'Schreibe <code>FB_Flanke</code>:<br>• Ergänze unter <code>VAR</code> die statische Variable <code>Merker : Bool;</code><br>• Code: <code>Flanke</code> ist TRUE, wenn <code>Signal</code> jetzt TRUE ist <b>und im letzten Zyklus FALSE war</b>; danach <code>Merker</code> auf den aktuellen Wert setzen<br><code>Main</code> (🔒) zählt mit deiner Flanke die Tastendrücke und zeigt die Anzahl an.',
  learn:'Einen FB mit statischer Variable (Gedächtnis) schreiben.',
  take:'Ein FB merkt sich seine statischen Variablen im Instanz-DB — von Aufruf zu Aufruf. Genau so funktionieren R_TRIG, TON und CTU intern.',
  man:'fb', must:['FB','STAT'], warnFree:['TEMP_READ_BEFORE_WRITE'],
  hint:'Zwei Zeilen: <code>#Flanke := #Signal AND NOT #Merker;</code> und danach <code>#Merker := #Signal;</code> — die Reihenfolge ist entscheidend!',
  blocks:[
    { name:'FB_Flanke', kind:'FB', edit:true, start:'FUNCTION_BLOCK "FB_Flanke"\nVAR_INPUT\n   Signal : Bool;\nEND_VAR\nVAR_OUTPUT\n   Flanke : Bool;   // TRUE für genau einen Zyklus\nEND_VAR\nVAR\n   // TODO: Merker\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK', ref: FLANKE_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Flanke_DB"(Signal := "Taster", Flanke => "Impuls");\n   IF "Impuls" THEN\n      "Zaehler" := "Zaehler" + 1;\n   END_IF;') }
  ],
  globals:{ Taster:false, Impuls:false, Zaehler:0 },
  unit:[{ block:'FB_Flanke', steps:[[{Signal:true},{Flanke:true}],[{Signal:true},{Flanke:false}],[{Signal:false},{Flanke:false}],[{Signal:true},{Flanke:true}]] }],
  timed:[{ steps:[[0.1,{Taster:true},{Zaehler:1}],[0.1,{},{Zaehler:1}],[0.1,{},{Zaehler:1}],[0.1,{Taster:false},{Zaehler:1}],[0.1,{Taster:true},{Zaehler:2}]] }],
  bind:['displayValue=Zaehler','displayLabel:"DRÜCKE"','lightYellow=Taster'],
  wrong:[{ FB_Flanke: FLANKE_REF.replace('   #Flanke := #Signal AND NOT #Merker;\n   #Merker := #Signal;', '   #Merker := #Signal;\n   #Flanke := #Signal AND NOT #Merker;') }]
});

/* ---------- 122 ---------- */
defProTask({ id:'p13_instanz', ch:13, title:'Instanzen aufrufen',
  story:'Das HMI hat zwei Taster: Plus und Minus für den Sollwert. Jeder Taster braucht seine eigene Flankenerkennung — also sein eigenes Gedächtnis.',
  brief:'<code>FB_Flanke</code> ist fertig (🔒). Im Projekt gibt es zwei Instanz-DBs: <code>"Flanke_Plus"</code> und <code>"Flanke_Minus"</code>. Schreibe <code>Main</code>:<br>• Rufe <code>"Flanke_Plus"</code> mit dem Plus-Taster des HMI (Eingang <code>Signal</code>) und <code>"Flanke_Minus"</code> mit dem Minus-Taster auf<br>• Lies die Ausgänge über den Instanz-DB: <code>"Flanke_Plus".Flanke</code><br>• Pro Tastendruck den Sollwert des HMI um 1 erhöhen bzw. verringern',
  learn:'Einen FB über Instanz-DBs aufrufen und seine Ausgänge lesen.',
  take:'Jeder Aufruf eines FB braucht eine Instanz — sein Gedächtnis. Zwei Taster = zwei Instanzen. Die Ausgänge kannst du jederzeit über <code>"Instanz".Ausgang</code> lesen.',
  man:'fb', must:['SINGLE','MEMBER'], warnFree:['INSTANCE_TWICE'],
  hint:'Zwei Aufrufe mit verschiedenen Instanzen, danach zwei IFs, die <code>"Flanke_Plus".Flanke</code> und <code>"Flanke_Minus".Flanke</code> abfragen.',
  blocks:[
    { name:'FB_Flanke', kind:'FB', src: FLANKE_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // zwei Instanzen, zwei Taster\n'),
      ref: MAIN('   "Flanke_Plus"(Signal := "Taster_Plus");\n   "Flanke_Minus"(Signal := "Taster_Minus");\n   IF "Flanke_Plus".Flanke THEN\n      "Sollwert" := "Sollwert" + 1;\n   END_IF;\n   IF "Flanke_Minus".Flanke THEN\n      "Sollwert" := "Sollwert" - 1;\n   END_IF;') }
  ],
  instances:{ Flanke_Plus:'FB_Flanke', Flanke_Minus:'FB_Flanke' },
  globals:{ Taster_Plus:false, Taster_Minus:false, Sollwert:50 },
  timed:[{ steps:[[0.1,{Taster_Plus:true},{Sollwert:51}],[0.1,{},{Sollwert:51}],[0.1,{Taster_Plus:false},{}],[0.1,{Taster_Plus:true},{Sollwert:52}],[0.1,{Taster_Plus:false, Taster_Minus:true},{Sollwert:51}],[0.1,{},{Sollwert:51}],[0.1,{Taster_Minus:false},{}],[0.1,{Taster_Plus:true, Taster_Minus:true},{Sollwert:51}]] }],
  bind:['displayValue=Sollwert','displayLabel:"SOLL"','lightGreen=Taster_Plus','lightYellow=Taster_Minus'],
  wrong:[{ Main: MAIN('   "Flanke_Plus"(Signal := "Taster_Plus");\n   IF "Flanke_Plus".Flanke THEN\n      "Sollwert" := "Sollwert" + 1;\n   END_IF;\n   "Flanke_Plus"(Signal := "Taster_Minus");\n   IF "Flanke_Plus".Flanke THEN\n      "Sollwert" := "Sollwert" - 1;\n   END_IF;') }]
});

/* ---------- 123 ---------- */
defProTask({ id:'p13_motor', ch:13, title:'Der Motor-Baustein',
  story:'In Kapitel 2 hast du die Selbsthaltung für das Band geschrieben. Die Halle hat aber zwölf Bänder. "Schreib es einmal als FB", sagt der Werkmeister, "und jedes Band bekommt eine Instanz."',
  brief:'Schreibe <code>FB_Motor</code> komplett:<br>• Eingänge <code>Start</code>, <code>Stopp</code>, <code>Freigabe</code> (Bool), Ausgang <code>Lauf</code> (Bool)<br>• <code>Lauf</code> hält sich selbst (Selbsthaltung), <code>Stopp</code> oder fehlende <code>Freigabe</code> schalten ab<br><code>Main</code> (🔒) ruft deinen FB über den Instanz-DB <code>"Band1_DB"</code> auf.',
  learn:'Bekannte Logik (Selbsthaltung) in einen wiederverwendbaren FB überführen.',
  take:'Auch Ausgänge eines FB liegen im Instanz-DB und behalten ihren Wert. Deshalb funktioniert <code>#Lauf := (#Start OR #Lauf) AND …</code> im FB ohne zusätzliche Variable.',
  man:'fb', must:['FB','VAR_INPUT','VAR_OUTPUT'],
  hint:'Die Formel kennst du aus Kapitel 2: <code>(Start OR Lauf) AND NOT Stopp</code> — jetzt noch <code>AND #Freigabe</code>.',
  blocks:[
    { name:'FB_Motor', kind:'FB', edit:true, start:'FUNCTION_BLOCK "FB_Motor"\n// Eingänge: Start, Stopp, Freigabe — Ausgang: Lauf\n\nBEGIN\n\nEND_FUNCTION_BLOCK', ref: MOTOR_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Band1_DB"(Start := "S_Start", Stopp := "S_Stopp", Freigabe := "Schutztuer_zu", Lauf => "Band1_Lauf");') }
  ],
  instances:{ Band1_DB:'FB_Motor' },
  globals:{ S_Start:false, S_Stopp:false, Schutztuer_zu:true, Band1_Lauf:false },
  timed:[{ steps:[[0.1,{S_Start:true},{Band1_Lauf:true}],[0.1,{S_Start:false},{Band1_Lauf:true}],[0.1,{S_Stopp:true},{Band1_Lauf:false}],[0.1,{S_Stopp:false},{Band1_Lauf:false}],[0.1,{S_Start:true},{Band1_Lauf:true}],[0.1,{S_Start:false, Schutztuer_zu:false},{Band1_Lauf:false}],[0.1,{Schutztuer_zu:true},{Band1_Lauf:false}]] }],
  unit:[{ block:'FB_Motor', steps:[[{Start:true, Freigabe:true},{Lauf:true}],[{Start:false},{Lauf:true}],[{Stopp:true},{Lauf:false}]] }],
  bind:['beltRunning=Band1_Lauf','lightGreen=Band1_Lauf','lightYellow=S_Start'],
  wrong:[{ FB_Motor:'FUNCTION_BLOCK "FB_Motor"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Freigabe : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lauf : Bool;\nEND_VAR\nBEGIN\n   #Lauf := #Start AND NOT #Stopp AND #Freigabe;\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 124 ---------- */
defProTask({ id:'p13_eine_instanz_dbg', ch:13, title:'Zwei Motoren, eine Instanz', debug:true,
  story:'Drückt jemand Start an Band 1, läuft Band 2 gleich mit — und umgekehrt. ARIA: "Warum zwei Gedächtnisse verschwenden, wenn eins reicht?"',
  brief:'<code>Main</code> steuert zwei Bänder mit <code>FB_Motor</code> (🔒). Für Band 2 gibt es bereits den Instanz-DB <code>"Band2_DB"</code>. Finde den Fehler — die gelbe <b>Warnung</b> hilft dir.',
  learn:'Jedes Gerät braucht seine eigene Instanz.',
  take:'Eine Instanz = ein Gedächtnis = <b>ein</b> Gerät. Rufen zwei Stellen dieselbe Instanz auf, überschreiben sie sich gegenseitig die statischen Daten — ein klassischer, schwer zu findender Fehler.',
  man:'fb', warnFree:['INSTANCE_TWICE'],
  hint:'Welcher Instanz-DB wird im zweiten Aufruf verwendet?',
  blocks:[
    { name:'FB_Motor', kind:'FB', src: MOTOR_REF },
    { name:'Main', kind:'OB', edit:true,
      start: MAIN('   "Band1_DB"(Start := "S_Start1", Stopp := "S_Stopp", Freigabe := TRUE, Lauf => "Band1_Lauf");\n   "Band1_DB"(Start := "S_Start2", Stopp := "S_Stopp", Freigabe := TRUE, Lauf => "Band2_Lauf");'),
      ref: MAIN('   "Band1_DB"(Start := "S_Start1", Stopp := "S_Stopp", Freigabe := TRUE, Lauf => "Band1_Lauf");\n   "Band2_DB"(Start := "S_Start2", Stopp := "S_Stopp", Freigabe := TRUE, Lauf => "Band2_Lauf");') }
  ],
  instances:{ Band1_DB:'FB_Motor', Band2_DB:'FB_Motor' },
  globals:{ S_Start1:false, S_Start2:false, S_Stopp:false, Band1_Lauf:false, Band2_Lauf:false },
  timed:[{ steps:[[0.1,{S_Start1:true},{Band1_Lauf:true, Band2_Lauf:false}],[0.1,{S_Start1:false},{Band1_Lauf:true, Band2_Lauf:false}],[0.1,{S_Start2:true},{Band1_Lauf:true, Band2_Lauf:true}],[0.1,{S_Start2:false},{Band1_Lauf:true, Band2_Lauf:true}],[0.1,{S_Stopp:true},{Band1_Lauf:false, Band2_Lauf:false}]] }],
  bind:['beltRunning=Band1_Lauf','belt2Running=Band2_Lauf']
});

/* ---------- 125 ---------- */
const ANL_HEAD = 'FUNCTION_BLOCK "FB_Anlage"\nVAR_INPUT\n   Start1 : Bool;\n   Start2 : Bool;\n   Stopp_Alle : Bool;\n   Freigabe : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lauf1 : Bool;\n   Lauf2 : Bool;\nEND_VAR\n';
defProTask({ id:'p13_multiinstanz', ch:13, title:'Multiinstanzen',
  story:'Für jedes Band einen eigenen Instanz-DB — bei zwölf Bändern wird der Projektbaum unübersichtlich. "Pack die Motoren in den Anlagen-Baustein", sagt der Werkmeister. "Dann trägt der Anlagen-FB das Gedächtnis seiner Geräte selbst."',
  brief:'Die Schnittstelle von <code>FB_Anlage</code> steht. Ergänze:<br>• unter <code>VAR</code> zwei <b>Multiinstanzen</b>: <code>Band1 : "FB_Motor";</code> und <code>Band2 : "FB_Motor";</code><br>• im Code die Aufrufe <code>#Band1(Start := #Start1, Stopp := #Stopp_Alle, Freigabe := #Freigabe, Lauf =&gt; #Lauf1);</code> und entsprechend <code>#Band2</code><br><code>Main</code> (🔒) ruft nur noch <code>"FB_Anlage_DB"</code> auf.',
  learn:'Multiinstanzen: FB-Instanzen als statische Variablen in einem übergeordneten FB.',
  take:'Eine Multiinstanz ist eine statische Variable vom Typ eines FB. Ihr Gedächtnis liegt im Instanz-DB des übergeordneten FB. So entsteht eine saubere Hierarchie: Anlage → Geräte.',
  man:'multiinstanz', must:['MULTI','FB_INSTANCE'],
  hint:'Aufruf einer Multiinstanz mit <code>#</code>: <code>#Band1(…);</code> — genau wie eine lokale Variable.',
  blocks:[
    { name:'FB_Motor', kind:'FB', src: MOTOR_REF },
    { name:'FB_Anlage', kind:'FB', edit:true, start: ANL_HEAD + 'VAR\n   // TODO: Band1 und Band2 vom Typ "FB_Motor"\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK',
      ref: ANL_HEAD + 'VAR\n   Band1 : "FB_Motor";\n   Band2 : "FB_Motor";\nEND_VAR\nBEGIN\n   #Band1(Start := #Start1, Stopp := #Stopp_Alle, Freigabe := #Freigabe, Lauf => #Lauf1);\n   #Band2(Start := #Start2, Stopp := #Stopp_Alle, Freigabe := #Freigabe, Lauf => #Lauf2);\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Anlage_DB"(Start1 := "S_Start1", Start2 := "S_Start2", Stopp_Alle := "S_Stopp", Freigabe := "Schutztuer_zu",\n                  Lauf1 => "Band1_Lauf", Lauf2 => "Band2_Lauf");') }
  ],
  globals:{ S_Start1:false, S_Start2:false, S_Stopp:false, Schutztuer_zu:true, Band1_Lauf:false, Band2_Lauf:false },
  timed:[{ steps:[[0.1,{S_Start2:true},{Band1_Lauf:false, Band2_Lauf:true}],[0.1,{S_Start2:false, S_Start1:true},{Band1_Lauf:true, Band2_Lauf:true}],[0.1,{S_Start1:false},{Band1_Lauf:true, Band2_Lauf:true}],[0.1,{Schutztuer_zu:false},{Band1_Lauf:false, Band2_Lauf:false}],[0.1,{Schutztuer_zu:true, S_Start1:true},{Band1_Lauf:true, Band2_Lauf:false}]] }],
  tests:[[{},{'FB_Anlage_DB.Band1.Lauf':false}]],
  bind:['beltRunning=Band1_Lauf','belt2Running=Band2_Lauf','lightGreen=Schutztuer_zu'],
  wrong:[{ FB_Anlage: ANL_HEAD + 'VAR\n   Band1 : "FB_Motor";\nEND_VAR\nBEGIN\n   #Band1(Start := #Start1, Stopp := #Stopp_Alle, Freigabe := #Freigabe, Lauf => #Lauf1);\n   #Band1(Start := #Start2, Stopp := #Stopp_Alle, Freigabe := #Freigabe, Lauf => #Lauf2);\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 126 ---------- */
const MU_HEAD = 'FUNCTION_BLOCK "FB_Motor_U"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Rueckmeldung : Bool;   // Schütz hat angezogen\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lauf : Bool;\n   Stoerung : Bool;\nEND_VAR\nVAR\n   Ueberwachung : TON;\nEND_VAR\n';
const MU_BODY = 'BEGIN\n   #Lauf := (#Start OR #Lauf) AND NOT #Stopp AND NOT #Stoerung;\n   #Ueberwachung(IN := #Lauf AND NOT #Rueckmeldung, PT := T#3S);\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n      #Lauf := FALSE;\n   END_IF;\n   IF #Quittieren THEN\n      #Stoerung := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p13_timer_im_fb', ch:13, title:'Timer im Baustein',
  story:'Ein Motor bekommt den Einschaltbefehl, aber das Schütz meldet nichts zurück — ARIA hat einen Draht gelöst. Ohne Überwachung merkt es niemand, bis das Band voller Teile steht.',
  brief:'Die Schnittstelle von <code>FB_Motor_U</code> steht, inklusive Multiinstanz <code>Ueberwachung : TON</code>. Schreibe den Code:<br>• Selbsthaltung wie gewohnt — eine <code>Stoerung</code> schaltet ebenfalls ab<br>• <code>#Ueberwachung</code> läuft, solange <code>Lauf</code> aktiv ist, aber keine <code>Rueckmeldung</code> kommt (<code>PT := T#3S</code>)<br>• Läuft die Zeit ab: <code>Stoerung</code> := TRUE und <code>Lauf</code> := FALSE<br>• <code>Quittieren</code> setzt die <code>Stoerung</code> zurück',
  learn:'Einen IEC-Timer als Multiinstanz in einem eigenen FB verwenden.',
  take:'Timer, Zähler und Flanken brauchen ein Gedächtnis — im eigenen FB legst du sie unter <code>VAR</code> an (Multiinstanz). Jede Instanz deines FB hat dann ihren eigenen Timer.',
  man:'multiinstanz', must:['TON','STAT'], warnFree:['CONDITIONAL_CALL'],
  hint:'Der Timer-Eingang ist eine Bedingung: <code>IN := #Lauf AND NOT #Rueckmeldung</code>. Rufe ihn in jedem Zyklus auf, nicht in einem IF.',
  blocks:[
    { name:'FB_Motor_U', kind:'FB', edit:true, start: MU_HEAD + 'BEGIN\n   \nEND_FUNCTION_BLOCK', ref: MU_HEAD + MU_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Motor_Band1"(Start := "S_Start", Stopp := "S_Stopp", Rueckmeldung := "RM_Band1", Quittieren := "S_Quit",\n                 Lauf => "Band_Lauf", Stoerung => "Band_Stoerung");') }
  ],
  instances:{ Motor_Band1:'FB_Motor_U' },
  globals:{ S_Start:false, S_Stopp:false, RM_Band1:false, S_Quit:false, Band_Lauf:false, Band_Stoerung:false },
  unit:[
    { block:'FB_Motor_U', steps:[[0.1,{Start:true},{Lauf:true, Stoerung:false}],[0.5,{Start:false, Rueckmeldung:true},{Lauf:true}],[5,{},{Lauf:true, Stoerung:false}],[0.1,{Stopp:true, Rueckmeldung:false},{Lauf:false, Stoerung:false}]] },
    { block:'FB_Motor_U', steps:[[0.1,{Start:true},{Lauf:true}],[2,{Start:false},{Stoerung:false}],[1,{},{Stoerung:true, Lauf:false}],[0.1,{Start:true},{Lauf:false}],[0.1,{Start:false, Quittieren:true},{Stoerung:false}],[0.1,{Quittieren:false, Start:true},{Lauf:true}]] }
  ],
  timed:[{ steps:[[0.1,{S_Start:true},{Band_Lauf:true}],[3,{S_Start:false},{Band_Stoerung:true, Band_Lauf:false}],[0.1,{S_Quit:true},{Band_Stoerung:false}]] }],
  bind:['beltRunning=Band_Lauf','motorFault1=Band_Stoerung','lightRed=Band_Stoerung','lightGreen=RM_Band1'],
  wrong:[{ FB_Motor_U: MU_HEAD + 'BEGIN\n   #Lauf := (#Start OR #Lauf) AND NOT #Stopp AND NOT #Stoerung;\n   IF #Lauf AND NOT #Rueckmeldung THEN\n      #Ueberwachung(IN := TRUE, PT := T#3S);\n   END_IF;\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n      #Lauf := FALSE;\n   END_IF;\n   IF #Quittieren THEN\n      #Stoerung := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 127 ---------- */
const SZ_HEAD = 'FUNCTION_BLOCK "FB_Stueckzaehler"\nVAR_INPUT\n   Teil : Bool;\n   Reset : Bool;\n   Soll : Int;      // Teile pro Auftrag\nEND_VAR\nVAR_OUTPUT\n   Ist : Int;\n   Voll : Bool;     // Auftrag erfüllt\n   Rest : Int;      // noch fehlende Teile (nie negativ)\nEND_VAR\nVAR\n   Zaehler : CTU;\nEND_VAR\n';
defProTask({ id:'p13_zaehler_fb', ch:13, title:'Ein Zähler-Baustein',
  story:'Jedes Band zählt seine Teile für den aktuellen Auftrag. ARIA hat die Zähler durcheinandergebracht — Band 1 zählt die Teile von Band 2. Zeit für einen sauberen Stückzähler-Baustein.',
  brief:'Die Schnittstelle von <code>FB_Stueckzaehler</code> steht, mit der Multiinstanz <code>Zaehler : CTU</code>. Schreibe den Code:<br>• <code>#Zaehler(CU := #Teil, R := #Reset, PV := #Soll, Q =&gt; #Voll, CV =&gt; #Ist);</code><br>• <code>Rest</code> = <code>Soll − Ist</code>, aber <b>nie kleiner als 0</b> (Tipp: <code>MAX</code>)<br><code>Main</code> (🔒) nutzt die Instanz <code>"Zaehler_Band1"</code> mit Soll = 5.',
  learn:'Standardbausteine (CTU) in einem eigenen FB kapseln.',
  take:'Ein eigener FB kann Standardbausteine enthalten und ihnen eine einfache, passende Schnittstelle geben. Der Aufrufer muss nicht wissen, dass innen ein CTU arbeitet.',
  man:'multiinstanz', must:['CTU','MAX'],
  hint:'<code>#Rest := MAX(IN1 := #Soll - #Ist, IN2 := 0);</code>',
  blocks:[
    { name:'FB_Stueckzaehler', kind:'FB', edit:true, start: SZ_HEAD + 'BEGIN\n   \nEND_FUNCTION_BLOCK',
      ref: SZ_HEAD + 'BEGIN\n   #Zaehler(CU := #Teil, R := #Reset, PV := #Soll, Q => #Voll, CV => #Ist);\n   #Rest := MAX(IN1 := #Soll - #Ist, IN2 := 0);\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "Zaehler_Band1"(Teil := "Sensor_1", Reset := "Reset", Soll := 5, Ist => "Ist_1", Voll => "Voll_1", Rest => "Rest_1");') }
  ],
  instances:{ Zaehler_Band1:'FB_Stueckzaehler' },
  globals:{ Sensor_1:false, Reset:false, Ist_1:0, Voll_1:false, Rest_1:0 },
  timed:[{ steps:[[0.1,{},{Ist_1:0, Rest_1:5}]].concat([1,2,3,4,5,6].map(i => [[0.1,{Sensor_1:true},{Ist_1:i, Rest_1:Math.max(0,5-i), Voll_1:i>=5}],[0.1,{Sensor_1:false},{}]]).reduce((a,b) => a.concat(b), [])).concat([[0.1,{Reset:true},{Ist_1:0, Voll_1:false, Rest_1:5}]]) }],
  bind:['displayValue=Ist_1','displayLabel:"IST"','lightGreen=Voll_1','sensorActive=Sensor_1','partVisible=Sensor_1'],
  wrong:[{ FB_Stueckzaehler: SZ_HEAD + 'BEGIN\n   #Zaehler(CU := #Teil, R := #Reset, PV := #Soll, Q => #Voll, CV => #Ist);\n   #Rest := #Soll - #Ist;\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 128 ---------- */
const BD_REF = 'FUNCTION_BLOCK "FB_Betriebsdaten"\nVAR_INPUT\n   Lauf : Bool;\nEND_VAR\nVAR\n   Starts : DInt;       // Anzahl Einschaltungen\n   Aktuell : Time;      // Dauer des aktuellen Laufs\n   Alt : Bool;\n   Uhr : TON;\nEND_VAR\nBEGIN\n   IF #Lauf AND NOT #Alt THEN\n      #Starts := #Starts + 1;\n   END_IF;\n   #Alt := #Lauf;\n   #Uhr(IN := #Lauf, PT := T#24H);\n   #Aktuell := #Uhr.ET;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p13_statik_lesen', ch:13, title:'In die Instanz schauen',
  story:'Die Instandhaltung will wissen, wie oft das Band eingeschaltet wurde und wie lange es gerade läuft. Der Baustein <code>FB_Betriebsdaten</code> zählt das längst mit — die Werte liegen in seinem Instanz-DB.',
  brief:'<code>FB_Betriebsdaten</code> (🔒) hat keine Ausgänge, speichert aber in seinen statischen Variablen <code>Starts</code> (DInt) und <code>Aktuell</code> (Time). Schreibe <code>Main</code>:<br>• Aufruf <code>"BD_Band1"(Lauf := …);</code> mit dem Laufsignal von Band 1<br>• Anzeige der Starts := <code>"BD_Band1".Starts</code><br>• Anzeige der Laufzeit := aktuelle Laufzeit in <b>ganzen Sekunden</b> (<code>TIME_TO_DINT</code> liefert Millisekunden)<br>• Wartungsmeldung := TRUE ab 3 Starts',
  learn:'Statische Daten einer Instanz von aussen lesen.',
  take:'Über <code>"Instanz".Variable</code> kann man auch statische Werte einer Instanz lesen — praktisch für Diagnose und HMI. Schreiben sollte man sie von aussen aber nicht: Die Instanz gehört dem Baustein.',
  man:'fb', must:['MEMBER','SINGLE','TIME_TO_DINT'],
  hint:'<code>"Laufzeit_s" := TIME_TO_DINT("BD_Band1".Aktuell) / 1000;</code>',
  blocks:[
    { name:'FB_Betriebsdaten', kind:'FB', src: BD_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   "BD_Band1"(Lauf := "Band1_Lauf");\n   // Starts, Laufzeit in Sekunden, Wartung\n'),
      ref: MAIN('   "BD_Band1"(Lauf := "Band1_Lauf");\n   "Anzeige_Starts" := "BD_Band1".Starts;\n   "Laufzeit_s" := TIME_TO_DINT("BD_Band1".Aktuell) / 1000;\n   "Wartung" := "BD_Band1".Starts >= 3;') }
  ],
  instances:{ BD_Band1:'FB_Betriebsdaten' },
  globals:{ Band1_Lauf:false, Anzeige_Starts:0, Laufzeit_s:0, Wartung:false }, types:{ Anzeige_Starts:'DINT', Laufzeit_s:'DINT' },
  timed:[{ steps:[[0.5,{Band1_Lauf:true},{Anzeige_Starts:1, Laufzeit_s:0}],[1.5,{},{Laufzeit_s:1}],[1,{},{Laufzeit_s:2}],[0.5,{Band1_Lauf:false},{Laufzeit_s:0}],[0.5,{Band1_Lauf:true},{Anzeige_Starts:2, Wartung:false}],[0.5,{Band1_Lauf:false},{}],[0.5,{Band1_Lauf:true},{Anzeige_Starts:3, Wartung:true}]] }],
  bind:['displayValue=Laufzeit_s','displayLabel:"LAUF s"','beltRunning=Band1_Lauf','lightYellow=Wartung'],
  wrong:[{ Main: MAIN('   "BD_Band1"(Lauf := "Band1_Lauf");\n   "Anzeige_Starts" := "BD_Band1".Starts;\n   "Laufzeit_s" := TIME_TO_DINT("BD_Band1".Aktuell);\n   "Wartung" := "BD_Band1".Starts >= 3;') }]
});

/* ---------- 129 ---------- */
const LUE_REF = 'FUNCTION_BLOCK "FB_Luefter"\nVAR_INPUT\n   Ein : Bool;\n   Temperatur : Real;\nEND_VAR\nVAR_OUTPUT\n   Luefter : Bool;\nEND_VAR\nBEGIN\n   IF NOT #Ein THEN\n      #Luefter := FALSE;\n   ELSIF #Temperatur > 40.0 THEN\n      #Luefter := TRUE;\n   ELSIF #Temperatur < 35.0 THEN\n      #Luefter := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p13_bedingt_dbg', ch:13, title:'Der eingefrorene Lüfter', debug:true,
  story:'Die Automatik ist aus, aber der Schaltschranklüfter läuft und läuft. ARIA: "Ich habe ihn nicht eingeschaltet. Ich habe nur vergessen, ihn zu fragen."',
  brief:'<code>FB_Luefter</code> (🔒) schaltet den Schranklüfter mit Hysterese (ein über 40 °C, aus unter 35 °C) und immer aus, wenn <code>Ein</code> = FALSE ist. <code>Main</code> soll ihn nur in der Betriebsart Automatik arbeiten lassen. Finde heraus, warum der Lüfter nach dem Abschalten der Automatik weiterläuft — die gelbe <b>Warnung</b> gibt einen Hinweis.',
  learn:'Instanzen in jedem Zyklus aufrufen, Bedingungen als Eingang übergeben.',
  take:'Wird eine Instanz nur bedingt aufgerufen, <b>frieren</b> ihre Ausgänge ein, sobald der Aufruf ausfällt — und Timer darin laufen nicht weiter. Rufe FBs in jedem Zyklus auf und übergib die Bedingung als Eingang.',
  man:'multiinstanz', warnFree:['CONDITIONAL_CALL'],
  hint:'Was passiert mit dem Ausgang <code>Luefter</code>, wenn der Aufruf im IF gar nicht mehr stattfindet?',
  blocks:[
    { name:'FB_Luefter', kind:'FB', src: LUE_REF },
    { name:'Main', kind:'OB', edit:true,
      start: MAIN('   IF "Automatik" THEN\n      "FB_Luefter_DB"(Ein := TRUE, Temperatur := "Schrank_Temp", Luefter => "Luefter");\n   END_IF;'),
      ref: MAIN('   "FB_Luefter_DB"(Ein := "Automatik", Temperatur := "Schrank_Temp", Luefter => "Luefter");') }
  ],
  globals:{ Automatik:false, Schrank_Temp:25, Luefter:false }, types:{ Schrank_Temp:'REAL' },
  timed:[{ steps:[[0.5,{Automatik:true, Schrank_Temp:45},{Luefter:true}],[0.5,{Schrank_Temp:38},{Luefter:true}],[0.5,{Automatik:false},{Luefter:false}],[0.5,{Automatik:true, Schrank_Temp:30},{Luefter:false}]] }],
  bind:['fanRunning=Luefter','displayValue=Schrank_Temp','displayLabel:"SCHRANK °C"','lightGreen=Automatik']
});

/* ---------- 130 (Boss) ---------- */
const STD_REF = 'FUNCTION_BLOCK "FB_Motor_Std"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Rueckmeldung : Bool;\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lauf : Bool;\n   Stoerung : Bool;\n   Starts : DInt;\nEND_VAR\nVAR\n   Lauf_alt : Bool;\n   Ueberwachung : TON;\nEND_VAR\nBEGIN\n   #Lauf := (#Start OR #Lauf) AND NOT #Stopp AND NOT #Stoerung;\n   IF #Lauf AND NOT #Lauf_alt THEN\n      #Starts := #Starts + 1;\n   END_IF;\n   #Lauf_alt := #Lauf;\n   #Ueberwachung(IN := #Lauf AND NOT #Rueckmeldung, PT := T#2S);\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n      #Lauf := FALSE;\n   END_IF;\n   IF #Quittieren THEN\n      #Stoerung := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
const STD_MAIN = MAIN('   "Motor_Band1"(Start := "S_Start1", Stopp := "S_Stopp", Rueckmeldung := "RM_Band1", Quittieren := "S_Quit",\n                 Lauf => "Band1_Lauf", Stoerung => "Stoer_1");\n   "Motor_Band2"(Start := "S_Start2", Stopp := "S_Stopp", Rueckmeldung := "RM_Band2", Quittieren := "S_Quit",\n                 Lauf => "Band2_Lauf", Stoerung => "Stoer_2");\n   "Sammelstoerung" := "Stoer_1" OR "Stoer_2";\n   "Starts_Gesamt" := "Motor_Band1".Starts + "Motor_Band2".Starts;');
defProTask({ id:'p13_boss', ch:13, title:'Boss: Motorbaustein nach Firmenstandard', boss:true,
  story:'ARIA hat jeden Motor der Halle anders programmiert. Die Instandhaltung verzweifelt. Die Werksleitung verlangt einen <b>Firmenstandard</b>: ein einziger, geprüfter Motorbaustein für alle Antriebe.',
  brief:'<b>1. Schreibe <code>FB_Motor_Std</code></b> — Eingänge <code>Start</code>, <code>Stopp</code>, <code>Rueckmeldung</code>, <code>Quittieren</code>; Ausgänge <code>Lauf</code>, <code>Stoerung</code> (Bool), <code>Starts</code> (DInt):<br>• Selbsthaltung; <code>Stopp</code> oder <code>Stoerung</code> schalten ab<br>• jede Einschaltung (steigende Flanke von <code>Lauf</code>) erhöht <code>Starts</code><br>• kommt <b>2 s</b> nach dem Einschalten keine <code>Rueckmeldung</code>: <code>Stoerung</code> := TRUE, <code>Lauf</code> := FALSE<br>• <code>Quittieren</code> löscht die Störung<br><b>2. Schreibe <code>Main</code></b> mit den Instanzen <code>"Motor_Band1"</code> und <code>"Motor_Band2"</code>:<br>• Band 1: Starttaster und Rückmeldung von Band 1 → Motor und Störmeldung von Band 1; Band 2: Starttaster und Rückmeldung von Band 2 → Motor und Störmeldung von Band 2; gemeinsam: Stopptaster und Quittiertaster<br>• Sammelstörung := eine der beiden Störungen, Starts gesamt := Summe der Starts beider Motoren (jeweils auf die passende Meldung bzw. Anzeige)',
  learn:'Einen vollständigen Geräte-FB mit Überwachung, Diagnose und mehreren Instanzen entwerfen.',
  take:'Ein Standardbaustein wird einmal gründlich entwickelt und getestet — danach bekommt jedes Gerät nur noch eine Instanz. Das spart Zeit, verhindert Fehler und macht die Anlage für alle verständlich.',
  man:'multiinstanz', must:['FB','TON','DINT','SINGLE'], warnFree:['CONDITIONAL_CALL','INSTANCE_TWICE','TEMP_READ_BEFORE_WRITE','GLOBAL_ACCESS'],
  hint:'Baue den FB in Etappen: Selbsthaltung → Flanke für Starts → Überwachungstimer → Quittieren. Teste nach jeder Etappe.',
  hint2:'Für die Flanke von <code>Lauf</code> brauchst du eine statische Variable (z.B. <code>Lauf_alt</code>). Den TON rufst du mit <code>IN := #Lauf AND NOT #Rueckmeldung</code> auf.',
  blocks:[
    { name:'FB_Motor_Std', kind:'FB', edit:true, start:'FUNCTION_BLOCK "FB_Motor_Std"\n// Firmenstandard Motor: Start/Stopp, Rückmeldeüberwachung 2 s,\n// Störung mit Quittierung, Zählung der Einschaltungen\n\nBEGIN\n\nEND_FUNCTION_BLOCK', ref: STD_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // zwei Instanzen: "Motor_Band1", "Motor_Band2"\n'), ref: STD_MAIN }
  ],
  instances:{ Motor_Band1:'FB_Motor_Std', Motor_Band2:'FB_Motor_Std' },
  globals:{ S_Start1:false, S_Start2:false, S_Stopp:false, S_Quit:false, RM_Band1:false, RM_Band2:false, Band1_Lauf:false, Band2_Lauf:false, Stoer_1:false, Stoer_2:false, Sammelstoerung:false, Starts_Gesamt:0 },
  types:{ Starts_Gesamt:'DINT' },
  unit:[{ block:'FB_Motor_Std', steps:[[0.1,{Start:true},{Lauf:true, Starts:1}],[0.5,{Start:false, Rueckmeldung:true},{Lauf:true}],[3,{},{Stoerung:false}],[0.1,{Stopp:true},{Lauf:false}],[0.1,{Stopp:false, Rueckmeldung:false, Start:true},{Lauf:true, Starts:2}],[2,{Start:false},{Stoerung:true, Lauf:false}],[0.1,{Start:true},{Lauf:false, Starts:2}],[0.1,{Start:false, Quittieren:true},{Stoerung:false}]] }],
  timed:[{ steps:[[0.1,{S_Start1:true, RM_Band1:true},{Band1_Lauf:true, Band2_Lauf:false, Starts_Gesamt:1}],[0.1,{S_Start1:false, S_Start2:true},{Band2_Lauf:true, Starts_Gesamt:2}],[1,{S_Start2:false},{Stoer_2:false}],[1,{},{Stoer_2:true, Band2_Lauf:false, Band1_Lauf:true, Sammelstoerung:true, Stoer_1:false}],[0.1,{S_Quit:true},{Sammelstoerung:false}],[0.1,{S_Quit:false, S_Stopp:true},{Band1_Lauf:false}]] }],
  bind:['beltRunning=Band1_Lauf','belt2Running=Band2_Lauf','motorFault1=Stoer_1','motorFault2=Stoer_2','lightRed=Sammelstoerung','displayValue=Starts_Gesamt','displayLabel:"STARTS"'],
  wrong:[
    { FB_Motor_Std: STD_REF.replace('PT := T#2S', 'PT := T#5S') },
    { Main: STD_MAIN.replace('"Motor_Band1".Starts + "Motor_Band2".Starts', '"Motor_Band1".Starts') }
  ]
});
})();
