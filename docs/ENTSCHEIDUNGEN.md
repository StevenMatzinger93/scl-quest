# SPS Quest – Entscheidungen (Stand 26.09.2026)

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
- Technik: Cloudflare Pages Functions + D1, Aktualisierung per Polling alle 2–3 s (bleibt im Gratis-Tarif, keine Durable Objects nötig).
- Aufgaben: vorhandene Aufgaben nutzbar; für Störungsjagd pro Kapitel mind. 2 Fehlerszenarien anlegen (Validator prüft: Referenz besteht, Fehlerversion scheitert).

## Konten & Daten
- Benutzername + Passwort, keine E-Mail. Rollen: Admin / Dozent / Schüler.
- Nur der Admin legt Dozenten an. Schüler: vom Dozenten erzeugt oder Selbstanmeldung per Klassencode.
- Dozent sieht Fortschritt und Code der eigenen Klasse (Schüler werden einmal darauf hingewiesen).
- Passwort-Reset durch den Dozenten. Nur Pseudonyme, keine echten Namen (Lernende ab ca. 15).
- Lokaler Spielstand wird beim ersten Login auf Nachfrage ins Konto übernommen.
- Hosting: Cloudflare Pages (Git-Integration, Ausgabe `web`), Pages Functions, Datenbank D1 `spsquest`, Binding `DB`, Standort EU.
- Tabellen legt der Code selbst an (CREATE TABLE IF NOT EXISTS / Migrationstabelle).
- Admin-Konto aus den Pages-Secrets `ADMIN_USER` / `ADMIN_PASSWORD`. Passwörter nur gehasht (PBKDF2 via WebCrypto), Rate-Limit bei Fehlversuchen.

## Geschäftsmodell
- Vorerst alles gratis. Später: jede Quest einzeln + günstigeres Paket.
- Nur kostenlose Dienste; alles Kostenpflichtige vorher Steven vorlegen.

## Arbeitsweise
- Arbeiten auf Nebenzweigen (Vorschau-Adresse). Übernahme nach main selbständig, wenn alle Tests grün sind.
- „Fertig“ heisst: Validator 0 Fehler, Browser-Durchlauf aller Aufgaben ohne JS-Fehler, Handy-Ansicht ok, offline spielbar.
- Nach jedem Abschnitt docs/STAND.md aktualisieren (was fertig ist, was als Nächstes kommt), damit eine neue Sitzung nahtlos weitermacht.
- Sprache im Spiel: Deutsch (Schweizer Schreibweise, ss statt ß).
- Nicht selbst erledigbar: Konten anlegen, Bedingungen akzeptieren, Praxistest in der Klasse, rechtliche Prüfung.
