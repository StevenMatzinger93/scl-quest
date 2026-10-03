# SPS Quest – Entscheidungen (Stand 29.09.2026)

> Nachträge vom 28. und 29.09.2026 stehen direkt unter diesem Kopf und sind aus dem Zweig `sicherung-docs` übernommen (Pfade auf `docs/` angepasst, sonstiger Inhalt unverändert). Massgeblich für die Umsetzung: `docs/AUFTRAG_FEEDBACK1.md`, `docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md`, `docs/AUFTRAG_FABLE_VISUALISIERUNG.md`.

## Nach Klassentest 1 (29.09.2026)
- Live-Modus **„Sprint“ heisst künftig „Speedrun“** (nur Anzeige; interne ID `sprint` bleibt). Speedrun wird stapelbar (mehrere Aufgaben hintereinander).
- Avatare mit Coins und kosmetischen Gadgets; Coins nur verdienbar, nicht mit Geld kaufbar, kein Spielvorteil.
- Beamer-Ansicht mit Bild der Anlage, Auftrag, Ereignis-Ticker, Avataren und Musik.
- **Pikettdienst wird ganz entfernt** (nicht überarbeitet). Handbuchseite „Fehlersuche im Betrieb“ und D1-Tabellen (Migration 7) bleiben. Auch „Pikettbereit“ auf dem Zertifikat entfällt.
- Avatare sind **Tiere** mit Accessoires (Kappen, Brillen, Ketten, T-Shirts/Hemden), im Challenge-Modus animiert.
- Live-Musik: Industrie-Version, nur am Beamer.
- Weitere Entscheide: Kernpfad (ca. 5 Pflichtaufgaben je Kapitel, Rest Training), Probebetrieb „▶ Anlage testen“, Fenster „PLC-Variablen“, Auftrag ab Aufgabe 3 ohne Variablennamen, FUP-Editor nach TIA-Vorbild. Details: `docs/AUFTRAG_FEEDBACK1.md`.
- Massnahmen: `docs/AUFTRAG_FEEDBACK1.md` (massgeblich), Herleitung in `docs/FEEDBACK_TEST1.md` und `docs/FEEDBACK_TEST1_LEITSTAND.md` (dort ist der Pikett-Teil überholt).
- Sensorwerkstatt-Umbau (30 Aufgaben, Verdrahten in 2.5D, 3D nur zum Ansehen, SCL und FUP): `docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md`, Visualisierung an Fable 5.1: `docs/AUFTRAG_FABLE_VISUALISIERUNG.md`.

## Dachmarke Bühler Quest (28.09.2026)
- SPS Quest bleibt ein **eigenständiges** Produkt. Später entsteht die Dachmarke **Bühler Quest**; SPS Quest ist ein Teil davon und funktioniert unabhängig.
- Nächstes eigenständiges Produkt: **Digital Quest** (Elektro-/Digitaltechnik), eigenes Repo, eigener technischer Aufbau erlaubt.
- Jede Quest hat eigene Klassen und Konten. **Später (nicht jetzt bauen):** Personen questübergreifend verknüpfen – bei gleichem Namen Rückfrage „Gleiche Person?“ + Knopf „Verknüpfen“, für questübergreifende Auswertung.
- Schon jetzt beachten: UUID als Personen-ID, Vor-/Nachname getrennt, Lernereignisse mit Zeitstempel, Kompetenz-Tags an Aufgaben, stabile Export-Schnittstelle. Details: `docs/BAUPLAN_LERNSPIEL.md`, Abschnitt 8.

## Produkt „SPS Quest“
- Reihe aus vier Spielen: SCL Quest (vorhanden, v5.1), KOP Quest, FUP Quest, AWL Quest.
- Gleicher Stil und gleiche Bedienung, je eigene Maschine und passende Simulation.
- Je 15 Kapitel (10 Grundstufe + 5 Profi-Stufe), 150 Aufgaben, 30 Theorien – analog zu SCL Quest.
- Eine Welt, verschiedene Hallen: ARIA und der Werkmeister begleiten alle Quests.
- Maschinen:
  - SCL: Roboterzelle mit 2 Bändern (vorhanden)
  - KOP: Seilbahn-Station – Kabinen, Türen, Not-Halt, Windabschaltung, Sicherheitskette. Netzwerk-Editor (Kontakte/Spulen verbinden), Stromfluss live eingefärbt.
  - FUP: Bahn-Stellwerk – Weichen, Signale, Bahnübergang, Fahrstrassen-Verriegelung. Baustein-Editor (ziehen + verbinden), Signalzustände farbig.
  - AWL: Altes Walzwerk im Keller – ARIA entdeckt eine alte S7-300. Akku-Rechnen, Sprünge, Status-Ansicht VKE/AKKU je Zeile. Hinweis im Spiel: AWL läuft nicht auf S7-1200.
- Lehrpläne der neuen Quests: Claude leitet sie analog zu SCL ab, schreibt das Konzept nach docs/ und arbeitet ohne Freigabe weiter.
- TIA-Export entfällt in allen Quests; aus SCL Quest ausbauen (Engine-Export, Export-Knopf, Handbuchseite, Abzeichen, Aufgaben/Validator-Prüfung anpassen).
- Tagesziel gestrichen.

## Reihenfolge
1. TIA-Export aus SCL Quest entfernen
2. Plattform: Portal, Login, Klassen, Dashboards
3. Live-Challenge im Klassenzimmer (siehe unten)
4. Testplan + Feedback-Formular für Stevens Klasse (inkl. Test der Live-Challenge)
5. KOP Quest → FUP Quest → AWL Quest (Live-Challenge jeweils mit einbauen)

## Portal
- Ein Portal für alle 4 Quests mit spektakulärer Titel- und Navigationsseite inkl. Login.
- Look: filmisch-dunkle Fabrikhalle, vier leuchtende Tore (SCL/KOP/FUP/AWL), ARIA-Intro, Login als Leitstand-Terminal.
- Impressum + Datenschutzerklärung als Vorlage mit markierten Platzhaltern.

## Highlight-Feature: Live-Challenge im Klassenzimmer
- Dozent startet im Dashboard eine Challenge und erhält einen 4-stelligen Beitrittscode; Schüler treten mit ihrem Konto bei.
- Beamer-Ansicht (Vollbild, dunkler Leitstand-Look): Anlage der Aufgabe, Countdown, Live-Rangliste (Pseudonyme), wer gelöst hat, wie viele Versuche/Tipps.
- Zwei Modi:
  - Sprint: alle lösen dieselbe Aufgabe, Punkte nach Zeit, Versuchen und Tipps.
  - Störungsjagd: eine laufende Anlage hat einen eingebauten Fehler im Programm (Bug), die Klasse findet und behebt ihn. Übt echte Fehlersuche wie im Betrieb.
- Ende: Siegerehrung mit Podest; Dozent kann eine Lösung anonym am Beamer zeigen und besprechen (Lösungsvergleich wiederverwenden).
- Technik: Cloudflare Worker + D1, Aktualisierung per Polling alle 2–3 s (bleibt im Gratis-Tarif, keine Durable Objects nötig).
- Aufgaben: vorhandene Aufgaben nutzbar; für Störungsjagd pro Kapitel mind. 2 Fehlerszenarien anlegen (Validator prüft: Referenz besteht, Fehlerversion scheitert).

## Konten & Daten
- Benutzername + Passwort, keine E-Mail. Rollen: Admin / Dozent / Schüler.
- Nur der Admin legt Dozenten an. Schüler: vom Dozenten erzeugt oder Selbstanmeldung per Klassencode.
- Dozent sieht Fortschritt und Code der eigenen Klasse (Schüler werden einmal darauf hingewiesen).
- Passwort-Reset durch den Dozenten. Nur Pseudonyme, keine echten Namen (Lernende ab ca. 15).
- Lokaler Spielstand wird beim ersten Login auf Nachfrage ins Konto übernommen.
- Hosting: Cloudflare Workers mit Static Assets, verbunden mit GitHub (Workers Builds). Konfiguration in `wrangler.jsonc` im Repo-Root (Assets aus `web/`), Deploy-Befehl `npx wrangler deploy`, Preview-Builds pro Nebenzweig aktiv. API-Code kommt als `main` in denselben Worker (z. B. `run_worker_first` für `/api/*`). Datenbank D1 `spsquest`, Binding `DB` in `wrangler.jsonc` (database_id eintragen), Standort EU.
- Tabellen legt der Code selbst an (CREATE TABLE IF NOT EXISTS / Migrationstabelle).
- Feedback/Fehlermeldungen jederzeit über einen Knopf in Portal und allen Quests, auch ohne Login; eigene Tabelle `feedback_reports` (die Umfrage `feedback` bleibt anonym). Auswertung für Admin (alles) und Dozent (eigene Lernende).
- Ein Admin-Konto darf zugleich Dozent sein (Klassen im Leitstand). Keine Passwörter oder Namen in Code/Doku: Seed-Daten nur aus einer lokalen, nicht eingecheckten Datei (`dev/seed.local.json`).
- Admin-Konto aus den Worker-Secrets `ADMIN_USER` / `ADMIN_PASSWORD`. Passwörter nur gehasht (PBKDF2 via WebCrypto), Rate-Limit bei Fehlversuchen.

## Geschäftsmodell
- Vorerst alles gratis. Später: jede Quest einzeln + günstigeres Paket.
- Nur kostenlose Dienste; alles Kostenpflichtige vorher Steven vorlegen.

## Bewertung: „Funktion zählt“ (Steven, 03.10.2026)

- Bewertet wird überall (Spiel, Live-Challenge, Störungsjagd, Prüfung) nur das Verhalten der Ausgänge, die die Aufgabe nennt – nicht der Weg. Eine &-Box mit 3 Eingängen und zwei &-Boxen sind gleich richtig.
- Pflicht-Bausteine (`must`) und Programmierstandard-Warnungen (`warnFree`) sind nur noch Lernhinweise nach dem Lösen, ohne Abzug. Pflicht bleibt, was zur Funktion gehört: Name und Schnittstelle eines Bausteins, den die Aufgabe aufruft.
- Geprüft wird mit den Hand-Tests plus aus der Musterlösung erzeugten Tests (`equiv.js`); die Fehlermeldung nennt ein Gegenbeispiel. Jede Grundstufen-Aufgabe hat freie Hilfsmerker. Zusätzliche, nicht geprüfte Ausgänge sind erlaubt.
- Die Lehrperson sieht im Leitstand den gewählten Weg. Sterne bleiben wie bisher (Fehlversuche, Tipps). Tipp 3 ist ein Lösungsvorschlag (Gerüst der Musterlösung mit Lücken).

## Arbeitsweise
- Arbeiten auf Nebenzweigen (Vorschau-Adresse). Übernahme nach main selbständig, wenn alle Tests grün sind.
- „Fertig“ heisst: Validator 0 Fehler, Browser-Durchlauf aller Aufgaben ohne JS-Fehler, Handy-Ansicht ok, offline spielbar.
- Nach jedem Abschnitt docs/STAND.md aktualisieren (was fertig ist, was als Nächstes kommt), damit eine neue Sitzung nahtlos weitermacht.
- Sprache im Spiel: Deutsch (Schweizer Schreibweise, ss statt ß).
- Nicht selbst erledigbar: Konten anlegen, Bedingungen akzeptieren, Praxistest in der Klasse, rechtliche Prüfung.

## Nächste Ausbaustufen (Stand 27.09.2026)
Verbindlich wie diese Datei: `docs/PLAN_ZERTIFIKAT_PIKETT.md` und `docs/SENSORWERKSTATT_PLAN.md`. Reihenfolge:
1. Paket 0 – Sicherheit (PLAN_ZERTIFIKAT_PIKETT.md)
2. Teil A – Zertifikat mit Prüfung (A1–A9)
3. Sensorwerkstatt S0–S10
4. ~~Teil B – Pikettdienst (B1–B8); Hardware-Fehler über `sensor_model.js`~~ (entfernt am 29.09.2026, siehe „Nach Klassentest 1“)
5. Später: Zertifikat „Sensorik“
- Rückfragen nur bei Kosten (z. B. falls Spike A2 Workers Paid verlangt) oder fehlenden Entscheidungen. Fachliche Unsicherheiten (Sonderwerte, Klemmenbezeichnungen) nicht erfragen, sondern recherchieren, markieren und in `docs/SENSORWERKSTATT_FAKTEN.md` mit Quellen festhalten.
