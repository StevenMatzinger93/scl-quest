/* ===== KOP-QUEST: Aufgaben-Helfer =====
   defKop({ …wie defTask…, ref: KOP-Text, start: KOP-Text })
   Die Musterlösung und der Startcode sind Kontaktpläne im Textformat von kop.js.
   must-Kürzel (KOP): NO NC SERIES PARALLEL EDGE_P EDGE_N CMP COIL SET RESET NCOIL MULTI_OUT NETWORKS
                      TON TOF TP CTU CTD MOVE ADD SUB MUL DIV INC DEC */
(function(root){
// Alle Kombinationen der Eingänge als Einzelzyklus-Tests: truth(['A','B'], e => ({ Q: e.A && e.B }), {feste Werte})
root.truth = function(inputs, fn, fixed){
  const out = [];
  for(let m = 0; m < (1 << inputs.length); m++){
    const env = Object.assign({}, fixed || {});
    inputs.forEach((n, i) => { env[n] = !!(m & (1 << (inputs.length - 1 - i))); });
    out.push([env, fn(env)]);
  }
  return out;
};
// FUP Quest nutzt dasselbe Netzwerk-Modell (t.lang = 'kop' = Modell, die Darstellung wählt die Quest)
root.defFup = function(o){ return root.defKop(o); };
root.defFupPro = function(o){ return root.defKopPro(o); };
root.defKop = function(o){
  const t = root.defTask(o);
  t.lang = 'kop';
  try{ t.refLines = root.KOP.elementCount(o.ref); }catch(e){ t.refLines = 0; }
  if(!o.start) t.starterCode = 'NETWORK ' + (o.net || 'Netzwerk 1') + '\n? => ?;\n';
  return t;
};
/* ---------- Profi-Stufe (Kapitel 11–15): Bausteine mit KOP-Rumpf ----------
   kDecl({ in:'Start:Bool|Kommentar; Stopp:Bool', out:'…', inout:'…', stat:'T1:TON', temp:'…' })
   kFB(name, decl, netze) · kFC(name, rückgabe, decl, netze) · kOB(name, netze, decl) · kDB(name, 'A:Int; B:Bool') · kUDT(name, 'A:Int')
   defKopPro({ …wie defProTask… }) — Deklarationstabelle ab Kapitel 11 */
const SECS = [['in','VAR_INPUT'], ['out','VAR_OUTPUT'], ['inout','VAR_IN_OUT'], ['stat','VAR'], ['temp','VAR_TEMP'], ['const','VAR CONSTANT']];
const lines = (spec, ind) => String(spec || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const [def, com] = x.split('|'); const i = def.indexOf(':');
  return ind + def.slice(0, i).trim() + ' : ' + def.slice(i + 1).trim() + ';' + (com ? '   // ' + com.trim() : '');
}).join('\n');
root.kDecl = d => SECS.filter(([k]) => d && d[k]).map(([k, kw]) => kw + '\n' + lines(d[k], '   ') + '\nEND_VAR\n').join('');
root.kFB = (name, d, body) => 'FUNCTION_BLOCK "' + name + '"\n' + root.kDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION_BLOCK';
root.kFC = (name, ret, d, body) => 'FUNCTION "' + name + '" : ' + ret + '\n' + root.kDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION';
root.kOB = (name, body, d) => 'ORGANIZATION_BLOCK "' + name + '"\n' + root.kDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_ORGANIZATION_BLOCK';
root.kDB = (name, spec) => 'DATA_BLOCK "' + name + '"\nVAR\n' + lines(spec, '   ') + '\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
root.kUDT = (name, spec) => 'TYPE "' + name + '"\nSTRUCT\n' + lines(spec, '   ') + '\nEND_STRUCT;\nEND_TYPE';
root.defKopPro = function(o){
  const t = root.defProTask(Object.assign({ table:true }, o));
  t.lang = 'kop';
  t.refLines = t.project.blocks.filter(b => b.edit).reduce((n, b) => { const fr = root.KOP.splitBlock(b.ref); try{ return n + (fr && root.KOP.isKopBody(fr.body) ? root.KOP.elementCount(fr.body) : 0); }catch(e){ return n; } }, 0);
  return t;
};
})(typeof window !== 'undefined' ? window : globalThis);
