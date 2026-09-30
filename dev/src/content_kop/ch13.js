/* ===== KOP QUEST · KAPITEL 13 — Daten: Datenbaustein, PLC-Datentyp, Array (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const UDT = kUDT('UDT_Kabine', 'Nummer:Int|Kabinennummer; Tuer_Zu:Bool; Gaeste:Int|Personen in der Kabine; Besetzt:Bool');

defKopPro({ id:'k13_db_schreiben', ch:13, title:'Der Datenbaustein',
  story:'Die Betriebsleitung will jeden Abend wissen, wie stark der Wind am Tag höchstens war. Solche Werte gehören in einen <b>globalen Datenbaustein</b> — dort bleiben sie erhalten, und jeder Baustein kann sie lesen.',
  brief:'In <code>Main</code>: Den Windmesswert ohne Bedingung nach <code>"DB_Station".Wind_aktuell</code> kopieren (MOVE). Ist er grösser als <code>"DB_Station".Wind_Max</code>, ihn auch dorthin kopieren.',
  learn:'In einen globalen Datenbaustein schreiben und daraus lesen.',
  take:'Ein <b>globaler Datenbaustein</b> ist ein Speicher für Daten, die das ganze Programm braucht. Zugriff: <code>"DB_Name".Variable</code>. Anders als Temp-Variablen behalten DB-Werte ihren Inhalt.',
  man:'daten', must:['DB_ACCESS','MOVE','CMP'],
  hint:'Die Operanden schreibst du wie angezeigt: "DB_Station".Wind_Max (mit Anführungszeichen um den DB-Namen).',
  blocks:[
    { name:'DB_Station', kind:'DB', src: kDB('DB_Station', 'Wind_aktuell:Int|km/h; Wind_Max:Int|Tagesmaximum km/h') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Messwert\n=> MOVE("Wind_kmh", "DB_Station".Wind_aktuell);\n\nNETWORK Tagesmaximum\n["Wind_kmh" > "DB_Station".Wind_Max] => MOVE("Wind_kmh", "DB_Station".Wind_Max);') }
  ],
  globals:{ Wind_kmh:0 },
  timed:[{ steps:[[0.1,{ Wind_kmh:30 },{ 'DB_Station.Wind_aktuell':30, 'DB_Station.Wind_Max':30 }],[0.1,{ Wind_kmh:55 },{ 'DB_Station.Wind_Max':55 }],[0.1,{ Wind_kmh:20 },{ 'DB_Station.Wind_aktuell':20, 'DB_Station.Wind_Max':55 }],[0.1,{ Wind_kmh:70 },{ 'DB_Station.Wind_Max':70 }]] }],
  bind:['windSpeed=Wind_kmh', 'displayValue=DB_Station.Wind_Max', 'displayLabel:"MAX km/h"'] });

const WIND_FC = kFC('FC_Wind', 'Void', { in:'Wind_kmh:Int; Grenze:Int; Warngrenze:Int', out:'Stopp:Bool; Warnung:Bool' }, 'NETWORK Stopp\n[#Wind_kmh > #Grenze] => #Stopp;\n\nNETWORK Warnung\n[#Wind_kmh >= #Warngrenze] => #Warnung;');
defKopPro({ id:'k13_parameter', ch:13, title:'Grenzwerte im Datenbaustein',
  story:'Im Winter gilt eine tiefere Windgrenze als im Sommer. Die Grenzwerte stehen deshalb nicht fest im Programm, sondern in einem <b>Parameter-DB</b>, den die Betriebsleitung anpassen kann.',
  brief:'Rufe in <code>Main</code> <code>"FC_Wind"</code> auf: Windmesswert an den Windeingang, Grenze aus <code>"DB_Parameter".Wind_Grenze</code>, Warngrenze aus <code>"DB_Parameter".Wind_Warnung</code>; Ausgänge an Windstopp und Windwarnung.',
  learn:'Parameter aus einem DB an einen Baustein übergeben.',
  take:'Einstellwerte gehören in einen Datenbaustein, nicht als feste Zahl ins Netzwerk. Der Baustein bekommt sie über seine Schnittstelle — so bleibt er allgemein verwendbar.',
  man:'daten', must:['CALL','DB_ACCESS'],
  hint:'Aufruf-Box "FC_Wind", die Parameter tippst du ins Feld: "DB_Parameter".Wind_Grenze',
  blocks:[
    { name:'DB_Parameter', kind:'DB', src: kDB('DB_Parameter', 'Wind_Grenze:Int := 60|Abschaltung km/h; Wind_Warnung:Int := 40|Warnung km/h') },
    { name:'FC_Wind', kind:'FC', src: WIND_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Windueberwachung\n=> "FC_Wind"(Wind_kmh := "Wind_kmh", Grenze := "DB_Parameter".Wind_Grenze, Warngrenze := "DB_Parameter".Wind_Warnung, Stopp => "Wind_Stopp", Warnung => "Windwarnung");') }
  ],
  globals:{ Wind_kmh:0, Wind_Stopp:false, Windwarnung:false },
  tests:[[{ Wind_kmh:65 }, { Wind_Stopp:true, Windwarnung:true }], [{ Wind_kmh:45 }, { Wind_Stopp:false, Windwarnung:true }],
    [{ Wind_kmh:55, 'DB_Parameter.Wind_Grenze':50 }, { Wind_Stopp:true }], [{ Wind_kmh:35, 'DB_Parameter.Wind_Warnung':30 }, { Windwarnung:true, Wind_Stopp:false }]],
  wrong:[{ Main: MAIN('NETWORK Windueberwachung\n=> "FC_Wind"(Wind_kmh := "Wind_kmh", Grenze := 60, Warngrenze := 40, Stopp => "Wind_Stopp", Warnung => "Windwarnung");') }],
  bind:['windSpeed=Wind_kmh', 'windWarn=Wind_Stopp', 'lightYellow=Windwarnung'] });

const DB_K = kDB('DB_Kabinen', 'K1:"UDT_Kabine"|Kabine 1; K2:"UDT_Kabine"|Kabine 2');
defKopPro({ id:'k13_udt', ch:13, title:'Ein Datentyp für Kabinen',
  story:'Nummer, Tür, Gäste und Besetzt-Status jeder Kabine hat der Werkmeister im <b>PLC-Datentyp</b> <code>UDT_Kabine</code> zusammengefasst. Im DB stehen zwei Kabinen dieses Typs.',
  brief:'In <code>Main</code>: Ist <code>"DB_Kabinen".K1.Besetzt</code>, leuchtet Rot. Sind in Kabine 1 mindestens 8 Gäste (<code>.Gaeste</code> ≥ 8), meldet die Anlage Kabine voll.',
  learn:'Auf Elemente einer Struktur im DB zugreifen.',
  take:'Ein <b>PLC-Datentyp</b> (UDT) fasst zusammengehörige Werte unter einem Namen zusammen. Auf ein Element greift man mit Punkt zu: <code>"DB_Kabinen".K1.Gaeste</code>.',
  man:'udt', must:['DB_ACCESS','MEMBER','CMP'],
  hint:'Kontakt mit der Variable "DB_Kabinen".K1.Besetzt; Vergleicher mit "DB_Kabinen".K1.Gaeste >= 8.',
  blocks:[
    { name:'UDT_Kabine', kind:'UDT', src: UDT },
    { name:'DB_Kabinen', kind:'DB', src: DB_K },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Besetzt\n"DB_Kabinen".K1.Besetzt => "Ampel_Rot";\n\nNETWORK Voll\n["DB_Kabinen".K1.Gaeste >= 8] => "Kabine_voll";') }
  ],
  globals:{ Ampel_Rot:false, Kabine_voll:false },
  tests:[[{ 'DB_Kabinen.K1.Besetzt':true, 'DB_Kabinen.K1.Gaeste':3 }, { Ampel_Rot:true, Kabine_voll:false }], [{ 'DB_Kabinen.K1.Gaeste':8 }, { Ampel_Rot:false, Kabine_voll:true }],
    [{ 'DB_Kabinen.K2.Besetzt':true, 'DB_Kabinen.K2.Gaeste':9 }, { Ampel_Rot:false, Kabine_voll:false }]],
  bind:['lightRed=Ampel_Rot', 'passengers=DB_Kabinen.K1.Gaeste'] });

defKopPro({ id:'k13_db_tabelle', ch:13, title:'Den Datenbaustein anlegen',
  story:'Eine dritte Kabine kommt dazu — und ARIA hat den Datenbaustein geleert. Du legst die Kabinen neu an, in der Tabelle des DB.',
  brief:'Öffne <code>DB_Kabinen</code> und lege in der <b>Tabelle</b> drei Variablen vom Typ <code>"UDT_Kabine"</code> an: <code>K1</code>, <code>K2</code>, <code>K3</code>. <code>Main</code> (🔒) benutzt sie schon.',
  learn:'Variablen eines PLC-Datentyps in einem DB deklarieren.',
  take:'Ein DB wird wie eine Schnittstelle als Tabelle deklariert. Ein PLC-Datentyp wird wie ein Grundtyp verwendet: <code>K1 : "UDT_Kabine"</code>.',
  man:'udt', must:['UDT_REF'],
  hint:'Tabelle → Zeile hinzufügen → Name K1, Datentyp "UDT_Kabine" (mit Anführungszeichen).',
  blocks:[
    { name:'UDT_Kabine', kind:'UDT', src: UDT },
    { name:'DB_Kabinen', kind:'DB', edit:true, start: kDB('DB_Kabinen', 'Reserve:Bool'), ref: kDB('DB_Kabinen', 'K1:"UDT_Kabine"; K2:"UDT_Kabine"; K3:"UDT_Kabine"') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Irgendeine Kabine besetzt\n"DB_Kabinen".K1.Besetzt OR "DB_Kabinen".K2.Besetzt OR "DB_Kabinen".K3.Besetzt => "Ampel_Rot";') }
  ],
  globals:{ Ampel_Rot:false },
  tests:[[{ 'DB_Kabinen.K3.Besetzt':true }, { Ampel_Rot:true }], [{}, { Ampel_Rot:false }]],
  bind:['lightRed=Ampel_Rot'] });

defKopPro({ id:'k13_db_dbg', ch:13, title:'Die falsche Kabine', debug:true,
  story:'Die Anzeige meldet „Kabine voll“, obwohl Kabine 1 fast leer ist — und schweigt, wenn sie wirklich voll ist. ARIA hat im Netzwerk die Kabine vertauscht.',
  brief:'Die Meldung Kabine voll und die rote Lampe gehören beide zu <b>Kabine 1</b>.',
  learn:'Strukturpfade genau lesen.',
  take:'Bei Strukturen und DBs zählt jeder Buchstabe des Pfads: <code>K1</code> und <code>K2</code> haben denselben Typ — der Compiler merkt die Verwechslung nicht.',
  man:'udt', must:['MEMBER'],
  hint:'Welches Netzwerk greift auf K2 zu?',
  blocks:[
    { name:'UDT_Kabine', kind:'UDT', src: UDT },
    { name:'DB_Kabinen', kind:'DB', src: DB_K },
    { name:'Main', kind:'OB', edit:true, start: MAIN('NETWORK Besetzt\n"DB_Kabinen".K1.Besetzt => "Ampel_Rot";\n\nNETWORK Voll\n["DB_Kabinen".K2.Gaeste >= 8] => "Kabine_voll";'), ref: MAIN('NETWORK Besetzt\n"DB_Kabinen".K1.Besetzt => "Ampel_Rot";\n\nNETWORK Voll\n["DB_Kabinen".K1.Gaeste >= 8] => "Kabine_voll";') }
  ],
  globals:{ Ampel_Rot:false, Kabine_voll:false },
  tests:[[{ 'DB_Kabinen.K1.Gaeste':8, 'DB_Kabinen.K2.Gaeste':2 }, { Kabine_voll:true }], [{ 'DB_Kabinen.K1.Gaeste':1, 'DB_Kabinen.K2.Gaeste':8 }, { Kabine_voll:false }]],
  bind:['lightRed=Ampel_Rot', 'passengers=DB_Kabinen.K1.Gaeste'] });

const DB_A = kDB('DB_Bahnsteig', 'Besetzt:Array[1..4] of Bool|Bahnsteigplätze 1–4');
const ARR_NW = 'NETWORK Ein Platz besetzt\n"DB_Bahnsteig".Besetzt[1] OR "DB_Bahnsteig".Besetzt[2] OR "DB_Bahnsteig".Besetzt[3] OR "DB_Bahnsteig".Besetzt[4] => "Ampel_Gelb";\n\nNETWORK Alle besetzt\n"DB_Bahnsteig".Besetzt[1] AND "DB_Bahnsteig".Besetzt[2] AND "DB_Bahnsteig".Besetzt[3] AND "DB_Bahnsteig".Besetzt[4] => "Ampel_Rot";';
const arrTests = [[0,0,0,0],[1,0,0,0],[0,0,0,1],[1,1,1,0],[1,1,1,1],[0,1,1,1]].map(a => { const s = {}; a.forEach((v, i) => { s['DB_Bahnsteig.Besetzt[' + (i + 1) + ']'] = !!v; }); return [s, { Ampel_Gelb: a.some(Boolean), Ampel_Rot: a.every(Boolean) }]; });
defKopPro({ id:'k13_array', ch:13, title:'Plätze im Array',
  story:'Die vier Warteplätze am Bahnsteig haben Sensoren, und statt vier einzelner Variablen stehen sie im <b>Array</b> <code>Besetzt[1..4]</code>.',
  brief:'In <code>Main</code>: Ist irgendein Platz <code>"DB_Bahnsteig".Besetzt[1]</code> … <code>[4]</code> belegt, leuchtet Gelb (parallel). Sind alle vier belegt, leuchtet Rot (Reihe).',
  learn:'Feste Array-Elemente in Kontakten verwenden.',
  take:'Ein <b>Array</b> ist eine nummerierte Reihe gleicher Werte. Im Kontaktplan greift man mit fester Nummer zu: <code>Besetzt[3]</code>. Die Grenzen (hier 1..4) gehören zum Typ.',
  man:'udt', must:['ARRAY','PARALLEL','SERIES'],
  hint:'NW 1: vier Kontakte parallel. NW 2: vier Kontakte in Reihe.',
  blocks:[
    { name:'DB_Bahnsteig', kind:'DB', src: DB_A },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(ARR_NW) }
  ],
  globals:{ Ampel_Gelb:false, Ampel_Rot:false },
  tests: arrTests,
  bind:['lightYellow=Ampel_Gelb', 'lightRed=Ampel_Rot'] });

const KAB_FC_D = { in:'Kabine:"UDT_Kabine"|Daten der Kabine', out:'Abfahrbereit:Bool; Voll:Bool' };
const KAB_FC_NW = 'NETWORK Abfahrbereit\n#Kabine.Tuer_Zu AND [#Kabine.Gaeste <= 8] => #Abfahrbereit;\n\nNETWORK Voll\n[#Kabine.Gaeste >= 8] => #Voll;';
defKopPro({ id:'k13_struct_param', ch:13, title:'Die Kabine als Parameter',
  story:'Statt vier einzelner Parameter bekommt der Baustein eine ganze Kabine übergeben — einen Wert vom Typ <code>"UDT_Kabine"</code>.',
  brief:'<code>FC_Kabine</code> hat den Input <code>Kabine : "UDT_Kabine"</code>.<br><b>NW 1:</b> <code>#Kabine.Tuer_Zu</code> und <code>#Kabine.Gaeste</code> ≤ 8 → <code>#Abfahrbereit</code><br><b>NW 2:</b> <code>#Kabine.Gaeste</code> ≥ 8 → <code>#Voll</code>',
  learn:'Strukturen als Bausteinparameter.',
  take:'Ein UDT als Parameter hält Schnittstellen klein: Ein Parameter statt vieler. Im Baustein greift man mit <code>#Kabine.Element</code> zu.',
  man:'udt', must:['UDT_REF','MEMBER','CMP'],
  hint:'Kontakt #Kabine.Tuer_Zu, dahinter ein Vergleicher.',
  blocks:[
    { name:'UDT_Kabine', kind:'UDT', src: UDT },
    { name:'DB_Kabinen', kind:'DB', src: DB_K },
    { name:'FC_Kabine', kind:'FC', edit:true, start: kFC('FC_Kabine', 'Void', KAB_FC_D, ''), ref: kFC('FC_Kabine', 'Void', KAB_FC_D, KAB_FC_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Kabine 1\n=> "FC_Kabine"(Kabine := "DB_Kabinen".K1, Abfahrbereit => "Bereit", Voll => "Kabine_voll");') }
  ],
  globals:{ Bereit:false, Kabine_voll:false },
  tests:[[{ 'DB_Kabinen.K1.Tuer_Zu':true, 'DB_Kabinen.K1.Gaeste':5 }, { Bereit:true, Kabine_voll:false }], [{ 'DB_Kabinen.K1.Tuer_Zu':true, 'DB_Kabinen.K1.Gaeste':9 }, { Bereit:false, Kabine_voll:true }],
    [{ 'DB_Kabinen.K1.Tuer_Zu':false, 'DB_Kabinen.K1.Gaeste':8 }, { Bereit:false, Kabine_voll:true }], [{ 'DB_Kabinen.K1.Tuer_Zu':true, 'DB_Kabinen.K1.Gaeste':8 }, { Bereit:true, Kabine_voll:true }]],
  bind:['lightGreen=Bereit', 'lightRed=Kabine_voll', 'passengers=DB_Kabinen.K1.Gaeste'] });

const DB_W = kDB('DB_Kabinen', 'Station:"UDT_Kabine"|Kabine im Bahnsteig; Strecke:"UDT_Kabine"|Kabine auf der Strecke');
defKopPro({ id:'k13_move_struct', ch:13, title:'Die Kabine fährt ab',
  story:'Fährt eine Kabine aus der Station, wandern ihre Daten vom Datensatz <code>Station</code> in den Datensatz <code>Strecke</code>. Ein MOVE kann eine ganze Struktur auf einmal kopieren.',
  brief:'In <code>Main</code>: Bei Abfahrt kopiert MOVE <code>"DB_Kabinen".Station</code> nach <code>"DB_Kabinen".Strecke</code>.',
  learn:'Ganze Strukturen mit MOVE kopieren.',
  take:'MOVE funktioniert auch mit Strukturen — solange Quelle und Ziel denselben Datentyp haben. Alle Elemente werden auf einmal kopiert.',
  man:'udt', must:['MOVE','MEMBER'],
  hint:'Kontakt "Abfahrt", MOVE-Box mit IN "DB_Kabinen".Station und OUT "DB_Kabinen".Strecke.',
  blocks:[
    { name:'UDT_Kabine', kind:'UDT', src: UDT },
    { name:'DB_Kabinen', kind:'DB', src: DB_W },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Kabine uebergeben\n"Abfahrt" => MOVE("DB_Kabinen".Station, "DB_Kabinen".Strecke);') }
  ],
  globals:{ Abfahrt:false },
  timed:[{ setup:{ 'DB_Kabinen.Station.Nummer':7, 'DB_Kabinen.Station.Gaeste':6, 'DB_Kabinen.Station.Tuer_Zu':true }, steps:[[0.1,{},{ 'DB_Kabinen.Strecke.Nummer':0 }],[0.1,{ Abfahrt:true },{ 'DB_Kabinen.Strecke.Nummer':7, 'DB_Kabinen.Strecke.Gaeste':6, 'DB_Kabinen.Strecke.Tuer_Zu':true }],
    [0.1,{ Abfahrt:false, 'DB_Kabinen.Station.Nummer':8, 'DB_Kabinen.Station.Gaeste':2 },{ 'DB_Kabinen.Strecke.Nummer':7, 'DB_Kabinen.Strecke.Gaeste':6 }]] }],
  bind:['motorOn=Abfahrt', 'passengers=DB_Kabinen.Strecke.Gaeste'] });

defKopPro({ id:'k13_array_dbg', ch:13, title:'Platz 4 fehlt', debug:true,
  story:'Die gelbe Lampe bleibt dunkel, wenn nur Platz 4 besetzt ist. ARIA hat im Netzwerk einen Index doppelt verwendet.',
  brief:'Gelb: irgendein Platz 1–4 besetzt. Rot: alle vier besetzt.',
  learn:'Array-Indizes vollständig prüfen.',
  take:'Bei Arrays passieren Fehler oft an den Rändern: Index doppelt, Index vergessen, Index ausserhalb der Grenzen.',
  man:'udt', must:['ARRAY'],
  hint:'Lies die Indizes der Kontakte in Netzwerk 1 genau.',
  blocks:[
    { name:'DB_Bahnsteig', kind:'DB', src: DB_A },
    { name:'Main', kind:'OB', edit:true, start: MAIN(ARR_NW.replace('"DB_Bahnsteig".Besetzt[3] OR "DB_Bahnsteig".Besetzt[4]', '"DB_Bahnsteig".Besetzt[3] OR "DB_Bahnsteig".Besetzt[3]')), ref: MAIN(ARR_NW) }
  ],
  globals:{ Ampel_Gelb:false, Ampel_Rot:false },
  tests: arrTests,
  bind:['lightYellow=Ampel_Gelb', 'lightRed=Ampel_Rot'] });

const DB_S = kDB('DB_Station', 'Kabine:Array[1..2] of "UDT_Kabine"; Gaeste_gesamt:Int');
const BOSS_MAIN = 'NETWORK Kabine 1\n=> "FC_Kabine"(Kabine := "DB_Station".Kabine[1], Abfahrbereit => "Bereit_1", Voll => "Voll_1");\n\nNETWORK Kabine 2\n=> "FC_Kabine"(Kabine := "DB_Station".Kabine[2], Abfahrbereit => "Bereit_2", Voll => "Voll_2");\n\nNETWORK Abfahrt frei\n"Bereit_1" AND "Bereit_2" => "Abfahrt_frei";\n\nNETWORK Gaeste gesamt\n=> ADD("DB_Station".Kabine[1].Gaeste, "DB_Station".Kabine[2].Gaeste, "DB_Station".Gaeste_gesamt);';
defKopPro({ id:'k13_boss', ch:13, title:'Boss: Die Kabinendaten', boss:true,
  story:'ARIA hat die Kabinendaten verwürfelt: Kabine 2 fährt mit offener Tür, Kabine 1 mit zwölf Gästen. Der Werkmeister: „Ein Datentyp, ein Array, ein Baustein, und die Kasse will auch die Summe der Gäste.“',
  brief:'<code>FC_Kabine</code>: <code>#Abfahrbereit</code> bei <code>#Kabine.Tuer_Zu</code> und höchstens 8 Gästen, <code>#Voll</code> ab 8 Gästen.<br><code>Main</code>: je ein Aufruf für <code>"DB_Station".Kabine[1]</code> und <code>[2]</code> → Bereit und Voll dieser Kabine; Abfahrt frei, wenn beide bereit; ohne Bedingung ADD der Gäste nach <code>"DB_Station".Gaeste_gesamt</code>.',
  learn:'Array von Strukturen, Strukturparameter und Rechnen mit DB-Werten.',
  take:'Mit PLC-Datentypen, Arrays und Datenbausteinen bleiben auch grosse Anlagen übersichtlich: Die Daten jeder Kabine haben dieselbe Form, ein Baustein verarbeitet sie alle.',
  man:'udt', must:['UDT_REF','ARRAY','CALL','ADD','DB_ACCESS'],
  hint:'Zuerst FC_Kabine, dann Main. Der Parameter heisst "DB_Station".Kabine[1].',
  blocks:[
    { name:'UDT_Kabine', kind:'UDT', src: UDT },
    { name:'DB_Station', kind:'DB', src: DB_S },
    { name:'FC_Kabine', kind:'FC', edit:true, start: kFC('FC_Kabine', 'Void', KAB_FC_D, ''), ref: kFC('FC_Kabine', 'Void', KAB_FC_D, KAB_FC_NW) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(BOSS_MAIN) }
  ],
  globals:{ Bereit_1:false, Voll_1:false, Bereit_2:false, Voll_2:false, Abfahrt_frei:false },
  tests:[[{ 'DB_Station.Kabine[1].Tuer_Zu':true, 'DB_Station.Kabine[1].Gaeste':4, 'DB_Station.Kabine[2].Tuer_Zu':true, 'DB_Station.Kabine[2].Gaeste':8 }, { Bereit_1:true, Bereit_2:true, Voll_2:true, Voll_1:false, Abfahrt_frei:true, 'DB_Station.Gaeste_gesamt':12 }],
    [{ 'DB_Station.Kabine[1].Tuer_Zu':true, 'DB_Station.Kabine[1].Gaeste':12, 'DB_Station.Kabine[2].Tuer_Zu':true, 'DB_Station.Kabine[2].Gaeste':1 }, { Bereit_1:false, Voll_1:true, Bereit_2:true, Abfahrt_frei:false, 'DB_Station.Gaeste_gesamt':13 }],
    [{ 'DB_Station.Kabine[1].Tuer_Zu':true, 'DB_Station.Kabine[1].Gaeste':3, 'DB_Station.Kabine[2].Tuer_Zu':false, 'DB_Station.Kabine[2].Gaeste':3 }, { Bereit_1:true, Bereit_2:false, Abfahrt_frei:false, 'DB_Station.Gaeste_gesamt':6 }]],
  bind:['lightGreen=Abfahrt_frei', 'lightRed=Voll_1', 'passengers=DB_Station.Gaeste_gesamt'] });
})();
