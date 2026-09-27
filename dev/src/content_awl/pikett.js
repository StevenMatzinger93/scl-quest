/* ===== PIKETTDIENST · AWL Quest · Walzwerk Keller 2 =====
   Hardware- und Bedienstörungen (docs/PLAN_ZERTIFIKAT_PIKETT.md B.4, docs/PIKETT_KONZEPT.md).
   Programmstörungen entstehen automatisch aus bugs.js (SPSQPikett.fromBugs).
   Nummernkreis: Hardware 4501–4799, Bedienung 4801–4899. */
(function(){

/* ---------- Hardware ---------- */
defIncident({ id:'pk_awl_hw_gitter', quest:'awl', chapter:1, kind:'hardware', base:'a1_und',
  force:{ Gitter_zu:false }, part:'Gitter_zu', cause:'hw_estop',
  alarm:{ no:'4501', prio:1, text:'Walzgerüst: Schutzgitter meldet offen' },
  hints:['Beobachte den Gitterschalter, während das Schutzgitter geschlossen ist.',
    'Das Gitter ist zu, das Signal bleibt FALSE. Prüfe den Sicherheitsschalter am Schutzgitter.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_awl_hw_kuehlwasser', quest:'awl', chapter:1, kind:'hardware', base:'a1_zwei',
  force:{ Wasser_OK:false }, part:'Wasser_OK', cause:'hw_sensor',
  alarm:{ no:'4502', prio:2, text:'Kühlung startet nicht: kein Kühlwasser gemeldet' },
  hints:['Beobachte den Durchflusswächter, während Kühlwasser fliesst.',
    'Wasser läuft sichtbar, der Wächter meldet nichts. Ist der Durchflusswächter verkalkt?'] });

defIncident({ id:'pk_awl_hw_notaus_sammel', quest:'awl', chapter:2, kind:'hardware', base:'a2_on',
  force:{ Not_Aus_OK:false }, part:'Not_Aus_OK', cause:'hw_estop',
  alarm:{ no:'4503', prio:1, text:'Sammelstörung: Not-Aus-Kreis offen' },
  hints:['Beobachte alle Eingänge der Sammelstörung.',
    'Öl und Wasser sind in Ordnung. Ein Sicherheitssignal fehlt, obwohl kein Not-Aus-Taster gedrückt ist.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_awl_hw_temp_schalter', quest:'awl', chapter:3, kind:'hardware', base:'a3_ofen',
  force:{ Temp_erreicht:true }, part:'Temp_erreicht', cause:'hw_sensor',
  alarm:{ no:'4504', prio:2, text:'Ofen heizt nicht: Temperatur erreicht gemeldet' },
  hints:['Beobachte die Rücksetzbedingungen der Heizung, während der Ofen noch kalt ist.',
    'Ein Eingang meldet „Temperatur erreicht“, obwohl der Ofen kalt ist. Prüfe den Temperaturschalter.'] });

defIncident({ id:'pk_awl_hw_druck_tief', quest:'awl', chapter:3, kind:'hardware', base:'a3_stoerung',
  force:{ Druck_tief:true }, part:'Druck_tief', cause:'hw_sensor',
  alarm:{ no:'4505', prio:2, text:'Hydraulikdruck tief: Walzen gesperrt' },
  hints:['Beobachte den Druckschalter und vergleiche ihn mit dem Manometer vor Ort.',
    'Das Manometer zeigt genug Druck, der Druckschalter meldet dauernd „tief“. Darum lässt sich auch nicht quittieren.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_awl_hw_ls_ofen', quest:'awl', chapter:4, kind:'hardware', base:'a4_fn',
  force:{ Lichtschranke:false }, part:'Lichtschranke', cause:'hw_sensor',
  alarm:{ no:'4506', prio:3, text:'Meldung „Block durch“ bleibt aus' },
  hints:['Beobachte die Lichtschranke, während ein Block durchfährt.',
    'Die fallende Flanke kann nur kommen, wenn das Signal vorher TRUE war. Sieht die Lichtschranke den Block überhaupt?'] });

defIncident({ id:'pk_awl_hw_schere_unten', quest:'awl', chapter:4, kind:'hardware', base:'a4_boss',
  force:{ Schere_unten:false }, part:'Schere_unten', cause:'hw_wire',
  alarm:{ no:'4507', prio:2, text:'Schere: Endlage unten nicht gemeldet' },
  hints:['Beobachte die Schere und ihre Endlage während eines Schnitts.',
    'Die Schere fährt sichtbar ganz nach unten, der Endschalter bleibt FALSE. Prüfe Schalter und Leitung.'],
  sceneFx:{ shearDown:true } });

defIncident({ id:'pk_awl_hw_pumpe_rm', quest:'awl', chapter:5, kind:'hardware', base:'a5_se',
  force:{ Pumpe:false }, part:'Pumpe', cause:'hw_wire',
  alarm:{ no:'4508', prio:2, text:'Walzen ohne Freigabe: Pumpe meldet nicht' },
  hints:['Beobachte die Rückmeldung der Pumpe und die Zeit T1.',
    'Die Pumpe läuft hörbar, T1 startet trotzdem nie. Kommt die Rückmeldung am Eingang an?'] });

defIncident({ id:'pk_awl_hw_zaehler_ausgang', quest:'awl', chapter:6, kind:'hardware', base:'a6_zv',
  force:{ Block_raus:true }, part:'Block_raus', cause:'hw_sensor',
  alarm:{ no:'4509', prio:3, text:'Stückzähler Ofenausgang steht' },
  hints:['Beobachte den Sensor am Ofenausgang, während mehrere Blöcke herauskommen.',
    'ZV zählt nur bei einem Wechsel von 0 auf 1. Wechselt der Sensor noch, oder ist er zugedeckt?'] });

defIncident({ id:'pk_awl_hw_pyrometer', quest:'awl', chapter:7, kind:'hardware', base:'a7_lt',
  force:{ Temp:950 }, part:'Temp', cause:'hw_sensor',
  alarm:{ no:'4510', prio:3, text:'Ofentemperatur-Anzeige steht auf 950 °C' },
  hints:['Beobachte den Temperatureingang über mehrere Zyklen.',
    'Der Wert ändert sich nicht, auch wenn der Ofen aufheizt. Ist die Optik des Pyrometers verschmutzt?'] });

defIncident({ id:'pk_awl_hw_fuehler1', quest:'awl', chapter:8, kind:'hardware', base:'a8_mittel',
  force:{ Temp_1:1000 }, part:'Temp_1', cause:'hw_sensor',
  alarm:{ no:'4511', prio:3, text:'Mittlere Ofentemperatur unplausibel' },
  hints:['Beobachte beide Temperaturfühler einzeln.',
    'Ein Fühler zeigt immer denselben Wert, der andere folgt dem Ofen. Welcher ist es?'] });

defIncident({ id:'pk_awl_hw_druck_messumformer', quest:'awl', chapter:9, kind:'hardware', base:'a9_kleiner',
  force:{ Druck:0 }, part:'Druck', cause:'hw_wire',
  alarm:{ no:'4512', prio:2, text:'Hydraulikdruck 0 bar gemessen' },
  hints:['Beobachte den Druckwert und vergleiche ihn mit dem Manometer.',
    'Der Messwert steht genau auf 0, das Manometer zeigt Druck. Denke an die Leitung zum Messumformer.'],
  sceneFx:{ pressure:0 } });

defIncident({ id:'pk_awl_hw_notaus_bea', quest:'awl', chapter:10, kind:'hardware', base:'a10_bea',
  force:{ Not_Aus_OK:false }, part:'Not_Aus_OK', cause:'hw_estop',
  alarm:{ no:'4513', prio:1, text:'Not-Aus: Rollgang und Walzen stehen' },
  hints:['Beobachte, welcher Sprung am Anfang des Programms genommen wird.',
    'Das Programm endet jedes Mal mit BEA. Die Bedingung dafür kommt aus dem Sicherheitskreis.'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_awl_hw_oeldruck_g1', quest:'awl', chapter:11, kind:'hardware', base:'ap11_erste_fc',
  force:{ Oel_OK:false }, part:'Oel_OK', cause:'hw_sensor',
  alarm:{ no:'4514', prio:2, text:'Gerüst 1: keine Freigabe, Öldruck fehlt' },
  hints:['Beobachte die drei Eingänge der Funktion FC_Freigabe.',
    'Taster und Gitter sind in Ordnung. Ein Wächter meldet dauernd „nicht OK“, obwohl die Ölversorgung läuft.'] });

defIncident({ id:'pk_awl_hw_schuetz_rm', quest:'awl', chapter:12, kind:'hardware', base:'ap12_ueberwachung',
  force:{ Schuetz_RM:false }, part:'Schuetz_RM', cause:'hw_actuator',
  alarm:{ no:'4515', prio:2, text:'Rollgang: Rückmeldung Schütz fehlt' },
  hints:['Beobachte Befehl und Rückmeldung des Rollgangs.',
    'Die Steuerung gibt den Befehl, die Rückmeldung bleibt aus und die Überwachung fällt nach 3 s. Zieht das Schütz an?'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_awl_hw_temp_statistik', quest:'awl', chapter:13, kind:'hardware', base:'ap13_db',
  force:{ Temp:1150 }, part:'Temp', cause:'hw_sensor',
  alarm:{ no:'4516', prio:3, text:'Temperaturstatistik: Maximalwert ändert nicht' },
  hints:['Beobachte „Temp“ und „DB_Statistik“ über mehrere Blöcke.',
    'Der aktuelle Wert bleibt immer gleich, auch wenn heissere Blöcke kommen. Prüfe den Temperaturfühler.'] });

defIncident({ id:'pk_awl_hw_rollgang_rm', quest:'awl', chapter:14, kind:'hardware', base:'ap14_antrieb',
  force:{ Rollgang_RM:false }, part:'Rollgang_RM', cause:'hw_actuator',
  alarm:{ no:'4517', prio:2, text:'Rollgang-Antrieb: Rückmeldung fehlt, Antrieb abgeschaltet' },
  hints:['Beobachte die Eingänge von FB_Antrieb nach dem Einschalten.',
    'Nach 2 s ohne Rückmeldung schaltet der Baustein ab. Bewegt sich der Rollgang überhaupt?'],
  sceneFx:{ faultActive:true } });

defIncident({ id:'pk_awl_hw_oeldruck_linie', quest:'awl', chapter:15, kind:'hardware', base:'ap15_final',
  force:{ Oel_OK:false }, part:'Oel_OK', cause:'hw_sensor',
  alarm:{ no:'4518', prio:1, text:'Walzwerk steht: Öldruck nicht OK' },
  hints:['Beobachte die Sicherheits- und Versorgungssignale der Linie.',
    'Die Ölversorgung läuft, ein Wächter meldet dennoch dauernd „nicht OK“. Welcher Eingang ist es?'],
  sceneFx:{ faultActive:true } });

/* ---------- Bedienung ---------- */
defIncident({ id:'pk_awl_op_heizen', quest:'awl', chapter:5, kind:'operator', base:'a5_boss',
  param:{ var:'S_Heizen', wrong:false, right:true }, cause:'op_mode',
  alarm:{ no:'4801', prio:2, text:'Ofen heizt nicht: Heizung nicht angewählt' },
  hints:['Beobachte die Bedingungen für die Heizung.',
    'Die Ofentür ist zu und die Sperrzeit abgelaufen. Ist die Heizung am Pult eingeschaltet?'] });

defIncident({ id:'pk_awl_op_vorwahl', quest:'awl', chapter:9, kind:'operator', base:'a9_gleich',
  param:{ var:'Vorwahl', wrong:12, right:10 }, cause:'op_mode',
  alarm:{ no:'4802', prio:3, text:'Charge nicht als komplett gemeldet' },
  hints:['Beobachte Stückzahl und Vorwahl am Ende der Charge.',
    'Es wurden so viele Blöcke gewalzt wie im Auftrag. Stimmt die Vorwahl am Leitstand mit dem Auftrag überein?'] });

defIncident({ id:'pk_awl_op_spalt_soll', quest:'awl', chapter:9, kind:'operator', base:'a9_ungleich',
  param:{ var:'Spalt_Soll', wrong:14, right:12 }, cause:'op_mode',
  alarm:{ no:'4803', prio:3, text:'Spaltregler: Walzspalt falsch eingestellt' },
  hints:['Beobachte Soll- und Istwert des Walzspalts.',
    'Der Regler arbeitet richtig, er regelt nur auf einen falschen Wert. Woher kommt dieser Wert?'] });

defIncident({ id:'pk_awl_op_stichplan', quest:'awl', chapter:13, kind:'operator', base:'ap13_boss',
  param:{ var:'DB_Stichplan.Stich[1].Spalt', wrong:80, right:90 }, cause:'op_mode',
  alarm:{ no:'4804', prio:3, text:'Stich 1: Walzspalt ausserhalb Stichplan' },
  hints:['Beobachte „Spalt_Soll“ und die Werte im Stichplan für Stich 1.',
    'Der Verteiler holt korrekt den Wert aus dem Datenbaustein. Vergleiche den Stichplan mit dem Walzauftrag.'] });

})();
