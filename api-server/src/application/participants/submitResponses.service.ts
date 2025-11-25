// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

import bcrypt from 'bcryptjs';
import type { Logger } from 'pino';
import type { AppointmentRepository } from '../../infrastructure/appointments/appointmentRepository';
import type { ParticipantRepository } from '../../infrastructure/participants/participantRepository';
import type { AvailabilityRepository } from '../../infrastructure/availability/availabilityRepository';
import type { AppointmentMetrics } from '../../infrastructure/metrics/appointmentMetrics';
import type { TransactionClient } from '../../infrastructure/prismaClient';
import { AvailabilityAggregator } from '../../domain/availabilityAggregator';
import { compareSlotKeys, splitSlotKey } from '../../domain/slotKey';
import {
  ApplicationError,
  AppointmentNotFoundApplicationError,
  InvalidPinApplicationError,
  InvalidSlotApplicationError,
  ParticipantMismatchApplicationError,
  ServiceUnavailableApplicationError
} from '../errors';
import { TimeSlotTemplateService } from './timeSlotTemplate.service';

export interface SubmitResponsesInput {
  appointmentId: string;
  participantId: string;
  nickname: string;
  pin?: string;
  availableSlots: string[];
}

export interface SubmitResponsesContext {
  requestId?: string;
}

export interface SubmitResponsesResult {
  participantId: string;
  submittedAt: string;
  selected: string[];
  summary: {
    participantCount: number;
    slotSummaries: Array<{
      slotKey: string;
      date: string;
      mealType: string;
      availableCount: number;
      availabilityRatio: number;
    }>;
  };
}

interface DatabaseClient {
  $transaction<T>(handler: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export class SubmitResponsesService {
  private readonly aggregator = new AvailabilityAggregator();

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly participantRepository: ParticipantRepository,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly templateService: TimeSlotTemplateService,
    private readonly metrics: AppointmentMetrics,
    private readonly logger: Logger,
    private readonly database: DatabaseClient
  ) {}

  async execute(input: SubmitResponsesInput, context: SubmitResponsesContext): Promise<SubmitResponsesResult> {
    const start = Date.now();
    try {
      const appointment = await this.appointmentRepository.findById(input.appointmentId);
      if (!appointment) {
        throw new AppointmentNotFoundApplicationError();
      }

      const participant = await this.participantRepository.findById(input.participantId);
      if (!participant || participant.appointmentId !== appointment.id || participant.nickname !== input.nickname) {
        throw new ParticipantMismatchApplicationError();
      }

      if (participant.pinHash) {
        if (!input.pin || !(await bcrypt.compare(input.pin, participant.pinHash))) {
          this.logger.warn(
            {
              event: 'participant.pin_invalid',
              appointmentId: input.appointmentId,
              participantId: input.participantId,
              requestId: context.requestId
            },
            'PIN validation failed'
          );
          throw new InvalidPinApplicationError();
        }
      }

      const dedupedSlots = Array.from(new Set(input.availableSlots));
      const validator = await this.templateService.buildValidator(appointment.timeSlotTemplateId, {
        requestId: context.requestId
      });
      const invalidSlots = dedupedSlots.filter((slot) => !validator.isValid(slot));
      if (invalidSlots.length > 0) {
        this.logger.warn(
          {
            event: 'participant.slot_invalid',
            appointmentId: input.appointmentId,
            participantId: input.participantId,
            invalidSlots,
            requestId: context.requestId
          },
          'Slot validation failed'
        );
        throw new InvalidSlotApplicationError(invalidSlots);
      }

      const submittedAt = new Date();
      await this.database.$transaction(async (tx) => {
        await this.availabilityRepository.replaceForParticipant(
          appointment.id,
          participant.id,
          dedupedSlots,
          submittedAt,
          tx
        );
        await this.participantRepository.updateSubmittedAt(participant.id, submittedAt, tx);
      });

      const [participants, availability] = await Promise.all([
        this.participantRepository.listByAppointment(appointment.id),
        this.availabilityRepository.listAvailability(appointment.id)
      ]);

      const aggregation = this.aggregator.aggregate(availability);
      const participantCount = participants.length;
      const slotSummaries = Array.from(aggregation.availableCountBySlotKey.entries())
        .sort(([slotA], [slotB]) => compareSlotKeys(slotA, slotB))
        .map(([slotKey, availableCount]) => {
          const [date, mealType] = splitSlotKey(slotKey);
          const ratio = participantCount === 0 ? 0 : Math.round((availableCount / participantCount) * 100) / 100;
          return {
            slotKey,
            date,
            mealType,
            availableCount,
            availabilityRatio: ratio
          };
        });

      this.logger.info(
        {
          event: 'participant.responses.submitted',
          appointmentId: appointment.id,
          participantId: participant.id,
          slotCount: dedupedSlots.length,
          durationMs: Date.now() - start,
          requestId: context.requestId
        },
        'Participant responses submitted'
      );
      this.logger.debug(
        {
          event: 'participant.responses.summary',
          appointmentId: appointment.id,
          participantId: participant.id,
          summary: { participantCount, slotSummaries },
          requestId: context.requestId
        },
        'Participant response summary calculated'
      );

      return {
        participantId: participant.id,
        submittedAt: submittedAt.toISOString(),
        selected: dedupedSlots,
        summary: {
          participantCount,
          slotSummaries
        }
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      this.logger.error(
        {
          event: 'participant.responses.failed',
          appointmentId: input.appointmentId,
          participantId: input.participantId,
          requestId: context.requestId,
          err: error
        },
        'Failed to submit responses'
      );
      throw new ServiceUnavailableApplicationError();
    } finally {
      this.metrics.observeResponseSubmission(Date.now() - start, input.availableSlots.length);
    }
  }
}
