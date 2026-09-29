/* ===== KOP QUEST · KAPITEL 5 — Flanken ===== */
(function(){
const seq = steps => [{ steps }];
defKop({ id:'k5_pflanke', ch:5, title:'Genau ein Zyklus',
  story:'Ein Taster ist beim Drücken viele Zyklen lang 1 — für die SPS eine Ewigkeit. Der Werkmeister zeigt dir den P-Kontakt: Er leitet nur in dem einen Zyklus, in dem das Signal von 0 auf 1 springt.',
  brief:'Der Impuls ist genau einen Zyklus lang 1, wenn der Universaltaster gedrückt wird.<br>Kontakt antippen → <b>Flanke P</b>.',
  learn:'Die P-Flanke erkennt den Wechsel von 0 auf 1.',
  take:'Der <b>P-Kontakt</b> <code>—|P|—</code> leitet nur im Zyklus der steigenden Flanke. Danach ist er wieder offen, auch wenn das Signal 1 bleibt.',
  vars:{ S_Taster:false, Impuls:false },
  timed: seq([[0,{},{Impuls:false}],[0.1,{S_Taster:true},{Impuls:true}],[0.1,{},{Impuls:false}],[0.1,{},{Impuls:false}],[0.1,{S_Taster:false},{Impuls:false}],[0.1,{S_Taster:true},{Impuls:true}],[0.1,{},{Impuls:false}]]),
  ref:'NETWORK Impuls\nP(S_Taster) => Impuls;', man:'flanken', must:['EDGE_P'],
  hint:'Ein Kontakt mit Flanke P, eine Spule.',
  bind:['hornActive=Impuls'] });

defKop({ id:'k5_zaehlen', ch:5, title:'Fahrgäste zählen',
  story:'Das Drehkreuz meldet 1, solange sich ein Arm dreht. Jeder Fahrgast soll genau einmal gezählt werden. INC erhöht eine Zahl um 1 — aber nur, wenn Strom fliesst.',
  brief:'Bei jeder steigenden Flanke des Drehkreuz-Sensors wird der Fahrgastzähler um 1 erhöht.<br>Spule antippen → <b>Rechnen</b>, dann im Feld Box <b>INC</b> wählen und den Zähler eintragen.',
  learn:'Flanke + INC = Zählen.',
  take:'Zählen geht nur mit Flanke. Ohne Flanke würde INC in <b>jedem</b> Zyklus zählen, solange das Signal 1 ist.',
  vars:{ Drehkreuz:false, Fahrgaeste:0 },
  timed: seq([[0,{},{Fahrgaeste:0}],[0.1,{Drehkreuz:true},{Fahrgaeste:1}],[0.1,{},{Fahrgaeste:1}],[0.1,{Drehkreuz:false},{Fahrgaeste:1}],[0.1,{Drehkreuz:true},{Fahrgaeste:2}],[0.1,{},{Fahrgaeste:2}],[0.1,{Drehkreuz:false},{Fahrgaeste:2}],[0.1,{Drehkreuz:true},{Fahrgaeste:3}]]),
  ref:'NETWORK Fahrgaeste zaehlen\nP(Drehkreuz) => INC(Fahrgaeste);', man:'flanken', must:['EDGE_P','INC'],
  hint:'P-Flanke auf Drehkreuz, als Ausgang die Box INC.',
  bind:['passengers=Fahrgaeste','gateOpen=Drehkreuz'] });

defKop({ id:'k5_rasend_dbg', ch:5, title:'Der rasende Zähler', debug:true,
  story:'Die Fahrgastanzeige springt bei jedem Gast um Dutzende hoch. ARIA hat beim Zählen die Flanke weggelassen.',
  brief:'Der Fahrgastzähler soll pro Betätigung des Drehkreuzes genau um 1 steigen.',
  learn:'Fehlende Flanke erkennen.',
  take:'Zählt ein Zähler „zu schnell“, fehlt fast immer die Flanke.',
  vars:{ Drehkreuz:false, Fahrgaeste:0 },
  timed: seq([[0,{Drehkreuz:true},{Fahrgaeste:1}],[0.1,{},{Fahrgaeste:1}],[0.1,{},{Fahrgaeste:1}],[0.1,{Drehkreuz:false},{Fahrgaeste:1}]]),
  start:'NETWORK Fahrgaeste zaehlen\nDrehkreuz => INC(Fahrgaeste);', ref:'NETWORK Fahrgaeste zaehlen\nP(Drehkreuz) => INC(Fahrgaeste);', man:'flanken', must:['EDGE_P'],
  hint:'Der Kontakt leitet viele Zyklen lang. Er braucht eine Flanke.',
  bind:['passengers=Fahrgaeste','gateOpen=Drehkreuz'] });

defKop({ id:'k5_sperre', ch:5, title:'Sperre auf Flanke',
  story:'Die Zugangssperre soll öffnen, wenn ein gültiger Skipass erkannt wird, und schliessen, sobald der Fahrgast durch ist — also wenn der Sensor „Person da“ auf 0 fällt.',
  brief:'<b>NW 1:</b> Steigende Flanke der Kartenprüfung (Karte gültig) setzt die Sperre auf.<br><b>NW 2:</b> Fallende Flanke des Personensensors (<b>Flanke N</b>) setzt die Sperre zurück.',
  learn:'Die N-Flanke erkennt den Wechsel von 1 auf 0.',
  take:'Der <b>N-Kontakt</b> <code>—|N|—</code> leitet im Zyklus der fallenden Flanke. Ideal für „wenn etwas vorbei ist“.',
  vars:{ Karte_OK:false, Person_da:false, Sperre_Auf:false },
  timed: seq([[0,{Person_da:true},{Sperre_Auf:false}],[0.1,{Karte_OK:true},{Sperre_Auf:true}],[0.1,{Karte_OK:false},{Sperre_Auf:true}],[0.1,{},{Sperre_Auf:true}],[0.1,{Person_da:false},{Sperre_Auf:false}],[0.1,{},{Sperre_Auf:false}]]),
  ref:'NETWORK Sperre oeffnen\nP(Karte_OK) => S Sperre_Auf;\n\nNETWORK Sperre schliessen\nN(Person_da) => R Sperre_Auf;', man:'flanken', must:['EDGE_P','EDGE_N','SET','RESET'],
  hint:'Die Flanke ein zweites Mal antippen wechselt von P zu N.',
  bind:['gateOpen=Sperre_Auf','personWaiting=Person_da'] });

defKop({ id:'k5_stromstoss', ch:5, title:'Stromstoss-Schalter',
  story:'Ein einziger Taster für die Stationsbeleuchtung: einmal drücken — an, nochmal drücken — aus. Im Treppenhaus heisst das Stromstoss-Schalter.',
  brief:'<b>NW 1:</b> Steigende Flanke des Lichtschalters → Impuls-Hilfsausgang.<br><b>NW 2:</b> Die Stationsbeleuchtung wechselt mit jedem Impuls ihren Zustand: (Impuls und nicht Lampe) oder (nicht Impuls und Lampe).',
  learn:'Umschalten mit Flanke und XOR-Struktur.',
  take:'Beim <b>Stromstoss</b> wechselt der Ausgang bei jeder Flanke. Ohne Flanke würde er in jedem Zyklus hin und her springen.',
  vars:{ S_Licht:false, Impuls:false, Beleuchtung:false },
  timed: seq([[0,{S_Licht:true},{Beleuchtung:true}],[0.1,{},{Beleuchtung:true}],[0.1,{S_Licht:false},{Beleuchtung:true}],[0.1,{S_Licht:true},{Beleuchtung:false}],[0.1,{},{Beleuchtung:false}],[0.1,{S_Licht:false},{Beleuchtung:false}],[0.1,{S_Licht:true},{Beleuchtung:true}]]),
  ref:'NETWORK Flanke\nP(S_Licht) => Impuls;\n\nNETWORK Umschalten\n(Impuls AND NOT Beleuchtung) OR (NOT Impuls AND Beleuchtung) => Beleuchtung;', man:'flanken', must:['EDGE_P','PARALLEL'],
  hint:'Im oberen Zweig schaltet der Impuls ein, im unteren hält sich die Beleuchtung, solange kein Impuls kommt.',
  bind:['lightsOn=Beleuchtung'] });

defKop({ id:'k5_hupe', ch:5, title:'Hupe nur bei neuer Störung',
  story:'Erinnerst du dich an die Hupe aus Kapitel 4? Sie tönte nach dem Quittieren wieder, solange die Störung anstand. Mit einer Flanke meldet sie nur neue Störungen.',
  brief:'<b>NW 1:</b> Steigende Flanke der Störmeldung setzt die Hupe.<br><b>NW 2:</b> Die Quittiertaste setzt die Hupe zurück.',
  learn:'Flanke an einer Meldung: nur neue Ereignisse melden.',
  take:'Mit der Flanke löst nur das <b>Kommen</b> einer Störung die Hupe aus. Nach dem Quittieren bleibt sie still, bis die nächste Störung kommt.',
  vars:{ Stoerung:false, Quittieren:false, Hupe:false },
  timed: seq([[0,{Stoerung:true},{Hupe:true}],[0.1,{},{Hupe:true}],[0.1,{Quittieren:true},{Hupe:false}],[0.1,{Quittieren:false},{Hupe:false}],[0.1,{Stoerung:false},{Hupe:false}],[0.1,{Stoerung:true},{Hupe:true}]]),
  ref:'NETWORK Hupe ein\nP(Stoerung) => S Hupe;\n\nNETWORK Hupe aus\nQuittieren => R Hupe;', man:'flanken', must:['EDGE_P','SET','RESET'],
  hint:'Wie in Kapitel 4, nur mit einer P-Flanke am Setzen.',
  bind:['hornActive=Hupe','faultActive=Stoerung'] });

defKop({ id:'k5_quit', ch:5, title:'Quittieren mit Flanke',
  story:'Ein Techniker hat den Quittiertaster mit einem Kabelbinder festgeklemmt — jede Störung wird sofort wieder gelöscht, ohne dass jemand hinsieht. Quittieren soll nur im Moment des Drückens wirken.',
  brief:'<b>NW 1:</b> Der Seilfehler-Melder setzt die Störung.<br><b>NW 2:</b> Steigende Flanke der Quittiertaste und nicht Seilfehler setzt die Störung zurück.',
  learn:'Bedienbefehle mit Flanke auswerten.',
  take:'Bedienbefehle wie Quittieren wertet man mit <b>Flanke</b> aus. Ein klemmender Taster kann so nichts dauerhaft überbrücken.',
  vars:{ Seil_Fehler:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{Quittieren:true},{Stoerung:false}],[0.1,{Seil_Fehler:true},{Stoerung:true}],[0.1,{Seil_Fehler:false},{Stoerung:true}],[0.1,{},{Stoerung:true}],[0.1,{Quittieren:false},{Stoerung:true}],[0.1,{Quittieren:true},{Stoerung:false}]]),
  ref:'NETWORK Stoerung speichern\nSeil_Fehler => S Stoerung;\n\nNETWORK Quittieren\nP(Quittieren) AND NOT Seil_Fehler => R Stoerung;', man:'flanken', must:['EDGE_P','SET','RESET'],
  hint:'Wie in Kapitel 4, aber Quittieren mit P-Flanke.',
  bind:['faultActive=Stoerung','chainRope=Seil_Fehler'] });

defKop({ id:'k5_nflanke_dbg', ch:5, title:'Zu spät gezählt', debug:true,
  story:'Die Fahrgastzählung soll beim Drücken des Zähltasters zählen. ARIA hat die Flanke umgedreht — jetzt zählt die Anlage erst beim Loslassen.',
  brief:'Der Fahrgastzähler steigt im Zyklus, in dem der Zähltaster gedrückt wird.',
  learn:'P- und N-Flanke unterscheiden.',
  take:'P = steigend (0 → 1, Drücken), N = fallend (1 → 0, Loslassen).',
  vars:{ S_Zaehlen:false, Fahrgaeste:0 },
  timed: seq([[0,{S_Zaehlen:true},{Fahrgaeste:1}],[0.1,{},{Fahrgaeste:1}],[0.1,{S_Zaehlen:false},{Fahrgaeste:1}]]),
  start:'NETWORK Zaehlen\nN(S_Zaehlen) => INC(Fahrgaeste);', ref:'NETWORK Zaehlen\nP(S_Zaehlen) => INC(Fahrgaeste);', man:'flanken', must:['EDGE_P'],
  hint:'Welche Flanke gehört zum Drücken?',
  bind:['passengers=Fahrgaeste'] });

defKop({ id:'k5_start', ch:5, title:'Start nur auf neuen Tastendruck',
  story:'Ein Fahrgast lehnt am Start-Taster. Sobald die Tür zu ist, fährt die Bahn los — ohne dass der Bediener das wollte. Der Antrieb darf nur auf einen neuen Tastendruck anlaufen.',
  brief:'<b>NW 1:</b> Steigende Flanke des Start-Tasters und geschlossene Kabinentür setzen den Antrieb.<br><b>NW 2:</b> Stopp-Taster oder offene Kabinentür setzt den Antrieb zurück.',
  learn:'Startbefehle mit Flanke: kein Anlaufen durch Dauersignal.',
  take:'Startbefehle mit <b>Flanke</b> verhindern ungewolltes Anlaufen, wenn eine Bedingung später erfüllt wird oder ein Taster klemmt.',
  vars:{ S_Start:false, S_Stopp:false, Tuer_Zu:false, Antrieb:false },
  timed: seq([[0,{S_Start:true},{Antrieb:false}],[0.1,{Tuer_Zu:true},{Antrieb:false}],[0.1,{S_Start:false},{Antrieb:false}],[0.1,{S_Start:true},{Antrieb:true}],[0.1,{S_Start:false},{Antrieb:true}],[0.1,{Tuer_Zu:false},{Antrieb:false}],[0.1,{Tuer_Zu:true},{Antrieb:false}]]),
  ref:'NETWORK Start\nP(S_Start) AND Tuer_Zu => S Antrieb;\n\nNETWORK Stopp\nS_Stopp OR NOT Tuer_Zu => R Antrieb;', man:'flanken', must:['EDGE_P','SET','RESET'],
  hint:'Der Start-Kontakt bekommt eine P-Flanke.',
  bind:['motorOn=Antrieb','chainDoor=Tuer_Zu'] });

defKop({ id:'k5_boss', ch:5, title:'Boss: Das Drehkreuz', boss:true,
  story:'ARIA lässt das Drehkreuz rattern: Gäste werden doppelt gezählt, die Sperre bleibt offen, der Zähler geht nie auf null. Der Werkmeister: „Flanken, überall Flanken.“',
  brief:'<b>NW 1:</b> Steigende Flanke der Kartenprüfung und Person am Drehkreuz setzt die Sperre auf<br><b>NW 2:</b> Fallende Flanke des Personensensors setzt die Sperre zurück <b>und</b> erhöht den Fahrgastzähler (INC), zwei Ausgänge im selben Netzwerk<br><b>NW 3:</b> Steigende Flanke des Abfahrtsignals setzt den Fahrgastzähler auf 0 (Box <b>MOVE</b>: IN = 0, OUT = Zähler)',
  learn:'Flanken für Ereignisse: Öffnen, Durchgang zählen, Zähler zurücksetzen.',
  take:'Jedes <b>Ereignis</b> (Karte erkannt, Person durch, Abfahrt) ist eine Flanke. Zustände (Sperre offen) werden mit S/R gespeichert.',
  vars:{ Karte_OK:false, Person_da:false, Abfahrt:false, Sperre_Auf:false, Fahrgaeste:0 },
  timed: seq([[0,{Karte_OK:true},{Sperre_Auf:false}],[0.1,{Karte_OK:false, Person_da:true},{Sperre_Auf:false}],[0.1,{Karte_OK:true},{Sperre_Auf:true, Fahrgaeste:0}],[0.1,{Karte_OK:false},{Sperre_Auf:true}],[0.1,{Person_da:false},{Sperre_Auf:false, Fahrgaeste:1}],[0.1,{},{Fahrgaeste:1}],[0.1,{Person_da:true, Karte_OK:true},{Sperre_Auf:true}],[0.1,{Person_da:false, Karte_OK:false},{Fahrgaeste:2}],[0.1,{Abfahrt:true},{Fahrgaeste:0}],[0.1,{},{Fahrgaeste:0}]]),
  ref:'NETWORK Sperre oeffnen\nP(Karte_OK) AND Person_da => S Sperre_Auf;\n\nNETWORK Durchgang\nN(Person_da) => R Sperre_Auf, INC(Fahrgaeste);\n\nNETWORK Abfahrt\nP(Abfahrt) => MOVE(0, Fahrgaeste);',
  man:'flanken', must:['EDGE_P','EDGE_N','INC','MOVE'],
  hint:'NW 2: Spule „R Sperre_Auf“, dann „weitere Spule“ und daraus mit „Rechnen“ eine INC-Box machen.',
  bind:['gateOpen=Sperre_Auf','personWaiting=Person_da','passengers=Fahrgaeste','motorOn=Abfahrt'] });
})();
