/* ===== SCL QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben, nicht aus dem Spiel. Parameter werden pro Prüfung gezogen (exam_core.js).
   Grundstufe: Anweisungen gegen vorgegebene Variablen · Profi-Stufe: Bausteine. */
(function(){
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_scl_g_temperatur', quest:'scl', level:'grund', ch:4, diff:1,
  params:{ MAX:[80, 85, 90, 95] },
  title:'Temperaturwarnung',
  brief: p => 'Der Ofen meldet seine <code>Temperatur</code> (Int, °C).<br>• <code>Alarm</code> ist TRUE, wenn die Temperatur <b>über ' + p.MAX + ' °C</b> liegt.<br>• <code>Warnung</code> ist TRUE, wenn die Temperatur <b>mindestens ' + (p.MAX - 10) + ' °C</b> beträgt, aber noch kein Alarm ansteht.<br>In allen anderen Fällen sind beide FALSE.',
  vars: () => ({ Temperatur:0, Alarm:false, Warnung:false }),
  ref: p => 'IF Temperatur > ' + p.MAX + ' THEN\n  Alarm := TRUE;\n  Warnung := FALSE;\nELSIF Temperatur >= ' + (p.MAX - 10) + ' THEN\n  Alarm := FALSE;\n  Warnung := TRUE;\nELSE\n  Alarm := FALSE;\n  Warnung := FALSE;\nEND_IF;',
  visible: p => [[{Temperatur:20},{Alarm:false, Warnung:false}], [{Temperatur:p.MAX + 5},{Alarm:true, Warnung:false}]],
  hidden: p => [
    [{Temperatur:0},{Alarm:false, Warnung:false}],
    [{Temperatur:p.MAX - 11, Alarm:true, Warnung:true},{Alarm:false, Warnung:false}],
    [{Temperatur:p.MAX - 10},{Alarm:false, Warnung:true}],
    [{Temperatur:p.MAX - 1},{Alarm:false, Warnung:true}],
    [{Temperatur:p.MAX, Alarm:true},{Alarm:false, Warnung:true}],
    [{Temperatur:p.MAX + 1, Warnung:true},{Alarm:true, Warnung:false}],
    [{Temperatur:250},{Alarm:true, Warnung:false}],
    [{Temperatur:-20, Warnung:true},{Alarm:false, Warnung:false}]
  ],
  wrong:[
    p => 'Alarm := Temperatur >= ' + p.MAX + ';\nWarnung := Temperatur >= ' + (p.MAX - 10) + ' AND NOT Alarm;',
    p => 'IF Temperatur > ' + p.MAX + ' THEN\n  Alarm := TRUE;\nELSIF Temperatur >= ' + (p.MAX - 10) + ' THEN\n  Warnung := TRUE;\nEND_IF;',
    p => 'Alarm := Temperatur > ' + p.MAX + ';\nWarnung := Temperatur > ' + (p.MAX - 10) + ' AND NOT Alarm;'
  ]
});

defExamTask({ id:'x_scl_g_teilezaehler', quest:'scl', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[3, 4, 5] },
  title:'Teilezähler mit Flanke',
  brief: p => 'Jedes Teil, das in die Lichtschranke <code>Teil</code> fährt, wird <b>genau einmal</b> gezählt – auch wenn es mehrere Zyklen dort steht.<br>• Zähle mit der Instanz <code>Flanke</code> (R_TRIG) in <code>Anzahl</code> (Int) hoch.<br>• <code>Reset</code> setzt <code>Anzahl</code> auf 0.<br>• <code>Voll</code> ist TRUE, sobald <code>Anzahl</code> mindestens <b>' + p.N + '</b> ist.',
  vars: () => ({ Teil:false, Reset:false, Anzahl:0, Voll:false }), fb: () => ({ Flanke:'R_TRIG' }),
  ref: p => 'Flanke(CLK := Teil);\nIF Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Reset THEN\n  Anzahl := 0;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';',
  visible: () => [{ steps:[[0.1,{Teil:true},{Anzahl:1}],[0.1,{Teil:true},{Anzahl:1}],[0.1,{Teil:false},{Anzahl:1}],[0.1,{Teil:true},{Anzahl:2}]] }],
  hidden: p => {
    const pulses = [];
    for(let i = 1; i <= p.N + 1; i++){ pulses.push([0.1,{Teil:true},{Anzahl:i, Voll:i >= p.N}]); pulses.push([0.1,{Teil:true},{Anzahl:i}]); pulses.push([0.1,{Teil:false},{Anzahl:i, Voll:i >= p.N}]); }
    return [
      { steps:[[0.1,{},{Anzahl:0, Voll:false}]].concat(pulses) },
      { steps:[[0.1,{Teil:true},{Anzahl:1}],[0.1,{Teil:false, Reset:true},{Anzahl:0, Voll:false}],[0.1,{Reset:false},{Anzahl:0}],[0.1,{Teil:true},{Anzahl:1}]] },
      { setup:{ Anzahl:p.N - 1 }, steps:[[0.1,{},{Voll:false}],[0.1,{Teil:true},{Anzahl:p.N, Voll:true}],[0.1,{Teil:false, Reset:true},{Anzahl:0, Voll:false}]] },
      { steps:[[0.1,{Teil:true, Reset:true},{Anzahl:0}],[0.1,{Teil:true, Reset:false},{Anzahl:0}],[0.1,{Teil:false},{Anzahl:0}],[0.1,{Teil:true},{Anzahl:1}]] }
    ];
  },
  wrong:[
    p => 'IF Teil THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Reset THEN\n  Anzahl := 0;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';',
    p => 'Flanke(CLK := Teil);\nIF Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Reset THEN\n  Anzahl := 0;\nEND_IF;\nVoll := Anzahl > ' + p.N + ';',
    p => 'Flanke(CLK := Teil);\nIF Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';'
  ]
});

/* ---------- Grundstufe: weitere Aufgaben ---------- */
// Hilfen zum Berechnen erwarteter Werte (nur für die Testfälle)
const sum = a => a.reduce((s, x) => s + x, 0);
function beladen(arr, K){ let last = 0, n = 0; for(const x of arr){ if(last + x > K) break; last += x; n++; } return { Anzahl:n, Last:last, Rest_Pakete:arr.length - n }; }
function mittel(arr, MAX){ const ok = arr.filter(x => x >= 0 && x <= MAX); const s = sum(ok);
  return ok.length >= 3 ? { Summe:s, Gueltig:ok.length, Mittel:s / ok.length, Sensorfehler:false } : { Summe:s, Gueltig:ok.length, Mittel:0, Sensorfehler:true }; }
function ausschuss(arr, LO, HI){ const bad = arr.filter(x => x < LO || x > HI).length; return { Anzahl_Schlecht:bad, Gut_Summe:sum(arr.filter(x => x >= LO && x <= HI)), Alle_OK:bad === 0 }; }
function schieben(pl, neu, takt){ const out = takt ? [neu].concat(pl.slice(0, 5)) : pl.slice(); return { Platz:out, Ausgeworfen: takt ? pl[5] : 0, Belegt: out.filter(x => x !== 0).length }; }

defExamTask({ id:'x_scl_g_grundstellung', quest:'scl', level:'grund', ch:1, diff:1,
  params:{ W:[30, 45, 60, -45], V:[0.5, 1.5, 2.5] },
  title:'Grundstellung des Roboterarms',
  brief: p => 'Bringe den Roboterarm in Grundstellung. Halte die Reihenfolge ein:<br>1. <code>Letzte_Pos</code> (Int) übernimmt den <b>aktuellen</b> Wert von <code>Arm_Winkel</code>.<br>2. <code>Arm_Winkel</code> (Int) wird auf <b>' + p.W + '</b> gesetzt.<br>3. <code>Greifer_Auf</code> (Bool) wird TRUE.<br>4. <code>Vorschub</code> (Real) wird auf <b>' + p.V + '</b> gesetzt.',
  vars: () => ({ Arm_Winkel:0, Letzte_Pos:0, Greifer_Auf:false, Vorschub:0 }), types: () => ({ Vorschub:'REAL' }),
  ref: p => 'Letzte_Pos := Arm_Winkel;\nArm_Winkel := ' + p.W + ';\nGreifer_Auf := TRUE;\nVorschub := ' + p.V + ';',
  visible: p => [[{Arm_Winkel:90},{Letzte_Pos:90, Arm_Winkel:p.W, Greifer_Auf:true, Vorschub:p.V}]],
  hidden: p => [
    [{Arm_Winkel:0},{Letzte_Pos:0, Arm_Winkel:p.W, Greifer_Auf:true, Vorschub:p.V}],
    [{Arm_Winkel:-90, Letzte_Pos:77},{Letzte_Pos:-90, Arm_Winkel:p.W}],
    [{Arm_Winkel:135, Greifer_Auf:true, Vorschub:9.5},{Letzte_Pos:135, Greifer_Auf:true, Vorschub:p.V}],
    [{Arm_Winkel:p.W},{Letzte_Pos:p.W, Arm_Winkel:p.W}],
    [{Arm_Winkel:12, Vorschub:-1},{Letzte_Pos:12, Vorschub:p.V, Greifer_Auf:true}],
    [{Arm_Winkel:-30, Letzte_Pos:-30, Greifer_Auf:false},{Letzte_Pos:-30, Arm_Winkel:p.W, Greifer_Auf:true}]
  ],
  wrong:[
    p => 'Arm_Winkel := ' + p.W + ';\nLetzte_Pos := Arm_Winkel;\nGreifer_Auf := TRUE;\nVorschub := ' + p.V + ';',
    p => 'Letzte_Pos := ' + p.W + ';\nArm_Winkel := ' + p.W + ';\nGreifer_Auf := TRUE;\nVorschub := ' + p.V + ';',
    p => 'Letzte_Pos := Arm_Winkel;\nArm_Winkel := ' + p.W + ';\nVorschub := ' + p.V + ';'
  ]
});

defExamTask({ id:'x_scl_g_greiffreigabe', quest:'scl', level:'grund', ch:2, diff:1,
  title:'Greiffreigabe',
  brief: () => 'Der Roboter darf nur greifen (<code>Freigabe</code>), wenn<br>• <code>Automatik</code> aktiv ist <b>und</b><br>• die Schutztür geschlossen ist (<code>Tuer_Zu</code>) <b>und</b><br>• kein Not-Halt betätigt ist (<code>Not_Halt</code> = TRUE bedeutet betätigt) <b>und</b><br>• <b>genau eine</b> der beiden Ablagen ein Teil meldet (<code>Teil_Links</code>, <code>Teil_Rechts</code>).<br><code>Warnung</code> ist TRUE, wenn der Not-Halt betätigt <b>oder</b> die Schutztür offen ist.',
  vars: () => ({ Automatik:false, Tuer_Zu:false, Not_Halt:false, Teil_Links:false, Teil_Rechts:false, Freigabe:false, Warnung:false }),
  ref: () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND (Teil_Links XOR Teil_Rechts);\nWarnung := Not_Halt OR NOT Tuer_Zu;',
  visible: () => [[{Automatik:true, Tuer_Zu:true, Teil_Links:true},{Freigabe:true, Warnung:false}], [{Automatik:true, Tuer_Zu:false, Teil_Links:true},{Freigabe:false, Warnung:true}]],
  hidden: () => [
    [{Automatik:true, Tuer_Zu:true, Teil_Rechts:true, Warnung:true},{Freigabe:true, Warnung:false}],
    [{Automatik:true, Tuer_Zu:true, Teil_Links:true, Teil_Rechts:true, Freigabe:true},{Freigabe:false, Warnung:false}],
    [{Automatik:true, Tuer_Zu:true, Freigabe:true},{Freigabe:false, Warnung:false}],
    [{Automatik:true, Tuer_Zu:true, Teil_Links:true, Not_Halt:true},{Freigabe:false, Warnung:true}],
    [{Tuer_Zu:true, Teil_Links:true, Warnung:true},{Freigabe:false, Warnung:false}],
    [{Automatik:false, Tuer_Zu:false, Teil_Rechts:true},{Freigabe:false, Warnung:true}],
    [{Automatik:true, Teil_Links:true, Teil_Rechts:true},{Freigabe:false, Warnung:true}],
    [{},{Freigabe:false, Warnung:true}]
  ],
  wrong:[
    () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND (Teil_Links OR Teil_Rechts);\nWarnung := Not_Halt OR NOT Tuer_Zu;',
    () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND Teil_Links XOR Teil_Rechts;\nWarnung := Not_Halt OR NOT Tuer_Zu;',
    () => 'Freigabe := Automatik AND Tuer_Zu AND NOT Not_Halt AND (Teil_Links XOR Teil_Rechts);\nWarnung := Not_Halt AND NOT Tuer_Zu;'
  ]
});

defExamTask({ id:'x_scl_g_kisten', quest:'scl', level:'grund', ch:3, diff:1,
  params:{ N:[6, 8, 12] },
  title:'Teile verpacken',
  brief: p => 'Am Bandende werden Teile in Kisten zu je <b>' + p.N + ' Stück</b> verpackt. Berechne aus <code>Teile</code> (Int):<br>• <code>Kisten_Voll</code>: Anzahl vollständig gefüllter Kisten<br>• <code>Rest</code>: Teile, die danach übrig bleiben<br>Beide Ergebnisse sind ganze Zahlen (Int).',
  vars: () => ({ Teile:0, Kisten_Voll:0, Rest:0 }),
  ref: p => 'Kisten_Voll := Teile / ' + p.N + ';\nRest := Teile MOD ' + p.N + ';',
  visible: p => [[{Teile:2 * p.N + 1},{Kisten_Voll:2, Rest:1}]],
  hidden: p => [
    [{Teile:0, Kisten_Voll:4, Rest:3},{Kisten_Voll:0, Rest:0}],
    [{Teile:p.N - 1},{Kisten_Voll:0, Rest:p.N - 1}],
    [{Teile:p.N},{Kisten_Voll:1, Rest:0}],
    [{Teile:p.N + 1},{Kisten_Voll:1, Rest:1}],
    [{Teile:8 * p.N - 1},{Kisten_Voll:7, Rest:p.N - 1}],
    [{Teile:100, Rest:50},{Kisten_Voll:Math.floor(100 / p.N), Rest:100 % p.N}],
    [{Teile:1000},{Kisten_Voll:Math.floor(1000 / p.N), Rest:1000 % p.N}]
  ],
  wrong:[
    p => 'Kisten_Voll := Teile MOD ' + p.N + ';\nRest := Teile / ' + p.N + ';',
    p => 'Kisten_Voll := Teile / ' + p.N + ';\nRest := Teile - ' + p.N + ';',
    p => 'Kisten_Voll := Teile / ' + p.N + ' + 1;\nRest := Teile MOD ' + p.N + ';'
  ]
});

defExamTask({ id:'x_scl_g_achsabweichung', quest:'scl', level:'grund', ch:3, diff:2,
  params:{ TOL:[2, 3, 5], MK:[10, 15, 20] },
  title:'Achsabweichung',
  brief: p => 'Eine Achse fährt auf eine Sollposition (Werte in mm, Int). Berechne:<br>• <code>Abweichung</code>: Betrag der Differenz von <code>Soll_Pos</code> und <code>Ist_Pos</code> (immer ≥ 0)<br>• <code>In_Toleranz</code>: TRUE, wenn die Abweichung <b>höchstens ' + p.TOL + ' mm</b> beträgt<br>• <code>Korrektur</code> = <code>Soll_Pos − Ist_Pos</code>, aber begrenzt auf den Bereich <b>−' + p.MK + ' … +' + p.MK + '</b><br>Verwende die Funktionen <code>ABS</code> und <code>LIMIT</code>.',
  vars: () => ({ Soll_Pos:0, Ist_Pos:0, Abweichung:0, In_Toleranz:false, Korrektur:0 }),
  must:['ABS', 'LIMIT'],
  ref: p => 'Abweichung := ABS(Soll_Pos - Ist_Pos);\nIn_Toleranz := Abweichung <= ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Soll_Pos - Ist_Pos, MX := ' + p.MK + ');',
  visible: p => [[{Soll_Pos:50, Ist_Pos:48},{Abweichung:2, In_Toleranz:true, Korrektur:2}], [{Soll_Pos:0, Ist_Pos:100},{Abweichung:100, In_Toleranz:false, Korrektur:-p.MK}]],
  hidden: p => [
    [{Soll_Pos:100, Ist_Pos:100, In_Toleranz:false, Korrektur:7},{Abweichung:0, In_Toleranz:true, Korrektur:0}],
    [{Soll_Pos:100, Ist_Pos:100 - p.TOL},{Abweichung:p.TOL, In_Toleranz:true, Korrektur:p.TOL}],
    [{Soll_Pos:100, Ist_Pos:101 + p.TOL, In_Toleranz:true},{Abweichung:p.TOL + 1, In_Toleranz:false, Korrektur:-(p.TOL + 1)}],
    [{Soll_Pos:p.MK, Ist_Pos:0},{Abweichung:p.MK, Korrektur:p.MK}],
    [{Soll_Pos:p.MK + 1, Ist_Pos:0},{Abweichung:p.MK + 1, In_Toleranz:false, Korrektur:p.MK}],
    [{Soll_Pos:-40, Ist_Pos:-40 + p.MK + 1},{Abweichung:p.MK + 1, Korrektur:-p.MK}],
    [{Soll_Pos:0, Ist_Pos:250, Abweichung:3},{Abweichung:250, In_Toleranz:false, Korrektur:-p.MK}]
  ],
  wrong:[
    p => 'Abweichung := ABS(Soll_Pos - Ist_Pos);\nIn_Toleranz := Abweichung < ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Soll_Pos - Ist_Pos, MX := ' + p.MK + ');',
    p => 'Abweichung := ABS(Soll_Pos - Ist_Pos);\nIn_Toleranz := Abweichung <= ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Ist_Pos - Soll_Pos, MX := ' + p.MK + ');',
    p => 'Abweichung := Soll_Pos - Ist_Pos;\nIn_Toleranz := ABS(Abweichung) <= ' + p.TOL + ';\nKorrektur := LIMIT(MN := -' + p.MK + ', IN := Soll_Pos - Ist_Pos, MX := ' + p.MK + ');'
  ]
});

defExamTask({ id:'x_scl_g_kompressor', quest:'scl', level:'grund', ch:4, diff:2,
  params:{ EIN:[5, 6], AUS:[8, 9] },
  title:'Kompressor mit Hysterese',
  brief: p => 'Ein Druckluftkompressor arbeitet mit Hysterese (<code>Druck</code> in bar, Int):<br>• <code>Kompressor</code> schaltet <b>ein</b>, wenn der Druck <b>unter ' + p.EIN + ' bar</b> fällt.<br>• Er schaltet <b>aus</b>, wenn der Druck <b>über ' + p.AUS + ' bar</b> steigt.<br>• Dazwischen (' + p.EIN + ' … ' + p.AUS + ' bar) behält er seinen bisherigen Zustand.<br>• <code>Ueberdruck</code> ist TRUE ab <b>12 bar</b>, sonst FALSE.',
  vars: () => ({ Druck:0, Kompressor:false, Ueberdruck:false }),
  must:['IF'],
  ref: p => 'IF Druck < ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSIF Druck > ' + p.AUS + ' THEN\n  Kompressor := FALSE;\nEND_IF;\nUeberdruck := Druck >= 12;',
  visible: () => [[{Druck:2},{Kompressor:true, Ueberdruck:false}], [{Druck:10, Kompressor:true},{Kompressor:false, Ueberdruck:false}]],
  hidden: p => [
    [{Druck:p.EIN - 1},{Kompressor:true}],
    [{Druck:p.EIN, Kompressor:false},{Kompressor:false}],
    [{Druck:p.EIN, Kompressor:true},{Kompressor:true}],
    [{Druck:7, Kompressor:true},{Kompressor:true, Ueberdruck:false}],
    [{Druck:7, Kompressor:false},{Kompressor:false}],
    [{Druck:p.AUS, Kompressor:true},{Kompressor:true}],
    [{Druck:p.AUS + 1, Kompressor:true},{Kompressor:false, Ueberdruck:false}],
    [{Druck:12, Kompressor:true},{Kompressor:false, Ueberdruck:true}],
    [{Druck:11, Ueberdruck:true},{Ueberdruck:false}],
    [{Druck:0, Ueberdruck:true},{Kompressor:true, Ueberdruck:false}]
  ],
  wrong:[
    p => 'IF Druck <= ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSIF Druck > ' + p.AUS + ' THEN\n  Kompressor := FALSE;\nEND_IF;\nUeberdruck := Druck >= 12;',
    p => 'IF Druck < ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSE\n  Kompressor := FALSE;\nEND_IF;\nUeberdruck := Druck >= 12;',
    p => 'IF Druck < ' + p.EIN + ' THEN\n  Kompressor := TRUE;\nELSIF Druck > ' + p.AUS + ' THEN\n  Kompressor := FALSE;\nEND_IF;\nIF Druck >= 12 THEN\n  Ueberdruck := TRUE;\nEND_IF;'
  ]
});

defExamTask({ id:'x_scl_g_betriebsart', quest:'scl', level:'grund', ch:5, diff:1,
  params:{ VH:[10, 20], VA:[60, 80, 100] },
  title:'Betriebsartenanzeige',
  brief: p => 'Signalsäule und Band zeigen die gewählte <code>Betriebsart</code> (Int):<br>• 0 = Aus: alle Lampen aus, <code>Band_Speed</code> = 0<br>• 1 = Hand: nur <code>Lampe_Gelb</code>, <code>Band_Speed</code> = ' + p.VH + '<br>• 2 = Automatik: nur <code>Lampe_Gruen</code>, <code>Band_Speed</code> = ' + p.VA + '<br>• jeder andere Wert: nur <code>Lampe_Rot</code>, <code>Band_Speed</code> = 0<br>Verwende eine <code>CASE</code>-Anweisung. Es leuchtet immer nur die genannte Lampe.',
  vars: () => ({ Betriebsart:0, Lampe_Gelb:false, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:0 }),
  must:['CASE'],
  ref: p => 'Lampe_Gelb := FALSE;\nLampe_Gruen := FALSE;\nLampe_Rot := FALSE;\nBand_Speed := 0;\nCASE Betriebsart OF\n  0:\n    Band_Speed := 0;\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VH + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VA + ';\nELSE\n  Lampe_Rot := TRUE;\nEND_CASE;',
  visible: p => [[{Betriebsart:1},{Lampe_Gelb:true, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:p.VH}], [{Betriebsart:2},{Lampe_Gelb:false, Lampe_Gruen:true, Band_Speed:p.VA}]],
  hidden: p => [
    [{Betriebsart:0, Lampe_Gelb:true, Lampe_Gruen:true, Lampe_Rot:true, Band_Speed:50},{Lampe_Gelb:false, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:0}],
    [{Betriebsart:1, Lampe_Gruen:true, Band_Speed:p.VA},{Lampe_Gelb:true, Lampe_Gruen:false, Lampe_Rot:false, Band_Speed:p.VH}],
    [{Betriebsart:2, Lampe_Gelb:true, Lampe_Rot:true},{Lampe_Gelb:false, Lampe_Gruen:true, Lampe_Rot:false, Band_Speed:p.VA}],
    [{Betriebsart:3, Lampe_Gruen:true, Band_Speed:p.VA},{Lampe_Gelb:false, Lampe_Gruen:false, Lampe_Rot:true, Band_Speed:0}],
    [{Betriebsart:-1},{Lampe_Rot:true, Band_Speed:0}],
    [{Betriebsart:99, Lampe_Gelb:true},{Lampe_Gelb:false, Lampe_Rot:true}]
  ],
  wrong:[
    p => 'CASE Betriebsart OF\n  0:\n    Band_Speed := 0;\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VH + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VA + ';\nELSE\n  Lampe_Rot := TRUE;\n  Band_Speed := 0;\nEND_CASE;',
    p => 'Lampe_Gelb := FALSE;\nLampe_Gruen := FALSE;\nLampe_Rot := FALSE;\nBand_Speed := 0;\nCASE Betriebsart OF\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VH + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VA + ';\nEND_CASE;',
    p => 'Lampe_Gelb := FALSE;\nLampe_Gruen := FALSE;\nLampe_Rot := FALSE;\nBand_Speed := 0;\nCASE Betriebsart OF\n  1:\n    Lampe_Gelb := TRUE;\n    Band_Speed := ' + p.VA + ';\n  2:\n    Lampe_Gruen := TRUE;\n    Band_Speed := ' + p.VH + ';\nELSE\n  Lampe_Rot := TRUE;\nEND_CASE;'
  ]
});

defExamTask({ id:'x_scl_g_sortiercode', quest:'scl', level:'grund', ch:5, diff:2,
  params:{ G:[29, 49, 59] },
  title:'Sortieren nach Code',
  brief: p => 'Der Roboter sortiert Teile nach dem gelesenen <code>Code</code> (Int):<br>• 0 = kein Teil: <code>Arm_Ziel</code> = 0<br>• 1 … ' + p.G + ' = Gutteil: <code>Arm_Ziel</code> = 90 (LAGER)<br>• ' + (p.G + 1) + ' … 99 = Nacharbeit: <code>Arm_Ziel</code> = −90 (NACHARBEIT)<br>• jeder andere Code: <code>Arm_Ziel</code> = 0 und <code>Stoerung</code> = TRUE<br><code>Stoerung</code> ist in allen anderen Fällen FALSE. Verwende <code>CASE</code> mit Bereichen (<code>a..b</code>).',
  vars: () => ({ Code:0, Arm_Ziel:0, Stoerung:false }),
  must:['CASE', 'RANGE'],
  ref: p => 'Stoerung := FALSE;\nCASE Code OF\n  0:\n    Arm_Ziel := 0;\n  1..' + p.G + ':\n    Arm_Ziel := 90;\n  ' + (p.G + 1) + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;',
  visible: () => [[{Code:10},{Arm_Ziel:90, Stoerung:false}], [{Code:150},{Arm_Ziel:0, Stoerung:true}]],
  hidden: p => [
    [{Code:0, Arm_Ziel:90, Stoerung:true},{Arm_Ziel:0, Stoerung:false}],
    [{Code:1, Stoerung:true},{Arm_Ziel:90, Stoerung:false}],
    [{Code:p.G},{Arm_Ziel:90, Stoerung:false}],
    [{Code:p.G + 1, Arm_Ziel:90},{Arm_Ziel:-90, Stoerung:false}],
    [{Code:99, Stoerung:true},{Arm_Ziel:-90, Stoerung:false}],
    [{Code:100, Arm_Ziel:-90},{Arm_Ziel:0, Stoerung:true}],
    [{Code:-5, Arm_Ziel:90},{Arm_Ziel:0, Stoerung:true}]
  ],
  wrong:[
    p => 'Stoerung := FALSE;\nCASE Code OF\n  0:\n    Arm_Ziel := 0;\n  1..' + (p.G - 1) + ':\n    Arm_Ziel := 90;\n  ' + p.G + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;',
    p => 'CASE Code OF\n  0:\n    Arm_Ziel := 0;\n  1..' + p.G + ':\n    Arm_Ziel := 90;\n  ' + (p.G + 1) + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;',
    p => 'Stoerung := FALSE;\nCASE Code OF\n  1..' + p.G + ':\n    Arm_Ziel := 90;\n  ' + (p.G + 1) + '..99:\n    Arm_Ziel := -90;\nELSE\n  Arm_Ziel := 0;\n  Stoerung := TRUE;\nEND_CASE;'
  ]
});

defExamTask({ id:'x_scl_g_ausschuss', quest:'scl', level:'grund', ch:6, diff:2,
  params:{ LO:[95, 98], HI:[102, 105] },
  title:'Ausschuss in der Charge',
  brief: p => 'Im Array <code>Masse</code> (Index 0 … 7, Int) stehen die Gewichte der letzten acht Teile in Gramm. Ein Teil ist gut, wenn es <b>mindestens ' + p.LO + ' g und höchstens ' + p.HI + ' g</b> wiegt. Berechne mit einer <code>FOR</code>-Schleife:<br>• <code>Anzahl_Schlecht</code>: Anzahl der Teile ausserhalb der Toleranz<br>• <code>Gut_Summe</code>: Summe der Gewichte aller guten Teile<br>• <code>Alle_OK</code>: TRUE, wenn kein Teil schlecht ist',
  vars: () => ({ Masse:[100,100,100,100,100,100,100,100], Anzahl_Schlecht:0, Gut_Summe:0, Alle_OK:false }),
  must:['FOR', 'ARRAY'],
  ref: p => 'Anzahl_Schlecht := 0;\nGut_Summe := 0;\nFOR i := 0 TO 7 DO\n  IF Masse[i] < ' + p.LO + ' OR Masse[i] > ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;',
  visible: p => { const m = [100, 101, p.LO - 5, 99, 100, p.HI + 5, 100, 100]; return [[{Masse:m}, ausschuss(m, p.LO, p.HI)]]; },
  hidden: p => [
    [100,100,100,100,100,100,100,100],
    [p.LO, p.HI, p.LO - 1, p.HI + 1, 100, 100, 100, 100],
    [p.LO - 1, 100, 100, 100, 100, 100, 100, p.HI + 1],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [p.HI, p.HI, p.HI, p.HI, p.LO, p.LO, p.LO, p.LO],
    [100, 100, 100, 100, 100, 100, 100, p.HI + 1]
  ].map((m, i) => [Object.assign({Masse:m}, i % 2 ? {} : {Anzahl_Schlecht:3, Gut_Summe:50, Alle_OK:i !== 0}), ausschuss(m, p.LO, p.HI)]),
  wrong:[
    p => 'FOR i := 0 TO 7 DO\n  IF Masse[i] < ' + p.LO + ' OR Masse[i] > ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;',
    p => 'Anzahl_Schlecht := 0;\nGut_Summe := 0;\nFOR i := 0 TO 6 DO\n  IF Masse[i] < ' + p.LO + ' OR Masse[i] > ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;',
    p => 'Anzahl_Schlecht := 0;\nGut_Summe := 0;\nFOR i := 0 TO 7 DO\n  IF Masse[i] <= ' + p.LO + ' OR Masse[i] >= ' + p.HI + ' THEN\n    Anzahl_Schlecht := Anzahl_Schlecht + 1;\n  ELSE\n    Gut_Summe := Gut_Summe + Masse[i];\n  END_IF;\nEND_FOR;\nAlle_OK := Anzahl_Schlecht = 0;'
  ]
});

defExamTask({ id:'x_scl_g_taktband', quest:'scl', level:'grund', ch:6, diff:3,
  title:'Taktband (Schieberegister)',
  brief: () => 'Auf einem Taktband liegen sechs Plätze (<code>Platz</code>, Index 0 … 5, Int; 0 = leer, sonst Teilenummer). Bei jedem <code>Takt</code> rückt jedes Teil einen Platz weiter:<br>• Das Teil auf Platz 5 verlässt das Band: <code>Ausgeworfen</code> übernimmt seine Nummer.<br>• Platz i bekommt den bisherigen Inhalt von Platz i−1 (i = 5 … 1).<br>• Platz 0 bekommt <code>Neu_Teil</code>.<br>Ohne Takt bleibt das Band unverändert und <code>Ausgeworfen</code> ist 0.<br><code>Belegt</code>: Anzahl der Plätze ≠ 0 <b>nach</b> dem Takt — in jedem Zyklus berechnen.<br>Tipp: Überlege, in welcher Richtung die Schleife laufen muss.',
  vars: () => ({ Takt:false, Neu_Teil:0, Platz:[0,0,0,0,0,0], Ausgeworfen:0, Belegt:0 }),
  must:['FOR', 'ARRAY'],
  ref: () => 'IF Takt THEN\n  Ausgeworfen := Platz[5];\n  FOR i := 5 TO 1 BY -1 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Platz[0] := Neu_Teil;\nELSE\n  Ausgeworfen := 0;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;',
  visible: () => [[{Takt:true, Neu_Teil:4, Platz:[3,2,1,0,0,0]}, schieben([3,2,1,0,0,0], 4, true)]],
  hidden: () => [
    [{Takt:true, Neu_Teil:7, Platz:[1,2,3,4,5,6]}, schieben([1,2,3,4,5,6], 7, true)],
    [{Takt:false, Neu_Teil:5, Platz:[1,0,3,0,0,9], Ausgeworfen:4}, schieben([1,0,3,0,0,9], 5, false)],
    [{Takt:true, Neu_Teil:0, Platz:[0,0,0,0,0,0], Belegt:5}, schieben([0,0,0,0,0,0], 0, true)],
    [{Takt:true, Neu_Teil:3, Platz:[0,0,0,0,0,8]}, schieben([0,0,0,0,0,8], 3, true)],
    [{Takt:true, Neu_Teil:0, Platz:[5,0,6,0,7,0], Ausgeworfen:9}, schieben([5,0,6,0,7,0], 0, true)],
    [{Takt:true, Neu_Teil:21, Platz:[11,12,13,14,15,16]}, schieben([11,12,13,14,15,16], 21, true)]
  ],
  wrong:[
    () => 'IF Takt THEN\n  Ausgeworfen := Platz[5];\n  FOR i := 1 TO 5 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Platz[0] := Neu_Teil;\nELSE\n  Ausgeworfen := 0;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;',
    () => 'IF Takt THEN\n  FOR i := 5 TO 1 BY -1 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Ausgeworfen := Platz[5];\n  Platz[0] := Neu_Teil;\nELSE\n  Ausgeworfen := 0;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;',
    () => 'IF Takt THEN\n  Ausgeworfen := Platz[5];\n  FOR i := 5 TO 1 BY -1 DO\n    Platz[i] := Platz[i - 1];\n  END_FOR;\n  Platz[0] := Neu_Teil;\nEND_IF;\nBelegt := 0;\nFOR i := 0 TO 5 DO\n  IF Platz[i] <> 0 THEN\n    Belegt := Belegt + 1;\n  END_IF;\nEND_FOR;'
  ]
});

defExamTask({ id:'x_scl_g_beladung', quest:'scl', level:'grund', ch:7, diff:2,
  params:{ KAP:[1000, 1200, 1500] },
  title:'Transportwagen beladen',
  brief: p => 'Ein Transportwagen trägt höchstens <b>' + p.KAP + ' kg</b>. Die Pakete in <code>Pakete</code> (Index 0 … 7, Int, kg) werden <b>der Reihe nach</b> geladen. Sobald ein Paket nicht mehr passt, endet das Laden — auch wenn spätere, leichtere Pakete noch passen würden.<br>• <code>Last</code>: geladenes Gesamtgewicht<br>• <code>Anzahl</code>: Anzahl geladener Pakete<br>• <code>Rest_Pakete</code>: Pakete, die stehen bleiben<br>Genau ' + p.KAP + ' kg sind erlaubt. Beende die Schleife mit <code>EXIT</code>.',
  vars: () => ({ Pakete:[0,0,0,0,0,0,0,0], Anzahl:0, Last:0, Rest_Pakete:0 }),
  must:['EXIT'],
  ref: p => 'Anzahl := 0;\nLast := 0;\nFOR i := 0 TO 7 DO\n  IF Last + Pakete[i] > ' + p.KAP + ' THEN\n    EXIT;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;',
  visible: p => { const a = [300, 400, 200, 500, 100, 100, 100, 100]; return [[{Pakete:a}, beladen(a, p.KAP)]]; },
  hidden: p => { const K = p.KAP; return [
    [K / 2, K / 2, 1, 1, 1, 1, 1, 1],
    [K + 1, 1, 1, 1, 1, 1, 1, 1],
    [100, 100, 100, 100, 100, 100, 100, 100],
    [K - 100, 200, 50, 50, 10, 10, 10, 10],
    [K - 1, 1, 1, 5, 5, 5, 5, 5],
    [10, 20, 30, 40, 50, 60, 70, K - 280]
  ].map((a, i) => [Object.assign({Pakete:a}, i % 2 ? {Anzahl:5, Last:300, Rest_Pakete:1} : {}), beladen(a, K)]); },
  wrong:[
    p => 'Anzahl := 0;\nLast := 0;\nFOR i := 0 TO 7 DO\n  IF Last + Pakete[i] > ' + p.KAP + ' THEN\n    CONTINUE;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;',
    p => 'Anzahl := 0;\nLast := 0;\nFOR i := 0 TO 7 DO\n  IF Last + Pakete[i] >= ' + p.KAP + ' THEN\n    EXIT;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;',
    p => 'FOR i := 0 TO 7 DO\n  IF Last + Pakete[i] > ' + p.KAP + ' THEN\n    EXIT;\n  END_IF;\n  Last := Last + Pakete[i];\n  Anzahl := Anzahl + 1;\nEND_FOR;\nRest_Pakete := 8 - Anzahl;'
  ]
});

defExamTask({ id:'x_scl_g_messreihe', quest:'scl', level:'grund', ch:7, diff:3,
  params:{ MAX:[150, 200, 250] },
  title:'Messreihe ohne Störimpulse',
  brief: p => 'Ein Temperaturfühler liefert acht Messungen (<code>Messung</code>, Index 0 … 7, Int). Werte <b>unter 0</b> oder <b>über ' + p.MAX + '</b> sind Störimpulse und werden mit <code>CONTINUE</code> übersprungen.<br>• <code>Summe</code> und <code>Gueltig</code>: Summe und Anzahl der gültigen Werte<br>• Bei <b>mindestens 3</b> gültigen Werten: <code>Mittel</code> (Real) = Summe / Gueltig <b>mit Nachkommastellen</b>, <code>Sensorfehler</code> = FALSE<br>• sonst: <code>Mittel</code> = 0.0 und <code>Sensorfehler</code> = TRUE',
  vars: () => ({ Messung:[0,0,0,0,0,0,0,0], Summe:0, Gueltig:0, Mittel:0, Sensorfehler:false }), types: () => ({ Mittel:'REAL' }),
  must:['FOR', 'CONTINUE'],
  ref: p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] > ' + p.MAX + ' THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig >= 3 THEN\n  Mittel := INT_TO_REAL(Summe) / INT_TO_REAL(Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;',
  visible: p => { const a = [20, 22, -1, 24, 26, 999, 21, 23]; return [[{Messung:a}, mittel(a, p.MAX)]]; },
  hidden: p => [
    [10, 11, 11, 10, 10, 10, 10, 10],
    [-5, 40, 41, p.MAX + 1, 42, -1, 60, 0],
    [p.MAX, p.MAX, 0, -1, -1, -1, -1, -1],
    [p.MAX, 5, 0, -1, -1, -1, -1, 7],
    [-1, -1, -1, -1, -1, -1, 50, 51],
    [-3, 1, 2, 2, 999, 1000, 2000, -7]
  ].map((a, i) => [Object.assign({Messung:a}, i % 2 ? {Summe:77, Gueltig:4, Mittel:3.5, Sensorfehler:i === 1} : {}), mittel(a, p.MAX)]),
  wrong:[
    p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] > ' + p.MAX + ' THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig >= 3 THEN\n  Mittel := INT_TO_REAL(Summe / Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;',
    p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] > ' + p.MAX + ' THEN\n    EXIT;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig >= 3 THEN\n  Mittel := INT_TO_REAL(Summe) / INT_TO_REAL(Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;',
    p => 'Summe := 0;\nGueltig := 0;\nFOR i := 0 TO 7 DO\n  IF Messung[i] < 0 OR Messung[i] >= ' + p.MAX + ' THEN\n    CONTINUE;\n  END_IF;\n  Summe := Summe + Messung[i];\n  Gueltig := Gueltig + 1;\nEND_FOR;\nIF Gueltig > 3 THEN\n  Mittel := INT_TO_REAL(Summe) / INT_TO_REAL(Gueltig);\n  Sensorfehler := FALSE;\nELSE\n  Mittel := 0.0;\n  Sensorfehler := TRUE;\nEND_IF;'
  ]
});

defExamTask({ id:'x_scl_g_durchlaufofen', quest:'scl', level:'grund', ch:8, diff:3, timed:true,
  params:{ N:[3, 4, 5] },
  title:'Teile im Durchlaufofen',
  brief: p => 'Im Durchlaufofen dürfen höchstens <b>' + p.N + '</b> Teile gleichzeitig sein.<br>• Jede <b>steigende</b> Flanke der Lichtschranke <code>Einlauf</code> (Instanz <code>Ein_Flanke</code>, R_TRIG) erhöht <code>Anzahl</code> um 1.<br>• Ein Teil hat den Ofen verlassen, wenn es die Lichtschranke <code>Auslauf</code> <b>wieder freigibt</b> (fallende Flanke, Instanz <code>Aus_Flanke</code>, F_TRIG): <code>Anzahl</code> um 1 verringern, aber nie unter 0.<br>• <code>Voll</code> ist TRUE, sobald <code>Anzahl</code> mindestens ' + p.N + ' ist; <code>Zufuhr_Frei</code> ist das Gegenteil von <code>Voll</code>.',
  vars: () => ({ Einlauf:false, Auslauf:false, Anzahl:0, Voll:false, Zufuhr_Frei:false }), fb: () => ({ Ein_Flanke:'R_TRIG', Aus_Flanke:'F_TRIG' }),
  must:['R_TRIG', 'F_TRIG'],
  ref: p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
  visible: () => [{ steps:[[0.1,{Einlauf:true},{Anzahl:1}],[0.1,{Einlauf:false},{Anzahl:1}],[0.1,{Auslauf:true},{Anzahl:1}],[0.1,{Auslauf:false},{Anzahl:0}]] }],
  hidden: p => {
    const fill = [];
    for(let i = 1; i <= p.N; i++) fill.push([0.1,{Einlauf:true},{Anzahl:i, Voll:i >= p.N, Zufuhr_Frei:i < p.N}], [0.1,{Einlauf:true},{Anzahl:i}], [0.1,{Einlauf:false},{Anzahl:i}]);
    return [
      { steps: fill },
      { setup:{Anzahl:2}, steps:[[0.1,{},{Anzahl:2}],[0.1,{Auslauf:true},{Anzahl:2}],[0.1,{Auslauf:true},{Anzahl:2}],[0.1,{Auslauf:false},{Anzahl:1}],[0.1,{},{Anzahl:1}],[0.1,{Auslauf:true},{Anzahl:1}],[0.1,{Auslauf:false},{Anzahl:0, Voll:false, Zufuhr_Frei:true}],[0.1,{Auslauf:true},{Anzahl:0}],[0.1,{Auslauf:false},{Anzahl:0}]] },
      { setup:{Anzahl:p.N - 1}, steps:[[0.1,{Einlauf:true, Auslauf:true},{Anzahl:p.N, Voll:true, Zufuhr_Frei:false}],[0.1,{Einlauf:false, Auslauf:false},{Anzahl:p.N - 1, Voll:false, Zufuhr_Frei:true}],[0.1,{Einlauf:true},{Anzahl:p.N, Voll:true}]] },
      { setup:{Anzahl:0, Voll:true, Zufuhr_Frei:false}, steps:[[0.1,{},{Anzahl:0, Voll:false, Zufuhr_Frei:true}]] }
    ];
  },
  wrong:[
    p => 'Ein_Flanke(CLK := Einlauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Auslauf AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
    p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := NOT Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
    p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl >= ' + p.N + ';\nZufuhr_Frei := NOT Voll;',
    p => 'Ein_Flanke(CLK := Einlauf);\nAus_Flanke(CLK := Auslauf);\nIF Ein_Flanke.Q THEN\n  Anzahl := Anzahl + 1;\nEND_IF;\nIF Aus_Flanke.Q AND Anzahl > 0 THEN\n  Anzahl := Anzahl - 1;\nEND_IF;\nVoll := Anzahl > ' + p.N + ';\nZufuhr_Frei := NOT Voll;'
  ]
});

defExamTask({ id:'x_scl_g_zellenlicht', quest:'scl', level:'grund', ch:9, diff:1, timed:true,
  params:{ T:[5, 10, 20] },
  title:'Zellenbeleuchtung mit Nachlauf',
  brief: p => 'Die Innenbeleuchtung der Zelle geht <b>sofort</b> an, wenn die Schutztür geöffnet wird (<code>Tuer_Offen</code>). Nach dem Schliessen bleibt <code>Licht</code> noch <b>' + p.T + ' s</b> an. Wird die Tür vorher wieder geöffnet, beginnt die Nachlaufzeit beim nächsten Schliessen von vorn.<br>Verwende die Instanz <code>Licht_Timer</code> (Typ TOF).',
  vars: () => ({ Tuer_Offen:false, Licht:false }), fb: () => ({ Licht_Timer:'TOF' }),
  must:['TOF'],
  ref: p => 'Licht_Timer(IN := Tuer_Offen, PT := T#' + p.T + 'S);\nLicht := Licht_Timer.Q;',
  visible: p => [{ steps:[[0,{Tuer_Offen:true},{Licht:true}],[1,{Tuer_Offen:false},{Licht:true}],[p.T,{},{Licht:false}]] }],
  hidden: p => [
    { steps:[[0,{},{Licht:false}],[0.1,{Tuer_Offen:true},{Licht:true}],[2,{Tuer_Offen:false},{Licht:true}],[p.T - 0.5,{},{Licht:true}],[0.5,{},{Licht:false}],[5,{},{Licht:false}]] },
    { steps:[[0,{Tuer_Offen:true},{Licht:true}],[0.1,{Tuer_Offen:false},{Licht:true}],[p.T - 1,{Tuer_Offen:true},{Licht:true}],[0.5,{Tuer_Offen:false},{Licht:true}],[p.T - 0.1,{},{Licht:true}],[0.1,{},{Licht:false}]] },
    { setup:{Licht:true}, steps:[[0.1,{},{Licht:false}],[3,{},{Licht:false}]] },
    { steps:[[0,{Tuer_Offen:true},{Licht:true}],[30,{},{Licht:true}],[0.1,{Tuer_Offen:false},{Licht:true}]] }
  ],
  wrong:[
    () => 'Licht := Tuer_Offen;',
    p => 'Licht_Timer(IN := Tuer_Offen, PT := T#' + p.T + 'MS);\nLicht := Licht_Timer.Q;',
    p => 'Licht_Timer(IN := Tuer_Offen, PT := T#' + (p.T / 2) + 'S);\nLicht := Licht_Timer.Q;'
  ]
});

defExamTask({ id:'x_scl_g_anlaufwarnung', quest:'scl', level:'grund', ch:9, diff:2, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Anlaufwarnung vor dem Bandstart',
  brief: p => 'Bevor das Band anläuft, warnt eine Hupe:<br>• <code>Betrieb</code> wird mit <code>Start</code> gesetzt und hält sich selbst; <code>Stopp</code> schaltet ab und hat Vorrang.<br>• Solange <code>Betrieb</code> aktiv ist, läuft <code>Warn_Timer</code> (TON, <b>' + p.T + ' s</b>).<br>• Während dieser Wartezeit ertönt <code>Hupe</code>; danach ist die Hupe aus und <code>Band</code> läuft.<br>• Ohne Betrieb sind Hupe und Band aus.',
  vars: () => ({ Start:false, Stopp:false, Betrieb:false, Hupe:false, Band:false }), fb: () => ({ Warn_Timer:'TON' }),
  must:['TON'],
  ref: p => 'Betrieb := (Start OR Betrieb) AND NOT Stopp;\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb AND NOT Warn_Timer.Q;\nBand := Warn_Timer.Q;',
  visible: p => [{ steps:[[0,{Start:true},{Hupe:true, Band:false}],[0.1,{Start:false},{Hupe:true}],[p.T,{},{Hupe:false, Band:true}]] }],
  hidden: p => [
    { steps:[[0,{Start:true},{Betrieb:true, Hupe:true, Band:false}],[0.1,{Start:false},{Hupe:true}],[p.T - 0.2,{},{Hupe:true, Band:false}],[0.1,{},{Hupe:false, Band:true}],[1,{},{Band:true, Hupe:false}],[0.1,{Stopp:true},{Betrieb:false, Hupe:false, Band:false}],[0.1,{Stopp:false},{Betrieb:false, Hupe:false, Band:false}]] },
    { steps:[[0,{Start:true},{Hupe:true}],[1,{Start:false, Stopp:true},{Hupe:false, Band:false}],[0.1,{Stopp:false, Start:true},{Hupe:true}],[p.T - 0.1,{Start:false},{Hupe:true, Band:false}],[0.1,{},{Band:true, Hupe:false}]] },
    { steps:[[0,{Start:true, Stopp:true},{Betrieb:false, Hupe:false}],[0.1,{Start:false, Stopp:false},{Betrieb:false}],[p.T + 1,{},{Band:false, Hupe:false}]] },
    { setup:{Band:true, Hupe:true}, steps:[[0.1,{},{Band:false, Hupe:false}]] }
  ],
  wrong:[
    p => 'Betrieb := Start AND NOT Stopp;\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb AND NOT Warn_Timer.Q;\nBand := Warn_Timer.Q;',
    p => 'Betrieb := (Start OR Betrieb) AND NOT Stopp;\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb;\nBand := Warn_Timer.Q;',
    p => 'Betrieb := Start OR (Betrieb AND NOT Stopp);\nWarn_Timer(IN := Betrieb, PT := T#' + p.T + 'S);\nHupe := Betrieb AND NOT Warn_Timer.Q;\nBand := Warn_Timer.Q;'
  ]
});

const HUB_REF = 'CASE Schritt OF\n  0:\n    IF Teil_Da AND Unten THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Oben THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF NOT Teil_Da THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    IF Unten THEN\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nHub_Auf := Schritt = 1;\nHub_Ab := Schritt = 3;\nLampe_Bereit := Schritt = 0;';
defExamTask({ id:'x_scl_g_hubtisch', quest:'scl', level:'grund', ch:10, diff:2, timed:true,
  title:'Schrittkette Hubtisch',
  brief: () => 'Programmiere die Schrittkette des Hubtischs mit <code>CASE Schritt OF</code>:<br>• <b>0 Warten</b>: liegt ein Teil auf (<code>Teil_Da</code>) <b>und</b> ist der Tisch unten (<code>Unten</code>) → Schritt 1<br>• <b>1 Heben</b>: sobald <code>Oben</code> → Schritt 2<br>• <b>2 Übergabe</b>: sobald das Teil entnommen ist (<code>Teil_Da</code> = FALSE) → Schritt 3<br>• <b>3 Senken</b>: sobald <code>Unten</code> → Schritt 0<br>Leite die Ausgänge <b>nach</b> dem CASE aus dem Schritt ab: <code>Hub_Auf</code> nur in Schritt 1, <code>Hub_Ab</code> nur in Schritt 3, <code>Lampe_Bereit</code> nur in Schritt 0.',
  vars: () => ({ Schritt:0, Teil_Da:false, Unten:false, Oben:false, Hub_Auf:false, Hub_Ab:false, Lampe_Bereit:false }),
  must:['CASE'],
  ref: () => HUB_REF,
  visible: () => [{ steps:[[0.1,{Unten:true, Teil_Da:true},{Schritt:1, Hub_Auf:true}],[0.1,{Unten:false, Oben:true},{Schritt:2, Hub_Auf:false}]] }],
  hidden: () => [
    { steps:[[0.1,{Unten:true},{Schritt:0, Lampe_Bereit:true, Hub_Auf:false}],[0.1,{Teil_Da:true},{Schritt:1, Hub_Auf:true, Lampe_Bereit:false}],[0.1,{Unten:false},{Schritt:1, Hub_Auf:true}],[0.1,{Oben:true},{Schritt:2, Hub_Auf:false, Hub_Ab:false}],[0.1,{},{Schritt:2}],[0.1,{Teil_Da:false},{Schritt:3, Hub_Ab:true}],[0.1,{Oben:false},{Schritt:3, Hub_Ab:true}],[0.1,{Unten:true},{Schritt:0, Hub_Ab:false, Lampe_Bereit:true}]] },
    { steps:[[0.1,{Teil_Da:true},{Schritt:0}],[0.1,{},{Schritt:0, Hub_Auf:false}],[0.1,{Unten:true},{Schritt:1, Hub_Auf:true}]] },
    { setup:{Schritt:2, Hub_Auf:true, Teil_Da:true, Oben:true}, steps:[[0.1,{},{Schritt:2, Hub_Auf:false, Lampe_Bereit:false}],[0.1,{Teil_Da:false},{Schritt:3, Hub_Ab:true}]] },
    { setup:{Schritt:3, Unten:true, Hub_Ab:true}, steps:[[0.1,{},{Schritt:0, Lampe_Bereit:true, Hub_Ab:false}],[0.1,{},{Schritt:0}]] }
  ],
  wrong:[
    () => HUB_REF.replace('  1:\n    IF Oben', '  1:\n    Hub_Auf := TRUE;\n    IF Oben').replace('Hub_Auf := Schritt = 1;\n', ''),
    () => HUB_REF.replace('IF Teil_Da AND Unten THEN', 'IF Teil_Da THEN'),
    () => HUB_REF.replace('IF NOT Teil_Da THEN', 'IF Teil_Da THEN')
  ]
});

const BOHR = p => 'Bohr_Timer(IN := Schritt = 2, PT := T#' + p.T + 'S);\nCASE Schritt OF\n  0:\n    IF Start AND Teil_Da THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    IF Gespannt THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    IF Bohr_Timer.Q THEN\n      Schritt := 3;\n    END_IF;\n  3:\n    IF NOT Gespannt THEN\n      Stueck := Stueck + 1;\n      Schritt := 0;\n    END_IF;\nEND_CASE;\nSpanner := Schritt = 1 OR Schritt = 2;\nBohrer := Schritt = 2;';
defExamTask({ id:'x_scl_g_bohrstation', quest:'scl', level:'grund', ch:10, diff:3, timed:true,
  params:{ T:[2, 3, 4] },
  title:'Schrittkette Bohrstation',
  brief: p => 'Programmiere die Bohrstation als Schrittkette (<code>CASE Schritt OF</code>):<br>• <b>0 Grundstellung</b>: <code>Start</code> <b>und</b> <code>Teil_Da</code> → 1<br>• <b>1 Spannen</b>: sobald <code>Gespannt</code> → 2<br>• <b>2 Bohren</b>: nach <b>' + p.T + ' s</b> Bohrzeit → 3 (Instanz <code>Bohr_Timer</code>, TON)<br>• <b>3 Lösen</b>: sobald <code>Gespannt</code> = FALSE → <code>Stueck</code> um 1 erhöhen und → 0<br>Ausgänge nach dem CASE: <code>Spanner</code> in Schritt 1 und 2, <code>Bohrer</code> nur in Schritt 2.<br>Rufe den Timer in jedem Zyklus <b>vor</b> dem CASE auf: <code>IN := Schritt = 2</code>.',
  vars: () => ({ Schritt:0, Start:false, Teil_Da:false, Gespannt:false, Spanner:false, Bohrer:false, Stueck:0 }), fb: () => ({ Bohr_Timer:'TON' }),
  must:['CASE', 'TON'],
  ref: BOHR,
  visible: p => [{ setup:{Teil_Da:true}, steps:[[0.1,{Start:true},{Schritt:1, Spanner:true}],[0.1,{Start:false, Gespannt:true},{Schritt:2, Bohrer:true}],[0.1,{},{Schritt:2}],[p.T,{},{Schritt:3, Bohrer:false}]] }],
  hidden: p => [
    { steps:[[0.1,{Teil_Da:true},{Schritt:0}],[0.1,{Start:true},{Schritt:1, Spanner:true, Bohrer:false}],[0.1,{Start:false, Gespannt:true},{Schritt:2, Spanner:true, Bohrer:true}],[0.1,{},{Schritt:2}],[p.T - 0.2,{},{Schritt:2, Bohrer:true}],[0.1,{},{Schritt:2}],[0.1,{},{Schritt:3, Bohrer:false, Spanner:false}],[0.1,{},{Schritt:3, Stueck:0}],[0.1,{Gespannt:false},{Schritt:0, Stueck:1}],[0.1,{},{Schritt:0, Stueck:1}],
      [0.1,{Start:true},{Schritt:1}],[0.1,{Start:false, Gespannt:true},{Schritt:2}],[0.1,{},{Schritt:2}],[0.1,{},{Schritt:2, Bohrer:true}],[p.T - 0.1,{},{Schritt:3}],[0.1,{Gespannt:false},{Schritt:0, Stueck:2}]] },
    { steps:[[0.1,{Start:true},{Schritt:0, Spanner:false}],[0.1,{Teil_Da:true},{Schritt:1}]] },
    { setup:{Schritt:3, Gespannt:true, Stueck:5}, steps:[[0.1,{},{Schritt:3, Stueck:5, Spanner:false}],[0.1,{},{Stueck:5}],[0.1,{Gespannt:false},{Stueck:6, Schritt:0}]] },
    { setup:{Schritt:2, Gespannt:true}, steps:[[0.1,{},{Schritt:2, Spanner:true, Bohrer:true}],[p.T - 0.1,{},{Schritt:2}],[0.1,{},{Schritt:3}]] }
  ],
  wrong:[
    p => BOHR(p).replace('Bohr_Timer(IN := Schritt = 2, PT := T#' + p.T + 'S);\n', '').replace('  2:\n    IF Bohr_Timer.Q', '  2:\n    Bohr_Timer(IN := TRUE, PT := T#' + p.T + 'S);\n    IF Bohr_Timer.Q'),
    p => BOHR(p).replace('  3:\n    IF NOT Gespannt THEN\n      Stueck := Stueck + 1;\n', '  3:\n    Stueck := Stueck + 1;\n    IF NOT Gespannt THEN\n'),
    p => BOHR(p).replace('Spanner := Schritt = 1 OR Schritt = 2;', 'Spanner := Schritt >= 1;')
  ]
});

/* ---------- Profi-Stufe ---------- */
const BEGRENZ_HEAD = 'FUNCTION "FC_Begrenzen" : Int\nVAR_INPUT\n   Wert : Int;\n   Min : Int;\n   Max : Int;\nEND_VAR\nVAR_OUTPUT\n   Begrenzt : Bool;\nEND_VAR\n';
defExamTask({ id:'x_scl_p_begrenzen', quest:'scl', level:'profi', ch:12, diff:1,
  params:{ LO:[0, 10, 20], HI:[100, 150, 200] },
  title:'Sollwert begrenzen (FC)',
  brief: p => 'Schreibe den Rumpf der Funktion <code>FC_Begrenzen</code>: Sie liefert <code>Wert</code>, begrenzt auf den Bereich <code>Min</code> … <code>Max</code>. Der Ausgang <code>Begrenzt</code> ist TRUE, wenn der Wert abgeschnitten wurde. Der OB <code>Main</code> (🔒) begrenzt <code>"Soll"</code> auf ' + p.LO + ' … ' + p.HI + '.',
  blocks: p => [
    { name:'FC_Begrenzen', kind:'FC', edit:true, start: BEGRENZ_HEAD + 'BEGIN\n\nEND_FUNCTION',
      ref: BEGRENZ_HEAD + 'BEGIN\n   IF #Wert < #Min THEN\n      #FC_Begrenzen := #Min;\n      #Begrenzt := TRUE;\n   ELSIF #Wert > #Max THEN\n      #FC_Begrenzen := #Max;\n      #Begrenzt := TRUE;\n   ELSE\n      #FC_Begrenzen := #Wert;\n      #Begrenzt := FALSE;\n   END_IF;\nEND_FUNCTION' },
    { name:'Main', kind:'OB', src: MAIN('   "Soll_Begrenzt" := "FC_Begrenzen"(Wert := "Soll", Min := ' + p.LO + ', Max := ' + p.HI + ', Begrenzt => "Grenze_Aktiv");') }
  ],
  globals: () => ({ Soll:0, Soll_Begrenzt:0, Grenze_Aktiv:false }),
  must:['FC'], warnFree:['RET_NOT_SET', 'OUT_NOT_ALL_PATHS'],
  visible: p => ({ unit:[{ block:'FC_Begrenzen', steps:[[{Wert:50, Min:0, Max:100},{RET:50, Begrenzt:false}]] }], tests:[[{Soll:p.HI + 30},{Soll_Begrenzt:p.HI, Grenze_Aktiv:true}]] }),
  hidden: p => ({
    unit:[{ block:'FC_Begrenzen', steps:[[{Wert:-5, Min:0, Max:100},{RET:0, Begrenzt:true}],[{Wert:0, Min:0, Max:100},{RET:0, Begrenzt:false}],[{Wert:100, Min:0, Max:100},{RET:100, Begrenzt:false}],[{Wert:101, Min:0, Max:100},{RET:100, Begrenzt:true}],[{Wert:7, Min:-10, Max:10},{RET:7, Begrenzt:false}]] }],
    tests:[[{Soll:p.LO - 1},{Soll_Begrenzt:p.LO, Grenze_Aktiv:true}],[{Soll:p.LO},{Soll_Begrenzt:p.LO, Grenze_Aktiv:false}],[{Soll:p.HI},{Soll_Begrenzt:p.HI, Grenze_Aktiv:false}],[{Soll:p.HI + 1},{Soll_Begrenzt:p.HI, Grenze_Aktiv:true}],[{Soll:(p.LO + p.HI) >> 1},{Soll_Begrenzt:(p.LO + p.HI) >> 1, Grenze_Aktiv:false}]]
  }),
  wrong:[
    () => ({ FC_Begrenzen: BEGRENZ_HEAD + 'BEGIN\n   IF #Wert <= #Min THEN\n      #FC_Begrenzen := #Min;\n      #Begrenzt := TRUE;\n   ELSIF #Wert >= #Max THEN\n      #FC_Begrenzen := #Max;\n      #Begrenzt := TRUE;\n   ELSE\n      #FC_Begrenzen := #Wert;\n      #Begrenzt := FALSE;\n   END_IF;\nEND_FUNCTION' }),
    () => ({ FC_Begrenzen: BEGRENZ_HEAD + 'BEGIN\n   #FC_Begrenzen := #Wert;\n   #Begrenzt := FALSE;\n   IF #Wert > #Max THEN\n      #FC_Begrenzen := #Max;\n      #Begrenzt := TRUE;\n   END_IF;\nEND_FUNCTION' })
  ]
});

/* ---------- Profi-Stufe: weitere Aufgaben ---------- */
function puls(sig, n, expFn){ const o = []; for(let i = 1; i <= n; i++){ o.push([0.1, {[sig]: true}, expFn ? expFn(i) : {}]); o.push([0.1, {[sig]: false}, {}]); } return o; }

// ----- Kapitel 11: Deklaration nach vorgegebenem Code -----
const TANK_BODY = 'BEGIN\n   #Fuellstand := INT_TO_REAL(#Rohwert) / 27648.0 * 100.0;\n   #Voll := #Fuellstand >= #GRENZE_VOLL;\n   #Pumpe := #Freigabe AND NOT #Voll;\nEND_FUNCTION_BLOCK';
const TANK_DECL = (g, o) => { o = o || {};
  return 'FUNCTION_BLOCK "FB_Tank"\nVAR_INPUT\n   Rohwert : ' + (o.roh || 'Int') + ';      // Analogwert 0…27648\n   Freigabe : Bool;\nEND_VAR\nVAR_OUTPUT\n   Fuellstand : ' + (o.fs || 'Real') + ';   // Prozent\n' + (o.vollStat ? '' : '   Voll : Bool;\n') + '   Pumpe : Bool;\nEND_VAR\n' + (o.vollStat ? 'VAR\n   Voll : Bool;\nEND_VAR\n' : '') + 'VAR CONSTANT\n   GRENZE_VOLL : Real := ' + g + '.0;\nEND_VAR\n'; };
const pct = r => r / 27648 * 100;
defExamTask({ id:'x_scl_p_tank', quest:'scl', level:'profi', ch:11, diff:1,
  params:{ G:[80, 85, 90] },
  title:'Schnittstelle des Tankbausteins',
  brief: p => 'Der Code von <code>FB_Tank</code> ist fertig. Schreibe die <b>Deklaration</b> vor <code>BEGIN</code>:<br>• Eingänge: <code>Rohwert</code> (ganzzahliger Analogwert 0 … 27648), <code>Freigabe</code> (ja/nein)<br>• Ausgänge: <code>Fuellstand</code> (Kommazahl in %), <code>Voll</code> und <code>Pumpe</code> (ja/nein)<br>• Konstante: <code>GRENZE_VOLL</code> = <b>' + p.G + '.0</b> % (Kommazahl)<br><code>Main</code> (🔒) ruft den FB mit <code>"Tank_Roh"</code> und <code>"Pumpe_Frei"</code> auf.',
  blocks: p => [
    { name:'FB_Tank', kind:'FB', edit:true, start:'FUNCTION_BLOCK "FB_Tank"\n// Eingänge:  Rohwert, Freigabe\n// Ausgänge:  Fuellstand, Voll, Pumpe\n// Konstante: GRENZE_VOLL\n\n' + TANK_BODY, ref: TANK_DECL(p.G) + TANK_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Tank_DB"(Rohwert := "Tank_Roh", Freigabe := "Pumpe_Frei", Fuellstand => "Tank_Prozent", Voll => "Tank_Voll", Pumpe => "Pumpe_Ein");') }
  ],
  globals: () => ({ Tank_Roh:0, Pumpe_Frei:false, Tank_Prozent:0, Tank_Voll:false, Pumpe_Ein:false }), types: () => ({ Tank_Roh:'INT', Tank_Prozent:'REAL' }),
  must:['VAR_INPUT', 'VAR_OUTPUT', 'VAR_CONSTANT', 'REAL'],
  visible: () => ({ tests:[[{Tank_Roh:13824, Pumpe_Frei:true},{Tank_Prozent:50, Tank_Voll:false, Pumpe_Ein:true}]] }),
  hidden: p => { const hi = Math.ceil(p.G * 276.48); return {
    unit:[{ block:'FB_Tank', steps:[[{Rohwert:0, Freigabe:true},{Fuellstand:0, Voll:false, Pumpe:true}],[{Rohwert:hi - 1},{Fuellstand:pct(hi - 1), Voll:false, Pumpe:true}],[{Rohwert:hi},{Fuellstand:pct(hi), Voll:true, Pumpe:false}],[{Rohwert:27648},{Fuellstand:100, Voll:true, Pumpe:false}],[{Rohwert:6912, Freigabe:false},{Fuellstand:25, Voll:false, Pumpe:false}]] }],
    tests:[[{Tank_Roh:hi, Pumpe_Frei:true},{Tank_Prozent:pct(hi), Tank_Voll:true, Pumpe_Ein:false}],[{Tank_Roh:hi - 1, Pumpe_Frei:true},{Tank_Voll:false, Pumpe_Ein:true}],[{Tank_Roh:20736, Pumpe_Frei:false},{Tank_Prozent:75, Pumpe_Ein:false}]]
  }; },
  wrong:[
    p => ({ FB_Tank: TANK_DECL(p.G, {roh:'Real'}) + TANK_BODY }),
    p => ({ FB_Tank: TANK_DECL(p.G, {fs:'Int'}) + TANK_BODY }),
    p => ({ FB_Tank: TANK_DECL(p.G, {vollStat:true}) + TANK_BODY })
  ]
});

// ----- Kapitel 11: statische Variable, DInt -----
const HUB_HEAD = p => 'FUNCTION_BLOCK "FB_Hubzaehler"\nVAR_INPUT\n   Hub : Bool;       // Endschalter: Presse unten\n   Reset : Bool;     // nach der Wartung\nEND_VAR\nVAR_OUTPUT\n   Hubzahl : DInt;\n   Wartung : Bool;\nEND_VAR\nVAR CONSTANT\n   INTERVALL : DInt := ' + p.P + ';\nEND_VAR\n';
const HUB_BODY = 'BEGIN\n   IF #Hub AND NOT #Hub_alt THEN\n      #Zaehler := #Zaehler + 1;\n   END_IF;\n   #Hub_alt := #Hub;\n   IF #Reset THEN\n      #Zaehler := 0;\n   END_IF;\n   #Hubzahl := #Zaehler;\n   #Wartung := #Zaehler >= #INTERVALL;\nEND_FUNCTION_BLOCK';
defExamTask({ id:'x_scl_p_hubzaehler', quest:'scl', level:'profi', ch:11, diff:2,
  params:{ P:[40000, 50000, 60000] },
  title:'Hubzähler der Presse',
  brief: p => 'Die Presse braucht nach <b>' + p.P + '</b> Hüben eine Wartung. Ergänze <code>FB_Hubzaehler</code>:<br>• Lege die <b>statischen</b> Variablen <code>Zaehler</code> und <code>Hub_alt</code> an — wähle einen Typ, der bis ' + p.P + ' und weiter zählen kann.<br>• Jede <b>steigende Flanke</b> von <code>Hub</code> erhöht <code>Zaehler</code> um 1 (<code>Hub_alt</code> merkt sich <code>Hub</code> aus dem letzten Zyklus).<br>• <code>Reset</code> setzt <code>Zaehler</code> auf 0.<br>• <code>Hubzahl</code> = <code>Zaehler</code>; <code>Wartung</code> ist TRUE, sobald <code>Zaehler</code> ≥ <code>INTERVALL</code>.<br><code>Main</code> (🔒) ruft die Instanz <code>"Presse_Hub"</code> auf.',
  blocks: p => [
    { name:'FB_Hubzaehler', kind:'FB', edit:true, start: HUB_HEAD(p) + 'VAR\n   // TODO: Zaehler, Hub_alt\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK',
      ref: HUB_HEAD(p) + 'VAR\n   Zaehler : DInt;   // Hübe seit der letzten Wartung\n   Hub_alt : Bool;   // Hub im letzten Zyklus\nEND_VAR\n' + HUB_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Presse_Hub"(Hub := "S_Hub", Reset := "S_Reset", Hubzahl => "Hubzahl", Wartung => "H_Wartung");') }
  ],
  instances: () => ({ Presse_Hub:'FB_Hubzaehler' }),
  globals: () => ({ S_Hub:false, S_Reset:false, Hubzahl:0, H_Wartung:false }), types: () => ({ Hubzahl:'DINT' }),
  must:['STAT', 'DINT'], warnFree:['TEMP_READ_BEFORE_WRITE'],
  visible: () => ({ timed:[{ steps:[[0.1,{S_Hub:true},{Hubzahl:1}],[0.1,{S_Hub:true},{Hubzahl:1}],[0.1,{S_Hub:false},{Hubzahl:1}],[0.1,{S_Hub:true},{Hubzahl:2, H_Wartung:false}]] }] }),
  hidden: p => ({
    unit:[
      { block:'FB_Hubzaehler', setup:{Zaehler:32766}, steps: puls('Hub', 3, i => ({Hubzahl:32766 + i, Wartung:false})) },
      { block:'FB_Hubzaehler', setup:{Zaehler:p.P - 2}, steps:[[0.1,{Hub:true},{Hubzahl:p.P - 1, Wartung:false}],[0.1,{Hub:false},{Wartung:false}],[0.1,{Hub:true},{Hubzahl:p.P, Wartung:true}],[0.1,{Hub:true},{Hubzahl:p.P}],[0.1,{Hub:false, Reset:true},{Hubzahl:0, Wartung:false}],[0.1,{Reset:false, Hub:true},{Hubzahl:1}]] }
    ],
    timed:[{ steps:[[0.1,{},{Hubzahl:0, H_Wartung:false}]].concat(puls('S_Hub', 4, i => ({Hubzahl:i}))).concat([[0.1,{S_Reset:true},{Hubzahl:0}],[0.1,{S_Reset:false, S_Hub:true},{Hubzahl:1}]]) }]
  }),
  wrong:[
    p => ({ FB_Hubzaehler: HUB_HEAD(p) + 'VAR\n   Zaehler : Int;\n   Hub_alt : Bool;\nEND_VAR\n' + HUB_BODY }),
    p => ({ FB_Hubzaehler: HUB_HEAD(p) + 'VAR\n   Hub_alt : Bool;\nEND_VAR\nVAR_TEMP\n   Zaehler : DInt;\nEND_VAR\n' + HUB_BODY }),
    p => ({ FB_Hubzaehler: HUB_HEAD(p) + 'VAR\n   Zaehler : DInt;\n   Hub_alt : Bool;\nEND_VAR\n' + HUB_BODY.replace('IF #Hub AND NOT #Hub_alt THEN', 'IF #Hub THEN') })
  ]
});

// ----- Kapitel 12: IN_OUT -----
const RAMPE_HEAD = io => 'FUNCTION "FC_Rampe" : Void\nVAR_INPUT\n   Soll : Int;       // Zieldrehzahl\n   Schritt : Int;    // grösste Änderung pro Aufruf\n' + (io === 'in' ? '   Ist : Int;\n' : '') + 'END_VAR\nVAR_OUTPUT\n   Erreicht : Bool;\nEND_VAR\n' + (io === 'in' ? '' : 'VAR_IN_OUT\n   Ist : Int;        // aktuelle Drehzahl, wird verändert\nEND_VAR\n');
const RAMPE_BODY = 'BEGIN\n   IF #Ist < #Soll THEN\n      #Ist := MIN(IN1 := #Ist + #Schritt, IN2 := #Soll);\n   ELSIF #Ist > #Soll THEN\n      #Ist := MAX(IN1 := #Ist - #Schritt, IN2 := #Soll);\n   END_IF;\n   #Erreicht := #Ist = #Soll;\nEND_FUNCTION';
defExamTask({ id:'x_scl_p_rampe', quest:'scl', level:'profi', ch:12, diff:2,
  params:{ S:[5, 10, 25] },
  title:'Drehzahlrampe (IN_OUT)',
  brief: p => '<code>FC_Rampe</code> führt die Drehzahl <code>Ist</code> schrittweise an <code>Soll</code> heran — pro Aufruf um höchstens <code>Schritt</code>, ohne über das Ziel hinauszuschiessen.<br>• Ergänze den Parameter <code>Ist</code> (Int). Die FC muss den Wert des Aufrufers <b>lesen und verändern</b> — wähle den passenden Bereich.<br>• Ist &lt; Soll: um <code>Schritt</code> erhöhen, höchstens bis <code>Soll</code>; Ist &gt; Soll: entsprechend verringern.<br>• <code>Erreicht</code> ist TRUE, wenn nach der Änderung <code>Ist</code> = <code>Soll</code> ist.<br><code>Main</code> (🔒) ruft die FC in jedem Zyklus mit <code>"Drehzahl"</code> und <code>Schritt := ' + p.S + '</code> auf.',
  blocks: p => [
    { name:'FC_Rampe', kind:'FC', edit:true, start: RAMPE_HEAD('none') .replace('VAR_IN_OUT\n   Ist : Int;        // aktuelle Drehzahl, wird verändert\nEND_VAR\n', '// TODO: Parameter Ist\n') + 'BEGIN\n   \nEND_FUNCTION', ref: RAMPE_HEAD('io') + RAMPE_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Rampe"(Soll := "Drehzahl_Soll", Schritt := ' + p.S + ', Erreicht => "Drehzahl_OK", Ist := "Drehzahl");') }
  ],
  globals: () => ({ Drehzahl:0, Drehzahl_Soll:0, Drehzahl_OK:false }),
  must:['FC', 'VAR_IN_OUT'], warnFree:['OUT_NOT_ALL_PATHS'],
  visible: p => ({ unit:[{ block:'FC_Rampe', steps:[[{Ist:0, Soll:100, Schritt:10},{Ist:10, Erreicht:false}],[{},{Ist:20}]] }] }),
  hidden: p => { const S = p.S; return {
    unit:[{ block:'FC_Rampe', steps:[[{Ist:95, Soll:100, Schritt:10},{Ist:100, Erreicht:true}],[{},{Ist:100, Erreicht:true}],[{Soll:70},{Ist:90, Erreicht:false}],[{},{Ist:80}],[{},{Ist:70, Erreicht:true}],[{Soll:-5, Schritt:100},{Ist:-5, Erreicht:true}]] }],
    timed:[
      { setup:{Drehzahl_Soll:3 * S + 2}, steps:[[0.1,{},{Drehzahl:S, Drehzahl_OK:false}],[0.1,{},{Drehzahl:2 * S}],[0.1,{},{Drehzahl:3 * S, Drehzahl_OK:false}],[0.1,{},{Drehzahl:3 * S + 2, Drehzahl_OK:true}],[0.1,{},{Drehzahl:3 * S + 2, Drehzahl_OK:true}]] },
      { setup:{Drehzahl:2 * S, Drehzahl_Soll:0}, steps:[[0.1,{},{Drehzahl:S}],[0.1,{},{Drehzahl:0, Drehzahl_OK:true}],[0.1,{Drehzahl_Soll:S},{Drehzahl:S, Drehzahl_OK:true}]] }
    ]
  }; },
  wrong:[
    () => ({ FC_Rampe: RAMPE_HEAD('in') + RAMPE_BODY }),
    () => ({ FC_Rampe: RAMPE_HEAD('io') + 'BEGIN\n   IF #Ist < #Soll THEN\n      #Ist := #Ist + #Schritt;\n   ELSIF #Ist > #Soll THEN\n      #Ist := #Ist - #Schritt;\n   END_IF;\n   #Erreicht := #Ist = #Soll;\nEND_FUNCTION' }),
    () => ({ FC_Rampe: RAMPE_HEAD('io') + 'BEGIN\n   #Erreicht := #Ist = #Soll;\n   IF #Ist < #Soll THEN\n      #Ist := MIN(IN1 := #Ist + #Schritt, IN2 := #Soll);\n   ELSIF #Ist > #Soll THEN\n      #Ist := MAX(IN1 := #Ist - #Schritt, IN2 := #Soll);\n   END_IF;\nEND_FUNCTION' })
  ]
});

// ----- Kapitel 12: FC mit Array, Rückgabewert und Ausgängen -----
const STAT_HEAD = 'FUNCTION "FC_Statistik" : Bool\nVAR_INPUT\n   Toleranz : Real;   // erlaubte Spanne\nEND_VAR\nVAR_OUTPUT\n   Min : Real;\n   Max : Real;\n   Mittel : Real;\nEND_VAR\nVAR_IN_OUT\n   Werte : Array[1..6] of Real;\nEND_VAR\nVAR_TEMP\n   i : Int;\n   Summe : Real;\nEND_VAR\n';
const STAT_REF = STAT_HEAD + 'BEGIN\n   #Min := #Werte[1];\n   #Max := #Werte[1];\n   #Summe := 0.0;\n   FOR #i := 1 TO 6 DO\n      IF #Werte[#i] < #Min THEN\n         #Min := #Werte[#i];\n      END_IF;\n      IF #Werte[#i] > #Max THEN\n         #Max := #Werte[#i];\n      END_IF;\n      #Summe := #Summe + #Werte[#i];\n   END_FOR;\n   #Mittel := #Summe / 6.0;\n   #FC_Statistik := #Max - #Min <= #Toleranz;\nEND_FUNCTION';
const stat = (w, tol) => { const mn = Math.min(...w), mx = Math.max(...w); return { Min:mn, Max:mx, Mittel:w.reduce((a, b) => a + b, 0) / 6, RET:mx - mn <= tol }; };
defExamTask({ id:'x_scl_p_statistik', quest:'scl', level:'profi', ch:12, diff:3,
  params:{ TOL:[0.5, 1.0, 2.0] },
  title:'Messreihe auswerten (FC)',
  brief: p => 'Die Schnittstelle von <code>FC_Statistik</code> steht. Schreibe den Code für die sechs Werte <code>Werte[1]</code> … <code>Werte[6]</code>:<br>• <code>Min</code>, <code>Max</code>: kleinster und grösster Wert (Startwert: <code>Werte[1]</code>)<br>• <code>Mittel</code>: Durchschnitt aller sechs Werte<br>• Rückgabewert: TRUE (Messung stabil), wenn <code>Max − Min</code> höchstens <code>Toleranz</code> beträgt<br>Alle Ausgänge und der Rückgabewert müssen in jedem Aufruf gesetzt werden. <code>Main</code> (🔒) übergibt <code>"Messreihe"</code> mit <code>Toleranz := ' + p.TOL.toFixed(1) + '</code>.',
  blocks: p => [
    { name:'FC_Statistik', kind:'FC', edit:true, start: STAT_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: STAT_REF },
    { name:'Main', kind:'OB', src: MAIN('   "Stabil" := "FC_Statistik"(Toleranz := ' + p.TOL.toFixed(1) + ', Min => "Min_Wert", Max => "Max_Wert", Mittel => "Mittelwert", Werte := "Messreihe");') }
  ],
  globals: () => ({ Messreihe:[0,0,0,0,0,0], Stabil:false, Min_Wert:0, Max_Wert:0, Mittelwert:0 }),
  types: () => ({ Messreihe:'ARRAY[1..6] OF REAL', Min_Wert:'REAL', Max_Wert:'REAL', Mittelwert:'REAL' }),
  must:['FOR', 'RETVAL'], warnFree:['RET_NOT_SET', 'OUT_NOT_ALL_PATHS', 'TEMP_READ_BEFORE_WRITE'],
  visible: p => { const w = [20.0, 20.5, 21.0, 20.0, 20.5, 21.0]; return { unit:[{ block:'FC_Statistik', steps:[[{Werte:w, Toleranz:2.0}, stat(w, 2.0)]] }] }; },
  hidden: p => { const T = p.TOL;
    const sets = [[50.0, 50.0 + T, 50.25, 50.5, 50.0, 50.0], [50.0, 50.0 + T + 0.25, 50.0, 50.0, 50.0, 50.0], [80.0, 81.0, 82.0, 83.0, 84.0, 85.0], [-3.0, -1.5, -2.0, -2.5, -1.0, -2.0], [7.0, 7.0, 7.0, 7.0, 7.0, 7.0], [10.0, 10.0, 10.0, 10.0, 10.0, 4.0]];
    return { unit: [sets.slice(0, 3), sets.slice(3)].map(g => ({ block:'FC_Statistik', steps: g.map(w => [{Werte:w, Toleranz:T}, stat(w, T)]) })),
      tests:[[{Messreihe:sets[0]},{Stabil:true, Min_Wert:50, Max_Wert:50 + T}],[{Messreihe:sets[2], Stabil:true},{Stabil:false, Mittelwert:82.5}]] }; },
  wrong:[
    () => ({ FC_Statistik: STAT_REF.replace('#Min := #Werte[1];', '#Min := 0.0;') }),
    () => ({ FC_Statistik: STAT_REF.replace('FOR #i := 1 TO 6 DO', 'FOR #i := 1 TO 5 DO') }),
    () => ({ FC_Statistik: STAT_REF.replace('#Max - #Min <= #Toleranz', '#Max - #Min < #Toleranz') })
  ]
});

// ----- Kapitel 13: Einzelinstanzen -----
const FBZ = 'FUNCTION_BLOCK "FB_Zaehler"\nVAR_INPUT\n   Teil : Bool;\n   Max : Int;\n   Reset : Bool;\nEND_VAR\nVAR_OUTPUT\n   Anzahl : Int;\n   Voll : Bool;\nEND_VAR\nVAR\n   Merker : Bool;\nEND_VAR\nBEGIN\n   IF #Teil AND NOT #Merker AND #Anzahl < #Max THEN\n      #Anzahl := #Anzahl + 1;\n   END_IF;\n   #Merker := #Teil;\n   IF #Reset THEN\n      #Anzahl := 0;\n   END_IF;\n   #Voll := #Anzahl >= #Max;\nEND_FUNCTION_BLOCK';
const ZI_REF = m => MAIN('   "Zaehler_Gut"(Teil := "S_Gut", Max := ' + m + ', Reset := "S_Reset");\n   "Zaehler_Schlecht"(Teil := "S_Schlecht", Max := ' + m + ', Reset := "S_Reset");\n   "Gesamt" := "Zaehler_Gut".Anzahl + "Zaehler_Schlecht".Anzahl;\n   "Charge_Fertig" := "Zaehler_Gut".Voll;');
defExamTask({ id:'x_scl_p_zwei_instanzen', quest:'scl', level:'profi', ch:13, diff:1,
  params:{ M:[4, 5, 6] },
  title:'Gut- und Schlechtteile zählen',
  brief: p => '<code>FB_Zaehler</code> (🔒) zählt Teile per Flanke bis <code>Max</code>. Im Projekt gibt es die Instanz-DBs <code>"Zaehler_Gut"</code> und <code>"Zaehler_Schlecht"</code>. Schreibe <code>Main</code>:<br>• <code>"Zaehler_Gut"</code> zählt <code>"S_Gut"</code>, <code>"Zaehler_Schlecht"</code> zählt <code>"S_Schlecht"</code> — beide mit <code>Max := ' + p.M + '</code> und <code>Reset := "S_Reset"</code><br>• <code>"Gesamt"</code> = Summe der beiden Zählerstände (Ausgang <code>Anzahl</code>, gelesen über den Instanz-DB)<br>• <code>"Charge_Fertig"</code> = <code>Voll</code> des Gutteilzählers',
  blocks: p => [
    { name:'FB_Zaehler', kind:'FB', src: FBZ },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // zwei Zähler, Summe, Charge fertig\n'), ref: ZI_REF(p.M) }
  ],
  instances: () => ({ Zaehler_Gut:'FB_Zaehler', Zaehler_Schlecht:'FB_Zaehler' }),
  globals: () => ({ S_Gut:false, S_Schlecht:false, S_Reset:false, Gesamt:0, Charge_Fertig:false }),
  must:['SINGLE', 'MEMBER'], warnFree:['INSTANCE_TWICE'],
  visible: () => ({ timed:[{ steps:[[0.1,{S_Gut:true},{Gesamt:1}],[0.1,{S_Gut:false, S_Schlecht:true},{Gesamt:2}],[0.1,{S_Schlecht:false},{Gesamt:2, Charge_Fertig:false}]] }] }),
  hidden: p => ({
    timed:[
      { steps: puls('S_Gut', p.M - 1, i => ({Gesamt:i, Charge_Fertig:false})).concat(puls('S_Gut', 2, () => ({Gesamt:p.M, Charge_Fertig:true, 'Zaehler_Gut.Anzahl':p.M}))) },
      { steps: puls('S_Schlecht', p.M, i => ({Gesamt:i, Charge_Fertig:false, 'Zaehler_Schlecht.Anzahl':i, 'Zaehler_Gut.Anzahl':0})).concat([[0.1,{S_Gut:true},{Gesamt:p.M + 1, Charge_Fertig:false}]]) },
      { steps:[[0.1,{S_Gut:true, S_Schlecht:true},{Gesamt:2}],[0.1,{S_Gut:false, S_Schlecht:false},{Gesamt:2}],[0.1,{S_Reset:true},{Gesamt:0, Charge_Fertig:false}],[0.1,{S_Reset:false, S_Gut:true},{Gesamt:1}]] }
    ]
  }),
  wrong:[
    p => ({ Main: MAIN('   "Zaehler_Gut"(Teil := "S_Gut", Max := ' + p.M + ', Reset := "S_Reset");\n   "Zaehler_Gut"(Teil := "S_Schlecht", Max := ' + p.M + ', Reset := "S_Reset");\n   "Gesamt" := "Zaehler_Gut".Anzahl + "Zaehler_Schlecht".Anzahl;\n   "Charge_Fertig" := "Zaehler_Gut".Voll;') }),
    p => ({ Main: ZI_REF(p.M).replace('"Charge_Fertig" := "Zaehler_Gut".Voll;', '"Charge_Fertig" := "Zaehler_Gut".Voll OR "Zaehler_Schlecht".Voll;') }),
    p => ({ Main: ZI_REF(p.M).replace('"Zaehler_Schlecht"(Teil := "S_Schlecht", Max := ' + p.M + ', Reset := "S_Reset");', '"Zaehler_Schlecht"(Teil := "S_Schlecht", Max := ' + p.M + ', Reset := FALSE);') })
  ]
});

// ----- Kapitel 13: Timer als Multiinstanz -----
const ZYL_HEAD = 'FUNCTION_BLOCK "FB_Zylinder"\nVAR_INPUT\n   Ausfahren : Bool;     // Befehl\n   Endlage_Aus : Bool;   // Sensor ausgefahren\n   Endlage_Ein : Bool;   // Sensor eingefahren\n   Max_Zeit : Time;      // Überwachungszeit\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Ventil : Bool;\n   In_Position : Bool;\n   Stoerung : Bool;\nEND_VAR\nVAR\n   Ueberwachung : TON;\nEND_VAR\n';
const ZYL_BODY = 'BEGIN\n   #Ueberwachung(IN := (#Ausfahren AND NOT #Endlage_Aus) OR (NOT #Ausfahren AND NOT #Endlage_Ein), PT := #Max_Zeit);\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n   END_IF;\n   IF #Quittieren AND NOT #Ueberwachung.Q THEN\n      #Stoerung := FALSE;\n   END_IF;\n   #Ventil := #Ausfahren AND NOT #Stoerung;\n   #In_Position := (#Ausfahren AND #Endlage_Aus) OR (NOT #Ausfahren AND #Endlage_Ein);\nEND_FUNCTION_BLOCK';
defExamTask({ id:'x_scl_p_zylinder', quest:'scl', level:'profi', ch:13, diff:3,
  params:{ T:[1, 2, 3] },
  title:'Zylinder mit Endlagenüberwachung',
  brief: p => 'Die Schnittstelle von <code>FB_Zylinder</code> steht, inklusive Multiinstanz <code>Ueberwachung : TON</code>. Schreibe den Code:<br>• <code>#Ueberwachung</code> läuft in <b>jedem</b> Zyklus: <code>IN</code> ist TRUE, solange die befohlene Endlage fehlt (Ausfahren ohne <code>Endlage_Aus</code> <b>oder</b> Einfahren ohne <code>Endlage_Ein</code>), <code>PT := #Max_Zeit</code>.<br>• Läuft die Zeit ab: <code>Stoerung</code> := TRUE (bleibt gespeichert).<br>• <code>Quittieren</code> setzt <code>Stoerung</code> zurück, aber nur wenn <code>#Ueberwachung.Q</code> FALSE ist.<br>• Erst danach: <code>Ventil</code> := Ausfahren und keine Störung.<br>• <code>In_Position</code>: die befohlene Endlage ist erreicht.<br><code>Main</code> (🔒) ruft die Instanz <code>"Zyl_Greifer"</code> mit <code>Max_Zeit := T#' + p.T + 'S</code> auf.',
  blocks: p => [
    { name:'FB_Zylinder', kind:'FB', edit:true, start: ZYL_HEAD + 'BEGIN\n   \nEND_FUNCTION_BLOCK', ref: ZYL_HEAD + ZYL_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Zyl_Greifer"(Ausfahren := "Greifer_Befehl", Endlage_Aus := "B_Aus", Endlage_Ein := "B_Ein", Max_Zeit := T#' + p.T + 'S,\n                 Quittieren := "S_Quit", Ventil => "Y_Greifer", In_Position => "Greifer_OK", Stoerung => "H_Stoerung");') }
  ],
  instances: () => ({ Zyl_Greifer:'FB_Zylinder' }),
  globals: () => ({ Greifer_Befehl:false, B_Aus:false, B_Ein:true, S_Quit:false, Y_Greifer:false, Greifer_OK:false, H_Stoerung:false }),
  must:['TON'], warnFree:['CONDITIONAL_CALL'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{Y_Greifer:false, Greifer_OK:true}],[0.1,{Greifer_Befehl:true},{Y_Greifer:true, Greifer_OK:false}],[0.5,{B_Ein:false, B_Aus:true},{Greifer_OK:true, H_Stoerung:false}]] }] }),
  hidden: p => { const T = p.T; return {
    unit:[
      { block:'FB_Zylinder', steps:[[0.1,{Endlage_Ein:true, Max_Zeit:T},{Ventil:false, In_Position:true, Stoerung:false}],[0.1,{Ausfahren:true},{Ventil:true, In_Position:false}],[0.1,{Endlage_Ein:false},{Stoerung:false}],[T - 0.3,{},{Stoerung:false, Ventil:true}],[0.1,{},{Stoerung:false}],[0.1,{},{Stoerung:true, Ventil:false}],[0.1,{Quittieren:true},{Stoerung:true}],[0.1,{Quittieren:false, Endlage_Aus:true},{Stoerung:true, Ventil:false}],[0.1,{Quittieren:true},{Stoerung:false, Ventil:true, In_Position:true}],[0.1,{Quittieren:false},{Stoerung:false}]] },
      { block:'FB_Zylinder', steps:[[0.1,{Endlage_Ein:true, Max_Zeit:T},{}],[0.1,{Ausfahren:true},{Ventil:true}],[0.2,{Endlage_Ein:false},{}],[0.3,{Endlage_Aus:true},{In_Position:true}],[T + 1,{},{Stoerung:false, Ventil:true}],[0.1,{Ausfahren:false},{Ventil:false, In_Position:false}],[0.3,{Endlage_Aus:false},{}],[T - 0.5,{Endlage_Ein:true},{In_Position:true, Stoerung:false}],[T + 1,{},{Stoerung:false}]] }
    ],
    timed:[{ steps:[[0.1,{},{Greifer_OK:true}],[0.1,{B_Ein:false},{H_Stoerung:false, Greifer_OK:false}],[T,{},{H_Stoerung:true, Y_Greifer:false}],[0.1,{B_Ein:true},{H_Stoerung:true}],[0.1,{S_Quit:true},{H_Stoerung:false, Greifer_OK:true}]] }]
  }; },
  wrong:[
    () => ({ FB_Zylinder: ZYL_HEAD + ZYL_BODY.replace('   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n   END_IF;\n   IF #Quittieren AND NOT #Ueberwachung.Q THEN\n      #Stoerung := FALSE;\n   END_IF;\n', '   #Stoerung := #Ueberwachung.Q;\n') }),
    () => ({ FB_Zylinder: ZYL_HEAD + ZYL_BODY.replace('#Ventil := #Ausfahren AND NOT #Stoerung;', '#Ventil := #Ausfahren;') }),
    () => ({ FB_Zylinder: ZYL_HEAD + ZYL_BODY.replace('   #Ueberwachung(IN := (#Ausfahren AND NOT #Endlage_Aus) OR (NOT #Ausfahren AND NOT #Endlage_Ein), PT := #Max_Zeit);\n', '   IF #Ausfahren THEN\n      #Ueberwachung(IN := NOT #Endlage_Aus, PT := #Max_Zeit);\n   END_IF;\n') })
  ]
});

// ----- Kapitel 14: UDT über IN_OUT -----
const UDT_AUF = 'TYPE "UDT_Auftrag"\nVERSION : 0.1\n   STRUCT\n      Nummer : DInt;\n      Soll : Int;         // Gutteile laut Auftrag\n      Gut : Int;\n      Ausschuss : Int;\n      Fertig : Bool;\n   END_STRUCT;\nEND_TYPE';
const DB_AUF = 'DATA_BLOCK "DB_Auftrag"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Auftrag : "UDT_Auftrag";\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const BUCH_HEAD = 'FUNCTION "FC_Buchen" : Void\nVAR_INPUT\n   Gut_Teil : Bool;       // Impuls: Gutteil fertig\n   Schlecht_Teil : Bool;  // Impuls: Ausschuss\nEND_VAR\nVAR_OUTPUT\n   Rest : Int;            // fehlende Gutteile (nie negativ)\nEND_VAR\nVAR_IN_OUT\n   Auftrag : "UDT_Auftrag";\nEND_VAR\n';
const BUCH_REF = BUCH_HEAD + 'BEGIN\n   IF NOT #Auftrag.Fertig THEN\n      IF #Gut_Teil THEN\n         #Auftrag.Gut := #Auftrag.Gut + 1;\n      END_IF;\n      IF #Schlecht_Teil THEN\n         #Auftrag.Ausschuss := #Auftrag.Ausschuss + 1;\n      END_IF;\n   END_IF;\n   #Auftrag.Fertig := #Auftrag.Gut >= #Auftrag.Soll;\n   #Rest := MAX(IN1 := #Auftrag.Soll - #Auftrag.Gut, IN2 := 0);\nEND_FUNCTION';
const auf = (soll, gut, aus, fertig) => ({ 'DB_Auftrag.Auftrag.Soll':soll, 'DB_Auftrag.Auftrag.Gut':gut, 'DB_Auftrag.Auftrag.Ausschuss':aus, 'DB_Auftrag.Auftrag.Fertig':fertig });
defExamTask({ id:'x_scl_p_auftrag', quest:'scl', level:'profi', ch:14, diff:2,
  params:{ S:[10, 20, 50] },
  title:'Auftrag buchen (UDT)',
  brief: p => 'Ein Fertigungsauftrag ist im Datentyp <code>"UDT_Auftrag"</code> (🔒) beschrieben und liegt in <code>"DB_Auftrag".Auftrag</code>. Schreibe den Code von <code>FC_Buchen</code>:<br>• Solange der Auftrag <b>nicht</b> <code>Fertig</code> ist: <code>Gut_Teil</code> erhöht <code>Gut</code>, <code>Schlecht_Teil</code> erhöht <code>Ausschuss</code> (je um 1).<br>• Danach: <code>Fertig</code> := <code>Gut</code> ≥ <code>Soll</code>.<br>• <code>Rest</code> = <code>Soll − Gut</code>, aber nie kleiner als 0.<br>Zugriff auf Elemente: <code>#Auftrag.Gut</code>. Im Test hat der Auftrag z.B. <code>Soll</code> = ' + p.S + '.',
  blocks: () => [
    { name:'UDT_Auftrag', kind:'UDT', src: UDT_AUF },
    { name:'DB_Auftrag', kind:'DB', src: DB_AUF },
    { name:'FC_Buchen', kind:'FC', edit:true, start: BUCH_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: BUCH_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FC_Buchen"(Gut_Teil := "Imp_Gut", Schlecht_Teil := "Imp_Schlecht", Rest => "Rest", Auftrag := "DB_Auftrag".Auftrag);') }
  ],
  globals: () => ({ Imp_Gut:false, Imp_Schlecht:false, Rest:0 }),
  must:['MEMBER', 'UDT_REF'], warnFree:['OUT_NOT_ALL_PATHS'],
  visible: p => ({ tests:[[Object.assign(auf(p.S, 3, 1, false), {Imp_Gut:true}), Object.assign(auf(p.S, 4, 1, false), {Rest:p.S - 4})]] }),
  hidden: p => { const S = p.S; return {
    tests:[
      [Object.assign(auf(S, 0, 0, false), {Imp_Schlecht:true}), Object.assign(auf(S, 0, 1, false), {Rest:S})],
      [Object.assign(auf(S, S - 1, 2, false), {Imp_Gut:true}), Object.assign(auf(S, S, 2, true), {Rest:0})],
      [Object.assign(auf(S, S - 2, 0, false), {Imp_Gut:true, Rest:5}), Object.assign(auf(S, S - 1, 0, false), {Rest:1})],
      [Object.assign(auf(S, S, 3, true), {Imp_Gut:true, Imp_Schlecht:true}), Object.assign(auf(S, S, 3, true), {Rest:0})],
      [Object.assign(auf(S, S + 2, 0, false), {}), Object.assign(auf(S, S + 2, 0, true), {Rest:0})],
      [Object.assign(auf(S, 5, 5, false), {Imp_Gut:true, Imp_Schlecht:true}), Object.assign(auf(S, 6, 6, false), {Rest:S - 6})]
    ],
    timed:[{ setup:auf(S, S - 2, 0, false), steps:[[0.1,{Imp_Gut:true},{Rest:1}],[0.1,{Imp_Gut:false},{Rest:1}],[0.1,{Imp_Gut:true},{Rest:0, 'DB_Auftrag.Auftrag.Fertig':true}],[0.1,{Imp_Gut:true, Imp_Schlecht:true},{'DB_Auftrag.Auftrag.Gut':S, 'DB_Auftrag.Auftrag.Ausschuss':0}]] }]
  }; },
  wrong:[
    () => ({ FC_Buchen: BUCH_REF.replace('   IF NOT #Auftrag.Fertig THEN\n', '   IF TRUE THEN\n') }),
    () => ({ FC_Buchen: BUCH_REF.replace('#Rest := MAX(IN1 := #Auftrag.Soll - #Auftrag.Gut, IN2 := 0);', '#Rest := #Auftrag.Soll - #Auftrag.Gut;') }),
    () => ({ FC_Buchen: BUCH_REF.replace('#Auftrag.Fertig := #Auftrag.Gut >= #Auftrag.Soll;', '#Auftrag.Fertig := #Auftrag.Gut > #Auftrag.Soll;') })
  ]
});

// ----- Kapitel 14: STRING -----
const TXT_HEAD = 'FUNCTION "FC_Statustext" : String[40]\nVAR_INPUT\n   Station : String[12];\n   Anzahl : Int;\n   Stoerung : Bool;\nEND_VAR\n';
const TXT_REF = TXT_HEAD + 'BEGIN\n   IF #Stoerung THEN\n      #FC_Statustext := CONCAT(IN1 := #Station, IN2 := \': STOERUNG\');\n   ELSE\n      #FC_Statustext := CONCAT(IN1 := #Station, IN2 := \': \', IN3 := INT_TO_STRING(#Anzahl), IN4 := \' Teile\');\n   END_IF;\nEND_FUNCTION';
defExamTask({ id:'x_scl_p_statustext', quest:'scl', level:'profi', ch:14, diff:2,
  params:{ NAME:['Presse', 'Ofen', 'Band 2'] },
  title:'Statuszeile für das HMI',
  brief: p => '<code>FC_Statustext</code> liefert einen Text vom Typ <code>String[40]</code>. Schreibe den Code:<br>• bei <code>Stoerung</code>: <code>&lt;Station&gt;: STOERUNG</code><br>• sonst: <code>&lt;Station&gt;: &lt;Anzahl&gt; Teile</code> — die Zahl vorher mit <code>INT_TO_STRING</code> umwandeln<br>Verbinde die Teile mit <code>CONCAT</code>. Beispiel: Station <code>\'' + p.NAME + '\'</code>, Anzahl 17 → <code>' + p.NAME + ': 17 Teile</code>.<br><code>Main</code> (🔒) schreibt den Text der Station <code>\'' + p.NAME + '\'</code> nach <code>"HMI_Zeile"</code>.',
  blocks: p => [
    { name:'FC_Statustext', kind:'FC', edit:true, start: TXT_HEAD + 'BEGIN\n   \nEND_FUNCTION', ref: TXT_REF },
    { name:'Main', kind:'OB', src: MAIN('   "HMI_Zeile" := "FC_Statustext"(Station := \'' + p.NAME + '\', Anzahl := "Stueckzahl", Stoerung := "Stoerung");') }
  ],
  globals: () => ({ Stueckzahl:0, Stoerung:false, HMI_Zeile:'' }), types: () => ({ HMI_Zeile:'STRING[40]' }),
  must:['STRING', 'CONCAT', 'CONVERT'], warnFree:['RET_NOT_SET', 'STRING_TRUNC'],
  visible: p => ({ tests:[[{Stueckzahl:17},{HMI_Zeile:p.NAME + ': 17 Teile'}]] }),
  hidden: p => ({
    unit:[{ block:'FC_Statustext', steps:[[{Station:'Waage', Anzahl:0, Stoerung:false},{RET:'Waage: 0 Teile'}],[{Station:'Waage', Anzahl:250, Stoerung:true},{RET:'Waage: STOERUNG'}],[{Station:'Roboter RZ3', Anzahl:32000, Stoerung:false},{RET:'Roboter RZ3: 32000 Teile'}]] }],
    tests:[[{Stueckzahl:5},{HMI_Zeile:p.NAME + ': 5 Teile'}],[{Stueckzahl:1234, Stoerung:true},{HMI_Zeile:p.NAME + ': STOERUNG'}],[{Stueckzahl:999, Stoerung:false, HMI_Zeile:'alt'},{HMI_Zeile:p.NAME + ': 999 Teile'}]]
  }),
  wrong:[
    () => ({ FC_Statustext: TXT_REF.replace("IN4 := ' Teile'", "IN4 := 'Teile'") }),
    () => ({ FC_Statustext: TXT_HEAD + 'BEGIN\n   IF NOT #Stoerung THEN\n      #FC_Statustext := CONCAT(IN1 := #Station, IN2 := \': \', IN3 := INT_TO_STRING(#Anzahl), IN4 := \' Teile\');\n   END_IF;\nEND_FUNCTION' }),
    () => ({ FC_Statustext: TXT_REF.replace("IN2 := ': STOERUNG'", "IN2 := ' STOERUNG'") })
  ]
});

// ----- Kapitel 14: Array von UDT im DB, Strukturen kopieren -----
const UDT_REZ = 'TYPE "UDT_Rezept"\nVERSION : 0.1\n   STRUCT\n      Temperatur : Real;   // °C\n      Zeit : Time;         // Haltezeit\n      Drehzahl : Int;      // 1/min\n   END_STRUCT;\nEND_TYPE';
const DB_REZ = 'DATA_BLOCK "DB_Rezepte"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Liste : Array[1..4] of "UDT_Rezept";\n      Aktiv : "UDT_Rezept";\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const REZ_HEAD = m => 'FUNCTION "FC_Rezept_Laden" : Bool\nVAR_INPUT\n   Nr : Int;   // gewähltes Rezept 1…4\nEND_VAR\nVAR_IN_OUT\n   Liste : Array[1..4] of "UDT_Rezept";\n   Aktiv : "UDT_Rezept";\nEND_VAR\nVAR CONSTANT\n   MAX_DREHZAHL : Int := ' + m + ';\nEND_VAR\n';
const REZ_REF = m => REZ_HEAD(m) + 'BEGIN\n   IF #Nr >= 1 AND #Nr <= 4 THEN\n      #Aktiv := #Liste[#Nr];\n      #Aktiv.Drehzahl := MIN(IN1 := #Liste[#Nr].Drehzahl, IN2 := #MAX_DREHZAHL);\n      #FC_Rezept_Laden := TRUE;\n   ELSE\n      #FC_Rezept_Laden := FALSE;\n   END_IF;\nEND_FUNCTION';
const REZ_LISTE = [{Temperatur:180, Zeit:30, Drehzahl:900}, {Temperatur:220.5, Zeit:45, Drehzahl:1400}, {Temperatur:160, Zeit:90, Drehzahl:1800}, {Temperatur:200, Zeit:60, Drehzahl:1200}];
const AKT0 = {Temperatur:20, Zeit:5, Drehzahl:100};
defExamTask({ id:'x_scl_p_rezept', quest:'scl', level:'profi', ch:14, diff:3,
  params:{ MAXD:[1200, 1500] },
  title:'Rezept laden',
  brief: p => 'Im globalen DB <code>"DB_Rezepte"</code> (🔒) liegen vier Rezepte (<code>Liste : Array[1..4] of "UDT_Rezept"</code>) und das aktive Rezept <code>Aktiv</code>. Schreibe den Code von <code>FC_Rezept_Laden</code>:<br>• Ist <code>Nr</code> gültig (1 … 4): das <b>ganze</b> Rezept <code>Liste[Nr]</code> nach <code>Aktiv</code> kopieren, dabei die <code>Drehzahl</code> auf höchstens <code>MAX_DREHZAHL</code> (= ' + p.MAXD + ') begrenzen, Rückgabewert TRUE.<br>• Sonst: <code>Aktiv</code> bleibt unverändert, Rückgabewert FALSE.<br>Eine Struktur kopiert man mit einer einzigen Zuweisung: <code>#Aktiv := #Liste[#Nr];</code>',
  blocks: p => [
    { name:'UDT_Rezept', kind:'UDT', src: UDT_REZ },
    { name:'DB_Rezepte', kind:'DB', src: DB_REZ },
    { name:'FC_Rezept_Laden', kind:'FC', edit:true, start: REZ_HEAD(p.MAXD) + 'BEGIN\n   \nEND_FUNCTION', ref: REZ_REF(p.MAXD) },
    { name:'Main', kind:'OB', src: MAIN('   "Laden_OK" := "FC_Rezept_Laden"(Nr := "Rezept_Nr", Liste := "DB_Rezepte".Liste, Aktiv := "DB_Rezepte".Aktiv);') }
  ],
  globals: () => ({ Rezept_Nr:0, Laden_OK:false }),
  must:['ARRAY', 'MEMBER', 'UDT_REF'], warnFree:['RET_NOT_SET'],
  visible: () => ({ tests:[[{'DB_Rezepte.Liste':REZ_LISTE, Rezept_Nr:1},{Laden_OK:true, 'DB_Rezepte.Aktiv':REZ_LISTE[0]}]] }),
  hidden: p => { const lim = r => Object.assign({}, r, {Drehzahl:Math.min(r.Drehzahl, p.MAXD)});
    const base = n => ({'DB_Rezepte.Liste':REZ_LISTE, 'DB_Rezepte.Aktiv':AKT0, Rezept_Nr:n});
    return { tests:[
      [base(2),{Laden_OK:true, 'DB_Rezepte.Aktiv':lim(REZ_LISTE[1])}],
      [base(3),{Laden_OK:true, 'DB_Rezepte.Aktiv':lim(REZ_LISTE[2])}],
      [base(4),{Laden_OK:true, 'DB_Rezepte.Aktiv':lim(REZ_LISTE[3])}],
      [Object.assign(base(1), {Laden_OK:false}),{Laden_OK:true, 'DB_Rezepte.Aktiv':REZ_LISTE[0]}],
      [Object.assign(base(0), {Laden_OK:true}),{Laden_OK:false, 'DB_Rezepte.Aktiv':AKT0}],
      [base(5),{Laden_OK:false, 'DB_Rezepte.Aktiv':AKT0}],
      [base(-1),{Laden_OK:false, 'DB_Rezepte.Aktiv':AKT0}]
    ] }; },
  wrong:[
    p => ({ FC_Rezept_Laden: REZ_REF(p.MAXD).replace('IF #Nr >= 1 AND #Nr <= 4 THEN', 'IF #Nr <= 4 THEN') }),
    p => ({ FC_Rezept_Laden: REZ_REF(p.MAXD).replace('      #Aktiv.Drehzahl := MIN(IN1 := #Liste[#Nr].Drehzahl, IN2 := #MAX_DREHZAHL);\n', '') }),
    p => ({ FC_Rezept_Laden: REZ_REF(p.MAXD).replace('   ELSE\n      #FC_Rezept_Laden := FALSE;', '   ELSE\n      #Aktiv.Drehzahl := 0;\n      #FC_Rezept_Laden := FALSE;') })
  ]
});

// ----- Kapitel 15: Anlauf-OB -----
const DB_OFEN = 'DATA_BLOCK "DB_Ofen"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\n   VAR RETAIN\n      Chargen : DInt := 1520;   // Zähler über die gesamte Lebensdauer\n   END_VAR\n   VAR\n      Soll_Temp : Real;\n      Aufheizen : Bool;\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const OFEN_MAIN = MAIN('   IF "DB_Ofen".Aufheizen AND "Ist_Temp" >= "DB_Ofen".Soll_Temp THEN\n      "DB_Ofen".Aufheizen := FALSE;\n      "DB_Ofen".Chargen := "DB_Ofen".Chargen + 1;\n   END_IF;\n   "Heizung" := "DB_Ofen".Aufheizen;');
const OFEN_START = sw => 'ORGANIZATION_BLOCK "Startup"\nTITLE = "Complete Restart"\nBEGIN\n   "DB_Ofen".Soll_Temp := ' + sw + '.0;\n   "DB_Ofen".Aufheizen := TRUE;\n   "Tuer_Verriegelt" := TRUE;\n   "Meldung" := \'Anlauf\';\nEND_ORGANIZATION_BLOCK';
defExamTask({ id:'x_scl_p_ofenanlauf', quest:'scl', level:'profi', ch:15, diff:1,
  params:{ SW:[160, 180, 200, 220] },
  title:'Anlauf des Härteofens (OB100)',
  brief: p => 'Schreibe den Anlauf-OB <code>"Startup"</code> [OB100]. Er läuft einmal beim Übergang STOP → RUN und setzt:<br>• <code>"DB_Ofen".Soll_Temp</code> := <b>' + p.SW + '.0</b> und <code>"DB_Ofen".Aufheizen</code> := TRUE<br>• <code>"Tuer_Verriegelt"</code> := TRUE<br>• <code>"Meldung"</code> := <code>\'Anlauf\'</code><br>Der remanente Zähler <code>"DB_Ofen".Chargen</code> zählt über die gesamte Lebensdauer und darf im Anlauf <b>nicht</b> verändert werden. Der zyklische <code>Main</code> (🔒) heizt bis zur Solltemperatur.',
  blocks: p => [
    { name:'DB_Ofen', kind:'DB', src: DB_OFEN },
    { name:'Startup', kind:'OB', ob:100, edit:true, start:'ORGANIZATION_BLOCK "Startup"\nTITLE = "Complete Restart"\nBEGIN\n   // Anlaufwerte setzen\n\nEND_ORGANIZATION_BLOCK', ref: OFEN_START(p.SW) },
    { name:'Main', kind:'OB', src: OFEN_MAIN }
  ],
  globals: () => ({ Ist_Temp:20, Heizung:false, Tuer_Verriegelt:false, Meldung:'' }), types: () => ({ Ist_Temp:'REAL', Meldung:'STRING[20]' }),
  must:['STARTUP', 'DB_ACCESS'],
  visible: p => ({ timed:[{ steps:[[0.1,{},{Heizung:true, Tuer_Verriegelt:true, Meldung:'Anlauf'}],[0.1,{Ist_Temp:p.SW},{Heizung:false}]] }] }),
  hidden: p => ({
    timed:[
      { steps:[[0.1,{},{Heizung:true, 'DB_Ofen.Soll_Temp':p.SW, 'DB_Ofen.Chargen':1520, Tuer_Verriegelt:true}],[0.1,{Ist_Temp:p.SW - 1},{Heizung:true}],[0.1,{Ist_Temp:p.SW},{Heizung:false, 'DB_Ofen.Chargen':1521}],[0.1,{},{Heizung:false, 'DB_Ofen.Chargen':1521, Meldung:'Anlauf'}]] },
      { setup:{'DB_Ofen.Chargen':77}, steps:[[0.1,{},{'DB_Ofen.Chargen':77, Tuer_Verriegelt:true, Meldung:'Anlauf', 'DB_Ofen.Aufheizen':true}],[0.1,{Ist_Temp:p.SW + 30},{'DB_Ofen.Chargen':78}]] },
      { steps:[[0.1,{Ist_Temp:p.SW + 5},{Heizung:false, 'DB_Ofen.Aufheizen':false, 'DB_Ofen.Chargen':1521, 'DB_Ofen.Soll_Temp':p.SW}]] }
    ]
  }),
  wrong:[
    p => ({ Startup: OFEN_START(p.SW).replace('   "Meldung"', '   "DB_Ofen".Chargen := 0;\n   "Meldung"') }),
    p => ({ Startup: OFEN_START(p.SW).replace('   "DB_Ofen".Aufheizen := TRUE;\n', '') }),
    p => ({ Startup: OFEN_START(p.SW - 20) })
  ]
});

// ----- Kapitel 15: Programmierstandard (Schnittstelle statt globaler Zugriffe) -----
const LU_HEAD = (e, a) => 'FUNCTION_BLOCK "FB_Luefter"\nVAR_INPUT\n   Temperatur : Real;   // Motortemperatur in °C\n   Freigabe : Bool;\nEND_VAR\nVAR_OUTPUT\n   Luefter : Bool;\nEND_VAR\nVAR CONSTANT\n   TEMP_EIN : Real := ' + e + '.0;\n   TEMP_AUS : Real := ' + a + '.0;\nEND_VAR\n';
const LU_BODY = 'BEGIN\n   IF NOT #Freigabe THEN\n      #Luefter := FALSE;\n   ELSIF #Temperatur >= #TEMP_EIN THEN\n      #Luefter := TRUE;\n   ELSIF #Temperatur <= #TEMP_AUS THEN\n      #Luefter := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
const LU_START = (e, a) => 'FUNCTION_BLOCK "FB_Luefter"\n// ACHTUNG: greift direkt auf globale Variablen zu und enthält Zauberzahlen\nBEGIN\n   IF NOT "Freigabe_Kuehlung" THEN\n      "Luefter_M1" := FALSE;\n   ELSIF "Temp_M1" >= ' + e + '.0 THEN\n      "Luefter_M1" := TRUE;\n   ELSIF "Temp_M1" <= ' + a + '.0 THEN\n      "Luefter_M1" := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
defExamTask({ id:'x_scl_p_luefter_standard', quest:'scl', level:'profi', ch:15, diff:2,
  params:{ E:[60, 70], A:[45, 50] },
  title:'Lüfterbaustein nach Standard',
  brief: p => '<code>FB_Luefter</code> funktioniert, verstösst aber gegen den Programmierstandard: Er liest und schreibt globale Variablen direkt und enthält Zauberzahlen. Schreibe ihn neu:<br>• Schnittstelle: Eingänge <code>Temperatur</code> (Real), <code>Freigabe</code> (Bool); Ausgang <code>Luefter</code> (Bool)<br>• Konstanten <code>TEMP_EIN</code> = ' + p.E + '.0 und <code>TEMP_AUS</code> = ' + p.A + '.0 (Real)<br>• Logik wie bisher: ohne Freigabe aus; ab <code>TEMP_EIN</code> ein; bis <code>TEMP_AUS</code> aus; dazwischen Zustand halten<br>• <b>Keine</b> globalen Variablen im FB (Warnung <code>GLOBAL_ACCESS</code> muss verschwinden)<br><code>Main</code> (🔒) ruft bereits zwei Instanzen für die Motoren M1 und M2 auf.',
  blocks: p => [
    { name:'FB_Luefter', kind:'FB', edit:true, start: LU_START(p.E, p.A), ref: LU_HEAD(p.E, p.A) + LU_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "Luefter_M1_DB"(Temperatur := "Temp_M1", Freigabe := "Freigabe_Kuehlung", Luefter => "Luefter_M1");\n   "Luefter_M2_DB"(Temperatur := "Temp_M2", Freigabe := "Freigabe_Kuehlung", Luefter => "Luefter_M2");') }
  ],
  instances: () => ({ Luefter_M1_DB:'FB_Luefter', Luefter_M2_DB:'FB_Luefter' }),
  globals: () => ({ Temp_M1:20, Temp_M2:20, Freigabe_Kuehlung:true, Luefter_M1:false, Luefter_M2:false }), types: () => ({ Temp_M1:'REAL', Temp_M2:'REAL' }),
  must:['VAR_INPUT', 'VAR_OUTPUT', 'VAR_CONSTANT'], warnFree:['GLOBAL_ACCESS'],
  visible: p => ({ timed:[{ steps:[[0.1,{Temp_M1:p.E + 5},{Luefter_M1:true, Luefter_M2:false}],[0.1,{Temp_M1:20},{Luefter_M1:false}]] }] }),
  hidden: p => ({
    unit:[{ block:'FB_Luefter', steps:[[{Temperatur:p.E - 0.5, Freigabe:true},{Luefter:false}],[{Temperatur:p.E},{Luefter:true}],[{Temperatur:p.A + 0.5},{Luefter:true}],[{Temperatur:p.A},{Luefter:false}],[{Temperatur:p.A + 5},{Luefter:false}],[{Temperatur:p.E + 20, Freigabe:false},{Luefter:false}]] }],
    timed:[{ steps:[[0.1,{Temp_M1:p.E, Temp_M2:p.A + 1},{Luefter_M1:true, Luefter_M2:false}],[0.1,{Temp_M1:p.A + 1, Temp_M2:p.E + 1},{Luefter_M1:true, Luefter_M2:true}],[0.1,{Temp_M1:p.A - 1},{Luefter_M1:false, Luefter_M2:true}],[0.1,{Freigabe_Kuehlung:false},{Luefter_M1:false, Luefter_M2:false}],[0.1,{Freigabe_Kuehlung:true},{Luefter_M1:false, Luefter_M2:true}]] }]
  }),
  wrong:[
    p => ({ FB_Luefter: LU_HEAD(p.E, p.A) + LU_BODY.replace('#Temperatur >= #TEMP_EIN', '"Temp_M1" >= #TEMP_EIN') }),
    p => ({ FB_Luefter: LU_HEAD(p.E, p.A) + 'BEGIN\n   IF NOT #Freigabe THEN\n      #Luefter := FALSE;\n   ELSIF #Temperatur >= #TEMP_EIN THEN\n      #Luefter := TRUE;\n   ELSE\n      #Luefter := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK' }),
    p => ({ FB_Luefter: LU_HEAD(p.E, p.A) + LU_BODY.replace('#Temperatur <= #TEMP_AUS', '#Temperatur < #TEMP_AUS') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_scl_g_prio', quest:'scl', level:'grund', ch:2, q:'Welche Verknüpfung wird in <code>a OR b AND c</code> zuerst ausgewertet?', options:['<code>b AND c</code>', '<code>a OR b</code>', 'von links nach rechts, also <code>a OR b</code>', 'SCL meldet einen Fehler'], answer:0 });
defExamQuestion({ id:'xq_scl_g_case', quest:'scl', level:'grund', ch:5, q:'Was passiert in einer CASE-Anweisung, wenn kein Zweig zum Wert passt und kein ELSE vorhanden ist?', options:['Es wird keine Anweisung der CASE-Anweisung ausgeführt', 'Der erste Zweig wird ausgeführt', 'Die CPU geht in STOP', 'Der letzte Zweig wird ausgeführt'], answer:0 });
defExamQuestion({ id:'xq_scl_g_ton', quest:'scl', level:'grund', ch:9, q:'Ein TON mit <code>PT := T#5S</code>: <code>IN</code> ist 3 s TRUE, dann 1 Zyklus FALSE, dann wieder TRUE. Wann wird <code>Q</code> TRUE?', options:['5 s nach dem erneuten Einschalten', '2 s nach dem erneuten Einschalten', 'sofort, weil schon 3 s abgelaufen sind', 'nie'], answer:0 });
defExamQuestion({ id:'xq_scl_p_fcstat', quest:'scl', level:'profi', ch:12, q:'Warum darf eine FC keinen Bereich <code>VAR</code> (statisch) haben?', options:['Eine FC hat keinen Instanz-DB, also kein Gedächtnis zwischen Aufrufen', 'Weil statische Variablen nur in OBs erlaubt sind', 'Weil eine FC keine Eingänge haben darf', 'Das ist erlaubt'], answer:0 });
defExamQuestion({ id:'xq_scl_p_temp', quest:'scl', level:'profi', ch:11, q:'Wofür eignet sich eine <code>VAR_TEMP</code>-Variable in einem FB?', options:['Für Zwischenergebnisse, die nur während eines Aufrufs gebraucht werden', 'Für einen Zählerstand, der bis zum nächsten Zyklus erhalten bleiben muss', 'Für einen Wert, den andere Bausteine lesen sollen', 'Für die Flankenerkennung über mehrere Zyklen'], answer:0 });
})();
