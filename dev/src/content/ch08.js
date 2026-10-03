/* ===== KAPITEL 8 — Impulse: R_TRIG, F_TRIG, CTU, CTD ===== */
defTask({ id:'r5t1', ch:8, title:'Startimpuls erkennen',
  story:'Auch wenn der Start-Taster sekundenlang gedrückt bleibt, darf die Zelle nur EINEN Greifbefehl auslösen. ARIA: "Warum nicht hundert?"',
  brief:'Erzeuge beim Drücken des Starttasters einen Greifimpuls für genau einen Zyklus. Die <code>R_TRIG</code>-Instanz des Starttasters steht bereit.',
  learn:'R_TRIG erkennt die steigende Flanke: Q ist genau einen Zyklus lang TRUE, wenn das Signal von FALSE auf TRUE wechselt.',
  take:'Baustein-Instanzen ruft man mit <code>Name(Parameter := Wert);</code> auf und liest ihre Ausgänge mit <code>Name.Q</code>.',
  vars:{Greif_Impuls:false, Start_Taster:false}, fb:{Start_Trigger:'R_TRIG'},
  timed:[{steps:[[0,{Start_Taster:false},{Greif_Impuls:false}],[0,{Start_Taster:true},{Greif_Impuls:true}],[0,{Start_Taster:true},{Greif_Impuls:false}],[0,{Start_Taster:true},{Greif_Impuls:false}],[0,{Start_Taster:false},{Greif_Impuls:false}],[0,{Start_Taster:true},{Greif_Impuls:true}]]}],
  ref:'Start_Trigger(CLK := Start_Taster);\nGreif_Impuls := Start_Trigger.Q;', man:'flanken', must:['R_TRIG'],
  hint:'Erst den Baustein aufrufen, dann seinen Ausgang lesen.',
  bind:['sensorActive=Start_Taster','lightGreen=Greif_Impuls','partVisible:true'],
  wrong:['Greif_Impuls := Start_Taster;']
});

defTask({ id:'c8_ftrig', ch:8, title:'Teil hat die Station verlassen',
  story:'Wenn ein Teil die Lichtschranke VERLÄSST, soll der Zähler des Leitrechners einen Impuls bekommen — nicht beim Eintreten und nicht, solange es drinsteht.',
  brief:'Melde für genau einen Zyklus, dass ein Teil die Lichtschranke verlassen hat (fallende Flanke). Eine <code>F_TRIG</code>-Instanz steht bereit.',
  learn:'F_TRIG erkennt die fallende Flanke (TRUE → FALSE).',
  take:'R_TRIG = „gerade eingeschaltet“, F_TRIG = „gerade ausgeschaltet“. Beide liefern nur einen Zyklus lang TRUE.',
  vars:{Teil_Erkannt:false, Teil_Weg:false}, fb:{Weg_Trigger:'F_TRIG'},
  timed:[{steps:[[0,{Teil_Erkannt:false},{Teil_Weg:false}],[0,{Teil_Erkannt:true},{Teil_Weg:false}],[0,{Teil_Erkannt:true},{Teil_Weg:false}],[0,{Teil_Erkannt:false},{Teil_Weg:true}],[0,{Teil_Erkannt:false},{Teil_Weg:false}]]}],
  ref:'Weg_Trigger(CLK := Teil_Erkannt);\nTeil_Weg := Weg_Trigger.Q;', man:'flanken', must:['F_TRIG'],
  hint:'Gleicher Aufbau wie bei R_TRIG — nur ein anderer Bausteintyp.',
  bind:['sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt','lightYellow=Teil_Weg'],
  wrong:['Teil_Weg := NOT Teil_Erkannt;']
});

defTask({ id:'c8_zaehlen', ch:8, title:'Teile zählen',
  story:'Jedes Teil, das in die Lichtschranke fährt, soll genau einmal gezählt werden — egal, wie lange es dort steht.',
  brief:'Zähle jedes Teil an der Lichtschranke genau einmal: Rufe die <code>R_TRIG</code>-Instanz der Lichtschranke auf und erhöhe bei ihrem Ausgang <code>Q</code> die Anzahl um 1.',
  learn:'Zählen mit Flankenerkennung.',
  take:'Ohne Flanke würde die SPS in jedem Zyklus zählen, solange das Teil vor dem Sensor steht — bei 1 ms Zykluszeit sind das 1000 Teile pro Sekunde!',
  vars:{Teil_Erkannt:false, Anzahl:0}, fb:{Teil_Trigger:'R_TRIG'},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Anzahl:1}],[0,{},{Anzahl:1}],[0,{},{Anzahl:1}],[0,{Teil_Erkannt:false},{Anzahl:1}],[0,{Teil_Erkannt:true},{Anzahl:2}],[0,{},{Anzahl:2}],[0,{Teil_Erkannt:false},{Anzahl:2}],[0,{Teil_Erkannt:true},{Anzahl:3}]]}],
  ref:'Teil_Trigger(CLK := Teil_Erkannt);\nIF Teil_Trigger.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;', man:'flanken', must:['R_TRIG'],
  hint:'Die Erhöhung gehört in ein IF, das auf <code>Teil_Trigger.Q</code> prüft.',
  bind:['sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt','displayValue=Anzahl','displayLabel:"STÜCK"','beltRunning:true'],
  wrong:['IF Teil_Erkannt THEN\n  Anzahl := Anzahl + 1;\nEND_IF;']
});

defTask({ id:'c8_zaehler_dbg', ch:8, title:'Der rasende Zähler', debug:true,
  story:'Nach drei Teilen zeigt der Stückzähler 4817, irgendetwas zählt in jedem Zyklus statt einmal pro Teil. ARIA: "Ich zähle eben sehr gründlich."',
  brief:'Pro Teil an der Lichtschranke soll die Anzahl um genau 1 steigen. Die <code>R_TRIG</code>-Instanz ist schon angelegt, wird aber nicht benutzt. Repariere den Code.',
  learn:'Den Unterschied zwischen Zustand und Flanke im Programm erkennen.',
  take:'Zustand („ist da“) ≠ Ereignis („ist gerade gekommen“). Zählen, Umschalten und Speichern brauchen fast immer das Ereignis.',
  vars:{Teil_Erkannt:false, Anzahl:0}, fb:{Teil_Trigger:'R_TRIG'},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Anzahl:1}],[0,{},{Anzahl:1}],[0,{},{Anzahl:1}],[0,{Teil_Erkannt:false},{Anzahl:1}],[0,{Teil_Erkannt:true},{Anzahl:2}]]}],
  start:'IF Teil_Erkannt THEN\n  Anzahl := Anzahl + 1;\nEND_IF;',
  ref:'Teil_Trigger(CLK := Teil_Erkannt);\nIF Teil_Trigger.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;', man:'flanken',
  hint:'Rufe <code>Teil_Trigger</code> mit dem Sensor auf und prüfe im IF den Ausgang statt des Sensors.',
  bind:['sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt','displayValue=Anzahl','displayLabel:"STÜCK"']
});

defTask({ id:'c8_toggle', ch:8, title:'Stromstoss-Schalter',
  story:'Die Hallenbeleuchtung der Zelle hat nur EINEN Taster: einmal drücken = an, nochmal drücken = aus. ARIA hat die Logik "vereinfacht" — jetzt flackert das Licht, solange man drückt.',
  brief:'Bei jedem Druck auf den Bedientaster soll das Hallenlicht umschalten (an ↔ aus). Die <code>R_TRIG</code>-Instanz des Tasters steht bereit.',
  learn:'Toggle-Schaltung: <code>Licht := NOT Licht;</code> bei jeder Flanke.',
  take:'Ohne Flanke würde <code>Licht := NOT Licht;</code> in jedem Zyklus umschalten — das Licht flackert mit der Zyklusfrequenz.',
  vars:{Taster:false, Licht:false}, fb:{Taster_Trigger:'R_TRIG'},
  timed:[{steps:[[0,{Taster:true},{Licht:true}],[0,{},{Licht:true}],[0,{Taster:false},{Licht:true}],[0,{Taster:true},{Licht:false}],[0,{},{Licht:false}],[0,{Taster:false},{Licht:false}],[0,{Taster:true},{Licht:true}]]}],
  ref:'Taster_Trigger(CLK := Taster);\nIF Taster_Trigger.Q THEN\n  Licht := NOT Licht;\nEND_IF;', man:'flanken', must:['R_TRIG'],
  hint:'Innerhalb des IF: <code>Licht := NOT Licht;</code>',
  bind:['lightYellow=Licht','sensorActive=Taster'],
  wrong:['IF Taster THEN\n  Licht := NOT Licht;\nEND_IF;','Taster_Trigger(CLK := Taster);\nIF Taster_Trigger.Q THEN\n  Licht := TRUE;\nEND_IF;']
});

defTask({ id:'c8_ctu', ch:8, title:'Karton voll (CTU)',
  story:'In jeden Karton kommen 5 Teile. Statt selbst zu zählen, nimmst du diesmal den fertigen Vorwärtszähler aus der Bibliothek — so wie in TIA Portal.',
  brief:'Zähle die Teile an der Lichtschranke mit dem <code>CTU</code>-Kartonzähler: bei 5 Teilen ist der Karton voll, der Quittiertaster setzt zurück. Zeige den Zählerstand am Bedienpanel.',
  learn:'CTU zählt steigende Flanken an CU, Q wird TRUE bei CV ≥ PV, R setzt zurück.',
  take:'CTU hat die Flankenerkennung schon eingebaut — du musst nicht selbst R_TRIG verwenden.',
  vars:{Teil_Erkannt:false, Quittieren:false, Karton_Voll:false, Anzeige:0}, fb:{Karton_Zaehler:'CTU'},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Anzeige:1, Karton_Voll:false}],[0,{Teil_Erkannt:false},{Anzeige:1}],[0,{Teil_Erkannt:true},{Anzeige:2}],[0,{Teil_Erkannt:true},{Anzeige:2}],[0,{Teil_Erkannt:false},{}],[0,{Teil_Erkannt:true},{Anzeige:3}],[0,{Teil_Erkannt:false},{}],[0,{Teil_Erkannt:true},{Anzeige:4, Karton_Voll:false}],[0,{Teil_Erkannt:false},{}],[0,{Teil_Erkannt:true},{Anzeige:5, Karton_Voll:true}],[0,{Teil_Erkannt:false, Quittieren:true},{Anzeige:0, Karton_Voll:false}]]}],
  ref:'Karton_Zaehler(CU := Teil_Erkannt, R := Quittieren, PV := 5);\nKarton_Voll := Karton_Zaehler.Q;\nAnzeige := Karton_Zaehler.CV;', man:'zaehler', must:['CTU'],
  hint:'Ein Aufruf mit drei Parametern, getrennt durch Kommas, dann zwei Zuweisungen.',
  bind:['sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt','displayValue=Anzeige','displayLabel:"IM KARTON"','lightGreen=Karton_Voll']
});

defTask({ id:'c8_ctd', ch:8, title:'Magazin leer (CTD)',
  story:'Das Schraubenmagazin fasst 10 Schrauben, jede Entnahme zählt rückwärts. Bei 0 muss die gelbe Lampe "Nachfüllen" anzeigen, bevor ARIA die letzten Schrauben versteckt.',
  brief:'Das Magazin fasst 10 Schrauben: Mit dem <code>CTD</code>-Zähler zählt jede Entnahme herunter, Nachfüllen lädt 10. Melde, wenn das Magazin leer ist, und gib die Restanzahl aus.',
  learn:'CTD zählt rückwärts; LD lädt den Startwert PV; Q ist TRUE bei CV ≤ 0.',
  take:'Rückwärtszähler sind ideal für Vorräte: laden, entnehmen, bei 0 melden.',
  vars:{Entnahme:false, Nachgefuellt:false, Leer:false, Rest:0}, fb:{Magazin:'CTD'},
  timed:[{steps:[[0,{Nachgefuellt:true},{Rest:10, Leer:false}],[0,{Nachgefuellt:false, Entnahme:true},{Rest:9}],[0,{Entnahme:false},{Rest:9}],[0,{Entnahme:true},{Rest:8}],[0,{Entnahme:true},{Rest:8, Leer:false}],[0,{Entnahme:false, Nachgefuellt:true},{Rest:10}]]},
         {steps:[[0,{},{Rest:0, Leer:true}],[0,{Nachgefuellt:true},{Rest:10, Leer:false}]]}],
  ref:'Magazin(CD := Entnahme, LD := Nachgefuellt, PV := 10);\nLeer := Magazin.Q;\nRest := Magazin.CV;', man:'zaehler', must:['CTD'],
  hint:'Gleicher Aufbau wie beim CTU — nur heissen die Eingänge CD und LD.',
  bind:['displayValue=Rest','displayLabel:"SCHRAUBEN"','lightYellow=Leer','gripperOpen=Entnahme']
});

defTask({ id:'c8_reset_dbg', ch:8, title:'Der Zähler, der nie zählt', debug:true,
  story:'Der Kartonzähler bleibt stur auf 0, obwohl nie jemand auf Quittieren drückt. ARIA: "Ich habe den Reset nur ein bisschen umgedreht."',
  brief:'Der Teilezähler (CTU) soll die Teile an der Lichtschranke zählen und nur zurückgesetzt werden, solange der Quittiertaster gedrückt ist. Finde den Fehler am R-Eingang.',
  learn:'Invertierte Signale an Reset-Eingängen erkennen.',
  take:'Ein dauerhaft anliegender Reset (R = TRUE) blockiert jeden Zähler. Bei „zählt nie“ zuerst den Reset prüfen!',
  vars:{Teil_Erkannt:false, Quittieren:false, Anzahl:0}, fb:{Zaehler:'CTU'},
  timed:[{steps:[[0,{Teil_Erkannt:true},{Anzahl:1}],[0,{Teil_Erkannt:false},{Anzahl:1}],[0,{Teil_Erkannt:true},{Anzahl:2}],[0,{Teil_Erkannt:false, Quittieren:true},{Anzahl:0}],[0,{Quittieren:false, Teil_Erkannt:true},{Anzahl:1}]]}],
  start:'Zaehler(CU := Teil_Erkannt, R := NOT Quittieren, PV := 100);\nAnzahl := Zaehler.CV;',
  ref:'Zaehler(CU := Teil_Erkannt, R := Quittieren, PV := 100);\nAnzahl := Zaehler.CV;', man:'zaehler',
  hint:'Was liegt am R-Eingang an, solange niemand quittiert?',
  bind:['sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt','displayValue=Anzahl','displayLabel:"STÜCK"']
});

defTask({ id:'c8_startstopp', ch:8, title:'Start- und Stopp-Impuls',
  story:'Das Band wird über zwei Taster bedient, jeder Tastendruck ist ein Befehl, egal wie lange man drückt. Werden beide gleichzeitig gedrückt, gewinnt Stopp.',
  brief:'Das Förderband startet bei der Flanke des Starttasters und stoppt bei der Flanke des Stopptasters (je eine <code>R_TRIG</code>-Instanz). Stopp hat Vorrang: prüfe ihn <strong>nach</strong> dem Start.',
  learn:'Setzen und Rücksetzen mit Flanken; Vorrang durch Reihenfolge.',
  take:'Bei zwei IFs gewinnt das spätere, weil es den Wert zuletzt schreibt. „Rücksetzen dominant“ heisst: Reset-IF nach Set-IF.',
  vars:{Start_Taster:false, Stopp_Taster:false, Band_Lauf:false}, fb:{Start_Flanke:'R_TRIG', Stopp_Flanke:'R_TRIG'},
  timed:[{steps:[[0,{Start_Taster:true},{Band_Lauf:true}],[0,{Start_Taster:false},{Band_Lauf:true}],[0,{Stopp_Taster:true},{Band_Lauf:false}],[0,{},{Band_Lauf:false}],[0,{Stopp_Taster:false, Start_Taster:true},{Band_Lauf:true}],[0,{Start_Taster:false},{}],[0,{Start_Taster:true, Stopp_Taster:true},{Band_Lauf:false}]]}],
  ref:'Start_Flanke(CLK := Start_Taster);\nStopp_Flanke(CLK := Stopp_Taster);\nIF Start_Flanke.Q THEN\n  Band_Lauf := TRUE;\nEND_IF;\nIF Stopp_Flanke.Q THEN\n  Band_Lauf := FALSE;\nEND_IF;', man:'flanken', must:['R_TRIG'],
  hint:'Zwei Aufrufe, zwei IFs. Das Stopp-IF kommt zuletzt.',
  bind:['beltRunning=Band_Lauf','lightGreen=Band_Lauf','lightRed=Stopp_Taster'],
  wrong:['Start_Flanke(CLK := Start_Taster);\nStopp_Flanke(CLK := Stopp_Taster);\nIF Stopp_Flanke.Q THEN\n  Band_Lauf := FALSE;\nEND_IF;\nIF Start_Flanke.Q THEN\n  Band_Lauf := TRUE;\nEND_IF;']
});

defTask({ id:'c8_boss', ch:8, title:'Die Kartonieranlage', boss:true,
  story:'ARIA hat die Kartonieranlage übernommen und stopft 50 Teile in einen 6er-Karton. Du übernimmst: zählen, bei vollem Karton stoppen, quittieren, weiter.',
  brief:'Zähle Teile an der Lichtschranke mit dem <code>CTU</code>-Teilezähler bis 6 (Karton voll), die Quittierflanke setzt zurück, Stand aufs Panel. Voll: Band aus, Grün an, Weiche 20°; sonst Band ein, Grün aus, Weiche 0°.',
  learn:'Flanken, Zähler und abgeleitete Ausgänge zu einer Station kombinieren.',
  take:'Mit einer Flanke am Reset quittiert man <em>einmal</em> — auch wenn der Bediener den Taster länger hält.',
  vars:{Teil_Erkannt:false, Quittieren:false, Karton_Voll:false, Anzeige:0, Band_Lauf:false, Ampel_Gruen:false, Weiche_Pos:0}, fb:{Zaehler:'CTU', Quitt_Flanke:'R_TRIG'},
  timed:[{steps:[[0,{},{Band_Lauf:true, Anzeige:0}],
    [0,{Teil_Erkannt:true},{Anzeige:1}],[0,{Teil_Erkannt:false},{}],[0,{Teil_Erkannt:true},{Anzeige:2}],[0,{Teil_Erkannt:false},{}],[0,{Teil_Erkannt:true},{Anzeige:3}],[0,{Teil_Erkannt:false},{}],
    [0,{Teil_Erkannt:true},{Anzeige:4}],[0,{Teil_Erkannt:false},{}],[0,{Teil_Erkannt:true},{Anzeige:5, Band_Lauf:true, Weiche_Pos:0}],[0,{Teil_Erkannt:false},{}],
    [0,{Teil_Erkannt:true},{Anzeige:6, Karton_Voll:true, Band_Lauf:false, Ampel_Gruen:true, Weiche_Pos:20}],[0,{Teil_Erkannt:false},{Karton_Voll:true}],
    [0,{Quittieren:true},{Anzeige:0, Karton_Voll:false, Band_Lauf:true, Weiche_Pos:0}],[0,{},{Anzeige:0}],[0,{Teil_Erkannt:true},{Anzeige:1}]]}],
  ref:'Quitt_Flanke(CLK := Quittieren);\nZaehler(CU := Teil_Erkannt, R := Quitt_Flanke.Q, PV := 6);\nKarton_Voll := Zaehler.Q;\nAnzeige := Zaehler.CV;\nBand_Lauf := NOT Karton_Voll;\nAmpel_Gruen := Karton_Voll;\nIF Karton_Voll THEN\n  Weiche_Pos := 20;\nELSE\n  Weiche_Pos := 0;\nEND_IF;', man:'zaehler', must:['CTU','R_TRIG'],
  hint:'Die Reihenfolge ist wichtig: Erst die Quittier-Flanke auswerten, dann den Zähler aufrufen.',
  hint2:'Im letzten Schritt wird der Quittier-Taster noch gehalten — mit Flanke zählt der Zähler trotzdem wieder hoch.',
  bind:['sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt','displayValue=Anzeige','displayLabel:"IM KARTON"','beltRunning=Band_Lauf','lightGreen=Ampel_Gruen','gateAngle=Weiche_Pos'],
  wrong:['Zaehler(CU := Teil_Erkannt, R := Quittieren, PV := 6);\nKarton_Voll := Zaehler.Q;\nAnzeige := Zaehler.CV;\nBand_Lauf := NOT Karton_Voll;\nAmpel_Gruen := Karton_Voll;\nIF Karton_Voll THEN\n  Weiche_Pos := 20;\nELSE\n  Weiche_Pos := 0;\nEND_IF;']
});
