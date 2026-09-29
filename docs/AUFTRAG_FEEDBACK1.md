# Auftrag für Claude Code: Umsetzung Feedback Klassentest 1

Repo: `StevenMatzinger93/scl-quest`. Diese Datei als `docs/AUFTRAG_FEEDBACK1.md` ins Repo legen.
Arbeitsweise wie in `docs/ENTSCHEIDUNGEN.md`: pro Paket ein Nebenzweig mit Vorschau, Übernahme nach main bei grünen Tests, danach `docs/STAND.md` nachführen.

Alle Entscheidungen wurden am 29.09.2026 mit Steven einzeln bestätigt (Abschnitt „Bestätigte Entscheidungen“ am Ende). Die Musik-Hörprobe `docs/Hoerprobe_Musik.html` (Industrie-Version) ins Repo legen – sie ist die Vorlage für Paket 2.4.

**Prompt zum Einfügen in Claude Code:**

> Lies `docs/AUFTRAG_FEEDBACK1.md` und setze Paket 0 um, danach Paket 1, dann der Reihe nach. Nach jedem Paket: Tests grün, STAND.md nachführen, kurz berichten. Bei Unklarheiten, die das Verhalten für Lernende ändern, zuerst fragen.

---

## Paket 0 – Pikettdienst vollständig entfernen (Entscheid Steven, 29.09.2026)

Grund: Im Klassentest unverständlich, frustrierend, keine Navigation, Abschicken wirkte kaputt. Kein Umbau – ganz raus.

Entfernen:
- `dev/src/pikett_core.js`, `dev/src/content*/pikett.js` (SCL, KOP, FUP, AWL), Modul `PIKETT` und alle `session.pikett`-Zweige in `dev/src/app.js` (u. a. `compile()`, `onSuccess()`, `registerFail()`, Menü-/Titel-Einstieg, Tour, Hotkeys), Pikett-CSS in `dev/src/styles_new.css`.
- Portal: `dev/portal/portal_pikett.js` + Einbindung in `portal.js`/Build, Einstieg auf der Startseite, Pikett-Tafel im Leitstand, Pikett-Abschnitte in `portal_anleitung.js`.
- Live-Challenge: Modus `pikett` in `dev/portal/portal_live.js` (`MODE`, Formular, Beamer-Texte) und `worker/challenge.js` (`MODES`, Validierung). Bestehende Challenges mit Modus `pikett` in D1 dürfen keine Ansicht crashen (als „Modus entfernt“ anzeigen).
- Worker: `worker/pikett.js`, Routen in `worker/index.js`, `worker/gen/pikett_data.js`, Pikett-Teil in `dev/build.js` (`PIKETT_DATA`, `SPSQPikett`, `pikett_core.js` im Exam-Bundle, `export const Pikett`).
- Zertifikat: `pikettOf` + Anzeige in `worker/cert.js` und `dev/portal/portal_zertifikate.js` (Zeile „Pikettbereit“ auf Zertifikat, Prüfseite, PNG/PDF).
- Tests/Validatoren: `dev/validate_pikett.js`, `dev/test_pikett_worker.js`, `dev/tests/pikett_ui.js`, `pikett_api.js`, `pikett_portal.js`; Pikett-Fälle in anderen Tests entfernen.
- Doku: `docs/PIKETT_KONZEPT.md` löschen; `CLAUDE.md`, `STAND.md`, `ENTSCHEIDUNGEN.md`, `PLAN_ZERTIFIKAT_PIKETT.md`, `ZERTIFIKAT_KONZEPT.md` bereinigen (Vermerk „Pikett am 29.09.2026 entfernt“).

Behalten:
- `force` in `engine.js` / `engine_pro.js` / `awl.js` (generisch, getestet).
- Handbuchseite „Fehlersuche im Betrieb“ in allen vier Quests: Inhalt zur Fehlersuche behalten, Pikett-Bezüge (Schicht, Punkte, Rang, Pikettchef) streichen, Titel „Fehlersuche im Betrieb“.
- D1-Tabellen `pikett_shifts`, `pikett_ranks` (Migration 7) **nicht löschen**, kein DROP. Migration bleibt, Code nutzt die Tabellen nicht mehr.
- Alte Spielstände mit Pikett-Feldern müssen weiter laden.

Fertig, wenn: `grep -ri pikett` findet nur noch Migration 7, Entfernen-Vermerke und Abwärtskompatibilität; Build, alle Validatoren, Engine-/Profi-/AWL-Tests, `tests/api.js`, `portal.js`, `live.js`, `exam_*`, Durchläufe SCL/KOP/FUP/AWL grün; Browser ohne JS-Fehler.

## Paket 1 – vor dem nächsten Klassentest

1. **Fehler Sensorwerkstatt:** `dev/src/sensor_game.js` (ca. Z. 73) ruft `Engineering.mount()` ohne `editor` auf → KOP/FUP sind nur Textfeld + Vorschau, keine Bausteine zum Ziehen. Grafischen Editor aus `kop_editor.js` einhängen (Palette, Ziehen, Variablen aus der PLC-Variablentabelle). Test in `tests/sensor_engineering_ui.js`: FUP wählen → Box ziehen → übersetzen → laden.
2. **Ein-Bildschirm-Layout (alle Quests):** 1366×768 und 1920×1080 ohne Scrollen. Auftragskarte kompakt oben links (Titel, Auftrag als Checkliste, Story einklappbar, Lernziel in „ⓘ“), Anlage darunter immer sichtbar, Editor rechts mit festen Knöpfen, Testbericht neben/über der Anlage statt unter dem Editor (Anlage und Ergebnis gleichzeitig sichtbar), Funk als kleine Einblendung.
3. **Textdiät:** Story max. 2 Sätze, Auftrag max. 3 Zeilen und zuoberst; Validator-Warnung bei zu langem `story`/`brief`.

## Paket 2 – Live-Challenge und Beamer

1. **„Sprint“ heisst „Speedrun“** in der ganzen Anzeige (Portal, Beamer, Spiel, Anleitungen, Handbuch). Interne ID `sprint` bleibt.
2. **Beamer füllen** (`portal_live.js`, `render`): Lobby mit Bild der Anlage, Auftrag, Code, Avataren der Beigetretenen; laufend: Bild der Anlage + Auftrag (bzw. Störungsmeldung), grosse Uhr + Fortschrittsbalken (letzte 60 s rot), Rangliste mit **animierten Avataren** (leichte Idle-Animation, Sprung/Jubel beim Lösen), Ereignis-Ticker unten („Noel hat Aufgabe 2 gelöst“). Nur Pseudonyme. Avatare kommen aus Paket 3 – bis dahin Platzhalter.
3. **Speedrun stapelbar:** Dozent wählt 2–10 Aufgaben einzeln **oder** „Kapitel N, k zufällige“ (aus den Kernaufgaben). Worker-Feld `tasks` statt `taskId` (rückwärtskompatibel), Fortschritt je Aufgabe, Rangliste nach gelösten Aufgaben, dann Zeit; Beamer zeigt Fortschritt je Person (●●●○○).
4. **Musik:** Klänge und Stücke aus `docs/Hoerprobe_Musik.html` (Industrie-Version) als Modul übernehmen – WebAudio, keine Dateien, keine Lizenzen: Lobby-Loop, Challenge-Loop mit „letzte Minute“ (152 BPM, Warnsignal, Servo), Siegerehrung (Fabrikpfeife, Fanfare, Amboss), Effekte Beitritt / Gelöst / 3-2-1-Los / Zeit abgelaufen. Nur am Beamer, standardmässig an; Lautstärke- und Aus-Knopf. Bei Lernenden keine Musik. Start über den Klick „Challenge starten“ (Autoplay-Regel der Browser).

## Paket 3 – Avatare und Coins

- **Avatare sind Tiere** (z. B. Fuchs, Bär, Eule, Wolf, Pinguin, Biber, Steinbock, Katze – eigene Zeichnungen als SVG-Ebenen, keine bekannten Figuren/Marken). Profil: Tier wählen, Farbe.
- **Accessoires klassisch:** Kappen, Brillen, Ketten, T-Shirts und Hemden (je mehrere Farben/Motive); einige nur über Abzeichen freischaltbar (z. B. goldene Kette für den Final Boss).
- **Animation:** Im Challenge-Modus (Lobby, Rangliste, Podest) leicht animiert – Atmen/Wippen, Blinzeln, Jubelsprung beim Lösen, Tanz auf dem Podest. CSS-/SVG-Animation, `prefers-reduced-motion` beachten. Ausserhalb der Challenge statisch.
- Coins verdienen: gelöste Aufgaben (nach Sternen), Kapitel-Boss, Theorie, Speedrun-Platzierung. **Nur verdienbar, nie mit Geld kaufbar, rein kosmetisch** (kein Spielvorteil).
- Avatar **überall statt nur Pseudonym**: Portal-Kopf, Klassenliste im Leitstand, Lobby, Rangliste und **Podest der Siegerehrung**.
- Worker: Tabellen `avatars`, `coin_ledger`; Coins serverseitig aus dem synchronisierten Fortschritt; Kauf-API; Datenschutz-Vorlage ergänzen.

## Paket 4 – Spiel: Tempo und Bedienung

1. **Kernpfad:** pro Kapitel ca. 5 Pflichtaufgaben (`core:true`), Rest „Training“ (freiwillig). IDs nicht löschen (Störungsjagd, Prüfungspool, Spielstände). **Schnellspur:** erster Versuch ohne Hinweis → nächste gleichartige überspringbar.
2. **Knopf „▶ Anlage testen“:** Probebetrieb wie PLCSIM (zyklisch, Eingänge in Szene/Beobachtungstabelle anklickbar, zählt nicht als Fehlversuch), getrennt von „✓ Prüfen“. `createRuntime` aus der Sensorwerkstatt wiederverwenden.
3. **Sensorwerkstatt geführt:** Arbeitsschritte als Leiste über der 3D-Ansicht, immer ein Schritt aktiv, „Zeig mir“ (Kamera zum Bauteil, Werkzeug hervorheben), Modul 1 als Mitmach-Tutorial, Typenschild als Bild.

## Paket 5 – grössere Umbauten

1. **FUP-Editor nach TIA-Vorbild** (auch KOP/Sensor): Anweisungs-Palette mit Ordnern + Favoritenleiste, leere Box ins Netzwerk ziehen → Platzhalter `<??.?>`, Operand direkt in der Box eintippen mit Autovervollständigung, Variable auf Platzhalter ziehen, „*“ = Eingang hinzufügen, Klick auf Anschluss = negieren, Rechtsklick-Menü. Netzwerkmodell `kop.js` bleibt.
2. **Variablentabelle statt Namen im Auftrag (alle vier Quests):**
   - Die **ersten zwei Aufgaben** (Kapitel 1) bleiben wie heute mit Variablennamen im Auftrag.
   - **Ab Aufgabe 3** beschreibt der Auftrag die Funktion in Anlagensprache, ohne Variablennamen („Öffne den Greifer, damit das Teil abgelegt wird“).
   - Über dem Programmierfenster steht ein **Fenster „PLC-Variablen“** wie im TIA Portal: Name · Adresse · Datentyp · Kommentar, z. B. `Greifer_Auf | %Q0.2 | Bool | Greifer öffnen`. Klick auf einen Namen fügt ihn ein (wie heute). Die Lernenden suchen selbst, welche Variable zur Beschreibung passt → Programmier-Feeling.
   - Dafür braucht jede Variable jeder Aufgabe eine Adresse (%I/%Q/%M/%MW …) und einen Kommentar: pro Anlage eine feste E/A-Belegung festlegen, damit dieselbe Variable in allen Aufgaben dieselbe Adresse hat. Validator prüft: Adresse + Typ + Kommentar vorhanden, keine Doppelbelegung, Auftrag ab Aufgabe 3 enthält keine Variablennamen.
   - Gilt für SCL, KOP, FUP und AWL (Profi-Stufe: Schnittstelle der Bausteine bleibt, PLC-Variablen wie oben).

## Bestätigte Entscheidungen (Steven, 29.09.2026)

| Thema | Entscheid |
|---|---|
| Weniger Aufgaben | Kernpfad (ca. 5 Pflicht pro Kapitel) + Rest als freiwilliges Training, nichts löschen; Schnellspur dazu |
| Schwieriger / Programmier-Feeling | Ab Aufgabe 3 Auftrag ohne Variablennamen, Fenster „PLC-Variablen“ (Name, Adresse, Typ, Kommentar) über dem Editor – alle vier Quests |
| Layout | Links Auftrag kompakt + Anlage immer sichtbar, rechts Editor, Testbericht neben der Anlage, ohne Scrollen |
| Anlage testen | Probebetrieb wie PLCSIM, getrennt von „Prüfen“, zählt nicht als Fehlversuch |
| FUP | TIA-Bedienung nachbauen |
| Sensorwerkstatt | Schritt für Schritt + „Zeig mir“, Modul 1 als Tutorial; Editor-Fehler beheben |
| Avatare | Tiere, Accessoires Kappen/Brillen/Ketten/T-Shirts/Hemden, im Challenge-Modus leicht animiert, überall statt nur Pseudonym |
| Coins | nur verdienbar, nie mit Geld, rein kosmetisch, einige Gadgets nur über Abzeichen |
| Beamer | Anlage + Auftrag, grosse Uhr + Balken, Rangliste mit animierten Avataren, Ereignis-Ticker |
| Speedrun | neuer Name für Sprint; stapelbar, Aufgaben einzeln oder „Kapitel N, k zufällige“ |
| Musik | Industrie-Version aus der Hörprobe, nur am Beamer |
| Pikett | ganz entfernen (Handbuch „Fehlersuche im Betrieb“ und DB-Tabellen bleiben) |

## Messung für Klassentest 2
Zeit bis zur ersten Eingabe, Abbruch je Aufgabe, Aufgaben pro Lektion, Verweildauer Sensorwerkstatt; Feedback-Frage „Wusstest du sofort, was zu tun ist? (ja/eher/nein)“.
