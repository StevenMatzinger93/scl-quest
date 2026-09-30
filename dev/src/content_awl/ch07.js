/* ===== AWL QUEST · KAPITEL 7 — Laden und Transferieren ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a7_lt', ch:7, title:'Die Temperaturanzeige',
  story:'Die grosse Anzeige am Leitstand bleibt dunkel, obwohl der Temperaturfühler im Ofen einen Wert liefert. Er muss nur zur Anzeige gebracht werden.',
  brief:'<code>L Temp</code> · <code>T Anzeige</code>',
  learn:'Laden und Transferieren.',
  take:'<code>L</code> lädt einen Wert in <b>AKKU1</b>, <code>T</code> schreibt AKKU1 in einen Operanden. So wandern Zahlen durch das Programm.',
  vars:{ Temp:0, Anzeige:0 },
  tests:[[{ Temp:1180 }, { Anzeige:1180 }], [{ Temp:950 }, { Anzeige:950 }]],
  ref:'L  Temp\nT  Anzeige', man:'laden', must:['L', 'T'],
  hint:'L Temp · T Anzeige',
  bind:['furnaceTemp=Temp', 'displayValue=Anzeige', 'displayLabel:"OFEN °C"'] });

defAwl({ id:'a7_konst', ch:7, title:'Sollwerte vorgeben',
  story:'Die Solltemperatur des Ofens ist 1250 °C, der Walzspalt soll 12 mm betragen. Beide Werte schreibst du fest in die Sollwert-Variablen.',
  brief:'<code>L 1250</code> · <code>T Temp_Soll</code><br><code>L 12</code> · <code>T Spalt_Soll</code>',
  learn:'Konstanten laden.',
  take:'<code>L</code> lädt auch feste Zahlen (Konstanten). Das ist der Weg, einer Variable in AWL einen Wert zuzuweisen.',
  vars:{ Temp_Soll:0, Spalt_Soll:0 },
  tests:[[{}, { Temp_Soll:1250, Spalt_Soll:12 }]],
  ref:'L  1250\nT  Temp_Soll\nL  12\nT  Spalt_Soll', man:'laden', must:['L', 'T'],
  hint:'Zweimal L und T.',
  bind:['furnaceTemp=Temp_Soll', 'rollGap=Spalt_Soll'] });

defAwl({ id:'a7_richtung_dbg', ch:7, title:'Verkehrt herum', debug:true,
  story:'Seit ARIA im Programm war, zeigt die Anzeige immer 0 — und der Messwert des Walzspalts ist plötzlich auch 0! Jemand hat Laden und Transferieren vertauscht.',
  brief:'Der Messwert <code>Spalt</code> soll auf die <code>Anzeige</code> — nicht umgekehrt.',
  learn:'Richtung von L und T.',
  take:'Zuerst <b>L</b>aden (Quelle), dann <b>T</b>ransferieren (Ziel). Vertauscht überschreibt man den Messwert mit dem alten Inhalt der Anzeige.',
  vars:{ Spalt:0, Anzeige:0 },
  tests:[[{ Spalt:14 }, { Anzeige:14, Spalt:14 }], [{ Spalt:9, Anzeige:3 }, { Anzeige:9, Spalt:9 }]],
  start:'L  Anzeige\nT  Spalt', ref:'L  Spalt\nT  Anzeige', man:'laden', must:['L', 'T'],
  hint:'Die Quelle kommt in die L-Zeile.',
  bind:['rollGap=Spalt', 'displayValue=Anzeige', 'displayLabel:"SPALT mm"'] });

defAwl({ id:'a7_mehrfach', ch:7, title:'Alles auf null',
  story:'Nach dem Walzen eines Blocks werden Walzkraft, Länge und Stichzahl gelöscht. Herr Brunner: „Ein L genügt, denn T verändert AKKU1 nicht.“',
  brief:'<code>L 0</code> · <code>T Walzkraft</code> · <code>T Laenge</code> · <code>T Stiche</code>',
  learn:'T lässt AKKU1 unverändert.',
  take:'<code>T</code> liest AKKU1, verändert ihn aber nicht. Ein geladener Wert kann darum in beliebig viele Operanden geschrieben werden.',
  vars:{ Walzkraft:0, Laenge:0, Stiche:0 },
  tests:[[{ Walzkraft:830, Laenge:42, Stiche:5 }, { Walzkraft:0, Laenge:0, Stiche:0 }]],
  ref:'L  0\nT  Walzkraft\nT  Laenge\nT  Stiche', man:'laden', must:['L', 'T'],
  hint:'Einmal laden, dreimal transferieren.',
  bind:['displayValue=Walzkraft', 'displayLabel:"WALZKRAFT"'] });

defAwl({ id:'a7_akku', ch:7, title:'Was steht in AKKU1?',
  story:'Herr Brunner prüft dich wie in seiner Lehrzeit: „Du lädst die Dicke vor dem Walzen, dann die danach, was transferiert T jetzt?“ Probier es aus, die Anzeige soll die Dicke <b>danach</b> zeigen.',
  brief:'<code>L Dicke_ein</code> · <code>L Dicke_aus</code> · <code>T Anzeige</code>',
  learn:'Zwei Ladebefehle: AKKU1 und AKKU2.',
  take:'Jedes <code>L</code> schiebt den alten Inhalt von AKKU1 nach AKKU2. Nach zwei Ladebefehlen steht der <b>zweite</b> Wert in AKKU1 — und der erste wartet in AKKU2 auf eine Rechnung.',
  vars:{ Dicke_ein:0, Dicke_aus:0, Anzeige:0 },
  tests:[[{ Dicke_ein:120, Dicke_aus:90 }, { Anzeige:90 }]],
  ref:'L  Dicke_ein\nL  Dicke_aus\nT  Anzeige', man:'laden', must:['L'],
  hint:'Einfach die drei Zeilen — und im Status AKKU1 und AKKU2 ansehen.',
  bind:['rollGap=Dicke_aus', 'displayValue=Anzeige', 'displayLabel:"DICKE mm"'] });

defAwl({ id:'a7_tak', ch:7, title:'Vertauschte Sensoren',
  story:'Die Temperaturfühler an Ofeneingang und -ausgang wurden beim letzten Umbau über Kreuz angeschlossen: <code>Fuehler_1</code> misst in Wahrheit den Ausgang, <code>Fuehler_2</code> den Eingang. Bis der Elektriker kommt, ordnest du sie im Programm richtig zu.',
  brief:'<code>Temp_Ein</code> := <code>Fuehler_2</code>, <code>Temp_Aus</code> := <code>Fuehler_1</code> — mit nur zwei Ladebefehlen:<br><code>L Fuehler_1</code> · <code>L Fuehler_2</code> · <code>T Temp_Ein</code> · <code>TAK</code> · <code>T Temp_Aus</code>',
  learn:'TAK tauscht AKKU1 und AKKU2.',
  take:'Nach zwei <code>L</code> steht der zweite Wert in AKKU1, der erste in AKKU2. <code>TAK</code> vertauscht die beiden — so kommst du an den ersten Wert, ohne ihn noch einmal zu laden.',
  vars:{ Fuehler_1:0, Fuehler_2:0, Temp_Ein:0, Temp_Aus:0 },
  tests:[[{ Fuehler_1:1210, Fuehler_2:980 }, { Temp_Ein:980, Temp_Aus:1210 }], [{ Fuehler_1:1150, Fuehler_2:1020 }, { Temp_Ein:1020, Temp_Aus:1150 }]],
  ref:'L  Fuehler_1\nL  Fuehler_2\nT  Temp_Ein\nTAK\nT  Temp_Aus', man:'laden', must:['TAK'],
  hint:'Nach T Temp_Ein steht Fuehler_1 noch in AKKU2 — TAK holt ihn nach vorn.',
  bind:['furnaceTemp=Temp_Aus', 'displayValue=Temp_Ein', 'displayLabel:"EINGANG °C"'] });

defAwl({ id:'a7_zeitwert', ch:7, title:'Der Zeitwert',
  story:'Die Nachlaufzeit der Kühlung soll im Leitstand sichtbar sein. Dafür schreibst du die Zeit in eine Variable vom Typ TIME.',
  brief:'<code>L S5T#8S</code> · <code>T Nachlauf</code><br>(<code>Nachlauf</code> ist vom Typ TIME.)',
  learn:'Zeitwerte laden und transferieren.',
  take:'Auch Zeitwerte gehen durch den Akku. <code>S5T#8S</code> ist eine S5-Zeitkonstante; in der S7-300 steht sie im S5TIME-Format im Akku.',
  vars:{ Nachlauf:0 }, types:{ Nachlauf:'TIME' },
  tests:[[{}, { Nachlauf:8 }]],
  ref:'L  S5T#8S\nT  Nachlauf', man:'laden', must:['L', 'T', 'S5T'],
  hint:'L S5T#8S · T Nachlauf',
  bind:['coolingOn:true', 'displayValue=Nachlauf', 'displayLabel:"NACHLAUF s"'] });

defAwl({ id:'a7_zaehlwert', ch:7, title:'Zählwert und Anzeige',
  story:'Der Blockzähler Z1 zählt fleissig, aber die Anzeige zeigt nichts. Ausserdem soll der Tageszähler <code>Tag</code> denselben Wert bekommen.',
  brief:'<code>U Block_raus</code> · <code>ZV Z1</code><br><code>L Z1</code> · <code>T Anzeige</code> · <code>T Tag</code>',
  learn:'Zählwerte weitergeben.',
  take:'<code>L Z1</code> holt den Zählwert als Zahl in AKKU1. Danach ist er ein ganz normaler Wert, den du beliebig oft transferieren kannst.',
  vars:{ Block_raus:false, Anzeige:0, Tag:0 },
  timed: seq([[0.1, { Block_raus:true }, { Anzeige:1, Tag:1 }], [0.1, { Block_raus:false }, { Anzeige:1 }], [0.1, { Block_raus:true }, { Anzeige:2, Tag:2 }]]),
  ref:'U  Block_raus\nZV Z1\nL  Z1\nT  Anzeige\nT  Tag', man:'laden', must:['COUNTER_LOAD', 'T'],
  hint:'Nach L Z1 zweimal transferieren.',
  bind:['billetVisible=Block_raus', 'pieceCount=Tag', 'displayValue=Anzeige', 'displayLabel:"STÜCK"'] });

defAwl({ id:'a7_vke_dbg', ch:7, title:'Die Anzeige, die nie wechselt', debug:true,
  story:'Die Anzeige soll die Ofentemperatur zeigen und nur bei gedrücktem Taster „Spalt“ den Walzspalt. ARIA behauptet, ein U davor reiche, doch die Anzeige zeigt immer den Spalt.',
  brief:'<code>L</code> und <code>T</code> hängen <b>nicht</b> vom VKE ab. Schreibe die Anzeige so, dass zuerst die Temperatur und dann — nur mit Taster — der Spalt kommt.<br>Lösung ohne Sprung: Temperatur transferieren, dann <code>U S_Spalt</code> · <code>SPBN ENDE</code> · <code>L Spalt</code> · <code>T Anzeige</code> · <code>ENDE: NOP 0</code>.',
  learn:'L und T sind unabhängig vom VKE.',
  take:'Ein <code>U</code> vor einem <code>L</code> bewirkt nichts — Laden und Transferieren laufen immer. Bedingt ausführen kann man nur mit einem <b>Sprung</b> (Kapitel 10).',
  vars:{ Temp:0, Spalt:0, S_Spalt:false, Anzeige:0 },
  tests:[[{ Temp:1180, Spalt:12 }, { Anzeige:1180 }], [{ Temp:1180, Spalt:12, S_Spalt:true }, { Anzeige:12 }]],
  start:'L  Temp\nT  Anzeige\nU  S_Spalt\nL  Spalt\nT  Anzeige', ref:'L  Temp\nT  Anzeige\nU  S_Spalt\nSPBN ENDE\nL  Spalt\nT  Anzeige\nENDE: NOP 0', man:'laden', must:['SPBN', 'LABEL'],
  hint:'Nach U S_Spalt: SPBN ENDE — und am Ende die Marke ENDE: NOP 0.',
  bind:['furnaceTemp=Temp', 'rollGap=Spalt', 'displayValue=Anzeige', 'displayLabel:"ANZEIGE"'] });

defAwl({ id:'a7_boss', ch:7, title:'Boss: Das Anzeigepanel', boss:true,
  story:'ARIA hat alle Anzeigen am Leitstand verstellt. Herr Brunner diktiert: „Ofentemperatur auf die Anzeige, Sollwert 1250, Stückzähler vom Z1, und Spalt und Kraft sind über Kreuz angeschlossen.“',
  brief:'<code>L Temp</code> → <code>T Anzeige</code><br><code>L 1250</code> → <code>T Temp_Soll</code><br><code>U Block_raus</code> · <code>ZV Z1</code> · <code>L Z1</code> → <code>T Stueck</code><br><code>Spalt</code> := <code>Mess_B</code>, <code>Kraft</code> := <code>Mess_A</code> (zwei L, dann T, <code>TAK</code>, T)',
  learn:'Laden, Transferieren, Zählwerte und TAK kombiniert.',
  take:'Alle Zahlen laufen durch die Akkus. Wer weiss, was in AKKU1 und AKKU2 steht, kann jede AWL-Zeile vorhersagen.',
  vars:{ Temp:0, Anzeige:0, Temp_Soll:0, Block_raus:false, Stueck:0, Mess_A:0, Mess_B:0, Spalt:0, Kraft:0 },
  timed: seq([[0.1, { Temp:1190, Block_raus:true, Mess_A:640, Mess_B:14 }, { Anzeige:1190, Temp_Soll:1250, Stueck:1, Spalt:14, Kraft:640 }], [0.1, { Block_raus:false, Mess_A:655, Mess_B:13 }, { Stueck:1, Spalt:13, Kraft:655 }]]),
  ref:'NETWORK Anzeige\nL  Temp\nT  Anzeige\n\nNETWORK Sollwert\nL  1250\nT  Temp_Soll\n\nNETWORK Stueckzahl\nU  Block_raus\nZV Z1\nL  Z1\nT  Stueck\n\nNETWORK Messwerte\nL  Mess_A\nL  Mess_B\nT  Spalt\nTAK\nT  Kraft', man:'laden', must:['L', 'T', 'TAK', 'COUNTER_LOAD'],
  hint:'Vier Netzwerke. Die Messwerte ordnest du wie die Temperaturfühler zu.',
  bind:['furnaceTemp=Temp', 'displayValue=Anzeige', 'displayLabel:"OFEN °C"', 'pieceCount=Stueck', 'rollGap=Spalt', 'billetVisible=Block_raus'] });
})();
