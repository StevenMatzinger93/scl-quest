/* Kernpfad (Feedback-Auftrag Paket 4.1): 5 Pflichtaufgaben je Kapitel, der Rest ist Training (freiwillig). IDs nie löschen. */
(function(root){
const KERN = {
  1: ['a1_rollgang', 'a1_und', 'a1_ketten', 'a1_zufrueh_dbg', 'a1_boss'],   // Abfrage, UND, mehrere Ketten, Zeilenreihenfolge
  2: ['a2_on', 'a2_und_vor_oder', 'a2_klammer_dbg', 'a2_un_klammer', 'a2_boss'],   // ON, UND vor ODER, Klammern mit UN
  3: ['a3_selbsthaltung', 'a3_notaus_dbg', 'a3_ofen', 'a3_stoerung', 'a3_boss'],   // Selbsthaltung, Vorrang, Rücksetzen mit ODER, Störspeicher
  4: ['a4_fp', 'a4_melden', 'a4_nachlauf', 'a4_merker_dbg', 'a4_boss'],   // FP/FN, Flanke setzt Speicher, eigener Merker
  5: ['a5_si', 'a5_sv', 'a5_vorwarnung', 'a5_art_dbg', 'a5_boss'],   // SI, SV, SE im Ablauf, SA per Fehlersuche
  6: ['a6_reset', 'a6_zr', 'a6_zaehler_dbg', 'a6_voll', 'a6_boss'],   // ZV/R, ZS/ZR, Zählerbit, ein Zähler zwei Richtungen
  7: ['a7_konst', 'a7_richtung_dbg', 'a7_tak', 'a7_zaehlwert', 'a7_boss'],   // L/T, Richtung, TAK, Zählwert laden
  8: ['a8_mal', 'a8_reihenfolge_dbg', 'a8_mittel', 'a8_runden', 'a8_boss'],   // Multiplizieren, -I-Reihenfolge, ITD/DTR, RND
  9: ['a9_groesser', 'a9_klammer', 'a9_fenster', 'a9_grenze_dbg', 'a9_boss'],   // Vergleich, Vergleich in Klammer, Fenster, Grenzwert
  10: ['a10_zaehlen', 'a10_bea', 'a10_betriebsart', 'a10_spb_dbg', 'a10_final'],   // SPBN mit Flanke/INC, BEA, Verteiler SPB/SPA
  11: ['ap11_erste_fc', 'ap11_aufruf', 'ap11_temp', 'ap11_speicher_dbg', 'ap11_boss'],   // FC schreiben, CALL, Temp mit Vergleich, kein Speicher
  12: ['ap12_selbsthaltung', 'ap12_instanzen', 'ap12_ueberwachung', 'ap12_multi', 'ap12_boss'],   // FB-Gedächtnis, Instanzen, TON mit S/R, Multiinstanz
  13: ['ap13_db', 'ap13_udt', 'ap13_array', 'ap13_array_dbg', 'ap13_boss'],   // DB-Zugriff, Strukturelemente, Arrays und Indizes
  14: ['ap14_antrieb', 'ap14_ofen', 'ap14_inout', 'ap14_verschaltung_dbg', 'ap14_boss'],   // Bausteine des Bosses, InOut, Verschaltung prüfen
  15: ['ap15_anlauf', 'ap15_struktur', 'ap15_status', 'ap15_quit_dbg', 'ap15_final']   // OB100, OB1-Struktur, FC_Status, Parameterversorgung
};
const set = new Set(Object.values(KERN).flat());
(root.SCL_CONTENT.tasks || []).forEach(t => { if(!t.hidden) t.core = set.has(t.id); });
root.KERN_PLAN = KERN;
})(typeof window !== 'undefined' ? window : globalThis);
