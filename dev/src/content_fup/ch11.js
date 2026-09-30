/* ===== FUP QUEST · KAPITEL 11 — Bausteine: FC, Schnittstelle, Aufruf-Box (Profi-Stufe) ===== */
(function(){
const MAIN = body => kOB('Main', body);
const SIG_D = { in:'Taste:Bool|Fahrtanforderung; Gleis_frei:Bool|Zielgleis frei; Weiche_Endlage:Bool|Weiche in Endlage', out:'Fahrt:Bool|Signal auf Fahrt' };
const SIG_NW = 'NETWORK Fahrt\n#Taste AND #Gleis_frei AND #Weiche_Endlage => #Fahrt;';
const SIG_FC = kFC('FC_Signal', 'Void', SIG_D, SIG_NW);
const CALL_A = 'NETWORK Signal A\n=> "FC_Signal"(Taste := "Taste_A", Gleis_frei := "Gleis1_frei", Weiche_Endlage := "W1_Endlage", Fahrt => "Signal_A");';
const G_A = { Taste_A:false, Gleis1_frei:false, W1_Endlage:false, Signal_A:false };

defFupPro({ id:'fp11_erste_fc', ch:11, title:'Die erste Funktion',
  story:'Frau Gasser öffnet das alte Stellwerksprogramm, einen einzigen riesigen OB, in dem sich ARIA versteckt hat. Du fängst neu an mit einem <b>Baustein</b> für ein Signal, dessen Schnittstelle steht und dessen Rumpf leer ist.',
  brief:'Zeichne in <code>FC_Signal</code> ein Netzwerk: <code>#Taste</code>, <code>#Gleis_frei</code> und <code>#Weiche_Endlage</code> an einer &amp;-Box → <code>#Fahrt</code>.<br>Lokale Variablen beginnen mit <code>#</code> und stehen links in der Liste. <code>Main</code> (🔒) ruft die Funktion für Signal A auf.',
  learn:'Einen Baustein mit Schnittstelle programmieren: lokale Variablen mit #.',
  take:'Ein Baustein arbeitet nur mit seiner <b>Schnittstelle</b>: Eingänge kommen herein, Ausgänge gehen hinaus. Im Baustein heissen sie <code>#Name</code>; der Aufruf verbindet sie mit echten Signalen.',
  man:'bausteine', must:['SERIES'],
  hint:'+ Netzwerk, dann wie in der Grundstufe — nur mit # vor den Namen.',
  blocks:[
    { name:'FC_Signal', kind:'FC', edit:true, start: kFC('FC_Signal', 'Void', SIG_D, ''), ref: SIG_FC },
    { name:'Main', kind:'OB', src: MAIN(CALL_A) }
  ],
  globals: G_A,
  unit:[{ block:'FC_Signal', steps: truth(['Taste','Gleis_frei','Weiche_Endlage'], e => ({ Fahrt: e.Taste && e.Gleis_frei && e.Weiche_Endlage })) }],
  tests:[[{ Taste_A:true, Gleis1_frei:true, W1_Endlage:true }, { Signal_A:true }], [{ Taste_A:true, Gleis1_frei:true }, { Signal_A:false }]],
  bind:['signalEntry=Signal_A'] });

defFupPro({ id:'fp11_schnittstelle', ch:11, title:'Die Schnittstelle',
  story:'<code>FC_Tempo</code> hat ein fertiges Netzwerk, aber keine Schnittstelle — ARIA hat sie gelöscht. Ohne Deklaration kennt die SPS keine Variable.',
  brief:'Lege in der <b>Tabelle</b> an: Input <code>Tempo</code> : <code>Int</code>, Input <code>Grenze</code> : <code>Int</code>, Output <code>Warnung</code> : <code>Bool</code>.',
  learn:'Die Schnittstelle in der Deklarationstabelle anlegen.',
  take:'Jede lokale Variable hat in der Schnittstelle einen <b>Bereich</b>, einen <b>Namen</b> und einen <b>Datentyp</b>. Erst dann darf das Netzwerk sie benutzen.',
  man:'bausteine', must:['VAR_INPUT','VAR_OUTPUT','INT'],
  hint:'Knopf „Tabelle“ → Zeile hinzufügen.',
  blocks:[
    { name:'FC_Tempo', kind:'FC', edit:true, start: kFC('FC_Tempo', 'Void', {}, 'NETWORK Zu schnell\n[#Tempo > #Grenze] => #Warnung;'), ref: kFC('FC_Tempo', 'Void', { in:'Tempo:Int|km/h; Grenze:Int|zulässig', out:'Warnung:Bool' }, 'NETWORK Zu schnell\n[#Tempo > #Grenze] => #Warnung;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Geschwindigkeit\n=> "FC_Tempo"(Tempo := "Tempo", Grenze := 40, Warnung => "Warnung");') }
  ],
  globals:{ Tempo:0, Warnung:false },
  unit:[{ block:'FC_Tempo', steps:[[{ Tempo:30, Grenze:40 }, { Warnung:false }], [{ Tempo:41, Grenze:40 }, { Warnung:true }], [{ Tempo:60, Grenze:80 }, { Warnung:false }]] }],
  tests:[[{ Tempo:50 }, { Warnung:true }], [{ Tempo:40 }, { Warnung:false }]],
  bind:['trainSpeed=Tempo', 'lightYellow=Warnung'] });

defFupPro({ id:'fp11_aufruf', ch:11, title:'Die Aufruf-Box',
  story:'<code>FC_Signal</code> ist fertig — aber niemand ruft sie auf. Der zyklische Organisationsbaustein <code>Main</code> ist leer.',
  brief:'Zeichne in <code>Main</code> ein Netzwerk <b>ohne Bedingung</b> („immer“) mit der Aufruf-Box <code>"FC_Signal"</code>: Taste := <code>"Taste_A"</code>, Gleis_frei := <code>"Gleis1_frei"</code>, Weiche_Endlage := <code>"W1_Endlage"</code>, Fahrt => <code>"Signal_A"</code>.<br>Ausgang antippen → <b>Aufruf</b>, Baustein wählen, Parameter in den Feldern belegen.',
  learn:'Eine FC im OB1 aufrufen und ihre Parameter verschalten.',
  take:'Die <b>Aufruf-Box</b> verbindet die Schnittstelle mit echten Signalen: <code>Eingang := Signal</code>, <code>Ausgang => Signal</code>. Globale Variablen stehen in Anführungszeichen.',
  man:'bausteine', must:['CALL','FC_CALL'],
  hint:'+ Netzwerk → Eingang antippen → „immer“ → Ausgang antippen → „Aufruf“.',
  blocks:[
    { name:'FC_Signal', kind:'FC', src: SIG_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_A) }
  ],
  globals: G_A,
  tests:[[{ Taste_A:true, Gleis1_frei:true, W1_Endlage:true }, { Signal_A:true }], [{ Taste_A:true, W1_Endlage:true }, { Signal_A:false }]],
  bind:['signalEntry=Signal_A'] });

defFupPro({ id:'fp11_zwei', ch:11, title:'Ein Baustein, zwei Signale',
  story:'Signal A und Signal B funktionieren gleich — nur mit anderen Signalen. Mit einer Funktion gibt es die Logik nur einmal.',
  brief:'Rufe <code>"FC_Signal"</code> in <code>Main</code> zweimal auf:<br><b>NW 1:</b> <code>"Taste_A"</code>, <code>"Gleis1_frei"</code>, <code>"W1_Endlage"</code> → <code>"Signal_A"</code><br><b>NW 2:</b> <code>"Taste_B"</code>, <code>"Ausfahrt_frei"</code>, <code>"W2_Endlage"</code> → <code>"Signal_B"</code>',
  learn:'Dieselbe FC mehrfach mit verschiedenen Parametern aufrufen.',
  take:'Eine FC ist ein Rezept: einmal geschrieben, beliebig oft aufgerufen — jedes Mal mit anderen Zutaten.',
  man:'bausteine', must:['CALL','FC_CALL','NETWORKS'],
  hint:'Zwei Netzwerke mit je einer Aufruf-Box.',
  blocks:[
    { name:'FC_Signal', kind:'FC', src: SIG_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_A + '\n\nNETWORK Signal B\n=> "FC_Signal"(Taste := "Taste_B", Gleis_frei := "Ausfahrt_frei", Weiche_Endlage := "W2_Endlage", Fahrt => "Signal_B");') }
  ],
  globals: Object.assign({ Taste_B:false, Ausfahrt_frei:false, W2_Endlage:false, Signal_B:false }, G_A),
  tests:[[{ Taste_A:true, Gleis1_frei:true, W1_Endlage:true }, { Signal_A:true, Signal_B:false }], [{ Taste_B:true, Ausfahrt_frei:true, W2_Endlage:true }, { Signal_A:false, Signal_B:true }], [{ Taste_B:true, Ausfahrt_frei:true, W1_Endlage:true }, { Signal_B:false }]],
  bind:['signalEntry=Signal_A', 'signalExit=Signal_B'] });

const BUE_FC = kFC('FC_Schranke', 'Void', { in:'Zug_meldet:Bool|Einschaltkontakt; Zug_weg:Bool|Ausschaltkontakt', out:'Senken:Bool' }, 'NETWORK Senken\n#Zug_meldet AND NOT #Zug_weg => #Senken;');
defFupPro({ id:'fp11_aufruf_dbg', ch:11, title:'Vertauschte Kontakte', debug:true,
  story:'Die Schranke senkt sich, wenn der Zug den Übergang <b>verlässt</b>, und bleibt oben, wenn er kommt. Die Funktion ist in Ordnung — ARIA hat im Aufruf zwei Parameter vertauscht.',
  brief:'Korrigiere die Parameter des Aufrufs <code>"FC_Schranke"</code> in <code>Main</code>.',
  learn:'Parameter eines Aufrufs prüfen.',
  take:'Der Compiler prüft nur Typen, nicht die Bedeutung: Zwei Bool-Signale lassen sich problemlos vertauschen. Darum Parameter immer mit dem Kommentar der Schnittstelle vergleichen.',
  man:'bausteine', must:['CALL'],
  hint:'Welches Signal gehört zu Zug_meldet?',
  blocks:[
    { name:'FC_Schranke', kind:'FC', src: BUE_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN('NETWORK Bahnuebergang\n=> "FC_Schranke"(Zug_meldet := "Ausschaltkontakt", Zug_weg := "Einschaltkontakt", Senken => "Schranke_zu");'),
      ref: MAIN('NETWORK Bahnuebergang\n=> "FC_Schranke"(Zug_meldet := "Einschaltkontakt", Zug_weg := "Ausschaltkontakt", Senken => "Schranke_zu");') }
  ],
  globals:{ Einschaltkontakt:false, Ausschaltkontakt:false, Schranke_zu:false },
  tests:[[{ Einschaltkontakt:true }, { Schranke_zu:true }], [{ Ausschaltkontakt:true }, { Schranke_zu:false }]],
  bind:['crossingClosed=Schranke_zu', 'trainApproach=Einschaltkontakt'] });

defFupPro({ id:'fp11_retval', ch:11, title:'Der Rückgabewert',
  story:'Aus der Achszahl soll die Zuglänge werden: pro Achse 7 Meter. Eine Funktion, die genau einen Wert liefert, gibt ihn als <b>Rückgabewert</b> <code>Ret_Val</code> zurück.',
  brief:'<code>FC_Laenge</code> (Rückgabetyp <code>Int</code>, Input <code>Achsen</code>): ohne Bedingung <b>MUL</b> <code>#Achsen</code> · 7 → <code>#Ret_Val</code>.',
  learn:'Den Rückgabewert einer FC setzen.',
  take:'Der Rückgabewert (<code>Ret_Val</code>) ist der Hauptausgang einer FC. In der Aufruf-Box erscheint er als <code>Ret_Val =></code> und muss in jedem Aufruf geschrieben werden.',
  man:'fc', must:['RETVAL','MUL'],
  hint:'„immer“ → Rechnen → MUL.',
  blocks:[
    { name:'FC_Laenge', kind:'FC', edit:true, start: kFC('FC_Laenge', 'Int', { in:'Achsen:Int' }, ''), ref: kFC('FC_Laenge', 'Int', { in:'Achsen:Int' }, 'NETWORK Laenge\n=> MUL(#Achsen, 7, #Ret_Val);') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Zuglaenge\n=> "FC_Laenge"(Achsen := "Achsen", Ret_Val => "Laenge_m");') }
  ],
  globals:{ Achsen:0, Laenge_m:0 },
  unit:[{ block:'FC_Laenge', steps:[[{ Achsen:8 }, { RET:56 }], [{ Achsen:0 }, { RET:0 }]] }],
  tests:[[{ Achsen:12 }, { Laenge_m:84 }]],
  bind:['axleCount=Achsen', 'displayValue=Laenge_m', 'displayLabel:"ZUGLÄNGE m"'] });

const LAGE_D = { in:'W_links:Bool; W_rechts:Bool', out:'Lage_OK:Bool; Warnung:Bool', temp:'OK:Bool|Zwischenergebnis' };
const LAGE_NW = 'NETWORK Lage pruefen\n#W_links XOR #W_rechts => #OK;\n\nNETWORK Lage gut\n#OK => #Lage_OK;\n\nNETWORK Lage schlecht\nNOT #OK => #Warnung;';
defFupPro({ id:'fp11_temp', ch:11, title:'Zwischenergebnisse',
  story:'Das Ergebnis der Lageprüfung wird zweimal gebraucht. Statt die X-Box zweimal zu zeichnen, merkt man es sich in einer <b>Temp</b>-Variable.',
  brief:'Lege in der Tabelle die Temp-Variable <code>OK</code> : <code>Bool</code> an. Dann:<br><b>NW 1:</b> <code>#W_links</code> XOR <code>#W_rechts</code> → <code>#OK</code><br><b>NW 2:</b> <code>#OK</code> → <code>#Lage_OK</code><br><b>NW 3:</b> nicht <code>#OK</code> → <code>#Warnung</code>',
  learn:'Temp-Variablen für Zwischenergebnisse.',
  take:'<b>Temp</b>-Variablen gelten nur während des Aufrufs: zuerst schreiben, dann lesen.',
  man:'fc', must:['TEMP','XOR'],
  hint:'Tabelle → Bereich Temp.',
  blocks:[
    { name:'FC_Lage', kind:'FC', edit:true, start: kFC('FC_Lage', 'Void', { in:'W_links:Bool; W_rechts:Bool', out:'Lage_OK:Bool; Warnung:Bool' }, ''), ref: kFC('FC_Lage', 'Void', LAGE_D, LAGE_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 1\n=> "FC_Lage"(W_links := "W1_links", W_rechts := "W1_rechts", Lage_OK => "W1_OK", Warnung => "Melder_Gelb");') }
  ],
  globals:{ W1_links:false, W1_rechts:false, W1_OK:false, Melder_Gelb:false },
  unit:[{ block:'FC_Lage', steps: truth(['W_links','W_rechts'], e => ({ Lage_OK: e.W_links !== e.W_rechts, Warnung: e.W_links === e.W_rechts })) }],
  tests:[[{ W1_links:true }, { W1_OK:true, Melder_Gelb:false }]],
  bind:['switch1Right=W1_rechts', 'lightYellow=Melder_Gelb'] });

defFupPro({ id:'fp11_temp_dbg', ch:11, title:'Gelesen, bevor geschrieben', debug:true, warnFree:['TEMP_READ_BEFORE_WRITE'],
  story:'Die Lagewarnung reagiert falsch, und der Compiler warnt: „Temp-Variable wird gelesen, bevor sie geschrieben wurde.“ ARIA hat nur die Reihenfolge der Netzwerke geändert.',
  brief:'Bringe die Netzwerke in <code>FC_Lage</code> in die richtige Reihenfolge.',
  learn:'Temp-Variablen: erst schreiben, dann lesen.',
  take:'Eine Temp-Variable hat zu Beginn jedes Aufrufs keinen verlässlichen Wert — wer sie vorher liest, arbeitet mit Zufall.',
  man:'fc', must:['TEMP'],
  hint:'Netzwerk (Kopfzeile) antippen → ↑ Netzwerk.',
  blocks:[
    { name:'FC_Lage', kind:'FC', edit:true, start: kFC('FC_Lage', 'Void', LAGE_D, 'NETWORK Lage gut\n#OK => #Lage_OK;\n\nNETWORK Lage pruefen\n#W_links XOR #W_rechts => #OK;\n\nNETWORK Lage schlecht\nNOT #OK => #Warnung;'), ref: kFC('FC_Lage', 'Void', LAGE_D, LAGE_NW) },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Weiche 1\n=> "FC_Lage"(W_links := "W1_links", W_rechts := "W1_rechts", Lage_OK => "W1_OK", Warnung => "Melder_Gelb");') }
  ],
  globals:{ W1_links:false, W1_rechts:false, W1_OK:false, Melder_Gelb:false },
  unit:[{ block:'FC_Lage', steps:[[{ W_links:true }, { Lage_OK:true }], [{ W_links:true, W_rechts:true }, { Lage_OK:false }], [{ W_links:false, W_rechts:true }, { Lage_OK:true }]] }],
  tests:[[{ W1_links:true }, { W1_OK:true }]],
  bind:['switch1Right=W1_rechts', 'lightYellow=Melder_Gelb'] });

const MELD_D = { in:'Stoerung:Bool; Signal:Bool', out:'Rot:Bool; Gruen:Bool' };
defFupPro({ id:'fp11_speicher_dbg', ch:11, title:'Die vergessliche Funktion', debug:true, warnFree:['OUT_NOT_ALL_PATHS'],
  story:'ARIA hat in <code>FC_Melder</code> Speicherboxen eingebaut, obwohl eine FC kein Gedächtnis hat. Der Compiler warnt: „Ausgang wird nicht in jedem Aufruf geschrieben.“',
  brief:'Baue <code>FC_Melder</code> mit <b>Zuweisungen</b> um:<br><code>#Rot</code> = <code>#Stoerung</code> oder nicht <code>#Signal</code><br><code>#Gruen</code> = <code>#Signal</code> und nicht <code>#Stoerung</code>',
  learn:'In einer FC jeden Ausgang in jedem Aufruf schreiben.',
  take:'S-, R-, SR- und RS-Boxen schreiben nicht in jedem Aufruf. In einer FC bleibt ein Ausgang dann unbestimmt. Speichern kann nur ein FB.',
  man:'fc', must:['COIL'],
  hint:'Ausgänge antippen → „=“.',
  blocks:[
    { name:'FC_Melder', kind:'FC', edit:true,
      start: kFC('FC_Melder', 'Void', MELD_D, 'NETWORK Rot\n#Stoerung => SR(#Rot, #Signal);\n\nNETWORK Gruen\n#Signal AND NOT #Stoerung => S #Gruen;'),
      ref: kFC('FC_Melder', 'Void', MELD_D, 'NETWORK Rot\n#Stoerung OR NOT #Signal => #Rot;\n\nNETWORK Gruen\n#Signal AND NOT #Stoerung => #Gruen;') },
    { name:'Main', kind:'OB', src: MAIN('NETWORK Melder\n=> "FC_Melder"(Stoerung := "Stoerung", Signal := "Signal_A", Rot => "Melder_Rot", Gruen => "Melder_Gruen");') }
  ],
  globals:{ Stoerung:false, Signal_A:false, Melder_Rot:false, Melder_Gruen:false },
  unit:[{ block:'FC_Melder', steps:[[{ Signal:true }, { Rot:false, Gruen:true }], [{ Signal:true, Stoerung:true }, { Rot:true, Gruen:false }], [{}, { Rot:true, Gruen:false }]] }],
  tests:[[{ Signal_A:true }, { Melder_Gruen:true, Melder_Rot:false }]],
  bind:['lightRed=Melder_Rot', 'lightGreen=Melder_Gruen', 'signalEntry=Signal_A'] });

const ST_D = { in:'Taste_A:Bool; Gleis1_frei:Bool; W1_links:Bool; W1_rechts:Bool; Zug_meldet:Bool', out:'Signal_A:Bool; Schranke_zu:Bool; Lagefehler:Bool' };
const ST_NW = 'NETWORK Signal A\n#Taste_A AND #Gleis1_frei AND (#W1_links XOR #W1_rechts) AND #Schranke_zu => #Signal_A;\n\nNETWORK Lagefehler\n#W1_links XOR #W1_rechts => NOT #Lagefehler;';
const ST_NW_FULL = 'NETWORK Schranke\n#Zug_meldet OR #Taste_A => #Schranke_zu;\n\n' + ST_NW;
defFupPro({ id:'fp11_boss', ch:11, title:'Boss: Die Stellwerksfunktion', boss:true,
  story:'ARIA hat den ganzen OB des alten Stellwerks verknotet. Frau Gasser: „Eine Funktion für die Einfahrt, ein sauberer Aufruf in Main.“',
  brief:'<b>FC_Einfahrt</b> (Schnittstelle steht):<br><b>NW 1:</b> <code>#Zug_meldet</code> oder <code>#Taste_A</code> → <code>#Schranke_zu</code><br><b>NW 2:</b> <code>#Taste_A</code>, <code>#Gleis1_frei</code>, (<code>#W1_links</code> XOR <code>#W1_rechts</code>) und <code>#Schranke_zu</code> → <code>#Signal_A</code><br><b>NW 3:</b> <code>#W1_links</code> XOR <code>#W1_rechts</code> → negiert <code>#Lagefehler</code><br><b>Main:</b> Aufruf mit den PLC-Variablen gleichen Namens.',
  learn:'Eine FC mit mehreren Ein- und Ausgängen schreiben und aufrufen.',
  take:'Programmstruktur: Der OB ruft auf, der Baustein rechnet. Die Schnittstelle ist der Vertrag zwischen beiden.',
  man:'bausteine', must:['CALL','FC_CALL','XOR','NCOIL'],
  hint:'Erst FC_Einfahrt, dann Main.',
  blocks:[
    { name:'FC_Einfahrt', kind:'FC', edit:true, start: kFC('FC_Einfahrt', 'Void', ST_D, ''), ref: kFC('FC_Einfahrt', 'Void', ST_D, ST_NW_FULL) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Einfahrt\n=> "FC_Einfahrt"(Taste_A := "Taste_A", Gleis1_frei := "Gleis1_frei", W1_links := "W1_links", W1_rechts := "W1_rechts", Zug_meldet := "Zug_meldet", Signal_A => "Signal_A", Schranke_zu => "Schranke_zu", Lagefehler => "Lagefehler");') }
  ],
  globals:{ Taste_A:false, Gleis1_frei:false, W1_links:false, W1_rechts:false, Zug_meldet:false, Signal_A:false, Schranke_zu:false, Lagefehler:false },
  unit:[{ block:'FC_Einfahrt', steps:[[{ Taste_A:true, Gleis1_frei:true, W1_links:true }, { Signal_A:true, Schranke_zu:true, Lagefehler:false }], [{ Taste_A:true, Gleis1_frei:true, W1_links:true, W1_rechts:true }, { Signal_A:false, Lagefehler:true }], [{ Zug_meldet:true }, { Schranke_zu:true, Signal_A:false, Lagefehler:true }]] }],
  tests:[[{ Taste_A:true, Gleis1_frei:true, W1_rechts:true }, { Signal_A:true, Schranke_zu:true, Lagefehler:false }], [{ Zug_meldet:true, W1_links:true }, { Schranke_zu:true, Signal_A:false }]],
  bind:['signalEntry=Signal_A', 'crossingClosed=Schranke_zu', 'switch1Right=W1_rechts', 'lightYellow=Lagefehler'] });
})();
