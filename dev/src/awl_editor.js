/* ===== AWL QUEST: Status-Spalte zum Texteditor =====
   Wie „Beobachten“ im TIA Portal: neben jeder Zeile VKE, AKKU1 und AKKU2 des gezeigten Zyklus.
   AWLEditor.attach(textEditor) → Editor mit zusätzlich setProgram(prog), showFlow(env), clearStatus(). */
(function(root){
'use strict';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function fmt(v, ty){
  if(v === undefined || v === null) return '';
  if(typeof v === 'boolean') return v ? '1' : '0';
  if(ty === 'TIME') return 'T#' + (Math.round(v * 1000) / 1000) + 'S';
  if(ty === 'REAL') return (Math.round(v * 1000) / 1000).toFixed(Number.isInteger(Math.round(v * 1000) / 1000) ? 1 : 3).replace(/0+$/, '').replace(/\.$/, '.0');
  return String(v);
}
// HTML einer Statuszeile (auch für Beobachten/Handbuch)
function cell(st){
  if(!st) return '';
  let h = '';
  if(st.v !== undefined) h += '<span class="awl-st-v' + (st.v ? ' on' : '') + '" title="VKE">' + (st.v ? '1' : '0') + '</span>';
  else h += '<span class="awl-st-v none"></span>';
  if(st.a !== undefined) h += '<span class="awl-st-a" title="AKKU1">' + esc(fmt(st.a, st.ta)) + '</span>';
  if(st.b !== undefined) h += '<span class="awl-st-b" title="AKKU2">' + esc(fmt(st.b, st.tb)) + '</span>';
  return h;
}
// Code mit Statusspalte als statische Tabelle (Beobachten, Theorie)
function renderStatic(src, status, lineOffset){
  const lines = String(src || '').replace(/\r/g, '').split('\n'), off = lineOffset || 0;
  const hl = root.SCLEditor ? root.SCLEditor.highlight(src).split('\n') : lines.map(esc);
  return '<div class="awl-static"><div class="awl-static-h"><span></span><span>AWL</span><span>VKE</span><span>AKKU1</span><span>AKKU2</span></div>' + lines.map((l, i) => {
    const st = status ? status[i + 1 + off] : null;
    return '<div class="awl-row' + (st ? ' run' : '') + '"><span class="ln">' + (i + 1) + '</span><code>' + (hl[i] || '&nbsp;') + '</code>' + (st ? cell(st) : '<span class="awl-st-v none"></span>') + '</div>';
  }).join('') + '</div>';
}
function attach(textEditor, opts){
  opts = opts || {};
  const ta = document.getElementById('codeEditor');
  const wrap = ta.parentNode;
  const col = document.createElement('div'); col.className = 'awl-status'; col.id = 'awlStatus'; col.setAttribute('aria-hidden', 'true');
  wrap.appendChild(col);
  let tr = null, lastEnv = null, visible = false;
  const cs = () => getComputedStyle(ta);
  const lh = () => parseFloat(cs().lineHeight) || 22;
  function place(){
    if(!visible){ col.style.display = 'none'; return; }
    col.style.display = '';
    const pt = parseFloat(cs().paddingTop) || 0, h = lh();
    col.querySelectorAll('.awl-srow').forEach(r => { r.style.top = (pt + (parseInt(r.dataset.line, 10) - 1) * h - ta.scrollTop) + 'px'; r.style.height = h + 'px'; r.style.lineHeight = h + 'px'; });
  }
  function render(){
    if(!tr || !lastEnv){ col.innerHTML = ''; visible = false; place(); return; }
    const st = root.AWL.statusOf(tr, lastEnv);
    col.innerHTML = Object.keys(st).map(l => '<div class="awl-srow" data-line="' + l + '">' + cell(st[l]) + '</div>').join('');
    visible = true; place();
  }
  ta.addEventListener('scroll', place);
  ta.addEventListener('input', () => { lastEnv = null; render(); });
  const ed = Object.create(textEditor);
  ed.setProgram = prog => { tr = prog && prog.awl ? prog.awl : null; };
  ed.showFlow = env => { lastEnv = env || null; render(); };
  ed.clearStatus = () => { lastEnv = null; render(); };
  ed.setValue = v => { textEditor.setValue(v); lastEnv = null; render(); };
  ed.relayout = () => { textEditor.relayout(); place(); };
  return ed;
}
root.AWLEditor = { attach, renderStatic, cell, fmt };
})(typeof window !== 'undefined' ? window : globalThis);
