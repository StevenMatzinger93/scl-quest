/* ===== FUP QUEST · KAPITEL 6 — Zeiten I: TON, TOF, TP ===== */
(function(){
const seq = steps => [{ steps }];
const SCHR = 'NETWORK Schranke schliessen\nZug_meldet AND TON(T_Vorlauf, T#3S) => Schranke_zu;';

defFup({ id:'f6_ton', ch:6, title:'Erst blinken, dann schliessen',
  story:'Wenn ein Zug meldet, blinkt das Licht sofort — die Schranke senkt sich aber erst nach <b>3 Sekunden</b>, damit Autos den Übergang noch räumen können.',
  brief:'Solange ein Zug meldet, schliesst die Schranke nach <b>3 s</b> (<b>TON</b>); ohne Meldung ist sie offen.<br>Eingang antippen → <b>Timer</b>. Instanz und Zeit stehen in den Feldern oben.',
  learn:'Die Einschaltverzögerung TON.',
  take:'Die <b>TON-Box</b> gibt ihren Ausgang erst frei, wenn der Eingang <b>PT lang ununterbrochen</b> ansteht. Fällt der Eingang weg, ist der Ausgang sofort 0.',
  vars:{ Zug_meldet:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_meldet:true },{ Schranke_zu:false }],[2,{},{ Schranke_zu:false }],[1.1,{},{ Schranke_zu:true }],[0.1,{ Zug_meldet:false },{ Schranke_zu:false }]]),
  ref: SCHR, man:'timer', must:['TON'],
  hint:'Timer-Box hinter Zug_meldet, Zeit T#3S.',
  bind:['trainApproach=Zug_meldet', 'crossingClosed=Schranke_zu'] });

defFup({ id:'f6_tof', ch:6, title:'Schranke bleibt noch zu',
  story:'Wenn der Zug vorbei ist, soll die Schranke noch <b>2 Sekunden</b> unten bleiben — falls ein zweiter Zug aus der Gegenrichtung folgt.',
  brief:'Ist ein Zug im Bahnübergang, ist die Schranke zu; danach bleibt sie noch <b>2 s</b> zu (<b>TOF</b>).<br>Timer-Box antippen → Typ TOF.',
  learn:'Die Ausschaltverzögerung TOF.',
  take:'Die <b>TOF-Box</b> schaltet sofort ein und hält ihren Ausgang nach dem Wegfall des Eingangs noch PT lang.',
  vars:{ Zug_im_BUE:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_im_BUE:true },{ Schranke_zu:true }],[0.1,{ Zug_im_BUE:false },{ Schranke_zu:true }],[1.5,{},{ Schranke_zu:true }],[0.6,{},{ Schranke_zu:false }]]),
  ref:'NETWORK Schranke nachlaufen\nZug_im_BUE AND TOF(T_Nachlauf, T#2S) => Schranke_zu;', man:'timer', must:['TOF'],
  hint:'Wie TON, nur Typ TOF.',
  bind:['crossingClosed=Schranke_zu'] });

defFup({ id:'f6_tp', ch:6, title:'Die Glocke',
  story:'Die Glocke am Bahnübergang läutet beim Einschalten genau <b>2 Sekunden</b> — egal wie lange der Zug meldet.',
  brief:'Meldet ein Zug, läutet die Glocke genau <b>2 s</b> (<b>TP</b>) — egal wie lange die Meldung ansteht.',
  learn:'Der Impuls TP.',
  take:'Die <b>TP-Box</b> startet mit der steigenden Flanke am Eingang und liefert genau PT lang einen Impuls.',
  vars:{ Zug_meldet:false, Glocke:false },
  timed: seq([[0,{ Zug_meldet:true },{ Glocke:true }],[1.5,{},{ Glocke:true }],[0.6,{},{ Glocke:false }],[2,{},{ Glocke:false }],[0.1,{ Zug_meldet:false },{ Glocke:false }]]),
  ref:'NETWORK Glocke\nZug_meldet AND TP(T_Glocke, T#2S) => Glocke;', man:'timer', must:['TP'],
  hint:'Timer-Box, Typ TP, Zeit T#2S.',
  bind:['trainApproach=Zug_meldet', 'crossingBell=Glocke'] });

defFup({ id:'f6_zeit_dbg', ch:6, title:'Viel zu schnell', debug:true,
  story:'Die Schranke fällt fast gleichzeitig mit dem Einschalten der Blinklichter — ein Auto hätte keine Chance zu räumen. ARIA hat die Zeit verstellt.',
  brief:'Die Schranke senkt sich erst nach <b>3 Sekunden</b>.',
  learn:'Zeitwerte prüfen.',
  take:'Zeiten stehen als <code>T#…</code> in der Box. <code>T#300MS</code> sind 0,3 s, <code>T#3S</code> 3 s — ein kleiner Unterschied im Text, ein grosser an der Schranke.',
  vars:{ Zug_meldet:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_meldet:true },{ Schranke_zu:false }],[1,{},{ Schranke_zu:false }],[2.1,{},{ Schranke_zu:true }]]),
  start:'NETWORK Schranke schliessen\nZug_meldet AND TON(T_Vorlauf, T#300MS) => Schranke_zu;', ref: SCHR, man:'timer', must:['TON'],
  hint:'Timer-Box antippen und die Zeit PT korrigieren.',
  bind:['trainApproach=Zug_meldet', 'crossingClosed=Schranke_zu'] });

defFup({ id:'f6_sicherheit', ch:6, title:'Sicherheitszeit fürs Signal',
  story:'Signal B darf erst Fahrt zeigen, wenn die Schranke seit mindestens <b>1 Sekunde</b> in der Endlage unten liegt — so federn die Bäume aus.',
  brief:'Signal B zeigt Fahrt bei gedrückter Taste, wenn die Schranke seit mindestens <b>1 s</b> unten in der Endlage liegt (TON).',
  learn:'Eine Zeitbox als Eingang einer UND-Box.',
  take:'Eine Timer-Box liefert ihr Ergebnis an einen Eingang einer weiteren Box — wie jede andere Verknüpfung.',
  vars:{ Taste_B:false, Schranke_unten:false, Signal_B:false },
  timed: seq([[0,{ Taste_B:true, Schranke_unten:true },{ Signal_B:false }],[0.5,{},{ Signal_B:false }],[0.6,{},{ Signal_B:true }],[0.1,{ Schranke_unten:false },{ Signal_B:false }]]),
  ref:'NETWORK Signal B\nSchranke_unten AND TON(T_Sicher, T#1S) AND Taste_B => Signal_B;', man:'timer', must:['TON','SERIES'],
  hint:'Die &-Box hat zwei Eingänge: die TON-Box (Eingang Schranke_unten) und Taste_B.',
  bind:['signalExit=Signal_B', 'crossingClosed=Schranke_unten'] });

defFup({ id:'f6_haltezeit', ch:6, title:'Haltezeit im Bahnhof',
  story:'Ein Personenzug hält auf Gleis 1 mindestens <b>5 Sekunden</b> (in der Simulation), damit alle ein- und aussteigen können. Erst dann darf das Ausfahrsignal Fahrt zeigen.',
  brief:'Steht der Zug am Bahnsteig, zeigt Signal B nach <b>5 s</b> Fahrt (TON). Steht er nicht mehr, zeigt es sofort Halt.',
  learn:'TON für Mindestzeiten.',
  take:'Eine Mindestzeit ist eine Einschaltverzögerung: Das Ergebnis kommt erst, wenn die Bedingung lange genug erfüllt ist.',
  vars:{ Zug_steht:false, Signal_B:false },
  timed: seq([[0,{ Zug_steht:true },{ Signal_B:false }],[4.9,{},{ Signal_B:false }],[0.2,{},{ Signal_B:true }],[0.1,{ Zug_steht:false },{ Signal_B:false }]]),
  ref:'NETWORK Ausfahrt\nZug_steht AND TON(T_Halt, T#5S) => Signal_B;', man:'timer', must:['TON'],
  hint:'Timer-Box, Typ TON, T#5S.',
  bind:['signalExit=Signal_B'] });

defFup({ id:'f6_tof_dbg', ch:6, title:'Die zögernde Schranke', debug:true,
  story:'Nach dem Zug bleibt die Schranke nicht unten, sondern schliesst erst 2 Sekunden nach dem Einfahren — und öffnet sofort nach dem Zug. ARIA hat den Timer-Typ vertauscht.',
  brief:'Die Schranke schliesst sofort und bleibt nach dem Zug noch 2 s unten.',
  learn:'TON und TOF unterscheiden.',
  take:'TON verzögert das <b>Einschalten</b>, TOF das <b>Ausschalten</b>. Beim Vertauschen passiert beides am falschen Ende.',
  vars:{ Zug_im_BUE:false, Schranke_zu:false },
  timed: seq([[0,{ Zug_im_BUE:true },{ Schranke_zu:true }],[0.1,{ Zug_im_BUE:false },{ Schranke_zu:true }],[2.1,{},{ Schranke_zu:false }]]),
  start:'NETWORK Schranke nachlaufen\nZug_im_BUE AND TON(T_Nachlauf, T#2S) => Schranke_zu;', ref:'NETWORK Schranke nachlaufen\nZug_im_BUE AND TOF(T_Nachlauf, T#2S) => Schranke_zu;', man:'timer', must:['TOF'],
  hint:'Timer-Box antippen → Typ TOF.',
  bind:['crossingClosed=Schranke_zu'] });

defFup({ id:'f6_weichenmotor', ch:6, title:'Weichenmotor mit Impuls',
  story:'Der alte Weichenantrieb braucht einen Stromimpuls von genau <b>3 Sekunden</b> — dann ist er sicher umgelaufen. Ein Tastendruck startet den Impuls.',
  brief:'Ein Druck auf die Taste von Weiche 2 gibt dem Weichenmotor einen Stellimpuls von genau <b>3 s</b> (TP).',
  learn:'TP als Ansteuerimpuls.',
  take:'Mit TP entsteht aus einem kurzen oder langen Tastendruck immer ein gleich langer Stellimpuls.',
  vars:{ Taste_W2:false, W2_Motor:false },
  timed: seq([[0,{ Taste_W2:true },{ W2_Motor:true }],[0.1,{ Taste_W2:false },{ W2_Motor:true }],[2.5,{},{ W2_Motor:true }],[0.6,{},{ W2_Motor:false }]]),
  ref:'NETWORK Weiche 2 umstellen\nTaste_W2 AND TP(T_W2, T#3S) => W2_Motor;', man:'timer', must:['TP'],
  hint:'TP-Box hinter Taste_W2.',
  bind:['switch2Moving=W2_Motor'] });

defFup({ id:'f6_wecker', ch:6, title:'Der kurze Wecker',
  story:'Bei jeder neuen Weichenstörung soll der Wecker <b>1 Sekunde</b> lang klingeln — die Störung selbst bleibt gespeichert.',
  brief:'<b>NW 1:</b> Ein Fehler von Weiche 1 speichert die Störung (RS-Box, Quittieren).<br><b>NW 2:</b> Bei jeder neuen Störung klingelt der Wecker <b>1 s</b> (TP).',
  learn:'Speicher und Impuls kombinieren.',
  take:'Der Speicher merkt sich den Zustand, der Impuls macht auf ihn aufmerksam. So klingelt es nicht endlos.',
  vars:{ W1_Fehler:false, Quittieren:false, Stoerung:false, Wecker:false },
  timed: seq([[0,{ W1_Fehler:true },{ Stoerung:true, Wecker:true }],[0.5,{ W1_Fehler:false },{ Wecker:true }],[0.6,{},{ Wecker:false, Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:false }]]),
  ref:'NETWORK Stoerung\nW1_Fehler => RS(Stoerung, Quittieren);\n\nNETWORK Wecker\nStoerung AND TP(T_Wecker, T#1S) => Wecker;', man:'timer', must:['RS','TP'],
  hint:'NW 2: Eingang Stoerung, TP-Box, Zuweisung Wecker.',
  bind:['faultActive=Stoerung', 'hornActive=Wecker'] });

defFup({ id:'f6_boss', ch:6, title:'Boss: Der Bahnübergang', boss:true,
  story:'ARIA lässt die Schranken ohne Vorwarnung fallen und öffnet sie direkt hinter der Lok. Frau Gasser: „Der Übergang ist die gefährlichste Stelle, also mach ihn richtig.“',
  brief:'<b>NW 1:</b> Blinklicht bei Zugmeldung oder Zug im Übergang.<br><b>NW 2:</b> Glocke 2 s ab Meldung (TP).<br><b>NW 3:</b> 3 s Meldung → Schranke zu setzen.<br><b>NW 4:</b> Zug im Übergang → TOF 2 s → Nachlauf.<br><b>NW 5:</b> Ohne Meldung und Nachlauf → Schranke rücksetzen.',
  learn:'TON, TOF und TP in einer Bahnübergangssteuerung.',
  take:'Ein Bahnübergang ist eine kleine Zeitmaschine: Vorwarnung (TON), Glocke (TP), Nachlauf (TOF). Jede Zeit hat ihre eigene Box und ihre eigene Instanz.',
  vars:{ Zug_meldet:false, Zug_im_BUE:false, Blinklicht:false, Glocke:false, Schranke_zu:false, Zug_Nachlauf:false },
  timed: seq([[0,{ Zug_meldet:true },{ Blinklicht:true, Glocke:true, Schranke_zu:false }],[2.1,{},{ Glocke:false, Schranke_zu:false }],[1,{},{ Schranke_zu:true }],
    [0.1,{ Zug_meldet:false, Zug_im_BUE:true },{ Schranke_zu:true, Blinklicht:true }],[1,{ Zug_im_BUE:false },{ Schranke_zu:true, Blinklicht:false }],[1.5,{},{ Schranke_zu:true }],[0.6,{},{ Schranke_zu:false }]]),
  ref:'NETWORK Blinklicht\nZug_meldet OR Zug_im_BUE => Blinklicht;\n\nNETWORK Glocke\nZug_meldet AND TP(T_Glocke, T#2S) => Glocke;\n\nNETWORK Schranke schliessen\nZug_meldet AND TON(T_Vorlauf, T#3S) => S Schranke_zu;\n\nNETWORK Nachlauf\nZug_im_BUE AND TOF(T_Nachlauf, T#2S) => Zug_Nachlauf;\n\nNETWORK Schranke oeffnen\nNOT Zug_meldet AND NOT Zug_Nachlauf => R Schranke_zu;',
  man:'timer', must:['TON','TOF','TP','SET','RESET'],
  hint:'Fünf Netzwerke, drei verschiedene Timer mit eigenen Instanzen.',
  bind:['trainApproach=Zug_meldet', 'crossingLights=Blinklicht', 'crossingBell=Glocke', 'crossingClosed=Schranke_zu'] });
})();
