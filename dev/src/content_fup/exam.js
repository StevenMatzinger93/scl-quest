/* ===== FUP QUEST — PRÜFUNGSPOOL (Zertifikat) =====
   Eigene Aufgaben (Stellwerk), nicht aus dem Spiel. Gleiches Netzwerkmodell wie KOP (kop.js). */
(function(){
const seq = steps => [{ steps }];

/* ---------- Grundstufe ---------- */
defExamTask({ id:'x_fup_g_schranke', quest:'fup', level:'grund', ch:4, diff:1, timed:true,
  title:'Schranke mit Speicherbox',
  brief: () => 'Die Anforderung <code>Zug_Meldung</code> <b>setzt</b> <code>Schranke_Zu</code>, der Taster <code>Freimeldung</code> <b>setzt zurück</b>. Kommen beide gleichzeitig, bleibt die Schranke <b>zu</b> (Setzen dominant). Verwende eine RS-Box.',
  vars: () => ({ Zug_Meldung:false, Freimeldung:false, Schranke_Zu:false }),
  start: () => 'NETWORK Schranke\n? => ?;\n',
  ref: () => 'NETWORK Schranke\nZug_Meldung => RS(Schranke_Zu, Freimeldung);',
  visible: () => seq([[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false},{Schranke_Zu:true}],[0.1,{Freimeldung:true},{Schranke_Zu:false}]]),
  hidden: () => [
    { steps:[[0.1,{},{Schranke_Zu:false}],[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.5,{Zug_Meldung:false},{Schranke_Zu:true}],[0.1,{Freimeldung:true},{Schranke_Zu:false}],[0.1,{Freimeldung:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Zug_Meldung:true, Freimeldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false},{Schranke_Zu:false}]] },
    { steps:[[0.1,{Freimeldung:true},{Schranke_Zu:false}],[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false, Freimeldung:false},{Schranke_Zu:true}]] },
    { steps:[[0.1,{Zug_Meldung:true},{Schranke_Zu:true}],[0.1,{Zug_Meldung:false, Freimeldung:true},{Schranke_Zu:false}],[0.1,{Freimeldung:false},{Schranke_Zu:false}]] }
  ],
  wrong:[
    () => 'NETWORK Schranke\nZug_Meldung => SR(Schranke_Zu, Freimeldung);',
    () => 'NETWORK Schranke\nZug_Meldung AND NOT Freimeldung => Schranke_Zu;',
    () => 'NETWORK Schranke\nZug_Meldung => S Schranke_Zu;'
  ]
});

defExamTask({ id:'x_fup_g_achszaehler', quest:'fup', level:'grund', ch:8, diff:2, timed:true,
  params:{ N:[4, 6, 8] },
  title:'Achsen zählen',
  brief: p => 'Der Achszähler <code>Achse</code> liefert pro Achse einen Impuls. Nach <b>' + p.N + '</b> Achsen meldet <code>Gleis_Frei_Pruefen</code> 1. <code>Grundstellung</code> setzt den Zähler zurück. Verwende eine CTU-Box mit der Instanz <code>Z_Achsen</code>.',
  vars: () => ({ Achse:false, Grundstellung:false, Gleis_Frei_Pruefen:false }),
  start: () => 'NETWORK Achsen\n? => ?;\n',
  ref: p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + p.N + ', R:=Grundstellung) => Gleis_Frei_Pruefen;',
  must:['CTU'],
  visible: () => seq([[0.1,{Achse:true},{Gleis_Frei_Pruefen:false}],[0.1,{Achse:false},{Gleis_Frei_Pruefen:false}]]),
  hidden: p => {
    const st = [];
    for(let i = 1; i <= p.N; i++){ st.push([0.1,{Achse:true},{Gleis_Frei_Pruefen:i >= p.N}]); st.push([0.1,{Achse:false},{}]); }
    return [
      { steps: st },
      { steps: st.slice(0, 2 * p.N - 2).concat([[0.1,{Grundstellung:true},{Gleis_Frei_Pruefen:false}],[0.1,{Grundstellung:false},{}],[0.1,{Achse:true},{Gleis_Frei_Pruefen:false}]]) },
      { steps: st.concat([[0.1,{Grundstellung:true},{Gleis_Frei_Pruefen:false}],[0.1,{Grundstellung:false, Achse:true},{Gleis_Frei_Pruefen:false}]]) },
      { steps:[[0.1,{Achse:true},{}],[0.1,{Achse:true},{}],[0.1,{Achse:true},{Gleis_Frei_Pruefen:p.N <= 1}],[0.1,{Achse:false},{}]] }
    ];
  },
  wrong:[
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + (p.N + 1) + ', R:=Grundstellung) => Gleis_Frei_Pruefen;',
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + p.N + ') => Gleis_Frei_Pruefen;',
    p => 'NETWORK Achsen\nAchse AND CTU(Z_Achsen, PV:=' + (p.N - 1) + ', R:=Grundstellung) => Gleis_Frei_Pruefen;'
  ]
});

/* ---------- Profi-Stufe ---------- */
const SIG_D = { in:'Fahrstrasse:Bool|Fahrstrasse festgelegt; Gleis_Frei:Bool|Gleisfreimeldung; Stoerung:Bool|Signalstörung', out:'Fahrt:Bool|Signal zeigt Fahrt' };
defExamTask({ id:'x_fup_p_signal', quest:'fup', level:'profi', ch:11, diff:1,
  title:'Signal-FC',
  brief: () => 'Programmiere die Funktion <code>FC_Signal</code>: <code>#Fahrt</code> ist 1, wenn <code>#Fahrstrasse</code> <b>und</b> <code>#Gleis_Frei</code> 1 sind und <b>keine</b> <code>#Stoerung</code> ansteht. Der OB <code>Main</code> (🔒) ruft die FC für das Einfahrsignal auf.',
  blocks: () => [
    { name:'FC_Signal', kind:'FC', edit:true, start: kFC('FC_Signal', 'Void', SIG_D, ''), ref: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei AND NOT #Stoerung => #Fahrt;') },
    { name:'Main', kind:'OB', src: kOB('Main', 'NETWORK Einfahrsignal\n=> "FC_Signal"(Fahrstrasse := "FS_Fest", Gleis_Frei := "Gleis1_frei", Stoerung := "Sig_Stoer", Fahrt => "Signal_Fahrt");') }
  ],
  globals: () => ({ FS_Fest:false, Gleis1_frei:false, Sig_Stoer:false, Signal_Fahrt:false }),
  must:['SERIES'],
  visible: () => ({ tests:[[{FS_Fest:true, Gleis1_frei:true},{Signal_Fahrt:true}]] }),
  hidden: () => ({
    unit:[{ block:'FC_Signal', steps: truth(['Fahrstrasse','Gleis_Frei','Stoerung'], e => ({ Fahrt: e.Fahrstrasse && e.Gleis_Frei && !e.Stoerung })) }],
    tests:[[{FS_Fest:true, Gleis1_frei:true, Sig_Stoer:true},{Signal_Fahrt:false}],[{FS_Fest:false, Gleis1_frei:true},{Signal_Fahrt:false}]]
  }),
  wrong:[
    () => ({ FC_Signal: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n#Fahrstrasse AND #Gleis_Frei => #Fahrt;') }),
    () => ({ FC_Signal: kFC('FC_Signal', 'Void', SIG_D, 'NETWORK Signal\n(#Fahrstrasse OR #Gleis_Frei) AND NOT #Stoerung => #Fahrt;') })
  ]
});

/* ---------- Fragen ---------- */
defExamQuestion({ id:'xq_fup_g_xor', quest:'fup', level:'grund', ch:2, q:'Wann liefert eine X-Box (XOR) mit zwei Eingängen eine 1?', options:['Wenn genau ein Eingang 1 ist', 'Wenn beide Eingänge 1 sind', 'Wenn mindestens ein Eingang 1 ist', 'Wenn beide Eingänge 0 sind'], answer:0 });
defExamQuestion({ id:'xq_fup_g_sr', quest:'fup', level:'grund', ch:4, q:'In einer SR-Box liegen S und R gleichzeitig an. Welchen Zustand hat Q?', options:['0 – Rücksetzen ist dominant', '1 – Setzen ist dominant', 'Q wechselt jeden Zyklus', 'Q behält den alten Wert'], answer:0 });
defExamQuestion({ id:'xq_fup_p_multi', quest:'fup', level:'profi', ch:12, q:'Was ist eine Multiinstanz?', options:['Eine FB-Instanz, die in den statischen Daten eines anderen FB liegt', 'Ein FB, der mehrere OBs aufruft', 'Eine FC mit mehreren Rückgabewerten', 'Ein Datenbaustein mit mehreren Arrays'], answer:0 });
})();
