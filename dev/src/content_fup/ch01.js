/* ===== FUP QUEST · KAPITEL 1 — Boxen und Zuweisung ===== */
(function(){
const FREE = v => ({ channel:'trackB', variable:v, map:{ 'true':false, 'false':true } });   // „frei“ → Belegungsanzeige

defFup({ id:'f1_signal', ch:1, title:'Das erste Signal',
  story:'Frau Gasser zeigt auf das Einfahrsignal A: „Seit ARIA im Stellwerk sitzt, zeigt es, was es will.“ Das Programm ist leer. Du fängst ganz einfach an: Die Taste auf dem Stelltisch stellt das Signal auf Fahrt.',
  brief:'Zeichne ein Netzwerk: Eingang <code>Taste_A</code> → Zuweisung <code>=</code> <code>Signal_A</code>.<br><b>Ziehen:</b> die Variable <code>Taste_A</code> aus der Liste auf den Eingang <b>??</b> ziehen, <code>Signal_A</code> auf die Zuweisung. <b>Oder tippen:</b> Eingang antippen, dann die Variable antippen.',
  learn:'Ein Netzwerk: Operand am Eingang, Zuweisung am Ausgang.',
  take:'Im Funktionsplan fliesst das Signal von <b>links nach rechts</b>. Rechts steht die <b>Zuweisung</b> <code>=</code>: Der Ausgang übernimmt in jedem Zyklus den Wert, der ankommt.',
  vars:{ Taste_A:false, Signal_A:false },
  tests:[[{ Taste_A:true }, { Signal_A:true }], [{ Taste_A:false }, { Signal_A:false }]],
  ref:'NETWORK Signal A\nTaste_A => Signal_A;', man:'grundlagen', must:['COIL'],
  hint:'Eingang ?? antippen → Taste_A anklicken. Zuweisung (rechts) antippen → Signal_A anklicken.',
  bind:['signalEntry=Signal_A'] });

defFup({ id:'f1_und', ch:1, title:'Nur bei freiem Gleis',
  story:'Das Signal zeigt Fahrt, obwohl auf Gleis 1 noch ein Güterwagen steht. Ein Signal darf nur Fahrt zeigen, wenn das Gleis dahinter <b>frei</b> ist.',
  brief:'<code>Signal_A</code> = <code>Taste_A</code> <b>UND</b> <code>Gleis1_frei</code>.<br>Den Eingang antippen und <b>&amp;</b> wählen (oder die &amp;-Box aus der Palette auf den Eingang ziehen) — so entsteht eine UND-Box mit zwei Eingängen.',
  learn:'Die UND-Box (&).',
  take:'Die <b>&amp;-Box</b> liefert 1, wenn <b>alle</b> Eingänge 1 sind. Fehlt eine Bedingung, bleibt der Ausgang 0 — genau das, was ein Signal braucht.',
  vars:{ Taste_A:false, Gleis1_frei:false, Signal_A:false },
  tests: truth(['Taste_A','Gleis1_frei'], e => ({ Signal_A: e.Taste_A && e.Gleis1_frei })),
  ref:'NETWORK Signal A\nTaste_A AND Gleis1_frei => Signal_A;', man:'grundlagen', must:['SERIES'],
  hint:'Erst Taste_A an den Eingang, dann „&“: Es entsteht ein zweiter Eingang für Gleis1_frei.',
  bind:['signalEntry=Signal_A', FREE('Gleis1_frei')] });

defFup({ id:'f1_bue_dbg', ch:1, title:'Die falsche Schranke', debug:true,
  story:'Der Bahnübergang schliesst, wenn jemand die Signaltaste drückt — aber nicht, wenn ein Zug kommt. ARIA hat den Eingang vertauscht.',
  brief:'<code>Schranke_zu</code> soll dem Einschaltkontakt <code>Zug_meldet</code> folgen.',
  learn:'Operanden an Eingängen prüfen.',
  take:'Bei der Fehlersuche zuerst die <b>Operanden</b> lesen: Stimmt der Name am Eingang mit dem Plan überein?',
  vars:{ Zug_meldet:false, Taste_A:false, Schranke_zu:false },
  tests:[[{ Zug_meldet:true }, { Schranke_zu:true }], [{ Taste_A:true }, { Schranke_zu:false }], [{}, { Schranke_zu:false }]],
  start:'NETWORK Bahnuebergang\nTaste_A => Schranke_zu;', ref:'NETWORK Bahnuebergang\nZug_meldet => Schranke_zu;', man:'grundlagen', must:['COIL'],
  hint:'Eingang antippen und die richtige Variable zuweisen.',
  bind:['crossingClosed=Schranke_zu', 'trainApproach=Zug_meldet'] });

defFup({ id:'f1_netzwerke', ch:1, title:'Zwei Signale',
  story:'Das Stellwerk hat zwei Signale: A für die Einfahrt, B für die Ausfahrt. Jedes bekommt sein eigenes <b>Netzwerk</b>.',
  brief:'<b>NW 1:</b> <code>Taste_A</code> und <code>Gleis1_frei</code> → <code>Signal_A</code><br><b>NW 2:</b> <code>Taste_B</code> und <code>Ausfahrt_frei</code> → <code>Signal_B</code><br>Ein neues Netzwerk legst du mit <b>+ Netzwerk</b> an.',
  learn:'Mehrere Netzwerke, eines pro Aufgabe.',
  take:'Ein Programm besteht aus <b>Netzwerken</b>. Jedes löst eine Aufgabe und hat einen Titel. Die SPS rechnet sie von oben nach unten, in jedem Zyklus.',
  vars:{ Taste_A:false, Gleis1_frei:false, Signal_A:false, Taste_B:false, Ausfahrt_frei:false, Signal_B:false },
  tests:[[{ Taste_A:true, Gleis1_frei:true }, { Signal_A:true, Signal_B:false }], [{ Taste_B:true, Ausfahrt_frei:true }, { Signal_A:false, Signal_B:true }], [{ Taste_A:true, Taste_B:true, Gleis1_frei:true }, { Signal_A:true, Signal_B:false }]],
  ref:'NETWORK Signal A\nTaste_A AND Gleis1_frei => Signal_A;\n\nNETWORK Signal B\nTaste_B AND Ausfahrt_frei => Signal_B;', man:'grundlagen', must:['NETWORKS','SERIES'],
  hint:'Zwei Netzwerke mit je einer &-Box.',
  bind:['signalEntry=Signal_A', 'signalExit=Signal_B'] });

defFup({ id:'f1_drei', ch:1, title:'Drei Bedingungen',
  story:'Frau Gasser ergänzt: „Und die Weiche muss in ihrer Endlage liegen — eine Weiche in der Mitte ist das Gefährlichste überhaupt.“',
  brief:'<code>Signal_A</code> = <code>Taste_A</code> und <code>Gleis1_frei</code> und <code>W1_Endlage</code>.<br>Eine &amp;-Box antippen → <b>+ Eingang</b> fügt einen dritten Eingang hinzu.',
  learn:'Boxen mit mehr als zwei Eingängen.',
  take:'Eine &amp;-Box kann beliebig viele Eingänge haben. Statt mehrere Boxen hintereinander zu setzen, erweitert man die Box.',
  vars:{ Taste_A:false, Gleis1_frei:false, W1_Endlage:false, Signal_A:false },
  tests: truth(['Taste_A','Gleis1_frei','W1_Endlage'], e => ({ Signal_A: e.Taste_A && e.Gleis1_frei && e.W1_Endlage })),
  ref:'NETWORK Signal A\nTaste_A AND Gleis1_frei AND W1_Endlage => Signal_A;', man:'grundlagen', must:['SERIES'],
  hint:'Die &-Box selbst antippen (Mitte) → + Eingang.',
  bind:['signalEntry=Signal_A', FREE('Gleis1_frei')] });

defFup({ id:'f1_zwei_ausgaenge', ch:1, title:'Signal und Melder',
  story:'Am Stelltisch soll eine grüne Lampe zeigen, dass Signal A auf Fahrt steht. Dieselbe Verknüpfung, zwei Ausgänge.',
  brief:'<code>Taste_A</code> und <code>Gleis1_frei</code> → <code>Signal_A</code> <b>und</b> <code>Melder_Gruen</code>.<br>Ausgang antippen → <b>+ Ausgang</b>.',
  learn:'Ein Ergebnis auf mehrere Ausgänge verteilen.',
  take:'Die Leitung nach einer Box darf sich verzweigen: Mehrere Zuweisungen bekommen denselben Wert.',
  vars:{ Taste_A:false, Gleis1_frei:false, Signal_A:false, Melder_Gruen:false },
  tests: truth(['Taste_A','Gleis1_frei'], e => ({ Signal_A: e.Taste_A && e.Gleis1_frei, Melder_Gruen: e.Taste_A && e.Gleis1_frei })),
  ref:'NETWORK Signal A\nTaste_A AND Gleis1_frei => Signal_A, Melder_Gruen;', man:'grundlagen', must:['SERIES','MULTI_OUT'],
  hint:'Zuweisung antippen → „+ Ausgang“ → Melder_Gruen.',
  bind:['signalEntry=Signal_A', 'lightGreen=Melder_Gruen'] });

defFup({ id:'f1_bue', ch:1, title:'Der Bahnübergang',
  story:'Kommt ein Zug, meldet der Einschaltkontakt. Dann müssen die Blinklichter angehen und die Schranken schliessen — gleichzeitig.',
  brief:'<code>Zug_meldet</code> → <code>Blinklicht</code> und <code>Schranke_zu</code>.',
  learn:'Ein Eingang, zwei Ausgänge.',
  take:'Mehrere Ausgänge am selben Signal ersparen doppelte Netzwerke — und damit doppelte Fehlerquellen.',
  vars:{ Zug_meldet:false, Blinklicht:false, Schranke_zu:false },
  tests:[[{ Zug_meldet:true }, { Blinklicht:true, Schranke_zu:true }], [{ Zug_meldet:false }, { Blinklicht:false, Schranke_zu:false }]],
  ref:'NETWORK Bahnuebergang\nZug_meldet => Blinklicht, Schranke_zu;', man:'grundlagen', must:['MULTI_OUT'],
  hint:'Eingang Zug_meldet, zwei Zuweisungen.',
  bind:['trainApproach=Zug_meldet', 'crossingLights=Blinklicht', 'crossingClosed=Schranke_zu'] });

defFup({ id:'f1_ausfahrt_dbg', ch:1, title:'Ausfahrt ohne Schranke', debug:true,
  story:'Signal B zeigt Fahrt, obwohl die Schranke noch offen ist. ARIA hat der &amp;-Box einen Eingang weggenommen.',
  brief:'<code>Signal_B</code> = <code>Taste_B</code> und <code>Ausfahrt_frei</code> und <code>Schranke_unten</code>.',
  learn:'Fehlende Bedingungen in einer UND-Box finden.',
  take:'Eine fehlende Bedingung macht ein Signal nicht falsch-rot, sondern <b>gefährlich grün</b>. Deshalb prüft man bei Signalen jede Bedingung einzeln.',
  vars:{ Taste_B:false, Ausfahrt_frei:false, Schranke_unten:false, Signal_B:false },
  tests: truth(['Taste_B','Ausfahrt_frei','Schranke_unten'], e => ({ Signal_B: e.Taste_B && e.Ausfahrt_frei && e.Schranke_unten })),
  start:'NETWORK Signal B\nTaste_B AND Ausfahrt_frei => Signal_B;', ref:'NETWORK Signal B\nTaste_B AND Ausfahrt_frei AND Schranke_unten => Signal_B;', man:'grundlagen', must:['SERIES'],
  hint:'&-Box antippen → + Eingang → Schranke_unten.',
  bind:['signalExit=Signal_B', 'crossingClosed=Schranke_unten'] });

defFup({ id:'f1_weiche', ch:1, title:'Weichen-Freigabe',
  story:'Die Weiche 1 darf nur umlaufen, wenn niemand darüber fährt: Gleis frei und kein Signal auf Fahrt über die Weiche. Frau Gasser gibt dir erst einmal die einfache Version.',
  brief:'<code>W1_Freigabe</code> = <code>Taste_W1</code> und <code>Weichengleis_frei</code> und <code>Signal_A_Halt</code>.',
  learn:'Freigabebedingungen als UND-Box.',
  take:'Freigaben im Stellwerk sind fast immer UND-Verknüpfungen: Erst wenn <b>alle</b> Sicherheitsbedingungen erfüllt sind, darf gehandelt werden.',
  vars:{ Taste_W1:false, Weichengleis_frei:false, Signal_A_Halt:false, W1_Freigabe:false },
  tests: truth(['Taste_W1','Weichengleis_frei','Signal_A_Halt'], e => ({ W1_Freigabe: e.Taste_W1 && e.Weichengleis_frei && e.Signal_A_Halt })),
  ref:'NETWORK Weiche 1 Freigabe\nTaste_W1 AND Weichengleis_frei AND Signal_A_Halt => W1_Freigabe;', man:'grundlagen', must:['SERIES'],
  hint:'Eine &-Box mit drei Eingängen.',
  bind:['switch1Moving=W1_Freigabe'] });

defFup({ id:'f1_boss', ch:1, title:'Boss: Der erste Stelltisch', boss:true,
  story:'ARIA lässt beide Signale gleichzeitig blinken und öffnet die Schranke vor einem Zug. Frau Gasser: „Drei Netzwerke, und das Stellwerk ist wieder unseres. Fürs Erste.“',
  brief:'<b>NW 1:</b> <code>Taste_A</code>, <code>Gleis1_frei</code>, <code>W1_Endlage</code> → <code>Signal_A</code> und <code>Melder_Gruen</code><br><b>NW 2:</b> <code>Zug_meldet</code> → <code>Blinklicht</code> und <code>Schranke_zu</code><br><b>NW 3:</b> <code>Taste_B</code>, <code>Ausfahrt_frei</code>, <code>Schranke_unten</code> → <code>Signal_B</code>',
  learn:'Mehrere Netzwerke mit UND-Boxen und mehreren Ausgängen.',
  take:'Ein Stelltisch ist eine Sammlung klarer Netzwerke: jedes für ein Signal oder ein Gerät, jede Bedingung sichtbar als Eingang einer Box.',
  vars:{ Taste_A:false, Gleis1_frei:false, W1_Endlage:false, Signal_A:false, Melder_Gruen:false, Zug_meldet:false, Blinklicht:false, Schranke_zu:false, Taste_B:false, Ausfahrt_frei:false, Schranke_unten:false, Signal_B:false },
  tests:[[{ Taste_A:true, Gleis1_frei:true, W1_Endlage:true }, { Signal_A:true, Melder_Gruen:true, Signal_B:false }],
    [{ Taste_A:true, Gleis1_frei:true }, { Signal_A:false, Melder_Gruen:false }],
    [{ Zug_meldet:true }, { Blinklicht:true, Schranke_zu:true, Signal_A:false }],
    [{ Taste_B:true, Ausfahrt_frei:true, Schranke_unten:true }, { Signal_B:true, Blinklicht:false }],
    [{ Taste_B:true, Ausfahrt_frei:true }, { Signal_B:false }]],
  ref:'NETWORK Signal A\nTaste_A AND Gleis1_frei AND W1_Endlage => Signal_A, Melder_Gruen;\n\nNETWORK Bahnuebergang\nZug_meldet => Blinklicht, Schranke_zu;\n\nNETWORK Signal B\nTaste_B AND Ausfahrt_frei AND Schranke_unten => Signal_B;',
  man:'grundlagen', must:['SERIES','MULTI_OUT','NETWORKS'],
  hint:'Drei Netzwerke — eines nach dem anderen, zwischendurch testen.',
  bind:['signalEntry=Signal_A', 'lightGreen=Melder_Gruen', 'trainApproach=Zug_meldet', 'crossingLights=Blinklicht', 'crossingClosed=Schranke_zu', 'signalExit=Signal_B'] });
})();
