/* ===== FUP QUEST · KAPITEL 5 — Flanken ===== */
(function(){
const seq = steps => [{ steps }];
const TOGGLE = 'NETWORK Flanke\nP(Taste_W1) => Impuls;\n\nNETWORK Umschalten\nImpuls XOR W1_rechts => W1_rechts;';

defFup({ id:'f5_achse', ch:5, title:'Achsen zählen',
  story:'Am Zählpunkt vor der Einfahrt liegt ein Achszähler. Jede Achse, die darüberrollt, liefert einen Impuls — der aber viele Zyklen lang ansteht. Gezählt werden darf nur einmal pro Achse.',
  brief:'Jede Achse, die den Zählpunkt überrollt, soll genau <b>einmal</b> gezählt werden: <b>P-Box</b> auf den Achsimpuls → <b>INC</b> auf den Achszähler.<br>Eingang antippen → <b>P/N</b>; Zuweisung antippen → <b>Rechnen</b> → Box INC.',
  learn:'Die P-Box (steigende Flanke).',
  take:'Die <b>P-Box</b> liefert genau <b>einen Zyklus</b> lang 1, wenn ihr Operand von 0 auf 1 wechselt. So wird jede Achse genau einmal gezählt.',
  vars:{ Achse:false, Achsen:0 },
  timed: seq([[0,{ Achse:true },{ Achsen:1 }],[0.1,{},{ Achsen:1 }],[0.1,{ Achse:false },{ Achsen:1 }],[0.1,{ Achse:true },{ Achsen:2 }],[0.1,{},{ Achsen:2 }]]),
  ref:'NETWORK Achsen zaehlen\nP(Achse) => INC(Achsen);', man:'flanken', must:['EDGE_P','INC'],
  hint:'P-Box statt eines normalen Eingangs, am Ausgang die INC-Box.',
  bind:['axleCount=Achsen', 'trainApproach=Achse'] });

defFup({ id:'f5_rasend_dbg', ch:5, title:'Der rasende Achszähler', debug:true,
  story:'Ein Güterwagen mit vier Achsen fährt ein — und der Zähler zeigt 380. ARIA hat die Flanke entfernt.',
  brief:'Jede Achse am Zählpunkt soll genau <b>einmal</b> gezählt werden — derzeit zählt der Achszähler in jedem Zyklus weiter.',
  learn:'Fehlende Flanke erkennen.',
  take:'Ohne Flanke zählt INC in <b>jedem Zyklus</b>, solange das Signal ansteht. Bei Impulsen von Gebern gehört fast immer eine Flanke davor.',
  vars:{ Achse:false, Achsen:0 },
  timed: seq([[0,{ Achse:true },{ Achsen:1 }],[0.1,{},{ Achsen:1 }],[0.1,{ Achse:false },{ Achsen:1 }]]),
  start:'NETWORK Achsen zaehlen\nAchse => INC(Achsen);', ref:'NETWORK Achsen zaehlen\nP(Achse) => INC(Achsen);', man:'flanken', must:['EDGE_P'],
  hint:'Eingang antippen → P/N.',
  bind:['axleCount=Achsen'] });

defFup({ id:'f5_n', ch:5, title:'Der Zug hat den Übergang verlassen',
  story:'Der Ausschaltkontakt hinter dem Bahnübergang ist belegt, solange der Zug darüberfährt. Wenn das <b>letzte</b> Fahrzeug ihn verlässt, darf die Schranke öffnen.',
  brief:'<b>NW 1:</b> Meldet der Einschaltkontakt einen Zug, wird die Schranke geschlossen gesetzt (S).<br><b>NW 2:</b> Verlässt das letzte Fahrzeug den Ausschaltkontakt (<b>N-Box</b>), wird sie zurückgesetzt (R).',
  learn:'Die N-Box (fallende Flanke).',
  take:'Die <b>N-Box</b> meldet den Wechsel von 1 auf 0 — das <b>Ende</b> eines Signals. Typisch für „Zug ist vorbei“.',
  vars:{ Zug_meldet:false, Ausschaltkontakt:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_meldet:true },{ Schranke_zu:true }],[0.1,{ Zug_meldet:false, Ausschaltkontakt:true },{ Schranke_zu:true }],[0.1,{},{ Schranke_zu:true }],[0.1,{ Ausschaltkontakt:false },{ Schranke_zu:false }]]),
  ref:'NETWORK Schranke schliessen\nZug_meldet => S Schranke_zu;\n\nNETWORK Schranke oeffnen\nN(Ausschaltkontakt) => R Schranke_zu;', man:'flanken', must:['EDGE_N','SET','RESET'],
  hint:'P/N zweimal antippen schaltet von P auf N.',
  bind:['crossingClosed=Schranke_zu', 'trainApproach=Zug_meldet'] });

defFup({ id:'f5_stromstoss', ch:5, title:'Weiche per Tastendruck',
  story:'Auf dem Stelltisch gibt es für Weiche 1 nur eine Taste: Jeder Druck legt die Weiche <b>um</b> — gerade, abzweigend, gerade …',
  brief:'<b>NW 1:</b> P-Box auf die Weichentaste → Hilfsmerker für den Tastenimpuls<br><b>NW 2:</b> Tastenimpuls XOR Weiche liegt rechts → Weiche liegt rechts (kippt bei jedem Impuls)',
  learn:'Stromstoss-Schaltung mit P-Box und XOR.',
  take:'Eine XOR-Box mit dem eigenen Ausgang kippt den Zustand bei jedem Impuls: <code>Impuls XOR Q</code>. Die P-Box sorgt dafür, dass pro Tastendruck nur einmal gekippt wird.',
  vars:{ Taste_W1:false, Impuls:false, W1_rechts:false },
  timed: seq([[0,{ Taste_W1:true },{ W1_rechts:true }],[0.1,{},{ W1_rechts:true }],[0.1,{ Taste_W1:false },{ W1_rechts:true }],[0.1,{ Taste_W1:true },{ W1_rechts:false }],[0.1,{ Taste_W1:false },{ W1_rechts:false }]]),
  ref: TOGGLE, man:'flanken', must:['EDGE_P','XOR'],
  hint:'Die Flanke erst in einen Merker schreiben, dann im zweiten Netzwerk mit XOR verwenden.',
  bind:['switch1Right=W1_rechts'] });

defFup({ id:'f5_zugzaehlung', ch:5, title:'Züge pro Tag',
  story:'Die Betriebsleitung will wissen, wie viele Züge heute durchgefahren sind. Jeder Zug löst den Einschaltkontakt einmal aus — aber viele Sekunden lang.',
  brief:'<b>NW 1:</b> P-Box auf den Einschaltkontakt → INC des Zugzählers<br><b>NW 2:</b> Meldung „Neuer Tag“ → MOVE 0 in den Zugzähler',
  learn:'Ereignisse mit Flanke zählen und zurücksetzen.',
  take:'Zählen = Flanke + INC. Zurücksetzen = MOVE 0. Das untere Netzwerk gewinnt, falls beides im selben Zyklus passiert.',
  vars:{ Zug_meldet:false, Neuer_Tag:false, Zuege_heute:0 },
  timed: seq([[0,{ Zug_meldet:true },{ Zuege_heute:1 }],[0.1,{},{ Zuege_heute:1 }],[0.1,{ Zug_meldet:false },{}],[0.1,{ Zug_meldet:true },{ Zuege_heute:2 }],[0.1,{ Zug_meldet:false, Neuer_Tag:true },{ Zuege_heute:0 }],[0.1,{ Neuer_Tag:false, Zug_meldet:true },{ Zuege_heute:1 }]]),
  ref:'NETWORK Zuege zaehlen\nP(Zug_meldet) => INC(Zuege_heute);\n\nNETWORK Neuer Tag\nNeuer_Tag => MOVE(0, Zuege_heute);', man:'flanken', must:['EDGE_P','INC','MOVE'],
  hint:'Zwei Netzwerke: zählen und zurücksetzen.',
  bind:['displayValue=Zuege_heute', 'displayLabel:"ZÜGE HEUTE"', 'trainApproach=Zug_meldet'] });

defFup({ id:'f5_quit', ch:5, title:'Einmal quittieren',
  story:'Der Wärter lehnt sich auf die Quittiertaste. Damit quittiert er auch jede <b>neue</b> Störung sofort, ohne sie zu sehen. Quittieren soll nur beim <b>Drücken</b> wirken.',
  brief:'<b>NW 1:</b> Fehlermeldung Weiche 1 → Störung setzen (S)<br><b>NW 2:</b> P-Box auf die Quittiertaste und Fehlermeldung nicht mehr da → Störung zurücksetzen (R)',
  learn:'Flanke an einer Quittiertaste.',
  take:'Mit einer Flanke wirkt eine Taste nur im Moment des Drückens. Eine festgeklemmte Taste kann dann nichts mehr unbemerkt quittieren.',
  vars:{ W1_Fehler:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{ W1_Fehler:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false, Quittieren:true },{ Stoerung:false }],[0.1,{ W1_Fehler:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false },{ Stoerung:true }],[0.1,{ Quittieren:false },{ Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:false }]]),
  ref:'NETWORK Stoerung speichern\nW1_Fehler => S Stoerung;\n\nNETWORK Quittieren\nP(Quittieren) AND NOT W1_Fehler => R Stoerung;', man:'flanken', must:['EDGE_P','SET','RESET'],
  hint:'In NW 2 wird der Eingang Quittieren zur P-Box, dazu eine &-Box mit dem negierten Fehler.',
  bind:['faultActive=Stoerung'] });

defFup({ id:'f5_n_dbg', ch:5, title:'Die Schranke öffnet zu früh', debug:true,
  story:'Die Schranke geht auf, sobald die Lok den Ausschaltkontakt erreicht — mitten im Zug! ARIA hat die falsche Flanke gewählt.',
  brief:'Die Schranke darf erst öffnen, wenn der Zug den Ausschaltkontakt <b>verlassen</b> hat — also beim Ende des Signals, nicht bei dessen Beginn.',
  learn:'P- und N-Flanke unterscheiden.',
  take:'P = Beginn eines Signals (Lok kommt), N = Ende (letzter Wagen weg). Bei Sicherheitsfunktionen zählt meistens das Ende.',
  vars:{ Zug_meldet:false, Ausschaltkontakt:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_meldet:true },{ Schranke_zu:true }],[0.1,{ Zug_meldet:false, Ausschaltkontakt:true },{ Schranke_zu:true }],[0.1,{ Ausschaltkontakt:false },{ Schranke_zu:false }]]),
  start:'NETWORK Schranke schliessen\nZug_meldet => S Schranke_zu;\n\nNETWORK Schranke oeffnen\nP(Ausschaltkontakt) => R Schranke_zu;',
  ref:'NETWORK Schranke schliessen\nZug_meldet => S Schranke_zu;\n\nNETWORK Schranke oeffnen\nN(Ausschaltkontakt) => R Schranke_zu;', man:'flanken', must:['EDGE_N'],
  hint:'P-Box antippen → P/N (wechselt auf N).',
  bind:['crossingClosed=Schranke_zu', 'trainApproach=Zug_meldet'] });

defFup({ id:'f5_signalfall', ch:5, title:'Signal fällt beim Einfahren',
  story:'Signal A soll auf Halt fallen, sobald der Zug die Einfahrt <b>beginnt</b> — also im Moment, in dem das Gleis besetzt wird, nicht erst wenn es wieder frei ist.',
  brief:'<b>NW 1:</b> Taste für Signal A → Signal A setzen (S)<br><b>NW 2:</b> P-Box auf die Besetztmeldung von Gleis 1 → Signal A zurücksetzen (R)',
  learn:'Steigende Flanke als Ereignis „Zug fährt ein“.',
  take:'Eine Flanke macht aus einem Zustand (besetzt) ein Ereignis (wird besetzt). Danach kann das Signal neu gestellt werden, auch wenn das Gleis besetzt bleibt — zum Beispiel für eine Rangierfahrt.',
  vars:{ Taste_A:false, Gleis1_besetzt:false, Signal_A:false },
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false },{ Signal_A:true }],[0.1,{ Gleis1_besetzt:true },{ Signal_A:false }],[0.1,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false },{ Signal_A:true }]]),
  ref:'NETWORK Signal stellen\nTaste_A => S Signal_A;\n\nNETWORK Signal faellt\nP(Gleis1_besetzt) => R Signal_A;', man:'flanken', must:['EDGE_P','SET','RESET'],
  hint:'Ohne Flanke wäre das Signal gesperrt, solange das Gleis besetzt ist.',
  bind:['signalEntry=Signal_A', 'trackB=Gleis1_besetzt'] });

defFup({ id:'f5_toggle_dbg', ch:5, title:'Die zappelnde Weiche', debug:true,
  story:'Hält man die Weichentaste gedrückt, schlägt die Weiche in jedem Zyklus hin und her. ARIA hat die Flanke vor dem Umschalten entfernt.',
  brief:'Pro Druck auf die Weichentaste soll genau <b>ein</b> Umschalten erfolgen — im Netzwerk für den Tastenimpuls fehlt die Flanke.',
  learn:'Stromstoss nur mit Flanke.',
  take:'Ohne Flanke kippt die XOR-Rückführung in jedem Zyklus — die Weiche „zappelt“. Das kostet Antrieb und Nerven.',
  vars:{ Taste_W1:false, Impuls:false, W1_rechts:false },
  timed: seq([[0,{ Taste_W1:true },{ W1_rechts:true }],[0.1,{},{ W1_rechts:true }],[0.1,{},{ W1_rechts:true }],[0.1,{ Taste_W1:false },{ W1_rechts:true }]]),
  start:'NETWORK Flanke\nTaste_W1 => Impuls;\n\nNETWORK Umschalten\nImpuls XOR W1_rechts => W1_rechts;', ref: TOGGLE, man:'flanken', must:['EDGE_P'],
  hint:'Im ersten Netzwerk fehlt die P-Box.',
  bind:['switch1Right=W1_rechts'] });

defFup({ id:'f5_boss', ch:5, title:'Boss: Der Zählpunkt', boss:true,
  story:'ARIA zählt Achsen doppelt, schaltet Weichen im Dauertakt und öffnet die Schranke vor dem letzten Wagen. Frau Gasser: „Flanken. Überall, wo ein Ereignis gemeint ist.“',
  brief:'<b>NW 1:</b> P-Box auf den Achsimpuls → INC des Achszählers<br><b>NW 2:</b> P-Box auf die Weichentaste → Hilfsmerker für den Tastenimpuls<br><b>NW 3:</b> Tastenimpuls XOR Weiche liegt rechts → Weiche liegt rechts<br><b>NW 4:</b> Einschaltkontakt meldet Zug → Schranke schliessen (S)<br><b>NW 5:</b> N-Box auf den Ausschaltkontakt → Schranke zurücksetzen (R)',
  learn:'P- und N-Flanken für Zählen, Umschalten und Freigeben.',
  take:'Überall, wo ein Ereignis gemeint ist — eine Achse, ein Tastendruck, das Ende eines Zuges —, gehört eine Flanke hin. Zustände (besetzt, gedrückt) und Ereignisse (wird besetzt, wird gedrückt) sauber zu trennen, ist das halbe Stellwerk.',
  vars:{ Achse:false, Achsen:0, Taste_W1:false, Impuls:false, W1_rechts:false, Zug_meldet:false, Ausschaltkontakt:false, Schranke_zu:false },
  timed: seq([[0,{ Achse:true, Zug_meldet:true },{ Achsen:1, Schranke_zu:true }],[0.1,{ Achse:false },{ Achsen:1 }],[0.1,{ Achse:true, Zug_meldet:false, Ausschaltkontakt:true },{ Achsen:2, Schranke_zu:true }],
    [0.1,{ Achse:false, Ausschaltkontakt:false },{ Schranke_zu:false }],[0.1,{ Taste_W1:true },{ W1_rechts:true }],[0.1,{},{ W1_rechts:true }],[0.1,{ Taste_W1:false },{}],[0.1,{ Taste_W1:true },{ W1_rechts:false }]]),
  ref:'NETWORK Achsen zaehlen\nP(Achse) => INC(Achsen);\n\n' + TOGGLE + '\n\nNETWORK Schranke schliessen\nZug_meldet => S Schranke_zu;\n\nNETWORK Schranke oeffnen\nN(Ausschaltkontakt) => R Schranke_zu;',
  man:'flanken', must:['EDGE_P','EDGE_N','XOR','INC'],
  hint:'Fünf Netzwerke — alles schon einmal gebaut.',
  bind:['axleCount=Achsen', 'switch1Right=W1_rechts', 'crossingClosed=Schranke_zu', 'trainApproach=Zug_meldet'] });
})();
