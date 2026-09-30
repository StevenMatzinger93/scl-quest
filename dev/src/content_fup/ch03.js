/* ===== FUP QUEST · KAPITEL 3 — Selbsthaltung und Verriegelung ===== */
(function(){
const seq = steps => [{ steps }];
const W_R = 'NETWORK Weiche nach rechts\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts => W1_nach_rechts;';

defFup({ id:'f3_selbst', ch:3, title:'Die Weiche läuft um',
  story:'Ein kurzer Druck auf die Weichentaste — und der Weichenantrieb soll so lange laufen, bis die Weiche ihre <b>Endlage</b> erreicht hat. Der Ausgang muss sich selbst halten.',
  brief:'Ein kurzer Druck auf die Taste rechts startet den Antrieb von Weiche 1 nach rechts. Er hält sich selbst, bis die Endlage rechts meldet.<br>Den Ausgang in die ODER-Box zurückführen.',
  learn:'Selbsthaltung im Funktionsplan.',
  take:'Bei der <b>Selbsthaltung</b> wird der Ausgang in die &gt;=1-Box zurückgeführt: Einmal 1, hält er sich selbst — bis die Abschaltbedingung hinter der ODER-Box ihn unterbricht.',
  vars:{ Taste_Rechts:false, W1_Endlage_rechts:false, W1_nach_rechts:false },
  timed: seq([[0,{ Taste_Rechts:true },{ W1_nach_rechts:true }],[0.1,{ Taste_Rechts:false },{ W1_nach_rechts:true }],[0.1,{},{ W1_nach_rechts:true }],[0.1,{ W1_Endlage_rechts:true },{ W1_nach_rechts:false }],[0.1,{},{ W1_nach_rechts:false }]]),
  ref: W_R, man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'&-Box: erster Eingang eine >=1-Box (Taste_Rechts, W1_nach_rechts), zweiter Eingang W1_Endlage_rechts negiert.',
  bind:['switch1Moving=W1_nach_rechts', 'switch1Right=W1_Endlage_rechts'] });

defFup({ id:'f3_signal_halt', ch:3, title:'Das Signal fällt',
  story:'Signal A soll Fahrt zeigen, bis der Fahrdienstleiter Halt drückt — oder bis der Zug ins Gleis einfährt. Dann fällt es <b>von selbst</b> auf Halt.',
  brief:'Signal A geht mit seiner Taste auf Fahrt und hält sich selbst. Es fällt auf Halt, sobald die Halt-Taste gedrückt oder Gleis 1 besetzt wird.',
  learn:'Selbsthaltung mit mehreren Abschaltbedingungen.',
  take:'Ein Signal, das sich über die Selbsthaltung hält, fällt bei <b>jeder</b> Abschaltbedingung auf Halt — auch durch den Zug selbst. So zeigt es nie Fahrt für den nächsten Zug, ohne neu gestellt zu werden.',
  vars:{ Taste_A:false, Taste_Halt:false, Gleis1_besetzt:false, Signal_A:false },
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false },{ Signal_A:true }],[0.1,{ Gleis1_besetzt:true },{ Signal_A:false }],[0.1,{ Gleis1_besetzt:false },{ Signal_A:false }],
    [0.1,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false, Taste_Halt:true },{ Signal_A:false }]]),
  ref:'NETWORK Signal A\n(Taste_A OR Signal_A) AND NOT Taste_Halt AND NOT Gleis1_besetzt => Signal_A;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'&-Box mit drei Eingängen: >=1-Box, zwei negierte Eingänge.',
  bind:['signalEntry=Signal_A', 'trackB=Gleis1_besetzt'] });

defFup({ id:'f3_einvorrang', ch:3, title:'Der Wecker',
  story:'Bei einer Meldung klingelt der Wecker am Stelltisch, bis jemand abstellt. Drückt man gleichzeitig „Wecker“ und „Abstellen“, soll der Wecker <b>weiterklingeln</b> — lieber einmal zu viel.',
  brief:'Der Wecker klingelt beim Auslösen und hält sich selbst, bis die Abstelltaste kommt. Kommen beide zugleich, klingelt er weiter (<b>Einschalten dominant</b>).',
  learn:'Ein-Vorrang: die Abschaltung nur im Haltezweig.',
  take:'Liegt die Abschaltung nur im <b>Haltezweig</b>, gewinnt beim gleichzeitigen Drücken das Einschalten (Ein-Vorrang). Für Warnungen sinnvoll, für Antriebe nie.',
  vars:{ Taste_Wecker:false, Taste_Ab:false, Wecker:false },
  timed: seq([[0,{ Taste_Wecker:true },{ Wecker:true }],[0.1,{ Taste_Wecker:false },{ Wecker:true }],[0.1,{ Taste_Wecker:true, Taste_Ab:true },{ Wecker:true }],[0.1,{ Taste_Wecker:false },{ Wecker:false }]]),
  ref:'NETWORK Wecker\nTaste_Wecker OR (Wecker AND NOT Taste_Ab) => Wecker;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'>=1-Box: erster Eingang Taste_Wecker, zweiter eine &-Box (Wecker, nicht Taste_Ab).',
  bind:['hornActive=Wecker'] });

defFup({ id:'f3_verriegelung', ch:3, title:'Nie in beide Richtungen',
  story:'ARIA hat versucht, beide Antriebsrichtungen von Weiche 1 gleichzeitig laufen zu lassen, bis der Motor durchbrennt. Jede Richtung sperrt deshalb die andere.',
  brief:'Die Tasten links/rechts starten den Antrieb von Weiche 1 in diese Richtung; er hält sich bis zur Endlage. Läuft eine Richtung, ist die andere gesperrt.',
  learn:'Gegenseitige Verriegelung.',
  take:'Jede Richtung bekommt einen negierten Eingang der Gegenrichtung. Läuft die eine, ist die andere gesperrt — erst wenn sie steht, darf umgekehrt werden.',
  vars:{ Taste_Links:false, Taste_Rechts:false, W1_Endlage_links:false, W1_Endlage_rechts:false, W1_nach_links:false, W1_nach_rechts:false },
  timed: seq([[0,{ Taste_Links:true },{ W1_nach_links:true, W1_nach_rechts:false }],[0.1,{ Taste_Links:false, Taste_Rechts:true },{ W1_nach_links:true, W1_nach_rechts:false }],
    [0.1,{ Taste_Rechts:false, W1_Endlage_links:true },{ W1_nach_links:false }],[0.1,{ Taste_Rechts:true, W1_Endlage_links:false },{ W1_nach_rechts:true, W1_nach_links:false }],[0.1,{ Taste_Rechts:false, Taste_Links:true },{ W1_nach_rechts:true, W1_nach_links:false }]]),
  ref:'NETWORK Weiche nach links\n(Taste_Links OR W1_nach_links) AND NOT W1_Endlage_links AND NOT W1_nach_rechts => W1_nach_links;\n\nNETWORK Weiche nach rechts\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;',
  man:'selbsthaltung', must:['PARALLEL','NC','NETWORKS'],
  hint:'Zwei gleich gebaute Netzwerke, jeweils mit dem negierten Ausgang der Gegenrichtung.',
  bind:['switch1Moving=W1_nach_links', 'switch1Right=W1_nach_rechts'] });

defFup({ id:'f3_selbst_dbg', ch:3, title:'Die Weiche bleibt stehen', debug:true,
  story:'Die Weiche läuft nur, solange jemand die Taste gedrückt hält — lässt man los, bleibt sie in der Mitte stehen. ARIA hat die Rückführung entfernt.',
  brief:'Der Antrieb läuft nur, solange die Taste gedrückt ist. Er soll sich selbst halten und bis zur Endlage rechts weiterlaufen.',
  learn:'Fehlende Selbsthaltung erkennen.',
  take:'Ohne Rückführung folgt der Ausgang direkt der Taste. Eine Weiche in Mittellage ist unbefahrbar — die Selbsthaltung ist hier Sicherheitsfunktion.',
  vars:{ Taste_Rechts:false, W1_Endlage_rechts:false, W1_nach_rechts:false },
  timed: seq([[0,{ Taste_Rechts:true },{ W1_nach_rechts:true }],[0.1,{ Taste_Rechts:false },{ W1_nach_rechts:true }],[0.1,{ W1_Endlage_rechts:true },{ W1_nach_rechts:false }]]),
  start:'NETWORK Weiche nach rechts\nTaste_Rechts AND NOT W1_Endlage_rechts => W1_nach_rechts;', ref: W_R, man:'selbsthaltung', must:['PARALLEL'],
  hint:'Aus dem Eingang Taste_Rechts eine >=1-Box machen und W1_nach_rechts als zweiten Eingang.',
  bind:['switch1Moving=W1_nach_rechts', 'switch1Right=W1_Endlage_rechts'] });

defFup({ id:'f3_zugfahrt', ch:3, title:'Der Zug fährt',
  story:'In der Simulation fährt ein Zug los, wenn Signal A Fahrt zeigt, und hält, wenn er im Zielgleis angekommen ist — auch wenn das Signal hinter ihm längst wieder Halt zeigt.',
  brief:'Zeigt Signal A Fahrt, fährt der Zug los und fährt weiter, auch wenn das Signal wieder Halt zeigt (Selbsthaltung) — bis er im Zielgleis angekommen ist.',
  learn:'Selbsthaltung für einen Vorgang, der länger dauert als sein Auslöser.',
  take:'Viele Vorgänge dauern länger als ihr Auslöser: Die Selbsthaltung überbrückt diese Zeit, bis eine Rückmeldung das Ende meldet.',
  vars:{ Signal_A:false, Zug_angekommen:false, Zug_faehrt:false },
  timed: seq([[0,{ Signal_A:true },{ Zug_faehrt:true }],[0.1,{ Signal_A:false },{ Zug_faehrt:true }],[0.1,{ Zug_angekommen:true },{ Zug_faehrt:false }],[0.1,{ Zug_angekommen:false },{ Zug_faehrt:false }]]),
  ref:'NETWORK Zugfahrt\n(Signal_A OR Zug_faehrt) AND NOT Zug_angekommen => Zug_faehrt;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'Wie die Weichenumstellung — Auslöser ist hier das Signal.',
  bind:['signalEntry=Signal_A', 'trainRunning=Zug_faehrt'] });

defFup({ id:'f3_verriegelung_dbg', ch:3, title:'Beide Richtungen zugleich', debug:true,
  story:'Der Weichenmotor raucht. Beim Umstellen laufen beide Richtungen gleichzeitig — ARIA hat bei einer Richtung die Verriegelung entfernt.',
  brief:'Beim Umstellen laufen beide Antriebsrichtungen gleichzeitig. Es darf immer nur <b>eine</b> Richtung laufen: Jede sperrt die andere.',
  learn:'Verriegelungen auf beiden Seiten prüfen.',
  take:'Eine Verriegelung muss <b>symmetrisch</b> sein: Jede Richtung sperrt die andere. Fehlt sie auf einer Seite, hilft die andere nichts.',
  vars:{ Taste_Links:false, Taste_Rechts:false, W1_Endlage_links:false, W1_Endlage_rechts:false, W1_nach_links:false, W1_nach_rechts:false },
  timed: seq([[0,{ Taste_Links:true },{ W1_nach_links:true }],[0.1,{ Taste_Links:false, Taste_Rechts:true },{ W1_nach_rechts:false }],[0.1,{ Taste_Rechts:false },{ W1_nach_links:true, W1_nach_rechts:false }]]),
  start:'NETWORK Weiche nach links\n(Taste_Links OR W1_nach_links) AND NOT W1_Endlage_links AND NOT W1_nach_rechts => W1_nach_links;\n\nNETWORK Weiche nach rechts\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts => W1_nach_rechts;',
  ref:'NETWORK Weiche nach links\n(Taste_Links OR W1_nach_links) AND NOT W1_Endlage_links AND NOT W1_nach_rechts => W1_nach_links;\n\nNETWORK Weiche nach rechts\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;',
  man:'selbsthaltung', must:['NC'],
  hint:'Vergleiche die beiden &-Boxen: Welcher fehlt ein Eingang?',
  bind:['switch1Moving=W1_nach_links', 'switch1Right=W1_nach_rechts'] });

defFup({ id:'f3_ausvorrang', ch:3, title:'Halt gewinnt',
  story:'Frau Gasser drückt gleichzeitig „Fahrt“ und „Halt“ — was zeigt das Signal? Bei Signalen muss immer <b>Halt</b> gewinnen.',
  brief:'Signal B geht mit seiner Taste auf Fahrt und hält sich selbst. Die Halt-Taste gewinnt immer: Sie liegt <b>hinter</b> der ODER-Box.',
  learn:'Aus-Vorrang bei der Selbsthaltung.',
  take:'Liegt die Abschaltung hinter der &gt;=1-Box, gewinnt sie immer (Aus-Vorrang). Für Signale und Antriebe ist das Pflicht.',
  vars:{ Taste_B:false, Taste_Halt:false, Signal_B:false },
  timed: seq([[0,{ Taste_B:true },{ Signal_B:true }],[0.1,{ Taste_Halt:true },{ Signal_B:false }],[0.1,{ Taste_B:false, Taste_Halt:false },{ Signal_B:false }],[0.1,{ Taste_B:true },{ Signal_B:true }],[0.1,{ Taste_B:false },{ Signal_B:true }]]),
  ref:'NETWORK Signal B\n(Taste_B OR Signal_B) AND NOT Taste_Halt => Signal_B;', man:'selbsthaltung', must:['PARALLEL','NC'],
  wrong:['NETWORK Signal B\nTaste_B OR (Signal_B AND NOT Taste_Halt) => Signal_B;'],
  hint:'&-Box mit >=1-Box und negierter Halt-Taste.',
  bind:['signalExit=Signal_B'] });

defFup({ id:'f3_schranke', ch:3, title:'Schranke auf, Schranke zu',
  story:'Der Schrankenantrieb hat zwei Richtungen: senken und heben. Jede läuft bis zu ihrer Endlage, und nie beide zugleich.',
  brief:'<b>NW 1:</b> Meldet ein Zug, senkt der Antrieb, bis der Endschalter unten meldet.<br><b>NW 2:</b> Ist der Zug weg, hebt er bis zum Endschalter oben.<br>Beide mit Selbsthaltung, gegenseitig gesperrt.',
  learn:'Selbsthaltung und Verriegelung an einem zweiten Antrieb.',
  take:'Das Muster „Selbsthaltung bis Endlage + Verriegelung der Gegenrichtung“ gilt für jeden Antrieb mit zwei Richtungen: Weiche, Schranke, Tor.',
  vars:{ Zug_meldet:false, Zug_weg:false, Unten:false, Oben:true, Senken:false, Heben:false },
  timed: seq([[0,{ Zug_meldet:true },{ Senken:true, Heben:false }],[0.1,{ Zug_meldet:false, Oben:false },{ Senken:true }],[0.1,{ Unten:true },{ Senken:false }],[0.1,{ Zug_weg:true },{ Heben:true }],[0.1,{ Zug_weg:false, Unten:false },{ Heben:true }],[0.1,{ Oben:true },{ Heben:false }]]),
  ref:'NETWORK Schranke senken\n(Zug_meldet OR Senken) AND NOT Unten AND NOT Heben => Senken;\n\nNETWORK Schranke heben\n(Zug_weg OR Heben) AND NOT Oben AND NOT Senken => Heben;', man:'selbsthaltung', must:['PARALLEL','NC','NETWORKS'],
  hint:'Zwei Netzwerke wie bei der Weiche.',
  bind:['crossingClosed=Senken', 'trainApproach=Zug_meldet'] });

defFup({ id:'f3_boss', ch:3, title:'Boss: Weiche unter Kontrolle', boss:true,
  story:'ARIA stellt Weiche 1 hin und her, während ein Zug einfahren will. Frau Gasser: „Die Weiche läuft sauber bis zur Endlage, nie in beide Richtungen — und das Signal fällt, sobald sie sich bewegt.“',
  brief:'<b>NW 1–2:</b> Weiche 1 nach links/rechts: Selbsthaltung bis zur Endlage, gegenseitig gesperrt.<br><b>NW 3:</b> Signal A mit Taste und Selbsthaltung; es fällt bei der Halt-Taste und solange die Weiche läuft.',
  learn:'Selbsthaltung, Verriegelung und Aus-Vorrang in einem Programm.',
  take:'Ein Signal über eine Weiche darf nie Fahrt zeigen, solange die Weiche läuft. Dieses Prinzip heisst im Stellwerk <b>Weichenverschluss</b> — du hast die einfachste Form gebaut.',
  vars:{ Taste_Links:false, Taste_Rechts:false, W1_Endlage_links:true, W1_Endlage_rechts:false, W1_nach_links:false, W1_nach_rechts:false, Taste_A:false, Taste_Halt:false, Signal_A:false },
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false, Taste_Rechts:true },{ W1_nach_rechts:true, Signal_A:false }],[0.1,{ Taste_Rechts:false, W1_Endlage_links:false },{ W1_nach_rechts:true, Signal_A:false }],
    [0.1,{ W1_Endlage_rechts:true },{ W1_nach_rechts:false }],[0.1,{ Taste_A:true },{ Signal_A:true }],[0.1,{ Taste_A:false, Taste_Links:true },{ W1_nach_links:true, Signal_A:false }],[0.1,{ Taste_Links:false, Taste_Rechts:true },{ W1_nach_rechts:false, W1_nach_links:true }]]),
  ref:'NETWORK Weiche nach links\n(Taste_Links OR W1_nach_links) AND NOT W1_Endlage_links AND NOT W1_nach_rechts => W1_nach_links;\n\nNETWORK Weiche nach rechts\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;\n\nNETWORK Signal A\n(Taste_A OR Signal_A) AND NOT Taste_Halt AND NOT W1_nach_links AND NOT W1_nach_rechts => Signal_A;',
  man:'selbsthaltung', must:['PARALLEL','NC','NETWORKS'],
  hint:'Die Weichennetzwerke kommen vor dem Signal — so fällt das Signal im selben Zyklus, in dem die Weiche anläuft.',
  bind:['switch1Moving=W1_nach_rechts', 'switch1Right=W1_Endlage_rechts', 'signalEntry=Signal_A'] });
})();
