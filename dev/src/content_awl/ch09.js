/* ===== AWL QUEST · KAPITEL 9 — Vergleichen ===== */
(function(){
const seq = steps => [{ steps }];

defAwl({ id:'a9_groesser', ch:9, title:'Heiss genug?',
  story:'Ein Block unter 1100 °C ist zu kalt: Er würde reissen oder die Walzen beschädigen. Die Steuerung meldet, ob die Temperatur reicht.',
  brief:'<code>Temp_OK</code> = <code>Temp</code> ≥ 1100: <code>L Temp</code> · <code>L 1100</code> · <code>&gt;=I</code> · <code>= Temp_OK</code>',
  learn:'Vergleichen: AKKU2 op AKKU1 ergibt ein VKE.',
  take:'Ein Vergleich prüft <b>AKKU2 mit AKKU1</b> und bildet daraus ein VKE — das kannst du wie jedes andere VKE zuweisen.',
  vars:{ Temp:0, Temp_OK:false },
  tests:[[{ Temp:1150 }, { Temp_OK:true }], [{ Temp:1100 }, { Temp_OK:true }], [{ Temp:1099 }, { Temp_OK:false }]],
  ref:'L  Temp\nL  1100\n>=I\n=  Temp_OK', man:'vergleichen', must:['CMP_I'],
  hint:'L Temp · L 1100 · >=I · = Temp_OK',
  bind:['furnaceTemp=Temp', 'lightGreen=Temp_OK'] });

defAwl({ id:'a9_kleiner', ch:9, title:'Druck zu tief',
  story:'Die Hydraulik braucht mindestens 180 bar. Fällt der Druck darunter, leuchtet die rote Lampe.',
  brief:'<code>Lampe_Rot</code> = <code>Druck</code> &lt; 180',
  learn:'Vergleich kleiner als (&lt;I).',
  take:'Die Vergleiche gibt es für alle Richtungen: <code>==I</code>, <code>&lt;&gt;I</code>, <code>&gt;I</code>, <code>&lt;I</code>, <code>&gt;=I</code>, <code>&lt;=I</code>.',
  vars:{ Druck:0, Lampe_Rot:false },
  tests:[[{ Druck:210 }, { Lampe_Rot:false }], [{ Druck:180 }, { Lampe_Rot:false }], [{ Druck:179 }, { Lampe_Rot:true }]],
  ref:'L  Druck\nL  180\n<I\n=  Lampe_Rot', man:'vergleichen', must:['CMP_I'],
  hint:'<I statt >=I.',
  bind:['pressure=Druck', 'lightRed=Lampe_Rot'] });

defAwl({ id:'a9_gleich', ch:9, title:'Die Charge ist komplett',
  story:'Die Charge ist fertig, wenn die gezählten Blöcke der Vorwahl entsprechen. Dann leuchtet die grüne Lampe.',
  brief:'<code>Charge_fertig</code> = (<code>Stueck</code> == <code>Vorwahl</code>)',
  learn:'Vergleich auf Gleichheit (==I).',
  take:'<code>==I</code> vergleicht zwei Ganzzahlen auf Gleichheit. Bei REAL-Zahlen ist „gleich“ heikel — dort vergleicht man lieber mit <code>&gt;=R</code>.',
  vars:{ Stueck:0, Vorwahl:0, Charge_fertig:false },
  tests:[[{ Stueck:10, Vorwahl:10 }, { Charge_fertig:true }], [{ Stueck:9, Vorwahl:10 }, { Charge_fertig:false }]],
  ref:'L  Stueck\nL  Vorwahl\n==I\n=  Charge_fertig', man:'vergleichen', must:['CMP_I'],
  hint:'L Stueck · L Vorwahl · ==I · = Charge_fertig',
  bind:['pieceCount=Stueck', 'lightGreen=Charge_fertig'] });

defAwl({ id:'a9_klammer', ch:9, title:'Walzen nur heiss',
  story:'Das Gerüst darf nur walzen, wenn jemand „Walzen“ drückt <b>und</b> der Block heiss genug ist. Herr Brunner warnt: „Ein Vergleich überschreibt das VKE, du brauchst eine Klammer.“',
  brief:'<code>Walzen</code> = <code>S_Walzen</code> UND (<code>Temp</code> ≥ 1100)<br><code>U S_Walzen</code> · <code>U(</code> · <code>L Temp</code> · <code>L 1100</code> · <code>&gt;=I</code> · <code>)</code> · <code>= Walzen</code>',
  learn:'Vergleich in einer Klammer verknüpfen.',
  take:'Der Vergleich bildet ein <b>neues</b> VKE und vergisst das alte. In einer Klammer <code>U(</code> … <code>)</code> wird sein Ergebnis mit der Kette davor verknüpft.',
  vars:{ S_Walzen:false, Temp:0, Walzen:false },
  tests:[[{ S_Walzen:true, Temp:1150 }, { Walzen:true }], [{ S_Walzen:true, Temp:1000 }, { Walzen:false }], [{ S_Walzen:false, Temp:1150 }, { Walzen:false }]],
  ref:'U  S_Walzen\nU(\nL  Temp\nL  1100\n>=I\n)\n=  Walzen', man:'vergleichen', must:['CMP_I', 'KLAMMER'],
  hint:'Der ganze Vergleich (L, L, >=I) steht in der Klammer.',
  bind:['rollsRunning=Walzen', 'furnaceTemp=Temp'] });

defAwl({ id:'a9_klammer_dbg', ch:9, title:'Der ignorierte Taster', debug:true,
  story:'Das Gerüst läuft los, sobald der Block heiss genug ist — ganz ohne dass jemand „Walzen“ drückt. ARIA hat die Klammer entfernt.',
  brief:'<code>Walzen</code> = <code>S_Walzen</code> UND (<code>Temp</code> ≥ 1100).',
  learn:'Vergleich überschreibt das VKE.',
  take:'Steht ein Vergleich ohne Klammer mitten in einer Kette, zählt nur noch das Vergleichsergebnis. Im Status siehst du es: Nach <code>&gt;=I</code> hat das VKE nichts mehr mit der Zeile davor zu tun.',
  vars:{ S_Walzen:false, Temp:0, Walzen:false },
  tests:[[{ S_Walzen:false, Temp:1150 }, { Walzen:false }], [{ S_Walzen:true, Temp:1150 }, { Walzen:true }]],
  start:'U  S_Walzen\nL  Temp\nL  1100\n>=I\n=  Walzen', ref:'U  S_Walzen\nU(\nL  Temp\nL  1100\n>=I\n)\n=  Walzen', man:'vergleichen', must:['KLAMMER'],
  hint:'Setze U( vor L Temp und ) nach >=I.',
  bind:['rollsRunning=Walzen', 'furnaceTemp=Temp'] });

defAwl({ id:'a9_fenster', ch:9, title:'Das Temperaturfenster',
  story:'Zu kalt ist schlecht, zu heiss auch: Über 1250 °C verbrennt die Oberfläche. Die grüne Lampe leuchtet nur zwischen 1100 und 1250 °C.',
  brief:'<code>Temp_OK</code> = (<code>Temp</code> ≥ 1100) UND (<code>Temp</code> ≤ 1250). Zwei Vergleiche in zwei Klammern.',
  learn:'Wertebereich prüfen.',
  take:'Ein Fenster sind zwei Vergleiche, verknüpft mit UND. Jeder steht in seiner eigenen Klammer.',
  vars:{ Temp:0, Temp_OK:false },
  tests:[[{ Temp:1000 }, { Temp_OK:false }], [{ Temp:1100 }, { Temp_OK:true }], [{ Temp:1200 }, { Temp_OK:true }], [{ Temp:1250 }, { Temp_OK:true }], [{ Temp:1251 }, { Temp_OK:false }]],
  ref:'U(\nL  Temp\nL  1100\n>=I\n)\nU(\nL  Temp\nL  1250\n<=I\n)\n=  Temp_OK', man:'vergleichen', must:['CMP_I', 'KLAMMER'],
  hint:'U( … >=I ) · U( … <=I ) · = Temp_OK',
  bind:['furnaceTemp=Temp', 'lightGreen=Temp_OK'] });

defAwl({ id:'a9_real', ch:9, title:'Zu enger Spalt',
  story:'Der Walzspalt wird mit Zehntelmillimetern gemessen, und unter 2,5 mm droht die Walze aufzusitzen. Dann leuchtet die gelbe Warnlampe.',
  brief:'<code>Warnung</code> = <code>Spalt</code> &lt; 2,5 (REAL-Vergleich <code>&lt;R</code>)',
  learn:'REAL-Zahlen vergleichen.',
  take:'Für Kommazahlen gibt es die Vergleiche mit der Endung <b>R</b>. AKKU1 und AKKU2 müssen dann beide REAL-Werte enthalten — die Konstante also mit Punkt: <code>2.5</code>.',
  vars:{ Spalt:0, Warnung:false }, types:{ Spalt:'REAL' },
  tests:[[{ Spalt:3.2 }, { Warnung:false }], [{ Spalt:2.5 }, { Warnung:false }], [{ Spalt:2.4 }, { Warnung:true }]],
  ref:'L  Spalt\nL  2.5\n<R\n=  Warnung', man:'vergleichen', must:['CMP_R'],
  hint:'L Spalt · L 2.5 · <R · = Warnung',
  bind:['rollGap=Spalt', 'lightYellow=Warnung'] });

defAwl({ id:'a9_ungleich', ch:9, title:'Regler aktiv',
  story:'Die Spaltregelung arbeitet, solange Soll und Ist nicht übereinstimmen. Die gelbe Lampe zeigt „Regler aktiv“.',
  brief:'<code>Regler_aktiv</code> = <code>Spalt_Soll</code> ≠ <code>Spalt_Ist</code>',
  learn:'Vergleich auf Ungleichheit (&lt;&gt;I).',
  take:'<code>&lt;&gt;I</code> ist 1, wenn die Werte verschieden sind. Für Regelungen ist das der typische „noch nicht fertig“-Vergleich.',
  vars:{ Spalt_Soll:0, Spalt_Ist:0, Regler_aktiv:false },
  tests:[[{ Spalt_Soll:12, Spalt_Ist:14 }, { Regler_aktiv:true }], [{ Spalt_Soll:12, Spalt_Ist:12 }, { Regler_aktiv:false }]],
  ref:'L  Spalt_Soll\nL  Spalt_Ist\n<>I\n=  Regler_aktiv', man:'vergleichen', must:['CMP_I'],
  hint:'<>I.',
  bind:['rollGap=Spalt_Ist', 'lightYellow=Regler_aktiv'] });

defAwl({ id:'a9_grenze_dbg', ch:9, title:'Genau an der Grenze', debug:true,
  story:'Bei genau 1100 °C verweigert das Gerüst den Block, obwohl 1100 °C laut Vorschrift noch zulässig sind. ARIA hat einen Vergleich verändert.',
  brief:'Zulässig ist <code>Temp</code> ≥ 1100.',
  learn:'Grenzwerte genau lesen.',
  take:'<code>&gt;</code> und <code>&gt;=</code> unterscheiden sich nur an der Grenze — genau dort, wo Vorschriften gelten. Teste immer auch den Grenzwert selbst.',
  vars:{ Temp:0, Temp_OK:false },
  tests:[[{ Temp:1100 }, { Temp_OK:true }], [{ Temp:1099 }, { Temp_OK:false }]],
  start:'L  Temp\nL  1100\n>I\n=  Temp_OK', ref:'L  Temp\nL  1100\n>=I\n=  Temp_OK', man:'vergleichen', must:['CMP_I'],
  hint:'>I → >=I.',
  bind:['furnaceTemp=Temp', 'lightGreen=Temp_OK'] });

defAwl({ id:'a9_boss', ch:9, title:'Boss: Der Zweipunktregler', boss:true,
  story:'ARIA lässt die Ofentemperatur pendeln. Herr Brunner zeichnet dir einen <b>Zweipunktregler mit Hysterese</b> auf: „Unter 1150 heizen, über 1200 aus, dazwischen bleibt, was ist, und die Lampen zeigen, wo wir stehen.“',
  brief:'<code>U(</code> <code>Temp</code> &lt; 1150 <code>)</code> → <code>S Heizung</code><br><code>U(</code> <code>Temp</code> &gt; 1200 <code>)</code> → <code>R Heizung</code><br><code>Lampe_Gruen</code> = (<code>Temp</code> ≥ 1150) UND (<code>Temp</code> ≤ 1200)<br><code>Lampe_Rot</code> = <code>Temp</code> &gt; 1250',
  learn:'Vergleiche, Speicher und Fenster kombiniert.',
  take:'Ein Zweipunktregler mit <b>Hysterese</b> schaltet bei zwei verschiedenen Grenzen. Dazwischen hält der Speicher den letzten Zustand — so flattert die Heizung nicht.',
  vars:{ Temp:1100, Heizung:false, Lampe_Gruen:false, Lampe_Rot:false },
  timed: seq([[0.1, { Temp:1100 }, { Heizung:true, Lampe_Gruen:false }], [0.1, { Temp:1170 }, { Heizung:true, Lampe_Gruen:true }], [0.1, { Temp:1201 }, { Heizung:false, Lampe_Gruen:false }], [0.1, { Temp:1180 }, { Heizung:false, Lampe_Gruen:true }], [0.1, { Temp:1149 }, { Heizung:true }], [0.1, { Temp:1260 }, { Heizung:false, Lampe_Rot:true }]]),
  ref:'NETWORK Heizen\nU(\nL  Temp\nL  1150\n<I\n)\nS  Heizung\n\nNETWORK Nicht mehr heizen\nU(\nL  Temp\nL  1200\n>I\n)\nR  Heizung\n\nNETWORK Temperatur gut\nU(\nL  Temp\nL  1150\n>=I\n)\nU(\nL  Temp\nL  1200\n<=I\n)\n=  Lampe_Gruen\n\nNETWORK Zu heiss\nL  Temp\nL  1250\n>I\n=  Lampe_Rot', man:'vergleichen', must:['CMP_I', 'S', 'R', 'KLAMMER'],
  hint:'Vier Netzwerke. Das Fenster wie beim Temperaturfenster.',
  bind:['furnaceTemp=Temp', 'furnaceOn=Heizung', 'lightGreen=Lampe_Gruen', 'lightRed=Lampe_Rot'] });
})();
