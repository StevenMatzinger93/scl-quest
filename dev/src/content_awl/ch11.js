/* ===== AWL QUEST · KAPITEL 11 — Bausteine: FC, Schnittstelle, CALL (Profi-Stufe) ===== */
(function(){
const MAIN = body => aOB('Main', body);
const FREI_D = { in:'S_Walzen:Bool|Taster Walzen; Gitter_zu:Bool|Schutzgitter; Oel_OK:Bool|Hydrauliköl', out:'Frei:Bool|Gerüst darf laufen' };
const FREI_BODY = 'U  #S_Walzen\nU  #Gitter_zu\nU  #Oel_OK\n=  #Frei';
const FREI_FC = aFC('FC_Freigabe', 'Void', FREI_D, FREI_BODY);
const CALL_1 = 'CALL "FC_Freigabe"\n   S_Walzen := "S_Walzen_1"\n   Gitter_zu := "Gitter_1"\n   Oel_OK := "Oel_OK"\n   Frei => "Walzen_1"';
const G_1 = { S_Walzen_1:false, Gitter_1:false, Oel_OK:false, Walzen_1:false };

defAwlPro({ id:'ap11_erste_fc', ch:11, title:'Die erste Funktion',
  story:'Herr Brunner öffnet den OB1 der S7-300: dreitausend Zeilen, kein einziger Baustein, und irgendwo darin ARIA. Du fängst neu an mit einer <b>Funktion (FC)</b> für die Freigabe eines Walzgerüsts, deren Schnittstelle steht und deren Rumpf leer ist.',
  brief:'In <code>FC_Freigabe</code>: <code>#Frei</code> ist 1, wenn Taster Walzen, Schutzgitter zu und Hydrauliköl OK alle 1 sind. Lokale Variablen beginnen mit <code>#</code>; <code>Main</code> (🔒) ruft die FC auf.',
  learn:'Einen Baustein mit Schnittstelle programmieren: lokale Variablen mit #.',
  take:'Eine FC arbeitet nur mit ihrer <b>Schnittstelle</b>: Eingänge kommen herein, Ausgänge gehen hinaus. Im Baustein heissen sie <code>#Name</code>; der Aufruf verbindet sie mit echten Signalen.',
  man:'bausteine', must:['U', 'ASSIGN'],
  hint:'Wie in der Grundstufe — nur mit # vor den Namen: U #S_Walzen …',
  blocks:[
    { name:'FC_Freigabe', kind:'FC', edit:true, start: aFC('FC_Freigabe', 'Void', FREI_D, ''), ref: FREI_FC },
    { name:'Main', kind:'OB', src: MAIN(CALL_1) }
  ],
  globals: G_1,
  unit:[{ block:'FC_Freigabe', steps: truth(['S_Walzen', 'Gitter_zu', 'Oel_OK'], e => ({ Frei: e.S_Walzen && e.Gitter_zu && e.Oel_OK })) }],
  tests:[[{ S_Walzen_1:true, Gitter_1:true, Oel_OK:true }, { Walzen_1:true }], [{ S_Walzen_1:true, Gitter_1:true }, { Walzen_1:false }]],
  bind:['rollsRunning=Walzen_1'] });

defAwlPro({ id:'ap11_schnittstelle', ch:11, title:'Die Schnittstelle',
  story:'<code>FC_Temp_OK</code> hat einen fertigen Rumpf, aber keine Schnittstelle — ARIA hat sie gelöscht. Ohne Deklaration kennt die SPS keine Variable.',
  brief:'Lege in der <b>Tabelle</b> die Schnittstelle von <code>FC_Temp_OK</code> an: zwei Int-Eingänge (Temperatur und <code>Grenze</code>), einen Bool-Ausgang <code>OK</code>. Die Namen stehen im Rumpf.',
  learn:'Die Schnittstelle in der Deklarationstabelle anlegen.',
  take:'Jede lokale Variable hat einen <b>Bereich</b> (Input, Output, …), einen <b>Namen</b> und einen <b>Datentyp</b>. Erst dann darf der Rumpf sie benutzen.',
  man:'bausteine', must:['VAR_INPUT', 'VAR_OUTPUT', 'INT'],
  hint:'Knopf „Tabelle“ → Zeile hinzufügen.',
  blocks:[
    { name:'FC_Temp_OK', kind:'FC', edit:true, start: aFC('FC_Temp_OK', 'Void', {}, 'L  #Temp\nL  #Grenze\n>=I\n=  #OK'), ref: aFC('FC_Temp_OK', 'Void', { in:'Temp:Int|°C; Grenze:Int|Mindesttemperatur', out:'OK:Bool' }, 'L  #Temp\nL  #Grenze\n>=I\n=  #OK') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Temp_OK"\n   Temp := "Temp"\n   Grenze := 1100\n   OK => "Temp_OK"') }
  ],
  globals:{ Temp:0, Temp_OK:false },
  unit:[{ block:'FC_Temp_OK', steps:[[{ Temp:1000, Grenze:1100 }, { OK:false }], [{ Temp:1100, Grenze:1100 }, { OK:true }], [{ Temp:1150, Grenze:1200 }, { OK:false }]] }],
  tests:[[{ Temp:1180 }, { Temp_OK:true }], [{ Temp:900 }, { Temp_OK:false }]],
  bind:['furnaceTemp=Temp', 'lightGreen=Temp_OK'] });

defAwlPro({ id:'ap11_aufruf', ch:11, title:'Der Aufruf',
  story:'<code>FC_Freigabe</code> ist fertig — aber niemand ruft sie auf. Der zyklische Organisationsbaustein <code>Main</code> ist leer.',
  brief:'Rufe in <code>Main</code> mit <code>CALL</code> <code>FC_Freigabe</code> für Gerüst 1 auf: Taster, Schutzgitter von Gerüst 1 und Hydrauliköl an die Eingänge, <code>Frei</code> auf den Walzenantrieb von Gerüst 1.',
  learn:'Eine FC mit CALL aufrufen und die Parameter versorgen.',
  take:'<code>CALL</code> ruft einen Baustein auf. Darunter stehen die <b>Parameter</b>: <code>Eingang := Signal</code>, <code>Ausgang => Signal</code>. Globale Variablen stehen in Anführungszeichen.',
  man:'bausteine', must:['CALL', 'FC_CALL'],
  hint:'CALL "FC_Freigabe" und darunter vier Parameterzeilen.',
  blocks:[
    { name:'FC_Freigabe', kind:'FC', src: FREI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN(CALL_1) }
  ],
  globals: G_1,
  tests:[[{ S_Walzen_1:true, Gitter_1:true, Oel_OK:true }, { Walzen_1:true }], [{ S_Walzen_1:true, Oel_OK:true }, { Walzen_1:false }]],
  bind:['rollsRunning=Walzen_1'] });

defAwlPro({ id:'ap11_zwei', ch:11, title:'Ein Baustein, zwei Gerüste',
  story:'Die Walzstrasse hat zwei Gerüste mit derselben Freigabelogik. Mit einer Funktion gibt es die Logik nur einmal — aufgerufen wird sie zweimal.',
  brief:'Rufe <code>FC_Freigabe</code> zweimal auf: für Gerüst 1 (Taster, Gitter, Walzenantrieb von Gerüst 1) und für Gerüst 2 (dasselbe von Gerüst 2). Das Hydrauliköl gilt für beide.',
  learn:'Dieselbe FC mehrfach mit verschiedenen Parametern aufrufen.',
  take:'Eine FC ist wie eine Schablone: Jeder Aufruf versorgt sie mit anderen Signalen. Änderst du die FC, gilt die Änderung für alle Gerüste.',
  man:'bausteine', must:['CALL', 'FC_CALL'],
  hint:'Zwei CALL-Blöcke untereinander, gerne in zwei Netzwerken.',
  blocks:[
    { name:'FC_Freigabe', kind:'FC', src: FREI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('NETWORK Geruest 1\n' + CALL_1 + '\n\nNETWORK Geruest 2\nCALL "FC_Freigabe"\n   S_Walzen := "S_Walzen_2"\n   Gitter_zu := "Gitter_2"\n   Oel_OK := "Oel_OK"\n   Frei => "Walzen_2"') }
  ],
  globals: Object.assign({ S_Walzen_2:false, Gitter_2:false, Walzen_2:false }, G_1),
  tests:[[{ S_Walzen_1:true, Gitter_1:true, Oel_OK:true }, { Walzen_1:true, Walzen_2:false }], [{ S_Walzen_2:true, Gitter_2:true, Oel_OK:true }, { Walzen_1:false, Walzen_2:true }], [{ S_Walzen_2:true, Gitter_2:true }, { Walzen_2:false }]],
  bind:['rollsRunning=Walzen_1', 'conveyorRunning=Walzen_2'] });

defAwlPro({ id:'ap11_aufruf_dbg', ch:11, title:'Das falsche Gerüst', debug:true,
  story:'Gibt man Gerüst 1 frei, läuft Gerüst 2 los! ARIA hat beim Aufruf einen einzigen Parameter umgehängt.',
  brief:'Symptom: Die Freigabe von Gerüst 1 startet Gerüst 2. Soll: Der Ausgang <code>Frei</code> schaltet den Walzenantrieb von Gerüst 1.',
  learn:'Parameterversorgung prüfen.',
  take:'Bei einem Aufruf zählt nur, <b>welches Signal an welchem Parameter</b> hängt. Ein falsch verdrahteter Ausgang übersetzt fehlerfrei — er fällt erst im Betrieb auf.',
  man:'bausteine', must:['CALL'],
  hint:'Die Zeile Frei => … zeigt auf das falsche Gerüst.',
  blocks:[
    { name:'FC_Freigabe', kind:'FC', src: FREI_FC },
    { name:'Main', kind:'OB', edit:true, start: MAIN(CALL_1.replace('Frei => "Walzen_1"', 'Frei => "Walzen_2"')), ref: MAIN(CALL_1) }
  ],
  globals: Object.assign({ Walzen_2:false }, G_1),
  tests:[[{ S_Walzen_1:true, Gitter_1:true, Oel_OK:true }, { Walzen_1:true, Walzen_2:false }]],
  bind:['rollsRunning=Walzen_1', 'conveyorRunning=Walzen_2'] });

const ABN_FC = aFC('FC_Abnahme', 'Int', { in:'Dicke_ein:Int|mm; Dicke_aus:Int|mm' }, 'L  #Dicke_ein\nL  #Dicke_aus\n-I\nT  #Ret_Val');
defAwlPro({ id:'ap11_retval', ch:11, title:'Der Rückgabewert',
  story:'Die Stichabnahme wird an mehreren Stellen gebraucht. Eine Funktion mit <b>Rückgabewert</b> liefert sie direkt: <code>FC_Abnahme</code> gibt eine <code>Int</code> zurück.',
  brief:'In <code>FC_Abnahme</code>: Rückgabewert = Einlaufdicke − Auslaufdicke (<code>-I</code>, <code>T #Ret_Val</code>). <code>Main</code> (🔒) schreibt ihn in die Abnahme.',
  learn:'Rückgabewert einer FC mit T #Ret_Val.',
  take:'Der Rückgabewert heisst im Baustein <code>#Ret_Val</code>. Beim Aufruf steht er als Parameter <code>RET_VAL := Ziel</code>. Er muss in jedem Aufruf geschrieben werden.',
  man:'fc', must:['RETVAL', '-I'],
  hint:'Wie die Stichabnahme in Kapitel 8 — nur das Ziel heisst #Ret_Val.',
  blocks:[
    { name:'FC_Abnahme', kind:'FC', edit:true, start: aFC('FC_Abnahme', 'Int', { in:'Dicke_ein:Int|mm; Dicke_aus:Int|mm' }, ''), ref: ABN_FC },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Abnahme"\n   Dicke_ein := "Dicke_ein"\n   Dicke_aus := "Dicke_aus"\n   RET_VAL := "Abnahme"') }
  ],
  globals:{ Dicke_ein:0, Dicke_aus:0, Abnahme:0 },
  unit:[{ block:'FC_Abnahme', steps:[[{ Dicke_ein:120, Dicke_aus:90 }, { RET:30 }], [{ Dicke_ein:40, Dicke_aus:35 }, { RET:5 }]] }],
  tests:[[{ Dicke_ein:200, Dicke_aus:150 }, { Abnahme:50 }]],
  bind:['rollGap=Dicke_aus', 'displayValue=Abnahme', 'displayLabel:"ABNAHME mm"'] });

const MIT_D = { in:'Temp_1:Int; Temp_2:Int', out:'Mittel:Int; Zu_kalt:Bool', temp:'Summe:Int' };
const MIT_BODY = 'L  #Temp_1\nL  #Temp_2\n+I\nT  #Summe\nL  #Summe\nL  2\n/I\nT  #Mittel\nL  #Summe\nL  2200\n<I\n=  #Zu_kalt';
defAwlPro({ id:'ap11_temp', ch:11, title:'Zwischenergebnisse',
  story:'Die Summe beider Temperaturfühler wird zweimal gebraucht: für den Mittelwert und für die Warnung „zu kalt“ (Summe unter 2200). Zwischenergebnisse gehören in eine <b>Temp</b>-Variable.',
  brief:'<code>FC_Mittel</code> (Temp <code>Summe : Int</code>):<br><code>#Summe</code> = <code>#Temp_1</code> + <code>#Temp_2</code><br><code>#Mittel</code> = <code>#Summe</code> / 2<br><code>#Zu_kalt</code> = <code>#Summe</code> &lt; 2200',
  learn:'Temp-Variablen für Zwischenergebnisse.',
  take:'<b>Temp</b>-Variablen gelten nur während eines Aufrufs. Zuerst schreiben, dann lesen — so rechnet man eine Summe einmal und benutzt sie mehrfach.',
  man:'fc', must:['TEMP', '+I', '/I', 'CMP_I'],
  hint:'Drei Abschnitte: Summe bilden, Mittelwert, Vergleich.',
  blocks:[
    { name:'FC_Mittel', kind:'FC', edit:true, start: aFC('FC_Mittel', 'Void', MIT_D, ''), ref: aFC('FC_Mittel', 'Void', MIT_D, MIT_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Mittel"\n   Temp_1 := "Fuehler_1"\n   Temp_2 := "Fuehler_2"\n   Mittel => "Temp"\n   Zu_kalt => "Lampe_Gelb"') }
  ],
  globals:{ Fuehler_1:0, Fuehler_2:0, Temp:0, Lampe_Gelb:false },
  unit:[{ block:'FC_Mittel', steps:[[{ Temp_1:1180, Temp_2:1200 }, { Mittel:1190, Zu_kalt:false }], [{ Temp_1:1000, Temp_2:1100 }, { Mittel:1050, Zu_kalt:true }]] }],
  tests:[[{ Fuehler_1:1150, Fuehler_2:1170 }, { Temp:1160, Lampe_Gelb:false }]],
  bind:['furnaceTemp=Temp', 'lightYellow=Lampe_Gelb'] });

defAwlPro({ id:'ap11_temp_dbg', ch:11, title:'Gelesen, bevor geschrieben', debug:true, warnFree:['TEMP_READ_BEFORE_WRITE'],
  story:'Der Mittelwert springt wild hin und her, und der Compiler warnt, dass eine Temp-Variable gelesen wird, bevor sie geschrieben wurde. ARIA hat zwei Abschnitte vertauscht.',
  brief:'Bringe <code>FC_Mittel</code> in Ordnung: Die Summe muss berechnet werden, <b>bevor</b> sie benutzt wird.',
  learn:'Reihenfolge bei Temp-Variablen.',
  take:'Eine Temp-Variable hat zu Beginn jedes Aufrufs keinen verlässlichen Wert. Liest man sie vorher, rechnet man mit Müll — die Warnung <b>TEMP_READ_BEFORE_WRITE</b> zeigt das an.',
  man:'fc', must:['TEMP'],
  hint:'Die ersten vier Zeilen (Summe bilden) gehören ganz nach oben.',
  blocks:[
    { name:'FC_Mittel', kind:'FC', edit:true, start: aFC('FC_Mittel', 'Void', MIT_D, 'L  #Summe\nL  2\n/I\nT  #Mittel\nL  #Temp_1\nL  #Temp_2\n+I\nT  #Summe\nL  #Summe\nL  2200\n<I\n=  #Zu_kalt'), ref: aFC('FC_Mittel', 'Void', MIT_D, MIT_BODY) },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Mittel"\n   Temp_1 := "Fuehler_1"\n   Temp_2 := "Fuehler_2"\n   Mittel => "Temp"\n   Zu_kalt => "Lampe_Gelb"') }
  ],
  globals:{ Fuehler_1:0, Fuehler_2:0, Temp:0, Lampe_Gelb:false },
  unit:[{ block:'FC_Mittel', steps:[[{ Temp_1:1180, Temp_2:1200 }, { Mittel:1190 }], [{ Temp_1:1000, Temp_2:1100 }, { Mittel:1050, Zu_kalt:true }]] }],
  bind:['furnaceTemp=Temp', 'lightYellow=Lampe_Gelb'] });

const MELD_D = { in:'Fehler:Bool; Laeuft:Bool', out:'Rot:Bool; Gruen:Bool' };
defAwlPro({ id:'ap11_speicher_dbg', ch:11, title:'Die vergessliche Funktion', debug:true, warnFree:['OUT_NOT_ALL_PATHS'],
  story:'Die Lampen des Gerüsts bleiben manchmal an, obwohl längst alles gut ist, und der Compiler warnt. ARIA hat in einer <b>FC</b> mit S und R gearbeitet, aber eine FC kann sich nichts merken.',
  brief:'Schreibe <code>FC_Lampen</code> ohne S/R: <code>#Rot</code> = <code>#Fehler</code>, <code>#Gruen</code> = <code>#Laeuft</code> UND NICHT <code>#Fehler</code> — jeweils mit <code>=</code>.',
  learn:'Keine Speicher in einer FC.',
  take:'Eine FC hat kein Gedächtnis. Ausgänge, die nur mit S/R geschrieben werden, sind nach dem Aufruf unbestimmt (Warnung <b>OUT_NOT_ALL_PATHS</b>). In einer FC schreibt man jeden Ausgang mit <code>=</code>; speichern kann nur ein FB.',
  man:'fc', must:['ASSIGN'],
  hint:'Zwei Ketten mit =, kein S und kein R.',
  blocks:[
    { name:'FC_Lampen', kind:'FC', edit:true, start: aFC('FC_Lampen', 'Void', MELD_D, 'U  #Fehler\nS  #Rot\nUN #Fehler\nR  #Rot\nU  #Laeuft\nUN #Fehler\nS  #Gruen'), ref: aFC('FC_Lampen', 'Void', MELD_D, 'U  #Fehler\n=  #Rot\nU  #Laeuft\nUN #Fehler\n=  #Gruen') },
    { name:'Main', kind:'OB', src: MAIN('CALL "FC_Lampen"\n   Fehler := "Stoerung"\n   Laeuft := "Walzen"\n   Rot => "Lampe_Rot"\n   Gruen => "Lampe_Gruen"') }
  ],
  globals:{ Stoerung:false, Walzen:false, Lampe_Rot:false, Lampe_Gruen:false },
  unit:[{ block:'FC_Lampen', steps:[[{ Fehler:true, Laeuft:true }, { Rot:true, Gruen:false }], [{ Fehler:false, Laeuft:true }, { Rot:false, Gruen:true }], [{ Fehler:true, Laeuft:true }, { Rot:true, Gruen:false }], [{ Fehler:false, Laeuft:false }, { Rot:false, Gruen:false }]] }],
  tests:[[{ Stoerung:true }, { Lampe_Rot:true }], [{ Walzen:true }, { Lampe_Gruen:true, Lampe_Rot:false }]],
  bind:['lightRed=Lampe_Rot', 'lightGreen=Lampe_Gruen', 'rollsRunning=Walzen'] });

const GER_D = { in:'S_Walzen:Bool; Gitter_zu:Bool; Temp:Int|Blocktemperatur °C', out:'Walzen:Bool; Lampe_Rot:Bool', temp:'Heiss:Bool' };
const GER_BODY = 'NETWORK Temperatur\nL  #Temp\nL  1100\n>=I\n=  #Heiss\n\nNETWORK Walzen\nU  #S_Walzen\nU  #Gitter_zu\nU  #Heiss\n=  #Walzen\n\nNETWORK Rote Lampe\nON #Gitter_zu\nON #Heiss\n=  #Lampe_Rot';
defAwlPro({ id:'ap11_boss', ch:11, title:'Boss: Die Gerüstfunktion', boss:true,
  story:'ARIA hat die Freigabe beider Gerüste lahmgelegt. Herr Brunner diktiert seine Funktion von vor zwanzig Jahren: „Temperatur prüfen, dann freigeben, und die rote Lampe, wenn das Gitter offen oder der Block zu kalt ist.“',
  brief:'In <code>FC_Geruest</code>: <code>#Heiss</code> (Temp) = Blocktemperatur ≥ 1100. Walzen bei Taster, Gitter zu und heiss; rote Lampe bei offenem Gitter oder zu kaltem Block. <code>Main</code> ruft die FC mit den gleichnamigen PLC-Variablen auf.',
  learn:'Eine FC mit Temp, Vergleich und mehreren Ausgängen schreiben und aufrufen.',
  take:'Eine gute FC löst genau eine Aufgabe und hat eine klare Schnittstelle. Zwischenergebnisse (hier <code>#Heiss</code>) liegen in Temp.',
  man:'fc', must:['TEMP', 'CMP_I', 'CALL', 'FC_CALL'],
  hint:'Zuerst FC_Geruest (drei Netzwerke), dann der Aufruf in Main.',
  blocks:[
    { name:'FC_Geruest', kind:'FC', edit:true, start: aFC('FC_Geruest', 'Void', GER_D, ''), ref: aFC('FC_Geruest', 'Void', GER_D, GER_BODY) },
    { name:'Main', kind:'OB', edit:true, start: MAIN(''), ref: MAIN('CALL "FC_Geruest"\n   S_Walzen := "S_Walzen"\n   Gitter_zu := "Gitter_zu"\n   Temp := "Temp"\n   Walzen => "Walzen"\n   Lampe_Rot => "Lampe_Rot"') }
  ],
  globals:{ S_Walzen:false, Gitter_zu:false, Temp:0, Walzen:false, Lampe_Rot:false },
  unit:[{ block:'FC_Geruest', steps:[[{ S_Walzen:true, Gitter_zu:true, Temp:1150 }, { Walzen:true, Lampe_Rot:false }], [{ S_Walzen:true, Gitter_zu:true, Temp:1050 }, { Walzen:false, Lampe_Rot:true }], [{ S_Walzen:true, Gitter_zu:false, Temp:1150 }, { Walzen:false, Lampe_Rot:true }]] }],
  tests:[[{ S_Walzen:true, Gitter_zu:true, Temp:1180 }, { Walzen:true, Lampe_Rot:false }], [{ S_Walzen:true, Gitter_zu:true, Temp:900 }, { Walzen:false, Lampe_Rot:true }]],
  bind:['rollsRunning=Walzen', 'lightRed=Lampe_Rot', 'furnaceTemp=Temp'] });
})();
