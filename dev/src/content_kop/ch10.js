/* ===== KOP QUEST · KAPITEL 10 — Sicherheitskette und Ablauf ===== */
(function(){
const seq = steps => [{ steps }];
const CHAIN = ['chainDoor=Tuer_Zu','chainRope=Seil_OK','chainStop=Not_Halt_OK'];

defKop({ id:'k10_kette', ch:10, title:'Die Sicherheitskette',
  story:'In der Bergstation hängt ein Schild: „Keine Fahrt ohne geschlossene Kette.“ Türen zu, Seil in der Rolle, Not-Halt frei, Wind ruhig — erst dann darf der Antrieb überhaupt anlaufen.',
  brief:'Die Sicherheitskette ist geschlossen, wenn Türen zu, Seil OK, Not-Halt OK und Wind OK <b>alle</b> gleichzeitig melden.',
  learn:'Sicherheitskette als Reihenschaltung.',
  take:'Die <b>Sicherheitskette</b> ist eine Reihenschaltung aller Sicherheitsbedingungen. Jedes Glied meldet „alles gut“ mit Signal 1 (Ruhestromprinzip) — ein gerissener Draht öffnet die Kette genauso wie ein ausgelöster Schalter.',
  vars:{ Tuer_Zu:false, Seil_OK:false, Not_Halt_OK:false, Wind_OK:false, Kette_OK:false },
  tests: truth(['Tuer_Zu','Seil_OK','Not_Halt_OK','Wind_OK'], e => ({ Kette_OK: e.Tuer_Zu && e.Seil_OK && e.Not_Halt_OK && e.Wind_OK })),
  ref:'NETWORK Sicherheitskette\nTuer_Zu AND Seil_OK AND Not_Halt_OK AND Wind_OK => Kette_OK;', man:'kette', must:['SERIES'],
  hint:'Vier Schliesser in Reihe, am Ende die Spule Kette_OK.',
  bind:CHAIN.concat(['chainWind=Wind_OK','lightGreen=Kette_OK']) });

defKop({ id:'k10_freigabe', ch:10, title:'Freigabe für den Antrieb',
  story:'Jetzt hängt der Antrieb an der Kette: Er startet mit <code>S_Start</code>, hält sich selbst und fällt sofort ab, wenn die Kette öffnet. Danach braucht es einen neuen Start, auch wenn die Kette wieder schliesst.',
  brief:'Der Antrieb startet mit dem Starttaster, hält sich selbst und stoppt mit dem Stopptaster oder sobald die Kette öffnet (danach neu starten). Bei offener Kette leuchtet Rot.',
  learn:'Die Kette als Freigabe in einer Selbsthaltung.',
  take:'Liegt die Kette <b>in</b> der Selbsthaltung, bricht sie beim Öffnen ab. Die Bahn läuft danach <b>nicht</b> von allein wieder an — ein bewusster Neustart ist Pflicht.',
  vars:{ S_Start:false, S_Stopp:false, Kette_OK:false, Antrieb:false, Ampel_Rot:false },
  timed: seq([[0,{Kette_OK:true, S_Start:true},{Antrieb:true, Ampel_Rot:false}],[0.1,{S_Start:false},{Antrieb:true}],[0.1,{Kette_OK:false},{Antrieb:false, Ampel_Rot:true}],
    [0.1,{Kette_OK:true},{Antrieb:false, Ampel_Rot:false}],[0.1,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false, S_Stopp:true},{Antrieb:false}]]),
  ref:'NETWORK Antrieb\n(S_Start OR Antrieb) AND NOT S_Stopp AND Kette_OK => Antrieb;\n\nNETWORK Kette offen\nNOT Kette_OK => Ampel_Rot;', man:'kette', must:['PARALLEL','NC'],
  wrong:['NETWORK Antrieb\n((S_Start OR Antrieb) AND NOT S_Stopp) OR Kette_OK => Antrieb;\n\nNETWORK Kette offen\nNOT Kette_OK => Ampel_Rot;'],
  hint:'Wie die Selbsthaltung aus Kapitel 3 — mit Kette_OK als weiterem Kontakt in Reihe.',
  bind:['motorOn=Antrieb','lightRed=Ampel_Rot','lightGreen=Kette_OK'] });

defKop({ id:'k10_bruecke_dbg', ch:10, title:'Die Revisionsbrücke', debug:true,
  story:'ARIA hat einen „Revisionskontakt“ parallel zum Türkontakt eingebaut, und die Bahn fährt mit offener Tür! Der Werkmeister wird blass: „Eine Sicherheitskette brückt man nie.“',
  brief:'Die Kette darf nur schliessen, wenn Türen zu, Seil, Not-Halt und Wind OK sind — egal, was die Revision meldet.',
  learn:'Keine Brücken in der Sicherheitskette.',
  take:'Ein Parallelzweig um ein Kettenglied setzt die Sicherheitsfunktion ausser Kraft. Revisionsfahrten laufen über eine eigene, abgesicherte Betriebsart — nie über eine Brücke in der Kette.',
  vars:{ Tuer_Zu:false, Revision:false, Seil_OK:true, Not_Halt_OK:true, Wind_OK:true, Kette_OK:false },
  tests: truth(['Tuer_Zu','Revision'], e => ({ Kette_OK: e.Tuer_Zu }), { Seil_OK:true, Not_Halt_OK:true, Wind_OK:true })
    .concat([[{ Tuer_Zu:true, Revision:true, Seil_OK:false, Not_Halt_OK:true, Wind_OK:true }, { Kette_OK:false }]]),
  start:'NETWORK Sicherheitskette\n(Tuer_Zu OR Revision) AND Seil_OK AND Not_Halt_OK AND Wind_OK => Kette_OK;',
  ref:'NETWORK Sicherheitskette\nTuer_Zu AND Seil_OK AND Not_Halt_OK AND Wind_OK => Kette_OK;', man:'kette', must:['SERIES'],
  hint:'Der Kontakt Revision gehört nicht in die Kette. Antippen → Löschen.',
  bind:CHAIN.concat(['chainWind=Wind_OK','lightGreen=Kette_OK','doorOpen=Revision']) });

defKop({ id:'k10_speicher', ch:10, title:'Der Wackelkontakt',
  story:'Die Kette öffnet für einen einzigen Zyklus und schliesst wieder, gesehen hat es nur ARIA. Eine Unterbrechung der Kette muss <b>gespeichert</b> werden, bis jemand quittiert.',
  brief:'Öffnet die Kette (auch kurz), wird der Kettenfehler gespeichert. Quittieren löscht ihn nur bei geschlossener Kette. Freigabe nur bei geschlossener Kette ohne gespeicherten Fehler.',
  learn:'Kettenunterbrechung speichern und quittieren.',
  take:'Auch kurze Unterbrechungen werden mit <b>S</b> gespeichert. Quittieren wirkt nur, wenn die Ursache weg ist. Erst dann gibt es die Freigabe wieder.',
  vars:{ Kette_OK:true, Quittieren:false, Kette_Fehler:false, Freigabe:false },
  timed: seq([[0,{Kette_OK:true},{Kette_Fehler:false, Freigabe:true}],[0.1,{Kette_OK:false},{Kette_Fehler:true, Freigabe:false}],[0.1,{Kette_OK:true},{Kette_Fehler:true, Freigabe:false}],
    [0.1,{Quittieren:true, Kette_OK:false},{Kette_Fehler:true}],[0.1,{Kette_OK:true},{Kette_Fehler:false, Freigabe:true}],[0.1,{Quittieren:false},{Freigabe:true}]]),
  ref:'NETWORK Unterbrechung speichern\nNOT Kette_OK => S Kette_Fehler;\n\nNETWORK Quittieren\nQuittieren AND Kette_OK => R Kette_Fehler;\n\nNETWORK Freigabe\nKette_OK AND NOT Kette_Fehler => Freigabe;', man:'kette', must:['SET','RESET','NC'],
  hint:'NW 1 hat einen Öffner Kette_OK und eine S-Spule.',
  bind:['lightGreen=Freigabe','faultActive=Kette_Fehler','lightRed=Kette_Fehler'] });

defKop({ id:'k10_zwei_schritte', ch:10, title:'Die erste Schrittkette',
  story:'Eine Seilbahn arbeitet in <b>Schritten</b> (Einsteigen, Fahrt, wieder Einsteigen), und immer ist genau einer aktiv. Jeder Schritt ist ein Merker, der mit S gesetzt und beim Weiterschalten mit R gelöscht wird.',
  brief:'Grundstellung und Ausgaben sind da. Baue die zwei Übergänge (S nächster, R eigener Schritt): Einsteigen → Fahrt mit dem Abfahrtstaster, Fahrt → Einsteigen bei Ankunft.',
  learn:'Schrittkette: Übergang setzt den nächsten und löscht den eigenen Schritt.',
  take:'Ein <b>Übergang</b> (Transition) ist: aktueller Schritt UND Weiterschaltbedingung → <b>S</b> nächster Schritt, <b>R</b> aktueller Schritt. Die Grundstellung setzt den ersten Schritt, wenn keiner aktiv ist.',
  vars:{ S_Abfahrt:false, Ankunft:false, Schritt_Einsteigen:false, Schritt_Fahrt:false, Tuer_Auf:false, Antrieb:false },
  timed: seq([[0,{},{Schritt_Einsteigen:true, Tuer_Auf:true, Antrieb:false}],[0.1,{S_Abfahrt:true},{Schritt_Fahrt:true, Schritt_Einsteigen:false, Tuer_Auf:false, Antrieb:true}],
    [0.1,{S_Abfahrt:false},{Antrieb:true}],[0.1,{S_Abfahrt:true},{Antrieb:true, Schritt_Einsteigen:false}],
    [0.1,{S_Abfahrt:false, Ankunft:true},{Schritt_Einsteigen:true, Schritt_Fahrt:false, Antrieb:false, Tuer_Auf:true}],[0.1,{Ankunft:false},{Tuer_Auf:true, Antrieb:false}]]),
  start:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Weiter\n? => ?;\n\nNETWORK Zurueck\n? => ?;\n\nNETWORK Tuer\nSchritt_Einsteigen => Tuer_Auf;\n\nNETWORK Antrieb\nSchritt_Fahrt => Antrieb;',
  ref:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Weiter\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt, R Schritt_Einsteigen;\n\nNETWORK Zurueck\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Tuer\nSchritt_Einsteigen => Tuer_Auf;\n\nNETWORK Antrieb\nSchritt_Fahrt => Antrieb;',
  man:'schrittkette', must:['SET','RESET','MULTI_OUT'],
  hint:'Pro Übergang zwei Spulen am Ende: S für den nächsten Schritt, R für den aktuellen („weitere Spule“).',
  bind:['doorOpen=Tuer_Auf','motorOn=Antrieb','cabinInStation=Schritt_Einsteigen'] });

defKop({ id:'k10_ausgaben', ch:10, title:'Befehlsausgabe',
  story:'Die Kette mit Einsteigen, Warnen und Fahrt steht, jetzt fehlen die Befehle an die Anlage. ARIA flüstert: „Schreib Ampel_Rot doch einfach zweimal.“',
  brief:'Ergänze die Befehle: Einsteigen → Tür auf · Warnen → Hupe · Einsteigen <b>oder</b> Warnen → Rot (nur eine Spule!) · Fahrt → Antrieb und Grün.',
  learn:'Jeder Ausgang genau einmal ansteuern — mehrere Schritte per ODER.',
  take:'Ist ein Ausgang in mehreren Schritten aktiv, werden die Schritte <b>parallel</b> geschaltet. Dieselbe Spule zweimal zu verwenden (<b>Doppelspule</b>) ist ein Fehler: Das letzte Netzwerk überschreibt das erste.',
  vars:{ S_Abfahrt:false, S_Weiter:false, Ankunft:false, Schritt_Einsteigen:false, Schritt_Warnen:false, Schritt_Fahrt:false, Tuer_Auf:false, Hupe:false, Ampel_Rot:false, Ampel_Gruen:false, Antrieb:false },
  timed: seq([[0,{},{Tuer_Auf:true, Ampel_Rot:true, Hupe:false, Antrieb:false, Ampel_Gruen:false}],[0.1,{S_Abfahrt:true},{Tuer_Auf:false, Hupe:true, Ampel_Rot:true, Antrieb:false}],
    [0.1,{S_Abfahrt:false, S_Weiter:true},{Hupe:false, Ampel_Rot:false, Antrieb:true, Ampel_Gruen:true}],[0.1,{S_Weiter:false, Ankunft:true},{Tuer_Auf:true, Ampel_Rot:true, Antrieb:false, Ampel_Gruen:false}]]),
  start:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Warnen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Einsteigen -> Warnen\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Warnen, R Schritt_Einsteigen;\n\nNETWORK Warnen -> Fahrt\nSchritt_Warnen AND S_Weiter => S Schritt_Fahrt, R Schritt_Warnen;\n\nNETWORK Fahrt -> Einsteigen\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Tuer\n? => ?;',
  ref:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Warnen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Einsteigen -> Warnen\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Warnen, R Schritt_Einsteigen;\n\nNETWORK Warnen -> Fahrt\nSchritt_Warnen AND S_Weiter => S Schritt_Fahrt, R Schritt_Warnen;\n\nNETWORK Fahrt -> Einsteigen\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Tuer\nSchritt_Einsteigen => Tuer_Auf;\n\nNETWORK Hupe\nSchritt_Warnen => Hupe;\n\nNETWORK Ampel rot\nSchritt_Einsteigen OR Schritt_Warnen => Ampel_Rot;\n\nNETWORK Fahrt\nSchritt_Fahrt => Antrieb, Ampel_Gruen;',
  wrong:['NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Warnen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Einsteigen -> Warnen\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Warnen, R Schritt_Einsteigen;\n\nNETWORK Warnen -> Fahrt\nSchritt_Warnen AND S_Weiter => S Schritt_Fahrt, R Schritt_Warnen;\n\nNETWORK Fahrt -> Einsteigen\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Tuer\nSchritt_Einsteigen => Tuer_Auf, Ampel_Rot;\n\nNETWORK Hupe\nSchritt_Warnen => Hupe, Ampel_Rot;\n\nNETWORK Fahrt\nSchritt_Fahrt => Antrieb, Ampel_Gruen;'],
  man:'schrittkette', must:['PARALLEL','MULTI_OUT'],
  hint:'Vier Netzwerke. Für Ampel_Rot die beiden Schritte parallel schalten — nicht zwei Spulen Ampel_Rot.',
  bind:['doorOpen=Tuer_Auf','hornActive=Hupe','lightRed=Ampel_Rot','lightGreen=Ampel_Gruen','motorOn=Antrieb','cabinInStation=Schritt_Einsteigen'] });

defKop({ id:'k10_zeitschritt', ch:10, title:'Drei Sekunden Vorwarnung',
  story:'Niemand drückt <code>S_Weiter</code> — die Vorwarnung soll von selbst enden. Nach <b>3 Sekunden</b> Hupen geht die Kette in die Fahrt.',
  brief:'Ersetze den Übergang <b>Warnen → Fahrt</b>: Nach 3 s im Schritt Warnen (TON) wird der Schritt Fahrt gesetzt und der Schritt Warnen gelöscht.',
  learn:'Zeit als Weiterschaltbedingung.',
  take:'Eine Schrittzeit ist ein TON, dessen Eingang der Schrittmerker ist. Er startet beim Eintritt in den Schritt und setzt sich beim Verlassen von selbst zurück.',
  vars:{ S_Abfahrt:false, Ankunft:false, Schritt_Einsteigen:false, Schritt_Warnen:false, Schritt_Fahrt:false, Hupe:false, Antrieb:false },
  timed: seq([[0,{},{Schritt_Einsteigen:true}],[0.1,{S_Abfahrt:true},{Schritt_Warnen:true, Hupe:true}],[0.1,{S_Abfahrt:false},{Schritt_Warnen:true}],[1,{},{Schritt_Warnen:true}],[1,{},{Schritt_Warnen:true, Antrieb:false}],
    [1,{},{Schritt_Warnen:false, Schritt_Fahrt:true, Hupe:false, Antrieb:true}],[0.1,{Ankunft:true},{Schritt_Einsteigen:true, Antrieb:false}],[0.1,{Ankunft:false, S_Abfahrt:true},{Schritt_Warnen:true}],[1,{S_Abfahrt:false},{Schritt_Warnen:true, Antrieb:false}]]),
  start:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Warnen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Einsteigen -> Warnen\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Warnen, R Schritt_Einsteigen;\n\nNETWORK Warnen -> Fahrt\n? => ?;\n\nNETWORK Fahrt -> Einsteigen\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Hupe\nSchritt_Warnen => Hupe;\n\nNETWORK Antrieb\nSchritt_Fahrt => Antrieb;',
  ref:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Warnen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Einsteigen -> Warnen\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Warnen, R Schritt_Einsteigen;\n\nNETWORK Warnen -> Fahrt\nSchritt_Warnen AND TON(T_Warnen, T#3S) => S Schritt_Fahrt, R Schritt_Warnen;\n\nNETWORK Fahrt -> Einsteigen\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Hupe\nSchritt_Warnen => Hupe;\n\nNETWORK Antrieb\nSchritt_Fahrt => Antrieb;',
  man:'schrittkette', must:['TON','SET','RESET'],
  hint:'Schritt_Warnen als Kontakt, dahinter der Timer, am Ende S und R.',
  bind:['hornActive=Hupe','lightYellow=Schritt_Warnen','motorOn=Antrieb','cabinInStation=Schritt_Einsteigen'] });

defKop({ id:'k10_schritt_dbg', ch:10, title:'Zwei Schritte gleichzeitig', debug:true,
  story:'Die Kabine fährt mit offener Tür ab, weil zwei Schritte gleichzeitig aktiv sind. ARIA hat an einem Übergang etwas „vergessen“.',
  brief:'Es darf immer nur <b>ein</b> Schritt aktiv sein. Während der Fahrt muss die Tür zu sein.',
  learn:'Jeder Übergang löscht den alten Schritt.',
  take:'Fehlt beim Übergang das <b>R</b> des alten Schritts, bleiben zwei Schritte aktiv — und damit auch ihre Befehle. Eine gute Probe: In jedem Zyklus darf genau ein Schrittmerker 1 sein.',
  vars:{ S_Abfahrt:false, Ankunft:false, Schritt_Einsteigen:false, Schritt_Fahrt:false, Tuer_Auf:false, Antrieb:false },
  timed: seq([[0,{},{Schritt_Einsteigen:true, Tuer_Auf:true}],[0.1,{S_Abfahrt:true},{Schritt_Fahrt:true, Schritt_Einsteigen:false, Tuer_Auf:false, Antrieb:true}],
    [0.1,{S_Abfahrt:false, Ankunft:true},{Schritt_Einsteigen:true, Schritt_Fahrt:false}]]),
  start:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Weiter\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt;\n\nNETWORK Zurueck\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Tuer\nSchritt_Einsteigen => Tuer_Auf;\n\nNETWORK Antrieb\nSchritt_Fahrt => Antrieb;',
  ref:'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\nNETWORK Weiter\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt, R Schritt_Einsteigen;\n\nNETWORK Zurueck\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\nNETWORK Tuer\nSchritt_Einsteigen => Tuer_Auf;\n\nNETWORK Antrieb\nSchritt_Fahrt => Antrieb;',
  man:'schrittkette', must:['RESET'],
  hint:'Vergleiche die Netzwerke Weiter und Zurueck.',
  bind:['doorOpen=Tuer_Auf','motorOn=Antrieb','cabinInStation=Schritt_Einsteigen'] });

defKop({ id:'k10_betriebsart', ch:10, title:'Hand und Automatik',
  story:'Im <b>Handbetrieb</b> läuft der Antrieb nur, solange der Werkmeister den Tipptaster hält, im <b>Automatikbetrieb</b> fährt die Schrittkette. Die Sicherheitskette gilt in beiden Betriebsarten.',
  brief:'Automatik: Antrieb im Schritt Fahrt. Hand: Antrieb, solange der Tipptaster gedrückt ist. Beides nur bei geschlossener Kette. Grün zeigt Automatik, Gelb Hand.',
  learn:'Betriebsarten als Parallelzweige, Sicherheit in Reihe dahinter.',
  take:'Betriebsarten schliessen sich gegenseitig aus (Schliesser/Öffner derselben Variable). Die <b>Sicherheitskette</b> liegt hinter der Verzweigung — sie gilt immer, egal wie gefahren wird.',
  vars:{ Auto:false, Schritt_Fahrt:false, S_Tippen:false, Kette_OK:false, Antrieb:false, Ampel_Gruen:false, Ampel_Gelb:false },
  tests: truth(['Auto','Schritt_Fahrt','S_Tippen','Kette_OK'], e => ({ Antrieb: ((e.Auto && e.Schritt_Fahrt) || (!e.Auto && e.S_Tippen)) && e.Kette_OK, Ampel_Gruen: e.Auto, Ampel_Gelb: !e.Auto })),
  ref:'NETWORK Antrieb\n((Auto AND Schritt_Fahrt) OR (NOT Auto AND S_Tippen)) AND Kette_OK => Antrieb;\n\nNETWORK Anzeige Automatik\nAuto => Ampel_Gruen;\n\nNETWORK Anzeige Hand\nNOT Auto => Ampel_Gelb;',
  wrong:['NETWORK Antrieb\n(Auto AND Schritt_Fahrt) OR (NOT Auto AND S_Tippen AND Kette_OK) => Antrieb;\n\nNETWORK Anzeige Automatik\nAuto => Ampel_Gruen;\n\nNETWORK Anzeige Hand\nNOT Auto => Ampel_Gelb;'],
  man:'schrittkette', must:['PARALLEL','NC','SERIES'],
  hint:'Zwei Zweige mit je zwei Kontakten parallel, dahinter Kette_OK in Reihe.',
  bind:['motorOn=Antrieb','lightGreen=Ampel_Gruen','lightYellow=Ampel_Gelb'] });

defKop({ id:'k10_final', ch:10, title:'Final Boss: Sturm auf die Gratbahn', boss:true, final:true,
  story:'ARIA hat die ganze Station übernommen. Der Werkmeister reisst den Schaltschrank auf: „Sicherheitskette, Schrittkette, Störung, alles neu, dann ist die Gratbahn wieder unsere.“',
  brief:'<b>NW 1:</b> Kette zu bei Türen zu, Seil OK, Not-Halt OK und Wind ≤ 60 km/h<br><b>NW 2–5:</b> Grundstellung Einsteigen → Warnen (Abfahrtstaster, Kette zu, keine Störung) → nach 2 s Fahrt → bei Ankunft Einsteigen<br><b>NW 6–7:</b> Kette offen in Warnen/Fahrt → Störung speichern, zurück ins Einsteigen; Quittieren bei geschlossener Kette löscht sie<br><b>NW 8–10:</b> Warnen → Hupe, Gelb · Fahrt mit Kette zu → Antrieb, Grün · Störung → Rot',
  learn:'Sicherheitskette, Schrittkette und Störungsspeicher in einer Station.',
  take:'Du hast eine komplette Seilbahnstation im Kontaktplan gezeichnet: Die Sicherheitskette gibt frei, die Schrittkette führt durch den Ablauf, und jede Unterbrechung während der Fahrt wird gespeichert und muss quittiert werden. Genau so sind echte Anlagen aufgebaut.',
  vars:{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_kmh:20, S_Abfahrt:false, Ankunft:false, Quittieren:false,
    Kette_OK:false, Schritt_Einsteigen:false, Schritt_Warnen:false, Schritt_Fahrt:false, Stoerung:false, Hupe:false, Ampel_Gelb:false, Ampel_Gruen:false, Ampel_Rot:false, Antrieb:false },
  timed: seq([[0,{},{Kette_OK:true, Schritt_Einsteigen:true, Antrieb:false}],
    [0.1,{S_Abfahrt:true},{Schritt_Warnen:true, Schritt_Einsteigen:false, Hupe:true, Ampel_Gelb:true}],
    [0.1,{S_Abfahrt:false},{Schritt_Warnen:true}],[1,{},{Schritt_Warnen:true, Antrieb:false}],
    [1,{},{Schritt_Fahrt:true, Schritt_Warnen:false, Antrieb:true, Ampel_Gruen:true, Hupe:false}],
    [0.1,{Wind_kmh:70},{Kette_OK:false, Antrieb:false, Stoerung:true, Schritt_Einsteigen:true, Schritt_Fahrt:false, Ampel_Rot:true}],
    [0.1,{S_Abfahrt:true},{Schritt_Warnen:false, Schritt_Einsteigen:true}],
    [0.1,{S_Abfahrt:false, Wind_kmh:30},{Kette_OK:true, Stoerung:true}],
    [0.1,{Quittieren:true},{Stoerung:false, Ampel_Rot:false}],
    [0.1,{Quittieren:false, S_Abfahrt:true},{Schritt_Warnen:true}],
    [0.1,{S_Abfahrt:false},{Schritt_Warnen:true}],
    [2.1,{},{Schritt_Fahrt:true, Antrieb:true}],
    [0.1,{Ankunft:true},{Schritt_Einsteigen:true, Schritt_Fahrt:false, Antrieb:false}],
    [0.1,{Ankunft:false, Tuer_Zu:false, S_Abfahrt:true},{Kette_OK:false, Schritt_Einsteigen:true, Schritt_Warnen:false, Stoerung:false}],
    [0.1,{Tuer_Zu:true},{Schritt_Warnen:true}]]),
  ref:'NETWORK Sicherheitskette\nTuer_Zu AND Seil_OK AND Not_Halt_OK AND [Wind_kmh <= 60] => Kette_OK;\n\n' +
    'NETWORK Grundstellung\nNOT Schritt_Einsteigen AND NOT Schritt_Warnen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;\n\n' +
    'NETWORK Einsteigen -> Warnen\nSchritt_Einsteigen AND S_Abfahrt AND Kette_OK AND NOT Stoerung => S Schritt_Warnen, R Schritt_Einsteigen;\n\n' +
    'NETWORK Warnen -> Fahrt\nSchritt_Warnen AND TON(T_Warnen, T#2S) => S Schritt_Fahrt, R Schritt_Warnen;\n\n' +
    'NETWORK Fahrt -> Einsteigen\nSchritt_Fahrt AND Ankunft => S Schritt_Einsteigen, R Schritt_Fahrt;\n\n' +
    'NETWORK Kette offen\nNOT Kette_OK AND (Schritt_Warnen OR Schritt_Fahrt) => S Stoerung, S Schritt_Einsteigen, R Schritt_Warnen, R Schritt_Fahrt;\n\n' +
    'NETWORK Quittieren\nQuittieren AND Kette_OK => R Stoerung;\n\n' +
    'NETWORK Vorwarnung\nSchritt_Warnen => Hupe, Ampel_Gelb;\n\n' +
    'NETWORK Fahrt\nSchritt_Fahrt AND Kette_OK => Antrieb, Ampel_Gruen;\n\n' +
    'NETWORK Stoerung\nStoerung => Ampel_Rot;',
  man:'schrittkette', must:['CMP','TON','SET','RESET','PARALLEL','MULTI_OUT'],
  hint:'Baue Netzwerk für Netzwerk und teste zwischendurch. Die Schrittkette aus den letzten Aufgaben ist das Gerüst.',
  hint2:'NW 6 ist der Kern: Bricht die Kette in Warnen oder Fahrt, geht alles zurück ins Einsteigen und die Störung wird gespeichert.',
  bind:CHAIN.concat(['windSpeed=Wind_kmh','displayValue=Wind_kmh','displayLabel:"WIND km/h"','motorOn=Antrieb','hornActive=Hupe','lightYellow=Ampel_Gelb','lightGreen=Ampel_Gruen','lightRed=Ampel_Rot','faultActive=Stoerung','cabinInStation=Schritt_Einsteigen']) });
})();
