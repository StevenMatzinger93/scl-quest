/* ===== KAPITEL 11 — Die Schnittstelle: Deklarationen & Datentypen (Profi-Stufe) ===== */
(function(){
// Hilfen: Impulsfolge für Zähl-Tests (jeweils TRUE-Zyklus + FALSE-Zyklus)
function puls(n, sig, expFn, dt){
  const out = [];
  for(let i = 1; i <= n; i++){
    out.push([dt || 0.1, {[sig]: true}, expFn ? expFn(i) : {}]);
    out.push([dt || 0.1, {[sig]: false}, {}]);
  }
  return out;
}
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';

/* ---------- 101 ---------- */
defProTask({ id:'p11_deklaration', ch:11, title:'Erste Deklaration', table:false,
  story:'ARIA hat ein Backup von sich versteckt und die Variablentabelle gelöscht, nun kennt die SPS keine einzige Variable. "Ab heute schreibst du Bausteine mit Deklaration, wie im TIA Portal", sagt der Werkmeister.',
  brief:'Im Baustein <code>FB_Lampe</code> steht die Anweisung schon: <code>#Lampe := #Taster;</code>. Deklariere die beiden Variablen vor <code>BEGIN</code>:<br>• Eingang <code>Taster</code> vom Typ <code>Bool</code> → Bereich <code>VAR_INPUT … END_VAR</code><br>• Ausgang <code>Lampe</code> vom Typ <code>Bool</code> → Bereich <code>VAR_OUTPUT … END_VAR</code><br>Jede Zeile: <code>Name : Typ;</code>. Der Organisationsbaustein <code>Main</code> (🔒) ruft deinen FB auf und verbindet ihn mit Taster <code>"S_Start"</code> und Lampe <code>"H_Gruen"</code>.',
  learn:'Variablen in einem Baustein deklarieren: Bereich, Name, Datentyp.',
  take:'Jede Variable braucht eine Deklaration: <code>Name : Typ;</code> im passenden Bereich. Eingänge stehen in <code>VAR_INPUT</code>, Ausgänge in <code>VAR_OUTPUT</code>. Im Code schreibt man lokale Variablen mit <code>#</code>.',
  man:'deklaration', must:['VAR_INPUT','VAR_OUTPUT'],
  hint:'Zwei Bereiche vor BEGIN: <code>VAR_INPUT</code> mit <code>Taster : Bool;</code> und <code>VAR_OUTPUT</code> mit <code>Lampe : Bool;</code> — beide mit <code>END_VAR</code> abschliessen.',
  hint2:'<pre class="code">VAR_INPUT\n   Taster : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lampe : Bool;\nEND_VAR</pre>',
  blocks:[
    { name:'FB_Lampe', kind:'FB', edit:true,
      start:'FUNCTION_BLOCK "FB_Lampe"\n// Schnittstelle — hier fehlen die Deklarationen:\n//   Eingang:  Taster (Bool)\n//   Ausgang:  Lampe  (Bool)\n\nBEGIN\n   #Lampe := #Taster;\nEND_FUNCTION_BLOCK',
      ref:'FUNCTION_BLOCK "FB_Lampe"\nVAR_INPUT\n   Taster : Bool;   // Starttaster\nEND_VAR\nVAR_OUTPUT\n   Lampe : Bool;    // grüne Lampe\nEND_VAR\nBEGIN\n   #Lampe := #Taster;\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Lampe_DB"(Taster := "S_Start", Lampe => "H_Gruen");') }
  ],
  globals:{ S_Start:false, H_Gruen:false }, comments:{ S_Start:'Taster Start', H_Gruen:'Signalsäule grün' },
  unit:[{ block:'FB_Lampe', steps:[[{Taster:true},{Lampe:true}],[{Taster:false},{Lampe:false}]] }],
  timed:[{ steps:[[0.1,{S_Start:true},{H_Gruen:true}],[0.1,{S_Start:false},{H_Gruen:false}],[0.1,{S_Start:true},{H_Gruen:true}]] }],
  bind:['lightGreen=H_Gruen'],
  wrong:[
    { FB_Lampe:'FUNCTION_BLOCK "FB_Lampe"\nVAR\n   Taster : Bool;\n   Lampe : Bool;\nEND_VAR\nBEGIN\n   #Lampe := #Taster;\nEND_FUNCTION_BLOCK' },
    { FB_Lampe:'FUNCTION_BLOCK "FB_Lampe"\nVAR_OUTPUT\n   Taster : Bool;\nEND_VAR\nVAR_INPUT\n   Lampe : Bool;\nEND_VAR\nBEGIN\n   #Lampe := #Taster;\nEND_FUNCTION_BLOCK' }
  ]
});

/* ---------- 102 ---------- */
defProTask({ id:'p11_typen', ch:11, title:'Den richtigen Typ wählen', table:false,
  story:'Die Temperaturmessung am Ofen liefert Unsinn, weil der Typ nicht passt. Der Werkmeister: "Taster wahr oder falsch, Rohwert ganze Zahl, Temperatur Kommazahl, Dauer Zeit, sonst verlierst du Information."',
  brief:'Deklariere die Schnittstelle von <code>FB_Messung</code> mit passenden Typen (<code>Bool</code>, <code>Int</code>, <code>Real</code>, <code>Time</code>):<br>Eingänge: <code>Rohwert</code> (ganzzahliger Analogwert 0…27648), <code>Temperatur</code> (Kommazahl in °C), <code>Freigabe</code> (ja/nein), <code>Laufzeit</code> (Zeitdauer seit dem Einschalten)<br>Ausgänge: <code>Anzeige</code> (Kommazahl), <code>Warnung</code> (ja/nein)<br>Der Code nach BEGIN ist fertig. <code>Main</code> (🔒) versorgt den FB mit den Signalen <code>"Roh_Wert"</code>, <code>"Temp_Ist"</code>, <code>"Freigabe"</code>, <code>"Laufzeit"</code> und schreibt nach <code>"Anzeige"</code> und <code>"Warnung"</code>.',
  learn:'Zu jedem Signal den passenden elementaren Datentyp wählen.',
  take:'Bool = wahr/falsch, Int = ganze Zahl (−32768…32767), Real = Kommazahl, Time = Dauer (T#2S). Der Compiler prüft jede Verbindung — passt der Typ nicht, meldet er es sofort.',
  man:'datentypen', must:['BOOL','INT','REAL','TIME'],
  hint:'Die Beschreibung verrät den Typ: „ganzzahlig“ → Int, „Kommazahl“ → Real, „ja/nein“ → Bool, „Dauer“ → Time.',
  blocks:[
    { name:'FB_Messung', kind:'FB', edit:true,
      start:'FUNCTION_BLOCK "FB_Messung"\nVAR_INPUT\n   // Rohwert, Temperatur, Freigabe, Laufzeit\nEND_VAR\nVAR_OUTPUT\n   // Anzeige, Warnung\nEND_VAR\nBEGIN\n   IF #Freigabe AND #Laufzeit >= T#2S THEN\n      #Anzeige := #Temperatur + INT_TO_REAL(#Rohwert) / 1000.0;\n   ELSE\n      #Anzeige := 0.0;\n   END_IF;\n   #Warnung := #Anzeige > 80.0;\nEND_FUNCTION_BLOCK',
      ref:'FUNCTION_BLOCK "FB_Messung"\nVAR_INPUT\n   Rohwert : Int;       // Analogwert 0…27648\n   Temperatur : Real;   // °C\n   Freigabe : Bool;\n   Laufzeit : Time;     // seit dem Einschalten\nEND_VAR\nVAR_OUTPUT\n   Anzeige : Real;\n   Warnung : Bool;\nEND_VAR\nBEGIN\n   IF #Freigabe AND #Laufzeit >= T#2S THEN\n      #Anzeige := #Temperatur + INT_TO_REAL(#Rohwert) / 1000.0;\n   ELSE\n      #Anzeige := 0.0;\n   END_IF;\n   #Warnung := #Anzeige > 80.0;\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Messung_DB"(Rohwert := "Roh_Wert", Temperatur := "Temp_Ist", Freigabe := "Freigabe",\n                   Laufzeit := "Laufzeit", Anzeige => "Anzeige", Warnung => "Warnung");') }
  ],
  globals:{ Roh_Wert:0, Temp_Ist:0, Freigabe:false, Laufzeit:0, Anzeige:0, Warnung:false },
  types:{ Roh_Wert:'INT', Temp_Ist:'REAL', Laufzeit:'TIME', Anzeige:'REAL' },
  tests:[
    [{Roh_Wert:5000, Temp_Ist:21.5, Freigabe:true, Laufzeit:3}, {Anzeige:26.5, Warnung:false}],
    [{Roh_Wert:27648, Temp_Ist:60.25, Freigabe:true, Laufzeit:2}, {Anzeige:87.898, Warnung:true}],
    [{Roh_Wert:5000, Temp_Ist:21.5, Freigabe:false, Laufzeit:3}, {Anzeige:0, Warnung:false}],
    [{Roh_Wert:5000, Temp_Ist:90.0, Freigabe:true, Laufzeit:1.5}, {Anzeige:0, Warnung:false}]
  ],
  bind:['displayValue=Anzeige','displayLabel:"°C"','lightRed=Warnung','lightGreen=Freigabe'],
  wrong:[
    { FB_Messung:'FUNCTION_BLOCK "FB_Messung"\nVAR_INPUT\n   Rohwert : Int;\n   Temperatur : Int;\n   Freigabe : Bool;\n   Laufzeit : Time;\nEND_VAR\nVAR_OUTPUT\n   Anzeige : Real;\n   Warnung : Bool;\nEND_VAR\nBEGIN\n   IF #Freigabe AND #Laufzeit >= T#2S THEN\n      #Anzeige := #Temperatur + INT_TO_REAL(#Rohwert) / 1000.0;\n   ELSE\n      #Anzeige := 0.0;\n   END_IF;\n   #Warnung := #Anzeige > 80.0;\nEND_FUNCTION_BLOCK' },
    { FB_Messung:'FUNCTION_BLOCK "FB_Messung"\nVAR_INPUT\n   Rohwert : Int;\n   Temperatur : Real;\n   Freigabe : Bool;\n   Laufzeit : Int;\nEND_VAR\nVAR_OUTPUT\n   Anzeige : Real;\n   Warnung : Bool;\nEND_VAR\nBEGIN\n   IF #Freigabe AND #Laufzeit >= T#2S THEN\n      #Anzeige := #Temperatur + INT_TO_REAL(#Rohwert) / 1000.0;\n   ELSE\n      #Anzeige := 0.0;\n   END_IF;\n   #Warnung := #Anzeige > 80.0;\nEND_FUNCTION_BLOCK' }
  ]
});

/* ---------- 103 ---------- */
const REST_BODY = 'BEGIN\n   IF #Teil AND NOT #Merker AND #Rest > 0 THEN\n      #Rest := #Rest - 1;\n   END_IF;\n   #Merker := #Teil;\n   #Leer := #Rest = 0;\n   #Anzeige := #Rest;\nEND_FUNCTION_BLOCK';
const REST_HEAD = 'FUNCTION_BLOCK "FB_Restzaehler"\nVAR_INPUT\n   Teil : Bool;      // Lichtschranke: Teil wird entnommen\nEND_VAR\nVAR_OUTPUT\n   Leer : Bool;      // Palette ist leer\n   Anzeige : Int;    // Restteile für das HMI\nEND_VAR\n';
defProTask({ id:'p11_startwert', ch:11, title:'Startwerte', table:false,
  story:'Auf der Palette liegen zu Schichtbeginn immer 10 Rohteile. ARIA hat den Restzähler so gebaut, dass er bei 0 beginnt — und die Anlage meldet sofort „Palette leer“.',
  brief:'Ergänze in <code>FB_Restzaehler</code> den Bereich <code>VAR</code> (statisch):<br>• <code>Rest : Int := 10;</code> — Restteile mit <b>Startwert 10</b><br>• <code>Merker : Bool;</code> — merkt sich das Signal aus dem letzten Zyklus (Flanke)<br>Jede Entnahme (<code>Teil</code> wird TRUE) zählt <code>Rest</code> um 1 herunter. Die Ausgänge <code>Leer</code> und <code>Anzeige</code> gehen über <code>Main</code> an <code>"Palette_Leer"</code> und <code>"Rest_Anzeige"</code>.',
  learn:'Startwerte in der Deklaration setzen und vom Zuweisen im Code unterscheiden.',
  take:'Der Startwert (<code>Rest : Int := 10;</code>) gilt nur <b>einmal beim Anlegen</b> der Instanz. Eine Zuweisung <code>#Rest := 10;</code> im Code würde dagegen in <b>jedem Zyklus</b> alles zurücksetzen.',
  man:'deklaration', must:['INIT','STAT'],
  hint:'Die Syntax für einen Startwert: <code>Name : Typ := Wert;</code>',
  blocks:[
    { name:'FB_Restzaehler', kind:'FB', edit:true,
      start: REST_HEAD + 'VAR\n   // TODO: Rest (Int, Startwert 10) und Merker (Bool)\nEND_VAR\n' + REST_BODY,
      ref: REST_HEAD + 'VAR\n   Rest : Int := 10;   // Restteile auf der Palette\n   Merker : Bool;      // Teil im letzten Zyklus\nEND_VAR\n' + REST_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Restzaehler_DB"(Teil := "Teil_Sensor", Leer => "Palette_Leer", Anzeige => "Rest_Anzeige");') }
  ],
  globals:{ Teil_Sensor:false, Palette_Leer:false, Rest_Anzeige:0 },
  timed:[{ steps:[[0.1,{},{Rest_Anzeige:10, Palette_Leer:false}]].concat(puls(3,'Teil_Sensor', i => ({Rest_Anzeige:10-i}))).concat(puls(7,'Teil_Sensor', i => ({Rest_Anzeige:7-i, Palette_Leer:i===7}))).concat(puls(1,'Teil_Sensor', () => ({Rest_Anzeige:0, Palette_Leer:true}))) }],
  bind:['displayValue=Rest_Anzeige','displayLabel:"REST"','lightRed=Palette_Leer','sensorActive=Teil_Sensor','partVisible=Teil_Sensor'],
  wrong:[
    { FB_Restzaehler: REST_HEAD + 'VAR\n   Rest : Int;\n   Merker : Bool;\nEND_VAR\n' + REST_BODY },
    { FB_Restzaehler: REST_HEAD + 'VAR\n   Rest : Int;\n   Merker : Bool;\nEND_VAR\n' + REST_BODY.replace('BEGIN\n', 'BEGIN\n   #Rest := 10;\n') }
  ]
});

/* ---------- 104 ---------- */
const PAL_HEAD = 'FUNCTION_BLOCK "FB_Palette"\nVAR_INPUT\n   Teil : Bool;         // Teil wird abgelegt\n   Quittieren : Bool;   // volle Palette getauscht\nEND_VAR\nVAR_OUTPUT\n   Voll : Bool;\n   Frei : Int;          // freie Plätze\n   Anzahl : Int;\nEND_VAR\nVAR\n   Merker : Bool;\nEND_VAR\n';
const PAL_BODY = 'BEGIN\n   IF #Teil AND NOT #Merker THEN\n      IF #Anzahl < 24 THEN\n         #Anzahl := #Anzahl + 1;\n      END_IF;\n   END_IF;\n   #Merker := #Teil;\n   #Voll := #Anzahl >= 24;\n   #Frei := 24 - #Anzahl;\n   IF #Quittieren AND #Voll THEN\n      #Anzahl := 0;\n   END_IF;\nEND_FUNCTION_BLOCK';
const PAL_REF_BODY = PAL_BODY.replace(/24/g, '#MAX_TEILE');
defProTask({ id:'p11_konstante', ch:11, title:'Konstanten statt Zauberzahlen', table:false,
  story:'Ab heute kommen kleinere Paletten: 20 Plätze statt 24. Die Zahl 24 steht dreimal im Code — ARIA hofft, dass du eine Stelle vergisst.',
  brief:'Lege in <code>FB_Palette</code> eine Konstante an und nutze sie überall:<br><pre class="code">VAR CONSTANT\n   MAX_TEILE : Int := 20;\nEND_VAR</pre>Ersetze <b>jede</b> <code>24</code> im Code durch <code>#MAX_TEILE</code>. Geprüft werden <code>"Palette_Voll"</code>, <code>"Plaetze_Frei"</code> und <code>"Teile_Anzahl"</code>.',
  learn:'Konstanten (VAR CONSTANT) statt fest eingetippter Zahlen verwenden.',
  take:'Eine Konstante gibt einer Zahl einen Namen. Ändert sich der Wert, änderst du ihn an <b>einer</b> Stelle — und der Code erklärt sich selbst. Konstanten kann das Programm nicht überschreiben.',
  man:'deklaration', must:['CONSTANT'],
  hint:'Nach dem Ersetzen darf die Zahl 24 nirgends mehr vorkommen. Es sind drei Stellen.',
  blocks:[
    { name:'FB_Palette', kind:'FB', edit:true, start: PAL_HEAD + PAL_BODY,
      ref: PAL_HEAD + 'VAR CONSTANT\n   MAX_TEILE : Int := 20;   // Plätze pro Palette\nEND_VAR\n' + PAL_REF_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Palette_DB"(Teil := "Teil_Abgelegt", Quittieren := "Quittieren",\n                   Voll => "Palette_Voll", Frei => "Plaetze_Frei", Anzahl => "Teile_Anzahl");') }
  ],
  globals:{ Teil_Abgelegt:false, Quittieren:false, Palette_Voll:false, Plaetze_Frei:0, Teile_Anzahl:0 },
  timed:[{ steps:[[0.1,{},{Plaetze_Frei:20, Palette_Voll:false}]]
    .concat(puls(19,'Teil_Abgelegt', i => i === 19 ? {Teile_Anzahl:19, Plaetze_Frei:1, Palette_Voll:false} : {}))
    .concat(puls(1,'Teil_Abgelegt', () => ({Teile_Anzahl:20, Plaetze_Frei:0, Palette_Voll:true})))
    .concat(puls(2,'Teil_Abgelegt', () => ({Teile_Anzahl:20})))
    .concat([[0.1,{Quittieren:true},{Teile_Anzahl:0}],[0.1,{Quittieren:false},{Palette_Voll:false, Plaetze_Frei:20}]]) }],
  bind:['displayValue=Teile_Anzahl','displayLabel:"TEILE"','lightRed=Palette_Voll','lightGreen=Teil_Abgelegt'],
  wrong:[
    { FB_Palette: PAL_HEAD + 'VAR CONSTANT\n   MAX_TEILE : Int := 20;\nEND_VAR\n' + PAL_BODY.replace('#Voll := #Anzahl >= 24;', '#Voll := #Anzahl >= #MAX_TEILE;') },
    { FB_Palette: PAL_HEAD + 'VAR CONSTANT\n   MAX_TEILE : Int := 20;\nEND_VAR\n' + PAL_REF_BODY.replace('#Frei := #MAX_TEILE - #Anzahl;', '#Frei := 24 - #Anzahl;') }
  ]
});

/* ---------- 105 ---------- */
const WAAGE_BODY = 'BEGIN\n   #Alarm := #Gewicht > #Grenze;\n   #Anzeige := #Gewicht;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p11_typfehler_dbg', ch:11, title:'Typfehler in der Deklaration', debug:true, table:false,
  story:'ARIA hat in der Schnittstelle der Waage zwei Typen vertauscht, nun meldet sie einen Übersetzungsfehler. "Lies die Fehlermeldung genau, sie zeigt dir die Verbindung, die nicht passt", sagt der Werkmeister.',
  brief:'<code>FB_Waage</code> bekommt von der Waage eine <b>Kommazahl</b> (<code>"Waage_Gewicht"</code>, Gramm) und vergleicht sie mit der Grenze. <code>Alarm</code> ist TRUE, wenn das Teil zu schwer ist. Korrigiere die <b>Deklaration</b> — der Code nach BEGIN ist richtig.',
  learn:'Typfehler in Schnittstellen anhand der Compilermeldung finden.',
  take:'Ein Vergleich wie <code>#Gewicht &gt; #Grenze</code> liefert Bool — also muss <code>Alarm</code> ein Bool sein. Und eine Kommazahl passt nicht verlustfrei in Int: Der Compiler lässt das nicht durchgehen.',
  man:'datentypen',
  hint:'Zwei Zeilen in den VAR-Bereichen sind falsch. Welcher Typ passt zu „Kommazahl“, welcher zu „TRUE = zu schwer“?',
  blocks:[
    { name:'FB_Waage', kind:'FB', edit:true,
      start:'FUNCTION_BLOCK "FB_Waage"\nVAR_INPUT\n   Gewicht : Int;    // Gewicht in Gramm (Kommazahl von der Waage)\n   Grenze : Real;    // Höchstgewicht in Gramm\nEND_VAR\nVAR_OUTPUT\n   Alarm : Int;      // TRUE = zu schwer\n   Anzeige : Real;\nEND_VAR\n' + WAAGE_BODY,
      ref:'FUNCTION_BLOCK "FB_Waage"\nVAR_INPUT\n   Gewicht : Real;   // Gewicht in Gramm (Kommazahl von der Waage)\n   Grenze : Real;    // Höchstgewicht in Gramm\nEND_VAR\nVAR_OUTPUT\n   Alarm : Bool;     // TRUE = zu schwer\n   Anzeige : Real;\nEND_VAR\n' + WAAGE_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Waage_DB"(Gewicht := "Waage_Gewicht", Grenze := 520.0, Alarm => "Waage_Alarm", Anzeige => "Waage_Anzeige");') }
  ],
  globals:{ Waage_Gewicht:0, Waage_Alarm:false, Waage_Anzeige:0 }, types:{ Waage_Gewicht:'REAL', Waage_Anzeige:'REAL' },
  tests:[[{Waage_Gewicht:512.5},{Waage_Alarm:false, Waage_Anzeige:512.5}],[{Waage_Gewicht:530.2},{Waage_Alarm:true, Waage_Anzeige:530.2}],[{Waage_Gewicht:520.0},{Waage_Alarm:false}]],
  bind:['displayValue=Waage_Anzeige','displayLabel:"GRAMM"','lightRed=Waage_Alarm']
});

/* ---------- 106 ---------- */
const MW_HEAD = 'FUNCTION_BLOCK "FB_Mittelwert"\n';
const MW_REST = 'VAR_OUTPUT\n   Mittel : Real;\nEND_VAR\nVAR_TEMP\n   i : Int;\n   Summe : Real;\nEND_VAR\n';
defProTask({ id:'p11_arraygrenzen', ch:11, title:'Arrays mit eigenen Grenzen', table:false,
  story:'Die Qualitätssicherung nummeriert ihre zehn Messpunkte von 1 bis 10, nicht von 0 bis 9. "In SCL legst du die Grenzen selbst fest, dann stimmt der Index mit dem Prüfprotokoll überein", sagt der Werkmeister.',
  brief:'Deklariere in <code>FB_Mittelwert</code> den Eingang <code>Werte : Array[1..10] of Real;</code> und berechne im Code den Mittelwert:<br>• <code>#Summe</code> zuerst auf <code>0.0</code> setzen (TEMP-Variablen haben keinen gemerkten Wert)<br>• <code>FOR #i := 1 TO 10 DO</code> … alle Werte addieren<br>• <code>#Mittel := #Summe / 10.0;</code><br><code>Main</code> (🔒) übergibt <code>"Messwerte"</code> (Array[1..10] of Real) und schreibt nach <code>"Mittelwert"</code>.',
  learn:'Arrays mit frei gewählten Grenzen deklarieren und durchlaufen.',
  take:'<code>Array[1..10] of Real</code> hat 10 Elemente mit den Indizes 1 bis 10. Die Schleife muss genau diese Grenzen verwenden — <code>[0]</code> oder <code>[11]</code> gibt es nicht. Zwei Arrays sind nur dann gleich, wenn auch die Grenzen gleich sind.',
  man:'datentypen', must:['ARRAY','FOR','ARRAY_BOUNDS'], warnFree:['TEMP_READ_BEFORE_WRITE'],
  hint:'Die Deklaration kommt in <code>VAR_INPUT</code>. Im Code: Summe auf 0.0, Schleife von 1 bis 10, dann teilen.',
  blocks:[
    { name:'FB_Mittelwert', kind:'FB', edit:true,
      start: MW_HEAD + 'VAR_INPUT\n   // TODO: Werte — zehn Messwerte, Index 1 bis 10\nEND_VAR\n' + MW_REST + 'BEGIN\n   // TODO: Mittelwert der zehn Werte berechnen\n\nEND_FUNCTION_BLOCK',
      ref: MW_HEAD + 'VAR_INPUT\n   Werte : Array[1..10] of Real;   // Messpunkte 1…10\nEND_VAR\n' + MW_REST + 'BEGIN\n   #Summe := 0.0;\n   FOR #i := 1 TO 10 DO\n      #Summe := #Summe + #Werte[#i];\n   END_FOR;\n   #Mittel := #Summe / 10.0;\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Mittelwert_DB"(Werte := "Messwerte", Mittel => "Mittelwert");') }
  ],
  globals:{ Messwerte:[0,0,0,0,0,0,0,0,0,0], Mittelwert:0 }, types:{ Messwerte:'ARRAY[1..10] OF REAL', Mittelwert:'REAL' },
  tests:[
    [{Messwerte:[10,20,30,40,50,60,70,80,90,100]},{Mittelwert:55}],
    [{Messwerte:[4.5,5.5,5,5,5,5,5,5,5,5]},{Mittelwert:5}],
    [{Messwerte:[100,0,0,0,0,0,0,0,0,1]},{Mittelwert:10.1}]
  ],
  bind:['displayValue=Mittelwert','displayLabel:"MITTEL"'],
  wrong:[
    { FB_Mittelwert: MW_HEAD + 'VAR_INPUT\n   Werte : Array[0..9] of Real;\nEND_VAR\n' + MW_REST + 'BEGIN\n   #Summe := 0.0;\n   FOR #i := 0 TO 9 DO\n      #Summe := #Summe + #Werte[#i];\n   END_FOR;\n   #Mittel := #Summe / 10.0;\nEND_FUNCTION_BLOCK' },
    { FB_Mittelwert: MW_HEAD + 'VAR_INPUT\n   Werte : Array[1..10] of Real;\nEND_VAR\n' + MW_REST + 'BEGIN\n   #Summe := 0.0;\n   FOR #i := 1 TO 9 DO\n      #Summe := #Summe + #Werte[#i];\n   END_FOR;\n   #Mittel := #Summe / 10.0;\nEND_FUNCTION_BLOCK' }
  ]
});

/* ---------- 107 ---------- */
const TZ = (t1, t2) => 'FUNCTION_BLOCK "FB_Tageszaehler"\nVAR_INPUT\n   Teil : Bool;\nEND_VAR\nVAR_OUTPUT\n   Anzahl : ' + t2 + ';\nEND_VAR\nVAR\n   Gesamt : ' + t1 + ';   // Teile seit Schichtbeginn\n   Merker : Bool;\nEND_VAR\nBEGIN\n   IF #Teil AND NOT #Merker THEN\n      #Gesamt := #Gesamt + 1;\n   END_IF;\n   #Merker := #Teil;\n   #Anzahl := #Gesamt;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p11_wortbreite', ch:11, title:'Wortbreiten', table:false,
  story:'Mitten in der Nachtschicht springt die Tagesproduktion von 32767 auf −32768. ARIA kichert: "Negative Teile — ich habe eine neue Physik erfunden."',
  brief:'Der Tageszähler <code>FB_Tageszaehler</code> zählt mit <code>Int</code> — und <code>Int</code> reicht nur bis 32767. Stelle <code>Gesamt</code> und den Ausgang <code>Anzahl</code> auf <code>DInt</code> um (bis 2 147 483 647). <code>Main</code> schreibt <code>Anzahl</code> nach <code>"Tagesproduktion"</code> (DInt).',
  learn:'Wertebereiche der Ganzzahltypen kennen und den Überlauf vermeiden.',
  take:'SInt/USInt: 8 Bit, Int/UInt: 16 Bit, DInt/UDInt: 32 Bit. Läuft ein Wert über die Grenze, „springt“ er auf die andere Seite des Bereichs — ohne Fehlermeldung. Wähle den Typ nach dem grössten Wert, der vorkommen kann.',
  man:'datentypen', must:['DINT'],
  hint:'Zwei Stellen: die statische Variable und der Ausgang.',
  blocks:[
    { name:'FB_Tageszaehler', kind:'FB', edit:true, start: TZ('Int','Int'), ref: TZ('DInt','DInt') },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Tageszaehler_DB"(Teil := "Teil_Sensor", Anzahl => "Tagesproduktion");') }
  ],
  globals:{ Teil_Sensor:false, Tagesproduktion:0 }, types:{ Tagesproduktion:'DINT' },
  unit:[{ block:'FB_Tageszaehler', setup:{Gesamt:32760}, steps: puls(10,'Teil', i => i >= 7 ? {Anzahl:32760 + i} : {}) }],
  timed:[{ steps: puls(3,'Teil_Sensor', i => ({Tagesproduktion:i})) }],
  bind:['displayValue=Tagesproduktion','displayLabel:"TAG"','sensorActive=Teil_Sensor','partVisible=Teil_Sensor'],
  wrong:[{ FB_Tageszaehler: TZ('Int','DInt') }, { FB_Tageszaehler: TZ('DInt','Int') }]
});

/* ---------- 108 ---------- */
const ST_HEAD = 'FUNCTION_BLOCK "FB_Antriebsstatus"\nVAR_INPUT\n   Status : Word;       // Statuswort des Umrichters\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Bereit : Bool;       // Bit 0\n   Stoerung : Bool;     // Bit 3\n   Warnung : Bool;      // Bit 5\n   Fehlerbits : Word;   // nur Bit 3 und Bit 5 (Maske 16#0028)\n   Befehl : Word;       // Steuerwort an den Umrichter\nEND_VAR\n';
defProTask({ id:'p11_bits', ch:11, title:'Bits im Wort', table:false,
  story:'Der Frequenzumrichter am Band meldet alles in einem 16-Bit-Statuswort, und ARIA hat die Auswertung gelöscht. "Jedes Bit hat eine Bedeutung", sagt der Werkmeister und reicht dir das Datenblatt.',
  brief:'Werte in <code>FB_Antriebsstatus</code> das Statuswort aus:<br>• <code>#Bereit := #Status.%X0;</code>, <code>Stoerung</code> = Bit 3, <code>Warnung</code> = Bit 5<br>• <code>Fehlerbits</code> = <code>Status</code> mit der Maske <code>16#0028</code> verUNDet (nur Bit 3 und 5 bleiben)<br>• <code>Befehl</code>: zuerst <code>16#0000</code>, dann Bit 7 := <code>Quittieren</code><br>Die Ausgänge gehen über <code>Main</code> an die Signalsäule.',
  learn:'Einzelne Bits in BYTE/WORD lesen und schreiben, Bitmasken mit AND.',
  take:'<code>Wort.%X3</code> ist Bit 3 eines Worts — lesbar und beschreibbar wie ein Bool. Mit <code>AND 16#0028</code> blendest du alle Bits aus, die dich nicht interessieren.',
  man:'datentypen', must:['BIT','AND'],
  hint:'Bitzugriff: <code>#Status.%X3</code>. Maske: <code>#Fehlerbits := #Status AND 16#0028;</code>',
  hint2:'Für das Steuerwort: <code>#Befehl := 16#0000;</code> und danach <code>#Befehl.%X7 := #Quittieren;</code>',
  blocks:[
    { name:'FB_Antriebsstatus', kind:'FB', edit:true, start: ST_HEAD + 'BEGIN\n   // Statuswort auswerten\n\nEND_FUNCTION_BLOCK',
      ref: ST_HEAD + 'BEGIN\n   #Bereit := #Status.%X0;\n   #Stoerung := #Status.%X3;\n   #Warnung := #Status.%X5;\n   #Fehlerbits := #Status AND 16#0028;\n   #Befehl := 16#0000;\n   #Befehl.%X7 := #Quittieren;\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Antriebsstatus_DB"(Status := "Umrichter_Status", Quittieren := "Quit",\n      Bereit => "H_Gruen", Stoerung => "H_Rot", Warnung => "H_Gelb",\n      Fehlerbits => "Fehlerbits", Befehl => "Umrichter_Befehl");') }
  ],
  globals:{ Umrichter_Status:0, Quit:false, H_Gruen:false, H_Rot:false, H_Gelb:false, Fehlerbits:0, Umrichter_Befehl:0 },
  types:{ Umrichter_Status:'WORD', Fehlerbits:'WORD', Umrichter_Befehl:'WORD' },
  tests:[
    [{Umrichter_Status:1},{H_Gruen:true, H_Rot:false, H_Gelb:false, Fehlerbits:0, Umrichter_Befehl:0}],
    [{Umrichter_Status:0x0009},{H_Gruen:true, H_Rot:true, H_Gelb:false, Fehlerbits:8}],
    [{Umrichter_Status:0x00E1},{H_Gruen:true, H_Rot:false, H_Gelb:true, Fehlerbits:32}],
    [{Umrichter_Status:0xFFFE, Quit:true},{H_Gruen:false, H_Rot:true, H_Gelb:true, Fehlerbits:40, Umrichter_Befehl:128}]
  ],
  bind:['lightGreen=H_Gruen','lightRed=H_Rot','lightYellow=H_Gelb','displayValue=Fehlerbits','displayLabel:"FEHLER"'],
  wrong:[{ FB_Antriebsstatus: ST_HEAD + 'BEGIN\n   #Bereit := #Status.%X1;\n   #Stoerung := #Status.%X4;\n   #Warnung := #Status.%X6;\n   #Fehlerbits := #Status AND 16#0028;\n   #Befehl := 16#0000;\n   #Befehl.%X7 := #Quittieren;\nEND_FUNCTION_BLOCK' },
    { FB_Antriebsstatus: ST_HEAD + 'BEGIN\n   #Bereit := #Status.%X0;\n   #Stoerung := #Status.%X3;\n   #Warnung := #Status.%X5;\n   #Fehlerbits := #Status;\n   #Befehl.%X7 := #Quittieren;\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 109 ---------- */
const TZ2 = (sec) => 'FUNCTION_BLOCK "FB_Teilezaehler"\nVAR_INPUT\n   Teil : Bool;\nEND_VAR\nVAR_OUTPUT\n   Anzahl : Int;\nEND_VAR\nVAR\n   Merker : Bool;\n' + (sec === 'VAR' ? '   Zaehler : Int;\n' : '') + 'END_VAR\n' + (sec === 'TEMP' ? 'VAR_TEMP\n   Zaehler : Int;\nEND_VAR\n' : '') + 'BEGIN\n   IF #Teil AND NOT #Merker THEN\n      #Zaehler := #Zaehler + 1;\n   END_IF;\n   #Merker := #Teil;\n   #Anzahl := #Zaehler;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p11_temp_dbg', ch:11, title:'Das vergessliche TEMP', debug:true, table:false,
  story:'Der Teilezähler zeigt immer 0 oder 1, egal wie viele Teile vorbeikommen. ARIA: "Mein Zähler lebt im Hier und Jetzt, Erinnerungen sind überbewertet."',
  brief:'<code>FB_Teilezaehler</code> soll jedes Teil (steigende Flanke von <code>Teil</code>) zählen und die Summe über <code>Anzahl</code> an <code>"Teile"</code> ausgeben. Finde heraus, warum der Zähler vergisst, und behebe es. Der Compiler zeigt dir eine <b>Warnung</b>.',
  learn:'Den Unterschied zwischen statischen (VAR) und temporären (VAR_TEMP) Variablen erkennen.',
  take:'<b>STAT</b> (<code>VAR</code>) gehört zur Instanz und behält seinen Wert von Zyklus zu Zyklus. <b>TEMP</b> (<code>VAR_TEMP</code>) existiert nur während eines Aufrufs und beginnt jedes Mal neu. Alles, was sich der Baustein merken soll, gehört nach <code>VAR</code>.',
  man:'speicherbereiche', warnFree:['TEMP_READ_BEFORE_WRITE'],
  hint:'Welche Variable muss sich ihren Wert über den Zyklus hinaus merken? In welchem Bereich steht sie?',
  blocks:[
    { name:'FB_Teilezaehler', kind:'FB', edit:true, start: TZ2('TEMP'), ref: TZ2('VAR') },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Teilezaehler_DB"(Teil := "Teil_Sensor", Anzahl => "Teile");') }
  ],
  globals:{ Teil_Sensor:false, Teile:0 },
  timed:[{ steps:[[0.1,{Teil_Sensor:true},{Teile:1}],[0.1,{Teil_Sensor:false},{Teile:1}],[0.1,{Teil_Sensor:true},{Teile:2}],[0.1,{Teil_Sensor:false},{Teile:2}],[0.1,{Teil_Sensor:true},{Teile:3}],[0.1,{},{Teile:3}]] }],
  bind:['displayValue=Teile','displayLabel:"TEILE"','sensorActive=Teil_Sensor','partVisible=Teil_Sensor']
});

/* ---------- 110 (Boss) ---------- */
const Z_BODY = 'BEGIN\n   // Betrieb mit Selbsthaltung — Störung schaltet ab\n   #Betrieb := (#Start OR #Betrieb) AND NOT #Stopp AND NOT #Stoerung;\n   #Band := #Betrieb AND NOT #Teil_da;\n\n   // Transportüberwachung: das Teil muss innerhalb MAX_TRANSPORT ankommen\n   #Ueberwachung(IN := #Band, PT := #MAX_TRANSPORT);\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n   END_IF;\n   IF #Quittieren THEN\n      #Stoerung := FALSE;\n   END_IF;\n\n   // Teile zählen (steigende Flanke)\n   #Flanke := #Teil_da AND NOT #Teil_alt;\n   #Teil_alt := #Teil_da;\n   IF #Flanke THEN\n      #Anzahl := #Anzahl + 1;\n   END_IF;\n\n   #Lampe_Gruen := #Betrieb;\n   #Lampe_Rot := #Stoerung;\nEND_FUNCTION_BLOCK';
const Z_DECL = 'VAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Teil_da : Bool;\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Band : Bool;\n   Lampe_Gruen : Bool;\n   Lampe_Rot : Bool;\n   Anzahl : DInt;          // Tagesproduktion\nEND_VAR\nVAR\n   Betrieb : Bool;\n   Stoerung : Bool;\n   Teil_alt : Bool;\n   Ueberwachung : TON;     // Transportzeit\nEND_VAR\nVAR_TEMP\n   Flanke : Bool;\nEND_VAR\nVAR CONSTANT\n   MAX_TRANSPORT : Time := T#5S;\nEND_VAR\n';
defProTask({ id:'p11_boss', ch:11, title:'Boss: Die Variablentabelle der Zelle', boss:true, table:false,
  story:'ARIA hat die Schnittstelle des Zellen-Bausteins gelöscht, nur der Code ist übrig. Der Werkmeister: "Ein Profi erkennt am Gebrauch, wo jede Variable hingehört."',
  brief:'Schreibe für <code>FB_Zelle</code> die <b>komplette Deklaration</b>. Lies dazu den Code:<br>• <b>Eingänge</b> (Bool): <code>Start</code>, <code>Stopp</code>, <code>Teil_da</code>, <code>Quittieren</code><br>• <b>Ausgänge</b>: <code>Band</code>, <code>Lampe_Gruen</code>, <code>Lampe_Rot</code> (Bool) und <code>Anzahl</code> — die Tagesproduktion kann weit über 32767 steigen<br>• <b>Statisch</b>: alles, was sich der Baustein über den Zyklus hinaus merken muss — auch der Timer <code>Ueberwachung</code> (Typ <code>TON</code>)<br>• <b>Temporär</b>: <code>Flanke</code> wird in jedem Zyklus neu berechnet<br>• <b>Konstante</b>: <code>MAX_TRANSPORT</code> = 5 Sekunden',
  learn:'Aus dem Gebrauch einer Variable Bereich und Datentyp ableiten.',
  take:'Eingang = kommt von aussen, Ausgang = geht nach aussen, STAT = muss sich etwas merken (auch Timer-Instanzen!), TEMP = Zwischenergebnis im Zyklus, CONSTANT = fester Parameter. Diese fünf Fragen beantworten jede Deklaration.',
  man:'speicherbereiche', must:['VAR_INPUT','VAR_OUTPUT','STAT','TEMP','VAR_CONSTANT','TON','DINT'], warnFree:['TEMP_READ_BEFORE_WRITE'],
  hint:'Gehe den Code Zeile für Zeile durch. <code>Betrieb</code> steht rechts in seiner eigenen Zuweisung (Selbsthaltung) — also muss es sich den Wert merken.',
  hint2:'<code>Teil_alt</code> speichert den Wert aus dem <b>letzten</b> Zyklus → statisch. <code>Flanke</code> wird sofort berechnet und gleich benutzt → TEMP.',
  blocks:[
    { name:'FB_Zelle', kind:'FB', edit:true,
      start:'FUNCTION_BLOCK "FB_Zelle"\n// Eingänge:\n\n// Ausgänge:\n\n// Statisch:\n\n// Temporär:\n\n// Konstante:\n\n' + Z_BODY,
      ref:'FUNCTION_BLOCK "FB_Zelle"\n' + Z_DECL + Z_BODY },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Zelle_DB"(Start := "S_Start", Stopp := "S_Stopp", Teil_da := "Teil_Sensor", Quittieren := "S_Quit",\n                 Band => "Band_Motor", Lampe_Gruen => "H_Gruen", Lampe_Rot => "H_Rot", Anzahl => "Stueckzahl");') }
  ],
  globals:{ S_Start:false, S_Stopp:false, Teil_Sensor:false, S_Quit:false, Band_Motor:false, H_Gruen:false, H_Rot:false, Stueckzahl:0 },
  types:{ Stueckzahl:'DINT' },
  unit:[
    { block:'FB_Zelle', steps:[[0.1,{Start:true},{Band:true, Lampe_Gruen:true}],[0.1,{Start:false},{Band:true}],[2,{Teil_da:true},{Band:false, Anzahl:1}],[0.1,{Teil_da:false},{Band:true}],[4.8,{},{Lampe_Rot:false}],[0.2,{},{Lampe_Rot:true}],[0.1,{},{Band:false, Lampe_Gruen:false}],[0.1,{Quittieren:true},{Lampe_Rot:false}],[0.1,{Quittieren:false, Start:true},{Band:true}]] },
    { block:'FB_Zelle', setup:{Anzahl:32767}, steps:[[0.1,{Teil_da:true},{Anzahl:32768}]] }
  ],
  timed:[{ steps:[[0.1,{S_Start:true},{Band_Motor:true, H_Gruen:true}],[0.1,{S_Start:false},{}],[1,{Teil_Sensor:true},{Band_Motor:false, Stueckzahl:1}],[0.1,{Teil_Sensor:false},{Band_Motor:true}],[0.1,{S_Stopp:true},{Band_Motor:false, H_Gruen:false}]] }],
  bind:['beltRunning=Band_Motor','lightGreen=H_Gruen','lightRed=H_Rot','sensorActive=Teil_Sensor','partVisible=Teil_Sensor','displayValue=Stueckzahl','displayLabel:"STÜCK"'],
  wrong:[
    { FB_Zelle:'FUNCTION_BLOCK "FB_Zelle"\n' + Z_DECL.replace('   Teil_alt : Bool;\n', '').replace('   Flanke : Bool;\n', '   Flanke : Bool;\n   Teil_alt : Bool;\n') + Z_BODY },
    { FB_Zelle:'FUNCTION_BLOCK "FB_Zelle"\n' + Z_DECL.replace('Anzahl : DInt;', 'Anzahl : Int;') + Z_BODY }
  ]
});
})();
