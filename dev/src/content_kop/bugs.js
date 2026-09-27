/* ===== KOP QUEST · STÖRUNGSJAGD — Fehlerszenarien für die Live-Challenge (mind. 2 pro Kapitel) =====
   bug: [[Text aus der Musterlösung, Fehlerversion]] — ersetzt die erste Fundstelle im KOP-Text.
   Der Validator prüft: Fehlerversion übersetzt, scheitert aber an den Tests. */
(function(){
// Kapitel 1
defBug({ id:'ks1_sperre', task:'k1_sperre', title:'Freier Eintritt', symptom:'Die Zugangssperre öffnet für jede Person — auch ohne gültige Karte.', bug:[['Person_da AND Karte_OK', 'Person_da']] });
defBug({ id:'ks1_notaus', task:'k1_boss', title:'Abfahrt trotz Not-Halt', symptom:'Die Bahn fährt an, obwohl der Not-Halt gedrückt ist.', bug:[['AND Tuer_Zu AND Not_Halt_OK', 'AND Tuer_Zu']] });
// Kapitel 2
defBug({ id:'ks2_tuer', task:'k2_tuer', title:'Tür nur von aussen', symptom:'Die Kabinentür lässt sich aus der Kabine heraus nicht mehr öffnen.', bug:[['(S_Tuer_Station OR S_Tuer_Kabine)', 'S_Tuer_Station']] });
defBug({ id:'ks2_ampel', task:'k2_boss', title:'Grün bei offener Tür', symptom:'Die Ampel zeigt Grün, obwohl die Kabinentür offen steht.', bug:[['Kabine_da AND NOT Tuer_Offen AND Not_Halt_OK', 'Kabine_da AND Tuer_Offen AND Not_Halt_OK']] });
// Kapitel 3
defBug({ id:'ks3_haltung', task:'k3_selbst', title:'Antrieb hält nicht', symptom:'Der Antrieb läuft nur, solange der Starttaster gedrückt ist.', bug:[['(S_Start OR Antrieb)', 'S_Start']] });
defBug({ id:'ks3_richtung', task:'k3_boss', title:'Berg und Tal zugleich', symptom:'Beide Fahrtrichtungen lassen sich gleichzeitig einschalten.', bug:[[' AND NOT Fahrt_Tal => Fahrt_Berg', ' => Fahrt_Berg'], [' AND NOT Fahrt_Berg => Fahrt_Tal', ' => Fahrt_Tal']] });
// Kapitel 4
defBug({ id:'ks4_quit', task:'k4_stoerung', title:'Quittieren trotz Seilfehler', symptom:'Die Seilstörung lässt sich wegquittieren, obwohl das Seil noch aus der Rolle ist.', bug:[['Quittieren AND NOT Seil_Fehler', 'Quittieren']] });
defBug({ id:'ks4_sammel', task:'k4_sammel', title:'Stumme Windstörung', symptom:'Eine Windstörung erscheint nicht in der Sammelstörung.', bug:[['St_Wind OR St_Seil => Sammelstoerung', 'St_Seil => Sammelstoerung']] });
// Kapitel 5
defBug({ id:'ks5_zaehler', task:'k5_zaehlen', title:'Der rasende Zähler', symptom:'Pro Fahrgast springt der Zähler um Dutzende hoch.', bug:[['P(Drehkreuz)', 'Drehkreuz']] });
defBug({ id:'ks5_sperre', task:'k5_sperre', title:'Sperre schliesst zu früh', symptom:'Die Sperre schliesst schon, wenn die Person ankommt — nicht, wenn sie durch ist.', bug:[['N(Person_da)', 'P(Person_da)']] });
// Kapitel 6
defBug({ id:'ks6_bremse', task:'k6_bremse', title:'Bremse fällt sofort', symptom:'Beim Anhalten fällt die Bremse ein, während das Seil noch läuft.', bug:[['TOF(T_Bremse, T#1S)', 'TON(T_Bremse, T#1S)']] });
defBug({ id:'ks6_gong', task:'k6_boss', title:'Der Dauergong', symptom:'Der Einfahrgong hört nicht mehr auf, solange die Kabine in der Station steht.', bug:[['Kabine_da AND TP(T_Gong, T#1S) => Hupe', 'Kabine_da => Hupe']] });
// Kapitel 7
defBug({ id:'ks7_anlauf', task:'k7_anlauf', title:'Anlauf ohne Warnung', symptom:'Die Hupe tönt nur einen Augenblick, dann läuft die Bahn schon an.', bug:[['TON(T_Anlauf, T#3S)', 'TON(T_Anlauf, T#100MS)']] });
defBug({ id:'ks7_seil', task:'k7_seil', title:'Seilstörung ohne Folgen', symptom:'Die Seilüberwachung meldet eine Störung, aber der Antrieb läuft weiter.', bug:[['Seil_Stoerung => R Antrieb', 'Seil_Stoerung => R Seil_bewegt']] });
// Kapitel 8
defBug({ id:'ks8_voll', task:'k8_sperre', title:'Überfüllte Kabine', symptom:'Die Sperre lässt auch den neunten und zehnten Gast noch durch.', bug:[['Karte_OK AND NOT Kabine_voll', 'Karte_OK']] });
defBug({ id:'ks8_reset', task:'k8_boss', title:'Zähler vergisst nie', symptom:'Nach der Abfahrt zählt der Gästezähler einfach weiter statt bei 0 zu beginnen.', bug:[['R:=Abfahrt', 'R:=Wartung_OK']] });
// Kapitel 9
defBug({ id:'ks9_grenze', task:'k9_bereich', title:'Die Lücke bei 60', symptom:'Bei genau 60 km/h leuchtet weder Gelb noch Rot.', bug:[['[Wind_kmh <= 60]', '[Wind_kmh < 60]']] });
defBug({ id:'ks9_statistik', task:'k9_add', title:'Explodierende Statistik', symptom:'Die Tagesstatistik zählt tausende Gäste nach wenigen Fahrten.', bug:[['P(Abfahrt)', 'Abfahrt']] });
defBug({ id:'ks9_hysterese', task:'k9_boss', title:'Freigabe ohne Quittung', symptom:'Nach einem Sturm läuft die Bahn wieder, ohne dass jemand quittiert hat.', bug:[['[Wind_kmh < 40] AND Quittieren', '[Wind_kmh < 40]']] });
// Kapitel 10
defBug({ id:'ks10_kette', task:'k10_freigabe', title:'Kette ohne Wirkung', symptom:'Die rote Lampe meldet eine offene Sicherheitskette, doch der Antrieb läuft weiter.', bug:[['AND NOT S_Stopp AND Kette_OK', 'AND NOT S_Stopp']] });
defBug({ id:'ks10_schritt', task:'k10_final', title:'Tür bleibt im Ablauf', symptom:'Während der Vorwarnung zeigt die Station noch „Einsteigen“ an.', bug:[['S Schritt_Warnen, R Schritt_Einsteigen', 'S Schritt_Warnen']] });
defBug({ id:'ks10_stoerung', task:'k10_final', title:'Sturm wird vergessen', symptom:'Nach einem Sturm während der Fahrt kann sofort wieder abgefahren werden — ohne Quittung.', bug:[['=> S Stoerung, S Schritt_Einsteigen', '=> S Schritt_Einsteigen']] });
// Kapitel 11 (Profi: Bausteine — Fehler im Baustein { Baustein: [[aus, zu]] })
defBug({ id:'ks11_notaus', task:'k11_erste_fc', title:'Freigabe ohne Not-Halt', symptom:'Die Station gibt den Antrieb frei, obwohl der Not-Halt gedrückt ist.', bug:{ FC_Freigabe:[['#Tuer_Zu AND #Seil_OK AND #Not_Halt_OK', '#Tuer_Zu AND #Seil_OK']] } });
defBug({ id:'ks11_kmh', task:'k11_retval', title:'Zu langsame Anzeige', symptom:'Die Anzeige meldet eine kleinere Seilgeschwindigkeit, als der Umrichter fährt.', bug:{ FC_Kmh:[['3.6', '3.0']] } });
defBug({ id:'ks11_sturm', task:'k11_boss', title:'Fahrt im Sturm', symptom:'Die Bahn fährt auch bei 70 km/h Wind noch los.', bug:{ FC_Station:[['[#Wind_kmh <= 60]', '[#Wind_kmh <= 80]']] } });
// Kapitel 12
defBug({ id:'ks12_haltung', task:'k12_selbsthaltung', title:'Antrieb vergisst sich', symptom:'Der Antrieb läuft nur, solange jemand den Starttaster gedrückt hält.', bug:{ FB_Antrieb:[['(#Start OR #Laeuft)', '#Start']] } });
defBug({ id:'ks12_quit', task:'k12_stoerung', title:'Wegquittierte Störung', symptom:'Die Seilstörung verschwindet beim Quittieren, obwohl der Fehler noch ansteht.', bug:{ FB_Stoerung:[['#Quittieren AND NOT #Fehler', '#Quittieren']] } });
defBug({ id:'ks12_tuer', task:'k12_timer', title:'Die hastige Tür', symptom:'Die Tür öffnet, kaum dass die Kabine einfährt.', bug:{ FB_Tuer:[['T#2S', 'T#200MS']] } });
// Kapitel 13
defBug({ id:'ks13_max', task:'k13_db_schreiben', title:'Das Tagesmaximum bleibt leer', symptom:'Die Tagesstatistik meldet als höchsten Wind immer 0 km/h.', bug:{ Main:[['["Wind_kmh" > "DB_Station".Wind_Max]', '["Wind_kmh" < "DB_Station".Wind_Max]']] } });
defBug({ id:'ks13_param', task:'k13_parameter', title:'Abschaltung schon bei 40', symptom:'Die Bahn schaltet bereits bei leichtem Wind ab.', bug:{ Main:[['Grenze := "DB_Parameter".Wind_Grenze', 'Grenze := "DB_Parameter".Wind_Warnung']] } });
defBug({ id:'ks13_array', task:'k13_array', title:'Rot bei drei Plätzen', symptom:'Die rote Lampe meldet „alle Plätze besetzt“, obwohl Platz 4 frei ist.', bug:{ Main:[[' AND "DB_Bahnsteig".Besetzt[4] =>', ' =>']] } });
// Kapitel 14
defBug({ id:'ks14_tuer', task:'k14_tuer', title:'Die schweigsame Tür', symptom:'Eine klemmende Tür wird erst nach einer halben Minute gemeldet.', bug:{ FB_Tuer:[['T#4S', 'T#40S']] } });
defBug({ id:'ks14_kette', task:'k14_kette', title:'Not-Halt ohne Meldung', symptom:'Nach einem Not-Halt läuft die Station ohne Quittieren weiter.', bug:{ FB_Kette:[['NOT #Tuer_Zu OR NOT #Seil_OK OR NOT #Not_Halt_OK OR NOT #Wind_OK', 'NOT #Tuer_Zu OR NOT #Seil_OK OR NOT #Wind_OK']] } });
defBug({ id:'ks14_bremse', task:'k14_antrieb', title:'Die ruppige Bremse', symptom:'Beim Anhalten fällt die Bremse ein, während das Seil noch deutlich läuft.', bug:{ FB_Antrieb:[['TOF(#T_Bremse, T#1S)', 'TOF(#T_Bremse, T#100MS)']] } });
// Kapitel 15
defBug({ id:'ks15_anlauf', task:'k15_anlauf', title:'Der Zähler von gestern', symptom:'Nach einem Neustart zeigt die Station noch die Fahrten vom Vortag.', bug:{ Startup:[['=> MOVE(0, "DB_Station".Fahrten);', '=> MOVE(0, "Anzeige");']] } });
defBug({ id:'ks15_status', task:'k15_status', title:'Störung als Fahrt', symptom:'Das HMI zeigt bei einer Störung den Status „Fahrt“.', bug:{ FC_Status:[['#Stoerung => MOVE(2', '#Stoerung => MOVE(1']] } });
defBug({ id:'ks15_ankunft', task:'k15_final', title:'Keine Ankunft', symptom:'Die Kabine kommt an, aber der Antrieb läuft einfach weiter.', bug:{ Main:[['Stopp := "Halt"', 'Stopp := FALSE']] } });
})();
