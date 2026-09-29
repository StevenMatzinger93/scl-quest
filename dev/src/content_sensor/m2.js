/* ===== SENSORWERKSTATT Modul 2: PNP und NPN ===== */
(function(root){
const { w3, c2, field, need, PRE_CPU, PRE_SM } = root.SW;
const T = () => root.SensorTasks;
// Spannung zwischen zwei Klemmstellen im Szenario sc (Multimeter V DC, rote Spitze a, schwarze Spitze b)
const U = (a, b, sc) => (ctx, SM, W) => W.voltage(ctx.state, a, b, T().worldFrom(ctx.state, sc));

// Prüfstand NPN: SM 1221 Gruppe .0–.3 stromliefernd (1M auf L+), -N1 auf -X2:21
defPreset('m2_npn_bank', { base: 'schrank', wires: PRE_SM.concat([['A4:1M', 'X1:L+4'], ['A4:2M', 'X1:M5']], w3('N1', 21)) });
// CPU-Gruppe: 1M falsch auf L+ (Elektriker hat NPN erwartet), -B1, -B5, -S1 aufgelegt
defPreset('m2_1m_falsch', { wires: PRE_CPU.concat([['A1:1M', 'X1:L+2']], field('S1'), field('B1'), field('B5')), bridges: ['QB_X2_LP', 'QB_X2_M'] });
// SM 1221 mit NPN-Übungssensor auf -X2:21 und -B8 (PNP) auf -X2:25, beide Gruppen auf M
defPreset('m2_npn_an_pnp', { base: 'sm1221', wires: w3('N1', 21).concat([['B8:BN', 'X2:25.L+'], ['B8:BU', 'X2:25.M'], ['B8:BK', 'X2:25.S']]) });

defWorkshopTask({ id: 'w2_pnp_messen', module: 2, no: 1, level: 'schnell', title: 'PNP gemessen',
  story: 'Der Werkmeister drückt dir das Multimeter in die Hand: <i>„Glauben ist gut, messen ist besser. Zeig mir, was ein plusschaltender Sensor wirklich an die Klemme liefert.“</i>',
  brief: '<p>-B1 (induktiv, <b>PNP</b> NO) ist auf <b>-X2:5</b> aufgelegt. Schalte -Q0 ein und miss mit dem Multimeter (V DC):</p><ul><li>rote Spitze auf <b>-X2:5 Signal</b>, schwarze Spitze auf <b>-X2:5 M</b></li><li>einmal mit Stahlteil vor -B1, einmal ohne Teil</li></ul><p>Trage die Messwerte ins Protokoll ein.</p>',
  learn: 'Das Signal eines PNP-Sensors gegen M messen und deuten.', take: 'PNP = plusschaltend: Hat der Sensor geschaltet, liegen am Signal <b>+24 V gegen M</b>. Sonst 0 V.',
  man: 'pnpnpn', theory: 'st2a', hint: 'Multimeter auf V DC stellen, dann die beiden Messspitzen auf die Klemmstellen setzen.', hint2: 'PNP schaltet L+ auf die schwarze Ader: Mit Teil misst du die volle Versorgungsspannung.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Signal gegen M messen', ask: [
      { q: 'Stahlteil vor -B1: -X2:5 Signal gegen M', unit: 'V', calc: U('X2:5.S', 'X2:5.M', { parts: { B1: 'stahl' } }), tol: 0.5 },
      { q: 'Kein Teil: -X2:5 Signal gegen M', unit: 'V', calc: U('X2:5.S', 'X2:5.M', {}), tol: 0.5 }] },
    { kind: 'quiz', text: 'Was schaltet ein PNP-Sensor auf seinen Ausgang, wenn er ein Teil erkennt?', options: ['+24 V (L+)', '0 V (M)', 'Einen Strom von 20 mA', 'Die Versorgung wird unterbrochen'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_npn_messen', module: 2, no: 2, level: 'schnell', title: 'NPN gemessen',
  story: 'Aus dem Lager kommt ein Übungssensor <b>-N1</b> mit der Aufschrift „NPN NO“. Er hängt schon an der SM 1221. ARIA flüstert: <i>„Miss ihn gegen M. Du wirst staunen.“</i>',
  brief: '<p>-N1 (induktiv, <b>NPN</b> NO) ist auf <b>-X2:21</b> aufgelegt (→ %I16.0). Die Eingangsgruppe der SM 1221 ist für NPN vorbereitet. Schalte -Q0 ein und miss (V DC):</p><ol><li>Teil vor -N1: rot auf <b>-X2:21 Signal</b>, schwarz auf <b>-X2:21 M</b></li><li>Teil vor -N1: rot auf <b>-X2:21 L+</b>, schwarz auf <b>-X2:21 Signal</b></li><li>Kein Teil: rot auf L+, schwarz auf Signal</li></ol>',
  learn: 'Das Signal eines NPN-Sensors gegen M und gegen L+ messen.', take: 'NPN = minusschaltend: Der aktive Ausgang zieht das Signal auf <b>0 V</b>. Die 24 V siehst du nur <b>gegen L+</b>.',
  man: 'pnpnpn', theory: 'st2a', hint: 'Bei NPN ist das Signal im geschalteten Zustand mit M verbunden.', hint2: 'Zwischen L+ und einem Signal, das auf M liegt, misst du die ganze Versorgungsspannung.',
  parts: ['N1'], modules: ['A1', 'A4'], x2: [21, 22], start: 'preset:m2_npn_bank',
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Teil vor -N1: %I16.0 = 1, ohne Teil: 0', cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I16.0': false } }] },
    { kind: 'measure', text: 'NPN-Signal messen', ask: [
      { q: 'Teil da: Signal gegen M', unit: 'V', calc: U('X2:21.S', 'X2:21.M', { parts: { N1: 'stahl' } }), tol: 0.5 },
      { q: 'Teil da: L+ gegen Signal', unit: 'V', calc: U('X2:21.L+', 'X2:21.S', { parts: { N1: 'stahl' } }), tol: 0.5 },
      { q: 'Kein Teil: L+ gegen Signal', unit: 'V', calc: U('X2:21.L+', 'X2:21.S', { parts: { N1: null } }), tol: 0.5 }] },
    { kind: 'quiz', text: 'Was fällt beim NPN-Sensor auf?', options: ['Geschaltet liegt das Signal auf 0 V – messbar ist die Spannung nur gegen L+', 'Geschaltet liegen +24 V gegen M, genau wie bei PNP', 'Das Signal ist immer 12 V', 'Ein NPN-Sensor braucht keine Versorgung'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_1m_cpu', module: 2, no: 3, level: 'werkstatt', title: '1M der CPU',
  story: 'Ein Aushilfselektriker hat den Schrank „fertig“ gemacht. Die Sensor-LEDs leuchten, doch die Eingangs-LEDs der CPU bleiben dunkel. Er zuckt mit den Schultern: <i>„Ich dachte, da kommen NPN-Sensoren hin.“</i>',
  brief: '<p>An der CPU 1214C hängen nur <b>PNP-Sensoren</b> und Taster, die +24 V schalten. Das Bezugspotential <b>1M</b> der Eingangsgruppe liegt aber auf L+.</p><ol><li>Ader von <b>-A1:1M</b> an -X1:L+2 lösen.</li><li><b>-A1:1M</b> auf die M-Schiene (<b>-X1:M2</b>) legen.</li><li>Einschalten und prüfen: Stahlteil vor -B1 → %I0.4, Teil vor -B5 → %I1.0, Start → %I0.0.</li></ol>',
  learn: 'Das Bezugspotential 1M der CPU-Eingänge passend zu PNP-Gebern auflegen.', take: 'PNP-Geber brauchen einen <b>stromziehenden</b> Eingang: 1M auf <b>M</b>. Der Strom fliesst vom Sensor durch den Eingang nach M.',
  man: 'eingang', theory: 'st2a', hint: 'Lösen: dieselbe Verbindung erneut antippen. Dann 1M neu auflegen.', hint2: 'Der Eingangsstrom muss vom +24-V-Signal durch den Eingang zu 1M fliessen können – also muss 1M auf M liegen.',
  parts: ['S1', 'B1', 'B5'], modules: ['A1'], x2: [1, 5, 9], start: 'preset:m2_1m_falsch',
  steps: [
    { kind: 'wire', text: '-A1:1M von L+ auf M umklemmen', target: [{ net: ['A1:1M', 'POT:M'] }, { notNet: ['A1:1M', 'POT:L+'] }].concat(need('B1'), need('B5'), need('S1')),
      ref: { remove: [['A1:1M', 'X1:L+2']], add: [['A1:1M', 'X1:M2']] },
      wrong: [{ add: [['A1:1M', 'X1:M2']] }, { remove: [['A1:1M', 'X1:L+2']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Stahl vor -B1 und Teil vor -B5: %I0.4 = 1, %I1.0 = 1 · Start gedrückt: %I0.0 = 1', cases: [{ world: { parts: { B1: 'stahl', B5: 'stahl' } }, di: { 'I0.4': true, 'I1.0': true } }, { world: { press: ['S1'] }, di: { 'I0.0': true, 'I0.4': false } }] },
    { kind: 'quiz', text: 'Warum waren die Eingänge mit 1M auf L+ dunkel?', options: ['Signal und 1M lagen beide auf +24 V – ohne Spannungsdifferenz fliesst kein Eingangsstrom', 'Die Sensoren waren nicht versorgt', 'Die CPU war in STOP', 'Die Sicherung -F2 war ausgelöst'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_sm1221_npn', module: 2, no: 4, level: 'werkstatt', title: 'SM 1221 für NPN',
  story: 'Die Sortierstrecke bekommt eine Zusatzmaschine mit NPN-Sensoren. Der Werkmeister: <i>„Die kommen alle auf die SM 1221. Die CPU-Gruppe bleibt PNP.“</i>',
  brief: '<p>Auf der SM 1221 liegen <b>1M</b> (Eingänge .0–.3) und <b>2M</b> (Eingänge .4–.7) im Moment auf M.</p><ol><li><b>-A4:1M</b> von -X1:M4 lösen und auf <b>L+</b> (-X1:L+4) legen. 2M bleibt auf M.</li><li>NPN-Sensor <b>-N1</b> auf <b>-X2:21</b> auflegen: BN → L+, BU → M, BK → Signal (→ %I16.0).</li><li>Einschalten, Teil vor -N1: %I16.0 = 1.</li></ol><p>Die Gruppierung der SM 1221 steht im Gerätehandbuch – im Zweifel dort nachsehen.</p>',
  learn: 'Eine Eingangsgruppe der SM 1221 stromliefernd beschalten und einen NPN-Sensor anschliessen.', take: 'NPN-Geber brauchen einen <b>stromliefernden</b> Eingang: 1M auf <b>L+</b>. Das gilt für die ganze Gruppe – PNP und NPN nie in derselben Gruppe mischen.',
  man: 'eingang', theory: 'st2a', hint: 'Zuerst die alte Ader von 1M lösen. Sonst verbindest du L+ und M – Kurzschluss!', hint2: 'Nur 1M umklemmen: Eingang %I16.0 gehört zur Gruppe .0–.3.',
  parts: ['N1'], modules: ['A1', 'A4'], x2: [21, 22, 25], start: 'preset:sm1221',
  steps: [
    { kind: 'wire', text: '1M auf L+ umklemmen und -N1 auf -X2:21 auflegen', target: need('N1').concat([{ net: ['A4:1M', 'POT:L+'] }, { net: ['A4:2M', 'POT:M'] }]),
      ref: { remove: [['A4:1M', 'X1:M4']], add: [['A4:1M', 'X1:L+4']].concat(w3('N1', 21)) },
      wrong: [{ add: w3('N1', 21) }, { remove: [['A4:2M', 'X1:M5']], add: [['A4:2M', 'X1:L+5']].concat(w3('N1', 21)) }, { add: [['A4:1M', 'X1:L+4']].concat(w3('N1', 21)) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Teil vor -N1: %I16.0 = 1, ohne Teil: 0', cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I16.0': false } }] },
    { kind: 'quiz', text: 'Warum darf die alte Ader von 1M nicht auf M bleiben, wenn du 1M zusätzlich auf L+ legst?', options: ['Dann sind L+ und M über 1M verbunden – Kurzschluss, das Netzteil geht in Überlast', 'Dann zählt der Eingang doppelt', 'Das ist erlaubt und sogar besser', 'Dann wird der Sensor PNP'], correct: 0 }
  ] });

const ZAEHL_TAGS = [{ name: 'Teile_Anzahl', type: 'Int', addr: '%MW20', comment: 'HMI Anzeige Teilezähler' }, { name: 'HMI_Reset', type: 'Bool', addr: '%M10.0', comment: 'HMI Taste Zähler zurücksetzen' }];
defWorkshopTask({ id: 'w2_teilezaehler', module: 2, no: 5, level: 'schnell', title: 'Teilezähler',
  story: 'Die Produktion will wissen, wie viele Metallteile heute über das Band gelaufen sind. ARIA hat schon „gezählt“: 4 872 Teile in zehn Sekunden.',
  brief: '<p>Zähle die Metallteile an <b>-B1</b> ("Ind_Metall"): Jedes Teil zählt <b>genau einmal</b> – egal wie viele Zyklen es vor dem Sensor liegt.</p><ul><li>Zählerstand in <b>"Teile_Anzahl"</b> (Int, %MW20, Anzeige am HMI).</li><li><b>"HMI_Reset"</b> (%M10.0) setzt den Zähler auf 0.</li><li>Für die Flanke in SCL die Instanz <b>"Flanke_B1"</b> (R_TRIG) verwenden, in FUP <code>P(…)</code>.</li></ul><p>Danach laden und starten.</p>',
  learn: 'Ein Sensorsignal über eine steigende Flanke zählen.', take: 'Ein Sensor ist so lange 1, wie das Teil vor ihm liegt – viele Zyklen lang. Zählen darf man nur die <b>steigende Flanke</b>.',
  man: 'pnpnpn', theory: 'st2a', hint: '"Flanke_B1"(CLK := "Ind_Metall"); liefert in "Flanke_B1".Q genau einen Zyklus lang 1.', hint2: 'IF "Flanke_B1".Q THEN "Teile_Anzahl" := "Teile_Anzahl" + 1; END_IF; — und danach der Reset.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Teilezähler mit Flanke programmieren', langs: ['scl', 'fup'], fb: { Flanke_B1: 'R_TRIG' }, tagsExtra: ZAEHL_TAGS,
      start: { scl: 'IF "Ind_Metall" THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;\n', fup: 'NETWORK Zaehlen\n"Ind_Metall" => INC("Teile_Anzahl");' },
      ref: { scl: '"Flanke_B1"(CLK := "Ind_Metall");\nIF "Flanke_B1".Q THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;\nIF "HMI_Reset" THEN\n  "Teile_Anzahl" := 0;\nEND_IF;\n',
        fup: 'NETWORK Zaehlen\nP("Ind_Metall") => INC("Teile_Anzahl");\n\nNETWORK Zuruecksetzen\n"HMI_Reset" => MOVE(0, "Teile_Anzahl");' },
      timed: [{ steps: [[0, { Ind_Metall: false, HMI_Reset: false }, { Teile_Anzahl: 0 }], [0.05, { Ind_Metall: true }, { Teile_Anzahl: 1 }], [0.05, {}, { Teile_Anzahl: 1 }], [0.05, {}, { Teile_Anzahl: 1 }],
        [0.05, { Ind_Metall: false }, { Teile_Anzahl: 1 }], [0.05, { Ind_Metall: true }, { Teile_Anzahl: 2 }], [0.05, { Ind_Metall: false }, { Teile_Anzahl: 2 }], [0.05, { HMI_Reset: true }, { Teile_Anzahl: 0 }], [0.05, { HMI_Reset: false, Ind_Metall: true }, { Teile_Anzahl: 1 }]] }],
      wrong: [{ scl: 'IF "Ind_Metall" THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;\nIF "HMI_Reset" THEN\n  "Teile_Anzahl" := 0;\nEND_IF;' },
        { scl: '"Flanke_B1"(CLK := "Ind_Metall");\nIF "Flanke_B1".Q THEN\n  "Teile_Anzahl" := "Teile_Anzahl" + 1;\nEND_IF;' }] },
    { kind: 'load', text: 'In das Gerät laden und CPU starten' }
  ] });

defWorkshopTask({ id: 'w2_tabelle', module: 2, no: 6, level: 'schnell', title: 'Vier Kombinationen',
  story: 'Am Whiteboard hat der Werkmeister eine Tabelle gezeichnet: zwei Sensorarten, zwei Beschaltungen. <i>„Wer die im Schlaf kann, sucht nie wieder stundenlang.“</i>',
  brief: '<p>Fülle die Tabelle aus: Funktioniert der Eingang?</p><table><tr><th></th><th>1M auf M (stromziehend)</th><th>1M auf L+ (stromliefernd)</th></tr><tr><td>PNP-Sensor</td><td>A</td><td>B</td></tr><tr><td>NPN-Sensor</td><td>C</td><td>D</td></tr></table><p>Beantworte die Arbeitsschritte. Probier es am Prüfstand aus, wenn du unsicher bist (-B1 = PNP an der CPU, -N1 = NPN an der SM 1221).</p>',
  learn: 'Sensor-Schaltart und Eingangsbeschaltung einander zuordnen.', take: 'PNP ↔ 1M auf M, NPN ↔ 1M auf L+. Passt es nicht, leuchtet die Sensor-LED, aber der Eingang bleibt 0.',
  man: 'eingang', theory: 'st2b', hint: 'Der Eingangsstrom braucht einen Weg: vom Signal durch den Eingang zu 1M – oder umgekehrt.', hint2: 'PNP liefert +24 V, also muss 1M auf 0 V liegen. NPN liefert 0 V, also muss 1M auf +24 V liegen.',
  parts: ['B1', 'N1'], modules: ['A1', 'A4'], x2: [5, 21], start: 'preset:sm1221',
  steps: [
    { kind: 'quiz', text: 'Feld A: PNP-Sensor, 1M auf M', options: ['funktioniert', 'funktioniert nicht'], correct: 0 },
    { kind: 'quiz', text: 'Feld B: PNP-Sensor, 1M auf L+', options: ['funktioniert', 'funktioniert nicht'], correct: 1 },
    { kind: 'quiz', text: 'Feld C: NPN-Sensor, 1M auf M', options: ['funktioniert', 'funktioniert nicht'], correct: 1 },
    { kind: 'quiz', text: 'Feld D: NPN-Sensor, 1M auf L+', options: ['funktioniert', 'funktioniert nicht'], correct: 0 },
    { kind: 'quiz', text: 'Woran erkennst du im Feld eine falsche Kombination?', options: ['Sensor-LED leuchtet, Eingangs-LED bleibt dunkel', 'Beide LEDs sind aus', 'Die Eingangs-LED leuchtet dauernd', 'Das Netzteil meldet Überlast'], correct: 0 },
    { kind: 'quiz', text: 'Wie heisst ein Eingang mit 1M auf M, der den Strom eines PNP-Sensors aufnimmt?', options: ['stromziehend (sink)', 'stromliefernd (source)', 'antivalent', 'potentialfrei'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_ersatz_npn', module: 2, no: 7, level: 'werkstatt', title: 'Falsches Ersatzteil',
  story: 'Nachtschicht. -B2 ist defekt, im Lager liegt nur ein baugleicher Sensor – aber in <b>NPN</b>. Die Anlage ist komplett PNP. ARIA: <i>„Leg doch einfach 1M auf L+. Was soll schon passieren?“</i>',
  brief: '<p>Bewerte die Möglichkeiten, den NPN-Ersatzsensor an der PNP-Anlage zu betreiben. Denk daran: An der CPU 1214C teilen sich alle 14 Eingänge <b>ein</b> Bezugspotential 1M.</p><ul><li>1M der CPU auf L+ legen</li><li>Koppelrelais zwischen Sensor und Eingang</li><li>Signalwandler NPN → PNP (z. B. als M12-Zwischenstecker)</li><li>Richtigen PNP-Sensor bestellen und einbauen</li></ul>',
  learn: 'Ersatzlösungen für einen falschen Sensortyp fachlich bewerten.', take: 'Die saubere Lösung ist der richtige Sensortyp. Ein Wandler oder Koppelrelais kann überbrücken. 1M umklemmen legt alle anderen Sensoren der Gruppe lahm.',
  man: 'pnpnpn', theory: 'st2b', hint: 'Was passiert mit -B1, -B5 und den Tastern, wenn 1M auf L+ liegt?', hint2: 'Ein Koppelrelais hat eine Spule (NPN schaltet sie gegen M) und einen Kontakt, der +24 V auf den Eingang schaltet.',
  parts: ['B2', 'N1'], modules: ['A1'], x2: [5, 6], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'quiz', text: 'ARIAs Vorschlag: 1M der CPU auf L+ legen. Was passiert?', options: ['Der NPN-Sensor geht, aber alle PNP-Sensoren und Taster an der CPU fallen aus', 'Alles funktioniert', 'Nur der NPN-Sensor fällt aus', 'Die CPU schaltet automatisch auf NPN um'], correct: 0 },
    { kind: 'quiz', text: 'Wie viele Digitaleingänge der CPU 1214C hängen an 1M?', answer: 14, tol: 0 },
    { kind: 'quiz', text: 'Koppelrelais: Wie wird es angeschlossen?', options: ['Spule zwischen L+ und NPN-Ausgang, Kontakt schaltet +24 V auf den Eingang', 'Spule zwischen Eingang und M, Kontakt zum Sensor', 'Kontakt zwischen L+ und M', 'Spule direkt an 1M'], correct: 0 },
    { kind: 'quiz', text: 'Welcher Nachteil hat das Koppelrelais?', options: ['Zusätzliches Bauteil mit Verschleiss und Schaltverzögerung – für schnelle Signale ungeeignet', 'Es invertiert das Signal immer', 'Es braucht 230 V', 'Es funktioniert nur mit Öffnern'], correct: 0 },
    { kind: 'quiz', text: 'Welche Lösung ist auf Dauer die beste?', options: ['Den richtigen PNP-Sensor einbauen (Ersatzteil nachbestellen)', 'Signalwandler für immer drin lassen', '1M auf L+ legen', 'Den Sensor ganz weglassen'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_fehler_npn_pnp', module: 2, no: 8, level: 'werkstatt', title: 'Neuer Sensor, Eingang tot', debug: true,
  story: 'Ein Kollege hat -N1 an die SM 1221 angeschlossen und ist in die Pause. Die gelbe LED am Sensor leuchtet schön, wenn ein Teil davor liegt. %I16.0 bleibt trotzdem 0. Auf -X2:25 hängt -B8 – der funktioniert.',
  brief: '<p>Finde heraus, warum %I16.0 nicht kommt, und behebe den Fehler. -B8 (PNP) an %I16.4 muss danach weiter funktionieren.</p>',
  learn: 'Einen NPN-Sensor an einer PNP-Eingangsgruppe erkennen und die Gruppe richtig beschalten.', take: 'Sensor-LED an, Eingang aus, Verdrahtung „stimmt“: Schaltart des Sensors und Beschaltung von 1M vergleichen. Die Gruppen der SM 1221 sind getrennt beschaltbar.',
  man: 'eingang', theory: 'st2b', hint: 'Lies das Typenschild von -N1. Und schau, wo 1M und 2M der SM 1221 liegen.', hint2: 'Nur die Gruppe mit %I16.0 (1M) gehört auf L+. 2M bleibt für -B8 auf M.',
  parts: ['N1', 'B8'], modules: ['A1', 'A4'], x2: [21, 25], start: { base: 'm2_npn_an_pnp', mainSwitch: true },
  symptom: { cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': false } }] },
  steps: [
    { kind: 'wire', text: 'Beschaltung der Gruppe von %I16.0 korrigieren', target: need('N1').concat([{ net: ['A4:1M', 'POT:L+'] }, { net: ['A4:2M', 'POT:M'] }, { net: ['B8:BK', 'DI:I16.4'] }]),
      ref: { remove: [['A4:1M', 'X1:M4']], add: [['A4:1M', 'X1:L+4']] },
      wrong: [{ remove: [['A4:1M', 'X1:M4'], ['A4:2M', 'X1:M5']], add: [['A4:1M', 'X1:L+4'], ['A4:2M', 'X1:L+5']] }, { remove: [], add: [] }] },
    { kind: 'observe', text: 'Teil vor -N1: %I16.0 = 1 · -B8 meldet: %I16.4 = 1', cases: [{ world: { parts: { N1: 'stahl' } }, di: { 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I16.0': false } }, { world: { b8: true }, di: { 'I16.4': true } }] },
    { kind: 'quiz', text: 'Was war die Ursache?', options: ['NPN-Sensor an einer Gruppe mit 1M auf M (stromziehend, für PNP)', 'Sensor defekt', 'BK auf der falschen Klemmenebene', 'BN und BU vertauscht'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w2_fehler_bk_m', module: 2, no: 9, level: 'werkstatt', title: 'Die LED blinkt', debug: true,
  story: 'Nach ARIAs Nachtschicht blinkt die LED an -B1, sobald ein Stahlteil vorbeikommt – und %I0.4 bleibt aus. Der Werkmeister riecht am Sensor: <i>„Riecht nicht verbrannt. Der hat sich selbst geschützt.“</i>',
  brief: '<p>-B1 ist auf -X2:5 aufgelegt, aber etwas stimmt nicht. Finde den Fehler und behebe ihn.</p><p>Tipp: Ein PNP-Ausgang schaltet +24 V. Was passiert, wenn er dabei direkt auf M arbeitet?</p>',
  learn: 'Einen Kurzschluss am Schaltausgang erkennen (Kurzschlussschutz des Sensors).', take: 'Blinkende Sensor-LED und kein Signal: Der Ausgang ist kurzgeschlossen. Gute Sensoren schalten dann ab und blinken – BK gehört auf die Signalebene.',
  man: 'sensoren', theory: 'st2b', hint: 'Welche Ebene an -X2:5 hat zwei Adern?', hint2: 'BK liegt auf der M-Ebene. Umklemmen auf die Signalebene (Mitte).',
  parts: ['B1'], modules: ['A1'], x2: [4, 5, 6], start: { base: 'schrank', wires: [['B1:BN', 'X2:5.L+'], ['B1:BU', 'X2:5.M'], ['B1:BK', 'X2:5.M']], mainSwitch: true, mounts: { B1: { dist: 4, tight: true } } },
  symptom: { cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': false } }] },
  steps: [
    { kind: 'wire', text: 'BK von -B1 richtig auflegen', target: need('B1').concat([{ notNet: ['B1:BK', 'POT:M'] }]), ref: { remove: [['B1:BK', 'X2:5.M']], add: [['B1:BK', 'X2:5.S']] },
      wrong: [{ remove: [], add: [] }, { remove: [['B1:BK', 'X2:5.M']], add: [['B1:BK', 'X2:5.L+']] }] },
    { kind: 'observe', text: 'Stahlteil: %I0.4 = 1, ohne Teil: 0', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Warum blinkte die LED?', options: ['BK lag auf M: Der PNP-Ausgang schaltete +24 V direkt auf M, der Kurzschlussschutz hat abgeschaltet', 'Der Sensor war falsch eingestellt', '1M lag auf L+', 'Die M12-Rändelmutter war lose'], correct: 0 },
    { kind: 'quiz', text: 'Was wäre bei BK auf L+ passiert (Fehler aus Modul 1)?', options: ['Kein Kurzschluss, aber das Signal kommt nie am Eingang an', 'Das Netzteil geht in Überlast', 'Der Eingang ist dauernd 1', 'Die LED blinkt ebenfalls'], correct: 0 }
  ] });

const BOSS_SORT = [].concat(field('B1'), field('B2'), field('B5'));
defWorkshopTask({ id: 'w2_boss_umbau', module: 2, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Gemischter Umbau',
  story: 'Die Sortierstrecke wird umgebaut: Am Auswerfer sitzt künftig ein zusätzlicher induktiver Sensor – geliefert wurde er als <b>NPN</b>. ARIA hat ausserdem alle Sensoradern gezogen. Der Werkmeister: <i>„PNP an die CPU, NPN an die SM 1221. Und keine Gruppe wird gemischt.“</i>',
  brief: '<ol><li><b>PNP an der CPU:</b> -B1 → -X2:5, -B2 → -X2:6, -B5 → -X2:9 (1M der CPU bleibt auf M).</li><li><b>NPN an der SM 1221:</b> -N1 → -X2:21 (%I16.0), 1M der SM 1221 auf <b>L+</b>. 2M bleibt auf M.</li><li>Einschalten, Funktionsprobe.</li><li>Variable <b>Ind_Auswerfer</b> (Bool, %I16.0) anlegen.</li><li>Programm anpassen: Der Auswerfer reagiert nicht mehr auf -B1, sondern auf <b>"Ind_Auswerfer"</b> – und nur, wenn das <b>Band läuft</b>. Volle Rutsche ("Rutsche_Voll") stoppt das Band und schaltet <b>"Lampe_Rot"</b> ein.</li><li>Laden, RUN.</li></ol>',
  learn: 'PNP- und NPN-Sensoren gemischt in einer Anlage anschliessen und das Programm anpassen.', take: 'Pro Eingangsgruppe eine Schaltart: PNP-Gruppe 1M auf M, NPN-Gruppe 1M auf L+. Variablentabelle und Programm folgen dem Klemmenplan.',
  man: 'klemmenplan', theory: 'st2b', hint: 'Zuerst die Verdrahtung, dann die Funktionsprobe – erst dann programmieren.', hint2: '"Auswerfer" := "Ind_Auswerfer" AND "Band"; "Lampe_Rot" := "Rutsche_Voll";',
  parts: ['S1', 'S2', 'B1', 'B2', 'B5', 'N1'], modules: ['A1', 'A4'], x2: [1, 2, 5, 6, 9, 21, 22], start: { base: 'sm1221', wires: [].concat(field('S1'), field('S2')) },
  steps: [
    { kind: 'wire', text: 'Drei PNP-Sensoren an die CPU, -N1 an die SM 1221, 1M der SM 1221 auf L+', target: [].concat(need('B1'), need('B2'), need('B5'), need('N1'), [{ net: ['A1:1M', 'POT:M'] }, { net: ['A4:1M', 'POT:L+'] }, { net: ['A4:2M', 'POT:M'] }]),
      ref: { remove: [['A4:1M', 'X1:M4']], add: [['A4:1M', 'X1:L+4']].concat(BOSS_SORT, w3('N1', 21)) },
      wrong: [{ add: BOSS_SORT.concat(w3('N1', 21)) }, { remove: [['A4:1M', 'X1:M4'], ['A1:1M', 'X1:M2']], add: [['A4:1M', 'X1:L+4'], ['A1:1M', 'X1:L+2']].concat(BOSS_SORT, w3('N1', 21)) }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe: alle vier Sensoren schalten', cases: [{ world: { parts: { B1: 'stahl', B2: 'stahl', B5: 'stahl', N1: 'stahl' } }, di: { 'I0.4': true, 'I0.5': true, 'I1.0': true, 'I16.0': true } }, { world: { parts: { N1: null } }, di: { 'I0.4': false, 'I0.5': false, 'I1.0': false, 'I16.0': false } }] },
    { kind: 'tags', text: 'Variable Ind_Auswerfer anlegen', require: [{ name: 'Ind_Auswerfer', type: 'Bool', addr: '%I16.0' }] },
    { kind: 'program', text: 'Sortierlogik anpassen', langs: ['scl', 'fup'],
      start: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Metall";\n',
        fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll" => "Band";\n\nNETWORK Auswerfer\n"Ind_Metall" => "Auswerfer";' },
      ref: { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Auswerfer" AND "Band";\n"Lampe_Rot" := "Rutsche_Voll";\n',
        fup: 'NETWORK Band\n("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll" => "Band";\n\nNETWORK Auswerfer\n"Ind_Auswerfer" AND "Band" => "Auswerfer";\n\nNETWORK Rutsche voll\n"Rutsche_Voll" => "Lampe_Rot";' },
      timed: [{ steps: [[0, { Start: false, Stopp: true, Rutsche_Voll: false, Ind_Metall: false, Ind_Auswerfer: false }, { Band: false, Auswerfer: false, Lampe_Rot: false }], [0.05, { Start: true }, { Band: true }],
        [0.05, { Start: false, Ind_Metall: true }, { Band: true, Auswerfer: false }], [0.05, { Ind_Metall: false, Ind_Auswerfer: true }, { Auswerfer: true }], [0.05, { Ind_Auswerfer: false }, { Auswerfer: false }],
        [0.05, { Rutsche_Voll: true }, { Band: false, Lampe_Rot: true }], [0.05, { Rutsche_Voll: false, Ind_Auswerfer: true }, { Band: false, Auswerfer: false, Lampe_Rot: false }]] }],
      wrong: [{ scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Auswerfer";\n"Lampe_Rot" := "Rutsche_Voll";' },
        { scl: '"Band" := ("Start" OR "Band") AND "Stopp" AND NOT "Rutsche_Voll";\n"Auswerfer" := "Ind_Metall" AND "Band";\n"Lampe_Rot" := "Rutsche_Voll";' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);
