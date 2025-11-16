// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import prisma from '../prismaClient';

export interface AvailabilityRecord {
  participantId: string;
  slotKey: string;
}

export interface AvailabilityRepository {
  listAvailability(appointmentId: string): Promise<AvailabilityRecord[]>;
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
        WHERE appointment_id = $1
        ORDER BY submitted_at ASC
      `,
      [appointmentId]
    );

    return result.rows.map((row) => ({
      participantId: row.participant_id,
      slotKey: row.slot_key
    }));
  }
}
