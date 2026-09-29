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

// Initiatorenklemme, 3 Ebenen
const TERM3 = svg(300, 140, '<rect x="120" y="10" width="70" height="120" rx="6" fill="#8f959c"/>'
  + [['L+', '#d23c3c', 'oben: L+ (über Querbrücker)'], ['S', '#ffd21e', 'Mitte: Signal → Eingang'], ['M', '#2f6fd0', 'unten: M (über Querbrücker)']].map((p, i) =>
    '<rect x="128" y="' + (18 + i * 38) + '" width="54" height="28" rx="4" fill="#d9dde2" stroke="' + p[1] + '" stroke-width="3"/>' + txt(155, 37 + i * 38, p[0], '#111', 13, 'middle') + txt(200, 37 + i * 38, p[2], '#d6dde6', 10)).join('')
  + '<circle cx="110" cy="70" r="6" fill="#ffd21e"/>' + txt(10, 74, 'gelbe LED', '#ffd21e', 10) + line(20, 32, 128, 32, '#8b5a2b') + line(20, 70, 104, 70, '#555') + line(20, 108, 128, 108, '#2f6fd0')
  + txt(10, 26, 'BN', '#e0b080', 10) + txt(10, 100, 'BU', '#7fb0ff', 10));

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
<div class="lb" data-lb="m12"></div>
<table><tr><th>Pin</th><th>Ader</th><th>Funktion</th></tr>
<tr><td>1</td><td>BN braun</td><td>L+ (+24 V)</td></tr><tr><td>2</td><td>WH weiss</td><td>zweiter Ausgang / NC</td></tr>
<tr><td>3</td><td>BU blau</td><td>M (0 V)</td></tr><tr><td>4</td><td>BK schwarz</td><td>Schaltsignal</td></tr></table>
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
<div class="lb" data-lb="stromfluss"></div>
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
<div class="lb" data-lb="stromfluss"></div>
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
<div class="lb" data-lb="schaltabstand" data-sn="8" data-kind="ind"></div>
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
<div class="lb" data-lb="schaltabstand" data-sn="8" data-kind="kap"></div>
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
// ---------- Modul 4: Analogsignale verstehen ----------
const LOOP2 = svg(560, 150,
  box(10, 50, 90, 50, '#d23c3c') + txt(55, 72, 'Netzteil', '#d6dde6', 11, 'middle') + txt(55, 90, 'L+ / M', '#ff8080', 11, 'middle')
  + box(170, 20, 110, 50, '#39a0ff') + txt(225, 42, 'Transmitter', '#d6dde6', 11, 'middle') + txt(225, 60, '+       −', '#ffffff', 12, 'middle')
  + box(370, 50, 150, 60, '#ffb000') + txt(445, 72, 'Analogeingang', '#d6dde6', 11, 'middle') + txt(445, 92, 'x+   Messwid.   x−', '#ffffff', 10, 'middle')
  + line(100, 60, 185, 60, '#d23c3c') + txt(120, 54, 'L+', '#ff8080', 10) + line(265, 60, 385, 60, '#39ff14') + txt(300, 54, 'T− → x+', '#39ff14', 10)
  + line(505, 100, 505, 130, '#2f6fd0') + line(505, 130, 55, 130, '#2f6fd0') + line(55, 130, 55, 100, '#2f6fd0') + txt(250, 145, 'x− → M: die Schleife ist geschlossen, derselbe Strom fliesst überall', '#7fb0ff', 10, 'middle'));

defTheory({ id:'st4a', ch:4, pos:'start', title:'Spannung und Strom', minutes:6,
  lesson:`
<p>Analoge Sensoren melden nicht nur „da / nicht da“, sondern <b>wie viel</b>: Abstand, Druck, Temperatur, Durchfluss. Dafür gibt es <b>Normsignale</b>, die jede SPS versteht.</p>
<table><tr><th>Signal</th><th>Messanfang → Messende</th><th>Kennlinie</th></tr>
<tr><td>0–10 V</td><td>0 V → 10 V</td><td>U = 10 V · (x − xmin) / (xmax − xmin)</td></tr>
<tr><td>0–20 mA</td><td>0 mA → 20 mA</td><td>I = 20 mA · (x − xmin) / (xmax − xmin)</td></tr>
<tr><td>4–20 mA</td><td>4 mA → 20 mA</td><td>I = 4 mA + 16 mA · (x − xmin) / (xmax − xmin)</td></tr></table>
<p>Beispiel -B11 (0–100 mbar, 4–20 mA): 50 mbar → 4 + 16 · 0,5 = <b>12 mA</b>. Beispiel -B10 (Ultraschall 60–800 mm, 0–10 V): 430 mm liegt genau in der Mitte → <b>5 V</b>.</p>
<h4>Live Zero</h4>
<p>Bei 4–20 mA fliesst schon am Messanfang Strom. Fliesst <b>gar keiner</b>, ist klar: Draht gebrochen, Versorgung weg oder Transmitter defekt. Bei 0–10 V und 0–20 mA sieht ein Drahtbruch genau so aus wie „Messwert null“. Dieser „lebende Nullpunkt“ heisst <b>Live Zero</b>.</p>
<h4>Störfestigkeit</h4>
<ul><li>Ein <b>Strom</b> ist in einer geschlossenen Schleife überall gleich gross. Leitungswiderstand und Übergangswiderstände ändern ihn nicht (solange die Bürde reicht). Darum nimmt man für lange Leitungen 4–20 mA.</li>
<li>Eine <b>Spannung</b> fällt an jedem Widerstand etwas ab, und eingekoppelte Störungen verfälschen sie leichter. 0–10 V eignet sich für kurze Wege im Schrank oder an der Maschine.</li></ul>
<h4>2-Leiter und 4-Leiter</h4>
<p>Ein <b>2-Leiter-Transmitter</b> hat nur + und −. Er holt sich seine Energie aus der Schleife und regelt den Strom. Die Versorgung liegt darum <b>in Reihe</b>:</p>
${LOOP2}
<p><code>L+ → Transmitter + ; Transmitter − → AI x+ ; AI x− → M</code></p>
<p>Ein <b>4-Leiter-Transmitter</b> hat eine eigene Versorgung (L+, M) und einen aktiven Stromausgang: <code>I+ → AI x+ ; I− → AI x−</code>. Ob die Analogbaugruppe eine 2-Leiter-Schleife selbst speisen kann, steht im Gerätehandbuch; in der Werkstatt tut die SM 1231 es nicht.</p>
<h4>Schirmung</h4>
<p>Analogleitungen sind <b>geschirmt</b>. Der Schirm wird grossflächig auf die Schirmschiene gelegt, und die Leitung läuft getrennt von Motorleitungen. Ohne Schirmauflage rauscht der Messwert in der Werkstatt sichtbar (Vereinfachung: echte EMV ist komplexer).</p>
<p><i>Werkmeister: „Spannung ist bequem. Strom ist ehrlich.“</i></p>`,
  questions:[
    {type:'input', q:'Drucktransmitter -B11: 0–100 mbar → 4–20 mA. Welcher Strom fliesst bei <b>50 mbar</b>? (mA)', answer:['12','12 mA','12mA','12,0','12.0'],
     explain:'4 mA + 16 mA · 50/100 = 12 mA.',
     verifyModel:{ calc:'(SM) => SM.signal("I4_20", 50, 0, 100)', expect:12, tol:0.001 }},
    {type:'input', q:'Ultraschall -B10: 60–800 mm → 0–10 V. Welche Spannung liefert er bei <b>430 mm</b>? (V)', answer:['5','5 V','5V','5,0','5.0'],
     explain:'(430 − 60) / (800 − 60) = 0,5 → 10 V · 0,5 = 5 V. Der Messbereich beginnt bei 60 mm, nicht bei 0.',
     verifyModel:{ calc:'(SM) => SM.signal("U0_10", 430, 60, 800)', expect:5, tol:0.001 }},
    {type:'single', q:'Warum beginnt das Stromsignal bei <b>4 mA</b> und nicht bei 0 mA?', options:['Damit ein Drahtbruch (0 mA) vom Messanfang unterscheidbar ist','Weil 0 mA nicht messbar ist','Damit der Sensor weniger Strom braucht','Das ist nur eine alte Gewohnheit'], correct:0,
     explain:'Live Zero: Messanfang = 4 mA. Kommt deutlich weniger an, stimmt etwas mit der Schleife nicht.'},
    {type:'single', q:'Wie wird ein <b>2-Leiter</b>-Transmitter an einen Analogeingang angeschlossen?', options:['L+ → Transmitter + ; Transmitter − → AI x+ ; AI x− → M','Transmitter + → AI x+ ; Transmitter − → AI x− ; keine Versorgung nötig','L+ → AI x+ ; AI x− → Transmitter + ; Transmitter − → L+','Transmitter + → L+ ; Transmitter − → M ; Signal über eine dritte Ader'], correct:0,
     explain:'Der 2-Leiter-Transmitter braucht die Versorgung in Reihe in seiner Schleife. Ohne L+ fliessen 0 mA: Drahtbruch.'},
    {type:'single', q:'Der Rohwert einer Analogleitung zappelt unruhig, der Schirm ist nicht aufgelegt. Was tust du zuerst?', options:['Schirm grossflächig auf die Schirmschiene legen','Die Glättung auf „stark“ stellen und fertig','Den Transmitter tauschen','Die Leitung neben die Motorleitung legen'], correct:0,
     explain:'Zuerst die Ursache beheben: Schirm auflegen, Leitung getrennt führen. Glätten versteckt das Rauschen nur und macht die Messung träge.'}
  ]});

defTheory({ id:'st4b', ch:4, pos:'mid', title:'Vom Signal zum Rohwert', minutes:6,
  lesson:`
<p>Die Analogbaugruppe wandelt Spannung oder Strom in eine Zahl um, den <b>Rohwert</b> (Datentyp Int, z. B. <code>%IW96</code>). Bei S7-1200/1500 gilt für den <b>Nennbereich</b> immer: Messanfang = <b>0</b>, Messende = <b>27648</b>.</p>
<div class="lb" data-lb="kennlinie" data-range="4..20mA" data-min="0" data-max="100" data-unit="mbar"></div>
<table><tr><th>4–20 mA</th><th>4</th><th>8</th><th>12</th><th>16</th><th>20</th></tr>
<tr><td>Rohwert</td><td>0</td><td>6912</td><td>13824</td><td>20736</td><td>27648</td></tr></table>
<p>Rechnung: <code>Rohwert = 27648 · (I − 4 mA) / 16 mA</code> bzw. bei 0–10 V <code>27648 · U / 10 V</code>.</p>
<h4>Ausserhalb des Nennbereichs</h4>
<table><tr><th>Bereich</th><th>4–20 mA</th><th>Rohwert</th><th>Bedeutung</th></tr>
<tr><td>Überlauf</td><td>ab ca. 22,96 mA</td><td>32767</td><td>zu gross, Wert ungültig</td></tr>
<tr><td>Übersteuerung</td><td>20 … ca. 22,81 mA</td><td>27649 … 32511</td><td>noch gemessen, aber über dem Messbereich</td></tr>
<tr><td>Nennbereich</td><td>4 … 20 mA</td><td>0 … 27648</td><td>gültig</td></tr>
<tr><td>Untersteuerung</td><td>ca. 1,185 … 4 mA</td><td>−1 … −4864</td><td>noch gemessen, unter dem Messbereich</td></tr>
<tr><td>Unterlauf / Drahtbruch</td><td>unter ca. 1,185 mA</td><td>−32768 bzw. 32767</td><td>ungültig</td></tr></table>
<h4>Diagnose</h4>
<p>In der Gerätesicht schaltest du je Kanal <b>Diagnosen</b> frei: Drahtbruch (nur bei 4–20 mA möglich), Überlauf, Unterlauf. Ist die Drahtbruchdiagnose an, liefert der Kanal in der Werkstatt bei unterbrochener Schleife <b>32767</b>, und im Diagnosepuffer steht der Kanal im Klartext. Ohne Diagnose kommt −32768. Welcher Sonderwert bei deiner echten Baugruppe erscheint, steht im Gerätehandbuch.</p>
<h4>Glättung</h4>
<p>Die Baugruppe kann Messwerte glätten: <b>keine / schwach / mittel / stark</b>. In der Werkstatt wirkt das wie ein Filter über etwa 1 / 4 / 16 / 32 Zyklen. Je stärker, desto ruhiger, aber auch desto <b>träger</b> folgt der Wert einer echten Änderung.</p>
<h4>Auflösung</h4>
<p>27648 heisst nicht, dass die Baugruppe 27648 Stufen unterscheidet. Die SM 1231 löst 12 Bit + Vorzeichen auf, die Onboard-Eingänge der CPU 10 Bit. Der Rohwert springt darum in Stufen von mehreren Einheiten. Für Anzeige und Regelung reicht das meist, für Feinmessungen braucht es eine höher auflösende Baugruppe.</p>`,
  questions:[
    {type:'input', q:'Kanal auf 4–20 mA konfiguriert. Welcher Rohwert erscheint bei <b>8 mA</b>?', answer:['6912'],
     explain:'27648 · (8 − 4) / 16 = 6912.',
     verifyModel:{ raw:{ kind:'I', value:8, range:'4..20mA' }, expect:6912 }},
    {type:'single', q:'Ein Kanal 4–20 mA mit freigeschalteter Drahtbruchdiagnose: Die Schleife ist offen (0 mA). Welchen Rohwert liefert er in der Werkstatt?', options:['32767','0','−4864','27648'], correct:0,
     explain:'Drahtbruch wird als Sonderwert 32767 (16#7FFF) gemeldet. 0 wäre gefährlich: Es sähe aus wie „Messanfang“.',
     verifyModel:{ raw:{ kind:'I', value:0, range:'4..20mA' }, expect:32767 }},
    {type:'single', q:'Am 4–20-mA-Kanal fliessen <b>21 mA</b>. Rohwert und Bereich?', options:['29376 – Übersteuerung','27648 – Nennbereich','32767 – Überlauf','−32768 – Unterlauf'], correct:0,
     explain:'27648 · 17/16 = 29376. Das liegt zwischen 27649 und 32511: Übersteuerung. Der Wert ist gemessen, aber über dem Messbereich des Sensors.',
     verifyModel:{ raw:{ kind:'I', value:21, range:'4..20mA' }, expect:29376 }},
    {type:'single', q:'Am 4–20-mA-Kanal fliessen <b>2 mA</b>. Was zeigt der Rohwert?', options:['−3456 – Untersteuerung','0 – Messanfang','32767 – Drahtbruch','6912 – ein Viertel'], correct:0,
     explain:'27648 · (2 − 4)/16 = −3456. 2 mA liegt über der Drahtbruchgrenze (ca. 1,185 mA), also Untersteuerung: noch gemessen, aber unter dem Messbereich.',
     verifyModel:{ raw:{ kind:'I', value:2, range:'4..20mA' }, expect:-3456 }},
    {type:'single', q:'Du stellst die Glättung von „keine“ auf „stark“. Was ändert sich?', options:['Der Wert wird ruhiger, folgt Änderungen aber langsamer','Die Auflösung wird feiner','Der Nennbereich wird grösser','Drahtbrüche werden nicht mehr gemeldet'], correct:0,
     explain:'Glättung mittelt über viele Zyklen. Ruhiger, aber träger – bei schnellen Vorgängen (Überlaufschutz!) vorsichtig einsetzen.'}
  ]});

// ---------- Modul 5: NORM_X und SCALE_X ----------
defTheory({ id:'st5a', ch:5, pos:'start', title:'Skalieren ist Geradengleichung', minutes:6,
  lesson:`
<p>Der Rohwert ist nur eine Zahl. Das HMI soll aber <b>mbar, °C oder mm</b> zeigen. Die Umrechnung ist eine <b>Gerade</b> durch zwei Punkte.</p>
<div class="lb" data-lb="kennlinie" data-range="4..20mA" data-min="0" data-max="100" data-unit="°C"></div>
<h4>Zwei Punkte genügen</h4>
<table><tr><th>Punkt</th><th>Rohwert</th><th>Temperatur -B12</th></tr>
<tr><td>Messanfang</td><td>Rmin = 0</td><td>Wmin = 0 °C</td></tr>
<tr><td>Messende</td><td>Rmax = 27648</td><td>Wmax = 100 °C</td></tr></table>
<p><code>Wert = Wmin + (Roh − Rmin) · (Wmax − Wmin) / (Rmax − Rmin)</code></p>
<ul><li><b>Steigung</b> = (Wmax − Wmin) / (Rmax − Rmin), hier 100 °C / 27648 ≈ 0,0036 °C pro Einheit.</li>
<li><b>Offset</b> = Wmin, der Wert beim Rohwert 0. Bei -B12 ist er 0 °C, beim Ultraschall -B10 (60–800 mm) aber <b>60 mm</b>.</li></ul>
<h4>Der Rechenweg in zwei Schritten</h4>
<ol><li><b>Normieren:</b> Anteil = (Roh − Rmin) / (Rmax − Rmin) → eine Zahl von 0,0 bis 1,0.</li>
<li><b>Skalieren:</b> Wert = Anteil · (Wmax − Wmin) + Wmin.</li></ol>
<p>Beispiel: Rohwert 6912 → Anteil 6912 / 27648 = 0,25 → 0,25 · 100 °C + 0 = <b>25 °C</b>.<br>
Beispiel -B10: Rohwert 13824 → Anteil 0,5 → 0,5 · (800 − 60) + 60 = <b>430 mm</b>.</p>
<h4>Typische Fehler</h4>
<ul><li>Offset vergessen: -B10 zeigt dann 370 statt 430 mm.</li>
<li>Falscher Messbereich konfiguriert: Steht ein 4–20-mA-Kanal auf 0–20 mA, liefern 4 mA schon den Rohwert 5530, und ein leerer Tank zeigt 20 %.</li>
<li>Ganzzahlig gerechnet: 6912 / 27648 ergibt in Int <b>0</b>. Normieren immer mit Real.</li></ul>`,
  questions:[
    {type:'input', q:'Temperatur -B12 (0–100 °C, 4–20 mA). Der Rohwert ist <b>6912</b>. Wie viel °C?', answer:['25','25 °C','25°C','25,0','25.0'],
     explain:'6912 / 27648 = 0,25 → 0,25 · 100 °C = 25 °C. Das entspricht 8 mA.',
     verifyModel:{ calc:'(SM) => SM.physical("I4_20", 8, 0, 100)', expect:25, tol:0.001 }},
    {type:'input', q:'Ultraschall -B10 (60–800 mm, 0–10 V). Der Rohwert ist <b>13824</b>. Welcher Abstand in mm?', answer:['430','430 mm','430mm'],
     explain:'Anteil 0,5 → 0,5 · (800 − 60) + 60 = 430 mm. Ohne Offset käme 370 heraus – falsch.',
     verifyModel:{ calc:'(SM) => SM.physical("U0_10", 5, 60, 800)', expect:430, tol:0.001 }},
    {type:'single', q:'Was ist der <b>Offset</b> der Geraden bei -B10 (60–800 mm)?', options:['60 mm – der Wert beim Rohwert 0','800 mm – das Messende','0 mm – wie immer','27648 – der Nennwert'], correct:0,
     explain:'Offset = Wert am Messanfang. Beim Ultraschall beginnt der Messbereich bei 60 mm (Blindzone davor).'},
    {type:'single', q:'Ein 4–20-mA-Sensor hängt an einem Kanal, der auf <b>0–20 mA</b> steht. Welchen Rohwert liefert er am Messanfang (4 mA)?', options:['5530 – das HMI zeigt 20 % statt 0 %','0 – alles in Ordnung','−4864 – Untersteuerung','32767 – Drahtbruch'], correct:0,
     explain:'Bei 0–20 mA gilt 27648 · 4 / 20 ≈ 5530. Der leere Tank erscheint als 20 %.',
     verifyModel:{ raw:{ kind:'I', value:4, range:'0..20mA' }, expect:5530 }},
    {type:'single', q:'Warum ergibt <code>"Roh" / 27648</code> mit zwei Int-Werten bei Rohwert 6912 den Wert 0?', options:['Ganzzahldivision schneidet die Nachkommastellen ab – normieren muss man in Real','Weil 27648 zu gross für Int ist','Weil der Rohwert negativ ist','Das Ergebnis ist 0,25 – der Fehler liegt woanders'], correct:0,
     explain:'Int / Int bleibt Int: 0,25 wird zu 0. NORM_X liefert deshalb immer einen Real-Wert.'}
  ]});

defTheory({ id:'st5b', ch:5, pos:'mid', title:'NORM_X, SCALE_X und Datentypen', minutes:7,
  lesson:`
<p>Die beiden Schritte aus Theorie A gibt es als fertige Anweisungen. Beide haben die Parameter <b>MIN, VALUE, MAX</b> in dieser Reihenfolge.</p>
<table><tr><th>Anweisung</th><th>rechnet</th><th>Ergebnis</th></tr>
<tr><td><code>NORM_X</code></td><td>(VALUE − MIN) / (MAX − MIN)</td><td>Real, 0,0 … 1,0</td></tr>
<tr><td><code>SCALE_X</code></td><td>VALUE · (MAX − MIN) + MIN</td><td>Real oder Int, je nach Zielvariable</td></tr></table>
<div class="lb" data-lb="kennlinie" data-range="4..20mA" data-min="0" data-max="100" data-unit="mbar"></div>
<h4>In SCL</h4>
<pre class="code">"Druck_Anteil" := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648);
"Druck_mbar"   := SCALE_X(MIN := 0.0, VALUE := "Druck_Anteil", MAX := 100.0);</pre>
<h4>In FUP</h4>
<pre class="kop">NETWORK Druck normieren
=> NORM_X(0, Druck_Roh, 27648, Druck_Anteil);
NETWORK Druck skalieren
=> SCALE_X(0.0, Druck_Anteil, 100.0, Druck_mbar);</pre>
<h4>Datentypen und Einheiten</h4>
<ul><li>Rohwert: <b>Int</b>. Anteil: <b>Real</b>. Physikalischer Wert: meist <b>Real</b> (mbar, °C, mm).</li>
<li>Die Einheit steckt in MIN und MAX von SCALE_X. Wer 0.0 … 100.0 einträgt, bekommt mbar; mit 0.0 … 0.1 wären es bar.</li>
<li>Sprechende Namen mit Einheit helfen: <code>Druck_mbar</code>, <code>Temp_C</code>, <code>Pegel_mm</code>.</li></ul>
<h4>Werte ausserhalb</h4>
<p>NORM_X und SCALE_X <b>begrenzen nicht</b>. Der Sonderwert 32767 ergibt einen Anteil von etwa 1,185 und bei -B12 die Anzeige <b>118,5 °C</b> – obwohl in Wahrheit ein Draht gebrochen ist. Darum Sonderwerte <b>vor</b> dem Skalieren abfangen.</p>
<h4>Analogausgabe: rückwärts</h4>
<p>Für einen Ausgang dreht man die Reihenfolge um: erst den Sollwert normieren, dann auf den Rohwertbereich skalieren, und zwar in ein <b>Int</b>.</p>
<pre class="code">"Pumpe_Anteil"   := NORM_X(MIN := 0.0, VALUE := "Pumpe_Prozent", MAX := 100.0);
"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := "Pumpe_Anteil", MAX := 27648);   // Int → %QW112</pre>
<p>75 % → Anteil 0,75 → Rohwert 20736. Auf einem 4–20-mA-Ausgang sind das 16 mA, auf 0–10 V 7,5 V.</p>`,
  questions:[
    {type:'single', q:'In welcher Reihenfolge stehen die Parameter von NORM_X und SCALE_X?', options:['MIN, VALUE, MAX','VALUE, MIN, MAX','MAX, MIN, VALUE','IN, OUT, RANGE'], correct:0,
     explain:'Bei beiden Anweisungen: MIN, VALUE, MAX. In SCL übergibt man sie mit Namen, in FUP stehen sie an der Box.'},
    {type:'single', q:'Welchen Datentyp braucht die Zwischenvariable <code>"Druck_Anteil"</code> hinter NORM_X?', options:['Real','Int','Bool','Word'], correct:0,
     explain:'NORM_X liefert 0,0 … 1,0 – das passt nur in einen Gleitpunkttyp.'},
    {type:'input', q:'Temperatur -B12 (0–100 °C): Der Kanal meldet den Sonderwert <b>32767</b>, das Programm skaliert ihn ungeprüft. Welche Temperatur zeigt das HMI? (°C, eine Nachkommastelle)', answer:['118.5','118,5','118.5 °C','118,5 °C'],
     explain:'32767 / 27648 ≈ 1,185 → 118,5 °C. NORM_X/SCALE_X begrenzen nicht – Sonderwerte vorher abfangen!',
     verifyModel:{ calc:'(SM) => SM.RAW.OVERFLOW / SM.RAW.NOM * 100', expect:118.5, tol:0.05 }},
    {type:'input', q:'Das Stellventil -MB5 hängt an einem Ausgang 4–20 mA. Das Programm schreibt den Rohwert <b>20736</b>. Welcher Strom fliesst? (mA)', answer:['16','16 mA','16mA','16,0','16.0'],
     explain:'20736 / 27648 = 0,75 → 4 mA + 0,75 · 16 mA = 16 mA.',
     verifyModel:{ calc:'(SM) => SM.aqSignal(20736, { range: "4..20mA" })', expect:16, tol:0.001 }},
    {type:'single', q:'Wie rechnest du einen Pumpensollwert in Prozent auf den Analogausgang %QW112 um?', options:['NORM_X auf 0.0…100.0 %, dann SCALE_X auf 0…27648 in ein Int','SCALE_X auf 0…100 %, dann NORM_X auf 27648','Den Prozentwert direkt auf %QW112 schreiben','NORM_X auf 0…27648, dann SCALE_X auf 0.0…100.0'], correct:0,
     explain:'Rückwärts: erst den Sollwert normieren, dann auf den Rohwertbereich skalieren. Das Ausgangswort ist ein Int.'}
  ]});

// ---------- Modul 6: Messwerte sicher verarbeiten ----------
const HYSTSVG = svg(560, 160, txt(10, 16, 'Heizung mit Hysterese: Ein unter 58 °C, Aus über 62 °C', '#ffb000', 11)
  + line(40, 50, 540, 50, '#d23c3c', 1) + txt(544, 54, '62', '#ff8080', 10) + line(40, 80, 540, 80, '#39a0ff', 1) + txt(544, 84, '58', '#7fb0ff', 10)
  + '<path d="M40 100 C100 90 130 60 170 48 C200 44 230 70 260 82 C290 90 320 60 360 48 C390 44 430 70 460 82 C490 88 520 70 540 60" stroke="#d6dde6" stroke-width="2" fill="none"/>'
  + '<path d="M40 140 H170 V150 H260 V140 H360 V150 H460 V140 H540" stroke="#39ff14" stroke-width="2" fill="none"/>' + txt(44, 134, 'Heizung ein', '#39ff14', 10) + txt(180, 146, 'aus', '#39ff14', 10));

defTheory({ id:'st6a', ch:6, pos:'start', title:'Grenzwerte und Hysterese', minutes:6,
  lesson:`
<p>Aus Messwerten werden Entscheidungen: Heizung ein, Pumpe aus, Lampe rot. Dafür vergleicht das Programm mit <b>Grenzwerten</b>.</p>
<h4>Das Flattern</h4>
<p>Ein Messwert zittert immer ein wenig (Rauschen, Wellen im Tank). Schaltet man bei <b>genau einem</b> Grenzwert, schaltet der Ausgang an der Grenze im Sekundentakt ein und aus. Schütze, Ventile und Pumpen verschleissen dabei schnell.</p>
<h4>Hysterese</h4>
<p>Man trennt Ein- und Ausschaltpunkt. Dazwischen bleibt der Ausgang, wie er ist:</p>
${HYSTSVG}
<pre class="code">IF "Temp_C" < 58.0 THEN
    "Heizung" := TRUE;
ELSIF "Temp_C" > 62.0 THEN
    "Heizung" := FALSE;
END_IF;   // zwischen 58 und 62 °C: kein Befehl, Zustand bleibt</pre>
<pre class="kop">NETWORK Heizung ein
[Temp_C < 58.0] => S Heizung;
NETWORK Heizung aus
[Temp_C > 62.0] => R Heizung;</pre>
<p>Auch digitale Sensoren haben eine eingebaute <b>Schalthysterese</b>: -B1 schaltet bei Stahl ab 8 mm ein, aber erst ab etwa 8,8 mm wieder aus (Werkstatt: 10 %).</p>
<h4>Warn- und Alarmgrenzen</h4>
<table><tr><th>Stufe</th><th>Beispiel Füllstand</th><th>Reaktion</th></tr>
<tr><td>Alarm hoch (HH)</td><td>&gt; 560 mm</td><td>Zulauf sofort zu, Hupe, rote Lampe</td></tr>
<tr><td>Warnung hoch (H)</td><td>&gt; 500 mm</td><td>Meldung, gelbe/blinkende Lampe</td></tr>
<tr><td>Warnung tief (L)</td><td>&lt; 100 mm</td><td>Meldung</td></tr>
<tr><td>Alarm tief (LL)</td><td>&lt; 60 mm</td><td>Pumpe/Heizung aus (Trockenlauf)</td></tr></table>
<p>Jede Grenze bekommt ihre eigene Hysterese, sonst flattern die Meldungen.</p>
<h4>Meldungen</h4>
<ul><li>Eine Meldung ist <b>kommend</b>, solange die Bedingung ansteht, und <b>gehend</b>, wenn sie wegfällt.</li>
<li>Alarme bleiben oft <b>gespeichert</b>, bis jemand sie <b>quittiert</b>: So geht ein kurzer Alarm in der Nacht nicht verloren.</li>
<li>Der Text sagt, was los ist und wo: „Tank: Füllstand zu hoch (-B10)“ statt „Fehler 17“.</li></ul>`,
  questions:[
    {type:'single', q:'Die Heizung schaltet im Sekundentakt ein und aus, die Temperatur steht bei 60 °C. Was fehlt?', options:['Eine Hysterese: getrennte Ein- und Ausschaltpunkte','Eine stärkere Heizung','Ein zweiter Temperaturfühler','Ein Zähler'], correct:0,
     explain:'Mit nur einem Grenzwert flattert der Ausgang am Schaltpunkt. Hysterese = Abstand zwischen Ein und Aus.'},
    {type:'single', q:'Heizung: Ein unter 58 °C, Aus über 62 °C. Die Heizung ist <b>aus</b>, das Wasser kühlt auf 60 °C ab. Was passiert?', options:['Nichts – die Heizung bleibt aus, bis 58 °C unterschritten sind','Die Heizung schaltet ein','Die Heizung schaltet im Takt','Die CPU meldet einen Fehler'], correct:0,
     explain:'Zwischen den beiden Grenzen gibt es keinen Befehl. Der letzte Zustand bleibt.'},
    {type:'single', q:'-B1 (induktiv, Sn 8 mm, 10 % Hysterese) hat ein Stahlteil erkannt. Das Teil entfernt sich auf <b>8,5 mm</b>. Was meldet der Sensor?', options:['Weiterhin 1 – er schaltet erst ab ca. 8,8 mm aus','0 – über 8 mm ist Schluss','Er flattert','Er meldet einen Fehler'], correct:0,
     explain:'Einschalten bis 8 mm, Ausschalten erst ab 8 mm · 1,1 = 8,8 mm. So flattert der Sensor an der Grenze nicht.',
     verifyModel:{ calc:'(SM) => SM.detects({ kind: "ind", sn: 8 }, { material: "stahl", dist: 8.5 }, { on: true })', expect:true }},
    {type:'single', q:'Wozu dient eine <b>Warngrenze</b> vor der Alarmgrenze?', options:['Das Personal kann eingreifen, bevor die Anlage abschalten muss','Sie ersetzt die Hysterese','Damit die Hupe öfter ertönt','Sie ist nur für das HMI-Design'], correct:0,
     explain:'Warnung = früh informieren. Alarm = handeln oder abschalten.'},
    {type:'single', q:'Warum speichert man einen Alarm, bis er <b>quittiert</b> wird?', options:['Damit auch ein kurzer Alarm bemerkt wird, wenn gerade niemand hinschaut','Damit die Lampe länger hält','Weil die SPS sonst in STOP geht','Das ist nicht üblich'], correct:0,
     explain:'Ein Überlauf um 3 Uhr morgens soll am Morgen noch sichtbar sein – bis ihn jemand bewusst quittiert.'}
  ]});

defTheory({ id:'st6b', ch:6, pos:'mid', title:'Kalibrieren und Plausibilität', minutes:7,
  lesson:`
<p>Ein skalierter Messwert ist erst dann gut, wenn er mit der <b>Wirklichkeit</b> übereinstimmt. Die Messkette hat kleine Fehler: Sensor, Einbau, Baugruppe.</p>
<h4>Offset korrigieren</h4>
<p>Der Tank ist leer, das HMI zeigt aber 12 mm. Das ist ein <b>Nullpunktfehler (Offset)</b>. Die einfachste Korrektur: den Offset abziehen.</p>
<pre class="code">"Pegel_mm" := "Pegel_roh_mm" - 12.0;   // Offset bei leerem Tank gemessen</pre>
<h4>2-Punkt-Kalibrierung</h4>
<p>Stimmt auch die Steigung nicht, nimmt man <b>zwei bekannte Punkte</b>, möglichst weit auseinander, z. B. 100 mm und 500 mm laut Massstab am Tank:</p>
<table><tr><th>Punkt</th><th>Massstab</th><th>Rohwert abgelesen</th></tr>
<tr><td>1</td><td>100 mm</td><td>5000</td></tr><tr><td>2</td><td>500 mm</td><td>25000</td></tr></table>
<p>Diese Werte kommen direkt in NORM_X und SCALE_X:</p>
<pre class="code">"Anteil"   := NORM_X(MIN := 5000, VALUE := "Pegel_Roh", MAX := 25000);
"Pegel_mm" := SCALE_X(MIN := 100.0, VALUE := "Anteil", MAX := 500.0);</pre>
<p>Rohwert 15000 → Anteil 0,5 → <b>300 mm</b>. Danach an einem dritten Punkt kontrollieren.</p>
<h4>Gleitender Mittelwert</h4>
<p>Gegen Rauschen mittelt man die letzten n Werte, z. B. 8. Jeder Zyklus: ältesten Wert raus, neuen rein, Summe / 8. Wie die Glättung der Baugruppe macht das den Wert ruhiger, aber auch <b>träger</b>. In der Werkstatt dauert ein Zyklus 50 ms, 8 Werte sind also 0,4 s Verzögerung.</p>
<h4>Plausibilität</h4>
<ul><li><b>Sonderwerte</b> zuerst: 32767 / −32768 → ungültig, nicht skalieren.</li>
<li><b>Bereich</b>: Ein Tank mit 600 mm Höhe hat keinen Pegel von 900 mm.</li>
<li><b>Änderungsgeschwindigkeit</b>: Ein Pegel springt nicht in einem Zyklus um 200 mm.</li>
<li><b>Zwei Messprinzipien vergleichen</b>: Der Druck am Tankboden ist p = ρ · g · h. 500 mm Wasser ergeben etwa <b>49 mbar</b>. Der Ultraschall (Einbauhöhe 800 mm) misst dann 300 mm Abstand, also ebenfalls 500 mm Pegel. Weichen beide stark ab (z. B. mehr als 5 %), stimmt einer nicht: Meldung!</li></ul>
<p><i>ARIA: „Zwei Sensoren, zwei Meinungen. Ich liebe Demokratie.“ – Werkmeister: „Darum entscheidet die SPS, nicht du.“</i></p>`,
  questions:[
    {type:'single', q:'Bei leerem Tank zeigt das HMI 12 mm. Was ist das, und wie korrigierst du es am einfachsten?', options:['Ein Offset – 12 mm vom Messwert abziehen','Ein Steigungsfehler – mit 12 multiplizieren','Rauschen – Glättung auf stark','Drahtbruch – Transmitter tauschen'], correct:0,
     explain:'Ein konstanter Fehler am Nullpunkt ist ein Offset. Er wird einfach abgezogen.'},
    {type:'input', q:'2-Punkt-Kalibrierung: Rohwert 5000 = 100 mm, Rohwert 25000 = 500 mm. Welcher Pegel gehört zum Rohwert <b>15000</b>? (mm)', answer:['300','300 mm','300mm'],
     explain:'Anteil (15000 − 5000) / (25000 − 5000) = 0,5 → 100 + 0,5 · 400 = 300 mm.'},
    {type:'input', q:'Welcher hydrostatische Druck herrscht am Boden bei <b>500 mm</b> Wasserstand? (mbar, ganze Zahl gerundet)', answer:['49','49 mbar','49mbar','49,05','49.05'],
     explain:'p = ρ · g · h = 1000 kg/m³ · 9,81 m/s² · 0,5 m ≈ 4905 Pa ≈ 49 mbar.',
     verifyModel:{ calc:'(SM) => Math.round(SM.TANK.rho * SM.TANK.g * 0.5 / 100)', expect:49 }},
    {type:'single', q:'Ein gleitender Mittelwert über 8 Werte bei 50 ms Zyklus. Welcher Nachteil entsteht?', options:['Der Wert reagiert rund 0,4 s verzögert auf echte Änderungen','Die Auflösung sinkt auf 8 Bit','Sonderwerte werden automatisch erkannt','Keiner'], correct:0,
     explain:'8 · 50 ms = 0,4 s. Ruhiger, aber träger – bei Grenzwerten für den Überlaufschutz einplanen.',
     verifyModel:{ calc:'(SM) => 8 * SM.DT', expect:0.4, tol:0.0001 }},
    {type:'single', q:'Ultraschall meldet 500 mm Pegel, der Drucktransmitter nur 20 mbar. Was schliesst du?', options:['Nicht plausibel – ein Messwert stimmt nicht, Meldung ausgeben und prüfen','Alles in Ordnung, Druck und Pegel haben nichts miteinander zu tun','Den Mittelwert beider Werte anzeigen','Den Drucktransmitter ignorieren'], correct:0,
     explain:'500 mm Wasser ergeben etwa 49 mbar. 20 mbar passt nicht dazu – die Anlage muss das melden, statt einfach weiterzurechnen.'}
  ]});
})();
