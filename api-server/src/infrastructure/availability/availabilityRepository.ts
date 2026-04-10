// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import type { TransactionClient } from '../prismaClient';
import prisma, { generateId } from '../prismaClient';

export interface AvailabilityRecord {
  participantId: string;
  slotKey: string;
}

export interface AvailabilityRepository {
  listAvailability(appointmentId: string): Promise<AvailabilityRecord[]>;
  listByParticipant(participantId: string): Promise<AvailabilityRecord[]>;
  replaceForParticipant(
    appointmentId: string,
    participantId: string,
    slotKeys: string[],
    submittedAt: Date,
    tx: TransactionClient
  ): Promise<void>;
}

type Queryable = Pick<TransactionClient, 'query'>;

function getClient(tx?: TransactionClient): Queryable {
  return tx ?? prisma;
}

export class PrismaAvailabilityRepository implements AvailabilityRepository {
  async listAvailability(appointmentId: string): Promise<AvailabilityRecord[]> {
    const result = await prisma.query<{
      participant_id: string;
      slot_key: string;
    }>(
      `
        SELECT participant_id, slot_key
        FROM slot_availability
        WHERE appointment_id = ?
        ORDER BY submitted_at ASC
      `,
      [appointmentId]
    );

    return result.rows.map((row) => ({
      participantId: row.participant_id,
      slotKey: row.slot_key
    }));
  }

  async listByParticipant(participantId: string): Promise<AvailabilityRecord[]> {
    const result = await prisma.query<{
      participant_id: string;
      slot_key: string;
    }>(
      `
        SELECT participant_id, slot_key
        FROM slot_availability
        WHERE participant_id = ?
        ORDER BY slot_key ASC
      `,
      [participantId]
    );

    return result.rows.map((row) => ({
      participantId: row.participant_id,
      slotKey: row.slot_key
    }));
  }

  async replaceForParticipant(
    appointmentId: string,
    participantId: string,
    slotKeys: string[],
    submittedAt: Date,
    tx: TransactionClient
  ): Promise<void> {
    const client = getClient(tx);
    await client.query(`DELETE FROM slot_availability WHERE participant_id = ?`, [participantId]);

    if (slotKeys.length === 0) {
      return;
    }

    const submittedAtStr = submittedAt.toISOString();
    const values: unknown[] = [];
    const placeholders = slotKeys
      .map((slotKey) => {
        values.push(generateId(), appointmentId, participantId, slotKey, submittedAtStr);
        return '(?, ?, ?, ?, ?)';
      })
      .join(', ');

    await client.query(
      `
        INSERT INTO slot_availability (id, appointment_id, participant_id, slot_key, submitted_at)
        VALUES ${placeholders}
      `,
      values
    );
  }
}
