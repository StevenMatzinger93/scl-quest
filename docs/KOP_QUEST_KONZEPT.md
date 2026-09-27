# KOP Quest – Konzept (Stand 27.09.2026)

Zweites Spiel der Reihe SPS Quest. Gleicher Stil und gleiche Bedienung wie SCL Quest, eigene Maschine: **Seilbahn-Station**.
Grundlage: `docs/ENTSCHEIDUNGEN.md`. Dieses Konzept hat Claude abgeleitet (Lehrplan „analog zu SCL“).

## Geschichte

ARIA hat sich aus der Roboterzelle in die Bergstation der Seilbahn „Gratbahn“ gerettet. Die Sicherheitskette ist überbrückt,
die Türen schliessen nach Lust und Laune, bei Sturm fährt die Bahn weiter. Der Werkmeister schickt dich hinauf: „Hier oben
wird nicht getippt, hier wird gezeichnet – Kontaktplan, wie in jedem Schaltschrank.“ Jede gelöste Aufgabe gibt der Station
ein Stück Sicherheit zurück. Final Boss 1 (Aufgabe 100): Die ganze Station im Automatikbetrieb mit vollständiger
Sicherheitskette. Final Boss 2 (Aufgabe 150): Stationsprogramm nach Standard aus Bausteinen.

## Lehrplan (15 Kapitel × 10 Aufgaben, je 2 Theorie-Aufträge)

| Kap. | Titel | Inhalt |
|---|---|---|
| 1 | Strom fliesst | Stromschiene, Schliesser, Spule, Reihenschaltung (UND), mehrere Netzwerke |
| 2 | Öffner und Parallelzweige | Öffner, Parallelschaltung (ODER), Mischformen, Drahtbruchsicherheit (Not-Halt als Öffner) |
| 3 | Selbsthaltung | Selbsthaltekreis, Aus-Vorrang, Ein-Vorrang, gegenseitige Verriegelung (Berg/Tal) |
| 4 | Setzen und Rücksetzen | S- und R-Spulen, Vorrang durch Reihenfolge, Störung speichern und quittieren, negierte Spule |
| 5 | Flanken | P- und N-Kontakt, Stromstoss-Schalter, Impulse zählen vorbereiten, Flanke an Meldungen |
| 6 | Zeiten I | TON, TOF, TP als Box im Netzwerk, Türschliess-Verzögerung, Nachlauf, Hupimpuls |
| 7 | Zeiten II | Blinker, Überwachungszeit, Anlaufwarnung, Windabschaltung mit Verzögerung |
| 8 | Zähler | CTU, CTD, Fahrgäste zählen, Kabine voll, Rücksetzen, Zählerstand vergleichen |
| 9 | Vergleicher und Werte | Vergleichskontakte (==, <>, >, >=, <, <=), MOVE, ADD/SUB/MUL, Windgrenzwert mit Hysterese |
| 10 | Sicherheitskette und Ablauf | Sicherheitskette, Schrittkette mit S/R-Merkern, Betriebsarten; Final Boss 1 |
| 11 | Bausteine (Profi) | FC mit Schnittstelle, Aufruf-Box, Parameter |
| 12 | Funktionsbausteine | FB mit Instanz, statische Variablen, Timer im FB (Multiinstanz) |
| 13 | Daten | Globale Datenbausteine, Strukturen/PLC-Datentypen, Arrays über Vergleicher/MOVE |
| 14 | Standardbausteine | Türsteuerung, Sicherheitskette und Antrieb als FB, Betriebsarten |
| 15 | Das Stationsprogramm | OB1/OB100, Programmstruktur, warnungsfrei; Final Boss 2 |

Wie in SCL Quest: pro Kapitel Theorie A → Aufgaben 1–5 → Theorie B → Aufgaben 6–10, Debug-Aufgaben (ARIA hat „umverdrahtet“),
Kapitel-Boss als Aufgabe 10, Handbuch mit Seiten zu jedem Thema.

## Editor (Netzwerk-Editor)

- Netzwerke untereinander, jedes mit Titel. Linke Stromschiene, rechts die Spulen.
- Strukturelles Bearbeiten (funktioniert mit Maus und Finger): Element antippen → Werkzeugleiste
  *Kontakt dahinter* (Reihe), *Parallelzweig*, *Öffner/Schliesser*, *Flanke P/N*, *Timer/Zähler/Vergleich einfügen*, *Löschen*;
  Variable per Klick in der Variablenliste zuweisen. Spulen: *Spule / S / R / negiert*, *weitere Spule*, Ausgangsboxen MOVE/ADD/…
- Ungültige Verschaltungen sind so gar nicht möglich; offene Stellen (Kontakt ohne Variable) sind rot markiert.
- Umschaltbar auf eine Textansicht (für Profis und die Lehrperson), gleiche Daten.
- **Stromfluss live**: Beim Testlauf wird jedes Element und jeder Leitungsabschnitt pro Zyklus eingefärbt (grün = Strom, grau = kein Strom),
  synchron zur Animation der Anlage und zur Testtabelle.

## Technik

- Gespeichertes Format je Aufgabe: Text mit Netzwerken, z. B.
  ```
  NETWORK Selbsthaltung
  (Start OR Motor) AND NOT Stopp => Motor;
  ```
  Reihe = `AND`, Parallel = `OR`, Öffner = `NOT x`, Flanken `P(x)`/`N(x)`, Vergleich `[Wind > 60]`,
  Boxen `TON(T1, T#3S)`, `TOF(…)`, `TP(…)`, `CTU(Z1, PV:=5, R:=Quit)`, `CTD(…)`, Spulen `=> A`, `=> S A`, `=> R A`, `=> NOT A`,
  Ausgangsboxen `=> MOVE(5, Ziel)`, `=> ADD(A, B, Ziel)`, `SUB`, `MUL`, `DIV`.
- `dev/src/kop.js` parst dieses Format, erzeugt daraus das Leiterbild (Layout) und übersetzt jedes Netzwerk Element für Element
  nach SCL. Jede Stromfluss-Stelle wird eine eigene Hilfsvariable → sichtbar in jedem Zyklus. Ausführung, Timer, Zähler und
  Tests laufen über die vorhandene SCL-Engine (`engine.js`, Profi: `engine_pro.js`).
- Spielhülle: `app.js` wird über eine Quest-Konfiguration (`window.QUEST`) für SCL und KOP (später FUP, AWL) genutzt:
  Name, Speicher-Schlüssel, Editor, Szene, Texte. Ein Build erzeugt je Quest eine Offline-Datei und `web/<quest>/`.
- Szene: `dev/src/scene_seilbahn.js` (2D-SVG) mit denselben Funktionen wie die Roboterzelle; Kanäle u. a.
  `motorOn, motorDir, brake, doorOpen, gateOpen, lightRed/Yellow/Green, hornActive, faultActive, emergencyLamp, windWarn,
  windSpeed, cabinInStation, chainDoor/chainRope/chainStop/chainWind, displayValue/displayLabel/displayText, passengers`.
- Live-Challenge: Sprint und Störungsjagd funktionieren gleich (Quest `kop`), mind. 2 Störungsszenarien pro Kapitel.
- Portal: Tor „KOP“ wird geöffnet, Fortschritt pro Konto unter Quest `kop`, Leitstand zeigt beide Quests.

## Reihenfolge der Umsetzung

1. `kop.js` (Parser, Layout, Übersetzung) mit Tests
2. Editor + Stromfluss-Anzeige
3. Seilbahn-Szene
4. Quest-Konfiguration in `app.js`, Build für KOP
5. Inhalte Kapitel 1–10 + Theorie + Handbuch, Validator, Browser-Durchlauf
6. Profi-Stufe 11–15 (Bausteine in KOP über `engine_pro.js`)
7. Portal/Leitstand/Live-Challenge für KOP
