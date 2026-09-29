/* ===== KAPITEL 10 — Aufstand der Maschinen: Schrittketten ===== */
defTask({ id:'c10_kette', ch:10, title:'Die erste Schrittkette',
  story:'ARIA steuert die Zelle mit einem undurchschaubaren Knäuel aus IFs. Der Werkmeister zeichnet dir an der Tafel drei Kreise: Warten → Fördern → Greifbereit. "Jeder Kreis ist ein Schritt. Immer nur einer ist aktiv."',
  brief:'Schreibe mit <code>CASE … OF</code> die Weiterschaltungen der Schrittvariable:<br>• 0 (Warten): wenn das Startsignal kommt → 1<br>• 1 (Fördern): wenn ein Teil erkannt wird → 2<br>• 2 (Greifbereit): wenn quittiert wird → 0',
  learn:'Eine Schrittkette: eine INT-Variable merkt sich den aktiven Schritt, CASE führt nur diesen aus.',
  take:'Schrittketten machen Abläufe übersichtlich: Man sieht sofort, wo die Anlage steht und worauf sie wartet.',
  vars:{Schritt:0, Start:false, Teil_Erkannt:false, Quittieren:false},
  timed:[{steps:[[0,{},{Schritt:0}],[0,{Teil_Erkannt:true},{Schritt:0}],[0,{Teil_Erkannt:false, Start:true},{Schritt:1}],[0,{Start:false},{Schritt:1}],[0,{Quittieren:true},{Schritt:1}],[0,{Quittieren:false, Teil_Erkannt:true},{Schritt:2}],[0,{Teil_Erkannt:false},{Schritt:2}],[0,{Quittieren:true},{Schritt:0}]]}],
  ref:'CASE Schritt OF\n  0:\n    IF Start THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Teil_Erkannt THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF Quittieren THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;', man:'schrittketten', must:['CASE'],
  hint:'In jedem Zweig steht ein IF, das auf die Weiterschaltbedingung prüft.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt'],
  wrong:['IF Start THEN\n  Schritt := 1;\nEND_IF;\nIF Teil_Erkannt THEN\n  Schritt := 2;\nEND_IF;\nIF Quittieren THEN\n  Schritt := 0;\nEND_IF;']
});

defTask({ id:'c10_ausgaenge', ch:10, title:'Ausgänge aus Schritten',
  story:'Die Schrittkette läuft — aber sie bewegt noch nichts. "Die Ausgänge leitest du direkt aus dem Schritt ab", erklärt der Werkmeister. "Dann kann nie ein Ausgang \'hängen bleiben\'."',
  brief:'Die Kette aus der letzten Aufgabe ist vorgegeben. Leite <strong>nach</strong> dem CASE die Ausgänge direkt aus dem Schritt ab:<br>• Gelbe Lampe: an in Schritt 0<br>• Förderband: läuft in Schritt 1<br>• Grüne Lampe: an in Schritt 2',
  learn:'Ausgänge als Vergleich mit der Schrittnummer zuweisen.',
  take:'<code>Band_Lauf := Schritt = 1;</code> — Ausgänge außerhalb des CASE sind in jedem Zyklus eindeutig festgelegt. Kein Ausgang bleibt versehentlich an.',
  vars:{Schritt:0, Start:false, Teil_Erkannt:false, Quittieren:false, Ampel_Gelb:false, Band_Lauf:false, Ampel_Gruen:false},
  timed:[{steps:[[0,{},{Ampel_Gelb:true, Band_Lauf:false, Ampel_Gruen:false}],[0,{Start:true},{Schritt:1, Ampel_Gelb:false, Band_Lauf:true}],[0,{Start:false, Teil_Erkannt:true},{Schritt:2, Band_Lauf:false, Ampel_Gruen:true}],[0,{Teil_Erkannt:false, Quittieren:true},{Schritt:0, Ampel_Gelb:true, Ampel_Gruen:false}]]}],
  start:'CASE Schritt OF\n  0:\n    IF Start THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Teil_Erkannt THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF Quittieren THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\n\n// Ausgänge:\n',
  ref:'CASE Schritt OF\n  0:\n    IF Start THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Teil_Erkannt THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF Quittieren THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nAmpel_Gelb := Schritt = 0;\nBand_Lauf := Schritt = 1;\nAmpel_Gruen := Schritt = 2;', man:'schrittketten', must:['CASE'],
  hint:'Drei Zeilen nach dem Muster der ersten: Ausgang := Schritt = Nummer;',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','lightYellow=Ampel_Gelb','beltRunning=Band_Lauf','lightGreen=Ampel_Gruen','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt']
});

defTask({ id:'c10_timer', ch:10, title:'Wartezeit im Schritt',
  story:'Am Klebeplatz muss das Teil 3 Sekunden liegen bleiben. Der Werkmeister zeigt dir den Profi-Trick: "Den Timer rufst du VOR dem CASE auf — und sein Eingang ist einfach: Bin ich im richtigen Schritt?"',
  brief:'Rufe vor dem CASE <code>Klebe_Timer</code> (TON, <code>PT := T#3S</code>) auf; sein Eingang ist wahr, solange die Kette in Schritt 1 ist.<br>• Schritt 0: wenn ein Teil erkannt wird → 1<br>• Schritt 1: wenn <code>Klebe_Timer.Q</code> → 2<br>• Schritt 2: wenn das Teil nicht mehr erkannt wird (entnommen) → 0<br>Nach dem CASE: Die gelbe Lampe leuchtet in Schritt 1.',
  learn:'Das Profi-Muster: Timer außerhalb des CASE, Eingang = „bin im Schritt X“.',
  take:'Mit <code>IN := Schritt = 1</code> startet der Timer beim Betreten des Schritts und wird beim Verlassen automatisch zurückgesetzt. Kein vergessener Reset mehr!',
  vars:{Schritt:0, Teil_Erkannt:false, Ampel_Gelb:false}, fb:{Klebe_Timer:'TON'},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Schritt:1}],[1,{},{Schritt:1, Ampel_Gelb:true}],[1,{},{Schritt:1}],[1,{},{Schritt:1}],[1,{},{Schritt:2, Ampel_Gelb:false}],[1,{},{Schritt:2}],[0,{Teil_Erkannt:false},{Schritt:0}],
    [1,{Teil_Erkannt:true},{Schritt:1}],[1,{},{Schritt:1}],[2,{},{Schritt:1}],[1,{},{Schritt:2}]]}],
  ref:'Klebe_Timer(IN := Schritt = 1, PT := T#3S);\nCASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Klebe_Timer.Q THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF NOT Teil_Erkannt THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nAmpel_Gelb := Schritt = 1;', man:'schrittketten', must:['CASE','TON'],
  hint:'Der Timeraufruf steht ganz oben, noch vor <code>CASE</code>.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','lightYellow=Ampel_Gelb','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt']
});

defTask({ id:'c10_haenger_dbg', ch:10, title:'Die hängende Kette', debug:true,
  story:'Die Schrittkette bleibt immer in Schritt 1 stehen, obwohl der Greifer längst zu ist. ARIA: "Manche Schritte sind einfach so gemütlich."',
  brief:'Ablauf: 0 → (Teil erkannt) → 1 → (Rückmeldung Greifer zu) → 2 → (Rückmeldung Arm oben) → 0. In Schritt 1 wird der Greifer geschlossen, in Schritt 2 der Arm auf 90° gefahren. Finde, warum die Kette hängt.',
  learn:'Weiterschaltbedingungen und Zielschritte kontrollieren.',
  take:'Hängt eine Schrittkette, prüfe: Wird die Bedingung wirklich TRUE? Und springt der Schritt wirklich auf die <em>nächste</em> Nummer?',
  vars:{Schritt:0, Teil_Erkannt:false, Greifer_Zu:false, Arm_Oben:false, Greifer_Auf:true, Achse_Grad:0},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Schritt:1}],[0,{},{Greifer_Auf:false}],[0,{Greifer_Zu:true},{Schritt:2}],[0,{},{Achse_Grad:90}],[0,{Arm_Oben:true},{Schritt:0}]]}],
  start:'CASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    IF Greifer_Zu THEN\n      Schritt := 1;\n    END_IF;\n  2:\n    Achse_Grad := 90;\n    IF Arm_Oben THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;',
  ref:'CASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    IF Greifer_Zu THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    Achse_Grad := 90;\n    IF Arm_Oben THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;', man:'schrittketten',
  hint:'Schau dir an, auf welche Nummer Schritt 1 weiterschaltet.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','gripperOpen=Greifer_Auf','armAngle=Achse_Grad','partVisible:true']
});

defTask({ id:'c10_pickplace', ch:10, title:'Pick & Place mit Rückmeldungen',
  story:'Jetzt der echte Greifzyklus — nicht mit Zeiten, sondern mit Rückmeldungen der Sensoren. "Eine Bewegung ist erst fertig, wenn der Sensor es bestätigt", sagt der Werkmeister.',
  brief:'Schrittkette:<br>• 0: wenn ein Teil erkannt wird → 1<br>• 1: Greifer schliessen (Öffnen-Signal FALSE); bei Rückmeldung „Greifer zu“ → 2<br>• 2: Arm auf 90° (Ablage) fahren; bei Rückmeldung „Arm in Ablage“ → 3<br>• 3: Greifer öffnen (Signal TRUE); bei Rückmeldung „Greifer offen“ → 4<br>• 4: Arm auf 0° (Station) fahren; bei Rückmeldung „Arm in Station“ → 0',
  learn:'Jeder Schritt: Aktion ausführen, auf Rückmeldung warten, weiterschalten.',
  take:'Rückmeldungen (Endlagen, Positionen) machen eine Anlage robust: Sie wartet, bis die Bewegung wirklich fertig ist — egal wie lange es dauert.',
  vars:{Schritt:0, Teil_Erkannt:false, Greifer_Zu:false, Greifer_Offen:true, Arm_In_Ablage:false, Arm_In_Station:true, Greifer_Auf:true, Achse_Grad:0},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Schritt:1}],[0,{},{Schritt:1, Greifer_Auf:false}],[0,{Greifer_Zu:true, Greifer_Offen:false},{Schritt:2}],[0,{Arm_In_Station:false},{Schritt:2, Achse_Grad:90}],
    [0,{Arm_In_Ablage:true},{Schritt:3}],[0,{},{Greifer_Auf:true, Schritt:3}],[0,{Greifer_Zu:false, Greifer_Offen:true, Teil_Erkannt:false},{Schritt:4}],[0,{Arm_In_Ablage:false},{Achse_Grad:0, Schritt:4}],[0,{Arm_In_Station:true},{Schritt:0}],[0,{},{Schritt:0, Greifer_Auf:true, Achse_Grad:0}]]}],
  ref:'CASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    IF Greifer_Zu THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    Achse_Grad := 90;\n    IF Arm_In_Ablage THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    Greifer_Auf := TRUE;\n    IF Greifer_Offen THEN\n      Schritt := 4;\n    END_IF;\n  4:\n    Achse_Grad := 0;\n    IF Arm_In_Station THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;', man:'schrittketten', must:['CASE'],
  hint:'Fünf Zweige nach demselben Muster: Aktion, dann IF Rückmeldung THEN nächster Schritt.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','gripperOpen=Greifer_Auf','armAngle=Achse_Grad','sensorActive=Teil_Erkannt','partVisible:true']
});

defTask({ id:'c10_notaus', ch:10, title:'Not-Halt in der Kette',
  story:'ARIA testet dich: Mitten im Ablauf löst sie einen Not-Halt aus. Die Kette muss aus JEDEM Schritt sofort in den Not-Halt-Schritt springen — und erst nach Quittieren wieder starten.',
  brief:'<strong>Vor</strong> dem CASE: ist der Not-Halt ausgelöst → Schritt 99.<br>CASE:<br>• 0: wenn das Startsignal kommt → 1<br>• 1: wenn ein Teil erkannt wird → 0<br>• 99: wenn quittiert wird UND der Not-Halt nicht mehr ansteht → 0<br>Nach dem CASE: Das Band läuft nur in Schritt 1, die rote Lampe leuchtet nur in Schritt 99.',
  learn:'Übergeordnete Sprünge (Not-Halt) gehören vor die Schrittkette.',
  take:'Ein Not-Halt-Sprung vor dem CASE wirkt aus jedem Schritt. Die Rückkehr erfolgt nie automatisch — immer nur mit bewusster Quittierung.',
  vars:{Schritt:0, Start:false, Teil_Erkannt:false, Not_Aus:false, Quittieren:false, Band_Lauf:false, Ampel_Rot:false},
  timed:[{steps:[[0,{Start:true},{Schritt:1, Band_Lauf:true}],[0,{Start:false, Not_Aus:true},{Schritt:99, Band_Lauf:false, Ampel_Rot:true}],[0,{Quittieren:true},{Schritt:99}],[0,{Not_Aus:false, Quittieren:false},{Schritt:99}],[0,{Quittieren:true},{Schritt:0, Ampel_Rot:false}],[0,{Quittieren:false},{Schritt:0}]]},
         {steps:[[0,{Not_Aus:true},{Schritt:99}],[0,{Not_Aus:false, Start:true},{Schritt:99, Band_Lauf:false}]]}],
  ref:'IF Not_Aus THEN\n  Schritt := 99;\nEND_IF;\nCASE Schritt OF\n  0:\n    IF Start THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Teil_Erkannt THEN\n      Schritt := 0;\n    END_IF;\n  99:\n    IF Quittieren AND NOT Not_Aus THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nBand_Lauf := Schritt = 1;\nAmpel_Rot := Schritt = 99;', man:'schrittketten', must:['CASE','IF'],
  hint:'Das Not-Aus-IF steht als allererstes im Programm.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','beltRunning=Band_Lauf','lightRed=Ampel_Rot','faultActive=Not_Aus']
});

defTask({ id:'c10_timer_dbg', ch:10, title:'Der zweite Zyklus ist zu schnell', debug:true,
  story:'Der erste Zyklus läuft perfekt: 2 Sekunden greifen, dann weiter. Ab dem zweiten Teil wird die Greifzeit übersprungen — der Greifer fährt ab, bevor er zu ist. ARIA: "Ich habe nur… nichts gemacht."',
  brief:'In Schritt 1 soll immer 2 Sekunden gewartet werden. <code>Greif_Timer</code> wird aber im CASE mit <code>IN := TRUE</code> aufgerufen und deshalb nie zurückgesetzt. Baue auf das Profi-Muster um: Timeraufruf <strong>vor</strong> dem CASE, sein Eingang ist wahr, solange die Kette in Schritt 1 ist.',
  learn:'Warum ein Timer, der nur in einem Schritt aufgerufen wird, seinen Zustand behält.',
  take:'Ein nicht aufgerufener Baustein „friert ein“ — er sieht nie, dass sein Eingang FALSE wurde. Deshalb Timer außerhalb des CASE aufrufen!',
  vars:{Schritt:0, Teil_Erkannt:false, Greifer_Auf:true}, fb:{Greif_Timer:'TON'},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Schritt:1}],[1,{},{Schritt:1}],[1,{},{Schritt:1}],[1,{},{Schritt:2}],[0,{Teil_Erkannt:false},{Schritt:0}],
    [1,{Teil_Erkannt:true},{Schritt:1}],[1,{},{Schritt:1}],[1,{},{Schritt:1}],[1,{},{Schritt:2}]]}],
  start:'CASE Schritt OF\n  0:\n    Greifer_Auf := TRUE;\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    Greif_Timer(IN := TRUE, PT := T#2S);\n    IF Greif_Timer.Q THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF NOT Teil_Erkannt THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;',
  ref:'Greif_Timer(IN := Schritt = 1, PT := T#2S);\nCASE Schritt OF\n  0:\n    Greifer_Auf := TRUE;\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    IF Greif_Timer.Q THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF NOT Teil_Erkannt THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;', man:'schrittketten',
  hint:'Verschiebe den Timeraufruf aus Schritt 1 nach ganz oben und ändere den IN-Parameter.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','gripperOpen=Greifer_Auf','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt']
});

defTask({ id:'c10_zyklen', ch:10, title:'Drei Zyklen, dann Pause',
  story:'Nach jeweils 3 Teilen muss der Greifer gereinigt werden. Die Kette soll mitzählen und nach dem dritten Zyklus im Wartungsschritt anhalten.',
  brief:'• 0: wenn ein Teil erkannt wird → 1<br>• 1: Zyklenzähler um 1 erhöhen; hat er 3 erreicht (mindestens 3) → 9, sonst → 2<br>• 2: wenn das Teil nicht mehr erkannt wird → 0<br>• 9 (Wartung): wenn die Reinigung gemeldet wird → Zyklenzähler auf 0 und → 0<br>Nach dem CASE: Die gelbe Lampe leuchtet im Wartungsschritt 9.',
  learn:'Zähler in einer Schrittkette; Verzweigung zu unterschiedlichen Folgeschritten.',
  take:'Ein Schritt kann je nach Bedingung zu verschiedenen Nachfolgern springen — so entstehen Alternativzweige.',
  vars:{Schritt:0, Teil_Erkannt:false, Gereinigt:false, Zyklen:0, Ampel_Gelb:false},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Schritt:1}],[0,{},{Zyklen:1, Schritt:2}],[0,{Teil_Erkannt:false},{Schritt:0}],[0,{Teil_Erkannt:true},{Schritt:1}],[0,{},{Zyklen:2, Schritt:2}],[0,{Teil_Erkannt:false},{Schritt:0}],
    [0,{Teil_Erkannt:true},{Schritt:1}],[0,{},{Zyklen:3, Schritt:9, Ampel_Gelb:true}],[0,{Teil_Erkannt:false},{Schritt:9}],[0,{Gereinigt:true},{Schritt:0, Zyklen:0, Ampel_Gelb:false}]]}],
  ref:'CASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Zyklen := Zyklen + 1;\n    IF Zyklen >= 3 THEN\n      Schritt := 9;\n    ELSE\n      Schritt := 2;\n    END_IF;\n  2:\n    IF NOT Teil_Erkannt THEN\n      Schritt := 0;\n    END_IF;\n  9:\n    IF Gereinigt THEN\n      Zyklen := 0;\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nAmpel_Gelb := Schritt = 9;', man:'schrittketten', must:['CASE'],
  hint:'Schritt 1 wird nur einen Zyklus lang ausgeführt — deshalb wird dort genau einmal gezählt.',
  bind:['displayValue=Zyklen','displayLabel:"ZYKLEN"','lightYellow=Ampel_Gelb','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt']
});

defTask({ id:'c10_sortierlauf', ch:10, title:'Sortierlauf',
  story:'Letzte Probe vor dem Finale: ein vollständiger Sortierlauf. Teil erkennen, Farbe merken, Weiche stellen, Band 2 Sekunden laufen lassen, fertig.',
  brief:'Rufe vor dem CASE <code>Band_Timer</code> (TON, <code>PT := T#2S</code>) auf; sein Eingang ist wahr, solange die Kette in Schritt 1 ist.<br>• 0: wenn ein Teil erkannt wird → erkannte Farbe in der Merkvariable speichern, Schritt 1<br>• 1: Weiche per <code>CASE … OF</code> nach der gemerkten Farbe stellen: 1 → <code>-20</code>, 2 → <code>20</code>, sonst <code>0</code>; wenn <code>Band_Timer.Q</code> → Schritt 0<br>Nach dem CASE: Das Band läuft in Schritt 1.',
  learn:'Werte beim Schrittwechsel speichern; ein CASE im CASE.',
  take:'Eingangswerte, die sich während des Ablaufs ändern können, merkt man sich beim Schrittwechsel in einer eigenen Variable.',
  vars:{Schritt:0, Teil_Erkannt:false, Farbe:0, Merk_Farbe:0, Weiche_Pos:0, Band_Lauf:false}, fb:{Band_Timer:'TON'},
  timed:[{steps:[[0,{Teil_Erkannt:true, Farbe:2},{Schritt:1, Merk_Farbe:2}],[0,{Teil_Erkannt:false, Farbe:0},{Weiche_Pos:20, Band_Lauf:true}],[1,{},{Weiche_Pos:20}],[1,{},{Schritt:0, Band_Lauf:false}],
    [0,{Teil_Erkannt:true, Farbe:1},{Schritt:1}],[0,{Farbe:2},{Weiche_Pos:-20}],[1,{},{Schritt:1}],[1,{},{Schritt:0}],[0,{Teil_Erkannt:true, Farbe:5},{Schritt:1}],[0,{},{Weiche_Pos:0}]]}],
  ref:'Band_Timer(IN := Schritt = 1, PT := T#2S);\nCASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Merk_Farbe := Farbe;\n      Schritt := 1;\n    END_IF;\n  1:\n    CASE Merk_Farbe OF\n      1: Weiche_Pos := -20;\n      2: Weiche_Pos := 20;\n    ELSE\n      Weiche_Pos := 0;\n    END_CASE;\n    IF Band_Timer.Q THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nBand_Lauf := Schritt = 1;', man:'schrittketten', must:['CASE','TON'],
  hint:'Das innere CASE steht im Zweig „1:“ des äußeren CASE.',
  hint2:'Im zweiten Durchlauf ändert sich <code>Farbe</code> während Schritt 1 — die Weiche muss trotzdem der gemerkten Farbe folgen.',
  bind:['displayValue=Schritt','displayLabel:"SCHRITT"','gateAngle=Weiche_Pos','beltRunning=Band_Lauf',{channel:'partColor', variable:'Merk_Farbe', map:{'0':'neutral','1':'red','2':'green','5':'blue'}},'sensorActive=Teil_Erkannt','partVisible:true'],
  wrong:['Band_Timer(IN := Schritt = 1, PT := T#2S);\nCASE Schritt OF\n  0:\n    IF Teil_Erkannt THEN\n      Merk_Farbe := Farbe;\n      Schritt := 1;\n    END_IF;\n  1:\n    CASE Farbe OF\n      1: Weiche_Pos := -20;\n      2: Weiche_Pos := 20;\n    ELSE\n      Weiche_Pos := 0;\n    END_CASE;\n    IF Band_Timer.Q THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nBand_Lauf := Schritt = 1;']
});

defTask({ id:'final_boss', ch:10, title:'Aufstand der Maschinen', boss:true, final:true,
  story:'ARIA hat die komplette Zelle übernommen. Die Lampen flackern, der Arm zuckt, das Band rast. "Du hast alles gelernt, was du brauchst, Lehrling", funkt der Werkmeister. "Schreib die komplette Zyklussteuerung — und nimm ihr die Zelle weg."',
  brief:'1) Prüfe mit <code>FOR</code> über die 5 Teilesensoren (Index 0…4), ob ALLE TRUE sind → Meldung „Teile bereit“.<br>2) Rufe <code>Start_Trigger</code> (R_TRIG) mit dem Starttaster auf.<br>3) Ist der Not-Halt ausgelöst → Schritt 4.<br>4) Timer vor dem CASE: <code>Greif_Timer</code> (läuft in Schritt 1, T#2S), <code>Transport_Timer</code> (läuft in Schritt 2, T#3S).<br>5) <code>CASE … OF</code> über die Schrittvariable<br>&nbsp;&nbsp;<b>0 Bereit:</b> Greifer öffnen, Arm auf 0°; wenn Teile bereit UND <code>Start_Trigger.Q</code> → 1<br>&nbsp;&nbsp;<b>1 Greifen:</b> Greifer schliessen; wenn <code>Greif_Timer.Q</code> → 2<br>&nbsp;&nbsp;<b>2 Transport:</b> Arm auf 90°; wenn <code>Transport_Timer.Q</code> → 3<br>&nbsp;&nbsp;<b>3 Sortieren:</b> Weiche per <code>CASE … OF</code> nach dem Teiletyp stellen (1 → -15, 2 → 15, sonst 0), Greifer öffnen, Zyklenzähler + 1, → 0<br>&nbsp;&nbsp;<b>4 Not-Halt:</b> wenn quittiert wird UND der Not-Halt nicht mehr ansteht → 0<br>6) Nach dem CASE: Anlage aktiv in Schritt 1 ODER 2; rote Lampe und Hupe in Schritt 4.',
  learn:'Alles zusammen: Schleife, Flanke, Timer, verschachteltes CASE und Not-Halt in einer Schrittkette.',
  take:'Du hast eine vollständige, sichere Zyklussteuerung geschrieben — genau so sehen echte SPS-Programme in der Industrie aus. ARIA ist besiegt.',
  vars:{Teile_Sensoren:[false,false,false,false,false], Teile_Bereit:false, Start_Taster:false, Not_Aus:false, Quittieren:false, Schritt:0, Greifer_Auf:true, Achse_Grad:0, Teil_Typ:0, Weiche_Pos:0, Anlage_Aktiv:false, Zyklen:0, Ampel_Rot:false, Hupe:false},
  fb:{Start_Trigger:'R_TRIG', Greif_Timer:'TON', Transport_Timer:'TON'},
  timed:[{steps:[
    [0,{Teile_Sensoren:[true,true,false,true,true], Teil_Typ:1},{Schritt:0, Teile_Bereit:false}],
    [0,{Start_Taster:true},{Schritt:0}],
    [0,{Start_Taster:false, Teile_Sensoren:[true,true,true,true,true]},{Teile_Bereit:true, Schritt:0}],
    [0,{Start_Taster:true},{Schritt:1, Anlage_Aktiv:true}],
    [1,{},{Schritt:1, Greifer_Auf:false}],[1,{},{Schritt:1}],[1,{},{Schritt:2}],
    [1,{},{Schritt:2, Achse_Grad:90}],[1,{},{Schritt:2}],[1,{},{Schritt:2}],[1,{},{Schritt:3, Anlage_Aktiv:false}],
    [0,{},{Schritt:0, Weiche_Pos:-15, Zyklen:1, Greifer_Auf:true}],
    [0,{},{Achse_Grad:0}],
    [0,{Start_Taster:false, Teil_Typ:2},{}],[0,{Start_Taster:true},{Schritt:1}],
    [1,{},{Schritt:1}],[1,{Not_Aus:true},{Schritt:4, Ampel_Rot:true, Hupe:true, Anlage_Aktiv:false}],
    [1,{Quittieren:true},{Schritt:4}],[0,{Not_Aus:false},{Schritt:0, Ampel_Rot:false, Hupe:false}],
    [0,{Quittieren:false, Start_Taster:false},{}],[0,{Start_Taster:true},{Schritt:1}],
    [1,{},{Schritt:1}],[1,{},{Schritt:1}],[1,{},{Schritt:2}],[1,{},{Schritt:2, Achse_Grad:90}],[1,{},{Schritt:2}],[1,{},{Schritt:2}],[1,{},{Schritt:3}],[0,{},{Schritt:0, Weiche_Pos:15, Zyklen:2}]]}],
  ref:'Teile_Bereit := TRUE;\nFOR i := 0 TO 4 DO\n  IF NOT Teile_Sensoren[i] THEN\n    Teile_Bereit := FALSE;\n  END_IF;\nEND_FOR;\n\nStart_Trigger(CLK := Start_Taster);\n\nIF Not_Aus THEN\n  Schritt := 4;\nEND_IF;\n\nGreif_Timer(IN := Schritt = 1, PT := T#2S);\nTransport_Timer(IN := Schritt = 2, PT := T#3S);\n\nCASE Schritt OF\n  0:\n    Greifer_Auf := TRUE;\n    Achse_Grad := 0;\n    IF Teile_Bereit AND Start_Trigger.Q THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    IF Greif_Timer.Q THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    Achse_Grad := 90;\n    IF Transport_Timer.Q THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    CASE Teil_Typ OF\n      1: Weiche_Pos := -15;\n      2: Weiche_Pos := 15;\n    ELSE\n      Weiche_Pos := 0;\n    END_CASE;\n    Greifer_Auf := TRUE;\n    Zyklen := Zyklen + 1;\n    Schritt := 0;\n  4:\n    IF Quittieren AND NOT Not_Aus THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\n\nAnlage_Aktiv := (Schritt = 1) OR (Schritt = 2);\nAmpel_Rot := Schritt = 4;\nHupe := Schritt = 4;', man:'schrittketten', must:['FOR','CASE','TON','R_TRIG'],
  hint:'Arbeite die sechs Punkte der Reihe nach ab — jeder davon ist ein Muster, das du schon kennst.',
  hint2:'Die Timer stehen vor dem CASE, das Not-Aus-IF davor, die Ausgänge danach.',
  bind:['gripperOpen=Greifer_Auf','armAngle=Achse_Grad','gateAngle=Weiche_Pos','displayValue=Schritt','displayLabel:"SCHRITT"','faultActive=Not_Aus','lightGreen=Anlage_Aktiv','lightRed=Ampel_Rot','hornActive=Hupe','lightYellow=Teile_Bereit',{channel:'partColor', variable:'Teil_Typ', map:{'0':'neutral','1':'green','2':'red'}},'partVisible:true'],
  wrong:['Teile_Bereit := TRUE;\nFOR i := 0 TO 4 DO\n  IF NOT Teile_Sensoren[i] THEN\n    Teile_Bereit := FALSE;\n  END_IF;\nEND_FOR;\nStart_Trigger(CLK := Start_Taster);\nIF Not_Aus THEN\n  Schritt := 4;\nEND_IF;\nCASE Schritt OF\n  0:\n    Greifer_Auf := TRUE;\n    Achse_Grad := 0;\n    IF Teile_Bereit AND Start_Trigger.Q THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    Greif_Timer(IN := TRUE, PT := T#2S);\n    IF Greif_Timer.Q THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    Achse_Grad := 90;\n    Transport_Timer(IN := TRUE, PT := T#3S);\n    IF Transport_Timer.Q THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    CASE Teil_Typ OF\n      1: Weiche_Pos := -15;\n      2: Weiche_Pos := 15;\n    ELSE\n      Weiche_Pos := 0;\n    END_CASE;\n    Greifer_Auf := TRUE;\n    Zyklen := Zyklen + 1;\n    Schritt := 0;\n  4:\n    IF Quittieren AND NOT Not_Aus THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nAnlage_Aktiv := (Schritt = 1) OR (Schritt = 2);\nAmpel_Rot := Schritt = 4;\nHupe := Schritt = 4;']
});
