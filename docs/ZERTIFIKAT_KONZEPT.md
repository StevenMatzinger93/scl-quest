# Zertifikat mit Prüfung – Konzept (Kurzfassung)

> **Hinweis 29.09.2026:** Die Zeile „Pikettbereit“ auf dem Zertifikat entfällt (Pikettdienst entfernt).

Grundlage: `docs/PLAN_ZERTIFIKAT_PIKETT.md`, Teil A (verbindlich). Diese Datei fasst ihn zusammen und hält die Entscheidungen aus der Umsetzung fest.

## Idee
Pro Quest (SCL, KOP, FUP, AWL) und Stufe (Grundstufe, Profi-Stufe) gibt es eine echte Prüfung, also 8 Zertifikatsarten. Wer besteht, erhält ein Zertifikat mit Prüfcode `SPSQ-XXXX-XXXX` und QR-Code. Jede Person kann die Echtheit ohne Login unter `/z/<Prüfcode>` prüfen.

## Regeln
| | Grundstufe | Profi-Stufe |
|---|---|---|
| Voraussetzung | 80 % der Spielaufgaben Kap. 1–10 + Final Boss | Grundstufen-Zertifikat + 80 % Kap. 11–15 + Final Boss 2 |
| Inhalt | 6 Aufgaben (2 leicht, 3 mittel, 1 schwer) + 12 Fragen | 4 Aufgaben (1/2/1) + 10 Fragen |
| Zeit | 60 min | 90 min |

- Bestanden ab 70 % der Punkte, mit Auszeichnung ab 90 %. Gewichtung: Aufgaben 70 %, Theorie 30 %.
- Pro Zertifikatsart ist ein Versuch pro 24 h möglich, höchstens 3 in 30 Tagen.
- Bewertung einer Aufgabe:
  - alle verdeckten Tests grün = 1;
  - sonst 0,6 × Anteil der bestandenen Fälle;
  - Kompilierfehler = 0.
  - Fehlt ein Pflichtkonstrukt (`must`) oder tritt eine verbotene Warnung auf, gibt es keine volle Punktzahl.
- Jede Prüfung deckt mindestens 5 Kapitel ab.
- Erlaubt sind Handbuch und Glossar sowie lokales Testen mit den sichtbaren Beispiel-Tests.
- Gesperrt sind Hinweise, Musterlösung, Lösungsvergleich, Karte, Live-Challenge und Tour.

## Fälschungssicherheit
- Der Server zieht die Aufgaben: Ein Seed pro Prüfung bestimmt die Auswahl und die Parameter (Grenzwerte, Zeiten, Anzahlen).
- Der Browser bekommt nur `publicItem()`: Text, Deklarationen, Startcode und sichtbare Tests. Referenz, verdeckte Tests und Fehlversionen bleiben auf dem Server. `tests/exam_api.js` und der Validator prüfen das.
- Der Worker bewertet jede Abgabe mit denselben Engines wie das Spiel.
  - Das Bundle `worker/gen/exam_bundle.js` wird von `dev/build.js` erzeugt.
  - Es enthält nur Engines, `exam_core.js` und die Prüfungspools, nicht die 600 Spielaufgaben.
  - Grösse etwa 330 KB bei den Beispielpools; der Worker bleibt deutlich unter 3 MB.
- Punkte vom Browser werden ignoriert.
- Theoriefragen: Die Antworten werden sofort gespeichert, aber erst beim Abschluss bewertet (keine Rückmeldung, also kein Durchprobieren).
- Zeit: `started_at` und `deadline` führt der Server, dazu 30 s Kulanz. Nach Ablauf wird automatisch mit den bisherigen Abgaben abgeschlossen.
- Grenzen:
  - Code höchstens 20 KB;
  - höchstens 20 000 Schleifendurchläufe pro Testfall (`root.SCL_MAX_ITER`; ohne Setzen bleibt das Spielverhalten unverändert);
  - höchstens 2 editierbare Bausteine pro Profi-Aufgabe.

## Spike A2 – CPU im Gratis-Tarif (Messung in Node/V8)
| Messung | Wert |
|---|---|
| Bundle-Import (Kaltstart) | ≈ 16 ms Startzeit, nicht CPU pro Anfrage |
| Bewertung einer Aufgabe, warm | 0,2–1,7 ms, Profi (AWL-FC mit Sprüngen) bis 2,9 ms |
| Bewertung, allererster Aufruf eines Aufgabentyps (kalte JIT) | bis ≈ 10 ms |

Entscheidung: Der **Gratis-Tarif reicht**. Eine Rückfrage zu Workers Paid ist nicht nötig.
- Pro Anfrage wird genau eine Aufgabe bewertet. Der Validator warnt ab 2 ms warm.
- Beim Start des Isolats bewertet `worker/exam.js` je Quest und Stufe eine Referenz. Das wärmt die JIT auf und zählt zur Startzeit, nicht zum CPU-Budget einer Anfrage.
- Die Abgabe wird **vor** der Bewertung in D1 gespeichert.
- Überschreitet ein kalter Erstaufruf das Limit (Fehler 1102), wiederholt der Browser die Abgabe automatisch (bis zu 3×, dann ist die Instanz warm).
- `submit` meldet noch unbewertete Abgaben als `pending`, der Browser bewertet sie nach.
- Nachmessen im Betrieb: Cloudflare-Dashboard → Worker `scl-quest` → Observability → CPU-Zeit pro Aufruf.

## Umsetzung
- `dev/src/exam_core.js`: Format `defExamTask`/`defExamQuestion`, Ziehung, Parameter, öffentliche Sicht, Bewertung und Gesamtpunkte. Wird im Browser, im Validator und im Worker genutzt.
- Pools in `dev/src/content*/exam.js`. Der Validator `dev/validate_exam.js [--quest=x] [--full]` prüft je Parameterkombination:
  - die Referenz besteht und ist warnungsfrei;
  - Startcode und Fehlversionen scheitern;
  - die verdeckten Tests weichen von den sichtbaren ab, und es gibt mindestens 6 verdeckte Prüfschritte;
  - es gibt keine Platzhalter und keine Dubletten zu Spiel-Theoriefragen;
  - Poolgrössen, Kapitelabdeckung und Schwierigkeitsmix stimmen;
  - die Bewertungszeit bleibt im Budget.
- Worker:
  - `worker/exam.js`: Voraussetzungen, Start, Abgaben, Fokus, Abschluss, Aufsichts-Sitzungen, Annullieren.
  - `worker/cert.js`: Ausstellen, Zurückziehen, Widerruf, Klassen-/Admin-Sicht, Prüfseite `/z/:code` mit Open Graph, Rate-Limit 60/min/IP.
  - Migration 6: `exams`, `exam_answers`, `exam_sessions`, `certificates`, `exam_credits` sowie `users.display_name`.
- Spiel: Das Modul `EXAM` in `app.js` (`<quest>/?exam=ID`) enthält die Prüfungsleiste mit Restzeit, Aufgabennavigation und Status sowie Abgeben, Theorie, Abschliessen und Ergebnis mit schwachen Kapiteln.
  - Es funktioniert mit allen vier Editoren.
  - Die Offline-Dateien zeigen den Hinweis „nur online im Portal“.
- Portal:
  - `portal_zertifikate.js` (Lernende): Übersicht, Start, Beitritt per Code, Ausstellen mit Einwilligung, Zertifikatsansicht, Druck/PDF (A4 quer), PNG 1600×1131, QR (`qrcode-generator`, MIT, eingebettet), Link kopieren, LinkedIn-Link, Zurückziehen.
  - `portal_pruefung.js` (Dozent und Admin): Prüfung unter Aufsicht mit beamertauglicher Übersicht, Zertifikate in der Klassenansicht, Widerruf und Anzeigename.

## Entscheidungen aus der Umsetzung
- **Unter Aufsicht** entfällt die Spiel-Voraussetzung, weil die Lehrperson über die Zulassung entscheidet. Die Wartefristen und die Reihenfolge Grundstufe → Profi bleiben.
- Beitritt nur mit dem 6-stelligen Code; Quest und Stufe kommen aus der Sitzung. Das Zeitfenster der Sitzung begrenzt die Prüfungszeit zusätzlich.
- **Annullieren** widerruft ein bereits ausgestelltes Zertifikat automatisch.
- **Zurückziehen** durch den Inhaber löscht den Namen. Die Prüfseite zeigt danach nur noch „zurückgezogen“.
- **Konto löschen**: Die Zertifikate bleiben ohne Kontobezug prüfbar, ausser der Inhaber wählt „Zertifikate mitlöschen“.
- **Anzeigename** für „unter Aufsicht bei …“ stellen Dozierende unter *Konto* ein, zum Beispiel „S. Muster, Berufsfachschule“. Ohne Eintrag erscheint der Benutzername.
- `CERT_FEE=1` (Worker-Variable) verlangt ein Prüfungsguthaben (`exam_credits`, vom Admin per API vergeben). Standard ist aus, eine Zahlungsanbindung gibt es nicht.
- Lokale Tests laufen mit `EXAM_DEV=1` in `.dev.vars`, solange Pools unvollständig sind. Das hebt nur die Poolgrössen-Sperre auf.
