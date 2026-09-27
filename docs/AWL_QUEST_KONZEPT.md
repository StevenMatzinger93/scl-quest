# AWL Quest – Konzept

## Geschichte

ARIA ist aus dem Stellwerk geflohen — in den Keller unter der Fabrikhalle. Dort steht das **alte Walzwerk**: ein Rollgang,
ein Stossofen, zwei Walzgerüste, eine Schere und ein Kühlbett. Gesteuert von einer **S7-300**, die seit zwanzig Jahren
niemand angefasst hat. Ihr Programm ist in **AWL** (Anweisungsliste) geschrieben. Der Werkmeister holt den alten
Walzmeister **Herrn Brunner** aus dem Ruhestand: „Das Programm liest man Zeile für Zeile. Und bei jeder Zeile weisst du,
was im VKE und in den Akkus steht.“

**Hinweis im Spiel (Pflicht):** AWL läuft nur auf S7-300/400 und (eingeschränkt) auf der S7-1500. Die **S7-1200 kann kein
AWL** — bei Umbauten wird AWL-Code nach SCL, KOP oder FUP übertragen. Wer AWL lesen kann, kann alte Anlagen warten und migrieren.

## Lehrplan (15 Kapitel, je Theorie A → Aufgaben 1–5 → Theorie B → Aufgaben 6–10)

| Kap. | Thema | Inhalte |
|---|---|---|
| 1 | Erste Anweisungen | `U`, `=`, Zeile für Zeile, VKE, Erstabfrage, Statusanzeige |
| 2 | Verknüpfungen | `UN`, `O`, `ON`, `X`, `XN`, `O` ohne Operand („UND vor ODER“), Klammern `U(` … `)` |
| 3 | Speichern | `S`, `R`, Selbsthaltung, Vorrang durch Reihenfolge, `NOT`, `SET`, `CLR` |
| 4 | Flanken | `FP`, `FN` mit Flankenmerker, Impulse, Stromstoss |
| 5 | Zeiten | S5-Zeiten `SE`, `SA`, `SI`, `SV`, `L S5T#…`, Abfrage `U T1` |
| 6 | Zähler | `ZV`, `ZR`, `S Z` (Vorbelegen), `R Z`, `L Z`, `U Z` |
| 7 | Laden und Transferieren | `L`, `T`, AKKU1/AKKU2, `TAK`, Konstanten |
| 8 | Rechnen | `+I -I *I /I`, `MOD`, `+R -R *R /R`, `ITD`, `DTR`, `RND`, `TRUNC`, `NEGI`, `INC`/`DEC` |
| 9 | Vergleichen | `==I <>I >I <I >=I <=I`, `…R`, Vergleich in Klammern mit Bits verknüpfen |
| 10 | Sprünge | `SPA`, `SPB`, `SPBN`, Sprungmarken, `BEA`, `BEB`, `LOOP`; Final Boss 1 |
| 11 | Bausteine (Profi) | FC mit AWL-Rumpf, `CALL`, Parameter, `RET_VAL`, Temp (`#`) |
| 12 | Funktionsbausteine | FB, Instanz-DB, `CALL "FB", "FB_DB"`, IEC-Zeiten als Multiinstanz `CALL #T` |
| 13 | Daten | Globale DBs, `"DB".Wert`, PLC-Datentyp, Arrays |
| 14 | Standardbausteine | Walzgerüst, Rollgang, Ofen, Meldung als Standard-FBs |
| 15 | Das Walzwerksprogramm | OB1/OB100, Programmstruktur, warnungsfrei, Migration; Final Boss 2 |

## Anlage (Szene `scene_walzwerk.js`)

Rollgang mit Walzblock (glühend, Position), Stossofen (Tür, Temperatur), zwei Walzgerüste (Walzen drehen, Walzspalt),
Schere, Kühlbett, Wasser (Kühlung), Hydraulikdruck, Leitstand-Lampen, Hupe, Anzeigen — und das S7-300-Rack mit RUN/STOP/SF-LEDs.

## Editor

- Textbasierter AWL-Editor (Zeilen), Hervorhebung der Anweisungen, Sprungmarken und Operanden.
- **Status wie im TIA Portal:** Neben jeder Zeile die Spalten **VKE**, **AKKU1**, **AKKU2** des letzten Zyklus (aus dem Test).
  Nicht bearbeitete Zeilen (übersprungen) bleiben leer.
- Symbolleiste auf dem Handy mit `U`, `UN`, `O`, `=`, `S`, `R`, `L`, `T`, `(`, `)`.

## Technik

- `dev/src/awl.js`: Zerlegen und **zeilentreue Übersetzung nach SCL**. VKE, Erstabfrage und ODER-Zweig werden statisch
  verfolgt (Hilfsvariablen `_qv`, `_qo` je Klammerebene), Akkus als typisierte Hilfsvariablen (Ganzzahl/REAL/Zeit).
  Sprünge werden als `WHILE`/`CASE`-Verteiler übersetzt (ein Fall je Abschnitt zwischen Marken/Sprüngen).
  Status je Zeile in `_q<Zeile>v/a/b`. Tests: `node test_awl.js`.
- Semantik: `==I` usw. setzen das VKE neu (nicht mit dem vorherigen verknüpft) — wie die S7-300; kombinieren mit `U( … )`.
  S5-Zeiten → TON/TOF/TP (SI = Impuls, endet mit dem Eingang), S5-Zähler 0…999.
- Grundstufe: `AWL.wrapEngine(SCLEngine)` (Aufgaben mit `lang:'awl'`). Profi: `AWL.wrapPro(SCLPro)` — Bausteine mit
  SCL-Deklaration + AWL-Rumpf, `CALL` mit Parameterzeilen. S5-Zeiten/-Zähler nur in der Grundstufe.
- Quest-Konfiguration `awl` in `build.js` → `awl.html`, `web/awl/`; Portal-Tor AWL, Leitstand, Live-Challenge.
