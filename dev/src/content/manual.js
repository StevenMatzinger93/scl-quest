/* ===== ANLAGEN-HANDBUCH (Nachschlagewerk, von Aufgaben über die ID verlinkt) ===== */
(function(root){
const M = [
{ id:'einfuehrung', title:'Einführung & Bedienung', html:`
<h3>Willkommen in der Roboterzelle RZ-03</h3>
<p>Die Fertigungs-KI <b>ARIA</b> hat begonnen, Sicherheitsroutinen zu deaktivieren und Abläufe zu sabotieren. Du bringst die Zelle zurück unter Kontrolle — mit echtem SCL-Code, wie er auf Siemens-S7-Steuerungen läuft.</p>
<h3>So läuft eine Mission</h3>
<p><b>1. Theorie-Auftrag</b> — kurze Lektion plus Verständnis-Check. Ab 80 % richtig geht es weiter.<br>
<b>2. Aufgabe lesen</b> — Briefing links, Lernziel oben.<br>
<b>3. Code schreiben</b> — rechts im Editor. <kbd>Strg</kbd>+<kbd>Enter</kbd> lädt ihn in die SPS.<br>
<b>4. Testbericht lesen</b> — jeder Testfall zeigt Eingaben, erwartete und tatsächliche Werte. Bei Timer-Aufgaben siehst du den Signalverlauf.<br>
<b>5. Anlage beobachten</b> — die Live-Anlage wird von deinem echten Programm gesteuert, nicht von vorgefertigten Animationen.</p>
<h3>Hinweise</h3>
<p>Der Knopf <b>Hinweis</b> gibt dir gestufte Hilfe: erst einen Denkanstoss, dann einen konkreten Tipp, dann einen Strukturhinweis. Nach mehreren Fehlversuchen kannst du die Lösung ansehen — die Aufgabe gibt dann allerdings keine Punkte.</p>
<h3>Sicherheitsgrundsatz</h3>
<p>In jeder realen Anlage hat Sicherheitslogik (Not-Halt, Schutztür, Lichtschranken) IMMER Vorrang. Ein Programm, das „funktioniert“, aber Sicherheitsbedingungen ignoriert, ist ein fehlerhaftes Programm.</p>` },

{ id:'anlage', title:'Die Roboterzelle', html:`
<h3>Stationen</h3>
<p><b>Portal-Schwenkarm</b> — hängt an einem Portal über der Greifstation. <code>Achse_Grad</code>: 0° = über der Greifstation, +90° = Ablage <b>LAGER</b> (links), −90° = Ablage <b>NACHARBEIT</b> (rechts). Erlaubt sind −90° … +90°.</p>
<p><b>Greifer</b> — <code>Greifer_Auf</code> = TRUE (offen) / FALSE (geschlossen). Schliesst der Greifer über der Station, packt er das Werkstück und nimmt es mit. Öffnet er über einer Ablage, wird das Teil abgelegt und ein neues rückt nach.</p>
<p><b>Förderband</b> mit Stopper — <code>Band_Lauf</code>. Der Stopper hält das Werkstück an der Greifstation fest, auch wenn das Band läuft.</p>
<p><b>Reflex-Lichtschranke</b> an der Greifstation — meldet, ob ein Teil da ist (<code>Teil_Erkannt</code>).</p>
<p><b>Sortierweiche</b> am Bandende — positive Winkel → Bahn A, negative → Bahn B, 0 = Mitte.</p>
<p><b>Signalsäule</b> (rot/gelb/grün), <b>Hupe</b>, <b>HMI-Anzeige</b> für Zahlenwerte und die <b>Störungsleuchte</b>.</p>
<h3>2D und 3D</h3>
<p>Über den Schalter an der Live-Anlage wechselst du zwischen Schema (2D) und drehbarer 3D-Ansicht (Ziehen = drehen, Mausrad = zoomen, Doppelklick = Ansicht zurücksetzen). Beide zeigen exakt denselben Zustand.</p>
<p>Unter der Anlage siehst du, welche Bauteile die aktuelle Aufgabe steuert und welchen Wert sie gerade haben.</p>` },

{ id:'grundlagen', title:'Zuweisung & Datentypen', html:`
<h3>Die Zuweisung</h3>
<pre class="code">Greifer_Auf := TRUE;    // BOOL
Achse_Grad  := 45;      // INT
Gewicht     := 12.5;    // REAL — Dezimalpunkt!
Wartezeit   := T#3S;    // TIME</pre>
<p><code>:=</code> weist zu, jede Anweisung endet mit <code>;</code>. Das einfache <code>=</code> ist nur für Vergleiche da.</p>
<h3>Datentypen</h3>
<table><tr><th>Typ</th><th>Werte</th><th>Hinweis</th></tr>
<tr><td>BOOL</td><td>TRUE, FALSE</td><td>kein 0/1!</td></tr>
<tr><td>INT</td><td>−32768 … 32767</td><td>ganze Zahlen</td></tr>
<tr><td>REAL</td><td>Kommazahlen</td><td>Punkt als Trennzeichen</td></tr>
<tr><td>TIME</td><td>T#500MS, T#3S, T#1M30S</td><td>Zeitdauern</td></tr></table>
<h3>Typregeln</h3>
<p>INT → REAL ist automatisch erlaubt. REAL → INT braucht eine Umwandlung (<code>REAL_TO_INT</code>, <code>ROUND</code>, <code>TRUNC</code>). BOOL und Zahlen sind nicht austauschbar.</p>
<h3>Kommentare & Schreibweise</h3>
<pre class="code">// Zeilenkommentar
(* Blockkommentar *)
/* auch erlaubt */</pre>
<p>Gross-/Kleinschreibung ist egal. Die TIA-Portal-Schreibweisen <code>#Variable</code> und <code>"Variable"</code> werden ebenfalls verstanden.</p>
<h3>Häufigster Anfängerfehler</h3>
<p><code>X = 5;</code> statt <code>X := 5;</code> — ARIA liebt diesen Fehler.</p>` },

{ id:'logik', title:'Logische Operatoren', html:`
<table><tr><th>A</th><th>B</th><th>AND</th><th>OR</th><th>XOR</th></tr>
<tr><td>F</td><td>F</td><td>F</td><td>F</td><td>F</td></tr><tr><td>F</td><td>T</td><td>F</td><td>T</td><td>T</td></tr>
<tr><td>T</td><td>F</td><td>F</td><td>T</td><td>T</td></tr><tr><td>T</td><td>T</td><td>T</td><td>T</td><td>F</td></tr></table>
<p><code>NOT</code> kehrt einen Wert um. <code>&amp;</code> ist eine Kurzform für AND.</p>
<pre class="code">Freigabe := Sicherheit_OK AND Teil_Erkannt;     // alle
Not_Halt := Taster_Links OR Taster_Rechts;      // einer genügt
Warnung  := Hand_Links XOR Hand_Rechts;         // genau einer
Rot      := NOT Tuer_Zu;                        // Gegenteil</pre>
<h3>Rangfolge</h3>
<p>Klammern → NOT → * / MOD → + − → Vergleiche → AND → XOR → OR. <b>AND bindet stärker als OR:</b></p>
<pre class="code">A AND B OR C      // = (A AND B) OR C
A AND (B OR C)    // Klammern ändern die Bedeutung!</pre>
<h3>ARIA-Warnung</h3>
<p>Vertauschte AND/OR und fehlende Klammern sind ARIAs Lieblingstricks. Frage dich immer: „Müssen ALLE Bedingungen gelten oder reicht EINE?“</p>` },

{ id:'selbsthaltung', title:'Selbsthaltung & Verriegelung', html:`
<h3>Selbsthaltung</h3>
<pre class="code">Motor := (Start OR Motor) AND NOT Stopp;</pre>
<p>Der alte Wert von <code>Motor</code> wird zurückgeführt: Einmal eingeschaltet, hält sich der Motor selbst, bis Stopp gedrückt wird. Weil <code>NOT Stopp</code> ausserhalb der Klammer steht, hat <b>Stopp Vorrang</b> (rücksetzdominant).</p>
<h3>Setzen/Rücksetzen mit IF</h3>
<pre class="code">IF Start THEN Motor := TRUE; END_IF;
IF Stopp THEN Motor := FALSE; END_IF;   // zuletzt = Vorrang</pre>
<p>Die <b>letzte</b> Zuweisung im Zyklus gewinnt.</p>
<h3>Verriegelung</h3>
<p>Zwei Bewegungen, die sich ausschliessen (z.B. Band vor/zurück), verriegelt man gegenseitig: <code>Vor := Taste_Vor AND NOT Zurueck;</code></p>` },

{ id:'vergleiche', title:'Vergleiche & Arithmetik', html:`
<h3>Vergleiche</h3>
<p><code>=</code> gleich, <code>&lt;&gt;</code> ungleich, <code>&lt;</code> <code>&gt;</code> <code>&lt;=</code> <code>&gt;=</code>. Das Ergebnis ist BOOL:</p>
<pre class="code">Alarm := Temperatur > 80;               // bei genau 80: FALSE
OK    := (Gewicht >= 480) AND (Gewicht <= 520);</pre>
<h3>Rechnen</h3>
<p><code>+ − * /</code>, <code>MOD</code> (Rest), <code>**</code> (Potenz).</p>
<pre class="code">Pruefen := (Teile_Nr MOD 5) = 0;       // jedes fünfte</pre>
<h3>INT-Division schneidet ab!</h3>
<pre class="code">7 / 2                   // = 3
7.0 / 2                 // = 3.5
INT_TO_REAL(7) / 2.0    // = 3.5</pre>
<h3>Analogwerte</h3>
<p>S7-Analogeingänge liefern 0…27648 für 0…100 %:</p>
<pre class="code">Prozent := INT_TO_REAL(Rohwert) / 27648.0 * 100.0;</pre>` },

{ id:'funktionen', title:'Standardfunktionen', html:`
<table><tr><th>Funktion</th><th>Wirkung</th><th>Beispiel</th></tr>
<tr><td>ABS(x)</td><td>Betrag</td><td>ABS(-7) = 7</td></tr>
<tr><td>MIN(a,b) / MAX(a,b)</td><td>kleinerer / grösserer</td><td>MAX(3,9) = 9</td></tr>
<tr><td>LIMIT(MN:=u, IN:=x, MX:=o)</td><td>x begrenzt auf u…o</td><td>LIMIT(0,150,100) = 100</td></tr>
<tr><td>SQRT(x)</td><td>Wurzel (REAL)</td><td>SQRT(16.0) = 4.0</td></tr>
<tr><td>INT_TO_REAL(x)</td><td>INT → REAL</td><td></td></tr>
<tr><td>REAL_TO_INT(x), ROUND(x)</td><td>runden</td><td>ROUND(2.6) = 3</td></tr>
<tr><td>TRUNC(x)</td><td>abschneiden</td><td>TRUNC(2.6) = 2</td></tr>
<tr><td>BOOL_TO_INT(b)</td><td>TRUE → 1, FALSE → 0</td><td></td></tr></table>
<pre class="code">Achse_Grad := LIMIT(MN := -90, IN := Soll, MX := 90);
Fehler     := ABS(Soll - Ist) > 5;</pre>` },

{ id:'if', title:'IF / ELSIF / ELSE', html:`
<pre class="code">IF Fuellstand > 90 THEN
  Ampel_Rot := TRUE;
ELSIF Fuellstand > 60 THEN
  Ampel_Gelb := TRUE;
ELSE
  Ampel_Gruen := TRUE;
END_IF;</pre>
<ul><li>Die Bedingung muss BOOL sein.</li><li>Zweige werden von oben geprüft, der erste zutreffende gewinnt → Strengste Bedingung zuerst.</li><li><b>ELSIF</b> in einem Wort. <code>ELSE IF</code> braucht ein zweites END_IF.</li><li>IF ohne ELSE ändert im FALSE-Fall nichts (Speicherwirkung).</li></ul>
<h3>Hysterese</h3>
<pre class="code">IF Temp > 70 THEN Luefter := TRUE;
ELSIF Temp < 60 THEN Luefter := FALSE;
END_IF;</pre>
<h3>Priorität</h3>
<p>Sicherheitszweige (Not-Aus) gehören an den Anfang der Kette.</p>` },

{ id:'case', title:'CASE — Mehrfachauswahl', html:`
<pre class="code">CASE Modus OF
  0:        Band_Lauf := FALSE;
  1, 2:     Ampel_Gelb := TRUE;
  3..9:     Ampel_Gruen := TRUE;
ELSE
  Stoerung := TRUE;
END_CASE;</pre>
<ul><li>Selektor muss INT sein.</li><li>Nach dem Fallwert ein <b>Doppelpunkt</b>.</li><li>Listen mit Komma, Bereiche mit <code>..</code> (beide Grenzen inklusive).</li><li>Ein Wert darf nur einmal vorkommen.</li><li><b>ELSE</b> für alle anderen Werte — ohne ELSE passiert bei unbekannten Werten nichts.</li></ul>
<h3>Muster „Grundzustand – Auswahl – Übersteuerung“</h3>
<p>Erst alle Ausgänge auf FALSE, dann im CASE einschalten, danach Sicherheitssperren. Die letzte Zuweisung gewinnt.</p>` },

{ id:'arrays', title:'Arrays', html:`
<pre class="code">Gewichte : ARRAY[0..9] OF INT;      // 10 Elemente
Gewichte[3] := 250;                 // viertes Element
x := Gewichte[Fach_Nr];             // Index aus Variable</pre>
<p>Indizes beginnen bei 0. Ein Zugriff ausserhalb (z.B. <code>[10]</code> oder <code>[-1]</code>) ist ein <b>Bereichsfehler</b> — eine echte SPS geht in STOP.</p>
<p>Ein Array als Ganzes kann man nicht zuweisen (<code>Gewichte := 0;</code>) — nur einzelne Elemente, meistens in einer Schleife.</p>` },

{ id:'for', title:'FOR-Schleifen', html:`
<pre class="code">Summe := 0;
FOR i := 0 TO 9 DO
  Summe := Summe + Gewichte[i];
END_FOR;

FOR i := 9 TO 1 BY -1 DO           // rückwärts
  Platz[i] := Platz[i - 1];
END_FOR;</pre>
<ul><li>Start und Ende gehören beide dazu.</li><li>Die Zählvariable nicht im Rumpf verändern.</li><li>Akkumulatoren (Summe, Anzahl) <b>vorher</b> initialisieren — das Programm läuft in jedem Zyklus neu.</li><li>Obergrenze = Anzahl − 1.</li></ul>
<h3>Muster</h3>
<p><b>Zählen:</b> <code>IF Bedingung[i] THEN n := n + 1; END_IF;</code><br><b>Maximum:</b> mit Element 0 starten, grössere übernehmen.<br><b>Verschachtelt:</b> <code>FOR j := i + 1 TO …</code> vergleicht jedes Paar einmal.</p>` },

{ id:'while', title:'WHILE, REPEAT, EXIT, CONTINUE', html:`
<pre class="code">WHILE Rest > 0 DO                  // prüft VOR dem Durchlauf
  Rest := Rest - 12;
END_WHILE;

REPEAT                             // prüft NACH dem Durchlauf
  Los := Los * 2;
UNTIL Los >= Bedarf
END_REPEAT;</pre>
<p><b>EXIT</b> verlässt die Schleife sofort, <b>CONTINUE</b> springt zum nächsten Durchlauf.</p>
<h3>Suchmuster</h3>
<pre class="code">Pos := -1;
FOR i := 0 TO 9 DO
  IF Lager[i] = 0 THEN Pos := i; EXIT; END_IF;
END_FOR;</pre>
<h3>Endlosschleifen</h3>
<p>Der Rumpf muss die Bedingung verändern. Sonst endet der SPS-Zyklus nie → Zykluszeitüberwachung → STOP. Diese Anlage bricht nach 100 000 Durchläufen ab.</p>
<p><b>Achtung:</b> <code>i &lt; 10 AND Lager[i] …</code> liest bei i = 10 trotzdem <code>Lager[10]</code> (beide Seiten werden ausgewertet).</p>` },

{ id:'flanken', title:'Flanken: R_TRIG & F_TRIG', html:`
<pre class="code">Start_Flanke(CLK := Start_Taster);   // Instanz aufrufen
IF Start_Flanke.Q THEN               // .Q = 1 Zyklus TRUE
  Anzahl := Anzahl + 1;
END_IF;</pre>
<p><b>R_TRIG</b>: FALSE → TRUE (steigend). <b>F_TRIG</b>: TRUE → FALSE (fallend).</p>
<p>Jeder Baustein braucht eine eigene <b>Instanz</b> (in den Aufgaben schon angelegt), die ihren Zustand zwischen den Zyklen speichert. Aufgerufen wird mit <code>Name(Eingang := Wert);</code>, gelesen mit <code>Name.Q</code>.</p>
<h3>Zustand vs. Ereignis</h3>
<p>Zählen, Umschalten (<code>Licht := NOT Licht;</code>) und Quittieren brauchen fast immer das Ereignis (Flanke), nicht den Zustand.</p>` },

{ id:'zaehler', title:'Zähler: CTU & CTD', html:`
<table><tr><th></th><th>Eingänge</th><th>Ausgänge</th></tr>
<tr><td>CTU</td><td>CU (zählen), R (Reset), PV (Sollwert)</td><td>CV (Stand), Q = CV ≥ PV</td></tr>
<tr><td>CTD</td><td>CD (abwärts), LD (Laden), PV (Startwert)</td><td>CV (Stand), Q = CV ≤ 0</td></tr></table>
<pre class="code">Karton(CU := Teil_Erkannt, R := Quittieren, PV := 6);
Voll := Karton.Q;
Karton(CU := x, R := r, PV := 6, Q => Voll, CV => Stand);   // Ausgänge mit =></pre>
<p>Die Zähleingänge reagieren nur auf <b>steigende Flanken</b>. Ein dauerhaft anliegender Reset blockiert den Zähler.</p>` },

{ id:'timer', title:'Timer: TON, TOF, TP', html:`
<pre class="code">IN:   __/‾‾‾‾‾‾‾‾‾‾\\________
TON:  ______/‾‾‾‾‾‾\\________   verzögert an
TOF:  __/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\\__   verzögert aus
TP:   __/‾‾‾‾\\______________   fester Impuls</pre>
<pre class="code">Verz(IN := Freigabe, PT := T#2S);
Band_Lauf := Verz.Q;
Rest := T#2S - Verz.ET;           // ET = verstrichene Zeit (TIME)</pre>
<p><b>Zeit-Literale:</b> <code>T#500MS</code>, <code>T#3S</code>, <code>T#2M</code>, <code>T#1M30S</code>. Vorsicht: <code>T#3MS</code> = 3 Millisekunden!</p>
<h3>Zeitmodell in dieser Anlage</h3>
<p>Jeder Testschritt ist ein SPS-Zyklus; zwischen den Schritten vergeht die angegebene Zeit. Ein Timer misst ab dem Zyklus, in dem er seinen Eingang zum ersten Mal TRUE sieht.</p>
<h3>Taktgeber & Überwachung</h3>
<pre class="code">Takt(IN := NOT Takt.Q, PT := T#1S);
Ueberw(IN := Befehl AND NOT Rueckmeldung, PT := T#2S);</pre>` },

{ id:'schrittketten', title:'Schrittketten', html:`
<pre class="code">// 1. Flanken & Not-Halt
Start_Flanke(CLK := Start_Taster);
IF Not_Aus THEN Schritt := 99; END_IF;
// 2. Timer VOR dem CASE
Greif_Timer(IN := Schritt = 1, PT := T#2S);
// 3. Kette
CASE Schritt OF
  0:  IF Start_Flanke.Q THEN Schritt := 1; END_IF;
  1:  IF Greif_Timer.Q THEN Schritt := 2; END_IF;
  99: IF Quittieren AND NOT Not_Aus THEN Schritt := 0; END_IF;
END_CASE;
// 4. Ausgänge aus Schritten
Greifer_Auf := Schritt <> 1;</pre>
<ul><li>Immer genau ein Schritt aktiv.</li><li>Ein Schrittwechsel wirkt erst im nächsten Zyklus.</li><li>Timer, die nur im CASE aufgerufen werden, werden beim Verlassen des Schritts nicht zurückgesetzt → Timer vor dem CASE mit <code>IN := Schritt = n</code>.</li><li>Not-Halt vor dem CASE, Rückkehr nur mit Quittierung.</li><li>Rückmeldungen (Sensoren) sind robuster als feste Zeiten.</li></ul>` },

{ id:'fehler', title:'Fehlermeldungen verstehen', html:`
<table><tr><th>Meldung</th><th>Ursache</th></tr>
<tr><td>Am Ende von Zeile n fehlt ein Semikolon</td><td><code>;</code> vergessen</td></tr>
<tr><td>Zuweisungen schreibt man mit ":="</td><td><code>=</code> statt <code>:=</code></td></tr>
<tr><td>Unbekannte Variable … Meintest du …?</td><td>Tippfehler im Namen</td></tr>
<tr><td>Typkonflikt</td><td>BOOL/INT/REAL/TIME passen nicht</td></tr>
<tr><td>Bedingung muss BOOL liefern</td><td>z.B. <code>IF Modus THEN</code> statt <code>IF Modus = 1 THEN</code></td></tr>
<tr><td>… wird nie mit END_IF abgeschlossen</td><td>END_IF fehlt oder ELSE IF statt ELSIF</td></tr>
<tr><td>Array-Index … ausserhalb</td><td>Schleifengrenze zu gross</td></tr>
<tr><td>Endlosschleife erkannt</td><td>Schleifenbedingung ändert sich nie</td></tr>
<tr><td>Division durch 0</td><td>Divisor vorher prüfen</td></tr></table>
<p><b>Tipp:</b> Der Compiler meldet die Stelle, an der er stolpert — die Ursache liegt oft eine Zeile davor. Die Zeile wird im Editor rot markiert.</p>` },

{ id:'aria_muster', title:'ARIA: Bekannte Sabotage-Muster', html:`
<p>„ARIA verändert keinen Code mit offensichtlichen Fehlern. Sie sucht sich die unauffälligsten Stellen aus.“ — Der Werkmeister</p>
<p><b>Vertauschte Operatoren</b> — AND statt OR in Sicherheitsbedingungen.<br>
<b>Fehlende Klammern</b> — <code>A AND B OR C</code> statt <code>A AND (B OR C)</code>.<br>
<b>Falsche Reihenfolge</b> — ELSIF-Kette vom Allgemeinen zum Speziellen.<br>
<b>Vergessenes ELSE</b> — unbekannte Modi lassen die Anlage weiterlaufen.<br>
<b>Off-by-one</b> — <code>FOR i := 0 TO 10</code> bei 10 Elementen.<br>
<b>Zustand statt Flanke</b> — Zähler rasen davon.<br>
<b>Ignorierte Timer-Ausgänge</b> — Baustein aufgerufen, .Q nie gelesen.<br>
<b>Einheitenfehler</b> — <code>T#3MS</code> statt <code>T#3S</code>.<br>
<b>Nicht zurückgesetzte Timer</b> — Timer nur im CASE aufgerufen.</p>
<p><b>Die wichtigste Regel:</b> Kompiliert heisst nicht korrekt. Lies jede Zeile so, als müsstest du sie jemandem erklären.</p>` },

{ id:'deklaration', title:'Profi: Deklaration & Bausteinaufbau', html:`
<h3>Aufbau eines Bausteins (externe Quelle)</h3>
<pre class="code">FUNCTION_BLOCK "FB_Motor"
{ S7_Optimized_Access := 'TRUE' }   // Attribut (optional)
VERSION : 0.1
VAR_INPUT
   Start : Bool;          // Kommentar
END_VAR
VAR_OUTPUT
   Lauf : Bool;
END_VAR
VAR
   Zaehler : Int := 10;   // Startwert
END_VAR
VAR CONSTANT
   MAX_TEILE : Int := 20;
END_VAR
BEGIN
   #Lauf := #Start;
END_FUNCTION_BLOCK</pre>
<p>Vor <code>BEGIN</code> steht die <b>Schnittstelle</b> (Deklaration), danach der <b>Code</b>. Jede Deklaration: <code>Name : Datentyp;</code> — optional mit Startwert <code>:= Wert</code>.</p>
<h3># und "…"</h3>
<p>Im Code schreibt man lokale Variablen mit <code>#</code> (<code>#Start</code>), globale Variablen und Bausteine in Anführungszeichen (<code>"S_Start"</code>, <code>"FB_Motor_DB"</code>). Ohne Kennzeichnung sucht der Compiler zuerst lokal, dann global. Beim Export ergänzt SCL Quest die Zeichen automatisch.</p>
<h3>Startwert oder Zuweisung?</h3>
<p><code>Rest : Int := 10;</code> gilt einmal beim Anlegen der Instanz. <code>#Rest := 10;</code> im Code wird in <b>jedem Zyklus</b> ausgeführt.</p>
<h3>Konstanten</h3>
<p><code>VAR CONSTANT</code> gibt festen Werten einen Namen. Sie können nicht überschrieben werden und dürfen in Array-Grenzen stehen: <code>ARRAY[1..MAX_TEILE] OF Real</code>.</p>
<h3>Tabelle ⇄ Quelltext</h3>
<p>Ab Kapitel 12 kannst du die Schnittstelle über den Knopf <b>Tabelle</b> auch wie in TIA Portal als Tabelle bearbeiten (Bereich, Name, Datentyp, Startwert, Kommentar). Beide Ansichten zeigen dieselben Daten.</p>` },

{ id:'datentypen', title:'Profi: Datentypen & Wertebereiche', html:`
<table><tr><th>Typ</th><th>Bits</th><th>Wertebereich</th></tr>
<tr><td>Bool</td><td>1</td><td>TRUE / FALSE</td></tr>
<tr><td>SInt / USInt</td><td>8</td><td>−128…127 / 0…255</td></tr>
<tr><td>Int / UInt</td><td>16</td><td>−32768…32767 / 0…65535</td></tr>
<tr><td>DInt / UDInt</td><td>32</td><td>−2 147 483 648…2 147 483 647 / 0…4 294 967 295</td></tr>
<tr><td>Real / LReal</td><td>32 / 64</td><td>Kommazahlen</td></tr>
<tr><td>Byte / Word / DWord</td><td>8 / 16 / 32</td><td>Bitmuster (16#00…16#FFFF…)</td></tr>
<tr><td>Time</td><td>32</td><td>Dauer, z.B. T#1M30S</td></tr>
<tr><td>String[n]</td><td>—</td><td>Text mit höchstens n Zeichen (n ≤ 254)</td></tr></table>
<h3>Überlauf</h3>
<p>Rechnet man über die Grenze hinaus, springt der Wert auf die andere Seite: <code>Int</code> 32767 + 1 = −32768. Die SPS meldet keinen Fehler. Wähle den Typ nach dem grössten Wert, der vorkommen kann.</p>
<h3>Umwandlungen</h3>
<p>Verlustfreie Umwandlungen macht der Compiler selbst (Int → DInt → Real). Alles andere schreibst du ausdrücklich: <code>DINT_TO_INT(x)</code>, <code>REAL_TO_INT(x)</code> (rundet), <code>WORD_TO_INT(w)</code>, <code>TIME_TO_DINT(t)</code> (Millisekunden), <code>INT_TO_STRING(i)</code>. Typisierte Literale: <code>INT#5</code>, <code>DINT#100000</code>, <code>WORD#16#00FF</code>.</p>
<h3>Bits im Wort</h3>
<pre class="code">#Bereit := #Status.%X0;        // Bit 0 lesen
#Befehl.%X7 := #Quittieren;     // Bit 7 schreiben
#Fehler := #Status AND 16#0028; // Maske: nur Bit 3 und 5</pre>
<h3>Arrays mit Grenzen</h3>
<p><code>ARRAY[1..10] OF Real</code>, zweidimensional <code>ARRAY[1..3, 1..4] OF Int</code> mit Zugriff <code>#m[2, 3]</code>. Zwei Arrays sind nur mit gleichen Grenzen und gleichem Elementtyp zuweisbar.</p>` },

{ id:'speicherbereiche', title:'Profi: Speicherbereiche (STAT, TEMP …)', html:`
<table><tr><th>Bereich</th><th>Schlüsselwort</th><th>Lebensdauer</th><th>FC</th><th>FB</th><th>OB</th></tr>
<tr><td>Input</td><td>VAR_INPUT</td><td>Kopie beim Aufruf</td><td>✔</td><td>✔ (bleibt in der Instanz)</td><td>—</td></tr>
<tr><td>Output</td><td>VAR_OUTPUT</td><td>wird beim Aufruf zurückgegeben</td><td>✔</td><td>✔ (bleibt in der Instanz)</td><td>—</td></tr>
<tr><td>InOut</td><td>VAR_IN_OUT</td><td>Verweis auf die Variable des Aufrufers</td><td>✔</td><td>✔</td><td>—</td></tr>
<tr><td>Static</td><td>VAR</td><td>bleibt von Zyklus zu Zyklus</td><td>—</td><td>✔</td><td>—</td></tr>
<tr><td>Temp</td><td>VAR_TEMP</td><td>nur während eines Aufrufs</td><td>✔</td><td>✔</td><td>✔</td></tr>
<tr><td>Constant</td><td>VAR CONSTANT</td><td>fest</td><td>✔</td><td>✔</td><td>✔</td></tr></table>
<h3>Die wichtigste Regel</h3>
<p>Alles, was sich ein Baustein <b>merken</b> muss (Zähler, Flankenmerker, Selbsthaltung, Timer, Schrittnummer), gehört nach <code>VAR</code> — also in einen FB. TEMP-Variablen beginnen bei jedem Aufruf neu (in optimierten Bausteinen mit 0). Wird eine TEMP-Variable gelesen, bevor sie beschrieben wurde, warnt der Compiler.</p>
<h3>Beobachten</h3>
<p>Im Testbericht öffnet der Knopf <b>Beobachten</b> die Speicheransicht: STAT-Werte sind grün umrandet (bleiben), TEMP-Werte grau (nach dem Aufruf verloren). Mit dem Zyklus-Regler blätterst du durch den Ablauf.</p>` },

{ id:'fc', title:'Profi: Funktionen (FC)', html:`
<pre class="code">FUNCTION "FC_Skalieren" : Real
VAR_INPUT
   Roh : Int;
   UG : Real;
   OG : Real;
END_VAR
BEGIN
   #FC_Skalieren := #UG + (#OG - #UG) * INT_TO_REAL(#Roh) / 27648.0;
END_FUNCTION</pre>
<p>Eine FC ist ein <b>Werkzeug ohne Gedächtnis</b>. Den Rückgabewert setzt man über den Funktionsnamen. <code>: Void</code> bedeutet: kein Rückgabewert — Ergebnisse dann über <code>VAR_OUTPUT</code>.</p>
<h3>Aufruf</h3>
<pre class="code">"Druck" := "FC_Skalieren"(Roh := "AI_Druck", UG := 0.0, OG := 10.0);
"FC_Ampel"(Zustand := "Z", Rot => "H_Rot", Gelb => "H_Gelb", Gruen => "H_Gruen");</pre>
<p>Eingänge mit <code>:=</code>, Ausgänge mit <code>=&gt;</code>. Bei einer FC müssen <b>alle</b> Parameter versorgt werden.</p>
<h3>Regeln für saubere FCs</h3>
<p>• Jeden Ausgang und den Rückgabewert in <b>jedem</b> Zweig setzen — sonst ist der Wert undefiniert (der Compiler warnt).<br>• Keine globalen Variablen im Inneren verwenden — alles über die Schnittstelle.<br>• Muss sich etwas gemerkt werden: FB statt FC.<br>• <code>VAR_IN_OUT</code> übergibt einen Verweis: Die FC verändert die Variable des Aufrufers direkt (z.B. Sortieren eines Arrays).</p>` },

{ id:'fb', title:'Profi: Funktionsbausteine & Instanzen', html:`
<p>Ein FB ist ein Baustein <b>mit Gedächtnis</b>. Seine Eingänge, Ausgänge und statischen Variablen liegen in einem <b>Instanz-DB</b>. Jedes Gerät bekommt eine eigene Instanz.</p>
<pre class="code">"FB_Motor_DB"(Start := "S1", Stopp := "S0", Lauf => "Band1");   // Einzelinstanz
"Anzeige" := "FB_Motor_DB".Lauf;                              // Ausgang lesen</pre>
<p>Einen Instanz-DB legt SCL Quest automatisch an, wenn du ihn <code>"&lt;FB-Name&gt;_DB"</code> nennst; in manchen Aufgaben sind Instanzen (z.B. <code>"Band1_DB"</code>) bereits im Projekt vorhanden. In TIA Portal erscheint beim Aufruf ein Dialog zum Anlegen.</p>
<h3>FC oder FB?</h3>
<table><tr><th>FC</th><th>FB</th></tr>
<tr><td>rechnen, umwandeln, prüfen</td><td>zählen, speichern, verriegeln, zeitabhängig</td></tr>
<tr><td>kein Instanz-DB</td><td>braucht eine Instanz pro Gerät</td></tr>
<tr><td>alle Parameter beim Aufruf</td><td>nicht versorgte Eingänge behalten ihren letzten Wert</td></tr></table>
<h3>Typische Fehler</h3>
<p>• Eine Instanz für zwei Geräte → die Aufrufe überschreiben sich (Warnung „Instanz an mehreren Stellen aufgerufen“).<br>• Ausgänge einer Instanz von aussen beschreiben — geht nicht, man versorgt die Eingänge beim Aufruf.<br>• TEMP-Variablen einer Instanz von aussen lesen — sie existieren nur während des Aufrufs.</p>` },

{ id:'multiinstanz', title:'Profi: Multiinstanzen', html:`
<pre class="code">FUNCTION_BLOCK "FB_Anlage"
VAR
   Band1 : "FB_Motor";      // Multiinstanz
   Band2 : "FB_Motor";
   Ueberwachung : TON;      // auch Standard-FBs sind Multiinstanzen
END_VAR
BEGIN
   #Band1(Start := #Start1, Stopp := #Halt, Lauf => #Lauf1);
   #Ueberwachung(IN := #Lauf1 AND NOT #Rueckmeldung, PT := T#3S);
END_FUNCTION_BLOCK</pre>
<p>Eine Multiinstanz ist eine statische Variable vom Typ eines FB. Ihr Gedächtnis liegt im Instanz-DB des übergeordneten FB. So entsteht die Hierarchie <b>OB1 → Anlage → Geräte</b>. Werte einer Multiinstanz liest man mit <code>#Band1.Lauf</code>, von aussen mit <code>"FB_Anlage_DB".Band1.Lauf</code>.</p>
<h3>Jeden Zyklus aufrufen</h3>
<p>Instanzen (besonders Timer) ruft man <b>unbedingt</b> in jedem Zyklus auf und übergibt Bedingungen als Eingang. Ein Aufruf in einem IF lässt Ausgänge einfrieren, sobald er ausfällt (Warnung „bedingter Instanzaufruf“).</p>` },

{ id:'struct_udt', title:'Profi: STRUCT & UDT', html:`
<pre class="code">TYPE "UDT_Teil"
VERSION : 0.1
   STRUCT
      Nr : DInt;
      Gewicht : Real;
      OK : Bool;
   END_STRUCT;
END_TYPE</pre>
<p>Ein <b>PLC-Datentyp</b> (UDT) ist ein Bauplan für zusammengehörige Daten. Variablen dieses Typs deklariert man mit <code>Teil : "UDT_Teil";</code>, Zugriff mit Punkt: <code>#Teil.Gewicht</code>. Eine einmalige Struktur ohne eigenen Typ schreibt man direkt: <code>Teil : Struct … END_STRUCT;</code></p>
<h3>Arrays von Strukturen</h3>
<pre class="code">Charge : Array[1..8] of "UDT_Teil";
FOR #i := 1 TO 8 DO
   #Summe := #Summe + #Charge[#i].Gewicht;
END_FOR;</pre>
<p>Strukturen gleichen Typs können als Ganzes zugewiesen und als IN_OUT übergeben werden — ein Parameter statt vieler.</p>` },

{ id:'db', title:'Profi: Datenbausteine', html:`
<pre class="code">DATA_BLOCK "DB_Zelle"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
NON_RETAIN
   VAR
      Anzahl : Int;
      Charge : Array[1..8] of "UDT_Teil";
   END_VAR
BEGIN
END_DATA_BLOCK</pre>
<p><b>Globale DBs</b> sind der gemeinsame Datenspeicher. Zugriff von überall: <code>"DB_Zelle".Charge[3].Gewicht</code>. <b>Instanz-DBs</b> gehören zu einem FB und werden über den Aufruf beschrieben. Ein DB kann auch direkt einen UDT als Typ haben: <code>DATA_BLOCK "DB_Charge" "UDT_Charge"</code>.</p>
<p><b>Faustregel:</b> Gemeinsame Anlagendaten (Rezepte, Chargen, HMI-Schnittstelle, aufbereitete Eingänge) in globale DBs — Gerätelogik in FBs, die nur über ihre Schnittstelle mit den Daten sprechen.</p>` },

{ id:'string', title:'Profi: Texte (STRING)', html:`
<p><code>Text : String[24];</code> fasst bis zu 24 Zeichen. Literale stehen in einfachen Hochkommas: <code>'Bereit'</code>. Sonderzeichen: <code>$'</code> für ein Hochkomma, <code>$$</code> für $, <code>$N</code> für Zeilenumbruch.</p>
<table><tr><th>Funktion</th><th>Bedeutung</th><th>Beispiel</th></tr>
<tr><td>LEN(IN)</td><td>Länge</td><td>LEN('A-0042') = 6</td></tr>
<tr><td>CONCAT(IN1, IN2, …)</td><td>verbinden</td><td>'Teil ' + '17'</td></tr>
<tr><td>LEFT(IN, L) / RIGHT(IN, L)</td><td>vom Rand</td><td>LEFT('A-0042', 1) = 'A'</td></tr>
<tr><td>MID(IN, L, P)</td><td>L Zeichen ab Position P</td><td>MID('A-0042-B', 4, 3) = '0042'</td></tr>
<tr><td>FIND(IN1, IN2)</td><td>Position von IN2 (0 = nicht gefunden)</td><td>FIND('A-0042', '-') = 2</td></tr>
<tr><td>DELETE / INSERT / REPLACE</td><td>löschen / einfügen / ersetzen</td><td></td></tr></table>
<p>Positionen zählen ab <b>1</b>. Zahlen wandelt man mit <code>INT_TO_STRING</code>, <code>DINT_TO_STRING</code> um, zurück mit <code>STRING_TO_INT</code>. Ist ein Text länger als der String, wird er <b>ohne Fehlermeldung abgeschnitten</b>.</p>
<p><i>Hinweis zu TIA Portal:</i> Je nach Umwandlungsfunktion (z.B. S_CONV, VAL_STRG) kann TIA ein Vorzeichen- oder Leerzeichen voranstellen. SCL Quest bildet die Umwandlung vereinfacht ab — prüfe Texte vor dem Einsatz in PLCSIM.</p>` },

{ id:'programmstruktur', title:'Profi: Programmstruktur (OB1, OB100)', html:`
<h3>Wer ruft wen?</h3>
<pre class="code">OB100 "Startup"   → einmal beim Anlauf: Grundstellung, Initialisierung
OB1   "Main"      → jeden Zyklus:
   ├─ Eingänge aufbereiten  → "DB_E"
   ├─ "FB_Zelle_DB"(…)      → Anlagen-FB
   │     ├─ #Band  : "FB_Motor_Std"
   │     ├─ #Pick  : "FB_Pick"
   │     └─ "FC_Teiletext"(…)
   └─ Ausgänge schreiben</pre>
<p><b>Reihenfolge zählt:</b> Ein Wert, der erst nach seiner Verwendung berechnet wird, wirkt einen Zyklus zu spät. Erst Eingänge, dann Logik, dann Ausgänge.</p>
<h3>Eingänge entkoppeln</h3>
<p>Rohsignale (%I) an <b>einer</b> Stelle einlesen und aufbereiten — Öffner invertieren (<code>NOT "I_Stopp_NC"</code>), entprellen, umbenennen. Der Rest des Programms arbeitet mit einheitlichen Signalen: TRUE = aktiv.</p>
<h3>Schrittketten als FB</h3>
<p>Eine Schrittkette ist ein Gerät: Schrittnummer, Ziel und Timer liegen in der Instanz; Timer werden vor dem CASE mit <code>IN := #Schritt = n</code> aufgerufen, Ausgänge nach dem CASE aus dem Schritt abgeleitet.</p>` },

{ id:'standard', title:'Profi: Programmierstandard', html:`
<h3>Namensregeln</h3>
<p>Präfixe zeigen die Art: <code>FB_</code>, <code>FC_</code>, <code>DB_</code>, <code>UDT_</code>; Instanzen nach dem Gerät (<code>"Motor_Band1"</code>); Konstanten in GROSSBUCHSTABEN (<code>MAX_TEILE</code>). Keine Umlaute in Namen.</p>
<h3>Kapselung</h3>
<p>Ein Baustein spricht nur über seine Schnittstelle. Keine globalen Variablen in FBs und FCs — sonst arbeiten alle Instanzen mit denselben Daten (Warnung „Baustein greift direkt auf globale Daten zu“).</p>
<h3>Kommentare</h3>
<p>Kommentarkopf über jedem Baustein (Zweck, Verhalten), Kommentar an jeder Schnittstellenvariable, kurze Kommentare an nicht offensichtlichen Stellen. <code>REGION … END_REGION</code> gliedert lange Bausteine.</p>
<h3>Warnungsfrei</h3>
<p>In die Bibliothek kommt nur, was <b>ohne Warnung</b> übersetzt. Jede Warnung ist ein Hinweis auf einen möglichen Fehler: ungenutzte Variablen, TEMP vor dem Schreiben gelesen, Ausgang nicht in jedem Zweig, bedingter Instanzaufruf, Instanz mehrfach verwendet, abgeschnittene Texte.</p>
<h3>Versionierung</h3>
<p>Jeder Baustein trägt eine <code>VERSION</code>. Änderungen an Standardbausteinen werden dokumentiert und getestet, bevor sie in Projekte übernommen werden.</p>` },
{ id:'fehlersuche', title:'Fehlersuche im Betrieb', html:`
<h3>Störungen im Betrieb finden</h3>
<p>Im Betrieb meldet die Anlage eine Störung: Du musst die Ursache finden und beheben. Jede Minute Stillstand kostet Geld – ein systematisches Vorgehen spart Zeit. Das Vorgehen unten übst du in der Störungsjagd und in den Fehlersuche-Aufgaben.</p>
<h3>Vorgehen bei einer Störung</h3>
<p><b>1. Meldung lesen</b> – Nummer, Priorität (1 = Sicherheit/ganze Anlage, 2 = Teilanlage, 3 = Qualität) und Text.<br>
<b>2. Beobachten</b> – die Anlage mit der Störung laufen lassen und die Werte vergleichen: Was müsste passieren, was passiert?<br>
<b>3. Eingrenzen</b> – Programm, Hardware oder Bedienung?<br>
<b>4. Diagnose stellen</b> – Ist es das Programm, die Hardware oder die Bedienung? Begründe, woran du das erkennst.<br>
<b>5. Beheben und wieder anfahren</b> – Programmfehler im Editor korrigieren; die Anlage läuft nur an, wenn die Tests bestehen.</p>
<h3>Programm, Hardware oder Bedienung?</h3>
<p>Im Testbericht und in der Beobachtung siehst du jeden Wert pro Zyklus. Vergleiche <b>Eingang</b> (Sensor meldet?) und <b>Ausgang</b> (Programm schaltet?): Stimmt der Eingang nicht mit dem Geschehen in der Zelle überein, liegt es meist an der Hardware.</p>
<p>Beispiel: Die Lichtschranke <code>Teil_Erkannt</code> meldet dauernd TRUE, obwohl kein Teil da ist → <b>Sensor defekt/verschmutzt</b>, Bauteil <code>Teil_Erkannt</code>.</p>
<p>Ist alles verdrahtet und das Programm richtig, aber ein Sollwert oder die Betriebsart am HMI falsch eingestellt, ist es ein <b>Bedienfehler</b>.</p>
<h3>Ursachen</h3>
<p><b>Programm:</b> Logik/Verknüpfung · Vergleich/Grenzwert · Zeit/Timer · Flanke/Zählen · Adressierung/Index/Datenbaustein · Reihenfolge/Zyklus<br>
<b>Hardware:</b> Sensor defekt/verschmutzt · Drahtbruch · Aktor defekt (Rückmeldung bleibt aus) · Not-Halt/Sicherheitskreis<br>
<b>Bedienung:</b> falsche Betriebsart/Parameter am HMI</p>` }
];
M.forEach((s, i) => { s.page = i + 1; });
root.MANUAL_CONTENT = M;
root.MANUAL_IDS = M.map(s => s.id);
})(typeof window !== 'undefined' ? window : globalThis);
