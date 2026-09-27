/* ===== AWL QUEST: Kapitel ===== */
(function(){
const A = (inner) => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
// kleines AWL-Bild: drei Zeilen mit Statusspalte, die aktuelle Zeile wandert
const stl = (l1, l2, l3, v) => '<rect x="20" y="20" width="260" height="120" rx="6" fill="#0f0c0a" stroke="#4a3a30"/>' +
  [l1, l2, l3].map((l, i) => '<text x="34" y="' + (54 + i * 30) + '" font-size="15" fill="#e8e0da">' + l + '</text><rect x="210" y="' + (40 + i * 30) + '" width="22" height="18" rx="3" fill="' + (v[i] ? '#1c4d12' : '#2a2a2a') + '"/><text x="221" y="' + (54 + i * 30) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + (v[i] ? '#39ff14' : '#8a8a8a') + '">' + (v[i] ? 1 : 0) + '</text>').join('') +
  '<rect x="24" y="38" width="252" height="22" rx="3" fill="rgba(255,90,54,.18)"><animate attributeName="y" values="38;68;98;38" dur="3s" repeatCount="indefinite"/></rect>';
defChapter({ n:1, title:'Erste Anweisungen', subtitle:'U · = · VKE · Erstabfrage', icon:'fa-list-ol',
  intro:'Im Keller unter der Fabrikhalle steht das <b>alte Walzwerk</b> — gesteuert von einer <b>S7-300</b>, die seit zwanzig Jahren niemand angefasst hat. ARIA hat sich darin eingenistet. Der alte Walzmeister <b>Herr Brunner</b> zeigt dir die <b>Anweisungsliste (AWL)</b>: eine Anweisung pro Zeile, und bei jeder Zeile weisst du, was im <b>VKE</b> steht.',
  anim: A(stl('U  S_Rollgang', 'U  Not_Aus_OK', '=  Rollgang', [1, 1, 1])) });
defChapter({ n:2, title:'Verknüpfungen', subtitle:'UN · O · ON · X · Klammern', icon:'fa-code-branch',
  intro:'Das Walzgerüst darf nur laufen, wenn <b>eine</b> von zwei Kühlpumpen läuft und <b>keine</b> Störung ansteht. Dafür brauchst du ODER (<code>O</code>), die negierten Abfragen (<code>UN</code>, <code>ON</code>), das Exklusiv-ODER (<code>X</code>) — und die <b>Klammern</b>, denn in AWL gilt: UND vor ODER.',
  anim: A(stl('U  S_Walzen', 'U( O K1 O K2 )', '=  Walzen', [1, 1, 1])) });
defChapter({ n:3, title:'Speichern', subtitle:'S · R · Selbsthaltung · NOT · SET', icon:'fa-toggle-on',
  intro:'Ein Tastendruck dauert eine halbe Sekunde, das Walzen eine halbe Stunde. <b>S</b> und <b>R</b> merken sich einen Zustand. Welche Anweisung weiter unten steht, <b>gewinnt</b> — so bestimmst du den Vorrang. Und mit <code>NOT</code> drehst du das VKE um.',
  anim: A(stl('U  S_Ein', 'S  Pumpe', 'U  S_Aus', [1, 1, 0])) });
defChapter({ n:4, title:'Flanken', subtitle:'FP · FN · Flankenmerker', icon:'fa-bolt',
  intro:'Die Schere soll <b>einmal</b> schneiden, wenn der Block ankommt — nicht dauernd. <code>FP</code> und <code>FN</code> erkennen den Wechsel des VKE und brauchen dafür einen <b>Flankenmerker</b>, in dem sie sich den alten Zustand merken.',
  anim: A(stl('U  Block_da', 'FP M_Block', '=  Schnitt', [1, 1, 1])) });
defChapter({ n:5, title:'Zeiten', subtitle:'SE · SA · SI · SV · S5T#', icon:'fa-stopwatch',
  intro:'Die alte S7-300 kennt die <b>S5-Zeiten</b>: Zeitwert laden (<code>L S5T#3S</code>), mit dem VKE starten (<code>SE T1</code>), Zustand abfragen (<code>U T1</code>). Einschaltverzögerung, Ausschaltverzögerung, Impuls, verlängerter Impuls — das Walzwerk braucht sie alle.',
  anim: A(stl('L  S5T#3S', 'SE T1', 'U  T1', [1, 1, 0])) });
defChapter({ n:6, title:'Zähler', subtitle:'ZV · ZR · S Z · R Z · L Z', icon:'fa-list-ol',
  intro:'Jeder Block, der die Walzstrasse verlässt, wird gezählt. Die S5-Zähler zählen <b>vorwärts</b> (<code>ZV</code>) und <b>rückwärts</b> (<code>ZR</code>) bei jeder steigenden Flanke, lassen sich <b>vorbelegen</b> (<code>S Z1</code>) und liefern ihren Wert mit <code>L Z1</code>.',
  anim: A(stl('U  Block_raus', 'ZV Z1', 'L  Z1', [1, 1, 1])) });
defChapter({ n:7, title:'Laden und Transferieren', subtitle:'L · T · AKKU1 · AKKU2 · TAK', icon:'fa-right-left',
  intro:'Zahlen gehen in AWL durch die <b>Akkus</b>: <code>L</code> lädt einen Wert in AKKU1 (der alte Inhalt rutscht nach AKKU2), <code>T</code> schreibt AKKU1 in einen Operanden. Das VKE spielt dabei keine Rolle — eine berühmte Falle.',
  anim: A(stl('L  Temp', 'T  Anzeige', 'L  1250', [0, 0, 0])) });
defChapter({ n:8, title:'Rechnen', subtitle:'+I · -I · *I · /I · REAL · RND', icon:'fa-calculator',
  intro:'Walzspalt, Stichabnahme, Mittelwerte: Gerechnet wird mit AKKU2 und AKKU1 — <code>+I</code> für Ganzzahlen, <code>+R</code> für Kommazahlen. Zwischen den Welten wandelst du mit <code>ITD</code>, <code>DTR</code> und <code>RND</code>.',
  anim: A(stl('L  Dicke_ein', 'L  Dicke_aus', '-I', [0, 0, 0])) });
defChapter({ n:9, title:'Vergleichen', subtitle:'==I · >I · <I · Bereiche', icon:'fa-scale-balanced',
  intro:'Ist der Block heiss genug zum Walzen? Liegt der Hydraulikdruck im Fenster? Ein <b>Vergleich</b> (<code>&gt;=I</code>) bildet ein neues VKE aus AKKU2 und AKKU1. Mit Bits verknüpfst du ihn über Klammern.',
  anim: A(stl('L  Temp', 'L  1100', '>=I', [0, 0, 1])) });
defChapter({ n:10, title:'Sprünge', subtitle:'SPA · SPB · SPBN · LOOP · Final Boss', icon:'fa-share',
  intro:'Das Herz alter AWL-Programme: <b>Sprünge</b>. <code>SPB</code> springt, wenn das VKE 1 ist, <code>SPBN</code>, wenn es 0 ist, <code>SPA</code> immer. Mit Sprungmarken baust du Verzweigungen und Schleifen. ARIA wartet im Leitstand auf den letzten Durchlauf.',
  anim: A(stl('U  Not_Aus', 'SPB STOP', 'L  Temp', [1, 1, 0])) });
defChapter({ n:11, pro:true, title:'Bausteine', subtitle:'FC · CALL · Parameter · RET_VAL', icon:'fa-cubes',
  intro:'Willkommen in der <b>Profi-Stufe</b>. Die S7-300 ist voller Bausteine: Funktionen mit Schnittstelle, aufgerufen mit <code>CALL</code>. Lokale Variablen schreibst du mit <code>#</code>, globale in Anführungszeichen.',
  anim: A(stl('CALL "FC_Walze"', '  Ein := "S1"', '  Lauf => "M1"', [0, 0, 0])) });
defChapter({ n:12, pro:true, title:'Funktionsbausteine', subtitle:'FB · Instanz-DB · Multiinstanz', icon:'fa-cube',
  intro:'Was sich etwas merken muss, wird ein <b>FB</b>: Seine Daten liegen im <b>Instanz-DB</b>. IEC-Zeiten und -Zähler bettest du als <b>Multiinstanz</b> ein und rufst sie mit <code>CALL #T_Lauf</code> auf.',
  anim: A(stl('CALL "FB_Rollgang",', '  "FB_Rollgang_DB"', 'CALL #T_Lauf', [0, 0, 0])) });
defChapter({ n:13, pro:true, title:'Daten', subtitle:'DB · PLC-Datentyp · Array', icon:'fa-database',
  intro:'Walzprogramme, Stichpläne, Tagesstatistik: Daten liegen in <b>Datenbausteinen</b>. Mit <code>L "DB_Stich".Spalt[2]</code> holst du einen Wert, mit <code>T</code> schreibst du ihn zurück. PLC-Datentypen bündeln zusammengehörige Werte.',
  anim: A(stl('L  "DB_Stich".Spalt[1]', 'T  "Spalt_Soll"', 'L  "DB_Stich".Anzahl', [0, 0, 0])) });
defChapter({ n:14, pro:true, title:'Standardbausteine', subtitle:'Walzgerüst · Rollgang · Ofen · Meldung', icon:'fa-layer-group',
  intro:'Ein Walzwerk hat viele gleiche Antriebe. Du baust sie einmal als <b>Standardbaustein</b> und setzt sie überall ein — sauber über die Schnittstelle, ohne heimliche Zugriffe auf globale Variablen.',
  anim: A(stl('CALL "FB_Antrieb",', '  "Geruest_1_DB"', 'CALL "FB_Antrieb",', [0, 0, 0])) });
defChapter({ n:15, pro:true, title:'Das Walzwerksprogramm', subtitle:'OB1 · OB100 · Standard · Final Boss 2', icon:'fa-industry',
  intro:'Zum Schluss baust du das ganze <b>Walzwerksprogramm</b>: Anlauf im <b>OB100</b>, der <b>OB1</b> als Inhaltsverzeichnis, Standardbausteine und Datenbausteine — warnungsfrei. Und du lernst, warum dieses Programm beim nächsten Umbau nach SCL wandern muss: Die <b>S7-1200 kann kein AWL</b>.',
  anim: A(stl('CALL "FB_Sicherung",', 'CALL "FB_Ablauf",', 'CALL "FC_Status"', [0, 0, 0])) });
})();
