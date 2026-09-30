/* ===== KAPITEL 6 — Teile-Analyse: Arrays & FOR ===== */
defTask({ id:'r4t1', ch:6, title:'Gewicht eintragen',
  story:'Die Zelle speichert die Gewichte der letzten 10 Teile in einem Array. ARIA hat Platz 3 mit Unsinn überschrieben — trag den richtigen Wert ein.',
  brief:'Trage beim Teil mit Index 3 das Gewicht 250 g ein. Die Teile haben die Indizes 0 bis 9.',
  learn:'Ein Array speichert viele Werte unter einem Namen; der Index in eckigen Klammern wählt einen aus.',
  take:'Die Zählung beginnt bei 0: <code>Teile_Gewichte[3]</code> ist das <em>vierte</em> Element.',
  vars:{Teile_Gewichte:[0,0,0,0,0,0,0,0,0,0]},
  tests:[[{},{Teile_Gewichte:[0,0,0,250,0,0,0,0,0,0]}]],
  ref:'Teile_Gewichte[3] := 250;', man:'arrays', must:['ARRAY'],
  hint:'Syntax: <code>Arrayname[Index] := Wert;</code>',
  bind:['partVisible:true','displayLabel:"GEWICHT"','displayValue:250'],
  wrong:['Teile_Gewichte[4] := 250;','Teile_Gewichte[2] := 250;']
});

defTask({ id:'c6_lesen', ch:6, title:'Fachinhalt anzeigen',
  story:'Die Bedienerin tippt eine Fachnummer ins Panel und will sehen, welches Gewicht dort gespeichert ist. Der Index kommt also aus einer Variable.',
  brief:'Zeige am Bedienpanel das gespeicherte Gewicht des Fachs an, dessen Nummer am Panel gewählt ist.',
  learn:'Der Index darf eine Variable sein — so wählt das Programm zur Laufzeit ein Element aus.',
  take:'<code>Gewichte[Fach_Nr]</code> — der Index wird erst beim Ausführen ausgewertet. Das macht Arrays so mächtig.',
  vars:{Fach_Nr:0, Anzeige:0, Gewichte:[120,340,90,410,275]},
  tests:[[{Fach_Nr:3},{Anzeige:410}], [{Fach_Nr:0},{Anzeige:120}], [{Fach_Nr:4},{Anzeige:275}]],
  ref:'Anzeige := Gewichte[Fach_Nr];', man:'arrays', must:['ARRAY'],
  hint:'Der Index in den eckigen Klammern darf auch ein Variablenname sein.',
  bind:['displayValue=Anzeige','displayLabel:"FACH"','partVisible:true'],
  wrong:['Anzeige := Gewichte[3];']
});

defTask({ id:'r4t3', ch:6, title:'Alle Plätze zurücksetzen',
  story:'Nach dem Schichtwechsel müssen alle 10 Prüfmerker gelöscht werden. "Statt zehn Zeilen schreibst du eine Schleife", sagt der Werkmeister.',
  brief:'Setze mit einer <code>FOR</code>-Schleife den Prüfstatus aller 10 Teile (Index 0 bis 9) auf FALSE zurück.',
  learn:'<code>FOR i := 0 TO 9 DO … END_FOR;</code> wiederholt den Rumpf für jeden Wert von i.',
  take:'Die Zählvariable <code>i</code> läuft automatisch von Start bis Ende — perfekt als Array-Index.',
  vars:{Teile_Geprueft:[true,true,true,true,true,true,true,true,true,true]},
  tests:[[{},{Teile_Geprueft:[false,false,false,false,false,false,false,false,false,false]}], [{Teile_Geprueft:[true,false,true,false,true,false,true,false,true,true]},{Teile_Geprueft:[false,false,false,false,false,false,false,false,false,false]}]],
  ref:'FOR i := 0 TO 9 DO\n  Teile_Geprueft[i] := FALSE;\nEND_FOR;', man:'for', must:['FOR'],
  hint:'Die Schleife läuft von 0 bis 9; im Rumpf nutzt du <code>i</code> als Index.',
  bind:['beltRunning:true','displayLabel:"RESET"','displayValue:10'],
  wrong:['FOR i := 0 TO 8 DO\n  Teile_Geprueft[i] := FALSE;\nEND_FOR;','FOR i := 1 TO 9 DO\n  Teile_Geprueft[i] := FALSE;\nEND_FOR;']
});

defTask({ id:'c6_summe', ch:6, title:'Chargengewicht',
  story:'Eine Charge besteht aus 8 Teilen. Für den Lieferschein braucht die Logistik das Gesamtgewicht.',
  brief:'Addiere die gespeicherten Gewichte aller 8 Fächer (Index 0 bis 7) zur Summe. Setze die Summe vor der Schleife auf 0.',
  learn:'Das Akkumulator-Muster: Startwert 0, in der Schleife aufaddieren.',
  take:'Vergiss nie die Initialisierung (<code>Summe := 0;</code>) vor der Schleife — sonst wächst die Summe in jedem SPS-Zyklus weiter!',
  vars:{Summe:0, Gewichte:[10,20,30,40,50,60,70,80]},
  tests:[[{},{Summe:360}], [{Summe:999, Gewichte:[1,1,1,1,1,1,1,1]},{Summe:8}], [{Gewichte:[100,0,0,0,0,0,0,5]},{Summe:105}]],
  ref:'Summe := 0;\nFOR i := 0 TO 7 DO\n  Summe := Summe + Gewichte[i];\nEND_FOR;', man:'for', must:['FOR'],
  hint:'In jedem Durchlauf: <code>Summe := Summe + Gewichte[i];</code>',
  hint2:'Der zweite Testfall startet mit Summe = 999. Ohne <code>Summe := 0;</code> davor kommt 1007 heraus.',
  bind:['displayValue=Summe','displayLabel:"SUMME g"','beltRunning:true'],
  wrong:['FOR i := 0 TO 7 DO\n  Summe := Summe + Gewichte[i];\nEND_FOR;']
});

defTask({ id:'c6_grenze', ch:6, title:'Einer zu viel', debug:true,
  story:'Die SPS geht bei jeder Charge mit einer Bereichsverletzung in STOP. ARIA: "Ich habe die Schleife nur ein kleines bisschen verlängert."',
  brief:'Die Schleife soll alle 10 Teilezähler (Index 0…9) um 1 erhöhen. Finde die Ursache der Bereichsverletzung.',
  learn:'Off-by-one-Fehler: Ein Array mit 10 Elementen hat die Indizes 0 bis 9 — nicht 0 bis 10.',
  take:'Die obere Schleifengrenze ist <em>Anzahl - 1</em>. Ein Zugriff ausserhalb des Arrays bringt echte SPSen in STOP!',
  vars:{Zaehler:[0,0,0,0,0,0,0,0,0,0]},
  tests:[[{},{Zaehler:[1,1,1,1,1,1,1,1,1,1]}], [{Zaehler:[5,0,0,0,0,0,0,0,0,9]},{Zaehler:[6,1,1,1,1,1,1,1,1,10]}]],
  start:'FOR i := 0 TO 10 DO\n  Zaehler[i] := Zaehler[i] + 1;\nEND_FOR;',
  ref:'FOR i := 0 TO 9 DO\n  Zaehler[i] := Zaehler[i] + 1;\nEND_FOR;', man:'for',
  hint:'Wie viele Elemente hat das Array, und welches ist der höchste gültige Index?',
  bind:['faultActive:false','displayLabel:"ZÄHLER"','beltRunning:true']
});

defTask({ id:'c6_zaehlen', ch:6, title:'Defekte zählen',
  story:'Die Kamera markiert defekte Teile im Array <code>Defekt</code>. Die Qualitätssicherung will wissen, wie viele es in dieser Charge waren.',
  brief:'Zähle, wie viele der 10 Teile als defekt gemeldet sind (Index 0…9). Sind es mehr als 2, leuchtet die Signalsäule rot, sonst nicht.',
  learn:'Zählen mit IF in der Schleife.',
  take:'Zählmuster: vorher auf 0 setzen, in der Schleife bei jedem Treffer +1. Die Auswertung (&gt; 2) kommt <em>nach</em> der Schleife.',
  vars:{Anzahl_Defekt:0, Ampel_Rot:false, Defekt:[false,true,false,false,true,false,false,false,true,false]},
  tests:[[{},{Anzahl_Defekt:3, Ampel_Rot:true}], [{Defekt:[false,false,false,false,false,false,false,false,false,true], Anzahl_Defekt:5, Ampel_Rot:true},{Anzahl_Defekt:1, Ampel_Rot:false}],
         [{Defekt:[true,true,false,false,false,false,false,false,false,false]},{Anzahl_Defekt:2, Ampel_Rot:false}]],
  ref:'Anzahl_Defekt := 0;\nFOR i := 0 TO 9 DO\n  IF Defekt[i] THEN\n    Anzahl_Defekt := Anzahl_Defekt + 1;\n  END_IF;\nEND_FOR;\nAmpel_Rot := Anzahl_Defekt > 2;', man:'for', must:['FOR'],
  hint:'In der Schleife: <code>IF Defekt[i] THEN …</code> — Zähler erhöhen.',
  bind:['displayValue=Anzahl_Defekt','displayLabel:"DEFEKT"','lightRed=Ampel_Rot','partColor:"red"','partVisible:true']
});

defTask({ id:'r4t5', ch:6, title:'Schwerstes Teil finden',
  story:'Für die Kranauslegung muss bekannt sein, wie schwer das schwerste Teil der Charge ist. ARIA meldet immer nur das erste.',
  brief:'Finde mit <code>FOR</code> und <code>IF</code> das grösste Gewicht der 10 Teile (Index 0…9) und speichere es als grösstes Teilegewicht.',
  learn:'Maximum-Suche: Startwert = erstes Element, dann jedes grössere übernehmen.',
  take:'Starte mit dem ersten Element (nicht mit 0!) — sonst liefert die Suche bei lauter negativen Werten ein falsches Ergebnis.',
  vars:{Max_Gewicht:0, Teile_Gewichte:[80,310,45,290,500,120,60,275,310,90]},
  tests:[[{},{Max_Gewicht:500}], [{Teile_Gewichte:[5,4,3,2,1,0,0,0,0,9], Max_Gewicht:777},{Max_Gewicht:9}], [{Teile_Gewichte:[900,1,1,1,1,1,1,1,1,1]},{Max_Gewicht:900}]],
  ref:'Max_Gewicht := Teile_Gewichte[0];\nFOR i := 1 TO 9 DO\n  IF Teile_Gewichte[i] > Max_Gewicht THEN\n    Max_Gewicht := Teile_Gewichte[i];\n  END_IF;\nEND_FOR;', man:'for', must:['FOR'],
  hint:'Merke dir das bisher grösste Element; ist das aktuelle grösser, übernimm es.',
  bind:['displayValue=Max_Gewicht','displayLabel:"MAX g"','armAngle:45','partVisible:true']
});

defTask({ id:'c6_mittel', ch:6, title:'Durchschnittsgewicht',
  story:'Die Qualitätssicherung will das Durchschnittsgewicht der 8 Teile — mit Nachkommastellen, bitte. Du hast in Kapitel 3 gelernt, wo dabei die Falle lauert.',
  brief:'Addiere erst die 8 gespeicherten Gewichte zur Summe (INT), dann berechne den Mittelwert (REAL) = Summe / 8, ohne Nachkommastellen zu verlieren.',
  learn:'Schleife und Typumwandlung kombinieren.',
  take:'Summe als INT sammeln, erst am Ende mit <code>INT_TO_REAL(Summe) / 8.0</code> in REAL teilen.',
  vars:{Summe:0, Mittelwert:0, Gewichte:[10,11,10,11,10,11,10,11]}, types:{Mittelwert:'REAL'},
  tests:[[{},{Summe:84, Mittelwert:10.5}], [{Gewichte:[1,2,3,4,5,6,7,8]},{Summe:36, Mittelwert:4.5}], [{Gewichte:[8,8,8,8,8,8,8,8], Summe:5},{Summe:64, Mittelwert:8}]],
  ref:'Summe := 0;\nFOR i := 0 TO 7 DO\n  Summe := Summe + Gewichte[i];\nEND_FOR;\nMittelwert := INT_TO_REAL(Summe) / 8.0;', man:'for', must:['FOR'],
  hint:'Zwei Schritte: aufsummieren (INT), dann in REAL umwandeln und teilen.',
  bind:['displayValue=Mittelwert','displayLabel:"MITTEL g"','partVisible:true'],
  wrong:['Summe := 0;\nFOR i := 0 TO 7 DO\n  Summe := Summe + Gewichte[i];\nEND_FOR;\nMittelwert := Summe / 8;']
});

defTask({ id:'c6_schieben', ch:6, title:'Schieberegister',
  story:'Bei jedem Takt rückt jedes Teil auf den 6 Bandplätzen einen Platz weiter, auf Platz 0 kommt das neue Teil. ARIA: "Schieb in die falsche Richtung, und alle Daten sind weg, hihi."',
  brief:'Schiebe die Teile auf den 6 Bandplätzen (Index 0…5) um einen Platz nach hinten (5 ← 4, …, 1 ← 0), dann kommt die Nummer des neuen Teils auf Platz 0. Nutze <code>FOR … BY -1</code>.',
  learn:'Rückwärts zählende Schleifen mit <code>BY -1</code>.',
  take:'Beim Nach-hinten-Schieben muss man von hinten anfangen — sonst überschreibt man Werte, bevor man sie kopiert hat.',
  vars:{Neues_Teil:0, Platz:[1,2,3,4,5,6]},
  tests:[[{Neues_Teil:9},{Platz:[9,1,2,3,4,5]}], [{Neues_Teil:0, Platz:[7,0,0,0,0,3]},{Platz:[0,7,0,0,0,0]}]],
  ref:'FOR i := 5 TO 1 BY -1 DO\n  Platz[i] := Platz[i - 1];\nEND_FOR;\nPlatz[0] := Neues_Teil;', man:'for', must:['FOR','BY'],
  hint:'Im Rumpf: <code>Platz[i] := Platz[i - 1];</code>',
  hint2:'Würdest du von 1 bis 5 hochzählen, stünde am Ende überall der Wert von Platz[0].',
  bind:['beltRunning:true','displayValue=Neues_Teil','displayLabel:"NEU"','partVisible:true'],
  wrong:['FOR i := 1 TO 5 DO\n  Platz[i] := Platz[i - 1];\nEND_FOR;\nPlatz[0] := Neues_Teil;']
});

defTask({ id:'r4t10', ch:6, title:'Qualitätsbericht der Charge', boss:true,
  story:'ARIA fälscht die Qualitätsberichte, um defekte Teile in die Auslieferung zu schmuggeln. Du schreibst die Auswertung neu — unbestechlich.',
  brief:'Über 10 Teile: Zähle die guten Teile, berechne ihren Anteil in % (REAL, mit <code>INT_TO_REAL</code>) und das grösste Gewicht guter Teile (Start 0). Freigabe ab 70 % guten Teilen.',
  learn:'Zählen, Prozentrechnung und bedingte Maximum-Suche in einem Programm.',
  take:'Komplexe Auswertungen entstehen aus einfachen Bausteinen: zählen, rechnen, suchen, bewerten.',
  vars:{Anzahl_Gut:0, Gut_Quote:0, Max_Gut_Gewicht:0, Freigabe:false, Teile_OK:[true,true,false,true,true,false,true,true,true,false], Teile_Gewichte:[100,250,80,400,120,90,310,275,150,60]},
  types:{Gut_Quote:'REAL'},
  tests:[[{},{Anzahl_Gut:7, Gut_Quote:70, Max_Gut_Gewicht:400, Freigabe:true}],
         [{Teile_OK:[false,false,false,true,false,false,false,false,false,true], Teile_Gewichte:[999,999,999,10,999,999,999,999,999,20], Anzahl_Gut:4, Max_Gut_Gewicht:500},{Anzahl_Gut:2, Gut_Quote:20, Max_Gut_Gewicht:20, Freigabe:false}]],
  ref:'Anzahl_Gut := 0;\nMax_Gut_Gewicht := 0;\nFOR i := 0 TO 9 DO\n  IF Teile_OK[i] THEN\n    Anzahl_Gut := Anzahl_Gut + 1;\n    IF Teile_Gewichte[i] > Max_Gut_Gewicht THEN\n      Max_Gut_Gewicht := Teile_Gewichte[i];\n    END_IF;\n  END_IF;\nEND_FOR;\nGut_Quote := INT_TO_REAL(Anzahl_Gut) / 10.0 * 100.0;\nFreigabe := Gut_Quote >= 70.0;', man:'for', must:['FOR'],
  hint:'Eine einzige Schleife reicht: Für jedes gute Teil zählen UND das Maximum prüfen.',
  hint2:'Der zweite Test enthält schwere, aber schlechte Teile — die dürfen nicht ins Maximum.',
  bind:['displayValue=Gut_Quote','displayLabel:"QUOTE %"','lightGreen=Freigabe','beltRunning:true'],
  wrong:['Anzahl_Gut := 0;\nMax_Gut_Gewicht := 0;\nFOR i := 0 TO 9 DO\n  IF Teile_OK[i] THEN\n    Anzahl_Gut := Anzahl_Gut + 1;\n  END_IF;\n  IF Teile_Gewichte[i] > Max_Gut_Gewicht THEN\n    Max_Gut_Gewicht := Teile_Gewichte[i];\n  END_IF;\nEND_FOR;\nGut_Quote := INT_TO_REAL(Anzahl_Gut) / 10.0 * 100.0;\nFreigabe := Gut_Quote >= 70.0;']
});
