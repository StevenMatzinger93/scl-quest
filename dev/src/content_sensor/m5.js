/* ===== SENSORWERKSTATT Modul 5: NORM_X und SCALE_X ===== */
(function(root){
const A = root.SW_ANALOG, { tg, bool, sclS, kopS, nets, both } = A;
root.SW_CHAPTER({ n:5, title:'NORM_X und SCALE_X', subtitle:'Rohwert → Messwert · Geradengleichung', icon:'fa-ruler-combined',
  intro:'Die Tankstation liefert Rohwerte – aber niemand will „13824“ auf dem HMI lesen. ARIA hat die Skalierung „optimiert“: Jetzt zeigt der leere Tank 20 % und das Wasser kocht bei 118 °C. Zeit für die Geradengleichung.',
  anim: root.SW_CHAPTER_ANIM('0…27648 → 0.0…1.0 → 0…100 mbar') });
const P = v => [v, 0.05];
const LOAD = { kind: 'load', text: 'In das Gerät laden und CPU starten' };

defWorkshopTask({ id: 'w5_von_hand', module: 5, no: 1, level: 'schnell', title: 'Skalieren von Hand',
  story: 'Der Werkmeister dreht am Sollwertsteller <b>-R1</b> und zeigt auf die Beobachtungstabelle: „Sollwert_Roh = 13824“. <i>„Wie viel Prozent sind das? Ohne Taschenrechner-App, bitte mit Kopf.“</i>',
  brief: '<p>-R1 liefert 0–10 V ≙ 0–100 % an CPU-AI1 (%IW66, "Sollwert_Roh"). Skalieren ist eine <b>Geradengleichung</b> durch zwei Punkte: (0 | 0 %) und (27648 | 100 %).</p><p>Rechenweg in zwei Schritten: <b>normieren</b> auf 0…1 (Rohwert / 27648), dann <b>skalieren</b> auf den Messbereich (× 100 %).</p>',
  learn: 'Einen Rohwert von Hand normieren und in den Messbereich skalieren.', take: 'Wert = MIN + (Roh − Roh_min) / (Roh_max − Roh_min) × (MAX − MIN). NORM_X macht den ersten, SCALE_X den zweiten Teil.',
  man: 'normx', theory: 'st5a', hint: '13824 ist genau die Hälfte von 27648.', hint2: '20000 / 27648 = 0,7234 → × 100 %.',
  parts: ['R1'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'quiz', text: 'Rohwert 13824: normierter Wert (0…1)?', answer: 0.5, tol: 0.001 },
    { kind: 'quiz', text: 'Rohwert 13824: Sollwert in %?', answer: 50, tol: 0.05, unit: '%' },
    { kind: 'quiz', text: 'Rohwert 20000: Sollwert in %?', answer: 72.34, tol: 0.05, unit: '%' },
    { kind: 'quiz', text: 'Rohwert 6912: Spannung am Eingang in V?', answer: 2.5, tol: 0.01, unit: 'V' },
    { kind: 'quiz', text: 'Warum rechnet man das Ergebnis in REAL statt in INT?', options: ['Sonst gehen Nachkommastellen verloren (72,34 % würde 72 %)', 'INT kann keine 100 speichern', 'NORM_X funktioniert nur mit REAL-Eingang', 'REAL ist schneller'], correct: 0 }
  ] });

const DRUCK_REF = sclS('Druck_Roh', '0.0', '100.0', 'Druck_mbar');
defWorkshopTask({ id: 'w5_druck', module: 5, no: 2, level: 'schnell', title: 'Druck in mbar',
  story: 'Am HMI steht beim Druck nur „0.0 mbar“. ARIA: <i>„Rohwerte sind ehrlicher.“</i> Der Bediener sieht das anders.',
  brief: '<p>Skaliere <b>"Druck_Roh"</b> (%IW96, -B11, 0–100 mbar) mit <b>NORM_X</b> und <b>SCALE_X</b> auf <b>"Druck_mbar"</b> (Real, %MD24, HMI).</p><ul><li>NORM_X: MIN 0, VALUE "Druck_Roh", MAX 27648 → 0.0…1.0</li><li>SCALE_X: MIN 0.0, VALUE (Ergebnis), MAX 100.0 → mbar</li><li>FUP: Zwischenwert in <b>"Hilf_Norm"</b> (%MD36).</li></ul><p>Laden und am HMI prüfen.</p>',
  learn: 'Einen Analogwert mit NORM_X und SCALE_X in die physikalische Einheit umrechnen.', take: 'NORM_X(Rohbereich) → 0…1 → SCALE_X(Messbereich). Die Grenzen stammen aus dem Datenblatt des Transmitters (0–100 mbar) und dem Nennbereich (0–27648).',
  man: 'normx', theory: 'st5a', hint: 'SCL: SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648), MAX := 100.0)', hint2: 'FUP: zwei Netzwerke – NORM_X nach "Hilf_Norm", dann SCALE_X von "Hilf_Norm" nach "Druck_mbar".',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Druck skalieren', langs: ['scl', 'fup'], tagsExtra: tg('Druck_mbar', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Druck_mbar" := 0.0;\n' }, both('NETWORK Druck\n=> MOVE(0.0, "Druck_mbar");')),
      ref: Object.assign({ scl: DRUCK_REF + '\n' }, both(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'))),
      tests: [{ phys: { B11: 0 }, expect: { Druck_mbar: P(0) } }, { phys: { B11: 25 }, expect: { Druck_mbar: P(25) } }, { phys: { B11: 50 }, expect: { Druck_mbar: P(50) } }, { phys: { B11: 100 }, expect: { Druck_mbar: P(100) } }],
      wrong: [{ scl: '"Druck_mbar" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 32767), MAX := 100.0);' }, { scl: '"Druck_mbar" := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648);' }] },
    LOAD
  ] });

defWorkshopTask({ id: 'w5_pegel', module: 5, no: 3, level: 'werkstatt', title: 'Pegel aus Druck',
  story: 'Der Drucktransmitter sitzt am Tankboden. Der Werkmeister: <i>„Der misst eigentlich den Füllstand. Wasser drückt – je höher, desto mehr.“</i>',
  brief: '<p>Hydrostatik: <b>p = ρ · g · h</b>, also <b>h = p / (ρ · g)</b> mit ρ = 1000 kg/m³, g = 9,81 m/s².</p><p>Einheiten: 1 mbar = 100 Pa, 1 m = 1000 mm. Berechne aus <b>"Druck_mbar"</b> den Pegel <b>"Pegel_mm"</b> (Real, %MD44). Die Druckskalierung aus Aufgabe 2 ist vorgegeben.</p>',
  learn: 'Aus dem hydrostatischen Druck den Pegel berechnen und Einheiten umrechnen.', take: '1 mm Wassersäule ≈ 0,0981 mbar. Wer Pa und mbar verwechselt, liegt um den Faktor 100 daneben.',
  man: 'normx', theory: 'st5a', hint: 'h [m] = p [Pa] / (1000 · 9,81). p [Pa] = p [mbar] · 100.', hint2: 'SCL: "Pegel_mm" := "Druck_mbar" * 100.0 / (1000.0 * 9.81) * 1000.0; — FUP: DIV("Druck_mbar", 0.0981, "Pegel_mm")',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Pegel aus Druck berechnen', langs: ['scl', 'fup'], tagsExtra: tg('Druck_mbar', 'Hilf_Norm', 'Pegel_mm'),
      start: Object.assign({ scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar";\n' }, both(nets(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), 'NETWORK Pegel\n=> MOVE("Druck_mbar", "Pegel_mm");'))),
      ref: Object.assign({ scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar" * 100.0 / (1000.0 * 9.81) * 1000.0;\n' }, both(nets(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), 'NETWORK Pegel\n=> DIV("Druck_mbar", 0.0981, "Pegel_mm");'))),
      tests: [{ phys: { B11: 0 }, expect: { Pegel_mm: [0, 0.5] } }, { phys: { B11: 29.43 }, expect: { Pegel_mm: [300, 0.5] } }, { phys: { B11: 58.86 }, expect: { Pegel_mm: [600, 0.5] } }],
      wrong: [{ scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar" / (1000.0 * 9.81) * 1000.0;' }, { scl: DRUCK_REF + '\n"Pegel_mm" := "Druck_mbar" * 9.81;' }] },
    LOAD
  ] });

defWorkshopTask({ id: 'w5_temp', module: 5, no: 4, level: 'schnell', title: 'Temperatur in °C',
  story: 'Der Kopftransmitter von -B12 liefert 4–20 mA für 0–100 °C. Das HMI zeigt „Temp_C = 0.0“. Der Werkmeister hält die Hand ans Wasser: <i>„Kalt ist anders.“</i>',
  brief: '<p>Skaliere <b>"Temp_Roh"</b> (%IW98) auf <b>"Temp_C"</b> (Real, %MD28): 0–27648 → 0,0–100,0 °C. FUP: Zwischenwert in "Hilf_Norm".</p>',
  learn: 'Die Skalierung auf einen zweiten Messwert übertragen.', take: 'Dasselbe Muster für jede Messstelle: NORM_X mit dem Nennbereich, SCALE_X mit dem Messbereich des Transmitters.',
  man: 'normx', theory: 'st5a', hint: 'Wie beim Druck – nur Rohwert und Ziel ändern sich.', hint2: 'Messbereich laut Typenschild -B12: 0–100 °C.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Temperatur skalieren', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Temp_C" := 0.0;\n' }, both('NETWORK Temperatur\n=> MOVE(0.0, "Temp_C");')),
      ref: Object.assign({ scl: sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\n' }, both(kopS('Temp_Roh', '0.0', '100.0', 'Temp_C'))),
      tests: [{ phys: { B12: 0 }, expect: { Temp_C: P(0) } }, { phys: { B12: 20 }, expect: { Temp_C: P(20) } }, { phys: { B12: 60.5 }, expect: { Temp_C: P(60.5) } }, { phys: { B12: 100 }, expect: { Temp_C: P(100) } }],
      wrong: [{ scl: sclS('Druck_Roh', '0.0', '100.0', 'Temp_C') }, { scl: sclS('Temp_Roh', '4.0', '20.0', 'Temp_C') }] },
    LOAD
  ] });

const US_REF = sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := 800.0 - "Abstand_mm";\n';
const US_KOP = nets(kopS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), 'NETWORK Fuellstand\n=> SUB(800.0, "Abstand_mm", "Fuellstand_mm");');
defWorkshopTask({ id: 'w5_ultraschall', module: 5, no: 5, level: 'werkstatt', title: 'Füllstand per Ultraschall',
  story: '-B10 misst von oben den Abstand zur Wasseroberfläche. Das HMI will aber den <b>Füllstand</b>. ARIA: <i>„Einfach Abstand anzeigen. Weniger ist mehr, oder?“</i>',
  brief: '<ol><li><b>"Abstand_Roh"</b> (%IW64, 0–10 V) auf <b>"Abstand_mm"</b> (%MD40) skalieren: Messbereich <b>60–800 mm</b> (nicht 0!).</li><li><b>"Fuellstand_mm"</b> (%MD20) = Einbauhöhe <b>800 mm</b> − Abstand.</li></ol><p>Unter 60 mm (Blindzone) kann -B10 nicht messen – der Tank darf also nie ganz voll werden.</p>',
  learn: 'Einen Messbereich mit Anfangswert ≠ 0 skalieren und aus dem Abstand den Füllstand berechnen.', take: 'SCALE_X braucht den echten Messbereich: 0 V ≙ 60 mm, nicht 0 mm. Füllstand = Einbauhöhe − Abstand.',
  man: 'normx', theory: 'st5a', hint: 'SCALE_X(MIN := 60.0, …, MAX := 800.0)', hint2: 'FUP: SUB(800.0, "Abstand_mm", "Fuellstand_mm").',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Abstand und Füllstand berechnen', langs: ['scl', 'fup'], tagsExtra: tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Fuellstand_mm" := 0.0;\n' }, both('NETWORK Fuellstand\n=> MOVE(0.0, "Fuellstand_mm");')),
      ref: Object.assign({ scl: US_REF }, both(US_KOP)),
      tests: [{ phys: { B10: 800 }, expect: { Fuellstand_mm: [0, 0.2] } }, { phys: { B10: 430 }, expect: { Abstand_mm: [430, 0.2], Fuellstand_mm: [370, 0.2] } }, { phys: { B10: 200 }, expect: { Fuellstand_mm: [600, 0.2] } }, { phys: { B10: 30 }, expect: { Abstand_mm: [60, 0.2], Fuellstand_mm: [740, 0.2] } }],
      wrong: [{ scl: sclS('Abstand_Roh', '0.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := 800.0 - "Abstand_mm";' }, { scl: sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := "Abstand_mm";' }] },
    LOAD
  ] });

const AQ_SCL = v => '"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := NORM_X(MIN := 0.0, VALUE := "Pumpe_Prozent", MAX := 100.0), MAX := ' + v + ');\n';
const AQ_KOP = 'NETWORK Normieren\n=> NORM_X(0.0, "Pumpe_Prozent", 100.0, "Hilf_Norm");\n\nNETWORK Ausgabe an SM 1232\n=> SCALE_X(0, "Hilf_Norm", 27648, "Pumpe_Soll_Roh");';
defWorkshopTask({ id: 'w5_pumpe_aq', module: 5, no: 6, level: 'schnell', title: 'Pumpendrehzahl ausgeben',
  story: 'Der Umrichter -T2 der Pumpe erwartet 0–10 V als Drehzahlsollwert. Diesmal läuft die Skalierung rückwärts – vom Prozentwert zum Rohwert.',
  brief: '<p>Das HMI gibt <b>"Pumpe_Prozent"</b> (Real, %MD48, 0–100 %) vor. Gib den Sollwert über die SM 1232 Kanal 0 (0–10 V) aus: <b>"Pumpe_Soll_Roh"</b> (Int, %QW112).</p><ul><li>NORM_X: 0.0…100.0 % → 0…1</li><li>SCALE_X: 0…27648 in eine <b>Int</b>-Variable (wird gerundet)</li></ul><p>Laden und am Ausgang die Spannung bei 50 % messen.</p>',
  learn: 'Einen Prozentwert mit NORM_X und SCALE_X in einen Analogausgabewert umrechnen.', take: 'Analogausgabe = Skalierung rückwärts: physikalischer Wert → 0…1 → 0…27648. Das Ziel ist ein Int, SCALE_X rundet.',
  man: 'aq', theory: 'st5b', hint: 'Jetzt ist der Prozentwert der VALUE von NORM_X.', hint2: 'SCALE_X(MIN := 0, VALUE := …, MAX := 27648) in "Pumpe_Soll_Roh".',
  parts: [], modules: ['A1', 'A3'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Drehzahlsollwert ausgeben', langs: ['scl', 'fup'], tagsExtra: tg('Pumpe_Prozent', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Pumpe_Soll_Roh" := 0;\n' }, both('NETWORK Ausgabe\n=> MOVE(0, "Pumpe_Soll_Roh");')),
      ref: Object.assign({ scl: AQ_SCL(27648) }, both(AQ_KOP)),
      tests: [{ in: { Pumpe_Prozent: 0.0 }, expect: { Pumpe_Soll_Roh: 0 } }, { in: { Pumpe_Prozent: 50.0 }, expect: { Pumpe_Soll_Roh: 13824 } }, { in: { Pumpe_Prozent: 100.0 }, expect: { Pumpe_Soll_Roh: 27648 } }, { in: { Pumpe_Prozent: 33.3 }, expect: { Pumpe_Soll_Roh: 9207 } }],
      wrong: [{ scl: AQ_SCL(32767) }, { scl: '"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := "Pumpe_Prozent", MAX := 27648);' }] },
    LOAD,
    { kind: 'measure', text: 'Spannung am Ausgang SM 1232 Kanal 0', ask: [{ q: 'Pumpe_Prozent = 50 %: Spannung an AQ 0', unit: 'V', calc: (ctx, SM) => SM.aqSignal(13824, ctx.hw.aq.CH0), tol: 0.05 }] }
  ] });

const V_SCL = '"Ventil_Soll_Roh" := SCALE_X(MIN := 0, VALUE := NORM_X(MIN := 0.0, VALUE := "Ventil_Begrenzt", MAX := 100.0), MAX := 27648);\n';
const V_KOP = nets('NETWORK Uebernehmen\n=> MOVE("Ventil_Prozent", "Ventil_Begrenzt");', 'NETWORK Untergrenze\n["Ventil_Prozent" < 0.0] => MOVE(0.0, "Ventil_Begrenzt");', 'NETWORK Obergrenze\n["Ventil_Prozent" > 100.0] => MOVE(100.0, "Ventil_Begrenzt");',
  'NETWORK Normieren\n=> NORM_X(0.0, "Ventil_Begrenzt", 100.0, "Hilf_Norm");', 'NETWORK Ausgabe an SM 1232\n=> SCALE_X(0, "Hilf_Norm", 27648, "Ventil_Soll_Roh");');
const V_KOP0 = nets('NETWORK Uebernehmen\n=> MOVE("Ventil_Prozent", "Ventil_Begrenzt");', 'NETWORK Normieren\n=> NORM_X(0.0, "Ventil_Begrenzt", 100.0, "Hilf_Norm");', 'NETWORK Ausgabe an SM 1232\n=> SCALE_X(0, "Hilf_Norm", 27648, "Ventil_Soll_Roh");');
defWorkshopTask({ id: 'w5_ventil', module: 5, no: 7, level: 'werkstatt', title: 'Stellventil mit LIMIT',
  story: 'Am HMI hat jemand „120 %“ für das Stellventil -MB5 eingetippt. ARIA jubelt: <i>„Mehr als ganz offen!“</i> Der Ausgang der SM 1232 fährt in die Übersteuerung.',
  brief: '<p>Das HMI gibt <b>"Ventil_Prozent"</b> (%MD52) vor. Begrenze den Wert auf <b>0…100 %</b> in <b>"Ventil_Begrenzt"</b> (%MD56) und gib ihn über SM 1232 Kanal 1 (<b>4–20 mA</b>) als <b>"Ventil_Soll_Roh"</b> (%QW114) aus.</p><ul><li>SCL: <code>LIMIT(MN := 0.0, IN := …, MX := 100.0)</code></li><li>FUP: mit Vergleichern und MOVE begrenzen</li></ul>',
  learn: 'Einen Sollwert begrenzen und als 4–20-mA-Signal ausgeben.', take: 'Sollwerte vom Bediener immer begrenzen. Auch bei 4–20 mA ist der Rohwert 0…27648 – die Baugruppe macht daraus 4…20 mA.',
  man: 'aq', theory: 'st5b', hint: 'LIMIT(MN, IN, MX) liefert MN, wenn IN kleiner ist, und MX, wenn IN grösser ist.', hint2: 'Ausgabe wie bei der Pumpe, aber mit "Ventil_Begrenzt" als VALUE.',
  parts: [], modules: ['A1', 'A3'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Ventilsollwert begrenzen und ausgeben', langs: ['scl', 'fup'], tagsExtra: tg('Ventil_Prozent', 'Ventil_Begrenzt', 'Hilf_Norm'),
      start: Object.assign({ scl: '"Ventil_Begrenzt" := "Ventil_Prozent";\n' + V_SCL }, both(V_KOP0)),
      ref: Object.assign({ scl: '"Ventil_Begrenzt" := LIMIT(MN := 0.0, IN := "Ventil_Prozent", MX := 100.0);\n' + V_SCL }, both(V_KOP)),
      tests: [{ in: { Ventil_Prozent: 50.0 }, expect: { Ventil_Soll_Roh: 13824 } }, { in: { Ventil_Prozent: 120.0 }, expect: { Ventil_Soll_Roh: 27648, Ventil_Begrenzt: P(100) } }, { in: { Ventil_Prozent: -10.0 }, expect: { Ventil_Soll_Roh: 0 } }, { in: { Ventil_Prozent: 25.0 }, expect: { Ventil_Soll_Roh: 6912 } }],
      wrong: [{ scl: '"Ventil_Begrenzt" := LIMIT(MN := 0.0, IN := "Ventil_Prozent", MX := 120.0);\n' + V_SCL }, { scl: '"Ventil_Begrenzt" := LIMIT(MN := 4.0, IN := "Ventil_Prozent", MX := 20.0);\n' + V_SCL }] },
    LOAD,
    { kind: 'measure', text: 'Strom am Ausgang SM 1232 Kanal 1', ask: [{ q: 'Ventil_Prozent = 50 %: Strom an AQ 1', unit: 'mA', calc: (ctx, SM) => SM.aqSignal(13824, ctx.hw.aq.CH1), tol: 0.05 }, { q: 'Ventil_Prozent = 120 %: Strom an AQ 1', unit: 'mA', calc: (ctx, SM) => SM.aqSignal(27648, ctx.hw.aq.CH1), tol: 0.05 }] }
  ] });

defWorkshopTask({ id: 'w5_fehler_0_20', module: 5, no: 8, level: 'werkstatt', title: '20 % im leeren Tank', debug: true,
  story: 'Der Tank ist leer – ganz sicher, du siehst den Boden. Das HMI zeigt trotzdem <b>20 mbar</b>. ARIA pfeift unschuldig. Das Programm ist dasselbe wie gestern.',
  brief: '<p>Finde heraus, warum der leere Tank 20 % des Messbereichs anzeigt, und behebe den Fehler. Tipp: Das Programm ist in Ordnung – schau dir die Gerätekonfiguration von SM 1231 Kanal 0 an.</p>',
  learn: 'Einen Konfigurationsfehler (0–20 mA statt 4–20 mA) am Rohwert erkennen.', take: 'Ist der Kanal auf 0–20 mA konfiguriert, ergeben die 4 mA des leeren Tanks den Rohwert 5530 = 20 %. Messbereich des Transmitters und Konfiguration müssen zusammenpassen.',
  man: 'rohwerte', theory: 'st5b', hint: 'Welcher Rohwert steht bei leerem Tank in "Druck_Roh"?', hint2: '4 mA / 20 mA = 0,2 → 0,2 × 27648 = 5530.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig', hw: { 'ai.CH0.type': 'I_4W', 'ai.CH0.range': '0..20mA' },
  steps: [
    { kind: 'quiz', text: 'Welcher Rohwert stand bei leerem Tank (4 mA) mit der falschen Konfiguration in "Druck_Roh"?', answer: 5530, tol: 1 },
    { kind: 'config', text: 'Kanal 0 richtig konfigurieren: Strom 2-Draht, 4–20 mA', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA' } },
    LOAD,
    { kind: 'measure', text: 'Kontrolle', ask: [{ q: 'Leerer Tank (0 mbar): "Druck_Roh"', calc: A.rawAt('CH0', { B11: 0 }), tol: 5 }] },
    { kind: 'quiz', text: 'Warum ist 4–20 mA hier richtig und nicht 0–20 mA?', options: ['Der Transmitter liefert Live Zero: 4 mA ≙ 0 mbar', 'Weil 0–20 mA verboten ist', 'Weil die SM 1231 nur 4–20 mA kann', 'Weil der Tank 20 mbar Grunddruck hat'], correct: 0 }
  ] });

const T_REF = 'IF "Temp_Roh" > 32511 OR "Temp_Roh" < -4864 THEN\n  "Temp_Fehler" := TRUE;\nELSE\n  "Temp_Fehler" := FALSE;\n  ' + sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\nEND_IF;\n"Lampe_Rot" := "Temp_Fehler";\n';
const T_KOP = nets('NETWORK Sonderwert erkennen\n["Temp_Roh" > 32511] OR ["Temp_Roh" < -4864] => "Temp_Fehler", "Lampe_Rot";', kopS('Temp_Roh', '0.0', '100.0', 'Temp_C', 'NOT "Temp_Fehler" '));
defWorkshopTask({ id: 'w5_fehler_32767', module: 5, no: 9, level: 'werkstatt', title: '118,5 °C', debug: true,
  story: 'Alarm! Das HMI zeigt <b>118,5 °C</b> – im offenen Tank. Der Werkmeister prüft: Die Leitung zu -B12 ist unterbrochen. <i>„Das Wasser kocht nicht. Das Programm glaubt einfach jedem Rohwert.“</i>',
  brief: '<p>Bei Drahtbruch liefert die SM 1231 den Sonderwert <b>32767</b>, bei Unterlauf <b>−32768</b>. Die Skalierung macht daraus Unsinn.</p><p>Fange das ab:</p><ul><li>Rohwert &gt; 32511 oder &lt; −4864 → <b>"Temp_Fehler"</b> (%M10.0) = 1, <b>"Lampe_Rot"</b> an, <b>"Temp_C"</b> behält den letzten gültigen Wert.</li><li>Sonst normal skalieren, "Temp_Fehler" = 0.</li></ul>',
  learn: 'Sonderwerte vor dem Skalieren abfangen und als Fehler melden.', take: 'Nie ungeprüft skalieren: 32767 / 27648 × 100 = 118,5 °C sieht aus wie ein Messwert, ist aber eine Fehlermeldung.',
  man: 'rohwerte', theory: 'st5b', hint: 'Erst prüfen, dann skalieren – die Skalierung gehört in den ELSE-Zweig.', hint2: 'FUP: Die Skalierungsnetzwerke nur bei NOT "Temp_Fehler" ausführen.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: { base: 'tank_fertig', knives: { 'X3:2': true } },
  steps: [
    { kind: 'quiz', text: 'Wie entstehen die 118,5 °C? (Rohwert, der skaliert wurde)', answer: 32767, tol: 0 },
    { kind: 'program', text: 'Sonderwerte abfangen', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm').concat([bool('Temp_Fehler', '%M10.0', 'Messwert Temperatur ungültig')]),
      start: Object.assign({ scl: sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\n' }, both(kopS('Temp_Roh', '0.0', '100.0', 'Temp_C'))),
      ref: Object.assign({ scl: T_REF }, both(T_KOP)),
      timed: [{ steps: [[0.05, { phys: { B12: 50 } }, { Temp_C: P(50), Temp_Fehler: false, Lampe_Rot: false }], [0.05, { raw: { Temp_Roh: 32767 } }, { Temp_C: P(50), Temp_Fehler: true, Lampe_Rot: true }],
        [0.05, { raw: { Temp_Roh: -32768 } }, { Temp_C: P(50), Temp_Fehler: true }], [0.05, { phys: { B12: 60 } }, { Temp_C: P(60), Temp_Fehler: false, Lampe_Rot: false }]] }],
      wrong: [{ scl: 'IF "Temp_Roh" = 32767 THEN\n  "Temp_Fehler" := TRUE;\nELSE\n  "Temp_Fehler" := FALSE;\n  ' + sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\nEND_IF;\n"Lampe_Rot" := "Temp_Fehler";' },
        { scl: sclS('Temp_Roh', '0.0', '100.0', 'Temp_C') + '\n"Temp_Fehler" := "Temp_Roh" > 32511 OR "Temp_Roh" < -4864;\n"Lampe_Rot" := "Temp_Fehler";' }] },
    { kind: 'wire', text: 'Schleife wieder schliessen (Trennmesser -X3:2 zu)', target: [{ knife: 'X3:2', closed: true }], ref: { knives: { 'X3:2': false } }, wrong: [{ knives: { 'X3:1': false } }] },
    LOAD
  ] });

const B_REF = [sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), '"Fuellstand_mm" := 800.0 - "Abstand_mm";', sclS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), '"Pegel_mm" := "Druck_mbar" / 0.0981;',
  sclS('Temp_Roh', '0.0', '100.0', 'Temp_C'), sclS('Durchfluss_Roh', '0.0', '20.0', 'Durchfluss_lmin'), sclS('Sollwert_Roh', '0.0', '100.0', 'Sollwert_Prozent'),
  '"Pumpe_Soll_Roh" := SCALE_X(MIN := 0, VALUE := NORM_X(MIN := 0.0, VALUE := "Sollwert_Prozent", MAX := 100.0), MAX := 27648);',
  '"Plausi_Fehler" := ABS("Fuellstand_mm" - "Pegel_mm") > 30.0;', '"Lampe_Rot" := "Plausi_Fehler";'].join('\n') + '\n';
const B_KOP = nets(kopS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), 'NETWORK Fuellstand\n=> SUB(800.0, "Abstand_mm", "Fuellstand_mm");', kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), 'NETWORK Pegel\n=> DIV("Druck_mbar", 0.0981, "Pegel_mm");',
  kopS('Temp_Roh', '0.0', '100.0', 'Temp_C'), kopS('Durchfluss_Roh', '0.0', '20.0', 'Durchfluss_lmin'), kopS('Sollwert_Roh', '0.0', '100.0', 'Sollwert_Prozent'),
  'NETWORK Pumpe normieren\n=> NORM_X(0.0, "Sollwert_Prozent", 100.0, "Hilf_Norm");', 'NETWORK Pumpe ausgeben\n=> SCALE_X(0, "Hilf_Norm", 27648, "Pumpe_Soll_Roh");',
  'NETWORK Differenz\n=> SUB("Fuellstand_mm", "Pegel_mm", "Diff_mm");', 'NETWORK Plausibilitaet\n["Diff_mm" > 30.0] OR ["Diff_mm" < -30.0] => "Plausi_Fehler", "Lampe_Rot";');
const B_TAGS = tg('Fuellstand_mm', 'Abstand_mm', 'Druck_mbar', 'Pegel_mm', 'Temp_C', 'Durchfluss_lmin', 'Sollwert_Prozent', 'Hilf_Norm', 'Diff_mm').concat([bool('Plausi_Fehler', '%M10.0', 'Ultraschall und Druck passen nicht zusammen')]);
const lv = (L, extra) => Object.assign({ B10: 800 - L, B11: L * 0.0981 }, extra || {});
defWorkshopTask({ id: 'w5_boss_hmi', module: 5, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Tank-HMI komplett',
  story: 'Morgen kommt der Kunde zur Abnahme der Tankstation. ARIA hat das Programm bis auf die Druckanzeige gelöscht. Der Werkmeister: <i>„Alle Werte in echten Einheiten, die Pumpe folgt dem Sollwertsteller – und wenn Ultraschall und Druck sich widersprechen, will ich das sehen.“</i>',
  brief: '<ol><li><b>"Fuellstand_mm"</b> aus -B10 (60–800 mm, Einbauhöhe 800 mm), <b>"Pegel_mm"</b> aus "Druck_mbar" (1 mm ≈ 0,0981 mbar).</li><li><b>"Druck_mbar"</b> 0–100, <b>"Temp_C"</b> 0–100, <b>"Durchfluss_lmin"</b> 0–20 (%IW100).</li><li><b>"Sollwert_Prozent"</b> aus -R1 ("Sollwert_Roh", %IW66, 0–100 %) → <b>"Pumpe_Soll_Roh"</b> (%QW112).</li><li><b>Plausibilität:</b> Weichen "Fuellstand_mm" und "Pegel_mm" um mehr als <b>30 mm</b> (5 % von 600 mm) ab → <b>"Plausi_Fehler"</b> (%M10.0) und <b>"Lampe_Rot"</b>. FUP: Differenz in "Diff_mm".</li><li>Laden, RUN.</li></ol>',
  learn: 'Alle Messwerte einer Anlage skalieren, einen Sollwert ausgeben und zwei Messprinzipien vergleichen.', take: 'Zwei unabhängige Messprinzipien (Schall und Druck) kontrollieren sich gegenseitig. Passen sie nicht zusammen, ist einer der beiden falsch – und das Programm meldet es.',
  man: 'normx', theory: 'st5b', hint: 'Baue Messstelle für Messstelle – das Muster ist immer dasselbe.', hint2: 'ABS("Fuellstand_mm" - "Pegel_mm") > 30.0 — in FUP: Differenz mit SUB, dann zwei Vergleicher parallel.',
  parts: ['B10', 'B11', 'B12', 'B13', 'R1'], modules: ['A1', 'A2', 'A3'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Tank-HMI programmieren', langs: ['scl', 'fup'], tagsExtra: B_TAGS, must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: DRUCK_REF + '\n' }, both(kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'))),
      ref: Object.assign({ scl: B_REF }, both(B_KOP)),
      tests: [{ phys: lv(300, { B12: 40, B13: 12, R1: 50 }), expect: { Fuellstand_mm: [300, 0.5], Pegel_mm: [300, 0.5], Druck_mbar: [29.43, 0.05], Temp_C: P(40), Durchfluss_lmin: [12, 0.02], Sollwert_Prozent: P(50), Pumpe_Soll_Roh: [13824, 2], Plausi_Fehler: false, Lampe_Rot: false } },
        { phys: lv(300, { B10: 200, R1: 0 }), expect: { Fuellstand_mm: [600, 0.5], Plausi_Fehler: true, Lampe_Rot: true, Pumpe_Soll_Roh: 0 } },
        { phys: lv(500, { B10: 800, R1: 100 }), expect: { Fuellstand_mm: [0, 0.5], Plausi_Fehler: true, Pumpe_Soll_Roh: [27648, 2] } },
        { phys: lv(500, { R1: 25 }), expect: { Plausi_Fehler: false, Pumpe_Soll_Roh: [6912, 2] } }],
      wrong: [{ scl: B_REF.replace('ABS("Fuellstand_mm" - "Pegel_mm") > 30.0', '"Fuellstand_mm" - "Pegel_mm" > 30.0') }, { scl: B_REF.replace('"Fuellstand_mm" := 800.0 - "Abstand_mm";', '"Fuellstand_mm" := "Abstand_mm";') },
        { scl: B_REF.replace("MIN := 60.0", "MIN := 0.0") }] },
    LOAD
  ] });
})(typeof window !== 'undefined' ? window : globalThis);
