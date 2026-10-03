/* ===== KAPITEL 9 — Takt & Timing: TON, TOF, TP ===== */
(function(){
function blinkSteps(){
  // 0,1 s-Raster über 2,5 s — zeigt die Umschaltpunkte eines selbstrücksetzenden Taktgebers
  const s = [[0,{Aktiv:true},{Lampe:false}]];
  for(let i = 1; i <= 25; i++){
    const t = Math.round(i*10)/100*10/10;
    const exp = {};
    if(i === 9) exp.Lampe = false;       // t = 0.9
    if(i === 10) exp.Lampe = true;       // t = 1.0 → erste Umschaltung
    if(i === 21) exp.Lampe = true;       // t = 2.1
    if(i === 22) exp.Lampe = false;      // t = 2.2 → zweite Umschaltung
    s.push([0.1, i === 25 ? {Aktiv:false} : {}, i === 25 ? {Lampe:false} : exp]);
  }
  return s;
}

defTask({ id:'r5t3', ch:9, title:'Einschaltverzögerung (TON)',
  story:'Der Greifer braucht nach dem Andocken 3 Sekunden, bis der Unterdruck steht, sonst fällt das Teil runter. ARIA: "Warten ist so menschlich."',
  brief:'Der Greifer meldet erst bereit, wenn das Andock-Signal 3 s ununterbrochen ansteht (Bereit-Timer, <code>TON</code>). Fällt das Signal ab, ist er sofort nicht mehr bereit.',
  learn:'TON: Q wird erst TRUE, wenn IN mindestens PT lang ununterbrochen TRUE war.',
  take:'Fällt IN vor Ablauf von PT ab, beginnt die Zeit beim nächsten Mal von vorn. TON = „erst nach Wartezeit an, sofort aus“.',
  vars:{Andock_Signal:false, Greifer_Bereit:false}, fb:{Bereit_Timer:'TON'},
  timed:[{steps:[[0,{Andock_Signal:true},{Greifer_Bereit:false}],[1,{},{Greifer_Bereit:false}],[1,{},{Greifer_Bereit:false}],[1,{},{Greifer_Bereit:true}],[1,{},{Greifer_Bereit:true}],[1,{Andock_Signal:false},{Greifer_Bereit:false}]]},
         {steps:[[0,{Andock_Signal:true},{}],[2,{Andock_Signal:false},{Greifer_Bereit:false}],[1,{Andock_Signal:true},{Greifer_Bereit:false}],[2,{},{Greifer_Bereit:false}],[1,{},{Greifer_Bereit:true}]]}],
  ref:'Bereit_Timer(IN := Andock_Signal, PT := T#3S);\nGreifer_Bereit := Bereit_Timer.Q;', man:'timer', must:['TON'],
  hint:'Zeitangaben schreibt man als Zeit-Literal: <code>T#3S</code>.',
  bind:['lightYellow=Andock_Signal','lightGreen=Greifer_Bereit','gripperOpen:true','partVisible:true'],
  wrong:['Greifer_Bereit := Andock_Signal;']
});

defTask({ id:'r5t5', ch:9, title:'Lüfter-Nachlauf (TOF)',
  story:'Nach dem Abschalten des Bandmotors muss der Kühllüfter noch 10 Sekunden nachlaufen, sonst staut sich die Hitze im Motor. ARIA schaltet ihn sofort mit ab.',
  brief:'Der Lüfter läuft, sobald der Motor läuft, und nach dem Abschalten des Motors noch 10 s nach. Der Lüfter-Timer (<code>TOF</code>) steht bereit.',
  learn:'TOF: Q ist sofort TRUE, wenn IN TRUE wird, und bleibt nach dem Abfallen von IN noch PT lang TRUE.',
  take:'TOF = „sofort an, verzögert aus“. Typisch für Nachlauf von Lüftern, Pumpen und Beleuchtung.',
  vars:{Luefter_An:false, Motor_Laeuft:false}, fb:{Luefter_Timer:'TOF'},
  timed:[{steps:[[0,{},{Luefter_An:false}],[0,{Motor_Laeuft:true},{Luefter_An:true}],[5,{Motor_Laeuft:false},{Luefter_An:true}],[6,{},{Luefter_An:true}],[3,{},{Luefter_An:true}],[1,{},{Luefter_An:false}],[5,{},{Luefter_An:false}]]}],
  ref:'Luefter_Timer(IN := Motor_Laeuft, PT := T#10S);\nLuefter_An := Luefter_Timer.Q;', man:'timer', must:['TOF'],
  hint:'Gleicher Aufbau wie beim TON — nur ein anderer Bausteintyp.',
  bind:['beltRunning=Motor_Laeuft','lightYellow=Luefter_An'],
  wrong:['Luefter_An := Motor_Laeuft;']
});

defTask({ id:'c9_tp', ch:9, title:'Hupsignal (TP)',
  story:'Bei jeder neuen Störung soll die Hupe genau 2 Sekunden ertönen — nicht länger, auch wenn die Störung bleibt. ARIA hätte gerne eine Dauerhupe.',
  brief:'Bei jeder neuen Störung ertönt die Hupe genau 2 s, egal wie lange die Störung ansteht. Der Hupen-Impuls (<code>TP</code>) steht bereit.',
  learn:'TP erzeugt bei steigender Flanke einen Impuls fester Länge.',
  take:'TP = „Impuls mit fester Dauer“. Die Länge hängt nur von PT ab — nicht davon, wie lange IN anliegt.',
  vars:{Stoerung:false, Hupe:false}, fb:{Hupen_Impuls:'TP'},
  timed:[{steps:[[0,{Stoerung:true},{Hupe:true}],[1,{},{Hupe:true}],[1,{},{Hupe:false}],[5,{},{Hupe:false}],[0,{Stoerung:false},{Hupe:false}],[1,{Stoerung:true},{Hupe:true}],[1,{Stoerung:false},{Hupe:true}],[1,{},{Hupe:false}]]}],
  ref:'Hupen_Impuls(IN := Stoerung, PT := T#2S);\nHupe := Hupen_Impuls.Q;', man:'timer', must:['TP'],
  hint:'Aufbau wie TON/TOF, Typ TP.',
  bind:['hornActive=Hupe','faultActive=Stoerung','lightRed=Stoerung'],
  wrong:['Hupe := Stoerung;']
});

defTask({ id:'r5t8', ch:9, title:'Timer wird ignoriert', debug:true,
  story:'Das Band soll nach dem Stopp-Befehl noch 5 Sekunden leer laufen, stoppt aber sofort. Der Timer steht im Code, trotzdem bleiben Teile auf dem Band liegen.',
  brief:'Das Band soll nach dem Stopp-Taster noch 5 s weiterlaufen (Nachlauf-Timer, TOF), folgt aber direkt dem Taster. Behebe es.',
  learn:'Einen Timer aufzurufen reicht nicht — man muss auch seinen Ausgang verwenden.',
  take:'Ein Baustein, dessen Ausgang niemand liest, ist wirkungslos. Bei Timer-Problemen immer prüfen: Wird <code>.Q</code> wirklich verwendet?',
  vars:{Band_Laeuft:false, Stopp_Taster:false}, fb:{Nachlauf_Timer:'TOF'},
  timed:[{steps:[[0,{Stopp_Taster:true},{Band_Laeuft:true}],[3,{Stopp_Taster:false},{Band_Laeuft:true}],[3,{},{Band_Laeuft:true}],[3,{},{Band_Laeuft:false}]]}],
  start:'Nachlauf_Timer(IN := Stopp_Taster, PT := T#5S);\nBand_Laeuft := Stopp_Taster;',
  ref:'Nachlauf_Timer(IN := Stopp_Taster, PT := T#5S);\nBand_Laeuft := Nachlauf_Timer.Q;', man:'timer',
  hint:'Welcher Wert sollte rechts in Zeile 2 stehen?',
  bind:['beltRunning=Band_Laeuft','lightRed=Stopp_Taster']
});

defTask({ id:'c9_anlauf', ch:9, title:'Anlaufwarnung',
  story:'Bevor das Band anläuft, müssen alle gewarnt werden: 2 Sekunden Hupe und gelbe Lampe, erst dann Bewegung. So schreibt es die Maschinenrichtlinie vor.',
  brief:'Nach der Freigabe läuft das Band erst nach 2 s an (Anlauf-Timer, <code>TON</code>). Während dieser Wartezeit sind Warnung und Hupe an. Ohne Freigabe ist alles aus.',
  learn:'Ein Timer-Ausgang als Freigabe, sein Gegenteil als Warnphase.',
  take:'„Freigabe AND NOT Timer.Q“ beschreibt die Wartezeit selbst — ein sehr häufiges Muster für Vorwarnungen.',
  vars:{Freigabe:false, Band_Lauf:false, Warnung:false, Hupe:false}, fb:{Anlauf_Timer:'TON'},
  timed:[{steps:[[0,{},{Band_Lauf:false, Warnung:false}],[0,{Freigabe:true},{Band_Lauf:false, Warnung:true, Hupe:true}],[1,{},{Warnung:true}],[1,{},{Band_Lauf:true, Warnung:false, Hupe:false}],[5,{},{Band_Lauf:true}],[1,{Freigabe:false},{Band_Lauf:false, Warnung:false, Hupe:false}]]}],
  ref:'Anlauf_Timer(IN := Freigabe, PT := T#2S);\nBand_Lauf := Anlauf_Timer.Q;\nWarnung := Freigabe AND NOT Band_Lauf;\nHupe := Warnung;', man:'timer', must:['TON'],
  hint:'Die Warnung ist genau dann aktiv, wenn freigegeben ist, das Band aber noch nicht läuft.',
  bind:['beltRunning=Band_Lauf','lightYellow=Warnung','hornActive=Hupe','lightGreen=Freigabe']
});

defTask({ id:'c9_blinker', ch:9, title:'Blinklicht',
  story:'Im Störfall soll die gelbe Lampe blinken statt dauerhaft zu leuchten — Blinken fällt in der Halle viel mehr auf. ARIA: "Blinken ist unhöflich."',
  brief:'Taktgeber: Takt-Timer (<code>TON</code>, 1 s) mit Eingang „Blinken aktiv AND NOT eigenes Q“ startet sich selbst neu. Bei jedem Q die Lampe umschalten; nicht aktiv → Lampe aus.',
  learn:'Ein selbstrücksetzender Timer erzeugt einen regelmässigen Takt.',
  take:'<code>IN := NOT Takt.Q</code> setzt den Timer einen Zyklus nach Ablauf zurück, danach startet er neu. Echte SPSen haben dafür auch fertige Taktmerker.',
  vars:{Aktiv:false, Lampe:false}, fb:{Takt:'TON'},
  timed:[{steps: blinkSteps()}],
  ref:'Takt(IN := Aktiv AND NOT Takt.Q, PT := T#1S);\nIF Takt.Q THEN\n  Lampe := NOT Lampe;\nEND_IF;\nIF NOT Aktiv THEN\n  Lampe := FALSE;\nEND_IF;', man:'timer', must:['TON'],
  hint:'Toggle wie beim Stromstoss-Schalter — aber ausgelöst von <code>Takt.Q</code>.',
  hint2:'Das zweite IF sorgt dafür, dass die Lampe beim Abschalten nicht zufällig an bleibt.',
  bind:['lightYellow=Lampe','faultActive=Aktiv']
});

defTask({ id:'c9_ueberwachung', ch:9, title:'Greifer-Überwachung',
  story:'Der Greifer soll nach dem Schliessbefehl innerhalb von 2 Sekunden seine Endlage „zu“ melden. Klemmt er — oder hält ARIA ihn fest —, muss eine Störung kommen, die bleibt, bis jemand quittiert.',
  brief:'Meldet der Greifer nach dem Schliessbefehl nicht innerhalb von 2 s die Endlage „zu“ (Überwachungs-Timer, <code>TON</code>), Störung setzen und speichern, bis quittiert wird.',
  learn:'Zeitüberwachung (Timeout) mit gespeicherter Störmeldung.',
  take:'Timeouts sind das Sicherheitsnetz jeder Bewegung: „Wenn nach X Sekunden keine Rückmeldung kommt, stimmt etwas nicht.“',
  vars:{Schliessen:false, Endlage_Zu:false, Quittieren:false, Stoerung:false}, fb:{Ueberwachung:'TON'},
  timed:[{steps:[[0,{Schliessen:true},{Stoerung:false}],[1,{Endlage_Zu:true},{Stoerung:false}],[5,{},{Stoerung:false}]]},
         {steps:[[0,{Schliessen:true},{Stoerung:false}],[1,{},{Stoerung:false}],[1,{},{Stoerung:true}],[1,{Schliessen:false},{Stoerung:true}],[1,{},{Stoerung:true}],[0,{Quittieren:true},{Stoerung:false}],[0,{Quittieren:false},{Stoerung:false}]]}],
  ref:'Ueberwachung(IN := Schliessen AND NOT Endlage_Zu, PT := T#2S);\nIF Ueberwachung.Q THEN\n  Stoerung := TRUE;\nEND_IF;\nIF Quittieren THEN\n  Stoerung := FALSE;\nEND_IF;', man:'timer', must:['TON'],
  hint:'Der Timer-Eingang ist eine AND-Verknüpfung mit NOT.',
  hint2:'Warum ein IF statt <code>Stoerung := Ueberwachung.Q;</code>? Weil die Meldung stehen bleiben muss, auch wenn der Schliessbefehl weg ist.',
  bind:['gripperOpen=Endlage_Zu','faultActive=Stoerung','lightRed=Stoerung','partVisible:true'],
  wrong:['Ueberwachung(IN := Schliessen AND NOT Endlage_Zu, PT := T#2S);\nStoerung := Ueberwachung.Q;']
});

defTask({ id:'c9_ms_dbg', ch:9, title:'Tausendmal zu schnell', debug:true,
  story:'Die Haltezeit an der Klebestation soll 3 Sekunden betragen, doch das Teil geht sofort weiter, der Kleber ist noch flüssig. ARIA: "Drei ist drei, oder?"',
  brief:'Das Teil soll 3 s an der Klebestation halten, bevor es weitergeht (Halte-Timer). Es geht aber sofort weiter – finde den Fehler in der Zeitangabe.',
  learn:'Zeit-Einheiten: <code>S</code> = Sekunden, <code>MS</code> = Millisekunden, <code>M</code> = Minuten.',
  take:'<code>T#3MS</code> sind 0,003 Sekunden! Einheitenfehler gehören zu den teuersten Fehlern in der Automatisierung.',
  vars:{Teil_Da:false, Weiter:false}, fb:{Halte_Timer:'TON'},
  timed:[{steps:[[0,{Teil_Da:true},{Weiter:false}],[1,{},{Weiter:false}],[1,{},{Weiter:false}],[1,{},{Weiter:true}]]}],
  start:'Halte_Timer(IN := Teil_Da, PT := T#3MS);\nWeiter := Halte_Timer.Q;',
  ref:'Halte_Timer(IN := Teil_Da, PT := T#3S);\nWeiter := Halte_Timer.Q;', man:'timer',
  hint:'Lies das Zeit-Literal ganz genau, Buchstabe für Buchstabe.',
  bind:['partVisible=Teil_Da','sensorActive=Teil_Da','beltRunning=Weiter']
});

defTask({ id:'c9_restzeit', ch:9, title:'Restzeit anzeigen',
  story:'"Zeig am Panel einfach die Restzeit des Aushärteprozesses an", sagt der Werkmeister. ARIA zeigt lieber Zufallszahlen.',
  brief:'Nach dem Start 10 s härten (<code>TON</code>). Zeige die Restzeit (TIME) = 10 s minus verstrichene Zeit <code>ET</code> an und melde nach Ablauf „fertig“.',
  learn:'Mit dem Ausgang ET (verstrichene Zeit) und TIME-Arithmetik rechnen.',
  take:'ET zählt von 0 bis PT. Restzeit = PT - ET. TIME-Werte darf man addieren und subtrahieren.',
  vars:{Start:false, Restzeit:0, Fertig:false}, types:{Restzeit:'TIME'}, fb:{Haerten:'TON'},
  timed:[{steps:[[0,{Start:true},{Restzeit:10, Fertig:false}],[4,{},{Restzeit:6}],[5,{},{Restzeit:1, Fertig:false}],[1,{},{Restzeit:0, Fertig:true}],[3,{},{Restzeit:0, Fertig:true}],[0,{Start:false},{Restzeit:10, Fertig:false}]]}],
  ref:'Haerten(IN := Start, PT := T#10S);\nRestzeit := T#10S - Haerten.ET;\nFertig := Haerten.Q;', man:'timer', must:['TON'],
  hint:'<code>Haerten.ET</code> ist vom Typ TIME — du kannst ihn direkt von <code>T#10S</code> abziehen.',
  bind:['displayValue=Restzeit','displayLabel:"REST s"','lightGreen=Fertig','lightYellow=Start']
});

defTask({ id:'r5t10', ch:9, title:'Vollständiger Greifzyklus', boss:true,
  story:'ARIA hat den Greifzyklus komplett gelöscht: "Ohne mich bewegt sich hier nichts mehr." Du baust ihn neu, Schritt für Schritt, mit Zeiten.',
  brief:'Schrittkette mit <code>CASE</code> (Start in Schritt 0): Flanke des Start-Tasters (<code>R_TRIG</code>) → 1. Schritt 1: Greifer schliessen, nach 2 s (Greif-Timer) → 2. Schritt 2: Achse auf 90°, nach 3 s (Heb-Timer) fertig melden → 3.',
  learn:'Timer in einer CASE-Schrittkette verwenden.',
  take:'Jeder Schritt hat eine Aktion und eine Weiterschaltbedingung. Kapitel 10 zeigt, warum man Timer besser <em>ausserhalb</em> des CASE aufruft.',
  vars:{Schritt:0, Start_Taster:false, Greifer_Auf:true, Achse_Grad:0, Fertig:false}, fb:{Start_Trigger:'R_TRIG', Greif_Timer:'TON', Heb_Timer:'TON'},
  timed:[{steps:[[0,{},{Schritt:0, Greifer_Auf:true, Achse_Grad:0}],[0,{Start_Taster:true},{Schritt:1}],[1,{},{Schritt:1, Greifer_Auf:false}],[1,{},{Schritt:1}],[1,{},{Schritt:2}],
    [1,{},{Schritt:2, Achse_Grad:90}],[1,{},{Schritt:2}],[1,{},{Schritt:2, Fertig:false}],[1,{},{Schritt:3, Fertig:true}],[1,{},{Schritt:3}]]}],
  ref:'Start_Trigger(CLK := Start_Taster);\nCASE Schritt OF\n  0:\n    IF Start_Trigger.Q THEN\n      Schritt := 1;\n    END_IF;\n  1:\n    Greifer_Auf := FALSE;\n    Greif_Timer(IN := TRUE, PT := T#2S);\n    IF Greif_Timer.Q THEN\n      Schritt := 2;\n    END_IF;\n  2:\n    Achse_Grad := 90;\n    Heb_Timer(IN := TRUE, PT := T#3S);\n    IF Heb_Timer.Q THEN\n      Fertig := TRUE;\n      Schritt := 3;\n    END_IF;\nEND_CASE;', man:'schrittketten', must:['CASE','TON','R_TRIG'],
  hint:'Die Struktur: R_TRIG-Aufruf, dann <code>CASE Schritt OF 0: … 1: … 2: … END_CASE;</code>',
  hint2:'Der Timer wird erst im Zyklus gestartet, in dem Schritt 1 zum ersten Mal ausgeführt wird — deshalb dauert der Schritt einen Takt länger als PT.',
  bind:['gripperOpen=Greifer_Auf','armAngle=Achse_Grad','displayValue=Schritt','displayLabel:"SCHRITT"','lightGreen=Fertig','partVisible:true']
});
})();
