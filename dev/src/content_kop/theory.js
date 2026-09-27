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
})();
