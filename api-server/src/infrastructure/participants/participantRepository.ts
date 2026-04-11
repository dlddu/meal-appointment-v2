// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import type { TransactionClient } from '../prismaClient';
import prisma, { generateId } from '../prismaClient';

export interface ParticipantRecord {
  id: string;
  appointmentId: string;
  nickname: string;
  pinHash: string | null;
  submittedAt: Date | null;
}

export interface ParticipantRepository {
  listByAppointment(appointmentId: string): Promise<ParticipantRecord[]>;
  findByAppointmentAndNickname(appointmentId: string, nickname: string): Promise<ParticipantRecord | null>;
  findById(id: string): Promise<ParticipantRecord | null>;
  create(
    appointmentId: string,
    nickname: string,
    pinHash: string | null,
    tx: TransactionClient
  ): Promise<ParticipantRecord>;
  updateSubmittedAt(id: string, submittedAt: Date, tx: TransactionClient): Promise<void>;
}

type Queryable = Pick<TransactionClient, 'query'>;

function getClient(tx?: TransactionClient): Queryable {
  return tx ?? prisma;
}

function toParticipantRecord(row: {
  id: string;
  appointment_id: string;
  nickname: string;
  pin_hash: string | null;
  submitted_at: string | null;
}): ParticipantRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    nickname: row.nickname,
    pinHash: row.pin_hash,
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null
  };
}

type ParticipantRow = {
  id: string;
  appointment_id: string;
  nickname: string;
  pin_hash: string | null;
  submitted_at: string | null;
};

export class PrismaParticipantRepository implements ParticipantRepository {
  async listByAppointment(appointmentId: string): Promise<ParticipantRecord[]> {
    const result = await prisma.query<ParticipantRow>(
      `
        SELECT id, appointment_id, nickname, pin_hash, submitted_at
        FROM participants
        WHERE appointment_id = ?
        ORDER BY CASE WHEN submitted_at IS NULL THEN 1 ELSE 0 END, submitted_at ASC, created_at ASC
      `,
      [appointmentId]
    );

    return result.rows.map(toParticipantRecord);
  }

  async findByAppointmentAndNickname(appointmentId: string, nickname: string): Promise<ParticipantRecord | null> {
    const result = await prisma.query<ParticipantRow>(
      `
        SELECT id, appointment_id, nickname, pin_hash, submitted_at
        FROM participants
        WHERE appointment_id = ? AND nickname = ?
        LIMIT 1
      `,
      [appointmentId, nickname]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return toParticipantRecord(row);
  }

  async findById(id: string): Promise<ParticipantRecord | null> {
    const result = await prisma.query<ParticipantRow>(
      `
        SELECT id, appointment_id, nickname, pin_hash, submitted_at
        FROM participants
        WHERE id = ?
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return toParticipantRecord(row);
  }

  async create(
    appointmentId: string,
    nickname: string,
    pinHash: string | null,
    tx: TransactionClient
  ): Promise<ParticipantRecord> {
    const client = getClient(tx);
    const id = generateId();
    const now = new Date().toISOString();
    const result = await client.query<ParticipantRow>(
      `
        INSERT INTO participants (id, appointment_id, nickname, pin_hash, submitted_at, created_at)
        VALUES (?, ?, ?, ?, NULL, ?)
        RETURNING id, appointment_id, nickname, pin_hash, submitted_at
      `,
      [id, appointmentId, nickname, pinHash, now]
    );

    const row = result.rows[0];
    return toParticipantRecord(row);
  }

  async updateSubmittedAt(id: string, submittedAt: Date, tx: TransactionClient): Promise<void> {
    const client = getClient(tx);
    await client.query(
      `
        UPDATE participants
        SET submitted_at = ?
        WHERE id = ?
      `,
      [submittedAt.toISOString(), id]
    );
  }
}
