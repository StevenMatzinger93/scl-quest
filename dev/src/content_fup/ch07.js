/* ===== FUP QUEST · KAPITEL 7 — Zeiten II: Takt, Laufzeit, Abläufe ===== */
(function(){
const seq = steps => [{ steps }];
const BLINK = 'NETWORK Takt\nNOT Impuls AND TON(T_Takt, T#500MS) => Impuls;\n\nNETWORK Umschalten\nImpuls XOR Blink => Blink;';
const LAUF = 'NETWORK Laufzeit ueberwachen\nW1_laeuft AND TON(T_W1, T#6S) => S Weichenstoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT W1_laeuft => R Weichenstoerung;';

defFup({ id:'f7_takt', ch:7, title:'Der Taktmerker',
  story:'Die Steuerung liefert einen fertigen Takt: <code>Takt_1Hz</code> wechselt jede halbe Sekunde zwischen 0 und 1. Das Blinklicht am Bahnübergang soll damit blinken, solange ein Zug meldet.',
  brief:'Solange ein Zug meldet, blinkt das Blinklicht am Bahnübergang im Takt des 1-Hz-Taktmerkers.',
  learn:'Blinken mit einem Taktmerker.',
  take:'Ein <b>Taktmerker</b> ist ein Signal, das regelmässig wechselt. In einer &amp;-Box mit einer Bedingung wird daraus ein Blinklicht.',
  vars:{ Zug_meldet:false, Takt_1Hz:false, Blinklicht:false },
  tests: truth(['Zug_meldet','Takt_1Hz'], e => ({ Blinklicht: e.Zug_meldet && e.Takt_1Hz })),
  ref:'NETWORK Blinklicht\nZug_meldet AND Takt_1Hz => Blinklicht;', man:'timer2', must:['SERIES'],
  hint:'Eine &-Box mit zwei Eingängen.',
  bind:['trainApproach=Zug_meldet', 'crossingLights=Blinklicht'] });

defFup({ id:'f7_blinker', ch:7, title:'Der eigene Taktgeber',
  story:'Das alte Stellwerk hat keinen Taktmerker. Du baust ihn selbst: Ein Timer startet sich immer wieder neu und liefert alle 0,5 s einen Impuls, eine XOR-Box macht daraus ein Blinksignal.',
  brief:'<b>NW 1:</b> Nicht Impuls → TON 500 ms → Impuls: Der Timer startet sich selbst neu.<br><b>NW 2:</b> Impuls XOR Blinksignal → Blinksignal.',
  learn:'Taktgeber aus TON und XOR.',
  take:'Der negierte eigene Ausgang startet den Timer nach jedem Impuls neu. Die XOR-Rückführung kippt bei jedem Impuls — fertig ist das Blinksignal.',
  vars:{ Impuls:false, Blink:false },
  timed: seq([[0,{},{ Blink:false }],[0.3,{},{ Blink:false }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:false }],[0.3,{},{ Blink:false }]]),
  ref: BLINK, man:'timer2', must:['TON','XOR','NC'],
  hint:'NW 1: negierter Eingang Impuls, dahinter die TON-Box. NW 2: X-Box.',
  bind:['crossingLights=Blink'] });

defFup({ id:'f7_laufzeit', ch:7, title:'Die klemmende Weiche',
  story:'Eine Weiche braucht normal 4 Sekunden zum Umlaufen. Braucht sie länger als <b>6 Sekunden</b>, klemmt etwas (Schnee, ein Stein, ARIA) und eine Störung muss gemeldet werden.',
  brief:'<b>NW 1:</b> Läuft Weiche 1 länger als <b>6 s</b> um (TON), wird die Weichenstörung gesetzt.<br><b>NW 2:</b> Quittieren setzt sie zurück, aber nur bei stehender Weiche.',
  learn:'Laufzeitüberwachung mit TON.',
  take:'Eine <b>Laufzeitüberwachung</b> misst, wie lange ein Vorgang dauert. Dauert er länger als erlaubt, wird eine Störung gespeichert.',
  vars:{ W1_laeuft:false, Quittieren:false, Weichenstoerung:false },
  timed: seq([[0,{ W1_laeuft:true },{ Weichenstoerung:false }],[4,{ W1_laeuft:false },{ Weichenstoerung:false }],[0.1,{ W1_laeuft:true },{}],[5,{},{ Weichenstoerung:false }],[1.1,{},{ Weichenstoerung:true }],[0.1,{ Quittieren:true },{ Weichenstoerung:true }],[0.1,{ W1_laeuft:false },{ Weichenstoerung:false }]]),
  ref: LAUF, man:'timer2', must:['TON','SET','RESET'],
  hint:'Die TON-Box startet bei jeder Umstellung neu.',
  bind:['switch1Moving=W1_laeuft', 'faultActive=Weichenstoerung'] });

defFup({ id:'f7_wechsel', ch:7, title:'Wechselblinker',
  story:'Am Andreaskreuz blinken zwei rote Lampen <b>abwechselnd</b>. Mit dem Blinksignal <code>Blink</code> ist das ganz einfach.',
  brief:'Solange ein Zug meldet, blinken die Lampen am Andreaskreuz abwechselnd: die linke bei Blinksignal 1, die rechte bei Blinksignal 0.',
  learn:'Gegentakt mit negiertem Eingang.',
  take:'Ein Signal und sein negiertes Gegenstück ergeben einen Gegentakt: Immer ist genau eine der beiden Lampen an.',
  vars:{ Zug_meldet:false, Blink:false, Lampe_links:false, Lampe_rechts:false },
  tests: truth(['Zug_meldet','Blink'], e => ({ Lampe_links: e.Zug_meldet && e.Blink, Lampe_rechts: e.Zug_meldet && !e.Blink })),
  ref:'NETWORK Lampe links\nZug_meldet AND Blink => Lampe_links;\n\nNETWORK Lampe rechts\nZug_meldet AND NOT Blink => Lampe_rechts;', man:'timer2', must:['NC','NETWORKS'],
  hint:'Zwei &-Boxen, eine mit negiertem Blink.',
  bind:['trainApproach=Zug_meldet', 'crossingLights=Lampe_links'] });

defFup({ id:'f7_blink_dbg', ch:7, title:'Dauerlicht statt Blinken', debug:true,
  story:'Das Blinklicht leuchtet dauernd. ARIA hat im Taktgeber einen Kreis entfernt — jetzt startet der Timer nie neu.',
  brief:'Das Blinklicht leuchtet dauernd. Das Blinksignal soll alle 0,5 s wechseln: Der Taktgeber-Timer muss sich selbst neu starten.',
  learn:'Selbstrücksetzenden Timer prüfen.',
  take:'Ohne negierten eigenen Ausgang bleibt der Taktimpuls nach dem ersten Ablauf dauerhaft 1. Die XOR-Rückführung kippt dann in jedem Zyklus — zu schnell, um zu sehen.',
  vars:{ Impuls:false, Blink:false },
  timed: seq([[0,{},{ Blink:false }],[0.3,{},{ Blink:false }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:true }],[0.3,{},{ Blink:false }]]),
  start:'NETWORK Takt\nImpuls OR TON(T_Takt, T#500MS) => Impuls;\n\nNETWORK Umschalten\nImpuls XOR Blink => Blink;', ref: BLINK, man:'timer2', must:['NC'],
  hint:'Im ersten Netzwerk: die >=1-Box per Boxtyp ändern … zur &-Box machen und -o| auf den Eingang Impuls ziehen.',
  bind:['crossingLights=Blink'] });

defFup({ id:'f7_raeumen', ch:7, title:'Räumzeit',
  story:'Nach dem Zug soll die Schranke erst öffnen, wenn der Übergang <b>2 Sekunden</b> lang frei war. Kommt vorher ein zweiter Zug, beginnt die Zeit neu.',
  brief:'Die Schranke öffnet erst, wenn der Bahnübergang <b>2 s</b> ohne Unterbruch frei war (TON). Wird er vorher wieder belegt, beginnt die Zeit neu.',
  learn:'TON als „lange genug frei“.',
  take:'„Lange genug frei“ ist eine Einschaltverzögerung auf „frei“. Jede kurze Unterbrechung startet die Zeit neu.',
  vars:{ BUE_frei:false, Schranke_auf:false },
  timed: seq([[0,{ BUE_frei:true },{ Schranke_auf:false }],[1.5,{ BUE_frei:false },{ Schranke_auf:false }],[0.1,{ BUE_frei:true },{}],[1.5,{},{ Schranke_auf:false }],[0.6,{},{ Schranke_auf:true }]]),
  ref:'NETWORK Raeumzeit\nBUE_frei AND TON(T_Raeum, T#2S) => Schranke_auf;', man:'timer2', must:['TON'],
  hint:'TON-Box hinter BUE_frei.',
  wrong:['NETWORK Raeumzeit\nBUE_frei AND TOF(T_Raeum, T#2S) => Schranke_auf;'],
  bind:['crossingClosed=BUE_frei'] });

defFup({ id:'f7_ueber_dbg', ch:7, title:'Die unbemerkte Störung', debug:true,
  story:'Eine klemmende Weiche wird nicht gemeldet, weil die Störung beim nächsten Zyklus schon wieder verschwindet. ARIA hat den Speicher durch eine einfache Zuweisung ersetzt.',
  brief:'Die Weichenstörung soll <b>gespeichert</b> bleiben, bis quittiert wird (bei stehender Weiche).',
  learn:'Überwachungen brauchen einen Speicher.',
  take:'Eine Laufzeitüberwachung ohne Speicher meldet nur, solange die Weiche läuft. Hört der Antrieb auf, ist die Meldung weg — und niemand erfährt davon.',
  vars:{ W1_laeuft:false, Quittieren:false, Weichenstoerung:false },
  timed: seq([[0,{ W1_laeuft:true },{}],[6.1,{},{ Weichenstoerung:true }],[0.1,{ W1_laeuft:false },{ Weichenstoerung:true }],[0.1,{ Quittieren:true },{ Weichenstoerung:false }]]),
  start:'NETWORK Laufzeit ueberwachen\nW1_laeuft AND TON(T_W1, T#6S) => Weichenstoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT W1_laeuft => R Weichenstoerung;', ref: LAUF, man:'timer2', must:['SET'],
  hint:'Die Zuweisung im ersten Netzwerk auf S stellen.',
  bind:['switch1Moving=W1_laeuft', 'faultActive=Weichenstoerung'] });

defFup({ id:'f7_vorlaeuten', ch:7, title:'Vorläuten',
  story:'Bevor die Schranke sinkt, läutet die Glocke <b>3 Sekunden</b> lang (Vorläuten). Erst danach senkt sich die Schranke, und die Glocke verstummt.',
  brief:'<b>NW 1:</b> Ein gemeldeter Zug setzt den Merker Vorläuten.<br><b>NW 2:</b> Nach <b>3 s</b> Vorläuten (TON): Schranke zu setzen, Vorläuten rücksetzen.<br><b>NW 3:</b> Während des Vorläutens läutet die Glocke.',
  learn:'Zeitgesteuerter Ablauf mit Speicher und TON.',
  take:'Speicher + Timer = Ablaufschritt: Der Speicher hält den Schritt, der Timer beendet ihn und setzt den nächsten.',
  vars:{ Zug_meldet:false, Laeuten:false, Schranke_zu:false, Glocke:false },
  timed: seq([[0,{ Zug_meldet:true },{ Glocke:true, Schranke_zu:false }],[0.1,{ Zug_meldet:false },{ Glocke:true }],[2,{},{ Schranke_zu:false }],[1,{},{ Schranke_zu:true, Glocke:false }]]),
  ref:'NETWORK Vorlaeuten starten\nZug_meldet => S Laeuten;\n\nNETWORK Vorlaeutzeit\nLaeuten AND TON(T_Laeuten, T#3S) => S Schranke_zu, R Laeuten;\n\nNETWORK Glocke\nLaeuten => Glocke;', man:'timer2', must:['TON','SET','RESET','MULTI_OUT'],
  hint:'NW 2 hat zwei Ausgänge: S und R.',
  bind:['trainApproach=Zug_meldet', 'crossingBell=Glocke', 'crossingClosed=Schranke_zu'] });

defFup({ id:'f7_zeitaufloesung', ch:7, title:'Zeitauflösung',
  story:'Frau Gasser stellt Signal A auf Fahrt — aber der Zug kommt nicht. Nach <b>10 Sekunden</b> ohne Zug soll das Signal von selbst auf Halt fallen.',
  brief:'<b>NW 1:</b> Die Taste setzt Signal A auf Fahrt.<br><b>NW 2:</b> Steht es <b>10 s</b> auf Fahrt (TON), fällt es auf Halt.<br><b>NW 3:</b> Wird Gleis 1 besetzt, fällt es sofort.',
  learn:'TON als Zeitgrenze für einen Zustand.',
  take:'Ein Timer mit dem eigenen Zustand als Eingang begrenzt, wie lange ein Zustand dauern darf. Sobald er zurückgesetzt ist, läuft der Timer wieder bei null an.',
  vars:{ Taste_A:false, Gleis1_besetzt:false, Signal_A:false },
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false },{ Signal_A:true }],[9,{},{ Signal_A:true }],[1.1,{},{ Signal_A:false }],[0.1,{},{ Signal_A:false }],[0.1,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false, Gleis1_besetzt:true },{ Signal_A:false }]]),
  ref:'NETWORK Signal stellen\nTaste_A => S Signal_A;\n\nNETWORK Zeitaufloesung\nSignal_A AND TON(T_Aufl, T#10S) => R Signal_A;\n\nNETWORK Zug faehrt ein\nGleis1_besetzt => R Signal_A;', man:'timer2', must:['TON','SET','RESET'],
  hint:'Drei Netzwerke: stellen, nach Zeit zurücksetzen, durch den Zug zurücksetzen.',
  bind:['signalEntry=Signal_A', 'trackB=Gleis1_besetzt'] });

defFup({ id:'f7_boss', ch:7, title:'Boss: Der Übergang im Takt', boss:true,
  story:'ARIA hat den Taktmerker gestohlen und die Weichenüberwachung abgeschaltet. Frau Gasser: „Dann bauen wir den Takt selbst — und alles, was daran hängt.“',
  brief:'<b>NW 1–2:</b> Taktgeber (TON 500 ms, XOR) → Blinksignal.<br><b>NW 3–4:</b> Bei Zugmeldung blinken die Kreuzlampen abwechselnd (links bei 1).<br><b>NW 5–6:</b> Weiche 1 läuft über 6 s → Weichenstörung; Quittieren nur bei Stillstand.',
  learn:'Taktgeber, Wechselblinker und Laufzeitüberwachung zusammen.',
  take:'Takt, Gegentakt, Überwachung: Mit wenigen Zeitboxen entstehen die Signalbilder, die man an jedem Bahnübergang sieht.',
  vars:{ Impuls:false, Blink:false, Zug_meldet:false, Lampe_links:false, Lampe_rechts:false, W1_laeuft:false, Quittieren:false, Weichenstoerung:false },
  timed: seq([[0,{ Zug_meldet:true, W1_laeuft:true },{ Lampe_links:false, Lampe_rechts:true }],[0.3,{},{ Lampe_rechts:true }],[0.3,{},{ Lampe_links:true, Lampe_rechts:false }],[0.3,{},{ Lampe_links:true }],[0.3,{},{ Lampe_links:true, Lampe_rechts:false }],[0.6,{},{ Lampe_links:false, Lampe_rechts:true }],
    [5,{},{ Weichenstoerung:true }],[0.1,{ W1_laeuft:false, Zug_meldet:false },{ Weichenstoerung:true, Lampe_links:false, Lampe_rechts:false }],[0.1,{ Quittieren:true },{ Weichenstoerung:false }]]),
  ref: BLINK + '\n\nNETWORK Lampe links\nZug_meldet AND Blink => Lampe_links;\n\nNETWORK Lampe rechts\nZug_meldet AND NOT Blink => Lampe_rechts;\n\n' + LAUF,
  man:'timer2', must:['TON','XOR','NC','SET','RESET'],
  hint:'Sechs Netzwerke. Der Taktgeber kommt zuerst.',
  bind:['trainApproach=Zug_meldet', 'crossingLights=Lampe_links', 'switch1Moving=W1_laeuft', 'faultActive=Weichenstoerung'] });
})();
