/* ===== KOP QUEST · KAPITEL 3 — Selbsthaltung, Vorrang, Verriegelung ===== */
(function(){
// Zyklus für Zyklus: [dt, Eingänge, erwartet]
const seq = steps => [{ steps }];
defKop({ id:'k3_selbst', ch:3, title:'Die Selbsthaltung',
  story:'Der Start-Taster federt zurück — und die Bahn steht sofort wieder. „Der Antrieb muss sich selbst halten“, erklärt der Werkmeister und zeichnet einen Kontakt parallel zum Taster: den Antrieb selbst.',
  brief:'<code>Antrieb</code> := (<code>S_Start</code> oder <code>Antrieb</code>) und nicht <code>S_Stopp</code>.<br>Nach dem Loslassen von S_Start läuft der Antrieb weiter, bis S_Stopp gedrückt wird.',
  learn:'Selbsthaltung: Die Spule hält sich über ihren eigenen Kontakt.',
  take:'In der <b>Selbsthaltung</b> liegt ein Kontakt der Spule parallel zum Einschalt-Taster. Einmal eingeschaltet, hält sich die Spule selbst — bis der Stopp-Öffner den Pfad unterbricht.',
  vars:{ S_Start:false, S_Stopp:false, Antrieb:false },
  timed: seq([[0,{},{Antrieb:false}],[0.1,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false},{Antrieb:true}],[0.5,{},{Antrieb:true}],[0.1,{S_Stopp:true},{Antrieb:false}],[0.1,{S_Stopp:false},{Antrieb:false}],[0.1,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false},{Antrieb:true}]]),
  ref:'NETWORK Antrieb Selbsthaltung\n(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'Parallel zu S_Start liegt ein Schliesser mit der Variable Antrieb.',
  hint2:'S_Start antippen → Parallelzweig → Antrieb. Dahinter S_Stopp als Öffner.',
  bind:['motorOn=Antrieb'] });

defKop({ id:'k3_ausvorrang', ch:3, title:'Aus hat Vorrang',
  story:'Was passiert, wenn jemand Start und Stopp gleichzeitig drückt? Bei einer Seilbahn muss die Antwort immer sein: Stillstand. Aus hat Vorrang.',
  brief:'Baue die Selbsthaltung für <code>Beleuchtung</code> mit <b>Aus-Vorrang</b>: (<code>S_Ein</code> oder <code>Beleuchtung</code>) und nicht <code>S_Aus</code>.<br>Werden beide Taster gleichzeitig gedrückt, bleibt die Beleuchtung <b>aus</b>.',
  learn:'Aus-Vorrang: Der Stopp-Öffner liegt in Reihe hinter dem ganzen Parallelzweig.',
  take:'Beim <b>Aus-Vorrang</b> unterbricht der Stopp-Kontakt auch den Einschalt-Zweig. Sicherheitsfunktionen (Antriebe) brauchen immer Aus-Vorrang.',
  vars:{ S_Ein:false, S_Aus:false, Beleuchtung:false },
  timed: seq([[0,{S_Ein:true, S_Aus:true},{Beleuchtung:false}],[0.1,{S_Aus:false},{Beleuchtung:true}],[0.1,{S_Ein:false},{Beleuchtung:true}],[0.1,{S_Ein:true, S_Aus:true},{Beleuchtung:false}],[0.1,{S_Ein:false, S_Aus:false},{Beleuchtung:false}]]),
  ref:'NETWORK Beleuchtung\n(S_Ein OR Beleuchtung) AND NOT S_Aus => Beleuchtung;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'Der Öffner S_Aus muss hinter dem Parallelzweig liegen — nicht im Zweig.',
  bind:['lightsOn=Beleuchtung'] });

defKop({ id:'k3_einvorrang', ch:3, title:'Ein-Vorrang für die Hupe',
  story:'Bei der Sturmwarnung darf die Warnhupe durch nichts abgewürgt werden. Wird Ein und Aus gleichzeitig gedrückt, soll sie tönen: Ein-Vorrang.',
  brief:'<code>Warnhupe</code> := <code>S_Ein</code> oder (<code>Warnhupe</code> und nicht <code>S_Aus</code>).<br>Beide Taster gleichzeitig → Hupe <b>an</b>.',
  learn:'Ein-Vorrang: Der Stopp-Öffner liegt nur im Halte-Zweig.',
  take:'Beim <b>Ein-Vorrang</b> liegt der Aus-Öffner nur im Selbsthalte-Zweig. Der Ein-Taster wirkt immer. Für Warnungen kann das sinnvoll sein, für Antriebe nie.',
  vars:{ S_Ein:false, S_Aus:false, Warnhupe:false },
  timed: seq([[0,{S_Ein:true, S_Aus:true},{Warnhupe:true}],[0.1,{S_Ein:false, S_Aus:false},{Warnhupe:true}],[0.1,{S_Aus:true},{Warnhupe:false}],[0.1,{S_Aus:false},{Warnhupe:false}],[0.1,{S_Ein:true},{Warnhupe:true}]]),
  ref:'NETWORK Warnhupe\nS_Ein OR (Warnhupe AND NOT S_Aus) => Warnhupe;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'Oberer Zweig: nur S_Ein. Unterer Zweig: Warnhupe und dahinter S_Aus als Öffner.',
  bind:['hornActive=Warnhupe'] });

defKop({ id:'k3_notaus', ch:3, title:'Selbsthaltung mit Not-Halt',
  story:'Die Selbsthaltung funktioniert — aber der Not-Halt fehlt. Ein Druck auf den roten Pilz muss den Antrieb abschalten und darf ihn nicht wieder anlaufen lassen, wenn er entriegelt wird.',
  brief:'<code>Antrieb</code> := (<code>S_Start</code> oder <code>Antrieb</code>) und nicht <code>S_Stopp</code> und <code>Not_Halt_OK</code>.',
  learn:'Weitere Abschaltbedingungen in Reihe hinter der Selbsthaltung.',
  take:'Jede Abschaltbedingung liegt <b>in Reihe hinter</b> dem Selbsthaltezweig. Nach dem Entriegeln des Not-Halts läuft nichts von selbst an — neu starten muss ein Mensch.',
  vars:{ S_Start:false, S_Stopp:false, Not_Halt_OK:true, Antrieb:false },
  timed: seq([[0,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false},{Antrieb:true}],[0.1,{Not_Halt_OK:false},{Antrieb:false}],[0.1,{Not_Halt_OK:true},{Antrieb:false}],[0.1,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false, S_Stopp:true},{Antrieb:false}]]),
  ref:'NETWORK Antrieb\n(S_Start OR Antrieb) AND NOT S_Stopp AND Not_Halt_OK => Antrieb;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'Hinter den Öffner S_Stopp kommt noch Not_Halt_OK als Schliesser.',
  bind:['motorOn=Antrieb','chainStop=Not_Halt_OK'] });

defKop({ id:'k3_selbst_dbg', ch:3, title:'Die vergessene Selbsthaltung', debug:true,
  story:'Die Stationsbeleuchtung geht nur an, solange jemand den Taster gedrückt hält. ARIA hat den Haltekontakt entfernt.',
  brief:'Die <code>Beleuchtung</code> soll sich nach <code>S_Ein</code> selbst halten, bis <code>S_Aus</code> gedrückt wird (Aus-Vorrang).',
  learn:'Fehlenden Selbsthaltekontakt ergänzen.',
  take:'Ohne Selbsthalte-Kontakt ist eine Spule nur so lange an wie der Taster. Der Haltekontakt trägt den Namen der Spule selbst.',
  vars:{ S_Ein:false, S_Aus:false, Beleuchtung:false },
  timed: seq([[0,{S_Ein:true},{Beleuchtung:true}],[0.1,{S_Ein:false},{Beleuchtung:true}],[0.1,{S_Aus:true},{Beleuchtung:false}],[0.1,{S_Aus:false},{Beleuchtung:false}]]),
  start:'NETWORK Beleuchtung\nS_Ein AND NOT S_Aus => Beleuchtung;', ref:'NETWORK Beleuchtung\n(S_Ein OR Beleuchtung) AND NOT S_Aus => Beleuchtung;', man:'selbsthaltung', must:['PARALLEL'],
  hint:'Parallel zu S_Ein fehlt ein Kontakt.',
  bind:['lightsOn=Beleuchtung'] });

defKop({ id:'k3_verriegelung', ch:3, title:'Berg oder Tal',
  story:'Die Gratbahn kann bergwärts und talwärts fahren — aber nie beides zugleich. ARIA würde genau das versuchen. Zwei Selbsthaltungen, die sich gegenseitig sperren: die Verriegelung.',
  brief:'<b>NW 1:</b> <code>Fahrt_Berg</code> := (<code>S_Berg</code> oder <code>Fahrt_Berg</code>) und nicht <code>S_Stopp</code> und nicht <code>Fahrt_Tal</code><br><b>NW 2:</b> <code>Fahrt_Tal</code> := (<code>S_Tal</code> oder <code>Fahrt_Tal</code>) und nicht <code>S_Stopp</code> und nicht <code>Fahrt_Berg</code>',
  learn:'Gegenseitige Verriegelung zweier Selbsthaltungen.',
  take:'Bei der <b>Verriegelung</b> liegt ein Öffner der jeweils anderen Spule im Strompfad. Läuft die eine Richtung, kann die andere nicht einschalten.',
  vars:{ S_Berg:false, S_Tal:false, S_Stopp:false, Fahrt_Berg:false, Fahrt_Tal:false },
  timed: seq([[0,{S_Berg:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Berg:false},{Fahrt_Berg:true}],[0.1,{S_Tal:true},{Fahrt_Berg:true, Fahrt_Tal:false}],[0.1,{S_Tal:false, S_Stopp:true},{Fahrt_Berg:false, Fahrt_Tal:false}],[0.1,{S_Stopp:false, S_Tal:true},{Fahrt_Tal:true, Fahrt_Berg:false}],[0.1,{S_Tal:false, S_Berg:true},{Fahrt_Tal:true, Fahrt_Berg:false}]]),
  ref:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Fahrt Tal\n(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND NOT Fahrt_Berg => Fahrt_Tal;', man:'selbsthaltung', must:['NETWORKS','NC','PARALLEL'],
  hint:'Zwei Selbsthaltungen. In jede kommt zusätzlich ein Öffner der anderen Spule.',
  bind:['motorOn=Fahrt_Berg','motorDir=Fahrt_Berg'] });

defKop({ id:'k3_richtung', ch:3, title:'Antrieb und Richtung',
  story:'Die Verriegelung steht. Jetzt muss der Antrieb laufen, sobald eine Richtung aktiv ist, und die Richtungsvorgabe an den Umrichter gehen.',
  brief:'Übernimm die beiden verriegelten Selbsthaltungen und ergänze:<br><b>NW 3:</b> <code>Antrieb</code> := <code>Fahrt_Berg</code> oder <code>Fahrt_Tal</code><br><b>NW 4:</b> <code>Richtung_Berg</code> := <code>Fahrt_Berg</code>',
  learn:'Merker (Fahrt_Berg/Tal) weiterverwenden.',
  take:'Zwischenergebnisse wie <code>Fahrt_Berg</code> heissen <b>Merker</b>. Sie werden in weiteren Netzwerken als Kontakte abgefragt.',
  vars:{ S_Berg:false, S_Tal:false, S_Stopp:false, Fahrt_Berg:false, Fahrt_Tal:false, Antrieb:false, Richtung_Berg:false },
  timed: seq([[0,{S_Tal:true},{Antrieb:true, Richtung_Berg:false}],[0.1,{S_Tal:false},{Antrieb:true, Fahrt_Tal:true}],[0.1,{S_Stopp:true},{Antrieb:false}],[0.1,{S_Stopp:false, S_Berg:true},{Antrieb:true, Richtung_Berg:true}],[0.1,{S_Berg:false},{Antrieb:true, Richtung_Berg:true}]]),
  start:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Fahrt Tal\n(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND NOT Fahrt_Berg => Fahrt_Tal;',
  ref:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Fahrt Tal\n(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND NOT Fahrt_Berg => Fahrt_Tal;\n\nNETWORK Antrieb\nFahrt_Berg OR Fahrt_Tal => Antrieb;\n\nNETWORK Richtung\nFahrt_Berg => Richtung_Berg;', man:'selbsthaltung', must:['NETWORKS'],
  hint:'Zwei neue Netzwerke unten anhängen.',
  bind:['motorOn=Antrieb','motorDir=Richtung_Berg'] });

defKop({ id:'k3_verriegelung_dbg', ch:3, title:'Beide Richtungen', debug:true,
  story:'Die Richtungsschütze knallen gleichzeitig ein — ein Kurzschluss im Umrichter droht. ARIA hat in einem Netzwerk die Verriegelung entfernt.',
  brief:'Beide Richtungen müssen sich gegenseitig verriegeln. Finde das Netzwerk ohne Verriegelung und ergänze sie.',
  learn:'Fehlende Verriegelung finden.',
  take:'Eine Verriegelung wirkt nur, wenn <b>beide</b> Netzwerke den Öffner der Gegenrichtung enthalten.',
  vars:{ S_Berg:false, S_Tal:false, S_Stopp:false, Fahrt_Berg:false, Fahrt_Tal:false },
  timed: seq([[0,{S_Tal:true},{Fahrt_Tal:true}],[0.1,{S_Tal:false},{Fahrt_Tal:true}],[0.1,{S_Berg:true},{Fahrt_Berg:false, Fahrt_Tal:true}],[0.1,{S_Berg:false, S_Stopp:true},{Fahrt_Tal:false}],[0.1,{S_Stopp:false, S_Berg:true},{Fahrt_Berg:true}],[0.1,{S_Berg:false, S_Tal:true},{Fahrt_Berg:true, Fahrt_Tal:false}]]),
  start:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp => Fahrt_Berg;\n\nNETWORK Fahrt Tal\n(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND NOT Fahrt_Berg => Fahrt_Tal;',
  ref:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Fahrt Tal\n(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND NOT Fahrt_Berg => Fahrt_Tal;', man:'selbsthaltung',
  hint:'Vergleiche die beiden Netzwerke Kontakt für Kontakt.',
  bind:['motorOn=Fahrt_Berg','motorDir=Fahrt_Berg'] });

defKop({ id:'k3_tuer', ch:3, title:'Tür mit Selbsthaltung',
  story:'Die Kabinentür soll auf einen kurzen Tastendruck ganz öffnen und offen bleiben — bis „Tür zu“ gedrückt wird oder der Antrieb anläuft.',
  brief:'<code>Tuer_Auf</code> := (<code>S_Tuer_Auf</code> oder <code>Tuer_Auf</code>) und nicht <code>S_Tuer_Zu</code> und nicht <code>Antrieb</code> und <code>Kabine_da</code>.',
  learn:'Selbsthaltung mit mehreren Abschaltbedingungen.',
  take:'Alle Bedingungen, die die Tür schliessen sollen, liegen als Öffner (oder Schliesser für „muss erfüllt sein“) in Reihe hinter der Selbsthaltung.',
  vars:{ S_Tuer_Auf:false, S_Tuer_Zu:false, Antrieb:false, Kabine_da:true, Tuer_Auf:false },
  timed: seq([[0,{S_Tuer_Auf:true},{Tuer_Auf:true}],[0.1,{S_Tuer_Auf:false},{Tuer_Auf:true}],[0.1,{S_Tuer_Zu:true},{Tuer_Auf:false}],[0.1,{S_Tuer_Zu:false, S_Tuer_Auf:true},{Tuer_Auf:true}],[0.1,{S_Tuer_Auf:false, Antrieb:true},{Tuer_Auf:false}],[0.1,{Antrieb:false, Kabine_da:false, S_Tuer_Auf:true},{Tuer_Auf:false}]]),
  ref:'NETWORK Tuer\n(S_Tuer_Auf OR Tuer_Auf) AND NOT S_Tuer_Zu AND NOT Antrieb AND Kabine_da => Tuer_Auf;', man:'selbsthaltung', must:['PARALLEL','NC'],
  hint:'Selbsthaltung wie beim Antrieb, dann drei Kontakte in Reihe.',
  bind:['doorOpen=Tuer_Auf','cabinInStation=Kabine_da','motorOn=Antrieb'] });

defKop({ id:'k3_boss', ch:3, title:'Boss: Fahrbetrieb', boss:true,
  story:'ARIA lässt die Bahn in beide Richtungen zerren und die Tür während der Fahrt aufgehen. Der Werkmeister: „Verriegelung, Aus-Vorrang, Not-Halt — alles, was du heute gelernt hast.“',
  brief:'<b>NW 1:</b> <code>Fahrt_Berg</code> := (<code>S_Berg</code> oder <code>Fahrt_Berg</code>) und nicht <code>S_Stopp</code> und <code>Not_Halt_OK</code> und <code>Tuer_Zu</code> und nicht <code>Fahrt_Tal</code><br><b>NW 2:</b> <code>Fahrt_Tal</code> — gleich, mit <code>S_Tal</code> und verriegelt gegen <code>Fahrt_Berg</code><br><b>NW 3:</b> <code>Antrieb</code> := <code>Fahrt_Berg</code> oder <code>Fahrt_Tal</code>; <code>Richtung_Berg</code> := <code>Fahrt_Berg</code> (zwei Netzwerke oder ein Netzwerk pro Spule)<br><b>NW 4:</b> <code>Ampel_Rot</code> := nicht <code>Not_Halt_OK</code>',
  learn:'Selbsthaltung, Verriegelung und Sicherheitsbedingungen kombinieren.',
  take:'Ein sicherer Fahrbetrieb: Aus-Vorrang, Verriegelung der Richtungen und alle Sicherheitsbedingungen in Reihe hinter der Selbsthaltung.',
  vars:{ S_Berg:false, S_Tal:false, S_Stopp:false, Not_Halt_OK:true, Tuer_Zu:true, Fahrt_Berg:false, Fahrt_Tal:false, Antrieb:false, Richtung_Berg:false, Ampel_Rot:false },
  timed:[{ steps:[[0,{S_Berg:true},{Fahrt_Berg:true, Antrieb:true, Richtung_Berg:true}],[0.1,{S_Berg:false},{Antrieb:true}],[0.1,{S_Tal:true},{Fahrt_Tal:false, Richtung_Berg:true}],[0.1,{S_Tal:false, Not_Halt_OK:false},{Antrieb:false, Ampel_Rot:true}],[0.1,{Not_Halt_OK:true},{Antrieb:false, Ampel_Rot:false}],[0.1,{S_Tal:true},{Fahrt_Tal:true, Antrieb:true, Richtung_Berg:false}],[0.1,{S_Tal:false, Tuer_Zu:false},{Antrieb:false}]] },
    { steps:[[0,{S_Berg:true, S_Stopp:true},{Antrieb:false}],[0.1,{S_Stopp:false},{Antrieb:true}],[0.1,{S_Berg:false, S_Stopp:true},{Antrieb:false, Fahrt_Berg:false}],[0.1,{S_Stopp:false, Tuer_Zu:false, S_Tal:true},{Fahrt_Tal:false, Antrieb:false}]] }],
  ref:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND Not_Halt_OK AND Tuer_Zu AND NOT Fahrt_Tal => Fahrt_Berg;\n\nNETWORK Fahrt Tal\n(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND Not_Halt_OK AND Tuer_Zu AND NOT Fahrt_Berg => Fahrt_Tal;\n\nNETWORK Antrieb\nFahrt_Berg OR Fahrt_Tal => Antrieb;\n\nNETWORK Richtung\nFahrt_Berg => Richtung_Berg;\n\nNETWORK Not-Halt Meldung\nNOT Not_Halt_OK => Ampel_Rot;',
  man:'selbsthaltung', must:['PARALLEL','NC','NETWORKS'],
  hint:'Erst NW 1 bauen und testen. NW 2 ist fast gleich — nur die Namen tauschen.',
  bind:['motorOn=Antrieb','motorDir=Richtung_Berg','lightRed=Ampel_Rot','chainStop=Not_Halt_OK','chainDoor=Tuer_Zu'] });
})();
