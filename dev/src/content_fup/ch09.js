/* ===== FUP QUEST · KAPITEL 9 — Vergleicher und Werte ===== */
(function(){
const seq = steps => [{ steps }];
const BEGRIFF = 'NETWORK Halt\n=> MOVE(0, Begriff_A);\n\nNETWORK Fahrt\nFahrt => MOVE(1, Begriff_A);\n\nNETWORK Fahrt mit Warnung\nFahrt AND W1_rechts => MOVE(2, Begriff_A);';

defFup({ id:'f9_tempo', ch:9, title:'Zu schnell',
  story:'Über die Weiche in den Abzweig darf nur mit höchstens <b>40 km/h</b> gefahren werden. Der Zug meldet seine Geschwindigkeit als Zahl.',
  brief:'Zuggeschwindigkeit &gt; 40 → Geschwindigkeitswarnung.<br>Eingang antippen → <b>CMP</b>, IN1 Zuggeschwindigkeit, Vergleich <code>&gt;</code>, IN2 <code>40</code>.',
  learn:'Die Vergleichsbox (CMP).',
  take:'Eine <b>CMP-Box</b> vergleicht zwei Zahlen und liefert 1, wenn der Vergleich stimmt: ==, &lt;&gt;, &gt;, &gt;=, &lt;, &lt;=.',
  vars:{ Tempo:0, Warnung:false },
  tests: [0, 30, 40, 41, 80].map(v => [{ Tempo:v }, { Warnung: v > 40 }]),
  ref:'NETWORK Zu schnell\n[Tempo > 40] => Warnung;', man:'vergleich', must:['CMP'],
  hint:'Eine CMP-Box vor der Zuweisung.',
  bind:['trainSpeed=Tempo', 'lightYellow=Warnung'] });

defFup({ id:'f9_bereich', ch:9, title:'Gelb und Rot',
  story:'Zwischen 40 und 60 km/h leuchtet Gelb (Warnung), über 60 km/h Rot (Zwangsbremsung).',
  brief:'<b>NW 1:</b> Zuggeschwindigkeit &gt; 40 und ≤ 60 → gelbe Melderlampe<br><b>NW 2:</b> Zuggeschwindigkeit &gt; 60 → Zwangsbremsung',
  learn:'Wertebereich mit zwei Vergleichern in einer UND-Box.',
  take:'Ein Bereich „zwischen a und b“ sind zwei CMP-Boxen an einer &amp;-Box. Die Grenzen müssen lückenlos anschliessen.',
  vars:{ Tempo:0, Melder_Gelb:false, Zwangsbremsung:false },
  tests: [0, 40, 41, 60, 61, 100].map(v => [{ Tempo:v }, { Melder_Gelb: v > 40 && v <= 60, Zwangsbremsung: v > 60 }]),
  ref:'NETWORK Warnung\n[Tempo > 40] AND [Tempo <= 60] => Melder_Gelb;\n\nNETWORK Zwangsbremsung\n[Tempo > 60] => Zwangsbremsung;', man:'vergleich', must:['CMP','SERIES'],
  hint:'NW 1: &-Box mit zwei CMP-Boxen als Eingänge.',
  bind:['trainSpeed=Tempo', 'lightYellow=Melder_Gelb', 'lightRed=Zwangsbremsung'] });

defFup({ id:'f9_zugnummer', ch:9, title:'Der Güterzug nach Gleis 2',
  story:'Züge melden ihre Nummer. Der Güterzug <b>4711</b> fährt immer auf Gleis 2 — dafür muss Weiche 1 abzweigend liegen.',
  brief:'Zugnummer == 4711 → Weiche 1 auf abzweigend stellen (Stellbefehl).',
  learn:'Gleichheit prüfen (==).',
  take:'Mit <code>==</code> und <code>&lt;&gt;</code> werden Nummern ausgewählt: Züge, Gleise, Programme.',
  vars:{ Zugnummer:0, W1_abzweig:false },
  tests: [0, 4710, 4711, 4712].map(v => [{ Zugnummer:v }, { W1_abzweig: v === 4711 }]),
  ref:'NETWORK Gleiswahl\n[Zugnummer == 4711] => W1_abzweig;', man:'vergleich', must:['CMP'],
  hint:'CMP-Box, Vergleich ==.',
  bind:['displayValue=Zugnummer', 'displayLabel:"ZUG NR"', 'switch1Right=W1_abzweig'] });

defFup({ id:'f9_begriff', ch:9, title:'Signalbegriffe als Zahl',
  story:'Das neue Signal kennt drei Begriffe: 0 = Halt, 1 = Fahrt, 2 = Fahrt mit Warnung (über die abzweigende Weiche). Es bekommt den Begriff als Zahl.',
  brief:'<b>NW 1:</b> ohne Bedingung → MOVE 0 in den Signalbegriff von Signal A<br><b>NW 2:</b> Fahrt angefordert → MOVE 1 dorthin<br><b>NW 3:</b> Fahrt angefordert und Weiche 1 liegt rechts → MOVE 2 dorthin',
  learn:'Rangfolge mit mehreren MOVE-Boxen.',
  take:'Mehrere MOVEs auf dasselbe Ziel: Das <b>letzte</b> Netzwerk mit EN = 1 gewinnt. Mit einem Grundwert oben entsteht eine klare Rangfolge.',
  vars:{ Fahrt:false, W1_rechts:false, Begriff_A:0 },
  tests:[[{}, { Begriff_A:0 }], [{ Fahrt:true }, { Begriff_A:1 }], [{ Fahrt:true, W1_rechts:true }, { Begriff_A:2 }], [{ W1_rechts:true }, { Begriff_A:0 }]],
  ref: BEGRIFF, man:'werte', must:['MOVE','NETWORKS'],
  hint:'Drei Netzwerke mit MOVE-Boxen; die Warnung kommt zuletzt.',
  bind:['signalEntry=Begriff_A', 'switch1Right=W1_rechts'] });

defFup({ id:'f9_grenze_dbg', ch:9, title:'Genau 40', debug:true,
  story:'Bei genau 40 km/h soll noch <b>keine</b> Warnung kommen — 40 ist erlaubt. ARIA hat den Vergleich „ein bisschen“ verändert.',
  brief:'Geschwindigkeitswarnung erst <b>über</b> 40 km/h.',
  learn:'Grenzwerte genau lesen.',
  take:'„Bis 40 erlaubt“ heisst Warnung bei <code>&gt; 40</code>. Mit <code>&gt;= 40</code> kommt sie genau an der Grenze zu früh.',
  vars:{ Tempo:0, Warnung:false },
  tests: [39, 40, 41].map(v => [{ Tempo:v }, { Warnung: v > 40 }]),
  start:'NETWORK Zu schnell\n[Tempo >= 40] => Warnung;', ref:'NETWORK Zu schnell\n[Tempo > 40] => Warnung;', man:'vergleich', must:['CMP'],
  hint:'Vergleichsoperator in der CMP-Box ändern.',
  bind:['trainSpeed=Tempo', 'lightYellow=Warnung'] });

defFup({ id:'f9_zuglaenge', ch:9, title:'Wie lang ist der Zug?',
  story:'Aus den gezählten Achsen berechnet das Stellwerk die Zuglänge: pro Achse etwa <b>7 Meter</b>. Passt der Zug nicht ins 120 m lange Gleis 2, darf er dort nicht hin.',
  brief:'<b>NW 1:</b> ohne Bedingung → MUL Anzahl Achsen · 7 → Zuglänge in Metern<br><b>NW 2:</b> Zuglänge ≤ 120 → Meldung „Gleis 2 passt“',
  learn:'Rechnen und das Ergebnis vergleichen.',
  take:'Rechenboxen und Vergleicher arbeiten zusammen: erst ausrechnen, dann entscheiden.',
  vars:{ Achsen:0, Laenge_m:0, Gleis2_passt:false },
  tests:[[{ Achsen:8 }, { Laenge_m:56, Gleis2_passt:true }], [{ Achsen:17 }, { Laenge_m:119, Gleis2_passt:true }], [{ Achsen:18 }, { Laenge_m:126, Gleis2_passt:false }]],
  ref:'NETWORK Zuglaenge\n=> MUL(Achsen, 7, Laenge_m);\n\nNETWORK Gleis 2 passt\n[Laenge_m <= 120] => Gleis2_passt;', man:'werte', must:['MUL','CMP'],
  hint:'NW 1: „immer“ → Rechnen → MUL. NW 2: CMP-Box.',
  bind:['axleCount=Achsen', 'displayValue=Laenge_m', 'displayLabel:"ZUGLÄNGE m"', 'lightGreen=Gleis2_passt'] });

defFup({ id:'f9_verspaetung', ch:9, title:'Verspätung',
  story:'Der Fahrplan kennt die Soll-Ankunft in Minuten nach Mitternacht, die Uhr die Ist-Zeit. Das Stelltisch-Display soll die Verspätung zeigen, und ab <b>5 Minuten</b> leuchtet Gelb.',
  brief:'<b>NW 1:</b> ohne Bedingung → SUB Ist-Zeit − Soll-Zeit → Verspätung<br><b>NW 2:</b> Verspätung ≥ 5 → gelbe Melderlampe',
  learn:'Subtrahieren und die Differenz bewerten.',
  take:'SUB rechnet <code>IN1 − IN2</code>. Die Reihenfolge der Eingänge ist wichtig — vertauscht wird aus einer Verspätung eine Verfrühung.',
  vars:{ Ist_min:0, Soll_min:0, Verspaetung:0, Melder_Gelb:false },
  tests:[[{ Ist_min:600, Soll_min:600 }, { Verspaetung:0, Melder_Gelb:false }], [{ Ist_min:607, Soll_min:600 }, { Verspaetung:7, Melder_Gelb:true }], [{ Ist_min:604, Soll_min:600 }, { Verspaetung:4, Melder_Gelb:false }]],
  ref:'NETWORK Verspaetung\n=> SUB(Ist_min, Soll_min, Verspaetung);\n\nNETWORK Warnung\n[Verspaetung >= 5] => Melder_Gelb;', man:'werte', must:['SUB','CMP'],
  hint:'Rechnen → SUB, IN1 Ist_min, IN2 Soll_min.',
  bind:['displayValue=Verspaetung', 'displayLabel:"VERSPÄTUNG min"', 'lightYellow=Melder_Gelb'] });

defFup({ id:'f9_begriff_dbg', ch:9, title:'Warnung wird verschluckt', debug:true,
  story:'Über die abzweigende Weiche zeigt das Signal nur „Fahrt“ statt „Fahrt mit Warnung“ — der Lokführer rast in die Kurve. ARIA hat die Netzwerke umgestellt.',
  brief:'Bei angeforderter Fahrt und Weiche 1 rechts muss der Signalbegriff von Signal A = 2 sein.',
  learn:'Rangfolge von MOVE-Netzwerken prüfen.',
  take:'Bei mehreren MOVEs entscheidet die Reihenfolge. Der wichtigste Fall gehört nach unten, sonst wird er überschrieben.',
  vars:{ Fahrt:false, W1_rechts:false, Begriff_A:0 },
  tests:[[{ Fahrt:true, W1_rechts:true }, { Begriff_A:2 }], [{ Fahrt:true }, { Begriff_A:1 }], [{}, { Begriff_A:0 }]],
  start:'NETWORK Halt\n=> MOVE(0, Begriff_A);\n\nNETWORK Fahrt mit Warnung\nFahrt AND W1_rechts => MOVE(2, Begriff_A);\n\nNETWORK Fahrt\nFahrt => MOVE(1, Begriff_A);', ref: BEGRIFF, man:'werte', must:['MOVE'],
  hint:'Netzwerk „Fahrt mit Warnung“ nach unten verschieben.',
  bind:['signalEntry=Begriff_A', 'switch1Right=W1_rechts'] });

defFup({ id:'f9_tempo_move', ch:9, title:'Zulässige Geschwindigkeit',
  story:'Die zulässige Geschwindigkeit hängt von der Weiche ab: gerade 80 km/h, abzweigend 40 km/h. Das Signal meldet sie an den Zug, und das Stellwerk vergleicht sie mit dem Ist-Tempo.',
  brief:'<b>NW 1:</b> ohne Bedingung → MOVE 80 in die zulässige Geschwindigkeit<br><b>NW 2:</b> Weiche 1 liegt rechts → MOVE 40 dorthin<br><b>NW 3:</b> Zuggeschwindigkeit &gt; zulässige Geschwindigkeit → Geschwindigkeitswarnung',
  learn:'Einen Grenzwert berechnen und mit einer Variable vergleichen.',
  take:'Vergleicher können zwei Variablen vergleichen, nicht nur mit festen Zahlen. So hängt die Grenze vom Zustand der Anlage ab.',
  vars:{ W1_rechts:false, Tempo:0, V_zul:0, Warnung:false },
  tests:[[{ Tempo:70 }, { V_zul:80, Warnung:false }], [{ Tempo:70, W1_rechts:true }, { V_zul:40, Warnung:true }], [{ Tempo:40, W1_rechts:true }, { Warnung:false }], [{ Tempo:90 }, { Warnung:true }]],
  ref:'NETWORK Grundwert\n=> MOVE(80, V_zul);\n\nNETWORK Abzweig\nW1_rechts => MOVE(40, V_zul);\n\nNETWORK Zu schnell\n[Tempo > V_zul] => Warnung;', man:'werte', must:['MOVE','CMP'],
  hint:'Die Grenze wird zuerst bestimmt, dann verglichen.',
  bind:['trainSpeed=Tempo', 'displayValue=V_zul', 'displayLabel:"V zulässig"', 'switch1Right=W1_rechts', 'lightYellow=Warnung'] });

defFup({ id:'f9_boss', ch:9, title:'Boss: Die Geschwindigkeitsüberwachung', boss:true,
  story:'ARIA meldet dem Zug 120 km/h über die abzweigende Weiche. Frau Gasser: „Das Stellwerk rechnet ab jetzt selbst nach. Und wer zu schnell ist, wird gebremst.“',
  brief:'<b>NW 1:</b> ohne Bedingung → MOVE 80 in die zulässige Geschwindigkeit<br><b>NW 2:</b> Weiche 1 liegt rechts → MOVE 40 dorthin<br><b>NW 3:</b> Zuggeschwindigkeit &gt; zulässige Geschwindigkeit → Geschwindigkeitswarnung<br><b>NW 4:</b> ohne Bedingung → ADD zulässige Geschwindigkeit + 20 → Bremsgrenze<br><b>NW 5:</b> Zuggeschwindigkeit &gt; Bremsgrenze → S Zwangsbremsung<br><b>NW 6:</b> Zuggeschwindigkeit == 0 und Quittiertaste → R Zwangsbremsung',
  learn:'Vergleicher, MOVE, ADD und Speicher in einer Überwachung.',
  take:'Grenze bestimmen, warnen, eingreifen, freigeben: So arbeitet eine Zugbeeinflussung — und du hast sie in sechs Netzwerken gezeichnet.',
  vars:{ W1_rechts:false, Tempo:0, V_zul:0, Warnung:false, V_brems:0, Zwangsbremsung:false, Quittieren:false },
  timed: seq([[0,{ Tempo:70 },{ V_zul:80, Warnung:false, Zwangsbremsung:false }],[0.1,{ W1_rechts:true },{ V_zul:40, V_brems:60, Warnung:true, Zwangsbremsung:true }],[0.1,{ Tempo:30 },{ Warnung:false, Zwangsbremsung:true }],
    [0.1,{ Quittieren:true },{ Zwangsbremsung:true }],[0.1,{ Tempo:0 },{ Zwangsbremsung:false }],[0.1,{ Quittieren:false, Tempo:55 },{ Warnung:true, Zwangsbremsung:false }]]),
  ref:'NETWORK Grundwert\n=> MOVE(80, V_zul);\n\nNETWORK Abzweig\nW1_rechts => MOVE(40, V_zul);\n\nNETWORK Warnung\n[Tempo > V_zul] => Warnung;\n\nNETWORK Bremsgrenze\n=> ADD(V_zul, 20, V_brems);\n\nNETWORK Zwangsbremsung\n[Tempo > V_brems] => S Zwangsbremsung;\n\nNETWORK Freigabe\n[Tempo == 0] AND Quittieren => R Zwangsbremsung;',
  man:'werte', must:['MOVE','ADD','CMP','SET','RESET'],
  hint:'Sechs Netzwerke, in der Reihenfolge des Auftrags.',
  bind:['trainSpeed=Tempo', 'switch1Right=W1_rechts', 'lightYellow=Warnung', 'lightRed=Zwangsbremsung', 'displayValue=V_zul', 'displayLabel:"V zulässig"'] });
})();
