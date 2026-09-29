# SPS Quest / SCL Quest – Stand 29.09.2026

## SCL Quest v5 (Spiel) – gebaut und geprüft
- 15 Kapitel × 10 Aufgaben = 150 Aufgaben, 30 Theorie-Aufträge (150 Fragen). Grundstufe Kap. 1–10, Profi-Stufe Kap. 11–15.
- Auslieferung: eine eigenständige `index.html` (1,9 MB, offline) plus `web/` als PWA.
- Prüfung am 29.09.2026 (Projektkopie):
  - `node test_engine.js`: alle bestanden.
  - `node test_pro.js`: **277 bestanden, 0 fehlgeschlagen.** Der Test „STRING_TRUNC bei CONCAT mit Variable“ war veraltet. `STRING_TRUNC` gilt bewusst nur für Literale (siehe `CLAUDE.md`); der Test prüft jetzt, dass bei Variablen keine Warnung kommt.
  - `node validate.js`: OK, keine Fehler, 0 Warnungen.
  - Alle 150 Aufgaben-IDs sind in `index.html` enthalten.
- Nicht in dieser Projektkopie und daher nicht geprüft: Portal, Worker, Zertifikat, Live-Challenge, Sensorwerkstatt, KOP/FUP/AWL Quest.

## Klassentest 1 (29.09.2026) – Massnahmen
Massgeblich: `AUFTRAG_FEEDBACK1.md`. Reihenfolge: Paket 0 (Pikett entfernen) → 1 (Sensorwerkstatt-Editor, Ein-Bildschirm-Layout, Textdiät) → 2 (Speedrun, Beamer, Musik) → 3 (Avatare, Coins) → 4 (Kernpfad, Probebetrieb, geführte Sensorwerkstatt) → 5 (FUP nach TIA, PLC-Variablenfenster).

**Ist-Stand im SCL-Code (noch nichts umgesetzt):**

| Punkt | Messwert |
|---|---|
| Textdiät | Story Ø 26 Wörter, Auftrag Ø 34 Wörter. **110 von 150 Aufgaben** über dem Limit (Story ≤ 2 Sätze/35 Wörter, Auftrag ≤ 35 Wörter). Kap. 10–15 am längsten (Story + Auftrag 73–95 Wörter). Bericht: `dev/textdiaet_bericht.txt`, Prüfskript: `dev/validate_text.js`. |
| Kernpfad | 0 von 150 Aufgaben mit `core`/`extra` markiert. |
| Variablennamen im Auftrag | 147 von 150 Aufträgen nennen Variablen in `<code>`. Ziel: erst ab Aufgabe 3 weglassen. |
| „▶ Anlage testen“ | Nicht vorhanden. |
| PLC-Variablenfenster | Liste mit Klick-Einfügen vorhanden, aber ohne Adresse, Datentyp, Kommentar (nur Profi-Tabelle hat mehr). |

## Bereinigt am 29.09.2026
- Pikett ist überall als **entfernt** vermerkt (`Entscheidungen.md`, `PLAN_ZERTIFIKAT_PIKETT.md`, `SENSORWERKSTATT_PLAN.md`, `FEEDBACK_TEST1_LEITSTAND.md`).
- Avatar-Konzept vereinheitlicht: Tiere mit Accessoires (Paket 3 im Auftrag).
- `Entscheidungen.md` enthält die Nachträge vom 28. und 29.09. Sie müssen noch nach `docs/ENTSCHEIDUNGEN.md` im Repo.

## Offen
- Änderungen aus dieser Sitzung ins Repo übernehmen (`test_pro.js`, `validate_text.js`, Dokumente).
- Textdiät umsetzen: 110 Aufgaben kürzen, danach die Regeln in `validate.js` übernehmen (dann wieder 0 Warnungen).
- Feldtest Kap. 11–15 mit Lernenden.
- Markenrecht prüfen.
- TIA-Export-Abgleich entfällt, weil der Export laut Entscheidung ausgebaut wird.
