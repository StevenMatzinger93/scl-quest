# Stand (27.09.2026)

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

5a. **KOP Quest – Grundstufe (Kapitel 1–10)** – Konzept `docs/KOP_QUEST_KONZEPT.md`.
   - `dev/src/kop.js`: Textformat (`NETWORK Titel` + `Strompfad => Spulen;`), Parser, Übersetzung nach SCL mit einer Stromfluss-Variable pro Element, `KOP.wrapEngine` (Tests laufen über `engine.js`).
   - `dev/src/kop_editor.js`: grafischer Netzwerk-Editor (Element antippen → Variable aus der Liste, Werkzeugleiste für Reihe/Parallel/Öffner/Flanke/Timer/Zähler/Vergleich/Spulen/Boxen, Netzwerke verschieben), Textansicht umschaltbar, Stromfluss beim Abspielen grün. `renderStatic` für Theorie, Handbuch, Lösungsvergleich, Leitstand.
   - `dev/src/scene_seilbahn.js`: Seilbahn-Bergstation „Gratbahn“ (Antrieb, Bremse, Kabinen, Türen, Sperre, Ampel, Hupe, Not-Halt, Windmesser, Sicherheitskette, HMI).
   - Spielhülle `app.js` über `window.QUEST` (Name, Speicher-Schlüssel, Editor, Zertifikat); Build erzeugt `kop.html` (offline) und `web/kop/`.
   - Inhalte `dev/src/content_kop/`: 100 Aufgaben (Kapitel 1–10, Boss je Kapitel, Final Boss `k10_final`), 20 Theorien (mit `verifyKop`-Prüfung), 15 Handbuchseiten, 22 Störungsszenarien. Validator: `node validate_kop.js`.
   - Portal: Tor KOP offen, Fortschritt je Quest am Tor, Leitstand mit Quest-Umschalter (Klassenliste, Schülerdetail, KOP-Lösungen als Leiterbild), Live-Challenge mit Quest-Auswahl (Beitritt öffnet die richtige Quest, falsche Links werden umgeleitet). Worker: Quest `kop` für Fortschritt und Challenges.
   - Solange die Profi-Stufe fehlt, endet KOP Quest nach Kapitel 10 mit dem Zertifikat.

Tests (alle grün, lokal): Engine, 268 Profi-Tests, Validator SCL und KOP je 0 Fehler, Browser-Durchlauf SCL 150+30, `tests/kop_playthrough.js` (100+20, erste Aufgabe per Klick im Editor; `mobile` für 390 px), pro_ui, comfort, `tests/api.js` (73), `tests/portal.js` (27, inkl. KOP-Konto und Leiterbild im Leitstand), `tests/live.js` (21, inkl. KOP-Störungsjagd).

## Offen / blockiert

- Workers-Build behoben: Nebenzweige werden mit `npx wrangler preview` gebaut, dafür steht in `wrangler.jsonc` ein leerer `previews`-Block. Previews nutzen dieselbe D1-Datenbank wie die Live-Seite.
- Live-Challenge vertraut dem Ergebnis aus dem Browser (kein serverseitiger Test) – für den Unterricht ok.
- Praxistest in der Klasse (Steven), rechtliche Prüfung Impressum/Datenschutz (Steven).

## Nächster Schritt

5b. **KOP Quest – Profi-Stufe (Kapitel 11–15)**: Bausteine in KOP (FC/FB mit Schnittstelle, Aufruf-Boxen, Multiinstanzen, Datenbausteine/UDT, Standardbausteine, OB1/OB100, Final Boss 2) über `engine_pro.js`, 50 Aufgaben, 10 Theorien, Störungsszenarien. Danach FUP Quest, dann AWL Quest.

## Hosting

Cloudflare Worker `scl-quest` (wrangler.jsonc: `main` = worker/index.js, Assets aus web/, `run_worker_first` für `/api/*`), per GitHub verbunden (Workers Builds, Preview pro Nebenzweig).
D1 `spsquest` (database_id febfbb60-ed1e-48b3-b26f-f4933dd24915), Binding `DB`. Secrets ADMIN_USER / ADMIN_PASSWORD (Production + Previews).
Lokal: `../.dev.vars` mit ADMIN_USER/ADMIN_PASSWORD, dann in `dev/`: `npx wrangler dev -c ../wrangler.jsonc --local --port 8787`.
Hinweis für Cloud-Sitzungen: *.workers.dev ist dort vom Proxy gesperrt – Deploy-Status über die GitHub-Checks prüfen.
