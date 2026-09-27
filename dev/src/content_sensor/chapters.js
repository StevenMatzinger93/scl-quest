/* ===== SENSORWERKSTATT: Module (Kapitel) ===== */
(function(){
const A = inner => '<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" font-family="monospace">' + inner + '</svg>';
// kleines Klemmenbild: Sensor, M12-Leitung, Initiatorenklemme mit gelber LED
const term = (label, led) => '<rect x="20" y="60" width="60" height="40" rx="6" fill="#2b3138" stroke="#8aa0b4"/><circle cx="72" cy="70" r="4" fill="#ffc400"/>'
  + '<path d="M80 80 C130 80 130 40 180 40" stroke="#8b5a2b" stroke-width="4" fill="none"/><path d="M80 84 C130 84 130 80 180 80" stroke="#222" stroke-width="4" fill="none"/><path d="M80 88 C130 88 130 120 180 120" stroke="#2f6fd0" stroke-width="4" fill="none"/>'
  + '<rect x="180" y="24" width="40" height="112" rx="4" fill="#8f959c"/>' + ['L+', 'S', 'M'].map((t, i) => '<text x="200" y="' + (44 + i * 40) + '" text-anchor="middle" font-size="12" fill="#111">' + t + '</text>').join('')
  + '<circle cx="240" cy="80" r="7" fill="' + (led ? '#ffd21e' : '#3a3320') + '"><animate attributeName="opacity" values="1;.4;1" dur="1.4s" repeatCount="indefinite"/></circle>'
  + '<text x="150" y="152" text-anchor="middle" font-size="10" fill="#ffb000">' + label + '</text>';
defChapter({ n:1, title:'Signale und digitale Sensoren', subtitle:'24 V · M12 · Schliesser/Öffner', icon:'fa-plug',
  intro:'Im Untergeschoss steht der <b>Prüfstand</b> der Werkstatt: eine Sortierstrecke, eine Tankstation und ein Schaltschrank mit einer S7-1200. ARIA hat alle Sensoren abgeklemmt. Der Werkmeister gibt dir einen Schraubendreher: <i>„Anschliessen lernt man mit den Händen. Zuerst: Was liefert ein Sensor überhaupt?“</i>',
  anim: A(term('SENSOR → KLEMME → EINGANG', true)) });
defChapter({ n:2, title:'PNP und NPN', subtitle:'Plus- und minusschaltend · 1M', icon:'fa-right-left',
  intro:'Ein Ersatzsensor aus dem Lager — und der Eingang bleibt dunkel, obwohl die Sensor-LED leuchtet. <i>„Plus- oder minusschaltend, das ist hier die Frage“</i>, brummt der Werkmeister. Zeit, den Stromfluss zu verstehen.',
  anim: A(term('PNP: SIGNAL = +24 V', true)) });
defChapter({ n:3, title:'Sensortypen im Einsatz', subtitle:'Induktiv · kapazitiv · optisch · magnetisch', icon:'fa-eye',
  intro:'Stahl, Aluminium, Kunststoff, Glas — die Sortierstrecke soll alles auseinanderhalten. ARIA hat die Sensoren verstellt. Jetzt zählt, wie weit ein Sensor wirklich schaut und worauf er reagiert.',
  anim: A(term('SCHALTABSTAND × MATERIAL', false)) });
})();
