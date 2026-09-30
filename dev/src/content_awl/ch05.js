/* ===== AWL QUEST · KAPITEL 5 — Zeiten ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a5_se', ch:5, title:'Erst Druck, dann Walzen',
  story:'Die Walzen dürfen erst anlaufen, wenn die Hydraulik 3 Sekunden nach dem Pumpenstart Druck aufgebaut hat. Herr Brunner: „Dafür nahm man immer ein SE.“',
  brief:'Die Walzen werden 3 Sekunden nach dem Start der Hydraulikpumpe freigegeben (Einschaltverzögerung <code>SE</code>). Stoppt die Pumpe, fällt die Freigabe sofort weg.',
  learn:'Einschaltverzögerung SE.',
  take:'<code>L S5T#3S</code> lädt den Zeitwert in AKKU1, <code>SE T1</code> startet die Einschaltverzögerung mit dem VKE. <code>U T1</code> ist 1, sobald die Zeit abgelaufen ist und das VKE noch ansteht.',
  vars:{ Pumpe:false, Walzen_Frei:false },
  timed: seq([[0, { Pumpe:true }, { Walzen_Frei:false }], [1, {}, { Walzen_Frei:false }], [1.5, {}, { Walzen_Frei:false }], [0.6, {}, { Walzen_Frei:true }], [0.1, { Pumpe:false }, { Walzen_Frei:false }]]),
  ref:'U  Pumpe\nL  S5T#3S\nSE T1\nU  T1\n=  Walzen_Frei', man:'zeiten', must:['SE', 'TIMER_BIT'],
  hint:'U Pumpe · L S5T#3S · SE T1 · U T1 · = Walzen_Frei',
  bind:['pumpRunning=Pumpe', 'rollsRunning=Walzen_Frei'] });

defAwl({ id:'a5_sa', ch:5, title:'Nachkühlen',
  story:'Nach dem Walzen müssen die Walzen noch <b>5 Sekunden</b> gekühlt werden, sonst verziehen sie sich. Das Wasser läuft, solange gewalzt wird, und danach noch weiter.',
  brief:'Das Kühlwasser läuft, solange die Walzen laufen, und danach noch 5 Sekunden (Ausschaltverzögerung <code>SA</code>).',
  learn:'Ausschaltverzögerung SA.',
  take:'<code>SA</code> ist die Ausschaltverzögerung: Das Zeitbit ist 1, solange das VKE 1 ist, und bleibt nach dem Abschalten noch die eingestellte Zeit an.',
  vars:{ Walzen:false, Kuehlung:false },
  timed: seq([[0, { Walzen:true }, { Kuehlung:true }], [2, {}, { Kuehlung:true }], [0.1, { Walzen:false }, { Kuehlung:true }], [4, {}, { Kuehlung:true }], [1.1, {}, { Kuehlung:false }]]),
  ref:'U  Walzen\nL  S5T#5S\nSA T2\nU  T2\n=  Kuehlung', man:'zeiten', must:['SA'],
  hint:'Wie bei SE, aber mit SA T2.',
  bind:['rollsRunning=Walzen', 'coolingOn=Kuehlung'] });

defAwl({ id:'a5_si', ch:5, title:'Die Hupe schont die Ohren',
  story:'Die Warnhupe tutet, solange der Taster gedrückt ist — aber höchstens <b>2 Sekunden</b>. Wer den Taster festhält, soll nicht die ganze Halle taub machen.',
  brief:'Die Warnhupe tönt, solange ihr Taster gedrückt ist, aber höchstens 2 Sekunden (Impuls <code>SI</code>).',
  learn:'Impuls SI.',
  take:'<code>SI</code> erzeugt einen Impuls: Das Zeitbit wird mit dem VKE 1 und fällt nach der Zeit ab — oder früher, wenn das VKE vorher 0 wird.',
  vars:{ S_Hupe:false, Hupe:false },
  timed: seq([[0, { S_Hupe:true }, { Hupe:true }], [1, {}, { Hupe:true }], [1.1, {}, { Hupe:false }], [1, {}, { Hupe:false }], [0.1, { S_Hupe:false }, { Hupe:false }], [0.1, { S_Hupe:true }, { Hupe:true }], [0.5, { S_Hupe:false }, { Hupe:false }]]),
  ref:'U  S_Hupe\nL  S5T#2S\nSI T3\nU  T3\n=  Hupe', man:'zeiten', must:['SI'],
  hint:'SI T3 statt SE.',
  bind:['hornActive=Hupe'] });

defAwl({ id:'a5_sv', ch:5, title:'Ein voller Schnitt',
  story:'Der Schnittbefehl kommt von einem kurzen Impuls. Die Schere braucht aber <b>1 Sekunde</b> für einen sauberen Schnitt — auch wenn der Impuls schon vorbei ist.',
  brief:'Ein kurzer Schnittbefehl lässt die Schere volle 1 Sekunde abfahren, auch wenn der Befehl schon weg ist (verlängerter Impuls <code>SV</code>).',
  learn:'Verlängerter Impuls SV.',
  take:'<code>SV</code> ist der verlängerte Impuls: Einmal gestartet, läuft er die volle Zeit — egal, ob das VKE dazwischen wieder 0 wird.',
  vars:{ Schnitt:false, Schere:false },
  timed: seq([[0, { Schnitt:true }, { Schere:true }], [0.1, { Schnitt:false }, { Schere:true }], [0.5, {}, { Schere:true }], [0.5, {}, { Schere:false }], [0.1, {}, { Schere:false }]]),
  ref:'U  Schnitt\nL  S5T#1S\nSV T4\nU  T4\n=  Schere', man:'zeiten', must:['SV'],
  wrong:['U  Schnitt\nL  S5T#1S\nSI T4\nU  T4\n=  Schere'],
  hint:'SV T4.',
  bind:['shearDown=Schere'] });

defAwl({ id:'a5_zeit_dbg', ch:5, title:'Die ewige Wartezeit', debug:true,
  story:'Nach dem Pumpenstart wartet das Gerüst und wartet und wartet. Im Programm steht die richtige Zeitart — aber ARIA hat am Zeitwert gedreht.',
  brief:'Die Walzen sollen <b>3 Sekunden</b> nach dem Pumpenstart freigegeben werden.',
  learn:'Zeitwerte prüfen.',
  take:'Bei S5-Zeiten steht der Zeitwert in der <code>L</code>-Zeile davor. Prüfe beim Lesen immer: Welche Zeit wird geladen, welche Zeit wird gestartet?',
  vars:{ Pumpe:false, Walzen_Frei:false },
  timed: seq([[0, { Pumpe:true }, { Walzen_Frei:false }], [3.1, {}, { Walzen_Frei:true }]]),
  start:'U  Pumpe\nL  S5T#30S\nSE T1\nU  T1\n=  Walzen_Frei', ref:'U  Pumpe\nL  S5T#3S\nSE T1\nU  T1\n=  Walzen_Frei', man:'zeiten', must:['SE'],
  hint:'Der Wert in der L-Zeile.',
  bind:['pumpRunning=Pumpe', 'rollsRunning=Walzen_Frei'] });

defAwl({ id:'a5_vorwarnung', ch:5, title:'Vorwarnung vor dem Anlauf',
  story:'Bevor der Rollgang anläuft, tutet die Hupe <b>2 Sekunden</b> lang, erst dann setzt er sich in Bewegung. Gestartet wird mit einem Taster, gestoppt mit einem anderen.',
  brief:'Start setzt den Anlauf, Stopp löscht ihn. In den ersten 2 Sekunden des Anlaufs tönt die Warnhupe, danach läuft der Rollgang (Einschaltverzögerung <code>SE</code>).',
  learn:'Zeit als Teil eines Ablaufs.',
  take:'Während die Einschaltverzögerung läuft, ist das Zeitbit 0: Mit <code>UN T1</code> fragst du „Zeit läuft noch“ ab. Ist sie abgelaufen, geht es mit <code>U T1</code> weiter.',
  vars:{ S_Start:false, S_Stopp:false, Anlauf:false, Hupe:false, Rollgang:false },
  timed: seq([[0, { S_Start:true }, { Hupe:true, Rollgang:false }], [0.1, { S_Start:false }, { Hupe:true }], [1, {}, { Hupe:true, Rollgang:false }], [1, {}, { Hupe:false, Rollgang:true }], [0.1, { S_Stopp:true }, { Rollgang:false, Hupe:false }]]),
  ref:'U  S_Start\nS  Anlauf\nU  S_Stopp\nR  Anlauf\nU  Anlauf\nL  S5T#2S\nSE T1\nU  Anlauf\nUN T1\n=  Hupe\nU  T1\n=  Rollgang', man:'zeiten', must:['SE', 'S', 'R'],
  hint:'Die Hupe ist an, solange Anlauf gesetzt ist und T1 noch nicht abgelaufen ist.',
  bind:['hornActive=Hupe', 'conveyorRunning=Rollgang'] });

defAwl({ id:'a5_blinker', ch:5, title:'Die Blinklampe',
  story:'Bei einer Störung soll die rote Lampe blinken: 0,5 Sekunden an, 0,5 Sekunden aus. Herr Brunner zeichnet den alten Trick auf: zwei Zeiten, die sich gegenseitig starten.',
  brief:'Bei einer Störung blinkt die rote Lampe: 0,5 s an, 0,5 s aus, beginnend mit an. Zwei Einschaltverzögerungen starten sich gegenseitig.',
  learn:'Takt aus zwei Zeiten.',
  take:'T1 läuft ab und startet T2. Sobald T2 abgelaufen ist, fällt der Start von T1 weg — beide setzen sich zurück und alles beginnt von vorn. So entsteht ein Takt.',
  vars:{ Stoerung:false, Lampe_Rot:false },
  timed: seq([[0, { Stoerung:true }, { Lampe_Rot:true }], [0.3, {}, { Lampe_Rot:true }], [0.3, {}, { Lampe_Rot:false }], [0.3, {}, { Lampe_Rot:false }], [0.3, {}, { Lampe_Rot:false }], [0.3, {}, { Lampe_Rot:true }], [0.1, { Stoerung:false }, { Lampe_Rot:false }]]),
  ref:'U  Stoerung\nUN T2\nL  S5T#500MS\nSE T1\nU  T1\nL  S5T#500MS\nSE T2\nU  Stoerung\nUN T1\n=  Lampe_Rot', man:'zeiten', must:['SE'],
  hint:'Die Lampe ist an, solange T1 noch läuft.',
  bind:['lightRed=Lampe_Rot', 'faultActive=Stoerung'] });

defAwl({ id:'a5_art_dbg', ch:5, title:'Die falsche Zeitart', debug:true,
  story:'Das Kühlwasser soll nach dem Walzen noch 4 Sekunden laufen. Stattdessen läuft es erst 4 Sekunden <b>nach dem Start</b> an — und hört sofort auf, wenn das Gerüst stoppt.',
  brief:'Nachlauf = Ausschaltverzögerung. Ersetze die falsche Zeitart.',
  learn:'Zeitarten unterscheiden.',
  take:'SE verzögert das <b>Einschalten</b>, SA das <b>Ausschalten</b>. Wenn ein Ausgang zu spät kommt und zu früh geht, ist oft die Zeitart vertauscht.',
  vars:{ Walzen:false, Kuehlung:false },
  timed: seq([[0, { Walzen:true }, { Kuehlung:true }], [1, { Walzen:false }, { Kuehlung:true }], [4.1, {}, { Kuehlung:false }]]),
  start:'U  Walzen\nL  S5T#4S\nSE T2\nU  T2\n=  Kuehlung', ref:'U  Walzen\nL  S5T#4S\nSA T2\nU  T2\n=  Kuehlung', man:'zeiten', must:['SA'],
  hint:'SE → SA.',
  bind:['rollsRunning=Walzen', 'coolingOn=Kuehlung'] });

defAwl({ id:'a5_ueberwachung', ch:5, title:'Der Block bleibt stecken',
  story:'Läuft der Rollgang länger als <b>6 Sekunden</b>, ohne dass der Block an der Lichtschranke ankommt, klemmt etwas. Dann wird eine Störung gespeichert und der Rollgang gestoppt.',
  brief:'Läuft der Rollgang 6 s, ohne dass die Lichtschranke Block angekommen meldet, wird eine Störung gespeichert und er stoppt. Quittieren löscht sie. Sonst läuft er mit seinem Taster.',
  learn:'Laufzeitüberwachung.',
  take:'Eine Überwachung startet eine Zeit, solange ein Vorgang läuft, aber die Rückmeldung fehlt. Kommt die Rückmeldung nicht rechtzeitig, ist das eine Störung.',
  vars:{ S_Rollgang:false, Block_angekommen:false, Quittieren:false, Rollgang:false, Stoerung:false },
  timed: seq([[0, { S_Rollgang:true }, { Rollgang:true }], [0.1, {}, { Rollgang:true }], [5.9, {}, { Rollgang:true, Stoerung:false }], [0.2, {}, { Stoerung:true, Rollgang:false }], [0.1, { S_Rollgang:false, Quittieren:true }, { Stoerung:false }], [0.1, { Quittieren:false, S_Rollgang:true }, { Rollgang:true }], [2, { Block_angekommen:true }, { Rollgang:true }], [5, {}, { Rollgang:true, Stoerung:false }]]),
  ref:'U  Rollgang\nUN Block_angekommen\nL  S5T#6S\nSE T5\nU  T5\nS  Stoerung\nU  Quittieren\nR  Stoerung\nU  S_Rollgang\nUN Stoerung\n=  Rollgang', man:'zeiten', must:['SE', 'S', 'R'],
  hint:'Die Zeit startet mit „Rollgang läuft UND Block nicht angekommen“.',
  bind:['conveyorRunning=Rollgang', 'faultActive=Stoerung', 'billetVisible=Block_angekommen'] });

defAwl({ id:'a5_boss', ch:5, title:'Boss: Die Ofentür', boss:true,
  story:'ARIA reisst die Ofentür auf und lässt die Heizung brennen. Herr Brunner: „Der Taster öffnet die Tür für volle 4 Sekunden, dabei warnt die Hupe 1 Sekunde, und solange sie offen ist und noch 2 Sekunden danach heizt der Ofen nicht.“',
  brief:'Taster Ofentür öffnet die Tür volle 4 s (<code>SV</code>), dabei tönt die Hupe 1 s (<code>SI</code>). Taster Ofen heizen schaltet die Heizung, aber nicht bei offener Tür und 2 s danach (<code>SA</code>).',
  learn:'Mehrere Zeitarten in einem Ablauf.',
  take:'SV für einen festen Ablauf, SA für einen Nachlauf, SI für eine begrenzte Warnung: Jede S5-Zeitart hat ihre typische Aufgabe.',
  vars:{ S_Tuer:false, S_Heizen:false, Tuer_offen:false, Heizung:false, Hupe:false },
  timed: seq([[0, { S_Heizen:true }, { Heizung:true }], [0.1, { S_Tuer:true }, { Tuer_offen:true, Hupe:true, Heizung:false }], [0.1, { S_Tuer:false }, { Tuer_offen:true, Hupe:true }], [1, {}, { Hupe:false, Tuer_offen:true, Heizung:false }], [3, {}, { Tuer_offen:false, Heizung:false }], [1, {}, { Heizung:false }], [1.1, {}, { Heizung:true }]]),
  ref:'NETWORK Tuer\nU  S_Tuer\nL  S5T#4S\nSV T1\nU  T1\n=  Tuer_offen\n\nNETWORK Sperrzeit\nU  Tuer_offen\nL  S5T#2S\nSA T2\n\nNETWORK Heizung\nU  S_Heizen\nUN T2\n=  Heizung\n\nNETWORK Warnung\nU  Tuer_offen\nL  S5T#1S\nSI T3\nU  T3\n=  Hupe', man:'zeiten', must:['SV', 'SA', 'SI'],
  hint:'Vier Netzwerke: Tür (SV), Sperrzeit (SA), Heizung, Warnung (SI).',
  bind:['furnaceDoor=Tuer_offen', 'furnaceOn=Heizung', 'hornActive=Hupe'] });
})();
