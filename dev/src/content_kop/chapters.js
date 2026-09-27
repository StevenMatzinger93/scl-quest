/* ===== KOP QUEST: Kapitel ===== */
(function(){
const A = (inner) => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
// kleines Leiterbild für die Kapitel-Intros: Stromschienen, Kontakte, Spule, laufender Stromfluss
const rung = (label, cls) => '<line x1="30" y1="20" x2="30" y2="140" stroke="#6b6f58" stroke-width="4"/><line x1="270" y1="20" x2="270" y2="140" stroke="#6b6f58" stroke-width="4"/>' +
  '<line x1="30" y1="80" x2="270" y2="80" stroke="#39ff14" stroke-width="3" stroke-dasharray="10 8"><animate attributeName="stroke-dashoffset" values="36;0" dur="1s" repeatCount="indefinite"/></line>' +
  '<rect x="80" y="62" width="30" height="36" fill="#121212"/><line x1="84" y1="64" x2="84" y2="96" stroke="#e0e0e0" stroke-width="3"/><line x1="106" y1="64" x2="106" y2="96" stroke="#e0e0e0" stroke-width="3"/>' +
  (cls === 'nc' ? '<line x1="87" y1="94" x2="103" y2="66" stroke="#e0e0e0" stroke-width="3"/>' : '') +
  '<rect x="196" y="60" width="34" height="40" fill="#121212"/><path d="M204 64 Q196 80 204 96 M222 64 Q230 80 222 96" stroke="#ffb000" stroke-width="3" fill="none"/>' +
  '<text x="150" y="150" text-anchor="middle" font-size="10" fill="#ffb000">' + label + '</text>';
defChapter({ n:1, title:'Strom fliesst', subtitle:'Schliesser · Spule · Reihe', icon:'fa-bolt',
  intro:'ARIA hat sich aus der Roboterzelle in die Bergstation der <b>Gratbahn</b> gerettet. Der Schaltschrank ist leer — du zeichnest die Steuerung neu, als <b>Kontaktplan</b>: links die Stromschiene, dann Kontakte, rechts die Spulen. Fliesst Strom bis zur Spule, schaltet sie.',
  anim: A(rung('S_Licht ──| |── ( Beleuchtung )')) });
defChapter({ n:2, title:'Öffner und Parallelzweige', subtitle:'Öffner · ODER · Mischformen', icon:'fa-code-branch',
  intro:'Ein Schalter allein reicht selten. Du lernst den <b>Öffner</b> (leitet, solange das Signal 0 ist), <b>Parallelzweige</b> (ODER) und wie Reihe und Parallel zusammenspielen — und warum ein Not-Halt immer als Öffner verdrahtet ist.',
  anim: A(rung('Tuer_Zu ──|/|── ( Ampel_Rot )', 'nc')) });
defChapter({ n:3, title:'Selbsthaltung', subtitle:'Selbsthaltung · Vorrang · Verriegelung', icon:'fa-lock',
  intro:'Ein Tastendruck ist kurz — der Antrieb soll aber weiterlaufen. Die <b>Selbsthaltung</b> hält die Spule über ihren eigenen Kontakt. Dazu kommen Aus-Vorrang, Ein-Vorrang und die <b>Verriegelung</b>, damit die Bahn nie gleichzeitig berg- und talwärts will.',
  anim: A(rung('( S_Start ODER Antrieb ) UND NICHT S_Stopp')) });
defChapter({ n:4, title:'Setzen und Rücksetzen', subtitle:'S · R · Störung speichern', icon:'fa-toggle-on',
  intro:'Manche Zustände müssen gespeichert bleiben, auch wenn das Signal verschwindet — eine Störung zum Beispiel, bis jemand <b>quittiert</b>. Die Spulen <b>S</b> (Setzen) und <b>R</b> (Rücksetzen) machen das, und die Reihenfolge der Netzwerke entscheidet, wer Vorrang hat.',
  anim: A(rung('Seil_Fehler ──| |── ( S Stoerung )')) });
defChapter({ n:5, title:'Flanken', subtitle:'P-Flanke · N-Flanke · Stromstoss', icon:'fa-wave-square',
  intro:'Ein Taster ist oft viele Zyklen lang gedrückt. Soll trotzdem nur <b>einmal</b> etwas passieren — ein Fahrgast gezählt, ein Licht umgeschaltet —, braucht es eine <b>Flanke</b>: Die P-Flanke meldet genau den Zyklus, in dem ein Signal von 0 auf 1 wechselt.',
  anim: A(rung('──|P|── Drehkreuz → INC Fahrgaeste')) });
defChapter({ n:6, title:'Zeiten I', subtitle:'TON · TOF · TP', icon:'fa-stopwatch',
  intro:'Türen schliessen nicht sofort, eine Hupe tönt eine Sekunde, ein Lüfter läuft nach. Zeitglieder sitzen im Kontaktplan als <b>Box</b> im Strompfad: TON verzögert das Einschalten, TOF das Ausschalten, TP erzeugt einen Impuls.',
  anim: A(rung('Kabine_da ──[ TON 3s ]── ( Tuer_Auf )')) });
defChapter({ n:7, title:'Zeiten II', subtitle:'Blinker · Überwachung · Vorwarnung', icon:'fa-hourglass-half',
  intro:'ARIA spielt mit der Zeit: Die Warnlampe blinkt nicht, die Tür klemmt ohne Meldung, die Bahn fährt ohne Vorwarnung an. Du baust Blinker, <b>Überwachungszeiten</b> und Anlaufwarnungen — und schaltest bei Sturm verzögert ab.',
  anim: A(rung('Warnung ──[ TON ]──[ TON ]── Blinker')) });
defChapter({ n:8, title:'Zähler', subtitle:'CTU · CTD · Fahrgäste', icon:'fa-list-ol',
  intro:'Wie viele Fahrgäste sind eingestiegen? Ist die Kabine voll? Wie viele Fahrten noch bis zur Wartung? <b>Zähler</b> zählen Flanken am Eingang: CTU aufwärts, CTD abwärts, mit Rücksetzen und Vorgabewert.',
  anim: A(rung('Drehkreuz ──[ CTU PV 8 ]── ( Kabine_voll )')) });
defChapter({ n:9, title:'Vergleicher und Werte', subtitle:'Vergleich · MOVE · Rechnen', icon:'fa-gauge-high',
  intro:'Windmesser, Seilgeschwindigkeit, Temperatur im Antrieb: Messwerte werden im Kontaktplan mit <b>Vergleichskontakten</b> geprüft, Werte mit <b>MOVE</b> übertragen und mit ADD/SUB berechnet. Bei zu viel Wind muss die Bahn stehen — mit Hysterese, damit sie nicht flattert.',
  anim: A(rung('──[ Wind > 60 ]── ( Windwarnung )')) });
defChapter({ n:10, title:'Sicherheitskette und Ablauf', subtitle:'Sicherheitskette · Schrittkette · Final Boss', icon:'fa-link',
  intro:'Jetzt fügst du alles zusammen: Die <b>Sicherheitskette</b> (Türen, Seil, Not-Halt, Wind) gibt den Antrieb frei, eine <b>Schrittkette</b> mit S/R-Merkern steuert Einsteigen, Türen schliessen, Vorwarnung und Fahrt. Am Ende wartet ARIA — im Automatikbetrieb der ganzen Station.',
  anim: A(rung('Kette_OK ──| |── Schritt 3 ── ( Antrieb )')) });
defChapter({ n:11, pro:true, title:'Bausteine', subtitle:'FC · Schnittstelle · Aufruf-Box', icon:'fa-cubes',
  intro:'<b>Profi-Stufe.</b> ARIA hat sich im Programm der Talstation versteckt — einem riesigen, unübersichtlichen OB. Der Werkmeister will Ordnung: Jede Aufgabe bekommt einen eigenen <b>Baustein</b> mit einer <b>Schnittstelle</b> (Eingänge, Ausgänge). Du beginnst mit der <b>Funktion (FC)</b> — ohne Gedächtnis, aber beliebig oft wiederverwendbar.',
  anim: A(rung('"FC_Freigabe"(Tuer_Zu, Seil_OK) → Freigabe')) });
defChapter({ n:12, pro:true, title:'Funktionsbausteine', subtitle:'FB · Instanz · Multiinstanz', icon:'fa-memory',
  intro:'Eine Selbsthaltung, eine gespeicherte Störung, ein Timer — das alles braucht ein <b>Gedächtnis</b>. Der <b>Funktionsbaustein (FB)</b> hat eines: seine <b>Instanz</b>. Jeder Antrieb bekommt seine eigene Instanz, Timer wohnen als <b>Multiinstanz</b> im FB.',
  anim: A(rung('"FB_Antrieb_DB"(Start, Stopp) → Laeuft')) });
defChapter({ n:13, pro:true, title:'Daten', subtitle:'Datenbaustein · PLC-Datentyp · Array', icon:'fa-database',
  intro:'Kabinen, Fahrgäste, Grenzwerte: Die Station hat viele Daten, und ARIA verstreut sie überall. Du ordnest sie in <b>globalen Datenbausteinen</b>, fasst zusammengehörige Werte in <b>PLC-Datentypen</b> (UDT) zusammen und greifst über Vergleicher, Kontakte und MOVE darauf zu.',
  anim: A(rung('"DB_Station".Kabine[1].Besetzt ── ( Ampel_Rot )')) });
defChapter({ n:14, pro:true, title:'Standardbausteine', subtitle:'Tür · Sicherheitskette · Antrieb', icon:'fa-toolbox',
  intro:'Gute Bausteine baut man einmal und setzt sie überall ein: eine <b>Türsteuerung</b>, eine <b>Sicherheitskette</b>, einen <b>Antrieb</b>. Sie greifen nie direkt auf globale Variablen zu, sondern bekommen alles über ihre Schnittstelle — so passen sie in jede Station.',
  anim: A(rung('Kette.OK ──| |── "FB_Antrieb"(Freigabe)')) });
defChapter({ n:15, pro:true, title:'Das Stationsprogramm', subtitle:'OB1 · OB100 · Standard · Final Boss 2', icon:'fa-mountain-sun',
  intro:'Zum Schluss baust du das ganze <b>Stationsprogramm</b>: Anlauf im <b>OB100</b>, zyklischer Ablauf im <b>OB1</b>, Standardbausteine, Datenbausteine — sauber, kommentiert und ohne Warnungen. ARIA hat nur noch einen Ort, um sich zu verstecken.',
  anim: A(rung('OB1 → Kette → Tuer → Antrieb → HMI')) });
})();
