/* ===== FUP QUEST: Theorie-Aufträge (Kapitel 1–10) =====
   <pre class="kop">…</pre> wird als Funktionsplan dargestellt; q.kop in Fragen ebenso.
   verifyKop: { src, vars, tests|steps } — der Validator prüft die Aussage mit der Engine. */
(function(){
const V = (src, vars, tests) => ({ src, vars, tests });
const VS = (src, vars, steps) => ({ src, vars, steps });

defTheory({ id:'ft1a', ch:1, pos:'start', title:'Der Funktionsplan', minutes:4,
  lesson:`
<p>Der <b>Funktionsplan (FUP)</b> zeichnet ein Programm wie eine elektronische Schaltung: <b>Boxen</b> verknüpfen Signale, die von <b>links</b> hereinkommen, rechts steht das Ergebnis.</p>
<pre class="kop">NETWORK Signal A
Taste_A AND Gleis1_frei => Signal_A;</pre>
<ul><li>An den Eingängen stehen die <b>Operanden</b> (Variablen).</li>
<li>Die <b>&amp;-Box</b> (UND) liefert 1, wenn alle Eingänge 1 sind.</li>
<li>Rechts die <b>Zuweisung</b> <code>=</code>: Der Ausgang übernimmt das Ergebnis — in jedem Zyklus neu.</li></ul>
<h4>Signalzustände</h4>
<p>Beim Testen zeigt jede Leitung ihren Wert: <span style="color:#39ff14">grün = 1</span>, grau = 0. So siehst du, wo ein Signal hängen bleibt.</p>`,
  questions:[
    {type:'single', q:'Wann liefert eine &-Box am Ausgang 1?', options:['Wenn alle Eingänge 1 sind','Wenn mindestens ein Eingang 1 ist','Immer'], correct:0,
     explain:'& = UND: Jeder Eingang muss 1 sein.'},
    {type:'single', q:'<code>Taste_A</code> = 1, <code>Gleis1_frei</code> = 0. Was ist <code>Signal_A</code>?', kop:'NETWORK Signal A\nTaste_A AND Gleis1_frei => Signal_A;', options:['0','1'], correct:0,
     explain:'Ein Eingang ist 0 — die &-Box liefert 0.',
     verifyKop: V('NETWORK S\nTaste_A AND Gleis1_frei => Signal_A;', { Taste_A:true, Gleis1_frei:false, Signal_A:true }, [[{}, { Signal_A:false }]]) },
    {type:'single', q:'Wo steht im Funktionsplan das Ergebnis?', options:['Rechts in der Zuweisung','Links am Eingang','Über dem Netzwerk'], correct:0,
     explain:'Signale fliessen von links nach rechts.'},
    {type:'single', q:'Was zeigt eine grüne Leitung beim Testlauf?', options:['Das Signal ist in diesem Zyklus 1','Hier ist ein Fehler','Der Eingang ist negiert'], correct:0,
     explain:'Grün = 1, grau = 0.'},
    {type:'single', q:'Wie oft rechnet die SPS ein Netzwerk?', options:['In jedem Zyklus neu','Nur wenn sich ein Eingang ändert','Einmal beim Einschalten'], correct:0,
     explain:'Zyklisch: Eingänge lesen, Netzwerke rechnen, Ausgänge schreiben — immer wieder.'}
  ]});

defTheory({ id:'ft1b', ch:1, pos:'mid', title:'Boxen, Eingänge, Netzwerke', minutes:4,
  lesson:`
<p>Eine &amp;-Box kann <b>beliebig viele Eingänge</b> haben. Einen Eingang hinzufügen: <code>-|</code> auf die Box ziehen oder den <code>*</code> unten an der Box anklicken.</p>
<pre class="kop">NETWORK Signal A
Taste_A AND Gleis1_frei AND W1_Endlage => Signal_A, Melder_Gruen;</pre>
<p>Ein Ergebnis darf auf <b>mehrere Zuweisungen</b> gehen (Abzweig <code>↦</code>): Signal und Melder bekommen denselben Wert.</p>
<h4>Netzwerke</h4>
<p>Jedes Netzwerk löst eine Aufgabe und hat einen Titel. Die SPS rechnet sie von oben nach unten.</p>
<h4>Ziehen + verbinden</h4>
<p>Boxen aus der Leiste oder aus <b>☰ Anweisungen</b> lassen sich direkt auf einen Eingang ziehen, Variablen aus den PLC-Variablen auf einen roten Operanden <code>&lt;??.?&gt;</code>.</p>`,
  questions:[
    {type:'single', q:'Wie viele Eingänge darf eine &-Box haben?', options:['Beliebig viele (mindestens zwei)','Genau zwei','Höchstens drei'], correct:0,
     explain:'Man erweitert die Box statt Boxen aneinanderzuhängen.'},
    {type:'single', q:'Drei Eingänge an einer &-Box: 1, 1, 0. Ergebnis?', kop:'NETWORK X\nA AND B AND C => Q;', options:['0','1'], correct:0,
     explain:'Einer ist 0 — also 0.',
     verifyKop: V('NETWORK X\nA AND B AND C => Q;', { A:true, B:true, C:false, Q:true }, [[{}, { Q:false }]]) },
    {type:'single', q:'Eine Box hat zwei Zuweisungen am Ausgang. Was bekommen sie?', options:['Beide denselben Wert','Abwechselnd den Wert','Nur die obere bekommt ihn'], correct:0,
     explain:'Die Leitung verzweigt sich einfach.'},
    {type:'single', q:'Warum schreibt man jedes Signal in ein eigenes Netzwerk?', options:['Übersicht: ein Netzwerk pro Aufgabe','Weil ein Netzwerk nur eine Box haben darf','Damit die SPS schneller ist'], correct:0,
     explain:'Klare Netzwerke mit Titel sind leichter zu prüfen.'},
    {type:'multi', q:'Welche Bedingungen gehören vor ein Einfahrsignal? (alle richtigen)', options:['Zielgleis frei','Weiche in der Endlage','Taste bzw. Anforderung','Uhrzeit'], correct:[0,1,2],
     explain:'Die Uhrzeit hat mit der Sicherheit nichts zu tun.'}
  ]});

defTheory({ id:'ft2a', ch:2, pos:'start', title:'ODER und Negation', minutes:4,
  lesson:`
<p>Die <b>&gt;=1-Box</b> (ODER) liefert 1, wenn <b>mindestens ein</b> Eingang 1 ist.</p>
<pre class="kop">NETWORK Sammelmeldung
Stoerung OR Not_Aus => Melder_Rot;</pre>
<p>Ein <b>negierter Eingang</b> (kleiner Kreis) kehrt das Signal um: aus 1 wird 0.</p>
<pre class="kop">NETWORK Gleis frei
NOT Gleis1_besetzt => Gleis1_frei;</pre>
<p>Negierte Eingänge an einer &amp;-Box wirken als <b>Sperren</b>.</p>`,
  questions:[
    {type:'single', q:'Wann liefert eine >=1-Box 1?', options:['Wenn mindestens ein Eingang 1 ist','Nur wenn alle 1 sind','Wenn genau einer 1 ist'], correct:0,
     explain:'>=1 bedeutet: mindestens einer.'},
    {type:'single', q:'<code>Gleis1_besetzt</code> = 1. Was ist <code>Gleis1_frei</code>?', kop:'NETWORK G\nNOT Gleis1_besetzt => Gleis1_frei;', options:['0','1'], correct:0,
     explain:'Der Kreis kehrt 1 in 0 um.',
     verifyKop: V('NETWORK G\nNOT Gleis1_besetzt => Gleis1_frei;', { Gleis1_besetzt:true, Gleis1_frei:true }, [[{}, { Gleis1_frei:false }]]) },
    {type:'single', q:'Was bewirkt ein negierter Eingang an einer &-Box?', options:['Er sperrt, solange sein Signal 1 ist','Er gibt frei, solange sein Signal 1 ist','Nichts'], correct:0,
     explain:'Negiert: 1 am Eingang → 0 in der Box → Ausgang 0.'},
    {type:'single', q:'<code>Taste_A</code> = 1, <code>Stoerung</code> = 1. Signal?', kop:'NETWORK S\nTaste_A AND NOT Stoerung => Signal_A;', options:['0','1'], correct:0,
     explain:'Die Störung sperrt.',
     verifyKop: V('NETWORK S\nTaste_A AND NOT Stoerung => Signal_A;', { Taste_A:true, Stoerung:true, Signal_A:true }, [[{}, { Signal_A:false }]]) },
    {type:'single', q:'Welche Box sammelt mehrere Störungen zu einer Lampe?', options:['>=1','&','X'], correct:0,
     explain:'Irgendeine Störung → Lampe an.'}
  ]});

defTheory({ id:'ft2b', ch:2, pos:'mid', title:'XOR und verschachtelte Boxen', minutes:5,
  lesson:`
<p>Die <b>X-Box</b> (exklusives ODER) liefert 1, wenn <b>genau einer</b> von zwei Eingängen 1 ist.</p>
<pre class="kop">NETWORK Weichenlage
W1_links XOR W1_rechts => W1_Lage_OK;</pre>
<p>Ideal für <b>Endlagen</b>: Beide oder keine gemeldet bedeutet Fehler.</p>
<h4>Verschachteln</h4>
<pre class="kop">NETWORK Freigabe
(Taste_Stelltisch OR Taste_Ort) AND Weichengleis_frei => W1_Freigabe;</pre>
<p>Eine Box liefert ihr Ergebnis an den Eingang einer anderen — wie Klammern in einer Rechnung.</p>
<p>Auch die <b>Zuweisung</b> kann negiert werden (Kreis an ihrem Eingang, <code>-o|</code>): Sie schreibt das Gegenteil.</p>`,
  questions:[
    {type:'single', q:'W1_links = 1, W1_rechts = 1. Was liefert die X-Box?', kop:'NETWORK L\nW1_links XOR W1_rechts => W1_Lage_OK;', options:['0','1'], correct:0,
     explain:'Beide gleich → 0: Die Lage ist ungültig.',
     verifyKop: V('NETWORK L\nW1_links XOR W1_rechts => W1_Lage_OK;', { W1_links:true, W1_rechts:true, W1_Lage_OK:true }, [[{}, { W1_Lage_OK:false }]]) },
    {type:'single', q:'Was entspricht „(A ODER B) UND C“ im FUP?', options:['>=1-Box an einem Eingang einer &-Box','&-Box an einem Eingang einer >=1-Box','Zwei getrennte Netzwerke'], correct:0,
     explain:'Die innere Box ist die Klammer.'},
    {type:'single', q:'Taste_Ort = 1, Taste_Stelltisch = 0, Weichengleis_frei = 1. Freigabe?', kop:'NETWORK F\n(Taste_Stelltisch OR Taste_Ort) AND Weichengleis_frei => W1_Freigabe;', options:['1','0'], correct:0,
     explain:'Die ODER-Box liefert 1, das Gleis ist frei.',
     verifyKop: V('NETWORK F\n(Taste_Stelltisch OR Taste_Ort) AND Weichengleis_frei => W1_Freigabe;', { Taste_Stelltisch:false, Taste_Ort:true, Weichengleis_frei:true, W1_Freigabe:false }, [[{}, { W1_Freigabe:true }]]) },
    {type:'single', q:'Was schreibt eine negierte Zuweisung, wenn 1 ankommt?', options:['0','1'], correct:0,
     explain:'Das Gegenteil.'},
    {type:'single', q:'Wofür eignet sich die X-Box im Stellwerk besonders?', options:['Widersprüchliche Rückmeldungen (Endlagen) erkennen','Züge zählen','Zeiten messen'], correct:0,
     explain:'Genau eine von zwei Endlagen muss melden.'}
  ]});

defTheory({ id:'ft3a', ch:3, pos:'start', title:'Selbsthaltung', minutes:5,
  lesson:`
<p>Ein kurzer Tastendruck soll einen Vorgang starten, der länger dauert. Der Ausgang wird in die &gt;=1-Box <b>zurückgeführt</b> und hält sich selbst:</p>
<pre class="kop">NETWORK Weiche nach rechts
(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts => W1_nach_rechts;</pre>
<p>Die Abschaltbedingung liegt <b>hinter</b> der ODER-Box (negierter Eingang an der &amp;-Box) — sie gewinnt immer: <b>Aus-Vorrang</b>.</p>
<p>Liegt sie nur im Haltezweig, gewinnt das Einschalten (<b>Ein-Vorrang</b>) — nur für Warnungen sinnvoll.</p>`,
  questions:[
    {type:'single', q:'Wozu dient der zurückgeführte Ausgang in der >=1-Box?', options:['Er hält den Ausgang, nachdem die Taste losgelassen wurde','Er schaltet ab','Er zählt Tastendrücke'], correct:0,
     explain:'Das ist die Selbsthaltung.'},
    {type:'single', q:'Die Weiche läuft (1), die Taste ist losgelassen, keine Endlage. Nächster Zyklus?', kop:'NETWORK W\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts => W1_nach_rechts;', options:['Läuft weiter (1)','Stoppt (0)'], correct:0,
     explain:'Der Haltezweig leitet.',
     verifyKop: V('NETWORK W\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts => W1_nach_rechts;', { Taste_Rechts:false, W1_Endlage_rechts:false, W1_nach_rechts:true }, [[{}, { W1_nach_rechts:true }]]) },
    {type:'single', q:'Fahrt- und Halttaste gleichzeitig: Was soll ein Signal zeigen?', options:['Halt (Aus-Vorrang)','Fahrt (Ein-Vorrang)'], correct:0,
     explain:'Bei Signalen gewinnt immer Halt.'},
    {type:'single', q:'Wo liegt die Abschaltbedingung beim Aus-Vorrang?', options:['Hinter der >=1-Box, als negierter Eingang der &-Box','Als weiterer Eingang der >=1-Box','Gar nicht'], correct:0,
     explain:'So unterbricht sie beide Zweige.'},
    {type:'single', q:'Ein Signal hält sich selbst, bis das Gleis besetzt wird. Was passiert beim Einfahren des Zugs?', options:['Es fällt auf Halt und muss neu gestellt werden','Es bleibt auf Fahrt','Es blinkt'], correct:0,
     explain:'Die Abschaltbedingung unterbricht die Haltung.'}
  ]});

defTheory({ id:'ft3b', ch:3, pos:'mid', title:'Verriegelung', minutes:4,
  lesson:`
<p>Ein Antrieb mit zwei Richtungen (Weiche, Schranke) darf nie in beide gleichzeitig laufen. Jede Richtung bekommt den <b>negierten Ausgang der Gegenrichtung</b>:</p>
<pre class="kop">NETWORK Weiche nach links
(Taste_Links OR W1_nach_links) AND NOT W1_Endlage_links AND NOT W1_nach_rechts => W1_nach_links;

NETWORK Weiche nach rechts
(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;</pre>
<p>Die Verriegelung muss <b>auf beiden Seiten</b> stehen. Ein Signal über eine laufende Weiche fällt auf Halt (einfacher Weichenverschluss).</p>`,
  questions:[
    {type:'single', q:'W1 läuft nach links. Jemand drückt „rechts“. Was passiert?', kop:'NETWORK R\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;', options:['Nichts — rechts ist gesperrt','Die Weiche läuft nach rechts'], correct:0,
     explain:'Der negierte Eingang W1_nach_links sperrt.',
     verifyKop: V('NETWORK R\n(Taste_Rechts OR W1_nach_rechts) AND NOT W1_Endlage_rechts AND NOT W1_nach_links => W1_nach_rechts;', { Taste_Rechts:true, W1_Endlage_rechts:false, W1_nach_links:true, W1_nach_rechts:false }, [[{}, { W1_nach_rechts:false }]]) },
    {type:'single', q:'Die Verriegelung fehlt nur auf einer Seite. Genügt das?', options:['Nein, sie muss auf beiden Seiten stehen','Ja, eine Seite reicht'], correct:0,
     explain:'Sonst kann die ungesperrte Richtung jederzeit zuschalten.'},
    {type:'single', q:'Wie wechselt man die Richtung einer verriegelten Weiche?', options:['Erst bis zur Endlage laufen lassen (oder stoppen), dann umkehren','Beide Tasten gleichzeitig drücken','Gar nicht'], correct:0,
     explain:'Die Verriegelung erzwingt den Halt dazwischen.'},
    {type:'single', q:'Warum soll ein Signal über eine laufende Weiche Halt zeigen?', options:['Eine Weiche in Bewegung ist nicht befahrbar','Weil das Signal sonst flackert','Das ist egal'], correct:0,
     explain:'Einfachste Form des Weichenverschlusses.'},
    {type:'multi', q:'Wo braucht man eine Verriegelung? (alle richtigen)', options:['Weichenantrieb links/rechts','Schranke heben/senken','Zwei Signale auf derselben Strecke','Blinklicht'], correct:[0,1,2],
     explain:'Überall, wo zwei Befehle sich widersprechen.'}
  ]});

defTheory({ id:'ft4a', ch:4, pos:'start', title:'Speicherboxen S und R', minutes:4,
  lesson:`
<p>Die <b>S-Box</b> setzt ihren Operanden auf 1, wenn am Eingang 1 ankommt — sonst bleibt er, wie er ist. Die <b>R-Box</b> setzt auf 0.</p>
<pre class="kop">NETWORK Fahrstrasse einstellen
Taste_FS => S FS_eingestellt;

NETWORK Fahrstrasse aufloesen
Aufloesung => R FS_eingestellt;</pre>
<p>Wirken S und R im selben Zyklus, gewinnt das <b>untere</b> Netzwerk.</p>
<p>Die <b>negierte Zuweisung</b> (Kreis am Eingang der Zuweisung) schreibt immer das Gegenteil — praktisch für Gegenmelder.</p>`,
  questions:[
    {type:'single', q:'Was macht eine S-Box, wenn am Eingang 0 ankommt?', options:['Nichts — der Wert bleibt','Sie setzt auf 0','Sie setzt auf 1'], correct:0,
     explain:'Das ist der Unterschied zur Zuweisung.'},
    {type:'single', q:'Taste_FS war kurz 1, jetzt 0. FS_eingestellt?', kop:'NETWORK F\nTaste_FS => S FS_eingestellt;', options:['Bleibt 1','Wird 0'], correct:0,
     explain:'Gesetzt ist gesetzt.',
     verifyKop: VS('NETWORK F\nTaste_FS => S FS_eingestellt;', { Taste_FS:false, FS_eingestellt:false }, [[0, { Taste_FS:true }, { FS_eingestellt:true }], [0.1, { Taste_FS:false }, { FS_eingestellt:true }]]) },
    {type:'single', q:'S oben, R unten, beide bekommen 1. Ergebnis?', options:['0 — das untere Netzwerk gewinnt','1','Zufall'], correct:0,
     explain:'R schreibt zuletzt.',
     verifyKop: V('NETWORK A\nX => S Q;\n\nNETWORK B\nX => R Q;', { X:true, Q:false }, [[{}, { Q:false }]]) },
    {type:'single', q:'Signal_A = 1. Was schreibt die negierte Zuweisung „Signal_A → Melder_Rot“?', options:['0','1'], correct:0,
     explain:'Das Gegenteil.',
     verifyKop: V('NETWORK H\nSignal_A => NOT Melder_Rot;', { Signal_A:true, Melder_Rot:true }, [[{}, { Melder_Rot:false }]]) },
    {type:'single', q:'Warum speichert man eine Fahrstrasse?', options:['Die Taste wird nur kurz gedrückt, die Fahrstrasse muss bestehen bleiben','Damit sie schneller ist','Das ist nicht nötig'], correct:0,
     explain:'Sie bleibt, bis sie aufgelöst wird.'}
  ]});

defTheory({ id:'ft4b', ch:4, pos:'mid', title:'Flipflops SR und RS', minutes:5,
  lesson:`
<p>Das <b>SR-Flipflop</b> fasst Setzen und Rücksetzen in einer Box zusammen: Der Eingang von links setzt, der Operand am Eingang <b>R</b> setzt zurück.</p>
<pre class="kop">NETWORK Fahrstrasse
Taste_FS => SR(FS_eingestellt, Aufloesung);</pre>
<table><tr><th>Box</th><th>S und R gleichzeitig</th><th>typisch für</th></tr>
<tr><td>SR</td><td>0 (Rücksetzen gewinnt)</td><td>Fahrstrassen, Freigaben</td></tr>
<tr><td>RS</td><td>1 (Setzen gewinnt)</td><td>Störungen (Fehler steht noch an)</td></tr></table>`,
  questions:[
    {type:'single', q:'SR-Flipflop, Setzen und Rücksetzen gleichzeitig 1. Ausgang?', kop:'NETWORK F\nS1 => SR(Q1, R1);', options:['0','1'], correct:0,
     explain:'Beim SR gewinnt Rücksetzen.',
     verifyKop: V('NETWORK F\nS1 => SR(Q1, R1);', { S1:true, R1:true, Q1:true }, [[{}, { Q1:false }]]) },
    {type:'single', q:'RS-Flipflop, Setzen und Rücksetzen gleichzeitig 1. Ausgang?', kop:'NETWORK F\nS1 => RS(Q1, R1);', options:['1','0'], correct:0,
     explain:'Beim RS gewinnt Setzen.',
     verifyKop: V('NETWORK F\nS1 => RS(Q1, R1);', { S1:true, R1:true, Q1:false }, [[{}, { Q1:true }]]) },
    {type:'single', q:'Welches Flipflop für eine Störung, die nicht wegquittiert werden darf, solange der Fehler ansteht?', options:['RS','SR'], correct:0,
     explain:'Der anstehende Fehler (Setzen) muss gewinnen.'},
    {type:'single', q:'Welches Flipflop für eine Fahrstrasse?', options:['SR — im Zweifel aufgelöst','RS — im Zweifel eingestellt'], correct:0,
     explain:'Sicher ist: aufgelöst.'},
    {type:'single', q:'Was steht am Eingang R eines SR-Flipflops?', options:['Die Bedingung zum Rücksetzen','Der Ausgang','Die Zeit'], correct:0,
     explain:'Links setzt, R setzt zurück.'}
  ]});

defTheory({ id:'ft5a', ch:5, pos:'start', title:'Flanken', minutes:5,
  lesson:`
<p>Eine Achse liegt viele Zyklen lang auf dem Zählpunkt. Soll pro Achse nur <b>einmal</b> gezählt werden, braucht es eine <b>Flanke</b>:</p>
<pre class="kop">NETWORK Achsen zaehlen
P(Achse) => INC(Achsen);</pre>
<ul><li><b>P-Box</b>: genau ein Zyklus 1 beim Wechsel 0 → 1 (Beginn).</li>
<li><b>N-Box</b>: genau ein Zyklus 1 beim Wechsel 1 → 0 (Ende).</li></ul>
<p>Die Flanke merkt sich intern den Zustand des letzten Zyklus.</p>`,
  questions:[
    {type:'single', q:'Wie lange liefert eine P-Box 1?', options:['Genau einen Zyklus','Solange der Operand 1 ist','Eine Sekunde'], correct:0,
     explain:'Nur im Zyklus des Wechsels.'},
    {type:'single', q:'Die Achse steht 3 Zyklen auf dem Zählpunkt. Zähler?', kop:'NETWORK Z\nP(Achse) => INC(Achsen);', options:['+1','+3','0'], correct:0,
     explain:'Nur die steigende Flanke zählt.',
     verifyKop: VS('NETWORK Z\nP(Achse) => INC(Achsen);', { Achse:false, Achsen:0 }, [[0, { Achse:true }, {}], [0.1, {}, {}], [0.1, {}, { Achsen:1 }]]) },
    {type:'single', q:'Welche Flanke meldet „der letzte Wagen hat den Kontakt verlassen“?', options:['N','P'], correct:0,
     explain:'Ende = 1 → 0.'},
    {type:'single', q:'Und ohne Flanke (<code>Achse → INC</code>) bei 3 Zyklen?', options:['+3','+1'], correct:0,
     explain:'Ohne Flanke zählt jeder Zyklus.',
     verifyKop: VS('NETWORK Z\nAchse => INC(Achsen);', { Achse:false, Achsen:0 }, [[0, { Achse:true }, {}], [0.1, {}, {}], [0.1, {}, { Achsen:3 }]]) },
    {type:'single', q:'Was unterscheidet einen Zustand von einem Ereignis?', options:['Zustand dauert an (besetzt), Ereignis ist ein Wechsel (wird besetzt)','Nichts','Ereignisse sind immer 0'], correct:0,
     explain:'Flanken machen aus Zuständen Ereignisse.'}
  ]});

defTheory({ id:'ft5b', ch:5, pos:'mid', title:'Stromstoss und Flankenmerker', minutes:4,
  lesson:`
<p>Eine Taste, die bei jedem Druck umschaltet: Flanke in einen <b>Merker</b>, dann XOR mit dem eigenen Ausgang.</p>
<pre class="kop">NETWORK Flanke
P(Taste_W1) => Impuls;

NETWORK Umschalten
Impuls XOR W1_rechts => W1_rechts;</pre>
<p>Ohne Flanke kippt der Ausgang in <b>jedem</b> Zyklus, solange die Taste gedrückt ist. Eine P-Box an einer Quittiertaste verhindert, dass eine festgehaltene Taste jede neue Störung sofort quittiert.</p>`,
  questions:[
    {type:'single', q:'Impuls = 1, W1_rechts = 1. Ergebnis der Umschaltung?', kop:'NETWORK U\nImpuls XOR W1_rechts => W1_rechts;', options:['0','1'], correct:0,
     explain:'1 XOR 1 = 0 — die Weiche kippt.',
     verifyKop: V('NETWORK U\nImpuls XOR W1_rechts => W1_rechts;', { Impuls:true, W1_rechts:true }, [[{}, { W1_rechts:false }]]) },
    {type:'single', q:'Impuls = 0. Was passiert mit W1_rechts?', options:['Bleibt, wie es ist','Wird 0','Wird 1'], correct:0,
     explain:'0 XOR x = x.'},
    {type:'single', q:'Warum eine Flanke an der Quittiertaste?', options:['Eine festgehaltene Taste soll nicht jede neue Störung quittieren','Damit die Taste länger hält','Das ist unnötig'], correct:0,
     explain:'Quittieren nur im Moment des Drückens.'},
    {type:'single', q:'Was passiert beim Stromstoss ohne Flanke, wenn die Taste gehalten wird?', options:['Die Weiche kippt in jedem Zyklus','Die Weiche bleibt','Die Weiche kippt einmal'], correct:0,
     explain:'Sie „zappelt“.'},
    {type:'single', q:'Wie oft sollte P(Taste_W1) im Programm stehen?', options:['Einmal','Beliebig oft'], correct:0,
     explain:'Jede Flanke hat ihr eigenes Gedächtnis — das Ergebnis im Merker darf man mehrfach verwenden.'}
  ]});

defTheory({ id:'ft6a', ch:6, pos:'start', title:'Einschaltverzögerung TON', minutes:5,
  lesson:`
<p>Zeitboxen haben einen Eingang <b>IN</b> (das Signal von links), eine Zeit <b>PT</b> und eine eigene <b>Instanz</b>.</p>
<pre class="kop">NETWORK Schranke schliessen
Zug_meldet AND TON(T_Vorlauf, T#3S) => Schranke_zu;</pre>
<p>Die <b>TON-Box</b> gibt ihren Ausgang erst frei, wenn IN <b>PT lang ununterbrochen</b> 1 ist. Fällt IN weg, ist der Ausgang sofort 0 und die Zeit beginnt beim nächsten Mal von vorn.</p>
<p>Zeiten: <code>T#3S</code>, <code>T#500MS</code>, <code>T#1M30S</code>.</p>`,
  questions:[
    {type:'single', q:'Zug meldet seit 2 s, PT = 3 s. Schranke_zu?', kop:'NETWORK S\nZug_meldet AND TON(T_Vorlauf, T#3S) => Schranke_zu;', options:['0','1'], correct:0,
     explain:'Die Zeit ist noch nicht abgelaufen.',
     verifyKop: VS('NETWORK S\nZug_meldet AND TON(T_Vorlauf, T#3S) => Schranke_zu;', { Zug_meldet:false, Schranke_zu:false }, [[0, { Zug_meldet:true }, {}], [2, {}, { Schranke_zu:false }]]) },
    {type:'single', q:'IN fällt nach 2,5 s kurz weg und kommt wieder. Was passiert?', options:['Die Zeit beginnt von vorn','Die Zeit läuft weiter'], correct:0,
     explain:'TON verlangt ununterbrochenes Anstehen.'},
    {type:'input', q:'Wie schreibst du 3 Sekunden als Zeitkonstante?', answer:['T#3S','T#3s','t#3s'],
     explain:'T#3S'},
    {type:'single', q:'Zwei verschiedene Zeiten im Programm. Wie viele Timer-Instanzen?', options:['Zwei','Eine'], correct:0,
     explain:'Jede Instanz misst genau eine Zeit.'},
    {type:'single', q:'Der Ausgang der TON-Box ist 1. IN fällt weg. Ausgang?', options:['Sofort 0','Nach PT 0'], correct:0,
     explain:'TON verzögert nur das Einschalten.'}
  ]});

defTheory({ id:'ft6b', ch:6, pos:'mid', title:'TOF und TP', minutes:5,
  lesson:`
<pre class="kop">NETWORK Schranke nachlaufen
Zug_im_BUE AND TOF(T_Nachlauf, T#2S) => Schranke_zu;</pre>
<p><b>TOF</b>: Ausgang sofort 1, bleibt nach dem Wegfall von IN noch PT lang 1.</p>
<pre class="kop">NETWORK Glocke
Zug_meldet AND TP(T_Glocke, T#2S) => Glocke;</pre>
<p><b>TP</b>: Die steigende Flanke an IN startet einen Impuls von genau PT — egal wie lange IN ansteht.</p>
<table><tr><th>Box</th><th>Ausgang ein</th><th>Ausgang aus</th></tr>
<tr><td>TON</td><td>PT nach IN ↑</td><td>sofort</td></tr><tr><td>TOF</td><td>sofort</td><td>PT nach IN ↓</td></tr><tr><td>TP</td><td>sofort</td><td>genau PT später</td></tr></table>`,
  questions:[
    {type:'single', q:'Zug hat den Übergang vor 1 s verlassen, TOF 2 s. Schranke_zu?', kop:'NETWORK S\nZug_im_BUE AND TOF(T_Nachlauf, T#2S) => Schranke_zu;', options:['1','0'], correct:0,
     explain:'Nachlaufzeit noch nicht vorbei.',
     verifyKop: VS('NETWORK S\nZug_im_BUE AND TOF(T_Nachlauf, T#2S) => Schranke_zu;', { Zug_im_BUE:false, Schranke_zu:false }, [[0, { Zug_im_BUE:true }, {}], [0.1, { Zug_im_BUE:false }, {}], [1, {}, { Schranke_zu:true }]]) },
    {type:'single', q:'Welche Box für „Glocke genau 2 s, auch wenn der Zug länger meldet“?', options:['TP','TON','TOF'], correct:0,
     explain:'Fester Impuls.'},
    {type:'single', q:'Welche Box für „Schranke bleibt nach dem Zug noch 2 s unten“?', options:['TOF','TON','TP'], correct:0,
     explain:'Ausschalten verzögern.'},
    {type:'single', q:'TP 2 s, Zug meldet seit 5 s. Glocke?', options:['0','1'], correct:0,
     explain:'Der Impuls ist nach 2 s vorbei.',
     verifyKop: VS('NETWORK G\nZug_meldet AND TP(T_Glocke, T#2S) => Glocke;', { Zug_meldet:false, Glocke:false }, [[0, { Zug_meldet:true }, { Glocke:true }], [5, {}, { Glocke:false }]]) },
    {type:'single', q:'Womit wählst du im Editor den Typ einer Zeitbox?', options:['Rechtsklick auf die Box → „Boxtyp ändern …“','Neue Instanz anlegen','Gar nicht'], correct:0,
     explain:'TON, TOF und TP haben dieselben Anschlüsse — der Typ lässt sich direkt an der Box wechseln.'}
  ]});

defTheory({ id:'ft7a', ch:7, pos:'start', title:'Taktgeber und Blinker', minutes:4,
  lesson:`
<p>Ein <b>Taktmerker</b> wechselt regelmässig zwischen 0 und 1. In einer &amp;-Box mit einer Bedingung wird daraus ein Blinklicht.</p>
<pre class="kop">NETWORK Takt
NOT Impuls AND TON(T_Takt, T#500MS) => Impuls;

NETWORK Umschalten
Impuls XOR Blink => Blink;</pre>
<p>Der negierte eigene Ausgang startet den Timer nach jedem Impuls neu; die XOR-Rückführung kippt bei jedem Impuls. Ein Signal und sein negiertes Gegenstück ergeben einen <b>Wechselblinker</b>.</p>`,
  questions:[
    {type:'single', q:'Zug_meldet = 1, Takt = 0. Blinklicht?', kop:'NETWORK B\nZug_meldet AND Takt_1Hz => Blinklicht;', options:['0','1'], correct:0,
     explain:'Beide müssen 1 sein.',
     verifyKop: V('NETWORK B\nZug_meldet AND Takt_1Hz => Blinklicht;', { Zug_meldet:true, Takt_1Hz:false, Blinklicht:true }, [[{}, { Blinklicht:false }]]) },
    {type:'single', q:'Wozu dient der negierte Eingang Impuls vor dem Timer?', options:['Er startet den Timer nach jedem Impuls neu','Er verlängert den Impuls','Nichts'], correct:0,
     explain:'Ohne ihn bliebe der Impuls dauerhaft 1.'},
    {type:'single', q:'Wie entstehen zwei abwechselnd blinkende Lampen?', options:['Eine mit Blink, eine mit negiertem Blink','Zwei Taktgeber','Eine TOF-Box'], correct:0,
     explain:'Gegentakt.'},
    {type:'single', q:'Wie lange ist der Taktimpuls jeweils 1?', options:['Einen Zyklus','500 ms'], correct:0,
     explain:'Er setzt den Timer sofort zurück.'},
    {type:'single', q:'Was macht die XOR-Rückführung mit jedem Impuls?', options:['Sie kippt den Ausgang','Sie löscht ihn','Sie zählt'], correct:0,
     explain:'Wie beim Stromstoss.'}
  ]});

defTheory({ id:'ft7b', ch:7, pos:'mid', title:'Überwachung und Abläufe', minutes:4,
  lesson:`
<p>Eine <b>Laufzeitüberwachung</b> misst, wie lange ein Vorgang dauert:</p>
<pre class="kop">NETWORK Laufzeit ueberwachen
W1_laeuft AND TON(T_W1, T#6S) => S Weichenstoerung;</pre>
<p>Die Störung wird <b>gespeichert</b> — sonst verschwände sie, sobald der Antrieb stoppt.</p>
<h4>Zeitgesteuerte Abläufe</h4>
<p>Speicher + Timer = Ablaufschritt: Der Speicher hält den Schritt, der Timer beendet ihn (S nächster, R eigener Schritt). Ein Timer mit dem eigenen Zustand als Eingang begrenzt, wie lange ein Zustand dauern darf (<b>Zeitauflösung</b>).</p>`,
  questions:[
    {type:'single', q:'Die Weiche läuft 7 s, Überwachung 6 s. Was passiert?', kop:'NETWORK U\nW1_laeuft AND TON(T_W1, T#6S) => S Weichenstoerung;', options:['Störung wird gespeichert','Nichts'], correct:0,
     explain:'Die Laufzeit ist überschritten.',
     verifyKop: VS('NETWORK U\nW1_laeuft AND TON(T_W1, T#6S) => S Weichenstoerung;', { W1_laeuft:false, Weichenstoerung:false }, [[0, { W1_laeuft:true }, {}], [7, {}, { Weichenstoerung:true }]]) },
    {type:'single', q:'Warum S statt = für die Weichenstörung?', options:['Sonst verschwindet sie, sobald der Antrieb stoppt','Weil TON keine Zuweisung erlaubt','Das ist egal'], correct:0,
     explain:'Eine Störung muss bleiben, bis jemand sie sieht.'},
    {type:'single', q:'Was ist eine Räumzeit am Bahnübergang?', options:['Der Übergang muss eine Zeit lang frei sein, bevor die Schranke öffnet','Die Zeit bis zum nächsten Zug','Die Glockenzeit'], correct:0,
     explain:'TON auf „frei“.'},
    {type:'single', q:'Wie wird aus Speicher und Timer ein Ablaufschritt?', options:['Timer beendet den Schritt: S nächster, R eigener','Zwei Timer hintereinander','Mit einer XOR-Box'], correct:0,
     explain:'Wie beim Vorläuten.'},
    {type:'single', q:'Ein Signal steht 10 s auf Fahrt, kein Zug kommt. Mit Zeitauflösung …', options:['fällt es von selbst auf Halt','bleibt es auf Fahrt'], correct:0,
     explain:'Der Timer begrenzt den Zustand.'}
  ]});

defTheory({ id:'ft8a', ch:8, pos:'start', title:'Zähler CTU und CTD', minutes:5,
  lesson:`
<pre class="kop">NETWORK Achsen zaehlen
Achse AND CTU(Z_Achsen, PV:=8, R:=Grundstellung) => Zug_komplett;</pre>
<p>Der <b>CTU</b> zählt jede steigende Flanke an CU (die Flanke ist eingebaut). <code>Q</code> = 1, sobald <code>CV ≥ PV</code>. <code>R</code> setzt auf 0. Den Zählwert liest man als <code>Z_Achsen.CV</code>.</p>
<p>Der <b>CTD</b> zählt vom geladenen Wert herunter: <code>LD</code> lädt <code>PV</code>, <code>Q</code> = 1 bei <code>CV ≤ 0</code> — typisch für „noch n bis zur Wartung“.</p>`,
  questions:[
    {type:'single', q:'8 Achsen gezählt, PV = 8. Zug_komplett?', options:['1','0'], correct:0,
     explain:'CV ≥ PV.'},
    {type:'single', q:'Nach 2 Achsen, PV = 2 — Q?', kop:'NETWORK Z\nAchse AND CTU(Z1, PV:=2, R:=Rs) => Q1;', options:['1','0'], correct:0,
     explain:'Zwei Flanken erreichen PV.',
     verifyKop: VS('NETWORK Z\nAchse AND CTU(Z1, PV:=2, R:=Rs) => Q1;', { Achse:false, Rs:false, Q1:false }, [[0, { Achse:true }, { Q1:false }], [0.1, { Achse:false }, {}], [0.1, { Achse:true }, { Q1:true }]]) },
    {type:'single', q:'Was bewirkt LD beim CTD?', options:['CV wird auf PV gesetzt','CV wird 0','Der Zähler zählt hoch'], correct:0,
     explain:'Laden = Startwert.'},
    {type:'input', q:'Wie heisst der Ausgang für den Zählwert?', answer:['CV','.CV'],
     explain:'CV = Current Value.'},
    {type:'single', q:'Zählt der CTU jeden Zyklus, in dem CU = 1 ist?', options:['Nein, nur steigende Flanken','Ja'], correct:0,
     explain:'Die Flanke steckt im Zähler.'}
  ]});

defTheory({ id:'ft8b', ch:8, pos:'mid', title:'Der Achszähler', minutes:4,
  lesson:`
<p>Ein Gleisabschnitt ist frei, wenn genauso viele Achsen <b>hinaus-</b> wie <b>hineingefahren</b> sind:</p>
<pre class="kop">NETWORK Besetzt
[Z_Ein.CV <> Z_Aus.CV] => Abschnitt_besetzt;</pre>
<p>Zwei Zähler (Ein- und Ausfahrt), ein Vergleich. Die Grundstellung setzt beide Zähler zurück — zum Beispiel nach einer Störung, wenn das Gleis kontrolliert frei ist.</p>
<p>Der Achszähler ist eine der wichtigsten Gleisfreimeldungen in echten Stellwerken.</p>`,
  questions:[
    {type:'single', q:'Ein: 4 Achsen, Aus: 3 Achsen. Abschnitt?', options:['besetzt','frei'], correct:0,
     explain:'Eine Achse steht noch drin.'},
    {type:'single', q:'Ein: 8, Aus: 8. Abschnitt?', kop:'NETWORK B\n[Ein > Aus] OR [Ein < Aus] => Besetzt;', options:['frei','besetzt'], correct:0,
     explain:'Gleich viele → frei.',
     verifyKop: V('NETWORK B\n[Ein > Aus] OR [Ein < Aus] => Besetzt;', { Ein:8, Aus:8, Besetzt:true }, [[{}, { Besetzt:false }]]) },
    {type:'single', q:'Welcher Vergleich meldet „besetzt“?', options:['<> (ungleich)','==','>='], correct:0,
     explain:'Ungleich = noch Achsen im Abschnitt.'},
    {type:'single', q:'Wozu dient die Grundstellung?', options:['Beide Zähler nach Kontrolle auf 0 setzen','Den Zug anhalten','Die Weiche umstellen'], correct:0,
     explain:'Ein gestörter Achszähler wird so wieder in einen sicheren Zustand gebracht.'},
    {type:'single', q:'Wie hängt ein Einfahrsignal am Achszähler?', options:['Negierter Eingang „Abschnitt_besetzt“ an der &-Box','Gar nicht','Über eine TOF-Box'], correct:0,
     explain:'Besetzt sperrt das Signal.'}
  ]});

defTheory({ id:'ft9a', ch:9, pos:'start', title:'Vergleicher', minutes:4,
  lesson:`
<pre class="kop">NETWORK Zu schnell
[Tempo > 40] => Warnung;</pre>
<p>Die <b>CMP-Box</b> vergleicht zwei Werte: <code>==</code>, <code>&lt;&gt;</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>. Zwei CMP-Boxen an einer &amp;-Box prüfen einen Bereich.</p>
<p>Grenzen genau lesen: „bis 40 erlaubt“ heisst Warnung bei <code>&gt; 40</code>.</p>`,
  questions:[
    {type:'single', q:'Tempo = 40. Warnung?', kop:'NETWORK W\n[Tempo > 40] => Warnung;', options:['0','1'], correct:0,
     explain:'40 ist nicht grösser als 40.',
     verifyKop: V('NETWORK W\n[Tempo > 40] => Warnung;', { Tempo:40, Warnung:true }, [[{}, { Warnung:false }]]) },
    {type:'single', q:'Wie prüfst du „zwischen 40 und 60“?', options:['Zwei CMP-Boxen an einer &-Box','Zwei CMP-Boxen an einer >=1-Box','Eine CMP-Box mit =='], correct:0,
     explain:'> 40 UND <= 60.'},
    {type:'single', q:'Zugnummer 4711 auswählen — welcher Vergleich?', options:['==','>','<>'], correct:0,
     explain:'Gleichheit.'},
    {type:'single', q:'Darf eine CMP-Box zwei Variablen vergleichen?', options:['Ja','Nein, nur mit Zahlen'], correct:0,
     explain:'z. B. Tempo > V_zul.'},
    {type:'single', q:'„Ab 5 Minuten Verspätung gelb“ — welcher Vergleich?', options:['>= 5','> 5'], correct:0,
     explain:'„Ab“ schliesst die Grenze ein.'}
  ]});

defTheory({ id:'ft9b', ch:9, pos:'mid', title:'MOVE und Rechenboxen', minutes:4,
  lesson:`
<pre class="kop">NETWORK Halt
=> MOVE(0, Begriff_A);

NETWORK Fahrt
Fahrt => MOVE(1, Begriff_A);</pre>
<p><b>MOVE</b> schreibt IN nach OUT, wenn EN = 1. Mehrere MOVEs auf dasselbe Ziel: das <b>letzte</b> mit EN = 1 gewinnt — eine Rangfolge.</p>
<p><b>ADD, SUB, MUL, DIV</b> rechnen <code>OUT := IN1 op IN2</code>. Bei SUB und DIV ist die Reihenfolge der Eingänge wichtig.</p>`,
  questions:[
    {type:'single', q:'Fahrt = 1: welcher Begriff steht am Ende in Begriff_A?', kop:'NETWORK Halt\n=> MOVE(0, Begriff_A);\n\nNETWORK Fahrt\nFahrt => MOVE(1, Begriff_A);', options:['1','0'], correct:0,
     explain:'Das untere MOVE überschreibt.',
     verifyKop: V('NETWORK Halt\n=> MOVE(0, Begriff_A);\n\nNETWORK Fahrt\nFahrt => MOVE(1, Begriff_A);', { Fahrt:true, Begriff_A:0 }, [[{}, { Begriff_A:1 }]]) },
    {type:'single', q:'Achsen = 8, MUL mit 7. Ergebnis?', options:['56','15','87'], correct:0,
     explain:'8 · 7 = 56.',
     verifyKop: V('NETWORK L\n=> MUL(Achsen, 7, Laenge_m);', { Achsen:8, Laenge_m:0 }, [[{}, { Laenge_m:56 }]]) },
    {type:'single', q:'EN der MOVE-Box ist 0. OUT?', options:['Bleibt unverändert','Wird 0'], correct:0,
     explain:'Ohne Freigabe passiert nichts.'},
    {type:'single', q:'SUB: IN1 = 600, IN2 = 607. Ergebnis?', options:['−7','7'], correct:0,
     explain:'IN1 − IN2.'},
    {type:'single', q:'Wo gehört der wichtigste Fall bei mehreren MOVEs hin?', options:['Nach unten','Nach oben'], correct:0,
     explain:'Er soll zuletzt schreiben.'}
  ]});

defTheory({ id:'ft10a', ch:10, pos:'start', title:'Die Fahrstrasse', minutes:5,
  lesson:`
<p>Eine <b>Fahrstrasse</b> ist der Weg eines Zuges durchs Stellwerk. Sie durchläuft vier Stufen:</p>
<ol><li><b>Einstellen</b> — Weichen laufen in die richtige Lage.</li>
<li><b>Sichern</b> — Weichen in Endlage, Flankenschutz, Schranke unten, Zielgleis frei.</li>
<li><b>Signal Fahrt</b> — nur mit gesicherter Fahrstrasse.</li>
<li><b>Auflösen</b> — nach der Zugfahrt (Zugschlussstelle).</li></ol>
<pre class="kop">NETWORK Fahrstrasse sichern
FS_eingestellt AND W1_Endlage_links AND Schranke_unten AND Gleis1_frei => SR(FS_gesichert, Aufloesung);</pre>`,
  questions:[
    {type:'single', q:'Wann darf das Signal Fahrt zeigen?', options:['Wenn die Fahrstrasse gesichert ist','Sobald sie eingestellt ist','Sobald die Taste gedrückt ist'], correct:0,
     explain:'Eingestellt heisst nur: Weichen unterwegs.'},
    {type:'single', q:'Alles erfüllt, nur die Schranke ist nicht unten. FS_gesichert?', kop:'NETWORK S\nFS_eingestellt AND W1_Endlage_links AND Schranke_unten AND Gleis1_frei => SR(FS_gesichert, Aufloesung);', options:['0','1'], correct:0,
     explain:'Eine Bedingung fehlt.',
     verifyKop: V('NETWORK S\nFS_eingestellt AND W1_Endlage_links AND Schranke_unten AND Gleis1_frei => SR(FS_gesichert, Aufloesung);', { FS_eingestellt:true, W1_Endlage_links:true, Schranke_unten:false, Gleis1_frei:true, Aufloesung:false, FS_gesichert:false }, [[{}, { FS_gesichert:false }]]) },
    {type:'single', q:'Was löst eine Fahrstrasse auf?', options:['Der Zug verlässt den Abschnitt (fallende Flanke)','Die Uhr','Das Signal'], correct:0,
     explain:'Zugschlussstelle.'},
    {type:'single', q:'Was ist Flankenschutz?', options:['Weichen so legen, dass nichts in die Fahrstrasse rollen kann','Eine Flanke in einer Box','Ein schnelles Signal'], correct:0,
     explain:'Schutz gegen Fahrzeuge von der Seite.'},
    {type:'single', q:'Welches Flipflop für die gesicherte Fahrstrasse?', options:['SR','RS'], correct:0,
     explain:'Im Zweifel aufgelöst.'}
  ]});

defTheory({ id:'ft10b', ch:10, pos:'mid', title:'Feindliche Fahrstrassen und Automatik', minutes:4,
  lesson:`
<p>Zwei Fahrstrassen, die sich gefährden (gleiche Weiche, gleiches Gleis), sind <b>feindlich</b>. Sie schliessen sich gegenseitig aus:</p>
<pre class="kop">NETWORK Fahrstrasse Gleis 1
Taste_FS1 AND NOT FS2 => SR(FS1, Aufloesung);</pre>
<p>Der Ausschluss muss auf <b>beiden</b> Seiten stehen.</p>
<h4>Automatik</h4>
<pre class="kop">NETWORK Anforderung
(Taste_FS OR (Automatik AND Zug_meldet)) AND NOT Stoerung => SR(FS_eingestellt, Aufloesung);</pre>
<p>Hand und Automatik sind zwei Wege zur selben Anforderung; die Störung sperrt beide.</p>`,
  questions:[
    {type:'single', q:'FS2 besteht. Taste_FS1 wird gedrückt. FS1?', kop:'NETWORK F\nTaste_FS1 AND NOT FS2 => SR(FS1, Aufloesung);', options:['bleibt 0','wird 1'], correct:0,
     explain:'Feindliche Fahrstrasse sperrt.',
     verifyKop: V('NETWORK F\nTaste_FS1 AND NOT FS2 => SR(FS1, Aufloesung);', { Taste_FS1:true, FS2:true, Aufloesung:false, FS1:false }, [[{}, { FS1:false }]]) },
    {type:'single', q:'Wann sind zwei Fahrstrassen feindlich?', options:['Wenn sie sich gefährden (gleiche Weiche oder gleiches Gleis)','Wenn sie verschiedene Signale haben','Nie'], correct:0,
     explain:'Dann dürfen sie nicht gleichzeitig bestehen.'},
    {type:'single', q:'Automatik = 1, Zug meldet, Störung = 1. Fahrstrasse?', options:['wird nicht eingestellt','wird eingestellt'], correct:0,
     explain:'Die Störung sperrt beide Wege.'},
    {type:'single', q:'Wie werden Hand- und Automatikanforderung verknüpft?', options:['>=1-Box','&-Box','X-Box'], correct:0,
     explain:'Einer der beiden genügt.'},
    {type:'multi', q:'Was gehört zur Sicherung einer Fahrstrasse? (alle richtigen)', options:['Weichen in Endlage','Flankenschutz','Schranke unten','Signal zeigt Fahrt'], correct:[0,1,2],
     explain:'Das Signal ist die Folge der Sicherung, nicht ihre Bedingung.'}
  ]});
})();
