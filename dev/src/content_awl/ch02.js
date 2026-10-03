/* ===== AWL QUEST · KAPITEL 2 — Verknüpfungen ===== */
(function(){

defAwl({ id:'a2_un', ch:2, title:'Nicht bei Störung',
  story:'Das Walzgerüst läuft auch bei einer Störung weiter, dabei stand da früher ein UN, sagt Herr Brunner. Mit <code>UN</code> fragst du ab, ob ein Signal <b>nicht</b> ansteht.',
  brief:'Die Walzen laufen mit ihrem Taster, aber <b>nicht</b>, solange eine Störung der Anlage ansteht. Zum Beispiel mit <code>UN</code>.',
  learn:'UND NICHT (UN).',
  take:'<code>UN</code> fragt einen Operanden <b>negiert</b> ab: Er liefert 1, wenn der Operand 0 ist. So sperrt eine anstehende Störung die ganze Kette.',
  vars:{ S_Walzen:false, Stoerung:false, Walzen:false },
  tests: truth(['S_Walzen', 'Stoerung'], e => ({ Walzen: e.S_Walzen && !e.Stoerung })),
  ref:'U  S_Walzen\nUN Stoerung\n=  Walzen', man:'verknuepfung', must:['UN'],
  hint:'U S_Walzen · UN Stoerung · = Walzen',
  bind:['rollsRunning=Walzen', 'faultActive=Stoerung'] });

defAwl({ id:'a2_oder', ch:2, title:'Zwei Hupentaster',
  story:'Die Hupe warnt vor dem Anlaufen des Rollgangs. Einer von zwei Tastern genügt, einer sitzt am Pult, einer am Kran.',
  brief:'Die Warnhupe tönt, solange der Hupentaster am Pult <b>oder</b> der am Kran gedrückt ist. Zwei <code>O</code>-Abfragen.',
  learn:'ODER (O).',
  take:'<code>O</code> verknüpft mit ODER: Das VKE ist 1, wenn mindestens eine Abfrage 1 liefert. Auch die Erstabfrage darf mit <code>O</code> beginnen.',
  vars:{ S_Hupe_Pult:false, S_Hupe_Kran:false, Hupe:false },
  tests: truth(['S_Hupe_Pult', 'S_Hupe_Kran'], e => ({ Hupe: e.S_Hupe_Pult || e.S_Hupe_Kran })),
  ref:'O  S_Hupe_Pult\nO  S_Hupe_Kran\n=  Hupe', man:'verknuepfung', must:['O'],
  hint:'O S_Hupe_Pult · O S_Hupe_Kran · = Hupe',
  bind:['hornActive=Hupe'] });

defAwl({ id:'a2_on', ch:2, title:'Irgendetwas stimmt nicht',
  story:'Die rote Lampe soll leuchten, sobald <b>eine</b> Voraussetzung fehlt: kein Öl, kein Kühlwasser oder der Not-Aus gedrückt.',
  brief:'Die rote Meldelampe leuchtet, sobald der Ölstand nicht OK ist, kein Kühlwasser vorhanden ist <b>oder</b> der Not-Aus betätigt ist. Zum Beispiel mit <code>ON</code>.',
  learn:'ODER NICHT (ON).',
  take:'<code>ON</code> fragt negiert ab und verknüpft mit ODER. Für Sammelmeldungen („mindestens ein Fehler“) ist das die natürliche Form.',
  vars:{ Oel_OK:true, Wasser_OK:true, Not_Aus_OK:true, Lampe_Rot:false },
  tests: truth(['Oel_OK', 'Wasser_OK', 'Not_Aus_OK'], e => ({ Lampe_Rot: !e.Oel_OK || !e.Wasser_OK || !e.Not_Aus_OK })),
  ref:'ON Oel_OK\nON Wasser_OK\nON Not_Aus_OK\n=  Lampe_Rot', man:'verknuepfung', must:['ON'],
  hint:'Drei ON-Zeilen, dann = Lampe_Rot.',
  bind:['lightRed=Lampe_Rot'] });

defAwl({ id:'a2_x', ch:2, title:'Genau eine Endlage',
  story:'Die Schere meldet ihre Lage über die Endschalter <code>Oben</code> und <code>Unten</code>, und stimmt alles, meldet <b>genau einer</b>. Melden beide oder keiner, ist ein Schalter defekt.',
  brief:'Die Endlage der Schere ist plausibel, wenn <b>genau einer</b> der beiden Endschalter (oben, unten) meldet. Zum Beispiel mit <code>X</code>.',
  learn:'Exklusiv-ODER (X).',
  take:'<code>X</code> liefert 1, wenn die Abfragen <b>verschieden</b> sind. Für zwei Rückmeldungen, die sich ausschliessen, ist das die perfekte Plausibilitätsprüfung.',
  vars:{ Oben:false, Unten:false, Lage_OK:false },
  tests: truth(['Oben', 'Unten'], e => ({ Lage_OK: e.Oben !== e.Unten })),
  ref:'X  Oben\nX  Unten\n=  Lage_OK', man:'verknuepfung', must:['X'],
  hint:'X Oben · X Unten · = Lage_OK',
  bind:['shearDown=Unten', 'lightGreen=Lage_OK'] });

defAwl({ id:'a2_und_vor_oder', ch:2, title:'Hand oder Automatik',
  story:'Der Rollgang läuft entweder <b>von Hand</b> (Betriebsart Hand und Tipptaster) oder <b>automatisch</b> (Betriebsart Automatik und ein Block ist bereit). Zwei UND-Gruppen, verbunden mit ODER.',
  brief:'Der Rollgang läuft in Betriebsart Hand mit dem Tipptaster <b>oder</b> in Betriebsart Automatik, wenn ein Block bereit ist. Trenne die beiden UND-Gruppen mit <code>O</code> ohne Operand.',
  learn:'UND vor ODER, O ohne Operand.',
  take:'In AWL bindet UND stärker als ODER. <code>O</code> ohne Operand schliesst eine UND-Gruppe ab und beginnt die nächste — das Ergebnis ist die ODER-Verknüpfung beider Gruppen.',
  vars:{ Hand:false, S_Tippen:false, Automatik:false, Block_bereit:false, Rollgang:false },
  tests: truth(['Hand', 'S_Tippen', 'Automatik', 'Block_bereit'], e => ({ Rollgang: (e.Hand && e.S_Tippen) || (e.Automatik && e.Block_bereit) })),
  ref:'U  Hand\nU  S_Tippen\nO\nU  Automatik\nU  Block_bereit\n=  Rollgang', man:'verknuepfung', must:['O_VOR'],
  hint:'U Hand · U S_Tippen · O · U Automatik · U Block_bereit · = Rollgang',
  bind:['conveyorRunning=Rollgang', 'billetVisible=Block_bereit'] });

defAwl({ id:'a2_klammer', ch:2, title:'Eine von zwei Pumpen',
  story:'Das Gerüst braucht Kühlwasser, und eine der zwei Kühlpumpen reicht. Aber natürlich muss auch jemand das Gerüst einschalten.',
  brief:'Die Walzen laufen mit ihrem Taster, wenn mindestens eine der beiden Kühlpumpen läuft. Die ODER-Gruppe kommt in eine Klammer <code>U(</code> … <code>)</code>.',
  learn:'Klammern: U( … ).',
  take:'<code>U(</code> merkt sich das VKE und beginnt in der Klammer eine neue Kette. <code>)</code> verknüpft das Klammer-Ergebnis mit UND. So stehen ODER-Gruppen mitten in einer UND-Kette.',
  vars:{ S_Walzen:false, Pumpe_1:false, Pumpe_2:false, Walzen:false },
  tests: truth(['S_Walzen', 'Pumpe_1', 'Pumpe_2'], e => ({ Walzen: e.S_Walzen && (e.Pumpe_1 || e.Pumpe_2) })),
  ref:'U  S_Walzen\nU(\nO  Pumpe_1\nO  Pumpe_2\n)\n=  Walzen', man:'klammern', must:['KLAMMER'],
  hint:'U S_Walzen · U( · O Pumpe_1 · O Pumpe_2 · ) · = Walzen',
  bind:['rollsRunning=Walzen', 'coolingOn=Pumpe_1'] });

defAwl({ id:'a2_klammer_dbg', ch:2, title:'Die fehlende Klammer', debug:true,
  story:'Das Hydraulikaggregat startet ohne Freigabe, sobald nur ein Druckspeicher geladen ist. Herr Brunner seufzt: „UND vor ODER, das vergessen sie alle.“',
  brief:'Die Hydraulikpumpe darf nur laufen, wenn die Anlage freigegeben ist <b>und</b> mindestens ein Druckspeicher geladen ist. Setze die fehlende Klammer.',
  learn:'Klammern gegen falsche Rangfolge.',
  take:'Ohne Klammer bedeutet <code>U a / O b / O c</code> „a oder b oder c“. Sobald ODER und UND gemischt werden, setze Klammern — und prüfe im Status, ob das VKE stimmt.',
  vars:{ Freigabe:false, Speicher_1:false, Speicher_2:false, Pumpe:false },
  tests: truth(['Freigabe', 'Speicher_1', 'Speicher_2'], e => ({ Pumpe: e.Freigabe && (e.Speicher_1 || e.Speicher_2) })),
  start:'U  Freigabe\nO  Speicher_1\nO  Speicher_2\n=  Pumpe', ref:'U  Freigabe\nU(\nO  Speicher_1\nO  Speicher_2\n)\n=  Pumpe', man:'klammern', must:['KLAMMER'],
  hint:'Die beiden O-Zeilen gehören in eine Klammer U( … ).',
  bind:['pumpRunning=Pumpe'] });

defAwl({ id:'a2_un_klammer', ch:2, title:'Keine der Störungen',
  story:'Die grüne Lampe „Anlage bereit“ leuchtet, wenn die Anlage eingeschaltet ist und <b>keine</b> der beiden Störungen ansteht.',
  brief:'Die grüne Meldelampe leuchtet, wenn die Anlage eingeschaltet ist und <b>keine</b> der beiden Störungen ansteht. Zum Beispiel mit der negierten Klammer <code>UN(</code>.',
  learn:'Negierte Klammer UN( … ).',
  take:'<code>UN(</code> verknüpft das Ergebnis der Klammer negiert. „Keine von beiden“ ist dasselbe wie „nicht (die eine oder die andere)“.',
  vars:{ Anlage_Ein:false, Stoerung_1:false, Stoerung_2:false, Lampe_Gruen:false },
  tests: truth(['Anlage_Ein', 'Stoerung_1', 'Stoerung_2'], e => ({ Lampe_Gruen: e.Anlage_Ein && !(e.Stoerung_1 || e.Stoerung_2) })),
  ref:'U  Anlage_Ein\nUN(\nO  Stoerung_1\nO  Stoerung_2\n)\n=  Lampe_Gruen', man:'klammern', must:['KLAMMER', 'UN'],
  hint:'U Anlage_Ein · UN( · O Stoerung_1 · O Stoerung_2 · ) · = Lampe_Gruen',
  bind:['lightGreen=Lampe_Gruen', 'faultActive=Stoerung_1'] });

defAwl({ id:'a2_x_dbg', ch:2, title:'Beide Richtungen', debug:true,
  story:'Die Richtungsmeldung des Rollgangs soll warnen, wenn <b>beide</b> Schütze (vor und zurück) oder <b>keines</b> angezogen hat. ARIA hat die Verknüpfung verändert — jetzt warnt die Lampe nie, wenn beide gleichzeitig anziehen.',
  brief:'Die gelbe Meldelampe soll leuchten, wenn beide Schütze des Rollgangs (vorwärts, rückwärts) angezogen sind <b>oder</b> keines – also wenn beide <b>gleich</b> sind.',
  learn:'X und XN unterscheiden.',
  take:'<code>XN</code> ist das Gegenteil von <code>X</code>: 1, wenn beide Abfragen <b>gleich</b> sind. Eine ODER-Verknüpfung erkennt „beide gleichzeitig“ nicht.',
  vars:{ Schuetz_vor:false, Schuetz_rueck:false, Lampe_Gelb:false },
  tests: truth(['Schuetz_vor', 'Schuetz_rueck'], e => ({ Lampe_Gelb: e.Schuetz_vor === e.Schuetz_rueck })),
  start:'ON Schuetz_vor\nON Schuetz_rueck\n=  Lampe_Gelb', ref:'U  Schuetz_vor\nXN Schuetz_rueck\n=  Lampe_Gelb', man:'verknuepfung', must:['XN'],
  hint:'Erstabfrage U Schuetz_vor, dann XN Schuetz_rueck.',
  bind:['conveyorRunning=Schuetz_vor', 'conveyorReverse=Schuetz_rueck', 'lightYellow=Lampe_Gelb'] });

defAwl({ id:'a2_boss', ch:2, title:'Boss: Die Freigabe des Rollgangs', boss:true,
  story:'ARIA hat die Freigabe des Rollgangs zu einem Knoten verdreht. Herr Brunner legt den alten Schaltplan auf den Tisch: „Hand oder Automatik — aber immer nur mit Not-Aus und ohne Störung.“',
  brief:'Rollgang: Hand mit Tipptaster <b>oder</b> Automatik mit bereitem Block, zusätzlich Not-Aus nicht betätigt und keine Störung.<br>Rote Lampe: Not-Aus betätigt oder Störung.',
  learn:'Klammern, UND vor ODER und negierte Abfragen kombinieren.',
  take:'Eine ODER-Gruppe mit UND-Teilen steht in einer Klammer, darin trennt <code>O</code> die Gruppen. Danach geht die UND-Kette ganz normal weiter.',
  vars:{ Hand:false, S_Tippen:false, Automatik:false, Block_bereit:false, Not_Aus_OK:true, Stoerung:false, Rollgang:false, Lampe_Rot:false },
  tests: truth(['Hand', 'S_Tippen', 'Automatik', 'Block_bereit', 'Not_Aus_OK', 'Stoerung'], e => ({ Rollgang: ((e.Hand && e.S_Tippen) || (e.Automatik && e.Block_bereit)) && e.Not_Aus_OK && !e.Stoerung, Lampe_Rot: !e.Not_Aus_OK || e.Stoerung })),
  ref:'NETWORK Rollgang\nU(\nU  Hand\nU  S_Tippen\nO\nU  Automatik\nU  Block_bereit\n)\nU  Not_Aus_OK\nUN Stoerung\n=  Rollgang\n\nNETWORK Rote Lampe\nON Not_Aus_OK\nO  Stoerung\n=  Lampe_Rot', man:'klammern', must:['KLAMMER', 'O_VOR', 'UN', 'ON'],
  hint:'Die Hand/Automatik-Gruppe kommt in U( … ), darin mit O getrennt.',
  hint2:'Rote Lampe: ON Not_Aus_OK · O Stoerung · = Lampe_Rot',
  bind:['conveyorRunning=Rollgang', 'lightRed=Lampe_Rot', 'faultActive=Stoerung', 'billetVisible=Block_bereit'] });
})();
