(function(root){
"use strict";
/* ============================================================
   SENSORWERKSTATT — Kernschleife als Zustandsautomat (docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md Abschnitt 3, Paket W2)
   Vier Phasen: ① Verbinden → ② Signale → ③ Programm → ④ Laufen lassen. Rein rechnend (kein DOM), Node-testbar.
   Jede Aufgabe hat einen Schwerpunkt (task.phase); die anderen Phasen sind vorbefüllt (Referenz im Startzustand angewendet) oder leer
   und werden mit „Übernehmen“ bestätigt. „Prüfen“ (Testfälle, Punkte) ist davon getrennt: SensorTasks.checkTask.

   const flow = SensorFlow.create(task);            // optional: SensorFlow.create(task, snapshot)
   flow.status(ctx)  → [{ key, label, kind:'leer'|'vorbefuellt'|'arbeit', focus, ok, accepted, state, steps:[idx], issues:[…] }]
        state: 'leer' (keine Schritte, zählt als erledigt) · 'gesperrt' (Laufen lassen, solange ①–③ nicht erledigt) ·
               'offen' (Schritte noch nicht erfüllt) · 'bereit' (erfüllt, noch nicht bestätigt: Knopf „Übernehmen“ bzw. „Weiter“) · 'erledigt'
   flow.accept(ctx, key) → { ok, reason }           bestätigt eine erfüllte Phase, springt zur nächsten offenen
   flow.goto(ctx, key)   → { ok, reason }           zurück immer, vorwärts nur wenn alle Phasen davor erledigt/leer sind
   flow.canRun(ctx)      → bool                     ①–③ erledigt oder leer: „▶ Laufen lassen“ ist freigeschaltet
   flow.done(ctx)        → bool                     alle vier Phasen erledigt (Aufgabe fertig; abgenommen wird weiter mit „Prüfen“)
   flow.markRun(ctx)     Probebetrieb gestartet: Laufen lassen gilt als erledigt, sobald seine Schritte erfüllt sind
   flow.current          → aktive Phase             flow.snapshot() → { current, accepted:[…] } zum Speichern im Entwurf
   ============================================================ */
const T = () => root.SensorTasks;
const LABEL = { verbinden: 'Verbinden', signale: 'Signale', programm: 'Programm', laufen: 'Laufen lassen' };

function create(t, snap){
  const Tk = T(), PH = Tk.PHASES;
  const focus = Tk.focusOf(t) || PH.slice();
  const pre = Tk.prefillOf(t);
  const accepted = new Set(snap && snap.accepted || []);
  let ran = !!(snap && snap.ran);   // „▶ Laufen lassen“ wurde mindestens einmal benutzt (Probebetrieb)
  const steps = {}; PH.forEach(p => { steps[p] = Tk.stepsOfPhase(t, p); });
  const kind = p => !steps[p].length ? 'leer' : pre.includes(p) ? 'vorbefuellt' : 'arbeit';
  let current = snap && PH.includes(snap.current) ? snap.current : firstPhase();
  function firstPhase(){ return PH.find(p => steps[p].length && focus.includes(p)) || PH.find(p => steps[p].length) || 'laufen'; }

  function status(ctx){
    const out = [];
    PH.forEach((p, n) => {
      const k = kind(p), issues = [];
      steps[p].forEach(i => { const r = Tk.checkStep(t.steps[i], ctx, i); r.issues.forEach(x => issues.push(x)); });
      const ok = !issues.length;
      const before = out.slice(0, 3).every(x => x.state === 'erledigt' || x.state === 'leer');
      let state;
      if(k === 'leer') state = 'leer';
      else if(p === 'laufen') state = !before ? 'gesperrt' : !ok ? 'offen' : ran ? 'erledigt' : 'bereit';   // bereit = „▶ Laufen lassen“ drücken
      else state = !ok ? 'offen' : accepted.has(p) ? 'erledigt' : 'bereit';
      out.push({ key: p, label: LABEL[p], kind: k, focus: focus.includes(p), ok, accepted: accepted.has(p), state, steps: steps[p].slice(), issues });
    });
    return out;
  }
  const byKey = (ctx, key) => status(ctx).find(x => x.key === key);
  function nextOpen(ctx){ const s = status(ctx); const x = s.find(y => y.state === 'offen' || y.state === 'bereit') || s.find(y => y.state === 'gesperrt'); return x ? x.key : 'laufen'; }
  function canRun(ctx){ return status(ctx).slice(0, 3).every(x => x.state === 'erledigt' || x.state === 'leer'); }
  function accept(ctx, key){
    const x = byKey(ctx, key);
    if(!x) return { ok: false, reason: 'Unbekannte Phase.' };
    if(x.state === 'leer' || x.state === 'erledigt') return { ok: true };
    if(key === 'laufen') return { ok: false, reason: 'Laufen lassen wird nicht bestätigt: die Anlage muss den Betrieb zeigen.' };
    if(!x.ok) return { ok: false, reason: x.issues[0] || 'Diese Phase ist noch nicht erfüllt.' };
    accepted.add(key); current = nextOpen(ctx);
    return { ok: true };
  }
  function goto(ctx, key){
    const s = status(ctx), i = s.findIndex(x => x.key === key);
    if(i < 0) return { ok: false, reason: 'Unbekannte Phase.' };
    if(s.slice(0, i).some(x => x.state !== 'erledigt' && x.state !== 'leer')) return { ok: false, reason: 'Erst die Phasen davor abschliessen.' };
    current = key; return { ok: true };
  }
  return {
    status, accept, goto, canRun,
    done: ctx => status(ctx).every(x => x.state === 'erledigt' || x.state === 'leer'),
    get current(){ return current; },
    kinds: () => PH.map(p => ({ key: p, label: LABEL[p], kind: kind(p), focus: focus.includes(p), steps: steps[p].slice() })),
    markRun(ctx){ ran = true; if(ctx) current = nextOpen(ctx); },
    get ran(){ return ran; },
    snapshot: () => ({ current, accepted: [...accepted], ran })
  };
}
root.SensorFlow = { create, LABEL };
if(typeof module !== 'undefined' && module.exports) module.exports = root.SensorFlow;
})(typeof window !== 'undefined' ? window : globalThis);
