/* ===== AWL QUEST · KAPITEL 3 — Speichern ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a3_selbsthaltung', ch:3, title:'Die Selbsthaltung',
  story:'Das Walzgerüst läuft nur, solange jemand den Ein-Taster festhält. Herr Brunner zeigt dir die klassische <b>Selbsthaltung</b>: Der Ausgang hält sich über seine eigene Abfrage — bis der Aus-Taster kommt.',
  brief:'<code>Walzen</code> = (<code>S_Ein</code> ODER <code>Walzen</code>) UND NICHT <code>S_Aus</code>.<br>Die ODER-Gruppe in die Klammer <code>U(</code> … <code>)</code>, danach <code>UN S_Aus</code>.',
  learn:'Selbsthaltung mit Aus-Vorrang.',
  take:'Mit der Klammer gilt: Aus ist <b>dominant</b>. Drückt man beide Taster, bleibt das Gerüst aus. Ohne Klammer (<code>O S_Ein / O Walzen / UN S_Aus</code>) wäre Ein dominant.',
  vars:{ S_Ein:false, S_Aus:false, Walzen:false },
  timed: seq([[0.1, { S_Ein:true }, { Walzen:true }], [0.1, { S_Ein:false }, { Walzen:true }], [0.1, { S_Aus:true }, { Walzen:false }], [0.1, { S_Aus:false }, { Walzen:false }], [0.1, { S_Ein:true, S_Aus:true }, { Walzen:false }]]),
  ref:'U(\nO  S_Ein\nO  Walzen\n)\nUN S_Aus\n=  Walzen', man:'speichern', must:['KLAMMER', 'UN'],
  wrong:['O  S_Ein\nO  Walzen\nUN S_Aus\n=  Walzen'],
  hint:'U( · O S_Ein · O Walzen · ) · UN S_Aus · = Walzen',
  bind:['rollsRunning=Walzen'] });

defAwl({ id:'a3_sr', ch:3, title:'Setzen und Rücksetzen',
  story:'Die Hydraulikpumpe bekommt zwei Taster: Ein und Aus. Statt Selbsthaltung nimmst du diesmal die Speicherbefehle <code>S</code> und <code>R</code>.',
  brief:'<code>U S_Ein</code> → <code>S Pumpe</code><br><code>U S_Aus</code> → <code>R Pumpe</code>',
  learn:'S und R.',
  take:'<code>S</code> schreibt eine 1, <code>R</code> eine 0 — aber nur, wenn das VKE 1 ist. Sonst bleibt der Operand, wie er ist. Bei beiden Tastern gewinnt die <b>untere</b> Anweisung: hier R.',
  vars:{ S_Ein:false, S_Aus:false, Pumpe:false },
  timed: seq([[0.1, { S_Ein:true }, { Pumpe:true }], [0.1, { S_Ein:false }, { Pumpe:true }], [0.1, { S_Aus:true }, { Pumpe:false }], [0.1, { S_Aus:false }, { Pumpe:false }], [0.1, { S_Ein:true, S_Aus:true }, { Pumpe:false }]]),
  ref:'U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe', man:'speichern', must:['S', 'R'],
  hint:'Zwei Ketten: U S_Ein / S Pumpe und U S_Aus / R Pumpe.',
  bind:['pumpRunning=Pumpe'] });

defAwl({ id:'a3_vorrang', ch:3, title:'Die Störung gewinnt',
  story:'Eine Störung am Walzgerüst wird gespeichert und mit der Quittiertaste gelöscht. Aber: Solange der Fehler noch ansteht, darf das Quittieren die Meldung <b>nicht</b> löschen.',
  brief:'Erst <code>U Quittieren</code> → <code>R Stoermeldung</code>, <b>danach</b> <code>U Fehler</code> → <code>S Stoermeldung</code>.<br>So ist Setzen dominant.',
  learn:'Vorrang durch die Reihenfolge.',
  take:'In AWL entscheidet die <b>Reihenfolge</b>: Die Anweisung, die zuletzt schreibt, gewinnt. Steht <code>S</code> unten, ist Setzen dominant — eine anstehende Störung kann nicht weg-quittiert werden.',
  vars:{ Fehler:false, Quittieren:false, Stoermeldung:false },
  timed: seq([[0.1, { Fehler:true }, { Stoermeldung:true }], [0.1, { Quittieren:true }, { Stoermeldung:true }], [0.1, { Fehler:false }, { Stoermeldung:false }], [0.1, { Quittieren:false, Fehler:true }, { Stoermeldung:true }], [0.1, { Fehler:false }, { Stoermeldung:true }]]),
  ref:'U  Quittieren\nR  Stoermeldung\nU  Fehler\nS  Stoermeldung', man:'speichern', must:['S', 'R'],
  wrong:['U  Fehler\nS  Stoermeldung\nU  Quittieren\nR  Stoermeldung'],
  hint:'Zuerst das Rücksetzen, dann das Setzen.',
  bind:['faultActive=Stoermeldung'] });

defAwl({ id:'a3_not', ch:3, title:'Stillstand melden',
  story:'Neben der grünen Lampe „Walzen läuft“ bekommt der Leitstand eine gelbe Lampe „Stillstand“. Sie ist genau das Gegenteil.',
  brief:'<code>Lampe_Gruen</code> = <code>Walzen</code><br><code>Lampe_Gelb</code> = NICHT <code>Walzen</code> — mit der Anweisung <code>NOT</code>: <code>U Walzen / NOT / = Lampe_Gelb</code>.',
  learn:'NOT dreht das VKE um.',
  take:'<code>NOT</code> negiert das VKE. Statt <code>UN</code> bei der Abfrage kannst du so auch das Ergebnis einer ganzen Kette umdrehen.',
  vars:{ Walzen:false, Lampe_Gruen:false, Lampe_Gelb:false },
  tests:[[{ Walzen:true }, { Lampe_Gruen:true, Lampe_Gelb:false }], [{ Walzen:false }, { Lampe_Gruen:false, Lampe_Gelb:true }]],
  ref:'U  Walzen\n=  Lampe_Gruen\nU  Walzen\nNOT\n=  Lampe_Gelb', man:'speichern', must:['NOT'],
  hint:'Zweite Kette: U Walzen · NOT · = Lampe_Gelb',
  bind:['rollsRunning=Walzen', 'lightGreen=Lampe_Gruen', 'lightYellow=Lampe_Gelb'] });

defAwl({ id:'a3_notaus_dbg', ch:3, title:'Der schwache Not-Aus', debug:true,
  story:'Hält jemand den Ein-Taster gedrückt, kann der Not-Aus den Rollgang nicht stoppen! ARIA hat nur zwei Ketten vertauscht.',
  brief:'Der Not-Aus (<code>Not_Aus_OK</code> = 0) muss immer gewinnen. Bringe die Ketten in die richtige Reihenfolge.',
  learn:'Sicherheit hat Vorrang — die Reihenfolge entscheidet.',
  take:'Ein Not-Aus muss <b>immer</b> dominant sein. In AWL heisst das: Sein <code>R</code> steht als letztes. Beim Lesen fremder Programme prüfst du deshalb immer die Reihenfolge von S und R.',
  vars:{ S_Ein:false, Not_Aus_OK:true, Rollgang:false },
  timed: seq([[0.1, { S_Ein:true }, { Rollgang:true }], [0.1, { Not_Aus_OK:false }, { Rollgang:false }], [0.1, { S_Ein:false }, { Rollgang:false }], [0.1, { Not_Aus_OK:true }, { Rollgang:false }]]),
  start:'UN Not_Aus_OK\nR  Rollgang\nU  S_Ein\nS  Rollgang', ref:'U  S_Ein\nS  Rollgang\nUN Not_Aus_OK\nR  Rollgang', man:'speichern', must:['S', 'R'],
  hint:'Die Kette mit R muss nach unten.',
  bind:['conveyorRunning=Rollgang'] });

defAwl({ id:'a3_set', ch:3, title:'Immer an',
  story:'Die Kontrolllampe „SPS läuft“ soll leuchten, solange die S7-300 im RUN ist — ohne Bedingung. Und die alte Lampe „Handbetrieb“ wird stillgelegt: immer aus.',
  brief:'<code>SET</code> → <code>= Lampe_Gruen</code><br><code>CLR</code> → <code>= Lampe_Hand</code>',
  learn:'SET und CLR.',
  take:'<code>SET</code> setzt das VKE auf 1, <code>CLR</code> auf 0 — ohne Abfrage. Praktisch für Ausgänge, die immer einen festen Wert haben.',
  vars:{ Lampe_Gruen:false, Lampe_Hand:true },
  tests:[[{}, { Lampe_Gruen:true, Lampe_Hand:false }]],
  ref:'SET\n=  Lampe_Gruen\nCLR\n=  Lampe_Hand', man:'speichern', must:['SET', 'CLR'],
  hint:'SET · = Lampe_Gruen · CLR · = Lampe_Hand',
  bind:['lightGreen=Lampe_Gruen', 'lightYellow=Lampe_Hand'] });

defAwl({ id:'a3_ofen', ch:3, title:'Heizen bis zur Temperatur',
  story:'Der Stossofen heizt, nachdem jemand „Heizen“ gedrückt hat. Er hört auf, sobald die Solltemperatur erreicht ist — oder wenn jemand die Ofentür öffnet.',
  brief:'<code>U S_Heizen</code> → <code>S Heizung</code><br><code>O Temp_erreicht</code>, <code>O Tuer_offen</code> → <code>R Heizung</code>',
  learn:'Rücksetzen mit mehreren Bedingungen.',
  take:'Das Rücksetzen darf eine ganze ODER-Kette haben. Weil es unten steht, gewinnt jede Abschaltbedingung gegen den Einschaltbefehl.',
  vars:{ S_Heizen:false, Temp_erreicht:false, Tuer_offen:false, Heizung:false },
  timed: seq([[0.1, { S_Heizen:true }, { Heizung:true }], [0.1, { S_Heizen:false }, { Heizung:true }], [0.1, { Temp_erreicht:true }, { Heizung:false }], [0.1, { Temp_erreicht:false, S_Heizen:true }, { Heizung:true }], [0.1, { S_Heizen:false, Tuer_offen:true }, { Heizung:false }], [0.1, { S_Heizen:true }, { Heizung:false }]]),
  ref:'U  S_Heizen\nS  Heizung\nO  Temp_erreicht\nO  Tuer_offen\nR  Heizung', man:'speichern', must:['S', 'R', 'O'],
  hint:'Die zweite Kette beginnt mit O Temp_erreicht.',
  bind:['furnaceOn=Heizung', 'furnaceDoor=Tuer_offen'] });

defAwl({ id:'a3_stoerung', ch:3, title:'Der Störspeicher',
  story:'Fällt der Öldruck ab, wird eine Störung gespeichert: Die rote Lampe leuchtet und das Walzgerüst steht. Quittieren geht erst, wenn der Druck wieder da ist.',
  brief:'<code>U Druck_tief</code> → <code>S Stoerung</code><br><code>U Quittieren</code>, <code>UN Druck_tief</code> → <code>R Stoerung</code><br><code>U Stoerung</code> → <code>= Lampe_Rot</code><br><code>U S_Walzen</code>, <code>UN Stoerung</code> → <code>= Walzen</code>',
  learn:'Störung speichern, quittieren, auswerten.',
  take:'Ein gespeicherter Fehler bleibt sichtbar, auch wenn er nur kurz auftrat. Quittiert wird erst, wenn die Ursache weg ist — das stellt die Bedingung <code>UN Druck_tief</code> beim Rücksetzen sicher.',
  vars:{ Druck_tief:false, Quittieren:false, S_Walzen:false, Stoerung:false, Lampe_Rot:false, Walzen:false },
  timed: seq([[0.1, { S_Walzen:true }, { Walzen:true }], [0.1, { Druck_tief:true }, { Stoerung:true, Lampe_Rot:true, Walzen:false }], [0.1, { Druck_tief:false }, { Stoerung:true, Walzen:false }], [0.1, { Druck_tief:true, Quittieren:true }, { Stoerung:true }], [0.1, { Druck_tief:false }, { Stoerung:false, Lampe_Rot:false, Walzen:true }]]),
  ref:'U  Druck_tief\nS  Stoerung\nU  Quittieren\nUN Druck_tief\nR  Stoerung\nU  Stoerung\n=  Lampe_Rot\nU  S_Walzen\nUN Stoerung\n=  Walzen', man:'speichern', must:['S', 'R', 'UN'],
  hint:'Vier Ketten: Setzen, Rücksetzen, Lampe, Gerüst.',
  bind:['rollsRunning=Walzen', 'lightRed=Lampe_Rot', 'faultActive=Stoerung'] });

defAwl({ id:'a3_richtung', ch:3, title:'Vorwärts und rückwärts',
  story:'Der Rollgang eines Reversiergerüsts fährt den Block hin <b>und</b> zurück. Die beiden Schütze dürfen <b>nie</b> gleichzeitig anziehen — sonst gibt es einen Kurzschluss im Motor.',
  brief:'<code>Vor</code> = (<code>S_Vor</code> ODER <code>Vor</code>) UND NICHT <code>S_Halt</code> UND NICHT <code>Rueck</code><br><code>Rueck</code> = (<code>S_Rueck</code> ODER <code>Rueck</code>) UND NICHT <code>S_Halt</code> UND NICHT <code>Vor</code>',
  learn:'Gegenseitige Verriegelung.',
  take:'Jede Richtung fragt die andere mit <code>UN</code> ab — die <b>Verriegelung</b>. Wer zuerst läuft, sperrt den anderen, bis Halt gedrückt wird.',
  vars:{ S_Vor:false, S_Rueck:false, S_Halt:false, Vor:false, Rueck:false },
  timed: seq([[0.1, { S_Vor:true }, { Vor:true, Rueck:false }], [0.1, { S_Vor:false, S_Rueck:true }, { Vor:true, Rueck:false }], [0.1, { S_Rueck:false, S_Halt:true }, { Vor:false }], [0.1, { S_Halt:false, S_Rueck:true }, { Rueck:true, Vor:false }], [0.1, { S_Rueck:false, S_Vor:true }, { Rueck:true, Vor:false }]]),
  ref:'U(\nO  S_Vor\nO  Vor\n)\nUN S_Halt\nUN Rueck\n=  Vor\nU(\nO  S_Rueck\nO  Rueck\n)\nUN S_Halt\nUN Vor\n=  Rueck', man:'speichern', must:['KLAMMER', 'UN'],
  wrong:['U(\nO  S_Vor\nO  Vor\n)\nUN S_Halt\n=  Vor\nU(\nO  S_Rueck\nO  Rueck\n)\nUN S_Halt\n=  Rueck'],
  hint:'Zwei Selbsthaltungen; jede hat zusätzlich UN auf die andere Richtung.',
  bind:['conveyorRunning=Vor', 'conveyorReverse=Rueck'] });

defAwl({ id:'a3_boss', ch:3, title:'Boss: Die Walzstrasse startet', boss:true,
  story:'ARIA blockiert den Start der Walzstrasse. Herr Brunner zählt die Regeln an den Fingern ab: „Pumpe zuerst. Gerüst nur mit Pumpe. Not-Aus stoppt alles. Und die Lampen sagen, was los ist.“',
  brief:'<code>U S_Start</code> → <code>S Pumpe</code><br><code>U S_Start</code>, <code>U Pumpe</code> → <code>S Walzen</code> (steht nach dem Setzen der Pumpe: beide starten im selben Zyklus)<br><code>O S_Stopp</code>, <code>ON Not_Aus_OK</code> → <code>R Walzen</code> und <code>R Pumpe</code><br><code>U Walzen</code> → <code>= Lampe_Gruen</code> · <code>UN Not_Aus_OK</code> → <code>= Lampe_Rot</code>',
  learn:'Setzen, Rücksetzen, Vorrang und Meldungen zusammen.',
  take:'Ein Programm, das S und R benutzt, liest sich von oben nach unten wie ein Protokoll: Wer zuletzt schreibt, gewinnt. Die Abschaltungen gehören deshalb ans Ende.',
  vars:{ S_Start:false, S_Stopp:false, Not_Aus_OK:true, Pumpe:false, Walzen:false, Lampe_Gruen:false, Lampe_Rot:false },
  timed: seq([[0.1, { S_Start:true }, { Pumpe:true, Walzen:true, Lampe_Gruen:true }], [0.1, { S_Start:false }, { Pumpe:true, Walzen:true }], [0.1, { S_Stopp:true }, { Pumpe:false, Walzen:false, Lampe_Gruen:false }], [0.1, { S_Stopp:false, S_Start:true }, { Walzen:true }], [0.1, { S_Start:false, Not_Aus_OK:false }, { Walzen:false, Pumpe:false, Lampe_Rot:true }], [0.1, { S_Start:true }, { Walzen:false, Pumpe:false, Lampe_Rot:true }], [0.1, { S_Start:false, Not_Aus_OK:true }, { Lampe_Rot:false, Walzen:false }]]),
  ref:'NETWORK Start\nU  S_Start\nS  Pumpe\nU  S_Start\nU  Pumpe\nS  Walzen\n\nNETWORK Stopp\nO  S_Stopp\nON Not_Aus_OK\nR  Walzen\nR  Pumpe\n\nNETWORK Lampen\nU  Walzen\n=  Lampe_Gruen\nUN Not_Aus_OK\n=  Lampe_Rot', man:'speichern', must:['S', 'R', 'ON'],
  hint:'Das Rücksetzen kommt nach dem Setzen. Nach R Walzen kannst du gleich R Pumpe schreiben — das VKE bleibt stehen.',
  bind:['pumpRunning=Pumpe', 'rollsRunning=Walzen', 'lightGreen=Lampe_Gruen', 'lightRed=Lampe_Rot'] });
})();
