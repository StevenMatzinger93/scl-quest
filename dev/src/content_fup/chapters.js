/* ===== FUP QUEST: Kapitel ===== */
(function(){
const A = (inner) => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
// kleines FUP-Bild: zwei Eingänge, eine Box, Zuweisung, laufendes Signal
const fbd = (box, label) => '<line x1="40" y1="60" x2="110" y2="60" stroke="#39ff14" stroke-width="3" stroke-dasharray="10 8"><animate attributeName="stroke-dashoffset" values="36;0" dur="1s" repeatCount="indefinite"/></line>' +
  '<line x1="40" y1="100" x2="110" y2="100" stroke="#6c7b8a" stroke-width="3"/>' +
  '<rect x="110" y="44" width="56" height="72" rx="4" fill="#101a1f" stroke="#b9c7cf" stroke-width="2"/><text x="138" y="64" text-anchor="middle" font-size="14" font-weight="700" fill="#1ec8e0">' + box + '</text>' +
  '<line x1="166" y1="80" x2="210" y2="80" stroke="#39ff14" stroke-width="3"/><rect x="210" y="68" width="34" height="24" rx="3" fill="#101a1f" stroke="#b9c7cf" stroke-width="2"/><text x="227" y="85" text-anchor="middle" font-size="13" font-weight="700" fill="#1ec8e0">=</text>' +
  '<text x="150" y="148" text-anchor="middle" font-size="10" fill="#1ec8e0">' + label + '</text>';
defChapter({ n:1, title:'Boxen und Zuweisung', subtitle:'UND-Box · Zuweisung · Netzwerke', icon:'fa-train',
  intro:'ARIA hat sich ins <b>Stellwerk Brünigkreuz</b> geflüchtet: zwei Weichen, zwei Signale, ein Bahnübergang. Die Fahrdienstleiterin <b>Frau Gasser</b> übergibt dir das leere Programm. Du zeichnest es im <b>Funktionsplan (FUP)</b>: Signale fliessen von links in Boxen, rechts steht die <b>Zuweisung</b> an einen Ausgang.',
  anim: A(fbd('&amp;', 'Taste & Gleis_frei → = Signal_A')) });
defChapter({ n:2, title:'ODER, XOR, Negation', subtitle:'>=1 · X · negierter Eingang', icon:'fa-code-branch',
  intro:'Ein Signal darf auf <b>Halt</b> fallen, wenn irgendetwas nicht stimmt — dafür brauchst du die <b>ODER-Box</b> (>=1). Der kleine <b>Kreis</b> am Eingang negiert ein Signal, und die <b>XOR-Box</b> meldet, wenn zwei Rückmeldungen sich widersprechen.',
  anim: A(fbd('&gt;=1', 'Stoerung ODER Not_Aus → = Signal_Halt')) });
defChapter({ n:3, title:'Selbsthaltung und Verriegelung', subtitle:'Halten · Aus-Vorrang · Weichen verriegeln', icon:'fa-lock',
  intro:'Ein Tastendruck ist kurz — die Weiche soll aber umlaufen, bis sie in der Endlage ist. Mit der <b>Selbsthaltung</b> hält sich ein Ausgang über seinen eigenen Wert. Die <b>Verriegelung</b> sorgt dafür, dass eine Weiche nie gleichzeitig nach links und nach rechts läuft.',
  anim: A(fbd('&gt;=1', '(Taste ODER Lauf) & NICHT Endlage')) });
defChapter({ n:4, title:'Speicherboxen', subtitle:'S · R · SR · RS', icon:'fa-toggle-on',
  intro:'Im FUP gibt es eigene Boxen zum <b>Speichern</b>: S und R, und die Flipflops <b>SR</b> (Rücksetzen gewinnt) und <b>RS</b> (Setzen gewinnt). Eine Fahrstrasse bleibt eingestellt, bis sie aufgelöst wird; eine Störung bleibt gemeldet, bis jemand quittiert.',
  anim: A(fbd('SR', 'Taste_FS → SR (R: Aufloesung) → FS_eingestellt')) });
defChapter({ n:5, title:'Flanken', subtitle:'P-Box · N-Box · Stromstoss', icon:'fa-wave-square',
  intro:'Jede Achse, die über den Zählpunkt rollt, erzeugt einen kurzen Impuls. Soll pro Impuls genau <b>einmal</b> etwas passieren — zählen, umschalten, melden —, braucht es eine <b>Flanke</b>: Die P-Box meldet den Wechsel 0 → 1, die N-Box den Wechsel 1 → 0.',
  anim: A(fbd('P', 'Achse → P → INC Achsen')) });
defChapter({ n:6, title:'Zeiten I', subtitle:'TON · TOF · TP', icon:'fa-stopwatch',
  intro:'Bevor die Schranke schliesst, blinkt das Licht einige Sekunden. Ein Signal fällt erst nach einer Wartezeit auf Fahrt. Die Glocke läutet einen Moment. Dafür gibt es die <b>Zeitboxen</b>: TON, TOF und TP.',
  anim: A(fbd('TON', 'Zug_meldet → TON 5s → Schranke_zu')) });
defChapter({ n:7, title:'Zeiten II', subtitle:'Wechselblinker · Laufzeit · Vorläuten', icon:'fa-hourglass-half',
  intro:'ARIA spielt mit der Zeit: Die Blinklichter blinken nicht, eine klemmende Weiche wird nie gemeldet, die Schranke schliesst ohne Vorwarnung. Du baust <b>Taktgeber</b>, <b>Laufzeitüberwachungen</b> und Abläufe mit mehreren Zeiten.',
  anim: A(fbd('TON', 'W1_laeuft → TON 6s → S Weichenstoerung')) });
defChapter({ n:8, title:'Zähler', subtitle:'CTU · CTD · Achszähler', icon:'fa-list-ol',
  intro:'Ein Gleisabschnitt ist frei, wenn genauso viele Achsen hinaus- wie hineingefahren sind. Der <b>Achszähler</b> zählt am Eingang hoch und am Ausgang herunter. Dazu kommen Zugzählung und Wartungszähler für die Weichen.',
  anim: A(fbd('CTU', 'Achse_ein → CTU → Abschnitt_besetzt')) });
defChapter({ n:9, title:'Vergleicher und Werte', subtitle:'CMP · MOVE · Rechnen', icon:'fa-gauge-high',
  intro:'Züge melden ihre Geschwindigkeit, Signale haben Begriffe als Zahl, Weichen eine Nummer. Mit <b>Vergleichern</b> prüfst du Werte, mit <b>MOVE</b> überträgst du sie, und mit Rechenboxen machst du aus Achsen Zuglängen.',
  anim: A(fbd('CMP', 'Tempo > 40 → = Warnung')) });
defChapter({ n:10, title:'Fahrstrassen', subtitle:'Einstellen · Sichern · Auflösen · Final Boss', icon:'fa-route',
  intro:'Jetzt fügst du alles zusammen: Eine <b>Fahrstrasse</b> wird eingestellt (Weichen umlegen), gesichert (Weichen verschlossen, Flankenschutz, Schranke zu), dann zeigt das Signal Fahrt. Nach der Zugfahrt wird sie aufgelöst. Am Ende wartet ARIA — im Automatikbetrieb des ganzen Stellwerks.',
  anim: A(fbd('&amp;', 'FS_gesichert & Gleis_frei → = Signal_A')) });
defChapter({ n:11, pro:true, title:'Bausteine', subtitle:'FC · Schnittstelle · Aufruf-Box', icon:'fa-cubes',
  intro:'<b>Profi-Stufe.</b> ARIA hat sich im riesigen OB des alten Stellwerks versteckt. Frau Gasser will Ordnung: Jede Aufgabe bekommt einen eigenen <b>Baustein</b> mit einer <b>Schnittstelle</b>. Du beginnst mit der <b>Funktion (FC)</b>.',
  anim: A(fbd('FC', '"FC_Signal"(Taste, Frei) → Fahrt')) });
defChapter({ n:12, pro:true, title:'Funktionsbausteine', subtitle:'FB · Instanz · Multiinstanz', icon:'fa-memory',
  intro:'Eine Weiche muss sich merken, wohin sie läuft, und wie lange schon. Der <b>Funktionsbaustein (FB)</b> hat dafür ein Gedächtnis, seine <b>Instanz</b>. Jede Weiche bekommt eine eigene Instanz, Timer wohnen als <b>Multiinstanz</b> im FB.',
  anim: A(fbd('FB', '"FB_Weiche_DB"(Links, Rechts) → Lage')) });
defChapter({ n:13, pro:true, title:'Daten', subtitle:'Datenbaustein · PLC-Datentyp · Array', icon:'fa-database',
  intro:'Weichen, Gleisabschnitte, Zugnummern: Das Stellwerk hat viele Daten. Du ordnest sie in <b>globalen Datenbausteinen</b>, fasst sie in <b>PLC-Datentypen</b> (UDT) zusammen und greifst mit Boxen darauf zu.',
  anim: A(fbd('&amp;', '"DB_Gleis".Abschnitt[2].Frei')) });
defChapter({ n:14, pro:true, title:'Standardbausteine', subtitle:'Weiche · Signal · Bahnübergang', icon:'fa-toolbox',
  intro:'Ein Stellwerk hat viele gleiche Elemente. Die baust du einmal als <b>Standardbaustein</b> — Weiche, Signal, Bahnübergang, Meldung — und setzt sie überall ein. Sie arbeiten nur über ihre Schnittstelle.',
  anim: A(fbd('FB', 'Weiche → Signal → Bahnübergang')) });
defChapter({ n:15, pro:true, title:'Das Stellwerksprogramm', subtitle:'OB1 · OB100 · Standard · Final Boss 2', icon:'fa-tower-observation',
  intro:'Zum Schluss baust du das ganze <b>Stellwerksprogramm</b>: Anlauf im <b>OB100</b>, zyklischer Ablauf im <b>OB1</b>, Standardbausteine, Datenbausteine — sauber und ohne Warnungen. ARIA hat nur noch ein Versteck.',
  anim: A(fbd('OB1', 'OB1 → Weichen → Fahrstrasse → Signale')) });
})();
