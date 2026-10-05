const fs = require('fs');
const path = require('path');
const { exec, query, run } = require('../db');

async function runMigrations(customDb = null) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await exec(sql, customDb);

  // Safe progressive schema alterations for existing databases
  const safeAlter = async (table, columnDef) => {
    try {
      await exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`, customDb);
    } catch (e) {
      // Ignore "duplicate column name" errors
    }
  };

  await safeAlter('harvests', 'target_amount INTEGER DEFAULT 0');
  await safeAlter('harvest_sessions', 'is_default INTEGER DEFAULT 0');
  await safeAlter('transactions', 'original_amount INTEGER');
  await safeAlter('transactions', 'edit_reason TEXT');

  console.log('Database schema migrations applied successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
