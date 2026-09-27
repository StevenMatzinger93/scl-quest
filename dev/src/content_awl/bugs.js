/* ===== AWL QUEST: Störungsjagd (Live-Challenge) =====
   Jede Störung verändert die Musterlösung einer Aufgabe; der Validator prüft: übersetzt, scheitert an den Tests. */
(function(){
// Kapitel 1
defBug({ id:'as1_gitter', task:'a1_und', title:'Walzen bei offenem Gitter', symptom:'Das Walzgerüst läuft an, obwohl das Schutzgitter offen steht.', bug:[['U  S_Walzen\nU  Gitter_zu', 'U  S_Walzen\nO  Gitter_zu']] });
defBug({ id:'as1_oel', task:'a1_pumpe', title:'Pumpe ohne Öl', symptom:'Die Hydraulikpumpe läuft auch mit leerem Tank.', bug:[['U  Oel_OK\n', '']] });
defBug({ id:'as1_notaus', task:'a1_boss', title:'Rollgang trotz Not-Aus', symptom:'Der Rollgang lässt sich bei gedrücktem Not-Aus starten.', bug:[['U  S_Rollgang\nU  Not_Aus_OK', 'U  S_Rollgang\nUN Not_Aus_OK']] });
// Kapitel 2
defBug({ id:'as2_stoerung', task:'a2_un', title:'Walzen trotz Störung', symptom:'Das Gerüst läuft weiter, obwohl eine Störung ansteht.', bug:[['UN Stoerung', 'U  Stoerung']] });
defBug({ id:'as2_klammer', task:'a2_klammer', title:'Walzen ohne Befehl', symptom:'Das Gerüst läuft los, sobald eine Kühlpumpe anläuft — ohne dass jemand „Walzen“ drückt.', bug:[['U  S_Walzen\nU(\nO  Pumpe_1\nO  Pumpe_2\n)', 'U  S_Walzen\nO  Pumpe_1\nO  Pumpe_2']] });
defBug({ id:'as2_hand', task:'a2_boss', title:'Automatik ohne Block', symptom:'Im Automatikbetrieb fährt der Rollgang, obwohl kein Block bereit liegt.', bug:[['U  Automatik\nU  Block_bereit', 'U  Automatik']] });
// Kapitel 3
defBug({ id:'as3_vorrang', task:'a3_sr', title:'Aus wirkt nicht', symptom:'Drückt man Ein und Aus gleichzeitig, läuft die Pumpe an.', bug:[['U  S_Ein\nS  Pumpe\nU  S_Aus\nR  Pumpe', 'U  S_Aus\nR  Pumpe\nU  S_Ein\nS  Pumpe']] });
defBug({ id:'as3_haltung', task:'a3_selbsthaltung', title:'Gerüst vergisst sich', symptom:'Das Gerüst läuft nur, solange jemand den Ein-Taster festhält.', bug:[['O  Walzen\n', '']] });
defBug({ id:'as3_quit', task:'a3_stoerung', title:'Weg-quittierte Störung', symptom:'Die Störung lässt sich quittieren, obwohl der Öldruck noch fehlt.', bug:[['U  Quittieren\nUN Druck_tief', 'U  Quittieren']] });
// Kapitel 4
defBug({ id:'as4_dauerschnitt', task:'a4_fp', title:'Die Schere hackt', symptom:'Solange der Taster gedrückt ist, schneidet die Schere ununterbrochen.', bug:[['FP M_Schnitt\n', '']] });
defBug({ id:'as4_richtung', task:'a4_stromstoss', title:'Kühlung lässt sich nicht ausschalten', symptom:'Der Kühlungstaster schaltet ein, aber nie wieder aus.', bug:[['X  Kuehlung', 'O  Kuehlung']] });
defBug({ id:'as4_hand', task:'a4_boss', title:'Handschnitt ohne Ende', symptom:'Nach einem Handschnitt bleibt die Schere unten, bis der Taster losgelassen wird.', bug:[['U  S_Hand\nFP M_Hand', 'U  S_Hand\nFP M_Block']] });
// Kapitel 5
defBug({ id:'as5_zeit', task:'a5_se', title:'Walzen ohne Druck', symptom:'Das Gerüst wird freigegeben, bevor die Hydraulik Druck aufgebaut hat.', bug:[['S5T#3S', 'S5T#300MS']] });
defBug({ id:'as5_nachlauf', task:'a5_sa', title:'Kein Nachkühlen', symptom:'Das Kühlwasser stoppt sofort mit dem Gerüst.', bug:[['SA T2', 'SE T2']] });
defBug({ id:'as5_tuer', task:'a5_boss', title:'Heizen bei offener Tür', symptom:'Der Ofen heizt schon wieder, während die Tür noch offen steht.', bug:[['U  S_Heizen\nUN T2', 'U  S_Heizen\nUN T3']] });
// Kapitel 6
defBug({ id:'as6_reset', task:'a6_reset', title:'Zähler ohne Reset', symptom:'Der Schichtleiter drückt „Zähler löschen“, aber der Zählerstand bleibt.', bug:[['R  Z1', 'R  Z2']] });
defBug({ id:'as6_charge', task:'a6_zr', title:'Die Charge wird grösser', symptom:'Mit jedem Block steigt die Restanzeige der Charge, statt zu sinken.', bug:[['ZR Z2', 'ZV Z2']] });
defBug({ id:'as6_tag', task:'a6_boss', title:'Tageszähler bleibt stehen', symptom:'Die Charge zählt richtig, der Tageszähler zeigt immer 0.', bug:[['U  S_Schicht\nR  Z2', 'UN S_Schicht\nR  Z2']] });
// Kapitel 7
defBug({ id:'as7_anzeige', task:'a7_lt', title:'Anzeige ohne Wert', symptom:'Die Temperaturanzeige am Leitstand zeigt dauernd 0.', bug:[['L  Temp\nT  Anzeige', 'L  Anzeige\nT  Temp']] });
defBug({ id:'as7_soll', task:'a7_konst', title:'Falscher Sollwert', symptom:'Der Ofen regelt auf 125 °C statt auf 1250 °C.', bug:[['L  1250', 'L  125']] });
defBug({ id:'as7_fuehler', task:'a7_tak', title:'Beide Fühler gleich', symptom:'Eingangs- und Ausgangstemperatur zeigen immer denselben Wert.', bug:[['TAK\n', '']] });
// Kapitel 8
defBug({ id:'as8_abnahme', task:'a8_minus', title:'Negative Abnahme', symptom:'Die Stichabnahme wird negativ angezeigt.', bug:[['L  Dicke_ein\nL  Dicke_aus', 'L  Dicke_aus\nL  Dicke_ein']] });
defBug({ id:'as8_mittel', task:'a8_mittel', title:'Mittelwert ohne Komma', symptom:'Der Temperatur-Mittelwert hat nie Nachkommastellen.', bug:[['ITD\nDTR\nL  2.0\n/R', 'L  2\n/I\nITD\nDTR']] });
defBug({ id:'as8_stich', task:'a8_boss', title:'Zwei Stiche zu wenig', symptom:'Der Stichplan rechnet nur mit einem Stich.', bug:[['L  0.8\n*R\nL  0.8\n*R\nL  0.8\n*R', 'L  0.8\n*R']] });
// Kapitel 9
defBug({ id:'as9_grenze', task:'a9_groesser', title:'Zu kalt gewalzt', symptom:'Auch Blöcke mit 1000 °C werden freigegeben.', bug:[['L  1100', 'L  1000']] });
defBug({ id:'as9_klammer', task:'a9_klammer', title:'Walzen ohne Taster', symptom:'Das Gerüst läuft los, sobald der Block heiss genug ist.', bug:[['U  S_Walzen\nU(\nL  Temp\nL  1100\n>=I\n)', 'U  S_Walzen\nL  Temp\nL  1100\n>=I']] });
defBug({ id:'as9_hysterese', task:'a9_boss', title:'Der flatternde Ofen', symptom:'Die Heizung schaltet schon bei 1151 °C wieder ab — die Hysterese fehlt.', bug:[['L  1200\n>I\n)\nR  Heizung', 'L  1150\n>I\n)\nR  Heizung']] });
// Kapitel 10
defBug({ id:'as10_spa', task:'a10_verzweigung', title:'Immer der Spalt', symptom:'Die Anzeige zeigt immer den Walzspalt, egal wie der Wahlschalter steht.', bug:[['SPA ENDE\n', '']] });
defBug({ id:'as10_zaehlen', task:'a10_zaehlen', title:'Der rasende Zähler', symptom:'Solange ein Block in der Lichtschranke liegt, zählt der Tageszähler in jedem Zyklus weiter.', bug:[['FP M_Block\n', '']] });
defBug({ id:'as10_notaus', task:'a10_final', title:'Not-Aus ohne Wirkung', symptom:'Bei Not-Aus bleibt die Hydraulikpumpe eingeschaltet.', bug:[['CLR\n=  Pumpe', 'SET\n=  Pumpe']] });
})();
(function(){
// Kapitel 11
defBug({ id:'as11_oel', task:'ap11_erste_fc', title:'Walzen ohne Öl', symptom:'Gerüst 1 wird freigegeben, obwohl das Hydrauliköl fehlt.', bug:{ FC_Freigabe:[['U  #Oel_OK\n', '']] } });
defBug({ id:'as11_abnahme', task:'ap11_retval', title:'Negative Abnahme', symptom:'Die Stichabnahme wird mit falschem Vorzeichen gemeldet.', bug:{ FC_Abnahme:[['L  #Dicke_ein\nL  #Dicke_aus', 'L  #Dicke_aus\nL  #Dicke_ein']] } });
defBug({ id:'as11_kalt', task:'ap11_boss', title:'Kalt gewalzt', symptom:'Das Gerüst walzt auch Blöcke mit 1000 °C.', bug:{ FC_Geruest:[['L  1100', 'L  900']] } });
// Kapitel 12
defBug({ id:'as12_haltung', task:'ap12_selbsthaltung', title:'Der vergessliche Antrieb', symptom:'Der Rollgang läuft nur, solange jemand den Starttaster hält.', bug:{ FB_Antrieb:[['O  #Laeuft\n', '']] } });
defBug({ id:'as12_nachlauf', task:'ap12_timer', title:'Kein Nachkühlen', symptom:'Das Kühlwasser stoppt fast gleichzeitig mit dem Gerüst.', bug:{ FB_Kuehlung:[['T#5S', 'T#500MS']] } });
defBug({ id:'as12_pumpe', task:'ap12_boss', title:'Pumpe trotz Störung', symptom:'Nach einer Öldruckstörung läuft die Hydraulikpumpe einfach weiter.', bug:{ FB_Geruest:[['UN #Stopp\nUN #Stoerung\n=  #Pumpe', 'UN #Stopp\n=  #Pumpe']] } });
// Kapitel 13
defBug({ id:'as13_max', task:'ap13_db', title:'Das Maximum bleibt stehen', symptom:'Die Tagesstatistik zeigt als Maximum immer die erste Temperatur des Tages.', bug:{ Main:[['>I\nSPBN ENDE', '<I\nSPBN ENDE']] } });
defBug({ id:'as13_param', task:'ap13_parameter', title:'Feste Grenze', symptom:'Der neue Grenzwert im Parameter-DB wird ignoriert.', bug:{ Main:[['Grenze := "DB_Parameter".Temp_min', 'Grenze := 1100']] } });
defBug({ id:'as13_stich', task:'ap13_boss', title:'Der vertauschte Stich', symptom:'Bei Stich 2 fährt das Gerüst den Spalt von Stich 3.', bug:{ Main:[['L  "DB_Stichplan".Stich[2].Spalt', 'L  "DB_Stichplan".Stich[3].Spalt']] } });
// Kapitel 14
defBug({ id:'as14_rm', task:'ap14_antrieb', title:'Die schweigende Überwachung', symptom:'Ein Antrieb ohne Rückmeldung wird erst nach einer halben Minute gemeldet.', bug:{ FB_Antrieb:[['T#2S', 'T#30S']] } });
defBug({ id:'as14_hysterese', task:'ap14_ofen', title:'Der flatternde Ofen', symptom:'Die Heizung schaltet schon knapp unter dem Sollwert wieder ein.', bug:{ FB_Ofen:[['L  #Soll\nL  #Hysterese\n-I', 'L  #Soll\nL  #Hysterese\n+I']] } });
defBug({ id:'as14_meldung', task:'ap14_meldung', title:'Die Lampe blinkt nicht', symptom:'Eine neue Störung leuchtet sofort dauernd — niemand sieht, dass sie neu ist.', bug:{ FB_Meldung:[['U  #Gespeichert\nUN #Neu\n=  #Lampe', 'U  #Gespeichert\n=  #Lampe']] } });
// Kapitel 15
defBug({ id:'as15_anlauf', task:'ap15_anlauf', title:'Der Zähler von gestern', symptom:'Nach einem Neustart zeigt das Walzwerk noch die Blöcke vom Vortag.', bug:{ Startup:[['T  "DB_Walzwerk".Bloecke', 'T  "Anzeige"']] } });
defBug({ id:'as15_status', task:'ap15_status', title:'Störung als Walzen', symptom:'Die Leitwarte sieht bei einer Störung den Status „Walzen“.', bug:{ FC_Status:[['L  2\nT  #Ret_Val', 'L  1\nT  #Ret_Val']] } });
defBug({ id:'as15_durch', task:'ap15_final', title:'Der Block kommt nie an', symptom:'Der Block ist längst durch, aber das Gerüst walzt weiter.', bug:{ Main:[['Block_durch := "Block_durch"', 'Block_durch := FALSE']] } });
})();
