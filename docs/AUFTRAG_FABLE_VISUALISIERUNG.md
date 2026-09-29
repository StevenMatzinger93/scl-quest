# Auftrag Fable 5.1: Visualisierung Sensorwerkstatt

> **Korrektur 29.09.2026:** Die Sensorwerkstatt hat kein Kanalmodell, nur `SensorScene.setState`. Die Kanalnamen unten sind Entwürfe; verbindlich ist `docs/SENSOR_VISUAL_VERTRAG.md` (Paket W3), abgeleitet aus dem echten `setState`. Möglich und zu prüfen: `SensorPlant3D` als Hülle um die bestehende `SensorScene`. Referenzbilder: `docs/referenz/`.

Stand: 29.09.2026 · Auftraggeber: Steven · Teil von `AUFTRAG_SENSORWERKSTATT_UMBAU.md` (Pakete W4 und W5)

Dieser Auftrag ist **isoliert**: Du arbeitest nur an der Darstellung. Spielregeln, Aufgaben, Bewertung, Engine und Editor sind nicht deine Sache. Du bekommst Daten und Ereignisse über einen festen Vertrag (`docs/SENSOR_VISUAL_VERTRAG.md`, Mock-Daten inklusive) und lieferst zwei Module, die Claude Code danach einbaut.

---

## 1. Kontext in fünf Sätzen

Sensorwerkstatt ist ein Lernspiel für Lernende der Automatisierungs- und Elektrotechnik (ab ca. 15 Jahren, Schweiz, alles auf Deutsch). Sie schliessen Sensoren an eine Siemens-S7-1200 an, definieren die Signale, programmieren und sehen das Ergebnis an einer laufenden Anlage. Im Klassentest war die Werkstatt verwirrend: 3D grau in grau, der Sensor nicht zu finden, das Verdrahten mit gleichförmigen Kacheln. Jetzt gilt: **3D nur zum Ansehen der laufenden Anlage, Verdrahten komplett in einer 2.5D-Ansicht**. Die Bilder des Ist-Zustands liegen in `referenz/` (so soll es **nicht** aussehen).

**Zielbild:** Wer die erste Aufgabe öffnet, sieht sofort, was ein Sensor, was ein Kabel und was eine Klemme ist, und zieht die erste Ader in weniger als 30 Sekunden auf die richtige Klemme.

---

## 2. Modul A: 2.5D-Verdrahtungsansicht

### 2.1 Was gezeigt wird
Eine leicht perspektivische bzw. isometrische, illustrierte Ansicht (kein Foto, kein volles 3D) mit drei Zonen von links nach rechts:

1. **Sensor mit Kabel.** Der Sensor ist als **erkennbares Bauteil** gezeichnet (induktiv M18 als Zylinder mit Gewinde und LED, Lichtschranke, Transmitter mit Anschlusskopf, Taster, Zylinderschalter). Sein Kabel endet in **freien Adern** mit Farbe und Beschriftung (BN, BU, BK, WH; bei 2-Leiter nur BN/BU). Die Sensor-LED leuchtet, wenn der Zustand es verlangt.
2. **Klemmleiste.** Echt aussehende Reihenklemmen: **Initiatorenklemme -X2 mit drei Ebenen** (oben L+, Mitte Signal, unten M, mit gelber Signal-LED), Verteilerklemmen -X1 (L+/M), Trennklemmen mit Messbuchsen -X3 für 4–20 mA. Push-in-Klemmstellen als Öffnung mit Metallkontakt gezeichnet, nicht als Kachel.
3. **CPU / Analogmodul.** Die Frontansicht der S7-1200 (CPU 1214C DC/DC/DC, SM 1221, SM 1231) **herstellerneutral gezeichnet** (keine Marken, keine Logos), mit den Klemmenblöcken (1M, DIa.0 …, AI 0+ …), Status-LEDs und Beschriftungen wie im Klemmenplan.

Die Ansicht ist **aufgabenbezogen reduziert**: Es erscheinen nur Bauteile und Klemmen, die die aktuelle Aufgabe braucht, alles andere ist ausgeblendet oder zurückgenommen. Nie 60 gleiche Klemmen.

### 2.2 Bedienung
- **Ader ziehen:** Ader am Ende greifen (Maus oder Finger) und auf die Ziel-Klemmstelle ziehen. Während des Ziehens leuchten alle **zulässigen** Klemmstellen auf, unzulässige sind gedimmt. Beim Loslassen rastet die Ader mit kurzer Animation und Klick-Signal (optional) ein.
- **Alternative ohne Ziehen:** Ader antippen, dann Klemme antippen. Zusätzlich Tastatur (Pfeiltasten wählen, Enter setzt).
- **Lösen:** Ader antippen und aus der Klemme ziehen oder Papierkorb-Geste. Kein Werkzeug.
- **Rückgängig/Wiederholen** wie heute.
- **Hilfe „Zeig mir“:** Ziel-Ader und Ziel-Klemme pulsieren; die Ansicht schwenkt bei Bedarf dorthin.
- **Live-Rückmeldung:** Signal-LED der Klemme leuchtet, Ader zeigt beim Prüfen ✓ oder ✗ (Farbe **und** Symbol, nicht nur Farbe).
- Multimeter/Kalibrator (nur wenn die Aufgabe es freigibt): Messspitzen als zwei Griffe, die man auf Klemmstellen zieht; Anzeige als kleines Display. Kalibrator: Drehregler oder Zahleneingabe. Keine Werkzeugleiste.

### 2.3 Gestaltung
- Klare Formensprache, **starker Kontrast**, kaum Grau in Grau: Sensoren, Adern und Klemmen heben sich klar vom Hintergrund ab. Drei bis vier Akzentfarben, die immer dasselbe bedeuten (L+ rot, M blau, Signal je nach Ader/Gelb für LED, Erfolg grün, Fehler magenta/rot mit Symbol).
- Passt zum bestehenden Look (dunkle Oberfläche, Schriften Inter und Fira Code, Akzent Neongrün `#39ff14` sparsam). Schriften mit Fallback; keine externen Ressourcen.
- **Adern verlaufen lesbar:** weiche Kurven oder orthogonale Führung mit festen Bahnen, **keine Überlagerung** von Adern und Klemmentexten; sich kreuzende Adern mit kleiner Brücke oder Schatten. Schatten und leichte Tiefe (2.5D), aber keine Effekte, die Lesbarkeit kosten.
- **Beschriftungen immer lesbar** (mindestens 12 px bei 1366×768): Klemmenbezeichnung, Ader-Kürzel, Adresse (z. B. `%I0.4`). Ader-Farben zusätzlich als Text (BN/BU/BK/WH), wegen Farbsehschwäche.
- Einstieg: Beim Öffnen einer Aufgabe **nichts verstecken**: Sensor, Kabel, Ziel-Klemmenbereich sind im ersten Bild sichtbar.

### 2.4 Schnittstelle (Entwurf, gilt der Vertrag von Claude Code)

```js
// Modul: SensorWiring25D
const view = SensorWiring25D.mount(container, {
  netlist,        // Bauteile, Adern, Klemmen, erlaubte Verbindungen (Mock-Daten im Repo)
  state,          // aktuelle Verbindungen, Prüfergebnis je Ader, LED-Zustände
  options: { lang:'de', reducedMotion:false, touch:false }
});
view.update(state);                 // Zustand neu zeichnen
view.help(aderId);                  // "Zeig mir"
view.on('wireDrop',   (aderId, klemmeId) => {});
view.on('wireRemove', (aderId) => {});
view.on('meterProbe', (klemmeId, probeNr) => {});   // nur bei Messaufgaben
view.destroy();
```

---

## 3. Modul B: Optik der 3D-Anlage (nur Ansicht)

### 3.1 Aufgabe
Die bestehende three.js-Szene (Sortierstrecke, Bedienpult, Tankstation, Schaltschrank) lesbar und schön machen. **Nur Ansicht**: keine Interaktion ausser Kamera (autom.) und optional Umschauen. Die Anlage reagiert live auf Kanäle (Sensor schaltet, Band läuft, Werkstück, Füllstand …).

### 3.2 Anforderungen
- **Szenen-Presets pro Aufgabe:** `sortierstrecke` oder `tank` (nur das, was die Aufgabe braucht, sichtbar; Rest ausgeblendet). Kein zweiter angeschnittener Tisch im Bild.
- **Automatische Kamera:** Kamerafahrt zum betroffenen Bauteil (`focus(id)`), sanft, mit Reduzierung bei `prefers-reduced-motion`. Voreinstellungen: Übersicht, Sensor nah, Band, Tank. Keine Kamera-Knöpfe im UI.
- **Erkennbarkeit:** Jeder Sensor mit **schwebendem Etikett** („-B1 · induktiv“), dessen Farbe die Sensorart zeigt. Aktive/relevante Bauteile leuchten (Kontur oder Puls); das gilt auch für `highlight(ids)`.
- **Kontrast und Material:** Boden dunkler als Bauteile, Bauteile mit unterscheidbaren Materialien und Farben (Metall, Kunststoff, Gelb für Sicherheitsmarkierung, Farbcodes der Sensorarten). Nicht mehr grau in grau. Weiches, warmes Arbeitslicht, Schatten dezent.
- **Zustandsanzeige:** Sensor-LED gross genug erkennbar; Werkstückarten (Stahl, Alu, Kunststoff weiss/schwarz, Glas) klar unterscheidbar; Band-Bewegung sichtbar; Tank mit Wasserstand, Ventilen, Pumpe.
- **Lesbare Anzeige:** HMI-Panel und Signalsäule gut lesbar (grösser oder per Kamera nah).
- **Ohne Fachkenntnis verständlich:** Wer nichts von Sensoren weiss, erkennt, welches Teil „der Sensor“ ist, welches das Band, welches das Werkstück.

### 3.3 Technische Vorgaben
- three.js in der im Repo eingebetteten Version verwenden. Keine Klassen, die in dieser Version fehlen (Repo-Hinweis: z. B. `CapsuleGeometry`, `OrbitControls` nicht verfügbar; prüfen).
- **Leistungsbudget:** flüssig (mind. 30 fps) auf einem Schul-Laptop ohne dedizierte Grafikkarte und auf einem Mittelklasse-Handy. Qualitätsstufen (Hoch/Mittel/Niedrig) beibehalten.
- Modell aus **Primitiven und eigenen einfachen Geometrien**, keine externen Dateien. Texturen nur prozedural oder als Data-URI, klein.

### 3.4 Schnittstelle (Entwurf, gilt der Vertrag)

```js
// Modul: SensorPlant3D
const plant = SensorPlant3D.mount(container, { preset:'sortierstrecke', quality:'mittel', reducedMotion:false });
plant.setChannels({ beltRunning:true, sensorActive:true, partType:'stahl', tankLevel:0.4 });   // ENTWURF: Namen gelten nicht, der Vertrag folgt dem echten SensorScene.setState
plant.scenePreset('tank');
plant.focus('B1');                  // Kamerafahrt
plant.highlight(['B1','X2']);       // Kontur/Puls
plant.setView('small'|'large');     // klein (immer sichtbar) / gross (Phase Laufen lassen)
plant.destroy();
```

---

## 4. Rahmenbedingungen für beide Module

- **Eigenständig lauffähig ohne Netz:** keine CDN-Aufrufe, keine Webfonts als Pflicht, keine externen Bilder. Eine Datei pro Modul ist möglich; die Einbettung in die `index.html` übernimmt der Build (`build.js`) von Claude Code.
- **Bedienung:** Maus, Touch (Ziele ≥ 44 px), Tastatur; `prefers-reduced-motion` beachten.
- **Auflösungen:** 1366×768, 1920×1080, Handy 390 px. Kein seitliches Scrollen. Modul A füllt seinen Bereich, Modul B ist sowohl als kleine Kachel (ca. 320×200) als auch gross brauchbar.
- **Farbsehhilfe:** Zustände nie nur über Farbe (Symbole/Text dazu). Die Einstellung „Farbsehhilfe“ der App wird über `options.colorAid` gesetzt.
- **Kein Markenmaterial:** herstellerneutral, keine Logos, keine Siemens-Kopie; Sensoren, Klemmen und CPU als eigene Zeichnung. Nur reale Klemmen-/Adressbezeichnungen (L+, M, 1M, DIa.0, %I0.4, AI 0+) als Text.
- **Keine Logik:** Verdrahtungsregeln, Punkte und Bewertung liegen bei Claude Code (`wiring.js`). Du darfst nur zeichnen und Ereignisse melden.

---

## 5. Abnahmekriterien

Modul A (2.5D-Verdrahtung)
- Erste Ader in < 30 s: Testperson ohne Erklärung legt die erste Ader auf die richtige Klemme (mindestens 4 von 5 Personen).
- Auf jedem Mock-Datensatz (Modul 1 bis 6) sind Sensor, Adern und Ziel-Klemmen im ersten Bild sichtbar, ohne Scrollen bei 1366×768.
- Keine überlagerten Adern oder Texte; alle Beschriftungen lesbar.
- Ziehen, Antippen und Tastatur funktionieren; zulässige Ziele leuchten beim Ziehen.
- „Zeig mir“ findet die Ziel-Ader und Ziel-Klemme eindeutig.
- Farbsehhilfe: Ader-Zustand und LEDs auch ohne Farbe erkennbar.
- Handy 390 px bedienbar.

Modul B (3D-Anlage)
- Auf einem Screenshot der Vorschau sind Sensor, Band, Werkstück und Status ohne Erklärung erkennbar; jeder Sensor hat ein Etikett.
- `focus`, `highlight`, `scenePreset` funktionieren; die Kamera fährt ruhig und verdeckt nichts Wichtiges.
- Keine grau-in-grau-Fläche mit den wichtigen Teilen; Kontrast der Bauteile zum Boden klar sichtbar.
- ≥ 30 fps auf Referenz-Laptop (Qualität Mittel) und Handy (Qualität Niedrig).
- Klein (320×200) und gross gleichermassen lesbar.

---

## 6. Lieferung

1. `sensor_wiring_25d.js` (+ optional `.css`) und `sensor_plant_3d.js`.
2. Eine **Demo-Seite** `dev/demo_visual.html` mit den Mock-Daten aller sechs Module, Umschalter für Preset/Qualität/Farbsehhilfe/Reduced Motion.
3. **Screenshots** je Modul bei 1366×768, 1920×1080 und 390 px in `dev/tests/shots/visual/`.
4. Kurze Notiz `docs/VISUAL_NOTIZ.md`: Aufbau, Leistungsmessung, bekannte Grenzen.
5. Keine Änderungen an Spielregeln, Engine oder Aufgaben. Wenn der Vertrag etwas nicht hergibt, was du brauchst, in `docs/VISUAL_NOTIZ.md` als Wunsch an Claude Code festhalten, nicht selbst umbauen.

---

## 7. Nicht Teil dieses Auftrags

Aufgabeninhalte, Texte, Theorie, Editor (SCL/FUP), Variablentabelle, Portal, Leitstand, Live-Challenge, Sound (Klick-Signal nur als Aufruf einer bestehenden Funktion, falls vorhanden).
