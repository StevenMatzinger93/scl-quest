# SPS Quest – Detailplanung: Zertifikat mit Prüfung & Pikettdienst

Stand: 27.09.2026 · Auftraggeber: Steven · Umsetzung: Claude Code (Cloud-Sitzung, Repo `scl-quest`)

Diese Datei ist verbindlich wie `docs/ENTSCHEIDUNGEN.md`. Wo hier „Vorschlag“ steht, gilt der Vorschlag, solange Steven nichts anderes sagt. Rückfragen nur bei Kosten oder wenn etwas fehlt, das weder hier noch in ENTSCHEIDUNGEN.md steht.

Reihenfolge: **Paket 0 → Teil A (Zertifikat) → Teil B (Pikettdienst)**. Jedes Paket auf einem Nebenzweig, Übernahme nach `main` nur mit grünen Tests und erfolgreichem Workers-Build. Nach jedem Paket `docs/STAND.md` aktualisieren.

---

## Paket 0 – Aufräumen Sicherheit (zuerst, klein)

Ziel: Keine Klartext-Passwörter und keine echten Namen mehr im Repository.

1. `dev/seed.js`: Passwörter nicht mehr im Code. Seed-Daten aus einer lokalen, nicht eingecheckten Datei `dev/seed.local.json` lesen (in `.gitignore`); fehlt sie, wird **kein** Seed erzeugt. `worker/seed.js` und `worker/seed.sql` enthalten danach nur noch Struktur ohne Konten (oder werden entfernt, falls nicht mehr nötig).
2. Der bereits in D1 angelegte Seed bleibt bestehen (keine Migration, die Konten löscht). Stevens Passwortänderung darf nie überschrieben werden (bestehende Logik `WHERE pw = '!secret'` beibehalten).
3. `docs/STAND.md`: Die Passwort-Angaben (`Passwort = Vorname`, `steven`) entfernen; nur noch „Testklasse SPS2026 existiert, Passwörter setzt Steven im Leitstand“.
4. Lernende der Testklasse in allen Dokumenten nur noch als „5 Testkonten“ erwähnen, keine Vornamen.
5. Hinweis für Steven in STAND.md: Git-Verlauf enthält die alten Werte weiterhin → Repo privat halten, Passwörter im Portal ändern.

Fertig, wenn: `grep -ri "passwort = vorname\|'steven'.*password" dev worker docs` nichts mehr findet, `tests/api.js` angepasst und grün (Seed-Tests nutzen Testdaten, die im Test selbst erzeugt werden).

---

## Teil A – Zertifikat mit Prüfungsmodus und Prüflink

### A.1 Ziel und Nutzen

Lernende legen pro Quest und Stufe eine echte Prüfung ab und erhalten ein Zertifikat, dessen Echtheit jeder über einen Link/QR-Code prüfen kann (Arbeitgeber, Lehrbetrieb, LinkedIn). Das ist das erste Feature, für das später Geld verlangt werden kann – vorerst gratis (siehe A.12).

### A.2 Begriffe

- **Zertifikat**: je Quest (SCL, KOP, FUP, AWL) × Stufe (Grundstufe, Profi-Stufe) = 8 Zertifikatsarten.
- **Prüfung**: zeitlich begrenzter Durchgang mit zufällig gezogenen Aufgaben und Fragen aus einem **eigenen Prüfungspool** (nicht aus dem Spiel, damit Musterlösungen aus dem Spiel nicht helfen).
- **Prüfcode**: öffentliche, nicht erratbare ID eines Zertifikats, Format `SPSQ-XXXX-XXXX` (Crockford-Base32, ohne 0/O/1/I).

### A.3 Regeln (Vorschlag, verbindlich solange nicht geändert)

| Punkt | Grundstufe | Profi-Stufe |
|---|---|---|
| Voraussetzung | Im Spiel mind. 80 % der Aufgaben Kap. 1–10 gelöst **und** Final Boss (Kap. 10) gelöst | Grundstufen-Zertifikat derselben Quest **und** mind. 80 % Kap. 11–15 inkl. Final Boss 2 |
| Inhalt | 6 Programmieraufgaben + 12 Theoriefragen | 4 Programmieraufgaben (Bausteine) + 10 Theoriefragen |
| Zeit | 60 min | 90 min |
| Bestehen | ≥ 70 % der Punkte (Aufgaben 70 %, Theorie 30 % Gewicht) | gleich |
| Auszeichnung | ≥ 90 % → „mit Auszeichnung“ | gleich |
| Versuche | 1 Versuch pro 24 h, max. 3 Versuche pro 30 Tage je Zertifikatsart | gleich |

Während der Prüfung **gesperrt**: Tipps, Musterlösung, Lösungsvergleich, Live-Challenge, Wechsel zu anderen Aufgaben des Spiels. **Erlaubt**: Handbuch und Glossar (wie in der Praxis „open book“), Beobachten/Testen mit den sichtbaren Beispiel-Tests.

Bewertung einer Programmieraufgabe: bestanden = alle **verdeckten** Prüf-Tests grün (volle Punkte). Teilpunkte: Anteil bestandener Testfälle × 60 % (damit ein fast richtiges Programm nicht null Punkte gibt). Kompilierfehler = 0. Mehrfaches Abgeben erlaubt, gewertet wird die letzte Abgabe vor Ablauf.

Theoriefragen: Multiple Choice / Zahlenwert, aus einem Prüfungs-Fragenpool; Antwortreihenfolge gemischt.

### A.4 Zwei Prüfungsarten

1. **Selbständig online**: Lernende starten die Prüfung selbst im Portal. Zertifikat trägt den Vermerk „online abgelegt“.
2. **Unter Aufsicht**: Dozent startet im Leitstand eine „Prüfungssitzung“ (ähnlich Live-Challenge: 6-stelliger Code, Quest, Stufe, Zeitfenster, nur eigene Klassen). Lernende treten mit Code bei. Zertifikat trägt „unter Aufsicht abgelegt bei <Dozent-Anzeigename>, <Schule/Klasse>“. Der Dozent sieht live: wer ist drin, Fortschritt, Tab-Wechsel-Zähler, Abgaben. Er kann einzelne Prüfungen annullieren (Begründung Pflicht).

Tab-/Fensterwechsel werden nur **protokolliert** (Zähler im Prüfbericht), nicht bestraft. Keine Kamera, keine Überwachungssoftware.

### A.5 Fälschungssicherheit (wichtigster technischer Punkt)

Der Server darf dem Browser das Ergebnis **nicht** glauben (anders als bei der Live-Challenge).

- Prüfungsinhalt wird **serverseitig gezogen** (Seed pro Prüfung), der Browser bekommt nur Aufgabentext, sichtbare Beispiel-Tests, Startcode, Deklarationen – **nie** die verdeckten Prüf-Tests und nie die Referenz.
- **Parametrisierte Aufgaben**: Jede Prüfungsaufgabe hat Parameter (Zahlen, Grenzwerte, Zeiten, Variablennamen-Varianten), die pro Prüfung aus dem Seed gewählt werden. Aufgabentext und Tests werden daraus erzeugt → zwei Lernende haben nie exakt dieselbe Aufgabe.
- **Bewertung im Worker**: Bei jeder Abgabe schickt der Browser den Code, der Worker kompiliert und prüft ihn mit denselben Engines (`engine.js`, `engine_pro.js`, `kop.js`, `awl.js`) gegen die verdeckten Tests.
- Zeit wird serverseitig geführt (`started_at`, `deadline`); Abgaben nach Ablauf + 30 s Kulanz werden abgelehnt.
- Schutz vor Endlosschleifen: Engines haben Schleifen-/Schrittlimits; im Worker zusätzlich hartes Limit (z. B. max. 20 000 Anweisungen pro Testfall, max. Codegrösse 20 KB).

**Machbarkeit im Gratis-Tarif (vorab gemessen):** In Node brauchen Kompilieren + alle Tests einer Aufgabe im Median 0,1 ms, 90 % unter 0,9 ms, der schwerste Fall (`p15_final`) 7 ms. Cloudflare Free erlaubt ca. 10 ms CPU pro Anfrage. Deshalb:

- **A-Spike (Pflicht, zuerst)**: Worker-Bundle mit Engines + Prüfungspools bauen, in `wrangler dev` und auf einem Preview messen (CPU pro Abgabe, Kaltstart, Bundle-Grösse komprimiert < 3 MB, Startzeit). Prüfungsaufgaben so dimensionieren, dass die Bewertung **einer Aufgabe pro Anfrage** sicher unter 5 ms bleibt (Profi-Prüfungsaufgaben kleiner als der Final Boss).
- Nur Engines + Prüfungsinhalte in den Worker bündeln, nicht die 600 Spielaufgaben.
- Engines sind heute browser-/Node-Skripte mit `window`: einen dünnen ESM-Adapter `worker/engines.js` bauen (`globalThis.window = globalThis` vor dem Laden), ohne die Engines selbst zu verändern.
- **Falls** die Messung zeigt, dass es nur mit Workers Paid (5 USD/Monat) geht: **anhalten und Steven fragen** (Kostenregel). Bis zur Antwort Plan B vorbereiten: Bewertung im Browser + Speicherung des Codes, nachträgliche Serverprüfung per Aufgabe in mehreren kleinen Anfragen.

### A.6 Datenmodell (D1, neue Migrationen)

Migration 6 – Prüfungen:

```sql
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest TEXT NOT NULL,              -- scl|kop|fup|awl
  level TEXT NOT NULL,              -- grund|profi
  seed TEXT NOT NULL,               -- Zufallswert für Ziehung + Parameter
  items TEXT NOT NULL,              -- JSON: gezogene Aufgaben-/Fragen-IDs + Parameter
  session_id INTEGER,               -- Aufsichts-Sitzung oder NULL
  state TEXT NOT NULL,              -- running|submitted|expired|voided
  started_at INTEGER NOT NULL, deadline INTEGER NOT NULL, ended_at INTEGER,
  score REAL, passed INTEGER, distinction INTEGER,
  focus_lost INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT
);
CREATE TABLE IF NOT EXISTS exam_answers (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  item TEXT NOT NULL,               -- Aufgaben- oder Frage-ID
  answer TEXT,                      -- Code (JSON bei Profi: {block: src}) oder Antwort
  result TEXT,                      -- JSON: bestanden/Teilpunkte/Fehlertext (ohne verdeckte Werte)
  points REAL, submitted_at INTEGER,
  PRIMARY KEY (exam_id, item)
);
CREATE TABLE IF NOT EXISTS exam_sessions (       -- Prüfung unter Aufsicht
  id INTEGER PRIMARY KEY, teacher_id INTEGER NOT NULL, class_id INTEGER,
  quest TEXT NOT NULL, level TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
  opens_at INTEGER NOT NULL, closes_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,              -- Prüfcode SPSQ-XXXX-XXXX
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  exam_id INTEGER, quest TEXT NOT NULL, level TEXT NOT NULL,
  holder_name TEXT NOT NULL,        -- vom Lernenden eingegebener Name für das Zertifikat
  score REAL NOT NULL, distinction INTEGER NOT NULL,
  proctored INTEGER NOT NULL, proctor_label TEXT,
  issued_at INTEGER NOT NULL, revoked_at INTEGER, revoke_reason TEXT
);
```

Datenschutz: `holder_name` ist der einzige echte Name im System, wird nur mit ausdrücklicher Einwilligung beim Ausstellen erfasst, ist auf der Prüfseite öffentlich sichtbar (darauf hinweisen) und kann vom Inhaber jederzeit gelöscht werden (Zertifikat wird dann „zurückgezogen durch Inhaber“). Konto löschen → Zertifikate bleiben prüfbar, sofern der Inhaber nicht ausdrücklich „Zertifikate mitlöschen“ wählt (Auswahl im Löschdialog).

### A.7 API (Worker, neues Modul `worker/exam.js`, `worker/cert.js`)

Lernende (angemeldet):
- `GET  /api/exams/eligibility?quest=` → je Stufe: erfüllt? fehlende Voraussetzungen, nächster möglicher Versuch.
- `POST /api/exams` `{quest, level, sessionCode?}` → startet Prüfung, liefert Prüfungsinhalt ohne verdeckte Tests + `deadline`.
- `GET  /api/exams/:id` → aktueller Stand (für Neuladen der Seite).
- `POST /api/exams/:id/answer` `{item, answer}` → Worker bewertet, speichert, liefert Rückmeldung (bestanden ja/nein, Anzahl bestandener verdeckter Tests, Kompilierfehler mit Zeile – **keine** erwarteten Werte).
- `POST /api/exams/:id/focus` → Zähler +1.
- `POST /api/exams/:id/submit` → schliesst ab, rechnet Punkte, bei Bestehen `certificate_ready: true`.
- `POST /api/certificates` `{examId, holderName, consent: true}` → stellt Zertifikat aus.
- `GET  /api/certificates/mine`, `DELETE /api/certificates/:id` (Inhaber zieht zurück).

Dozent:
- `POST /api/exam-sessions` `{quest, level, classId?, opensAt, closesAt}` → Code.
- `GET  /api/exam-sessions/:id` → Teilnehmende, Fortschritt, Fokusverluste, Ergebnisse.
- `POST /api/exams/:id/void` `{reason}` → annullieren (nur eigene Sitzung/Klasse).
- Klassenansicht: Zertifikate der Klasse.

Admin: Zertifikat widerrufen (`POST /api/certificates/:id/revoke`), Übersicht Kennzahlen.

Öffentlich (ohne Login):
- `GET /z/:code` → **serverseitig gerenderte HTML-Prüfseite** (Worker, `run_worker_first` um `/z/*` erweitern) mit Open-Graph-Tags (Titel, Beschreibung, Bild), damit Links in LinkedIn/WhatsApp eine Vorschau zeigen.
- `GET /api/certificates/:code` → JSON für die Prüfseite.
- Rate-Limit auf Prüfcode-Abfragen (z. B. 60/min/IP), damit Codes nicht durchprobiert werden.

### A.8 Oberfläche

**Portal**
- Neuer Menüpunkt **Zertifikate**: Übersicht je Quest × Stufe mit Status (gesperrt / bereit / Wartefrist / bestanden) und Knopf „Prüfung starten“. Klar formulierte Regeln vor dem Start (Zeit, erlaubte Hilfsmittel, Versuche), Bestätigung „Ich lege die Prüfung selbständig ab“.
- „Prüfung unter Aufsicht beitreten“: Code-Eingabe.
- Nach Bestehen: Name für das Zertifikat eingeben (Vorschau live), Einwilligungs-Häkchen, „Zertifikat ausstellen“.
- „Meine Zertifikate“: Ansicht, PDF, Bild, Link kopieren, „Zu LinkedIn hinzufügen“, zurückziehen.

**Prüfungsmodus im Spiel** (in `app.js`, analog zum LIVE-Modul ein Modul `EXAM`, Aufruf `<quest>/?exam=ID`)
- Leiste oben: „PRÜFUNG · SCL Grundstufe“, Restzeit (rot unter 5 min), Aufgabennavigation 1…n + Theorie, Status je Aufgabe (offen / abgegeben / bestanden).
- Tipps, Musterlösung, Lösungsvergleich, Karte, Live-Challenge, Tour ausgeblendet; Handbuch sichtbar.
- „Testen“ läuft lokal mit den sichtbaren Beispiel-Tests; „Abgeben“ schickt an den Server und zeigt dessen Urteil.
- Abschlussbildschirm: Punkte je Teil, bestanden/nicht bestanden, bei Nichtbestehen Hinweis auf schwache Kapitel (Handbuchlinks) und nächsten möglichen Termin.
- Funktioniert in allen vier Quests (Editor-Varianten SCL/KOP/FUP/AWL, Profi mit Bausteinen).
- Offline-Datei (`index.html`, `kop.html` …): Zertifikate-Knopf zeigt „Nur online im Portal verfügbar“.

**Zertifikat (Design)**
- Querformat A4, dunkler Leitstand-Look mit hellem Druckbereich, Quest-Farbe und -Symbol, Name gross, „SCL – Grundstufe“, Datum, Punkte/Auszeichnung, Vermerk online/unter Aufsicht, Prüfcode, QR-Code auf `https://<host>/z/<code>`.
- Pflicht-Fusszeile: „Ausgestellt von SPS Quest. Kein Zertifikat der Siemens AG. SIMATIC, S7 und TIA Portal sind Marken der Siemens AG.“ Kein Siemens-Logo.
- PDF: Druckansicht mit `@page { size: A4 landscape }` → „Als PDF speichern“. Zusätzlich PNG (Canvas, 1600×1131) für Social Media.
- QR-Code: kleine MIT-Bibliothek (z. B. `qrcode-generator`) per npm, vom Build eingebettet – keine externen Aufrufe.
- LinkedIn: Knopf öffnet `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=…&organizationName=SPS%20Quest&issueYear=…&issueMonth=…&certUrl=…&certId=…` (nur Link, keine API).

**Prüfseite `/z/:code`**: gültig (grünes Siegel) / widerrufen / zurückgezogen / unbekannt; Name, Quest, Stufe, Datum, Auszeichnung, Prüfungsart, Prüfcode. Keine weiteren persönlichen Daten.

**Leitstand**: Karte „Prüfungen“: Sitzung anlegen, Beamer-taugliche Übersicht (Code gross, Teilnehmende, Fortschrittsbalken, Fokusverluste), Ergebnisse, Annullieren. In Klassenliste Spalte „Zertifikate“.

### A.9 Prüfungsinhalte

Pro Quest neue Dateien `dev/src/content*/exam.js`:

```js
defExamTask({
  id: 'x_scl_g_fuellstand', quest: 'scl', level: 'grund', topic: 'kap4',   // Kapitelbezug
  params: { MAX: [80, 85, 90, 95], MIN: [10, 15, 20] },                   // Auswahl per Seed
  title: 'Füllstandsüberwachung',
  brief: p => `Die Pumpe läuft, solange der Füllstand unter ${p.MIN} % liegt …`,
  vars: p => ({ Fuellstand: 0, Pumpe: false }),
  start: p => '',
  ref: p => `IF Fuellstand < ${p.MIN} THEN …`,
  visible: p => [ /* 2 Beispiel-Tests, im Browser sichtbar */ ],
  hidden:  p => [ /* ≥ 6 verdeckte Tests inkl. Grenzwerte */ ],
  wrong: [ /* typische Fehlversionen, müssen scheitern */ ]
});
defExamQuestion({ id: 'xq_scl_g_…', quest, level, topic, q, options, answer, param? });
```

Umfang (Pool je Quest und Stufe, damit genug gemischt wird):

| | Aufgaben im Pool | davon gezogen | Fragen im Pool | davon gezogen |
|---|---|---|---|---|
| Grundstufe | 18 (≥ 1 je Kapitel 1–10, schwerpunktmässig 4–10) | 6 | 40 | 12 |
| Profi-Stufe | 12 (≥ 2 je Kapitel 11–15) | 4 | 30 | 10 |

Total: 4 Quests × (18 + 12) = **120 Prüfungsaufgaben** und 4 × 70 = **280 Prüfungsfragen**. Ziehung: jede Prüfung deckt mindestens 5 verschiedene Kapitel ab; Schwierigkeitsmix fest (z. B. Grund: 2 leicht, 3 mittel, 1 schwer).

Schwierigkeit: vergleichbar mit normalen Kapitelaufgaben, **nicht** Boss-Niveau; Profi-Prüfungsaufgaben höchstens 2 editierbare Bausteine (CPU-Budget A.5).

**Validator** (`validate_exam.js`, von allen Quests genutzt), prüft für **jede** Parameterkombination (bzw. 50 zufällige bei grossen Räumen):
- Referenz besteht alle sichtbaren + verdeckten Tests, ist warnungsfrei.
- Startcode besteht nicht; jede `wrong`-Version scheitert an mind. einem verdeckten Test.
- Sichtbare Tests ⊂ nicht identisch mit verdeckten (verdeckte decken Grenzwerte ab).
- Text enthält keine unersetzten Platzhalter; IDs eindeutig; Poolgrössen und Kapitelabdeckung erfüllt.
- Laufzeit der Serverbewertung pro Aufgabe (Node) < 2 ms, sonst Warnung.
- Fragen: genau eine richtige Antwort (bei MC), Antwort im Optionsset, keine Dubletten zu Spiel-Theoriefragen (Textvergleich).

### A.10 Tests

- `tests/api.js` erweitern: Voraussetzungen, Start, Wartefrist, Deadline, falsche/richtige Abgabe, Manipulation (Punkte vom Client ignoriert, verdeckte Tests nie in Antwort), Aufsichts-Sitzung, Annullieren, Zertifikat ausstellen/zurückziehen/widerrufen, Prüfseite, Rate-Limit.
- `tests/exam_ui.js` (Playwright): je Quest eine Grund- und eine Profi-Prüfung mit Referenzlösungen durchspielen → bestanden → Zertifikat → Prüfseite gültig; eine absichtlich falsche Prüfung → nicht bestanden; Handy 390 px.
- `tests/cert_render.js`: PDF-Druckansicht und PNG erzeugen, QR-Code lesbar (mit `jsqr` o. ä. dekodieren) und zeigt auf `/z/<code>`.
- Worker-CPU-Messung als Skript `dev/bench_exam.js` (Ergebnis in STAND.md notieren).

### A.11 Pakete Teil A

| Paket | Inhalt | Fertig wenn |
|---|---|---|
| A1 | Konzept `docs/ZERTIFIKAT_KONZEPT.md` (Kurzfassung dieses Teils + Entscheidungen aus der Umsetzung) | Datei vorhanden |
| A2 | **Spike**: Engines im Worker, Bewertung einer Aufgabe, CPU/Bundle messen | Messwerte in STAND.md; Entscheidung Free reicht / Rückfrage an Steven |
| A3 | Format `defExamTask`/`defExamQuestion`, `validate_exam.js`, je Quest 3 Beispielaufgaben | Validator grün |
| A4 | Migration 6, `worker/exam.js`, `worker/cert.js`, API inkl. Rate-Limits | `tests/api.js` grün |
| A5 | Prüfungsmodus `EXAM` in `app.js` für alle 4 Editoren | Prüfung im Browser durchspielbar |
| A6 | Portal: Zertifikate-Seite, Ausstellen, Meine Zertifikate, Prüfseite `/z/:code`, PDF/PNG/QR/LinkedIn | `tests/exam_ui.js`, `tests/cert_render.js` grün |
| A7 | Leitstand: Prüfung unter Aufsicht, Ergebnisse, Annullieren; Admin: Widerruf | Tests grün |
| A8 | Inhalte: vollständige Pools (120 Aufgaben, 280 Fragen) | Validator 0 Fehler |
| A9 | Anleitungen (Lernende/Dozenten/Admin), Datenschutz-Vorlage (Zertifikatsname, Prüfseite), Handbuch-Hinweis, CLAUDE.md, STAND.md | Dokumente aktualisiert |

### A.12 Späteres Bezahlen (nur vorbereiten)

- Feature-Schalter `CERT_FEE` (Worker-Variable, Standard aus). Wenn an: Start einer Prüfung verlangt ein „Prüfungsguthaben“ (Tabelle `exam_credits`, vom Admin vergeben, z. B. für Schulen per Klasse). **Keine** Zahlungsanbindung bauen (Kostenregel).
- Im Portal ein unauffälliger Hinweis „Zertifikate sind in der Testphase kostenlos“.

---

## Teil B – Pikettdienst

### B.1 Ziel und Nutzen

Lernende übernehmen eine **Schicht als Instandhalter** an der Anlage ihrer Quest. Während die Anlage produziert, treten zufällig Störungen auf. Wer schnell die richtige Ursache findet und behebt, hält den Stillstand kurz. Trainiert echte Fehlersuche unter Zeitdruck – genau das, was Lehrbetriebe brauchen. Baut auf den 148 Störungsszenarien der Live-Challenge auf.

### B.2 Ablauf einer Schicht

1. Portal oder Quest → **Pikettdienst** → Schicht wählen:
   - **Tagschicht** (ca. 10 min, 2 Störungen, Hinweise verfügbar),
   - **Spätschicht** (ca. 15 min, 3–4 Störungen, weniger Hinweise),
   - **Nachtschicht** (ca. 20 min, 4–6 Störungen, bis zu 2 gleichzeitig offen, keine Hinweise, Hardware-Fehler häufiger).
   Freigeschaltet nach Rang (B.5). Nur Störungen aus Kapiteln, die die Person im Spiel abgeschlossen hat.
2. Die Anlage läuft in der Szene im Normalbetrieb (Animation, Produktionszähler, Uhr „Schichtzeit“ im Zeitraffer).
3. **Alarm**: Hupe/Signalton (abschaltbar), HMI-Meldung mit Nummer, Priorität und Klartext (z. B. „Störung 0417 · Prio 2 · Band 2: Teil nicht angekommen“), Anlage steht oder verhält sich falsch. Stillstandsuhr läuft, Ausfallkosten zählen hoch (z. B. „CHF 38/min“, je Anlage fest).
4. Lernende untersuchen: Programm öffnen (Code mit eingebautem Fehler bzw. korrektes Programm bei Hardware-Fehler), **Beobachten** mit Live-Werten, Variablenwerte, Meldungsverlauf.
5. **Diagnose** (Pflicht vor „Wieder anfahren“): Auswahl der Ursache aus einer Liste:
   - Programmfehler: Logik/Verknüpfung · Vergleich/Grenzwert · Zeit/Timer · Flanke/Zählen · Adressierung/Index/Datenbaustein · Reihenfolge/Zyklus
   - Hardware: Sensor defekt/verschmutzt · Drahtbruch · Aktor defekt · Not-Halt/Sicherheitskreis ausgelöst
   - Bedienung: falsche Betriebsart/Parameter am HMI
   + bei Hardware: betroffenes Bauteil wählen (Liste der Ein-/Ausgänge).
6. **Beheben**: Programmfehler → Code korrigieren; Hardware → „Instandhaltungsauftrag erstellen“ (Bauteil, kurze Beschreibung); Bedienung → Parameter am HMI korrigieren.
7. **Wieder anfahren**: Engine prüft (Programm besteht die Szenario-Tests / Hardware-Diagnose korrekt). Falsch → Fehlversuch, Stillstand läuft weiter, kurzer Hinweis („Anlage läuft wieder an … und bleibt erneut stehen“).
8. **Schichtbericht** am Ende: je Störung Ursache, Reaktionszeit, Stillstand, Fehlversuche, Hinweise; Summen: Verfügbarkeit %, mittlere Reparaturzeit (MTTR), Ausfallkosten, Punkte, Rang-Fortschritt. Optional ein Satz „Übergabe an die nächste Schicht“ (Freitext, max. 300 Zeichen, sieht der Dozent).

### B.3 Punkte

- Pro Störung: 1000 − 8 × Stillstandsekunden (min. 150) − 100 × Fehlversuch − 150 × Hinweis; richtige Ursachenkategorie +200; bei Hardware richtiges Bauteil +200.
- Schichtbonus: Verfügbarkeit ≥ 95 % → +500.
- Nicht behobene Störung bei Schichtende: 0 Punkte, zählt voll als Stillstand.

### B.4 Störungsarten und Inhalte

Neue Datei je Quest `dev/src/content*/pikett.js`:

```js
defIncident({
  id: 'pk_scl_band2_sensor', quest: 'scl', chapter: 8,
  kind: 'hardware',                           // program|hardware|operator
  base: 'c8_zaehlen',                         // Spielaufgabe, deren Referenz das Anlagenprogramm ist
  bug: null,                                  // bei kind:'program' → Verweis auf defBug-ID oder eigene Ersetzung
  force: { Teil_Erkannt: false },             // bei hardware: Eingang hängt fest (Sensor liefert immer 0)
  alarm: { no: '0417', prio: 2, text: 'Band 2: Teil nicht angekommen' },
  cause: 'hw_sensor', part: 'Teil_Erkannt',   // richtige Diagnose
  hints: ['Beobachte den Sensor, während ein Teil vorbeifährt.'],
  sceneFx: { belt2Running: false, faultActive: true }   // optionale Szenen-Effekte
});
```

- **Programmfehler**: alle bestehenden Störungsszenarien (`bugs.js` je Quest, 148 Stück) automatisch übernehmen, ergänzt um `alarm`, `cause` und `hints`. Wo die Ursachenkategorie nicht eindeutig ist, im Szenario festlegen.
- **Hardware-Fehler (neu)**: je Quest mind. 12 (Sensor hängt auf 0/1, Drahtbruch = Eingang 0 obwohl Aktor aktiv, Aktor ohne Wirkung = Rückmeldung bleibt aus, Not-Halt-Kette offen). Anlagenspezifisch: Seilbahn (Windmesser, Türkontakt), Stellwerk (Gleisfreimeldung, Weichenlage), Walzwerk (Temperaturfühler, Hydraulikdruck), Roboterzelle (Greifersensor, Lichtschranke).
- **Bedienfehler (neu)**: je Quest mind. 4 (Handbetrieb statt Automatik, falscher Rezept-/Sollwert).
- Minimum je Quest: 40 Störungen, davon ≥ 12 Hardware und ≥ 4 Bedienung, verteilt über Kapitel 1–15.

**Engine-Erweiterung „Forcen“**: Ein Eingang wird während der Tests/Simulation auf einen festen Wert gezwungen, egal was die Testfälle setzen. Umsetzung **einmal im SCL-Kern** (`engine.js` und `engine_pro.js`: Option `force` in den Test-/Session-Läufern), KOP/FUP/AWL erben es über ihre Übersetzung nach SCL. Keine Änderung am Verhalten ohne `force` (bestehende Tests müssen unverändert grün bleiben).

**Validator** (`validate_pikett.js` für alle Quests):
- program: Referenz besteht, Fehlerversion übersetzt und scheitert (wie heute bei Störungsjagd).
- hardware: Referenz **ohne** force besteht, Referenz **mit** force scheitert (Symptom sichtbar); geforcte Variable existiert und ist ein Eingang; `part` ist gültiges Bauteil.
- operator: Referenz mit falschem Parameter scheitert, mit richtigem besteht.
- Alarmnummern je Quest eindeutig, Texte vorhanden, `cause` aus der festen Liste, Kapitel gültig, Mindestanzahlen erfüllt.

### B.5 Ränge und Fortschritt

Pro Quest ein Pikett-Rang aus gesammelten Punkten:
1. Lehrling (Tagschicht) → 2. Monteur (ab 5 000, Spätschicht frei) → 3. Servicetechniker (ab 15 000, Nachtschicht frei) → 4. Pikettchef (ab 40 000 und 3 Nachtschichten mit Verfügbarkeit ≥ 90 %).
Abzeichen: „Erste Nacht überstanden“, „Null Stillstand“ (Schicht ohne Fehlversuch), „Hardware-Detektiv“ (10 Hardware-Fehler richtig), „Feuerwehr“ (Störung in < 60 s behoben).
**Pikett-Nachweis**: Rang „Pikettchef“ erscheint als Zusatzzeile auf dem Zertifikat der Profi-Stufe derselben Quest („Pikettbereit – Pikettchef-Rang erreicht am …“) und auf der Prüfseite.

### B.6 Daten und API

Migration 7:

```sql
CREATE TABLE IF NOT EXISTS pikett_shifts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest TEXT NOT NULL, shift TEXT NOT NULL,          -- tag|spaet|nacht
  started_at INTEGER NOT NULL, ended_at INTEGER,
  points INTEGER, availability REAL, mttr REAL, cost INTEGER,
  incidents TEXT,                                    -- JSON je Störung (id, Zeiten, Diagnose, Versuche, Hinweise, Punkte)
  handover TEXT                                      -- Übergabetext
);
CREATE INDEX IF NOT EXISTS idx_pikett_user ON pikett_shifts(user_id, quest);
```

- `POST /api/pikett/shifts` (Start: Server wählt Störungen + Zeitpunkte per Seed, passend zu abgeschlossenen Kapiteln), `POST /api/pikett/shifts/:id/end` (Bericht), `GET /api/pikett/me?quest=` (Rang, Punkte, Abzeichen), Dozent: `GET /api/classes/:id/pikett?quest=` (Tafel, Berichte).
- Bewertung im Browser genügt hier (Übungsmodus, kein Nachweis). **Ausnahme**: Für den Rang „Pikettchef“ (Zertifikatszusatz) zählen nur Nachtschichten, deren Behebungen der Server nachprüft (Code je Programmfehler mitsenden, Worker bewertet mit Szenario-Tests; Hardware-Diagnose serverseitig vergleichen). Gleiche CPU-Regeln wie A.5.
- Offline (Datei ohne Portal): Pikett spielbar, Rang nur lokal, Hinweis „Für Rangliste und Nachweis im Portal anmelden“.

### B.7 Oberfläche

- Neuer Einstieg in jeder Quest (Karte und Menü) und im Portal pro Tor: **Pikettdienst** mit Rang, Schichtwahl, letzter Bericht.
- Schichtbildschirm: Szene gross, darüber **Alarmleiste** (Meldungsliste mit Nummer, Prio-Farbe, Zeit, Status), rechts Kennzahlen (Schichtuhr, Stillstand, Ausfallkosten, Verfügbarkeit). Klick auf Meldung → Arbeitsansicht: Editor/Netzwerk/AWL mit Beobachten, Bauteilliste mit Live-Werten, Knöpfe „Diagnose“, „Instandhaltungsauftrag“, „Wieder anfahren“.
- Diagnose-Dialog wie oben (B.2 Schritt 5), Hardware mit Bauteilauswahl.
- Schichtbericht als Karte, druckbar; Dozent sieht ihn im Leitstand.
- Ton: Hupe/Signal über vorhandenes SFX-System, eigene Lautstärke, abschaltbar, respektiert „Ton aus“.
- Handy: Alarmleiste einklappbar, Arbeitsansicht als eigener Schritt; bei 390 px ohne horizontales Scrollen.

**Leitstand**: Karte „Pikett-Tafel“ je Klasse und Quest: Rang, Punkte, beste Verfügbarkeit, MTTR, letzte Schicht; Klick → Schichtberichte inkl. Übergabetext. Optional in der Live-Challenge ein dritter Modus **„Pikett-Challenge“** (alle bekommen dieselbe Schicht, Rangliste nach Punkten) – nur wenn Teil B sonst fertig ist.

### B.8 Tests

- Engine: neue Tests für `force` in `test_engine.js`, `test_pro.js`, `test_awl.js` (inkl. KOP/FUP über Übersetzung); alle bestehenden Tests unverändert grün.
- `validate_pikett.js` 0 Fehler für alle Quests.
- `tests/pikett_ui.js` (Playwright): je Quest eine Tagschicht mit fester Seed-Auswahl durchspielen (1 Programmfehler mit Referenzkorrektur, 1 Hardware-Diagnose), falsche Diagnose zählt als Fehlversuch, Bericht erscheint, Rang aktualisiert; Handy 390 px.
- `tests/api.js`: Schicht starten/beenden, Kapitel-Filter, Dozentensicht, Nachprüfung Nachtschicht.

### B.9 Pakete Teil B

| Paket | Inhalt | Fertig wenn |
|---|---|---|
| B1 | Konzept `docs/PIKETT_KONZEPT.md` (Kurzfassung + Alarmnummernkreise je Anlage) | Datei vorhanden |
| B2 | `force` in den Engines + Tests | alle Engine-Tests grün |
| B3 | Format `defIncident`, Übernahme der 148 Störungsszenarien (alarm/cause/hints), `validate_pikett.js` | Validator grün |
| B4 | Pikett-Modul `dev/src/pikett.js` (Schichtablauf, Zeitplan, Stillstand, Diagnose, Bericht, Punkte, Ränge lokal) für alle 4 Quests + Szenen-Effekte | Tagschicht in allen Quests spielbar |
| B5 | Hardware- und Bedienfehler-Inhalte (je Quest ≥ 12 + ≥ 4) | Validator: Mindestanzahlen erfüllt |
| B6 | Migration 7, API, Nachprüfung Nachtschicht, Leitstand-Tafel und Berichte | `tests/api.js` grün |
| B7 | Ränge/Abzeichen, Pikett-Nachweis auf Zertifikat und Prüfseite | `tests/pikett_ui.js` grün |
| B8 | Optional Pikett-Challenge; Anleitungen, Handbuchseite „Fehlersuche im Betrieb“ je Quest, CLAUDE.md, STAND.md | Dokumente aktualisiert |

---

## Gemeinsame Regeln für beide Teile

- Keine externen Dienste, keine Kosten, keine Zahlungsanbindung. Alles im Cloudflare-Gratis-Tarif; sonst Steven fragen.
- Keine echten Namen ausser dem freiwilligen Zertifikatsnamen. Keine Passwörter oder Namen in Code/Doku.
- Bestehende Spielstände und Inhalte bleiben kompatibel (keine ID-Änderungen an Aufgaben).
- Sprache: Deutsch, Schweizer Schreibweise (ss). ARIA-/Werkmeister-Ton beibehalten; Pikett-Meldungen im nüchternen Betriebston.
- Barrierefreiheit: Alarmfarben immer mit Symbol/Text (Farbsehhilfe), Tastaturbedienung der Dialoge.
- „Fertig“ je Paket: alle Validatoren 0 Fehler, alle Engine-/API-/UI-Tests grün, Browser-Durchläufe der vier Quests weiterhin grün, Workers-Build erfolgreich, Handy 390 px geprüft, STAND.md aktualisiert.

## Offene Punkte für Steven (nicht blockierend)

- Anzeigename der Dozenten auf Zertifikaten „unter Aufsicht“ (Vorschlag: vom Dozenten im Konto frei eingebbar, z. B. „S. Matzinger, Berufsfachschule“).
- Später: Preis pro Zertifikat bzw. Schulpaket (Schalter `CERT_FEE` ist vorbereitet).
- Impressum ausfüllen, bevor Zertifikate öffentlich beworben werden (Prüfseite verweist darauf).
