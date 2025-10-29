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

async function seed(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      `INSERT INTO "TimeSlotTemplate" (id, name, description, "rulesetJson")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING;`,
      [
        'demo-default',
        'Demo Template',
        'Seeded demo template',
        JSON.stringify([
          { slotInstanceId: '2024-05-01_dinner', label: 'May 1st – Dinner' },
          { slotInstanceId: '2024-05-02_lunch', label: 'May 2nd – Lunch' }
        ])
      ]
    );

    await pool.query(
      `INSERT INTO "Appointment" (id, title, summary, "timeSlotTemplateId")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING;`,
      ['seed-appointment', 'Seeded Meal Planning', 'Coordinate dinner schedules', 'demo-default']
    );
  } finally {
    await pool.end();
  }
}

async function main() {
  const envArgIndex = process.argv.indexOf('--env');
  if (envArgIndex === -1 || !process.argv[envArgIndex + 1]) {
    throw new Error('Usage: tsx scripts/seed-database.ts --env <path-to-env-file>');
  }
  const envFile = process.argv[envArgIndex + 1];
  loadEnv(envFile);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set in the env file.');
  }

  await seed(databaseUrl);
  console.log(`Seeded data for ${databaseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
