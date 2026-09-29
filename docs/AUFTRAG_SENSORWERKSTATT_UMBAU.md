# Auftrag für Claude Code: Umbau Sensorwerkstatt (Klassentest 1)

Stand: 29.09.2026 · Auftraggeber: Steven · Repo: `StevenMatzinger93/scl-quest`
Diese Datei als `docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md` ins Repo legen. Sie **ersetzt** im `SENSORWERKSTATT_PLAN.md` die Teile 2, 3, 4 (Bedienung), 6 (Aufgabenliste), 7 (Theorie-Zeitpunkt) und die Pakete S3 bis S6. Alles andere im Plan (Sensormodell, Fakten, Engine, NORM_X/SCALE_X, Datenformate) gilt weiter.

Arbeitsweise wie in `docs/ENTSCHEIDUNGEN.md`: pro Paket ein Nebenzweig mit Vorschau, Übernahme nach `main` bei grünen Tests, danach `docs/STAND.md` nachführen. Rückfragen nur bei Kosten oder wenn etwas weder hier noch in ENTSCHEIDUNGEN.md steht. Wo „Annahme“ steht, gilt sie, bis Steven etwas anderes sagt.

Referenzbilder des Ist-Zustands: `docs/referenz/` (5 Screenshots vom Klassentest).

---

## 1. Warum der Umbau

Der bisherige Plan bildet eine **realistische Werkstatt** nach („alles, was man am Prüfstand tut, tut man in der Praxis genauso“). Die Lernenden wollen dagegen **schnell verbinden, programmieren und das Ergebnis sehen**. Rückmeldungen (Klassentest 1, Steven):

| Beobachtung | Folge |
|---|---|
| 3D-Prüfstand grau in grau, -B1 nicht zu finden | 3D dient nur noch der Anschauung; Optik und Kamera neu |
| Verdrahten mit Kacheln unübersichtlich | Verdrahten in einer 2.5D-Ansicht mit echt aussehenden Klemmen und Kabeln |
| Zu viele Werkzeuge | Nur noch Leitungen ziehen; Multimeter/Kalibrator nur in Messaufgaben |
| Fünf Arbeitsschritte vor dem Verbinden | Mechanik läuft automatisch; erste Aufgabe beginnt sofort mit dem Verbinden |
| Zu viel Theorie | Theorie erst nach dem Lösen; Info direkt in der Aufgabe kurz |
| Ergebnis nicht sichtbar | Kernschleife endet immer mit „Laufen lassen“ in der Animation |

**Zielbild:** In unter 30 Sekunden nach dem Öffnen der ersten Aufgabe liegt die erste Ader auf der Klemme.

---

## 2. Entscheidungen (Steven, 29.09.2026)

| Thema | Entscheid |
|---|---|
| 3D-Werkstatt | Nur noch die **laufende Anlage ansehen**. Verdrahten komplett in **2.5D**. |
| Umfang | **30 Aufgaben** (5 je Modul, 6 Module). Theorien bleiben 12. |
| Werkzeuge | Weg, ausser **Multimeter und Stromkalibrator als optionale Werkzeuge in Messaufgaben**. |
| Programmiersprache | **SCL und FUP** (KOP entfällt in der Sensorwerkstatt). |
| Theorie | Wie im Plan (Lektion + 5 Fragen, 80 %), aber **erst nach dem Lösen**. |
| Visualisierung | **Isoliert an Fable 5.1**: 2.5D-Verdrahtung und Optik der 3D-Anlage. Brief: `AUFTRAG_FABLE_VISUALISIERUNG.md`. |

**Annahmen (gelten bis Widerspruch):**
- A1. Einstellen von Abstand, Poti und Teach-in (Modul 3) bleibt als **Schieberegler/Knopf ohne Werkzeug** in der 2.5D-Ansicht.
- A2. Theorien blockieren nichts: Kapitel/Modul gilt mit den Aufgaben als abgeschlossen; Theorie gibt Punkte und Abzeichen.
- A3. Die 30 nicht mehr angezeigten Aufgaben werden **nicht gelöscht**, sondern `hidden:true` (siehe 5.3).
- A4. Nur Realitätsstufe „Schnell“. „Werkstatt“ und „Profi“ entfallen.
- A5. Sicherheitsregel „nur spannungsfrei verdrahten“ wird eine Infokarte statt einer Spielregel; Einschalten geschieht automatisch beim Laufenlassen.

---

## 3. Neue Kernschleife (gilt für jede Aufgabe)

Vier Phasen, sichtbar als Leiste oben: **① Verbinden → ② Signale → ③ Programm → ④ Laufen lassen**.

- Jede Aufgabe hat einen **Schwerpunkt** (eine Phase). Die anderen Phasen sind vorbefüllt und dürfen ohne Arbeit weitergeklickt werden („Übernehmen“).
- **Verbinden:** Adern auf Klemmen ziehen (2.5D). Keine Werkzeuge, keine Montage, keine Aderendhülsen, kein Kabelweg.
- **Signale:** Fenster „PLC-Variablen“ wie im TIA Portal (Name · Adresse · Datentyp · Kommentar). Adresse aus der Verdrahtung vorgegeben; je nach Aufgabe müssen Name/Kommentar oder die ganze Zeile ergänzt werden.
- **Programm:** Editor SCL oder FUP (Wahl pro Person, gemerkt). Dieselbe Prüfung gegen Testfälle wie in den Quests.
- **Laufen lassen:** Probebetrieb (Details 6.5). Zählt nie als Fehlversuch.
- **„Prüfen“** (Testfälle, Punkte) ist getrennt vom Laufenlassen und immer sichtbar.

---

## 4. Ein-Bildschirm-Layout

Ziel 1366×768 und 1920×1080 **ohne Scrollen**.

- **Oben:** Phasenleiste ①–④ + Auftrag in **einer Zeile** (max. 25 Wörter). Story einklappbar (1 Satz sichtbar), Lernziel unter „ⓘ“.
- **Mitte:** Arbeitsfläche je nach Phase: 2.5D-Verdrahtung / PLC-Variablen / Editor / grosse Anlage.
- **Unten rechts oder seitlich, immer sichtbar:** kleine Live-Anlage (3D). Die Sensor-LED und das Werkstück reagieren schon beim Verdrahten. In Phase ④ wird sie gross.
- **Kein** Werkzeugband, **keine** Kamerareihe, **keine** Modusreihe (Engineering/Hinweis/Röntgen/2D). Kamera wählt das Spiel.
- **Hilfe:** Knopf „Zeig mir“ (pulsierend markiert die Ziel-Klemme bzw. Ader, in der 3D-Anlage das betroffene Bauteil) + Hinweis 1/2 wie in den Quests.
- Handy 390 px: Phasen als Tabs, Anlage als Kachel oben.

---

## 5. Aufgaben (30)

### 5.1 Format

Erweiterung `defSensorTask` (Namen an das Repo anpassen):
`core:true` (alle 30), `phase:'verbinden'|'signale'|'programm'|'laufen'` (Schwerpunkt), `prefill:{verbinden,signale,programm}` (was vorgegeben ist), `lang:['scl','fup']`, `tools:[]` (nur `'multimeter'`, `'kalibrator'` erlaubt), `scene:'sortierstrecke'|'tank'` (welche Anlage sichtbar ist).
Texte (Korrektur 29.09.2026, gilt einheitlich für alle Aufgaben und alle Quests): **Story höchstens 2 Sätze, Auftrag höchstens 25 Wörter** und zuoberst. Validator-Regel dafür (Warnung, danach Fehler).

### 5.2 Auswahl (aus den bisherigen 60; alte Nummer in Klammern)

**Modul 1 – Signale und digitale Sensoren** (Start: sofort verbinden)
1. -B1 an -X2:5 anschliessen, Stahlteil vorbeiführen (Nr. 2, ohne Montage) · Schwerpunkt Verbinden
2. Taster Start (NO) und Stopp (NC) anschliessen, Stopp im Ruhezustand 1 zeigen (Nr. 3) · Verbinden
3. PLC-Variablen der Sortierstrecke anlegen (Nr. 4) · Signale
4. Programm: Band mit Start/Stopp, Selbsthaltung (Nr. 5) · Programm
5. **Boss:** 3 Sensoren anschliessen, Variablen, Bandfreigabe, laufen lassen (Nr. 10, gekürzt) · alle

**Modul 2 – PNP und NPN**
1. PNP-Signal gegen M messen, mit/ohne Teil (Nr. 1) · Messen, Multimeter
2. 1M der Eingangsgruppe richtig auflegen (Nr. 3) · Verbinden
3. Programm: Teilezähler mit Flanke (Nr. 5) · Programm
4. Fehlersuche: neuer Sensor, Eingang tot (NPN an PNP-Gruppe) (Nr. 8) · Verbinden
5. **Boss:** 3 PNP an CPU, 2 NPN an SM 1221 (Nr. 10) · alle

**Modul 3 – Sensortypen im Einsatz**
1. -B1 Schaltabstand für Stahl und Aluminium mit Abstandsregler ermitteln (Nr. 1) · Laufen
2. -B3 per Teach-in auf das Band einstellen (Nr. 4) · Laufen
3. Programm: Materialsortierung Metall/Kunststoff (Nr. 5) · Programm
4. Fehlersuche: Alu-Teile werden nicht erkannt (Nr. 9, ohne „Mutter lose“, dafür Abstand) · Laufen
5. **Boss:** 7 Werkstückarten sortieren (Nr. 10) · alle

**Modul 4 – Analogsignale**
1. -B10 (0–10 V) anschliessen, bei 3 Füllständen messen (Nr. 1) · Verbinden, Multimeter
2. -B11 (2-Leiter, 4–20 mA) anschliessen und in der Gerätesicht konfigurieren (Nr. 3) · Verbinden/Signale
3. Loop-Check mit Kalibrator: 4/12/20 mA, Rohwerte notieren (Nr. 5) · Messen, Kalibrator
4. Programm: Unter-/Überlauf und Drahtbruch prüfen (Nr. 9) · Programm
5. **Boss:** 4 Analogsignale der Tankstation anschliessen, konfigurieren, abnehmen (Nr. 10) · alle

**Modul 5 – NORM_X und SCALE_X**
1. Von Hand: Rohwert 13824 → ? % (Nr. 1, mit Rechner-Baustein) · Signale
2. Programm: Druck -B11 → mbar mit NORM_X/SCALE_X (Nr. 2) · Programm
3. Programm: Pumpendrehzahl 0–100 % → 0–10 V (Nr. 6) · Programm
4. Fehlersuche: 20 % bei leerem Tank (0–20 statt 4–20 mA) (Nr. 8) · Signale
5. **Boss:** Tankstation-HMI komplett (Nr. 10) · alle

**Modul 6 – Messwerte sicher verarbeiten**
1. Heizung mit Hysterese (Nr. 1) · Programm
2. 2-Punkt-Kalibrierung Pegel 100/500 mm (Nr. 4) · Programm
3. Plausibilität Ultraschall ↔ Druck, > 5 % → Meldung (Nr. 6) · Programm
4. Fehlersuche: Tank läuft über, -B8 als Schliesser, Ader auf WH (Nr. 9) · Verbinden/Programm
5. **Werkstatt-Finale:** ARIA hat sabotiert (Verdrahtung, Konfiguration, Programm; Montagefehler entfällt) (Nr. 10) · alle

Steven darf einzelne Aufgaben tauschen. Die Auswahl ist ein Vorschlag von Claude.

### 5.3 Die 30 übrigen Aufgaben
Nicht löschen (IDs können von Spielständen, Störungsjagd oder Prüfungspool genutzt werden): `hidden:true`, nicht im Spiel sichtbar, nicht im Validator-Durchlauf der Auslieferung. **Zuerst prüfen (Paket W0)**, ob diese IDs schon irgendwo verwendet werden. Wenn nein, dürfen sie entfernt werden.

### 5.4 Theorie (12, wie im Plan)
- Bleibt Lektion + 5 Fragen, 80 %. Interaktive Bausteine (`StromflussPNPNPN`, `KennlinienRechner`, `SchaltabstandDiagramm`, `M12Belegung`) bleiben.
- **Zeitpunkt:** Theorie A wird nach der ersten gelösten Aufgabe des Moduls angeboten, Theorie B nach der dritten. **Nie vor dem Lösen, nie Pflicht** (Annahme A2).
- Vor dem Lösen nur eine **Infokarte** (max. 3 Sätze plus ein Bild) direkt in der Aufgabe, z. B. M12-Belegung oder Sn/Sr.
- Handbuchseiten bleiben; „Arbeiten im Schaltschrank“ wird zur Kurzseite (Klemmen, Beschriftung, Spannungsfreiheit als Wissen, ohne Werkzeughandlungen).

---

## 6. Technische Pakete

Reihenfolge: W0 → W1 → W2 → W3 → (W4 und W5 parallel, Fable) → W6 → W7 → W8 → W9.

### W0 – Bestandsaufnahme (zuerst, klein, nur berichten)
- Feststellen, was von S0–S9 im Repo existiert (`sensor_model.js`, `wiring.js`, `sensor_game.js`, `engineering_ui.js`, Engine-Erweiterungen, Portal-Tor, Live-Challenge).
- Prüfen, wo Sensor-Aufgaben-IDs verwendet werden (Spielstand, Live-Challenge, Prüfungspool, Leitstand).
- Kurzbericht in `docs/STAND.md`: Was bleibt, was fällt weg, was ist schon gebaut.
- Fertig, wenn: Bericht vorhanden. **Erst danach** W1 ff.

### W1 – Fehler beheben: FUP im Engineering-Laptop
- Aus `AUFTRAG_FEEDBACK1.md` Paket 1.1: `sensor_game.js` ruft `Engineering.mount()` ohne `editor` auf → FUP nur Textfeld. Grafischen Editor einhängen; Test `tests/sensor_engineering_ui.js`: FUP wählen → Box ziehen → übersetzen → laden.
- KOP in der Sensorwerkstatt entfernen.
- Der TIA-nahe FUP-Umbau (Paket 5.1 im anderen Auftrag) ist **nicht** Voraussetzung, aber der Editor muss danach zu diesem Umbau passen.

### W2 – Aufgabenformat v2, Kernschleife, Validator
- Format nach 5.1, Phasenmodell nach 3 (Zustandsautomat: Phase, Vorbefüllung, „Übernehmen“).
- **`hidden:true` im Spiel UND im Portal auswerten** (Korrektur 29.09.2026): ausgeblendet, aber per ID auflösbar, nie löschen. Betrifft Aufgabenkarte und Zähler im Spiel, `totalTasks`/Zähler und `meta.tasks.find` im Leitstand, Live-Challenge (Auswahl ausblenden, laufende und alte Challenges weiter auflösen), Störungsjagd `sb_<Aufgabe>`, Beamer. `sensor.json`/`sensor_live.json` behalten die versteckten Aufgaben mit Kennzeichen `hidden`.
- `validate_sensor.js` erweitern: Referenzlösung besteht in allen Phasen; Start scheitert; `wrong` scheitern; nur erlaubte `tools`; Text-Limits; Verdrahtung, Signaltabelle und Programm einer Aufgabe sind zueinander konsistent (Adressen).
- Fertig, wenn: Validator 0 Fehler für alle 30; Testgerüst grün.

### W3 – Schnittstellenvertrag für Fable (vor W4/W5)
Claude Code schreibt `docs/SENSOR_VISUAL_VERTRAG.md` **und** implementiert die Schnittstellen als Stubs:
- **Verdrahtung (Daten):** Netzliste aus `wiring.js`: Bauteile (Sensor, Kabel, Adern mit Farbe/Belegung, Klemmen mit Ebene/Bezeichnung, CPU-Klemmenblöcke), erlaubte Verbindungen, Prüfergebnis je Ader (ok/falsch/fehlt). Ereignisse: `wireStart`, `wireDrop(aderId, klemmeId)`, `wireRemove`, `helpShow`.
- **Anlage:** Korrektur 29.09.2026 (W0): Die Sensorwerkstatt hat **kein Kanalmodell** wie die vier Quests, sondern nur `SensorScene.setState({beltRunning, cylinder, feeder, parts, pump, heater, level, doorOpen, hoodOpen, leds, hmi, aria, dist})`. Der Vertrag wird anhand des echten `setState` festgelegt (Feldnamen, Wertebereiche, Beispiele). Die Kanalnamen im Fable-Brief (`sensorActive`, `partType`, `tankLevel`) sind Entwürfe. Zusätzlich Ereignisse/Aufrufe `focus(bauteilId)`, `highlight(ids)`, `scenePreset(name)`. **Zu prüfen:** ob `SensorPlant3D` besser eine Hülle um die bestehende `SensorScene` wird (Picking, LEDs, Qualitätsstufen, Tests `tests/sensor_scene.js` bleiben nutzbar) statt einer Neuentwicklung.
- Mock-Daten je Modul, damit Fable ohne Spiel arbeiten kann.
- Fertig, wenn: Vertrag + Stubs + Mock-Daten im Repo, Beispielaufruf läuft.

### W4/W5 – Visualisierung (Fable 5.1)
Siehe `AUFTRAG_FABLE_VISUALISIERUNG.md`. Ergebnis wird von Claude Code integriert.

### W6 – Integration und Probebetrieb
- Layout nach Abschnitt 4, Phasenleiste, Hilfe „Zeig mir“.
- **PLC-Variablen-Fenster** (Name · Adresse · Datentyp · Kommentar), Klick fügt Namen in den Editor ein (wie in den Quests).
- **Probebetrieb „▶ Laufen lassen“**: `SCLEngine.createRuntime` bzw. FUP-Laufzeit zyklisch, Bedienung direkt in der Anlage und in einer kleinen Beobachtungstabelle: Werkstück wählen (Stahl, Alu, Kunststoff …), Taster, Füllstandsregler, Störung einschalten. Zählt nie als Fehlversuch.
- **Multimeter und Kalibrator** erscheinen nur, wenn `tools` der Aufgabe sie nennt, als kleine Overlays in der 2.5D-Ansicht (Messspitze auf Klemme ziehen bzw. Wert einspeisen). Keine Werkzeugleiste.
- Mechanik automatisch: Montieren, Anstecken, Hülsen, Kabelweg, Einschalten. Kurze ARIA-/Werkmeister-Einblendung als Ersatz („Sensor sitzt, Leitung steckt.“).
- Fertig, wenn: alle 30 Aufgaben in der echten Oberfläche lösbar, kein Scrollen bei 1366×768.

### W7 – Inhalte
- 30 Aufgabentexte nach Textdiät, Infokarten, Theorie-Zeitpunkt (5.4), Handbuch-Anpassung, Glossar prüfen (Begriffe für gestrichene Handlungen entfernen: Crimpen, Kontermutter, Querbrücker als Handlung).
- Fertig, wenn: Validator 0 Fehler/0 Warnungen, Textlimits eingehalten.

### W8 – Tests und Messung
- Playwright-Durchlauf: alle 30 Aufgaben und 12 Theorien über die echte Oberfläche, ohne JS-Fehler; Screenshots bei 1366×768, 1920×1080 und 390 px.
- Messung mit Zeitstempel-Ereignissen: Zeit bis zur ersten verbundenen Ader (Ziel < 30 s), Abbruch je Aufgabe, Nutzung „Zeig mir“, Zeit je Phase.
- Zusätzlich im Feedback-Formular: „Wusstest du sofort, was zu tun ist? (ja/eher/nein)“.
- Fertig, wenn: alle Tests grün, Handy ok, offline spielbar.

### W9 – Portal, Leitstand, Live-Challenge
- Nur soweit schon gebaut (laut W0): Modulfortschritt auf 30 Aufgaben umstellen, Verdrahtung im Leitstand als Bild aus der neuen Ansicht, Störungsjagd-Fehler auf die neuen Fehlerarten (Verdrahtung, Konfiguration, Programm) beschränken.

---

## 7. Was wegfällt (nicht mehr bauen)

Sensor wählen aus dem Regal · Montieren mit Gabelschlüssel · Kontermuttern und Ausrichten mit Rändelschrauben · Anstecken der M12-Leitung als Handlung · Leitung verlegen/Kabeleinführung · Aderendhülsen und Crimpzange · Schraubendreher (Klemmen lösen) · Querbrücker als Handlung · Röntgen-Schalter · Realitätsstufen Werkstatt/Profi · Sicherheits-Minuspunkte · 7-Kamera-Leiste · KOP.
Bleibt: `sensor_model.js`, Prüfalgorithmus der Verdrahtung, Fehlerarten (Adern vertauscht, 1M falsch, Konfiguration falsch), Engine-Erweiterungen, Engineering-Laptop mit Variablentabelle/Laden/Beobachten/Diagnosepuffer, 12 Theorien.

---

## 8. Offene Punkte für Steven (nicht blockierend)

1. Auswahl der 30 Aufgaben (5.2) durchsehen.
2. Sollen Theorien für Punkte/Abzeichen zählen, oder ganz ohne Wertung sein? (Annahme A2: Punkte und Abzeichen.)
3. Soll Modul 3 „Einstellen“ als Regler bleiben (A1), oder ganz automatisch werden?
4. Fachliche Prüfung der Aufgabenwerte (Teil 12 im alten Plan) bleibt offen.
