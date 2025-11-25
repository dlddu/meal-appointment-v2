// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import express from 'express';
import { z } from 'zod';
import type { JoinParticipantService } from '../application/participants/joinParticipant.service';
import type { SubmitResponsesService } from '../application/participants/submitResponses.service';
import {
  ApplicationError,
  InternalServerApplicationError,
  ValidationApplicationError
} from '../application/errors';
import { logger } from '../infrastructure/logger';
import type { AppointmentMetrics } from '../infrastructure/metrics/appointmentMetrics';

const nicknameSchema = z
  .coerce
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length >= 1 && value.length <= 30, {
    message: 'Nickname must be between 1 and 30 characters'
  });

const pinSchema = z
  .string()
  .trim()
  .min(4, { message: 'PIN must be at least 4 characters' })
  .max(12, { message: 'PIN must be at most 12 characters' })
  .optional();

const slotKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}#[A-Z]+$/, { message: 'Slot key must match YYYY-MM-DD#MEAL format' });

export const joinParticipantRequestSchema = z.object({
  nickname: nicknameSchema,
  pin: pinSchema
});

export const submitResponsesRequestSchema = z
  .object({
    nickname: nicknameSchema,
    pin: pinSchema,
    availableSlots: z.array(slotKeySchema)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const slot of value.availableSlots) {
      const normalized = slot.trim();
      if (seen.has(normalized)) {
        duplicates.push(normalized);
      }
      seen.add(normalized);
    }
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate slots are not allowed',
        path: ['availableSlots']
      });
    }
  });

export interface ParticipationRouterDependencies {
  joinParticipantService: JoinParticipantService;
  submitResponsesService: SubmitResponsesService;
}

export function createParticipationRouter({
  joinParticipantService,
  submitResponsesService
}: ParticipationRouterDependencies): express.Router {
  const router = express.Router({ mergeParams: true });
  const joinRouteLabel = 'POST /api/appointments/:appointmentId/participants';
  const responseRouteLabel =
    'PUT /api/appointments/:appointmentId/participants/:participantId/responses';

  router.post('/:appointmentId/participants', async (req, res, next) => {
    try {
      const parseResult = joinParticipantRequestSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message
        }));
        logger.warn({ event: 'participant.validation_failed', errors, requestId: res.locals.requestId });
        throw new ValidationApplicationError(errors);
      }

      const payload = parseResult.data;
      const result = await joinParticipantService.execute(
        {
          appointmentId: req.params.appointmentId,
          nickname: payload.nickname,
          pin: payload.pin
        },
        { requestId: res.locals.requestId }
      );

      (req.app.locals.metrics as AppointmentMetrics | undefined)?.recordHttpRequest(joinRouteLabel, 200);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        (req.app.locals.metrics as AppointmentMetrics | undefined)?.recordHttpRequest(
          joinRouteLabel,
          error.statusCode
        );
        next(error);
        return;
      }
      (req.app.locals.metrics as AppointmentMetrics | undefined)?.recordHttpRequest(joinRouteLabel, 500);
      next(new InternalServerApplicationError());
    }
  });

  router.put('/:appointmentId/participants/:participantId/responses', async (req, res, next) => {
    try {
      const parseResult = submitResponsesRequestSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message
        }));
        logger.warn({ event: 'participant.validation_failed', errors, requestId: res.locals.requestId });
        throw new ValidationApplicationError(errors);
      }

      const payload = parseResult.data;
      const normalizedSlots = payload.availableSlots.map((slot) => slot.trim());

      const result = await submitResponsesService.execute(
        {
          appointmentId: req.params.appointmentId,
          participantId: req.params.participantId,
          nickname: payload.nickname,
          pin: payload.pin,
          availableSlots: normalizedSlots
        },
        { requestId: res.locals.requestId }
      );

      (req.app.locals.metrics as AppointmentMetrics | undefined)?.recordHttpRequest(
        responseRouteLabel,
        200
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        (req.app.locals.metrics as AppointmentMetrics | undefined)?.recordHttpRequest(
          responseRouteLabel,
          error.statusCode
        );
        next(error);
        return;
      }
      (req.app.locals.metrics as AppointmentMetrics | undefined)?.recordHttpRequest(
        responseRouteLabel,
        500
      );
      next(new InternalServerApplicationError());
    }
  });

  return router;
}

export default createParticipationRouter;
