# Notiz Visualisierung Sensorwerkstatt (W4/W5, 30.09.2026)

Ergebnis der Pakete W4 (2.5D-Verdrahtung) und W5 (Optik der 3D-Anlage) nach `docs/SENSOR_VISUAL_VERTRAG.md`. Beide Module halten die Schnittstelle der Stubs aus W3; die Prüfungen aus W3 laufen unverändert.

## Aufbau

### `dev/src/sensor_wiring_25d.js` (`SensorWiring25D`)
- **Drei Zonen** in einem CSS-Raster: Sensor mit Kabel und freien Adern · Klemmleisten (-X2 mit drei Ebenen und Signal-LED, -X3 Trennklemmen, -X1 Verteiler) · CPU und Baugruppen als Frontansicht. Bei ≤ 760 px eine Spalte (Handy).
- **Bedienelemente sind HTML-Schaltflächen** (`.sw25-core`, `.sw25-term`, ≥ 44 px), damit Ziehen (HTML5 Drag & Drop mit der Maus, Zeiger-Ziehen mit Vorschau-Ader auf Touch/Stift), Antippen–Antippen, Tastatur (Pfeiltasten, Enter, Entf, Esc) und Screenreader (aria-label mit Farbe, Belegung, Zustand) gleich funktionieren. Sensor-Illustrationen (Zylinder M18 mit Gewinde und LED, Lichttaster/-schranke, Transmitter mit Anschlusskopf, Taster/Not-Halt, Zylinderschalter) sind Inline-SVG je `netlist.parts[].shape`, herstellerneutral.
- **Kabel** liegen in zwei SVG-Ebenen: unter den Schaltflächen Schatten und vorgegebene Leitungen zwischen Klemmen (dunkelblau), darüber die Adern in Aderfarbe mit Beschriftung (BN/BU/BK/WH) und Prüfzeichen am Klemmenende (✓ ✗ im Kreis). Pfad: S-Kurve waagrecht, wenn die Klemme rechts liegt, sonst senkrecht (Handy). Positionen aus `getBoundingClientRect`, neu gezeichnet über `ResizeObserver`.
- **Aufgabenbezogene Reduktion:** Klemmenzeilen und Baugruppen-Gruppen, die weder Ziel noch Nachbar sind und keine Ader tragen, liegen in `<details>` „n weitere Klemmen“ (beim Ziehen aufgeklappt). Damit passt der Einstieg in 1366×768 ohne Scrollen; „Nie 60 gleiche Klemmen“ ist eingehalten.
- **Zustände immer doppelt:** Farbe (Rand, Glow) und Zeichen/Text (✓ richtig, ✗ falsch, ○ fehlt, • gelegt; im aria-label als Wort). Farbsehhilfe (`options.colorAid`): Strichmuster je Ader (BU gestrichelt, BK gepunktet, WH Strich-Punkt), Muster auf den Farbchips, + und − an den Ebenen. `reducedMotion`: keine Pulsanimation, keine Übergänge, kein sanftes Scrollen.
- **„Zeig mir“:** `view.help()` löst `helpShow` aus, Ader und Zielklemme pulsieren gelb, die Klemme wird in den sichtbaren Bereich gerollt; Text aus `state.help.text`.
- CSS wird vom Modul selbst eingefügt (`#sw25Css`), daher eine Datei, keine `.css` nötig.

### `dev/src/sensor_plant_3d.js` + `dev/src/scene_sensor.js` (`SensorPlant3D`)
- Hülle um `SensorScene` (Entscheid W3); `highlight(ids)` ruft jetzt `scene.setHighlight`, neu `setLabels(on)`.
- In `scene_sensor.js` nur Optik: Boden dunkler (Epoxid 0x3a3f45, Beton 0x5a5c5e), Aluminium/Stahl heller, warmes Licht (Hemisphäre 0xe3e9f0/0x3a3128 0,7, Sonne 0xfff4e0 0,7, Hallenlichter warm). **Sensoren farbcodiert:** induktiv Metall mit orangem Ring, kapazitiv Messing, optisch blau, magnetisch grün. **Etiketten** als Sprites (Canvas 256×72, `depthTest:false`, ohne Nebel) über jedem Sensor mit BMK und Art („-B1 induktiv“), Farbe nach Art; Nachbarn in der Höhe versetzt. **Hervorhebung:** pulsierende gelbe Hülle um die Bauteil-Ausdehnung (`boundsOf`), das Etikett wird grösser; mit `prefers-reduced-motion` statisch.
- Presets: `sortierstrecke` → Ansicht 2, `tank` → Ansicht 4 (unverändert aus W3).

## Leistungsmessung
- `tests/sensor_scene.js` (SwiftShader, ohne GPU): je Ansicht 10 084–12 120 Dreiecke, 17–60 Draw-Calls (Budget 120 000 / 150). Die 15 Etiketten kosten 14–15 Draw-Calls in den Ansichten, in denen sie sichtbar sind. Bildrate in SwiftShader ≈ 10 fps (Richtwert, reines Software-Rendering); auf einer echten GPU nicht gemessen (in der Cloud-Sitzung nicht möglich). Erwartung wie vor W5: die Szene war schon mit ~12 000 Dreiecken sehr leicht, Sprites und die Hülle ändern daran nichts.
- 2.5D-Ansicht: reines DOM/SVG, kein Canvas; Neuzeichnen der Kabel nur bei Zustands- oder Grössenänderung (`requestAnimationFrame`, einmal je Änderung).

## Screenshots
`dev/tests/shots/visual/`: `modul<1–6>_<1366|1920|390>.png` (Demo-Seite, Zustand „halb“, Anlage „laeuft“), `anlage_modul1_gross.png`, `anlage_modul4_gross.png`, `anlage_klein.png`. Erzeugt mit `node tests/visual_shots.js` (`--quick` = nur Modul 1 und 4). Der Lauf prüft zugleich, dass es bei 390 px kein waagrechtes Scrollen gibt.

## Bekannte Grenzen
1. **Etiketten in der kleinen Anlage (320×200)** sind lesbar nur für das hervorgehobene Bauteil (grösseres Schild); die übrigen sind zu klein. Sprites mit fester Bildschirmgrösse (`sizeAttenuation:false`) wären in der Übersicht zu gross und würden sich überdecken. Vorschlag für W6: in der kleinen Kachel `setLabels(false)` und nur `highlight` nutzen.
2. **„Rest ausgeblendet“ je Preset** (nur Sortierstrecke bzw. nur Tank sichtbar) ist nicht umgesetzt: die statische Geometrie ist je Material zusammengefasst (Leistung, Picking über Dreiecksbereiche), einzelne Anlagenteile lassen sich nicht ausblenden, ohne den Aufbau der Szene zu ändern. Die Presets wählen die Kamera so, dass die jeweils andere Anlage nicht im Bild ist; Ansicht 2 zeigt den Tisch ganz, kein „angeschnittener zweiter Tisch“.
3. **Kein Umschauen** per Maus in der Hülle vorgesehen (Auftrag: nur Ansicht); `SensorScene` erlaubt weiterhin begrenztes Drehen/Zoomen mit Zeiger und Tasten, das die Integration (W6) bei Bedarf sperrt.
4. **Adern kreuzen** sich bei mehreren Bauteilen ohne Brückensymbol; Kreuzungen werden durch den Schatten (2.5D) unterscheidbar, Beschriftungen liegen an der Pfadmitte und können sich bei vielen Adern (Boss-Aufgaben) berühren. Eine Bahnführung mit festen Kanälen wäre der nächste Schritt.
5. HTML5 Drag & Drop feuert in Chromium keine `dragover`-Ereignisse über SVG-Elementen; deshalb sind alle Ziele HTML-Elemente (Absicht, kein Fehler).
6. Die Zeichnung der Sensoren ist schematisch (kein Foto, wie verlangt); Typenschild-Bild (Feedback Paket 2.3) ist nicht Teil dieses Pakets.

## Wünsche an Claude Code (W6)
- `netlist` könnte je Klemme eine `hint` (Kurztext „24 V“, „0 V“, „Signal → CPU“) liefern; heute baut die Ansicht das aus `level`/`potential`.
- Für Messaufgaben: `state.meter = { probe1, probe2, value, unit }`, damit die Ansicht die Messspitzen und den Wert zeichnen kann (Multimeter/Kalibrator-Overlay ist noch nicht gezeichnet, das Ereignis `meterProbe` wird aber gemeldet).
- `SensorVisual.plant` könnte `dist` (Schaltabstände) und `hmi` mitgeben, dann zeigt die Anlage in Modul 3 den Abstand und in Modul 4–6 die HMI-Werte.
