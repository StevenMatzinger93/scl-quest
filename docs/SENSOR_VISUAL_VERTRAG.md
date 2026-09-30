# Schnittstellenvertrag Visualisierung Sensorwerkstatt (Paket W3)

Stand: 30.09.2026 · gehört zu `AUFTRAG_SENSORWERKSTATT_UMBAU.md` (W3) und `AUFTRAG_FABLE_VISUALISIERUNG.md` (W4/W5).
**Dieser Vertrag ist verbindlich.** Wo der Fable-Brief andere Namen nennt (`setChannels({sensorActive, partType, tankLevel})`, `SensorPlant3D` als Neuentwicklung), gilt diese Datei. Sie ist aus dem echten Code abgeleitet (`wiring.js`, `sensor_tasks.js`, `scene_sensor.js`).

## 1. Grundsatz

- Fable **zeichnet und meldet Ereignisse**. Regeln, Punkte, Bewertung, Engine, Aufgaben, Texte und Editor gehören Claude Code. Wenn der Vertrag etwas nicht hergibt: als Wunsch in `docs/VISUAL_NOTIZ.md` festhalten, nicht selbst umbauen.
- Zwei Module, beide mit **fester Schnittstelle**. Beide liegen schon als lauffähige **Referenz-Stubs** im Repo. Fable ersetzt die Darstellung, die Schnittstelle bleibt.

| Modul | Datei | Stub heute | Fable liefert |
|---|---|---|---|
| `SensorWiring25D` | `dev/src/sensor_wiring_25d.js` | ~~Stub~~ **W4 umgesetzt (30.09.2026):** 2.5D-Ansicht mit Sensor-Illustration, Kabel, Klemmleisten, CPU; CSS im Modul | siehe `docs/VISUAL_NOTIZ.md` |
| `SensorPlant3D` | `dev/src/sensor_plant_3d.js` | **Hülle um `SensorScene`** (`scene_sensor.js`); **W5 umgesetzt:** Etiketten, Hervorhebung, Farbcodes, Licht | siehe `docs/VISUAL_NOTIZ.md` |

- **Entscheid zu `SensorPlant3D` (Empfehlung, gilt bis Steven widerspricht): Hülle, keine Neuentwicklung.** `SensorScene` liefert schon Picking, LEDs, Qualitätsstufen, Kamerafahrt (`focusOn`), Ansichten und Tests (`tests/sensor_scene.js`: ≤ 120 000 Dreiecke, ≤ 150 Draw-Calls, alle Bauteile anklickbar). Fable darf dafür in `scene_sensor.js` **Materialien, Licht, Farben, Beschriftungen, Kamerapositionen** ändern, muss aber die öffentliche API und `tests/sensor_scene.js` grün lassen. Der Schaltschrank-Innenraum (Ansicht 5/6) wird nach dem Umbau nicht mehr benutzt; er darf unverändert bleiben.
- Kein Netz, keine externen Dateien, three.js r128 aus dem Repo (**kein** `CapsuleGeometry`, **kein** `OrbitControls`). Eine Datei pro Modul ist erlaubt; der Build (`build.js`) bettet ein.

## 2. Daten: `SensorVisual` (Node-testbar, `dev/src/sensor_visual.js`)

Erzeugt aus dem echten Spielzustand alles, was `SensorWiring25D` braucht. Fable ruft es **nicht** im Spiel auf, sondern bekommt die Ergebnisse als Mock-Daten (Abschnitt 6); im Spiel ruft Claude Code es auf (W6).

```js
SensorVisual.netlist(task, ctx)        // statisch: Bauteile, Adern, Klemmen, Baugruppen, zulässige Ziele
SensorVisual.state(task, ctx, opt)     // dynamisch: Adern, Prüfergebnis je Ader, LEDs, Fehler, Hilfe
SensorVisual.help(task, ctx)           // nächstes Ziel für „Zeig mir“
SensorVisual.apply(task, ctx, event)   // Ereignis (wireDrop/wireRemove) → echter Spielzustand
SensorVisual.plant(task, ctx, opt)     // Anlagenzustand (Felder von SensorScene.setState)
```

### 2.1 `netlist` (statisch, JSON)

```jsonc
{ "version": 1,
  "task": { "id": "w1_b1_anschliessen", "title": "…", "module": 1, "scene": "sortierstrecke", "phase": "verbinden", "tools": [] },
  "parts": [ {                                   // Bauteile der Aufgabe (nur diese zeichnen)
      "id": "B1", "label": "-B1", "name": "Induktiver Sensor M18, bündig, PNP NO, Sn 8 mm",
      "type": "sensor3",                          // sensor3 | sensor4 | sender | contact2 | analogU | analog2w | analog4w | poti
      "shape": "induktiv_m18",                    // Zeichenform, Liste siehe SensorVisual.SHAPE
      "output": "PNP", "contact": "NO", "address": "%I0.4",
      "cable": { "connector": "m12",              // m12 | litze (freie Adern ohne Stecker)
        "cores": [ { "id": "B1:BN", "part": "B1", "pin": "BN", "color": "braun", "hex": "#8b5a2b", "m12Pin": 1, "role": "L+" }, … ] } } ],
  "strips":  [ { "id": "X2", "name": "Initiatorenklemmen", "rows": [1,2,3,4,5,…] } ],   // X1 Verteiler, X2 Initiatorenklemmen (3 Ebenen + LED), X3 Trennklemmen
  "modules": [ { "id": "A1", "name": "CPU 1214C DC/DC/DC" } ],                          // A1 CPU, A2 SM 1231, A3 SM 1232, A4 SM 1221
  "terminals": [ {                                // Klemmstellen, die die Aufgabe zeigt
      "id": "X2:5.L+", "block": "X2", "kind": "initiatorklemme", "group": "X2:5", "row": 5, "level": "L+",
      "label": "L+", "potential": "L+", "address": null, "led": false, "capacity": 1,
      "relevance": "ziel" } ],                     // ziel | nah | ruhe → Hervorhebung: „ruhe“ zurücknehmen, „ziel“ nie verstecken
  "allowed": { "B1:BN": ["X2:5.L+", …] },         // zulässige Ziele je Ader = alle Klemmen des Ausschnitts (Ader → Ader gibt es nicht)
  "targets": [ { "a": "B1:BN", "b": "X2:5.L+" } ],// Referenzverbindungen – NUR für Tests/Demo. Im Spiel NIE anzeigen (verrät die Lösung).
  "bridges": [ { "id": "QB_X2_LP", "name": "…" } ] }
```

Klemmenarten: `initiatorklemme` (`X2:<zeile>.L+|S|M`, die Ebene `S` hat `address` und `led`, Kapazität 2), `verteiler` (`X1:L+<n>`, `X1:M<n>`), `trennklemme` (`X3:<n>.a|b`, `side` `feld`/`sps`, `measureJack`), `cpu` (`A1:DIa.4` = %I0.4, `A1:1M`, `A1:AI0`), `analogmodul` (`A2:0+`, `A2:0-`), `analogausgang` (`A3:…`), `digitalmodul` (`A4:.0` = %I16.0). Adressen und Klemmenbezeichnungen sind reale Bezeichnungen aus dem Klemmenplan (`docs/SENSORWERKSTATT_PLAN.md` 2.4).

### 2.2 `state` (dynamisch, JSON)

```jsonc
{ "version": 1, "taskId": "…", "powered": true,
  "wires":  [ { "id": "w0", "core": "B1:BN", "a": "B1:BN", "b": "X2:5.L+", "ferrule": true, "prefilled": false, "result": "ok" } ],   // nur Adern von Bauteilen
  "links":  [ { "id": "l0", "a": "X2:5.S", "b": "A1:DIa.4", "prefilled": true } ],                                                   // vorgegebene Leitungen zwischen Klemmen (nur Anzeige)
  "bridges": ["QB_X2_LP", "QB_X2_M"],
  "results": { "B1:BN": "ok", "B1:BU": "falsch", "B1:BK": "fehlt" },   // ok | falsch | fehlt | gesetzt (gelegt, ohne Regel)
  "complete": false,                                                    // Verdrahtungsschritte der Aufgabe erfüllt
  "leds":  { "X2:5.S": true, "A1:DIa.4": true },                        // Signal-LED je Klemme/Eingang
  "sensorLeds": { "B1": true },                                         // LED am Sensor
  "faults": [ { "code": "short_output", "part": "B1", "text": "…" } ],
  "help": { "action": "wireDrop", "core": "B1:BN", "terminal": "X2:5.L+", "from": "B1:BN", "to": "X2:5.L+", "text": "Ader BN von -B1 auf -X2:5 Ebene L+ legen." } }
```

- **Zustände immer auch als Zeichen/Text darstellen, nicht nur als Farbe** (✓ richtig, ✗ falsch, ○ fehlt).
- `help` ist `null`, wenn nichts zu tun ist. `help.action` ist `wireDrop` (Ader legen) oder `wireRemove` (falsch gelegte Ader lösen, Fehlersuche). Ohne `core` handelt es sich um eine Leitung zwischen zwei Klemmen (`from`/`to`).
- Mechanik läuft automatisch (Auftrag Abschnitt 3): Aderendhülsen, Querbrücker, Einschalten setzt `apply` bzw. das Spiel selbst. Die Darstellung zeigt sie höchstens als Ergebnis (`bridges`).

### 2.3 Ereignisse (Darstellung → Spiel)

| Ereignis | Argumente | Wirkung im Spiel (`SensorVisual.apply`) |
|---|---|---|
| `wireStart` | `(coreId)` | Ader gegriffen. Nur Rückmeldung, Ziele leuchten (`netlist.allowed`) |
| `wireDrop` | `(coreId, terminalId)` | Ader auf Klemmstelle. Ersetzt die bisherige Klemme der Ader (eine Ader hat ein freies Ende), Querbrücker der Aufgabe werden gesetzt |
| `wireRemove` | `(coreId)` | Ader lösen (Papierkorb, aus der Klemme ziehen, Entf) |
| `helpShow` | `(coreId, terminalId)` | „Zeig mir“ ausgelöst; Darstellung lässt Ader und Zielklemme pulsieren |
| `meterProbe` | `(terminalId, probeNr)` | Messspitze 1/2 auf Klemmstelle (nur wenn `task.tools` das Multimeter nennt) |
| `focus` / `highlight` / `scenePreset` | siehe Abschnitt 3 | Spiel → Anlage |

Nach jedem Ereignis ruft das Spiel `view.update(SensorVisual.state(...))` auf. Die Darstellung hält **keinen** eigenen Wahrheitszustand.

### 2.4 `SensorWiring25D` (Schnittstelle)

```js
const view = SensorWiring25D.mount(container, { netlist, state, options: { lang: 'de', reducedMotion: false, touch: false, colorAid: false } });
view.update(state);              // neu zeichnen
view.help(coreId?);              // „Zeig mir“ (ohne coreId: state.help). Löst helpShow aus.
view.on('wireStart' | 'wireDrop' | 'wireRemove' | 'helpShow' | 'meterProbe', fn);  view.off(event, fn);
view.select(coreId);             // Ader auswählen (Antippen–Antippen)
view.destroy();
```

Pflicht: Ziehen **und** Antippen–Antippen **und** Tastatur (Pfeiltasten/Tab wählen, Enter setzt, Entf löst, Esc bricht ab); Touch-Ziele ≥ 44 px; zulässige Ziele leuchten beim Ziehen, unzulässige gedimmt; `prefers-reduced-motion` und `options.colorAid` beachten; kein Scrollen im ersten Bild bei 1366×768; Beschriftungen ≥ 12 px.

## 3. Anlage: `SensorPlant3D` (Hülle um `SensorScene`)

```js
const plant = SensorPlant3D.mount(container, { preset: 'sortierstrecke', quality: 'mittel', reducedMotion: false, size: 'large', onPick(id) {} });
plant.setChannels(fields);        // = SensorScene.setState (Felder unten); nicht genannte Felder behalten ihren Wert
plant.scenePreset('sortierstrecke' | 'tank');   // Kameraansicht und sichtbare Anlagenteile
plant.focus(id);                  // Kamerafahrt: Bauteil-ID (BMK) oder 'uebersicht' | 'sensor' | 'band' | 'tank'
plant.highlight(ids);             // Kontur/Puls; [] hebt auf
plant.setView('small' | 'large'); // klein (ca. 320×200, immer sichtbar) / gross (Laufen lassen)
plant.setQuality('hoch' | 'mittel' | 'niedrig' | 'auto');
plant.scene;                      // die SensorScene (setView 1–7, pickAt, screenPos, stats, components …)
plant.destroy();
```

**Es gibt in der Sensorwerkstatt kein Kanalmodell wie in den vier Quests** (`armAngle`, `beltRunning` …). Massgeblich sind die Felder von `SensorScene.setState` (Quelle: `scene_sensor.js`, Beispiel im Spiel: `sensor_game.js`, `SensorVisual.plant`):

| Feld | Typ / Bereich | Bedeutung |
|---|---|---|
| `beltRunning` | bool | Förderband läuft |
| `cylinder` | 0…1 | Auswerferzylinder ausgefahren |
| `feeder` | bool | Vereinzeler schiebt |
| `parts` | `[{ x: 0…1.3, material }]` | Werkstücke auf dem Band; `x` in m ab Bandanfang; `material`: `stahl` `edelstahl` `aluminium` `messing` `kunststoff_w` `kunststoff_s` `glas` |
| `pump` | 0…1 | Pumpendrehzahl |
| `heater` | bool | Heizstab |
| `level` | 0.001…0.6 | Wasserstand im Messtank in m (Tankhöhe 0,6 m) |
| `inflow` | bool | Zulauf offen (Wasseroberfläche bewegt sich) |
| `reserveLevel` | 0…0.4 | Vorrat / Schwimmer -B9 in m |
| `leds` | `{ P1: bool\|'blink', P2: … }` | Leuchtmelder nach BMK |
| `hmi` | `{ level: mm, pressure: mbar, temp: °C, flow: l/min }` oder `null` | Anzeigewerte am HMI-Panel |
| `aria` | Text | Meldung am ARIA-Monitor |
| `dist` | `{ B1: mm, B2: mm }` | Schaltabstände (Sichtbarmachung) |

- `sensorActive`, `partType`, `tankLevel` aus dem Fable-Brief gibt es **nicht**. Die **Sensor-LED** ist heute ein LED-Objekt der Szene (`leds`, `ledState`); soll sie stärker sichtbar werden, ist das Optik (Fable).
- Presets: `sortierstrecke` → Ansicht 2 (Sortierstrecke, Bedienpult), `tank` → Ansicht 4 (Tankstation). „Rest ausgeblendet“ ist Optik (Fable), Kamera und Sichtbarkeit gehören zum Preset. Kein zweiter angeschnittener Tisch im Bild.
- Bauteil-IDs für `focus`/`highlight` (BMK): `MB1 M1 B1 B2 B3 B4.1 B4.2 B5 R5 MB2 B6 B7 S5 HAUBE S1 S2 S3 S4 R1 P1 P2 P3 TANK VORRAT M2 T2 MB4 MB5 MB3 E1 B10 B11 B12 B13 B8 B9 SCHRANK Q0 F1 G1 F2 F3 K0 A1 A2 A3 A4 K1 K2 K3 X1 X2 X3 X4 LAPTOP HMI ARIA WERKBANK KISTEN` (und die Werkzeuge `T_*`, die nach dem Umbau nicht mehr vorkommen).
- Etiketten: jeder Sensor hat ein schwebendes Etikett („-B1 induktiv“), Farbe nach Sensorart (`scene.setLabels(on)`, `plant.setLabels(on)`); Hervorhebung als pulsierende Hülle (`scene.setHighlight(ids)`). Umgesetzt in W5.
- Budget: ≤ 120 000 Dreiecke und ≤ 150 Draw-Calls je Ansicht (`tests/sensor_scene.js`), ≥ 30 fps Mittelklasse-Laptop (Qualität Mittel) und Mittelklasse-Handy (Niedrig). Modell aus Primitiven und eigenen Geometrien; Texturen prozedural oder Data-URI.

## 4. Was Fable liefert (aus dem Auftrag, mit den Pfaden dieses Repos)

1. `dev/src/sensor_wiring_25d.js` (+ `.css`) und `dev/src/sensor_plant_3d.js` (plus die Optik-Änderungen an `dev/src/scene_sensor.js`).
2. `dev/demo_visual.html` (Skelett liegt vor: Modul-/Aufgaben-/Zustandswahl, Anlage-Zustand, Qualität, Reduced Motion, Farbsehhilfe, klein/gross). Fable erweitert sie und macht die Screenshots.
3. Screenshots je Modul (1366×768, 1920×1080, 390 px) in `dev/tests/shots/visual/`.
4. `docs/VISUAL_NOTIZ.md`: Aufbau, Leistungsmessung, bekannte Grenzen, Wünsche an Claude Code.

## 5. Nicht ändern

`sensor_visual.js`, `wiring.js`, `sensor_tasks.js`, `sensor_flow.js`, `sensor_game.js`, `workshop_ui.js`, `engineering_ui.js`, `scene_sensor2d.js` (bleibt bis zur Integration als Rückfall), Aufgaben, Texte, Engine, Editor, Portal. Ausnahme: `scene_sensor.js` nur für Optik und Kamera (Abschnitt 1).

## 6. Mock-Daten, Demo, Tests

- `dev/mock/sensor_visual/mock_all.js` setzt `window.SENSOR_VISUAL_MOCK` mit **allen 30 angezeigten Aufgaben** (6 Module × 5): `modules`, `tasks[id] = { title, module, no, scene, phase, tools, netlist, states: { start, halb, fertig, falsch } }`, `plant[scene][zustand]` (Anlagenzustände `aus`/`laeuft`/…), `plantFields`, `materials`. Erzeugt aus den echten Aufgaben mit `node dev/gen_visual_mock.js` (nicht von Hand ändern; `--check` prüft, ob sie aktuell ist).
- Demo öffnen: `dev/demo_visual.html` direkt im Browser (file://, ohne Netz; three.js aus `dev/node_modules`, dafür einmal `npm install` in `dev/`).
- Prüfungen (müssen grün bleiben, gelten auch für Fables Module):
  - `node dev/test_sensor_visual.js` (Vertrag, Netzliste, Ereignisse, Mock aktuell; 355 Prüfungen)
  - `node dev/tests/sensor_visual_stub.js` (Demo im Browser: alle 30 Mock-Aufgaben mounten, Antippen/Ziehen/Tastatur/Zeig mir, Anlage-API; 44 Prüfungen)
  - `node dev/tests/sensor_scene.js` (Budget, Picking)

## 7. Integration durch Claude Code (W6, zur Information)

Das Spiel hält `ctx` (Verdrahtung, Variablen, Programm). Bei jedem Ereignis: `SensorVisual.apply(task, ctx, event)` → `view.update(SensorVisual.state(task, ctx, { world }))`; `plant.setChannels(SensorVisual.plant(…))` im 50-ms-Takt; `plant.scenePreset(task.scene)`, `plant.focus(<Bauteil der Hilfe-Ader>)` bei „Zeig mir“. `Wiring2D` (`scene_sensor2d.js`) bleibt bis dahin die Verdrahtung und wird erst danach entfernt.
