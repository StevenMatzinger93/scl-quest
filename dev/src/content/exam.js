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

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_scl_g_prio', quest:'scl', level:'grund', ch:2, q:'Welche Verknüpfung wird in <code>a OR b AND c</code> zuerst ausgewertet?', options:['<code>b AND c</code>', '<code>a OR b</code>', 'von links nach rechts, also <code>a OR b</code>', 'SCL meldet einen Fehler'], answer:0 });
defExamQuestion({ id:'xq_scl_g_case', quest:'scl', level:'grund', ch:5, q:'Was passiert in einer CASE-Anweisung, wenn kein Zweig zum Wert passt und kein ELSE vorhanden ist?', options:['Es wird keine Anweisung der CASE-Anweisung ausgeführt', 'Der erste Zweig wird ausgeführt', 'Die CPU geht in STOP', 'Der letzte Zweig wird ausgeführt'], answer:0 });
defExamQuestion({ id:'xq_scl_g_ton', quest:'scl', level:'grund', ch:9, q:'Ein TON mit <code>PT := T#5S</code>: <code>IN</code> ist 3 s TRUE, dann 1 Zyklus FALSE, dann wieder TRUE. Wann wird <code>Q</code> TRUE?', options:['5 s nach dem erneuten Einschalten', '2 s nach dem erneuten Einschalten', 'sofort, weil schon 3 s abgelaufen sind', 'nie'], answer:0 });
defExamQuestion({ id:'xq_scl_p_fcstat', quest:'scl', level:'profi', ch:12, q:'Warum darf eine FC keinen Bereich <code>VAR</code> (statisch) haben?', options:['Eine FC hat keinen Instanz-DB, also kein Gedächtnis zwischen Aufrufen', 'Weil statische Variablen nur in OBs erlaubt sind', 'Weil eine FC keine Eingänge haben darf', 'Das ist erlaubt'], answer:0 });
defExamQuestion({ id:'xq_scl_p_temp', quest:'scl', level:'profi', ch:11, q:'Wofür eignet sich eine <code>VAR_TEMP</code>-Variable in einem FB?', options:['Für Zwischenergebnisse, die nur während eines Aufrufs gebraucht werden', 'Für einen Zählerstand, der bis zum nächsten Zyklus erhalten bleiben muss', 'Für einen Wert, den andere Bausteine lesen sollen', 'Für die Flankenerkennung über mehrere Zyklen'], answer:0 });
})();
