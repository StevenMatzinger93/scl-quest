/* ===== AWL QUEST: Theorie-Aufträge Profi-Stufe (Kapitel 11–15) =====
   <pre class="code"> darf einen ganzen Baustein enthalten (Kopf + AWL-Rumpf).
   verifyAwlPro: { blocks:[Quelle…], globals, steps, ask, value, warn } — der Validator prüft die Aussage mit der Engine. */
(function(){
const FC_A = 'FUNCTION "FC_Freigabe" : Void\nVAR_INPUT\n   S_Walzen : Bool;\n   Gitter_zu : Bool;\nEND_VAR\nVAR_OUTPUT\n   Frei : Bool;\nEND_VAR\nBEGIN\nU  #S_Walzen\nU  #Gitter_zu\n=  #Frei\nEND_FUNCTION';
const MAIN_A = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nCALL "FC_Freigabe"\n   S_Walzen := "S_Walzen"\n   Gitter_zu := "Gitter_zu"\n   Frei => "Walzen"\nEND_ORGANIZATION_BLOCK';

defTheory({ id:'at11a', ch:11, pos:'start', title:'Bausteine und Schnittstelle', minutes:5,
  lesson:`
<p>Willkommen in der <b>Profi-Stufe</b>. Ein S7-Programm besteht aus <b>Bausteinen</b>, und jeder Baustein hat eine <b>Schnittstelle</b>:</p>
<table><tr><th>Bereich</th><th>Bedeutung</th></tr>
<tr><td>Input</td><td>Werte, die hereinkommen</td></tr><tr><td>Output</td><td>Werte, die hinausgehen</td></tr>
<tr><td>InOut</td><td>Variable des Aufrufers, wird gelesen und geschrieben</td></tr>
<tr><td>Temp</td><td>Zwischenwerte, nur während des Aufrufs</td></tr><tr><td>Static</td><td>Gedächtnis (nur im FB)</td></tr></table>
<p>Im Baustein heissen die Variablen <code>#Name</code>. Globale PLC-Variablen stehen in Anführungszeichen: <code>"Gitter_zu"</code>.</p>
<pre class="code">${FC_A}</pre>
<p>Eine <b>Funktion (FC)</b> hat <b>kein Gedächtnis</b>: Bei jedem Aufruf rechnet sie aus den Eingängen die Ausgänge neu.</p>`,
  questions:[
    {type:'single', q:'Wie heisst die lokale Variable <code>Gitter_zu</code> im Baustein?', options:['#Gitter_zu','"Gitter_zu"','Gitter_zu()'], correct:0,
     explain:'Lokale Variablen mit #, globale in Anführungszeichen.'},
    {type:'single', q:'In welchen Bereich gehört ein Wert, den der Baustein nur liest?', options:['Input','Output','Static'], correct:0,
     explain:'Eingänge kommen herein und werden gelesen.'},
    {type:'single', q:'Was ist das Besondere an einer FC?', options:['Sie hat kein Gedächtnis zwischen zwei Aufrufen','Sie läuft nur einmal beim Anlauf','Sie darf keine Ausgänge haben'], correct:0,
     explain:'Eine FC rechnet jedes Mal neu aus ihren Eingängen.'},
    {type:'single', q:'Wo steht der AWL-Code eines Bausteins?', options:['Nach BEGIN','Vor VAR_INPUT','In der Variablentabelle'], correct:0,
     explain:'Oben die Deklaration, nach BEGIN die Anweisungen.'},
    {type:'multi', q:'Welche Bereiche gibt es in der Schnittstelle einer FC? (alle richtigen)', options:['Input','Output','Temp','Static'], correct:[0,1,2],
     explain:'Static (Gedächtnis) gibt es nur im FB.'}
  ]});

defTheory({ id:'at11b', ch:11, pos:'mid', title:'CALL, RET_VAL, Temp', minutes:5,
  lesson:`
<p>Ein Baustein läuft nur, wenn ihn jemand <b>aufruft</b>:</p>
<pre class="code">${MAIN_A}</pre>
<p>Unter <code>CALL</code> steht je Parameter eine Zeile: <code>:=</code> für Eingänge, <code>=&gt;</code> für Ausgänge. <code>CALL</code> hängt nicht vom VKE ab.</p>
<h4>Rückgabewert</h4>
<p>Eine FC kann einen <b>Rückgabewert</b> haben (z. B. <code>: Int</code>). Im Baustein schreibst du ihn mit <code>T #Ret_Val</code>, beim Aufruf holst du ihn mit <code>RET_VAL := "Ziel"</code>.</p>
<h4>Temp und S/R</h4>
<p><b>Temp</b>-Variablen: zuerst schreiben, dann lesen (sonst Warnung <i>TEMP_READ_BEFORE_WRITE</i>). Ausgänge einer FC schreibst du mit <code>=</code>, nicht mit S/R (Warnung <i>OUT_NOT_ALL_PATHS</i>).</p>`,
  questions:[
    {type:'single', q:'Was bedeutet <code>Frei => "Walzen"</code> beim CALL?', options:['Der Ausgang Frei wird in die PLC-Variable geschrieben','Die PLC-Variable wird in den Eingang gelesen','Frei wird gelöscht'], correct:0,
     explain:'=> für Ausgänge, := für Eingänge.'},
    {type:'single', q:'<code>"S_Walzen"</code> = 1, <code>"Gitter_zu"</code> = 0. Was steht danach in <code>"Walzen"</code>?', code: MAIN_A, options:['0','1'], correct:0,
     explain:'Die FC verknüpft beide Eingänge mit UND.',
     verifyAwlPro:{ blocks:[FC_A, MAIN_A], globals:{ S_Walzen:true, Gitter_zu:false, Walzen:true }, ask:'Walzen', value:false }},
    {type:'single', q:'Wie schreibst du im Baustein den Rückgabewert?', options:['T #Ret_Val','= RET_VAL','CALL RET_VAL'], correct:0,
     explain:'Transferieren nach #Ret_Val.'},
    {type:'single', q:'Warum gehört <code>S #Lampe</code> nicht in eine FC?', options:['Ohne VKE 1 würde der Ausgang nicht geschrieben — eine FC hat kein Gedächtnis','S ist in Bausteinen verboten','Das ist üblich und richtig'], correct:0,
     explain:'Zum Speichern braucht es einen FB.'},
    {type:'input', q:'Mit welchem Parameter holst du beim CALL den Rückgabewert?', answer:['RET_VAL','Ret_Val','ret_val'],
     explain:'RET_VAL := Ziel'}
  ]});

const FB_H = 'FUNCTION_BLOCK "FB_Antrieb"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\nEND_VAR\nVAR_OUTPUT\n   Laeuft : Bool;\nEND_VAR\nBEGIN\nU(\nO  #Start\nO  #Laeuft\n)\nUN #Stopp\n=  #Laeuft\nEND_FUNCTION_BLOCK';
const MAIN_H = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nCALL "FB_Antrieb", "FB_Antrieb_DB"\n   Start := "S_Start"\n   Stopp := "S_Stopp"\n   Laeuft => "Rollgang"\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'at12a', ch:12, pos:'start', title:'Funktionsbaustein und Instanz', minutes:5,
  lesson:`
<p>Ein <b>Funktionsbaustein (FB)</b> hat ein Gedächtnis: seine <b>Instanz</b>. Ausgänge und Static-Variablen bleiben von Zyklus zu Zyklus erhalten — darum funktionieren Selbsthaltung, S/R und Flanken.</p>
<pre class="code">${FB_H}</pre>
<p>Beim Aufruf gibst du den <b>Instanz-DB</b> an:</p>
<pre class="code">${MAIN_H}</pre>
<p>Zwei Antriebe = zwei Instanzen (<code>"Rollgang_DB"</code>, <code>"Pumpe_DB"</code>). Dieselbe Instanz zweimal aufrufen führt zur Warnung <i>INSTANCE_TWICE</i>. Flankenmerker legst du als <b>Static</b> an.</p>`,
  questions:[
    {type:'single', q:'Was unterscheidet einen FB von einer FC?', options:['Der FB hat ein Gedächtnis (Instanz)','Der FB darf keine Eingänge haben','Der FB läuft schneller'], correct:0,
     explain:'Die Instanz speichert Ausgänge und Static-Variablen.'},
    {type:'single', q:'<code>"S_Start"</code> war kurz 1, jetzt sind beide Taster 0. Was ist <code>"Rollgang"</code>?', code: MAIN_H, options:['1 (Selbsthaltung in der Instanz)','0'], correct:0,
     explain:'Der Ausgang Laeuft bleibt in der Instanz gespeichert.',
     verifyAwlPro:{ blocks:[FB_H, MAIN_H], globals:{ S_Start:false, S_Stopp:false, Rollgang:false }, steps:[[0.1, { S_Start:true }], [0.1, { S_Start:false }]], ask:'Rollgang', value:true }},
    {type:'single', q:'Wie ruft man einen FB auf?', options:['CALL "FB_Antrieb", "FB_Antrieb_DB"','CALL "FB_Antrieb"','CALL "FB_Antrieb_DB"'], correct:0,
     explain:'Baustein und Instanz-DB, durch Komma getrennt.'},
    {type:'single', q:'Wo legst du den Flankenmerker für FP in einem FB an?', options:['Static','Temp','Output'], correct:0,
     explain:'Er muss den alten Zustand über den Aufruf hinaus behalten.'},
    {type:'input', q:'Welche Warnung meldet der Compiler, wenn dieselbe Instanz zweimal aufgerufen wird?', answer:['INSTANCE_TWICE','instance_twice'],
     explain:'INSTANCE_TWICE'}
  ]});

const FB_T = 'FUNCTION_BLOCK "FB_Kuehlung"\nVAR_INPUT\n   Walzen : Bool;\nEND_VAR\nVAR_OUTPUT\n   Wasser : Bool;\nEND_VAR\nVAR\n   T_Nachlauf : TOF;\nEND_VAR\nBEGIN\nCALL #T_Nachlauf\n   IN := #Walzen\n   PT := T#5S\n   Q => #Wasser\nEND_FUNCTION_BLOCK';
const MAIN_T = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nCALL "FB_Kuehlung", "FB_Kuehlung_DB"\n   Walzen := "Walzen"\n   Wasser => "Kuehlung"\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'at12b', ch:12, pos:'mid', title:'IEC-Zeiten und Multiinstanzen', minutes:5,
  lesson:`
<p>In Bausteinen verwendest du statt der S5-Zeiten die <b>IEC-Zeiten</b> TON, TOF, TP (und die Zähler CTU, CTD). Sie sind selbst kleine FBs. Als <b>Static</b> deklariert, liegen ihre Daten in der Instanz deines FB: eine <b>Multiinstanz</b>.</p>
<pre class="code">${FB_T}</pre>
<p>Aufruf mit <code>CALL #Name</code>, Parameter <code>IN</code>, <code>PT</code>, <code>Q</code>, <code>ET</code>. Den Ausgang kannst du auch direkt abfragen: <code>U #T_Nachlauf.Q</code>.</p>
<p>Eigene FBs lassen sich genauso einbetten: Static <code>Rollgang : "FB_Antrieb"</code>, Aufruf <code>CALL #Rollgang</code>. Jede Zeit braucht ihre <b>eigene</b> Instanz.</p>`,
  questions:[
    {type:'single', q:'Wo wird eine IEC-Zeit im FB deklariert?', options:['Als Static-Variable (z. B. T_Nachlauf : TOF)','Als Temp-Variable','Gar nicht'], correct:0,
     explain:'Static — sonst würde die Zeit nach jedem Aufruf vergessen.'},
    {type:'single', q:'Das Gerüst stoppt. Wie lange läuft das Wasser noch?', code: FB_T, options:['5 s','0 s','Solange Walzen 1 ist'], correct:0,
     explain:'TOF: Ausschaltverzögerung um PT.',
     verifyAwlPro:{ blocks:[FB_T, MAIN_T], globals:{ Walzen:false, Kuehlung:false }, steps:[[0.1, { Walzen:true }], [0.1, { Walzen:false }], [4, {}]], ask:'Kuehlung', value:true }},
    {type:'single', q:'Wie fragst du den Ausgang Q der Multiinstanz <code>#T_RM</code> ab?', options:['U #T_RM.Q','U T_RM','U "T_RM".Q'], correct:0,
     explain:'Punkt-Schreibweise auf die lokale Instanz.'},
    {type:'single', q:'Warum gibt es in Bausteinen keine S5-Zeiten T1, T2 …?', options:['Sie sind global — ein Standardbaustein braucht eigene Zeiten pro Instanz','Sie sind zu ungenau','Sie gibt es nur in OB100'], correct:0,
     explain:'Zwei Instanzen würden sich sonst eine Zeit teilen.'},
    {type:'single', q:'Ein FB enthält zwei Multiinstanzen. Wie viele Instanz-DBs braucht die Anlage dafür?', options:['Einen — den des äusseren FB','Drei','Zwei'], correct:0,
     explain:'Multiinstanzen liegen in der Instanz des aufrufenden FB.'}
  ]});

const DB_D = 'DATA_BLOCK "DB_Statistik"\nVAR\n   Temp_max : Int;\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
const MAIN_D = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nL  "Temp"\nL  "DB_Statistik".Temp_max\n>I\nSPBN ENDE\nL  "Temp"\nT  "DB_Statistik".Temp_max\nENDE: NOP 0\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'at13a', ch:13, pos:'start', title:'Globale Datenbausteine', minutes:4,
  lesson:`
<p>Ein <b>globaler Datenbaustein (DB)</b> speichert Daten, die das ganze Programm braucht: Zähler, Grenzwerte, Statistik. Zugriff mit <code>"DB_Name".Variable</code> — mit denselben Anweisungen wie auf jede andere Variable.</p>
<pre class="code">${MAIN_D}</pre>
<p>Einstellwerte (Grenzwerte, Zeiten) gehören in einen <b>Parameter-DB</b> und werden über die Schnittstelle an Bausteine übergeben — nicht als feste Zahl in den Code.</p>
<p>In alten S7-300-Programmen findest du auch absolute Zugriffe wie <code>L DB10.DBW 4</code> — symbolisch ist lesbarer und sicherer.</p>`,
  questions:[
    {type:'single', q:'Wie lädst du <code>Temp_max</code> aus dem DB <code>DB_Statistik</code>?', options:['L "DB_Statistik".Temp_max','L #DB_Statistik.Temp_max','L Temp_max'], correct:0,
     explain:'DB-Name in Anführungszeichen, dann Punkt.'},
    {type:'single', q:'Temperaturen 1150, dann 1210, dann 1180. Was steht danach in <code>Temp_max</code>?', code: MAIN_D, options:['1210','1180','1150'], correct:0,
     explain:'Der Transfer läuft nur, wenn der neue Wert grösser ist.',
     verifyAwlPro:{ blocks:[DB_D, MAIN_D], globals:{ Temp:0 }, steps:[[0.1, { Temp:1150 }], [0.1, { Temp:1210 }], [0.1, { Temp:1180 }]], ask:'DB_Statistik.Temp_max', value:1210 }},
    {type:'single', q:'Wo gehört eine Mindesttemperatur hin, die je nach Stahl anders ist?', options:['In einen Parameter-DB','Als Zahl in den Code','In eine Temp-Variable'], correct:0,
     explain:'So kann sie geändert werden, ohne das Programm anzupassen.'},
    {type:'single', q:'Behält ein Wert im globalen DB seinen Inhalt über mehrere Zyklen?', options:['Ja','Nein, er wird jeden Zyklus gelöscht'], correct:0,
     explain:'DB-Werte bleiben erhalten — anders als Temp.'},
    {type:'single', q:'Was ist lesbarer: <code>L "DB_Stich".Spalt[1]</code> oder <code>L DB12.DBW 0</code>?', options:['Der symbolische Zugriff','Der absolute Zugriff'], correct:0,
     explain:'Symbolische Namen sagen, was gemeint ist.'}
  ]});

defTheory({ id:'at13b', ch:13, pos:'mid', title:'PLC-Datentypen und Arrays', minutes:5,
  lesson:`
<p>Ein <b>PLC-Datentyp</b> (UDT) fasst zusammengehörige Werte zusammen:</p>
<pre class="code">TYPE "UDT_Geruest"
STRUCT
   Ein : Bool;
   Stoerung : Bool;
   Spalt : Int;
END_STRUCT;
END_TYPE</pre>
<p>Im DB: <code>G1 : "UDT_Geruest"</code>. Zugriff: <code>U "DB_Walzen".G1.Ein</code>. Als Bausteinparameter: <code>G : "UDT_Geruest"</code> → im Baustein <code>U #G.Ein</code>.</p>
<h4>Arrays</h4>
<p>Ein <b>Array</b> ist eine nummerierte Reihe: <code>Spalt : Array[1..3] of Int</code>. In AWL mit fester Nummer: <code>L "DB_Stich".Spalt[2]</code>. Auch Strukturen lassen sich reihen: <code>Stich : Array[1..3] of "UDT_Stich"</code>.</p>
<p>Mit einem <b>Sprungverteiler</b> wählst du je nach Nummer den passenden Abschnitt — so holt man in AWL „das n-te Element“.</p>`,
  questions:[
    {type:'single', q:'Wie greifst du auf den Spalt von Stich 2 im Array zu?', options:['"DB_Stichplan".Stich[2].Spalt','"DB_Stichplan".Spalt[2].Stich','"DB_Stichplan".Stich.Spalt[2]'], correct:0,
     explain:'Erst das Array-Element, dann das Strukturelement.'},
    {type:'single', q:'Wozu dient ein PLC-Datentyp?', options:['Zusammengehörige Werte unter einem Namen bündeln','Programme schneller machen','Zeiten ersetzen'], correct:0,
     explain:'Ein Gerüst = ein Datensatz mit allen seinen Werten.'},
    {type:'single', q:'<code>Array[1..3] of Int</code> — welcher Index ist ungültig?', options:['0','1','3'], correct:0,
     explain:'Die Grenzen 1..3 gehören zum Typ.'},
    {type:'single', q:'Ein FC-Input hat den Typ <code>"UDT_Geruest"</code>. Wie fragst du darin „Ein“ ab?', options:['U #G.Ein','U "G".Ein','U Ein'], correct:0,
     explain:'Lokaler Parameter mit #, dann Punkt.'},
    {type:'single', q:'Was entspricht in SCL einem AWL-Sprungverteiler?', options:['CASE','FOR','WHILE'], correct:0,
     explain:'Auswahl nach einer Zahl.'}
  ]});

defTheory({ id:'at14a', ch:14, pos:'start', title:'Standardbausteine', minutes:4,
  lesson:`
<p>Ein <b>Standardbaustein</b> wird einmal gebaut und überall eingesetzt: Antrieb, Rollgang, Ofenregler, Meldung. Regeln:</p>
<ul><li>Alles, was er braucht, kommt über die <b>Schnittstelle</b> — kein direkter Zugriff auf globale Variablen (Warnung <i>GLOBAL_ACCESS</i>).</li>
<li>Befehl, Freigabe, Rückmeldung, <b>Überwachung</b> und Störung gehören zusammen in den Baustein.</li>
<li>Keine festen Zahlen: Sollwerte und Zeiten kommen als Parameter.</li></ul>
<p>Die Ausgänge eines FB kannst du überall aus der Instanz lesen: <code>"FB_Ofen_DB".Temp_OK</code>. Die <b>Aufrufreihenfolge</b> entscheidet, ob der Wert aus diesem oder dem letzten Zyklus stammt.</p>`,
  questions:[
    {type:'single', q:'Ein Standard-Antrieb liest direkt <code>"Not_Aus_Halle_2"</code>. Was ist das Problem?', options:['Er funktioniert nur in dieser einen Anlage','Gar keins','Er wird zu gross'], correct:0,
     explain:'Die Freigabe gehört als Input in die Schnittstelle.'},
    {type:'single', q:'Wie liest du den Ausgang <code>Temp_OK</code> der Instanz <code>"FB_Ofen_DB"</code>?', options:['"FB_Ofen_DB".Temp_OK','#Temp_OK','"Temp_OK"'], correct:0,
     explain:'Instanz-DB-Name, Punkt, Ausgang.'},
    {type:'single', q:'Der Ofen wird im OB1 <b>nach</b> dem Gerüst aufgerufen, das seine Freigabe liest. Folge?', options:['Das Gerüst reagiert einen Zyklus zu spät','Keine','Das Gerüst läuft nie'], correct:0,
     explain:'Es liest den Wert des letzten Zyklus.'},
    {type:'single', q:'Was gehört in einen Antriebsbaustein?', options:['Befehl, Freigabe, Rückmeldung, Überwachung, Störung','Nur der Motorausgang','Die ganze Walzstrasse'], correct:0,
     explain:'Alles, was zum Antrieb gehört — nicht mehr.'},
    {type:'input', q:'Welche Warnung zeigt einen direkten Zugriff eines Bausteins auf globale Variablen an?', answer:['GLOBAL_ACCESS','global_access'],
     explain:'GLOBAL_ACCESS'}
  ]});

const FB_IO = 'FUNCTION_BLOCK "FB_Zaehler"\nVAR_INPUT\n   Block : Bool;\nEND_VAR\nVAR_IN_OUT\n   Summe : Int;\nEND_VAR\nVAR\n   M_Flanke : Bool;\nEND_VAR\nBEGIN\nU  #Block\nFP #M_Flanke\nSPBN ENDE\nL  #Summe\nINC 1\nT  #Summe\nENDE: NOP 0\nEND_FUNCTION_BLOCK';
const MAIN_IO = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nCALL "FB_Zaehler", "L1_DB"\n   Block := "B1"\n   Summe := "Summe"\nCALL "FB_Zaehler", "L2_DB"\n   Block := "B2"\n   Summe := "Summe"\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'at14b', ch:14, pos:'mid', title:'FC oder FB, Input oder InOut', minutes:5,
  lesson:`
<p><b>FC</b> für reine Verknüpfungen und Berechnungen (Betriebsart, Umrechnung, Statuscode). <b>FB</b> für alles mit Gedächtnis (Speicher, Flanken, Zeiten, Zähler).</p>
<h4>InOut</h4>
<p>Ein <b>InOut</b>-Parameter verweist auf die Variable des Aufrufers: Der Baustein liest sie <b>und</b> schreibt sie zurück. So können zwei Instanzen gemeinsam einen Zähler erhöhen.</p>
<pre class="code">${FB_IO}</pre>
<h4>Meldeprinzip</h4>
<p>Neue Störung = <b>blinkt</b>, quittiert und noch anstehend = <b>Dauerlicht</b>, gegangen und quittiert = <b>aus</b>.</p>`,
  questions:[
    {type:'single', q:'Die Umschaltung Hand/Automatik muss sich nichts merken. Welcher Baustein?', options:['FC','FB'], correct:0,
     explain:'Ohne Gedächtnis reicht eine FC.'},
    {type:'single', q:'Beide Linien melden je einen Block. Was steht in <code>"Summe"</code>?', code: MAIN_IO, options:['2','1','0'], correct:0,
     explain:'Beide Instanzen schreiben über InOut in dieselbe Variable.',
     verifyAwlPro:{ blocks:[FB_IO, MAIN_IO], globals:{ B1:false, B2:false, Summe:0 }, instances:{ L1_DB:'FB_Zaehler', L2_DB:'FB_Zaehler' }, steps:[[0.1, { B1:true }], [0.1, { B1:false, B2:true }], [0.1, { B2:false }]], ask:'Summe', value:2 }},
    {type:'single', q:'Was macht ein InOut-Parameter?', options:['Er liest und schreibt die Variable des Aufrufers','Er ist nur ein Eingang','Er ist nur ein Ausgang'], correct:0,
     explain:'Übergabe per Verweis.'},
    {type:'single', q:'Eine neue Störung ist gerade gekommen, noch nicht quittiert. Die Meldelampe …', options:['blinkt','leuchtet dauernd','ist aus'], correct:0,
     explain:'Neu = blinkt.'},
    {type:'single', q:'Die Störung wurde quittiert, steht aber noch an. Die Lampe …', options:['leuchtet dauernd','blinkt','ist aus'], correct:0,
     explain:'Quittiert und anstehend = Dauerlicht.'}
  ]});

const OB100 = 'ORGANIZATION_BLOCK "Startup"\nBEGIN\nL  0\nT  "Bloecke"\nEND_ORGANIZATION_BLOCK';
const OB1 = 'ORGANIZATION_BLOCK "Main"\nBEGIN\nL  "Bloecke"\nT  "Anzeige"\nEND_ORGANIZATION_BLOCK';
defTheory({ id:'at15a', ch:15, pos:'start', title:'OB1 und OB100', minutes:5,
  lesson:`
<p>Die SPS ruft <b>Organisationsbausteine</b> auf:</p>
<ul><li><b>OB100</b> (Anlauf, „Startup“) — genau einmal beim Übergang STOP → RUN. Hier kommt die <b>Grundstellung</b> hin.</li>
<li><b>OB1</b> (zyklisch, „Main“) — in jedem Zyklus. Er ist das <b>Inhaltsverzeichnis</b>: nur Aufrufe, in der Reihenfolge des Signalflusses.</li></ul>
<pre class="code">${OB100}</pre>
<p>Reihenfolge im OB1: Sicherung → Ablauf → Antriebe → Anzeige. So reagiert jedes Signal noch im selben Zyklus.</p>
<p>Auf der S7-300 gibt es weitere OBs, etwa OB35 (Weckalarm, alle 100 ms) oder OB82 (Diagnosealarm) — die kennt dieses Spiel nicht, aber du wirst ihnen begegnen.</p>`,
  questions:[
    {type:'single', q:'Wie oft läuft der OB100?', options:['Einmal beim Anlauf','In jedem Zyklus','Nie, er ist nur Reserve'], correct:0,
     explain:'Anlauf = einmal beim Übergang STOP → RUN.'},
    {type:'single', q:'<code>"Bloecke"</code> hatte vor dem Anlauf den Wert 57. Was zeigt <code>"Anzeige"</code> nach dem ersten Zyklus?', code: OB100, options:['0','57'], correct:0,
     explain:'Der Anlauf setzt den Zähler auf 0, bevor der OB1 zum ersten Mal läuft.',
     verifyAwlPro:{ blocks:[OB100, OB1], globals:{ Bloecke:57, Anzeige:0 }, ask:'Anzeige', value:0 }},
    {type:'single', q:'<code>L 0 / T "Bloecke"</code> steht im OB1. Folge?', options:['Der Zähler wird in jedem Zyklus gelöscht','Er wird einmal gelöscht','Nichts'], correct:0,
     explain:'Was im OB1 steht, passiert jeden Zyklus.'},
    {type:'single', q:'Was gehört in den OB1 eines sauberen Programms?', options:['Vor allem Bausteinaufrufe','Dreitausend Zeilen AWL','Nichts'], correct:0,
     explain:'Der OB1 ist das Inhaltsverzeichnis.'},
    {type:'single', q:'In welcher Reihenfolge ruft der OB1 die Bausteine auf?', options:['Sicherung → Ablauf → Antriebe → Anzeige','Anzeige → Antriebe → Sicherung','Alphabetisch'], correct:0,
     explain:'Der Reihenfolge des Signalflusses folgen.'}
  ]});

const WARN_FB = 'FUNCTION_BLOCK "FB_X"\nVAR_INPUT\n   A : Bool;\nEND_VAR\nVAR_OUTPUT\n   Q : Bool;\nEND_VAR\nVAR\n   Reserve : Int;\nEND_VAR\nBEGIN\nU  #A\n=  #Q\nEND_FUNCTION_BLOCK';
defTheory({ id:'at15b', ch:15, pos:'mid', title:'Standard, Abnahme, Migration', minutes:5,
  lesson:`
<p>Bevor eine Anlage in Betrieb geht, wird das Programm <b>abgenommen</b>. Typische Regeln:</p>
<ul><li><b>Keine Warnungen</b> (unbenutzte Variablen, Temp gelesen vor geschrieben, globale Zugriffe, doppelte Instanzen).</li>
<li>Präfixe <code>FB_</code>, <code>FC_</code>, <code>DB_</code>, <code>UDT_</code>; Netzwerktitel; Kommentare an der Schnittstelle.</li>
<li>Konstanten an Parametern (<code>FALSE</code>, <code>0</code>) werden hinterfragt.</li>
<li>Sprünge sparsam, mit sprechenden Marken.</li></ul>
<h4>Migration</h4>
<p>Die <b>S7-1200 kann kein AWL</b>, die S7-1500 nur eingeschränkt. Beim Umbau überträgt man AWL nach SCL: <code>U a / U b / = q</code> wird <code>q := a AND b;</code>, ein Sprungverteiler wird ein <code>CASE</code>, eine S5-Zeit eine IEC-Zeit. Wer AWL lesen kann, versteht das alte Programm — und kann es sicher übertragen.</p>`,
  questions:[
    {type:'single', q:'Ein FB deklariert <code>Reserve : Int</code>, benutzt sie aber nie. Was meldet der Compiler?', code: WARN_FB, options:['Eine Warnung (unbenutzte Variable)','Einen Fehler','Nichts'], correct:0,
     explain:'UNUSED_VAR — Unordnung, die ein Standard nicht zulässt.',
     verifyAwlPro:{ blocks:[WARN_FB, 'ORGANIZATION_BLOCK "Main"\nBEGIN\nCALL "FB_X", "FB_X_DB"\n   A := "E"\n   Q => "L"\nEND_ORGANIZATION_BLOCK'], globals:{ E:true, L:false }, ask:'L', value:true, warn:'UNUSED_VAR' }},
    {type:'single', q:'Wie heisst <code>U a / U b / = q</code> in SCL?', options:['q := a AND b;','q := a OR b;','IF a THEN q := b;'], correct:0,
     explain:'Eine UND-Kette mit Zuweisung.'},
    {type:'single', q:'Auf welche Steuerung kann man ein AWL-Programm <b>nicht</b> einfach übernehmen?', options:['S7-1200','S7-400','S7-300'], correct:0,
     explain:'Die S7-1200 kennt kein AWL.'},
    {type:'single', q:'Am Sicherungsbaustein steht <code>Quittieren := FALSE</code>. Folge?', options:['Eine Störung kann nie quittiert werden','Die Sicherung ist immer OK','Nichts'], correct:0,
     explain:'Konstanten an Parametern immer hinterfragen.'},
    {type:'multi', q:'Was gehört zu einem guten Programmierstandard? (alle richtigen)', options:['Warnungsfrei','Netzwerktitel und Kommentare','Präfixe wie FB_ und DB_','Möglichst viel Code im OB1'], correct:[0,1,2],
     explain:'Der OB1 soll schlank bleiben.'}
  ]});
})();
