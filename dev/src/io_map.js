(function(root){
"use strict";
/* ============================================================
   FESTE E/A-BELEGUNG UND PLC-VARIABLENTABELLE (docs/AUFTRAG_FEEDBACK1.md Paket 5.2)
   Jede Variable einer Quest bekommt genau eine Adresse (%I/%Q/%M …) und einen Kommentar – in allen Aufgaben dieselbe.
   Die Adressen werden hier deterministisch aus den Aufgaben abgeleitet (Eingang, wenn die Tests sie setzen; Ausgang, wenn die Tests sie erwarten;
   sonst Merker), die Kommentare stehen in den Dateien io_….js der Inhaltsordner (defIO). Ab Aufgabe 3 nennt der Auftrag keine Variablennamen mehr, sondern die
   Funktion – die Lernenden suchen die passende Variable in der Tabelle „PLC-Variablen“ (Name · Adresse · Datentyp · Kommentar).
   ============================================================ */
function classOf(t, name){
  const vt = String((t.varTypes || {})[name] || '').toUpperCase(), v = (t.initialVars || {})[name];
  if(vt){ if(/^BOOL/.test(vt)) return 'Bool'; if(/REAL/.test(vt)) return 'Real'; if(/^(S5)?TIME/.test(vt)) return 'Time'; if(/STRING|CHAR/.test(vt)) return 'Str'; if(/ARRAY|STRUCT|^"/.test(vt)) return 'Arr'; return 'Int'; }
  if(typeof v === 'boolean') return 'Bool';
  if(typeof v === 'number') return Number.isInteger(v) ? 'Int' : 'Real';
  if(typeof v === 'string') return 'Str';
  if(Array.isArray(v) || (v && typeof v === 'object')) return 'Arr';
  return 'Int';
}
// Namen, die eine Aufgabe als Variablen (nicht als Instanzen) kennt
function varsOf(t){ const fb = t.fbTypes || {}; return Object.keys(t.initialVars || {}).filter(n => !(n in fb) && !/^_/.test(n)); }
function casesOf(t){ return [].concat(t.pro ? (t.tests || []).concat(t.timed || []) : (t.testCases || []).concat(t.timedTestCases || [])); }
function assignIO(C){
  const io = {}, cnt = {};
  const next = (key, step, base) => { cnt[key] = (cnt[key] == null ? (base || 0) : cnt[key] + step); return cnt[key]; };
  // Rolle je Name: gemäss erstem Auftreten in den Tests (Eingang: gesetzt · Ausgang: erwartet)
  const role = {};
  C.tasks.forEach(t => {
    const ins = new Set(), exp = new Set();
    casesOf(t).forEach(c => { Object.keys(c.setup || {}).forEach(k => ins.add(k)); Object.keys(c.expect || {}).forEach(k => exp.add(k)); (c.steps || []).forEach(s => { Object.keys(s.inputs || {}).forEach(k => ins.add(k)); Object.keys(s.expect || {}).forEach(k => exp.add(k)); }); });
    varsOf(t).forEach(n => { if(role[n]) return; role[n] = exp.has(n) ? 'out' : ins.has(n) ? 'in' : 'mem'; });
  });
  C.tasks.forEach(t => varsOf(t).forEach(n0 => {
    const cls = classOf(t, n0), first = io[n0], n = !first || first.cls === cls ? n0 : n0 + '@' + cls;   // gleicher Name mit anderem Datentyp = andere Variable (eigene Adresse)
    if(io[n]) return;
    const r = role[n0] || 'mem', A = { in: 'I', out: 'Q', mem: 'M' }[r];
    let addr;
    if(cls === 'Bool'){ const k = next(A + 'bit', 1, 0); addr = '%' + A + Math.floor(k / 8) + '.' + (k % 8); }
    else if(cls === 'Int'){ const k = next(A + 'W', 2, r === 'mem' ? 0 : 64); addr = '%' + A + 'W' + k; }
    else if(cls === 'Real' || cls === 'Time'){ const k = next(A + 'D', 4, r === 'mem' ? 100 : 128); addr = '%' + A + 'D' + k; }
    else { const k = next('MB', 32, 300); addr = '%MB' + k; }
    io[n] = { addr, dir: r, cls, name: n0 };
  }));
  C.io = io; C.ioComments = C.ioComments || {};
  return io;
}
// Zeilen der Variablentabelle einer Aufgabe: { name, addr, comment }
function keyOf(C, t, n){ const cls = classOf(t, n); return C.io && C.io[n] && C.io[n].cls === cls ? n : n + '@' + cls; }
function tableOf(C, t){ return varsOf(t).map(n => ({ name: n, addr: (C.io[keyOf(C, t, n)] || {}).addr || '', comment: (C.ioComments || {})[n] || '' })); }
// Enthält ein Text einen Variablennamen? Kennung mit _ oder Ziffer/Grossbuchstaben im Wort → immer; einfache Wörter nur in <code>
function leaks(text, names){
  const out = [], html = String(text || ''), codes = (html.match(/<code>[\s\S]*?<\/code>/g) || []).map(x => x.replace(/<[^>]+>/g, '').trim());
  const plain = html.replace(/<[^>]+>/g, ' ');
  names.forEach(n => {
    const ident = /_|\d|[a-z][A-Z]/.test(n);
    if(codes.some(c => c === n || c.split(/[^A-Za-z0-9_#"]+/).includes(n))) out.push(n);
    else if(ident && new RegExp('(^|[^A-Za-z0-9_])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])').test(plain)) out.push(n);
  });
  return [...new Set(out)];
}
root.assignIO = assignIO;
root.SPSQIO = { assignIO, tableOf, keyOf, varsOf, leaks, classOf };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SPSQIO;
})(typeof window !== 'undefined' ? window : globalThis);
