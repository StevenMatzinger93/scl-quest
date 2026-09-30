/* ===== FUP QUEST · KAPITEL 8 — Zähler: CTU, CTD, Achszähler ===== */
(function(){
const seq = steps => [{ steps }];
// n Impulse auf sig (je ein Zyklus 1, ein Zyklus 0); f(i) = Erwartung nach dem i-ten Impuls
const pulses = (sig, n, f) => [].concat(...Array.from({ length:n }, (_, i) => [[0.1, { [sig]:true }, f ? f(i + 1) : {}], [0.1, { [sig]:false }, {}]]));
const ACHS = 'NETWORK Achsen ein\nAchse_ein AND CTU(Z_Ein, PV:=1000, R:=Grundstellung) => Ueberlauf_Ein;\n\nNETWORK Achsen aus\nAchse_aus AND CTU(Z_Aus, PV:=1000, R:=Grundstellung) => Ueberlauf_Aus;\n\nNETWORK Besetzt\n[Z_Ein.CV <> Z_Aus.CV] => Abschnitt_besetzt;';

defFup({ id:'f8_ctu', ch:8, title:'Der Zug ist komplett',
  story:'Der Regionalzug hat genau <b>8 Achsen</b>: Hat der Zählpunkt 8 Achsen gezählt, ist er vollständig eingefahren. Ein Zähler zählt mit, und die Flanke hat er schon eingebaut.',
  brief:'<code>Achse</code> → <b>CTU</b> <code>Z_Achsen</code> (PV 8, R <code>Grundstellung</code>) → <code>Zug_komplett</code>.<br>Eingang antippen → <b>Zähler</b>.',
  learn:'Der Vorwärtszähler CTU.',
  take:'Der <b>CTU</b> zählt jede steigende Flanke an CU. <code>Q</code> wird 1, sobald der Zählwert <code>CV</code> den Vorgabewert <code>PV</code> erreicht. <code>R</code> setzt auf 0.',
  vars:{ Achse:false, Grundstellung:false, Zug_komplett:false },
  timed: seq(pulses('Achse', 8, i => ({ Zug_komplett: i >= 8 })).concat([[0.1,{ Grundstellung:true },{ Zug_komplett:false }]])),
  ref:'NETWORK Achsen zaehlen\nAchse AND CTU(Z_Achsen, PV:=8, R:=Grundstellung) => Zug_komplett;', man:'zaehler', must:['CTU'],
  hint:'Zähler-Box hinter Achse, PV 8, Reset Grundstellung.',
  bind:['lightGreen=Zug_komplett', 'trainApproach=Achse'] });

defFup({ id:'f8_anzeige', ch:8, title:'Achsen auf der Anzeige',
  story:'Frau Gasser will den Zählerstand sehen, der in der Zählerinstanz steckt: <code>Z_Achsen.CV</code>.',
  brief:'<b>NW 1:</b> <code>Achse</code> → CTU <code>Z_Achsen</code> (PV 8, R <code>Grundstellung</code>) → <code>Zug_komplett</code><br><b>NW 2:</b> ohne Bedingung → MOVE <code>Z_Achsen.CV</code> nach <code>Anzeige</code>',
  learn:'Den Zählwert CV mit MOVE ausgeben.',
  take:'Der Zählwert steht in der Instanz: <code>Z_Achsen.CV</code>. Eine MOVE-Box ohne Bedingung bringt ihn in jedem Zyklus auf die Anzeige.',
  vars:{ Achse:false, Grundstellung:false, Zug_komplett:false, Anzeige:0 },
  timed: seq(pulses('Achse', 3, i => ({ Anzeige:i })).concat([[0.1,{ Grundstellung:true },{ Anzeige:0 }],[0.1,{ Grundstellung:false, Achse:true },{ Anzeige:1 }]])),
  ref:'NETWORK Achsen zaehlen\nAchse AND CTU(Z_Achsen, PV:=8, R:=Grundstellung) => Zug_komplett;\n\nNETWORK Anzeige\n=> MOVE(Z_Achsen.CV, Anzeige);', man:'zaehler', must:['CTU','MOVE'],
  hint:'NW 2: Eingang antippen → „immer“, Ausgang → MOVE.',
  bind:['axleCount=Anzeige', 'trainApproach=Achse'] });

defFup({ id:'f8_ctd', ch:8, title:'Wartung nach 5 Umstellungen',
  story:'Weiche 2 muss nach je <b>5 Umstellungen</b> geschmiert werden (in der Simulation). Der Wartungstechniker lädt den Zähler nach der Wartung neu.',
  brief:'<code>W2_umgestellt</code> → <b>CTD</b> <code>Z_Wartung</code> (PV 5, LD <code>Wartung_OK</code>) → <code>Wartung_faellig</code>.<br>Zähler-Box antippen → Typ CTD.',
  learn:'Der Rückwärtszähler CTD.',
  take:'Der <b>CTD</b> zählt vom geladenen Wert <code>PV</code> herunter. <code>LD</code> lädt ihn neu, <code>Q</code> wird 1, sobald <code>CV ≤ 0</code>.',
  vars:{ W2_umgestellt:false, Wartung_OK:false, Wartung_faellig:false },
  timed: seq([[0,{ Wartung_OK:true },{ Wartung_faellig:false }],[0.1,{ Wartung_OK:false },{}]].concat(pulses('W2_umgestellt', 5, i => ({ Wartung_faellig: i >= 5 })), [[0.1,{ Wartung_OK:true },{ Wartung_faellig:false }]])),
  ref:'NETWORK Wartung\nW2_umgestellt AND CTD(Z_Wartung, PV:=5, LD:=Wartung_OK) => Wartung_faellig;', man:'zaehler', must:['CTD'],
  hint:'Typ CTD, PV 5, Laden Wartung_OK.',
  bind:['switch2Moving=W2_umgestellt', 'lightYellow=Wartung_faellig'] });

defFup({ id:'f8_pv_dbg', ch:8, title:'Zu früh komplett', debug:true,
  story:'Der Zug gilt schon nach 4 Achsen als komplett eingefahren — die hinteren Wagen stehen noch auf dem Bahnübergang! ARIA hat den Vorgabewert halbiert.',
  brief:'Der Zug hat <b>8</b> Achsen.',
  learn:'Vorgabewerte prüfen.',
  take:'Ein falscher Vorgabewert ist bei Zählern besonders tückisch: Der Zähler funktioniert, meldet aber zum falschen Zeitpunkt.',
  vars:{ Achse:false, Grundstellung:false, Zug_komplett:false },
  timed: seq(pulses('Achse', 8, i => ({ Zug_komplett: i >= 8 }))),
  start:'NETWORK Achsen zaehlen\nAchse AND CTU(Z_Achsen, PV:=4, R:=Grundstellung) => Zug_komplett;', ref:'NETWORK Achsen zaehlen\nAchse AND CTU(Z_Achsen, PV:=8, R:=Grundstellung) => Zug_komplett;', man:'zaehler', must:['CTU'],
  hint:'Zähler-Box antippen, PV korrigieren.',
  bind:['lightGreen=Zug_komplett'] });

defFup({ id:'f8_achszaehler', ch:8, title:'Der Achszähler',
  story:'Ein Gleisabschnitt ist frei, wenn <b>genauso viele Achsen hinaus- wie hineingefahren</b> sind. Zwei Zählpunkte, zwei Zähler, ein Vergleich — das ist ein Achszähler, wie er in echten Stellwerken arbeitet.',
  brief:'<b>NW 1:</b> <code>Achse_ein</code> → CTU <code>Z_Ein</code> (PV 1000, R <code>Grundstellung</code>) → <code>Ueberlauf_Ein</code><br><b>NW 2:</b> <code>Achse_aus</code> → CTU <code>Z_Aus</code> (PV 1000, R <code>Grundstellung</code>) → <code>Ueberlauf_Aus</code><br><b>NW 3:</b> <code>Z_Ein.CV</code> &lt;&gt; <code>Z_Aus.CV</code> → <code>Abschnitt_besetzt</code>',
  learn:'Zwei Zähler vergleichen: Gleisfreimeldung.',
  take:'Der <b>Achszähler</b> vergleicht Ein- und Auszählung. Stimmen sie überein, ist der Abschnitt frei. Die Zählwerte selbst dürfen dabei beliebig gross werden.',
  vars:{ Achse_ein:false, Achse_aus:false, Grundstellung:false, Ueberlauf_Ein:false, Ueberlauf_Aus:false, Abschnitt_besetzt:false },
  timed: seq([[0,{},{ Abschnitt_besetzt:false }]].concat(pulses('Achse_ein', 4, () => ({ Abschnitt_besetzt:true })), pulses('Achse_aus', 3, () => ({ Abschnitt_besetzt:true })), pulses('Achse_aus', 1, () => ({ Abschnitt_besetzt:false })))),
  ref: ACHS, man:'zaehler', must:['CTU','CMP'],
  hint:'Zwei Zähler und ein Vergleicher mit <>.',
  bind:['trackB=Abschnitt_besetzt', 'trainApproach=Achse_ein'] });

defFup({ id:'f8_reset_dbg', ch:8, title:'Der Zähler vergisst nie', debug:true,
  story:'Nach der Grundstellung zählt der Zug-komplett-Zähler einfach weiter. ARIA hat den Rücksetzeingang auf ein falsches Signal gelegt.',
  brief:'<code>Grundstellung</code> muss den Zähler zurücksetzen.',
  learn:'Rücksetzeingang prüfen.',
  take:'Hängt der Rücksetzeingang am falschen Signal, zählt der Zähler über alle Züge hinweg — und meldet „komplett“ viel zu früh.',
  vars:{ Achse:false, Grundstellung:false, Zug_komplett:false, Anzeige:0 },
  timed: seq(pulses('Achse', 2, i => ({ Anzeige:i })).concat([[0.1,{ Grundstellung:true },{ Anzeige:0 }]])),
  start:'NETWORK Achsen zaehlen\nAchse AND CTU(Z_Achsen, PV:=8, R:=Zug_komplett) => Zug_komplett;\n\nNETWORK Anzeige\n=> MOVE(Z_Achsen.CV, Anzeige);',
  ref:'NETWORK Achsen zaehlen\nAchse AND CTU(Z_Achsen, PV:=8, R:=Grundstellung) => Zug_komplett;\n\nNETWORK Anzeige\n=> MOVE(Z_Achsen.CV, Anzeige);', man:'zaehler', must:['CTU'],
  hint:'Zähler-Box antippen → Feld „Reset R“.',
  bind:['axleCount=Anzeige'] });

defFup({ id:'f8_zuege', ch:8, title:'Züge bis zur Kontrolle',
  story:'Nach je <b>3 Zügen</b> (in der Simulation) muss der Streckenwärter den Bahnübergang kontrollieren. Die gelbe Lampe erinnert ihn; mit „Kontrolle erledigt“ beginnt die Zählung neu.',
  brief:'<code>Zug_meldet</code> → CTU <code>Z_Zuege</code> (PV 3, R <code>Kontrolle_OK</code>) → <code>Melder_Gelb</code>',
  learn:'Zähler für wiederkehrende Prüfungen.',
  take:'Zähler zählen nicht nur Achsen: Züge, Umstellungen, Betriebsstunden. Mit R beginnt nach der Prüfung eine neue Runde.',
  vars:{ Zug_meldet:false, Kontrolle_OK:false, Melder_Gelb:false },
  timed: seq(pulses('Zug_meldet', 3, i => ({ Melder_Gelb: i >= 3 })).concat([[0.1,{ Kontrolle_OK:true },{ Melder_Gelb:false }],[0.1,{ Kontrolle_OK:false },{ Melder_Gelb:false }]], pulses('Zug_meldet', 1, () => ({ Melder_Gelb:false })))),
  ref:'NETWORK Kontrollzaehler\nZug_meldet AND CTU(Z_Zuege, PV:=3, R:=Kontrolle_OK) => Melder_Gelb;', man:'zaehler', must:['CTU'],
  hint:'Zähler-Box, PV 3, Reset Kontrolle_OK.',
  bind:['trainApproach=Zug_meldet', 'lightYellow=Melder_Gelb'] });

defFup({ id:'f8_signal', ch:8, title:'Signal nur bei freiem Abschnitt',
  story:'Das Einfahrsignal darf nur Fahrt zeigen, wenn der Achszähler den Abschnitt frei meldet. Die Achszähler-Netzwerke stehen schon.',
  brief:'Ergänze <b>NW 4:</b> <code>Taste_A</code> und nicht <code>Abschnitt_besetzt</code> → <code>Signal_A</code>.',
  learn:'Achszähler als Bedingung für ein Signal.',
  take:'Die Gleisfreimeldung ist die wichtigste Bedingung für jedes Signal. Aus dem Achszähler kommt sie als einfaches Bit.',
  vars:{ Achse_ein:false, Achse_aus:false, Grundstellung:false, Ueberlauf_Ein:false, Ueberlauf_Aus:false, Abschnitt_besetzt:false, Taste_A:false, Signal_A:false },
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true }]].concat(pulses('Achse_ein', 1, () => ({ Signal_A:false })), [[0.1,{},{ Signal_A:false }]], pulses('Achse_aus', 1, () => ({ Signal_A:true })))),
  start: ACHS + '\n\nNETWORK Signal A\n? => ?;', ref: ACHS + '\n\nNETWORK Signal A\nTaste_A AND NOT Abschnitt_besetzt => Signal_A;', man:'zaehler', must:['NC'],
  hint:'Das letzte Netzwerk ist offen: &-Box mit Taste_A und negiertem Abschnitt_besetzt.',
  bind:['signalEntry=Signal_A', 'trackB=Abschnitt_besetzt'] });

defFup({ id:'f8_ctd_dbg', ch:8, title:'Die Wartung, die nie fällig wird', debug:true,
  story:'Weiche 2 wurde seit Monaten nicht geschmiert — die Lampe „Wartung fällig“ leuchtet nie. ARIA hat den Wartungszähler auf Vorwärtszählen umgestellt.',
  brief:'Nach <b>5</b> Umstellungen muss <code>Wartung_faellig</code> kommen; <code>Wartung_OK</code> lädt neu.',
  learn:'CTU und CTD unterscheiden.',
  take:'CTU meldet, wenn er PV <b>erreicht</b>, CTD, wenn er bei <b>0</b> ankommt. Ein vertauschter Typ zählt in die falsche Richtung.',
  vars:{ W2_umgestellt:false, Wartung_OK:false, Wartung_faellig:false },
  timed: seq([[0,{ Wartung_OK:true },{ Wartung_faellig:false }],[0.1,{ Wartung_OK:false },{}]].concat(pulses('W2_umgestellt', 5, i => ({ Wartung_faellig: i >= 5 })))),
  start:'NETWORK Wartung\nW2_umgestellt AND CTU(Z_Wartung, PV:=50, R:=Wartung_OK) => Wartung_faellig;',
  ref:'NETWORK Wartung\nW2_umgestellt AND CTD(Z_Wartung, PV:=5, LD:=Wartung_OK) => Wartung_faellig;', man:'zaehler', must:['CTD'],
  hint:'Zähler-Box: Typ CTD, PV 5, Laden Wartung_OK.',
  bind:['switch2Moving=W2_umgestellt', 'lightYellow=Wartung_faellig'] });

defFup({ id:'f8_boss', ch:8, title:'Boss: Der gezählte Abschnitt', boss:true,
  story:'ARIA fälscht die Gleisfreimeldung und schickt Züge in besetzte Gleise. Frau Gasser: „Wir zählen selbst, jede Achse hinein und jede Achse hinaus.“',
  brief:'<b>NW 1–3:</b> Achszähler wie gehabt (<code>Z_Ein</code>, <code>Z_Aus</code>, PV 1000, R <code>Grundstellung</code>, Vergleich → <code>Abschnitt_besetzt</code>)<br><b>NW 4:</b> ohne Bedingung → MOVE <code>Z_Ein.CV</code> nach <code>Anzeige</code><br><b>NW 5:</b> <code>Taste_A</code> und nicht <code>Abschnitt_besetzt</code> → <code>Signal_A</code><br><b>NW 6:</b> <code>Abschnitt_besetzt</code> → <code>Melder_Rot</code>',
  learn:'Achszähler, Anzeige und Signal in einem Programm.',
  take:'Der Achszähler ist das Herz der Gleisfreimeldung: Zwei Zähler, ein Vergleich — und das Signal hängt direkt daran.',
  vars:{ Achse_ein:false, Achse_aus:false, Grundstellung:false, Ueberlauf_Ein:false, Ueberlauf_Aus:false, Abschnitt_besetzt:false, Anzeige:0, Taste_A:false, Signal_A:false, Melder_Rot:false },
  timed: seq([[0,{ Taste_A:true },{ Signal_A:true, Melder_Rot:false }]].concat(pulses('Achse_ein', 2, i => ({ Anzeige:i, Signal_A:false, Melder_Rot:true })), pulses('Achse_aus', 1, () => ({ Melder_Rot:true })), pulses('Achse_aus', 1, () => ({ Melder_Rot:false, Signal_A:true })),
    [[0.1,{ Grundstellung:true },{ Anzeige:0, Melder_Rot:false }]])),
  ref: ACHS + '\n\nNETWORK Anzeige\n=> MOVE(Z_Ein.CV, Anzeige);\n\nNETWORK Signal A\nTaste_A AND NOT Abschnitt_besetzt => Signal_A;\n\nNETWORK Besetztmelder\nAbschnitt_besetzt => Melder_Rot;',
  man:'zaehler', must:['CTU','CMP','MOVE','NC'],
  hint:'Sechs Netzwerke. Der Vergleich kommt nach beiden Zählern.',
  bind:['trackB=Abschnitt_besetzt', 'axleCount=Anzeige', 'signalEntry=Signal_A', 'lightRed=Melder_Rot'] });
})();
