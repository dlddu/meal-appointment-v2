// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import { z } from 'zod';
import prisma from '../prismaClient';

export class TemplateParsingError extends Error {
  constructor() {
    super('Template ruleset parsing failed');
  }
}

const templateRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        dayPattern: z.string(),
        mealTypes: z.array(z.string())
      })
    )
    .default([]),
  slots: z
    .array(
      z.object({
        slotKey: z.string(),
        date: z.string(),
        mealType: z.string()
      })
    )
    .default([])
});

export type TemplateRule = z.infer<typeof templateRulesSchema>['rules'][number];
export type TemplateSlot = z.infer<typeof templateRulesSchema>['slots'][number];

export interface TemplateRecord {
  id: string;
  name: string;
  description: string | null;
  rules: TemplateRule[];
  slots: TemplateSlot[];
}

export interface TemplateRepository {
  findById(id: string): Promise<TemplateRecord | null>;
}

export class PrismaTemplateRepository implements TemplateRepository {
  async findById(id: string): Promise<TemplateRecord | null> {
    const result = await prisma.query<{
      id: string;
      name: string;
      description: string | null;
      ruleset_json: unknown;
    }>(
      `
        SELECT id, name, description, ruleset_json
        FROM time_slot_templates
        WHERE id = $1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const parsed = templateRulesSchema.safeParse(row.ruleset_json);
    if (!parsed.success) {
      throw new TemplateParsingError();
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      rules: parsed.data.rules,
      slots: parsed.data.slots
    };
  }
}
