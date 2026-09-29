// PLC-Variablentabelle (Paket 5.2): jede Variable hat Adresse + Datentyp + Kommentar, keine Doppelbelegung,
// und ab Aufgabe 3 nennen Geschichte und Auftrag keine Variablennamen mehr (sie beschreiben die Funktion).
// Aufruf: require('./validate_io.js')(C, { E_, W_ })  – E_/W_ wie im jeweiligen Validator
module.exports = function(C, cb){
  global.window = global.window || global;
  const IO = require('./src/io_map.js');
  const io = IO.assignIO(C);
  const names = [...new Set(Object.keys(io).map(k => io[k].name))], comments = C.ioComments || {};
  const missing = names.filter(n => !comments[n]);
  if(process.env.IO_LIST) missing.forEach(n => console.log('  ↳ Kommentar fehlt: ' + n + ' ' + io[n].addr));
  if(missing.length) cb.E_('io', missing.length + ' Variablen ohne Kommentar in der PLC-Variablentabelle (defIO): ' + missing.slice(0, 12).join(', ') + (missing.length > 12 ? ' …' : ''));
  const unused = Object.keys(comments).filter(n => !io[n]);
  if(unused.length) cb.W_('io', unused.length + ' Kommentare zu unbekannten Variablen: ' + unused.slice(0, 8).join(', '));
  const seen = {}; names.forEach(n => { const a = io[n].addr; if(seen[a]) cb.E_('io', 'Adresse ' + a + ' doppelt vergeben: ' + seen[a] + ' und ' + n); seen[a] = n; });
  let leaked = 0; const ids = [];
  C.tasks.forEach((t, i) => {
    if(i < 2) return;   // Aufgabe 1 und 2 nennen die Variablen noch (Einstieg)
    const vars = t.pro ? Object.keys((t.project && t.project.globals) || {}) : IO.varsOf(t);
    const bad = IO.leaks(t.briefing, vars).concat(IO.leaks(t.story, vars));
    if(bad.length){ leaked++; if(ids.length < 6) ids.push(t.id + ' (' + [...new Set(bad)].slice(0, 3).join(', ') + ')'); if(process.env.IO_LIST) console.log('  ↳ ' + t.id + ' (Aufgabe ' + (i + 1) + '): ' + [...new Set(bad)].join(', ')); }
  });
  if(leaked) cb.E_('auftrag', leaked + ' Aufgaben ab Nr. 3 nennen Variablennamen in Geschichte/Auftrag, z. B. ' + ids.join('; '));
  return { vars: names.length, missing: missing.length, leaked };
};
