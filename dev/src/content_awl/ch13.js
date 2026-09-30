/* ===== AWL QUEST · KAPITEL 13 — Daten: DB, PLC-Datentyp, Array (Profi-Stufe) ===== */
(function(){
const MAIN = body => aOB('Main', body);
const seq = steps => [{ steps }];

const STAT_DB = aDB('DB_Statistik', 'Temp_akt:Int|°C; Temp_max:Int|Tagesmaximum');
const STAT_MAIN = 'NETWORK Messwert\nL  "Temp"\nT  "DB_Statistik".Temp_akt\n\nNETWORK Tagesmaximum\nL  "Temp"\nL  "DB_Statistik".Temp_max\n>I\nSPBN ENDE\nL  "Temp"\nT  "DB_Statistik".Temp_max\nENDE: NOP 0';
defAwlPro({ id:'ap13_db', ch:13, title:'Der Datenbaustein',
  story:'Die Tagesstatistik soll die aktuelle Blocktemperatur und das Tagesmaximum speichern. Dafür gibt es einen globalen <b>Datenbaustein</b> <code>DB_Statistik</code>.',
  brief:'In <code>Main</code>: die Blocktemperatur nach <code>DB_Statistik.Temp_akt</code> schreiben; ist sie grösser als <code>Temp_max</code>, auch dorthin (mit <code>SPBN</code> überspringen).',
  learn:'Werte in einem globalen DB lesen und schreiben.',
  take:'Auf einen globalen DB greifst du mit <code>"DB_Name".Variable</code> zu — mit denselben Anweisungen wie auf jede andere Variable. Die Werte bleiben erhalten.',
  man:'daten', must:['DB_ACCESS', 'CMP_I', 'SPBN'],
  hint:'NW 2: L "Temp" · L "DB_Statistik".Temp_max · >I · SPBN ENDE · L "Temp" · T "DB_Statistik".Temp_max · ENDE: NOP 0',
  blocks:[ { name:'DB_Statistik', kind:'DB', src: STAT_DB }, { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(STAT_MAIN) } ],
  globals:{ Temp:0 },
  timed: seq([[0.1, { Temp:1150 }, { 'DB_Statistik.Temp_akt':1150, 'DB_Statistik.Temp_max':1150 }], [0.1, { Temp:1210 }, { 'DB_Statistik.Temp_max':1210 }], [0.1, { Temp:1180 }, { 'DB_Statistik.Temp_akt':1180, 'DB_Statistik.Temp_max':1210 }]]),
  bind:['furnaceTemp=Temp', 'displayValue=DB_Statistik.Temp_max', 'displayLabel:"MAX °C"'] });

const TOK_FC = aFC('FC_Temp_OK', 'Void', { in:'Temp:Int; Grenze:Int', out:'OK:Bool' }, 'L  #Temp\nL  #Grenze\n>=I\n=  #OK');
const PAR_MAIN = MAIN('CALL "FC_Temp_OK"\n   Temp := "Temp"\n   Grenze := "DB_Parameter".Temp_min\n   OK => "Temp_OK"');
defAwlPro({ id:'ap13_parameter', ch:13, title:'Grenzwerte im Datenbaustein',
  story:'Für zähe Stähle gilt eine höhere Mindesttemperatur als für weiche. Der Grenzwert steht in einem <b>Parameter-DB</b> — so muss niemand das Programm ändern.',
  brief:'Rufe in <code>Main</code> <code>FC_Temp_OK</code> auf: Blocktemperatur an den Eingang Temp, <code>Grenze</code> aus <code>DB_Parameter.Temp_min</code>, <code>OK</code> auf die Meldung Temperatur OK.',
  learn:'Parameter aus einem DB an einen Baustein übergeben.',
  take:'Einstellwerte gehören in einen Datenbaustein, nicht als feste Zahl in den Code — der Baustein bleibt allgemein verwendbar.',
  man:'daten', must:['CALL', 'DB_ACCESS'],
  hint:'Wie ein normaler Aufruf — Grenze bekommt den DB-Wert.',
  blocks:[
    { name:'DB_Parameter', kind:'DB', src: aDB('DB_Parameter', 'Temp_min:Int := 1100|°C') },
    { name:'FC_Temp_OK', kind:'FC', src: TOK_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: PAR_MAIN }
  ],
  globals:{ Temp:0, Temp_OK:false },
  tests:[[{ Temp:1150 }, { Temp_OK:true }], [{ Temp:1050 }, { Temp_OK:false }], [{ Temp:1150, 'DB_Parameter.Temp_min':1200 }, { Temp_OK:false }]],
  wrong:[{ Main: MAIN('CALL "FC_Temp_OK"\n   Temp := "Temp"\n   Grenze := 1100\n   OK => "Temp_OK"') }],
  bind:['furnaceTemp=Temp', 'lightGreen=Temp_OK'] });

const UDT = aUDT('UDT_Geruest', 'Ein:Bool|Antrieb läuft; Stoerung:Bool; Spalt:Int|mm');
const DB_W = aDB('DB_Walzen', 'G1:"UDT_Geruest"; G2:"UDT_Geruest"');
defAwlPro({ id:'ap13_udt', ch:13, title:'Ein Datentyp für Gerüste',
  story:'Beide Gerüste haben dieselben Daten: läuft, Störung, Walzspalt. Ein <b>PLC-Datentyp</b> <code>UDT_Geruest</code> fasst sie zusammen; <code>DB_Walzen</code> enthält <code>G1</code> und <code>G2</code>.',
  brief:'In <code>Main</code>: grüne Lampe, wenn Gerüst <code>G1</code> läuft und keine Störung hat; rote Lampe bei Störung von <code>G1</code> oder <code>G2</code> (Daten in <code>DB_Walzen</code>).',
  learn:'Auf Elemente einer Struktur im DB zugreifen.',
  take:'Zugriff mit Punkten: <code>"DB_Walzen".G1.Stoerung</code> — DB, Struktur, Element. Mit einem UDT sehen alle Gerüste gleich aus.',
  man:'udt', must:['MEMBER', 'UN', 'O'],
  hint:'Zwei Ketten mit den langen Operandennamen.',
  blocks:[ { name:'UDT_Geruest', kind:'UDT', src: UDT }, { name:'DB_Walzen', kind:'DB', src: DB_W },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Gruen\nU  "DB_Walzen".G1.Ein\nUN "DB_Walzen".G1.Stoerung\n=  "Lampe_Gruen"\n\nNETWORK Rot\nO  "DB_Walzen".G1.Stoerung\nO  "DB_Walzen".G2.Stoerung\n=  "Lampe_Rot"') } ],
  globals:{ Lampe_Gruen:false, Lampe_Rot:false },
  tests:[[{ 'DB_Walzen.G1.Ein':true }, { Lampe_Gruen:true, Lampe_Rot:false }], [{ 'DB_Walzen.G1.Ein':true, 'DB_Walzen.G1.Stoerung':true }, { Lampe_Gruen:false, Lampe_Rot:true }], [{ 'DB_Walzen.G2.Stoerung':true }, { Lampe_Rot:true }]],
  bind:['lightGreen=Lampe_Gruen', 'lightRed=Lampe_Rot'] });

defAwlPro({ id:'ap13_db_tabelle', ch:13, title:'Den Datenbaustein anlegen',
  story:'Das Walzwerk bekommt ein drittes Gerüst. Lege den Datenbaustein neu an: drei Gerüste vom Typ <code>UDT_Geruest</code>.',
  brief:'<code>DB_Walzen</code> in der <b>Tabelle</b>: <code>G1</code>, <code>G2</code>, <code>G3</code> vom Typ <code>"UDT_Geruest"</code>. Die Zeile <code>Reserve</code> löschen.',
  learn:'Datenbausteine mit PLC-Datentypen anlegen.',
  take:'Ein DB besteht nur aus Deklarationen. Mit einem UDT als Typ bekommt jedes Element dieselbe Struktur.',
  man:'udt', must:['UDT_REF'],
  hint:'Tabelle → drei Zeilen mit Typ "UDT_Geruest".',
  blocks:[ { name:'UDT_Geruest', kind:'UDT', src: UDT },
    { name:'DB_Walzen', kind:'DB', edit:true, start: aDB('DB_Walzen', 'Reserve:Bool'), ref: aDB('DB_Walzen', 'G1:"UDT_Geruest"; G2:"UDT_Geruest"; G3:"UDT_Geruest"') },
    { name:'Main', kind:'OB', src: MAIN('O  "DB_Walzen".G1.Stoerung\nO  "DB_Walzen".G2.Stoerung\nO  "DB_Walzen".G3.Stoerung\n=  "Lampe_Rot"') } ],
  globals:{ Lampe_Rot:false },
  tests:[[{ 'DB_Walzen.G3.Stoerung':true }, { Lampe_Rot:true }], [{}, { Lampe_Rot:false }]],
  bind:['lightRed=Lampe_Rot'] });

defAwlPro({ id:'ap13_db_dbg', ch:13, title:'Das falsche Gerüst', debug:true,
  story:'Die grüne Lampe von Gerüst 1 leuchtet, sobald Gerüst 2 läuft. ARIA hat im Operanden eine einzige Ziffer verändert.',
  brief:'Symptom: Die grüne Lampe folgt Gerüst 2. Soll: grün, wenn Gerüst <code>G1</code> läuft und keine Störung hat.',
  learn:'Strukturpfade genau lesen.',
  take:'Lange Pfade wie <code>"DB_Walzen".G1.Ein</code> sind gut lesbar — aber eine falsche Ziffer fällt kaum auf. Im Status siehst du, welcher Wert wirklich abgefragt wird.',
  man:'udt', must:['MEMBER'],
  hint:'G2 → G1.',
  blocks:[ { name:'UDT_Geruest', kind:'UDT', src: UDT }, { name:'DB_Walzen', kind:'DB', src: DB_W },
    { name:'Main', kind:'OB', edit:true, start: MAIN('U  "DB_Walzen".G2.Ein\nUN "DB_Walzen".G1.Stoerung\n=  "Lampe_Gruen"'), ref: MAIN('U  "DB_Walzen".G1.Ein\nUN "DB_Walzen".G1.Stoerung\n=  "Lampe_Gruen"') } ],
  globals:{ Lampe_Gruen:false },
  tests:[[{ 'DB_Walzen.G1.Ein':true }, { Lampe_Gruen:true }], [{ 'DB_Walzen.G2.Ein':true }, { Lampe_Gruen:false }]],
  bind:['lightGreen=Lampe_Gruen'] });

const STICH_DB = aDB('DB_Stich', 'Spalt:Array[1..3] of Int|Walzspalt je Stich in mm');
defAwlPro({ id:'ap13_array', ch:13, title:'Der Stichplan',
  story:'Der Stichplan steht in einem <b>Array</b>: <code>Spalt[1]</code> bis <code>Spalt[3]</code>, der Walzspalt für jeden Stich. Der Leitstand will die Gesamtabnahme: erster minus letzter Spalt.',
  brief:'In <code>Main</code>: Abnahme = <code>DB_Stich.Spalt[1]</code> − <code>Spalt[3]</code>; der Spalt-Sollwert ist <code>Spalt[1]</code>.',
  learn:'Array-Elemente mit fester Nummer.',
  take:'<code>Spalt : Array[1..3] of Int</code> ist eine nummerierte Reihe. In AWL greifst du mit fester Nummer zu: <code>L "DB_Stich".Spalt[2]</code>.',
  man:'udt', must:['ARRAY', '-I'],
  hint:'L Spalt[1] · L Spalt[3] · -I · T Abnahme, dann L Spalt[1] · T Spalt_Soll.',
  blocks:[ { name:'DB_Stich', kind:'DB', src: STICH_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('L  "DB_Stich".Spalt[1]\nL  "DB_Stich".Spalt[3]\n-I\nT  "Abnahme"\nL  "DB_Stich".Spalt[1]\nT  "Spalt_Soll"') } ],
  globals:{ Abnahme:0, Spalt_Soll:0 },
  tests:[[{ 'DB_Stich.Spalt[1]':90, 'DB_Stich.Spalt[2]':70, 'DB_Stich.Spalt[3]':55 }, { Abnahme:35, Spalt_Soll:90 }], [{ 'DB_Stich.Spalt[1]':40, 'DB_Stich.Spalt[3]':30 }, { Abnahme:10 }]],
  bind:['rollGap=Spalt_Soll', 'displayValue=Abnahme', 'displayLabel:"ABNAHME mm"'] });

const OK_FC = aFC('FC_Geruest_OK', 'Void', { in:'G:"UDT_Geruest"|Daten des Gerüsts', out:'Bereit:Bool' }, 'U  #G.Ein\nUN #G.Stoerung\n=  #Bereit');
defAwlPro({ id:'ap13_struct_param', ch:13, title:'Das Gerüst als Parameter',
  story:'Statt drei einzelner Parameter bekommt der Baustein ein ganzes Gerüst übergeben — einen Wert vom Typ <code>"UDT_Geruest"</code>.',
  brief:'<code>FC_Geruest_OK</code> (Input <code>G : "UDT_Geruest"</code>): <code>#Bereit</code> = <code>#G.Ein</code> UND NICHT <code>#G.Stoerung</code>',
  learn:'Strukturen als Bausteinparameter.',
  take:'Ein UDT als Parameter hält die Schnittstelle klein. Im Baustein greifst du mit <code>#G.Element</code> darauf zu.',
  man:'udt', must:['UDT_REF', 'MEMBER'],
  hint:'U #G.Ein · UN #G.Stoerung · = #Bereit',
  blocks:[ { name:'UDT_Geruest', kind:'UDT', src: UDT }, { name:'DB_Walzen', kind:'DB', src: DB_W },
    { name:'FC_Geruest_OK', kind:'FC', edit:true, start: aFC('FC_Geruest_OK', 'Void', { in:'G:"UDT_Geruest"', out:'Bereit:Bool' }, ''), ref: OK_FC },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Geruest_OK"\n   G := "DB_Walzen".G1\n   Bereit => "G1_bereit"') } ],
  globals:{ G1_bereit:false },
  tests:[[{ 'DB_Walzen.G1.Ein':true }, { G1_bereit:true }], [{ 'DB_Walzen.G1.Ein':true, 'DB_Walzen.G1.Stoerung':true }, { G1_bereit:false }]],
  bind:['lightGreen=G1_bereit'] });

const LOG_DB = aDB('DB_Protokoll', 'Temp:Int; Spalt:Int; Bloecke:Int');
defAwlPro({ id:'ap13_protokoll', ch:13, title:'Das Blockprotokoll',
  story:'Verlässt ein Block die Schere, schreibt das Protokoll bei der <b>steigenden Flanke</b> seine Temperatur und seinen Walzspalt. Ausserdem zählt das Protokoll die Blöcke.',
  brief:'Bei steigender Flanke der Lichtschranke Block raus (mit Flankenmerker) Temperatur und Spalt in <code>DB_Protokoll</code> schreiben und dort <code>Bloecke</code> um 1 erhöhen (<code>FP</code>, <code>SPBN</code>, <code>INC</code>).',
  learn:'Werte ereignisgesteuert in einen DB schreiben.',
  take:'Mit Flanke und Sprung schreibst du einen Datensatz genau einmal pro Ereignis. Globale Flankenmerker stehen wie jede PLC-Variable in Anführungszeichen.',
  man:'daten', must:['DB_ACCESS', 'FP', 'SPBN', 'INC'],
  hint:'Wie das Selbstzählen in Kapitel 10 — mit DB-Operanden.',
  blocks:[ { name:'DB_Protokoll', kind:'DB', src: LOG_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('U  "Block_raus"\nFP "M_Block"\nSPBN ENDE\nL  "Temp"\nT  "DB_Protokoll".Temp\nL  "Spalt"\nT  "DB_Protokoll".Spalt\nL  "DB_Protokoll".Bloecke\nINC 1\nT  "DB_Protokoll".Bloecke\nENDE: NOP 0') } ],
  globals:{ Block_raus:false, M_Block:false, Temp:0, Spalt:0 },
  timed: seq([[0.1, { Temp:1180, Spalt:12, Block_raus:true }, { 'DB_Protokoll.Temp':1180, 'DB_Protokoll.Spalt':12, 'DB_Protokoll.Bloecke':1 }], [0.1, { Temp:1170 }, { 'DB_Protokoll.Temp':1180, 'DB_Protokoll.Bloecke':1 }], [0.1, { Block_raus:false }, {}], [0.1, { Block_raus:true, Spalt:14 }, { 'DB_Protokoll.Temp':1170, 'DB_Protokoll.Spalt':14, 'DB_Protokoll.Bloecke':2 }]]),
  bind:['billetVisible=Block_raus', 'pieceCount=DB_Protokoll.Bloecke'] });

defAwlPro({ id:'ap13_array_dbg', ch:13, title:'Der falsche Stich', debug:true,
  story:'Die Gesamtabnahme ist immer viel zu klein. ARIA hat einen Index im Stichplan verändert.',
  brief:'Die Abnahme ist <code>Spalt[1]</code> − <code>Spalt[3]</code> (erster minus letzter Stich).',
  learn:'Array-Indizes prüfen.',
  take:'Ein falscher Index greift auf ein anderes Element zu — der Code übersetzt trotzdem. Prüfe Indizes immer gegen den Plan.',
  man:'udt', must:['ARRAY'],
  hint:'Spalt[2] → Spalt[3].',
  blocks:[ { name:'DB_Stich', kind:'DB', src: STICH_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN('L  "DB_Stich".Spalt[1]\nL  "DB_Stich".Spalt[2]\n-I\nT  "Abnahme"'), ref: MAIN('L  "DB_Stich".Spalt[1]\nL  "DB_Stich".Spalt[3]\n-I\nT  "Abnahme"') } ],
  globals:{ Abnahme:0 },
  tests:[[{ 'DB_Stich.Spalt[1]':90, 'DB_Stich.Spalt[2]':70, 'DB_Stich.Spalt[3]':55 }, { Abnahme:35 }]],
  bind:['displayValue=Abnahme', 'displayLabel:"ABNAHME mm"'] });

const PLAN_UDT = aUDT('UDT_Stich', 'Spalt:Int|mm; Tempo:Int|Walzgeschwindigkeit');
const PLAN_DB = aDB('DB_Stichplan', 'Stich:Array[1..3] of "UDT_Stich"');
const PLAN_MAIN = 'NETWORK Stich 1\nL  "Nr"\nL  1\n==I\nSPBN S2\nL  "DB_Stichplan".Stich[1].Spalt\nT  "Spalt_Soll"\nL  "DB_Stichplan".Stich[1].Tempo\nT  "Tempo_Soll"\nSPA ENDE\n\nNETWORK Stich 2\nS2: L  "Nr"\nL  2\n==I\nSPBN S3\nL  "DB_Stichplan".Stich[2].Spalt\nT  "Spalt_Soll"\nL  "DB_Stichplan".Stich[2].Tempo\nT  "Tempo_Soll"\nSPA ENDE\n\nNETWORK Stich 3\nS3: L  "Nr"\nL  3\n==I\nSPBN FEHL\nL  "DB_Stichplan".Stich[3].Spalt\nT  "Spalt_Soll"\nL  "DB_Stichplan".Stich[3].Tempo\nT  "Tempo_Soll"\nSPA ENDE\n\nNETWORK Ungueltig\nFEHL: L  0\nT  "Spalt_Soll"\nT  "Tempo_Soll"\nENDE: NOP 0';
defAwlPro({ id:'ap13_boss', ch:13, title:'Boss: Der Stichplan-Verteiler', boss:true,
  story:'ARIA hat den Stichplan durcheinandergebracht. Herr Brunner: „Für Stich 1, 2 oder 3 vom Leitstand holst du Spalt und Geschwindigkeit aus dem Stichplan, jede andere Nummer ist ungültig und setzt Spalt und Tempo auf 0.“',
  brief:'Sprungverteiler in <code>Main</code>: Für Stichnummer 1, 2 oder 3 Spalt und Tempo aus <code>DB_Stichplan.Stich[n]</code> in die beiden Sollwerte laden, sonst beide 0. Je Fall <code>==I</code>, <code>SPBN</code> zum nächsten, <code>SPA ENDE</code>.',
  learn:'Sprungverteiler mit Array und Struktur.',
  take:'Ein Sprungverteiler wählt nach einer Zahl den passenden Abschnitt — in SCL wäre das CASE. Die Daten dafür liegen strukturiert im DB.',
  man:'udt', must:['ARRAY', 'MEMBER', 'CMP_I', 'SPBN', 'SPA'],
  hint:'Vier Netzwerke mit den Marken S2, S3, FEHL und ENDE.',
  hint2:'Im letzten Netzwerk genügt ein L 0 für zwei T.',
  blocks:[ { name:'UDT_Stich', kind:'UDT', src: PLAN_UDT }, { name:'DB_Stichplan', kind:'DB', src: PLAN_DB },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(PLAN_MAIN) } ],
  globals:{ Nr:0, Spalt_Soll:0, Tempo_Soll:0 },
  tests:[[{ Nr:1, 'DB_Stichplan.Stich[1].Spalt':90, 'DB_Stichplan.Stich[1].Tempo':3 }, { Spalt_Soll:90, Tempo_Soll:3 }], [{ Nr:2, 'DB_Stichplan.Stich[2].Spalt':70, 'DB_Stichplan.Stich[2].Tempo':4 }, { Spalt_Soll:70, Tempo_Soll:4 }], [{ Nr:3, 'DB_Stichplan.Stich[3].Spalt':55, 'DB_Stichplan.Stich[3].Tempo':6 }, { Spalt_Soll:55, Tempo_Soll:6 }], [{ Nr:9, Spalt_Soll:12, Tempo_Soll:2 }, { Spalt_Soll:0, Tempo_Soll:0 }]],
  bind:['rollGap=Spalt_Soll', 'displayValue=Nr', 'displayLabel:"STICH"'] });
})();
