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
