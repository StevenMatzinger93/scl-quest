// Erzeugt je Quest die PLC-Variablentabelle (Feedback-Auftrag Paket 5.2): dev/src/<content>/tags.js
// Jede Variable aller Aufgaben bekommt eine feste Adresse (dieselbe in allen Aufgaben der Anlage), einen Datentyp und einen Kommentar.
// Richtung aus den Testfällen: nur gesetzt → Eingang (%I/%IW), nur geprüft → Ausgang (%Q/%QW), sonst Merker (%M/%MW/%MD).
// Zeichenketten, Felder und Strukturen liegen im Datenbaustein "Daten", Timer/Zähler sind IEC-Instanzen (DB).
// Vorhandene Kommentare und Adressen in tags.js bleiben erhalten (Handarbeit geht nicht verloren). Aufruf: node gen_tags.js [scl|kop|fup|awl]
const fs = require('fs'), vm = require('vm'), path = require('path');
const D = path.join(__dirname, 'src');
const REASSIGN = process.argv.includes('--neu'), REASSIGN_KEEP = false;   // --neu: Adressen neu vergeben (Kommentare bleiben)
const DIRS = { scl: 'content', kop: 'content_kop', fup: 'content_fup', awl: 'content_awl' };
function load(q){
  const g = { window: {}, console }; g.window = g; g.globalThis = g; vm.createContext(g);
  const run = f => vm.runInContext(fs.readFileSync(path.join(D, f), 'utf8'), g, { filename: f });
  ['engine.js', 'engine_pro.js', 'kop.js', 'awl.js'].forEach(run);
  const dir = DIRS[q];
  ['content/_helpers.js'].concat(q === 'kop' || q === 'fup' ? ['content_kop/_kop.js'] : q === 'awl' ? ['content_awl/_awl.js'] : []).forEach(run);
  fs.readdirSync(path.join(D, dir)).filter(f => /^ch\d+\.js$/.test(f)).sort().forEach(f => run(dir + '/' + f));
  return g;
}
const typeOf = (v, declared) => {
  if(declared) return declared;
  if(typeof v === 'boolean') return 'Bool';
  if(typeof v === 'string') return 'String';
  if(Array.isArray(v)) return 'Array';
  if(v && typeof v === 'object') return 'Struct';
  return Number.isInteger(v) ? 'Int' : 'Real';
};
const human = n => n.replace(/^S_/, 'Taster ').replace(/_/g, ' ').replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü').replace(/Ae/g, 'Ä').replace(/Oe/g, 'Ö').replace(/Ue/g, 'Ü').replace(/\bOK\b/g, 'OK');
function gen(q){
  const g = load(q), C = g.SCL_CONTENT, E = g.SCLEngine;
  const info = {};   // name → { v, type, set, exp }
  const note = (n, v, type) => { if(/^_/.test(n)) return; const x = info[n] = info[n] || { set: 0, exp: 0, n: 0 }; x.n++; if(x.v === undefined) x.v = v; if(type && !x.type) x.type = type; };
  const IN_CH = /^(sensor|part|trainApproach|track|kabine_da|person|wind)/i, bound = {};
  C.tasks.forEach(t => {
    (t.sceneBindings || []).forEach(b => { const v = b && b.variable && String(b.variable).split('.')[0].replace(/"/g, ''); if(v) bound[v] = IN_CH.test(b.channel || '') ? 'in' : 'out'; });
    if(t.pro){
      Object.keys(t.project.globals || {}).forEach(n => note(n, t.project.globals[n], t.project.types && t.project.types[n]));
      const cases = (t.tests || []).map(c => [c.setup, c.expect]).concat(...(t.timed || []).map(c => [[c.setup, {}]].concat(c.steps.map(s => [s.inputs, s.expect]))));
      cases.forEach(([s, e]) => { Object.keys(s || {}).forEach(k => info[k] && info[k].set++); Object.keys(e || {}).forEach(k => info[k] && info[k].exp++); });
    } else {
      let decl = null; try{ decl = E.buildSymbols(E.declOf(t)); }catch(e){}
      Object.keys(t.initialVars || {}).forEach(n => { const s = decl && decl[n.toLowerCase()]; note(n, t.initialVars[n], (t.varTypes || {})[n] || (s && s.type && s.type.name)); });
      Object.keys(t.fbTypes || {}).forEach(n => note(n, null, t.fbTypes[n]));
      const cases = (t.testCases || []).map(c => [c.setup, c.expect]).concat(...(t.timedTestCases || []).map(c => [[c.setup, {}]].concat(c.steps.map(s => [s.inputs, s.expect]))));
      cases.forEach(([s, e]) => { Object.keys(s || {}).forEach(k => info[k] && info[k].set++); Object.keys(e || {}).forEach(k => info[k] && info[k].exp++); });
    }
  });
  const file = path.join(D, DIRS[q], 'tags.js');
  let old = {};
  if(fs.existsSync(file)){ const g2 = {}; vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window: g2, globalThis: g2 }); old = g2.PLC_TAGS || {}; }
  const used = new Set(REASSIGN ? [] : Object.values(old).map(x => x.addr));
  let bi = 0, bq = 0, bm = 80, wi = 64, wq = 64, wm = 100, dm = 200;
  const next = f => { let a; do { a = f(); } while(used.has(a)); used.add(a); return a; };
  const bit = (p, i) => p + Math.floor(i / 8) + '.' + (i % 8);
  const out = {};
  Object.keys(info).sort((a, b) => a.localeCompare(b, 'de')).forEach(n => {
    const x = info[n], o = old[n] || {};
    let type = o.type || typeOf(x.v, x.type && String(x.type).replace(/^(\w)(\w*)$/, (m, a, b) => a.toUpperCase() + b.toLowerCase()).replace(/^Dint$/, 'DInt').replace(/^Lreal$/, 'LReal').replace(/^Udint$/, 'UDInt').replace(/^Uint$/, 'UInt').replace(/^Sint$/, 'SInt').replace(/^Usint$/, 'USInt').replace(/^Dword$/, 'DWord'));
    if(/^(ton|tof|tp|ctu|ctd|ctud|r_trig|f_trig)$/i.test(type)) type = type.toUpperCase();
    // Richtung: Namen von Tastern/Sensoren → Eingang; an die Anlage gebundene Aktoren → Ausgang; sonst aus den Testfällen
    // Kommentar (von Hand gepflegt) hat Vorrang: Taster/Schalter/Sensoren → Eingang, Lampen/Antriebe/Anzeigen → Ausgang
    const cm = String(o.comment || '');
    const byComment = /(Taster|Taste\b|Schalter|Endschalter|Lichtschranke|Sensor|Initiator|Näherung|Endlage|Rückmeldung|Wächter|Messwert|Istwert|Thermostat|Druckschalter|Schwimmer|Grenzwert erreicht|Öffner|Schliesser|Quittiertaste|Wahlschalter|Gleisfreimeldung|Freimeldung|belegt|meldet|erkannt|Karte gültig|Person|Zug nähert)/i.test(cm) ? 'in'
      : /(Lampe|Leuchte|Melder |Meldeleuchte|Hupe|Horn|Sirene|Motor|Antrieb|Ventil|Schütz|Pumpe|Heizung|Lüfter|Anzeige|Display|Ampel|Signalsäule|Signal (zeigt|auf)|Blinklicht|Glocke|Weiche (umstellen|stellen)|Greifer|Band (läuft|ein)|Sollwert|Stellbefehl|Freigabe an|ansteuern|einschalten| ein$)/i.test(cm) ? 'out' : null;
    const dir = byComment && /^(Bool|Int|UInt|Word|Real|DInt)$/.test(type) && !REASSIGN_KEEP ? byComment
      : /^(S_|Taste|Taster|Sensor|Schalter|Endlage|Melder_?Eingang|AI_)|(_Sensor|_Taste|_Endlage)$/i.test(n) ? 'in'
      : /^(Start|Stopp|Stop|Quitt|Quittierung|Reset|Hand|Auto|Automatik|Not_?Aus_OK|Not_?Halt_OK)$/i.test(n) ? 'in'
      : bound[n] === 'out' ? 'out' : bound[n] === 'in' ? 'in'
      : x.set && !x.exp ? 'in' : x.exp && !x.set ? 'out' : 'mem';
    let addr = REASSIGN ? null : o.addr;
    if(!addr){
      if(/^(TON|TOF|TP|CTU|CTD|CTUD|R_TRIG|F_TRIG)$/i.test(type) || /^FB_/.test(type)) addr = 'IEC-Instanz';
      else if(/String|Array|Struct|^"/.test(type)) addr = '"Daten".' + n;
      else if(type === 'Bool') addr = dir === 'in' ? next(() => bit('%I', bi++)) : dir === 'out' ? next(() => bit('%Q', bq++)) : next(() => bit('%M', bm++));
      else if(/^(Int|UInt|Word|SInt|USInt|Byte)$/.test(type)) addr = dir === 'in' ? next(() => '%IW' + ((wi += 2) - 2)) : dir === 'out' ? next(() => '%QW' + ((wq += 2) - 2)) : next(() => '%MW' + ((wm += 2) - 2));
      else addr = next(() => '%MD' + ((dm += 4) - 4));   // DInt, Real, Time, DWord …
    }
    out[n] = { addr, type, comment: o.comment || human(n) };
  });
  const body = '/* PLC-Variablen ' + q.toUpperCase() + ' Quest (Feedback-Auftrag Paket 5.2) – erzeugt mit node gen_tags.js ' + q + ', Kommentare von Hand gepflegt.\n'
    + '   Dieselbe Variable hat in allen Aufgaben dieselbe Adresse. Eingänge %I, Ausgänge %Q, Merker %M; Texte/Felder im DB "Daten"; Timer/Zähler als IEC-Instanz. */\n'
    + '(function(root){\nroot.PLC_TAGS = {\n' + Object.keys(out).map(n => '  ' + JSON.stringify(n) + ': { addr: ' + JSON.stringify(out[n].addr) + ', type: ' + JSON.stringify(out[n].type) + ', comment: ' + JSON.stringify(out[n].comment) + ' }').join(',\n') + '\n};\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
  fs.writeFileSync(file, body);
  console.log(q + ': ' + Object.keys(out).length + ' Variablen → ' + path.relative(__dirname, file));
}
(process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]] : Object.keys(DIRS)).forEach(gen);
