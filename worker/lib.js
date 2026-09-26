// SPS Quest — Hilfsfunktionen für den Worker: Antworten, Krypto, Validierung
export const enc = new TextEncoder();

export class HttpError extends Error {
  constructor(status, msg, extra){ super(msg); this.status = status; this.extra = extra || null; }
}
export const fail = (status, msg, extra) => { throw new HttpError(status, msg, extra); };

export function json(data, status = 200, headers = {}){
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers)
  });
}

export const now = () => Date.now();

// ---- Base64 / Hex ----
export function b64(bytes){ let s = ''; bytes = new Uint8Array(bytes); for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
export function unb64(str){ const s = atob(str); const out = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
export function b64url(bytes){ return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function hex(bytes){ return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
export function randomBytes(n){ return crypto.getRandomValues(new Uint8Array(n)); }

export async function sha256hex(str){ return hex(await crypto.subtle.digest('SHA-256', enc.encode(str))); }

// Vergleich in konstanter Zeit (über gleich lange Hashes)
export async function safeEqual(a, b){
  const [x, y] = await Promise.all([sha256hex('cmp:' + a), sha256hex('cmp:' + b)]);
  let d = 0; for(let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// ---- Passwörter: PBKDF2 (SHA-256) via WebCrypto ----
// Cloudflare Workers erlauben höchstens 100 000 Iterationen.
export const PBKDF2_ITER = 100000;
async function pbkdf2(pw, salt, iter){
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
export async function hashPassword(pw){
  const salt = randomBytes(16);
  return 'pbkdf2$' + PBKDF2_ITER + '$' + b64(salt) + '$' + b64(await pbkdf2(pw, salt, PBKDF2_ITER));
}
export async function verifyPassword(pw, stored){
  const p = String(stored || '').split('$');
  if(p.length !== 4 || p[0] !== 'pbkdf2') return false;
  const h = await pbkdf2(pw, unb64(p[2]), parseInt(p[1], 10));
  const want = unb64(p[3]);
  if(h.length !== want.length) return false;
  let d = 0; for(let i = 0; i < h.length; i++) d |= h[i] ^ want[i];
  return d === 0;
}

// ---- Zufallswerte für Codes und Startpasswörter ----
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // ohne 0/O, 1/I
export function randomCode(len){
  const r = randomBytes(len); let s = '';
  for(let i = 0; i < len; i++) s += CODE_ALPHA[r[i] % CODE_ALPHA.length];
  return s;
}
export function randomDigits(len){
  const r = randomBytes(len); let s = '';
  for(let i = 0; i < len; i++) s += String(r[i] % 10);
  return s;
}
const WORDS = ['anker','band','bolzen','dampf','druck','feder','funke','getriebe','greifer','hebel','kabel','kolben','kran','lager','motor','mutter','niete','pumpe','relais','riemen','rolle','schalter','schraube','sensor','spule','stahl','taster','turbine','ventil','walze','welle','zange'];
export function randomPassword(){
  const r = randomBytes(3);
  return WORDS[r[0] % WORDS.length] + '-' + WORDS[r[1] % WORDS.length] + '-' + randomDigits(2);
}

// ---- Validierung ----
export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,23}$/;
export function checkUsername(u){
  u = String(u || '').trim();
  if(!USERNAME_RE.test(u)) fail(400, 'Benutzername: 3–24 Zeichen, nur Buchstaben, Ziffern, Punkt, Strich und Unterstrich (keine Umlaute, kein Leerzeichen).');
  return u;
}
export function checkPassword(pw, min){
  pw = String(pw || '');
  if(pw.length < min) fail(400, 'Das Passwort muss mindestens ' + min + ' Zeichen lang sein.');
  if(pw.length > 200) fail(400, 'Das Passwort ist zu lang.');
  return pw;
}
export function cleanText(s, max){ return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
