import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

export interface TransactionClient {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
}

class PoolTransactionClient implements TransactionClient {
  constructor(private readonly client: pg.PoolClient) {}

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
    return this.client.query<T>(text, params as unknown[] | undefined);
  }
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

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
    return this.pool.query<T>(text, params as unknown[] | undefined);
  }

  async $transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx = new PoolTransactionClient(client);
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const prisma = new PrismaLikeClient(connectionString);

export default prisma;
