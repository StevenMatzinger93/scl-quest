/* ===== FUP QUEST: Handbuch ===== */
(function(root){
const M = [
{ id:'einfuehrung', title:'Einführung & Bedienung', html:`
<h3>Willkommen im Stellwerk Brünigkreuz</h3>
<p>ARIA hat sich ins Stellwerk geflüchtet und stellt Weichen unter fahrenden Zügen um. Du programmierst das Stellwerk neu — im <b>Funktionsplan (FUP)</b>, wie er in Siemens-Steuerungen verwendet wird.</p>
<h3>So bedienst du den Baustein-Editor</h3>
<p><b>1. Ziehen + verbinden</b> — Eine Box aus der Palette (<code>&amp;</code>, <code>&gt;=1</code>, <code>X</code>, Timer …) auf einen Eingang ziehen: Sie wird dort eingefügt. Eine Variable aus der Liste auf einen Eingang ziehen: Sie wird damit verbunden.<br>
<b>2. Ohne Maus</b> — Eingang antippen (blau umrandet), dann die Box in der Palette oder die Variable in der Liste antippen.<br>
<b>3. Ausgang</b> — Rechts antippen: <code>=</code> (Zuweisung), <code>S</code>, <code>R</code>, <code>SR</code>, <code>RS</code>, MOVE, Rechnen.<br>
<b>4. Testen</b> — <kbd>Strg</kbd>+<kbd>Enter</kbd> oder der grosse Knopf. Beim Abspielen zeigt jede Leitung ihren Signalzustand: <span style="color:#39ff14">grün = 1</span>, grau = 0.<br>
<b>5. Textansicht</b> — oben rechts umschaltbar; zeigt dasselbe Programm als Text.</p>
<p>Rot markierte <b>??</b> sind offene Eingänge: Hier fehlt noch eine Variable.</p>` },
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
<p>Die <b>&amp;-Box</b> liefert 1, wenn <b>alle</b> Eingänge 1 sind. Eingänge hinzufügen: Box antippen → <i>+ Eingang</i>.</p>
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
<p>Der <b>Kreis</b> am Eingang kehrt das Signal um: 0 → 1, 1 → 0. Eingang antippen → <i>○ negieren</i>.</p>
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
<p>Der Eingang von links ist <b>S</b>, der zweite Eingang (Variable) ist <b>R</b>.</p>` },
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
<p>Jede Zeitbox braucht eine eigene <b>Instanz</b> (hier <code>T_Vorlauf</code>) und eine Zeit <code>PT</code>. Der Eingang IN ist das Signal, das links ankommt.</p>
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
<p>Der CTU zählt jede steigende Flanke an CU. <code>R</code> setzt auf 0, <code>Q</code> = 1, sobald <code>CV ≥ PV</code>. Zählwert: <code>Z_Ein.CV</code>.</p>
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
<p>ADD, SUB, MUL, DIV rechnen <code>OUT := IN1 op IN2</code>. INC/DEC zählen um 1. Ohne Bedingung rechnet die Box in jedem Zyklus.</p>` },
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
<p>Jeder Schritt ist ein Speicher, der erst gesetzt wird, wenn der vorherige fertig ist — eine Schrittkette im Funktionsplan.</p>` }
];
M.forEach((s, i) => { s.page = i + 1; });
root.MANUAL_CONTENT = M;
root.MANUAL_IDS = M.map(s => s.id);
})(typeof window !== 'undefined' ? window : globalThis);
