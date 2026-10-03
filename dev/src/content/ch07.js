/* ===== KAPITEL 7 — Schleifen-Labyrinth: WHILE, REPEAT, EXIT, CONTINUE ===== */
defTask({ id:'c7_kisten', ch:7, title:'Wie viele Kisten?',
  story:'In jede Versandkiste passen 12 Teile, und die Logistik will wissen, wie viele Kisten eine Bestellung braucht. ARIA schlägt vor, "einfach alle" zu nehmen.',
  brief:'Wie viele Kisten zu je 12 Teilen braucht es? Zum Beispiel mit <code>WHILE</code>: Rest = Anzahl Teile, Kisten = 0; solange Rest &gt; 0: eine Kiste mehr, Rest um 12 verringern.',
  learn:'WHILE wiederholt, solange eine Bedingung TRUE ist — die Anzahl der Durchläufe steht vorher nicht fest.',
  take:'WHILE prüft <em>vor</em> jedem Durchlauf. Ist die Bedingung schon am Anfang FALSE (0 Teile), läuft der Rumpf kein einziges Mal.',
  vars:{Teile:0, Rest:0, Kisten:0},
  tests:[[{Teile:25},{Kisten:3}], [{Teile:24},{Kisten:2}], [{Teile:0, Kisten:5},{Kisten:0}], [{Teile:1},{Kisten:1}]],
  ref:'Rest := Teile;\nKisten := 0;\nWHILE Rest > 0 DO\n  Kisten := Kisten + 1;\n  Rest := Rest - 12;\nEND_WHILE;', man:'while', must:['WHILE'],
  hint:'Im Schleifenrumpf müssen zwei Dinge passieren: Kisten zählen und Rest verringern.',
  bind:['displayValue=Kisten','displayLabel:"KISTEN"','beltRunning:true','partVisible:true']
});

defTask({ id:'r4t9', ch:7, title:'ARIAs Endlosschleife', debug:true,
  story:'Die SPS hängt, der Watchdog hat sie in STOP geschickt. ARIA summt vergnügt: "Manche Schleifen sind einfach zu schön, um zu enden."',
  brief:'Der Code soll bis 10 geprüfte Teile zählen und dabei melden, dass alle Teile geprüft sind. Er hängt sich aber auf. Behebe es.',
  learn:'Eine WHILE-Schleife braucht im Rumpf eine Änderung, die die Bedingung irgendwann FALSE macht.',
  take:'Endlosschleifen sind in einer SPS fatal: Der Zyklus endet nie, die Zykluszeitüberwachung schlägt zu und die Anlage geht in STOP.',
  vars:{Teile_Zaehler:0, Alle_Geprueft:false},
  tests:[[{},{Teile_Zaehler:10, Alle_Geprueft:true}]],
  start:'Teile_Zaehler := 0;\nWHILE Teile_Zaehler < 10 DO\n  Alle_Geprueft := TRUE;\nEND_WHILE;',
  ref:'Teile_Zaehler := 0;\nWHILE Teile_Zaehler < 10 DO\n  Alle_Geprueft := TRUE;\n  Teile_Zaehler := Teile_Zaehler + 1;\nEND_WHILE;', man:'while',
  hint:'Welche Variable müsste sich in jedem Durchlauf ändern, damit <code>Teile_Zaehler &lt; 10</code> irgendwann FALSE wird?',
  bind:['displayValue=Teile_Zaehler','displayLabel:"ZÄHLER"','lightGreen=Alle_Geprueft']
});

defTask({ id:'c7_suche', ch:7, title:'Erster Defekt',
  story:'Nur das ERSTE defekte Teil zählt — dort muss der Greifer eingreifen. Nach dem ersten Treffer weitersuchen ist Zeitverschwendung.',
  brief:'Suche mit <code>FOR</code> das <strong>erste</strong> defekte Teil (Index 0…7), speichere seinen Index als Position und verlasse die Schleife mit <code>EXIT</code>. Kein Defekt → -1.',
  learn:'<code>EXIT</code> bricht eine Schleife sofort ab.',
  take:'Suchmuster: Ergebnis vorher auf „nicht gefunden“ (-1) setzen, beim ersten Treffer speichern und EXIT.',
  vars:{Position:0, Defekt:[false,false,true,false,true,false,false,false]},
  tests:[[{},{Position:2}], [{Defekt:[false,false,false,false,false,false,false,true]},{Position:7}], [{Defekt:[false,false,false,false,false,false,false,false], Position:3},{Position:-1}], [{Defekt:[true,true,true,true,true,true,true,true]},{Position:0}]],
  ref:'Position := -1;\nFOR i := 0 TO 7 DO\n  IF Defekt[i] THEN\n    Position := i;\n    EXIT;\n  END_IF;\nEND_FOR;', man:'while', must:['FOR','EXIT'],
  hint:'Innerhalb des IF: erst Position speichern, dann <code>EXIT;</code>',
  bind:['displayValue=Position','displayLabel:"POS"','partColor:"red"','partVisible:true']
});

defTask({ id:'c7_repeat', ch:7, title:'Losgrösse verdoppeln',
  story:'Die Fertigung arbeitet in Losgrössen, die sich immer verdoppeln: 1, 2, 4, 8, … Gesucht ist die kleinste Losgrösse, die den Bedarf deckt — mindestens aber 1.',
  brief:'Verdopple die Losgrösse ab 1 mit <code>REPEAT … UNTIL</code>, bis sie den Bedarf deckt (1, 2, 4, 8 …). REPEAT läuft mindestens einmal: Verdopple im Rumpf nur, solange sie noch zu klein ist.',
  learn:'REPEAT prüft die Bedingung erst <em>nach</em> dem Durchlauf — der Rumpf läuft also mindestens einmal.',
  take:'WHILE = „prüfen, dann machen“. REPEAT = „machen, dann prüfen“. Die Abbruchbedingung bei UNTIL ist das Gegenteil einer WHILE-Bedingung.',
  vars:{Bedarf:0, Los:0},
  tests:[[{Bedarf:5},{Los:8}], [{Bedarf:8},{Los:8}], [{Bedarf:1},{Los:1}], [{Bedarf:0},{Los:1}], [{Bedarf:100},{Los:128}]],
  ref:'Los := 1;\nREPEAT\n  IF Los < Bedarf THEN\n    Los := Los * 2;\n  END_IF;\nUNTIL Los >= Bedarf\nEND_REPEAT;', man:'while', must:['REPEAT'],
  hint:'Aufbau: <code>REPEAT … UNTIL Bedingung END_REPEAT;</code> — die Schleife endet, wenn die Bedingung TRUE wird.',
  bind:['displayValue=Los','displayLabel:"LOS"','beltRunning:true']
});

defTask({ id:'c7_continue', ch:7, title:'Messfehler überspringen',
  story:'Der Temperatursensor liefert manchmal -1 — das bedeutet "Messung ungültig". ARIA lässt diese Werte absichtlich in die Summe einfliessen.',
  brief:'Summiere alle Messwerte (Index 0…5), überspringe negative (ungültige) mit <code>CONTINUE</code>. Zähle zusätzlich, wie viele gültige Messwerte addiert wurden.',
  learn:'<code>CONTINUE</code> springt sofort zum nächsten Schleifendurchlauf.',
  take:'CONTINUE überspringt den Rest des aktuellen Durchlaufs — ideal zum Ausfiltern ungültiger Daten.',
  vars:{Summe:0, Gueltig:0, Messung:[20,-1,22,24,-1,26]},
  tests:[[{},{Summe:92, Gueltig:4}], [{Messung:[-1,-1,-1,-1,-1,-1], Summe:7, Gueltig:2},{Summe:0, Gueltig:0}], [{Messung:[1,2,3,4,5,6]},{Summe:21, Gueltig:6}]],
  ref:'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 5 DO\n  IF Messung[i] < 0 THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;', man:'while', must:['FOR','CONTINUE'],
  hint:'Prüfe am Anfang des Rumpfs: Ist der Wert negativ → <code>CONTINUE;</code>',
  bind:['displayValue=Summe','displayLabel:"SUMME"','lightYellow:true']
});

defTask({ id:'c7_lagerplatz', ch:7, title:'Freien Lagerplatz finden',
  story:'Im Regal stehen 10 Plätze: belegte enthalten eine Teilenummer, freie eine 0. Du suchst den ersten freien Platz, ohne über das Regalende hinaus zu suchen!',
  brief:'Suche mit <code>WHILE</code> und dem Laufindex den ersten freien Lagerplatz (Wert 0, Index 0…9), sonst -1. Lies nie Index 10: prüfe den Index getrennt, z. B. mit EXIT.',
  learn:'Suchschleifen sicher begrenzen: nie über das Array-Ende hinaus zugreifen.',
  take:'SCL wertet beide Seiten eines AND aus. <code>i &lt; 10 AND Lager[i] …</code> greift deshalb bei i = 10 trotzdem auf Lager[10] zu → Bereichsfehler.',
  vars:{i:0, Frei_Platz:0, Lager:[17,4,0,9,0,0,3,0,0,0]},
  tests:[[{},{Frei_Platz:2}], [{Lager:[0,1,1,1,1,1,1,1,1,1]},{Frei_Platz:0}], [{Lager:[1,1,1,1,1,1,1,1,1,1]},{Frei_Platz:-1}], [{Lager:[1,1,1,1,1,1,1,1,1,0]},{Frei_Platz:9}]],
  ref:'Frei_Platz := -1;\ni := 0;\nWHILE i < 10 DO\n  IF Lager[i] = 0 THEN\n    Frei_Platz := i;\n    EXIT;\n  END_IF;\n  i := i + 1;\nEND_WHILE;', man:'while', must:['WHILE'],
  hint:'Laufe mit <code>WHILE i &lt; 10</code> durch und brich beim ersten freien Platz mit EXIT ab.',
  hint2:'Vergiss nicht, <code>i</code> am Anfang auf 0 zu setzen und im Rumpf zu erhöhen.',
  bind:['displayValue=Frei_Platz','displayLabel:"FREI"','armAngle:90','partVisible:true'],
  wrong:['Frei_Platz := -1;\ni := 0;\nWHILE i < 10 AND Lager[i] <> 0 DO\n  i := i + 1;\nEND_WHILE;\nIF i < 10 THEN\n  Frei_Platz := i;\nEND_IF;']
});

defTask({ id:'c7_exit_dbg', ch:7, title:'Der letzte statt der erste', debug:true,
  story:'Die Suche nach dem ersten Teil mit Übergewicht meldet immer das LETZTE. ARIA: "Das Letzte ist doch auch ein Erstes — von hinten betrachtet."',
  brief:'Gesucht ist der Index des <strong>ersten</strong> Teils über 500 g (sonst -1). Der Code liefert aber das falsche Teil. Finde den Fehler.',
  learn:'Ohne EXIT läuft eine Suchschleife weiter und überschreibt frühere Treffer.',
  take:'„Erster Treffer“ braucht EXIT. „Letzter Treffer“ ergibt sich automatisch, wenn die Schleife ohne EXIT durchläuft.',
  vars:{Erster_Schwer:0, Gewicht:[200,650,300,720,100]},
  tests:[[{},{Erster_Schwer:1}], [{Gewicht:[100,100,100,100,900]},{Erster_Schwer:4}], [{Gewicht:[1,1,1,1,1], Erster_Schwer:2},{Erster_Schwer:-1}]],
  start:'Erster_Schwer := -1;\nFOR i := 0 TO 4 DO\n  IF Gewicht[i] > 500 THEN\n    Erster_Schwer := i;\n  END_IF;\nEND_FOR;',
  ref:'Erster_Schwer := -1;\nFOR i := 0 TO 4 DO\n  IF Gewicht[i] > 500 THEN\n    Erster_Schwer := i;\n    EXIT;\n  END_IF;\nEND_FOR;', man:'while',
  hint:'Was passiert nach dem ersten Treffer? Die Schleife läuft weiter …',
  bind:['displayValue=Erster_Schwer','displayLabel:"INDEX"','partVisible:true']
});

defTask({ id:'c7_doppelt', ch:7, title:'Doppelte Seriennummern',
  story:'ARIA hat eine gefälschte Seriennummer in die Charge geschmuggelt — eine Kopie einer echten. Finde heraus, ob irgendeine Nummer doppelt vorkommt.',
  brief:'Prüfe mit zwei verschachtelten <code>FOR</code>-Schleifen, ob zwei der 6 Teilecodes (Index 0…5) gleich sind: aussen 0 bis 4, innen ab äusserem Index + 1 bis 5. Melde einen doppelten Code.',
  learn:'Verschachtelte Schleifen vergleichen jedes Element mit jedem anderen.',
  take:'Die innere Schleife startet bei <code>i + 1</code> — so wird jedes Paar genau einmal verglichen und kein Element mit sich selbst.',
  vars:{Doppelt:false, Codes:[101,205,333,410,205,599]},
  tests:[[{},{Doppelt:true}], [{Codes:[1,2,3,4,5,6], Doppelt:true},{Doppelt:false}], [{Codes:[7,1,2,3,4,7]},{Doppelt:true}], [{Codes:[9,9,1,2,3,4]},{Doppelt:true}]],
  ref:'Doppelt := FALSE;\nFOR i := 0 TO 4 DO\n  FOR j := i + 1 TO 5 DO\n    IF Codes[i] = Codes[j] THEN\n      Doppelt := TRUE;\n    END_IF;\n  END_FOR;\nEND_FOR;', man:'for', must:['FOR'],
  hint:'Vergleiche <code>Codes[i]</code> mit <code>Codes[j]</code> in der inneren Schleife.',
  hint2:'Starte die innere Schleife bei 0, vergleichst du jedes Element auch mit sich selbst — dann ist immer alles „doppelt“.',
  bind:['faultActive=Doppelt','lightRed=Doppelt','partVisible:true'],
  wrong:['Doppelt := FALSE;\nFOR i := 0 TO 5 DO\n  FOR j := 0 TO 5 DO\n    IF Codes[i] = Codes[j] THEN\n      Doppelt := TRUE;\n    END_IF;\n  END_FOR;\nEND_FOR;']
});

defTask({ id:'c7_sortieren', ch:7, title:'Sortieren wie ein Profi',
  story:'Der Lagerverwalter will die fünf Teilelängen aufsteigend sortiert sehen. ARIA spottet, Sortieren sei Maschinensache, also zeig ihr, dass du es auch kannst.',
  brief:'Sortiere die 5 Teilelängen (Index 0…4) aufsteigend mit Bubblesort: aussen 4 Durchläufe, innen 0 bis 3. Ist ein Wert grösser als sein Nachbar, tausche beide über den Zwischenspeicher.',
  learn:'Werte tauschen mit einer Hilfsvariable; ein vollständiger Sortieralgorithmus.',
  take:'Tauschen braucht immer einen Zwischenspeicher: <code>Temp := a; a := b; b := Temp;</code>',
  vars:{Temp:0, Laenge:[42,17,99,3,56]},
  tests:[[{},{Laenge:[3,17,42,56,99]}], [{Laenge:[5,4,3,2,1]},{Laenge:[1,2,3,4,5]}], [{Laenge:[1,2,3,4,5]},{Laenge:[1,2,3,4,5]}], [{Laenge:[8,8,1,8,1]},{Laenge:[1,1,8,8,8]}]],
  ref:'FOR i := 1 TO 4 DO\n  FOR j := 0 TO 3 DO\n    IF Laenge[j] > Laenge[j + 1] THEN\n      Temp := Laenge[j];\n      Laenge[j] := Laenge[j + 1];\n      Laenge[j + 1] := Temp;\n    END_IF;\n  END_FOR;\nEND_FOR;', man:'for', must:['FOR'],
  hint:'Tauschen in drei Zeilen: <code>Temp := Laenge[j];</code> … ',
  hint2:'Die äussere Schleife braucht keine eigene Zählvariable im Rumpf — sie sorgt nur dafür, dass die innere oft genug läuft.',
  bind:['displayLabel:"SORT"','beltRunning:true','partVisible:true'],
  wrong:['FOR j := 0 TO 3 DO\n  IF Laenge[j] > Laenge[j + 1] THEN\n    Temp := Laenge[j];\n    Laenge[j] := Laenge[j + 1];\n    Laenge[j + 1] := Temp;\n  END_IF;\nEND_FOR;']
});

defTask({ id:'c7_boss', ch:7, title:'Die Lagerverwaltung', boss:true,
  story:'ARIA hat das Lagerverwaltungssystem gelöscht, und neue Teile stapeln sich am Band. Du baust die Einlagerung neu: freien Platz finden, einlagern, Belegung melden.',
  brief:'Lager, 8 Plätze (0 = frei): Suche den ersten freien Platz (Index, sonst -1). Ist einer frei und ein neues Teil da (≠ 0): eintragen, Achse 90 Grad. Zähle belegte Plätze; alle belegt → Lager voll, Rot an.',
  learn:'Suche, bedingtes Schreiben und Zählen kombinieren.',
  take:'Getrennte Schleifen für getrennte Aufgaben (suchen, dann zählen) sind oft klarer als eine „Alles-in-einem“-Schleife.',
  vars:{Neues_Teil:0, Platz_Nr:0, Belegt:0, Lager_Voll:false, Ampel_Rot:false, Achse_Grad:0, Lager:[5,0,7,0,0,0,0,0]},
  tests:[[{Neues_Teil:42},{Platz_Nr:1, Lager:[5,42,7,0,0,0,0,0], Belegt:3, Lager_Voll:false, Ampel_Rot:false, Achse_Grad:90}],
         [{Neues_Teil:9, Lager:[1,2,3,4,5,6,7,0]},{Platz_Nr:7, Lager:[1,2,3,4,5,6,7,9], Belegt:8, Lager_Voll:true, Ampel_Rot:true}],
         [{Neues_Teil:9, Lager:[1,2,3,4,5,6,7,8]},{Platz_Nr:-1, Lager:[1,2,3,4,5,6,7,8], Belegt:8, Lager_Voll:true, Achse_Grad:0}],
         [{Neues_Teil:0},{Platz_Nr:1, Lager:[5,0,7,0,0,0,0,0], Belegt:2, Achse_Grad:0}]],
  ref:'Platz_Nr := -1;\nFOR i := 0 TO 7 DO\n  IF Lager[i] = 0 THEN\n    Platz_Nr := i;\n    EXIT;\n  END_IF;\nEND_FOR;\nIF Platz_Nr >= 0 AND Neues_Teil <> 0 THEN\n  Lager[Platz_Nr] := Neues_Teil;\n  Achse_Grad := 90;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 7 DO\n  IF Lager[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;\nLager_Voll := Belegt = 8;\nAmpel_Rot := Lager_Voll;', man:'while', must:['FOR','EXIT'],
  hint:'Vier Schritte, vier Codeblöcke. Die Suche aus „Erster Defekt“ kannst du fast unverändert übernehmen.',
  hint2:'Achtung: Bei <code>Platz_Nr = -1</code> darfst du nicht in <code>Lager[Platz_Nr]</code> schreiben — prüfe das im IF.',
  bind:['displayValue=Belegt','displayLabel:"BELEGT"','armAngle=Achse_Grad','lightRed=Ampel_Rot','partVisible:true','gripperOpen:false']
});
