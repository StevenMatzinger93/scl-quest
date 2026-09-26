/* ===== KAPITEL 14 — Daten mit Struktur: STRUCT, UDT, DB, STRING — Profi-Stufe ===== */
(function(){
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';
const UDT_TEIL = 'TYPE "UDT_Teil"\nVERSION : 0.1\n   STRUCT\n      Nr : DInt;        // Teilenummer\n      Gewicht : Real;   // Gramm\n      OK : Bool;        // Prüfung bestanden\n   END_STRUCT;\nEND_TYPE';
const teil = (nr, g) => ({ Nr: nr, Gewicht: g, OK: g >= 480 && g <= 520 });

/* ---------- 131 ---------- */
const TP_HEAD = 'FUNCTION_BLOCK "FB_Teilpruefung"\nVAR_INPUT\n   Nr : DInt;\n   Gewicht : Real;\nEND_VAR\nVAR_OUTPUT\n   OK : Bool;\nEND_VAR\n';
const TP_BODY = 'BEGIN\n   #Teil.Nr := #Nr;\n   #Teil.Gewicht := #Gewicht;\n   #Teil.OK := #Gewicht >= 480.0 AND #Gewicht <= 520.0;\n   #OK := #Teil.OK;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p14_struct', ch:14, title:'Die erste Struktur',
  story:'Die Daten eines Teils liegen in drei losen Variablen: Nummer, Gewicht, Ergebnis. ARIA vertauscht sie nach Belieben — Teil 17 bekommt das Gewicht von Teil 18. "Was zusammengehört, packt man zusammen", sagt der Werkmeister.',
  brief:'Lege in <code>FB_Teilpruefung</code> unter <code>VAR</code> eine Struktur an:<br><pre class="code">Teil : Struct\n   Nr : DInt;\n   Gewicht : Real;\n   OK : Bool;\nEND_STRUCT;</pre>Fülle sie im Code: <code>#Teil.Nr</code> und <code>#Teil.Gewicht</code> aus den Eingängen, <code>#Teil.OK</code> = Gewicht zwischen 480 und 520 g. Der Ausgang <code>OK</code> übernimmt <code>#Teil.OK</code>.',
  learn:'Eine Struktur (STRUCT) deklarieren und auf ihre Elemente zugreifen.',
  take:'Eine Struktur bündelt zusammengehörige Daten unter einem Namen. Auf die Elemente greift man mit Punkt zu: <code>#Teil.Gewicht</code>. So kann nichts mehr auseinanderlaufen.',
  man:'struct_udt', must:['STRUCT','MEMBER'],
  hint:'Die Struktur-Deklaration steht im Bereich <code>VAR … END_VAR</code>. Beachte das Semikolon nach <code>END_STRUCT</code>.',
  blocks:[
    { name:'FB_Teilpruefung', kind:'FB', edit:true, start: TP_HEAD + 'VAR\n   // TODO: Struktur Teil (Nr, Gewicht, OK)\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK',
      ref: TP_HEAD + 'VAR\n   Teil : Struct\n      Nr : DInt;\n      Gewicht : Real;\n      OK : Bool;\n   END_STRUCT;\nEND_VAR\n' + TP_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Teilpruefung_DB"(Nr := "Teil_Nr", Gewicht := "Teil_Gewicht", OK => "Teil_OK");') }
  ],
  globals:{ Teil_Nr:0, Teil_Gewicht:0, Teil_OK:false }, types:{ Teil_Nr:'DINT', Teil_Gewicht:'REAL' },
  tests:[[{Teil_Nr:17, Teil_Gewicht:498},{Teil_OK:true, 'FB_Teilpruefung_DB.Teil':{Nr:17, Gewicht:498, OK:true}}],[{Teil_Nr:18, Teil_Gewicht:531.5},{Teil_OK:false, 'FB_Teilpruefung_DB.Teil':{Nr:18, Gewicht:531.5, OK:false}}]],
  bind:['partLabel=Teil_Nr','displayValue=Teil_Gewicht','displayLabel:"GRAMM"',{channel:'partColor', variable:'Teil_OK', map:{'true':'green','false':'red'}},'partVisible:true','lightGreen=Teil_OK'],
  wrong:[{ FB_Teilpruefung: TP_HEAD + 'VAR\n   Teil : Struct\n      Nr : DInt;\n      Gewicht : Real;\n      OK : Bool;\n   END_STRUCT;\nEND_VAR\nBEGIN\n   #Teil.Nr := #Nr;\n   #Teil.OK := #Gewicht >= 480.0 AND #Gewicht <= 520.0;\n   #OK := #Teil.OK;\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 132 ---------- */
const UDT_TEIL2 = 'TYPE "UDT_Teil"\nVERSION : 0.1\n   STRUCT\n      Nr : DInt;\n      Gewicht : Real;\n      OK : Bool;\n      Fehlercode : Int;   // 0 OK, 1 zu leicht, 2 zu schwer\n   END_STRUCT;\nEND_TYPE';
const DB_AKT = 'DATA_BLOCK "DB_Aktuell"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Teil : "UDT_Teil";\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const FC_PRUEF = 'FUNCTION "FC_Pruefen" : Void\nVAR_IN_OUT\n   Teil : "UDT_Teil";\nEND_VAR\nBEGIN\n   IF #Teil.Gewicht < 480.0 THEN\n      #Teil.Fehlercode := 1;\n   ELSIF #Teil.Gewicht > 520.0 THEN\n      #Teil.Fehlercode := 2;\n   ELSE\n      #Teil.Fehlercode := 0;\n   END_IF;\n   #Teil.OK := #Teil.Fehlercode = 0;\nEND_FUNCTION';
defProTask({ id:'p14_udt', ch:14, title:'Einen Datentyp anlegen (UDT)',
  story:'Die Struktur aus der letzten Aufgabe braucht jetzt jede Station: Waage, Prüfplatz, Ablage. "Schreibst du sie überall neu, sind sie bald alle ein bisschen verschieden", warnt der Werkmeister. "Leg einen eigenen Datentyp an — einen PLC-Datentyp."',
  brief:'Schreibe den PLC-Datentyp <code>"UDT_Teil"</code> (<code>TYPE … END_TYPE</code>) mit den Elementen:<br>• <code>Nr</code> (DInt), <code>Gewicht</code> (Real), <code>OK</code> (Bool), <code>Fehlercode</code> (Int)<br>Der Datenbaustein <code>"DB_Aktuell"</code> und die Funktion <code>FC_Pruefen</code> (beide 🔒) verwenden deinen Datentyp bereits.',
  learn:'Einen PLC-Datentyp (UDT) definieren und wiederverwenden.',
  take:'Ein UDT (<code>TYPE "Name" STRUCT … END_STRUCT; END_TYPE</code>) ist ein Bauplan. Jede Variable dieses Typs hat genau dieselben Elemente — in Bausteinen, Datenbausteinen und Schnittstellen. Ändert sich der Bauplan, ändern sich alle mit.',
  man:'struct_udt', must:['UDT'],
  hint:'Aufbau: <code>TYPE "UDT_Teil"</code>, dann <code>STRUCT</code>, die vier Elemente, <code>END_STRUCT;</code> und <code>END_TYPE</code>.',
  blocks:[
    { name:'UDT_Teil', kind:'UDT', edit:true, start:'TYPE "UDT_Teil"\nVERSION : 0.1\n   STRUCT\n      // Nr, Gewicht, OK, Fehlercode\n   END_STRUCT;\nEND_TYPE', ref: UDT_TEIL2 },
    { name:'DB_Aktuell', kind:'DB', src: DB_AKT },
    { name:'FC_Pruefen', kind:'FC', src: FC_PRUEF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Pruefen"(Teil := "DB_Aktuell".Teil);\n   "H_Gruen" := "DB_Aktuell".Teil.OK;\n   "H_Rot" := NOT "DB_Aktuell".Teil.OK;') }
  ],
  globals:{ H_Gruen:false, H_Rot:false },
  tests:[[{'DB_Aktuell.Teil.Gewicht':500},{'DB_Aktuell.Teil.Fehlercode':0, 'DB_Aktuell.Teil.OK':true, H_Gruen:true}],[{'DB_Aktuell.Teil.Gewicht':470},{'DB_Aktuell.Teil.Fehlercode':1, H_Rot:true}],[{'DB_Aktuell.Teil.Gewicht':525.5, 'DB_Aktuell.Teil.Nr':123456},{'DB_Aktuell.Teil.Fehlercode':2, 'DB_Aktuell.Teil.Nr':123456}]],
  bind:['lightGreen=H_Gruen','lightRed=H_Rot','displayValue=DB_Aktuell.Teil.Fehlercode','displayLabel:"FEHLER"'],
  wrong:[{ UDT_Teil: UDT_TEIL2.replace('      Nr : DInt;\n', '      Nr : Int;\n') }]
});

/* ---------- 133 ---------- */
const CA_HEAD = 'FUNCTION "FC_Charge" : Void\nVAR_IN_OUT\n   Charge : Array[1..8] of "UDT_Teil";\nEND_VAR\nVAR_OUTPUT\n   Anzahl_OK : Int;\n   Gesamtgewicht : Real;\n   Schwerstes : DInt;   // Nummer des schwersten Teils\nEND_VAR\nVAR_TEMP\n   i : Int;\n   Max_Gewicht : Real;\nEND_VAR\n';
const CA_REF = CA_HEAD + 'BEGIN\n   #Anzahl_OK := 0;\n   #Gesamtgewicht := 0.0;\n   #Max_Gewicht := #Charge[1].Gewicht;\n   #Schwerstes := #Charge[1].Nr;\n   FOR #i := 1 TO 8 DO\n      IF #Charge[#i].OK THEN\n         #Anzahl_OK := #Anzahl_OK + 1;\n      END_IF;\n      #Gesamtgewicht := #Gesamtgewicht + #Charge[#i].Gewicht;\n      IF #Charge[#i].Gewicht > #Max_Gewicht THEN\n         #Max_Gewicht := #Charge[#i].Gewicht;\n         #Schwerstes := #Charge[#i].Nr;\n      END_IF;\n   END_FOR;\nEND_FUNCTION';
const CH1 = [teil(101,498),teil(102,523),teil(103,505),teil(104,476),teil(105,512),teil(106,531),teil(107,500),teil(108,488)];
const CH2 = [teil(201,500),teil(202,500),teil(203,500),teil(204,500),teil(205,500),teil(206,500),teil(207,500),teil(208,500)];
const CH3 = [teil(1,600),teil(2,400),teil(3,590),teil(4,480),teil(5,520),teil(6,480),teil(7,520),teil(8,480)];
defProTask({ id:'p14_array_udt', ch:14, title:'Array von Datentypen',
  story:'Eine Charge sind acht Teile. ARIA hat die Qualitätsstatistik gefälscht. Mit einem Array von <code>"UDT_Teil"</code> hast du alle Daten sauber beisammen — und kannst nachrechnen.',
  brief:'<code>FC_Charge</code> bekommt die acht Teile als <code>Array[1..8] of "UDT_Teil"</code>. Schreibe den Code:<br>• <code>Anzahl_OK</code>: wie viele Teile haben <code>OK</code> = TRUE<br>• <code>Gesamtgewicht</code>: Summe aller Gewichte<br>• <code>Schwerstes</code>: die <code>Nr</code> des schwersten Teils (bei Gleichstand das erste)<br>Zugriff auf ein Element: <code>#Charge[#i].Gewicht</code>. Setze alle Ausgänge vor der Schleife auf Startwerte.',
  learn:'Arrays von Strukturen mit einer Schleife auswerten.',
  take:'<code>#Charge[#i].Gewicht</code> — erst das Array-Element wählen, dann das Strukturelement. So lassen sich ganze Datensätze in einer Schleife auswerten.',
  man:'struct_udt', must:['FOR','ARRAY','MEMBER'], warnFree:['OUT_NOT_ALL_PATHS','TEMP_READ_BEFORE_WRITE'],
  hint:'Für das Maximum: Starte mit Element 1 (<code>#Max_Gewicht := #Charge[1].Gewicht;</code>) und merke dir bei jedem schwereren Teil Gewicht und Nummer.',
  blocks:[
    { name:'UDT_Teil', kind:'UDT', src: UDT_TEIL },
    { name:'FC_Charge', kind:'FC', edit:true, start: CA_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: CA_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Charge"(Charge := "Charge", Anzahl_OK => "Anzahl_OK", Gesamtgewicht => "Gesamtgewicht", Schwerstes => "Schwerstes");') }
  ],
  globals:{ Charge:CH1, Anzahl_OK:0, Gesamtgewicht:0, Schwerstes:0 }, types:{ Charge:'ARRAY[1..8] OF "UDT_Teil"', Gesamtgewicht:'REAL', Schwerstes:'DINT' },
  tests:[[{Charge:CH1},{Anzahl_OK:5, Gesamtgewicht:4033, Schwerstes:106}],[{Charge:CH2},{Anzahl_OK:8, Gesamtgewicht:4000, Schwerstes:201}],[{Charge:CH3},{Anzahl_OK:5, Gesamtgewicht:4070, Schwerstes:1}]],
  bind:['displayValue=Anzahl_OK','displayLabel:"OK-TEILE"','partLabel=Schwerstes'],
  wrong:[{ FC_Charge: CA_REF.replace('FOR #i := 1 TO 8 DO', 'FOR #i := 2 TO 8 DO') }, { FC_Charge: CA_REF.replace('#Charge[#i].Gewicht > #Max_Gewicht', '#Charge[#i].Gewicht >= #Max_Gewicht') }]
});

/* ---------- 134 ---------- */
const DB_ZELLE = 'DATA_BLOCK "DB_Zelle"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Charge : Array[1..8] of "UDT_Teil";\n      Anzahl : Int;     // belegte Plätze\n      Alt : Bool;       // Flankenmerker für "Uebernehmen"\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const DBZ_REF = MAIN('   IF "Uebernehmen" AND NOT "DB_Zelle".Alt AND "DB_Zelle".Anzahl < 8 THEN\n      "DB_Zelle".Anzahl := "DB_Zelle".Anzahl + 1;\n      "DB_Zelle".Charge["DB_Zelle".Anzahl].Nr := "Scan_Nr";\n      "DB_Zelle".Charge["DB_Zelle".Anzahl].Gewicht := "Waage";\n      "DB_Zelle".Charge["DB_Zelle".Anzahl].OK := "Waage" >= 480.0 AND "Waage" <= 520.0;\n   END_IF;\n   "DB_Zelle".Alt := "Uebernehmen";\n   "Anzeige" := "DB_Zelle".Anzahl;');
defProTask({ id:'p14_global_db', ch:14, title:'Der globale Datenbaustein',
  story:'Waage, Scanner und Protokoll-PC sollen auf dieselben Chargendaten zugreifen. "Dafür gibt es globale Datenbausteine", sagt der Werkmeister. "Jeder Baustein kann dort lesen — und das Programm weiss genau, wo die Daten liegen."',
  brief:'Im globalen DB <code>"DB_Zelle"</code> (🔒) liegen <code>Charge</code> (Array[1..8] of "UDT_Teil"), <code>Anzahl</code> und der Merker <code>Alt</code>. Schreibe <code>Main</code>:<br>• Bei jeder <b>steigenden Flanke</b> von <code>"Uebernehmen"</code> (Merker: <code>"DB_Zelle".Alt</code>) und solange <code>Anzahl</code> &lt; 8: <code>Anzahl</code> um 1 erhöhen und im Platz <code>Charge[Anzahl]</code> <code>Nr</code> := <code>"Scan_Nr"</code>, <code>Gewicht</code> := <code>"Waage"</code>, <code>OK</code> := Gewicht in 480…520 speichern<br>• <code>"Anzeige"</code> := <code>"DB_Zelle".Anzahl</code>',
  learn:'Daten in einem globalen Datenbaustein lesen und schreiben.',
  take:'Globale DBs sind der gemeinsame Datenspeicher des Programms: <code>"DB_Zelle".Charge[3].Gewicht</code>. Weil ein OB kein eigenes Gedächtnis hat, liegen auch Merker (hier für die Flanke) im DB.',
  man:'db', must:['DB_ACCESS','ARRAY','MEMBER'],
  hint:'Erst <code>Anzahl</code> erhöhen, dann <code>"DB_Zelle".Charge["DB_Zelle".Anzahl]</code> beschreiben — so landet das erste Teil auf Platz 1.',
  blocks:[
    { name:'UDT_Teil', kind:'UDT', src: UDT_TEIL },
    { name:'DB_Zelle', kind:'DB', src: DB_ZELLE },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // neues Teil übernehmen (Flanke), Anzeige\n'), ref: DBZ_REF }
  ],
  globals:{ Uebernehmen:false, Scan_Nr:0, Waage:0, Anzeige:0 }, types:{ Scan_Nr:'DINT', Waage:'REAL' },
  timed:[{ steps:[[0.1,{Scan_Nr:501, Waage:499.5, Uebernehmen:true},{Anzeige:1, 'DB_Zelle.Charge[1]':{Nr:501, Gewicht:499.5, OK:true}}],[0.1,{},{Anzeige:1}],[0.1,{Uebernehmen:false},{}],[0.1,{Scan_Nr:502, Waage:530, Uebernehmen:true},{Anzeige:2, 'DB_Zelle.Charge[2]':{Nr:502, OK:false}}]] },
    { setup:{'DB_Zelle.Anzahl':8}, steps:[[0.1,{Scan_Nr:9, Waage:500, Uebernehmen:true},{Anzeige:8}]] }],
  bind:['displayValue=Anzeige','displayLabel:"PLÄTZE"','partLabel=Scan_Nr','sensorActive=Uebernehmen','partVisible:true'],
  wrong:[{ Main: DBZ_REF.replace('   "DB_Zelle".Alt := "Uebernehmen";\n', '') }, { Main: DBZ_REF.replace(' AND "DB_Zelle".Anzahl < 8', '') }]
});

/* ---------- 135 ---------- */
const SUM_REF = 'FUNCTION "FC_Summe" : Real\nVAR_IN_OUT\n   Charge : Array[1..8] of "UDT_Teil";\nEND_VAR\nVAR_TEMP\n   i : Int;\n   s : Real;\nEND_VAR\nBEGIN\n   #s := 0.0;\n   FOR #i := 1 TO 8 DO\n      #s := #s + #Charge[#i].Gewicht;\n   END_FOR;\n   #FC_Summe := #s;\nEND_FUNCTION';
defProTask({ id:'p14_grenzen_dbg', ch:14, title:'Falsche Grenzen', debug:true,
  story:'Die Summenfunktion für die Charge will nicht übersetzen. ARIA hat sie „modernisiert“: "Informatiker zählen ab null. Das weiss doch jeder."',
  brief:'<code>FC_Summe</code> soll die Gewichte aller acht Teile aus <code>"DB_Zelle".Charge</code> (Array[1..8] of "UDT_Teil") addieren. Mach die Funktion passend zum Datenbaustein.',
  learn:'Array-Grenzen in Schnittstellen und Schleifen abgleichen.',
  take:'Ein IN_OUT muss <b>exakt</b> den Typ des Aktualparameters haben — bei Arrays gehören die Grenzen zum Typ. Und die Schleife muss genau über diese Grenzen laufen.',
  man:'struct_udt',
  hint:'Vergleiche die Array-Deklaration im DB mit der in der FC — und die Grenzen der FOR-Schleife.',
  blocks:[
    { name:'UDT_Teil', kind:'UDT', src: UDT_TEIL },
    { name:'DB_Zelle', kind:'DB', src: DB_ZELLE },
    { name:'FC_Summe', kind:'FC', edit:true, start: SUM_REF.replace('Array[1..8]', 'Array[0..7]').replace('FOR #i := 1 TO 8 DO', 'FOR #i := 0 TO 8 DO'), ref: SUM_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Summe" := "FC_Summe"(Charge := "DB_Zelle".Charge);') }
  ],
  globals:{ Summe:0 }, types:{ Summe:'REAL' },
  tests:[[{'DB_Zelle.Charge':CH1},{Summe:4033}],[{'DB_Zelle.Charge':CH3},{Summe:4070}]],
  bind:['displayValue=Summe','displayLabel:"GRAMM"']
});

/* ---------- 136 ---------- */
const MELD_HEAD = 'FUNCTION "FC_Meldung" : String[24]\nVAR_INPUT\n   Zustand : Int;\nEND_VAR\n';
const MELD_REF = MELD_HEAD + 'BEGIN\n   CASE #Zustand OF\n      0: #FC_Meldung := \'Bereit\';\n      1: #FC_Meldung := \'Automatik läuft\';\n      2: #FC_Meldung := \'Störung Band 1\';\n      3: #FC_Meldung := \'Wartung\';\n   ELSE\n      #FC_Meldung := \'Unbekannt\';\n   END_CASE;\nEND_FUNCTION';
defProTask({ id:'p14_string', ch:14, title:'Erste Texte',
  story:'Das HMI zeigt nur Nummern: „Zustand 2“. Die Bediener müssen jedes Mal im Handbuch nachschlagen. "Menschen lesen Wörter", sagt der Werkmeister. "Gib der Zelle eine Sprache."',
  brief:'<code>FC_Meldung</code> liefert einen Text vom Typ <code>String[24]</code>. Schreibe den Code mit <code>CASE</code>:<br>• 0 → <code>\'Bereit\'</code>, 1 → <code>\'Automatik läuft\'</code>, 2 → <code>\'Störung Band 1\'</code>, 3 → <code>\'Wartung\'</code><br>• jeder andere Wert → <code>\'Unbekannt\'</code><br>Texte stehen in <b>einfachen</b> Hochkommas. <code>Main</code> (🔒) schreibt das Ergebnis in die HMI-Textzeile <code>"HMI_Text"</code>.',
  learn:'Mit STRING-Variablen und Text-Literalen arbeiten.',
  take:'<code>String[24]</code> fasst bis zu 24 Zeichen. Text-Literale schreibt man in einfachen Hochkommas: <code>\'Bereit\'</code>. Doppelte Anführungszeichen sind in SCL für globale Namen reserviert.',
  man:'string', must:['STRING','CASE'], warnFree:['RET_NOT_SET','STRING_TRUNC'],
  hint:'In jedem CASE-Zweig: <code>#FC_Meldung := \'…\';</code> — und das ELSE nicht vergessen.',
  blocks:[
    { name:'FC_Meldung', kind:'FC', edit:true, start: MELD_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: MELD_REF },
    { name:'Main', kind:'OB', src: MAIN('   "HMI_Text" := "FC_Meldung"(Zustand := "Zustand");') }
  ],
  globals:{ Zustand:0, HMI_Text:'' }, types:{ HMI_Text:'STRING[24]' },
  tests:[[{Zustand:0},{HMI_Text:'Bereit'}],[{Zustand:1},{HMI_Text:'Automatik läuft'}],[{Zustand:2},{HMI_Text:'Störung Band 1'}],[{Zustand:3},{HMI_Text:'Wartung'}],[{Zustand:9},{HMI_Text:'Unbekannt'}]],
  bind:['displayText=HMI_Text','displayValue=Zustand','displayLabel:"ZUSTAND"'],
  wrong:[{ FC_Meldung: MELD_REF.replace("'Automatik läuft'", "'Automatik'") }]
});

/* ---------- 137 ---------- */
const TT_HEAD = 'FUNCTION "FC_Teiletext" : String[30]\nVAR_INPUT\n   Nr : DInt;\n   Gewicht : Int;    // ganze Gramm\n   OK : Bool;\nEND_VAR\n';
const TT_REF = TT_HEAD + 'BEGIN\n   #FC_Teiletext := CONCAT(IN1 := \'Teil \', IN2 := DINT_TO_STRING(#Nr), IN3 := \': \',\n                           IN4 := INT_TO_STRING(#Gewicht), IN5 := \' g \');\n   IF #OK THEN\n      #FC_Teiletext := CONCAT(IN1 := #FC_Teiletext, IN2 := \'OK\');\n   ELSE\n      #FC_Teiletext := CONCAT(IN1 := #FC_Teiletext, IN2 := \'NOK\');\n   END_IF;\nEND_FUNCTION';
defProTask({ id:'p14_concat', ch:14, title:'Texte zusammensetzen',
  story:'Das Protokoll soll für jedes Teil eine Zeile ausgeben: „Teil 17: 498 g OK“. ARIA meint: "Zahlen und Buchstaben mischen? Das geht in SCL nicht." Doch — mit Umwandlung und CONCAT.',
  brief:'<code>FC_Teiletext</code> liefert <code>String[30]</code>. Baue den Text <code>Teil &lt;Nr&gt;: &lt;Gewicht&gt; g OK</code> bzw. <code>… g NOK</code>:<br>• Zahlen vorher umwandeln: <code>DINT_TO_STRING(#Nr)</code>, <code>INT_TO_STRING(#Gewicht)</code><br>• verbinden mit <code>CONCAT(IN1 := …, IN2 := …, …)</code><br>Beispiele: Nr 17, 498 g, OK → <code>Teil 17: 498 g OK</code> · Nr 5, 531 g, nicht OK → <code>Teil 5: 531 g NOK</code>',
  learn:'Zahlen in Text umwandeln und Texte verketten.',
  take:'Texte verbindet man mit <code>CONCAT</code>, nicht mit <code>+</code>. Zahlen werden vorher mit <code>…_TO_STRING</code> umgewandelt. <i>Hinweis:</i> In TIA Portal kann die Umwandlung je nach Funktion ein Vorzeichen- oder Leerzeichen voranstellen — vor dem Einsatz an der Anlage prüfen.',
  man:'string', must:['CONCAT','CONVERT'],
  hint:'Zuerst den gemeinsamen Teil <code>\'Teil 17: 498 g \'</code> bauen, dann je nach <code>OK</code> noch <code>\'OK\'</code> oder <code>\'NOK\'</code> anhängen.',
  blocks:[
    { name:'FC_Teiletext', kind:'FC', edit:true, start: TT_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: TT_REF },
    { name:'Main', kind:'OB', src: MAIN('   "HMI_Text" := "FC_Teiletext"(Nr := "Teil_Nr", Gewicht := "Gewicht", OK := "Teil_OK");') }
  ],
  globals:{ Teil_Nr:0, Gewicht:0, Teil_OK:false, HMI_Text:'' }, types:{ Teil_Nr:'DINT', HMI_Text:'STRING[30]' },
  unit:[{ block:'FC_Teiletext', steps:[[{Nr:17, Gewicht:498, OK:true},{RET:'Teil 17: 498 g OK'}],[{Nr:5, Gewicht:531, OK:false},{RET:'Teil 5: 531 g NOK'}],[{Nr:123456, Gewicht:12, OK:true},{RET:'Teil 123456: 12 g OK'}]] }],
  tests:[[{Teil_Nr:42, Gewicht:500, Teil_OK:true},{HMI_Text:'Teil 42: 500 g OK'}]],
  bind:['displayText=HMI_Text','partLabel=Teil_Nr',{channel:'partColor', variable:'Teil_OK', map:{'true':'green','false':'red'}},'partVisible:true'],
  wrong:[{ FC_Teiletext: TT_REF.replace("IN5 := ' g '", "IN5 := 'g '") }]
});

/* ---------- 138 ---------- */
const BC_HEAD = 'FUNCTION "FC_Barcode" : Void\nVAR_INPUT\n   Code : String[20];     // z.B. A-0042-B\nEND_VAR\nVAR_OUTPUT\n   Typ : String[1];\n   Nummer : Int;\n   Variante : String[1];\n   Gueltig : Bool;\nEND_VAR\n';
const BC_REF = BC_HEAD + 'BEGIN\n   #Gueltig := LEN(#Code) = 8 AND FIND(IN1 := #Code, IN2 := \'-\') = 2\n               AND MID(IN := #Code, L := 1, P := 7) = \'-\';\n   IF #Gueltig THEN\n      #Typ := LEFT(IN := #Code, L := 1);\n      #Nummer := STRING_TO_INT(MID(IN := #Code, L := 4, P := 3));\n      #Variante := RIGHT(IN := #Code, L := 1);\n   ELSE\n      #Typ := \'\';\n      #Nummer := 0;\n      #Variante := \'\';\n   END_IF;\nEND_FUNCTION';
defProTask({ id:'p14_zerlegen', ch:14, title:'Texte zerlegen',
  story:'Jedes Rohteil trägt einen Barcode wie <code>A-0042-B</code>: Typ, Nummer, Variante. ARIA schickt manipulierte Codes. Die Zelle muss sie zerlegen — und gefälschte erkennen.',
  brief:'<code>FC_Barcode</code> zerlegt <code>Code</code> im Format <code>X-NNNN-Y</code>:<br>• <code>Gueltig</code> := Länge ist 8, das erste <code>-</code> steht an Position 2 (<code>FIND</code>) und an Position 7 steht ebenfalls <code>-</code> (<code>MID</code>)<br>• wenn gültig: <code>Typ</code> = 1. Zeichen (<code>LEFT</code>), <code>Nummer</code> = Zeichen 3…6 als Zahl (<code>MID</code> + <code>STRING_TO_INT</code>), <code>Variante</code> = letztes Zeichen (<code>RIGHT</code>)<br>• sonst: <code>Typ</code> und <code>Variante</code> = <code>\'\'</code>, <code>Nummer</code> = 0<br>Positionen zählen ab <b>1</b>.',
  learn:'Texte mit LEN, FIND, LEFT, MID und RIGHT auswerten.',
  take:'<code>MID(IN := Text, L := Länge, P := Position)</code> schneidet aus der Mitte, <code>LEFT</code>/<code>RIGHT</code> vom Rand, <code>FIND</code> sucht und liefert die Position (0 = nicht gefunden). Prüfe das Format, bevor du dem Inhalt traust.',
  man:'string', must:['LEN','MID','FIND','STRING_TO_INT'], warnFree:['OUT_NOT_ALL_PATHS'],
  hint:'Die Nummer steht ab Position 3 und ist 4 Zeichen lang: <code>MID(IN := #Code, L := 4, P := 3)</code>.',
  blocks:[
    { name:'FC_Barcode', kind:'FC', edit:true, start: BC_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: BC_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Barcode"(Code := "Scanner", Typ => "Typ", Nummer => "Nummer", Variante => "Variante", Gueltig => "Code_OK");') }
  ],
  globals:{ Scanner:'', Typ:'', Nummer:0, Variante:'', Code_OK:false }, types:{ Scanner:'STRING[20]', Typ:'STRING[1]', Variante:'STRING[1]' },
  tests:[[{Scanner:'A-0042-B'},{Code_OK:true, Typ:'A', Nummer:42, Variante:'B'}],[{Scanner:'K-1234-Z'},{Code_OK:true, Typ:'K', Nummer:1234, Variante:'Z'}],[{Scanner:'A-42-B'},{Code_OK:false, Typ:'', Nummer:0, Variante:''}],[{Scanner:'AB-004-C'},{Code_OK:false}],[{Scanner:'A-00421B'},{Code_OK:false}]],
  bind:['displayText=Scanner','displayValue=Nummer','displayLabel:"NUMMER"','lightGreen=Code_OK'],
  wrong:[{ FC_Barcode: BC_REF.replace("\n               AND MID(IN := #Code, L := 1, P := 7) = '-'", '') }, { FC_Barcode: BC_REF.replace('MID(IN := #Code, L := 4, P := 3)', 'MID(IN := #Code, L := 4, P := 2)') }]
});

/* ---------- 139 ---------- */
const ST_REF = (n) => 'FUNCTION "FC_Stoermeldung" : String[30]\nVAR_INPUT\n   Band : Int;\nEND_VAR\nVAR_TEMP\n   Text : String[' + n + '];\nEND_VAR\nBEGIN\n   #Text := \'Störung Band \';\n   #Text := CONCAT(IN1 := #Text, IN2 := INT_TO_STRING(#Band));\n   #FC_Stoermeldung := #Text;\nEND_FUNCTION';
defProTask({ id:'p14_kurz_dbg', ch:14, title:'Der zu kurze Text', debug:true,
  story:'Auf dem HMI steht nur noch „Störu“. Die Nachtschicht rätselt, welches Band gemeint ist. ARIA: "Kurz und bündig. Ich hasse Geschwätz."',
  brief:'<code>FC_Stoermeldung</code> soll <code>Störung Band &lt;Nr&gt;</code> liefern, z.B. <code>Störung Band 2</code>. Finde heraus, warum der Text abgeschnitten wird — der Compiler warnt dich.',
  learn:'Die maximale Länge eines STRING richtig wählen.',
  take:'Ein <code>String[5]</code> fasst höchstens 5 Zeichen — alles darüber wird in der SPS <b>ohne Fehlermeldung</b> abgeschnitten. Plane die Länge für den längsten möglichen Text.',
  man:'string', warnFree:['STRING_TRUNC'],
  hint:'Wie lang ist <code>\'Störung Band \'</code>? Und wie viele Zeichen passen in die TEMP-Variable?',
  blocks:[
    { name:'FC_Stoermeldung', kind:'FC', edit:true, start: ST_REF(5), ref: ST_REF(30) },
    { name:'Main', kind:'OB', src: MAIN('   "HMI_Text" := "FC_Stoermeldung"(Band := "Stoerung_Band");') }
  ],
  globals:{ Stoerung_Band:0, HMI_Text:'' }, types:{ HMI_Text:'STRING[30]' },
  tests:[[{Stoerung_Band:2},{HMI_Text:'Störung Band 2'}],[{Stoerung_Band:12},{HMI_Text:'Störung Band 12'}]],
  bind:['displayText=HMI_Text','lightRed:true']
});

/* ---------- 140 (Boss) ---------- */
const UDT_CHARGE = 'TYPE "UDT_Charge"\nVERSION : 0.1\n   STRUCT\n      Teile : Array[1..8] of "UDT_Teil";\n      Anzahl : Int;                         // belegte Plätze\n      Protokoll : Array[1..8] of String[30];\n      OK_Anzahl : Int;\n      Mittel : Real;                        // mittleres Gewicht\n      Zusammenfassung : String[30];\n   END_STRUCT;\nEND_TYPE';
const PR_HEAD = 'FUNCTION "FC_Protokoll" : Void\nVAR_IN_OUT\n   Charge : "UDT_Charge";\nEND_VAR\nVAR_TEMP\n   i : Int;\n   Summe : Real;\n   Ergebnis : String[3];\nEND_VAR\n';
const PR_REF = PR_HEAD + 'BEGIN\n   #Charge.OK_Anzahl := 0;\n   #Summe := 0.0;\n   FOR #i := 1 TO 8 DO\n      IF #i <= #Charge.Anzahl THEN\n         IF #Charge.Teile[#i].OK THEN\n            #Ergebnis := \'OK\';\n            #Charge.OK_Anzahl := #Charge.OK_Anzahl + 1;\n         ELSE\n            #Ergebnis := \'NOK\';\n         END_IF;\n         #Summe := #Summe + #Charge.Teile[#i].Gewicht;\n         #Charge.Protokoll[#i] := CONCAT(IN1 := \'Teil \', IN2 := DINT_TO_STRING(#Charge.Teile[#i].Nr), IN3 := \': \',\n                                          IN4 := INT_TO_STRING(REAL_TO_INT(#Charge.Teile[#i].Gewicht)), IN5 := \' g \', IN6 := #Ergebnis);\n      ELSE\n         #Charge.Protokoll[#i] := \'\';\n      END_IF;\n   END_FOR;\n   IF #Charge.Anzahl > 0 THEN\n      #Charge.Mittel := #Summe / INT_TO_REAL(#Charge.Anzahl);\n   ELSE\n      #Charge.Mittel := 0.0;\n   END_IF;\n   #Charge.Zusammenfassung := CONCAT(IN1 := \'OK \', IN2 := INT_TO_STRING(#Charge.OK_Anzahl), IN3 := \'/\', IN4 := INT_TO_STRING(#Charge.Anzahl));\nEND_FUNCTION';
defProTask({ id:'p14_boss', ch:14, title:'Boss: Das Chargenprotokoll', boss:true,
  story:'Der Kunde verlangt für jede Charge ein Protokoll — Zeile für Zeile, mit Statistik. ARIA hat die alten Protokolle gefälscht. Diesmal schreibt die Zelle selbst, was wirklich passiert ist.',
  brief:'Der Datentyp <code>"UDT_Charge"</code> (🔒) enthält <code>Teile</code> (8 × "UDT_Teil"), <code>Anzahl</code> (wie viele Plätze belegt sind), <code>Protokoll</code> (8 Textzeilen), <code>OK_Anzahl</code>, <code>Mittel</code> und <code>Zusammenfassung</code>. Schreibe <code>FC_Protokoll</code> (IN_OUT <code>Charge</code>):<br>• für jeden belegten Platz <code>i</code> (1…<code>Anzahl</code>) die Zeile <code>Teil &lt;Nr&gt;: &lt;Gewicht gerundet&gt; g OK</code> bzw. <code>… g NOK</code> — freie Plätze bekommen <code>\'\'</code><br>• <code>OK_Anzahl</code> = Anzahl der OK-Teile, <code>Mittel</code> = mittleres Gewicht der belegten Plätze (0.0 bei leerer Charge)<br>• <code>Zusammenfassung</code> = <code>OK &lt;OK_Anzahl&gt;/&lt;Anzahl&gt;</code>, z.B. <code>OK 5/7</code><br><code>Main</code> (🔒) ruft <code>"FC_Protokoll"(Charge := "DB_Charge");</code> auf.',
  learn:'UDT, Datenbaustein, Schleife und Texte zu einer vollständigen Auswertung verbinden.',
  take:'Mit einem gut gebauten Datentyp wird selbst eine komplexe Auswertung übersichtlich: ein Parameter, eine Schleife, klare Namen. Genau so sehen Protokoll- und Rezeptbausteine in echten Anlagen aus.',
  man:'string', must:['FOR','CONCAT','UDT_REF','VAR_IN_OUT'], warnFree:['TEMP_READ_BEFORE_WRITE','STRING_TRUNC'],
  hint:'Eine FOR-Schleife von 1 bis 8, darin <code>IF #i &lt;= #Charge.Anzahl THEN … ELSE #Charge.Protokoll[#i] := \'\'; END_IF;</code>',
  hint2:'Das Gewicht runden: <code>INT_TO_STRING(REAL_TO_INT(#Charge.Teile[#i].Gewicht))</code>. CONCAT verträgt mehrere Eingänge: <code>IN1</code> … <code>IN6</code>.',
  blocks:[
    { name:'UDT_Teil', kind:'UDT', src: UDT_TEIL },
    { name:'UDT_Charge', kind:'UDT', src: UDT_CHARGE },
    { name:'DB_Charge', kind:'DB', src:'DATA_BLOCK "DB_Charge"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n"UDT_Charge"\nBEGIN\nEND_DATA_BLOCK' },
    { name:'FC_Protokoll', kind:'FC', edit:true, start: PR_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: PR_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Protokoll"(Charge := "DB_Charge");') }
  ],
  globals:{},
  tests:[
    [{'DB_Charge.Teile':CH1, 'DB_Charge.Anzahl':7},{'DB_Charge.Protokoll':['Teil 101: 498 g OK','Teil 102: 523 g NOK','Teil 103: 505 g OK','Teil 104: 476 g NOK','Teil 105: 512 g OK','Teil 106: 531 g NOK','Teil 107: 500 g OK',''], 'DB_Charge.OK_Anzahl':4, 'DB_Charge.Mittel':506.4286, 'DB_Charge.Zusammenfassung':'OK 4/7'}],
    [{'DB_Charge.Teile':[teil(9,499.6)].concat(CH2.slice(1)), 'DB_Charge.Anzahl':1},{'DB_Charge.Protokoll':['Teil 9: 500 g OK','','','','','','',''], 'DB_Charge.Mittel':499.6, 'DB_Charge.Zusammenfassung':'OK 1/1'}],
    [{'DB_Charge.Anzahl':0},{'DB_Charge.Mittel':0, 'DB_Charge.Zusammenfassung':'OK 0/0', 'DB_Charge.OK_Anzahl':0}]
  ],
  bind:['displayText=DB_Charge.Zusammenfassung','displayValue=DB_Charge.Mittel','displayLabel:"MITTEL g"'],
  wrong:[
    { FC_Protokoll: PR_REF.replace('#Summe / INT_TO_REAL(#Charge.Anzahl)', '#Summe / 8.0') },
    { FC_Protokoll: PR_REF.replace('IF #i <= #Charge.Anzahl THEN', 'IF #i < #Charge.Anzahl THEN') }
  ]
});
})();
