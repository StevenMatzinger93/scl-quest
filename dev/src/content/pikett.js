/* ===== PIKETTDIENST · SCL Quest · Roboterzelle RZ-03 =====
   Hardware- und Bedienstörungen (docs/PLAN_ZERTIFIKAT_PIKETT.md B.4, docs/PIKETT_KONZEPT.md).
   Programmstörungen entstehen automatisch aus bugs.js (SPSQPikett.fromBugs).
   Nummernkreis: Hardware 1501–1799, Bedienung 1801–1899. */
(function(){

/* ---------- Hardware ---------- */
defIncident({ id:'pk_scl_hw_ls_greifstation', quest:'scl', chapter:1, kind:'hardware', base:'c1_copy',
  force:{ Teil_Erkannt:false }, part:'Teil_Erkannt', cause:'hw_sensor',
  alarm:{ no:'1501', prio:3, text:'Greifstation: Meldelampe „Teil erkannt“ bleibt dunkel' },
  hints:['Beobachte den Eingang der Lichtschranke, während ein Werkstück in der Greifstation liegt.',
    'Das Programm reicht das Signal nur weiter. Wenn der Eingang trotz Werkstück FALSE bleibt, liegt der Fehler vor der Steuerung.'] });

defIncident({ id:'pk_scl_hw_schutztuer', quest:'scl', chapter:2, kind:'hardware', base:'c2_not',
  force:{ Tuer_Zu:false }, part:'Tuer_Zu', cause:'hw_estop',
  alarm:{ no:'1502', prio:1, text:'Sicherheitskreis: Schutztür Zelle meldet offen' },
  hints:['Beobachte den Türkontakt, während die Schutztür geschlossen ist.',
    'Die Tür ist zu, das Signal sagt etwas anderes. Prüfe den Sicherheitsschalter der Schutztür.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_scl_hw_nothalt', quest:'scl', chapter:2, kind:'hardware', base:'r2t10',
  force:{ Not_Halt_Aktiv:true }, part:'Not_Halt_Aktiv', cause:'hw_estop',
  alarm:{ no:'1503', prio:1, text:'Not-Halt ausgelöst: Zelle ohne Freigabe' },
  hints:['Beobachte alle Signale der Sicherheitskette und vergleiche sie mit dem Zustand vor Ort.',
    'Kein Not-Halt-Taster ist gedrückt, trotzdem meldet ein Eingang der Kette „aktiv“. Prüfe den Not-Halt-Kreis.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_scl_hw_tempfuehler', quest:'scl', chapter:3, kind:'hardware', base:'c3_temp',
  force:{ Temperatur:95 }, part:'Temperatur', cause:'hw_sensor',
  alarm:{ no:'1504', prio:2, text:'Übertemperatur Zelle: 95 °C gemessen' },
  hints:['Beobachte den Temperaturwert über mehrere Zyklen und vergleiche ihn mit der Hallentemperatur.',
    'Der Messwert bewegt sich überhaupt nicht mehr. Ein echter Prozesswert schwankt immer ein wenig.'],
  sceneFx:{ hornActive:true } });

defIncident({ id:'pk_scl_hw_fuellstand', quest:'scl', chapter:3, kind:'hardware', base:'c3_skal',
  force:{ Rohwert:0 }, part:'Rohwert', cause:'hw_wire',
  alarm:{ no:'1505', prio:3, text:'Materialbunker: Füllstand 0 % unplausibel' },
  hints:['Beobachte den Rohwert des Analogeingangs, während der Bunker gefüllt ist.',
    'Der Rohwert steht genau auf 0, obwohl Material im Bunker liegt. Denke an die Verbindung zwischen Messumformer und Eingangskarte.'] });

defIncident({ id:'pk_scl_hw_bandsensor', quest:'scl', chapter:4, kind:'hardware', base:'c4_ohne_else',
  force:{ Teil_Erkannt:true }, part:'Teil_Erkannt', cause:'hw_sensor',
  alarm:{ no:'1506', prio:2, text:'Band 1 steht: Greifstation meldet dauernd ein Teil' },
  hints:['Beobachte den Sensor an der Greifstation, während kein Werkstück dort liegt.',
    'Das Band hält an, weil ein Eingang dauernd TRUE liefert. Verschmutzte Optik oder ein falsch eingestellter Taster?'],
  sceneFx:{ beltRunning:false } });

defIncident({ id:'pk_scl_hw_zaehlsensor', quest:'scl', chapter:8, kind:'hardware', base:'c8_zaehlen',
  force:{ Teil_Erkannt:true }, part:'Teil_Erkannt', cause:'hw_sensor',
  alarm:{ no:'1507', prio:3, text:'Stückzähler Band 1 zählt nicht mehr' },
  hints:['Beobachte den Zählsensor, während mehrere Teile vorbeifahren.',
    'Gezählt wird nur bei einer steigenden Flanke. Wechselt das Sensorsignal überhaupt noch zwischen TRUE und FALSE?'] });

defIncident({ id:'pk_scl_hw_motor_rm', quest:'scl', chapter:9, kind:'hardware', base:'r5t5',
  force:{ Motor_Laeuft:false }, part:'Motor_Laeuft', cause:'hw_wire',
  alarm:{ no:'1508', prio:2, text:'Achsmotor: Kühllüfter läuft nicht' },
  hints:['Beobachte die Rückmeldung „Motor läuft“, während der Achsmotor dreht.',
    'Der Motor läuft sichtbar, die Steuerung sieht davon nichts. Prüfe die Leitung der Rückmeldung.'] });

defIncident({ id:'pk_scl_hw_greifer_endlage', quest:'scl', chapter:9, kind:'hardware', base:'c9_ueberwachung',
  force:{ Endlage_Zu:false }, part:'Endlage_Zu', cause:'hw_actuator',
  alarm:{ no:'1509', prio:2, text:'Greifer: Endlage ZU nicht erreicht' },
  hints:['Beobachte den Schliessbefehl und die Endlage des Greifers während eines Greifvorgangs.',
    'Der Befehl kommt, die Überwachungszeit läuft ab, die Endlage meldet nie. Schliesst der Greifer überhaupt?'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_scl_hw_greifer_zu', quest:'scl', chapter:10, kind:'hardware', base:'c10_pickplace',
  force:{ Greifer_Zu:false }, part:'Greifer_Zu', cause:'hw_actuator',
  alarm:{ no:'1510', prio:2, text:'Pick & Place steht in Schritt 1: Greifer geschlossen fehlt' },
  hints:['Beobachte die Schrittnummer und die Rückmeldungen des Greifers.',
    'Die Kette wartet in Schritt 1 auf eine Rückmeldung, die nie kommt. Welcher Aktor gehört zu diesem Schritt?'] });

defIncident({ id:'pk_scl_hw_arm_ablage', quest:'scl', chapter:10, kind:'hardware', base:'c10_pickplace',
  force:{ Arm_In_Ablage:false }, part:'Arm_In_Ablage', cause:'hw_wire',
  alarm:{ no:'1511', prio:2, text:'Pick & Place steht in Schritt 2: Arm meldet Ablage nicht' },
  hints:['Beobachte den Arm und die Endlagen, während die Kette in Schritt 2 steht.',
    'Der Arm steht sichtbar über der Ablage, der zugehörige Endschalter bleibt FALSE. Prüfe Schalter und Leitung.'] });

defIncident({ id:'pk_scl_hw_notaus_kette', quest:'scl', chapter:10, kind:'hardware', base:'c10_notaus',
  force:{ Not_Aus:true }, part:'Not_Aus', cause:'hw_estop',
  alarm:{ no:'1512', prio:1, text:'Not-Halt aktiv: Schrittkette in Schritt 99' },
  hints:['Beobachte die Schrittnummer und das Not-Halt-Signal nach dem Quittieren.',
    'Quittieren wirkt nicht, weil ein Signal der Sicherheitskette dauernd ansteht. Prüfe den Not-Halt-Kreis vor Ort.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_scl_hw_palette', quest:'scl', chapter:11, kind:'hardware', base:'p11_startwert',
  force:{ Teil_Sensor:false }, part:'Teil_Sensor', cause:'hw_sensor',
  alarm:{ no:'1513', prio:3, text:'Palette: Restanzeige zählt nicht herunter' },
  hints:['Beobachte den Entnahmesensor, während Teile von der Palette genommen werden.',
    'Die Anzeige bleibt beim Startwert stehen. Kommt am Eingang überhaupt ein Signal an?'] });

defIncident({ id:'pk_scl_hw_druck', quest:'scl', chapter:12, kind:'hardware', base:'p12_skalieren',
  force:{ AI_Druck:27648 }, part:'AI_Druck', cause:'hw_sensor',
  alarm:{ no:'1514', prio:2, text:'Druckluft: Messwert konstant 10 bar' },
  hints:['Beobachte die Rohwerte der Analogeingänge über mehrere Zyklen.',
    'Ein Rohwert steht fest am Messbereichsende, egal was im Netz passiert. Welcher Messumformer ist das?'] });

defIncident({ id:'pk_scl_hw_schutztuer_band', quest:'scl', chapter:13, kind:'hardware', base:'p13_motor',
  force:{ Schutztuer_zu:false }, part:'Schutztuer_zu', cause:'hw_estop',
  alarm:{ no:'1515', prio:1, text:'Band 1 startet nicht: Schutztür meldet offen' },
  hints:['Beobachte die Eingänge des Motorbausteins beim Startversuch.',
    'Die Schutztür ist geschlossen, das Freigabesignal fehlt trotzdem. Prüfe den Türschalter im Sicherheitskreis.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_scl_hw_band_rm', quest:'scl', chapter:13, kind:'hardware', base:'p13_boss',
  force:{ RM_Band1:false }, part:'RM_Band1', cause:'hw_actuator',
  alarm:{ no:'1516', prio:2, text:'Band 1: Rückmeldung Schütz fehlt' },
  hints:['Beobachte Befehl und Rückmeldung von Band 1 nach dem Start.',
    'Die Steuerung schaltet ein, nach 2 s fällt die Überwachung. Zieht der Antrieb überhaupt an?'],
  sceneFx:{ motorFault1:true } });

defIncident({ id:'pk_scl_hw_waage', quest:'scl', chapter:14, kind:'hardware', base:'p14_global_db',
  force:{ Waage:530 }, part:'Waage', cause:'hw_sensor',
  alarm:{ no:'1517', prio:3, text:'Chargenprotokoll: jedes Teil mit 530 g gewogen' },
  hints:['Beobachte den Waagenwert bei mehreren Teilen hintereinander.',
    'Alle Teile wiegen exakt gleich viel. Das ist bei echten Teilen kaum möglich.'] });

defIncident({ id:'pk_scl_hw_ls_station', quest:'scl', chapter:15, kind:'hardware', base:'p15_zyklus',
  force:{ I_Lichtschranke:true }, part:'I_Lichtschranke', cause:'hw_sensor',
  alarm:{ no:'1518', prio:2, text:'Band fährt Teile über die Station hinaus' },
  hints:['Beobachte das Rohsignal der Lichtschranke, während ein Teil in die Station fährt.',
    'Das Signal meldet dauernd „Strahl frei“. Ist die Lichtschranke verstellt oder spiegelt die Umgebung?'] });

defIncident({ id:'pk_scl_hw_stopp_nc', quest:'scl', chapter:15, kind:'hardware', base:'p15_eingaenge',
  force:{ I_Stopp_NC:false }, part:'I_Stopp_NC', cause:'hw_wire',
  alarm:{ no:'1519', prio:2, text:'Band startet nicht: Stopp-Taster meldet gedrückt' },
  hints:['Beobachte die Rohsignale der Taster in „DB_E“, ohne etwas zu drücken.',
    'Ein Öffner liefert im Ruhezustand TRUE. Liefert er FALSE, obwohl niemand drückt, ist der Stromkreis unterbrochen.'] });

/* ---------- Bedienung ---------- */
defIncident({ id:'pk_scl_op_tara', quest:'scl', chapter:3, kind:'operator', base:'c3_boss',
  param:{ var:'Tara', wrong:0, right:30 }, cause:'op_mode',
  alarm:{ no:'1801', prio:3, text:'Wiegestation: alle Teile als Übergewicht ausgeschleust' },
  hints:['Beobachte Brutto, Tara und Netto an der Wiegestation.',
    'Das Nettogewicht ist genau um das Behältergewicht zu hoch. Welcher Wert wird am HMI eingegeben?'] });

defIncident({ id:'pk_scl_op_blinker', quest:'scl', chapter:9, kind:'operator', base:'c9_blinker',
  param:{ var:'Aktiv', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'1802', prio:3, text:'Störmeldeleuchte gelb blinkt nicht' },
  hints:['Beobachte den Taktgeber und seine Freigabe.',
    'Der Taktgeber läuft nur mit Freigabe. Diese wird am Bedienpanel geschaltet.'] });

defIncident({ id:'pk_scl_op_automatik', quest:'scl', chapter:15, kind:'operator', base:'p15_schrittkette',
  param:{ var:'Automatik', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'1803', prio:2, text:'Roboter greift nicht: Teil wartet an der Station' },
  hints:['Beobachte die Eingänge von „FB_Pick“, während ein Teil an der Station liegt.',
    'Teil und Prüfung sind da, die Kette bleibt in Schritt 0. Welche Betriebsart ist am HMI gewählt?'] });

defIncident({ id:'pk_scl_op_betrieb', quest:'scl', chapter:15, kind:'operator', base:'p15_export',
  param:{ var:'Betrieb', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'1804', prio:3, text:'Signalsäule: Grün fehlt, Zelle meldet nicht betriebsbereit' },
  hints:['Beobachte die Eingänge der Signalsäule.',
    'Grün leuchtet nur bei Betrieb ohne Störung. Ist die Zelle am Bedienpult überhaupt auf Betrieb geschaltet?'] });

})();
