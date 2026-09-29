# Feedback Klassentest 1 (SPS 2026 Gruppe 2, 29.09.2026) – Auswertung und Massnahmen

## 1. Was die Lernenden gesagt haben

| Quest | Wer | Aussage | Kern |
|---|---|---|---|
| SCL (r1t1) | Finn | Viel Positives, aber viel Text, Aufgaben sieht man nicht gut | Textmenge, Auftrag nicht sichtbar |
| FUP (f1_bue) | Eric | Aufgaben verständlich und lösbar, Aufbau der Bausteine umständlich | Editor-Bedienung |
| Sensor (w1_band_selbsthaltung) | Eric | FUP wählbar, aber Bausteine lassen sich nicht hereinziehen | **Fehler** |
| Sensor (w1_band_selbsthaltung) | Noel | Am Engineering-Laptop in FUP/KOP keine Bausteine sichtbar | **Fehler** (gleiche Ursache) |
| Sensor (w1_b1_anschliessen) | Noel | Nicht auf den ersten Blick erkennbar, was, wie und wo | Führung fehlt |
| Sensor (w1_datenblatt) | Eliah | Nicht beschrieben, was man machen soll, unübersichtlich | Führung fehlt |

Stevens Beobachtungen: zu viel Wiederholung, SCL gut, aber später schwieriger (Auftrag nur als Text, Variablentabelle erst danach), etwa halb so viele Aufgaben, Bildschirmaufteilung ungünstig (Aktionen und Maschine nicht gleichzeitig sichtbar), Knopf „Anlage testen“ fehlt, FUP soll sich wie TIA anfühlen, Sensorwerkstatt muss geführter sein (alle schnell wieder weg).

Auffällig: Alle Rückmeldungen betreffen **Kapitel 1 bzw. Modul 1**. Die ersten 5 Minuten entscheiden. Die Inhalte werden gelobt, die Probleme liegen bei Orientierung, Bildschirmaufteilung und Bedienung.

## 2. Ursachen im Code (Stand Repo 29.09.)

1. **Sensorwerkstatt KOP/FUP = Textfeld.** `sensor_game.js` Z. 73 ruft `Engineering.mount(...)` ohne `editor` auf. `engineering_ui.js` zeigt dann für KOP/FUP nur ein Textfeld im Textformat plus statische Vorschau (`renderStatic`). Der grafische Editor aus `kop_editor.js` ist nicht eingebunden. → echter Fehler, keine Geschmacksfrage.
2. **Bildschirmaufteilung.** `body.html`: links Anlage → Missionstext → Aufgabe → Funk untereinander, rechts Editor → Knopf → Testbericht/Erfolg. Auf einem Schul-Laptop liegt der Auftrag unter der Anlage und der Testbericht unter dem Editor → Scrollen. Beim Testen spielt `playRun` die Testfälle auf der Anlage ab, aber die Anlage ist dann meist nicht im Bild.
3. **Kein freier Probelauf.** Es gibt nur „In SPS laden & testen“ (feste Testfälle). Einen Betrieb wie PLCSIM, in dem man selbst Taster/Sensoren betätigt und zuschaut, gibt es in den vier Quests nicht (`SCLEngine.createRuntime` existiert bereits für die Sensorwerkstatt).
4. **Viel Text pro Aufgabe.** story + brief + learn + take + Funk + ARIA. Bei r1t1 steht der eigentliche Auftrag (1 Zeile) zwischen Story und Lernziel.
5. **10 Aufgaben pro Kapitel, alle Pflicht.** Mehrere Aufgaben üben dasselbe (z. B. Kap. 1: r1t1, c1_arm, c1_band = je „Variable := Wert“).
6. **Variablennamen stehen immer im Auftrag** (`<code>Greifer_Auf</code>`), dazu Variablenliste mit Klick-Einfügen. Bis Kapitel 15 keine Abnahme der Hilfe.
7. **FUP-Editor denkt vom Eingang her:** Eingang antippen → „&“ macht daraus eine UND-Box (Baum-Umbau). Im TIA Portal zieht man zuerst eine leere Box ins Netzwerk und füllt dann die Platzhalter `<??.?>`. Eigenschaften werden oben in einer separaten Leiste eingegeben statt direkt an der Box.
8. **Sensorwerkstatt:** Arbeitsschritte als Liste in der linken Spalte, alle Schritte gleichzeitig offen, kein „Jetzt tun“, keine Hilfe, wo in der 3D-Werkstatt etwas ist und welches Werkzeug es braucht. Typenschild nur als Textzeile.

## 3. Massnahmen

### Paket 1 – vor dem nächsten Klassentest (klein, grosse Wirkung)

**1.1 Fehler Sensorwerkstatt beheben:** Grafischen KOP/FUP-Editor im Engineering-Laptop einhängen (Palette, Ziehen, Variablen aus der PLC-Variablentabelle). Test in `tests/sensor_engineering_ui.js`: FUP wählen → Box ziehen → übersetzen → laden.

**1.2 Ein-Bildschirm-Layout (alle Quests, gemeinsamer Code):** Zielauflösungen 1366×768 und 1920×1080 ohne Scrollen.
- Links oben: **Auftragskarte** kompakt – Titel, Auftrag als Checkliste (max. 3 Punkte), Story einklappbar (1 Satz sichtbar), Lernziel/Merksatz in „ⓘ“.
- Links unten: **Anlage**, immer sichtbar (sticky).
- Rechts: Editor mit festen Knöpfen darunter.
- Testbericht nicht unter dem Editor, sondern als Leiste/Schublade über dem unteren Editorrand oder neben der Anlage – beim Prüfen muss man Anlage und Ergebnis gleichzeitig sehen.
- Funk/ARIA als kleine Einblendung statt eigener Karte.

**1.3 Textdiät:** Story max. 2 Sätze, Auftrag max. 3 Zeilen und immer als Erstes sichtbar. Validator-Regel: Warnung bei zu langem `brief`/`story`.

### Paket 2 – Tempo und Selbstwirksamkeit

**2.1 Kernpfad statt 10 Pflichtaufgaben:** Pro Kapitel ca. 5 Kernaufgaben (neues Konzept, Fehlersuche, Anwendung, Boss). Die übrigen werden **Training** (freiwillig, Sterne/Punkte). Nicht löschen: Aufgaben-IDs werden von Pikett, Störungsjagd, Prüfungspool und Spielständen genutzt → Feld `core:true` bzw. `extra:true` in `defTask`, Kapitel gilt mit den Kernaufgaben als abgeschlossen.
**Schnellspur:** Wer eine Kernaufgabe beim ersten Versuch ohne Hinweis löst, darf die nächste gleichartige überspringen („Du hast es drauf – weiter?“).

**2.2 Knopf „▶ Anlage testen“ (Probebetrieb wie PLCSIM):** Programm läuft zyklisch auf der Anlage, Taster/Sensoren in der 2D-/3D-Szene und in einer kleinen Beobachtungstabelle anklickbar, Ausgänge und Variablenwerte live. Getrennt von „✓ Prüfen“ (Testfälle, zählt für Punkte). Probebetrieb zählt nicht als Fehlversuch. Technik: `createRuntime` aus der Sensorwerkstatt wiederverwenden, Szenen-Bindings (`bind`) rückwärts für Eingaben nutzen.

**2.3 Sensorwerkstatt geführt:**
- Arbeitsschritte als **Auftragsleiste über der 3D-Ansicht** (wie ein Quest-Log im Spiel), immer ein Schritt aktiv, die nächsten ausgegraut.
- Jeder Schritt mit **„Zeig mir“**: Kamera fährt zum Bauteil, Bauteil pulsiert, benötigtes Werkzeug leuchtet in der Werkzeugleiste. Falsches Werkzeug → kurzer Hinweis statt Nichts.
- Modul 1 als **interaktives Tutorial** („Nimm den Gabelschlüssel“ → „Klick auf -B1“ → …), ab Modul 2 freier.
- Typenschild als Bild (Sensor mit Aufdruck), Fragen direkt daneben.
- Erster Besuch: 60-Sekunden-Einführung mit Handlungen (Werkzeug wählen, Bauteil anklicken, Klemmleiste, Laptop, „Arbeit prüfen“).

### Paket 3 – grössere Umbauten

**3.1 FUP-Editor nach TIA-Vorbild** (gilt auch für KOP und Sensorwerkstatt):
- Rechts Anweisungs-Palette mit Ordnern wie TIA (Bitverknüpfungen, Zeiten, Zähler, Vergleicher, Mathematik, Übertragen) + Favoritenleiste über dem Netzwerk (&, >=1, X, =, S, R, SR, RS).
- Box ins leere Netzwerk ziehen → Box mit roten Platzhaltern `<??.?>`; Box auf einen Eingang einer anderen Box ziehen → verschachteln.
- Operand direkt in der Box anklicken und tippen, Autovervollständigung; Variable aus der Variablentabelle auf den Platzhalter ziehen.
- „*“ an der Box = Eingang hinzufügen, Klick auf den Eingangsanschluss = negieren, Rechtsklick-Menü, Entf löscht.
- Das Netzwerkmodell (`kop.js`) bleibt; nur die Bedienung ändert sich. Früh mit 2–3 Lernenden gegentesten.

**3.2 Hilfe schrittweise abbauen (Lastenheft-Stufen), zuerst SCL:**
- Stufe A (Kap. 1–3): wie heute, Variablennamen im Auftrag.
- Stufe B (Kap. 4–7): Auftrag in Anlagensprache ohne Variablennamen („Wenn Start gedrückt wird und die Tür zu ist …“). Variablentabelle mit Adresse und Kommentar steht zur Verfügung, die Zuordnung finden die Lernenden selbst.
- Stufe C (ab Kap. 8): Nur Lastenheft-Text + E/A-Liste (Adresse, Kommentar). Variablen (Name, Typ) und Hilfsvariablen legen die Lernenden selbst an.
- Technik für Stufe C: Tests über Adressen (%I/%Q) statt über Namen binden, damit freie Namen möglich sind.

## 4. Reihenfolge und Messung

1. Paket 1 (1.1 → 1.2 → 1.3), danach kurzer zweiter Klassentest.
2. Paket 2 (2.1 und 2.3 zuerst, dann 2.2).
3. Paket 3 (3.1 FUP, dann 3.2 für SCL; KOP/FUP/AWL nachziehen).

Für den nächsten Test mitmessen (Ereignisse mit Zeitstempel sind vorgesehen): Zeit bis zur ersten Eingabe, Abbruch pro Aufgabe, Anzahl Aufgaben pro Lektion, Verweildauer in der Sensorwerkstatt. Zusätzlich eine Frage im Feedback-Formular: „Wusstest du sofort, was zu tun ist? (ja/eher/nein)“.
