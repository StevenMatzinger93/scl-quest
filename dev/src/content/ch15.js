/* ===== KAPITEL 15 — Das Anlagenprogramm: Programmstruktur, OB1/OB100, Export — Profi-Stufe ===== */
(function(){
const MAIN = body => 'ORGANIZATION_BLOCK "Main"\nBEGIN\n' + body + '\nEND_ORGANIZATION_BLOCK';

/* ---------- 141 ---------- */
const FB_EIN = 'FUNCTION_BLOCK "FB_Eingaenge"\nVAR_INPUT\n   Lichtschranke : Bool;   // Öffner: FALSE = Strahl unterbrochen\nEND_VAR\nVAR_OUTPUT\n   Teil : Bool;            // TRUE = Teil an der Station\nEND_VAR\nBEGIN\n   #Teil := NOT #Lichtschranke;\nEND_FUNCTION_BLOCK';
const FB_BAND = 'FUNCTION_BLOCK "FB_Band"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Teil_da : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lauf : Bool;\nEND_VAR\nVAR\n   Betrieb : Bool;\nEND_VAR\nBEGIN\n   #Betrieb := (#Start OR #Betrieb) AND NOT #Stopp;\n   #Lauf := #Betrieb AND NOT #Teil_da;\nEND_FUNCTION_BLOCK';
const Z141 = MAIN('   "FB_Eingaenge_DB"(Lichtschranke := "I_Lichtschranke", Teil => "Teil_da");\n   "FB_Band_DB"(Start := "S_Start", Stopp := "S_Stopp", Teil_da := "Teil_da", Lauf => "Band_Motor");');
defProTask({ id:'p15_zyklus', ch:15, title:'Der Zyklus',
  story:'Finale der Profi-Stufe. ARIA hat das komplette Programm in einen einzigen, 2000 Zeilen langen Block kopiert. Du baust es nach Standard neu auf. Erste Regel des Werkmeisters: "Der OB1 ist das Inhaltsverzeichnis. Er ruft die Bausteine auf — in der richtigen Reihenfolge."',
  brief:'Schreibe den zyklischen Organisationsbaustein <code>Main</code> [OB1]. Er ruft zwei fertige Bausteine (🔒) auf:<br>1. <code>"FB_Eingaenge_DB"</code>: <code>Lichtschranke := "I_Lichtschranke"</code>, <code>Teil =&gt; "Teil_da"</code><br>2. <code>"FB_Band_DB"</code>: <code>Start := "S_Start"</code>, <code>Stopp := "S_Stopp"</code>, <code>Teil_da := "Teil_da"</code>, <code>Lauf =&gt; "Band_Motor"</code><br>Das Band muss <b>im selben Zyklus</b> stoppen, in dem die Lichtschranke unterbrochen wird.',
  learn:'Den OB1 als Aufrufstruktur des Programms aufbauen.',
  take:'Der OB1 wird vom Betriebssystem in jedem Zyklus aufgerufen und ruft seinerseits die Bausteine auf — von oben nach unten. Erst Eingänge aufbereiten, dann verarbeiten, dann Ausgänge schreiben.',
  man:'programmstruktur', must:['SINGLE','OB'],
  hint:'Zwei Aufrufzeilen. Überlege, welcher Baustein das Ergebnis des anderen braucht.',
  blocks:[
    { name:'FB_Eingaenge', kind:'FB', src: FB_EIN },
    { name:'FB_Band', kind:'FB', src: FB_BAND },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // 1. Eingänge aufbereiten\n\n   // 2. Band steuern\n'), ref: Z141 }
  ],
  globals:{ I_Lichtschranke:true, Teil_da:false, S_Start:false, S_Stopp:false, Band_Motor:false },
  timed:[{ steps:[[0.1,{S_Start:true},{Band_Motor:true, Teil_da:false}],[0.1,{S_Start:false},{Band_Motor:true}],[0.1,{I_Lichtschranke:false},{Teil_da:true, Band_Motor:false}],[0.1,{I_Lichtschranke:true},{Band_Motor:true}]] }],
  bind:['beltRunning=Band_Motor','sensorActive=Teil_da','partVisible=Teil_da'],
  wrong:[{ Main: MAIN('   "FB_Band_DB"(Start := "S_Start", Stopp := "S_Stopp", Teil_da := "Teil_da", Lauf => "Band_Motor");\n   "FB_Eingaenge_DB"(Lichtschranke := "I_Lichtschranke", Teil => "Teil_da");') }]
});

/* ---------- 142 ---------- */
const FB_WAAGE = 'FUNCTION_BLOCK "FB_Waage"\nVAR_INPUT\n   Gewicht : Real;\nEND_VAR\nVAR_OUTPUT\n   OK : Bool;\nEND_VAR\nBEGIN\n   #OK := #Gewicht >= 480.0 AND #Gewicht <= 520.0;\nEND_FUNCTION_BLOCK';
const W142 = '   IF "Gewicht_OK" THEN\n      "Weiche_Winkel" := 20;\n   ELSE\n      "Weiche_Winkel" := -20;\n   END_IF;';
const C142 = '   "FB_Waage_DB"(Gewicht := "Waage", OK => "Gewicht_OK");';
defProTask({ id:'p15_reihenfolge_dbg', ch:15, title:'Reihenfolge zählt', debug:true,
  story:'Die Weiche sortiert jedes Teil genau falsch herum — immer nach dem Urteil über das <em>vorherige</em> Teil. ARIA: "Ich habe nichts verändert. Nur ein bisschen umgestellt."',
  brief:'<code>Main</code> soll die Weiche nach dem Prüfergebnis der Waage stellen: <code>"Gewicht_OK"</code> → <code>"Weiche_Winkel"</code> = 20, sonst −20. <code>FB_Waage</code> (🔒) ist korrekt. Warum reagiert die Weiche einen Zyklus zu spät?',
  learn:'Die Aufrufreihenfolge im Zyklus bestimmt, wann ein Wert gültig ist.',
  take:'Ein Wert, der erst <b>nach</b> seiner Verwendung berechnet wird, kommt einen Zyklus zu spät. Solche Fehler sind tückisch, weil sie nur bei schnellen Wechseln auffallen.',
  man:'programmstruktur',
  hint:'Lies <code>Main</code> von oben nach unten: Wann wird <code>"Gewicht_OK"</code> gelesen, wann geschrieben?',
  blocks:[
    { name:'FB_Waage', kind:'FB', src: FB_WAAGE },
    { name:'Main', kind:'OB', edit:true, start: MAIN(W142 + '\n' + C142), ref: MAIN(C142 + '\n' + W142) }
  ],
  globals:{ Waage:0, Gewicht_OK:false, Weiche_Winkel:0 }, types:{ Waage:'REAL' },
  tests:[[{Waage:500},{Weiche_Winkel:20}],[{Waage:540},{Weiche_Winkel:-20}]],
  timed:[{ steps:[[0.1,{Waage:500},{Weiche_Winkel:20}],[0.1,{Waage:460},{Weiche_Winkel:-20}],[0.1,{Waage:505},{Weiche_Winkel:20}]] }],
  bind:['gateAngle=Weiche_Winkel',{channel:'partColor', variable:'Gewicht_OK', map:{'true':'green','false':'red'}},'partVisible:true','displayValue=Waage','displayLabel:"GRAMM"']
});

/* ---------- 143 ---------- */
const DB_Z143 = 'DATA_BLOCK "DB_Zelle"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\n   VAR RETAIN\n      Betriebsart : Int;\n      Stueckzahl : Int := 57;   // Stand vom letzten Abschalten\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const START_REF = 'ORGANIZATION_BLOCK "Startup"\nTITLE = "Complete Restart"\nBEGIN\n   "DB_Zelle".Betriebsart := 1;\n   "DB_Zelle".Stueckzahl := 0;\n   "Arm_Soll" := 0;\n   "Greifer_Auf" := TRUE;\n   "HMI_Text" := \'Anlauf OK\';\nEND_ORGANIZATION_BLOCK';
defProTask({ id:'p15_anlauf', ch:15, title:'Der Anlauf (OB100)',
  story:'Nach jedem Stromausfall steht der Arm irgendwo, der Greifer ist zu und der Zähler zeigt den Stand von gestern. "Eine Anlage braucht einen sauberen Anlauf", sagt der Werkmeister. "Dafür gibt es den OB100 — er läuft genau einmal, bevor der erste Zyklus beginnt."',
  brief:'Schreibe den Anlauf-OB <code>"Startup"</code> [OB100]. Er setzt einmalig:<br>• <code>"DB_Zelle".Betriebsart</code> := 1 und <code>"DB_Zelle".Stueckzahl</code> := 0<br>• <code>"Arm_Soll"</code> := 0 (Grundstellung) und <code>"Greifer_Auf"</code> := TRUE<br>• <code>"HMI_Text"</code> := <code>\'Anlauf OK\'</code><br>Der zyklische <code>Main</code> (🔒) zählt danach die Teile weiter.',
  learn:'Einen Anlauf-OB für die Grundstellung verwenden.',
  take:'Der <b>OB100</b> (Anlauf) läuft einmal beim Übergang von STOP nach RUN, danach nur noch der <b>OB1</b> in jedem Zyklus. Grundstellungen und Initialisierungen gehören in den Anlauf — nicht mit einem Merker „erster Zyklus“ in den OB1.',
  man:'programmstruktur', must:['STARTUP'],
  hint:'Aufbau: <code>ORGANIZATION_BLOCK "Startup"</code> … <code>BEGIN</code> … fünf Zuweisungen … <code>END_ORGANIZATION_BLOCK</code>.',
  blocks:[
    { name:'DB_Zelle', kind:'DB', src: DB_Z143 },
    { name:'Startup', kind:'OB', ob:100, edit:true, start:'ORGANIZATION_BLOCK "Startup"\nTITLE = "Complete Restart"\nBEGIN\n   // Grundstellung herstellen\n\nEND_ORGANIZATION_BLOCK', ref: START_REF },
    { name:'Main', kind:'OB', src: MAIN('   IF "Teil_Abgelegt" THEN\n      "DB_Zelle".Stueckzahl := "DB_Zelle".Stueckzahl + 1;\n   END_IF;\n   "Anzeige" := "DB_Zelle".Stueckzahl;') }
  ],
  globals:{ Teil_Abgelegt:false, Anzeige:0, Arm_Soll:45, Greifer_Auf:false, HMI_Text:'' }, types:{ HMI_Text:'STRING[24]' },
  timed:[{ steps:[[0.1,{},{Anzeige:0, Arm_Soll:0, Greifer_Auf:true, HMI_Text:'Anlauf OK', 'DB_Zelle.Betriebsart':1}],[0.1,{Teil_Abgelegt:true},{Anzeige:1}],[0.1,{},{Anzeige:2, Arm_Soll:0}]] }],
  bind:['armAngle=Arm_Soll','gripperOpen=Greifer_Auf','displayText=HMI_Text','displayValue=Anzeige','displayLabel:"STÜCK"'],
  wrong:[{ Startup: START_REF.replace('   "DB_Zelle".Stueckzahl := 0;\n', '') }]
});

/* ---------- 144 ---------- */
const DB_E = 'DATA_BLOCK "DB_E"\n{ S7_Optimized_Access := \'TRUE\' }\nVERSION : 0.1\nNON_RETAIN\n   VAR\n      Start : Bool;     // TRUE = gedrückt\n      Stopp : Bool;     // TRUE = gedrückt\n      Teil_da : Bool;   // TRUE = Teil an der Station\n      Tuer_zu : Bool;   // TRUE = Schutztür geschlossen\n   END_VAR\nBEGIN\nEND_DATA_BLOCK';
const FB_Z144 = 'FUNCTION_BLOCK "FB_Zelle"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Teil_da : Bool;\n   Tuer_zu : Bool;\nEND_VAR\nVAR_OUTPUT\n   Band : Bool;\nEND_VAR\nVAR\n   Betrieb : Bool;\nEND_VAR\nBEGIN\n   #Betrieb := (#Start OR #Betrieb) AND NOT #Stopp AND #Tuer_zu;\n   #Band := #Betrieb AND NOT #Teil_da;\nEND_FUNCTION_BLOCK';
const CALL144 = '   // 2. Zellenbaustein\n   "FB_Zelle_DB"(Start := "DB_E".Start, Stopp := "DB_E".Stopp, Teil_da := "DB_E".Teil_da,\n                 Tuer_zu := "DB_E".Tuer_zu, Band => "Q_Band");';
defProTask({ id:'p15_eingaenge', ch:15, title:'Eingänge entkoppeln',
  story:'Der Elektriker hat den Stopptaster als Öffner verdrahtet — wie es die Sicherheit verlangt. Jetzt müsste man 40 Stellen im Programm umdrehen. "Genau deshalb", sagt der Werkmeister, "liest man Rohsignale an <b>einer</b> Stelle ein."',
  brief:'Übernimm am Anfang von <code>Main</code> alle Rohsignale in den Datenbaustein <code>"DB_E"</code> (🔒) — dort bedeutet TRUE immer „aktiv“:<br>• <code>"DB_E".Start</code> := <code>"I_Start"</code> (Schliesser)<br>• <code>"DB_E".Stopp</code> := Stopptaster gedrückt — <code>"I_Stopp_NC"</code> ist ein <b>Öffner</b> (TRUE = nicht gedrückt)<br>• <code>"DB_E".Teil_da</code> := Teil an der Station — <code>"I_Lichtschranke_NC"</code> ist TRUE, solange der Strahl frei ist<br>• <code>"DB_E".Tuer_zu</code> := <code>"I_Tuer"</code><br>Der Aufruf des Zellenbausteins steht schon darunter.',
  learn:'Rohsignale zentral aufbereiten und vom restlichen Programm entkoppeln.',
  take:'Wer Eingänge an einer Stelle aufbereitet (Öffner invertieren, entprellen, umbenennen), muss bei einer Hardware-Änderung auch nur diese Stelle anpassen. Der Rest des Programms arbeitet mit sauberen, einheitlichen Signalen.',
  man:'programmstruktur', must:['DB_ACCESS','NOT'],
  hint:'Öffner invertierst du mit NOT: <code>"DB_E".Stopp := NOT "I_Stopp_NC";</code>',
  blocks:[
    { name:'DB_E', kind:'DB', src: DB_E },
    { name:'FB_Zelle', kind:'FB', src: FB_Z144 },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // 1. Rohsignale übernehmen (Öffner beachten!)\n\n' + CALL144),
      ref: MAIN('   // 1. Rohsignale übernehmen\n   "DB_E".Start := "I_Start";\n   "DB_E".Stopp := NOT "I_Stopp_NC";\n   "DB_E".Teil_da := NOT "I_Lichtschranke_NC";\n   "DB_E".Tuer_zu := "I_Tuer";\n' + CALL144) }
  ],
  globals:{ I_Start:false, I_Stopp_NC:true, I_Lichtschranke_NC:true, I_Tuer:true, Q_Band:false },
  timed:[{ steps:[[0.1,{I_Start:true},{Q_Band:true, 'DB_E.Stopp':false}],[0.1,{I_Start:false},{Q_Band:true}],[0.1,{I_Lichtschranke_NC:false},{Q_Band:false, 'DB_E.Teil_da':true}],[0.1,{I_Lichtschranke_NC:true},{Q_Band:true}],[0.1,{I_Stopp_NC:false},{Q_Band:false, 'DB_E.Stopp':true}],[0.1,{I_Stopp_NC:true, I_Start:true, I_Tuer:false},{Q_Band:false}]] }],
  bind:['beltRunning=Q_Band','sensorActive=DB_E.Teil_da','partVisible=DB_E.Teil_da','lightGreen=I_Tuer'],
  wrong:[{ Main: MAIN('   "DB_E".Start := "I_Start";\n   "DB_E".Stopp := "I_Stopp_NC";\n   "DB_E".Teil_da := NOT "I_Lichtschranke_NC";\n   "DB_E".Tuer_zu := "I_Tuer";\n' + CALL144) }]
});

/* ---------- 145 ---------- */
const FB_GREIFER = 'FUNCTION_BLOCK "FB_Greifer"\nVAR_INPUT\n   Greifen : Bool;\nEND_VAR\nVAR_OUTPUT\n   Greifer_Auf : Bool;\n   Gegriffen : Bool;     // Greifer seit 0,5 s geschlossen\nEND_VAR\nVAR\n   Haltezeit : TON;\nEND_VAR\nBEGIN\n   #Greifer_Auf := NOT #Greifen;\n   #Haltezeit(IN := #Greifen, PT := T#500MS);\n   #Gegriffen := #Haltezeit.Q;\nEND_FUNCTION_BLOCK';
const FB_WEICHE = 'FUNCTION_BLOCK "FB_Weiche"\nVAR_INPUT\n   Aktiv : Bool;\n   Gut : Bool;\nEND_VAR\nVAR_OUTPUT\n   Winkel : Int;\nEND_VAR\nBEGIN\n   IF NOT #Aktiv THEN\n      #Winkel := 0;\n   ELSIF #Gut THEN\n      #Winkel := 20;\n   ELSE\n      #Winkel := -20;\n   END_IF;\nEND_FUNCTION_BLOCK';
const Z145_HEAD = 'FUNCTION_BLOCK "FB_Zelle"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Teil_da : Bool;\n   Teil_gut : Bool;\nEND_VAR\nVAR_OUTPUT\n   Band_Lauf : Bool;\n   Greifer_Auf : Bool;\n   Gegriffen : Bool;\n   Weiche : Int;\nEND_VAR\n';
defProTask({ id:'p15_geraete', ch:15, title:'Geräte verbinden',
  story:'Band, Greifer und Weiche haben jetzt je einen geprüften Geräte-Baustein (🔒). Was fehlt, ist der Anlagen-Baustein, der sie zusammenschaltet — die zweite Ebene des Standards: OB1 → Anlage → Geräte.',
  brief:'Die Schnittstelle von <code>FB_Zelle</code> steht. Lege unter <code>VAR</code> die Multiinstanzen <code>Band : "FB_Band";</code>, <code>Greifer : "FB_Greifer";</code> und <code>Sortierer : "FB_Weiche";</code> an und verbinde sie:<br>• <code>#Band</code>: Start, Stopp, Teil_da von aussen → <code>Lauf =&gt; #Band_Lauf</code><br>• <code>#Greifer</code>: greift, sobald ein Teil da ist (<code>Greifen := #Teil_da</code>) → <code>#Greifer_Auf</code>, <code>#Gegriffen</code><br>• <code>#Sortierer</code>: aktiv, wenn gegriffen ist, <code>Gut := #Teil_gut</code> → <code>#Weiche</code>',
  learn:'Einen Anlagen-FB aus mehreren Geräte-FBs (Multiinstanzen) zusammensetzen.',
  take:'Der Anlagen-FB kennt seine Geräte und verbindet deren Schnittstellen — die Geräte-FBs kennen einander nicht. Diese Hierarchie macht grosse Programme beherrschbar und jedes Gerät einzeln testbar.',
  man:'multiinstanz', must:['MULTI'],
  hint:'Drei Deklarationen unter VAR, drei Aufrufe im Code. Der Ausgang <code>#Gegriffen</code> des Greifers ist der Eingang <code>Aktiv</code> des Sortierers.',
  blocks:[
    { name:'FB_Band', kind:'FB', src: FB_BAND },
    { name:'FB_Greifer', kind:'FB', src: FB_GREIFER },
    { name:'FB_Weiche', kind:'FB', src: FB_WEICHE },
    { name:'FB_Zelle', kind:'FB', edit:true, start: Z145_HEAD + 'VAR\n   // Band, Greifer, Sortierer\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK',
      ref: Z145_HEAD + 'VAR\n   Band : "FB_Band";\n   Greifer : "FB_Greifer";\n   Sortierer : "FB_Weiche";\nEND_VAR\nBEGIN\n   #Band(Start := #Start, Stopp := #Stopp, Teil_da := #Teil_da, Lauf => #Band_Lauf);\n   #Greifer(Greifen := #Teil_da, Greifer_Auf => #Greifer_Auf, Gegriffen => #Gegriffen);\n   #Sortierer(Aktiv := #Gegriffen, Gut := #Teil_gut, Winkel => #Weiche);\nEND_FUNCTION_BLOCK' },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Zelle_DB"(Start := "S_Start", Stopp := "S_Stopp", Teil_da := "LS_Station", Teil_gut := "Pruef_OK",\n                 Band_Lauf => "Band_Motor", Greifer_Auf => "Greifer_Auf", Gegriffen => "Gegriffen", Weiche => "Weiche_Winkel");') }
  ],
  globals:{ S_Start:false, S_Stopp:false, LS_Station:false, Pruef_OK:false, Band_Motor:false, Greifer_Auf:true, Gegriffen:false, Weiche_Winkel:0 },
  timed:[{ steps:[[0.1,{S_Start:true},{Band_Motor:true, Greifer_Auf:true, Weiche_Winkel:0}],[0.1,{S_Start:false},{Band_Motor:true}],[0.1,{LS_Station:true, Pruef_OK:true},{Band_Motor:false, Greifer_Auf:false, Gegriffen:false, Weiche_Winkel:0}],[0.5,{},{Gegriffen:true, Weiche_Winkel:20}],[0.1,{LS_Station:false},{Band_Motor:true, Greifer_Auf:true, Weiche_Winkel:0}],[0.2,{LS_Station:true, Pruef_OK:false},{Band_Motor:false}],[0.6,{},{Weiche_Winkel:-20}]] }],
  bind:['beltRunning=Band_Motor','gripperOpen=Greifer_Auf','gateAngle=Weiche_Winkel','partVisible=LS_Station','sensorActive=LS_Station',{channel:'partColor', variable:'Pruef_OK', map:{'true':'green','false':'red'}}],
  wrong:[{ FB_Zelle: Z145_HEAD + 'VAR\n   Band : "FB_Band";\n   Greifer : "FB_Greifer";\n   Sortierer : "FB_Weiche";\nEND_VAR\nBEGIN\n   #Band(Start := #Start, Stopp := #Stopp, Teil_da := #Teil_da, Lauf => #Band_Lauf);\n   #Greifer(Greifen := #Teil_da, Greifer_Auf => #Greifer_Auf, Gegriffen => #Gegriffen);\n   #Sortierer(Aktiv := #Teil_da, Gut := #Teil_gut, Winkel => #Weiche);\nEND_FUNCTION_BLOCK' }]
});

/* ---------- 146 ---------- */
const BA_HEAD = 'FUNCTION_BLOCK "FB_Betriebsart"\nVAR_INPUT\n   Wahl_Hand : Bool;    // Wahlschalter Stellung HAND\n   Wahl_Auto : Bool;    // Wahlschalter Stellung AUTO\n   Start : Bool;\n   Stopp : Bool;\nEND_VAR\nVAR_OUTPUT\n   Modus : Int;         // 0 Aus, 1 Hand, 2 Automatik\n   Auto_Aktiv : Bool;   // Automatik läuft\n   Text : String[16];\nEND_VAR\n';
const BA_REF = BA_HEAD + 'BEGIN\n   IF #Wahl_Hand AND NOT #Wahl_Auto THEN\n      #Modus := 1;\n   ELSIF #Wahl_Auto AND NOT #Wahl_Hand THEN\n      #Modus := 2;\n   ELSE\n      #Modus := 0;\n   END_IF;\n   #Auto_Aktiv := (#Start OR #Auto_Aktiv) AND #Modus = 2 AND NOT #Stopp;\n   CASE #Modus OF\n      1: #Text := \'HAND\';\n      2: IF #Auto_Aktiv THEN\n            #Text := \'AUTOMATIK\';\n         ELSE\n            #Text := \'AUTO BEREIT\';\n         END_IF;\n   ELSE\n      #Text := \'AUS\';\n   END_CASE;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p15_betriebsart', ch:15, title:'Der Betriebsarten-Baustein',
  story:'In Kapitel 5 hast du die Betriebsarten mit CASE umgeschaltet. Jetzt wird daraus ein Standardbaustein — mit einer Sicherheitsregel, die ARIA gern übersieht: Steht der Wahlschalter auf zwei Stellungen gleichzeitig (Drahtbruch, Kurzschluss), ist die Betriebsart <b>AUS</b>.',
  brief:'Schreibe den Code von <code>FB_Betriebsart</code>:<br>• <code>Modus</code>: nur <code>Wahl_Hand</code> → 1, nur <code>Wahl_Auto</code> → 2, sonst (keins oder beide) → 0<br>• <code>Auto_Aktiv</code>: Selbsthaltung mit <code>Start</code>, nur in Modus 2, <code>Stopp</code> schaltet ab<br>• <code>Text</code>: <code>\'AUS\'</code>, <code>\'HAND\'</code>, im Modus 2 <code>\'AUTOMATIK\'</code> wenn aktiv, sonst <code>\'AUTO BEREIT\'</code>',
  learn:'Bekannte Betriebsarten-Logik als Standard-FB mit sicherem Verhalten kapseln — Umbau aus Kapitel 5.',
  take:'Ein widersprüchliches Eingangssignal muss immer in den sicheren Zustand führen. Das gehört in den Baustein selbst — dann gilt es automatisch für jede Anlage, die ihn verwendet.',
  man:'programmstruktur', must:['CASE','STRING'], warnFree:['OUT_NOT_ALL_PATHS'],
  hint:'Die Selbsthaltung bricht automatisch ab, sobald <code>#Modus</code> nicht mehr 2 ist: <code>(#Start OR #Auto_Aktiv) AND #Modus = 2 AND NOT #Stopp</code>.',
  blocks:[
    { name:'FB_Betriebsart', kind:'FB', edit:true, start: BA_HEAD + 'BEGIN\n   \nEND_FUNCTION_BLOCK', ref: BA_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Betriebsart_DB"(Wahl_Hand := "WS_Hand", Wahl_Auto := "WS_Auto", Start := "S_Start", Stopp := "S_Stopp",\n                       Modus => "Modus", Auto_Aktiv => "Automatik", Text => "HMI_Text");') }
  ],
  globals:{ WS_Hand:false, WS_Auto:false, S_Start:false, S_Stopp:false, Modus:0, Automatik:false, HMI_Text:'' }, types:{ HMI_Text:'STRING[16]' },
  timed:[{ steps:[[0.1,{},{Modus:0, HMI_Text:'AUS'}],[0.1,{WS_Hand:true},{Modus:1, HMI_Text:'HAND'}],[0.1,{S_Start:true},{Automatik:false}],[0.1,{S_Start:false, WS_Hand:false, WS_Auto:true},{Modus:2, Automatik:false, HMI_Text:'AUTO BEREIT'}],[0.1,{S_Start:true},{Automatik:true, HMI_Text:'AUTOMATIK'}],[0.1,{S_Start:false},{Automatik:true}],[0.1,{WS_Hand:true},{Modus:0, Automatik:false, HMI_Text:'AUS'}],[0.1,{WS_Hand:false},{Modus:2, Automatik:false}],[0.1,{S_Start:true},{Automatik:true}],[0.1,{S_Start:false, S_Stopp:true},{Automatik:false}]] }],
  bind:['displayText=HMI_Text','displayValue=Modus','displayLabel:"MODUS"','lightGreen=Automatik','lightYellow=WS_Hand'],
  wrong:[{ FB_Betriebsart: BA_REF.replace('   IF #Wahl_Hand AND NOT #Wahl_Auto THEN\n      #Modus := 1;\n   ELSIF #Wahl_Auto AND NOT #Wahl_Hand THEN', '   IF #Wahl_Hand THEN\n      #Modus := 1;\n   ELSIF #Wahl_Auto THEN') }, { FB_Betriebsart: BA_REF.replace(' AND #Modus = 2 AND NOT #Stopp', ' AND NOT #Stopp') }]
});

/* ---------- 147 ---------- */
const PICK_HEAD = 'FUNCTION_BLOCK "FB_Pick"\nVAR_INPUT\n   Start : Bool;        // Freigabe (Automatik)\n   Teil_da : Bool;      // Teil liegt an der Greifstation\n   Greifer_zu : Bool;   // Rückmeldung: Greifer geschlossen\n   Gut : Bool;          // Teil in Ordnung → LAGER (+90°), sonst NACHARBEIT (−90°)\nEND_VAR\nVAR_OUTPUT\n   Arm : Int;           // Soll-Winkel\n   Greifer_Auf : Bool;\n   Schritt : Int;\n   Fertig : Bool;       // TRUE für einen Zyklus, wenn ein Teil abgelegt ist\nEND_VAR\nVAR\n   Ziel : Int;          // Zielwinkel für das aktuelle Teil\n   T_Schwenk : TON;\n   T_Ablegen : TON;\n   T_Zurueck : TON;\nEND_VAR\n';
const PICK_REF = PICK_HEAD + 'BEGIN\n   #T_Schwenk(IN := #Schritt = 2, PT := T#1S);\n   #T_Ablegen(IN := #Schritt = 3, PT := T#500MS);\n   #T_Zurueck(IN := #Schritt = 4, PT := T#1S);\n   #Fertig := FALSE;\n   CASE #Schritt OF\n      0: // Warten auf Teil\n         IF #Start AND #Teil_da THEN\n            IF #Gut THEN\n               #Ziel := 90;\n            ELSE\n               #Ziel := -90;\n            END_IF;\n            #Schritt := 1;\n         END_IF;\n      1: // Greifen\n         IF #Greifer_zu THEN\n            #Schritt := 2;\n         END_IF;\n      2: // Schwenken\n         IF #T_Schwenk.Q THEN\n            #Schritt := 3;\n         END_IF;\n      3: // Ablegen\n         IF #T_Ablegen.Q THEN\n            #Schritt := 4;\n         END_IF;\n      4: // Zurück in Grundstellung\n         IF #T_Zurueck.Q THEN\n            #Schritt := 0;\n            #Fertig := TRUE;\n         END_IF;\n   END_CASE;\n   #Greifer_Auf := NOT (#Schritt = 1 OR #Schritt = 2);\n   IF #Schritt = 2 OR #Schritt = 3 THEN\n      #Arm := #Ziel;\n   ELSE\n      #Arm := 0;\n   END_IF;\nEND_FUNCTION_BLOCK';
const PICK_STEPS = [[0.1,{Start:true},{Schritt:0, Greifer_Auf:true, Arm:0}],[0.1,{Teil_da:true, Gut:true},{Schritt:1, Greifer_Auf:false, Arm:0}],[0.1,{Greifer_zu:true},{Schritt:2, Arm:90, Greifer_Auf:false}],[0.1,{Teil_da:false},{Schritt:2}],[1,{},{Schritt:3, Arm:90, Greifer_Auf:true}],[0.1,{Greifer_zu:false},{Schritt:3}],[0.5,{},{Schritt:4, Arm:0}],[0.1,{},{Schritt:4, Fertig:false}],[1,{},{Schritt:0, Fertig:true}],[0.1,{},{Fertig:false}],[0.1,{Teil_da:true, Gut:false},{Schritt:1}],[0.1,{Greifer_zu:true},{Arm:-90}]];
defProTask({ id:'p15_schrittkette', ch:15, title:'Die Schrittkette als Baustein',
  story:'Die Pick-&amp;-Place-Kette aus Kapitel 10 steht bei ARIA noch als loser Code im OB1. Der Werkmeister: "Eine Schrittkette ist ein Gerät wie jedes andere. Sie bekommt einen FB, eine Schnittstelle und ihre Timer als Multiinstanzen."',
  brief:'Die Schnittstelle von <code>FB_Pick</code> steht (inklusive der drei Timer). Schreibe die Schrittkette mit <code>CASE #Schritt OF</code>:<br>• <b>0</b> Warten: wenn <code>Start</code> und <code>Teil_da</code> → <code>Ziel</code> := 90 bei <code>Gut</code>, sonst −90; weiter zu 1<br>• <b>1</b> Greifen: wenn <code>Greifer_zu</code> → 2<br>• <b>2</b> Schwenken: wenn <code>#T_Schwenk.Q</code> (1 s) → 3<br>• <b>3</b> Ablegen: wenn <code>#T_Ablegen.Q</code> (0,5 s) → 4<br>• <b>4</b> Zurück: wenn <code>#T_Zurueck.Q</code> (1 s) → 0 und <code>Fertig</code> für einen Zyklus TRUE<br>Timer <b>vor</b> dem CASE aufrufen: <code>#T_Schwenk(IN := #Schritt = 2, PT := T#1S);</code> usw. Ausgänge <b>nach</b> dem CASE: <code>Greifer_Auf</code> ist zu in Schritt 1 und 2, <code>Arm</code> = <code>Ziel</code> in Schritt 2 und 3, sonst 0.',
  learn:'Eine Schrittkette mit Timern als wiederverwendbaren FB kapseln — Umbau aus Kapitel 10.',
  take:'Als FB wird die Schrittkette zum Gerät: Die Anlage gibt Start und Rückmeldungen hinein und bekommt Sollwerte heraus. Ihr Schritt, ihr Ziel und ihre Timer bleiben sauber in der Instanz verpackt.',
  man:'programmstruktur', must:['CASE','TON'], warnFree:['CONDITIONAL_CALL'],
  hint:'Setze <code>#Fertig := FALSE;</code> vor dem CASE — dann ist es nur in dem Zyklus TRUE, in dem Schritt 4 nach 0 wechselt.',
  hint2:'Das Muster für jeden Schritt: <code>2: IF #T_Schwenk.Q THEN #Schritt := 3; END_IF;</code>',
  blocks:[
    { name:'FB_Pick', kind:'FB', edit:true, start: PICK_HEAD + 'BEGIN\n   // 1. Timer aufrufen\n\n   // 2. Schrittkette\n\n   // 3. Ausgänge aus dem Schritt\n\nEND_FUNCTION_BLOCK', ref: PICK_REF },
    { name:'Main', kind:'OB', src: MAIN('   "FB_Pick_DB"(Start := "Automatik", Teil_da := "LS_Station", Greifer_zu := "Greifer_zu", Gut := "Pruef_OK",\n                Arm => "Arm_Soll", Greifer_Auf => "Greifer_Auf", Schritt => "Schritt");') }
  ],
  globals:{ Automatik:false, LS_Station:false, Greifer_zu:false, Pruef_OK:false, Arm_Soll:0, Greifer_Auf:true, Schritt:0 },
  unit:[{ block:'FB_Pick', steps: PICK_STEPS }],
  timed:[{ steps:[[0.1,{Automatik:true, LS_Station:true, Pruef_OK:true},{Schritt:1, Greifer_Auf:false}],[0.4,{Greifer_zu:true},{Schritt:2, Arm_Soll:90}],[0.1,{LS_Station:false},{}],[1,{},{Schritt:3, Greifer_Auf:true}],[0.2,{Greifer_zu:false},{}],[0.5,{},{Schritt:4, Arm_Soll:0}],[0.1,{},{Schritt:4}],[1.0,{},{Schritt:0}]] }],
  bind:['armAngle=Arm_Soll','gripperOpen=Greifer_Auf','partVisible=LS_Station','displayValue=Schritt','displayLabel:"SCHRITT"',{channel:'partColor', variable:'Pruef_OK', map:{'true':'green','false':'red'}}],
  wrong:[{ FB_Pick: PICK_REF.replace('   #Fertig := FALSE;\n', '') }, { FB_Pick: PICK_REF.replace('IF #Schritt = 2 OR #Schritt = 3 THEN', 'IF #Schritt = 2 THEN') }]
});

/* ---------- 148 ---------- */
const ZG = (glob) => 'FUNCTION_BLOCK "FB_Zaehler"\n' + (glob ? '' : 'VAR_INPUT\n   Sensor : Bool;\nEND_VAR\n') + 'VAR_OUTPUT\n   Anzahl : Int;\nEND_VAR\nVAR\n   Alt : Bool;\nEND_VAR\nBEGIN\n   IF ' + (glob ? '"Sensor_Band1"' : '#Sensor') + ' AND NOT #Alt THEN\n      #Anzahl := #Anzahl + 1;\n   END_IF;\n   #Alt := ' + (glob ? '"Sensor_Band1"' : '#Sensor') + ';\nEND_FUNCTION_BLOCK';
defProTask({ id:'p15_global_dbg', ch:15, title:'Globale Daten im Baustein', debug:true,
  story:'Band 2 meldet genauso viele Teile wie Band 1 — obwohl es seit einer Stunde stillsteht. ARIA: "Ein Baustein, der alles weiss, ist doch praktisch."',
  brief:'Beide Instanzen <code>"Zaehler_1"</code> und <code>"Zaehler_2"</code> von <code>FB_Zaehler</code> zählen immer dasselbe. Band 1 hat den Sensor <code>"Sensor_Band1"</code>, Band 2 <code>"Sensor_Band2"</code>. Repariere <b>Baustein und Aufrufe</b> — die gelbe Warnung zeigt, wo das Problem liegt.',
  learn:'Bausteine nur über ihre Schnittstelle mit der Umgebung verbinden (Kapselung).',
  take:'Greift ein FB direkt auf globale Variablen zu, arbeiten <b>alle</b> Instanzen mit denselben Daten — der Baustein ist nicht wiederverwendbar. Alles, was von aussen kommt, gehört in die Schnittstelle.',
  man:'standard', warnFree:['GLOBAL_ACCESS'],
  hint:'Der FB braucht einen Eingang (z.B. <code>Sensor : Bool</code>) statt <code>"Sensor_Band1"</code>. Dann bekommt jeder Aufruf seinen eigenen Sensor.',
  blocks:[
    { name:'FB_Zaehler', kind:'FB', edit:true, start: ZG(true), ref: ZG(false) },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   "Zaehler_1"(Anzahl => "Anzahl_1");\n   "Zaehler_2"(Anzahl => "Anzahl_2");'), ref: MAIN('   "Zaehler_1"(Sensor := "Sensor_Band1", Anzahl => "Anzahl_1");\n   "Zaehler_2"(Sensor := "Sensor_Band2", Anzahl => "Anzahl_2");') }
  ],
  instances:{ Zaehler_1:'FB_Zaehler', Zaehler_2:'FB_Zaehler' },
  globals:{ Sensor_Band1:false, Sensor_Band2:false, Anzahl_1:0, Anzahl_2:0 },
  timed:[{ steps:[[0.1,{Sensor_Band1:true},{Anzahl_1:1, Anzahl_2:0}],[0.1,{Sensor_Band1:false},{}],[0.1,{Sensor_Band1:true},{Anzahl_1:2, Anzahl_2:0}],[0.1,{Sensor_Band2:true},{Anzahl_1:2, Anzahl_2:1}]] }],
  bind:['beltRunning=Sensor_Band1','belt2Running=Sensor_Band2','displayValue=Anzahl_2','displayLabel:"BAND 2"']
});

/* ---------- 149 ---------- */
const SS_START = 'FUNCTION_BLOCK "FB_Signalsaeule"\nVAR_INPUT\n   Betrieb : Bool;\n   Stoerung : Bool;\n   Warnung : Bool;\nEND_VAR\nVAR_OUTPUT\n   Rot : Bool;\n   Gelb : Bool;\n   Gruen : Bool;\nEND_VAR\nVAR\n   Hilfsmerker : Bool;\n   Blink : TON;\n   Takt : Bool;\nEND_VAR\nVAR_TEMP\n   Zaehler : Int;\nEND_VAR\nBEGIN\n   Zaehler := Zaehler + 1;\n   Blink(IN := NOT Blink.Q, PT := T#500MS);\n   IF Blink.Q THEN\n      Takt := NOT Takt;\n   END_IF;\n   Rot := Stoerung AND Takt;\n   Gelb := Warnung OR "Wartung_faellig";\n   Gruen := Betrieb AND NOT Stoerung;\nEND_FUNCTION_BLOCK';
const SS_REF = '// Signalsäule nach Firmenstandard\n// Rot blinkt bei Störung (0,5 s), Gelb = Warnung oder Wartung, Grün = Betrieb ohne Störung\nFUNCTION_BLOCK "FB_Signalsaeule"\nVAR_INPUT\n   Betrieb : Bool;\n   Stoerung : Bool;\n   Warnung : Bool;\n   Wartung : Bool;     // Wartung fällig\nEND_VAR\nVAR_OUTPUT\n   Rot : Bool;\n   Gelb : Bool;\n   Gruen : Bool;\nEND_VAR\nVAR\n   Blink : TON;        // Blinktakt\n   Takt : Bool;\nEND_VAR\nBEGIN\n   #Blink(IN := NOT #Blink.Q, PT := T#500MS);\n   IF #Blink.Q THEN\n      #Takt := NOT #Takt;\n   END_IF;\n   #Rot := #Stoerung AND #Takt;\n   #Gelb := #Warnung OR #Wartung;\n   #Gruen := #Betrieb AND NOT #Stoerung;\nEND_FUNCTION_BLOCK';
defProTask({ id:'p15_export', ch:15, title:'Sauber für die Bibliothek',
  story:'Die Signalsäule soll als Firmenstandard in die Bibliothek — und von dort in alle weiteren Anlagen. ARIA hat den Baustein „vorbereitet“: Er funktioniert, aber voller Altlasten. "In die Bibliothek kommt nur, was ohne eine einzige Warnung übersetzt", sagt der Werkmeister.',
  brief:'Räume <code>FB_Signalsaeule</code> und <code>Main</code> auf, bis <b>keine Warnung</b> mehr erscheint:<br>• nicht benötigte Variablen entfernen<br>• die globale Variable <code>"Wartung_faellig"</code> nicht mehr im FB lesen, sondern über einen neuen Eingang <code>Wartung</code> übergeben (in <code>Main</code> verdrahten)<br>• das Verhalten bleibt gleich: Rot blinkt bei Störung, Gelb bei Warnung oder Wartung, Grün bei Betrieb ohne Störung<br>Tipp: Schreib lokale Namen mit <code>#</code> und globale in Anführungszeichen — wie im TIA Portal.',
  learn:'Bausteine warnungsfrei, gekapselt und wiederverwendbar machen.',
  take:'Ein Standardbaustein ist warnungsfrei, gekapselt und kommentiert. Er bekommt alles über seine Schnittstelle — so lässt er sich in jeder Anlage wiederverwenden.',
  man:'standard', warnFree:['UNUSED_VAR','GLOBAL_ACCESS','TEMP_READ_BEFORE_WRITE','CONDITIONAL_CALL','INSTANCE_TWICE','OUT_NOT_ALL_PATHS','RET_NOT_SET','STRING_TRUNC'],
  hint:'Drei Warnungen: eine ungenutzte statische Variable, ein TEMP-Zähler, der nichts bewirkt, und ein direkter Zugriff auf eine globale Variable.',
  blocks:[
    { name:'FB_Signalsaeule', kind:'FB', edit:true, start: SS_START, ref: SS_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   "Saeule_DB"(Betrieb := "Betrieb", Stoerung := "Stoerung", Warnung := "Warnung",\n               Rot => "H_Rot", Gelb => "H_Gelb", Gruen => "H_Gruen");'),
      ref: MAIN('   "Saeule_DB"(Betrieb := "Betrieb", Stoerung := "Stoerung", Warnung := "Warnung", Wartung := "Wartung_faellig",\n               Rot => "H_Rot", Gelb => "H_Gelb", Gruen => "H_Gruen");') }
  ],
  instances:{ Saeule_DB:'FB_Signalsaeule' },
  globals:{ Betrieb:false, Stoerung:false, Warnung:false, Wartung_faellig:false, H_Rot:false, H_Gelb:false, H_Gruen:false },
  timed:[{ steps:[[0.25,{Betrieb:true},{H_Gruen:true, H_Gelb:false, H_Rot:false}],[0.25,{Wartung_faellig:true},{H_Gelb:true}],[0.25,{Wartung_faellig:false, Warnung:true},{H_Gelb:true}],[0.25,{Warnung:false},{H_Gelb:false}]] },
    { steps:[[0.25,{Stoerung:true},{H_Rot:false, H_Gruen:false}],[0.25,{},{H_Rot:false}],[0.25,{},{H_Rot:true}],[0.25,{},{H_Rot:true}],[0.25,{},{H_Rot:true}],[0.25,{},{H_Rot:true}],[0.25,{},{H_Rot:false}]] }],
  bind:['lightRed=H_Rot','lightYellow=H_Gelb','lightGreen=H_Gruen','faultActive=Stoerung']
});

/* ---------- 150 (Final Boss 2) ---------- */
const UDT_TEIL = 'TYPE "UDT_Teil"\nVERSION : 0.1\n   STRUCT\n      Nr : DInt;\n      Gewicht : Real;\n      OK : Bool;\n   END_STRUCT;\nEND_TYPE';
const STD = 'FUNCTION_BLOCK "FB_Motor_Std"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Rueckmeldung : Bool;\n   Quittieren : Bool;\nEND_VAR\nVAR_OUTPUT\n   Lauf : Bool;\n   Stoerung : Bool;\n   Starts : DInt;\nEND_VAR\nVAR\n   Lauf_alt : Bool;\n   Ueberwachung : TON;\nEND_VAR\nBEGIN\n   #Lauf := (#Start OR #Lauf) AND NOT #Stopp AND NOT #Stoerung;\n   IF #Lauf AND NOT #Lauf_alt THEN\n      #Starts := #Starts + 1;\n   END_IF;\n   #Lauf_alt := #Lauf;\n   #Ueberwachung(IN := #Lauf AND NOT #Rueckmeldung, PT := T#2S);\n   IF #Ueberwachung.Q THEN\n      #Stoerung := TRUE;\n      #Lauf := FALSE;\n   END_IF;\n   IF #Quittieren THEN\n      #Stoerung := FALSE;\n   END_IF;\nEND_FUNCTION_BLOCK';
const TT = 'FUNCTION "FC_Teiletext" : String[30]\nVAR_INPUT\n   Nr : DInt;\n   Gewicht : Int;\n   OK : Bool;\nEND_VAR\nBEGIN\n   #FC_Teiletext := CONCAT(IN1 := \'Teil \', IN2 := DINT_TO_STRING(#Nr), IN3 := \': \',\n                           IN4 := INT_TO_STRING(#Gewicht), IN5 := \' g \');\n   IF #OK THEN\n      #FC_Teiletext := CONCAT(IN1 := #FC_Teiletext, IN2 := \'OK\');\n   ELSE\n      #FC_Teiletext := CONCAT(IN1 := #FC_Teiletext, IN2 := \'NOK\');\n   END_IF;\nEND_FUNCTION';
const ZF_HEAD = 'FUNCTION_BLOCK "FB_Zelle"\nVAR_INPUT\n   Start : Bool;\n   Stopp : Bool;\n   Quittieren : Bool;\n   Teil_da : Bool;       // Lichtschranke Greifstation\n   RM_Band : Bool;       // Rückmeldung Bandmotor\n   Greifer_zu : Bool;    // Rückmeldung Greifer\n   Teil_Nr : DInt;       // vom Scanner\n   Gewicht : Real;       // von der Waage\nEND_VAR\nVAR_OUTPUT\n   Band : Bool;\n   Arm : Int;\n   Greifer_Auf : Bool;\n   Stoerung : Bool;\n   Anzahl_OK : Int;\n   Anzahl_NOK : Int;\n   Meldung : String[30];\nEND_VAR\n';
const ZF_REF = ZF_HEAD + 'VAR\n   Betrieb : Bool;\n   Motor : "FB_Motor_Std";\n   Pick : "FB_Pick";\nEND_VAR\nBEGIN\n   // Betrieb: Start/Stopp mit Selbsthaltung, Störung schaltet ab\n   #Betrieb := (#Start OR #Betrieb) AND NOT #Stopp AND NOT #Stoerung;\n\n   // Band läuft, solange kein Teil da ist und der Greifer in Grundstellung wartet\n   #Motor(Start := #Betrieb AND NOT #Teil_da AND #Pick.Schritt = 0,\n          Stopp := NOT #Betrieb OR #Teil_da OR #Pick.Schritt <> 0,\n          Rueckmeldung := #RM_Band, Quittieren := #Quittieren,\n          Lauf => #Band, Stoerung => #Stoerung);\n\n   // Greifzyklus: gute Teile ins LAGER, schlechte in die NACHARBEIT\n   #Pick(Start := #Betrieb, Teil_da := #Teil_da, Greifer_zu := #Greifer_zu,\n         Gut := #Gewicht >= 480.0 AND #Gewicht <= 520.0,\n         Arm => #Arm, Greifer_Auf => #Greifer_Auf);\n\n   // Statistik und Meldung, sobald ein Teil abgelegt ist\n   IF #Pick.Fertig THEN\n      IF #Pick.Ziel > 0 THEN\n         #Anzahl_OK := #Anzahl_OK + 1;\n      ELSE\n         #Anzahl_NOK := #Anzahl_NOK + 1;\n      END_IF;\n      #Meldung := "FC_Teiletext"(Nr := #Teil_Nr, Gewicht := REAL_TO_INT(#Gewicht), OK := #Pick.Ziel > 0);\n   END_IF;\n   IF #Stoerung THEN\n      #Meldung := \'Störung Band\';\n   ELSIF NOT #Betrieb THEN\n      #Meldung := \'Bereit\';\n   ELSIF #Meldung = \'Bereit\' OR #Meldung = \'\' THEN\n      #Meldung := \'Automatik läuft\';\n   END_IF;\nEND_FUNCTION_BLOCK';
const ZF_MAIN = MAIN('   "FB_Zelle_DB"(Start := "S_Start", Stopp := "S_Stopp", Quittieren := "S_Quit",\n                 Teil_da := "LS_Station", RM_Band := "RM_Band", Greifer_zu := "Greifer_zu",\n                 Teil_Nr := "Scan_Nr", Gewicht := "Waage",\n                 Band => "Band_Motor", Arm => "Arm_Soll", Greifer_Auf => "Greifer_Auf", Stoerung => "Stoerung",\n                 Anzahl_OK => "Lager", Anzahl_NOK => "Nacharbeit", Meldung => "HMI_Text");');
const SEQ150 = [
  [0.1,{},{Band_Motor:false, HMI_Text:'Bereit'}],
  [0.1,{S_Start:true},{Band_Motor:true, HMI_Text:'Automatik läuft'}],
  [0.1,{S_Start:false},{Band_Motor:true}],
  [1.0,{LS_Station:true, Scan_Nr:17, Waage:498.2},{Band_Motor:false, Greifer_Auf:false, Arm_Soll:0}],
  [0.3,{Greifer_zu:true},{Arm_Soll:90, Greifer_Auf:false}],
  [0.1,{LS_Station:false},{Band_Motor:false}],
  [1.0,{},{Greifer_Auf:true, Arm_Soll:90}],
  [0.1,{Greifer_zu:false},{}],
  [0.5,{},{Arm_Soll:0, Band_Motor:false}],
  [0.1,{},{Lager:0}],
  [1.0,{},{Lager:1, Nacharbeit:0, HMI_Text:'Teil 17: 498 g OK'}],
  [0.1,{},{Band_Motor:true}],
  [0.5,{LS_Station:true, Scan_Nr:18, Waage:535.0},{Band_Motor:false, Greifer_Auf:false}],
  [0.2,{Greifer_zu:true},{Arm_Soll:-90}],
  [0.1,{LS_Station:false},{}],
  [1.0,{},{Greifer_Auf:true, Arm_Soll:-90}],
  [0.1,{Greifer_zu:false},{}],
  [0.5,{},{Arm_Soll:0}],
  [0.1,{},{}],
  [1.0,{},{Lager:1, Nacharbeit:1, HMI_Text:'Teil 18: 535 g NOK'}],
  [0.1,{},{Band_Motor:true}],
  [0.1,{S_Stopp:true},{Band_Motor:false, HMI_Text:'Bereit'}]
];
defProTask({ id:'p15_final', ch:15, title:'Final Boss 2: Zelle nach Standard', boss:true, final:true,
  story:'ARIAs Backup schlägt ein letztes Mal zu: Sie löscht den Zellen-Baustein und den OB1. "Ohne mich läuft hier nichts", lacht sie. Der Werkmeister legt dir die geprüfte Bibliothek hin — Motorstandard, Greifkette, Teiletext. "Den Rest baust du. Nach Standard. Dann ist sie endgültig draussen."',
  brief:'<b>Bibliothek (🔒):</b> <code>FB_Motor_Std</code> (Kap. 13), <code>FB_Pick</code> (Kap. 15, mit Ausgang <code>Fertig</code> und statischem <code>Ziel</code>), <code>FC_Teiletext</code> (Kap. 14).<br><b>1. Schreibe <code>FB_Zelle</code></b> (Schnittstelle steht) mit den Multiinstanzen <code>Motor : "FB_Motor_Std"</code> und <code>Pick : "FB_Pick"</code>:<br>• <code>Betrieb</code> (statisch): Selbsthaltung mit <code>Start</code>/<code>Stopp</code>, eine <code>Stoerung</code> schaltet ab<br>• <code>#Motor</code>: Start, wenn Betrieb, kein Teil da und <code>#Pick.Schritt</code> = 0 — Stopp im umgekehrten Fall; Rückmeldung <code>RM_Band</code>, <code>Quittieren</code> → <code>Band</code>, <code>Stoerung</code><br>• <code>#Pick</code>: Start = Betrieb, <code>Teil_da</code>, <code>Greifer_zu</code>, <code>Gut</code> = Gewicht 480…520 g → <code>Arm</code>, <code>Greifer_Auf</code><br>• bei <code>#Pick.Fertig</code>: <code>Anzahl_OK</code> bzw. <code>Anzahl_NOK</code> erhöhen (<code>#Pick.Ziel</code> &gt; 0 = gut) und <code>Meldung</code> := <code>"FC_Teiletext"</code>(Nr, gerundetes Gewicht, OK)<br>• <code>Meldung</code> bei Störung <code>\'Störung Band\'</code>, ohne Betrieb <code>\'Bereit\'</code>, bei Betrieb ohne bisherige Teilemeldung <code>\'Automatik läuft\'</code><br><b>2. Schreibe <code>Main</code></b>: <code>"FB_Zelle_DB"</code> mit den PLC-Variablen verdrahten (siehe Variablenliste).',
  learn:'Ein vollständiges Anlagenprogramm aus Standardbausteinen nach der Hierarchie OB1 → Anlage → Geräte aufbauen.',
  take:'Du hast ein Anlagenprogramm so aufgebaut, wie es in der Industrie üblich ist: geprüfte Geräte-Bausteine, ein Anlagen-FB mit Multiinstanzen, ein schlanker OB1 — alles über Schnittstellen verbunden. ARIA hat keinen Platz mehr, an dem sie sich verstecken kann.',
  man:'programmstruktur', must:['MULTI','FC_CALL','STRING','STAT'], warnFree:['GLOBAL_ACCESS','CONDITIONAL_CALL','INSTANCE_TWICE','TEMP_READ_BEFORE_WRITE'],
  hint:'Beginne mit Betrieb und Motor und teste das Band. Dann den Pick-Aufruf. Zum Schluss Statistik und Meldung.',
  hint2:'Ausgänge und statische Werte von Multiinstanzen liest du direkt: <code>#Pick.Schritt</code>, <code>#Pick.Fertig</code>, <code>#Pick.Ziel</code>.',
  blocks:[
    { name:'UDT_Teil', kind:'UDT', src: UDT_TEIL },
    { name:'FB_Motor_Std', kind:'FB', src: STD },
    { name:'FB_Pick', kind:'FB', src: PICK_REF },
    { name:'FC_Teiletext', kind:'FC', src: TT },
    { name:'FB_Zelle', kind:'FB', edit:true, start: ZF_HEAD + 'VAR\n   // Betrieb, Motor, Pick\nEND_VAR\nBEGIN\n   \nEND_FUNCTION_BLOCK', ref: ZF_REF },
    { name:'Main', kind:'OB', edit:true, start: MAIN('   // "FB_Zelle_DB"(…);\n'), ref: ZF_MAIN }
  ],
  globals:{ S_Start:false, S_Stopp:false, S_Quit:false, LS_Station:false, RM_Band:true, Greifer_zu:false, Scan_Nr:0, Waage:0,
    Band_Motor:false, Arm_Soll:0, Greifer_Auf:true, Stoerung:false, Lager:0, Nacharbeit:0, HMI_Text:'' },
  types:{ Scan_Nr:'DINT', Waage:'REAL', HMI_Text:'STRING[30]' },
  timed:[{ steps: SEQ150 },
    { steps:[[0.1,{S_Start:true, RM_Band:false},{Band_Motor:true}],[0.1,{S_Start:false},{}],[2,{},{Stoerung:true, Band_Motor:false, HMI_Text:'Störung Band'}],[0.1,{S_Start:true},{Band_Motor:false}],[0.1,{S_Start:false, S_Quit:true, RM_Band:true},{Stoerung:false}],[0.1,{S_Quit:false, S_Start:true},{Band_Motor:true}]] }],
  bind:['beltRunning=Band_Motor','armAngle=Arm_Soll','gripperOpen=Greifer_Auf','partVisible=LS_Station','sensorActive=LS_Station','motorFault1=Stoerung','faultActive=Stoerung','displayText=HMI_Text','displayValue=Lager','displayLabel:"LAGER"','partLabel=Scan_Nr'],
  wrong:[
    { FB_Zelle: ZF_REF.replace('#Pick.Ziel > 0 THEN', '#Gewicht > 0.0 THEN') },
    { FB_Zelle: ZF_REF.replace(' AND #Pick.Schritt = 0,', ',').replace(' OR #Pick.Schritt <> 0,', ',') }
  ]
});
})();
