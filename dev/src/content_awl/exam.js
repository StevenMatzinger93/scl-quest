/* ===== AWL QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Walzwerk), nicht aus dem Spiel. AWL wird zeilentreu nach SCL übersetzt (awl.js). */
(function(){
const seq = steps => [{ steps }];

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_awl_g_pumpe', quest:'awl', level:'grund', ch:3, diff:1, timed:true,
  title:'Kühlwasserpumpe speichern',
  brief: () => '<code>S_Ein</code> <b>setzt</b> die <code>Pumpe</code>, <code>S_Aus</code> oder ein fehlender Wasserdruck (<code>Druck_OK</code> = 0) <b>setzen sie zurück</b>. Rücksetzen hat Vorrang (steht zuletzt).',
  vars: () => ({ S_Ein:false, S_Aus:false, Druck_OK:true, Pumpe:false }),
  start: () => '// Kühlwasserpumpe\n',
  ref: () => 'U  S_Ein\nS  Pumpe\nO  S_Aus\nON Druck_OK\nR  Pumpe',
  visible: () => seq([[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false},{Pumpe:true}],[0.1,{S_Aus:true},{Pumpe:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Pumpe:false}],[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false},{Pumpe:true}],[0.1,{S_Aus:true},{Pumpe:false}],[0.1,{S_Aus:false},{Pumpe:false}]] },
    { steps:[[0.1,{S_Ein:true, S_Aus:true},{Pumpe:false}],[0.1,{S_Aus:false},{Pumpe:true}]] },
    { steps:[[0.1,{S_Ein:true},{Pumpe:true}],[0.1,{S_Ein:false, Druck_OK:false},{Pumpe:false}],[0.1,{Druck_OK:true},{Pumpe:false}]] },
    { steps:[[0.1,{S_Ein:true, Druck_OK:false},{Pumpe:false}],[0.1,{Druck_OK:true},{Pumpe:true}]] }
  ],
  wrong:[
    () => 'U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe',
    () => 'O  S_Aus\nON Druck_OK\nR  Pumpe\nU  S_Ein\nS  Pumpe',
    () => 'U  S_Ein\n=  Pumpe'
  ]
});

defExamTask({ id:'x_awl_g_temperatur', quest:'awl', level:'grund', ch:9, diff:2,
  params:{ LO:[1050, 1080, 1100], HI:[1200, 1250] },
  title:'Walztemperatur im Fenster',
  brief: p => '<code>Walzen_Frei</code> ist 1, wenn <code>Temp</code> (Int, °C) im Bereich <b>' + p.LO + ' … ' + p.HI + '</b> liegt (Grenzen eingeschlossen). Sonst 0.',
  vars: () => ({ Temp:0, Walzen_Frei:false }),
  start: () => '// Temperaturfenster\n',
  ref: p => 'L  Temp\nL  ' + p.LO + '\n>=I\nU(\nL  Temp\nL  ' + p.HI + '\n<=I\n)\n=  Walzen_Frei',
  must:['CMP_I'],
  visible: p => [[{Temp:(p.LO + p.HI) >> 1},{Walzen_Frei:true}], [{Temp:800},{Walzen_Frei:false}]],
  hidden: p => [[{Temp:p.LO - 1},{Walzen_Frei:false}],[{Temp:p.LO},{Walzen_Frei:true}],[{Temp:p.HI},{Walzen_Frei:true}],[{Temp:p.HI + 1},{Walzen_Frei:false}],[{Temp:0, Walzen_Frei:true},{Walzen_Frei:false}],[{Temp:1500},{Walzen_Frei:false}]],
  wrong:[
    p => 'L  Temp\nL  ' + p.LO + '\n>I\nU(\nL  Temp\nL  ' + p.HI + '\n<I\n)\n=  Walzen_Frei',
    p => 'L  Temp\nL  ' + p.LO + '\n>=I\nO(\nL  Temp\nL  ' + p.HI + '\n<=I\n)\n=  Walzen_Frei',
    p => 'L  Temp\nL  ' + p.LO + '\n>=I\n=  Walzen_Frei'
  ]
});

/* ---------- Profi-Stufe ---------- */
const MIN_D = { in:'A:Int|Wert 1; B:Int|Wert 2' };
defExamTask({ id:'x_awl_p_minimum', quest:'awl', level:'profi', ch:11, diff:1,
  title:'Kleinster Walzspalt (FC)',
  brief: () => 'Programmiere die Funktion <code>FC_Min</code> mit Rückgabewert (Int): Sie liefert den <b>kleineren</b> der beiden Eingänge <code>#A</code> und <code>#B</code>. Den Rückgabewert schreibst du mit <code>T #RET_VAL</code>. Der OB <code>Main</code> (🔒) bestimmt den kleineren Walzspalt der beiden Gerüste.',
  blocks: () => [
    { name:'FC_Min', kind:'FC', edit:true, start: aFC('FC_Min', 'Int', MIN_D, ''), ref: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n<I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') },
    { name:'Main', kind:'OB', src: aOB('Main', 'CALL "FC_Min"\n   A := "Spalt_1"\n   B := "Spalt_2"\n   RET_VAL := "Spalt_Min"') }
  ],
  globals: () => ({ Spalt_1:0, Spalt_2:0, Spalt_Min:0 }),
  must:['CMP_I'],
  visible: () => ({ tests:[[{Spalt_1:30, Spalt_2:40},{Spalt_Min:30}]] }),
  hidden: () => ({
    unit:[{ block:'FC_Min', steps:[[{A:5, B:9},{RET:5}],[{A:9, B:5},{RET:5}],[{A:7, B:7},{RET:7}],[{A:-3, B:2},{RET:-3}],[{A:0, B:-1},{RET:-1}]] }],
    tests:[[{Spalt_1:80, Spalt_2:12},{Spalt_Min:12}],[{Spalt_1:25, Spalt_2:25},{Spalt_Min:25}]]
  }),
  wrong:[
    () => ({ FC_Min: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nL  #B\n>I\nSPB  A_KL\nL  #B\nT  #RET_VAL\nBEA\nA_KL: L  #A\nT  #RET_VAL') }),
    () => ({ FC_Min: aFC('FC_Min', 'Int', MIN_D, 'L  #A\nT  #RET_VAL') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_awl_g_erstabfrage', quest:'awl', level:'grund', ch:1, q:'Was bewirkt die Erstabfrage nach einer Zuweisung <code>=</code>?', options:['Die nächste Abfrage beginnt ein neues VKE', 'Das VKE wird gelöscht und bleibt 0', 'AKKU1 wird auf 0 gesetzt', 'Der Baustein wird beendet'], answer:0 });
defExamQuestion({ id:'xq_awl_g_akku', quest:'awl', level:'grund', ch:7, q:'Nach <code>L 5</code> und <code>L 8</code>: Was steht in AKKU1 und AKKU2?', options:['AKKU1 = 8, AKKU2 = 5', 'AKKU1 = 5, AKKU2 = 8', 'AKKU1 = 13, AKKU2 = 0', 'AKKU1 = 8, AKKU2 = 0'], answer:0 });
defExamQuestion({ id:'xq_awl_p_1200', quest:'awl', level:'profi', ch:15, q:'Ein AWL-Programm einer S7-300 soll auf eine S7-1200 migriert werden. Was ist richtig?', options:['Die S7-1200 kann kein AWL – das Programm muss z. B. nach SCL oder KOP umgeschrieben werden', 'AWL läuft auf der S7-1200 unverändert', 'Man muss nur die Adressen anpassen', 'Die S7-1200 übersetzt AWL automatisch beim Laden'], answer:0 });
})();
