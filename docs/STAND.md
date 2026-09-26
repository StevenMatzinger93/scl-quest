# Stand (26.09.2026)

Fertig: SCL Quest v5.1 (siehe CLAUDE.md) – 150 Aufgaben, 30 Theorien, Profi-Engine, Bedienkomfort, PWA.
Projektkarte: docs/SCL_Quest_Projektkarte.drawio. Entscheidungen: docs/ENTSCHEIDUNGEN.md. Testplan: docs/TESTPLAN.md.

## Erledigt

1. **TIA-Export entfernt** – Engine (`exportProject`, `exportZip`, ZIP/CRC, Fixups), Export-Knöpfe, Tour-Schritt, Handbuchseite, Abzeichen „Brücke ins TIA Portal“ (alte Spielstände laufen weiter), Validator-Rundreise. `p15_export` heisst „Sauber für die Bibliothek“ (ID unverändert), Theorie t15b „Programmierstandard“. Validator meldet Fehler, falls Inhalte wieder einen TIA-Export anbieten.
2. **Plattform** – `web/` ist das SPS-Quest-Portal, SCL Quest liegt unter `web/scl/`.
   - Portal: filmisch-dunkle Fabrikhalle, vier leuchtende Tore (SCL offen, KOP/FUP/AWL „in Vorbereitung“), ARIA-Intro (Schreibmaschine), Login als Leitstand-Terminal, Selbstanmeldung per Klassencode (`#/code/XXXXXX`), Impressum/Datenschutz als Vorlagen mit `[[…]]`-Platzhaltern. Keine Google-Fonts in der gehosteten Version.
   - Worker (`worker/`): Admin aus Secrets, Dozenten (nur vom Admin), Schüler (vom Dozenten erzeugt oder per Klassencode), PBKDF2-Passwörter, Sitzungs-Cookie, Rate-Limit, Pflicht-Passwortwechsel bei Startpasswörtern, Passwort-Reset durch Dozent/Admin, Löschen (Schüler selbst, Dozent Klassen/Konten, Admin Dozenten). Tabellen legt der Code selbst an (Migrationen 1–3).
   - Leitstand (Dozent): Klassen, Klassencode an/aus/neu, Konten nummeriert oder aus Namensliste erzeugen + Zugangszettel drucken, Klassenliste mit Fortschritt, Schülerdetail mit Aufgabenraster und Code (Lösung/Entwurf).
   - Administration: Kennzahlen, Dozenten anlegen/zurücksetzen/löschen.
   - SCL Quest (Portal-Version): Spielstand wird mit dem Konto abgeglichen; beim ersten Login Übernahme des lokalen Stands auf Nachfrage; anderes Konto auf demselben Browser mischt nie; Abmelden lädt hoch und entfernt den Stand aus dem Browser. Der Zertifikatsname bleibt lokal.
   - Nebenbei behoben: Bestätigungsdialog lag hinter dem Titelbildschirm.
3. **Live-Challenge** – Dozent legt im Leitstand eine Challenge an (Sprint oder Störungsjagd, Aufgabe/Szenario, Dauer, optional nur eine Klasse), Beamer-Ansicht (`#/beamer/ID`): 4-stelliger Code, Teilnehmende, Start, Countdown, Live-Rangliste (Pseudonyme, Zeit, Versuche, Tipps, Punkte), Siegerehrung mit Podest, Lösung anonym zeigen mit Vergleich zur Musterlösung. Lernende: Portal → Live-Challenge → Code → Spiel im Live-Modus (Aufgabe erst nach Start, Live-Leiste, keine Musterlösung, Endergebnis mit Podest). Polling 2–2,5 s, nur D1 (Gratis-Tarif).
   - Störungsjagd: 30 Fehlerszenarien (2 pro Kapitel) in `dev/src/content/bugs.js`; Validator prüft: Fehlerversion übersetzt, scheitert an den Tests.
4. **Testplan + Feedback** – `docs/TESTPLAN.md` (Vorbereitung, 3 Lektionen inkl. Live-Challenge, 17 technische Testfälle, Erfolgskriterien, Papierversion). Feedback-Formular im Portal (`#/feedback`, anonym für die Lehrperson), Auswertung in der Klassenansicht des Leitstands, Admin sieht alles.

Tests (alle grün, lokal): Engine, 268 Profi-Tests, Validator 0 Fehler (inkl. 30 Störungsszenarien), Browser-Durchlauf 150+30, pro_ui, comfort, `tests/api.js` (73), `tests/portal.js` (23), `tests/live.js` (15, Beamer + 3 Lernende inkl. Handy).

## Offen / blockiert

- **Workers-Build schlägt fehl** (Check „Workers Builds: scl-quest“ auf PR #1 bricht nach 0 s ab, ohne Log in GitHub). Deshalb noch **nicht nach main übernommen**. Steven: Build-Log im Cloudflare-Dashboard ansehen (Workers → scl-quest → Deployments/Builds). Mögliche Ursachen: Build-Einstellungen (Root-Verzeichnis, Build-/Deploy-Befehl), fehlende Berechtigung des Build-Tokens für D1, Preview-Builds für Nebenzweige.
- Live-Challenge vertraut dem Ergebnis aus dem Browser (kein serverseitiger Test) – für den Unterricht ok.
- Praxistest in der Klasse (Steven), rechtliche Prüfung Impressum/Datenschutz (Steven).

## Nächster Schritt

5. **KOP Quest** (danach FUP Quest, AWL Quest; Live-Challenge jeweils mit einbauen). Zuerst Lehrplan-Konzept nach `docs/KOP_QUEST_KONZEPT.md`, dann Netzwerk-Editor, KOP-Engine, Seilbahn-Simulation, Inhalte.

## Hosting

Cloudflare Worker `scl-quest` (wrangler.jsonc: `main` = worker/index.js, Assets aus web/, `run_worker_first` für `/api/*`), per GitHub verbunden (Workers Builds, Preview pro Nebenzweig).
D1 `spsquest` (database_id febfbb60-ed1e-48b3-b26f-f4933dd24915), Binding `DB`. Secrets ADMIN_USER / ADMIN_PASSWORD (Production + Previews).
Lokal: `../.dev.vars` mit ADMIN_USER/ADMIN_PASSWORD, dann in `dev/`: `npx wrangler dev -c ../wrangler.jsonc --local --port 8787`.
Hinweis für Cloud-Sitzungen: *.workers.dev ist dort vom Proxy gesperrt – Deploy-Status über die GitHub-Checks prüfen.
