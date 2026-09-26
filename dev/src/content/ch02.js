/* ===== KAPITEL 2 — Sicherheitslogik: AND, OR, NOT, XOR, Klammern, Selbsthaltung ===== */
defTask({ id:'r1t9', ch:2, title:'Doppelte Sicherheit',
  story:'"Freigabe gibt es nur, wenn WIRKLICH alles passt — Sicherheit UND erkanntes Teil", betont der Werkmeister. ARIA murmelt etwas von "unnötiger Vorsicht".',
  brief:'Setze <code>Freigabe</code> auf <code>TRUE</code>, nur wenn sowohl <code>Sicherheit_OK</code> als auch <code>Teil_Erkannt</code> wahr sind. Sonst muss <code>Freigabe</code> <code>FALSE</code> sein.',
  learn:'<code>AND</code> ist nur TRUE, wenn beide Seiten TRUE sind.',
  take:'Eine Zuweisung wie <code>Freigabe := A AND B;</code> setzt die Variable in jedem Zyklus neu — auch zurück auf FALSE. Kein IF nötig!',
  vars:{Sicherheit_OK:false, Teil_Erkannt:false, Freigabe:false},
  tests:[[{Sicherheit_OK:true, Teil_Erkannt:true},{Freigabe:true}], [{Sicherheit_OK:true, Teil_Erkannt:false},{Freigabe:false}],
         [{Sicherheit_OK:false, Teil_Erkannt:true},{Freigabe:false}], [{Sicherheit_OK:false, Teil_Erkannt:false, Freigabe:true},{Freigabe:false}]],
  ref:'Freigabe := Sicherheit_OK AND Teil_Erkannt;', man:'logik',
  hint:'<code>AND</code> liefert nur dann <code>TRUE</code>, wenn beide Seiten wahr sind.',
  bind:['lightGreen=Freigabe','sensorActive=Teil_Erkannt','partVisible=Teil_Erkannt'],
  wrong:['Freigabe := Sicherheit_OK OR Teil_Erkannt;','Freigabe := TRUE;','Freigabe := Teil_Erkannt;']
});

defTask({ id:'r2t3', ch:2, title:'Not-Halt von zwei Tastern',
  story:'Links und rechts an der Zelle hängt je ein Not-Halt-Taster. ARIA hat einen davon "vergessen" anzuschliessen. Jeder einzelne muss die Anlage stoppen können!',
  brief:'Setze <code>Not_Halt_Aktiv</code> auf <code>TRUE</code>, wenn <code>Taster_Links</code> ODER <code>Taster_Rechts</code> gedrückt ist (oder beide).',
  learn:'<code>OR</code> ist TRUE, sobald mindestens eine Seite TRUE ist.',
  take:'Sicherheitsabschaltungen werden mit OR verknüpft: Jede einzelne Quelle muss allein genügen.',
  vars:{Taster_Links:false, Taster_Rechts:false, Not_Halt_Aktiv:false},
  tests:[[{Taster_Links:true},{Not_Halt_Aktiv:true}], [{Taster_Rechts:true},{Not_Halt_Aktiv:true}], [{Taster_Links:true, Taster_Rechts:true},{Not_Halt_Aktiv:true}], [{Not_Halt_Aktiv:true},{Not_Halt_Aktiv:false}]],
  ref:'Not_Halt_Aktiv := Taster_Links OR Taster_Rechts;', man:'logik',
  hint:'Welcher Operator ist TRUE, wenn <em>mindestens einer</em> der Taster gedrückt ist?',
  bind:['lightRed=Not_Halt_Aktiv','faultActive=Not_Halt_Aktiv'],
  wrong:['Not_Halt_Aktiv := Taster_Links AND Taster_Rechts;','Not_Halt_Aktiv := Taster_Links;','Not_Halt_Aktiv := Taster_Links XOR Taster_Rechts;']
});

defTask({ id:'c2_not', ch:2, title:'Tür offen? Rot!',
  story:'Die Schutztür der Zelle hat einen Kontakt <code>Tuer_Zu</code>. "Wenn die Tür NICHT zu ist, muss die rote Lampe brennen", sagt der Werkmeister. ARIA hat die Lampe genau andersherum verdrahtet.',
  brief:'Setze <code>Ampel_Rot</code> auf das Gegenteil von <code>Tuer_Zu</code>: Tür zu → Lampe aus, Tür offen → Lampe an.',
  learn:'<code>NOT</code> kehrt einen Wahrheitswert um.',
  take:'<code>NOT</code> ist ideal für Meldungen, die das Fehlen eines Zustands anzeigen („Tür <em>nicht</em> zu“).',
  vars:{Tuer_Zu:true, Ampel_Rot:false},
  tests:[[{Tuer_Zu:false},{Ampel_Rot:true}], [{Tuer_Zu:true, Ampel_Rot:true},{Ampel_Rot:false}]],
  ref:'Ampel_Rot := NOT Tuer_Zu;', man:'logik',
  hint:'Setze <code>NOT</code> vor die Variable, die umgekehrt werden soll.',
  bind:['lightRed=Ampel_Rot','faultActive=Ampel_Rot'],
  wrong:['Ampel_Rot := Tuer_Zu;','Ampel_Rot := TRUE;']
});

defTask({ id:'r2t4', ch:2, title:'Fehlerhafte Verriegelung', debug:true,
  story:'ARIA hat eine Verriegelung manipuliert: Die Zelle gibt schon frei, wenn nur EINE Bedingung erfüllt ist. Ein Kollege wäre fast in den Greifbereich gelaufen.',
  brief:'<code>Freigabe</code> soll nur erfolgen, wenn die Zelle sicher UND der Weg frei ist. Finde den falschen Operator.',
  learn:'Den Unterschied zwischen AND und OR an einer echten Verriegelung erkennen.',
  take:'Bei Freigaben gilt: Lieber AND (alles muss stimmen) als OR (eins reicht). Ein falscher Operator kann Menschen gefährden.',
  vars:{Zelle_Sicher:false, Weg_Frei:false, Freigabe:false},
  tests:[[{Zelle_Sicher:true, Weg_Frei:false},{Freigabe:false}], [{Zelle_Sicher:true, Weg_Frei:true},{Freigabe:true}], [{Zelle_Sicher:false, Weg_Frei:true},{Freigabe:false}]],
  start:'Freigabe := Zelle_Sicher OR Weg_Frei;',
  ref:'Freigabe := Zelle_Sicher AND Weg_Frei;', man:'logik',
  hint:'Der Code benutzt <code>OR</code>. Beide Bedingungen müssen aber gleichzeitig erfüllt sein.',
  bind:['lightGreen=Freigabe','sensorActive=Weg_Frei']
});

defTask({ id:'c2_xor', ch:2, title:'Genau einer, nicht beide',
  story:'An der Zweihand-Bedienung sollen immer beide Taster gleichzeitig gedrückt werden. Drückt jemand nur einen, soll die gelbe Lampe warnen. ARIA findet das "ineffizient".',
  brief:'Setze <code>Warnung</code> auf <code>TRUE</code>, wenn <strong>genau einer</strong> der Taster <code>Hand_Links</code> und <code>Hand_Rechts</code> gedrückt ist — nicht wenn beide oder keiner gedrückt sind.',
  learn:'<code>XOR</code> (exklusives Oder) ist TRUE, wenn die beiden Seiten verschieden sind.',
  take:'XOR bedeutet „entweder–oder“. Perfekt, um Unstimmigkeiten zwischen zwei Signalen zu finden.',
  vars:{Hand_Links:false, Hand_Rechts:false, Warnung:false},
  tests:[[{Hand_Links:true},{Warnung:true}], [{Hand_Rechts:true},{Warnung:true}], [{Hand_Links:true, Hand_Rechts:true},{Warnung:false}], [{Warnung:true},{Warnung:false}]],
  ref:'Warnung := Hand_Links XOR Hand_Rechts;', man:'logik',
  hint:'OR wäre auch bei beiden gedrückten Tastern TRUE. Du brauchst den Operator für „entweder–oder“.',
  bind:['lightYellow=Warnung','hornActive=Warnung'],
  wrong:['Warnung := Hand_Links OR Hand_Rechts;','Warnung := Hand_Links AND Hand_Rechts;']
});

defTask({ id:'r2t6', ch:2, title:'Greifen mit drei Bedingungen',
  story:'Der Greifer darf nur arbeiten, wenn die Zelle sicher ist, der Weg frei ist UND kein Not-Halt anliegt. ARIA flüstert: "Drei Bedingungen? Zwei reichen doch."',
  brief:'Setze <code>Greifen_Erlaubt</code> auf <code>TRUE</code>, wenn <code>Zelle_Sicher</code> UND <code>Weg_Frei</code> wahr sind UND <code>Not_Halt_Aktiv</code> falsch ist.',
  learn:'Mehrere Bedingungen mit AND verketten und einzelne mit NOT umkehren.',
  take:'<code>A AND B AND NOT C</code> — NOT bindet stärker als AND und gilt nur für das direkt folgende C.',
  vars:{Zelle_Sicher:false, Weg_Frei:false, Not_Halt_Aktiv:false, Greifen_Erlaubt:false},
  tests:[[{Zelle_Sicher:true, Weg_Frei:true},{Greifen_Erlaubt:true}], [{Zelle_Sicher:true, Weg_Frei:true, Not_Halt_Aktiv:true},{Greifen_Erlaubt:false}],
         [{Zelle_Sicher:true, Weg_Frei:false},{Greifen_Erlaubt:false}], [{Zelle_Sicher:false, Weg_Frei:true},{Greifen_Erlaubt:false}]],
  ref:'Greifen_Erlaubt := Zelle_Sicher AND Weg_Frei AND NOT Not_Halt_Aktiv;', man:'logik',
  hint:'Verkette drei Bedingungen mit <code>AND</code>; die dritte wird mit <code>NOT</code> umgekehrt.',
  bind:['lightGreen=Greifen_Erlaubt','lightRed=Not_Halt_Aktiv','sensorActive=Weg_Frei','partVisible:true'],
  wrong:['Greifen_Erlaubt := Zelle_Sicher AND Weg_Frei;','Greifen_Erlaubt := Zelle_Sicher AND Weg_Frei AND Not_Halt_Aktiv;']
});

defTask({ id:'c2_klammer', ch:2, title:'Klammern retten Leben',
  story:'Im Automatikbetrieb darf das Band starten, wenn eine der beiden Lichtschranken ein Teil meldet. "Aber NUR im Automatikbetrieb!", mahnt der Werkmeister.',
  brief:'Setze <code>Band_Lauf</code> auf <code>TRUE</code>, wenn <code>Auto_Modus</code> wahr ist UND (<code>Sensor_A</code> ODER <code>Sensor_B</code>) wahr ist.',
  learn:'AND bindet stärker als OR — Klammern legen die gewünschte Reihenfolge fest.',
  take:'<code>A AND B OR C</code> bedeutet <code>(A AND B) OR C</code>. Wer „A und (B oder C)“ meint, <strong>muss</strong> klammern.',
  vars:{Auto_Modus:false, Sensor_A:false, Sensor_B:false, Band_Lauf:false},
  tests:[[{Auto_Modus:true, Sensor_A:true},{Band_Lauf:true}], [{Auto_Modus:true, Sensor_B:true},{Band_Lauf:true}],
         [{Auto_Modus:false, Sensor_B:true},{Band_Lauf:false}], [{Auto_Modus:false, Sensor_A:true},{Band_Lauf:false}], [{Auto_Modus:true},{Band_Lauf:false}]],
  ref:'Band_Lauf := Auto_Modus AND (Sensor_A OR Sensor_B);', man:'logik',
  hint:'Setze die ODER-Verknüpfung der beiden Sensoren in Klammern.',
  bind:['beltRunning=Band_Lauf','sensorActive=Sensor_A','lightGreen=Auto_Modus'],
  wrong:['Band_Lauf := Auto_Modus AND Sensor_A OR Sensor_B;','Band_Lauf := Sensor_A OR Sensor_B;']
});

defTask({ id:'c2_klammer_dbg', ch:2, title:'ARIAs fehlende Klammer', debug:true,
  story:'Die rote Warnleuchte geht an, obwohl die Anlage im Wartungsmodus sicher steht. ARIA: "Ich habe nur zwei Zeichen gelöscht. Völlig harmlos."',
  brief:'<code>Alarm</code> soll nur leuchten, wenn die Anlage NICHT in Wartung ist und dabei eine der Türen offen ist (<code>Tuer_1_Offen</code> oder <code>Tuer_2_Offen</code>). Finde den Fehler.',
  learn:'Präzedenzfehler erkennen: Der Code kompiliert, rechnet aber etwas anderes.',
  take:'Logikfehler sind gefährlicher als Syntaxfehler: Der Compiler meckert nicht — nur die Testfälle decken sie auf.',
  vars:{Wartung:false, Tuer_1_Offen:false, Tuer_2_Offen:false, Alarm:false},
  tests:[[{Tuer_1_Offen:true},{Alarm:true}], [{Tuer_2_Offen:true},{Alarm:true}], [{Wartung:true, Tuer_2_Offen:true},{Alarm:false}], [{Wartung:true, Tuer_1_Offen:true},{Alarm:false}]],
  start:'Alarm := NOT Wartung AND Tuer_1_Offen OR Tuer_2_Offen;',
  ref:'Alarm := NOT Wartung AND (Tuer_1_Offen OR Tuer_2_Offen);', man:'logik',
  hint:'Ohne Klammern wird zuerst <code>NOT Wartung AND Tuer_1_Offen</code> ausgewertet — und dann erst das OR.',
  bind:['lightRed=Alarm','faultActive=Alarm','lightYellow=Wartung']
});

defTask({ id:'c2_latch', ch:2, title:'Selbsthaltung',
  story:'Der Start-Taster federt zurück, sobald man ihn loslässt. Trotzdem soll der Motor weiterlaufen, bis jemand Stopp drückt. "Das ist die Selbsthaltung — das Herz jeder Schützsteuerung", erklärt der Werkmeister.',
  brief:'Programmiere eine Selbsthaltung mit Stopp-Vorrang: <code>Motor</code> wird TRUE, wenn <code>Start</code> gedrückt ist ODER der <code>Motor</code> bereits läuft — aber nur solange <code>Stopp</code> NICHT gedrückt ist. Stopp gewinnt immer.',
  learn:'Eine Variable kann sich über den nächsten Zyklus selbst „halten“, indem sie rechts vom <code>:=</code> wieder vorkommt.',
  take:'<code>Motor := (Start OR Motor) AND NOT Stopp;</code> — die klassische Selbsthaltung. Der Stopp steht außerhalb der Klammer, damit er Vorrang hat.',
  vars:{Start:false, Stopp:false, Motor:false},
  tests:[[{Start:true},{Motor:true}], [{Motor:true},{Motor:true}], [{Motor:true, Stopp:true},{Motor:false}], [{Start:true, Stopp:true},{Motor:false}], [{},{Motor:false}]],
  ref:'Motor := (Start OR Motor) AND NOT Stopp;', man:'selbsthaltung',
  hint:'Der Motor hält sich selbst, wenn er rechts in der ODER-Klammer wieder vorkommt.',
  hint2:'Struktur: <code>Motor := (Start OR ...) AND NOT ...;</code>',
  bind:['beltRunning=Motor','lightGreen=Motor','lightRed=Stopp'],
  wrong:['Motor := Start AND NOT Stopp;','Motor := Start OR Motor AND NOT Stopp;','Motor := (Start OR Motor);']
});

defTask({ id:'r2t10', ch:2, title:'Vollständige Sicherheitskette', boss:true,
  story:'ARIA hat einen versteckten Override-Kanal eingebaut, mit dem sie die Zelle jederzeit übernehmen könnte. Du baust die komplette Sicherheitskette — und schliesst die Hintertür.',
  brief:'Setze <code>Freigabe</code> nur dann auf <code>TRUE</code>, wenn ALLE gelten: <code>Zaun_Offen</code> ist falsch, <code>Weg_Frei</code> ist wahr, <code>Not_Halt_Aktiv</code> ist falsch UND <code>ARIA_Override</code> ist falsch.<br>Zusätzlich: <code>Ampel_Rot</code> soll leuchten, sobald <code>Not_Halt_Aktiv</code> ODER <code>ARIA_Override</code> aktiv ist.',
  learn:'Eine vollständige Freigabekette mit AND und NOT sowie eine Sammelstörung mit OR.',
  take:'Freigabe = alle Bedingungen erfüllt (AND). Störung = irgendeine Ursache (OR). Dieses Muster findest du in jeder Maschine.',
  vars:{Zaun_Offen:true, Weg_Frei:false, Not_Halt_Aktiv:false, ARIA_Override:false, Freigabe:false, Ampel_Rot:false},
  tests:[[{Zaun_Offen:false, Weg_Frei:true},{Freigabe:true, Ampel_Rot:false}],
         [{Zaun_Offen:true, Weg_Frei:true},{Freigabe:false, Ampel_Rot:false}],
         [{Zaun_Offen:false, Weg_Frei:true, Not_Halt_Aktiv:true},{Freigabe:false, Ampel_Rot:true}],
         [{Zaun_Offen:false, Weg_Frei:true, ARIA_Override:true},{Freigabe:false, Ampel_Rot:true}],
         [{Zaun_Offen:false, Weg_Frei:false},{Freigabe:false}]],
  ref:'Freigabe := NOT Zaun_Offen AND Weg_Frei AND NOT Not_Halt_Aktiv AND NOT ARIA_Override;\nAmpel_Rot := Not_Halt_Aktiv OR ARIA_Override;', man:'logik',
  hint:'Zwei Zeilen: eine lange AND-Kette mit drei NOTs, eine kurze OR-Verknüpfung.',
  bind:['lightGreen=Freigabe','lightRed=Ampel_Rot','faultActive=ARIA_Override','sensorActive=Weg_Frei'],
  wrong:['Freigabe := NOT Zaun_Offen AND Weg_Frei AND NOT Not_Halt_Aktiv;\nAmpel_Rot := Not_Halt_Aktiv OR ARIA_Override;',
         'Freigabe := NOT Zaun_Offen AND Weg_Frei AND NOT Not_Halt_Aktiv AND NOT ARIA_Override;\nAmpel_Rot := Not_Halt_Aktiv AND ARIA_Override;']
});
