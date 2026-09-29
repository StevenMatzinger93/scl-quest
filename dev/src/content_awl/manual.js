/* ===== AWL QUEST: Handbuch ===== */
(function(root){
// Statustabelle wie im TIA Portal: [[Anweisung, VKE, AKKU1, AKKU2], …]
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ST = rows => '<div class="awl-static"><div class="awl-static-h"><span></span><span>AWL</span><span>VKE</span><span>AKKU1</span><span>AKKU2</span></div>' + rows.map((r, i) =>
  '<div class="awl-row run"><span class="ln">' + (i + 1) + '</span><code>' + esc(r[0]) + '</code>' +
  (r[1] === '' || r[1] === undefined ? '<span class="awl-st-v none"></span>' : '<span class="awl-st-v' + (r[1] ? ' on' : '') + '">' + (r[1] ? 1 : 0) + '</span>') +
  (r[2] !== undefined && r[2] !== '' ? '<span class="awl-st-a">' + esc(r[2]) + '</span>' : '<span></span>') + (r[3] !== undefined && r[3] !== '' ? '<span class="awl-st-b">' + esc(r[3]) + '</span>' : '<span></span>') + '</div>').join('') + '</div>';
root.AWL_ST = ST;
const M = [
{ id:'einfuehrung', title:'Einführung & Bedienung', html:`
<h3>Willkommen im Walzwerk</h3>
<p>ARIA hat sich in die alte <b>S7-300</b> im Keller geflüchtet. Ihr Programm ist in <b>AWL</b> geschrieben — der Anweisungsliste. Du liest und schreibst es Zeile für Zeile.</p>
<h3>So bedienst du den Editor</h3>
<p><b>1. Schreiben</b> — Eine Anweisung pro Zeile: zuerst die Operation (<code>U</code>, <code>=</code>, <code>L</code> …), dann der Operand (<code>S_Rollgang</code>). Kommentare beginnen mit <code>//</code>. Variablen aus der Liste links antippen fügt sie ein.<br>
<b>2. Testen</b> — <kbd>Strg</kbd>+<kbd>Enter</kbd> oder der grosse Knopf. Die Tests laufen Zyklus für Zyklus.<br>
<b>3. Status</b> — Beim Abspielen erscheint rechts neben jeder Zeile der <b>Status</b>, wie beim Beobachten im TIA Portal: <span class="awl-st-v on">1</span> bzw. <span class="awl-st-v">0</span> ist das <b>VKE</b>, danach stehen <b>AKKU1</b> (A1) und <b>AKKU2</b> (A2). Übersprungene Zeilen bleiben leer.<br>
<b>4. Handy</b> — Die Symbolleiste unter dem Editor fügt häufige Anweisungen ein.</p>
<div class="awl-note"><b>Wichtig:</b> AWL läuft auf der S7-300/400 und (eingeschränkt) auf der S7-1500. Die <b>S7-1200 kann kein AWL</b>. Wer AWL lesen kann, wartet alte Anlagen und überträgt sie beim Umbau nach SCL, KOP oder FUP.</div>` },
{ id:'anlage', title:'Das Walzwerk', html:`
<h3>Was du siehst</h3>
<p><b>Stossofen</b> links (Heizung, Tür, Temperatur) · <b>Rollgang</b> mit dem glühenden <b>Walzblock</b> (vorwärts und rückwärts) · <b>Walzgerüst</b> mit zwei Walzen und dem <b>Walzspalt</b> · <b>Kühlwasser</b> · <b>Schere</b> · <b>Hydraulik</b> mit Pumpe und Druck.<br>
Oben rechts das <b>S7-300-Rack</b>: Stromversorgung, CPU mit den LEDs <b>SF</b> (Sammelfehler), <b>RUN</b> und <b>STOP</b>, dahinter die Ein-/Ausgabebaugruppen.<br>
Unten der <b>Leitstand</b>: Lampen rot/gelb/grün, Hupe, Anzeige, Stückzähler.</p>
<p>Unter der Bühne zeigt der Monitor, welche Teile die aktuelle Aufgabe steuert.</p>` },
{ id:'grundlagen', title:'U, = und das VKE', html:`
<h3>Zeile für Zeile</h3>
<pre class="code">U  S_Rollgang
U  Not_Aus_OK
=  Rollgang</pre>
<p><code>U</code> (UND) fragt einen Operanden ab. Die erste Abfrage einer Kette heisst <b>Erstabfrage</b>: Sie übernimmt den Wert direkt ins <b>VKE</b> (Verknüpfungsergebnis). Jede weitere <code>U</code>-Abfrage verknüpft mit dem VKE. <code>=</code> schreibt das VKE in den Operanden — und beendet die Kette.</p>
${ST([['U  S_Rollgang', 1], ['U  Not_Aus_OK', 0], ['=  Rollgang', 0]])}
<h3>Nach dem =</h3>
<p>Nach <code>=</code> beginnt mit der nächsten Abfrage eine <b>neue Kette</b> (wieder Erstabfrage). Das VKE bleibt aber erhalten: Zwei <code>=</code> hintereinander schreiben denselben Wert in zwei Operanden.</p>
<pre class="code">U  Kuehlung_OK
=  Kuehlung
=  Lampe_Gruen</pre>` },
{ id:'verknuepfung', title:'UN, O, ON, X', html:`
<table><tr><th>Anweisung</th><th>Bedeutung</th></tr>
<tr><td><code>U</code> / <code>UN</code></td><td>UND / UND NICHT (Operand negiert)</td></tr>
<tr><td><code>O</code> / <code>ON</code></td><td>ODER / ODER NICHT</td></tr>
<tr><td><code>X</code> / <code>XN</code></td><td>Exklusiv-ODER / Exklusiv-ODER NICHT</td></tr></table>
<pre class="code">O  S_Hupe_Pult
O  S_Hupe_Kran
=  Hupe</pre>
<h3>UND vor ODER</h3>
<p>In AWL bindet <b>UND stärker als ODER</b>: <code>U a / U b / O c / U d</code> bedeutet (a UND b) ODER (c UND d). Willst du zwei UND-Gruppen deutlich trennen, schreibst du <code>O</code> <b>ohne Operand</b> dazwischen:</p>
<pre class="code">U  Hand
U  S_Tippen
O
U  Automatik
U  Block_bereit
=  Rollgang</pre>` },
{ id:'klammern', title:'Klammern', html:`
<h3>ODER in einer UND-Kette</h3>
<pre class="code">U  S_Walzen
U(
O  Pumpe_1
O  Pumpe_2
)
=  Walzen</pre>
<p><code>U(</code> merkt sich das bisherige VKE und beginnt in der Klammer eine neue Kette. Die schliessende Klammer <code>)</code> verknüpft das Ergebnis der Klammer mit <code>U</code> (bzw. <code>O(</code>, <code>X(</code>, <code>UN(</code>, <code>ON(</code>, <code>XN(</code>).</p>
<p>Ohne Klammer würde <code>U S_Walzen / O Pumpe_1 / O Pumpe_2</code> bedeuten: S_Walzen <b>oder</b> eine Pumpe — das Gerüst liefe schon, wenn nur eine Pumpe an ist.</p>` },
{ id:'speichern', title:'S, R und Selbsthaltung', html:`
<h3>Setzen und Rücksetzen</h3>
<pre class="code">U  S_Ein
S  Pumpe
U  S_Aus
R  Pumpe</pre>
<p><code>S</code> schreibt eine 1, wenn das VKE 1 ist — sonst passiert nichts, der Wert bleibt. <code>R</code> schreibt eine 0. Sind beide Bedingungen erfüllt, <b>gewinnt die untere Anweisung</b>: Hier ist Rücksetzen dominant.</p>
<h3>Selbsthaltung</h3>
<pre class="code">U(
O  S_Ein
O  Walzen
)
UN S_Aus
=  Walzen</pre>
<p>Der Ausgang hält sich über seine eigene Abfrage. Ohne Klammer (<code>O S_Ein / O Walzen / UN S_Aus</code>) wäre <b>Ein</b> dominant.</p>
<h3>NOT, SET, CLR</h3>
<p><code>NOT</code> dreht das VKE um. <code>SET</code> setzt das VKE auf 1, <code>CLR</code> auf 0 — praktisch für Ausgänge, die immer an sein sollen.</p>` },
{ id:'flanken', title:'Flanken FP und FN', html:`
<pre class="code">U  Block_da
FP M_Block
=  Schnitt</pre>
<p><code>FP</code> macht das VKE nur in dem Zyklus zu 1, in dem es von 0 auf 1 wechselt (<b>positive Flanke</b>). <code>FN</code> reagiert auf 1 → 0. Beide brauchen einen eigenen <b>Flankenmerker</b> (hier <code>M_Block</code>), in dem sie den Zustand des letzten Zyklus speichern. Jede Flankenauswertung braucht ihren eigenen Merker.</p>
<h3>Stromstoss (Umschalten per Taster)</h3>
<pre class="code">U  S_Taster
FP M_Taster
X  Kuehlung
=  Kuehlung</pre>` },
{ id:'zeiten', title:'S5-Zeiten', html:`
<pre class="code">U  Pumpe
L  S5T#3S
SE T1
U  T1
=  Walzen_Frei</pre>
<p>Zeitwert laden (<code>L S5T#3S</code>), Zeit mit dem VKE starten, Zeitbit abfragen (<code>U T1</code>).</p>
<table><tr><th>Anweisung</th><th>Zeit</th><th>T1 ist 1 …</th></tr>
<tr><td><code>SE</code></td><td>Einschaltverzögerung</td><td>wenn das VKE die ganze Zeit 1 war (bis es 0 wird)</td></tr>
<tr><td><code>SA</code></td><td>Ausschaltverzögerung</td><td>solange das VKE 1 ist und danach noch die Zeit lang</td></tr>
<tr><td><code>SI</code></td><td>Impuls</td><td>ab Start für die Zeit — endet früher, wenn das VKE 0 wird</td></tr>
<tr><td><code>SV</code></td><td>verlängerter Impuls</td><td>ab Start für die volle Zeit, auch wenn das VKE 0 wird</td></tr></table>
<p>Jede Zeit (T1, T2 …) hat genau eine Art. Die Zeit wird nur weitergeführt, wenn ihre Start-Anweisung ausgeführt wird.</p>` },
{ id:'zaehler', title:'S5-Zähler', html:`
<pre class="code">U  Block_raus
ZV Z1
U  S_Reset
R  Z1
L  Z1
T  Stueck</pre>
<p><code>ZV</code> zählt bei jeder <b>steigenden Flanke</b> des VKE um 1 hoch (bis 999), <code>ZR</code> herunter (bis 0). <code>S Z1</code> setzt den Zähler auf den Wert in AKKU1 (<code>L 10</code> davor), <code>R Z1</code> auf 0. <code>L Z1</code> lädt den Zählwert, <code>U Z1</code> ist 1, solange der Zähler nicht 0 ist.</p>` },
{ id:'laden', title:'Laden und Transferieren', html:`
<pre class="code">L  Temp
T  Anzeige</pre>
${ST([['L  Temp', '', '1180', '0'], ['T  Anzeige', '', '1180', '0']])}
<p><code>L</code> lädt einen Wert in <b>AKKU1</b>; was vorher in AKKU1 stand, rutscht nach <b>AKKU2</b>. <code>T</code> schreibt AKKU1 in einen Operanden — AKKU1 bleibt dabei unverändert. <code>TAK</code> tauscht AKKU1 und AKKU2.</p>
<div class="awl-note"><b>Falle:</b> <code>L</code> und <code>T</code> hängen <b>nicht</b> vom VKE ab. <code>U S_Anzeige / L Temp / T Anzeige</code> transferiert immer. Bedingt transferieren geht nur mit einem Sprung (Kapitel 10).</div>` },
{ id:'rechnen', title:'Rechnen', html:`
<pre class="code">L  Dicke_ein
L  Dicke_aus
-I
T  Abnahme</pre>
${ST([['L  Dicke_ein', '', '120', '0'], ['L  Dicke_aus', '', '90', '120'], ['-I', '', '30', '120'], ['T  Abnahme', '', '30', '120']])}
<p>Gerechnet wird <b>AKKU2 op AKKU1</b>, das Ergebnis steht in AKKU1. Die Endung sagt den Typ: <code>…I</code> Ganzzahl (INT), <code>…R</code> Kommazahl (REAL). <code>/I</code> schneidet ab, <code>MOD</code> liefert den Rest.</p>
<h3>Umwandeln</h3>
<pre class="code">L  Temp_1
L  Temp_2
+I
ITD
DTR
L  2.0
/R
T  Mittelwert</pre>
<p><code>ITD</code> (INT → DINT) und <code>DTR</code> (DINT → REAL) machen aus einer Ganzzahl eine Kommazahl. Zurück geht es mit <code>RND</code> (runden) oder <code>TRUNC</code> (abschneiden). <code>INC 1</code>/<code>DEC 1</code> ändern AKKU1, <code>NEGI</code> dreht das Vorzeichen.</p>` },
{ id:'vergleichen', title:'Vergleichen', html:`
<pre class="code">L  Temp
L  1100
>=I
=  Temp_OK</pre>
<p>Ein Vergleich prüft <b>AKKU2 mit AKKU1</b> und bildet ein <b>neues VKE</b>: <code>==I</code>, <code>&lt;&gt;I</code>, <code>&gt;I</code>, <code>&lt;I</code>, <code>&gt;=I</code>, <code>&lt;=I</code> (für REAL: <code>…R</code>).</p>
<h3>Mit Bits verknüpfen</h3>
<pre class="code">U  S_Walzen
U(
L  Temp
L  1100
>=I
)
=  Walzen</pre>
<p>Der Vergleich überschreibt das VKE — ohne Klammer ginge <code>S_Walzen</code> verloren. In der Klammer beginnt eine eigene Kette, die schliessende Klammer verknüpft mit UND.</p>` },
{ id:'spruenge', title:'Sprünge', html:`
<pre class="code">U  S_Anzeige_Temp
SPBN SPLT
L  Temp
T  Anzeige
SPA ENDE
SPLT: L  Spalt
T  Anzeige
ENDE: NOP 0</pre>
<table><tr><th>Anweisung</th><th>springt …</th></tr>
<tr><td><code>SPA M</code></td><td>immer</td></tr><tr><td><code>SPB M</code></td><td>wenn das VKE 1 ist</td></tr><tr><td><code>SPBN M</code></td><td>wenn das VKE 0 ist</td></tr>
<tr><td><code>LOOP M</code></td><td>zählt AKKU1 um 1 herunter und springt, solange er nicht 0 ist</td></tr>
<tr><td><code>BEA</code> / <code>BEB</code></td><td>Baustein-Ende (immer / wenn VKE 1)</td></tr></table>
<p>Eine <b>Sprungmarke</b> steht mit Doppelpunkt vor einer Anweisung (<code>ENDE:</code>). Nach <code>SPB</code>/<code>SPBN</code> ist das VKE 1 und eine neue Kette beginnt. Übersprungene Zeilen zeigen im Status nichts an.</p>` },
{ id:'s7', title:'S7-300, S7-1500, S7-1200', html:`
<h3>Wo läuft AWL?</h3>
<table><tr><th>Steuerung</th><th>AWL</th></tr>
<tr><td>S7-300 / S7-400</td><td>ja — die klassische AWL-Welt</td></tr>
<tr><td>S7-1500</td><td>ja, mit Einschränkungen (TIA Portal)</td></tr>
<tr><td>S7-1200</td><td><b>nein</b> — nur KOP, FUP, SCL (und GRAPH)</td></tr></table>
<p>Viele Anlagen laufen noch jahrzehntelang mit S7-300 und AWL. Beim Umbau wird der Code übertragen: Aus <code>U a / U b / = q</code> wird in SCL <code>q := a AND b;</code>, im KOP eine Reihenschaltung, im FUP eine &amp;-Box.</p>
<p>In diesem Spiel stehen die Operanden symbolisch da (<code>S_Rollgang</code>). In echten Programmen findest du oft absolute Adressen: <code>E 0.0</code> (Eingang), <code>A 4.0</code> (Ausgang), <code>M 10.0</code> (Merker), <code>MW 20</code> (Merkerwort).</p>` },
{ id:'bausteine', title:'Profi: Bausteine und CALL', html:`
<h3>Aufbau eines Bausteins</h3>
<pre class="code">FUNCTION "FC_Freigabe" : Void
VAR_INPUT
   S_Walzen : Bool;
   Gitter_zu : Bool;
END_VAR
VAR_OUTPUT
   Frei : Bool;
END_VAR
BEGIN
U  #S_Walzen
U  #Gitter_zu
=  #Frei
END_FUNCTION</pre>
<p>Oben die <b>Schnittstelle</b> (in der Tabelle bearbeitbar: Knopf <i>Tabelle</i>), nach <code>BEGIN</code> die Anweisungsliste. Lokale Variablen heissen <code>#Name</code>, globale PLC-Variablen <code>"Name"</code>.</p>
<table><tr><th>Bereich</th><th>Bedeutung</th><th>FC</th><th>FB</th></tr>
<tr><td>Input</td><td>wird gelesen</td><td>✓</td><td>✓</td></tr><tr><td>Output</td><td>wird geschrieben</td><td>✓</td><td>✓</td></tr>
<tr><td>InOut</td><td>Variable des Aufrufers, lesen und schreiben</td><td>✓</td><td>✓</td></tr><tr><td>Temp</td><td>nur während des Aufrufs</td><td>✓</td><td>✓</td></tr>
<tr><td>Static</td><td>Gedächtnis in der Instanz</td><td>–</td><td>✓</td></tr></table>
<h3>Aufruf</h3>
<pre class="code">CALL "FC_Freigabe"
   S_Walzen := "S_Walzen_1"
   Gitter_zu := "Gitter_1"
   Frei => "Walzen_1"</pre>
<p>Unter <code>CALL</code> steht je Parameter eine Zeile: <code>:=</code> für Eingänge, <code>=&gt;</code> für Ausgänge. Ein FB bekommt zusätzlich seinen Instanz-DB: <code>CALL "FB_Antrieb", "FB_Antrieb_DB"</code>. <code>CALL</code> hängt nicht vom VKE ab und beendet die Kette.</p>` },
{ id:'fc', title:'Profi: Funktion (FC)', html:`
<h3>Eigenschaften</h3>
<ul><li>Kein Gedächtnis: Jeder Aufruf rechnet aus den Eingängen neu.</li><li>Kein Instanz-DB nötig, beliebig oft aufrufbar.</li>
<li>Jeder Ausgang muss in jedem Aufruf geschrieben werden — mit <code>=</code>, nicht mit <b>S/R</b> (Warnung <i>OUT_NOT_ALL_PATHS</i>).</li>
<li>Flankenmerker, IEC-Zeiten und -Zähler brauchen ein Gedächtnis → im FB.</li></ul>
<h3>Rückgabewert</h3>
<pre class="code">FUNCTION "FC_Abnahme" : Int
VAR_INPUT
   Dicke_ein : Int;
   Dicke_aus : Int;
END_VAR
BEGIN
L  #Dicke_ein
L  #Dicke_aus
-I
T  #Ret_Val
END_FUNCTION</pre>
<p>Im Baustein heisst der Rückgabewert <code>#Ret_Val</code>, beim Aufruf <code>RET_VAL := "Ziel"</code>.</p>
<h3>Temp</h3>
<p>Temp-Variablen für Zwischenergebnisse: <b>zuerst schreiben, dann lesen</b> (sonst Warnung <i>TEMP_READ_BEFORE_WRITE</i>).</p>` },
{ id:'fb', title:'Profi: Funktionsbaustein (FB)', html:`
<h3>Gedächtnis in der Instanz</h3>
<pre class="code">FUNCTION_BLOCK "FB_Antrieb"
VAR_INPUT
   Start : Bool;
   Stopp : Bool;
END_VAR
VAR_OUTPUT
   Laeuft : Bool;
END_VAR
BEGIN
U(
O  #Start
O  #Laeuft
)
UN #Stopp
=  #Laeuft
END_FUNCTION_BLOCK</pre>
<p>Ausgänge und Static-Variablen bleiben in der <b>Instanz</b> erhalten. Aufruf mit Instanz-DB:</p>
<pre class="code">CALL "FB_Antrieb", "FB_Antrieb_DB"
   Start := "S_Start"
   Stopp := "S_Stopp"
   Laeuft => "Rollgang"</pre>
<p>Pro Antrieb eine eigene Instanz — dieselbe Instanz zweimal aufrufen ergibt die Warnung <i>INSTANCE_TWICE</i>. Flankenmerker für <code>FP</code>/<code>FN</code> legst du als Static an.</p>` },
{ id:'multiinstanz', title:'Profi: IEC-Zeiten und Multiinstanzen', html:`
<h3>IEC-Zeit im FB</h3>
<pre class="code">FUNCTION_BLOCK "FB_Kuehlung"
VAR_INPUT
   Walzen : Bool;
END_VAR
VAR_OUTPUT
   Wasser : Bool;
END_VAR
VAR
   T_Nachlauf : TOF;
END_VAR
BEGIN
CALL #T_Nachlauf
   IN := #Walzen
   PT := T#5S
   Q => #Wasser
END_FUNCTION_BLOCK</pre>
<p>In Bausteinen nimmst du statt der S5-Zeiten (T1, T2 …) die <b>IEC-Zeiten</b> TON, TOF, TP und die Zähler CTU/CTD als Static-Variable: eine <b>Multiinstanz</b>. Aufruf mit <code>CALL #Name</code>, Parameter IN, PT, Q, ET (Zähler: CU, R, PV, Q, CV).</p>
<h3>Eigene FBs einbetten</h3>
<p>Static <code>Rollgang : "FB_Antrieb"</code>, Aufruf <code>CALL #Rollgang</code>, Ausgang lesen: <code>U #Rollgang.Laeuft</code>. Alle Daten liegen im Instanz-DB des äusseren FB.</p>` },
{ id:'daten', title:'Profi: Globale Datenbausteine', html:`
<h3>Zugriff</h3>
<pre class="code">L  "Temp"
T  "DB_Statistik".Temp_akt
U  "DB_Walzen".Freigabe
=  "Lampe_Gruen"</pre>
<p><code>"DB_Name".Variable</code> — lesbar und schreibbar in jedem Baustein, mit denselben Anweisungen wie jede andere Variable. Werte bleiben erhalten. Startwerte stehen in der Deklaration (<code>Temp_min : Int := 1100</code>).</p>
<p>In echten S7-300-Programmen findest du auch absolute Zugriffe wie <code>L DB10.DBW 4</code> — symbolisch ist lesbarer und sicherer.</p>
<h3>Parameter-DB</h3>
<p>Einstellwerte gehören in einen DB und werden über die Schnittstelle übergeben: <code>Grenze := "DB_Parameter".Temp_min</code>.</p>
<h3>Instanz-DB lesen</h3>
<p>Ausgänge eines FB stehen in seiner Instanz: <code>U "FB_Ofen_DB".Temp_OK</code>.</p>` },
{ id:'udt', title:'Profi: PLC-Datentypen und Arrays', html:`
<h3>PLC-Datentyp (UDT)</h3>
<pre class="code">TYPE "UDT_Geruest"
STRUCT
   Ein : Bool;
   Stoerung : Bool;
   Spalt : Int;
END_STRUCT;
END_TYPE</pre>
<p>Im DB: <code>G1 : "UDT_Geruest"</code>, Zugriff <code>U "DB_Walzen".G1.Ein</code>. Als Parameter: <code>G : "UDT_Geruest"</code>, im Baustein <code>U #G.Ein</code>.</p>
<h3>Array</h3>
<pre class="code">L  "DB_Stich".Spalt[1]
L  "DB_Stich".Spalt[3]
-I
T  "Abnahme"</pre>
<p><code>Spalt : Array[1..3] of Int</code> — die Grenzen gehören zum Typ. Auch Strukturen lassen sich reihen: <code>Stich : Array[1..3] of "UDT_Stich"</code>, Zugriff <code>"DB_Stich".Stich[2].Spalt</code>.</p>` },
{ id:'standard', title:'Profi: Standardbausteine', html:`
<h3>Regeln</h3>
<ul><li>Alles über die Schnittstelle, <b>keine globalen Zugriffe</b> (Warnung <i>GLOBAL_ACCESS</i>).</li>
<li>Ein Gerät = ein Baustein: Befehl, Freigabe, Rückmeldung, Überwachung, Störung.</li>
<li>FC für reine Verknüpfungen, FB für alles mit Gedächtnis.</li>
<li>InOut für gemeinsam genutzte Variablen (z. B. Summenzähler).</li></ul>
<h3>Meldeprinzip</h3>
<table><tr><th>Zustand</th><th>Lampe</th></tr><tr><td>neu, nicht quittiert</td><td>blinkt</td></tr><tr><td>quittiert, steht noch an</td><td>Dauerlicht</td></tr><tr><td>gegangen, quittiert</td><td>aus</td></tr></table>
<h3>Verschalten</h3>
<p>Im OB1 oder im Anlagen-FB: Ausgänge eines Bausteins werden Eingänge des nächsten (<code>Freigabe := "FB_Ofen_DB".Temp_OK</code>). Die Aufrufreihenfolge folgt dem Signalfluss.</p>` },
{ id:'programmstruktur', title:'Profi: Programmstruktur und Migration', html:`
<h3>Organisationsbausteine</h3>
<pre class="code">ORGANIZATION_BLOCK "Startup"
BEGIN
L  0
T  "DB_Walzwerk".Bloecke
END_ORGANIZATION_BLOCK</pre>
<p><b>OB100</b> („Startup“): einmal beim Anlauf — Grundstellung, Initialisierung. <b>OB1</b> („Main“): jeden Zyklus — nur Aufrufe, in der Reihenfolge Sicherheit → Ablauf → Antriebe → Anzeige.</p>
<h3>Programmierstandard</h3>
<ul><li>Warnungsfrei übersetzen.</li><li>Präfixe <code>FB_</code>, <code>FC_</code>, <code>DB_</code>, <code>UDT_</code>; Netzwerktitel; Kommentare an der Schnittstelle.</li>
<li>Konstanten an Parametern hinterfragen.</li><li>Sprünge sparsam und mit sprechenden Marken.</li></ul>
<h3>Migration auf S7-1200/1500</h3>
<p>Die S7-1200 kann kein AWL. Beim Umbau wird jede Kette übertragen:</p>
<table><tr><th>AWL</th><th>SCL</th></tr>
<tr><td><code>U a / U b / = q</code></td><td><code>q := a AND b;</code></td></tr>
<tr><td><code>U s / S q / U r / R q</code></td><td><code>IF s THEN q := TRUE; END_IF; IF r THEN q := FALSE; END_IF;</code></td></tr>
<tr><td><code>L a / L b / +I / T c</code></td><td><code>c := a + b;</code></td></tr>
<tr><td><code>U x / SPBN M / … / M:</code></td><td><code>IF x THEN … END_IF;</code></td></tr>
<tr><td><code>L S5T#3S / SE T1</code></td><td><code>T1(IN := …, PT := T#3S);</code> (IEC-Zeit TON)</td></tr></table>` },
{ id:'fehlersuche', title:'Fehlersuche im Betrieb', html:`
<h3>Worum es geht</h3>
<p>Steht eine Anlage im Betrieb, zählt jede Minute. Deine Aufgabe: Ursache finden, beheben, wieder anfahren. Geübt wird das in der Störungsjagd (Live-Challenge) und in den Aufgaben mit Fehlersuche.</p>
<h3>Vorgehen bei einer Störung</h3>
<p><b>1. Meldung lesen</b> – Nummer, Priorität (1 = Sicherheit/ganze Anlage, 2 = Teilanlage, 3 = Qualität) und Text.<br>
<b>2. Beobachten</b> – die Anlage mit der Störung laufen lassen und die Werte vergleichen: Was müsste passieren, was passiert?<br>
<b>3. Eingrenzen</b> – Programm, Hardware oder Bedienung?<br>
<b>4. Diagnose stellen</b> – Ursache wählen, bei Hardware das betroffene Bauteil (Instandhaltungsauftrag), bei Bedienung den richtigen Wert am HMI.<br>
<b>5. Beheben und wieder anfahren</b> – Programmfehler im Editor korrigieren; die Anlage läuft nur an, wenn die Tests bestehen.<br>
<b>6. Übergabe</b> – kurz notieren, was die nächste Schicht wissen muss.</p>
<h3>Programm, Hardware oder Bedienung?</h3>
<p>Die Statusspalte zeigt je Zeile VKE und AKKU. Folge dem VKE von oben nach unten: Kippt er an einer Abfrage, obwohl die Anlage draussen etwas anderes zeigt, liegt der Fehler am Eingang (Hardware). Stimmen die Abfragen, aber die Verknüpfung, der Vergleich oder ein Sprung führt falsch weiter, ist es ein Programmfehler.</p>
<p>Beispiel: Die Ofentür-Endlage meldet „offen“, obwohl die Tür geschlossen ist → <b>Sensor defekt/verschmutzt</b>, Bauteil ist der Endlagen-Eingang.</p>
<p>Ist alles verdrahtet und das Programm richtig, aber ein Sollwert oder die Betriebsart am HMI falsch eingestellt, ist es ein <b>Bedienfehler</b>.</p>
<h3>Ursachen</h3>
<p><b>Programm:</b> Logik/Verknüpfung · Vergleich/Grenzwert · Zeit/Timer · Flanke/Zählen · Adressierung/Index/Datenbaustein · Reihenfolge/Zyklus<br>
<b>Hardware:</b> Sensor defekt/verschmutzt · Drahtbruch · Aktor defekt (Rückmeldung bleibt aus) · Not-Halt/Sicherheitskreis<br>
<b>Bedienung:</b> falsche Betriebsart/Parameter am HMI</p>
` }
];M.forEach((s, i) => { s.page = i + 1; });
root.MANUAL_CONTENT = M;
root.MANUAL_IDS = M.map(s => s.id);
})(typeof window !== 'undefined' ? window : globalThis);