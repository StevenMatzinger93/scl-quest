// SPS Quest — Datenbankschema (D1). Tabellen legt der Code selbst an:
// jede Migration läuft genau einmal und wird in der Tabelle "migrations" vermerkt.
const MIGRATIONS = [
  { id: 1, name: 'konten-klassen-fortschritt', sql: [
    `CREATE TABLE IF NOT EXISTS users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       username TEXT NOT NULL UNIQUE COLLATE NOCASE,
       pw TEXT NOT NULL,
       role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
       class_id INTEGER,
       created_by INTEGER,
       created_at INTEGER NOT NULL,
       last_login INTEGER,
       notice_ack INTEGER NOT NULL DEFAULT 0,
       must_change INTEGER NOT NULL DEFAULT 0
     )`,
    `CREATE INDEX IF NOT EXISTS users_class ON users(class_id)`,
    `CREATE TABLE IF NOT EXISTS classes (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       teacher_id INTEGER NOT NULL,
       code TEXT NOT NULL UNIQUE,
       self_signup INTEGER NOT NULL DEFAULT 1,
       created_at INTEGER NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS classes_teacher ON classes(teacher_id)`,
    `CREATE TABLE IF NOT EXISTS sessions (
       id TEXT PRIMARY KEY,
       user_id INTEGER NOT NULL,
       created_at INTEGER NOT NULL,
       expires INTEGER NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
    `CREATE TABLE IF NOT EXISTS progress (
       user_id INTEGER NOT NULL,
       quest TEXT NOT NULL,
       state TEXT NOT NULL,
       summary TEXT,
       updated_at INTEGER NOT NULL,
       PRIMARY KEY (user_id, quest)
     )`,
    `CREATE TABLE IF NOT EXISTS attempts (
       k TEXT PRIMARY KEY,
       n INTEGER NOT NULL,
       first INTEGER NOT NULL,
       until INTEGER NOT NULL DEFAULT 0
     )`
  ]},
  { id: 2, name: 'live-challenge', sql: [
    `CREATE TABLE IF NOT EXISTS challenges (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       code TEXT NOT NULL,
       teacher_id INTEGER NOT NULL,
       class_id INTEGER,
       quest TEXT NOT NULL,
       mode TEXT NOT NULL,
       task_id TEXT NOT NULL,
       bug_id TEXT,
       title TEXT,
       duration INTEGER NOT NULL,
       state TEXT NOT NULL,
       created_at INTEGER NOT NULL,
       started_at INTEGER,
       ends_at INTEGER,
       ended_at INTEGER,
       show_uid INTEGER
     )`,
    `CREATE INDEX IF NOT EXISTS challenges_code ON challenges(code, state)`,
    `CREATE INDEX IF NOT EXISTS challenges_teacher ON challenges(teacher_id)`,
    `CREATE TABLE IF NOT EXISTS challenge_players (
       challenge_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       username TEXT NOT NULL,
       joined_at INTEGER NOT NULL,
       attempts INTEGER NOT NULL DEFAULT 0,
       hints INTEGER NOT NULL DEFAULT 0,
       solved_at INTEGER,
       points INTEGER NOT NULL DEFAULT 0,
       code TEXT,
       last_at INTEGER,
       PRIMARY KEY (challenge_id, user_id)
     )`,
    `CREATE INDEX IF NOT EXISTS challenge_players_user ON challenge_players(user_id)`
  ]}
];
export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].id;

let ready = null;   // pro Isolate nur einmal prüfen
export function ensureSchema(db){
  if(!ready) ready = migrate(db).catch(e => { ready = null; throw e; });
  return ready;
}
async function migrate(db){
  await db.prepare('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)').run();
  const done = new Set(((await db.prepare('SELECT id FROM migrations').all()).results || []).map(r => r.id));
  for(const m of MIGRATIONS){
    if(done.has(m.id)) continue;
    const stmts = m.sql.map(s => db.prepare(s));
    stmts.push(db.prepare('INSERT OR IGNORE INTO migrations (id, name, applied_at) VALUES (?, ?, ?)').bind(m.id, m.name, Date.now()));
    await db.batch(stmts);
  }
}
// Nur für Tests: erzwingt eine erneute Prüfung
export function resetSchemaCache(){ ready = null; }
export { MIGRATIONS };
