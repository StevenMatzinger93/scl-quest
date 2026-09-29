/* ===== AWL QUEST · KAPITEL 1 — Erste Anweisungen ===== */
(function(){

defAwl({ id:'a1_rollgang', ch:1, title:'Der erste Rollgang',
  story:'Herr Brunner klopft auf die graue S7-300: „Zwanzig Jahre lief die. Dann kam ARIA und hat das Programm gelöscht.“ Der Rollgang steht still. Du fängst ganz einfach an: Solange der Taster gedrückt ist, läuft der Rollgang.',
  brief:'Schreibe zwei Zeilen:<br><code>U  S_Rollgang</code> — frage den Taster ab<br><code>=  Rollgang</code> — weise das Ergebnis dem Motor zu',
  learn:'Eine Abfrage und eine Zuweisung.',
  take:'<code>U</code> fragt einen Operanden ab und bildet das <b>VKE</b> (Verknüpfungsergebnis). <code>=</code> schreibt das VKE in den Ausgang — in jedem Zyklus neu.',
  vars:{ S_Rollgang:false, Rollgang:false },
  tests:[[{ S_Rollgang:true }, { Rollgang:true }], [{ S_Rollgang:false }, { Rollgang:false }]],
  ref:'U  S_Rollgang\n=  Rollgang', man:'grundlagen', must:['U', 'ASSIGN'],
  hint:'Zeile 1: U S_Rollgang · Zeile 2: = Rollgang',
  bind:['conveyorRunning=Rollgang'] });

defAwl({ id:'a1_und', ch:1, title:'Nur mit Schutzgitter',
  story:'Das Walzgerüst läuft an, obwohl das Schutzgitter offen steht. „Das hätte früher niemand gewagt“, brummt Herr Brunner. Die Walzen dürfen nur drehen, wenn das Gitter <b>zu</b> ist.',
  brief:'<code>Walzen</code> = <code>S_Walzen</code> <b>UND</b> <code>Gitter_zu</code>. Zwei Abfragen mit <code>U</code>, dann <code>=</code>.',
  learn:'UND-Verknüpfung mit zwei Abfragen.',
  take:'Die erste Abfrage ist die <b>Erstabfrage</b>: Sie übernimmt den Wert ins VKE. Jede weitere <code>U</code>-Zeile verknüpft das VKE mit UND.',
  vars:{ S_Walzen:false, Gitter_zu:false, Walzen:false },
  tests: truth(['S_Walzen', 'Gitter_zu'], e => ({ Walzen: e.S_Walzen && e.Gitter_zu })),
  ref:'U  S_Walzen\nU  Gitter_zu\n=  Walzen', man:'grundlagen', must:['U', 'ASSIGN'],
  hint:'U S_Walzen · U Gitter_zu · = Walzen',
  bind:['rollsRunning=Walzen'] });

defAwl({ id:'a1_pumpe', ch:1, title:'Drei Bedingungen für die Pumpe',
  story:'Die Hydraulikpumpe versorgt die Anstellung der Walzen. Sie darf nur laufen, wenn genug Öl im Tank ist, die Anlage freigegeben ist <b>und</b> jemand den Taster drückt.',
  brief:'Die Hydraulikpumpe läuft nur, wenn <b>alle drei</b> Bedingungen erfüllt sind: Anlage freigegeben, genug Öl im Tank und Pumpentaster gedrückt.',
  learn:'Eine UND-Kette mit drei Gliedern.',
  take:'Eine UND-Kette darf beliebig lang sein. Schon eine einzige 0 macht das VKE zu 0 — und dann bleibt es 0 bis zum Ende der Kette.',
  vars:{ Freigabe:false, Oel_OK:false, S_Pumpe:false, Pumpe:false },
  tests: truth(['Freigabe', 'Oel_OK', 'S_Pumpe'], e => ({ Pumpe: e.Freigabe && e.Oel_OK && e.S_Pumpe })),
  ref:'U  Freigabe\nU  Oel_OK\nU  S_Pumpe\n=  Pumpe', man:'grundlagen', must:['U'],
  hint:'Drei U-Zeilen, dann = Pumpe.',
  bind:['pumpRunning=Pumpe'] });

defAwl({ id:'a1_zwei', ch:1, title:'Ein VKE, zwei Ausgänge',
  story:'Wenn die Kühlung läuft, soll am Leitstand die grüne Lampe leuchten. Herr Brunner: „Dafür brauchst du keine zweite Kette. Das VKE bleibt nach dem Zuweisen stehen.“',
  brief:'Die Kühlung <b>und</b> die grüne Lampe am Leitstand sind an, wenn das Kühlwasser in Ordnung ist <b>und</b> der Kühltaster gedrückt ist.<br>Nach der Kette zwei Zuweisungen untereinander (<code>=</code> und <code>=</code>).',
  learn:'Das VKE bleibt nach = erhalten.',
  take:'<code>=</code> beendet die Kette, das VKE bleibt aber stehen. Mehrere <code>=</code> hintereinander schreiben denselben Wert in mehrere Ausgänge.',
  vars:{ Wasser_OK:false, S_Kuehlung:false, Kuehlung:false, Lampe_Gruen:false },
  tests: truth(['Wasser_OK', 'S_Kuehlung'], e => ({ Kuehlung: e.Wasser_OK && e.S_Kuehlung, Lampe_Gruen: e.Wasser_OK && e.S_Kuehlung })),
  ref:'U  Wasser_OK\nU  S_Kuehlung\n=  Kuehlung\n=  Lampe_Gruen', man:'grundlagen', must:['ASSIGN'],
  hint:'U Wasser_OK · U S_Kuehlung · = Kuehlung · = Lampe_Gruen',
  bind:['coolingOn=Kuehlung', 'lightGreen=Lampe_Gruen'] });

defAwl({ id:'a1_schere_dbg', ch:1, title:'Die falsche Schere', debug:true,
  story:'Die Schere schneidet, sobald jemand den Taster drückt — auch wenn gar kein Block darunter liegt. ARIA hat eine Zeile gelöscht.',
  brief:'Die Schere darf nur schneiden, wenn ihr Taster gedrückt ist <b>und</b> die Lichtschranke einen Block meldet.',
  learn:'Fehlende Abfragen finden.',
  take:'Bei der Fehlersuche liest du die Kette von oben nach unten: Welche Bedingung fehlt? Im Status siehst du, bei welcher Zeile das VKE auf 1 bleibt, obwohl es 0 sein müsste.',
  vars:{ S_Schere:false, Block_da:false, Schere:false },
  tests: truth(['S_Schere', 'Block_da'], e => ({ Schere: e.S_Schere && e.Block_da })),
  start:'U  S_Schere\n=  Schere', ref:'U  S_Schere\nU  Block_da\n=  Schere', man:'grundlagen', must:['U'],
  hint:'Zwischen U S_Schere und = Schere fehlt eine Abfrage.',
  bind:['shearDown=Schere', 'billetVisible=Block_da'] });

defAwl({ id:'a1_ketten', ch:1, title:'Zwei Ketten',
  story:'Der Stossofen soll heizen, wenn der Taster gedrückt und die Ofentür zu ist. Und solange er heizt, leuchtet die gelbe Lampe. Zwei Aufgaben — zwei Ketten.',
  brief:'Kette 1: Die Ofenheizung ist an, wenn der Heiztaster gedrückt <b>und</b> die Ofentür zu ist.<br>Kette 2: Die gelbe Lampe leuchtet, solange die Ofenheizung an ist (frage dazu den Ausgang aus Kette 1 ab).',
  learn:'Nach = beginnt eine neue Kette mit einer Erstabfrage.',
  take:'Nach <code>=</code> ist die Kette zu Ende. Die nächste Abfrage ist wieder eine <b>Erstabfrage</b> — sie verknüpft nicht mit dem alten VKE, sondern fängt neu an.',
  vars:{ S_Heizen:false, Tuer_zu:false, Ofen_Heizung:false, Lampe_Gelb:false },
  tests: truth(['S_Heizen', 'Tuer_zu'], e => ({ Ofen_Heizung: e.S_Heizen && e.Tuer_zu, Lampe_Gelb: e.S_Heizen && e.Tuer_zu })),
  ref:'U  S_Heizen\nU  Tuer_zu\n=  Ofen_Heizung\nU  Ofen_Heizung\n=  Lampe_Gelb', man:'grundlagen', must:['ASSIGN'],
  wrong:['U  S_Heizen\nU  Tuer_zu\n=  Ofen_Heizung\nU  S_Heizen\n=  Lampe_Gelb'],
  hint:'Die zweite Kette fragt den Ausgang der ersten ab: U Ofen_Heizung.',
  bind:['furnaceOn=Ofen_Heizung', 'lightYellow=Lampe_Gelb', { channel:'furnaceDoor', variable:'Tuer_zu', map:{ 'true':false, 'false':true } }] });

defAwl({ id:'a1_netzwerke', ch:1, title:'Ordnung mit Netzwerken',
  story:'Im alten Programm fand sich niemand zurecht: tausend Zeilen ohne Überschrift. Herr Brunner zeigt dir, wie man AWL in <b>Netzwerke</b> teilt — jedes mit einem Titel.',
  brief:'<b>NETWORK Rollgang</b>: Der Rollgang läuft, wenn sein Taster gedrückt ist <b>und</b> der Not-Aus in Ordnung ist.<br><b>NETWORK Walzen</b>: Das Walzgerüst läuft, wenn sein Taster gedrückt ist <b>und</b> der Not-Aus in Ordnung ist.<br>Ein Netzwerk beginnt mit einer Zeile <code>NETWORK Titel</code>.',
  learn:'Programme in Netzwerke gliedern.',
  take:'<code>NETWORK Titel</code> teilt die Anweisungsliste in Abschnitte. Jedes Netzwerk löst eine Aufgabe — so bleibt auch ein langes Programm lesbar.',
  vars:{ S_Rollgang:false, S_Walzen:false, Not_Aus_OK:false, Rollgang:false, Walzen:false },
  tests: truth(['S_Rollgang', 'S_Walzen', 'Not_Aus_OK'], e => ({ Rollgang: e.S_Rollgang && e.Not_Aus_OK, Walzen: e.S_Walzen && e.Not_Aus_OK })),
  ref:'NETWORK Rollgang\nU  S_Rollgang\nU  Not_Aus_OK\n=  Rollgang\n\nNETWORK Walzen\nU  S_Walzen\nU  Not_Aus_OK\n=  Walzen', man:'grundlagen', must:['NETWORK'],
  hint:'Zwei Abschnitte, jeder beginnt mit NETWORK und einem Titel.',
  bind:['conveyorRunning=Rollgang', 'rollsRunning=Walzen'] });

defAwl({ id:'a1_zufrueh_dbg', ch:1, title:'Zu früh zugewiesen', debug:true,
  story:'Die grüne Lampe am Leitstand leuchtet, sobald die Pumpe läuft — auch wenn der Öldruck fehlt. Im Code steht die Abfrage des Drucks doch drin? Herr Brunner tippt auf den Status: „Schau, wo das = steht.“',
  brief:'Die grüne Lampe am Leitstand leuchtet nur, wenn die Pumpe läuft <b>und</b> der Öldruck in Ordnung ist. Bring die Zeilen in die richtige Reihenfolge.',
  learn:'Die Reihenfolge der Zeilen bestimmt das Ergebnis.',
  take:'<code>=</code> schreibt das VKE, das <b>in diesem Moment</b> vorliegt. Eine Abfrage nach dem <code>=</code> gehört schon zur nächsten Kette.',
  vars:{ Pumpe:false, Druck_OK:false, Lampe_Gruen:false },
  tests: truth(['Pumpe', 'Druck_OK'], e => ({ Lampe_Gruen: e.Pumpe && e.Druck_OK })),
  start:'U  Pumpe\n=  Lampe_Gruen\nU  Druck_OK', ref:'U  Pumpe\nU  Druck_OK\n=  Lampe_Gruen', man:'grundlagen', must:['ASSIGN'],
  hint:'Die Zuweisung muss ans Ende der Kette.',
  bind:['pumpRunning=Pumpe', 'lightGreen=Lampe_Gruen'] });

defAwl({ id:'a1_kette', ch:1, title:'Die Startbedingungen',
  story:'Bevor das Walzgerüst anläuft, prüft das alte Programm fünf Bedingungen. ARIA hat die ganze Liste gelöscht — Herr Brunner kennt sie noch auswendig.',
  brief:'Das Walzgerüst läuft nur, wenn <b>alle fünf</b> Bedingungen erfüllt sind: Walzentaster gedrückt, Not-Aus in Ordnung, Schutzgitter zu, Ölstand in Ordnung und Kühlung läuft.',
  learn:'Lange UND-Ketten.',
  take:'In AWL steht jede Bedingung auf einer eigenen Zeile. Das macht lange Ketten leicht lesbar — und im Status siehst du sofort, welche Zeile das VKE auf 0 zieht.',
  vars:{ S_Walzen:false, Not_Aus_OK:false, Gitter_zu:false, Oel_OK:false, Kuehlung:false, Walzen:false },
  tests: truth(['S_Walzen', 'Not_Aus_OK', 'Gitter_zu', 'Oel_OK', 'Kuehlung'], e => ({ Walzen: e.S_Walzen && e.Not_Aus_OK && e.Gitter_zu && e.Oel_OK && e.Kuehlung })),
  ref:'U  S_Walzen\nU  Not_Aus_OK\nU  Gitter_zu\nU  Oel_OK\nU  Kuehlung\n=  Walzen', man:'grundlagen', must:['U'],
  hint:'Fünf U-Zeilen, eine Zuweisung.',
  bind:['rollsRunning=Walzen', 'coolingOn=Kuehlung'] });

defAwl({ id:'a1_boss', ch:1, title:'Boss: Der Leitstand', boss:true,
  story:'ARIA lässt alle Lampen im Leitstand flackern. Herr Brunner reicht dir den Schaltplan: „Drei Ausgänge, drei Ketten. Und der Not-Aus steckt in allen.“',
  brief:'<b>1.</b> Rollgang: Rollgangtaster <b>und</b> Not-Aus in Ordnung.<br><b>2.</b> Walzgerüst: Walzentaster <b>und</b> Not-Aus in Ordnung <b>und</b> Schutzgitter zu.<br><b>3.</b> Grüne Lampe: Not-Aus in Ordnung <b>und</b> Schutzgitter zu.',
  learn:'Mehrere Ketten in einem Programm.',
  take:'Ein AWL-Programm ist eine Folge von Ketten. Jede beginnt mit einer Erstabfrage und endet mit einer Zuweisung.',
  vars:{ S_Rollgang:false, S_Walzen:false, Not_Aus_OK:false, Gitter_zu:false, Rollgang:false, Walzen:false, Lampe_Gruen:false },
  tests: truth(['S_Rollgang', 'S_Walzen', 'Not_Aus_OK', 'Gitter_zu'], e => ({ Rollgang: e.S_Rollgang && e.Not_Aus_OK, Walzen: e.S_Walzen && e.Not_Aus_OK && e.Gitter_zu, Lampe_Gruen: e.Not_Aus_OK && e.Gitter_zu })),
  ref:'NETWORK Rollgang\nU  S_Rollgang\nU  Not_Aus_OK\n=  Rollgang\n\nNETWORK Walzen\nU  S_Walzen\nU  Not_Aus_OK\nU  Gitter_zu\n=  Walzen\n\nNETWORK Lampe\nU  Not_Aus_OK\nU  Gitter_zu\n=  Lampe_Gruen', man:'grundlagen', must:['U', 'ASSIGN'],
  hint:'Drei Ketten untereinander. Du kannst sie mit NETWORK trennen.',
  bind:['conveyorRunning=Rollgang', 'rollsRunning=Walzen', 'lightGreen=Lampe_Gruen'] });
})();
