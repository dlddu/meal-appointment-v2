import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

class PrismaLikeClient {
  private pool: pg.Pool;

  constructor(url: string) {
    this.pool = new Pool({ connectionString: url });
  }

  async $connect() {
    await this.pool.query('SELECT 1');
  }

  async $disconnect() {
    await this.pool.end();
  }

  async $queryRaw(queryParts: TemplateStringsArray, ...values: unknown[]) {
    const text = queryParts.reduce((acc, part, index) => acc + part + (index < values.length ? `$${index + 1}` : ''), '');
    return this.pool.query(text, values as unknown[]);
  }

  async query(text: string, params?: unknown[]) {
    return this.pool.query(text, params as unknown[] | undefined);
  }
}

const prisma = new PrismaLikeClient(connectionString);

export default prisma;
