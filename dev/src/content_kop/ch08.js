/* ===== KOP QUEST · KAPITEL 8 — Zähler: CTU, CTD ===== */
(function(){
const seq = steps => [{ steps }];
// n Impulse an einem Eingang: je ein Zyklus 1, ein Zyklus 0
const pulses = (inp, n, exp) => { const out = []; for(let i = 1; i <= n; i++){ out.push([0.1, { [inp]: true }, exp ? exp(i) : {}]); out.push([0.1, { [inp]: false }, {}]); } return out; };
defKop({ id:'k8_ctu', ch:8, title:'Kabine voll',
  story:'In eine Kabine passen 8 Personen. Das Drehkreuz meldet jeden Durchgang. Statt selbst mit INC zu zählen, nimmst du den fertigen Aufwärtszähler CTU.',
  brief:'<code>Drehkreuz</code> → Zähler <b>CTU</b> <code>Z_Gaeste</code> mit <code>PV</code> = 8 → <code>Kabine_voll</code>.<br>Kontakt antippen → <b>Zähler</b>, im Feld <i>PV</i> 8 eintragen.',
  learn:'CTU zählt steigende Flanken; Q = 1, sobald CV ≥ PV.',
  take:'Der <b>CTU</b> zählt jede steigende Flanke an seinem Eingang (eine Flanke braucht er nicht zusätzlich). Sein Ausgang Q wird 1, sobald der Zählerstand <b>CV</b> den Vorgabewert <b>PV</b> erreicht.',
  vars:{ Drehkreuz:false, Kabine_voll:false },
  timed: seq([[0,{},{Kabine_voll:false}]].concat(pulses('Drehkreuz', 8, i => ({ Kabine_voll: i >= 8 })), [[0.5,{},{Kabine_voll:true}]])),
  ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8) => Kabine_voll;', man:'zaehler', must:['CTU'],
  hint:'Kontakt Drehkreuz, dahinter die Zähler-Box, am Ende die Spule.',
  bind:['lightRed=Kabine_voll','gateOpen=Drehkreuz'] });

defKop({ id:'k8_reset', ch:8, title:'Zähler zurücksetzen',
  story:'Nach der Abfahrt ist die nächste Kabine leer. Der Zähler muss auf 0 zurück. Der CTU hat dafür den Eingang R.',
  brief:'Wie „Kabine voll“ (PV 8), zusätzlich setzt <code>Abfahrt</code> den Zähler zurück: im Feld <i>Reset R</i> <code>Abfahrt</code> eintragen.',
  learn:'Rücksetzeingang R eines Zählers.',
  take:'Solange <b>R</b> = 1 ist, steht der Zähler auf 0 und zählt nicht. So beginnt jede Kabine bei null.',
  vars:{ Drehkreuz:false, Abfahrt:false, Kabine_voll:false },
  timed: seq(pulses('Drehkreuz', 8, i => ({ Kabine_voll: i >= 8 })).concat([[0.1,{Abfahrt:true},{Kabine_voll:false}],[0.1,{Abfahrt:false},{}]], pulses('Drehkreuz', 3, () => ({ Kabine_voll:false })))),
  ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;', man:'zaehler', must:['CTU'],
  hint:'Die Box antippen und im Feld „Reset R“ Abfahrt eintragen.',
  bind:['lightRed=Kabine_voll','gateOpen=Drehkreuz','motorOn=Abfahrt'] });

defKop({ id:'k8_anzeige', ch:8, title:'Zählerstand anzeigen',
  story:'Der Bahnwärter will sehen, wie viele Gäste schon in der Kabine sind. Der Zählerstand CV soll aufs HMI.',
  brief:'<b>NW 1:</b> Zähler wie oben (<code>Drehkreuz</code>, PV 8, R <code>Abfahrt</code>) → <code>Kabine_voll</code>.<br><b>NW 2:</b> <b>ohne Bedingung</b> → <b>MOVE</b> <code>Z_Gaeste.CV</code> nach <code>Anzeige</code>.<br>Element antippen → <b>ohne Bedingung</b>; Spule antippen → <b>MOVE</b>.',
  learn:'MOVE ohne Bedingung: Wert in jedem Zyklus übertragen; Zählerstand CV lesen.',
  take:'Die Werte einer Box (Zählerstand <code>Z.CV</code>, verstrichene Zeit <code>T.ET</code>) liest du mit <code>Instanz.Name</code>. Eine Box direkt an der Stromschiene läuft in jedem Zyklus.',
  vars:{ Drehkreuz:false, Abfahrt:false, Kabine_voll:false, Anzeige:0 },
  timed: seq(pulses('Drehkreuz', 5, i => ({ Anzeige: i })).concat([[0.1,{Abfahrt:true},{Anzeige:0}],[0.1,{Abfahrt:false},{Anzeige:0}]])),
  ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;\n\nNETWORK Anzeige\n=> MOVE(Z_Gaeste.CV, Anzeige);', man:'zaehler', must:['CTU','MOVE'],
  hint:'In der MOVE-Box ist IN der Zählerstand Z_Gaeste.CV, OUT die Anzeige.',
  bind:['passengers=Anzeige','lightRed=Kabine_voll','gateOpen=Drehkreuz'] });

defKop({ id:'k8_ctd', ch:8, title:'Fahrten bis zur Wartung',
  story:'Nach 5 Fahrten muss das Seil geprüft werden. Ein Abwärtszähler CTD startet bei 5 und zählt jede Abfahrt herunter. Bei 0 meldet er „Wartung fällig“.',
  brief:'<code>Abfahrt</code> → <b>CTD</b> <code>Z_Wartung</code> (PV 5, Laden LD = <code>Wartung_OK</code>) → <code>Wartung_faellig</code>.<br>Zähler einfügen, Typ <b>CTD</b> wählen.',
  learn:'CTD zählt abwärts, LD lädt PV; Q = 1 bei CV ≤ 0.',
  take:'Der <b>CTD</b> zählt bei jeder steigenden Flanke um 1 herunter. Mit <b>LD</b> wird PV geladen. Q wird 1, wenn CV ≤ 0 ist — ideal für „noch n-mal“.',
  vars:{ Abfahrt:false, Wartung_OK:false, Wartung_faellig:false },
  timed: seq([[0,{Wartung_OK:true},{Wartung_faellig:false}],[0.1,{Wartung_OK:false},{}]].concat(pulses('Abfahrt', 5, i => ({ Wartung_faellig: i >= 5 })), [[0.1,{Wartung_OK:true},{Wartung_faellig:false}],[0.1,{Wartung_OK:false},{Wartung_faellig:false}]])),
  ref:'NETWORK Wartungszaehler\nAbfahrt AND CTD(Z_Wartung, PV:=5, LD:=Wartung_OK) => Wartung_faellig;', man:'zaehler', must:['CTD'],
  hint:'Zähler einfügen, Typ auf CTD umstellen, LD = Wartung_OK.',
  bind:['faultActive=Wartung_faellig','motorOn=Abfahrt'] });

defKop({ id:'k8_pv_dbg', ch:8, title:'Die überfüllte Kabine', debug:true,
  story:'In der Kabine drängen sich zehn Leute, die Voll-Meldung kommt nie. ARIA hat den Vorgabewert verändert.',
  brief:'<code>Kabine_voll</code> soll nach <b>8</b> Durchgängen kommen.',
  learn:'Vorgabewert PV prüfen.',
  take:'PV ist der Grenzwert des Zählers. Bei Fehlmeldungen immer zuerst PV und R prüfen.',
  vars:{ Drehkreuz:false, Kabine_voll:false },
  timed: seq(pulses('Drehkreuz', 8, i => ({ Kabine_voll: i >= 8 }))),
  start:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=12) => Kabine_voll;', ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8) => Kabine_voll;', man:'zaehler', must:['CTU'],
  hint:'Box antippen und PV prüfen.',
  bind:['lightRed=Kabine_voll','gateOpen=Drehkreuz'] });

defKop({ id:'k8_sperre', ch:8, title:'Volle Kabine sperrt',
  story:'Ist die Kabine voll, darf die Zugangssperre nicht mehr öffnen — auch mit gültigem Skipass nicht. Die rote Ampel zeigt: nächste Kabine abwarten.',
  brief:'<b>NW 1:</b> <code>Drehkreuz</code> → CTU <code>Z_Gaeste</code> (PV 8, R <code>Abfahrt</code>) → <code>Kabine_voll</code><br><b>NW 2:</b> <code>Karte_OK</code> und nicht <code>Kabine_voll</code> → <code>Sperre_Auf</code><br><b>NW 3:</b> <code>Kabine_voll</code> → <code>Ampel_Rot</code>',
  learn:'Zählerausgang als Sperrbedingung verwenden.',
  take:'Der Zählerausgang ist ein ganz normales Signal — als Öffner im Strompfad sperrt er, als Schliesser meldet er.',
  vars:{ Drehkreuz:false, Abfahrt:false, Karte_OK:false, Kabine_voll:false, Sperre_Auf:false, Ampel_Rot:false },
  timed: seq([[0,{Karte_OK:true},{Sperre_Auf:true}]].concat(pulses('Drehkreuz', 8, i => ({ Sperre_Auf: i < 8, Ampel_Rot: i >= 8 })), [[0.1,{Abfahrt:true},{Sperre_Auf:true, Ampel_Rot:false}]])),
  ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;\n\nNETWORK Sperre\nKarte_OK AND NOT Kabine_voll => Sperre_Auf;\n\nNETWORK Ampel\nKabine_voll => Ampel_Rot;', man:'zaehler', must:['CTU','NC'],
  hint:'NW 2: Kabine_voll als Öffner.',
  bind:['gateOpen=Sperre_Auf','lightRed=Ampel_Rot','personWaiting=Karte_OK'] });

defKop({ id:'k8_richtungen', ch:8, title:'Berg- und Talfahrten',
  story:'Die Statistik will wissen, wie oft die Bahn bergwärts und wie oft talwärts gefahren ist. Zwei Zähler, zwei Netzwerke. Ein Zähler mit PV 0 meldet einfach nie „voll“ — er zählt nur.',
  brief:'<b>NW 1:</b> <code>Abfahrt</code> und <code>Richtung_Berg</code> → CTU <code>Z_Berg</code> (PV 1000) → <code>Berg_1000</code><br><b>NW 2:</b> <code>Abfahrt</code> und nicht <code>Richtung_Berg</code> → CTU <code>Z_Tal</code> (PV 1000) → <code>Tal_1000</code><br><b>NW 3:</b> ohne Bedingung → MOVE <code>Z_Berg.CV</code> nach <code>Anzeige</code>',
  learn:'Mehrere Zähler und Zählerstände.',
  take:'Jeder Zähler braucht eine eigene Instanz. Den Zählerstand liest du über <code>Instanz.CV</code>.',
  vars:{ Abfahrt:false, Richtung_Berg:false, Berg_1000:false, Tal_1000:false, Anzeige:0 },
  timed: seq([[0,{Richtung_Berg:true},{}]].concat(pulses('Abfahrt', 3, i => ({ Anzeige: i })), [[0.1,{Richtung_Berg:false},{}]], pulses('Abfahrt', 2, () => ({ Anzeige: 3 })))),
  ref:'NETWORK Bergfahrten\nAbfahrt AND Richtung_Berg AND CTU(Z_Berg, PV:=1000) => Berg_1000;\n\nNETWORK Talfahrten\nAbfahrt AND NOT Richtung_Berg AND CTU(Z_Tal, PV:=1000) => Tal_1000;\n\nNETWORK Anzeige\n=> MOVE(Z_Berg.CV, Anzeige);', man:'zaehler', must:['CTU','MOVE'],
  hint:'Zwei Zähler mit verschiedenen Instanznamen.',
  bind:['passengers=Anzeige','motorDir=Richtung_Berg','motorOn=Abfahrt'] });

defKop({ id:'k8_reset_dbg', ch:8, title:'Der Zähler, der nie leer wird', debug:true,
  story:'Nach der Abfahrt bleibt „Kabine voll“ stehen, niemand kommt mehr durchs Drehkreuz. ARIA hat den Rücksetzeingang an die falsche Variable gehängt.',
  brief:'Der Zähler <code>Z_Gaeste</code> soll durch <code>Abfahrt</code> zurückgesetzt werden.',
  learn:'Rücksetzeingang prüfen.',
  take:'Ein Zähler ohne wirksamen Reset zählt ewig weiter. Prüfe, welche Variable am R-Eingang hängt.',
  vars:{ Drehkreuz:false, Abfahrt:false, Kabine_voll:false },
  timed: seq(pulses('Drehkreuz', 8, i => ({ Kabine_voll: i >= 8 })).concat([[0.1,{Abfahrt:true},{Kabine_voll:false}]])),
  start:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Drehkreuz) => Kabine_voll;', ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;', man:'zaehler', must:['CTU'],
  hint:'Box antippen und das Feld „Reset R“ ansehen.',
  bind:['lightRed=Kabine_voll','motorOn=Abfahrt'] });

defKop({ id:'k8_takt', ch:8, title:'Drei Hupsignale',
  story:'Kurz vor der Abfahrt soll die Hupe genau dreimal tönen. Ein Zähler zählt die Hupimpulse und beendet die Warnung nach dem dritten.',
  brief:'<b>NW 1:</b> ↑<code>S_Abfahrt</code> setzt <code>Warnen</code><br><b>NW 2:</b> <code>Warnen</code> und <code>Takt_1Hz</code> → <code>Hupe</code><br><b>NW 3:</b> <code>Hupe</code> → CTU <code>Z_Hupe</code> (PV 3, R <code>S_Abfahrt</code>) → setzt <code>Warnen</code> zurück',
  learn:'Zähler zählt eigene Ausgangsimpulse.',
  take:'Ein Zähler kann auch <b>eigene</b> Impulse zählen — hier die Hupimpulse. Nach PV Impulsen beendet er den Vorgang.',
  vars:{ S_Abfahrt:false, Takt_1Hz:false, Warnen:false, Hupe:false },
  timed: seq([[0,{S_Abfahrt:true},{Warnen:true}],[0.1,{S_Abfahrt:false},{}],[0.5,{Takt_1Hz:true},{Hupe:true}],[0.5,{Takt_1Hz:false},{Hupe:false}],[0.5,{Takt_1Hz:true},{Hupe:true}],[0.5,{Takt_1Hz:false},{}],[0.5,{Takt_1Hz:true},{Hupe:true, Warnen:false}],[0.5,{Takt_1Hz:false},{Hupe:false}],[0.5,{Takt_1Hz:true},{Hupe:false, Warnen:false}]]),
  ref:'NETWORK Start\nP(S_Abfahrt) => S Warnen;\n\nNETWORK Hupe\nWarnen AND Takt_1Hz => Hupe;\n\nNETWORK Zaehlen\nHupe AND CTU(Z_Hupe, PV:=3, R:=S_Abfahrt) => R Warnen;', man:'zaehler', must:['CTU','SET','RESET'],
  hint:'Der Zähler zählt die Hupe selbst. Sein Ausgang setzt Warnen zurück.',
  bind:['hornActive=Hupe','lightYellow=Warnen'] });

defKop({ id:'k8_boss', ch:8, title:'Boss: Kabinenbetrieb', boss:true,
  story:'ARIA stopft zwölf Gäste in eine Kabine und lässt die Wartung ausfallen. Der Werkmeister legt dir die Betriebsvorschrift hin: Höchstens 8 Personen, nach 5 Fahrten Wartung, kein Start bei fälliger Wartung.',
  brief:'<b>NW 1:</b> <code>Drehkreuz</code> → CTU <code>Z_Gaeste</code> (PV 8, R <code>Abfahrt</code>) → <code>Kabine_voll</code><br><b>NW 2:</b> <code>Karte_OK</code> und nicht <code>Kabine_voll</code> → <code>Sperre_Auf</code><br><b>NW 3:</b> <code>Abfahrt</code> → CTD <code>Z_Wartung</code> (PV 5, LD <code>Wartung_OK</code>) → <code>Wartung_faellig</code><br><b>NW 4:</b> <code>S_Start</code> und nicht <code>Wartung_faellig</code> → <code>Abfahrt</code><br><b>NW 5:</b> ohne Bedingung → MOVE <code>Z_Gaeste.CV</code> nach <code>Anzeige</code>',
  learn:'CTU, CTD und MOVE in einer Anlage kombinieren.',
  take:'Zähler begrenzen (Kapazität), planen (Wartung) und informieren (Anzeige) — drei typische Einsätze in einem Programm.',
  vars:{ Drehkreuz:false, Karte_OK:false, S_Start:false, Wartung_OK:false, Abfahrt:false, Kabine_voll:false, Sperre_Auf:false, Wartung_faellig:false, Anzeige:0 },
  timed: seq([[0,{Wartung_OK:true, Karte_OK:true},{Sperre_Auf:true}],[0.1,{Wartung_OK:false},{}]].concat(
    pulses('Drehkreuz', 8, i => ({ Anzeige: i, Sperre_Auf: i < 8 })),
    [[0.1,{S_Start:true},{Abfahrt:true}],[0.1,{S_Start:false},{Abfahrt:false, Anzeige:0, Sperre_Auf:true}]],
    [[0.1,{S_Start:true},{Abfahrt:true}],[0.1,{S_Start:false},{}],[0.1,{S_Start:true},{Abfahrt:true}],[0.1,{S_Start:false},{}],[0.1,{S_Start:true},{Abfahrt:true}],[0.1,{S_Start:false},{}],[0.1,{S_Start:true},{Abfahrt:true, Wartung_faellig:false}],[0.1,{S_Start:false},{Wartung_faellig:true}],
     [0.1,{S_Start:true},{Abfahrt:false}],[0.1,{S_Start:false, Wartung_OK:true},{Wartung_faellig:false}],[0.1,{Wartung_OK:false, S_Start:true},{Abfahrt:true}]])),
  ref:'NETWORK Gaeste zaehlen\nDrehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;\n\nNETWORK Sperre\nKarte_OK AND NOT Kabine_voll => Sperre_Auf;\n\nNETWORK Wartung\nAbfahrt AND CTD(Z_Wartung, PV:=5, LD:=Wartung_OK) => Wartung_faellig;\n\nNETWORK Abfahrt\nS_Start AND NOT Wartung_faellig => Abfahrt;\n\nNETWORK Anzeige\n=> MOVE(Z_Gaeste.CV, Anzeige);',
  man:'zaehler', must:['CTU','CTD','MOVE'],
  hint:'Die Reihenfolge der Netzwerke ist wie im Plan. Teste nach jedem Netzwerk.',
  bind:['gateOpen=Sperre_Auf','passengers=Anzeige','motorOn=Abfahrt','faultActive=Wartung_faellig','lightRed=Kabine_voll'] });
})();
