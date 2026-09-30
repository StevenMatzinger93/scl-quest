/* ===== KOP QUEST · KAPITEL 11 — Bausteine: FC, Schnittstelle, Aufruf-Box (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const CHAIN = ['chainDoor=Tuer_Zu', 'chainRope=Seil_OK', 'chainStop=Not_Halt_OK'];
const FREIGABE_D = { in:'Tuer_Zu:Bool|Türen geschlossen; Seil_OK:Bool|Seil in der Rolle; Not_Halt_OK:Bool|Not-Halt nicht gedrückt', out:'Freigabe:Bool|Fahrt erlaubt' };
const FREIGABE_NW = 'NETWORK Freigabe\n#Tuer_Zu AND #Seil_OK AND #Not_Halt_OK => #Freigabe;';
const CALL_FREIGABE = 'NETWORK Freigabe Station\n=> "FC_Freigabe"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Freigabe => "Freigabe");';
const G3 = { Tuer_Zu:false, Seil_OK:false, Not_Halt_OK:false, Freigabe:false };

defKopPro({ id:'k11_erste_fc', ch:11, title:'Die erste Funktion',
  story:'Der Werkmeister öffnet das Projekt der Talstation: „Alles in einem OB, kein Wunder, dass ARIA sich darin versteckt.“ Im neuen Baustein <code>FC_Freigabe</code> steht die Schnittstelle schon, der Rumpf ist leer.',
  brief:'Zeichne im Baustein <code>FC_Freigabe</code> ein Netzwerk: <code>#Tuer_Zu</code>, <code>#Seil_OK</code> und <code>#Not_Halt_OK</code> in Reihe → Spule <code>#Freigabe</code>.<br>Lokale Variablen (aus der Schnittstelle) beginnen mit <code>#</code> — du findest sie links in der Variablenliste. <code>Main</code> (🔒) ruft die Funktion auf und verbindet sie mit den Signalen der Station.',
  learn:'Einen Baustein mit Schnittstelle programmieren: lokale Variablen mit #.',
  take:'Ein Baustein arbeitet nur mit seiner <b>Schnittstelle</b>: Eingänge (Input) kommen herein, Ausgänge (Output) gehen hinaus. Im Baustein heissen sie <code>#Name</code>, draussen verbindet der Aufruf sie mit echten Signalen.',
  man:'bausteine', must:['SERIES'],
  hint:'+ Netzwerk, dann wie in der Grundstufe: drei Kontakte in Reihe, eine Spule. Die Variablen heissen hier #Tuer_Zu usw.',
  blocks:[
    { name:'FC_Freigabe', kind:'FC', edit:true, start: kFC('FC_Freigabe', 'Void', FREIGABE_D, ''), ref: kFC('FC_Freigabe', 'Void', FREIGABE_D, FREIGABE_NW) },
    { name:'Main', kind:'OB', src: MAIN(CALL_FREIGABE) }
  ],
  globals: G3, comments:{ Tuer_Zu:'Endschalter Türen zu', Seil_OK:'Seilüberwachung', Not_Halt_OK:'Not-Halt-Kreis', Freigabe:'Freigabe Antrieb' },
  unit:[{ block:'FC_Freigabe', steps: truth(['Tuer_Zu','Seil_OK','Not_Halt_OK'], e => ({ Freigabe: e.Tuer_Zu && e.Seil_OK && e.Not_Halt_OK })) }],
  tests:[[{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true }, { Freigabe:true }], [{ Tuer_Zu:true, Seil_OK:false, Not_Halt_OK:true }, { Freigabe:false }]],
  bind: CHAIN.concat(['lightGreen=Freigabe']) });

defKopPro({ id:'k11_schnittstelle', ch:11, title:'Die Schnittstelle',
  story:'Der nächste Baustein, <code>FC_Wind</code>, hat ein fertiges Netzwerk — aber ARIA hat die Schnittstelle gelöscht. Ohne Deklaration kennt die SPS keine einzige Variable.',
  brief:'Öffne die <b>Tabelle</b> (Schnittstelle) und lege an:<br>• Input <code>Wind_kmh</code> : <code>Int</code><br>• Input <code>Grenze</code> : <code>Int</code><br>• Output <code>Wind_Stopp</code> : <code>Bool</code><br>Das Netzwerk <code>[#Wind_kmh &gt; #Grenze] => #Wind_Stopp</code> steht schon.',
  learn:'Die Schnittstelle in der Deklarationstabelle anlegen: Bereich, Name, Datentyp.',
  take:'Jede lokale Variable steht in der Schnittstelle mit <b>Bereich</b> (Input, Output, InOut, Temp …), <b>Name</b> und <b>Datentyp</b>. Erst dann darf das Netzwerk sie benutzen.',
  man:'bausteine', must:['VAR_INPUT','VAR_OUTPUT','INT'],
  hint:'Knopf <b>Tabelle</b> über dem Editor → „Zeile hinzufügen“. Bereich Input, Name Wind_kmh, Typ Int usw.',
  blocks:[
    { name:'FC_Wind', kind:'FC', edit:true, start: kFC('FC_Wind', 'Void', {}, 'NETWORK Windgrenze\n[#Wind_kmh > #Grenze] => #Wind_Stopp;'),
      ref: kFC('FC_Wind', 'Void', { in:'Wind_kmh:Int|Messwert Anemometer; Grenze:Int|Abschaltgrenze', out:'Wind_Stopp:Bool' }, 'NETWORK Windgrenze\n[#Wind_kmh > #Grenze] => #Wind_Stopp;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Windueberwachung\n=> "FC_Wind"(Wind_kmh := "Wind_kmh", Grenze := 60, Wind_Stopp => "Wind_Stopp");') }
  ],
  globals:{ Wind_kmh:0, Wind_Stopp:false }, comments:{ Wind_kmh:'Anemometer km/h' },
  unit:[{ block:'FC_Wind', steps:[[{ Wind_kmh:30, Grenze:60 }, { Wind_Stopp:false }], [{ Wind_kmh:61, Grenze:60 }, { Wind_Stopp:true }], [{ Wind_kmh:61, Grenze:70 }, { Wind_Stopp:false }]] }],
  tests:[[{ Wind_kmh:75 }, { Wind_Stopp:true }], [{ Wind_kmh:60 }, { Wind_Stopp:false }]],
  wrong:[{ FC_Wind: kFC('FC_Wind', 'Void', { in:'Wind_kmh:Int; Grenze:Int', out:'Wind_Stopp:Int' }, 'NETWORK Windgrenze\n[#Wind_kmh > #Grenze] => #Wind_Stopp;') }],
  bind:['windSpeed=Wind_kmh', 'windWarn=Wind_Stopp'] });

defKopPro({ id:'k11_aufruf', ch:11, title:'Die Aufruf-Box',
  story:'<code>FC_Freigabe</code> ist fertig, aber ein Baustein, den keiner aufruft, läuft nie. Der zyklische Organisationsbaustein <code>Main</code> (OB1) ist noch leer.',
  brief:'Zeichne in <code>Main</code> ein Netzwerk <b>ohne Bedingung</b> mit einer <b>Aufruf-Box</b> <code>"FC_Freigabe"</code>:<br><code>Tuer_Zu := "Tuer_Zu"</code>, <code>Seil_OK := "Seil_OK"</code>, <code>Not_Halt_OK := "Not_Halt_OK"</code>, <code>Freigabe => "Freigabe"</code>.<br>Spule antippen → <b>Aufruf</b>, Baustein wählen, dann die Parameter mit den PLC-Variablen (in Anführungszeichen) belegen.',
  learn:'Eine FC im OB1 aufrufen und ihre Parameter verschalten.',
  take:'Eine <b>Aufruf-Box</b> verbindet die Schnittstelle mit echten Signalen: <code>Eingang := Signal</code>, <code>Ausgang => Signal</code>. Globale PLC-Variablen stehen in <b>Anführungszeichen</b>.',
  man:'bausteine', must:['CALL','FC_CALL'],
  hint:'In Main: + Netzwerk → Element antippen → „ohne Bedingung“ → Spule antippen → „Aufruf“ → "FC_Freigabe".',
  blocks:[
    { name:'FC_Freigabe', kind:'FC', src: kFC('FC_Freigabe', 'Void', FREIGABE_D, FREIGABE_NW) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_FREIGABE) }
  ],
  globals: G3,
  tests:[[{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true }, { Freigabe:true }], [{ Tuer_Zu:false, Seil_OK:true, Not_Halt_OK:true }, { Freigabe:false }], [{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:false }, { Freigabe:false }]],
  bind: CHAIN.concat(['lightGreen=Freigabe']) });

const TUER_D = { in:'Kabine_da:Bool|Kabine im Bahnsteig; S_Oeffnen:Bool|Taster Tür öffnen; Fahrt:Bool|Antrieb läuft', out:'Tuer_Auf:Bool|Befehl Tür öffnen' };
const TUER_FC = kFC('FC_Tuer', 'Void', TUER_D, 'NETWORK Tuer oeffnen\n#Kabine_da AND #S_Oeffnen AND NOT #Fahrt => #Tuer_Auf;');
const TUER_MAIN = 'NETWORK Tuer Bergstation\n=> "FC_Tuer"(Kabine_da := "Kabine_Berg", S_Oeffnen := "S_Tuer_Berg", Fahrt := "Fahrt", Tuer_Auf => "Tuer_Berg");\n\nNETWORK Tuer Talstation\n=> "FC_Tuer"(Kabine_da := "Kabine_Tal", S_Oeffnen := "S_Tuer_Tal", Fahrt := "Fahrt", Tuer_Auf => "Tuer_Tal");';
const G_TUER = { Kabine_Berg:false, S_Tuer_Berg:false, Kabine_Tal:false, S_Tuer_Tal:false, Fahrt:false, Tuer_Berg:false, Tuer_Tal:false };

defKopPro({ id:'k11_zwei_stationen', ch:11, title:'Einmal bauen, zweimal nutzen',
  story:'Berg- und Talstation haben dieselben Türen, doch die Türlogik stand zweimal im Programm, und ARIA änderte nur eine Kopie. Mit einer Funktion gibt es die Logik nur <b>einmal</b>.',
  brief:'<code>FC_Tuer</code> (🔒) ist fertig. Rufe sie in <code>Main</code> <b>zweimal</b> auf:<br><b>NW 1:</b> Kabine_da := <code>"Kabine_Berg"</code>, S_Oeffnen := <code>"S_Tuer_Berg"</code>, Fahrt := <code>"Fahrt"</code>, Tuer_Auf => <code>"Tuer_Berg"</code><br><b>NW 2:</b> dasselbe mit <code>"Kabine_Tal"</code>, <code>"S_Tuer_Tal"</code>, <code>"Fahrt"</code>, <code>"Tuer_Tal"</code>',
  learn:'Dieselbe FC mehrfach mit verschiedenen Parametern aufrufen.',
  take:'Eine FC ist wie ein Rezept: Einmal geschrieben, beliebig oft aufgerufen — jedes Mal mit anderen Zutaten (Parametern). Ändert man die FC, ändern sich alle Stellen.',
  man:'bausteine', must:['CALL','FC_CALL','NETWORKS'],
  hint:'Zwei Netzwerke, beide ohne Bedingung, beide mit der Aufruf-Box "FC_Tuer".',
  blocks:[
    { name:'FC_Tuer', kind:'FC', src: TUER_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(TUER_MAIN) }
  ],
  globals: G_TUER,
  tests:[[{ Kabine_Berg:true, S_Tuer_Berg:true }, { Tuer_Berg:true, Tuer_Tal:false }], [{ Kabine_Tal:true, S_Tuer_Tal:true }, { Tuer_Berg:false, Tuer_Tal:true }],
    [{ Kabine_Berg:true, S_Tuer_Berg:true, Kabine_Tal:true, S_Tuer_Tal:true, Fahrt:true }, { Tuer_Berg:false, Tuer_Tal:false }], [{ Kabine_Tal:true, S_Tuer_Berg:true }, { Tuer_Berg:false, Tuer_Tal:false }]],
  bind:['doorOpen=Tuer_Berg', 'cabinInStation=Kabine_Berg', 'motorOn=Fahrt'] });

defKopPro({ id:'k11_aufruf_dbg', ch:11, title:'Vertauschte Drähte', debug:true,
  story:'Die Tür der Bergstation öffnet während der Fahrt und nie, wenn die Kabine steht. Die Funktion ist in Ordnung, aber ARIA hat beim Aufruf zwei Parameter vertauscht.',
  brief:'Finde im Aufruf von <code>"FC_Tuer"</code> in <code>Main</code> die vertauschten Parameter und korrigiere sie.',
  learn:'Parameter eines Aufrufs gegen die Schnittstelle prüfen.',
  take:'Der Compiler prüft nur Typen, nicht die Bedeutung: Zwei Bool-Signale lassen sich problemlos vertauschen. Darum Parameter immer mit dem Kommentar der Schnittstelle vergleichen.',
  man:'bausteine', must:['CALL'],
  hint:'Welche Signale gehören zu Kabine_da und zu Fahrt?',
  blocks:[
    { name:'FC_Tuer', kind:'FC', src: TUER_FC },
    { name:'Main', kind:'OB', edit:true,
      start: MAIN('NETWORK Tuer Bergstation\n=> "FC_Tuer"(Kabine_da := "Fahrt", S_Oeffnen := "S_Tuer_Berg", Fahrt := "Kabine_Berg", Tuer_Auf => "Tuer_Berg");'),
      ref: MAIN('NETWORK Tuer Bergstation\n=> "FC_Tuer"(Kabine_da := "Kabine_Berg", S_Oeffnen := "S_Tuer_Berg", Fahrt := "Fahrt", Tuer_Auf => "Tuer_Berg");') }
  ],
  globals:{ Kabine_Berg:false, S_Tuer_Berg:false, Fahrt:false, Tuer_Berg:false },
  tests:[[{ Kabine_Berg:true, S_Tuer_Berg:true }, { Tuer_Berg:true }], [{ Kabine_Berg:false, S_Tuer_Berg:true, Fahrt:true }, { Tuer_Berg:false }], [{ Kabine_Berg:true, S_Tuer_Berg:true, Fahrt:true }, { Tuer_Berg:false }]],
  bind:['doorOpen=Tuer_Berg', 'cabinInStation=Kabine_Berg', 'motorOn=Fahrt'] });

defKopPro({ id:'k11_retval', ch:11, title:'Der Rückgabewert',
  story:'Der Umrichter meldet die Seilgeschwindigkeit in m/s, die Anzeige will km/h. Eine Umrechnung braucht nur einen Wert als Ergebnis — dafür hat eine FC den <b>Rückgabewert</b> <code>Ret_Val</code>.',
  brief:'<code>FC_Kmh</code> hat den Rückgabetyp <code>Real</code> und den Input <code>ms</code>. Zeichne ein Netzwerk ohne Bedingung mit <b>MUL</b>: IN1 <code>#ms</code>, IN2 <code>3.6</code>, OUT <code>#Ret_Val</code>.',
  learn:'Den Rückgabewert einer FC setzen.',
  take:'Der <b>Rückgabewert</b> (<code>Ret_Val</code>) ist der Hauptausgang einer FC. In der Aufruf-Box erscheint er als Ausgang <code>Ret_Val =></code>. Er muss in <b>jedem</b> Aufruf geschrieben werden.',
  man:'fc', must:['RETVAL','MUL'],
  hint:'+ Netzwerk → ohne Bedingung → Spule antippen → Rechnen → Box MUL.',
  blocks:[
    { name:'FC_Kmh', kind:'FC', edit:true, start: kFC('FC_Kmh', 'Real', { in:'ms:Real|Geschwindigkeit m/s' }, ''), ref: kFC('FC_Kmh', 'Real', { in:'ms:Real|Geschwindigkeit m/s' }, 'NETWORK Umrechnung\n=> MUL(#ms, 3.6, #Ret_Val);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Anzeige\n=> "FC_Kmh"(ms := "Seil_ms", Ret_Val => "Seil_kmh");') }
  ],
  globals:{ Seil_ms:0, Seil_kmh:0 }, types:{ Seil_ms:'REAL', Seil_kmh:'REAL' },
  unit:[{ block:'FC_Kmh', steps:[[{ ms:5 }, { RET:18 }], [{ ms:2.5 }, { RET:9 }], [{ ms:0 }, { RET:0 }]] }],
  tests:[[{ Seil_ms:5 }, { Seil_kmh:18 }], [{ Seil_ms:10 }, { Seil_kmh:36 }]],
  bind:['displayValue=Seil_kmh', 'displayLabel:"SEIL km/h"'] });

const WIND2_D = { in:'Wind_kmh:Int', out:'Warnung:Bool; Stopp:Bool', temp:'Sturm:Bool|Zwischenergebnis' };
const WIND2_NW = 'NETWORK Sturm erkennen\n[#Wind_kmh > 60] => #Sturm;\n\nNETWORK Abschalten\n#Sturm => #Stopp;\n\nNETWORK Warnen\n#Sturm OR [#Wind_kmh >= 40] => #Warnung;';

defKopPro({ id:'k11_temp', ch:11, title:'Zwischenergebnisse',
  story:'Die Sturmerkennung wird an zwei Stellen gebraucht. Statt den Vergleich zweimal zu zeichnen, merkt man sich das Ergebnis in einer <b>temporären</b> Variable — nur für diesen einen Aufruf.',
  brief:'Lege in der Tabelle eine <b>Temp</b>-Variable <code>Sturm</code> : <code>Bool</code> an. Dann:<br><b>NW 1:</b> <code>#Wind_kmh</code> &gt; 60 → <code>#Sturm</code><br><b>NW 2:</b> <code>#Sturm</code> → <code>#Stopp</code><br><b>NW 3:</b> <code>#Sturm</code> oder <code>#Wind_kmh</code> ≥ 40 → <code>#Warnung</code>',
  learn:'Temporäre Variablen für Zwischenergebnisse.',
  take:'<b>Temp</b>-Variablen gelten nur während eines Aufrufs. Sie müssen <b>zuerst geschrieben</b> und dann gelesen werden — beim nächsten Aufruf ist ihr Inhalt wieder unbestimmt.',
  man:'fc', must:['TEMP','NETWORKS'],
  hint:'Tabelle → Zeile hinzufügen → Bereich Temp. Das Netzwerk, das #Sturm schreibt, kommt zuerst.',
  blocks:[
    { name:'FC_Sturm', kind:'FC', edit:true, start: kFC('FC_Sturm', 'Void', { in:'Wind_kmh:Int', out:'Warnung:Bool; Stopp:Bool' }, ''), ref: kFC('FC_Sturm', 'Void', WIND2_D, WIND2_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Wind\n=> "FC_Sturm"(Wind_kmh := "Wind_kmh", Warnung => "Windwarnung", Stopp => "Wind_Stopp");') }
  ],
  globals:{ Wind_kmh:0, Windwarnung:false, Wind_Stopp:false },
  unit:[{ block:'FC_Sturm', steps:[30, 40, 60, 61, 90].map(w => [{ Wind_kmh:w }, { Warnung: w >= 40, Stopp: w > 60 }]) }],
  tests:[[{ Wind_kmh:70 }, { Windwarnung:true, Wind_Stopp:true }], [{ Wind_kmh:45 }, { Windwarnung:true, Wind_Stopp:false }]],
  bind:['windSpeed=Wind_kmh', 'lightYellow=Windwarnung', 'windWarn=Wind_Stopp'] });

defKopPro({ id:'k11_temp_dbg', ch:11, title:'Gelesen, bevor geschrieben', debug:true, warnFree:['TEMP_READ_BEFORE_WRITE'],
  story:'Die Sturmabschaltung reagiert nie. ARIA hat nur die Reihenfolge der Netzwerke geändert — und der Compiler warnt: „Temp-Variable wird gelesen, bevor sie geschrieben wurde.“',
  brief:'Bringe die Netzwerke in <code>FC_Sturm</code> in die richtige Reihenfolge, so dass keine Warnung mehr kommt.',
  learn:'Reihenfolge bei Temp-Variablen: erst schreiben, dann lesen.',
  take:'Eine Temp-Variable hat am Anfang jedes Aufrufs keinen verlässlichen Wert. Wer sie liest, bevor er sie schreibt, arbeitet mit Zufall — in der echten SPS mit dem, was gerade im Speicher liegt.',
  man:'fc', must:['TEMP'],
  hint:'Netzwerk antippen (Kopfzeile) → „nach oben“.',
  blocks:[
    { name:'FC_Sturm', kind:'FC', edit:true, start: kFC('FC_Sturm', 'Void', WIND2_D, 'NETWORK Abschalten\n#Sturm => #Stopp;\n\nNETWORK Sturm erkennen\n[#Wind_kmh > 60] => #Sturm;\n\nNETWORK Warnen\n#Sturm OR [#Wind_kmh >= 40] => #Warnung;'), ref: kFC('FC_Sturm', 'Void', WIND2_D, WIND2_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Wind\n=> "FC_Sturm"(Wind_kmh := "Wind_kmh", Warnung => "Windwarnung", Stopp => "Wind_Stopp");') }
  ],
  globals:{ Wind_kmh:0, Windwarnung:false, Wind_Stopp:false },
  unit:[{ block:'FC_Sturm', steps:[[{ Wind_kmh:70 }, { Stopp:true }], [{ Wind_kmh:30 }, { Stopp:false }], [{ Wind_kmh:70 }, { Stopp:true }]] }],
  tests:[[{ Wind_kmh:70 }, { Wind_Stopp:true }]],
  bind:['windSpeed=Wind_kmh', 'lightYellow=Windwarnung', 'windWarn=Wind_Stopp'] });

const AMPEL_D = { in:'Stoerung:Bool; Tuer_Zu:Bool; Fahrt:Bool', out:'Ampel_Rot:Bool; Ampel_Gruen:Bool' };
defKopPro({ id:'k11_speicher_dbg', ch:11, title:'Die vergessliche Funktion', debug:true, warnFree:['OUT_NOT_ALL_PATHS'],
  story:'ARIA hat in <code>FC_Ampel</code> Setzen- und Rücksetzen-Spulen eingebaut, und der Compiler warnt: „Ausgang wird nicht in jedem Aufruf geschrieben.“ Eine FC hat <b>kein Gedächtnis</b>: Was nicht geschrieben wird, ist beim nächsten Aufruf unbestimmt.',
  brief:'Baue <code>FC_Ampel</code> mit <b>normalen Spulen</b> um:<br><code>Ampel_Rot</code> = <code>#Stoerung</code> oder nicht <code>#Tuer_Zu</code><br><code>Ampel_Gruen</code> = <code>#Fahrt</code> und nicht <code>#Ampel_Rot</code>',
  learn:'In einer FC jeden Ausgang in jedem Aufruf schreiben — keine S/R-Spulen.',
  take:'S- und R-Spulen schreiben nur, wenn Strom fliesst. In einer FC bleibt ein Ausgang dann unbestimmt. Speichern kann nur ein <b>FB</b> (nächstes Kapitel) — in der FC gehören normale Spulen hin.',
  man:'fc', must:['COIL'],
  hint:'Spule antippen → „Spule“ statt Setzen. Das Rücksetz-Netzwerk wird überflüssig.',
  blocks:[
    { name:'FC_Ampel', kind:'FC', edit:true,
      start: kFC('FC_Ampel', 'Void', AMPEL_D, 'NETWORK Rot ein\n#Stoerung OR NOT #Tuer_Zu => S #Ampel_Rot;\n\nNETWORK Rot aus\nNOT #Stoerung AND #Tuer_Zu => R #Ampel_Rot;\n\nNETWORK Gruen\n#Fahrt AND NOT #Ampel_Rot => S #Ampel_Gruen;'),
      ref: kFC('FC_Ampel', 'Void', AMPEL_D, 'NETWORK Rot\n#Stoerung OR NOT #Tuer_Zu => #Ampel_Rot;\n\nNETWORK Gruen\n#Fahrt AND NOT #Ampel_Rot => #Ampel_Gruen;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Ampel\n=> "FC_Ampel"(Stoerung := "Stoerung", Tuer_Zu := "Tuer_Zu", Fahrt := "Fahrt", Ampel_Rot => "Ampel_Rot", Ampel_Gruen => "Ampel_Gruen");') }
  ],
  globals:{ Stoerung:false, Tuer_Zu:false, Fahrt:false, Ampel_Rot:false, Ampel_Gruen:false },
  unit:[{ block:'FC_Ampel', steps:[[{ Stoerung:false, Tuer_Zu:true, Fahrt:true }, { Ampel_Rot:false, Ampel_Gruen:true }], [{ Stoerung:true, Tuer_Zu:true, Fahrt:true }, { Ampel_Rot:true, Ampel_Gruen:false }], [{ Stoerung:false, Tuer_Zu:false, Fahrt:false }, { Ampel_Rot:true, Ampel_Gruen:false }]] }],
  tests:[[{ Tuer_Zu:true, Fahrt:true }, { Ampel_Gruen:true, Ampel_Rot:false }], [{ Tuer_Zu:false }, { Ampel_Rot:true, Ampel_Gruen:false }]],
  bind:['lightRed=Ampel_Rot', 'lightGreen=Ampel_Gruen', 'faultActive=Stoerung'] });

const ST_D = { in:'Tuer_Zu:Bool; Seil_OK:Bool; Not_Halt_OK:Bool; Wind_kmh:Int; S_Start:Bool', out:'Freigabe:Bool; Antrieb_Ein:Bool; Windwarnung:Bool' };
const ST_NW = 'NETWORK Freigabe\n#Tuer_Zu AND #Seil_OK AND #Not_Halt_OK AND [#Wind_kmh <= 60] => #Freigabe;\n\nNETWORK Antrieb\n#Freigabe AND #S_Start => #Antrieb_Ein;\n\nNETWORK Windwarnung\n[#Wind_kmh > 40] => #Windwarnung;';
const ST_CALL = 'NETWORK Station\n=> "FC_Station"(Tuer_Zu := "Tuer_Zu", Seil_OK := "Seil_OK", Not_Halt_OK := "Not_Halt_OK", Wind_kmh := "Wind_kmh", S_Start := "S_Start", Freigabe => "Freigabe", Antrieb_Ein => "Antrieb", Windwarnung => "Windwarnung");';
defKopPro({ id:'k11_boss', ch:11, title:'Boss: Die Stationsfunktion', boss:true,
  story:'ARIA hat den ganzen OB der Talstation verknotet. Der Werkmeister zieht einen Strich: „Neu: eine Funktion für die Station, ein sauberer Aufruf in Main, dann sehen wir, wo sie sich versteckt.“',
  brief:'<b>FC_Station</b> (Schnittstelle steht):<br><b>NW 1:</b> <code>#Tuer_Zu</code>, <code>#Seil_OK</code>, <code>#Not_Halt_OK</code> und <code>#Wind_kmh</code> ≤ 60 → <code>#Freigabe</code><br><b>NW 2:</b> <code>#Freigabe</code> und <code>#S_Start</code> → <code>#Antrieb_Ein</code><br><b>NW 3:</b> <code>#Wind_kmh</code> &gt; 40 → <code>#Windwarnung</code><br><b>Main:</b> Aufruf-Box mit <code>"Tuer_Zu"</code>, <code>"Seil_OK"</code>, <code>"Not_Halt_OK"</code>, <code>"Wind_kmh"</code>, <code>"S_Start"</code> → <code>"Freigabe"</code>, <code>"Antrieb"</code>, <code>"Windwarnung"</code>',
  learn:'Eine FC mit mehreren Ein- und Ausgängen schreiben und aufrufen.',
  take:'Programmstruktur: Der OB ruft auf, der Baustein rechnet. Die Schnittstelle ist der Vertrag zwischen beiden.',
  man:'bausteine', must:['CALL','FC_CALL','CMP','SERIES'],
  hint:'Erst FC_Station fertig zeichnen (Tab oben), dann Main.',
  blocks:[
    { name:'FC_Station', kind:'FC', edit:true, start: kFC('FC_Station', 'Void', ST_D, ''), ref: kFC('FC_Station', 'Void', ST_D, ST_NW) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(ST_CALL) }
  ],
  globals:{ Tuer_Zu:false, Seil_OK:false, Not_Halt_OK:false, Wind_kmh:0, S_Start:false, Freigabe:false, Antrieb:false, Windwarnung:false },
  unit:[{ block:'FC_Station', steps:[[{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_kmh:20, S_Start:true }, { Freigabe:true, Antrieb_Ein:true, Windwarnung:false }],
    [{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_kmh:61, S_Start:true }, { Freigabe:false, Antrieb_Ein:false, Windwarnung:true }],
    [{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_kmh:45, S_Start:false }, { Freigabe:true, Antrieb_Ein:false, Windwarnung:true }],
    [{ Tuer_Zu:false, Seil_OK:true, Not_Halt_OK:true, Wind_kmh:0, S_Start:true }, { Freigabe:false, Antrieb_Ein:false }]] }],
  tests:[[{ Tuer_Zu:true, Seil_OK:true, Not_Halt_OK:true, Wind_kmh:30, S_Start:true }, { Freigabe:true, Antrieb:true, Windwarnung:false }],
    [{ Tuer_Zu:true, Seil_OK:false, Not_Halt_OK:true, Wind_kmh:50, S_Start:true }, { Freigabe:false, Antrieb:false, Windwarnung:true }]],
  bind: CHAIN.concat(['windSpeed=Wind_kmh', 'lightGreen=Freigabe', 'motorOn=Antrieb', 'lightYellow=Windwarnung']) });
})();
