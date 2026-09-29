/* ===== KOP QUEST · KAPITEL 1 — Strom fliesst: Schliesser, Spule, Reihe ===== */
(function(){
defKop({ id:'k1_licht', ch:1, title:'Licht in der Station',
  story:'Stockdunkel in der Bergstation. Der Werkmeister leuchtet mit der Taschenlampe auf den leeren Schaltschrank: „Der Lichtschalter ist verdrahtet, die Lampen auch. Dazwischen fehlt nur dein erster Strompfad.“',
  brief:'Zeichne ein Netzwerk: Der Schliesser <code>S_Licht</code> schaltet die Spule <code>Beleuchtung</code>.<br>Tippe den Kontakt <b>??</b> an und klicke links in der Variablenliste auf <code>S_Licht</code>. Dann die Spule antippen und <code>Beleuchtung</code> wählen.',
  learn:'Ein Strompfad: Stromschiene → Schliesser → Spule.',
  take:'Ein <b>Schliesser</b> leitet, wenn sein Signal 1 ist. Fliesst Strom bis zur <b>Spule</b>, wird ihre Variable 1 — sonst 0.',
  vars:{ S_Licht:false, Beleuchtung:false },
  tests: truth(['S_Licht'], e => ({ Beleuchtung: e.S_Licht })),
  ref:'NETWORK Beleuchtung\nS_Licht => Beleuchtung;', man:'grundlagen', must:['NO','COIL'],
  hint:'Ein Kontakt, eine Spule: S_Licht links, Beleuchtung rechts.',
  hint2:'Tippe erst das Element an, dann die Variable in der Liste. Rote „??“ zeigen offene Stellen.',
  bind:['lightsOn=Beleuchtung'] });

defKop({ id:'k1_sperre', ch:1, title:'Zugangssperre',
  story:'Am Drehkreuz drängen sich die ersten Gäste. ARIA hat die Sperre auf Dauer-Offen gestellt. Die Sperre darf nur öffnen, wenn jemand davorsteht UND der Skipass gültig ist.',
  brief:'<code>Sperre_Auf</code> soll 1 sein, wenn <code>Person_da</code> <b>und</b> <code>Karte_OK</code> 1 sind.<br>Zwei Schliesser <b>in Reihe</b>: Kontakt antippen → <b>Kontakt dahinter</b>.',
  learn:'Reihenschaltung = UND: Strom fliesst nur, wenn alle Kontakte leiten.',
  take:'Kontakte <b>hintereinander</b> (in Reihe) bilden ein UND. Ist ein Kontakt offen, kommt kein Strom zur Spule.',
  vars:{ Person_da:false, Karte_OK:false, Sperre_Auf:false },
  tests: truth(['Person_da','Karte_OK'], e => ({ Sperre_Auf: e.Person_da && e.Karte_OK })),
  ref:'NETWORK Zugangssperre\nPerson_da AND Karte_OK => Sperre_Auf;', man:'grundlagen', must:['SERIES'],
  hint:'Zwei Bedingungen, die beide erfüllt sein müssen: in Reihe.',
  bind:['gateOpen=Sperre_Auf','personWaiting=Person_da'] });

defKop({ id:'k1_ampel_dbg', ch:1, title:'Vertauschte Spule', debug:true,
  story:'Die Ampel am Bahnsteig zeigt Rot, sobald die Einstiegsfreigabe kommt. ARIA hat im Netzwerk die Spule umbeschriftet. Ein Fahrgast bleibt verwirrt stehen.',
  brief:'Die Einstiegsfreigabe soll die <b>grüne</b> Ampel am Bahnsteig einschalten. Die rote Lampe bleibt in diesem Netzwerk unberührt.<br>Finde den Fehler im vorhandenen Netzwerk und korrigiere ihn.',
  learn:'Spulen-Variablen prüfen: Welche Variable schreibt ein Netzwerk?',
  take:'Jede Spule <b>schreibt</b> ihre Variable in jedem Zyklus. Eine falsche Spule schaltet das falsche Gerät — und lässt das richtige ausser Kontrolle.',
  vars:{ S_Einstieg:false, Ampel_Gruen:false, Ampel_Rot:false },
  tests: truth(['S_Einstieg'], e => ({ Ampel_Gruen: e.S_Einstieg, Ampel_Rot: false })),
  start:'NETWORK Einstieg\nS_Einstieg => Ampel_Rot;', ref:'NETWORK Einstieg\nS_Einstieg => Ampel_Gruen;', man:'grundlagen',
  hint:'Schau dir die Spule an: Welche Lampe schaltet sie?',
  bind:['lightGreen=Ampel_Gruen','lightRed=Ampel_Rot'] });

defKop({ id:'k1_netzwerke', ch:1, title:'Zwei Netzwerke',
  story:'Der Werkmeister zeigt auf zwei Taster am Pult: „Einer für die Hupe, einer fürs Licht. Zwei Aufgaben — zwei Netzwerke. So bleibt der Plan lesbar.“',
  brief:'Netzwerk 1: Der Hupentaster am Pult schaltet die Hupe.<br>Netzwerk 2: Der Lichtschalter schaltet die Stationsbeleuchtung.<br>Ein neues Netzwerk legst du unten mit <b>+ Netzwerk</b> an.',
  learn:'Ein Programm besteht aus mehreren Netzwerken, die der Reihe nach bearbeitet werden.',
  take:'Die SPS arbeitet die Netzwerke <b>von oben nach unten</b> ab, in jedem Zyklus. Pro Aufgabe ein Netzwerk mit sprechendem Titel macht den Plan lesbar.',
  vars:{ S_Hupe:false, S_Licht:false, Hupe:false, Beleuchtung:false },
  tests: truth(['S_Hupe','S_Licht'], e => ({ Hupe: e.S_Hupe, Beleuchtung: e.S_Licht })),
  ref:'NETWORK Hupe\nS_Hupe => Hupe;\n\nNETWORK Beleuchtung\nS_Licht => Beleuchtung;', man:'grundlagen', must:['NETWORKS'],
  hint:'Zwei unabhängige Strompfade — zwei Netzwerke.',
  bind:['hornActive=Hupe','lightsOn=Beleuchtung'] });

defKop({ id:'k1_antrieb', ch:1, title:'Antrieb freigeben',
  story:'Das Antriebsrad der Gratbahn steht. Zum Anfahren braucht es drei Dinge gleichzeitig: den Start-Taster, geschlossene Kabinentüren und einen intakten Not-Halt-Kreis.',
  brief:'Das Antriebsrad läuft, solange der Start-Taster gedrückt, die Kabinentür geschlossen und der Not-Halt-Kreis in Ordnung ist.<br><i>Hinweis:</i> Der Not-Halt-Kreis meldet 1, solange niemand den Not-Halt drückt.',
  learn:'Drei Kontakte in Reihe.',
  take:'Eine Reihenschaltung kann beliebig lang sein. Jede Bedingung ist ein Kontakt — fehlt einer, steht der Antrieb.',
  vars:{ S_Start:false, Tuer_Zu:false, Not_Halt_OK:false, Antrieb:false },
  tests: truth(['S_Start','Tuer_Zu','Not_Halt_OK'], e => ({ Antrieb: e.S_Start && e.Tuer_Zu && e.Not_Halt_OK })),
  ref:'NETWORK Antrieb\nS_Start AND Tuer_Zu AND Not_Halt_OK => Antrieb;', man:'grundlagen', must:['SERIES'],
  hint:'Drei Schliesser hintereinander, dann die Spule.',
  bind:['motorOn=Antrieb','chainStop=Not_Halt_OK','chainDoor=Tuer_Zu'] });

defKop({ id:'k1_zwei_spulen', ch:1, title:'Zwei Spulen, ein Pfad',
  story:'Fährt eine Kabine ein, soll sich die Tür öffnen und gleichzeitig die grüne Ampel leuchten. ARIA meint, dafür brauche es zwei Netzwerke. Der Werkmeister grinst: „Oder zwei Spulen am selben Pfad.“',
  brief:'Die Lichtschranke am Bahnsteig meldet eine eingefahrene Kabine. Sie schaltet <b>beide</b> Spulen, Kabinentür öffnen und grüne Ampel, im selben Netzwerk.<br>Spule antippen → <b>weitere Spule</b>.',
  learn:'Mehrere Spulen parallel am Ende eines Strompfads.',
  take:'Spulen am Ende eines Strompfads dürfen <b>parallel</b> liegen: Alle bekommen denselben Stromfluss.',
  vars:{ Kabine_da:false, Tuer_Auf:false, Ampel_Gruen:false },
  tests: truth(['Kabine_da'], e => ({ Tuer_Auf: e.Kabine_da, Ampel_Gruen: e.Kabine_da })),
  ref:'NETWORK Einfahrt\nKabine_da => Tuer_Auf, Ampel_Gruen;', man:'grundlagen', must:['MULTI_OUT'],
  hint:'Eine Spule antippen und „weitere Spule“ wählen.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf','lightGreen=Ampel_Gruen'] });

defKop({ id:'k1_bergfahrt', ch:1, title:'Bergfahrt',
  story:'Für die Bergfahrt braucht der Antrieb zwei Befehle: laufen und die Richtung „bergwärts“. Beide hängen am selben Taster — aber nur, wenn die Türen zu sind.',
  brief:'Der Bergfahrt-Taster startet den Antrieb und gibt die Richtung bergwärts vor, aber nur bei geschlossener Kabinentür.',
  learn:'Reihe und mehrere Spulen kombinieren.',
  take:'Bedingungen links, Wirkungen rechts: Das ist der Kern jedes Kontaktplans.',
  vars:{ S_Berg:false, Tuer_Zu:false, Antrieb:false, Richtung_Berg:false },
  tests: truth(['S_Berg','Tuer_Zu'], e => ({ Antrieb: e.S_Berg && e.Tuer_Zu, Richtung_Berg: e.S_Berg && e.Tuer_Zu })),
  ref:'NETWORK Bergfahrt\nS_Berg AND Tuer_Zu => Antrieb, Richtung_Berg;', man:'grundlagen', must:['SERIES','MULTI_OUT'],
  hint:'Zwei Kontakte in Reihe, zwei Spulen am Ende.',
  bind:['motorOn=Antrieb','motorDir=Richtung_Berg','chainDoor=Tuer_Zu'] });

defKop({ id:'k1_notaus_dbg', ch:1, title:'Die Sicherheitslücke', debug:true,
  story:'Bei der Probefahrt drückt der Werkmeister den Not-Halt — und die Kabine fährt weiter. ARIA hat im Antriebsnetzwerk einen Kontakt „eingespart“.',
  brief:'Der Antrieb darf nur laufen, wenn der Start-Taster gedrückt, die Kabinentür geschlossen und der Not-Halt-Kreis in Ordnung ist. Ergänze, was fehlt.',
  learn:'Fehlende Sicherheitsbedingung im Strompfad finden.',
  take:'Sicherheitsbedingungen gehören <b>in Reihe</b> vor jeden Antrieb. Fehlt ein Kontakt, wirkt die Sicherheitseinrichtung nicht.',
  vars:{ S_Start:false, Tuer_Zu:false, Not_Halt_OK:false, Antrieb:false },
  tests: truth(['S_Start','Tuer_Zu','Not_Halt_OK'], e => ({ Antrieb: e.S_Start && e.Tuer_Zu && e.Not_Halt_OK })),
  start:'NETWORK Antrieb\nS_Start AND Tuer_Zu => Antrieb;', ref:'NETWORK Antrieb\nS_Start AND Tuer_Zu AND Not_Halt_OK => Antrieb;', man:'grundlagen',
  hint:'Welche der drei Bedingungen fehlt im Strompfad?',
  bind:['motorOn=Antrieb','emergencyLamp:false','chainStop=Not_Halt_OK'] });

defKop({ id:'k1_einstieg', ch:1, title:'Einstiegssignal',
  story:'Wenn die Kabine in der Station steht und die Tür offen ist, soll ein kurzer Signalton die Fahrgäste zum Einsteigen einladen. Vorerst tönt er, solange beides zutrifft.',
  brief:'Der Signalton der Hupe ertönt, wenn die Kabine in der Station steht und die Kabinentür offen ist. Die gelbe Ampel leuchtet unter derselben Bedingung.',
  learn:'Übung: Reihe mit zwei Spulen.',
  take:'Meldungen (Hupe, Lampe) hängen oft an denselben Bedingungen wie die Aktion — eine weitere Spule genügt.',
  vars:{ Kabine_da:false, Tuer_Offen:false, Hupe:false, Ampel_Gelb:false },
  tests: truth(['Kabine_da','Tuer_Offen'], e => ({ Hupe: e.Kabine_da && e.Tuer_Offen, Ampel_Gelb: e.Kabine_da && e.Tuer_Offen })),
  ref:'NETWORK Einstieg\nKabine_da AND Tuer_Offen => Hupe, Ampel_Gelb;', man:'grundlagen',
  hint:'Zwei Kontakte in Reihe, zwei Spulen.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Offen','hornActive=Hupe','lightYellow=Ampel_Gelb'] });

defKop({ id:'k1_boss', ch:1, title:'Boss: Die Station erwacht', boss:true,
  story:'Die erste Schicht beginnt. ARIA hat alle Netzwerke gelöscht und lacht über den Stationslautsprecher: „Ohne mich bleibt hier alles dunkel.“ Der Werkmeister reicht dir den Plan: drei Netzwerke, und die Station lebt.',
  brief:'<b>NW 1 Beleuchtung:</b> Der Lichtschalter schaltet die Stationsbeleuchtung.<br><b>NW 2 Zugang:</b> Die Sperre am Drehkreuz öffnet, wenn eine Person davorsteht, ihre Karte gültig ist <b>und</b> die Kabine in der Station steht.<br><b>NW 3 Abfahrt:</b> Start-Taster, geschlossene Kabinentür und intakter Not-Halt-Kreis schalten gemeinsam den Antrieb und die grüne Ampel.',
  learn:'Mehrere Netzwerke mit Reihenschaltungen und mehreren Spulen sicher aufbauen.',
  take:'Ein Kontaktplan liest sich wie ein Schaltplan: links die Bedingungen, rechts die Wirkungen, jedes Netzwerk eine Aufgabe.',
  vars:{ S_Licht:false, Person_da:false, Karte_OK:false, Kabine_da:false, S_Start:false, Tuer_Zu:false, Not_Halt_OK:false, Beleuchtung:false, Sperre_Auf:false, Antrieb:false, Ampel_Gruen:false },
  tests: truth(['S_Licht','Person_da','Karte_OK','Kabine_da'], e => ({ Beleuchtung: e.S_Licht, Sperre_Auf: e.Person_da && e.Karte_OK && e.Kabine_da, Antrieb:false, Ampel_Gruen:false }))
    .concat(truth(['S_Start','Tuer_Zu','Not_Halt_OK'], e => ({ Antrieb: e.S_Start && e.Tuer_Zu && e.Not_Halt_OK, Ampel_Gruen: e.S_Start && e.Tuer_Zu && e.Not_Halt_OK, Sperre_Auf:false }))),
  ref:'NETWORK Beleuchtung\nS_Licht => Beleuchtung;\n\nNETWORK Zugang\nPerson_da AND Karte_OK AND Kabine_da => Sperre_Auf;\n\nNETWORK Abfahrt\nS_Start AND Tuer_Zu AND Not_Halt_OK => Antrieb, Ampel_Gruen;', man:'grundlagen', must:['NETWORKS','MULTI_OUT'],
  hint:'Drei Netzwerke, eines nach dem anderen. Teste zwischendurch.',
  bind:['lightsOn=Beleuchtung','gateOpen=Sperre_Auf','personWaiting=Person_da','cabinInStation=Kabine_da','motorOn=Antrieb','lightGreen=Ampel_Gruen','chainStop=Not_Halt_OK','chainDoor=Tuer_Zu'] });
})();
