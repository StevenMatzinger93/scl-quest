/* ===== STÖRUNGSJAGD — Fehlerszenarien für die Live-Challenge (mind. 2 pro Kapitel) =====
   Die Anlage läuft mit einem eingebauten Fehler. Die Klasse findet und behebt ihn.
   symptom = was an der Anlage beobachtet wird (verrät den Fehler nicht direkt).
   Der Validator prüft: Referenz besteht, Fehlerversion übersetzt, scheitert aber an den Tests. */
(function(){
// Kapitel 1
defBug({ id:'s1_bilanz', task:'c1_boss', title:'Die Teilebilanz stimmt nicht', symptom:'Das HMI zeigt mehr gute Teile an, als überhaupt produziert wurden.', bug:[['Teile_Gesamt - Teile_Defekt', 'Teile_Gesamt + Teile_Defekt']] });
defBug({ id:'s1_winkel', task:'c1_calc', title:'Achse schwenkt falsch', symptom:'Die Achse fährt beim Start in die falsche Richtung.', bug:[['Start_Winkel + 30', 'Start_Winkel - 30']] });
// Kapitel 2
defBug({ id:'s2_haltung', task:'c2_latch', title:'Motor lässt sich nicht halten', symptom:'Der Motor läuft nur, solange jemand den Stopp-Taster drückt.', bug:[['AND NOT Stopp', 'AND Stopp']] });
defBug({ id:'s2_klammer', task:'c2_klammer', title:'Band läuft im Handbetrieb', symptom:'Das Band startet manchmal auch ohne Automatik.', bug:[['Auto_Modus AND (Sensor_A OR Sensor_B)', 'Auto_Modus AND Sensor_A OR Sensor_B']] });
// Kapitel 3
defBug({ id:'s3_tara', task:'c3_boss', title:'Negative Gewichte', symptom:'Die Wiegestation meldet unmögliche Nettogewichte — alle Teile fallen durch.', bug:[['Netto := Brutto - Tara;', 'Netto := Tara - Brutto;']] });
defBug({ id:'s3_mittel', task:'c3_mittel', title:'Der Mittelwert springt', symptom:'Der angezeigte Mittelwert ist bei ungeraden Summen immer etwas zu klein.', bug:[['INT_TO_REAL(Wert_A + Wert_B) / 2.0', 'INT_TO_REAL((Wert_A + Wert_B) / 2)']] });
// Kapitel 4
defBug({ id:'s4_hysterese', task:'c4_hysterese', title:'Der flatternde Lüfter', symptom:'Der Lüfter schaltet zwischen 60 und 70 °C ständig ein und aus.', bug:[['Temperatur < 60', 'Temperatur > 60']] });
defBug({ id:'s4_greifer', task:'c4_boss', title:'Teile landen in der Nacharbeit', symptom:'Freigegebene Teile schwenkt der Arm auf die falsche Seite.', bug:[['  Achse_Grad := 90;', '  Achse_Grad := -90;']] });
// Kapitel 5
defBug({ id:'s5_position', task:'c5_positionen', title:'Position 3 vertauscht', symptom:'Bei Position 3 fährt der Arm ins Lager statt in die Nacharbeit.', bug:[['3: Achse_Grad := -90;', '3: Achse_Grad := 90;']] });
defBug({ id:'s5_rezept', task:'c5_umbau', title:'Rezept 4 bleibt kalt', symptom:'Mit Rezept 4 heizt der Ofen nicht.', bug:[['3, 4: Soll_Temp := 250;', '3: Soll_Temp := 250;']] });
// Kapitel 6
defBug({ id:'s6_summe', task:'c6_summe', title:'Chargengewicht zu leicht', symptom:'Das Chargengewicht ist immer um ein Teil zu klein.', bug:[['FOR i := 0 TO 7 DO', 'FOR i := 1 TO 7 DO']] });
defBug({ id:'s6_mittel', task:'c6_mittel', title:'Durchschnitt zu hoch', symptom:'Das Durchschnittsgewicht liegt über dem schwersten Teil.', bug:[['/ 8.0', '/ 7.0']] });
// Kapitel 7
defBug({ id:'s7_exit', task:'c7_suche', title:'Falscher Defekt gemeldet', symptom:'Bei mehreren Defekten wird nicht der erste gemeldet.', bug:[['    Position := i;\n    EXIT;', '    Position := i;']] });
defBug({ id:'s7_lager', task:'c7_boss', title:'Lager überschreibt Teile', symptom:'Neue Teile landen auf belegten Plätzen.', bug:[['IF Lager[i] = 0 THEN', 'IF Lager[i] <> 0 THEN']] });
// Kapitel 8
defBug({ id:'s8_flanke', task:'c8_zaehlen', title:'Der rasende Zähler', symptom:'Der Teilezähler springt bei einem einzigen Teil um viele Stück hoch.', bug:[['IF Teil_Trigger.Q THEN', 'IF Teil_Erkannt THEN']] });
defBug({ id:'s8_karton', task:'c8_ctu', title:'Karton zu voll', symptom:'In jeden Karton kommt ein Teil zu viel.', bug:[['PV := 5', 'PV := 6']] });
// Kapitel 9
defBug({ id:'s9_anlauf', task:'c9_anlauf', title:'Keine Anlaufwarnung', symptom:'Das Band springt praktisch sofort an — die Warnung ist kaum zu hören.', bug:[['T#2S', 'T#2MS']] });
defBug({ id:'s9_blink', task:'c9_blinker', title:'Träge Warnlampe', symptom:'Die Warnlampe blinkt viel zu langsam — man hält sie für eine Dauerleuchte.', bug:[['PT := T#1S', 'PT := T#3S']] });
// Kapitel 10
defBug({ id:'s10_quitt', task:'c10_kette', title:'Kette startet von selbst', symptom:'Nach dem Quittieren wartet die Kette nicht auf Start.', bug:[['IF Quittieren THEN\n      Schritt := 0;', 'IF Quittieren THEN\n      Schritt := 1;']] });
defBug({ id:'s10_ablage', task:'c10_pickplace', title:'Greifer öffnet zu früh', symptom:'Der Greifer lässt das Teil fallen, bevor der Arm in der Ablage ist.', bug:[['IF Arm_In_Ablage THEN', 'IF Arm_In_Station THEN']] });
// Kapitel 11
defBug({ id:'s11_start', task:'p11_startwert', title:'Palette sofort leer', symptom:'Nach dem Einschalten meldet die Station sofort „Palette leer“.', bug:{ FB_Restzaehler:[['Rest : Int := 10;', 'Rest : Int;']] } });
defBug({ id:'s11_maske', task:'p11_bits', title:'Falsche Fehlerbits', symptom:'Die Fehlermaske meldet Bits, die gar nicht gesetzt sind.', bug:{ FB_Antriebsstatus:[['#Status AND 16#0028', '#Status OR 16#0028']] } });
// Kapitel 12
defBug({ id:'s12_skal', task:'p12_skalieren', title:'Skalierung daneben', symptom:'Der skalierte Messwert stimmt nur, wenn die Untergrenze 0 ist.', bug:{ FC_Skalieren:[['(#OG - #UG)', '(#OG + #UG)']] } });
defBug({ id:'s12_sort', task:'p12_inout', title:'Sortierung unvollständig', symptom:'Das letzte Paar Werte bleibt manchmal unsortiert.', bug:{ FC_Sortieren:[['FOR #j := 1 TO 5 - #i DO', 'FOR #j := 1 TO 4 - #i DO']] } });
// Kapitel 13
defBug({ id:'s13_freigabe', task:'p13_motor', title:'Motor trotz offener Tür', symptom:'Der Motor läuft an, obwohl die Schutztür offen ist.', bug:{ FB_Motor:[['AND NOT #Stopp AND #Freigabe', 'AND NOT #Stopp OR #Freigabe']] } });
defBug({ id:'s13_rest', task:'p13_zaehler_fb', title:'Restanzeige steht', symptom:'Die Anzeige der fehlenden Teile zählt nicht herunter.', bug:{ FB_Stueckzaehler:[['IN2 := 0', 'IN2 := #Soll']] } });
// Kapitel 14
defBug({ id:'s14_charge', task:'p14_array_udt', title:'Erstes Teil fehlt', symptom:'Im Chargenprotokoll fehlt immer das erste Teil.', bug:{ FC_Charge:[['FOR #i := 1 TO 8 DO', 'FOR #i := 2 TO 8 DO']] } });
defBug({ id:'s14_text', task:'p14_concat', title:'Alles NOK', symptom:'Das HMI meldet jedes Teil als NOK — auch die guten.', bug:{ FC_Teiletext:[["IN2 := 'OK'", "IN2 := 'NOK'"]] } });
// Kapitel 15
defBug({ id:'s15_modus', task:'p15_betriebsart', title:'Automatik zeigt HAND', symptom:'In Stellung AUTO zeigt die Betriebsart „HAND“ und die Automatik startet nicht.', bug:{ FB_Betriebsart:[['#Modus := 2;', '#Modus := 1;']] } });
defBug({ id:'s15_ziel', task:'p15_schrittkette', title:'Ausschuss im Lager', symptom:'Schlechte Teile landen im Lager statt in der Nacharbeit.', bug:{ FB_Pick:[['#Ziel := -90;', '#Ziel := 90;']] } });
})();
