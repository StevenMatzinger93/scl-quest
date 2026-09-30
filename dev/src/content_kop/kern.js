/* Kernpfad (Feedback-Auftrag Paket 4.1): 5 Pflichtaufgaben je Kapitel, der Rest ist Training (freiwillig). IDs nie löschen. */
(function(root){
const KERN = {
  1: ['k1_licht', 'k1_netzwerke', 'k1_zwei_spulen', 'k1_notaus_dbg', 'k1_boss'],   // Strompfad, Netzwerke, mehrere Spulen, Reihe ergänzen
  2: ['k2_oeffner', 'k2_parallel', 'k2_betrieb', 'k2_stopp_dbg', 'k2_boss'],   // Öffner, Parallel, Reihe+Parallel, Öffner/Schliesser prüfen
  3: ['k3_selbst', 'k3_ausvorrang', 'k3_verriegelung', 'k3_verriegelung_dbg', 'k3_boss'],   // Selbsthaltung, Aus-Vorrang, Verriegelung
  4: ['k4_setzen', 'k4_stoerung', 'k4_antrieb_sr', 'k4_vorrang_dbg', 'k4_boss'],   // S/R, Störung speichern, Antrieb, Vorrang durch Reihenfolge
  5: ['k5_zaehlen', 'k5_sperre', 'k5_quit', 'k5_nflanke_dbg', 'k5_boss'],   // P-/N-Flanke, INC, Bedienbefehle mit Flanke
  6: ['k6_ton', 'k6_tp', 'k6_tof_dbg', 'k6_bremse', 'k6_boss'],   // TON, TP, TOF und negierte Spule
  7: ['k7_anlauf', 'k7_wind', 'k7_ueber_dbg', 'k7_tuerwarnung', 'k7_boss'],   // Vorwarnung, Sturmabschaltung, Überwachung, Taktmerker
  8: ['k8_ctu', 'k8_ctd', 'k8_richtungen', 'k8_reset_dbg', 'k8_boss'],   // CTU, CTD, Zählerstand per MOVE, Rücksetzeingang
  9: ['k9_wind', 'k9_hysterese', 'k9_add', 'k9_grenze_dbg', 'k9_boss'],   // Vergleicher, Hysterese, ADD, Grenzwerte > und >=
  10: ['k10_kette', 'k10_zwei_schritte', 'k10_zeitschritt', 'k10_schritt_dbg', 'k10_final'],   // Sicherheitskette, Schrittkette, Zeit als Übergang
  11: ['k11_erste_fc', 'k11_aufruf', 'k11_temp', 'k11_speicher_dbg', 'k11_boss'],   // FC schreiben, aufrufen, Temp, keine S/R in FC
  12: ['k12_instanzen', 'k12_flanke', 'k12_timer', 'k12_multi', 'k12_boss'],   // Instanz-DB, Flanke im FB, Timer und FB als Multiinstanz
  13: ['k13_db_schreiben', 'k13_udt', 'k13_array', 'k13_struct_param', 'k13_boss'],   // DB-Zugriff, Strukturelemente, Array, Struktur als Parameter
  14: ['k14_global_dbg', 'k14_verschaltung', 'k14_betriebsart', 'k14_inout', 'k14_boss'],   // Standardbaustein ohne Globale, Verschalten, FC/FB, InOut
  15: ['k15_anlauf', 'k15_struktur', 'k15_status', 'k15_quit_dbg', 'k15_final']   // OB100, OB1-Struktur, Statuscode per Ret_Val, Parameterkonstanten
};
const set = new Set(Object.values(KERN).flat());
(root.SCL_CONTENT.tasks || []).forEach(t => { if(!t.hidden) t.core = set.has(t.id); });
root.KERN_PLAN = KERN;
})(typeof window !== 'undefined' ? window : globalThis);
