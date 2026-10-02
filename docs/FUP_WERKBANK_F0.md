# FUP-Werkbank F0 – Spike und Rundreise (Bericht, 02.10.2026)

Zweig `fup-werkbank`, Tag `fup-F0`. Abnahme F0: nur diesen Bericht lesen.

## Was gebaut ist

- `dev/src/fup_graph.js` (`window.FUPGraph`, in Node mit `require` nutzbar): Graphmodell je Netzwerk (Knoten `and|or|xor|assign|set|reset|sr|rs|ton|tof|tp|ctu|ctd|cmp|move|calc|call|edgeP|edgeN|empty`, Pins mit Negation, Drähte Ausgang → Eingang inkl. Abzweig, Operanden an offenen Pins), `fromText` mit Auto-Layout, `toText`, `check`, `layoutNet` („Aufräumen“), `evalNet` (Signalzustände), `typeFromWord` (leere Box → Typ).
- Das Textformat und `kop.js` sind **unverändert**. Positionen, Netzwerkkommentar und „eingeklappt“ stehen in einer Kommentarzeile `// @fup {…}` direkt unter `NETWORK …` – `kop.js` überliest `//`-Zeilen (geprüft: Übersetzung und Testresultate bleiben gleich). Fehlt die Zeile (alte Spielstände, Musterlösungen), ordnet das Auto-Layout an.
- Umrechnung: Das Textformat hat Kontaktplan-Semantik (eine Zeit-/Zählerbox bekommt den „Strom“ links von ihr als IN, Elemente in einem ODER-Zweig hängen am Strom davor). `fromText` rechnet das in einen rein funktionalen Graphen um, `toText` ordnet so an, dass die Bedeutung gleich bleibt (Box mit Zeitglied kommt an den Anfang der &-Verknüpfung, negierte Boxausgänge werden nach De Morgan umgeformt).

## Rundreise (node test_fup_graph.js)

Text → Graph → Text, dann dieselben Tests über die Engine wie `validate_kop.js fup` (Grundstufe: alle Testfälle mit Ist-Werten + must; Profi: `ProTask.evaluate` mit must/Warnungen/Fehlschritt).

| Quelle | gleich |
|---|---|
| Musterlösungen Grundstufe | 100/100 |
| Startcodes Grundstufe | 100/100 |
| falsche Lösungen Grundstufe | 2/2 |
| Musterlösungen Profi (Rumpf je Baustein über `KOP.splitBlock`) | 50/50 |
| Startcodes Profi | 50/50 |
| falsche Lösungen Profi | 6/6 |
| Störungsszenarien (21 Grundstufe + 15 Profi) | 36/36 |
| Theorie-Beispiele `verifyKop` | 28/28 |
| **gesamt** | **372/372 = 100 %** |

Zusätzlich: Text nach der Rundreise (ohne Layoutzeile) ist bei allen 251 Grundstufen-Texten **wörtlich gleich**; jeder erzeugte Text ist stabil (zweite Rundreise ändert nichts); 300 Zufallsgraphen (&, >=1, X, Negationen an Eingängen und Drähten) liefern über die Engine dieselben Werte wie der Graph selbst. Ausnahmen: keine.

## Was das Textformat nicht kann (kop.js bleibt unverändert, der Editor meldet es)

1. **Mehrere Ketten in einem Netzwerk** (z. B. SR-Box unter der Kette, Video Punkt 12): `kop.js` erlaubt nur einen Strompfad je `NETWORK`. Lösung ohne Formaterweiterung: Jede weitere Kette wird als eigener Abschnitt `NETWORK Titel (2)` mit `// @fup {"k":1}` gespeichert; der Editor zeigt sie wieder als **ein** Netzwerk. Folge: Fehlermeldungen der Engine zählen diese Abschnitte mit („Netzwerk 3“), der Editor markiert trotzdem das richtige Netzwerk und die richtige Box.
2. **Abzweig in mehrere Logikboxen** (Ausgang einer &-Box auf zwei weitere Boxen): ausdrückbar, aber nur durch Verdoppeln der Logik davor. Der Editor erlaubt es, `check` gibt einen Hinweis; nach dem Neuladen stehen zwei Kopien da. Abzweige zu Zuweisungen/S/R/SR/RS/MOVE/Rechnen/Aufruf sind normal (ein Strompfad mit mehreren Ausgängen).
3. **Nur Operanden** an R1 (SR), R (RS), PT, PV, R/LD (Zähler), Vergleichs-, MOVE- und Rechen-Eingängen sowie Aufrufparametern – keine Verdrahtung. `check`: „Hier geht nur ein Operand, keine Verbindung.“ (Abhilfe wie im TIA-Alltag: Merker in einem eigenen Netzwerk.)
4. **Negation hinter Zeit-/Zähler-/Flankenbox** (z. B. `NOT TON.Q` an einer &-Box) ist nicht darstellbar → Meldung. Negation hinter &/>=1/X/CMP geht (De Morgan bzw. umgekehrter Vergleich), eine negierte Zuweisung (`=> NOT A`) geht immer.
5. **Zwei Zeit-/Zählerboxen an derselben &-Box** → Meldung (im Kontaktplan-Text würde die zweite Box den Ausgang der ersten als IN bekommen).
6. Kein Ausgang ENO/Q an Ausgangsboxen (SR-Q, MOVE-ENO) zum Weiterverdrahten; `FALSE` als Operand eines Bool-Eingangs; ET/CV-Ausgänge der Boxen (lesbar als Operand `T1.ET`, `Z1.CV`).

Empfehlung: Für F1–F4 reicht das bestehende Format. Eine Erweiterung (benannter Zwischenmerker als Abzweig, mehrere Strompfade je NETWORK) lohnt sich erst, wenn Steven Punkt 1 oder 2 im Klassentest als störend erlebt – dann mit Steven abstimmen.
