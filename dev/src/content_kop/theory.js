/* ===== KOP QUEST: Theorie-Aufträge (Kapitel 1–10) =====
   <pre class="kop">…</pre> wird als Kontaktplan dargestellt; q.kop in Fragen ebenso.
   verifyKop: { src, vars, tests:[[setup, expect]] } — der Validator prüft die Aussage mit der Engine. */
(function(){
defTheory({ id:'kt1a', ch:1, pos:'start', title:'Der Kontaktplan', minutes:4,
  lesson:`
<p>Der <b>Kontaktplan (KOP)</b> stammt aus der Zeit der Relaisschaltungen: Links verläuft die <b>Stromschiene</b> (Plus), rechts die Rückleitung. Dazwischen liegt ein Strompfad aus <b>Kontakten</b> und am Ende <b>Spulen</b>.</p>
<pre class="kop">NETWORK Beleuchtung
S_Licht => Beleuchtung;</pre>
<ul><li>Ein <b>Schliesser</b> <code>—| |—</code> leitet, wenn seine Variable <b>1</b> ist.</li>
<li>Eine <b>Spule</b> <code>—( )—</code> wird 1, wenn Strom bis zu ihr fliesst, sonst 0.</li>
<li>Über jedem Element steht die <b>Variable</b> (Eingang, Ausgang oder Merker).</li></ul>
<h4>Die SPS im Zyklus</h4>
<p>Auch ein Kontaktplan läuft zyklisch: Eingänge lesen → alle Netzwerke von oben nach unten auswerten → Ausgänge schreiben. Das wiederholt sich viele Male pro Sekunde.</p>
<p>In KOP Quest siehst du beim Testen, wo Strom fliesst: <span style="color:#39ff14">grün</span> = Strom, grau = kein Strom.</p>`,
  questions:[
    {type:'single', q:'Wann leitet ein Schliesser?', options:['Wenn seine Variable 1 ist','Wenn seine Variable 0 ist','Immer','Nie, er öffnet nur'], correct:0,
     explain:'Der Schliesser ist im Ruhezustand offen und schliesst bei Signal 1.'},
    {type:'single', q:'Wo steht im Kontaktplan die Spule?', options:['Rechts am Ende des Strompfads','Links an der Stromschiene','Irgendwo in der Mitte','Unter dem Netzwerk'], correct:0,
     explain:'Links die Bedingungen (Kontakte), rechts die Wirkung (Spule).'},
    {type:'single', q:'<code>S_Licht</code> ist 0. Was ist <code>Beleuchtung</code>?', kop:'NETWORK Beleuchtung\nS_Licht => Beleuchtung;', options:['0','1','Behält den alten Wert'], correct:0,
     explain:'Ohne Stromfluss wird die Spule in diesem Zyklus 0.',
     verifyKop:{ src:'NETWORK B\nS_Licht => Beleuchtung;', vars:{ S_Licht:false, Beleuchtung:true }, tests:[[{}, { Beleuchtung:false }]] }},
    {type:'single', q:'In welcher Reihenfolge wertet die SPS die Netzwerke aus?', options:['Von oben nach unten, in jedem Zyklus','Nur wenn sich ein Eingang ändert','Von unten nach oben','Alle gleichzeitig, einmal beim Einschalten'], correct:0,
     explain:'Netzwerk für Netzwerk, von oben nach unten — und das in jedem Zyklus aufs Neue.'},
    {type:'single', q:'Was zeigt die grüne Farbe beim Testen in KOP Quest?', options:['Hier fliesst in diesem Zyklus Strom','Hier ist ein Fehler','Diese Variable ist ein Eingang'], correct:0,
     explain:'Grün markiert den Stromfluss — so siehst du, bis wohin der Strom kommt.'}
  ]});
defTheory({ id:'kt1b', ch:1, pos:'mid', title:'Reihenschaltung und Netzwerke', minutes:4,
  lesson:`
<p>Kontakte <b>hintereinander</b> bilden eine <b>Reihenschaltung</b>. Strom kommt nur durch, wenn <b>alle</b> Kontakte leiten — das ist eine UND-Verknüpfung.</p>
<pre class="kop">NETWORK Abfahrt
S_Start AND Tuer_Zu AND Not_Halt_OK => Antrieb, Ampel_Gruen;</pre>
<p>Am Ende dürfen <b>mehrere Spulen parallel</b> liegen: Alle bekommen denselben Stromfluss.</p>
<h4>Netzwerke</h4>
<p>Ein Programm besteht aus <b>Netzwerken</b>. Jedes Netzwerk hat einen Titel und löst eine Aufgabe. Die SPS arbeitet sie der Reihe nach ab.</p>
<table><tr><th>Im Editor</th><th>Wirkung</th></tr>
<tr><td>Element antippen → Variable in der Liste klicken</td><td>Variable zuweisen</td></tr>
<tr><td>Kontakt dahinter</td><td>neuer Kontakt in Reihe</td></tr>
<tr><td>weitere Spule</td><td>zusätzliche Spule parallel</td></tr>
<tr><td>+ Netzwerk</td><td>neues Netzwerk anlegen</td></tr></table>`,
  questions:[
    {type:'single', q:'Drei Kontakte liegen in Reihe. Wann ist die Spule 1?', options:['Wenn alle drei leiten','Wenn mindestens einer leitet','Wenn genau einer leitet','Nie'], correct:0,
     explain:'Reihe = UND: Jeder offene Kontakt unterbricht den Strompfad.'},
    {type:'single', q:'<code>S_Start</code> = 1, <code>Tuer_Zu</code> = 0. Was ist <code>Antrieb</code>?', kop:'NETWORK Abfahrt\nS_Start AND Tuer_Zu => Antrieb;', options:['0','1'], correct:0,
     explain:'Der Kontakt Tuer_Zu ist offen — kein Strom zur Spule.',
     verifyKop:{ src:'NETWORK A\nS_Start AND Tuer_Zu => Antrieb;', vars:{ S_Start:true, Tuer_Zu:false, Antrieb:false }, tests:[[{}, { Antrieb:false }]] }},
    {type:'single', q:'Zwei Spulen am Ende desselben Strompfads …', options:['bekommen beide denselben Stromfluss','schalten abwechselnd','sind verboten'], correct:0,
     explain:'Parallele Spulen am Ende eines Strompfads werden gemeinsam geschaltet.'},
    {type:'single', q:'Warum teilt man ein Programm in Netzwerke auf?', options:['Jedes Netzwerk löst eine Aufgabe — der Plan bleibt lesbar','Weil ein Netzwerk nur einen Kontakt haben darf','Damit die SPS schneller wird'], correct:0,
     explain:'Übersicht: ein Netzwerk pro Aufgabe, mit sprechendem Titel.'},
    {type:'multi', q:'Welche Bedingungen gehören in Reihe vor den Antrieb einer Seilbahn? (alle richtigen)', options:['Türen geschlossen','Not-Halt nicht gedrückt','Startbefehl','Beleuchtung an'], correct:[0,1,2],
     explain:'Türen, Not-Halt und Start sind Voraussetzungen für die Fahrt. Die Beleuchtung hat mit der Freigabe nichts zu tun.'}
  ]});
defTheory({ id:'kt2a', ch:2, pos:'start', title:'Der Öffner', minutes:4,
  lesson:`
<p>Der <b>Öffner</b> <code>—|/|—</code> ist im Ruhezustand geschlossen: Er leitet, solange seine Variable <b>0</b> ist, und öffnet bei 1.</p>
<pre class="kop">NETWORK Ampel
NOT Tuer_Zu => Ampel_Rot;</pre>
<p>Hier leuchtet Rot, solange die Tür <b>nicht</b> zu ist.</p>
<h4>Ruhestromprinzip</h4>
<p>Ein Not-Halt-Taster liefert im Normalzustand <b>1</b> (<code>Not_Halt_OK</code>) und beim Drücken <b>0</b>. Reisst ein Draht, kommt ebenfalls 0 an — die Anlage hält an. Im Programm fragst du <code>Not_Halt_OK</code> deshalb mit einem <b>Schliesser</b> ab.</p>
<p>Merke: Der Kontakt im Programm sagt, <b>wann Strom fliessen soll</b> — nicht, wie der Taster draussen gebaut ist.</p>`,
  questions:[
    {type:'single', q:'Wann leitet ein Öffner?', options:['Wenn seine Variable 0 ist','Wenn seine Variable 1 ist','Nur bei einer Flanke'], correct:0,
     explain:'Der Öffner ist das Gegenstück zum Schliesser.'},
    {type:'single', q:'<code>Tuer_Zu</code> = 1. Was ist <code>Ampel_Rot</code>?', kop:'NETWORK Ampel\nNOT Tuer_Zu => Ampel_Rot;', options:['0','1'], correct:0,
     explain:'Der Öffner ist bei 1 offen — kein Strom zur Spule.',
     verifyKop:{ src:'NETWORK A\nNOT Tuer_Zu => Ampel_Rot;', vars:{ Tuer_Zu:true, Ampel_Rot:true }, tests:[[{}, { Ampel_Rot:false }]] }},
    {type:'single', q:'Warum liefert ein Not-Halt im Normalzustand Signal 1?', options:['Damit ein Drahtbruch wie ein Not-Halt wirkt','Damit er weniger Strom braucht','Das ist nur Gewohnheit'], correct:0,
     explain:'Ruhestromprinzip: Jede Unterbrechung führt in den sicheren Zustand.'},
    {type:'single', q:'Wie fragst du <code>Not_Halt_OK</code> (1 = alles gut) vor dem Antrieb ab?', options:['Als Schliesser','Als Öffner','Gar nicht, das macht die Hardware'], correct:0,
     explain:'Der Antrieb darf laufen, wenn Not_Halt_OK = 1 ist — also Schliesser.'},
    {type:'single', q:'<code>S_Start</code> = 1, <code>Not_Halt_OK</code> = 0. Was ist <code>Antrieb</code>?', kop:'NETWORK Antrieb\nS_Start AND Not_Halt_OK => Antrieb;', options:['0','1'], correct:0,
     explain:'Not-Halt ausgelöst: Der Schliesser Not_Halt_OK sperrt.',
     verifyKop:{ src:'NETWORK A\nS_Start AND Not_Halt_OK => Antrieb;', vars:{ S_Start:true, Not_Halt_OK:false, Antrieb:true }, tests:[[{}, { Antrieb:false }]] }}
  ]});
defTheory({ id:'kt2b', ch:2, pos:'mid', title:'Parallelzweige', minutes:4,
  lesson:`
<p>Kontakte <b>untereinander</b> bilden eine <b>Parallelschaltung</b>: Strom kommt durch, wenn <b>mindestens ein</b> Zweig leitet — eine ODER-Verknüpfung.</p>
<pre class="kop">NETWORK Tuer
S_Tuer OR S_Tuer_Kabine => Tuer_Auf;</pre>
<h4>Mischformen</h4>
<pre class="kop">NETWORK Abfahrt
(S_Start OR S_Start_Kabine) AND Tuer_Zu => Antrieb;</pre>
<p>Der Parallelblock wird zuerst ausgewertet, dann die Reihe dahinter. Das entspricht Klammern: <code>(A ODER B) UND C</code>.</p>
<p>Achtung: <code>A ODER (B UND C)</code> ist etwas anderes — dort liegt C nur im unteren Zweig.</p>`,
  questions:[
    {type:'single', q:'Zwei Kontakte liegen parallel. Wann ist die Spule 1?', options:['Wenn mindestens einer leitet','Nur wenn beide leiten','Nie'], correct:0,
     explain:'Parallel = ODER.'},
    {type:'single', q:'<code>S_Start</code> = 0, <code>S_Start_Kabine</code> = 1, <code>Tuer_Zu</code> = 1. <code>Antrieb</code>?', kop:'NETWORK Abfahrt\n(S_Start OR S_Start_Kabine) AND Tuer_Zu => Antrieb;', options:['1','0'], correct:0,
     explain:'Der untere Zweig leitet, danach Tuer_Zu — Strom kommt an.',
     verifyKop:{ src:'NETWORK A\n(S_Start OR S_Start_Kabine) AND Tuer_Zu => Antrieb;', vars:{ S_Start:false, S_Start_Kabine:true, Tuer_Zu:true, Antrieb:false }, tests:[[{}, { Antrieb:true }]] }},
    {type:'single', q:'<code>A</code> = 1, <code>B</code> = 0, <code>C</code> = 0. Was ist <code>Q</code>?', kop:'NETWORK X\nA OR (B AND C) => Q;', options:['1','0'], correct:0,
     explain:'Der obere Zweig A leitet allein — C liegt nur im unteren Zweig.',
     verifyKop:{ src:'NETWORK X\nA OR (B AND C) => Q;', vars:{ A:true, B:false, C:false, Q:false }, tests:[[{}, { Q:true }]] }},
    {type:'single', q:'Welche Schreibweise passt zu „Start am Pult oder in der Kabine, aber nur bei geschlossener Tür“?', options:['(S_Start ODER S_Kabine) UND Tuer_Zu','S_Start ODER (S_Kabine UND Tuer_Zu)','S_Start UND S_Kabine UND Tuer_Zu'], correct:0,
     explain:'Die Tür gilt für beide Startstellen — sie liegt hinter dem Parallelblock.'},
    {type:'multi', q:'Welche Aussagen stimmen? (alle richtigen)', options:['Reihe = UND','Parallel = ODER','Ein Öffner = NICHT','Eine Spule kann nur einen Kontakt haben'], correct:[0,1,2],
     explain:'Mit diesen drei Bausteinen lässt sich jede Verknüpfung zeichnen.'}
  ]});
defTheory({ id:'kt3a', ch:3, pos:'start', title:'Die Selbsthaltung', minutes:5,
  lesson:`
<p>Ein Taster liefert nur 1, solange er gedrückt ist. Damit der Antrieb weiterläuft, hält sich die Spule über einen <b>eigenen Kontakt</b> parallel zum Taster:</p>
<pre class="kop">NETWORK Antrieb
(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;</pre>
<ol><li>S_Start drücken → Strom → Antrieb = 1.</li>
<li>S_Start loslassen → der Zweig <code>Antrieb</code> leitet jetzt → Antrieb bleibt 1.</li>
<li>S_Stopp drücken → der Öffner öffnet → Antrieb = 0, die Haltung ist gelöst.</li></ol>
<h4>Aus-Vorrang</h4>
<p>Werden Start und Stopp gleichzeitig gedrückt, gewinnt hier <b>Stopp</b>, weil er hinter dem Parallelblock liegt. Für Antriebe ist das die sichere Wahl.</p>`,
  questions:[
    {type:'single', q:'Wozu dient der Kontakt <code>Antrieb</code> parallel zu <code>S_Start</code>?', options:['Er hält die Spule, nachdem der Taster losgelassen wurde','Er startet den Antrieb doppelt','Er ist ein Fehler'], correct:0,
     explain:'Das ist die Selbsthaltung.'},
    {type:'single', q:'Antrieb läuft (1), niemand drückt etwas. Was passiert im nächsten Zyklus?', kop:'NETWORK Antrieb\n(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;', options:['Antrieb bleibt 1','Antrieb wird 0'], correct:0,
     explain:'Der Haltezweig leitet, Stopp ist nicht gedrückt.',
     verifyKop:{ src:'NETWORK A\n(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;', vars:{ S_Start:false, S_Stopp:false, Antrieb:true }, tests:[[{}, { Antrieb:true }]] }},
    {type:'single', q:'Start und Stopp werden gleichzeitig gedrückt. Ergebnis?', kop:'NETWORK Antrieb\n(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;', options:['Antrieb = 0 (Aus-Vorrang)','Antrieb = 1 (Ein-Vorrang)'], correct:0,
     explain:'Der Stopp-Öffner liegt hinter dem Parallelblock und unterbricht alles.',
     verifyKop:{ src:'NETWORK A\n(S_Start OR Antrieb) AND NOT S_Stopp => Antrieb;', vars:{ S_Start:true, S_Stopp:true, Antrieb:false }, tests:[[{}, { Antrieb:false }]] }},
    {type:'single', q:'Wo muss ein Not-Halt in der Selbsthaltung liegen?', options:['In Reihe hinter dem Parallelblock','Parallel zu S_Start','Nur im Haltezweig'], correct:0,
     explain:'Nur so unterbricht er in jedem Fall.'},
    {type:'single', q:'Warum reicht <code>S_Start => Antrieb</code> nicht?', options:['Der Antrieb stoppt, sobald der Taster losgelassen wird','Weil ein Taster immer 1 ist','Das reicht doch'], correct:0,
     explain:'Ohne Haltung folgt die Spule direkt dem Taster.'}
  ]});
defTheory({ id:'kt3b', ch:3, pos:'mid', title:'Verriegelung', minutes:4,
  lesson:`
<p>Die Seilbahn darf nie gleichzeitig bergwärts und talwärts fahren. Jede Richtung bekommt deshalb einen <b>Öffner der Gegenrichtung</b>:</p>
<pre class="kop">NETWORK Fahrt Berg
(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;

NETWORK Fahrt Tal
(S_Tal OR Fahrt_Tal) AND NOT S_Stopp AND NOT Fahrt_Berg => Fahrt_Tal;</pre>
<p>Läuft Berg, sperrt der Öffner <code>Fahrt_Berg</code> im Tal-Netzwerk. Um die Richtung zu wechseln, muss zuerst gestoppt werden.</p>
<h4>Ein-Vorrang</h4>
<p>Liegt der Stopp nur im <b>Haltezweig</b> (<code>S_Ein OR (Q AND NOT S_Aus)</code>), gewinnt Ein, wenn beide gedrückt sind. Das ist z. B. für eine Warnhupe sinnvoll, nie für einen Antrieb.</p>`,
  questions:[
    {type:'single', q:'Wozu dient <code>NOT Fahrt_Tal</code> im Netzwerk Fahrt Berg?', options:['Verriegelung: Berg kann nicht starten, solange Tal läuft','Er startet die Talfahrt','Er ersetzt den Stopptaster'], correct:0,
     explain:'Gegenseitige Verriegelung über Öffner.'},
    {type:'single', q:'Fahrt_Tal läuft. Jemand drückt <code>S_Berg</code>. Was passiert?', kop:'NETWORK Fahrt Berg\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;', options:['Nichts — Fahrt_Berg bleibt 0','Fahrt_Berg wird 1'], correct:0,
     explain:'Der Öffner Fahrt_Tal sperrt.',
     verifyKop:{ src:'NETWORK B\n(S_Berg OR Fahrt_Berg) AND NOT S_Stopp AND NOT Fahrt_Tal => Fahrt_Berg;', vars:{ S_Berg:true, S_Stopp:false, Fahrt_Tal:true, Fahrt_Berg:false }, tests:[[{}, { Fahrt_Berg:false }]] }},
    {type:'single', q:'<code>S_Ein</code> = 1 und <code>S_Aus</code> = 1. Was ist <code>Hupe</code>?', kop:'NETWORK Hupe\nS_Ein OR (Hupe AND NOT S_Aus) => Hupe;', options:['1 (Ein-Vorrang)','0 (Aus-Vorrang)'], correct:0,
     explain:'S_Ein liegt direkt an der Schiene, der Aus-Öffner nur im Haltezweig.',
     verifyKop:{ src:'NETWORK H\nS_Ein OR (Hupe AND NOT S_Aus) => Hupe;', vars:{ S_Ein:true, S_Aus:true, Hupe:false }, tests:[[{}, { Hupe:true }]] }},
    {type:'single', q:'Welche Vorrangart für einen Seilbahnantrieb?', options:['Aus-Vorrang','Ein-Vorrang','Egal'], correct:0,
     explain:'Im Zweifel muss die Anlage stehen.'},
    {type:'single', q:'Wie wechselt man bei verriegelten Richtungen von Berg auf Tal?', options:['Erst Stopp, dann Tal','Einfach Tal drücken','Beide gleichzeitig drücken'], correct:0,
     explain:'Die Verriegelung erzwingt den Halt dazwischen.'}
  ]});
defTheory({ id:'kt4a', ch:4, pos:'start', title:'Setzen und Rücksetzen', minutes:4,
  lesson:`
<p>Neben der normalen Spule gibt es zwei speichernde Spulen:</p>
<ul><li><b>S</b> <code>—(S)—</code>: Strom → Variable wird 1. Ohne Strom: <b>unverändert</b>.</li>
<li><b>R</b> <code>—(R)—</code>: Strom → Variable wird 0. Ohne Strom: unverändert.</li></ul>
<pre class="kop">NETWORK Stoerung speichern
Seil_Fehler => S Stoerung;

NETWORK Quittieren
Quittieren AND NOT Seil_Fehler => R Stoerung;</pre>
<p>Eine kurze Seilstörung bleibt so gespeichert, bis jemand quittiert — und Quittieren wirkt erst, wenn der Fehler weg ist.</p>
<h4>Vorrang durch Reihenfolge</h4>
<p>Wirken S und R im selben Zyklus, gewinnt das <b>untere</b> Netzwerk, weil es zuletzt schreibt.</p>`,
  questions:[
    {type:'single', q:'Was macht eine S-Spule, wenn kein Strom fliesst?', options:['Nichts — der Wert bleibt','Sie setzt auf 0','Sie setzt auf 1'], correct:0,
     explain:'Das ist der Unterschied zur normalen Spule.'},
    {type:'single', q:'<code>Seil_Fehler</code> war kurz 1 und ist jetzt wieder 0. <code>Stoerung</code>?', kop:'NETWORK St\nSeil_Fehler => S Stoerung;', options:['Bleibt 1','Wird 0'], correct:0,
     explain:'Gesetzt ist gesetzt, bis ein R wirkt.',
     verifyKop:{ src:'NETWORK St\nSeil_Fehler => S Stoerung;', vars:{ Seil_Fehler:false, Stoerung:false }, steps:[[0,{Seil_Fehler:true},{Stoerung:true}],[0.1,{Seil_Fehler:false},{Stoerung:true}]] }},
    {type:'single', q:'S in NW 1, R in NW 2, beide bekommen Strom. Ergebnis?', options:['0 — das untere Netzwerk gewinnt','1 — Setzen gewinnt immer','Zufällig'], correct:0,
     explain:'Rücksetzdominant, weil R zuletzt schreibt.',
     verifyKop:{ src:'NETWORK A\nX => S Q;\n\nNETWORK B\nX => R Q;', vars:{ X:true, Q:false }, tests:[[{}, { Q:false }]] }},
    {type:'single', q:'Warum steht im Quittier-Netzwerk <code>NOT Seil_Fehler</code>?', options:['Quittieren soll nur wirken, wenn der Fehler behoben ist','Damit Quittieren schneller geht','Das ist überflüssig'], correct:0,
     explain:'Sonst würde eine noch anstehende Störung weggedrückt.'},
    {type:'single', q:'Was schreibt eine negierte Spule <code>—(/)—</code> bei Stromfluss?', options:['0','1','Nichts'], correct:0,
     explain:'Sie schreibt das Gegenteil des Stromflusses.'}
  ]});
defTheory({ id:'kt4b', ch:4, pos:'mid', title:'Speichern oder Selbsthaltung?', minutes:4,
  lesson:`
<p>Ein Antrieb lässt sich mit Selbsthaltung <b>oder</b> mit S/R bauen:</p>
<pre class="kop">NETWORK Antrieb ein
S_Start AND Tuer_Zu => S Antrieb;

NETWORK Antrieb aus
S_Stopp OR NOT Not_Halt_OK OR NOT Tuer_Zu => R Antrieb;</pre>
<p>Beim S/R-Aufbau stehen Ein- und Aus-Bedingungen in <b>eigenen Netzwerken</b>. Alle Abschaltgründe liegen <b>parallel</b> vor der R-Spule.</p>
<h4>Sammelstörung</h4>
<p>Mehrere gespeicherte Einzelstörungen werden parallel zu einer <b>Sammelstörung</b> zusammengefasst, die z. B. die rote Lampe schaltet.</p>
<h4>Doppelspule</h4>
<p>Eine normale Spule sollte pro Variable nur <b>einmal</b> vorkommen. Zwei Netzwerke mit derselben Spule: Das untere überschreibt das obere.</p>`,
  questions:[
    {type:'single', q:'Wie liegen mehrere Abschaltgründe vor einer R-Spule?', options:['Parallel — jeder allein schaltet ab','In Reihe — alle zusammen','Gar nicht, eine R-Spule hat nur einen Kontakt'], correct:0,
     explain:'Jeder Grund soll allein reichen.'},
    {type:'single', q:'Antrieb = 1. Die Tür öffnet (<code>Tuer_Zu</code> = 0). Was passiert?', kop:'NETWORK Antrieb aus\nS_Stopp OR NOT Tuer_Zu => R Antrieb;', options:['Antrieb wird 0','Antrieb bleibt 1'], correct:0,
     explain:'Der Öffner Tuer_Zu leitet und aktiviert R.',
     verifyKop:{ src:'NETWORK Aus\nS_Stopp OR NOT Tuer_Zu => R Antrieb;', vars:{ S_Stopp:false, Tuer_Zu:false, Antrieb:true }, tests:[[{}, { Antrieb:false }]] }},
    {type:'single', q:'Was ist eine Sammelstörung?', options:['ODER aller Einzelstörungen','UND aller Einzelstörungen','Die älteste Störung'], correct:0,
     explain:'Irgendeine Störung → Sammelstörung.'},
    {type:'single', q:'NW 1: <code>A => Lampe</code>, NW 2: <code>B => Lampe</code>. A = 1, B = 0. Lampe?', options:['0 — NW 2 überschreibt','1'], correct:0,
     explain:'Doppelspule: Das letzte Netzwerk gewinnt.',
     verifyKop:{ src:'NETWORK A\nA => Lampe;\n\nNETWORK B\nB => Lampe;', vars:{ A:true, B:false, Lampe:false }, tests:[[{}, { Lampe:false }]] }},
    {type:'single', q:'Wie behebst du die Doppelspule aus der letzten Frage?', options:['Ein Netzwerk: A ODER B → Lampe','Die Netzwerke tauschen','Eine dritte Spule Lampe'], correct:0,
     explain:'Jede Spule genau einmal — die Bedingungen parallel.'}
  ]});
defTheory({ id:'kt5a', ch:5, pos:'start', title:'Flanken', minutes:5,
  lesson:`
<p>Die SPS arbeitet viele Zyklen pro Sekunde. Ein Tastendruck dauert Dutzende Zyklen. Soll nur <b>einmal</b> gezählt werden, braucht es eine <b>Flanke</b>:</p>
<pre class="kop">NETWORK Zaehlen
P(Drehkreuz) => INC(Fahrgaeste);</pre>
<ul><li><b>P-Flanke</b> <code>—|P|—</code>: leitet genau <b>einen Zyklus</b>, wenn das Signal von 0 auf 1 wechselt.</li>
<li><b>N-Flanke</b> <code>—|N|—</code>: leitet einen Zyklus beim Wechsel von 1 auf 0.</li></ul>
<p>Die Flanke merkt sich intern den Wert des letzten Zyklus und vergleicht ihn mit dem aktuellen.</p>`,
  questions:[
    {type:'single', q:'Wie lange leitet eine P-Flanke?', options:['Genau einen Zyklus','Solange das Signal 1 ist','Eine Sekunde'], correct:0,
     explain:'Nur im Zyklus des Wechsels 0 → 1.'},
    {type:'single', q:'Das Drehkreuz ist 3 Zyklen lang 1. Um wie viel steigt Fahrgaeste?', kop:'NETWORK Z\nP(Drehkreuz) => INC(Fahrgaeste);', options:['1','3','0'], correct:0,
     explain:'Nur die steigende Flanke zählt.',
     verifyKop:{ src:'NETWORK Z\nP(Drehkreuz) => INC(Fahrgaeste);', vars:{ Drehkreuz:false, Fahrgaeste:0 }, steps:[[0,{Drehkreuz:true},{}],[0.1,{},{}],[0.1,{},{Fahrgaeste:1}]] }},
    {type:'single', q:'Und ohne Flanke (<code>Drehkreuz => INC(Fahrgaeste)</code>)?', options:['3 — in jedem Zyklus eins','1','0'], correct:0,
     explain:'Ohne Flanke zählt jeder Zyklus.',
     verifyKop:{ src:'NETWORK Z\nDrehkreuz => INC(Fahrgaeste);', vars:{ Drehkreuz:false, Fahrgaeste:0 }, steps:[[0,{Drehkreuz:true},{}],[0.1,{},{}],[0.1,{},{Fahrgaeste:3}]] }},
    {type:'single', q:'Wann leitet eine N-Flanke?', options:['Beim Wechsel von 1 auf 0','Beim Wechsel von 0 auf 1','Solange das Signal 0 ist'], correct:0,
     explain:'N = negative (fallende) Flanke.'},
    {type:'single', q:'Du willst eine Aktion beim <b>Loslassen</b> eines Tasters. Welche Flanke?', options:['N-Flanke','P-Flanke','Keine'], correct:0,
     explain:'Loslassen = 1 → 0 = fallende Flanke.'}
  ]});
defTheory({ id:'kt5b', ch:5, pos:'mid', title:'Stromstoss und Flankenmerker', minutes:4,
  lesson:`
<p>Ein Taster, der bei jedem Drücken umschaltet (<b>Stromstoss</b>), braucht eine Flanke und einen Umschalter:</p>
<pre class="kop">NETWORK Flanke
P(S_Licht) => Impuls;

NETWORK Umschalten
(Impuls AND NOT Beleuchtung) OR (NOT Impuls AND Beleuchtung) => Beleuchtung;</pre>
<p>Der Flankenimpuls wird in einem <b>Merker</b> gespeichert, weil er im nächsten Netzwerk zweimal gebraucht wird. Eine Flanke selbst darf pro Variable nur an <b>einer</b> Stelle stehen — sie hat ein eigenes Gedächtnis.</p>
<h4>Flanke und S/R</h4>
<p>Eine Flanke vor einer S-Spule sorgt dafür, dass ein <b>gehaltener</b> Taster nicht dauernd neu setzt — z. B. damit Quittieren erst beim nächsten Druck wieder wirkt.</p>`,
  questions:[
    {type:'single', q:'Warum schreibt man die Flanke erst in einen Merker <code>Impuls</code>?', options:['Weil der Impuls danach mehrfach abgefragt wird','Weil Flanken keine Spulen schalten dürfen','Das ist nur Stil'], correct:0,
     explain:'Den Merker darf man beliebig oft abfragen.'},
    {type:'single', q:'<code>Impuls</code> = 1, <code>Beleuchtung</code> = 1. Ergebnis?', kop:'NETWORK U\n(Impuls AND NOT Beleuchtung) OR (NOT Impuls AND Beleuchtung) => Beleuchtung;', options:['0','1'], correct:0,
     explain:'Impuls kippt den Zustand: 1 → 0.',
     verifyKop:{ src:'NETWORK U\n(Impuls AND NOT Beleuchtung) OR (NOT Impuls AND Beleuchtung) => Beleuchtung;', vars:{ Impuls:true, Beleuchtung:true }, tests:[[{}, { Beleuchtung:false }]] }},
    {type:'single', q:'Was passiert beim Stromstoss, wenn man die Flanke weglässt und den Taster hält?', options:['Das Licht flackert jeden Zyklus','Das Licht bleibt an','Nichts'], correct:0,
     explain:'Ohne Flanke kippt der Zustand in jedem Zyklus.'},
    {type:'single', q:'Welcher Operator steckt im Umschalt-Netzwerk?', options:['Exklusiv-ODER (XOR)','UND','ODER'], correct:0,
     explain:'(A UND NICHT B) ODER (NICHT A UND B) = A XOR B.'},
    {type:'single', q:'Wie viele Male sollte <code>P(S_Licht)</code> im Programm stehen?', options:['Einmal','So oft wie nötig','Zweimal'], correct:0,
     explain:'Jede Flanke hat ein eigenes Gedächtnis; mehrfach verwendet sieht die zweite den Wechsel nicht mehr sauber.'}
  ]});
defTheory({ id:'kt6a', ch:6, pos:'start', title:'Einschaltverzögerung TON', minutes:5,
  lesson:`
<p>Zeitglieder sind <b>Boxen</b> im Strompfad. Der Strom vor der Box ist ihr Eingang <code>IN</code>, der Strom danach ihr Ausgang <code>Q</code>.</p>
<pre class="kop">NETWORK Tuer oeffnen
Kabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;</pre>
<p>Der <b>TON</b> schaltet <code>Q</code> erst ein, wenn <code>IN</code> die Zeit <code>PT</code> (hier 2 s) <b>ununterbrochen</b> ansteht. Fällt IN vorher weg, beginnt alles von vorn. Fällt IN weg, ist Q sofort 0.</p>
<p>Jeder Timer braucht eine eigene <b>Instanz</b> (hier <code>T_Tuer</code>) — sein Gedächtnis für die abgelaufene Zeit <code>ET</code>.</p>
<p>Zeiten schreibst du als <code>T#2S</code>, <code>T#500MS</code>, <code>T#1M30S</code>.</p>`,
  questions:[
    {type:'single', q:'Kabine_da ist seit 1 s da, PT = 2 s. Tuer_Auf?', kop:'NETWORK T\nKabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;', options:['0','1'], correct:0,
     explain:'Die Zeit ist noch nicht abgelaufen.',
     verifyKop:{ src:'NETWORK T\nKabine_da AND TON(T_Tuer, T#2S) => Tuer_Auf;', vars:{ Kabine_da:false, Tuer_Auf:false }, steps:[[0,{Kabine_da:true},{Tuer_Auf:false}],[1,{},{Tuer_Auf:false}],[1.1,{},{Tuer_Auf:true}]] }},
    {type:'single', q:'Was passiert, wenn IN nach 1,5 s kurz wegfällt und wieder kommt?', options:['Die Zeit beginnt von vorn','Die Zeit läuft weiter','Q wird sofort 1'], correct:0,
     explain:'TON verlangt ununterbrochenes Anstehen.'},
    {type:'single', q:'Q des TON ist 1. IN fällt weg. Q?', options:['Sofort 0','Nach PT 0','Bleibt 1'], correct:0,
     explain:'Der TON verzögert nur das Einschalten.'},
    {type:'input', q:'Wie schreibst du 500 Millisekunden als Zeitkonstante?', answer:['T#500MS','T#500ms','t#500ms'],
     explain:'T#500MS'},
    {type:'single', q:'Zwei Türen brauchen je eine Verzögerung. Wie viele TON-Instanzen?', options:['Zwei — jede mit eigenem Namen','Eine reicht für beide','Keine'], correct:0,
     explain:'Jede Instanz misst genau eine Zeit.'}
  ]});
defTheory({ id:'kt6b', ch:6, pos:'mid', title:'TOF und TP', minutes:5,
  lesson:`
<pre class="kop">NETWORK Licht Nachlauf
Person_da AND TOF(T_Licht, T#5S) => Beleuchtung;</pre>
<p>Der <b>TOF</b> (Ausschaltverzögerung) schaltet Q <b>sofort</b> ein, wenn IN kommt, und hält Q noch <b>PT lang</b>, nachdem IN weggefallen ist.</p>
<pre class="kop">NETWORK Gong
Kabine_da AND TP(T_Gong, T#1S) => Hupe;</pre>
<p>Der <b>TP</b> (Impuls) startet mit der steigenden Flanke an IN und liefert Q für genau PT — egal ob IN kürzer oder länger ansteht.</p>
<table><tr><th>Box</th><th>Q ein</th><th>Q aus</th></tr>
<tr><td>TON</td><td>PT nach IN ↑</td><td>sofort mit IN ↓</td></tr>
<tr><td>TOF</td><td>sofort mit IN ↑</td><td>PT nach IN ↓</td></tr>
<tr><td>TP</td><td>sofort mit IN ↑</td><td>genau PT später</td></tr></table>`,
  questions:[
    {type:'single', q:'Person_da fällt weg. Wie lange leuchtet die Beleuchtung noch (PT = 5 s)?', options:['5 s','Gar nicht','Bis zur nächsten Person'], correct:0,
     explain:'TOF = Nachlauf.'},
    {type:'single', q:'Person_da war 1 und ist seit 2 s wieder 0. Beleuchtung?', kop:'NETWORK L\nPerson_da AND TOF(T_Licht, T#5S) => Beleuchtung;', options:['1','0'], correct:0,
     explain:'Die Nachlaufzeit ist noch nicht vorbei.',
     verifyKop:{ src:'NETWORK L\nPerson_da AND TOF(T_Licht, T#5S) => Beleuchtung;', vars:{ Person_da:false, Beleuchtung:false }, steps:[[0,{Person_da:true},{Beleuchtung:true}],[0.1,{Person_da:false},{Beleuchtung:true}],[2,{},{Beleuchtung:true}]] }},
    {type:'single', q:'Welche Box für „Hupe genau 1 s, auch wenn der Taster länger gedrückt wird“?', options:['TP','TON','TOF'], correct:0,
     explain:'TP liefert einen Impuls fester Länge.'},
    {type:'single', q:'Welche Box für „Bremse erst 1 s nach dem Antrieb einfallen lassen“?', options:['TOF','TON','TP'], correct:0,
     explain:'Ausschalten verzögern = TOF.'},
    {type:'single', q:'IN eines TON steht 0,2 s an, PT = 1 s. Kommt Q?', options:['Nein','Ja, kurz','Ja, 1 s lang'], correct:0,
     explain:'Beim TON muss IN die volle Zeit anstehen.'}
  ]});
defTheory({ id:'kt7a', ch:7, pos:'start', title:'Takt und Blinker', minutes:4,
  lesson:`
<p>Viele Steuerungen haben einen <b>Taktmerker</b>, der z. B. mit 1 Hz zwischen 0 und 1 wechselt. In Reihe mit einer Bedingung wird daraus ein Blinklicht:</p>
<pre class="kop">NETWORK Blinken
Windwarnung AND Takt_1Hz => Ampel_Gelb;</pre>
<h4>Eigener Taktgeber</h4>
<pre class="kop">NETWORK Takt
NOT Impuls AND TON(T_Takt, T#500MS) => Impuls;</pre>
<p>Der TON läuft ab, liefert einen Impuls, dessen Öffner startet den TON im nächsten Zyklus neu. So entsteht alle 0,5 s ein Impuls von einem Zyklus. Mit einem Stromstoss-Umschalter wird daraus ein Blinker.</p>`,
  questions:[
    {type:'single', q:'Takt_1Hz ist 1, Windwarnung ist 0. Ampel_Gelb?', kop:'NETWORK B\nWindwarnung AND Takt_1Hz => Ampel_Gelb;', options:['0','1'], correct:0,
     explain:'Reihe: beide müssen leiten.',
     verifyKop:{ src:'NETWORK B\nWindwarnung AND Takt_1Hz => Ampel_Gelb;', vars:{ Windwarnung:false, Takt_1Hz:true, Ampel_Gelb:true }, tests:[[{}, { Ampel_Gelb:false }]] }},
    {type:'single', q:'Wie lange ist <code>Impuls</code> im eigenen Taktgeber jeweils 1?', options:['Einen Zyklus','0,5 s','1 s'], correct:0,
     explain:'Der Öffner Impuls setzt den TON sofort zurück.'},
    {type:'single', q:'Wozu dient der Öffner <code>NOT Impuls</code> vor dem TON?', options:['Er startet den Timer nach jedem Impuls neu','Er verlängert den Impuls','Er ist überflüssig'], correct:0,
     explain:'Ohne ihn bliebe Q dauerhaft 1.'},
    {type:'single', q:'Ein Blinker mit 1 Hz ist wie lange an und wie lange aus?', options:['0,5 s an, 0,5 s aus','1 s an, 1 s aus','1 s an, 0 s aus'], correct:0,
     explain:'1 Hz = eine volle Periode pro Sekunde.'},
    {type:'single', q:'Was braucht es zusätzlich, um aus den Impulsen ein Blinklicht zu machen?', options:['Einen Umschalter (Stromstoss)','Einen Zähler','Nichts'], correct:0,
     explain:'Jeder Impuls kippt die Lampe.'}
  ]});
defTheory({ id:'kt7b', ch:7, pos:'mid', title:'Überwachung und Vorwarnung', minutes:4,
  lesson:`
<p>Eine <b>Überwachungszeit</b> prüft, ob eine Rückmeldung rechtzeitig kommt:</p>
<pre class="kop">NETWORK Ueberwachung
Tuer_Schliessen AND NOT Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;</pre>
<p>Der Befehl steht an, die Rückmeldung fehlt noch → der TON läuft. Kommt die Rückmeldung nicht innerhalb von 4 s, wird die Störung <b>gespeichert</b>.</p>
<h4>Anlaufwarnung</h4>
<p>Bevor eine Anlage anläuft, warnt eine Hupe einige Sekunden: Ein TP oder ein TON zwischen Startbefehl und Antrieb sorgt dafür. Die <b>Reihenfolge</b> der Netzwerke bestimmt, ob ein Ausgang im selben oder im nächsten Zyklus reagiert.</p>`,
  questions:[
    {type:'single', q:'Wann läuft der Überwachungs-TON?', options:['Befehl da, Rückmeldung fehlt','Immer','Nur bei Störung'], correct:0,
     explain:'Genau dann, wenn auf die Rückmeldung gewartet wird.'},
    {type:'single', q:'Warum S-Spule statt normaler Spule für die Störung?', options:['Damit sie bis zum Quittieren bleibt','Weil TON keine normale Spule schalten kann','Das ist egal'], correct:0,
     explain:'Sonst verschwände die Meldung, sobald die Tür doch noch zugeht.'},
    {type:'single', q:'Tür meldet nach 2 s „zu“, PT = 4 s. Störung?', kop:'NETWORK U\nTuer_Schliessen AND NOT Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;', options:['Nein','Ja'], correct:0,
     explain:'Die Rückmeldung kam rechtzeitig, der TON bricht ab.',
     verifyKop:{ src:'NETWORK U\nTuer_Schliessen AND NOT Tuer_Zu AND TON(T_Ueber, T#4S) => S Stoerung;', vars:{ Tuer_Schliessen:false, Tuer_Zu:false, Stoerung:false }, steps:[[0,{Tuer_Schliessen:true},{}],[2,{Tuer_Zu:true},{Stoerung:false}],[3,{},{Stoerung:false}]] }},
    {type:'single', q:'Wozu dient eine Anlaufwarnung?', options:['Personen vor dem Anlauf zu warnen','Den Motor vorzuwärmen','Strom zu sparen'], correct:0,
     explain:'Sicherheit: Niemand soll vom Anlauf überrascht werden.'},
    {type:'single', q:'NW 2 liest einen Merker, den NW 3 schreibt. Wann sieht NW 2 den neuen Wert?', options:['Im nächsten Zyklus','Im selben Zyklus','Nie'], correct:0,
     explain:'Netzwerke werden von oben nach unten abgearbeitet.'}
  ]});
defTheory({ id:'kt8a', ch:8, pos:'start', title:'Vorwärtszähler CTU', minutes:5,
  lesson:`
<pre class="kop">NETWORK Gaeste
Drehkreuz AND CTU(Z_Gaeste, PV:=8, R:=Abfahrt) => Kabine_voll;</pre>
<p>Der <b>CTU</b> zählt bei jeder <b>steigenden Flanke</b> am Eingang <code>CU</code> seinen Zählwert <code>CV</code> um 1 hoch. Die Flanke ist schon eingebaut.</p>
<ul><li><code>PV</code> — Vorgabewert. <code>Q</code> = 1, sobald <code>CV ≥ PV</code>.</li>
<li><code>R</code> — Rücksetzen: CV = 0, solange R = 1.</li>
<li><code>Z_Gaeste.CV</code> — den Zählwert liest du über die Instanz.</li></ul>`,
  questions:[
    {type:'single', q:'Das Drehkreuz wird 3-mal betätigt. <code>Z_Gaeste.CV</code>?', options:['3','Die Anzahl Zyklen','8'], correct:0,
     explain:'Der CTU zählt Flanken, nicht Zyklen.'},
    {type:'single', q:'CV = 8, PV = 8. Kabine_voll?', options:['1','0'], correct:0,
     explain:'Q = CV ≥ PV.'},
    {type:'single', q:'Was bewirkt <code>R:=Abfahrt</code>?', options:['Bei Abfahrt wird der Zähler auf 0 gesetzt','Der Zähler zählt rückwärts','Der Zähler wird gesperrt'], correct:0,
     explain:'R setzt CV auf 0.'},
    {type:'single', q:'Nach 2 Flanken und PV = 2: Kabine_voll?', kop:'NETWORK G\nDrehkreuz AND CTU(Z, PV:=2, R:=Abfahrt) => Kabine_voll;', options:['1','0'], correct:0,
     explain:'CV = 2 ≥ PV = 2.',
     verifyKop:{ src:'NETWORK G\nDrehkreuz AND CTU(Z, PV:=2, R:=Abfahrt) => Kabine_voll;', vars:{ Drehkreuz:false, Abfahrt:false, Kabine_voll:false }, steps:[[0,{Drehkreuz:true},{Kabine_voll:false}],[0.1,{Drehkreuz:false},{}],[0.1,{Drehkreuz:true},{Kabine_voll:true}]] }},
    {type:'input', q:'Wie heisst der Ausgang für den aktuellen Zählwert?', answer:['CV','.CV'],
     explain:'CV = Current Value.'}
  ]});
defTheory({ id:'kt8b', ch:8, pos:'mid', title:'Rückwärtszähler CTD', minutes:4,
  lesson:`
<pre class="kop">NETWORK Wartung
Abfahrt AND CTD(Z_Wartung, PV:=5, LD:=Wartung_OK) => Wartung_faellig;</pre>
<p>Der <b>CTD</b> zählt bei jeder steigenden Flanke an <code>CD</code> herunter.</p>
<ul><li><code>LD</code> — Laden: CV = PV.</li>
<li><code>Q</code> = 1, sobald <code>CV ≤ 0</code>.</li></ul>
<p>Typisch: „noch 5 Fahrten bis zur Wartung“. Nach der Wartung wird mit LD neu geladen.</p>
<h4>Zähler zurücksetzen</h4>
<p>Ein Zähler ohne R oder LD zählt ewig. Überlege immer, <b>wann</b> er neu beginnen soll.</p>`,
  questions:[
    {type:'single', q:'Was bewirkt LD beim CTD?', options:['CV wird auf PV gesetzt','CV wird 0','Der Zähler zählt hoch'], correct:0,
     explain:'Laden = Startwert setzen.'},
    {type:'single', q:'Wann ist Q des CTD 1?', options:['CV ≤ 0','CV ≥ PV','CV = PV'], correct:0,
     explain:'Der CTD meldet „abgelaufen“.'},
    {type:'single', q:'PV = 5 geladen, 3 Abfahrten. CV?', options:['2','3','5'], correct:0,
     explain:'5 − 3 = 2.'},
    {type:'single', q:'Nach Laden mit PV = 1 folgt eine Abfahrt. Wartung_faellig?', kop:'NETWORK W\nAbfahrt AND CTD(Z_W, PV:=1, LD:=Wartung_OK) => Wartung_faellig;', options:['1','0'], correct:0,
     explain:'CV = 0 → Q = 1.',
     verifyKop:{ src:'NETWORK W\nAbfahrt AND CTD(Z_W, PV:=1, LD:=Wartung_OK) => Wartung_faellig;', vars:{ Abfahrt:false, Wartung_OK:false, Wartung_faellig:false }, steps:[[0,{Wartung_OK:true},{Wartung_faellig:false}],[0.1,{Wartung_OK:false},{}],[0.1,{Abfahrt:true},{Wartung_faellig:true}]] }},
    {type:'single', q:'Welcher Zähler passt zu „Kabine fasst 8 Personen“?', options:['CTU mit PV 8','CTD mit PV 0','TON mit 8 s'], correct:0,
     explain:'Hochzählen bis zur Grenze.'}
  ]});
defTheory({ id:'kt9a', ch:9, pos:'start', title:'Vergleicher', minutes:4,
  lesson:`
<pre class="kop">NETWORK Windwarnung
[Wind_kmh > 60] => Windwarnung;</pre>
<p>Ein <b>Vergleichskontakt</b> vergleicht zwei Zahlen und leitet, wenn der Vergleich stimmt: <code>==</code>, <code>&lt;&gt;</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>.</p>
<h4>Bereiche</h4>
<pre class="kop">NETWORK Gelb
[Wind_kmh >= 40] AND [Wind_kmh <= 60] => Ampel_Gelb;</pre>
<p>Zwei Vergleicher in Reihe prüfen „zwischen“. Achte auf die Grenzen: „ab 60“ = <code>&gt;= 60</code>, „über 60“ = <code>&gt; 60</code>.</p>
<h4>Hysterese</h4>
<p>Mit S bei der oberen und R bei der unteren Schwelle flattert ein Ausgang nicht um einen Grenzwert herum.</p>`,
  questions:[
    {type:'single', q:'Wind_kmh = 60. Windwarnung?', kop:'NETWORK W\n[Wind_kmh > 60] => Windwarnung;', options:['0','1'], correct:0,
     explain:'60 ist nicht grösser als 60.',
     verifyKop:{ src:'NETWORK W\n[Wind_kmh > 60] => Windwarnung;', vars:{ Wind_kmh:60, Windwarnung:true }, tests:[[{}, { Windwarnung:false }]] }},
    {type:'single', q:'„Ab 40 km/h“ als Vergleich?', options:['>= 40','> 40','== 40'], correct:0,
     explain:'„Ab“ schliesst die Grenze ein.'},
    {type:'single', q:'Wie prüfst du „zwischen 40 und 60“?', options:['Zwei Vergleicher in Reihe','Zwei Vergleicher parallel','Ein Vergleicher mit =='], correct:0,
     explain:'≥ 40 UND ≤ 60.'},
    {type:'single', q:'Hysterese: Stopp bei > 60 gesetzt, Wind sinkt auf 50. Wind_Stopp?', kop:'NETWORK S\n[Wind_kmh > 60] => S Wind_Stopp;\n\nNETWORK R\n[Wind_kmh < 40] => R Wind_Stopp;', options:['Bleibt 1','Wird 0'], correct:0,
     explain:'Erst unter 40 wird zurückgesetzt.',
     verifyKop:{ src:'NETWORK S\n[Wind_kmh > 60] => S Wind_Stopp;\n\nNETWORK R\n[Wind_kmh < 40] => R Wind_Stopp;', vars:{ Wind_kmh:0, Wind_Stopp:false }, steps:[[0,{Wind_kmh:65},{Wind_Stopp:true}],[0.1,{Wind_kmh:50},{Wind_Stopp:true}]] }},
    {type:'single', q:'Wozu dient eine Hysterese?', options:['Damit ein Ausgang nicht flattert','Damit schneller geschaltet wird','Um Zahlen zu runden'], correct:0,
     explain:'Zwei Schwellen, dazwischen bleibt der Zustand.'}
  ]});
defTheory({ id:'kt9b', ch:9, pos:'mid', title:'MOVE und Rechenboxen', minutes:4,
  lesson:`
<pre class="kop">NETWORK Langsam
S_Langsam => MOVE(2, Sollwert);</pre>
<p><b>MOVE</b> kopiert den Wert IN nach OUT — aber nur, wenn Strom in die Box fliesst. Ohne Strom bleibt OUT, wie es ist.</p>
<pre class="kop">NETWORK Tagessumme
P(Abfahrt) => ADD(Tagesgaeste, Kabinengaeste, Tagesgaeste);</pre>
<p><b>ADD, SUB, MUL, DIV</b> rechnen <code>OUT := IN1 op IN2</code>. Soll nur einmal pro Ereignis gerechnet werden, braucht es eine <b>Flanke</b> davor.</p>
<p>Ohne Bedingung (<i>immer</i>) rechnet eine Box in jedem Zyklus — praktisch für Umrechnungen wie m/s → km/h. Kommazahlen (REAL) schreibst du mit Punkt: <code>3.6</code>.</p>`,
  questions:[
    {type:'single', q:'Kein Strom in die MOVE-Box. Was passiert mit OUT?', options:['Bleibt unverändert','Wird 0','Wird IN'], correct:0,
     explain:'MOVE wirkt nur bei Stromfluss.'},
    {type:'single', q:'Tagesgaeste = 10, Kabinengaeste = 6, Flanke kommt. Danach?', kop:'NETWORK T\nP(Abfahrt) => ADD(Tagesgaeste, Kabinengaeste, Tagesgaeste);', options:['16','6','10'], correct:0,
     explain:'10 + 6 = 16.',
     verifyKop:{ src:'NETWORK T\nP(Abfahrt) => ADD(Tagesgaeste, Kabinengaeste, Tagesgaeste);', vars:{ Abfahrt:false, Tagesgaeste:10, Kabinengaeste:6 }, steps:[[0,{Abfahrt:true},{Tagesgaeste:16}]] }},
    {type:'single', q:'Was passiert ohne die P-Flanke, solange Abfahrt 1 ist?', options:['Jeder Zyklus addiert erneut','Es wird einmal addiert','Nichts'], correct:0,
     explain:'Ohne Flanke rechnet die Box in jedem Zyklus.'},
    {type:'input', q:'Wie schreibst du die Kommazahl drei Komma sechs im Programm?', answer:['3.6'],
     explain:'Mit Punkt: 3.6'},
    {type:'single', q:'Welche Box für „Sollwert := 5, wenn S_Schnell“?', options:['MOVE','ADD','CTU'], correct:0,
     explain:'Wert übertragen = MOVE.'}
  ]});
defTheory({ id:'kt10a', ch:10, pos:'start', title:'Die Sicherheitskette', minutes:5,
  lesson:`
<p>Alle Bedingungen, ohne die keine Fahrt erlaubt ist, liegen in <b>Reihe</b> — die <b>Sicherheitskette</b>:</p>
<pre class="kop">NETWORK Sicherheitskette
Tuer_Zu AND Seil_OK AND Not_Halt_OK AND Wind_OK => Kette_OK;</pre>
<p>Jedes Glied meldet 1 = in Ordnung (Ruhestromprinzip). <code>Kette_OK</code> liegt als Kontakt in der Freigabe des Antriebs.</p>
<pre class="kop">NETWORK Antrieb
(S_Start OR Antrieb) AND NOT S_Stopp AND Kette_OK => Antrieb;</pre>
<ul><li>Öffnet die Kette, fällt der Antrieb sofort ab.</li>
<li>Schliesst sie wieder, läuft <b>nichts</b> von selbst an.</li>
<li>Unterbrechungen werden gespeichert und quittiert.</li>
<li>Eine Kette wird <b>nie gebrückt</b>.</li></ul>`,
  questions:[
    {type:'single', q:'Wie sind die Glieder einer Sicherheitskette verschaltet?', options:['In Reihe','Parallel','Gemischt, je nach Anlage'], correct:0,
     explain:'Jedes Glied allein muss die Fahrt verhindern können.'},
    {type:'single', q:'Die Kette öffnet und schliesst wieder. Antrieb?', kop:'NETWORK Antrieb\n(S_Start OR Antrieb) AND NOT S_Stopp AND Kette_OK => Antrieb;', options:['Bleibt 0 bis zum nächsten Start','Läuft wieder an'], correct:0,
     explain:'Die Selbsthaltung ist abgebrochen.',
     verifyKop:{ src:'NETWORK A\n(S_Start OR Antrieb) AND NOT S_Stopp AND Kette_OK => Antrieb;', vars:{ S_Start:false, S_Stopp:false, Kette_OK:true, Antrieb:true }, steps:[[0,{Kette_OK:false},{Antrieb:false}],[0.1,{Kette_OK:true},{Antrieb:false}]] }},
    {type:'single', q:'Ein Techniker will einen Parallelkontakt „Revision“ um den Türkontakt legen. Richtig?', options:['Nein — eine Kette wird nie gebrückt','Ja, das ist üblich','Ja, wenn er gut beschriftet ist'], correct:0,
     explain:'Revision braucht eine eigene, abgesicherte Betriebsart.'},
    {type:'multi', q:'Was gehört in die Sicherheitskette einer Seilbahn? (alle richtigen)', options:['Türen geschlossen','Seil in der Rolle','Not-Halt frei','Beleuchtung an'], correct:[0,1,2],
     explain:'Die Beleuchtung ist keine Sicherheitsbedingung.'},
    {type:'single', q:'Warum wird eine kurze Kettenunterbrechung gespeichert?', options:['Damit auch ein Wackelkontakt bemerkt und untersucht wird','Damit die Bahn schneller fährt','Das ist nicht nötig'], correct:0,
     explain:'Kurze Unterbrechungen sind Warnzeichen.'}
  ]});
defTheory({ id:'kt10b', ch:10, pos:'mid', title:'Schrittketten', minutes:5,
  lesson:`
<p>Ein Ablauf (Einsteigen → Warnen → Fahrt) wird als <b>Schrittkette</b> gebaut. Jeder Schritt ist ein Merker; immer ist <b>genau einer</b> aktiv.</p>
<pre class="kop">NETWORK Grundstellung
NOT Schritt_Einsteigen AND NOT Schritt_Fahrt => S Schritt_Einsteigen;

NETWORK Weiter
Schritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt, R Schritt_Einsteigen;</pre>
<ul><li><b>Übergang</b>: aktueller Schritt UND Bedingung → S nächster, R aktueller Schritt.</li>
<li><b>Grundstellung</b>: Ist kein Schritt aktiv, wird der erste gesetzt.</li>
<li><b>Befehlsausgabe</b>: nach den Übergängen, jeder Ausgang genau einmal.</li>
<li><b>Schrittzeit</b>: Schrittmerker → TON → Übergang.</li></ul>`,
  questions:[
    {type:'single', q:'Wie viele Schritte sind in einer Schrittkette gleichzeitig aktiv?', options:['Genau einer','Beliebig viele','Keiner'], correct:0,
     explain:'Eine Kette ist immer in genau einem Schritt.'},
    {type:'single', q:'Was fehlt, wenn nach dem Übergang zwei Schritte aktiv sind?', options:['Das R des alten Schritts','Das S des neuen Schritts','Die Grundstellung'], correct:0,
     explain:'Der alte Schritt muss gelöscht werden.'},
    {type:'single', q:'Schritt_Einsteigen = 1, S_Abfahrt = 1. Danach?', kop:'NETWORK Weiter\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt, R Schritt_Einsteigen;', options:['Fahrt = 1, Einsteigen = 0','Beide 1','Beide 0'], correct:0,
     explain:'Der Übergang schaltet weiter.',
     verifyKop:{ src:'NETWORK W\nSchritt_Einsteigen AND S_Abfahrt => S Schritt_Fahrt, R Schritt_Einsteigen;', vars:{ Schritt_Einsteigen:true, S_Abfahrt:true, Schritt_Fahrt:false }, tests:[[{}, { Schritt_Fahrt:true, Schritt_Einsteigen:false }]] }},
    {type:'single', q:'Ampel_Rot soll in den Schritten Einsteigen und Warnen leuchten. Wie?', options:['Ein Netzwerk: beide Schritte parallel → Ampel_Rot','Zwei Netzwerke mit je einer Spule Ampel_Rot','Mit einem Zähler'], correct:0,
     explain:'Jede Spule genau einmal — sonst Doppelspule.'},
    {type:'single', q:'Wie lässt man einen Schritt nach 3 s automatisch weiterschalten?', options:['Schrittmerker → TON 3 s → Übergang','TOF im nächsten Schritt','Gar nicht, nur mit Taster'], correct:0,
     explain:'Die Schrittzeit startet mit dem Schritt und setzt sich beim Verlassen zurück.'}
  ]});
})();
