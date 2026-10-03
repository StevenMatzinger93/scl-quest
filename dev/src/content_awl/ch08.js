/* ===== AWL QUEST · KAPITEL 8 — Rechnen ===== */
(function(){

defAwl({ id:'a8_plus', ch:8, title:'Zwei Längen',
  story:'Ein Block wird in zwei Stücke geschnitten. Die Waage am Kühlbett will die Gesamtlänge wissen.',
  brief:'Die Gesamtlänge ist die Summe der Längen beider Stücke: zwei <code>L</code>, dann <code>+I</code> und <code>T</code>.',
  learn:'Addieren mit +I.',
  take:'<code>+I</code> addiert AKKU2 und AKKU1 als Ganzzahlen (INT). Das Ergebnis steht in AKKU1 und wird mit <code>T</code> gespeichert.',
  vars:{ Laenge_1:0, Laenge_2:0, Gesamt:0 },
  tests:[[{ Laenge_1:420, Laenge_2:380 }, { Gesamt:800 }], [{ Laenge_1:12, Laenge_2:0 }, { Gesamt:12 }]],
  ref:'L  Laenge_1\nL  Laenge_2\n+I\nT  Gesamt', man:'rechnen', must:['+I'],
  hint:'L · L · +I · T',
  bind:['displayValue=Gesamt', 'displayLabel:"LÄNGE cm"'] });

defAwl({ id:'a8_minus', ch:8, title:'Die Stichabnahme',
  story:'Jeder Durchgang durch das Gerüst heisst <b>Stich</b>. Die Abnahme ist der Unterschied der Dicke vor und nach dem Stich.',
  brief:'Die Stichabnahme ist die Dicke vor dem Stich minus die Dicke danach. <code>-I</code> rechnet AKKU2 − AKKU1.',
  learn:'Subtrahieren mit -I: AKKU2 − AKKU1.',
  take:'<code>-I</code> rechnet <b>AKKU2 minus AKKU1</b>. Die Reihenfolge der Ladebefehle entscheidet also, was wovon abgezogen wird.',
  vars:{ Dicke_ein:0, Dicke_aus:0, Abnahme:0 },
  tests:[[{ Dicke_ein:120, Dicke_aus:90 }, { Abnahme:30 }], [{ Dicke_ein:40, Dicke_aus:32 }, { Abnahme:8 }]],
  ref:'L  Dicke_ein\nL  Dicke_aus\n-I\nT  Abnahme', man:'rechnen', must:['-I'],
  hint:'Erst Dicke_ein laden, dann Dicke_aus.',
  bind:['rollGap=Dicke_aus', 'displayValue=Abnahme', 'displayLabel:"ABNAHME mm"'] });

defAwl({ id:'a8_mal', ch:8, title:'Der Querschnitt',
  story:'Für die Walzkraft braucht die Steuerung den Querschnitt des Blocks: Breite mal Dicke.',
  brief:'Der Querschnitt ist Blockbreite mal Blockdicke (mit <code>*I</code>).',
  learn:'Multiplizieren mit *I.',
  take:'<code>*I</code> multipliziert AKKU2 mit AKKU1. Achtung: INT reicht nur bis 32 767 — für grosse Produkte braucht man DINT (<code>*D</code>) oder REAL.',
  vars:{ Breite:0, Dicke:0, Flaeche:0 },
  tests:[[{ Breite:150, Dicke:90 }, { Flaeche:13500 }], [{ Breite:80, Dicke:12 }, { Flaeche:960 }]],
  ref:'L  Breite\nL  Dicke\n*I\nT  Flaeche', man:'rechnen', must:['*I'],
  hint:'L Breite · L Dicke · *I · T Flaeche',
  bind:['displayValue=Flaeche', 'displayLabel:"QUERSCHNITT mm²"'] });

defAwl({ id:'a8_div_mod', ch:8, title:'Reihen auf dem Kühlbett',
  story:'Auf dem Kühlbett liegen die Stäbe in Reihen zu je 8. Der Leitstand zeigt, wie viele Reihen voll sind und wie viele Stäbe in der angefangenen Reihe liegen.',
  brief:'Die vollen Reihen auf dem Kühlbett sind die Stäbe geteilt durch 8 (<code>/I</code>), der Restwert ist der Rest dieser Division (<code>MOD</code>).',
  learn:'Ganzzahldivision und Rest.',
  take:'<code>/I</code> teilt ganzzahlig und schneidet ab: 21 / 8 = 2. <code>MOD</code> liefert den Rest: 21 MOD 8 = 5.',
  vars:{ Staebe:0, Reihen:0, Rest:0 },
  tests:[[{ Staebe:21 }, { Reihen:2, Rest:5 }], [{ Staebe:16 }, { Reihen:2, Rest:0 }], [{ Staebe:7 }, { Reihen:0, Rest:7 }]],
  ref:'L  Staebe\nL  8\n/I\nT  Reihen\nL  Staebe\nL  8\nMOD\nT  Rest', man:'rechnen', must:['/I', 'MOD'],
  hint:'Zwei Rechnungen hintereinander, jede mit L · L · Operation · T.',
  bind:['pieceCount=Staebe', 'displayValue=Reihen', 'displayLabel:"VOLLE REIHEN"'] });

defAwl({ id:'a8_reihenfolge_dbg', ch:8, title:'Negative Abnahme', debug:true,
  story:'Die Anzeige der Stichabnahme zeigt −30 mm, als würde ein Block beim Walzen dicker. Herr Brunner schnaubt, ARIA hat zwei Zeilen vertauscht.',
  brief:'Die Stichabnahme ist die Dicke vor dem Stich minus die Dicke danach – sie muss positiv sein.',
  learn:'Reihenfolge bei -I und /I.',
  take:'Bei <code>-I</code> und <code>/I</code> kommt es auf die Reihenfolge an: Gerechnet wird immer <b>AKKU2 op AKKU1</b> — der zuerst geladene Wert steht links.',
  vars:{ Dicke_ein:0, Dicke_aus:0, Abnahme:0 },
  tests:[[{ Dicke_ein:120, Dicke_aus:90 }, { Abnahme:30 }]],
  start:'L  Dicke_aus\nL  Dicke_ein\n-I\nT  Abnahme', ref:'L  Dicke_ein\nL  Dicke_aus\n-I\nT  Abnahme', man:'rechnen', must:['-I'],
  hint:'Tausche die beiden L-Zeilen.',
  bind:['rollGap=Dicke_aus', 'displayValue=Abnahme', 'displayLabel:"ABNAHME mm"'] });

defAwl({ id:'a8_mittel', ch:8, title:'Die mittlere Temperatur',
  story:'Zwei Fühler messen den Block beim Verlassen des Ofens. Die Anzeige soll den Mittelwert mit Kommastellen zeigen — 1187,5 °C ist nicht dasselbe wie 1187 °C.',
  brief:'Die mittlere Blocktemperatur (REAL) ist die Summe beider Fühler geteilt durch 2,0 – mit Kommastellen. Nach <code>+I</code> umwandeln (<code>ITD</code>, <code>DTR</code>), dann <code>/R</code>.',
  learn:'Umwandeln (ITD, DTR) und mit REAL rechnen.',
  take:'Die Summe ist eine Ganzzahl. <code>ITD</code> macht daraus eine DINT, <code>DTR</code> eine REAL-Zahl. Erst dann liefert <code>/R</code> die Nachkommastellen.',
  vars:{ Temp_1:0, Temp_2:0, Mittel:0 }, types:{ Mittel:'REAL' },
  tests:[[{ Temp_1:1180, Temp_2:1195 }, { Mittel:1187.5 }], [{ Temp_1:1000, Temp_2:1000 }, { Mittel:1000 }]],
  ref:'L  Temp_1\nL  Temp_2\n+I\nITD\nDTR\nL  2.0\n/R\nT  Mittel', man:'rechnen', must:['DTR', '/R'],
  wrong:['L  Temp_1\nL  Temp_2\n+I\nL  2\n/I\nITD\nDTR\nT  Mittel'],
  hint:'Nach +I: ITD · DTR · L 2.0 · /R · T Mittel',
  bind:['furnaceTemp=Temp_1', 'displayValue=Mittel', 'displayLabel:"MITTEL °C"'] });

defAwl({ id:'a8_runden', ch:8, title:'Zoll für den Kunden',
  story:'Ein Kunde aus Übersee will die Blocklänge in Zoll, und ein Zoll sind 25,4 mm. Die Anzeige zeigt nur ganze Zahlen, also wird gerundet.',
  brief:'Die Blocklänge in Zoll (INT) ist die Blocklänge in mm (REAL) geteilt durch 25,4, gerundet mit <code>RND</code>.',
  learn:'REAL-Division und RND.',
  take:'<code>RND</code> rundet eine REAL-Zahl im AKKU1 zur nächsten Ganzzahl. Erst dann darf sie in eine INT-Variable transferiert werden.',
  vars:{ Laenge_mm:0, Zoll:0 }, types:{ Laenge_mm:'REAL' },
  tests:[[{ Laenge_mm:1000 }, { Zoll:39 }], [{ Laenge_mm:2540 }, { Zoll:100 }], [{ Laenge_mm:63.5 }, { Zoll:2 }]],
  ref:'L  Laenge_mm\nL  25.4\n/R\nRND\nT  Zoll', man:'rechnen', must:['/R', 'RND'],
  hint:'L Laenge_mm · L 25.4 · /R · RND · T Zoll',
  bind:['displayValue=Zoll', 'displayLabel:"LÄNGE ZOLL"'] });

defAwl({ id:'a8_inc', ch:8, title:'Etwas mehr Spalt',
  story:'Bei zähen Stählen stellt der Walzmeister den Spalt um 2 mm weiter. Statt eine Konstante zu laden und zu addieren, nimmst du den kurzen Befehl <code>INC</code>.',
  brief:'Der Walzspalt-Sollwert ist der Messwert plus 2 mm. Zum Beispiel mit <code>INC 2</code> statt einer Addition.',
  learn:'INC und DEC.',
  take:'<code>INC n</code> erhöht AKKU1 um n, <code>DEC n</code> verringert ihn. AKKU2 bleibt dabei unberührt.',
  vars:{ Spalt:0, Spalt_Soll:0 },
  tests:[[{ Spalt:12 }, { Spalt_Soll:14 }], [{ Spalt:0 }, { Spalt_Soll:2 }]],
  ref:'L  Spalt\nINC 2\nT  Spalt_Soll', man:'rechnen', must:['INC'],
  hint:'L Spalt · INC 2 · T Spalt_Soll',
  bind:['rollGap=Spalt_Soll'] });

defAwl({ id:'a8_ganzzahl_dbg', ch:8, title:'Die verschwundenen Kommastellen', debug:true,
  story:'Die Durchschnittsgeschwindigkeit des Rollgangs zeigt 2,0 m/s, obwohl es 2,5 m/s sein müssten. ARIA hat vor dem Umwandeln geteilt.',
  brief:'Die Rollganggeschwindigkeit (REAL) ist Weg geteilt durch Fahrzeit – mit Kommastellen, also erst umwandeln, dann teilen.',
  learn:'Erst umwandeln, dann teilen.',
  take:'<code>/I</code> schneidet die Kommastellen ab, bevor die Umwandlung sie retten könnte. Wer Nachkommastellen braucht, wandelt <b>vorher</b> in REAL um.',
  vars:{ Weg:0, Zeit:0, Tempo:0 }, types:{ Tempo:'REAL' },
  tests:[[{ Weg:25, Zeit:10 }, { Tempo:2.5 }], [{ Weg:12, Zeit:4 }, { Tempo:3 }]],
  start:'L  Weg\nL  Zeit\n/I\nITD\nDTR\nT  Tempo', ref:'L  Weg\nITD\nDTR\nL  Zeit\nITD\nDTR\n/R\nT  Tempo', man:'rechnen', must:['/R', 'DTR'],
  hint:'Beide Werte nach dem Laden umwandeln (ITD, DTR), dann /R.',
  bind:['conveyorRunning:true', 'displayValue=Tempo', 'displayLabel:"TEMPO m/s"'] });

defAwl({ id:'a8_boss', ch:8, title:'Boss: Der Stichplan', boss:true,
  story:'ARIA hat den Stichplan gelöscht, doch Herr Brunner rechnet im Kopf: „Jeder Stich nimmt 20 Prozent ab, nach drei Stichen hat ein 120er-Block noch 61 Millimeter, gerundet.“ Die Steuerung soll das für jeden Block rechnen, dazu die Gesamtabnahme.',
  brief:'Jeder Stich nimmt 20 % ab: Dicke nach drei Stichen (INT) = Blockdicke × 0,8 × 0,8 × 0,8, gerundet. Die Stichabnahme ist Blockdicke minus diese Dicke.',
  learn:'Mehrere Rechenschritte im Akku.',
  take:'Rechenketten bleiben im Akku: Das Ergebnis jeder Operation steht in AKKU1 und ist der Ausgangswert für die nächste. Erst am Ende wird transferiert.',
  vars:{ Dicke:0, Dicke_3:0, Abnahme:0 },
  tests:[[{ Dicke:120 }, { Dicke_3:61, Abnahme:59 }], [{ Dicke:200 }, { Dicke_3:102, Abnahme:98 }], [{ Dicke:10 }, { Dicke_3:5, Abnahme:5 }]],
  ref:'NETWORK Dicke nach drei Stichen\nL  Dicke\nITD\nDTR\nL  0.8\n*R\nL  0.8\n*R\nL  0.8\n*R\nRND\nT  Dicke_3\n\nNETWORK Abnahme\nL  Dicke\nL  Dicke_3\n-I\nT  Abnahme', man:'rechnen', must:['*R', 'RND', 'DTR', '-I'],
  hint:'Nach DTR dreimal L 0.8 · *R, dann RND.',
  bind:['rollGap=Dicke_3', 'displayValue=Abnahme', 'displayLabel:"ABNAHME mm"'] });
})();
