// SPS Quest — Seed-Daten (z. B. eine Testklasse) aus einer LOKALEN Datei.
// Im Repository stehen keine Konten, Passwörter oder Namen.
//
//   node seed.js [datei.json]     → schreibt dev/seed.local.sql (nicht eingecheckt)
//   npx wrangler d1 execute spsquest --remote --file=dev/seed.local.sql   (bzw. --local)
//
// Standard-Eingabe: dev/seed.local.json (in .gitignore). Fehlt sie, wird kein Seed erzeugt.
// Format:
//   { "admin":   { "username": "…", "password": "…" },          // Admin-Konto mit Passwort-Hash, zugleich Dozent
//     "class":   { "name": "…", "code": "ABCDEF" },             // 6 Zeichen ohne 0/O/1/I; Selbstanmeldung geschlossen
//     "students":[ { "username": "…", "password": "…" }, … ] }
//
// Idempotent: INSERT OR IGNORE bzw. WHERE NOT EXISTS – mehrfaches Ausführen erzeugt keine Duplikate.
// Ein bereits geändertes Passwort wird nie überschrieben (nur Konten mit pw = '!secret' bekommen einen Hash).
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const src = path.resolve(process.argv[2] || path.join(__dirname, 'seed.local.json'));
const out = path.resolve(process.env.SEED_OUT || path.join(__dirname, 'seed.local.sql'));
if(!fs.existsSync(src)){ console.log('Kein Seed: ' + path.relative(process.cwd(), src) + ' fehlt (siehe Kommentar in dev/seed.js).'); process.exit(0); }
const D = JSON.parse(fs.readFileSync(src, 'utf8'));
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,23}$/;
const bad = m => { console.error('seed: ' + m); process.exit(1); };
if(!D.admin || !NAME.test(D.admin.username || '') || !D.admin.password) bad('admin.username/password fehlt oder ungültig');
if(!D.class || !D.class.name || !/^[A-HJ-NP-Z2-9]{6}$/.test(D.class.code || '')) bad('class.name/code fehlt oder ungültig');
(D.students || []).forEach(s => { if(!NAME.test(s.username || '') || !s.password) bad('Lernende/r ungültig: ' + JSON.stringify(s.username)); });

// gleiches Format wie worker/lib.js hashPassword(): pbkdf2$<iter>$<salt b64>$<hash b64>, SHA-256, 32 Byte
const ITER = 100000;
function hash(pw){
  const salt = crypto.randomBytes(16);
  return 'pbkdf2$' + ITER + '$' + salt.toString('base64') + '$' + crypto.pbkdf2Sync(String(pw), salt, ITER, 32, 'sha256').toString('base64');
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";
const T = q(D.admin.username);
const CLS = `(SELECT c.id FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.name = ${q(D.class.name)} AND u.username = ${T} LIMIT 1)`;

const sql = [
  `INSERT OR IGNORE INTO users (username, pw, role, created_at, notice_ack, must_change) VALUES (${T}, ${q(hash(D.admin.password))}, 'admin', ${NOW}, 1, 0)`,
  `UPDATE users SET pw = ${q(hash(D.admin.password))} WHERE username = ${T} AND pw = '!secret'`,
  `UPDATE users SET role = 'admin', class_id = NULL WHERE username = ${T}`,
  `INSERT OR IGNORE INTO classes (name, teacher_id, code, self_signup, created_at) SELECT ${q(D.class.name)}, id, ${q(D.class.code)}, 0, ${NOW} FROM users WHERE username = ${T} AND ${CLS} IS NULL`
].concat((D.students || []).map(s =>
  `INSERT OR IGNORE INTO users (username, pw, role, class_id, created_by, created_at, notice_ack, must_change) SELECT ${q(s.username)}, ${q(hash(s.password))}, 'student', ${CLS}, (SELECT id FROM users WHERE username = ${T}), ${NOW}, 0, 0 WHERE ${CLS} IS NOT NULL`));

fs.writeFileSync(out, '-- ERZEUGT von dev/seed.js aus ' + path.basename(src) + ' – NICHT einchecken.\n' + sql.map(s => s + ';').join('\n') + '\n');
console.log(path.relative(process.cwd(), out) + ' erzeugt (' + ((D.students || []).length + 1) + ' Konten, Klasse ' + D.class.name + ')');
