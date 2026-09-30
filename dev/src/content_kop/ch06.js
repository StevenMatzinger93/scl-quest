/* ===== KOP QUEST · KAPITEL 6 — Zeiten I: TON, TOF, TP ===== */
(function(){
const seq = steps => [{ steps }];
defKop({ id:'k6_ton', ch:6, title:'Tür öffnet verzögert',
  story:'Öffnet die Tür sofort, schwingt die eingefahrene Kabine noch nach. Der Werkmeister: „Zwei Sekunden warten, dann auf, mit der Einschaltverzögerung TON.“',
  brief:'<code>Tuer_Auf</code> wird 1, wenn <code>Kabine_da</code> <b>2 Sekunden</b> lang 1 ist.<br>Kontakt <code>Kabine_da</code> antippen → <b>Timer</b>. Im Feld <i>Zeit PT</i> <code>T#2S</code> eintragen.',
  learn:'TON als Box im Strompfad: Der Ausgang folgt dem Eingang mit Verzögerung.',
  take:'Die <b>TON</b>-Box leitet den Strom erst weiter, wenn am Eingang <b>PT lang</b> ununterbrochen Strom ansteht. Fällt der Eingang weg, fällt auch der Ausgang sofort ab.',
  vars:{ Kabine_da:false, Tuer_Auf:false },
  timed: seq([[0,{},{Tuer_Auf:false}],[0.1,{Kabine_da:true},{Tuer_Auf:false}],[1,{},{Tuer_Auf:false}],[1,{},{Tuer_Auf:true}],[3,{},{Tuer_Auf:true}],[0.1,{Kabine_da:false},{Tuer_Auf:false}]]),
  ref:'NETWORK Tuer oeffnen\nKabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;', man:'timer', must:['TON'],
  hint:'Kontakt, Timer-Box, Spule — in dieser Reihenfolge.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf'] });

defKop({ id:'k6_tof', ch:6, title:'Licht mit Nachlauf',
  story:'Im Wartebereich geht das Licht an, sobald jemand da ist. Wenn der letzte Gast geht, soll es noch 5 Sekunden brennen — die Ausschaltverzögerung TOF.',
  brief:'<code>Beleuchtung</code> ist an, solange <code>Person_da</code> 1 ist, und noch <b>5 Sekunden</b> danach.<br>Timer einfügen und im Feld <i>Typ</i> <b>TOF</b> wählen.',
  learn:'TOF: Der Ausgang bleibt nach dem Abschalten noch PT lang an.',
  take:'Die <b>TOF</b>-Box schaltet sofort ein und <b>verzögert das Ausschalten</b>. Kommt der Eingang in der Nachlaufzeit wieder, beginnt die Zeit neu.',
  vars:{ Person_da:false, Beleuchtung:false },
  timed: seq([[0,{Person_da:true},{Beleuchtung:true}],[1,{},{Beleuchtung:true}],[0.1,{Person_da:false},{Beleuchtung:true}],[3,{},{Beleuchtung:true}],[1,{Person_da:true},{Beleuchtung:true}],[0.1,{Person_da:false},{Beleuchtung:true}],[4,{},{Beleuchtung:true}],[1.5,{},{Beleuchtung:false}]]),
  ref:'NETWORK Licht Nachlauf\nPerson_da AND TOF(T_Licht, T#5S) => Beleuchtung;', man:'timer', must:['TOF'],
  hint:'Wie beim TON, nur mit dem Typ TOF.',
  bind:['lightsOn=Beleuchtung','personWaiting=Person_da'] });

defKop({ id:'k6_tp', ch:6, title:'Der Gong',
  story:'Fährt eine Kabine ein, soll ein Gong genau 1 Sekunde lang ertönen — egal, wie lange die Kabine steht. Das ist ein Impuls: TP.',
  brief:'Wenn <code>Kabine_da</code> 1 wird, ist <code>Hupe</code> genau <b>1 Sekunde</b> lang 1.',
  learn:'TP erzeugt einen Impuls fester Länge.',
  take:'Die <b>TP</b>-Box startet bei einer steigenden Flanke am Eingang einen Impuls der Länge PT — unabhängig davon, wie lange der Eingang ansteht.',
  vars:{ Kabine_da:false, Hupe:false },
  timed: seq([[0,{Kabine_da:true},{Hupe:true}],[0.5,{},{Hupe:true}],[0.6,{},{Hupe:false}],[3,{},{Hupe:false}],[0.1,{Kabine_da:false},{Hupe:false}],[0.1,{Kabine_da:true},{Hupe:true}],[0.2,{Kabine_da:false},{Hupe:true}],[1,{},{Hupe:false}]]),
  ref:'NETWORK Gong\nKabine_da AND TP(T_Gong, T#1S) => Hupe;', man:'timer', must:['TP'],
  hint:'Timer-Box mit Typ TP und T#1S.',
  bind:['cabinInStation=Kabine_da','hornActive=Hupe'] });

defKop({ id:'k6_zeit_dbg', ch:6, title:'Zwanzig Sekunden Geduld', debug:true,
  story:'Die Gäste stehen vor der Kabine und warten und warten. ARIA hat die Wartezeit der Tür verzehnfacht.',
  brief:'Die Tür (<code>Tuer_Auf</code>) soll <b>2 Sekunden</b> nach Einfahrt der Kabine öffnen.',
  learn:'Zeitangaben prüfen: T#2S, T#500MS, T#1M30S.',
  take:'Zeiten stehen im Format <code>T#…</code>: <code>T#2S</code> = 2 s, <code>T#500MS</code> = 0,5 s, <code>T#1M</code> = 1 min.',
  vars:{ Kabine_da:false, Tuer_Auf:false },
  timed: seq([[0,{Kabine_da:true},{Tuer_Auf:false}],[2.1,{},{Tuer_Auf:true}]]),
  start:'NETWORK Tuer oeffnen\nKabine_da AND TON(T_Tuer, T#20S) => Tuer_Auf;', ref:'NETWORK Tuer oeffnen\nKabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;', man:'timer', must:['TON'],
  hint:'Box antippen und die Zeit PT prüfen.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf'] });

defKop({ id:'k6_autozu', ch:6, title:'Tür schliesst von selbst',
  story:'Die Tür bleibt offen, bis jemand „Tür zu“ drückt — und alle vergessen es. Jetzt soll sie nach 5 Sekunden von selbst schliessen.',
  brief:'<b>NW 1:</b> <code>S_Tuer_Auf</code> setzt <code>Tuer_Auf</code>.<br><b>NW 2:</b> <code>Tuer_Auf</code> mit <b>TON 5 s</b> setzt <code>Tuer_Auf</code> zurück.',
  learn:'Timer und S/R kombinieren: automatisches Rücksetzen nach Zeit.',
  take:'Ein TON auf dem eigenen Zustand ergibt eine <b>Haltezeit</b>: „nach 5 s im Zustand X → X beenden“.',
  vars:{ S_Tuer_Auf:false, Tuer_Auf:false },
  timed: seq([[0,{S_Tuer_Auf:true},{Tuer_Auf:true}],[0.1,{S_Tuer_Auf:false},{Tuer_Auf:true}],[3,{},{Tuer_Auf:true}],[2,{},{Tuer_Auf:false}],[1,{},{Tuer_Auf:false}],[0.1,{S_Tuer_Auf:true},{Tuer_Auf:true}]]),
  ref:'NETWORK Tuer auf\nS_Tuer_Auf => S Tuer_Auf;\n\nNETWORK Tuer zu nach Zeit\nTuer_Auf AND TON(T_Offen, T#5S) => R Tuer_Auf;', man:'timer', must:['TON','SET','RESET'],
  hint:'Im zweiten Netzwerk steht Tuer_Auf selbst als Kontakt vor dem Timer.',
  bind:['doorOpen=Tuer_Auf'] });

defKop({ id:'k6_windfilter', ch:6, title:'Böen filtern',
  story:'Jede kleine Böe löst die Windwarnung aus — die Gäste werden nervös. Die Warnung soll erst kommen, wenn der Windwächter 3 Sekunden ununterbrochen anspricht.',
  brief:'<code>Windwarnung</code> := <code>Wind_hoch</code> mit Einschaltverzögerung <b>3 s</b>. Zusätzlich leuchtet <code>Ampel_Gelb</code> gleich (zweite Spule).',
  learn:'TON als Filter gegen kurze Störimpulse.',
  take:'Eine Einschaltverzögerung <b>filtert</b> kurze Signale: Nur was länger als PT ansteht, kommt durch.',
  vars:{ Wind_hoch:false, Windwarnung:false, Ampel_Gelb:false },
  timed: seq([[0,{Wind_hoch:true},{Windwarnung:false}],[1,{},{Windwarnung:false}],[0.1,{Wind_hoch:false},{Windwarnung:false}],[0.1,{Wind_hoch:true},{Windwarnung:false}],[2,{},{Windwarnung:false}],[1.2,{},{Windwarnung:true, Ampel_Gelb:true}],[0.1,{Wind_hoch:false},{Windwarnung:false}]]),
  ref:'NETWORK Windwarnung\nWind_hoch AND TON(T_Wind, T#3S) => Windwarnung, Ampel_Gelb;', man:'timer', must:['TON','MULTI_OUT'],
  hint:'TON 3 s, zwei Spulen am Ende.',
  bind:['windWarn=Windwarnung','lightYellow=Ampel_Gelb'] });

defKop({ id:'k6_tof_dbg', ch:6, title:'Nachlauf, der keiner ist', debug:true,
  story:'Das Licht im Wartebereich geht erst 5 Sekunden NACH dem Eintreten an — und sofort aus, wenn der Gast geht. ARIA hat den falschen Timertyp gewählt.',
  brief:'<code>Beleuchtung</code> soll sofort mit <code>Person_da</code> angehen und <b>5 s nachlaufen</b>.',
  learn:'TON und TOF unterscheiden.',
  take:'TON verzögert das <b>Ein</b>schalten, TOF das <b>Aus</b>schalten.',
  vars:{ Person_da:false, Beleuchtung:false },
  timed: seq([[0,{Person_da:true},{Beleuchtung:true}],[0.1,{Person_da:false},{Beleuchtung:true}],[5.2,{},{Beleuchtung:false}]]),
  start:'NETWORK Licht Nachlauf\nPerson_da AND TON(T_Licht, T#5S) => Beleuchtung;', ref:'NETWORK Licht Nachlauf\nPerson_da AND TOF(T_Licht, T#5S) => Beleuchtung;', man:'timer', must:['TOF'],
  hint:'Box antippen, Typ ändern.',
  bind:['lightsOn=Beleuchtung','personWaiting=Person_da'] });

defKop({ id:'k6_bremse', ch:6, title:'Die Bremse',
  story:'Die Bremse muss offen sein, solange der Antrieb läuft, und noch 1 Sekunde danach, damit das Seil sanft ausläuft. <code>Bremse</code> ist 1, wenn die Bremse eingefallen ist.',
  brief:'<code>Antrieb</code> → <b>TOF 1 s</b> → <b>negierte Spule</b> <code>Bremse</code>.<br>Also: <code>Bremse</code> = 0 während der Fahrt und 1 s danach, sonst 1.',
  learn:'TOF mit negierter Spule für eine Abfallverzögerung der Bremse.',
  take:'Eine Bremse fällt <b>verzögert</b> ein, damit die Anlage kontrolliert ausläuft. Die negierte Spule liefert direkt „Bremse zu“.',
  vars:{ Antrieb:false, Bremse:true },
  timed: seq([[0,{},{Bremse:true}],[0.1,{Antrieb:true},{Bremse:false}],[2,{},{Bremse:false}],[0.1,{Antrieb:false},{Bremse:false}],[0.5,{},{Bremse:false}],[0.6,{},{Bremse:true}]]),
  ref:'NETWORK Bremse\nAntrieb AND TOF(T_Bremse, T#1S) => NOT Bremse;', man:'timer', must:['TOF','NCOIL'],
  hint:'Kontakt Antrieb, TOF-Box, dann die Spule auf „Negiert“ stellen.',
  bind:['motorOn=Antrieb','brake=Bremse'] });

defKop({ id:'k6_signal', ch:6, title:'Abfahrtssignal',
  story:'Bevor die Kabine abfährt, drückt der Bediener „Abfahrt“. Dann tönt die Hupe 2 Sekunden (TP), und genau so lange leuchtet die gelbe Lampe.',
  brief:'<code>S_Abfahrt</code> → <b>TP 2 s</b> → <code>Hupe</code> und <code>Ampel_Gelb</code>.',
  learn:'TP mit mehreren Spulen.',
  take:'Ein TP-Impuls kann mehrere Ausgänge gleichzeitig treiben — praktisch für Warnsignale.',
  vars:{ S_Abfahrt:false, Hupe:false, Ampel_Gelb:false },
  timed: seq([[0,{S_Abfahrt:true},{Hupe:true, Ampel_Gelb:true}],[0.2,{S_Abfahrt:false},{Hupe:true}],[1.5,{},{Hupe:true}],[0.5,{},{Hupe:false, Ampel_Gelb:false}]]),
  ref:'NETWORK Abfahrtssignal\nS_Abfahrt AND TP(T_Signal, T#2S) => Hupe, Ampel_Gelb;', man:'timer', must:['TP','MULTI_OUT'],
  hint:'TP-Box mit T#2S und zwei Spulen.',
  bind:['hornActive=Hupe','lightYellow=Ampel_Gelb'] });

defKop({ id:'k6_boss', ch:6, title:'Boss: Einfahrt und Halt', boss:true,
  story:'ARIA schlägt die Türen auf, bevor die Kabine steht, und die Bremse fällt mitten in der Fahrt ein. Der Werkmeister stellt dir die Stoppuhr hin: „Jede Sekunde zählt.“',
  brief:'<b>NW 1:</b> <code>Kabine_da</code> → TON 2 s → <code>Tuer_Auf</code><br><b>NW 2:</b> <code>Kabine_da</code> → TP 1 s → <code>Hupe</code><br><b>NW 3:</b> <code>Antrieb</code> → TOF 1 s → negierte Spule <code>Bremse</code><br><b>NW 4:</b> <code>Person_da</code> → TOF 5 s → <code>Beleuchtung</code>',
  learn:'TON, TOF und TP sicher einsetzen.',
  take:'Zeitglieder sind die Werkzeuge für Wartezeiten, Nachläufe und Impulse — sie machen Abläufe ruhig und sicher.',
  vars:{ Kabine_da:false, Antrieb:false, Person_da:false, Tuer_Auf:false, Hupe:false, Bremse:true, Beleuchtung:false },
  timed: seq([[0,{Antrieb:true},{Bremse:false, Tuer_Auf:false}],[1,{Antrieb:false, Kabine_da:true},{Hupe:true, Bremse:false, Tuer_Auf:false}],[2.1,{},{Hupe:false, Bremse:true, Tuer_Auf:true}],[0.1,{Person_da:true},{Beleuchtung:true}],[0.1,{Person_da:false},{Beleuchtung:true}],[5.2,{},{Beleuchtung:false}],[0.1,{Kabine_da:false},{Tuer_Auf:false}]]),
  ref:'NETWORK Tuer\nKabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;\n\nNETWORK Gong\nKabine_da AND TP(T_Gong, T#1S) => Hupe;\n\nNETWORK Bremse\nAntrieb AND TOF(T_Bremse, T#1S) => NOT Bremse;\n\nNETWORK Licht\nPerson_da AND TOF(T_Licht, T#5S) => Beleuchtung;',
  man:'timer', must:['TON','TOF','TP'],
  hint:'Jedes Netzwerk hat genau einen Timer. Verwende verschiedene Instanznamen.',
  bind:['cabinInStation=Kabine_da','doorOpen=Tuer_Auf','hornActive=Hupe','motorOn=Antrieb','brake=Bremse','lightsOn=Beleuchtung','personWaiting=Person_da'] });
})();
