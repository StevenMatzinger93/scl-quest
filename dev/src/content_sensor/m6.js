/* ===== SENSORWERKSTATT Modul 6: Messwerte sicher verarbeiten ===== */
(function(root){
const A = root.SW_ANALOG, { AW, NEED, tg, bool, sclS, kopS, nets, both } = A;
const { need } = root.SW;
root.SW_CHAPTER({ n:6, title:'Messwerte sicher verarbeiten', subtitle:'Hysterese · Kalibrieren · Plausibilität', icon:'fa-shield-halved',
  intro:'Die Werte stimmen – jetzt muss die Anlage richtig darauf reagieren. Heizung, Alarme, Trockenlauf: ARIA hofft auf flatternde Relais und überlaufende Tanks. Zum Schluss wartet das <b>Werkstatt-Finale</b>.',
  anim: root.SW_CHAPTER_ANIM('EIN < 58 °C · AUS > 62 °C') });
const P = v => [v, 0.05];
const LOAD = { kind: 'load', text: 'In das Gerät laden und CPU starten' };
const TEMP = sclS('Temp_Roh', '0.0', '100.0', 'Temp_C'), TEMP_K = kopS('Temp_Roh', '0.0', '100.0', 'Temp_C');
const US = sclS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm') + '\n"Fuellstand_mm" := 800.0 - "Abstand_mm";';
const US_K = nets(kopS('Abstand_Roh', '60.0', '800.0', 'Abstand_mm'), 'NETWORK Fuellstand\n=> SUB(800.0, "Abstand_mm", "Fuellstand_mm");');
const DRUCK = sclS('Druck_Roh', '0.0', '100.0', 'Druck_mbar'), DRUCK_K = kopS('Druck_Roh', '0.0', '100.0', 'Druck_mbar');
const T = c => ({ phys: { B12: c } }), L = mm => ({ phys: { B10: 800 - mm } });
const hystS = (v, x, on, off, rel) => 'IF "' + x + '" ' + (rel || '<') + ' ' + on + ' THEN\n  "' + v + '" := TRUE;\nELSIF "' + x + '" ' + (rel === '>' ? '<' : '>') + ' ' + off + ' THEN\n  "' + v + '" := FALSE;\nEND_IF;';
const hystK = (v, x, on, off, rel) => 'NETWORK ' + v + ' ein\n["' + x + '" ' + (rel || '<') + ' ' + on + '] => S "' + v + '";\n\nNETWORK ' + v + ' aus\n["' + x + '" ' + (rel === '>' ? '<' : '>') + ' ' + off + '] => R "' + v + '";';

/* ---------- 1 Heizung mit Hysterese ---------- */
defWorkshopTask({ id: 'w6_heizung_hysterese', module: 6, no: 1, level: 'schnell', title: 'Heizung mit Hysterese',
  story: 'Das Wasser soll auf etwa 60 °C gehalten werden. ARIAs Programm schaltet bei 60,0 °C – das Halbleiterrelais -K3 klickt im Takt der Messwertschwankung.',
  brief: '<p>Die Temperaturskalierung ist vorgegeben. Steuere <b>"Heizung"</b> (%Q0.5) mit <b>Hysterese</b>:</p><ul><li>Temperatur <b>&lt; 58 °C</b> → Heizung EIN</li><li>Temperatur <b>&gt; 62 °C</b> → Heizung AUS</li><li>dazwischen: Zustand beibehalten</li></ul>',
  learn: 'Einen Zweipunktregler mit Hysterese programmieren.', take: 'Hysterese = zwei Schaltschwellen. Zwischen den Schwellen merkt sich der Ausgang seinen Zustand – so flattert nichts.',
  man: 'hysterese', theory: 'st6a', hint: 'IF … < 58.0 THEN "Heizung" := TRUE; ELSIF … > 62.0 THEN "Heizung" := FALSE; END_IF;', hint2: 'FUP: Vergleicher < 58 setzt (S), Vergleicher > 62 setzt zurück (R).',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Heizung mit Hysterese', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm'),
      start: Object.assign({ scl: TEMP + '\n"Heizung" := "Temp_C" < 60.0;\n' }, both(nets(TEMP_K, 'NETWORK Heizung\n["Temp_C" < 60.0] => "Heizung";'))),
      ref: Object.assign({ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '58.0', '62.0') + '\n' }, both(nets(TEMP_K, hystK('Heizung', 'Temp_C', '58.0', '62.0')))),
      timed: [{ steps: [[0.05, T(55), { Heizung: true }], [0.05, T(59), { Heizung: true }], [0.05, T(61), { Heizung: true }], [0.05, T(63), { Heizung: false }], [0.05, T(61), { Heizung: false }], [0.05, T(59), { Heizung: false }], [0.05, T(57), { Heizung: true }]] }],
      wrong: [{ scl: TEMP + '\nIF "Temp_C" < 58.0 THEN\n  "Heizung" := TRUE;\nEND_IF;' }, { scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '62.0', '58.0') }] },
    LOAD
  ] });

/* ---------- 2 Füllstand Warnung/Alarm ---------- */
const F_TAGS = tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm').concat([bool('Warn_Hoch', '%M10.0', 'Warnung Füllstand hoch'), bool('Alarm_Hoch', '%M10.1', 'Alarm Füllstand hoch'), bool('Warn_Tief', '%M10.2', 'Warnung Füllstand tief')]);
const F_REF = [US, hystS('Warn_Hoch', 'Fuellstand_mm', '500.0', '480.0', '>'), hystS('Alarm_Hoch', 'Fuellstand_mm', '550.0', '530.0', '>'), hystS('Warn_Tief', 'Fuellstand_mm', '100.0', '120.0'),
  '"Lampe_Rot" := "Warn_Hoch" OR "Warn_Tief";', '"Hupe" := "Alarm_Hoch";'].join('\n') + '\n';
const F_KOP = nets(US_K, hystK('Warn_Hoch', 'Fuellstand_mm', '500.0', '480.0', '>'), hystK('Alarm_Hoch', 'Fuellstand_mm', '550.0', '530.0', '>'), hystK('Warn_Tief', 'Fuellstand_mm', '100.0', '120.0'),
  'NETWORK Lampe\n"Warn_Hoch" OR "Warn_Tief" => "Lampe_Rot";', 'NETWORK Hupe\n"Alarm_Hoch" => "Hupe";');
const F_START = US + '\n"Lampe_Rot" := "Fuellstand_mm" > 500.0 OR "Fuellstand_mm" < 100.0;\n"Hupe" := "Fuellstand_mm" > 550.0;\n';
const F_START_K = nets(US_K, 'NETWORK Lampe\n["Fuellstand_mm" > 500.0] OR ["Fuellstand_mm" < 100.0] => "Lampe_Rot";', 'NETWORK Hupe\n["Fuellstand_mm" > 550.0] => "Hupe";');
defWorkshopTask({ id: 'w6_fuellstand_grenzen', module: 6, no: 2, level: 'schnell', title: 'Warnung und Alarm',
  story: 'Beim Befüllen tanzt die Wasseroberfläche. Die rote Lampe blinkt nervös um 500 mm herum, die Hupe quäkt im Sekundentakt. Der Bediener hält sich die Ohren zu.',
  brief: '<p>Füllstandsgrenzen mit Hysterese (Füllstand aus -B10 ist vorgegeben):</p><table><tr><th>Meldung</th><th>kommt</th><th>geht</th><th>Ausgang</th></tr><tr><td>"Warn_Hoch" (%M10.0)</td><td>&gt; 500 mm</td><td>&lt; 480 mm</td><td>"Lampe_Rot"</td></tr><tr><td>"Alarm_Hoch" (%M10.1)</td><td>&gt; 550 mm</td><td>&lt; 530 mm</td><td>"Hupe"</td></tr><tr><td>"Warn_Tief" (%M10.2)</td><td>&lt; 100 mm</td><td>&gt; 120 mm</td><td>"Lampe_Rot"</td></tr></table>',
  learn: 'Warn- und Alarmgrenzen mit Hysterese programmieren.', take: 'Jede Grenze hat einen Kommt- und einen Geht-Wert. Warnung vor Alarm: Der Bediener kann reagieren, bevor es kritisch wird.',
  man: 'hysterese', theory: 'st6a', hint: 'Für jede Meldung ein IF … ELSIF … END_IF mit zwei Schwellen.', hint2: '"Lampe_Rot" := "Warn_Hoch" OR "Warn_Tief"; "Hupe" := "Alarm_Hoch";',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Füllstandsmeldungen mit Hysterese', langs: ['scl', 'fup'], tagsExtra: F_TAGS,
      start: Object.assign({ scl: F_START }, both(F_START_K)), ref: Object.assign({ scl: F_REF }, both(F_KOP)),
      timed: [{ steps: [[0.05, L(300), { Lampe_Rot: false, Hupe: false }], [0.05, L(490), { Lampe_Rot: false }], [0.05, L(510), { Warn_Hoch: true, Lampe_Rot: true, Hupe: false }], [0.05, L(490), { Lampe_Rot: true }],
        [0.05, L(470), { Lampe_Rot: false }], [0.05, L(560), { Lampe_Rot: true, Hupe: true }], [0.05, L(540), { Hupe: true }], [0.05, L(520), { Hupe: false, Lampe_Rot: true }],
        [0.05, L(90), { Warn_Hoch: false, Warn_Tief: true, Lampe_Rot: true }], [0.05, L(110), { Lampe_Rot: true }], [0.05, L(130), { Lampe_Rot: false, Hupe: false }]] }],
      wrong: [{ scl: F_REF.replace("530.0", "550.0") }, { scl: F_REF.replace('"Lampe_Rot" := "Warn_Hoch" OR "Warn_Tief";', '"Lampe_Rot" := "Warn_Hoch";') }] },
    LOAD
  ] });

/* ---------- 3 Offset-Kalibrierung ---------- */
const scaledDist = (SM, d) => { const raw = SM.rawValue(SM.transmitterSignal('B10', d), { type: 'U', range: '0..10V' }); return 60 + raw / 27648 * 740; };
defWorkshopTask({ id: 'w6_offset', module: 6, no: 3, level: 'werkstatt', title: 'Offset: 12 mm im leeren Tank',
  story: 'Der Tank ist leer, das HMI zeigt <b>12 mm</b>. Der Werkmeister misst nach: Der Halter von -B10 wurde beim Umbau 12 mm tiefer gesetzt. <i>„Nicht den Halter verbiegen – kalibrieren.“</i>',
  brief: '<ol><li>Tank leer: Lies "Fuellstand_mm" im alten Programm ab (Abstand -B10 zur Oberfläche jetzt <b>788 mm</b>).</li><li>Bestimme den Offset und korrigiere die Berechnung: Füllstand = Einbauhöhe − Abstand, mit der <b>tatsächlichen</b> Einbauhöhe.</li><li>Laden und prüfen.</li></ol>',
  learn: 'Einen Nullpunktfehler (Offset) messen und im Programm korrigieren.', take: 'Offset = Anzeige bei bekanntem Nullpunkt. Korrigieren durch Abziehen – oder gleich die richtige Einbauhöhe verwenden. Kalibrierwerte dokumentieren!',
  man: 'messen', theory: 'st6a', hint: 'Der Sensor sitzt jetzt auf 788 mm statt 800 mm.', hint2: '"Fuellstand_mm" := 788.0 - "Abstand_mm";',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'measure', text: 'Tank leer, altes Programm', ask: [{ q: 'Leerer Tank: Anzeige "Fuellstand_mm"', unit: 'mm', calc: (ctx, SM) => 800 - scaledDist(SM, 788), tol: 0.5 }] },
    { kind: 'program', text: 'Offset korrigieren', langs: ['scl', 'fup'], tagsExtra: tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm'),
      start: Object.assign({ scl: US + '\n' }, both(US_K)),
      ref: Object.assign({ scl: US.replace('800.0 -', '788.0 -') + '\n' }, both(US_K.replace('SUB(800.0', 'SUB(788.0'))),
      tests: [{ phys: { B10: 788 }, expect: { Fuellstand_mm: [0, 0.3] } }, { phys: { B10: 488 }, expect: { Fuellstand_mm: [300, 0.3] } }, { phys: { B10: 188 }, expect: { Fuellstand_mm: [600, 0.3] } }],
      wrong: [{ scl: US.replace('800.0 -', '812.0 -') }, { scl: US.replace('800.0 - "Abstand_mm"', '800.0 - "Abstand_mm" - 1.2') }] },
    LOAD
  ] });

/* ---------- 4 2-Punkt-Kalibrierung ---------- */
const ZP = '"Pegel_mm" := SCALE_X(MIN := 100.0, VALUE := NORM_X(MIN := 2712, VALUE := "Druck_Roh", MAX := 13561), MAX := 500.0);\n';
const ZP_K = 'NETWORK Normieren\n=> NORM_X(2712, "Druck_Roh", 13561, "Hilf_Norm");\n\nNETWORK Skalieren\n=> SCALE_X(100.0, "Hilf_Norm", 500.0, "Pegel_mm");';
defWorkshopTask({ id: 'w6_zweipunkt', module: 6, no: 4, level: 'werkstatt', title: '2-Punkt-Kalibrierung',
  story: 'Der Werkmeister traut keiner Formel, die er nicht selbst geprüft hat. <i>„Wir füllen auf zwei bekannte Pegel, lesen den Massstab ab und schreiben die Rohwerte auf. Das ist die ehrlichste Kalibrierung.“</i>',
  brief: '<ol><li>Tank auf <b>100 mm</b> (Massstab) füllen, "Druck_Roh" ablesen. Dann auf <b>500 mm</b>, wieder ablesen.</li><li>Die beiden Punkte in NORM_X (MIN/MAX = Rohwerte) und SCALE_X (MIN/MAX = 100 / 500 mm) eintragen → <b>"Pegel_mm"</b>.</li><li>Laden und prüfen. Werte ausserhalb der beiden Punkte rechnet die Gerade weiter (extrapoliert).</li></ol>',
  learn: 'Eine Messkette mit zwei Referenzpunkten kalibrieren.', take: 'Mit zwei gemessenen Punkten ist die Gerade festgelegt – Nullpunkt und Steigung der ganzen Messkette (Transmitter, Leitung, Baugruppe) werden auf einmal korrigiert.',
  man: 'messen', theory: 'st6b', hint: 'NORM_X(MIN := Rohwert bei 100 mm, VALUE := "Druck_Roh", MAX := Rohwert bei 500 mm)', hint2: 'SCALE_X(MIN := 100.0, …, MAX := 500.0)',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'measure', text: 'Kalibrierpunkte aufnehmen', ask: [{ q: 'Pegel 100 mm (Massstab): "Druck_Roh"', calc: A.rawAt('CH0', { B11: 9.81 }), tol: 2 }, { q: 'Pegel 500 mm (Massstab): "Druck_Roh"', calc: A.rawAt('CH0', { B11: 49.05 }), tol: 2 }] },
    { kind: 'quiz', text: 'Steigung: Wie viele mm entspricht ein Digit? (400 mm / Rohwertdifferenz)', answer: 0.0369, tol: 0.0005, unit: 'mm' },
    { kind: 'program', text: '2-Punkt-Kalibrierung eintragen', langs: ['scl', 'fup'], tagsExtra: tg('Pegel_mm', 'Hilf_Norm'), must: ['NORM_X', 'SCALE_X'],
      start: Object.assign({ scl: '"Pegel_mm" := 0.0;\n' }, both('NETWORK Pegel\n=> MOVE(0.0, "Pegel_mm");')), ref: Object.assign({ scl: ZP }, both(ZP_K)),
      tests: [{ phys: { B11: 9.81 }, expect: { Pegel_mm: [100, 1] } }, { phys: { B11: 29.43 }, expect: { Pegel_mm: [300, 1] } }, { phys: { B11: 49.05 }, expect: { Pegel_mm: [500, 1] } }, { phys: { B11: 0 }, expect: { Pegel_mm: [0, 1.5] } }, { phys: { B11: 58.86 }, expect: { Pegel_mm: [600, 1.5] } }],
      wrong: [{ scl: '"Pegel_mm" := SCALE_X(MIN := 100.0, VALUE := NORM_X(MIN := 0, VALUE := "Druck_Roh", MAX := 27648), MAX := 500.0);' }, { scl: '"Pegel_mm" := SCALE_X(MIN := 0.0, VALUE := NORM_X(MIN := 2712, VALUE := "Druck_Roh", MAX := 13561), MAX := 500.0);' }] },
    LOAD
  ] });

/* ---------- 5 Gleitender Mittelwert ---------- */
const MW = [1, 2, 3, 4, 5, 6, 7, 8];
const MW_TAGS = tg('Druck_mbar', 'Hilf_Norm').concat(MW.map(i => ({ name: 'MW_' + i, type: 'Real', addr: '%MD' + (96 + 4 * i), comment: 'Mittelwert-Speicher ' + i })),
  [{ name: 'MW_Summe', type: 'Real', addr: '%MD136', comment: 'Summe' }, { name: 'Druck_Mittel', type: 'Real', addr: '%MD140', comment: 'HMI Druck gemittelt' }]);
const MW_REF = DRUCK + '\n' + [8, 7, 6, 5, 4, 3, 2].map(i => '"MW_' + i + '" := "MW_' + (i - 1) + '";').join('\n') + '\n"MW_1" := "Druck_mbar";\n"Druck_Mittel" := ("MW_1" + "MW_2" + "MW_3" + "MW_4" + "MW_5" + "MW_6" + "MW_7" + "MW_8") / 8.0;\n';
const MW_KOP = nets(DRUCK_K, 'NETWORK Schieben\n=> ' + [8, 7, 6, 5, 4, 3, 2].map(i => 'MOVE("MW_' + (i - 1) + '", "MW_' + i + '")').join(', ') + ', MOVE("Druck_mbar", "MW_1");',
  'NETWORK Summe\n=> ADD("MW_1", "MW_2", "MW_Summe"), ' + [3, 4, 5, 6, 7, 8].map(i => 'ADD("MW_Summe", "MW_' + i + '", "MW_Summe")').join(', ') + ';', 'NETWORK Mittelwert\n=> DIV("MW_Summe", 8.0, "Druck_Mittel");');
const D = v => ({ phys: { B11: v } });
defWorkshopTask({ id: 'w6_mittelwert', module: 6, no: 5, level: 'werkstatt', title: 'Gleitender Mittelwert',
  story: 'Wenn die Pumpe läuft, schwappt das Wasser – der Druckwert zittert. Der Werkmeister: <i>„Die Baugruppe kann glätten. Aber du sollst verstehen, was sie da tut.“</i>',
  brief: '<p>Bilde einen <b>gleitenden Mittelwert über die letzten 8 Werte</b> von "Druck_mbar" in <b>"Druck_Mittel"</b> (%MD140):</p><ol><li>Jeden Zyklus alle Speicher um eins weiterschieben: MW_8 := MW_7, …, MW_2 := MW_1 (von hinten beginnen!).</li><li>MW_1 := neuer Messwert.</li><li>Mittelwert = Summe der 8 Speicher / 8. FUP: Summe in "MW_Summe".</li></ol><p>Die Druckskalierung ist vorgegeben.</p>',
  learn: 'Einen gleitenden Mittelwert als Schieberegister programmieren und mit der Glättung der Baugruppe vergleichen.', take: 'Der gleitende Mittelwert glättet Rauschen, reagiert aber verzögert: Ein Sprung ist erst nach 8 Zyklen ganz angekommen. Die Modulglättung wirkt ähnlich, ohne Programmcode.',
  man: 'messen', theory: 'st6b', hint: 'Von hinten schieben – sonst überschreibst du MW_2, bevor MW_3 ihn übernommen hat.', hint2: '"Druck_Mittel" := ("MW_1" + … + "MW_8") / 8.0;',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Gleitenden Mittelwert programmieren', langs: ['scl', 'fup'], tagsExtra: MW_TAGS,
      start: Object.assign({ scl: DRUCK + '\n"Druck_Mittel" := "Druck_mbar";\n' }, both(nets(DRUCK_K, 'NETWORK Mittelwert\n=> MOVE("Druck_mbar", "Druck_Mittel");'))),
      ref: Object.assign({ scl: MW_REF }, both(MW_KOP)),
      timed: [{ steps: [[0.05, D(40), { Druck_Mittel: P(5) }], [0.05, {}, { Druck_Mittel: P(10) }], [0.05, {}, {}], [0.05, {}, {}], [0.05, {}, {}], [0.05, {}, {}], [0.05, {}, { Druck_Mittel: P(35) }], [0.05, {}, { Druck_Mittel: P(40) }],
        [0.05, D(48), { Druck_Mittel: P(41) }], [0.05, D(40), { Druck_Mittel: P(41) }], [0.05, {}, { Druck_Mittel: P(41) }], [0.05, D(32), { Druck_Mittel: P(40) }]] }],
      wrong: [{ scl: DRUCK + '\n' + [2, 3, 4, 5, 6, 7, 8].map(i => '"MW_' + i + '" := "MW_' + (i - 1) + '";').join('\n') + '\n"MW_1" := "Druck_mbar";\n"Druck_Mittel" := ("MW_1" + "MW_2" + "MW_3" + "MW_4" + "MW_5" + "MW_6" + "MW_7" + "MW_8") / 8.0;' },
        { scl: MW_REF.replace('/ 8.0', '/ 7.0') }] },
    { kind: 'quiz', text: 'Die SM 1231 hat die Glättung „mittel“ (16 Zyklen). Was ist der Unterschied zu deinem Programm?', options: ['Gleiche Idee (mitteln gegen Rauschen), aber in der Baugruppe und ohne Programmcode – der Messwert reagiert noch träger', 'Die Modulglättung entfernt nur Drahtbrüche', 'Die Modulglättung macht den Wert genauer, aber nicht ruhiger', 'Es gibt keinen Unterschied, beide rechnen über 8 Werte'], correct: 0 },
    { kind: 'quiz', text: 'Nach einem Sprung von 40 auf 48 mbar: Nach wie vielen Zyklen zeigt "Druck_Mittel" den neuen Wert ganz?', answer: 8, tol: 0 },
    LOAD
  ] });

/* ---------- 6 Plausibilität mit Zeitverzögerung ---------- */
const PL_TAGS = tg('Abstand_mm', 'Fuellstand_mm', 'Druck_mbar', 'Pegel_mm', 'Diff_mm', 'Hilf_Norm').concat([bool('Plausi_Fehler', '%M10.0', 'Ultraschall ≠ Druck')]);
const PL_BASE = US + '\n' + DRUCK + '\n"Pegel_mm" := "Druck_mbar" / 0.0981;\n';
const PL_BASE_K = nets(US_K, DRUCK_K, 'NETWORK Pegel\n=> DIV("Druck_mbar", 0.0981, "Pegel_mm");');
const PL_REF = PL_BASE + '"T_Plausi"(IN := ABS("Fuellstand_mm" - "Pegel_mm") > 30.0, PT := T#2S);\n"Plausi_Fehler" := "T_Plausi".Q;\n"Lampe_Rot" := "Plausi_Fehler";\n';
const PL_KOP = nets(PL_BASE_K, 'NETWORK Differenz\n=> SUB("Fuellstand_mm", "Pegel_mm", "Diff_mm");', 'NETWORK Plausibilitaet\n(["Diff_mm" > 30.0] OR ["Diff_mm" < -30.0]) AND TON(T_Plausi, T#2S) => "Plausi_Fehler", "Lampe_Rot";');
const PH = (us, dr) => ({ phys: { B10: 800 - us, B11: dr * 0.0981 } });
defWorkshopTask({ id: 'w6_plausi', module: 6, no: 6, level: 'werkstatt', title: 'Zwei Messprinzipien',
  story: 'Ultraschall und Druck messen beide den Füllstand – auf völlig verschiedene Art. Wenn jemand ein Tuch über -B10 hängt, merkt es nur der Vergleich. ARIA hält schon ein Tuch in der Hand.',
  brief: '<p>Vergleiche <b>"Fuellstand_mm"</b> (Ultraschall) und <b>"Pegel_mm"</b> (Druck, beide vorgegeben):</p><ul><li>Abweichung <b>mehr als 30 mm</b> (5 % von 600 mm) – in beide Richtungen –</li><li>länger als <b>2 s</b> (Wellen beim Befüllen sind kein Fehler) →</li><li><b>"Plausi_Fehler"</b> (%M10.0) und <b>"Lampe_Rot"</b>.</li></ul><p>Zeitinstanz <b>"T_Plausi"</b> (TON). FUP: Differenz in "Diff_mm".</p>',
  learn: 'Zwei Messprinzipien mit Toleranz und Zeitverzögerung vergleichen.', take: 'Plausibilitätsprüfung: Toleranzband gegen Messunsicherheit, Zeitverzögerung gegen kurze Störungen, Betrag gegen beide Richtungen.',
  man: 'messen', theory: 'st6b', hint: 'ABS("Fuellstand_mm" - "Pegel_mm") > 30.0 als IN des Timers.', hint2: 'FUP: SUB in "Diff_mm", dann [Diff > 30] parallel zu [Diff < -30] vor TON.',
  parts: ['B10', 'B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Plausibilität programmieren', langs: ['scl', 'fup'], fb: { T_Plausi: 'TON' }, tagsExtra: PL_TAGS,
      start: Object.assign({ scl: PL_BASE }, both(PL_BASE_K)), ref: Object.assign({ scl: PL_REF }, both(PL_KOP)),
      timed: [{ steps: [[0, PH(300, 300), { Plausi_Fehler: false }], [0.5, PH(600, 300), { Plausi_Fehler: false }], [1.0, {}, { Plausi_Fehler: false }], [0.9, {}, { Plausi_Fehler: false }], [0.2, {}, { Plausi_Fehler: true, Lampe_Rot: true }],
        [0.5, PH(310, 300), { Plausi_Fehler: false, Lampe_Rot: false }], [0.5, PH(0, 300), { Plausi_Fehler: false }], [1.0, {}, { Plausi_Fehler: false }], [1.1, {}, { Plausi_Fehler: true }], [0.5, PH(300, 320), { Plausi_Fehler: false }]] }],
      wrong: [{ scl: PL_BASE + '"Plausi_Fehler" := ABS("Fuellstand_mm" - "Pegel_mm") > 30.0;\n"Lampe_Rot" := "Plausi_Fehler";' },
        { scl: PL_BASE + '"T_Plausi"(IN := "Fuellstand_mm" - "Pegel_mm" > 30.0, PT := T#2S);\n"Plausi_Fehler" := "T_Plausi".Q;\n"Lampe_Rot" := "Plausi_Fehler";' }] },
    LOAD
  ] });

/* ---------- 7 Trockenlauf und Tank voll ---------- */
const TL_TAGS = tg('Abstand_mm', 'Fuellstand_mm', 'Hilf_Norm').concat([bool('Pumpe_Anf', '%M10.0', 'HMI Pumpe ein'), bool('Heizung_Anf', '%M10.1', 'HMI Heizung ein'), bool('Trockenlauf', '%M10.2', 'Trockenlaufschutz aktiv')]);
const TL_REF = US + '\n"Trockenlauf" := NOT "Vorrat_Ok" OR "Fuellstand_mm" < 60.0;\n"Pumpe_Frei" := "Pumpe_Anf" AND "Vorrat_Ok" AND "Tank_Nicht_Voll";\n"Heizung" := "Heizung_Anf" AND NOT "Trockenlauf";\n"Lampe_Rot" := "Trockenlauf";\n';
const TL_KOP = nets(US_K, 'NETWORK Trockenlauf\nNOT "Vorrat_Ok" OR ["Fuellstand_mm" < 60.0] => "Trockenlauf", "Lampe_Rot";', 'NETWORK Pumpe\n"Pumpe_Anf" AND "Vorrat_Ok" AND "Tank_Nicht_Voll" => "Pumpe_Frei";', 'NETWORK Heizung\n"Heizung_Anf" AND NOT "Trockenlauf" => "Heizung";');
const TL_START = US + '\n"Pumpe_Frei" := "Pumpe_Anf";\n"Heizung" := "Heizung_Anf";\n';
const TL_START_K = nets(US_K, 'NETWORK Pumpe\n"Pumpe_Anf" => "Pumpe_Frei";', 'NETWORK Heizung\n"Heizung_Anf" => "Heizung";');
const tl = (mm, vo, nv, exp) => ({ in: { Pumpe_Anf: true, Heizung_Anf: true, Vorrat_Ok: vo, Tank_Nicht_Voll: nv }, phys: { B10: 800 - mm }, expect: exp });
defWorkshopTask({ id: 'w6_trockenlauf', module: 6, no: 7, level: 'werkstatt', title: 'Trockenlauf und Tank voll',
  story: 'Eine Kreiselpumpe ohne Wasser läuft sich heiss, ein Heizstab ohne Wasser brennt durch, ein voller Tank läuft über. ARIA möchte alle drei Varianten ausprobieren.',
  brief: '<ul><li><b>"Trockenlauf"</b> (%M10.2) = Schwimmer -B9 meldet Vorrat leer (<b>"Vorrat_Ok"</b> = 0) <b>ODER</b> Füllstand im Tank &lt; <b>10 %</b> (60 mm). → <b>"Lampe_Rot"</b>.</li><li><b>"Pumpe_Frei"</b> = "Pumpe_Anf" (%M10.0) UND Vorrat da UND Tank <b>nicht</b> voll. -B8 ist als <b>Öffner</b> verdrahtet: <b>"Tank_Nicht_Voll"</b> = 1 heisst „nicht voll“.</li><li><b>"Heizung"</b> = "Heizung_Anf" (%M10.1) UND kein Trockenlauf (der Heizstab muss unter Wasser sein).</li></ul>',
  learn: 'Schutzfunktionen aus Grenzwertschaltern und Analogwerten programmieren – mit Öffner-Auswertung.', take: 'Schutzfunktionen verknüpfen mehrere Quellen. Ein als Öffner verdrahteter Grenzschalter wird ohne NOT abgefragt – bei Drahtbruch stoppt die Pumpe von selbst.',
  man: 'nonc', theory: 'st6b', hint: '"Tank_Nicht_Voll" ist in Ruhe (Tank nicht voll) 1 – einfach mit AND verknüpfen.', hint2: '"Trockenlauf" := NOT "Vorrat_Ok" OR "Fuellstand_mm" < 60.0;',
  parts: ['B8', 'B9', 'B10'], modules: ['A1'], x2: [13, 14], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Trockenlaufschutz und Tank-voll-Abschaltung', langs: ['scl', 'fup'], tagsExtra: TL_TAGS,
      start: Object.assign({ scl: TL_START }, both(TL_START_K)), ref: Object.assign({ scl: TL_REF }, both(TL_KOP)),
      tests: [tl(300, true, true, { Pumpe_Frei: true, Heizung: true, Trockenlauf: false, Lampe_Rot: false }), tl(300, false, true, { Pumpe_Frei: false, Heizung: false, Trockenlauf: true, Lampe_Rot: true }),
        tl(300, true, false, { Pumpe_Frei: false, Heizung: true }), tl(40, true, true, { Pumpe_Frei: true, Heizung: false, Trockenlauf: true }), tl(70, true, true, { Heizung: true, Trockenlauf: false })],
      wrong: [{ scl: TL_REF.replace('AND "Tank_Nicht_Voll"', 'AND NOT "Tank_Nicht_Voll"') }, { scl: TL_REF.replace('"Heizung_Anf" AND NOT "Trockenlauf"', '"Heizung_Anf" AND "Vorrat_Ok"') }, { scl: TL_REF.replace('NOT "Vorrat_Ok" OR', 'NOT "Vorrat_Ok" AND') }] },
    LOAD
  ] });

/* ---------- 8 Fehlersuche: Heizung taktet ---------- */
defWorkshopTask({ id: 'w6_fehler_takt', module: 6, no: 8, level: 'schnell', title: 'Klick – klack – klick', debug: true,
  story: 'Im Nachtbetrieb soll das Wasser auf 40 °C bleiben. Das Halbleiterrelais -K3 schaltet im Sekundentakt. ARIA: <i>„Ich habe doch zwei Schwellen programmiert!“</i>',
  brief: '<p>Das Programm hat zwei Vergleicher – trotzdem taktet die Heizung. Finde den Fehler und korrigiere: Heizung <b>EIN unter 38 °C</b>, <b>AUS über 42 °C</b>.</p>',
  learn: 'Eine fehlende Hysterese im Programm erkennen und beheben.', take: 'Zwei Vergleicher mit derselben Schwelle sind keine Hysterese. Erst ein Abstand zwischen Ein- und Ausschaltschwelle beruhigt den Ausgang.',
  man: 'hysterese', theory: 'st6b', hint: 'Schau dir die beiden Schwellen an. Wie gross ist der Abstand?', hint2: '< 38.0 setzt, > 42.0 setzt zurück.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Hysterese korrigieren', langs: ['scl', 'fup'], tagsExtra: tg('Temp_C', 'Hilf_Norm'),
      start: Object.assign({ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '40.0', '40.0') + '\n' }, both(nets(TEMP_K, hystK('Heizung', 'Temp_C', '40.0', '40.0')))),
      ref: Object.assign({ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '38.0', '42.0') + '\n' }, both(nets(TEMP_K, hystK('Heizung', 'Temp_C', '38.0', '42.0')))),
      timed: [{ steps: [[0.05, T(35), { Heizung: true }], [0.05, T(39.5), { Heizung: true }], [0.05, T(40.5), { Heizung: true }], [0.05, T(41.5), { Heizung: true }], [0.05, T(42.5), { Heizung: false }], [0.05, T(39.5), { Heizung: false }], [0.05, T(37.5), { Heizung: true }]] }],
      wrong: [{ scl: TEMP + '\n' + hystS('Heizung', 'Temp_C', '39.5', '40.5') }, { scl: TEMP + '\n"Heizung" := "Temp_C" < 40.0;' }] },
    { kind: 'quiz', text: 'Warum hat das alte Programm getaktet?', options: ['Ein- und Ausschaltschwelle waren gleich (40 °C) – jedes Rauschen um 40 °C schaltet um', 'Die Temperatur war falsch skaliert', 'Das Halbleiterrelais war defekt', 'Die CPU war zu langsam'], correct: 0 },
    LOAD
  ] });

/* ---------- 9 Fehlersuche: -B8 ---------- */
const B8_OK = [['B8:BN', 'X2:13.L+'], ['B8:BU', 'X2:13.M'], ['B8:WH', 'X2:13.S']];
defWorkshopTask({ id: 'w6_fehler_b8', module: 6, no: 9, level: 'werkstatt', title: 'Der Tank läuft über', debug: true,
  story: 'Nasse Füsse im Labor: Der Messtank ist übergelaufen. Die Pumpe lief weiter, obwohl -B8 „Tank voll“ angezeigt hat – die gelbe LED am Sensor leuchtete. Das Programm fragt "Tank_Nicht_Voll" korrekt als Öffner ab.',
  brief: '<p>-B8 ist ein kapazitiver Grenzschalter mit <b>antivalenten</b> Ausgängen: BK = Schliesser (1 bei vollem Tank), WH = Öffner (1 bei nicht vollem Tank). Laut Klemmenplan soll <b>der Öffner</b> auf -X2:13 (%I1.4, "Tank_Nicht_Voll") liegen.</p><p>Finde den Fehler an -X2:13 und behebe ihn. Prüfe danach mit vollem und leerem Tank.</p>',
  learn: 'Einen als Schliesser statt Öffner angeschlossenen Grenzschalter finden.', take: 'Wird der Schliesser statt des Öffners verdrahtet, dreht sich die Logik um: „voll“ sieht aus wie „nicht voll“. Der Öffner ist drahtbruchsicher – Ader weg heisst Pumpe aus.',
  man: 'nonc', theory: 'st6b', hint: 'Welche Ader von -B8 liegt auf der Signalebene von -X2:13?', hint2: 'WH (Öffner) gehört auf -X2:13 Signal, BK bleibt frei.',
  parts: ['B8'], modules: ['A1'], x2: [13], x3: 4, start: { base: 'tank_fertig', wires: [['B8:BN', 'X2:13.L+'], ['B8:BU', 'X2:13.M'], ['B8:BK', 'X2:13.S']] },
  symptom: { cases: [{ world: { b8: true }, di: { 'I1.4': true } }] },
  steps: [
    { kind: 'wire', text: 'Öffner von -B8 auf -X2:13 legen', target: [{ net: ['B8:BN', 'POT:L+'] }, { net: ['B8:BU', 'POT:M'] }, { net: ['B8:WH', 'DI:I1.4'] }, { notNet: ['B8:BK', 'DI:I1.4'] }],
      ref: { remove: [['B8:BK', 'X2:13.S']], add: [['B8:WH', 'X2:13.S']] }, wrong: [{ remove: [], add: [] }, { add: [['B8:WH', 'X2:13.S']] }] },
    { kind: 'observe', text: 'Tank voll: %I1.4 = 0 · nicht voll: %I1.4 = 1', cases: [{ world: { b8: true }, di: { 'I1.4': false } }, { world: { b8: false }, di: { 'I1.4': true } }] },
    { kind: 'quiz', text: 'Was hätte ein Drahtbruch an -X2:13 mit der falschen Verdrahtung bewirkt?', options: ['Nichts Sichtbares bei leerem Tank – beim Vollwerden wäre der Tank ebenso übergelaufen', 'Die Pumpe wäre sofort stehen geblieben', 'Die Sicherung -F2 hätte ausgelöst', 'Der Eingang wäre dauerhaft 1'], correct: 0 },
    { kind: 'quiz', text: 'Und mit richtiger Verdrahtung (Öffner)?', options: ['%I1.4 = 0 → Pumpe aus: der sichere Zustand', 'Die Pumpe läuft weiter', 'Die Heizung schaltet ein', 'Nichts'], correct: 0 }
  ] });

/* ---------- 10 Werkstatt-Finale ---------- */
const SORT_WIRES = ['S1', 'S2', 'S3', 'S4', 'B1', 'B2', 'B3', 'B4.1', 'B4.2', 'B5', 'B6', 'B7', 'S5'].reduce((a, p) => a.concat(root.SW.field(p)), []);
defPreset('finale_sabotage', { base: 'schrank', level: 'profi', mainSwitch: true,
  wires: SORT_WIRES.concat(AW.B10, AW.B11.filter(w => w[0] !== 'A2:0-'), AW.B12, AW.B13, AW.R1, B8_OK, root.SW.c2('B9', 14)),
  shields: { B10: true, B11: true, B12: true, B13: true },
  mounts: { B1: { dist: 9, tight: false }, B2: { dist: 4, tight: true, poti: 0.6 }, B3: { dist: 60, tight: true, teach: 60 }, B6: { dist: 5, tight: true }, B7: { dist: 35, tight: true } } });
const FIN_TAGS = tg('Druck_mbar', 'Temp_C', 'Hilf_Norm');
const FIN_BAND = '"Band" := ("Start" OR "Band") AND "Stopp" AND "Haube_Zu";';
const FIN_REF = [FIN_BAND, DRUCK, TEMP, hystS('Heizung', 'Temp_C', '58.0', '62.0'), '"Pumpe_Frei" := "Tank_Nicht_Voll" AND "Vorrat_Ok";'].join('\n') + '\n';
const FIN_BUG = FIN_REF.replace('VALUE := "Druck_Roh", MAX := 27648', 'VALUE := "Druck_Roh", MAX := 32767');
const FIN_KOP = nets('NETWORK Band\n("Start" OR "Band") AND "Stopp" AND "Haube_Zu" => "Band";', DRUCK_K, TEMP_K, hystK('Heizung', 'Temp_C', '58.0', '62.0'), 'NETWORK Pumpe\n"Tank_Nicht_Voll" AND "Vorrat_Ok" => "Pumpe_Frei";');
const FIN_KOP_BUG = FIN_KOP.replace('NORM_X(0, "Druck_Roh", 27648', 'NORM_X(0, "Druck_Roh", 32767');
defWorkshopTask({ id: 'w6_finale', module: 6, no: 10, level: 'profi', final: true, title: 'Werkstatt-Finale: ARIAs Sabotage',
  story: 'Letzte Schicht. ARIA hat die ganze Werkstatt sabotiert – <b>vier Fehler</b>, verteilt auf Montage, Verdrahtung, Konfiguration und Programm. Die Sortierstrecke erkennt kein Metall, der Druck zeigt Unsinn, die Temperatur steht auf null. Der Werkmeister legt dir die Hand auf die Schulter: <i>„Du hast alles gelernt, was du brauchst. Finde sie alle.“</i>',
  brief: '<p>Profi-Stufe: spannungsfrei verdrahten, Aderendhülsen, Schirme. Bringe <b>Sortierstrecke und Tankstation gleichzeitig</b> in Betrieb:</p><ol><li><b>Montage:</b> -B1 muss Stahl sicher erkennen (Einbauabstand 4 mm, fest).</li><li><b>Verdrahtung:</b> Alle Analogschleifen müssen geschlossen sein.</li><li><b>Konfiguration:</b> Die SM 1231 muss zu den Transmittern passen (Kanal 0/1: Strom 2-Draht 4–20 mA).</li><li><b>Programm:</b> Band mit Selbsthaltung, "Druck_mbar" 0–100, "Temp_C" 0–100, Heizung mit Hysterese 58/62 °C, "Pumpe_Frei" nur bei Vorrat und Tank nicht voll.</li><li>Einschalten, Funktionsprobe, laden, RUN, Abnahme.</li></ol>',
  learn: 'Eine komplette Anlage systematisch auf Montage-, Verdrahtungs-, Konfigurations- und Programmfehler prüfen und in Betrieb nehmen.', take: 'Systematisch vorgehen: Feld (Montage) → Leitung/Klemme → Konfiguration → Programm. Jede Ebene zuerst prüfen, dann die nächste. So findet man auch vier Fehler auf einmal.',
  man: 'schrank', theory: 'st6b', hint: 'Starte am Feld: Welcher Sensor sitzt nicht, wo er sitzen soll? Dann die Analogschleifen mit dem Klemmenplan vergleichen.', hint2: 'Die vier Fehler: -B1 zu weit weg und lose · Rückleiter -A2:0− fehlt · Kanal 1 steht auf Spannung · NORM_X des Drucks rechnet mit 32767.',
  parts: ['S1', 'S2', 'S5', 'B1', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13'], modules: ['A1', 'A2', 'A3'], x2: [1, 2, 5, 12, 13, 14], x3: 4,
  start: 'preset:finale_sabotage', hw: { 'ai.CH1.type': 'U', 'ai.CH1.range': '0..10V' },
  symptom: { cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': false } }] },
  steps: [
    { kind: 'mount', text: 'Montagefehler beheben: -B1', part: 'B1', dist: [4, 0.5] },
    { kind: 'wire', text: 'Verdrahtungsfehler beheben: Analogschleifen', target: [].concat(NEED.B10, NEED.B11, NEED.B12, NEED.B13, [{ shield: 'B11' }, { shield: 'B12' }], need('B1'), need('S1'), need('S2'), need('S5')),
      ref: { add: [['A2:0-', 'X1:M7']] }, wrong: [{ add: [] }, { add: [['A2:0-', 'X1:L+8']] }] },
    { kind: 'config', text: 'Konfigurationsfehler beheben: SM 1231', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA', 'ai.CH1.type': 'I_2W', 'ai.CH1.range': '4..20mA' } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'observe', text: 'Funktionsprobe Sortierstrecke', cases: [{ world: { parts: { B1: 'stahl' } }, di: { 'I0.4': true, 'I0.1': true, 'I1.3': true } }, { world: { press: ['S1'], b8: false, b9: true }, di: { 'I0.0': true, 'I0.4': false, 'I1.4': true, 'I1.5': true } }] },
    { kind: 'program', text: 'Programmfehler beheben', langs: ['scl', 'fup'], tagsExtra: FIN_TAGS,
      start: Object.assign({ scl: FIN_BUG }, both(FIN_KOP_BUG)), ref: Object.assign({ scl: FIN_REF }, both(FIN_KOP)),
      timed: [{ steps: [[0.05, { in: { Start: false, Stopp: true, Haube_Zu: true, Tank_Nicht_Voll: true, Vorrat_Ok: true }, phys: { B11: 50, B12: 55 } }, { Band: false, Druck_mbar: P(50), Temp_C: P(55), Heizung: true, Pumpe_Frei: true }],
        [0.05, { in: { Start: true } }, { Band: true }], [0.05, { in: { Start: false }, phys: { B11: 25, B12: 61 } }, { Band: true, Druck_mbar: P(25), Heizung: true }], [0.05, { phys: { B11: 25, B12: 63 } }, { Heizung: false }],
        [0.05, { in: { Stopp: false, Tank_Nicht_Voll: false } }, { Band: false, Pumpe_Frei: false }], [0.05, { phys: { B11: 25, B12: 59 } }, { Heizung: false }]] }],
      wrong: [{ scl: FIN_REF.replace('AND "Stopp"', 'AND NOT "Stopp"') }, { scl: FIN_REF.replace('"Tank_Nicht_Voll" AND', 'NOT "Tank_Nicht_Voll" AND') }] },
    LOAD,
    { kind: 'measure', text: 'Abnahme Tankstation', ask: [{ q: 'Druck 50 mbar: "Druck_Roh"', calc: A.rawAt('CH0', { B11: 50 }), tol: 30 }, { q: 'Temperatur 50 °C: "Temp_Roh"', calc: A.rawAt('CH1', { B12: 50 }), tol: 30 }] }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);
