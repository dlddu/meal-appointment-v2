import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env.test') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set for integration tests');
}
