/* ===== FUP QUEST · STÖRUNGSJAGD — Fehlerszenarien für die Live-Challenge (mind. 2 pro Kapitel) =====
   bug: [[Text aus der Musterlösung, Fehlerversion]] — ersetzt die erste Fundstelle im Netzwerktext;
   Profi-Aufgaben: { Baustein: [[aus, zu]] }. Der Validator prüft: Fehlerversion übersetzt, scheitert aber an den Tests. */
(function(){
// Kapitel 1
defBug({ id:'fs1_gleis', task:'f1_und', title:'Fahrt ins besetzte Gleis', symptom:'Signal A zeigt Fahrt, obwohl auf Gleis 1 ein Wagen steht.', bug:[['Taste_A AND Gleis1_frei', 'Taste_A']] });
defBug({ id:'fs1_schranke', task:'f1_boss', title:'Ausfahrt vor offener Schranke', symptom:'Signal B zeigt Fahrt, während die Schranke noch oben ist.', bug:[['Taste_B AND Ausfahrt_frei AND Schranke_unten', 'Taste_B AND Ausfahrt_frei']] });
// Kapitel 2
defBug({ id:'fs2_lage', task:'f2_xor', title:'Die Weiche in der Mitte', symptom:'Die Weiche meldet „Lage OK“, obwohl beide Endlagen gleichzeitig melden.', bug:[['W1_links XOR W1_rechts', 'W1_links OR W1_rechts']] });
defBug({ id:'fs2_richtung', task:'f2_bue', title:'Zug von rechts ohne Schranke', symptom:'Kommt ein Zug von rechts, bleibt die Schranke offen.', bug:[['Zug_links OR Zug_rechts', 'Zug_links']] });
// Kapitel 3
defBug({ id:'fs3_halt', task:'f3_signal_halt', title:'Das Signal bleibt stehen', symptom:'Signal A zeigt weiter Fahrt, nachdem der Zug ins Gleis eingefahren ist.', bug:[[' AND NOT Gleis1_besetzt', '']] });
defBug({ id:'fs3_riegel', task:'f3_boss', title:'Signal über laufende Weiche', symptom:'Während Weiche 1 umläuft, zeigt Signal A Fahrt.', bug:[['AND NOT W1_nach_links AND NOT W1_nach_rechts => Signal_A', '=> Signal_A']] });
// Kapitel 4
defBug({ id:'fs4_rs', task:'f4_rs', title:'Quittieren trotz Klemmen', symptom:'Die Weichenstörung lässt sich wegquittieren, obwohl die Weiche noch klemmt.', bug:[['RS(Stoerung, Quittieren)', 'SR(Stoerung, Quittieren)']] });
defBug({ id:'fs4_sperre', task:'f4_boss', title:'Fahrstrasse trotz Störung', symptom:'Bei einer Weichenstörung lässt sich trotzdem eine Fahrstrasse einstellen.', bug:[['Taste_FS AND NOT Stoerung => SR', 'Taste_FS => SR']] });
// Kapitel 5
defBug({ id:'fs5_achsen', task:'f5_achse', title:'Der rasende Achszähler', symptom:'Ein vierachsiger Wagen wird als 200 Achsen gezählt.', bug:[['P(Achse)', 'Achse']] });
defBug({ id:'fs5_schranke', task:'f5_n', title:'Schranke öffnet mitten im Zug', symptom:'Die Schranke geht auf, sobald die Lok den Ausschaltkontakt erreicht.', bug:[['N(Ausschaltkontakt)', 'P(Ausschaltkontakt)']] });
// Kapitel 6
defBug({ id:'fs6_vorlauf', task:'f6_ton', title:'Keine Vorwarnung', symptom:'Die Schranke senkt sich im selben Moment, in dem das Blinklicht angeht.', bug:[['T#3S', 'T#100MS']] });
defBug({ id:'fs6_glocke', task:'f6_tp', title:'Die Dauerglocke', symptom:'Die Glocke läutet, solange der Zug meldet — minutenlang.', bug:[['Zug_meldet AND TP(T_Glocke, T#2S) => Glocke', 'Zug_meldet => Glocke']] });
// Kapitel 7
defBug({ id:'fs7_ueber', task:'f7_laufzeit', title:'Die geduldige Überwachung', symptom:'Eine klemmende Weiche wird erst nach einer Minute gemeldet.', bug:[['T#6S', 'T#60S']] });
defBug({ id:'fs7_wechsel', task:'f7_wechsel', title:'Gleichtakt statt Wechseltakt', symptom:'Beide Lampen am Andreaskreuz blinken gleichzeitig.', bug:[['Zug_meldet AND NOT Blink => Lampe_rechts', 'Zug_meldet AND Blink => Lampe_rechts']] });
// Kapitel 8
defBug({ id:'fs8_pv', task:'f8_ctu', title:'Zu früh komplett', symptom:'Der Zug gilt als komplett, während noch Wagen auf dem Übergang stehen.', bug:[['PV:=8', 'PV:=6']] });
defBug({ id:'fs8_achs', task:'f8_achszaehler', title:'Frei trotz Wagen', symptom:'Der Abschnitt wird frei gemeldet, obwohl noch Achsen darin stehen.', bug:[['[Z_Ein.CV <> Z_Aus.CV]', '[Z_Ein.CV < Z_Aus.CV]']] });
// Kapitel 9
defBug({ id:'fs9_tempo', task:'f9_tempo_move', title:'120 über die Weiche', symptom:'Über die abzweigende Weiche wird bei 70 km/h nicht gewarnt.', bug:[['W1_rechts => MOVE(40, V_zul)', 'W1_rechts => MOVE(80, V_zul)']] });
defBug({ id:'fs9_laenge', task:'f9_zuglaenge', title:'Zu langer Zug für Gleis 2', symptom:'Ein 18-achsiger Zug wird nach Gleis 2 geschickt, wo er nicht hineinpasst.', bug:[['[Laenge_m <= 120]', '[Laenge_m <= 130]']] });
// Kapitel 10
defBug({ id:'fs10_sichern', task:'f10_final', title:'Fahrt vor geschlossener Schranke', symptom:'Signal A zeigt Fahrt, obwohl die Schranke noch nicht unten ist.', bug:[['W1_Endlage_links AND Schranke_unten AND Gleis1_frei', 'W1_Endlage_links AND Gleis1_frei']] });
defBug({ id:'fs10_feind', task:'f10_feind', title:'Zwei Wege zugleich', symptom:'Die Fahrstrassen nach Gleis 1 und Gleis 2 lassen sich gleichzeitig einstellen.', bug:[['Taste_FS2 AND NOT FS1 =>', 'Taste_FS2 =>']] });
defBug({ id:'fs10_aufl', task:'f10_aufloesen', title:'Die ewige Fahrstrasse', symptom:'Nach der Zugfahrt bleibt die Fahrstrasse eingestellt.', bug:[['N(Einfahrt_besetzt)', 'P(Einfahrt_besetzt)']] });
// Kapitel 11
defBug({ id:'fs11_endlage', task:'fp11_erste_fc', title:'Fahrt über die laufende Weiche', symptom:'Signal A zeigt Fahrt, obwohl Weiche 1 noch keine Endlage meldet.', bug:{ FC_Signal:[['#Taste AND #Gleis_frei AND #Weiche_Endlage', '#Taste AND #Gleis_frei']] } });
defBug({ id:'fs11_laenge', task:'fp11_retval', title:'Der geschrumpfte Zug', symptom:'Die Zuglänge auf dem Stelltisch ist deutlich kürzer als der Zug, der vorbeifährt.', bug:{ FC_Laenge:[['MUL(#Achsen, 7', 'MUL(#Achsen, 5']] } });
defBug({ id:'fs11_schranke', task:'fp11_boss', title:'Das Signal bleibt rot', symptom:'Frau Gasser drückt die Fahrtaste, aber Signal A bleibt auf Halt — die Schranke senkt sich nur, wenn sich ein Zug meldet.', bug:{ FC_Einfahrt:[['#Zug_meldet OR #Taste_A => #Schranke_zu', '#Zug_meldet => #Schranke_zu']] } });
// Kapitel 12
defBug({ id:'fs12_endlage', task:'fp12_weiche', title:'Die Weiche, die nicht anhält', symptom:'Weiche 1 erreicht die linke Endlage, aber der Antrieb läuft weiter und drückt gegen den Anschlag.', bug:{ FB_Weiche:[['AND NOT #End_L AND NOT #nach_R', 'AND NOT #nach_R']] } });
defBug({ id:'fs12_vorlauf', task:'fp12_timer', title:'Die überhastete Schranke', symptom:'Die Schranke senkt sich, kaum dass das Blinklicht angeht.', bug:{ FB_Schranke:[['T#3S', 'T#300MS']] } });
defBug({ id:'fs12_quit', task:'fp12_stoerung', title:'Wegquittierte Störung', symptom:'Die Störmeldung verschwindet beim Quittieren, obwohl der Fehler noch ansteht.', bug:{ FB_Stoerung:[['RS(#Meldung, #Quittieren)', 'SR(#Meldung, #Quittieren)']] } });
// Kapitel 13
defBug({ id:'fs13_max', task:'fp13_db', title:'Das Tagesmaximum bleibt leer', symptom:'Die Statistik meldet als höchste Geschwindigkeit immer 0 km/h.', bug:{ Main:[['["Tempo" > "DB_Statistik".Tempo_max]', '["Tempo" < "DB_Statistik".Tempo_max]']] } });
defBug({ id:'fs13_param', task:'fp13_parameter', title:'Volle Fahrt im Abzweig', symptom:'Über die abzweigende Weiche gilt dieselbe Geschwindigkeit wie geradeaus.', bug:{ Main:[['V_abzweig := "DB_Parameter".V_abzweig', 'V_abzweig := "DB_Parameter".V_gerade']] } });
defBug({ id:'fs13_gestoert', task:'fp13_struct_param', title:'Befahrbar trotz Störung', symptom:'Weiche 1 wird als befahrbar gemeldet, obwohl ihre Störung ansteht.', bug:{ FC_Weiche_OK:[[' AND NOT #W.Gestoert =>', ' =>']] } });
// Kapitel 14
defBug({ id:'fs14_stoerung', task:'fp14_signal', title:'Fahrt trotz Störung', symptom:'Das Signal bleibt auf Fahrt, obwohl eine Störung gemeldet wird.', bug:{ FB_Signal:[[' AND NOT #Stoerung =>', ' =>']] } });
defBug({ id:'fs14_glocke', task:'fp14_bue', title:'Die Glocke, die nicht aufhört', symptom:'Die Glocke am Bahnübergang läutet und läutet, bis die Anwohner anrufen.', bug:{ FB_BUE:[['TP(#T_Glocke, T#2S)', 'TP(#T_Glocke, T#20S)']] } });
defBug({ id:'fs14_meldung', task:'fp14_meldung', title:'Die Lampe blinkt nicht', symptom:'Eine neue Weichenstörung leuchtet sofort dauernd — niemand sieht, dass sie neu ist.', bug:{ FB_Meldung:[['(#Gespeichert AND NOT #Neu)', '#Gespeichert']] } });
// Kapitel 15
defBug({ id:'fs15_anlauf', task:'fp15_anlauf', title:'Der Zähler von gestern', symptom:'Nach einem Neustart zeigt das Stellwerk noch die Züge vom Vortag.', bug:{ Startup:[['=> MOVE(0, "DB_Stellwerk".Zuege);', '=> MOVE(0, "Anzeige");']] } });
defBug({ id:'fs15_status', task:'fp15_status', title:'Störung als Fahrt', symptom:'Die Leitstelle sieht bei einer Störung den Status „Fahrt“.', bug:{ FC_Status:[['#Stoerung => MOVE(2', '#Stoerung => MOVE(1']] } });
defBug({ id:'fs15_durch', task:'fp15_final', title:'Die Fahrstrasse löst nie auf', symptom:'Der Zug ist längst durch, aber die Fahrstrasse bleibt eingestellt und das Signal auf Fahrt.', bug:{ Main:[['Zug_durch := "Zug_durch"', 'Zug_durch := FALSE']] } });
})();
