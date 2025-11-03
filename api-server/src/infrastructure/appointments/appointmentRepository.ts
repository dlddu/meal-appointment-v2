// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

import type { TransactionClient } from '../prismaClient';

export interface AppointmentRecord {
  id: string;
  title: string;
  summary: string;
  timeSlotTemplateId: string;
  createdAt: Date;
}

export interface CreateAppointmentRecordInput {
  title: string;
  summary: string;
  timeSlotTemplateId: string;
}

export interface AppointmentRepository {
  create(input: CreateAppointmentRecordInput, tx: TransactionClient): Promise<AppointmentRecord>;
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  async create(input: CreateAppointmentRecordInput, tx: TransactionClient): Promise<AppointmentRecord> {
    const result = await tx.query<{
      id: string;
      title: string;
      summary: string;
      time_slot_template_id: string;
      created_at: Date;
    }>(
      `
        INSERT INTO appointments (title, summary, time_slot_template_id)
        VALUES ($1, $2, $3)
        RETURNING id, title, summary, time_slot_template_id, created_at
      `,
      [input.title, input.summary, input.timeSlotTemplateId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      timeSlotTemplateId: row.time_slot_template_id,
      createdAt: row.created_at
    };
  }
}
