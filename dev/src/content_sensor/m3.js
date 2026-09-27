/* ===== SENSORWERKSTATT Modul 3: Sensortypen im Einsatz ===== */
(function(root){
const MAT = ['stahl', 'edelstahl', 'aluminium', 'messing', 'kunststoff_w', 'kunststoff_s', 'glas'];
const MAT_NAME = { stahl: 'Stahl', edelstahl: 'Edelstahl', aluminium: 'Aluminium', messing: 'Messing', kunststoff_w: 'Kunststoff weiss', kunststoff_s: 'Kunststoff schwarz', glas: 'Glas' };
const METALL = m => ['stahl', 'edelstahl', 'aluminium', 'messing'].includes(m);

// Sortierstrecke fertig, aber von ARIA verstellt (Boss Modul 3): -B1 zu weit, -B2 zu unempfindlich, -B4 verdreht
defPreset('m3_verstellt', { base: 'sortier_fertig', mounts: { B1: { dist: 4, tight: true }, B2: { dist: 4, tight: true, poti: 0.3 }, 'B4.1': { align: { h: 4, v: 1 } }, 'B4.2': { align: { h: -2, v: 5 } } } });

defWorkshopTask({ id: 'w3_schaltabstand', module: 3, no: 1, level: 'schnell', title: 'Wie weit schaut -B1?',
  story: 'Der Werkmeister legt ein Stahl- und ein Aluminiumteil auf das Band. <i>„Das Typenschild sagt Sn 8 mm. Für welches Material gilt das? Find es heraus – mit der Skala am Halter.“</i>',
  brief: '<p>Ermittle den Schaltabstand von <b>-B1</b> (induktiv, Sn 8 mm):</p><ol><li>-Q0 einschalten.</li><li>Kontermuttern lösen, ein Teil vor den Sensor legen und den Abstand in 0,5-mm-Schritten vergrössern, bis die gelbe LED ausgeht. Der letzte Abstand mit LED an ist der Schaltabstand.</li><li>Für <b>Stahl</b> und <b>Aluminium</b> ins Protokoll eintragen.</li><li>Zum Schluss wieder <b>4 mm</b> einstellen und festziehen.</li></ol>',
  learn: 'Den Schaltabstand eines induktiven Sensors für verschiedene Metalle ermitteln.', take: 'Sn gilt für Stahl (Normmessplatte). Andere Metalle verkürzen den Schaltabstand um den <b>Reduktionsfaktor</b> – bei Aluminium auf etwa 40 %.',
  man: 'indkap', theory: 'st3a', hint: 'Gabelschlüssel wählen, Kontermuttern lösen, dann den Abstand schrittweise ändern.', hint2: 'Aluminium schaltet deutlich früher ab als Stahl – rechne mit weniger als der Hälfte.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: { base: 'sortier_fertig', mounts: { B1: { dist: 6, tight: false } } },
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Schaltabstände ermitteln', ask: [
      { q: 'Schaltabstand Stahl', unit: 'mm', calc: (ctx, SM) => 8 * SM.MATERIALS.stahl.ind, tol: 0.5 },
      { q: 'Schaltabstand Aluminium', unit: 'mm', calc: (ctx, SM) => 8 * SM.MATERIALS.aluminium.ind, tol: 0.5 }] },
    { kind: 'mount', text: '-B1 wieder auf 4 mm einstellen und festziehen', part: 'B1', dist: [4, 0.25] },
    { kind: 'observe', text: 'Bei 4 mm: Stahl → %I0.4 = 1, Aluminium → %I0.4 = 0', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': false } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Für welches Material gilt der Nennschaltabstand Sn?', options: ['Stahl (Normmessplatte)', 'Aluminium', 'Jedes Metall gleich', 'Kunststoff'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w3_einbauabstand', module: 3, no: 2, level: 'schnell', title: 'Sicherer Einbauabstand',
  story: 'Ab morgen laufen auch Aluminiumteile über die Strecke. Der Werkmeister: <i>„Nicht auf Kante einstellen. Ein Sensor, der gerade so schaltet, fällt beim ersten warmen Tag aus.“</i>',
  brief: '<p>-B1: Sn = 8 mm. Reduktionsfaktoren (Richtwerte): Stahl 1,0 · Edelstahl 0,7 · Messing 0,5 · Aluminium 0,4.</p><p>Als Sicherheitsreserve nutzt du höchstens <b>80 %</b> des realen Schaltabstands (die Norm garantiert den <i>gesicherten Schaltabstand</i> Sa ≤ 0,81 · Sn).</p><ol><li>Rechne die Werte in den Arbeitsschritten.</li><li>Stelle -B1 auf den nächsten Skalenwert <b>unter</b> dem Ergebnis für Aluminium ein (Skala in 0,5-mm-Schritten).</li><li>Prüfe mit Aluminium und Stahl.</li></ol>',
  learn: 'Den Einbauabstand aus Sn, Reduktionsfaktor und Sicherheitsreserve berechnen.', take: 'Einbauabstand = Sn × Reduktionsfaktor × Sicherheitsfaktor. Bei mehreren Materialien bestimmt das <b>ungünstigste</b> den Abstand.',
  man: 'indkap', theory: 'st3a', hint: '8 mm × 0,4 = realer Schaltabstand für Aluminium. Davon 80 %.', hint2: '8 × 0,4 × 0,8 = 2,56 mm → auf der Skala 2,5 mm.',
  parts: ['B1'], modules: ['A1'], x2: [5], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'quiz', text: 'Realer Schaltabstand für Aluminium (mm)?', answer: 3.2, tol: 0.05, unit: 'mm' },
    { kind: 'quiz', text: 'Mit 80 % Sicherheit: Einbauabstand für Aluminium (mm)?', answer: 2.56, tol: 0.05, unit: 'mm' },
    { kind: 'quiz', text: 'Mit 80 % Sicherheit: Einbauabstand für Edelstahl (mm)?', answer: 4.48, tol: 0.05, unit: 'mm' },
    { kind: 'quiz', text: 'Auf der Strecke laufen Stahl und Aluminium. Welcher Abstand gilt?', options: ['Der kleinere (Aluminium) – er deckt beide Materialien ab', 'Der grössere (Stahl)', 'Der Mittelwert', 'Sn = 8 mm'], correct: 0 },
    { kind: 'mount', text: '-B1 auf 2,5 mm einstellen und festziehen', part: 'B1', dist: [2.5, 0.01] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Aluminium und Stahl: %I0.4 = 1 · kein Teil: 0', cases: [{ world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] }
  ] });

defWorkshopTask({ id: 'w3_b2_poti', module: 3, no: 3, level: 'werkstatt', title: 'Kunststoff ja, Band nein',
  story: 'ARIA hat am Poti von <b>-B2</b> gedreht. Jetzt meldet der kapazitive Sensor dauernd „Teil da“ – auch bei leerem Band.',
  brief: '<p>Ein kapazitiver Sensor reagiert auf alles, was die Dielektrizitätszahl in seinem Feld ändert – auch auf das Gummiband. Mit dem <b>Poti</b> (Schraubendreher) stellst du die Empfindlichkeit ein.</p><ol><li>-Q0 einschalten, leeres Band: LED an -B2 muss aus sein.</li><li>Empfindlichkeit so einstellen, dass <b>Kunststoff weiss und schwarz</b> erkannt werden, das <b>Band nicht</b>.</li></ol>',
  learn: 'Die Empfindlichkeit eines kapazitiven Sensors mit dem Poti einstellen.', take: 'Kapazitiv erkennt auch Nichtmetalle. Zu empfindlich → Band oder Behälterwand schalten mit. Einstellen: leer → aus, mit Teil → an, dann eine kleine Reserve.',
  man: 'indkap', theory: 'st3a', hint: 'Zu empfindlich: Poti zurückdrehen, bis die LED bei leerem Band ausgeht.', hint2: 'Kunststoff braucht etwa „mittel“ (0,5), das Band schaltet erst ab 0,7. Dazwischen liegt dein Fenster.',
  parts: ['B2'], modules: ['A1'], x2: [6], start: { base: 'sortier_fertig', mounts: { B2: { dist: 4, tight: true, poti: 0.8 } } },
  steps: [
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'mount', text: 'Empfindlichkeit von -B2 einstellen', part: 'B2', poti: [0.5, 0.65], ref: { poti: 0.55 } },
    { kind: 'observe', text: 'Kunststoff weiss/schwarz → %I0.5 = 1 · leeres Band → 0', cases: [{ world: { parts: { B2: 'kunststoff_w' } }, di: { 'I0.5': true } }, { world: { parts: { B2: 'kunststoff_s' } }, di: { 'I0.5': true } }, { world: {}, di: { 'I0.5': false } }] },
    { kind: 'quiz', text: 'Warum erkennt -B2 auch Stahl?', options: ['Metall ändert das elektrische Feld sehr stark – kapazitive Sensoren erkennen fast alles', 'Weil -B2 eigentlich ein induktiver Sensor ist', 'Weil Stahl magnetisch ist', 'Er erkennt Stahl nicht'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w3_b3_teach', module: 3, no: 4, level: 'werkstatt', title: 'Hintergrund ausblenden',
  story: 'Der Lichttaster <b>-B3</b> schaut von oben auf das Band. Seit ARIA ihn verschoben hat, sieht er das Band selbst als „Teil“.',
  brief: '<p>-B3 ist ein Lichttaster mit <b>Hintergrundausblendung</b>: Alles, was weiter weg ist als die eingelernte Distanz, wird ignoriert.</p><ol><li>Kontermuttern lösen, -B3 auf <b>60 mm</b> über dem Band einstellen, festziehen.</li><li>Bei <b>leerem Band</b> die Teach-Taste drücken (Hintergrund = Band).</li><li>-Q0 einschalten und prüfen: Teil (auch schwarz) → %I0.6 = 1, leeres Band → 0.</li><li>Schaltfunktion wählen (Frage).</li></ol>',
  learn: 'Einen Lichttaster mit Hintergrundausblendung per Teach-in einstellen.', take: 'Hintergrundausblendung misst die Entfernung, nicht die Helligkeit. Darum erkennt -B3 auch schwarze Teile sicher, solange der Hintergrund richtig eingelernt ist.',
  man: 'optisch', theory: 'st3a', hint: 'Erst den Abstand einstellen und festziehen, dann teachen. Wer danach verschiebt, muss neu teachen.', hint2: 'Hellschaltend: Ausgang 1, wenn Licht vom Objekt zurückkommt – also wenn ein Teil da ist.',
  parts: ['B3'], modules: ['A1'], x2: [7], start: { base: 'sortier_fertig', mounts: { B3: { dist: 90, tight: false } } },
  steps: [
    { kind: 'mount', text: '-B3 auf 60 mm, festziehen, Hintergrund einlernen', part: 'B3', dist: [60, 5], teach: true },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Kunststoff schwarz und Stahl → %I0.6 = 1 · leeres Band → 0', cases: [{ world: { parts: { B3: 'kunststoff_s' } }, di: { 'I0.6': true } }, { world: { parts: { B3: 'stahl' } }, di: { 'I0.6': true } }, { world: {}, di: { 'I0.6': false } }] },
    { kind: 'quiz', text: '"Taster_Hell" soll 1 sein, wenn ein Teil da ist. Welche Schaltfunktion stellst du ein?', options: ['Hellschaltend (Licht vom Objekt → Ausgang 1)', 'Dunkelschaltend', 'Antivalent', 'Egal, das Programm dreht es um'], correct: 0 },
    { kind: 'quiz', text: 'Warum teacht man bei leerem Band?', options: ['Der Sensor lernt die Distanz zum Hintergrund und blendet alles ab dort aus', 'Damit der Sensor die Farbe des Teils lernt', 'Damit die LED heller wird', 'Weil Teach mit Teil nicht möglich ist'], correct: 0 }
  ] });

const SORT_TAG = [{ name: 'Ist_Metall', type: 'Bool', addr: '%M10.0', comment: 'Merker: Teil ist Metall' }];
defWorkshopTask({ id: 'w3_materialsortierung', module: 3, no: 5, level: 'schnell', title: 'Materialsortierung',
  story: 'Metall in Rutsche A, Kunststoff in Behälter B. ARIA findet: <i>„Einfach auswerfen, sobald -B1 etwas sieht.“</i> Blöd nur, dass -B1 weit vor dem Auswerfer sitzt.',
  brief: '<p>-B1 erkennt Metall am Anfang des Bandes. Der Auswerfer sitzt weiter hinten, dort meldet die Einweg-Lichtschranke <b>"LS_Band"</b> ein Teil.</p><ul><li>Sieht "Ind_Metall" ein Teil, merkst du dir das in <b>"Ist_Metall"</b> (%M10.0).</li><li>Kommt das Teil bei "LS_Band" an und "Ist_Metall" ist gesetzt → <b>"Auswerfer"</b> = 1 (Rutsche A).</li><li>Meldet <b>"Zyl_Vorne"</b> die vordere Endlage, wird "Ist_Metall" gelöscht – der Auswerfer fährt zurück.</li><li>Kunststoffteile laufen ohne Auswerfen durch in Behälter B.</li></ul>',
  learn: 'Eine Sensorinformation speichern und an einer späteren Position auswerten.', take: 'Sensor und Aktor sitzen selten an derselben Stelle. Die Information „Metall“ muss gespeichert und nach dem Auswerfen gelöscht werden.',
  man: 'indkap', theory: 'st3a', hint: 'SCL: IF "Ind_Metall" THEN "Ist_Metall" := TRUE; END_IF; — KOP: S "Ist_Metall".', hint2: '"Auswerfer" := "LS_Band" AND "Ist_Metall"; und danach bei "Zyl_Vorne" den Merker zurücksetzen.',
  parts: ['B1', 'B2', 'B4.1', 'B4.2', 'B7'], modules: ['A1'], x2: [5, 6, 8, 11], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Materialsortierung programmieren', langs: ['scl', 'kop', 'fup'], tagsExtra: SORT_TAG,
      start: { scl: '"Auswerfer" := "Ind_Metall";\n', kop: 'NETWORK Auswerfen\n"Ind_Metall" => "Auswerfer";', fup: 'NETWORK Auswerfen\n"Ind_Metall" => "Auswerfer";' },
      ref: { scl: 'IF "Ind_Metall" THEN\n  "Ist_Metall" := TRUE;\nEND_IF;\n"Auswerfer" := "LS_Band" AND "Ist_Metall";\nIF "Zyl_Vorne" THEN\n  "Ist_Metall" := FALSE;\nEND_IF;\n',
        kop: 'NETWORK Metall merken\n"Ind_Metall" => S "Ist_Metall";\n\nNETWORK Auswerfen\n"LS_Band" AND "Ist_Metall" => "Auswerfer";\n\nNETWORK Merker loeschen\n"Zyl_Vorne" => R "Ist_Metall";',
        fup: 'NETWORK Metall merken\n"Ind_Metall" => S "Ist_Metall";\n\nNETWORK Auswerfen\n"LS_Band" AND "Ist_Metall" => "Auswerfer";\n\nNETWORK Merker loeschen\n"Zyl_Vorne" => R "Ist_Metall";' },
      timed: [{ steps: [[0, { Ind_Metall: false, LS_Band: false, Zyl_Vorne: false }, { Auswerfer: false, Ist_Metall: false }], [0.05, { Ind_Metall: true }, { Auswerfer: false, Ist_Metall: true }], [0.05, { Ind_Metall: false }, { Auswerfer: false, Ist_Metall: true }],
        [0.05, { LS_Band: true }, { Auswerfer: true }], [0.05, { Zyl_Vorne: true }, { Ist_Metall: false }], [0.05, {}, { Auswerfer: false }], [0.05, { LS_Band: false, Zyl_Vorne: false }, { Auswerfer: false }],
        [0.05, { LS_Band: true }, { Auswerfer: false }], [0.05, { LS_Band: false }, { Auswerfer: false, Ist_Metall: false }]] }],
      wrong: [{ scl: '"Auswerfer" := "LS_Band" AND "Ind_Metall";' }, { scl: 'IF "Ind_Metall" THEN\n  "Ist_Metall" := TRUE;\nEND_IF;\n"Auswerfer" := "LS_Band" AND "Ist_Metall";' }] },
    { kind: 'load', text: 'In das Gerät laden und CPU starten' }
  ] });

defWorkshopTask({ id: 'w3_einweg', module: 3, no: 6, level: 'werkstatt', title: 'Einweg-Lichtschranke ausrichten',
  story: 'Jemand hat sich an Sender und Empfänger von <b>-B4</b> abgestützt. Jetzt meldet die Lichtschranke dauernd „unterbrochen“ – und für nächste Woche sind Glasteile angekündigt.',
  brief: '<p>Richte Sender <b>-B4.1</b> und Empfänger <b>-B4.2</b> mit den Rändelschrauben (Schraubendreher) aus, bis die <b>Stabilitäts-LED ruhig</b> leuchtet. Blinkt sie, ist die Funktionsreserve knapp.</p><p>Prüfe danach mit Stahl und Glas und beantworte die Fragen.</p>',
  learn: 'Eine Einweg-Lichtschranke ausrichten und die Funktionsreserve beurteilen.', take: 'Stabilitäts-LED ruhig = genug Funktionsreserve. Die Einweg-Lichtschranke wertet nur aus, ob der Strahl ankommt – das macht sie robust, auch bei Glas.',
  man: 'optisch', theory: 'st3b', hint: 'Zuerst einen der beiden ausrichten, bis die LED blinkt, dann den zweiten nachstellen, bis sie ruhig ist.', hint2: 'Beide Geräte müssen genau aufeinander zeigen (Abweichung höchstens 1 Rastung).',
  parts: ['B4.1', 'B4.2'], modules: ['A1'], x2: [8], start: { base: 'sortier_fertig', mounts: { 'B4.1': { align: { h: 3, v: 0 } }, 'B4.2': { align: { h: -5, v: 2 } } } },
  steps: [
    { kind: 'mount', text: 'Sender -B4.1 ausrichten', part: 'B4.1', align: true, tight: false },
    { kind: 'mount', text: 'Empfänger -B4.2 ausrichten', part: 'B4.2', align: true, tight: false },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Freier Strahl → %I0.7 = 0 · Stahl und Glas → %I0.7 = 1', cases: [{ world: {}, di: { 'I0.7': false } }, { world: { parts: { B4: 'stahl' } }, di: { 'I0.7': true } }, { world: { parts: { B4: 'glas' } }, di: { 'I0.7': true } }] },
    { kind: 'quiz', text: 'Die Stabilitäts-LED blinkt. Was bedeutet das?', options: ['Knappe Funktionsreserve – bei Staub oder Vibration fällt das Signal aus', 'Die Lichtschranke ist defekt', 'Ein Teil liegt im Strahl', 'Alles optimal'], correct: 0 },
    { kind: 'quiz', text: 'Warum ist die Einweg-Lichtschranke bei Glas im Vorteil gegenüber der Reflexions-Lichtschranke?', options: ['Sie wertet nur aus, ob der Strahl beim Empfänger ankommt – Spiegelungen an der Glasoberfläche können keinen Reflektor vortäuschen', 'Sie ist heller', 'Glas ist für Einweg-Licht undurchsichtig', 'Sie braucht keine Ausrichtung'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w3_zylinderschalter', module: 3, no: 7, level: 'werkstatt', title: 'Endlagen setzen',
  story: 'Die Zylinderschalter <b>-B6</b> und <b>-B7</b> am Auswerfer sind locker und in der Nut verrutscht. Der Auswerfer fährt, aber die SPS weiss nicht, wo er ist.',
  brief: '<p>Zylinderschalter reagieren auf den Magneten im Kolben. Die Endlagen liegen bei <b>5 mm</b> (hinten) und <b>35 mm</b> (vorne) auf der Nutskala.</p><ol><li>Mit dem Schraubendreher die Klemmschraube lösen, <b>-B6</b> auf 5 mm schieben, festklemmen.</li><li><b>-B7</b> auf 35 mm, festklemmen.</li><li>Einschalten und prüfen: Zylinder hinten → %I1.1, vorne → %I1.2.</li></ol>',
  learn: 'Magnetische Zylinderschalter auf die Endlagen einstellen.', take: 'Zylinderschalter sitzen in der T-Nut und schalten, wenn der Kolbenmagnet darunter ist. Genau auf die Endlage setzen – und festklemmen, sonst wandern sie.',
  man: 'zylinder', theory: 'st3b', hint: 'Werkzeug: Schraubendreher. Erst lösen, dann schieben, dann festziehen.', hint2: 'Hinten = eingefahren = 5 mm. Vorne = ausgefahren = 35 mm.',
  parts: ['B6', 'B7'], modules: ['A1'], x2: [10, 11], start: { base: 'sortier_fertig', mounts: { B6: { dist: 15, tight: false }, B7: { dist: 22, tight: false } } },
  steps: [
    { kind: 'mount', text: '-B6 auf 5 mm festklemmen', part: 'B6', dist: [5, 1] },
    { kind: 'mount', text: '-B7 auf 35 mm festklemmen', part: 'B7', dist: [35, 1] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Hinten: %I1.1 = 1, %I1.2 = 0 · vorne: %I1.1 = 0, %I1.2 = 1 · unterwegs: beide 0', cases: [{ world: { cyl: 'hinten' }, di: { 'I1.1': true, 'I1.2': false } }, { world: { cyl: 'vorne' }, di: { 'I1.1': false, 'I1.2': true } }, { world: {}, di: { 'I1.1': false, 'I1.2': false } }] },
    { kind: 'quiz', text: 'Worauf reagiert ein Zylinderschalter?', options: ['Auf den Magnetring im Kolben', 'Auf das Metall des Zylinderrohrs', 'Auf den Luftdruck', 'Auf Licht'], correct: 0 }
  ] });

const UEB_TAGS = [{ name: 'Befehl_Auswerfen', type: 'Bool', addr: '%M10.0', comment: 'Auswerfen angefordert (Sortierlogik)' }, { name: 'Quittieren', type: 'Bool', addr: '%M10.1', comment: 'HMI Taste Quittieren' }];
const UEB_KOP = 'NETWORK Auswerfer\n"Befehl_Auswerfen" AND NOT "Lampe_Rot" => "Auswerfer";\n\nNETWORK Ueberwachung vorne\n"Auswerfer" AND NOT "Zyl_Vorne" AND TON(T_Vorne, T#2S) => S "Lampe_Rot";\n\nNETWORK Ueberwachung hinten\nNOT "Auswerfer" AND NOT "Zyl_Hinten" AND TON(T_Hinten, T#2S) => S "Lampe_Rot";\n\nNETWORK Quittieren\n"Quittieren" => R "Lampe_Rot";';
const UEB_START_KOP = 'NETWORK Auswerfer\n"Befehl_Auswerfen" => "Auswerfer";';
defWorkshopTask({ id: 'w3_endlagen_ueberwachung', module: 3, no: 8, level: 'werkstatt', title: 'Endlagen überwachen',
  story: 'Ein Teil hat sich verklemmt, der Auswerfer kam nicht nach vorne – und die Anlage hat einfach weitergemacht. ARIA kichert. Der Werkmeister: <i>„Wofür haben wir Zylinderschalter?“</i>',
  brief: '<p>Programmiere den Auswerfer mit <b>Endlagen-Zeitüberwachung</b>:</p><ul><li><b>"Auswerfer"</b> = <b>"Befehl_Auswerfen"</b> (%M10.0), aber nicht bei Störung.</li><li>Auswerfer ein, aber <b>"Zyl_Vorne"</b> kommt nicht innerhalb von <b>2 s</b> → Störung.</li><li>Auswerfer aus, aber <b>"Zyl_Hinten"</b> kommt nicht innerhalb von <b>2 s</b> → Störung.</li><li>Störung = <b>"Lampe_Rot"</b> bleibt an (gespeichert), bis <b>"Quittieren"</b> (%M10.1) kommt.</li></ul><p>Zeitinstanzen: <b>"T_Vorne"</b> und <b>"T_Hinten"</b> (TON).</p>',
  learn: 'Endlagen eines Zylinders mit Zeitüberwachung auswerten und eine Störung speichern.', take: 'Eine Endlagenüberwachung vergleicht Befehl und Rückmeldung. Kommt die Rückmeldung nicht in der erwarteten Zeit, klemmt etwas, ist defekt oder verstellt.',
  man: 'zylinder', theory: 'st3b', hint: '"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);', hint2: 'Die Störung setzt du mit IF … THEN "Lampe_Rot" := TRUE; und löschst sie nur mit "Quittieren".',
  parts: ['B6', 'B7'], modules: ['A1'], x2: [10, 11], start: 'preset:sortier_fertig',
  steps: [
    { kind: 'program', text: 'Auswerfer mit Endlagenüberwachung', langs: ['scl', 'kop', 'fup'], fb: { T_Vorne: 'TON', T_Hinten: 'TON' }, tagsExtra: UEB_TAGS,
      start: { scl: '"Auswerfer" := "Befehl_Auswerfen";\n', kop: UEB_START_KOP, fup: UEB_START_KOP },
      ref: { scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);\n"T_Hinten"(IN := NOT "Auswerfer" AND NOT "Zyl_Hinten", PT := T#2S);\nIF "T_Vorne".Q OR "T_Hinten".Q THEN\n  "Lampe_Rot" := TRUE;\nEND_IF;\nIF "Quittieren" THEN\n  "Lampe_Rot" := FALSE;\nEND_IF;\n',
        kop: UEB_KOP, fup: UEB_KOP },
      timed: [
        { steps: [[0, { Befehl_Auswerfen: false, Zyl_Hinten: true, Zyl_Vorne: false, Quittieren: false }, { Auswerfer: false, Lampe_Rot: false }], [0.5, { Befehl_Auswerfen: true }, { Auswerfer: true, Lampe_Rot: false }],
          [0.5, { Zyl_Hinten: false }, { Auswerfer: true, Lampe_Rot: false }], [0.5, { Zyl_Vorne: true }, { Lampe_Rot: false }], [0.5, { Befehl_Auswerfen: false }, { Auswerfer: false }], [0.5, { Zyl_Vorne: false }, { Lampe_Rot: false }],
          [0.5, { Zyl_Hinten: true }, { Lampe_Rot: false }],
          [0.5, { Befehl_Auswerfen: true }, { Auswerfer: true, Lampe_Rot: false }], [1.0, {}, { Lampe_Rot: false }], [0.9, {}, { Lampe_Rot: false }], [0.2, {}, { Lampe_Rot: true }],
          [0.05, {}, { Auswerfer: false, Lampe_Rot: true }], [0.05, { Quittieren: true }, { Lampe_Rot: false }], [0.05, { Quittieren: false, Befehl_Auswerfen: false }, { Auswerfer: false, Lampe_Rot: false }]] },
        { steps: [[0, { Befehl_Auswerfen: true, Zyl_Hinten: false, Zyl_Vorne: true, Quittieren: false }, { Auswerfer: true, Lampe_Rot: false }], [0.5, { Befehl_Auswerfen: false }, { Auswerfer: false, Lampe_Rot: false }],
          [1.0, {}, { Lampe_Rot: false }], [1.1, {}, { Lampe_Rot: true }]] }],
      wrong: [{ scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);\n"T_Hinten"(IN := NOT "Auswerfer" AND NOT "Zyl_Hinten", PT := T#2S);\n"Lampe_Rot" := "T_Vorne".Q OR "T_Hinten".Q;' },
        { scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#2S);\nIF "T_Vorne".Q THEN\n  "Lampe_Rot" := TRUE;\nEND_IF;\nIF "Quittieren" THEN\n  "Lampe_Rot" := FALSE;\nEND_IF;' },
        { scl: '"Auswerfer" := "Befehl_Auswerfen" AND NOT "Lampe_Rot";\n"T_Vorne"(IN := "Auswerfer" AND NOT "Zyl_Vorne", PT := T#5S);\n"T_Hinten"(IN := NOT "Auswerfer" AND NOT "Zyl_Hinten", PT := T#5S);\nIF "T_Vorne".Q OR "T_Hinten".Q THEN\n  "Lampe_Rot" := TRUE;\nEND_IF;\nIF "Quittieren" THEN\n  "Lampe_Rot" := FALSE;\nEND_IF;' }] },
    { kind: 'load', text: 'Laden und starten' }
  ] });

defWorkshopTask({ id: 'w3_fehler_alu', module: 3, no: 9, level: 'werkstatt', title: 'Alu wird nicht erkannt', debug: true,
  story: 'Die Qualitätskontrolle meldet: Aluminiumteile landen im Kunststoffbehälter. Stahl wird sauber aussortiert. ARIA: <i>„Metall ist Metall, oder?“</i>',
  brief: '<p>Finde heraus, warum -B1 Aluminium nicht erkennt, Stahl aber schon – und behebe es. Sicherer Einbauabstand für Aluminium: siehe Aufgabe 2.</p>',
  learn: 'Einen Montagefehler am induktiven Sensor über den Reduktionsfaktor erkennen.', take: 'Stahl ja, Aluminium nein: Der Abstand liegt zwischen den beiden Schaltabständen. Lose Kontermuttern lassen den Sensor wandern – immer festziehen.',
  man: 'indkap', theory: 'st3b', hint: 'Schau dir -B1 am Halter an: Abstand und Kontermuttern.', hint2: 'Aluminium: 8 mm × 0,4 = 3,2 mm, mit Reserve 2,5 mm. Und die Muttern festziehen!',
  parts: ['B1'], modules: ['A1'], x2: [5], start: { base: 'sortier_fertig', mainSwitch: true, mounts: { B1: { dist: 6, tight: false } } },
  symptom: { cases: [{ world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': false } }, { world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }] },
  steps: [
    { kind: 'mount', text: '-B1 auf sicheren Abstand für Aluminium einstellen und festziehen', part: 'B1', dist: [2.5, 0.5] },
    { kind: 'observe', text: 'Aluminium, Messing und Stahl → %I0.4 = 1 · kein Teil → 0', cases: [{ world: { parts: { B1: 'aluminium' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'messing' } }, di: { 'I0.4': true } }, { world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true } }, { world: {}, di: { 'I0.4': false } }] },
    { kind: 'quiz', text: 'Was war die Ursache?', options: ['Abstand 6 mm: grösser als der Schaltabstand für Aluminium (3,2 mm), aber kleiner als für Stahl (8 mm) – dazu lose Kontermuttern', 'Der Sensor war defekt', '1M lag auf L+', 'Aluminium ist nicht leitfähig'], correct: 0 }
  ] });

// Logiktabelle: Ind (B1), Kap (B2), LS (B4) je Werkstück nach der Einstellung
const SIG = m => ({ 'I0.4': METALL(m), 'I0.5': m !== 'glas', 'I0.7': true });
const ART_REF_KOP = 'NETWORK Kein Teil\n=> MOVE(0, "Teil_Art");\n\nNETWORK Glas\n"LS_Band" => MOVE(3, "Teil_Art");\n\nNETWORK Kunststoff\n"Kap_Teil" => MOVE(2, "Teil_Art");\n\nNETWORK Metall\n"Ind_Metall" => MOVE(1, "Teil_Art");\n\nNETWORK Auswerfer\n"Ind_Metall" => "Auswerfer";\n\nNETWORK Glas melden\n"LS_Band" AND NOT "Kap_Teil" AND NOT "Ind_Metall" => "Lampe_Rot";';
const ART_START_KOP = 'NETWORK Auswerfer\n"Ind_Metall" => "Auswerfer";';
const tc = (ind, kap, ls, art) => [0.05, { Ind_Metall: ind, Kap_Teil: kap, LS_Band: ls }, { Teil_Art: art, Auswerfer: art === 1, Lampe_Rot: art === 3 }];
defWorkshopTask({ id: 'w3_boss_sieben', module: 3, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Sieben Werkstoffe',
  story: 'Grossauftrag: Stahl, Edelstahl, Aluminium, Messing, Kunststoff weiss und schwarz – und Glas. ARIA hat vorher noch schnell alle Sensoren verstellt. Der Werkmeister: <i>„Jedes Teil an seinen Platz. Glas gehört gar nicht auf diese Strecke – das will ich gemeldet haben.“</i>',
  brief: '<p>Am Prüfplatz schauen drei Sensoren auf dasselbe Teil: <b>-B1</b> induktiv ("Ind_Metall"), <b>-B2</b> kapazitiv ("Kap_Teil"), <b>-B4</b> Einweg-Lichtschranke ("LS_Band").</p><ol><li><b>-B1</b> so einstellen, dass <b>alle vier Metalle</b> sicher erkannt werden (Einbauabstand für das ungünstigste Metall).</li><li><b>-B2</b>: Kunststoff ja, Band nein.</li><li><b>-B4.1/-B4.2</b> ausrichten.</li><li>Funktionsprobe mit allen sieben Werkstoffen, dann die Logiktabelle in den Arbeitsschritten ausfüllen.</li><li>Programm: <b>"Teil_Art"</b> (Int, %MW20, HMI): 0 = kein Teil, 1 = Metall, 2 = Kunststoff, 3 = Glas. Metall → <b>"Auswerfer"</b> (Rutsche A), Kunststoff läuft in Behälter B, Glas → <b>"Lampe_Rot"</b>.</li><li>Laden, RUN.</li></ol>',
  learn: 'Sensoren nach Werkstoff auswählen und einstellen, eine Logiktabelle aufstellen und programmieren.', take: 'Kein Sensor kann alles. Erst die Kombination (induktiv, kapazitiv, optisch) unterscheidet die Werkstoffe – die Logiktabelle ist der Bauplan für das Programm.',
  man: 'indkap', theory: 'st3b', hint: 'Das ungünstigste Metall ist Aluminium (Faktor 0,4). Die Tabelle: Wer schaltet bei Glas?', hint2: 'Prioritäten im Programm: Metall vor Kunststoff vor Glas. Ein Metallteil schaltet auch den kapazitiven Sensor und die Lichtschranke.',
  parts: ['B1', 'B2', 'B4.1', 'B4.2'], modules: ['A1'], x2: [5, 6, 8], start: 'preset:m3_verstellt',
  steps: [
    { kind: 'mount', text: '-B1: sicherer Abstand für alle Metalle', part: 'B1', dist: [2.5, 0.5] },
    { kind: 'mount', text: '-B2: Kunststoff ja, Band nein', part: 'B2', poti: [0.5, 0.65], ref: { poti: 0.55 } },
    { kind: 'mount', text: '-B4.1 ausrichten', part: 'B4.1', align: true, tight: false },
    { kind: 'mount', text: '-B4.2 ausrichten', part: 'B4.2', align: true, tight: false },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe: sieben Werkstoffe und leeres Band', cases: MAT.map(m => ({ text: MAT_NAME[m], world: { parts: { B1: m, B2: m, B4: m } }, di: SIG(m) })).concat([{ text: 'Leeres Band', world: {}, di: { 'I0.4': false, 'I0.5': false, 'I0.7': false } }]) },
    { kind: 'quiz', text: 'Logiktabelle: Welche Sensoren schalten bei Aluminium? (Ind / Kap / LS)', options: ['1 / 1 / 1', '1 / 0 / 1', '0 / 1 / 1', '0 / 0 / 1'], correct: 0 },
    { kind: 'quiz', text: 'Logiktabelle: … bei Kunststoff schwarz?', options: ['0 / 1 / 1', '1 / 1 / 1', '0 / 0 / 1', '0 / 0 / 0'], correct: 0 },
    { kind: 'quiz', text: 'Logiktabelle: … bei Glas?', options: ['0 / 0 / 1', '0 / 1 / 1', '0 / 0 / 0', '1 / 0 / 1'], correct: 0 },
    { kind: 'quiz', text: 'Kann die Strecke mit diesen drei Sensoren Stahl von Aluminium unterscheiden?', options: ['Nein – beide schalten alle drei Sensoren', 'Ja, über den kapazitiven Sensor', 'Ja, über die Lichtschranke', 'Ja, Aluminium schaltet -B1 nicht'], correct: 0 },
    { kind: 'program', text: 'Werkstoff erkennen und sortieren', langs: ['scl', 'kop', 'fup'], tagsExtra: [{ name: 'Teil_Art', type: 'Int', addr: '%MW20', comment: 'HMI: 0 kein Teil, 1 Metall, 2 Kunststoff, 3 Glas' }],
      start: { scl: '"Auswerfer" := "Ind_Metall";\n', kop: ART_START_KOP, fup: ART_START_KOP },
      ref: { scl: 'IF "Ind_Metall" THEN\n  "Teil_Art" := 1;\nELSIF "Kap_Teil" THEN\n  "Teil_Art" := 2;\nELSIF "LS_Band" THEN\n  "Teil_Art" := 3;\nELSE\n  "Teil_Art" := 0;\nEND_IF;\n"Auswerfer" := "Teil_Art" = 1;\n"Lampe_Rot" := "Teil_Art" = 3;\n',
        kop: ART_REF_KOP, fup: ART_REF_KOP },
      timed: [{ steps: [tc(false, false, false, 0), tc(true, true, true, 1), tc(false, false, false, 0), tc(false, true, true, 2), tc(false, false, true, 3), tc(false, false, false, 0)] }],
      wrong: [{ scl: 'IF "LS_Band" THEN\n  "Teil_Art" := 3;\nELSIF "Kap_Teil" THEN\n  "Teil_Art" := 2;\nELSIF "Ind_Metall" THEN\n  "Teil_Art" := 1;\nELSE\n  "Teil_Art" := 0;\nEND_IF;\n"Auswerfer" := "Teil_Art" = 1;\n"Lampe_Rot" := "Teil_Art" = 3;' },
        { scl: 'IF "Ind_Metall" THEN\n  "Teil_Art" := 1;\nELSIF "Kap_Teil" THEN\n  "Teil_Art" := 2;\nELSIF "LS_Band" THEN\n  "Teil_Art" := 3;\nEND_IF;\n"Auswerfer" := "Teil_Art" = 1;\n"Lampe_Rot" := "Teil_Art" = 3;' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);
