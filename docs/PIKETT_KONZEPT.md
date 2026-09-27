# Pikettdienst – Konzept (Kurzfassung)

Plan: `docs/PLAN_ZERTIFIKAT_PIKETT.md` Teil B. Dieses Blatt hält die Entscheidungen fest, die der Plan offenlässt.

## Idee
Lernende übernehmen eine Schicht als Instandhalter an der Anlage ihrer Quest. Die Anlage produziert, Störungen treten zeitversetzt auf, Stillstand kostet. Ursache finden (Diagnose), beheben (Code, Instandhaltungsauftrag oder Parameter), wieder anfahren. Am Ende steht ein Schichtbericht mit Verfügbarkeit, MTTR, Ausfallkosten und Punkten.

## Störungsarten
| Art | Was ist falsch | Wie sieht man es | Behebung | Prüfung beim Wiederanfahren |
|---|---|---|---|---|
| `program` | Fehler im Programm (Störungsszenario aus `bugs.js`) | Szenario-Tests scheitern, Anlage verhält sich falsch | Code im Editor korrigieren | Programm besteht die Tests der Spielaufgabe |
| `hardware` | Eingang hängt fest (`force`), Programm ist richtig | Tests mit `force` scheitern, Beobachten zeigt den festen Wert | Diagnose + Instandhaltungsauftrag für das richtige Bauteil | Diagnose (Kategorie und Bauteil) stimmt; danach läuft die Referenz ohne `force` |
| `operator` | Parameter/Betriebsart am HMI falsch (`force` auf einen Parameter) | Anlage steht oder produziert falsch | Diagnose + richtigen Wert am HMI einstellen | Kategorie stimmt und Parameter richtig |

## Ursachenliste (feste IDs)
`prog_logic` Logik/Verknüpfung · `prog_compare` Vergleich/Grenzwert · `prog_timer` Zeit/Timer · `prog_edge` Flanke/Zählen · `prog_address` Adressierung/Index/Datenbaustein · `prog_order` Reihenfolge/Zyklus · `hw_sensor` Sensor defekt/verschmutzt · `hw_wire` Drahtbruch · `hw_actuator` Aktor defekt (Rückmeldung bleibt aus) · `hw_estop` Not-Halt/Sicherheitskreis · `op_mode` falsche Betriebsart/Parameter.
Die Ursache eines Programmfehlers wird aus der Änderung des Szenarios abgeleitet (Vergleichsoperator → `prog_compare`, Zeitwert/TON → `prog_timer`, Flanke/Zähler → `prog_edge`, Index/DB → `prog_address`, vertauschte Anweisungen → `prog_order`, sonst `prog_logic`) und kann im Szenario mit `cause` überschrieben werden. Bewertet wird die Kategorie; die Unterart bringt beim Programmfehler keinen Abzug.

## Alarmnummern (je Anlage eigener Nummernkreis)
| Quest | Anlage | Programm | Hardware | Bedienung |
|---|---|---|---|---|
| SCL | Roboterzelle RZ-03 | 1001–1499 | 1501–1799 | 1801–1899 |
| KOP | Seilbahn Gratbahn | 2001–2499 | 2501–2799 | 2801–2899 |
| FUP | Stellwerk Brünigkreuz | 3001–3499 | 3501–3799 | 3801–3899 |
| AWL | Walzwerk Keller 2 | 4001–4499 | 4501–4799 | 4801–4899 |
| Sensorwerkstatt | Prüfstand | 5001–5499 | 5501–5799 | 5801–5899 |
Priorität: 1 = Sicherheit/Stillstand der ganzen Anlage, 2 = Teilanlage steht, 3 = Qualität/Meldung. Ausfallkosten je Anlage fest: Roboterzelle CHF 38/min, Seilbahn CHF 55/min, Stellwerk CHF 70/min, Walzwerk CHF 90/min, Prüfstand CHF 20/min.

## Schicht
- Tagschicht 10 min (2 Störungen, Hinweise), Spätschicht 15 min (3–4, weniger Hinweise: 1 statt 2), Nachtschicht 20 min (4–6, bis 2 gleichzeitig offen, keine Hinweise, Hardware ≥ 40 %).
- Zeitplan per Seed: erste Störung nach 45–90 s, weitere mit Abstand; eine neue Störung kommt erst, wenn höchstens eine (Nacht: zwei) offen ist.
- Nur Störungen aus Kapiteln, deren Aufgaben die Person gelöst hat (Kapitel zählt, wenn alle Aufgaben bis zur Störungsaufgabe gelöst sind). Ohne gelöste Kapitel: Hinweis „Zuerst Kapitel 1 spielen“.
- Schichtuhr läuft in Echtzeit; Stillstand zählt ab Alarm bis zum erfolgreichen Wiederanfahren. Verfügbarkeit = 1 − Stillstand / Schichtdauer (bei gleichzeitigen Störungen zählt die Zeit einmal).
- Punkte wie im Plan B.3.

## Oberfläche (Spielhülle `app.js`, Modul `pikett.js`)
- Einstieg: Titelbildschirm und Karte „Pikettdienst“ sowie im Portal je Tor.
- Schichtbildschirm = Spielansicht mit Szene und Editor, darüber Alarmleiste und Kennzahlen. Die Szene spielt im Normalbetrieb die Referenzläufe der Grundaufgabe in Schleife, bei einer offenen Störung die fehlerhaften Läufe (Programm- oder `force`-Version).
- Arbeitsansicht je Störung: Editor mit dem Programm (Fehlerversion bzw. korrekt), Beobachten mit Live-Werten, Knöpfe „Diagnose“, „Instandhaltungsauftrag“ (nur Hardware), „Parameter“ (nur Bedienung), „Wieder anfahren“. Die Diagnose ist Pflicht vor dem Wiederanfahren.
- Ton über das vorhandene SFX-System (Hupe), abschaltbar mit „Ton aus“.
- Offline-Datei: Schichten und Rang lokal (`S.pikett`), Hinweis auf das Portal für Rangliste und Nachweis.

## Server
- Migration 7: `pikett_shifts` (Plan B.6) und `pikett_ranks` (user_id, quest, rank, reached_at – Quelle für die Zertifikatszeile, `worker/cert.js` liest sie bereits).
- Übungsbewertung im Browser; der Server speichert Berichte. Für den Rang „Pikettchef“ zählen nur Nachtschichten, die der Worker nachprüft: Code jeder Programmbehebung wird mitgeschickt und mit den Szenario-Tests bewertet, Hardware-/Bedien-Diagnosen werden mit der Störung verglichen (gleiche CPU-Regeln wie Teil A).

## Sensorwerkstatt
Die Sensorwerkstatt bekommt einen eigenen Pikett-Modus mit dem Prüfstand als Anlage: Störungen sind die Fehlersuche-Aufgaben und aus `sensor_model.js` erzeugte Hardwarefehler (lose M12, Drahtbruch, Sensor verstellt, Trennmesser offen, Konfiguration). Er folgt nach den vier Programmier-Quests (eigene Arbeitsansicht: Werkstatt statt Editor).
