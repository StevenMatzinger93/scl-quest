(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Anlage in 3D (nur Ansicht): HÜLLE UM SensorScene (Paket W3). Fable verbessert Optik, Etiketten und Kamera (Paket W5),
   die Schnittstelle bleibt. Vertrag: docs/SENSOR_VISUAL_VERTRAG.md.

   const plant = SensorPlant3D.mount(container, { preset:'sortierstrecke', quality:'mittel', reducedMotion:false, onPick(id) });
   plant.setChannels(state)      Zustand der Anlage = SensorScene.setState-Felder (SensorVisual.PLANT_FIELDS); nicht genannte Felder behalten ihren Wert
   plant.scenePreset(name)       'sortierstrecke' | 'tank': Kameraansicht und sichtbare Anlagenteile
   plant.focus(id)               Kamerafahrt zum Bauteil (BMK, z. B. 'B1', 'X2', 'TANK'); Voreinstellungen: 'uebersicht', 'sensor', 'band', 'tank'
   plant.highlight(ids)          Bauteile hervorheben (Kontur/Puls); [] hebt auf
   plant.setView('small'|'large')klein (immer sichtbar, ca. 320×200) / gross (Phase Laufen lassen)
   plant.setQuality(q) · plant.scene (die SensorScene) · plant.destroy()
   ============================================================ */
const SCENES = { sortierstrecke: { view: 2, label: 'Sortierstrecke' }, tank: { view: 4, label: 'Tankstation' } };
const PRESET_FOCUS = { uebersicht: { view: 1 }, sensor: { view: 2 }, band: { view: 2 }, tank: { view: 4 } };
function mount(container, opt){
  opt = opt || {};
  if(!root.SensorScene || !root.SensorScene.isAvailable()) throw new Error('SensorScene (three.js) fehlt');
  const scene = root.SensorScene.mount(container, { quality: opt.quality || 'mittel', reduceMotion: opt.reducedMotion, onPick: opt.onPick, onHover: opt.onHover });
  let preset = null, hl = [], size = 'large';
  const api = {
    setChannels(s){ scene.setState(s || {}); return api; },
    scenePreset(name){ const p = SCENES[name]; if(!p) throw new Error('Unbekanntes Preset ' + name); preset = name; scene.setView(p.view); container.dataset.preset = name; return api; },
    focus(id){ if(PRESET_FOCUS[id]) scene.setView(PRESET_FOCUS[id].view); else scene.focusOn(id); return api; },
    highlight(ids){ hl = (ids || []).slice(); container.dataset.highlight = hl.join(' '); return api; },   // Stub: nur gemerkt (Fable: Kontur/Puls)
    setView(mode){ size = mode === 'small' ? 'small' : 'large'; container.classList.toggle('plant-small', size === 'small'); container.classList.toggle('plant-large', size === 'large'); container.dataset.size = size; return api; },
    setQuality(q){ scene.setQuality(q); return api; },
    get preset(){ return preset; }, get highlighted(){ return hl.slice(); }, get size(){ return size; }, scene,
    destroy(){ scene.destroy(); }
  };
  api.setView(opt.size || 'large'); api.scenePreset(opt.preset || 'sortierstrecke');
  return api;
}
root.SensorPlant3D = { mount, SCENES, stub: true };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorPlant3D;
})(typeof window !== 'undefined' ? window : globalThis);
