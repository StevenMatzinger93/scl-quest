# Bericht „Funktion zählt“ (V1) – erzeugt mit `node check_funktion.js --md`

Stand: 2026-10-03. Mutanten = kleine Fehler an der Musterlösung, die durchfallen müssen. Alternativen = andere richtige Wege, die bestehen müssen.

| Quest | Aufgaben | Mutanten | erkannt | nur dank erzeugter Tests | überlebt | Alternativen ok | Alternativen durchgefallen |
|---|---|---|---|---|---|---|---|
| SCL | 150 | 959 | 889 (93 %) | 24 | 70 | 41 | 0 |
| KOP | 150 | 886 | 850 (96 %) | 61 | 36 | 54 | 0 |
| FUP | 150 | 746 | 701 (94 %) | 47 | 45 | 62 | 0 |
| AWL | 150 | 433 | 394 (91 %) | 31 | 39 | 21 | 0 |

## SCL

### Startcode erfüllt die Funktion schon

– keine –

### Alternativen durchgefallen (Prüfung zu streng?)

– keine –

### Überlebende Mutanten (Tests zu schwach oder Mutant gleichwertig)

- `c4_elsif`: Zahl 90 → 91
- `c4_reihenfolge`: Zahl 80 → 79 · Zahl 50 → 51 · Zahl 50 → 49 · Vergleich > → >= · Vergleich > → >=
- `c4_hysterese`: Zahl 70 → 71
- `r4t5`: Zahl 1 → 2 · Zahl 1 → 0 · Vergleich > → >=
- `r4t10`: Zahl 0 → 1 · Vergleich > → >=
- `r4t9`: Zahl 0 → 1 · Zahl 1 → 2
- `c7_continue`: Zahl 0 → 1 · Vergleich < → <=
- `c7_exit_dbg`: Zahl 0 → 1 · Zahl 500 → 501 · Zahl 500 → 499 · Vergleich > → >=
- `c7_doppelt`: Zahl 4 → 5 · Zahl 4 → 3
- `c7_sortieren`: Zahl 1 → 0 · Zahl 4 → 5 · Vergleich > → >=
- `c7_boss`: Zahl 0 → 1 · Zahl 0 → 1 · Vergleich >= → >
- `c8_reset_dbg`: Zahl 100 → 101 · Zahl 100 → 99
- `c10_notaus`: Zahl 1 → 2 · Zahl 0 → 1
- `c10_timer_dbg`: TRUE → FALSE · Zuweisung negiert
- `final_boss`: Zahl 0 → 1 · Zahl 4 → 3
- `p12_erste_fc`: FC_Max3: Vergleich > → >= · FC_Max3: Vergleich > → >=
- `p12_zweige_dbg`: FC_Weiche: Vergleich >= → > · FC_Weiche: Vergleich <= → <
- `p12_inout`: FC_Sortieren: Zahl 4 → 5 · FC_Sortieren: Vergleich > → >=
- `p12_boss`: FC_Messwert: Zahl 27648 → 27649
- `p14_array_udt`: FC_Charge: Zahl 1 → 2
- `p14_global_db`: Main: Zahl 8 → 7 · Main: Vergleich >= → > · Main: Vergleich <= → <
- `p14_string`: FC_Meldung: Zahl 24 → 25 · FC_Meldung: Zahl 24 → 23
- `p14_concat`: FC_Teiletext: Zahl 30 → 31 · FC_Teiletext: Zahl 30 → 29
- `p14_zerlegen`: FC_Barcode: Zahl 20 → 21 · FC_Barcode: Zahl 20 → 19 · FC_Barcode: Zahl 1 → 2 · FC_Barcode: Zahl 1 → 2
- `p14_kurz_dbg`: FC_Stoermeldung: Zahl 30 → 31 · FC_Stoermeldung: Zahl 30 → 29 · FC_Stoermeldung: Zahl 30 → 31 · FC_Stoermeldung: Zahl 30 → 29
- `p14_boss`: FC_Protokoll: Zahl 3 → 4
- `p15_betriebsart`: FB_Betriebsart: Zahl 16 → 17 · FB_Betriebsart: Zahl 16 → 15
- `p15_final`: FB_Zelle: Zahl 30 → 31 · FB_Zelle: Zahl 30 → 29 · FB_Zelle: Zahl 0 → 1 · FB_Zelle: Vergleich >= → > · FB_Zelle: Vergleich <= → < · FB_Zelle: Vergleich > → >= · FB_Zelle: AND → OR · FB_Zelle: AND → OR

## KOP

### Startcode erfüllt die Funktion schon

– keine –

### Alternativen durchgefallen (Prüfung zu streng?)

– keine –

### Überlebende Mutanten (Tests zu schwach oder Mutant gleichwertig)

- `k7_ueber_dbg`: R → S
- `k8_anzeige`: Zahl 8 → 9 · Zahl 8 → 7 · Spule negiert
- `k8_richtungen`: Zahl 1000 → 1001 · Zahl 1000 → 999 · Zahl 1000 → 1001 · Zahl 1000 → 999 · AND → OR · AND → OR · NOT weg · Spule negiert · Spule negiert
- `k8_takt`: Flanke P weg
- `k9_hysterese`: Zahl 60 → 59 · Vergleich > → >=
- `k9_hyst_dbg`: Zahl 60 → 59 · Zahl 40 → 39 · Vergleich > → >=
- `k9_boss`: Zahl 60 → 61 · Zahl 60 → 59 · Zahl 40 → 41 · Zahl 40 → 39 · Vergleich > → >= · Vergleich < → <=
- `k10_final`: AND → OR
- `k11_temp_dbg`: FC_Sturm: Zahl 40 → 41 · FC_Sturm: Zahl 40 → 39 · FC_Sturm: Vergleich >= → > · FC_Sturm: OR → AND · FC_Sturm: Spule negiert
- `k13_db_schreiben`: Main: Vergleich > → >=
- `k14_global_dbg`: FB_Antrieb: Zeit T#1S ×2 · FB_Antrieb: AND → OR · FB_Antrieb: Spule negiert
- `k15_final`: Startup: Zahl 0 → 1

## FUP

### Startcode erfüllt die Funktion schon

– keine –

### Alternativen durchgefallen (Prüfung zu streng?)

– keine –

### Überlebende Mutanten (Tests zu schwach oder Mutant gleichwertig)

- `f8_anzeige`: Zahl 8 → 9 · Zahl 8 → 7 · Spule negiert
- `f8_achszaehler`: Zahl 1000 → 1001 · Zahl 1000 → 999 · Zahl 1000 → 1001 · Zahl 1000 → 999 · Spule negiert · Spule negiert
- `f8_reset_dbg`: Zahl 8 → 9 · Zahl 8 → 7 · Spule negiert
- `f8_signal`: Zahl 1000 → 1001 · Zahl 1000 → 999 · Zahl 1000 → 1001 · Zahl 1000 → 999 · Spule negiert · Spule negiert
- `f8_boss`: Zahl 1000 → 1001 · Zahl 1000 → 999 · Zahl 1000 → 1001 · Zahl 1000 → 999 · Spule negiert · Spule negiert
- `f9_zuglaenge`: Zahl 120 → 121 · Zahl 120 → 119 · Vergleich <= → <
- `f9_boss`: Vergleich > → >= · Vergleich > → >=
- `f10_aufloesen`: SR → RS
- `f10_feind_dbg`: SR → RS · SR → RS
- `f10_final`: SR → RS · SR → RS
- `fp11_temp_dbg`: FC_Lage: NOT weg · FC_Lage: Spule negiert
- `fp12_abschnitt`: FB_Abschnitt: Zahl 1000 → 1001 · FB_Abschnitt: Zahl 1000 → 999 · FB_Abschnitt: Zahl 1000 → 1001 · FB_Abschnitt: Zahl 1000 → 999 · FB_Abschnitt: Spule negiert · FB_Abschnitt: S → R
- `fp13_db`: Main: Vergleich > → >=
- `fp14_global_dbg`: FB_Signal: NOT weg
- `fp15_final`: Startup: Zahl 0 → 1

## AWL

### Startcode erfüllt die Funktion schon

– keine –

### Alternativen durchgefallen (Prüfung zu streng?)

– keine –

### Überlebende Mutanten (Tests zu schwach oder Mutant gleichwertig)

- `a2_und_vor_oder`: Zeile „U“ → „O“
- `a2_boss`: Zeile „U“ → „O“
- `a3_boss`: Zeile „U“ → „O“
- `a7_vke_dbg`: Zahl 0 → 1
- `a9_boss`: Zahl 1200 → 1199 · Zahl 1200 → 1199 · Zahl 1250 → 1251 · Zahl 1250 → 1249 · Vergleich > → >= · Vergleich <= → <
- `a10_spbn`: Zahl 0 → 1
- `a10_verzweigung`: Zahl 0 → 1
- `a10_spa_dbg`: Zahl 0 → 1
- `a10_zaehlen`: Zahl 0 → 1
- `a10_betriebsart`: Zahl 0 → 1
- `a10_spb_dbg`: Zahl 0 → 1
- `a10_final`: Zahl 1100 → 1099 · Zahl 0 → 1
- `ap11_temp_dbg`: FC_Mittel: Zahl 2200 → 2199
- `ap12_flanke`: FB_Zaehler: Zahl 0 → 1
- `ap13_db`: Main: Zahl 0 → 1 · Main: Vergleich > → >=
- `ap13_protokoll`: Main: Zahl 0 → 1
- `ap14_ofen`: FB_Ofen: Vergleich < → <= · FB_Ofen: Vergleich > → >= · FB_Ofen: Vergleich >= → >
- `ap14_global_dbg`: FB_Antrieb: Zeit T#2S ×2 · FB_Antrieb: R → S · FB_Antrieb: S → R
- `ap14_verschaltung`: Main: Zahl 50 → 51 · Main: Zahl 50 → 49
- `ap14_inout`: FB_Zaehler: Zahl 0 → 1
- `ap14_meldung`: FB_Meldung: Zeile „U“ → „O“
- `ap14_verschaltung_dbg`: Main: Zahl 50 → 51 · Main: Zahl 50 → 49
- `ap14_boss`: FB_Walzlinie: Zahl 50 → 51 · FB_Walzlinie: Zahl 50 → 49
- `ap15_status`: FC_Status: Zahl 0 → 1
- `ap15_ablauf`: FB_Ablauf: Zeile „U“ → „O“
