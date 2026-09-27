/* ===== SENSORWERKSTATT: Theorie-Aufträge (Module 1–3) =====
   verifyModel: { detect:{ sensor, obj }, expect } | { raw:{ kind, value, range }, expect } | { calc:'(SM) => …', expect, tol }
   — der Validator (validate_sensor.js) prüft die Aussage gegen sensor_model.js.
   Werte mit [prüfen] im Faktenblatt (docs/SENSORWERKSTATT_FAKTEN.md) sind vorsichtig formuliert. */
(function(){
// kleine SVG-Skizzen, dunkler Hintergrund
const svg = (w, h, inner) => '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" font-family="monospace" style="max-width:100%;height:auto;background:#161b22;border-radius:8px">' + inner + '</svg>';
const txt = (x, y, s, c, size, anchor) => '<text x="' + x + '" y="' + y + '" font-size="' + (size || 11) + '" fill="' + (c || '#d6dde6') + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>';
const box = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" fill="#232a33" stroke="' + (c || '#8aa0b4') + '"/>';
const line = (x1, y1, x2, y2, c, w) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + (w || 3) + '"/>';
const arrow = (x1, y, x2) => line(x1, y, x2 - 6, y, '#ffb000', 2) + '<path d="M' + (x2 - 8) + ' ' + (y - 5) + ' L' + x2 + ' ' + y + ' L' + (x2 - 8) + ' ' + (y + 5) + 'z" fill="#ffb000"/>';

// Kette Sensor → Klemme → Eingang → Adresse → Variable
const CHAIN = svg(560, 90, [['Sensor', '-B1'], ['Klemme', '-X2:5'], ['Eingang', 'DIa.4'], ['Adresse', '%I0.4'], ['Variable', '"Ind_Metall"']].map((p, i) =>
  box(8 + i * 112, 18, 92, 52, i === 3 ? '#ffb000' : '#8aa0b4') + txt(54 + i * 112, 40, p[0], '#9fb3c8', 11, 'middle') + txt(54 + i * 112, 58, p[1], '#ffffff', 12, 'middle')
  + (i < 4 ? arrow(100 + i * 112, 44, 120 + i * 112) : '')).join(''));

// M12-Stecker (Blick auf die Stifte des Sensors)
const M12 = svg(300, 150, '<circle cx="75" cy="75" r="58" fill="#2b3138" stroke="#8aa0b4" stroke-width="2"/><rect x="70" y="14" width="10" height="10" fill="#161b22"/>'
  + [[1, 105, 45, '#8b5a2b', 'BN'], [2, 45, 45, '#e8e8e8', 'WH'], [3, 45, 105, '#2f6fd0', 'BU'], [4, 105, 105, '#111', 'BK']].map(p =>
    '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="11" fill="' + p[3] + '" stroke="#ccc"/>' + txt(p[1], p[2] + 4, p[0], p[0] === 2 ? '#111' : '#fff', 11, 'middle')).join('')
  + txt(150, 30, '1 BN braun  → L+ (+24 V)', '#e0b080') + txt(150, 55, '2 WH weiss  → 2. Ausgang/NC', '#e8e8e8') + txt(150, 80, '3 BU blau   → M (0 V)', '#7fb0ff') + txt(150, 105, '4 BK schwarz → Schaltsignal', '#d6dde6')
  + txt(150, 135, 'A-codiert, 4-polig', '#ffb000'));

// Initiatorenklemme, 3 Ebenen
const TERM3 = svg(300, 140, '<rect x="120" y="10" width="70" height="120" rx="6" fill="#8f959c"/>'
  + [['L+', '#d23c3c', 'oben: L+ (über Querbrücker)'], ['S', '#ffd21e', 'Mitte: Signal → Eingang'], ['M', '#2f6fd0', 'unten: M (über Querbrücker)']].map((p, i) =>
    '<rect x="128" y="' + (18 + i * 38) + '" width="54" height="28" rx="4" fill="#d9dde2" stroke="' + p[1] + '" stroke-width="3"/>' + txt(155, 37 + i * 38, p[0], '#111', 13, 'middle') + txt(200, 37 + i * 38, p[2], '#d6dde6', 10)).join('')
  + '<circle cx="110" cy="70" r="6" fill="#ffd21e"/>' + txt(10, 74, 'gelbe LED', '#ffd21e', 10) + line(20, 32, 128, 32, '#8b5a2b') + line(20, 70, 104, 70, '#555') + line(20, 108, 128, 108, '#2f6fd0')
  + txt(10, 26, 'BN', '#e0b080', 10) + txt(10, 100, 'BU', '#7fb0ff', 10));

// PNP / NPN Stromfluss
const PNPNPN = svg(560, 170,
  txt(140, 16, 'PNP – plusschaltend', '#ffb000', 12, 'middle') + txt(420, 16, 'NPN – minusschaltend', '#ffb000', 12, 'middle')
  + line(20, 34, 260, 34, '#d23c3c') + txt(24, 30, 'L+ 24 V', '#ff8080', 10) + line(20, 152, 260, 152, '#2f6fd0') + txt(24, 166, 'M 0 V', '#7fb0ff', 10)
  + line(80, 34, 80, 60, '#d23c3c', 2) + box(55, 60, 50, 30) + txt(80, 80, 'Schalter', '#d6dde6', 9, 'middle') + line(80, 90, 80, 110, '#39ff14', 3)
  + box(55, 110, 50, 28, '#39ff14') + txt(80, 128, 'Eingang', '#d6dde6', 9, 'middle') + line(80, 138, 80, 152, '#39ff14', 3)
  + txt(120, 100, 'BK = +24 V', '#39ff14', 11) + txt(120, 128, '1M an M', '#9fb3c8', 10)
  + line(300, 34, 540, 34, '#d23c3c') + txt(304, 30, 'L+ 24 V', '#ff8080', 10) + line(300, 152, 540, 152, '#2f6fd0') + txt(304, 166, 'M 0 V', '#7fb0ff', 10)
  + line(360, 34, 360, 50, '#39ff14', 3) + box(335, 50, 50, 28, '#39ff14') + txt(360, 68, 'Eingang', '#d6dde6', 9, 'middle') + line(360, 78, 360, 100, '#39ff14', 3)
  + box(335, 100, 50, 30) + txt(360, 120, 'Schalter', '#d6dde6', 9, 'middle') + line(360, 130, 360, 152, '#2f6fd0', 2)
  + txt(400, 94, 'BK = 0 V', '#39ff14', 11) + txt(400, 64, '1M an L+', '#9fb3c8', 10));

// Schaltabstand × Material (Sn 8 mm)
const SN = svg(400, 150, txt(10, 16, 'Schaltabstand -B1 (Sn 8 mm) × Reduktionsfaktor', '#ffb000', 11)
  + [['Stahl', 1.0], ['Edelstahl', 0.7], ['Messing', 0.5], ['Aluminium', 0.4]].map((m, i) =>
    txt(10, 42 + i * 28, m[0], '#d6dde6', 11) + '<rect x="100" y="' + (30 + i * 28) + '" width="' + (m[1] * 8 * 30) + '" height="16" rx="3" fill="#39a0ff"/>'
    + txt(106 + m[1] * 8 * 30, 43 + i * 28, (8 * m[1]).toFixed(1).replace('.', ',') + ' mm', '#9fb3c8', 10)).join(''));

defTheory({ id:'st1a', ch:1, pos:'start', title:'Vom Sensor zur SPS', minutes:5,
  lesson:`
<p>Ein Sensor ist das <b>Sinnesorgan</b> der Anlage. Er wandelt etwas Physikalisches (Metall vor der Stirnfläche, Lichtstrahl unterbrochen, Pegel im Tank) in ein <b>elektrisches Signal</b> um, das die SPS versteht.</p>
<h4>Zwei Signalarten</h4>
<table><tr><th></th><th>Digital (binär)</th><th>Analog</th></tr>
<tr><td>Werte</td><td>nur 0 oder 1 (0 V / 24 V)</td><td>stufenlos, z. B. 0–10 V oder 4–20 mA</td></tr>
<tr><td>Beispiel</td><td>Teil da? Taster gedrückt?</td><td>Wie hoch ist der Pegel? Wie warm?</td></tr>
<tr><td>In der SPS</td><td>ein Bit, Datentyp <code>Bool</code>, z. B. <code>%I0.4</code></td><td>ein Wort (Rohwert), <code>Int</code>, z. B. <code>%IW96</code></td></tr></table>
<h4>24-V-Technik: L+ und M</h4>
<p>In der Werkstatt läuft alles mit <b>24 V DC</b> aus dem Netzteil -G1. <b>L+</b> ist der Pluspol (+24 V), <b>M</b> die Masse (0 V, Bezugspotential). Jeder Sensor braucht Versorgung (L+ und M) und liefert ein Signal. Ein Eingang erkennt <b>1</b>, wenn gegenüber seinem Bezug etwa 24 V anliegen, und <b>0</b> bei etwa 0 V.</p>
<h4>Der Weg eines Signals</h4>
${CHAIN}
<ul><li><b>Klemme:</b> Die Sensorleitung endet im Schrank auf einer Klemme, bei uns auf der Initiatorenklemme -X2:5.</li>
<li><b>Eingang:</b> Von dort geht eine Ader zum Eingang der CPU. Die LED am Eingang zeigt, ob 24 V ankommen.</li>
<li><b>Adresse:</b> <code>%I0.4</code> heisst Eingang (I), Byte 0, Bit 4. Ein Byte hat die Bits 0–7.</li>
<li><b>Variable:</b> In der PLC-Variablentabelle bekommt die Adresse einen Namen: <code>"Ind_Metall"</code>. Das Programm arbeitet nur noch mit dem Namen.</li></ul>
<p>Drei LEDs verraten dir, wie weit ein Signal kommt: <b>Sensor → Klemme → Eingang</b>. Das ist später dein wichtigstes Werkzeug bei der Fehlersuche.</p>
<h4>Schliesser und Öffner</h4>
<p>Ein <b>Schliesser</b> (NO) liefert 1, wenn er betätigt ist (Start-Taster). Ein <b>Öffner</b> (NC) liefert in Ruhe 1 und beim Betätigen 0 (Stopp-Taster). Deshalb zeigt <code>"Stopp"</code> 1, solange niemand drückt.</p>
<h4>Prozessabbild</h4>
<p>Die CPU liest zu Beginn jedes Zyklus alle Eingänge in das <b>Prozessabbild der Eingänge</b>. Das Programm arbeitet mit dieser Momentaufnahme. Am Zyklusende schreibt sie das Prozessabbild der Ausgänge auf die Klemmen. Ein Zyklus dauert nur wenige Millisekunden.</p>
<p><i>ARIA: „Sensoren lügen nie. Nur die Leute, die sie anschliessen.“</i></p>`,
  questions:[
    {type:'single', q:'Welches Signal ist ein <b>digitales</b> Signal?', options:['Induktiver Sensor meldet „Metall da“ mit 24 V','Drucktransmitter liefert 12 mA','Ultraschallsensor liefert 6,3 V','Temperaturfühler liefert 4–20 mA'], correct:0,
     explain:'Digital kennt nur zwei Zustände: 0 V oder 24 V. Die anderen Signale sind stufenlos, also analog.'},
    {type:'single', q:'Was bedeuten <b>L+</b> und <b>M</b> in der 24-V-Technik?', options:['L+ = +24 V, M = 0 V (Bezugspotential)','L+ = Lampe, M = Motor','L+ = 0 V, M = +24 V','L+ = Leiter, M = Messsignal'], correct:0,
     explain:'L+ ist der Pluspol der 24-V-Versorgung, M die Masse, also der Bezug für alle Signale.'},
    {type:'input', q:'-B1 hängt am Eingang Byte 0, Bit 4 der CPU. Wie lautet die Adresse in TIA-Schreibweise?', answer:['%I0.4','I0.4','%i0.4','i0.4','%E0.4','E0.4','%e0.4','e0.4'],
     explain:'%I = Eingang (Input), dann Byte.Bit: %I0.4. Die deutsche Mnemonik schreibt E0.4.'},
    {type:'single', q:'Die LED am Sensor und die gelbe LED an der Klemme -X2:5 leuchten, die Eingangs-LED %I0.4 an der CPU bleibt dunkel. Wo suchst du zuerst?', options:['Auf dem Weg von der Klemme zum CPU-Eingang','Am Sensor – er ist defekt','Im Programm','An der Stirnfläche des Sensors'], correct:0,
     explain:'Sensor und Klemme melden das Signal. Es geht erst danach verloren: Ader zur CPU, falscher Eingang oder Bezugspotential der Eingangsgruppe.'},
    {type:'single', q:'Wann sieht das Programm einen neuen Eingangszustand?', options:['Wenn die CPU zu Beginn des nächsten Zyklus das Prozessabbild der Eingänge liest','Sofort, mitten in jeder Anweisung','Erst nach dem nächsten Laden in das Gerät','Nur wenn sich ein Ausgang ändert'], correct:0,
     explain:'Die CPU friert die Eingänge am Zyklusanfang im Prozessabbild ein. Das Programm rechnet damit, bis zum nächsten Zyklus.'}
  ]});

defTheory({ id:'st1b', ch:1, pos:'mid', title:'Anschlussbilder lesen', minutes:6,
  lesson:`
<p>Industriesensoren haben meist einen <b>M12-Steckverbinder</b> (4-polig, A-codiert). Die Aderfarben der Anschlussleitung sind genormt. Das Datenblatt zeigt das <b>Anschlussbild</b>.</p>
${M12}
<h4>2-, 3- und 4-Leiter</h4>
<table><tr><th>Anschluss</th><th>Adern</th><th>Beispiele</th></tr>
<tr><td>2-Leiter</td><td>BN, BU (oder + und −)</td><td>Taster, Reedkontakt, Sender einer Lichtschranke, 2-Leiter-Transmitter</td></tr>
<tr><td>3-Leiter</td><td>BN = L+, BU = M, BK = Signal</td><td>induktiver, kapazitiver, optischer Sensor</td></tr>
<tr><td>4-Leiter</td><td>zusätzlich WH = 2. Ausgang</td><td>antivalenter Sensor (NO auf BK, NC auf WH)</td></tr></table>
<h4>NO, NC und antivalent</h4>
<ul><li><b>NO</b> (Schliesser): Ausgang 1, wenn der Sensor etwas erkennt.</li>
<li><b>NC</b> (Öffner): Ausgang 1 in Ruhe, 0 bei Erkennung.</li>
<li><b>Antivalent</b>: NO und NC gleichzeitig, immer entgegengesetzt. Sind beide länger gleich, stimmt etwas nicht, z. B. Drahtbruch oder Sensor defekt. Das Programm kann das überwachen.</li></ul>
<h4>Drahtbruchsicherheit</h4>
<p>Ein Drahtbruch liefert immer <b>0</b>. Ist ein Signal als <b>Öffner</b> verdrahtet (Haube zu = 1), wirkt ein Drahtbruch wie „Haube offen“: Die Anlage geht in den sicheren Zustand. Bei einem Schliesser bliebe der Bruch unbemerkt. Darum werden sicherheitsrelevante Meldungen als Öffner ausgeführt.</p>
<h4>Datenblatt lesen</h4>
<p>Auf dem Typenschild stehen Bauart, Versorgung, Ausgang und Schaltabstand, zum Beispiel <code>IND M18 · 10–30 V DC · PNP NO · Sn 8 mm · bündig · IP67</code>.</p>
<h4>Im Schrank: die Initiatorenklemme</h4>
${TERM3}
<ul><li>Drei Ebenen pro Klemme: <b>oben L+</b>, <b>Mitte Signal</b>, <b>unten M</b>. Die gelbe LED zeigt, ob das Signal ankommt.</li>
<li>Die L+- und M-Ebenen aller Klemmen verbindet man mit <b>Querbrückern</b> mit dem Verteiler -X1.</li>
<li>Feindrähtige Adern bekommen eine <b>Aderendhülse</b> (Crimpzange), sonst lösen sich einzelne Drähte: Wackelkontakt.</li>
<li>Pro Klemmstelle nur <b>ein</b> Leiter. Verdrahtet wird nur <b>spannungsfrei</b>.</li></ul>`,
  questions:[
    {type:'single', q:'Welche Ader führt am M12-Stecker (Pin 3, blau) welches Potential?', options:['BU – M (0 V)','BU – L+ (+24 V)','BU – Schaltsignal','BU – zweiter Ausgang'], correct:0,
     explain:'1 BN = L+, 2 WH = zweiter Ausgang, 3 BU = M, 4 BK = Schaltsignal.'},
    {type:'single', q:'Auf welche Ebene der Initiatorenklemme gehört die schwarze Signalader BK?', options:['In die Mitte (Signalebene)','Oben (L+-Ebene)','Unten (M-Ebene)','Egal, die Klemme verbindet alles'], correct:0,
     explain:'Oben L+, Mitte Signal, unten M. Nur die Signalebene ist mit dem SPS-Eingang verbunden.'},
    {type:'single', q:'Warum wird der Haubenschalter -S5 als <b>Öffner</b> ausgeführt?', options:['Ein Drahtbruch wirkt dann wie „Haube offen“ – die Anlage stoppt','Öffner sind billiger','Öffner brauchen keine Versorgung','Damit „Haube_Zu“ in Ruhe 0 ist'], correct:0,
     explain:'Drahtbruch = 0 = sicherer Zustand. Das nennt man drahtbruchsicher.'},
    {type:'single', q:'Ein antivalenter Sensor meldet NO = 1 und NC = 1, und das bleibt so. Was bedeutet das?', options:['Fehler – die beiden Ausgänge müssen immer verschieden sein','Objekt erkannt','Kein Objekt da','Normaler Umschaltmoment'], correct:0,
     explain:'Antivalent heisst entgegengesetzt. Kurz beim Umschalten dürfen beide gleich sein, dauerhaft nicht.'},
    {type:'multi', q:'Was gehört zur fachgerechten Verdrahtung an -X2? (alle richtigen)', options:['Aderendhülsen auf feindrähtige Adern crimpen','L+ und M der Klemmen über Querbrücker verbinden','Nur im spannungsfreien Zustand verdrahten','Zwei Adern in dieselbe Klemmstelle stecken, spart Platz'], correct:[0,1,2],
     explain:'Hülse, Querbrücker, spannungsfrei. Pro Klemmstelle nur ein Leiter – für mehr gibt es Querbrücker oder Doppelstockklemmen.'}
  ]});

defTheory({ id:'st2a', ch:2, pos:'start', title:'Wer schaltet was?', minutes:5,
  lesson:`
<p>Ein elektronischer Sensor hat innen einen Transistor als Schalter. Die Frage ist: Schaltet er <b>Plus</b> oder <b>Minus</b> auf die Signalader?</p>
${PNPNPN}
<table><tr><th></th><th>PNP (plusschaltend)</th><th>NPN (minusschaltend)</th></tr>
<tr><td>Schaltet auf BK</td><td>+24 V (L+)</td><td>0 V (M)</td></tr>
<tr><td>Englisch</td><td>sourcing: liefert Strom</td><td>sinking: nimmt Strom auf</td></tr>
<tr><td>Last (Eingang) liegt</td><td>zwischen BK und M</td><td>zwischen L+ und BK</td></tr>
<tr><td>Verbreitung</td><td>Standard in Europa</td><td>häufig in Asien und Nordamerika</td></tr></table>
<h4>Messen mit dem Multimeter</h4>
<ul><li><b>PNP</b>: Messung <b>BK gegen M</b>. Geschaltet ≈ 24 V, nicht geschaltet ≈ 0 V.</li>
<li><b>NPN</b>: Messung <b>BK gegen L+</b>. Geschaltet ≈ 24 V (weil BK dann auf 0 V liegt), nicht geschaltet ≈ 0 V.</li>
<li>Misst du einen NPN-Sensor gegen M, siehst du das Gegenteil: geschaltet 0 V. Das verwirrt, ist aber richtig.</li></ul>
<h4>Der Klassiker</h4>
<p>Die Sensor-LED zeigt nur, dass der Sensor <b>intern</b> schaltet. Ob der Eingang das versteht, hängt davon ab, ob seine Eingangsbeschaltung zum Sensortyp passt. Dazu mehr in Theorie B.</p>
<p><i>Werkmeister: „Erst das Typenschild, dann das Multimeter, dann die Meinung.“</i></p>`,
  questions:[
    {type:'single', q:'Ein <b>PNP</b>-Sensor erkennt ein Teil. Was liegt auf der schwarzen Ader BK?', options:['+24 V','0 V','4–20 mA','Nichts, der Ausgang ist offen'], correct:0,
     explain:'Plusschaltend: Der Transistor verbindet BK mit L+.'},
    {type:'single', q:'Ein <b>NPN</b>-Sensor hat geschaltet. Du misst zwischen BK und <b>L+</b>. Was zeigt das Multimeter?', options:['ca. 24 V','ca. 0 V','ca. 12 V','Fehler, so misst man nicht'], correct:0,
     explain:'BK liegt beim geschalteten NPN auf M. Zwischen M und L+ liegen 24 V.'},
    {type:'input', q:'Ein PNP-Sensor ist an einen Eingang angeschlossen und hat <b>nicht</b> geschaltet. Wie viel Volt misst du zwischen BK und M? (Zahl)', answer:['0','0 V','0V','ca. 0','0,0','0.0'],
     explain:'Nicht geschaltet: BK hat keine Verbindung zu L+, der Eingang zieht die Leitung auf 0 V.'},
    {type:'single', q:'Welcher englische Begriff passt zu PNP?', options:['sourcing – der Sensor liefert Strom','sinking – der Sensor nimmt Strom auf','floating','grounding'], correct:0,
     explain:'Der PNP-Ausgang liefert Strom aus L+ in den Eingang (sourcing). NPN nimmt Strom auf (sinking).'},
    {type:'single', q:'Wo liegt die Last (der SPS-Eingang) bei einem <b>NPN</b>-Sensor?', options:['Zwischen L+ und BK','Zwischen BK und M','Zwischen BN und BU','Direkt am Netzteil'], correct:0,
     explain:'NPN schaltet BK auf M. Damit Strom fliesst, muss die Last von L+ kommen.'}
  ]});

defTheory({ id:'st2b', ch:2, pos:'mid', title:'Eingangsbeschaltung und 1M', minutes:6,
  lesson:`
<p>Ein Eingang braucht einen <b>geschlossenen Stromkreis</b>: vom Sensor durch den Eingang zum Bezugspotential. Bei der S7-1200 legt man dieses Bezugspotential für eine ganze <b>Eingangsgruppe</b> mit einem Anschluss fest: <b>1M</b>.</p>
<table><tr><th>Sensoren</th><th>1M auflegen auf</th><th>Eingang arbeitet</th><th>Strom fliesst</th></tr>
<tr><td>PNP</td><td><b>M</b></td><td>stromziehend (sink)</td><td>L+ → Sensor → BK → Eingang → 1M → M</td></tr>
<tr><td>NPN</td><td><b>L+</b></td><td>stromliefernd (source)</td><td>L+ → 1M → Eingang → BK → Sensor → M</td></tr></table>
<p>Die Onboard-Eingänge der CPU 1214C können beides. Man entscheidet es mit der Ader an 1M. Alle 14 Eingänge teilen sich <b>ein</b> 1M, darum kann man an dieser Gruppe PNP und NPN nicht mischen.</p>
<h4>Was passiert bei falscher Beschaltung?</h4>
<table><tr><th>Sensor</th><th>1M an</th><th>Sensor-LED</th><th>Eingangs-LED</th></tr>
<tr><td>PNP</td><td>M</td><td>an</td><td>an ✓</td></tr>
<tr><td>PNP</td><td>L+</td><td>an</td><td><b>aus</b> ✗</td></tr>
<tr><td>NPN</td><td>L+</td><td>an</td><td>an ✓</td></tr>
<tr><td>NPN</td><td>M</td><td>an</td><td><b>aus</b> ✗</td></tr></table>
<p>Bei falscher Beschaltung liegen auf beiden Seiten des Eingangs dieselben 24 V bzw. 0 V: Es fliesst kein Strom. Der Sensor schaltet trotzdem und seine LED leuchtet.</p>
<h4>Signalmodule</h4>
<p>Ein Signalmodul wie die <b>SM 1221 DI 8</b> hat eigene Bezugsanschlüsse. Wie viele Gruppen es gibt und wie sie heissen, steht im <b>Gerätehandbuch</b>; das bitte am echten Modul prüfen. In der Werkstatt ist die SM 1221 mit zwei Gruppen nachgebildet: <b>1M</b> für .0–.3 und <b>2M</b> für .4–.7. So kann eine Gruppe NPN, die andere PNP bedienen.</p>
<p>Manche Baugruppen und Ausgänge können nur eine Richtung. Die Digitalausgänge der CPU 1214C DC/DC/DC sind zum Beispiel nur <b>plusschaltend</b>.</p>
<p><i>ARIA: „Ich habe einen NPN-Sensor ins PNP-Lager gelegt. Er leuchtet so schön, und der Eingang merkt nichts.“</i></p>`,
  questions:[
    {type:'single', q:'An der CPU 1214C hängen nur <b>PNP</b>-Sensoren. Wohin gehört 1M?', options:['Auf M','Auf L+','Auf den Signaleingang .0','Bleibt frei'], correct:0,
     explain:'PNP liefert +24 V. Der Strom muss durch den Eingang nach M zurück, also 1M an M.'},
    {type:'single', q:'Die Gruppe soll <b>NPN</b>-Sensoren lesen. Wohin gehört 1M?', options:['Auf L+','Auf M','Auf die Schirmschiene','Auf die Signalader BK'], correct:0,
     explain:'NPN schaltet BK auf M. Der Strom kommt über 1M von L+ durch den Eingang.'},
    {type:'single', q:'PNP-Sensor, 1M liegt auf L+. Was siehst du, wenn der Sensor schaltet?', options:['Sensor-LED an, Eingangs-LED aus','Sensor-LED aus, Eingangs-LED an','Beide LEDs an','Das Netzteil geht in Überlast'], correct:0,
     explain:'Der Sensor schaltet (LED an), aber zwischen BK (+24 V) und 1M (+24 V) gibt es keine Spannung, also fliesst kein Strom.'},
    {type:'single', q:'Warum kann man an den 14 Onboard-Eingängen der CPU 1214C keine PNP- und NPN-Sensoren mischen?', options:['Alle Eingänge teilen sich ein gemeinsames 1M','NPN-Sensoren brauchen 230 V','Die CPU erkennt NPN-Sensoren nicht','Weil die Adressen nicht reichen'], correct:0,
     explain:'1M legt das Bezugspotential für die ganze Gruppe fest. Es kann nur auf M oder auf L+ liegen.'},
    {type:'single', q:'Wie heisst ein Eingang, in den der Strom <b>hineinfliesst</b> und über 1M nach M abfliesst (passend für PNP)?', options:['stromziehend (sink)','stromliefernd (source)','potentialfrei','analog'], correct:0,
     explain:'Der Eingang „zieht“ den Strom, den der PNP-Sensor liefert: sink bzw. stromziehend.'}
  ]});

defTheory({ id:'st3a', ch:3, pos:'start', title:'Induktiv und kapazitiv', minutes:6,
  lesson:`
<h4>Induktive Sensoren</h4>
<p>Eine Spule im Sensorkopf erzeugt ein hochfrequentes Magnetfeld. Kommt <b>Metall</b> hinein, entstehen darin Wirbelströme, die dem Feld Energie entziehen. Der Sensor merkt das und schaltet. Kunststoff, Glas und Wasser sieht er nicht.</p>
<p>Der <b>Nennschaltabstand Sn</b> auf dem Typenschild gilt für Stahl (Normmessplatte). Andere Metalle dämpfen schwächer: Der Schaltabstand schrumpft um den <b>Reduktionsfaktor</b>.</p>
${SN}
<table><tr><th>Material</th><th>Faktor (Richtwert)</th><th>-B1 mit Sn 8 mm</th></tr>
<tr><td>Stahl</td><td>1,0</td><td>8 mm</td></tr><tr><td>Edelstahl</td><td>0,7</td><td>5,6 mm</td></tr>
<tr><td>Messing</td><td>0,5</td><td>4 mm</td></tr><tr><td>Aluminium</td><td>0,4</td><td>3,2 mm</td></tr></table>
<p>Die Faktoren sind <b>Richtwerte</b>. Jeder Hersteller gibt eigene an, sie stehen im Datenblatt.</p>
<h4>Einbauabstand: die 80-%-Regel</h4>
<p>Ein Sensor soll nicht am Rand seines Bereichs arbeiten: Temperatur, Exemplarstreuung und Vibration verschieben den Schaltpunkt. Faustregel: höchstens <b>80 %</b> des wirksamen Schaltabstands nutzen (die Norm nennt den gesicherten Schaltabstand Sa ≤ 0,81 · Sn).</p>
<p><code>Einbauabstand = 0,8 · Sn · Faktor</code>, z. B. Stahl: 0,8 · 8 mm · 1,0 = <b>6,4 mm</b>.</p>
<h4>Bündig oder nicht bündig</h4>
<ul><li><b>Bündig</b> (geschirmt): Der Sensor darf bündig in Metall eingebaut werden, das Feld tritt nur vorne aus. Kleinerer Schaltabstand.</li>
<li><b>Nicht bündig</b>: Der Kopf ragt vor, das Feld tritt auch seitlich aus. Grösserer Schaltabstand, braucht aber eine metallfreie Zone rundherum.</li></ul>
<h4>Kapazitive Sensoren</h4>
<p>Die aktive Fläche bildet mit der Umgebung einen Kondensator. Jedes Material mit höherer Dielektrizitätszahl als Luft verändert die Kapazität, also auch <b>Kunststoff, Glas, Holz und Wasser</b>. Wasser wirkt besonders stark.</p>
<ul><li>Die <b>Empfindlichkeit</b> stellt man mit dem <b>Poti</b> ein (Schraubendreher). Zu hoch: Der Sensor sieht auch das Band oder die Behälterwand. Zu niedrig: Kunststoff wird nicht erkannt.</li>
<li>Durch eine nichtmetallische <b>Behälterwand</b> hindurch lässt sich der Füllstand erkennen, etwa -B8 aussen an der Acrylwand. Das Poti wird so eingestellt, dass die leere Wand nicht schaltet, das Wasser dahinter aber schon.</li></ul>
<p><i>Vereinfachung: In der Werkstatt gelten feste Faktoren und 10 % Schalthysterese.</i></p>`,
  questions:[
    {type:'single', q:'-B1 (induktiv, Sn 8 mm) steht 3 mm über einem <b>Aluminium</b>teil. Schaltet er?', options:['Ja, Aluminium reicht bis 3,2 mm','Nein, Aluminium ist nicht magnetisch','Nein, Aluminium reicht nur bis 2 mm','Ja, alle Metalle reichen bis 8 mm'], correct:0,
     explain:'8 mm × 0,4 = 3,2 mm. 3 mm liegt knapp innerhalb – ohne Reserve. Induktive Sensoren erkennen alle Metalle, nicht nur magnetische.',
     verifyModel:{ detect:{ sensor:{ kind:'ind', sn:8 }, obj:{ material:'aluminium', dist:3 } }, expect:true }},
    {type:'input', q:'Einbauabstand für -B1 (Sn 8 mm) bei <b>Aluminium</b> mit der 80-%-Regel? (mm, zwei Nachkommastellen)', answer:['2.56','2,56','2.56 mm','2,56 mm','2.56mm','2,56mm'],
     explain:'0,8 · 8 mm · 0,4 = 2,56 mm.',
     verifyModel:{ calc:'(SM) => 0.8 * 8 * SM.MATERIALS.aluminium.ind', expect:2.56, tol:0.001 }},
    {type:'single', q:'Ein <b>Edelstahl</b>teil läuft 6 mm vor -B1 (Sn 8 mm) vorbei. Was passiert?', options:['Nicht erkannt – Edelstahl reicht nur bis 5,6 mm','Erkannt – Edelstahl ist Stahl','Erkannt, aber nur mit NPN','Der Sensor meldet einen Fehler'], correct:0,
     explain:'8 mm × 0,7 = 5,6 mm. 6 mm ist zu weit weg.',
     verifyModel:{ detect:{ sensor:{ kind:'ind', sn:8 }, obj:{ material:'edelstahl', dist:6 } }, expect:false }},
    {type:'single', q:'Was unterscheidet einen <b>nicht bündigen</b> Sensor von einem bündigen?', options:['Grösserer Schaltabstand, braucht aber eine metallfreie Zone um den Kopf','Er erkennt nur Kunststoff','Er darf bündig in eine Stahlplatte eingebaut werden','Er hat keinen Reduktionsfaktor'], correct:0,
     explain:'Beim nicht bündigen Sensor tritt das Feld auch seitlich aus: mehr Reichweite, aber umgebendes Metall würde ihn auslösen.'},
    {type:'single', q:'Der kapazitive Grenzschalter -B8 schaltet schon bei <b>leerem</b> Tank, weil er die Acrylwand erkennt. Was tust du?', options:['Empfindlichkeit am Poti verringern, bis nur das Wasser dahinter schaltet','Einen induktiven Sensor montieren','1M auf L+ legen','Den Sensor weiter weg montieren, bis er gar nichts mehr sieht'], correct:0,
     explain:'Zu hohe Empfindlichkeit erkennt auch die Wand. Weniger Empfindlichkeit: Nur das Wasser (stark wirksam) löst noch aus. Ein induktiver Sensor sieht kein Wasser.',
     verifyModel:{ detect:{ sensor:{ kind:'kap', sn:8, poti:0.8 }, obj:{ material:'acryl', dist:2 } }, expect:true }}
  ]});

defTheory({ id:'st3b', ch:3, pos:'mid', title:'Optisch und magnetisch', minutes:6,
  lesson:`
<h4>Drei optische Bauformen</h4>
<table><tr><th>Bauform</th><th>Aufbau</th><th>Stärken / Grenzen</th></tr>
<tr><td><b>Einweg-Lichtschranke</b></td><td>Sender und Empfänger getrennt, gegenüber</td><td>grösste Reichweite, sehr zuverlässig. Zwei Geräte, zwei Leitungen, genau ausrichten</td></tr>
<tr><td><b>Reflexions-Lichtschranke</b></td><td>Sender und Empfänger in einem Gehäuse, gegenüber ein <b>Reflektor</b></td><td>nur eine Leitung. Glänzende Teile können den Strahl selbst zurückspiegeln, dagegen hilft ein <b>Polarisationsfilter</b>. <b>Glas</b> wird unsicher erkannt</td></tr>
<tr><td><b>Lichttaster</b></td><td>Das Objekt selbst wirft das Licht zurück</td><td>kein Gegenstück nötig. Helle Teile werden weiter erkannt als dunkle</td></tr></table>
<h4>Hintergrundausblendung</h4>
<p>Ein Lichttaster mit <b>Hintergrundausblendung</b> misst, <b>aus welcher Entfernung</b> das Licht kommt, und nicht nur, wie viel. Per <b>Teach-in</b> lernt er die Entfernung zum Hintergrund, bei uns zum Band. Alles <b>davor</b> wird erkannt, das Band selbst nicht, egal wie hell. Wird falsch eingelernt, meldet der Taster dauernd oder nie.</p>
<h4>Hell- und dunkelschaltend</h4>
<ul><li><b>Hellschaltend</b>: Ausgang 1, wenn Licht auf den Empfänger fällt. Beim Taster heisst das: Objekt erkannt.</li>
<li><b>Dunkelschaltend</b>: Ausgang 1, wenn <b>kein</b> Licht ankommt. Bei einer Lichtschranke heisst das: Strahl unterbrochen, Objekt da.</li></ul>
<p>Welche Einstellung passt, hängt von der Bauform und vom Programm ab. Viele Sensoren lassen sich umschalten.</p>
<h4>Funktionsreserve</h4>
<p>Die <b>Funktionsreserve</b> sagt, wie viel mehr Licht ankommt, als zum Schalten nötig ist. Staub, Beschlag und leichte Dejustierung fressen Reserve. Viele Sensoren haben eine <b>Stabilitäts-LED</b>: Blinkt sie, reicht die Reserve kaum. Dann nachrichten und die Optik reinigen, bevor der Sensor im Betrieb aussetzt.</p>
<h4>Glas</h4>
<p>Klares Glas spiegelt, lässt viel Licht durch und kann die Polarisation verändern. Die Reflexions-Lichtschranke erkennt es darum <b>unsicher</b>. Bei der Einweg-Lichtschranke steht das Glas direkt im Strahl; in der Werkstatt erkennt sie Glas sicher. In der Praxis stellt man dafür die Empfindlichkeit passend ein oder nimmt spezielle Glas-Lichtschranken.</p>
<h4>Zylinderschalter (magnetisch)</h4>
<p>Im Kolben eines Pneumatikzylinders sitzt ein <b>Ringmagnet</b>. Ein Zylinderschalter in der <b>T-Nut</b> spürt ihn durch die Aluminiumwand: als <b>Reedkontakt</b> (zwei Kontaktzungen) oder als <b>magnetoresistiver</b> elektronischer Schalter (PNP, verschleissfrei). Einstellen: Zylinder in die Endlage fahren, Schalter verschieben, bis die LED sicher leuchtet, dann mit dem Schraubendreher <b>festklemmen</b>.</p>`,
  questions:[
    {type:'single', q:'Warum erkennt die Reflexions-Lichtschranke -B5 Glasteile nur unsicher?', options:['Glas lässt viel Licht durch, spiegelt und verändert die Polarisation – oft kommt trotzdem genug Licht zurück','Glas ist zu schwer','Glas ist elektrisch leitend','Die Lichtschranke ist NPN'], correct:0,
     explain:'Der Strahl wird kaum geschwächt oder sogar zurückgespiegelt. Der Empfänger „sieht“ dann den Reflektor weiter.'},
    {type:'single', q:'-B3 (Hintergrundausblendung) wurde per Teach-in auf das Band in 60 mm eingelernt. Erkennt er das leere Band?', options:['Nein, alles ab der eingelernten Entfernung wird ausgeblendet','Ja, das Band ist hell genug','Ja, aber nur bei dunklem Band','Nur wenn er dunkelschaltend ist'], correct:0,
     explain:'Genau dafür ist das Teach-in da: Das Band ist Hintergrund. Werkstücke liegen davor und werden erkannt.',
     verifyModel:{ detect:{ sensor:{ kind:'opt_bgs', sn:120, teach:60 }, obj:{ material:'band', dist:60 } }, expect:false }},
    {type:'single', q:'Ein <b>Lichttaster</b> ist <b>hellschaltend</b>. Wann ist sein Ausgang 1?', options:['Wenn ein Objekt Licht zurückwirft (Objekt erkannt)','Wenn kein Objekt davor ist','Immer, sobald er versorgt ist','Nur beim Teach-in'], correct:0,
     explain:'Hellschaltend = Ausgang 1 bei Licht am Empfänger. Beim Taster kommt Licht nur zurück, wenn ein Objekt davor ist.'},
    {type:'single', q:'Die Stabilitäts-LED der Einweg-Lichtschranke -B4 blinkt. Was bedeutet das?', options:['Die Funktionsreserve ist knapp – ausrichten und Optik reinigen','Alles bestens, der Sensor ist aktiv','Der Sensor ist NPN','Die SPS ist in STOP'], correct:0,
     explain:'Blinken heisst: Es kommt gerade noch genug Licht an. Schon etwas Staub würde reichen, dass er aussetzt.'},
    {type:'single', q:'Wie stellst du den Zylinderschalter -B7 auf die <b>vordere Endlage</b> ein?', options:['Zylinder ausfahren, Schalter in der Nut verschieben, bis die LED sicher leuchtet, dann festklemmen','Schalter irgendwo festklemmen und im Programm eine Verzögerung einbauen','Den Magneten im Kolben verschieben','Schaltabstand am Poti einstellen'], correct:0,
     explain:'Der Schalter muss dort sitzen, wo der Kolbenmagnet in der Endlage steht – und fest geklemmt sein, sonst wandert er.'}
  ]});
})();
