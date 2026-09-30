/* ===== SPS Quest Portal: Beamer-Musik (Feedback-Auftrag Paket 2.4) =====
   Übernommen aus docs/Hoerprobe_Musik.html (Industrie-Version): alles live mit WebAudio erzeugt, keine Dateien, keine Lizenzen.
   Nur am Beamer. API: window.SPSQ_MUSIC = { unlock(), play('lobby'|'challenge'|'victory'), urgent(bool), sfx('join'|'solved'|'count'|'timeup'),
   stop(), volume(v), mute(bool), get muted, get current }. Einstellungen (Lautstärke, Aus) je Browser in localStorage. */
(function(){
'use strict';
const AC = window.AudioContext || window.webkitAudioContext;
let ctx, master, bus, noiseBuf, timer = 0, cur = null, pending = [], name = null;
const KEY = 'spsq_beamer_music';
const pref = (() => { try{ return Object.assign({ vol: 0.7, muted: false }, JSON.parse(localStorage.getItem(KEY) || '{}')); }catch(e){ return { vol: 0.7, muted: false }; } })();
const savePref = () => { try{ localStorage.setItem(KEY, JSON.stringify(pref)); }catch(e){} };
function init(){
  if(!AC) return false;
  if(ctx){ if(ctx.state === 'suspended') ctx.resume(); return true; }
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = pref.muted ? 0 : pref.vol;
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  newBus(); return true;
}
function newBus(){ bus = ctx.createGain(); bus.connect(master); }
function killBus(){ if(!bus) return; const b = bus; b.gain.setTargetAtTime(0, ctx.currentTime, 0.04); setTimeout(() => b.disconnect(), 400); newBus(); }

/* ---------- Noten ---------- */
const N = name => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(name); const base = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, ((+m[3] + 1) * 12 + base - 69) / 12); };
const seq = s => s.trim().split(/\s+/).map(x => x === '.' ? null : x);

/* ---------- Instrumente ---------- */
function env(g, t, a, peak, d){ g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function osc(type, f, t, stop, out, detune){ const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if(detune) o.detune.value = detune; o.connect(out); o.start(t); o.stop(stop); return o; }
function noise(t, dur, out){ const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }

function marimba(f, t, v = 0.28){ const g = ctx.createGain(); g.connect(bus); env(g, t, 0.004, v, 0.42); osc('sine', f, t, t + 0.6, g); const g2 = ctx.createGain(); g2.connect(bus); env(g2, t, 0.002, v * 0.18, 0.08); osc('sine', f * 4, t, t + 0.15, g2); }
function pluck(f, t, v = 0.12, d = 0.18){ const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(3200, t); fl.frequency.exponentialRampToValueAtTime(700, t + d); const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.003, v, d); osc('square', f, t, t + d + 0.05, fl); }
function bass(f, t, d, v = 0.32){ const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 5; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(220, t + d); const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.008, v, d); osc('sawtooth', f, t, t + d + 0.05, fl); }
function pad(fs, t, d, v = 0.05){ fs.forEach(f => { const g = ctx.createGain(); g.connect(bus); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.25); g.gain.setValueAtTime(v, t + d - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + d); osc('triangle', f, t, t + d, g, -7); osc('triangle', f, t, t + d, g, 7); }); }
function brass(f, t, d, v = 0.12){ const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(3600, t + 0.07); fl.frequency.linearRampToValueAtTime(2000, t + 0.3); const g = ctx.createGain(); g.connect(bus); fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setValueAtTime(v * 0.85, t + Math.max(0.05, d - 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12); osc('sawtooth', f, t, t + d + 0.15, fl, -9); osc('sawtooth', f, t, t + d + 0.15, fl, 9); }
function kick(t, v = 0.8){ const g = ctx.createGain(); g.connect(bus); env(g, t, 0.002, v, 0.3); const o = osc('sine', 150, t, t + 0.35, g); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); }
function hat(t, v = 0.07, d = 0.045){ const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7500; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.001, v, d); noise(t, d + 0.02, fl); }
function snare(t, v = 0.25){ const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1900; fl.Q.value = 0.7; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.001, v, 0.14); noise(t, 0.2, fl); const g2 = ctx.createGain(); g2.connect(bus); env(g2, t, 0.001, v * 0.5, 0.07); osc('triangle', 190, t, t + 0.1, g2); }
function clap(t, v = 0.3){ const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1300; fl.Q.value = 1.2; const g = ctx.createGain(); g.connect(bus); fl.connect(g); [0, 0.012, 0.024].forEach(o => { g.gain.setValueAtTime(v, t + o); g.gain.exponentialRampToValueAtTime(0.02, t + o + 0.011); }); g.gain.setValueAtTime(v * 0.8, t + 0.036); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); noise(t, 0.22, fl); }
function wood(f, t, v = 0.18){ const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 8; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.001, v, 0.05); osc('square', f, t, t + 0.08, fl); }
/* Industrie-Klänge */
let shaperCurve;
function drive(outV = 0.4){ const s = ctx.createWaveShaper(); if(!shaperCurve){ const n = 1024; shaperCurve = new Float32Array(n); for(let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; shaperCurve[i] = Math.tanh(3 * x); } } s.curve = shaperCurve; const g = ctx.createGain(); g.gain.value = outV; s.connect(g); g.connect(bus); return s; }
function steel(f, t, v = 0.2, d = 0.45){   // angeschlagener Stahlstab (FM, unharmonisch)
  const g = ctx.createGain(); g.connect(bus); env(g, t, 0.002, v, d);
  const c = osc('sine', f, t, t + d + 0.1, g);
  const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + d * 0.6); mg.connect(c.frequency);
  osc('sine', f * 3.51, t, t + d + 0.1, mg);
  const g2 = ctx.createGain(); g2.connect(bus); env(g2, t, 0.001, v * 0.25, 0.03); noise(t, 0.04, g2);
}
function anvil(t, v = 0.2){ [[1180, 1], [1870, 0.6], [2630, 0.4], [3420, 0.25]].forEach(([f, a]) => { const g = ctx.createGain(); g.connect(bus); env(g, t, 0.001, v * a, 0.35 * a + 0.08); osc('sine', f, t, t + 0.55, g); }); const g = ctx.createGain(); g.connect(bus); env(g, t, 0.001, v * 0.6, 0.02); noise(t, 0.03, g); }
function hiss(t, d = 0.12, v = 0.08){ const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 0.9; fl.frequency.setValueAtTime(5200, t); fl.frequency.linearRampToValueAtTime(2800, t + d); const g = ctx.createGain(); g.connect(bus); fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); noise(t, Math.min(d + 0.02, 1), fl); }
function relay(t, v = 0.12){ const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 2500; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.0005, v, 0.012); noise(t, 0.02, fl); const g2 = ctx.createGain(); g2.connect(bus); env(g2, t + 0.008, 0.0005, v * 0.5, 0.01); osc('square', 3200, t + 0.008, t + 0.03, g2); }
function clank(t, v = 0.22){ const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 650; fl.Q.value = 4; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.001, v, 0.09); noise(t, 0.12, fl); [310, 487, 733].forEach(f => { const g2 = ctx.createGain(); g2.connect(bus); env(g2, t, 0.001, v * 0.3, 0.13); osc('triangle', f, t, t + 0.16, g2); }); snare(t, v * 0.5); }
function press(t, v = 0.8){ const g = ctx.createGain(); g.connect(drive(0.55)); env(g, t, 0.002, v * 0.7, 0.28); const o = osc('sine', 120, t, t + 0.35, g); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
  const g2 = ctx.createGain(); g2.connect(bus); env(g2, t, 0.001, v * 0.07, 0.25); osc('sine', 233, t, t + 0.3, g2); osc('sine', 367, t, t + 0.3, g2); }
function gritBass(f, t, d, v = 0.3){ const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(1100, t); fl.frequency.exponentialRampToValueAtTime(180, t + d); const g = ctx.createGain(); g.connect(drive(0.3)); fl.connect(g); env(g, t, 0.006, v * 1.4, d); osc('sawtooth', f, t, t + d + 0.05, fl); osc('square', f / 2, t, t + d + 0.05, fl); }
function hum(fs, t, d, v = 0.05){ fs.forEach(f => { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 750; const g = ctx.createGain(); g.connect(bus); fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.2); g.gain.setValueAtTime(v, t + d - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + d); osc('sawtooth', f, t, t + d, fl, -8); osc('sawtooth', f, t, t + d, fl, 8); }); }
function servo(t, d, f0, f1, v = 0.06){ const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 5; fl.frequency.setValueAtTime(f0 * 3, t); fl.frequency.exponentialRampToValueAtTime(f1 * 3, t + d); const g = ctx.createGain(); g.connect(bus); fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d); const o = osc('sawtooth', f0, t, t + d + 0.05, fl); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); }
function beacon(t, v = 0.07){ [0, 0.17].forEach((o, k) => { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2500; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t + o, 0.003, v, 0.13); osc('square', k ? 740 : 988, t + o, t + o + 0.17, fl); }); }
function whistle(t, d = 1.3, v = 0.08){ [587, 740, 880].forEach(f => { const g = ctx.createGain(); g.connect(bus); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.1); g.gain.setValueAtTime(v, t + d - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + d); const o = osc('sine', f * 0.96, t, t + d + 0.05, g); o.frequency.setValueAtTime(f * 0.96, t); o.frequency.linearRampToValueAtTime(f, t + 0.25); const l = ctx.createOscillator(); l.frequency.value = 6; const lg = ctx.createGain(); lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d); }); hiss(t, d * 0.9, 0.04); }
function crash(t, v = 0.3){ const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 4500; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t, 0.002, v, 1.6); noise(t, 1.0, fl); const s2 = noise(t + 0.9, 0.9, fl); }

/* ---------- Stücke (Schritt = Sechzehntel) ---------- */
const LOBBY_MEL = [
  seq('A4 . . C5 . . F5 . E5 . C5 . D5 . C5 .'),
  seq('D5 . . F5 . . A5 . G5 . F5 . E5 . D5 .'),
  seq('D5 . . F5 . . Bb5 . A5 . F5 . G5 . F5 .'),
  seq('E5 . . G5 . . C6 . Bb5 . G5 . E5 . G5 .')];
const LOBBY_PAD = [['F3','A3','C4'], ['F3','A3','D4'], ['F3','Bb3','D4'], ['E3','G3','C4']].map(c => c.map(N));
const LOBBY_BASS = ['F2', 'D2', 'Bb1', 'C2'].map(N);
const LOBBY_TOP = [['C6','A5'], ['A5','F5'], ['Bb5','F5'], ['C6','G5']].map(c => c.map(N));
const BASS_PAT = { 0: 1, 3: 2, 6: 1, 8: 1, 10: 2, 14: 1.5 };

const LOBBY = { bpm: 118, step(s, t){
  const bar = Math.floor(s / 16) % 4, i = s % 16, sp = 60 / this.bpm / 4;
  const m = LOBBY_MEL[bar][i]; if(m) steel(N(m), t, 0.2);
  if(i === 0) hum(LOBBY_PAD[bar], t, sp * 16 * 0.97, 0.035);
  if(i in BASS_PAT) gritBass(LOBBY_BASS[bar] * BASS_PAT[i], t, sp * 1.5, 0.28);
  if(i === 0 || i === 8) press(t, 0.75);
  if(i === 4 || i === 12) clank(t, 0.2);
  if(i % 4 === 2) hiss(t, 0.07, 0.07);
  if(i % 4 === 0) relay(t, 0.07);
  if(bar === 3 && i === 14) anvil(t, 0.08);
  if(bar === 1 && i === 8) hiss(t, 0.35, 0.05);
  if(Math.floor(s / 64) % 2 === 1 && i % 4 === 2) steel(LOBBY_TOP[bar][(i >> 2) % 2], t, 0.05, 0.25);
} };

const CH_CHORDS = [['A3','C4','E4'], ['A3','C4','E4'], ['A3','C4','F4'], ['G#3','B3','E4']].map(c => { const f = c.map(N); return f.concat(f.map(x => x * 2)); });
const CH_BASS = ['A2', 'A2', 'F2', 'E2'].map(N);
const ARP = [0, 1, 2, 3, 2, 1, 3, 4, 0, 1, 2, 3, 4, 5, 4, 3];
const CHALLENGE = { bpm: 126, base: 126, top: 152, urgent: false, step(s, t){
  const bar = Math.floor(s / 16) % 4, i = s % 16, sp = 60 / this.bpm / 4, tones = CH_CHORDS[bar];
  pluck(tones[ARP[i]], t, 0.1, 0.16);
  if(this.urgent) pluck(tones[ARP[i]] * 2, t, 0.035, 0.1);
  if(i % 2 === 0) gritBass(CH_BASS[bar] * (i % 4 === 2 ? 2 : 1), t, sp * 1.6, 0.26);
  if(this.urgent){
    if(i % 4 === 0) press(t, 0.8); if(i === 4 || i === 12) clank(t, 0.22); hiss(t, 0.04, i % 2 ? 0.03 : 0.06);
    if(i % 2 === 0) relay(t, i % 4 === 0 ? 0.16 : 0.1);
    if((bar === 0 || bar === 2) && i === 0) beacon(t);
    if(bar === 3 && i === 0) servo(t, sp * 16, 110, 440);
    if(i === 14) anvil(t, 0.06);
  } else {
    if(i === 0 || i === 10) press(t, 0.75); if(i === 12) clank(t, 0.2); if(i % 4 === 2) hiss(t, 0.06, 0.06);
    if(i % 4 === 0) relay(t, 0.14);
    if(i === 0 && bar === 0) anvil(t, 0.05);
  }
  if(this.urgent && this.bpm < this.top) this.bpm = Math.min(this.top, this.bpm + 0.5);
  if(!this.urgent && this.bpm > this.base) this.bpm = Math.max(this.base, this.bpm - 0.5);
} };

const VIC_MEL = [
  seq('C5 . E5 . G5 . E5 . C6 . . . G5 . E5 .'),
  seq('F5 . A5 . C6 . A5 . F5 . . . A5 . C6 .'),
  seq('D6 . B5 . G5 . B5 . D6 . . . B5 . G5 .'),
  seq('E6 . D6 . C6 . G5 . C6 . . . . . . .')];
const VIC_PAD = [['C4','E4','G4'], ['C4','F4','A4'], ['B3','D4','G4'], ['C4','E4','G4']].map(c => c.map(N));
const VIC_BASS = ['C2', 'F2', 'G2', 'C2'].map(N);

function victory(){
  const t0 = ctx.currentTime + 0.05, beat = 60 / 132;
  whistle(t0, 1.3);                                             // Fabrikpfeife
  for(let k = 0; k < 40; k++){ const t = t0 + 0.7 + k * 0.045; snare(t, 0.04 + k * 0.005); if(k % 4 === 0) relay(t, 0.05 + k * 0.002); }
  const T = t0 + 2.55;
  [['G4', 0, 0.3], ['C5', 1/3, 0.3], ['E5', 2/3, 0.3], ['G5', 1, 0.9], ['E5', 2, 0.45], ['G5', 2.5, 0.45], ['C6', 3, 2.6]].forEach(([n, b, d]) => brass(N(n), T + b * beat, d * beat, 0.13));
  [[1, ['C4','E4','G4'], 0.95], [3, ['C4','E4','G4','C5'], 2.6]].forEach(([b, ch, d]) => { ch.forEach(n => brass(N(n) / 2, T + b * beat, d * beat, 0.05)); crash(T + b * beat, 0.25); press(T + b * beat, 0.9); anvil(T + b * beat, 0.15); });
  hiss(T + 3 * beat + 0.1, 1.0, 0.06);                            // Dampf ablassen
  const L = T + 6 * beat;
  for(let bar = 0; bar < 4; bar++) for(let i = 0; i < 16; i++){
    const t = L + (bar * 16 + i) * beat / 4, m = VIC_MEL[bar][i];
    if(m) steel(N(m), t, 0.22);
    if(i === 0) hum(VIC_PAD[bar], t, beat * 3.9, 0.03);
    if(i in BASS_PAT) gritBass(VIC_BASS[bar] * BASS_PAT[i], t, beat * 0.4, 0.26);
    if(i % 4 === 0) press(t, 0.75); if(i === 4 || i === 12) clank(t, 0.22); if(i % 4 === 2) hiss(t, 0.07, 0.07); if(i % 2 === 0) relay(t, 0.06);
    if(i === 14 && bar % 2) anvil(t, 0.1);
  }
  const E = L + 16 * beat;
  ['C4','E4','G4','C5'].forEach(n => brass(N(n), E, beat * 2, 0.07)); crash(E, 0.3); press(E, 0.9); anvil(E, 0.18); hiss(E + 0.15, 1.0, 0.06);
  return (E + beat * 2.5 - ctx.currentTime) * 1000;
}

/* ---------- Effekte ---------- */
const SFX = {
  join(){ const t = ctx.currentTime + 0.01, f = 700 + Math.random() * 500; hiss(t, 0.1, 0.09); relay(t + 0.09, 0.14); steel(f, t + 0.1, 0.14, 0.3); },
  solved(){ const t = ctx.currentTime + 0.01; ['E6','G6','C7'].forEach((n, i) => steel(N(n), t + i * 0.08, 0.16, 0.4)); anvil(t + 0.24, 0.07); hiss(t + 0.24, 0.2, 0.04); },
  count(){ const t = ctx.currentTime + 0.05; [0, 1, 2].forEach(k => { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 3000; const g = ctx.createGain(); g.connect(bus); fl.connect(g); env(g, t + k, 0.005, 0.16, 0.18); osc('square', 880, t + k, t + k + 0.25, fl); relay(t + k, 0.12); });
    press(t + 3, 0.95); anvil(t + 3, 0.2); crash(t + 3, 0.25); whistle(t + 3, 0.7, 0.07); return 3800; },
  timeup(){ const t = ctx.currentTime + 0.02; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; const g = ctx.createGain(); g.connect(bus); fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.02); g.gain.setValueAtTime(0.2, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); osc('sawtooth', 110, t, t + 0.95, fl); osc('sawtooth', 116.5, t, t + 0.95, fl); press(t, 0.9);
    servo(t + 0.5, 1.4, 420, 45, 0.08); hiss(t + 0.9, 0.9, 0.06); return 2000; }
};

/* ---------- Ablaufsteuerung ---------- */
function stopLoop(){ clearInterval(timer); timer = 0; cur = null; }
function loop(track){
  stopLoop(); killBus(); track.bpm = track.base || track.bpm;
  cur = { track, step: 0, next: ctx.currentTime + 0.06 };
  timer = setInterval(() => { while(cur && cur.next < ctx.currentTime + 0.12){ cur.track.step(cur.step, cur.next); cur.next += 60 / cur.track.bpm / 4; cur.step++; } }, 25);
}
const M = {
  unlock(){ return init(); },
  play(n){
    if(!init()) return; pending.forEach(clearTimeout); pending = [];
    if(n === name && (n !== 'victory')) return;
    name = n;
    if(n === 'lobby') loop(LOBBY);
    else if(n === 'challenge'){ CHALLENGE.urgent = false; loop(CHALLENGE); }
    else if(n === 'victory'){ stopLoop(); killBus(); const ms = victory(); pending.push(setTimeout(() => { if(name === 'victory') name = null; }, ms)); }
  },
  urgent(on){ CHALLENGE.urgent = !!on; },
  sfx(n){ if(!init() || !SFX[n]) return 0; return SFX[n]() || 0; },
  stop(){ stopLoop(); pending.forEach(clearTimeout); pending = []; name = null; if(ctx) killBus(); CHALLENGE.urgent = false; CHALLENGE.bpm = CHALLENGE.base; },
  volume(v){ pref.vol = Math.max(0, Math.min(1, +v)); savePref(); if(master && !pref.muted) master.gain.setTargetAtTime(pref.vol, ctx.currentTime, 0.05); },
  mute(on){ pref.muted = !!on; savePref(); if(master) master.gain.setTargetAtTime(pref.muted ? 0 : pref.vol, ctx.currentTime, 0.05); },
  get muted(){ return pref.muted; }, get vol(){ return pref.vol; }, get current(){ return name; }, get supported(){ return !!AC; }
};
window.SPSQ_MUSIC = M;
})();
