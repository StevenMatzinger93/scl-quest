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
})();
