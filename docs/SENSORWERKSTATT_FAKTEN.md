# Sensorwerkstatt – Faktenblatt (S0)

Stand: 27.09.2026. Grundlage: `docs/SENSORWERKSTATT_PLAN.md`, Teil 10, Paket S0.

> **Wichtig – Recherchestand:** In der Cloud-Sitzung, in der diese Datei entstand, hat der Netzwerk-Proxy die Siemens-Supportseiten (`support.industry.siemens.com`, `cache.industry.siemens.com`, `siemens.com`) gesperrt. Die Werte unten stammen aus Handbuchwissen und sind mit der Quelle angegeben, aus der sie stammen sollten, aber **nicht gegen das PDF nachgeschlagen**.
> Markierung:
> - **[prüfen]** = unsicher oder abhängig von Firmware/Ausgabestand; vor der Freigabe an die Schüler kontrollieren (Teil 12 des Plans).
> - **[sicher]** = gut belegter Standardwert, den Siemens seit Jahren gleich dokumentiert.
>
> Das Spiel übernimmt diese Werte in Tests und markiert sie. Abweichungen gehören nach `docs/SENSORWERKSTATT_ABWEICHUNGEN.md`.

Quellen, die für die Kontrolle zu verwenden sind:
- **[SH]** SIMATIC S7-1200 Automatisierungssystem, Systemhandbuch (A5E02486681), Kapitel „Technische Daten“ (Anhang A), „Anschlusspläne“, „Analogwertdarstellung“.
- **[DB-CPU]** Datenblatt 6ES7214-1AG40-0XB0 (CPU 1214C DC/DC/DC).
- **[DB-AI]** Datenblatt 6ES7231-4HD32-0XB0 (SM 1231 AI 4 × 13 Bit).
- **[DB-AQ]** Datenblatt 6ES7232-4HB32-0XB0 (SM 1232 AQ 2 × 14 Bit).
- **[DB-DI]** Datenblatt 6ES7221-1BF32-0XB0 (SM 1221 DI 8 × 24 V DC).
- **[TIA]** TIA-Portal-Hilfe, Anweisungen `NORM_X` und `SCALE_X` (Basisanweisungen → Umwandlungsoperationen).

## 1. CPU 1214C DC/DC/DC (6ES7214-1AG40-0XB0)
| Punkt | Wert | Quelle | Status |
|---|---|---|---|
| Versorgung | 24 V DC (20,4–28,8 V), Klemmen L+ / M / Funktionserde | [DB-CPU] | [sicher] |
| Geberversorgung (Ausgang) | 24 V DC, max. 400 mA, Klemmen L+ / M am Eingangsklemmenblock | [SH] | [sicher] |
| Digitaleingänge | 14 DI, 24 V DC, **stromziehend/stromliefernd** (Sink/Source, IEC Typ 1) | [DB-CPU] | [sicher] |
| Bezugspotential DI | gemeinsamer Anschluss **1M** für alle 14 DI | [SH] | [sicher] |
| PNP-Geber (plusschaltend) | 1M an **M** (Eingang „stromziehend“) | [SH] | [sicher] |
| NPN-Geber (minusschaltend) | 1M an **L+** (Eingang „stromliefernd“) | [SH] | [sicher] |
| Eingangsverzögerung | parametrierbar 0,1 µs … 20 ms, Standard 6,4 ms | [SH] | [prüfen] |
| Digitalausgänge | 10 DQ Transistor 24 V DC, **nur stromliefernd** (P-schaltend), 0,5 A; Klemmen 3L+ / 3M | [DB-CPU] | [sicher] |
| Onboard-Analogeingänge | 2 AI, **0–10 V**, Auflösung 10 Bit, Eingangswiderstand ≥ 100 kΩ, Bezug 2M | [DB-CPU] | [sicher] |
| Onboard-Analogausgänge | keine (erst CPU 1215C/1217C haben 2 AQ) | [DB-CPU] | [sicher] |
| Standardadressen | DI %I0.0–%I1.5, DQ %Q0.0–%Q1.1, AI %IW64 und %IW66 | [SH] | [sicher] |
| Klemmenbezeichnung DI | X10: 1M, DIa .0–.7, DIb .0–.5 (Beschriftung am Gerät „DI a / DI b“) | [SH] | [prüfen] |
| Klemmenbezeichnung AI | 2M, AI0, AI1 (am DI-Stecker) | [SH] | [prüfen] |
| Klemmenbezeichnung DQ | X12: 3L+, 3M, DQa .0–.7, DQb .0–.1 | [SH] | [prüfen] |
| LEDs | RUN/STOP, ERROR, MAINT; je DI/DQ eine Status-LED | [SH] | [sicher] |

## 2. SM 1231 AI 4 × 13 Bit (6ES7231-4HD32-0XB0)
| Punkt | Wert | Quelle | Status |
|---|---|---|---|
| Messarten | Spannung ±10 V, ±5 V, ±2,5 V; Strom 0–20 mA, 4–20 mA | [DB-AI] | [sicher] |
| Auflösung | 12 Bit + Vorzeichen | [DB-AI] | [sicher] |
| Anschluss je Kanal | differentiell: `0+ 0−`, `1+ 1−`, `2+ 2−`, `3+ 3−`; Moduleversorgung L+ / M | [SH] | [prüfen] |
| 2-Leiter-Messumformer | Das Modul speist die Schleife **nicht**. Die Schleife geht von L+ über den Messumformer auf `x+`, von `x−` auf M (externe Versorgung in Reihe). | [SH] | [prüfen] |
| 4-Leiter-Messumformer | Stromausgang aktiv: Ausgang + → `x+`, Ausgang − → `x−` | [SH] | [sicher] |
| Diagnose | Überlauf, Unterlauf, Drahtbruch (nur 4–20 mA), fehlende 24 V; kanalweise freischaltbar | [DB-AI] | [sicher] |
| Glättung | keine / schwach (4) / mittel (16) / stark (32 Zyklen) | [SH] | [prüfen] |
| Standardadresse | abhängig vom Steckplatz; bei Steckplatz 2 typisch %IW96–%IW102 | [SH] | [prüfen] |

## 3. SM 1232 AQ 2 × 14 Bit (6ES7232-4HB32-0XB0)
| Punkt | Wert | Quelle | Status |
|---|---|---|---|
| Ausgabearten | Spannung ±10 V (14 Bit), Strom 0–20 mA / 4–20 mA (13 Bit) | [DB-AQ] | [sicher] |
| Nennbereich Rohwert | 0–27648 (Strom), −27648…27648 (Spannung) | [SH] | [sicher] |
| Verhalten bei STOP | Ersatzwert oder letzten Wert halten (parametrierbar) | [SH] | [sicher] |
| Bürde | Spannung ≥ 1 kΩ, Strom ≤ 600 Ω | [DB-AQ] | [prüfen] |
| Standardadresse | Steckplatz 3 typisch %QW112/%QW114 | [SH] | [prüfen] |

## 4. SM 1221 DI 8 × 24 V DC (6ES7221-1BF32-0XB0)
| Punkt | Wert | Quelle | Status |
|---|---|---|---|
| Eingänge | 8 DI, stromziehend/stromliefernd | [DB-DI] | [sicher] |
| Gruppen / Bezugspotential | 2 Gruppen à 4 Eingänge mit **1M** (.0–.3) und **2M** (.4–.7) | [SH] | [prüfen] – im Plan steht eine gemeinsame Gruppe; Teil 12 „vor allem SM 1221“ |
| Standardadresse | Steckplatz 4 typisch %I16.0–%I16.7 (TIA vergibt ab %I8.0 aufsteigend – im Projekt festgelegt) | [SH] | [prüfen] |

## 5. Analogwertdarstellung (S7-1200/1500)
| Bereich | Spannung 0–10 V | Strom 4–20 mA | Rohwert (dez.) | Status |
|---|---|---|---|---|
| Überlauf | ≥ 11,852 V | ≥ 22,96 mA | 32767 (7FFF hex) | [prüfen] |
| Übersteuerung | 10,0–11,759 V | 20–22,81 mA | 27649–32511 | [sicher] |
| Nennbereich | 0–10 V | 4–20 mA | 0–27648 | [sicher] |
| Untersteuerung | – (0–10 V hat keinen negativen Nennbereich) | 1,185–4 mA | −1…−4864 | [sicher] |
| Unterlauf / Drahtbruch | < 0 V: −32768 bzw. 0 bei unipolar | < 1,185 mA | −32768 (8000 hex); bei aktivierter Drahtbruchdiagnose **32767** | [prüfen] |

Stützpunkte für Validator und Tests (Plan 8.4):
- 4 mA → 0
- 12 mA → 13824
- 20 mA → 27648
- 5 V → 13824

Diese Werte sind **[sicher]**, weil sie aus der Geradengleichung folgen.

Die Onboard-AI der CPU (0–10 V) verhalten sich im Nennbereich gleich. Überlauf- und Sonderwerte der Onboard-AI sind **[prüfen]**: Sie melden keinen Drahtbruch, weil 0 V = 0 ist.

## 6. NORM_X / SCALE_X
| Punkt | Wert | Quelle | Status |
|---|---|---|---|
| NORM_X | `OUT := (VALUE − MIN) / (MAX − MIN)`, OUT vom Typ REAL oder LREAL | [TIA] | [sicher] |
| SCALE_X | `OUT := VALUE × (MAX − MIN) + MIN`, VALUE REAL/LREAL, OUT Ganzzahl oder Gleitpunkt | [TIA] | [sicher] |
| Werte ausserhalb | keine Begrenzung – es wird linear weitergerechnet (VALUE < MIN → OUT < 0) | [TIA] | [sicher] |
| ENO | FALSE, wenn MIN ≥ MAX (NORM_X) oder das Ergebnis den Wertebereich des OUT-Typs überschreitet (SCALE_X); OUT wird dann trotzdem geschrieben | [TIA] | [prüfen] |
| Ganzzahl-Ziel | SCALE_X mit OUT vom Typ INT/DINT: im Spiel **gerundet** (kaufmännisch, bei ,5 zur geraden Zahl wie REAL_TO_INT) | [TIA] | [prüfen] – ob TIA rundet oder abschneidet |
| Typen | MIN, VALUE, MAX bei NORM_X gleicher Typ (SINT…LREAL); in SCL `NORM_X(MIN := 0, VALUE := #Roh, MAX := 27648)` mit impliziter Typangabe `NORM_X_INT_REAL` möglich | [TIA] | [prüfen] |

## 7. Sensoren (herstellerneutrale Richtwerte)
| Punkt | Wert | Status |
|---|---|---|
| M12, A-codiert, 4-polig | 1 BN = L+, 2 WH = zweiter Ausgang/NC, 3 BU = M, 4 BK = Schaltausgang (IEC 60947-5-2) | [sicher] |
| Reduktionsfaktoren induktiv | Stahl 1,0 · Edelstahl ≈ 0,7 · Messing ≈ 0,5 · Aluminium ≈ 0,4 · Kupfer ≈ 0,3 | [prüfen] – je nach Hersteller 0,6–0,9 (Edelstahl), 0,35–0,5 (Messing, Aluminium) |
| Gesicherter Schaltabstand | Sa ≤ 0,81 · Sn (Norm) | [sicher] |
| Schalthysterese | typisch 3–15 % von Sr; im Spiel 10 % | [sicher] (Vereinfachung markieren) |
| Aderfarbe DC-Steuerstromkreise im Schrank | dunkelblau (EN 60204-1), mit Aderbeschriftung | [sicher] – Schulpraxis in Teil 12 prüfen |

## Offene Punkte (für Steven, nicht blockierend)
1. Beschaltung und Gruppen der SM 1221 (eine oder zwei Bezugspotential-Gruppen).
2. Sonderwerte bei Drahtbruch und Überlauf der SM 1231 und der Onboard-AI, je nach Diagnose-Einstellung.
3. Genaue Klemmenbezeichnungen und Reihenfolge an CPU 1214C, SM 1231 und SM 1232 (Frontansicht der 3D-Module).
4. ENO-Verhalten von NORM_X/SCALE_X ausserhalb des Wertebereichs.
5. Reduktionsfaktoren und Schaltabstände (Richtwerte, im Spiel als solche gekennzeichnet).

Zum Freischalten der Recherche: Für die nächste Cloud-Sitzung die Hosts `support.industry.siemens.com` und `cache.industry.siemens.com` in den Netzwerkeinstellungen der Umgebung erlauben. Danach wird dieses Blatt gegen die PDFs abgeglichen.
