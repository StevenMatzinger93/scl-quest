# SPS Quest – Entscheidungen (Stand 29.09.2026)

Diese Datei ist eine Kopie von `docs/ENTSCHEIDUNGEN.md` im GitHub-Repo StevenMatzinger93/scl-quest. Massgeblich ist die Version im Repo. **Nachträge vom 28.09.2026 (Dachmarke Bühler Quest) und 29.09.2026 (Nach Klassentest 1) sind hier enthalten und müssen noch nach `docs/ENTSCHEIDUNGEN.md` im Repo übernommen werden.**

## Nach Klassentest 1 (29.09.2026)
- Live-Modus **„Sprint“ heisst künftig „Speedrun“** (nur Anzeige; interne ID `sprint` bleibt). Speedrun wird stapelbar (mehrere Aufgaben hintereinander).
- Avatare mit Coins und kosmetischen Gadgets (Hüte, Brillen, Gesichter); Coins nur verdienbar, nicht mit Geld kaufbar, kein Spielvorteil.
- Beamer-Ansicht mit Bild der Anlage, Auftrag, Ereignis-Ticker, Avataren und Musik.
- **Pikettdienst wird ganz entfernt** (nicht überarbeitet). Handbuchseite „Fehlersuche im Betrieb“ und D1-Tabellen (Migration 7) bleiben. Auch „Pikettbereit“ auf dem Zertifikat entfällt.
- Avatare sind **Tiere** mit Accessoires (Kappen, Brillen, Ketten, T-Shirts/Hemden), im Challenge-Modus animiert.
- Live-Musik: Industrie-Version, nur am Beamer.
- Weitere Entscheide: Kernpfad (ca. 5 Pflichtaufgaben je Kapitel, Rest Training), Probebetrieb „▶ Anlage testen“, Fenster „PLC-Variablen“, Auftrag ab Aufgabe 3 ohne Variablennamen, FUP-Editor nach TIA-Vorbild. Details: `konzept/AUFTRAG_FEEDBACK1.md`.
- Massnahmen: `konzept/AUFTRAG_FEEDBACK1.md` (massgeblich), Herleitung in `konzept/FEEDBACK_TEST1.md` und `konzept/FEEDBACK_TEST1_LEITSTAND.md` (dort ist der Pikett-Teil überholt).

## Dachmarke Bühler Quest (28.09.2026)
- SPS Quest bleibt ein **eigenständiges** Produkt. Später entsteht die Dachmarke **Bühler Quest**; SPS Quest ist ein Teil davon und funktioniert unabhängig.
- Nächstes eigenständiges Produkt: **Digital Quest** (Elektro-/Digitaltechnik), eigenes Repo, eigener technischer Aufbau erlaubt.
- Jede Quest hat eigene Klassen und Konten. **Später (nicht jetzt bauen):** Personen questübergreifend verknüpfen – bei gleichem Namen Rückfrage „Gleiche Person?“ + Knopf „Verknüpfen“, für questübergreifende Auswertung.
- Schon jetzt beachten: UUID als Personen-ID, Vor-/Nachname getrennt, Lernereignisse mit Zeitstempel, Kompetenz-Tags an Aufgaben, stabile Export-Schnittstelle. Details: `konzept/BAUPLAN_LERNSPIEL.md`, Abschnitt 8.

## Produkt „SPS Quest“
- Reihe aus vier Spielen: SCL Quest (vorhanden, v5.1), KOP Quest, FUP Quest, AWL Quest.
- Gleicher Stil und gleiche Bedienung, je eigene Maschine und passende Simulation.
- Je 15 Kapitel (10 Grundstufe + 5 Profi-Stufe), 150 Aufgaben, 30 Theorien.
- Eine Welt, verschiedene Hallen: ARIA und der Werkmeister begleiten alle Quests.
- Maschinen: SCL Roboterzelle (vorhanden); KOP Seilbahn-Station; FUP Bahn-Stellwerk; AWL altes Walzwerk im Keller (Hinweis: AWL nicht auf S7-1200).
- Lehrpläne der neuen Quests leitet Claude analog zu SCL ab, ohne Freigabe.
- TIA-Export entfällt überall; aus SCL Quest ausbauen. Tagesziel gestrichen.

## Reihenfolge
1. TIA-Export aus SCL Quest entfernen
2. Plattform: Portal, Login, Klassen, Dashboards
3. Live-Challenge im Klassenzimmer
4. Testplan + Feedback-Formular für Stevens Klasse
5. KOP Quest → FUP Quest → AWL Quest

## Portal
- Ein Portal für alle 4 Quests; filmisch-dunkle Fabrikhalle, vier leuchtende Tore, ARIA-Intro, Login als Leitstand-Terminal.
- Impressum + Datenschutzerklärung als Vorlage mit Platzhaltern.

## Highlight-Feature: Live-Challenge im Klassenzimmer
- Dozent startet Challenge mit 4-stelligem Beitrittscode, Schüler treten mit Konto bei.
- Beamer-Ansicht: Anlage, Countdown, Live-Rangliste (Pseudonyme), Versuche/Tipps.
- Modi: Speedrun (früher „Sprint“; gleiche Aufgabe, Punkte nach Zeit/Versuchen/Tipps) und Störungsjagd (Bug in laufender Anlage finden und beheben).
- Ende: Siegerehrung mit Podest, anonyme Lösung am Beamer besprechen.
- Technik: Pages Functions + D1, Polling alle 2–3 s (gratis).

## Konten & Daten
- Benutzername + Passwort, keine E-Mail. Rollen Admin / Dozent / Schüler.
- Nur Admin legt Dozenten an; Schüler per Dozent oder Klassencode.
- Dozent sieht Fortschritt und Code der eigenen Klasse. Passwort-Reset durch Dozent. Nur Pseudonyme (Lernende ab ca. 15).
- Lokaler Spielstand wird beim ersten Login auf Nachfrage übernommen.
- Cloudflare Pages (Git-Integration) + Functions + D1 `spsquest` (Binding `DB`, EU). Admin aus Secrets ADMIN_USER / ADMIN_PASSWORD.

## Geschäftsmodell
- Vorerst gratis; später einzeln + günstigeres Paket. Nur kostenlose Dienste ohne Rückfrage.

## Arbeitsweise
- Bauarbeit in einer Claude-Code-Cloud-Sitzung (Guthaben-Aktion bis 5.11.) direkt am Repo.
- Nebenzweige mit Vorschau; Übernahme nach main selbständig bei grünen Tests.
- Fertig heisst: Validator 0 Fehler, Browser-Durchlauf ohne Fehler, Handy ok, offline spielbar.
- Nach jedem Abschnitt docs/STAND.md aktualisieren.
