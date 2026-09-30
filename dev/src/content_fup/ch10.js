/* ===== FUP QUEST · KAPITEL 10 — Fahrstrassen ===== */
(function(){
const seq = steps => [{ steps }];
const FEIND = 'NETWORK Fahrstrasse Gleis 1\nTaste_FS1 AND NOT FS2 => SR(FS1, Aufloesung);\n\nNETWORK Fahrstrasse Gleis 2\nTaste_FS2 AND NOT FS1 => SR(FS2, Aufloesung);';

defFup({ id:'f10_einstellen', ch:10, title:'Fahrstrasse einstellen',
  story:'Frau Gasser erklärt: „Eine <b>Fahrstrasse</b> ist der Weg eines Zuges durchs Stellwerk, und beim <b>Einstellen</b> laufen alle Weichen in die richtige Lage.“ Für Gleis 1 muss Weiche 1 nach <b>links</b> (gerade).',
  brief:'Die Fahrstrassentaste stellt die Fahrstrasse ein (SR-Box, Rücksetzen durch Auflösung).<br>Solange sie eingestellt ist und Weiche 1 nicht in der Endlage links liegt, läuft Weiche 1 nach links.',
  learn:'Fahrstrasse speichern und Weiche stellen.',
  take:'Die eingestellte Fahrstrasse ist ein <b>Speicher</b>. Solange sie besteht und die Weiche nicht in der richtigen Endlage ist, läuft der Weichenantrieb.',
  vars:{ Taste_FS:false, Aufloesung:false, FS_eingestellt:false, W1_Endlage_links:false, W1_nach_links:false },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true, W1_nach_links:true }],[0.1,{ Taste_FS:false },{ W1_nach_links:true }],[2,{ W1_Endlage_links:true },{ W1_nach_links:false, FS_eingestellt:true }],[0.1,{ Aufloesung:true },{ FS_eingestellt:false }]]),
  ref:'NETWORK Fahrstrasse einstellen\nTaste_FS => SR(FS_eingestellt, Aufloesung);\n\nNETWORK Weiche 1 stellen\nFS_eingestellt AND NOT W1_Endlage_links => W1_nach_links;', man:'fahrstrasse', must:['SR','NC'],
  hint:'NW 1: SR-Box. NW 2: &-Box mit negierter Endlage.',
  bind:['routeSet=FS_eingestellt', 'switch1Moving=W1_nach_links'] });

defFup({ id:'f10_sichern', ch:10, title:'Fahrstrasse sichern',
  story:'Eingestellt ist nicht gesichert. Erst wenn die Weiche in der Endlage liegt, die Schranke unten ist und das Zielgleis frei ist, gilt die Fahrstrasse als <b>gesichert</b>.',
  brief:'Fahrstrasse eingestellt, Weiche 1 in Endlage links, Schranke unten und Gleis 1 frei → Fahrstrasse gesichert speichern (SR-Box, Rücksetzen durch Auflösung).',
  learn:'Sicherungsbedingungen einer Fahrstrasse.',
  take:'<b>Sichern</b> heisst: Alle Bedingungen sind erfüllt und werden festgehalten. Erst eine gesicherte Fahrstrasse darf ein Signal auf Fahrt bringen.',
  vars:{ FS_eingestellt:false, W1_Endlage_links:false, Schranke_unten:false, Gleis1_frei:false, Aufloesung:false, FS_gesichert:false },
  timed: seq([[0,{ FS_eingestellt:true, Gleis1_frei:true },{ FS_gesichert:false }],[0.1,{ W1_Endlage_links:true },{ FS_gesichert:false }],[0.1,{ Schranke_unten:true },{ FS_gesichert:true }],[0.1,{ Gleis1_frei:false },{ FS_gesichert:true }],[0.1,{ Aufloesung:true },{ FS_gesichert:false }]]),
  ref:'NETWORK Fahrstrasse sichern\nFS_eingestellt AND W1_Endlage_links AND Schranke_unten AND Gleis1_frei => SR(FS_gesichert, Aufloesung);', man:'fahrstrasse', must:['SR','SERIES'],
  hint:'&-Box mit vier Eingängen vor einer SR-Box.',
  bind:['routeLocked=FS_gesichert', 'switch1Right=W1_Endlage_links', 'crossingClosed=Schranke_unten'] });

defFup({ id:'f10_signal', ch:10, title:'Signal auf Fahrt',
  story:'Jetzt darf Signal A Fahrt zeigen — aber nur, solange die Fahrstrasse gesichert ist und der Zug noch nicht in den Einfahrabschnitt gefahren ist.',
  brief:'Signal A zeigt Fahrt, wenn die Fahrstrasse gesichert ist, der Einfahrabschnitt nicht besetzt ist und keine Störung ansteht.',
  learn:'Signal abhängig von der gesicherten Fahrstrasse.',
  take:'Das Signal ist das <b>letzte</b> Glied: Es zeigt Fahrt nur mit gesicherter Fahrstrasse und fällt, sobald der Zug einfährt.',
  vars:{ FS_gesichert:false, Einfahrt_besetzt:false, Stoerung:false, Signal_A:false },
  tests: truth(['FS_gesichert','Einfahrt_besetzt','Stoerung'], e => ({ Signal_A: e.FS_gesichert && !e.Einfahrt_besetzt && !e.Stoerung })),
  ref:'NETWORK Signal A\nFS_gesichert AND NOT Einfahrt_besetzt AND NOT Stoerung => Signal_A;', man:'fahrstrasse', must:['SERIES','NC'],
  hint:'&-Box mit drei Eingängen, zwei negiert.',
  bind:['signalEntry=Signal_A', 'routeLocked=FS_gesichert', 'trackA=Einfahrt_besetzt'] });

defFup({ id:'f10_aufloesen', ch:10, title:'Die Zugschlussstelle',
  story:'Wenn der Zug den Einfahrabschnitt <b>verlassen</b> hat, ist die Fahrstrasse durchfahren und wird aufgelöst. Das Ende der Besetzung erkennst du an der fallenden Flanke.',
  brief:'<b>NW 1:</b> Wird der Einfahrabschnitt frei (fallende Flanke, N-Box), wird die Fahrstrasse aufgelöst.<br><b>NW 2:</b> Fahrstrassentaste stellt ein (SR-Box), die Auflösung setzt zurück.',
  learn:'Automatische Fahrstrassenauflösung mit N-Flanke.',
  take:'Die Auflösung ist ein <b>Ereignis</b>: „Zug hat den Abschnitt verlassen“ — eine fallende Flanke. Sie steht vor dem Speicher, damit sie im selben Zyklus wirkt.',
  vars:{ Einfahrt_besetzt:false, Taste_FS:false, Aufloesung:false, FS_eingestellt:false },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true }],[0.1,{ Taste_FS:false, Einfahrt_besetzt:true },{ FS_eingestellt:true, Aufloesung:false }],[0.1,{},{ FS_eingestellt:true }],[0.1,{ Einfahrt_besetzt:false },{ Aufloesung:true, FS_eingestellt:false }],[0.1,{},{ Aufloesung:false }]]),
  ref:'NETWORK Zugschluss\nN(Einfahrt_besetzt) => Aufloesung;\n\nNETWORK Fahrstrasse\nTaste_FS => SR(FS_eingestellt, Aufloesung);', man:'fahrstrasse', must:['EDGE_N','SR'],
  hint:'Die Zugschlussstelle kommt zuerst.',
  bind:['routeSet=FS_eingestellt', 'trackA=Einfahrt_besetzt'] });

defFup({ id:'f10_signal_dbg', ch:10, title:'Fahrt ohne Sicherung', debug:true,
  story:'Signal A zeigt Fahrt, während Weiche 1 noch umläuft. ARIA hat das Signal an die <b>eingestellte</b> statt an die <b>gesicherte</b> Fahrstrasse gehängt.',
  brief:'Das Signal darf nur mit <b>gesicherter</b> Fahrstrasse Fahrt zeigen.',
  learn:'Eingestellt und gesichert unterscheiden.',
  take:'„Eingestellt“ heisst: Die Weichen sind unterwegs. „Gesichert“ heisst: Alles liegt richtig und ist festgehalten. Nur das Zweite reicht für ein Signal.',
  vars:{ FS_eingestellt:false, FS_gesichert:false, Einfahrt_besetzt:false, Stoerung:false, Signal_A:false },
  tests:[[{ FS_eingestellt:true }, { Signal_A:false }], [{ FS_eingestellt:true, FS_gesichert:true }, { Signal_A:true }]],
  start:'NETWORK Signal A\nFS_eingestellt AND NOT Einfahrt_besetzt AND NOT Stoerung => Signal_A;', ref:'NETWORK Signal A\nFS_gesichert AND NOT Einfahrt_besetzt AND NOT Stoerung => Signal_A;', man:'fahrstrasse', must:['SERIES'],
  hint:'Den ersten Eingang der &-Box auf FS_gesichert ändern.',
  bind:['signalEntry=Signal_A', 'routeSet=FS_eingestellt', 'routeLocked=FS_gesichert'] });

defFup({ id:'f10_feind', ch:10, title:'Feindliche Fahrstrassen',
  story:'Nach Gleis 1 und nach Gleis 2 führen zwei Fahrstrassen über dieselbe Weiche. Sie sind <b>feindlich</b>: Nie dürfen beide gleichzeitig eingestellt sein.',
  brief:'Die Taste für Gleis 1 stellt Fahrstrasse 1 ein, die Taste für Gleis 2 Fahrstrasse 2 (je SR-Box, Rücksetzen durch Auflösung) — aber nur, wenn die andere nicht eingestellt ist.',
  learn:'Ausschluss feindlicher Fahrstrassen.',
  take:'Feindliche Fahrstrassen werden gegenseitig ausgeschlossen — wie die Verriegelung zweier Antriebsrichtungen, nur mit Speichern.',
  vars:{ Taste_FS1:false, Taste_FS2:false, Aufloesung:false, FS1:false, FS2:false },
  timed: seq([[0,{ Taste_FS1:true },{ FS1:true, FS2:false }],[0.1,{ Taste_FS1:false, Taste_FS2:true },{ FS1:true, FS2:false }],[0.1,{ Taste_FS2:false, Aufloesung:true },{ FS1:false }],[0.1,{ Aufloesung:false, Taste_FS2:true },{ FS2:true }],[0.1,{ Taste_FS2:false, Taste_FS1:true },{ FS1:false, FS2:true }]]),
  ref: FEIND, man:'fahrstrasse', must:['SR','NC'],
  hint:'Jede Fahrstrasse bekommt den negierten Speicher der anderen als Eingang.',
  bind:['routeSet=FS1', 'switch1Right=FS2'] });

defFup({ id:'f10_feind_dbg', ch:10, title:'Zwei Fahrstrassen auf einmal', debug:true,
  story:'Auf dem Stelltisch leuchten die Fahrstrassen zu Gleis 1 und Gleis 2 gleichzeitig, weil ARIA einen Ausschluss entfernt hat. Welcher Weg gilt jetzt?',
  brief:'Es darf immer nur eine der beiden Fahrstrassen bestehen.',
  learn:'Ausschlüsse auf beiden Seiten prüfen.',
  take:'Wie bei der Verriegelung: Der Ausschluss muss auf <b>beiden</b> Seiten stehen.',
  vars:{ Taste_FS1:false, Taste_FS2:false, Aufloesung:false, FS1:false, FS2:false },
  timed: seq([[0,{ Taste_FS2:true },{ FS2:true }],[0.1,{ Taste_FS2:false, Taste_FS1:true },{ FS1:false, FS2:true }]]),
  start:'NETWORK Fahrstrasse Gleis 1\nTaste_FS1 => SR(FS1, Aufloesung);\n\nNETWORK Fahrstrasse Gleis 2\nTaste_FS2 AND NOT FS1 => SR(FS2, Aufloesung);', ref: FEIND, man:'fahrstrasse', must:['NC'],
  hint:'NW 1: der Eingang Taste_FS1 braucht eine &-Box mit negiertem FS2.',
  bind:['routeSet=FS1', 'switch1Right=FS2'] });

defFup({ id:'f10_flankenschutz', ch:10, title:'Flankenschutz',
  story:'Fährt ein Zug nach Gleis 1, könnte ein Rangierwagen von Gleis 2 über Weiche 2 in seine Flanke rollen. Weiche 2 wird deshalb in die <b>Schutzlage</b> (gerade) gelegt — das nennt man Flankenschutz.',
  brief:'Besteht Fahrstrasse 1 und liegt Weiche 2 nicht gerade, läuft Weiche 2 nach gerade.<br>Fahrstrasse 1 gesichert: Fahrstrasse 1, Weiche 1 in Endlage links und Weiche 2 gerade.',
  learn:'Flankenschutz als zusätzliche Sicherungsbedingung.',
  take:'Zur Sicherung einer Fahrstrasse gehören auch Weichen, über die der Zug gar nicht fährt: Sie werden so gelegt, dass nichts in die Fahrstrasse hineinrollen kann.',
  vars:{ FS1:false, W2_gerade:false, W1_Endlage_links:false, W2_nach_gerade:false, FS1_gesichert:false },
  tests:[[{ FS1:true }, { W2_nach_gerade:true, FS1_gesichert:false }], [{ FS1:true, W2_gerade:true, W1_Endlage_links:true }, { W2_nach_gerade:false, FS1_gesichert:true }], [{ FS1:true, W1_Endlage_links:true }, { FS1_gesichert:false, W2_nach_gerade:true }], [{ W2_gerade:true, W1_Endlage_links:true }, { FS1_gesichert:false }]],
  ref:'NETWORK Flankenschutz W2\nFS1 AND NOT W2_gerade => W2_nach_gerade;\n\nNETWORK Sichern\nFS1 AND W1_Endlage_links AND W2_gerade => FS1_gesichert;', man:'fahrstrasse', must:['NC','SERIES'],
  hint:'Zwei &-Boxen.',
  bind:['switch2Moving=W2_nach_gerade', 'routeLocked=FS1_gesichert'] });

defFup({ id:'f10_automatik', ch:10, title:'Automatikbetrieb',
  story:'Nachts arbeitet das Stellwerk allein: Meldet sich ein Zug am Einschaltkontakt, wird die Fahrstrasse <b>automatisch</b> eingestellt — tagsüber drückt Frau Gasser die Taste.',
  brief:'Die Fahrstrasse wird eingestellt per Taste oder im Automatikbetrieb, wenn sich ein Zug meldet — nie bei Störung. SR-Box, Rücksetzen durch Auflösung.',
  learn:'Hand- und Automatikanforderung zusammenführen.',
  take:'Hand und Automatik sind zwei Wege zur selben Anforderung — eine &gt;=1-Box. Die Störung sperrt beide.',
  vars:{ Taste_FS:false, Automatik:false, Zug_meldet:false, Stoerung:false, Aufloesung:false, FS_eingestellt:false },
  timed: seq([[0,{ Zug_meldet:true },{ FS_eingestellt:false }],[0.1,{ Automatik:true },{ FS_eingestellt:true }],[0.1,{ Aufloesung:true, Zug_meldet:false },{ FS_eingestellt:false }],[0.1,{ Aufloesung:false, Stoerung:true, Taste_FS:true },{ FS_eingestellt:false }],[0.1,{ Stoerung:false },{ FS_eingestellt:true }]]),
  ref:'NETWORK Fahrstrasse einstellen\n(Taste_FS OR (Automatik AND Zug_meldet)) AND NOT Stoerung => SR(FS_eingestellt, Aufloesung);', man:'fahrstrasse', must:['SR','PARALLEL','NC'],
  hint:'&-Box: erster Eingang >=1-Box (Taste_FS und eine &-Box), zweiter Eingang negierte Störung.',
  bind:['routeSet=FS_eingestellt', 'trainApproach=Zug_meldet'] });

defFup({ id:'f10_final', ch:10, title:'Final Boss: Das Geisterstellwerk', boss:true, final:true,
  story:'ARIA hat das ganze Stellwerk übernommen: Weichen laufen unter Zügen, Signale zeigen Fahrt ins Nichts. Frau Gasser reisst das alte Programm heraus: „Alles neu: Fahrstrasse einstellen, sichern, Signal, Auflösung, Überwachung!“',
  brief:'<b>NW 1:</b> Einfahrabschnitt wird frei (N-Box) → Auflösung<br><b>NW 2:</b> Einstellen (SR) per Taste oder Automatik mit Zugmeldung, nie bei Störung<br><b>NW 3–4:</b> Weiche 1 nach links bis Endlage, Schranke zu<br><b>NW 5:</b> Sichern (SR): Endlage links, Schranke unten, Gleis 1 frei<br><b>NW 6:</b> Signal A<br><b>NW 7:</b> Weiche läuft 6 s → Störung (RS) bis Quittieren',
  learn:'Eine vollständige Fahrstrassensteuerung mit Überwachung.',
  take:'Einstellen, sichern, Signal, Auflösung, Überwachung: Du hast eine Fahrstrassensteuerung gezeichnet, wie sie im Kern jedes Stellwerks arbeitet. ARIA hat hier keinen Platz mehr.',
  vars:{ Einfahrt_besetzt:false, Aufloesung:false, Taste_FS:false, Automatik:false, Zug_meldet:false, Stoerung:false, FS_eingestellt:false, W1_Endlage_links:false, W1_nach_links:false,
    Schranke_zu:false, Schranke_unten:false, Gleis1_frei:true, FS_gesichert:false, Signal_A:false, Quittieren:false },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true, W1_nach_links:true, Schranke_zu:true, FS_gesichert:false, Signal_A:false }],[0.1,{ Taste_FS:false },{ W1_nach_links:true }],
    [2,{ W1_Endlage_links:true },{ W1_nach_links:false, FS_gesichert:false }],[0.1,{ Schranke_unten:true },{ FS_gesichert:true, Signal_A:true }],
    [0.1,{ Einfahrt_besetzt:true },{ Signal_A:false, FS_gesichert:true }],[0.1,{ Einfahrt_besetzt:false, Schranke_unten:false },{ FS_eingestellt:false, FS_gesichert:false, Schranke_zu:false, Signal_A:false }],
    [0.1,{ Automatik:true, Zug_meldet:true },{ FS_eingestellt:true, Schranke_zu:true }],[0.1,{ Zug_meldet:false, W1_Endlage_links:false },{ W1_nach_links:true }],
    [6.1,{},{ Stoerung:true }],[0.1,{ W1_Endlage_links:true, Schranke_unten:true },{ FS_gesichert:true, Signal_A:false, Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:false }],[0.1,{ Quittieren:false },{ Signal_A:true }]]),
  ref:'NETWORK Zugschluss\nN(Einfahrt_besetzt) => Aufloesung;\n\n' +
    'NETWORK Fahrstrasse einstellen\n(Taste_FS OR (Automatik AND Zug_meldet)) AND NOT Stoerung => SR(FS_eingestellt, Aufloesung);\n\n' +
    'NETWORK Weiche 1 stellen\nFS_eingestellt AND NOT W1_Endlage_links => W1_nach_links;\n\n' +
    'NETWORK Schranke\nFS_eingestellt => Schranke_zu;\n\n' +
    'NETWORK Fahrstrasse sichern\nFS_eingestellt AND W1_Endlage_links AND Schranke_unten AND Gleis1_frei => SR(FS_gesichert, Aufloesung);\n\n' +
    'NETWORK Signal A\nFS_gesichert AND NOT Einfahrt_besetzt AND NOT Stoerung => Signal_A;\n\n' +
    'NETWORK Weichenueberwachung\nW1_nach_links AND TON(T_W1, T#6S) => RS(Stoerung, Quittieren);',
  man:'fahrstrasse', must:['SR','RS','TON','EDGE_N','PARALLEL','NC'],
  hint:'Sieben Netzwerke — alle Teile hast du in diesem Kapitel schon gebaut.',
  hint2:'Die Zugschlussstelle steht ganz oben, damit die Auflösung im selben Zyklus wirkt.',
  bind:['routeSet=FS_eingestellt', 'routeLocked=FS_gesichert', 'switch1Moving=W1_nach_links', 'crossingClosed=Schranke_zu', 'signalEntry=Signal_A', 'trackA=Einfahrt_besetzt', 'faultActive=Stoerung', 'trainApproach=Zug_meldet'] });
})();
