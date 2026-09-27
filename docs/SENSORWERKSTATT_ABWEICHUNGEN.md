# Sensorwerkstatt – Abweichungen von der Realität

Die Sensorwerkstatt bildet Arbeitsweise und Begriffe realistisch ab. Wo das Spiel vereinfacht, steht es hier (Plan Teil 8.1). Werte, die ohne Zugriff auf die Siemens-Handbücher übernommen wurden, sind zusätzlich in `docs/SENSORWERKSTATT_FAKTEN.md` mit **[prüfen]** markiert.

## Elektrik und Verdrahtung
- **Netzliste statt Schaltungssimulation:** Bewertet wird, welche Klemmstellen auf demselben Potential liegen (L+, M oder offen). Spannungsabfälle, Leitungswiderstände und Ströme ausserhalb der Analogschleifen werden nicht berechnet.
- **Multimeter:** V DC kennt nur 24 V (L+ bzw. aktiver PNP-Ausgang) und 0 V (M bzw. aktiver NPN-Ausgang). Analoge Spannungen (0–10 V) werden aus dem Modell berechnet, nicht über das Messgerät angezeigt. Ein offener Knoten zeigt 0 V (im echten Schrank wäre der Wert unbestimmt).
- **Geberversorgung der CPU** (`A1:SL+`, `A1:SM`) liegt im Modell am selben 24-V-Netz wie -G1.
- **Querbrücker** verbinden immer die ganze Ebene L+ bzw. M von -X2 mit -X1:L+1 bzw. -X1:M1.
- **Signalebene von -X2** ist eine Durchgangsklemme mit zwei Klemmstellen (Feld- und SPS-Seite); die Ebenen L+/M haben je eine.
- **Kurzschlussschutz:** Signalader BK auf M lässt den Sensor abschalten (LED blinkt); ein realer Sensor kann je nach Typ anders reagieren.
- **Wackelkontakt** (Ader ohne Aderendhülse, M12 nicht festgezogen) ist ein deterministisches Aussetzmuster, kein Zufall.
- **Kalibrator:** Quelle und Senke speisen den gewählten Kanal direkt; die Klemmung an Messbuchsen wird nicht einzeln nachgebildet.

## Sensoren
- **Reduktionsfaktoren** (Stahl 1,0 · Edelstahl 0,7 · Aluminium 0,4 · Messing 0,5) sind Richtwerte; Hersteller geben abweichende Werte an.
- **Schalthysterese** fest 10 %.
- **Kapazitiver Sensor:** Poti 0…1 = Empfindlichkeit; ein Material wird erkannt, wenn sein Faktor ≥ 1 − Poti ist, Reichweite Sn × Poti.
- **Lichttaster mit Hintergrundausblendung:** Teach-in übernimmt den aktuellen Abstand zum Band; erkannt wird bis 3 mm davor. Hell-/Dunkelschaltung von -B3 ist nur Gegenstand von Fragen, nicht einstellbar.
- **Lichtschranken ausrichten:** zwei Stellschrauben (h/v) mit ganzen Schritten; ruhig bis ±1, blinkt bis ±3, sonst kein Lichtempfang.
- **Reflexions-Lichtschranke und Glas:** Glas wird als „unsicher“ modelliert (im Modell nicht erkannt).
- **NPN-Übungssensor:** Es gibt nur einen NPN-Sensor (-N1).
- **Nicht festgezogene Sensoren** wandern nur, wenn die Simulation läuft (Drift 0,02 mm/s).

## S7-1200 und Engineering
- **SM 1221:** Zwei Eingangsgruppen 1M (.0–.3) und 2M (.4–.7) **[prüfen]**.
- **SM 1231:** Messarten „Strom 2-Draht“ und „Strom 4-Draht“ werden wie im Plan angeboten; ob die Baugruppe die 2-Leiter-Schleife selbst versorgt, ist **[prüfen]** (im Spiel kommt die Versorgung über L+).
- **Sonderwerte:** 32767 bei Drahtbruch/Überlauf, −32768 bei Unterlauf, Übersteuerung bis 32511, Untersteuerung bis −4864 **[prüfen]**.
- **Glättung:** keine/schwach/mittel/stark = gleitender Mittelwert über 1/4/16/32 Zyklen **[prüfen]**.
- **Adressen der Signalbaugruppen** sind Vorschläge (Plan 2.4); TIA vergibt Standardadressen, die man ändern kann.
- **Variablentabelle:** Namen ohne Leerzeichen, keine Arrays/Strukturen; Datentypen Bool, Int, UInt, DInt, Real, Word, DWord, Byte.
- **Programm:** nur OB1 (SCL, KOP oder FUP) plus globale Instanzen für IEC-Zeiten und Flanken; kein OB100, keine eigenen Bausteine. Ohne Anführungszeichen geschriebene Variablennamen werden ebenfalls akzeptiert.
- **SCALE_X in ein INT-Ziel** rundet **[prüfen]**; ENO wird nicht nachgebildet.
- **Laden:** Programm, Variablentabelle und Hardwarekonfiguration werden immer gemeinsam geladen; die CPU geht dabei in STOP.
- **Spannungsausfall** (-Q0 aus) versetzt die CPU in STOP; nach dem Einschalten muss sie neu gestartet werden.

## Tankstation
- Tankphysik mit Masse- und Energiebilanz, aber ohne Verzögerung der Messumformer; der Ultraschall hat eine Blindzone unter 60 mm.
- Keine Kalibrierfehler der Transmitter: Offsets entstehen im Spiel über eine abweichende Einbauhöhe.
- Schirm-Rauschen ±1,5 % ohne Schirmauflage, ±0,05 % mit; keine echten EMV-Effekte.

## Aufgaben
- Alle Arbeitsschritte werden am **Endzustand** geprüft. Eine Aufgabe kann deshalb nicht zwei verschiedene Montagepositionen nacheinander verlangen; Zwischenwerte werden als Messwerte eingetragen.
- Programmtests laufen mit Eingangswerten je Variable bzw. mit physikalischen Szenarien, die das Modell mit der Konfiguration der Aufgabe in Rohwerte umrechnet – unabhängig von der Verdrahtung.
