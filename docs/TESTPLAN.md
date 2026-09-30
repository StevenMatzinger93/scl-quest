# Testplan: Praxistest SCL Quest mit Portal und Live-Challenge

Stand: 26.09.2026 · für Steven und die Klasse (Lernende ab ca. 15 Jahren)

## Ziel

1. Klären, ob Lernende mit SCL Quest selbständig SCL lernen können (Kapitel 1–5 Grundstufe, Profi-Stufe mit Fortgeschrittenen).
2. Prüfen, ob Portal, Konten und Klassenverwaltung im Unterricht ohne Reibung laufen.
3. Die **Live-Challenge** (Speedrun und Störungsjagd) mit der ganzen Klasse am Beamer testen.
4. Rückmeldungen über das Feedback-Formular im Portal sammeln (anonym für die Lehrperson).

## Vorbereitung (einmalig, ca. 20 Minuten)

| # | Schritt | Wo | Erledigt |
|---|---------|----|----------|
| V1 | Mit dem Admin-Konto (Secrets `ADMIN_USER`/`ADMIN_PASSWORD`) anmelden: Portal → *Leitstand · Anmelden* | Portal | ☐ |
| V2 | Unter *Administration* ein Dozentenkonto anlegen (z. B. `smatzinger`), Startpasswort notieren | Portal | ☐ |
| V3 | Abmelden, mit dem Dozentenkonto anmelden, eigenes Passwort setzen | Portal | ☐ |
| V4 | Im *Leitstand* eine Klasse anlegen (z. B. „EM 3a – Test“) | Leitstand | ☐ |
| V5 | Entweder: Klassencode an die Tafel/den Beamer (Lernende melden sich selbst mit Pseudonym an)  **oder**: *Konten erzeugen* (Präfix, Anzahl) und *Zugangszettel drucken* | Leitstand | ☐ |
| V6 | Impressum und Datenschutz: Platzhalter `[[…]]` in `dev/portal/impressum.html` und `dev/portal/datenschutz.html` ersetzen, rechtlich prüfen lassen, neu bauen | Repo | ☐ |
| V7 | Beamer testen: *Leitstand → Neue Live-Challenge* anlegen, Beamer-Ansicht im Vollbild prüfen (Code lesbar aus der letzten Reihe?), Challenge wieder schliessen | Leitstand | ☐ |
| V8 | Schul-WLAN: Portal-Adresse auf einem Schulgerät und einem Handy öffnen (Proxy/Filter?) | Schule | ☐ |

**Hinweis für die Lernenden (Datenschutz):** Nur Pseudonyme verwenden, keine echten Namen. Beim ersten Login erscheint ein Hinweis, dass die Lehrperson Fortschritt und Code sieht.

## Ablauf im Unterricht

### Lektion 1 (45 min): Einstieg

| Zeit | Was | Beobachten |
|------|-----|-----------|
| 5 min | Portal zeigen (Hallen, ARIA), Klassencode an den Beamer, alle melden sich an | Klappt die Selbstanmeldung? Wie viele brauchen Hilfe? Pseudonyme ok? |
| 30 min | Selbständig: SCL Quest → Kapitel 1 (Theorie A, Aufgaben 1–5, Theorie B, …) | Wo bleiben Lernende hängen? Werden Hinweise genutzt? Handbuch? |
| 5 min | Im Leitstand die Klassenliste zeigen (Fortschritt live) | Werden Fortschritte sofort sichtbar (Aktualisieren)? |
| 5 min | Kurze Besprechung: häufigster Fehler | Lernende-Code in der Schülerdetailansicht ansehen |

### Lektion 2 (45 min): Live-Challenge

| Zeit | Was | Beobachten |
|------|-----|-----------|
| 5 min | Speedrun anlegen: Kapitel 1 oder 2, eine bereits bekannte Aufgabe, 5 Minuten. Code an den Beamer, Lernende: Portal → *Live-Challenge* → Code | Beitritt in < 1 min? Alle Namen am Beamer sichtbar? |
| 5 min | Speedrun läuft | Countdown, Rangliste aktualisiert sich (alle 2–3 s)? Stimmung? |
| 5 min | Siegerehrung, eine Lösung anonym zeigen und mit der Musterlösung besprechen | Ist der Vergleich am Beamer lesbar? |
| 10 min | **Störungsjagd** anlegen (z. B. Kapitel 2 „Motor lässt sich nicht halten“ oder Kapitel 3 „Negative Gewichte“), 8 Minuten | Finden Lernende den Fehler über die Testfälle? Wie viele Versuche? |
| 5 min | Siegerehrung, Fehler gemeinsam besprechen | |
| 10 min | Weiterspielen in SCL Quest | |
| 5 min | **Feedback-Formular**: Portal → Menü unter dem Namen → *Feedback geben* (oder Adresse `…/#/feedback`) | Anzahl Rückmeldungen im Leitstand (Klassenansicht, unten) |

### Zwischen den Lektionen (Hausaufgabe, optional)

- Zu Hause weiterspielen (anderes Gerät): Fortschritt muss mitkommen.
- Wer möchte: bis Kapitel 5 kommen.

### Lektion 3 (optional, Fortgeschrittene): Profi-Stufe

- Kapitel 11 (Deklarationen, FB) mit 2–3 fortgeschrittenen Lernenden, Rest weiter in der Grundstufe.
- Speedrun mit Kapitel 11 für die ganze Klasse ist eher zu schwer → Störungsjagd Kapitel 11 „Palette sofort leer“ testen.

## Technische Testfälle (Checkliste für Steven)

| # | Test | Erwartet | ok? | Bemerkung |
|---|------|----------|-----|-----------|
| T1 | Portal auf PC (Chrome/Edge/Firefox) öffnen | Hallen mit 4 Toren, ARIA-Text, SCL-Tor öffnet sich beim Darüberfahren | ☐ | |
| T2 | Portal auf dem Handy | Tore 2×2, Anmelden-Knopf, kein seitliches Scrollen | ☐ | |
| T3 | Selbstanmeldung mit Klassencode | Klasse wird erkannt, Konto angelegt, Hinweis zur Einsicht erscheint einmal | ☐ | |
| T4 | Erzeugtes Konto (Zugangszettel) | Beim ersten Login Pflicht zum Passwortwechsel | ☐ | |
| T5 | Ohne Konto spielen, dann anmelden | Frage „Spielstand ins Konto übernehmen?“, danach im Leitstand sichtbar | ☐ | |
| T6 | Auf Gerät A spielen, auf Gerät B anmelden | Fortschritt von A ist auf B da (Seite neu laden) | ☐ | |
| T7 | Geteilter PC: Konto 1 abmelden, Konto 2 anmelden | Konto 2 sieht **nicht** den Stand von Konto 1 | ☐ | |
| T8 | Passwort vergessen: Dozent setzt zurück | Neues Startpasswort, alte Sitzungen abgemeldet | ☐ | |
| T9 | 5× falsches Passwort | Sperre 15 min mit verständlicher Meldung | ☐ | |
| T10 | Leitstand: Schülerdetail | Aufgabenraster (Sterne/Entwurf), Klick zeigt Code | ☐ | |
| T11 | Live-Challenge Speedrun mit ≥ 10 Lernenden | Beitritt, Start, Rangliste, Podest, Ende für alle gleichzeitig | ☐ | |
| T12 | Live-Challenge Störungsjagd | Fehlerversion im Editor, Störungsmeldung sichtbar, Lösung wird gewertet | ☐ | |
| T13 | Spät beitreten (nach dem Start) | Aufgabe erscheint sofort, Restzeit stimmt | ☐ | |
| T14 | Browser während der Challenge neu laden | Challenge läuft weiter, Versuche bleiben erhalten | ☐ | |
| T15 | Offline: WLAN aus, SCL Quest (installiert oder bereits geöffnet) | Spiel läuft weiter; nach dem Wiederverbinden wird der Stand übertragen | ☐ | |
| T16 | Feedback-Formular | Absenden ok, Auswertung im Leitstand (Klassenansicht) | ☐ | |
| T17 | Konto löschen (Lernende, *Konto*) | Konto und Spielstand weg | ☐ | |

## Erfolgskriterien

- ≥ 90 % der Lernenden sind nach 5 Minuten angemeldet und spielen.
- Keine Blocker (Absturz, Datenverlust, Challenge hängt).
- Live-Challenge: Rangliste aktualisiert für alle, Siegerehrung funktioniert; Mehrheit bewertet „Live-Challenge motiviert“ mit ≥ 4.
- Feedback: Durchschnitt „verständlich“ und „gelernt“ ≥ 3,5.

## Fehler melden

Pro Fehler notieren: **Gerät/Browser**, **Pseudonym**, **Kapitel/Aufgabe**, **was gemacht**, **was passiert**, **was erwartet**, Uhrzeit (für die Protokolle), wenn möglich Screenshot.
Sammeln in einem GitHub-Issue pro Fehler oder gesammelt in einer Nachricht an Claude (neue Sitzung: „Lies docs/STAND.md und docs/TESTPLAN.md, hier die Befunde aus dem Praxistest: …“).

## Auswertung nach dem Test

1. Leitstand → Klasse → *Feedback der Klasse* (Mittelwerte, Auswahlfragen, Freitexte).
2. Leitstand → Klassenliste: Wie weit sind die Lernenden gekommen? Wo sind viele Fehlversuche/Hinweise?
3. Befunde nach Priorität ordnen (Blocker / stört / Wunsch) und in `docs/STAND.md` unter „Praxistest“ eintragen.

## Papierversion des Feedback-Formulars (falls kein Gerät verfügbar)

Skala 1 = trifft nicht zu … 5 = trifft voll zu

1. Die Aufgaben und Erklärungen waren verständlich. ☐1 ☐2 ☐3 ☐4 ☐5
2. Die Live-Anlage (2D/3D) hat mir geholfen, mein Programm zu verstehen. ☐1 ☐2 ☐3 ☐4 ☐5
3. Hinweise und Fehlermeldungen haben mir weitergeholfen. ☐1 ☐2 ☐3 ☐4 ☐5
4. Ich habe etwas über SCL gelernt. ☐1 ☐2 ☐3 ☐4 ☐5
5. Das Spiel hat Spass gemacht. ☐1 ☐2 ☐3 ☐4 ☐5
6. Die Live-Challenge hat mich motiviert. ☐1 ☐2 ☐3 ☐4 ☐5
7. Ich würde SCL Quest weiterempfehlen. ☐1 ☐2 ☐3 ☐4 ☐5
8. Schwierigkeitsgrad: ☐ zu leicht ☐ passend ☐ zu schwer
9. Gerät: ☐ PC/Laptop ☐ Tablet ☐ Handy · gekommen bis Kapitel: ☐1–2 ☐3–5 ☐6–10 ☐11–15
10. Was war gut? ………………………………………
11. Was war unklar, schwierig oder hat gestört? ………………………………………
12. Fehler gefunden? Wo und was ist passiert? ………………………………………
