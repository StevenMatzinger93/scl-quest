/* ===== AWL QUEST: Theorie-Aufträge (Kapitel 1–10) =====
   <pre class="code">…</pre> wird als AWL hervorgehoben; q.code in Fragen ebenso.
   verifyAwl: { src, vars, types, tests|steps } — der Validator prüft die Aussage mit der Engine. */
(function(){
const V = (src, vars, tests, types) => ({ src, vars, tests, types });
const VS = (src, vars, steps, types) => ({ src, vars, steps, types });
const ST = (rows) => window.AWL_ST ? window.AWL_ST(rows) : '';

defTheory({ id:'at1a', ch:1, pos:'start', title:'Die Anweisungsliste', minutes:4,
  lesson:`
<p>Die <b>Anweisungsliste (AWL)</b> ist die älteste Programmiersprache der Siemens-Steuerungen. Jede Zeile enthält <b>eine Anweisung</b>: zuerst die Operation, dann den Operanden.</p>
<pre class="code">U  S_Rollgang
=  Rollgang</pre>
<ul><li><code>U</code> („UND“) fragt einen Operanden ab.</li>
<li>Das Ergebnis heisst <b>VKE</b> — Verknüpfungsergebnis. Es ist ein einzelnes Bit: 0 oder 1.</li>
<li><code>=</code> schreibt das VKE in den Operanden (Zuweisung).</li></ul>
<p>Die SPS arbeitet die Zeilen <b>von oben nach unten</b> ab — in jedem Zyklus neu.</p>
<div class="awl-note">AWL läuft auf der <b>S7-300/400</b> und (eingeschränkt) auf der S7-1500 — <b>nicht auf der S7-1200</b>.</div>`,
  questions:[
    {type:'single', q:'Was steht in einer AWL-Zeile?', options:['Eine Anweisung: Operation und Operand','Ein ganzes Netzwerk','Eine Deklaration'], correct:0,
     explain:'Eine Zeile — eine Anweisung.'},
    {type:'single', q:'Wofür steht VKE?', options:['Verknüpfungsergebnis','Variablen-Kennung','Verzögerte Einschaltung'], correct:0,
     explain:'Das VKE ist das Bit, das die Abfragen bilden.'},
    {type:'single', q:'<code>S_Rollgang</code> = 1. Was ist <code>Rollgang</code> nach dem Zyklus?', code:'U  S_Rollgang\n=  Rollgang', options:['1','0'], correct:0,
     explain:'Das VKE ist 1 und wird zugewiesen.',
     verifyAwl: V('U  S_Rollgang\n=  Rollgang', { S_Rollgang:true, Rollgang:false }, [[{}, { Rollgang:true }]]) },
    {type:'single', q:'Auf welcher Steuerung läuft AWL <b>nicht</b>?', options:['S7-1200','S7-300','S7-400'], correct:0,
     explain:'Die S7-1200 kennt nur KOP, FUP, SCL (und GRAPH).'},
    {type:'input', q:'Mit welchem Zeichen weist man das VKE einem Ausgang zu?', answer:['=', '= '],
     explain:'= schreibt das VKE in den Operanden.'}
  ]});

defTheory({ id:'at1b', ch:1, pos:'mid', title:'Erstabfrage und Status', minutes:5,
  lesson:`
<p>Die erste Abfrage einer Kette heisst <b>Erstabfrage</b>. Sie übernimmt den Operanden direkt ins VKE. Jede weitere <code>U</code>-Abfrage verknüpft mit UND.</p>
<pre class="code">U  S_Walzen
U  Gitter_zu
=  Walzen</pre>
${ST([['U  S_Walzen', 1], ['U  Gitter_zu', 0], ['=  Walzen', 0]])}
<p>So sieht der <b>Status</b> aus: Neben jeder Zeile steht das VKE nach dieser Zeile. Hier ist das Gitter offen — ab Zeile 2 ist das VKE 0.</p>
<p><code>=</code> beendet die Kette. Die nächste Abfrage ist wieder eine Erstabfrage. Das VKE selbst bleibt aber stehen: Zwei <code>=</code> hintereinander schreiben denselben Wert.</p>`,
  questions:[
    {type:'single', q:'Was macht die Erstabfrage?', options:['Sie übernimmt den Operanden direkt ins VKE','Sie verknüpft mit dem alten VKE','Sie löscht den Operanden'], correct:0,
     explain:'Die erste Abfrage einer Kette startet das VKE neu.'},
    {type:'single', q:'<code>S_Walzen</code> = 1, <code>Gitter_zu</code> = 0. Was ist <code>Walzen</code>?', code:'U  S_Walzen\nU  Gitter_zu\n=  Walzen', options:['0','1'], correct:0,
     explain:'1 UND 0 = 0.',
     verifyAwl: V('U  S_Walzen\nU  Gitter_zu\n=  Walzen', { S_Walzen:true, Gitter_zu:false, Walzen:true }, [[{}, { Walzen:false }]]) },
    {type:'single', q:'<code>a</code> = 1, <code>b</code> = 0. Was ist <code>q</code>?', code:'U  a\n=  q\nU  b', options:['1 — U b gehört schon zur nächsten Kette','0'], correct:0,
     explain:'Nach = beginnt eine neue Kette.',
     verifyAwl: V('U  a\n=  q\nU  b', { a:true, b:false, q:false }, [[{}, { q:true }]]) },
    {type:'single', q:'Was zeigt der Status neben einer Zeile?', options:['Das VKE (und die Akkus) nach dieser Zeile','Die Zeilennummer','Den Kommentar'], correct:0,
     explain:'Wie beim Beobachten im TIA Portal.'},
    {type:'single', q:'Zwei <code>=</code>-Zeilen direkt untereinander. Was passiert?', options:['Beide Operanden bekommen dasselbe VKE','Nur der zweite wird geschrieben','Fehler'], correct:0,
     explain:'Das VKE bleibt nach = erhalten.'}
  ]});

defTheory({ id:'at2a', ch:2, pos:'start', title:'UN, O, ON, X', minutes:5,
  lesson:`
<table><tr><th>Anweisung</th><th>Bedeutung</th></tr>
<tr><td><code>U</code> / <code>UN</code></td><td>UND / UND NICHT</td></tr><tr><td><code>O</code> / <code>ON</code></td><td>ODER / ODER NICHT</td></tr><tr><td><code>X</code> / <code>XN</code></td><td>Exklusiv-ODER / Exklusiv-ODER NICHT</td></tr></table>
<pre class="code">U  S_Walzen
UN Stoerung
=  Walzen</pre>
<p><code>UN</code> fragt den Operanden negiert ab: Er liefert 1, wenn der Operand 0 ist. So sperrt eine Störung die Kette.</p>
<pre class="code">O  S_Hupe_Pult
O  S_Hupe_Kran
=  Hupe</pre>`,
  questions:[
    {type:'single', q:'<code>S_Walzen</code> = 1, <code>Stoerung</code> = 1. Was ist <code>Walzen</code>?', code:'U  S_Walzen\nUN Stoerung\n=  Walzen', options:['0','1'], correct:0,
     explain:'UN Stoerung liefert 0, weil die Störung ansteht.',
     verifyAwl: V('U  S_Walzen\nUN Stoerung\n=  Walzen', { S_Walzen:true, Stoerung:true, Walzen:true }, [[{}, { Walzen:false }]]) },
    {type:'single', q:'Wann ist das VKE nach <code>O a / O b</code> gleich 1?', options:['Wenn mindestens einer 1 ist','Nur wenn beide 1 sind','Wenn genau einer 1 ist'], correct:0,
     explain:'ODER: mindestens einer.'},
    {type:'single', q:'<code>X a / X b</code> mit a = 1 und b = 1. VKE?', code:'X  a\nX  b\n=  q', options:['0','1'], correct:0,
     explain:'Exklusiv-ODER: nur bei verschiedenen Werten 1.',
     verifyAwl: V('X  a\nX  b\n=  q', { a:true, b:true, q:true }, [[{}, { q:false }]]) },
    {type:'single', q:'Welche Anweisung fragt „ODER NICHT“ ab?', options:['ON','UN','XN'], correct:0,
     explain:'ON — ODER mit negiertem Operanden.'},
    {type:'single', q:'Wofür eignet sich X besonders?', options:['Zwei Rückmeldungen, die sich ausschliessen, prüfen','Einen Not-Aus abfragen','Werte addieren'], correct:0,
     explain:'Genau eine Endlage — sonst stimmt etwas nicht.'}
  ]});

defTheory({ id:'at2b', ch:2, pos:'mid', title:'UND vor ODER, Klammern', minutes:5,
  lesson:`
<p>In AWL bindet <b>UND stärker als ODER</b>:</p>
<pre class="code">U  a
U  b
O  c
=  q</pre>
<p>bedeutet <b>(a UND b) ODER c</b>. Mit <code>O</code> ohne Operand trennst du zwei UND-Gruppen deutlich.</p>
<p>Soll ein ODER <b>innerhalb</b> einer UND-Kette stehen, brauchst du eine <b>Klammer</b>:</p>
<pre class="code">U  S_Walzen
U(
O  Pumpe_1
O  Pumpe_2
)
=  Walzen</pre>
<p><code>U(</code> merkt sich das VKE, in der Klammer beginnt eine neue Kette, <code>)</code> verknüpft das Ergebnis mit UND. Es gibt auch <code>O(</code>, <code>X(</code>, <code>UN(</code>, <code>ON(</code>, <code>XN(</code>.</p>`,
  questions:[
    {type:'single', q:'a = 0, b = 0, c = 1. Was ist q?', code:'U  a\nU  b\nO  c\n=  q', options:['1','0'], correct:0,
     explain:'(a UND b) ODER c = 0 ODER 1 = 1.',
     verifyAwl: V('U  a\nU  b\nO  c\n=  q', { a:false, b:false, c:true, q:false }, [[{}, { q:true }]]) },
    {type:'single', q:'<code>S_Walzen</code> = 0, <code>Pumpe_1</code> = 1. Was ist <code>Walzen</code>?', code:'U  S_Walzen\nU(\nO  Pumpe_1\nO  Pumpe_2\n)\n=  Walzen', options:['0','1'], correct:0,
     explain:'Die Klammer ist 1, aber S_Walzen ist 0.',
     verifyAwl: V('U  S_Walzen\nU(\nO  Pumpe_1\nO  Pumpe_2\n)\n=  Walzen', { S_Walzen:false, Pumpe_1:true, Pumpe_2:false, Walzen:true }, [[{}, { Walzen:false }]]) },
    {type:'single', q:'Dieselben Werte, aber ohne Klammer: <code>U S_Walzen / O Pumpe_1 / O Pumpe_2</code>. Ergebnis?', options:['1 — S_Walzen wird durch ODER umgangen','0'], correct:0,
     explain:'Ohne Klammer bedeutet es S_Walzen ODER Pumpe_1 ODER Pumpe_2.',
     verifyAwl: V('U  S_Walzen\nO  Pumpe_1\nO  Pumpe_2\n=  Walzen', { S_Walzen:false, Pumpe_1:true, Pumpe_2:false, Walzen:false }, [[{}, { Walzen:true }]]) },
    {type:'single', q:'Was bewirkt <code>O</code> ohne Operand?', options:['Es trennt zwei UND-Gruppen, die mit ODER verknüpft werden','Es löscht das VKE','Es ist ein Syntaxfehler'], correct:0,
     explain:'„UND vor ODER“ ausdrücklich geschrieben.'},
    {type:'single', q:'Welche Klammer negiert ihr Ergebnis beim Verknüpfen mit UND?', options:['UN(','U(','ON('], correct:0,
     explain:'UN( … ) = UND NICHT (Klammerergebnis).'}
  ]});

defTheory({ id:'at3a', ch:3, pos:'start', title:'Setzen, Rücksetzen, Vorrang', minutes:5,
  lesson:`
<pre class="code">U  S_Ein
S  Pumpe
U  S_Aus
R  Pumpe</pre>
<p><code>S</code> schreibt eine 1 in den Operanden, wenn das VKE 1 ist. Ist das VKE 0, passiert <b>nichts</b> — der Wert bleibt gespeichert. <code>R</code> schreibt eine 0.</p>
<p>Sind beide Bedingungen gleichzeitig erfüllt, <b>gewinnt die untere Anweisung</b>, weil sie zuletzt schreibt. Hier ist also Rücksetzen dominant — genau richtig für einen Aus-Taster oder Not-Aus.</p>
<p>Steht <code>S</code> unten, ist Setzen dominant — richtig für eine Störmeldung, die sich nicht wegquittieren lassen soll.</p>`,
  questions:[
    {type:'single', q:'Das VKE vor <code>S Pumpe</code> ist 0. Was passiert mit Pumpe?', options:['Nichts, der Wert bleibt','Pumpe wird 0','Pumpe wird 1'], correct:0,
     explain:'S und R wirken nur bei VKE 1.'},
    {type:'single', q:'Beide Taster sind gedrückt. Was ist <code>Pumpe</code>?', code:'U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe', options:['0','1'], correct:0,
     explain:'R steht unten und gewinnt.',
     verifyAwl: V('U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe', { S_Ein:true, S_Aus:true, Pumpe:false }, [[{}, { Pumpe:false }]]) },
    {type:'single', q:'Wie macht man Setzen dominant?', options:['Die S-Anweisung unter die R-Anweisung schreiben','S doppelt schreiben','Mit NOT'], correct:0,
     explain:'Wer zuletzt schreibt, gewinnt.'},
    {type:'single', q:'Eine Kette setzt den Rollgang, eine andere setzt ihn bei Not-Aus zurück. Wo muss die Not-Aus-Kette stehen?', options:['Darunter','Darüber','Egal'], correct:0,
     explain:'Sicherheit muss immer gewinnen.'},
    {type:'single', q:'Der Taster S_Ein war kurz gedrückt, jetzt ist nichts gedrückt. Pumpe?', options:['1 — gespeichert','0'], correct:0,
     explain:'S speichert.',
     verifyAwl: VS('U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe', { S_Ein:false, S_Aus:false, Pumpe:false }, [[0.1, { S_Ein:true }, { Pumpe:true }], [0.1, { S_Ein:false }, { Pumpe:true }]]) }
  ]});

defTheory({ id:'at3b', ch:3, pos:'mid', title:'Selbsthaltung, NOT, SET', minutes:5,
  lesson:`
<pre class="code">U(
O  S_Ein
O  Walzen
)
UN S_Aus
=  Walzen</pre>
<p>Die <b>Selbsthaltung</b> fragt den eigenen Ausgang ab: Einmal eingeschaltet, hält er sich — bis <code>S_Aus</code> kommt. Mit Klammer ist Aus dominant.</p>
<p>Ohne Klammer, <code>O S_Ein / O Walzen / UN S_Aus</code>, bedeutet das: S_Ein ODER (Walzen UND NICHT S_Aus) — dann ist <b>Ein dominant</b>.</p>
<p><code>NOT</code> dreht das VKE um. <code>SET</code> setzt es auf 1, <code>CLR</code> auf 0.</p>`,
  questions:[
    {type:'single', q:'Beide Taster gleichzeitig gedrückt. Was ist <code>Walzen</code>?', code:'U(\nO  S_Ein\nO  Walzen\n)\nUN S_Aus\n=  Walzen', options:['0 — Aus ist dominant','1'], correct:0,
     explain:'Die Klammer ist 1, aber UN S_Aus macht 0.',
     verifyAwl: V('U(\nO  S_Ein\nO  Walzen\n)\nUN S_Aus\n=  Walzen', { S_Ein:true, S_Aus:true, Walzen:false }, [[{}, { Walzen:false }]]) },
    {type:'single', q:'Gleiche Taster, aber ohne Klammer: <code>O S_Ein / O Walzen / UN S_Aus</code>. Walzen?', options:['1 — Ein ist dominant','0'], correct:0,
     explain:'UND vor ODER: S_Ein ODER (Walzen UND NICHT S_Aus).',
     verifyAwl: V('O  S_Ein\nO  Walzen\nUN S_Aus\n=  Walzen', { S_Ein:true, S_Aus:true, Walzen:false }, [[{}, { Walzen:true }]]) },
    {type:'single', q:'Was macht <code>NOT</code>?', options:['Es negiert das VKE','Es negiert den nächsten Operanden','Es beendet das Programm'], correct:0,
     explain:'NOT arbeitet auf dem VKE.'},
    {type:'single', q:'Was ergibt <code>SET / = q</code>?', options:['q = 1','q = 0','Fehler'], correct:0,
     explain:'SET macht das VKE 1.',
     verifyAwl: V('SET\n=  q', { q:false }, [[{}, { q:true }]]) },
    {type:'single', q:'Wodurch „hält“ sich eine Selbsthaltung?', options:['Der Ausgang fragt sich selbst ab','Durch eine Zeit','Durch SET'], correct:0,
     explain:'O Walzen hält das VKE auf 1, solange nichts sperrt.'}
  ]});

defTheory({ id:'at4a', ch:4, pos:'start', title:'Flanken', minutes:4,
  lesson:`
<pre class="code">U  S_Schnitt
FP M_Schnitt
=  Schere</pre>
<p><code>FP</code> (Flanke positiv) prüft, ob das VKE <b>jetzt 1</b> ist und <b>im letzten Zyklus 0</b> war. Nur dann ist das neue VKE 1 — für genau einen Zyklus.</p>
<p>Den Zustand des letzten Zyklus speichert FP im <b>Flankenmerker</b> (hier <code>M_Schnitt</code>). <code>FN</code> (Flanke negativ) reagiert auf den Wechsel von 1 nach 0.</p>
<p>Jede Flankenauswertung braucht ihren <b>eigenen</b> Flankenmerker.</p>`,
  questions:[
    {type:'single', q:'Der Taster wird gedrückt und gehalten. Wie viele Zyklen ist <code>Schere</code> 1?', options:['Genau einen','Solange er gedrückt ist','Keinen'], correct:0,
     explain:'Nur im Zyklus des Wechsels.',
     verifyAwl: VS('U  S_Schnitt\nFP M_Schnitt\n=  Schere', { S_Schnitt:false, M_Schnitt:false, Schere:false }, [[0.1, { S_Schnitt:true }, { Schere:true }], [0.1, {}, { Schere:false }], [0.1, {}, { Schere:false }]]) },
    {type:'single', q:'Wozu dient der Flankenmerker?', options:['Er speichert das VKE des letzten Zyklus','Er zählt die Flanken','Er verzögert das Signal'], correct:0,
     explain:'Ohne alten Zustand keine Flanke.'},
    {type:'single', q:'Welche Anweisung reagiert auf das Loslassen eines Tasters?', options:['FN','FP','NOT'], correct:0,
     explain:'Loslassen = 1 → 0 = negative Flanke.'},
    {type:'single', q:'Zwei FP-Auswertungen teilen sich einen Merker. Was passiert?', options:['Die zweite sieht nie eine Flanke','Beide funktionieren','Fehlermeldung'], correct:0,
     explain:'Die erste überschreibt den Merker schon vorher.'},
    {type:'single', q:'Was ergibt <code>U Taster / FP M / X Lampe / = Lampe</code>?', options:['Bei jedem Tastendruck wechselt die Lampe','Die Lampe blinkt','Die Lampe folgt dem Taster'], correct:0,
     explain:'Ein Stromstossschalter.'}
  ]});

defTheory({ id:'at4b', ch:4, pos:'mid', title:'Flanken in Abläufen', minutes:4,
  lesson:`
<p>Befehle, die <b>einmal</b> wirken sollen, gehören an eine Flanke: Quittieren, Zählen, einen Schnitt auslösen.</p>
<pre class="code">U  Block_da
FP M_Block
S  Schneiden
U  Schere_unten
R  Schneiden</pre>
<p>Die Flanke setzt den Befehl, die <b>Rückmeldung</b> setzt ihn zurück. So läuft jeder Schnitt genau einmal — auch wenn der Block lange unter der Lichtschranke liegt.</p>
<p>Ein Flanken-Befehl darf auch in einer Klammer stehen: <code>O( U a / FP M1 ) O( U a / FN M2 )</code> reagiert auf beide Flanken.</p>`,
  questions:[
    {type:'single', q:'Warum gehört Quittieren an eine Flanke?', options:['Ein klemmender Taster löscht sonst jede neue Meldung sofort','Weil es schneller ist','Das ist egal'], correct:0,
     explain:'Ein Dauersignal würde dauernd quittieren.'},
    {type:'single', q:'Was setzt den Schnittbefehl zurück?', options:['Die Rückmeldung „Schere unten“','Eine Zeit','Die Flanke'], correct:0,
     explain:'Befehl bis zur Rückmeldung.'},
    {type:'single', q:'Die Lichtschranke bleibt 3 Zyklen belegt. Wie oft wird <code>Schneiden</code> gesetzt?', options:['Einmal','Dreimal'], correct:0,
     explain:'Nur die steigende Flanke setzt.',
     verifyAwl: VS('U  Block_da\nFP M_Block\n=  Impuls', { Block_da:false, M_Block:false, Impuls:false }, [[0.1, { Block_da:true }, { Impuls:true }], [0.1, {}, { Impuls:false }], [0.1, {}, { Impuls:false }]]) },
    {type:'single', q:'Welche Flanke nimmst du, um beim Abschalten des Gerüsts die Kühlung zu starten?', options:['FN','FP'], correct:0,
     explain:'Abschalten = 1 → 0.'},
    {type:'single', q:'Darf ein FP-Befehl in einer Klammer stehen?', options:['Ja','Nein'], correct:0,
     explain:'Er braucht nur eine Abfrage davor.'}
  ]});

defTheory({ id:'at5a', ch:5, pos:'start', title:'S5-Zeiten', minutes:5,
  lesson:`
<pre class="code">U  Pumpe
L  S5T#3S
SE T1
U  T1
=  Walzen_Frei</pre>
<p>Eine S5-Zeit braucht drei Dinge: den <b>Zeitwert</b> in AKKU1 (<code>L S5T#3S</code>), den <b>Start</b> mit dem VKE (<code>SE T1</code>) und die <b>Abfrage</b> des Zeitbits (<code>U T1</code>).</p>
<p><b>SE</b> ist die Einschaltverzögerung: T1 wird 1, wenn das VKE die ganze Zeit lang 1 war. Fällt das VKE vorher ab, beginnt alles von vorn.</p>
<p>Zeitwerte: <code>S5T#500MS</code>, <code>S5T#2S</code>, <code>S5T#1M30S</code> (höchstens 2 h 46 min).</p>`,
  questions:[
    {type:'single', q:'Wo steht der Zeitwert, wenn <code>SE T1</code> ausgeführt wird?', options:['In AKKU1','Im VKE','In T1'], correct:0,
     explain:'Darum steht L S5T#… direkt davor.'},
    {type:'single', q:'Die Pumpe läuft seit 2 s, SE mit 3 s. Ist <code>Walzen_Frei</code> 1?', options:['Nein','Ja'], correct:0,
     explain:'Die Zeit ist noch nicht abgelaufen.',
     verifyAwl: VS('U  Pumpe\nL  S5T#3S\nSE T1\nU  T1\n=  Walzen_Frei', { Pumpe:false, Walzen_Frei:false }, [[0, { Pumpe:true }, {}], [2, {}, { Walzen_Frei:false }], [1.1, {}, { Walzen_Frei:true }]]) },
    {type:'single', q:'Was passiert, wenn das VKE während einer laufenden SE-Zeit 0 wird?', options:['Die Zeit wird zurückgesetzt','Die Zeit läuft weiter','T1 wird sofort 1'], correct:0,
     explain:'SE braucht das VKE die ganze Zeit.'},
    {type:'single', q:'Mit welcher Anweisung fragst du das Zeitbit von T1 ab?', options:['U T1','L T1','SE T1'], correct:0,
     explain:'Wie ein ganz normales Bit.'},
    {type:'input', q:'Wie lautet der Zeitwert für eine halbe Sekunde?', answer:['S5T#500MS','s5t#500ms','S5T#0.5S','S5T#500ms'],
     explain:'S5T#500MS'}
  ]});

defTheory({ id:'at5b', ch:5, pos:'mid', title:'Die vier Zeitarten', minutes:5,
  lesson:`
<table><tr><th>Zeit</th><th>Name</th><th>Zeitbit</th></tr>
<tr><td><code>SE</code></td><td>Einschaltverzögerung</td><td>1 nach Ablauf, solange VKE 1</td></tr>
<tr><td><code>SA</code></td><td>Ausschaltverzögerung</td><td>1 solange VKE 1, danach noch die Zeit</td></tr>
<tr><td><code>SI</code></td><td>Impuls</td><td>1 ab Start für die Zeit, endet früher bei VKE 0</td></tr>
<tr><td><code>SV</code></td><td>verlängerter Impuls</td><td>1 ab Start für die volle Zeit</td></tr></table>
<p>Typische Aufgaben: SE für Anlaufzeiten und Überwachungen, SA für Nachläufe (Kühlung), SI für begrenzte Warnungen, SV für feste Abläufe (Schnitt).</p>
<p>Ein <b>Takt</b> entsteht aus zwei SE-Zeiten, die sich gegenseitig starten und zurücksetzen.</p>`,
  questions:[
    {type:'single', q:'Die Kühlung soll nach dem Walzen noch 5 s laufen. Welche Zeit?', options:['SA','SE','SI'], correct:0,
     explain:'Nachlauf = Ausschaltverzögerung.'},
    {type:'single', q:'Ein 0,1 s kurzer Impuls startet <code>SV</code> mit 1 s. Wie lange ist das Zeitbit 1?', options:['1 s','0,1 s'], correct:0,
     explain:'SV läuft die volle Zeit.',
     verifyAwl: VS('U  a\nL  S5T#1S\nSV T1\nU  T1\n=  q', { a:false, q:false }, [[0, { a:true }, { q:true }], [0.1, { a:false }, { q:true }], [0.8, {}, { q:true }], [0.2, {}, { q:false }]]) },
    {type:'single', q:'Der Taster wird nach 0,5 s losgelassen, <code>SI</code> mit 2 s. Wann endet der Impuls?', options:['Beim Loslassen','Nach 2 s'], correct:0,
     explain:'SI endet früher, wenn das VKE 0 wird.',
     verifyAwl: VS('U  a\nL  S5T#2S\nSI T1\nU  T1\n=  q', { a:false, q:false }, [[0, { a:true }, { q:true }], [0.5, { a:false }, { q:false }]]) },
    {type:'single', q:'Welche Zeit eignet sich für eine Laufzeitüberwachung?', options:['SE','SA','SV'], correct:0,
     explain:'Läuft der Vorgang länger als die Zeit → Störung.'},
    {type:'single', q:'Wie viele Zeitarten darf T1 in einem Programm haben?', options:['Eine','Beliebig viele'], correct:0,
     explain:'Jede Zeit hat genau eine Art.'}
  ]});

defTheory({ id:'at6a', ch:6, pos:'start', title:'S5-Zähler', minutes:5,
  lesson:`
<pre class="code">U  Block_raus
ZV Z1
L  Z1
T  Stueck</pre>
<p><code>ZV Z1</code> zählt bei jeder <b>steigenden Flanke</b> des VKE um 1 hoch — die Flankenauswertung steckt schon im Zähler. <code>ZR</code> zählt herunter. Der Zählbereich geht von 0 bis 999.</p>
<p><code>L Z1</code> lädt den Zählwert in AKKU1. <code>U Z1</code> ist 1, solange der Zähler nicht 0 ist.</p>`,
  questions:[
    {type:'single', q:'Die Lichtschranke ist 3 Zyklen lang belegt. Um wie viel zählt <code>ZV Z1</code>?', options:['1','3'], correct:0,
     explain:'ZV zählt nur die steigende Flanke.',
     verifyAwl: VS('U  a\nZV Z1\nL  Z1\nT  n', { a:false, n:0 }, [[0.1, { a:true }, { n:1 }], [0.1, {}, { n:1 }], [0.1, {}, { n:1 }]]) },
    {type:'single', q:'Wie kommt der Zählwert in eine Variable?', options:['L Z1 und T','= Z1','U Z1'], correct:0,
     explain:'Laden und transferieren.'},
    {type:'single', q:'Wann ist <code>U Z1</code> gleich 1?', options:['Wenn der Zählwert nicht 0 ist','Bei jeder Zählflanke','Wenn der Zähler 999 erreicht'], correct:0,
     explain:'Zählerbit = Zählwert ≠ 0.'},
    {type:'single', q:'Was passiert bei <code>ZR</code>, wenn der Zähler schon 0 ist?', options:['Er bleibt bei 0','Er springt auf 999','Er wird negativ'], correct:0,
     explain:'Der Zählbereich ist 0 bis 999.'},
    {type:'input', q:'Mit welcher Anweisung zählt ein S5-Zähler vorwärts?', answer:['ZV','zv'],
     explain:'ZV — Zählen vorwärts.'}
  ]});

defTheory({ id:'at6b', ch:6, pos:'mid', title:'Setzen, Rücksetzen, Bestand', minutes:4,
  lesson:`
<pre class="code">U  S_Laden
L  10
S  Z2
U  Block_raus
ZR Z2</pre>
<p><code>S Z2</code> setzt den Zähler bei steigender Flanke des VKE auf den Wert in <b>AKKU1</b>. <code>R Z2</code> setzt ihn auf 0, solange das VKE 1 ist.</p>
<p>Ein Zähler kann auch vorwärts <b>und</b> rückwärts zählen — so entsteht eine <b>Bestandszählung</b> (Blöcke im Ofen: rein +1, raus −1).</p>`,
  questions:[
    {type:'single', q:'Woher nimmt <code>S Z2</code> den Startwert?', options:['Aus AKKU1','Aus dem VKE','Er ist immer 0'], correct:0,
     explain:'Deshalb steht L … direkt davor.'},
    {type:'single', q:'Zähler auf 10 gesetzt, dann zwei Blöcke. Was steht im Zähler?', options:['8','12','2'], correct:0,
     explain:'ZR zählt zweimal herunter.',
     verifyAwl: VS('U  s\nL  10\nS  Z2\nU  b\nZR Z2\nL  Z2\nT  n', { s:false, b:false, n:0 }, [[0.1, { s:true }, { n:10 }], [0.1, { s:false, b:true }, { n:9 }], [0.1, { b:false }, {}], [0.1, { b:true }, { n:8 }]]) },
    {type:'single', q:'Was macht <code>R Z2</code>?', options:['Zählwert auf 0','Zählwert um 1 herunter','Zählwert auf den Startwert'], correct:0,
     explain:'R = Rücksetzen.'},
    {type:'single', q:'Wie zählst du Blöcke im Ofen?', options:['Rein ZV, raus ZR auf denselben Zähler','Zwei Zähler addieren','Nur ZV'], correct:0,
     explain:'Bestand = rein − raus.'},
    {type:'single', q:'Der Reset-Taster steht mit <code>UN</code> vor <code>R Z1</code>. Folge?', options:['Der Zähler wird fast immer gelöscht','Nichts'], correct:0,
     explain:'Nicht gedrückt = 1 → R löscht.'}
  ]});

defTheory({ id:'at7a', ch:7, pos:'start', title:'Laden und Transferieren', minutes:5,
  lesson:`
<pre class="code">L  Temp
T  Anzeige</pre>
<p>Die S7-300 rechnet mit zwei <b>Akkumulatoren</b>. <code>L</code> lädt einen Wert in <b>AKKU1</b>; der alte Inhalt von AKKU1 rutscht nach <b>AKKU2</b>. <code>T</code> schreibt AKKU1 in einen Operanden — AKKU1 bleibt unverändert.</p>
${ST([['L  Dicke_ein', '', '120', '0'], ['L  Dicke_aus', '', '90', '120'], ['T  Anzeige', '', '90', '120']])}
<div class="awl-note"><b>Falle:</b> <code>L</code> und <code>T</code> hängen nicht vom VKE ab. <code>U Taster / L Temp / T Anzeige</code> transferiert immer.</div>`,
  questions:[
    {type:'single', q:'<code>L 5 / L 7 / T x</code> — was steht in x?', code:'L  5\nL  7\nT  x', options:['7','5','12'], correct:0,
     explain:'Das zweite L liegt in AKKU1.',
     verifyAwl: V('L  5\nL  7\nT  x', { x:0 }, [[{}, { x:7 }]]) },
    {type:'single', q:'Wo steht nach <code>L 5 / L 7</code> die 5?', options:['In AKKU2','In AKKU1','Nirgends mehr'], correct:0,
     explain:'L schiebt den alten AKKU1 nach AKKU2.'},
    {type:'single', q:'Verändert <code>T</code> den Inhalt von AKKU1?', options:['Nein','Ja, er wird 0'], correct:0,
     explain:'Deshalb kann man einen Wert mehrfach transferieren.'},
    {type:'single', q:'<code>S_Anzeige</code> = 0. Wird die Anzeige trotzdem beschrieben?', code:'U  S_Anzeige\nL  Temp\nT  Anzeige', options:['Ja — L und T hängen nicht vom VKE ab','Nein'], correct:0,
     explain:'Bedingt transferieren geht nur mit einem Sprung.',
     verifyAwl: V('U  S_Anzeige\nL  Temp\nT  Anzeige', { S_Anzeige:false, Temp:1180, Anzeige:0 }, [[{}, { Anzeige:1180 }]]) },
    {type:'single', q:'Wie gibst du einer Variable in AWL den Wert 0?', options:['L 0 / T Variable','= 0','R Variable'], correct:0,
     explain:'Konstante laden, dann transferieren.'}
  ]});

defTheory({ id:'at7b', ch:7, pos:'mid', title:'TAK und Werte-Typen', minutes:4,
  lesson:`
<p><code>TAK</code> tauscht AKKU1 und AKKU2. So kommst du an einen Wert, der schon nach AKKU2 gerutscht ist, ohne ihn neu zu laden:</p>
<pre class="code">L  Fuehler_1
L  Fuehler_2
T  Temp_Ein
TAK
T  Temp_Aus</pre>
<p>Die Akkus sind in der S7-300 einfach 32 Bit breit — ohne Typ. Ob darin eine INT, eine REAL oder eine Zeit steht, entscheidet die <b>Anweisung</b>, die den Wert benutzt. In diesem Spiel passt der Übersetzer auf: Er meldet, wenn du eine REAL-Zahl in eine INT-Variable transferierst.</p>`,
  questions:[
    {type:'single', q:'Was steht nach dem Ablauf in <code>Temp_Aus</code>?', code:'L  Fuehler_1\nL  Fuehler_2\nT  Temp_Ein\nTAK\nT  Temp_Aus', options:['Fuehler_1','Fuehler_2'], correct:0,
     explain:'Nach TAK steht Fuehler_1 wieder in AKKU1.',
     verifyAwl: V('L  Fuehler_1\nL  Fuehler_2\nT  Temp_Ein\nTAK\nT  Temp_Aus', { Fuehler_1:10, Fuehler_2:20, Temp_Ein:0, Temp_Aus:0 }, [[{}, { Temp_Aus:10, Temp_Ein:20 }]]) },
    {type:'single', q:'Was macht <code>TAK</code>?', options:['Tauscht AKKU1 und AKKU2','Löscht beide Akkus','Addiert die Akkus'], correct:0,
     explain:'Tausch der Akkus.'},
    {type:'single', q:'Wer entscheidet in der S7-300, ob im Akku eine INT oder eine REAL steht?', options:['Die Anweisung, die den Wert benutzt','Der Akku selbst','Die Variable'], correct:0,
     explain:'+I rechnet ganzzahlig, +R mit Kommazahlen.'},
    {type:'single', q:'Wie lädst du die Zahl 1250 in AKKU1?', options:['L 1250','T 1250','= 1250'], correct:0,
     explain:'Konstanten lädt man mit L.'},
    {type:'single', q:'Kann <code>L Z1</code> einen Zählwert laden?', options:['Ja','Nein'], correct:0,
     explain:'Der Zählwert kommt als Zahl in AKKU1.'}
  ]});

defTheory({ id:'at8a', ch:8, pos:'start', title:'Ganzzahlen rechnen', minutes:5,
  lesson:`
<pre class="code">L  Dicke_ein
L  Dicke_aus
-I
T  Abnahme</pre>
<p>Gerechnet wird <b>AKKU2 op AKKU1</b>, das Ergebnis steht in AKKU1: <code>+I</code>, <code>-I</code>, <code>*I</code>, <code>/I</code> für INT, <code>MOD</code> für den Rest.</p>
${ST([['L  Dicke_ein', '', '120', '0'], ['L  Dicke_aus', '', '90', '120'], ['-I', '', '30', '120'], ['T  Abnahme', '', '30', '120']])}
<p><code>/I</code> teilt ganzzahlig und schneidet ab: 21 / 8 = 2, 21 MOD 8 = 5. <code>INC n</code> und <code>DEC n</code> ändern AKKU1 direkt, <code>NEGI</code> dreht das Vorzeichen.</p>`,
  questions:[
    {type:'single', q:'<code>L 50 / L 20 / -I</code>. Was steht in AKKU1?', code:'L  50\nL  20\n-I\nT  x', options:['30','-30','70'], correct:0,
     explain:'AKKU2 − AKKU1 = 50 − 20.',
     verifyAwl: V('L  50\nL  20\n-I\nT  x', { x:0 }, [[{}, { x:30 }]]) },
    {type:'single', q:'Was ergibt <code>L 21 / L 8 / /I</code>?', options:['2','2,625','3'], correct:0,
     explain:'Ganzzahldivision schneidet ab.',
     verifyAwl: V('L  21\nL  8\n/I\nT  x', { x:0 }, [[{}, { x:2 }]]) },
    {type:'single', q:'Was ergibt <code>L 21 / L 8 / MOD</code>?', options:['5','2','0'], correct:0,
     explain:'Der Rest von 21 : 8.',
     verifyAwl: V('L  21\nL  8\nMOD\nT  x', { x:0 }, [[{}, { x:5 }]]) },
    {type:'single', q:'Was macht <code>INC 1</code>?', options:['AKKU1 um 1 erhöhen','Den Zähler Z1 erhöhen','Das VKE auf 1 setzen'], correct:0,
     explain:'INC arbeitet auf AKKU1.'},
    {type:'single', q:'Bis zu welchem Wert reicht eine INT?', options:['32 767','999','2 147 483 647'], correct:0,
     explain:'16 Bit mit Vorzeichen. Für mehr gibt es DINT.'}
  ]});

defTheory({ id:'at8b', ch:8, pos:'mid', title:'REAL und Umwandeln', minutes:5,
  lesson:`
<p>Für Kommazahlen gibt es <code>+R</code>, <code>-R</code>, <code>*R</code>, <code>/R</code>. Beide Akkus müssen dann REAL-Zahlen enthalten.</p>
<pre class="code">L  Temp_1
L  Temp_2
+I
ITD
DTR
L  2.0
/R
T  Mittel</pre>
<p><code>ITD</code> wandelt INT in DINT, <code>DTR</code> DINT in REAL. Zurück geht es mit <code>RND</code> (runden) oder <code>TRUNC</code> (abschneiden). REAL-Konstanten schreibt man mit Punkt: <code>2.0</code>, <code>25.4</code>.</p>
<p><b>Wichtig:</b> Erst umwandeln, dann teilen — sonst schneidet <code>/I</code> die Kommastellen vorher ab.</p>`,
  questions:[
    {type:'single', q:'Welche Anweisungen machen aus einer INT eine REAL?', options:['ITD, dann DTR','RND','TRUNC'], correct:0,
     explain:'INT → DINT → REAL.'},
    {type:'single', q:'1180 und 1195 gemittelt wie oben. Ergebnis?', options:['1187,5','1187','1188'], correct:0,
     explain:'Mit /R bleiben die Kommastellen.',
     verifyAwl: V('L  Temp_1\nL  Temp_2\n+I\nITD\nDTR\nL  2.0\n/R\nT  Mittel', { Temp_1:1180, Temp_2:1195, Mittel:0 }, [[{}, { Mittel:1187.5 }]], { Mittel:'REAL' }) },
    {type:'single', q:'Was macht <code>RND</code> mit 2,6?', options:['3','2','2,6'], correct:0,
     explain:'Runden zur nächsten Ganzzahl.',
     verifyAwl: V('L  r\nRND\nT  x', { r:2.6, x:0 }, [[{}, { x:3 }]], { r:'REAL' }) },
    {type:'single', q:'Wie schreibt man die REAL-Konstante zweieinhalb?', options:['2.5','2,5','25E-1I'], correct:0,
     explain:'Mit Punkt.'},
    {type:'single', q:'Warum ergibt <code>L 25 / L 10 / /I / ITD / DTR</code> nur 2,0?', options:['/I hat die Kommastellen schon abgeschnitten','DTR rundet ab','REAL kann kein 2,5'], correct:0,
     explain:'Erst umwandeln, dann teilen.'}
  ]});

defTheory({ id:'at9a', ch:9, pos:'start', title:'Vergleiche', minutes:4,
  lesson:`
<pre class="code">L  Temp
L  1100
>=I
=  Temp_OK</pre>
<p>Ein Vergleich prüft <b>AKKU2 op AKKU1</b> und bildet daraus ein <b>neues VKE</b>: <code>==I</code>, <code>&lt;&gt;I</code>, <code>&gt;I</code>, <code>&lt;I</code>, <code>&gt;=I</code>, <code>&lt;=I</code>. Für Kommazahlen die Endung <code>R</code>.</p>
<p>An der Grenze entscheidet das Gleichheitszeichen: <code>&gt;I</code> ist bei 1100 falsch, <code>&gt;=I</code> ist wahr.</p>`,
  questions:[
    {type:'single', q:'<code>Temp</code> = 1100. Was ist <code>Temp_OK</code>?', code:'L  Temp\nL  1100\n>=I\n=  Temp_OK', options:['1','0'], correct:0,
     explain:'1100 ≥ 1100.',
     verifyAwl: V('L  Temp\nL  1100\n>=I\n=  Temp_OK', { Temp:1100, Temp_OK:false }, [[{}, { Temp_OK:true }]]) },
    {type:'single', q:'Welche Werte vergleicht <code>&gt;I</code>?', options:['AKKU2 > AKKU1','AKKU1 > AKKU2','VKE > AKKU1'], correct:0,
     explain:'Der zuerst geladene Wert steht links.'},
    {type:'single', q:'Welche Endung haben Vergleiche für Kommazahlen?', options:['R','I','D'], correct:0,
     explain:'REAL.'},
    {type:'single', q:'Was ist das Ergebnis eines Vergleichs?', options:['Ein VKE (Bit)','Eine Zahl in AKKU1','Ein Sprung'], correct:0,
     explain:'Das Ergebnis ist ein VKE.'},
    {type:'input', q:'Wie heisst der Vergleich „ungleich“ für INT?', answer:['<>I','<>i'],
     explain:'<>I'}
  ]});

defTheory({ id:'at9b', ch:9, pos:'mid', title:'Vergleiche verknüpfen', minutes:5,
  lesson:`
<p>Ein Vergleich <b>überschreibt</b> das VKE — er verknüpft nicht mit der Kette davor. Soll er Teil einer UND-Kette sein, steht er in einer Klammer:</p>
<pre class="code">U  S_Walzen
U(
L  Temp
L  1100
>=I
)
=  Walzen</pre>
<p>Ein <b>Fenster</b> (Wert zwischen zwei Grenzen) sind zwei Vergleiche in zwei Klammern. Ein <b>Zweipunktregler mit Hysterese</b> setzt bei der unteren Grenze und setzt bei der oberen zurück.</p>`,
  questions:[
    {type:'single', q:'<code>S_Walzen</code> = 0, <code>Temp</code> = 1150. Was ist <code>Walzen</code> <b>ohne</b> Klammer?', code:'U  S_Walzen\nL  Temp\nL  1100\n>=I\n=  Walzen', options:['1 — der Vergleich überschreibt das VKE','0'], correct:0,
     explain:'Ohne Klammer zählt nur noch der Vergleich.',
     verifyAwl: V('U  S_Walzen\nL  Temp\nL  1100\n>=I\n=  Walzen', { S_Walzen:false, Temp:1150, Walzen:false }, [[{}, { Walzen:true }]]) },
    {type:'single', q:'Und <b>mit</b> Klammer?', code:'U  S_Walzen\nU(\nL  Temp\nL  1100\n>=I\n)\n=  Walzen', options:['0','1'], correct:0,
     explain:'Die Klammer verknüpft mit UND.',
     verifyAwl: V('U  S_Walzen\nU(\nL  Temp\nL  1100\n>=I\n)\n=  Walzen', { S_Walzen:false, Temp:1150, Walzen:true }, [[{}, { Walzen:false }]]) },
    {type:'single', q:'Wie prüfst du „zwischen 1100 und 1250“?', options:['Zwei Vergleiche in zwei Klammern mit UND','Ein Vergleich mit ==I','Mit MOD'], correct:0,
     explain:'Untere und obere Grenze.'},
    {type:'single', q:'Warum hat ein Zweipunktregler zwei Grenzen?', options:['Damit die Heizung nicht dauernd schaltet','Damit er schneller ist','Weil S und R es verlangen'], correct:0,
     explain:'Die Hysterese verhindert Flattern.'},
    {type:'single', q:'Zwischen den Grenzen eines Reglers mit S/R: was macht die Heizung?', options:['Sie bleibt, wie sie ist','Sie geht aus','Sie geht an'], correct:0,
     explain:'Der Speicher hält den letzten Zustand.'}
  ]});

defTheory({ id:'at10a', ch:10, pos:'start', title:'Sprünge', minutes:5,
  lesson:`
<pre class="code">U  S_Temp
SPBN ENDE
L  Temp
T  Anzeige
ENDE: NOP 0</pre>
<p>Eine <b>Sprungmarke</b> steht mit Doppelpunkt vor einer Anweisung. <code>SPB</code> springt zur Marke, wenn das VKE 1 ist, <code>SPBN</code>, wenn es 0 ist, <code>SPA</code> springt immer. Übersprungene Zeilen werden nicht bearbeitet — im Status bleiben sie leer.</p>
<p>Nach einem bedingten Sprung ist das VKE 1 und eine neue Kette beginnt.</p>
<p>Mit Sprüngen führst du <b>L</b> und <b>T</b> bedingt aus — anders geht das in AWL nicht.</p>`,
  questions:[
    {type:'single', q:'Wann springt <code>SPBN</code>?', options:['Wenn das VKE 0 ist','Wenn das VKE 1 ist','Immer'], correct:0,
     explain:'N = nicht.'},
    {type:'single', q:'<code>S_Temp</code> = 0. Wird die Anzeige beschrieben?', code:'U  S_Temp\nSPBN ENDE\nL  Temp\nT  Anzeige\nENDE: NOP 0', options:['Nein','Ja'], correct:0,
     explain:'SPBN springt über L und T hinweg.',
     verifyAwl: V('U  S_Temp\nSPBN ENDE\nL  Temp\nT  Anzeige\nENDE: NOP 0', { S_Temp:false, Temp:1180, Anzeige:0 }, [[{}, { Anzeige:0 }]]) },
    {type:'single', q:'Wozu braucht man <code>SPA</code> in einer Verzweigung?', options:['Um am Ende des ersten Zweigs über den zweiten zu springen','Um das Programm zu beenden','Um zu zählen'], correct:0,
     explain:'Sonst laufen beide Zweige.'},
    {type:'single', q:'Wie sieht eine Sprungmarke aus?', options:['ENDE: vor einer Anweisung','[ENDE]','#ENDE'], correct:0,
     explain:'Name mit Doppelpunkt.'},
    {type:'single', q:'Was zeigt der Status bei übersprungenen Zeilen?', options:['Nichts','Das letzte VKE','Eine Fehlermeldung'], correct:0,
     explain:'Nicht bearbeitet = kein Status.'}
  ]});

defTheory({ id:'at10b', ch:10, pos:'mid', title:'Schleifen und Baustein-Ende', minutes:5,
  lesson:`
<pre class="code">L  0
T  Summe
L  8
NEXT: T  Zaehler
L  Summe
L  Pro_Platz
+I
T  Summe
L  Zaehler
LOOP NEXT</pre>
<p><code>LOOP</code> zieht 1 von AKKU1 ab und springt zurück, solange das Ergebnis nicht 0 ist. Den Schleifenzähler rettest du in eine Variable, weil die Akkus für die Rechnung gebraucht werden.</p>
<p><code>BEA</code> beendet den Baustein sofort, <code>BEB</code> nur bei VKE 1. Mehrere Vergleiche mit je einem <code>SPB</code> ergeben einen <b>Sprungverteiler</b> — wie CASE in SCL.</p>`,
  questions:[
    {type:'single', q:'Wie oft wird der Schleifenrumpf bei <code>L 8</code> durchlaufen?', options:['8-mal','7-mal','9-mal'], correct:0,
     explain:'LOOP zählt von 8 bis 0 herunter.',
     verifyAwl: V('L  0\nT  Summe\nL  8\nNEXT: T  Zaehler\nL  Summe\nL  1\n+I\nT  Summe\nL  Zaehler\nLOOP NEXT', { Summe:0, Zaehler:0 }, [[{}, { Summe:8 }]]) },
    {type:'single', q:'Was macht <code>BEA</code>?', options:['Beendet den Baustein sofort','Beendet nur die Kette','Springt an den Anfang'], correct:0,
     explain:'Baustein-Ende absolut.'},
    {type:'single', q:'Wann beendet <code>BEB</code> den Baustein?', options:['Wenn das VKE 1 ist','Wenn das VKE 0 ist','Immer'], correct:0,
     explain:'Bedingtes Baustein-Ende.'},
    {type:'single', q:'Was entspricht in SCL einem Sprungverteiler?', options:['CASE','FOR','REPEAT'], correct:0,
     explain:'Auswahl nach einem Wert.'},
    {type:'single', q:'Warum wird der Schleifenzähler in eine Variable transferiert?', options:['Weil AKKU1 in der Schleife für die Rechnung gebraucht wird','Weil LOOP das verlangt','Damit die Schleife schneller läuft'], correct:0,
     explain:'Vor LOOP wird er wieder geladen.'}
  ]});
})();
