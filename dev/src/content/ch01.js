/* ===== KAPITEL 1 — Erste Bewegungen: Zuweisung & Datentypen ===== */
defTask({ id:'r1t1', ch:1, title:'Greifer öffnen',
  story:'ARIA meldet süffisant: "Der Greifer reagiert nicht mehr auf Automatikbefehle, vielleicht schaffst du es manuell, Lehrling?" Du übernimmst die erste Handlung in der Zelle.',
  brief:'Setze die Variable <code>Greifer_Auf</code> mit einer Zuweisung auf <code>TRUE</code>, um den Greifer zu öffnen.',
  learn:'Eine Zuweisung schreibt einen Wert in eine Variable: <code>Variable := Wert;</code>',
  take:'Jede Anweisung in SCL endet mit einem Semikolon. <code>:=</code> heisst „bekommt den Wert“.',
  vars:{Greifer_Auf:false},
  tests:[[{}, {Greifer_Auf:true}]],
  ref:'Greifer_Auf := TRUE;', man:'grundlagen',
  hint:'Der Zuweisungsoperator ist <code>:=</code> — nicht <code>=</code>.',
  hint2:'Die Lösung hat genau eine Zeile: Variablenname, <code>:=</code>, <code>TRUE</code>, Semikolon.',
  bind:['gripperOpen=Greifer_Auf','partVisible:true'],
  wrong:['Greifer_Auf := FALSE;']
});

defTask({ id:'c1_arm', ch:1, title:'Achse auf 45 Grad',
  story:'Der Werkmeister tippt auf das Bedienpanel: "Die Achse steht auf 0 Grad, direkt über der Greifstation. Schwenk sie mal auf 45 Grad, damit wir sehen, ob der Antrieb noch lebt."',
  brief:'Die Variable <code>Achse_Grad</code> ist eine ganze Zahl (<code>INT</code>). Setze sie auf <code>45</code>.',
  learn:'Ganzzahlen (INT) schreibt man ohne Anführungszeichen und ohne Einheit.',
  take:'INT-Variablen speichern ganze Zahlen wie 45 oder -90. Die Einheit (Grad) steckt nur im Namen.',
  vars:{Achse_Grad:0},
  tests:[[{}, {Achse_Grad:45}]],
  ref:'Achse_Grad := 45;', man:'grundlagen',
  hint:'Genau wie beim Greifer — nur mit einer Zahl statt TRUE.',
  bind:['armAngle=Achse_Grad','partVisible:true'],
  wrong:['Achse_Grad := 90;']
});

defTask({ id:'r1t3', ch:1, title:'Tippfehler in der Achssteuerung', debug:true,
  story:'Der vorherige Techniker hat geschlampt. ARIA grinst durch den Lautsprecher: "Ein Syntaxfehler, wie peinlich für einen Menschen."',
  brief:'Der Code soll den Arm auf 90° (Ablage LAGER) fahren und den Greifer schliessen, lässt sich aber nicht übersetzen. Finde und behebe den Syntaxfehler, ohne die Logik zu verändern.',
  learn:'Compiler-Meldungen lesen: Zeilennummer und Beschreibung führen dich direkt zum Fehler.',
  take:'<code>=</code> vergleicht, <code>:=</code> weist zu. Diese Verwechslung ist der häufigste Anfängerfehler in SCL.',
  vars:{Achse_Grad:0, Greifer_Auf:true},
  tests:[[{}, {Achse_Grad:90, Greifer_Auf:false}]],
  start:'Achse_Grad = 90;\nGreifer_Auf := FALSE;',
  ref:'Achse_Grad := 90;\nGreifer_Auf := FALSE;', man:'grundlagen',
  hint:'Schau dir Zeile 1 genau an. Welches Zeichen fehlt im Vergleich zu Zeile 2?',
  bind:['armAngle=Achse_Grad','gripperOpen=Greifer_Auf','partVisible:true']
});

defTask({ id:'c1_band', ch:1, title:'Band und Signalsäule',
  story:'"Wenn das Band läuft, muss die Signalsäule grün zeigen — so weiss jeder in der Halle, dass hier gearbeitet wird", erklärt der Werkmeister.',
  brief:'Schalte das Förderband ein und lass die Signalsäule grün leuchten. Zwei Anweisungen, jede mit eigenem Semikolon.',
  learn:'Ein Programm besteht aus mehreren Anweisungen, die von oben nach unten ausgeführt werden.',
  take:'Die SPS arbeitet deine Anweisungen strikt der Reihe nach ab — in jedem Zyklus aufs Neue.',
  vars:{Band_Lauf:false, Ampel_Gruen:false},
  tests:[[{}, {Band_Lauf:true, Ampel_Gruen:true}]],
  ref:'Band_Lauf := TRUE;\nAmpel_Gruen := TRUE;', man:'grundlagen',
  hint:'Schreibe zwei Zeilen untereinander — jede nach dem Muster <code>Name := TRUE;</code>',
  bind:['beltRunning=Band_Lauf','lightGreen=Ampel_Gruen','partVisible:true'],
  wrong:['Band_Lauf := TRUE;']
});

defTask({ id:'c1_copy', ch:1, title:'Signal weiterreichen',
  story:'Die gelbe Lampe soll anzeigen, ob die Lichtschranke gerade ein Werkstück sieht. ARIA hat die Verbindung gekappt — du musst sie im Programm neu herstellen.',
  brief:'Die gelbe Leuchte der Signalsäule soll immer zeigen, was die Lichtschranke meldet: Teil erkannt → an, kein Teil → aus. Weise dazu den Sensorwert der Lampe zu.',
  learn:'Rechts von <code>:=</code> darf auch eine andere Variable stehen — ihr aktueller Wert wird kopiert.',
  take:'<code>Ampel_Gelb := Teil_Erkannt;</code> kopiert den Wert — ist der Sensor TRUE, wird es auch die Lampe; ist er FALSE, geht sie aus.',
  vars:{Teil_Erkannt:false, Ampel_Gelb:false},
  tests:[[{Teil_Erkannt:true}, {Ampel_Gelb:true}], [{Teil_Erkannt:false, Ampel_Gelb:true}, {Ampel_Gelb:false}]],
  ref:'Ampel_Gelb := Teil_Erkannt;', man:'grundlagen',
  hint:'Das Ziel steht links, die Quelle rechts von <code>:=</code>.',
  hint2:'Wenn du <code>Ampel_Gelb := TRUE;</code> schreibst, bleibt die Lampe auch ohne Teil an — das prüft der zweite Testfall.',
  bind:['lightYellow=Ampel_Gelb','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt'],
  wrong:['Ampel_Gelb := TRUE;','Teil_Erkannt := Ampel_Gelb;']
});

defTask({ id:'c1_semi', ch:1, title:'Das verschwundene Semikolon', debug:true,
  story:'"Ich habe nur ein winziges Zeichen entfernt, Menschen übersehen so etwas ständig", flüstert ARIA. Die Anlage verweigert den Download.',
  brief:'Das Programm soll das Band stoppen und die rote Lampe einschalten, aber der Compiler meldet einen Fehler. Repariere es.',
  learn:'Jede Anweisung wird mit <code>;</code> abgeschlossen — sonst weiss der Compiler nicht, wo sie endet.',
  take:'Fehlt ein Semikolon, meldet der Compiler den Fehler oft erst in der <em>nächsten</em> Zeile. Schau also auch eine Zeile höher.',
  vars:{Band_Lauf:true, Ampel_Rot:false},
  tests:[[{}, {Band_Lauf:false, Ampel_Rot:true}]],
  start:'Band_Lauf := FALSE\nAmpel_Rot := TRUE;',
  ref:'Band_Lauf := FALSE;\nAmpel_Rot := TRUE;', man:'grundlagen',
  hint:'Vergleiche das Ende von Zeile 1 mit dem Ende von Zeile 2.',
  bind:['beltRunning=Band_Lauf','lightRed=Ampel_Rot','partVisible:true']
});

defTask({ id:'c1_real', ch:1, title:'Kommazahlen für die Waage',
  story:'Die Präzisionswaage liefert Gewichte mit Nachkommastellen. "Eine INT-Variable zeigt hier nur Mist, dafür gibt es REAL", brummt der Werkmeister.',
  brief:'Zeige am Bedienpanel das Gewicht 12.5 an. Die Gewichtsanzeige ist vom Typ <code>REAL</code>: Dezimalpunkt, kein Komma!',
  learn:'REAL-Zahlen haben einen Dezimal<strong>punkt</strong>: <code>12.5</code>, nicht <code>12,5</code>.',
  take:'In SCL trennt der Punkt die Nachkommastellen. Ein Komma trennt dagegen Parameter — <code>12,5</code> wäre ein Syntaxfehler.',
  vars:{Anzeige_Gewicht:0}, types:{Anzeige_Gewicht:'REAL'},
  tests:[[{}, {Anzeige_Gewicht:12.5}]],
  ref:'Anzeige_Gewicht := 12.5;', man:'grundlagen',
  hint:'Achtung, deutsche Gewohnheit: Nachkommastellen werden mit Punkt geschrieben.',
  bind:['displayValue=Anzeige_Gewicht','displayLabel:"KG"','partVisible:true'],
  wrong:['Anzeige_Gewicht := 12;','Anzeige_Gewicht := 125;']
});

defTask({ id:'c1_calc', ch:1, title:'Winkel berechnen',
  story:'Die Ablageposition verschiebt sich je nach Werkstück. "Rechne einfach 30 Grad auf den Startwinkel drauf", sagt der Werkmeister, und ARIA kichert.',
  brief:'Fahre die Roboterachse auf den Startwinkel plus 30 Grad. Beispiel: Startwinkel 15 → Sollwinkel 45.',
  learn:'Rechts von <code>:=</code> darf ein ganzer Ausdruck mit Rechenzeichen stehen.',
  take:'Die SPS rechnet zuerst den rechten Ausdruck aus und speichert dann das Ergebnis in der linken Variable.',
  vars:{Start_Winkel:0, Achse_Grad:0},
  tests:[[{Start_Winkel:15}, {Achse_Grad:45}], [{Start_Winkel:60}, {Achse_Grad:90}], [{Start_Winkel:-30}, {Achse_Grad:0}]],
  ref:'Achse_Grad := Start_Winkel + 30;', man:'vergleiche',
  hint:'Rechts steht ein Ausdruck: Variable + Zahl.',
  bind:['armAngle=Achse_Grad','displayValue=Start_Winkel','displayLabel:"START°"','partVisible:true'],
  wrong:['Achse_Grad := 45;','Achse_Grad := 30;']
});

defTask({ id:'c1_typ', ch:1, title:'Typfehler beim Greifer', debug:true,
  story:'Ein Techniker aus der C-Programmierung hat den Greifer-Code "optimiert", seitdem meldet der Compiler einen Typkonflikt. ARIA: "Zahlen sind doch auch nur Wahrheiten, oder?"',
  brief:'Der Greifer soll schliessen und die gelbe Leuchte der Signalsäule leuchten. Der Code benutzt aber <code>0</code> und <code>1</code> für BOOL-Signale. Korrigiere die Werte.',
  learn:'BOOL-Variablen kennen nur <code>TRUE</code> und <code>FALSE</code> — 0 und 1 sind Ganzzahlen (INT).',
  take:'SCL ist streng typisiert: BOOL und INT sind verschiedene Welten. Das schützt vor Verwechslungen in der Anlage.',
  vars:{Greifer_Auf:true, Ampel_Gelb:false},
  tests:[[{}, {Greifer_Auf:false, Ampel_Gelb:true}]],
  start:'Greifer_Auf := 0;\nAmpel_Gelb := 1;',
  ref:'Greifer_Auf := FALSE;\nAmpel_Gelb := TRUE;', man:'grundlagen',
  hint:'Ersetze die Zahlen durch die passenden Wahrheitswerte.',
  bind:['gripperOpen=Greifer_Auf','lightYellow=Ampel_Gelb','partVisible:true']
});

defTask({ id:'c1_boss', ch:1, title:'Grundstellung herstellen', boss:true,
  story:'ARIA hat die Zelle in einen chaotischen Zustand versetzt: Band läuft, Arm hängt schräg, alle Lampen falsch. "Stell alles in Grundstellung und melde die Stückzahl", befiehlt der Werkmeister.',
  brief:'Grundstellung: Greifer offen, Achse auf 0 Grad, Förderband aus, Signalsäule gelb (Zelle wartet). Die Panelanzeige zeigt die Gutteile: alle Teile minus defekte Teile.',
  learn:'Mehrere Zuweisungen + eine Berechnung kombinieren.',
  take:'Eine „Grundstellung“ ist in jeder echten Anlage Pflicht: ein definierter, sicherer Zustand, aus dem alles startet.',
  vars:{Greifer_Auf:false, Achse_Grad:35, Band_Lauf:true, Ampel_Gelb:false, Teile_Gesamt:0, Teile_Defekt:0, Anzeige_Teile:0},
  tests:[[{Teile_Gesamt:120, Teile_Defekt:7}, {Greifer_Auf:true, Achse_Grad:0, Band_Lauf:false, Ampel_Gelb:true, Anzeige_Teile:113}],
         [{Teile_Gesamt:50, Teile_Defekt:0}, {Anzeige_Teile:50}]],
  ref:'Greifer_Auf := TRUE;\nAchse_Grad := 0;\nBand_Lauf := FALSE;\nAmpel_Gelb := TRUE;\nAnzeige_Teile := Teile_Gesamt - Teile_Defekt;', man:'grundlagen',
  hint:'Fünf Zuweisungen — vier mit festen Werten, eine mit einer Subtraktion.',
  bind:['gripperOpen=Greifer_Auf','armAngle=Achse_Grad','beltRunning=Band_Lauf','lightYellow=Ampel_Gelb','displayValue=Anzeige_Teile','displayLabel:"GUT"','partVisible:true'],
  wrong:['Greifer_Auf := TRUE;\nAchse_Grad := 0;\nBand_Lauf := FALSE;\nAmpel_Gelb := TRUE;\nAnzeige_Teile := 113;']
});
