/* ===== AWL QUEST · KAPITEL 6 — Zähler ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a6_zv', ch:6, title:'Blöcke zählen',
  story:'Der Schichtleiter will wissen, wie viele Blöcke heute gewalzt wurden. Hinter der Schere sitzt eine Lichtschranke. Jeder Block, der sie auslöst, zählt.',
  brief:'<code>U Block_raus</code> · <code>ZV Z1</code><br><code>L Z1</code> · <code>T Stueck</code>',
  learn:'Vorwärtszähler ZV.',
  take:'<code>ZV Z1</code> zählt bei jeder <b>steigenden Flanke</b> des VKE um 1 hoch — die Flanke steckt schon im Zähler. <code>L Z1</code> lädt den Zählwert in AKKU1.',
  vars:{ Block_raus:false, Stueck:0 },
  timed: seq([[0.1, { Block_raus:true }, { Stueck:1 }], [0.1, {}, { Stueck:1 }], [0.1, { Block_raus:false }, { Stueck:1 }], [0.1, { Block_raus:true }, { Stueck:2 }], [0.1, { Block_raus:false }, { Stueck:2 }], [0.1, { Block_raus:true }, { Stueck:3 }]]),
  ref:'U  Block_raus\nZV Z1\nL  Z1\nT  Stueck', man:'zaehler', must:['ZV', 'COUNTER_LOAD'],
  hint:'U Block_raus · ZV Z1 · L Z1 · T Stueck',
  bind:['billetVisible=Block_raus', 'pieceCount=Stueck'] });

defAwl({ id:'a6_reset', ch:6, title:'Neue Schicht, neuer Zähler',
  story:'Zu Schichtbeginn drückt der Schichtleiter „Zähler löschen“. Dann beginnt die Zählung wieder bei 0.',
  brief:'Wie vorher zählen, zusätzlich: <code>U S_Reset</code> · <code>R Z1</code>. Danach <code>L Z1</code> · <code>T Stueck</code>.',
  learn:'Zähler rücksetzen (R Z).',
  take:'<code>R Z1</code> setzt den Zähler auf 0, solange das VKE 1 ist. Steht es vor <code>L Z1</code>, sieht die Anzeige den gelöschten Wert noch im selben Zyklus.',
  vars:{ Block_raus:false, S_Reset:false, Stueck:0 },
  timed: seq([[0.1, { Block_raus:true }, { Stueck:1 }], [0.1, { Block_raus:false }, { Stueck:1 }], [0.1, { Block_raus:true }, { Stueck:2 }], [0.1, { Block_raus:false, S_Reset:true }, { Stueck:0 }], [0.1, { S_Reset:false, Block_raus:true }, { Stueck:1 }]]),
  ref:'U  Block_raus\nZV Z1\nU  S_Reset\nR  Z1\nL  Z1\nT  Stueck', man:'zaehler', must:['ZV', 'ZRESET'],
  hint:'Zwischen ZV Z1 und L Z1: U S_Reset · R Z1',
  bind:['billetVisible=Block_raus', 'pieceCount=Stueck'] });

defAwl({ id:'a6_zr', ch:6, title:'Die Charge läuft ab',
  story:'Eine Charge hat 10 Blöcke. Zu Beginn lädt der Schichtleiter die Charge, dann zählt jeder Block rückwärts. So sieht man sofort, wie viele noch kommen.',
  brief:'<code>U S_Laden</code> · <code>L 10</code> · <code>S Z2</code><br><code>U Block_raus</code> · <code>ZR Z2</code><br><code>L Z2</code> · <code>T Rest</code>',
  learn:'Zähler setzen (S Z) und rückwärts zählen (ZR).',
  take:'<code>S Z2</code> setzt den Zähler bei steigender Flanke des VKE auf den Wert aus AKKU1 — deshalb steht <code>L 10</code> direkt davor. <code>ZR</code> zählt herunter, aber nie unter 0.',
  vars:{ S_Laden:false, Block_raus:false, Rest:0 },
  timed: seq([[0.1, { S_Laden:true }, { Rest:10 }], [0.1, { S_Laden:false }, { Rest:10 }], [0.1, { Block_raus:true }, { Rest:9 }], [0.1, { Block_raus:false }, { Rest:9 }], [0.1, { Block_raus:true }, { Rest:8 }]]),
  ref:'U  S_Laden\nL  10\nS  Z2\nU  Block_raus\nZR Z2\nL  Z2\nT  Rest', man:'zaehler', must:['ZS', 'ZR'],
  hint:'Zuerst setzen (L 10 · S Z2), dann rückwärts zählen, dann laden und transferieren.',
  bind:['billetVisible=Block_raus', 'displayValue=Rest', 'displayLabel:"REST"'] });

defAwl({ id:'a6_uz', ch:6, title:'Charge fertig?',
  story:'Die gelbe Lampe zeigt „Charge läuft“, solange der Rückwärtszähler nicht bei 0 ist. Die grüne Lampe meldet „Charge fertig“.',
  brief:'Zähler wie vorher (Laden mit 3, Rückwärtszählen).<br><code>U Z2</code> → <code>= Lampe_Gelb</code> · <code>UN Z2</code> → <code>= Lampe_Gruen</code>',
  learn:'Zähler abfragen (U Z).',
  take:'<code>U Z2</code> ist 1, solange der Zählwert nicht 0 ist. So wird ein Zähler zum Bit — ideal für „noch etwas da?“.',
  vars:{ S_Laden:false, Block_raus:false, Lampe_Gelb:false, Lampe_Gruen:false },
  timed: seq([[0.1, {}, { Lampe_Gruen:true, Lampe_Gelb:false }], [0.1, { S_Laden:true }, { Lampe_Gelb:true, Lampe_Gruen:false }], [0.1, { S_Laden:false, Block_raus:true }, { Lampe_Gelb:true }], [0.1, { Block_raus:false }, {}], [0.1, { Block_raus:true }, { Lampe_Gelb:true }], [0.1, { Block_raus:false }, {}], [0.1, { Block_raus:true }, { Lampe_Gelb:false, Lampe_Gruen:true }]]),
  ref:'U  S_Laden\nL  3\nS  Z2\nU  Block_raus\nZR Z2\nU  Z2\n=  Lampe_Gelb\nUN Z2\n=  Lampe_Gruen', man:'zaehler', must:['COUNTER_BIT', 'ZR'],
  hint:'U Z2 · = Lampe_Gelb · UN Z2 · = Lampe_Gruen',
  bind:['billetVisible=Block_raus', 'lightYellow=Lampe_Gelb', 'lightGreen=Lampe_Gruen'] });

defAwl({ id:'a6_reset_dbg', ch:6, title:'Der Zähler bleibt bei 0', debug:true,
  story:'Der Stückzähler zeigt immer 0, egal wie viele Blöcke vorbeikommen. ARIA hat in der Rücksetz-Kette ein Zeichen verändert.',
  brief:'Gelöscht werden darf nur, wenn <code>S_Reset</code> <b>gedrückt</b> ist.',
  learn:'Negierte Abfragen beim Rücksetzen prüfen.',
  take:'Ein <code>UN</code> an der falschen Stelle dreht die Logik um: Der Zähler wird dann in jedem Zyklus gelöscht, in dem niemand den Taster drückt — also fast immer.',
  vars:{ Block_raus:false, S_Reset:false, Stueck:0 },
  timed: seq([[0.1, { Block_raus:true }, { Stueck:1 }], [0.1, { Block_raus:false }, { Stueck:1 }], [0.1, { S_Reset:true }, { Stueck:0 }]]),
  start:'U  Block_raus\nZV Z1\nUN S_Reset\nR  Z1\nL  Z1\nT  Stueck', ref:'U  Block_raus\nZV Z1\nU  S_Reset\nR  Z1\nL  Z1\nT  Stueck', man:'zaehler', must:['ZRESET'],
  hint:'UN S_Reset → U S_Reset.',
  bind:['billetVisible=Block_raus', 'pieceCount=Stueck'] });

defAwl({ id:'a6_vorwahl', ch:6, title:'Die Vorwahl vom Leitstand',
  story:'Die Chargengrösse ist nicht immer 10. Am Leitstand stellt der Schichtleiter die Zahl ein — sie steht in der Variable <code>Vorwahl</code>.',
  brief:'<code>U S_Laden</code> · <code>L Vorwahl</code> · <code>S Z2</code><br><code>U Block_raus</code> · <code>ZR Z2</code><br><code>L Z2</code> · <code>T Rest</code>',
  learn:'Zähler aus einer Variable setzen.',
  take:'Der Wert für <code>S Z</code> darf aus jeder Variable kommen. Entscheidend ist, dass er im Moment des Setzens in AKKU1 steht.',
  vars:{ S_Laden:false, Block_raus:false, Vorwahl:0, Rest:0 },
  timed: seq([[0.1, { Vorwahl:7, S_Laden:true }, { Rest:7 }], [0.1, { S_Laden:false }, { Rest:7 }], [0.1, { Block_raus:true }, { Rest:6 }], [0.1, { Block_raus:false, Vorwahl:4, S_Laden:true }, { Rest:4 }]]),
  ref:'U  S_Laden\nL  Vorwahl\nS  Z2\nU  Block_raus\nZR Z2\nL  Z2\nT  Rest', man:'zaehler', must:['ZS', 'ZR'],
  hint:'L Vorwahl statt L 10.',
  bind:['billetVisible=Block_raus', 'displayValue=Rest', 'displayLabel:"REST"'] });

defAwl({ id:'a6_ofen', ch:6, title:'Blöcke im Ofen',
  story:'Im Stossofen liegen die Blöcke hintereinander. Jeder, der hineingeschoben wird, zählt vorwärts; jeder, der herauskommt, rückwärts. So weiss der Leitstand, wie viele gerade im Ofen sind.',
  brief:'<code>U Block_rein</code> · <code>ZV Z3</code><br><code>U Block_raus</code> · <code>ZR Z3</code><br><code>L Z3</code> · <code>T Im_Ofen</code>',
  learn:'Ein Zähler, zwei Richtungen.',
  take:'Ein S5-Zähler kann vorwärts und rückwärts zählen. So entsteht eine Bestandszählung: rein +1, raus −1.',
  vars:{ Block_rein:false, Block_raus:false, Im_Ofen:0 },
  timed: seq([[0.1, { Block_rein:true }, { Im_Ofen:1 }], [0.1, { Block_rein:false }, { Im_Ofen:1 }], [0.1, { Block_rein:true }, { Im_Ofen:2 }], [0.1, { Block_rein:false, Block_raus:true }, { Im_Ofen:1 }], [0.1, { Block_raus:false, Block_rein:true }, { Im_Ofen:2 }], [0.1, { Block_rein:false, Block_raus:true }, { Im_Ofen:1 }]]),
  ref:'U  Block_rein\nZV Z3\nU  Block_raus\nZR Z3\nL  Z3\nT  Im_Ofen', man:'zaehler', must:['ZV', 'ZR'],
  hint:'Beide Zähloperationen auf denselben Zähler Z3.',
  bind:['furnaceOn=Block_rein', 'displayValue=Im_Ofen', 'displayLabel:"IM OFEN"'] });

defAwl({ id:'a6_zaehler_dbg', ch:6, title:'Der falsche Zähler', debug:true,
  story:'Die Anzeige „Im Ofen“ zählt nur hoch, nie herunter. ARIA hat beim Rückwärtszählen einen anderen Zähler eingetragen.',
  brief:'Rein und raus müssen auf <b>denselben</b> Zähler wirken.',
  learn:'Zählernummern prüfen.',
  take:'S5-Zähler heissen nur Z1, Z2, Z3 … — ein Tippfehler in der Nummer fällt beim Lesen kaum auf. Prüfe, ob alle Befehle auf denselben Zähler gehen.',
  vars:{ Block_rein:false, Block_raus:false, Im_Ofen:0 },
  timed: seq([[0.1, { Block_rein:true }, { Im_Ofen:1 }], [0.1, { Block_rein:false, Block_raus:true }, { Im_Ofen:0 }]]),
  start:'U  Block_rein\nZV Z3\nU  Block_raus\nZR Z4\nL  Z3\nT  Im_Ofen', ref:'U  Block_rein\nZV Z3\nU  Block_raus\nZR Z3\nL  Z3\nT  Im_Ofen', man:'zaehler', must:['ZR'],
  hint:'ZR Z4 → ZR Z3.',
  bind:['furnaceOn=Block_rein', 'displayValue=Im_Ofen', 'displayLabel:"IM OFEN"'] });

defAwl({ id:'a6_voll', ch:6, title:'Der Ofen ist voll',
  story:'Der Ofen fasst 5 Blöcke. Du zählst diesmal die <b>freien Plätze</b>: Zu Beginn wird der Zähler auf 5 gesetzt, jeder Block hinein zählt rückwärts, jeder Block heraus vorwärts. Ist kein Platz mehr frei, leuchtet „Ofen voll“.',
  brief:'<code>U S_Start</code> · <code>L 5</code> · <code>S Z4</code><br><code>U Block_rein</code> · <code>ZR Z4</code> · <code>U Block_raus</code> · <code>ZV Z4</code><br><code>UN Z4</code> → <code>= Ofen_voll</code>',
  learn:'Zählrichtung passend wählen.',
  take:'Ob man belegte oder freie Plätze zählt, ist eine Frage der Bequemlichkeit: Bei freien Plätzen meldet <code>UN Z4</code> direkt „voll“.',
  vars:{ S_Start:false, Block_rein:false, Block_raus:false, Ofen_voll:false },
  timed: seq([[0.1, { S_Start:true }, { Ofen_voll:false }], [0.1, { S_Start:false, Block_rein:true }, {}], [0.1, { Block_rein:false }, {}], [0.1, { Block_rein:true }, {}], [0.1, { Block_rein:false }, {}], [0.1, { Block_rein:true }, {}], [0.1, { Block_rein:false }, {}], [0.1, { Block_rein:true }, {}], [0.1, { Block_rein:false }, { Ofen_voll:false }], [0.1, { Block_rein:true }, { Ofen_voll:true }], [0.1, { Block_rein:false, Block_raus:true }, { Ofen_voll:false }]]),
  ref:'U  S_Start\nL  5\nS  Z4\nU  Block_rein\nZR Z4\nU  Block_raus\nZV Z4\nUN Z4\n=  Ofen_voll', man:'zaehler', must:['ZS', 'ZR', 'ZV', 'COUNTER_BIT'],
  hint:'UN Z4 ist 1, wenn der Zähler bei 0 steht.',
  bind:['furnaceOn=Block_rein', 'lightRed=Ofen_voll'] });

defAwl({ id:'a6_boss', ch:6, title:'Boss: Der Chargenzähler', boss:true,
  story:'ARIA verwirrt die Chargenzählung. Herr Brunner fasst zusammen: „Charge laden mit der Vorwahl. Jeder Block zählt herunter und auf dem Tageszähler hoch. Ist die Charge fertig, hupt es. Und der Tageszähler wird nur zu Schichtbeginn gelöscht.“',
  brief:'<b>Charge (Z1):</b> <code>U S_Laden</code> · <code>L Vorwahl</code> · <code>S Z1</code> · <code>U Block_raus</code> · <code>ZR Z1</code> · <code>L Z1</code> · <code>T Rest</code><br><b>Tag (Z2):</b> <code>U Block_raus</code> · <code>ZV Z2</code> · <code>U S_Schicht</code> · <code>R Z2</code> · <code>L Z2</code> · <code>T Tag</code><br><b>Meldungen:</b> <code>U Z1</code> → <code>= Lampe_Gelb</code> · <code>UN Z1</code> · <code>U Charge_aktiv</code> → <code>= Hupe</code><br><b>Charge aktiv:</b> <code>U S_Laden</code> → <code>S Charge_aktiv</code> · <code>U S_Quit</code> → <code>R Charge_aktiv</code>',
  learn:'Zwei Zähler, Setzen, Löschen, Auswerten.',
  take:'Zähler sind Bausteine einer Anlage: Einer zählt die Charge ab, einer summiert den Tag. Mit <code>U Z</code> / <code>UN Z</code> werden aus Zählwerten Meldungen.',
  vars:{ S_Laden:false, S_Schicht:false, S_Quit:false, Block_raus:false, Vorwahl:2, Charge_aktiv:false, Rest:0, Tag:0, Lampe_Gelb:false, Hupe:false },
  timed: seq([[0.1, { S_Laden:true }, { Rest:2, Lampe_Gelb:true, Hupe:false }], [0.1, { S_Laden:false, Block_raus:true }, { Rest:1, Tag:1 }], [0.1, { Block_raus:false }, { Rest:1 }], [0.1, { Block_raus:true }, { Rest:0, Tag:2, Lampe_Gelb:false, Hupe:true }], [0.1, { Block_raus:false, S_Quit:true }, { Hupe:false }], [0.1, { S_Quit:false, S_Laden:true }, { Rest:2, Tag:2 }], [0.1, { S_Laden:false, S_Schicht:true }, { Tag:0, Rest:2 }]]),
  ref:'NETWORK Charge laden\nU  S_Laden\nL  Vorwahl\nS  Z1\nU  S_Laden\nS  Charge_aktiv\nU  S_Quit\nR  Charge_aktiv\n\nNETWORK Charge zaehlen\nU  Block_raus\nZR Z1\nL  Z1\nT  Rest\n\nNETWORK Tageszaehler\nU  Block_raus\nZV Z2\nU  S_Schicht\nR  Z2\nL  Z2\nT  Tag\n\nNETWORK Meldungen\nU  Z1\n=  Lampe_Gelb\nUN Z1\nU  Charge_aktiv\n=  Hupe', man:'zaehler', must:['ZS', 'ZR', 'ZV', 'ZRESET', 'COUNTER_BIT'],
  hint:'Vier Netzwerke: Charge laden, Charge zählen, Tageszähler, Meldungen.',
  bind:['billetVisible=Block_raus', 'displayValue=Rest', 'displayLabel:"REST CHARGE"', 'pieceCount=Tag', 'lightYellow=Lampe_Gelb', 'hornActive=Hupe'] });
})();
