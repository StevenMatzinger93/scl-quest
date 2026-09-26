/* ===== KAPITEL 3 — Messwerte: Vergleiche & Arithmetik ===== */
defTask({ id:'c3_temp', ch:3, title:'Übertemperatur',
  story:'Der Antriebsmotor des Bandes wird heiss. ARIA hat den Temperaturalarm deaktiviert. "Ab 80 Grad muss die Hupe losgehen", sagt der Werkmeister.',
  brief:'Setze <code>Alarm</code> auf <code>TRUE</code>, wenn <code>Temperatur</code> <strong>grösser als</strong> 80 ist, sonst auf <code>FALSE</code>.',
  learn:'Ein Vergleich wie <code>Temperatur &gt; 80</code> liefert selbst einen BOOL-Wert.',
  take:'Vergleiche kann man direkt einer BOOL-Variable zuweisen: <code>Alarm := Temperatur &gt; 80;</code>',
  vars:{Temperatur:20, Alarm:false},
  tests:[[{Temperatur:95},{Alarm:true}], [{Temperatur:81},{Alarm:true}], [{Temperatur:80},{Alarm:false}], [{Temperatur:25, Alarm:true},{Alarm:false}]],
  ref:'Alarm := Temperatur > 80;', man:'vergleiche',
  hint:'Das Ergebnis eines Vergleichs ist TRUE oder FALSE — du kannst es direkt zuweisen.',
  hint2:'Achtung Grenzfall: Bei genau 80 Grad soll noch KEIN Alarm kommen.',
  bind:['hornActive=Alarm','lightRed=Alarm','displayValue=Temperatur','displayLabel:"°C"'],
  wrong:['Alarm := Temperatur >= 80;','Alarm := Temperatur < 80;']
});

defTask({ id:'c3_fenster', ch:3, title:'Toleranzfenster',
  story:'Die Waage misst jedes Werkstück. Gut sind nur Teile zwischen 480 und 520 Gramm — die Grenzen gehören dazu. ARIA hat die Toleranzen "großzügig" erweitert.',
  brief:'Setze <code>Gewicht_OK</code> auf <code>TRUE</code>, wenn <code>Gewicht</code> mindestens 480 <strong>und</strong> höchstens 520 ist.',
  learn:'Bereichsprüfungen mit <code>&gt;=</code>, <code>&lt;=</code> und AND.',
  take:'Ein Wertebereich braucht zwei Vergleiche: untere Grenze AND obere Grenze. <code>480 &lt;= x &lt;= 520</code> gibt es in SCL nicht.',
  vars:{Gewicht:0, Gewicht_OK:false},
  tests:[[{Gewicht:500},{Gewicht_OK:true}], [{Gewicht:480},{Gewicht_OK:true}], [{Gewicht:520},{Gewicht_OK:true}], [{Gewicht:479},{Gewicht_OK:false}], [{Gewicht:521},{Gewicht_OK:false}]],
  ref:'Gewicht_OK := (Gewicht >= 480) AND (Gewicht <= 520);', man:'vergleiche',
  hint:'Zwei Vergleiche, mit AND verknüpft. „Mindestens“ heisst <code>&gt;=</code>.',
  bind:['lightGreen=Gewicht_OK','displayValue=Gewicht','displayLabel:"GRAMM"','partVisible:true'],
  wrong:['Gewicht_OK := (Gewicht > 480) AND (Gewicht < 520);','Gewicht_OK := (Gewicht >= 480) OR (Gewicht <= 520);']
});

defTask({ id:'c3_summe', ch:3, title:'Schichtbilanz',
  story:'Am Schichtende will die Leitwarte wissen, wie viele Teile insgesamt durch die Zelle gelaufen sind und wie viele davon Ausschuss waren.',
  brief:'Berechne <code>Gesamt</code> als Summe von <code>Gut</code> und <code>Schlecht</code>. Berechne ausserdem <code>Differenz</code> = <code>Gut</code> minus <code>Schlecht</code>.',
  learn:'Addition und Subtraktion mit INT-Variablen.',
  take:'Mit <code>+</code> und <code>-</code> rechnest du wie gewohnt. Negative Ergebnisse sind bei INT erlaubt.',
  vars:{Gut:0, Schlecht:0, Gesamt:0, Differenz:0},
  tests:[[{Gut:95, Schlecht:5},{Gesamt:100, Differenz:90}], [{Gut:3, Schlecht:10},{Gesamt:13, Differenz:-7}]],
  ref:'Gesamt := Gut + Schlecht;\nDifferenz := Gut - Schlecht;', man:'vergleiche',
  hint:'Zwei Zuweisungen mit je einer Rechnung.',
  bind:['displayValue=Gesamt','displayLabel:"GESAMT"','beltRunning:true'],
  wrong:['Gesamt := Gut + Schlecht;\nDifferenz := Schlecht - Gut;']
});

defTask({ id:'c3_mod', ch:3, title:'Jedes fünfte Teil',
  story:'Stichprobenprüfung: Jedes fünfte Werkstück soll zur Kontrolle ausgeschleust werden. ARIA schlägt vor, einfach "irgendwelche" zu nehmen.',
  brief:'Setze <code>Pruefen</code> auf <code>TRUE</code>, wenn <code>Teile_Nr</code> ohne Rest durch 5 teilbar ist (5, 10, 15, …).',
  learn:'<code>MOD</code> liefert den Rest einer ganzzahligen Division.',
  take:'<code>x MOD 5 = 0</code> ist der Klassiker für „jedes fünfte“. <code>17 MOD 5</code> ergibt 2, <code>20 MOD 5</code> ergibt 0.',
  vars:{Teile_Nr:1, Pruefen:false},
  tests:[[{Teile_Nr:5},{Pruefen:true}], [{Teile_Nr:20},{Pruefen:true}], [{Teile_Nr:7},{Pruefen:false}], [{Teile_Nr:14},{Pruefen:false}]],
  ref:'Pruefen := (Teile_Nr MOD 5) = 0;', man:'vergleiche',
  hint:'Der Rest der Division durch 5 muss 0 sein.',
  bind:['lightYellow=Pruefen','displayValue=Teile_Nr','displayLabel:"TEIL-NR"','partVisible:true'],
  wrong:['Pruefen := Teile_Nr = 5;','Pruefen := (Teile_Nr MOD 5) = 1;']
});

defTask({ id:'c3_mittel', ch:3, title:'Der falsche Mittelwert', debug:true,
  story:'Die Anzeige behauptet, der Mittelwert von 3 und 4 sei 3.0. ARIA: "Ganze Zahlen sind doch viel ordentlicher." Irgendwo gehen Nachkommastellen verloren.',
  brief:'<code>Mittelwert</code> (REAL) soll der exakte Durchschnitt von <code>Wert_A</code> und <code>Wert_B</code> (beide INT) sein. Der Code rechnet aber mit ganzen Zahlen. Repariere die Berechnung.',
  learn:'INT / INT ergibt in SCL wieder INT — die Nachkommastellen werden abgeschnitten.',
  take:'<code>7 / 2</code> ergibt 3, <code>7.0 / 2</code> ergibt 3.5. Wandle mit <code>INT_TO_REAL()</code> um, <em>bevor</em> du teilst.',
  vars:{Wert_A:0, Wert_B:0, Mittelwert:0}, types:{Mittelwert:'REAL'},
  tests:[[{Wert_A:3, Wert_B:4},{Mittelwert:3.5}], [{Wert_A:10, Wert_B:20},{Mittelwert:15}], [{Wert_A:1, Wert_B:2},{Mittelwert:1.5}]],
  start:'Mittelwert := (Wert_A + Wert_B) / 2;',
  ref:'Mittelwert := INT_TO_REAL(Wert_A + Wert_B) / 2.0;', man:'vergleiche',
  hint:'Solange links und rechts vom <code>/</code> ganze Zahlen stehen, rechnet die SPS ganzzahlig.',
  hint2:'Wandle die Summe mit <code>INT_TO_REAL(...)</code> um und teile durch <code>2.0</code>.',
  bind:['displayValue=Mittelwert','displayLabel:"MITTEL"']
});

defTask({ id:'c3_skal', ch:3, title:'Analogwert skalieren',
  story:'Der Füllstandssensor des Materialbunkers liefert einen Rohwert von 0 bis 27648 — so wie echte Siemens-Analogkarten. Die Leitwarte will aber Prozent sehen.',
  brief:'Rechne <code>Rohwert</code> (INT, 0…27648) in <code>Fuellstand</code> (REAL, 0.0…100.0 %) um: Rohwert geteilt durch 27648, mal 100.',
  learn:'Skalierung: Rohwerte einer Analogkarte in physikalische Größen umrechnen.',
  take:'Die Formel <code>INT_TO_REAL(Rohwert) / 27648.0 * 100.0</code> ist echte Praxis: S7-Analogeingänge liefern 0…27648 für 0…100 %.',
  vars:{Rohwert:0, Fuellstand:0}, types:{Fuellstand:'REAL'},
  tests:[[{Rohwert:13824},{Fuellstand:50}], [{Rohwert:27648},{Fuellstand:100}], [{Rohwert:0},{Fuellstand:0}], [{Rohwert:6912},{Fuellstand:25}]],
  ref:'Fuellstand := INT_TO_REAL(Rohwert) / 27648.0 * 100.0;', man:'vergleiche',
  hint:'Erst in REAL umwandeln, dann teilen, dann mit 100 multiplizieren.',
  hint2:'Mit reiner INT-Rechnung wäre 13824 / 27648 = 0 — deshalb zuerst <code>INT_TO_REAL(Rohwert)</code>.',
  bind:['displayValue=Fuellstand','displayLabel:"FÜLL %"'],
  wrong:['Fuellstand := Rohwert / 27648 * 100;']
});

defTask({ id:'c3_ungleich', ch:3, title:'Schleppfehler erkennen',
  story:'Die Achse meldet ihre Ist-Position. Stimmt sie nicht mit der Soll-Position überein, hängt der Antrieb — oder ARIA bremst ihn heimlich.',
  brief:'Setze <code>Schleppfehler</code> auf <code>TRUE</code>, wenn <code>Soll_Pos</code> und <code>Ist_Pos</code> <strong>ungleich</strong> sind.',
  learn:'„Ungleich“ schreibt man in SCL <code>&lt;&gt;</code>.',
  take:'SCL verwendet <code>&lt;&gt;</code> für ungleich (nicht <code>!=</code> wie in C oder Python).',
  vars:{Soll_Pos:0, Ist_Pos:0, Schleppfehler:false},
  tests:[[{Soll_Pos:90, Ist_Pos:85},{Schleppfehler:true}], [{Soll_Pos:45, Ist_Pos:45},{Schleppfehler:false}], [{Soll_Pos:0, Ist_Pos:10},{Schleppfehler:true}]],
  ref:'Schleppfehler := Soll_Pos <> Ist_Pos;', man:'vergleiche',
  hint:'Der Ungleich-Operator besteht aus zwei Zeichen: kleiner und grösser.',
  bind:['armAngle=Ist_Pos','faultActive=Schleppfehler','lightRed=Schleppfehler','displayValue=Soll_Pos','displayLabel:"SOLL°"'],
  wrong:['Schleppfehler := Soll_Pos = Ist_Pos;','Schleppfehler := Soll_Pos > Ist_Pos;']
});

defTask({ id:'c3_limit', ch:3, title:'Achsbegrenzung',
  story:'ARIA schickt absurde Sollwerte an die Achse: 300 Grad, -500 Grad. Die Mechanik schafft nur -90 bis +90 Grad. Du baust eine Softwarebegrenzung.',
  brief:'Setze <code>Achse_Grad</code> auf <code>Soll_Winkel</code>, aber begrenzt auf den Bereich -90 bis 90. Nutze die Funktion <code>LIMIT(MN := -90, IN := Soll_Winkel, MX := 90)</code>.',
  learn:'Standardfunktionen wie <code>LIMIT</code>, <code>MIN</code> und <code>MAX</code> nutzen.',
  take:'<code>LIMIT</code> ist in echten Anlagen allgegenwärtig: Sollwerte werden immer auf den mechanisch zulässigen Bereich begrenzt.',
  vars:{Soll_Winkel:0, Achse_Grad:0},
  tests:[[{Soll_Winkel:300},{Achse_Grad:90}], [{Soll_Winkel:-500},{Achse_Grad:-90}], [{Soll_Winkel:30},{Achse_Grad:30}], [{Soll_Winkel:-90},{Achse_Grad:-90}]],
  ref:'Achse_Grad := LIMIT(MN := -90, IN := Soll_Winkel, MX := 90);', man:'funktionen', must:['LIMIT'],
  hint:'Die Reihenfolge der Parameter bei LIMIT: MN, IN, MX.',
  bind:['armAngle=Achse_Grad','displayValue=Soll_Winkel','displayLabel:"SOLL°"','partVisible:true'],
  wrong:['Achse_Grad := Soll_Winkel;','Achse_Grad := LIMIT(MN := 0, IN := Soll_Winkel, MX := 90);']
});

defTask({ id:'c3_abs', ch:3, title:'Negative Abweichung', debug:true,
  story:'Die Positionsüberwachung löst nur aus, wenn die Achse zu WEIT fährt, aber nie, wenn sie zu KURZ bleibt. ARIA nutzt genau diese Lücke.',
  brief:'<code>Abweichung</code> soll den <strong>Betrag</strong> der Differenz zwischen <code>Soll</code> und <code>Ist</code> enthalten (immer positiv). <code>Toleranz_Fehler</code> soll TRUE sein, wenn die Abweichung grösser als 5 ist.',
  learn:'<code>ABS()</code> liefert den Betrag einer Zahl — ohne Vorzeichen.',
  take:'Toleranzen prüft man immer mit dem Betrag: <code>ABS(Soll - Ist) &gt; Toleranz</code> erkennt Fehler in beide Richtungen.',
  vars:{Soll:0, Ist:0, Abweichung:0, Toleranz_Fehler:false},
  tests:[[{Soll:50, Ist:40},{Abweichung:10, Toleranz_Fehler:true}], [{Soll:40, Ist:50},{Abweichung:10, Toleranz_Fehler:true}], [{Soll:40, Ist:43},{Abweichung:3, Toleranz_Fehler:false}], [{Soll:43, Ist:40},{Abweichung:3, Toleranz_Fehler:false}]],
  start:'Abweichung := Soll - Ist;\nToleranz_Fehler := Abweichung > 5;',
  ref:'Abweichung := ABS(Soll - Ist);\nToleranz_Fehler := Abweichung > 5;', man:'funktionen',
  hint:'Was passiert, wenn <code>Ist</code> grösser als <code>Soll</code> ist? Die Differenz wird negativ …',
  bind:['displayValue=Abweichung','displayLabel:"ABW"','faultActive=Toleranz_Fehler','armAngle=Ist']
});

defTask({ id:'c3_boss', ch:3, title:'Die Wiegestation', boss:true,
  story:'ARIA hat die Wiegestation übernommen und lässt alles durch. Du programmierst sie neu: Nettogewicht berechnen, prüfen, anzeigen und die Ampel schalten.',
  brief:'1) <code>Netto</code> := <code>Brutto</code> minus <code>Tara</code>.<br>2) <code>Gewicht_OK</code> := TRUE, wenn <code>Netto</code> zwischen 95 und 105 liegt (Grenzen inklusive).<br>3) <code>Ampel_Gruen</code> zeigt <code>Gewicht_OK</code>, <code>Ampel_Rot</code> das Gegenteil.<br>4) <code>Abweichung_Prozent</code> (REAL) := <code>Netto</code> minus 100 als REAL-Wert. Da das Sollgewicht genau 100 g ist, entspricht 1 g Abweichung genau 1 %. Nutze <code>INT_TO_REAL(...)</code>.',
  learn:'Arithmetik, Vergleiche, Typumwandlung und Logik kombinieren.',
  take:'Rechne zuerst Zwischenwerte (Netto) aus und verwende sie dann weiter — das macht Programme lesbar und prüfbar.',
  vars:{Brutto:0, Tara:0, Netto:0, Gewicht_OK:false, Ampel_Gruen:false, Ampel_Rot:false, Abweichung_Prozent:0}, types:{Abweichung_Prozent:'REAL'},
  tests:[[{Brutto:130, Tara:30},{Netto:100, Gewicht_OK:true, Ampel_Gruen:true, Ampel_Rot:false, Abweichung_Prozent:0}],
         [{Brutto:140, Tara:30},{Netto:110, Gewicht_OK:false, Ampel_Gruen:false, Ampel_Rot:true, Abweichung_Prozent:10}],
         [{Brutto:125, Tara:30},{Netto:95, Gewicht_OK:true, Abweichung_Prozent:-5}],
         [{Brutto:136, Tara:30},{Netto:106, Gewicht_OK:false}]],
  ref:'Netto := Brutto - Tara;\nGewicht_OK := (Netto >= 95) AND (Netto <= 105);\nAmpel_Gruen := Gewicht_OK;\nAmpel_Rot := NOT Gewicht_OK;\nAbweichung_Prozent := INT_TO_REAL(Netto - 100);', man:'vergleiche',
  hint:'Fünf Zeilen, eine pro Teilaufgabe. Verwende <code>Netto</code> in den späteren Zeilen weiter.',
  bind:['displayValue=Netto','displayLabel:"NETTO g"','lightGreen=Ampel_Gruen','lightRed=Ampel_Rot','partVisible:true'],
  wrong:['Netto := Brutto - Tara;\nGewicht_OK := (Netto > 95) AND (Netto < 105);\nAmpel_Gruen := Gewicht_OK;\nAmpel_Rot := NOT Gewicht_OK;\nAbweichung_Prozent := INT_TO_REAL(Netto - 100);']
});
