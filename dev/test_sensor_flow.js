// Sensorwerkstatt: Format v2 und Kernschleife (Phasen-Zustandsautomat) – node test_sensor_flow.js
const fs = require('fs'), path = require('path');
global.window = global;
require('./src/engine.js'); require('./src/engine_pro.js'); require('./src/kop.js');
require('./src/sensor_model.js'); require('./src/wiring.js'); require('./src/sensor_plc.js'); require('./src/content/_helpers.js');
const T = require('./src/sensor_tasks.js'), F = require('./src/sensor_flow.js');
const dir = path.join(__dirname, 'src/content_sensor');
['_sensor.js', 'chapters.js'].forEach(f => require(path.join(dir, f)));
fs.readdirSync(dir).filter(f => /^m\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
require(path.join(dir, 'plan.js'));
const C = global.SCL_CONTENT, task = id => C.tasks.find(t => t.id === id);
let oks = 0, fails = 0;
const ok = (c, m) => { if(c) oks++; else { fails++; console.log('✗ ' + m); } };
const states = (t, ctx, flow) => (flow || F.create(t)).status(ctx).map(x => x.key + ':' + x.state).join(' ');

// Plan: 30 angezeigt, 30 versteckt, IDs bleiben auflösbar
const ws = C.tasks.filter(t => t.workshop);
ok(ws.length === 60 && ws.filter(t => !t.hidden).length === 30 && ws.filter(t => t.hidden).length === 30, '60 Aufgaben: 30 angezeigt, 30 hidden (nichts gelöscht)');
ok(ws.filter(t => !t.hidden).every(t => t.core && t.dispNo >= 1 && t.dispNo <= 5), 'angezeigte Aufgaben: core, Nummer 1–5 je Modul');
ok(ws.filter(t => t.hidden).every(t => !t.core && !t.dispNo && t.id && t.steps.length), 'versteckte Aufgaben: nicht core, aber vollständig vorhanden');
ok([1, 2, 3, 4, 5, 6].every(m => ws.filter(t => !t.hidden && t.level === m).length === 5), '5 angezeigte Aufgaben je Modul');

// Phasen-Zuordnung der Schritte
const t1 = task('w1_start_stopp'), t4 = task('w4_b11_2leiter'), tb = task('w1_boss_sortierstrecke');
ok(T.focusOf(t1).join() === 'verbinden' && T.focusOf(t4).join() === 'verbinden,signale' && T.focusOf(tb).length === 4, 'Schwerpunkt: einzeln, Liste, „alle“');
ok(T.phaseOfStep(t1, { kind: 'wire' }) === 'verbinden' && T.phaseOfStep(t1, { kind: 'tags' }) === 'signale' && T.phaseOfStep(t1, { kind: 'program' }) === 'programm'
  && T.phaseOfStep(t1, { kind: 'load' }) === 'laufen' && T.phaseOfStep(t1, { kind: 'power' }) === 'laufen' && T.phaseOfStep(t1, { kind: 'observe' }) === 'laufen' && T.phaseOfStep(t1, { kind: 'quiz' }) === 'verbinden', 'Schrittarten → Phasen (Frage gehört zum Schwerpunkt)');
ok(T.phaseOfStep(task('w3_b3_teach'), { kind: 'mount' }) === 'laufen' && T.phaseOfStep(t1, { kind: 'mount' }) === 'verbinden', 'Montage/Regler: bei Schwerpunkt „Laufen“ in der Anlage, sonst beim Verbinden');

// Einfache Aufgabe (Schwerpunkt Verbinden): Start offen, Laufen gesperrt; nach der Referenz alles erledigt
{
  const ctx = T.newContext(t1), fl = F.create(t1);
  ok(states(t1, ctx, fl) === 'verbinden:offen signale:leer programm:leer laufen:gesperrt', 'w1_start_stopp Start: ' + states(t1, ctx, fl));
  ok(fl.current === 'verbinden' && !fl.canRun(ctx) && !fl.done(ctx), 'Start: aktive Phase Verbinden, Laufen nicht freigeschaltet');
  ok(fl.accept(ctx, 'verbinden').ok === false && /./.test(fl.accept(ctx, 'verbinden').reason), 'unerfüllte Phase lässt sich nicht bestätigen');
  ok(fl.goto(ctx, 'laufen').ok === false, 'nicht vorwärts springen, solange der Schwerpunkt offen ist');
  T.stepsOfPhase(t1, 'verbinden').forEach(i => T.applyStepRef(t1, t1.steps[i], i, ctx));
  ok(fl.status(ctx)[0].state === 'bereit', 'Verbinden erfüllt → „bereit“ (Knopf Weiter/Übernehmen)');
  ok(fl.accept(ctx, 'verbinden').ok && fl.status(ctx)[0].state === 'erledigt' && fl.canRun(ctx), 'bestätigt → erledigt, Laufen lassen freigeschaltet');
  ok(states(t1, ctx, fl) === 'verbinden:erledigt signale:leer programm:leer laufen:offen', 'Laufen: offen bis Einschalten/Beobachten erfüllt: ' + states(t1, ctx, fl));
  T.stepsOfPhase(t1, 'laufen').forEach(i => T.applyStepRef(t1, t1.steps[i], i, ctx));
  ok(fl.done(ctx) && T.checkTask(t1, ctx).ok, 'Laufen lassen erfüllt → Aufgabe erledigt und „Prüfen“ besteht');
  // Rückfall: Ader entfernt → Phase wieder offen, Bestätigung gilt nicht mehr
  const w = ctx.state.wires.find(x => /X2:1\.S/.test(x.from + x.to)); if(w) T.applyWireOps(ctx.state, { remove: [[w.from, w.to]] });
  ok(fl.status(ctx)[0].state === 'offen' && !fl.done(ctx), 'Ader gezogen → Verbinden wieder offen, Aufgabe nicht mehr erledigt');
  const snap = JSON.parse(JSON.stringify(fl.snapshot())), fl2 = F.create(t1, snap);
  ok(fl2.status(ctx)[0].accepted && fl2.current === fl.current, 'Snapshot speichern/laden (Entwurf)');
}
// Vorbefüllung: w4_loopcheck (Schwerpunkt Laufen, Adern vorgegeben)
{
  const t = task('w4_loopcheck'), ctx = T.newContext(t), fl = F.create(t);
  ok(T.prefillOf(t).join() === 'verbinden', 'loopcheck: Verbinden ist vorbefüllt');
  ok(fl.kinds().find(k => k.key === 'verbinden').kind === 'vorbefuellt', 'Art der Phase: vorbefüllt');
  ok(fl.status(ctx)[0].state === 'bereit', 'vorbefüllte Phase im Start „bereit“ (Übernehmen)');
  const wi = t.steps.findIndex(x => x.kind === 'wire');
  ok(!T.checkStep(t.steps[wi], T.newContext(t, { noPrefill: true }), wi).ok && T.checkStep(t.steps[wi], ctx, wi).ok, 'Verdrahtung: ohne Vorbefüllung nicht erfüllt, mit Vorbefüllung erfüllt');
  ok(fl.accept(ctx, 'verbinden').ok && fl.canRun(ctx), 'Übernehmen → Laufen lassen freigeschaltet');
  ok(!T.checkTask(t, ctx).ok, 'Prüfen scheitert im Start weiterhin (Schwerpunkt fehlt)');
}
// Boss (alle Phasen), Programm-Aufgabe
{
  const t = tb, ctx = T.newContext(t), fl = F.create(t);
  const kinds = fl.kinds().map(k => k.key + ':' + k.kind).join(' ');
  ok(kinds === 'verbinden:arbeit signale:arbeit programm:arbeit laufen:arbeit', 'Boss: alle Phasen sind Arbeit: ' + kinds);
  const order = []; ['verbinden', 'signale', 'programm', 'laufen'].forEach(ph => { T.stepsOfPhase(t, ph).forEach(i => T.applyStepRef(t, t.steps[i], i, ctx, 'fup')); if(ph !== 'laufen') order.push(fl.accept(ctx, ph).ok); });
  ok(order.every(Boolean) && fl.done(ctx), 'Boss in FUP durchgespielt: alle Phasen erledigt');
  const p = task('w1_band_selbsthaltung'), c2 = T.newContext(p), f2 = F.create(p);
  ok(f2.current === 'programm' && states(p, c2, f2) === 'verbinden:leer signale:leer programm:offen laufen:gesperrt', 'Programm-Aufgabe: Start bei ③ Programm: ' + states(p, c2, f2));
  ok(f2.accept(c2, 'laufen').ok === false, 'Laufen lassen wird nie „bestätigt“, es muss laufen');
}
// Werkzeuge: nur multimeter/kalibrator, nur in Aufgaben mit Messschritt
ok(C.tasks.filter(t => t.workshop && !t.hidden).every(t => (t.tools || []).every(x => T.TOOLS_ALLOWED.includes(x))), 'tools nur aus multimeter/kalibrator');
ok(task('w4_loopcheck').tools.join() === 'kalibrator' && task('w2_pnp_messen').tools.join() === 'multimeter' && task('w1_b1_anschliessen').tools.length === 0, 'tools je Aufgabe wie im Plan');
console.log('Kernschleife/Format v2: ' + oks + ' bestanden, ' + fails + ' fehlgeschlagen');
process.exit(fails ? 1 : 0);
