// SPS Quest — Seed-Daten: Testklasse SPS2026 (Admin "steven" als Dozent + 5 Lernende).
// Erzeugt worker/seed.js (läuft im Worker einmalig als Migration 5) und worker/seed.sql (von Hand ausführbar).
//
//   node seed.js            → Dateien neu erzeugen (neue Salts, gleiche Passwörter)
//   npx wrangler d1 execute spsquest --remote --file=../worker/seed.sql   → optional von Hand gegen D1
//
// Idempotent: INSERT OR IGNORE bzw. WHERE NOT EXISTS – mehrfaches Ausführen erzeugt keine Duplikate.
//
// ⚠ SICHERHEIT: Passwort = Vorname ist nur für die Testklasse tragbar. Steven ändert sein Admin-Passwort
//   nach dem ersten Login (Portal → Konto → Passwort ändern). Die Lernenden-Passwörter vor dem echten
//   Einsatz im Leitstand zurücksetzen (Knopf „Passwort“) oder die Konten löschen.
//   Ausnahme von „nur Pseudonyme“ (ENTSCHEIDUNGEN.md) – ausdrücklich von Steven so gewünscht.
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const TEACHER = { username: 'steven', password: 'steven' };
const CLASS = { name: 'SPS2026', code: 'SPSQ26' };   // Klassencode fest, Selbstanmeldung geschlossen
const STUDENTS = ['Noel', 'Eric', 'Eliah', 'Alicia', 'Finn'];   // Passwort = Vorname

// gleiches Format wie worker/lib.js hashPassword(): pbkdf2$<iter>$<salt b64>$<hash b64>, SHA-256, 32 Byte
const ITER = 100000;
function hash(pw){
  const salt = crypto.randomBytes(16);
  return 'pbkdf2$' + ITER + '$' + salt.toString('base64') + '$' + crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256').toString('base64');
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const NOW = "CAST(strftime('%s','now') AS INTEGER) * 1000";
const T = q(TEACHER.username), CLS = `(SELECT c.id FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.name = ${q(CLASS.name)} AND u.username = ${T} LIMIT 1)`;

const sql = [
  // Konto steven: Admin und zugleich Dozent der Klasse (ein einziges Konto)
  `INSERT OR IGNORE INTO users (username, pw, role, created_at, notice_ack, must_change) VALUES (${T}, ${q(hash(TEACHER.password))}, 'admin', ${NOW}, 1, 0)`,
  // falls "steven" schon als Admin aus den Secrets (ADMIN_USER) angelegt war: Passwort-Hash nachtragen, Rolle Admin
  `UPDATE users SET pw = ${q(hash(TEACHER.password))} WHERE username = ${T} AND pw = '!secret'`,
  `UPDATE users SET role = 'admin', class_id = NULL WHERE username = ${T}`,
  `INSERT OR IGNORE INTO classes (name, teacher_id, code, self_signup, created_at)
     SELECT ${q(CLASS.name)}, id, ${q(CLASS.code)}, 0, ${NOW} FROM users WHERE username = ${T} AND ${CLS} IS NULL`
].concat(STUDENTS.map(n =>
  `INSERT OR IGNORE INTO users (username, pw, role, class_id, created_by, created_at, notice_ack, must_change)
     SELECT ${q(n)}, ${q(hash(n))}, 'student', ${CLS}, (SELECT id FROM users WHERE username = ${T}), ${NOW}, 0, 0 WHERE ${CLS} IS NOT NULL`));

const HEAD = '// Testklasse SPS2026 — ERZEUGT von dev/seed.js, nicht von Hand ändern.\n' +
  '// ⚠ Passwort = Vorname (nur Testklasse). steven: Admin-Passwort nach dem ersten Login ändern.\n';
const W = path.join(__dirname, '..', 'worker');
fs.writeFileSync(path.join(W, 'seed.js'), HEAD + 'export const SEED_SPS2026 = ' + JSON.stringify(sql, null, 2) + ';\n');
fs.writeFileSync(path.join(W, 'seed.sql'), HEAD.replace(/\/\//g, '--') +
  '-- Ausführen (optional, der Worker legt die Daten beim ersten Aufruf selbst an):\n--   npx wrangler d1 execute spsquest --remote --file=worker/seed.sql\n' +
  sql.map(s => s.replace(/\s+/g, ' ') + ';').join('\n') + '\n');
console.log('worker/seed.js + worker/seed.sql erzeugt (' + (STUDENTS.length + 1) + ' Konten, Klasse ' + CLASS.name + ')');
