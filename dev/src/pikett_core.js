(function(root){
"use strict";
/* ============================================================
   PIKETTDIENST — Kern (docs/PLAN_ZERTIFIKAT_PIKETT.md Teil B, docs/PIKETT_KONZEPT.md; Paket B3)
   Rein rechnend: im Spiel, im Validator und später im Worker (Nachprüfung der Nachtschicht).
   - Ursachenliste, Nummernkreise, Ausfallkosten je Anlage
   - defIncident({ id, quest, chapter, kind:'program'|'hardware'|'operator', base, bug, force, param, alarm:{no, prio, text}, cause, part, hints, sceneFx })
   - fromBugs(): jedes Störungsszenario (C.bugs) wird eine Programm-Störung (Ursache aus der Änderung abgeleitet)
   - evaluate(): Spielaufgabe mit Code prüfen, optional mit force (Eingang hängt fest bzw. Parameter falsch)
   ============================================================ */
const CAUSES = [
  { id: 'prog_logic', group: 'program', name: 'Logik/Verknüpfung' }, { id: 'prog_compare', group: 'program', name: 'Vergleich/Grenzwert' },
  { id: 'prog_timer', group: 'program', name: 'Zeit/Timer' }, { id: 'prog_edge', group: 'program', name: 'Flanke/Zählen' },
  { id: 'prog_address', group: 'program', name: 'Adressierung/Index/Datenbaustein' }, { id: 'prog_order', group: 'program', name: 'Reihenfolge/Zyklus' },
  { id: 'hw_sensor', group: 'hardware', name: 'Sensor defekt/verschmutzt' }, { id: 'hw_wire', group: 'hardware', name: 'Drahtbruch' },
  { id: 'hw_actuator', group: 'hardware', name: 'Aktor defekt (Rückmeldung bleibt aus)' }, { id: 'hw_estop', group: 'hardware', name: 'Not-Halt/Sicherheitskreis ausgelöst' },
  { id: 'op_mode', group: 'operator', name: 'Falsche Betriebsart/Parameter am HMI' }
];
const CAUSE = Object.fromEntries(CAUSES.map(c => [c.id, c]));
const PLANT = {
  scl: { name: 'Roboterzelle RZ-03', base: 1000, cost: 38 }, kop: { name: 'Seilbahn Gratbahn', base: 2000, cost: 55 },
  fup: { name: 'Stellwerk Brünigkreuz', base: 3000, cost: 70 }, awl: { name: 'Walzwerk Keller 2', base: 4000, cost: 90 },
  sensor: { name: 'Prüfstand Sensorwerkstatt', base: 5000, cost: 20 }
};
const RANGE = { program: [1, 499], hardware: [501, 799], operator: [801, 899] };
const SHIFTS = {
  tag: { name: 'Tagschicht', minutes: 10, incidents: [2, 2], hints: 2, parallel: 1, hwShare: 0.3, rank: 1 },
  spaet: { name: 'Spätschicht', minutes: 15, incidents: [3, 4], hints: 1, parallel: 1, hwShare: 0.35, rank: 2 },
  nacht: { name: 'Nachtschicht', minutes: 20, incidents: [4, 6], hints: 0, parallel: 2, hwShare: 0.45, rank: 3 }
};
const RANKS = [{ n: 1, name: 'Lehrling', min: 0 }, { n: 2, name: 'Monteur', min: 5000 }, { n: 3, name: 'Servicetechniker', min: 15000 }, { n: 4, name: 'Pikettchef', min: 40000, nights: 3 }];

const LIST = [];
function defIncident(o){ LIST.push(Object.assign({ hints: [], sceneFx: null }, o)); return o; }

/* ---------- Ursache aus der Änderung eines Störungsszenarios ableiten ---------- */
function deriveCause(pairs){
  const diff = pairs.map(([a, b]) => changed(a, b)).join(' ');
  // vertauschte Zeilen: gleiche Zeilen in anderer Reihenfolge
  if(pairs.some(([a, b]) => { const la = a.split('\n').map(x => x.trim()).filter(Boolean), lb = b.split('\n').map(x => x.trim()).filter(Boolean); return la.length > 1 && la.length === lb.length && la.join('|') !== lb.join('|') && la.slice().sort().join('|') === lb.slice().sort().join('|'); })) return 'prog_order';
  if(/T#|S5T#|\bPT\b|\bTON\b|\bTOF\b|\bTP\b|\bSE\b|\bSA\b|\bSI\b|\bSV\b|\bET\b/i.test(diff)) return 'prog_timer';
  if(/R_TRIG|F_TRIG|\bCTU\b|\bCTD\b|\bCTUD\b|\bPV\b|\bCV\b|\bP\(|\bN\(|\bFP\b|\bFN\b|\bZV\b|\bZR\b|Trigger|Flanke|_Alt\b|\bINC\(|\bDEC\(/i.test(diff)) return 'prog_edge';
  if(/\[|\]|\.DB|"DB_|\.%X|\bFOR\b|\bTO\b|\bBY\b|\bINDEX|\bIdx\b/.test(diff)) return 'prog_address';
  if(/<=|>=|<>|[<>]|==|\bCMP\b|[<>=]=?[IRD]\b|\bLIMIT\b|\bMIN\b|\bMAX\b/.test(diff)) return 'prog_compare';
  if(/\b\d+(\.\d+)?\b/.test(diff) && pairs.every(([a, b]) => a.replace(/-?\d+(\.\d+)?/g, '#') === b.replace(/-?\d+(\.\d+)?/g, '#'))) return 'prog_compare';   // nur ein Zahlenwert (Grenz-/Sollwert) geändert
  return 'prog_logic';
}
// Unterschied zweier Texte (gemeinsamen Anfang und Ende abschneiden)
function changed(a, b){
  let i = 0; while(i < a.length && i < b.length && a[i] === b[i]) i++;
  let j = 0; while(j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const ctx = 12, s = Math.max(0, i - ctx);
  return a.slice(s, a.length - j + ctx) + ' ⇄ ' + b.slice(s, b.length - j + ctx);
}
// nur Zahlenwerte geändert: Grenzwert oder Logik – beides gilt als richtige Kategorie
function altCause(pairs){ const num = x => x.replace(/-?\d+(\.\d+)?/g, '#'); return pairs.every(([a, b]) => num(a) === num(b)) ? ['prog_compare', 'prog_logic'] : []; }
function causeOk(inc, cause){ return cause === inc.cause || (inc.causeAlt || []).includes(cause); }
function bugPairs(b){ if(Array.isArray(b.bug)) return b.bug; return Object.keys(b.bug || {}).reduce((a, k) => a.concat(b.bug[k]), []); }

/* ---------- Programm-Störungen aus den Störungsszenarien ---------- */
function fromBugs(C, quest){
  const P = PLANT[quest] || PLANT.scl, TBY = Object.fromEntries(C.tasks.map(t => [t.id, t]));
  return (C.bugs || []).filter(b => !b.workshop).map((b, i) => {
    const t = TBY[b.task], over = b.pikett || {};
    return { id: 'pk_' + b.id, quest, chapter: t ? t.level : 0, kind: 'program', base: b.task, bug: b.id,
      alarm: { no: String(P.base + RANGE.program[0] + i), prio: over.prio || (t && t.pro ? 2 : 2), text: over.text || b.title },
      symptom: b.symptom, cause: over.cause || b.cause || deriveCause(bugPairs(b)), causeAlt: over.causeAlt || altCause(bugPairs(b)),
      hints: over.hints || [b.symptom, t ? (t.hint || 'Vergleiche das Programm mit der Aufgabenstellung.') : ''].filter(Boolean), sceneFx: over.sceneFx || null, auto: true };
  });
}
// alle Störungen einer Quest: Programm (aus Szenarien) + Hardware/Bedienung (defIncident)
function incidents(C, quest){ return fromBugs(C, quest).concat(LIST.filter(x => x.quest === quest)); }

/* ---------- Prüfen ---------- */
// eng: { E, PRO, ProTask } der Quest; code: String (Grundstufe) oder { Baustein: Quelltext } (Profi)
// opts.force: { Variable: Wert } – bei Profi nur in den Programmtests (Bausteintests arbeiten mit Schnittstellen)
function evaluate(t, code, eng, opts){
  opts = opts || {};
  try {
    if(t.pro){
      const prog = eng.PRO.compileProject(eng.ProTask.project(t, code));
      const spec = opts.force ? { tests: t.tests, timed: t.timed } : { unit: t.unit, tests: t.tests, timed: t.timed };
      const r = eng.PRO.runAll(prog, spec, opts.force ? { force: opts.force } : undefined);
      return { ok: r.ok, res: r, prog };
    }
    const prog = eng.E.compileSCL(code, t);
    const r = t.timedTestCases ? eng.E.runTimedTests(prog, t.initialVars, t.timedTestCases, opts.force ? { force: opts.force } : undefined)
      : eng.E.runSinglePassTests(prog, t.initialVars, t.testCases, opts.force ? { force: opts.force } : undefined);
    return { ok: r.ok, res: r, prog };
  } catch(e){ return { ok: false, error: e }; }
}
// Eingänge einer Aufgabe (Variablen, die Tests setzen): Kandidaten für Hardware-Störungen
function inputsOf(t){
  const s = new Set();
  const add = o => Object.keys(o || {}).forEach(k => s.add(k));
  if(t.pro){ (t.tests || []).forEach(c => add(c.setup)); (t.timed || []).forEach(c => { add(c.setup); c.steps.forEach(x => add(x.inputs)); }); }
  else { (t.testCases || []).forEach(c => add(c.setup)); (t.timedTestCases || []).forEach(c => { add(c.setup); c.steps.forEach(x => add(x.inputs)); }); }
  return [...s];
}
function refCode(t, ProTask){ return t.pro ? ProTask.refCodes(t) : t.refSolution; }
// Fehlerversion eines Programmfehlers (wie Störungsjagd)
function bugCodeOf(inc, C, bugCode){ const b = (C.bugs || []).find(x => x.id === inc.bug), t = C.tasks.find(x => x.id === inc.base); return bugCode(t, b); }

/* ---------- Punkte, Kennzahlen, Rang (Plan B.3/B.5) ---------- */
function incidentPoints(r){
  if(!r.fixed) return 0;
  let p = 1000 - 8 * Math.round(r.downtime || 0) - 100 * (r.fails || 0) - 150 * (r.hints || 0);
  p = Math.max(150, p);
  if(r.causeOk) p += 200;
  if(r.partOk) p += 200;
  return p;
}
function shiftSummary(shift, results){
  const dur = SHIFTS[shift].minutes * 60;
  const down = Math.min(dur, unionLength(results.map(r => [r.at, r.fixed ? r.fixedAt : dur])));
  const avail = 1 - down / dur, fixed = results.filter(r => r.fixed);
  const mttr = fixed.length ? fixed.reduce((a, r) => a + (r.fixedAt - r.at), 0) / fixed.length : null;
  let points = results.reduce((a, r) => a + incidentPoints(r), 0);
  if(avail >= 0.95) points += 500;
  return { downtime: Math.round(down), availability: Math.round(avail * 1000) / 1000, mttr: mttr == null ? null : Math.round(mttr), points };
}
function unionLength(iv){ const a = iv.filter(x => x[1] > x[0]).sort((x, y) => x[0] - y[0]); let tot = 0, cs = null, ce = null; a.forEach(([s, e]) => { if(cs == null || s > ce){ if(cs != null) tot += ce - cs; cs = s; ce = e; } else ce = Math.max(ce, e); }); if(cs != null) tot += ce - cs; return tot; }
function rankOf(points, goodNights){
  let r = RANKS[0];
  RANKS.forEach(x => { if(points >= x.min && (!x.nights || (goodNights || 0) >= x.nights)) r = x; });
  return r;
}

/* ---------- Schichtplan (Seed) ---------- */
function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// pool: freigegebene Störungen; Rückgabe: [{ id, at (s ab Schichtbeginn) }]
function plan(pool, shift, seed){
  const S = SHIFTS[shift], r = rng(seed || 1), n = S.incidents[0] + Math.floor(r() * (S.incidents[1] - S.incidents[0] + 1));
  const hw = pool.filter(x => x.kind !== 'program'), pg = pool.filter(x => x.kind === 'program');
  const pickFrom = (arr, used) => { const free = arr.filter(x => !used.has(x.id)); return free.length ? free[Math.floor(r() * free.length)] : null; };
  const used = new Set(), out = [];
  const dur = S.minutes * 60, gap = Math.max(60, Math.floor((dur - 120) / Math.max(1, n)));
  for(let i = 0; i < n; i++){
    const wantHw = r() < S.hwShare;
    const x = pickFrom(wantHw ? hw : pg, used) || pickFrom(wantHw ? pg : hw, used);
    if(!x) break;
    used.add(x.id);
    out.push({ id: x.id, at: Math.round((i === 0 ? 45 + r() * 45 : out[i - 1].at + gap * (S.parallel > 1 ? 0.6 : 1) + r() * 30)) });
  }
  return out.filter(x => x.at < dur - 60);
}

root.SPSQPikett = { causeOk, CAUSES, CAUSE, PLANT, RANGE, SHIFTS, RANKS, LIST, defIncident, deriveCause, fromBugs, incidents, evaluate, inputsOf, refCode, bugCodeOf, incidentPoints, shiftSummary, rankOf, plan, rng };
root.defIncident = defIncident;
if(typeof module !== 'undefined' && module.exports) module.exports = root.SPSQPikett;
})(typeof window !== 'undefined' ? window : globalThis);
