/* ===== KAPITEL 5 — Betriebsarten: CASE ===== */
defTask({ id:'r3t2', ch:5, title:'CASE für die Statuslampe',
  story:'Die Zelle kennt vier Betriebsarten: 0 = Aus, 1 = Hand, 2 = Automatik, 3 = Wartung. Jede hat ihre eigene Lampe. ARIA hat die Zuordnung gelöscht.',
  brief:'Nutze <code>CASE Modus OF</code>: 1 → <code>Ampel_Gelb := TRUE</code>, 2 → <code>Ampel_Gruen := TRUE</code>, 3 → <code>Ampel_Rot := TRUE</code>. Alle Lampen starten auf <code>FALSE</code>; bei Modus 0 bleibt alles aus.',
  learn:'CASE wählt anhand einer Zahl genau einen Zweig aus.',
  take:'CASE ist die übersichtliche Alternative zu langen IF-Ketten, wenn eine einzige INT-Variable über den Weg entscheidet.',
  vars:{Modus:0, Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:false},
  tests:[[{Modus:1},{Ampel_Rot:false, Ampel_Gelb:true, Ampel_Gruen:false}], [{Modus:2},{Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:true}],
         [{Modus:3},{Ampel_Rot:true, Ampel_Gelb:false, Ampel_Gruen:false}], [{Modus:0},{Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:false}]],
  ref:'CASE Modus OF\n  1: Ampel_Gelb := TRUE;\n  2: Ampel_Gruen := TRUE;\n  3: Ampel_Rot := TRUE;\nEND_CASE;', man:'case', must:['CASE'],
  hint:'Aufbau: <code>CASE Modus OF 1: … ; 2: … ; END_CASE;</code> — nach jedem Fallwert ein Doppelpunkt.',
  bind:['lightRed=Ampel_Rot','lightYellow=Ampel_Gelb','lightGreen=Ampel_Gruen','displayValue=Modus','displayLabel:"MODUS"']
});

defTask({ id:'r3t4', ch:5, title:'Falsche Fallunterscheidung', debug:true,
  story:'Die Wartungslampe leuchtet im Automatikbetrieb — und im Wartungsmodus bleibt sie dunkel. Ein Techniker stand deshalb schon ahnungslos in der laufenden Zelle.',
  brief:'<code>Lampe_Wartung</code> soll nur bei <code>Modus = 3</code> leuchten. Der Code hat den falschen Fallwert. Behebe es.',
  learn:'Fallwerte in CASE genau lesen und gegen die Spezifikation prüfen.',
  take:'Bei CASE entscheidet nur die Zahl vor dem Doppelpunkt. Eine falsche Zahl = der falsche Zweig.',
  vars:{Modus:0, Lampe_Wartung:false},
  tests:[[{Modus:3},{Lampe_Wartung:true}], [{Modus:2, Lampe_Wartung:true},{Lampe_Wartung:false}], [{Modus:0, Lampe_Wartung:true},{Lampe_Wartung:false}]],
  start:'CASE Modus OF\n  2: Lampe_Wartung := TRUE;\nELSE\n  Lampe_Wartung := FALSE;\nEND_CASE;',
  ref:'CASE Modus OF\n  3: Lampe_Wartung := TRUE;\nELSE\n  Lampe_Wartung := FALSE;\nEND_CASE;', man:'case',
  hint:'Welcher Modus ist laut Aufgabe die Wartung?',
  bind:['lightRed=Lampe_Wartung','displayValue=Modus','displayLabel:"MODUS"']
});

defTask({ id:'r3t5', ch:5, title:'Sortierweiche: zwei Ziele',
  story:'Am Bandende sitzt die Sortierweiche. Gute Teile auf Bahn B, Ausschuss auf Bahn A. ARIA hat die Weiche in Mittelstellung festgefroren.',
  brief:'Setze <code>Weiche_Pos</code> mit <code>CASE Teil_Typ OF</code>: <code>1</code> (gut) → <code>-15</code>, <code>2</code> (Ausschuss) → <code>15</code>, sonst → <code>0</code>.',
  learn:'Der ELSE-Zweig in CASE fängt alle nicht aufgeführten Werte ab.',
  take:'<code>ELSE</code> in CASE wirkt wie „für alle anderen Werte“ — damit bleibt die Weiche bei unbekannten Typen in sicherer Mittelstellung.',
  vars:{Teil_Typ:0, Weiche_Pos:0},
  tests:[[{Teil_Typ:1},{Weiche_Pos:-15}], [{Teil_Typ:2},{Weiche_Pos:15}], [{Teil_Typ:0, Weiche_Pos:15},{Weiche_Pos:0}], [{Teil_Typ:9, Weiche_Pos:-15},{Weiche_Pos:0}]],
  ref:'CASE Teil_Typ OF\n  1: Weiche_Pos := -15;\n  2: Weiche_Pos := 15;\nELSE\n  Weiche_Pos := 0;\nEND_CASE;', man:'case', must:['CASE'],
  hint:'Zwei Fallwerte plus ein ELSE-Zweig.',
  bind:['gateAngle=Weiche_Pos',{channel:'partColor', variable:'Teil_Typ', map:{'0':'neutral','1':'green','2':'red','9':'blue'}},'partVisible:true','beltRunning:true','displayValue=Teil_Typ','displayLabel:"TYP"']
});

defTask({ id:'c5_liste', ch:5, title:'Fehlercodes gruppieren',
  story:'Die Zelle meldet Fehlercodes. ARIA erzeugt absichtlich Hunderte davon. Du gruppierst sie: Warnungen gelb, Störungen rot, alles andere grün.',
  brief:'Mit <code>CASE Fehlercode OF</code>:<br>• 1, 2 oder 3 → <code>Ampel_Gelb := TRUE</code> (Warnung)<br>• 10 oder 11 → <code>Ampel_Rot := TRUE</code> (Störung)<br>• sonst → <code>Ampel_Gruen := TRUE</code><br>Alle Lampen starten auf <code>FALSE</code>.',
  learn:'Mehrere Fallwerte in einem Zweig werden mit Komma getrennt.',
  take:'<code>1, 2, 3:</code> — eine Werteliste spart dir drei identische Zweige.',
  vars:{Fehlercode:0, Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:false},
  tests:[[{Fehlercode:2},{Ampel_Gelb:true, Ampel_Rot:false, Ampel_Gruen:false}], [{Fehlercode:3},{Ampel_Gelb:true}], [{Fehlercode:11},{Ampel_Rot:true, Ampel_Gelb:false, Ampel_Gruen:false}],
         [{Fehlercode:10},{Ampel_Rot:true}], [{Fehlercode:0},{Ampel_Gruen:true, Ampel_Rot:false, Ampel_Gelb:false}], [{Fehlercode:5},{Ampel_Gruen:true, Ampel_Gelb:false}]],
  ref:'CASE Fehlercode OF\n  1, 2, 3: Ampel_Gelb := TRUE;\n  10, 11: Ampel_Rot := TRUE;\nELSE\n  Ampel_Gruen := TRUE;\nEND_CASE;', man:'case', must:['CASE'],
  hint:'Schreibe mehrere Werte vor denselben Doppelpunkt: <code>1, 2, 3:</code>',
  bind:['lightRed=Ampel_Rot','lightYellow=Ampel_Gelb','lightGreen=Ampel_Gruen','displayValue=Fehlercode','displayLabel:"CODE"'],
  wrong:['CASE Fehlercode OF\n  1: Ampel_Gelb := TRUE;\n  10: Ampel_Rot := TRUE;\nELSE\n  Ampel_Gruen := TRUE;\nEND_CASE;']
});

defTask({ id:'r3t7', ch:5, title:'Bereichsweise CASE',
  story:'Die Bandgeschwindigkeit wird in Prozent vorgegeben. Die Antriebsstufe hängt vom Bereich ab. ARIA findet Bereiche "zu menschlich".',
  brief:'Setze <code>Band_Stufe</code> mit <code>CASE Geschwindigkeit OF</code>: <code>0..30</code> → <code>1</code>, <code>31..70</code> → <code>2</code>, sonst → <code>3</code>.',
  learn:'CASE-Zweige können ganze Wertebereiche abdecken: <code>0..30:</code>',
  take:'Bereiche schreibt man mit zwei Punkten: <code>31..70</code>. Beide Grenzen gehören dazu. Überschneidungen meldet der Compiler.',
  vars:{Geschwindigkeit:0, Band_Stufe:0},
  tests:[[{Geschwindigkeit:10},{Band_Stufe:1}], [{Geschwindigkeit:30},{Band_Stufe:1}], [{Geschwindigkeit:31},{Band_Stufe:2}], [{Geschwindigkeit:50},{Band_Stufe:2}], [{Geschwindigkeit:90},{Band_Stufe:3}]],
  ref:'CASE Geschwindigkeit OF\n  0..30: Band_Stufe := 1;\n  31..70: Band_Stufe := 2;\nELSE\n  Band_Stufe := 3;\nEND_CASE;', man:'case', must:['CASE','RANGE'],
  hint:'Bereiche: <code>untere..obere:</code> — zwei Punkte, keine Leerzeichen nötig.',
  bind:['beltRunning:true','displayValue=Band_Stufe','displayLabel:"STUFE"']
});

defTask({ id:'c5_else_fehlt', ch:5, title:'Das vergessene ELSE', debug:true,
  story:'Nach einem Wechsel in den unbekannten Modus 7 (ARIA hat ihn erfunden) läuft das Band einfach weiter. Eigentlich soll die Zelle bei ungültigen Modi sicher stoppen.',
  brief:'Modus 1 → <code>Band_Lauf := TRUE</code>, Modus 2 → <code>Band_Lauf := FALSE</code>. Jeder andere Modus → <code>Band_Lauf := FALSE</code> und <code>Stoerung := TRUE</code>. Bei Modus 1 oder 2 ist <code>Stoerung</code> <code>FALSE</code>. Ergänze, was fehlt.',
  learn:'Ohne ELSE passiert bei unerwarteten Werten schlicht — nichts.',
  take:'Ein fehlender ELSE-Zweig ist ein typischer Sicherheitsfehler: Unerwartete Eingaben lassen die Anlage im letzten Zustand weiterlaufen.',
  vars:{Modus:0, Band_Lauf:false, Stoerung:false},
  tests:[[{Modus:1, Stoerung:true},{Band_Lauf:true, Stoerung:false}], [{Modus:2, Band_Lauf:true},{Band_Lauf:false, Stoerung:false}], [{Modus:7, Band_Lauf:true},{Band_Lauf:false, Stoerung:true}], [{Modus:0, Band_Lauf:true},{Band_Lauf:false, Stoerung:true}]],
  start:'CASE Modus OF\n  1:\n    Band_Lauf := TRUE;\n    Stoerung := FALSE;\n  2:\n    Band_Lauf := FALSE;\n    Stoerung := FALSE;\nEND_CASE;',
  ref:'CASE Modus OF\n  1:\n    Band_Lauf := TRUE;\n    Stoerung := FALSE;\n  2:\n    Band_Lauf := FALSE;\n    Stoerung := FALSE;\nELSE\n  Band_Lauf := FALSE;\n  Stoerung := TRUE;\nEND_CASE;', man:'case',
  hint:'Was soll bei allen anderen Modi passieren? Dafür gibt es einen bestimmten Zweig vor END_CASE.',
  bind:['beltRunning=Band_Lauf','faultActive=Stoerung','lightRed=Stoerung','displayValue=Modus','displayLabel:"MODUS"']
});

defTask({ id:'c5_positionen', ch:5, title:'Positionstabelle',
  story:'Der Leitrechner schickt nur Positionsnummern. Deine Aufgabe: jede Nummer in einen Achswinkel übersetzen. Ungültige Nummern sind verdächtig — vermutlich ARIA.',
  brief:'<code>CASE Position OF</code>: 0 → <code>Achse_Grad := 0</code> (Greifstation), 1 → <code>45</code>, 2 → <code>90</code> (Lager), 3 → <code>-90</code> (Nacharbeit). Sonst → Achse bleibt unverändert und <code>Stoerung := TRUE</code>. Bei gültiger Position: <code>Stoerung := FALSE</code>.',
  learn:'CASE als Übersetzungstabelle von Nummern in Werte.',
  take:'Nummern → Werte per CASE ist ein Standardmuster (Rezepte, Positionen, Betriebsarten).',
  vars:{Position:0, Achse_Grad:0, Stoerung:false},
  tests:[[{Position:2},{Achse_Grad:90, Stoerung:false}], [{Position:3},{Achse_Grad:-90}], [{Position:1, Stoerung:true},{Achse_Grad:45, Stoerung:false}], [{Position:0, Achse_Grad:45},{Achse_Grad:0}], [{Position:8, Achse_Grad:45},{Achse_Grad:45, Stoerung:true}]],
  ref:'Stoerung := FALSE;\nCASE Position OF\n  0: Achse_Grad := 0;\n  1: Achse_Grad := 45;\n  2: Achse_Grad := 90;\n  3: Achse_Grad := -90;\nELSE\n  Stoerung := TRUE;\nEND_CASE;', man:'case', must:['CASE'],
  hint:'Tipp: Setze <code>Stoerung := FALSE;</code> vor das CASE und nur im ELSE auf TRUE — das spart Zeilen.',
  bind:['armAngle=Achse_Grad','faultActive=Stoerung','displayValue=Position','displayLabel:"POS-NR"','partVisible:true','gripperOpen:true']
});

defTask({ id:'c5_betrieb', ch:5, title:'Betriebsarten komplett',
  story:'Jetzt die echte Betriebsartenwahl: Jeder Modus steuert Band, Greifer und Lampen gemeinsam. "Jeder Zweig muss die Anlage vollständig beschreiben", sagt der Werkmeister.',
  brief:'<code>CASE Modus OF</code><br>• 0 (Aus): <code>Band_Lauf := FALSE</code>, <code>Ampel_Gruen := FALSE</code>, <code>Ampel_Gelb := FALSE</code><br>• 1 (Hand): <code>Band_Lauf := FALSE</code>, <code>Ampel_Gruen := FALSE</code>, <code>Ampel_Gelb := TRUE</code><br>• 2 (Automatik): <code>Band_Lauf := TRUE</code>, <code>Ampel_Gruen := TRUE</code>, <code>Ampel_Gelb := FALSE</code>',
  learn:'Mehrere Anweisungen pro CASE-Zweig.',
  take:'Beschreibe in jedem Zweig <em>alle</em> betroffenen Ausgänge — sonst „erbt“ ein Modus Zustände aus dem vorherigen.',
  vars:{Modus:0, Band_Lauf:false, Ampel_Gruen:false, Ampel_Gelb:false},
  tests:[[{Modus:2},{Band_Lauf:true, Ampel_Gruen:true, Ampel_Gelb:false}], [{Modus:1, Band_Lauf:true, Ampel_Gruen:true},{Band_Lauf:false, Ampel_Gruen:false, Ampel_Gelb:true}],
         [{Modus:0, Band_Lauf:true, Ampel_Gelb:true, Ampel_Gruen:true},{Band_Lauf:false, Ampel_Gruen:false, Ampel_Gelb:false}]],
  ref:'CASE Modus OF\n  0:\n    Band_Lauf := FALSE;\n    Ampel_Gruen := FALSE;\n    Ampel_Gelb := FALSE;\n  1:\n    Band_Lauf := FALSE;\n    Ampel_Gruen := FALSE;\n    Ampel_Gelb := TRUE;\n  2:\n    Band_Lauf := TRUE;\n    Ampel_Gruen := TRUE;\n    Ampel_Gelb := FALSE;\nEND_CASE;', man:'case', must:['CASE'],
  hint:'Nach dem Doppelpunkt dürfen beliebig viele Anweisungen folgen, bis der nächste Fallwert kommt.',
  bind:['beltRunning=Band_Lauf','lightGreen=Ampel_Gruen','lightYellow=Ampel_Gelb','displayValue=Modus','displayLabel:"MODUS"']
});

defTask({ id:'c5_umbau', ch:5, title:'IF-Kaskade aufräumen',
  story:'ARIAs Vorgänger-Code ist eine unlesbare IF-Kaskade. "Das geht übersichtlicher", sagt der Werkmeister. "Bau das in ein CASE um — gleiches Verhalten, bessere Lesbarkeit."',
  brief:'Der Startcode funktioniert bereits. Schreibe ihn so um, dass er <code>CASE Rezept OF</code> statt IF verwendet. Das Verhalten muss gleich bleiben: 1 → <code>Soll_Temp := 180</code>, 2 → <code>220</code>, 3 oder 4 → <code>250</code>, sonst → <code>0</code>.',
  learn:'Refactoring: Code umbauen, ohne das Verhalten zu ändern.',
  take:'Gleiches Verhalten, bessere Lesbarkeit — genau das ist „Refactoring“. Die Testfälle sichern dich dabei ab.',
  vars:{Rezept:0, Soll_Temp:0},
  tests:[[{Rezept:1},{Soll_Temp:180}], [{Rezept:2},{Soll_Temp:220}], [{Rezept:3},{Soll_Temp:250}], [{Rezept:4},{Soll_Temp:250}], [{Rezept:5, Soll_Temp:180},{Soll_Temp:0}]],
  start:'IF Rezept = 1 THEN\n  Soll_Temp := 180;\nELSIF Rezept = 2 THEN\n  Soll_Temp := 220;\nELSIF Rezept = 3 OR Rezept = 4 THEN\n  Soll_Temp := 250;\nELSE\n  Soll_Temp := 0;\nEND_IF;',
  ref:'CASE Rezept OF\n  1: Soll_Temp := 180;\n  2: Soll_Temp := 220;\n  3, 4: Soll_Temp := 250;\nELSE\n  Soll_Temp := 0;\nEND_CASE;', man:'case', must:['CASE'],
  hint:'Der Startcode besteht die Tests schon — aber die Aufgabe verlangt ausdrücklich CASE.',
  bind:['displayValue=Soll_Temp','displayLabel:"SOLL °C"','lightYellow:true']
});

defTask({ id:'r3t10', ch:5, title:'Betriebsartensteuerung mit Sperre', boss:true,
  story:'ARIA versucht, den Wartungsmodus zu missbrauchen, um die Zelle heimlich zu übernehmen. Du baust eine Sperre: Ist ARIA aktiv und jemand wählt Wartung, geht die Zelle in den sicheren Zustand.',
  brief:'1) Setze zuerst alle drei Lampen auf <code>FALSE</code>.<br>2) Mit <code>CASE Modus OF</code>: 1 → Gelb, 2 → Grün, 3 → Rot an.<br>3) <code>Modus_Gesperrt := ARIA_Aktiv AND (Modus = 3)</code>.<br>4) Wenn gesperrt: <code>Ampel_Rot := TRUE</code>, <code>Ampel_Gelb := FALSE</code>, <code>Ampel_Gruen := FALSE</code> und <code>Band_Lauf := FALSE</code>.<br>5) <code>Band_Lauf</code> ist sonst genau dann TRUE, wenn <code>Modus = 2</code>.',
  learn:'CASE und IF kombinieren; Reihenfolge von „Grundzustand → Auswahl → Übersteuerung“.',
  take:'Das Muster „erst alles aus, dann gezielt einschalten, am Ende Sicherheit übersteuern“ macht Code robust und leicht prüfbar.',
  vars:{Modus:0, ARIA_Aktiv:false, Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:false, Modus_Gesperrt:false, Band_Lauf:false},
  tests:[[{Modus:2, Ampel_Rot:true},{Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:true, Modus_Gesperrt:false, Band_Lauf:true}],
         [{Modus:3, ARIA_Aktiv:true, Band_Lauf:true},{Ampel_Rot:true, Ampel_Gelb:false, Ampel_Gruen:false, Modus_Gesperrt:true, Band_Lauf:false}],
         [{Modus:3, ARIA_Aktiv:false},{Ampel_Rot:true, Modus_Gesperrt:false, Band_Lauf:false}],
         [{Modus:2, ARIA_Aktiv:true},{Ampel_Gruen:true, Modus_Gesperrt:false, Band_Lauf:true}],
         [{Modus:1, Ampel_Gruen:true, Band_Lauf:true},{Ampel_Gelb:true, Ampel_Gruen:false, Band_Lauf:false}]],
  ref:'Ampel_Rot := FALSE;\nAmpel_Gelb := FALSE;\nAmpel_Gruen := FALSE;\nCASE Modus OF\n  1: Ampel_Gelb := TRUE;\n  2: Ampel_Gruen := TRUE;\n  3: Ampel_Rot := TRUE;\nEND_CASE;\nBand_Lauf := Modus = 2;\nModus_Gesperrt := ARIA_Aktiv AND (Modus = 3);\nIF Modus_Gesperrt THEN\n  Ampel_Rot := TRUE;\n  Ampel_Gelb := FALSE;\n  Ampel_Gruen := FALSE;\n  Band_Lauf := FALSE;\nEND_IF;', man:'case', must:['CASE','IF'],
  hint:'Arbeite die fünf Punkte genau in dieser Reihenfolge ab.',
  hint2:'<code>Band_Lauf := Modus = 2;</code> ist eine gültige Zeile: Der Vergleich liefert TRUE oder FALSE.',
  bind:['lightRed=Ampel_Rot','lightYellow=Ampel_Gelb','lightGreen=Ampel_Gruen','faultActive=Modus_Gesperrt','beltRunning=Band_Lauf','displayValue=Modus','displayLabel:"MODUS"']
});
