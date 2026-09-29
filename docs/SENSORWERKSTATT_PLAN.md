# SPS Quest – Sensorwerkstatt: Gesamtplanung für Claude Code

Stand: 27.09.2026 · Autor: Planung mit Steven · Status: **freigegeben zur Umsetzung** (nach Paket 0 und Teil A aus `PLAN_ZERTIFIKAT_PIKETT.md`, vor Teil B)

Diese Datei ersetzt `SENSORWERKSTATT_KONZEPT.md` und ist verbindlich wie `docs/ENTSCHEIDUNGEN.md`. „Vorschlag“ gilt, solange Steven nichts anderes sagt. Rückfragen nur bei Kosten oder fehlenden Entscheidungen.

Festgelegt:
- **SPS-Teil:** frei wählbar in SCL, KOP oder FUP. Kein AWL, weil die S7-1200 kein AWL kann.
- **Umfang:** 6 Module, 60 Aufgaben, 12 Theorien.
- **Hardware-Bezug:** S7-1200/1500. Rohwerte 0–27648, NORM_X/SCALE_X, TIA-Portal-Begriffe.
- **Sensoren herstellerneutral:** keine Marken, keine Logos. Werte sind typische Datenblattwerte.
- **Leitidee:** Alles, was man am Prüfstand tun kann, tut man in der Praxis genauso. Montieren, anstecken, auflegen, messen, konfigurieren, laden, beobachten. Vereinfachungen werden im Spiel ausdrücklich als „Vereinfachung“ markiert.

---

## Teil 1 – Didaktik (Kurzfassung)

**Ziel:** Lernende schliessen Sensoren fachgerecht an eine S7-1200 an, wählen das richtige Signal und die richtige Eingangsbeschaltung, konfigurieren die Analogeingänge und bringen Rohwerte per NORM_X/SCALE_X in physikalische Einheiten. Sie verarbeiten die Messwerte sicher und finden Fehler systematisch: Sensor → Verdrahtung → Konfiguration → Programm.

**Einordnung:**
- Fünftes Tor im Portal: „Sensorwerkstatt“, Symbol Messschieber und Sensor.
- Gemeinsames Konto, gemeinsamer Leitstand und Live-Challenge wie bei den Quests.
- Empfohlen nach Kapitel 3 einer Quest (SCL, KOP oder FUP), aber kein Pflicht-Vorlauf.

**Story:** ARIA hat der Fabrik die Sinne verwirrt. Der Werkmeister holt die Lernenden in seine Werkstatt im Untergeschoss. Jeder Sensor muss dort auf den Prüfstand, bevor er zurück in die Anlage darf. ARIA sabotiert gelegentlich: vertauschte Adern, verstellte Sensoren, falsche Konfiguration.

**Lernziele:**
1. Sensorwahl nach Material und Messaufgabe.
2. 2-, 3- und 4-Leiter-Anschluss, M12-Belegung, NO/NC.
3. PNP/NPN und Eingangsbeschaltung über 1M.
4. Analogsignale 0–10 V, 0/4–20 mA; 2- und 4-Leiter-Transmitter; Konfiguration der Analogeingänge.
5. Rohwerte, Über- und Untersteuerung, Sonderwerte.
6. NORM_X/SCALE_X und die Geradengleichung dahinter, Analogausgabe.
7. Hysterese, Drahtbruch, Plausibilität, Glättung, Kalibrierung.
8. Systematische Fehlersuche mit LEDs, Multimeter, Beobachtungstabelle und Diagnosepuffer.

---

## Teil 2 – Die 3D-Anlage im Detail

### 2.1 Raum und Stimmung

- **Raum:** Werkstatt im Untergeschoss, etwa 9 × 6 m.
  - Sichtbeton, Epoxid-Boden in Grau mit gelber Sicherheitsmarkierung um den Prüfstand.
  - Lichtband unten, zwei Hallenleuchten, warmes Arbeitslicht über der Werkbank.
  - Leichte Staubpartikel im Licht, abschaltbar und bei „Bewegung reduzieren“ aus.
- **Rückwand:** Werkzeugwand (Lochwand) mit Schraubendrehern, Abisolierzange, Crimpzange, Multimeter, Kalibrator und Kabelrollen. Alle Werkzeuge sind **anklickbar**. Sie sind die Werkzeugauswahl der Oberfläche.
- **Links:** Werkbank mit Ersatzteilregal: beschriftete Kisten mit Sensoren, Kabeln, Klemmen und Aderendhülsen. Aus den Kisten nimmt man Bauteile für Aufgaben, bei denen die Sensorwahl dazugehört.
- **Mitte:** der Prüfstand.
- **Rechts:** Tankstation mit Vorratsbehälter.
- **Hinten Mitte:** Schaltschrank.
- **Auf der Werkbank:** Engineering-Laptop mit TIA-ähnlicher Oberfläche.
- **Am Prüfstand:** kleines HMI-Panel (7").
- **ARIA:** erscheint als flackernde Statusanzeige auf einem alten Röhrenmonitor in der Ecke, passend zur Welt.

### 2.2 Prüfstand (Aluminium-Profilgestell)

Gestell 2,0 m breit × 0,8 m tief, Tischhöhe 0,90 m, Nutprofile 40 × 40 mm. Die Nuten sind echte Montagepunkte: Sensorhalter lassen sich entlang der Nut verschieben.

**Sortierstrecke (links, 1,2 m):**

| BMK | Bauteil | Details für 3D und Simulation |
|---|---|---|
| -MB1 | Vereinzeler am Fallmagazin | Magazin für 8 Werkstücke (Ø 40 mm, 20 mm hoch). Pneumatischer Schieber schiebt ein Teil aufs Band. |
| -M1 | Bandmotor 24 V DC mit Getriebe | Angesteuert über Koppelrelais -K1. Band 60 mm breit, 0,1 m/s. Gurt-Textur läuft sichtbar. |
| -B1 | Induktiver Sensor M18, bündig, PNP NO, Sn 8 mm | Halter mit zwei Muttern, Abstand zur Bandoberkante einstellbar 1–15 mm (Skala am Halter). Gelbe Schalt-LED, grüne Betriebs-LED. |
| -B2 | Kapazitiver Sensor M18, nicht bündig, PNP NO, Sn 1–8 mm (Poti) | Poti mit Schlitz, drehbar mit Schraubendreher (10 Umdrehungen, Anzeige der Empfindlichkeit). |
| -B3 | Reflexions-Lichttaster mit Hintergrundausblendung, PNP, hell/dunkel umschaltbar | Roter Lichtfleck auf dem Werkstück sichtbar. Teach-Taste: 2 s drücken = Tastweite auf aktuelles Objekt. |
| -B4 | Einweg-Lichtschranke (Sender -B4.1 + Empfänger -B4.2) | Sender nur 2-Leiter (BN/BU), Empfänger 3-Leiter. Ausrichtung über zwei Rändelschrauben. Stabilitäts-LED blinkt bei schwacher Funktionsreserve. |
| -B5 | Reflexions-Lichtschranke mit Reflektor, am Behälter „voll“ | Reflektor gegenüber. Erkennt Glas nur unsicher. Das ist ein bewusster Lerneffekt, Hinweis auf Polarisationsfilter. |
| -MB2 | Auswerfer (Pneumatikzylinder, doppeltwirkend, 50 mm Hub) | Schiebt Teile in Rutsche A. Teile, die nicht ausgeworfen werden, laufen in Behälter B am Bandende. |
| -B6 / -B7 | Zylinderschalter (magnetisch) hinten / vorne | In der T-Nut des Zylinders verschiebbar, Klemmschraube. Die LED leuchtet, wenn der Kolbenmagnet darunter ist. |
| -S5 | Sicherheits-Positionsschalter der Schutzhaube (Öffner) | Plexiglashaube klappbar. Beim Öffnen wird der Kontakt unterbrochen. |
| — | Werkstücke | Stahl (grau), Edelstahl (hell), Aluminium (matt silber), Messing (gold), Kunststoff weiss, Kunststoff schwarz, Glas (transparent). Material, Farbe und Oberfläche beeinflussen die Sensoren (Tabelle 6.1). |

**Bedienpult (vorne Mitte, schräg):**

| BMK | Bauteil | Signal |
|---|---|---|
| -S1 | Taster Start, grün | Schliesser |
| -S2 | Taster Stopp, rot | Öffner |
| -S3 | Not-Halt, Pilzkopf mit zwei Öffnern | Kanal 1 → Sicherheitsrelais -K0 (fertig verdrahtet, verplombt). Kanal 2 → Meldung an die SPS |
| -S4 | Wahlschalter Hand/Auto | Schliesser in Stellung Auto |
| -R1 | Sollwertsteller 0–10 V (Potentiometer) | Analog an CPU-AI1 |
| -P1/-P2/-P3 | Leuchtmelder grün/rot, Hupe | Ausgänge |

Vereinfachung, im Spiel angezeigt: Der Not-Halt wirkt real über das Sicherheitsrelais -K0 auf die Lastspannung der Ausgänge. Die SPS erhält nur eine Meldung. Sicherheitstechnik ist nicht Thema der Werkstatt.

**Tankstation (rechts):**

| BMK | Bauteil | Details |
|---|---|---|
| — | Messtank aus Acryl, Ø 300 mm, 600 mm hoch, Skala in mm | Wasser als Shader, Pegel animiert, Wellen beim Zulauf |
| — | Vorratsbehälter unten, 40 l | Mit Überlauf |
| -M2 / -T2 | Kreiselpumpe mit kleinem Frequenzumrichter | FU hat Eingang „Freigabe“ (24 V digital) und „Sollwert“ 0–10 V. Die Pumpe dreht sichtbar, das Geräusch passt zur Drehzahl |
| -MB4 | Zulauf-Magnetventil (auf/zu) | — |
| -MB5 | Proportional-Stellventil 4–20 mA | Stellungsanzeige am Ventil |
| -MB3 | Ablauf-Magnetventil | — |
| -E1 | Heizstab 230 V über Halbleiterrelais -K3 | 230-V-Seite fertig verdrahtet und abgedeckt, Hinweis „nur Elektrofachkraft“. Die Werkstatt verdrahtet nur die 24-V-Ansteuerung |
| -B10 | Ultraschallsensor M30 oben, 0–10 V, Messbereich 60–800 mm Abstand, Blindzone 60 mm | Schallkegel optional sichtbar. Misst den Abstand zur Wasseroberfläche |
| -B11 | Drucktransmitter am Tankboden, 0–100 mbar, 4–20 mA, 2-Leiter | 600 mm Wassersäule ≈ 59 mbar |
| -B12 | PT100 in Tauchhülse mit Kopftransmitter 0–100 °C → 4–20 mA, 2-Leiter | Anschlusskopf mit Deckel zum Aufschrauben, Klemmen + und − im Kopf |
| -B13 | Magnetisch-induktiver Durchflussmesser 0–20 l/min, 4–20 mA, 4-Leiter | Eigene 24-V-Versorgung, Stromausgang aktiv |
| -B8 | Kapazitiver Grenzschalter „Tank voll“, aussen an der Acrylwand, PNP | Als Öffner verdrahtet: drahtbruchsicher, bei vollem Tank 0 |
| -B9 | Schwimmerschalter „Trockenlauf“ im Vorratsbehälter | Reedkontakt, 2-Leiter |

Wasser, Temperatur und Durchfluss folgen einem einfachen physikalischen Modell:
- Zulauf abhängig von Pumpendrehzahl und Ventilstellung, Ablauf proportional zu √Pegel.
- Temperatur mit Heizleistung, Wärmeverlust und Durchmischung.
- Messrauschen je Sensor einstellbar.

### 2.3 Schaltschrank (hinten Mitte)

Wandschrank 800 × 600 × 250 mm, Tür mit Griff (Klick öffnet mit Animation), Montageplatte verzinkt. Oben Kabeleinführung mit M12-Durchführungen und Kabelverschraubungen.

| Reihe | Inhalt |
|---|---|
| Oben | -Q0 Hauptschalter · -F1 Leitungsschutzschalter · -G1 Netzteil 230 V AC / 24 V DC 5 A mit LED „DC OK“ und Einstellpoti 24–28 V · -F2 Sicherung Sensoren · -F3 Sicherung Aktoren (Sicherungsklemmen mit LED bei Auslösung) · -K0 Sicherheitsrelais (verplombt) |
| Mitte | -A1 S7-1200 CPU 1214C DC/DC/DC · -A2 SM 1231 AI 4 (Strom/Spannung) · -A3 SM 1232 AQ 2 · -A4 SM 1221 DI 8 · Koppelrelais -K1 (Band), -K2 (Pumpe frei) |
| Unten | Klemmleisten: -X1 Versorgung (L+/M-Verteiler, rot/blau markiert) · -X2 digitale Sensoren (3-Stock-Initiatorenklemmen mit LED) · -X3 Analogsignale (Trennklemmen mit Messbuchsen, Schirmauflage) · -X4 Aktoren · Kabelkanäle 40 × 60 mit abnehmbaren Deckeln |

Die Front der CPU und der Module ist originalgetreu nachgebildet: Klemmenblöcke, LED-Reihen (DI-/DQ-Status, RUN/STOP, ERROR, MAINT), Beschriftung.

**Pflicht für die Umsetzung:** Klemmenbezeichnungen und -reihenfolge aus den öffentlich verfügbaren Siemens-Gerätehandbüchern übernehmen, also S7-1200 Systemhandbuch sowie Datenblätter der CPU 1214C DC/DC/DC, SM 1231, SM 1232 und SM 1221. Nichts erfinden. Wo das Spiel vereinfacht, steht es in `docs/SENSORWERKSTATT_ABWEICHUNGEN.md`.

### 2.4 Adress- und Klemmenplan (Grundbelegung)

Der Plan liegt im Spiel als „Klemmenplan“-Blatt am Schrank und im Handbuch. Aufgaben können davon abweichen. Dann gilt das Aufgabenblatt.

Digitaleingänge:

| Adresse | Variable | BMK | Signal | Klemme |
|---|---|---|---|---|
| %I0.0 | Start | -S1 | NO | -X2:1 |
| %I0.1 | Stopp | -S2 | NC | -X2:2 |
| %I0.2 | NotHalt_Meldung | -S3 | NC (Kanal 2) | -X2:3 |
| %I0.3 | Auto | -S4 | NO | -X2:4 |
| %I0.4 | Ind_Metall | -B1 | PNP NO | -X2:5 |
| %I0.5 | Kap_Teil | -B2 | PNP NO | -X2:6 |
| %I0.6 | Taster_Hell | -B3 | PNP | -X2:7 |
| %I0.7 | LS_Band | -B4.2 | PNP | -X2:8 |
| %I1.0 | Rutsche_Voll | -B5 | PNP | -X2:9 |
| %I1.1 | Zyl_Hinten | -B6 | PNP | -X2:10 |
| %I1.2 | Zyl_Vorne | -B7 | PNP | -X2:11 |
| %I1.3 | Haube_Zu | -S5 | NC | -X2:12 |
| %I1.4 | Tank_Nicht_Voll | -B8 | PNP, als NC | -X2:13 |
| %I1.5 | Vorrat_Ok | -B9 | Reed | -X2:14 |
| %I16.0–%I16.7 | frei / Übungen (SM 1221) | -A4 | für NPN-Gruppe und antivalente Sensoren | -X2:21…28 |

Analog:

| Adresse | Variable | BMK | Signal |
|---|---|---|---|
| %IW64 | Abstand_Roh | -B10 | 0–10 V, CPU AI0 |
| %IW66 | Sollwert_Roh | -R1 | 0–10 V, CPU AI1 |
| %IW96 | Druck_Roh | -B11 | 4–20 mA, 2-Leiter, SM 1231 Kanal 0 |
| %IW98 | Temp_Roh | -B12 | 4–20 mA, 2-Leiter, Kanal 1 |
| %IW100 | Durchfluss_Roh | -B13 | 4–20 mA, 4-Leiter, Kanal 2 |
| %IW102 | Reserve / Kalibrator | — | Kanal 3 |
| %QW112 | Pumpe_Soll_Roh | -T2 | 0–10 V, SM 1232 Kanal 0 |
| %QW114 | Ventil_Soll_Roh | -MB5 | 4–20 mA, Kanal 1 |

Ausgänge:

| Adresse | Variable | BMK |
|---|---|---|
| %Q0.0 | Band | -K1 |
| %Q0.1 | Vereinzeler | -MB1 |
| %Q0.2 | Auswerfer | -MB2 |
| %Q0.3 | Pumpe_Frei | -K2 |
| %Q0.4 | Ablauf | -MB3 |
| %Q0.5 | Heizung | -K3 |
| %Q0.6 | Lampe_Gruen | -P1 |
| %Q0.7 | Lampe_Rot | -P2 |
| %Q1.0 | Hupe | -P3 |
| %Q1.1 | Zulauf | -MB4 |

Die Adressen der Signalmodule sind Vorschläge. Das Handbuch erklärt, dass TIA Standardadressen vergibt, die man in der Gerätekonfiguration ändern kann, und warum.

### 2.5 Kameras und Navigation

- **Feste Ansichten** (Leiste unten, Tasten 1–7):
  1. Übersicht
  2. Sortierstrecke
  3. Bedienpult
  4. Tankstation
  5. Schaltschrank (Tür öffnet automatisch)
  6. Klemmleiste nah (orthografisch, gerade von vorn)
  7. Engineering-Laptop (öffnet die Engineering-Oberfläche)
- Zwischen Ansichten ein weicher Kameraflug von 0,6 s, bei „Bewegung reduzieren“ ein Schnitt.
- In jeder Ansicht begrenztes Drehen und Zoomen, sodass man sich nicht verliert. Doppelklick auf ein Bauteil fährt nah heran.
- **Bauteil-Info:** Beim Überfahren erscheint ein Schild mit BMK, Bauteilname und Zustand. Ein Klick öffnet die Detailkarte mit Datenblatt, Anschlussbild und aktuellen Werten.
- **Röntgen-Schalter** (Lernhilfe, in Prüfungsaufgaben aus): zeigt Erfassungsbereiche (Schaltabstand, Lichtstrahl, Schallkegel) und den Stromfluss als Leuchtpfad in den Leitungen.

### 2.6 Technik und Leistungsbudget

- three.js r128 wie in den Quests, alles prozedural erzeugt, keine externen 3D-Modelle.
- Beschriftungen als Canvas-Texturen. Wiederverwendete Geometrien werden instanziert: Klemmen, Adern, Schrauben.
- Budget:
  - höchstens 120 000 Dreiecke und 150 Draw-Calls;
  - Texturen zusammen unter 8 MB;
  - Ziel 60 fps auf einem Schul-Laptop, mindestens 30 fps auf einem Mittelklasse-Handy.
  - Szene lädt in unter 2 s (ohne Download).
- Qualitätsstufen Hoch/Mittel/Niedrig automatisch nach Bildrate, manuell in den Einstellungen. Bei „Niedrig“ ohne Schatten und Wasser-Shader.
- **2D-Rückfall:** Schematische Frontansicht von Klemmleiste und Anlage (SVG) mit identischer Bedienung, für schwache Geräte und Barrierefreiheit. Alle Aufgaben sind auch in 2D lösbar.

---

## Teil 3 – Sensoren anschliessen: realistische Bedienung

### 3.1 Die drei Ebenen des Anschliessens

**Ebene A – Feld (am Sensor):**
1. **Sensor wählen** (nur wenn die Aufgabe es verlangt): Kiste im Ersatzteilregal öffnen. Die Sensoren haben Typenschilder mit Kurzbezeichnung, zum Beispiel „IND M18 PNP NO Sn8 bündig“. Das Datenblatt ist per Klick lesbar.
2. **Montieren:** Sensor auf den Halter ziehen. Mit dem Gabelschlüssel die **Kontermuttern lösen**, Sensor auf den Zielabstand schieben (Skala in mm, Feinschritt 0,5 mm), Muttern **festziehen**.
   - Nicht festgezogen: Der Sensor wandert durch Vibration langsam weg. Das ist ein späterer Fehler, realistisch und lehrreich.
   - Lichtschranken **ausrichten** mit zwei Rändelschrauben: horizontal und vertikal, bis die Stabilitäts-LED ruhig leuchtet.
   - Zylinderschalter in der Nut verschieben und mit dem Schraubendreher festklemmen.
3. **Anstecken:** Die M12-Anschlussleitung (Kupplung, 4-polig, A-codiert) an den Sensorstecker führen und die Rändelmutter mit einer Drehgeste bzw. einem Klick festziehen.
   - Nicht festgezogen: Wackelkontakt, das Signal fällt sporadisch aus.
   - Belegung sichtbar auf der Detailkarte: 1 BN = L+, 2 WH, 3 BU = M, 4 BK = Signal.
   - 2-Leiter-Geräte (Sender, Reed, Transmitter) haben nur BN und BU bzw. + und −.
4. **Transmitter mit Anschlusskopf** (-B12): Deckel abschrauben, Adern auf die Klemmen + und − im Kopf legen, Deckel zu.

**Ebene B – Leitungsweg:**
- Die Leitung wird im Kabelkanal zum Schrank geführt. Das passiert automatisch entlang der Nut und des Kanals, sobald man „Leitung verlegen“ wählt.
- Im Profi-Modus muss man die Kabeleinführung am Schrank wählen: M12-Durchführung oder Kabelverschraubung. Analogleitungen sind **geschirmte Leitungen** mit eigenem Symbol.

**Ebene C – Schrank (Klemmleiste):**
1. **Aderendhülsen:** Die offenen Adern (feindrähtig) brauchen Aderendhülsen. Aderende anklicken und Crimpzange wählen, dann erscheint die Hülse. In der Realitätsstufe „Schnell“ passiert das automatisch.
2. **Auflegen auf Push-in-Klemmen:** Ader antippen oder ziehen und auf die Klemmstelle legen. Die Klemmstelle leuchtet beim Darüberfahren auf und rastet ein.
   - **Lösen:** Mit dem Schraubendreher den Drücker betätigen und die Ader herausziehen.
   - Ader ohne Hülse in die Klemme: Je nach Realitätsstufe gibt es eine Warnung oder einen sporadischen Wackelkontakt.
3. **3-Stock-Initiatorenklemmen (-X2):** Jede Klemme hat drei Ebenen: oben L+, Mitte Signal, unten M. Eine gelbe LED zeigt, ob das Signal ankommt. L+ und M werden über **Querbrücker** mit dem Versorgungsverteiler -X1 verbunden. Querbrücker einstecken ist eine eigene Handlung.
4. **Trennklemmen mit Messbuchsen (-X3):** Für 4–20 mA. Mit dem Schraubendreher lässt sich das Trennmesser öffnen. Dann ist die Schleife unterbrochen: Die SPS sieht einen Drahtbruch, und man kann über die Messbuchsen den Strom messen.
5. **Schirmauflage (-X3):** Bei Analogleitungen den Schirm mit der Schirmklemme auf die Schirmschiene legen.
   - Fehlt der Schirm, ist das Messsignal verrauscht. Das Rauschen ist an Rohwert und Trendkurve sichtbar.
   - Vereinfachung, im Spiel markiert: echte EMV-Effekte sind komplexer.
6. **Brücken von den Klemmen zur SPS:** Im Schrank sind die Leitungen von -X2/-X3 zur CPU **teilweise vorverdrahtet**. Welche fehlen, bestimmt die Aufgabe. Diese Einzeladern (0,75 mm², dunkelblau für DC-Steuerstromkreise, mit Aderbeschriftung) legt man ebenfalls auf, auf die CPU-Klemmenblöcke.
7. **1M / Bezugspotential:** Der Anschluss 1M der Eingangsgruppe wird mit einer Ader auf M gelegt (PNP-Sensoren) oder auf L+ (NPN-Sensoren). Genau hier entscheidet sich PNP/NPN.
8. **Analogmodul:** Kanal +/− je nach Transmitter.
   - 2-Leiter: L+ → Transmitter + ; Transmitter − → AI x+ ; AI x− → M.
   - 4-Leiter: Transmitterausgang + → AI x+ ; Ausgang − → AI x−.
   - Die genauen Klemmennamen kommen aus dem Gerätehandbuch.

### 3.2 Arbeitsregeln wie im echten Schrank

| Regel | Umsetzung im Spiel |
|---|---|
| Nur im spannungsfreien Zustand verdrahten | Ist -Q0 eingeschaltet, erscheinen beim Verdrahten eine Warnung (ARIA grinst) und ein Sicherheits-Minuspunkt in der Aufgabe. In Stufe „Profi“ ist das Auflegen gesperrt. |
| Ein Leiter pro Klemmstelle | Zweite Ader auf dieselbe Stelle: Warnung „Querbrücker oder Doppelstock-Klemme verwenden“ |
| Aderendhülse bei feindrähtigen Leitern | siehe 3.1 |
| Aderbeschriftung = Klemmenplan | Profi-Stufe: Beschriftung aus einer Liste wählen, muss zum Plan passen |
| Vor dem Einschalten prüfen | Knopf „Sichtprüfung“ (zeigt offene Adern) und Multimeter-Durchgangsprüfung. In Profi-Aufgaben Teil der Bewertung |
| Schrank schliessen, dann einschalten | Einschalten mit offener Tür erlaubt (Werkstatt), aber ARIA kommentiert |

### 3.3 Realitätsstufen

Einstellbar pro Person. Aufgaben verlangen eine Mindeststufe. Eine höhere Stufe gibt Bonuspunkte.

| | Schnell | Werkstatt (Standard) | Profi |
|---|---|---|---|
| Aderendhülsen | automatisch | selbst crimpen | selbst crimpen |
| Querbrücker L+/M | vorhanden | selbst setzen | selbst setzen |
| Leitung verlegen | automatisch | automatisch | Einführung wählen, Schirm auflegen |
| Beschriftung | automatisch | automatisch | selbst, muss passen |
| Spannungsfreiheit | nur Hinweis | Warnung + Minuspunkt | Pflicht |
| Prüfen vor dem Einschalten | freiwillig | empfohlen | Pflicht (Sichtprüfung + Durchgang) |

### 3.4 Was bei Fehlern passiert (Simulation)

| Fehler | Folge in der Anlage (sichtbar/messbar) |
|---|---|
| BN und BU vertauscht (3-Leiter PNP) | Sensor ohne Funktion, Betriebs-LED aus. Die meisten Sensoren sind verpolungsgeschützt, ohne Schaden. |
| Signalader BK auf M gelegt | Kurzschluss am Ausgang: Sensor schaltet ab, LED blinkt (Kurzschlussschutz). Sonst normal. |
| L+ direkt auf M (Brücke falsch) | Netzteil -G1 geht in Überlast, „DC OK“ aus, **alles aus**. Nach dem Beheben neu starten. |
| Sicherungsklemme -F2 ausgelöst | Rote LED an -F2, alle Sensoren aus. Ursache finden und zurücksetzen |
| PNP-Sensor, 1M auf L+ | Sensor-LED an, **Eingangs-LED aus**. Der Klassiker |
| NPN-Sensor, 1M auf M | Sensor-LED an, Eingang aus |
| Signalader auf falschem Eingang | Anderer Eingang reagiert. Im Programm „falsches Teil erkannt“ |
| Öffner als Schliesser verdrahtet (4-Leiter WH statt BK) | Logik invertiert. Drahtbruch wird nicht erkannt |
| 2-Leiter-Transmitter ohne Versorgung in der Schleife | 0 mA → Drahtbruch/Unterlauf, Diagnose-LED rot |
| 4-Leiter-Transmitter wie 2-Leiter angeschlossen | Falscher Messwert oder keiner (Modell: 0 mA) |
| Stromsignal an Kanal mit Konfiguration „Spannung“ | Rohwert fast 0 bzw. Unsinn |
| Konfiguration 0–20 mA statt 4–20 mA | Leerer Tank zeigt 20 % (4 mA → Rohwert 5530) |
| Schirm nicht aufgelegt | Rauschen ±1–2 % auf dem Rohwert |
| Trennmesser offen | Drahtbruch |
| Ader ohne Hülse / Stecker nicht festgezogen | Sporadische Aussetzer (Wackelkontakt), im Trend sichtbar |
| Sensor nicht festgezogen | Schaltabstand driftet langsam |

Alle Folgen kommen aus `sensor_model.js`. Szene, Tests und Störungsjagd nutzen dasselbe Modell.

### 3.5 Prüfung der Verdrahtung (Algorithmus)

- Die Verdrahtung wird als **Netzliste** gespeichert: Knoten sind Klemmstellen, Kanten sind Adern, Brücken und interne Verbindungen (Klemmenebenen, Querbrücker, Modulinterna).
- Bewertet wird die **elektrische Funktion**, nicht die exakte Klemme:
  - Beispiel: „BN von -B1 hängt am Potential L+ (über irgendeinen Verteiler)“, „BK von -B1 hängt an %I0.4“.
  - Alternativen sind erlaubt, wenn die Aufgabe es zulässt, etwa ein freier Eingang plus angepasste Variablentabelle.
- Zusätzlich prüft der Algorithmus die Arbeitsregeln aus 3.2 (je nach Stufe) und die Aufgabenziele, etwa „Öffner verwenden“.
- Rückmeldung nach „Verdrahtung prüfen“: Liste der Abweichungen in Fachsprache, ohne sie zu verraten. Beispiel: „-B11: Stromschleife nicht geschlossen“, „-X2:5: zwei Leiter an einer Klemmstelle“.
- Speicherformat: JSON `{ wires:[{from:'B1:BN', to:'X2:5.L+', ferrule:true, label:'…'}], bridges:[…], mounts:{B1:{dist:6.0, tight:true}}, config:{…} }`. Es wird im Spielstand gespeichert und im Leitstand für den Dozenten als Bild gerendert.

### 3.6 Bedienung auf Touch-Geräten und Barrierefreiheit

- **Antippen-Antippen:** Ader antippen, dann Klemmstelle antippen, fertig. Kein Ziehen nötig.
- Lupe beim Tippen auf der Klemmleiste, grosse Trefferflächen (mindestens 44 px).
- Rückgängig/Wiederholen, „Alle Adern dieses Sensors lösen“.
- Die 2D-Klemmleisten-Ansicht ist gleichwertig und auch per Tastatur bedienbar: Tab/Pfeile, Enter = auflegen.
- Aderfarben sind immer zusätzlich beschriftet (BN/BU/BK/WH). Farbsehhilfe wie in den Quests.

---

## Teil 4 – Werkzeuge und Engineering

### 4.1 Multimeter
- Drehschalter mit den Stellungen: V DC, mA DC, Ω, Durchgang (Piepton), Aus.
- Drei Buchsen: COM, V/Ω, mA. Die Messspitzen tippt man auf zwei Klemmstellen, Messbuchsen oder Sensorpins.
- Anzeige mit realistischer Auflösung und kleinem Rauschen.
- Fehlbedienung wie Strommessung parallel zu einer Spannung: Die Sicherung im Multimeter löst aus („Sicherung defekt“). Man muss sie ersetzen, das kostet in der Aufgabe einen Minuspunkt. Lerneffekt: Strom wird in Reihe gemessen.
- Messwerte lassen sich per Knopf ins **Messprotokoll** übernehmen.

### 4.2 Stromkalibrator (Loop-Check)
- Speist einen einstellbaren Strom von 0–24 mA in einen Analogkanal, anstelle des Transmitters.
- Übliche Inbetriebnahme-Praxis: 4 / 12 / 20 mA einspeisen und die Anzeige im HMI prüfen.
- Kann auch 2-Leiter-Transmitter simulieren (Modus „Senke“). Vereinfachung markiert.

### 4.3 Engineering-Laptop (TIA-ähnlich, keine Siemens-Kopie)
Die Oberfläche ist an die Arbeitsweise im TIA Portal angelehnt: Begriffe und Abläufe stimmen, das Aussehen ist eigenständig, ohne Logos und ohne kopierte Grafiken.
- **Gerätesicht:** Rack mit Steckplätzen. Man klickt ein Modul an, die Eigenschaften öffnen sich.
  - DI: Eingangsverzögerung.
  - AI-Kanal: Messart (deaktiviert / Spannung / Strom 4-Draht / Strom 2-Draht), Messbereich (±10 V, 0–10 V, 0–20 mA, 4–20 mA), Glättung (keine/schwach/mittel/stark), Diagnose Drahtbruch, Überlauf, Unterlauf.
  - AQ-Kanal: Ausgabeart, Bereich, Ersatzwert bei STOP.
  - Die angebotenen Einstellungen pro Modul richten sich nach dem Gerätehandbuch.
- **PLC-Variablentabelle:** Name, Datentyp, Adresse, Kommentar. Fehler wie doppelte Adressen werden gemeldet.
- **Programmeditor:** der vorhandene Editor mit Umschalter SCL/KOP/FUP, Bausteine OB1 und bei Bedarf FC.
- **Übersetzen und Laden:** „In Gerät laden“ mit kurzem Dialog, danach CPU von STOP auf RUN (LED-Wechsel am 3D-Modell). Konfigurationsänderungen erfordern Laden.
- **Beobachtungstabelle:** Adressen und Variablen live, auch Rohwerte als Dezimal- und Hex-Anzeige, Trendkurve für Analogwerte.
- **Online & Diagnose:** Diagnosepuffer mit Klartext, zum Beispiel „SM 1231 Steckplatz 2, Kanal 1: Drahtbruch“, und Modulzustand (LED am 3D-Modul entsprechend).

### 4.4 HMI-Panel am Prüfstand
Zeigt die skalierten Werte der Aufgabe (Füllstand mm, Temperatur °C, Druck mbar, Durchfluss l/min) sowie Meldungen. In Programmieraufgaben schreibt das Programm die HMI-Variablen. Das HMI zeigt, was das Programm berechnet, damit falsche Skalierungen sofort sichtbar werden.

---

## Teil 5 – Simulationsmodell `sensor_model.js`

Eine Kette, die von allen Teilen gemeinsam genutzt wird:

```
Physik → Sensor/Transmitter → Montage/Stecker → Leitung/Klemmen (Netzliste) → Versorgung
      → DI-Gruppe (1M) / AI-Kanal (Konfiguration) → Rohwert → Programm (Engine) → Ausgänge → AQ → Aktor → Physik
```

- **Zeitschritt:** 50 ms für Physik und SPS-Zyklus, entkoppelt von der Bildrate. Programm-Tests laufen deterministisch mit festem Seed und ohne Rauschen, sofern der Test Rauschen nicht ausdrücklich verlangt.
- **Digitale Sensoren:** Schaltpunkt aus Abstand × Materialfaktor, Schalthysterese etwa 10 %, NO/NC, hell/dunkel, PNP/NPN, Kurzschluss- und Verpolschutz, Fehlerzustände (Tabelle 3.4).

**Induktive Sensoren – Materialfaktoren (typische Richtwerte, im Handbuch als solche gekennzeichnet):**

| Material | Faktor |
|---|---|
| Stahl | 1,0 |
| Edelstahl | 0,7 |
| Messing | 0,5 |
| Aluminium | 0,4 |
| Kunststoff, Glas | 0 |

**Kapazitive Sensoren:** Empfindlichkeit über das Poti; Kunststoff und Glas werden erkannt; durch die Acrylwand hindurch nur Wasser, bei richtiger Einstellung.

**Optische Sensoren:**
- Weiss wird weiter erkannt als Schwarz.
- Glas wird von der Reflexions-Lichtschranke unsicher erkannt.
- Der Lichttaster mit Hintergrundausblendung ignoriert das Band, aber nur bei korrektem Teach-in.

**Analoge Kennlinien:**

| Signal | Kennlinie |
|---|---|
| 0–10 V | U = 10 V · (x − xmin)/(xmax − xmin) |
| 4–20 mA | I = 4 mA + 16 mA · (x − xmin)/(xmax − xmin) |

**Rohwerte S7-1200/1500:**
- **Nennbereich** 0–27648. Bei 4–20 mA entspricht 4 mA dem Wert 0 und 20 mA dem Wert 27648.
- **Übersteuerung** bis 32511. Das entspricht etwa 11,76 V bei 0–10 V bzw. 22,81 mA bei 4–20 mA.
- **Untersteuerung** bei 4–20 mA bis −4864, also etwa 1,185 mA.
- **Sonderwerte** bei Überlauf bzw. Drahtbruch, abhängig von Modul und Diagnose-Einstellung.
- **Pflicht vor der Umsetzung:** Alle Sonderwerte gegen das Gerätehandbuch der SM 1231 und der CPU-Onboard-AI prüfen und in Tests festhalten. Abweichungen dokumentieren.

**NORM_X/SCALE_X:** Engine-Erweiterung in SCL, KOP und FUP.
- NORM_X liefert REAL. SCALE_X liefert REAL oder INT, passend zur Zielvariable.
- Werte ausserhalb von MIN…MAX werden linear weitergerechnet.
- Verhalten von Typen und ENO gegen die TIA-Hilfe abgleichen.

**Physik Tank:**
- Pegel aus Volumenbilanz.
- Hydrostatischer Druck p = ρ·g·h.
- Temperatur aus Heizleistung, Verlust und Zulauf.
- Durchfluss aus Pumpendrehzahl und Ventilstellung.

---

## Teil 6 – Module und Aufgaben (60)

Aufbau je Modul: Theorie A → Aufgaben 1–5 → Theorie B → Aufgaben 6–9 → Werkstatt-Boss 10.

Typen: V Verdrahten · Mo Montieren/Einstellen · M Messen · K Konfigurieren · R Rechnen · P Programmieren (SCL/KOP/FUP) · F Fehlersuche · L Laden/Beobachten.
Mindeststufe: S = Schnell, W = Werkstatt, P = Profi.

### 6.1 Werkstücke × Sensoren (Grundlage für Aufgaben und Validator)

| Werkstück | -B1 induktiv | -B2 kapazitiv | -B3 Taster (Teach Band) | -B5 Reflex |
|---|---|---|---|---|
| Stahl | ja (bis 8 mm) | ja | ja | ja |
| Edelstahl | ja (bis 5,6 mm) | ja | ja | ja |
| Aluminium | ja (bis 3,2 mm) | ja | ja | ja |
| Messing | ja (bis 4 mm) | ja | ja | ja |
| Kunststoff weiss | nein | ja (Poti ≥ mittel) | ja | ja |
| Kunststoff schwarz | nein | ja (Poti ≥ mittel) | nur auf kurze Distanz | ja |
| Glas | nein | ja (Poti hoch) | unsicher | unsicher |

### Modul 1 – Signale und digitale Sensoren anschliessen
- **Theorie A:** Vom Sensor zur SPS. Signalarten, 24-V-Technik, L+/M, Adresse und Variable.
- **Theorie B:** Anschlussbilder. M12-Belegung, 2/3/4-Leiter, NO/NC, Datenblatt lesen.

| Nr. | Aufgabe | Typ | Stufe |
|---|---|---|---|
| 1 | Typenschild und Datenblatt von -B1 lesen: Versorgung, Ausgang, Sn, bündig, Schutzart | R | S |
| 2 | -B1 montieren (Abstand 4 mm), M12-Leitung anstecken, auf -X2:5 auflegen, einschalten, Stahlteil vorbeiführen, LEDs beobachten | Mo/V | S |
| 3 | Taster Start (NO) und Stopp (NC) anschliessen. In der Beobachtungstabelle zeigen: Stopp ist im Ruhezustand 1 | V/L | S |
| 4 | PLC-Variablentabelle der Sortierstrecke nach Klemmenplan anlegen | K | S |
| 5 | Programm: Band läuft mit Start, stoppt mit Stopp oder Haube offen (Selbsthaltung, Öffner richtig ausgewertet) | P/L | S |
| 6 | Antivalenter 4-Leiter-Sensor an SM 1221 (NO auf %I16.0, NC auf %I16.1) | V | W |
| 7 | Drahtbruch an -S5 simulieren (Ader lösen): Warum stoppt das Band? Vergleich mit Schliesser-Verdrahtung | V/F | W |
| 8 | Programm: Antivalenzüberwachung. NO = NC länger als 100 ms → Sensorfehler | P | W |
| 9 | Fehlersuche: Sensor-LED an, Eingang aus, BK auf falscher Klemmenebene | F | W |
| 10 | **Boss:** Sortierstrecke komplett: 5 Sensoren montieren, anschliessen, Querbrücker setzen, Variablen anlegen, Bandfreigabe programmieren, laden, testen | Mo/V/K/P/L | W |

### Modul 2 – PNP und NPN
- **Theorie A:** Wer schaltet was? Plus- und minusschaltend, Stromfluss animiert, Messung gegen M bzw. L+.
- **Theorie B:** Eingangsbeschaltung. Sink/Source, 1M bei der S7-1200, Eingangsgruppen, typische Baugruppen (viele nur PNP).

| Nr. | Aufgabe | Typ | Stufe |
|---|---|---|---|
| 1 | PNP-Sensor: Signal gegen M messen, mit und ohne Teil (24 V / 0 V) | M | S |
| 2 | NPN-Sensor: gegen M und gegen L+ messen. Was fällt auf? | M | S |
| 3 | 1M der CPU-Eingangsgruppe richtig auflegen, sodass PNP-Sensoren funktionieren | V | W |
| 4 | SM 1221 für NPN beschalten (Bezugspotential nach Handbuch), NPN-Sensor anschliessen | V | W |
| 5 | Programm: Teilezähler mit Flanke am PNP-Sensor, Anzeige am HMI | P | S |
| 6 | Tabelle ausfüllen: 4 Kombinationen Sensor/Eingangsbeschaltung → funktioniert ja/nein, warum | R | S |
| 7 | Ersatzteil ist NPN, Anlage ist PNP: Lösungen bewerten (anderer Sensor, Koppelrelais, Signalwandler) | R | W |
| 8 | Fehlersuche: neuer Sensor, Eingang tot (NPN an PNP-Gruppe) | F | W |
| 9 | Fehlersuche: Sensor-LED blinkt, Ausgang schaltet ab (BK auf M) | F | W |
| 10 | **Boss:** Gemischter Umbau. 3 PNP an der CPU, 2 NPN an der SM 1221, alles anschliessen, konfigurieren, Sortierlogik anpassen | V/K/P/L | W |

### Modul 3 – Sensortypen im Einsatz
- **Theorie A:** Induktiv und kapazitiv. Wirkprinzip, Schaltabstand, Reduktionsfaktor, bündig/nicht bündig, durch die Behälterwand.
- **Theorie B:** Optisch und magnetisch. Einweg, Reflex, Taster, Hintergrundausblendung, hell/dunkel, Funktionsreserve, Zylinderschalter.

| Nr. | Aufgabe | Typ | Stufe |
|---|---|---|---|
| 1 | -B1: Schaltabstand für Stahl und Aluminium mit der Abstandsskala ermitteln | Mo/M | S |
| 2 | Einbauabstand rechnen: Sn 8 mm, Aluminium, 80 % Sicherheit → Abstand? | R | S |
| 3 | -B2 mit dem Poti einstellen: erkennt Kunststoff, nicht aber das Band | Mo | W |
| 4 | -B3 per Teach-in auf das Band einstellen (Hintergrund ausblenden), hell/dunkel passend wählen | Mo | W |
| 5 | Programm: Materialsortierung. Metall → Rutsche A, Kunststoff → Behälter B | P | S |
| 6 | Einweg-Lichtschranke -B4 ausrichten, bis die Funktionsreserve stabil ist. Warum ist Einweg bei Glas besser? | Mo/R | W |
| 7 | Zylinderschalter -B6/-B7 auf die Endlagen setzen und festklemmen | Mo | W |
| 8 | Programm: Auswerfer mit Endlagen-Zeitüberwachung (2 s → Störung, Lampe rot) | P | W |
| 9 | Fehlersuche: Alu-Teile werden nicht erkannt (Abstand zu gross, Mutter lose) | F | W |
| 10 | **Boss:** 7 Werkstückarten sortieren. Sensoren wählen und einstellen, Logiktabelle erstellen, programmieren | Mo/R/P | W |

### Modul 4 – Analogsignale verstehen
- **Theorie A:** Spannung und Strom. 0–10 V, 0/4–20 mA, Live Zero, Störfestigkeit, 2- und 4-Leiter, Schirmung.
- **Theorie B:** Vom Signal zum Rohwert. Nennbereich 0–27648, Über- und Untersteuerung, Sonderwerte, Diagnose, Glättung, Auflösung.

| Nr. | Aufgabe | Typ | Stufe |
|---|---|---|---|
| 1 | -B10 (0–10 V) an CPU-AI0 anschliessen, Spannung bei 3 Füllständen messen, ins Protokoll | V/M | S |
| 2 | Rohwerte zu 2,5 / 5 / 7,5 / 10 V berechnen, in der Beobachtungstabelle prüfen | R/L | S |
| 3 | -B11 (2-Leiter, 4–20 mA) an SM 1231 Kanal 0 anschliessen und in der Gerätesicht konfigurieren (Strom 2-Draht, 4–20 mA, Drahtbruch an), laden | V/K/L | W |
| 4 | Rohwerte zu 4 / 8 / 12 / 16 / 20 mA berechnen | R | S |
| 5 | Loop-Check mit Kalibrator an Kanal 1: 4 / 12 / 20 mA einspeisen, Rohwerte protokollieren | M/L | W |
| 6 | -B12 im Anschlusskopf anschliessen, Schirm auflegen, Trendkurve mit und ohne Schirm vergleichen | V/M | P |
| 7 | Trennmesser öffnen: Strom messen (Multimeter in Reihe), dann Diagnosepuffer lesen | M/L | W |
| 8 | -B13 (4-Leiter) anschliessen: Worin unterscheidet sich die Verdrahtung? | V/K | W |
| 9 | Programm: Rohwert auf Unter- und Überlauf sowie Drahtbruch prüfen, Status am HMI | P | W |
| 10 | **Boss:** Alle 4 Analogsignale der Tankstation anschliessen, konfigurieren, per Loop-Check abnehmen | V/K/M/L | W |

### Modul 5 – NORM_X und SCALE_X
- **Theorie A:** Skalieren ist Geradengleichung. Zwei Punkte, Steigung, Offset, Normieren auf 0…1, Rechenweg.
- **Theorie B:** NORM_X, SCALE_X und Datentypen. Parameter, INT/REAL, Einheiten, Werte ausserhalb, Analogausgabe rückwärts.

| Nr. | Aufgabe | Typ | Stufe |
|---|---|---|---|
| 1 | Von Hand: -R1 Sollwertsteller 0–10 V → 0–100 %. Rohwert 13824 → ? % (Lösung 50 %) | R | S |
| 2 | Programm: Druck -B11 → mbar (REAL) mit NORM_X + SCALE_X, Anzeige am HMI | P/L | S |
| 3 | Programm: Pegel aus Druck: h = p / (ρ·g), mbar → mm | P | W |
| 4 | Programm: Temperatur -B12 → °C | P | S |
| 5 | Programm: Ultraschall -B10 → Abstand mm (60–800 mm) → Füllstand = Einbauhöhe − Abstand | P | W |
| 6 | Programm: Pumpendrehzahl 0–100 % → 0–10 V an %QW112 (NORM_X → SCALE_X als INT) | P/L | S |
| 7 | Programm: Stellventil 0–100 % → 4–20 mA, Sollwert mit LIMIT begrenzen | P | W |
| 8 | Fehlersuche: Anzeige 20 % bei leerem Tank (0–20 mA statt 4–20 mA konfiguriert) | F/K | W |
| 9 | Fehlersuche: Temperatur zeigt 118,5 °C (Sonderwert 32767 ungeprüft skaliert), Abfangen programmieren | F/P | W |
| 10 | **Boss:** Tankstation-HMI komplett. Alle Werte skaliert, Pumpe folgt dem Sollwertsteller, Plausibilität Ultraschall ↔ Druck | P/L | W |

### Modul 6 – Messwerte sicher verarbeiten
- **Theorie A:** Grenzwerte und Hysterese. Flattern, Warn- und Alarmgrenzen, Meldungen.
- **Theorie B:** Kalibrieren und Plausibilität. Offset, 2-Punkt-Kalibrierung, gleitender Mittelwert, Vergleich zweier Messprinzipien.

| Nr. | Aufgabe | Typ | Stufe |
|---|---|---|---|
| 1 | Programm: Heizung mit Hysterese (Ein < 58 °C, Aus > 62 °C) | P | S |
| 2 | Programm: Füllstand Warnung/Alarm hoch/tief mit Hysterese, Lampen/Hupe | P | S |
| 3 | Offset-Kalibrierung: Tank leer, Anzeige 12 mm → korrigieren | M/P | W |
| 4 | 2-Punkt-Kalibrierung: Pegel 100 mm und 500 mm mit Massstab messen, MIN/MAX berechnen und eintragen | M/R/P | W |
| 5 | Programm: gleitender Mittelwert über 8 Werte gegen Rauschen, Vergleich mit Modul-Glättung | P/K | W |
| 6 | Programm: Plausibilität Ultraschall ↔ Druck, Abweichung > 5 % → Meldung | P | W |
| 7 | Programm: Trockenlaufschutz (Schwimmer ODER Pegel < 10 %) und Tank-voll-Abschaltung (Öffner!) | P | W |
| 8 | Fehlersuche: Heizung schaltet im Sekundentakt (Hysterese fehlt) | F | S |
| 9 | Fehlersuche: Tank läuft über, -B8 als Schliesser ausgewertet und Signalader auf WH | F | W |
| 10 | **Werkstatt-Finale:** ARIA hat sabotiert (1 Montagefehler, 1 Verdrahtungsfehler, 1 Konfigurationsfehler, 1 Programmfehler). Alles finden, beheben, Tankstation und Sortierstrecke gleichzeitig in Betrieb nehmen | alle | P |

**Summe:** 60 Aufgaben (davon 29 mit SPS-Teil), 12 Theorien, 6 Bosse.

---

## Teil 7 – Theorie, Handbuch, Glossar

- **12 Theorien:** Lektion + 5 Fragen, 80 % zum Bestehen, wie in den Quests. Interaktive Lektionsbausteine:
  - `StromflussPNPNPN`: Sensorart und 1M umschalten, Stromfluss animiert.
  - `KennlinienRechner`: Schieberegler physikalisch → V/mA → Rohwert → NORM_X → SCALE_X.
  - `SchaltabstandDiagramm`: Material × Abstand.
  - `M12Belegung`: Pins antippen.
- **14 Handbuchseiten:**
  - Sensorübersicht und Auswahl
  - M12 und Aderfarben
  - NO/NC und Drahtbruchsicherheit
  - PNP/NPN
  - Eingangsbeschaltung S7-1200/1500
  - Induktiv/kapazitiv
  - Optisch
  - Zylinderschalter
  - Analogsignale und Schirmung
  - 2-/4-Leiter-Transmitter
  - Rohwerte und Sonderwerte
  - NORM_X/SCALE_X
  - Analogausgabe
  - Hysterese, Kalibrieren und Plausibilität
- **Zusätzlich** die Seite „Arbeiten im Schaltschrank“: Klemmen, Aderendhülsen, Querbrücker, Beschriftung, Spannungsfreiheit.
- **Glossar:** Schaltabstand, Reduktionsfaktor, bündig, Funktionsreserve, Hintergrundausblendung, hellschaltend, antivalent, Live Zero, Messumformer/Transmitter, Bürde, Rohwert, Nennbereich, Übersteuerung, Schirmauflage, Querbrücker, Initiatorenklemme, Trennklemme, Loop-Check.
- Jede Aufgabe verweist auf ihre Theorie und Handbuchseite. Nach einer Fehlersuche-Aufgabe erscheint ein Kasten „Aus der Praxis“ mit einer kurzen Geschichte des Werkmeisters.

---

## Teil 8 – Technik und Datenformate

### 8.1 Dateien

```
dev/src/sensor_model.js       Simulationskette (Teil 5), rein rechnend, ohne DOM
dev/src/wiring.js             Netzliste, Klemmen-/Aderkatalog, Regeln, Prüfung, Serialisierung
dev/src/scene_sensor.js       3D-Werkstatt (Teil 2), Kamera, Interaktion, Werkzeuge
dev/src/scene_sensor2d.js     2D-Rückfall (SVG)
dev/src/workshop_ui.js        Werkzeugleiste, Multimeter, Kalibrator, Messprotokoll, Detailkarten
dev/src/engineering_ui.js     Gerätesicht, Variablentabelle, Laden, Beobachtung, Diagnosepuffer
dev/src/content_sensor/       _sensor.js (Kataloge: Bauteile, Klemmen, Module), m1.js … m6.js, theory.js, manual.js, bugs.js
dev/validate_sensor.js        Validator
dev/test_sensor_model.js      Unit-Tests Modell + Netzliste
dev/tests/sensor_playthrough.js   Browser-Durchlauf aller 60 Aufgaben (SCL, KOP, FUP)
docs/SENSORWERKSTATT_ABWEICHUNGEN.md   Vereinfachungen gegenüber der Realität
```

Build: `web/sensor/` + Offline-Datei `sensor.html`. Eigener Speicherschlüssel, Sync mit dem Konto (`spsquest_sync_sensor`), Quest-Kennung `sensor` im Worker für Fortschritt und Challenges.

### 8.2 Aufgabenformat

```js
defWorkshopTask({
  id: 'w4_druck_anschliessen', module: 4, no: 3, title: '…', story: '…', brief: '…',
  level: 'werkstatt',                         // Mindest-Realitätsstufe
  steps: [
    { kind: 'wire',
      start: 'preset:m4_base',                // vorverdrahteter Ausgangszustand
      target: [                               // Funktionsanforderungen (Teil 3.5)
        { net: ['B11:+', 'POT:L+'] },
        { net: ['B11:-', 'A2:CH0+'] },
        { net: ['A2:CH0-', 'POT:M'] },
        { shield: 'B11', on: 'X3:SHIELD' }    // nur ab Stufe Profi geprüft
      ],
      wrong: [ /* typische Fehlverdrahtungen, müssen scheitern */ ] },
    { kind: 'config', target: { 'A2.ch0': { type: 'I_2W', range: '4..20mA', diag: { wireBreak: true } } } },
    { kind: 'load' },
    { kind: 'measure', ask: [{ what: 'raw', at: { level_mm: 300 }, tol: 50 }] }
  ],
  man: 'transmitter', theory: 'st4a',
  hints: ['…', '…']
});

defWorkshopTask({
  id: 'w5_druck_skalieren', module: 5, no: 2,
  steps: [{ kind: 'program',
    langs: ['scl', 'kop', 'fup'],
    vars: 'table:werkstatt',                 // PLC-Variablentabelle der Werkstatt
    ref: { scl: '…', kop: '…', fup: '…' },
    start: { scl: '', kop: '', fup: '' },
    tests: [                                  // physikalische Szenarien, Modell erzeugt Rohwerte
      { phys: { pressure_mbar: 0 },  expect: { '"Druck_mbar"': [0.0, 0.1] } },
      { phys: { pressure_mbar: 50 }, expect: { '"Druck_mbar"': [50.0, 0.1] } },
      { phys: { pressure_mbar: 100 }, expect: { '"Druck_mbar"': [100.0, 0.1] } }
    ],
    must: ['NORM_X', 'SCALE_X'],
    wrong: [{ scl: '…MAX := 32767…' }] }]
});
```

- `phys` sind Werte der physikalischen Welt. Die Umrechnung in Rohwerte macht `sensor_model.js` mit der Konfiguration der Aufgabe.
- Erwartungen als `[Wert, Toleranz]` für REAL.
- Presets (`preset:m4_base`) sind benannte Verdrahtungs-/Konfigurationszustände in `_sensor.js`, damit nicht jede Aufgabe bei null beginnt.

### 8.3 Engine-Erweiterungen

1. `NORM_X`, `SCALE_X` in `engine.js` (Grundstufe) und `engine_pro.js` mit Typprüfung wie im TIA Portal, dazu Boxen in `kop.js`/`kop_editor.js` für KOP und FUP.
2. Zugriff auf Rohwerte über Adressen (`%IW96`) **und** symbolisch über die Variablentabelle. Die Variablentabelle bildet Symbol ↔ Adresse ab.
3. Keine Verhaltensänderung für bestehende Aufgaben. Alle bisherigen Tests bleiben unverändert grün.

### 8.4 Validator `validate_sensor.js`

- Verdrahtungsschritte: Referenzlösung erfüllt `target`, jede `wrong`-Variante nicht. Presets sind konsistent (keine Kurzschlüsse, sofern nicht beabsichtigt).
- Konfiguration: Referenz ergibt die erwarteten Rohwerte, falsche Varianten die beschriebenen Symptome.
- Programmschritte: Referenz in **allen drei Sprachen** besteht, Startcode und `wrong` scheitern, `must` erfüllt, warnungsfrei.
- Mess- und Rechenschritte: Musterwert = Modellwert (mit Toleranz).
- Fehlersuche: Der eingebaute Fehler erzeugt das in der Aufgabe beschriebene Symptom, die Referenzbehebung beseitigt es.
- Modell-Konsistenz: Tabellen 6.1 und 5 werden gegen `sensor_model.js` geprüft. Rohwertformeln gegen feste Stützpunkte: 4 mA→0, 12 mA→13824, 20 mA→27648, 5 V→13824.
- IDs eindeutig, jede Aufgabe mit Theorie und Handbuchseite, Mindestanzahlen je Modul.

---

## Teil 9 – Tests

- `test_sensor_model.js`:
  - Kennlinien, Rohwerte und Sonderwerte;
  - PNP/NPN × 1M (alle vier Fälle);
  - Materialfaktoren und Schalthysterese;
  - Schirm-Rauschen deterministisch mit Seed;
  - Netzteil-Überlast;
  - Wackelkontakt-Modell;
  - Tankphysik (Masse-/Energiebilanz plausibel).
- Engine-Tests: NORM_X/SCALE_X in `test_engine.js`, `test_pro.js` und KOP/FUP-Tests, inkl. Grenzfälle (Werte ausserhalb, INT-Ziel, Typfehler).
- `tests/sensor_playthrough.js`: alle 60 Aufgaben mit Referenzlösungen über die Oberfläche, SCL-Lauf plus stichprobenartig KOP/FUP. Alle Realitätsstufen mindestens einmal. Handy 390 px mit Antippen-Antippen-Verdrahtung.
- `tests/sensor_wiring_ui.js`: Ader auflegen und lösen, Querbrücker, Aderendhülse, Spannungsfreiheitsregel, Multimeter-Messung, Trennklemme, Rückgängig.
- Leistung: Messskript für Bildrate und Dreiecke in der Szene. Ergebnis in STAND.md notieren.
- Alle bisherigen Tests (Quests, Portal, API, Live) bleiben grün.

---

## Teil 10 – Umsetzungspakete

| Paket | Inhalt | Fertig wenn |
|---|---|---|
| S0 | Recherche: Klemmenbezeichnungen, Adressen und Sonderwerte aus den Siemens-Handbüchern (CPU 1214C DC/DC/DC, SM 1231, SM 1232, SM 1221), NORM_X/SCALE_X-Verhalten aus der TIA-Hilfe → `docs/SENSORWERKSTATT_FAKTEN.md` mit Quellenangaben | Faktenblatt vorhanden, offene Punkte markiert |
| S1 | NORM_X/SCALE_X in allen Engines + Tests | Engine-Tests grün |
| S2 | `sensor_model.js` + `test_sensor_model.js` | Modelltests grün |
| S3 | `wiring.js` (Netzliste, Regeln, Prüfung) + 2D-Klemmleiste mit Antippen-Antippen und Tastatur | `sensor_wiring_ui.js` (2D) grün |
| S4 | 3D-Werkstatt: Raum, Prüfstand, Sortierstrecke, Bedienpult, Tank mit Wasser-Shader, Schaltschrank mit Modulen, Kameras, Qualitätsstufen | Leistungsbudget eingehalten, alle Bauteile anklickbar |
| S5 | Interaktion 3D: Montieren, M12, Aderendhülse, Auflegen, Querbrücker, Trennklemme, Schirm, Werkzeuge (Multimeter, Kalibrator), Röntgen-Schalter | Wiring-UI-Tests in 3D grün |
| S6 | Engineering-Laptop: Gerätesicht, Variablentabelle, Editor-Einbindung SCL/KOP/FUP, Laden, Beobachtung, Diagnosepuffer; HMI-Panel | Laden/Beobachten in Tests |
| S7 | Aufgabenformat, Presets, Validator; Module 1–3 mit Theorien und Handbuch | Validator 0 Fehler, Module 1–3 im Durchlauf |
| S8 | Module 4–6 mit Theorien, Lektionsbausteinen und Handbuch | Validator 0 Fehler, alle 60 Aufgaben im Durchlauf |
| S9 | Portal-Tor, Sync, Leitstand (Modulfortschritt, Verdrahtung als Bild), Live-Challenge (Störungsjagd mit Werkstattfehlern + „Verdrahtungs-Sprint“), Anleitungen, Abweichungsliste | Portal-/API-/Live-Tests grün |
| S10 | Feinschliff: Ton (Klick beim Einrasten, Pumpe, Hupe), ARIA-/Werkmeister-Texte, Handy-Feinschliff, Barrierefreiheit | Handy 390 px ok, Farbsehhilfe ok |

„Fertig“ je Paket wie in ENTSCHEIDUNGEN.md: alle Validatoren 0 Fehler, alle Tests grün, Workers-Build erfolgreich, Handy geprüft, STAND.md aktualisiert.

---

## Teil 11 – Gesamtreihenfolge (alle offenen Pläne)

1. **Paket 0** Sicherheit (`PLAN_ZERTIFIKAT_PIKETT.md`)
2. **Teil A** Zertifikat mit Prüfung (`PLAN_ZERTIFIKAT_PIKETT.md`)
3. **Sensorwerkstatt S0–S10** (diese Datei)
4. ~~**Teil B** Pikettdienst~~ (entfernt am 29.09.2026, siehe `AUFTRAG_FEEDBACK1.md` Paket 0). Der frühere Pikett-Modus der Sensorwerkstatt entfällt.
   *Ursprünglich:* Ergänzung: Hardware-Fehler im Pikett nutzen `sensor_model.js` und die Fehlerliste aus Teil 3.4 dieser Datei. Die Sensorwerkstatt bekommt ebenfalls einen Pikett-Modus, Anlage = Prüfstand.
5. Später: Zertifikat „Sensorik“ (Prüfungsformat aus Teil A wiederverwenden)

## Teil 12 – Fachliche Prüfpunkte für Steven (nicht blockierend)

Diese Punkte bitte vor der Freigabe der Module 2, 4 und 5 an die Schüler prüfen. Claude Code arbeitet bis dahin mit den Werten aus S0 weiter und markiert sie.

- Beschaltung der Eingangsgruppen und Bezugspotentiale der verwendeten Baugruppen (vor allem SM 1221).
- Sonderwerte bei Drahtbruch/Überlauf der eingesetzten AI-Baugruppen.
- Materialfaktoren und Schaltabstände (Richtwerte).
- Aderfarben-Konvention im Schrank eurer Schule/Betriebe (Vorgabe hier: dunkelblau DC mit Beschriftung).
