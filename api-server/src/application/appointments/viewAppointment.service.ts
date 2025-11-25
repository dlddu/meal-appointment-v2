// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

import type { Logger } from 'pino';
import type { AppointmentRecord, AppointmentRepository } from '../../infrastructure/appointments/appointmentRepository';
import type { TemplateRepository, TemplateRecord } from '../../infrastructure/templates/templateRepository';
import { TemplateParsingError } from '../../infrastructure/templates/templateRepository';
import type { ParticipantRepository } from '../../infrastructure/participants/participantRepository';
import type { AvailabilityRepository } from '../../infrastructure/availability/availabilityRepository';
import type { AppointmentMetrics } from '../../infrastructure/metrics/appointmentMetrics';
import { AvailabilityAggregator } from '../../domain/availabilityAggregator';
import { compareSlotKeys, splitSlotKey } from '../../domain/slotKey';

export class AppointmentNotFoundError extends Error {
  constructor(public readonly appointmentId: string) {
    super('Appointment not found');
  }
}

export class TemplateUnavailableError extends Error {
  constructor(public readonly templateId: string) {
    super('Template unavailable');
  }
}

export class TemplateEvaluationError extends Error {
  constructor(public readonly templateId: string) {
    super('Template evaluation failed');
  }
}

export class ServiceUnavailableError extends Error {
  constructor() {
    super('Service temporarily unavailable');
  }
}

export interface ViewAppointmentContext {
  requestId?: string;
}

export interface TemplateCache {
  get(id: string): TemplateRecord | null;
  set(id: string, record: TemplateRecord): void;
  clear(): void;
}

export interface ViewAppointmentResult {
  appointment: {
    id: string;
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
    timeSlotTemplateId: string;
  };
  template: {
    id: string;
    name: string;
    description: string | null;
    rules: TemplateRecord['rules'];
  };
  participants: Array<{
    participantId: string;
    nickname: string;
    submittedAt: string | null;
    responses: string[];
  }>;
  aggregates: {
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

export class ViewAppointmentService {
  private readonly aggregator = new AvailabilityAggregator();

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly participantRepository: ParticipantRepository,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly templateCache: TemplateCache,
    private readonly metrics: AppointmentMetrics,
    private readonly logger: Logger
  ) {}

  async execute(appointmentId: string, context: ViewAppointmentContext): Promise<ViewAppointmentResult> {
    const start = Date.now();
    let cacheHit = true;
    let templateId: string | undefined;

    try {
      const appointment = await this.loadAppointment(appointmentId, context);
      templateId = appointment.timeSlotTemplateId;
      const template = await this.resolveTemplate(appointment, context, (hit) => {
        cacheHit = hit;
      });
      const { participants, availability } = await this.loadParticipantsAndAvailability(appointment.id, context);

      const availabilityByParticipant = new Map<string, string[]>();
      for (const record of availability) {
        if (!availabilityByParticipant.has(record.participantId)) {
          availabilityByParticipant.set(record.participantId, []);
        }
        availabilityByParticipant.get(record.participantId)!.push(record.slotKey);
      }

      const aggregation = this.aggregator.aggregate(
        availability.map((record) => ({ participantId: record.participantId, slotKey: record.slotKey }))
      );
      const participantCount = participants.length;

      const slotSummaries = Array.from(aggregation.availableCountBySlotKey.entries())
        .sort(([slotKeyA], [slotKeyB]) => compareSlotKeys(slotKeyA, slotKeyB))
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

      const participantDtos = participants.map((participant) => ({
        participantId: participant.id,
        nickname: participant.nickname,
        submittedAt: participant.submittedAt ? participant.submittedAt.toISOString() : null,
        responses: availabilityByParticipant.get(participant.id) ?? []
      }));

      const result: ViewAppointmentResult = {
        appointment: {
          id: appointment.id,
          title: appointment.title,
          summary: appointment.summary,
          createdAt: appointment.createdAt.toISOString(),
          updatedAt: appointment.updatedAt.toISOString(),
          timeSlotTemplateId: appointment.timeSlotTemplateId
        },
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          rules: template.rules
        },
        participants: participantDtos,
        aggregates: {
          participantCount,
          slotSummaries
        }
      };

      const duration = Date.now() - start;
      this.metrics.observeAppointmentViewDuration(duration, cacheHit);
      this.logger.info(
        {
          event: 'appointment.viewed',
          appointmentId: appointment.id,
          participantCount,
          slotCount: slotSummaries.length,
          durationMs: duration,
          requestId: context.requestId
        },
        'Appointment viewed'
      );

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.metrics.observeAppointmentViewDuration(duration, cacheHit);
      if (error instanceof AppointmentNotFoundError) {
        throw error;
      }
      if (
        error instanceof TemplateUnavailableError ||
        error instanceof TemplateEvaluationError ||
        error instanceof ServiceUnavailableError
      ) {
        throw error;
      }
      this.logger.error(
        {
          event: 'appointment.view_failed',
          requestId: context.requestId,
          error: {
            context: {
              appointmentId,
              templateId,
              stage: 'unknown'
            }
          },
          err: error
        },
        'Appointment view failed'
      );
      throw error;
    }
  }

  private async loadAppointment(appointmentId: string, context: ViewAppointmentContext) {
    try {
      const appointment = await this.appointmentRepository.findById(appointmentId);
      if (!appointment) {
        throw new AppointmentNotFoundError(appointmentId);
      }
      return appointment;
    } catch (error) {
      if (error instanceof AppointmentNotFoundError) {
        throw error;
      }
      this.logger.error(
        {
          event: 'appointment.view_failed',
          requestId: context.requestId,
          error: {
            context: {
              appointmentId,
              stage: 'fetch-appointment'
            }
          },
          err: error
        },
        'Failed to load appointment'
      );
      throw new ServiceUnavailableError();
    }
  }

  private async resolveTemplate(
    appointment: AppointmentRecord,
    context: ViewAppointmentContext,
    onCacheEvaluation: (cacheHit: boolean) => void
  ) {
    const templateId = appointment.timeSlotTemplateId;
    const cached = this.templateCache.get(templateId);
    if (cached) {
      onCacheEvaluation(true);
      return cached;
    }

    onCacheEvaluation(false);
    this.logger.debug(
      {
        event: 'template.cache.miss',
        requestId: context.requestId,
        templateId,
        appointmentId: appointment.id
      },
      'Template cache miss'
    );

    try {
      const template = await this.templateRepository.findById(templateId);
      if (!template) {
        throw new TemplateUnavailableError(templateId);
      }
      this.templateCache.set(templateId, template);
      return template;
    } catch (error) {
      if (error instanceof TemplateUnavailableError) {
        throw error;
      }
      this.logger.error(
        {
          event: 'appointment.view_failed',
          requestId: context.requestId,
          error: {
            context: {
              appointmentId: appointment.id,
              stage: 'load-template'
            }
          },
          err: error
        },
        'Failed to load template'
      );
      if (error instanceof TemplateParsingError) {
        throw new TemplateEvaluationError(templateId);
      }
      throw new ServiceUnavailableError();
    }
  }
  private async loadParticipantsAndAvailability(appointmentId: string, context: ViewAppointmentContext) {
    try {
      const [participants, availability] = await Promise.all([
        this.participantRepository.listByAppointment(appointmentId),
        this.availabilityRepository.listAvailability(appointmentId)
      ]);
      return { participants, availability };
    } catch (error) {
      this.logger.error(
        {
          event: 'appointment.view_failed',
          requestId: context.requestId,
          error: {
            context: {
              appointmentId,
              stage: 'aggregate-availability'
            }
          },
          err: error
        },
        'Failed to load availability'
      );
      throw new ServiceUnavailableError();
    }
  }
}
