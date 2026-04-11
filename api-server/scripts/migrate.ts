import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const dbPath = databaseUrl.replace(/^file:/, '');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrationSql = fs.readFileSync(
  path.join(__dirname, '../prisma/migrations/0001_init/migration.sql'),
  'utf-8'
);

db.exec(migrationSql);
console.log(`[migrate] SQLite database initialized at ${dbPath}`);

db.close();
