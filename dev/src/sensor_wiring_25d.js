(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — 2.5D-Verdrahtungsansicht: REFERENZ-STUB (Paket W3). Fable ersetzt die Darstellung (Paket W4), die Schnittstelle bleibt.
   Vertrag: docs/SENSOR_VISUAL_VERTRAG.md. Dieser Stub zeichnet keine Illustration, sondern eine schlichte, voll bedienbare Liste
   (Adern und Klemmen als Schaltflächen, Antippen–Antippen, Ziehen, Tastatur), damit Einbindung, Ereignisse und Tests schon laufen.

   const view = SensorWiring25D.mount(container, { netlist, state, options:{ lang:'de', reducedMotion:false, touch:false, colorAid:false } });
   view.update(state)         neu zeichnen (state = SensorVisual.state)
   view.help(coreId?)         „Zeig mir“: Ader und Zielklemme pulsieren (ohne coreId: state.help)
   view.on(event, fn)         wireStart(coreId) · wireDrop(coreId, terminalId) · wireRemove(coreId) · helpShow(coreId, terminalId) · meterProbe(terminalId, probeNr)
   view.off(event, fn) · view.select(coreId) · view.destroy()
   ============================================================ */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SYM = { ok: '✓', falsch: '✗', fehlt: '○', gesetzt: '•' };            // Zustand immer auch als Zeichen, nicht nur als Farbe
const TXT = { ok: 'richtig', falsch: 'falsch', fehlt: 'fehlt', gesetzt: 'gelegt' };

function mount(container, opt){
  opt = opt || {};
  const o = Object.assign({ lang: 'de', reducedMotion: false, touch: false, colorAid: false }, opt.options || {});
  let nl = opt.netlist, st = opt.state || null, sel = null, helpPair = null;
  const handlers = {};
  const emit = (ev, ...a) => (handlers[ev] || []).slice().forEach(f => { try { f(...a); } catch(e){ if(root.console) console.error(e); } });
  container.classList.add('sw25-stub');
  container.innerHTML = '<div class="sw25-msg" role="status" aria-live="polite"></div><div class="sw25-body"></div>';
  const body = container.querySelector('.sw25-body'), msg = container.querySelector('.sw25-msg');
  const say = t => { msg.textContent = t || ''; };

  function resultOf(core){ return (st && st.results && st.results[core]) || 'fehlt'; }
  function wireOf(core){ return st && st.wires ? st.wires.find(w => w.core === core) : null; }
  function render(){
    const parts = nl.parts.map(p => '<section class="sw25-part" data-part="' + esc(p.id) + '"><h3>' + esc(p.label) + ' <small>' + esc(p.name) + '</small></h3><ul>' + p.cable.cores.map(c => {
      const r = resultOf(c.id), w = wireOf(c.id);
      return '<li><button type="button" class="sw25-core' + (sel === c.id ? ' sel' : '') + '" draggable="true" data-core="' + esc(c.id) + '" data-result="' + r + '" aria-pressed="' + (sel === c.id) + '" aria-label="Ader ' + esc(c.pin) + ' (' + esc(c.color) + ') von ' + esc(p.label) + (c.role ? ', ' + esc(c.role) : '') + ', ' + TXT[r] + '">'
        + '<i class="sw25-chip" style="background:' + esc(c.hex) + '" aria-hidden="true"></i> ' + esc(c.pin) + ' <small>' + esc(c.color) + (c.role ? ' · ' + esc(c.role) : '') + '</small> <b class="sw25-sym">' + SYM[r] + '</b>' + (w ? ' <small>→ ' + esc(w.b) + '</small>' : '') + '</button></li>'; }).join('') + '</ul></section>').join('');
    const groups = {};
    nl.terminals.forEach(t => { (groups[t.group] = groups[t.group] || []).push(t); });
    const terms = Object.keys(groups).map(g => '<section class="sw25-strip" data-group="' + esc(g) + '"><h4>' + esc(g.replace(':', ' ')) + '</h4><div class="sw25-row">' + groups[g].map(t => {
      const lit = st && st.leds && st.leds[t.id], target = helpPair && (helpPair.terminal === t.id || helpPair.to === t.id || helpPair.from === t.id);
      return '<button type="button" class="sw25-term rel-' + t.relevance + (target ? ' pulse' : '') + '" data-terminal="' + esc(t.id) + '" data-lit="' + (lit ? 1 : 0) + '" aria-label="Klemme ' + esc(t.id) + (t.address ? ', Adresse ' + esc(t.address) : '') + (lit ? ', Signal aktiv' : '') + '">' + esc(t.label) + (t.address ? ' <small>' + esc(t.address) + '</small>' : '') + (t.led ? ' <b class="sw25-led" aria-hidden="true">' + (lit ? '●' : '○') + '</b>' : '') + '</button>'; }).join('') + '</div></section>').join('');
    body.innerHTML = '<div class="sw25-parts">' + parts + '</div><div class="sw25-terms">' + terms + '</div>';
    body.querySelectorAll('.sw25-core').forEach(b => { if(helpPair && helpPair.core === b.dataset.core) b.classList.add('pulse'); });
  }
  function drop(core, term){
    if(!core || !term) return;
    emit('wireDrop', core, term); sel = null; say('Ader ' + core + ' auf ' + term + ' gelegt.'); render();
  }
  body.addEventListener('click', e => {
    const c = e.target.closest('[data-core]'), t = e.target.closest('[data-terminal]');
    if(c){ sel = sel === c.dataset.core ? null : c.dataset.core; if(sel) emit('wireStart', sel); say(sel ? 'Ader gewählt – jetzt eine Klemmstelle antippen.' : ''); render(); return; }
    if(t){ if(sel) drop(sel, t.dataset.terminal); else emit('meterProbe', t.dataset.terminal, 1); }
  });
  body.addEventListener('keydown', e => { if((e.key === 'Delete' || e.key === 'Backspace') && e.target.closest('[data-core]')){ const c = e.target.closest('[data-core]').dataset.core; e.preventDefault(); emit('wireRemove', c); say('Ader gelöst.'); } if(e.key === 'Escape'){ sel = null; render(); } });
  // Ziehen (HTML5 Drag & Drop): Ader auf Klemme; zulässige Ziele leuchten (Klasse allowed), Rest gedimmt
  body.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-core]'); if(!c) return; sel = c.dataset.core; e.dataTransfer.setData('text/plain', 'core:' + sel); e.dataTransfer.effectAllowed = 'move'; emit('wireStart', sel);
    const ok = new Set((nl.allowed[sel] || [])); body.querySelectorAll('[data-terminal]').forEach(b => b.classList.toggle('allowed', ok.has(b.dataset.terminal))); });
  body.addEventListener('dragend', () => { body.querySelectorAll('.allowed').forEach(b => b.classList.remove('allowed')); });
  body.addEventListener('dragover', e => { if(e.target.closest && e.target.closest('[data-terminal]')){ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
  body.addEventListener('drop', e => { const t = e.target.closest && e.target.closest('[data-terminal]'); if(!t) return; e.preventDefault(); const d = (e.dataTransfer.getData('text/plain') || '').replace(/^core:/, ''); drop(d || sel, t.dataset.terminal); });

  render();
  const api = {
    update(s){ st = s; if(s && s.help === undefined) helpPair = helpPair; render(); },
    help(coreId){ const h = st && st.help; helpPair = coreId ? { core: coreId, terminal: (nl.targets.find(p => p.a === coreId || p.b === coreId) || {}).b } : h; if(helpPair){ emit('helpShow', helpPair.core, helpPair.terminal); say(h && h.text ? h.text : 'Zielklemme markiert.'); } render(); },
    on(ev, fn){ (handlers[ev] = handlers[ev] || []).push(fn); return api; },
    off(ev, fn){ handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); return api; },
    select(core){ sel = core; render(); },
    get selected(){ return sel; },
    destroy(){ container.innerHTML = ''; container.classList.remove('sw25-stub'); Object.keys(handlers).forEach(k => delete handlers[k]); }
  };
  return api;
}
root.SensorWiring25D = { mount, stub: true };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorWiring25D;
})(typeof window !== 'undefined' ? window : globalThis);
