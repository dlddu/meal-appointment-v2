// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import type { TransactionClient } from '../prismaClient';
import prisma from '../prismaClient';

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

export class PrismaParticipantRepository implements ParticipantRepository {
  async listByAppointment(appointmentId: string): Promise<ParticipantRecord[]> {
    const result = await prisma.query<{
      id: string;
      appointment_id: string;
      nickname: string;
      pin_hash: string | null;
      submitted_at: Date | null;
    }>(
      `
        SELECT id, appointment_id, nickname, pin_hash, submitted_at
        FROM participants
        WHERE appointment_id = $1
        ORDER BY submitted_at DESC NULLS LAST, created_at DESC
      `,
      [appointmentId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      nickname: row.nickname,
      pinHash: row.pin_hash,
      submittedAt: row.submitted_at
    }));
  }

  async findByAppointmentAndNickname(appointmentId: string, nickname: string): Promise<ParticipantRecord | null> {
    const result = await prisma.query<{
      id: string;
      appointment_id: string;
      nickname: string;
      pin_hash: string | null;
      submitted_at: Date | null;
    }>(
      `
        SELECT id, appointment_id, nickname, pin_hash, submitted_at
        FROM participants
        WHERE appointment_id = $1 AND nickname = $2
        LIMIT 1
      `,
      [appointmentId, nickname]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      appointmentId: row.appointment_id,
      nickname: row.nickname,
      pinHash: row.pin_hash,
      submittedAt: row.submitted_at
    };
  }

  async findById(id: string): Promise<ParticipantRecord | null> {
    const result = await prisma.query<{
      id: string;
      appointment_id: string;
      nickname: string;
      pin_hash: string | null;
      submitted_at: Date | null;
    }>(
      `
        SELECT id, appointment_id, nickname, pin_hash, submitted_at
        FROM participants
        WHERE id = $1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      appointmentId: row.appointment_id,
      nickname: row.nickname,
      pinHash: row.pin_hash,
      submittedAt: row.submitted_at
    };
  }

  async create(
    appointmentId: string,
    nickname: string,
    pinHash: string | null,
    tx: TransactionClient
  ): Promise<ParticipantRecord> {
    const client = getClient(tx);
    const result = await client.query<{
      id: string;
      appointment_id: string;
      nickname: string;
      pin_hash: string | null;
      submitted_at: Date | null;
    }>(
      `
        INSERT INTO participants (appointment_id, nickname, pin_hash, submitted_at)
        VALUES ($1, $2, $3, NULL)
        RETURNING id, appointment_id, nickname, pin_hash, submitted_at
      `,
      [appointmentId, nickname, pinHash]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      nickname: row.nickname,
      pinHash: row.pin_hash,
      submittedAt: row.submitted_at
    };
  }

  async updateSubmittedAt(id: string, submittedAt: Date, tx: TransactionClient): Promise<void> {
    const client = getClient(tx);
    await client.query(
      `
        UPDATE participants
        SET submitted_at = $2
        WHERE id = $1
      `,
      [id, submittedAt]
    );
  }
}
