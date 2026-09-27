/* ===== AWL QUEST · KAPITEL 10 — Sprünge ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a10_spbn', ch:10, title:'Anzeige nur auf Wunsch',
  story:'Die Anzeige zeigt die Ofentemperatur nur, solange der Taster „Temperatur“ gedrückt ist. Sonst bleibt der letzte Wert stehen. Weil L und T nicht vom VKE abhängen, brauchst du einen <b>Sprung</b>.',
  brief:'<code>U S_Temp</code> · <code>SPBN ENDE</code> · <code>L Temp</code> · <code>T Anzeige</code> · <code>ENDE: NOP 0</code>',
  learn:'Bedingter Sprung SPBN, Sprungmarken.',
  take:'<code>SPBN ENDE</code> springt zur Marke <code>ENDE:</code>, wenn das VKE 0 ist — die Zeilen dazwischen werden übersprungen. Im Status bleiben sie dann leer.',
  vars:{ S_Temp:false, Temp:0, Anzeige:0 },
  timed: seq([[0.1, { Temp:1180 }, { Anzeige:0 }], [0.1, { S_Temp:true }, { Anzeige:1180 }], [0.1, { S_Temp:false, Temp:1200 }, { Anzeige:1180 }], [0.1, { S_Temp:true }, { Anzeige:1200 }]]),
  ref:'U  S_Temp\nSPBN ENDE\nL  Temp\nT  Anzeige\nENDE: NOP 0', man:'spruenge', must:['SPBN', 'LABEL'],
  hint:'Die Marke steht vor NOP 0: ENDE: NOP 0',
  bind:['furnaceTemp=Temp', 'displayValue=Anzeige', 'displayLabel:"OFEN °C"'] });

defAwl({ id:'a10_verzweigung', ch:10, title:'Temperatur oder Spalt',
  story:'Mit dem Wahlschalter <code>Wahl_Spalt</code> entscheidet der Walzmeister, was die Anzeige zeigt: den Walzspalt (1) oder die Temperatur (0).',
  brief:'<code>U Wahl_Spalt</code> · <code>SPB SPLT</code><br><code>L Temp</code> · <code>T Anzeige</code> · <code>SPA ENDE</code><br><code>SPLT: L Spalt</code> · <code>T Anzeige</code><br><code>ENDE: NOP 0</code>',
  learn:'Verzweigung mit SPB und SPA.',
  take:'Eine Verzweigung braucht zwei Sprünge: <code>SPB</code> in den einen Zweig, und am Ende des anderen Zweigs ein <code>SPA</code> über den ersten hinweg. Fehlt das SPA, laufen beide Zweige.',
  vars:{ Wahl_Spalt:false, Temp:0, Spalt:0, Anzeige:0 },
  tests:[[{ Temp:1180, Spalt:12 }, { Anzeige:1180 }], [{ Wahl_Spalt:true, Temp:1180, Spalt:12 }, { Anzeige:12 }]],
  ref:'U  Wahl_Spalt\nSPB SPLT\nL  Temp\nT  Anzeige\nSPA ENDE\nSPLT: L  Spalt\nT  Anzeige\nENDE: NOP 0', man:'spruenge', must:['SPB', 'SPA'],
  hint:'Wie im Brief — zwei Marken: SPLT und ENDE.',
  bind:['furnaceTemp=Temp', 'rollGap=Spalt', 'displayValue=Anzeige', 'displayLabel:"ANZEIGE"'] });

defAwl({ id:'a10_spa_dbg', ch:10, title:'Beide Zweige', debug:true,
  story:'Die Anzeige zeigt immer den Spalt, egal wie der Wahlschalter steht. ARIA hat eine einzige Zeile gelöscht.',
  brief:'Bei <code>Wahl_Spalt</code> = 0 soll die Temperatur stehen bleiben.',
  learn:'SPA am Ende eines Zweigs.',
  take:'Ohne <code>SPA</code> am Ende des ersten Zweigs „fällt“ das Programm in den zweiten Zweig hinein und überschreibt das Ergebnis. Im Status sind dann beide Zweige gefüllt.',
  vars:{ Wahl_Spalt:false, Temp:0, Spalt:0, Anzeige:0 },
  tests:[[{ Temp:1180, Spalt:12 }, { Anzeige:1180 }], [{ Wahl_Spalt:true, Temp:1180, Spalt:12 }, { Anzeige:12 }]],
  start:'U  Wahl_Spalt\nSPB SPLT\nL  Temp\nT  Anzeige\nSPLT: L  Spalt\nT  Anzeige\nENDE: NOP 0', ref:'U  Wahl_Spalt\nSPB SPLT\nL  Temp\nT  Anzeige\nSPA ENDE\nSPLT: L  Spalt\nT  Anzeige\nENDE: NOP 0', man:'spruenge', must:['SPA'],
  hint:'Nach T Anzeige im ersten Zweig: SPA ENDE',
  bind:['furnaceTemp=Temp', 'rollGap=Spalt', 'displayValue=Anzeige', 'displayLabel:"ANZEIGE"'] });

defAwl({ id:'a10_zaehlen', ch:10, title:'Selbst zählen',
  story:'Der Tageszähler soll bis 30 000 zählen können — mehr als ein S5-Zähler (999) schafft. Also zählst du selbst: Bei jeder steigenden Flanke der Lichtschranke wird die Variable um 1 erhöht.',
  brief:'<code>U Block_raus</code> · <code>FP M_Block</code> · <code>SPBN ENDE</code><br><code>L Stueck</code> · <code>INC 1</code> · <code>T Stueck</code><br><code>ENDE: NOP 0</code>',
  learn:'Rechnen nur bei Flanke — mit Sprung.',
  take:'Ohne Sprung würde <code>INC</code> in <b>jedem</b> Zyklus zählen. Die Flanke plus <code>SPBN</code> sorgt dafür, dass nur bei einem neuen Block gerechnet wird.',
  vars:{ Block_raus:false, M_Block:false, Stueck:0 },
  timed: seq([[0.1, { Block_raus:true }, { Stueck:1 }], [0.1, {}, { Stueck:1 }], [0.1, { Block_raus:false }, { Stueck:1 }], [0.1, { Block_raus:true, Stueck:998 }, { Stueck:999 }], [0.1, { Block_raus:false }, {}], [0.1, { Block_raus:true }, { Stueck:1000 }]]),
  ref:'U  Block_raus\nFP M_Block\nSPBN ENDE\nL  Stueck\nINC 1\nT  Stueck\nENDE: NOP 0', man:'spruenge', must:['FP', 'SPBN', 'INC'],
  hint:'FP liefert die Flanke, SPBN überspringt das Zählen ohne Flanke.',
  bind:['billetVisible=Block_raus', 'pieceCount=Stueck'] });

defAwl({ id:'a10_bea', ch:10, title:'Not-Aus beendet alles',
  story:'Bei Not-Aus muss die Steuerung alle Antriebe abschalten und darf danach <b>nichts</b> mehr einschalten. Herr Brunner: „Früher schrieb man das ganz oben hin — und dann BEA.“',
  brief:'<code>U Not_Aus_OK</code> · <code>SPB LAUF</code><br><code>CLR</code> · <code>= Rollgang</code> · <code>= Walzen</code> · <code>BEA</code><br><code>LAUF: U S_Rollgang</code> · <code>= Rollgang</code> · <code>U S_Walzen</code> · <code>= Walzen</code>',
  learn:'Baustein-Ende BEA.',
  take:'<code>BEA</code> beendet den Baustein sofort — nichts danach wird ausgeführt. Mit einem Sprung davor entsteht ein „Notprogramm“, das nur im Fehlerfall läuft.',
  vars:{ Not_Aus_OK:true, S_Rollgang:false, S_Walzen:false, Rollgang:false, Walzen:false },
  tests:[[{ S_Rollgang:true, S_Walzen:true }, { Rollgang:true, Walzen:true }], [{ Not_Aus_OK:false, S_Rollgang:true, S_Walzen:true, Rollgang:true, Walzen:true }, { Rollgang:false, Walzen:false }]],
  ref:'U  Not_Aus_OK\nSPB LAUF\nCLR\n=  Rollgang\n=  Walzen\nBEA\nLAUF: U  S_Rollgang\n=  Rollgang\nU  S_Walzen\n=  Walzen', man:'spruenge', must:['SPB', 'BEA', 'CLR'],
  hint:'Das Notprogramm steht zwischen SPB und BEA.',
  bind:['conveyorRunning=Rollgang', 'rollsRunning=Walzen'] });

defAwl({ id:'a10_loop', ch:10, title:'Die Schleife',
  story:'Das Kühlbett hat 8 Plätze, jeder mit 12 Stäben. Herr Brunner will sehen, wie <code>LOOP</code> funktioniert: Die Steuerung soll die Gesamtzahl in einer Schleife aufsummieren — 8-mal 12 addieren.',
  brief:'<code>L 0</code> · <code>T Summe</code> · <code>L 8</code><br><code>NEXT: T Zaehler</code> · <code>L Summe</code> · <code>L Pro_Platz</code> · <code>+I</code> · <code>T Summe</code> · <code>L Zaehler</code> · <code>LOOP NEXT</code>',
  learn:'Schleifen mit LOOP.',
  take:'<code>LOOP</code> zieht 1 von AKKU1 ab und springt zurück, solange das Ergebnis nicht 0 ist. Den Schleifenzähler rettest du am Anfang jeder Runde in eine Variable, weil der Akku für die Rechnung gebraucht wird.',
  vars:{ Pro_Platz:0, Zaehler:0, Summe:0 },
  tests:[[{ Pro_Platz:12 }, { Summe:96 }], [{ Pro_Platz:5 }, { Summe:40 }]],
  ref:'L  0\nT  Summe\nL  8\nNEXT: T  Zaehler\nL  Summe\nL  Pro_Platz\n+I\nT  Summe\nL  Zaehler\nLOOP NEXT', man:'spruenge', must:['LOOP', 'LABEL'],
  hint:'Die Marke NEXT: steht vor T Zaehler.',
  bind:['pieceCount=Summe'] });

defAwl({ id:'a10_betriebsart', ch:10, title:'Drei Betriebsarten',
  story:'Der Wahlschalter am Pult hat drei Stellungen: 1 = Hand, 2 = Halbautomatik, 3 = Automatik. Je nach Stellung zeigt eine andere Lampe — und bei einem ungültigen Wert leuchtet Rot.',
  brief:'Nacheinander vergleichen und springen:<br><code>L Betriebsart</code> · <code>L 1</code> · <code>==I</code> · <code>SPB HAND</code> · … <code>L 2</code> … <code>SPB HALB</code> · … <code>L 3</code> … <code>SPB AUTO</code><br>Sonst: <code>SET</code> · <code>= Lampe_Rot</code> · <code>SPA ENDE</code><br>Jede Marke setzt ihre Lampe (<code>Lampe_Hand</code>, <code>Lampe_Halb</code>, <code>Lampe_Auto</code>) und springt nach <code>ENDE</code>.<br>Ganz am Anfang alle vier Lampen mit <code>CLR</code> löschen.',
  learn:'Sprungverteiler mit Vergleichen.',
  take:'Mehrere Vergleiche mit je einem <code>SPB</code> ergeben einen <b>Sprungverteiler</b> — in SCL wäre das eine CASE-Anweisung.',
  vars:{ Betriebsart:0, Lampe_Hand:false, Lampe_Halb:false, Lampe_Auto:false, Lampe_Rot:false },
  tests:[[{ Betriebsart:1 }, { Lampe_Hand:true, Lampe_Halb:false, Lampe_Auto:false, Lampe_Rot:false }], [{ Betriebsart:2 }, { Lampe_Hand:false, Lampe_Halb:true, Lampe_Rot:false }], [{ Betriebsart:3 }, { Lampe_Auto:true, Lampe_Rot:false }], [{ Betriebsart:7, Lampe_Hand:true }, { Lampe_Rot:true, Lampe_Hand:false }]],
  ref:'CLR\n=  Lampe_Hand\n=  Lampe_Halb\n=  Lampe_Auto\n=  Lampe_Rot\nL  Betriebsart\nL  1\n==I\nSPB HAND\nL  Betriebsart\nL  2\n==I\nSPB HALB\nL  Betriebsart\nL  3\n==I\nSPB AUTO\nSET\n=  Lampe_Rot\nSPA ENDE\nHAND: SET\n=  Lampe_Hand\nSPA ENDE\nHALB: SET\n=  Lampe_Halb\nSPA ENDE\nAUTO: SET\n=  Lampe_Auto\nENDE: NOP 0', man:'spruenge', must:['SPB', 'SPA', 'CMP_I'],
  hint:'Nach dem Sprung ist das VKE 1 — SET vor = macht es trotzdem deutlich.',
  bind:['lightGreen=Lampe_Auto', 'lightYellow=Lampe_Halb', 'lightRed=Lampe_Rot', 'displayValue=Betriebsart', 'displayLabel:"BETRIEBSART"'] });

defAwl({ id:'a10_spb_dbg', ch:10, title:'Verkehrt gesprungen', debug:true,
  story:'Die Temperaturanzeige aktualisiert sich nur, wenn der Taster <b>nicht</b> gedrückt ist. ARIA hat den Sprungbefehl ausgetauscht.',
  brief:'Die Anzeige soll nur bei gedrücktem <code>S_Temp</code> aktualisiert werden.',
  learn:'SPB und SPBN unterscheiden.',
  take:'<code>SPB</code> springt bei VKE 1, <code>SPBN</code> bei VKE 0. Wer den Abschnitt nur bei gedrücktem Taster ausführen will, springt bei 0 darüber hinweg.',
  vars:{ S_Temp:false, Temp:0, Anzeige:0 },
  tests:[[{ S_Temp:true, Temp:1180 }, { Anzeige:1180 }], [{ S_Temp:false, Temp:1180 }, { Anzeige:0 }]],
  start:'U  S_Temp\nSPB ENDE\nL  Temp\nT  Anzeige\nENDE: NOP 0', ref:'U  S_Temp\nSPBN ENDE\nL  Temp\nT  Anzeige\nENDE: NOP 0', man:'spruenge', must:['SPBN'],
  hint:'SPB → SPBN.',
  bind:['furnaceTemp=Temp', 'displayValue=Anzeige', 'displayLabel:"OFEN °C"'] });

defAwl({ id:'a10_beb', ch:10, title:'Wartung',
  story:'Im Wartungsbetrieb darf das Programm nur die Lampen setzen und muss danach aufhören — der Rest der Steuerung bleibt stehen. Dafür gibt es das bedingte Baustein-Ende <code>BEB</code>.',
  brief:'<code>U Wartung</code> · <code>= Lampe_Gelb</code><br><code>U Wartung</code> · <code>BEB</code><br><code>U S_Rollgang</code> · <code>= Rollgang</code>',
  learn:'Bedingtes Baustein-Ende BEB.',
  take:'<code>BEB</code> beendet den Baustein, wenn das VKE 1 ist. Alles darunter läuft nur im Normalbetrieb. Achtung: Ausgänge, die danach stehen, behalten im Wartungsbetrieb ihren letzten Wert.',
  vars:{ Wartung:false, S_Rollgang:false, Rollgang:false, Lampe_Gelb:false },
  timed: seq([[0.1, { S_Rollgang:true }, { Rollgang:true, Lampe_Gelb:false }], [0.1, { S_Rollgang:false }, { Rollgang:false }], [0.1, { Wartung:true, S_Rollgang:true }, { Rollgang:false, Lampe_Gelb:true }], [0.1, { Wartung:false }, { Rollgang:true, Lampe_Gelb:false }]]),
  ref:'U  Wartung\n=  Lampe_Gelb\nU  Wartung\nBEB\nU  S_Rollgang\n=  Rollgang', man:'spruenge', must:['BEB'],
  hint:'U Wartung · BEB',
  bind:['conveyorRunning=Rollgang', 'lightYellow=Lampe_Gelb'] });

defAwl({ id:'a10_final', ch:10, title:'Final Boss: Das Walzprogramm', boss:true, final:true,
  story:'ARIA hat sich im Hauptprogramm der S7-300 verschanzt. Herr Brunner legt dir den letzten Plan hin: „Not-Aus zuerst. Dann Hydraulik mit Anlaufzeit. Das Gerüst nur mit Druck und heissem Block. Jeder gewalzte Block zählt. Und die Anzeige zeigt, was der Walzmeister wählt.“',
  brief:'<b>Not-Aus:</b> <code>U Not_Aus_OK</code> · <code>SPB LAUF</code> · <code>CLR</code> · <code>= Pumpe</code> · <code>= Walzen</code> · <code>= Rollgang</code> · <code>BEA</code><br>' +
    '<b>LAUF:</b> Pumpe mit Selbsthaltung: <code>U(</code> <code>O S_Start</code> <code>O Pumpe</code> <code>)</code> · <code>UN S_Stopp</code> · <code>= Pumpe</code><br>' +
    '<b>Druck:</b> <code>U Pumpe</code> · <code>L S5T#2S</code> · <code>SE T1</code><br>' +
    '<b>Gerüst:</b> <code>U T1</code> · <code>U(</code> <code>L Temp</code> <code>L 1100</code> <code>&gt;=I</code> <code>)</code> → <code>= Walzen</code><br>' +
    '<b>Rollgang:</b> <code>U Walzen</code> · <code>U Block_da</code> → <code>= Rollgang</code><br>' +
    '<b>Zählen:</b> <code>U Block_raus</code> · <code>FP M_Block</code> · <code>SPBN ANZ</code> · <code>L Stueck</code> · <code>INC 1</code> · <code>T Stueck</code><br>' +
    '<b>ANZ:</b> <code>U Wahl_Stueck</code> · <code>SPB STK</code> · <code>L Temp</code> · <code>T Anzeige</code> · <code>SPA ENDE</code> · <code>STK: L Stueck</code> · <code>T Anzeige</code> · <code>ENDE: NOP 0</code>',
  learn:'Bitlogik, Zeiten, Vergleiche, Rechnen und Sprünge in einem Programm.',
  take:'Du hast ein komplettes AWL-Programm geschrieben, wie es in tausenden alten S7-300 läuft: Not-Aus mit BEA, Selbsthaltung, S5-Zeit, Vergleich in Klammern, Zählen mit Flanke und Sprung, Anzeige mit Verzweigung. ARIA hat keine Zeile mehr, in der sie sich verstecken kann.',
  vars:{ Not_Aus_OK:true, S_Start:false, S_Stopp:false, Temp:1000, Block_da:false, Block_raus:false, Wahl_Stueck:false, M_Block:false, Pumpe:false, Walzen:false, Rollgang:false, Stueck:0, Anzeige:0 },
  timed: seq([
    [0, { S_Start:true, Temp:1180 }, { Pumpe:true, Walzen:false, Anzeige:1180 }],
    [0.1, { S_Start:false }, { Pumpe:true, Walzen:false }],
    [2, {}, { Walzen:true, Rollgang:false }],
    [0.1, { Block_da:true }, { Rollgang:true }],
    [0.1, { Block_raus:true }, { Stueck:1 }],
    [0.1, { Block_raus:false, Wahl_Stueck:true }, { Anzeige:1 }],
    [0.1, { Temp:1050 }, { Walzen:false, Rollgang:false }],
    [0.1, { Temp:1180, Block_raus:true }, { Walzen:true, Stueck:2, Anzeige:2 }],
    [0.1, { Not_Aus_OK:false }, { Pumpe:false, Walzen:false, Rollgang:false, Anzeige:2 }],
    [0.1, { Not_Aus_OK:true, Block_raus:false }, { Pumpe:false }],
    [0.1, { S_Stopp:true, S_Start:true }, { Pumpe:false }]
  ]),
  ref:'NETWORK Not-Aus\nU  Not_Aus_OK\nSPB LAUF\nCLR\n=  Pumpe\n=  Walzen\n=  Rollgang\nBEA\n\nNETWORK Hydraulik\nLAUF: U(\nO  S_Start\nO  Pumpe\n)\nUN S_Stopp\n=  Pumpe\nU  Pumpe\nL  S5T#2S\nSE T1\n\nNETWORK Geruest\nU  T1\nU(\nL  Temp\nL  1100\n>=I\n)\n=  Walzen\n\nNETWORK Rollgang\nU  Walzen\nU  Block_da\n=  Rollgang\n\nNETWORK Zaehlen\nU  Block_raus\nFP M_Block\nSPBN ANZ\nL  Stueck\nINC 1\nT  Stueck\n\nNETWORK Anzeige\nANZ: U  Wahl_Stueck\nSPB STK\nL  Temp\nT  Anzeige\nSPA ENDE\nSTK: L  Stueck\nT  Anzeige\nENDE: NOP 0', man:'spruenge', must:['BEA', 'SPB', 'SPBN', 'SPA', 'SE', 'FP', 'CMP_I', 'INC'],
  hint:'Arbeite Netzwerk für Netzwerk. Die Marken LAUF, ANZ, STK und ENDE stehen vor der ersten Anweisung ihres Abschnitts.',
  hint2:'Achte auf die Reihenfolge: Not-Aus ganz oben mit BEA, das Zählen vor der Anzeige.',
  bind:['pumpRunning=Pumpe', 'rollsRunning=Walzen', 'conveyorRunning=Rollgang', 'furnaceTemp=Temp', 'billetVisible=Block_da', 'pieceCount=Stueck', 'displayValue=Anzeige', 'displayLabel:"ANZEIGE"'] });
})();
