(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Engineering-Laptop (docs/SENSORWERKSTATT_PLAN.md Teil 4.3; Paket S6)
   An die Arbeitsweise im TIA Portal angelehnt (Begriffe und Abläufe), eigenständiges Aussehen, keine Logos.
   Reiter: Gerätesicht · PLC-Variablen · Programm (OB1) · Beobachtung · Diagnose
   Übersetzen, „In Gerät laden“ (Vorschau-Dialog, CPU → STOP, optional Start), CPU Start/Stopp, Laden nötig nach Konfigurationsänderung.
   API: Engineering.mount(host, { cpu, hw, tags, source, lang, langs:['scl','fup'], starts:{scl,fup}, editor, onLoad, onChange })
        → { tab(name), compile(), load(start), tick(), hw, tags, get source(), setSource(s, lang), watch, destroy }
   editor (optional): { el, get(), set(text), setLang(lang) } – sonst SCL: Textfeld mit Hervorhebung, FUP: grafischer Funktionsplan-Editor (KOPEditor, Palette, Ziehen, PLC-Variablen als Chips; Umschalter Text).
   KOP gibt es in der Sensorwerkstatt nicht mehr (Entscheid 29.09.2026); alte Entwürfe mit lang 'kop' werden als FUP geöffnet (gleiches Textformat).
   starts (optional): Startvorlage je Sprache; beim Sprachwechsel ersetzt sie den unveränderten Text der vorigen Sprache.
   ============================================================ */
const P = () => root.SensorPLC;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TABS = [['device', 'Gerätesicht'], ['tags', 'PLC-Variablen'], ['program', 'Programm (OB1)'], ['watch', 'Beobachtung'], ['diag', 'Diagnose']];
const LANG_NAME = { scl: 'SCL', fup: 'FUP' };
const TYPE_LIST = ['Bool', 'Int', 'UInt', 'DInt', 'Real', 'Word', 'DWord', 'Byte'];

function mount(host, opt){
  opt = opt || {};
  const S = P(), cpu = opt.cpu || S.Cpu();
  const hw = opt.hw || S.newHw();
  const tags = opt.tags || JSON.parse(JSON.stringify(S.TAGS_WERKSTATT));
  const langs = (opt.langs || ['scl', 'fup']).filter(l => l !== 'kop');
  const starts = opt.starts || {};
  let lang = (opt.lang === 'kop' ? 'fup' : opt.lang) || langs[0], source = opt.source || '', cur = 'device', slot = 2, lastCompile = null;
  const watch = (opt.watch || ['Ind_Metall', 'Band', '%IW96']).map(r => typeof r === 'string' ? { ref: r, fmt: 'dez' } : r);
  const trend = { row: -1, data: [] };

  host.classList.add('eng');
  host.innerHTML = '<header class="eng-head"><b>Projekt Werkstatt</b> <span class="eng-cpu" aria-live="polite"></span><span class="eng-need" hidden>Laden erforderlich</span>'
    + '<span class="eng-sp"></span><button type="button" class="eng-btn" data-e="compile">Übersetzen</button><button type="button" class="eng-btn prim" data-e="load">In Gerät laden</button>'
    + '<button type="button" class="eng-btn" data-e="start">CPU Start</button><button type="button" class="eng-btn" data-e="stop">CPU Stopp</button></header>'
    + '<div class="eng-tabs" role="tablist" aria-label="Engineering">' + TABS.map(([k, n]) => '<button type="button" role="tab" class="eng-tab" data-tab="' + k + '" aria-selected="false" tabindex="-1">' + esc(n) + '</button>').join('') + '</div>'
    + '<div class="eng-body" role="tabpanel"></div><div class="eng-msg" role="status" aria-live="polite"></div>'
    + '<div class="eng-dlg" role="dialog" aria-modal="true" aria-label="Laden in Gerät" hidden></div>';
  const $ = s => host.querySelector(s), body = $('.eng-body');
  const say = (text, kind) => { const m = $('.eng-msg'); m.textContent = text || ''; m.className = 'eng-msg' + (kind ? ' ' + kind : ''); };
  const changed = () => { head(); if(opt.onChange) opt.onChange({ hw, tags, source, lang }); };

  function head(){
    const c = $('.eng-cpu'); c.textContent = 'CPU 1214C: ' + cpu.mode; c.className = 'eng-cpu ' + (cpu.mode === 'RUN' ? 'run' : 'stop');
    $('.eng-need').hidden = !(cpu.needsLoad(hw) || (cpu.loaded && (cpu.loaded.source !== source || cpu.loaded.lang !== lang || JSON.stringify(cpu.loaded.all.slice(0, tags.length).map(t => [t.name, t.addr, t.type])) !== JSON.stringify(tags.map(t => [t.name, t.addr, t.type])))));
  }
  function tab(k){
    cur = k;
    host.querySelectorAll('.eng-tab').forEach(b => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    render();
  }
  function render(){
    if(cur === 'device') body.innerHTML = deviceHTML();
    else if(cur === 'tags') body.innerHTML = tagsHTML();
    else if(cur === 'program') renderProgram();
    else if(cur === 'watch') body.innerHTML = watchHTML();
    else if(cur === 'diag') body.innerHTML = diagHTML();
    head();
  }

  /* ---------- Gerätesicht ---------- */
  function deviceHTML(){
    const err = diagSlots();
    return '<div class="eng-rack" aria-label="Baugruppenträger">' + S.SLOTS.map(s => '<button type="button" class="eng-slot' + (s.slot === slot ? ' on' : '') + (err[s.slot] ? ' err' : '') + '" data-slot="' + s.slot + '"><small>Steckplatz ' + s.slot + '</small><b>-' + s.id + '</b><span>' + esc(s.name) + '</span></button>').join('') + '</div>'
      + '<div class="eng-props"><h4>Eigenschaften: ' + esc(S.SLOTS.find(s => s.slot === slot).name) + '</h4><p class="eng-dim">Bestellnummer ' + esc(S.SLOTS.find(s => s.slot === slot).order) + ' · Adressen ' + esc(S.SLOTS.find(s => s.slot === slot).addr) + '</p><div class="eng-scroll">' + propsHTML() + '</div></div>';
  }
  const sel = (path, val, opts) => '<select data-hw="' + path + '">' + opts.map(o => { const [v, n] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>';
  const chk = (path, val, dis) => '<input type="checkbox" data-hw="' + path + '"' + (val ? ' checked' : '') + (dis ? ' disabled' : '') + '>';
  function propsHTML(){
    if(slot === 1) return '<table class="eng-tbl"><tr><th>Digitaleingänge</th><td>Eingangsverzögerung ' + sel('cpu.diDelay', hw.cpu.diDelay, S.DI_DELAYS.map(d => [d, d + ' ms'])) + '</td></tr>'
      + ['AI0', 'AI1'].map(k => '<tr><th>Analogeingang ' + k + ' (%' + S.AI_ADDR[k] + ')</th><td>Spannung 0–10 V (fest) · Glättung ' + sel('cpu.' + k + '.smooth', hw.cpu[k].smooth, S.SMOOTH) + '</td></tr>').join('') + '</table>';
    if(slot === 2) return '<table class="eng-tbl"><tr><th>Kanal</th><th>Messart</th><th>Messbereich</th><th>Glättung</th><th>Drahtbruch</th><th>Überlauf</th><th>Unterlauf</th></tr>'
      + ['CH0', 'CH1', 'CH2', 'CH3'].map(k => { const c = hw.ai[k], off = c.type === 'off'; return '<tr><th>' + k.slice(2) + ' (%' + S.AI_ADDR[k] + ')</th><td>' + sel('ai.' + k + '.type', c.type, S.AI_TYPES) + '</td><td>' + (off ? '—' : sel('ai.' + k + '.range', c.range, S.AI_RANGES[c.type])) + '</td><td>' + (off ? '—' : sel('ai.' + k + '.smooth', c.smooth, S.SMOOTH)) + '</td>'
        + '<td>' + chk('ai.' + k + '.diag.wireBreak', c.diag.wireBreak, off || c.range !== '4..20mA') + '</td><td>' + chk('ai.' + k + '.diag.over', c.diag.over, off) + '</td><td>' + chk('ai.' + k + '.diag.under', c.diag.under, off) + '</td></tr>'; }).join('')
      + '</table><p class="eng-dim">Drahtbruch lässt sich nur bei 4–20 mA erkennen (Live Zero).</p>';
    if(slot === 3) return '<table class="eng-tbl"><tr><th>Kanal</th><th>Ausgabeart</th><th>Bereich</th><th>Ersatzwert bei STOP</th></tr>'
      + ['CH0', 'CH1'].map(k => { const c = hw.aq[k]; return '<tr><th>' + k.slice(2) + ' (%' + S.AQ_ADDR[k] + ')</th><td>' + sel('aq.' + k + '.type', c.type, [['U', 'Spannung'], ['I', 'Strom']]) + '</td><td>' + sel('aq.' + k + '.range', c.range, c.type === 'U' ? ['±10V', '0..10V'] : ['0..20mA', '4..20mA']) + '</td><td><input type="number" data-hw="aq.' + k + '.stopValue" value="' + esc(c.stopValue) + '" min="-32768" max="32767" step="1"></td></tr>'; }).join('') + '</table>';
    return '<table class="eng-tbl"><tr><th>Digitaleingänge %I16.0–%I16.7</th><td>Eingangsverzögerung ' + sel('di.delay', (hw.di || {}).delay || '6.4', S.DI_DELAYS.map(d => [d, d + ' ms'])) + '</td></tr></table>';
  }
  function setHw(path, v){
    const ks = path.split('.'); let o = hw; for(let i = 0; i < ks.length - 1; i++){ o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
    // Messart geändert → passenden Bereich wählen
    const m = /^ai\.(CH\d)\.type$/.exec(path); if(m){ const c = hw.ai[m[1]]; if(!(S.AI_RANGES[c.type] || []).includes(c.range)) c.range = (S.AI_RANGES[c.type] || ['4..20mA'])[S.AI_RANGES[c.type] && S.AI_RANGES[c.type].length > 1 ? 1 : 0] || '4..20mA'; if(c.range !== '4..20mA') c.diag.wireBreak = false; }
    const r = /^ai\.(CH\d)\.range$/.exec(path); if(r && v !== '4..20mA') hw.ai[r[1]].diag.wireBreak = false;
    const q = /^aq\.(CH\d)\.type$/.exec(path); if(q) hw.aq[q[1]].range = v === 'U' ? '0..10V' : '4..20mA';
    say('Konfiguration geändert' + (cpu.loaded ? ' – zum Übernehmen in das Gerät laden.' : '.'), 'warn');
    render(); changed();
  }

  /* ---------- Variablentabelle ---------- */
  function tagsHTML(){
    const chk = S.checkTags(tags), bad = new Set(chk.errors.map(e => e.row));
    return '<div class="eng-scroll"><table class="eng-tbl eng-tags"><thead><tr><th>Name</th><th>Datentyp</th><th>Adresse</th><th>Kommentar</th><th></th></tr></thead><tbody>'
      + tags.map((t, i) => '<tr' + (bad.has(i) ? ' class="bad"' : '') + '><td><input data-tag="' + i + '.name" value="' + esc(t.name) + '" aria-label="Name Zeile ' + (i + 1) + '"></td><td><select data-tag="' + i + '.type" aria-label="Datentyp Zeile ' + (i + 1) + '">' + TYPE_LIST.map(x => '<option' + (x === t.type ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></td>'
        + '<td><input data-tag="' + i + '.addr" value="' + esc(t.addr) + '" size="7" aria-label="Adresse Zeile ' + (i + 1) + '"></td><td><input data-tag="' + i + '.comment" value="' + esc(t.comment || '') + '" aria-label="Kommentar Zeile ' + (i + 1) + '"></td><td><button type="button" class="eng-btn sm" data-deltag="' + i + '" aria-label="Zeile ' + (i + 1) + ' löschen">✕</button></td></tr>').join('')
      + '</tbody></table></div><button type="button" class="eng-btn" data-e="addtag">+ Variable</button>'
      + '<ul class="eng-errs">' + chk.errors.map(e => '<li class="err">' + esc(e.text) + '</li>').join('') + chk.warnings.map(e => '<li class="warn">' + esc(e.text) + '</li>').join('') + '</ul>';
  }

  /* ---------- Programm ---------- */
  let ed = opt.editor || null, edApi = null, graph = null;
  function renderProgram(){
    graph = null;
    body.innerHTML = '<div class="eng-prog-bar">Sprache: ' + langs.map(l => '<button type="button" class="eng-btn' + (l === lang ? ' on' : '') + '" data-lang="' + l + '" aria-pressed="' + (l === lang) + '">' + LANG_NAME[l] + '</button>').join('') + ' <span class="eng-dim">Baustein: Main [OB1] · Variablen als "Name" oder %Adresse</span></div>'
      + '<div class="eng-ed"></div><div class="eng-prev"></div><ul class="eng-errs"></ul>';
    const box = $('.eng-ed');
    if(ed){ box.appendChild(ed.el); ed.setLang && ed.setLang(lang); ed.set(source); }
    else if(lang === 'fup' && root.KOPEditor) mountGraph(box);
    else {
      box.innerHTML = '<div class="eng-edwrap"><div class="eng-gutter" aria-hidden="true"></div><div class="eng-edarea"><pre class="eng-hl" aria-hidden="true"></pre><textarea class="eng-ta" spellcheck="false" aria-label="Programm OB1"></textarea><div class="eng-errline"></div></div></div>';
      const ta = box.querySelector('.eng-ta'); ta.value = source;
      if(root.SCLEditor && lang === 'scl'){ edApi = root.SCLEditor.attach(ta, box.querySelector('.eng-hl'), box.querySelector('.eng-gutter'), box.querySelector('.eng-errline'), { onChange: v => { source = v; changed(); } }); edApi.refresh(); }
      else { edApi = null; box.querySelector('.eng-hl').textContent = ''; ta.classList.add('plain'); ta.addEventListener('input', () => { source = ta.value; preview(); changed(); }); }
    }
    preview(); showErrors();
  }
  // Grafischer Funktionsplan-Editor (kop_editor.js): eigene Elemente statt der Spielhülle, Textmodell wie in der FUP Quest
  function mountGraph(box){
    box.innerHTML = '<div class="eng-fup"><div class="eng-fup-bar"></div><div class="eng-fup-vars" role="group" aria-label="PLC-Variablen (antippen oder auf einen Eingang ziehen)"></div><div class="eng-fup-txt"><textarea class="eng-ta plain eng-fta" spellcheck="false" aria-label="Programm OB1 als Text"></textarea></div></div>';
    const bar = box.querySelector('.eng-fup-bar'), vars = box.querySelector('.eng-fup-vars'), txt = box.querySelector('.eng-fup-txt'), ta = box.querySelector('.eng-fta');
    ta.value = source;
    vars.innerHTML = tags.filter(t => t.name).map(t => '<button type="button" class="var-chip" data-name="&quot;' + esc(t.name) + '&quot;" title="' + esc((t.addr || '') + (t.comment ? ' · ' + t.comment : '')) + ' – antippen oder ziehen">"' + esc(t.name) + '"<span class="vt">' + esc(t.type || '') + '</span></button>').join('') || '<span class="eng-dim">Keine PLC-Variablen.</span>';
    const stub = { getValue: () => ta.value, setValue(v){ ta.value = v; }, refresh(){}, relayout(){}, setErrorLine(){}, setErrorMark(){}, setFbNames(){}, offsetOf: () => 0, tokenAt: () => null, replaceRange(){},
      insertAtCursor(t){ ta.focus(); ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } };
    ta.addEventListener('input', () => { source = ta.value; changed(); });
    graph = root.KOPEditor.attach(stub, { flavor: 'fup', body: txt, toolsBar: bar, symBar: null, varList: vars,
      onChange: v => { source = v; changed(); }, onNoSelection: () => say('Tippe zuerst im Funktionsplan einen Eingang, eine Box oder einen Ausgang an – oder ziehe die Box bzw. Variable direkt auf einen passenden Eingang.', 'warn') });
    graph.setSymbols(tags.filter(t => t.name).map(t => '"' + t.name + '"'));
    vars.addEventListener('click', e => { const b = e.target.closest('.var-chip'); if(b) graph.insertAtCursor(b.dataset.name); });
    graph.setValue(source);
    edApi = graph;
  }
  function preview(){
    const p = $('.eng-prev'); if(!p) return;
    if(lang === 'scl' || !root.KOPEditor || graph){ p.innerHTML = ''; return; }
    const S2 = S.preprocess(source, tags); p.innerHTML = root.KOPEditor.renderStatic(S2.src, null, 'fup');
  }
  function showErrors(){
    const ul = $('.eng-errs'); if(!ul || cur !== 'program') return;
    if(edApi) edApi.setErrorLine(lastCompile && !lastCompile.ok ? (lastCompile.errors[0].line || 0) : 0);
    ul.innerHTML = lastCompile && !lastCompile.ok ? lastCompile.errors.map(e => '<li class="err">' + (e.line ? 'Zeile ' + e.line + ': ' : '') + esc(String(e.text).replace(/^Zeile \d+: /, '')) + '</li>').join('') : lastCompile ? '<li class="ok">Übersetzen fehlerfrei.</li>' : '';
  }
  function compile(){
    if(ed) source = ed.get();
    lastCompile = cpu.compile(source, lang, tags);
    say(lastCompile.ok ? 'Übersetzen: 0 Fehler.' : 'Übersetzen: ' + lastCompile.errors.length + ' Fehler.', lastCompile.ok ? 'ok' : 'err');
    showErrors(); return lastCompile;
  }

  /* ---------- Laden ---------- */
  function loadDialog(){
    const c = compile();
    if(!c.ok){ tab('program'); showErrors(); return; }
    const d = $('.eng-dlg');
    d.innerHTML = '<div class="eng-dlgbox"><h4>Vorschau Laden</h4><ul><li>Programm Main [OB1] (' + LANG_NAME[lang] + ')</li><li>PLC-Variablen (' + tags.length + ')</li><li>Hardwarekonfiguration' + (cpu.needsLoad(hw) || !cpu.loaded ? ' <b>geändert</b>' : ' unverändert') + '</li></ul>'
      + '<p class="warn">Die CPU wird für das Laden in STOP versetzt.</p><label><input type="checkbox" data-startafter checked> Nach dem Laden starten</label>'
      + '<div class="eng-dlgbtn"><button type="button" class="eng-btn prim" data-e="doload">Laden</button><button type="button" class="eng-btn" data-e="cancel">Abbrechen</button></div></div>';
    d.hidden = false; d.querySelector('[data-e="doload"]').focus();
  }
  function load(start){
    if(ed) source = ed.get();
    const r = cpu.download({ source, lang, tags: JSON.parse(JSON.stringify(tags)), hw });
    $('.eng-dlg').hidden = true;
    if(!r.ok){ lastCompile = r; say('Laden abgebrochen: Übersetzungsfehler.', 'err'); tab('program'); return r; }
    if(start) cpu.start();
    say('Laden erfolgreich' + (start ? ', CPU in RUN.' : ', CPU in STOP.'), 'ok');
    if(opt.onLoad) opt.onLoad(cpu);
    render(); return r;
  }

  /* ---------- Beobachtung ---------- */
  function watchHTML(){
    return '<div class="eng-scroll"><table class="eng-tbl eng-watch"><thead><tr><th>Name / Adresse</th><th>Anzeigeformat</th><th>Beobachtungswert</th><th>Trend</th><th></th></tr></thead><tbody>'
      + watch.map((w, i) => '<tr><td><input data-w="' + i + '" value="' + esc(w.ref) + '" aria-label="Operand Zeile ' + (i + 1) + '"></td><td><select data-wf="' + i + '"><option value="dez"' + (w.fmt === 'dez' ? ' selected' : '') + '>DEZ</option><option value="hex"' + (w.fmt === 'hex' ? ' selected' : '') + '>HEX</option></select></td>'
        + '<td class="eng-val" data-wv="' + i + '">' + esc(valOf(w)) + '</td><td><button type="button" class="eng-btn sm' + (trend.row === i ? ' on' : '') + '" data-trend="' + i + '" aria-pressed="' + (trend.row === i) + '">📈</button></td><td><button type="button" class="eng-btn sm" data-delw="' + i + '" aria-label="Zeile löschen">✕</button></td></tr>').join('')
      + '</tbody></table></div><button type="button" class="eng-btn" data-e="addw">+ Zeile</button> <span class="eng-dim">Werte ' + (cpu.mode === 'RUN' ? 'live aus der CPU' : 'aus dem Prozessabbild (CPU in STOP)') + '</span>'
      + '<canvas class="eng-trend" width="560" height="140"' + (trend.row < 0 ? ' hidden' : '') + ' aria-label="Trendkurve"></canvas>';
  }
  function valOf(w){ const v = cpu.read(w.ref); return v === undefined ? '—' : S.fmt(v, w.fmt); }
  function drawTrend(){
    const c = $('.eng-trend'); if(!c || trend.row < 0) return;
    const x = c.getContext('2d'), d = trend.data, W = c.width, H = c.height;
    x.fillStyle = '#0b1218'; x.fillRect(0, 0, W, H); x.strokeStyle = '#1d2a37'; for(let i = 1; i < 4; i++){ x.beginPath(); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke(); }
    if(d.length < 2) return;
    const lo = Math.min(...d), hi = Math.max(...d), span = hi - lo || 1;
    x.strokeStyle = '#39ff7a'; x.lineWidth = 2; x.beginPath();
    d.forEach((v, i) => { const px = i / (d.length - 1) * (W - 8) + 4, py = H - 6 - (v - lo) / span * (H - 12); if(i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke();
    x.fillStyle = '#9fb0c0'; x.font = '11px monospace'; x.fillText(String(Math.round(hi * 100) / 100), 4, 12); x.fillText(String(Math.round(lo * 100) / 100), 4, H - 4);
  }

  /* ---------- Diagnose ---------- */
  function diagSlots(){ const e = {}; Object.keys(cpu.alarms || {}).forEach(k => { if(/Steckplatz 2/.test(k)) e[2] = true; if(/Steckplatz 1/.test(k)) e[1] = true; }); return e; }
  function diagHTML(){
    const e = diagSlots();
    return '<div class="eng-cols"><div><h4>Baugruppenzustand</h4><table class="eng-tbl">' + S.SLOTS.map(s => '<tr><th>-' + s.id + ' ' + esc(s.name) + '</th><td class="' + (e[s.slot] ? 'err' : 'ok') + '" data-mod="' + s.id + '">' + (e[s.slot] ? 'Fehler' : 'OK') + '</td></tr>').join('') + '</table>'
      + '<p>Betriebszustand: <b>' + cpu.mode + '</b></p></div>'
      + '<div><h4>Diagnosepuffer</h4><ol class="eng-buf">' + (cpu.diag.length ? cpu.diag.map(d => '<li><span>' + d.t.toFixed(1) + ' s</span> ' + esc(d.text) + '</li>').join('') : '<li class="eng-dim">leer</li>') + '</ol></div></div>';
  }

  /* ---------- Ereignisse ---------- */
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || !host.contains(b)) return;
    if(b.dataset.tab){ tab(b.dataset.tab); return; }
    if(b.dataset.slot){ slot = +b.dataset.slot; render(); return; }
    if(b.dataset.lang){ if(ed) source = ed.get(); const old = lang; lang = b.dataset.lang;
      if(lang !== old && starts[lang] != null && (!source.trim() || source === starts[old])) source = starts[lang];   // unveränderte Vorlage → Vorlage der neuen Sprache
      lastCompile = null; renderProgram(); changed(); return; }
    if(b.dataset.deltag){ tags.splice(+b.dataset.deltag, 1); render(); changed(); return; }
    if(b.dataset.delw){ watch.splice(+b.dataset.delw, 1); if(trend.row >= watch.length) trend.row = -1; render(); return; }
    if(b.dataset.trend){ const i = +b.dataset.trend; trend.row = trend.row === i ? -1 : i; trend.data = []; render(); return; }
    const k = b.dataset.e;
    if(k === 'compile'){ compile(); if(cur !== 'program') tab('program'); }
    else if(k === 'load') loadDialog();
    else if(k === 'doload') load(!!(host.querySelector('[data-startafter]') || {}).checked);
    else if(k === 'cancel'){ $('.eng-dlg').hidden = true; say('Laden abgebrochen.'); }
    else if(k === 'start'){ const r = cpu.start(); say(r.ok ? 'CPU in RUN.' : r.error, r.ok ? 'ok' : 'err'); render(); }
    else if(k === 'stop'){ cpu.stop('Engineering'); say('CPU in STOP.', 'warn'); render(); }
    else if(k === 'addtag'){ tags.push({ name: 'Neu_' + (tags.length + 1), type: 'Bool', addr: '%M10.' + (tags.length % 8), comment: '' }); render(); changed(); }
    else if(k === 'addw'){ watch.push({ ref: '', fmt: 'dez' }); render(); const ins = host.querySelectorAll('[data-w]'); ins[ins.length - 1].focus(); }
  });
  host.addEventListener('change', e => {
    const t = e.target;
    if(t.dataset.hw){ setHw(t.dataset.hw, t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value); return; }
    if(t.dataset.tag){ const [i, f] = t.dataset.tag.split('.'); tags[+i][f] = t.value.trim(); render(); changed(); return; }
    if(t.dataset.w){ watch[+t.dataset.w].ref = t.value.trim(); tick(); return; }
    if(t.dataset.wf){ watch[+t.dataset.wf].fmt = t.value; tick(); }
  });
  host.addEventListener('keydown', e => {
    const t = e.target.closest && e.target.closest('.eng-tab');
    if(t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){ e.preventDefault(); const all = [...host.querySelectorAll('.eng-tab')], i = all.indexOf(t); const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]; tab(n.dataset.tab); n.focus(); }
    if(e.key === 'Escape' && !$('.eng-dlg').hidden){ $('.eng-dlg').hidden = true; say('Laden abgebrochen.'); }
  });
  // nach jedem SPS-Zyklus: Beobachtungswerte, Trend, Diagnose, Kopf aktualisieren (ohne Eingabefelder zu zerstören)
  function tick(){
    head();
    if(trend.row >= 0 && watch[trend.row]){ const v = cpu.read(watch[trend.row].ref); if(typeof v === 'number' || typeof v === 'boolean'){ trend.data.push(+v); if(trend.data.length > 200) trend.data.shift(); } }
    if(cur === 'watch'){ watch.forEach((w, i) => { const c = host.querySelector('[data-wv="' + i + '"]'); if(c) c.textContent = valOf(w); }); drawTrend(); }
    else if(cur === 'diag') body.innerHTML = diagHTML();
    else if(cur === 'device'){ const e = diagSlots(); host.querySelectorAll('.eng-slot').forEach(b => b.classList.toggle('err', !!e[+b.dataset.slot])); }
  }
  tab(opt.tab || 'device');
  return { tab, compile, load, tick, hw, tags, watch, get source(){ return ed ? ed.get() : source; }, get lang(){ return lang; }, setSource(s, l){ source = s; if(l) lang = l === 'kop' ? 'fup' : l; if(cur === 'program') renderProgram(); changed(); }, cpu, destroy(){ host.innerHTML = ''; } };
}
const CSS = `
.eng{ color:#dbe7f3; font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif; background:#0c1218; border:1px solid #2a3a4c; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; min-width:0; }
.eng-head{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; } .eng-sp{ flex:1; }
.eng-cpu{ padding:3px 8px; border-radius:6px; font:700 12px ui-monospace,monospace; } .eng-cpu.run{ background:#123d24; color:#7fe3a0; } .eng-cpu.stop{ background:#4a3310; color:#ffd166; }
.eng-need{ padding:3px 8px; border-radius:6px; background:#40202a; color:#ff9aa8; font-size:12px; }
.eng-btn{ min-height:36px; padding:5px 10px; border-radius:8px; border:1px solid #2a3a4c; background:#16202b; color:inherit; cursor:pointer; font:inherit; }
.eng-btn.prim{ border-color:#58c4ff; color:#9fdcff; } .eng-btn.on{ border-color:#39ff7a; color:#39ff7a; } .eng-btn.sm{ min-height:30px; padding:2px 8px; }
.eng-tabs{ display:flex; gap:2px; border-bottom:1px solid #2a3a4c; overflow-x:auto; }
.eng-tab{ min-height:40px; padding:6px 12px; border:0; border-bottom:3px solid transparent; background:none; color:#9fb0c0; cursor:pointer; font:inherit; white-space:nowrap; }
.eng-tab.on{ color:#e6eef6; border-bottom-color:#58c4ff; } .eng-tab:focus-visible, .eng-btn:focus-visible{ outline:3px solid #58c4ff; outline-offset:2px; }
.eng-body{ min-height:220px; min-width:0; } .eng-msg{ min-height:20px; font-size:13px; color:#9fb0c0; } .eng-msg.ok{ color:#7fe3a0; } .eng-msg.warn{ color:#ffd166; } .eng-msg.err{ color:#ff8f8f; }
.eng-rack{ display:flex; gap:4px; overflow-x:auto; padding:6px; background:#10161d; border-radius:8px; }
.eng-slot{ min-width:120px; min-height:92px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:6px 8px; border-radius:6px; border:2px solid #34495e; background:#1d2b38; color:inherit; cursor:pointer; text-align:left; font:inherit; }
.eng-slot small{ color:#8aa0b4; font-size:11px; } .eng-slot span{ font-size:12px; } .eng-slot.on{ border-color:#58c4ff; } .eng-slot.err{ box-shadow:inset 0 -4px 0 #ff3b30; }
.eng-props h4, .eng-cols h4{ margin:10px 0 4px; font-size:13px; } .eng-dim{ color:#8aa0b4; font-size:12px; }
.eng-tbl{ border-collapse:collapse; font-size:13px; } .eng-tbl th, .eng-tbl td{ padding:4px 6px; border-bottom:1px solid #1d2a37; text-align:left; vertical-align:middle; }
.eng-tbl select, .eng-tbl input{ min-height:32px; background:#0b1218; color:#e6eef6; border:1px solid #2a3a4c; border-radius:6px; font:inherit; padding:2px 6px; } .eng-tbl input[type=checkbox]{ min-height:20px; width:20px; }
.eng-tags tr.bad input{ border-color:#ff5a6a; } .eng-scroll{ overflow-x:auto; max-width:100%; }
.eng-errs{ list-style:none; padding:0; margin:6px 0; font-size:13px; } .eng-errs .err, td.err{ color:#ff8f8f; } .eng-errs .warn{ color:#ffd166; } .eng-errs .ok, td.ok{ color:#7fe3a0; }
.eng-prog-bar{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:6px; }
.eng-edwrap{ display:flex; border:1px solid #2a3a4c; border-radius:8px; overflow:hidden; background:#0b1218; }
.eng-gutter{ padding:8px 6px; color:#4f6275; font:13px/20px ui-monospace,monospace; text-align:right; min-width:28px; overflow:hidden; } .eng-gutter .err{ color:#ff8f8f; }
.eng-edarea{ position:relative; flex:1; min-height:200px; }
.eng-hl, .eng-ta{ position:absolute; inset:0; margin:0; padding:8px; font:13px/20px ui-monospace,monospace; white-space:pre; overflow:auto; tab-size:2; }
.eng-ta{ background:transparent; color:transparent; caret-color:#e6eef6; border:0; resize:none; outline:none; } .eng-ta.plain{ color:#e6eef6; }
.eng-hl{ color:#e6eef6; pointer-events:none; } .eng .tok-keyword{ color:#1ec8e0; font-weight:600; } .eng .tok-comment{ color:#6f8396; font-style:italic; } .eng .tok-number{ color:#ffb86c; } .eng .tok-time{ color:#ff8c00; } .eng .tok-addr{ color:#ff79c6; } .eng .tok-func{ color:#39ff14; } .eng-errline{ position:absolute; left:0; right:0; background:rgba(255,80,80,.15); pointer-events:none; display:none; }
.eng-prev{ margin-top:6px; overflow-x:auto; }
.eng-fup{ display:flex; flex-direction:column; gap:6px; min-width:0; } .eng-fup-bar{ display:flex; gap:6px; } .eng-fup-bar .tool-btn{ min-height:36px; padding:4px 10px; border-radius:8px; border:1px solid #2a3a4c; background:#16202b; color:inherit; cursor:pointer; font:inherit; }
.eng-fup-vars{ display:flex; flex-wrap:wrap; gap:4px; max-height:96px; overflow:auto; padding:4px; background:#10161d; border-radius:8px; }
.eng .var-chip{ min-height:30px; padding:2px 8px; border-radius:14px; border:1px solid #2a3a4c; background:#16202b; color:#dbe7f3; font:12px ui-monospace,monospace; cursor:grab; display:inline-flex; gap:6px; align-items:center; } .eng .var-chip .vt{ color:#8aa0b4; font-size:11px; } .eng .var-chip:hover{ border-color:#58c4ff; }
.eng-fta{ position:static; width:100%; min-height:220px; box-sizing:border-box; border:1px solid #2a3a4c; border-radius:8px; background:#0b1218; }
.eng-fup .kop-canvas{ min-height:200px; overflow:auto; }
.eng-val{ font:700 13px ui-monospace,monospace; color:#9fdcff; min-width:90px; }
.eng-trend{ display:block; max-width:100%; margin-top:8px; border-radius:6px; }
.eng-cols{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.3fr); gap:16px; }
.eng-buf{ list-style:none; padding:0; margin:0; font-size:13px; max-height:260px; overflow:auto; } .eng-buf li{ padding:3px 0; border-bottom:1px solid #1d2a37; } .eng-buf span{ color:#8aa0b4; font:12px ui-monospace,monospace; margin-right:6px; }
.eng-dlg{ position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:50; } .eng-dlg[hidden]{ display:none; }
.eng-dlgbox{ background:#0f171f; border:1px solid #58c4ff; border-radius:10px; padding:14px; max-width:420px; width:calc(100% - 32px); } .eng-dlgbox .warn{ color:#ffd166; } .eng-dlgbtn{ display:flex; gap:8px; margin-top:10px; }
@media (max-width:700px){ .eng-cols{ grid-template-columns:1fr; } .eng-slot{ min-width:100px; } }
`;
function injectCss(){ if(typeof document === 'undefined' || document.getElementById('engCss')) return; const s = document.createElement('style'); s.id = 'engCss'; s.textContent = CSS; document.head.appendChild(s); }
root.Engineering = { mount: (h, o) => { injectCss(); return mount(h, o); }, CSS };
})(typeof window !== 'undefined' ? window : globalThis);
