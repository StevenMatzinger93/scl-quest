/* ===== SENSORWERKSTATT Modul 1: Signale und digitale Sensoren anschliessen ===== */
(function(root){
const { w3, c2, field, need, PRE_SM } = root.SW;
const SORT_TAGS = [{ name: 'Start', type: 'Bool', addr: '%I0.0' }, { name: 'Stopp', type: 'Bool', addr: '%I0.1' }, { name: 'Ind_Metall', type: 'Bool', addr: '%I0.4' },
  { name: 'Rutsche_Voll', type: 'Bool', addr: '%I1.0' }, { name: 'Haube_Zu', type: 'Bool', addr: '%I1.3' }, { name: 'Band', type: 'Bool', addr: '%Q0.0' }];

defWorkshopTask({ id: 'w1_datenblatt', module: 1, no: 1, level: 'schnell', title: 'Typenschild lesen',
  story: 'Der Werkmeister legt dir einen Sensor in die Hand: <i>„Bevor du etwas anschliesst, liest du das Typenschild. Immer.“</i>',
  brief: '<p>Das Typenschild von <b>-B1</b>:</p>' + SW.plate('B1') + '<p>Beantworte die Fragen in den Arbeitsschritten. Die Detailkarte (Klick auf -B1) zeigt zusätzlich die M12-Belegung.</p>',
  learn: 'Die wichtigsten Angaben eines Sensor-Typenschilds deuten.', take: 'Versorgung, Schaltausgang (PNP/NPN, NO/NC), Schaltabstand und Einbauart stehen auf dem Typenschild — das ist die erste Station jeder Inbetriebnahme.',
  man: 'sensoren', theory: 'st1a', hint: 'PNP heisst plusschaltend: Der Ausgang schaltet +24 V auf die schwarze Ader.', hint2: '„bündig“ bedeutet: Der Sensor darf bündig in Metall eingebaut werden.',
  parts: ['B1'], modules: ['A1'], x2: [5],
  steps: [
    { kind: 'quiz', text: 'Mit welcher Spannung wird -B1 versorgt?', options: ['10–30 V DC', '230 V AC', '5 V DC', '0–10 V'], correct: 0 },
    { kind: 'quiz', text: 'Was liefert der Ausgang im geschalteten Zustand (PNP NO, Teil erkannt)?', options: ['+24 V auf der schwarzen Ader (BK)', '0 V auf der schwarzen Ader', 'Einen Strom von 4–20 mA', 'Nichts – NO heisst „kein Ausgang“'], correct: 0 },
    { kind: 'quiz', text: 'Nennschaltabstand Sn laut Typenschild (mm)?', answer: 8, tol: 0, unit: 'mm' },
    { kind: 'quiz', text: 'Was bedeutet „bündig“?', options: ['Der Sensor darf bündig in Metall eingebaut werden', 'Der Sensor erkennt nur bündig anliegende Teile', 'Der Sensor hat keinen Stecker', 'Der Sensor ist wasserdicht'], correct: 0 },
    { kind: 'quiz', text: 'Welche Ader führt bei einem 3-Leiter-Sensor das Schaltsignal?', options: ['BK (schwarz, Pin 4)', 'BN (braun, Pin 1)', 'BU (blau, Pin 3)', 'WH (weiss, Pin 2)'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_b1_anschliessen', module: 1, no: 2, level: 'schnell', title: 'Der erste Sensor',
  story: 'ARIA hat -B1 abgeschraubt und die Leitung abgezogen. Die Sortierstrecke erkennt kein Metall mehr.',
  brief: '<p>Bringe den induktiven Sensor <b>-B1</b> wieder in Betrieb:</p><ol><li>Mit dem <b>Gabelschlüssel</b> die Kontermuttern lösen, Abstand <b>4 mm</b> einstellen, festziehen.</li><li>M12-Leitung anstecken und die Rändelmutter festziehen.</li><li>Adern auf die Initiatorenklemme <b>-X2:5</b> legen: BN → L+, BU → M, BK → Signal.</li><li>-Q0 einschalten und ein Stahlteil vorbeiführen (Anlage bedienen): Die LEDs am Sensor, an -X2:5 und am Eingang %I0.4 leuchten.</li></ol>',
  learn: 'Einen 3-Leiter-Sensor montieren, anstecken und auf eine Initiatorenklemme auflegen.', take: 'BN = L+, BU = M, BK = Signal. Drei LEDs zeigen den Weg: Sensor → Klemme → Eingang.',
  man: 'm12', theory: 'st1a', hint: 'Werkzeug zuerst: Gabelschlüssel wählen, dann -B1 anklicken.', hint2: 'Auf der Klemmleiste: Ader BN antippen, dann -X2:5 L+ antippen. Genauso BU → M und BK → Signal.',
  parts: ['B1'], modules: ['A1'], x2: [4, 5, 6], start: { base: 'schrank', plugs: { B1: false }, mounts: { B1: { dist: 9, tight: false } } },
  steps: [
    { kind: 'mount', text: '-B1 auf 4 mm einstellen und festziehen', part: 'B1', dist: [4, 0.5] },
    { kind: 'plug', text: 'M12-Leitung von -B1 anstecken und festziehen', parts: ['B1'] },
    { kind: 'wire', text: 'Adern von -B1 auf -X2:5 auflegen', target: need('B1'), ref: { add: w3('B1', 5) },
      wrong: [{ add: [['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:6.S']] }, { add: [['B1:BN', 'X2:5.M'], ['B1:BU', 'X2:5.L+'], ['B1:BK', 'X2:5.S']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Stahlteil vor -B1: %I0.4 = 1, ohne Teil: 0', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] }
  ] });

defWorkshopTask({ id: 'w1_start_stopp', module: 1, no: 3, level: 'schnell', title: 'Schliesser und Öffner',
  story: 'Am Bedienpult fehlen die Adern von Start und Stopp. Der Werkmeister: <i>„Stopp ist ein Öffner. Überleg dir, was der Eingang in Ruhe zeigt.“</i>',
  brief: '<p>Schliesse <b>-S1 Start</b> (Schliesser, Kontakte 13/14) an <b>-X2:1</b> und <b>-S2 Stopp</b> (Öffner, Kontakte 11/12) an <b>-X2:2</b> an: erster Kontakt auf L+, zweiter auf Signal.</p><p>Beobachte die Eingänge %I0.0 und %I0.1 in Ruhe und beim Drücken.</p>',
  learn: 'Schliesser und Öffner anschliessen und ihren Ruhezustand am Eingang erkennen.', take: 'Ein Öffner liefert in Ruhe 1. Drahtbruch sieht aus wie „Taster gedrückt“ — deshalb sind Stopp und Not-Halt Öffner.',
  man: 'nonc', theory: 'st1a', hint: 'Kontakt 13 (bzw. 11) kommt auf die L+-Ebene, 14 (bzw. 12) auf die Signalebene.', hint2: 'Stopp in Ruhe: Kontakt geschlossen → 24 V am Eingang → %I0.1 = 1.',
  parts: ['S1', 'S2'], modules: ['A1'], x2: [1, 2, 3], start: 'preset:schrank',
  steps: [
    { kind: 'wire', text: '-S1 auf -X2:1 und -S2 auf -X2:2 auflegen', target: need('S1').concat(need('S2')), ref: { add: c2('S1', 1).concat(c2('S2', 2)) },
      wrong: [{ add: c2('S1', 2).concat(c2('S2', 1)) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Ruhe: %I0.0 = 0, %I0.1 = 1 · Start gedrückt: %I0.0 = 1 · Stopp gedrückt: %I0.1 = 0', cases: [{ world: {}, di: { 'I0.0': false, 'I0.1': true } }, { world: { press: ['S1'] }, di: { 'I0.0': true } }, { world: { press: ['S2'] }, di: { 'I0.1': false } }] },
    { kind: 'quiz', text: 'Welchen Wert zeigt %I0.1 (Stopp), wenn niemand drückt? (0 oder 1)', answer: 1, tol: 0 },
    { kind: 'quiz', text: 'Die Ader von -S2 bricht. Was sieht die SPS?', options: ['%I0.1 = 0 – wie „Stopp gedrückt“, die Anlage hält an', '%I0.1 = 1 – nichts passiert', 'Einen Drahtbruch-Alarm im Diagnosepuffer', 'Die CPU geht in STOP'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_variablentabelle', module: 1, no: 4, level: 'schnell', title: 'Variablen nach Klemmenplan',
  story: 'ARIA hat die PLC-Variablentabelle gelöscht. Ohne Namen weiss niemand, was %I0.4 bedeutet.',
  brief: '<p>Öffne den <b>Engineering-Laptop</b> (Ansicht 7) und lege im Reiter <b>PLC-Variablen</b> nach dem Klemmenplan an:</p><table><tr><th>Name</th><th>Datentyp</th><th>Adresse</th></tr><tr><td>Start</td><td>Bool</td><td>%I0.0</td></tr><tr><td>Stopp</td><td>Bool</td><td>%I0.1</td></tr><tr><td>Ind_Metall</td><td>Bool</td><td>%I0.4</td></tr><tr><td>Rutsche_Voll</td><td>Bool</td><td>%I1.0</td></tr><tr><td>Haube_Zu</td><td>Bool</td><td>%I1.3</td></tr><tr><td>Band</td><td>Bool</td><td>%Q0.0</td></tr></table>',
  learn: 'Symbolische Namen, Datentypen und Adressen in der PLC-Variablentabelle anlegen.', take: 'Die Variablentabelle verbindet Klemmenplan und Programm: Name ↔ Adresse. Doppelte Adressen meldet das Engineering sofort.',
  man: 'klemmenplan', theory: 'st1a', hint: '„+ Variable“ fügt eine Zeile an. Name, Datentyp und Adresse eintragen.', hint2: 'Eingänge beginnen mit %I, Ausgänge mit %Q. Bool braucht eine Bitadresse wie %I0.4.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:schrank', tags: 'leer',
  steps: [{ kind: 'tags', text: 'Sechs Variablen nach Klemmenplan anlegen', require: SORT_TAGS }] });

defWorkshopTask({ id: 'w1_band_selbsthaltung', module: 1, no: 5, level: 'schnell', title: 'Bandfreigabe mit Selbsthaltung',
  story: 'Die Sortierstrecke ist verdrahtet. Jetzt braucht das Band ein Programm — und ARIA wettet, dass du den Öffner falsch auswertest.',
  brief: '<p>Programmiere im Engineering (Reiter <b>Programm</b>, SCL, KOP oder FUP):</p><ul><li><b>"Band"</b> startet mit <b>"Start"</b> und hält sich selbst.</li><li><b>"Stopp"</b> (Öffner!) oder offene Haube (<b>"Haube_Zu"</b> = 0) schalten das Band aus.</li></ul><p>Danach <b>in das Gerät laden</b> und die CPU in RUN bringen.</p>',
  learn: 'Selbsthaltung mit Öffner-Auswertung programmieren und laden.', take: 'Ein Öffner wird im Programm <b>ohne</b> NOT abgefragt: In Ruhe ist er 1 und gibt frei.',
  man: 'nonc', theory: 'st1b', hint: 'Selbsthaltung: "Band" := ("Start" OR "Band") AND …', hint2: '"Stopp" ist in Ruhe 1 — also einfach mit AND verknüpfen, ohne NOT.',
  parts: ['S1', 'S2', 'S5', 'B1'], modules: ['A1'], x2: [1, 2, 5, 12], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Programm schreiben: Selbsthaltung, Stopp und Haube', langs: ['scl', 'kop', 'fup'],
      start: { scl: '"Band" := "Start";\n', kop: 'NETWORK Band\n"Start" => "Band";', fup: 'NETWORK Band\n"Start" => "Band";' },
      ref: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";\n', kop: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" => "Band";', fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" => "Band";' },
      timed: [{ steps: [[0, { Start: false, Stopp: true, Haube_Zu: true }, { Band: false }], [0.05, { Start: true }, { Band: true }], [0.05, { Start: false }, { Band: true }], [0.05, { Stopp: false }, { Band: false }], [0.05, { Stopp: true }, { Band: false }],
        [0.05, { Start: true }, { Band: true }], [0.05, { Start: false, Haube_Zu: false }, { Band: false }], [0.05, { Haube_Zu: true }, { Band: false }]] }],
      wrong: [{ scl: '"Band" := ("Start" OR "Band") AND NOT "Stopp" AND "Haube_Zu";' }, { scl: '"Band" := "Start" AND "Stopp" AND "Haube_Zu";' }, { scl: '"Band" := ("Start" OR "Band") AND "Stopp";' }] },
    { kind: 'load', text: 'In das Gerät laden und CPU starten' }
  ] });

defWorkshopTask({ id: 'w1_antivalent', module: 1, no: 6, level: 'werkstatt', title: 'Antivalenter Sensor',
  story: 'Für den Tank ist ein kapazitiver Sensor mit <b>zwei</b> Ausgängen gekommen: Schliesser und Öffner zugleich. Der Werkmeister will ihn vorher am Prüfstand testen.',
  brief: '<p>Schliesse <b>-B8</b> (4-Leiter, PNP, antivalent) an die SM 1221 an:</p><ul><li>BN → <b>-X2:21</b> L+, BU → -X2:21 M</li><li>BK (Schliesser) → -X2:21 Signal (→ %I16.0)</li><li>WH (Öffner) → -X2:22 Signal (→ %I16.1)</li></ul><p>Prüfe: Ohne Medium ist %I16.0 = 0 und %I16.1 = 1, mit Medium umgekehrt.</p>',
  learn: 'Einen 4-Leiter-Sensor mit antivalenten Ausgängen anschliessen.', take: 'Antivalent heisst: Die beiden Ausgänge sind immer entgegengesetzt. Sind beide gleich, stimmt etwas nicht — ideal zur Überwachung.',
  man: 'nonc', theory: 'st1b', hint: 'Werkstatt-Stufe: Aderendhülsen sind Pflicht — lass sie eingeschaltet.', hint2: 'Die Signalebenen -X2:21/22 sind bereits zur SM 1221 vorverdrahtet.',
  parts: ['B8'], modules: ['A1', 'A4'], x2: [21, 22, 23], start: 'preset:sm1221',
  steps: [
    { kind: 'wire', text: '-B8 an -X2:21/22 auflegen', target: [{ net: ['B8:BN', 'POT:L+'] }, { net: ['B8:BU', 'POT:M'] }, { net: ['B8:BK', 'DI:I16.0'] }, { net: ['B8:WH', 'DI:I16.1'] }],
      ref: { add: [['B8:BN', 'X2:21.L+'], ['B8:BU', 'X2:21.M'], ['B8:BK', 'X2:21.S'], ['B8:WH', 'X2:22.S']] },
      wrong: [{ add: [['B8:BN', 'X2:21.L+'], ['B8:BU', 'X2:21.M'], ['B8:WH', 'X2:21.S'], ['B8:BK', 'X2:22.S']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Ohne Medium: %I16.0 = 0, %I16.1 = 1 · mit Medium: 1 / 0', cases: [{ world: { b8: false }, di: { 'I16.0': false, 'I16.1': true } }, { world: { b8: true }, di: { 'I16.0': true, 'I16.1': false } }] }
  ] });

defWorkshopTask({ id: 'w1_drahtbruch_s5', module: 1, no: 7, level: 'werkstatt', title: 'Drahtbruch an der Haube', debug: true,
  story: 'Der Werkmeister zieht eine Ader: <i>„Stell dir vor, die Leitung zum Haubenschalter bricht. Was passiert mit dem Band?“</i>',
  brief: '<p>Simuliere einen Drahtbruch an <b>-S5</b> (Haubenschalter, Öffner): Löse die Signalader <b>-S5:12</b> von -X2:12. Schalte ein und beobachte %I1.3 bei geschlossener Haube.</p><p>Beantworte danach die Fragen.</p>',
  learn: 'Drahtbruchsicherheit von Öffnern verstehen.', take: 'Bei einem Öffner führt ein Drahtbruch in den sicheren Zustand: Die Anlage sieht „Haube offen“ und stoppt. Ein Schliesser würde den Bruch verschweigen.',
  man: 'nonc', theory: 'st1b', hint: 'Ader lösen: dieselbe Verbindung erneut antippen (oder „lösen“).', hint2: 'Die Haube ist zu — trotzdem 0 am Eingang. Genau das ist der sichere Zustand.',
  parts: ['S5'], modules: ['A1'], x2: [12], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'wire', text: 'Signalader -S5:12 lösen (Drahtbruch simulieren)', target: [{ notNet: ['S5:12', 'DI:I1.3'] }, { net: ['S5:11', 'POT:L+'] }], ref: { remove: [['S5:12', 'X2:12.S']] }, wrong: [{ remove: [] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Haube geschlossen, trotzdem %I1.3 = 0', cases: [{ world: { hood: 'zu' }, di: { 'I1.3': false } }] },
    { kind: 'quiz', text: 'Was macht das Bandprogramm aus Aufgabe 5 jetzt?', options: ['Das Band stoppt bzw. startet nicht – sicherer Zustand', 'Das Band läuft weiter, der Bruch bleibt unbemerkt', 'Die CPU geht in STOP', 'Das Band läuft rückwärts'], correct: 0 },
    { kind: 'quiz', text: 'Wäre -S5 ein Schliesser (1 = Haube offen), was würde ein Drahtbruch bewirken?', options: ['Nichts sichtbar – offene Haube würde nicht mehr erkannt', 'Das Band stoppt sofort', 'Die Sicherung -F2 löst aus', 'Die Haube öffnet sich'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_antivalenz_prog', module: 1, no: 8, level: 'werkstatt', title: 'Antivalenz überwachen',
  story: '-B8 ist angeschlossen. Wenn Schliesser und Öffner gleichzeitig dasselbe melden, ist der Sensor defekt oder eine Ader gebrochen — ARIA soll das nicht verstecken können.',
  brief: '<p>Programmiere eine <b>Antivalenzüberwachung</b>: Sind <b>"B8_NO"</b> und <b>"B8_NC"</b> <b>länger als 100 ms</b> gleich, leuchtet <b>"Lampe_Rot"</b> (Sensorfehler). Kurze Überschneidungen beim Umschalten sind erlaubt.</p><p>Nutze dafür die Zeitinstanz <b>"T_Antivalenz"</b> (TON). Die Variablen B8_NO (%I16.0) und B8_NC (%I16.1) sind angelegt.</p>',
  learn: 'Antivalente Signale mit Zeitüberwachung auswerten.', take: 'NOT (NO XOR NC) ist 1, wenn beide gleich sind. Die Zeitverzögerung filtert das kurze Umschalten heraus.',
  man: 'nonc', theory: 'st1b', hint: 'Gleich sind die beiden, wenn NOT ("B8_NO" XOR "B8_NC").', hint2: '"T_Antivalenz"(IN := …, PT := T#100MS); "Lampe_Rot" := "T_Antivalenz".Q;',
  parts: ['B8'], modules: ['A1', 'A4'], x2: [21, 22], start: { base: 'sm1221', mainSwitch: true, wires: [['B8:BN', 'X2:21.L+'], ['B8:BU', 'X2:21.M'], ['B8:BK', 'X2:21.S'], ['B8:WH', 'X2:22.S']] },
  steps: [
    { kind: 'program', text: 'Antivalenzüberwachung programmieren', langs: ['scl', 'kop', 'fup'], fb: { T_Antivalenz: 'TON' },
      tagsExtra: [{ name: 'B8_NO', type: 'Bool', addr: '%I16.0', comment: '-B8 Schliesser' }, { name: 'B8_NC', type: 'Bool', addr: '%I16.1', comment: '-B8 Öffner' }],
      start: { scl: '"Lampe_Rot" := FALSE;\n', kop: 'NETWORK Sensorfehler\n=> R "Lampe_Rot";', fup: 'NETWORK Sensorfehler\n=> R "Lampe_Rot";' },
      ref: { scl: '"T_Antivalenz"(IN := NOT ("B8_NO" XOR "B8_NC"), PT := T#100MS);\n"Lampe_Rot" := "T_Antivalenz".Q;\n',
        kop: 'NETWORK Sensorfehler\n(("B8_NO" AND "B8_NC") OR (NOT "B8_NO" AND NOT "B8_NC")) AND TON(T_Antivalenz, T#100MS) => "Lampe_Rot";',
        fup: 'NETWORK Sensorfehler\n(("B8_NO" AND "B8_NC") OR (NOT "B8_NO" AND NOT "B8_NC")) AND TON(T_Antivalenz, T#100MS) => "Lampe_Rot";' },
      timed: [{ steps: [[0, { B8_NO: true, B8_NC: false }, { Lampe_Rot: false }], [0.05, { B8_NC: true }, { Lampe_Rot: false }], [0.05, {}, { Lampe_Rot: false }], [0.05, {}, { Lampe_Rot: true }],
        [0.05, { B8_NC: false }, { Lampe_Rot: false }], [0.05, { B8_NO: false }, { Lampe_Rot: false }], [0.08, {}, { Lampe_Rot: false }], [0.05, {}, { Lampe_Rot: true }], [0.05, { B8_NC: true }, { Lampe_Rot: false }]] }],
      wrong: [{ scl: '"Lampe_Rot" := NOT ("B8_NO" XOR "B8_NC");' }, { scl: '"T_Antivalenz"(IN := "B8_NO" XOR "B8_NC", PT := T#100MS);\n"Lampe_Rot" := "T_Antivalenz".Q;' }] },
    { kind: 'load', text: 'Laden und starten' }
  ] });

defWorkshopTask({ id: 'w1_fehler_bk_ebene', module: 1, no: 9, level: 'werkstatt', title: 'LED an, Eingang aus', debug: true,
  story: 'Nach ARIAs „Wartung“ leuchtet die gelbe LED an -B1, wenn Stahl vorbeikommt — aber %I0.4 bleibt dunkel.',
  brief: '<p>Finde den Fehler an -B1 und behebe ihn. Tipp: Die Sensor-LED zeigt, dass der Sensor schaltet. Wohin geht sein Signal?</p>',
  learn: 'Systematisch vom Sensor über die Klemme zum Eingang suchen.', take: 'Sensor-LED an, Klemmen-LED aus: Das Signal kommt nicht auf der Signalebene an. Eine Ader auf der falschen Klemmenebene ist ein Klassiker.',
  man: 'schrank', theory: 'st1b', hint: 'Schau dir -X2:5 genau an: Welche Ebene hat zwei Adern?', hint2: 'BK gehört auf die Signalebene (Mitte), nicht auf L+.',
  parts: ['B1'], modules: ['A1'], x2: [4, 5, 6], start: { base: 'schrank', wires: [['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:5.L+']], mainSwitch: true, mounts: { B1: { dist: 4, tight: true } } },
  symptom: { cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': false } }] },
  steps: [
    { kind: 'wire', text: 'Fehler an -X2:5 beheben', target: need('B1').concat([{ notNet: ['B1:BK', 'POT:L+'] }]), ref: { remove: [['B1:BK', 'X2:5.L+']], add: [['B1:BK', 'X2:5.S']] }, wrong: [{ remove: [], add: [] }] },
    { kind: 'observe', text: 'Stahlteil: %I0.4 = 1', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Wo lag der Fehler?', options: ['BK lag auf der L+-Ebene statt auf der Signalebene', 'Der Sensor war defekt', '1M war nicht angeschlossen', 'Die Sicherung -F2 war ausgelöst'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w1_boss_sortierstrecke', module: 1, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Die Sortierstrecke lebt',
  story: 'ARIA hat die Sortierstrecke zerlegt: Sensoren abgeschraubt, Querbrücker gezogen, Programm gelöscht. Der Werkmeister stellt dir einen Kaffee hin: <i>„Bis Schichtende läuft das Band wieder.“</i>',
  brief: '<ol><li><b>-B1</b> auf 4 mm montieren, <b>-B5</b> (Reflexions-Lichtschranke) ausrichten.</li><li>M12-Leitungen von -B1 und -B5 anstecken und festziehen.</li><li>Querbrücker L+ und M an -X2 stecken.</li><li>-S1 → -X2:1, -S2 → -X2:2, -B1 → -X2:5, -B5 → -X2:9, -S5 → -X2:12 auflegen.</li><li>Variablen Start, Stopp, Ind_Metall, Rutsche_Voll, Haube_Zu, Band anlegen.</li><li>Programm: Band mit Selbsthaltung, aus bei Stopp, offener Haube oder <b>voller Rutsche</b> ("Rutsche_Voll" = 1).</li><li>Laden, RUN.</li></ol>',
  learn: 'Eine Sensorstrecke vollständig in Betrieb nehmen.', take: 'Montieren → anstecken → auflegen → Variablen → Programm → laden. In genau dieser Reihenfolge — und nach jedem Schritt prüfen.',
  man: 'schrank', theory: 'st1b', hint: 'Arbeite die Schritte der Reihe nach ab — die Liste zeigt, was schon passt.', hint2: 'Rutsche_Voll ist ein normaler Schliesser-Sensor: Band nur, wenn NOT "Rutsche_Voll".',
  parts: ['S1', 'S2', 'S5', 'B1', 'B5'], modules: ['A1'], x2: [1, 2, 5, 9, 12], start: { base: 'schrank_ohne_qb', plugs: { B1: false, B5: false }, mounts: { B1: { dist: 10, tight: false }, B5: { align: { h: 5, v: -4 } } } },
  tags: SORT_TAGS.filter(t => t.name === 'Band'),
  steps: [
    { kind: 'mount', text: '-B1 auf 4 mm', part: 'B1', dist: [4, 0.5] },
    { kind: 'mount', text: '-B5 ausrichten (Stabilitäts-LED ruhig)', part: 'B5', align: true, tight: false },
    { kind: 'plug', text: 'M12 von -B1 und -B5 fest', parts: ['B1', 'B5'] },
    { kind: 'wire', text: 'Querbrücker und fünf Geräte auflegen', target: [{ bridge: 'QB_X2_LP' }, { bridge: 'QB_X2_M' }].concat(need('S1'), need('S2'), need('B1'), need('B5'), need('S5')),
      ref: { bridges: ['QB_X2_LP', 'QB_X2_M'], add: [].concat(field('S1'), field('S2'), field('B1'), field('B5'), field('S5')) }, wrong: [{ bridges: ['QB_X2_LP'], add: [].concat(field('S1'), field('S2'), field('B1'), field('B5'), field('S5')) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe', cases: [{ world: { parts: { B1: 'stahl', B5: 'stahl' } }, di: { 'I0.4': true, 'I1.0': true, 'I0.1': true, 'I1.3': true } }, { world: { press: ['S1'], hood: 'offen' }, di: { 'I0.0': true, 'I1.3': false, 'I0.4': false } }] },
    { kind: 'tags', text: 'Variablen anlegen', require: SORT_TAGS },
    { kind: 'program', text: 'Bandfreigabe programmieren', langs: ['scl', 'kop', 'fup'],
      start: { scl: '', kop: 'NETWORK Band\n"Start" => "Band";', fup: 'NETWORK Band\n"Start" => "Band";' },
      ref: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND NOT "Rutsche_Voll";\n',
        kop: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND NOT "Rutsche_Voll" => "Band";', fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND NOT "Rutsche_Voll" => "Band";' },
      timed: [{ steps: [[0, { Start: true, Stopp: true, Haube_Zu: true, Rutsche_Voll: false }, { Band: true }], [0.05, { Start: false }, { Band: true }], [0.05, { Rutsche_Voll: true }, { Band: false }], [0.05, { Rutsche_Voll: false }, { Band: false }],
        [0.05, { Start: true }, { Band: true }], [0.05, { Start: false, Stopp: false }, { Band: false }], [0.05, { Stopp: true, Start: true, Haube_Zu: false }, { Band: false }]] }],
      wrong: [{ scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";' }, { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu" AND "Rutsche_Voll";' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);
