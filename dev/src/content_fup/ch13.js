/* ===== FUP QUEST · KAPITEL 13 — Daten: DB, PLC-Datentyp, Array (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const UDT = kUDT('UDT_Weiche', 'Nummer:Int; Links:Bool|Endlage links; Rechts:Bool|Endlage rechts; Gestoert:Bool; Umstellungen:Int');
const DB_W = kDB('DB_Weichen', 'W1:"UDT_Weiche"; W2:"UDT_Weiche"');

defFupPro({ id:'fp13_db', ch:13, title:'Der Datenbaustein',
  story:'Die Betriebsleitung will wissen, wie schnell der schnellste Zug heute war. Solche Werte gehören in einen <b>globalen Datenbaustein</b>.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> ohne Bedingung → MOVE Tempo nach <code>"DB_Statistik".Tempo_akt</code><br><b>NW 2:</b> Tempo höher als <code>"DB_Statistik".Tempo_max</code> → MOVE Tempo dorthin',
  learn:'In einen globalen DB schreiben und daraus lesen.',
  take:'Ein <b>globaler Datenbaustein</b> speichert Daten für das ganze Programm: <code>"DB_Name".Variable</code>. Seine Werte bleiben erhalten.',
  man:'daten', must:['DB_ACCESS','MOVE','CMP'],
  hint:'Operanden mit Anführungszeichen um den DB-Namen: "DB_Statistik".Tempo_max',
  blocks:[
    { name:'DB_Statistik', kind:'DB', src: kDB('DB_Statistik', 'Tempo_akt:Int; Tempo_max:Int|Tagesmaximum') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Messwert\n=> MOVE("Tempo", "DB_Statistik".Tempo_akt);\n\nNETWORK Tagesmaximum\n["Tempo" > "DB_Statistik".Tempo_max] => MOVE("Tempo", "DB_Statistik".Tempo_max);') }
  ],
  globals:{ Tempo:0 },
  timed:[{ steps:[[0.1,{ Tempo:60 },{ 'DB_Statistik.Tempo_akt':60, 'DB_Statistik.Tempo_max':60 }],[0.1,{ Tempo:85 },{ 'DB_Statistik.Tempo_max':85 }],[0.1,{ Tempo:40 },{ 'DB_Statistik.Tempo_akt':40, 'DB_Statistik.Tempo_max':85 }]] }],
  bind:['trainSpeed=Tempo', 'displayValue=DB_Statistik.Tempo_max', 'displayLabel:"MAX km/h"'] });

const VZ_FC = kFC('FC_Vzul', 'Int', { in:'Abzweig:Bool; V_gerade:Int; V_abzweig:Int' }, 'NETWORK Gerade\n=> MOVE(#V_gerade, #Ret_Val);\n\nNETWORK Abzweig\n#Abzweig => MOVE(#V_abzweig, #Ret_Val);');
const VZ_MAIN = MAIN('NETWORK Zulaessige Geschwindigkeit\n=> "FC_Vzul"(Abzweig := "W1_rechts", V_gerade := "DB_Parameter".V_gerade, V_abzweig := "DB_Parameter".V_abzweig, Ret_Val => "V_zul");');
defFupPro({ id:'fp13_parameter', ch:13, title:'Grenzwerte im Datenbaustein',
  story:'Nach dem Umbau der Weichen gelten neue Geschwindigkeiten. Die Werte stehen in einem <b>Parameter-DB</b>, damit niemand das Programm ändern muss.',
  brief:'Rufe in <code>Main</code> <code>"FC_Vzul"</code> auf: Abzweig = Weiche 1 rechts, Grenzwerte aus <code>"DB_Parameter"</code>, Rückgabewert → zulässige Geschwindigkeit.',
  learn:'Parameter aus einem DB an einen Baustein übergeben.',
  take:'Einstellwerte gehören in einen Datenbaustein, nicht als feste Zahl ins Netzwerk — der Baustein bleibt allgemein verwendbar.',
  man:'daten', must:['CALL','DB_ACCESS'],
  hint:'Aufruf-Box "FC_Vzul", Parameter in die Felder tippen.',
  blocks:[
    { name:'DB_Parameter', kind:'DB', src: kDB('DB_Parameter', 'V_gerade:Int := 80|km/h; V_abzweig:Int := 40|km/h') },
    { name:'FC_Vzul', kind:'FC', src: VZ_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: VZ_MAIN }
  ],
  globals:{ W1_rechts:false, V_zul:0 },
  tests:[[{}, { V_zul:80 }], [{ W1_rechts:true }, { V_zul:40 }], [{ W1_rechts:true, 'DB_Parameter.V_abzweig':60 }, { V_zul:60 }]],
  wrong:[{ Main: MAIN('NETWORK Zulaessige Geschwindigkeit\n=> "FC_Vzul"(Abzweig := "W1_rechts", V_gerade := 80, V_abzweig := 40, Ret_Val => "V_zul");') }],
  bind:['switch1Right=W1_rechts', 'displayValue=V_zul', 'displayLabel:"V zulässig"'] });

defFupPro({ id:'fp13_udt', ch:13, title:'Ein Datentyp für Weichen',
  story:'Jede Weiche hat eine Nummer, zwei Endlagen, einen Störstatus und einen Umstellzähler. Frau Gasser hat daraus einen <b>PLC-Datentyp</b> gemacht: <code>UDT_Weiche</code>.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> <code>"DB_Weichen".W1.Links</code> XOR <code>.Rechts</code> → Lage Weiche 1 OK<br><b>NW 2:</b> W1 oder W2 gestört (<code>.Gestoert</code>) → roter Melder',
  learn:'Auf Elemente einer Struktur im DB zugreifen.',
  take:'Ein PLC-Datentyp bündelt zusammengehörige Werte. Zugriff mit Punkt: <code>"DB_Weichen".W1.Links</code>.',
  man:'udt', must:['DB_ACCESS','MEMBER','XOR'],
  hint:'Die Operanden sind lang — tippe sie ins Feld oder nutze die Textansicht.',
  blocks:[ { name:'UDT_Weiche', kind:'UDT', src: UDT }, { name:'DB_Weichen', kind:'DB', src: DB_W },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Lage W1\n"DB_Weichen".W1.Links XOR "DB_Weichen".W1.Rechts => "W1_Lage_OK";\n\nNETWORK Stoerung\n"DB_Weichen".W1.Gestoert OR "DB_Weichen".W2.Gestoert => "Melder_Rot";') } ],
  globals:{ W1_Lage_OK:false, Melder_Rot:false },
  tests:[[{ 'DB_Weichen.W1.Links':true }, { W1_Lage_OK:true, Melder_Rot:false }], [{ 'DB_Weichen.W1.Links':true, 'DB_Weichen.W1.Rechts':true }, { W1_Lage_OK:false }], [{ 'DB_Weichen.W2.Gestoert':true }, { Melder_Rot:true }]],
  bind:['lightGreen=W1_Lage_OK', 'lightRed=Melder_Rot'] });

defFupPro({ id:'fp13_db_tabelle', ch:13, title:'Den Datenbaustein anlegen',
  story:'Das Stellwerk bekommt eine dritte Weiche — und ARIA hat den Weichen-DB geleert. Du legst die Weichen neu an, in der Tabelle des DB.',
  brief:'Öffne <code>DB_Weichen</code> und lege in der <b>Tabelle</b> <code>W1</code>, <code>W2</code>, <code>W3</code> vom Typ <code>"UDT_Weiche"</code> an. <code>Main</code> (🔒) benutzt sie schon.',
  learn:'Variablen eines PLC-Datentyps in einem DB deklarieren.',
  take:'Ein DB wird wie eine Schnittstelle als Tabelle deklariert. Ein PLC-Datentyp wird wie ein Grundtyp benutzt: <code>W1 : "UDT_Weiche"</code>.',
  man:'udt', must:['UDT_REF'],
  hint:'Datentyp mit Anführungszeichen: "UDT_Weiche".',
  blocks:[ { name:'UDT_Weiche', kind:'UDT', src: UDT },
    { name:'DB_Weichen', kind:'DB', edit:true, start: kDB('DB_Weichen', 'Reserve:Bool'), ref: kDB('DB_Weichen', 'W1:"UDT_Weiche"; W2:"UDT_Weiche"; W3:"UDT_Weiche"') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Sammelstoerung\n"DB_Weichen".W1.Gestoert OR "DB_Weichen".W2.Gestoert OR "DB_Weichen".W3.Gestoert => "Melder_Rot";') } ],
  globals:{ Melder_Rot:false },
  tests:[[{ 'DB_Weichen.W3.Gestoert':true }, { Melder_Rot:true }], [{}, { Melder_Rot:false }]],
  bind:['lightRed=Melder_Rot'] });

defFupPro({ id:'fp13_db_dbg', ch:13, title:'Die falsche Weiche', debug:true,
  story:'Die Lagemeldung von Weiche 1 zeigt die Lage von Weiche 2. ARIA hat einen Pfad verändert.',
  brief:'Die Lagemeldung von Weiche 1 darf nur die Endlagen von <b>W1</b> auswerten.',
  learn:'Strukturpfade genau lesen.',
  take:'<code>W1</code> und <code>W2</code> haben denselben Typ — der Compiler merkt die Verwechslung nicht.',
  man:'udt', must:['MEMBER'],
  hint:'Welcher Eingang greift auf W2 zu?',
  blocks:[ { name:'UDT_Weiche', kind:'UDT', src: UDT }, { name:'DB_Weichen', kind:'DB', src: DB_W },
    { name:'Main', kind:'OB', edit:true, start: MAIN('NETWORK Lage W1\n"DB_Weichen".W1.Links XOR "DB_Weichen".W2.Rechts => "W1_Lage_OK";'), ref: MAIN('NETWORK Lage W1\n"DB_Weichen".W1.Links XOR "DB_Weichen".W1.Rechts => "W1_Lage_OK";') } ],
  globals:{ W1_Lage_OK:false },
  tests:[[{ 'DB_Weichen.W1.Links':true, 'DB_Weichen.W1.Rechts':true }, { W1_Lage_OK:false }], [{ 'DB_Weichen.W1.Rechts':true, 'DB_Weichen.W2.Rechts':true }, { W1_Lage_OK:true }]],
  bind:['lightGreen=W1_Lage_OK'] });

const DB_G = kDB('DB_Gleis', 'Besetzt:Array[1..4] of Bool|Abschnitte 1–4');
const ARR_NW = 'NETWORK Irgendein Abschnitt besetzt\n"DB_Gleis".Besetzt[1] OR "DB_Gleis".Besetzt[2] OR "DB_Gleis".Besetzt[3] OR "DB_Gleis".Besetzt[4] => "Melder_Rot";\n\nNETWORK Strecke frei\nNOT "DB_Gleis".Besetzt[1] AND NOT "DB_Gleis".Besetzt[2] AND NOT "DB_Gleis".Besetzt[3] AND NOT "DB_Gleis".Besetzt[4] => "Strecke_frei";';
const arrT = [[0,0,0,0],[1,0,0,0],[0,0,0,1],[1,1,0,1]].map(a => { const o = {}; a.forEach((v, i) => { o['DB_Gleis.Besetzt[' + (i + 1) + ']'] = !!v; }); return [o, { Melder_Rot: a.some(Boolean), Strecke_frei: !a.some(Boolean) }]; });
defFupPro({ id:'fp13_array', ch:13, title:'Gleisabschnitte im Array',
  story:'Die Strecke ist in vier Abschnitte geteilt, deren Belegung in einem <b>Array</b> steht: <code>Besetzt[1..4]</code>.',
  brief:'In <code>Main</code>:<br><b>NW 1:</b> irgendein Abschnitt besetzt (&gt;=1-Box, <code>"DB_Gleis".Besetzt[1]</code> … <code>[4]</code>) → roter Melder<br><b>NW 2:</b> alle vier <b>nicht</b> besetzt (&amp;-Box) → Strecke frei',
  learn:'Feste Array-Elemente als Operanden.',
  take:'Ein <b>Array</b> ist eine nummerierte Reihe gleicher Werte. Im Funktionsplan greift man mit fester Nummer zu: <code>Besetzt[3]</code>.',
  man:'udt', must:['ARRAY','PARALLEL','NC'],
  hint:'NW 2: &-Box mit vier negierten Eingängen.',
  blocks:[ { name:'DB_Gleis', kind:'DB', src: DB_G }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(ARR_NW) } ],
  globals:{ Melder_Rot:false, Strecke_frei:false },
  tests: arrT,
  bind:['lightRed=Melder_Rot', 'lightGreen=Strecke_frei'] });

const WOK_FC = kFC('FC_Weiche_OK', 'Void', { in:'W:"UDT_Weiche"|Daten der Weiche', out:'Befahrbar:Bool' }, 'NETWORK Befahrbar\n(#W.Links XOR #W.Rechts) AND NOT #W.Gestoert => #Befahrbar;');
defFupPro({ id:'fp13_struct_param', ch:13, title:'Die Weiche als Parameter',
  story:'Statt vier einzelner Parameter bekommt der Baustein eine ganze Weiche übergeben — einen Wert vom Typ <code>"UDT_Weiche"</code>.',
  brief:'<code>FC_Weiche_OK</code> (Input <code>W : "UDT_Weiche"</code>): (<code>#W.Links</code> XOR <code>#W.Rechts</code>) und nicht <code>#W.Gestoert</code> → <code>#Befahrbar</code>',
  learn:'Strukturen als Bausteinparameter.',
  take:'Ein UDT als Parameter hält die Schnittstelle klein. Im Baustein: <code>#W.Element</code>.',
  man:'udt', must:['UDT_REF','MEMBER','XOR'],
  hint:'&-Box: X-Box und negierter Eingang #W.Gestoert.',
  blocks:[ { name:'UDT_Weiche', kind:'UDT', src: UDT }, { name:'DB_Weichen', kind:'DB', src: DB_W },
    { name:'FC_Weiche_OK', kind:'FC', edit:true, start: kFC('FC_Weiche_OK', 'Void', { in:'W:"UDT_Weiche"', out:'Befahrbar:Bool' }, ''), ref: WOK_FC },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 1\n=> "FC_Weiche_OK"(W := "DB_Weichen".W1, Befahrbar => "W1_befahrbar");') } ],
  globals:{ W1_befahrbar:false },
  tests:[[{ 'DB_Weichen.W1.Links':true }, { W1_befahrbar:true }], [{ 'DB_Weichen.W1.Links':true, 'DB_Weichen.W1.Gestoert':true }, { W1_befahrbar:false }], [{ 'DB_Weichen.W1.Links':true, 'DB_Weichen.W1.Rechts':true }, { W1_befahrbar:false }]],
  bind:['lightGreen=W1_befahrbar'] });

const UDT_Z = kUDT('UDT_Zug', 'Nummer:Int; Achsen:Int; Tempo:Int');
defFupPro({ id:'fp13_move_struct', ch:13, title:'Der Zug fährt ein',
  story:'Wenn der Zug im Gleis 1 angekommen ist, wandern seine Daten vom Datensatz <code>Einfahrt</code> nach <code>Gleis1</code>. Ein MOVE kopiert die ganze Struktur.',
  brief:'Ist der Zug angekommen → MOVE <code>"DB_Zuege".Einfahrt</code> nach <code>"DB_Zuege".Gleis1</code>',
  learn:'Ganze Strukturen mit MOVE kopieren.',
  take:'MOVE kopiert auch Strukturen — bei gleichem Datentyp alle Elemente auf einmal.',
  man:'udt', must:['MOVE','MEMBER'],
  hint:'MOVE-Box mit IN "DB_Zuege".Einfahrt und OUT "DB_Zuege".Gleis1.',
  blocks:[ { name:'UDT_Zug', kind:'UDT', src: UDT_Z }, { name:'DB_Zuege', kind:'DB', src: kDB('DB_Zuege', 'Einfahrt:"UDT_Zug"; Gleis1:"UDT_Zug"') },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Zug uebernehmen\n"Zug_angekommen" => MOVE("DB_Zuege".Einfahrt, "DB_Zuege".Gleis1);') } ],
  globals:{ Zug_angekommen:false },
  timed:[{ setup:{ 'DB_Zuege.Einfahrt.Nummer':4711, 'DB_Zuege.Einfahrt.Achsen':12 }, steps:[[0.1,{},{ 'DB_Zuege.Gleis1.Nummer':0 }],[0.1,{ Zug_angekommen:true },{ 'DB_Zuege.Gleis1.Nummer':4711, 'DB_Zuege.Gleis1.Achsen':12 }],[0.1,{ Zug_angekommen:false, 'DB_Zuege.Einfahrt.Nummer':815 },{ 'DB_Zuege.Gleis1.Nummer':4711 }]] }],
  bind:['displayValue=DB_Zuege.Gleis1.Nummer', 'displayLabel:"ZUG GLEIS 1"'] });

defFupPro({ id:'fp13_array_dbg', ch:13, title:'Abschnitt 4 fehlt', debug:true,
  story:'Die Strecke wird frei gemeldet, obwohl im letzten Abschnitt ein Zug steht. ARIA hat einen Index doppelt verwendet.',
  brief:'„Strecke frei“ nur, wenn <b>alle vier</b> Abschnitte frei sind.',
  learn:'Array-Indizes vollständig prüfen.',
  take:'Fehler an Arrays passieren an den Rändern: doppelte, vergessene oder falsche Indizes.',
  man:'udt', must:['ARRAY'],
  hint:'Lies die Indizes der negierten Eingänge in NW 2.',
  blocks:[ { name:'DB_Gleis', kind:'DB', src: DB_G }, { name:'Main', kind:'OB', edit:true, start: MAIN(ARR_NW.replace('NOT "DB_Gleis".Besetzt[3] AND NOT "DB_Gleis".Besetzt[4]', 'NOT "DB_Gleis".Besetzt[3] AND NOT "DB_Gleis".Besetzt[3]')), ref: MAIN(ARR_NW) } ],
  globals:{ Melder_Rot:false, Strecke_frei:false },
  tests: arrT,
  bind:['lightRed=Melder_Rot', 'lightGreen=Strecke_frei'] });

const DB_S = kDB('DB_Stellwerk', 'Weiche:Array[1..2] of "UDT_Weiche"; Umstellungen:Int');
const BOSS_MAIN = 'NETWORK Weiche 1\n=> "FC_Weiche_OK"(W := "DB_Stellwerk".Weiche[1], Befahrbar => "W1_befahrbar");\n\nNETWORK Weiche 2\n=> "FC_Weiche_OK"(W := "DB_Stellwerk".Weiche[2], Befahrbar => "W2_befahrbar");\n\nNETWORK Fahrweg\n"W1_befahrbar" AND "W2_befahrbar" => "Fahrweg_OK";\n\nNETWORK Umstellungen\n=> ADD("DB_Stellwerk".Weiche[1].Umstellungen, "DB_Stellwerk".Weiche[2].Umstellungen, "DB_Stellwerk".Umstellungen);';
defFupPro({ id:'fp13_boss', ch:13, title:'Boss: Die Weichendaten', boss:true,
  story:'ARIA hat die Weichendaten durcheinandergebracht. Frau Gasser: „Ein Datentyp, ein Array, ein Baustein, und die Wartung will die Summe der Umstellungen.“',
  brief:'<b>FC_Weiche_OK</b>: <code>#W.Links</code> XOR <code>#W.Rechts</code>, nicht <code>#W.Gestoert</code> → <code>#Befahrbar</code><br><b>Main:</b> je ein Aufruf für <code>"DB_Stellwerk".Weiche[1]</code>/<code>[2]</code> → Weiche befahrbar; beide → Fahrweg OK; ADD der <code>.Umstellungen</code> → <code>"DB_Stellwerk".Umstellungen</code>',
  learn:'Array von Strukturen, Strukturparameter und Rechnen mit DB-Werten.',
  take:'Mit PLC-Datentypen und Arrays haben alle Weichen dieselbe Datenform — ein Baustein bearbeitet sie alle.',
  man:'udt', must:['UDT_REF','ARRAY','CALL','ADD','DB_ACCESS'],
  hint:'Zuerst FC_Weiche_OK, dann Main.',
  blocks:[ { name:'UDT_Weiche', kind:'UDT', src: UDT }, { name:'DB_Stellwerk', kind:'DB', src: DB_S },
    { name:'FC_Weiche_OK', kind:'FC', edit:true, start: kFC('FC_Weiche_OK', 'Void', { in:'W:"UDT_Weiche"', out:'Befahrbar:Bool' }, ''), ref: WOK_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(BOSS_MAIN) } ],
  globals:{ W1_befahrbar:false, W2_befahrbar:false, Fahrweg_OK:false },
  tests:[[{ 'DB_Stellwerk.Weiche[1].Links':true, 'DB_Stellwerk.Weiche[2].Rechts':true, 'DB_Stellwerk.Weiche[1].Umstellungen':10, 'DB_Stellwerk.Weiche[2].Umstellungen':5 }, { W1_befahrbar:true, W2_befahrbar:true, Fahrweg_OK:true, 'DB_Stellwerk.Umstellungen':15 }],
    [{ 'DB_Stellwerk.Weiche[1].Links':true, 'DB_Stellwerk.Weiche[2].Rechts':true, 'DB_Stellwerk.Weiche[2].Gestoert':true }, { W2_befahrbar:false, Fahrweg_OK:false }],
    [{ 'DB_Stellwerk.Weiche[1].Links':true, 'DB_Stellwerk.Weiche[1].Rechts':true, 'DB_Stellwerk.Weiche[2].Links':true }, { W1_befahrbar:false, W2_befahrbar:true, Fahrweg_OK:false }]],
  bind:['lightGreen=Fahrweg_OK', 'displayValue=DB_Stellwerk.Umstellungen', 'displayLabel:"UMSTELLUNGEN"'] });
})();
