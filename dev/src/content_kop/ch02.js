/* ===== KOP QUEST · KAPITEL 2 — Öffner und Parallelzweige ===== */
(function(){
defKop({ id:'k2_oeffner', ch:2, title:'Rot bei offener Tür',
  story:'Eine Kabinentür steht offen, und die Ampel am Bahnsteig bleibt dunkel. Die rote Lampe soll leuchten, solange die Tür NICHT geschlossen ist.',
  brief:'Die rote Ampel leuchtet, solange die Tür <b>nicht</b> geschlossen ist.<br>Dafür brauchst du einen <b>Öffner</b>: Kontakt antippen → <b>Öffner</b>.',
  learn:'Der Öffner leitet, wenn seine Variable 0 ist.',
  take:'Der <b>Öffner</b> <code>—|/|—</code> ist das Gegenstück zum Schliesser: Er leitet bei Signal 0 und öffnet bei Signal 1.',
  vars:{ Tuer_Zu:false, Ampel_Rot:false },
  tests: truth(['Tuer_Zu'], e => ({ Ampel_Rot: !e.Tuer_Zu })),
  ref:'NETWORK Tuer offen\nNOT Tuer_Zu => Ampel_Rot;', man:'oeffner', must:['NC'],
  hint:'Die Lampe soll leuchten, wenn das Signal 0 ist — dafür gibt es den Öffner.',
  bind:['lightRed=Ampel_Rot','chainDoor=Tuer_Zu'] });

defKop({ id:'k2_parallel', ch:2, title:'Zwei Hupentaster',
  story:'Die Hupe soll sich vom Stationspult UND von der Kabine aus auslösen lassen. Egal welcher Taster — Hauptsache, sie tönt.',
  brief:'Die Hupe tönt, wenn der Hupentaster am Pult <b>oder</b> der in der Kabine gedrückt ist.<br>Kontakt antippen → <b>Parallelzweig</b>.',
  learn:'Parallelschaltung = ODER.',
  take:'Kontakte <b>parallel</b> (übereinander) bilden ein ODER: Es genügt, wenn ein Zweig leitet.',
  vars:{ S_Hupe_Pult:false, S_Hupe_Kabine:false, Hupe:false },
  tests: truth(['S_Hupe_Pult','S_Hupe_Kabine'], e => ({ Hupe: e.S_Hupe_Pult || e.S_Hupe_Kabine })),
  ref:'NETWORK Hupe\nS_Hupe_Pult OR S_Hupe_Kabine => Hupe;', man:'parallel', must:['PARALLEL'],
  hint:'Zwei Wege, auf denen der Strom zur Spule kommt.',
  bind:['hornActive=Hupe'] });

defKop({ id:'k2_notaus', ch:2, title:'Not-Halt ist ein Öffner',
  story:'Der Not-Halt ist als Öffner verdrahtet: Im Normalbetrieb ist <code>Not_Halt_OK</code> 1, bricht ein Draht, fällt es auf 0 und die Bahn steht. „Drahtbruchsicher“, brummt der Werkmeister.',
  brief:'<b>NW 1:</b> Der Antrieb läuft, wenn Taster Fahrt gedrückt und der Not-Halt-Kreis OK ist.<br><b>NW 2:</b> Die rote Ampel leuchtet, wenn der Not-Halt-Kreis <b>nicht</b> OK ist.',
  learn:'Drahtbruchsicherheit: Ein im Feld als Öffner verdrahtetes Signal wird im Programm mit einem Schliesser abgefragt.',
  take:'Sicherheitssignale werden im Feld als <b>Öffner</b> verdrahtet (1 = alles in Ordnung). Im Programm fragst du sie mit dem <b>Schliesser</b> ab — ein Drahtbruch wirkt dann wie ein gedrückter Not-Halt.',
  vars:{ S_Fahrt:false, Not_Halt_OK:false, Antrieb:false, Ampel_Rot:false },
  tests: truth(['S_Fahrt','Not_Halt_OK'], e => ({ Antrieb: e.S_Fahrt && e.Not_Halt_OK, Ampel_Rot: !e.Not_Halt_OK })),
  ref:'NETWORK Antrieb\nS_Fahrt AND Not_Halt_OK => Antrieb;\n\nNETWORK Not-Halt Meldung\nNOT Not_Halt_OK => Ampel_Rot;', man:'oeffner', must:['NC','SERIES'],
  hint:'Not_Halt_OK = 1 bedeutet „in Ordnung“. Für den Antrieb also ein Schliesser.',
  bind:['motorOn=Antrieb','chainStop=Not_Halt_OK','lightRed=Ampel_Rot'] });

defKop({ id:'k2_tuer', ch:2, title:'Tür von zwei Seiten',
  story:'Die Kabinentür lässt sich vom Bahnsteig und aus der Kabine öffnen — aber nur, wenn die Kabine wirklich in der Station steht. Sonst öffnet sie über dem Abgrund.',
  brief:'Die Tür öffnet, wenn die Kabine in der Station steht <b>und</b> der Türtaster am Bahnsteig <b>oder</b> der in der Kabine gedrückt ist.',
  learn:'Reihe und Parallelzweig kombinieren.',
  take:'Ein Parallelzweig kann <b>in Reihe</b> mit weiteren Kontakten liegen: Erst muss der Zweig leiten, dann der Kontakt dahinter.',
  vars:{ Kabine_da:false, S_Tuer_Station:false, S_Tuer_Kabine:false, Tuer_Auf:false },
  tests: truth(['Kabine_da','S_Tuer_Station','S_Tuer_Kabine'], e => ({ Tuer_Auf: e.Kabine_da && (e.S_Tuer_Station || e.S_Tuer_Kabine) })),
  ref:'NETWORK Tuer oeffnen\nKabine_da AND (S_Tuer_Station OR S_Tuer_Kabine) => Tuer_Auf;', man:'parallel', must:['PARALLEL','SERIES'],
  hint:'Zuerst Kabine_da, dahinter ein Kontakt mit Parallelzweig für die beiden Taster.',
  hint2:'Den Taster-Kontakt antippen → Parallelzweig → zweiten Taster wählen.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf'] });

defKop({ id:'k2_tuer_dbg', ch:2, title:'Tür über dem Abgrund', debug:true,
  story:'Die Kabinentür öffnet sich auf Knopfdruck auch mitten auf der Strecke! ARIA hat den Kontakt „Kabine in Station“ parallel statt in Reihe gelegt.',
  brief:'Symptom: Die Tür öffnet auch ohne Kabine.<br>Soll: Die Tür öffnet nur, wenn die Kabine in der Station steht <b>und</b> der Türtaster gedrückt ist. Korrigiere das Netzwerk.',
  learn:'Reihe und Parallel nicht verwechseln.',
  take:'Parallel = ODER, Reihe = UND. Eine Sicherheitsbedingung im Parallelzweig ist wirkungslos — sie wird einfach umgangen.',
  vars:{ Kabine_da:false, S_Tuer:false, Tuer_Auf:false },
  tests: truth(['Kabine_da','S_Tuer'], e => ({ Tuer_Auf: e.Kabine_da && e.S_Tuer })),
  start:'NETWORK Tuer oeffnen\nKabine_da OR S_Tuer => Tuer_Auf;', ref:'NETWORK Tuer oeffnen\nKabine_da AND S_Tuer => Tuer_Auf;', man:'parallel', must:['SERIES'],
  hint:'Beide Bedingungen müssen gleichzeitig erfüllt sein.',
  hint2:'Lösche den unteren Zweig und setze S_Tuer mit „Kontakt dahinter“ in Reihe.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf'] });

defKop({ id:'k2_warnung', ch:2, title:'Windwarnung',
  story:'Auf dem Grat pfeift der Wind: Die Windwarnung soll kommen, wenn der Windwächter anspricht oder der Wetterdienst ein Gewitter meldet. Gleichzeitig leuchtet die gelbe Ampel, blinken darf sie später.',
  brief:'Windwarnung und gelbe Ampel gehen an, wenn der Wind zu stark ist <b>oder</b> ein Gewitter gemeldet wird.',
  learn:'Parallelzweig mit mehreren Spulen.',
  take:'Ein Strompfad kann links verzweigen (ODER) und rechts mehrere Spulen treiben.',
  vars:{ Wind_hoch:false, Gewitter:false, Windwarnung:false, Ampel_Gelb:false },
  tests: truth(['Wind_hoch','Gewitter'], e => ({ Windwarnung: e.Wind_hoch || e.Gewitter, Ampel_Gelb: e.Wind_hoch || e.Gewitter })),
  ref:'NETWORK Windwarnung\nWind_hoch OR Gewitter => Windwarnung, Ampel_Gelb;', man:'parallel', must:['PARALLEL','MULTI_OUT'],
  hint:'Zwei Kontakte parallel, zwei Spulen.',
  bind:['windWarn=Windwarnung','lightYellow=Ampel_Gelb'] });

defKop({ id:'k2_sensor', ch:2, title:'Sensorfehler erkennen',
  story:'Jede Tür hat zwei Endschalter, links und rechts. Stimmen sie nicht überein, ist ein Sensor defekt oder die Tür verklemmt, und die Station meldet einen Sensorfehler.',
  brief:'Sensorfehler melden, wenn <b>genau einer</b> der beiden Türschalter (links, rechts) meldet: links und nicht rechts <b>oder</b> nicht links und rechts.',
  learn:'Exklusiv-ODER (XOR) aus Reihe, Parallel und Öffnern bauen.',
  take:'Ein <b>XOR</b> entsteht im Kontaktplan aus zwei Zweigen: Schliesser/Öffner in Reihe, oben und unten vertauscht.',
  vars:{ Tuer_L:false, Tuer_R:false, Sensorfehler:false },
  tests: truth(['Tuer_L','Tuer_R'], e => ({ Sensorfehler: e.Tuer_L !== e.Tuer_R })),
  ref:'NETWORK Sensorfehler\n(Tuer_L AND NOT Tuer_R) OR (NOT Tuer_L AND Tuer_R) => Sensorfehler;', man:'parallel', must:['PARALLEL','NC'],
  hint:'Zwei Zweige: oben Tuer_L als Schliesser und Tuer_R als Öffner, unten umgekehrt.',
  bind:['faultActive=Sensorfehler','doorOpen=Tuer_L'] });

defKop({ id:'k2_betrieb', ch:2, title:'Hand oder Automatik',
  story:'Im Automatikbetrieb fährt der Antrieb, sobald eine Kabine bereit ist. Im Handbetrieb fährt er nur, solange der Tipptaster gedrückt wird.',
  brief:'Der Antrieb läuft in Automatik, wenn die Kabine startbereit ist, <b>oder</b> in Hand, solange der Tipptaster gedrückt ist.',
  learn:'Zwei Reihenschaltungen parallel.',
  take:'Jeder Parallelzweig darf selbst eine Reihenschaltung sein. So entstehen „entweder–oder“-Bedingungen für verschiedene Betriebsarten.',
  vars:{ Auto:false, Kabine_bereit:false, Hand:false, S_Tipp:false, Antrieb:false },
  tests: truth(['Auto','Kabine_bereit','Hand','S_Tipp'], e => ({ Antrieb: (e.Auto && e.Kabine_bereit) || (e.Hand && e.S_Tipp) })),
  ref:'NETWORK Antrieb\n(Auto AND Kabine_bereit) OR (Hand AND S_Tipp) => Antrieb;', man:'parallel', must:['PARALLEL','SERIES'],
  hint:'Oberer Zweig Automatik (zwei Kontakte in Reihe), unterer Zweig Hand (zwei Kontakte in Reihe).',
  bind:['motorOn=Antrieb'] });

defKop({ id:'k2_stopp_dbg', ch:2, title:'Der verkehrte Stopp', debug:true,
  story:'Die Bahn fährt nur, solange jemand den STOPP-Taster drückt. ARIA hat Schliesser und Öffner vertauscht.',
  brief:'Symptom: Der Antrieb läuft nur, wenn auch Stopp gedrückt ist.<br>Soll: Taster Fahrt schaltet den Antrieb, solange der Stopptaster nicht gedrückt ist. Korrigiere den Kontakt.',
  learn:'Schliesser und Öffner gezielt einsetzen.',
  take:'Ein <b>Stopp-Taster</b> (Signal 1 = gedrückt) gehört als <b>Öffner</b> in den Strompfad.',
  vars:{ S_Fahrt:false, S_Stopp:false, Antrieb:false },
  tests: truth(['S_Fahrt','S_Stopp'], e => ({ Antrieb: e.S_Fahrt && !e.S_Stopp })),
  start:'NETWORK Antrieb\nS_Fahrt AND S_Stopp => Antrieb;', ref:'NETWORK Antrieb\nS_Fahrt AND NOT S_Stopp => Antrieb;', man:'oeffner', must:['NC'],
  hint:'Der Stopp-Kontakt soll leiten, solange der Taster NICHT gedrückt ist.',
  bind:['motorOn=Antrieb'] });

defKop({ id:'k2_boss', ch:2, title:'Boss: Die Bahnsteigfreigabe', boss:true,
  story:'ARIA hat die Bahnsteigsteuerung verknotet: Ampeln leuchten wild, die Tür öffnet über dem Abgrund, der Antrieb ignoriert den Stopp. Der Werkmeister legt dir den Plan hin.',
  brief:'<b>NW 1:</b> Tür öffnet bei Kabine da und Türtaster (Bahnsteig oder Kabine), nicht bei Einschaltbefehl.<br><b>NW 2:</b> Antrieb bei Einschaltbefehl, Not-Halt OK, Tür nicht offen.<br><b>NW 3:</b> Rot bei Not-Halt weg oder Tür offen. Grün bei Kabine da, Tür nicht offen, Not-Halt OK.',
  learn:'Öffner, Schliesser, Reihe und Parallel sicher kombinieren.',
  take:'Sicherheit zuerst: Türen nur in der Station und nie bei laufendem Antrieb, Antrieb nie bei offener Tür oder gedrücktem Not-Halt.',
  vars:{ Kabine_da:false, S_Tuer_Station:false, S_Tuer_Kabine:false, Antrieb_Ein:false, Not_Halt_OK:false, Tuer_Offen:false, Tuer_Auf:false, Antrieb:false, Ampel_Rot:false, Ampel_Gruen:false },
  tests: truth(['Kabine_da','S_Tuer_Station','S_Tuer_Kabine','Antrieb_Ein','Not_Halt_OK','Tuer_Offen'], e => ({
    Tuer_Auf: e.Kabine_da && (e.S_Tuer_Station || e.S_Tuer_Kabine) && !e.Antrieb_Ein,
    Antrieb: e.Antrieb_Ein && e.Not_Halt_OK && !e.Tuer_Offen,
    Ampel_Rot: !e.Not_Halt_OK || e.Tuer_Offen,
    Ampel_Gruen: e.Kabine_da && !e.Tuer_Offen && e.Not_Halt_OK })),
  ref:'NETWORK Tuer\nKabine_da AND (S_Tuer_Station OR S_Tuer_Kabine) AND NOT Antrieb_Ein => Tuer_Auf;\n\nNETWORK Antrieb\nAntrieb_Ein AND Not_Halt_OK AND NOT Tuer_Offen => Antrieb;\n\nNETWORK Ampel rot\nNOT Not_Halt_OK OR Tuer_Offen => Ampel_Rot;\n\nNETWORK Ampel gruen\nKabine_da AND NOT Tuer_Offen AND Not_Halt_OK => Ampel_Gruen;',
  man:'parallel', must:['PARALLEL','NC','NETWORKS'],
  hint:'Vier Netzwerke, jedes eine Zeile aus dem Plan. Öffner für jedes „nicht“.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf','motorOn=Antrieb','lightRed=Ampel_Rot','lightGreen=Ampel_Gruen','chainStop=Not_Halt_OK'] });
})();
