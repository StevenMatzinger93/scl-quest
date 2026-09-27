# FUP Quest – Konzept

## Geschichte

ARIA ist aus der Gratbahn geflohen und hat sich ins **Stellwerk „Brünigkreuz“** gerettet, einen Bahnknoten mit zwei Weichen,
Signalen, einem Bahnübergang und einem Abstellgleis. Sie stellt Weichen unter fahrenden Zügen um und lässt die Schranken offen.
Der Werkmeister und die Fahrdienstleiterin **Frau Gasser** holen dich: Das Stellwerk wird neu programmiert — im
**Funktionsplan (FUP)**, wie er in Siemens-Steuerungen verwendet wird.

## Lehrplan (15 Kapitel, je Theorie A → Aufgaben 1–5 → Theorie B → Aufgaben 6–10)

| Kap. | Thema | Inhalte |
|---|---|---|
| 1 | Boxen und Zuweisung | UND-Box `&`, Zuweisung `=`, Eingänge und Operanden, mehrere Netzwerke |
| 2 | ODER, XOR, Negation | `>=1`, `X` (exklusiv), negierter Eingang (Kreis), Mischformen |
| 3 | Selbsthaltung und Verriegelung | Selbsthaltung im FUP, Aus-Vorrang, gegenseitige Verriegelung (Weiche links/rechts) |
| 4 | Speicherboxen | S und R, SR (Rücksetzen dominant), RS (Setzen dominant), Störung speichern |
| 5 | Flanken | P- und N-Box, Achsimpulse, Stromstoss (Weiche umstellen per Tastendruck) |
| 6 | Zeiten I | TON, TOF, TP: Signalhaltezeit, Schrankenschliesszeit, Glockenimpuls |
| 7 | Zeiten II | Wechselblinker Bahnübergang, Weichenlaufzeit-Überwachung, Vorläutezeit |
| 8 | Zähler | Achszähler CTU/CTD, Gleisfreimeldung (ein = aus), Zugzählung |
| 9 | Vergleicher und Werte | Geschwindigkeit prüfen, MOVE, Rechnen, Signalbegriffe als Zahl |
| 10 | Fahrstrassen | Fahrstrasse einstellen → sichern → Signal Fahrt → Auflösung, Flankenschutz; Final Boss 1 |
| 11 | Bausteine (Profi) | FC mit Schnittstelle, Aufruf-Box, Rückgabewert, Temp |
| 12 | Funktionsbausteine | FB mit Instanz, Weichen-FB, Timer als Multiinstanz, FB im FB |
| 13 | Daten | Globale DBs, PLC-Datentyp `UDT_Weiche`, Arrays von Gleisabschnitten |
| 14 | Standardbausteine | Weiche, Signal, Bahnübergang, Meldung als Standard-FBs |
| 15 | Das Stellwerksprogramm | OB1/OB100, Programmstruktur, warnungsfrei; Final Boss 2 |

Wie in SCL/KOP Quest: Debug-Aufgaben (ARIA hat umverdrahtet), Kapitel-Boss als Aufgabe 10, Handbuch mit Seiten zu jedem Thema,
mindestens zwei Störungsszenarien pro Kapitel für die Live-Challenge.

## Editor (Baustein-Editor)

- Jedes Netzwerk ist ein Funktionsplan: rechts die Zuweisung (`=`, `S`, `R`, `SR`, `RS`, MOVE, Rechnen, Aufruf),
  links davon die Verknüpfungsboxen (`&`, `>=1`, `X`, Timer, Zähler, Vergleicher, Flanken). Operanden stehen an den Eingängen.
- **Ziehen + verbinden:** Boxen aus der Palette auf einen Eingang ziehen (fügt sie dort ein), Variablen aus der Liste auf
  einen Eingang ziehen (verbindet sie). Ohne Maus: Eingang antippen → Box oder Variable antippen.
- Eingang negieren (Kreis), Eingang hinzufügen, Box löschen; offene Eingänge rot `??`.
- **Signalzustände farbig:** Beim Testlauf zeigt jede Leitung ihren Wert (grün = 1, grau = 0), Operanden zeigen 0/1.
- Umschaltbar auf die Textansicht (gleiches Textformat wie KOP Quest, zusätzlich `XOR`, `SR(Q, R)`, `RS(Q, R)`).

## Technik

- Gleiches Datenmodell wie KOP Quest (`dev/src/kop.js`): ein Netzwerk = ein logischer Baum + Ausgänge. Der Baum wird im
  FUP-Editor als verschachtelte Boxen gezeichnet (Reihe → `&`-Box, Parallel → `>=1`-Box, Öffner → negierter Eingang,
  Timer in Reihe → Timer-Box, deren IN die vorherige Verknüpfung ist).
- Erweiterungen im Modell: `XOR` (Box `X`), Ausgänge `SR(Q, R)` (Rücksetzen dominant) und `RS(Q, R)` (Setzen dominant).
- Ausführung, Tests, Profi-Bausteine: dieselben Engines (`engine.js`, `engine_pro.js` über `KOP.wrapEngine`/`KOP.wrapPro`).
- Editor: `dev/src/kop_editor.js` mit `flavor:'fup'` (eigene Zeichnung, Beschriftung und Palette, gleiche Bearbeitungsfunktionen).
- Szene: `dev/src/scene_stellwerk.js` (2D-SVG): zwei Weichen (Lage links/rechts, Laufanzeige), Einfahr- und Ausfahrsignal
  (Halt/Fahrt/Warnung), Bahnübergang (Schranke, Wechselblinker, Glocke), Zug (fährt, wenn Signal Fahrt), Gleisbesetzung,
  Fahrstrassenanzeige, Stelltisch mit Anzeige und Zähler.
- Quest-Konfiguration `fup` in `build.js` → `fup.html` und `web/fup/`; Portal-Tor FUP, Leitstand, Live-Challenge.

## Reihenfolge der Umsetzung

1. Modell-Erweiterungen (XOR, SR/RS) mit Tests, FUP-Zeichnung und -Bearbeitung im Editor
2. Stellwerk-Szene, Quest-Konfiguration, Build
3. Inhalte Kapitel 1–10 + Theorie + Handbuch + Störungsszenarien, Validator, Browser-Durchlauf
4. Profi-Stufe 11–15
5. Portal/Leitstand/Live-Challenge für FUP, Tests, Übernahme nach main
