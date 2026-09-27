(function(root){
"use strict";
/* ============================================================
   SCL-EDITOR — Textarea mit synchronem Highlight-Overlay,
   Zeilennummern, Fehlerzeile, Auto-Einrückung, Block-Einrücken,
   Kommentar-Umschalter. Einfügungen laufen über execCommand, damit
   Strg+Z (Rückgängig) des Browsers erhalten bleibt.
   Bewusst KEINE Autovervollständigung: Tippen trainiert die Syntax.
   ============================================================ */
const KW = new Set(['IF','THEN','ELSIF','ELSE','END_IF','CASE','OF','END_CASE','FOR','TO','BY','DO','END_FOR','WHILE','END_WHILE',
  'REPEAT','UNTIL','END_REPEAT','EXIT','CONTINUE','RETURN','AND','OR','XOR','NOT','MOD','TRUE','FALSE',
  'VAR','VAR_INPUT','VAR_OUTPUT','VAR_IN_OUT','VAR_TEMP','END_VAR','CONSTANT','RETAIN','NON_RETAIN','FUNCTION','END_FUNCTION',
  'FUNCTION_BLOCK','END_FUNCTION_BLOCK','ORGANIZATION_BLOCK','END_ORGANIZATION_BLOCK','DATA_BLOCK','END_DATA_BLOCK','TYPE','END_TYPE',
  'STRUCT','END_STRUCT','ARRAY','BEGIN','VERSION','TITLE','REGION','END_REGION']);
const TYPES = new Set(['BOOL','INT','DINT','SINT','USINT','UINT','UDINT','REAL','LREAL','TIME','BYTE','WORD','DWORD','STRING','CHAR','VOID']);
const FN = new Set(['INT_TO_REAL','REAL_TO_INT','BOOL_TO_INT','ABS','SQRT','MIN','MAX','LIMIT','ROUND','TRUNC','LEN','CONCAT','LEFT','RIGHT','MID','FIND','DELETE','INSERT','REPLACE','SEL','SHL','SHR','ROL','ROR','CEIL','FLOOR','EXP','LN','SIN','COS','TAN','SQR']);
const FBT = new Set(['TON','TOF','TP','R_TRIG','F_TRIG','CTU','CTD','CTUD']);
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function highlight(code, fbNames){ return highlightRaw(code, fbNames) + '\n'; }
// AWL (Anweisungsliste): Anweisung am Zeilenanfang, Sprungmarken, Operanden, Zeiten/Zähler
const AWL_OPS = /^(U|UN|O|ON|X|XN|=|S|R|NOT|SET|CLR|FP|FN|L|T|TAK|SE|SA|SI|SV|ZV|ZR|SPA|SPB|SPBN|LOOP|BEA|BEB|CALL|NETWORK|MOD|NEGI|NEGD|NEGR|ABS|SQRT|ITD|DTR|ITR|RND|TRUNC|INC|DEC|NOP)$/i;
const isAWL = () => !!(root.QUEST && root.QUEST.lang === 'awl');
function awlLine(l){
  const cm = l.indexOf('//'); const body = cm >= 0 ? l.slice(0, cm) : l, com = cm >= 0 ? l.slice(cm) : '';
  let out = '', rest = body;
  const lab = /^(\s*)([A-Za-z_]\w*)(\s*:)(?!=)/.exec(rest);
  if(lab && !/^\s*(NETWORK)\b/i.test(rest)){ out += esc(lab[1]) + '<span class="tok-label">' + esc(lab[2] + lab[3]) + '</span>'; rest = rest.slice(lab[0].length); }
  const m = /^(\s*)(\S+)(.*)$/.exec(rest);
  if(m){
    const w = m[2];
    let op = w, tail = m[3];
    const paren = /^(UN|U|ON|O|XN|X)\($/i.test(w);
    if(/^NETWORK$/i.test(w)) out += esc(m[1]) + '<span class="tok-keyword">' + esc(w) + '</span><span class="tok-comment">' + esc(tail) + '</span>';
    else if(/^:=|^=>/.test(tail.trim()) && !AWL_OPS.test(w)) out += esc(m[1]) + '<span class="tok-local">' + esc(w) + '</span>' + highlightRaw(tail);
    else if(AWL_OPS.test(w) || paren || w === ')' || /^(==|<>|>=|<=|>|<|[+\-*/])[IDR]$/i.test(w)){
      out += esc(m[1]) + '<span class="tok-keyword">' + esc(op) + '</span>';
      const tm = /^(\s+)([TZ]\d+)\s*$/i.exec(tail);
      if(tm) out += esc(tm[1]) + '<span class="tok-fb">' + esc(tm[2]) + '</span>';
      else out += tail.replace(/S5T#[0-9A-Za-z_.]+/gi, '\u0001$&\u0002').split(/(\u0001[^\u0002]*\u0002)/).map(x => x[0] === '\u0001' ? '<span class="tok-time">' + esc(x.slice(1, -1)) + '</span>' : highlightRaw(x)).join('');
    }
    else out += esc(m[1]) + highlightRaw(w + tail);
  } else out += esc(rest);
  return out + (com ? '<span class="tok-comment">' + esc(com) + '</span>' : '');
}
// Fehlerstelle markieren: [a, b) als Wellenlinie
function highlightMarked(code, fbNames, a, b){
  if(a === null || a === undefined || a < 0 || b <= a) return highlight(code, fbNames);
  return highlightRaw(code.slice(0, a), fbNames) + '<span class="tok-err">' + (highlightRaw(code.slice(a, b), fbNames) || ' ') + '</span>' + highlightRaw(code.slice(b), fbNames) + '\n';
}
function highlightRaw(code, fbNames){
  if(isAWL() && !highlightRaw._inner){ highlightRaw._inner = true; try{ return code.split('\n').map(awlLine).join('\n'); } finally { highlightRaw._inner = false; } }
  fbNames = fbNames || new Set();
  let out = '', i = 0; const n = code.length;
  while(i < n){
    const c = code[i];
    if((c === '(' && code[i+1] === '*') || (c === '/' && code[i+1] === '*')){
      const close = c === '(' ? '*)' : '*/'; let j = code.indexOf(close, i+2); j = j < 0 ? n : j + 2;
      out += '<span class="tok-comment">' + esc(code.slice(i,j)) + '</span>'; i = j; continue;
    }
    if(c === '/' && code[i+1] === '/'){ let j = code.indexOf('\n', i); if(j < 0) j = n; out += '<span class="tok-comment">' + esc(code.slice(i,j)) + '</span>'; i = j; continue; }
    const tm = /^(T|TIME)#[0-9][0-9A-Za-z_.]*/i.exec(code.slice(i, i+30));
    if(tm){ out += '<span class="tok-time">' + esc(tm[0]) + '</span>'; i += tm[0].length; continue; }
    if(c === '%'){ let j = i+1; while(j < n && /[A-Za-z0-9.]/.test(code[j])) j++; out += '<span class="tok-addr">' + esc(code.slice(i,j)) + '</span>'; i = j; continue; }
    if(c === "'"){ let j = code.indexOf("'", i+1); const nl = code.indexOf('\n', i+1); if(j < 0 || (nl >= 0 && nl < j)) j = nl < 0 ? n : nl; else j = j + 1; out += '<span class="tok-string">' + esc(code.slice(i,j)) + '</span>'; i = j; continue; }
    if(c === '{'){ let j = code.indexOf('}', i+1); j = j < 0 ? n : j+1; out += '<span class="tok-comment">' + esc(code.slice(i,j)) + '</span>'; i = j; continue; }
    if(c === '"'){ let j = code.indexOf('"', i+1); j = j < 0 ? n : j+1; out += '<span class="tok-var">' + esc(code.slice(i,j)) + '</span>'; i = j; continue; }
    if(/[0-9]/.test(c)){ let j = i; while(j < n && /[0-9A-Fa-f_.#Ee]/.test(code[j]) && !(code[j]==='.' && code[j+1]==='.')) j++; out += '<span class="tok-number">' + esc(code.slice(i,j)) + '</span>'; i = j; continue; }
    if(/[A-Za-z_#]/.test(c)){
      let j = i + (c === '#' ? 1 : 0); while(j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
      const w = code.slice(i,j), up = w.replace('#','').toUpperCase();
      let cls = null;
      if(c !== '#' && KW.has(up)) cls = 'tok-keyword';
      else if(c !== '#' && TYPES.has(up)) cls = 'tok-type';
      else if(c !== '#' && (FN.has(up) || /^[A-Z]+_TO_[A-Z]+$/.test(up))) cls = 'tok-func';
      else if(c === '#') cls = 'tok-local';
      else if(FBT.has(up) || fbNames.has(up)) cls = 'tok-fb';
      out += cls ? '<span class="' + cls + '">' + esc(w) + '</span>' : esc(w);
      i = j; continue;
    }
    if(c === ':' && code[i+1] === '='){ out += '<span class="tok-op">:=</span>'; i += 2; continue; }
    out += esc(c); i++;
  }
  return out;
}
// Wort/Token an einer Position (Offset) bestimmen
function tokenAt(code, off){
  if(off < 0 || off > code.length) return null;
  const isW = ch => /[A-Za-z0-9_#]/.test(ch || '');
  if(code[off] === '"' || (off > 0 && code[off-1] === '"' && !isW(code[off]))){ }
  let a = off, b = off;
  if(!isW(code[a]) && isW(code[a-1])) a = b = off - 1;
  if(!isW(code[a])){
    // "globaler Name"
    const q1 = code.lastIndexOf('"', off), nl = code.lastIndexOf('\n', off);
    if(q1 > nl){ const q2 = code.indexOf('"', q1 + 1); if(q2 >= off && (code.indexOf('\n', q1) < 0 || code.indexOf('\n', q1) > q2)) return { start:q1, end:q2 + 1, word:code.slice(q1 + 1, q2), quoted:true }; }
    return null;
  }
  while(a > 0 && isW(code[a-1])) a--;
  while(b < code.length && isW(code[b])) b++;
  if(code[a-1] === '"' && code[b] === '"') return { start:a-1, end:b+1, word:code.slice(a, b), quoted:true };
  return { start:a, end:b, word:code.slice(a, b).replace(/^#/, ''), hash:code[a] === '#' };
}
function offsetOf(code, line, col){
  const lines = code.split('\n'); let off = 0;
  for(let i = 0; i < line - 1 && i < lines.length; i++) off += lines[i].length + 1;
  return off + Math.max(0, (col || 1) - 1);
}

const OPEN_END = /\b(THEN|DO|OF|ELSE|REPEAT|BEGIN|STRUCT|VAR|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_TEMP|CONSTANT|RETAIN)\s*(\/\/.*)?$/i;
const CASE_LABEL = /^\s*-?\d+(\s*\.\.\s*-?\d+)?(\s*,\s*-?\d+(\s*\.\.\s*-?\d+)?)*\s*:\s*$/;
const DEDENT_WORDS = /^\s*(END_IF|END_CASE|END_FOR|END_WHILE|END_REPEAT|ELSE|ELSIF|UNTIL|END_VAR|END_STRUCT)\b/i;

function insertText(ta, text){
  ta.focus();
  let ok = false;
  try{ ok = document.execCommand('insertText', false, text); }catch(e){ ok = false; }
  if(!ok){
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.dispatchEvent(new Event('input'));
  }
}
function selectLines(ta){
  const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
  const ls = v.lastIndexOf('\n', s - 1) + 1;
  let le = v.indexOf('\n', e > s && v[e-1] === '\n' ? e - 1 : e); if(le < 0) le = v.length;
  ta.selectionStart = ls; ta.selectionEnd = le;
  return v.slice(ls, le);
}

function attach(ta, pre, gutter, errEl, opts){
  opts = opts || {};
  let fbNames = new Set(), errLine = 0, mark = null;
  const cs = () => getComputedStyle(ta);
  function lineHeight(){ return parseFloat(cs().lineHeight) || 22; }
  function updateGutter(){
    if(!gutter) return;
    const n = ta.value.split('\n').length;
    let h = ''; for(let i = 1; i <= n; i++) h += '<div' + (i === errLine ? ' class="err"' : '') + '>' + i + '</div>';
    gutter.innerHTML = h;
  }
  function positionErr(){
    if(!errEl) return;
    if(!errLine){ errEl.style.display = 'none'; return; }
    const pt = parseFloat(cs().paddingTop) || 0;
    errEl.style.display = 'block';
    errEl.style.top = (pt + (errLine - 1) * lineHeight() - ta.scrollTop) + 'px';
    errEl.style.height = lineHeight() + 'px';
  }
  function sync(){ pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; if(gutter) gutter.scrollTop = ta.scrollTop; positionErr(); }
  function refresh(){ pre.innerHTML = mark ? highlightMarked(ta.value, fbNames, mark.a, mark.b) : highlight(ta.value, fbNames); updateGutter(); sync(); }
  ta.addEventListener('input', () => { if(errLine){ errLine = 0; } mark = null; refresh(); if(opts.onChange) opts.onChange(ta.value); });
  // Zeichenraster (Monospace, kein Umbruch) → Position unter der Maus
  let cw = 0;
  function charWidth(){
    if(cw) return cw;
    const c = document.createElement('canvas').getContext('2d'); const st = cs();
    c.font = st.fontSize + ' ' + st.fontFamily; cw = c.measureText('MMMMMMMMMM').width / 10 || 8.4;
    return cw;
  }
  function posAt(clientX, clientY){
    const r = ta.getBoundingClientRect(), st = cs();
    const x = clientX - r.left - (parseFloat(st.paddingLeft) || 0) + ta.scrollLeft;
    const y = clientY - r.top - (parseFloat(st.paddingTop) || 0) + ta.scrollTop;
    if(x < 0 || y < 0) return null;
    const line = Math.floor(y / lineHeight()) + 1, col = Math.floor(x / charWidth()) + 1;
    const lines = ta.value.split('\n');
    if(line > lines.length || col > lines[line-1].length + 1) return null;
    return { line, col, off: offsetOf(ta.value, line, col) };
  }
  let hoverTimer = 0, lastKey = '';
  ta.addEventListener('mousemove', e => {
    if(!opts.onHover) return;
    clearTimeout(hoverTimer);
    const x = e.clientX, y = e.clientY;
    hoverTimer = setTimeout(() => {
      const p = posAt(x, y);
      if(!p){ if(lastKey){ lastKey = ''; opts.onHover(null); } return; }
      const inMark = mark && p.off >= mark.a && p.off < Math.max(mark.b, mark.a + 1);
      const tok = tokenAt(ta.value, p.off);
      const key = (inMark ? 'E' : '') + (tok ? tok.start + ':' + tok.end : '');
      if(key === lastKey) return;
      lastKey = key;
      opts.onHover(tok || inMark ? { token: tok, line: p.line, col: p.col, error: inMark ? mark.msg : null, x, y } : null);
    }, 280);
  });
  ta.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); if(lastKey && opts.onHover){ lastKey = ''; opts.onHover(null); } });
  ta.addEventListener('keydown', () => { if(opts.onHover && lastKey){ lastKey = ''; opts.onHover(null); } });
  ta.addEventListener('scroll', sync);

  ta.addEventListener('keydown', e => {
    if(e.key === 'Tab'){
      e.preventDefault();
      if(ta.selectionStart !== ta.selectionEnd && ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n') || e.shiftKey){
        const block = selectLines(ta);
        const out = block.split('\n').map(l => e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l).join('\n');
        const start = ta.selectionStart; insertText(ta, out); ta.selectionStart = start; ta.selectionEnd = start + out.length;
      } else insertText(ta, '  ');
      return;
    }
    if(e.key === '/' && (e.ctrlKey || e.metaKey)){
      e.preventDefault();
      const block = selectLines(ta), lines = block.split('\n');
      const allCommented = lines.every(l => /^\s*\/\//.test(l) || !l.trim());
      const out = lines.map(l => !l.trim() ? l : allCommented ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.replace(/^(\s*)/, '$1// ')).join('\n');
      const start = ta.selectionStart; insertText(ta, out); ta.selectionStart = start; ta.selectionEnd = start + out.length;
      return;
    }
    if(e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey){
      const v = ta.value, pos = ta.selectionStart;
      const ls = v.lastIndexOf('\n', pos - 1) + 1;
      let line = v.slice(ls, pos);
      let indent = (line.match(/^[ \t]*/) || [''])[0];
      e.preventDefault();
      // Schlüsselwort am Zeilenanfang (END_IF, ELSE …) automatisch ausrücken
      const before = v.slice(0, ls).split('\n'); let prevIndent = '';
      for(let k = before.length - 2; k >= 0; k--){ if(before[k].trim()){ prevIndent = (before[k].match(/^[ \t]*/)||[''])[0]; break; } }
      if(DEDENT_WORDS.test(line) && indent.length >= 2 && indent.length >= prevIndent.length){
        const saveEnd = ta.selectionEnd;
        ta.selectionStart = ls; ta.selectionEnd = ls + 2;
        if(v.slice(ls, ls + 2) === '  '){ insertText(ta, ''); indent = indent.slice(2); ta.selectionStart = ta.selectionEnd = saveEnd - 2; line = line.slice(2); }
        else { ta.selectionStart = pos; ta.selectionEnd = saveEnd; }
      }
      let next = indent;
      if(OPEN_END.test(line) || CASE_LABEL.test(line) || /^\s*ELSIF\b/i.test(line)) next = indent + '  ';
      insertText(ta, '\n' + next);
      return;
    }
  });
  return {
    refresh,
    setValue(v){ ta.value = v; errLine = 0; refresh(); ta.scrollTop = 0; },
    getValue(){ return ta.value; },
    setErrorLine(n){ errLine = n || 0; if(!n) mark = null; updateGutter(); positionErr(); if(!n) refresh(); },
    // Wellenlinie an der Fehlerstelle (Zeile/Spalte), Meldung für den Tooltip
    setErrorMark(line, col, msg, quiet){
      if(!line){ mark = null; refresh(); return; }
      const v = ta.value, off = offsetOf(v, line, col || 1);
      let t = tokenAt(v, Math.min(off, v.length - 1));
      if(!t || t.end - t.start < 1){ const ls = offsetOf(v, line, 1); let le = v.indexOf('\n', ls); if(le < 0) le = v.length; t = { start: Math.min(off, Math.max(ls, le - 1)), end: Math.min(Math.max(off + 1, ls + 1), Math.max(le, ls + 1)) }; }
      mark = { a: t.start, b: t.end, msg: msg || '' };
      if(!quiet) errLine = line;
      refresh();
    },
    tokenAt(line, col){ return tokenAt(ta.value, offsetOf(ta.value, line, col)); },
    replaceRange(a, b, text){ ta.focus(); ta.selectionStart = a; ta.selectionEnd = b; insertText(ta, text); },
    offsetOf(line, col){ return offsetOf(ta.value, line, col); },
    setFbNames(list){ fbNames = new Set((list||[]).map(s => s.toUpperCase())); refresh(); },
    insertAtCursor(t){ insertText(ta, t); },
    relayout(){ positionErr(); }
  };
}
root.SCLEditor = { attach, highlight, tokenAt, offsetOf };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SCLEditor;
})(typeof window !== 'undefined' ? window : globalThis);
