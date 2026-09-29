/* ===== KOP QUEST · KAPITEL 4 — Setzen, Rücksetzen, Störungen speichern ===== */
(function(){
const seq = steps => [{ steps }];
defKop({ id:'k4_setzen', ch:4, title:'Setzen und Rücksetzen',
  story:'„Selbsthaltung ist gut, Setzen und Rücksetzen ist kürzer“, sagt der Werkmeister. Eine S-Spule schaltet ihre Variable ein und lässt sie an. Eine R-Spule schaltet sie aus.',
  brief:'<b>NW 1:</b> Der Taster Ein setzt die Stationsbeleuchtung (Spule antippen → <b>Setzen</b>).<br><b>NW 2:</b> Der Taster Aus setzt sie zurück (<b>Rücksetzen</b>).',
  learn:'S- und R-Spulen speichern einen Zustand.',
  take:'Eine <b>S-Spule</b> schreibt nur bei Stromfluss eine 1 — sonst lässt sie die Variable unverändert. Die <b>R-Spule</b> schreibt bei Stromfluss eine 0.',
  vars:{ S_Ein:false, S_Aus:false, Beleuchtung:false },
  timed: seq([[0,{},{Beleuchtung:false}],[0.1,{S_Ein:true},{Beleuchtung:true}],[0.1,{S_Ein:false},{Beleuchtung:true}],[0.1,{S_Aus:true},{Beleuchtung:false}],[0.1,{S_Aus:false},{Beleuchtung:false}]]),
  ref:'NETWORK Licht ein\nS_Ein => S Beleuchtung;\n\nNETWORK Licht aus\nS_Aus => R Beleuchtung;', man:'setzen', must:['SET','RESET'],
  hint:'Zwei Netzwerke: eines mit einer S-Spule, eines mit einer R-Spule — beide für Beleuchtung.',
  bind:['lightsOn=Beleuchtung'] });

defKop({ id:'k4_vorrang', ch:4, title:'Wer zuletzt kommt',
  story:'Drückt jemand Ein und Aus gleichzeitig, gewinnt das Netzwerk, das <b>später</b> ausgeführt wird. Für den Antrieb heisst das: Rücksetzen muss nach dem Setzen kommen.',
  brief:'Der Start-Taster setzt den Antrieb, der Stopp-Taster setzt ihn zurück. Beide gleichzeitig → Antrieb aus (Rücksetzen hat Vorrang).',
  learn:'Vorrang durch die Reihenfolge der Netzwerke.',
  take:'Bei S/R-Spulen entscheidet die <b>Reihenfolge</b>: Das letzte schreibende Netzwerk im Zyklus gewinnt. Rücksetz-Vorrang: R-Netzwerk nach dem S-Netzwerk.',
  vars:{ S_Start:false, S_Stopp:false, Antrieb:false },
  timed: seq([[0,{S_Start:true, S_Stopp:true},{Antrieb:false}],[0.1,{S_Stopp:false},{Antrieb:true}],[0.1,{S_Start:false},{Antrieb:true}],[0.1,{S_Start:true, S_Stopp:true},{Antrieb:false}]]),
  ref:'NETWORK Start\nS_Start => S Antrieb;\n\nNETWORK Stopp\nS_Stopp => R Antrieb;', man:'setzen', must:['SET','RESET'],
  hint:'Das Rücksetz-Netzwerk gehört nach unten.',
  bind:['motorOn=Antrieb'] });

defKop({ id:'k4_stoerung', ch:4, title:'Störung speichern',
  story:'Der Seilwächter meldet für einen Wimpernschlag einen Fehler — dann ist das Signal wieder weg. Trotzdem darf die Bahn nicht einfach weiterfahren: Die Störung muss gespeichert werden, bis jemand sie quittiert.',
  brief:'<b>NW 1:</b> Der Fehlermelder des Seilwächters setzt die Störung.<br><b>NW 2:</b> Die Quittiertaste <b>und nicht</b> Seilfehler setzt die Störung zurück.',
  learn:'Störmeldungen mit Setzen speichern, mit Quittieren löschen.',
  take:'Eine Störung wird <b>gesetzt</b> und bleibt, bis quittiert wird. Quittieren wirkt nur, wenn die Ursache behoben ist.',
  vars:{ Seil_Fehler:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{Seil_Fehler:true},{Stoerung:true}],[0.1,{Seil_Fehler:false},{Stoerung:true}],[0.1,{},{Stoerung:true}],[0.1,{Seil_Fehler:true, Quittieren:true},{Stoerung:true}],[0.1,{Seil_Fehler:false},{Stoerung:false}],[0.1,{Quittieren:false},{Stoerung:false}]]),
  ref:'NETWORK Stoerung speichern\nSeil_Fehler => S Stoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT Seil_Fehler => R Stoerung;', man:'setzen', must:['SET','RESET','NC'],
  hint:'Quittieren darf nur wirken, wenn der Fehler weg ist: Öffner Seil_Fehler in Reihe.',
  bind:['faultActive=Stoerung','chainRope=Seil_Fehler'] });

defKop({ id:'k4_quit_dbg', ch:4, title:'Quittieren ohne Wirkung', debug:true,
  story:'Die Störung lässt sich nie mehr quittieren. ARIA hat im Quittier-Netzwerk die Spule verändert: Statt die Störung zurückzusetzen, setzt sie sie ein zweites Mal.',
  brief:'Die Störung wird vom Türfehler-Melder gesetzt und von der Quittiertaste zurückgesetzt (nur wenn kein Türfehler ansteht). Finde den Fehler.',
  learn:'Falsche Spule oder Reihenfolge bei S/R finden.',
  take:'Bei S/R lohnt es sich, jede Spule einzeln zu prüfen: Setzt sie oder setzt sie zurück — und wann?',
  vars:{ Tuer_Fehler:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{Tuer_Fehler:true},{Stoerung:true}],[0.1,{Tuer_Fehler:false},{Stoerung:true}],[0.1,{Quittieren:true},{Stoerung:false}],[0.1,{Quittieren:false},{Stoerung:false}]]),
  start:'NETWORK Stoerung speichern\nTuer_Fehler => S Stoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT Tuer_Fehler => S Stoerung;',
  ref:'NETWORK Stoerung speichern\nTuer_Fehler => S Stoerung;\n\nNETWORK Quittieren\nQuittieren AND NOT Tuer_Fehler => R Stoerung;', man:'setzen', must:['RESET'],
  hint:'Schau dir die Spule im Netzwerk „Quittieren“ genau an.',
  bind:['faultActive=Stoerung'] });

defKop({ id:'k4_negiert', ch:4, title:'Die negierte Spule',
  story:'„Bereit“-Lampe: Sie soll leuchten, wenn der Antrieb steht. Statt eines Öffners im Strompfad gibt es auch die negierte Spule: Sie schreibt das Gegenteil des Stromflusses.',
  brief:'Läuft der Antrieb, geht die rote Ampel aus, über eine <b>negierte Spule</b> (rot = nicht Antrieb).<br>Zusätzlich leuchtet die grüne Ampel, wenn der Antrieb läuft (normale Spule im selben Netzwerk).',
  learn:'Die negierte Spule schreibt 0 bei Stromfluss und 1 ohne Stromfluss.',
  take:'Die <b>negierte Spule</b> <code>—(/)—</code> invertiert den Stromfluss. Sie ist praktisch für Gegenmeldungen, aber sparsam einsetzen: Ein Öffner im Pfad ist oft lesbarer.',
  vars:{ Antrieb:false, Ampel_Rot:false, Ampel_Gruen:false },
  tests: truth(['Antrieb'], e => ({ Ampel_Rot: !e.Antrieb, Ampel_Gruen: e.Antrieb })),
  ref:'NETWORK Ampel\nAntrieb => NOT Ampel_Rot, Ampel_Gruen;', man:'setzen', must:['NCOIL'],
  hint:'Ein Kontakt Antrieb, zwei Spulen: eine negiert, eine normal.',
  bind:['motorOn=Antrieb','lightRed=Ampel_Rot','lightGreen=Ampel_Gruen'] });

defKop({ id:'k4_antrieb_sr', ch:4, title:'Antrieb mit S und R',
  story:'Der Werkmeister möchte den Antrieb mit Setzen/Rücksetzen statt mit Selbsthaltung — mit allen Sicherheitsbedingungen. Wichtig: Jede Abschaltbedingung setzt zurück, und das Rücksetzen hat Vorrang.',
  brief:'<b>NW 1:</b> Start-Taster und geschlossene Kabinentür setzen den Antrieb.<br><b>NW 2:</b> Stopp-Taster <b>oder</b> gestörter Not-Halt-Kreis <b>oder</b> offene Kabinentür setzt den Antrieb zurück.',
  learn:'Setzen mit Einschaltbedingung, Rücksetzen mit allen Abschaltbedingungen parallel.',
  take:'Mit S/R stehen Einschalt- und Abschaltbedingungen getrennt: oben „wann an“, unten „wann aus“ — alle Aus-Gründe parallel.',
  vars:{ S_Start:false, S_Stopp:false, Not_Halt_OK:true, Tuer_Zu:true, Antrieb:false },
  timed: seq([[0,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false},{Antrieb:true}],[0.1,{Tuer_Zu:false},{Antrieb:false}],[0.1,{Tuer_Zu:true, S_Start:true},{Antrieb:true}],[0.1,{S_Start:false, Not_Halt_OK:false},{Antrieb:false}],[0.1,{Not_Halt_OK:true, S_Start:true, S_Stopp:true},{Antrieb:false}],[0.1,{S_Stopp:false},{Antrieb:true}]]),
  ref:'NETWORK Antrieb ein\nS_Start AND Tuer_Zu => S Antrieb;\n\nNETWORK Antrieb aus\nS_Stopp OR NOT Not_Halt_OK OR NOT Tuer_Zu => R Antrieb;', man:'setzen', must:['SET','RESET','PARALLEL'],
  hint:'Das Rücksetz-Netzwerk hat drei parallele Zweige.',
  bind:['motorOn=Antrieb','chainStop=Not_Halt_OK','chainDoor=Tuer_Zu'] });

defKop({ id:'k4_sammel', ch:4, title:'Sammelstörung',
  story:'Wind und Seil haben eigene Störmeldungen. Auf der Leitwarte soll zusätzlich eine Sammelstörung leuchten, sobald irgendeine Störung gespeichert ist. Ein Quittieren löscht beide, wenn ihre Ursache weg ist.',
  brief:'<b>NW 1:</b> Der Windfehler-Melder setzt die Windstörung. <b>NW 2:</b> Der Seilfehler-Melder setzt die Seilstörung.<br><b>NW 3:</b> Quittieren und nicht Windfehler setzt die Windstörung zurück. <b>NW 4:</b> dasselbe für die Seilstörung.<br><b>NW 5:</b> Die Sammelstörung ist 1, wenn Windstörung <b>oder</b> Seilstörung gespeichert ist.',
  learn:'Mehrere gespeicherte Störungen und eine Sammelmeldung.',
  take:'Einzelstörungen werden getrennt gespeichert und quittiert. Die <b>Sammelstörung</b> fasst sie mit ODER zusammen.',
  vars:{ Wind_Fehler:false, Seil_Fehler:false, Quittieren:false, St_Wind:false, St_Seil:false, Sammelstoerung:false },
  timed: seq([[0,{Wind_Fehler:true},{St_Wind:true, Sammelstoerung:true}],[0.1,{Wind_Fehler:false, Seil_Fehler:true},{St_Wind:true, St_Seil:true}],[0.1,{Quittieren:true},{St_Wind:false, St_Seil:true, Sammelstoerung:true}],[0.1,{Seil_Fehler:false},{St_Seil:false, Sammelstoerung:false}],[0.1,{Quittieren:false},{Sammelstoerung:false}]]),
  ref:'NETWORK Wind\nWind_Fehler => S St_Wind;\n\nNETWORK Seil\nSeil_Fehler => S St_Seil;\n\nNETWORK Quittieren Wind\nQuittieren AND NOT Wind_Fehler => R St_Wind;\n\nNETWORK Quittieren Seil\nQuittieren AND NOT Seil_Fehler => R St_Seil;\n\nNETWORK Sammelstoerung\nSt_Wind OR St_Seil => Sammelstoerung;', man:'setzen', must:['SET','RESET','PARALLEL'],
  hint:'Fünf kleine Netzwerke — eines nach dem anderen.',
  bind:['faultActive=Sammelstoerung','windWarn=St_Wind','chainRope=Seil_Fehler'] });

defKop({ id:'k4_hupe', ch:4, title:'Hupe bis zum Quittieren',
  story:'Neue Störungen soll man hören. Die Hupe tönt, sobald eine Störung ansteht, bis jemand quittiert. Steht die Störung danach noch an, meldet sich die Hupe wieder — damit niemand eine offene Störung vergisst.',
  brief:'<b>NW 1:</b> Eine anstehende Störung setzt die Hupe.<br><b>NW 2:</b> Die Quittiertaste setzt die Hupe zurück.',
  learn:'Akustische Meldung getrennt von der Störung quittieren.',
  take:'Hupe und Störung werden getrennt behandelt. Solange die Störung ansteht, setzt sie die Hupe in jedem Zyklus neu — in Kapitel 5 lernst du, wie eine <b>Flanke</b> die Hupe nur bei einer <i>neuen</i> Störung auslöst.',
  vars:{ Stoerung:false, Quittieren:false, Hupe:false },
  timed: seq([[0,{Stoerung:true},{Hupe:true}],[0.1,{},{Hupe:true}],[0.1,{Quittieren:true},{Hupe:false}],[0.1,{Quittieren:false},{Hupe:true}]]),
  ref:'NETWORK Hupe ein\nStoerung => S Hupe;\n\nNETWORK Hupe aus\nQuittieren => R Hupe;', man:'setzen', must:['SET','RESET'],
  hint:'Setzen und Rücksetzen wie beim Licht. Überlege, was nach dem Loslassen von Quittieren passiert, solange die Störung noch da ist.',
  bind:['hornActive=Hupe','faultActive=Stoerung'] });

defKop({ id:'k4_vorrang_dbg', ch:4, title:'Setzen gewinnt', debug:true,
  story:'Der Stopp-Taster wirkt nicht, solange jemand Start gedrückt hält. ARIA hat die Reihenfolge der Netzwerke umgedreht.',
  brief:'Der Antrieb wird vom Start-Taster gesetzt und vom Stopp-Taster zurückgesetzt. Rücksetzen muss Vorrang haben.',
  learn:'Reihenfolge der Netzwerke entscheidet den Vorrang.',
  take:'Das Netzwerk, das später kommt, gewinnt. Für Antriebe gehört das Rücksetzen nach unten.',
  vars:{ S_Start:false, S_Stopp:false, Antrieb:false },
  timed: seq([[0,{S_Start:true},{Antrieb:true}],[0.1,{S_Stopp:true},{Antrieb:false}],[0.1,{S_Start:false, S_Stopp:false},{Antrieb:false}]]),
  start:'NETWORK Stopp\nS_Stopp => R Antrieb;\n\nNETWORK Start\nS_Start => S Antrieb;',
  ref:'NETWORK Start\nS_Start => S Antrieb;\n\nNETWORK Stopp\nS_Stopp => R Antrieb;', man:'setzen',
  hint:'Netzwerk antippen (Kopfzeile) → nach unten / nach oben.',
  bind:['motorOn=Antrieb'] });

defKop({ id:'k4_boss', ch:4, title:'Boss: Das Störmeldesystem', boss:true,
  story:'ARIA hat die Leitwarte stumm geschaltet. Störungen blitzen auf und verschwinden, niemand merkt etwas. Du baust das Störmeldesystem neu: speichern, melden, hupen, quittieren — und der Antrieb stoppt bei jeder Störung.',
  brief:'<b>NW 1:</b> Der Seilfehler-Melder setzt die Seilstörung<br><b>NW 2:</b> Quittieren und nicht Seilfehler setzt die Seilstörung zurück<br><b>NW 3:</b> Der Seilfehler-Melder setzt die Hupe; <b>NW 4:</b> Quittieren setzt die Hupe zurück<br><b>NW 5:</b> Start-Taster und nicht gespeicherte Seilstörung setzen den Antrieb<br><b>NW 6:</b> Stopp-Taster oder gespeicherte Seilstörung setzt den Antrieb zurück',
  learn:'Ein vollständiges Störmeldesystem mit S/R.',
  take:'Störung speichern, akustisch melden, getrennt quittieren und den Antrieb sicher abschalten — die Grundlage jeder Anlagensteuerung.',
  vars:{ Seil_Fehler:false, Quittieren:false, S_Start:false, S_Stopp:false, St_Seil:false, Hupe:false, Antrieb:false },
  timed: seq([[0,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false, Seil_Fehler:true},{St_Seil:true, Hupe:true, Antrieb:false}],[0.1,{Seil_Fehler:false},{St_Seil:true, Hupe:true}],[0.1,{S_Start:true},{Antrieb:false}],[0.1,{S_Start:false, Quittieren:true},{St_Seil:false, Hupe:false}],[0.1,{Quittieren:false, S_Start:true},{Antrieb:true}],[0.1,{S_Start:false, S_Stopp:true},{Antrieb:false}]]),
  ref:'NETWORK Stoerung Seil\nSeil_Fehler => S St_Seil;\n\nNETWORK Quittieren\nQuittieren AND NOT Seil_Fehler => R St_Seil;\n\nNETWORK Hupe ein\nSeil_Fehler => S Hupe;\n\nNETWORK Hupe aus\nQuittieren => R Hupe;\n\nNETWORK Antrieb ein\nS_Start AND NOT St_Seil => S Antrieb;\n\nNETWORK Antrieb aus\nS_Stopp OR St_Seil => R Antrieb;',
  man:'setzen', must:['SET','RESET','NETWORKS'],
  hint:'Sechs Netzwerke. Das Rücksetzen des Antriebs gehört ans Ende.',
  bind:['faultActive=St_Seil','hornActive=Hupe','motorOn=Antrieb','chainRope=Seil_Fehler'] });
})();
