import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

function loadEnv(envFile: string) {
  const fullPath = path.resolve(envFile);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing env file: ${fullPath}`);
  }
  dotenv.config({ path: fullPath });
}

async function applyMigrations(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`
      DROP TABLE IF EXISTS "SlotAvailability" CASCADE;
      DROP TABLE IF EXISTS "Participant" CASCADE;
      DROP TABLE IF EXISTS "Appointment" CASCADE;
      DROP TABLE IF EXISTS "TimeSlotTemplate" CASCADE;
      DROP TABLE IF EXISTS "slot_availability" CASCADE;
      DROP TABLE IF EXISTS "participants" CASCADE;
      DROP TABLE IF EXISTS "appointments" CASCADE;
      DROP TABLE IF EXISTS "time_slot_templates" CASCADE;
    `);
    const migrationsDir = path.resolve('prisma/migrations');
    const directories = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const dir of directories) {
      const migrationFile = path.join(migrationsDir, dir, 'migration.sql');
      const sql = fs.readFileSync(migrationFile, 'utf8');
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const envArgIndex = process.argv.indexOf('--env');
  if (envArgIndex === -1 || !process.argv[envArgIndex + 1]) {
    throw new Error('Usage: tsx scripts/apply-migrations.ts --env <path-to-env-file>');
  }
  const envFile = process.argv[envArgIndex + 1];
  loadEnv(envFile);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set in the env file.');
  }

  await applyMigrations(databaseUrl);
  console.log(`Applied SQL migrations for ${databaseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
