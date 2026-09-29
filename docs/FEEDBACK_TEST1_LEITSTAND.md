# Feedback Klassentest 1 – Leitstand, Live-Challenge, Pikett, Avatare (29.09.2026)

> **Überholt in Teilen (29.09.2026, später am Tag):** Punkt **A (Pikett reparieren)** und alle Pikett-Bezüge sind ersetzt durch den Entscheid „Pikett ganz entfernen“ (`AUFTRAG_FEEDBACK1.md`, Paket 0). Punkt **E (Avatare)**: massgeblich ist `AUFTRAG_FEEDBACK1.md`, Paket 3 (Tiere mit Kappen, Brillen, Ketten, T-Shirts/Hemden; im Challenge-Modus animiert; keine Hüte/Gesichter-Liste). Punkte B, C, D gelten unverändert.

Ergänzung zu `konzept/FEEDBACK_TEST1.md` (Spiel, Layout, FUP, Sensorwerkstatt).

## 1. Rückmeldungen

1. Live-Bildschirm des Dozenten (Beamer) mit Infos und Bild füllen.
2. Avatare im Profil; Coins kaufen Gadgets (Hüte, Brillen, Gesichter).
3. Avatare bei der Siegerehrung.
4. Mehrere Challenges im Sprint hintereinander (stapelbar); Musik.
5. Pikett lösen ist frustrierend: unklar, was verlangt wird, keine Navigation, Code abschicken funktioniert nicht.
6. **Entscheid: „Sprint“ heisst künftig „Speedrun“.**

## 2. Befund im Code

- **Beamer** (`dev/portal/portal_live.js`, `render`): Während der Challenge nur Restzeit, „x/y gelöst“, Balken und Ranglistentabelle. Kein Bild der Anlage, kein Auftragstext, keine Ereignisse. Lobby: Code + Namen als Textchips.
- **Coins/Avatare:** gibt es noch nicht (nur Punkte und Abzeichen im Spielstand).
- **Musik:** nur Soundeffekte (`SFX`), keine Musik.
- **Speedrun:** Modus-ID `sprint` im Worker (`worker/challenge.js`, `MODES`) und im Portal (`MODE`). Challenge hat genau eine `taskId`.
- **Pikett** (`dev/src/app.js`, Modul `PIKETT`):
  - Der Testknopf heisst im Pikett „Wieder anfahren“. `restart()` verlangt zuerst eine Diagnose. Ohne Diagnose öffnet sich ein Dialog mit Ursachenliste (Programm/Hardware/Bedienung) – aus Sicht der Lernenden „passiert nichts“ mit dem Code.
  - Diagnose ≠ Programmfehler bei einem Programmfehler → `failed()` ohne den Code zu prüfen, Meldung nur „bleibt erneut stehen“. → „Abschicken funktioniert nicht“.
  - Im Normalbetrieb (`production()`) ist der Knopf deaktiviert, ohne Erklärung.
  - Die Pikett-Leiste ersetzt die Navigation; raus geht es nur über „Schicht beenden“. Kein Menü, keine Handbuch-/Theorie-Links, keine Anleitung beim ersten Mal.

## 3. Massnahmen

### A. ~~Pikett reparieren~~ → ersetzt: Pikett wird entfernt
1. **Klarer Ablauf in 3 Schritten**, sichtbar als Stepper in der Pikett-Leiste: ① Beobachten (Anlage zeigt die Störung) → ② Diagnose (Programm / Hardware / Bedienung) → ③ Beheben & wieder anfahren. Aktiver Schritt hervorgehoben, Knopf passend beschriftet („Diagnose stellen“, dann „Code laden & wieder anfahren“).
2. **Code wird immer geprüft**, wenn er geändert wurde. Falsche Ursachenkategorie gibt Punkteabzug, blockiert aber nicht; Rückmeldung konkret („Dein Code läuft, aber die Diagnose war ‚Hardware‘ – es war ein Programmfehler“).
3. Jeder Fehlversuch zeigt den Testbericht wie im normalen Spiel.
4. Normalbetrieb: Hinweis „Warte auf eine Störung – nächste Meldung in ca. X s“ statt stummem, deaktiviertem Knopf.
5. **Navigation:** Menü/Zurück bleibt erreichbar (Schicht pausieren oder abbrechen mit Rückfrage), Handbuch und Theorie offen, Hilfe-Knopf „Was muss ich tun?“.
6. **Einstieg:** Erste Schicht = Übungsschicht mit einer einzigen, geführten Störung (Tour über Alarm → Beobachten → Diagnose → Beheben). Erst danach echte Schichten.
7. Tests: `tests/pikett_ui.js` um „Programmfehler mit falscher Diagnose“, „Code geändert und abgeschickt“ und „Navigation während der Schicht“ erweitern.

### B. Beamer füllen
- **Lobby:** grosses Bild der Anlage (Szene als Standbild), Auftrag in 1–2 Sätzen, Beitrittscode, Avatare der Beigetretenen (poppen beim Beitritt auf), Musik im Warteloop.
- **Laufend:** links Anlage/Szene mit Auftrag (bei Störungsjagd die Störungsmeldung), Mitte grosse Uhr + Fortschrittsbalken, rechts Rangliste mit Avataren. Unten ein **Ereignis-Ticker** („🐺 Noel hat Aufgabe 2 gelöst“, „Eliah: erster Versuch ✓“). Letzte 60 s: Uhr rot, Musik schneller.
- **Siegerehrung:** Podest mit Avataren (inkl. Gadgets), Konfetti, Fanfare, danach Lösung anonym besprechen wie bisher.
- Alles in Pseudonymen; keine Codes am Beamer ausser anonym.

### C. Speedrun (Umbenennung + stapelbar)
- Anzeige überall „Speedrun“ (Portal, Beamer, Spiel, Anleitungen, Handbuch). Interne ID `sprint` bleibt (Datenbank, alte Challenges).
- **Stapel:** Dozent wählt 2–10 Aufgaben als Playlist (oder „Kapitel 3, 5 zufällige“). Lernende lösen sie der Reihe nach; Punkte summieren sich, Rangliste nach Anzahl gelöster Aufgaben, dann Zeit. Beamer zeigt pro Person den Fortschritt (●●●○○).
- Worker: Feld `tasks` (Liste) statt nur `taskId`, Fortschritt pro Aufgabe; Migration mit Rückwärtskompatibilität (`taskId` = Liste mit einem Element).

### D. Musik
- Eigene Musik prozedural mit WebAudio erzeugt (kein Lizenzproblem, offline): Lobby-Loop, Challenge-Loop (Tempo steigt in der letzten Minute), Fanfare Siegerehrung.
- Nur am Beamer standardmässig an, bei Lernenden aus (Klassenzimmer!). Lautstärke/Aus-Knopf.

### E. Avatare und Coins
- **Avatar-Editor im Profil:** Grundfigur (Kopfform, Hautton, Haare, Farben) als SVG-Ebenen, eigene Zeichnungen (keine bekannten Figuren/Marken).
- **Coins verdienen:** gelöste Aufgabe (nach Sternen), Kapitel-Boss, Theorie, Speedrun-Platzierung. Nur verdienbar, **nicht mit Geld kaufbar**, rein kosmetisch (kein Vorteil im Spiel).
- **Shop:** Hüte (Schutzhelm, Techniker-Cap, Krone für Final Boss), Brillen (Schutzbrille, Sonnenbrille), Gesichter/Ausdrücke, Rahmen; einige nur über Abzeichen freischaltbar (z. B. Helm „Pikettchef“).
- Avatar erscheint in Portal-Kopf, Leitstand-Klassenliste, Live-Lobby, Rangliste, Podest.
- Technik: Worker-Tabelle `avatars` (user_id, config JSON) und `coin_ledger` (user_id, grund, betrag, zeit), Coins serverseitig aus dem synchronisierten Fortschritt berechnet; Kauf über API. Datenschutz-Vorlage ergänzen (Avatar = pseudonym, keine Fotos).

## 4. Reihenfolge

1. ~~A Pikett reparieren~~ → Pikett entfernen (Paket 0 im Auftrag).
2. C Umbenennung Speedrun (klein) + B Beamer füllen.
3. E Avatare/Coins (inkl. Avatare auf Podest und Beamer).
4. C stapelbarer Speedrun + D Musik.

Zusammen mit `FEEDBACK_TEST1.md`, Paket 1 (Sensor-Editor-Fehler, Ein-Bildschirm-Layout, Textdiät) vor dem nächsten Klassentest.
