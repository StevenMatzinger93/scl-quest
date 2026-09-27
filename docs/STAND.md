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
5b. **KOP Quest – Profi-Stufe (Kapitel 11–15)** – Bausteine mit KOP-Rumpf: SCL-Deklaration (Tabelle) + Netzwerke.
   - `kop.js`: `splitBlock`/`proSource` übersetzen den Rumpf zeilentreu nach SCL (Stromfluss als VAR_TEMP, Flanken als Static – nur im FB), `wrapPro(SCLPro)` kompiliert Projekte, übersetzt Fehler („Netzwerk N: …“), filtert Hilfsvariablen aus Warnungen/Konstrukten, prüft Box-Typ gegen Instanztyp. Operanden `#lokal`, `"global".Element`, `Feld[1]`; Aufruf-Boxen `=> "FB_X_DB"(In := a, Out => b)`, `#Multi(…)`, FC mit `Ret_Val => x`.
   - Editor: Netzwerke im Baustein grafisch, Kopf bleibt unberührt; Aufruf-Box mit Parameterfeldern (aus der Schnittstelle des Ziels); Variablenliste mit lokalen Variablen (#…), PLC-Variablen und Aufrufzielen; DB/UDT in der Textansicht; Beobachten zeigt die Netzwerke jedes Aufrufs mit Stromfluss.
   - Inhalte: 50 Aufgaben (FC, FB/Instanz/Multiinstanz, DB/UDT/Array, Standardbausteine Tür/Kette/Antrieb/Meldung, OB1/OB100, Final Boss 2 `k15_final`), 10 Theorien (`verifyKopPro`), 8 Handbuchseiten, 15 weitere Störungsszenarien (insgesamt 37).
   - KOP Quest ist damit vollständig: 150 Aufgaben, 30 Theorien, 23 Handbuchseiten.

5c. **FUP Quest** (Bahn-Stellwerk Brünigkreuz, „Das Geisterstellwerk“) – Konzept `docs/FUP_QUEST_KONZEPT.md`.
   - Gemeinsames Netzwerkmodell mit KOP (`kop.js`): neu XOR, SR (Rücksetzen dominant) / RS (Setzen dominant), Fehlertexte in FUP-Begriffen (`words()`), `QUEST.lang = 'fup'`.
   - Editor (`kop_editor.js`, Variante `fup`): Boxen &, >=1, X, Negationskreis, P/N, Timer, Zähler, CMP, Zuweisung/S/R/SR/RS, MOVE/Rechnen, Aufruf-Box (Grösse nach Parametern). **Ziehen + verbinden**: Palette und Variablen per Drag & Drop auf Eingänge/Ausgänge, Tippen geht weiterhin. Signalzustände farbig (grün = 1).
   - `dev/src/scene_stellwerk.js`: Stellwerk mit zwei Weichen, Einfahr-/Ausfahrsignal, Bahnübergang (Schranke, Blinklicht, Glocke), Gleisbelegung, Fahrstrasse eingestellt/festgelegt, Stelltisch, Zug.
   - Inhalte `dev/src/content_fup/`: 150 Aufgaben (Grundstufe 1–10, Profi 11–15 mit Final Boss 2 `fp15_final`), 30 Theorien (`verifyKop`/`verifyKopPro`), 21 Handbuchseiten, 36 Störungsszenarien. Validator: `node validate_kop.js fup`.
   - Portal: Tor FUP offen (`web/fup/`), eigener Spielstand/Sync (`spsquest_sync_fup`), Leitstand zeigt FUP-Lösungen als Funktionsplan (Profi: je Baustein), Live-Challenge mit Quest FUP. Worker: `fup` für Fortschritt und Challenges.

5d. **AWL Quest** (altes Walzwerk im Keller, S7-300, „Das vergessene Walzwerk“) – Konzept `docs/AWL_QUEST_KONZEPT.md`.
   - `dev/src/awl.js`: AWL wird zeilentreu nach SCL übersetzt (VKE/Erstabfrage/ODER-Zweig statisch, Klammern, typisierte Akkus, S5-Zeiten → TON/TOF/TP, S5-Zähler, Sprünge über WHILE/CASE-Verteiler). Status je Zeile (VKE, AKKU1, AKKU2). `AWL.wrapEngine` (Grundstufe), `AWL.wrapPro` (Bausteine mit AWL-Rumpf, `CALL` mit Parameterzeilen, Typauflösung über Schnittstellen, DBs, UDTs). Tests: `node test_awl.js` (296).
   - Editor: AWL-Hervorhebung in `editor.js`, Statusspalte wie „Beobachten“ im TIA Portal (`awl_editor.js`), Beobachten im Profi-Teil mit Statustabelle je Baustein, AWL-Symbolleiste, Hilfetexte zu den Anweisungen, Hinweis „S7-1200 kann kein AWL“ (Einführung, Theorie, Handbuch „S7-300, S7-1500, S7-1200“, Migration nach SCL).
   - `dev/src/scene_walzwerk.js`: Stossofen, Rollgang mit glühendem Block, Walzgerüst mit Spalt, Schere, Kühlwasser, Hydraulik, Leitstand, S7-300-Rack mit SF/RUN/STOP.
   - Inhalte `dev/src/content_awl/`: 150 Aufgaben, 30 Theorien (`verifyAwl`/`verifyAwlPro`), 22 Handbuchseiten, 45 Störungsszenarien. Validator: `node validate_awl.js`.
   - Portal: Tor AWL offen (`web/awl/`), Sync `spsquest_sync_awl`, Leitstand, Live-Challenge mit Quest AWL.
   - Damit ist die Reihenfolge aus ENTSCHEIDUNGEN.md abgearbeitet: alle vier Quests (SCL, KOP, FUP, AWL) mit Portal, Konten und Live-Challenge.

Tests (alle grün, lokal): Engine, 268 Profi-Tests, 296 AWL-Tests, Validator SCL/KOP/FUP/AWL je 0 Fehler, Browser-Durchläufe SCL, KOP, FUP, AWL je 150+30 (`tests/kop_playthrough.js [fup|awl] [mobile]`), `tests/fup_ui.js`, `tests/awl_ui.js` (Statusspalte, Profi-Beobachten, 390 px), `tests/kop_pro_ui.js`, pro_ui, comfort, `tests/api.js` (98), `tests/portal.js` (50), `tests/live.js` (29).

6. **Anleitungen im Portal** – Titelseite mit drei Karten „Anleitungen“ und Menüpunkt *Anleitung*; Seite `#/anleitung/lernende|dozenten|admin` (`dev/portal/portal_anleitung.js`): Spielen und Anmelden, Klassen/Konten/Fortschritt/Live-Challenge, Admin-Zugang/Dozenten/Sicherheit/Betrieb. `tests/portal.js` prüft die Seiten (37).

7. **Feedback/Fehler jederzeit + Testklasse SPS2026**
   - Knopf **💬** unten links im Portal und in allen vier Quests (`dev/portal/report.js`, vom Build in `web/index.html` und `web/<quest>/index.html` eingebunden, nicht in den Offline-Dateien): Typ Feedback/Fehler, Freitext (Pflicht), Bestätigung, Formular wird geleert. Kontext automatisch: Quest, Aufgabe/Theorie/Baustein bzw. Portal-Ansicht (`window.SPSQ_REPORT_CONTEXT` in `app.js`), Benutzername aus der Sitzung (ohne Login leer), User-Agent vom Server. Beamer-Ansicht ohne Knopf.
   - Worker `worker/reports.js`, Tabelle `feedback_reports` (Migration 4; eigene Tabelle, weil die Umfrage `feedback` anonym und strukturiert ist): `POST /api/reports` auch ohne Login, leerer Text → 400, Spam-Schutz 10 Meldungen / 15 min pro IP; `GET /api/reports?type=&quest=` (Admin alles, Dozent eigene Lernende + eigene), Admin: erledigt abhaken, löschen.
   - Portal: Seite `#/meldungen` (Menü *Meldungen*, Links in Leitstand und Administration), Filter nach Typ und Ort, Kennzahlen Fehler/Feedback/offen.
   - **Admin kann zugleich Dozent sein**: Admin-Konten mit Passwort-Hash melden sich normal an und ändern ihr Passwort unter *Konto*; Leitstand, Klassen und Live-Challenge auch für Admins. Admin aus den Secrets (`!secret`) unverändert.
   - **Testklasse SPS2026** existiert in D1 (ein Admin-Konto als Dozent + 5 Testkonten). Passwörter setzt Steven im Leitstand bzw. unter *Konto*. Seed-Daten stehen nicht mehr im Repository: `dev/seed.js` liest eine lokale Datei `dev/seed.local.json` (in `.gitignore`) und schreibt `dev/seed.local.sql` zum Ausführen mit `wrangler d1 execute`; ohne lokale Datei kein Seed.
   - ⚠ **Sicherheit:** Der Git-Verlauf enthält die früheren Seed-Werte weiterhin → Repository privat halten und die Passwörter der Testkonten im Portal ändern (Admin: *Konto*, Lernende: Leitstand → *Passwort*).
   - Nebenbei behoben: „5 Kontoen“ → „5 Konten“ im Leitstand.
   - Tests: `tests/api.js` (inkl. Meldungen und Seed-Logins mit im Test erzeugten Daten), `tests/portal.js` (50, Knopf auf Startseite, in SCL/KOP/FUP/AWL und im Leitstand, Ansicht Meldungen mit Kontext und Filter, Admin-Konto als Dozent sieht die Testklasse).

8. **Paket 0 – Sicherheit** (docs/PLAN_ZERTIFIKAT_PIKETT.md): keine Konten, Passwörter oder Namen mehr im Repository. `worker/seed.js`/`seed.sql` entfernt, Migration 5 ist ein leerer Platzhalter (bestehende Konten in D1 bleiben). `dev/seed.js` liest `dev/seed.local.json` (gitignored) und schreibt `dev/seed.local.sql`; geänderte Passwörter werden nie überschrieben. Tests erzeugen ihre Seed-Daten selbst (`tests/seed_helper.js`): `tests/api.js` 97, `tests/portal.js` 50.
   - Hinweis: Der Git-Verlauf enthält die alten Seed-Werte → Repository privat halten, Passwörter der Testkonten im Portal ändern.

9. **Teil A – Zertifikat mit Prüfung** (Konzept `docs/ZERTIFIKAT_KONZEPT.md`)
   - **A1 Konzept, A2 Spike:** Bewertung im Worker mit den echten Engines (`worker/gen/exam_bundle.js`, von `build.js` erzeugt, ca. 660 KB).
     - Messung (`node bench_exam.js`): 120 Aufgaben, warm Median 0,34 ms, 90 % 1,1 ms, max. 3 ms; kalte Erstaufrufe bis ca. 10 ms.
     - **Der Gratis-Tarif reicht:** eine Aufgabe pro Anfrage, Aufwärmen beim Start des Isolats, Abgabe vor der Bewertung speichern, automatische Wiederholung. Im Betrieb die CPU-Zeit im Cloudflare-Dashboard (Observability) nachsehen.
   - **A3/A8 Inhalte:** `exam_core.js` (Format, Ziehung per Seed, Parameter, öffentliche Sicht, Bewertung), `validate_exam.js [--quest=x] [--full]`.
     - Pools komplett: je Quest 18 + 12 Aufgaben und 40 + 30 Fragen, insgesamt **120 Aufgaben und 280 Fragen**.
     - Validator: 0 Fehler (vereinzelte Zeitwarnungen knapp über 2 ms).
   - **A4 Worker** (Migration 6):
     - `worker/exam.js`: Voraussetzungen, Start, Abgabe, Fokus, Abschluss, Aufsicht, Annullieren.
     - `worker/cert.js`: Ausstellen mit Einwilligung, Zurückziehen, Widerruf, Klassen-/Admin-Liste, Prüfseite `/z/:code` mit Open Graph, Rate-Limit.
     - `CERT_FEE` vorbereitet.
   - **A5 Prüfungsmodus** in allen 4 Quests (`<quest>/?exam=ID`): Prüfungsleiste mit Restzeit, Testen mit Beispiel-Tests, Abgeben, Theorie, Ergebnis mit schwachen Kapiteln. Offline-Dateien: Hinweis „nur im Portal“.
   - **A6 Portal Zertifikate:** Übersicht, Start, Beitritt per Code, Ausstellen, Zertifikat A4 quer (Druck/PDF), PNG, QR (qrcode-generator, MIT), Link, LinkedIn, Zurückziehen.
   - **A7 Leitstand:** Prüfung unter Aufsicht mit Beamer-Übersicht und Fokusverlusten, Annullieren, Zertifikate in der Klassenansicht. Admin: Widerruf. Konto: Anzeigename.
   - **A9 Doku:** Anleitungen (Lernende/Dozenten/Admin), Datenschutz-Vorlage (Zertifikatsname, Prüfseite), Handbuchseite „Zertifikat & Prüfung“ in allen Quests, CLAUDE.md.
   - **Tests:** `tests/exam_api.js` (73), `tests/exam_ui.js` (82, alle Quests + Aufsicht + Handy), `tests/cert_render.js` (7, PDF A4 quer, PNG, QR dekodiert), `tests/api.js` (97), `tests/portal.js` (50), `tests/live.js` (29), Durchläufe SCL/KOP/FUP/AWL grün.
10. **Sensorwerkstatt S0 (begonnen):** `docs/SENSORWERKSTATT_FAKTEN.md` aus Handbuchwissen; die Siemens-Seiten sind in der Cloud-Sitzung vom Proxy gesperrt, deshalb ist jeder unsichere Wert mit [prüfen] markiert.

## Offen / blockiert

- Workers-Build behoben: Nebenzweige werden mit `npx wrangler preview` gebaut, dafür steht in `wrangler.jsonc` ein leerer `previews`-Block. Previews nutzen dieselbe D1-Datenbank wie die Live-Seite.
- Live-Challenge vertraut dem Ergebnis aus dem Browser (kein serverseitiger Test) – für den Unterricht ok.
- Praxistest in der Klasse (Steven), rechtliche Prüfung Impressum/Datenschutz (Steven).

## Nächster Schritt

Reihenfolge laut ENTSCHEIDUNGEN.md „Nächste Ausbaustufen“: Paket 0 ✓ → Teil A ✓ → **Sensorwerkstatt S0–S10** (als Nächstes: S0 gegen die Handbücher abgleichen, sobald Netzzugang besteht; S1 NORM_X/SCALE_X in allen Engines) → Teil B (Pikettdienst).

Früher:

Die Reihenfolge aus ENTSCHEIDUNGEN.md ist vollständig umgesetzt. Offen sind nur Punkte, die Steven selbst erledigt: Praxistest in der Klasse (Testplan `docs/TESTPLAN.md`, jetzt für alle vier Quests), rechtliche Prüfung Impressum/Datenschutz, Prüfung der String-Umwandlungen und der AWL-Details (z. B. Vergleich setzt das VKE neu, RND rundet halb auf gerade) in einer echten S7-300/TIA-Umgebung. Danach Rückmeldungen aus dem Feldtest einarbeiten.

## Hosting

Cloudflare Worker `scl-quest` (wrangler.jsonc: `main` = worker/index.js, Assets aus web/, `run_worker_first` für `/api/*`), per GitHub verbunden (Workers Builds, Preview pro Nebenzweig).
D1 `spsquest` (database_id febfbb60-ed1e-48b3-b26f-f4933dd24915), Binding `DB`. Secrets ADMIN_USER / ADMIN_PASSWORD (Production + Previews).
Lokal: `../.dev.vars` mit ADMIN_USER/ADMIN_PASSWORD, dann in `dev/`: `npx wrangler dev -c ../wrangler.jsonc --local --port 8787`.
Hinweis für Cloud-Sitzungen: *.workers.dev ist dort vom Proxy gesperrt – Deploy-Status über die GitHub-Checks prüfen.
