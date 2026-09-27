/* ===== KOP QUEST: Handbuch ===== */
(function(root){
const M = [
{ id:'einfuehrung', title:'Einführung & Bedienung', html:`
<h3>Willkommen auf der Gratbahn</h3>
<p>ARIA hat sich aus der Roboterzelle in die Bergstation der Seilbahn <b>Gratbahn</b> gerettet. Türen, Antrieb und Sicherheitskette gehorchen ihr — bis du die Steuerung neu zeichnest, als <b>Kontaktplan (KOP)</b>, wie er in Siemens-Steuerungen verwendet wird.</p>
<h3>So bedienst du den Netzwerk-Editor</h3>
<p><b>1. Element antippen</b> — Kontakt oder Spule wird blau umrandet.<br>
<b>2. Variable wählen</b> — links in der Variablenliste anklicken, oder oben im Feld <i>Variable</i> eintippen.<br>
<b>3. Aufbauen</b> — mit der Werkzeugleiste: <i>Kontakt dahinter</i> (Reihe), <i>Parallelzweig</i>, <i>Öffner</i>, <i>Flanke</i>, <i>Timer</i>, <i>Zähler</i>, <i>Vergleich</i>; bei Spulen <i>Setzen</i>, <i>Rücksetzen</i>, <i>weitere Spule</i>.<br>
<b>4. Testen</b> — <kbd>Strg</kbd>+<kbd>Enter</kbd> oder der grosse Knopf. Beim Abspielen färbt sich der Stromfluss grün.<br>
<b>5. Textansicht</b> — oben rechts umschaltbar; zeigt dasselbe Programm als Text.</p>
<p>Rot markierte <b>??</b> sind offene Stellen: Hier fehlt noch eine Variable.</p>` },
{ id:'anlage', title:'Die Bergstation', html:`
<h3>Was du siehst</h3>
<p><b>Antriebsrad</b> — dreht, wenn der Antrieb läuft; darüber die Richtung (Berg/Tal). Daneben die <b>Bremse</b> (rot = eingefallen).<br>
<b>Kabinen</b> — hängen am Seil; die Kabine im Bahnsteig zeigt die Türen.<br>
<b>Zugangssperre</b> mit Fahrgast · <b>Ampel</b> Rot/Gelb/Grün · <b>Hupe</b> · <b>Not-Halt</b><br>
<b>Windmesser</b> auf der Stütze mit Windwarnlampe · <b>Sicherheitskette</b> (Türen, Seil, Not-Halt, Wind) · <b>HMI</b> mit Anzeige und Fahrgastzähler.</p>
<p>Unter der Bühne zeigt der Monitor, welche Kanäle die aktuelle Aufgabe steuert.</p>` },
{ id:'grundlagen', title:'Kontakte, Spulen, Reihe', html:`
<h3>Schliesser und Spule</h3>
<pre class="kop">NETWORK Beleuchtung
S_Licht => Beleuchtung;</pre>
<p>Der <b>Schliesser</b> leitet bei Signal 1. Die <b>Spule</b> wird 1, wenn Strom bis zu ihr fliesst, sonst 0 — in jedem Zyklus neu.</p>
<h3>Reihenschaltung = UND</h3>
<pre class="kop">NETWORK Abfahrt
S_Start AND Tuer_Zu AND Not_Halt_OK => Antrieb;</pre>
<p>Alle Kontakte müssen leiten. Mehrere Spulen am Ende bekommen denselben Stromfluss.</p>
<h3>Netzwerke</h3>
<p>Ein Programm besteht aus mehreren Netzwerken, jedes mit Titel. Die SPS wertet sie von oben nach unten aus.</p>` },
{ id:'oeffner', title:'Öffner und Negation', html:`
<h3>Der Öffner</h3>
<pre class="kop">NETWORK Ampel
NOT Tuer_Zu => Ampel_Rot;</pre>
<p>Der <b>Öffner</b> <code>—|/|—</code> leitet, solange seine Variable <b>0</b> ist. Er ist das Gegenstück zum Schliesser.</p>
<h3>Ruhestromprinzip</h3>
<p>Sicherheitsgeber (Not-Halt, Seilüberwachung) liefern im Normalzustand <b>1</b> und bei Auslösung <b>0</b>. Ein Drahtbruch wirkt dann wie eine Auslösung — die Anlage bleibt sicher. Deshalb heissen solche Variablen <code>Not_Halt_OK</code> und werden im Programm als <b>Schliesser</b> abgefragt.</p>
<table><tr><th>Signal</th><th>Schliesser</th><th>Öffner</th></tr><tr><td>0</td><td>sperrt</td><td>leitet</td></tr><tr><td>1</td><td>leitet</td><td>sperrt</td></tr></table>` },
{ id:'parallel', title:'Parallelzweige (ODER)', html:`
<h3>Parallelschaltung = ODER</h3>
<pre class="kop">NETWORK Tuer
S_Tuer OR S_Tuer_Kabine => Tuer_Auf;</pre>
<p>Strom kommt durch, wenn <b>mindestens ein</b> Zweig leitet. Einen Zweig fügst du mit <i>Parallelzweig</i> unter dem markierten Element ein.</p>
<h3>Reihe und Parallel mischen</h3>
<pre class="kop">NETWORK Abfahrt
(S_Start OR S_Start_Kabine) AND Tuer_Zu => Antrieb;</pre>
<p>Zuerst wird der Parallelblock ausgewertet, dann die Reihe dahinter — wie Klammern in einer Rechnung.</p>` },
{ id:'selbsthaltung', title:'Selbsthaltung und Verriegelung', html:`
<h3>Selbsthaltung</h3>
<pre class="kop">NETWORK Antrieb
(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;</pre>
<p>Parallel zum Starttaster liegt ein Kontakt der <b>Spule selbst</b>. Ist sie einmal an, hält sie sich über diesen Zweig. Der Stopptaster als Öffner in Reihe unterbricht die Haltung.</p>
<h3>Aus-Vorrang und Ein-Vorrang</h3>
<p>Liegt der Stopp <b>hinter</b> dem Parallelblock, gewinnt Stopp, wenn beide gedrückt sind (Aus-Vorrang — für Antriebe üblich). Liegt er nur im Haltezweig, gewinnt Start (Ein-Vorrang).</p>
<h3>Verriegelung</h3>
<pre class="kop">NETWORK Fahrt Berg
(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;</pre>
<p>Ein Öffner der Gegenrichtung verhindert, dass beide Richtungen gleichzeitig aktiv sind.</p>` },
{ id:'setzen', title:'Setzen und Rücksetzen', html:`
<h3>S- und R-Spule</h3>
<pre class="kop">NETWORK Stoerung speichern
Seil_Fehler => S Stoerung;

NETWORK Quittieren
Quittieren AND NOT Seil_Fehler => R Stoerung;</pre>
<p>Die <b>S-Spule</b> setzt ihre Variable auf 1, wenn Strom fliesst — ohne Strom bleibt der Wert unverändert. Die <b>R-Spule</b> setzt auf 0.</p>
<h3>Vorrang</h3>
<p>Das <b>untere</b> Netzwerk wirkt zuletzt und gewinnt. Steht Rücksetzen unten, ist es rücksetzdominant.</p>
<h3>Negierte Spule</h3>
<p><code>—(/)—</code> schreibt das Gegenteil des Stromflusses: Strom → 0, kein Strom → 1.</p>
<h3>Doppelspule vermeiden</h3>
<p>Eine normale Spule sollte pro Variable nur <b>einmal</b> vorkommen — sonst überschreibt das letzte Netzwerk die vorherigen.</p>` },
{ id:'flanken', title:'Flanken', html:`
<h3>P- und N-Flanke</h3>
<pre class="kop">NETWORK Zaehlen
P(Drehkreuz) => INC(Fahrgaeste);</pre>
<p>Die <b>P-Flanke</b> <code>—|P|—</code> leitet genau einen Zyklus lang, wenn ihr Signal von 0 auf 1 wechselt. Die <b>N-Flanke</b> <code>—|N|—</code> meldet den Wechsel von 1 auf 0.</p>
<p>Ohne Flanke würde die Aktion in <b>jedem</b> Zyklus ausgeführt, solange das Signal 1 ist — der Zähler „rast“.</p>
<h3>Stromstoss (Toggle)</h3>
<pre class="kop">NETWORK Flanke
P(S_Licht) => Impuls;

NETWORK Umschalten
(Impuls AND NOT Beleuchtung) OR (NOT Impuls AND Beleuchtung) => Beleuchtung;</pre>
<p>Die Flanke wird zuerst in einen Merker <code>Impuls</code> geschrieben, der dann im Umschalt-Netzwerk zweimal abgefragt wird.</p>` },
{ id:'timer', title:'Zeiten: TON, TOF, TP', html:`
<h3>Zeitglieder als Box</h3>
<pre class="kop">NETWORK Tuer oeffnen
Kabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;</pre>
<p>Jeder Timer braucht eine eigene <b>Instanz</b> (hier <code>T_Tuer</code>) und eine Zeit <code>PT</code>, z. B. <code>T#2S</code> oder <code>T#500MS</code>.</p>
<table><tr><th>Box</th><th>Wirkung</th></tr>
<tr><td>TON</td><td>Einschaltverzögerung: Ausgang erst, wenn der Eingang PT lang ansteht</td></tr>
<tr><td>TOF</td><td>Ausschaltverzögerung: Ausgang bleibt nach Wegfall des Eingangs noch PT lang an</td></tr>
<tr><td>TP</td><td>Impuls: Ausgang genau PT lang, ausgelöst durch eine steigende Flanke</td></tr></table>
<p>Die Box liegt im Strompfad: Der Strom vor der Box ist ihr Eingang <code>IN</code>, der Strom danach ihr Ausgang <code>Q</code>.</p>` },
{ id:'timer2', title:'Blinker und Überwachung', html:`
<h3>Taktmerker</h3>
<pre class="kop">NETWORK Blinken
Windwarnung AND Takt_1Hz => Ampel_Gelb;</pre>
<p>Ein Taktmerker wechselt regelmässig zwischen 0 und 1. In Reihe mit einer Bedingung ergibt sich ein Blinklicht.</p>
<h3>Eigener Blinker</h3>
<pre class="kop">NETWORK Takt
NOT Impuls AND TON(T_Takt, T#500MS) => Impuls;</pre>
<p>Der TON startet sich über den Öffner seines eigenen Ausgangs immer wieder neu und liefert alle 0,5 s einen Impuls von einem Zyklus.</p>
<h3>Überwachungszeit</h3>
<pre class="kop">NETWORK Ueberwachung
Tuer_Schliessen AND NOT Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;</pre>
<p>Kommt die Rückmeldung nicht innerhalb der Zeit, wird eine Störung gespeichert.</p>` },
{ id:'zaehler', title:'Zähler: CTU, CTD', html:`
<h3>Vorwärtszähler CTU</h3>
<pre class="kop">NETWORK Gaeste
Drehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;</pre>
<p>Der CTU zählt jede <b>steigende Flanke</b> an seinem Eingang (die Flanke steckt schon im Zähler). <code>R</code> setzt den Zählwert <code>CV</code> auf 0. Der Ausgang <code>Q</code> ist 1, sobald <code>CV ≥ PV</code>.</p>
<h3>Rückwärtszähler CTD</h3>
<pre class="kop">NETWORK Wartung
Abfahrt AND CTD(Z_Wartung, PV:=5, LD:=Wartung_OK) => Wartung_faellig;</pre>
<p><code>LD</code> lädt <code>PV</code> in den Zählwert. Jede Flanke zählt eins herunter; <code>Q</code> ist 1, sobald <code>CV ≤ 0</code>.</p>
<p>Den Zählwert liest du als <code>Z_Gaeste.CV</code>, z. B. in einer MOVE-Box.</p>` },
{ id:'vergleich', title:'Vergleicher', html:`
<h3>Vergleichskontakt</h3>
<pre class="kop">NETWORK Windwarnung
[Wind_kmh > 60] => Windwarnung;</pre>
<p>Ein Vergleicher leitet, wenn der Vergleich stimmt. Möglich sind <code>==</code>, <code>&lt;&gt;</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>.</p>
<h3>Bereich</h3>
<pre class="kop">NETWORK Gelb
[Wind_kmh >= 40] AND [Wind_kmh <= 60] => Ampel_Gelb;</pre>
<h3>Hysterese</h3>
<pre class="kop">NETWORK Sturm
[Wind_kmh > 60] => S Wind_Stopp;

NETWORK Beruhigt
[Wind_kmh < 40] => R Wind_Stopp;</pre>
<p>Zwei Schwellen verhindern, dass ein Ausgang um einen Grenzwert herum flattert.</p>` },
{ id:'werte', title:'MOVE und Rechnen', html:`
<h3>MOVE</h3>
<pre class="kop">NETWORK Langsam
S_Langsam => MOVE(2, Sollwert);</pre>
<p>MOVE schreibt IN nach OUT, wenn Strom in die Box fliesst. Ohne Strom bleibt OUT unverändert.</p>
<h3>Rechenboxen</h3>
<pre class="kop">NETWORK Tagessumme
P(Abfahrt) => ADD(Tagesgaeste, Kabinengaeste, Tagesgaeste);</pre>
<p>ADD, SUB, MUL, DIV: <code>OUT := IN1 op IN2</code>. INC und DEC zählen eine Variable um 1 hoch oder herunter. Kommazahlen (REAL) schreibst du mit Punkt: <code>3.6</code>.</p>
<p>Eine Box ohne Bedingung (<code>immer</code>) rechnet in jedem Zyklus.</p>` },
{ id:'kette', title:'Sicherheitskette', html:`
<h3>Aufbau</h3>
<pre class="kop">NETWORK Sicherheitskette
Tuer_Zu AND Seil_OK AND Not_Halt_OK AND Wind_OK => Kette_OK;</pre>
<p>Alle Sicherheitsbedingungen liegen <b>in Reihe</b>. Jedes Glied meldet 1 = „in Ordnung“ (Ruhestromprinzip).</p>
<h3>Regeln</h3>
<ul><li>Die Kette liegt <b>in</b> der Freigabe des Antriebs — öffnet sie, fällt der Antrieb ab.</li>
<li>Nach dem Schliessen der Kette läuft nichts von selbst wieder an: ein neuer Start ist nötig.</li>
<li>Unterbrechungen werden mit <b>S</b> gespeichert und müssen quittiert werden.</li>
<li>Eine Kette wird <b>nie</b> gebrückt.</li></ul>
<p>In echten Anlagen ist die Sicherheitskette zusätzlich fest verdrahtet oder läuft in einer Sicherheits-SPS — das Programm hier zeigt die Logik.</p>` },
{ id:'schrittkette', title:'Schrittkette und Betriebsarten', html:`
<h3>Schritte und Übergänge</h3>
<pre class="kop">NETWORK Grundstellung
NOT Schritt_Einsteigen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;

NETWORK Weiter
Schritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt, R Schritt_Einsteigen;

NETWORK Zurueck
Schritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;</pre>
<p>Jeder Schritt ist ein Merker. Ein <b>Übergang</b> = aktueller Schritt UND Bedingung → S nächster Schritt, R aktueller Schritt. Es ist immer genau ein Schritt aktiv.</p>
<h3>Befehlsausgabe</h3>
<pre class="kop">NETWORK Ampel rot
Schritt_Einsteigen OR Schritt_Warnen => Ampel_Rot;</pre>
<p>Die Ausgänge kommen <b>nach</b> den Übergängen, jeder genau einmal. Ist ein Ausgang in mehreren Schritten aktiv, werden die Schritte parallel geschaltet.</p>
<h3>Schrittzeit</h3>
<pre class="kop">NETWORK Warnen -> Fahrt
Schritt_Warnen AND TON(T_Warnen, T#3S) => S Schritt_Fahrt, R Schritt_Warnen;</pre>
<h3>Betriebsarten</h3>
<pre class="kop">NETWORK Antrieb
((Auto AND Schritt_Fahrt) OR (NOT Auto AND S_Tippen)) AND Kette_OK => Antrieb;</pre>
<p>Hand und Automatik liegen parallel, die Sicherheitskette in Reihe dahinter — sie gilt immer.</p>` }
];
M.forEach((s, i) => { s.page = i + 1; });
root.MANUAL_CONTENT = M;
root.MANUAL_IDS = M.map(s => s.id);
})(typeof window !== 'undefined' ? window : globalThis);
