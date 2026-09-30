/* ===== SENSORWERKSTATT: Handbuch =====
   Einträge { id, title, html }. Aufgaben verweisen über man: '<id>' darauf.
   Werte mit [prüfen] im Faktenblatt (docs/SENSORWERKSTATT_FAKTEN.md) sind im Text als „laut Gerätehandbuch prüfen“ gekennzeichnet. */
(function(root){
const PRUEFEN = '<i>(laut Gerätehandbuch prüfen)</i>';
const M = [
{ id:'einfuehrung', title:'Einführung & Bedienung', html:`
<h3>Willkommen in der Sensorwerkstatt</h3>
<p>ARIA hat der Fabrik die Sinne verwirrt. Im Untergeschoss steht der <b>Prüfstand</b> des Werkmeisters: eine Sortierstrecke, eine Tankstation, ein Bedienpult und ein Schaltschrank mit einer S7-1200. Jeder Sensor muss hier auf den Prüfstand, bevor er zurück in die Anlage darf. Du montierst, steckst an, legst auf, misst, konfigurierst, lädst und beobachtest, so wie in der Praxis.</p>
<h3>Ansichten (Tasten 1–7)</h3>
<table><tr><th>Taste</th><th>Ansicht</th></tr>
<tr><td>1</td><td>Übersicht</td></tr><tr><td>2</td><td>Sortierstrecke</td></tr><tr><td>3</td><td>Bedienpult</td></tr><tr><td>4</td><td>Tankstation</td></tr>
<tr><td>5</td><td>Schaltschrank (Tür öffnet automatisch)</td></tr><tr><td>6</td><td>Klemmleiste nah, gerade von vorn</td></tr><tr><td>7</td><td>Engineering-Laptop</td></tr></table>
<p>In jeder Ansicht kannst du begrenzt drehen und zoomen. Ein Doppelklick auf ein Bauteil fährt nah heran.</p>
<h3>Werkzeuge</h3>
<table><tr><th>Werkzeug</th><th>Wofür</th></tr>
<tr><td>Hand</td><td>bedienen, Teile vorbeiführen, Stecker anstecken, Tür öffnen, Schalter betätigen</td></tr>
<tr><td>Schraubendreher</td><td>Adern lösen (Drücker der Push-in-Klemme), Poti einstellen, Trennmesser öffnen, Zylinderschalter festklemmen</td></tr>
<tr><td>Gabelschlüssel</td><td>Kontermuttern am Sensorhalter lösen und festziehen</td></tr>
<tr><td>Crimpzange</td><td>Aderendhülsen aufpressen</td></tr>
<tr><td>Multimeter</td><td>Spannung, Strom, Widerstand und Durchgang messen (siehe „Multimeter und Kalibrator“)</td></tr>
<tr><td>Kalibrator</td><td>Strom 0–24 mA in einen Analogkanal einspeisen (Loop-Check)</td></tr></table>
<h3>Verdrahten: Antippen – Antippen</h3>
<p>Ader antippen, dann die Klemmstelle antippen: fertig, kein Ziehen nötig. Dieselbe Verbindung noch einmal antippen löst sie wieder. Die Klemmstelle leuchtet auf, bevor du sie wählst. Rückgängig/Wiederholen und „Alle Adern dieses Sensors lösen“ findest du in der Leiste. Aderfarben sind immer zusätzlich beschriftet (BN, BU, BK, WH).</p>
<h3>Detailkarte und Röntgen</h3>
<ul><li><b>Detailkarte:</b> Überfahren zeigt BMK, Name und Zustand, ein Klick öffnet die Detailkarte mit Typenschild, Datenblatt, Anschlussbild (M12-Belegung) und aktuellen Werten.</li>
<li><b>Röntgen:</b> blendet Erfassungsbereiche (Schaltabstand, Lichtstrahl, Schallkegel) und den Stromfluss als Leuchtpfad in den Leitungen ein. In Prüfungsaufgaben ist Röntgen aus.</li></ul>
<h3>Engineering-Laptop</h3>
<p>Die Oberfläche ist an die Arbeitsweise im TIA Portal angelehnt. Die Begriffe stimmen, das Aussehen ist eigenständig.</p>
<table><tr><th>Reiter</th><th>Inhalt</th></tr>
<tr><td>Gerätesicht</td><td>Rack mit CPU und Modulen. Modul anklicken → Eigenschaften: Eingangsverzögerung, Messart und Messbereich der AI-Kanäle, Glättung, Diagnose, Ausgabeart der AQ-Kanäle, Ersatzwert bei STOP</td></tr>
<tr><td>PLC-Variablen</td><td>Name, Datentyp, Adresse, Kommentar. Doppelte Namen oder Adressen werden gemeldet</td></tr>
<tr><td>Programm</td><td>OB1 in SCL oder FUP (Umschalter oben)</td></tr>
<tr><td>Beobachtung</td><td>Variablen und Adressen live, Rohwerte dezimal und hexadezimal, Trendkurve für Analogwerte</td></tr>
<tr><td>Diagnose</td><td>Diagnosepuffer im Klartext (z. B. „Kanal 1: Drahtbruch“) und Modulzustand</td></tr></table>
<p><b>Laden:</b> „In Gerät laden“ übersetzt Programm und Konfiguration, die CPU geht kurz in STOP und danach wieder in RUN. Die LEDs am Modell wechseln. Nach jeder Änderung der Gerätekonfiguration musst du neu laden.</p>
<h3>2D-Modus</h3>
<p>Für schwache Geräte und für die Bedienung per Tastatur gibt es eine schematische 2D-Ansicht von Klemmleiste und Anlage. Die Bedienung ist dieselbe (Tab/Pfeile wählen, Enter legt auf). Alle Aufgaben sind auch in 2D lösbar.</p>
<h3>Realitätsstufen</h3>
<table><tr><th></th><th>Schnell</th><th>Werkstatt</th><th>Profi</th></tr>
<tr><td>Aderendhülsen</td><td>automatisch</td><td>selbst crimpen</td><td>selbst crimpen</td></tr>
<tr><td>Querbrücker L+/M</td><td>vorhanden</td><td>selbst setzen</td><td>selbst setzen</td></tr>
<tr><td>Leitung verlegen</td><td>automatisch</td><td>automatisch</td><td>Einführung wählen, Schirm auflegen</td></tr>
<tr><td>Beschriftung</td><td>automatisch</td><td>automatisch</td><td>selbst, muss passen</td></tr>
<tr><td>Spannungsfreiheit</td><td>Hinweis</td><td>Warnung + Minuspunkt</td><td>Pflicht</td></tr>
<tr><td>Prüfen vor dem Einschalten</td><td>freiwillig</td><td>empfohlen</td><td>Pflicht</td></tr></table>
<p>Jede Aufgabe verlangt eine Mindeststufe. Eine höhere Stufe gibt Bonuspunkte.</p>
<h3>Arbeitsschritte und „Prüfen“</h3>
<p>Rechts steht die Liste der <b>Arbeitsschritte</b>. Ein Haken zeigt, was schon passt. „Prüfen“ bewertet die elektrische Funktion, nicht die exakte Klemme, und meldet Abweichungen in Fachsprache, zum Beispiel „-X2:5: zwei Leiter an einer Klemmstelle“. Die Lösung verrät es dir nicht.</p>
<h3>Vereinfachungen</h3>
<p>Die Werkstatt ist so nah an der Praxis wie möglich. Wo sie vereinfacht, steht es hier:</p>
<ul><li>Der Kalibrator unterscheidet Quelle und Senke nur vereinfacht.</li>
<li>Fehlt der Schirm, rauscht der Rohwert um etwa ±1–2 %. Echte EMV-Effekte sind viel komplexer und werden nicht nachgebildet.</li>
<li>Digitale Sensoren haben einheitlich 10 % Schalthysterese.</li>
<li>Die Reduktionsfaktoren der induktiven Sensoren sind Richtwerte. Im echten Datenblatt stehen die Werte des Herstellers.</li>
<li>Der Not-Halt wirkt real über das Sicherheitsrelais -K0; die SPS erhält nur eine Meldung. Sicherheitstechnik ist nicht Thema der Werkstatt.</li>
<li>Klemmenbezeichnungen, Gruppen und Sonderwerte der Module folgen dem Faktenblatt; wo das Spiel davon abweicht, steht es in den Abweichungen. Im Zweifel gilt das Gerätehandbuch.</li></ul>` },

{ id:'klemmenplan', title:'Adress- und Klemmenplan', html:`
<h3>Grundbelegung</h3>
<p>Dieser Plan hängt auch als Blatt am Schrank. Aufgaben können davon abweichen; dann gilt das Aufgabenblatt.</p>
<h3>Digitaleingänge</h3>
<table><tr><th>Adresse</th><th>Variable</th><th>BMK</th><th>Signal</th><th>Klemme</th></tr>
<tr><td>%I0.0</td><td>Start</td><td>-S1</td><td>NO</td><td>-X2:1</td></tr>
<tr><td>%I0.1</td><td>Stopp</td><td>-S2</td><td>NC</td><td>-X2:2</td></tr>
<tr><td>%I0.2</td><td>NotHalt_Meldung</td><td>-S3</td><td>NC (Kanal 2)</td><td>-X2:3</td></tr>
<tr><td>%I0.3</td><td>Auto</td><td>-S4</td><td>NO</td><td>-X2:4</td></tr>
<tr><td>%I0.4</td><td>Ind_Metall</td><td>-B1</td><td>PNP NO</td><td>-X2:5</td></tr>
<tr><td>%I0.5</td><td>Kap_Teil</td><td>-B2</td><td>PNP NO</td><td>-X2:6</td></tr>
<tr><td>%I0.6</td><td>Taster_Hell</td><td>-B3</td><td>PNP</td><td>-X2:7</td></tr>
<tr><td>%I0.7</td><td>LS_Band</td><td>-B4.2</td><td>PNP</td><td>-X2:8</td></tr>
<tr><td>%I1.0</td><td>Rutsche_Voll</td><td>-B5</td><td>PNP</td><td>-X2:9</td></tr>
<tr><td>%I1.1</td><td>Zyl_Hinten</td><td>-B6</td><td>PNP</td><td>-X2:10</td></tr>
<tr><td>%I1.2</td><td>Zyl_Vorne</td><td>-B7</td><td>PNP</td><td>-X2:11</td></tr>
<tr><td>%I1.3</td><td>Haube_Zu</td><td>-S5</td><td>NC</td><td>-X2:12</td></tr>
<tr><td>%I1.4</td><td>Tank_Nicht_Voll</td><td>-B8</td><td>PNP, als NC</td><td>-X2:13</td></tr>
<tr><td>%I1.5</td><td>Vorrat_Ok</td><td>-B9</td><td>Reed</td><td>-X2:14</td></tr>
<tr><td>%I16.0–%I16.7</td><td>frei / Übungen</td><td>-A4 (SM 1221)</td><td>NPN-Gruppe, antivalente Sensoren</td><td>-X2:21…28</td></tr></table>
<p>Die Signalebenen -X2:1…14 sind zur CPU vorverdrahtet (DIa .0–.7 = %I0.0–%I0.7, DIb .0–.5 = %I1.0–%I1.5), -X2:21…28 zur SM 1221.</p>
<h3>Analog</h3>
<table><tr><th>Adresse</th><th>Variable</th><th>BMK</th><th>Signal</th></tr>
<tr><td>%IW64</td><td>Abstand_Roh</td><td>-B10</td><td>0–10 V, CPU AI0</td></tr>
<tr><td>%IW66</td><td>Sollwert_Roh</td><td>-R1</td><td>0–10 V, CPU AI1</td></tr>
<tr><td>%IW96</td><td>Druck_Roh</td><td>-B11</td><td>4–20 mA, 2-Leiter, SM 1231 Kanal 0</td></tr>
<tr><td>%IW98</td><td>Temp_Roh</td><td>-B12</td><td>4–20 mA, 2-Leiter, Kanal 1</td></tr>
<tr><td>%IW100</td><td>Durchfluss_Roh</td><td>-B13</td><td>4–20 mA, 4-Leiter, Kanal 2</td></tr>
<tr><td>%IW102</td><td>Reserve_Roh</td><td>—</td><td>Kanal 3 / Kalibrator</td></tr>
<tr><td>%QW112</td><td>Pumpe_Soll_Roh</td><td>-T2</td><td>0–10 V, SM 1232 Kanal 0</td></tr>
<tr><td>%QW114</td><td>Ventil_Soll_Roh</td><td>-MB5</td><td>4–20 mA, Kanal 1</td></tr></table>
<p>Die Analogleitungen laufen über die Trennklemmen <b>-X3</b> mit Messbuchsen und Schirmauflage. Welche -X3-Klemme zu welchem Kanal gehört, steht im Aufgabenblatt.</p>
<h3>Ausgänge</h3>
<table><tr><th>Adresse</th><th>Variable</th><th>BMK</th></tr>
<tr><td>%Q0.0</td><td>Band</td><td>-K1</td></tr><tr><td>%Q0.1</td><td>Vereinzeler</td><td>-MB1</td></tr>
<tr><td>%Q0.2</td><td>Auswerfer</td><td>-MB2</td></tr><tr><td>%Q0.3</td><td>Pumpe_Frei</td><td>-K2</td></tr>
<tr><td>%Q0.4</td><td>Ablauf</td><td>-MB3</td></tr><tr><td>%Q0.5</td><td>Heizung</td><td>-K3</td></tr>
<tr><td>%Q0.6</td><td>Lampe_Gruen</td><td>-P1</td></tr><tr><td>%Q0.7</td><td>Lampe_Rot</td><td>-P2</td></tr>
<tr><td>%Q1.0</td><td>Hupe</td><td>-P3</td></tr><tr><td>%Q1.1</td><td>Zulauf</td><td>-MB4</td></tr></table>
<h3>Klemmleisten</h3>
<table><tr><th>Leiste</th><th>Aufgabe</th></tr>
<tr><td>-X1</td><td>Versorgungsverteiler L+1…8 (rot) und M1…8 (blau), über -F2 abgesichert</td></tr>
<tr><td>-X2</td><td>3-Stock-Initiatorenklemmen mit LED für digitale Sensoren</td></tr>
<tr><td>-X3</td><td>Trennklemmen mit Messbuchsen und Schirmauflage für Analogsignale</td></tr>
<tr><td>-X4</td><td>Aktoren</td></tr></table>
<h3>Warum diese Adressen?</h3>
<p>Das TIA Portal vergibt beim Stecken eines Moduls Standardadressen: die Onboard-Eingänge ab %I0.0, die Onboard-Analogeingänge ab %IW64. Die Adressen der Signalmodule hängen vom Steckplatz ab ${PRUEFEN}. Man kann sie in der Gerätekonfiguration ändern, etwa damit ein Programm auf mehreren Anlagen gleich bleibt. Wichtig ist nur: Variablentabelle und Hardware müssen zusammenpassen.</p>` },

{ id:'schrank', title:'Arbeiten im Schaltschrank', html:`
<h3>Aufbau</h3>
<ul><li><b>Oben:</b> Hauptschalter -Q0, Netzteil -G1 (24 V DC, LED „DC OK“), Sicherungsklemmen -F2 (Sensoren) und -F3 (Aktoren).</li>
<li><b>Mitte:</b> CPU -A1, Analogeingabe -A2, Analogausgabe -A3, Digitaleingabe -A4.</li>
<li><b>Unten:</b> Klemmleisten -X1 bis -X4.</li></ul>
<h3>So arbeitest du in der Werkstatt</h3>
<ol><li><b>Verbinden:</b> Ader-Enden des Sensors auf die Klemmen ziehen (oder antippen, dann Klemme antippen). Montieren, Stecken und Einschalten erledigt die Werkstatt.</li>
<li><b>Signale:</b> Variablentabelle und Gerätekonfiguration im Engineering-Laptop.</li>
<li><b>Programm:</b> SCL oder FUP schreiben und laden.</li>
<li><b>Laufen lassen:</b> Anlage bedienen, LEDs und Messwerte beobachten.</li></ol>
<p>„Zeig mir“ markiert die nächste Ader und ihre Zielklemme.</p>
<h3>Die Initiatorenklemme (3-Stock)</h3>
<table><tr><th>Ebene</th><th>Potential</th><th>Ader</th></tr>
<tr><td>oben</td><td>L+ (+24 V)</td><td>BN</td></tr>
<tr><td>Mitte</td><td>Signal → SPS-Eingang</td><td>BK (bzw. WH)</td></tr>
<tr><td>unten</td><td>M (0 V)</td><td>BU</td></tr></table>
<p>Die gelbe LED an der Klemme leuchtet, wenn auf der Signalebene 24 V anliegen. So siehst du schon an der Klemmleiste, ob ein Sensor schaltet.</p>
<h3>Trennklemmen</h3>
<p>Die Klemmen -X3 für Analogsignale haben ein <b>Trennmesser</b>. Offen unterbricht es die Stromschleife: Die SPS sieht einen Drahtbruch, und über die <b>Messbuchsen</b> misst du den Strom oder speist mit dem Kalibrator ein. Danach wieder schliessen!</p>
<h3>Im echten Betrieb</h3>
<p>Vor jedem Eingriff spannungsfrei schalten. Feindrähtige Adern bekommen Aderendhülsen, pro Klemmstelle kommt ein Leiter. Welche Aderfarben und Beschriftungen gelten, steht in der Hausnorm deines Betriebs.</p>
<h3>Wenn alles dunkel ist</h3>
<ul><li>„DC OK“ aus: Kurzschluss L+/M oder Netzteil in Überlast.</li>
<li>Rote LED an -F2: Sicherung der Sensoren ausgelöst. Ursache suchen, dann zurücksetzen.</li></ul>` },

{ id:'sensoren', title:'Sensorübersicht und Auswahl', html:`
<h3>Welcher Sensor für welche Aufgabe?</h3>
<table><tr><th>Sensor</th><th>erkennt</th><th>typische Reichweite</th><th>Stärken / Grenzen</th></tr>
<tr><td>induktiv</td><td>Metall</td><td>wenige mm (Sn laut Typenschild)</td><td>robust, unempfindlich gegen Schmutz. Schaltabstand hängt vom Metall ab</td></tr>
<tr><td>kapazitiv</td><td>fast alles, auch Kunststoff, Glas, Flüssigkeit</td><td>wenige mm, per Poti einstellbar</td><td>durch nichtmetallische Wände hindurch. Empfindlich auf Feuchte und Ablagerungen</td></tr>
<tr><td>Lichttaster</td><td>Objekte, die Licht zurückwerfen</td><td>cm bis dm</td><td>Farbe und Oberfläche beeinflussen die Reichweite. Mit Hintergrundausblendung unabhängig vom Hintergrund</td></tr>
<tr><td>Reflexions-Lichtschranke</td><td>Unterbrechung des Strahls zum Reflektor</td><td>bis einige m</td><td>eine Leitung. Glas und glänzende Teile problematisch</td></tr>
<tr><td>Einweg-Lichtschranke</td><td>Unterbrechung des Strahls</td><td>bis viele m</td><td>am zuverlässigsten. Zwei Geräte, genaues Ausrichten</td></tr>
<tr><td>Zylinderschalter</td><td>Kolbenmagnet</td><td>—</td><td>Endlagen von Pneumatikzylindern</td></tr>
<tr><td>Ultraschall</td><td>Abstand zu Oberflächen</td><td>cm bis m</td><td>analog, auch für Flüssigkeiten. Blindzone vor dem Sensor</td></tr></table>
<h3>Werkstücke × Sensoren (Werkstatt)</h3>
<table><tr><th>Werkstück</th><th>-B1 induktiv</th><th>-B2 kapazitiv</th><th>-B3 Taster</th><th>-B5 Reflex</th></tr>
<tr><td>Stahl</td><td>ja (bis 8 mm)</td><td>ja</td><td>ja</td><td>ja</td></tr>
<tr><td>Edelstahl</td><td>ja (bis 5,6 mm)</td><td>ja</td><td>ja</td><td>ja</td></tr>
<tr><td>Aluminium</td><td>ja (bis 3,2 mm)</td><td>ja</td><td>ja</td><td>ja</td></tr>
<tr><td>Messing</td><td>ja (bis 4 mm)</td><td>ja</td><td>ja</td><td>ja</td></tr>
<tr><td>Kunststoff weiss</td><td>nein</td><td>ja (Poti ≥ mittel)</td><td>ja</td><td>ja</td></tr>
<tr><td>Kunststoff schwarz</td><td>nein</td><td>ja (Poti ≥ mittel)</td><td>nur auf kurze Distanz</td><td>ja</td></tr>
<tr><td>Glas</td><td>nein</td><td>ja (Poti hoch)</td><td>unsicher</td><td>unsicher</td></tr></table>
<h3>Typenschild lesen</h3>
<p>Beispiel -B1: <code>IND M18 · 10–30 V DC · PNP NO · Sn 8 mm · bündig · IP67 · M12</code></p>
<table><tr><th>Angabe</th><th>Bedeutung</th></tr>
<tr><td>IND</td><td>induktiver Sensor (KAP = kapazitiv, OPT = optisch)</td></tr>
<tr><td>M18</td><td>Gewinde 18 mm Durchmesser, passt in den Halter</td></tr>
<tr><td>10–30 V DC</td><td>zulässige Versorgung, 24 V DC liegen mittendrin</td></tr>
<tr><td>PNP NO</td><td>plusschaltend, Schliesser: Bei Erkennung liegen +24 V auf BK</td></tr>
<tr><td>Sn 8 mm</td><td>Nennschaltabstand, gilt für Stahl</td></tr>
<tr><td>bündig</td><td>darf bündig in Metall eingebaut werden</td></tr>
<tr><td>IP67</td><td>staubdicht und geschützt gegen zeitweiliges Untertauchen</td></tr>
<tr><td>M12</td><td>Steckverbinder M12, Belegung im Datenblatt</td></tr></table>
<p>Im Datenblatt stehen zusätzlich Anschlussbild, Schalthysterese, Schaltfrequenz, Reduktionsfaktoren und Einbauhinweise. Die Werte der Werkstatt sind typische Datenblattwerte, herstellerneutral.</p>` },

{ id:'m12', title:'M12 und Aderfarben', html:`
<h3>M12-Steckverbinder</h3>
<div class="lb" data-lb="m12"></div>
<p>Der Standard für Sensoren: Gewinde M12, 4-polig, <b>A-codiert</b>. Die Codierung verhindert, dass man einen falschen Stecker aufsteckt. Die Rändelmutter muss <b>festgezogen</b> sein, sonst gibt es sporadische Aussetzer.</p>
<table><tr><th>Pin</th><th>Aderfarbe</th><th>Funktion</th></tr>
<tr><td>1</td><td>BN braun</td><td>L+ (+24 V)</td></tr>
<tr><td>2</td><td>WH weiss</td><td>zweiter Ausgang, z. B. NC bei antivalenten Sensoren</td></tr>
<tr><td>3</td><td>BU blau</td><td>M (0 V)</td></tr>
<tr><td>4</td><td>BK schwarz</td><td>Schaltausgang</td></tr></table>
<p>Die Belegung ist für Näherungsschalter genormt (IEC 60947-5-2). Das Datenblatt des Sensors hat immer das letzte Wort.</p>
<h3>2-, 3- und 4-Leiter</h3>
<table><tr><th>Anschluss</th><th>Adern</th><th>Beispiele in der Werkstatt</th></tr>
<tr><td>2-Leiter</td><td>BN, BU bzw. zwei Kontakte</td><td>Taster -S1/-S2, Reedkontakt -B9, Sender -B4.1, Transmitter -B11/-B12 (+ und −)</td></tr>
<tr><td>3-Leiter</td><td>BN, BU, BK</td><td>-B1 bis -B7</td></tr>
<tr><td>4-Leiter</td><td>BN, BU, BK, WH</td><td>antivalenter Sensor -B8</td></tr></table>
<h3>Auf der Initiatorenklemme</h3>
<p>BN → L+-Ebene (oben), BK → Signalebene (Mitte), BU → M-Ebene (unten). Bei Tastern kommt der erste Kontakt (13 bzw. 11) auf L+, der zweite (14 bzw. 12) auf die Signalebene.</p>
<h3>Aderfarben im Schrank</h3>
<p>Die Adern von der Klemmleiste zur SPS sind Einzeladern: für DC-Steuerstromkreise dunkelblau, mit Beschriftung. Die Farben der Sensorleitung (BN/BU/BK/WH) enden an der Klemme.</p>` },

{ id:'nonc', title:'NO/NC und Drahtbruchsicherheit', html:`
<h3>Schliesser und Öffner</h3>
<table><tr><th></th><th>Schliesser (NO)</th><th>Öffner (NC)</th></tr>
<tr><td>unbetätigt / nichts erkannt</td><td>0</td><td>1</td></tr>
<tr><td>betätigt / erkannt</td><td>1</td><td>0</td></tr>
<tr><td>Drahtbruch</td><td>0 – nicht erkennbar</td><td>0 – wirkt wie „betätigt“</td></tr>
<tr><td>Beispiel</td><td>Start -S1</td><td>Stopp -S2, Haube -S5</td></tr></table>
<h3>Drahtbruchsicherheit</h3>
<p>Ein gebrochener Draht liefert immer <b>0</b>. Ist eine Abschaltbedingung als Öffner verdrahtet, führt der Drahtbruch in den <b>sicheren Zustand</b>: Das Band hält an. Beim Schliesser würde niemand den Bruch bemerken, bis man den Taster wirklich braucht.</p>
<h3>Im Programm</h3>
<p>Der Öffner liefert in Ruhe 1. Darum wird er im Programm <b>ohne NOT</b> in die Freigabe verknüpft:</p>
<pre class="code">// Selbsthaltung: Start setzt, Stopp (NC) und Haube (NC) geben frei
"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";</pre>
<p>Im Funktionsplan ist das ein Eingang "Stopp" ohne Negation, obwohl der Taster draussen ein Öffner ist. Der Kontakt im Programm fragt den <b>Signalzustand</b> ab, nicht die Bauart des Tasters.</p>
<h3>Antivalente Sensoren</h3>
<p>Ein antivalenter Sensor hat zwei Ausgänge: NO auf BK und NC auf WH. Sie sind immer entgegengesetzt. Sind beide länger gleich (beide 0 oder beide 1), stimmt etwas nicht: Drahtbruch, Kurzschluss oder Sensor defekt. Beim Umschalten dürfen sie kurz gleich sein, darum überwacht man mit einer Zeit:</p>
<pre class="code">// Sensorfehler, wenn NO und NC länger als 100 ms gleich sind
"T_Antivalenz"(IN := NOT ("B8_NO" XOR "B8_NC"), PT := T#100MS);
"Lampe_Rot" := "T_Antivalenz".Q;</pre>` },

{ id:'pnpnpn', title:'PNP und NPN', html:`
<h3>Plus- oder minusschaltend</h3>
<table><tr><th></th><th>PNP</th><th>NPN</th></tr>
<tr><td>deutsch</td><td>plusschaltend</td><td>minusschaltend</td></tr>
<tr><td>englisch</td><td>sourcing</td><td>sinking</td></tr>
<tr><td>BK bei Erkennung</td><td>+24 V (auf L+ geschaltet)</td><td>0 V (auf M geschaltet)</td></tr>
<tr><td>Last liegt</td><td>zwischen BK und M</td><td>zwischen L+ und BK</td></tr>
<tr><td>Eingangsbeschaltung (S7-1200)</td><td>1M auf M</td><td>1M auf L+</td></tr>
<tr><td>Verbreitung</td><td>Standard in Europa</td><td>häufig in Asien, Nordamerika</td></tr></table>
<div class="lb" data-lb="stromfluss"></div>
<h3>Messen</h3>
<table><tr><th>Sensor</th><th>Messung</th><th>geschaltet</th><th>nicht geschaltet</th></tr>
<tr><td>PNP</td><td>BK gegen M</td><td>≈ 24 V</td><td>≈ 0 V</td></tr>
<tr><td>NPN</td><td>BK gegen L+</td><td>≈ 24 V</td><td>≈ 0 V</td></tr>
<tr><td>NPN</td><td>BK gegen M</td><td>≈ 0 V</td><td>≈ 24 V (über den Eingang)</td></tr></table>
<p>Merke: PNP misst man gegen M, NPN gegen L+. Dann bedeutet „24 V“ immer „geschaltet“.</p>
<h3>Ersatzteil passt nicht?</h3>
<p>Ist nur ein NPN-Sensor da, die Anlage aber PNP, gibt es drei Wege:</p>
<ul><li>den richtigen Sensor bestellen (sauberste Lösung),</li>
<li>den Sensor an eine eigene Eingangsgruppe mit 1M auf L+ legen, wenn eine frei ist,</li>
<li>einen Signalwandler oder ein Koppelrelais dazwischen setzen (mehr Bauteile, mehr Fehlerquellen, dokumentieren!).</li></ul>` },

{ id:'eingang', title:'Eingangsbeschaltung S7-1200/1500', html:`
<h3>Der Stromkreis durch den Eingang</h3>
<p>Ein Digitaleingang meldet 1, wenn Strom durch ihn fliesst. Dazu braucht er auf der einen Seite das Sensorsignal und auf der anderen Seite ein Bezugspotential. Bei der S7-1200 ist das der Anschluss <b>1M</b> der Eingangsgruppe.</p>
<table><tr><th>Sensoren</th><th>1M an</th><th>Eingang heisst</th></tr>
<tr><td>PNP</td><td>M</td><td>stromziehend (sink)</td></tr>
<tr><td>NPN</td><td>L+</td><td>stromliefernd (source)</td></tr></table>
<div class="lb" data-lb="stromfluss"></div>
<h3>CPU 1214C DC/DC/DC</h3>
<ul><li>14 Digitaleingänge 24 V DC, stromziehend oder stromliefernd.</li>
<li>Alle 14 Eingänge teilen sich <b>ein 1M</b>: Pro CPU entweder PNP oder NPN.</li>
<li>Die Geberversorgung der CPU (24 V DC, begrenzte Leistung laut Datenblatt) kann Sensoren speisen. In der Werkstatt versorgt das Netzteil -G1 über -X1 alle Sensoren.</li>
<li>Die Digitalausgänge (DC) sind <b>nur plusschaltend</b>.</li>
<li>Die Eingangsverzögerung (Filter gegen Prellen) ist in der Gerätesicht einstellbar ${PRUEFEN}.</li></ul>
<h3>SM 1221 DI 8</h3>
<p>Das Signalmodul hat eigene Bezugsanschlüsse. In der Werkstatt ist es mit <b>zwei Gruppen</b> nachgebildet: <b>1M</b> für .0–.3 und <b>2M</b> für .4–.7. Wie viele Gruppen dein echtes Modul hat und wie die Klemmen heissen, steht im Gerätehandbuch ${PRUEFEN}.</p>
<h3>S7-1500</h3>
<p>Bei der S7-1500 sind die meisten Digitaleingabebaugruppen für <b>PNP</b>-Geber (stromziehend) ausgelegt. Für NPN braucht es passende Baugruppen. Vor dem Kauf ins Datenblatt schauen!</p>
<h3>Fehlerbilder</h3>
<table><tr><th>Sensor</th><th>1M an</th><th>Sensor-LED</th><th>Eingangs-LED</th></tr>
<tr><td>PNP</td><td>M</td><td>an</td><td>an</td></tr>
<tr><td>PNP</td><td>L+</td><td>an</td><td><b>aus</b></td></tr>
<tr><td>NPN</td><td>L+</td><td>an</td><td>an</td></tr>
<tr><td>NPN</td><td>M</td><td>an</td><td><b>aus</b></td></tr>
<tr><td>PNP, BK auf M</td><td>—</td><td>blinkt (Kurzschlussschutz)</td><td>aus</td></tr>
<tr><td>BN/BU vertauscht</td><td>—</td><td>aus (verpolungsgeschützt)</td><td>aus</td></tr></table>` },

{ id:'indkap', title:'Induktive und kapazitive Sensoren', html:`
<h3>Induktiv</h3>
<p>Ein hochfrequentes Magnetfeld vor der aktiven Fläche wird von Metall gedämpft (Wirbelströme). Der Sensor erkennt <b>nur Metall</b>, aber alle Metalle, nicht nur magnetische.</p>
<h3>Schaltabstand und Reduktionsfaktor</h3>
<p>Der Nennschaltabstand <b>Sn</b> gilt für Stahl. Für andere Metalle multipliziert man mit dem Reduktionsfaktor:</p>
<table><tr><th>Material</th><th>Faktor (Richtwert)</th><th>Sn 8 mm →</th></tr>
<tr><td>Stahl</td><td>1,0</td><td>8,0 mm</td></tr><tr><td>Edelstahl</td><td>0,7</td><td>5,6 mm</td></tr>
<tr><td>Messing</td><td>0,5</td><td>4,0 mm</td></tr><tr><td>Aluminium</td><td>0,4</td><td>3,2 mm</td></tr>
<tr><td>Kunststoff, Glas</td><td>0</td><td>nicht erkannt</td></tr></table>
<p>Die Faktoren sind <b>typische Richtwerte</b>. Je nach Hersteller liegen sie z. B. für Edelstahl zwischen 0,6 und 0,9. Massgebend ist das Datenblatt.</p>
<div class="lb" data-lb="schaltabstand" data-sn="8" data-kind="ind"></div>
<h3>Einbauabstand (80-%-Regel)</h3>
<p><code>Einbauabstand = 0,8 · Sn · Reduktionsfaktor</code></p>
<p>Beispiel: Sn 8 mm, Aluminium → 0,8 · 8 · 0,4 = <b>2,56 mm</b>. Die Norm nennt den gesicherten Schaltabstand Sa ≤ 0,81 · Sn. Mit der Reserve schaltet der Sensor auch bei Temperaturschwankung und Exemplarstreuung sicher.</p>
<h3>Hysterese</h3>
<p>Der Ausschaltpunkt liegt etwas weiter weg als der Einschaltpunkt. So flattert der Ausgang nicht, wenn ein Teil genau an der Grenze steht. In der Werkstatt: 10 % (Vereinfachung).</p>
<h3>Bündig / nicht bündig</h3>
<ul><li><b>Bündig:</b> darf bündig in Metall eingebaut werden, kleinerer Schaltabstand.</li>
<li><b>Nicht bündig:</b> grösserer Schaltabstand, braucht eine metallfreie Zone um den Kopf (Datenblatt).</li></ul>
<h3>Kapazitiv</h3>
<p>Der Sensor misst die Kapazität zwischen aktiver Fläche und Umgebung. Er erkennt Metall, Kunststoff, Glas, Holz und besonders gut Wasser.</p>
<div class="lb" data-lb="schaltabstand" data-sn="8" data-kind="kap"></div>
<ul><li><b>Poti:</b> Empfindlichkeit mit dem Schraubendreher einstellen. Ziel: Das Objekt wird erkannt, der Hintergrund (Band, Behälterwand) nicht.</li>
<li><b>Durch die Wand:</b> -B8 erkennt den Wasserstand durch die Acrylwand. Zu empfindlich eingestellt, schaltet er schon bei leerem Tank.</li>
<li>Feuchte, Schaum und Ablagerungen können ihn stören.</li></ul>
<h3>Montage</h3>
<p>Kontermuttern mit dem Gabelschlüssel lösen, Abstand an der Skala einstellen, <b>festziehen</b>. Ein loser Sensor wandert durch Vibration langsam weg und fällt später aus.</p>` },

{ id:'optisch', title:'Optische Sensoren', html:`
<h3>Bauformen</h3>
<table><tr><th>Bauform</th><th>Prinzip</th><th>Werkstatt</th></tr>
<tr><td>Einweg-Lichtschranke</td><td>Sender und Empfänger gegenüber. Objekt unterbricht den Strahl</td><td>-B4.1 (Sender, 2-Leiter) + -B4.2 (Empfänger, 3-Leiter)</td></tr>
<tr><td>Reflexions-Lichtschranke</td><td>Sender/Empfänger in einem Gehäuse, Reflektor gegenüber</td><td>-B5 „Rutsche voll“</td></tr>
<tr><td>Lichttaster</td><td>Objekt wirft Licht zurück</td><td>-B3 mit Hintergrundausblendung</td></tr></table>
<h3>Hell- und dunkelschaltend</h3>
<ul><li><b>Hellschaltend:</b> Ausgang 1, wenn Licht am Empfänger ankommt. Lichttaster: Objekt da. Lichtschranke: Strahl frei.</li>
<li><b>Dunkelschaltend:</b> Ausgang 1, wenn kein Licht ankommt. Lichtschranke: Strahl unterbrochen, Objekt da.</li></ul>
<h3>Polarisationsfilter</h3>
<p>Glänzende Objekte können bei einer Reflexions-Lichtschranke das Licht selbst zurückspiegeln und so den Reflektor „vortäuschen“. Ein Polarisationsfilter lässt nur Licht durch, das der Reflektor (Tripelspiegel) in der Polarisation gedreht hat. Klares Glas bleibt trotzdem schwierig: Es kann die Polarisation ebenfalls verändern. Für Glas nimmt man eine Einweg-Lichtschranke mit angepasster Empfindlichkeit oder spezielle Glas-Sensoren.</p>
<h3>Hintergrundausblendung und Teach-in</h3>
<p>Der Taster wertet den Winkel des zurückkommenden Lichts aus und damit die Entfernung. Alles hinter der eingestellten Tastweite wird ausgeblendet. <b>Teach-in</b> bei -B3: Das leere Band vor den Sensor, Teach-Taste 2 s drücken. Danach erkennt er Teile, die auf dem Band liegen, das Band selbst aber nicht.</p>
<h3>Funktionsreserve und Ausrichten</h3>
<p>Die Funktionsreserve gibt an, wie viel mehr Licht ankommt, als zum Schalten nötig ist. Die <b>Stabilitäts-LED</b> blinkt, wenn die Reserve knapp ist. Einweg-Lichtschranken richtet man mit den zwei Rändelschrauben aus (horizontal, vertikal), bis die LED ruhig leuchtet. Optik sauber halten!</p>
<h3>Farbe und Oberfläche</h3>
<p>Ein Lichttaster erkennt helle, matte Objekte weiter als schwarze. Schwarzer Kunststoff wird nur auf kurze Distanz erkannt.</p>` },

{ id:'zylinder', title:'Zylinderschalter', html:`
<h3>Prinzip</h3>
<p>Im Kolben eines Pneumatikzylinders sitzt ein <b>Ringmagnet</b>. Der Zylinderschalter in der <b>T-Nut</b> spürt ihn durch die Aluminiumwand hindurch.</p>
<table><tr><th>Bauart</th><th>Funktion</th><th>Anschluss</th></tr>
<tr><td>Reedkontakt</td><td>zwei Kontaktzungen im Glasröhrchen, schliessen im Magnetfeld</td><td>2-Leiter, wie ein Taster</td></tr>
<tr><td>magnetoresistiv / elektronisch</td><td>Magnetfeld ändert einen Widerstand, Elektronik schaltet</td><td>3-Leiter PNP, verschleissfrei, prellfrei</td></tr></table>
<h3>Einstellen</h3>
<ol><li>Zylinder in die gewünschte Endlage fahren (-B6 hinten, -B7 vorne).</li>
<li>Schalter in der Nut verschieben, bis seine LED sicher leuchtet. Tipp: den Punkt suchen, an dem sie ein- und wieder ausschaltet, und den Schalter in die Mitte dazwischen setzen.</li>
<li>Mit dem Schraubendreher <b>festklemmen</b>.</li>
<li>Zylinder mehrmals aus- und einfahren und prüfen: Die LED leuchtet nur in der Endlage.</li></ol>
<h3>Im Programm</h3>
<p>Endlagen werden oft zeitüberwacht: Kommt die Endlage nach dem Befehl nicht innerhalb einer Zeit (z. B. 2 s), meldet das Programm eine Störung. So fallen ein verstellter Schalter, zu wenig Druckluft oder ein klemmender Zylinder auf.</p>` },

{ id:'analog', title:'Analogsignale und Schirmung', html:`
<h3>Normsignale</h3>
<table><tr><th>Signal</th><th>Kennlinie</th><th>Eigenschaften</th></tr>
<tr><td>0–10 V</td><td>U = 10 V · (x − xmin) / (xmax − xmin)</td><td>einfach, aber empfindlich gegen Störungen und Spannungsabfall auf langen Leitungen. 0 V ist nicht von Drahtbruch zu unterscheiden</td></tr>
<tr><td>0–20 mA</td><td>I = 20 mA · (x − xmin) / (xmax − xmin)</td><td>Strom ist unempfindlich gegen Leitungswiderstand. 0 mA = Messanfang oder Bruch?</td></tr>
<tr><td>4–20 mA</td><td>I = 4 mA + 16 mA · (x − xmin) / (xmax − xmin)</td><td><b>Live Zero</b>: Messanfang = 4 mA. Deutlich weniger als 4 mA heisst: Fehler oder Drahtbruch</td></tr></table>
<div class="lb" data-lb="kennlinie" data-range="0..10V" data-min="60" data-max="800" data-unit="mm"></div>
<h3>Die Analogsignale der Werkstatt</h3>
<table><tr><th>BMK</th><th>Gerät</th><th>Messbereich</th><th>Signal</th><th>Anschluss</th><th>Kanal</th></tr>
<tr><td>-B10</td><td>Ultraschall M30</td><td>60–800 mm Abstand</td><td>0–10 V</td><td>3-Leiter (BN L+, BU M, BK Signal)</td><td>CPU AI0, %IW64</td></tr>
<tr><td>-R1</td><td>Sollwertsteller</td><td>0–100 %</td><td>0–10 V</td><td>Potentiometer</td><td>CPU AI1, %IW66</td></tr>
<tr><td>-B11</td><td>Drucktransmitter</td><td>0–100 mbar</td><td>4–20 mA</td><td>2-Leiter</td><td>SM 1231 Kanal 0, %IW96</td></tr>
<tr><td>-B12</td><td>PT100 + Kopftransmitter</td><td>0–100 °C</td><td>4–20 mA</td><td>2-Leiter</td><td>Kanal 1, %IW98</td></tr>
<tr><td>-B13</td><td>Durchflussmesser (MID)</td><td>0–20 l/min</td><td>4–20 mA</td><td>4-Leiter, aktiv</td><td>Kanal 2, %IW100</td></tr></table>
<p>Beispiele: -B10 bei 430 mm → 5 V. -B11 bei 50 mbar → 12 mA. -B13 bei 5 l/min → 4 + 16 · 0,25 = 8 mA.</p>
<h3>Konfiguration in der Gerätesicht</h3>
<table><tr><th>Einstellung</th><th>Auswahl</th><th>Hinweis</th></tr>
<tr><td>Messart</td><td>deaktiviert / Spannung / Strom 2-Draht / Strom 4-Draht</td><td>muss zum Gerät passen</td></tr>
<tr><td>Messbereich</td><td>±10 V, 0–10 V, 0–20 mA, 4–20 mA</td><td>4–20 mA für Live Zero</td></tr>
<tr><td>Glättung</td><td>keine / schwach / mittel / stark</td><td>ruhiger, aber träger</td></tr>
<tr><td>Diagnose</td><td>Drahtbruch, Überlauf, Unterlauf</td><td>Drahtbruch nur bei 4–20 mA</td></tr></table>
<p>Nach jeder Änderung: <b>laden</b>. Die Onboard-Eingänge der CPU 1214C können nur 0–10 V (10 Bit, Bezug 2M). Die SM 1231 kann Spannung (±10 V, ±5 V, ±2,5 V) und Strom (0–20 mA, 4–20 mA) mit 12 Bit + Vorzeichen. Welche Auswahl die echte Baugruppe anbietet, steht im Gerätehandbuch ${PRUEFEN}.</p>
<h3>Fehlerbilder</h3>
<table><tr><th>Fehler</th><th>Folge</th></tr>
<tr><td>Stromsignal an einem Kanal mit Messart „Spannung“</td><td>Rohwert fast 0 oder Unsinn</td></tr>
<tr><td>4–20-mA-Sensor, Kanal auf 0–20 mA</td><td>leerer Tank zeigt 20 % (4 mA → 5530)</td></tr>
<tr><td>2-Leiter-Transmitter ohne Versorgung in der Schleife</td><td>0 mA → Drahtbruch</td></tr>
<tr><td>4-Leiter-Transmitter wie 2-Leiter angeschlossen</td><td>kein oder falscher Messwert</td></tr>
<tr><td>Trennmesser offen</td><td>Drahtbruch</td></tr>
<tr><td>Schirm nicht aufgelegt</td><td>Rauschen auf dem Rohwert</td></tr></table>
<h3>Geschirmte Leitungen</h3>
<p>Analogsignale sind klein und empfindlich. Man verlegt sie in <b>geschirmten Leitungen</b> und getrennt von Motor- und Netzleitungen. Den Schirm legt man grossflächig auf die <b>Schirmschiene</b> (Schirmklemme an -X3), in der Regel am Schrankeintritt. In der Stufe Profi gehört das Auflegen zur Aufgabe.</p>
<p>Fehlt die Schirmauflage, zeigt die Werkstatt ein Rauschen von etwa ±1,5 % des Nennbereichs auf dem Rohwert (rund ±400 Einheiten), sichtbar in der Trendkurve. Mit Schirm bleibt nur ein kleiner Rest. <i>Vereinfachung: Echte EMV-Effekte hängen von Frequenzen, Erdung und Leitungsführung ab und sind viel komplexer.</i></p>
<h3>Glättung</h3>
<p>Das Analogmodul kann Messwerte glätten. In der Werkstatt wirkt „schwach / mittel / stark“ wie ein Filter über etwa 4 / 16 / 32 Zyklen (50 ms pro Zyklus). Glätten beruhigt die Anzeige, macht die Messung aber träger. Die Stufen der echten Baugruppe stehen im Gerätehandbuch ${PRUEFEN}.</p>` },

{ id:'transmitter', title:'2-Leiter- und 4-Leiter-Messumformer', html:`
<h3>Messumformer (Transmitter)</h3>
<p>Ein Messumformer wandelt eine physikalische Grösse (Druck, Temperatur, Durchfluss) in ein Normsignal um, meist 4–20 mA. Beispiel: -B12, ein PT100 mit Kopftransmitter 0–100 °C.</p>
<h3>2-Leiter (passiv, schleifengespeist)</h3>
<p>Der Transmitter hat nur <b>+</b> und <b>−</b>. Er bezieht seine Energie aus der Stromschleife und regelt den Strom, der durch sie fliesst. Die Schleife braucht darum eine <b>Versorgung in Reihe</b>:</p>
<pre class="code">L+ → Transmitter +
Transmitter − → AI x+      (über die Trennklemme -X3)
AI x− → M</pre>
<table><tr><th>Ader / Klemme</th><th>-B11 an SM 1231 Kanal 0</th></tr>
<tr><td>Transmitter +</td><td>L+ (Verteiler -X1)</td></tr>
<tr><td>Transmitter −</td><td>-X3 → Kanal 0 „+“</td></tr>
<tr><td>Kanal 0 „−“</td><td>M (Verteiler -X1)</td></tr>
<tr><td>Schirm</td><td>Schirmschiene an -X3</td></tr></table>
<ul><li>Ohne L+ in der Schleife fliessen 0 mA: Die SPS meldet Drahtbruch bzw. Unterlauf.</li>
<li>Ob die Analogbaugruppe die Schleife selbst speisen kann oder eine externe Versorgung braucht, und wie die Kanalklemmen genau heissen, steht im Gerätehandbuch ${PRUEFEN}. In der Werkstatt speist die SM 1231 die Schleife <b>nicht</b>, die Klemmen heissen <code>0+ 0−</code> … <code>3+ 3−</code>.</li>
<li>In der Gerätesicht: Messart „Strom 2-Draht“, Bereich 4–20 mA, Diagnose Drahtbruch an.</li></ul>
<h3>4-Leiter (aktiv)</h3>
<p>Der Transmitter hat eine <b>eigene Versorgung</b> (L+, M) und einen aktiven Stromausgang (I+, I−):</p>
<pre class="code">Versorgung:   L+ → Transmitter L+ ;  M → Transmitter M
Signal:       Transmitter I+ → AI x+ ;  Transmitter I− → AI x−</pre>
<ul><li>Beispiel -B13, magnetisch-induktiver Durchflussmesser an Kanal 2.</li>
<li>Der Transmitter treibt den Strom selbst. Eine zusätzliche Versorgung in der Signalschleife wäre falsch.</li>
<li>In der Gerätesicht: Messart „Strom 4-Draht“.</li>
<li>Wird ein 4-Leiter-Gerät wie ein 2-Leiter angeschlossen, stimmt der Messwert nicht oder es kommt keiner.</li></ul>
<h3>Vergleich</h3>
<table><tr><th></th><th>2-Leiter</th><th>4-Leiter</th></tr>
<tr><td>Adern</td><td>2 (+, −)</td><td>4 (L+, M, I+, I−)</td></tr>
<tr><td>Energie</td><td>aus der Schleife (wenige mA)</td><td>eigene Versorgung</td></tr>
<tr><td>Typisch für</td><td>Druck, Temperatur</td><td>Durchfluss, Analysegeräte, alles mit mehr Leistungsbedarf</td></tr>
<tr><td>Messart</td><td>Strom 2-Draht</td><td>Strom 4-Draht</td></tr></table>
<h3>Bürde</h3>
<p>Alles, was in der Schleife liegt (Eingangswiderstand der SPS, Leitung, Anzeiger), ist die <b>Bürde</b>. Jeder Widerstand kostet Spannung (U = R · I, bei 20 mA und 250 Ω sind das 5 V). Ein 2-Leiter-Transmitter braucht zusätzlich eine Mindestspannung an seinen Klemmen. Darum darf die Bürde nicht grösser sein, als das Datenblatt erlaubt.</p>
<h3>Anschlusskopf</h3>
<p>Bei -B12 sitzt der Transmitter im Anschlusskopf: Deckel abschrauben, Adern auf + und − legen, Deckel wieder zu. Der PT100 selbst ist schon auf der Messseite des Kopftransmitters angeschlossen.</p>` },

{ id:'rohwerte', title:'Rohwerte und Sonderwerte', html:`
<h3>Vom Signal zur Zahl</h3>
<p>Die Analogbaugruppe wandelt das Signal in einen <b>Rohwert</b> (Datentyp Int) um. Bei S7-1200/1500 entspricht der <b>Nennbereich</b> immer <b>0 … 27648</b>, egal ob 0–10 V oder 4–20 mA.</p>
<div class="lb" data-lb="kennlinie" data-range="4..20mA" data-min="0" data-max="100" data-unit="mbar"></div>
<table><tr><th>4–20 mA</th><th>0–10 V</th><th>Rohwert</th><th>Anteil</th></tr>
<tr><td>4 mA</td><td>0 V</td><td>0</td><td>0 %</td></tr>
<tr><td>8 mA</td><td>2,5 V</td><td>6912</td><td>25 %</td></tr>
<tr><td>12 mA</td><td>5 V</td><td>13824</td><td>50 %</td></tr>
<tr><td>16 mA</td><td>7,5 V</td><td>20736</td><td>75 %</td></tr>
<tr><td>20 mA</td><td>10 V</td><td>27648</td><td>100 %</td></tr></table>
<p>Rechnung: <code>Rohwert = 27648 · (I − 4 mA) / 16 mA</code> bzw. <code>27648 · U / 10 V</code>. Bei 0–20 mA: <code>27648 · I / 20 mA</code>.</p>
<h3>Bereiche ausserhalb des Nennbereichs</h3>
<table><tr><th>Bereich</th><th>0–10 V</th><th>4–20 mA</th><th>Rohwert</th></tr>
<tr><td>Überlauf</td><td>≥ ca. 11,85 V</td><td>≥ ca. 22,96 mA</td><td>32767 (16#7FFF)</td></tr>
<tr><td>Übersteuerung</td><td>10 … ca. 11,76 V</td><td>20 … ca. 22,81 mA</td><td>27649 … 32511</td></tr>
<tr><td>Nennbereich</td><td>0 … 10 V</td><td>4 … 20 mA</td><td>0 … 27648</td></tr>
<tr><td>Untersteuerung</td><td>—</td><td>ca. 1,185 … 4 mA</td><td>−1 … −4864</td></tr>
<tr><td>Unterlauf / Drahtbruch</td><td>—</td><td>unter ca. 1,185 mA</td><td>−32768 (16#8000) bzw. 32767</td></tr></table>
<ul><li>In der <b>Übersteuerung</b> misst die Baugruppe noch linear weiter (21 mA → 29376), der Wert ist aber ausserhalb des Messbereichs des Sensors: prüfen!</li>
<li>In der <b>Untersteuerung</b> ebenso (2 mA → −3456).</li>
<li><b>Drahtbruch</b> erkennt man nur bei 4–20 mA (Live Zero). Bei 0–10 V ist ein Bruch einfach 0 V = Rohwert 0.</li>
<li>Welcher Sonderwert bei Drahtbruch geliefert wird, hängt von der Baugruppe und davon ab, ob die <b>Diagnose Drahtbruch</b> freigeschaltet ist. In der Werkstatt: Diagnose an → <b>32767</b>, Diagnose aus → <b>−32768</b> ${PRUEFEN}.</li>
<li>Die genauen Grenzwerte (V, mA) der echten Baugruppen stehen im Systemhandbuch, Kapitel „Analogwertdarstellung“ ${PRUEFEN}.</li></ul>
<h3>Rohwert im Programm prüfen</h3>
<pre class="code">// Status für das HMI: 0 = gut, 1 = Übersteuerung, 2 = Untersteuerung, 3 = Überlauf/Drahtbruch, 4 = Unterlauf
IF "Druck_Roh" = 32767 THEN
    "Druck_Status" := 3;
ELSIF "Druck_Roh" = -32768 THEN
    "Druck_Status" := 4;
ELSIF "Druck_Roh" > 27648 THEN
    "Druck_Status" := 1;
ELSIF "Druck_Roh" < 0 THEN
    "Druck_Status" := 2;
ELSE
    "Druck_Status" := 0;
END_IF;
"Druck_Gueltig" := "Druck_Status" <= 2;   // Über-/Untersteuerung noch messbar, Sonderwerte nicht</pre>
<h3>Falscher Messbereich</h3>
<p>Ist ein 4–20-mA-Kanal als <b>0–20 mA</b> konfiguriert, liefern 4 mA den Rohwert 27648 · 4 / 20 ≈ <b>5530</b>. Ein leerer Tank zeigt dann 20 %.</p>
<h3>Auflösung</h3>
<p>Die SM 1231 löst 12 Bit + Vorzeichen auf, die Onboard-Eingänge der CPU 10 Bit. Der Rohwert springt darum in Stufen von mehreren Einheiten, obwohl der Bereich bis 27648 reicht.</p>
<h3>In der Beobachtung</h3>
<p>Die Beobachtungstabelle zeigt Rohwerte dezimal und hexadezimal. 16#7FFF und 16#8000 springen sofort ins Auge. Der Diagnosepuffer nennt Kanal und Ursache im Klartext, z. B. „Kanal 1: Drahtbruch“.</p>` },

{ id:'normx', title:'NORM_X und SCALE_X', html:`
<h3>Zwei Schritte zur physikalischen Grösse</h3>
<ol><li><b>NORM_X</b> bildet den Rohwert auf 0,0 … 1,0 ab: <code>OUT = (VALUE − MIN) / (MAX − MIN)</code></li>
<li><b>SCALE_X</b> bildet 0,0 … 1,0 auf den Messbereich ab: <code>OUT = VALUE · (MAX − MIN) + MIN</code></li></ol>
<p>Parameterreihenfolge bei beiden: <b>MIN, VALUE, MAX</b>. In SCL werden die Parameter mit Namen übergeben.</p>
<div class="lb" data-lb="kennlinie" data-range="4..20mA" data-min="0" data-max="100" data-unit="mbar"></div>
<h3>Beispiel Druck -B11 (0–100 mbar, 4–20 mA)</h3>
<pre class="code">// Rohwert 0…27648 → 0.0…1.0
"Druck_Anteil" := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648);
// 0.0…1.0 → 0.0…100.0 mbar
"Druck_mbar" := SCALE_X(MIN := 0.0, VALUE := "Druck_Anteil", MAX := 100.0);</pre>
<p>Rohwert 13824 → Anteil 0,5 → 50,0 mbar.</p>
<h3>Dasselbe in FUP</h3>
<p>NORM_X und SCALE_X sind Boxen mit den Eingängen MIN, VALUE, MAX und dem Ausgang OUT. Im Textformat der Werkstatt stehen die Parameter in derselben Reihenfolge, OUT zuletzt:</p>
<pre class="kop">NETWORK Druck normieren
=> NORM_X(0, Druck_Roh, 27648, Druck_Anteil);
NETWORK Druck skalieren
=> SCALE_X(0.0, Druck_Anteil, 100.0, Druck_mbar);</pre>
<h3>Weitere Beispiele der Tankstation</h3>
<pre class="code">// Temperatur -B12: 0–100 °C
"Temp_Anteil" := NORM_X(MIN := 0, VALUE := "Temp_Roh", MAX := 27648);
"Temp_C" := SCALE_X(MIN := 0.0, VALUE := "Temp_Anteil", MAX := 100.0);

// Ultraschall -B10: 60–800 mm Abstand (Offset 60 mm!)
"Abstand_Anteil" := NORM_X(MIN := 0, VALUE := "Abstand_Roh", MAX := 27648);
"Abstand_mm" := SCALE_X(MIN := 60.0, VALUE := "Abstand_Anteil", MAX := 800.0);
"Fuellstand_mm" := 800.0 - "Abstand_mm";        // Einbauhöhe 800 mm über dem Boden

// Pegel aus Druck: h = p / (rho · g); 1 mbar = 100 Pa
"Pegel_Druck_mm" := "Druck_mbar" * 100.0 / (1000.0 * 9.81) * 1000.0;   // ≈ 10,19 mm pro mbar

// Sollwertsteller -R1: 0–10 V → 0–100 %
"Soll_Anteil" := NORM_X(MIN := 0, VALUE := "Sollwert_Roh", MAX := 27648);
"Soll_Prozent" := SCALE_X(MIN := 0.0, VALUE := "Soll_Anteil", MAX := 100.0);</pre>
<h3>Sonderwerte vorher abfangen</h3>
<p>Werte ausserhalb MIN…MAX werden <b>nicht begrenzt</b>, sondern linear weitergerechnet: Rohwert 32767 ergibt einen Anteil von etwa 1,185 und bei -B12 die Anzeige <b>118,5 °C</b>.</p>
<pre class="code">IF "Temp_Roh" = 32767 OR "Temp_Roh" = -32768 THEN
    "Temp_Fehler" := TRUE;          // Drahtbruch / Über- oder Unterlauf
    "Temp_C" := 0.0;                // oder letzten gültigen Wert halten – je nach Aufgabe
ELSE
    "Temp_Fehler" := FALSE;
    "Temp_Anteil" := NORM_X(MIN := 0, VALUE := "Temp_Roh", MAX := 27648);
    "Temp_C" := SCALE_X(MIN := 0.0, VALUE := "Temp_Anteil", MAX := 100.0);
END_IF;</pre>
<h3>Datentypen</h3>
<ul><li>NORM_X liefert einen <b>Real</b>-Wert. Die Zwischenvariable muss Real sein.</li>
<li>SCALE_X liefert Real oder Int, passend zur Zielvariable. Mit Int-Ziel wird in der Werkstatt gerundet. Ob TIA rundet oder abschneidet, laut TIA-Hilfe prüfen.</li>
<li>Die Einheit steckt in MIN/MAX von SCALE_X: 0.0…100.0 ergibt mbar, 0.0…0.1 ergäbe bar.</li>
<li>Das ENO-Verhalten bei ungültigen Grenzen oder Bereichsüberschreitung steht in der TIA-Hilfe ${PRUEFEN}.</li></ul>
<h3>Die Geradengleichung dahinter</h3>
<p>Beides zusammen ist eine Gerade: <code>Wert = Wmin + (Roh − Rmin) · (Wmax − Wmin) / (Rmax − Rmin)</code>. Wer das versteht, kann auch „rückwärts“ rechnen (Analogausgabe) oder mit zwei gemessenen Punkten kalibrieren.</p>` },

{ id:'aq', title:'Analogausgabe', html:`
<h3>Vom Sollwert zum Signal</h3>
<p>Die Analogausgabe arbeitet umgekehrt: Das Programm schreibt einen Rohwert in ein Ausgangswort (%QW), die Baugruppe macht daraus Spannung oder Strom. Der Nennbereich ist wieder <b>0 … 27648</b> (bei ±10 V auch negativ bis −27648).</p>
<table><tr><th>Sollwert</th><th>Rohwert</th><th>0–10 V</th><th>4–20 mA</th></tr>
<tr><td>0 %</td><td>0</td><td>0 V</td><td>4 mA</td></tr><tr><td>25 %</td><td>6912</td><td>2,5 V</td><td>8 mA</td></tr>
<tr><td>50 %</td><td>13824</td><td>5 V</td><td>12 mA</td></tr><tr><td>75 %</td><td>20736</td><td>7,5 V</td><td>16 mA</td></tr><tr><td>100 %</td><td>27648</td><td>10 V</td><td>20 mA</td></tr></table>
<h3>Rückwärts rechnen: NORM_X auf den Sollwert, SCALE_X auf 0…27648</h3>
<pre class="code">// Pumpensollwert 0…100 % → Rohwert 0…27648 (-T2, 0–10 V, %QW112)
"Pumpe_Anteil" := NORM_X(MIN := 0.0, VALUE := "Pumpe_Soll_Prozent", MAX := 100.0);
"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := "Pumpe_Anteil", MAX := 27648);   // Int</pre>
<pre class="kop">NETWORK Pumpe normieren
=> NORM_X(0.0, Pumpe_Soll_Prozent, 100.0, Pumpe_Anteil);
NETWORK Pumpe auf Rohwert
=> SCALE_X(0, Pumpe_Anteil, 27648, Pumpe_Soll_Roh);</pre>
<p>Hier ist die Reihenfolge vertauscht: erst die physikalische Grösse normieren, dann auf den Rohwertbereich skalieren. Das Ziel ist ein <b>Int</b>, weil das Ausgangswort ein Int ist.</p>
<h3>Begrenzen</h3>
<p>Werte ausserhalb 0 … 100 % vor der Ausgabe begrenzen. Sonst landet die Ausgabe in der Übersteuerung oder wird negativ.</p>
<pre class="code">// Stellventil -MB5: 0…100 % → 4…20 mA (%QW114), Sollwert begrenzt
"Ventil_Begrenzt" := LIMIT(MN := 0.0, IN := "Ventil_Soll_Prozent", MX := 100.0);
"Ventil_Anteil" := NORM_X(MIN := 0.0, VALUE := "Ventil_Begrenzt", MAX := 100.0);
"Ventil_Soll_Roh" := SCALE_X(MIN := 0, VALUE := "Ventil_Anteil", MAX := 27648);</pre>
<p>Ob der Ausgang 0–10 V oder 4–20 mA liefert, entscheidet die <b>Konfiguration</b> des Kanals, nicht das Programm. Der Rohwert 0 bedeutet bei 4–20 mA also 4 mA.</p>
<h3>Werkstatt</h3>
<ul><li>SM 1232 AQ 2: Kanal 0 → -T2 (Frequenzumrichter, 0–10 V, %QW112), Kanal 1 → -MB5 (Stellventil, 4–20 mA, %QW114).</li>
<li>Ausgabeart und Bereich in der Gerätesicht einstellen und laden.</li>
<li><b>Verhalten bei STOP:</b> Ersatzwert ausgeben oder letzten Wert halten (parametrierbar). Für eine Pumpe ist ein Ersatzwert 0 meist die sichere Wahl.</li></ul>
<h3>Bürde am Ausgang</h3>
<p>Ein Spannungsausgang braucht eine Mindestlast, ein Stromausgang verträgt nur eine Höchstbürde. Die Werte stehen im Datenblatt der Baugruppe ${PRUEFEN}.</p>` },

{ id:'hysterese', title:'Hysterese, Kalibrieren und Plausibilität', html:`
<h3>Hysterese</h3>
<p>Ein Messwert zittert immer ein wenig. Schaltet man bei genau einem Grenzwert, flattert der Ausgang. Mit <b>Hysterese</b> liegen Ein- und Ausschaltpunkt auseinander:</p>
<pre class="code">// Heizung: Ein unter 58 °C, Aus über 62 °C
IF "Temp_C" < 58.0 THEN
    "Heizung" := TRUE;
ELSIF "Temp_C" > 62.0 THEN
    "Heizung" := FALSE;
END_IF;   // dazwischen: kein Befehl, Zustand bleibt</pre>
<pre class="kop">NETWORK Heizung ein
[Temp_C < 58.0] => S Heizung;
NETWORK Heizung aus
[Temp_C > 62.0] => R Heizung;</pre>
<p>Die Heizung braucht zusätzlich eine Freigabe: nie ohne Wasser heizen (Pegel, Trockenlauf).</p>
<h3>Warn- und Alarmgrenzen</h3>
<pre class="code">// Füllstand hoch: Warnung ab 500 mm, zurück unter 480 mm
IF "Pegel_mm" > 500.0 THEN
    "Warn_Hoch" := TRUE;
ELSIF "Pegel_mm" < 480.0 THEN
    "Warn_Hoch" := FALSE;
END_IF;
// Alarm hoch: ab 560 mm, zurück unter 540 mm → Zulauf zu, Hupe
IF "Pegel_mm" > 560.0 THEN
    "Alarm_Hoch" := TRUE;
ELSIF "Pegel_mm" < 540.0 THEN
    "Alarm_Hoch" := FALSE;
END_IF;
"Lampe_Rot" := "Warn_Hoch" OR "Alarm_Hoch";
"Hupe" := "Alarm_Hoch";</pre>
<p>Jede Grenze bekommt ihre eigene Hysterese. Alarme werden oft gespeichert, bis jemand sie quittiert.</p>
<h3>Plausibilität</h3>
<p>Bevor ein Messwert verwendet wird, prüft man, ob er überhaupt stimmen kann:</p>
<ul><li><b>Sonderwerte:</b> 32767 oder −32768 → Drahtbruch, Über- oder Unterlauf. Messwert ungültig.</li>
<li><b>Bereich:</b> Rohwert ausserhalb 0 … 27648 → ausserhalb des Messbereichs, Warnung.</li>
<li><b>Physik:</b> Ein Tank kann nicht schneller voll werden, als die Pumpe fördert. Temperatur springt nicht um 50 °C in 50 ms.</li>
<li><b>Zwei Messprinzipien:</b> Druck (p = ρ · g · h, 500 mm ≈ 49 mbar) und Ultraschall messen denselben Pegel. Weichen sie stark ab, stimmt einer nicht.</li></ul>
<pre class="code">// Plausibilität Ultraschall ↔ Druck: Abweichung > 5 % des Tanks (600 mm) → Meldung
"Pegel_Diff" := ABS("Fuellstand_mm" - "Pegel_Druck_mm");
"Meldung_Plaus" := "Pegel_Diff" > 0.05 * 600.0;</pre>
<p>Was die Anlage bei ungültigem Messwert tut (anhalten, Ersatzwert, Handbetrieb), entscheidet die Aufgabe. Wichtig ist: Sie tut etwas <b>Sicheres</b>.</p>
<h3>Offset-Kalibrierung</h3>
<p>Tank leer, Anzeige 12 mm: Das ist ein Nullpunktfehler. Den Offset misst man bei bekanntem Zustand und zieht ihn ab:</p>
<pre class="code">"Pegel_mm" := "Pegel_roh_mm" - 12.0;</pre>
<h3>2-Punkt-Kalibrierung</h3>
<p>Stimmt auch die Steigung nicht, nimmt man zwei bekannte Punkte, möglichst weit auseinander (z. B. 100 mm und 500 mm laut Massstab):</p>
<ol><li>Pegel auf Punkt 1 bringen, Rohwert R1 in der Beobachtungstabelle ablesen.</li>
<li>Pegel auf Punkt 2 bringen, Rohwert R2 ablesen.</li>
<li>R1/R2 als MIN/MAX in NORM_X, die Massstabswerte als MIN/MAX in SCALE_X eintragen.</li>
<li>An einem dritten Punkt kontrollieren.</li></ol>
<pre class="code">"Anteil" := NORM_X(MIN := 5000, VALUE := "Pegel_Roh", MAX := 25000);   // R1, R2 gemessen
"Pegel_mm" := SCALE_X(MIN := 100.0, VALUE := "Anteil", MAX := 500.0);</pre>
<h3>Gleitender Mittelwert</h3>
<p>Gegen Rauschen mittelt man die letzten n Werte. Beispiel mit 8 Werten und einem Ringpuffer (Array 0…7):</p>
<pre class="code">"Summe" := "Summe" - "Puffer"["Index"] + "Messwert";   // ältesten Wert raus, neuen rein
"Puffer"["Index"] := "Messwert";
"Index" := ("Index" + 1) MOD 8;
"Mittelwert" := "Summe" / 8.0;</pre>
<p>Bei 50 ms Zyklus verzögert das um etwa 0,4 s. Die Glättung der Baugruppe wirkt ähnlich (Werkstatt: schwach/mittel/stark ≈ 4/16/32 Zyklen). Nicht mehr glätten als nötig: Ein träger Wert kommt beim Überlaufschutz zu spät.</p>` },

{ id:'messen', title:'Multimeter und Kalibrator', html:`
<h3>Das Multimeter</h3>
<table><tr><th>Stellung</th><th>Buchsen</th><th>Wie</th></tr>
<tr><td>V DC</td><td>COM + V/Ω</td><td><b>parallel</b>: Spitzen an zwei Punkte, z. B. BK gegen M</td></tr>
<tr><td>mA DC</td><td>COM + mA</td><td><b>in Reihe</b>: Der Strom muss durch das Messgerät fliessen</td></tr>
<tr><td>Ω / Durchgang</td><td>COM + V/Ω</td><td>nur <b>spannungsfrei</b>. Piepton = Verbindung</td></tr></table>
<h3>Spannung messen</h3>
<ul><li>Versorgung am Sensor: BN gegen BU ≈ 24 V.</li>
<li>PNP-Signal: BK gegen M. NPN-Signal: BK gegen L+.</li>
<li>0–10-V-Signal (-B10): Signal gegen Bezug (M bzw. 2M). 430 mm Abstand → 5 V.</li></ul>
<h3>Strom messen: am Trennmesser</h3>
<ol><li>Multimeter auf mA DC, Messleitung in die mA-Buchse.</li>
<li>Spitzen in die beiden Messbuchsen der Trennklemme -X3.</li>
<li>Trennmesser mit dem Schraubendreher öffnen: Jetzt fliesst der Schleifenstrom durch das Multimeter.</li>
<li>Ablesen und ins Messprotokoll übernehmen.</li>
<li>Trennmesser schliessen, erst dann die Spitzen entfernen.</li></ol>
<p>Ist das Trennmesser offen und kein Messgerät gesteckt, sieht die SPS einen Drahtbruch (Diagnosepuffer, Rohwert 32767 bei aktivierter Diagnose). Das ist normal und ein guter Test der Drahtbruchdiagnose.</p>
<h3>Achtung Sicherung</h3>
<p>In der mA-Stellung ist das Multimeter fast ein Kurzschluss. Wer damit <b>parallel</b> an eine Spannung geht (z. B. L+ gegen M), löst die Sicherung im Multimeter aus. Sie muss ersetzt werden, das kostet in der Aufgabe einen Minuspunkt. Merke: Strom immer in Reihe.</p>
<h3>Durchgang prüfen</h3>
<p>Nur bei ausgeschaltetem -Q0. Prüft, ob eine Ader wirklich zwei Punkte verbindet (Klemme → Eingang), oder ob fälschlich eine Verbindung besteht (L+ gegen M darf nicht piepen).</p>
<h3>Der Kalibrator</h3>
<p>Der Stromkalibrator speist statt des Transmitters einen einstellbaren Strom von 0–24 mA in den Analogkanal. So prüft man die ganze Kette Klemme → Baugruppe → Konfiguration → Programm → Anzeige, bevor der echte Sensor läuft.</p>
<h3>Loop-Check Schritt für Schritt</h3>
<ol><li>Kanal in der Gerätesicht konfigurieren (Strom, 4–20 mA, Diagnose Drahtbruch an) und laden.</li>
<li>Trennmesser der Kanalklemme an -X3 öffnen, Kalibrator an die Messbuchsen auf der SPS-Seite anschliessen.</li>
<li>Nacheinander <b>4 / 12 / 20 mA</b> einspeisen. Jeweils Rohwert (Beobachtungstabelle) und Anzeige (HMI) ins Protokoll.</li>
<li>Zum Schluss 0 mA bzw. Kalibrator ab: Die Drahtbruchmeldung muss kommen.</li>
<li>Kalibrator entfernen, Trennmesser schliessen, Transmitter wieder in Betrieb: Der Messwert muss plausibel sein.</li></ol>
<table><tr><th>Einspeisen</th><th>Rohwert erwartet</th><th>Anzeige (0–100 mbar)</th></tr>
<tr><td>4 mA</td><td>0</td><td>0 mbar</td></tr><tr><td>12 mA</td><td>13824</td><td>50 mbar</td></tr><tr><td>20 mA</td><td>27648</td><td>100 mbar</td></tr><tr><td>0 mA</td><td>32767 (Drahtbruch)</td><td>Fehlermeldung</td></tr></table>
<p>Stimmt der Rohwert, aber nicht die Anzeige, liegt der Fehler im Programm (Skalierung). Stimmt schon der Rohwert nicht, liegt er in Verdrahtung oder Konfiguration.</p>
<p><i>Vereinfachung: Der Kalibrator kann auch einen 2-Leiter-Transmitter nachbilden (Modus „Senke“). Quelle und Senke sind in der Werkstatt vereinfacht.</i></p>` }
];
M.forEach((s, i) => { s.page = i + 1; });
root.MANUAL_CONTENT = M;
root.MANUAL_IDS = M.map(s => s.id);
})(typeof window !== 'undefined' ? window : globalThis);
