/* ===== SENSORWERKSTATT Modul 4: Analogsignale verstehen ===== */
(function(root){
/* Analogverdrahtung der Tankstation (Klemmenplan): 4–20 mA über Trennklemmen -X3:1…3, 0–10 V über -X3:4.
   2-Leiter: L+ → T+ ; T− → -X3:n.a ; -X3:n.b → AI x+ ; AI x− → M.  4-Leiter -B13: eigene Versorgung, I+ → -X3:3 → AI 2+, I− → AI 2−.
   -B10: BN → L+, BU → M, BK → -X3:4 → CPU AI0, 2M → M.  -R1: 1 → L+, 2 (Schleifer) → AI1, 3 → M. */
const AW = {
  B10: [['B10:BN', 'X1:L+6'], ['B10:BU', 'X1:M5'], ['B10:BK', 'X3:4.a'], ['X3:4.b', 'A1:AI0'], ['A1:2M', 'X1:M6']],
  B11: [['B11:+', 'X1:L+2'], ['B11:-', 'X3:1.a'], ['X3:1.b', 'A2:0+'], ['A2:0-', 'X1:M7']],
  B12: [['B12:+', 'X1:L+4'], ['B12:-', 'X3:2.a'], ['X3:2.b', 'A2:1+'], ['A2:1-', 'X1:M8']],
  B13: [['B13:L+', 'X1:L+5'], ['B13:M', 'X1:M1'], ['B13:I+', 'X3:3.a'], ['X3:3.b', 'A2:2+'], ['B13:I-', 'A2:2-']],
  R1:  [['R1:1', 'X1:L+7'], ['R1:2', 'A1:AI1'], ['R1:3', 'X1:M4']]
};
// Funktionsanforderungen (Plan 3.5): Schleife geschlossen, über die Trennklemme geführt
const NEED = {
  B10: [{ net: ['B10:BN', 'POT:L+'] }, { net: ['B10:BU', 'POT:M'] }, { net: ['B10:BK', 'AI:AI0'] }, { net: ['A1:2M', 'POT:M'], msg: 'Bezugspotential 2M der CPU-Analogeingänge liegt nicht auf M.' }],
  B11: [{ net: ['B11:+', 'POT:L+'] }, { net: ['B11:-', 'X3:1.a'] }, { net: ['B11:-', 'AI:CH0+'] }, { net: ['AI:CH0-', 'POT:M'], msg: '-B11: Stromschleife nicht geschlossen (Rückleiter AI 0− → M).' }],
  B12: [{ net: ['B12:+', 'POT:L+'] }, { net: ['B12:-', 'X3:2.a'] }, { net: ['B12:-', 'AI:CH1+'] }, { net: ['AI:CH1-', 'POT:M'], msg: '-B12: Stromschleife nicht geschlossen (Rückleiter AI 1− → M).' }],
  B13: [{ net: ['B13:L+', 'POT:L+'] }, { net: ['B13:M', 'POT:M'] }, { net: ['B13:I+', 'X3:3.a'] }, { net: ['B13:I+', 'AI:CH2+'] }, { net: ['B13:I-', 'AI:CH2-'] }, { notNet: ['B13:I-', 'POT:L+'] }],
  R1:  [{ net: ['R1:1', 'POT:L+'] }, { net: ['R1:3', 'POT:M'] }, { net: ['R1:2', 'AI:AI1'] }]
};
const all = ids => [].concat(...ids.map(id => AW[id]));
// Kapitel (falls chapters.js die Module 4–6 noch nicht definiert)
const A = inner => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
const ramp = label => '<path d="M30 130 L270 30" stroke="#ffb000" stroke-width="3" fill="none"/><path d="M30 130 H270 M30 130 V20" stroke="#8aa0b4" stroke-width="2"/>'
  + '<circle cx="150" cy="80" r="5" fill="#ffd21e"><animate attributeName="cx" values="30;270;30" dur="4s" repeatCount="indefinite"/><animate attributeName="cy" values="130;30;130" dur="4s" repeatCount="indefinite"/></circle>'
  + '<text x="150" y="152" text-anchor="middle" font-size="10" fill="#ffb000">' + label + '</text>';
const chap = o => { const C = root.SCL_CONTENT; if(!C || !C.chapters.some(c => c.n === o.n)) defChapter(o); };
root.SW_CHAPTER = chap; root.SW_CHAPTER_ANIM = l => A(ramp(l));
chap({ n:4, title:'Analogsignale verstehen', subtitle:'0–10 V · 4–20 mA · Rohwert', icon:'fa-wave-square',
  intro:'Die Tankstation erwacht: Ultraschall, Druck, Temperatur, Durchfluss. Hier gibt es kein 0 und 1 mehr, sondern alles dazwischen. ARIA hat die Analogleitungen gezogen. <i>„Strom ist das Signal“</i>, sagt der Werkmeister, <i>„und 27648 ist die wichtigste Zahl der Woche.“</i>',
  anim: A(ramp('4 mA → 0 · 20 mA → 27648')) });

root.SW_ANALOG = { AW, NEED, all };
const HW_OFF = ch => ({ ['ai.' + ch]: { type: 'off', range: '4..20mA', smooth: 'keine', diag: { wireBreak: false, over: false, under: false } } });
root.SW_ANALOG.HW_OFF = HW_OFF;
// HMI-/Hilfsvariablen der Tankstation (Real %MD…) und Skalierungsbausteine für SCL/FUP
const REAL = (name, addr, comment) => ({ name, type: 'Real', addr, comment });
const TG = { Fuellstand_mm: REAL('Fuellstand_mm', '%MD20', 'HMI Füllstand (Ultraschall)'), Druck_mbar: REAL('Druck_mbar', '%MD24', 'HMI Druck'), Temp_C: REAL('Temp_C', '%MD28', 'HMI Temperatur'),
  Durchfluss_lmin: REAL('Durchfluss_lmin', '%MD32', 'HMI Durchfluss'), Hilf_Norm: REAL('Hilf_Norm', '%MD36', 'Zwischenwert NORM_X (0…1)'), Abstand_mm: REAL('Abstand_mm', '%MD40', 'Abstand -B10 zur Oberfläche'),
  Pegel_mm: REAL('Pegel_mm', '%MD44', 'Pegel aus Druck'), Pumpe_Prozent: REAL('Pumpe_Prozent', '%MD48', 'HMI Pumpendrehzahl %'), Ventil_Prozent: REAL('Ventil_Prozent', '%MD52', 'HMI Stellventil %'),
  Ventil_Begrenzt: REAL('Ventil_Begrenzt', '%MD56', 'Stellventil begrenzt 0…100 %'), Diff_mm: REAL('Diff_mm', '%MD60', 'Differenz Ultraschall − Druck'), Sollwert_Prozent: REAL('Sollwert_Prozent', '%MD64', 'Sollwertsteller -R1 %') };
const tg = (...n) => n.map(k => Object.assign({}, TG[k]));
const bool = (name, addr, comment) => ({ name, type: 'Bool', addr, comment });
const sclS = (raw, lo, hi, out) => '"' + out + '" := SCALE_X(MIN := ' + lo + ', VALUE := NORM_X(MIN := 0, VALUE := "' + raw + '", MAX := 27648), MAX := ' + hi + ');';
const kopS = (raw, lo, hi, out, cond) => 'NETWORK Normieren ' + out + '\n' + (cond || '') + '=> NORM_X(0, "' + raw + '", 27648, "Hilf_Norm");\n\nNETWORK Skalieren ' + out + '\n' + (cond || '') + '=> SCALE_X(' + lo + ', "Hilf_Norm", ' + hi + ', "' + out + '");';
const nets = (...p) => p.join('\n\n');
const both = src => ({ fup: src });   // KOP entfällt in der Sensorwerkstatt (nur SCL und FUP)
Object.assign(root.SW_ANALOG, { TG, tg, bool, sclS, kopS, nets, both });

// Tankstation fertig verdrahtet (4 Transmitter + Sollwertsteller), Schirme aufgelegt, eingeschaltet
defPreset('tank_fertig', { base: 'schrank', mainSwitch: true, wires: all(['B10', 'B11', 'B12', 'B13', 'R1']), shields: { B10: true, B11: true, B12: true, B13: true } });
defPreset('m4_b10', { base: 'schrank', mainSwitch: true, wires: AW.B10 });
defPreset('m4_ohne_b12', { base: 'schrank', wires: all(['B10', 'B11', 'B13', 'R1']), shields: { B10: true, B11: true, B13: true } });
defPreset('m4_ohne_b13', { base: 'schrank', wires: all(['B10', 'B11', 'B12', 'R1']), shields: { B10: true, B11: true, B12: true } });

// Hilfen für Messaufgaben (Werte aus dem Modell)
const sigAt = (ch, phys) => (ctx, SM, W) => { const s = W.analogAt(ctx.state, ch, phys).sig; return s ? s.value : 0; };
const rawAt = (ch, phys) => (ctx, SM, W) => { const a = W.analogAt(ctx.state, ch, phys); return SM.rawValue(a.sig, root.SensorPLC.aiCfg(ctx.hw, ch)); };
const mAAt = (knife, phys) => (ctx, SM, W) => { const st = JSON.parse(JSON.stringify(ctx.state)); st.knives = Object.assign({}, st.knives, { [knife]: true }); return W.meter(st, 'mA', knife + '.a', knife + '.b', { phys }).value; };
const calRaw = (ch, mA) => (ctx, SM, W) => { const st = Object.assign({}, ctx.state, { calib: { on: true, channel: ch, mA } }); return SM.rawValue(W.analogAt(st, ch, {}).sig, root.SensorPLC.aiCfg(ctx.hw, ch)); };
Object.assign(root.SW_ANALOG, { sigAt, rawAt, mAAt, calRaw });

defWorkshopTask({ id: 'w4_b10_anschliessen', module: 4, no: 1, level: 'schnell', title: 'Ultraschall an AI0',
  story: 'An der Tankstation hängt der Ultraschallsensor <b>-B10</b> über dem Wasser – ohne Anschluss. Der Werkmeister: <i>„Ab jetzt sind Signale nicht mehr nur 0 oder 1. Miss nach, was dazwischen liegt.“</i>',
  brief: '<p>-B10 misst den Abstand zur Wasseroberfläche (60–800 mm) und gibt <b>0–10 V</b> aus. Er ist 800 mm über dem Tankboden montiert: Füllstand = 800 mm − Abstand.</p><ol><li>BN → <b>-X1:L+6</b>, BU → <b>-X1:M5</b>, BK → <b>-X3:4</b> (Feldseite a), -X3:4 SPS-Seite b → <b>-A1:AI0</b>.</li><li>Bezugspotential der CPU-Analogeingänge <b>-A1:2M</b> → <b>-X1:M6</b>.</li><li>-Q0 ein. Am Schieberegler „Anlage bedienen“ den Füllstand einstellen und die Spannung an AI0 gegen 2M messen.</li></ol>',
  learn: 'Einen 0–10-V-Sensor an den Analogeingang der CPU anschliessen und die Signalspannung messen.', take: 'Ein Spannungssignal braucht einen gemeinsamen Bezug: Sensor-M und 2M der CPU müssen verbunden sein. 0–10 V bildet den Messbereich linear ab.',
  man: 'analog', theory: 'st4a', hint: 'Ohne 2M auf M hat die Spannung an AI0 keinen Bezugspunkt.', hint2: 'Messbereich 60–800 mm ≙ 0–10 V: 430 mm liegt genau in der Mitte.',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:schrank',
  steps: [
    { kind: 'wire', text: '-B10 an AI0 anschliessen, 2M auf M', target: NEED.B10, ref: { add: AW.B10 },
      wrong: [{ add: AW.B10.slice(0, 4) }, { add: [['B10:BN', 'X1:L+6'], ['B10:BU', 'X1:M5'], ['B10:BK', 'X3:4.a'], ['X3:4.b', 'A1:AI1'], ['A1:2M', 'X1:M6']] }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Spannung an AI0 bei drei Füllständen', ask: [
      { q: 'Füllstand 555 mm (Abstand 245 mm)', unit: 'V', calc: sigAt('AI0', { B10: 245 }), tol: 0.1 },
      { q: 'Füllstand 370 mm (Abstand 430 mm)', unit: 'V', calc: sigAt('AI0', { B10: 430 }), tol: 0.1 },
      { q: 'Füllstand 185 mm (Abstand 615 mm)', unit: 'V', calc: sigAt('AI0', { B10: 615 }), tol: 0.1 }] },
    { kind: 'quiz', text: 'Der Tank wird voller. Was macht die Spannung von -B10?', options: ['Sie sinkt – der Abstand zur Oberfläche wird kleiner', 'Sie steigt', 'Sie bleibt gleich', 'Sie springt auf 24 V'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_rohwerte_spannung', module: 4, no: 2, level: 'schnell', title: 'Volt in Digits',
  story: 'Die SPS kennt keine Volt. Sie sieht nur eine Zahl. ARIA behauptet: <i>„10 V sind 32767, das weiss doch jeder.“</i>',
  brief: '<p>Der Analogeingang wandelt 0–10 V in den <b>Rohwert</b> 0–27648 (Nennbereich) um. Berechne die Rohwerte, lade die Konfiguration in die CPU und prüfe einen Wert in der Beobachtungstabelle (Variable <b>"Abstand_Roh"</b>, %IW64).</p>',
  learn: 'Spannungen in Rohwerte des Nennbereichs umrechnen und am Gerät prüfen.', take: 'Nennbereich 0–10 V ≙ 0–27648. Rohwert = U / 10 V × 27648. Werte über 27648 sind Übersteuerung, 32767 ist ein Sonderwert.',
  man: 'rohwerte', theory: 'st4a', hint: '27648 / 10 V = 2764,8 Digits pro Volt.', hint2: '2,5 V ist ein Viertel des Bereichs → 27648 / 4.',
  parts: ['B10'], modules: ['A1'], x2: [], x3: 4, start: 'preset:m4_b10',
  steps: [
    { kind: 'quiz', text: 'Rohwert bei 2,5 V?', answer: 6912, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 5 V?', answer: 13824, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 7,5 V?', answer: 20736, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 10 V?', answer: 27648, tol: 0 },
    { kind: 'load', text: 'Konfiguration laden, CPU in RUN' },
    { kind: 'measure', text: 'Beobachtungstabelle: "Abstand_Roh"', ask: [{ q: 'Abstand 430 mm: "Abstand_Roh"', calc: rawAt('AI0', { B10: 430 }), tol: 30 }] }
  ] });

defWorkshopTask({ id: 'w4_b11_2leiter', module: 4, no: 3, level: 'werkstatt', title: 'Die 2-Leiter-Schleife',
  story: 'Der Drucktransmitter <b>-B11</b> am Tankboden hat nur zwei Adern. <i>„Zwei Adern für Versorgung und Signal?“</i>, fragst du. Der Werkmeister grinst: <i>„Genau. Der Strom ist das Signal.“</i>',
  brief: '<p>-B11: 0–100 mbar → <b>4–20 mA, 2-Leiter</b>. Die SM 1231 speist die Schleife nicht – die 24 V kommen von L+.</p><ol><li>Schleife verdrahten: <b>-X1:L+2</b> → B11:+ · B11:− → <b>-X3:1</b> (a) · -X3:1 (b) → <b>-A2:0+</b> · <b>-A2:0−</b> → <b>-X1:M7</b>.</li><li>Gerätesicht, SM 1231 Kanal 0: Messart <b>Strom 2-Draht</b>, Bereich <b>4–20 mA</b>, Diagnose <b>Drahtbruch</b> ein.</li><li>-Q0 ein, laden, RUN. Rohwert bei 50 mbar prüfen.</li></ol>',
  learn: 'Einen 2-Leiter-Messumformer anschliessen und den Analogkanal konfigurieren.', take: 'Beim 2-Leiter fliesst der Schleifenstrom von L+ durch den Transmitter und den Analogeingang nach M. Der Transmitter regelt den Strom zwischen 4 und 20 mA.',
  man: 'transmitter', theory: 'st4a', hint: 'Die Schleife ist ein einziger Stromkreis: L+ → Transmitter → Eingang → M.', hint2: 'Konfiguration im Engineering: Gerätesicht → SM 1231 → Kanal 0.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:schrank', hw: HW_OFF('CH0'),
  steps: [
    { kind: 'wire', text: '2-Leiter-Schleife -B11 über -X3:1 an Kanal 0', target: NEED.B11, ref: { add: AW.B11 },
      wrong: [{ add: AW.B11.slice(0, 3) }, { add: [['B11:-', 'X1:L+2'], ['B11:+', 'X3:1.a'], ['X3:1.b', 'A2:0+'], ['A2:0-', 'X1:M7']] }] },
    { kind: 'config', text: 'Kanal 0: Strom 2-Draht, 4–20 mA, Drahtbruch ein', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA', 'ai.CH0.diag.wireBreak': true } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'load', text: 'Laden, CPU in RUN' },
    { kind: 'measure', text: 'Beobachtungstabelle: "Druck_Roh"', ask: [{ q: 'Druck 50 mbar: "Druck_Roh"', calc: rawAt('CH0', { B11: 50 }), tol: 30 }] }
  ] });

defWorkshopTask({ id: 'w4_rohwerte_strom', module: 4, no: 4, level: 'schnell', title: 'Live Zero',
  story: 'ARIA: <i>„4 mA ist doch schon Strom. Also ist 4 mA auch schon ein bisschen Druck, oder?“</i> Zeit für ein paar Zahlen.',
  brief: '<p>Bei 4–20 mA entspricht <b>4 mA</b> dem Anfang des Messbereichs (Rohwert 0) und <b>20 mA</b> dem Ende (27648). Der Nullpunkt „lebt“ – deshalb <b>Live Zero</b>.</p><p>Rohwert = (I − 4 mA) / 16 mA × 27648. Berechne die Werte.</p>',
  learn: 'Ströme im Bereich 4–20 mA in Rohwerte umrechnen und Live Zero verstehen.', take: 'Live Zero: 0 mA ist kein Messwert, sondern ein Fehler (Drahtbruch). Darum kann die Baugruppe einen Drahtbruch von „Messbereichsanfang“ unterscheiden.',
  man: 'rohwerte', theory: 'st4a', hint: '16 mA Spanne ≙ 27648 Digits → 1728 Digits pro mA.', hint2: '12 mA liegt genau in der Mitte zwischen 4 und 20 mA.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'quiz', text: 'Rohwert bei 4 mA?', answer: 0, tol: 0 },
    { kind: 'quiz', text: 'Rohwert bei 8 mA?', answer: 6912, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 12 mA?', answer: 13824, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 16 mA?', answer: 20736, tol: 1 },
    { kind: 'quiz', text: 'Rohwert bei 20 mA?', answer: 27648, tol: 0 },
    { kind: 'quiz', text: 'Die Schleife ist unterbrochen (0 mA). Was sieht die SPS mit eingeschalteter Drahtbruchdiagnose?', options: ['Den Sonderwert 32767 und einen Diagnosealarm', 'Rohwert 0 – wie leerer Tank', 'Rohwert −6912', 'Nichts, der letzte Wert bleibt stehen'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_loopcheck', module: 4, no: 5, level: 'werkstatt', title: 'Loop-Check',
  story: 'Vor der Inbetriebnahme will der Werkmeister jeden Kanal „abnehmen“: <i>„Ich will sehen, dass 12 mA am Klemmenkasten auch 12 mA in der SPS sind.“</i>',
  brief: '<p>Prüfe <b>Kanal 1</b> der SM 1231 (Temperatur -B12) mit dem <b>Stromkalibrator</b>:</p><ol><li>Trennmesser <b>-X3:2</b> öffnen – der Transmitter ist damit von der Eingangsseite getrennt.</li><li>Konfiguration laden, CPU in RUN.</li><li>Kalibrator an Kanal 1, nacheinander <b>4 / 12 / 20 mA</b> einspeisen und <b>"Temp_Roh"</b> (%IW98) protokollieren.</li></ol>',
  learn: 'Einen Analogkanal mit dem Stromkalibrator abnehmen (Loop-Check).', take: 'Beim Loop-Check speist man bekannte Ströme ein und vergleicht mit dem Rohwert. So trennt man Fehler im Transmitter von Fehlern in Leitung und SPS.',
  man: 'messen', theory: 'st4a', hint: 'Trennmesser an -X3:2 öffnen, dann den Kalibrator anschliessen.', hint2: '4 mA → 0, 12 mA → 13824, 20 mA → 27648.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'wire', text: 'Trennmesser -X3:2 öffnen', target: [{ knife: 'X3:2', closed: false }], ref: { knives: { 'X3:2': true } }, wrong: [{ knives: { 'X3:1': true } }] },
    { kind: 'load', text: 'Konfiguration laden, CPU in RUN' },
    { kind: 'measure', text: 'Loop-Check Kanal 1', ask: [
      { q: 'Kalibrator 4 mA: "Temp_Roh"', calc: calRaw('CH1', 4), tol: 2 },
      { q: 'Kalibrator 12 mA: "Temp_Roh"', calc: calRaw('CH1', 12), tol: 2 },
      { q: 'Kalibrator 20 mA: "Temp_Roh"', calc: calRaw('CH1', 20), tol: 2 }] },
    { kind: 'quiz', text: 'Alle drei Werte stimmen, trotzdem zeigt die Anlage später falsche Temperaturen. Wo suchst du?', options: ['Am Transmitter -B12 bzw. an seinem Messbereich – Leitung und Kanal sind geprüft', 'In der SM 1231', 'Im Kalibrator', 'An der CPU-Versorgung'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_b12_schirm', module: 4, no: 6, level: 'profi', title: 'Anschlusskopf und Schirm',
  story: 'Der Temperaturfühler <b>-B12</b> steckt in der Tauchhülse, der Kopftransmitter wartet auf seine Adern. Neben dem Tank läuft der Pumpen-Umrichter. <i>„Den Schirm vergisst man genau einmal“</i>, sagt der Werkmeister.',
  brief: '<p>Profi-Stufe: spannungsfrei arbeiten, Aderendhülsen, Schirm auflegen.</p><ol><li>Deckel des Anschlusskopfs öffnen: -X1:L+4 → <b>+</b>, <b>−</b> → -X3:2 (a); -X3:2 (b) → -A2:1+; -A2:1− → -X1:M8.</li><li>Schirm der Leitung mit der Schirmklemme auf die Schirmschiene legen.</li><li>-Q0 ein, Rohwert bei 50 °C prüfen. Vergleiche die Trendkurve mit und ohne Schirm.</li></ol>',
  learn: 'Einen 2-Leiter-Temperaturtransmitter im Anschlusskopf anschliessen und die Leitung schirmen.', take: 'Analogleitungen sind geschirmt, der Schirm wird grossflächig auf die Schirmschiene gelegt. Ohne Schirm schwankt der Messwert um einige Prozent.',
  man: 'transmitter', theory: 'st4b', hint: 'Werkzeug Schirmklemme: auf die Leitung von -B12 an -X3 klicken.', hint2: 'Rauschen ohne Schirm: ±1,5 % von 27648 ≈ ±400 Digits.',
  parts: ['B12'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:m4_ohne_b12',
  steps: [
    { kind: 'wire', text: '-B12 anschliessen und Schirm auflegen', target: NEED.B12.concat([{ shield: 'B12' }]), ref: { add: AW.B12, shields: { B12: true } },
      wrong: [{ add: AW.B12 }, { add: AW.B12.slice(0, 3), shields: { B12: true } }] },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'measure', text: 'Rohwert "Temp_Roh" bei 50 °C (Mittelwert aus der Trendkurve)', ask: [{ q: 'Temperatur 50 °C: "Temp_Roh"', calc: rawAt('CH1', { B12: 50 }), tol: 40 }] },
    { kind: 'quiz', text: 'Wie stark schwankt "Temp_Roh" ohne Schirm ungefähr?', options: ['Etwa ±400 Digits (±1,5 %)', 'Etwa ±5 Digits', 'Gar nicht', 'Zwischen 0 und 32767'], correct: 0 },
    { kind: 'quiz', text: 'Welche Temperaturschwankung sind ±400 Digits bei 0–100 °C?', answer: 1.45, tol: 0.1, unit: '°C' }
  ] });

defWorkshopTask({ id: 'w4_trennmesser', module: 4, no: 7, level: 'werkstatt', title: 'Strom in Reihe messen',
  story: 'Der Druckwert sieht komisch aus. Der Werkmeister: <i>„Strom misst man in Reihe. Wer das Multimeter parallel an 24 V hängt, kauft dem Laden eine neue Sicherung.“</i>',
  brief: '<ol><li>Konfiguration laden, CPU in RUN.</li><li>Trennmesser <b>-X3:1</b> (Schleife -B11) öffnen.</li><li>Multimeter auf <b>mA</b>, Messspitzen in die Messbuchsen <b>-X3:1.a</b> und <b>-X3:1.b</b> – jetzt liegt es in Reihe in der Schleife.</li><li>Ströme bei 0 und 50 mbar messen.</li><li>Ohne Multimeter: Rohwert und Diagnosepuffer bei offenem Trennmesser lesen.</li></ol>',
  learn: 'Den Schleifenstrom über die Trennklemme in Reihe messen und die Drahtbruchdiagnose lesen.', take: 'Trennmesser auf = Schleife offen: Ohne Messgerät sieht die SPS einen Drahtbruch (32767, Diagnosealarm). Mit Multimeter in den Messbuchsen misst man den echten Schleifenstrom.',
  man: 'messen', theory: 'st4b', hint: 'Das Multimeter misst nur Strom, wenn es den Stromkreis schliesst – also über dem offenen Trennmesser.', hint2: '0 mbar → 4 mA, 50 mbar → 12 mA.',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'load', text: 'Konfiguration laden, CPU in RUN' },
    { kind: 'wire', text: 'Trennmesser -X3:1 öffnen', target: [{ knife: 'X3:1', closed: false }], ref: { knives: { 'X3:1': true } }, wrong: [{ knives: { 'X3:2': true } }] },
    { kind: 'measure', text: 'Strom in Reihe, Rohwert bei offener Schleife', ask: [
      { q: 'Druck 0 mbar: Schleifenstrom', unit: 'mA', calc: mAAt('X3:1', { B11: 0 }), tol: 0.1 },
      { q: 'Druck 50 mbar: Schleifenstrom', unit: 'mA', calc: mAAt('X3:1', { B11: 50 }), tol: 0.1 },
      { q: 'Trennmesser offen, ohne Multimeter: "Druck_Roh"', calc: rawAt('CH0', { B11: 50 }), tol: 0 }] },
    { kind: 'quiz', text: 'Was steht im Diagnosepuffer?', options: ['SM 1231 Kanal 0: Drahtbruch oder Überlauf (kommend)', 'CPU in STOP', 'Kurzschluss L+/M', 'Nichts – der Kanal hat keine Diagnose'], correct: 0 }
  ] });

defWorkshopTask({ id: 'w4_b13_4leiter', module: 4, no: 8, level: 'werkstatt', title: 'Der 4-Leiter',
  story: 'Der Durchflussmesser <b>-B13</b> hat vier Adern und einen eigenen Stromausgang. ARIA hat Kanal 2 schon mal als 2-Draht konfiguriert – „sicher ist sicher“.',
  brief: '<p>-B13: 0–20 l/min → <b>4–20 mA, 4-Leiter</b>. Er wird separat versorgt und <b>treibt</b> den Strom selbst (aktiver Ausgang).</p><ol><li>Versorgung: B13:L+ → -X1:L+5, B13:M → -X1:M1.</li><li>Signal: I+ → -X3:3 (a), -X3:3 (b) → -A2:2+, I− → -A2:2−.</li><li>Kanal 2: Messart <b>Strom 4-Draht</b>, 4–20 mA.</li><li>-Q0 ein, laden, Rohwert bei 10 l/min prüfen.</li></ol>',
  learn: 'Einen 4-Leiter-Messumformer anschliessen und den Kanal passend konfigurieren.', take: '2-Leiter: Versorgung und Signal auf denselben zwei Adern, die Schleife holt sich L+. 4-Leiter: eigene Versorgung, der Stromausgang treibt direkt in x+ / x− – kein L+ in der Signalschleife.',
  man: 'transmitter', theory: 'st4b', hint: 'Beim 4-Leiter kommt kein L+ an I+ oder I−.', hint2: 'Gerätesicht → SM 1231 → Kanal 2 → Messart „Strom 4-Draht“.',
  parts: ['B13'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:m4_ohne_b13', hw: { 'ai.CH2.type': 'I_2W' },
  steps: [
    { kind: 'wire', text: '-B13 versorgen und Stromausgang an Kanal 2', target: NEED.B13, ref: { add: AW.B13 },
      wrong: [{ add: [['B13:L+', 'X1:L+5'], ['B13:M', 'X1:M1'], ['B13:I-', 'X3:3.a'], ['X3:3.b', 'A2:2+'], ['B13:I+', 'X1:L+8']] }, { add: AW.B13.slice(2) }] },
    { kind: 'config', text: 'Kanal 2: Strom 4-Draht, 4–20 mA', target: { 'ai.CH2.type': 'I_4W', 'ai.CH2.range': '4..20mA' } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'load', text: 'Laden, CPU in RUN' },
    { kind: 'measure', text: 'Beobachtungstabelle: "Durchfluss_Roh"', ask: [{ q: 'Durchfluss 10 l/min: "Durchfluss_Roh"', calc: rawAt('CH2', { B13: 10 }), tol: 30 }] },
    { kind: 'quiz', text: 'Was passiert, wenn man -B13 wie einen 2-Leiter (L+ → I+) anschliesst?', options: ['Kein oder ein falscher Messwert – der aktive Ausgang braucht seine eigene Versorgung', 'Er funktioniert genauso', 'Der Messwert verdoppelt sich', 'Die SM 1231 schaltet auf 4-Draht um'], correct: 0 }
  ] });

const ST_TAGS = [{ name: 'Druck_Status', type: 'Int', addr: '%MW80', comment: 'HMI: 0 OK, 1 Übersteuerung, 2 Untersteuerung, 3 Überlauf/Drahtbruch, 4 Unterlauf' }];
const ST_KOP = 'NETWORK In Ordnung\n=> MOVE(0, "Druck_Status");\n\nNETWORK Uebersteuerung\n["Druck_Roh" > 27648] => MOVE(1, "Druck_Status");\n\nNETWORK Untersteuerung\n["Druck_Roh" < 0] => MOVE(2, "Druck_Status");\n\nNETWORK Ueberlauf oder Drahtbruch\n["Druck_Roh" == 32767] => MOVE(3, "Druck_Status");\n\nNETWORK Unterlauf\n["Druck_Roh" == -32768] => MOVE(4, "Druck_Status");\n\nNETWORK Meldung\n["Druck_Status" >= 3] => "Lampe_Rot";';
const ST_KOP0 = 'NETWORK Meldung\n["Druck_Roh" > 27648] => "Lampe_Rot";';
defWorkshopTask({ id: 'w4_rohwert_status', module: 4, no: 9, level: 'werkstatt', title: 'Rohwert prüfen',
  story: 'ARIA hat eine Idee: <i>„Wenn der Draht bricht, zeigen wir einfach 118 mbar an. Merkt keiner.“</i> Der Werkmeister will das Gegenteil: Jeder ungültige Rohwert wird gemeldet.',
  brief: '<p>Werte <b>"Druck_Roh"</b> (%IW96) aus und schreibe den Status in <b>"Druck_Status"</b> (Int, %MW80, HMI):</p><table><tr><th>Rohwert</th><th>Status</th></tr><tr><td>0 … 27648</td><td>0 = in Ordnung</td></tr><tr><td>27649 … 32511</td><td>1 = Übersteuerung</td></tr><tr><td>−4864 … −1</td><td>2 = Untersteuerung</td></tr><tr><td>32767</td><td>3 = Überlauf / Drahtbruch</td></tr><tr><td>−32768</td><td>4 = Unterlauf</td></tr></table><p>Bei Status 3 oder 4 leuchtet <b>"Lampe_Rot"</b>.</p>',
  learn: 'Rohwerte auf Nennbereich, Über-/Untersteuerung und Sonderwerte prüfen.', take: '32767 und −32768 sind keine Messwerte, sondern Meldungen der Baugruppe. Erst prüfen, dann skalieren.',
  man: 'rohwerte', theory: 'st4b', hint: 'Die Sonderwerte zuerst prüfen: 32767 ist auch „grösser als 27648“.', hint2: 'IF "Druck_Roh" = 32767 THEN … ELSIF "Druck_Roh" = -32768 THEN … ELSIF "Druck_Roh" > 27648 THEN …',
  parts: ['B11'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:tank_fertig',
  steps: [
    { kind: 'program', text: 'Statusauswertung programmieren', langs: ['scl', 'fup'], tagsExtra: ST_TAGS,
      start: { scl: '"Lampe_Rot" := "Druck_Roh" > 27648;\n', fup: ST_KOP0 },
      ref: { scl: 'IF "Druck_Roh" = 32767 THEN\n  "Druck_Status" := 3;\nELSIF "Druck_Roh" = -32768 THEN\n  "Druck_Status" := 4;\nELSIF "Druck_Roh" > 27648 THEN\n  "Druck_Status" := 1;\nELSIF "Druck_Roh" < 0 THEN\n  "Druck_Status" := 2;\nELSE\n  "Druck_Status" := 0;\nEND_IF;\n"Lampe_Rot" := "Druck_Status" >= 3;\n', fup: ST_KOP },
      tests: [{ phys: { B11: 50 }, expect: { Druck_Status: 0, Lampe_Rot: false } }, { phys: { B11: 110 }, expect: { Druck_Status: 1, Lampe_Rot: false } }, { raw: { Druck_Roh: -2000 }, expect: { Druck_Status: 2, Lampe_Rot: false } },
        { raw: { Druck_Roh: 32767 }, expect: { Druck_Status: 3, Lampe_Rot: true } }, { raw: { Druck_Roh: -32768 }, expect: { Druck_Status: 4, Lampe_Rot: true } }, { phys: { B11: 0 }, expect: { Druck_Status: 0, Lampe_Rot: false } }],
      timed: [{ steps: [[0.05, { raw: { Druck_Roh: 32767 } }, { Druck_Status: 3 }], [0.05, { phys: { B11: 20 } }, { Druck_Status: 0, Lampe_Rot: false }]] }],
      wrong: [{ scl: 'IF "Druck_Roh" > 27648 THEN\n  "Druck_Status" := 1;\nELSIF "Druck_Roh" = 32767 THEN\n  "Druck_Status" := 3;\nELSIF "Druck_Roh" < 0 THEN\n  "Druck_Status" := 2;\nELSIF "Druck_Roh" = -32768 THEN\n  "Druck_Status" := 4;\nELSE\n  "Druck_Status" := 0;\nEND_IF;\n"Lampe_Rot" := "Druck_Status" >= 3;' },
        { scl: 'IF "Druck_Roh" = 32767 THEN\n  "Druck_Status" := 3;\nELSIF "Druck_Roh" = -32768 THEN\n  "Druck_Status" := 4;\nELSIF "Druck_Roh" > 27648 THEN\n  "Druck_Status" := 1;\nELSIF "Druck_Roh" < 0 THEN\n  "Druck_Status" := 2;\nEND_IF;\n"Lampe_Rot" := "Druck_Status" >= 3;' }] },
    { kind: 'load', text: 'Laden, CPU in RUN' }
  ] });

defWorkshopTask({ id: 'w4_boss_tank', module: 4, no: 10, level: 'werkstatt', boss: true, title: 'Boss: Die Tankstation misst',
  story: 'ARIA hat an der Tankstation alle Analogleitungen gezogen und die Kanäle der SM 1231 abgeschaltet. Der Werkmeister legt das Abnahmeprotokoll auf den Tisch: <i>„Vier Messstellen. Jede wird angeschlossen, konfiguriert und abgenommen.“</i>',
  brief: '<ol><li><b>-B10</b> (0–10 V) an CPU-AI0 über -X3:4, 2M auf M.</li><li><b>-B11</b> (2-Leiter) über -X3:1 an Kanal 0, <b>-B12</b> (2-Leiter) über -X3:2 an Kanal 1.</li><li><b>-B13</b> (4-Leiter) versorgen, Signal über -X3:3 an Kanal 2.</li><li>SM 1231 konfigurieren: Kanal 0 und 1 Strom 2-Draht, Kanal 2 Strom 4-Draht, alle 4–20 mA mit Drahtbruchdiagnose.</li><li>-Q0 ein, laden, RUN.</li><li>Abnahme: Rohwerte bei den angegebenen Prozesswerten ins Protokoll.</li></ol><p>Klemmen wie im Klemmenplan (Handbuch „Analogsignale“).</p>',
  learn: 'Alle Analogsignale einer Anlage anschliessen, konfigurieren und abnehmen.', take: 'Anschliessen → konfigurieren → laden → abnehmen. Das Abnahmeprotokoll beweist, dass jede Messstelle vom Sensor bis zum Rohwert stimmt.',
  man: 'klemmenplan', theory: 'st4b', hint: 'Arbeite Messstelle für Messstelle: verdrahten, dann gleich den Kanal konfigurieren.', hint2: 'Mitte des Messbereichs ergibt immer 13824.',
  parts: ['B10', 'B11', 'B12', 'B13'], modules: ['A1', 'A2'], x2: [], x3: 4, start: 'preset:schrank', hw: Object.assign(HW_OFF('CH0'), HW_OFF('CH1'), HW_OFF('CH2')),
  steps: [
    { kind: 'wire', text: 'Vier Messstellen anschliessen', target: [].concat(NEED.B10, NEED.B11, NEED.B12, NEED.B13), ref: { add: all(['B10', 'B11', 'B12', 'B13']) },
      wrong: [{ add: all(['B10', 'B11', 'B12']).concat([['B13:L+', 'X1:L+5'], ['B13:M', 'X1:M1'], ['B13:I-', 'X3:3.a'], ['X3:3.b', 'A2:2+'], ['B13:I+', 'X1:L+8']]) }, { add: all(['B10', 'B12', 'B13']).concat(AW.B11.slice(0, 3)) }] },
    { kind: 'config', text: 'SM 1231: Kanäle 0–2 konfigurieren', target: { 'ai.CH0.type': 'I_2W', 'ai.CH0.range': '4..20mA', 'ai.CH0.diag.wireBreak': true, 'ai.CH1.type': 'I_2W', 'ai.CH1.range': '4..20mA', 'ai.CH1.diag.wireBreak': true, 'ai.CH2.type': 'I_4W', 'ai.CH2.range': '4..20mA', 'ai.CH2.diag.wireBreak': true } },
    { kind: 'power', text: '-Q0 einschalten' },
    { kind: 'load', text: 'Laden, CPU in RUN' },
    { kind: 'measure', text: 'Abnahmeprotokoll', ask: [
      { q: 'Abstand 430 mm: "Abstand_Roh"', calc: rawAt('AI0', { B10: 430 }), tol: 30 },
      { q: 'Druck 25 mbar: "Druck_Roh"', calc: rawAt('CH0', { B11: 25 }), tol: 30 },
      { q: 'Temperatur 75 °C: "Temp_Roh"', calc: rawAt('CH1', { B12: 75 }), tol: 30 },
      { q: 'Durchfluss 10 l/min: "Durchfluss_Roh"', calc: rawAt('CH2', { B13: 10 }), tol: 30 }] }
  ] });
})(typeof window !== 'undefined' ? window : globalThis);
