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
<p>Ein Programm besteht aus mehreren Netzwerken, jedes mit Titel. Die SPS wertet sie von oben nach unten aus.</p>` }
];
M.forEach((s, i) => { s.page = i + 1; });
root.MANUAL_CONTENT = M;
root.MANUAL_IDS = M.map(s => s.id);
})(typeof window !== 'undefined' ? window : globalThis);
