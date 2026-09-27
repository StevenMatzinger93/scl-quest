/* ============================================================
   PIKETTDIENST — KOP Quest, Seilbahn „Gratbahn“ (docs/PIKETT_KONZEPT.md, Plan B.4)
   Hardware-Störungen (force: Eingang hängt fest) und Bedienfehler (param: falscher Wert am HMI).
   Programm-Störungen kommen automatisch aus bugs.js (SPSQPikett.fromBugs).
   Alarmnummern: Hardware 2501–2799, Bedienung 2801–2899.
   ============================================================ */
(function(){
"use strict";

/* ---------- Hardware ---------- */
defIncident({ id:'pk_kop_hw_nothalt_k1', quest:'kop', chapter:1, kind:'hardware', base:'k1_antrieb',
  force:{ Not_Halt_OK:false }, part:'Not_Halt_OK', cause:'hw_estop',
  alarm:{ no:'2501', prio:1, text:'Talstation: Not-Halt-Kreis unterbrochen, Antrieb gesperrt' },
  hints:['Beobachte die Eingänge der Antriebsfreigabe, während der Start gedrückt wird.', 'Tür und Starttaster melden sauber. Welches Signal der Sicherheitskette bleibt dauernd auf 0?'] });

defIncident({ id:'pk_kop_hw_windwaechter_k2', quest:'kop', chapter:2, kind:'hardware', base:'k2_warnung',
  force:{ Wind_hoch:true }, part:'Wind_hoch', cause:'hw_sensor',
  alarm:{ no:'2502', prio:3, text:'Windwarnung steht dauernd an, Wetterstation meldet ruhigen Wind' },
  hints:['Beobachte die Eingänge der Windwarnung bei ruhigem Wetter.', 'Die Warnung leuchtet auch ohne Gewitter. Ein Eingang meldet 1, obwohl draussen kein Wind weht.'] });

defIncident({ id:'pk_kop_hw_tuerkontakt_k3', quest:'kop', chapter:3, kind:'hardware', base:'k3_boss',
  force:{ Tuer_Zu:false }, part:'Tuer_Zu', cause:'hw_sensor',
  alarm:{ no:'2503', prio:1, text:'Kabine: Türkontakt meldet offen, Fahrt nicht möglich' },
  hints:['Beobachte den Türkontakt, während die Türen geschlossen sind.', 'Die Türen sind mechanisch zu, die Steuerung sieht das aber nie. Welcher Eingang wechselt nicht auf 1?'] });

defIncident({ id:'pk_kop_hw_seillage_k4', quest:'kop', chapter:4, kind:'hardware', base:'k4_stoerung',
  force:{ Seil_Fehler:true }, part:'Seil_Fehler', cause:'hw_sensor',
  alarm:{ no:'2504', prio:1, text:'Seillageüberwachung: Störung lässt sich nicht quittieren' },
  hints:['Beobachte die Störmeldung, während du quittierst.', 'Das Quittieren wirkt, aber die Störung kommt sofort zurück. Das Seil liegt laut Kontrollgang richtig in den Rollen.'] });

defIncident({ id:'pk_kop_hw_drehkreuz_k5', quest:'kop', chapter:5, kind:'hardware', base:'k5_zaehlen',
  force:{ Drehkreuz:false }, part:'Drehkreuz', cause:'hw_sensor',
  alarm:{ no:'2505', prio:3, text:'Fahrgastzählung: Drehkreuz zählt nicht mehr' },
  hints:['Beobachte den Drehkreuz-Eingang, während Fahrgäste durchgehen.', 'Der Zähler bleibt stehen, obwohl sich das Drehkreuz dreht. Kommt der Impuls überhaupt an?'] });

defIncident({ id:'pk_kop_hw_kabine_da_k6', quest:'kop', chapter:6, kind:'hardware', base:'k6_ton',
  force:{ Kabine_da:false }, part:'Kabine_da', cause:'hw_sensor',
  alarm:{ no:'2506', prio:2, text:'Bergstation: Kabine eingefahren, Türen öffnen nicht' },
  hints:['Beobachte die Einfahrmeldung, während die Kabine in der Station steht.', 'Der Timer startet nie. Welcher Eingang müsste ihn anstossen, bleibt aber auf 0?'] });

defIncident({ id:'pk_kop_hw_seilgeber_k7', quest:'kop', chapter:7, kind:'hardware', base:'k7_seil',
  force:{ Seil_bewegt:false }, part:'Seil_bewegt', cause:'hw_wire',
  alarm:{ no:'2507', prio:1, text:'Seil blockiert gemeldet, Seil läuft laut Maschinist normal' },
  hints:['Beobachte die Bewegungsmeldung des Seils, während der Antrieb läuft.', 'Der Antrieb dreht, das Seil bewegt sich sichtbar, der Eingang bleibt aber dauernd 0. Prüfe die Leitung zum Geber.'] });

defIncident({ id:'pk_kop_hw_tuerantrieb_k7', quest:'kop', chapter:7, kind:'hardware', base:'k7_ueberwachung',
  force:{ Tuer_Zu:false }, part:'Tuer_Zu', cause:'hw_actuator',
  alarm:{ no:'2508', prio:2, text:'Türüberwachung: Tür schliesst nicht innerhalb 4 s' },
  hints:['Beobachte den Schliessbefehl und die Endlage der Tür.', 'Der Befehl zum Schliessen kommt, die Rückmeldung „zu“ bleibt aus. Arbeitet der Türantrieb überhaupt?'] });

defIncident({ id:'pk_kop_hw_drehkreuz_k8', quest:'kop', chapter:8, kind:'hardware', base:'k8_ctu',
  force:{ Drehkreuz:true }, part:'Drehkreuz', cause:'hw_sensor',
  alarm:{ no:'2509', prio:3, text:'Kabinenbelegung: Zähler steht, Drehkreuz meldet dauernd' },
  hints:['Beobachte den Drehkreuz-Eingang zwischen zwei Fahrgästen.', 'Der Zähler braucht einen Wechsel von 0 auf 1. Der Eingang fällt nach dem Durchgang nicht mehr ab.'] });

defIncident({ id:'pk_kop_hw_anemometer_k9', quest:'kop', chapter:9, kind:'hardware', base:'k9_wind',
  force:{ Wind_kmh:0 }, part:'Wind_kmh', cause:'hw_sensor',
  alarm:{ no:'2510', prio:1, text:'Windmesser Mast 4: Messwert unplausibel, Windwarnung fehlt' },
  hints:['Beobachte den Windmesswert, während die Böen zunehmen.', 'Der Wert bewegt sich nicht, egal wie stark der Wind ist. Ein vereistes Schalenkreuz liefert immer denselben Wert.'] });

defIncident({ id:'pk_kop_hw_ankunft_k10', quest:'kop', chapter:10, kind:'hardware', base:'k10_zwei_schritte',
  force:{ Ankunft:false }, part:'Ankunft', cause:'hw_sensor',
  alarm:{ no:'2511', prio:2, text:'Schrittkette hängt in „Fahrt“, Kabine steht in der Station' },
  hints:['Beobachte den Übergang von „Fahrt“ zurück nach „Einsteigen“.', 'Die Kabine ist angekommen, der Übergang schaltet nicht weiter. Welche Meldung fehlt ihm?'] });

defIncident({ id:'pk_kop_hw_seil_ok_k11', quest:'kop', chapter:11, kind:'hardware', base:'k11_boss',
  force:{ Seil_OK:false }, part:'Seil_OK', cause:'hw_wire',
  alarm:{ no:'2512', prio:1, text:'Talstation: Freigabe fehlt, Seilüberwachung meldet Fehler' },
  hints:['Beobachte die Eingänge der Stationsfunktion beim Aufruf in Main.', 'Tür, Not-Halt und Wind sind in Ordnung. Ein Glied meldet 0, obwohl das Seil laut Kontrolle korrekt liegt – die Leitung könnte unterbrochen sein.'] });

defIncident({ id:'pk_kop_hw_kette_k12', quest:'kop', chapter:12, kind:'hardware', base:'k12_boss',
  force:{ Kette_OK:false }, part:'Kette_OK', cause:'hw_estop',
  alarm:{ no:'2513', prio:1, text:'Antrieb startet nicht: Sicherheitskette offen' },
  hints:['Beobachte die Freigabe am Antriebsbaustein, während gestartet wird.', 'Der Baustein reagiert richtig auf den Start. Die Freigabe von aussen fehlt dauernd.'] });

defIncident({ id:'pk_kop_hw_platz4_k13', quest:'kop', chapter:13, kind:'hardware', base:'k13_array',
  force:{ 'DB_Bahnsteig.Besetzt[4]':true }, part:'DB_Bahnsteig.Besetzt[4]', cause:'hw_sensor',
  alarm:{ no:'2514', prio:3, text:'Bahnsteig: Wartezone meldet besetzt, obwohl leer' },
  hints:['Beobachte die Belegungsmeldungen der vier Wartezonen.', 'Die gelbe Ampel geht nie aus, auch wenn der Bahnsteig leer ist. Eine Zone meldet dauernd 1.'] });

defIncident({ id:'pk_kop_hw_kabine_da_k14', quest:'kop', chapter:14, kind:'hardware', base:'k14_tuer',
  force:{ Kabine_da:false }, part:'Kabine_da', cause:'hw_sensor',
  alarm:{ no:'2515', prio:2, text:'Türbaustein: Tür öffnet nicht, Kabine steht am Bahnsteig' },
  hints:['Beobachte die Freigabe des Türbausteins, während die Kabine in der Station steht.', 'Der Türtaster kommt an, die Freigabe fehlt. Welcher Eingang meldet die Kabine nicht?'] });

defIncident({ id:'pk_kop_hw_ankunft_k15', quest:'kop', chapter:15, kind:'hardware', base:'k15_final',
  force:{ Ankunft:false }, part:'Ankunft', cause:'hw_sensor',
  alarm:{ no:'2516', prio:2, text:'Ablauf: Kabine angekommen, Schrittkette schaltet nicht weiter' },
  hints:['Beobachte die Eingänge des Ablaufbausteins bei der Einfahrt.', 'Die Kabine steht in der Station, der Ablauf wartet weiter. Eine Meldung erreicht die Steuerung nicht.'] });

/* ---------- Bedienung ---------- */
defIncident({ id:'pk_kop_op_quit_k7', quest:'kop', chapter:7, kind:'operator', base:'k7_wind',
  param:{ var:'Quittieren', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'2801', prio:2, text:'Fahrt gesperrt: Sturmabschaltung nicht quittiert' },
  hints:['Beobachte die Sturmabschaltung, nachdem der Wind nachgelassen hat.', 'Das Programm gibt erst nach einer Bedienhandlung frei. Wurde sie am Bedienpult ausgeführt?'] });

defIncident({ id:'pk_kop_op_windgrenze_k13', quest:'kop', chapter:13, kind:'operator', base:'k13_parameter',
  param:{ var:'DB_Parameter.Wind_Grenze', wrong:80, right:50 }, cause:'op_mode',
  alarm:{ no:'2802', prio:1, text:'Windabschaltung spricht nicht an: Grenzwert am HMI prüfen' },
  hints:['Beobachte die Grenzwerte im Parameter-DB, während der Wind zunimmt.', 'Das Programm vergleicht korrekt. Der eingestellte Abschaltwert passt nicht zur Betriebsvorschrift.'] });

defIncident({ id:'pk_kop_op_windwarnung_k13', quest:'kop', chapter:13, kind:'operator', base:'k13_parameter',
  param:{ var:'DB_Parameter.Wind_Warnung', wrong:60, right:30 }, cause:'op_mode',
  alarm:{ no:'2803', prio:3, text:'Windwarnung kommt zu spät: Warngrenze am HMI prüfen' },
  hints:['Beobachte die Windwarnung und die Werte im Parameter-DB.', 'Die Warnung erscheint erst kurz vor der Abschaltung. Die Warngrenze wurde am HMI verstellt.'] });

defIncident({ id:'pk_kop_op_quit_k14', quest:'kop', chapter:14, kind:'operator', base:'k14_kette',
  param:{ var:'Quittieren', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'2804', prio:1, text:'Sicherheitskette geschlossen, Freigabe fehlt: Quittierung ausstehend' },
  hints:['Beobachte den Kettenbaustein, nachdem alle Glieder wieder geschlossen sind.', 'Der Baustein speichert jede Unterbrechung. Was muss am Bedienpult geschehen, damit er wieder freigibt?'] });
})();
