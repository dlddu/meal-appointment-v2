// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import prisma from '../prismaClient';

export interface ParticipantRecord {
  id: string;
  nickname: string;
  submittedAt: Date | null;
}

export interface ParticipantRepository {
  listByAppointment(appointmentId: string): Promise<ParticipantRecord[]>;
}

export class PrismaParticipantRepository implements ParticipantRepository {
  async listByAppointment(appointmentId: string): Promise<ParticipantRecord[]> {
    const result = await prisma.query<{
      id: string;
      nickname: string;
      submitted_at: Date | null;
    }>(
      `
        SELECT id, nickname, submitted_at
        FROM participants
        WHERE appointment_id = $1
        ORDER BY submitted_at ASC NULLS LAST, created_at ASC
      `,
      [appointmentId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      submittedAt: row.submitted_at
    }));
  }
}
