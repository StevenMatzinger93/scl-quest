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
root.defKop = function(o){
  const t = root.defTask(o);
  t.lang = 'kop';
  try{ t.refLines = root.KOP.elementCount(o.ref); }catch(e){ t.refLines = 0; }
  if(!o.start) t.starterCode = 'NETWORK ' + (o.net || 'Netzwerk 1') + '\n? => ?;\n';
  return t;
};
})(typeof window !== 'undefined' ? window : globalThis);
