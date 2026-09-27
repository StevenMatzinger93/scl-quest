// Test-Hilfe: erzeugt Seed-Daten mit Zufallsnamen (dev/seed.js) und spielt sie in die lokale D1 ein.
// Rückgabe: { admin, class, students, replay() } mit Klartext-Passwörtern – nur für den Test.
const { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
module.exports = function seedTestClass(run){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spsq-seed-'));
  const pw = () => Math.random().toString(36).slice(2, 10);
  const data = {
    admin: { username: 'adm_' + run, password: pw() },
    class: { name: 'Test ' + run, code: Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('') },
    students: [1, 2, 3].map(i => ({ username: 'sd' + i + '_' + run, password: pw() }))
  };
  const src = path.join(dir, 'seed.json'), out = path.join(dir, 'seed.sql');
  fs.writeFileSync(src, JSON.stringify(data));
  execFileSync('node', [path.join(root, 'seed.js'), src], { env: Object.assign({}, process.env, { SEED_OUT: out }), stdio: 'pipe' });
  const replay = () => execFileSync('npx', ['wrangler', 'd1', 'execute', 'spsquest', '-c', '../wrangler.jsonc', '--local', '--file=' + out], { cwd: root, stdio: 'pipe' });
  replay();
  process.on('exit', () => { try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){} });
  return Object.assign(data, { replay });
};
