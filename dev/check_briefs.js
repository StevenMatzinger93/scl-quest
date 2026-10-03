// Feedback-Auftrag 5.2: Aufträge ab Aufgabe 3 ohne Variablennamen, PLC-Variablen mit Adresse, Typ und Kommentar.
// node check_briefs.js <scl|kop|fup|awl> [--all] – listet Verstösse; Exit 1 bei Fehlern. Wird auch von den Validatoren genutzt (require).
const fs = require('fs'), vm = require('vm'), path = require('path');
const D = path.join(__dirname, 'src'), DIRS = { scl: 'content', kop: 'content_kop', fup: 'content_fup', awl: 'content_awl' };
const TD = require('./textdiet.js');
function load(q){
  const g = { window: {}, console }; g.window = g; g.globalThis = g; vm.createContext(g);
  const run = f => vm.runInContext(fs.readFileSync(path.join(D, f), 'utf8'), g, { filename: f });
  ['engine.js', 'engine_pro.js', 'kop.js', 'awl.js'].forEach(run);
  const dir = DIRS[q];
  ['content/_helpers.js'].concat(q === 'kop' || q === 'fup' ? ['content_kop/_kop.js'] : q === 'awl' ? ['content_awl/_awl.js'] : []).forEach(run);
  fs.readdirSync(path.join(D, dir)).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => run(dir + '/' + f));
  if(fs.existsSync(path.join(D, dir, 'tags.js'))) run(dir + '/tags.js');
  return g;
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Verstoss: ein Variablenname der Aufgabe im Auftrag – immer, wenn er in <code>/<b>/<i> steht oder „technisch“ aussieht (Unterstrich, Ziffer, Anführungszeichen)
function briefIssues(t, names){
  const html = String(t.briefing || ''), out = [];
  const marked = (html.match(/<(code|b|i|em|strong)\b[^>]*>[\s\S]*?<\/\1>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(' ');
  const plain = TD.plain(html);
  names.forEach(n => {
    const w = new RegExp('(^|[^A-Za-zÄÖÜäöü0-9_])"?' + reEsc(n) + '"?(?![A-Za-zÄÖÜäöü0-9_])');
    if(w.test(marked) || (/[_0-9]/.test(n) && w.test(plain)) || new RegExp('"' + reEsc(n) + '"').test(plain)) out.push(n);
  });
  return out;
}
function check(q, all){
  const g = load(q), C = g.SCL_CONTENT, T = g.PLC_TAGS || {}, errs = [], warns = [];
  const chs = [...new Set(C.tasks.filter(t => !t.hidden).map(t => t.level))].sort((a, b) => a - b);
  const order = chs.flatMap(ch => C.tasks.filter(t => t.level === ch && !t.hidden));
  order.forEach((t, i) => {
    const names = t.pro ? Object.keys(t.project.globals || {}) : Object.keys(t.initialVars || {}).concat(Object.keys(t.fbTypes || {}));
    names.filter(n => !/^_/.test(n)).forEach(n => { const x = T[n]; if(!x || !x.addr || !x.type || !x.comment) errs.push(t.id + ': PLC-Variable ' + n + ' ohne Adresse/Typ/Kommentar'); });
    if(i >= 2){ const bad = briefIssues(t, names.filter(n => !/^_/.test(n))); if(bad.length) errs.push(t.id + ': Auftrag nennt Variablennamen ' + bad.join(', ')); }
    TD.check(t).filter(m => /^Auftrag/.test(m)).forEach(m => warns.push(t.id + ': ' + m));
    // „Funktion zählt“: der Auftrag beschreibt, WAS passieren soll – Bausteine nur als Vorschlag („zum Beispiel mit …“)
    if(/(^|[.>:!?]\s*)(Nutze|Verwende|Benutze)\b/.test(String(t.briefing || ''))) warns.push(t.id + ': Auftrag schreibt einen Weg vor (Nutze/Verwende) – als Vorschlag formulieren („zum Beispiel mit …“)');
  });
  const seen = {};
  Object.keys(T).forEach(n => { const a = T[n].addr; if(/^%/.test(a)){ if(seen[a]) errs.push('Doppelbelegung ' + a + ': ' + seen[a] + ' / ' + n); seen[a] = n; } });
  return { errs, warns };
}
module.exports = { check, briefIssues };
if(require.main === module){
  const q = process.argv[2] || 'scl', r = check(q);
  r.errs.forEach(e => console.log('✗ ' + e)); if(process.argv.includes('--all')) r.warns.forEach(w => console.log('△ ' + w));
  console.log(q.toUpperCase() + ': ' + r.errs.length + ' Fehler, ' + r.warns.length + ' Hinweise (Auftrag > 3 Zeilen)');
  process.exit(r.errs.length ? 1 : 0);
}
