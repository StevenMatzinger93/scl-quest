// SPS Quest — Zertifikate: ausstellen, zurückziehen, widerrufen, öffentlich prüfen (/z/:code, /api/certificates/:code).
import { json, fail, now, cleanText, randomCode } from './lib.js';
import { LEVEL_NAME, examRow } from './exam.js';

const QNAME = { scl: 'SCL', kop: 'KOP', fup: 'FUP', awl: 'AWL' };
const CODE_RE = /^SPSQ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const LOOKUP = { n: 60, window: 60 * 1000 };            // Prüfcode-Abfragen pro IP und Minute
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'’-]{1,79}$/u;

export async function certRoutes(C, p, m, H){
  if(!p.startsWith('/api/certificates') && p !== '/api/admin/certificates' && p !== '/api/admin/exam-credits' && !/^\/api\/classes\/\d+\/certificates$/.test(p)) return null;
  let mm;
  // öffentlich
  if((mm = p.match(/^\/api\/certificates\/(SPSQ-[A-Z0-9-]+)$/i)) && m === 'GET'){ await lookupLimit(C); return json(await publicCert(C, mm[1].toUpperCase())); }
  C.user = await H.currentUser(C);
  if(!C.user) fail(401, 'Nicht angemeldet.');
  if(p === '/api/certificates' && m === 'POST') return issue(C);
  if(p === '/api/certificates/mine' && m === 'GET') return mine(C);
  if((mm = p.match(/^\/api\/certificates\/(SPSQ-[A-Z0-9-]+)$/i)) && m === 'DELETE') return withdraw(C, mm[1].toUpperCase());
  if((mm = p.match(/^\/api\/certificates\/(SPSQ-[A-Z0-9-]+)\/revoke$/i)) && m === 'POST') return revoke(C, H, mm[1].toUpperCase());
  if((mm = p.match(/^\/api\/classes\/(\d+)\/certificates$/)) && m === 'GET') return classCerts(C, H, +mm[1]);
  if(p === '/api/admin/certificates' && m === 'GET') return adminList(C, H);
  if(p === '/api/admin/exam-credits' && m === 'POST') return grantCredits(C, H);
  fail(404, 'Unbekannte Adresse.');
}

async function lookupLimit(C){
  const key = 'zc:' + (C.req.headers.get('cf-connecting-ip') || 'local'), t = now();
  const a = await C.db.prepare('SELECT n, first FROM attempts WHERE k = ?').bind(key).first();
  if(a && t - a.first < LOOKUP.window && a.n >= LOOKUP.n) fail(429, 'Zu viele Abfragen. Bitte in einer Minute erneut versuchen.');
  if(!a || t - a.first >= LOOKUP.window) await C.db.prepare('INSERT OR REPLACE INTO attempts (k, n, first, until) VALUES (?, 1, ?, ?)').bind(key, t, t + LOOKUP.window).run();
  else await C.db.prepare('UPDATE attempts SET n = n + 1 WHERE k = ?').bind(key).run();
}
function title(c){ return QNAME[c.quest] + ' Quest – ' + LEVEL_NAME[c.level]; }
function status(c){ return !c ? 'unknown' : c.revoked_at ? (c.revoke_reason === 'withdrawn' ? 'withdrawn' : 'revoked') : 'valid'; }
export async function publicCert(C, code){
  if(!CODE_RE.test(code)) return { status: 'unknown', code };
  const c = await C.db.prepare('SELECT * FROM certificates WHERE id = ?').bind(code).first();
  const st = status(c);
  if(st === 'unknown') return { status: st, code };
  const out = { status: st, code, quest: c.quest, level: c.level, title: title(c), issuedAt: c.issued_at };
  if(st === 'valid'){ Object.assign(out, { holder: c.holder_name, score: Math.round(c.score * 100), distinction: !!c.distinction, proctored: !!c.proctored, proctor: c.proctor_label || null }); }
  if(st === 'revoked') out.revokedAt = c.revoked_at;
  if(st === 'withdrawn') out.revokedAt = c.revoked_at;
  return out;
}

async function uniqueCode(C){
  for(let i = 0; i < 20; i++){ const code = 'SPSQ-' + randomCode(4) + '-' + randomCode(4); if(!await C.db.prepare('SELECT id FROM certificates WHERE id = ?').bind(code).first()) return code; }
  fail(503, 'Kein freier Prüfcode gefunden.');
}
async function issue(C){
  const b = C.body;
  if(b.consent !== true) fail(400, 'Bitte die Einwilligung bestätigen: Der Name ist auf der Prüfseite öffentlich sichtbar.');
  const name = cleanText(b.holderName, 80).replace(/\s+/g, ' ');
  if(!NAME_RE.test(name)) fail(400, 'Bitte einen Namen mit 2–80 Zeichen eingeben (Buchstaben, Leerzeichen, Punkt, Bindestrich, Apostroph).');
  const e = await examRow(C, +b.examId);
  if(!e || e.user_id !== C.user.id) fail(404, 'Prüfung nicht gefunden.');
  if(e.state !== 'submitted' && e.state !== 'expired') fail(409, 'Die Prüfung ist nicht abgeschlossen.');
  if(!e.passed) fail(409, 'Die Prüfung ist nicht bestanden.');
  const ex = await C.db.prepare('SELECT id, revoked_at FROM certificates WHERE exam_id = ?').bind(e.id).first();
  if(ex && !ex.revoked_at) return json({ certificate: await ownView(C, ex.id) });
  if(ex) fail(409, 'Das Zertifikat dieser Prüfung wurde zurückgezogen oder widerrufen.');
  let proctor = null;
  if(e.session_id){
    const s = await C.db.prepare('SELECT u.username, u.display_name, c.name AS class_name FROM exam_sessions s JOIN users u ON u.id = s.teacher_id LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = ?').bind(e.session_id).first();
    if(s) proctor = (s.display_name || s.username) + (s.class_name ? ', ' + s.class_name : '');
  }
  const code = await uniqueCode(C);
  await C.db.prepare('INSERT INTO certificates (id, user_id, exam_id, quest, level, holder_name, score, distinction, proctored, proctor_label, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(code, C.user.id, e.id, e.quest, e.level, name, e.score, e.distinction ? 1 : 0, e.session_id ? 1 : 0, proctor, now()).run();
  return json({ certificate: await ownView(C, code) }, 201);
}
async function ownView(C, code){
  const c = await C.db.prepare('SELECT * FROM certificates WHERE id = ?').bind(code).first();
  return { code: c.id, quest: c.quest, level: c.level, title: title(c), holder: c.holder_name, score: Math.round(c.score * 100), distinction: !!c.distinction,
    proctored: !!c.proctored, proctor: c.proctor_label, issuedAt: c.issued_at, status: status(c), revokedAt: c.revoked_at, revokeReason: c.revoke_reason === 'withdrawn' ? null : c.revoke_reason };
}
async function mine(C){
  const r = await C.db.prepare('SELECT id FROM certificates WHERE user_id = ? ORDER BY issued_at DESC').bind(C.user.id).all();
  const out = []; for(const x of (r.results || [])) out.push(await ownView(C, x.id));
  return json({ certificates: out });
}
async function withdraw(C, code){
  const c = await C.db.prepare('SELECT * FROM certificates WHERE id = ? AND user_id = ?').bind(code, C.user.id).first();
  if(!c) fail(404, 'Zertifikat nicht gefunden.');
  // Name löschen = Zertifikat zurückgezogen (Datenschutz): die Prüfseite zeigt danach nur noch „zurückgezogen“
  await C.db.prepare("UPDATE certificates SET holder_name = '', revoked_at = COALESCE(revoked_at, ?), revoke_reason = COALESCE(revoke_reason, 'withdrawn') WHERE id = ?").bind(now(), code).run();
  return json({ ok: true });
}
async function revoke(C, H, code){
  H.requireRole(C, 'admin');
  const reason = cleanText(C.body.reason, 300);
  if(!reason) fail(400, 'Bitte eine Begründung angeben.');
  const r = await C.db.prepare('UPDATE certificates SET revoked_at = ?, revoke_reason = ? WHERE id = ? AND revoked_at IS NULL').bind(now(), reason, code).run();
  if(!r.meta.changes) fail(404, 'Zertifikat nicht gefunden oder bereits ungültig.');
  return json({ ok: true });
}
async function classCerts(C, H, id){
  H.requireRole(C, 'teacher', 'admin');
  const c = await C.db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').bind(id).first();
  if(!c || (C.user.role !== 'admin' && c.teacher_id !== C.user.id)) fail(404, 'Klasse nicht gefunden.');
  const r = await C.db.prepare('SELECT ce.id, ce.quest, ce.level, ce.score, ce.distinction, ce.proctored, ce.issued_at, ce.revoked_at, ce.revoke_reason, u.id AS user_id, u.username FROM certificates ce JOIN users u ON u.id = ce.user_id WHERE u.class_id = ? ORDER BY ce.issued_at DESC').bind(id).all();
  const ex = await C.db.prepare("SELECT e.id, e.user_id, e.quest, e.level, e.state, e.score, e.passed, e.started_at, e.session_id, e.focus_lost, e.void_reason FROM exams e JOIN users u ON u.id = e.user_id WHERE u.class_id = ? ORDER BY e.started_at DESC LIMIT 300").bind(id).all();
  return json({ certificates: (r.results || []).map(x => ({ code: x.id, userId: x.user_id, username: x.username, quest: x.quest, level: x.level, score: Math.round(x.score * 100), distinction: !!x.distinction, proctored: !!x.proctored, issuedAt: x.issued_at, status: status({ revoked_at: x.revoked_at, revoke_reason: x.revoke_reason }) })),
    exams: (ex.results || []).map(x => ({ id: x.id, userId: x.user_id, quest: x.quest, level: x.level, state: x.state, score: x.score, passed: !!x.passed, startedAt: x.started_at, proctored: !!x.session_id, focusLost: x.focus_lost, voidReason: x.void_reason })) });
}
async function adminList(C, H){
  H.requireRole(C, 'admin');
  const r = await C.db.prepare('SELECT ce.*, u.username FROM certificates ce LEFT JOIN users u ON u.id = ce.user_id ORDER BY ce.issued_at DESC LIMIT 300').all();
  const st = await C.db.prepare("SELECT COUNT(*) AS n, SUM(passed) AS passed, SUM(state = 'running') AS running FROM exams").first();
  return json({ stats: { exams: st.n || 0, passed: st.passed || 0, running: st.running || 0 },
    certificates: (r.results || []).map(c => ({ code: c.id, username: c.username, quest: c.quest, level: c.level, score: Math.round(c.score * 100), distinction: !!c.distinction, proctored: !!c.proctored, issuedAt: c.issued_at, status: status(c), revokeReason: c.revoke_reason === 'withdrawn' ? null : c.revoke_reason })) });
}
async function grantCredits(C, H){
  H.requireRole(C, 'admin');
  const n = Math.max(1, Math.min(1000, Math.round(+C.body.n || 0)));
  let userId = null, classId = null;
  if(C.body.username){ const u = await C.db.prepare('SELECT id FROM users WHERE username = ?').bind(String(C.body.username)).first(); if(!u) fail(404, 'Konto nicht gefunden.'); userId = u.id; }
  else if(C.body.classId){ const c = await C.db.prepare('SELECT id FROM classes WHERE id = ?').bind(+C.body.classId).first(); if(!c) fail(404, 'Klasse nicht gefunden.'); classId = c.id; }
  else fail(400, 'Konto oder Klasse angeben.');
  await C.db.prepare('INSERT INTO exam_credits (user_id, class_id, remaining, created_at) VALUES (?, ?, ?, ?)').bind(userId, classId, n, now()).run();
  return json({ ok: true }, 201);
}

/* ---------- Öffentliche Prüfseite /z/:code (serverseitig, mit Open-Graph-Vorschau) ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const fmtDate = t => new Date(t).toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
export async function verifyPage(C, code){
  let d;
  try{ await lookupLimit(C); d = await publicCert(C, String(code || '').toUpperCase()); }
  catch(e){ if(e && e.status === 429) d = { status: 'limit', code }; else throw e; }
  const origin = C.url.origin, url = origin + '/z/' + esc(d.code);
  const head = {
    valid: ['Zertifikat gültig', '✓', 'ok'], revoked: ['Zertifikat widerrufen', '✕', 'bad'], withdrawn: ['Zertifikat zurückgezogen', '–', 'dim'],
    unknown: ['Prüfcode unbekannt', '?', 'dim'], limit: ['Zu viele Abfragen', '…', 'dim']
  }[d.status];
  const ogTitle = d.status === 'valid' ? d.holder + ' – ' + d.title : head[0];
  const ogDesc = d.status === 'valid' ? 'SPS Quest Zertifikat ' + d.title + (d.distinction ? ' mit Auszeichnung' : '') + ', ausgestellt am ' + fmtDate(d.issuedAt) + '. Prüfcode ' + d.code + '.' : 'Prüfung eines SPS Quest Zertifikats.';
  const rows = d.status === 'valid' ? [
    ['Name', esc(d.holder)], ['Zertifikat', esc(d.title) + (d.distinction ? ' <b class="aus">mit Auszeichnung</b>' : '')], ['Ausgestellt', fmtDate(d.issuedAt)],
    ['Ergebnis', d.score + ' %'], ['Prüfungsart', d.proctored ? 'unter Aufsicht' + (d.proctor ? ' bei ' + esc(d.proctor) : '') : 'online abgelegt'],
    ['Prüfcode', '<code>' + esc(d.code) + '</code>']
  ].filter(Boolean) : d.status === 'revoked' ? [['Zertifikat', esc(d.title)], ['Widerrufen am', fmtDate(d.revokedAt)], ['Prüfcode', '<code>' + esc(d.code) + '</code>']]
    : d.status === 'withdrawn' ? [['Zertifikat', esc(d.title)], ['Status', 'vom Inhaber zurückgezogen'], ['Prüfcode', '<code>' + esc(d.code) + '</code>']]
    : [['Prüfcode', '<code>' + esc(d.code) + '</code>'], ['Hinweis', d.status === 'limit' ? 'Bitte in einer Minute erneut versuchen.' : 'Zu diesem Code gibt es kein Zertifikat. Bitte Schreibweise prüfen (Format SPSQ-XXXX-XXXX).']];
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(head[0])} – SPS Quest</title><meta name="description" content="${esc(ogDesc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="SPS Quest"><meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${origin}/icon-512.png">
<meta name="twitter:card" content="summary"><meta name="robots" content="noindex"><link rel="icon" href="/icon-192.png">
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05070a radial-gradient(ellipse at top,#10202e,#05070a 70%);color:#dbe7f3;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
main{width:min(560px,100%);background:#0b121a;border:1px solid #20364a;border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.brand{font:600 12px/1 ui-monospace,monospace;letter-spacing:.2em;color:#58c4ff;margin-bottom:18px}.seal{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;margin-bottom:10px}
.ok .seal{background:#0f3a22;color:#39ff7a;border:2px solid #39ff7a}.bad .seal{background:#3a0f14;color:#ff6b6b;border:2px solid #ff6b6b}.dim .seal{background:#1c2530;color:#9fb0c0;border:2px solid #4a5a6a}
h1{margin:0 0 16px;font-size:22px}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-top:1px solid #18293a;vertical-align:top}td:first-child{color:#8aa0b4;width:34%;padding-right:10px}
code{font-family:ui-monospace,monospace;color:#9fd8ff}.aus{color:#ffd166}footer{margin-top:18px;font-size:12px;color:#7f93a6}footer a{color:#9fd8ff}</style></head>
<body><main class="${head[2]}"><div class="brand">SPS QUEST · ZERTIFIKATSPRÜFUNG</div><div class="seal" aria-hidden="true">${head[1]}</div><h1>${esc(head[0])}</h1>
<table>${rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('')}</table>
<footer>Ausgestellt von SPS Quest. Kein Zertifikat der Siemens AG. SIMATIC, S7 und TIA Portal sind Marken der Siemens AG.<br><a href="/">SPS Quest</a> · <a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a></footer></main></body></html>`;
  return new Response(html, { status: d.status === 'unknown' ? 404 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
