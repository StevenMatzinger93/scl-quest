// ERZEUGT von dev/build.js – nicht von Hand ändern. Avatar-Katalog für den Worker.
(function(root){
"use strict";
/* ============================================================
   AVATARE (docs/AUFTRAG_FEEDBACK1.md Paket 3)
   ------------------------------------------------------------
   Tiere (eigene Zeichnungen, keine bekannten Figuren) mit klassischen Accessoires: Kappen, Brillen, Ketten, T-Shirts und Hemden.
   Rein kosmetisch: Coins gibt es nur zu verdienen, nie zu kaufen. Manche Stücke schaltet nur ein Abzeichen frei.
   Diese Datei läuft im Portal (Zeichnen) und im Worker (Katalog, Prüfen, Preise) – ohne DOM.
   Ein Avatar ist ein kleines Objekt: { a:'fuchs', c:0, hat:'kappe_rot', gl:'rund', ch:'silber', sh:'tee_blau' }
   ============================================================ */
const ANIMALS = {
  fuchs:     { name: 'Fuchs' },
  baer:      { name: 'Bär' },
  eule:      { name: 'Eule' },
  wolf:      { name: 'Wolf' },
  pinguin:   { name: 'Pinguin' },
  biber:     { name: 'Biber' },
  steinbock: { name: 'Steinbock' },
  katze:     { name: 'Katze' }
};
// Grundfarben des Fells; je Tier ist Farbe 0 die typische
const COLORS = [
  { id: 0, name: 'Standard' }, { id: 1, name: 'Orange' }, { id: 2, name: 'Braun' }, { id: 3, name: 'Grau' }, { id: 4, name: 'Dunkel' }, { id: 5, name: 'Creme' }, { id: 6, name: 'Blau' }, { id: 7, name: 'Grün' }
];
const FUR = { 1: '#e8842a', 2: '#8a5a33', 3: '#8d939c', 4: '#3b3f48', 5: '#e9d9b8', 6: '#5b8ed6', 7: '#5dab5b' };
const DEFAULT_FUR = { fuchs: '#e8842a', baer: '#8a5a33', eule: '#a07a52', wolf: '#8d939c', pinguin: '#2f333b', biber: '#8a5a33', steinbock: '#c4a06a', katze: '#d9a05b' };

// Katalog: slot → [{ id, name, cost (Coins), badge (nur über Abzeichen), color … }]. cost 0 = von Anfang an
const ITEMS = {
  hat: [
    { id: 'kappe_rot', name: 'Kappe rot', cost: 40, c: '#d93b3b' }, { id: 'kappe_blau', name: 'Kappe blau', cost: 40, c: '#2f6fd6' },
    { id: 'kappe_gruen', name: 'Kappe grün', cost: 40, c: '#2f9e4a' }, { id: 'kappe_schwarz', name: 'Kappe schwarz', cost: 60, c: '#23262d' },
    { id: 'muetze_orange', name: 'Mütze orange', cost: 60, c: '#f08a24' }, { id: 'helm_gelb', name: 'Bauhelm gelb', cost: 80, c: '#f3c623' },
    { id: 'helm_gold', name: 'Goldhelm', cost: 0, badge: 'befreier', c: '#d9a520' }
  ],
  gl: [
    { id: 'rund', name: 'Runde Brille', cost: 50 }, { id: 'sonne', name: 'Sonnenbrille', cost: 70 }, { id: 'nerd', name: 'Hornbrille', cost: 50 }, { id: 'schutz', name: 'Schutzbrille', cost: 40 }
  ],
  ch: [
    { id: 'silber', name: 'Silberkette', cost: 100, c: '#cfd6de' }, { id: 'gold', name: 'Goldene Kette', cost: 0, badge: 'befreier', c: '#e6b422' },
    { id: 'gold_blitz', name: 'Goldkette mit Blitz', cost: 0, badge: 'architekt', c: '#e6b422' }
  ],
  sh: [
    { id: 'tee_rot', name: 'T-Shirt rot', cost: 30, c: '#d93b3b' }, { id: 'tee_blau', name: 'T-Shirt blau', cost: 30, c: '#2f6fd6' }, { id: 'tee_gruen', name: 'T-Shirt grün', cost: 30, c: '#2f9e4a' },
    { id: 'tee_schwarz', name: 'T-Shirt schwarz', cost: 30, c: '#23262d' }, { id: 'tee_weiss', name: 'T-Shirt weiss', cost: 30, c: '#f2f3f5' },
    { id: 'tee_blitz', name: 'T-Shirt Blitz', cost: 60, c: '#23262d', motif: 'bolt' }, { id: 'tee_zahnrad', name: 'T-Shirt Zahnrad', cost: 60, c: '#2f6fd6', motif: 'gear' },
    { id: 'hemd_blau', name: 'Hemd blau', cost: 80, c: '#4a7fd0', collar: true }, { id: 'hemd_weiss', name: 'Hemd weiss', cost: 80, c: '#f2f3f5', collar: true },
    { id: 'hemd_kariert', name: 'Hemd kariert', cost: 80, c: '#c0392b', collar: true, check: true }
  ]
};
const SLOTS = ['hat', 'gl', 'ch', 'sh'];
const item = (slot, id) => (ITEMS[slot] || []).find(x => x.id === id) || null;

function defaultSpec(){ return { a: 'fuchs', c: 0, hat: '', gl: '', ch: '', sh: '' }; }
// Säubert ein Objekt aus unsicherer Quelle (Server und Client): unbekannte Werte fallen auf die Vorgabe zurück
function normalize(spec){
  const s = defaultSpec(); spec = spec && typeof spec === 'object' ? spec : {};
  if(ANIMALS[spec.a]) s.a = spec.a;
  const c = +spec.c; if(Number.isInteger(c) && c >= 0 && c < COLORS.length) s.c = c;
  SLOTS.forEach(k => { if(item(k, spec[k])) s[k] = spec[k]; });
  return s;
}
// Alle Stücke, die die Person besitzen muss, damit der Avatar erlaubt ist (freie Stücke ausgenommen)
const needed = spec => SLOTS.map(k => (spec[k] ? { slot: k, id: spec[k], it: item(k, spec[k]) } : null)).filter(x => x && x.it);

/* ---------- Zeichnen ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function mix(hex, other, t){
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), a = p(hex), b = p(other);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const INK = '#20232b';
function furOf(spec){ return spec.c ? FUR[spec.c] : DEFAULT_FUR[spec.a]; }

// Tier: liefert { back, head, face } als SVG-Text (Hinterkopf/Ohren, Gesicht ohne Augen, Nasen/Mundbereich)
function animalParts(a, fur, light, dark){
  const P = {
    fuchs: () => ({
      back: `<path d="M27 32 L30 8 L45 24 Z" fill="${fur}"/><path d="M73 32 L70 8 L55 24 Z" fill="${fur}"/><path d="M31 27 L32 15 L40 24 Z" fill="${dark}"/><path d="M69 27 L68 15 L60 24 Z" fill="${dark}"/>`,
      face: `<path d="M26 47 Q40 62 50 66 Q60 62 74 47 Q62 52 50 52 Q38 52 26 47Z" fill="#fff"/><ellipse cx="50" cy="55" rx="12" ry="8" fill="#fff"/><ellipse cx="50" cy="50" rx="3.4" ry="2.6" fill="${INK}"/>`,
      mouth: `<path d="M47 58 Q50 61 53 58" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    }),
    baer: () => ({
      back: `<circle cx="29" cy="26" r="9" fill="${fur}"/><circle cx="71" cy="26" r="9" fill="${fur}"/><circle cx="29" cy="26" r="4.6" fill="${light}"/><circle cx="71" cy="26" r="4.6" fill="${light}"/>`,
      face: `<ellipse cx="50" cy="54" rx="12" ry="9" fill="${light}"/><ellipse cx="50" cy="50" rx="4" ry="3" fill="${INK}"/>`,
      mouth: `<path d="M50 53 V56 M46 58 Q50 61 54 58" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    }),
    eule: () => ({
      back: `<path d="M27 30 L31 10 L44 24 Z" fill="${dark}"/><path d="M73 30 L69 10 L56 24 Z" fill="${dark}"/>`,
      face: `<ellipse cx="50" cy="46" rx="21" ry="17" fill="${light}"/><circle cx="39" cy="43" r="10" fill="#fff" stroke="${dark}" stroke-width="2"/><circle cx="61" cy="43" r="10" fill="#fff" stroke="${dark}" stroke-width="2"/><path d="M45.5 50 L54.5 50 L50 59 Z" fill="#f0a020" stroke="#c07810" stroke-width="1" stroke-linejoin="round"/>`,
      mouth: '', eyeR: 4.4, eyeX: [39, 61], eyeY: 43, big: true
    }),
    wolf: () => ({
      back: `<path d="M26 32 L30 6 L44 22 Z" fill="${fur}"/><path d="M74 32 L70 6 L56 22 Z" fill="${fur}"/><path d="M31 26 L32 13 L39 22 Z" fill="${dark}"/><path d="M69 26 L68 13 L61 22 Z" fill="${dark}"/>`,
      face: `<path d="M27 48 Q33 60 44 62 L50 68 L56 62 Q67 60 73 48 Q62 54 50 54 Q38 54 27 48Z" fill="${light}"/><ellipse cx="50" cy="56" rx="9" ry="10" fill="${light}"/><ellipse cx="50" cy="49.5" rx="4" ry="3" fill="${INK}"/>`,
      mouth: `<path d="M50 53 V58 M45 62 Q50 65 55 62" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    }),
    pinguin: () => ({
      back: '',
      face: `<path d="M50 30 Q34 30 30 46 Q30 62 42 66 Q50 69 58 66 Q70 62 70 46 Q66 30 50 30Z" fill="#fff"/><path d="M45 50 L50 47 L55 50 L50 58 Z" fill="#f2a01d" stroke="#c07810" stroke-width="1" stroke-linejoin="round"/>`,
      mouth: ''
    }),
    biber: () => ({
      back: `<circle cx="30" cy="27" r="6" fill="${fur}"/><circle cx="70" cy="27" r="6" fill="${fur}"/><circle cx="30" cy="27" r="3" fill="${dark}"/><circle cx="70" cy="27" r="3" fill="${dark}"/>`,
      face: `<ellipse cx="50" cy="55" rx="13" ry="9" fill="${light}"/><ellipse cx="50" cy="50" rx="4.6" ry="3" fill="${INK}"/><rect x="45.5" y="57" width="4.4" height="7" rx="1.2" fill="#fff" stroke="${INK}" stroke-width="1"/><rect x="50.1" y="57" width="4.4" height="7" rx="1.2" fill="#fff" stroke="${INK}" stroke-width="1"/>`,
      mouth: ''
    }),
    steinbock: () => ({
      back: `<path d="M33 30 C18 24 14 8 26 2 C22 12 28 20 38 24Z" fill="${dark}" stroke="${INK}" stroke-width=".8"/><path d="M67 30 C82 24 86 8 74 2 C78 12 72 20 62 24Z" fill="${dark}" stroke="${INK}" stroke-width=".8"/><ellipse cx="24" cy="40" rx="7" ry="3.4" fill="${fur}" transform="rotate(-20 24 40)"/><ellipse cx="76" cy="40" rx="7" ry="3.4" fill="${fur}" transform="rotate(20 76 40)"/>`,
      face: `<ellipse cx="50" cy="55" rx="11" ry="9" fill="${light}"/><ellipse cx="50" cy="51" rx="3.6" ry="2.6" fill="${INK}"/><path d="M45 64 L55 64 L50 76 Z" fill="${dark}"/>`,
      mouth: ''
    }),
    katze: () => ({
      back: `<path d="M27 32 L29 9 L45 24 Z" fill="${fur}"/><path d="M73 32 L71 9 L55 24 Z" fill="${fur}"/><path d="M31 26 L31 15 L40 23 Z" fill="#f2a5b5"/><path d="M69 26 L69 15 L60 23 Z" fill="#f2a5b5"/>`,
      face: `<ellipse cx="50" cy="55" rx="10" ry="7" fill="${light}"/><path d="M47.5 50 L52.5 50 L50 53 Z" fill="#e58aa0"/><path d="M22 52 L38 54 M22 58 L38 57 M78 52 L62 54 M78 58 L62 57" stroke="${dark}" stroke-width="1" stroke-linecap="round"/>`,
      mouth: `<path d="M50 53 V55 M46.5 57 Q50 60 53.5 57" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
    })
  };
  return (P[a] || P.fuchs)();
}
function bodySVG(spec, fur, light){
  const sh = item('sh', spec.sh);
  const torso = 'M12 100 C12 82 26 72 50 72 C74 72 88 82 88 100 Z';
  if(!sh) return spec.a === 'pinguin' ? `<path d="${torso}" fill="${fur}"/><path d="M34 100 C34 86 40 76 50 76 C60 76 66 86 66 100Z" fill="#fff"/>` : `<path d="${torso}" fill="${fur}"/><path d="M36 100 C36 88 42 78 50 78 C58 78 64 88 64 100Z" fill="${light}" opacity=".85"/>`;
  let g = `<path d="${torso}" fill="${sh.c}"/>`;
  if(sh.check) g += `<clipPath id="ck"><path d="${torso}"/></clipPath><g clip-path="url(#ck)" stroke="#fff" stroke-opacity=".45" stroke-width="2.4">${[20, 30, 40, 50, 60, 70, 80].map(x => `<path d="M${x} 70 V100"/>`).join('')}${[78, 86, 94].map(y => `<path d="M10 ${y} H90"/>`).join('')}</g>`;
  if(sh.collar) g += `<path d="M40 73 L50 86 L60 73 L56 72 L50 79 L44 72Z" fill="${mix(sh.c, '#ffffff', .65)}" stroke="${mix(sh.c, '#000000', .3)}" stroke-width=".8" stroke-linejoin="round"/><path d="M50 86 V100" stroke="${mix(sh.c, '#000000', .3)}" stroke-width="1"/>` + [90, 96].map(y => `<circle cx="50" cy="${y}" r="1.1" fill="${mix(sh.c, '#000000', .35)}"/>`).join('');
  else g += `<path d="M39 73 Q50 84 61 73" fill="none" stroke="${mix(sh.c, '#000000', .25)}" stroke-width="1.6" stroke-linecap="round"/>`;
  if(sh.motif === 'bolt') g += '<path d="M52 82 L44 92 H50 L47 99 L57 88 H51 Z" fill="#ffd21f" stroke="#a37d00" stroke-width=".6" stroke-linejoin="round"/>';
  if(sh.motif === 'gear') g += '<g transform="translate(50 91)" fill="none" stroke="#fff" stroke-width="2"><circle r="4.2"/><path d="M0 -7 V-5 M0 7 V5 M-7 0 H-5 M7 0 H5 M-5 -5 L-3.6 -3.6 M5 5 L3.6 3.6 M5 -5 L3.6 -3.6 M-5 5 L-3.6 3.6" stroke-linecap="round"/></g>';
  return g;
}
function chainSVG(spec){
  const it = item('ch', spec.ch); if(!it) return '';
  const beads = [[33, 76], [37, 80], [42, 83], [50, 85], [58, 83], [63, 80], [67, 76]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="1.7" fill="${it.c}" stroke="${mix(it.c, '#000000', .35)}" stroke-width=".5"/>`).join('');
  const pend = it.id === 'gold_blitz' ? `<path d="M51 84 L45 93 H50 L48 100 L56 91 H51.5 Z" fill="#ffd21f" stroke="#8a6a00" stroke-width=".7" stroke-linejoin="round"/>` : `<circle cx="50" cy="88" r="3.2" fill="${it.c}" stroke="${mix(it.c, '#000000', .35)}" stroke-width=".7"/>`;
  return `<path d="M31 74 Q50 92 69 74" fill="none" stroke="${it.c}" stroke-width="1.6"/>` + beads + pend;
}
function glassesSVG(spec, eyes){
  const it = item('gl', spec.gl); if(!it) return '';
  const [x1, x2] = eyes.x, y = eyes.y;
  if(it.id === 'rund') return `<g fill="rgba(180,220,255,.18)" stroke="${INK}" stroke-width="1.8"><circle cx="${x1}" cy="${y}" r="7.4"/><circle cx="${x2}" cy="${y}" r="7.4"/></g><path d="M${x1 + 7.4} ${y} H${x2 - 7.4}" stroke="${INK}" stroke-width="1.8"/>`;
  if(it.id === 'sonne') return `<g fill="#15171c" stroke="${INK}" stroke-width="1.2"><rect x="${x1 - 8.5}" y="${y - 5.5}" width="17" height="11.5" rx="4"/><rect x="${x2 - 8.5}" y="${y - 5.5}" width="17" height="11.5" rx="4"/></g><path d="M${x1 + 8.5} ${y - 2} H${x2 - 8.5}" stroke="${INK}" stroke-width="2"/><path d="M${x1 - 6} ${y - 3} l4 -1 M${x2 - 6} ${y - 3} l4 -1" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>`;
  if(it.id === 'nerd') return `<g fill="rgba(255,255,255,.12)" stroke="#5a3a1a" stroke-width="2.6"><rect x="${x1 - 8}" y="${y - 6}" width="16" height="12" rx="2.4"/><rect x="${x2 - 8}" y="${y - 6}" width="16" height="12" rx="2.4"/></g><path d="M${x1 + 8} ${y - 2} H${x2 - 8}" stroke="#5a3a1a" stroke-width="2.6"/>`;
  return `<rect x="${x1 - 10}" y="${y - 6.5}" width="${x2 - x1 + 20}" height="13" rx="5" fill="rgba(120,200,255,.28)" stroke="#2a7fc0" stroke-width="1.8"/><path d="M${x1 - 10} ${y} H${x1 - 14} M${x2 + 10} ${y} H${x2 + 14}" stroke="#2a7fc0" stroke-width="1.6"/>`;
}
function hatSVG(spec){
  const it = item('hat', spec.hat); if(!it) return '';
  const dk = mix(it.c, '#000000', .28), lt = mix(it.c, '#ffffff', .3);
  if(it.id.startsWith('kappe')) return `<path d="M25 37 C24 14 76 14 75 37 Z" fill="${it.c}" stroke="${dk}" stroke-width="1"/><path d="M50 36 C66 32 80 34 86 41 C72 40 60 40 50 41 Z" fill="${dk}"/><circle cx="50" cy="19" r="2.2" fill="${dk}"/><path d="M34 26 Q42 19 50 20" stroke="${lt}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`;
  if(it.id.startsWith('muetze')) return `<path d="M25 36 C25 16 75 16 75 36 Z" fill="${it.c}" stroke="${dk}" stroke-width="1"/><rect x="24" y="31" width="52" height="8" rx="3" fill="${dk}"/><circle cx="50" cy="13" r="5.2" fill="${lt}" stroke="${dk}" stroke-width=".8"/>`;
  if(it.id === 'helm_gold') return `<path d="M24 38 C22 12 78 12 76 38 Z" fill="${it.c}" stroke="${dk}" stroke-width="1.2"/><path d="M20 38 H80 Q80 42 76 42 H24 Q20 42 20 38Z" fill="${dk}"/><path d="M50 14 V36" stroke="${dk}" stroke-width="3"/><path d="M40 20 L50 4 L60 20 Z" fill="${lt}" stroke="${dk}" stroke-width="1" stroke-linejoin="round"/>`;
  return `<path d="M24 38 C22 12 78 12 76 38 Z" fill="${it.c}" stroke="${dk}" stroke-width="1.2"/><path d="M20 38 H80 Q80 42 76 42 H24 Q20 42 20 38Z" fill="${dk}"/><path d="M45 15 H55 V35 H45Z" fill="${lt}" opacity=".55"/>`;
}

// Zeichnet den Avatar als SVG-Text. opts: { size (px), anim (Idle-Animation, sonst statisch), state ('win' = Jubelsprung), label }
function svg(spec, opts){
  spec = normalize(spec); opts = opts || {};
  const fur = furOf(spec), light = mix(fur, '#ffffff', .6), dark = mix(fur, '#000000', .3);
  const parts = animalParts(spec.a, fur, light, dark);
  const eyeX = parts.eyeX || [41, 59], eyeY = parts.eyeY || 42, er = parts.eyeR || 3.3;
  const eyes = `<g class="av-eyes"><circle cx="${eyeX[0]}" cy="${eyeY}" r="${er}" fill="${INK}"/><circle cx="${eyeX[1]}" cy="${eyeY}" r="${er}" fill="${INK}"/><circle cx="${eyeX[0] + 1}" cy="${eyeY - 1.2}" r="1.1" fill="#fff"/><circle cx="${eyeX[1] + 1}" cy="${eyeY - 1.2}" r="1.1" fill="#fff"/></g>`;
  const headFill = spec.a === 'pinguin' ? fur : spec.a === 'eule' ? fur : fur;
  const head = `<ellipse cx="50" cy="44" rx="25" ry="23" fill="${headFill}"/>`;
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const cls = 'av' + (opts.anim ? ' av-anim' : '') + (opts.state ? ' av-' + opts.state : '');
  const label = opts.label ? ` role="img" aria-label="${esc(opts.label)}"` : ' aria-hidden="true"';
  return `<svg class="${cls}" viewBox="0 0 100 100"${size}${label} xmlns="http://www.w3.org/2000/svg"><g class="av-all"><g class="av-torso">${bodySVG(spec, fur, light)}${chainSVG(spec)}</g><g class="av-headg">${parts.back}${head}${parts.face}${parts.mouth || ''}${parts.big ? '' : eyes}${parts.big ? eyes.replace(/<circle cx="[^"]*" cy="[^"]*" r="1.1"[^>]*\/>/g, '') : ''}${glassesSVG(spec, { x: eyeX, y: eyeY })}${hatSVG(spec)}</g></g></svg>`;
}
const CSS = `
.av{ display:block; overflow:visible; } .av-all{ transform-origin:50px 100px; } .av-headg{ transform-origin:50px 60px; }
.av-anim .av-all{ animation:avBreathe 3.4s ease-in-out infinite; } .av-anim .av-headg{ animation:avNod 5.1s ease-in-out infinite; }
.av-anim .av-eyes{ transform-origin:50px 43px; animation:avBlink 4.6s infinite; }
.av-win .av-all{ animation:avJump .9s ease-out 3; }
@keyframes avBreathe{ 0%,100%{ transform:scaleY(1) } 50%{ transform:scaleY(1.025) } }
@keyframes avNod{ 0%,100%{ transform:rotate(0) } 40%{ transform:rotate(-2.2deg) } 70%{ transform:rotate(1.8deg) } }
@keyframes avBlink{ 0%,92%,100%{ transform:scaleY(1) } 95%{ transform:scaleY(.08) } }
@keyframes avJump{ 0%{ transform:translateY(0) scale(1,1) } 25%{ transform:translateY(-16px) scale(.96,1.05) } 55%{ transform:translateY(0) scale(1.06,.94) } 100%{ transform:translateY(0) scale(1,1) } }
@media (prefers-reduced-motion: reduce){ .av-anim .av-all, .av-anim .av-headg, .av-anim .av-eyes, .av-win .av-all{ animation:none !important; } }
`;
root.SPSQAvatar = { ANIMALS, COLORS, ITEMS, SLOTS, item, defaultSpec, normalize, needed, svg, CSS };
})(typeof window !== 'undefined' ? window : globalThis);

export const Avatar = globalThis.SPSQAvatar;
