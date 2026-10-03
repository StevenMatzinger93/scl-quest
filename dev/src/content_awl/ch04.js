/* ===== AWL QUEST · KAPITEL 4 — Flanken ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a4_fp', ch:4, title:'Ein Schnitt pro Tastendruck',
  story:'Die Schere schneidet, solange jemand den Taster hält — der Block wird zerhackt. Sie soll pro Tastendruck <b>genau einmal</b> auslösen.',
  brief:'Pro Druck auf den Taster Schnitt fährt die Schere genau einen Zyklus ab, egal wie lange er gedrückt bleibt. Zum Beispiel mit <code>FP</code> und dem Flankenmerker Schnitt.',
  learn:'Positive Flanke FP.',
  take:'<code>FP</code> macht das VKE nur in dem Zyklus zu 1, in dem es von 0 auf 1 wechselt. Den alten Zustand speichert es im <b>Flankenmerker</b>.',
  vars:{ S_Schnitt:false, M_Schnitt:false, Schere:false },
  timed: seq([[0.1, { S_Schnitt:true }, { Schere:true }], [0.1, {}, { Schere:false }], [0.1, {}, { Schere:false }], [0.1, { S_Schnitt:false }, { Schere:false }], [0.1, { S_Schnitt:true }, { Schere:true }], [0.1, {}, { Schere:false }]]),
  ref:'U  S_Schnitt\nFP M_Schnitt\n=  Schere', man:'flanken', must:['FP'],
  hint:'Zwischen Abfrage und Zuweisung steht FP M_Schnitt.',
  bind:['shearDown=Schere'] });

defAwl({ id:'a4_fn', ch:4, title:'Der Block ist durch',
  story:'Hinter dem Walzgerüst sitzt eine Lichtschranke. Wenn der Block sie <b>verlässt</b>, soll kurz die Hupe tuten — ein Zyklus genügt dem alten Relais.',
  brief:'Verlässt der Block die Lichtschranke hinter dem Walzgerüst, meldet das Signal Block ist durch für einen Zyklus. Zum Beispiel mit <code>FN</code> und dem Flankenmerker der Lichtschranke.',
  learn:'Negative Flanke FN.',
  take:'<code>FN</code> reagiert auf den Wechsel von 1 nach 0 — das Ende eines Signals. Auch FN braucht einen eigenen Flankenmerker.',
  vars:{ Lichtschranke:false, M_LS:false, Signal_durch:false },
  timed: seq([[0.1, { Lichtschranke:true }, { Signal_durch:false }], [0.1, {}, { Signal_durch:false }], [0.1, { Lichtschranke:false }, { Signal_durch:true }], [0.1, {}, { Signal_durch:false }]]),
  ref:'U  Lichtschranke\nFN M_LS\n=  Signal_durch', man:'flanken', must:['FN'],
  hint:'U Lichtschranke · FN M_LS · = Signal_durch',
  bind:['billetVisible=Lichtschranke', 'hornActive=Signal_durch'] });

defAwl({ id:'a4_stromstoss', ch:4, title:'Ein Taster für Ein und Aus',
  story:'Am alten Pult gibt es für die Kühlung nur <b>einen</b> Taster: einmal drücken = ein, nochmal drücken = aus. Herr Brunner nennt das einen <b>Stromstossschalter</b>.',
  brief:'Jeder Druck auf den Taster Kühlung schaltet das Kühlwasser um: aus → ein, ein → aus. Zum Beispiel mit <code>FP</code> (Flankenmerker Taster Kühlung) und <code>X</code>.',
  learn:'Umschalten mit Flanke und XOR.',
  take:'Die Flanke liefert pro Tastendruck genau einen Impuls. <code>X Kuehlung</code> dreht den Ausgang bei jedem Impuls um: 1 XOR 1 = 0, 1 XOR 0 = 1.',
  vars:{ S_Kuehlung:false, M_Kuehl:false, Kuehlung:false },
  timed: seq([[0.1, { S_Kuehlung:true }, { Kuehlung:true }], [0.1, {}, { Kuehlung:true }], [0.1, { S_Kuehlung:false }, { Kuehlung:true }], [0.1, { S_Kuehlung:true }, { Kuehlung:false }], [0.1, {}, { Kuehlung:false }], [0.1, { S_Kuehlung:false }, { Kuehlung:false }]]),
  ref:'U  S_Kuehlung\nFP M_Kuehl\nX  Kuehlung\n=  Kuehlung', man:'flanken', must:['FP', 'X'],
  hint:'Nach FP kommt X Kuehlung — das VKE wird mit dem alten Zustand verknüpft.',
  bind:['coolingOn=Kuehlung'] });

defAwl({ id:'a4_melden', ch:4, title:'Block gemeldet',
  story:'Wenn ein neuer Block aus dem Ofen kommt, soll die Meldung „Block unterwegs“ gespeichert werden — aber nur beim <b>Eintreffen</b>. Die Leitstandbedienung löscht sie mit Quittieren.',
  brief:'Tritt ein Block aus dem Ofen, wird die Meldung Block unterwegs einmal gesetzt (steigende Flanke). Quittieren löscht sie, auch wenn der Block noch ansteht.',
  learn:'Flanke setzt einen Speicher.',
  take:'Mit der Flanke setzt das Signal den Speicher nur einmal. Wird quittiert, während das Signal noch ansteht, bleibt die Meldung aus — sie kommt erst beim nächsten Block wieder.',
  vars:{ Block_aus_Ofen:false, Quittieren:false, M_Ofen:false, Block_unterwegs:false },
  timed: seq([[0.1, { Block_aus_Ofen:true }, { Block_unterwegs:true }], [0.1, { Quittieren:true }, { Block_unterwegs:false }], [0.1, { Quittieren:false }, { Block_unterwegs:false }], [0.1, { Block_aus_Ofen:false }, { Block_unterwegs:false }], [0.1, { Block_aus_Ofen:true }, { Block_unterwegs:true }]]),
  ref:'U  Block_aus_Ofen\nFP M_Ofen\nS  Block_unterwegs\nU  Quittieren\nR  Block_unterwegs', man:'flanken', must:['FP', 'S', 'R'],
  wrong:['U  Block_aus_Ofen\nS  Block_unterwegs\nU  Quittieren\nR  Block_unterwegs'],
  hint:'Die Flanke steht zwischen U Block_aus_Ofen und S Block_unterwegs.',
  bind:['billetVisible=Block_aus_Ofen', 'lightYellow=Block_unterwegs'] });

defAwl({ id:'a4_quit_dbg', ch:4, title:'Der klemmende Quittiertaster', debug:true,
  story:'Der Quittiertaster klemmt — und löscht jede neue Störung sofort wieder, noch bevor jemand sie sieht. Quittieren soll nur beim <b>Drücken</b> wirken.',
  brief:'Quittieren soll nur im Moment des Drückens wirken, nicht dauernd. Werte den Taster mit einer steigenden Flanke und dem Flankenmerker Quittieren aus.',
  learn:'Flanken gegen Dauersignale.',
  take:'Ein Befehl, der nur einmal wirken soll, gehört an eine Flanke. Dann bleibt ein klemmender Taster harmlos.',
  vars:{ Fehler:false, Quittieren:false, M_Quit:false, Stoerung:false },
  timed: seq([[0.1, { Fehler:true }, { Stoerung:true }], [0.1, { Fehler:false }, { Stoerung:true }], [0.1, { Quittieren:true }, { Stoerung:false }], [0.1, { Fehler:true }, { Stoerung:true }], [0.1, { Fehler:false }, { Stoerung:true }]]),
  start:'U  Fehler\nS  Stoerung\nU  Quittieren\nR  Stoerung', ref:'U  Fehler\nS  Stoerung\nU  Quittieren\nFP M_Quit\nR  Stoerung', man:'flanken', must:['FP'],
  hint:'Zwischen U Quittieren und R Stoerung fehlt FP M_Quit.',
  bind:['faultActive=Stoerung'] });

defAwl({ id:'a4_nachlauf', ch:4, title:'Wasser nach dem Walzen',
  story:'Wenn das Gerüst stoppt, sollen die Walzen noch gekühlt werden. Das Wasser startet mit der <b>fallenden</b> Flanke von <code>Walzen</code> und läuft, bis jemand „Wasser aus“ drückt.',
  brief:'Schalten die Walzen ab (fallende Flanke), startet das Kühlwasser und läuft, bis der Taster Kühlwasser aus gedrückt wird. Der Flankenmerker Walzen steht bereit.',
  learn:'Aktion beim Abschalten.',
  take:'Mit <code>FN</code> reagiert das Programm auf das <b>Ende</b> eines Vorgangs — hier auf das Abschalten des Gerüsts.',
  vars:{ Walzen:false, S_Wasser_aus:false, M_Walzen:false, Kuehlung:false },
  timed: seq([[0.1, { Walzen:true }, { Kuehlung:false }], [0.1, { Walzen:false }, { Kuehlung:true }], [0.1, {}, { Kuehlung:true }], [0.1, { S_Wasser_aus:true }, { Kuehlung:false }], [0.1, { S_Wasser_aus:false }, { Kuehlung:false }]]),
  ref:'U  Walzen\nFN M_Walzen\nS  Kuehlung\nU  S_Wasser_aus\nR  Kuehlung', man:'flanken', must:['FN', 'S'],
  hint:'U Walzen · FN M_Walzen · S Kuehlung',
  bind:['rollsRunning=Walzen', 'coolingOn=Kuehlung'] });

defAwl({ id:'a4_merker_dbg', ch:4, title:'Ein Merker für zwei Flanken', debug:true,
  story:'Die Schere schneidet beim Tastendruck, aber der Zähltakt für den Leitstand kommt nie. ARIA hat beiden Flanken <b>denselben</b> Flankenmerker gegeben.',
  brief:'Schere und Zähltakt reagieren beide auf den Taster Schnitt, jede Flanke genau einen Zyklus. Jede Flanke braucht ihren eigenen Flankenmerker.',
  learn:'Jede Flanke braucht ihren eigenen Merker.',
  take:'Der Flankenmerker speichert den alten Zustand <b>einer</b> Auswertung. Teilen sich zwei FP einen Merker, überschreibt die erste den Merker — die zweite sieht nie eine Flanke.',
  vars:{ S_Schnitt:false, M_Schnitt:false, M_Takt:false, Schere:false, Takt:false },
  timed: seq([[0.1, { S_Schnitt:true }, { Schere:true, Takt:true }], [0.1, {}, { Schere:false, Takt:false }], [0.1, { S_Schnitt:false }, { Schere:false, Takt:false }], [0.1, { S_Schnitt:true }, { Schere:true, Takt:true }]]),
  start:'U  S_Schnitt\nFP M_Schnitt\n=  Schere\nU  S_Schnitt\nFP M_Schnitt\n=  Takt', ref:'U  S_Schnitt\nFP M_Schnitt\n=  Schere\nU  S_Schnitt\nFP M_Takt\n=  Takt', man:'flanken', must:['FP'],
  hint:'Die zweite FP-Zeile bekommt M_Takt.',
  bind:['shearDown=Schere', 'lightYellow=Takt'] });

defAwl({ id:'a4_richtung', ch:4, title:'Richtung umschalten',
  story:'Beim Reversiergerüst wechselt der Rollgang mit jedem Druck auf „Richtung“ zwischen vorwärts und rückwärts. Laufen soll er nur, solange „Fahren“ gedrückt ist.',
  brief:'Jeder Druck auf den Taster Richtung wechselt zwischen vorwärts und rückwärts (Flanke). Der Rollgang läuft nur, solange der Taster Fahren gedrückt ist.',
  learn:'Stromstoss für eine Betriebsgrösse.',
  take:'Der Stromstoss eignet sich für alles, was man per Taster umschaltet: Richtung, Betriebsart, Beleuchtung.',
  vars:{ S_Richtung:false, S_Fahren:false, M_Richtung:false, Rueckwaerts:false, Rollgang:false },
  timed: seq([[0.1, { S_Fahren:true }, { Rollgang:true, Rueckwaerts:false }], [0.1, { S_Richtung:true }, { Rueckwaerts:true }], [0.1, { S_Richtung:false }, { Rueckwaerts:true }], [0.1, { S_Richtung:true }, { Rueckwaerts:false }], [0.1, { S_Richtung:false, S_Fahren:false }, { Rollgang:false, Rueckwaerts:false }]]),
  ref:'U  S_Richtung\nFP M_Richtung\nX  Rueckwaerts\n=  Rueckwaerts\nU  S_Fahren\n=  Rollgang', man:'flanken', must:['FP', 'X'],
  hint:'Wie beim Stromstoss für die Kühlung.',
  bind:['conveyorRunning=Rollgang', 'conveyorReverse=Rueckwaerts'] });

defAwl({ id:'a4_zweimal', ch:4, title:'Ein und aus in einem',
  story:'Die Ofentür-Hupe soll kurz tuten, wenn die Tür <b>aufgeht</b>, und ebenso, wenn sie wieder <b>zugeht</b>. Zwei Flanken, ein Ausgang.',
  brief:'Die Warnhupe tönt einen Zyklus, wenn die Ofentür aufgeht, und einen, wenn sie zugeht. Zwei Klammern <code>O(</code> … <code>)</code>, je eine Flanke mit eigenem Flankenmerker.',
  learn:'Flanken in Klammern kombinieren.',
  take:'Eine Flanke darf auch in einer Klammer stehen. So kombinierst du steigende und fallende Flanke desselben Signals.',
  vars:{ Tuer_offen:false, M_Auf:false, M_Zu:false, Hupe:false },
  timed: seq([[0.1, { Tuer_offen:true }, { Hupe:true }], [0.1, {}, { Hupe:false }], [0.1, { Tuer_offen:false }, { Hupe:true }], [0.1, {}, { Hupe:false }]]),
  ref:'O(\nU  Tuer_offen\nFP M_Auf\n)\nO(\nU  Tuer_offen\nFN M_Zu\n)\n=  Hupe', man:'flanken', must:['FP', 'FN', 'KLAMMER'],
  hint:'O( · U Tuer_offen · FP M_Auf · ) · O( · U Tuer_offen · FN M_Zu · ) · = Hupe',
  bind:['furnaceDoor=Tuer_offen', 'hornActive=Hupe'] });

defAwl({ id:'a4_boss', ch:4, title:'Boss: Die Schere', boss:true,
  story:'ARIA hat die Schere auf Dauerschnitt gestellt. Herr Brunner: „Kommt der Block, fährt die Schere einmal runter und unten wieder hoch, und mit dem Taster löst du von Hand einen Schnitt aus.“',
  brief:'Neuer Block an der Schere oder Taster Schnitt von Hand (je steigende Flanke) speichert einen Schnitt. Die Schere fährt ab, bis die Rückmeldung Schere unten den Schnitt zurücksetzt.',
  learn:'Mehrere Flanken, Speicher und Rückmeldung.',
  take:'Ein Befehl wird per Flanke gesetzt und durch die <b>Rückmeldung</b> (Schere unten) zurückgesetzt. So läuft jeder Schnitt genau einmal — egal wie lange das Startsignal ansteht.',
  vars:{ Block_da:false, S_Hand:false, Schere_unten:false, M_Block:false, M_Hand:false, Schneiden:false, Schere:false },
  timed: seq([[0.1, { Block_da:true }, { Schere:true }], [0.1, {}, { Schere:true }], [0.1, { Schere_unten:true }, { Schere:false }], [0.1, { Schere_unten:false }, { Schere:false }], [0.1, { Block_da:false }, { Schere:false }], [0.1, { S_Hand:true }, { Schere:true }], [0.1, { S_Hand:false, Schere_unten:true }, { Schere:false }], [0.1, { Schere_unten:false, Block_da:true }, { Schere:true }]]),
  ref:'NETWORK Schnitt automatisch\nU  Block_da\nFP M_Block\nS  Schneiden\n\nNETWORK Schnitt von Hand\nU  S_Hand\nFP M_Hand\nS  Schneiden\n\nNETWORK Ende des Schnitts\nU  Schere_unten\nR  Schneiden\n\nNETWORK Schere\nU  Schneiden\n=  Schere', man:'flanken', must:['FP', 'S', 'R'],
  wrong:['U  Block_da\nS  Schneiden\nU  S_Hand\nFP M_Hand\nS  Schneiden\nU  Schere_unten\nR  Schneiden\nU  Schneiden\n=  Schere'],
  hint:'Vier Netzwerke: zwei Flanken setzen, die Rückmeldung setzt zurück, dann der Ausgang.',
  bind:['shearDown=Schere', 'billetVisible=Block_da'] });
})();
