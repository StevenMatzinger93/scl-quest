/* ===== KAPITEL 4 — Entscheidungen: IF / ELSIF / ELSE ===== */
defTask({ id:'r1t5', ch:4, title:'Greifen oder warten',
  story:'"Sobald ein Teil erkannt ist, soll der Greifer zupacken — sonst offen bleiben und warten", erklärt der Werkmeister die Grundlogik der Zelle.',
  brief:'Schreibe <code>IF … ELSE</code>: Erkennt die Lichtschranke ein Teil, soll der Greifer zupacken (schliessen), sonst offen sein.',
  learn:'Mit IF … THEN … ELSE … END_IF; entscheidet das Programm zwischen zwei Wegen.',
  take:'Jedes IF endet mit <code>END_IF;</code>. Der ELSE-Zweig läuft genau dann, wenn die Bedingung FALSE ist.',
  vars:{Teil_Erkannt:false, Greifer_Auf:true},
  tests:[[{Teil_Erkannt:true},{Greifer_Auf:false}], [{Teil_Erkannt:false, Greifer_Auf:false},{Greifer_Auf:true}]],
  ref:'IF Teil_Erkannt THEN\n  Greifer_Auf := FALSE;\nELSE\n  Greifer_Auf := TRUE;\nEND_IF;', man:'if', must:['IF'],
  hint:'Aufbau: <code>IF Bedingung THEN … ELSE … END_IF;</code>',
  bind:['gripperOpen=Greifer_Auf','sensorActive=Teil_Erkannt','partVisible:true'],
  wrong:['Greifer_Auf := FALSE;','IF Teil_Erkannt THEN\n  Greifer_Auf := FALSE;\nEND_IF;']
});

defTask({ id:'c4_ohne_else', ch:4, title:'Band anhalten — nur wenn nötig',
  story:'Erreicht ein Teil die Greifstation, soll das laufende Band stehen bleiben. Kommt kein Teil, darf dein Code das Band NICHT anfassen, dann steuert es die Leitwarte.',
  brief:'Erkennt die Lichtschranke ein Teil, stoppe das Förderband. Sonst soll dein Programm das Band <strong>unverändert</strong> lassen.',
  learn:'Ein IF ohne ELSE verändert im FALSE-Fall gar nichts.',
  take:'IF ohne ELSE = „nur wenn“. Die Variable behält sonst ihren alten Wert — das ist eine gewollte Speicherwirkung.',
  vars:{Teil_Erkannt:false, Band_Lauf:true},
  tests:[[{Teil_Erkannt:true},{Band_Lauf:false}], [{Teil_Erkannt:false, Band_Lauf:true},{Band_Lauf:true}], [{Teil_Erkannt:false, Band_Lauf:false},{Band_Lauf:false}]],
  ref:'IF Teil_Erkannt THEN\n  Band_Lauf := FALSE;\nEND_IF;', man:'if', must:['IF'],
  hint:'Du brauchst hier keinen ELSE-Zweig.',
  hint2:'<code>Band_Lauf := NOT Teil_Erkannt;</code> wäre falsch: Es würde das Band einschalten, auch wenn die Leitwarte es gestoppt hat.',
  bind:['beltRunning=Band_Lauf','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt'],
  wrong:['Band_Lauf := NOT Teil_Erkannt;','IF Teil_Erkannt THEN\n  Band_Lauf := FALSE;\nELSE\n  Band_Lauf := TRUE;\nEND_IF;']
});

defTask({ id:'r1t10', ch:4, title:'Erste Handgriffe',
  story:'Der Werkmeister: "Greifer schliessen UND Arm auf 90 Grad zur Ablage schwenken, aber nur mit Freigabe UND erkanntem Teil, sonst bleibt alles in Grundstellung." ARIA schweigt verdächtig.',
  brief:'Ist die Zelle freigegeben und erkennt die Lichtschranke ein Teil: Greifer schliessen, Achse auf 90 Grad. Sonst: Greifer offen, Achse auf 0 Grad.',
  learn:'Mehrere Anweisungen pro Zweig und eine zusammengesetzte Bedingung.',
  take:'In jedem Zweig dürfen beliebig viele Anweisungen stehen — sie gehören alle zum Zweig bis zum nächsten ELSE/END_IF.',
  vars:{Freigabe:false, Teil_Erkannt:false, Greifer_Auf:true, Achse_Grad:0},
  tests:[[{Freigabe:true, Teil_Erkannt:true},{Greifer_Auf:false, Achse_Grad:90}], [{Freigabe:true, Teil_Erkannt:false},{Greifer_Auf:true, Achse_Grad:0}],
         [{Freigabe:false, Teil_Erkannt:true, Achse_Grad:90, Greifer_Auf:false},{Greifer_Auf:true, Achse_Grad:0}]],
  ref:'IF Freigabe AND Teil_Erkannt THEN\n  Greifer_Auf := FALSE;\n  Achse_Grad := 90;\nELSE\n  Greifer_Auf := TRUE;\n  Achse_Grad := 0;\nEND_IF;', man:'if', must:['IF'],
  hint:'Kombiniere die Bedingung mit <code>AND</code> und setze in jedem Zweig beide Variablen.',
  bind:['gripperOpen=Greifer_Auf','armAngle=Achse_Grad','lightGreen=Freigabe','sensorActive=Teil_Erkannt','partVisible:true']
});

defTask({ id:'c4_elsif', ch:4, title:'Füllstands-Ampel',
  story:'Der Materialbunker darf nicht überlaufen: über 90 % rot, über 60 % gelb, sonst grün. Es darf immer nur EINE Lampe leuchten.',
  brief:'Zeige den Füllstand an der Signalsäule, immer genau eine Lampe: über 90 → rot, über 60 → gelb, sonst grün. Die anderen beiden Lampen sind aus.',
  learn:'Mit ELSIF prüft man mehrere Bedingungen nacheinander — der erste wahre Zweig gewinnt.',
  take:'Bei ELSIF-Ketten zählt die Reihenfolge: Die strengste Bedingung (&gt; 90) kommt zuerst.',
  vars:{Fuellstand:0, Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:false},
  tests:[[{Fuellstand:95, Ampel_Gruen:true},{Ampel_Rot:true, Ampel_Gelb:false, Ampel_Gruen:false}], [{Fuellstand:75, Ampel_Rot:true},{Ampel_Rot:false, Ampel_Gelb:true, Ampel_Gruen:false}],
         [{Fuellstand:30, Ampel_Gelb:true},{Ampel_Rot:false, Ampel_Gelb:false, Ampel_Gruen:true}], [{Fuellstand:90},{Ampel_Gelb:true, Ampel_Rot:false}], [{Fuellstand:60},{Ampel_Gruen:true, Ampel_Gelb:false}]],
  ref:'IF Fuellstand > 90 THEN\n  Ampel_Rot := TRUE;\n  Ampel_Gelb := FALSE;\n  Ampel_Gruen := FALSE;\nELSIF Fuellstand > 60 THEN\n  Ampel_Rot := FALSE;\n  Ampel_Gelb := TRUE;\n  Ampel_Gruen := FALSE;\nELSE\n  Ampel_Rot := FALSE;\n  Ampel_Gelb := FALSE;\n  Ampel_Gruen := TRUE;\nEND_IF;', man:'if', must:['IF','ELSIF'],
  hint:'Die Testfälle starten teilweise mit einer bereits leuchtenden Lampe — setze in jedem Zweig alle drei Lampen.',
  hint2:'Alternative: Setze zuerst alle drei Lampen auf FALSE und schalte dann im IF nur die richtige ein.',
  bind:['lightRed=Ampel_Rot','lightYellow=Ampel_Gelb','lightGreen=Ampel_Gruen','displayValue=Fuellstand','displayLabel:"FÜLL %"'],
  wrong:['IF Fuellstand > 90 THEN\n  Ampel_Rot := TRUE;\nELSIF Fuellstand > 60 THEN\n  Ampel_Gelb := TRUE;\nELSE\n  Ampel_Gruen := TRUE;\nEND_IF;']
});

defTask({ id:'c4_reihenfolge', ch:4, title:'Die unerreichbare Stufe', debug:true,
  story:'Der Lüfter soll bei über 50 °C auf Stufe 1 und bei über 80 °C auf Stufe 2 laufen. Seit ARIAs "Optimierung" erreicht er Stufe 2 nie — und der Motor überhitzt.',
  brief:'Lüfterstufe: Temperatur über 80 °C → Stufe 2, über 50 °C → Stufe 1, sonst 0. Der Code kompiliert, aber Stufe 2 wird nie erreicht. Finde den Logikfehler.',
  learn:'ELSIF-Ketten werden von oben nach unten geprüft — der erste Treffer gewinnt.',
  take:'Steht die allgemeinere Bedingung (&gt; 50) vor der spezielleren (&gt; 80), ist der zweite Zweig tot. Immer vom Strengsten zum Allgemeinsten sortieren!',
  vars:{Temperatur:20, Luefter_Stufe:0},
  tests:[[{Temperatur:90},{Luefter_Stufe:2}], [{Temperatur:60},{Luefter_Stufe:1}], [{Temperatur:30, Luefter_Stufe:2},{Luefter_Stufe:0}], [{Temperatur:81},{Luefter_Stufe:2}]],
  start:'IF Temperatur > 50 THEN\n  Luefter_Stufe := 1;\nELSIF Temperatur > 80 THEN\n  Luefter_Stufe := 2;\nELSE\n  Luefter_Stufe := 0;\nEND_IF;',
  ref:'IF Temperatur > 80 THEN\n  Luefter_Stufe := 2;\nELSIF Temperatur > 50 THEN\n  Luefter_Stufe := 1;\nELSE\n  Luefter_Stufe := 0;\nEND_IF;', man:'if',
  hint:'Bei 90 °C ist auch die Bedingung <code>Temperatur &gt; 50</code> wahr. Welcher Zweig läuft also?',
  bind:['displayValue=Luefter_Stufe','displayLabel:"STUFE"','beltRunning:true']
});

defTask({ id:'c4_verschachtelt', ch:4, title:'Verschachtelte Entscheidung',
  story:'Im Handbetrieb bewegt nur der Bediener die Anlage. Im Automatikbetrieb entscheidet die Zelle selbst: Ist ein Teil da, fährt der Arm zur Ablage, sonst in Grundstellung.',
  brief:'Automatik: Teil erkannt → Achse auf 90 Grad, sonst 0 Grad; gelbe Leuchte aus. Handbetrieb: Achse bleibt unverändert, die gelbe Leuchte ist an.',
  learn:'Ein IF kann in einem anderen IF stehen (Verschachtelung).',
  take:'Verschachtelte IFs brauchen jeweils ihr eigenes END_IF. Einrückung hilft, den Überblick zu behalten.',
  vars:{Auto_Modus:false, Teil_Erkannt:false, Achse_Grad:0, Ampel_Gelb:false},
  tests:[[{Auto_Modus:true, Teil_Erkannt:true},{Achse_Grad:90, Ampel_Gelb:false}], [{Auto_Modus:true, Teil_Erkannt:false, Achse_Grad:90, Ampel_Gelb:true},{Achse_Grad:0, Ampel_Gelb:false}],
         [{Auto_Modus:false, Teil_Erkannt:true, Achse_Grad:45},{Achse_Grad:45, Ampel_Gelb:true}], [{Auto_Modus:false, Achse_Grad:-30},{Achse_Grad:-30, Ampel_Gelb:true}]],
  ref:'IF Auto_Modus THEN\n  Ampel_Gelb := FALSE;\n  IF Teil_Erkannt THEN\n    Achse_Grad := 90;\n  ELSE\n    Achse_Grad := 0;\n  END_IF;\nELSE\n  Ampel_Gelb := TRUE;\nEND_IF;', man:'if', must:['IF'],
  hint:'Äusseres IF für den Modus, inneres IF für das Teil.',
  bind:['armAngle=Achse_Grad','lightYellow=Ampel_Gelb','sensorActive=Teil_Erkannt','lightGreen=Auto_Modus','partVisible:true']
});

defTask({ id:'c4_hysterese', ch:4, title:'Zweipunktregler mit Hysterese',
  story:'Der Schaltschranklüfter klackert ständig an und aus, weil die Temperatur um 65 °C pendelt, und ARIA liebt dieses Geräusch. Der Werkmeister: "Wir brauchen eine Hysterese."',
  brief:'Der Lüfter schaltet ein, wenn die Temperatur über 70 °C steigt, und aus, wenn sie unter 60 °C fällt. Dazwischen <strong>behält</strong> er seinen Zustand.',
  learn:'Hysterese: Zwei Schaltschwellen verhindern ständiges Hin- und Herschalten.',
  take:'IF … ELSIF ohne ELSE erzeugt eine Speicherwirkung: Im Bereich zwischen den Schwellen passiert nichts — der alte Zustand bleibt.',
  vars:{Temperatur:20, Luefter:false},
  tests:[[{Temperatur:75},{Luefter:true}], [{Temperatur:55, Luefter:true},{Luefter:false}], [{Temperatur:65, Luefter:true},{Luefter:true}], [{Temperatur:65, Luefter:false},{Luefter:false}], [{Temperatur:70, Luefter:false},{Luefter:false}]],
  ref:'IF Temperatur > 70 THEN\n  Luefter := TRUE;\nELSIF Temperatur < 60 THEN\n  Luefter := FALSE;\nEND_IF;', man:'if', must:['IF'],
  hint:'Du brauchst zwei Bedingungen, aber KEINEN ELSE-Zweig.',
  bind:['beltRunning=Luefter','lightYellow=Luefter','displayValue=Temperatur','displayLabel:"°C"'],
  wrong:['Luefter := Temperatur > 65;','IF Temperatur > 70 THEN\n  Luefter := TRUE;\nELSE\n  Luefter := FALSE;\nEND_IF;']
});

defTask({ id:'c4_endif', ch:4, title:'Das verlorene END_IF', debug:true,
  story:'ARIA hat im Sortierprogramm ein Wort gelöscht: "Ein END_IF mehr oder weniger, wen kümmert das?" Den Compiler kümmert es sehr.',
  brief:'Rote Teile (Farbcode 1) sollen zur Nacharbeit (Achse -90 Grad), grüne (Farbcode 2) ins Lager (90 Grad), sonst steht die Achse auf 0. Behebe den Syntaxfehler.',
  learn:'<code>ELSIF</code> wird zusammengeschrieben. <code>ELSE IF</code> öffnet ein neues, verschachteltes IF.',
  take:'Merke: <code>ELSIF</code> in einem Wort. Wer <code>ELSE IF</code> schreibt, braucht zwei END_IF.',
  vars:{Farbe:0, Achse_Grad:0},
  tests:[[{Farbe:1},{Achse_Grad:-90}], [{Farbe:2},{Achse_Grad:90}], [{Farbe:0, Achse_Grad:90},{Achse_Grad:0}]],
  start:'IF Farbe = 1 THEN\n  Achse_Grad := -90;\nELSE IF Farbe = 2 THEN\n  Achse_Grad := 90;\nELSE\n  Achse_Grad := 0;\nEND_IF;',
  ref:'IF Farbe = 1 THEN\n  Achse_Grad := -90;\nELSIF Farbe = 2 THEN\n  Achse_Grad := 90;\nELSE\n  Achse_Grad := 0;\nEND_IF;', man:'if',
  hint:'Lies die Compiler-Meldung genau — sie enthält einen Tipp zu „ELSE IF“.',
  bind:['armAngle=Achse_Grad',{channel:'partColor', variable:'Farbe', map:{'0':'neutral','1':'red','2':'green'}},'partVisible:true','gripperOpen:false']
});

defTask({ id:'c4_farbweiche', ch:4, title:'Weiche nach Farbe',
  story:'Rote Teile gehören auf Bahn B, grüne auf Bahn A. Bei unbekannten Farben geht die Weiche in Mittelstellung und die gelbe Warnlampe an.',
  brief:'Stelle die Weiche nach dem Farbcode: rot (1) → -20 Grad, grün (2) → 20 Grad, bekannte Farbe ohne Warnung. Unbekannte Farbe: Weiche auf 0 Grad und Warnung ein.',
  learn:'Eine ELSIF-Kette für mehrere Fälle und ein ELSE als Auffangnetz.',
  take:'Ein ELSE-Zweig für „alles Unerwartete“ ist gute Praxis: Die Anlage bleibt auch bei falschen Daten in einem sicheren Zustand.',
  vars:{Farbe:0, Weiche_Pos:0, Warnung:false},
  tests:[[{Farbe:1, Warnung:true},{Weiche_Pos:-20, Warnung:false}], [{Farbe:2},{Weiche_Pos:20, Warnung:false}], [{Farbe:7},{Weiche_Pos:0, Warnung:true}], [{Farbe:0, Weiche_Pos:20},{Weiche_Pos:0, Warnung:true}]],
  ref:'IF Farbe = 1 THEN\n  Weiche_Pos := -20;\n  Warnung := FALSE;\nELSIF Farbe = 2 THEN\n  Weiche_Pos := 20;\n  Warnung := FALSE;\nELSE\n  Weiche_Pos := 0;\n  Warnung := TRUE;\nEND_IF;', man:'if', must:['IF'],
  hint:'Drei Zweige. Denk daran, <code>Warnung</code> in den ersten beiden Zweigen zurückzusetzen.',
  bind:['gateAngle=Weiche_Pos',{channel:'partColor', variable:'Farbe', map:{'0':'neutral','1':'red','2':'green','7':'blue'}},'lightYellow=Warnung','partVisible:true','beltRunning:true']
});

defTask({ id:'c4_boss', ch:4, title:'Das Greif-Gehirn', boss:true,
  story:'ARIA hat die komplette Entscheidungslogik der Zelle gelöscht. Du schreibst sie neu — mit klarer Priorität: Sicherheit vor allem anderen.',
  brief:'Vorrang: 1) Not-Aus → Rot an, Band aus, Greifer offen. 2) Teil erkannt und Freigabe → Greifer zu, Achse 90°, Band aus. 3) nur Teil → Band aus. 4) sonst Band ein, Greifer offen, Achse 0°. Rot nur bei Not-Aus.',
  learn:'Eine priorisierte ELSIF-Kette mit Sicherheitszweig ganz oben.',
  take:'Sicherheitslogik gehört immer an den Anfang der Entscheidungskette — dann kann kein anderer Zweig sie „überstimmen“.',
  vars:{Not_Aus:false, Teil_Erkannt:false, Freigabe:false, Greifer_Auf:true, Achse_Grad:0, Band_Lauf:false, Ampel_Rot:false},
  tests:[[{Not_Aus:true, Teil_Erkannt:true, Freigabe:true, Band_Lauf:true, Greifer_Auf:false},{Ampel_Rot:true, Band_Lauf:false, Greifer_Auf:true}],
         [{Teil_Erkannt:true, Freigabe:true, Band_Lauf:true},{Greifer_Auf:false, Achse_Grad:90, Band_Lauf:false, Ampel_Rot:false}],
         [{Teil_Erkannt:true, Band_Lauf:true, Ampel_Rot:true},{Band_Lauf:false, Ampel_Rot:false, Greifer_Auf:true}],
         [{Achse_Grad:90, Greifer_Auf:false, Ampel_Rot:true},{Band_Lauf:true, Greifer_Auf:true, Achse_Grad:0, Ampel_Rot:false}],
         [{Freigabe:true},{Band_Lauf:true, Achse_Grad:0}]],
  ref:'IF Not_Aus THEN\n  Ampel_Rot := TRUE;\n  Band_Lauf := FALSE;\n  Greifer_Auf := TRUE;\nELSIF Teil_Erkannt AND Freigabe THEN\n  Greifer_Auf := FALSE;\n  Achse_Grad := 90;\n  Band_Lauf := FALSE;\n  Ampel_Rot := FALSE;\nELSIF Teil_Erkannt THEN\n  Band_Lauf := FALSE;\n  Ampel_Rot := FALSE;\nELSE\n  Band_Lauf := TRUE;\n  Greifer_Auf := TRUE;\n  Achse_Grad := 0;\n  Ampel_Rot := FALSE;\nEND_IF;', man:'if', must:['IF','ELSIF'],
  hint:'Die Reihenfolge der Zweige entspricht genau der Priorität in der Aufgabe.',
  hint2:'Zweig 2 (Teil UND Freigabe) muss vor Zweig 3 (nur Teil) stehen — sonst wird Zweig 2 nie erreicht.',
  bind:['gripperOpen=Greifer_Auf','armAngle=Achse_Grad','beltRunning=Band_Lauf','lightRed=Ampel_Rot','faultActive=Not_Aus','sensorActive=Teil_Erkannt','lightGreen=Freigabe','partVisible:true'],
  wrong:['IF Not_Aus THEN\n  Ampel_Rot := TRUE;\n  Band_Lauf := FALSE;\n  Greifer_Auf := TRUE;\nELSIF Teil_Erkannt THEN\n  Band_Lauf := FALSE;\n  Ampel_Rot := FALSE;\nELSIF Teil_Erkannt AND Freigabe THEN\n  Greifer_Auf := FALSE;\n  Achse_Grad := 90;\n  Band_Lauf := FALSE;\n  Ampel_Rot := FALSE;\nELSE\n  Band_Lauf := TRUE;\n  Greifer_Auf := TRUE;\n  Achse_Grad := 0;\n  Ampel_Rot := FALSE;\nEND_IF;']
});
