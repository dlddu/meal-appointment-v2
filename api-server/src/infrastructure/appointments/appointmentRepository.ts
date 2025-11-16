// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import type { TransactionClient } from '../prismaClient';
import prisma from '../prismaClient';

export interface AppointmentRecord {
  id: string;
  title: string;
  summary: string;
  timeSlotTemplateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentRecordInput {
  title: string;
  summary: string;
  timeSlotTemplateId: string;
}

export interface AppointmentRepository {
  create(input: CreateAppointmentRecordInput, tx: TransactionClient): Promise<AppointmentRecord>;
  findById(id: string): Promise<AppointmentRecord | null>;
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  async create(input: CreateAppointmentRecordInput, tx: TransactionClient): Promise<AppointmentRecord> {
    const result = await tx.query<{
      id: string;
      title: string;
      summary: string;
      time_slot_template_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        INSERT INTO appointments (title, summary, time_slot_template_id)
        VALUES ($1, $2, $3)
        RETURNING id, title, summary, time_slot_template_id, created_at, updated_at
      `,
      [input.title, input.summary, input.timeSlotTemplateId]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      timeSlotTemplateId: row.time_slot_template_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findById(id: string): Promise<AppointmentRecord | null> {
    const result = await prisma.query<{
      id: string;
      title: string;
      summary: string;
      time_slot_template_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, title, summary, time_slot_template_id, created_at, updated_at
        FROM appointments
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
      title: row.title,
      summary: row.summary,
      timeSlotTemplateId: row.time_slot_template_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
