/* ===== KOP QUEST · KAPITEL 9 — Vergleicher und Werte ===== */
(function(){
const seq = steps => [{ steps }];
defKop({ id:'k9_wind', ch:9, title:'Der Windmesser',
  story:'Auf der Stütze dreht sich das Anemometer. Es liefert die Windgeschwindigkeit als Zahl in km/h. Über 60 km/h wird es gefährlich.',
  brief:'<code>Windwarnung</code> ist 1, wenn <code>Wind_kmh</code> <b>grösser als 60</b> ist.<br>Element antippen → <b>Vergleich</b>. Wert A: <code>Wind_kmh</code>, Vergleich <code>&gt;</code>, Wert B: <code>60</code>.',
  learn:'Vergleichskontakt: leitet, wenn der Vergleich wahr ist.',
  take:'Ein <b>Vergleichskontakt</b> vergleicht zwei Zahlen (==, <>, >, >=, <, <=) und leitet, wenn der Vergleich stimmt — wie ein Schliesser mit eingebauter Rechnung.',
  vars:{ Wind_kmh:0, Windwarnung:false },
  tests: [0, 45, 60, 61, 90].map(w => [{ Wind_kmh:w }, { Windwarnung: w > 60 }]),
  ref:'NETWORK Windwarnung\n[Wind_kmh > 60] => Windwarnung;', man:'vergleich', must:['CMP'],
  hint:'Ein Vergleichskontakt statt eines normalen Kontakts.',
  bind:['windSpeed=Wind_kmh','windWarn=Windwarnung'] });

defKop({ id:'k9_bereich', ch:9, title:'Gelb und Rot',
  story:'Der Werkmeister will früher gewarnt werden: Ab 40 km/h leuchtet Gelb, über 60 km/h Rot — und dann nicht mehr Gelb.',
  brief:'<b>NW 1:</b> <code>Wind_kmh</code> ≥ 40 <b>und</b> <code>Wind_kmh</code> ≤ 60 → <code>Ampel_Gelb</code><br><b>NW 2:</b> <code>Wind_kmh</code> &gt; 60 → <code>Ampel_Rot</code>',
  learn:'Wertebereich mit zwei Vergleichern in Reihe.',
  take:'Ein <b>Bereich</b> „zwischen a und b“ sind zwei Vergleicher <b>in Reihe</b>: ≥ untere Grenze UND ≤ obere Grenze. Achte darauf, dass die Grenzen lückenlos anschliessen.',
  vars:{ Wind_kmh:0, Ampel_Gelb:false, Ampel_Rot:false },
  tests: [0, 39, 40, 55, 60, 61, 100].map(w => [{ Wind_kmh:w }, { Ampel_Gelb: w >= 40 && w <= 60, Ampel_Rot: w > 60 }]),
  ref:'NETWORK Gelb\n[Wind_kmh >= 40] AND [Wind_kmh <= 60] => Ampel_Gelb;\n\nNETWORK Rot\n[Wind_kmh > 60] => Ampel_Rot;', man:'vergleich', must:['CMP','SERIES'],
  hint:'NW 1 hat zwei Vergleicher hintereinander.',
  bind:['windSpeed=Wind_kmh','lightYellow=Ampel_Gelb','lightRed=Ampel_Rot'] });

defKop({ id:'k9_revision', ch:9, title:'Kabine 13',
  story:'Kabine Nummer 13 ist in der Revision und darf nicht besetzt werden. Jede Kabine meldet beim Einfahren ihre Nummer.',
  brief:'<b>NW 1:</b> <code>Kabinen_Nr</code> == 13 → <code>Ampel_Rot</code><br><b>NW 2:</b> <code>Kabine_da</code> und <code>Kabinen_Nr</code> &lt;&gt; 13 → <code>Tuer_Auf</code>',
  learn:'Gleich (==) und ungleich (<>).',
  take:'<code>==</code> prüft Gleichheit, <code>&lt;&gt;</code> Ungleichheit. Mit Nummern lassen sich einzelne Kabinen, Stationen oder Rezepte auswählen.',
  vars:{ Kabinen_Nr:0, Kabine_da:false, Ampel_Rot:false, Tuer_Auf:false },
  tests: [[{ Kabinen_Nr:12, Kabine_da:true }, { Ampel_Rot:false, Tuer_Auf:true }], [{ Kabinen_Nr:13, Kabine_da:true }, { Ampel_Rot:true, Tuer_Auf:false }], [{ Kabinen_Nr:14, Kabine_da:false }, { Ampel_Rot:false, Tuer_Auf:false }], [{ Kabinen_Nr:13, Kabine_da:false }, { Ampel_Rot:true, Tuer_Auf:false }]],
  ref:'NETWORK Revision\n[Kabinen_Nr == 13] => Ampel_Rot;\n\nNETWORK Tuer\nKabine_da AND [Kabinen_Nr <> 13] => Tuer_Auf;', man:'vergleich', must:['CMP'],
  hint:'Im Vergleich die Auswahl auf == bzw. <> stellen.',
  bind:['lightRed=Ampel_Rot','doorOpen=Tuer_Auf','cabinInStation=Kabine_da','displayValue=Kabinen_Nr'] });

defKop({ id:'k9_hysterese', ch:9, title:'Hysterese',
  story:'Bei 60 km/h stoppt die Bahn, bei 59 fährt sie wieder, bei 61 stoppt sie … Der Antrieb flattert. Die Lösung: Abschalten über 60, wieder freigeben erst unter 40 km/h.',
  brief:'<b>NW 1:</b> <code>Wind_kmh</code> &gt; 60 setzt <code>Wind_Stopp</code><br><b>NW 2:</b> <code>Wind_kmh</code> &lt; 40 setzt <code>Wind_Stopp</code> zurück',
  learn:'Hysterese: zwei Schwellen mit Setzen/Rücksetzen.',
  take:'Eine <b>Hysterese</b> verhindert Flattern: Zwei verschiedene Schwellen für Ein und Aus, dazwischen bleibt der Zustand gespeichert.',
  vars:{ Wind_kmh:0, Wind_Stopp:false },
  timed: seq([[0,{Wind_kmh:50},{Wind_Stopp:false}],[0.1,{Wind_kmh:61},{Wind_Stopp:true}],[0.1,{Wind_kmh:55},{Wind_Stopp:true}],[0.1,{Wind_kmh:41},{Wind_Stopp:true}],[0.1,{Wind_kmh:39},{Wind_Stopp:false}],[0.1,{Wind_kmh:59},{Wind_Stopp:false}],[0.1,{Wind_kmh:65},{Wind_Stopp:true}]]),
  ref:'NETWORK Sturm\n[Wind_kmh > 60] => S Wind_Stopp;\n\nNETWORK Beruhigt\n[Wind_kmh < 40] => R Wind_Stopp;', man:'vergleich', must:['CMP','SET','RESET'],
  hint:'Zwei Netzwerke mit Vergleichern: eines setzt, eines setzt zurück.',
  bind:['windSpeed=Wind_kmh','windWarn=Wind_Stopp'] });

defKop({ id:'k9_move', ch:9, title:'Geschwindigkeitsstufen',
  story:'Der Umrichter bekommt einen Sollwert: 2 m/s bei Einfahrt (langsam), 5 m/s auf der Strecke. MOVE überträgt eine Zahl in eine Variable — aber nur, wenn Strom fliesst.',
  brief:'<b>NW 1:</b> <code>S_Langsam</code> → MOVE 2 nach <code>Sollwert</code><br><b>NW 2:</b> <code>S_Schnell</code> → MOVE 5 nach <code>Sollwert</code><br><b>NW 3:</b> <code>S_Stopp</code> → MOVE 0 nach <code>Sollwert</code>',
  learn:'MOVE als bedingte Wertzuweisung.',
  take:'<b>MOVE</b> schreibt den Wert IN nach OUT, wenn Strom in die Box fliesst. Ohne Stromfluss bleibt OUT unverändert — wie bei einer S-Spule für Zahlen.',
  vars:{ S_Langsam:false, S_Schnell:false, S_Stopp:false, Sollwert:0 },
  timed: seq([[0,{S_Langsam:true},{Sollwert:2}],[0.1,{S_Langsam:false},{Sollwert:2}],[0.1,{S_Schnell:true},{Sollwert:5}],[0.1,{S_Schnell:false},{Sollwert:5}],[0.1,{S_Stopp:true},{Sollwert:0}]]),
  ref:'NETWORK Langsam\nS_Langsam => MOVE(2, Sollwert);\n\nNETWORK Schnell\nS_Schnell => MOVE(5, Sollwert);\n\nNETWORK Stopp\nS_Stopp => MOVE(0, Sollwert);', man:'werte', must:['MOVE','NETWORKS'],
  hint:'Drei Netzwerke, jedes mit einer MOVE-Box am Ende.',
  bind:['displayValue=Sollwert','displayLabel:"SOLL m/s"'] });

defKop({ id:'k9_add', ch:9, title:'Tagesstatistik',
  story:'Bei jeder Abfahrt werden die Gäste der Kabine zur Tagessumme addiert. ADD rechnet IN1 + IN2 und schreibt das Ergebnis nach OUT.',
  brief:'↑<code>Abfahrt</code> → <b>ADD</b>: IN1 <code>Tagesgaeste</code>, IN2 <code>Kabinengaeste</code>, OUT <code>Tagesgaeste</code>.<br>Spule antippen → <b>Rechnen</b>.',
  learn:'ADD mit Flanke: einmal pro Ereignis addieren.',
  take:'Rechenboxen (ADD, SUB, MUL, DIV) arbeiten wie MOVE nur bei Stromfluss. Für „einmal pro Ereignis“ braucht es wieder eine <b>Flanke</b>.',
  vars:{ Abfahrt:false, Kabinengaeste:0, Tagesgaeste:0 },
  timed: seq([[0,{Kabinengaeste:6, Abfahrt:true},{Tagesgaeste:6}],[0.1,{},{Tagesgaeste:6}],[0.1,{Abfahrt:false, Kabinengaeste:8},{Tagesgaeste:6}],[0.1,{Abfahrt:true},{Tagesgaeste:14}],[0.1,{},{Tagesgaeste:14}]]),
  ref:'NETWORK Tagessumme\nP(Abfahrt) => ADD(Tagesgaeste, Kabinengaeste, Tagesgaeste);', man:'werte', must:['ADD','EDGE_P'],
  hint:'P-Flanke auf Abfahrt, dann die ADD-Box.',
  bind:['passengers=Tagesgaeste','motorOn=Abfahrt'] });

defKop({ id:'k9_grenze_dbg', ch:9, title:'Genau 60', debug:true,
  story:'Bei exakt 60 km/h soll die Warnung schon kommen — so steht es in der Betriebsvorschrift. ARIA hat den Vergleich „ein bisschen“ verändert.',
  brief:'<code>Windwarnung</code> ab <b>60 km/h</b> (60 eingeschlossen).',
  learn:'> und >= an der Grenze unterscheiden.',
  take:'Grenzwerte genau lesen: „ab 60“ heisst <code>&gt;= 60</code>, „über 60“ heisst <code>&gt; 60</code>.',
  vars:{ Wind_kmh:0, Windwarnung:false },
  tests: [59, 60, 61].map(w => [{ Wind_kmh:w }, { Windwarnung: w >= 60 }]),
  start:'NETWORK Windwarnung\n[Wind_kmh > 60] => Windwarnung;', ref:'NETWORK Windwarnung\n[Wind_kmh >= 60] => Windwarnung;', man:'vergleich', must:['CMP'],
  hint:'Welcher Operator schliesst die 60 ein?',
  bind:['windSpeed=Wind_kmh','windWarn=Windwarnung'] });

defKop({ id:'k9_mul', ch:9, title:'m/s in km/h',
  story:'Der Umrichter meldet die Seilgeschwindigkeit in m/s, die Anzeige will km/h. Die Umrechnung: mal 3,6.',
  brief:'Ohne Bedingung → <b>MUL</b>: IN1 <code>Seil_ms</code>, IN2 <code>3.6</code>, OUT <code>Seil_kmh</code>.<br>Kommazahlen schreibst du mit Punkt: <code>3.6</code>.',
  learn:'Rechnen mit Kommazahlen (REAL).',
  take:'Kommazahlen (REAL) werden mit <b>Punkt</b> geschrieben. MUL, DIV und Co. arbeiten auch mit REAL — Ergebnis und Operanden müssen dann REAL sein.',
  vars:{ Seil_ms:0, Seil_kmh:0 }, types:{ Seil_ms:'REAL', Seil_kmh:'REAL' },
  tests: [[{ Seil_ms:5 }, { Seil_kmh:18 }], [{ Seil_ms:2.5 }, { Seil_kmh:9 }], [{ Seil_ms:0 }, { Seil_kmh:0 }]],
  ref:'NETWORK Umrechnung\n=> MUL(Seil_ms, 3.6, Seil_kmh);', man:'werte', must:['MUL'],
  hint:'Element antippen → ohne Bedingung; Spule → Rechnen → Box MUL.',
  bind:['displayValue=Seil_kmh','displayLabel:"SEIL km/h"'] });

defKop({ id:'k9_hyst_dbg', ch:9, title:'Die verdrehte Hysterese', debug:true,
  story:'Die Bahn stoppt schon bei 40 km/h und läuft erst unter … nie wieder? ARIA hat die Schwellen der Hysterese vertauscht.',
  brief:'Stopp über <b>60</b> km/h, Freigabe unter <b>40</b> km/h.',
  learn:'Schwellen einer Hysterese prüfen.',
  take:'Die obere Schwelle schaltet ein (Stopp), die untere aus (Freigabe). Vertauscht ergibt sich ein Durcheinander.',
  vars:{ Wind_kmh:0, Wind_Stopp:false },
  timed: seq([[0,{Wind_kmh:50},{Wind_Stopp:false}],[0.1,{Wind_kmh:61},{Wind_Stopp:true}],[0.1,{Wind_kmh:45},{Wind_Stopp:true}],[0.1,{Wind_kmh:30},{Wind_Stopp:false}]]),
  start:'NETWORK Sturm\n[Wind_kmh > 40] => S Wind_Stopp;\n\nNETWORK Beruhigt\n[Wind_kmh < 60] => R Wind_Stopp;',
  ref:'NETWORK Sturm\n[Wind_kmh > 60] => S Wind_Stopp;\n\nNETWORK Beruhigt\n[Wind_kmh < 40] => R Wind_Stopp;', man:'vergleich', must:['CMP'],
  hint:'Welche Zahl gehört zum Setzen, welche zum Rücksetzen?',
  bind:['windSpeed=Wind_kmh','windWarn=Wind_Stopp'] });

defKop({ id:'k9_boss', ch:9, title:'Boss: Die Wetterstation', boss:true,
  story:'ARIA fälscht die Windmeldungen. Der Werkmeister hängt ein neues Anemometer auf und sagt: „Du baust die Wetterstation. Ehrlich, mit Hysterese, und die Anzeige zeigt die Wahrheit.“',
  brief:'<b>NW 1:</b> ohne Bedingung → MOVE <code>Wind_kmh</code> nach <code>Anzeige</code><br><b>NW 2:</b> <code>Wind_kmh</code> ≥ 40 → <code>Ampel_Gelb</code><br><b>NW 3:</b> <code>Wind_kmh</code> &gt; 60 setzt <code>Wind_Stopp</code><br><b>NW 4:</b> <code>Wind_kmh</code> &lt; 40 und <code>Quittieren</code> setzt <code>Wind_Stopp</code> zurück<br><b>NW 5:</b> <code>Fahrt</code> und nicht <code>Wind_Stopp</code> → <code>Antrieb</code>',
  learn:'Vergleicher, Hysterese und MOVE in einer Überwachung.',
  take:'Messwert anzeigen, frühzeitig warnen, mit Hysterese abschalten und nur mit Quittieren wieder freigeben — so arbeitet eine echte Windüberwachung.',
  vars:{ Wind_kmh:0, Quittieren:false, Fahrt:true, Anzeige:0, Ampel_Gelb:false, Wind_Stopp:false, Antrieb:false },
  timed: seq([[0,{Wind_kmh:30},{Anzeige:30, Ampel_Gelb:false, Antrieb:true}],[0.1,{Wind_kmh:45},{Anzeige:45, Ampel_Gelb:true, Antrieb:true}],[0.1,{Wind_kmh:62},{Wind_Stopp:true, Antrieb:false}],[0.1,{Wind_kmh:35},{Wind_Stopp:true, Antrieb:false}],[0.1,{Quittieren:true},{Wind_Stopp:false, Antrieb:true}],[0.1,{Quittieren:false, Wind_kmh:50, Fahrt:false},{Antrieb:false}]]),
  ref:'NETWORK Anzeige\n=> MOVE(Wind_kmh, Anzeige);\n\nNETWORK Warnung\n[Wind_kmh >= 40] => Ampel_Gelb;\n\nNETWORK Sturm\n[Wind_kmh > 60] => S Wind_Stopp;\n\nNETWORK Freigabe\n[Wind_kmh < 40] AND Quittieren => R Wind_Stopp;\n\nNETWORK Antrieb\nFahrt AND NOT Wind_Stopp => Antrieb;',
  man:'vergleich', must:['CMP','MOVE','SET','RESET'],
  hint:'Fünf kurze Netzwerke. NW 4 hat einen Vergleicher und einen Kontakt in Reihe.',
  bind:['windSpeed=Wind_kmh','displayValue=Anzeige','displayLabel:"WIND km/h"','lightYellow=Ampel_Gelb','windWarn=Wind_Stopp','motorOn=Antrieb'] });
})();
