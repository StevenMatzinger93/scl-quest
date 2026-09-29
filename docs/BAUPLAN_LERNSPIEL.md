# Bauplan Lernspiel – themenneutrale Vorlage (Stand 28.09.2026)

Destilliert aus SCL Quest v5. Gilt für jede eigenständige Quest der späteren Dachmarke **Bühler Quest** (SPS Quest, Digital Quest, …). Jede Quest ist ein eigenes Produkt mit eigenem Repo, eigener Engine und eigenen Klassen.

## 1. Kernprinzip
Die lernende Person **baut etwas Echtes** (Code, Schaltung, Wahrheitstabelle, Messaufbau …). Eine selbst geschriebene **Engine prüft es gegen Testfälle**, und eine **Simulation zeigt das tatsächliche Ergebnis** – nie eine vorgespielte Animation. Fehler werden sichtbar, erklärt und sind reparierbar.

## 2. Didaktischer Aufbau
- 15 Kapitel × 10 Aufgaben = 150 Aufgaben, dazu 30 Theorie-Aufträge.
- Kapitelablauf: Theorie A → Aufgaben 1–5 → Theorie B → Aufgaben 6–10.
- Theorie = Lektion + 5 Fragen, bestanden ab 80 %. Fragen, wo möglich, gegen die Engine verifiziert (keine falsche Musterantwort möglich).
- Grundstufe (Kap. 1–10) mit reduziertem Umfang, Profi-Stufe (Kap. 11–15) mit ganzem Aufbau. Boss-Aufgabe am Ende jeder Stufe, Zertifikat nach Grundstufe, Abzeichen.
- Jede Aufgabe: story, brief, learn, take (Merksatz), man (Handbuchverweis), hint, hint2, debug-Variante, Referenzlösung, Startzustand, typische Fehllösungen (`wrong`).
- Spaced Review auf der Karte, Lösungsvergleich nach dem Lösen, Glossar mit Unterstreichung in Aufgabentexten.
- Begleitfiguren mit festem Tonfall (bei SCL: ARIA + Werkmeister). Jede Quest hat eigene Figuren/Welt, gleiche Rolle: eine erklärt, eine fordert.

## 3. Qualitätssicherung (nicht verhandelbar)
- **Validator** pro Aufgabe: Referenz besteht · Start scheitert · jede `wrong`-Lösung scheitert · Bindungen zur Szene lösen auf · Theoriefragen stimmen mit Engine überein. Ziel: „OK — keine Fehler“, 0 Warnungen.
- Engine-Unit-Tests (bei SCL ≈ 280 Profi-Tests).
- Playwright-Durchlauf: alle Theorien + alle Aufgaben über die echte Oberfläche, ohne JS-Fehler; Handy-Screenshot.
- **Fertig heisst:** Validator 0 Fehler, Browser-Durchlauf fehlerfrei, Handy ok, offline spielbar.

## 4. Technischer Rahmen (wiederverwendbar)
- Ausgeliefert: **eine** selbstständige `index.html` (Bibliotheken eingebettet, offline), plus `web/` als PWA (Manifest, Service Worker cache-first mit Content-Hash).
- `dev/`: `src/engine*.js` (themenspezifisch), `src/scene2d.js`/`scene3d.js` (themenspezifisch, Kanäle-Modell), `src/editor.js`, `src/app.js` (Spielsteuerung + Komfort), `src/content/` (`_helpers.js` mit `defTask`/`defTheory`/`defChapter`, `chNN.js`, `theory.js`, `manual.js`), `build.js`, `validate.js`, `tests/`.
- **Szene über Kanäle**: Aufgaben binden Engine-Ergebnisse an benannte Kanäle; nicht gebundene Kanäle werden beim Öffnen zurückgesetzt.
- Speicherstand in `localStorage` mit Versionsschlüssel + Migration, Export-Erinnerung, `navigator.storage.persist()`.

Themenneutral übernehmbar: App-Hülle, Karte, Theorie-Modul, Komfortfunktionen, Validator-Gerüst, Build, PWA, Testgerüst.
Neu pro Quest: Engine, Szene, Inhalte, Handbuch, Glossar, Figuren/Welt.

## 5. Komfortfunktionen (Standard in jeder Quest)
Fehlermarkierung live · Hover-Infos · Quick Fixes für typische Fehler · Diagnose-Box „Mögliche Ursache“ aus dem fehlschlagenden Testschritt · Lösungsvergleich · geführte Touren · Glossar A–Z · Volltextsuche im Handbuch · Speicheranzeige · helles Thema (Arbeitsfläche bleibt dunkel) · UI-Skalierung · Farbsehhilfe (Symbole statt nur Farben) · Handy-Symbolleiste.

## 6. Design
- Filmisch-dunkle Industrieoptik, Arbeitsfläche immer dunkel.
- Tokens (SCL Quest, dunkel): `--bg-primary #121212`, `--bg-secondary #1a1a1a`, `--bg-panel #1c1c1c`, `--bg-editor #0c0d0a`, `--text-primary #e0e0e0`, `--text-dim #8a8a8a`; Akzente `--accent-green #39ff14`, `--accent-cyan #1ec8e0`, `--accent-orange #ff8c00`, `--accent-red #ff3333`, `--accent-blue #5b9bff`. Helles Thema mit gedämpften Akzentvarianten.
- Schriften: `Inter` (UI), `Fira Code` (Code/Werte); Font Awesome eingebettet.
- Jede Quest bekommt **eine eigene Leitfarbe** (Hauptakzent), Grundgerüst und Tokens-Namen bleiben gleich → erkennbar als Familie, trotzdem eigenständig.

## 7. Arbeitsweise mit Claude
1. Konzept + `docs/ENTSCHEIDUNGEN.md` (massgeblich im Repo, Kopie im Projekt).
2. Phasen: A Engine → B Datenmodell → C Oberfläche → D Inhalte → E QA → (F Abgleich mit Realität/Fachperson).
3. Nach jedem Abschnitt `docs/STAND.md` aktualisieren; `CLAUDE.md` im Repo beschreibt Engine-Semantik und Aufgabenformat.
4. Nebenzweige mit Vorschau, Übernahme nach main bei grünen Tests.

## 8. Vorbereitung Bühler Quest (jetzt nur beachten, nicht bauen)
Jede Quest bleibt eigenständig (eigene Klassen, eigene Konten, eigene DB). Später sollen Personen questübergreifend **verknüpft** werden können: Wird in Digital Quest „Hans Muster“ erfasst und existiert er bereits in SPS Quest, fragt das System „Gleiche Person?“ → Knopf **Verknüpfen**. Zweck: questübergreifende Auswertung.

Damit das später ohne Umbau geht, gilt ab sofort in jeder Quest:
- Personen-ID als **UUID** (nicht fortlaufende Zahl), nie wiederverwendet.
- Vorname und Nachname **getrennt** speichern (neben Pseudonym/Benutzername); optional Geburtsjahr o. ä. als Unterscheidungsmerkmal bei Namensgleichheit.
- Lernereignisse als Ereignisliste mit Zeitstempel speichern (Aufgabe, Versuch, Ergebnis, Tipps, Dauer) statt nur Endstände.
- Aufgaben und Theorien mit **Kompetenz-Tags** versehen (z. B. `logik.und`, `zaehler.flanke`), damit Auswertungen über Quests hinweg vergleichbar werden.
- Stabile Export-Schnittstelle je Quest (z. B. `/api/export/persons`, `/api/export/progress`) als Grundlage für eine spätere Bühler-Quest-Zentrale.
- Verknüpfung nie automatisch – immer Bestätigung durch Dozent/Admin; Verknüpfung lösbar. Datenschutz: nur mit Einwilligung bzw. innerhalb derselben Institution.
