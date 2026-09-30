/* ===== KOP QUEST · KAPITEL 7 — Zeiten II: Blinker, Überwachung, Vorwarnung ===== */
(function(){
const seq = steps => [{ steps }];
const G = [0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0];   // Ampel_Gelb je 0,25-s-Zyklus ab t = 0,25 (siehe Blinker)
defKop({ id:'k7_taktmerker', ch:7, title:'Der Taktmerker',
  story:'Warnlampen müssen blinken — ein Dauerlicht übersieht man. Die SPS liefert dafür einen fertigen Takt: den Taktmerker <code>Takt_1Hz</code>, der jede halbe Sekunde wechselt.',
  brief:'Bei Windwarnung blinkt die gelbe Ampel im Takt des <b>1-Hz-Taktmerkers</b>, sonst bleibt sie aus.',
  learn:'Blinken mit einem Taktmerker.',
  take:'Ein <b>Taktmerker</b> ist ein von der CPU erzeugtes Taktsignal. In Reihe mit einer Bedingung lässt er eine Lampe blinken.',
  vars:{ Windwarnung:false, Takt_1Hz:false, Ampel_Gelb:false },
  tests: truth(['Windwarnung','Takt_1Hz'], e => ({ Ampel_Gelb: e.Windwarnung && e.Takt_1Hz })),
  ref:'NETWORK Blinken\nWindwarnung AND Takt_1Hz => Ampel_Gelb;', man:'timer2', must:['SERIES'],
  hint:'Zwei Kontakte in Reihe.',
  bind:['lightYellow=Ampel_Gelb','windWarn=Windwarnung'] });

defKop({ id:'k7_blinker', ch:7, title:'Der eigene Blinker',
  story:'Auf der Stütze gibt es keinen Taktmerker — nur einen Timer. Der Werkmeister zeichnet dir einen Taktgeber auf: ein TON, der sich selbst zurücksetzt, und ein Stromstoss, der bei jedem Impuls umschaltet.',
  brief:'<b>NW 1:</b> <b>TON 500 ms</b> mit Öffner auf den eigenen Impulsmerker (Impuls alle ~0,5 s).<br><b>NW 2:</b> Jeder Impuls kippt den Blinkmerker.<br><b>NW 3:</b> Bei Warnung blinkt Gelb.<br><i>Im Test (Zyklus 0,25 s) wechselt Gelb etwa jede Sekunde.</i>',
  learn:'Taktgeber aus TON mit Selbstrücksetzung und Stromstoss.',
  take:'Ein TON, dessen Ausgang den eigenen Eingang abschaltet, erzeugt regelmässige <b>Impulse</b>. Mit einem Stromstoss wird daraus ein Blinktakt.',
  vars:{ Warnung:false, Impuls:false, Blink:false, Ampel_Gelb:false },
  timed: seq([[0,{Warnung:true},{Ampel_Gelb:false}]].concat(G.map((g, i) => [0.25, i === 16 ? { Warnung:false } : {}, { Ampel_Gelb: i === 16 ? false : !!g }]))),
  ref:'NETWORK Takt\nNOT Impuls AND TON(T_Takt, T#500MS) => Impuls;\n\nNETWORK Umschalten\n(Impuls AND NOT Blink) OR (NOT Impuls AND Blink) => Blink;\n\nNETWORK Lampe\nWarnung AND Blink => Ampel_Gelb;', man:'timer2', must:['TON','NC','PARALLEL'],
  hint:'NW 1: Öffner Impuls, dahinter die TON-Box, Spule Impuls.',
  hint2:'NW 2 ist der Stromstoss aus Kapitel 5 — nur mit Impuls statt einer Flanke.',
  bind:['lightYellow=Ampel_Gelb'] });

defKop({ id:'k7_ueberwachung', ch:7, title:'Tür-Überwachung',
  story:'Die Tür bekommt den Befehl „schliessen“, bleibt stecken, und die Kabine wartet ewig. Eine Überwachungszeit meldet den Fehler, wenn die Tür nach 4 Sekunden nicht zu ist.',
  brief:'Ist die Tür <b>4 s</b> nach dem Schliessbefehl noch nicht zu, wird die Störung gesetzt. Quittieren setzt sie zurück.',
  learn:'Überwachungszeit: Erwartete Rückmeldung bleibt aus → Störung.',
  take:'Eine <b>Überwachungszeit</b> startet mit dem Befehl und stoppt mit der Rückmeldung. Läuft sie ab, wird eine Störung gespeichert.',
  vars:{ Tuer_Schliessen:false, Tuer_Zu:false, Quittieren:false, Stoerung:false },
  timed:[{ steps:[[0,{Tuer_Schliessen:true},{Stoerung:false}],[2,{},{Stoerung:false}],[0.1,{Tuer_Zu:true},{Stoerung:false}],[5,{},{Stoerung:false}]] },
         { steps:[[0,{Tuer_Schliessen:true},{Stoerung:false}],[3.9,{},{Stoerung:false}],[0.2,{},{Stoerung:true}],[0.1,{Tuer_Schliessen:false},{Stoerung:true}],[0.1,{Quittieren:true},{Stoerung:false}]] }],
  ref:'NETWORK Ueberwachung\nTuer_Schliessen AND NOT Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;\n\nNETWORK Quittieren\nQuittieren => R Stoerung;', man:'timer2', must:['TON','SET','RESET'],
  hint:'Der Timer läuft nur, solange Befehl da UND Rückmeldung fehlt.',
  bind:['faultActive=Stoerung','chainDoor=Tuer_Zu'] });

defKop({ id:'k7_anlauf', ch:7, title:'Anlaufwarnung',
  story:'Die Bahn darf nie ohne Vorwarnung anfahren. Nach dem Startbefehl ertönt 3 Sekunden die Hupe, die Ampel leuchtet gelb — erst dann läuft der Antrieb.',
  brief:'Start (steigende Flanke) setzt die Anlaufwarnung: Hupe und Gelb an. Nach <b>3 s</b> setzt sie den Antrieb und endet. Stopp setzt Antrieb und Anlaufwarnung zurück.',
  learn:'Vorwarnphase als gespeicherter Zustand mit Zeitglied.',
  take:'Eine <b>Anlaufwarnung</b> ist ein eigener Zustand zwischen Start und Fahrt. Ein TON beendet ihn und gibt den Antrieb frei.',
  vars:{ S_Start:false, S_Stopp:false, Anlauf:false, Hupe:false, Ampel_Gelb:false, Antrieb:false },
  timed: seq([[0,{S_Start:true},{Anlauf:true, Hupe:true, Antrieb:false}],[0.1,{S_Start:false},{Hupe:true}],[2,{},{Antrieb:false, Ampel_Gelb:true}],[1,{},{Antrieb:true}],[0.1,{},{Hupe:false, Anlauf:false, Antrieb:true}],[0.1,{S_Stopp:true},{Antrieb:false}],[0.1,{S_Stopp:false, S_Start:true},{Anlauf:true, Antrieb:false}],[0.5,{S_Start:false, S_Stopp:true},{Anlauf:false}],[0.1,{},{Hupe:false}]]),
  ref:'NETWORK Start\nP(S_Start) => S Anlauf;\n\nNETWORK Warnung\nAnlauf => Hupe, Ampel_Gelb;\n\nNETWORK Anlaufzeit\nAnlauf AND TON(T_Anlauf, T#3S) => S Antrieb, R Anlauf;\n\nNETWORK Stopp\nS_Stopp => R Antrieb, R Anlauf;', man:'timer2', must:['TON','SET','RESET','EDGE_P'],
  hint:'Die Hupe hängt am Merker Anlauf, nicht am Taster.',
  bind:['hornActive=Hupe','lightYellow=Ampel_Gelb','motorOn=Antrieb'] });

defKop({ id:'k7_wind', ch:7, title:'Sturmabschaltung',
  story:'Bei Sturm muss die Gratbahn stehen. Kurze Böen darf sie aushalten, aber wenn der Windwächter 5 Sekunden ununterbrochen anspricht, wird die Fahrt gestoppt — und erst nach Quittieren bei ruhigem Wind wieder freigegeben.',
  brief:'Ist der Wind <b>5 s</b> lang zu stark, wird die Sturmabschaltung gesetzt; Quittieren löscht sie nur bei ruhigem Wind. Der Antrieb folgt dem Fahrbefehl, ausser bei Sturmabschaltung.',
  learn:'Verzögerte Abschaltung mit gespeicherter Störung.',
  take:'Abschaltungen nach Messwerten werden <b>verzögert</b> (gegen Fehlauslösung) und <b>gespeichert</b> (gegen unkontrolliertes Wiederanlaufen).',
  vars:{ Wind_hoch:false, Quittieren:false, Fahrt:true, Wind_Stopp:false, Antrieb:false },
  timed: seq([[0,{},{Antrieb:true}],[0.1,{Wind_hoch:true},{Antrieb:true}],[3,{Wind_hoch:false},{Antrieb:true}],[0.1,{Wind_hoch:true},{Antrieb:true}],[5.1,{},{Wind_Stopp:true, Antrieb:false}],[0.1,{Quittieren:true},{Wind_Stopp:true}],[0.1,{Wind_hoch:false},{Wind_Stopp:false, Antrieb:true}]]),
  ref:'NETWORK Sturm\nWind_hoch AND TON(T_Sturm, T#5S) => S Wind_Stopp;\n\nNETWORK Quittieren\nQuittieren AND NOT Wind_hoch => R Wind_Stopp;\n\nNETWORK Antrieb\nFahrt AND NOT Wind_Stopp => Antrieb;', man:'timer2', must:['TON','SET','RESET'],
  hint:'Drei Netzwerke — das Muster kennst du von den Störungen.',
  bind:['windWarn=Wind_Stopp','motorOn=Antrieb','chainWind=Wind_hoch'] });

defKop({ id:'k7_blink_dbg', ch:7, title:'Das Flackerlicht', debug:true,
  story:'Die Warnlampe flackert so schnell, dass man sie für dauernd an hält. ARIA hat im Taktgeber einen Kontakt entfernt — der Timer setzt sich nicht mehr zurück.',
  brief:'Symptom: Die gelbe Lampe flackert statt zu blinken.<br>Soll: Der Taktgeber arbeitet wie in „Der eigene Blinker“. Finde den fehlenden Kontakt.',
  learn:'Selbstrücksetzung des Taktgebers verstehen.',
  take:'Ohne den Öffner <code>Impuls</code> vor dem TON bleibt der Timer abgelaufen — der Impuls ist dauerhaft 1, und der Stromstoss schaltet in jedem Zyklus um.',
  vars:{ Warnung:false, Impuls:false, Blink:false, Ampel_Gelb:false },
  timed: seq([[0,{Warnung:true},{Ampel_Gelb:false}]].concat(G.map((g, i) => [0.25, i === 16 ? { Warnung:false } : {}, { Ampel_Gelb: i === 16 ? false : !!g }]))),
  start:'NETWORK Takt\nTON(T_Takt, T#500MS) => Impuls;\n\nNETWORK Umschalten\n(Impuls AND NOT Blink) OR (NOT Impuls AND Blink) => Blink;\n\nNETWORK Lampe\nWarnung AND Blink => Ampel_Gelb;',
  ref:'NETWORK Takt\nNOT Impuls AND TON(T_Takt, T#500MS) => Impuls;\n\nNETWORK Umschalten\n(Impuls AND NOT Blink) OR (NOT Impuls AND Blink) => Blink;\n\nNETWORK Lampe\nWarnung AND Blink => Ampel_Gelb;', man:'timer2',
  hint:'Was schaltet den Timer nach einem Impuls wieder aus?',
  bind:['lightYellow=Ampel_Gelb'] });

defKop({ id:'k7_seil', ch:7, title:'Seil blockiert',
  story:'Der Antrieb läuft, aber das Seil bewegt sich nicht — die Scheibe rutscht durch. Der Drehzahlwächter <code>Seil_bewegt</code> muss spätestens 2 Sekunden nach dem Anlaufen melden, sonst wird abgeschaltet.',
  brief:'Läuft der Antrieb, ohne dass sich das Seil innert <b>2 s</b> bewegt, wird die Seilstörung gesetzt. Sie setzt den Antrieb zurück. Quittieren löscht die Störung.',
  learn:'Stillstandsüberwachung mit Abschaltung.',
  take:'Eine <b>Stillstandsüberwachung</b> vergleicht Befehl und Bewegung. Fehlt die Bewegung zu lange, wird der Antrieb abgeschaltet und die Störung gespeichert.',
  vars:{ Antrieb:false, Seil_bewegt:false, Quittieren:false, Seil_Stoerung:false },
  timed:[{ steps:[[0,{Antrieb:true},{Seil_Stoerung:false}],[1,{Seil_bewegt:true},{Antrieb:true}],[5,{},{Antrieb:true, Seil_Stoerung:false}]] },
         { steps:[[0,{Antrieb:true},{Seil_Stoerung:false}],[2.1,{},{Seil_Stoerung:true, Antrieb:false}],[0.1,{},{Antrieb:false}],[0.1,{Quittieren:true},{Seil_Stoerung:false}]] }],
  ref:'NETWORK Ueberwachung\nAntrieb AND NOT Seil_bewegt AND TON(T_Seil, T#2S) => S Seil_Stoerung;\n\nNETWORK Abschalten\nSeil_Stoerung => R Antrieb;\n\nNETWORK Quittieren\nQuittieren => R Seil_Stoerung;', man:'timer2', must:['TON','SET','RESET'],
  hint:'Wie die Tür-Überwachung — plus ein Netzwerk, das den Antrieb zurücksetzt.',
  bind:['motorOn=Antrieb','faultActive=Seil_Stoerung','chainRope=Seil_bewegt'] });

defKop({ id:'k7_ueber_dbg', ch:7, title:'Überwachung schlägt immer an', debug:true,
  story:'Bei jedem Schliessen der Tür meldet die Anlage nach 4 Sekunden eine Störung — auch wenn die Tür längst zu ist. ARIA hat in der Überwachung einen Kontakt verändert.',
  brief:'Symptom: Die Störung kommt, obwohl die Tür rechtzeitig zu ist.<br>Soll: Sie spricht nur an, wenn die Tür nach dem Schliessbefehl <b>4 s</b> lang <b>nicht</b> zu ist.',
  learn:'Überwachungsbedingung prüfen.',
  take:'Die Überwachungszeit läuft nur, solange die Rückmeldung <b>fehlt</b> — dafür steht die Rückmeldung als Öffner im Pfad.',
  vars:{ Tuer_Schliessen:false, Tuer_Zu:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{Tuer_Schliessen:true},{Stoerung:false}],[1,{Tuer_Zu:true},{Stoerung:false}],[4,{},{Stoerung:false}]]),
  start:'NETWORK Ueberwachung\nTuer_Schliessen AND Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;\n\nNETWORK Quittieren\nQuittieren => R Stoerung;',
  ref:'NETWORK Ueberwachung\nTuer_Schliessen AND NOT Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;\n\nNETWORK Quittieren\nQuittieren => R Stoerung;', man:'timer2', must:['NC'],
  hint:'Schliesser oder Öffner — was ist hier richtig für Tuer_Zu?',
  bind:['faultActive=Stoerung','chainDoor=Tuer_Zu'] });

defKop({ id:'k7_tuerwarnung', ch:7, title:'Tür schliesst — Achtung',
  story:'Während sich die Türen schliessen, soll ein schneller Warnton klingen: Die Hupe pulsiert im Takt, solange der Befehl „Tür schliessen“ ansteht und die Tür noch nicht zu ist.',
  brief:'Solange der Schliessbefehl ansteht und die Tür noch nicht zu ist, hupt es im <b>2-Hz-Takt</b>.',
  learn:'Taktmerker für akustische Warnungen.',
  take:'Mit einem schnellen Taktmerker wird aus einer Dauerhupe ein pulsierender Warnton — gut hörbar, weniger nervig.',
  vars:{ Tuer_Schliessen:false, Tuer_Zu:false, Takt_2Hz:false, Hupe:false },
  tests: truth(['Tuer_Schliessen','Tuer_Zu','Takt_2Hz'], e => ({ Hupe: e.Tuer_Schliessen && !e.Tuer_Zu && e.Takt_2Hz })),
  ref:'NETWORK Tuerwarnung\nTuer_Schliessen AND NOT Tuer_Zu AND Takt_2Hz => Hupe;', man:'timer2', must:['NC','SERIES'],
  hint:'Drei Kontakte in Reihe, einer davon ein Öffner.',
  bind:['hornActive=Hupe','chainDoor=Tuer_Zu'] });
defKop({ id:'k7_boss', ch:7, title:'Boss: Sicher anfahren', boss:true,
  story:'ARIA lässt die Bahn ohne Warnung anrucken und ignoriert den Sturm. Der Werkmeister: „Vorwarnung, Blinklicht, Sturmstopp, und keine Fahrt, solange der Wind stoppt.“',
  brief:'Start (Flanke) ohne Sturmabschaltung setzt die Anlaufwarnung: Hupe, Gelb im <b>1-Hz-Takt</b>; nach <b>3 s</b> Antrieb setzen, Warnung aus. Wind <b>5 s</b> zu stark setzt die Sturmabschaltung. Stopp oder Sturm: Antrieb und Warnung zurück. Quittieren löscht den Sturm nur bei ruhigem Wind.',
  learn:'Zeitglieder, Speicher und Blinktakt zu einem sicheren Anlauf verbinden.',
  take:'Anlaufwarnung, Blinklicht und verzögerte Sturmabschaltung sind Standard bei jeder Seilbahn — und jetzt in deinem Programm.',
  vars:{ S_Start:false, S_Stopp:false, Wind_hoch:false, Quittieren:false, Takt_1Hz:false, Anlauf:false, Hupe:false, Ampel_Gelb:false, Antrieb:false, Wind_Stopp:false },
  timed:[{ steps:[[0,{S_Start:true, Takt_1Hz:true},{Anlauf:true, Hupe:true, Ampel_Gelb:true}],[0.5,{S_Start:false, Takt_1Hz:false},{Ampel_Gelb:false, Hupe:true}],[2.6,{},{Antrieb:true}],[0.1,{},{Anlauf:false, Hupe:false}],[0.1,{Wind_hoch:true},{Antrieb:true}],[5.1,{},{Wind_Stopp:true, Antrieb:false}],[0.1,{S_Start:true},{Anlauf:false}],[0.1,{S_Start:false, Wind_hoch:false, Quittieren:true},{Wind_Stopp:false}],[0.1,{Quittieren:false, S_Start:true},{Anlauf:true}]] },
         { steps:[[0,{S_Start:true},{Anlauf:true}],[1,{S_Start:false, S_Stopp:true},{Anlauf:false, Antrieb:false}],[0.1,{},{Hupe:false}],[3,{S_Stopp:false},{Antrieb:false}]] }],
  ref:'NETWORK Start\nP(S_Start) AND NOT Wind_Stopp => S Anlauf;\n\nNETWORK Hupe\nAnlauf => Hupe;\n\nNETWORK Blinklicht\nAnlauf AND Takt_1Hz => Ampel_Gelb;\n\nNETWORK Anlaufzeit\nAnlauf AND TON(T_Anlauf, T#3S) => S Antrieb, R Anlauf;\n\nNETWORK Sturm\nWind_hoch AND TON(T_Sturm, T#5S) => S Wind_Stopp;\n\nNETWORK Stopp\nS_Stopp OR Wind_Stopp => R Antrieb, R Anlauf;\n\nNETWORK Quittieren\nQuittieren AND NOT Wind_hoch => R Wind_Stopp;',
  man:'timer2', must:['TON','SET','RESET','EDGE_P'],
  hint:'Baue zuerst die Anlaufwarnung (NW 1–3), teste, dann den Sturm.',
  bind:['hornActive=Hupe','lightYellow=Ampel_Gelb','motorOn=Antrieb','windWarn=Wind_Stopp','chainWind=Wind_hoch'] });

})();
