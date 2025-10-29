import pg from 'pg';
import { demoTemplate } from '../src/domain/templateEngine';

const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `INSERT INTO "TimeSlotTemplate" (id, name, description, "rulesetJson")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING;`,
      [demoTemplate.id, demoTemplate.name, 'Seeded demo template', JSON.stringify(demoTemplate.rules)]
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
