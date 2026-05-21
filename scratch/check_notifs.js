const { getDb } = require('../server/db/database');
const db = getDb();
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables and row counts:');
  for (const t of tables) {
    const countRes = db.prepare(`SELECT count(*) as count FROM ${t.name}`).get();
    console.log(`- ${t.name}: ${countRes.count}`);
  }
} catch (e) {
  console.error(e);
}
