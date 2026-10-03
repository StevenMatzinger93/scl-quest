# Auftrag: „Funktion zählt“ + FUP-Werkbank überall (Plan, 03.10.2026)

**Ziel (Steven):** Programmieren soll überall frei sein. Es gibt viele Wege – am Ende zählt nur, ob die Ausgänge stimmen.
Beispiel: Ausgang = A UND B UND C – eine &-Box mit 3 Eingängen oder zwei &-Boxen ist gleich richtig. Das gilt in **allen Quests**
(SCL, KOP, FUP, AWL, Sensorwerkstatt), in Live-Challenge, Störungsjagd und **Prüfung**. Danach kommt der neue FUP-Editor überall hin.

## 1. Ist-Zustand (geprüft am 03.10.2026)

Bewertet wird heute in zwei Teilen: **Testfälle** (Ausgänge) **plus Pflicht-Bausteine** (`mustUse` / `must`, bei Profi auch `warnFree`).
Fehlt ein Pflicht-Baustein, gilt die Aufgabe als nicht gelöst – auch wenn die Funktion stimmt.

| Quest | Grundstufe mit Pflicht-Bausteinen | Profi mit `must` | Profi mit `warnFree` | Störungsjagd-Aufgaben |
|---|---|---|---|---|
| SCL | 58 / 100 | 40 / 50 | 25 | 30 |
| KOP | 94 / 100 | 50 / 50 | 5 | 33 |
| FUP | 100 / 100 | 50 / 50 | 5 | 35 |
| AWL | 100 / 100 | 50 / 50 | 5 | 32 |

Prüfungspools: `must` in allen vier `content*/exam.js` (Punktabzug).

Testabdeckung der Grundstufe (Hand-Testfälle):

| Quest | rein logisch (ohne Zeit) | davon alle Eingangskombinationen getestet | mit Zahlen-Eingängen | zeitabhängig (Timer, Zähler, Speicher, Flanken) |
|---|---|---|---|---|
| SCL | 70 | 9 | 48 | 30 |
| KOP | 31 | 24 | 5 | 69 |
| FUP | 35 | 21 | 7 | 65 |
| AWL | 55 | 24 | 30 | 45 |

→ Wer die Bausteinpflicht einfach streicht, lässt halb richtige Lösungen durch. **Erst die Tests vollständig machen, dann die Pflicht lockern.**

Weitere Bremsen der Freiheit:
- Textformat KOP/FUP (`kop.js`): eine Kette je Netzwerk, Eingänge R1/PT/PV/R/LD nur mit Operand, keine Negation hinter Zeit-/Zähler-/Flankenbox, höchstens eine Zeit-/Zählerbox je &-Box (siehe `docs/FUP_WERKBANK_F0.md`).
- Aufgabentexte und Hinweise schreiben teils einen Weg vor („Nutze eine SR-Box“).
- Stellen, die `mustUse` auswerten: `app.js` (Prüfen Grundstufe, Schnellspur-Ähnlichkeit), `content/_helpers.js` (`ProTask.check` Profi),
  `exam_core.js` (`gradeGrund`, `gradePro`, `checkGameTask` für die Garderobe), Validatoren (`validate*.js`), `tests/kernpfad.js`.
  Die Sensorwerkstatt hat keine Pflicht-Bausteine (prüft Programme schon nur über Tags).

## 2. Grundsätze (in `docs/ENTSCHEIDUNGEN.md` übernehmen)

1. **Bewertet wird nur das Verhalten der Ausgänge**, die die Aufgabe nennt. Eigene Merker, Hilfsvariablen, Netzwerkaufteilung, Reihenfolge der Eingänge, Boxwahl sind frei.
2. **Pflicht-Bausteine werden zu Lernhinweisen:** nach dem Lösen „Gelöst! Übrigens: …“ (kein Abzug, keine Sterne weniger, gilt auch in der Prüfung).
3. **Was bleibt Pflicht:** nur, was zur *Funktion* gehört – in der Profi-Stufe der Name und die Schnittstelle eines Bausteins, den die Aufgabe aufruft
   (die Unit-Tests rufen `FB_Motor` mit seinen Ein-/Ausgängen auf – das ist die Spezifikation), sowie Kompilierbarkeit.
   Programmierstandard-Warnungen (`warnFree`) werden Hinweise.
4. **Vergleichsmassstab ist die Musterlösung** – aber nur dort, wo die Aufgabe das Verhalten eindeutig festlegt. Wo mehrere Verhalten richtig sind
   (z. B. ein Zyklus früher/später, Zustand vor dem ersten Ereignis), wird nicht verglichen oder der Aufgabentext präzisiert.
5. **Fehlermeldung = Gegenbeispiel:** „Bei Taste_A = 1, Taste_B = 1, Not_Aus = 0 sollte Signal_A 0 sein, ist aber 1.“

## 3. Etappen

Jede Etappe: eigener Zweig, alle Validatoren und Tests grün, kurzer Bericht + `docs/STAND.md`, Merge nach `main` erst nach Stevens „OK“.

### V0 – Werkzeug: Funktionsvergleich (rein, Node-testbar)
- Neues Modul `dev/src/equiv.js` (`SPSQEquiv`): erzeugt aus Aufgabe + Musterlösung zusätzliche Testfälle („Orakel“):
  - **Logik ohne Zeit:** alle Kombinationen der Bool-Eingänge (bis 10 Eingänge = 1024; darüber gezielte Auswahl: jede Einzeländerung + Zufall, Seed fest).
  - **Zahlen-Eingänge:** Werte aus den Hand-Tests, ihre Nachbarn (±1, ±0,1), Grenzen aus dem Aufgabentext/den Vergleichern der Musterlösung, 0, negative Werte nur wenn erlaubt.
  - **Zeitabhängig:** die Hand-Abläufe plus feste Zufallsabläufe (Eingänge wechseln, Pausen kurz und lang, „lange genug warten“-Schritte), verglichen nur an **stabilen Prüfpunkten** (nach dem letzten Wechsel mindestens 2 Zyklen bzw. Zeit > längste Zeitkonstante).
  - **Profi:** dasselbe über die Schnittstelle der aufgerufenen Bausteine (`unit`) und über die globalen Ein-/Ausgänge (`tests`/`timed`).
- **Zur Build-Zeit** werden die Ausgänge der Musterlösung berechnet und als Testfälle abgelegt (`t.autoTests`): im Spiel, im Worker (Prüfung) und im Validator wird nur noch getestet, die Musterlösung läuft zur Laufzeit nie mit. Kosten zur Laufzeit wie heute plus mehr Fälle → Zeitbudget messen.
- Test: `node test_equiv.js` (Generator deterministisch, Prüfpunkte, Gegenbeispiel-Text).

### V1 – Freiheit absichern: Alternativ- und Mutanten-Prüfung im Validator
- **Alternativlösungen:** je Aufgabe automatisch erzeugte andere Wege, die bestehen *müssen*:
  KOP/FUP über Graph-Umformungen (&(3) ⇄ &(2)+&(2), SR ⇄ S/R-Spulen, De Morgan, Eingänge vertauschen, Netzwerk teilen mit Merker);
  SCL über Ausdrucks-Umformungen (IF ⇄ Zuweisung, Klammern, Reihenfolge); AWL über U/O-Varianten. Dazu von Hand `alt: [...]` für Sonderfälle.
- **Mutanten:** kleine Fehler an der Musterlösung (Negation weg, & ↔ >=1, Zeit falsch, Vergleich `>` ↔ `>=`, Zähler ohne Flanke …) müssen *durchfallen*,
  sonst sind die Tests zu schwach → Validator meldet die Aufgabe.
- **Mehrdeutigkeit:** Fallen Alternativen durch, obwohl sie dem Aufgabentext genügen, wird die Aufgabe gemeldet → Text präzisieren oder Prüfpunkt lockern.
- Ergebnis: Liste „Aufgaben mit Klärungsbedarf“ für Steven (erwartet: einige Dutzend, v. a. zeitabhängige).

### V2 – Inhalte durcharbeiten (alle vier Quests, 600 Aufgaben + Prüfungspools)
- Je Quest die Validator-Meldungen aus V1 abarbeiten: Texte präzisieren, Prüfpunkte setzen, fehlende Fälle ergänzen.
- Aufgabentexte und Hinweise: „Nutze eine SR-Box“ → „z. B. mit einer SR-Box“; Lernziel bleibt (`learn`), Pflichtwörter wandern in `hintAfter` („Übrigens: …“).
- `check_briefs.js` erweitert: Briefs dürfen keinen Baustein vorschreiben (Warnung, `--strict` Fehler).
- Prüfungspools (`content*/exam.js`): gleiche Behandlung, `must` → Hinweis; `node validate_exam.js --full` + Zeitmessung (`bench_exam.js --alle`, Ziel warm < 5 ms trotz mehr Fällen).
- Reihenfolge: FUP → KOP → AWL → SCL (FUP zuerst, weil der neue Editor folgt).

### V3 – Bewertung umstellen (überall gleich)
- `app.js`: Prüfen ohne Pflicht-Bausteine; nach Erfolg Lernhinweis-Karte; Fehlertext mit Gegenbeispiel; Diagnose („Mögliche Ursache“) nutzt den fehlgeschlagenen Auto-Test.
- `content/_helpers.js` `ProTask.check`: `must`/`warnFree` nur noch als Hinweise; Schnittstelle der getesteten Bausteine bleibt Pflicht (klare Meldung, wenn sie fehlt).
- `exam_core.js`: `gradeGrund`/`gradePro` ohne `must`-Abzug, mit Auto-Tests; `checkGameTask` (Garderobe, Final Boss) ebenso.
- Live-Challenge/Störungsjagd: nutzen dieselbe Prüfung im Spiel (nichts Eigenes); Störungsjagd: jede Lösung, die die Funktion herstellt, zählt.
- Sensorwerkstatt: Programm-Schritte bekommen ebenfalls Auto-Tests über die Tags (Verdrahtung/Konfiguration bleiben Regelprüfungen – die sind schon funktional).
- Schnellspur: Ähnlichkeit über `topics` statt `mustUse` (Feld umbenennen, Inhalt bleibt).
- Alte Spielstände: unverändert gültig (bisher Gelöstes bleibt gelöst).

### V3b – Tipps mit Lösungsvorschlag (Entscheid Steven 03.10.2026)
Heute: Hinweis 1 (Text), Hinweis 2 (Text oder „Die Musterlösung nutzt …“), Hinweis 3 (wie 2 + Handbuch), danach nach 3 Fehlversuchen „Lösung zeigen“ (lädt die Musterlösung, keine Punkte/Sterne).
Neu – die Hinweise führen bis zu einem **Lösungsvorschlag**, der als *ein möglicher Weg* gekennzeichnet ist:

| Stufe | Inhalt | Kosten (wie heute) |
|---|---|---|
| Tipp 1 – Denkanstoss | Was soll passieren? (heutiger `hint`) | −10 Punkte, wie bisher für die Sterne gezählt |
| Tipp 2 – Weg in Worten | „Zum Beispiel mit einer SR-Box: Setzen mit …, Rücksetzen mit …“ (heutiger `hint2` / Bausteine der Musterlösung, als „z. B.“) | −10 |
| Tipp 3 – Lösungsvorschlag | Gerüst der Musterlösung: alle Boxen/Anweisungen und Verbindungen, die Operanden als Lücken `<??.?>` (SCL/AWL: Zeilen mit Lücken). Nur ansehen, nicht in den Editor geladen. Hinweis: „Das ist ein möglicher Weg – andere sind genauso richtig.“ | −10 |
| Lösung zeigen | ganze Musterlösung (wie heute: erst nach 3 Fehlversuchen, keine Punkte/Sterne) | wie heute |

- Grafisch in KOP/FUP (Werkbank im Nur-Lese-Modus bzw. heutige Darstellung), sonst als Code mit markierten Lücken.
- Live-Challenge: Tipp 3 erlaubt (kostet wie ein Tipp, −100), die ganze Lösung weiterhin nicht. Prüfung: keine Tipps (wie heute).
- Lückentext wird aus der Musterlösung erzeugt (Operanden, Zahlen, Zeiten ersetzt; Struktur bleibt) – kein Handaufwand je Aufgabe; der Validator prüft, dass das Gerüst die Lösung nicht verrät (mindestens die Hälfte der Operanden offen).

### V4 – Editor ohne Grenzen (Textformat KOP/FUP erweitern) — erledigt 03.10.2026
- `kop.js` so erweitern, dass jede in der Werkbank zeichenbare Schaltung gespeichert und ausgeführt werden kann: mehrere Ketten je Netzwerk,
  Drähte an R/R1/LD-Eingänge, Negation hinter Boxen, mehrere Zeit-/Zählerboxen an einer &-Box, Abzweig in mehrere Boxen ohne Verdoppeln.
- Abwärtskompatibel: jeder heutige Text bleibt gültig und gleichbedeutend (Rundreise-Test über alle 600 Aufgaben + Störungsjagd + Theorie).
- Gilt auch für den KOP-Editor (gleiches Format); `kop_editor.js` bekommt nur, was zum Darstellen nötig ist.
- Tests: `test_fup_graph.js` (Rundreise 100 %), neue Fälle in `test_engine.js`, `validate_kop.js` / `validate_kop.js fup`.

### V5 – FUP-Werkbank überall einbauen (ersetzt F5/F6 aus `AUFTRAG_FUP_LIVE_AVATARE.md`) — erledigt 03.10.2026 (R7: alter FUP-Teil von `kop_editor.js` bleibt als Rückfall `?werkbank=0` bis nach dem Klassentest)
| Schritt | Inhalt |
|---|---|
| R0 | `main` in `fup-werkbank` holen, dunkles Farbschema, alte Entwürfe ohne `// @fup` automatisch anordnen |
| R1 | FUP Quest Grundstufe hinter `?werkbank=1`: Grafik/Text-Umschalter, PLC-Variablen, Prüfen mit Gegenbeispiel, Fehlermarken, Schnellkorrekturen, „▶ Anlage testen“, Ablauf-Animation, Tour |
| R2 | Profi-Stufe: Bausteinkopf, `#lokal`, Aufrufe als Boxen, Multi-Instanzen, Deklarationstabelle |
| R3 | Nur-Lese-Darstellung (Theorie, Handbuch, Lösungsvergleich, Beobachten, „Lösung zeigen“) |
| R4 | Live-Challenge, Sudden Death, Störungsjagd, Vorspann-Hinweise, Prüfung FUP |
| R5 | Portal: Leitstand-Lösungsansicht, Beamer „Lösung zeigen“ |
| R6 | Sensorwerkstatt: FUP im Laptop |
| R7 | Standard schalten (`?werkbank=0` noch einen Klassentest lang), alten FUP-Teil von `kop_editor.js` aufräumen, Doku |

### V6 – Abnahme
- Checkliste in `docs/TESTPLAN.md`: je Quest 3 Aufgaben bewusst anders lösen (z. B. FUP &(3) als 2× &, SR als S/R, KOP Selbsthaltung als Set/Reset,
  AWL mit O( statt Merker, SCL mit IF statt Zuweisung) → alle gelöst mit Lernhinweis; 3 halb richtige Lösungen → abgelehnt mit verständlichem Gegenbeispiel.
- Prüfung FUP Grundstufe mit einer „anderen“ Lösung → volle Punkte.
- Klassentest.

## 4. Reihenfolge und Aufwand (Schätzung)

| Etappe | Abhängig von | Umfang |
|---|---|---|
| V0 Funktionsvergleich | – | mittel |
| V1 Alternativen/Mutanten | V0 | mittel |
| V2 Inhalte (4 Quests + Prüfungen) | V1 | gross (meiste Arbeit, je Quest ein Teilschritt) |
| V3 Bewertung umstellen | V0, V2 der jeweiligen Quest | klein–mittel |
| V4 Textformat erweitern | – (parallel zu V0–V2 möglich) | mittel |
| V5 FUP-Werkbank R0–R7 | V3 (FUP), V4 | gross |
| V6 Abnahme | alles | klein |

Freischaltung quest-weise: FUP zuerst komplett (V2-FUP → V3 → V5), dann KOP, AWL, SCL.

## 5. Risiken

- **Zeitabhängige Aufgaben sind mehrdeutig** (Netzwerkreihenfolge = ein Zyklus später, Startzustand). Gegenmittel: Prüfpunkte nur in stabilen Zuständen, Mehrdeutigkeit wird vom Validator gemeldet statt still entschieden.
- **Mehr Testfälle = mehr Rechenzeit** (Prüfung im Worker, 10 ms CPU). Gegenmittel: Fälle zur Build-Zeit berechnen, Anzahl begrenzen, `bench_exam.js` als Wächter.
- **Lerneffekt:** Ohne Pflicht lernt man einen Baustein evtl. nicht. Gegenmittel: Lernhinweis nach dem Lösen, Theorie und Handbuch unverändert, im Leitstand sichtbar, welchen Weg jemand gewählt hat.
- **Alte Spielstände:** bleiben gültig; Gelöstes wird nie aberkannt.

## 6. Entscheide (Steven, 03.10.2026)

1. Der Leitstand zeigt der Lehrperson, welchen Weg jemand gewählt hat (z. B. „SR-Box“ / „S/R-Spulen“): **ja**.
2. Sterne bleiben wie heute (Fehlversuche, Tipps): **ja**.
3. Zusätzliche Ausgänge, die die Aufgabe nicht nennt, sind erlaubt, solange die genannten stimmen (Ausnahme: Sicherheits-Ausgänge, die die Aufgabe ausdrücklich „aus“ verlangt): **ja**.
4. Die Tipps führen bis zu einem Lösungsvorschlag (V3b): **ja**.
