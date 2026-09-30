/* ===== KAPITEL 12 — Werkzeuge bauen: Funktionen (FC) — Profi-Stufe ===== */
(function(){
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';
function puls(n, sig, expFn){ const o = []; for(let i = 1; i <= n; i++){ o.push([0.1, {[sig]: true}, expFn ? expFn(i) : {}]); o.push([0.1, {[sig]: false}, {}]); } return o; }

/* ---------- gemeinsame Bausteine ---------- */
const MAX3_HEAD = 'FUNCTION "FC_Max3" : Int\nVAR_INPUT\n   a : Int;\n   b : Int;\n   c : Int;\nEND_VAR\n';
const MAX3_REF = MAX3_HEAD + 'BEGIN\n   #FC_Max3 := #a;\n   IF #b > #FC_Max3 THEN\n      #FC_Max3 := #b;\n   END_IF;\n   IF #c > #FC_Max3 THEN\n      #FC_Max3 := #c;\n   END_IF;\nEND_FUNCTION';
const SKAL_REF = 'FUNCTION "FC_Skalieren" : Real\nVAR_INPUT\n   Roh : Int;    // Analogwert 0…27648\n   UG : Real;    // Untergrenze der Messgrösse\n   OG : Real;    // Obergrenze der Messgrösse\nEND_VAR\nBEGIN\n   #FC_Skalieren := #UG + (#OG - #UG) * INT_TO_REAL(#Roh) / 27648.0;\nEND_FUNCTION';
const GW_HEAD = 'FUNCTION "FC_Grenzwert" : Real\nVAR_INPUT\n   Wert : Real;\n   Min : Real;\n   Max : Real;\nEND_VAR\nVAR_OUTPUT\n   Zu_hoch : Bool;\n   Zu_tief : Bool;\nEND_VAR\n';
const GW_REF = GW_HEAD + 'BEGIN\n   #Zu_hoch := #Wert > #Max;\n   #Zu_tief := #Wert < #Min;\n   IF #Zu_hoch THEN\n      #FC_Grenzwert := #Max;\n   ELSIF #Zu_tief THEN\n      #FC_Grenzwert := #Min;\n   ELSE\n      #FC_Grenzwert := #Wert;\n   END_IF;\nEND_FUNCTION';

/* ---------- 111 ---------- */
defProTask({ id:'p12_erste_fc', ch:12, title:'Die erste Funktion',
  story:'Der Werkmeister wirft dir einen Schraubenschlüssel zu: "Werkzeug baut man einmal und benutzt es hundertmal." In SCL heisst dieses Werkzeug Funktion, kurz FC.',
  brief:'Schreibe den Code von <code>FC_Max3</code>: Die FC liefert den <b>grössten</b> der drei Eingänge <code>a</code>, <code>b</code>, <code>c</code> (Int). Den Rückgabewert setzt du über den Funktionsnamen: <code>#FC_Max3 := …;</code>',
  learn:'Eine Funktion mit Rückgabewert schreiben.',
  take:'Eine FC ist ein Werkzeug: Werte rein, Ergebnis raus. Den Rückgabewert setzt man über den Funktionsnamen (<code>#FC_Max3 := …</code>) — und zwar in jedem möglichen Ablauf.',
  man:'fc', must:['FC','RETVAL'], warnFree:['RET_NOT_SET'],
  hint:'Setze <code>#FC_Max3 := #a;</code> und prüfe dann nacheinander, ob <code>b</code> oder <code>c</code> grösser ist.',
  blocks:[
    { name:'FC_Max3', kind:'FC', edit:true, start: MAX3_HEAD + 'BEGIN\n   // Grössten Wert zurückgeben\n\nEND_FUNCTION', ref: MAX3_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Groesster" := "FC_Max3"(a := "Wert1", b := "Wert2", c := "Wert3");') }
  ],
  globals:{ Wert1:0, Wert2:0, Wert3:0, Groesster:0 },
  unit:[{ block:'FC_Max3', steps:[[{a:3, b:9, c:4},{RET:9}],[{a:12, b:9, c:4},{RET:12}],[{a:-5, b:-9, c:-2},{RET:-2}],[{a:7, b:7, c:7},{RET:7}]] }],
  tests:[[{Wert1:120, Wert2:340, Wert3:95},{Groesster:340}],[{Wert1:5, Wert2:1, Wert3:50},{Groesster:50}]],
  bind:['displayValue=Groesster','displayLabel:"MAX"'],
  wrong:[
    { FC_Max3: MAX3_HEAD + 'BEGIN\n   IF #a > #b THEN\n      #FC_Max3 := #a;\n   ELSE\n      #FC_Max3 := #b;\n   END_IF;\nEND_FUNCTION' },
    { FC_Max3: MAX3_HEAD + 'BEGIN\n   IF #a >= #b AND #a >= #c THEN\n      #FC_Max3 := #a;\n   ELSIF #b >= #c THEN\n      #FC_Max3 := #b;\n   END_IF;\nEND_FUNCTION' }
  ]
});

/* ---------- 112 ---------- */
defProTask({ id:'p12_aufruf', ch:12, title:'Die FC aufrufen',
  story:'Das Werkzeug liegt im Regal (🔒) und soll jetzt für drei Waagen und drei Temperaturfühler arbeiten. ARIA hofft, dass du alles doppelt programmierst.',
  brief:'Schreibe <code>Main</code>: Rufe <code>"FC_Max3"</code> <b>zweimal</b> mit Formalparametern auf, für das schwerste der drei Teilegewichte und für die höchste der drei Temperaturen. Globale Variablen stehen in Anführungszeichen.',
  learn:'Eine Funktion mit Formalparametern aufrufen und mehrfach verwenden.',
  take:'Eine FC wird mit Namen und Parametern aufgerufen: <code>"FC_Max3"(a := x, b := y, c := z)</code>. Bei einer FC müssen <b>alle</b> Parameter versorgt werden. Ein Werkzeug — beliebig viele Einsätze.',
  man:'fc', must:['FC_CALL'],
  hint:'Zwei Zuweisungen, rechts jeweils ein Aufruf: <code>"Schwerstes" := "FC_Max3"(a := "Gewicht1", b := "Gewicht2", c := "Gewicht3");</code>',
  blocks:[
    { name:'FC_Max3', kind:'FC', src: MAX3_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // Schwerstes Teil und heissester Fühler\n'),
      ref: MAIN('   "Schwerstes" := "FC_Max3"(a := "Gewicht1", b := "Gewicht2", c := "Gewicht3");\n   "Heissester" := "FC_Max3"(a := "Temp1", b := "Temp2", c := "Temp3");') }
  ],
  globals:{ Gewicht1:0, Gewicht2:0, Gewicht3:0, Temp1:0, Temp2:0, Temp3:0, Schwerstes:0, Heissester:0 },
  tests:[[{Gewicht1:498, Gewicht2:512, Gewicht3:505, Temp1:41, Temp2:39, Temp3:44},{Schwerstes:512, Heissester:44}],
    [{Gewicht1:530, Gewicht2:512, Gewicht3:505, Temp1:61, Temp2:39, Temp3:44},{Schwerstes:530, Heissester:61}],
    [{Gewicht1:400, Gewicht2:412, Gewicht3:505, Temp1:1, Temp2:72, Temp3:44},{Schwerstes:505, Heissester:72}]],
  bind:['displayValue=Schwerstes','displayLabel:"GRAMM"'],
  wrong:[{ Main: MAIN('   "Schwerstes" := "FC_Max3"(a := "Gewicht1", b := "Gewicht2", c := "Gewicht3");\n   "Heissester" := "FC_Max3"(a := "Temp1", b := "Temp2", c := "Temp2");') }]
});

/* ---------- 113 ---------- */
defProTask({ id:'p12_skalieren', ch:12, title:'Das Skalier-Werkzeug',
  story:'In Kapitel 3 hast du die Skalierung jedes Mal neu von Hand geschrieben. "Das ist das fünfte Mal, bau dir ein Werkzeug", brummt der Werkmeister.',
  brief:'Schreibe <code>FC_Skalieren</code> komplett (Rückgabe <code>Real</code>): Eingänge <code>Roh</code> (Int, 0…27648), <code>UG</code> und <code>OG</code> (Real). Rückgabe = UG + (OG − UG) · Roh / 27648, denke an <code>INT_TO_REAL</code>.',
  learn:'Eine vollständige FC mit Schnittstelle entwerfen — Umbau aus Kapitel 3.',
  take:'Einmal richtig geschrieben, ist die Skalierung für jeden Sensor wiederverwendbar: Füllstand, Druck, Temperatur — nur die Parameter ändern sich.',
  man:'fc', must:['FC','VAR_INPUT','INT_TO_REAL'],
  hint:'Der Rückgabetyp steht in der Kopfzeile: <code>FUNCTION "FC_Skalieren" : Real</code>. Die drei Eingänge gehören in <code>VAR_INPUT</code>.',
  hint2:'<code>#FC_Skalieren := #UG + (#OG - #UG) * INT_TO_REAL(#Roh) / 27648.0;</code>',
  blocks:[
    { name:'FC_Skalieren', kind:'FC', edit:true, start:'FUNCTION "FC_Skalieren" : Real\nVAR_INPUT\n   // Roh, UG, OG\nEND_VAR\nBEGIN\n   // Rohwert in die Messgrösse umrechnen\n\nEND_FUNCTION', ref: SKAL_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Fuellstand" := "FC_Skalieren"(Roh := "AI_Fuellstand", UG := 0.0, OG := 100.0);\n   "Druck" := "FC_Skalieren"(Roh := "AI_Druck", UG := 0.0, OG := 10.0);\n   "Temperatur" := "FC_Skalieren"(Roh := "AI_Temp", UG := -20.0, OG := 80.0);') }
  ],
  globals:{ AI_Fuellstand:0, AI_Druck:0, AI_Temp:0, Fuellstand:0, Druck:0, Temperatur:0 }, types:{ Fuellstand:'REAL', Druck:'REAL', Temperatur:'REAL' },
  unit:[{ block:'FC_Skalieren', steps:[[{Roh:27648, UG:0, OG:100},{RET:100}],[{Roh:13824, UG:0, OG:10},{RET:5}],[{Roh:0, UG:-20, OG:80},{RET:-20}]] }],
  tests:[[{AI_Fuellstand:13824, AI_Druck:27648, AI_Temp:6912},{Fuellstand:50, Druck:10, Temperatur:5}],[{AI_Fuellstand:2765, AI_Druck:0, AI_Temp:27648},{Fuellstand:10.001, Druck:0, Temperatur:80}]],
  bind:['displayValue=Fuellstand','displayLabel:"FÜLLST %"'],
  wrong:[{ FC_Skalieren:'FUNCTION "FC_Skalieren" : Real\nVAR_INPUT\n   Roh : Int;\n   UG : Real;\n   OG : Real;\nEND_VAR\nBEGIN\n   #FC_Skalieren := #OG * INT_TO_REAL(#Roh) / 27648.0;\nEND_FUNCTION' }]
});

/* ---------- 114 ---------- */
defProTask({ id:'p12_ausgaenge', ch:12, title:'Mehrere Ausgänge',
  story:'Ein Rückgabewert reicht nicht immer. Der Sollwert für die Heizung soll begrenzt werden — und die Anlage will wissen, <em>ob</em> begrenzt wurde.',
  brief:'Schreibe den Code von <code>FC_Grenzwert</code>: <code>#Zu_hoch</code> = Wert &gt; Max, <code>#Zu_tief</code> = Wert &lt; Min. Rückgabe: Max, wenn zu hoch – Min, wenn zu tief – sonst der Wert.',
  learn:'Eine FC mit Rückgabewert und zusätzlichen Ausgängen (VAR_OUTPUT).',
  take:'Zusätzliche Ergebnisse gibt eine FC über <code>VAR_OUTPUT</code> zurück. Beim Aufruf werden sie mit <code>=&gt;</code> verbunden: <code>Zu_hoch =&gt; "H_Rot"</code>.',
  man:'fc', must:['VAR_OUTPUT'], warnFree:['OUT_NOT_ALL_PATHS','RET_NOT_SET'],
  hint:'Setze die beiden Bool-Ausgänge gleich am Anfang mit einem Vergleich. Danach entscheidet ein IF/ELSIF/ELSE über den Rückgabewert.',
  blocks:[
    { name:'FC_Grenzwert', kind:'FC', edit:true, start: GW_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: GW_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Soll_Begrenzt" := "FC_Grenzwert"(Wert := "Sollwert", Min := 20.0, Max := 80.0,\n                                    Zu_hoch => "H_Rot", Zu_tief => "H_Gelb");') }
  ],
  globals:{ Sollwert:0, Soll_Begrenzt:0, H_Rot:false, H_Gelb:false }, types:{ Sollwert:'REAL', Soll_Begrenzt:'REAL' },
  unit:[{ block:'FC_Grenzwert', steps:[[{Wert:50, Min:20, Max:80},{RET:50, Zu_hoch:false, Zu_tief:false}],[{Wert:95.5},{RET:80, Zu_hoch:true, Zu_tief:false}],[{Wert:-3},{RET:20, Zu_hoch:false, Zu_tief:true}],[{Wert:80},{RET:80, Zu_hoch:false}]] }],
  tests:[[{Sollwert:65},{Soll_Begrenzt:65, H_Rot:false, H_Gelb:false}],[{Sollwert:120},{Soll_Begrenzt:80, H_Rot:true, H_Gelb:false}],[{Sollwert:5},{Soll_Begrenzt:20, H_Rot:false, H_Gelb:true}]],
  bind:['displayValue=Soll_Begrenzt','displayLabel:"SOLL °C"','lightRed=H_Rot','lightYellow=H_Gelb'],
  wrong:[{ FC_Grenzwert: GW_HEAD + 'BEGIN\n   #Zu_hoch := #Wert > #Max;\n   #Zu_tief := #Wert < #Min;\n   #FC_Grenzwert := LIMIT(MN := #Min, IN := #Wert, MX := #Max);\n   #Zu_tief := FALSE;\nEND_FUNCTION' }]
});

/* ---------- 115 ---------- */
const W_HEAD = 'FUNCTION "FC_Weiche" : Void\nVAR_INPUT\n   Gewicht : Real;\n   Farbe_OK : Bool;\nEND_VAR\nVAR_OUTPUT\n   Winkel : Int;    // +20 = GUT, -20 = AUSSCHUSS\n   Gut : Bool;\nEND_VAR\n';
defProTask({ id:'p12_zweige_dbg', ch:12, title:'Der vergessene Zweig', debug:true,
  story:'Gute Teile landen richtig — aber Ausschuss fährt geradeaus durch die Weiche. ARIA: "Wer nichts sagt, sagt auch nichts Falsches."',
  brief:'<code>FC_Weiche</code> soll gute Teile (480…520 g <b>und</b> Farbe OK) mit Winkel 20 und Gut = TRUE ausleiten, alle anderen mit Winkel −20 und Gut = FALSE. Beachte die Compiler-<b>Warnung</b>.',
  learn:'Ausgänge einer FC in jedem Programmzweig beschreiben.',
  take:'Eine FC hat kein Gedächtnis. Wird ein Ausgang in einem Zweig nicht beschrieben, ist sein Wert <b>undefiniert</b> — in einer echten SPS steht dort irgendein Rest. Setze jeden Ausgang in jedem Zweig — oder gleich am Anfang auf einen sicheren Standardwert.',
  man:'fc', warnFree:['OUT_NOT_ALL_PATHS'],
  hint:'Was passiert mit <code>Winkel</code> und <code>Gut</code>, wenn die IF-Bedingung FALSE ist?',
  blocks:[
    { name:'FC_Weiche', kind:'FC', edit:true,
      start: W_HEAD + 'BEGIN\n   IF #Gewicht >= 480.0 AND #Gewicht <= 520.0 AND #Farbe_OK THEN\n      #Winkel := 20;\n      #Gut := TRUE;\n   END_IF;\nEND_FUNCTION',
      ref: W_HEAD + 'BEGIN\n   IF #Gewicht >= 480.0 AND #Gewicht <= 520.0 AND #Farbe_OK THEN\n      #Winkel := 20;\n      #Gut := TRUE;\n   ELSE\n      #Winkel := -20;\n      #Gut := FALSE;\n   END_IF;\nEND_FUNCTION' },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Weiche"(Gewicht := "Gewicht", Farbe_OK := "Farbe_OK", Winkel => "Weiche_Winkel", Gut => "Teil_Gut");') }
  ],
  globals:{ Gewicht:0, Farbe_OK:false, Weiche_Winkel:0, Teil_Gut:false }, types:{ Gewicht:'REAL' },
  tests:[[{Gewicht:501, Farbe_OK:true},{Weiche_Winkel:20, Teil_Gut:true}],[{Gewicht:530, Farbe_OK:true},{Weiche_Winkel:-20, Teil_Gut:false}],[{Gewicht:500, Farbe_OK:false},{Weiche_Winkel:-20, Teil_Gut:false}]],
  bind:['gateAngle=Weiche_Winkel',{channel:'partColor', variable:'Teil_Gut', map:{'true':'green','false':'red'}},'partVisible:true']
});

/* ---------- 116 ---------- */
const SORT_HEAD = 'FUNCTION "FC_Sortieren" : Void\nVAR_IN_OUT\n   Werte : Array[1..5] of Int;   // wird direkt sortiert\nEND_VAR\nVAR_TEMP\n   i : Int;\n   j : Int;\n   h : Int;   // Hilfsvariable zum Tauschen\nEND_VAR\n';
defProTask({ id:'p12_inout', ch:12, title:'IN_OUT: Werte direkt verändern',
  story:'Die Prüfstation liefert fünf Messwerte in zufälliger Reihenfolge. Für das Protokoll müssen sie sortiert werden — und zwar direkt in der Messreihe, ohne sie hin und her zu kopieren.',
  brief:'<code>FC_Sortieren</code> bekommt die Messreihe als <code>VAR_IN_OUT</code> und sortiert <code>#Werte[1..5]</code> direkt <b>aufsteigend</b> (Bubblesort: <code>FOR #i := 1 TO 4</code>, darin <code>FOR #j := 1 TO 5 - #i</code>, Nachbarn tauschen).',
  learn:'IN_OUT-Parameter: Übergabe als Verweis statt als Kopie.',
  take:'Ein <code>VAR_INPUT</code> ist eine <b>Kopie</b> — Änderungen bleiben in der FC. Ein <code>VAR_IN_OUT</code> ist ein <b>Verweis</b> auf die Variable des Aufrufers — die FC verändert das Original. Deshalb muss man dort immer eine Variable übergeben, nie einen festen Wert.',
  man:'fc', must:['FOR','VAR_IN_OUT'],
  hint:'Tauschen mit Hilfsvariable: <code>#h := #Werte[#j]; #Werte[#j] := #Werte[#j + 1]; #Werte[#j + 1] := #h;</code>',
  blocks:[
    { name:'FC_Sortieren', kind:'FC', edit:true, start: SORT_HEAD + 'BEGIN\n   // aufsteigend sortieren\n\nEND_FUNCTION',
      ref: SORT_HEAD + 'BEGIN\n   FOR #i := 1 TO 4 DO\n      FOR #j := 1 TO 5 - #i DO\n         IF #Werte[#j] > #Werte[#j + 1] THEN\n            #h := #Werte[#j];\n            #Werte[#j] := #Werte[#j + 1];\n            #Werte[#j + 1] := #h;\n         END_IF;\n      END_FOR;\n   END_FOR;\nEND_FUNCTION' },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Sortieren"(Werte := "Messreihe");\n   "Kleinster" := "Messreihe"[1];\n   "Groesster" := "Messreihe"[5];') }
  ],
  globals:{ Messreihe:[0,0,0,0,0], Kleinster:0, Groesster:0 }, types:{ Messreihe:'ARRAY[1..5] OF INT' },
  tests:[[{Messreihe:[5,3,9,1,4]},{Messreihe:[1,3,4,5,9], Kleinster:1, Groesster:9}],[{Messreihe:[50,40,30,20,10]},{Messreihe:[10,20,30,40,50]}],[{Messreihe:[7,7,-2,7,0]},{Messreihe:[-2,0,7,7,7]}]],
  bind:['displayValue=Groesster','displayLabel:"MAX"'],
  wrong:[{ FC_Sortieren: SORT_HEAD + 'BEGIN\n   FOR #i := 1 TO 4 DO\n      IF #Werte[#i] > #Werte[#i + 1] THEN\n         #h := #Werte[#i];\n         #Werte[#i] := #Werte[#i + 1];\n         #Werte[#i + 1] := #h;\n      END_IF;\n   END_FOR;\nEND_FUNCTION' }]
});

/* ---------- 117 ---------- */
const AMPEL_REF = 'FUNCTION "FC_Ampel" : Void\nVAR_INPUT\n   Zustand : Int;   // 0 Aus, 1 Betrieb, 2 Warnung, 3 Störung\nEND_VAR\nVAR_OUTPUT\n   Rot : Bool;\n   Gelb : Bool;\n   Gruen : Bool;\nEND_VAR\nBEGIN\n   #Rot := FALSE;\n   #Gelb := FALSE;\n   #Gruen := FALSE;\n   CASE #Zustand OF\n      0: ;\n      1: #Gruen := TRUE;\n      2: #Gelb := TRUE;\n      3: #Rot := TRUE;\n   ELSE\n      #Rot := TRUE;\n      #Gelb := TRUE;\n   END_CASE;\nEND_FUNCTION';
defProTask({ id:'p12_void', ch:12, title:'FC ohne Rückgabewert',
  story:'Die Signalsäule braucht drei Signale gleichzeitig, ein einzelner Rückgabewert passt nicht. "Dann eben gar keiner, Void heisst: nichts", sagt der Werkmeister.',
  brief:'Schreibe <code>FC_Ampel</code> komplett (<code>: Void</code>): Eingang <code>Zustand</code> (Int), Ausgänge <code>Rot</code>, <code>Gelb</code>, <code>Gruen</code> (Bool). Mit <code>CASE</code>: 0 alle aus, 1 grün, 2 gelb, 3 rot, jeder andere Wert rot <b>und</b> gelb.',
  learn:'Eine FC mit Rückgabetyp Void und mehreren Ausgängen.',
  take:'<code>: Void</code> bedeutet: keine Rückgabe. Die FC wird dann als eigene Anweisung aufgerufen: <code>"FC_Ampel"(Zustand := …, Rot =&gt; …);</code>. Alle Ergebnisse laufen über <code>VAR_OUTPUT</code>.',
  man:'fc', must:['VOID','CASE','VAR_OUTPUT'], warnFree:['OUT_NOT_ALL_PATHS'],
  hint:'Setze alle drei Ausgänge zuerst auf FALSE. Dann schaltet der CASE nur noch die richtige Lampe ein.',
  blocks:[
    { name:'FC_Ampel', kind:'FC', edit:true, start:'FUNCTION "FC_Ampel" : Void\n// Schnittstelle: Zustand (Int) → Rot, Gelb, Gruen (Bool)\n\nBEGIN\n\nEND_FUNCTION', ref: AMPEL_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Ampel"(Zustand := "Zellen_Zustand", Rot => "H_Rot", Gelb => "H_Gelb", Gruen => "H_Gruen");') }
  ],
  globals:{ Zellen_Zustand:0, H_Rot:false, H_Gelb:false, H_Gruen:false },
  tests:[[{Zellen_Zustand:0},{H_Rot:false, H_Gelb:false, H_Gruen:false}],[{Zellen_Zustand:1},{H_Rot:false, H_Gelb:false, H_Gruen:true}],[{Zellen_Zustand:2},{H_Rot:false, H_Gelb:true, H_Gruen:false}],[{Zellen_Zustand:3},{H_Rot:true, H_Gelb:false, H_Gruen:false}],[{Zellen_Zustand:7},{H_Rot:true, H_Gelb:true, H_Gruen:false}]],
  timed:[{ steps:[[0.1,{Zellen_Zustand:1},{H_Gruen:true}],[0.1,{Zellen_Zustand:3},{H_Gruen:false, H_Rot:true}]] }],
  bind:['lightRed=H_Rot','lightYellow=H_Gelb','lightGreen=H_Gruen','displayValue=Zellen_Zustand','displayLabel:"ZUSTAND"'],
  wrong:[{ FC_Ampel:'FUNCTION "FC_Ampel" : Void\nVAR_INPUT\n   Zustand : Int;\nEND_VAR\nVAR_OUTPUT\n   Rot : Bool;\n   Gelb : Bool;\n   Gruen : Bool;\nEND_VAR\nBEGIN\n   CASE #Zustand OF\n      1: #Gruen := TRUE;\n      2: #Gelb := TRUE;\n      3: #Rot := TRUE;\n   END_CASE;\nEND_FUNCTION' }]
});

/* ---------- 118 ---------- */
defProTask({ id:'p12_fc_speicher_dbg', ch:12, title:'Der Zähler, der nicht zählt', debug:true,
  story:'ARIAs Stückzähler als Funktion zeigt nie mehr als 1. "Funktionen sind so schön vergesslich", säuselt sie.',
  brief:'<code>FC_Zaehlen</code> vergisst den Zählerstand. Baue daraus <code>FUNCTION_BLOCK "FB_Zaehlen"</code>: Eingang <code>Impuls</code>, Ausgang <code>Anzahl</code> (Int), statisch <code>Zaehler</code> und <code>Alt</code>; in <code>Main</code> über <code>"FB_Zaehlen_DB"</code> mit Teilesensor und Stückzahl aufrufen.',
  learn:'Erkennen, wann eine FC nicht reicht und ein FB (mit Gedächtnis) nötig ist.',
  take:'<b>FC</b> = Werkzeug ohne Gedächtnis (Rechnen, Umrechnen, Prüfen). <b>FB</b> = Baustein mit Gedächtnis in seinem Instanz-DB (Zähler, Flanken, Timer, Selbsthaltung). Muss sich etwas über den Zyklus hinaus merken, brauchst du einen FB.',
  man:'fb', must:['FB','STAT','SINGLE'], warnFree:['TEMP_READ_BEFORE_WRITE'],
  hint:'Aus <code>FUNCTION "FC_Zaehlen" : Int</code> wird <code>FUNCTION_BLOCK "FB_Zaehlen"</code>, aus <code>VAR_TEMP</code> wird <code>VAR</code>, aus dem Rückgabewert ein <code>VAR_OUTPUT</code>. Ende: <code>END_FUNCTION_BLOCK</code>.',
  blocks:[
    { name:'Zaehler', kind:'FB', edit:true, free:true,
      start:'FUNCTION "FC_Zaehlen" : Int\nVAR_INPUT\n   Impuls : Bool;\nEND_VAR\nVAR_TEMP\n   Zaehler : Int;\n   Alt : Bool;\nEND_VAR\nBEGIN\n   IF #Impuls AND NOT #Alt THEN\n      #Zaehler := #Zaehler + 1;\n   END_IF;\n   #Alt := #Impuls;\n   #FC_Zaehlen := #Zaehler;\nEND_FUNCTION',
      ref:'FUNCTION_BLOCK "FB_Zaehlen"\nVAR_INPUT\n   Impuls : Bool;\nEND_VAR\nVAR_OUTPUT\n   Anzahl : Int;\nEND_VAR\nVAR\n   Zaehler : Int;\n   Alt : Bool;\nEND_VAR\nBEGIN\n   IF #Impuls AND NOT #Alt THEN\n      #Zaehler := #Zaehler + 1;\n   END_IF;\n   #Alt := #Impuls;\n   #Anzahl := #Zaehler;\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   "Stueckzahl" := "FC_Zaehlen"(Impuls := "Teil_Sensor");'), ref: MAIN('   "FB_Zaehlen_DB"(Impuls := "Teil_Sensor", Anzahl => "Stueckzahl");') }
  ],
  globals:{ Teil_Sensor:false, Stueckzahl:0 },
  timed:[{ steps: puls(4, 'Teil_Sensor', i => ({Stueckzahl:i})) }],
  bind:['displayValue=Stueckzahl','displayLabel:"STÜCK"','sensorActive=Teil_Sensor','partVisible=Teil_Sensor']
});

/* ---------- 119 ---------- */
defProTask({ id:'p12_bibliothek', ch:12, title:'Die eigene Bibliothek',
  story:'Deine Werkzeuge <code>FC_Skalieren</code> und <code>FC_Grenzwert</code> liegen jetzt geprüft in der Bibliothek (🔒). Der Druckbehälter braucht beide auf einmal.',
  brief:'Schreibe <code>Main</code>: Den Druck-Rohwert mit <code>FC_Skalieren</code> auf 0…10 bar skalieren, dann mit <code>FC_Grenzwert</code> auf 2…8 bar begrenzen (zu hoch/zu tief auf die beiden Alarme). Das Ventil ist offen, wenn <b>kein</b> Alarm ansteht.',
  learn:'Mehrere eigene Funktionen in einem Programm kombinieren.',
  take:'Getestete Bausteine aus der Bibliothek machen neue Programme kurz und sicher. Das Ergebnis der einen FC ist der Eingang der nächsten.',
  man:'fc', must:['FC_CALL'],
  hint:'Die Werte fliessen von oben nach unten: erst skalieren, dann begrenzen, dann entscheiden.',
  blocks:[
    { name:'FC_Skalieren', kind:'FC', src: SKAL_REF },
    { name:'FC_Grenzwert', kind:'FC', src: GW_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // 1. skalieren  2. begrenzen  3. Ventil\n'),
      ref: MAIN('   "Druck" := "FC_Skalieren"(Roh := "AI_Druck", UG := 0.0, OG := 10.0);\n   "Druck_Begrenzt" := "FC_Grenzwert"(Wert := "Druck", Min := 2.0, Max := 8.0,\n                                     Zu_hoch => "Alarm_Hoch", Zu_tief => "Alarm_Tief");\n   "Ventil_Auf" := NOT "Alarm_Hoch" AND NOT "Alarm_Tief";') }
  ],
  globals:{ AI_Druck:0, Druck:0, Druck_Begrenzt:0, Alarm_Hoch:false, Alarm_Tief:false, Ventil_Auf:false }, types:{ Druck:'REAL', Druck_Begrenzt:'REAL' },
  tests:[[{AI_Druck:13824},{Druck:5, Druck_Begrenzt:5, Alarm_Hoch:false, Alarm_Tief:false, Ventil_Auf:true}],[{AI_Druck:27648},{Druck:10, Druck_Begrenzt:8, Alarm_Hoch:true, Ventil_Auf:false}],[{AI_Druck:2765},{Druck:1, Druck_Begrenzt:2, Alarm_Tief:true, Ventil_Auf:false}]],
  bind:['displayValue=Druck_Begrenzt','displayLabel:"BAR"','lightRed=Alarm_Hoch','lightYellow=Alarm_Tief','lightGreen=Ventil_Auf'],
  wrong:[{ Main: MAIN('   "Druck" := "FC_Skalieren"(Roh := "AI_Druck", UG := 0.0, OG := 10.0);\n   "Druck_Begrenzt" := "FC_Grenzwert"(Wert := "Druck", Min := 2.0, Max := 8.0, Zu_hoch => "Alarm_Hoch", Zu_tief => "Alarm_Tief");\n   "Ventil_Auf" := NOT "Alarm_Hoch";') }]
});

/* ---------- 120 (Boss) ---------- */
const MW_REF = 'FUNCTION "FC_Messwert" : Real\nVAR_INPUT\n   Roh : Int;       // Analogwert\n   UG : Real;       // Messbereich unten\n   OG : Real;       // Messbereich oben\n   Min : Real;      // Alarmgrenze unten\n   Max : Real;      // Alarmgrenze oben\nEND_VAR\nVAR_OUTPUT\n   Status : Int;    // 0 OK, 1 Drahtbruch, 2 Überlauf\n   Alarm : Bool;\nEND_VAR\nVAR_TEMP\n   Wert : Real;\nEND_VAR\nBEGIN\n   IF #Roh < 0 THEN\n      #Status := 1;\n      #Alarm := TRUE;\n      #FC_Messwert := #UG;\n   ELSIF #Roh > 27648 THEN\n      #Status := 2;\n      #Alarm := TRUE;\n      #FC_Messwert := #UG;\n   ELSE\n      #Wert := #UG + (#OG - #UG) * INT_TO_REAL(#Roh) / 27648.0;\n      #Status := 0;\n      #Alarm := #Wert < #Min OR #Wert > #Max;\n      #FC_Messwert := #Wert;\n   END_IF;\nEND_FUNCTION';
const MW_MAIN = MAIN('   "Temp" := "FC_Messwert"(Roh := "AI_Temp", UG := 0.0, OG := 150.0, Min := 10.0, Max := 120.0,\n                           Status => "Status_Temp", Alarm => "Alarm_Temp");\n   "Druck" := "FC_Messwert"(Roh := "AI_Druck", UG := 0.0, OG := 10.0, Min := 1.0, Max := 8.0,\n                            Status => "Status_Druck", Alarm => "Alarm_Druck");\n   "Fuellstand" := "FC_Messwert"(Roh := "AI_Fuell", UG := 0.0, OG := 100.0, Min := 5.0, Max := 95.0,\n                                 Status => "Status_Fuell", Alarm => "Alarm_Fuell");\n   "Sammelalarm" := "Alarm_Temp" OR "Alarm_Druck" OR "Alarm_Fuell";');
defProTask({ id:'p12_boss', ch:12, title:'Boss: Messwert-Aufbereitung', boss:true,
  story:'ARIA manipuliert die Analogsignale: Drahtbrüche, Überläufe, Werte ausserhalb jeder Grenze. Der Werkmeister: "Ein Profi schreibt die Aufbereitung einmal — sauber, mit Status — und setzt sie für jeden Sensor ein."',
  brief:'1. <code>FC_Messwert : Real</code> mit Eingängen <code>Roh</code> (Int), <code>UG</code>, <code>OG</code>, <code>Min</code>, <code>Max</code> (Real), Ausgängen <code>Status</code> (Int), <code>Alarm</code> (Bool): Roh &lt; 0 → Status 1; Roh &gt; 27648 → Status 2 (beide: Alarm, Rückgabe UG); sonst skalieren, Status 0, Alarm = Wert ausserhalb Min…Max.<br>2. <code>Main</code>: Temperatur 0…150 °C (Grenzen 10…120), Druck 0…10 bar (1…8), Füllstand 0…100 % (5…95), je Wert, Status und Alarm; Sammelalarm = einer der drei Alarme.',
  learn:'Eine robuste FC mit Statusausgabe entwerfen und mehrfach einsetzen.',
  take:'Gute Bausteine prüfen ihre Eingänge, melden einen Status und liefern auch im Fehlerfall einen definierten Wert. So bleibt die Anlage berechenbar — egal, was der Sensor liefert.',
  man:'fc', must:['FC','FC_CALL','VAR_OUTPUT'], warnFree:['OUT_NOT_ALL_PATHS','RET_NOT_SET','TEMP_READ_BEFORE_WRITE'],
  hint:'Ein IF / ELSIF / ELSE mit drei Zweigen. In <b>jedem</b> Zweig werden <code>Status</code>, <code>Alarm</code> und der Rückgabewert gesetzt.',
  hint2:'Für den Normalfall lohnt sich eine TEMP-Variable <code>Wert : Real</code>: erst skalieren, dann mit Min/Max vergleichen, dann zurückgeben.',
  blocks:[
    { name:'FC_Messwert', kind:'FC', edit:true, start:'FUNCTION "FC_Messwert" : Real\n// Eingänge: Roh, UG, OG, Min, Max    Ausgänge: Status, Alarm\n\nBEGIN\n\nEND_FUNCTION', ref: MW_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // drei Sensoren aufbereiten, Sammelalarm bilden\n'), ref: MW_MAIN }
  ],
  globals:{ AI_Temp:0, AI_Druck:0, AI_Fuell:0, Temp:0, Druck:0, Fuellstand:0, Status_Temp:0, Status_Druck:0, Status_Fuell:0, Alarm_Temp:false, Alarm_Druck:false, Alarm_Fuell:false, Sammelalarm:false },
  types:{ Temp:'REAL', Druck:'REAL', Fuellstand:'REAL' },
  unit:[{ block:'FC_Messwert', steps:[[{Roh:13824, UG:0, OG:100, Min:5, Max:95},{RET:50, Status:0, Alarm:false}],[{Roh:-1},{RET:0, Status:1, Alarm:true}],[{Roh:32767},{RET:0, Status:2, Alarm:true}],[{Roh:27648},{RET:100, Status:0, Alarm:true}],[{Roh:0, UG:-20, OG:80, Min:-30, Max:90},{RET:-20, Status:0, Alarm:false}]] }],
  tests:[
    [{AI_Temp:13824, AI_Druck:13824, AI_Fuell:13824},{Temp:75, Druck:5, Fuellstand:50, Status_Temp:0, Sammelalarm:false}],
    [{AI_Temp:-5, AI_Druck:13824, AI_Fuell:13824},{Temp:0, Status_Temp:1, Alarm_Temp:true, Sammelalarm:true}],
    [{AI_Temp:13824, AI_Druck:32000, AI_Fuell:13824},{Druck:0, Status_Druck:2, Alarm_Druck:true, Alarm_Temp:false, Sammelalarm:true}],
    [{AI_Temp:13824, AI_Druck:13824, AI_Fuell:27000},{Fuellstand:97.656, Status_Fuell:0, Alarm_Fuell:true, Sammelalarm:true}]
  ],
  bind:['displayValue=Temp','displayLabel:"TEMP °C"','lightRed=Sammelalarm','lightYellow=Alarm_Druck'],
  wrong:[
    { FC_Messwert: MW_REF.replace('   ELSIF #Roh > 27648 THEN\n      #Status := 2;\n      #Alarm := TRUE;\n      #FC_Messwert := #UG;\n', '') },
    { Main: MW_MAIN.replace('"Sammelalarm" := "Alarm_Temp" OR "Alarm_Druck" OR "Alarm_Fuell";', '"Sammelalarm" := "Alarm_Temp" AND "Alarm_Druck" AND "Alarm_Fuell";') }
  ]
});
})();
