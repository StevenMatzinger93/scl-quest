/* ===== SPS Quest Portal: Avatare (Tiere mit Accessoires, Paket 3) – Zeichnen und Verteilen der Daten ===== */
(function(){
'use strict';
const P = window.SPSQ, A = window.SPSQAvatar;
if(!A) return;
// CSS des Avatars einmal einhängen
if(!document.getElementById('avCss')){ const st = document.createElement('style'); st.id = 'avCss'; st.textContent = A.CSS; document.head.appendChild(st); }
// Avatar als HTML: spec darf fehlen oder ungültig sein (dann Vorgabe)
P.avatarHTML = (spec, opts) => A.svg(spec, opts || {});
P.Avatar = A;
})();
