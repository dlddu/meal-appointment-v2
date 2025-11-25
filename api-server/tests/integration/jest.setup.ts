import path from 'node:path';
import { config } from 'dotenv';

// Only load .env.test and require DATABASE_URL for integration tests
// Unit tests don't need database connection
// Check if we're running integration tests by looking at the test path pattern
const isIntegrationTest = process.argv.some(arg => arg.includes('integration'));

if (isIntegrationTest) {
  config({ path: path.resolve(process.cwd(), '.env.test') });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for integration tests');
  }
}
