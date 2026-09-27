/* ===== AWL-QUEST: Aufgaben-Helfer =====
   defAwl({ …wie defTask…, ref: AWL-Text, start: AWL-Text })   — Grundstufe, Aufgaben mit lang:'awl'
   defAwlPro({ …wie defProTask… })                              — Profi, Bausteine mit AWL-Rumpf (Tabelle an)
   aFB/aFC/aOB/aDB/aUDT + aDecl({in,out,inout,stat,temp,const}) — Deklaration 'Name:Typ|Kommentar; …'
   must-Kürzel (AWL): U UN O ON X XN O_VOR KLAMMER NOT SET CLR ASSIGN S R FP FN SE SA SI SV TIMER TIMER_BIT S5T
                      ZV ZR ZS ZRESET COUNTER COUNTER_LOAD COUNTER_BIT L T TAK ARITH +I -I *I /I +R … MOD CMP CMP_I CMP_R
                      ITD DTR RND TRUNC CONVERT NEG INC DEC SPA SPB SPBN LOOP BEA BEB JUMP LABEL CALL NETWORK */
(function(root){
root.truth = root.truth || function(inputs, fn, fixed){
  const out = [];
  for(let m = 0; m < (1 << inputs.length); m++){
    const env = Object.assign({}, fixed || {});
    inputs.forEach((n, i) => { env[n] = !!(m & (1 << (inputs.length - 1 - i))); });
    out.push([env, fn(env)]);
  }
  return out;
};
root.defAwl = function(o){
  const t = root.defTask(o);
  t.lang = 'awl';
  t.refLines = root.AWL.instrCount(o.ref);
  if(!o.start) t.starterCode = '// ' + (o.net || 'Anweisungsliste') + '\n';
  return t;
};
const SECS = [['in','VAR_INPUT'], ['out','VAR_OUTPUT'], ['inout','VAR_IN_OUT'], ['stat','VAR'], ['temp','VAR_TEMP'], ['const','VAR CONSTANT']];
const lines = (spec, ind) => String(spec || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const [def, com] = x.split('|'); const i = def.indexOf(':');
  return ind + def.slice(0, i).trim() + ' : ' + def.slice(i + 1).trim() + ';' + (com ? '   // ' + com.trim() : '');
}).join('\n');
root.aDecl = d => SECS.filter(([k]) => d && d[k]).map(([k, kw]) => kw + '\n' + lines(d[k], '   ') + '\nEND_VAR\n').join('');
root.aFB = (name, d, body) => 'FUNCTION_BLOCK "' + name + '"\n' + root.aDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION_BLOCK';
root.aFC = (name, ret, d, body) => 'FUNCTION "' + name + '" : ' + ret + '\n' + root.aDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_FUNCTION';
root.aOB = (name, body, d) => 'ORGANIZATION_BLOCK "' + name + '"\n' + root.aDecl(d) + 'BEGIN\n' + (body || '').trim() + (body ? '\n' : '') + 'END_ORGANIZATION_BLOCK';
root.aDB = (name, spec) => 'DATA_BLOCK "' + name + '"\nVAR\n' + lines(spec, '   ') + '\nEND_VAR\nBEGIN\nEND_DATA_BLOCK';
root.aUDT = (name, spec) => 'TYPE "' + name + '"\nSTRUCT\n' + lines(spec, '   ') + '\nEND_STRUCT;\nEND_TYPE';
root.defAwlPro = function(o){
  const t = root.defProTask(Object.assign({ table:true }, o));
  t.lang = 'awl';
  t.refLines = t.project.blocks.filter(b => b.edit).reduce((n, b) => { const sp = root.AWL.splitBlock(b.ref); return n + (sp ? root.AWL.instrCount(sp.body) : 0); }, 0);
  return t;
};
})(typeof window !== 'undefined' ? window : globalThis);
