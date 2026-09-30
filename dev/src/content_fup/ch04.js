/* ===== FUP QUEST · KAPITEL 4 — Speicherboxen S, R, SR, RS ===== */
(function(){
const seq = steps => [{ steps }];
const RS_REF = 'NETWORK Weichenstoerung\nW1_Fehler => RS(Stoerung, Quittieren);';

defFup({ id:'f4_s_r', ch:4, title:'Die Fahrstrasse merken',
  story:'Frau Gasser drückt die Fahrstrassentaste nur kurz, doch die Fahrstrasse muss eingestellt <b>bleiben</b>, bis sie aufgelöst wird. Dafür gibt es die Speicherboxen <b>S</b> und <b>R</b>.',
  brief:'<b>NW 1:</b> Die Fahrstrassentaste <b>setzt</b> „Fahrstrasse eingestellt“.<br><b>NW 2:</b> Die Auflösung setzt sie <b>zurück</b>.<br>Zuweisung antippen → <b>S</b> bzw. <b>R</b>.',
  learn:'Setzen und Rücksetzen mit S- und R-Boxen.',
  take:'Die <b>S-Box</b> setzt den Ausgang auf 1, wenn am Eingang 1 ankommt — sonst bleibt er, wie er ist. Die <b>R-Box</b> setzt ihn auf 0. So bleibt ein Zustand gespeichert.',
  vars:{ Taste_FS:false, Aufloesung:false, FS_eingestellt:false },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true }],[0.1,{ Taste_FS:false },{ FS_eingestellt:true }],[0.1,{ Aufloesung:true },{ FS_eingestellt:false }],[0.1,{ Aufloesung:false },{ FS_eingestellt:false }]]),
  ref:'NETWORK Fahrstrasse einstellen\nTaste_FS => S FS_eingestellt;\n\nNETWORK Fahrstrasse aufloesen\nAufloesung => R FS_eingestellt;', man:'speicher', must:['SET','RESET'],
  hint:'Zwei Netzwerke, im ersten die Zuweisung auf S, im zweiten auf R stellen.',
  bind:['routeSet=FS_eingestellt'] });

defFup({ id:'f4_sr', ch:4, title:'Das SR-Flipflop',
  story:'Im Funktionsplan gibt es für Setzen und Rücksetzen auch eine einzige Box: das <b>SR-Flipflop</b>. Der Eingang von links setzt, der zweite Eingang R setzt zurück — und <b>Rücksetzen gewinnt</b>, wenn beide 1 sind.',
  brief:'Die Fahrstrassentaste setzt „Fahrstrasse eingestellt“, die Auflösung setzt zurück — in einer <b>SR</b>-Box: Kommen beide, gewinnt Rücksetzen.<br>Zuweisung antippen → <b>SR</b>, dann Q und R belegen.',
  learn:'Das SR-Flipflop (Rücksetzen dominant).',
  take:'Das <b>SR-Flipflop</b> speichert wie S und R in einer Box. Kommen Setzen und Rücksetzen gleichzeitig, gewinnt <b>R</b> — sicher für Fahrstrassen: im Zweifel aufgelöst.',
  vars:{ Taste_FS:false, Aufloesung:false, FS_eingestellt:false },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true }],[0.1,{ Taste_FS:false },{ FS_eingestellt:true }],[0.1,{ Taste_FS:true, Aufloesung:true },{ FS_eingestellt:false }],[0.1,{ Aufloesung:false },{ FS_eingestellt:true }]]),
  ref:'NETWORK Fahrstrasse\nTaste_FS => SR(FS_eingestellt, Aufloesung);', man:'speicher', must:['SR'],
  hint:'Die Box SR hat zwei Felder: Q (Ausgang) und R (Rücksetzen).',
  bind:['routeSet=FS_eingestellt'] });

defFup({ id:'f4_rs', ch:4, title:'Die hartnäckige Störung',
  story:'Eine Weichenstörung darf nicht wegquittiert werden, solange der Fehler noch ansteht. Das <b>RS-Flipflop</b> macht das automatisch: Beim RS gewinnt <b>Setzen</b>.',
  brief:'Ein Fehler von Weiche 1 setzt die Störung, die Quittiertaste setzt sie zurück. Solange der Fehler ansteht, bleibt sie: <b>RS</b>-Box (Setzen dominant).',
  learn:'Das RS-Flipflop (Setzen dominant).',
  take:'Beim <b>RS-Flipflop</b> gewinnt Setzen. Solange der Fehler ansteht, bleibt die Störung — Quittieren wirkt erst, wenn die Ursache weg ist.',
  vars:{ W1_Fehler:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{ W1_Fehler:true },{ Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false },{ Stoerung:false }],[0.1,{ Quittieren:false },{ Stoerung:false }],[0.1,{ W1_Fehler:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false },{ Stoerung:true }]]),
  ref: RS_REF, man:'speicher', must:['RS'],
  hint:'Zuweisung antippen → RS.',
  bind:['faultActive=Stoerung', 'lightRed=Stoerung'] });

defFup({ id:'f4_negiert', ch:4, title:'Das Haltlicht am Stelltisch',
  story:'Am Stelltisch gibt es für jedes Signal eine rote Lampe „Halt“. Sie leuchtet genau dann, wenn das Signal <b>nicht</b> auf Fahrt steht.',
  brief:'Die rote Lampe am Stelltisch leuchtet genau dann, wenn Signal A <b>nicht</b> auf Fahrt steht: <b>negierte Zuweisung</b>.',
  learn:'Negierte Zuweisung als Gegenmelder.',
  take:'Die negierte Zuweisung schreibt immer das Gegenteil. Ein Gegenmelder braucht so keine eigene Logik.',
  vars:{ Signal_A:false, Melder_Rot:false },
  tests:[[{ Signal_A:false }, { Melder_Rot:true }], [{ Signal_A:true }, { Melder_Rot:false }]],
  ref:'NETWORK Haltmelder\nSignal_A => NOT Melder_Rot;', man:'speicher', must:['NCOIL'],
  hint:'Zuweisung antippen → ○=.',
  bind:['signalEntry=Signal_A', 'lightRed=Melder_Rot'] });

defFup({ id:'f4_rs_dbg', ch:4, title:'Die weggedrückte Störung', debug:true,
  story:'Der Wärter drückt „Quittieren“ und hält die Taste — die Störung verschwindet, obwohl die Weiche immer noch klemmt. ARIA hat das falsche Flipflop eingesetzt.',
  brief:'Hält man die Quittiertaste, verschwindet die Störung, obwohl Weiche 1 noch einen Fehler meldet. Solange der Fehler ansteht, muss die Störung bleiben.',
  learn:'SR und RS unterscheiden.',
  take:'SR: Rücksetzen gewinnt. RS: Setzen gewinnt. Bei Störungen muss der anstehende Fehler gewinnen — also RS.',
  vars:{ W1_Fehler:false, Quittieren:false, Stoerung:false },
  timed: seq([[0,{ W1_Fehler:true },{ Stoerung:true }],[0.1,{ Quittieren:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false },{ Stoerung:false }]]),
  start:'NETWORK Weichenstoerung\nW1_Fehler => SR(Stoerung, Quittieren);', ref: RS_REF, man:'speicher', must:['RS'],
  hint:'Box antippen → RS statt SR.',
  bind:['faultActive=Stoerung', 'lightRed=Stoerung'] });

defFup({ id:'f4_stoerung', ch:4, title:'Störung mit Wecker',
  story:'Eine neue Störung soll auch den Wecker auslösen. Der Wecker lässt sich sofort abstellen, die Störung erst, wenn der Fehler behoben ist.',
  brief:'<b>NW 1:</b> Ein Fehler von Weiche 1 setzt Störung <b>und</b> Wecker.<br><b>NW 2:</b> Quittieren setzt die Störung zurück, aber nur ohne anstehenden Fehler.<br><b>NW 3:</b> Quittieren stellt den Wecker ab.',
  learn:'Mehrere Speicher mit unterschiedlichen Rücksetzbedingungen.',
  take:'Wecker und Störung werden gemeinsam gesetzt, aber unterschiedlich zurückgesetzt: Der Wecker ist nur ein Hinweis, die Störung ein Zustand.',
  vars:{ W1_Fehler:false, Quittieren:false, Stoerung:false, Wecker:false },
  timed: seq([[0,{ W1_Fehler:true },{ Stoerung:true, Wecker:true }],[0.1,{ Quittieren:true },{ Stoerung:true, Wecker:false }],[0.1,{ Quittieren:false, W1_Fehler:false },{ Stoerung:true, Wecker:false }],[0.1,{ Quittieren:true },{ Stoerung:false }]]),
  ref:'NETWORK Stoerung speichern\nW1_Fehler => S Stoerung, S Wecker;\n\nNETWORK Stoerung quittieren\nQuittieren AND NOT W1_Fehler => R Stoerung;\n\nNETWORK Wecker abstellen\nQuittieren => R Wecker;',
  man:'speicher', must:['SET','RESET','MULTI_OUT'],
  hint:'NW 1 hat zwei S-Boxen (+ Ausgang).',
  bind:['faultActive=Stoerung', 'hornActive=Wecker'] });

defFup({ id:'f4_vorrang', ch:4, title:'Wer gewinnt?',
  story:'Frau Gasser will es genau wissen: Was passiert, wenn Setzen und Rücksetzen gleichzeitig kommen? Baue beide Varianten nebeneinander.',
  brief:'Zwei Speicher mit denselben Tasten Setzen und Rücksetzen:<br><b>NW 1:</b> SR-Box, Speicher „Rücksetzen dominant“.<br><b>NW 2:</b> RS-Box, Speicher „Setzen dominant“.',
  learn:'Vorrang von SR und RS vergleichen.',
  take:'Sind beide Eingänge 1, ist das SR-Flipflop 0 und das RS-Flipflop 1. Sonst verhalten sie sich gleich.',
  vars:{ Setzen:false, Ruecksetzen:false, Merker_SR:false, Merker_RS:false },
  timed: seq([[0,{ Setzen:true },{ Merker_SR:true, Merker_RS:true }],[0.1,{ Ruecksetzen:true },{ Merker_SR:false, Merker_RS:true }],[0.1,{ Setzen:false },{ Merker_SR:false, Merker_RS:false }],[0.1,{ Ruecksetzen:false },{ Merker_SR:false, Merker_RS:false }]]),
  ref:'NETWORK SR\nSetzen => SR(Merker_SR, Ruecksetzen);\n\nNETWORK RS\nSetzen => RS(Merker_RS, Ruecksetzen);', man:'speicher', must:['SR','RS'],
  hint:'Zwei Netzwerke mit demselben Eingang, einmal SR, einmal RS.',
  bind:['lightGreen=Merker_SR', 'lightYellow=Merker_RS'] });

defFup({ id:'f4_sammel', ch:4, title:'Sammelstörung',
  story:'Beide Weichen haben eine eigene Störungsspeicherung. Am Stelltisch soll eine rote Sammellampe leuchten, sobald eine der beiden gestört ist.',
  brief:'<b>NW 1–2:</b> Fehler von Weiche 1 bzw. 2 speichern (je eine RS-Box, gemeinsame Quittiertaste).<br><b>NW 3:</b> Die rote Lampe leuchtet, sobald eine der beiden Störungen gespeichert ist.',
  learn:'Einzelstörungen speichern, Sammelstörung bilden.',
  take:'Jede Störung wird einzeln gespeichert (für die Diagnose), die Sammelstörung fasst sie mit einer &gt;=1-Box zusammen.',
  vars:{ W1_Fehler:false, W2_Fehler:false, Quittieren:false, St_W1:false, St_W2:false, Melder_Rot:false },
  timed: seq([[0,{ W2_Fehler:true },{ St_W2:true, St_W1:false, Melder_Rot:true }],[0.1,{ W2_Fehler:false },{ Melder_Rot:true }],[0.1,{ Quittieren:true },{ St_W2:false, Melder_Rot:false }],[0.1,{ Quittieren:false, W1_Fehler:true },{ St_W1:true, Melder_Rot:true }]]),
  ref:'NETWORK Stoerung W1\nW1_Fehler => RS(St_W1, Quittieren);\n\nNETWORK Stoerung W2\nW2_Fehler => RS(St_W2, Quittieren);\n\nNETWORK Sammelstoerung\nSt_W1 OR St_W2 => Melder_Rot;', man:'speicher', must:['RS','PARALLEL'],
  hint:'Die Sammelstörung kommt als letztes Netzwerk.',
  bind:['faultActive=St_W1', 'lightRed=Melder_Rot'] });

defFup({ id:'f4_reihenfolge_dbg', ch:4, title:'Die Auflösung klemmt', debug:true,
  story:'Wird während der Auflösung die Fahrstrassentaste gedrückt, bleibt die Fahrstrasse eingestellt — gefährlich! ARIA hat bei S und R die Reihenfolge der Netzwerke vertauscht.',
  brief:'Bei gleichzeitigem Einstellen und Auflösen muss die Fahrstrasse <b>aufgelöst</b> sein.',
  learn:'Vorrang durch die Reihenfolge von S- und R-Netzwerken.',
  take:'Bei getrennten S- und R-Boxen gewinnt das <b>untere</b> Netzwerk, weil es zuletzt schreibt. Für Auflösungen gehört R nach unten.',
  vars:{ Taste_FS:false, Aufloesung:false, FS_eingestellt:false },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true }],[0.1,{ Aufloesung:true },{ FS_eingestellt:false }],[0.1,{ Taste_FS:false, Aufloesung:false },{ FS_eingestellt:false }]]),
  start:'NETWORK Fahrstrasse aufloesen\nAufloesung => R FS_eingestellt;\n\nNETWORK Fahrstrasse einstellen\nTaste_FS => S FS_eingestellt;',
  ref:'NETWORK Fahrstrasse einstellen\nTaste_FS => S FS_eingestellt;\n\nNETWORK Fahrstrasse aufloesen\nAufloesung => R FS_eingestellt;', man:'speicher', must:['SET','RESET'],
  hint:'Netzwerk antippen (Kopfzeile) → nach unten.',
  bind:['routeSet=FS_eingestellt'] });

defFup({ id:'f4_boss', ch:4, title:'Boss: Fahrstrasse mit Gedächtnis', boss:true,
  story:'ARIA löst Fahrstrassen mitten in der Zugfahrt auf und quittiert Weichenstörungen weg. Frau Gasser: „Jetzt speichern wir richtig.“',
  brief:'<b>NW 1:</b> Fehler Weiche 1 → Störung (RS, Quittieren).<br><b>NW 2:</b> Fahrstrassentaste ohne Störung → Fahrstrasse (SR, Auflösung).<br><b>NW 3:</b> Fahrstrasse ohne Störung → Signal A.<br><b>NW 4:</b> Rote Lampe = Signal A negiert.',
  learn:'SR, RS und negierte Zuweisung in einem Programm.',
  take:'Die Fahrstrasse ist ein Speicher, die Störung ein zweiter. Das Signal verknüpft beide — und der Haltmelder zeigt immer das Gegenteil des Signals.',
  vars:{ W1_Fehler:false, Quittieren:false, Stoerung:false, Taste_FS:false, Aufloesung:false, FS_eingestellt:false, Signal_A:false, Melder_Rot:true },
  timed: seq([[0,{ Taste_FS:true },{ FS_eingestellt:true, Signal_A:true, Melder_Rot:false }],[0.1,{ Taste_FS:false },{ Signal_A:true }],[0.1,{ W1_Fehler:true },{ Stoerung:true, Signal_A:false, Melder_Rot:true }],
    [0.1,{ Quittieren:true },{ Stoerung:true }],[0.1,{ W1_Fehler:false },{ Stoerung:false, Signal_A:true }],[0.1,{ Quittieren:false, Aufloesung:true },{ FS_eingestellt:false, Signal_A:false }],[0.1,{ Aufloesung:false, W1_Fehler:true, Taste_FS:true },{ FS_eingestellt:false }]]),
  ref:'NETWORK Weichenstoerung\nW1_Fehler => RS(Stoerung, Quittieren);\n\nNETWORK Fahrstrasse\nTaste_FS AND NOT Stoerung => SR(FS_eingestellt, Aufloesung);\n\nNETWORK Signal A\nFS_eingestellt AND NOT Stoerung => Signal_A;\n\nNETWORK Haltmelder\nSignal_A => NOT Melder_Rot;',
  man:'speicher', must:['SR','RS','NCOIL'],
  hint:'Die Störung kommt zuerst — so sperrt sie noch im selben Zyklus.',
  bind:['faultActive=Stoerung', 'routeSet=FS_eingestellt', 'signalEntry=Signal_A', 'lightRed=Melder_Rot'] });
})();
