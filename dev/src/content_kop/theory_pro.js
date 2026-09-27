/* ===== KOP QUEST: Theorie-Aufträge Profi-Stufe (Kapitel 11–15) =====
   <pre class="kop"> darf einen ganzen Baustein enthalten (Kopf + Netzwerke).
   verifyKopPro: { blocks:[Quelle…], globals, steps, ask, value } — der Validator prüft die Aussage mit der Engine. */
(function(){
const FC_A = 'FUNCTION "FC_Freigabe" : Void\nVAR_INPUT\n   Tuer_Zu : Bool;\n   Seil_OK : Bool;\nEND_VAR\nVAR_OUTPUT\n   Freigabe : Bool;\nEND_VAR\nBEGIN\nNETWORK Freigabe\n#Tuer_Zu AND #Seil_OK => #Freigabe;\nEND_FUNCTION';
const MAIN_A = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK Freigabe\n=> "FC_Freigabe"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Freigabe => "Freigabe");\nEND_ORGANIZATION_BLOCK';

defTheory({ id:'kt11a', ch:11, pos:'start', title:'Bausteine und Schnittstelle', minutes:5,
  lesson:`
<p>Willkommen in der <b>Profi-Stufe</b>. Bisher waren alle Variablen schon angelegt. Im TIA Portal besteht ein Programm aus <b>Bausteinen</b>, und jeder Baustein hat eine <b>Schnittstelle</b>:</p>
<table><tr><th>Bereich</th><th>Bedeutung</th></tr>
<tr><td>Input</td><td>Werte, die hereinkommen</td></tr>
<tr><td>Output</td><td>Werte, die hinausgehen</td></tr>
<tr><td>InOut</td><td>Variable des Aufrufers, wird gelesen und geschrieben</td></tr>
<tr><td>Temp</td><td>Zwischenwerte, nur während des Aufrufs</td></tr>
<tr><td>Static</td><td>Gedächtnis (nur im FB)</td></tr></table>
<p>Im Baustein heissen die Variablen <code>#Name</code>. Globale PLC-Variablen stehen in Anführungszeichen: <code>"Tuer_Zu"</code>.</p>
<pre class="kop">${FC_A}</pre>
<p>Eine <b>Funktion (FC)</b> hat <b>kein Gedächtnis</b>: Bei jedem Aufruf rechnet sie aus den Eingängen die Ausgänge neu.</p>`,
  questions:[
    {type:'single', q:'Wie heisst die lokale Variable <code>Tuer_Zu</code> im Netzwerk eines Bausteins?', options:['#Tuer_Zu','"Tuer_Zu"','Tuer_Zu()'], correct:0,
     explain:'Lokale Variablen mit #, globale in Anführungszeichen.'},
    {type:'single', q:'In welchen Bereich gehört ein Wert, den der Baustein nur liest?', options:['Input','Output','Static'], correct:0,
     explain:'Eingänge kommen herein und werden gelesen.'},
    {type:'single', q:'Was ist das Besondere an einer FC?', options:['Sie hat kein Gedächtnis zwischen zwei Aufrufen','Sie läuft nur einmal beim Anlauf','Sie darf keine Ausgänge haben'], correct:0,
     explain:'Eine FC rechnet jedes Mal neu aus ihren Eingängen.'},
    {type:'single', q:'Wo wird der Wert <code>"Tuer_Zu"</code> gespeichert?', options:['In der PLC-Variablentabelle (global)','Nur im Baustein','Im Netzwerktitel'], correct:0,
     explain:'Anführungszeichen = globale PLC-Variable.'},
    {type:'multi', q:'Welche Bereiche gibt es in der Schnittstelle einer FC? (alle richtigen)', options:['Input','Output','Temp','Static'], correct:[0,1,2],
     explain:'Static (Gedächtnis) gibt es nur im FB.'}
  ]});

defTheory({ id:'kt11b', ch:11, pos:'mid', title:'Aufruf, Rückgabewert, Temp', minutes:5,
  lesson:`
<p>Ein Baustein läuft nur, wenn ihn jemand <b>aufruft</b>. Im Kontaktplan ist das eine <b>Aufruf-Box</b>: <code>Eingang := Signal</code>, <code>Ausgang => Signal</code>.</p>
<pre class="kop">${MAIN_A}</pre>
<h4>Rückgabewert</h4>
<p>Eine FC kann einen <b>Rückgabewert</b> haben (<code>Ret_Val</code>, z. B. vom Typ Real). Er muss in jedem Aufruf geschrieben werden.</p>
<h4>Temp</h4>
<p><b>Temp</b>-Variablen gelten nur während des Aufrufs. Zuerst schreiben, dann lesen — sonst warnt der Compiler (<i>TEMP_READ_BEFORE_WRITE</i>).</p>
<h4>Keine S/R-Spulen auf FC-Ausgänge</h4>
<p>Eine S- oder R-Spule schreibt nur bei Stromfluss. In einer FC bliebe der Ausgang sonst unbestimmt (<i>OUT_NOT_ALL_PATHS</i>). Speichern kann nur der FB.</p>`,
  questions:[
    {type:'single', q:'Was bedeutet <code>Freigabe => "Freigabe"</code> in der Aufruf-Box?', options:['Der Ausgang Freigabe wird in die PLC-Variable geschrieben','Die PLC-Variable wird in den Eingang gelesen','Freigabe wird gelöscht'], correct:0,
     explain:'=> für Ausgänge, := für Eingänge.'},
    {type:'single', q:'<code>"Tuer_Zu"</code> = 1, <code>"Seil_OK"</code> = 0. Was steht nach dem Zyklus in <code>"Freigabe"</code>?', kop: MAIN_A, options:['0','1'], correct:0,
     explain:'Die FC verknüpft beide Eingänge mit UND.',
     verifyKopPro:{ blocks:[FC_A, MAIN_A], globals:{ Tuer_Zu:true, Seil_OK:false, Freigabe:true }, ask:'Freigabe', value:false }},
    {type:'single', q:'Eine Temp-Variable wird in Netzwerk 1 gelesen und erst in Netzwerk 2 geschrieben. Was passiert?', options:['Der Compiler warnt: gelesen, bevor geschrieben','Alles in Ordnung','Die SPS geht in STOP'], correct:0,
     explain:'Temp hat zu Beginn keinen verlässlichen Wert.'},
    {type:'single', q:'Warum gehören S/R-Spulen nicht auf FC-Ausgänge?', options:['Ohne Stromfluss würde der Ausgang nicht geschrieben — eine FC hat kein Gedächtnis','Weil S/R nur in OB1 erlaubt sind','Das ist erlaubt und üblich'], correct:0,
     explain:'Zum Speichern braucht es einen FB.'},
    {type:'input', q:'Wie heisst der Rückgabewert einer FC in der Aufruf-Box?', answer:['Ret_Val','RET_VAL','ret_val'],
     explain:'Ret_Val'}
  ]});

const FB_H = 'FUNCTION_BLOCK "FB_Antrieb"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\nEND_VAR\nVAR_OUTPUT\n   Laeuft : Bool;\nEND_VAR\nBEGIN\nNETWORK Selbsthaltung\n(#Start OR #Laeuft) AND NOT #Stopp => #Laeuft;\nEND_FUNCTION_BLOCK';
const MAIN_H = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK Antrieb\n=> "FB_Antrieb_DB"(Start := "S_Start", Stopp := "S_Stopp", Laeuft => "Antrieb");\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'kt12a', ch:12, pos:'start', title:'Funktionsbaustein und Instanz', minutes:5,
  lesson:`
<p>Ein <b>Funktionsbaustein (FB)</b> hat ein Gedächtnis: seine <b>Instanz</b>. Ausgänge und statische Variablen bleiben von Zyklus zu Zyklus erhalten — darum funktionieren Selbsthaltung, S/R, Flanken und Timer.</p>
<pre class="kop">${FB_H}</pre>
<p>Beim Aufruf gibt man die Instanz an, z. B. den <b>Instanz-DB</b> <code>"FB_Antrieb_DB"</code>:</p>
<pre class="kop">${MAIN_H}</pre>
<p>Zwei Antriebe = zwei Instanzen (<code>"Antrieb_DB"</code>, <code>"Licht_DB"</code>). Dieselbe Instanz zweimal aufrufen führt zur Warnung <i>INSTANCE_TWICE</i>.</p>`,
  questions:[
    {type:'single', q:'Was unterscheidet einen FB von einer FC?', options:['Der FB hat ein Gedächtnis (Instanz)','Der FB darf keine Eingänge haben','Der FB läuft schneller'], correct:0,
     explain:'Die Instanz speichert Ausgänge und statische Variablen.'},
    {type:'single', q:'<code>"S_Start"</code> war kurz 1, jetzt sind beide Taster 0. Was ist <code>"Antrieb"</code>?', kop: MAIN_H, options:['1 (Selbsthaltung in der Instanz)','0'], correct:0,
     explain:'Der Ausgang Laeuft bleibt in der Instanz gespeichert.',
     verifyKopPro:{ blocks:[FB_H, MAIN_H], globals:{ S_Start:false, S_Stopp:false, Antrieb:false }, steps:[[0.1, { S_Start:true }], [0.1, { S_Start:false }]], ask:'Antrieb', value:true }},
    {type:'single', q:'Zwei Förderbänder sollen denselben FB benutzen. Was brauchst du?', options:['Zwei Instanzen','Eine Instanz, zweimal aufgerufen','Zwei Kopien des FB'], correct:0,
     explain:'Jedes Gerät hat sein eigenes Gedächtnis.'},
    {type:'single', q:'Welche Elemente brauchen ein Gedächtnis und gehören deshalb in einen FB? (Wähle die beste Antwort)', options:['Flanken, Timer, Zähler, S/R','Nur Vergleicher','Nur Spulen'], correct:0,
     explain:'Alles, was sich etwas über den Zyklus hinaus merken muss.'},
    {type:'input', q:'Welche Warnung meldet der Compiler, wenn dieselbe Instanz zweimal aufgerufen wird?', answer:['INSTANCE_TWICE','instance_twice'],
     explain:'INSTANCE_TWICE'}
  ]});

const FB_T = 'FUNCTION_BLOCK "FB_Tuer"\nVAR_INPUT\n   Kabine_da : Bool;\nEND_VAR\nVAR_OUTPUT\n   Tuer_Auf : Bool;\nEND_VAR\nVAR\n   T_Tuer : TON;\nEND_VAR\nBEGIN\nNETWORK Tuer oeffnen\n#Kabine_da AND TON(#T_Tuer, T#2S) => #Tuer_Auf;\nEND_FUNCTION_BLOCK';
const MAIN_T = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK Tuer\n=> "FB_Tuer_DB"(Kabine_da := "Kabine_da", Tuer_Auf => "Tuer_Auf");\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'kt12b', ch:12, pos:'mid', title:'Multiinstanzen', minutes:5,
  lesson:`
<p>Timer und Zähler sind selbst kleine FBs. Im eigenen FB deklariert man sie als <b>Static</b>-Variable — dann liegen ihre Daten in der Instanz des FB: eine <b>Multiinstanz</b>.</p>
<pre class="kop">${FB_T}</pre>
<p>Genauso lassen sich eigene FBs einbetten: <code>Tuer_Berg : "FB_Tuer"</code> und im Netzwerk <code>#Tuer_Berg(Kabine_da := …)</code>. Ausgänge liest man als <code>#Tuer_Berg.Tuer_Auf</code>.</p>
<p>Wichtig: Jede Zeit braucht ihren <b>eigenen</b> Timer. Ein Timer, der zweimal pro Zyklus aufgerufen wird, läuft nie sauber ab.</p>`,
  questions:[
    {type:'single', q:'Wo wird ein Timer in einem FB deklariert?', options:['Als Static-Variable (z. B. T_Tuer : TON)','Als Temp-Variable','Gar nicht, Timer brauchen keine Deklaration'], correct:0,
     explain:'Static — sonst würde die abgelaufene Zeit nach jedem Aufruf vergessen.'},
    {type:'single', q:'Kabine seit 3 s da, PT = 2 s. Was ist <code>"Tuer_Auf"</code>?', kop: FB_T, options:['1','0'], correct:0,
     explain:'Der TON in der Instanz ist abgelaufen.',
     verifyKopPro:{ blocks:[FB_T, MAIN_T], globals:{ Kabine_da:false, Tuer_Auf:false }, steps:[[0.1, { Kabine_da:true }], [1.5, {}], [1.5, {}]], ask:'Tuer_Auf', value:true }},
    {type:'single', q:'Warum soll eine Timer-Instanz nur einmal pro Zyklus aufgerufen werden?', options:['Der zweite Aufruf setzt den ersten zurück','Weil es sonst zu langsam wird','Das ist egal'], correct:0,
     explain:'Ein Timer misst genau eine Zeit.'},
    {type:'single', q:'Wie liest du den Ausgang <code>Tuer_Auf</code> der Multiinstanz <code>#Tuer_Berg</code>?', options:['#Tuer_Berg.Tuer_Auf','"Tuer_Berg".Tuer_Auf','Tuer_Auf'], correct:0,
     explain:'Punkt-Schreibweise auf die lokale Instanz.'},
    {type:'single', q:'Ein FB enthält zwei Multiinstanzen. Wie viele Instanz-DBs braucht die Anlage dafür?', options:['Einen — den des äusseren FB','Drei','Zwei'], correct:0,
     explain:'Multiinstanzen liegen in der Instanz des aufrufenden FB.'}
  ]});

const DB_D = 'DATA_BLOCK "DB_Station"\nVAR\n   Wind_Max : Int;\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
const MAIN_D = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK Tagesmaximum\n["Wind_kmh" > "DB_Station".Wind_Max] => MOVE("Wind_kmh", "DB_Station".Wind_Max);\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'kt13a', ch:13, pos:'start', title:'Globale Datenbausteine', minutes:4,
  lesson:`
<p>Ein <b>globaler Datenbaustein (DB)</b> speichert Daten, die das ganze Programm braucht: Zähler, Grenzwerte, Statistik. Zugriff mit <code>"DB_Name".Variable</code>.</p>
<pre class="kop">${MAIN_D}</pre>
<p>Einstellwerte (Grenzwerte, Zeiten) gehören in einen <b>Parameter-DB</b> und werden über die Schnittstelle an Bausteine übergeben — nicht als feste Zahl ins Netzwerk.</p>`,
  questions:[
    {type:'single', q:'Wie greifst du auf <code>Wind_Max</code> im DB <code>DB_Station</code> zu?', options:['"DB_Station".Wind_Max','#DB_Station.Wind_Max','Wind_Max'], correct:0,
     explain:'DB-Name in Anführungszeichen, dann Punkt.'},
    {type:'single', q:'Wind: 30, dann 55, dann 20 km/h. Was steht danach in <code>Wind_Max</code>?', kop: MAIN_D, options:['55','20','30'], correct:0,
     explain:'Der MOVE läuft nur, wenn der neue Wert grösser ist.',
     verifyKopPro:{ blocks:[DB_D, MAIN_D], globals:{ Wind_kmh:0 }, steps:[[0.1, { Wind_kmh:30 }], [0.1, { Wind_kmh:55 }], [0.1, { Wind_kmh:20 }]], ask:'DB_Station.Wind_Max', value:55 }},
    {type:'single', q:'Wo gehört eine Windgrenze hin, die im Winter anders ist als im Sommer?', options:['In einen Parameter-DB','Als Zahl ins Netzwerk','In eine Temp-Variable'], correct:0,
     explain:'So kann sie geändert werden, ohne das Programm anzupassen.'},
    {type:'single', q:'Behält ein Wert im globalen DB seinen Inhalt über mehrere Zyklen?', options:['Ja','Nein, er wird jeden Zyklus gelöscht'], correct:0,
     explain:'DB-Werte bleiben erhalten — anders als Temp.'},
    {type:'single', q:'Wer darf einen globalen DB lesen?', options:['Jeder Baustein','Nur OB1','Nur der FB, der ihn angelegt hat'], correct:0,
     explain:'Global = überall sichtbar. Standardbausteine bekommen die Werte trotzdem besser über die Schnittstelle.'}
  ]});

defTheory({ id:'kt13b', ch:13, pos:'mid', title:'PLC-Datentypen und Arrays', minutes:5,
  lesson:`
<p>Ein <b>PLC-Datentyp</b> (UDT) fasst zusammengehörige Werte zusammen:</p>
<pre class="code">TYPE "UDT_Kabine"
STRUCT
   Nummer : Int;
   Tuer_Zu : Bool;
   Gaeste : Int;
END_STRUCT;
END_TYPE</pre>
<p>Im DB: <code>K1 : "UDT_Kabine"</code>. Zugriff: <code>"DB_Kabinen".K1.Gaeste</code>. Als Bausteinparameter: <code>Kabine : "UDT_Kabine"</code> → im Baustein <code>#Kabine.Tuer_Zu</code>.</p>
<h4>Arrays</h4>
<p>Ein <b>Array</b> ist eine nummerierte Reihe: <code>Besetzt : Array[1..4] of Bool</code>. Im Kontaktplan mit fester Nummer: <code>"DB_Bahnsteig".Besetzt[3]</code>. Auch Strukturen lassen sich reihen: <code>Kabine : Array[1..2] of "UDT_Kabine"</code>.</p>
<p><b>MOVE</b> kopiert auch ganze Strukturen — wenn Quelle und Ziel denselben Typ haben.</p>`,
  questions:[
    {type:'single', q:'Wie greifst du auf die Gäste der Kabine 2 im Array zu?', options:['"DB_Station".Kabine[2].Gaeste','"DB_Station".Gaeste[2].Kabine','"DB_Station".Kabine.Gaeste[2]'], correct:0,
     explain:'Erst das Array-Element, dann das Strukturelement.'},
    {type:'single', q:'Wozu dient ein PLC-Datentyp?', options:['Zusammengehörige Werte unter einem Namen bündeln','Programme schneller machen','Timer ersetzen'], correct:0,
     explain:'Eine Kabine = ein Datensatz mit allen ihren Werten.'},
    {type:'single', q:'Darf MOVE eine ganze Struktur kopieren?', options:['Ja, wenn Quelle und Ziel denselben Typ haben','Nein, nur einzelne Zahlen','Nur in einer FC'], correct:0,
     explain:'Alle Elemente werden auf einmal kopiert.'},
    {type:'single', q:'<code>Array[1..4] of Bool</code> — welcher Index ist ungültig?', options:['0','1','4'], correct:0,
     explain:'Die Grenzen 1..4 gehören zum Typ.'},
    {type:'single', q:'Ein FC-Input hat den Typ <code>"UDT_Kabine"</code>. Wie liest du darin die Tür?', options:['#Kabine.Tuer_Zu','"Kabine".Tuer_Zu','Tuer_Zu'], correct:0,
     explain:'Lokaler Parameter mit #, dann Punkt.'}
  ]});

defTheory({ id:'kt14a', ch:14, pos:'start', title:'Standardbausteine', minutes:4,
  lesson:`
<p>Ein <b>Standardbaustein</b> wird einmal gebaut und überall eingesetzt: Tür, Sicherheitskette, Antrieb, Meldung. Regeln:</p>
<ul><li>Alles, was er braucht, kommt über die <b>Schnittstelle</b> — kein direkter Zugriff auf globale Variablen (Warnung <i>GLOBAL_ACCESS</i>).</li>
<li>Befehl, Freigabe, Rückmeldung, <b>Überwachung</b> und Störung gehören zusammen in den Baustein.</li>
<li>Gut kommentierte Schnittstelle: Wer ihn einsetzt, muss das Innenleben nicht kennen.</li></ul>
<p>Die Ausgänge eines FB kann man überall aus der Instanz lesen: <code>"FB_Kette_DB".OK</code>. Die <b>Aufrufreihenfolge</b> entscheidet, ob der Wert aus diesem oder dem letzten Zyklus stammt.</p>`,
  questions:[
    {type:'single', q:'Ein Standard-Antrieb liest direkt die globale Variable <code>"Not_Halt_OK"</code>. Was ist das Problem?', options:['Er funktioniert nur in dieser einen Anlage','Gar keins','Er wird zu gross'], correct:0,
     explain:'Der Not-Halt gehört als Input in die Schnittstelle.'},
    {type:'single', q:'Wie liest du den Ausgang <code>OK</code> der Instanz <code>"FB_Kette_DB"</code>?', options:['"FB_Kette_DB".OK','#OK','"OK"'], correct:0,
     explain:'Instanz-DB-Name, Punkt, Ausgang.'},
    {type:'single', q:'Die Kette wird im OB1 <b>nach</b> dem Antrieb aufgerufen. Folge?', options:['Der Antrieb reagiert einen Zyklus zu spät auf die Kette','Keine','Der Antrieb läuft nie'], correct:0,
     explain:'Er liest den OK-Wert des letzten Zyklus.'},
    {type:'single', q:'Was gehört in einen Türbaustein?', options:['Befehl, Freigabe, Rückmeldung, Überwachung, Störung','Nur der Ausgang','Die ganze Station'], correct:0,
     explain:'Alles, was zur Tür gehört — nicht mehr.'},
    {type:'input', q:'Welche Warnung zeigt einen direkten Zugriff eines Bausteins auf globale Variablen an?', answer:['GLOBAL_ACCESS','global_access'],
     explain:'GLOBAL_ACCESS'}
  ]});

const FB_IO = 'FUNCTION_BLOCK "FB_Drehkreuz"\nVAR_INPUT\n   Drehkreuz : Bool;\nEND_VAR\nVAR_IN_OUT\n   Gaeste_Tag : Int;\nEND_VAR\nBEGIN\nNETWORK Zaehlen\nP(#Drehkreuz) => INC(#Gaeste_Tag);\nEND_FUNCTION_BLOCK';
const MAIN_IO = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK Drehkreuz 1\n=> "D1_DB"(Drehkreuz := "D1", Gaeste_Tag := "Summe");\n\nNETWORK Drehkreuz 2\n=> "D2_DB"(Drehkreuz := "D2", Gaeste_Tag := "Summe");\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'kt14b', ch:14, pos:'mid', title:'FC oder FB, Input oder InOut', minutes:5,
  lesson:`
<p><b>FC</b> für reine Verknüpfungen und Berechnungen (Betriebsart, Umrechnung, Statuscode). <b>FB</b> für alles mit Gedächtnis (Speicher, Flanken, Zeiten, Zähler).</p>
<h4>InOut</h4>
<p>Ein <b>InOut</b>-Parameter verweist auf die Variable des Aufrufers: Der Baustein liest sie <b>und</b> schreibt sie zurück. So können zwei Instanzen gemeinsam einen Zähler erhöhen.</p>
<pre class="kop">${FB_IO}</pre>
<h4>Meldeprinzip</h4>
<p>Neue Störung = <b>blinkt</b>, quittiert und noch anstehend = <b>Dauerlicht</b>, gegangen und quittiert = <b>aus</b>.</p>`,
  questions:[
    {type:'single', q:'Die Umschaltung Hand/Automatik muss sich nichts merken. Welcher Baustein?', options:['FC','FB'], correct:0,
     explain:'Ohne Gedächtnis reicht eine FC.'},
    {type:'single', q:'Beide Drehkreuze werden je einmal gedreht. Was steht in <code>"Summe"</code>?', kop: MAIN_IO, options:['2','1','0'], correct:0,
     explain:'Beide Instanzen schreiben über InOut in dieselbe Variable.',
     verifyKopPro:{ blocks:[FB_IO, MAIN_IO], globals:{ D1:false, D2:false, Summe:0 }, instances:{ D1_DB:'FB_Drehkreuz', D2_DB:'FB_Drehkreuz' }, steps:[[0.1, { D1:true }], [0.1, { D1:false, D2:true }], [0.1, { D2:false }]], ask:'Summe', value:2 }},
    {type:'single', q:'Was macht ein InOut-Parameter?', options:['Er liest und schreibt die Variable des Aufrufers','Er ist nur ein Eingang','Er ist nur ein Ausgang'], correct:0,
     explain:'Übergabe per Verweis.'},
    {type:'single', q:'Eine neue Störung ist gerade gekommen, noch nicht quittiert. Die Meldelampe …', options:['blinkt','leuchtet dauernd','ist aus'], correct:0,
     explain:'Neu = blinkt.'},
    {type:'single', q:'Die Störung wurde quittiert, steht aber noch an. Die Lampe …', options:['leuchtet dauernd','blinkt','ist aus'], correct:0,
     explain:'Quittiert und anstehend = Dauerlicht.'}
  ]});

const OB100 = 'ORGANIZATION_BLOCK "Startup"\nBEGIN\nNETWORK Zaehler auf null\n=> MOVE(0, "Fahrten");\nEND_ORGANIZATION_BLOCK';
const OB1 = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK Anzeige\n=> MOVE("Fahrten", "Anzeige");\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'kt15a', ch:15, pos:'start', title:'OB1 und OB100', minutes:5,
  lesson:`
<p>Die SPS ruft <b>Organisationsbausteine</b> auf:</p>
<ul><li><b>OB100</b> (Anlauf, „Startup“) — genau einmal beim Übergang STOP → RUN. Hier kommt die <b>Grundstellung</b> hin.</li>
<li><b>OB1</b> (zyklisch, „Main“) — in jedem Zyklus. Er ist das <b>Inhaltsverzeichnis</b>: nur Aufrufe, in der Reihenfolge des Signalflusses.</li></ul>
<pre class="kop">${OB100}</pre>
<p>Reihenfolge im OB1: Eingänge → Sicherheit → Ablauf → Antriebe → Anzeige. So reagiert jedes Signal noch im selben Zyklus.</p>`,
  questions:[
    {type:'single', q:'Wie oft läuft der OB100?', options:['Einmal beim Anlauf','In jedem Zyklus','Nie, er ist nur Reserve'], correct:0,
     explain:'Anlauf = einmal beim Übergang STOP → RUN.'},
    {type:'single', q:'<code>"Fahrten"</code> hatte vor dem Anlauf den Wert 57. Was zeigt <code>"Anzeige"</code> nach dem ersten Zyklus?', kop: OB100, options:['0','57'], correct:0,
     explain:'Der Anlauf setzt den Zähler auf 0, bevor der OB1 zum ersten Mal läuft.',
     verifyKopPro:{ blocks:[OB100, OB1], globals:{ Fahrten:57, Anzeige:0 }, ask:'Anzeige', value:0 }},
    {type:'single', q:'Ein Rücksetzen „Zähler := 0“ steht im OB1. Folge?', options:['Der Zähler wird in jedem Zyklus gelöscht','Er wird einmal gelöscht','Nichts'], correct:0,
     explain:'Was im OB1 steht, passiert jeden Zyklus.'},
    {type:'single', q:'Was gehört in den OB1 eines sauberen Programms?', options:['Vor allem Bausteinaufrufe','Die ganze Logik in einem Netzwerk','Nichts'], correct:0,
     explain:'Der OB1 ist das Inhaltsverzeichnis.'},
    {type:'single', q:'In welcher Reihenfolge ruft der OB1 die Bausteine auf?', options:['Sicherheit → Ablauf → Antriebe → Anzeige','Anzeige → Antriebe → Sicherheit','Alphabetisch'], correct:0,
     explain:'Der Reihenfolge des Signalflusses folgen.'}
  ]});

const WARN_FB = 'FUNCTION_BLOCK "FB_X"\nVAR_INPUT\n   A : Bool;\nEND_VAR\nVAR_OUTPUT\n   Q : Bool;\nEND_VAR\nVAR\n   Reserve : Int;\nEND_VAR\nBEGIN\nNETWORK Q\n#A => #Q;\nEND_FUNCTION_BLOCK';
defTheory({ id:'kt15b', ch:15, pos:'mid', title:'Programmierstandard und Abnahme', minutes:4,
  lesson:`
<p>Bevor eine Anlage in Betrieb geht, wird das Programm <b>abgenommen</b>. Typische Regeln eines Programmierstandards:</p>
<ul><li><b>Keine Warnungen</b> (unbenutzte Variablen, Temp gelesen vor geschrieben, globale Zugriffe, doppelte Instanzen).</li>
<li>Sprechende Namen mit Präfix: <code>FB_</code>, <code>FC_</code>, <code>DB_</code>, <code>UDT_</code>.</li>
<li>Jedes Netzwerk hat einen <b>Titel</b>, jede Schnittstellenvariable einen <b>Kommentar</b>.</li>
<li>Konstanten an Parametern (<code>FALSE</code>, <code>0</code>) werden hinterfragt.</li>
<li>Einstellwerte im Parameter-DB, Grundstellung im OB100.</li></ul>
<p>Mehrere MOVEs auf dasselbe Ziel ergeben eine Rangfolge: Das letzte Netzwerk mit Stromfluss gewinnt.</p>`,
  questions:[
    {type:'single', q:'Ein Baustein deklariert <code>Reserve : Int</code>, benutzt sie aber nie. Was meldet der Compiler?', kop: WARN_FB, options:['Eine Warnung (unbenutzte Variable)','Einen Fehler','Nichts'], correct:0,
     explain:'UNUSED_VAR — Unordnung, die ein Standard nicht zulässt.',
     verifyKopPro:{ blocks:[WARN_FB, 'ORGANIZATION_BLOCK "Main"\nBEGIN\nNETWORK X\n=> "FB_X_DB"(A := "E", Q => "L");\nEND_ORGANIZATION_BLOCK'], globals:{ E:true, L:false }, ask:'L', value:true, warn:'UNUSED_VAR' }},
    {type:'single', q:'Am Kettenbaustein steht <code>Quittieren := FALSE</code>. Was ist die Folge?', options:['Eine Störung kann nie quittiert werden','Die Kette ist immer OK','Nichts'], correct:0,
     explain:'Konstanten an Parametern immer hinterfragen.'},
    {type:'single', q:'Drei Netzwerke: MOVE 0, bei Fahrt MOVE 1, bei Störung MOVE 2. Fahrt und Störung sind 1. Ergebnis?', options:['2','1','0'], correct:0,
     explain:'Das letzte Netzwerk mit Stromfluss gewinnt.'},
    {type:'multi', q:'Was gehört zu einem guten Programmierstandard? (alle richtigen)', options:['Warnungsfrei','Netzwerktitel und Kommentare','Präfixe wie FB_ und DB_','Möglichst viel Logik im OB1'], correct:[0,1,2],
     explain:'Der OB1 soll schlank bleiben.'},
    {type:'single', q:'Wozu dienen Warnungen?', options:['Sie zeigen mögliche Fehler und Unordnung','Sie sind nur Dekoration','Sie verlangsamen die SPS'], correct:0,
     explain:'Ein warnungsfreies Programm macht neue Warnungen sofort sichtbar.'}
  ]});
})();
