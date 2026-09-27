/* ============================================================
   PIKETTDIENST — FUP Quest, Stellwerk „Brünigkreuz“ (docs/PIKETT_KONZEPT.md, Plan B.4)
   Hardware-Störungen (force: Eingang hängt fest) und Bedienfehler (param: falscher Wert am HMI).
   Programm-Störungen kommen automatisch aus bugs.js (SPSQPikett.fromBugs).
   Alarmnummern: Hardware 3501–3799, Bedienung 3801–3899.
   ============================================================ */
(function(){
"use strict";

/* ---------- Hardware ---------- */
defIncident({ id:'pk_fup_hw_gleis1_f1', quest:'fup', chapter:1, kind:'hardware', base:'f1_und',
  force:{ Gleis1_frei:false }, part:'Gleis1_frei', cause:'hw_sensor',
  alarm:{ no:'3501', prio:2, text:'Gleis 1: Gleisfreimeldung meldet besetzt, Signal A bleibt auf Halt' },
  hints:['Beobachte die Freimeldung von Gleis 1, während kein Zug im Gleis steht.', 'Die Taste kommt an, das Signal geht trotzdem nicht auf Fahrt. Das Gleis ist laut Sichtkontrolle frei.'] });

defIncident({ id:'pk_fup_hw_einschalt_f1', quest:'fup', chapter:1, kind:'hardware', base:'f1_bue',
  force:{ Zug_meldet:false }, part:'Zug_meldet', cause:'hw_sensor',
  alarm:{ no:'3502', prio:1, text:'Bahnübergang: Zug angekündigt, Schranke schliesst nicht' },
  hints:['Beobachte den Einschaltkontakt, während ein Zug vorbeifährt.', 'Der Zug überfährt den Kontakt, die Steuerung bekommt davon nichts mit.'] });

defIncident({ id:'pk_fup_hw_notaus_f2', quest:'fup', chapter:2, kind:'hardware', base:'f2_boss',
  force:{ Not_Aus_OK:false }, part:'Not_Aus_OK', cause:'hw_estop',
  alarm:{ no:'3503', prio:1, text:'Stelltisch: Not-Aus-Kreis offen, Sammelmelder rot' },
  hints:['Beobachte die Eingänge des roten Sammelmelders.', 'Es liegt keine Störung an und niemand hat den Not-Aus gedrückt. Welcher Kreis meldet trotzdem „nicht in Ordnung“?'] });

defIncident({ id:'pk_fup_hw_w1_links_f2', quest:'fup', chapter:2, kind:'hardware', base:'f2_lagemelder',
  force:{ W1_links:true }, part:'W1_links', cause:'hw_sensor',
  alarm:{ no:'3504', prio:2, text:'Weiche 1: Lagemeldung widersprüchlich, Warnlampe gelb' },
  hints:['Beobachte beide Endlagenmelder von Weiche 1, während die Weiche umläuft.', 'Die Weiche liegt rechts, die Steuerung sieht zusätzlich eine andere Endlage. Ein Melder fällt nie ab.'] });

defIncident({ id:'pk_fup_hw_w1_antrieb_f3', quest:'fup', chapter:3, kind:'hardware', base:'f3_selbst',
  force:{ W1_Endlage_rechts:false }, part:'W1_Endlage_rechts', cause:'hw_actuator',
  alarm:{ no:'3505', prio:2, text:'Weiche 1: Umstellung nach rechts ohne Endlage' },
  hints:['Beobachte den Stellbefehl und die Endlage von Weiche 1.', 'Der Befehl „nach rechts“ steht an und fällt nie ab. Erreicht die Weiche ihre Endlage überhaupt?'] });

defIncident({ id:'pk_fup_hw_schranke_unten_f3', quest:'fup', chapter:3, kind:'hardware', base:'f3_schranke',
  force:{ Unten:false }, part:'Unten', cause:'hw_wire',
  alarm:{ no:'3506', prio:1, text:'Bahnübergang: Schrankenbaum unten, Endlage fehlt' },
  hints:['Beobachte die Endlagen der Schranke, während sie gesenkt wird.', 'Der Baum liegt sichtbar unten, der Antrieb bekommt aber weiter den Befehl „Senken“. Prüfe die Leitung vom Endschalter.'] });

defIncident({ id:'pk_fup_hw_achse_f5', quest:'fup', chapter:5, kind:'hardware', base:'f5_achse',
  force:{ Achse:false }, part:'Achse', cause:'hw_sensor',
  alarm:{ no:'3507', prio:2, text:'Zählpunkt: keine Achsen gezählt' },
  hints:['Beobachte den Achszählpunkt, während ein Zug darüber fährt.', 'Der Zähler bleibt bei 0. Kommt vom Radsensor überhaupt ein Signal?'] });

defIncident({ id:'pk_fup_hw_bue_belegt_f6', quest:'fup', chapter:6, kind:'hardware', base:'f6_tof',
  force:{ Zug_im_BUE:true }, part:'Zug_im_BUE', cause:'hw_sensor',
  alarm:{ no:'3508', prio:2, text:'Bahnübergang bleibt geschlossen, kein Zug im Bereich' },
  hints:['Beobachte die Belegtmeldung des Bahnübergangs nach der Durchfahrt.', 'Der Nachlauf startet nie, weil die Meldung nicht abfällt. Der Übergang ist laut Streckenposten frei.'] });

defIncident({ id:'pk_fup_hw_w1_klemmt_f7', quest:'fup', chapter:7, kind:'hardware', base:'f7_laufzeit',
  force:{ W1_laeuft:true }, part:'W1_laeuft', cause:'hw_actuator',
  alarm:{ no:'3509', prio:2, text:'Weiche 1: Laufzeit überschritten, Störung nicht quittierbar' },
  hints:['Beobachte die Laufmeldung von Weiche 1 und die Laufzeitüberwachung.', 'Die Weiche kommt nie zur Ruhe, darum lässt sich die Störung nicht quittieren. Ein Hindernis oder ein defekter Antrieb?'] });

defIncident({ id:'pk_fup_hw_achse_aus_f8', quest:'fup', chapter:8, kind:'hardware', base:'f8_achszaehler',
  force:{ Achse_aus:false }, part:'Achse_aus', cause:'hw_sensor',
  alarm:{ no:'3510', prio:2, text:'Achszählabschnitt bleibt besetzt nach Ausfahrt' },
  hints:['Beobachte beide Zählpunkte des Abschnitts während einer Zugfahrt.', 'Eingezählt wird, ausgezählt nicht. Welcher Zählpunkt schweigt?'] });

defIncident({ id:'pk_fup_hw_tempo_f9', quest:'fup', chapter:9, kind:'hardware', base:'f9_tempo',
  force:{ Tempo:0 }, part:'Tempo', cause:'hw_sensor',
  alarm:{ no:'3511', prio:1, text:'Geschwindigkeitsmessung: Wert bleibt 0, keine Warnung bei Überschreitung' },
  hints:['Beobachte den Messwert der Geschwindigkeit, während ein Zug einfährt.', 'Der Vergleich ist in Ordnung, aber der Messwert ändert sich nie.'] });

defIncident({ id:'pk_fup_hw_schranke_f10', quest:'fup', chapter:10, kind:'hardware', base:'f10_sichern',
  force:{ Schranke_unten:false }, part:'Schranke_unten', cause:'hw_wire',
  alarm:{ no:'3512', prio:2, text:'Fahrstrasse nicht gesichert: Schranke unten nicht gemeldet' },
  hints:['Beobachte die Bedingungen für das Sichern der Fahrstrasse.', 'Weiche und Gleis melden richtig. Die Schranke ist sichtbar zu, die Meldung dazu bleibt 0.'] });

defIncident({ id:'pk_fup_hw_gleis1_fp11', quest:'fup', chapter:11, kind:'hardware', base:'fp11_aufruf',
  force:{ Gleis1_frei:false }, part:'Gleis1_frei', cause:'hw_sensor',
  alarm:{ no:'3513', prio:2, text:'Signal A: keine Fahrt, Gleis 1 dauernd besetzt gemeldet' },
  hints:['Beobachte die Werte an der Aufruf-Box von "FC_Signal".', 'Die Funktion arbeitet richtig. Einer ihrer Eingänge kommt aus dem Feld immer mit 0.'] });

defIncident({ id:'pk_fup_hw_w1_end_r_fp12', quest:'fup', chapter:12, kind:'hardware', base:'fp12_weiche',
  force:{ W1_End_R:false }, part:'W1_End_R', cause:'hw_wire',
  alarm:{ no:'3514', prio:2, text:'Weichenbaustein W1: Stellbefehl rechts steht dauernd an' },
  hints:['Beobachte die Instanzdaten von "FB_Weiche_DB" während der Umstellung.', 'Die Weiche liegt laut Streckenbegehung rechts. Die Endlagenmeldung kommt trotzdem nicht in der Steuerung an.'] });

defIncident({ id:'pk_fup_hw_abschnitt4_fp13', quest:'fup', chapter:13, kind:'hardware', base:'fp13_array',
  force:{ 'DB_Gleis.Besetzt[4]':true }, part:'DB_Gleis.Besetzt[4]', cause:'hw_sensor',
  alarm:{ no:'3515', prio:2, text:'Strecke nicht frei: ein Gleisabschnitt meldet dauernd besetzt' },
  hints:['Beobachte die Belegtmeldungen der vier Gleisabschnitte.', 'Der rote Melder geht nie aus. Welcher Abschnitt meldet besetzt, obwohl kein Zug dort steht?'] });

defIncident({ id:'pk_fup_hw_bue_fp14', quest:'fup', chapter:14, kind:'hardware', base:'fp14_bue',
  force:{ Zug_meldet:false }, part:'Zug_meldet', cause:'hw_sensor',
  alarm:{ no:'3516', prio:1, text:'Bahnübergang: Blinklicht und Schranke ohne Anforderung' },
  hints:['Beobachte die Anforderung am Bahnübergangsbaustein, während ein Zug naht.', 'Der Baustein arbeitet, wenn er angefordert wird. Das Signal vom Einschaltkontakt kommt nie an.'] });

defIncident({ id:'pk_fup_hw_weiche_fp15', quest:'fup', chapter:15, kind:'hardware', base:'fp15_final',
  force:{ Weiche_Endlage:false }, part:'Weiche_Endlage', cause:'hw_actuator',
  alarm:{ no:'3517', prio:2, text:'Fahrstrasse wird nicht gesichert: Weiche ohne Endlage' },
  hints:['Beobachte die Eingänge des Fahrstrassenbausteins nach dem Stellen.', 'Die Weiche wird gestellt, erreicht aber ihre Endlage nicht. Der Antrieb ist verdächtig.'] });

/* ---------- Bedienung ---------- */
defIncident({ id:'pk_fup_op_hand_f2', quest:'fup', chapter:2, kind:'operator', base:'f2_boss',
  param:{ var:'Automatik', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'3801', prio:2, text:'Signal A stellt nicht selbsttätig auf Fahrt' },
  hints:['Beobachte die Betriebsart am Stelltisch.', 'Ohne Tastendruck geht das Signal nur in einer bestimmten Betriebsart auf Fahrt. Ist sie eingestellt?'] });

defIncident({ id:'pk_fup_op_fahrplan_f9', quest:'fup', chapter:9, kind:'operator', base:'f9_verspaetung',
  param:{ var:'Soll_min', wrong:590, right:600 }, cause:'op_mode',
  alarm:{ no:'3802', prio:3, text:'Verspätungsanzeige unplausibel: Fahrplanzeit am HMI prüfen' },
  hints:['Beobachte Ist- und Sollzeit in der Verspätungsberechnung.', 'Die Rechnung stimmt, aber die eingegebene Fahrplanzeit weicht vom Fahrplan ab.'] });

defIncident({ id:'pk_fup_op_hand_f10', quest:'fup', chapter:10, kind:'operator', base:'f10_final',
  param:{ var:'Automatik', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'3803', prio:2, text:'Fahrstrasse wird bei Zugmeldung nicht eingestellt' },
  hints:['Beobachte die Betriebsart, wenn sich ein Zug meldet.', 'Das Stellwerk wartet auf einen Tastendruck, obwohl der Betrieb selbsttätig laufen sollte.'] });

defIncident({ id:'pk_fup_op_quit_fp12', quest:'fup', chapter:12, kind:'operator', base:'fp12_boss',
  param:{ var:'Quittieren', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'3804', prio:2, text:'Weiche 1 gesperrt: Weichenstörung am Stelltisch nicht quittiert' },
  hints:['Beobachte den Störungsspeicher des Weichenbausteins, nachdem die Ursache behoben ist.', 'Der Baustein hält die Störung fest, bis am Stelltisch eine bestimmte Bedienhandlung erfolgt.'] });
})();
