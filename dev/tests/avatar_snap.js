// Avatare 2.0 (A1–A3): Schnappschüsse der 8 Tiere (Bildvergleich gegen tests/baseline/avatar/*.png), eindeutige IDs bei 40 Avataren,
// Posen/Stile, reduzierte Bewegung und Bildrate mit 40 animierten Avataren (Ziel ≥ 50 fps).
// Aufruf: node tests/avatar_snap.js [--update]   (--update schreibt neue Referenzbilder, nach bewusster Stiländerung)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const A = require('../src/avatar_core.js');
const CORE = fs.readFileSync(path.join(__dirname, '..', 'src', 'avatar_core.js'), 'utf8');
const BASE = path.join(__dirname, 'baseline', 'avatar'), UPDATE = process.argv.includes('--update');
let pass = 0, fail = 0;
const ok = (c, m) => { if(c){ pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } };
const EQ = [{ oberteil: 'tshirt_zahnrad', kopf: 'kappe_rot', brille: 'brille_rund', kette: 'kette_gold' }, { oberteil: 'hemd_kariert', kopf: 'bauhelm' }, { oberteil: 'tshirt_blitz', brille: 'sonnenbrille' }, { oberteil: 'hemd_blau', kopf: 'muetze', kette: 'kette_silber' }];
const AV = Object.keys(A.ANIMALS).map((k, i) => ({ animal: k, color: A.COLORS[i], equip: EQ[i % EQ.length] }));
(async () => {
  // Markup: IDs je Instanz eindeutig, alle Verweise aufgelöst, Kopf-Chip ohne Verläufe
  for(const st of A.STYLES) for(const p of A.POSES){
    const s = A.svg(AV[0], { size: 'card', pose: p, style: st, uid: 'u1-' });
    const ids = [...s.matchAll(/ id="([^"]+)"/g)].map(m => m[1]), refs = [...s.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);
    if(!(ids.every(i => i.startsWith('u1-')) && refs.every(r => ids.includes(r)))){ ok(false, 'IDs/Verweise ' + st + '/' + p); }
  }
  ok(true, 'Markup: alle IDs mit Instanz-Präfix, alle Verweise aufgelöst (3 Stile × 5 Posen)');
  ok(!/Gradient/.test(A.svg(AV[0], { size: 'chip' })) && /viewBox="0 0 100 100"/.test(A.svg(AV[0], { size: 'chip' })), 'Chip: nur Kopf, ohne Verläufe');
  ok(/av-chip/.test(A.svg(AV[0])) && /av-chip/.test(A.svg(AV[0], { size: 28 })), 'alter Aufruf svg(av) liefert weiterhin den Kopf-Chip');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0b1016"><div id="h"></div><script>' + CORE + '</script>');
  // 40 Avatare auf einer Seite (wie die Beamer-Lobby): keine doppelten IDs, alle Verweise lösen auf
  const uniq = await page.evaluate(av => {
    const A = window.SPSQAvatar, h = document.getElementById('h');
    h.innerHTML = Array.from({ length: 40 }, (_, i) => '<span style="display:inline-block;width:64px;height:77px">' + A.svg(av[i % av.length], { size: 'card', anim: true, pose: A.POSES[i % 5] }) + '</span>').join('');
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id).filter(x => x !== 'h' && x !== 'spsq-av-css');
    const refs = [...document.querySelectorAll('[fill^="url"],[clip-path^="url"],[stroke^="url"]')].flatMap(e => ['fill', 'clip-path', 'stroke'].map(a => e.getAttribute(a)).filter(v => v && v.startsWith('url')).map(v => v.match(/#([^)]+)/)[1]));
    return { n: ids.length, u: new Set(ids).size, missing: refs.filter(r => !document.getElementById(r)).length, css: !!document.getElementById('spsq-av-css') };
  }, AV);
  ok(uniq.n >= 200 && uniq.n === uniq.u && !uniq.missing, '40 Avatare: ' + uniq.n + ' IDs, alle eindeutig, keine offenen Verweise');
  ok(uniq.css, 'Animations-CSS einmal eingefügt');
  // Bildrate mit 40 animierten Avataren
  const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if(performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  ok(fps >= 50, '40 animierte Avatare: ' + fps.toFixed(1) + ' fps (≥ 50)');
  // reduzierte Bewegung → statisch
  await page.emulateMedia({ reducedMotion: 'reduce' });
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.av-anim .av-fig')).animationName === 'none'), 'prefers-reduced-motion: keine Animation');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Schnappschüsse der 8 Tiere (ohne Animation) gegen Referenzbilder
  await page.evaluate(av => { const A = window.SPSQAvatar; document.getElementById('h').innerHTML = av.map((x, i) => '<div class="snap" style="display:inline-block;width:200px;height:240px">' + A.svg(x, { size: 'card', uid: 's' + i + '-' }) + '</div>').join(''); }, AV);
  const els = await page.$$('.snap');
  for(let i = 0; i < AV.length; i++){
    const buf = await els[i].screenshot(), file = path.join(BASE, AV[i].animal + '.png');
    if(UPDATE || !fs.existsSync(file)){ fs.writeFileSync(file, buf); ok(true, AV[i].animal + ': Referenzbild geschrieben'); continue; }
    const diff = await page.evaluate(async ([a, b]) => {
      const load = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + src; });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if(x.width !== y.width || x.height !== y.height) return 1;
      const px = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
      const p = px(x), q = px(y); let bad = 0;
      for(let k = 0; k < p.length; k += 4) if(Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 60) bad++;
      return bad / (p.length / 4);
    }, [buf.toString('base64'), fs.readFileSync(file).toString('base64')]);
    ok(diff < 0.01, AV[i].animal + ': Schnappschuss stimmt (' + (diff * 100).toFixed(2) + ' % abweichend)');
  }
  ok(!errors.length, 'keine JS-Fehler ' + errors.join(' | '));
  await browser.close();
  console.log('Avatar-Schnappschüsse: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
