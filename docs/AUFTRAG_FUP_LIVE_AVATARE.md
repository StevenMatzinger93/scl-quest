# Auftrag für Claude Code: FUP-Werkbank, Live-Vorspann, Sudden Death, Avatare 2.0, Garderobe 2.0, Prüfung

Repo: `StevenMatzinger93/scl-quest` (Stand `c0bd9e2`, 30.09.2026). Diese Datei als `docs/AUFTRAG_FUP_LIVE_AVATARE.md` ins Repo legen.
Grundlage: Wunsch von Steven vom 02.10.2026 + TIA-Bildschirmaufnahme (FUP-Editor, 58 s, Analyse unten).
Arbeitsweise wie in `docs/ENTSCHEIDUNGEN.md` – **mit einer Ausnahme**: Die FUP-Werkbank wird nicht selbständig nach `main` übernommen, sondern erst nach Stevens OK (Test-Schleuse, Abschnitt 2).

**Prompt zum Einfügen in Claude Code:**

> Lies `docs/AUFTRAG_FUP_LIVE_AVATARE.md`. Setze zuerst Paket L1 (Sudden Death) um, dann L2 (Vorspann), dann P (Prüfung), dann A0 (nur Stilmuster, danach auf meine Wahl warten) und A4 (nur Katalog-Vorschau, danach auf mein OK warten). Parallel dazu darfst du F0 (Spike) machen. Nach jedem Paket: Tests grün, STAND.md nachführen, kurz berichten mit Vorschau-Link. FUP-Werkbank-Etappen nie nach main übernehmen ohne mein „OK F<n>“.

---

## 1. Überblick und Reihenfolge

| Paket | Inhalt | Grösse | Übernahme nach main |
|---|---|---|---|
| **L1** | Live-Challenge: Spielende „Zeitlimit“ oder „Sudden Death“ | klein (1 Sitzung) | selbständig bei grünen Tests |
| **L2** | Vorspann in der Wartelobby (Lernende + Beamer) | mittel (1–2 Sitzungen) | selbständig bei grünen Tests |
| **A0–A3** | Avatare 2.0 im Kahoot-Stil, 2.5D | mittel (2–3 Sitzungen) | A0 wartet auf Stilwahl, danach selbständig |
| **A4–A6** | Garderobe 2.0: Seltenheitsstufen, teurere Prunkstücke, Quest-Kollektionen (SCL/KOP/FUP/AWL/Sensor), Challenge-Trophäen (Abschnitt 12) | mittel–gross (3–4 Sitzungen) | A4 (Katalog) wartet auf Stevens OK, danach selbständig |
| **P** | Prüfung/Zertifikat abnehmen + Lücken schliessen (Abschnitt 13) | klein (1 Sitzung) | selbständig bei grünen Tests |
| **F0–F6** | FUP-Werkbank: Bausteine ins Netzwerk ziehen und verdrahten wie im TIA Portal | gross (6–9 Sitzungen) | **nur nach „OK F<n>“ von Steven** |

Warum diese Reihenfolge: L1/L2 sind klein und sofort im Unterricht nutzbar. A0 braucht eine Stilentscheidung von Steven – die Wartezeit nutzt F0. Die FUP-Werkbank läuft getrennt im Labor, bis Steven sie abnimmt.

---

## 2. Test-Schleuse für die FUP-Werkbank (so kann Steven testen, bevor etwas in FUP Quest landet)

1. **Eigener Zweig** `fup-werkbank` (von `main`). Jede Etappe = ein Commit-Block + Tag `fup-F<n>`. `main` wird regelmässig hineingemischt, nie umgekehrt ohne OK.
2. **Labor-Seite**: Der Build erzeugt zusätzlich `web/lab/fup/index.html` und offline `dev/lab/fup_lab.html`:
   - nur der neue Editor + PLC-Variablentabelle des Stellwerks + Knopf „Übersetzen“ + Textansicht (zeigt das erzeugte Textformat) + Simulationsfeld (Eingänge anklicken, Ausgänge leuchten)
   - **Aufgabenwahl**: 10 echte FUP-Aufgaben (fp01…fp10 je eine) mit „Prüfen“ gegen die echten Tests → Steven sieht, dass es mit dem Spiel zusammenpasst
   - Feedback-Knopf 💬 mit Kontext „FUP-Labor F<n>“
3. **Vorschau-Link**: Cloudflare-Vorschau des Zweigs (`fup-werkbank.<projekt>.pages.dev/lab/fup/`) – Steven testet am Laptop und Handy/Tablet.
4. **Abnahmeliste** je Etappe (unten bei F0–F6). Steven antwortet „OK F<n>“ oder schickt Mängel; erst dann nächste Etappe.
5. **Übernahme in FUP Quest** (F5) zuerst hinter einem Schalter: `?werkbank=1` bzw. Einstellung „Neuer FUP-Editor (Beta)“. Erst nach „OK F5“ wird er Standard; der alte Editor bleibt eine Version lang als Rückfallebene („Klassischer Editor“).
6. **KOP Quest bleibt unberührt.** Der neue Editor ist ein eigenes Modul; `kop_editor.js` wird nicht umgebaut (KOP nutzt ihn weiter).

> Hinweis: Das lokale Git im OneDrive-Ordner meldet `failed to read object …` (OneDrive lädt Dateien nur bei Bedarf). Claude Code arbeitet deshalb in der Cloud-Sitzung direkt am GitHub-Repo, nicht im OneDrive-Ordner.

---

## 3. Analyse TIA-Video (Soll-Bedienung)

Beobachtet in der Aufnahme (FC1 „Kaesesortierer“, CPU 1511):

1. **Favoritenleiste** über den Netzwerken: `&`, `>=1`, leere Box `??`, offener Eingang `-|`, Negation `-o|`, Abzweig `↦`, Zuweisung `-[=]`.
2. Box **in das Netzwerk ziehen** → erscheint mit Platzhaltern `<??.?>` an allen Eingängen, Ausgang offen. Netzwerk zeigt rotes ⊗ (unvollständig).
3. Zweite Box (`>=1`) **an den Ausgang der ersten ziehen** → wird automatisch **kaskadiert** (Ausgang & → oberer Eingang ≥1), zusätzlicher Eingang mit `<??.?>`.
4. **Zuweisung `=`** an den Ausgang ziehen → hängt sich an, Operand `<??.?>` darüber.
5. **Negation**: Werkzeug `-o|` auf einen Eingang/Ausgang klicken → Kreis erscheint.
6. **Eingang erweitern**: gelber Stern `*` am letzten Eingang → neuer Eingang.
7. **Operand eingeben**: Klick auf `<??.?>` → Inline-Feld; Tippen `I0.0` / `%I0.0` mit **Auswahlliste** (PLC-Variablen) → Anzeige zweizeilig: grün `%I0.0`, darunter `"Lichtschranke links"`.
8. **Tooltip** beim Überfahren eines Operanden: `%Q0.0 / Bool`.
9. **Leere Box** ziehen → Typ eintippen (`S`, `SR` …) → Box wird zur SR-Box mit Pins `S`, `R1`, `Q` und Operand oben.
10. **Unbekannter Operand** (`M0`) → TIA legt eine Variable an (`%M0.0 "Tag_1"`) – bei uns stattdessen: Meldung „Variable nicht in der PLC-Variablentabelle“ + Vorschlag (keine neuen Variablen im Spiel, Aufgaben sind vorgegeben).
11. Grüne Linie unter dem Netzwerk beim Ziehen = **Ablageziel** (neues Netzwerk / Ende).
12. Mehrere Bausteinketten pro Netzwerk möglich (SR-Box unter der Kette).

**Ist-Zustand** (`kop_editor.js`, Variante `fup`): Das Netzwerk ist ein Baum (Reihe/Parallel) und wird automatisch gezeichnet; Palette und Variablen lassen sich auf Pins ziehen, Pin-Klick negiert, `*` und Platzhalter gibt es seit Feedback 5. Es fehlen: freies Ablegen im Netzwerk, Kaskadieren durch Ziehen an Ausgänge/auf Linien, Verdrahten Pin→Pin, Abzweig, leere Box mit Typeingabe, Auswahlliste beim Tippen, zweizeilige Operanden mit Adresse, Tooltip, mehrere Ketten pro Netzwerk, Rückgängig/Wiederholen.

---

## 4. Architektur FUP-Werkbank

**Grundsatz: Engine, Textformat und 150 Aufgaben bleiben unverändert.** Der Editor arbeitet auf einem Graphen und speichert weiter das Textformat aus `kop.js`. So bleiben Validator, Tests, Spielstände, Leitstand, Störungsjagd und Live-Challenge kompatibel.

Neue Module:

- `dev/src/fup_graph.js` (`window.FUPGraph`) – reine Logik, in Node testbar
  - Modell je Netzwerk: `nodes` (`and|or|xor|assign|set|reset|sr|rs|ton|tof|tp|ctu|ctd|cmp|move|calc|call|edgeP|edgeN|empty`), `pins` (mit `neg`), `wires` (von Ausgangs-Pin zu Eingangs-Pin; ein Ausgang darf mehrere Ziele haben = Abzweig), `operands` an offenen Pins.
  - `toText(graph)` → bestehendes Textformat (`NETWORK …` + `pfad => ausgänge;`). Mehrere Ketten pro Netzwerk → mehrere Zeilen im selben `NETWORK`.
  - `fromText(text)` → Graph mit **Auto-Layout** (für Startcode, Musterlösungen, Störungsszenarien, alte Spielstände).
  - Layout (Positionen) als Kommentarzeile `// @fup {…}` im Netzwerk speichern – `kop.js` ignoriert `//`-Zeilen bereits. Fehlt die Zeile → Auto-Layout.
  - `check(graph)` → TIA-nahe Meldungen: offene Platzhalter, Zyklus, Ausgang ohne Ziel, Typkonflikt (Bool an Int-Pin), Variable unbekannt.
- `dev/src/fup_workbench.js` (`window.FUPWorkbench`) – Editor-Oberfläche (SVG, Pointer Events = Maus, Stift, Touch). Gleiche Schnittstelle wie heute (`getValue`, `setValue`, `setErrorMark`, `showFlow(env)`, `insertAtCursor`), damit `app.js`, `engineering_ui.js` und das Labor ihn ohne Sonderwege einhängen.
- `dev/src/styles_fup_wb.css`.

**F0 klärt die eine echte Unbekannte:** Kann jeder sinnvolle Graph (v. a. Abzweig, der in zwei weitere Logik-Boxen läuft) ins Textformat? Wenn nicht: kleine Erweiterung in `kop.js` (benannter Zwischenmerker `_fN_k` als Abzweig, wird schon intern für den Stromfluss erzeugt) – **mit Steven abstimmen, bevor das Textformat erweitert wird.**

---

## 5. Etappen FUP-Werkbank

### F0 – Spike + Rundreise (keine Oberfläche)
- `fup_graph.js` mit `fromText`, `toText`, Auto-Layout, `check`.
- Test `dev/test_fup_graph.js`: **Rundreise für alle FUP-Musterlösungen, Startcodes und Störungsszenarien** (150 Aufgaben + 36 Bugs): `text → graph → text` ergibt dieselbe Semantik (gleiche Testresultate über die Engine). Ziel 100 %; Ausnahmen begründet auflisten.
- Bericht an Steven: Was geht, was braucht eine Formaterweiterung.
- **Abnahme F0:** nur Bericht lesen, kein Klicktest.

### F1 – Netzwerk, Palette, Ziehen, Platzhalter
- Bausteintitel + Netzwerke (Titel, Kommentar, ein-/ausklappen, rotes ⊗ bei Fehler, wie im Video).
- Favoritenleiste `&  >=1  ??  -|  -o|  ↦  -[=]` + Bibliothek (Timer, Zähler, Vergleich, Flanken, S/R/SR/RS, MOVE, Rechnen) an der Seite.
- Ziehen aus Leiste/Bibliothek ins Netzwerk; Ablageziele werden beim Ziehen hervorgehoben (grüne Linie/Pin-Ring); neue Box bekommt `<??.?>` an allen Operandenpins.
- Box verschieben, löschen (Entf), mehrere markieren (Rahmen ziehen).
- Labor-Seite + Vorschau-Link stehen.
- **Abnahme F1:** & und ≥1 ins leere Netzwerk ziehen, verschieben, löschen; neues Netzwerk unter dem letzten anlegen; sieht aus wie TIA (grau/weiss, Box-Kopf, Platzhalter rot).

### F2 – Verdrahten und Kaskadieren
- Box auf einen **Ausgang** oder auf eine **Linie** ziehen → automatisch kaskadieren (Ausgang → erster freier Eingang), wie im Video.
- **Draht ziehen** vom Ausgangs-Pin zu einem Eingangs-Pin (Gummiband, orthogonal geführt); Draht antippen + Entf löscht.
- **Abzweig** `↦`: Ausgang auf mehrere Ziele (z. B. zwei Zuweisungen).
- `*` am Box-Ende fügt Eingang hinzu; Rechtsklick/langes Drücken: „Eingang entfernen“.
- Leiste `-|` (offener Eingang) und `-o|` (Negation) auf Pins anwenden; Pin-Klick mit aktivem `-o|` schaltet Negation.
- Auto-Layout-Knopf „Aufräumen“.
- **Abnahme F2:** Netzwerk aus dem Video exakt nachbauen (& mit 3 Eingängen, erster negiert → ≥1 → `=`), plus SR-Box daneben.

### F3 – Operanden wie im TIA Portal
- Klick/Doppelklick auf `<??.?>` → Inline-Feld; Tippen filtert die **PLC-Variablen** (Name, Adresse `%I0.0`, Kommentar), Pfeiltasten + Enter, auch `I0.0` ohne `%`.
- Anzeige zweizeilig: Adresse grün, Symbolname in Anführungszeichen (wie Video). Profi-Stufe: `#lokal`, `"DB".Element`.
- Tooltip `%Q0.0 / Bool` beim Überfahren.
- Unbekannter Name → rot + Hinweis „Nicht in der PLC-Variablentabelle“ (keine automatische `Tag_1`-Erzeugung).
- Variablen-Chips weiterhin per Ziehen auf Pins.
- **Leere Box `??`**: Typ eintippen (`&`, `>=1`, `X`, `S`, `R`, `SR`, `RS`, `TON`, `CTU`, `CMP==`, `MOVE`, `ADD` …) mit Vorschlagsliste → Box verwandelt sich.
- Timer/Zähler: Instanzname über der Box, PT/PV-Pins mit Typprüfung.
- **Abnahme F3:** Video-Netzwerk mit echten Stellwerk-Variablen befüllen, nur mit Tastatur möglich; SR aus leerer Box durch Tippen „SR“.

### F4 – Komfort, Handy, Barrierefreiheit
- Rückgängig/Wiederholen (Strg+Z/Y, Knöpfe), Kopieren/Einfügen von Boxen und Netzwerken.
- Zoom (Strg+Mausrad, Knöpfe, Pinch) und Verschieben der Fläche.
- **Touch**: Tippen-Tippen als Alternative zum Ziehen (Werkzeug wählen → Ziel antippen), grössere Pins (≥ 32 px Trefferfläche), 390 px Breite bedienbar.
- Tastatur: Tab durch Boxen/Pins, Enter = bearbeiten, Pfeile = verschieben; ARIA-Beschriftungen.
- Stromfluss beim Abspielen (`showFlow`): Drähte grün = 1, gestrichelt = 0 (wie heute).
- Fehler aus dem Übersetzen markieren die Box (`setErrorMark`).
- **Abnahme F4:** Aufgabe auf dem Tablet/Handy lösen; Strg+Z nach Löschen stellt wieder her.

### F5 – Übernahme in FUP Quest (Beta-Schalter)
- Einhängen in `app.js` (FUPMODE) inkl. Profi-Stufe (Netzwerke im Baustein, Aufruf-Boxen mit Parametern, Beobachten).
- `renderStatic` für Theorie, Handbuch, Lösungsvergleich, Leitstand und Beamer (Lösung anonym zeigen) im neuen Look.
- Sensorwerkstatt (`engineering_ui.js`, FUP-Teil) auf den neuen Editor umstellen.
- Tour-Schritte (Tour `fup`) und Handbuchseite „Editor bedienen“ neu.
- Tests: `tests/kop_playthrough.js fup` (alle 150 + 30 **über die neue Oberfläche**, nicht nur Textansicht), `tests/fup_ui.js`, `tests/fup_tia.js` erweitern (Kaskade, Draht, Abzweig, Operand-Auswahlliste, Undo, 390 px), `tests/sensor_engineering_ui.js`.
- Alte Spielstände: Code ohne `// @fup` öffnet mit Auto-Layout; nichts geht verloren.
- **Abnahme F5:** Kapitel 1 und eine Profi-Aufgabe in FUP Quest mit `?werkbank=1` durchspielen; Live-Challenge FUP mit Testkonten.

### F6 – Standard schalten und aufräumen
- Nach „OK F5“: neuer Editor Standard, Einstellung „Klassischer Editor“ für eine Version, danach entfernen (nur FUP-Teil; KOP bleibt).
- CLAUDE.md, STAND.md, Anleitungen im Portal nachführen.

---

## 6. Paket L1 – Sudden Death

**Bedienung (Leitstand → Live-Challenge anlegen):** neues Feld **Spielende**
- **Zeitlimit (klassisch)** – wie heute: alle spielen bis zum Ablauf, Rangliste nach Punkten/Zeit.
- **Sudden Death** – sobald die erste Person fertig ist (Speedrun: alle Aufgaben gelöst; Störungsjagd: Störung behoben), endet die Challenge sofort für alle. Diese Person gewinnt, alle anderen haben verloren. Das Zeitlimit bleibt als Obergrenze (läuft es ab ohne Sieger → „Niemand hat es geschafft“).

**Worker (`worker/challenge.js`, `db.js`):**
- Migration: `ALTER TABLE challenges ADD COLUMN end_rule TEXT DEFAULT 'time'`, `ADD COLUMN winner_id INTEGER`.
- `create`: `endRule ∈ {'time','first'}`.
- `report()`: bei „fertig“ und `end_rule='first'` atomar `UPDATE challenges SET state='ended', ends_at=?, winner_id=? WHERE id=? AND state='running'` – nur wer die Zeile ändert (`meta.changes === 1`), ist Sieger. Gleichzeitige Lösung: Serverzeit entscheidet.
- Meldungen nach Ende werden mit 409 „Sudden Death – <Name> war schneller“ abgewiesen (Code wird trotzdem für die Besprechung gespeichert).
- `publicChallenge` liefert `endRule`, `winner` (Pseudonym + Avatar).
- Coins: Sieger erhält die Platz-1-Prämie; Rest keine Platzprämie (bestehende Ledger-Logik).

**Spiel (Lernende, `app.js` LIVE):** Live-Leiste zeigt Badge „☠ SUDDEN DEATH“; beim nächsten Poll nach Ende: Vollbild „<Name> war schneller!“ mit dessen Avatar, eigener Fortschritt („Du hattest 2 von 3“), Editor sperren.

**Beamer (`portal_live.js`):** Lobby- und Laufansicht mit rotem Sudden-Death-Banner; bei Ende: Blitz/Stopp-Effekt, Sieger allein auf dem Podest (gross, Tanzanimation), darunter „Verloren“-Reihe mit Fortschritt je Person; Musik: Stinger „Zeit abgelaufen“ → Siegerfanfare.

**Tests:** `tests/live.js` erweitern: zwei Konten, A löst → Challenge `ended`, B-Meldung 409, Sieger = A; gleichzeitige Meldungen (Promise.all) → genau ein Sieger; Zeitablauf ohne Sieger; klassischer Modus unverändert.

---

## 7. Paket L2 – Vorspann in der Wartelobby

**Ziel:** Während alle auf den Start warten, läuft ein kurzer Vorspann (ca. 30–40 s, Schleife), der zeigt, **wo die Aufgabe steht, wo man schreibt/baut, wo „Prüfen“ ist und wo der Knopf zum Weitermachen ist.**

**Bei den Lernenden (Spiel im Live-Modus, Zustand `lobby`):**
- Die echte Spieloberfläche wird bereits geladen, aber gesperrt und abgedunkelt (Aufgabe erst nach Start – Inhalt wird durch einen **Platzhalter-Auftrag** ersetzt, damit nichts verraten wird).
- Ein automatischer Rundgang mit Spotlight + animiertem Mauszeiger (wiederverwendet die Tour-Mechanik `startTour`/`showTourStep` aus `app.js`, neuer Modus `autoplay`, 5–6 s pro Schritt):
  1. **Auftrag** – „Hier steht deine Aufgabe.“ (Auftragskarte)
  2. **Editor** – SCL/AWL: „Hier schreibst du deinen Code.“ · KOP/FUP: „Hier ziehst du Bausteine ins Netzwerk und verdrahtest sie.“ (mit Mini-Animation: Box fliegt ins Netzwerk)
  3. **PLC-Variablen** – „Die Variablen findest du hier.“
  4. **Prüfen** – „Mit Prüfen testest du gegen die Anlage. Fehlversuche kosten Punkte.“
  5. **Live-Leiste** – „Zeit, Modus und dein Rang.“ (+ bei Sudden Death: „Wer zuerst fertig ist, gewinnt – alle anderen verlieren.“)
  6. **Weiter** – „Gelöst? Hier geht’s zur nächsten Aufgabe bzw. zur Rangliste.“ (Erfolgsdialog wird als Attrappe eingeblendet)
- Oben: „Warte auf den Start … · 12 Teilnehmende“; Knopf „Vorspann überspringen“; startet die Challenge, bricht der Vorspann sofort ab → 3-2-1-Los.
- Texte je Quest und Modus in einer Tabelle (`LIVE_INTRO` in `app.js`), Störungsjagd mit eigenem Schritt 1 („Hier steht die Störungsmeldung“).
- `prefers-reduced-motion`: statische Schritte ohne Zeigerbewegung.

**Am Beamer (Lobby):** Neben Code und Avataren ein Bereich „So funktioniert’s“ mit derselben Schrittfolge als animierte Bildschirm-Attrappe (HTML/SVG-Nachbau der Spieloberfläche, keine Screenshots → bleibt aktuell und offline) und grossen Beschriftungen; schaltet alle 6 s weiter.

**Tests:** `tests/live.js`: Lobby zeigt Vorspann, Überspringen funktioniert, Start bricht ab, keine echte Aufgabe im DOM vor Start; je Quest ein Durchlauf (SCL, KOP, FUP, AWL), 390 px.

---

## 8. Paket A – Avatare 2.0 (Kahoot-Stil, 2.5D)

**Recherche Kahoot** (Kahoot-Blog „Kahoot! characters“, Support-Artikel „How to use game characters“): verspielte Illustrationsfiguren (Tiere, Gegenstände mit Beruf/Hobby, z. B. Astronauten-Hund, Panda mit Buch), bis ~700 Kombinationen aus Figur + Accessoire, Figur erscheint neben dem Nickname in Lobby, Rangliste und Podest, Jubel beim Aufsteigen und **Siegestanz auf dem Podest**; Anpassen über Stift-Symbol. Typische Gestaltung: ganzer Körper im Chibi-Verhältnis (Kopf ≈ ½ der Höhe), runde, weiche Formen, kräftige gesättigte Farben, grosse glänzende Augen, wenige dicke Details, farbige Kachel hinter der Figur.
Wir übernehmen den **Stil**, keine Kahoot-Figuren oder -Marken; eigene Tiere wie bisher.

**Stil „2.5D“ (Zielbild):**
- 3/4-Ansicht, ganzer Körper (heute nur Kopf/Oberkörper), Chibi-Proportionen.
- Weiche Schattierung mit 2–3 Verläufen pro Fläche (Licht oben links), Glanzpunkt auf Kopf und Augen, feine Randaufhellung, Bodenschatten (Ellipse, unscharf).
- Kachel/Sockel: abgerundetes Plättchen in Isometrie (Avatarfarbe) – auf dem Podest werden die Sockel zu 3D-Stufen.
- Accessoires mit eigener Tiefe (Kappe mit Schirm-Schatten, Brille mit Glanz, Kette mit Gold-Verlauf).
- Animation (CSS-Transform, nur in der Challenge): Idle-Wippen + Blinzeln, „Pop“ beim Beitreten, Jubelsprung beim Lösen, Siegestanz auf dem Podest, „Traurig“-Pose für Sudden-Death-Verlierer.

**Technik:** weiterhin **SVG aus `avatar_core.js`** (offline, klein, auch im Worker-Bundle). Datenmodell `{animal, color, items}` bleibt → **keine Migration, alle gekauften Gegenstände bleiben**. Neu: `svg(av, {size:'chip'|'card'|'stage', pose})`; Chip (24 px) vereinfacht ohne Verläufe; eindeutige Verlauf-IDs je Instanz (oder gemeinsames `<defs>`-Sprite) gegen ID-Kollisionen; 40 Avatare am Beamer flüssig (Test mit 40 Konten, ≥ 50 fps).

- **A0 – Stilmuster (wartet auf Steven):** eine Vorschauseite `dev/lab/avatar_stil.html` (+ Vorschau-Link) mit **3 Varianten** am Beispiel Fuchs + Bär mit Kappe/Brille/Kette: (a) flach Kahoot-nah, (b) 2.5D weich schattiert, (c) „Knete/Spielzeug“-Look mit stärkerem Volumen. Dazu Podest- und Lobby-Szene. Steven wählt.
- **A1:** alle 8 Tiere + alle Accessoires im gewählten Stil, Ganzkörper; Garderobe (`portal_avatar.js`) mit grosser Drehbühne und Vorschau.
- **A2:** Posen und Animationen; Lobby-Crowd, Rangliste, Podest (3D-Stufen), Sudden-Death-Sieger.
- **A3:** Überall einsetzen (Portal-Kopf, Leitstand, Lobby, Rangliste, Podest, Spiel-Endbildschirm); `tests/portal.js` + `tests/live.js` + Bildvergleich-Schnappschüsse (Playwright) für 8 Tiere.

---

## 9. Offene Entscheidungen für Steven (Empfehlung fett)

1. FUP-Boxen **frei platzierbar mit Einrasten + Knopf „Aufräumen“** oder streng automatisch angeordnet wie TIA? → Empfehlung: **frei mit Einrastraster**, weil es sich mehr wie „Bausteine ziehen“ anfühlt; TIA-artiges Auto-Layout per Knopf.
2. Unbekannte Operanden: **nur Hinweis** (Aufgaben haben feste Variablen) oder wie TIA automatisch `Tag_1` anlegen? → **nur Hinweis**.
3. Sudden Death: Verlierer-Rangliste nach Fortschritt anzeigen (**ja**, motiviert) oder nur „Verloren“?
4. Vorspann auch im klassischen Modus jedes Mal oder nur bis man ihn 3× gesehen hat? → **immer in der Lobby, überspringbar**.
5. Avatar-Stil: Wahl aus A0.
6. Garderobe: Preise/Stufen aus 12.1 und Kollektionen aus 12.3 so übernehmen? Monats-Schaufenster ja/nein? → **ja, Schaufenster erst nach A6**.
7. Sensorwerkstatt-Prüfung bauen? → **später**, zuerst Klassentest mit den vier Sprach-Prüfungen.

---

## 10. Wer macht was

**Claude in Cowork (diese Sitzung, gemacht):** Video ausgewertet, Ist-Zustand im Repo geprüft (`kop_editor.js`, `kop.js`, `worker/challenge.js`, `portal_live.js`, `avatar_core.js`, Tour in `app.js`), Kahoot recherchiert, diesen Auftrag geschrieben und abgelegt.
**Claude in Cowork (danach, auf Wunsch):** Abnahmen begleiten (Vorschau-Link prüfen, Screenshots, Mängelliste für Claude Code formulieren), Stilmuster A0 mitbewerten, Doku im Projekt nachführen.
**Claude Code (Cloud-Sitzung am Repo):** alle Pakete umsetzen, Tests schreiben, Vorschau-Links liefern, STAND.md/CLAUDE.md nachführen.
**Steven:** Entscheidungen Abschnitt 9, Abnahme je Etappe („OK F<n>“, Stilwahl A0), Klassentest.

## 11. Fertig heisst (alle Pakete)

Build, alle Validatoren 0 Fehler, Engine-/Profi-/AWL-Tests, `tests/api.js`, `portal.js`, `live.js`, Durchläufe SCL/KOP/FUP/AWL (Desktop + 390 px) grün; Browser ohne JS-Fehler; offline-Dateien spielbar; alte Spielstände laden; STAND.md nachgeführt.

---

## 12. Paket A4–A6 – Garderobe 2.0 (Nachtrag 02.10.2026)

**Problem heute** (`dev/src/avatar_core.js`): 22 Gegenstände, Preise 40–150 Coins, ganzer Katalog ≈ 1 700 Coins. Eine Quest bringt bis ≈ 3 500 Coins (150 Aufgaben × 10–20, Bosse 40, Final Boss 100, Theorie 10) → nach einer halben Quest ist alles gekauft. Die Teile sind einfache Formen ohne Volumen, Glanz oder Bewegung. Es gibt nichts, was zeigt, *wo* jemand gut ist.

**Ziel:** Garderobe als Langzeitmotivation über alle Quests und Challenges: seltene, sichtbar „krasse“ Teile kosten viel und/oder brauchen eine Leistung, die nur der Server bestätigen kann. Coins bleiben **nur verdienbar, nie kaufbar, rein kosmetisch** (ENTSCHEIDUNGEN).

### 12.1 Seltenheitsstufen

| Stufe | Rahmen | Preis (Coins) | Freischaltung | Gestaltung |
|---|---|---|---|---|
| Gewöhnlich | grau | 50–150 | – | einfache Farben (alle heutigen Teile, Besitz bleibt) |
| Selten | blau | 250–500 | teils Kleinleistung | Muster, Verläufe, Glanz |
| Episch | lila | 800–1 500 | Leistung in einer Quest | eigene Formen, Licht-Details (LED, Glut) |
| Legendär | gold | 2 000–3 500 | Final Boss / viele Challenge-Erfolge | **animiert** (Lauflicht, Funken, Dampf), eigener Sockel-Effekt |
| Mythisch | rot-violett, schimmernd | 5 000–8 000 | **Zertifikat** oder questübergreifende Meisterschaft | animiert + Aura + Siegerpose |

- Heutige Teile behalten Preis und Besitz (keine Entwertung).
- Seltenheitsrahmen überall sichtbar (Garderobe, Profilkarte im Beamer beim Beitreten: „Nina trägt: Legendäre Signalkelle“).
- Faustregel Wirtschaft: Eine ganze Quest durchspielen (≈ 3 500) reicht für **ein** Legendär-Teil oder mehrere Epische – nicht für alles. Der Gesamtkatalog soll ≈ 60 000–80 000 Coins kosten (≈ alle 5 Bereiche + viele Challenges).

### 12.2 Neue Plätze am Körper (Ganzkörper-Avatar aus A1 nötig)

Kopf · Brille/Visier · Oberteil · Kette · **Hand** (Werkzeug/Gegenstand) · **Rücken** (Rucksack, Umhang, Jetpack) · **Schuhe** · **Aura/Effekt** (animiert, nur Legendär/Mythisch) · **Sockel** (Plattform unter dem Avatar in Lobby/Podest) · **Siegerpose** (Tanz auf dem Podest) · **Titel** (Schriftzug unter dem Namen, z. B. „Fahrdienstleiter“).

### 12.3 Quest-Kollektionen (je Bereich ein Thema passend zur Anlage)

Stufen je Quest (Zählung der gelösten Spielaufgaben **dieser** Quest; Sensorwerkstatt mit eigenen Schwellen, weil 30 angezeigte Aufgaben):

| Stufe | SCL / KOP / FUP / AWL | Sensorwerkstatt | Seltenheit |
|---|---|---|---|
| Bronze | 25 Aufgaben | 10 Aufgaben | Selten |
| Silber | 75 Aufgaben | 20 Aufgaben | Episch |
| Gold | Final Boss (Grundstufe) | alle 30 + alle Theorien | Legendär |
| Meister | Zertifikat Profi-Stufe (bzw. Final Boss 2) | – (bis es eine Sensor-Prüfung gibt: alle Module ohne Lösung anzeigen) | Mythisch |

| Quest (Anlage) | Bronze | Silber | Gold (animiert) | Meister | Titel |
|---|---|---|---|---|---|
| **SCL** (Roboterzelle) | Hoodie „IF…THEN“ | Cyber-Visor mit LED-Lauflicht | Greifarm-Rucksack (bewegt sich) | Code-Aura: schwebende `{ }` und `:=` | „Syntax-Sensei“ |
| **KOP** (Seilbahn) | Bergführer-Mütze | Skibrille verspiegelt | Seilbahn-Kabine als Anhänger (pendelt) | Gipfel-Sockel mit Schneefall | „Stromlaufplan-Profi“ |
| **FUP** (Stellwerk) | Lokführer-Mütze | Signalkelle (Hand) | Weichenlaterne (blinkt rot/grün) | Dampf-Aura + Pfiff-Siegerpose | „Fahrdienstleiter“ |
| **AWL** (Walzwerk) | Lederschürze | Giesser-Helm mit Hitzevisier | glühender Stahlblock-Anhänger | Funkenregen-Aura | „Akku-Legende“ |
| **Sensor** (Werkstatt) | Werkzeuggürtel | Stirnlampe (leuchtet) | Multimeter in der Hand (Anzeige läuft) | Kabelbaum-Umhang mit Aderendhülsen | „Klemmen-König“ |

- **Set-Bonus:** alle Teile einer Kollektion zugleich getragen → passender Sockel-Effekt (z. B. Schienen-Sockel FUP).
- **Questübergreifend:** Final Boss in 3 Sprachen → „Polyglott“-Umhang (Legendär); alle 4 Profi-Zertifikate → „SPS-Meister“-Krone (Mythisch, einmalig, nicht kaufbar, nur verdienbar).

### 12.4 Challenge-Trophäen (nach Anzahl und Erfolg in Live-Challenges)

| Leistung (nur serverseitig gezählt) | Stufen | Belohnung |
|---|---|---|
| Teilnahmen | 1 · 5 · 15 · 30 · 50 | Sockel Holz → Metall → Neon → Hologramm; Titel „Stammgast“ |
| Podestplätze | 1 · 5 · 15 | heutige Sonnenbrille → Pokal (Hand) → Konfetti-Siegerpose |
| Siege (Platz 1) | 1 · 10 · 25 | Siegerkranz → goldener Sockel → „Champion“-Aura |
| Sudden-Death-Siege | 1 · 5 | Blitz-Aura (Legendär) · Titel „Schnellster Finger“ |
| Störungsjagd gelöst | 5 · 20 | Detektiv-Lupe (Hand) · Deerstalker-Mütze |
| Fehlerfrei gelöst (0 Fehlversuche, 0 Tipps) | 10 | Titel „Null-Fehler“ + Glanz-Effekt |

**Gegen Ausnutzen:** Eine Challenge zählt nur, wenn ≥ 3 Teilnehmende, ≥ 2 min Laufzeit und von einer Lehrperson gestartet; pro Challenge höchstens einmal je Leistung; Werte kommen aus `challenge_players`/`challenges` (Server), nicht aus dem Browser.

### 12.5 Mehr Coin-Ausgaben, gleiches Verdienen

- Verdienen bleibt wie heute (kein Abwerten bisheriger Leistung). Ergänzt: Zertifikat bestanden +300 (mit Auszeichnung +500), Sudden-Death-Sieg +80, Teilnahme an Challenge +5.
- **Farbvarianten** für Epische/Legendäre Teile (je +30 % Preis) als weitere Ausgabe.
- **Monats-Schaufenster** (optional, Entscheid Steven): jeden Monat 3 Sonderteile, nur in diesem Monat kaufbar, kommen später wieder.

### 12.6 Technik

- `avatar_core.js`: `ITEMS` mit `rarity`, `slot` (neue Plätze), `set`, `anim`; `unlock` erweitert um `questSolved:{fup:75}`, `questFinal:'fup'`, `cert:{quest:'fup', level:'profi'}`, `challenges`, `podium`, `wins`, `sdWins`, `bugFixed`, `flawless`, `finals3`.
- `unlockCtx` bekommt drei Quellen: synchronisierter Fortschritt je Quest, **Challenge-Statistik** (neue Abfrage über `challenge_players` + `challenges`, mit den Regeln aus 12.4) und **Zertifikate** (`certificates`, nur gültige, nicht widerrufene).
- **Legendär/Mythisch nur aus Server-Quellen** (Zertifikate, Challenges) oder Final Boss, den der Worker beim Kauf gegen die Musterlösungs-Tests prüft – der lokale Spielstand allein reicht dafür nicht.
- Kauf-API unverändert (`POST avatar/buy`), Fehlermeldung nennt fehlende Leistung mit Fortschritt („Signalkelle: 52/75 FUP-Aufgaben“).
- Animationen als CSS-Klassen im SVG, nur in Lobby/Rangliste/Podest/Garderobe aktiv, `prefers-reduced-motion` → statisch. Im Chip (24 px) nur Kopf + Rahmenfarbe.
- Datenschutz: keine neuen Personendaten (Zählwerte aus bestehenden Tabellen).

### 12.7 Etappen

- **A4 – Katalog + Vorschau (wartet auf Steven):** Katalogtabelle (alle Teile, Preis, Stufe, Bedingung) + Vorschauseite `dev/lab/garderobe.html` mit je einem Teil pro Stufe gezeichnet im gewählten A0-Stil + Wirtschafts-Rechnung (Coins je Quest vs. Katalogsumme). Steven gibt Preise/Teile frei.
- **A5 – Bauen:** alle Teile zeichnen, neue Plätze, Seltenheitsrahmen, Sets, Unlock-Logik + Worker-Statistik, Garderobe mit Filter (Quest, Stufe, „bald freischaltbar“) und Fortschrittsbalken je Bedingung.
- **A6 – Zeigen:** Beamer-Beitritt mit „trägt …“, Titel unter Namen in Rangliste/Podest, Siegerposen, Leitstand-Klassenliste mit Mini-Avatar. Tests: `test_avatar.js` (Unlock-Regeln, Anti-Ausnutzen, alte Inventare), `tests/portal.js`, `tests/live.js`, Schnappschüsse.

---

## 13. Paket P – Prüfung / Zertifikat abnehmen (Nachtrag 02.10.2026)

**Ist (geprüft am 02.10.2026 auf `c0bd9e2`):** Prüfung + Zertifikat sind fertig gebaut (Konzept `docs/ZERTIFIKAT_KONZEPT.md`): 8 Zertifikatsarten (SCL/KOP/FUP/AWL × Grund/Profi), 120 Prüfungsaufgaben + 280 Fragen, Bewertung im Worker, Prüfcode mit QR und öffentlicher Prüfseite `/z/<Code>`, Prüfung unter Aufsicht mit Beamer-Übersicht. `node validate_exam.js`: **0 Fehler, 28 Zeitwarnungen**. Steven hat es noch nicht selbst durchgespielt.

**Aufgaben:**
1. **Zeitwarnungen klären:** einzelne Bewertungen 4–6 ms, ein Ausreisser 24 ms (`x_awl_p_dickenklasse {G1:25,G2:40}`). Gratis-Tarif = 10 ms CPU. Nachmessen (`bench_exam.js`, warm/kalt), Ausreisser-Aufgaben vereinfachen oder Parameterkombination streichen; Ziel: alle warm < 5 ms.
2. **Kernpfad:** Die Kernaufgaben sind über `content*/kern.js` markiert, und `worker/exam.js` zählt für die Zulassung schon die Kernaufgaben (80 %). Nur nachprüfen: Für jede Quest zeigt die Zulassung „x/y Kernaufgaben“ korrekt an (Test in `tests/exam_api.js`).
3. **Sensorwerkstatt** hat keine Prüfung (Entscheid Steven: eigene Prüfung ja/nein).
4. **Abnahme-Durchlauf für Steven** vorbereiten: Testklasse SPS2026, Dozent startet „Prüfung unter Aufsicht“ FUP Grundstufe, 2 Testkonten treten bei, eines besteht, eines nicht; Zertifikat ausstellen, PDF/PNG, Prüfseite per QR am Handy, Widerruf. Kurze Checkliste in `docs/TESTPLAN.md` ergänzen.
5. Coins/Garderobe anbinden (12.5: Zertifikat → Coins + Meister-Teile).

