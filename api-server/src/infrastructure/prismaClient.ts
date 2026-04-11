import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface TransactionClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

class SQLiteTransactionClient implements TransactionClient {
  constructor(private readonly db: Database.Database) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return executeQuery<T>(this.db, text, params);
  }
}

function executeQuery<T>(db: Database.Database, text: string, params?: unknown[]): QueryResult<T> {
  const trimmed = text.trim().toUpperCase();
  const isRead = trimmed.startsWith('SELECT') || trimmed.includes('RETURNING');

  if (isRead) {
    const stmt = db.prepare(text);
    const rows = stmt.all(...(params ?? [])) as T[];
    return { rows, rowCount: rows.length };
  } else {
    const stmt = db.prepare(text);
    const info = stmt.run(...(params ?? []));
    return { rows: [] as T[], rowCount: info.changes };
  }
}

class PrismaLikeClient {
  private db: Database.Database | null = null;

  private getDb(): Database.Database {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set.');
    }
    if (!this.db) {
      const dbPath = databaseUrl.replace(/^file:/, '');
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('busy_timeout = 5000');
    }
    return this.db;
  }

  async $connect() {
    const db = this.getDb();
    db.exec('SELECT 1');
  }

  async $disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async $queryRaw(queryParts: TemplateStringsArray, ...values: unknown[]) {
    const text = queryParts.join('?');
    return this.query(text, values);
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return executeQuery<T>(this.getDb(), text, params);
  }

  async $transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    const db = this.getDb();
    db.exec('BEGIN');
    try {
      const tx = new SQLiteTransactionClient(db);
      const result = await callback(tx);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function generateId(): string {
  return randomUUID();
}

const prisma = new PrismaLikeClient();

export default prisma;
