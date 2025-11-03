// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

import express from 'express';
import { z } from 'zod';
import type { CreateAppointmentService } from '../application/appointments/createAppointment.service';
import type { ActiveTemplateService } from '../application/appointments/activeTemplateService';
import {
  ValidationApplicationError,
  InternalServerApplicationError,
  ApplicationError
} from '../application/errors';

export interface CreateAppointmentRouterDependencies {
  createAppointmentService: CreateAppointmentService;
  activeTemplateService: ActiveTemplateService;
}

export const createAppointmentRequestSchema = z.object({
  title: z
    .coerce
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length >= 1 && value.length <= 60, {
      message: 'Title must be between 1 and 60 characters'
    }),
  summary: z
    .coerce
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= 200, {
      message: 'Summary must be 200 characters or fewer'
    })
    .optional()
    .default(''),
  timeSlotTemplateId: z
    .coerce
    .string()
    .transform((value) => value.trim())
});

export function createAppointmentsRouter({
  createAppointmentService,
  activeTemplateService
}: CreateAppointmentRouterDependencies): express.Router {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const parseResult = createAppointmentRequestSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message
        }));
        throw new ValidationApplicationError(errors);
      }

      const payload = parseResult.data;
      await activeTemplateService.ensureTemplateIsActive(payload.timeSlotTemplateId);

      const result = await createAppointmentService.execute(payload, {
        requestId: res.locals.requestId as string | undefined
      });

      res.status(201).json({
        appointmentId: result.appointmentId,
        shareUrl: result.shareUrl,
        title: result.title,
        summary: result.summary,
        timeSlotTemplateId: result.timeSlotTemplateId,
        createdAt: result.createdAt.toISOString()
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        next(error);
        return;
      }
      next(new InternalServerApplicationError());
    }
  });

  return router;
}

export default createAppointmentsRouter;
