/* Kernpfad (Feedback-Auftrag Paket 4.1): 5 Pflichtaufgaben je Kapitel, der Rest ist Training (freiwillig). IDs nie löschen. */
(function(root){
const KERN = {
  1: ['f1_signal', 'f1_netzwerke', 'f1_zwei_ausgaenge', 'f1_ausfahrt_dbg', 'f1_boss'],   // Zuweisung, UND-Box, Netzwerke, mehrere Ausgänge
  2: ['f2_oder', 'f2_xor', 'f2_neg_dbg', 'f2_lagemelder', 'f2_boss'],   // ODER, XOR, Negation, negierte Zuweisung
  3: ['f3_selbst', 'f3_verriegelung', 'f3_verriegelung_dbg', 'f3_ausvorrang', 'f3_boss'],   // Selbsthaltung, Verriegelung, Aus-Vorrang
  4: ['f4_sr', 'f4_rs_dbg', 'f4_stoerung', 'f4_vorrang', 'f4_boss'],   // SR, RS, S/R-Boxen und Vorrang
  5: ['f5_achse', 'f5_n', 'f5_quit', 'f5_toggle_dbg', 'f5_boss'],   // P- und N-Flanke, Zählen, Stromstoss
  6: ['f6_ton', 'f6_tp', 'f6_tof_dbg', 'f6_wecker', 'f6_boss'],   // TON, TP, TOF und Speicher mit Impuls
  7: ['f7_blinker', 'f7_wechsel', 'f7_ueber_dbg', 'f7_vorlaeuten', 'f7_boss'],   // Taktgeber, Wechselblinker, Laufzeitüberwachung, Ablauf
  8: ['f8_anzeige', 'f8_achszaehler', 'f8_reset_dbg', 'f8_signal', 'f8_boss'],   // CTU mit Anzeige, Achszähler, Freimeldung
  9: ['f9_tempo', 'f9_begriff', 'f9_verspaetung', 'f9_tempo_move', 'f9_boss'],   // Vergleicher, MOVE-Rangfolge, Rechnen, Grenzwert
  10: ['f10_einstellen', 'f10_aufloesen', 'f10_feind_dbg', 'f10_automatik', 'f10_final'],   // Fahrstrasse einstellen, auflösen, Ausschlüsse, Automatik
  11: ['fp11_erste_fc', 'fp11_aufruf', 'fp11_temp', 'fp11_speicher_dbg', 'fp11_boss'],   // FC schreiben, aufrufen, Temp, alle Ausgänge schreiben
  12: ['fp12_weiche', 'fp12_instanzen', 'fp12_timer', 'fp12_multi', 'fp12_boss'],   // FB, Einzelinstanzen, Timer- und FB-Multiinstanzen
  13: ['fp13_db', 'fp13_udt', 'fp13_array', 'fp13_struct_param', 'fp13_boss'],   // DB-Zugriff, Strukturen, Array, Strukturparameter
  14: ['fp14_signal', 'fp14_global_dbg', 'fp14_inout', 'fp14_verschaltung_dbg', 'fp14_boss'],   // Standardbaustein ohne Globale, InOut, Verschaltung
  15: ['fp15_anlauf', 'fp15_struktur', 'fp15_status', 'fp15_quit_dbg', 'fp15_final']   // Anlauf-OB, Programmstruktur, Statuscode, Parameter prüfen
};
const set = new Set(Object.values(KERN).flat());
(root.SCL_CONTENT.tasks || []).forEach(t => { if(!t.hidden) t.core = set.has(t.id); });
root.KERN_PLAN = KERN;
})(typeof window !== 'undefined' ? window : globalThis);
