(function(root){
"use strict";
/* ============================================================
   FUP-Werkbank im Spiel (V5) – Adapter mit der Schnittstelle von KOPEditor.attach
   ------------------------------------------------------------
   FUPWorkbench.attach(textEditor, opts) → api wie KOPEditor.attach:
     getValue/setValue, insertAtCursor, setErrorLine/-Mark, relayout, refresh, setFbNames,
     setSymbols, setCallables, offsetOf/tokenAt/replaceRange, showFlow/clearFlow,
     setReadOnly, mode/setMode
   opts: { onChange(text), onNoSelection(), body, toolsBar, symBar, varList }
   Der Text im SCL-Editor bleibt die Quelle: Änderungen im Funktionsplan schreiben den Text,
   die Textansicht lädt beim Umschalten neu in den Funktionsplan.
   Datentypen/Datenbausteine (ohne Netzwerke) werden nur in der Textansicht bearbeitet.

   FUPWorkbench.renderStatic(src, flow) → HTML (nur ansehen) für Theorie, Handbuch, Lösungsvergleich, Portal.
   ============================================================ */
const W = root.FUPWorkbench, G = root.FUPGraph, K = root.KOP;
if(!W || !G || !K) return;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const NOGRAPH = /^\s*(TYPE|DATA_BLOCK)\b/im;
const isFrameless = txt => /^\s*(TYPE|DATA_BLOCK|FUNCTION|FUNCTION_BLOCK|ORGANIZATION_BLOCK)\b/im.test(txt);
function noGraphFor(txt){
  if(NOGRAPH.test(txt) && !/^\s*(FUNCTION|FUNCTION_BLOCK|ORGANIZATION_BLOCK)\b/im.test(txt)) return true;
  if(isFrameless(txt)){ const fr = K.splitBlock(txt); return !fr || !K.isKopBody(fr.body); }
  return false;
}
// Variablen der Aufgabe als Tag-Tabelle für die Operandenprüfung (Adresse/Kommentar aus PLC_TAGS)
function tagsFor(names){
  const T = root.PLC_TAGS || {}, out = {};
  names.forEach(n => { const k = String(n).replace(/^"|"$/g, ''); if(!k || /^#/.test(k) || /^_/.test(k)) return; const g = T[k] || {}; out[k] = { addr: g.addr || '', type: g.type || '', comment: g.comment || '', quote: /^"/.test(n) }; });
  return out;
}

/* ---------- Editor im Spiel ---------- */
function attach(textEditor, opts){
  opts = opts || {};
  const body = opts.body || document.getElementById('editorBody');
  const host = document.createElement('div'); host.className = 'fwb-host'; host.id = 'fwbHost';
  body.parentNode.insertBefore(host, body);
  const toggle = document.createElement('button'); toggle.className = 'tool-btn'; toggle.id = 'kopViewBtn'; toggle.type = 'button';
  toggle.title = 'Zwischen Funktionsplan und Textansicht wechseln';
  const toolsBar = opts.toolsBar || document.querySelector('.editor-tools'); if(toolsBar) toolsBar.insertBefore(toggle, toolsBar.firstChild);
  const symBar = opts.symBar !== undefined ? opts.symBar : document.getElementById('symBar');
  let mode = 'graph', noGraph = false, loaded = null, readOnly = false;
  const wb = W.create(host, { onChange: txt => { loaded = txt; textEditor.setValue(txt); if(opts.onChange) opts.onChange(txt); } });
  wb.el.classList.add('fwb-game');
  const info = document.createElement('div'); info.className = 'fwb-info'; info.hidden = true;
  info.innerHTML = '<i class="fa-solid fa-circle-info"></i> Dieser Baustein hat keine Netzwerke (Datentyp oder Datenbaustein). Er wird in der <b>Textansicht</b> bearbeitet.';
  host.appendChild(info);
  if(opts.varList !== null) wb.bindVarDrag(opts.varList || document.getElementById('varList') || document.body);

  function load(){
    const txt = textEditor.getValue();
    noGraph = noGraphFor(txt);
    info.hidden = !noGraph; wb.el.style.display = noGraph ? 'none' : '';
    if(!noGraph && txt !== loaded){ wb.setValue(txt); loaded = txt; }
  }
  function setMode(m){
    mode = m === 'text' ? 'text' : 'graph';
    body.style.display = mode === 'text' ? '' : 'none'; host.style.display = mode === 'graph' ? '' : 'none';
    if(symBar) symBar.style.display = mode === 'text' ? '' : 'none';
    toggle.innerHTML = mode === 'graph' ? '<i class="fa-solid fa-code"></i> <span class="btn-text">Text</span>' : '<i class="fa-solid fa-diagram-project"></i> <span class="btn-text">FUP</span>';
    toggle.setAttribute('aria-pressed', mode === 'text' ? 'true' : 'false');
    if(mode === 'graph') load(); else textEditor.refresh && textEditor.refresh();
  }
  toggle.addEventListener('click', () => setMode(mode === 'graph' ? 'text' : 'graph'));
  // Fehlerzeile im Text → Netzwerk im Funktionsplan
  function netOfLine(line){ const li = G.lineInfo(textEditor.getValue())[line]; return li ? li.net : 0; }
  function mark(line, msg){
    if(noGraph) return;
    if(!line){ wb.setErrorMark(0); return; }
    if(wb.markNet) wb.markNet(netOfLine(line), msg); else wb.setErrorMark(line, 1, msg);
  }
  const api = {
    isKop: true, isFup: true, workbench: wb,
    getValue: () => textEditor.getValue(),
    setValue(v){ v = String(v == null ? '' : v); textEditor.setValue(v); loaded = null; if(mode === 'graph') load(); },
    insertAtCursor(txt){
      if(mode === 'text' || noGraph) return textEditor.insertAtCursor(txt);
      if(readOnly) return;
      if(!wb.insertAtCursor(txt) && opts.onNoSelection) opts.onNoSelection();
    },
    setErrorLine(n){ textEditor.setErrorLine(n); mark(n, ''); },
    setErrorMark(line, col, msg, quiet){ textEditor.setErrorMark(line, col, msg, quiet); mark(line, msg); },
    relayout(){ textEditor.relayout && textEditor.relayout(); },
    refresh(){ textEditor.refresh && textEditor.refresh(); if(mode === 'graph') wb.refresh(); },
    setFbNames(n){ textEditor.setFbNames && textEditor.setFbNames(n); },
    setSymbols(list){
      list = list || [];
      if(wb.setTags) wb.setTags(tagsFor(list));
      wb.setSymbols(list.filter(s => /^#/.test(s)));
    },
    setCallables(map){ if(wb.setCallables) wb.setCallables(map || {}); },
    offsetOf(...a){ return textEditor.offsetOf(...a); }, tokenAt(...a){ return textEditor.tokenAt(...a); },
    replaceRange(...a){ const r = textEditor.replaceRange(...a); if(mode === 'graph') load(); return r; },
    showFlow(env){ if(!noGraph) wb.showFlow(env || null); },
    clearFlow(){ wb.clearFlow(); },
    setReadOnly(ro){ readOnly = !!ro; wb.setReadOnly(readOnly); },
    get mode(){ return mode; }, setMode
  };
  setMode('graph');
  return api;
}

/* ---------- Statische Darstellung ---------- */
let seq = 0, SI = null;   // SI: unsichtbare Werkbank, zeichnet die Netzwerke
function renderStatic(src, flow){
  src = String(src || '');
  if(noGraphFor(src)) return '<pre class="code">' + esc(src) + '</pre>';
  const fr = isFrameless(src) ? K.splitBlock(src) : null;
  const bodyTxt = fr ? fr.body : src;
  let prog;
  try{ prog = G.fromText(bodyTxt); K.toSCL(K.parse(bodyTxt), { dry:true }); }catch(e){ return '<pre class="code">' + esc(src) + '</pre>'; }
  if(typeof document === 'undefined') return null;
  if(!SI) SI = W.create(document.createElement('div'), { readOnly: true });
  const html = '<div class="fwb-static" data-fwbs="' + (++seq) + '">' + prog.networks.map((n, i) =>
    '<div class="fwb-snet"><div class="fwb-snethead"><b>Netzwerk ' + (i + 1) + '</b> ' + esc(n.title || '') + '</div>' +
    (n.comment ? '<div class="fwb-scomment">' + esc(n.comment) + '</div>' : '') +
    '<div class="fwb-scanvas">' + SI.staticSvg(prog, i, flow || null) + '</div></div>').join('') + '</div>';
  return fr ? '<pre class="code kop-head">' + esc(fr.head.trim()) + '</pre>' + html + '<pre class="code kop-head">' + esc(fr.foot.trim()) + '</pre>' : html;
}

W.attach = attach;
W.renderStatic = renderStatic;
W.tagsFor = tagsFor;
})(typeof window !== 'undefined' ? window : globalThis);
