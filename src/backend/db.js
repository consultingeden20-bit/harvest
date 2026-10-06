const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

function resolveDbPath() {
  let targetPath = process.env.DB_PATH;

  // 1. Try environment DB_PATH if provided
  if (targetPath) {
    try {
      const dir = path.isAbsolute(targetPath) ? path.dirname(targetPath) : path.dirname(path.resolve(process.cwd(), targetPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
    } catch (e) {
      console.warn(`Configured DB_PATH "${targetPath}" is not writable (${e.message}). Switching to project data directory.`);
    }
  }

  // 2. Project local data directory
  try {
    const localDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'harvest.sqlite');
  } catch (e) {
    console.warn(`Project data directory is not writable (${e.message}). Switching to temp directory.`);
  }

  // 3. System temp directory (guaranteed writable on Render, Linux, Docker, Windows)
  const tmpDir = path.join(os.tmpdir(), 'pc_bastos_harvest_data');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return path.join(tmpDir, 'harvest.sqlite');
}

const DB_PATH = resolveDbPath();
console.log(`Using SQLite Database path: ${DB_PATH}`);

let dbInstance = null;

function getDb(customPath = null) {
  if (customPath) {
    const db = new sqlite3.Database(customPath);
    db.run('PRAGMA foreign_keys = ON;');
    return db;
  }
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite database:', err);
      } else {
        console.log(`Connected to SQLite database at ${DB_PATH}`);
      }
    });
    dbInstance.run('PRAGMA foreign_keys = ON;');
    dbInstance.run('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}

function query(sql, params = [], customDb = null) {
  const db = customDb || getDb();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = [], customDb = null) {
  const db = customDb || getDb();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function run(sql, params = [], customDb = null) {
  const db = customDb || getDb();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function exec(sql, customDb = null) {
  const db = customDb || getDb();
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = {
  getDb,
  query,
  get,
  run,
  exec,
  DB_PATH
};
