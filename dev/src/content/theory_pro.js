/* ============================================================
   THEORIE-AUFTRÄGE DER PROFI-STUFE (Kapitel 11–15)
   verifyPro / compilesPro / warnPro werden vom Validator mit der
   Profi-Engine (SCLPro) nachgerechnet.
   ============================================================ */
(function(){
const FBX = (decl, body) => 'FUNCTION_BLOCK "FB_X"\n' + decl + '\nBEGIN\n' + body + '\nEND_FUNCTION_BLOCK';
const OBM = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';

/* ---------------- Kapitel 11 ---------------- */
defTheory({ id:'t11a', ch:11, pos:'start', title:'Bausteine und ihre Schnittstelle', minutes:5,
  lesson:`
<p>Willkommen in der <b>Profi-Stufe</b>. Bisher waren alle Variablen schon angelegt, du hast nur Anweisungen geschrieben. Im TIA Portal ist das anders: Jeder <b>Baustein</b> hat eine <b>Schnittstelle</b>, in der jede Variable mit Bereich, Name und Datentyp <b>deklariert</b> ist.</p>
<pre class="code">FUNCTION_BLOCK "FB_Lampe"
VAR_INPUT
   Taster : Bool;      // kommt von aussen
END_VAR
VAR_OUTPUT
   Lampe : Bool;       // geht nach aussen
END_VAR
BEGIN
   #Lampe := #Taster;
END_FUNCTION_BLOCK</pre>
<h4>Die Bausteinarten</h4>
<table><tr><th>Baustein</th><th>Aufgabe</th></tr>
<tr><td>OB (Organisationsbaustein)</td><td>wird vom Betriebssystem aufgerufen, z.B. OB1 „Main“ in jedem Zyklus</td></tr>
<tr><td>FC (Funktion)</td><td>Werkzeug ohne Gedächtnis: rechnen, umwandeln, prüfen</td></tr>
<tr><td>FB (Funktionsbaustein)</td><td>Baustein mit Gedächtnis (Instanz-DB): zählen, speichern, Timer</td></tr>
<tr><td>DB (Datenbaustein)</td><td>Datenspeicher</td></tr></table>
<h4># und "…"</h4>
<p>Lokale Variablen der Schnittstelle schreibt man im Code mit <code>#</code>, globale Variablen und Bausteine in Anführungszeichen: <code>"S_Start"</code>. Der Datentyp entscheidet, welche Werte eine Variable annehmen kann: Bool, Int, DInt, Real, Time …</p>`,
  questions:[
    {type:'single', q:'Wo steht die Deklaration der Variablen in einem Baustein?', options:['Vor BEGIN, in VAR-Bereichen','Nach BEGIN, zwischen den Anweisungen','Nur in der PLC-Variablentabelle','Hinter END_FUNCTION_BLOCK'], correct:0,
     explain:'Die Schnittstelle steht zwischen Bausteinkopf und <code>BEGIN</code>. Danach folgt der Code.'},
    {type:'single', q:'Welcher Bereich passt für einen Starttaster, der von aussen in den Baustein kommt?', options:['VAR_INPUT','VAR_OUTPUT','VAR_TEMP','VAR CONSTANT'], correct:0,
     explain:'Signale, die von aussen kommen, sind Eingänge: <code>VAR_INPUT</code>.'},
    {type:'single', q:'Wie schreibt man im Code die lokale Variable <code>Lampe</code> nach TIA-Konvention?', options:['#Lampe','"Lampe"','%Lampe','$Lampe'], correct:0,
     explain:'Lokale Variablen bekommen ein <code>#</code>, globale stehen in Anführungszeichen.'},
    {type:'single', q:'Dieser Baustein wird übersetzt. Was meldet der Compiler?', code:'FUNCTION_BLOCK "FB_X"\nVAR_OUTPUT\n   Lampe : Bool;\nEND_VAR\nBEGIN\n   #Lampe := #Taster;\nEND_FUNCTION_BLOCK', options:['Fehler: #Taster ist nicht deklariert','Alles in Ordnung','Warnung: Lampe wird nie gelesen'], correct:0,
     explain:'Jede Variable muss deklariert sein. <code>Taster</code> fehlt in der Schnittstelle.',
     compilesPro:{src:'FUNCTION_BLOCK "FB_X"\nVAR_OUTPUT\n   Lampe : Bool;\nEND_VAR\nBEGIN\n   #Lampe := #Taster;\nEND_FUNCTION_BLOCK', expect:false}},
    {type:'multi', q:'Welche Datentypen passen zu „Temperatur 21,5 °C“ bzw. „Wartezeit 3 Sekunden“? (zwei Antworten)', options:['Real','Time','Bool','Int'], correct:[0,1],
     explain:'Kommazahlen → Real, Zeitdauern → Time (<code>T#3S</code>).'}
  ]});

defTheory({ id:'t11b', ch:11, pos:'mid', title:'Speicherbereiche: Was bleibt nach dem Zyklus?', minutes:5,
  lesson:`
<p>Nicht jede Variable lebt gleich lange. Das ist der häufigste Profi-Fehler überhaupt.</p>
<table><tr><th>Bereich</th><th>Lebensdauer</th></tr>
<tr><td><code>VAR</code> (STAT)</td><td>gehört zur Instanz — bleibt von Zyklus zu Zyklus erhalten</td></tr>
<tr><td><code>VAR_TEMP</code></td><td>existiert nur während eines Aufrufs, beginnt jedes Mal neu</td></tr>
<tr><td><code>VAR CONSTANT</code></td><td>fester, unveränderlicher Wert</td></tr></table>
<pre class="code">VAR
   Zaehler : Int;      // zählt über viele Zyklen
END_VAR
VAR_TEMP
   Flanke : Bool;      // wird in jedem Zyklus neu berechnet
END_VAR</pre>
<p><b>Faustregel:</b> Steht eine Variable rechts in ihrer eigenen Zuweisung (<code>#Zaehler := #Zaehler + 1</code>) oder muss sie sich den Wert aus dem letzten Zyklus merken, gehört sie nach <code>VAR</code>. Liest du eine TEMP-Variable, bevor du sie beschrieben hast, warnt der Compiler.</p>
<h4>Wortbreiten</h4>
<p><code>Int</code> endet bei 32767. Eine Zahl darüber „springt“ auf −32768 — ohne Fehlermeldung. Für Tagesproduktion, Betriebsstunden und Ähnliches nimmt man <code>DInt</code>.</p>`,
  questions:[
    {type:'single', q:'Ein Stückzähler soll über viele Zyklen weiterzählen. Wohin gehört die Variable?', options:['VAR (statisch)','VAR_TEMP','VAR CONSTANT','VAR_INPUT'], correct:0,
     explain:'Nur statische Variablen behalten ihren Wert über den Zyklus hinaus.'},
    {type:'input', q:'Dieser FB wird dreimal aufgerufen. Welchen Wert hat <code>Anzahl</code> nach dem dritten Aufruf?', code:'VAR_OUTPUT  Anzahl : Int;  END_VAR\nVAR_TEMP    z : Int;       END_VAR\nBEGIN\n   #z := #z + 1;\n   #Anzahl := #z;', answer:['1'],
     explain:'TEMP beginnt bei jedem Aufruf neu (in optimierten Bausteinen mit 0). Deshalb ist <code>Anzahl</code> immer 1.',
     verifyPro:{src: FBX('VAR_OUTPUT\n   Anzahl : Int;\nEND_VAR\nVAR_TEMP\n   z : Int;\nEND_VAR', '#z := #z + 1;\n#Anzahl := #z;') + '\n' + OBM('"FB_X_DB"();\n"FB_X_DB"();\n"FB_X_DB"();\n"R" := "FB_X_DB".Anzahl;'), globals:{R:0}, ask:'R'}},
    {type:'single', q:'Welche Meldung erzeugt der Compiler bei <code>#z := #z + 1;</code> mit <code>z</code> in VAR_TEMP?', options:['Warnung: TEMP-Variable gelesen, bevor sie beschrieben wurde','Fehler: z ist nicht deklariert','Keine Meldung'], correct:0,
     explain:'Der Compiler erkennt, dass <code>#z</code> gelesen wird, ohne dass es im selben Aufruf vorher einen Wert bekommen hat.',
     warnPro:{src: FBX('VAR_OUTPUT\n   a : Int;\nEND_VAR\nVAR_TEMP\n   z : Int;\nEND_VAR', '#z := #z + 1;\n#a := #z;'), code:'TEMP_READ_BEFORE_WRITE', expect:true}},
    {type:'input', q:'Eine Variable vom Typ <code>Int</code> hat den Wert 32767. Welchen Wert hat sie nach <code>#x := #x + 1;</code>?', answer:['-32768'],
     explain:'Überlauf: Der Wert springt auf die untere Grenze. Deshalb DInt für grosse Zählerstände.',
     verifyPro:{src: FBX('VAR\n   x : Int := 32767;\nEND_VAR', '#x := #x + 1;') + '\n' + OBM('"FB_X_DB"();\n"R" := "FB_X_DB".x;'), globals:{R:0}, ask:'R'}},
    {type:'single', q:'Was unterscheidet <code>Rest : Int := 10;</code> in der Deklaration von <code>#Rest := 10;</code> im Code?', options:['Der Startwert gilt einmal beim Anlegen, die Zuweisung in jedem Zyklus','Nichts, beides ist gleich','Die Zuweisung gilt nur einmal, der Startwert in jedem Zyklus'], correct:0,
     explain:'Ein Startwert initialisiert die Instanz. Eine Zuweisung im Code wird bei jedem Durchlauf ausgeführt und setzt den Wert immer wieder zurück.'}
  ]});

/* ---------------- Kapitel 12 ---------------- */
defTheory({ id:'t12a', ch:12, pos:'start', title:'Funktionen (FC)', minutes:5,
  lesson:`
<p>Eine <b>Funktion (FC)</b> ist ein Werkzeug: Werte hinein, Ergebnis heraus — ohne Gedächtnis.</p>
<pre class="code">FUNCTION "FC_Max3" : Int        // Rückgabetyp
VAR_INPUT
   a : Int;
   b : Int;
   c : Int;
END_VAR
BEGIN
   #FC_Max3 := #a;              // Rückgabe über den Funktionsnamen
   IF #b > #FC_Max3 THEN #FC_Max3 := #b; END_IF;
   IF #c > #FC_Max3 THEN #FC_Max3 := #c; END_IF;
END_FUNCTION</pre>
<h4>Aufruf mit Formalparametern</h4>
<pre class="code">"Groesster" := "FC_Max3"(a := "W1", b := "W2", c := "W3");</pre>
<p>Parameter werden mit Namen versorgt (<code>a := …</code>). Bei einer FC müssen <b>alle</b> Parameter angegeben werden. Eine FC mit <code>: Void</code> hat keinen Rückgabewert und wird als eigene Anweisung aufgerufen.</p>
<p>Der Nutzen: einmal schreiben und testen — beliebig oft verwenden. Die Skalierung aus Kapitel 3 wird so zu <code>"FC_Skalieren"</code>.</p>`,
  questions:[
    {type:'single', q:'Wie setzt man den Rückgabewert der FC <code>"FC_Max3"</code>?', options:['#FC_Max3 := …;','RETURN := …;','#Ret := … nur mit RETURN;','Er wird automatisch vom letzten Ausdruck übernommen'], correct:0,
     explain:'Der Rückgabewert heisst wie die Funktion und wird ihr zugewiesen.'},
    {type:'single', q:'Welcher Aufruf ist korrekt?', options:['"X" := "FC_Max3"(a := 1, b := 2, c := 3);','"X" := "FC_Max3"(a := 1, b := 2);','"FC_Max3" := "X";','"X" := FC_Max3[1, 2, 3];'], correct:0,
     explain:'Alle drei Parameter mit Namen versorgen. Fehlt einer, meldet der Compiler einen Fehler.',
     compilesPro:{src:'FUNCTION "FC_Max3" : Int\nVAR_INPUT\n   a : Int;\n   b : Int;\n   c : Int;\nEND_VAR\nBEGIN\n   #FC_Max3 := #a;\nEND_FUNCTION\n' + OBM('"X" := "FC_Max3"(a := 1, b := 2);'), globals:{X:0}, expect:false}},
    {type:'input', q:'Welchen Wert liefert <code>"FC_Max3"(a := 7, b := 12, c := 4)</code>?', answer:['12'],
     explain:'Der grösste der drei Werte.',
     verifyPro:{src:'FUNCTION "FC_Max3" : Int\nVAR_INPUT\n   a : Int;\n   b : Int;\n   c : Int;\nEND_VAR\nBEGIN\n   #FC_Max3 := #a;\n   IF #b > #FC_Max3 THEN #FC_Max3 := #b; END_IF;\n   IF #c > #FC_Max3 THEN #FC_Max3 := #c; END_IF;\nEND_FUNCTION\n' + OBM('"R" := "FC_Max3"(a := 7, b := 12, c := 4);'), globals:{R:0}, ask:'R'}},
    {type:'single', q:'Was bedeutet <code>FUNCTION "FC_Ampel" : Void</code>?', options:['Die FC hat keinen Rückgabewert','Die FC ist leer','Die FC darf nicht aufgerufen werden'], correct:0,
     explain:'Void = nichts. Ergebnisse gibt eine solche FC über VAR_OUTPUT zurück.'},
    {type:'single', q:'Wofür eignet sich eine FC <b>nicht</b>?', options:['einen Stückzähler, der über viele Zyklen zählt','eine Skalierung','einen Grenzwertvergleich','einen Mittelwert aus einem Array'], correct:0,
     explain:'Zählen braucht Gedächtnis — dafür ist der FB da.'}
  ]});

defTheory({ id:'t12b', ch:12, pos:'mid', title:'IN, OUT, IN_OUT — Wert oder Verweis', minutes:5,
  lesson:`
<table><tr><th>Bereich</th><th>Übergabe</th><th>Aufruf</th></tr>
<tr><td>VAR_INPUT</td><td>Kopie des Werts</td><td><code>Wert := "X"</code></td></tr>
<tr><td>VAR_OUTPUT</td><td>Ergebnis wird zurückgeschrieben</td><td><code>Alarm =&gt; "H_Rot"</code></td></tr>
<tr><td>VAR_IN_OUT</td><td><b>Verweis</b> auf die Variable des Aufrufers</td><td><code>Werte := "Messreihe"</code></td></tr></table>
<p>Ändert eine FC einen Eingang, bleibt das Original unverändert — sie arbeitet auf einer Kopie. Über <code>VAR_IN_OUT</code> verändert sie dagegen das Original direkt. Deshalb muss man dort immer eine Variable übergeben, keinen festen Wert.</p>
<h4>Jeder Ausgang in jedem Zweig</h4>
<pre class="code">IF #Gewicht > 520.0 THEN
   #Alarm := TRUE;
END_IF;                 // ⚠ und sonst?</pre>
<p>Eine FC merkt sich nichts. Wird ein Ausgang in einem Zweig nicht beschrieben, ist sein Wert undefiniert — in einer echten SPS steht dort irgendein Rest. Der Compiler warnt. Tipp: Ausgänge am Anfang auf einen sicheren Standardwert setzen.</p>`,
  questions:[
    {type:'single', q:'Eine FC ändert ihren Eingang <code>#a := #a + 1;</code>. Aufruf: <code>"Y" := "FC_T"(a := "X");</code> Was passiert mit <code>"X"</code>?', options:['Nichts — die FC arbeitet auf einer Kopie','"X" wird um 1 erhöht','Compilerfehler'], correct:0,
     explain:'Eingänge werden als Kopie übergeben.',
     verifyPro:{src:'FUNCTION "FC_T" : Int\nVAR_INPUT\n   a : Int;\nEND_VAR\nBEGIN\n   #a := #a + 1;\n   #FC_T := #a;\nEND_FUNCTION\n' + OBM('"Y" := "FC_T"(a := "X");'), globals:{X:5, Y:0}, ask:'X', answerValue:5}},
    {type:'single', q:'Womit verbindet man einen Ausgang beim Aufruf?', options:['=>',':=','==','<-'], correct:0,
     explain:'Eingänge mit <code>:=</code>, Ausgänge mit <code>=&gt;</code>.'},
    {type:'single', q:'Welche Übergabe braucht eine FC, die ein Array des Aufrufers sortieren soll?', options:['VAR_IN_OUT','VAR_INPUT','VAR_TEMP','VAR CONSTANT'], correct:0,
     explain:'Nur über einen Verweis kann die FC das Original verändern.'},
    {type:'single', q:'Was meldet der Compiler bei dieser FC?', code:'IF #a > 5 THEN\n   #q := TRUE;\nEND_IF;\n#FC_T := 0;', options:['Warnung: Ausgang q wird nicht in jedem Zweig beschrieben','Fehler: IF ohne ELSE','Nichts'], correct:0,
     explain:'Ist <code>a</code> ≤ 5, bekommt <code>q</code> keinen Wert.',
     warnPro:{src:'FUNCTION "FC_T" : Int\nVAR_INPUT\n   a : Int;\nEND_VAR\nVAR_OUTPUT\n   q : Bool;\nEND_VAR\nBEGIN\n   IF #a > 5 THEN\n      #q := TRUE;\n   END_IF;\n   #FC_T := 0;\nEND_FUNCTION', code:'OUT_NOT_ALL_PATHS', expect:true}},
    {type:'single', q:'Darf man einem IN_OUT-Parameter einen festen Wert übergeben, z.B. <code>z := 5</code>?', options:['Nein, es muss eine Variable sein','Ja, jederzeit','Nur bei Int'], correct:0,
     explain:'Ein Verweis braucht ein Ziel, in das geschrieben werden kann.',
     compilesPro:{src:'FUNCTION "FC_Inc" : Void\nVAR_IN_OUT\n   z : Int;\nEND_VAR\nBEGIN\n   #z := #z + 1;\nEND_FUNCTION\n' + OBM('"FC_Inc"(z := 5);'), expect:false}}
  ]});

/* ---------------- Kapitel 13 ---------------- */
defTheory({ id:'t13a', ch:13, pos:'start', title:'FB, Instanz und Gedächtnis', minutes:5,
  lesson:`
<p>Ein <b>Funktionsbaustein (FB)</b> hat ein Gedächtnis: seinen <b>Instanz-DB</b>. Dort liegen Eingänge, Ausgänge und statische Variablen — und bleiben von Aufruf zu Aufruf erhalten.</p>
<pre class="code">FUNCTION_BLOCK "FB_Flanke"
VAR_INPUT  Signal : Bool; END_VAR
VAR_OUTPUT Flanke : Bool; END_VAR
VAR        Merker : Bool; END_VAR
BEGIN
   #Flanke := #Signal AND NOT #Merker;
   #Merker := #Signal;
END_FUNCTION_BLOCK</pre>
<h4>Instanzen</h4>
<pre class="code">"Flanke_Plus"(Signal := "Taster_Plus");
"Flanke_Minus"(Signal := "Taster_Minus");
IF "Flanke_Plus".Flanke THEN …</pre>
<p><b>Ein Gerät = eine Instanz.</b> Zwei Taster brauchen zwei Instanzen, sonst teilen sie sich den Merker und stören sich gegenseitig. Ausgänge (und statische Werte) liest man über <code>"Instanz".Name</code>. Nicht versorgte Eingänge behalten ihren letzten Wert.</p>`,
  questions:[
    {type:'single', q:'Wo liegen die statischen Variablen eines FB?', options:['im Instanz-DB','im OB1','in der PLC-Variablentabelle','nirgends — sie werden jedes Mal neu angelegt'], correct:0,
     explain:'Jede Instanz hat ihren eigenen Datenbaustein mit allen statischen Werten.'},
    {type:'single', q:'Zwei Motoren werden mit derselben Instanz <code>"Band1_DB"</code> aufgerufen. Was passiert?', options:['Die Aufrufe überschreiben sich gegenseitig','Beide Motoren laufen unabhängig','Der Compiler verbietet es mit einem Fehler'], correct:0,
     explain:'Beide Aufrufe teilen sich ein Gedächtnis. SCL Quest warnt: „Instanz an mehreren Stellen aufgerufen“.',
     warnPro:{src:'FUNCTION_BLOCK "FB_M"\nVAR_INPUT\n   s : Bool;\nEND_VAR\nVAR_OUTPUT\n   l : Bool;\nEND_VAR\nBEGIN\n   #l := #s OR #l;\nEND_FUNCTION_BLOCK\n' + OBM('"FB_M_DB"(s := "A");\n"FB_M_DB"(s := "B");'), globals:{A:false, B:false}, code:'INSTANCE_TWICE', expect:true}},
    {type:'input', q:'Der FB <code>FB_Flanke</code> wird in vier Zyklen mit Signal = TRUE, TRUE, FALSE, TRUE aufgerufen. Wie oft ist <code>Flanke</code> TRUE?', answer:['2'],
     explain:'Im 1. und im 4. Zyklus — jeweils beim Wechsel von FALSE auf TRUE.',
     verifyPro:{src:'FUNCTION_BLOCK "FB_Flanke"\nVAR_INPUT\n   Signal : Bool;\nEND_VAR\nVAR_OUTPUT\n   Flanke : Bool;\nEND_VAR\nVAR\n   Merker : Bool;\nEND_VAR\nBEGIN\n   #Flanke := #Signal AND NOT #Merker;\n   #Merker := #Signal;\nEND_FUNCTION_BLOCK\n' + OBM('"FB_Flanke_DB"(Signal := "S");\nIF "FB_Flanke_DB".Flanke THEN\n   "N" := "N" + 1;\nEND_IF;'), globals:{S:false, N:0}, steps:[[0.1,{S:true}],[0.1,{S:true}],[0.1,{S:false}],[0.1,{S:true}]], ask:'N'}},
    {type:'single', q:'Wie ruft man einen FB auf?', options:['"FB_Motor_DB"(Start := …);','"FB_Motor"(Start := …);','"X" := "FB_Motor_DB"(Start := …);'], correct:0,
     explain:'Ein FB wird über seine Instanz aufgerufen, als eigene Anweisung. Den FB-Typ selbst kann man nicht aufrufen.',
     compilesPro:{src:'FUNCTION_BLOCK "FB_Motor"\nVAR_INPUT\n   Start : Bool;\nEND_VAR\nBEGIN\nEND_FUNCTION_BLOCK\n' + OBM('"FB_Motor"(Start := TRUE);'), expect:false}},
    {type:'single', q:'Wann nimmt man einen FB statt einer FC?', options:['wenn sich der Baustein etwas über den Zyklus hinaus merken muss','wenn der Baustein mehr als drei Eingänge hat','wenn er REAL-Werte verarbeitet'], correct:0,
     explain:'Gedächtnis ist das Entscheidungskriterium.'}
  ]});

defTheory({ id:'t13b', ch:13, pos:'mid', title:'Multiinstanzen und Kapselung', minutes:5,
  lesson:`
<p>Eine <b>Multiinstanz</b> ist eine statische Variable vom Typ eines FB. Ihr Gedächtnis liegt im Instanz-DB des übergeordneten FB.</p>
<pre class="code">FUNCTION_BLOCK "FB_Anlage"
VAR
   Band1 : "FB_Motor";
   Band2 : "FB_Motor";
   Ueberwachung : TON;
END_VAR
BEGIN
   #Band1(Start := #S1, Stopp := #Halt, Lauf => #L1);
   #Ueberwachung(IN := #L1 AND NOT #RM1, PT := T#3S);
END_FUNCTION_BLOCK</pre>
<p>So entsteht eine Hierarchie: <b>Anlage → Geräte</b>. Im Projektbaum gibt es nur noch <b>einen</b> Instanz-DB für die ganze Anlage.</p>
<h4>Kapselung</h4>
<p>Ein Baustein spricht nur über seine Schnittstelle. Greift er direkt auf globale Variablen zu, arbeiten alle Instanzen mit denselben Daten — er ist nicht wiederverwendbar.</p>
<h4>Jeden Zyklus aufrufen</h4>
<p>Instanzen ruft man <b>jeden Zyklus</b> auf. Ein Aufruf in einem IF lässt die Ausgänge einfrieren, sobald er ausfällt, und Timer laufen nicht weiter. Bedingungen gehören in den Eingang: <code>#Ueberwachung(IN := #Bedingung, …)</code>.</p>`,
  questions:[
    {type:'single', q:'Wie deklariert man eine Multiinstanz des FB "FB_Motor"?', options:['VAR  Band1 : "FB_Motor";  END_VAR','VAR_TEMP  Band1 : "FB_Motor";  END_VAR','VAR_INPUT  Band1 : "FB_Motor";  END_VAR'], correct:0,
     explain:'Instanzen brauchen Gedächtnis — also statisch unter VAR. In VAR_TEMP meldet der Compiler einen Fehler.',
     compilesPro:{src:'FUNCTION_BLOCK "FB_Motor"\nBEGIN\nEND_FUNCTION_BLOCK\n' + FBX('VAR_TEMP\n   Band1 : "FB_Motor";\nEND_VAR', '#Band1();'), expect:false}},
    {type:'single', q:'Wie ruft man die Multiinstanz <code>Band1</code> im FB auf?', options:['#Band1(Start := …);','"Band1"(Start := …);','"FB_Motor"(Start := …);'], correct:0,
     explain:'Wie eine lokale Variable mit <code>#</code>.'},
    {type:'single', q:'Ein TON wird nur innerhalb von <code>IF #Ein THEN … END_IF;</code> aufgerufen. Was passiert, wenn <code>Ein</code> FALSE wird?', options:['Der Timer friert ein: Q und ET bleiben stehen','Der Timer wird automatisch zurückgesetzt','Der Timer läuft im Hintergrund weiter'], correct:0,
     explain:'Ohne Aufruf wird die Instanz nicht bearbeitet. Deshalb: jeden Zyklus aufrufen, Bedingung als IN übergeben.',
     warnPro:{src: FBX('VAR_INPUT\n   e : Bool;\nEND_VAR\nVAR\n   t : TON;\nEND_VAR', 'IF #e THEN\n   #t(IN := TRUE, PT := T#1S);\nEND_IF;'), code:'CONDITIONAL_CALL', expect:true}},
    {type:'single', q:'Warum sollte ein FB nicht direkt <code>"Sensor_Band1"</code> lesen?', options:['Weil dann jede Instanz denselben Sensor liest','Weil globale Variablen im FB verboten sind','Weil es langsamer ist'], correct:0,
     explain:'Der Zugriff ist erlaubt, aber schlechter Stil: Der Baustein ist an ein Gerät gebunden. SCL Quest warnt.',
     warnPro:{src: FBX('VAR_OUTPUT\n   q : Bool;\nEND_VAR', '#q := "Sensor_Band1";'), globals:{Sensor_Band1:false}, code:'GLOBAL_ACCESS', expect:true}},
    {type:'single', q:'Wie liest der OB1 den Ausgang <code>Lauf</code> der Multiinstanz <code>Band1</code> im Instanz-DB <code>"FB_Anlage_DB"</code>?', options:['"FB_Anlage_DB".Band1.Lauf','"Band1".Lauf','#Band1.Lauf'], correct:0,
     explain:'Über den Pfad durch die Hierarchie: Instanz-DB → Multiinstanz → Ausgang.'}
  ]});

/* ---------------- Kapitel 14 ---------------- */
defTheory({ id:'t14a', ch:14, pos:'start', title:'STRUCT, UDT und Datenbausteine', minutes:5,
  lesson:`
<p>Zusammengehörige Daten gehören zusammen. Eine <b>Struktur</b> bündelt sie unter einem Namen:</p>
<pre class="code">Teil : Struct
   Nr : DInt;
   Gewicht : Real;
   OK : Bool;
END_STRUCT;
…
#Teil.Gewicht := 498.5;</pre>
<p>Braucht man die Struktur öfter, legt man einen <b>PLC-Datentyp</b> (UDT) an — einen Bauplan:</p>
<pre class="code">TYPE "UDT_Teil"
   STRUCT
      Nr : DInt;
      Gewicht : Real;
      OK : Bool;
   END_STRUCT;
END_TYPE

Charge : Array[1..8] of "UDT_Teil";   // acht Teile
#Charge[3].Gewicht                    // Gewicht von Teil 3</pre>
<h4>Globale Datenbausteine</h4>
<p>Ein globaler DB ist der gemeinsame Datenspeicher der Anlage: <code>"DB_Zelle".Charge[3].OK</code>. Jeder Baustein kann dort lesen und schreiben — in FBs übergibt man die Daten aber besser über die Schnittstelle.</p>`,
  questions:[
    {type:'single', q:'Wie greift man auf das Gewicht des 3. Teils im Array <code>Charge</code> zu?', options:['#Charge[3].Gewicht','#Charge.Gewicht[3]','#Gewicht.Charge[3]','#Charge(3).Gewicht'], correct:0,
     explain:'Erst das Array-Element wählen, dann das Strukturelement.'},
    {type:'single', q:'Was ist der Vorteil eines UDT gegenüber einer mehrfach geschriebenen STRUCT?', options:['Alle Variablen haben garantiert denselben Aufbau; Änderungen wirken überall','Er braucht weniger Speicher','Er ist schneller'], correct:0,
     explain:'Ein UDT ist ein zentraler Bauplan.'},
    {type:'single', q:'Ein IN_OUT ist als <code>Array[0..7] of "UDT_Teil"</code> deklariert, übergeben wird <code>"DB_Zelle".Charge</code> mit <code>Array[1..8]</code>. Was passiert?', options:['Compilerfehler: die Typen passen nicht','Es funktioniert, die Länge ist gleich','Es funktioniert mit Warnung'], correct:0,
     explain:'Bei Arrays gehören die Grenzen zum Typ.',
     compilesPro:{src:'TYPE "UDT_Teil"\nSTRUCT\n   Nr : DInt;\nEND_STRUCT;\nEND_TYPE\nDATA_BLOCK "DB_Zelle"\nVAR\n   Charge : Array[1..8] of "UDT_Teil";\nEND_VAR\nBEGIN\nEND_DATA_BLOCK\nFUNCTION "FC_S" : Void\nVAR_IN_OUT\n   Charge : Array[0..7] of "UDT_Teil";\nEND_VAR\nBEGIN\nEND_FUNCTION\n' + OBM('"FC_S"(Charge := "DB_Zelle".Charge);'), expect:false}},
    {type:'input', q:'Wie viele Elemente hat <code>Array[1..8] of "UDT_Teil"</code>?', answer:['8'],
     explain:'Indizes 1 bis 8 — acht Elemente.'},
    {type:'single', q:'Wo gehört der Flankenmerker hin, wenn ein OB1 eine Flanke erkennen soll?', options:['in einen globalen DB (ein OB hat kein Gedächtnis)','in VAR_TEMP des OB1','in VAR des OB1'], correct:0,
     explain:'Ein OB kennt nur TEMP-Variablen. Werte, die bleiben sollen, liegen in einem DB — oder man ruft einen FB auf.',
     compilesPro:{src:'ORGANIZATION_BLOCK "Main"\nVAR\n   Alt : Bool;\nEND_VAR\nBEGIN\nEND_ORGANIZATION_BLOCK', expect:false}}
  ]});

defTheory({ id:'t14b', ch:14, pos:'mid', title:'Texte: STRING', minutes:4,
  lesson:`
<p><code>Meldung : String[24];</code> speichert einen Text mit höchstens 24 Zeichen. Texte stehen in <b>einfachen</b> Hochkommas: <code>'Bereit'</code>.</p>
<table><tr><th>Funktion</th><th>Ergebnis</th></tr>
<tr><td><code>LEN('A-0042')</code></td><td>6</td></tr>
<tr><td><code>CONCAT(IN1 := 'Teil ', IN2 := '17')</code></td><td>'Teil 17'</td></tr>
<tr><td><code>LEFT(IN := 'A-0042', L := 1)</code></td><td>'A'</td></tr>
<tr><td><code>MID(IN := 'A-0042-B', L := 4, P := 3)</code></td><td>'0042'</td></tr>
<tr><td><code>FIND(IN1 := 'A-0042', IN2 := '-')</code></td><td>2</td></tr>
<tr><td><code>INT_TO_STRING(498)</code> / <code>STRING_TO_INT('0042')</code></td><td>'498' / 42</td></tr></table>
<p>Positionen zählen ab 1. Texte verbindet man mit <code>CONCAT</code>, nicht mit <code>+</code>. Ist ein Text länger als der String, wird er <b>ohne Fehlermeldung abgeschnitten</b>.</p>`,
  questions:[
    {type:'input', q:'Was liefert <code>MID(IN := \'A-0042-B\', L := 4, P := 3)</code>?', answer:['0042',"'0042'"],
     explain:'Vier Zeichen ab Position 3.',
     verifyPro:{src: OBM("\"R\" := MID(IN := 'A-0042-B', L := 4, P := 3);"), globals:{R:''}, types:{R:'STRING[20]'}, ask:'R'}},
    {type:'input', q:'Was liefert <code>FIND(IN1 := \'Teil-17\', IN2 := \'-\')</code>?', answer:['5'],
     explain:'Das Minus steht an Position 5.',
     verifyPro:{src: OBM("\"R\" := FIND(IN1 := 'Teil-17', IN2 := '-');"), globals:{R:0}, ask:'R'}},
    {type:'single', q:'Welche Zeile verbindet Text und Zahl korrekt?', options:["#T := CONCAT(IN1 := 'Teil ', IN2 := INT_TO_STRING(#Nr));","#T := 'Teil ' + #Nr;","#T := CONCAT(IN1 := 'Teil ', IN2 := #Nr);"], correct:0,
     explain:'Zahlen erst umwandeln, dann mit CONCAT verbinden.',
     compilesPro:{src: FBX('VAR\n   T : String[20];\n   Nr : Int;\nEND_VAR', "#T := CONCAT(IN1 := 'Teil ', IN2 := #Nr);"), expect:false}},
    {type:'input', q:'<code>#S : String[5];</code> — was steht nach <code>#S := CONCAT(IN1 := \'Hallo\', IN2 := \' Welt\');</code> in <code>#S</code>?', answer:['Hallo',"'Hallo'"],
     explain:'Nur 5 Zeichen passen hinein — der Rest wird abgeschnitten.',
     verifyPro:{src: OBM("\"R\" := CONCAT(IN1 := 'Hallo', IN2 := ' Welt');"), globals:{R:''}, types:{R:'STRING[5]'}, ask:'R'}},
    {type:'single', q:'Womit schreibt man ein Text-Literal in SCL?', options:["'einfache Hochkommas'",'"doppelte Anführungszeichen"','`Backticks`'], correct:0,
     explain:'Doppelte Anführungszeichen sind in TIA für globale Namen reserviert.'}
  ]});

/* ---------------- Kapitel 15 ---------------- */
defTheory({ id:'t15a', ch:15, pos:'start', title:'OB, FB, FC, DB — wer ruft wen?', minutes:5,
  lesson:`
<p>Ein Anlagenprogramm nach Standard ist eine <b>Aufrufhierarchie</b>:</p>
<pre class="code">OB100 "Startup"   → einmal beim Anlauf
OB1   "Main"      → jeden Zyklus
   ├─ Eingänge aufbereiten  → "DB_E"
   ├─ "FB_Zelle_DB"(…)      → Anlagen-FB
   │     ├─ #Band  : "FB_Motor_Std"
   │     ├─ #Pick  : "FB_Pick"
   │     └─ "FC_Teiletext"(…)
   └─ Ausgänge</pre>
<p><b>OB1</b> ist das Inhaltsverzeichnis: kurz, übersichtlich, nur Aufrufe. <b>OB100</b> stellt beim Anlauf die Grundstellung her. Die Logik steckt in FBs und FCs.</p>
<h4>Reihenfolge</h4>
<p>Der OB1 läuft von oben nach unten. Wird ein Wert erst <b>nach</b> seiner Verwendung berechnet, wirkt er einen Zyklus zu spät. Darum: erst Eingänge, dann Verarbeitung, dann Ausgänge.</p>
<h4>Eingänge entkoppeln</h4>
<p>Rohsignale (Öffner, Schliesser) werden an einer Stelle einheitlich aufbereitet — TRUE bedeutet danach immer „aktiv“.</p>`,
  questions:[
    {type:'single', q:'Welcher OB läuft genau einmal beim Übergang von STOP nach RUN?', options:['OB100','OB1','OB35','Gar keiner'], correct:0,
     explain:'OB100 ist der Anlauf-OB.'},
    {type:'input', q:'Beim Anlauf setzt OB100 <code>"Z" := 100;</code>, OB1 rechnet <code>"Z" := "Z" + 1;</code>. Welchen Wert hat "Z" nach dem dritten Zyklus?', answer:['103'],
     explain:'OB100 einmal (100), danach dreimal OB1.',
     verifyPro:{src:'ORGANIZATION_BLOCK "Startup"\nBEGIN\n   "Z" := 100;\nEND_ORGANIZATION_BLOCK\n' + OBM('"Z" := "Z" + 1;'), globals:{Z:0}, steps:[[0.1,{}],[0.1,{}],[0.1,{}]], ask:'Z'}},
    {type:'single', q:'Im OB1 wird zuerst <code>"Weiche" := "OK";</code> ausgeführt, danach der Baustein, der <code>"OK"</code> berechnet. Was ist die Folge?', options:['Die Weiche reagiert einen Zyklus zu spät','Compilerfehler','Kein Unterschied'], correct:0,
     explain:'Der Wert wird verwendet, bevor er im aktuellen Zyklus berechnet wurde.'},
    {type:'single', q:'Der Stopptaster ist ein Öffner (TRUE = nicht gedrückt). Wie übernimmt man ihn in <code>"DB_E".Stopp</code> (TRUE = gedrückt)?', options:['"DB_E".Stopp := NOT "I_Stopp_NC";','"DB_E".Stopp := "I_Stopp_NC";','"DB_E".Stopp := FALSE;'], correct:0,
     explain:'Öffner invertiert man bei der Übernahme — einmal, an einer Stelle.'},
    {type:'single', q:'Was gehört <b>nicht</b> in den OB1 eines Programms nach Standard?', options:['hunderte Zeilen Gerätelogik','Aufrufe der Anlagen-FBs','Aufbereitung der Eingänge'], correct:0,
     explain:'Gerätelogik gehört in FBs. Der OB1 bleibt schlank.'}
  ]});

defTheory({ id:'t15b', ch:15, pos:'mid', title:'Programmierstandard', minutes:5,
  lesson:`
<p>Ein Programm, das funktioniert, ist noch kein gutes Programm. Firmenstandards sorgen dafür, dass jeder Techniker es versteht:</p>
<ul><li><b>Namen</b>: Präfixe <code>FB_</code>, <code>FC_</code>, <code>DB_</code>, <code>UDT_</code>, Konstanten in GROSSBUCHSTABEN</li>
<li><b>Kapselung</b>: Bausteine sprechen nur über ihre Schnittstelle</li>
<li><b>Kommentare</b>: Kopf über jedem Baustein, Kommentar an jeder Schnittstellenvariable</li>
<li><b>Warnungsfrei</b>: jede Warnung ist ein möglicher Fehler</li>
<li><b>Wiederverwendung</b>: geprüfte Standardbausteine statt Kopien</li>
<li><b>Versionierung</b>: jede Änderung nachvollziehbar</li></ul>
<h4>Schreibweise wie im TIA Portal</h4>
<p>SCL Quest versteht Namen auch ohne Zeichen. Im TIA Portal schreibt man eindeutig: <code>#Name</code> für lokale Variablen der Schnittstelle, <code>"Name"</code> für globale Namen (PLC-Variablen, Datenbausteine, Bausteine, Datentypen). Gewöhne dir diese Schreibweise an — dann liest jeder Techniker sofort, woher ein Wert kommt.</p>
<p><b>Wichtig:</b> SCL Quest bildet SCL vereinfacht nach. Was du hier gelernt hast, prüfst du an einer echten Anlage immer zuerst in TIA Portal / PLCSIM.</p>`,
  questions:[
    {type:'single', q:'Was gehört in den Kommentarkopf über einem Baustein?', options:['Zweck und Verhalten des Bausteins','der komplette Code noch einmal','nichts, Kommentare stören nur'], correct:0,
     explain:'Der Kopf sagt in wenigen Zeilen, wofür der Baustein da ist und wie er sich verhält.'},
    {type:'single', q:'Welche Warnung erzeugt eine deklarierte, aber nie benutzte Variable?', options:['Variable deklariert, aber nie verwendet','Typkonflikt','Keine'], correct:0,
     explain:'Ungenutzte Variablen verwirren Leser und deuten oft auf vergessenen Code hin.',
     warnPro:{src: FBX('VAR\n   x : Int;\nEND_VAR', ';'), code:'UNUSED_VAR', expect:true}},
    {type:'single', q:'Welcher Name folgt dem üblichen Standard für einen Datentyp?', options:['"UDT_Teil"','"teil"','"FB_Teil"','"Teil_DB"'], correct:0,
     explain:'Präfix UDT_ für PLC-Datentypen.'},
    {type:'single', q:'Wie schreibt man im TIA Portal die globale PLC-Variable <code>Betrieb</code>?', options:['"Betrieb"','#Betrieb','Betrieb#'], correct:0,
     explain:'Globale Namen stehen in Anführungszeichen, lokale bekommen ein <code>#</code>.'},
    {type:'single', q:'Ein Baustein übersetzt mit zwei Warnungen. Darf er in die Standard-Bibliothek?', options:['Nein, erst alle Warnungen beheben','Ja, Warnungen sind egal','Ja, wenn er die Tests besteht'], correct:0,
     explain:'In die Bibliothek kommt nur, was ohne Warnung übersetzt.'}
  ]});
})();
