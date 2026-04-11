// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import type { TransactionClient } from '../prismaClient';
import prisma, { generateId } from '../prismaClient';

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
    const now = new Date().toISOString();
    const id = generateId();
    const result = await tx.query<{
      id: string;
      title: string;
      summary: string;
      time_slot_template_id: string;
      created_at: string;
      updated_at: string;
    }>(
      `
        INSERT INTO appointments (id, title, summary, time_slot_template_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id, title, summary, time_slot_template_id, created_at, updated_at
      `,
      [id, input.title, input.summary, input.timeSlotTemplateId, now, now]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      timeSlotTemplateId: row.time_slot_template_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async findById(id: string): Promise<AppointmentRecord | null> {
    const result = await prisma.query<{
      id: string;
      title: string;
      summary: string;
      time_slot_template_id: string;
      created_at: string;
      updated_at: string;
    }>(
      `
        SELECT id, title, summary, time_slot_template_id, created_at, updated_at
        FROM appointments
        WHERE id = ?
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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
