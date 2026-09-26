/* ============================================================
   THEORIE-AUFTRÄGE — pro Kapitel zwei Lektionen mit Verständnis-Check.
   pos:'start' = vor der ersten Aufgabe des Kapitels,
   pos:'mid'   = nach der fünften Aufgabe. Bestehen ab 80 %.
   Fragetypen: single, multi, input (Freitext/Zahl, answer = gültige Antworten)
   verify / compiles: werden vom Validator mit der echten Engine nachgerechnet.
   ============================================================ */

/* ---------------- Kapitel 1 ---------------- */
defTheory({ id:'t1a', ch:1, pos:'start', title:'Wie eine SPS denkt', minutes:4,
  lesson:`
<p>Eine <b>SPS</b> (speicherprogrammierbare Steuerung) arbeitet in einer Endlosschleife, dem <b>Zyklus</b>:</p>
<ol><li><b>Eingänge lesen</b> — Sensoren, Taster, Lichtschranken</li><li><b>Programm ausführen</b> — dein SCL-Code, von oben nach unten</li><li><b>Ausgänge schreiben</b> — Motoren, Lampen, Ventile</li></ol>
<p>Ein Zyklus dauert typischerweise nur wenige Millisekunden. Dein Programm läuft also hunderte Male pro Sekunde — immer wieder von vorn.</p>
<h4>Die Zuweisung</h4>
<pre class="code">Greifer_Auf := TRUE;   // Variable bekommt einen Wert
Achse_Grad  := 45;     // ganze Zahl
Anzeige     := 12.5;   // Kommazahl mit PUNKT</pre>
<p><code>:=</code> heisst „bekommt den Wert“. Jede Anweisung endet mit <code>;</code>. Kommentare beginnen mit <code>//</code> oder stehen in <code>(* … *)</code>.</p>
<h4>Die vier Grund-Datentypen</h4>
<table><tr><th>Typ</th><th>Werte</th><th>Beispiel</th></tr>
<tr><td>BOOL</td><td>TRUE / FALSE</td><td>Greifer offen?</td></tr>
<tr><td>INT</td><td>ganze Zahlen −32768 … 32767</td><td>Winkel, Stückzahl</td></tr>
<tr><td>REAL</td><td>Kommazahlen</td><td>Gewicht, Temperatur</td></tr>
<tr><td>TIME</td><td>Zeitdauer, z.B. T#3S</td><td>Wartezeiten</td></tr></table>
<p>SCL ist <b>streng typisiert</b>: Einer BOOL-Variable kannst du keine 1 zuweisen, einer INT-Variable keine 2.5.</p>`,
  questions:[
    {type:'single', q:'In welcher Reihenfolge arbeitet eine SPS in jedem Zyklus?', options:['Eingänge lesen → Programm ausführen → Ausgänge schreiben','Programm ausführen → Eingänge lesen → Ausgänge schreiben','Ausgänge schreiben → Eingänge lesen → Programm ausführen'], correct:0,
     explain:'Erst wird ein „Abbild“ aller Eingänge gelesen, dann läuft das Programm, am Ende werden alle Ausgänge auf einmal geschrieben.'},
    {type:'single', q:'Welche Zeile weist korrekt einen Wert zu?', options:['Achse_Grad := 45;','Achse_Grad = 45;','Achse_Grad == 45;','45 := Achse_Grad;'], correct:0,
     explain:'Zugewiesen wird mit <code>:=</code>, das Ziel steht links. <code>=</code> ist in SCL ein Vergleich.'},
    {type:'single', q:'Welcher Datentyp passt für ein Gewicht von 12,75 kg?', options:['REAL','INT','BOOL','TIME'], correct:0,
     explain:'Nachkommastellen brauchen REAL. INT speichert nur ganze Zahlen.'},
    {type:'single', q:'Die Variable <code>Greifer_Auf</code> ist BOOL. Welche Zuweisung ist gültig?', options:['Greifer_Auf := FALSE;','Greifer_Auf := 0;','Greifer_Auf := "zu";','Greifer_Auf := 0.0;'], correct:0,
     explain:'BOOL kennt nur TRUE und FALSE. 0 ist ein INT — der Compiler meldet einen Typkonflikt.',
     compiles:{code:'Greifer_Auf := 0;', vars:{Greifer_Auf:true}, expect:false}},
    {type:'input', q:'Was steht nach diesem Code in <code>x</code>?', code:'x := 10;\nx := x + 5;\nx := x * 2;', answer:['30'],
     explain:'Die Anweisungen laufen von oben nach unten: 10 → 15 → 30.',
     verify:{code:'x := 10;\nx := x + 5;\nx := x * 2;', vars:{x:0}, ask:'x'}}
  ]});

defTheory({ id:'t1b', ch:1, pos:'mid', title:'Compiler-Meldungen lesen', minutes:3,
  lesson:`
<p>Bevor dein Code in die SPS geladen wird, prüft ihn der <b>Compiler</b>. Er findet zwei Arten von Fehlern:</p>
<ul><li><b>Syntaxfehler</b> — die „Grammatik“ stimmt nicht: fehlendes <code>;</code>, <code>=</code> statt <code>:=</code>, Tippfehler in Schlüsselwörtern.</li>
<li><b>Typfehler</b> — die Grammatik stimmt, aber die Datentypen passen nicht zusammen: <code>Greifer_Auf := 1;</code></li></ul>
<p>Danach laufen die <b>Testfälle</b>: Sie prüfen, ob dein Programm das Richtige tut. Ein Programm kann fehlerfrei kompilieren und trotzdem falsch sein — das ist ein <b>Logikfehler</b>.</p>
<h4>So liest du eine Meldung</h4>
<pre class="code">Zeile 2: Am Ende von Zeile 1 fehlt ein Semikolon ";".</pre>
<p>Die Zeilennummer zeigt, <em>wo</em> der Compiler gestolpert ist. Oft liegt die Ursache eine Zeile <em>davor</em> — ein fehlendes <code>;</code> merkt der Compiler erst, wenn die nächste Anweisung beginnt.</p>
<h4>Gross/klein und Namen</h4>
<p>SCL unterscheidet nicht zwischen Gross- und Kleinschreibung: <code>greifer_auf</code> und <code>Greifer_Auf</code> sind dieselbe Variable. Ein Tippfehler wie <code>Grefer_Auf</code> ist dagegen eine <em>unbekannte</em> Variable.</p>`,
  questions:[
    {type:'single', q:'Der Code kompiliert fehlerfrei, aber der Greifer öffnet sich im Test nicht. Was für ein Fehler ist das?', options:['Logikfehler','Syntaxfehler','Typfehler'], correct:0,
     explain:'Der Compiler ist zufrieden — nur das Verhalten stimmt nicht. Das decken erst die Testfälle auf.'},
    {type:'single', q:'Welcher der folgenden Codes kompiliert?', options:['band_lauf := TRUE;','Band_Lauf := TRUE','Band_Lauf =: TRUE;','Band Lauf := TRUE;'], correct:0,
     explain:'Gross-/Kleinschreibung spielt keine Rolle. Die anderen: fehlendes Semikolon, falscher Operator, Leerzeichen im Namen.',
     compiles:{code:'band_lauf := TRUE;', vars:{Band_Lauf:false}, expect:true}},
    {type:'single', q:'Die Meldung lautet „Zeile 3: Unerwartetes Zeichen“. In Zeile 2 fehlt das Semikolon. Warum meldet der Compiler Zeile 3?', options:['Er merkt das Fehlen erst, wenn die nächste Anweisung beginnt','Weil die Zeilen bei 0 gezählt werden','Weil der Fehler zufällig gemeldet wird'], correct:0,
     explain:'Ohne <code>;</code> liest der Compiler einfach weiter — erst am Anfang der nächsten Anweisung ist klar, dass etwas fehlt.'},
    {type:'multi', q:'Welche Zeilen erzeugen einen Fehler? (mehrere richtig)', options:['Anzahl := 2.5;   // Anzahl ist INT','Gewicht := 3;   // Gewicht ist REAL','Lampe := 1;   // Lampe ist BOOL','Lampe := TRUE;   // Lampe ist BOOL'], correct:[0,2],
     explain:'Eine Kommazahl passt nicht in INT, eine Zahl nicht in BOOL. INT → REAL ist dagegen erlaubt (keine Information geht verloren).'},
    {type:'input', q:'Wie viele Anweisungen stehen hier? <code>A := 1; B := 2; // C := 3;</code>', answer:['2','zwei'],
     explain:'Alles nach <code>//</code> ist Kommentar und wird ignoriert.'}
  ]});

/* ---------------- Kapitel 2 ---------------- */
defTheory({ id:'t2a', ch:2, pos:'start', title:'Boolesche Logik', minutes:5,
  lesson:`
<p>Mit logischen Operatoren verknüpfst du Wahrheitswerte. Das Ergebnis ist wieder BOOL.</p>
<table><tr><th>A</th><th>B</th><th>A AND B</th><th>A OR B</th><th>A XOR B</th></tr>
<tr><td>FALSE</td><td>FALSE</td><td>FALSE</td><td>FALSE</td><td>FALSE</td></tr>
<tr><td>FALSE</td><td>TRUE</td><td>FALSE</td><td>TRUE</td><td>TRUE</td></tr>
<tr><td>TRUE</td><td>FALSE</td><td>FALSE</td><td>TRUE</td><td>TRUE</td></tr>
<tr><td>TRUE</td><td>TRUE</td><td>TRUE</td><td>TRUE</td><td>FALSE</td></tr></table>
<p><b>NOT</b> kehrt um: <code>NOT TRUE</code> ergibt <code>FALSE</code>.</p>
<pre class="code">Freigabe := Tuer_Zu AND Sensor_OK;   // beide müssen stimmen
Stoerung := Fehler_A OR Fehler_B;    // einer genügt
Warnung  := NOT Tuer_Zu;             // Gegenteil</pre>
<h4>Wichtig: Zuweisung statt IF</h4>
<p><code>Freigabe := A AND B;</code> setzt die Variable in <em>jedem</em> Zyklus neu — auf TRUE <em>oder</em> FALSE. Für einfache Verknüpfungen brauchst du kein IF.</p>
<h4>Sicherheit</h4>
<p>Freigaben verknüpft man mit <b>AND</b> (alles muss stimmen), Abschaltungen mit <b>OR</b> (jede Ursache genügt).</p>`,
  questions:[
    {type:'single', q:'<code>A := TRUE; B := FALSE;</code> — was liefert <code>A AND B</code>?', options:['FALSE','TRUE'], correct:0,
     explain:'AND ist nur TRUE, wenn beide Seiten TRUE sind.', verify:{code:'X := TRUE AND FALSE;', vars:{X:true}, ask:'X'}},
    {type:'single', q:'<code>A := TRUE; B := TRUE;</code> — was liefert <code>A XOR B</code>?', options:['FALSE','TRUE'], correct:0,
     explain:'XOR ist nur TRUE, wenn die Seiten <em>verschieden</em> sind.', verify:{code:'X := TRUE XOR TRUE;', vars:{X:true}, ask:'X'}},
    {type:'single', q:'Zwei Not-Halt-Taster sollen die Anlage stoppen. Welcher Operator verknüpft sie?', options:['OR','AND','XOR'], correct:0,
     explain:'Jeder einzelne Not-Halt muss genügen — also OR.'},
    {type:'single', q:'Eine Maschine darf nur laufen, wenn die Tür zu ist UND kein Not-Halt anliegt. Welche Zeile ist richtig?', options:['Lauf := Tuer_Zu AND NOT Not_Halt;','Lauf := Tuer_Zu OR NOT Not_Halt;','Lauf := NOT Tuer_Zu AND Not_Halt;'], correct:0,
     explain:'Beide Bedingungen müssen gelten (AND), und der Not-Halt darf NICHT aktiv sein.'},
    {type:'input', q:'Was steht nach dem Code in <code>X</code>? (TRUE/FALSE)', code:'A := FALSE;\nB := TRUE;\nX := NOT A AND B;', answer:['TRUE'],
     explain:'NOT A = TRUE, TRUE AND TRUE = TRUE.', verify:{code:'A := FALSE;\nB := TRUE;\nX := NOT A AND B;', vars:{A:true,B:false,X:false}, ask:'X'}}
  ]});

defTheory({ id:'t2b', ch:2, pos:'mid', title:'Rangfolge & Selbsthaltung', minutes:5,
  lesson:`
<p>Wie in der Mathematik („Punkt vor Strich“) gibt es in SCL eine <b>Rangfolge</b>:</p>
<table><tr><th>Rang</th><th>Operator</th></tr><tr><td>1 (zuerst)</td><td>( ) Klammern</td></tr><tr><td>2</td><td>NOT</td></tr><tr><td>3</td><td>* / MOD</td></tr><tr><td>4</td><td>+ −</td></tr><tr><td>5</td><td>&lt; &gt; &lt;= &gt;= = &lt;&gt;</td></tr><tr><td>6</td><td>AND</td></tr><tr><td>7</td><td>XOR</td></tr><tr><td>8 (zuletzt)</td><td>OR</td></tr></table>
<p><b>AND bindet stärker als OR.</b> Deshalb bedeutet</p>
<pre class="code">X := A AND B OR C;     // = (A AND B) OR C</pre>
<p>Wenn du „A und (B oder C)“ meinst, <b>musst</b> du klammern. Im Zweifel: Klammern setzen. Das schadet nie und macht Code lesbar.</p>
<h4>Die Selbsthaltung</h4>
<p>Ein Taster liefert nur TRUE, solange er gedrückt ist. Damit ein Motor weiterläuft, „hält“ er sich selbst:</p>
<pre class="code">Motor := (Start OR Motor) AND NOT Stopp;</pre>
<p>Im nächsten Zyklus steht rechts der <em>alte</em> Wert von <code>Motor</code>. War er TRUE, bleibt er TRUE — bis Stopp gedrückt wird. Weil <code>NOT Stopp</code> außerhalb der Klammer steht, hat Stopp <b>Vorrang</b>.</p>`,
  questions:[
    {type:'single', q:'Wie wertet SCL <code>A OR B AND C</code> aus?', options:['A OR (B AND C)','(A OR B) AND C','von links nach rechts ohne Rangfolge'], correct:0,
     explain:'AND hat Vorrang vor OR.'},
    {type:'input', q:'<code>A := TRUE; B := FALSE; C := FALSE;</code> Was ergibt <code>A OR B AND C</code>? (TRUE/FALSE)', answer:['TRUE'],
     explain:'Zuerst B AND C = FALSE, dann TRUE OR FALSE = TRUE.', verify:{code:'X := TRUE OR FALSE AND FALSE;', vars:{X:false}, ask:'X'}},
    {type:'single', q:'In der Selbsthaltung <code>Motor := (Start OR Motor) AND NOT Stopp;</code> werden Start und Stopp gleichzeitig gedrückt. Was passiert?', options:['Motor wird FALSE — Stopp hat Vorrang','Motor wird TRUE — Start hat Vorrang','Der Zustand bleibt, wie er war'], correct:0,
     explain:'<code>NOT Stopp</code> ist FALSE → die ganze AND-Verknüpfung ist FALSE.'},
    {type:'single', q:'Warum steht <code>Motor</code> selbst auf der rechten Seite?', options:['Damit der Motor nach dem Loslassen von Start weiterläuft','Damit der Compiler nicht meckert','Damit der Motor schneller anläuft'], correct:0,
     explain:'Der alte Wert wird zurückgeführt — das „Gedächtnis“ der Schaltung.'},
    {type:'multi', q:'Welche Ausdrücke bedeuten „Auto UND (A ODER B)“? (mehrere richtig)', options:['Auto AND (A OR B)','(Auto AND A) OR (Auto AND B)','Auto AND A OR B','(A OR B) AND Auto'], correct:[0,1,3],
     explain:'Nur <code>Auto AND A OR B</code> ist falsch: Es bedeutet (Auto AND A) OR B.'}
  ]});

/* ---------------- Kapitel 3 ---------------- */
defTheory({ id:'t3a', ch:3, pos:'start', title:'Vergleichen & Rechnen', minutes:5,
  lesson:`
<h4>Vergleiche liefern BOOL</h4>
<table><tr><th>Operator</th><th>Bedeutung</th></tr><tr><td><code>=</code></td><td>gleich</td></tr><tr><td><code>&lt;&gt;</code></td><td>ungleich</td></tr><tr><td><code>&lt;</code> <code>&gt;</code></td><td>kleiner / grösser</td></tr><tr><td><code>&lt;=</code> <code>&gt;=</code></td><td>kleiner-gleich / grösser-gleich</td></tr></table>
<pre class="code">Alarm := Temperatur > 80;                  // direkt zuweisen
OK    := (Gewicht >= 480) AND (Gewicht <= 520);  // Bereich</pre>
<p>Einen Bereich prüft man immer mit <b>zwei</b> Vergleichen. Die Schreibweise <code>480 &lt;= x &lt;= 520</code> gibt es in SCL nicht.</p>
<h4>Rechnen</h4>
<p><code>+ − * /</code> wie gewohnt, dazu <b>MOD</b> = Rest der Division: <code>17 MOD 5 = 2</code>.</p>
<h4>Die INT-Falle</h4>
<p>Stehen links und rechts vom <code>/</code> <b>ganze Zahlen</b>, rechnet die SPS ganzzahlig und schneidet ab:</p>
<pre class="code">7 / 2          // ergibt 3   (INT)
7.0 / 2        // ergibt 3.5 (REAL)
INT_TO_REAL(7) / 2.0   // ergibt 3.5</pre>
<p>Wandle deshalb <em>vor</em> dem Teilen um, wenn du Nachkommastellen brauchst.</p>`,
  questions:[
    {type:'input', q:'Was ergibt <code>17 MOD 5</code>?', answer:['2'], explain:'17 = 3 × 5 + 2, der Rest ist 2.', verify:{code:'X := 17 MOD 5;', vars:{X:0}, ask:'X'}},
    {type:'input', q:'<code>A</code> und <code>B</code> sind INT. Was ergibt <code>(A + B) / 2</code> bei A = 3, B = 4?', answer:['3'],
     explain:'7 / 2 mit ganzen Zahlen ergibt 3 — der Rest wird abgeschnitten.', verify:{code:'X := (A + B) / 2;', vars:{A:3,B:4,X:0}, ask:'X'}},
    {type:'single', q:'Welcher Ausdruck prüft, ob <code>x</code> zwischen 10 und 20 liegt (inklusive)?', options:['(x >= 10) AND (x <= 20)','10 <= x <= 20','(x > 10) AND (x < 20)','(x >= 10) OR (x <= 20)'], correct:0,
     explain:'Zwei Vergleiche mit AND; „inklusive“ heisst &gt;= und &lt;=.'},
    {type:'single', q:'Wie schreibt man „ungleich“ in SCL?', options:['<>','!=','=/=','NOT='], correct:0, explain:'SCL verwendet <code>&lt;&gt;</code>.'},
    {type:'single', q:'<code>Alarm := Temperatur > 80;</code> — was passiert bei genau 80 Grad?', options:['Alarm wird FALSE','Alarm wird TRUE','Fehler'], correct:0,
     explain:'80 ist nicht grösser als 80. Für „ab 80“ bräuchte man <code>&gt;=</code>.'}
  ]});

defTheory({ id:'t3b', ch:3, pos:'mid', title:'Funktionen & Skalierung', minutes:4,
  lesson:`
<p>SCL bringt fertige Funktionen mit. Ihr Ergebnis kannst du direkt verwenden:</p>
<table><tr><th>Funktion</th><th>Ergebnis</th><th>Beispiel</th></tr>
<tr><td><code>ABS(x)</code></td><td>Betrag</td><td>ABS(-7) = 7</td></tr>
<tr><td><code>MIN(a, b)</code> / <code>MAX(a, b)</code></td><td>kleinerer / grösserer Wert</td><td>MAX(3, 9) = 9</td></tr>
<tr><td><code>LIMIT(MN := u, IN := x, MX := o)</code></td><td>x, begrenzt auf u…o</td><td>LIMIT(0, 150, 100) = 100</td></tr>
<tr><td><code>INT_TO_REAL(x)</code></td><td>INT → REAL</td><td>INT_TO_REAL(5) = 5.0</td></tr>
<tr><td><code>REAL_TO_INT(x)</code> / <code>ROUND(x)</code></td><td>runden</td><td>ROUND(2.6) = 3</td></tr>
<tr><td><code>TRUNC(x)</code></td><td>abschneiden</td><td>TRUNC(2.6) = 2</td></tr></table>
<h4>Analogwerte skalieren</h4>
<p>Siemens-Analogkarten liefern für 0…100 % einen Rohwert von <b>0…27648</b>. Umrechnung in Prozent:</p>
<pre class="code">Prozent := INT_TO_REAL(Rohwert) / 27648.0 * 100.0;</pre>
<h4>Toleranz mit Betrag</h4>
<pre class="code">Fehler := ABS(Soll - Ist) > 5;   // erkennt beide Richtungen</pre>`,
  questions:[
    {type:'input', q:'Was ergibt <code>LIMIT(MN := 0, IN := 150, MX := 100)</code>?', answer:['100'], explain:'150 liegt über der Obergrenze — Ergebnis ist die Obergrenze.', verify:{code:'X := LIMIT(MN := 0, IN := 150, MX := 100);', vars:{X:0}, ask:'X'}},
    {type:'input', q:'Was ergibt <code>ABS(40 - 55)</code>?', answer:['15'], explain:'40 − 55 = −15, der Betrag ist 15.', verify:{code:'X := ABS(40 - 55);', vars:{X:0}, ask:'X'}},
    {type:'input', q:'Ein Rohwert von 27648 entspricht wie viel Prozent?', answer:['100','100.0','100 %','100%'], explain:'27648 ist der Nennbereich = 100 %.'},
    {type:'single', q:'Warum prüft man Toleranzen mit <code>ABS(Soll - Ist)</code>?', options:['Damit Abweichungen in beide Richtungen erkannt werden','Weil es schneller rechnet','Weil REAL-Werte sonst nicht vergleichbar sind'], correct:0,
     explain:'Ohne ABS wird eine negative Abweichung nie grösser als die Toleranz.'},
    {type:'single', q:'Was ergibt <code>TRUNC(2.9)</code>?', options:['2','3','2.9'], correct:0, explain:'TRUNC schneidet die Nachkommastellen ab, ohne zu runden.', verify:{code:'X := TRUNC(2.9);', vars:{X:0}, ask:'X'}}
  ]});

/* ---------------- Kapitel 4 ---------------- */
defTheory({ id:'t4a', ch:4, pos:'start', title:'IF — das Programm entscheidet', minutes:5,
  lesson:`
<pre class="code">IF Bedingung THEN
  // wenn TRUE
ELSIF andere_Bedingung THEN
  // wenn die erste FALSE, diese TRUE
ELSE
  // wenn keine zutraf
END_IF;</pre>
<ul><li>Die Bedingung muss <b>BOOL</b> sein: <code>IF Modus THEN</code> (Modus ist INT) ist ein Fehler — richtig wäre <code>IF Modus = 1 THEN</code>.</li>
<li><b>ELSIF</b> schreibt man zusammen. <code>ELSE IF</code> öffnet ein <em>neues</em> IF, das ein eigenes END_IF braucht.</li>
<li>Die Zweige werden <b>von oben nach unten</b> geprüft. Der erste zutreffende gewinnt, alle anderen werden übersprungen.</li>
<li>Jedes IF endet mit <code>END_IF;</code></li></ul>
<h4>IF ohne ELSE = Speicher</h4>
<pre class="code">IF Teil_Erkannt THEN
  Band_Lauf := FALSE;
END_IF;       // sonst: Band_Lauf bleibt, wie es war</pre>
<p>Ohne ELSE wird die Variable im FALSE-Fall <b>nicht</b> verändert. Das ist manchmal gewollt (Speicherwirkung), manchmal ein Fehler (Ausgang „hängt“).</p>`,
  questions:[
    {type:'single', q:'Welche Bedingung ist gültig, wenn <code>Modus</code> ein INT ist?', options:['IF Modus = 2 THEN','IF Modus THEN','IF Modus := 2 THEN','IF Modus == 2 THEN'], correct:0,
     explain:'Die Bedingung muss BOOL liefern. Ein Vergleich mit <code>=</code> tut das.', compiles:{code:'IF Modus THEN\n  X := 1;\nEND_IF;', vars:{Modus:0, X:0}, expect:false}},
    {type:'input', q:'Was steht danach in <code>Stufe</code>, wenn <code>T = 90</code>?', code:'IF T > 50 THEN\n  Stufe := 1;\nELSIF T > 80 THEN\n  Stufe := 2;\nELSE\n  Stufe := 0;\nEND_IF;', answer:['1'],
     explain:'Der erste Zweig (T &gt; 50) trifft bereits zu — der zweite wird nie geprüft.', verify:{code:'IF T > 50 THEN\n  Stufe := 1;\nELSIF T > 80 THEN\n  Stufe := 2;\nELSE\n  Stufe := 0;\nEND_IF;', vars:{T:90, Stufe:0}, ask:'Stufe'}},
    {type:'input', q:'<code>Lampe</code> ist vorher TRUE, <code>Sensor</code> ist FALSE. Was steht danach in <code>Lampe</code>?', code:'IF Sensor THEN\n  Lampe := FALSE;\nEND_IF;', answer:['TRUE'],
     explain:'Ohne ELSE wird im FALSE-Fall nichts geändert.', verify:{code:'IF Sensor THEN\n  Lampe := FALSE;\nEND_IF;', vars:{Sensor:false, Lampe:true}, ask:'Lampe'}},
    {type:'single', q:'Wie viele END_IF braucht <code>IF a THEN … ELSE IF b THEN … END_IF;</code>, damit es korrekt ist?', options:['Zwei','Eins','Keins'], correct:0,
     explain:'ELSE IF öffnet ein zweites IF. Mit ELSIF bräuchte man nur eines.'},
    {type:'single', q:'In welcher Reihenfolge sollte man „&gt; 50“ und „&gt; 80“ in einer ELSIF-Kette prüfen?', options:['Erst > 80, dann > 50','Erst > 50, dann > 80','Egal'], correct:0,
     explain:'Vom Strengsten zum Allgemeinsten — sonst fängt „&gt; 50“ auch alle Werte über 80 ab.'}
  ]});

defTheory({ id:'t4b', ch:4, pos:'mid', title:'Hysterese & Priorität', minutes:4,
  lesson:`
<h4>Hysterese</h4>
<p>Pendelt ein Messwert um eine Schaltschwelle, schaltet ein einfacher Vergleich ständig ein und aus („Flattern“). Die Lösung sind <b>zwei Schwellen</b>:</p>
<pre class="code">IF Temp > 70 THEN
  Luefter := TRUE;
ELSIF Temp < 60 THEN
  Luefter := FALSE;
END_IF;   // zwischen 60 und 70: Zustand bleibt</pre>
<p>Dazwischen passiert nichts — der Lüfter behält seinen Zustand. So arbeiten Thermostate, Füllstandsregler und Druckschalter.</p>
<h4>Priorität durch Reihenfolge</h4>
<p>In einer ELSIF-Kette gewinnt der erste zutreffende Zweig. Nutze das für Prioritäten:</p>
<pre class="code">IF Not_Aus THEN          // 1. Sicherheit
  ...
ELSIF Stoerung THEN      // 2. Störung
  ...
ELSIF Auto THEN          // 3. Normalbetrieb
  ...
END_IF;</pre>
<p><b>Sicherheit kommt immer zuerst.</b> Dann kann kein anderer Zweig sie überstimmen.</p>`,
  questions:[
    {type:'input', q:'Hysterese: Ein bei 60/70 °C geschalteter Lüfter läuft gerade. Die Temperatur fällt auf 65 °C. Läuft er noch? (TRUE/FALSE)', answer:['TRUE','ja'],
     explain:'65 liegt zwischen den Schwellen — der Zustand bleibt.', verify:{code:'IF Temp > 70 THEN\n  Luefter := TRUE;\nELSIF Temp < 60 THEN\n  Luefter := FALSE;\nEND_IF;', vars:{Temp:65, Luefter:true}, ask:'Luefter'}},
    {type:'single', q:'Wozu dient eine Hysterese?', options:['Ständiges Ein-/Ausschalten um eine Schwelle verhindern','Die Temperatur schneller zu senken','Einen Timer zu ersetzen'], correct:0, explain:'Zwei Schwellen erzeugen einen „Totbereich“, in dem nichts geschaltet wird.'},
    {type:'single', q:'Wo gehört der Not-Aus-Zweig in einer ELSIF-Kette hin?', options:['Ganz nach oben','Ganz nach unten in den ELSE-Zweig','In die Mitte'], correct:0, explain:'Nur ganz oben kann ihn kein anderer Zweig überstimmen.'},
    {type:'single', q:'Warum hat die Hysterese keinen ELSE-Zweig?', options:['Weil der Zustand zwischen den Schwellen erhalten bleiben soll','Weil ELSE bei Temperaturen nicht erlaubt ist','Weil ELSIF kein ELSE zulässt'], correct:0, explain:'Ein ELSE würde den Lüfter im Zwischenbereich immer umschalten.'},
    {type:'single', q:'<code>IF A THEN X := 1; ELSIF A AND B THEN X := 2; END_IF;</code> — wann wird X = 2?', options:['Nie','Wenn A und B TRUE sind','Wenn nur B TRUE ist'], correct:0,
     explain:'Ist A TRUE, greift schon der erste Zweig. Ist A FALSE, ist auch A AND B FALSE. Der zweite Zweig ist „toter Code“.'}
  ]});

/* ---------------- Kapitel 5 ---------------- */
defTheory({ id:'t5a', ch:5, pos:'start', title:'CASE — die Auswahltabelle', minutes:4,
  lesson:`
<p>Wenn <b>eine</b> INT-Variable über viele mögliche Wege entscheidet, ist CASE übersichtlicher als eine IF-Kette:</p>
<pre class="code">CASE Modus OF
  0:      Band_Lauf := FALSE;           // ein Wert
  1, 2:   Ampel_Gelb := TRUE;           // Werteliste
  3..9:   Ampel_Gruen := TRUE;          // Bereich
ELSE
  Stoerung := TRUE;                     // alle anderen
END_CASE;</pre>
<ul><li>Der Ausdruck nach CASE muss eine <b>ganze Zahl</b> sein.</li>
<li>Nach jedem Fallwert steht ein <b>Doppelpunkt</b> <code>:</code> (nicht <code>:=</code>).</li>
<li>Pro Zweig dürfen beliebig viele Anweisungen stehen.</li>
<li>Ein Wert darf nur in <b>einem</b> Zweig vorkommen.</li>
<li><b>ELSE</b> fängt alle nicht genannten Werte ab — ohne ELSE passiert bei unbekannten Werten nichts.</li></ul>`,
  questions:[
    {type:'input', q:'Welchen Wert hat <code>S</code> für <code>G = 31</code>?', code:'CASE G OF\n  0..30: S := 1;\n  31..70: S := 2;\nELSE\n  S := 3;\nEND_CASE;', answer:['2'], explain:'31 liegt im Bereich 31..70.',
     verify:{code:'CASE G OF\n  0..30: S := 1;\n  31..70: S := 2;\nELSE\n  S := 3;\nEND_CASE;', vars:{G:31, S:0}, ask:'S'}},
    {type:'single', q:'Was steht nach einem CASE-Fallwert?', options:[':',':=',';','THEN'], correct:0, explain:'Ein einfacher Doppelpunkt: <code>1: …</code>'},
    {type:'single', q:'Kann man CASE mit einer BOOL-Variable verwenden?', options:['Nein, der Ausdruck muss eine ganze Zahl sein','Ja, mit TRUE: und FALSE:','Nur mit ELSE'], correct:0, explain:'Für BOOL nimmt man IF.'},
    {type:'input', q:'Welchen Wert hat <code>X</code> für <code>M = 7</code>, wenn X vorher 5 war?', code:'CASE M OF\n  1: X := 10;\n  2: X := 20;\nEND_CASE;', answer:['5'], explain:'Kein Zweig passt, es gibt kein ELSE — X bleibt unverändert.',
     verify:{code:'CASE M OF\n  1: X := 10;\n  2: X := 20;\nEND_CASE;', vars:{M:7, X:5}, ask:'X'}},
    {type:'single', q:'Was meldet der Compiler bei <code>1..5: … 3: …</code> im selben CASE?', options:['Überschneidung — Wert 3 kommt doppelt vor','Nichts, der erste Zweig gewinnt','Nichts, der letzte Zweig gewinnt'], correct:0,
     explain:'Jeder Wert darf nur einmal vorkommen.', compiles:{code:'CASE g OF 1..5: x := 1; 3: x := 2; END_CASE;', vars:{g:0, x:0}, expect:false}}
  ]});

defTheory({ id:'t5b', ch:5, pos:'mid', title:'Betriebsarten sauber bauen', minutes:3,
  lesson:`
<p>Echte Maschinen haben Betriebsarten: <b>Aus, Hand, Automatik, Wartung</b>. Die Regeln für saubere Betriebsarten-Logik:</p>
<ol><li><b>Jeder Zweig beschreibt alle Ausgänge.</b> Sonst „erbt“ ein Modus Zustände aus dem vorherigen.</li>
<li>Oder: <b>Grundzustand zuerst.</b> Alle Ausgänge vor dem CASE auf FALSE, im CASE nur einschalten.</li>
<li><b>ELSE = sicherer Zustand.</b> Unbekannte Modi stoppen die Anlage.</li>
<li><b>Sicherheit zuletzt übersteuern.</b> Nach dem CASE darf eine Sperre alles überschreiben.</li></ol>
<pre class="code">Ampel_Gruen := FALSE;          // 1. Grundzustand
Ampel_Gelb  := FALSE;
CASE Modus OF                  // 2. Auswahl
  1: Ampel_Gelb := TRUE;
  2: Ampel_Gruen := TRUE;
END_CASE;
IF Gesperrt THEN               // 3. Übersteuerung
  Ampel_Gruen := FALSE;
END_IF;</pre>
<p>Die <b>letzte</b> Zuweisung im Zyklus gewinnt — erst dann werden die Ausgänge geschrieben.</p>`,
  questions:[
    {type:'single', q:'Warum setzt man alle Lampen vor dem CASE auf FALSE?', options:['Damit keine Lampe aus einem früheren Modus an bleibt','Weil CASE nur TRUE zuweisen kann','Damit der Code schneller läuft'], correct:0, explain:'Der Grundzustand sorgt dafür, dass nur die Lampe des aktuellen Modus leuchtet.'},
    {type:'input', q:'Was steht am Ende des Zyklus in <code>L</code>?', code:'L := TRUE;\nL := FALSE;\nL := TRUE;', answer:['TRUE'], explain:'Die letzte Zuweisung gewinnt.', verify:{code:'L := TRUE;\nL := FALSE;\nL := TRUE;', vars:{L:false}, ask:'L'}},
    {type:'single', q:'Was sollte bei einem unbekannten Modus passieren?', options:['Die Anlage geht in einen sicheren Zustand','Der letzte Modus bleibt aktiv','Automatikbetrieb'], correct:0, explain:'ELSE = sicherer Zustand.'},
    {type:'single', q:'Wo steht eine Sicherheitssperre, die alle Modi übersteuern soll?', options:['Nach dem CASE','Vor dem Grundzustand','Im ELSE-Zweig'], correct:0, explain:'Als letzte Zuweisung gewinnt sie immer.'},
    {type:'multi', q:'Welche Aussagen über „Refactoring“ stimmen?', options:['Das Verhalten bleibt gleich','Der Code wird lesbarer','Testfälle sichern den Umbau ab','Es werden neue Funktionen hinzugefügt'], correct:[0,1,2], explain:'Refactoring verbessert die Struktur, nicht die Funktion.'}
  ]});

/* ---------------- Kapitel 6 ---------------- */
defTheory({ id:'t6a', ch:6, pos:'start', title:'Arrays & FOR-Schleifen', minutes:5,
  lesson:`
<p>Ein <b>Array</b> speichert viele Werte gleichen Typs unter einem Namen:</p>
<pre class="code">Gewichte : ARRAY[0..9] OF INT;   // 10 Plätze: Index 0 bis 9
Gewichte[3] := 250;              // viertes Element
x := Gewichte[Fach_Nr];          // Index aus einer Variable</pre>
<p><b>Achtung:</b> Die Zählung beginnt bei 0. Ein Zugriff auf <code>Gewichte[10]</code> ist ein <b>Bereichsfehler</b> — eine echte SPS geht dabei in STOP.</p>
<h4>FOR-Schleife</h4>
<pre class="code">Summe := 0;                    // Initialisieren!
FOR i := 0 TO 9 DO
  Summe := Summe + Gewichte[i];
END_FOR;</pre>
<ul><li><code>i</code> läuft automatisch von Start bis Ende (beide inklusive).</li>
<li>Mit <code>BY -1</code> zählt die Schleife rückwärts: <code>FOR i := 9 TO 0 BY -1 DO</code></li>
<li>Die Zählvariable darf im Rumpf <b>nicht</b> verändert werden.</li>
<li><b>Summen immer vorher auf 0 setzen</b> — sonst wächst sie in jedem SPS-Zyklus weiter.</li></ul>`,
  questions:[
    {type:'input', q:'Welcher ist der höchste gültige Index von <code>ARRAY[0..9]</code>?', answer:['9'], explain:'10 Elemente: 0, 1, …, 9.'},
    {type:'input', q:'Wie oft läuft <code>FOR i := 2 TO 6 DO</code>?', answer:['5'], explain:'2, 3, 4, 5, 6 — beide Grenzen gehören dazu.', verify:{code:'n := 0;\nFOR i := 2 TO 6 DO\n  n := n + 1;\nEND_FOR;', vars:{n:0}, ask:'n'}},
    {type:'input', q:'<code>a := [4, 1, 7]</code> (Index 0…2). Was steht nach dem Code in <code>s</code>?', code:'s := 0;\nFOR i := 0 TO 2 DO\n  s := s + a[i];\nEND_FOR;', answer:['12'], explain:'4 + 1 + 7 = 12.', verify:{code:'s := 0;\nFOR i := 0 TO 2 DO\n  s := s + a[i];\nEND_FOR;', vars:{s:0, a:[4,1,7]}, ask:'s'}},
    {type:'single', q:'Was passiert ohne <code>Summe := 0;</code> vor der Schleife in einer SPS?', options:['Die Summe wächst in jedem Zyklus weiter','Der Compiler meldet einen Fehler','Nichts, Variablen starten immer bei 0'], correct:0, explain:'Das Programm läuft immer wieder — die alte Summe wird weiter addiert.'},
    {type:'single', q:'Mit welcher Zeile zählt eine Schleife von 5 rückwärts bis 1?', options:['FOR i := 5 TO 1 BY -1 DO','FOR i := 5 TO 1 DO','FOR i := 1 TO 5 BY -1 DO'], correct:0, explain:'Rückwärts braucht BY -1 und Start &gt; Ende.'}
  ]});

defTheory({ id:'t6b', ch:6, pos:'mid', title:'Suchen, Zählen, Maximum', minutes:4,
  lesson:`
<p>Drei Muster, die du immer wieder brauchst:</p>
<h4>Zählen</h4>
<pre class="code">Anzahl := 0;
FOR i := 0 TO 9 DO
  IF Defekt[i] THEN Anzahl := Anzahl + 1; END_IF;
END_FOR;</pre>
<h4>Maximum</h4>
<pre class="code">Max := Werte[0];            // mit dem ERSTEN Element starten
FOR i := 1 TO 9 DO
  IF Werte[i] > Max THEN Max := Werte[i]; END_IF;
END_FOR;</pre>
<p>Warum nicht mit 0 starten? Wenn alle Werte negativ sind, wäre 0 falsch.</p>
<h4>Verschieben (Schieberegister)</h4>
<pre class="code">FOR i := 5 TO 1 BY -1 DO   // von HINTEN anfangen!
  Platz[i] := Platz[i - 1];
END_FOR;</pre>
<p>Beim Verschieben nach hinten muss man von hinten beginnen, sonst überschreibt man Werte, bevor sie kopiert sind.</p>`,
  questions:[
    {type:'single', q:'Warum startet die Maximum-Suche mit <code>Max := Werte[0];</code> statt <code>Max := 0;</code>?', options:['Weil sonst bei lauter negativen Werten 0 herauskäme','Weil 0 kein gültiger INT ist','Weil der Compiler es verlangt'], correct:0, explain:'Der Startwert muss ein echter Wert aus dem Array sein.'},
    {type:'input', q:'<code>P := [1, 2, 3]</code>. Was steht danach in <code>P</code>? (Format: 1,2,3)', code:'FOR i := 1 TO 2 DO\n  P[i] := P[i - 1];\nEND_FOR;', answer:['1,1,1','1, 1, 1','[1,1,1]'], explain:'Vorwärts kopiert: P[1] := 1, dann P[2] := P[1] = 1. Alles wird überschrieben!'},
    {type:'input', q:'<code>D := [TRUE, FALSE, TRUE, TRUE]</code>. Wie viele TRUE zählt das Zähl-Muster?', answer:['3'], explain:'Drei Einträge sind TRUE.', verify:{code:'n := 0;\nFOR i := 0 TO 3 DO\n  IF D[i] THEN\n    n := n + 1;\n  END_IF;\nEND_FOR;', vars:{n:0, D:[true,false,true,true]}, ask:'n'}},
    {type:'single', q:'Wo prüft man, ob mehr als 2 Teile defekt sind?', options:['Nach der Zählschleife','In jedem Schleifendurchlauf vor dem Zählen','Vor der Schleife'], correct:0, explain:'Erst nach der Schleife steht die fertige Anzahl fest.'},
    {type:'multi', q:'Welche Fehler führen bei <code>ARRAY[0..9]</code> zu einem Bereichsfehler?', options:['FOR i := 0 TO 10 DO … a[i]','a[i - 1] mit i = 0','FOR i := 1 TO 9 DO … a[i]','a[9]'], correct:[0,1], explain:'Index 10 und Index −1 liegen außerhalb 0…9.'}
  ]});

/* ---------------- Kapitel 7 ---------------- */
defTheory({ id:'t7a', ch:7, pos:'start', title:'WHILE, REPEAT, EXIT', minutes:5,
  lesson:`
<table><tr><th>Schleife</th><th>Prüfung</th><th>Einsatz</th></tr>
<tr><td>FOR</td><td>feste Anzahl</td><td>Arrays durchlaufen</td></tr>
<tr><td>WHILE … DO</td><td><b>vor</b> jedem Durchlauf</td><td>„solange noch …“</td></tr>
<tr><td>REPEAT … UNTIL</td><td><b>nach</b> jedem Durchlauf</td><td>mindestens einmal</td></tr></table>
<pre class="code">WHILE Rest > 0 DO           // läuft 0-mal, wenn Rest = 0
  Rest := Rest - 12;
END_WHILE;

REPEAT                      // läuft mindestens 1-mal
  Los := Los * 2;
UNTIL Los >= Bedarf         // Abbruch, wenn TRUE
END_REPEAT;</pre>
<p><b>EXIT</b> verlässt die Schleife sofort. <b>CONTINUE</b> springt zum nächsten Durchlauf.</p>
<h4>Gefahr: Endlosschleife</h4>
<p>Ändert sich die Bedingung im Rumpf nie, endet die Schleife nie. In einer SPS bedeutet das: Der Zyklus endet nicht, die <b>Zykluszeitüberwachung</b> schlägt zu, die Anlage geht in <b>STOP</b>.</p>`,
  questions:[
    {type:'single', q:'Welche Schleife läuft auf jeden Fall mindestens einmal?', options:['REPEAT … UNTIL','WHILE … DO','FOR … DO'], correct:0, explain:'REPEAT prüft erst am Ende.'},
    {type:'input', q:'Was steht danach in <code>n</code>?', code:'n := 0;\nWHILE n < 10 DO\n  n := n + 3;\nEND_WHILE;', answer:['12'], explain:'0 → 3 → 6 → 9 → 12, dann ist n &lt; 10 FALSE.', verify:{code:'n := 0;\nWHILE n < 10 DO\n  n := n + 3;\nEND_WHILE;', vars:{n:0}, ask:'n'}},
    {type:'single', q:'Was passiert in einer SPS bei einer Endlosschleife?', options:['Die Zykluszeitüberwachung löst aus, die SPS geht in STOP','Die SPS wartet, bis die Schleife fertig ist','Die Ausgänge werden trotzdem geschrieben'], correct:0, explain:'Der Zyklus endet nie — die Überwachung stoppt die Steuerung.'},
    {type:'input', q:'Was steht danach in <code>s</code>?', code:'s := 0;\nFOR i := 1 TO 5 DO\n  IF i = 3 THEN\n    EXIT;\n  END_IF;\n  s := s + i;\nEND_FOR;', answer:['3'], explain:'1 + 2 = 3, bei i = 3 wird abgebrochen.', verify:{code:'s := 0;\nFOR i := 1 TO 5 DO\n  IF i = 3 THEN\n    EXIT;\n  END_IF;\n  s := s + i;\nEND_FOR;', vars:{s:0}, ask:'s'}},
    {type:'input', q:'Und mit <code>CONTINUE</code> statt <code>EXIT</code>?', answer:['12'], explain:'Nur die 3 wird übersprungen: 1 + 2 + 4 + 5 = 12.', verify:{code:'s := 0;\nFOR i := 1 TO 5 DO\n  IF i = 3 THEN\n    CONTINUE;\n  END_IF;\n  s := s + i;\nEND_FOR;', vars:{s:0}, ask:'s'}}
  ]});

defTheory({ id:'t7b', ch:7, pos:'mid', title:'Sicher suchen & verschachteln', minutes:4,
  lesson:`
<h4>Das Suchmuster</h4>
<pre class="code">Pos := -1;                     // "nicht gefunden"
FOR i := 0 TO 9 DO
  IF Lager[i] = 0 THEN
    Pos := i;
    EXIT;                      // ersten Treffer behalten
  END_IF;
END_FOR;</pre>
<p>Ohne EXIT läuft die Schleife weiter und überschreibt den Treffer — am Ende steht der <b>letzte</b> statt der <b>erste</b>.</p>
<h4>Falle: AND wertet beide Seiten aus</h4>
<pre class="code">WHILE i < 10 AND Lager[i] <> 0 DO   // Vorsicht!</pre>
<p>Bei <code>i = 10</code> wird <code>Lager[10]</code> trotzdem gelesen → Bereichsfehler. Prüfe den Index getrennt (z.B. mit EXIT).</p>
<h4>Verschachtelte Schleifen</h4>
<pre class="code">FOR i := 0 TO 4 DO
  FOR j := i + 1 TO 5 DO       // jedes Paar genau einmal
    IF Codes[i] = Codes[j] THEN Doppelt := TRUE; END_IF;
  END_FOR;
END_FOR;</pre>
<h4>Tauschen</h4>
<pre class="code">Temp := a;  a := b;  b := Temp;   // immer mit Zwischenspeicher</pre>`,
  questions:[
    {type:'single', q:'Die Suche soll den ERSTEN Treffer liefern, liefert aber den letzten. Was fehlt?', options:['EXIT nach dem Speichern','CONTINUE','Ein ELSE-Zweig'], correct:0, explain:'EXIT beendet die Suche beim ersten Treffer.'},
    {type:'single', q:'Warum startet die innere Schleife bei <code>j := i + 1</code>?', options:['Damit kein Element mit sich selbst verglichen wird und jedes Paar nur einmal','Weil j nicht 0 sein darf','Damit die Schleife schneller rückwärts läuft'], correct:0, explain:'Bei j = i wäre jedes Element „doppelt“.'},
    {type:'input', q:'Wie viele Vergleiche macht das Doppelte-Muster bei 6 Elementen (i: 0…4, j: i+1…5)?', answer:['15'], explain:'5 + 4 + 3 + 2 + 1 = 15.', verify:{code:'n := 0;\nFOR i := 0 TO 4 DO\n  FOR j := i + 1 TO 5 DO\n    n := n + 1;\n  END_FOR;\nEND_FOR;', vars:{n:0}, ask:'n'}},
    {type:'single', q:'Was ist beim Tauschen von a und b falsch: <code>a := b; b := a;</code>?', options:['Beide haben danach den Wert von b','Es ist korrekt','Es ist ein Syntaxfehler'], correct:0, explain:'Der ursprüngliche Wert von a ist nach der ersten Zeile verloren — dafür braucht man Temp.'},
    {type:'single', q:'Was liefert das Suchmuster, wenn nichts gefunden wird?', options:['-1','0','den letzten Index'], correct:0, explain:'Der vorher gesetzte Startwert bleibt stehen. 0 wäre verwechselbar mit „an Index 0 gefunden“.'}
  ]});

/* ---------------- Kapitel 8 ---------------- */
defTheory({ id:'t8a', ch:8, pos:'start', title:'Zustand oder Ereignis? Flanken', minutes:5,
  lesson:`
<p>Ein Taster ist <b>TRUE, solange</b> er gedrückt ist — über viele SPS-Zyklen. Oft willst du aber nur auf den <b>Moment</b> reagieren, in dem er gedrückt <em>wird</em>. Das ist eine <b>Flanke</b>.</p>
<pre class="code">Signal:  ___/‾‾‾‾‾‾‾\\____
R_TRIG:  ___/\\__________     steigende Flanke (FALSE→TRUE)
F_TRIG:  ___________/\\___    fallende Flanke  (TRUE→FALSE)</pre>
<p>Der Ausgang <code>.Q</code> ist genau <b>einen Zyklus</b> lang TRUE.</p>
<h4>Bausteine aufrufen</h4>
<p>R_TRIG ist ein <b>Funktionsbaustein</b> mit Gedächtnis. Jede Verwendung braucht eine eigene <b>Instanz</b> (in den Aufgaben schon angelegt):</p>
<pre class="code">Start_Flanke(CLK := Start_Taster);   // Aufruf: Eingang versorgen
IF Start_Flanke.Q THEN               // Ausgang lesen
  Anzahl := Anzahl + 1;
END_IF;</pre>
<p>Ohne Flanke würde <code>IF Start_Taster THEN Anzahl := Anzahl + 1;</code> in <em>jedem</em> Zyklus zählen, solange der Taster gedrückt ist — hunderte Male pro Sekunde.</p>`,
  questions:[
    {type:'single', q:'Wie lange ist <code>R_TRIG.Q</code> TRUE?', options:['Genau einen Zyklus','Solange CLK TRUE ist','Eine Sekunde'], correct:0, explain:'Flanken-Ausgänge sind Impulse von einem Zyklus.'},
    {type:'single', q:'Welcher Baustein erkennt das Loslassen eines Tasters?', options:['F_TRIG','R_TRIG','TON'], correct:0, explain:'Loslassen = TRUE → FALSE = fallende Flanke.'},
    {type:'input', q:'Ein Taster wird 5 Zyklen lang gedrückt gehalten. Wie oft zählt <code>IF Taster THEN n := n + 1; END_IF;</code>?', answer:['5'], explain:'In jedem Zyklus, in dem der Taster TRUE ist.'},
    {type:'input', q:'Und wie oft zählt die Variante mit R_TRIG?', answer:['1','einmal'], explain:'Nur einmal — beim Übergang von FALSE nach TRUE.'},
    {type:'single', q:'Welche Zeile ruft eine R_TRIG-Instanz korrekt auf?', options:['Flanke(CLK := Taster);','Flanke := R_TRIG(Taster);','R_TRIG(Taster);','Flanke.CLK := Taster;'], correct:0, explain:'Instanzname, Klammer, Parameter := Wert, Semikolon.'}
  ]});

defTheory({ id:'t8b', ch:8, pos:'mid', title:'Zähler CTU & CTD', minutes:4,
  lesson:`
<p>Für häufige Zählaufgaben gibt es fertige Zählerbausteine mit eingebauter Flankenerkennung:</p>
<table><tr><th>Baustein</th><th>Eingänge</th><th>Ausgänge</th></tr>
<tr><td><b>CTU</b> (vorwärts)</td><td>CU = zählen, R = zurücksetzen, PV = Sollwert</td><td>CV = Zählerstand, Q = CV ≥ PV</td></tr>
<tr><td><b>CTD</b> (rückwärts)</td><td>CD = abwärts, LD = PV laden, PV = Startwert</td><td>CV = Zählerstand, Q = CV ≤ 0</td></tr></table>
<pre class="code">Karton(CU := Teil_Erkannt, R := Quittieren, PV := 6);
Voll   := Karton.Q;
Anzahl := Karton.CV;</pre>
<ul><li>CU zählt nur bei der <b>steigenden Flanke</b> — ein gehaltenes Signal zählt einmal.</li>
<li>Solange <b>R</b> TRUE ist, bleibt der Zähler auf 0. Ein dauerhaft anliegender Reset blockiert ihn.</li>
<li>Mit <code>=&gt;</code> kann man Ausgänge direkt im Aufruf zuweisen: <code>Karton(CU := x, R := r, PV := 6, Q =&gt; Voll);</code></li></ul>`,
  questions:[
    {type:'single', q:'Wann wird <code>CTU.Q</code> TRUE?', options:['Wenn CV ≥ PV','Bei jeder Flanke an CU','Wenn R TRUE ist'], correct:0, explain:'Q meldet „Sollwert erreicht“.'},
    {type:'single', q:'Ein CTU zählt nie. Was prüfst du zuerst?', options:['Ob am Reset R dauerhaft TRUE anliegt','Ob PV zu gross ist','Ob CV gelesen wird'], correct:0, explain:'Ein dauerhafter Reset hält den Zähler auf 0.'},
    {type:'input', q:'CTD mit PV = 10: erst LD, dann 3 Entnahme-Flanken. Welchen Wert hat CV?', answer:['7'], explain:'10 − 3 = 7.',
     verify:{code:'M(CD := e, LD := l, PV := 10);\nx := M.CV;', vars:{e:false,l:false,x:0}, fb:{M:'CTD'}, steps:[[0,{l:true}],[0,{l:false}],[0,{e:true}],[0,{e:false}],[0,{e:true}],[0,{e:false}],[0,{e:true}]], ask:'x'}},
    {type:'single', q:'Was bedeutet <code>Q =&gt; Voll</code> im Aufruf?', options:['Der Ausgang Q wird nach dem Aufruf in Voll geschrieben','Voll wird als Eingang Q übergeben','Q wird mit Voll verglichen'], correct:0, explain:'<code>=&gt;</code> kennzeichnet Ausgangsparameter.'},
    {type:'single', q:'Warum quittiert man einen Zähler oft mit einer Flanke (R := Quitt_Flanke.Q)?', options:['Damit ein gehaltener Quittiertaster den Zähler nicht dauerhaft blockiert','Weil R nur Impulse annimmt','Weil sonst Q nie TRUE wird'], correct:0, explain:'Mit Flanke wird genau einmal zurückgesetzt, danach zählt der Zähler sofort weiter.'}
  ]});

/* ---------------- Kapitel 9 ---------------- */
defTheory({ id:'t9a', ch:9, pos:'start', title:'Die drei Timer', minutes:6,
  lesson:`
<pre class="code">IN:   __/‾‾‾‾‾‾‾‾‾‾\\________
TON:  ______/‾‾‾‾‾‾\\________   Einschaltverzögerung: erst nach PT an
TOF:  __/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\\__   Ausschaltverzögerung: nach Abfall noch PT an
TP:   __/‾‾‾‾\\______________   Impuls: genau PT lang</pre>
<table><tr><th>Timer</th><th>Merksatz</th><th>Beispiel</th></tr>
<tr><td><b>TON</b></td><td>verzögert an, sofort aus</td><td>Anlaufwarnung, Entprellen</td></tr>
<tr><td><b>TOF</b></td><td>sofort an, verzögert aus</td><td>Lüfter-Nachlauf</td></tr>
<tr><td><b>TP</b></td><td>Impuls fester Länge</td><td>Hupsignal</td></tr></table>
<pre class="code">Verz(IN := Freigabe, PT := T#2S);
Band_Lauf := Verz.Q;
Rest := T#2S - Verz.ET;   // ET = verstrichene Zeit</pre>
<h4>Zeit-Literale</h4>
<p><code>T#3S</code> = 3 Sekunden, <code>T#500MS</code> = 0,5 s, <code>T#2M</code> = 2 Minuten, <code>T#1M30S</code> = 90 s. Achte auf die Einheit — <code>T#3MS</code> sind nur 3 Millisekunden!</p>`,
  questions:[
    {type:'single', q:'Ein Lüfter soll nach dem Abschalten des Motors noch 10 s nachlaufen. Welcher Timer?', options:['TOF','TON','TP'], correct:0, explain:'Sofort an, verzögert aus.'},
    {type:'single', q:'IN eines TON (PT = T#5S) ist 3 s TRUE, dann FALSE. Wird Q TRUE?', options:['Nein','Ja, nach 5 s','Ja, sofort'], correct:0, explain:'IN war nicht lange genug TRUE. Beim nächsten Mal beginnt die Zeit von vorn.'},
    {type:'input', q:'Wie viele Sekunden sind <code>T#1M30S</code>?', answer:['90'], explain:'1 Minute + 30 Sekunden.', verify:{code:'x := T#1M30S;', vars:{x:0}, types:{x:'TIME'}, ask:'x'}},
    {type:'single', q:'Welches Zeit-Literal steht für eine halbe Sekunde?', options:['T#500MS','T#0.5MS','T#500S','T#5MS'], correct:0, explain:'500 Millisekunden = 0,5 Sekunden.'},
    {type:'single', q:'Ein TP (PT = 2 s) bekommt an IN einen 10 s langen Impuls. Wie lange ist Q TRUE?', options:['2 s','10 s','12 s'], correct:0, explain:'TP liefert immer genau PT — unabhängig von der Dauer an IN.'}
  ]});

defTheory({ id:'t9b', ch:9, pos:'mid', title:'Taktgeber & Überwachungen', minutes:4,
  lesson:`
<h4>Taktgeber</h4>
<pre class="code">Takt(IN := NOT Takt.Q, PT := T#1S);   // setzt sich selbst zurück
IF Takt.Q THEN Lampe := NOT Lampe; END_IF;</pre>
<p>Sobald der Timer abgelaufen ist, wird IN im nächsten Zyklus FALSE → Timer zurückgesetzt → danach startet er neu.</p>
<h4>Zeitüberwachung (Timeout)</h4>
<pre class="code">Ueberw(IN := Schliessen AND NOT Endlage_Zu, PT := T#2S);
IF Ueberw.Q THEN Stoerung := TRUE; END_IF;     // speichern
IF Quittieren THEN Stoerung := FALSE; END_IF;</pre>
<p>Jede Bewegung sollte überwacht werden: Kommt die Rückmeldung nicht rechtzeitig, stimmt etwas nicht (Klemmen, Sensor defekt, Druckluft weg).</p>
<h4>Warum Störungen speichern?</h4>
<p>Würde man <code>Stoerung := Ueberw.Q;</code> schreiben, verschwände die Meldung, sobald der Befehl weg ist — niemand würde sie bemerken. Störmeldungen bleiben stehen, bis ein Mensch sie <b>quittiert</b>.</p>`,
  questions:[
    {type:'single', q:'Wozu dient <code>IN := NOT Takt.Q</code> beim Taktgeber?', options:['Der Timer setzt sich nach Ablauf selbst zurück und startet neu','Der Timer läuft doppelt so schnell','Der Timer wird deaktiviert'], correct:0, explain:'Q = TRUE → IN = FALSE → Reset → IN = TRUE → Neustart.'},
    {type:'single', q:'Wann läuft der Überwachungstimer <code>IN := Schliessen AND NOT Endlage_Zu</code>?', options:['Solange geschlossen werden soll, die Endlage aber noch fehlt','Immer wenn der Greifer zu ist','Nur nach dem Quittieren'], correct:0, explain:'Er misst die Zeit, in der die Rückmeldung ausbleibt.'},
    {type:'single', q:'Warum speichert man Störmeldungen mit IF statt sie direkt zuzuweisen?', options:['Damit sie stehen bleiben, bis jemand quittiert','Weil IF schneller ist','Weil Timer-Ausgänge nicht zugewiesen werden dürfen'], correct:0, explain:'Eine flüchtige Störung würde sonst übersehen.'},
    {type:'input', q:'Ein TON (PT = T#10S) läuft seit 4 s. Wie viele Sekunden ist <code>T#10S - Timer.ET</code>?', answer:['6'], explain:'10 − 4 = 6 Sekunden Restzeit.',
     verify:{code:'T(IN := x, PT := T#10S);\nr := T#10S - T.ET;', vars:{x:false, r:0}, types:{r:'TIME'}, fb:{T:'TON'}, steps:[[0,{x:true}],[4,{}]], ask:'r'}},
    {type:'single', q:'Welcher Fehler steckt in <code>PT := T#3MS</code>, wenn 3 Sekunden gemeint sind?', options:['Einheit: MS sind Millisekunden','Kein Fehler','Das # ist falsch'], correct:0, explain:'Richtig wäre <code>T#3S</code>.'}
  ]});

/* ---------------- Kapitel 10 ---------------- */
defTheory({ id:'t10a', ch:10, pos:'start', title:'Schrittketten', minutes:6,
  lesson:`
<p>Komplexe Abläufe zerlegt man in <b>Schritte</b>. Immer ist genau <b>ein</b> Schritt aktiv. Zu jedem Schritt gehören:</p>
<ul><li><b>Aktionen</b> — was in diesem Schritt passiert (Greifer zu, Arm fahren …)</li>
<li><b>Weiterschaltbedingung</b> — wann der nächste Schritt beginnt (Sensor, Timer …)</li></ul>
<pre class="code">CASE Schritt OF
  0:  // Warten
      IF Teil_Erkannt THEN Schritt := 1; END_IF;
  1:  // Greifen
      Greifer_Auf := FALSE;
      IF Greifer_Zu THEN Schritt := 2; END_IF;
  2:  // Transport
      Achse_Grad := 90;
      IF Arm_In_Ablage THEN Schritt := 0; END_IF;
END_CASE;</pre>
<h4>Ausgänge aus Schritten ableiten</h4>
<pre class="code">Band_Lauf  := Schritt = 1;
Ampel_Gelb := Schritt = 0;</pre>
<p>So ist jeder Ausgang in jedem Zyklus eindeutig — nichts bleibt versehentlich an.</p>
<h4>Rückmeldungen statt Zeiten</h4>
<p>Eine Bewegung ist erst fertig, wenn der Sensor es bestätigt. Zeiten nutzt man nur, wo es keinen Sensor gibt (Kleben, Aushärten).</p>`,
  questions:[
    {type:'single', q:'Wie viele Schritte einer Schrittkette sind gleichzeitig aktiv?', options:['Genau einer','Alle','Beliebig viele'], correct:0, explain:'Die Variable Schritt hat immer genau einen Wert.'},
    {type:'input', q:'<code>Schritt = 1</code>, <code>Greifer_Zu = TRUE</code>. Welchen Wert hat Schritt nach einem Zyklus des Beispielcodes?', answer:['2'], explain:'In Schritt 1 ist die Weiterschaltbedingung erfüllt.',
     verify:{code:'CASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    IF Greifer_Zu THEN\n      Schritt := 2;\n    END_IF;\nEND_CASE;', vars:{Schritt:1, Teil_Erkannt:false, Greifer_Zu:true, Greifer_Auf:true}, ask:'Schritt'}},
    {type:'single', q:'Was ist der Vorteil von <code>Band_Lauf := Schritt = 1;</code> nach dem CASE?', options:['Der Ausgang ist in jedem Zyklus eindeutig festgelegt','Das Band läuft schneller','Man spart das CASE'], correct:0, explain:'Kein Ausgang kann aus einem vorherigen Schritt „hängen bleiben“.'},
    {type:'single', q:'Eine Kette hängt in Schritt 1, obwohl der Sensor TRUE meldet. Häufigste Ursache?', options:['Falscher Zielschritt, z.B. Schritt := 1 statt 2','Zu kleine Zykluszeit','Der Sensor ist zu schnell'], correct:0, explain:'Tippfehler in der Weiterschaltung sind der Klassiker.'},
    {type:'single', q:'Wann nutzt man in einer Schrittkette einen Timer statt eines Sensors?', options:['Wenn es keine Rückmeldung gibt, z.B. Aushärtezeit','Immer, Timer sind genauer','Nie'], correct:0, explain:'Rückmeldungen sind robuster; Zeiten nur, wo nichts messbar ist.'}
  ]});

defTheory({ id:'t10b', ch:10, pos:'mid', title:'Profi-Muster für sichere Ketten', minutes:5,
  lesson:`
<h4>1. Timer außerhalb des CASE</h4>
<pre class="code">Greif_Timer(IN := Schritt = 1, PT := T#2S);   // vor dem CASE
CASE Schritt OF
  1: IF Greif_Timer.Q THEN Schritt := 2; END_IF;
END_CASE;</pre>
<p>Ein Baustein, der nur in einem CASE-Zweig aufgerufen wird, „friert ein“, sobald die Kette weiterschaltet — er sieht nie, dass IN FALSE wurde. Beim nächsten Zyklus ist sein Timer schon abgelaufen. Mit <code>IN := Schritt = 1</code> wird er beim Verlassen automatisch zurückgesetzt.</p>
<h4>2. Not-Halt vor der Kette</h4>
<pre class="code">IF Not_Aus THEN Schritt := 99; END_IF;       // aus JEDEM Schritt
CASE Schritt OF
  99: IF Quittieren AND NOT Not_Aus THEN Schritt := 0; END_IF;
END_CASE;</pre>
<p>Die Rückkehr erfolgt nie automatisch — immer nur durch bewusstes Quittieren.</p>
<h4>3. Eingänge merken</h4>
<p>Werte, die sich während des Ablaufs ändern können (Farbe, Typ), speichert man beim Schrittwechsel: <code>Merk_Farbe := Farbe;</code></p>
<h4>Programmaufbau</h4>
<p>Eingänge auswerten → Flanken → Not-Halt → Timer → <b>CASE</b> → Ausgänge.</p>`,
  questions:[
    {type:'single', q:'Warum ruft man Timer außerhalb des CASE auf?', options:['Damit sie beim Verlassen des Schritts zurückgesetzt werden','Weil Timer im CASE verboten sind','Damit sie schneller ablaufen'], correct:0, explain:'Nur ein aufgerufener Baustein sieht, dass sein Eingang FALSE wird.'},
    {type:'single', q:'Wo steht der Not-Halt-Sprung?', options:['Vor dem CASE','Im Schritt 0','Nach den Ausgängen'], correct:0, explain:'Dann wirkt er aus jedem Schritt heraus.'},
    {type:'single', q:'Darf die Kette nach dem Loslassen des Not-Aus automatisch weiterlaufen?', options:['Nein, erst nach Quittieren','Ja, sofort','Ja, nach 5 Sekunden'], correct:0, explain:'Automatischer Wiederanlauf wäre gefährlich.'},
    {type:'single', q:'Wozu dient <code>Merk_Farbe := Farbe;</code> beim Schrittwechsel?', options:['Der Wert bleibt erhalten, auch wenn sich der Eingang später ändert','Die Farbe wird schneller gelesen','Das ist nötig, weil Eingänge nicht in CASE stehen dürfen'], correct:0, explain:'Der Sensor sieht womöglich schon das nächste Teil.'},
    {type:'input', q:'Ein TON wird nur in Schritt 1 mit <code>IN := TRUE</code> aufgerufen (PT = 2 s). Im ersten Zyklus lief er 3 s. Wie viele Sekunden wartet Schritt 1 im zweiten Durchlauf ungefähr?', answer:['0','null'], explain:'Der Timer wurde nie zurückgesetzt — Q ist sofort TRUE. Genau diesen Fehler behebst du in dieser Lektion.'}
  ]});
