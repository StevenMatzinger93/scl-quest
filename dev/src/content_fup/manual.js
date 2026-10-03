/* ===== FUP QUEST: Handbuch ===== */
(function(root){
const M = [
{ id:'einfuehrung', title:'Einführung & Bedienung', html:`
<h3>Willkommen im Stellwerk Brünigkreuz</h3>
<p>ARIA hat sich ins Stellwerk geflüchtet und stellt Weichen unter fahrenden Zügen um. Du programmierst das Stellwerk neu — im <b>Funktionsplan (FUP)</b>, wie er in Siemens-Steuerungen verwendet wird.</p>
<h3>So bedienst du den Baustein-Editor</h3>
<p><b>1. Boxen ziehen</b> — Die Leiste oben hat die Favoriten <code>&amp;</code>, <code>&gt;=1</code>, <code>??</code> (leere Box: Typ eintippen), <code>-|</code> (Eingang hinzufügen), <code>-o|</code> (negieren), <code>↦</code> (Abzweig) und <code>-[=]</code> (Zuweisung). Alles Weitere steht unter <b>☰ Anweisungen</b>: S, R, SR, RS, P, N, X, Zeiten, Zähler, Vergleicher, MOVE, Mathematik. Eine Box auf einen Eingang ziehen: Sie wird davor eingefügt. Auf den Ausgang einer Box: Sie wird dahinter angehängt.<br>
<b>2. Operanden</b> — Rote <code>&lt;??.?&gt;</code> anklicken (oder einfach lostippen) und Name oder Adresse eingeben — oder eine Variable aus den PLC-Variablen darauf ziehen.<br>
<b>3. Ohne Maus</b> — Knopf in der Leiste antippen, dann das Ziel antippen. Rechtsklick bzw. lange drücken öffnet das Kontextmenü: <i>Boxtyp ändern …</i>, Eingang hinzufügen/entfernen, Operand eingeben, Box löschen. Mehr Eingänge auch über den <code>*</code> unten an einer &amp;- oder &gt;=1-Box.<br>
<b>4. Testen</b> — <kbd>Strg</kbd>+<kbd>Enter</kbd> oder der grosse Knopf. Beim Abspielen zeigt jede Leitung ihren Signalzustand: <span style="color:#39ff14">grün = 1</span>, grau = 0.<br>
<b>5. Netzwerke</b> — Im Netzwerk-Kopf: Titel, <code>↑</code>/<code>↓</code> (Reihenfolge = Ausführung), <code>⧉</code> kopieren, <code>🗑</code> löschen. <b>＋ Netzwerk</b> fügt eines an.<br>
<b>6. Textansicht</b> — Knopf „Text“ in der Editorleiste; zeigt dasselbe Programm als Text.</p>
<p>Rot markierte <code>&lt;??.?&gt;</code> sind offene Operanden: Hier fehlt noch eine Variable. Zuweisung, S/R, MOVE und Aufrufe, an deren linkem Eingang nichts hängt, arbeiten <b>ohne Bedingung</b>.</p>` },
{ id:'anlage', title:'Das Stellwerk', html:`
<h3>Was du siehst</h3>
<p><b>Gleis 1</b> (Hauptgleis) und <b>Gleis 2</b> (Überholgleis) zwischen <b>Weiche 1</b> und <b>Weiche 2</b>. Die Weichenzunge zeigt die Lage (gerade/abzweigend), eine laufende Weiche blinkt.<br>
<b>Signal A</b> (Einfahrt) und <b>Signal B</b> (Ausfahrt): Rot = Halt, Grün = Fahrt, Grün + Gelb = Fahrt mit Warnung.<br>
<b>Bahnübergang</b> mit Schranken, Wechselblinker und Glocke · <b>Einschaltkontakt</b> vor der Einfahrt · <b>Gleisbelegung</b> (rot = besetzt, grün = frei).<br>
<b>Stelltisch</b> unten: Meldelampen, Wecker, Anzeige, Achszähler, Geschwindigkeit, eingestellte Fahrstrasse.</p>
<p>Unter der Bühne zeigt der Monitor, welche Kanäle die aktuelle Aufgabe steuert.</p>` },
{ id:'grundlagen', title:'Boxen und Zuweisung', html:`
<h3>Zuweisung</h3>
<pre class="kop">NETWORK Signal A
Taste_A => Signal_A;</pre>
<p>Rechts steht die <b>Zuweisung</b> <code>=</code>: Der Ausgang bekommt in jedem Zyklus den Wert, der von links ankommt.</p>
<h3>UND-Box</h3>
<pre class="kop">NETWORK Signal A
Taste_A AND Gleis1_frei => Signal_A;</pre>
<p>Die <b>&amp;-Box</b> liefert 1, wenn <b>alle</b> Eingänge 1 sind. Eingänge hinzufügen: <code>-|</code> auf die Box ziehen oder den <code>*</code> unten an der Box anklicken.</p>
<h3>Netzwerke</h3>
<p>Ein Programm besteht aus Netzwerken, jedes mit Titel. Die SPS wertet sie von oben nach unten aus, in jedem Zyklus aufs Neue.</p>` },
{ id:'oder', title:'ODER, XOR, Negation', html:`
<h3>ODER-Box</h3>
<pre class="kop">NETWORK Halt
Stoerung OR Not_Aus => Melder_Rot;</pre>
<p>Die <b>&gt;=1-Box</b> liefert 1, wenn <b>mindestens ein</b> Eingang 1 ist.</p>
<h3>Negierter Eingang</h3>
<pre class="kop">NETWORK Gleis frei
NOT Gleis1_besetzt => Gleis1_frei;</pre>
<p>Der <b>Kreis</b> am Eingang kehrt das Signal um: 0 → 1, 1 → 0. Im Editor: <code>-o|</code> auf den Eingang ziehen (oder Rechtsklick → <i>Negieren</i>).</p>
<h3>XOR-Box</h3>
<pre class="kop">NETWORK Lagefehler
W1_links XOR W1_rechts => W1_Lage_OK;</pre>
<p>Die <b>X-Box</b> liefert 1, wenn genau einer von zwei Eingängen 1 ist. Ideal, um widersprüchliche Rückmeldungen zu erkennen.</p>
<h3>Mischformen</h3>
<pre class="kop">NETWORK Signal
(Taste_A OR Automatik) AND Gleis1_frei => Signal_A;</pre>` },
{ id:'selbsthaltung', title:'Selbsthaltung und Verriegelung', html:`
<h3>Selbsthaltung</h3>
<pre class="kop">NETWORK Weiche nach links
(Taste_Links OR W1_nach_links) AND NOT W1_Endlage_links => W1_nach_links;</pre>
<p>Der Ausgang wird in die ODER-Box zurückgeführt und hält sich selbst, bis die Abschaltbedingung (hier: Endlage erreicht) kommt. Liegt die Abschaltung hinter der ODER-Box, gewinnt sie (Aus-Vorrang).</p>
<h3>Verriegelung</h3>
<pre class="kop">NETWORK Weiche nach rechts
(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;</pre>
<p>Ein negierter Eingang der Gegenrichtung verhindert, dass beide Richtungen gleichzeitig laufen.</p>` },
{ id:'speicher', title:'Speicherboxen S, R, SR, RS', html:`
<h3>S und R</h3>
<pre class="kop">NETWORK Stoerung speichern
Weichen_Fehler => S Stoerung;

NETWORK Quittieren
Quittieren AND NOT Weichen_Fehler => R Stoerung;</pre>
<p><b>S</b> setzt den Ausgang auf 1, wenn am Eingang 1 ankommt — sonst bleibt er, wie er ist. <b>R</b> setzt auf 0. Das untere Netzwerk gewinnt.</p>
<h3>Flipflops</h3>
<pre class="kop">NETWORK Fahrstrasse
Taste_FS => SR(FS_eingestellt, Aufloesung);</pre>
<table><tr><th>Box</th><th>S und R gleichzeitig 1</th></tr><tr><td>SR</td><td>Rücksetzen gewinnt → 0</td></tr><tr><td>RS</td><td>Setzen gewinnt → 1</td></tr></table>
<p>Bei SR kommt das Signal von links an <b>S</b>, der Eingang <b>R1</b> setzt zurück (bei RS umgekehrt: <b>S1</b> und <b>R</b>). Den Typ wechselst du per Rechtsklick → <i>Boxtyp ändern …</i></p>` },
{ id:'flanken', title:'Flanken', html:`
<h3>P- und N-Box</h3>
<pre class="kop">NETWORK Achsen zaehlen
P(Achse) => INC(Achsen);</pre>
<p>Die <b>P-Box</b> liefert genau einen Zyklus lang 1, wenn ihr Operand von 0 auf 1 wechselt, die <b>N-Box</b> beim Wechsel von 1 auf 0.</p>
<h3>Stromstoss</h3>
<pre class="kop">NETWORK Flanke
P(Taste_W1) => Impuls;

NETWORK Umschalten
Impuls XOR W1_rechts => W1_rechts;</pre>
<p>Jeder Tastendruck kippt die Weichenlage — mit einer XOR-Box besonders kurz.</p>` },
{ id:'timer', title:'Zeiten: TON, TOF, TP', html:`
<h3>Zeitboxen</h3>
<pre class="kop">NETWORK Schranke schliessen
Zug_meldet AND TON(T_Vorlauf, T#5S) => Schranke_zu;</pre>
<p>Jede Zeitbox braucht eine eigene <b>Instanz</b> (hier <code>T_Vorlauf</code>) und eine Zeit <code>PT</code>. Der Eingang IN ist das Signal, das links ankommt. Im Editor steht die Instanz über der Box, PT ist ein Eingang der Box.</p>
<table><tr><th>Box</th><th>Wirkung</th></tr>
<tr><td>TON</td><td>Einschaltverzögerung: Ausgang erst, wenn IN PT lang ansteht</td></tr>
<tr><td>TOF</td><td>Ausschaltverzögerung: Ausgang bleibt nach Wegfall von IN noch PT lang an</td></tr>
<tr><td>TP</td><td>Impuls: Ausgang genau PT lang, ausgelöst durch eine steigende Flanke an IN</td></tr></table>` },
{ id:'timer2', title:'Takt und Überwachung', html:`
<h3>Taktgeber</h3>
<pre class="kop">NETWORK Takt
NOT Impuls AND TON(T_Takt, T#500MS) => Impuls;</pre>
<p>Der Timer startet sich über den negierten eigenen Ausgang immer wieder neu. Mit einem Umschalter (XOR) wird daraus ein Blinklicht.</p>
<h3>Laufzeitüberwachung</h3>
<pre class="kop">NETWORK Weiche ueberwachen
W1_laeuft AND TON(T_W1, T#6S) => S Weichenstoerung;</pre>
<p>Erreicht die Weiche ihre Endlage nicht in der erwarteten Zeit, wird eine Störung gespeichert.</p>` },
{ id:'zaehler', title:'Zähler: CTU, CTD', html:`
<h3>Vorwärtszähler CTU</h3>
<pre class="kop">NETWORK Achsen ein
Achse_ein AND CTU(Z_Ein, PV:=4, R:=Reset) => Zug_komplett;</pre>
<p>Der CTU zählt jede steigende Flanke an CU. <code>R</code> setzt auf 0, <code>Q</code> = 1, sobald <code>CV ≥ PV</code>. Zählwert: <code>Z_Ein.CV</code>. Im Editor sind R, LD und PV Eingänge der Box, die Instanz steht darüber.</p>
<h3>Rückwärtszähler CTD</h3>
<pre class="kop">NETWORK Wartung
Umstellung AND CTD(Z_Wartung, PV:=100, LD:=Wartung_OK) => Wartung_faellig;</pre>
<p><code>LD</code> lädt PV, jede Flanke zählt herunter, <code>Q</code> = 1 bei <code>CV ≤ 0</code>.</p>
<h3>Achszähler</h3>
<p>Ein Gleisabschnitt ist frei, wenn die Zahl der eingefahrenen gleich der Zahl der ausgefahrenen Achsen ist: Vergleich der beiden Zählwerte.</p>` },
{ id:'vergleich', title:'Vergleicher', html:`
<h3>CMP-Box</h3>
<pre class="kop">NETWORK Zu schnell
[Tempo > 40] => Warnung;</pre>
<p>Die Vergleichsbox liefert 1, wenn der Vergleich stimmt: <code>==</code>, <code>&lt;&gt;</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>.</p>
<h3>Bereich</h3>
<pre class="kop">NETWORK Warnbereich
[Tempo > 40] AND [Tempo <= 60] => Gelb;</pre>` },
{ id:'werte', title:'MOVE und Rechnen', html:`
<h3>MOVE</h3>
<pre class="kop">NETWORK Signalbegriff
Fahrt_Warnung => MOVE(2, Begriff_A);</pre>
<p>MOVE schreibt IN nach OUT, wenn der Eingang EN 1 ist. Sonst bleibt OUT unverändert.</p>
<h3>Rechenboxen</h3>
<pre class="kop">NETWORK Zuglaenge
=> MUL(Achsen, 5, Laenge_m);</pre>
<p>ADD, SUB, MUL, DIV rechnen <code>OUT := IN1 op IN2</code>. INC/DEC zählen um 1. Ohne Bedingung (Eingang EN offen lassen) rechnet die Box in jedem Zyklus.</p>` },
{ id:'fahrstrasse', title:'Fahrstrassen', html:`
<h3>Ablauf einer Fahrstrasse</h3>
<ol><li><b>Einstellen</b> — Weichen in die richtige Lage bringen.</li>
<li><b>Sichern</b> — Weichen verschliessen, Flankenschutz, Schranke zu, Gleis frei.</li>
<li><b>Signal Fahrt</b> — erst jetzt darf das Signal Fahrt zeigen.</li>
<li><b>Auflösen</b> — nach der Zugfahrt (Gleis wieder frei) wird die Fahrstrasse aufgelöst, das Signal zeigt Halt.</li></ol>
<pre class="kop">NETWORK Einstellen
Taste_FS AND NOT FS_gesichert => SR(FS_eingestellt, Aufloesung);

NETWORK Sichern
FS_eingestellt AND W1_Endlage AND Schranke_unten AND Gleis1_frei => SR(FS_gesichert, Aufloesung);

NETWORK Signal
FS_gesichert => Signal_A;</pre>
<p>Jeder Schritt ist ein Speicher, der erst gesetzt wird, wenn der vorherige fertig ist — eine Schrittkette im Funktionsplan.</p>` },
{ id:'bausteine', title:'Profi: Bausteine und Schnittstelle', html:`
<h3>Aufbau eines Bausteins</h3>
<pre class="kop">FUNCTION "FC_Freigabe" : Void
VAR_INPUT
   Gleis_frei : Bool;
   Weiche_Endlage : Bool;
END_VAR
VAR_OUTPUT
   Freigabe : Bool;
END_VAR
BEGIN
NETWORK Freigabe
#Gleis_frei AND #Weiche_Endlage => #Freigabe;
END_FUNCTION</pre>
<p>Oben die <b>Schnittstelle</b> (in der Tabelle bearbeitbar: Knopf <i>Tabelle</i>), darunter die <b>Netzwerke</b>. Lokale Variablen heissen <code>#Name</code>, globale PLC-Variablen <code>"Name"</code>.</p>
<table><tr><th>Bereich</th><th>Bedeutung</th><th>FC</th><th>FB</th></tr>
<tr><td>Input</td><td>wird gelesen</td><td>✓</td><td>✓</td></tr><tr><td>Output</td><td>wird geschrieben</td><td>✓</td><td>✓</td></tr>
<tr><td>InOut</td><td>Variable des Aufrufers, lesen und schreiben</td><td>✓</td><td>✓</td></tr><tr><td>Temp</td><td>nur während des Aufrufs</td><td>✓</td><td>✓</td></tr>
<tr><td>Static</td><td>Gedächtnis in der Instanz</td><td>–</td><td>✓</td></tr></table>
<h3>Aufruf-Box</h3>
<pre class="kop">ORGANIZATION_BLOCK "Main"
BEGIN
NETWORK Freigabe
=> "FC_Freigabe"(Gleis_frei := "Gleis1_frei", Weiche_Endlage := "W1_Endlage", Freigabe => "Freigabe");
END_ORGANIZATION_BLOCK</pre>
<p>Im Editor: <b>CALL</b> aus <b>☰ Anweisungen</b> → Bausteine ins Netzwerk ziehen → den Baustein-Operanden über der Box anklicken und den Baustein wählen → Parameter belegen. Links die Eingänge (<code>:=</code>), rechts die Ausgänge (<code>=></code>). Bleibt EN offen, läuft der Aufruf ohne Bedingung. Variablen lassen sich aus den PLC-Variablen auf die Anschlüsse ziehen.</p>` },
{ id:'fc', title:'Profi: Funktion (FC)', html:`
<h3>Eigenschaften</h3>
<ul><li>Kein Gedächtnis: Jeder Aufruf rechnet aus den Eingängen neu.</li><li>Kein Instanz-DB nötig, beliebig oft aufrufbar.</li>
<li>Jeder Ausgang muss in jedem Aufruf geschrieben werden — <b>keine S/R-Boxen</b> auf Ausgänge (Warnung <i>OUT_NOT_ALL_PATHS</i>).</li>
<li>Flanken, Timer und Zähler brauchen ein Gedächtnis → im FB.</li></ul>
<h3>Rückgabewert</h3>
<pre class="kop">FUNCTION "FC_Achsen" : Int
VAR_INPUT
   Wagen : Int;
END_VAR
BEGIN
NETWORK Umrechnung
=> MUL(#Wagen, 4, #Ret_Val);
END_FUNCTION</pre>
<p>Der Rückgabewert heisst <code>#Ret_Val</code> und erscheint an der Aufruf-Box als Ausgang <code>Ret_Val =></code>.</p>
<h3>Temp</h3>
<p>Temp-Variablen für Zwischenergebnisse: <b>zuerst schreiben, dann lesen</b> (sonst Warnung <i>TEMP_READ_BEFORE_WRITE</i>).</p>` },
{ id:'fb', title:'Profi: Funktionsbaustein (FB)', html:`
<h3>Gedächtnis in der Instanz</h3>
<pre class="kop">FUNCTION_BLOCK "FB_Signal"
VAR_INPUT
   Fahrt_Anf : Bool;
   Halt_Anf : Bool;
END_VAR
VAR_OUTPUT
   Fahrt : Bool;
END_VAR
BEGIN
NETWORK Selbsthaltung
(#Fahrt_Anf OR #Fahrt) AND NOT #Halt_Anf => #Fahrt;
END_FUNCTION_BLOCK</pre>
<p>Ausgänge und Static-Variablen bleiben in der <b>Instanz</b> erhalten. Aufruf mit Instanz-DB: <code>"FB_Signal_DB"(…)</code>. Pro Gerät eine eigene Instanz — dieselbe Instanz zweimal aufrufen ergibt die Warnung <i>INSTANCE_TWICE</i>.</p>
<p>Flankenboxen (P/N) sind nur im FB möglich: Sie merken sich den alten Signalzustand in der Instanz. Dasselbe gilt für SR/RS.</p>` },
{ id:'multiinstanz', title:'Profi: Multiinstanzen', html:`
<h3>Timer und Zähler im FB</h3>
<pre class="kop">FUNCTION_BLOCK "FB_Schranke"
VAR_INPUT
   Anforderung : Bool;
END_VAR
VAR_OUTPUT
   Schranke_zu : Bool;
END_VAR
VAR
   T_Vorlauf : TON;
END_VAR
BEGIN
NETWORK Schranke
#Anforderung AND TON(#T_Vorlauf, T#3S) => #Schranke_zu;
END_FUNCTION_BLOCK</pre>
<p>Timer (TON/TOF/TP) und Zähler (CTU/CTD) werden als <b>Static</b> deklariert. Jede Zeit braucht ihre eigene Instanz. Zählwert: <code>#Z_Achsen.CV</code>.</p>
<h3>Eigene FBs einbetten</h3>
<p>Static <code>BUE : "FB_BUE"</code>, Aufruf <code>#BUE(Anforderung := …)</code>, Ausgang lesen: <code>#BUE.Schranke_zu</code>. Alle Daten liegen im Instanz-DB des äusseren FB.</p>` },
{ id:'daten', title:'Profi: Globale Datenbausteine', html:`
<h3>Zugriff</h3>
<pre class="kop">NETWORK Tagesmaximum
["Achsen" > "DB_Stellwerk".Achsen_Max] => MOVE("Achsen", "DB_Stellwerk".Achsen_Max);</pre>
<p><code>"DB_Name".Variable</code> — lesbar und schreibbar in jedem Baustein. Werte bleiben erhalten. Startwerte stehen in der Deklaration (<code>Laufzeit_Max : Time := T#6S</code>).</p>
<h3>Parameter-DB</h3>
<p>Einstellwerte gehören in einen DB und werden über die Schnittstelle übergeben: <code>Laufzeit := "DB_Parameter".Weiche_Laufzeit</code>.</p>
<h3>Instanz-DB lesen</h3>
<p>Ausgänge eines FB stehen in seiner Instanz: <code>"FB_BUE_DB".Schranke_zu</code>.</p>` },
{ id:'udt', title:'Profi: PLC-Datentypen und Arrays', html:`
<h3>PLC-Datentyp (UDT)</h3>
<pre class="code">TYPE "UDT_Weiche"
STRUCT
   Nummer : Int;
   Rechts : Bool;
   Umstellungen : Int;
END_STRUCT;
END_TYPE</pre>
<p>Verwendung im DB: <code>W1 : "UDT_Weiche"</code>, Zugriff <code>"DB_Weichen".W1.Umstellungen</code>. Als Parameter: <code>Weiche : "UDT_Weiche"</code>, im Baustein <code>#Weiche.Rechts</code>.</p>
<h3>Array</h3>
<pre class="kop">NETWORK Ein Gleis besetzt
"DB_Gleise".Besetzt[1] OR "DB_Gleise".Besetzt[2] => "Melder_Gelb";</pre>
<p><code>Besetzt : Array[1..4] of Bool</code> — die Grenzen gehören zum Typ. Auch Strukturen lassen sich reihen: <code>Weiche : Array[1..2] of "UDT_Weiche"</code>, Zugriff <code>"DB_Weichen".Weiche[2].Umstellungen</code>.</p>
<h3>Ganze Strukturen kopieren</h3>
<p><code>MOVE("DB_Weichen".Soll, "DB_Weichen".Ist)</code> kopiert alle Elemente — bei gleichem Typ.</p>` },
{ id:'standard', title:'Profi: Standardbausteine', html:`
<h3>Regeln</h3>
<ul><li>Alles über die Schnittstelle, <b>keine globalen Zugriffe</b> (Warnung <i>GLOBAL_ACCESS</i>).</li>
<li>Ein Gerät = ein Baustein: Befehl, Freigabe, Rückmeldung, Überwachung, Störung.</li>
<li>FC für reine Verknüpfungen, FB für alles mit Gedächtnis.</li>
<li>InOut für gemeinsam genutzte Variablen (z. B. Summenzähler).</li></ul>
<h3>Meldeprinzip</h3>
<table><tr><th>Zustand</th><th>Lampe</th></tr><tr><td>neu, nicht quittiert</td><td>blinkt</td></tr><tr><td>quittiert, steht noch an</td><td>Dauerlicht</td></tr><tr><td>gegangen, quittiert</td><td>aus</td></tr></table>
<h3>Verschalten</h3>
<p>Im OB1 oder im Anlagen-FB: Ausgänge eines Bausteins werden Eingänge des nächsten (<code>FS_gesichert := "FB_BUE_DB".Schranke_zu</code>). Die Aufrufreihenfolge folgt dem Signalfluss.</p>` },
{ id:'programmstruktur', title:'Profi: Programmstruktur (OB1, OB100)', html:`
<h3>Organisationsbausteine</h3>
<pre class="kop">ORGANIZATION_BLOCK "Startup"
BEGIN
NETWORK Zuege ruecksetzen
=> MOVE(0, "DB_Stellwerk".Zuege);
END_ORGANIZATION_BLOCK</pre>
<p><b>OB100</b> („Startup“): einmal beim Anlauf — sichere Grundstellung, Initialisierung. <b>OB1</b> („Main“): jeden Zyklus — nur Aufrufe, in der Reihenfolge Sicherung → Fahrstrasse → Signale → Anzeige.</p>
<h3>Programmierstandard</h3>
<ul><li>Warnungsfrei übersetzen.</li><li>Präfixe <code>FB_</code>, <code>FC_</code>, <code>DB_</code>, <code>UDT_</code>; Netzwerktitel; Kommentare an der Schnittstelle.</li>
<li>Konstanten an Parametern hinterfragen.</li><li>Rangfolge über die Reihenfolge der Netzwerke: das letzte mit EN = 1 gewinnt.</li></ul>` },
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
<p>Die Signalzustände an den Boxen zeigen, welcher Eingang welches Ergebnis liefert. Liegt an einer Box ein Signal an, das nicht zur Gleisbelegung passt, ist der Melder gestört. Stimmen alle Eingänge und die Box liefert trotzdem das Falsche, ist die Logik (Box, Negation, Reihenfolge) falsch.</p>
<p>Beispiel: Die Gleisfreimeldung meldet „besetzt“, obwohl kein Zug im Abschnitt ist → <b>Sensor defekt</b>, Bauteil ist der Freimelde-Eingang.</p>
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
