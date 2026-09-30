/* Kernpfad (Feedback-Auftrag Paket 4.1): 5 Pflichtaufgaben je Kapitel, der Rest ist Training (freiwillig). IDs nie löschen. */
(function(root){
const KERN = {
  1: ['r1t1', 'c1_band', 'c1_semi', 'c1_calc', 'c1_boss'],   // Zuweisung, mehrere Anweisungen, Semikolon-Fehler, Rechnen
  2: ['r1t9', 'r2t3', 'r2t6', 'c2_klammer_dbg', 'r2t10'],   // AND, OR, NOT-Kette, Klammerfehler finden
  3: ['c3_fenster', 'c3_mittel', 'c3_skal', 'c3_limit', 'c3_boss'],   // Bereichsprüfung, INT-Division, INT_TO_REAL, LIMIT
  4: ['r1t10', 'c4_elsif', 'c4_endif', 'c4_farbweiche', 'c4_boss'],   // IF/ELSE, ELSIF-Kette, ELSIF-Fehler, Auffang-ELSE
  5: ['r3t2', 'c5_liste', 'c5_else_fehlt', 'c5_betrieb', 'r3t10'],   // CASE, Wertlisten, ELSE-Fehler, mehrere Anweisungen
  6: ['r4t3', 'c6_grenze', 'c6_zaehlen', 'r4t5', 'r4t10'],   // FOR über Array, Off-by-one, Zählen, Maximum
  7: ['c7_kisten', 'c7_suche', 'c7_lagerplatz', 'c7_exit_dbg', 'c7_boss'],   // WHILE, Suche mit EXIT, sichere Suchschleife
  8: ['r5t1', 'c8_zaehlen', 'c8_ctu', 'c8_reset_dbg', 'c8_boss'],   // R_TRIG, Flankenzählung, CTU mit Reset
  9: ['r5t3', 'r5t5', 'c9_ueberwachung', 'c9_ms_dbg', 'r5t10'],   // TON, TOF, Zeitüberwachung, Zeiteinheiten
  10: ['c10_kette', 'c10_timer', 'c10_notaus', 'c10_sortierlauf', 'final_boss'],   // Schrittkette, Timer, Not-Halt, CASE im CASE
  11: ['p11_deklaration', 'p11_konstante', 'p11_wortbreite', 'p11_temp_dbg', 'p11_boss'],   // Deklaration, Konstanten, DINT, STAT gegen TEMP
  12: ['p12_erste_fc', 'p12_ausgaenge', 'p12_inout', 'p12_bibliothek', 'p12_boss'],   // FC, Ausgänge, IN_OUT, FC-Aufrufe
  13: ['p13_erster_fb', 'p13_instanz', 'p13_timer_im_fb', 'p13_bedingt_dbg', 'p13_boss'],   // FB, Instanz-DB, Timer im FB, jeder Zyklus
  14: ['p14_udt', 'p14_array_udt', 'p14_concat', 'p14_kurz_dbg', 'p14_boss'],   // UDT, Array von UDT, Texte, STRING-Länge
  15: ['p15_zyklus', 'p15_geraete', 'p15_betriebsart', 'p15_global_dbg', 'p15_final']   // OB1, Multiinstanzen, Standard-FB, Kapselung
};
const set = new Set(Object.values(KERN).flat());
(root.SCL_CONTENT.tasks || []).forEach(t => { if(!t.hidden) t.core = set.has(t.id); });
root.KERN_PLAN = KERN;
})(typeof window !== 'undefined' ? window : globalThis);
